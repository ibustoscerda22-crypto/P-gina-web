using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using ABB.Robotics.RobotStudio;
using ABB.Robotics.RobotStudio.Environment;

namespace PaletizadoAddin
{
    /// <summary>
    /// Punto de entrada. Añade la pestaña "Paletizado" y arranca el servidor local que conecta
    /// la página web con RobotStudio.
    /// </summary>
    public class Addin
    {
        public const string Url = "http://localhost:8765/";

        // Control oculto para ejecutar código en el hilo de interfaz de RobotStudio:
        // la API de estaciones solo se puede usar desde ese hilo.
        static Control ui;
        static Servidor servidor;

        // RobotStudio llama a este método al cargar el add-in.
        public static void AddinMain()
        {
            ui = new Control();
            ui.CreateControl();
            IntPtr _ = ui.Handle;

            RibbonTab tab = new RibbonTab("Paletizado.Tab", "Paletizado");
            UIEnvironment.RibbonTabs.Add(tab);
            RibbonGroup group = new RibbonGroup("Paletizado.Grupo", "Celda");
            tab.Groups.Add(group);

            CommandBarButton abrir = new CommandBarButton("Paletizado.Abrir", "Abrir página");
            abrir.HelpText = "Abre la página para describir la celda y simularla";
            abrir.DefaultEnabled = true;
            abrir.ExecuteCommand += (s, e) => AbrirPagina();
            group.Controls.Add(abrir);

            CommandBarButton crear = new CommandBarButton("Paletizado.Crear", "Crear celda desde archivo");
            crear.HelpText = "Crea la geometría de la celda desde un estacion.txt generado";
            crear.DefaultEnabled = true;
            crear.ExecuteCommand += (s, e) => CrearDesdeArchivo();
            group.Controls.Add(crear);

            try
            {
                servidor = new Servidor();
                servidor.Iniciar(Url);
                Log("Página de paletizado disponible en " + Url);
            }
            catch (Exception ex)
            {
                Log("No se pudo iniciar el servidor en " + Url + ": " + ex.Message);
            }
        }

        static void AbrirPagina()
        {
            try { Process.Start(new ProcessStartInfo(Url) { UseShellExecute = true }); }
            catch (Exception ex) { Log("No se pudo abrir el navegador: " + ex.Message + ". Abre " + Url + " a mano."); }
        }

        static void CrearDesdeArchivo()
        {
            using (OpenFileDialog dlg = new OpenFileDialog())
            {
                dlg.Title = "Selecciona estacion.txt";
                dlg.Filter = "Celda de paletizado (estacion.txt)|*.txt";
                if (dlg.ShowDialog() != DialogResult.OK) return;
                try
                {
                    int n = Celda.Construir(File.ReadAllText(dlg.FileName));
                    Log("Celda creada desde " + dlg.FileName + " (" + n + " piezas).");
                }
                catch (Exception ex)
                {
                    Log("Error creando la celda: " + ex.Message);
                }
            }
        }

        /// <summary>Ejecuta una acción en el hilo de interfaz y espera a que termine.</summary>
        public static void EnUI(Action accion)
        {
            if (ui.InvokeRequired) ui.Invoke(accion);
            else accion();
        }

        public static void Log(string texto)
        {
            Action a = () => Logger.AddMessage(new LogMessage("[Paletizado] " + texto));
            if (ui != null && ui.InvokeRequired) ui.BeginInvoke(a);
            else a();
        }
    }
}
