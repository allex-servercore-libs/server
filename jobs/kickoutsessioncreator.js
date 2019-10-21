function createKickOutSessionJob (lib, mylib) {
  'use strict';

  var JobOnGate = mylib.JobOnGate;

  function KickOutSessionJob (gate, usersession, defer) {
    JobOnGate.call(this, gate, defer);
    this.sessiontokickout = usersession;
    this.sessionuser = this.sessiontokickout.user;
  }
  lib.inherit(KickOutSessionJob, JobOnGate);
  KickOutSessionJob.prototype.destroy = function () {
    this.sessionuser = null;
    this.sessiontokickout = null;
    JobOnGate.prototype.destroy.call(this);
  };
  KickOutSessionJob.prototype.go = function () {
    var ok = this.okToGo();
    if (!ok.ok) {
      return ok.val;
    }
    if (!this.sessiontokickout.destroyed) {
      this.onSessionDead();
      return ok.val;
    }
    this.sessiontokickout.destroyed.attachForSingleShot(
      this.onSessionDead.bind(this)
    );
    this.sessiontokickout.terminate();
    return ok.val;
  };
  KickOutSessionJob.prototype.onSessionDead = function () {
    if (!this.okToProceeed()) {
      return;
    }
    if (this.sessionuser && this.sessionuser.destroyed && !this.sessionuser.aboutToDie) {
      //sessionuser is in the process of dying
      this.sessionuser.destroyed.attachForSingleShot(this.resolve.bind(this, true));
      return;
    }
    this.resolve(true);
  };

  mylib.KickOutSessionJob = KickOutSessionJob;
}
module.exports = createKickOutSessionJob;
