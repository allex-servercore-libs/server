function createJobCores (execlib, helpers) {
  'use strict';
  var mylib = {},
    mixinslib = require('./mixins') (execlib.lib);

  require('./baseservicemanipulationcreator') (execlib, mylib);
  require('./servicedescriptorcreator') (execlib, mylib);
  require('./serverdescriptorcreator') (execlib, mylib);
  require('./serviceactivatorcreator') (execlib, helpers, mixinslib, mylib);
  require('./servicestartercreator') (execlib, mixinslib, mylib);
  require('./sinkterminalizercreator') (execlib, mylib);
  require('./authsinkacquirercreator') (execlib, mixinslib, mylib);

  return mylib;
}
module.exports = createJobCores;