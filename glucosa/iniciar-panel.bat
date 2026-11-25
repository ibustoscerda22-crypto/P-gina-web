@echo off
title Panel de glucosa
cd /d "%~dp0"
if not exist node_modules call npm install
echo Panel en http://localhost:3100  (no cierres esta ventana)
call npm start
pause
