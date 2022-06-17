function createBaseServiceManipulationJobCore (execlib, mylib) {
  'use strict';

  var lib = execlib.lib;

  function BaseServiceManipulationJobCore (listeningservers) {
    this.uid = lib.uid();
    this.listeningservers = listeningservers;
  }
  BaseServiceManipulationJobCore.prototype.destroy = function () {
    if (this.listeningservers) {
      this.listeningservers.remove(this.uid);
    }
    this.listeningservers = null;
    this.uid = null;
  };
  BaseServiceManipulationJobCore.prototype.shouldContinue = function () {
    if (!(this.listeningservers instanceof lib.Map)) {
      return new lib.Error('SERVICE_STARTER_DESTROYED');
    }
  };
  BaseServiceManipulationJobCore.prototype.close = function () { //listeningervers will call me here in case of death
    this.listeningservers = null;
  };


  BaseServiceManipulationJobCore.prototype.init = function () {
    this.listeningservers.add(this.uid, this);
  };

  mylib.BaseServiceManipulation = BaseServiceManipulationJobCore;
}
module.exports = createBaseServiceManipulationJobCore;