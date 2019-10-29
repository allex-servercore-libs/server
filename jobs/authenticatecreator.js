function createAuthenticateJob (lib, mylib) {
  'use strict';

  var qlib = lib.qlib,
    JobOnGate = mylib.JobOnGate;

  function AuthenticateJob (gate, identity, arg1, defer) {
    JobOnGate.call(this, gate, defer);
    this.identity = identity;
    this.arg1 = arg1;
    this.sessionid = null;
  }
  lib.inherit(AuthenticateJob, JobOnGate);
  AuthenticateJob.prototype.destroy = function () {
    this.sessionid = null;
    this.arg1 = null;
    this.identity = null;
    JobOnGate.prototype.destroy.call(this);
  };
  AuthenticateJob.prototype.go = function () {
    var ok = this.okToGo(), reservedsession, usersession;
    if (!ok.ok) {
      return ok.val;
    }
    if (!lib.isArray(this.identity)) {
      console.error('identity is not an Array');
      this.resolve(null);
      return;
    }
    this.sessionid = this.identity[0];
    reservedsession = this.destroyable.introducer.check(this.sessionid);
    if(reservedsession){
      //if a session already exists, kick it out
      usersession = this.destroyable.sessions.get(this.sessionid);
      if (usersession) {
        (new mylib.KickOutSessionJob(this.destroyable, usersession)).go().then(
          this.onResolvedUser.bind(this),
          this.reject.bind(this)
        );
        return;
      }
      this.onResolvedUser(reservedsession);
      return;
    }
    usersession = this.destroyable.sessions.get(this.sessionid);
    if(usersession){
      if(!(usersession.user && usersession.user.__service)){
        console.error('usersession from gate sessions has got no user and user.__service');
        this.resolve(null);
        return;
      }
      this.resolve(usersession);
      return;
    }
    if (!this.identity[1]) {
      this.resolve(null);
      return;
    }

    if(this.destroyable.authenticatorSink){
      this.destroyable.authenticatorSink.call('resolve', this.identity[1]).done(
        this.onResolvedUser.bind(this),
        this.reject.bind(this)
      );
    }else{
      console.error('gate has got no authenticatorSink');
      this.resolve(null);
    }
  };
  AuthenticateJob.prototype.onResolvedUser = function(resulthash){
    var user;
    if (!this.okToProceed()) {
      return;
    }
    if(!resulthash){
      console.error('onResolvedUser has no resulthash', resulthash);
      this.resolve(null);
      return;
    }
    if(!resulthash.__service){
      resulthash.__service = this.destroyable.service;
    }
    user = resulthash.__service.introduceUser(resulthash);
    if(user){
      qlib.thenAny(user, this.onUserIntroduced.bind(this), this.reject.bind(this));
      return;
    }
    console.log('no user found for session',this.sessionid,'hash',lib.pickExcept(resulthash,['__service']),'on',resulthash.__service.modulename, resulthash.__service.destroyed ? 'alive' : 'dead');
    this.resolve(null);
  };
  AuthenticateJob.prototype.onUserIntroduced = function (user) {
    var s;
    if (!this.okToProceed()) {
      user.destroy();
      return;
    }
    s = this.destroyable.createSession(user, this.sessionid, this.arg1);
    if (!s) {
      console.error('createSession resulted in no session', s);
    }
    qlib.thenAny(s, this.resolve.bind(this));
  };


  mylib.AuthenticateJob = AuthenticateJob;
}
module.exports = createAuthenticateJob;

