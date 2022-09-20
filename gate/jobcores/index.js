function createGateJobCores (execlib) {
  'use strict';

  var mylib = {}, lib = execlib.lib;

  require('./ongatecreator')(lib, mylib);
  require('./createsessioncreator')(lib, mylib);
  require('./authenticatecreator')(lib, mylib);
  require('./kickoutsessioncreator')(lib, mylib);
  require('./createloggerscreator')(execlib, mylib);

  return mylib;
}
module.exports = createGateJobCores;