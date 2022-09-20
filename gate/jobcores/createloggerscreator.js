function createCreateLoggersJobCore (execlib, mylib) {
  'use strict';

  var OnGateJobCore = mylib.OnGate,
    lib = execlib.lib,
    qlib = lib.qlib;

  function LoggerReadyCheckJobCore (gate, logger) {
    OnGateJobCore.call(this, gate);
    this.logger = logger;
  }
  lib.inherit(LoggerReadyCheckJobCore, OnGateJobCore);
  LoggerReadyCheckJobCore.prototype.destroy = function () {
    this.logger = null;
    OnGateJobCore.prototype.destroy.call(this);
  };

  LoggerReadyCheckJobCore.prototype.check = function () {
    return this.logger;
  };

  LoggerReadyCheckJobCore.prototype.steps = [
    'check'
  ];

  function LoadLoggerJobCore (gate, desc) {
    OnGateJobCore.call(this, gate);
    this.desc = desc;
    this.finalResult = null;
  }
  lib.inherit(LoadLoggerJobCore, OnGateJobCore);
  LoadLoggerJobCore.prototype.destroy = function () {
    this.finalResult = null;
    this.desc = null;
    OnGateJobCore.prototype.destroy.call(this);
  };

  LoadLoggerJobCore.prototype.check = function () {
    if (!this.desc) {
      this.finalResult = true;
      return;
    }
    this.desc.source = this.desc.source || {};
    this.desc.source.propertyhash = this.desc.source.propertyhash || {};
    this.desc.source.propertyhash.gate = this.gate;
    return execlib.loadDependencies('client', ['allex:loggerregistry:lib', this.desc.modulename||'allex:base:logger'], function (registryignored, ctor) {return ctor;});
  };

  LoadLoggerJobCore.prototype.onCheck = function (ctor) {
    if (!ctor) {
      throw new lib.Error('LOGGER_LOAD_FAILED', 'Could not load '+(this.desc.modulename||'allex:base:logger'));
    }
    return new ctor(this.desc);
  };

  LoadLoggerJobCore.prototype.onInstance = function (instance) {
    return instance.jobs.run('.', qlib.newSteppedJobOnSteppedInstance(
      new LoggerReadyCheckJobCore(this.gate, instance)
    ));
  }

  LoadLoggerJobCore.prototype.finalize = function (instance) {
    return this.finalResult || instance;
  };

  LoadLoggerJobCore.prototype.steps = [
    'check',
    'onCheck',
    'onInstance',
    'finalize'
  ];

  function CreateLoggersJobCore (gate) {
    OnGateJobCore.call(this, gate);
    this.jobs = new qlib.JobCollection();
    this.finalResult = null;
  }
  lib.inherit(CreateLoggersJobCore, OnGateJobCore);
  CreateLoggersJobCore.prototype.destroy = function () {
    this.finalResult = null;
    if (this.jobs) {
      this.jobs.destroy();
    }
    this.jobs = null;
    OnGateJobCore.prototype.destroy.call(this);
  };

  CreateLoggersJobCore.prototype.inspect = function () {
    if (!this.gate.myoptions) {
      this.finalResult = true;
      return;
    }
    if (!lib.isArray(this.gate.myoptions.log)) {
      this.finalResult = true;
      return;
    }
  };
  CreateLoggersJobCore.prototype.loadModules = function () {
    if (this.finalResult) {
      return;
    }
    var jobs = this.gate.myoptions.log.reduce(this.onLogModuleReducer.bind(this), []);
    return this.jobs.runMany('.', jobs);
  };

  CreateLoggersJobCore.prototype.finalize = function (loadresults) {
    return this.finalResult || loadresults;
  };

  CreateLoggersJobCore.prototype.steps = [
    'inspect',
    'loadModules',
    'finalize'
  ];

  CreateLoggersJobCore.prototype.onLogModuleReducer = function (res, logdesc) {
    res.push(qlib.newSteppedJobOnSteppedInstance(new LoadLoggerJobCore(this.gate, logdesc)));
    return res;
  };

  mylib.CreateLoggers = CreateLoggersJobCore;
}
module.exports = createCreateLoggersJobCore;