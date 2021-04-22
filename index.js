function createServer(execlib, signalrlib, SessionIntroductor){
  'use strict';
  var lib = execlib.lib, q = lib.q, Map = lib.Map,
      fs = require('fs'),
      execSuite = execlib.execSuite,
      registry = execSuite.registry,
      Gate = require('./gatecreator')(execlib,SessionIntroductor),
      HttpGate = require('./httpgatecreator')(execlib,signalrlib,Gate),
      SocketGate = require('./socketgatecreator')(execlib,Gate),
      WSGate = require('./wsgatecreator')(execlib,Gate),
      ParentProcGate = require('./parentprocgatecreator')(execlib,Gate),
      InProcGate = require('./inprocgatecreator')(execlib,Gate);
  function makeSuperUserIdentity(){
    return {name:'*',role:'service'};
  }


  var _listeningServers = new Map();

  function killAllListeningServers(){
    _listeningServers.traverse(function(serv){
      serv.close();
    });
  }
    
  function onExit(err){
    //console.log('onExit should kill', _listeningServers.count, 'servers');
    killAllListeningServers();
  }
    
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
  Server.prototype.serveParentProc = function(defer,portdescriptor,authusersink){
    var gate = new ParentProcGate(this.service,authusersink);
    process.on('message',gate.handler());
    SessionIntroductor.introduce(makeSuperUserIdentity(),process.env.parentProcessID);
    process.send({child_init:process.pid});
    defer.resolve(gate);
    defer = null;
    portdescriptor = null;
  };
  Server.prototype._serveParentProc = function(portdescriptor){
    var d = q.defer();
    acquireAuthSink(portdescriptor.strategies).done(
      this.serveParentProc.bind(this,d,portdescriptor),
      d.reject.bind(d)
    );
    return d.promise;
  };
  Server.prototype.serveInProc = function(authenticator){
    var gate = new InProcGate(this.service,authenticator);
    return gate;
  };
  Server.prototype.serveHttp = function(defer,config,authenticator){
    ///TODO: support https ...
    var gate = new HttpGate(this.service,authenticator);
    /* server-unaware implementation
    require(config.protocol.name)
      .createServer(gate.handler(config))
      .listen(config.port);
      */
    gate.startListeningOn(
      require(config.protocol.name).createServer(),
      config
    );
    defer.resolve(gate);
    defer = null;
    config = null;
  };
  Server.prototype._serveHttp = function(portdescriptor){
    var d = q.defer();
    acquireAuthSink(portdescriptor.strategies).done(
      this.serveHttp.bind(this,d,portdescriptor),
      d.reject.bind(d)
    );
    return d.promise;
  };
  Server.prototype.serveSocket = function(defer,options,authusersink){
    var gate = new SocketGate(this.service,authusersink);
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
    var gate = new WSGate(this.service,authusersink,options);
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

  function onSinkDestroyed () {
    //console.log('sink dead');
    this.sinkdestroyedlistener.destroy();
    this.sinkdestroyedlistener = null;
  }

  function onServiceDestroyed () {
    //console.log('service dead');
    this.servicedestroyedlistener.destroy();
    this.servicedestroyedlistener = null;
    this.deathdefer.resolve('ok');
    this.deathdefer = null;
  }

  function terminalizeSink(service,sink) {
    var sss = {
      closesent: false,
      servicedestroyedlistener: null,
      deathdefer: q.defer(),
      sinkdestroyedlistener: null
    },
    ssd = sink.destroy;
    sss.servicedestroyedlistener = service.destroyed.attach(onServiceDestroyed.bind(sss));
    sss.sinkdestroyedlistener = sink.destroyed.attach(onSinkDestroyed.bind(sss));
    function _ssd() {
      var sssp;
      if (!(ssd && sss && sink)) {
        return;
      }
      sssp = sss.deathdefer.promise;
      if(!sss.closesent){
        sss.closesent = true;
        //console.log('sink destroy phase #1: close service', service.modulename);
        service.close();
        service = null;
        return sssp;
      }
      //console.log('sink destroy phase #2: destroy sink', sink.modulename);
      ssd.apply(sink, arguments);
      sink.destroy = lib.dummyFunc;
      ssd = null;
      sss = null;
      sink = null;
      return sssp;
    };
    sink.destroy = _ssd;
  }

  function onSuperSink(defer,service,server,supersink){
    //if (service.modulename !== '.authentication') {
      terminalizeSink(service, supersink);
    //}
    service.onSuperSink(supersink);
    defer.resolve({server:server,supersink:supersink});
    defer = null;
    service = null;
    server = null;
  }
  function servicePropHashProducer(originalprophash) {
    var ret = originalprophash || {};
    ret.__readyToAcceptUsers = q.defer();
    originalprophash = null;
    return ret;
  }
  function onServiceReadyToAcceptUsers (service, authsink, defer) {
    if (!(service && service.destroyed)) {
      defer.reject(new lib.Error('SERVICE_DEAD_ON_DESTRUCTION'));
      service = null;
      authsink = null;
      defer = null;
      return;
    }
    try {
      var server = new Server(service),
        superuseridentity = makeSuperUserIdentity(),
        gate = server.serveInProc(authsink || service.extendTo(new FakeAuthenticatorSink(superuseridentity))),
        user = service.introduceUser(superuseridentity),
        sessionid = SessionIntroductor.introduce(superuseridentity);
      registry.spawn({},gate,{},sessionid).done(
        onSuperSink.bind(null,defer,service,server),
        defer.reject.bind(defer)
      );
    } catch (e) {
      console.error(e);
      defer.reject(e);
    }
    service = null;
    authsink = null;
    defer = null;
  }
  function onServicePackForActivate(servicedescriptor, authsink, defer, service){
    try{
      var prophash = servicePropHashProducer(servicedescriptor.propertyhash),
        service = new service(prophash);
      prophash.__readyToAcceptUsers.promise.done(
        onServiceReadyToAcceptUsers.bind(null, service, authsink, defer),
        defer.reject.bind(defer)
      );
    } catch(e) {
      console.error(e);
      defer.reject(e);
    }
    servicedescriptor = null;
    authsink = null;
    defer = null;
  }
  function activate(servicedescriptor,authsink){
    var d = q.defer();
    try{
      registry.registerServerSide(servicedescriptor.modulename).done(
        onServicePackForActivate.bind(null, servicedescriptor, authsink, d),
        d.reject.bind(d)
      );
    }
    catch(e){
      console.error(e);
      d.reject(e);
    }
    servicedescriptor = null;
    return d.promise;
  };

  function getAuthUserInterface(activationpack){
    /*
    return activationpack.supersink.subConnect('.',{name:'~',role:'user'},{});
    */
    try {
    var d = q.defer();
    activationpack.supersink.subConnect('.',{name:'~',role:'user'},{}).done(function (sink){
      terminalizeSink(activationpack.server.service, sink);
      d.resolve(sink);
    });
    return d.promise;
    } catch(e) {
      console.error(e);
      return q.reject(e);
    }
  }
  function acquireAuthSink(strategies){
    return activate({
      modulename:'.authentication',
      propertyhash:{
        strategies:strategies
      }
    }).then(
      getAuthUserInterface
    );
  }

  Server.start = function(serverdescriptor){
    var ports = serverdescriptor.ports,
        servicedescriptor = serverdescriptor.service,
        modulename = servicedescriptor.modulename,
        instancename = servicedescriptor.instancename,
        prophash = servicedescriptor.propertyhash || {},
        roleremapping = servicedescriptor.roleremapping,
        d = q.defer(),
        instance = registry.superSinks.get(instancename);
    if(!modulename){
      d.reject('No modulename in servicedescriptor');
    }else{
      if (instance) {
        return q(instance);
      }
      acquireAuthSink({
        roleremapper:roleremapping
      }).then(
        activate.bind(null,servicedescriptor),
        function(reason){
          console.error('no supersink for',modulename,'?',reason);
          throw reason;
        }
      ).then(
        registerMasterSink.bind(null,instancename),
        function(reason){
          console.error(process.pid, 'supersink for',instancename,'from',modulename,'could not be registered?',reason);
          throw reason;
        }
      ).then(
        startPorts.bind(null,ports),
        function(reason){
          console.error(process.pid, 'could not start ports',ports,'for',instancename,'from',modulename,'?',reason);
          throw reason;
        }
      ).done(
        d.resolve.bind(d),
        d.reject.bind(d)
      );
    }
    return d.promise;
  };

  function FakeAuthenticatorSink(userhash){
    this.userhash = userhash;
  }
  FakeAuthenticatorSink.prototype.destroy = function(){
    this.userhash = null;
  };
  FakeAuthenticatorSink.prototype.call = function(command,credentials){
    var d = q.defer();
    if(command!=='resolve'){
      d.reject('Wrong command');
    }else{
      d.resolve(this.userhash);
    }
    return d.promise;
  };

  Server.acquireAuthSink = acquireAuthSink;
  return Server;
}
module.exports = createServer;
