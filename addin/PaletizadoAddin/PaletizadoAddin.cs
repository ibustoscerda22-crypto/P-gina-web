using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Windows.Forms;
using ABB.Robotics.Math;
using ABB.Robotics.RobotStudio;
using ABB.Robotics.RobotStudio.Environment;
using ABB.Robotics.RobotStudio.Stations;

namespace PaletizadoAddin
{
    /// <summary>
    /// Añade la pestaña "Paletizado" con el botón "Crear celda", que lee estacion.txt
    /// (generado por generador/generar.py) y crea conveyor, pallet, caja, garra y pallet lleno
    /// en la estación activa. Se puede ejecutar varias veces: reemplaza las piezas existentes.
    /// </summary>
    public class Addin
    {
        // RobotStudio llama a este método al cargar el add-in.
        public static void AddinMain()
        {
            RibbonTab tab = new RibbonTab("Paletizado.Tab", "Paletizado");
            UIEnvironment.RibbonTabs.Add(tab);
            RibbonGroup group = new RibbonGroup("Paletizado.Grupo", "Celda");
            tab.Groups.Add(group);

            CommandBarButton boton = new CommandBarButton("Paletizado.Crear", "Crear celda");
            boton.HelpText = "Crea la geometría de la celda desde estacion.txt";
            boton.DefaultEnabled = true;
            boton.ExecuteCommand += (s, e) => CrearCelda();
            group.Controls.Add(boton);
        }

        static void CrearCelda()
        {
            Station station = Project.ActiveProject as Station;
            if (station == null)
            {
                Log("Abre o crea primero una estación con el robot (Archivo > Nuevo > Estación vacía o Solución con estación).");
                return;
            }

            string ruta;
            using (OpenFileDialog dlg = new OpenFileDialog())
            {
                dlg.Title = "Selecciona estacion.txt";
                dlg.Filter = "Celda de paletizado (estacion.txt)|*.txt";
                if (dlg.ShowDialog() != DialogResult.OK) return;
                ruta = dlg.FileName;
            }

            List<DefParte> partes = Leer(ruta);
            Project.UndoContext.BeginUndoStep("Crear celda de paletizado");
            try
            {
                foreach (DefParte def in partes)
                {
                    Borrar(station, def.Nombre);
                    Part part = new Part();
                    part.Name = def.Nombre;
                    foreach (double[] b in def.Cajas)
                    {
                        // estacion.txt está en mm; la API de RobotStudio trabaja en metros
                        Body body = Body.CreateSolidBox(
                            new Matrix4(new Vector3(b[0] / 1000, b[1] / 1000, b[2] / 1000)),
                            new Vector3(b[3] / 1000, b[4] / 1000, b[5] / 1000));
                        body.Name = def.Nombre + "_" + part.Bodies.Count;
                        part.Bodies.Add(body);
                    }
                    station.GraphicComponents.Add(part);
                    part.Transform.Matrix = new Matrix4(new Vector3(def.X / 1000, def.Y / 1000, def.Z / 1000));
                    part.Color = def.Color;
                    part.Visible = !def.Oculto;
                }
                Log("Celda creada desde " + ruta + " (" + partes.Count + " piezas). Siguiente paso: une la Garra al robot y carga MPaletizado.mod.");
            }
            catch (Exception ex)
            {
                Log("Error creando la celda: " + ex.Message);
            }
            finally
            {
                Project.UndoContext.EndUndoStep();
            }
        }

        static void Borrar(Station station, string nombre)
        {
            List<GraphicComponent> aBorrar = new List<GraphicComponent>();
            foreach (GraphicComponent gc in station.GraphicComponents)
                if (gc.Name == nombre) aBorrar.Add(gc);
            foreach (GraphicComponent gc in aBorrar)
                station.GraphicComponents.Remove(gc);
        }

        class DefParte
        {
            public string Nombre;
            public Color Color;
            public double X, Y, Z;
            public bool Oculto;
            public List<double[]> Cajas = new List<double[]>();
        }

        static List<DefParte> Leer(string ruta)
        {
            CultureInfo inv = CultureInfo.InvariantCulture;
            List<DefParte> partes = new List<DefParte>();
            DefParte actual = null;
            foreach (string linea in File.ReadAllLines(ruta))
            {
                string[] t = linea.Trim().Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                if (t.Length == 0 || t[0].StartsWith("#")) continue;
                if (t[0] == "PART" && t.Length >= 9)
                {
                    actual = new DefParte
                    {
                        Nombre = t[1],
                        Color = Color.FromArgb(int.Parse(t[2]), int.Parse(t[3]), int.Parse(t[4])),
                        X = double.Parse(t[5], inv),
                        Y = double.Parse(t[6], inv),
                        Z = double.Parse(t[7], inv),
                        Oculto = t[8] == "1",
                    };
                    partes.Add(actual);
                }
                else if (t[0] == "BOX" && t.Length >= 7 && actual != null)
                {
                    double[] b = new double[6];
                    for (int i = 0; i < 6; i++) b[i] = double.Parse(t[i + 1], inv);
                    actual.Cajas.Add(b);
                }
            }
            return partes;
        }

        static void Log(string texto)
        {
            Logger.AddMessage(new LogMessage("[Paletizado] " + texto));
        }
    }
}
