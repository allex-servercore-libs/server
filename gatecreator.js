function createGate(execlib,IntroductionStrategy){
  'use strict';
  var lib = execlib.lib, q = lib.q, qlib = lib.qlib;
  function clog(identity) {
    return;
    /*
    if (identity && identity[0] === '1237ced5ed97198401475853770428fc75dad9472') {
      console.log.apply(console, Array.prototype.slice.call(arguments, 1));
    }
    */
  }
  function Gate(service,authenticator){
    if (!(service && service.destroyed)) {
      return;
    }
    this.service = service;
    this.authenticatorSink = authenticator;
    this.service.destroyed.attachForSingleShot(this.destroy.bind(this));
    this.sessions = new lib.Map();
    this.introducer = new IntroductionStrategy();
  }
  Gate.prototype.destroy = function(){
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
    clog(identity, this.communicationType,'authenticating',identity);//,arg1);
    var d = q.defer(), usersession, reservedsession, sessid;
    if (!lib.isArray(identity)) {
      console.error('identity is not an Array');
      d.resolve(null);
      return d.promise;
    }
    if (!this.service) {
      console.error('gate got no service');
      d.resolve(null);
      return d.promise;
    }
    if (!this.service.state) {
      console.error('gate service got no state');
      d.resolve(null);
      return d.promise;
    }
    if (this.service.state.get('closed')) {
      console.error('gate service is in closed state');
      d.resolve(null);
      return d.promise;
    }
    sessid = identity[0];
    clog(identity, process.pid,'What about',identity[0],'in',identity);
    reservedsession = this.introducer.check(sessid);
    if(reservedsession){
      clog(identity, process.pid,identity[0],'maps to reserved identity',reservedsession);//,reservedsession);
      //if a session already exists, kick it out
      usersession = this.sessions.get(sessid);
      if (usersession) {
        console.log('usersession', sessid, 'better have the user', !!usersession.user);
        if (usersession.destroyed) {
          usersession.destroyed.attachForSingleShot(
            this.onSessionKickedOut.bind(this, d, usersession.user, sessid, arg1, reservedsession)
          );
          //usersession.destroy();
          usersession.terminate();
        } else {
          lib.runNext(this.onResolvedUser.bind(this, d, sessid, arg1, reservedsession), 100);
        }
      } else {
        this.onResolvedUser(d,sessid,arg1,reservedsession);
      }
      return d.promise;
    }
    usersession = this.sessions.get(sessid);
    //console.log('USER SESSION: ',usersession);
    if(usersession){
      if(!(usersession.user && usersession.user.__service)){
        console.error('usersession from gate sessions has got no user and user.__service');
        d.resolve(null);
      } else {
        d.resolve(usersession);
      }
    }else{
      //console.log(process.pid,'no session',identity.session,'in','reserved');//require('util').inspect(this.sessions,{depth:null}));
      if (!identity[1]) {
        console.error('no credentials in',identity);
        d.resolve(null);
        return d.promise;
      }

      if(this.authenticatorSink){
        this.authenticatorSink.call('resolve', identity[1]).done(
          this.onResolvedUser.bind(this,d,null,arg1),
          d.reject.bind(d)
        );
      }else{
        console.error('gate has got no authenticatorSink');
        d.resolve(null);
      }
    }
    return d.promise;
  };
  function sessionlisting(sessionuser) {
    var ret, _r;
    if (!sessionuser) {
      return 'none';
    }
    if (!sessionuser.sessions) {
      return 'empty';
    }
    _r = '';
    sessionuser.sessions.traverse(function (s) {
      if (_r.length) _r += ',';
      _r += s.session;
    });
    ret = _r;
    _r = null;
    return ret;
  }
  Gate.prototype.onSessionKickedOut = function (d, sessionuser, sessid, arg1, reservedsession) {
    if (sessionuser && sessionuser.destroyed && !sessionuser.aboutToDie) {
      sessionuser.destroyed.attachForSingleShot(this.onResolvedUser.bind(this, d, sessid, arg1, reservedsession));
    }
    this.onResolvedUser(d, sessid, arg1, reservedsession);
  };
  Gate.prototype.createSession = function(user,session,arg1){
    var usersession;
    if (this.sessions.get(session)) {
      return null;
    }
    usersession = user.createSession(this,session,arg1);
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
    if (usersession && usersession.session) {
      this.sessions.add(usersession.session,usersession);
    }
  };
  Gate.prototype.onResolvedUser = function(defer,session,arg1,resulthash){
    //console.log('onResolvedUser SAID:', resulthash,arg1);
    if(!resulthash){
      console.error('onResolvedUser has no resulthash', resulthash);
      defer.resolve(null);
      defer = null;
      session = null;
      arg1 = null;
      return;
    }
    if(!resulthash.__service){
      //console.log('HAH! default service');
      resulthash.__service = this.service;
      /*
      console.trace();
      console.error('no __service in',resulthash);
      process.exit(0);
      */
    }
    var user = resulthash.__service.introduceUser(resulthash);
    if(user){
      if (lib.isFunction(user.done)) {
        user.done(
          this.onUserIntroduced.bind(this, defer, session, arg1)
        );
      } else {
        this.onUserIntroduced(defer, session, arg1, user);
      }
    }else{
      console.log(process.pid,'no user found for session',session,'hash',resulthash,'on',resulthash.__service.modulename, resulthash.__service.destroyed ? 'alive' : 'dead');
      defer.resolve(null);
    }
    defer = null;
    session = null;
    arg1 = null;
  };
  Gate.prototype.onUserIntroduced = function (defer, session, arg1, user) {
    var s = this.createSession(user, session, arg1);
    if (!s) {
      console.error('createSession resulted in no session', s);
    }
    if (q.isThenable(s)) {
      s.then(this.resolveWithUserSession.bind(this, defer));
    } else {
      this.resolveWithUserSession(defer, s);
    }
    defer = null;
    session = null;
    arg1 = null;
  };
  Gate.prototype.resolveWithUserSession = function (defer, session) {
    defer.resolve(session);
    defer = null;
  };
  Gate.prototype.defaultResponseObject = function (queryobj) {
    console.log('defaultResponseObject', queryobj);
    return ['f', queryobj];
  };
  return Gate;
}

module.exports = createGate;
