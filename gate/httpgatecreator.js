var Url = require('url'),
    Path = require('path')/*,
    node_static = require('node-static')*/;

function createHttpGate(execlib,signalrlib,mylib){
  'use strict';
  var lib = execlib.lib,
    Gate = mylib.Gate;

  function HttpGate(service,options,gateoptions,authenticator){
    Gate.call(this,service,options,gateoptions,authenticator);
    this.signalRHandler = new signalrlib.ServerHandler(this.options ? this.options.options : null, this.onInvocationNeeded.bind(this));
    this._listeningPort = null;
  }
  lib.inherit(HttpGate,Gate);
  HttpGate.prototype.destroy = function () {
    this._listeningPort = null;
    if (this.signalRHandler) {
      this.signalRHandler.close();
      this.signalRHandler.destroy();
    }
    this.signalRHandler = null;
    Gate.prototype.destroy.call(this);
  };
  HttpGate.prototype.close = function () {
    if (this.signalRHandler) {
      this.signalRHandler.clearAll();
    }
    this.signalRHandler = null;
    this.destroy();
  };
  HttpGate.prototype.onInvocationNeeded = function (channel, target, args) {
    if (target === 'allexjs') {
      this.handle(channel, args);
    }
  };
  function httpErrorReporter(channel,queryobj,err){
    //console.log('httpErrorReporter',queryobj);
    channel.invokeOnClient('_', {id:queryobj.id,err:err});
    /*
    res.end();
    res = null;
    */
    queryobj = null;
  }
  HttpGate.prototype.handle = function(channel, queryarry){
    var identity = queryarry[1] || {};
    if(channel.remoteAddress && identity[1]){
      identity[1].ip = identity[1].ip || {};
      identity[1].ip.ip = channel.remoteAddress; //TODO: find remoteAddress
    }
    this.authenticateAndServe(
      channel,
      identity,
      queryarry,
      httpErrorReporter
    );
  };
  HttpGate.prototype.serve = function(channel, queryarry, usersession){
    if(!usersession){
      //console.log('no usersession, this is unacceptable for',require('util').inspect(queryarry,{depth:null}));
      channel.invokeOnClient('_', this.defaultResponseObject(queryarry));
      return;
    }
    try {
      usersession.handleIncoming(queryarry)
    }
    catch (e) {
      //console.log('error in HttpGate', e);
      //wsErrorReporter(wswrapper, e);
      channel.invokeOnClient('_', this.defaultResponseObject(queryarry));
    }
  };
  HttpGate.prototype.handler = function(options){
    options = options||{};
    return this.handle.bind(this/*,
      new (node_static.Server)(options.root||Path.join(process.cwd(),'www'))*/
    );
  };
  HttpGate.prototype.startListeningOn = function (server, options){
    this.signalRHandler.startHandling(server);
    this._listeningPort = options.port;
    server.listen(options.port); 
    console.log('server listening on', options.port);
  };
  HttpGate.prototype.listeningPort = function () {
    return this._listeningPort;
  };

  HttpGate.prototype.communicationType = 'http';
  
  mylib.HttpGate = HttpGate;
}

module.exports = createHttpGate;
