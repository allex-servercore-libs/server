function createServiceActivatorJobCore (execlib, helpers, mixinslib, mylib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    ServiceDescriptorJobCore = mylib.ServiceDescriptor,
    ServiceActivatorMixin = mixinslib.ServiceActivator;

  function ServiceActivatorJobCore (listeningervers, servicedescriptor, gateoptions, registry, sessionintroductor, serverclass, authsink) {
    ServiceDescriptorJobCore.call(this, listeningervers, servicedescriptor);
    ServiceActivatorMixin.call(this, registry, sessionintroductor, serverclass, gateoptions);
    this.authsink = authsink;
    this.serviceclass = null;
    this.service = null;
    this.server = null;
    this.gate = null;
    this.supersink = null;
    this.sessionid = null;
  };
  lib.inherit(ServiceActivatorJobCore, ServiceDescriptorJobCore);
  ServiceActivatorMixin.addMethods(ServiceActivatorJobCore);
  ServiceActivatorJobCore.prototype.destroy = function () {
    this.sessionid = null;
    this.supersink = null;
    this.gate = null;
    this.server = null;
    this.service = null;
    this.serviceclass = null;
    this.authsink = null; //no destroy even in FakeAuthenticatorSink case
    ServiceActivatorMixin.prototype.destroy.call(this);
    ServiceDescriptorJobCore.prototype.destroy.call(this);
  };
  ServiceActivatorJobCore.prototype.shouldContinue = function () {
    var ret = ServiceDescriptorJobCore.prototype.shouldContinue.call(this);
    if (ret) {
      return ret;
    }
    ret = ServiceActivatorMixin.prototype.shouldContinue.call(this);
    if (ret) {
      return ret;
    }
  };

  ServiceActivatorJobCore.prototype.init = function () {
    ServiceDescriptorJobCore.prototype.init.call(this);
  };
  ServiceActivatorJobCore.prototype.registerServerSide = function () {
    return this.registry.registerServerSide(this.servicedescriptor.modulename);
  };
  ServiceActivatorJobCore.prototype.onRegisterServerSide = function (service) {
    this.serviceclass = service;
  };
  ServiceActivatorJobCore.prototype.activateServicePack = function () {
    var prophash, ret, service;
    prophash = servicePropHashProducer(this.servicedescriptor.propertyhash||{});
    ret = prophash.__readyToAcceptUsers.promise;
    this.service = new this.serviceclass(prophash);
    return ret;
  };
  ServiceActivatorJobCore.prototype.onServicePackActivated = function (activationpackignored) {
  };
  ServiceActivatorJobCore.prototype.doTheSpawn = function () {
    if (!(this.service && this.service.destroyed)) {
      throw new lib.Error('SERVICE_DEAD_ON_ACTIVATION');
    }
    this.service.introduceUser(helpers.makeSuperUserIdentity());
    this.server = new this.serverclass(this.service);
    this.gate = this.server.serveInProc(null, this.gateoptions.inproc, this.authsink || new FakeAuthenticatorSink(helpers.makeSuperUserIdentity()));
    this.sessionid = this.sessionintroductor.introduce (helpers.makeSuperUserIdentity());
    return this.registry.spawn({}, this.gate, {}, this.sessionid);
  };
  ServiceActivatorJobCore.prototype.onSpawn = function (supersink) {
    var d, ret;
    if (!supersink) {
      throw new lib.Error('SUPERSINK_NOT_ACQUIRED_DURING_ACTIVATION');
    }
    if (!supersink.destroyed) {
      throw new lib.Error('SUPERSINK_ACQUIRED_DURING_ACTIVATION_ALREADY_DESTROYED');
    }
    this.supersink = supersink;
    supersink.destroyed.attachForSingleShot(this.sessionintroductor.forget.bind(this.sessionintroductor, this.sessionid));
    d = q.defer();
    ret = d.promise;
    (qlib.newSteppedJobOnSteppedInstance(
      (new mylib.SinkTerminalizer(this.service, this.supersink))
    )).go().then(null, d.reject.bind(d), d.resolve.bind(d));
    d = null;
    this.service.onSuperSink(this.supersink);
    return ret;
  };
  ServiceActivatorJobCore.prototype.finalize = function () {
    return {
      server: this.server,
      supersink: this.supersink
    };
  };

  ServiceActivatorJobCore.prototype.steps = [
    'init',
    'registerServerSide',
    'onRegisterServerSide',
    'activateServicePack',
    'onServicePackActivated',
    'doTheSpawn',
    'onSpawn',
    'finalize'
  ];


  function servicePropHashProducer(originalprophash) {
    var ret = originalprophash || {};
    ret.__readyToAcceptUsers = q.defer();
    originalprophash = null;
    return ret;
  }


  function FakeAuthenticatorSink(userhash){
    this.userhash = userhash;
    this.destroyed = {};
  }
  FakeAuthenticatorSink.prototype.destroy = function(){
    this.destroyed = null;
    this.userhash = null;
  };
  FakeAuthenticatorSink.prototype.call = function(command,credentials){
    var d = q.defer();
    if(command!=='resolve'){
      d.reject('Wrong command');
    }else{
      d.resolve(this.userhash);
    }
    return d.promise;
  };

  mylib.ServiceActivator = ServiceActivatorJobCore;
}
module.exports = createServiceActivatorJobCore;