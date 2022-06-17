function createSinkTerminalizerJobCore (execlib, mylib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q;

  function SinkTerminalizerJobCore (service, sink) {
    this.service = service;
    this.sink = sink;
    this.defer = null;
    this.serviceclosed = false;
    this.serviceDestroyedListener = null;
    this.sinkDestroyedListener = null;
    this.originalSinkDestructionFunc = null;
    this.notify = new lib.HookCollection();
  }
  SinkTerminalizerJobCore.prototype.destroy = function () {
    if (this.notify) {
      this.notify.destroy();
    }
    this.notify = null;
    this.originalSinkDestructionFunc = null;
    if (this.sinkDestroyedListener) {
      this.sinkDestroyedListener.destroy();
    }
    this.sinkDestroyedListener = null;
    if (this.serviceDestroyedListener) {
      this.serviceDestroyedListener.destroy();
    }
    this.serviceDestroyedListener = null;
    this.serviceclosed = null;
    if (this.defer) {
      this.defer.reject('SINK_TERMINALIZER_DESTROYED');
    }
    this.defer = null;
    this.sink = null;
    this.service = null;
  };
  SinkTerminalizerJobCore.prototype.shouldContinue = function () {
    if (!this.service) {
      return new lib.Error('NO_SERVICE_TO_TERMINALIZE');
    }
    if (!this.service.destroyed) {
      return new lib.Error('SERVICE_FOR_TERMINALIZATION_ALREADY_DESTROYED');
    }
    if (!this.sink) {
      return new lib.Error('NO_SINK_TO_TERMINALIZE');
    }
    if (!this.sink.destroyed) {
      return new lib.Error('SINK_FOR_TERMINALIZATION_ALREADY_DESTROYED');
    }
    if (this.serviceclosed == null) {
      return new lib.Error('SINK_TERMINALIZER_ALREADY_DEAD');
    }
  };

  SinkTerminalizerJobCore.prototype.init = function () {
    var ret;
    this.defer = q.defer();
    ret = this.defer.promise;
    this.serviceDestroyedListener = this.service.destroyed.attach(this.onServiceDestroyed.bind(this));
    this.sinkDestroyedListener = this.sink.destroyed.attach(this.onSinkDestroyed.bind(this));
    this.originalSinkDestructionFunc = this.sink.destroy;
    this.sink.destroy = this.sinkDestructionFunc.bind(this);
    this.notify.fire({initialized:true});
    return ret;
  };

  SinkTerminalizerJobCore.prototype.onServiceDestroyed = function () {
    this.serviceDestroyedListener.destroy();
    this.serviceDestroyedListener = null;
    this.defer.resolve('ok');
  };
  SinkTerminalizerJobCore.prototype.onSinkDestroyed = function () {
    this.sinkDestroyedListener.destroy();
    this.sinkDestroyedListener = null;
  };

  SinkTerminalizerJobCore.prototype.sinkDestructionFunc = function () {
    var err = this.shouldContinue();
    //console.log('sinkDestructionFunc err', err, 'serviceclosed', this.serviceclosed);
    if (err) {
      this.defer.reject(err);
      return;
    }
    if (!this.serviceclosed) {
      this.serviceclosed = true;
      this.service.close();
      return this.defer.promise;
    }
    this.originalSinkDestructionFunc.apply(this.sink, arguments);
    this.sink.destroy = lib.dummyFunc;
    return this.defer.promise;
  };


  SinkTerminalizerJobCore.prototype.steps = [
    'init'
  ];


  mylib.SinkTerminalizer = SinkTerminalizerJobCore;
}
module.exports = createSinkTerminalizerJobCore;