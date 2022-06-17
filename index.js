function createServer(execlib, signalrlib, SessionIntroductor){
  'use strict';
  var lib = execlib.lib, q = lib.q, Map = lib.Map,
      qlib = lib.qlib,
      fs = require('fs'),
      execSuite = execlib.execSuite,
      registry = execSuite.registry,
      Gate = require('./gatecreator')(execlib,SessionIntroductor),
      HttpGate = require('./httpgatecreator')(execlib,signalrlib,Gate),
      SocketGate = require('./socketgatecreator')(execlib,Gate),
      WSGate = require('./wsgatecreator')(execlib,Gate),
      ParentProcGate = require('./parentprocgatecreator')(execlib,Gate),
      InProcGate = require('./inprocgatecreator')(execlib,Gate),
      helpers = require('./helpers')(execlib),
      jobcores = require('./jobcores')(execlib, helpers);


  var _listeningServers = new Map();

  function killAllListeningServers(){
    _listeningServers.traverse(function(serv){
      if (!lib.isFunction(serv.close)) {
        console.log('Y no close?', serv);
        return;
      }
      try {
        serv.close();
      } catch (e) {
        console.error('Error', e, 'while trying to close');
      }
    });
  }
    
  function onExit(err){
    //console.log('onExit should kill', _listeningServers.count, 'servers');
    try {
      killAllListeningServers();
    } catch(e) {
      console.error('Error in killAllListeningServers', e);
    }
  }
    
  process.on('SIGINT',onExit);
  process.on('SIGTERM',onExit);
  process.on('exit',onExit);
    
  function onConnectError(serv,port,err){
    if(err.code==='ECONNREFUSED'){
      fs.unlink(port,startServer.bind(null,serv,port));
    }
    serv = null;
  }
    
  function onConnectSuccess(serv,port){
  }
    
  function onServError(serv,port,err){
    _listeningServers.remove(port);
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
    _listeningServers.add(port,serv);
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
  Server.prototype.serveParentProc = function(portdescriptor,authusersink){
    var gate = new ParentProcGate(this.service,portdescriptor,authusersink);
    process.on('message',gate.handler());
    SessionIntroductor.introduce(helpers.makeSuperUserIdentity(),process.env.parentProcessID);
    process.send({child_init:process.pid});
    portdescriptor = null;
    return gate;
  };
  Server.prototype._serveParentProc = function(portdescriptor){
    var ret = acquireAuthSink(portdescriptor.strategies).then(
      this.serveParentProc.bind(this,portdescriptor)
    );
    portdescriptor = null;
    return ret;
  };
  Server.prototype.serveInProc = function(authenticator){
    var gate = new InProcGate(this.service,null,authenticator);
    return gate;
  };
  Server.prototype.serveHttp = function(defer,config,authenticator){
    ///TODO: support https ...
    var gate = new HttpGate(this.service,config,authenticator);
    /* server-unaware implementation
    require(config.protocol.name)
      .createServer(gate.handler(config))
      .listen(config.port);
      */
    gate.startListeningOn(
      require(config.protocol.name).createServer(),
      config
    );
    _listeningServers.add(gate.listeningPort(), gate); //so that gate can be .close()d eventually
    defer.resolve(gate);
    defer = null;
    config = null;
  };
  Server.prototype._serveHttp = function(portdescriptor){
    var d = q.defer(), ret = d.promise;
    acquireAuthSink(portdescriptor.strategies).done(
      this.serveHttp.bind(this,d,portdescriptor),
      d.reject.bind(d)
    );
    d = null;
    portdescriptor = null;
    return ret;
  };
  Server.prototype.serveSocket = function(defer,options,authusersink){
    var gate = new SocketGate(this.service,options,authusersink);
    startServer(require('net')
      .createServer(gate.handler()),
      options.port);
    defer.resolve(gate);
    defer = null;
    options = null;
  };
  Server.prototype._serveSocket = function(portdescriptor){
    var d = q.defer();
    acquireAuthSink(portdescriptor.strategies).done(
      this.serveSocket.bind(this,d,portdescriptor),
      d.reject.bind(d)
    );
    portdescriptor = null;
    return d.promise;
  };
  Server.prototype.serveWS = function(defer,options,authusersink){
    var gate = new WSGate(this.service,options,authusersink,options);
    _listeningServers.add(options.port, gate);
    defer.resolve(gate);
    defer = null;
    options = null;
  };
  Server.prototype._serveWS = function(portdescriptor){
    var d = q.defer();
    acquireAuthSink(portdescriptor.strategies).done(
      this.serveWS.bind(this,d,portdescriptor),
      d.reject.bind(d)
    );
    return d.promise;
  };
  Server.prototype.startPort = function(port){
    if(!(port.protocol&&port.protocol.name)){
      console.error('port descriptor',port,'has no protocol.name');
      return q.reject(new lib.Error('NO_PROTOCOL_NAME', port.protocol));
    }
    //console.log('should start port',port);
    switch(port.protocol.name){
      case 'parent_proc':
        return this._serveParentProc(port);
        break;
      case 'socket':
        return this._serveSocket(port);
        break;
      case 'ws':
        return this._serveWS(port);
        break;
      case 'http':
      case 'https':
        return this._serveHttp(port);
        break;
      default:
        //console.trace();
        console.error('protocol',port.protocol.name,'of',port,'is not supported');
        return q.reject(new lib.Error('PROTOCOL_NOT_SUPPORTED', port.protocol.name));
    }
  };
  Server.prototype.startPorts = function(ports){
    var ret;
    if(!(ports&&lib.isArray(ports))){
      this.destroy();
      ports = null;
      return q(null);
    }
    ret = q.allSettled(ports.map(this.startPort.bind(this))).then(
      this.onPortsStarted.bind(this),
      this.onStartPortsFailed.bind(this)
    );
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
