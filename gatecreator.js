function createGate(execlib,IntroductionStrategy){
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    jobs = require('./jobs')(lib);

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

  function Gate(service,authenticator){
    if (!(service && service.destroyed)) {
      return;
    }
    this.service = service;
    this.authenticatorSink = authenticator;
    this.service.destroyed.attachForSingleShot(this.destroy.bind(this));
    this.sessions = new lib.Map();
    //this.sessions = new SessionsMap(this.constructor.name);
    this.introducer = new IntroductionStrategy();
    this.jobs = new qlib.JobCollection();
  }
  Gate.prototype.destroy = function(){
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
    this.service = null;
  };
  Gate.prototype.onAuthenticatorDead = function(){
    this.authenticatorSink = null;
    this.destroy();
  };
  Gate.prototype.authenticate = function(identity, arg1) {
    if (!this.jobs) {
      return q(null);
    }
    return this.jobs.run('.', new jobs.AuthenticateJob(this, identity, arg1));
  };
  Gate.prototype.createSession = function(user,sessionid,arg1){
    var usersession;
    if (!this.sessions) {
      return null;
    }
    if (this.sessions.get(sessionid)) {
      return null;
    }
    usersession = user.createSession(this,sessionid,arg1);
    if (usersession) {
      if (q.isThenable(usersession)) {
        usersession.then(this.handleCreatedUserSession.bind(this));
      } else {
        this.handleCreatedUserSession(usersession);
      }
    }
    return usersession;
  };
  Gate.prototype.handleCreatedUserSession = function (usersession) {
    if (this.sessions && usersession && usersession.session) {
      this.sessions.add(usersession.session,usersession);
    }
  };
  Gate.prototype.defaultResponseObject = function (queryobj) {
    //console.log('defaultResponseObject', queryobj);
    return ['f', queryobj];
  };
  return Gate;
}

module.exports = createGate;
