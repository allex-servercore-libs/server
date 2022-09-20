function createKickOutSessionJobCore (lib, mylib) {
  'use strict';
  var OnGateJobCore = mylib.OnGate,
    q = lib.q,
    qlib = lib.qlib,
    SteppedJobOnSteppedInstance = qlib.SteppedJobOnSteppedInstance;

  function KickOutSessionJobCore (gate, usersession) {
    OnGateJobCore.call(this, gate);
    this.sessiontokickout = usersession;
    this.sessionuser = usersession ? usersession.user : null;
    this.finalResult = null;
  }
  lib.inherit(KickOutSessionJobCore, OnGateJobCore);
  KickOutSessionJobCore.prototype.destroy = function () {
    this.finalResult = null;
    this.sessionuser = null;
    this.sessiontokickout = null;
    OnGateJobCore.prototype.destroy.call(this);
  };

  KickOutSessionJobCore.prototype.inspectSession = function () {
    var d, ret;
    if (!this.sessiontokickout) {
      this.finalResult = true;
      return;
    }
    if (!this.sessiontokickout.destroyed) {
      this.finalResult = true;
      return;
    }
    if (!lib.isFunction(this.sessiontokickout.terminate)) {
      this.finalResult = true;
      return;
    }
    d = q.defer();
    ret = d.promise;
    this.sessiontokickout.destroyed.attachForSingleShot(d.resolve.bind(d, true));
    this.sessiontokickout.terminate();
    return ret;
  };
  KickOutSessionJobCore.prototype.inspectUser = function () {
    var d, ret;
    this.finalResult = true;
    if (this.sessionuser && this.sessionuser.destroyed && !this.sessionuser.aboutToDie) {
      //sessionuser is in the process of dying
      d = q.defer();
      ret = d.promise;
      this.sessionuser.destroyed.attachForSingleShot(d.resolve.bind(d, true));
      return ret;
    }    
  };
  KickOutSessionJobCore.prototype.finalize = function () {
    return this.finalResult;
  };

  KickOutSessionJobCore.prototype.steps = [
    'inspectSession',
    'inspectUser',
    'finalize'
  ];

  function KickOutSessionJob (gate, usersession, defer) {
    SteppedJobOnSteppedInstance.call(
      this,
      new KickOutSessionJobCore(gate, usersession),
      defer
    );
  }
  lib.inherit(KickOutSessionJob, SteppedJobOnSteppedInstance);

  mylib.KickOutSessionJob = KickOutSessionJob;
}
module.exports = createKickOutSessionJobCore;