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
      throw new lib.Error('SERVICE_INSTANCE_NOT_FOUND', 'service instance was not found on '+this.destroyable.constructor.name+', assumed dead');
    }
    if (!this.destroyable.service.state) {
      throw new lib.Error('SERVICE_INSTANCE_FOUND_HAS_NO_STATE', 'service instance found on '+this.destroyable.constructor.name+', has no state, assumed dead');
    }
    if (this.destroyable.service.state.get('closed')) {
      throw new lib.Error('SERVICE_INSTANCE_FOUND_IN_CLOSED_STATE', 'service instance found on '+this.destroyable.constructor.name+', is in "closed" state');
    }
    return true;
  };

  mylib.JobOnGate = JobOnGate;
}
module.exports = createJobOnGate;
