' Abre el panel de glucosa sin ventana (lo usa el inicio automatico de Windows).
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c iniciar-panel.bat oculto", 0, False
