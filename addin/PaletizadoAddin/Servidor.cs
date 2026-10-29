using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using ABB.Robotics.RobotStudio.Stations;

namespace PaletizadoAddin
{
    /// <summary>
    /// Servidor HTTP local (solo localhost) que conecta la página web con RobotStudio.
    ///   GET  /                 página (web/index.html incrustada en la DLL)
    ///   GET  /api/estado       {"ok":true,"estacion":"...","robot":"..."}
    ///   POST /api/simular      cuerpo: "#NOMBRE n" y bloques "#ARCHIVO nombre" seguidos de su contenido
    /// </summary>
    public class Servidor
    {
        HttpListener listener;
        static readonly object ocupado = new object();

        public void Iniciar(string url)
        {
            listener = new HttpListener();
            listener.Prefixes.Add(url);
            listener.Start();
            Thread t = new Thread(Bucle) { IsBackground = true, Name = "PaletizadoServidor" };
            t.Start();
        }

        void Bucle()
        {
            while (listener.IsListening)
            {
                HttpListenerContext ctx;
                try { ctx = listener.GetContext(); }
                catch (Exception) { return; }
                ThreadPool.QueueUserWorkItem(_ => Atender(ctx));
            }
        }

        void Atender(HttpListenerContext ctx)
        {
            HttpListenerResponse r = ctx.Response;
            try
            {
                // Permite usar también la página abierta desde un archivo o desde otra dirección.
                r.AddHeader("Access-Control-Allow-Origin", "*");
                r.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                r.AddHeader("Access-Control-Allow-Headers", "Content-Type");
                r.AddHeader("Access-Control-Allow-Private-Network", "true");
                string ruta = ctx.Request.Url.AbsolutePath;
                string metodo = ctx.Request.HttpMethod;

                if (metodo == "OPTIONS") { r.StatusCode = 204; }
                else if (metodo == "GET" && ruta == "/api/estado") Responder(r, Estado());
                else if (metodo == "POST" && ruta == "/api/simular")
                {
                    string cuerpo;
                    using (StreamReader sr = new StreamReader(ctx.Request.InputStream, Encoding.UTF8))
                        cuerpo = sr.ReadToEnd();
                    Responder(r, Simular(cuerpo));
                }
                else if (metodo == "GET") ServirArchivo(r, ruta == "/" ? "/index.html" : ruta);
                else r.StatusCode = 405;
            }
            catch (Exception ex)
            {
                try { r.StatusCode = 500; Escribir(r, Encoding.UTF8.GetBytes(ex.Message), "text/plain; charset=utf-8"); }
                catch (Exception) { }
            }
            finally
            {
                try { r.Close(); } catch (Exception) { }
            }
        }

        static string Estado()
        {
            string estacion = null, robot = null;
            Addin.EnUI(() =>
            {
                Station st = Celda.EstacionActiva();
                if (st != null) { estacion = st.Name; robot = Celda.NombreRobot(st); }
            });
            return "{\"ok\":true,\"estacion\":" + Json(estacion) + ",\"robot\":" + Json(robot) + "}";
        }

        static string Simular(string cuerpo)
        {
            List<string> log = new List<string>();
            if (!Monitor.TryEnter(ocupado))
                return Resultado(false, "Ya hay una simulación preparándose; espera a que termine.", log);
            try
            {
                Dictionary<string, string> archivos = Partir(cuerpo, out string nombre);
                foreach (string req in new[] { "estacion.txt", "MPaletizado.mod" })
                    if (!archivos.ContainsKey(req)) return Resultado(false, "Falta " + req + " en la petición.", log);

                string dir = Path.Combine(Path.GetTempPath(), "Paletizado", nombre);
                Directory.CreateDirectory(dir);
                foreach (KeyValuePair<string, string> a in archivos)
                    File.WriteAllText(Path.Combine(dir, a.Key), a.Value,
                        a.Key.EndsWith(".mod") ? Encoding.ASCII : new UTF8Encoding(false));
                log.Add("Celda " + nombre + " guardada en " + dir);

                // 1. Geometría (hilo de interfaz)
                string robot = null;
                Exception error = null;
                Addin.EnUI(() =>
                {
                    try
                    {
                        Station st = Celda.EstacionActiva();
                        if (st == null) throw new InvalidOperationException("No hay ninguna estación abierta en RobotStudio. Abre la estación base del paletizado.");
                        try { Celda.Simulacion("Stop"); } catch (Exception) { /* no estaba en marcha */ }
                        robot = Celda.NombreRobot(st);
                        int n = Celda.Construir(archivos["estacion.txt"]);
                        log.Add("Geometría actualizada en la estación " + st.Name + " (" + n + " piezas).");
                    }
                    catch (Exception ex) { error = ex; }
                });
                if (error != null) return Resultado(false, error.Message, log);

                if (robot == null) log.Add("AVISO: la estación no tiene robot.");
                else if (archivos.TryGetValue("estacion.txt", out string est))
                {
                    Match m = Regex.Match(est, @"^ROBOT IRB\s*(\d+)", RegexOptions.Multiline);
                    if (m.Success && robot.IndexOf(m.Groups[1].Value, StringComparison.Ordinal) < 0)
                        log.Add("AVISO: la celda es para IRB " + m.Groups[1].Value + " pero el robot de la estación es " + robot + ". Usa una estación base con ese robot.");
                }

                // 2. RAPID en el controlador virtual (fuera del hilo de interfaz)
                try
                {
                    ControladorVirtual.CargarModulo(Path.Combine(dir, "MPaletizado.mod"), robot, log);
                }
                catch (Exception ex)
                {
                    return Resultado(false, "No se pudo cargar el RAPID: " + ex.Message +
                        ". Puedes cargarlo a mano (RAPID > T_ROB1 > Cargar módulo) desde " + dir, log);
                }

                // 3. Simulación
                Addin.EnUI(() =>
                {
                    try { Celda.Simulacion("Start"); log.Add("Simulación en marcha."); }
                    catch (Exception ex) { error = ex; }
                });
                if (error != null)
                    return Resultado(false, "Celda y RAPID listos, pero no se pudo iniciar la simulación: " +
                        (error.InnerException ?? error).Message + ". Pulsa Reproducir en la pestaña Simulación.", log);

                foreach (string l in log) Addin.Log(l);
                return Resultado(true, null, log);
            }
            catch (Exception ex)
            {
                return Resultado(false, ex.Message, log);
            }
            finally
            {
                Monitor.Exit(ocupado);
            }
        }

        static Dictionary<string, string> Partir(string cuerpo, out string nombre)
        {
            nombre = "celda";
            Dictionary<string, string> archivos = new Dictionary<string, string>();
            string actual = null;
            StringBuilder sb = new StringBuilder();
            foreach (string linea in cuerpo.Replace("\r\n", "\n").Split('\n'))
            {
                if (linea.StartsWith("#NOMBRE "))
                {
                    nombre = Regex.Replace(linea.Substring(8).Trim(), @"[^A-Za-z0-9_.\-]", "_");
                    if (nombre.Length == 0 || nombre.StartsWith(".")) nombre = "celda";
                }
                else if (linea.StartsWith("#ARCHIVO "))
                {
                    if (actual != null) archivos[actual] = sb.ToString();
                    actual = Path.GetFileName(linea.Substring(9).Trim());
                    sb.Clear();
                }
                else if (actual != null) sb.Append(linea).Append("\r\n");
            }
            if (actual != null) archivos[actual] = sb.ToString();
            return archivos;
        }

        static void ServirArchivo(HttpListenerResponse r, string ruta)
        {
            string nombre = "web/" + ruta.TrimStart('/');
            using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(nombre))
            {
                if (s == null) { r.StatusCode = 404; return; }
                MemoryStream ms = new MemoryStream();
                s.CopyTo(ms);
                string tipo = nombre.EndsWith(".js") ? "application/javascript; charset=utf-8" : "text/html; charset=utf-8";
                Escribir(r, ms.ToArray(), tipo);
            }
        }

        static void Responder(HttpListenerResponse r, string json)
        {
            Escribir(r, Encoding.UTF8.GetBytes(json), "application/json; charset=utf-8");
        }

        static void Escribir(HttpListenerResponse r, byte[] datos, string tipo)
        {
            r.ContentType = tipo;
            r.AddHeader("Cache-Control", "no-store");
            r.ContentLength64 = datos.Length;
            r.OutputStream.Write(datos, 0, datos.Length);
        }

        static string Resultado(bool ok, string error, List<string> log)
        {
            StringBuilder sb = new StringBuilder("{\"ok\":").Append(ok ? "true" : "false");
            sb.Append(",\"error\":").Append(Json(error)).Append(",\"log\":[");
            for (int i = 0; i < log.Count; i++) sb.Append(i > 0 ? "," : "").Append(Json(log[i]));
            return sb.Append("]}").ToString();
        }

        static string Json(string s)
        {
            if (s == null) return "null";
            StringBuilder sb = new StringBuilder("\"");
            foreach (char c in s)
            {
                if (c == '"' || c == '\\') sb.Append('\\').Append(c);
                else if (c < 0x20) sb.AppendFormat("\\u{0:x4}", (int)c);
                else sb.Append(c);
            }
            return sb.Append('"').ToString();
        }
    }
}
