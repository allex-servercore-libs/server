function createGateJobs (lib) {
  'use strict';

  var ret = {};
  require('./ongatecreator')(lib, ret);
  require('./authenticatecreator')(lib, ret);
  require('./kickoutsessioncreator')(lib, ret);

  return ret;
}
module.exports = createGateJobs;
