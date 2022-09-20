function createGateLib (execlib, SessionIntroductor, signalrlib) {
  'use strict';

  var mylib = {};
  require('./gatecreator')(execlib,SessionIntroductor, mylib);
  require('./httpgatecreator')(execlib,signalrlib,mylib);
  require('./socketgatecreator')(execlib,mylib);
  require('./wsgatecreator')(execlib,mylib);
  require('./parentprocgatecreator')(execlib,mylib);
  require('./inprocgatecreator')(execlib,mylib);

  return mylib;
}
module.exports = createGateLib;