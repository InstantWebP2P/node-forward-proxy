var Proxy = require('../proxy');

// fill Export service's vURL as options.export
var srv = new Proxy({export: 'https://9f34d25f045b34f1cc7f423e15c2b416.vurl.51dese.com:51688/vtoken/1c4e246969340c08'}, function(err, proxy){
    if (err || !proxy) {
        console.log(err+',create proxy failed');
        return 
    }
    var importApp = proxy.importApp;

    // start socks proxy service
    var socks = require('socks5');
    var sockspxySrv = socks.createServer(importApp.socksApp);
    
    sockspxySrv.listen(51888);
    
    sockspxySrv.on('error', function (e) {
        console.error('SERVER ERROR: %j', e);
	    if (e.code == 'EADDRINUSE') {
	        console.log('Address in use, retrying in 10 seconds...');
	        setTimeout(function () {
	            console.log('Reconnecting to %s:%s', HOST, PORT);
	            sockspxySrv.close();
	            sockspxySrv.listen(51888);
	        }, 10000);
	    }
    });
    console.log('Socks forward proxy server listen on port 51888');
});
