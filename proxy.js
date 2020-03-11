// Copyright (c) 2013 Tom Zhou<iwebpp@gmail.com>

var eventEmitter = require('events').EventEmitter,
    util = require('util'),
    WEBPP = require('iwebpp.io'),
    SEP = WEBPP.SEP,
    vURL = WEBPP.vURL,
    URL = require('url'),
    NET = require('net'),
    UDT = require('udt'),
    httpps = require('httpps'),
    filter = require('./filter');
    OS = require('os'); // for network interface check;


// helpers
function isLocalhost(host){
    return ((host === 'localhost') || (host === '127.0.0.1') ||
            (host === '0:0:0:0:0:0:0:1') || (host === '::1'));
}

function isLocalintf(host){
    var intfs = OS.networkInterfaces();
    var yes = false;
    
    for (var k in intfs)
        for (var kk in intfs[k])
            if ((intfs[k])[kk].address && ((intfs[k])[kk].address === host)) yes = true;
    
    return yes;
}

// Debug level
var Debug = 0;

// Proxy class
// a proxy will contain one iwebpp.io name-client
// - options: user custom parameters, like {secmode: ..., usrkey: ..., domain: ..., endpoints: ..., turn: ...}
// - options.secmode: ssl, enable ssl/https; acl, enable ssl/https,host-based ACL
// - options.export: Forward-proxy's Export service vURL
// - options.access_local: Enable local access on Export host, 1: enable, 0: disable, default disable it
// -      fn: callback to pass proxy informations
var Proxy = module.exports = function(options, fn){ 
    var self = this;
       
    if (!(this instanceof Proxy)) return new Proxy(options, fn);
    
    // super constructor
    eventEmitter.call(self);
    
    if (typeof options == 'function') {
        fn = options;
        options = {};
    }
    
    // check arguments
    self.access_local = options.access_local || 0;
        
    // 0.
    // export proxy cache
    self.exportCache = {};
    
    // 0.1
    // fill dedicated export service vURL
    if (options && options.export) {
        self.exportCache[options.export] = {vurl: options.export};
    }

    // 1.
    // create name client
    var nmcln = self.nmcln = new WEBPP({
        usrinfo: {
            domain: (options && options.domain) || '51dese.com',
            usrkey: (options && options.usrkey) || ('forward-proxy@'+Date.now())
        },
        
        srvinfo: {
            timeout: 20,
            endpoints: (options && options.endpoints) || [
                {ip: '51dese.com', port: 51686},
                {ip: '51dese.com', port: 51868}
            ],
            turn: (options && options.turn) || [
                {ip: '51dese.com', agent: 51866, proxy: 51688}
            ]
        },

        // vURL mode: vhost-based
        vmode: vURL.URL_MODE_HOST, 

        // secure mode
        secmode: (options && options.secmode === 'ssl') ? 
        		SEP.SEP_SEC_SSL : SEP.SEP_SEC_SSL_ACL_HOST,

        // ssl mode
        sslmode: (options && options.sslmode === 'both') ?  
        		SEP.SEP_SSL_AUTH_SRV_CLNT : SEP.SEP_SSL_AUTH_SRV_ONLY		
    });
	
	// 2.
	// check ready
	nmcln.once('ready', function(){      	    	    
	    // 3.
	    // export http proxy
	    // TBD... admin portal page
	    function exportHttpProxy(req, res){
            res.writeHead(400);
            res.end('TBD... admin portal page');
            console.error('TBD... admin portal page');
	    }
	    
	    // 3.1
	    // export http tunnel
	    function exportHttpTunnel(req, socket, head){
	        // 1.
	        // find next hop in case middle relay using turn-forward-to headers
	    	var middle = req.headers && req.headers['turn-forward-to'];
	    			
	    	if (middle) {
	    		var relays = middle.split(',');
	    		var nxstep = relays[0];

	    		// 1.1
	    		// break loops
	    		var loop = false;
	    		var mine = nmcln.vurl.match(vURL.regex_vboth);
	    		for (var idx = 0; idx < relays.length; idx ++)
	    			if (mine === (relays[idx]).match(vURL.regex_vboth)) {
	    				loop = true;
	    				break;
	    			}
	    		if (loop) {
	    			// stop on loop
	    			socket.end('stop on loop');
	    			console.error('stop on loop:'+nmcln.vurl);
	    			return;
	    		}

	    		// 1.2
	    		// check on vURL
	    		var vstrs, vurle;
	    		if (vstrs = nxstep.match(vURL.regex_vboth)) {
	    			vurle = vstrs[0];

	    			// 2.
	    			// get peer info by vURL
	    			nmcln.getvURLInfo(vurle, function(err, routing){
	    				// 2.1
	    				// check error and authentication 
	    				if (err || !routing) {
	    					// invalid vURL
	    					socket.end('invalid URL');
	    					console.error('invalid URL:'+nxstep);
	    				} else {
	    					// 3.
	    					// check STUN alability
	    					nmcln.checkStunable(vurle, function(err, yes){
	    						if (err) {
	    							// invalid vURL
	    							socket.end('invalid URL');
	    							console.error('invalid URL:'+nxstep);
	    						} else {
	    							// over STUN
	    							if (yes) {
	    								// 5.
	    								// traverse STUN session to peer
	    								nmcln.trvsSTUN(vurle, function(err, stun){
	    									if (err || !stun) {
	    										// STUN not availabe
	    										socket.end('STUN not available, please use TURN');
	    										console.error('STUN not available:'+nxstep);
	    									} else {
	    										// get peer endpoint
	    										var dstip = stun.peerIP, dstport = stun.peerPort;

	    										// setup tunnel to target by make CONNECT request
	    										var roptions = {
	    												port: dstport,
	    												hostname: dstip,
	    												method: 'CONNECT',
	    												path: req.url,
	    												agent: false,

	    												// set user-specific feature,like maxim bandwidth,etc
	    												localAddress: {
	    													addr: nmcln.ipaddr,
	    													port: nmcln.port, 

	    													opt: {
	    														mbw: options.mbw || null
	    													}
	    												}
	    										};
	    										// set SSL related options
	    										if (nmcln.secmode && nmcln.secerts) {
	    											Object.keys(nmcln.secerts).forEach(function(k){
	    												roptions[k] = nmcln.secerts[k];  
	    											});
	    										}

	    										// set turn-forward-to header for middle relays
	    										if (relays.length > 1) {
	    											var nmiddle = [];
	    											for (var idx = 1; idx < relays.length; idx ++)
	    												nmiddle.push(relays[idx]);
	    											var going = nmiddle.join(',');

	    											roptions.headers = {};
	    											roptions.headers['turn-forward-to'] = going;
	    										}

	    										var rreq = httpps.request(roptions);
	    										rreq.end();

	    										if (Debug) console.log('tunnel proxy relay, connect to %s:%d', dstip, dstport);
	    										rreq.on('connect', function(rres, rsocket, rhead) {
	    											if (Debug) console.log('tunnel proxy relay, got connected');

	    											socket.write('HTTP/1.1 200 Connection Established\r\n' +
	    													'Proxy-agent: Node-Proxy\r\n' +
	    													'\r\n');

	    											rsocket.pipe(socket);
	    											socket.pipe(rsocket);

	    											rsocket.on('error', function(e) {
	    												console.log("tunnel proxy relay, socket error: " + e);
	    												socket.end();
	    											});
	    										});

	    										rreq.on('error', function(e) {
	    											console.log("tunnel proxy relay, CONNECT request error: " + e);					        
	    											socket.end();
	    										});
	    									}
	    								});		        
	    							} else {
	    								// over TURN, not support for middle relays
	    								socket.end('not support turn for middle relays '+nxstep);
	    								console.error('not support turn for middle relays '+nxstep);
	    							}		        
	    						}
	    					});
	    				}
	    			});
	    		} else {
	    			// not reachable
	    			socket.end('not reachable');
	    			console.error('not reachable:'+nxstep);
	    		}
	    	} else {
	            // 2.
	        	// reach export
	            var urls    = URL.parse('http://'+req.url, true, true);
	            var srvip   = urls.hostname;
	            var srvport = urls.port || 443;
	            
	            // check if access to export local host
	            if ((self.access_local === 0) && (isLocalhost(srvip) || isLocalintf(srvip))) {
                    console.log("http tunnel proxy to " + req.url + ", deny local access on export host");
                    socket.end();
                    return;
	            }
	            
                if (Debug) console.log('http tunnel proxy, connect to %s:%d', srvip, srvport);
                var srvSocket = NET.connect(srvport, srvip, function() {
                    if (Debug) console.log('http tunnel proxy, got connected!');   
                    
                    ///srvSocket.write(head); 
				    socket.write('HTTP/1.1 200 Connection Established\r\n' +
				                 'Proxy-agent: Node-Proxy\r\n' +
				                 '\r\n');
				    srvSocket.pipe(socket);
				    socket.pipe(srvSocket);
                });
  
				srvSocket.setNoDelay(true);
				    
				srvSocket.on('error', function(e) {
				    console.log("http tunnel proxy to " + req.url + ", socket error: " + e);
				    socket.end();
				});
	        }
	    };
	    	    
	    // 5.
	    // import http proxy
	    function importHttpProxy(req, res){
	    	var vurle, vstrs, urle = req.url;
		    
		    if (Debug) console.log('proxy to '+urle+',headers:'+JSON.stringify(req.headers));
		    
		    function resErr(err){
		        try {
			        res.writeHead(500);
					res.end(err);
				} catch (e) {
				    console.log('res.end exception '+e);
				}
		    }
		    
		    // 0.
		    // find next hop
		    
		    		    
		    // 1.
		    // match vURL pattern:
		    // - vhost like http(s)://xxx.vurl.51dese.com
		    // - vpath like http(s)://51dese.com"/vurl/xxx"
		    if (vstrs = req.headers.host.match(vURL.regex_vhost)) {
		        vurle = vstrs[0];
		        if (Debug) console.log('proxy for client with vhost:'+vurle);
		    } else if (vstrs = urle.match(vURL.regex_vpath)) {
			    vurle = vstrs[0];	       
			    
			    // prune vpath in req.url
	            req.url = req.url.replace(vurle, '');
	            
			    if (Debug) console.log('proxy for client with vpath:'+vurle);
		    } else if (vurle = self.findExport(req.headers.host, urle)) {
		        if (Debug) console.log('use export proxy '+vurle);
		    } else {
		        // not reachable
                resErr('not reachable');
                console.error('not reachable:'+urle);
                                
                return;
		    }
		    
		    if (Debug) console.log('tunnel proxy for client request.headers:'+JSON.stringify(req.headers)+
		                           ',url:'+urle+',vurl:'+vurle);
		                           
		    // 1.1
	        // !!! rewrite req.url to remove vToken parts
	        // TBD ... vToken check
	        req.url = req.url.replace(vURL.regex_vtoken, '');                      
		    
		    // 2.
			// get peer info by vURL
		    nmcln.getvURLInfo(vurle, function(err, routing){
		        // 2.1
		        // check error and authentication 
		        if (err || !routing) {
		            // invalid vURL
	                resErr('invalid URL');
	                console.error('invalid URL:'+urle);
	                
            		// clear export cache
                    if (self.exportCache[vurle]) {
                        self.exportCache[vurle] = null;
                    }
		        } else {
			        // 3.
			        // check STUN alability
			        nmcln.checkStunable(vurle, function(err, yes){
			            if (err) {
					        // invalid vURL
			                resErr('invalid URL');
			                console.error('invalid URL:'+urle);
			                
		            		// clear export cache
		                    if (self.exportCache[vurle]) {
		                        self.exportCache[vurle] = null;
		                    }
			            } else {
			                // over STUN
			                if (yes) {
						        // 5.
						        // traverse STUN session to peer
						        nmcln.trvsSTUN(vurle, function(err, stun){						        
						            if (err || !stun) {
							            // STUN not availabe
					                    resErr('STUN not available, please use TURN');
					                    console.error('STUN not available:'+urle);
					                    
					                    // clear export cache
					                    if (self.exportCache[vurle]) {
					                        self.exportCache[vurle] = null;
					                    }
						            } else {
							            //  get peer endpoint
						                var dstip = stun.peerIP, dstport = stun.peerPort;
						                						                
					                    // 6.
									    // setup tunnel to target by make CONNECT request
									    var roptions = {
									            port: dstport,
									        hostname: dstip,
									        
										      method: 'CONNECT',
										        path: (/(:\d+)$/gi).test(req.headers.host) ? req.headers.host : req.headers.host+':80',
										       agent: false,
										       
					                        // set user-specific feature,like maxim bandwidth,etc
					                        localAddress: {
						                        addr: nmcln.ipaddr,
						                        port: nmcln.port, 
						                        
						                        opt: {
						                            mbw: options.mbw || null
						                        }
						                    }
								        };
								        // set SSL related options
									    if (nmcln.secmode && nmcln.secerts) {
									        Object.keys(nmcln.secerts).forEach(function(k){
									            roptions[k] = nmcln.secerts[k];  
									        });
									    }
									    
					                    var rreq = httpps.request(roptions);
										rreq.end();
										
										rreq.on('error', function(e) {
									        console.log("tunnel proxy, CONNECT request error: " + e);					        
									        resErr("tunnel proxy, CONNECT request error: " + e);
									    });
									    
										if (Debug) console.log('tunnel proxy, connect to %s:%d', dstip, dstport);
										rreq.on('connect', function(rres, rsocket, rhead) {
										    if (Debug) console.log('tunnel proxy, got connected');
										
										    rsocket.on('error', function(e) {
										        console.log("tunnel proxy, socket error: " + e);
										        resErr("tunnel proxy, socket error: " + e);
										    });
										    
										    if (Debug) console.log('req.headers: '+JSON.stringify(req.headers));
										    // request on tunnel connection
										    var toptions = {
											              method: req.method,
											                path: req.url.match(/^(http:)/gi)? URL.parse(req.url).path : req.url,
											               agent: false,
											               
											             // set headers
											             headers: req.headers,
											             
											    // pass rsocket which's request on           
											    createConnection: function(port, host, options){
											        return rsocket
											    } 
									        };
											
											var treq = httpps.request(toptions, function(tres){
											    if (Debug) console.log('tunnel proxy, got response, headers:'+JSON.stringify(tres.headers));
											    
											    try {
													 // set headers
													Object.keys(tres.headers).forEach(function (key) {
														res.setHeader(key, tres.headers[key]);
													});
													res.writeHead(tres.statusCode);

											    	tres.pipe(res);

											    	tres.on('error', function(e) {
											    		console.log("tunnel proxy, tunnel response error: " + e);					        
											    		resErr("tunnel proxy, tunnel response error: " + e);
											    	});
											    } catch (e) {
											    	console.log("tunnel proxy, tunnel response exception: " + e);					        
											    }
											});
											treq.on('error', function(e) {
										        console.log("tunnel proxy, tunnel request error: " + e);					        
										        resErr("tunnel proxy, tunnel request error: " + e);
									        });
											req.pipe(treq);
											req.on('error', resErr);
											req.on('aborted', function () {
											    treq.abort();
											});
											if (req.trailers) {
											    treq.end();
											}
											req.on('close', function () {
											    treq.abort();
											});
										});
						            }
						        });		        			                    
			                    
			                } else {
			                    // over TURN
			                    
						        // 5.
						        // traverse TURN session to peer
						        // notes: TURN session will use vToken for authentication
						        nmcln.trvsTURN(vurle, function(err, turn){						        
						            if (err || !turn) {
							            // TURN not availabe
					                    resErr('TURN not available, please check TURN service setup');
					                    console.error('TURN not available:'+urle);
					                    
					                    // clear export cache
					                    if (self.exportCache[vurle]) {
					                        self.exportCache[vurle] = null;
					                    }
						            } else {
						                // 6.
									    // setup tunnel to target by make CONNECT request
									    var roptions = {
									            port: routing.turn.proxyport,
									        hostname: routing.turn.ipaddr,
									       
										      method: 'CONNECT',
										        path: (/(:\d+)$/gi).test(req.headers.host) ? req.headers.host : req.headers.host+':80',
										       agent: false
								        };
									    // set turn-forward-to header: destination name-client's full vURL string
									    roptions.headers = {};
									    roptions.headers['turn-forward-to'] = vurle;
									    
									    // set SSL related options
								        // TBD...
									    /*if (nmcln.secmode && nmcln.secerts) {
									        Object.keys(nmcln.secerts).forEach(function(k){
									            roptions[k] = nmcln.secerts[k];  
									        });
									    }*/
									    
					                    var rreq = httpps.request(roptions);
										rreq.end();
										
										rreq.on('error', function(e) {
									        console.log("tunnel proxy over TURN, CONNECT request error: " + e);					        
									        resErr("tunnel proxy over TURN, CONNECT request error: " + e);
									    });
									    
										if (Debug) console.log('tunnel proxy over TURN, connect to %s:%d', routing.turn.ipaddr, routing.turn.proxyport);
										rreq.on('connect', function(rres, rsocket, rhead) {
										    if (Debug) console.log('tunnel proxy over TURN, got connected');
										
										    rsocket.on('error', function(e) {
										        console.log("tunnel proxy over TURN, socket error: " + e);
										        resErr("tunnel proxy over TURN, socket error: " + e);
										    });
										    
										    // request on tunnel connection
										    var toptions = {
											              method: req.method,
											                path: req.url.match(/^(http:)/gi)? URL.parse(req.url).path : req.url,
											               agent: false,
											               
											             // set headers
											             headers: req.headers,
											             
											    // pass rsocket which's request on           
											    createConnection: function(port, host, options){
											        return rsocket
											    } 
									        };
											
											var treq = httpps.request(toptions, function(tres){
											    if (Debug) console.log('tunnel proxy over TURN, got response, headers:'+JSON.stringify(tres.headers));
											    
											    // set headers
											    Object.keys(tres.headers).forEach(function (key) {
											      res.setHeader(key, tres.headers[key]);
											    });
											    try {
											    	res.writeHead(tres.statusCode);

											    	tres.pipe(res);

											    	tres.on('error', function(e) {
											    		console.log("tunnel proxy over TURN, tunnel response error: " + e);					        
											    		resErr("tunnel proxy, tunnel response error: " + e);
											    	});
											    } catch (e) {
											    	console.log("tunnel proxy over TURN, tunnel response exception: " + e);					        
											    }
											});
											treq.on('error', function(e) {
										        console.log("tunnel proxy over TURN, tunnel request error: " + e);					        
										        resErr("tunnel proxy over TURN, tunnel request error: " + e);
									        });
											req.pipe(treq);
											req.on('error', resErr);
											req.on('aborted', function () {
											    treq.abort();
											});
											if (req.trailers) {
											    treq.end();
											}
											req.on('close', function () {
											    treq.abort();
											});
										});
						            }
						        });					                    
			                    
			                }
			            }
			        });
		        }
	        });
	    }
	    
	    // 5.1
	    // import http tunnel proxy based on CONNECT method
	    function importHttpTunnel(req, socket, head) {
		    var vurle, vstrs, urle = req.url;
		    
		    if (Debug) console.log('tunnel to '+urle);
		    
		    // 0.
		    // find next hop
		    
		    
		    // 1.
		    // match vURL pattern:
		    // - vhost like http(s)://xxx.vurl.51dese.com
		    // - vpath like http(s)://51dese.com/vurl/xxx"
		    if (vstrs = urle.match(vURL.regex_vhost)) {
		        vurle = vstrs[0];
		        if (Debug) console.log('tunnel for client with vhost:'+vurle);
		    } else if (vstrs = urle.match(vURL.regex_vpath)) {
			    vurle = vstrs[0];	       
			    
			    // prune vpath in req.url
	            req.url = req.url.replace(vurle, '');
	                 
			    if (Debug) console.log('proxy for client with vpath:'+vurle);
		    } else if (vurle = self.findExport(urle, urle)) {
		        if (Debug) console.log('use export proxy '+vurle);
		    } else {
		        // not reachable
                socket.end('not reachable');
                console.error('not reachable:'+urle);
                                
                return;
		    }
		    
		    if (Debug) console.log('tunnel proxy for client request.headers:'+JSON.stringify(req.headers)+
		                           ',url:'+urle+',vurl:'+vurle);
		                           
		    // 1.1
	        // !!! rewrite req.url to remove vToken parts
	        // TBD ... vToken check
	        req.url = req.url.replace(vURL.regex_vtoken, '');                      
		    
		    // 2.
			// get peer info by vURL
		    nmcln.getvURLInfo(vurle, function(err, routing){
		        // 2.1
		        // check error and authentication 
		        if (err || !routing) {
		            // invalid vURL
	                socket.end('invalid URL');
	                console.error('invalid URL:'+urle);
	                
            		// clear export cache
                    if (self.exportCache[vurle]) {
                        self.exportCache[vurle] = null;
                    }
		        } else {
			        // 3.
			        // check STUN alability
			        nmcln.checkStunable(vurle, function(err, yes){
			            if (err) {
					        // invalid vURL
			                resErr('invalid URL');
			                console.error('invalid URL:'+urle);
			                
		            		// clear export cache
		                    if (self.exportCache[vurle]) {
		                        self.exportCache[vurle] = null;
		                    }
			            } else {
			                // over STUN
			                if (yes) {
						        // 5.
						        // traverse STUN session to peer
						        nmcln.trvsSTUN(vurle, function(err, stun){
						            if (err || !stun) {
							            // STUN not availabe
					                    socket.end('STUN not available, please use TURN');
					                    console.error('STUN not available:'+urle);
					                    
					                    // clear export cache
					                    if (self.exportCache[vurle]) {
					                        self.exportCache[vurle] = null;
					                    }        
						            } else {
						                // get peer endpoint
						                var dstip = stun.peerIP, dstport = stun.peerPort;
						                						                
						                // 6.
						                // if req.url is valid vURL, connect it directly,
						                // otherwise do CONNECT tunnel over export vURL 
						                // notes: disable it to avoid middle-man attack
						                if (urle.match(vurle)) {
						                    // 6.1
						                    // connect it directly						                    	            
							                if (Debug) console.log('https proxy, httpp connect to %s:%d', dstip, dstport);
							                
							                // connection options
							                var coptions = {
							                    port: dstport, 
							                    host: dstip, 
							                    
							                    // set user-specific feature,like maxim bandwidth,etc
							                    localAddress: {
							                        addr: nmcln.ipaddr,
							                        port: nmcln.port, 
							                        
							                        opt: {
							                            mbw: options.mbw || null
							                        }
							                    }
							                };
							                var srvSocket = UDT.connect(coptions, function() {
							                    if (Debug) console.log('https proxy, httpp connect, got connected!');   
							                    
							                    socket.write('HTTP/1.1 200 Connection Established\r\n' +
											                 'Proxy-agent: Node-Proxy\r\n' +
												             '\r\n');
												
												srvSocket.pipe(socket);
												socket.pipe(srvSocket);
							                });
											    
											srvSocket.on('error', function(e) {
											    console.log("https proxy, httpp connect to " + req.url + ", socket error: " + e);
											    socket.end();
											});						                    
						                } else {
							                // 6.2
										    // setup tunnel to target by make CONNECT request
										    var roptions = {
											        port: dstport,
											    hostname: dstip,
											      method: 'CONNECT',
											        path: req.url,
											       agent: false,
											        
											    // set user-specific feature,like maxim bandwidth,etc
							                    localAddress: {
							                        addr: nmcln.ipaddr,
							                        port: nmcln.port, 
							                        
							                        opt: {
							                            mbw: options.mbw || null
							                        }
							                    }
									        };
									        // set SSL related options
										    if (nmcln.secmode && nmcln.secerts) {
										        Object.keys(nmcln.secerts).forEach(function(k){
										            roptions[k] = nmcln.secerts[k];  
										        });
										    }
										    							
											var rreq = httpps.request(roptions);
											rreq.end();
											
											if (Debug) console.log('tunnel proxy, connect to %s:%d', dstip, dstport);
											rreq.on('connect', function(rres, rsocket, rhead) {
											    if (Debug) console.log('tunnel proxy, got connected');
											
											    socket.write('HTTP/1.1 200 Connection Established\r\n' +
											                 'Proxy-agent: Node-Proxy\r\n' +
												             '\r\n');
												
												rsocket.pipe(socket);
												socket.pipe(rsocket);
												
											    rsocket.on('error', function(e) {
											        console.log("tunnel proxy, socket error: " + e);
											        socket.end();
											    });
											});
											
											rreq.on('error', function(e) {
										        console.log("tunnel proxy, CONNECT request error: " + e);					        
										        socket.end();
										    });
									    }
						            }
						        });		        
			                } else {
			                    // over TURN
			                    
						        // 5.
						        // traverse TURN session to peer
						        nmcln.trvsTURN(vurle, function(err, turn){
						            if (err || !turn) {
							            // TURN not availabe
					                    resErr('TURN not available, please check TURN service setup');
					                    console.error('TURN not available:'+urle);
					                    
					                    // clear export cache
					                    if (self.exportCache[vurle]) {
					                        self.exportCache[vurle] = null;
					                    }
						            } else {
						                // 6.
									    // setup tunnel to target by make CONNECT request
									    var roptions = {
									            port: routing.turn.proxyport,
									        hostname: routing.turn.ipaddr,
									       
										      method: 'CONNECT',
										        path: req.url,
										       agent: false
								        };
								        // set turn-forward-to header: destination name-client's full vURL string
								        roptions.headers = {};
									    roptions.headers['turn-forward-to'] = vurle;
									    
								        // set SSL related options
									    /*if (nmcln.secmode && nmcln.secerts) {
									        Object.keys(nmcln.secerts).forEach(function(k){
									            roptions[k] = nmcln.secerts[k];  
									        });
									    }*/
									    							
										var rreq = httpps.request(roptions);
										rreq.end();
										
										if (Debug) console.log('tunnel proxy over TURN, connect to %s:%d',
												routing.turn.ipaddr, routing.turn.proxyport);
										rreq.on('connect', function(rres, rsocket, rhead) {
										    if (Debug) console.log('tunnel proxy over TURN, got connected');
										
										    socket.write('HTTP/1.1 200 Connection Established\r\n' +
										                 'Proxy-agent: Node-Proxy\r\n' +
											             '\r\n');
											
											rsocket.pipe(socket);
											socket.pipe(rsocket);
											
										    rsocket.on('error', function(e) {
										        console.log("tunnel proxy over TURN, socket error: " + e);
										        socket.end();
										    });
										});
										
										rreq.on('error', function(e) {
									        console.log("tunnel proxy over TURN, CONNECT request error: " + e);					        
									        socket.end();
									    });
						            }
						        });		        			                    
			                }		        
		                }
		            });
		        }
	        });
	    }	    
        
	    // 5.2
	    // import socks proxy
	    function importSocksProxy(socket, port, address, proxy_ready) {
		    var vurle, vstrs, urle = address+':'+port;
		    
		    if (Debug) console.log('socks proxy to '+urle);
		    
		    // 1.
		    // find next hop
		    // TBD...
		    if (vstrs = urle.match(vURL.regex_vhost)) {
		        vurle = vstrs[0];
		        if (Debug) console.log('tunnel for client with vhost:'+vurle);
		    } else if (vurle = self.findExport(urle, urle)) {
		        if (Debug) console.log('use export proxy '+vurle);
		    } else {
		        // not reachable
                socket.end('not reachable');
                console.error('not reachable:'+urle);
                                
                return;
		    }
		    
		    if (Debug) console.log('socks proxy for client'+
		                           ',url:'+urle+',vurl:'+vurle);
		                   
		    // 2.
			// get peer info by vURL
		    nmcln.getvURLInfo(vurle, function(err, routing){
		        // 2.1
		        // check error and authentication 
		        if (err || !routing) {
		            // invalid vURL
	                socket.end('invalid URL');
	                console.error('invalid URL:'+urle);
	                
            		// clear export cache
                    if (self.exportCache[vurle]) {
                        self.exportCache[vurle] = null;
                    }
		        } else {
			        // 3.
			        // check STUN alability
			        nmcln.checkStunable(vurle, function(err, yes){
			            if (err) {
					        // invalid vURL
			                resErr('invalid URL');
			                console.error('invalid URL:'+urle);
			                
		            		// clear export cache
		                    if (self.exportCache[vurle]) {
		                        self.exportCache[vurle] = null;
		                    }
			            } else {
			                // over STUN
			                if (yes) {
						        // 5.
						        // traverse STUN session to peer
						        nmcln.trvsSTUN(vurle, function(err, stun){
						            if (err || !stun) {
							            // STUN not availabe
					                    socket.end('STUN not available, please use TURN');
					                    console.error('STUN not available:'+urle);
					                    
					                    // clear export cache
					                    if (self.exportCache[vurle]) {
					                        self.exportCache[vurle] = null;
					                    }            
						            } else {
								        // get peer endpoint
						                var dstip = stun.peerIP, dstport = stun.peerPort;
						                						                
						                // 6.
						                // if address:port is valid vURL, connect it directly,
						                // otherwise do CONNECT tunnel over export vURL 
						                // notes: disable it to avoid middle-man attack
						                if (urle.match(vurle)) {
						                    // 6.1
						                    // connect it directly						                    	            
							                if (Debug) console.log('socks proxy, httpp connect to %s:%d', dstip, dstport);
							                
							                // connection options
							                var coptions = {
							                    port: dstport, 
							                    host: dstip, 
							                    
							                    // set user-specific feature,like maxim bandwidth,etc
							                    localAddress: {
							                        addr: nmcln.ipaddr,
							                        port: nmcln.port, 
							                        
							                        opt: {
							                            mbw: options.mbw || null
							                        }
							                    }
							                };
							                var srvSocket = UDT.connect(coptions, function() {
											    if (Debug) console.log('socks proxy, httpp got connected');
											
											    // send socks response      
											    proxy_ready();
												
												srvSocket.pipe(socket);
												socket.pipe(srvSocket);
							                });
											    
											srvSocket.on('error', function(e) {
											    console.log("socks proxy, httpp socket error: " + e);
											    socket.end();
											});						                    
						                } else {						                
							                // 6.2
										    // setup tunnel to target by make CONNECT request
										    var roptions = {
											        port: dstport,
											    hostname: dstip,
											      method: 'CONNECT',
											        path: urle,
											       agent: false,
											        
											    // set user-specific feature,like maxim bandwidth,etc
							                    localAddress: {
							                        addr: nmcln.ipaddr,
							                        port: nmcln.port, 
							                        
							                        opt: {
							                            mbw: options.mbw || null
							                        }
							                    }
									        };
									        // set SSL related options
										    if (nmcln.secmode && nmcln.secerts) {
										        Object.keys(nmcln.secerts).forEach(function(k){
										            roptions[k] = nmcln.secerts[k];  
										        });
										    }
											
											var rreq = httpps.request(roptions);
											rreq.end();
											
											if (Debug) console.log('socks proxy, connect to %s:%d', dstip, dstport);
											rreq.on('connect', function(rres, rsocket, rhead) {
											    if (Debug) console.log('socks proxy, got connected');
											
											    // send socks response      
											    proxy_ready();
												
												rsocket.pipe(socket);
												socket.pipe(rsocket);
												
											    rsocket.on('error', function(e) {
											        console.log("socks proxy, socket error: " + e);
											        socket.end();
											    });
											});
											
											rreq.on('error', function(e) {
										        console.log("socks proxy, CONNECT request error: " + e);					        
										        socket.end();
										    });
									    }
						            }
						        });		        
			                } else {
			                    // over TURN
			                	
			                	// 5.
						        // traverse TURN session to peer
						        nmcln.trvsTURN(vurle, function(err, turn){
						            if (err || !turn) {
							            // TURN not availabe
					                    resErr('TURN not available, please check TURN service setup');
					                    console.error('TURN not available:'+urle);
					                    
					                    // clear export cache
					                    if (self.exportCache[vurle]) {
					                        self.exportCache[vurle] = null;
					                    }
						            } else {
						                // 6.
									    // setup tunnel to target by make CONNECT request
									    var roptions = {
									            port: routing.turn.proxyport,
									        hostname: routing.turn.ipaddr,
									       
										      method: 'CONNECT',
										        path: urle,
										       agent: false
								        };
								        // set turn-forward-to header: destination name-client's full vURL string
									    roptions.headers = {};
									    roptions.headers['turn-forward-to'] = vurle;
									    
								        // set SSL related options
									    /*if (nmcln.secmode && nmcln.secerts) {
									        Object.keys(nmcln.secerts).forEach(function(k){
									            roptions[k] = nmcln.secerts[k];  
									        });
									    }*/
										
										var rreq = httpps.request(roptions);
										rreq.end();
										
										if (Debug) console.log('socks proxy over TURN, connect to %s:%d', routing.turn.ipaddr, routing.turn.proxyport);
										rreq.on('connect', function(rres, rsocket, rhead) {
										    if (Debug) console.log('socks proxy over TURN, got connected');
										
										    // send socks response      
										    proxy_ready();
											
											rsocket.pipe(socket);
											socket.pipe(rsocket);
											
										    rsocket.on('error', function(e) {
										        console.log("socks proxy over TURN, socket error: " + e);
										        socket.end();
										    });
										});
										
										rreq.on('error', function(e) {
									        console.log("socks proxy over TURN, CONNECT request error: " + e);					        
									        socket.end();
									    });
						            }
						        });		        
			                }		    
			            }
			        });
		        }
	        });
	    }
        
        // 8.
	    // pass forward proxy App
	    var papps = {importApp: {httpApp: {tunnel: importHttpTunnel, proxy: importHttpProxy}, socksApp: importSocksProxy},
	    		     exportApp: {httpApp: {tunnel: exportHttpTunnel, proxy: exportHttpProxy}}};
	    if (fn) fn(null, papps);
	    self.emit('ready', papps);
	});
	
	// 1.2
	// check error
	nmcln.on('error', function(err){
	    // 1.2.1
	    // clear export service query timer
	    if (self.qsInterval) {
            clearInterval(self.qsInterval);
            self.qsInterval = null;
        }
	    
	    console.log('name-client create failed:'+JSON.stringify(err));
	    if (fn) fn(err);
	    self.emit('error', err);
	});
};

util.inherits(Proxy, eventEmitter);

// Choose an export service vURL
// TBD... geoip based algorithm for host/url
Proxy.prototype.findExport = function(host, url){
    var self = this;
    var rndm = Math.ceil(Math.random() * 1000000);
    var vkey = [];
    var isCN = filter.isCN(host && (host.split(':'))[0], url);
    
    // screen valid export
    Object.keys(self.exportCache).forEach(function(k){
    	if (self.exportCache[k]) 
    		// filter CN site
    		if (isCN) {
    			if (self.exportCache[k].geoip &&
    				self.exportCache[k].geoip.country === 'CN')
    				vkey.push(k);
    		} else {
    			// TBD... filter on rest
    			if (self.exportCache[k].geoip &&
    				self.exportCache[k].geoip.country != 'CN')
    				vkey.push(k);
    		}
    });
    if (Debug) console.log('vkey: '+JSON.stringify(vkey));
    
    // choose one
    if (vkey && vkey.length) {
        ///console.log(rndm % vkey.length);
        return self.exportCache[vkey[rndm % vkey.length]].vurl;
    } else { 
        return null;
    }
};

// Query Live export service and cache it
Proxy.prototype.queryExport = function(fn){
    var self = this;
    
    // export service cache
    self.exportCache = self.exportCache || {};
    
    // 1.
    // query live forward-proxy-export service
    self.nmcln.queryService({cate: 'forward-proxy-export', live: true}, function(err, srv){
        if (err || !srv) {
            console.log('No available export services '+err);
            if (fn) fn('No available export services');
        } else {
            if (Debug) console.log('available export services: '+JSON.stringify(srv));
            
            // 2.
            // cache it
            Object.keys(srv).forEach(function(k){
                if (srv[k] && !(k in self.exportCache)) {
                    self.exportCache[k] = srv[k];
                }
            });
            
            if (fn) fn(null, srv);
        }
    });
    
    return self;
};

// Turn on/off export service query timer
// - on: true or false
// - timeout: optional, default is 20s
Proxy.prototype.turnQuerytimer = function(on, timeout){
	var self = this;
	timeout = timeout || 20000;

	if (on && !self.qsInterval) {
		if (Debug) console.log('turn on export service query timemout '+timeout);

		// query for the first time
		self.queryExport();

		// delayed query for the second time after 6s
		setTimeout(function() {
			self.queryExport();

			self.qsInterval = setInterval(function(){
				self.queryExport();
			}, timeout);
		}, 6000); // 6s delay
	} else {
		if (self.qsInterval) {
			if (Debug) console.log('turn off export service query timer');

			clearInterval(self.qsInterval);
			self.qsInterval = null;
		}
	}

	return self;
};
