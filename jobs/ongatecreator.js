function createJobOnGate (lib, mylib) {
  'use strict';

  var JobOnDestroyableBase = lib.qlib.JobOnDestroyableBase;

  function JobOnGate (gate, defer) {
    JobOnDestroyableBase.call(this, gate, defer);
  }
  lib.inherit(JobOnGate, JobOnDestroyableBase);
  JobOnGate.prototype._destroyableOk = function () {
    if (!this.destroyable) {
      return false;
    }
    if (!this.destroyable.service) {
      console.error('service instance was not found on '+this.destroyable.constructor.name+', assumed dead');
      return false;
    }
    if (!this.destroyable.service.state) {
      console.error('service instance found on '+this.destroyable.constructor.name+', has no state, assumed dead');
      return false;
    }
    if (this.destroyable.service.state.get('closed')) {
      console.error('service instance found on '+this.destroyable.constructor.name+', is in "closed" state');
      return false;
    }
    return true;
  };

  mylib.JobOnGate = JobOnGate;
}
module.exports = createJobOnGate;
