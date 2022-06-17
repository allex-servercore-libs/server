function createServerDescriptorJobCore (execlib, mylib) {
  'use strict';

  var lib = execlib.lib,
    ServiceDescriptorJobCore = mylib.ServiceDescriptor;

  function ServerDescriptorJobCore (listeningervers, serverdescriptor) {
    ServiceDescriptorJobCore.call(this, listeningervers, serverdescriptor);
    this.serverdescriptor = serverdescriptor;
  }
  lib.inherit(ServerDescriptorJobCore, ServiceDescriptorJobCore);
  ServerDescriptorJobCore.prototype.destroy = function () {
    this.serverdescriptor = null;
    ServiceDescriptorJobCore.prototype.destroy.call(this);
  };
  ServerDescriptorJobCore.prototype.shouldContinue = function () {
    var ret = ServiceDescriptorJobCore.prototype.shouldContinue.call(this);
    if (ret) {
      return ret;
    }
    if (!this.serverdescriptor.service) {
      return new lib.Error('NO_SERVERDESCRIPTOR_SERVICE');
    }
    /*
    if (!this.serverdescriptor.service.instancename) {
      return new lib.Error('NO_SERVER_DESCRIPTOR_INSTANCENAME');
    }
    */
  };
  ServerDescriptorJobCore.prototype.serviceDescriptorPropertyName = 'service';


  mylib.ServerDescriptor = ServerDescriptorJobCore;
}
module.exports = createServerDescriptorJobCore;