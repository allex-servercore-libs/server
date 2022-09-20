function createGate(execlib,IntroductionStrategy, mylib){
  'use strict';
  var lib = execlib.lib,
    Destroyable = lib.Destroyable,
    q = lib.q,
    qlib = lib.qlib,
    jobcores = require('./jobcores')(execlib);

  /* for test 
  function SessionsMap (parentctorname) {
    lib.Map.call(this);
    this.parentctorname = parentctorname;
  }
  lib.inherit(SessionsMap, lib.Map);
  SessionsMap.prototype.add = function (sessid, sess) {
    if (sess.wswrapper) {
      console.trace();
      console.log(this.parentctorname, 'adding session', sessid, 'from', sess.wswrapper._id);
    }
    if (!(sess && sess.aboutToDie)) {
      console.trace();
      console.error('session already dying?');
    }
    return lib.Map.prototype.add.call(this, sessid, sess);
  };
  */

  function Gate(service,options,gateoptions,authenticator){
    /*
    console.log('new', this.constructor.name);
    console.log('service', service);
    console.log('options', options);
    console.log('authenticator', authenticator);
    */
    if (!(service && service.destroyed)) {
      return;
    }
    if (!(authenticator && authenticator.destroyed)) {
      return;
    }
    Destroyable.call(this);
    this.service = service;
    this.options = options;
    this.myoptions = gateoptions;
    this.authenticatorSink = authenticator;
    this.service.destroyed.attachForSingleShot(this.destroy.bind(this));
    this.sessions = new lib.Map();
    //this.sessions = new SessionsMap(this.constructor.name);
    this.introducer = new IntroductionStrategy();
    this.jobs = new qlib.JobCollection();
    this.sessionEvent = new lib.HookCollection();
    this.jobs.run('.', qlib.newSteppedJobOnSteppedInstance(new jobcores.CreateLoggers(this)));
  }
  lib.inherit(Gate, Destroyable);
  Gate.prototype.__cleanUp = function(){
    if (this.sessionEvent) {
      this.sessionEvent.destroy();
    }
    this.sessionEvent = null;
    if (this.jobs) {
      this.jobs.destroy();
    }
    this.jobs = null;
    if (this.introducer) {
      this.introducer.destroy();
    }
    this.introducer = null;
    if (this.sessions) {
      this.sessions.destroy();
    }
    this.sessions = null;
    if(this.authenticatorSink){
      this.authenticatorSink.destroy();
    }
    this.authenticatorSink = null;
    this.myoptions = null;
    this.options = null;
    this.service = null;
  };
  Gate.prototype.onAuthenticatorDead = function(){
    this.authenticatorSink = null;
    this.destroy();
  };
  //static, this is Gate
  function authenticate (identity, arg1) {
    if (!this.jobs) {
      return q(null);
    }
    return this.jobs.run('.', new jobcores.AuthenticateJob(this, identity, arg1));
  };
  Gate.prototype.authenticateAndServe = function (talker, identity, queryarry, errorfunc) {
    authenticate.call(this, identity, talker).done(
      this.serve.bind(this, talker, queryarry),
      errorfunc.bind(null, talker, queryarry)
    )
    talker = null;
    queryarry = null;
  };
  Gate.prototype.handleSessionEvent = function (evntobj) {
    if (!(evntobj && evntobj.type && evntobj.session && this.sessionEvent)) {
      return;
    }
    switch (evntobj.type) {
      case 'created':
        this.handleCreatedUserSession(evntobj.session);
        break;
      case 'destroy_1':
        this.onSessionDown(evntobj.session);
        break;
    }
    this.sessionEvent.fire(evntobj);
  };
  Gate.prototype.handleCreatedUserSession = function (usersession) {
    if (this.sessions && usersession && usersession.session && usersession.destroyed) {
      this.sessions.add(usersession.session,usersession);
    }
  };
  Gate.prototype.onSessionDown = function (sessid) {
    if (this.sessions) {
      this.sessions.remove(sessid);
    }
  };
  Gate.prototype.defaultResponseObject = function (queryobj) {
    //console.log('defaultResponseObject', queryobj);
    return ['f', queryobj];
  };

  Gate.prototype.serve = function (talkingsource, queryarry) {
    throw new lib.Error('NOT_IMPLEMENTED', '"serve" has to be implemented by '+this.constructor.name);
  };
  mylib.Gate = Gate;
}

module.exports = createGate;
