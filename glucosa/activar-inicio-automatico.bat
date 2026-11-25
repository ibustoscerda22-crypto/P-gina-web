@echo off
rem Hace que el panel se abra solo (oculto) cada vez que enciendes el PC e inicias sesion.
cd /d "%~dp0"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Panel glucosa.lnk'); $s.TargetPath='%~dp0iniciar-oculto.vbs'; $s.WorkingDirectory='%~dp0'; $s.Save()"
if errorlevel 1 (echo No se pudo activar. & pause & exit /b 1)
echo Listo: el panel se abrira solo al encender el PC.
echo Para iniciarlo ahora sin reiniciar, se abre en segundo plano...
wscript "%~dp0iniciar-oculto.vbs"
echo Abre http://localhost:3100 en unos segundos.
pause
