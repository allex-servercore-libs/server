function createServer(execlib, signalrlib, SessionIntroductor){
  'use strict';
  var lib = execlib.lib, q = lib.q, Map = lib.Map,
      qlib = lib.qlib,
      fs = require('fs'),
      execSuite = execlib.execSuite,
      registry = execSuite.registry,
      gatelib = require('./gate')(execlib, SessionIntroductor, signalrlib),
      helpers = require('./helpers')(execlib),
      jobcores = require('./jobcores')(execlib, helpers);

  lib.shouldClose.attachForSingleShot(onExit);

  var _listeningServers = new Map();

  function killAllListeningServers(){
    _listeningServers.traverseSafe(function(serv){
      serv.close();
    }, 'Error in Server closing sequence');
  }
    
  function onExit(err){
    //console.log('onExit should kill', _listeningServers.count, 'servers');
    try {
      killAllListeningServers();
    } catch(e) {
      console.error('Error in killAllListeningServers', e);
    }
  }
    
  function onConnectError(serv,port,err){
    if(err.code==='ECONNREFUSED'){
      fs.unlink(port,startServer.bind(null,serv,port));
    }
    serv = null;
  }
    
  function onConnectSuccess(serv,port){
  }
    
  function onServError(serv,port,err){
    _listeningServers.remove(port+'');
    if(err.code==='EADDRINUSE'){
      var c = new require('net').Socket();
      c.on('error',onConnectError.bind(null,serv,port));
      c.connect({path:port},onConnectSuccess.bind(null,serv,port));
    }
  }
    
  function startServer(serv,port){
    if (_listeningServers.get(port)) {
      serv.close();
      serv = null;
      return;
    }
    serv.on('error',onServError.bind(null,serv,port));
    _listeningServers.add(port+'',serv);
    serv.listen(port);
    serv = null;
  }

  function Server(service){
    Map.call(this);
    this.service = service;
  }
  lib.inherit(Server,Map);
  Server.prototype.destroy = function(){
    this.service = null;
    Map.prototype.destroy.call(this);
  };
  //static, this is Server
  function preServeProc (postserveprocname, portdescriptor, options) {
    var ret = acquireAuthSink(portdescriptor.strategies).then(
      this[postserveprocname].bind(this,portdescriptor, options),
      console.error.bind(console, 'acquireAuthSink failed')
    );
    portdescriptor = null;
    options = null;
    return ret;
  }
  Server.prototype.serveInProc = function(options, gateoptions, authusersink){
    var gate = new gatelib.InProcGate(this.service,options,gateoptions,authusersink);
    return gate;
  };
  Server.prototype.serveParentProc = function(options,gateoptions,authusersink){
    var gate = new gatelib.ParentProcGate(this.service,options,gateoptions,authusersink);
    process.on('message',gate.handler());
    SessionIntroductor.introduce(helpers.makeSuperUserIdentity(),process.env.parentProcessID);
    process.send({child_init:process.pid});
    options = null;
    return gate;
  };
  Server.prototype.serveSocket = function(options,gateoptions,authusersink){
    var gate = new gatelib.SocketGate(this.service,options,gateoptions,authusersink);
    startServer(require('net')
      .createServer(gate.handler()),
      options.port);
    options = null;
    return gate;
  };
  Server.prototype.serveWS = function(options,gateoptions,authusersink){
    var gate = new gatelib.WSGate(this.service,options,gateoptions,authusersink,options);
    _listeningServers.add(options.port+'', gate);
    return gate;
  };
  Server.prototype.serveHttp = function(config,gateoptions,authenticator){
    ///TODO: support https ...
    var gate = new gatelib.HttpGate(this.service,config,gateoptions,authenticator);
    /* server-unaware implementation
    require(config.protocol.name)
      .createServer(gate.handler(config))
      .listen(config.port);
      */
    gate.startListeningOn(
      require(config.protocol.name).createServer(),
      config
    );
    _listeningServers.add(gate.listeningPort()+'', gate); //so that gate can be .close()d eventually
    config = null;
    return gate;
  };
  Server.prototype.startPort = function(gateoptions, port){
    if(!(port.protocol&&port.protocol.name)){
      console.error('port descriptor',port,'has no protocol.name');
      return q.reject(new lib.Error('NO_PROTOCOL_NAME', port.protocol));
    }
    gateoptions = gateoptions || {};
    //console.log('should start port',port);
    switch(port.protocol.name){
      case 'parent_proc':
        return preServeProc.call(this, 'serveParentProc', port, gateoptions.parent_proc);
      case 'socket':
        return preServeProc.call(this, 'serveSocket', port, gateoptions.socket);
      case 'ws':
        return preServeProc.call(this, 'serveWS', port, gateoptions.ws);
      case 'http':
        return preServeProc.call(this, 'serveHttp', port, gateoptions.http);
      default:
        //console.trace();
        console.error('protocol',port.protocol.name,'of',port,'is not supported');
        return q.reject(new lib.Error('PROTOCOL_NOT_SUPPORTED', port.protocol.name));
    }
  };
  Server.prototype.startPorts = function(ports, gateoptions){
    var ret;
    if(!(ports&&lib.isArray(ports))){
      this.destroy();
      ports = null;
      return q(null);
    }
    ret = q.allSettled(ports.map(this.startPort.bind(this, gateoptions))).then(
      this.onPortsStarted.bind(this),
      this.onStartPortsFailed.bind(this)
    );
    gateoptions = null;
    ports = null;
    return ret;
  };
  Server.prototype.onPortsStarted = function (result) {
    this.destroy();
    return q(result);
  };
  Server.prototype.onStartPortsFailed = function (reason) {
    this.destroy();
    return q.reject(reason);
  };

  /*
  function registerMasterSink(instancename,activationpack){
    var d = q.defer();
    if(!instancename){
      d.resolve(activationpack);
    }else{
      try{
        registry.registerSuperSink(instancename,activationpack.supersink);
        d.resolve(activationpack);
      }
      catch(e){
        console.error(e);
        d.reject('Supersink for service named '+instancename+' could not be registered');
      }
    }
    return d.promise;
  }
  function startPorts(ports,activationpack){
    var d = q.defer();
    if(activationpack){
      activationpack.server.startPorts(ports).done(
        portsStarted.bind(null, activationpack, d),
        startPortsFailed.bind(null, activationpack, d)
      );
    }else{
      d.reject("ServicePack activation failed");
    }
    return d.promise;
  }
  function portsStarted(activationpack, defer, result) {
    var ss = activationpack.supersink;
    activationpack.server = null;
    activationpack.supersink = null;
    defer.resolve(ss);
    activationpack = null;
    defer = null;
  }
  function startPortsFailed(activationpack, defer, reason) {
    activationpack.server = null;
    activationpack.supersink = null;
    defer.reject(reason);
    activationpack = null;
    defer = null;
  }
  */


  function acquireAuthSink(strategies){
    return qlib.newSteppedJobOnSteppedInstance(
      new jobcores.AuthSinkAcquirer(
        _listeningServers,
        registry,
        SessionIntroductor,
        Server,
        strategies
      )
    ).go();
  }

  Server.start = function (serverdescriptor) {
    var ret = qlib.newSteppedJobOnSteppedInstance(
      new jobcores.ServiceStarter(_listeningServers, serverdescriptor, registry, SessionIntroductor, Server)
    ).go();
    return ret.then(null, function (reason) {console.error('error in start', reason); throw reason;});
  }

  Server.acquireAuthSink = acquireAuthSink;
  return Server;
}
module.exports = createServer;
