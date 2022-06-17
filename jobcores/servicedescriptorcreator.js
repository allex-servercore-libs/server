function creaateServiceDescriptorJobCore (execlib, mylib) {
  'use strict';

  var lib = execlib.lib,
  BaseServiceManipulationJobCore = mylib.BaseServiceManipulation;

  function ServiceDescriptorJobCore (listeningervers, descriptor) {
    BaseServiceManipulationJobCore.call(this, listeningervers);
    this.servicedescriptor = this.serviceDescriptorPropertyName ? descriptor[this.serviceDescriptorPropertyName] : descriptor;
  }
  lib.inherit(ServiceDescriptorJobCore, BaseServiceManipulationJobCore);
  ServiceDescriptorJobCore.prototype.destroy = function () {
    this.servicedescriptor = null;
    BaseServiceManipulationJobCore.prototype.destroy.call(this);
  };
  ServiceDescriptorJobCore.prototype.shouldContinue = function () {
    var ret = BaseServiceManipulationJobCore.prototype.shouldContinue.call(this);
    if (ret) {
      return ret;
    }
    if (!this.servicedescriptor) {
      return new lib.Error('NO_SERVICE_DESCRIPTOR');
    }
    if (!this.servicedescriptor.modulename) {
      return new lib.Error('NO_SERVICE_DESCRIPTOR_MODULNAME');
    }
  };
  ServiceDescriptorJobCore.prototype.instanceName = function () {
    return this.servicedescriptor.instancename;
  }
  ServiceDescriptorJobCore.prototype.serviceDescriptorPropertyName = '';

  mylib.ServiceDescriptor = ServiceDescriptorJobCore;
}
module.exports = creaateServiceDescriptorJobCore;