function createJobCoresMixins (lib) {
  'use strict';

  var mylib = {};

  require('./serviceactivatorcreator')(lib, mylib);

  return mylib;
}
module.exports = createJobCoresMixins;