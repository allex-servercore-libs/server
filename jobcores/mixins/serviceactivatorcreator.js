function createServiceActivatorMixin (lib, mylib) {
  'use strict';

  function ServiceActivatorMixin (registry, sessionintroductor, serverclass) {
    this.registry = registry;
    this.sessionintroductor = sessionintroductor;
    this.serverclass = serverclass;
  }
  ServiceActivatorMixin.prototype.destroy = function () {
    this.serverclass = null;
    this.sessionintroductor = null;
    this.registry = null;
  };
  ServiceActivatorMixin.prototype.shouldContinue = function () {
    if (!this.registry) {
      return new lib.Error('NO_SERVICE_REGISTRY');
    }
    if (!lib.isFunction(this.sessionintroductor)) {
      return new lib.Error('NO_SESSION_INTRODUCTOR');
    }
    if (!lib.isFunction(this.serverclass)) {
      return new lib.Error('NO_SERVER_CLASS_PROVIDED');
    }
  };

  ServiceActivatorMixin.addMethods = function (klass) {

  };

  mylib.ServiceActivator = ServiceActivatorMixin;
}
module.exports = createServiceActivatorMixin;