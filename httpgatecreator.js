var Url = require('url'),
    Path = require('path')/*,
    node_static = require('node-static')*/;

function createHttpGate(execlib,Gate){
  'use strict';
  var lib = execlib.lib;
  function HttpGate(service,authenticator){
    Gate.call(this,service,authenticator);
  }
  lib.inherit(HttpGate,Gate);
  HttpGate.prototype.serve = function(req,res,parsed_url,usersession){
    if(!usersession){
      res.write(JSON.stringify({id:parsed_url.query.q.id,introduce:null}));
      res.end();
      req = null;
      res = null;
      parsed_url = null;
      return;
    }
    if(parsed_url.pathname==='/proc'){
      if(parsed_url.query && parsed_url.query.q){
        try {
          res.write(JSON.stringify(usersession.handleIncoming(parsed_url.query.q)));
        }
        catch (e) {
          httpErrorReporter(res, parsed_url.query, e);
        }
      }else{
        res.write(JSON.stringify({id:parsed_url.query.q.id,err:'No query'}));
      }
      res.end();
    }else if(parsed_url.pathname==='/_'){
      usersession.serveRequestForIncoming(res);
    }
    req = null;
    res = null;
    parsed_url = null;
  };
  function httpErrorReporter(res,queryobj,err){
    console.log('httpErrorReporter',queryobj);
    res.write(JSON.stringify({id:queryobj.id,err:err}));
    res.end();
    res = null;
    queryobj = null;
  }
  HttpGate.prototype.handle = function(/*fileserver,*/req,res){
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setTimeout(0);
    var parsed_url = Url.parse(req.url, true);
    var extname = Path.extname(parsed_url.pathname);
    if (req.url === '/' || extname) {
      //fileserver.serve(req,res);
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end();
    }else{
      var queryobj;
      if(parsed_url.query && parsed_url.query.q){
        try{
          queryobj = JSON.parse(parsed_url.query.q);
          parsed_url.query.q = queryobj;
        }
        catch(e){
          console.log(e);
          res.write(JSON.stringify({err:'Not a callable format'}));
          res.end();
          return;
        }
      }
      if(queryobj){
        //console.log('incoming identity:',queryobj.identity);
        var identity = queryobj.identity || {};
        identity.credentials = identity.credentials || {};
        identity.credentials.ip = identity.credentials.ip || {};
        identity.credentials.ip.ip = req.socket.remoteAddress;
        this.authenticate(identity).done(
          this.serve.bind(this,req,res,parsed_url),
          httpErrorReporter.bind(null,res,queryobj)
        );
      }else{
        res.statusCode = 401;
        res.end();
      }
    }
  };
  HttpGate.prototype.handler = function(options){
    options = options||{};
    return this.handle.bind(this/*,
      new (node_static.Server)(options.root||Path.join(process.cwd(),'www'))*/
    );
  };
  HttpGate.prototype.communicationType = 'http';
  return HttpGate;
}

module.exports = createHttpGate;
