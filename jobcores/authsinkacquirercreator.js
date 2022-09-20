function createAuthSinkAcquirerJobCore (execlib, mixinslib, mylib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    BaseServiceManipulationJobCore = mylib.BaseServiceManipulation,
    ServiceActivatorMixin = mixinslib.ServiceActivator;

  function AuthSinkAcquirerJobCore (listeningservers, registry, sessionintroductor, serverclass, strategies) {
    BaseServiceManipulationJobCore.call(this, listeningservers);
    ServiceActivatorMixin.call(this, registry, sessionintroductor, serverclass, null);
    this.strategies = strategies;
    this.activationPack = null;
    this.sink = null;
  }
  lib.inherit(AuthSinkAcquirerJobCore, BaseServiceManipulationJobCore);
  ServiceActivatorMixin.addMethods(AuthSinkAcquirerJobCore);
  AuthSinkAcquirerJobCore.prototype.destroy = function () {
    this.sink = null;
    this.activationPack = null;
    this.strategies = null;
    ServiceActivatorMixin.prototype.destroy.call(this);
    BaseServiceManipulationJobCore.prototype.destroy.call(this);
  };
  AuthSinkAcquirerJobCore.prototype.shouldContinue = function () {
    var ret = BaseServiceManipulationJobCore.prototype.shouldContinue.call(this);
    if (ret) {
      return ret;
    }
    ret = ServiceActivatorMixin.prototype.shouldContinue.call(this);
    if (ret) {
      return ret;
    }
    if (this.activationPack) {
      if (!this.activationPack.supersink) {
        return new lib.Error('NO_MASTERSINK_IN_ACTIVATION_PACK');
      }
      if (!this.activationPack.supersink.destroyed) {
        return new lib.Error('ACQUIRED_SINK_ALREADY_DESTROYED');
      }
    }
  };

  AuthSinkAcquirerJobCore.prototype.acquire = function () {
    return qlib.newSteppedJobOnSteppedInstance(
      new mylib.ServiceActivator(
        this.listeningservers,
        {
          modulename:'.authentication',
          propertyhash:{
            strategies: this.strategies
          }
        },
        {},
        this.registry,
        this.sessionintroductor,
        this.serverclass
      )
    ).go()
  };
  AuthSinkAcquirerJobCore.prototype.onAcquired = function (activationpack) {
    this.activationPack = activationpack;
  };
  AuthSinkAcquirerJobCore.prototype.subConnect = function () {
    return this.activationPack.supersink.subConnect('.',{name:'~',role:'user'},{});
  };
  AuthSinkAcquirerJobCore.prototype.terminalizeSubConnected = function (sink) {
    var d, ret;
    if (!sink) {
      throw new lib.Error('SUPERSINK_NOT_ACQUIRED_DURING_ACTIVATION');
    }
    if (!sink.destroyed) {
      throw new lib.Error('SUPERSINK_ACQUIRED_DURING_ACTIVATION_ALREADY_DESTROYED');
    }
    this.sink = sink;
    d = q.defer();
    ret = d.promise;
    (qlib.newSteppedJobOnSteppedInstance(
      (new mylib.SinkTerminalizer(this.activationPack.server.service, this.sink))
    )).go().then(null, d.reject.bind(d), d.resolve.bind(d));
    d = null;
    return ret;
  };
  AuthSinkAcquirerJobCore.prototype.finalize = function () {
    return this.sink;
  };

  AuthSinkAcquirerJobCore.prototype.steps = [
    'acquire',
    'onAcquired',
    'subConnect',
    'terminalizeSubConnected',
    'finalize'
  ];

  mylib.AuthSinkAcquirer = AuthSinkAcquirerJobCore;
}
module.exports = createAuthSinkAcquirerJobCore;