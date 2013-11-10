var Proxy = require('../proxy');

// fill Export service's vURL as options.export
var srv = new Proxy({export: 'https://9f34d25f045b34f1cc7f423e15c2b416.vurl.iwebpp.com:51688/vtoken/1c4e246969340c08'}, function(err, proxy){
    if (err || !proxy) {
        console.log(err+',create proxy failed');
        return 
    }
    var importApp = proxy.importApp;
    
    // start http proxy service
    var http = require('http');
    var pxySrv = http.createServer();
    
    pxySrv.on('request', importApp.httpApp.proxy);
    pxySrv.on('connect', importApp.httpApp.tunnel);
    
    pxySrv.listen(51866, 50);
    console.log('http forwar proxy server listen on port 51866');
    
    // start https proxy service, only chrome support
    var fs = require('fs');
    var https = require('https');
    var pxySrvs = https.createServer({
     key: fs.readFileSync('./certs/server-key.pem'),
    cert: fs.readFileSync('./certs/server-cert.pem')
    });
    
    pxySrvs.on('request', importApp.httpApp.proxy);
    pxySrvs.on('connect', importApp.httpApp.tunnel);
    
    pxySrvs.listen(51863, 50);
    console.log('https forwar proxy server listen on port 51863');
});
