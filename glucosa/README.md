# Mi Glucosa: panel + MCP para FreeStyle Libre

Muestra tu glucemia **al instante** (se actualiza cada minuto) desde tu sensor FreeStyle Libre usando
LibreLinkUp, guarda el historial día a día y deja que Claude lo consulte mediante un servidor **MCP**.

- **Panel/app** (`npm start`): valor actual con color y flecha, curva de 3/6/12/24 h, tiempo en rango de hoy,
  hipoglucemias del día, resumen de 14 días (promedio, HbA1c estimada, variabilidad) y avisos opcionales
  si estás bajo o alto. Se puede instalar en el celular como app (PWA).
- **MCP** (`npm run mcp`): herramientas `glucosa_actual`, `historial_glucosa`, `resumen_dia`, `resumen_periodo`.

> ⚠️ LibreLinkUp no tiene API oficial: Abbott puede cambiarla sin aviso. **Esto no reemplaza las alarmas de la
> app FreeStyle Libre ni sirve para decidir dosis de insulina.**

## 1. Prepara LibreLinkUp (una sola vez)

1. Instala la app **LibreLinkUp** y crea una cuenta. Puede ser otro correo tuyo.
2. En tu app **FreeStyle Libre**: Menú → *Aplicaciones conectadas* → *LibreLinkUp* → agrega ese correo.
3. Acepta la invitación en LibreLinkUp y verifica que ves tu glucosa ahí.

## 2. Instala y corre el panel

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
cd glucosa
npm install
cp .env.example .env     # pon LIBRE_EMAIL y LIBRE_PASSWORD de la cuenta LibreLinkUp
npm start                # abre http://localhost:3100
```

¿Quieres probarlo sin cuenta? `npm run demo` usa datos falsos.

El historial se guarda en `data/readings.json` (180 días). **LibreLinkUp solo entrega las últimas 12 h**, así que
para tener el resumen diario completo el panel debe quedar corriendo (en un PC que esté siempre encendido,
una Raspberry Pi o un servidor).

## 3. Verlo en el celular como app

- **En la misma red WiFi:** abre `http://IP-de-tu-PC:3100` en el celular.
- **Desde cualquier lugar:** la opción más simple y privada es [Tailscale](https://tailscale.com) (gratis) en el PC y
  en el celular. También puedes publicarlo en un servidor (Railway, Render, Fly.io, un VPS) **con disco persistente
  para `data/` y con `PANEL_PASSWORD` definida**: son datos de salud.
- Para instalarla: en Android (Chrome) usa *⋮ → Instalar app*; en iPhone (Safari), *Compartir → Agregar a inicio*.
  Los avisos del navegador necesitan HTTPS (Tailscale y los servicios anteriores lo entregan).

## Avisos al celular (bajo 50 / sobre 250)

El PC envía los avisos con [ntfy](https://ntfy.sh), una app gratuita. Llegan aunque el celular esté bloqueado
y el panel cerrado en el celular, **siempre que el PC esté encendido**.

1. Instala **ntfy** en el iPhone (App Store) y permite las notificaciones.
2. En la app pulsa **+** y suscríbete a un tema inventado, largo y difícil de adivinar
   (por ejemplo `glucosa-ignacio-8f3k2q9x`). Cualquiera que conozca el nombre puede leer los avisos.
3. En el `.env` pon ese mismo tema: `NTFY_TEMA=glucosa-ignacio-8f3k2q9x`.
4. Prueba con `npm run probar-aviso`.

Por defecto avisa bajo 50 (urgente, se repite cada 10 min), sobre 250 (cada 30 min), cuando vuelves a rango
y si pasan 30 min sin lecturas. Cambia los valores con `ALERTA_BAJO`, `ALERTA_ALTO`, etc.

## Que se abra solo al encender el PC (Windows)

Doble clic en **`activar-inicio-automatico.bat`**. Desde ahí el panel arranca oculto cada vez que inicias
sesión en Windows, se reinicia solo si se cae y se detiene al apagar el PC. El registro queda en
`data\panel.log`. Para quitarlo: **`desactivar-inicio-automatico.bat`**.

## 4. Conectar el MCP a Claude

**Claude Code:**

```bash
claude mcp add glucosa -- node /ruta/completa/glucosa/src/mcp.js
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "glucosa": { "command": "node", "args": ["/ruta/completa/glucosa/src/mcp.js"] }
  }
}
```

El MCP lee el mismo `.env` y el mismo historial que el panel. Ejemplos de preguntas:
*"¿cuánto tengo ahora?"*, *"¿cómo estuvo mi glucosa anoche?"*, *"¿tuve hipoglucemias esta semana?"*,
*"compárame el tiempo en rango de esta semana con la anterior"*.

Ten presente que lo que consulte el MCP se envía al modelo.

## Configuración (`.env`)

| Variable | Para qué |
|---|---|
| `LIBRE_EMAIL`, `LIBRE_PASSWORD` | Cuenta de LibreLinkUp |
| `LIBRE_REGION` | Opcional (`eu`, `us`, `la`…); se detecta sola |
| `LIBRE_VERSION` | Si LibreLinkUp rechaza la conexión, súbela a la versión actual de la app |
| `PORT`, `POLL_SECONDS` | Puerto del panel y cada cuánto consulta (mínimo 60 s) |
| `PANEL_PASSWORD` | Pide contraseña para abrir el panel |
| `TZ_PANEL` | Zona horaria para separar los días (por defecto `America/Santiago`) |
| `GLUCOSA_MUY_BAJO`, `GLUCOSA_BAJO`, `GLUCOSA_ALTO`, `GLUCOSA_MUY_ALTO` | Rangos en mg/dL (54/70/180/250 por defecto; ajústalos con tu médico) |

## Problemas comunes

- **"correo o contraseña incorrectos"**: usa la cuenta de LibreLinkUp, no la de LibreView/FreeStyle Libre.
- **"pide aceptar términos"**: abre la app LibreLinkUp e inicia sesión; acepta lo que aparezca.
- **"rechazó la versión"**: sube `LIBRE_VERSION` (por ejemplo, a la versión que muestra la tienda de apps).
- **"no sigue a nadie"**: falta compartir desde la app FreeStyle Libre (paso 1).

## Estructura

```
src/libre.js     Cliente LibreLinkUp (login, región, token) + datos demo
src/store.js     Historial en data/readings.json
src/stats.js     Tiempo en rango, GMI, CV, hipoglucemias, resumen por día
src/monitor.js   Une cliente + historial (lo usan el panel y el MCP)
src/server.js    Panel web + API + actualización en vivo (SSE)
src/mcp.js       Servidor MCP (stdio)
public/          App web (PWA)
test/            Pruebas (npm test)
```
