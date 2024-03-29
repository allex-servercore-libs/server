function createWSGate(execlib,mylib){
  'use strict';
  var lib = execlib.lib,
    StringBuffer = lib.StringBuffer,
    WebSocket = lib.ws,
    Gate = mylib.Gate,
    PING_PERIOD = 10*lib.intervals.Second;

  //var _wswid=0;

  function WSWrapper(ws){
    //this._id = (++_wswid);
    //console.log('New WSWrapper', this._id, ws._socket.remoteAddress);
    lib.Destroyable.call(this);
    this.ws = ws;
    this.closer = this.onClose.bind(this);
    this.closeConsiderer = this.considerClose.bind(this);
    this.onSendBound = this.onSend.bind(this);
    this.sendRawBound = this.sendRaw.bind(this);
    this.pingWaiter = null;
    this.buffer = new StringBuffer();
    this.sending = false;
    this.lastReceivedMoment = lib.now();
    this.lastCheckedMoment = null;
    this.ws.on('close', this.closer);
    this.processPing();
  }
  lib.inherit(WSWrapper, lib.Destroyable);
  WSWrapper.prototype.__cleanUp = function () {
    //console.trace();
    //console.log('WSWrapper about to die', this.localPort());
    //console.log('WSWrapper', this._id, 'dying');
    if(!this.ws){
      return;
    }
    this.lastCheckedMoment = null;
    this.lastReceivedMoment = null;
    this.sending = null;
    if (this.buffer) {
      this.buffer.destroy();
    }
    this.buffer = null;
    this.ws.removeListener('close', this.closer);
    this.ws.removeAllListeners();
    this.sendRawBound = null;
    this.onSendBound = null;
    this.closeConsiderer = null;
    this.closer = null;
    if (this.pingWaiter) {
      lib.clearTimeout(this.pingWaiter);
    }
    this.pingWaiter = null;
    this.ws = null;
    this.sending = false;
  };
  WSWrapper.prototype.processPing = function (ping) {
    this.doWaiter();
    if (ping) {
      this.send(['!', ping]);
    }
  };
  WSWrapper.prototype.doWaiter = function () {
    if (!this.ws) {
      return;
    }
    if (this.pingWaiter) {
      lib.clearTimeout(this.pingWaiter);
    }
    this.pingWaiter = lib.runNext(this.closeConsiderer, PING_PERIOD*2);
  };
  WSWrapper.prototype.onClose = function () {
    //console.log(this.constructor.name, this._id, 'finally closed');
    this.destroy();
  };
  WSWrapper.prototype.considerClose = function () {
    var crit;
    console.log('ping miss!', (this.ws && this.ws._socket) ? (this.ws._socket.remoteAddress+':'+this.ws._socket.remotePort) : '');
    if (!lib.isNumber(this.lastReceivedMoment)) {
      console.log('lastReceivedMoment NaN, forget it');
      return;
    }
    crit = lib.now() - this.lastReceivedMoment;
    if (crit > PING_PERIOD*2) {
      console.log(crit, '>', PING_PERIOD*2, 'will close');
      this.close();
      return;
    }
    if (!lib.isNumber(this.lastCheckedMoment)) {
      console.log('but the last message was received', crit, 'ms ago, so all is well');
      console.log('establishing lastCheckedMoment and waiting again');
      this.lastCheckedMoment = this.lastReceivedMoment;
      this.doWaiter();
      return;
    }
    if (this.lastCheckedMoment === this.lastReceivedMoment) {
      console.log('lastCheckedMoment===lastReceivedMoment, that was', lib.now()-this.lastCheckedMoment, 'ago, will close');
      this.close();
      return;
    }
    console.log('but the last message was received', crit, 'ms ago, so all is well');
    this.lastCheckedMoment = this.lastReceivedMoment;
    this.doWaiter();
  };
  WSWrapper.prototype.close = function () {
    //console.trace();
    //console.log('WSWrapper', this._id, 'closing');
    if (this.ws) {
      try {
        this.ws.close();
      } catch(e) {
        this.destroy();
      }
    }
  };
  WSWrapper.prototype.terminate = function () {
    if (this.ws) {
      try {
      this.ws.terminate();
      } catch(e) {
      }
    }
    this.destroy();
  };
  var _zeroString = String.fromCharCode(0);
  WSWrapper.prototype.send = function (data) {
    if (this.sending === null) {
      return;
    }
    if (!this.buffer) {
      return;
    }
    var jd = JSON.stringify(data);
    this.buffer.add(jd);
    if (this.sending === false) {
      this.sendBuffer();
    }
  };
  WSWrapper.prototype.sendRaw = function (raw) {
    if (!this.ws) {
      /*
      console.trace();
      console.log('someone called me to send',data,'but me ded',this.__postMortem);
      */
      return;
    }
    //console.log(this.localPort(), 'sending', data);
    if(this.ws.readyState>1){
      this.destroy();
      return;
    }
    if(this.ws.readyState<1){
      console.log('WSock still CONNECTING?!');
      process.exit(0);
    }
    if (!raw) {
      console.trace();
      console.error('Y NO DATA?');
      return;
    }
    this.sending = true;
    this.ws.send(raw, this.onSendBound);
  };
  WSWrapper.prototype.sendBuffer = function () {
    if (this.buffer.hasContents()) {
      this.buffer.get(this.sendRawBound);
    }
  };
  WSWrapper.prototype.onSend = function (error) {
    this.sending = false;
    if (this.buffer) {
      this.sendBuffer();
    }
  };
  WSWrapper.prototype.localPort = function () { //for debugging only
    return this.ws ? this.ws._socket._peername.port : 0;
  };

  function WSGate(service,options,gateoptions,authenticator,wsportdescriptor){
    Gate.call(this,service,options,gateoptions,authenticator);
    this.server = new WebSocket.Server(lib.extend({port:wsportdescriptor.port}, this.options ? this.options.server : {}));
    this.onConnectionBound = this.onConnection.bind(this);
    this.server.on('connection',this.onConnectionBound);
  }
  lib.inherit(WSGate,Gate);
  WSGate.prototype.destroy = function(){
    if(this.server){
      if (this.onConnectionBound) {
        this.server.off('connection', this.onConnectionBound);
      }
      this.server.close(console.log.bind(console, 'WSGate server closed'));
      return;
    }
    this.onConnectionBound = null;
    this.server = null;
    Gate.prototype.destroy.call(this);
  };
  WSGate.prototype.close = function () {
    this.destroy();
  };
  WSGate.prototype.serve = function(wswrapper,queryarry,usersession){
    if(!usersession){
      //console.log('no usersession, this is unacceptable for',require('util').inspect(queryarry,{depth:null}));
      wswrapper.send(this.defaultResponseObject(queryarry));
      wswrapper = null;
      queryarry = null;
      return;
    }
    try {
      usersession.handleIncoming(queryarry)
    }
    catch (e) {
      //wsErrorReporter(wswrapper, e);
      wswrapper.send(this.defaultResponseObject(queryarry));
    }
    wswrapper = null;
    queryarry = null;
  };
  WSGate.prototype.onConnection = function(wsock){
    wsock.on('message',this.onMessage.bind(this,new WSWrapper(wsock)));
  };
  function wsErrorReporter(wswrapper,queryarry,err){
    //console.log('wsErrorReporter', err);
    wswrapper.send({err:err});
    wswrapper = null;
    //wsock.send(JSON.stringify({err:err}));
  }
  WSGate.prototype.onMessage = function(wswrapper,message,flags){
    if (!(wswrapper && wswrapper.ws)) {
      return;
    }
    StringBuffer.consumeString(message, this.onMessageUnit.bind(this, wswrapper, flags));
  };
  WSGate.prototype.onMessageUnit = function (wswrapper,flags,queryarry){
    try{
      queryarry = JSON.parse(queryarry);
    }
    catch(e){
      console.error('JSON.parse error', e, 'on', queryarry);
      //wsErrorReporter(wswrapper,e);
      this.defaultResponseObject(queryarry);
      return;
    }
    if (!wswrapper.ws) {
      return;
    }
    wswrapper.lastReceivedMoment = lib.now();
    if (queryarry[0] === '?') {
      wswrapper.processPing(queryarry[1]);
      return;
    }
    var identity = queryarry[1] || {};
    if(wswrapper.ws._socket.remoteAddress && identity[1]){
      identity[1].ip = identity[1].ip || {};
      identity[1].ip.ip = wswrapper.ws._socket.remoteAddress; //TODO: find remoteAddress
    }
    this.authenticateAndServe(
      wswrapper,
      identity,
      queryarry,
      wsErrorReporter
    );
  };
  WSGate.prototype.communicationType = 'ws';

  mylib.WSGate = WSGate;
}

module.exports = createWSGate;
