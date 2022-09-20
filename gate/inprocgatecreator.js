function createInProcGate(execlib,mylib){
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    defaultErrorProc = console.error.bind(console, 'InProcGate processMessage error'),
    Gate = mylib.Gate;

  function InProcGate(service,options,gateoptions,authenticator){
    Gate.call(this,service,options,gateoptions,authenticator);
  }
  lib.inherit(InProcGate,Gate);

  function defaultErrorProc (requester, queryobj, err) {

  }
  InProcGate.prototype.processMessage = function(queryarry,requester){
    this.authenticateAndServe(
      requester,
      queryarry[1],
      queryarry,
      defaultErrorProc
    );
  };
  InProcGate.prototype.serve = function(requester, queryarry,usersession){
    if(!usersession){
      //console.trace();
      console.error(process.pid,'no usersession for',require('util').inspect(queryarry, {depth:6}),'?');
      queryarry = null;
      return;
    }
    try {
      usersession.handleIncoming(queryarry);
    }
    catch (e) {
      //ignore e
    }
    queryarry = null;
  };
  InProcGate.prototype.communicationType = 'inproc';
  
  mylib.InProcGate = InProcGate;
}

module.exports = createInProcGate;
