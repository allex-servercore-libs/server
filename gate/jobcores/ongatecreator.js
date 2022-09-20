function createOnGateJobCore (lib, mylib) {
  'use strict';

  function OnGateJobCore (gate) {
    this.gate = gate;
  }
  OnGateJobCore.prototype.destroy = function () {
    this.gate = null;
  };
  OnGateJobCore.prototype.shouldContinue = function () {
    if (!this.gate) {
      return new lib.Error('NO_GATE', this.constructor.name+' must have a job core');
    }
    if (!this.gate.service) {
      return new lib.Error('SERVICE_INSTANCE_NOT_FOUND', 'service instance was not found on '+this.gate.constructor.name+', assumed dead');
    }
    if (!this.gate.service.state) {
      return new lib.Error('SERVICE_INSTANCE_FOUND_HAS_NO_STATE', 'service instance found on '+this.gate.constructor.name+', has no state, assumed dead');
    }
    if (this.gate.service.state.get('closed')) {
      return new lib.Error('SERVICE_INSTANCE_FOUND_IN_CLOSED_STATE', 'service instance found on '+this.gate.constructor.name+', is in "closed" state');
    }
  };

  mylib.OnGate = OnGateJobCore;
}
module.exports = createOnGateJobCore;