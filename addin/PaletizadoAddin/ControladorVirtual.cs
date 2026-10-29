using System;
using System.Collections.Generic;
using ABB.Robotics.Controllers;
using ABB.Robotics.Controllers.Discovery;
using ABB.Robotics.Controllers.IOSystemDomain;
using ABB.Robotics.Controllers.RapidDomain;
using PcController = ABB.Robotics.Controllers.Controller;
using RapidTask = ABB.Robotics.Controllers.RapidDomain.Task;

namespace PaletizadoAddin
{
    /// <summary>Carga el módulo RAPID en el controlador virtual de la estación (PC SDK).</summary>
    public static class ControladorVirtual
    {
        public static void CargarModulo(string rutaModulo, string nombreRobot, List<string> log)
        {
            NetworkScanner scanner = new NetworkScanner();
            scanner.Scan();
            ControllerInfoCollection virtuales = scanner.GetControllers(NetworkScannerSearchCriterias.Virtual);
            if (virtuales.Count == 0)
                throw new InvalidOperationException("No hay ningún controlador virtual en marcha. La estación base necesita un controlador (Solución con estación y controlador).");

            ControllerInfo info = virtuales[0];
            if (virtuales.Count > 1 && nombreRobot != null)
                foreach (ControllerInfo ci in virtuales)
                    if (nombreRobot.IndexOf(ci.SystemName, StringComparison.OrdinalIgnoreCase) >= 0 ||
                        ci.SystemName.IndexOf(Digitos(nombreRobot), StringComparison.OrdinalIgnoreCase) >= 0)
                    { info = ci; break; }
            log.Add("Controlador virtual: " + info.SystemName);

            using (PcController c = PcController.Connect(info, ConnectionType.Standalone))
            {
                c.Logon(UserInfo.DefaultUser);
                try
                {
                    foreach (string s in new[] { "doVacuum", "doNewBox" })
                        if (c.IOSystem.GetSignal(s) == null)
                            log.Add("AVISO: falta la señal " + s + ". Carga EIO_paletizado.cfg en el controlador (ver README).");

                    c.FileSystem.PutFile(rutaModulo, "MPaletizado.mod", true);
                    string remoto = c.FileSystem.RemoteDirectory + "/MPaletizado.mod";
                    using (Mastership.Request(c.Rapid))
                    {
                        RapidTask tarea = c.Rapid.GetTask("T_ROB1");
                        tarea.LoadModuleFromFile(remoto, RapidLoadMode.Replace);
                        tarea.ResetProgramPointer();
                    }
                    log.Add("Módulo MPaletizado cargado en T_ROB1 y puntero de programa en main.");
                }
                finally
                {
                    c.Logoff();
                }
            }
        }

        static string Digitos(string s)
        {
            // "IRB460_110_240__01" -> "460"
            int i = 0;
            while (i < s.Length && !char.IsDigit(s[i])) i++;
            int j = i;
            while (j < s.Length && char.IsDigit(s[j])) j++;
            return j > i ? s.Substring(i, j - i) : s;
        }
    }
}
