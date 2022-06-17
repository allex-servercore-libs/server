function createServiceStarterJobCore (execlib, mixinslib, mylib) {
  'use strict';

  var lib = execlib.lib,
    qlib = lib.qlib,
    ServerDescriptorJobCore = mylib.ServerDescriptor,
    ServiceActivatorMixin = mixinslib.ServiceActivator;

  function ServiceStarterJobCore (listeningservers, serverdescriptor, registry, sessionintroductor, serverclass) {
    ServerDescriptorJobCore.call(this, listeningservers, serverdescriptor);
    ServiceActivatorMixin.call(this, registry, sessionintroductor, serverclass);
    this.finalResult = null;
    this.authActivationPack = null;
    this.masterActivationPack = null;
  }
  lib.inherit(ServiceStarterJobCore, ServerDescriptorJobCore);
  ServiceActivatorMixin.addMethods(ServiceStarterJobCore);
  ServiceStarterJobCore.prototype.destroy = function () {
    if (!this.finalResult){
      if (this.authActivationPack) {
        if (this.authActivationPack.supersink) {
          this.authActivationPack.supersink.destroy();
        }
        if (this.authActivationPack.server) {
          this.authActivationPack.server.destroy();
        }
      }
    }
    this.masterActivationPack = null;
    this.authActivationPack = null;
    this.finalResult = null;
    ServiceActivatorMixin.prototype.destroy.call(this);
    ServerDescriptorJobCore.prototype.destroy.call(this);
  };
  ServiceStarterJobCore.prototype.shouldContinue = function () {
    var ret = ServerDescriptorJobCore.prototype.shouldContinue.call(this);
    if (ret) {
      return ret;
    }
    ret = ServiceActivatorMixin.prototype.shouldContinue.call(this);
    if (ret) {
      return ret;
    }
    if (this.authActivationPack) {
      if (!this.authActivationPack.supersink) {
        return new lib.Error('NO_MASTERSINK_IN_AUTHENTICATION_ACTIVATION_PACK');
      }
      if (!this.authActivationPack.supersink.destroyed) {
        return new lib.Error('ACQUIRED_AUTHENTICATION_SINK_ALREADY_DESTROYED');
      }
    }
    if (this.masterActivationPack) {
      if (!this.masterActivationPack.supersink) {
        return new lib.Error('NO_MASTERSINK_IN_MASTER_ACTIVATION_PACK');
      }
      if (!this.masterActivationPack.supersink.destroyed) {
        return new lib.Error('ACQUIRED_MASTER_SINK_ALREADY_DESTROYED');
      }
    }
  };

  ServiceStarterJobCore.prototype.init = function () {
    ServerDescriptorJobCore.prototype.init.call(this);
    if (this.instanceName()) {
      this.finalResult = this.registry.superSinks.get(this.instanceName());
    }
  };
  ServiceStarterJobCore.prototype.activateAuthSink = function () {
    if (this.finalResult) {
      return;
    }
    return qlib.newSteppedJobOnSteppedInstance(
      new mylib.ServiceActivator(
        this.listeningservers,
        {
          modulename: '.authentication',
          propertyhash: {
            strategies: {
              rolemapper: this.serverdescriptor.service.rolemapping
            }
          }
        },
        this.registry,
        this.sessionintroductor,
        this.serverclass
      )
    ).go();
  };
  ServiceStarterJobCore.prototype.onAuthSinkActivated = function (authactivationpack) {
    if (this.finalResult) {
      return;
    }
    if (!authactivationpack) {
      throw new lib.Error('NO_AUTHENTICATION_SINK_ACQUIRED');
    }
    this.authActivationPack = authactivationpack;
  };
  ServiceStarterJobCore.prototype.activateMasterSink = function () {
    if (this.finalResult) {
      return;
    }
    return qlib.newSteppedJobOnSteppedInstance(
      new mylib.ServiceActivator(
        this.listeningservers,
        this.servicedescriptor,
        this.registry,
        this.sessionintroductor,
        this.serverclass,
        this.authActivationPack.supersink
      )
    ).go();
  };
  ServiceStarterJobCore.prototype.onMasterSinkActivated = function (masteractivationpack) {
    this.masterActivationPack = masteractivationpack;
  };
  ServiceStarterJobCore.prototype.registerMasterSink = function () {
    if (this.finalResult) {
      return;
    }
    if (this.instanceName()) {
      this.registry.registerSuperSink(this.instanceName(), this.authActivationPack.supersink);
    }    
  };
  ServiceStarterJobCore.prototype.onMasterSinkRegistered = function () {

  };
  ServiceStarterJobCore.prototype.startPorts = function () {
    if (this.finalResult) {
      return;
    }
    return this.masterActivationPack.server.startPorts(this.serverdescriptor.ports);
  };
  ServiceStarterJobCore.prototype.onPortsStarted = function (portstartresult) {
  };
  ServiceStarterJobCore.prototype.finalize = function () {
    this.finalResult = this.masterActivationPack.supersink;
    return this.finalResult;
  };

  ServiceStarterJobCore.prototype.steps = [
    'init',
    'activateAuthSink',
    'onAuthSinkActivated',
    'activateMasterSink',
    'onMasterSinkActivated',
    'registerMasterSink',
    'onMasterSinkRegistered',
    'startPorts',
    'onPortsStarted',
    'finalize'
  ];

  mylib.ServiceStarter = ServiceStarterJobCore;
}
module.exports = createServiceStarterJobCore;