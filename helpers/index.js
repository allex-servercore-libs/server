function createHelpers (execlib) {
  'use strict';

  var mylib = {};

  function makeSuperUserIdentity(){
    return {name:'*',role:'service'};
  }
  mylib.makeSuperUserIdentity = makeSuperUserIdentity;

  return mylib;
}
module.exports = createHelpers;