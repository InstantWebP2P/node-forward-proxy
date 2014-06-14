@ECHO off
title Starting forward-proxy import service

ECHO Starting import service ...
.\bin\node.exe .\bin\forward-proxy --key unlockcn --http_port 51866 --socks_port 51888 --turnon_timer
ECHO Done