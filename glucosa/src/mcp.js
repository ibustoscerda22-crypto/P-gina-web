// Servidor MCP (stdio) para que Claude u otro asistente consulte la glucemia.
// Comparte el historial (data/readings.json) con el panel.

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Monitor } from "./monitor.js";
import { summarize, byDay, lowEpisodes, dayKey, TZ } from "./stats.js";

// Carga el .env de la carpeta del proyecto aunque Claude lance el proceso desde otro lugar.
// quiet: dotenv no debe escribir en stdout, que es el canal del protocolo MCP.
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env"), quiet: true });

const monitor = new Monitor();
const fmtTime = (t) => new Date(t).toLocaleString("es-CL", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
const json = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });
const fail = (err) => ({ content: [{ type: "text", text: `Error: ${err.message}` }], isError: true });

// Antes de responder sobre el historial, intenta traer lo más reciente.
async function freshRange(from, to = Date.now()) {
  try {
    await monitor.getNow(5 * 60_000);
  } catch {
    /* si LibreLinkUp falla, se responde con lo guardado */
  }
  return monitor.store.range(from, to);
}

const server = new McpServer({ name: "glucosa-libre", version: "1.0.0" });

server.registerTool(
  "glucosa_actual",
  {
    title: "Glucosa actual",
    description: "Lectura más reciente del sensor FreeStyle Libre en mg/dL, con flecha de tendencia y estado (bajo, en rango, alto).",
    inputSchema: {},
  },
  async () => {
    try {
      const now = await monitor.getNow(60_000);
      return json({ ...now, horaLocal: fmtTime(now.t) });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "historial_glucosa",
  {
    title: "Historial de glucosa",
    description: "Lecturas de las últimas N horas (máximo 14 días). Útil para ver la curva de la noche, después de comer, etc.",
    inputSchema: { horas: z.number().min(1).max(336).default(12).describe("Cuántas horas hacia atrás") },
  },
  async ({ horas }) => {
    const rs = await freshRange(Date.now() - horas * 3_600_000);
    return json({ zonaHoraria: TZ, lecturas: rs.map((r) => ({ hora: fmtTime(r.t), mgdl: r.mgdl })) });
  }
);

server.registerTool(
  "resumen_dia",
  {
    title: "Resumen de un día",
    description: "Promedio, mínimo, máximo, variabilidad, tiempo en rango e hipoglucemias de un día concreto (por defecto, hoy).",
    inputSchema: { fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha AAAA-MM-DD; por defecto hoy") },
  },
  async ({ fecha }) => {
    const dia = fecha ?? dayKey(Date.now());
    const center = new Date(`${dia}T12:00:00Z`).getTime();
    const rs = (await freshRange(center - 36 * 3_600_000, center + 36 * 3_600_000)).filter((r) => dayKey(r.t) === dia);
    if (!rs.length) return json({ dia, mensaje: "No hay lecturas guardadas para ese día. El panel debe estar corriendo para acumular historial." });
    return json({
      dia,
      limites: monitor.lim,
      resumen: summarize(rs, monitor.lim),
      hipoglucemias: lowEpisodes(rs, monitor.lim).map((e) => ({ desde: fmtTime(e.inicio), hasta: fmtTime(e.fin), minimo: e.minimo })),
    });
  }
);

server.registerTool(
  "resumen_periodo",
  {
    title: "Resumen de varios días",
    description: "Métricas de los últimos N días (tiempo en rango, GMI/HbA1c estimada, CV) y el detalle día por día.",
    inputSchema: { dias: z.number().int().min(1).max(90).default(14) },
  },
  async ({ dias }) => {
    const rs = await freshRange(Date.now() - dias * 86_400_000);
    if (!rs.length) return json({ mensaje: "Todavía no hay historial guardado." });
    return json({ limites: monitor.lim, periodo: summarize(rs, monitor.lim), porDia: byDay(rs) });
  }
);

await server.connect(new StdioServerTransport());
