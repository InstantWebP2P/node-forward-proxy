var Proxy = require('../proxy');

var srv = new Proxy(function(err, proxy){
    if (err || !proxy) {
        console.log(err+',create proxy failed');
        return 
    }
    
    // start forward proxy service
    var http = require('http');
    var pxySrv = http.createServer();
    
    pxySrv.on('request', proxy.httpApp.proxy);
    pxySrv.on('connect', proxy.httpApp.tunnel);
    
    pxySrv.listen(51866);
    console.log('http forwar proxy server listen on port 51866');
});
