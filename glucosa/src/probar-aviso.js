// "npm run probar-aviso": manda un aviso de prueba al celular.
import "dotenv/config";
import { Alerter } from "./alerts.js";

const a = new Alerter();
if (!a.enabled) {
  console.log("Falta NTFY_TEMA en el .env. Revisa el README (sección Avisos).");
  process.exit(1);
}
try {
  await a.send({ title: "Prueba de aviso de glucosa", message: `Si ves esto, los avisos funcionan (bajo ${a.low} / alto ${a.high}).`, priority: 4, tags: ["bell"] });
  console.log(`✓ Aviso enviado al tema "${a.topic}". Debería llegar a tu celular en segundos.`);
} catch (err) {
  console.log(`✗ No se pudo enviar: ${err.message}`);
  process.exit(1);
}
