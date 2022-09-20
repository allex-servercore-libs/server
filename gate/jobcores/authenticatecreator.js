function createAuthenticateJobCore (lib, mylib) {
  'use strict';

  var OnGateJobCore = mylib.OnGate,
    qlib = lib.qlib,
    SteppedJobOnSteppedInstance = qlib.SteppedJobOnSteppedInstance;

  function AuthenticateJobCore (gate, identity, arg1) {
    OnGateJobCore.call(this, gate);
    this.identity = identity;
    this.arg1 = arg1;
    this.sessionid = null;
    this.hashToResolve = null;
    this.finalResult = null;
  }
  lib.inherit(AuthenticateJobCore, OnGateJobCore);
  AuthenticateJobCore.prototype.destroy = function () {
    this.finalResult = null;
    this.hashToResolve = null;
    this.sessionid = null;
    this.arg1 = null;
    this.identity = null;
    OnGateJobCore.prototype.destroy.call(this);
  };
  AuthenticateJobCore.prototype.shouldContinue = function () {
    var ret = OnGateJobCore.prototype.shouldContinue.call(this);
    if (ret) {
      return ret;
    }
  };

  AuthenticateJobCore.prototype.evaluateSessionId = function () {
    if (!lib.isArray(this.identity)) {
      this.finalResult = {result: null};
      return;
    }
    return this.identity[0];
  };
  AuthenticateJobCore.prototype.onSessionId = function (sessid) {
    if (this.finalResult) {
      return;
    }
    this.sessionid = sessid;
  };
  AuthenticateJobCore.prototype.checkSessionIdReserved = function () {
    if (this.finalResult) {
      return;
    }
    if (this.sessionid) {
      return this.gate.introducer.check(this.sessionid, 'bla');
    }
  };
  AuthenticateJobCore.prototype.onCheckSessionIdReserved = function (rsrvd) {
    var usersession;
    if (this.finalResult) {
      return;
    }
    if (this.sessionid) {
      usersession = this.gate.sessions.get(this.sessionid);
    }
    if (rsrvd) {
      if (usersession) {
        return new mylib.KickOutSessionJob(this.gate, usersession).go().then(
          qlib.returner(rsrvd),
          function() {return null;}
        );
      }
      return rsrvd;
    }
    if (usersession) {
      this.finalResult = {result: usersession};
      if (!(usersession.user && usersession.user.__service)) {
        this.gate.sessions.remove(this.sessionid); //stay clean
        console.error('problem', usersession);
        console.error('for', this.sessionid, 'usersession from gate sessions has got no user and user.__service');
        this.finalResult = {result: null};
      }
      return;
    }
    if (!this.identity[1]) {
      this.finalResult = {result: null};
      return;
    }
    if(this.gate.authenticatorSink){
      return this.gate.authenticatorSink.call('resolve', this.identity[1]);
    }
    console.error('gate', this.gate.constructor.name, 'has got no authenticatorSink');
    this.finalResult = {result: null};
  };
  AuthenticateJobCore.prototype.afterOnCheckSessionIdReserved = function (hash) {
    if (this.finalResult) {
      return;
    }
    this.hashToResolve = hash;
  };
  AuthenticateJobCore.prototype.resolveHash = function () {
    if (this.finalResult) {
      return;      
    }
    if (!this.hashToResolve) {
      console.error('for', this.sessionid, 'onResolvedUser has no resulthash', resulthash);
      this.finalResult = {result: null};
      return;
    }
    if (!this.hashToResolve.__service) {
      this.hashToResolve.__service = this.gate.service;
    }
    return this.hashToResolve.__service.introduceUser(this.hashToResolve);
  };
  AuthenticateJobCore.prototype.onHashResolved = function (user) {
    if (this.finalResult) {
      return;
    }
    if (!user) {
      this.finalResult = {result: null};
    }
    return qlib.newSteppedJobOnSteppedInstance(
      new mylib.CreateSession(
        this.gate,
        user,
        this.sessionid,
        this.arg1
      )
    ).go();
    //return this.gate.createSession(user, this.sessionid, this.arg1);
  };
  AuthenticateJobCore.prototype.onSessionCreated = function (sess) {
    if (this.finalResult) {
      return;
    }
    this.finalResult = {result: sess};
  };
  AuthenticateJobCore.prototype.finalize = function () {
    return this.finalResult ? this.finalResult.result : null;
  };

  AuthenticateJobCore.prototype.steps = [
    'evaluateSessionId',
    'onSessionId',
    'checkSessionIdReserved',
    'onCheckSessionIdReserved',
    'afterOnCheckSessionIdReserved',
    'resolveHash',
    'onHashResolved',
    'onSessionCreated',
    'finalize'
  ];

  function AuthenticateJob (gate, identity, arg1, defer) {
    SteppedJobOnSteppedInstance.call(
      this,
      new AuthenticateJobCore(gate, identity, arg1),
      defer
    );
  }
  lib.inherit(AuthenticateJob, SteppedJobOnSteppedInstance);

  mylib.AuthenticateJob = AuthenticateJob;
}
module.exports = createAuthenticateJobCore;