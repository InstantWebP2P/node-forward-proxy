var Proxy = require('../proxy');

var srv = new Proxy(function(err, proxy){
    if (err || !proxy) {
        console.log(err+',create proxy failed');
        return 
    }
    
    // start http proxy service
    var http = require('http');
    var pxySrv = http.createServer();
    
    pxySrv.on('request', proxy.httpApp.proxy);
    pxySrv.on('connect', proxy.httpApp.tunnel);
    
    pxySrv.listen(51866, 50);
    console.log('http forwar proxy server listen on port 51866');
    
    // start https proxy service, only chrome support
    var fs = require('fs');
    var https = require('https');
    var pxySrvs = https.createServer({
     key: fs.readFileSync('./certs/server-key.pem'),
    cert: fs.readFileSync('./certs/server-cert.pem')
    });
    
    pxySrvs.on('request', proxy.httpApp.proxy);
    pxySrvs.on('connect', proxy.httpApp.tunnel);
    
    pxySrvs.listen(51863, 50);
    console.log('https forwar proxy server listen on port 51863');
});
