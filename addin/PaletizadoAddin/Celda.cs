using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Reflection;
using ABB.Robotics.Math;
using ABB.Robotics.RobotStudio;
using ABB.Robotics.RobotStudio.Stations;

namespace PaletizadoAddin
{
    /// <summary>
    /// Construye o actualiza la geometría de la celda en la estación activa a partir del texto
    /// de estacion.txt. Se puede ejecutar muchas veces sobre la misma estación:
    ///  - "Caja" se actualiza en su sitio (el Smart Component Source apunta a ella).
    ///  - "Garra" solo se crea si no existe (normalmente ya está unida al robot).
    ///  - El resto de piezas se borra y se vuelve a crear.
    /// Debe llamarse desde el hilo de interfaz de RobotStudio.
    /// </summary>
    public static class Celda
    {
        static readonly HashSet<string> SoloSiNoExiste = new HashSet<string> { "Garra" };
        static readonly HashSet<string> ActualizarEnSitio = new HashSet<string> { "Caja" };

        class DefParte
        {
            public string Nombre;
            public Color Color;
            public double X, Y, Z;
            public bool Oculto;
            public List<double[]> Cajas = new List<double[]>();
        }

        public static Station EstacionActiva()
        {
            return Project.ActiveProject as Station;
        }

        /// <summary>Devuelve el nombre del robot de la estación (o null si no hay).</summary>
        public static string NombreRobot(Station station)
        {
            foreach (GraphicComponent gc in station.GraphicComponents)
                if (gc is Mechanism m && m.MechanismType == MechanismType.Robot) return m.Name;
            return null;
        }

        /// <summary>Crea o actualiza la geometría. Devuelve el número de piezas procesadas.</summary>
        public static int Construir(string texto)
        {
            Station station = EstacionActiva();
            if (station == null)
                throw new InvalidOperationException("No hay ninguna estación abierta. Abre la estación base del paletizado.");

            List<DefParte> partes = Leer(texto);
            Project.UndoContext.BeginUndoStep("Celda de paletizado");
            try
            {
                foreach (DefParte def in partes)
                {
                    Part existente = Buscar(station, def.Nombre);
                    if (existente != null && SoloSiNoExiste.Contains(def.Nombre)) continue;

                    Part part;
                    if (existente != null && ActualizarEnSitio.Contains(def.Nombre))
                    {
                        part = existente;
                        List<Body> viejos = new List<Body>();
                        foreach (Body b in part.Bodies) viejos.Add(b);
                        foreach (Body b in viejos) part.Bodies.Remove(b);
                    }
                    else
                    {
                        if (existente != null) station.GraphicComponents.Remove(existente);
                        part = new Part();
                        part.Name = def.Nombre;
                        station.GraphicComponents.Add(part);
                    }
                    foreach (double[] b in def.Cajas)
                    {
                        // estacion.txt está en mm; la API de RobotStudio trabaja en metros
                        Body body = Body.CreateSolidBox(
                            new Matrix4(new Vector3(b[0] / 1000, b[1] / 1000, b[2] / 1000)),
                            new Vector3(b[3] / 1000, b[4] / 1000, b[5] / 1000));
                        body.Name = def.Nombre + "_" + part.Bodies.Count;
                        part.Bodies.Add(body);
                    }
                    part.Transform.Matrix = new Matrix4(new Vector3(def.X / 1000, def.Y / 1000, def.Z / 1000));
                    part.Color = def.Color;
                    part.Visible = !def.Oculto;
                }
            }
            finally
            {
                Project.UndoContext.EndUndoStep();
            }
            return partes.Count;
        }

        /// <summary>
        /// Busca una pieza por nombre en la raíz de la estación y, si la API lo permite,
        /// también dentro de otros objetos (una garra unida al robot cuelga de él).
        /// </summary>
        static Part Buscar(Station station, string nombre)
        {
            foreach (GraphicComponent gc in station.GraphicComponents)
                if (gc.Name == nombre && gc is Part p) return p;
            try
            {
                MethodInfo find = station.GetType().GetMethod("FindObjects",
                    new[] { typeof(Predicate<ProjectObject>), typeof(Predicate<ProjectObject>) });
                if (find != null)
                {
                    Predicate<ProjectObject> esParte = o => o is Part && o.Name == nombre;
                    Predicate<ProjectObject> todo = o => true;
                    if (find.Invoke(station, new object[] { esParte, todo }) is System.Collections.IEnumerable r)
                        foreach (object o in r) return (Part)o;
                }
            }
            catch (Exception) { /* sin búsqueda recursiva: basta con la raíz */ }
            return null;
        }

        static List<DefParte> Leer(string texto)
        {
            CultureInfo inv = CultureInfo.InvariantCulture;
            List<DefParte> partes = new List<DefParte>();
            DefParte actual = null;
            foreach (string linea in texto.Split('\n'))
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
            if (partes.Count == 0) throw new FormatException("estacion.txt no contiene piezas (líneas PART).");
            return partes;
        }

        /// <summary>
        /// Inicia o detiene la simulación. Se usa reflexión porque el nombre del método ha cambiado
        /// entre versiones de RobotStudio (Start / StartAsync, Stop / StopAsync).
        /// </summary>
        public static void Simulacion(string accion)
        {
            Type t = typeof(Simulator);
            foreach (string nombre in new[] { accion, accion + "Async" })
            {
                foreach (MethodInfo m in t.GetMethods(BindingFlags.Public | BindingFlags.Static))
                {
                    if (m.Name != nombre) continue;
                    ParameterInfo[] ps = m.GetParameters();
                    if (!Array.TrueForAll(ps, p => p.IsOptional)) continue;
                    object[] args = new object[ps.Length];
                    for (int i = 0; i < ps.Length; i++) args[i] = Type.Missing;
                    m.Invoke(null, args);
                    return;
                }
            }
            throw new MissingMethodException("Simulator." + accion + " no está disponible en esta versión de RobotStudio.");
        }
    }
}
