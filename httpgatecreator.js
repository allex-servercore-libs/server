var Url = require('url'),
    Path = require('path')/*,
    node_static = require('node-static')*/;


function createHttpGate(execlib,signalrlib,Gate){
  'use strict';
  var lib = execlib.lib;

  function HttpGate(service,authenticator){
    Gate.call(this,service,authenticator);
    this.signalRHandler = new signalrlib.ServerHandler(this.onInvocationNeeded.bind(this));
  }
  lib.inherit(HttpGate,Gate);
  HttpGate.prototype.destroy = function () {
    if (this.signalRHandler) {
      this.signalRHandler.destroy();
    }
    this.signalRHandler = null;
    Gate.prototype.destroy.call(this);
  };
  HttpGate.prototype.onInvocationNeeded = function (channel, target, args) {
    if (target === 'allexjs') {
      this.handle(channel, args);
    }
  };
  function httpErrorReporter(channel,queryobj,err){
    console.log('httpErrorReporter',queryobj);
    channel.invokeOnClient('_', {id:queryobj.id,err:err});
    res.end();
    res = null;
    queryobj = null;
  }
  HttpGate.prototype.handle = function(channel, queryobj){
    var identity = queryobj[1] || {};
    if(channel.remoteAddress && identity[1]){
      identity[1].ip = identity[1].ip || {};
      identity[1].ip.ip = channel.remoteAddress; //TODO: find remoteAddress
    }
    this.authenticate(identity,channel).done(
      this.serve.bind(this,channel,queryobj),
      httpErrorReporter.bind(null,channel,queryobj)
    );
  };
  HttpGate.prototype.serve = function(channel, queryarry, usersession){
    if(!usersession){
      //console.log('no usersession, this is unacceptable for',require('util').inspect(queryarry,{depth:null}));
      channel.invokeOnClient('_', this.defaultResponseObject(queryarry));
      channel = null;
      queryarry = null;
      return;
    }
    try {
      usersession.handleIncoming(queryarry)
    }
    catch (e) {
      console.log('error in HttpGate', e);
      //wsErrorReporter(wswrapper, e);
      channel.invokeOnClient('_', this.defaultResponseObject(queryarry));
    }
    channel = null;
    queryarry = null;
  };
  HttpGate.prototype.handler = function(options){
    options = options||{};
    return this.handle.bind(this/*,
      new (node_static.Server)(options.root||Path.join(process.cwd(),'www'))*/
    );
  };
  HttpGate.prototype.startListeningOn = function (server, options){
    this.signalRHandler.startHandling(server);
    server.listen(options.port); 
    console.log('server listening on', options.port);
  };

  HttpGate.prototype.communicationType = 'http';
  return HttpGate;
}

module.exports = createHttpGate;
