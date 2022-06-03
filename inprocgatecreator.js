function createInProcGate(execlib,Gate){
  'use strict';
  var lib = execlib.lib, q = lib.q, defaultErrorProc = console.error.bind(console, 'InProcGate processMessage error');
  function InProcGate(service,options,authenticator){
    Gate.call(this,service,options,authenticator);
  }
  lib.inherit(InProcGate,Gate);

  InProcGate.prototype.processMessage = function(queryarry,requester){
    this.authenticate(queryarry[1],requester).done(
      this.serveInProc.bind(this,queryarry),
      //defaultErrorProc
    );
  };
  InProcGate.prototype.serveInProc = function(queryarry,usersession){
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
  return InProcGate;
}

module.exports = createInProcGate;
