function createSessionJobCore (lib, mylib) {
  'use strict';
  var OnGateJobCore = mylib.OnGate,
    q = lib.q,
    qlib = lib.qlib,
    SteppedJobOnSteppedInstance = qlib.SteppedJobOnSteppedInstance;
  
  function CreateSessionJobCore (gate, user, sessionid, arg1) {
    OnGateJobCore.call(this, gate);
    this.user = user;
    this.sessionid = sessionid;
    this.arg1 = arg1;
  }
  lib.inherit(CreateSessionJobCore, OnGateJobCore)
  CreateSessionJobCore.prototype.destroy = function () {
    this.arg1 = null;
    this.sessionid = null;
    this.user = null;
    OnGateJobCore.prototype.destroy.call(this);
  };

  CreateSessionJobCore.prototype.create = function () {
    var sess;
    if (!this.gate.sessions) {
      return null;
    }
    sess = this.gate.sessions.get(this.sessionid);
    if (sess) {
      return sess;
    }
    return this.user.createSession(this.gate, this.sessionid, this.arg1);
  }

  CreateSessionJobCore.prototype.steps = [
    'create'
  ];

  mylib.CreateSession = CreateSessionJobCore;
}
module.exports = createSessionJobCore;