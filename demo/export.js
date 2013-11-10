var Proxy = require('../proxy');

var srv = new Proxy(function(err, proxy){
    if (err || !proxy) {
        console.log(err+',create proxy failed');
        return 
    }
    var nmcln = srv.nmcln;
    var exportApp = proxy.exportApp;
    
    // hook export http app on name-client
    nmcln.bsrv.srv.on('request', exportApp.httpApp.proxy);
    nmcln.bsrv.srv.on('connect', exportApp.httpApp.tunnel);
        
    console.log('Export service ready on vURL: '+nmcln.vurl);
});
