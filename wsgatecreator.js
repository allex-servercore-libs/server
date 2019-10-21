function createWSGate(execlib,Gate){
  'use strict';
  var lib = execlib.lib,
    StringBuffer = lib.StringBuffer,
    WebSocket = lib.ws,
    PING_PERIOD = 10*lib.intervals.Second;

  function WSWrapper(ws){
    //console.log('New WebSocket connection',wsock._socket.remoteAddress);
    lib.Destroyable.call(this);
    this.ws = ws;
    this.mydestroyer = this.destroy.bind(this);
    this.closeConsiderer = this.considerClose.bind(this);
    this.onSendBound = this.onSend.bind(this);
    this.sendRawBound = this.sendRaw.bind(this);
    this.pingWaiter = null;
    this.buffer = new StringBuffer();
    this.sending = false;
    this.lastReceivedMoment = Date.now();
    this.lastCheckedMoment = null;
    this.ws.on('close', this.mydestroyer);
    this.processPing();
  }
  lib.inherit(WSWrapper, lib.Destroyable);
  WSWrapper.prototype.__cleanUp = function () {
    //console.trace();
    //console.log('WSWrapper about to die', this.localPort());
    //console.log('New WebSocket connection',wsock._socket.remoteAddress);
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
    this.ws.removeListener('close', this.mydestroyer);
    this.ws.removeAllListeners();
    this.sendRawBound = null;
    this.onSendBound = null;
    this.closeConsiderer = null;
    this.mydestroyer = null;
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
  WSWrapper.prototype.considerClose = function () {
    console.log('ping miss!');
    if (!lib.isNumber(this.lastReceivedMoment)) {
      console.log('lastReceivedMoment NaN, forget it');
      return;
    }
    if (Date.now() - this.lastReceivedMoment > PING_PERIOD*2) {
      console.log(Date.now() - this.lastReceivedMoment, '>', PING_PERIOD*2, 'will close');
      this.close();
      return;
    }
    if (!lib.isNumber(this.lastCheckedMoment)) {
      console.log('establishing lastCheckedMoment and waiting again, forget it');
      this.lastCheckedMoment = this.lastReceivedMoment;
      this.doWaiter();
      return;
    }
    if (this.lastCheckedMoment === this.lastReceivedMoment) {
      console.log('lastCheckedMoment===lastReceivedMoment, that was', Date.now()-this.lastCheckedMoment, 'ago, will close');
      this.close();
      return;
    }
    console.log('setting lastCheckedMoment and waiting again, forget it');
    this.lastCheckedMoment = this.lastReceivedMoment;
    this.doWaiter();
  };
  WSWrapper.prototype.close = function () {
    console.trace();
    console.log('WSWrapper closing');
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

  function WSGate(service,authenticator,wsportdescriptor){
    Gate.call(this,service,authenticator);
    this.server = new WebSocket.Server({port:wsportdescriptor.port});
    this.server.on('connection',this.onConnection.bind(this));
  }
  lib.inherit(WSGate,Gate);
  WSGate.prototype.destroy = function(){
    if(!this.server){
      return;
    }
    this.server.close();
    this.server = null;
    Gate.prototype.destroy.call(this);
  };
  WSGate.prototype.serve = function(queryarry,wswrapper,usersession){
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
      wsErrorReporter(wswrapper, e);
    }
    wswrapper = null;
    queryarry = null;
  };
  WSGate.prototype.onConnection = function(wsock){
    wsock.on('message',this.onMessage.bind(this,new WSWrapper(wsock)));
  };
  function wsErrorReporter(wswrapper,err){
    //console.log('wsErrorReporter', err);
    wswrapper.send({err:err});
    wswrapper = null;
    //wsock.send(JSON.stringify({err:err}));
  }
  WSGate.prototype.onMessage = function(wswrapper,message,flags){
    StringBuffer.consumeString(message, this.onMessageUnit.bind(this, wswrapper, flags));
  };
  WSGate.prototype.onMessageUnit = function (wswrapper,flags,queryobj){
    try{
      queryobj = JSON.parse(queryobj);
    }
    catch(e){
      console.error('JSON.parse error', e, 'on', queryobj);
      wsErrorReporter(wswrapper,e);
      return;
    }
    if (!wswrapper.ws) {
      return;
    }
    wswrapper.lastReceivedMoment = Date.now();
    if (queryobj[0] === '?') {
      wswrapper.processPing(queryobj[1]);
      return;
    }
    var identity = queryobj[1] || {};
    if(wswrapper.ws._socket.remoteAddress && identity[1]){
      identity[1].ip = identity[1].ip || {};
      identity[1].ip.ip = wswrapper.ws._socket.remoteAddress; //TODO: find remoteAddress
    }
    this.authenticate(identity,wswrapper).done(
      this.serve.bind(this,queryobj,wswrapper),
      wsErrorReporter.bind(null,wswrapper)
    );
  };
  WSGate.prototype.communicationType = 'ws';

  return WSGate;
}

module.exports = createWSGate;
