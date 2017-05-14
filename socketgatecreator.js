function createSocketGate(execlib,Gate){
  'use strict';
  var lib = execlib.lib,talkerSpawner = execlib.execSuite.talkerSpawner;
  function SocketGate(service,authenticator){
    Gate.call(this,service,authenticator);
  }
  lib.inherit(SocketGate,Gate);
  SocketGate.prototype.serve = function(queryarry,talker,usersession){
    if(!usersession){
      talker.send(['r', queryarry[0], null]);
      queryarry = null;
      talker = null;
      //talker.send({id:queryarry.id,introduce:null});
      return;
    }
    usersession.handleIncoming(queryarry);
    queryarry = null;
    talker = null;
  };
  function socketErrorReporter(talker,err){
    talker.sendobj({err:err});
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
    this.authenticate(identity,talker).done(
      this.serve.bind(this,queryarry,talker),
      socketErrorReporter.bind(null,talker)
    );
  };
  SocketGate.prototype.handle = function(sock){
    talkerSpawner('socket', sock, this.onDataUnit.bind(this), true);
  };
  SocketGate.prototype.handler = function(){
    return this.handle.bind(this);
  };
  SocketGate.prototype.communicationType = 'socket';
  return SocketGate;
}

module.exports = createSocketGate;
