node-forward-proxy
===============

p2p http forward and socks proxy based on iWebPP.io and Node.js

### Features

* http / socks proxy server as forward-proxy import service
* http connect tunnel over iWebPP.io STUN session as forward-proxy export service
* secure p2p proxy tunnel
* high udp data transfer performance

### Install
* npm install forward-proxy, or git clone https://github.com/InstantWebP2P/forward-proxy.git && cd forward-proxy && npm install
* forward-proxy depend on node-httpp, please npm install httpp-binary.if the binary didn't work, just build it from source:
  https://github.com/InstantWebP2P/node-httpp

### Usage/API
* for export service, refer to demo/export.js. to start it, just node demo/export.js
* for http proxy server, refer to demo/webproxy.js. to start it, just node demo/webproxy.js
* for socks proxy server, refer to demo/socksproxy.js. to start it, just node demo/export.js
* for http/socks server, please fill export service vURL in options.export, when create Proxy instance
* web browser is http proxy / socks proxy client
* after setup export service and start http or socks server, then set web browser proxy settings point to http/socks server
* for forward-proxy util, refer to bin/forward-proxy. to start it, just node bin/forward-proxy --key usrkey(MUST) --http_port xxx --socks_port xxx --export_vurl vURL --enable_export

<br/>
### License

(The MIT License)

Copyright (c) 2012-2013 Tom Zhou(iwebpp@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

