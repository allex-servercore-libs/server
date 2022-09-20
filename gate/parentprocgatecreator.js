function createParentProcGate(execlib,mylib){
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    Gate = mylib.Gate;

  function ParentProcGate(service,options,gateoptions,authenticator){
    Gate.call(this,service,options,gateoptions,authenticator);
  }
  lib.inherit(ParentProcGate,Gate);

  function procErrorReporter(requester, queryarry, err){
    console.log('procErrorReporter',err);
    if(process.connected){
      process.send({err:err});
    }
  }
  ParentProcGate.prototype.serve = function(requester, queryarry,usersession){
    if(usersession && process.connected){
      try {
        usersession.handleIncoming(queryarry);
      }
      catch (e) {
        procErrorReporter(e);
      }
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
    this.authenticateAndServe(
      null,
      queryarry[1],
      queryarry,
      procErrorReporter
    );
  };
  ParentProcGate.prototype.handler = function(){
    return this.handle.bind(this);
  };
  ParentProcGate.prototype.communicationType = 'parent_process';
  
  mylib.ParentProcGate = ParentProcGate;
}

module.exports = createParentProcGate;
