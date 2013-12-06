1. Open cmd window: Start->Run->CMD, then cd to forward-proxy directory

2. Start export service: .\bin\node.exe .\bin\forward-proxy --key unlockcn --enable_export --turnon_timer

3. Start import service: .\bin\node.exe .\bin\forward-proxy --key unlockcn --http_port 51866 --socks_port 51888 --turnon_timer

4. Then, set web browser proxy settings point to import service's http proxy srever(127.0.0.1:51866) or socks proxy server(127.0.0.1:51888)

5. To set web browser proxy settings, just google "how to set browser proxy setting"

Notes: 
  For item 2 above, it's for run an export service. Normally, you don't need start it.
  If you have computers or friends in China, it's appreciated you and your friends running an export service for others.

