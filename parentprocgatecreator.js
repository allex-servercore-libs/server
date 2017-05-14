function createParentProcGate(execlib,Gate){
  'use strict';
  var lib = execlib.lib, q = lib.q;
  function ParentProcGate(service,authenticator){
    Gate.call(this,service,authenticator);
  }
  lib.inherit(ParentProcGate,Gate);
  function procErrorReporter(err){
    console.log('procErrorReporter',err);
    if(process.connected){
      process.send({err:err});
    }
  }
  ParentProcGate.prototype.serve = function(queryarry,usersession){
    if(usersession && process.connected){
      usersession.handleIncoming(queryarry);
    }else{
      console.log('no can do for',require('util').inspect(queryarry,{depth:null}),usersession);
    }
    queryarry = null;
  };
  ParentProcGate.prototype.handle = function(queryarry){
    if(!queryarry){
      procErrorReporter('No query object');
      return;
    }
    this.authenticate(queryarry[1]).done(
      this.serve.bind(this,queryarry),
      procErrorReporter
    );
  };
  ParentProcGate.prototype.handler = function(){
    return this.handle.bind(this);
  };
  ParentProcGate.prototype.communicationType = 'parent_process';
  return ParentProcGate;
}

module.exports = createParentProcGate;
