@echo off
rem Inicia el panel de glucosa y lo reinicia solo si se cae.
rem Con doble clic se ve la ventana; al arrancar Windows se ejecuta oculto (registro en data\panel.log).
title Panel de glucosa
cd /d "%~dp0"
if not exist data mkdir data
if not exist node_modules call npm install
:loop
if /i "%~1"=="oculto" (
  node src\server.js >> data\panel.log 2>&1
) else (
  echo Panel en http://localhost:3100  (no cierres esta ventana)
  node src\server.js
)
if %errorlevel%==3 goto fin
echo El panel se detuvo. Reiniciando en 15 segundos...
timeout /t 15 /nobreak >nul
goto loop
:fin
if /i not "%~1"=="oculto" pause
