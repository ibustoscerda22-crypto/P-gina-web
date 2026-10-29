#!/usr/bin/env node
// Genera los archivos de una celda desde la línea de comandos (Node 18+, sin dependencias).
// Usa el mismo generador que la página web (web/generador.js).
//
//   node generador/generar.mjs celdas/mi_celda.json [--salida salida]
//
// Escribe en salida/<nombre>/: MPaletizado.mod, EIO_paletizado.cfg, estacion.txt,
// resumen.md y vista_previa.html (vista 3D que se abre con doble clic).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generarTodo } from "../web/generador.js";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const iSal = args.indexOf("--salida");
const salida = iSal >= 0 ? args.splice(iSal, 2)[1] : join(raiz, "salida");
if (args.length !== 1) {
  console.error("Uso: node generador/generar.mjs celdas/mi_celda.json [--salida salida]");
  process.exit(1);
}

const spec = JSON.parse(readFileSync(args[0], "utf-8"));
let r;
try {
  r = generarTodo(spec);
} catch (e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
const dest = join(salida, spec.nombre);
mkdirSync(dest, { recursive: true });
for (const [nombre, contenido] of Object.entries(r.archivos)) writeFileSync(join(dest, nombre), contenido);

// vista_previa.html autónoma: los módulos ES no se pueden importar desde file://, así que
// se incrusta vista3d.js dentro de la página.
const vista3d = readFileSync(join(raiz, "web", "vista3d.js"), "utf-8").replace(/^export /gm, "");
const html = readFileSync(join(raiz, "generador", "vista_previa_plantilla.html"), "utf-8")
  .replace("/*__VISTA3D__*/", () => vista3d)
  .replace("/*__DATOS__*/null", () => JSON.stringify(r.vista));
writeFileSync(join(dest, "vista_previa.html"), html);

console.log(r.archivos["resumen.md"]);
console.log(`Archivos generados en ${dest}`);
