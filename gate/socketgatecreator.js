function createSocketGate(execlib,mylib){
  'use strict';
  var lib = execlib.lib,
    talkerSpawner = execlib.execSuite.talkerSpawner,
    Gate = mylib.Gate;

  function SocketGate(service,options,gateoptions,authenticator){
    Gate.call(this,service,options,gateoptions,authenticator);
  }
  lib.inherit(SocketGate,Gate);
  SocketGate.prototype.serve = function(talker,queryarry,usersession){
    if(!usersession){
      talker.send(['r', queryarry[0], null]);
      queryarry = null;
      talker = null;
      //talker.send({id:queryarry.id,introduce:null});
      return;
    }
    try {
      usersession.handleIncoming(queryarry);
    }
    catch (e) {
      socketErrorReporter(talker, e);
    }
    queryarry = null;
    talker = null;
  };
  function socketErrorReporter(talker, queryarry, err){
    talker.send({err:err});
    talker = null;
  }
  SocketGate.prototype.onDataUnit = function(talker,queryarry){
    if (queryarry[0] === '?') {
      talker.processPing(queryarry[1]);
      return;
    }
    var identity = queryarry[1] || {};
    if(talker.socket.remoteAddress && identity[1]){
      identity[1].ip = identity[1].ip || {};
      identity[1].ip.ip = talker.socket.remoteAddress;
    }
    this.authenticateAndServe(
      talker,
      identity,
      queryarry,
      socketErrorReporter
    );
  };
  SocketGate.prototype.handle = function(sock){
    talkerSpawner('socket', sock, this.onDataUnit.bind(this), true);
  };
  SocketGate.prototype.handler = function(){
    return this.handle.bind(this);
  };
  SocketGate.prototype.communicationType = 'socket';

  mylib.SocketGate = SocketGate;
}

module.exports = createSocketGate;
