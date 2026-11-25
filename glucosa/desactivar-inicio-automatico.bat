@echo off
rem Quita el inicio automatico y detiene el panel que corre oculto.
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Panel glucosa.lnk" 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*iniciar-panel.bat*oculto*' -or $_.CommandLine -like '*src\server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Inicio automatico desactivado y panel detenido.
pause
