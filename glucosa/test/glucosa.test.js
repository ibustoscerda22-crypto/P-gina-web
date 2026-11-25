import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseLibreDate, LibreLinkUpClient } from "../src/libre.js";
import { summarize, lowEpisodes } from "../src/stats.js";
import { Store } from "../src/store.js";

test("parseLibreDate interpreta el formato de LibreLinkUp en UTC", () => {
  assert.equal(parseLibreDate("11/25/2026 4:05:31 PM").toISOString(), "2026-11-25T16:05:31.000Z");
  assert.equal(parseLibreDate("1/2/2026 12:00:00 AM").toISOString(), "2026-01-02T00:00:00.000Z");
  assert.equal(parseLibreDate("1/2/2026 12:30:00 PM").toISOString(), "2026-01-02T12:30:00.000Z");
});

test("summarize calcula tiempo en rango y GMI", () => {
  const rs = [50, 65, 100, 120, 150, 200, 300].map((mgdl, i) => ({ t: i, mgdl }));
  const s = summarize(rs);
  assert.equal(s.lecturas, 7);
  assert.equal(s.muyBajo, 14.3);
  assert.equal(s.bajo, 14.3);
  assert.equal(s.enRango, 42.9);
  assert.equal(s.alto, 14.3);
  assert.equal(s.muyAlto, 14.3);
  assert.equal(s.promedio, 141);
  assert.equal(s.gmi, 6.7);
  assert.equal(summarize([]), null);
});

test("lowEpisodes detecta hipoglucemias de 15 min o más", () => {
  const m = 60_000;
  const rs = [100, 65, 62, 60, 90, 68, 100].map((mgdl, i) => ({ t: i * 5 * m, mgdl }));
  const eps = lowEpisodes(rs);
  assert.equal(eps.length, 1); // la de 68 dura 0 min y no baja de 54
  assert.equal(eps[0].minimo, 60);
});

test("Store no duplica lecturas y persiste en disco", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "glu-")), "r.json");
  const s = new Store(file);
  const t = Date.now() - 60_000;
  assert.equal(s.add([{ t, mgdl: 100 }, { t: t + 20_000, mgdl: 101 }]), 1);
  assert.equal(new Store(file).range(0).length, 1);
});

test("cliente: redirección de región, Account-Id y lectura", async () => {
  const seen = [];
  const srv = http.createServer((req, res) => {
    seen.push({ url: req.url, h: req.headers });
    const send = (o) => res.end(JSON.stringify(o));
    if (req.url === "/llu/auth/login") return send({ status: 0, data: { redirect: true, region: "eu" } });
    if (req.url === "/eu/llu/auth/login")
      return send({ status: 0, data: { user: { id: "user-1" }, authTicket: { token: "tok", expires: Date.now() / 1000 + 3600 } } });
    if (req.url === "/eu/llu/connections") return send({ status: 0, data: [{ patientId: "p1" }] });
    if (req.url === "/eu/llu/connections/p1/graph")
      return send({
        status: 0,
        data: {
          connection: { glucoseMeasurement: { FactoryTimestamp: "11/25/2026 4:05:31 PM", ValueInMgPerDl: 112, TrendArrow: 4 } },
          graphData: [{ FactoryTimestamp: "11/25/2026 3:50:31 PM", ValueInMgPerDl: 105 }],
        },
      });
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const c = new LibreLinkUpClient({ email: "a@b.c", password: "x", baseUrl: base });
    c.base = base; // primer login va a la raíz, luego redirige a /eu
    const g = await c.fetchGraph();
    assert.deepEqual(g.current, { t: Date.UTC(2026, 10, 25, 16, 5, 31), mgdl: 112, trend: 4 });
    assert.equal(g.history.length, 1);
    const graphReq = seen.find((s) => s.url.endsWith("/graph"));
    assert.equal(graphReq.h.authorization, "Bearer tok");
    assert.equal(graphReq.h["account-id"], crypto.createHash("sha256").update("user-1").digest("hex"));
    assert.equal(graphReq.h.product, "llu.android");
  } finally {
    srv.close();
  }
});

test("cliente: explica el error y no reintenta el login de inmediato", async () => {
  let logins = 0;
  const srv = http.createServer((req, res) => {
    logins++;
    res.end(JSON.stringify({ status: 7, error: { message: "Algo raro" }, data: {} }));
  });
  await new Promise((r) => srv.listen(0, r));
  try {
    const c = new LibreLinkUpClient({ email: "a@b.c", password: "x", baseUrl: `http://127.0.0.1:${srv.address().port}` });
    await assert.rejects(c.fetchGraph(), /estado 7; mensaje "Algo raro"/);
    await assert.rejects(c.fetchGraph(), /estado 7/);
    assert.equal(logins, 1);
  } finally {
    srv.close();
  }
});

test("avisos: bajo 50 urgente, repite cada 10 min, alto 250, vuelta a rango", async () => {
  const { Alerter } = await import("../src/alerts.js");
  const sent = [];
  const srv = http.createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => { sent.push(JSON.parse(b)); res.end("{}"); });
  });
  await new Promise((r) => srv.listen(0, r));
  try {
    const a = new Alerter({ NTFY_TEMA: "t", NTFY_SERVIDOR: `http://127.0.0.1:${srv.address().port}` });
    const r = (mgdl, haceMinutos = 1) => ({ mgdl, haceMinutos, tendencia: { arrow: "↓", label: "bajando" } });
    const T = 1_000_000_000;
    assert.equal(await a.check(r(120), T), null);
    assert.match((await a.check(r(48), T)).title, /BAJA: 48/);
    assert.equal(await a.check(r(45), T + 5 * 60_000), null); // no repite antes de 10 min
    assert.ok(await a.check(r(44), T + 11 * 60_000));
    assert.match((await a.check(r(90), T + 12 * 60_000)).title, /De vuelta en rango/);
    assert.equal(await a.check(r(250), T + 13 * 60_000), null); // 250 justo no es "sobre 250"
    assert.match((await a.check(r(260), T + 14 * 60_000)).title, /alta: 260/);
    assert.match((await a.check(r(260, 40), T + 50 * 60_000)).title, /Sin datos/);
    assert.equal(sent[0].topic, "t");
    assert.equal(sent[0].priority, 5);
    assert.equal(sent.length, 5);
  } finally {
    srv.close();
  }
});
