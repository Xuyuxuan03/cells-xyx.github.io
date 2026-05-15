@echo off
cd /d "%~dp0.."
"D:\nodejs\node.exe" scripts\serve-dist.mjs > server.log 2>&1
