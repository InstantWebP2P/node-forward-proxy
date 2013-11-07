var Proxy = require('../proxy');

var srv = new Proxy(function(err, proxy){
    if (err || !proxy) {
        console.log(err+',create proxy failed');
        return 
    }

    // start socks proxy service
    var socks = require('socks5');
    var sockspxySrv = socks.createServer(proxy.socksApp);
    
    sockspxySrv.listen(51888, 10);
    
    sockspxySrv.on('error', function (e) {
        console.error('SERVER ERROR: %j', e);
	    if (e.code == 'EADDRINUSE') {
	        console.log('Address in use, retrying in 10 seconds...');
	        setTimeout(function () {
	            console.log('Reconnecting to %s:%s', HOST, PORT);
	            sockspxySrv.close();
	            sockspxySrv.listen(51888, 10);
	        }, 10000);
	    }
    });
    console.log('socks proxy server listen on port 51888');
});
