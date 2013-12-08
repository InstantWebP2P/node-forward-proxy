@ECHO off
title Starting forward-proxy export service

ECHO Starting export service ...
.\bin\node.exe .\bin\forward-proxy --key unlockcn --enable_export --turnon_timer
ECHO Done
