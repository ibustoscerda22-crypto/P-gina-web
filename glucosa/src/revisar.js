// Muestra qué credenciales está leyendo el panel, sin revelar la contraseña.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(dir, ".env");
console.log(`Carpeta: ${dir}`);
if (!fs.existsSync(envFile)) {
  const txt = fs.existsSync(envFile + ".txt");
  console.log(txt ? "✗ El archivo se llama '.env.txt'. Renómbralo a '.env' (sin .txt)." : "✗ No existe el archivo .env en esta carpeta.");
  process.exit(1);
}
const env = dotenv.parse(fs.readFileSync(envFile));
const email = env.LIBRE_EMAIL ?? "";
const pass = env.LIBRE_PASSWORD ?? "";
console.log(`Correo leído:      "${email}"`);
console.log(`Contraseña leída:  ${pass ? `${pass[0]}${"•".repeat(Math.max(0, pass.length - 2))}${pass.length > 1 ? pass.at(-1) : ""}  (${pass.length} caracteres)` : "(vacía)"}`);
const avisos = [];
if (!email || email.includes("ejemplo.com")) avisos.push("El correo sigue siendo el de ejemplo: edítalo en el .env.");
if (email !== email.trim() || pass !== pass.trim()) avisos.push("Hay espacios al inicio o al final.");
if (/^["']|["']$/.test(pass)) avisos.push("La contraseña quedó con comillas incluidas: revisa que abran y cierren bien.");
if (pass === "tu-contraseña") avisos.push("La contraseña sigue siendo la de ejemplo.");
if (/[A-Z]/.test(email)) avisos.push("El correo tiene mayúsculas; normalmente no importa, pero prueba en minúsculas.");
console.log(avisos.length ? avisos.map((a) => "⚠ " + a).join("\n") : "✓ El formato se ve bien. Si sigue fallando, la contraseña no coincide con la de la app LibreLinkUp.");
