/* Ilustraciones vectoriales propias (no son fotos ni logos de fabricantes).
   Representan el tipo de equipo con los colores típicos de cada marca, para fines didácticos.
   Si existe una foto en img/<slug>.jpg se muestra en su lugar (ver PAL.art.img). */
window.PAL = window.PAL || {};

PAL.art = (function () {
  const BRAND = {
    ABB: { body: "#eceef0", edge: "#9aa3ab", accent: "#e2001a", dark: "#3c4248" },
    FANUC: { body: "#f6c700", edge: "#b38f00", accent: "#2b2b2b", dark: "#2b2b2b" },
    KUKA: { body: "#f28c00", edge: "#b06400", accent: "#2b2b2b", dark: "#2f3337" }
  };
  const svg = (w, h, inner, title) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${String(title || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}" font-family="Arial, sans-serif">${inner}</svg>`;
  const slug = (s) => String(s).toLowerCase().replace(/["()]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  /* ---------- Robots ---------- */
  function robot(brand, model, data) {
    const c = BRAND[brand] || BRAND.ABB;
    const k = Math.min(1.6, Math.max(0.8, 0.75 + (data.payload || 100) / 400));   // grosor según carga
    const t = (v) => (v * k).toFixed(1);
    const floor = `<rect x="0" y="238" width="300" height="22" fill="#d9dde1"/><line x1="0" y1="238" x2="300" y2="238" stroke="#b5bcc3" stroke-width="2"/>`;
    const base = `
      <rect x="62" y="214" width="96" height="24" rx="3" fill="${c.dark}"/>
      <rect x="74" y="184" width="72" height="32" rx="8" fill="${c.body}" stroke="${c.edge}" stroke-width="2"/>
      <rect x="140" y="190" width="18" height="20" rx="3" fill="${c.dark}"/>`;
    let arm;
    if ((data.axes || 4) === 4) {
      // Paletizador de 4 ejes: brazo con paralelogramo, brida siempre horizontal
      arm = `
        <line x1="96" y1="186" x2="128" y2="84" stroke="${c.dark}" stroke-width="${t(5)}" stroke-linecap="round"/>
        <polygon points="${108 - 9 * k},184 ${108 + 9 * k},186 ${150 + 7 * k},84 ${150 - 9 * k},80" fill="${c.body}" stroke="${c.edge}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="110" cy="182" r="${t(15)}" fill="${c.body}" stroke="${c.edge}" stroke-width="2"/>
        <circle cx="110" cy="182" r="${t(6)}" fill="${c.dark}"/>
        <rect x="96" y="${82 - 9 * k}" width="${168 - 96}" height="${t(16)}" rx="6" fill="${c.body}" stroke="${c.edge}" stroke-width="2" transform="rotate(4 150 82)"/>
        <line x1="128" y1="98" x2="252" y2="108" stroke="${c.dark}" stroke-width="${t(4)}" stroke-linecap="round"/>
        <rect x="160" y="${80 - 7 * k}" width="96" height="${t(13)}" rx="5" fill="${c.body}" stroke="${c.edge}" stroke-width="2" transform="rotate(4 210 86)"/>
        <rect x="80" y="70" width="26" height="28" rx="4" fill="${c.dark}"/>
        <circle cx="150" cy="84" r="${t(11)}" fill="${c.body}" stroke="${c.edge}" stroke-width="2"/>
        <circle cx="150" cy="84" r="${t(4)}" fill="${c.dark}"/>
        <rect x="248" y="96" width="14" height="${t(26)}" rx="3" fill="${c.body}" stroke="${c.edge}" stroke-width="2"/>`;
    } else {
      // Robot de 6 ejes: muñeca con 3 ejes
      arm = `
        <polygon points="${108 - 10 * k},184 ${108 + 10 * k},186 ${138 + 8 * k},76 ${138 - 10 * k},72" fill="${c.body}" stroke="${c.edge}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="110" cy="182" r="${t(15)}" fill="${c.body}" stroke="${c.edge}" stroke-width="2"/>
        <circle cx="110" cy="182" r="${t(6)}" fill="${c.dark}"/>
        <rect x="108" y="${70 - 9 * k}" width="140" height="${t(18)}" rx="${t(9)}" fill="${c.body}" stroke="${c.edge}" stroke-width="2"/>
        <rect x="96" y="58" width="22" height="26" rx="4" fill="${c.dark}"/>
        <circle cx="138" cy="74" r="${t(12)}" fill="${c.body}" stroke="${c.edge}" stroke-width="2"/>
        <circle cx="138" cy="74" r="${t(4)}" fill="${c.dark}"/>
        <circle cx="250" cy="74" r="${t(9)}" fill="${c.body}" stroke="${c.edge}" stroke-width="2"/>
        <rect x="244" y="78" width="13" height="${t(30)}" rx="3" fill="${c.body}" stroke="${c.edge}" stroke-width="2" transform="rotate(-8 250 80)"/>`;
    }
    const toolY = (data.axes || 4) === 4 ? 96 + 26 * k : 78 + 30 * k;
    const tool = `
      <rect x="228" y="${toolY}" width="56" height="7" rx="2" fill="#555c63"/>
      <rect x="232" y="${toolY + 7}" width="48" height="9" fill="#7b848c"/>
      ${[238, 250, 262, 274].map((x) => `<rect x="${x - 3}" y="${toolY + 16}" width="6" height="5" fill="#2b2f33"/>`).join("")}
      <rect x="230" y="${toolY + 21}" width="52" height="${Math.max(18, 236 - toolY - 21 - 70)}" fill="#c89a5c" stroke="#8a6a3d" stroke-width="1.5"/>
      <line x1="230" y1="${toolY + 29}" x2="282" y2="${toolY + 29}" stroke="#8a6a3d" stroke-width="1"/>`;
    const stripe = `<rect x="76" y="198" width="68" height="4" fill="${c.accent}" opacity=".85"/>`;
    const reach = `<path d="M 110 182 m -6 -150 a 150 150 0 0 1 150 120" fill="none" stroke="#7f8a94" stroke-dasharray="4 4" stroke-width="1.2" opacity=".7"/>`;
    return svg(300, 260, `<rect width="300" height="260" fill="#f4f6f8"/>${reach}${floor}${base}${stripe}${arm}${tool}`, `${brand} ${model}`);
  }

  /* ---------- PLC ---------- */
  function plc(brand, model, data) {
    const safe = data && data.safety;
    const m = model || "";
    let inner = `<rect width="300" height="200" fill="#f4f6f8"/>`;
    if (brand === "Siemens") {
      const s1200 = /1200/.test(m), sp = /ET 200SP/.test(m);
      inner += `<rect x="10" y="40" width="280" height="10" fill="#b9c0c6"/><rect x="10" y="150" width="280" height="10" fill="#b9c0c6"/>`;
      if (s1200) {
        inner += `<rect x="40" y="35" width="120" height="130" rx="4" fill="#3b4046"/>
          <rect x="50" y="45" width="100" height="16" fill="#2a2e33"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${54 + i * 12}" y="50" width="8" height="6" fill="#d9dde1"/>`).join("")}
          <rect x="55" y="80" width="90" height="34" rx="2" fill="#4f565d"/>${[0, 1, 2].map((i) => `<circle cx="${64 + i * 10}" cy="90" r="3" fill="${i === 0 ? "#3ddc84" : "#ffcc33"}"/>`).join("")}
          ${safe ? `<rect x="40" y="120" width="120" height="8" fill="#ffd400"/>` : ""}
          <rect x="50" y="140" width="100" height="16" fill="#2a2e33"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${54 + i * 12}" y="145" width="8" height="6" fill="#d9dde1"/>`).join("")}
          <rect x="165" y="35" width="40" height="130" rx="3" fill="#4a5056"/><rect x="210" y="35" width="40" height="130" rx="3" fill="#4a5056"/>`;
      } else if (sp) {
        inner += `<rect x="20" y="35" width="70" height="130" rx="4" fill="#3b4046"/><rect x="30" y="50" width="50" height="22" fill="#9fd3ff" opacity=".7"/>
          ${safe ? `<rect x="20" y="80" width="70" height="8" fill="#ffd400"/>` : ""}
          ${Array.from({ length: 12 }, (_, i) => `<rect x="${96 + i * 15}" y="45" width="13" height="110" rx="2" fill="${i % 4 === 3 && safe ? "#ffd400" : "#5f666d"}"/><rect x="${98 + i * 15}" y="52" width="9" height="4" fill="#3ddc84"/>`).join("")}`;
      } else {
        inner += `<rect x="18" y="32" width="38" height="136" rx="3" fill="#2f3337"/><text x="37" y="150" font-size="9" fill="#ccc" text-anchor="middle">PS</text>
          <rect x="60" y="28" width="72" height="144" rx="4" fill="#3b4046"/>
          <rect x="70" y="40" width="52" height="34" rx="2" fill="#cfe8ff" stroke="#1d2a36"/><text x="96" y="61" font-size="10" text-anchor="middle" fill="#1d2a36">RUN</text>
          ${[0, 1, 2].map((i) => `<circle cx="${78 + i * 16}" cy="88" r="3.5" fill="${["#3ddc84", "#3ddc84", "#ffcc33"][i]}"/>`).join("")}
          ${safe ? `<rect x="60" y="100" width="72" height="9" fill="#ffd400"/><text x="96" y="107.5" font-size="8" text-anchor="middle" fill="#222">F</text>` : ""}
          <rect x="70" y="122" width="52" height="34" rx="2" fill="#2a2e33"/>
          ${[0, 1, 2, 3].map((i) => `<rect x="${138 + i * 38}" y="32" width="34" height="136" rx="3" fill="#4a5056"/><rect x="${142 + i * 38}" y="40" width="26" height="6" fill="${i === 3 && safe ? "#ffd400" : "#1fb5a6"}"/><rect x="${142 + i * 38}" y="52" width="26" height="100" rx="2" fill="#3b4046"/>`).join("")}`;
      }
    } else {
      const control = /ControlLogix|GuardLogix 5580/.test(m) && !/Compact/.test(m);
      if (control) {
        inner += `<rect x="12" y="22" width="276" height="160" rx="5" fill="#9ca4ab"/><rect x="18" y="28" width="264" height="148" rx="3" fill="#7d868e"/>
          <rect x="22" y="32" width="46" height="140" rx="2" fill="#d9dde1"/><text x="45" y="160" font-size="9" text-anchor="middle" fill="#333">PS</text>
          <rect x="72" y="32" width="40" height="140" rx="2" fill="#eceef0"/>
          <rect x="78" y="42" width="28" height="12" fill="#1d1f22"/><text x="92" y="51" font-size="8" fill="#3ddc84" text-anchor="middle">RUN</text>
          <circle cx="92" cy="74" r="7" fill="#c4c9ce" stroke="#555"/><rect x="90" y="69" width="4" height="10" fill="#555"/>
          ${safe ? `<rect x="72" y="100" width="40" height="10" fill="#d61f26"/><rect x="116" y="32" width="40" height="140" rx="2" fill="#eceef0"/><rect x="116" y="100" width="40" height="10" fill="#d61f26"/>` : ""}
          ${Array.from({ length: safe ? 3 : 4 }, (_, i) => { const x = (safe ? 160 : 116) + i * 42; return `<rect x="${x}" y="32" width="38" height="140" rx="2" fill="#eceef0"/><rect x="${x + 6}" y="40" width="26" height="8" fill="#2b6cb0"/><rect x="${x + 6}" y="56" width="26" height="100" rx="2" fill="#c9ced3"/>`; }).join("")}`;
      } else {
        inner += `<rect x="10" y="40" width="280" height="10" fill="#b9c0c6"/><rect x="10" y="150" width="280" height="10" fill="#b9c0c6"/>
          <rect x="22" y="30" width="78" height="140" rx="4" fill="#2f3337"/>
          <rect x="32" y="42" width="58" height="18" fill="#1d1f22"/><text x="61" y="55" font-size="9" fill="#3ddc84" text-anchor="middle">RUN OK</text>
          ${[0, 1].map((i) => `<rect x="${34 + i * 30}" y="110" width="22" height="14" rx="2" fill="#5f666d"/>`).join("")}
          ${safe ? `<rect x="22" y="80" width="78" height="10" fill="#d61f26"/>` : ""}
          ${Array.from({ length: 6 }, (_, i) => `<rect x="${106 + i * 30}" y="34" width="27" height="132" rx="2" fill="${safe && i === 5 ? "#d61f26" : "#3b4046"}"/><rect x="${110 + i * 30}" y="44" width="19" height="6" fill="#ffcc33"/><rect x="${110 + i * 30}" y="58" width="19" height="96" rx="2" fill="#2a2e33"/>`).join("")}`;
      }
    }
    return svg(300, 200, inner, `${brand} ${model}`);
  }

  /* ---------- HMI ---------- */
  function hmi(brand, model, data) {
    const big = /15/.test(model) ? 1 : /12/.test(model) ? 0.88 : 0.66;
    const W = 260 * big, H = 168 * big, x0 = (300 - W) / 2, y0 = (200 - H) / 2;
    const sx = x0 + 10 * big, sy = y0 + 10 * big, sw = W - 20 * big, sh = H - 26 * big;
    const head = sh * 0.14;
    const inner = `<rect width="300" height="200" fill="#f4f6f8"/>
      <rect x="${x0}" y="${y0}" width="${W}" height="${H}" rx="${8 * big}" fill="#24282c"/>
      <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="#dcdfe3"/>
      <rect x="${sx}" y="${sy}" width="${sw}" height="${head}" fill="#c3c8cd"/>
      <rect x="${sx + sw * 0.3}" y="${sy + head * 0.2}" width="${sw * 0.18}" height="${head * 0.6}" rx="2" fill="#2e8b57"/>
      <rect x="${sx + sw * 0.04}" y="${sy + head * 1.3}" width="${sw * 0.55}" height="${sh * 0.62}" fill="#eef0f2" stroke="#b5bcc3"/>
      <circle cx="${sx + sw * 0.31}" cy="${sy + head * 1.3 + sh * 0.31}" r="${sh * 0.09}" fill="#e8792b"/>
      <rect x="${sx + sw * 0.08}" y="${sy + head * 1.6}" width="${sw * 0.12}" height="${sh * 0.16}" fill="#c9a26b"/>
      <rect x="${sx + sw * 0.43}" y="${sy + head * 1.6}" width="${sw * 0.12}" height="${sh * 0.16}" fill="#c9a26b"/>
      ${[0, 1, 2].map((i) => `<rect x="${sx + sw * 0.63}" y="${sy + head * 1.4 + i * sh * 0.13}" width="${sw * 0.32}" height="${sh * 0.05}" fill="#b9bfc5"/><rect x="${sx + sw * 0.63}" y="${sy + head * 1.4 + i * sh * 0.13}" width="${sw * 0.32 * [0.7, 0.3, 0.5][i]}" height="${sh * 0.05}" fill="#6b7785"/>`).join("")}
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${sx + sw * (0.04 + i * 0.155)}" y="${sy + sh * 0.86}" width="${sw * 0.14}" height="${sh * 0.1}" rx="2" fill="#eef0f2" stroke="#9aa1a8"/>`).join("")}
      <circle cx="${x0 + W / 2}" cy="${y0 + H - 8 * big}" r="${2.5 * big}" fill="#3ddc84"/>`;
    return svg(300, 200, inner, `${brand} ${model}`);
  }

  /* ---------- Herramientas ---------- */
  function gripper(type) {
    let g;
    if (type === "vacio") g = `<rect x="80" y="40" width="140" height="18" rx="3" fill="#555c63"/><rect x="90" y="58" width="120" height="22" fill="#7b848c"/>
      ${[100, 125, 150, 175, 200].map((x) => `<rect x="${x - 6}" y="80" width="12" height="10" fill="#2b2f33"/><path d="M ${x - 9} 90 h 18 l -3 6 h -12 z" fill="#2b2f33"/>`).join("")}
      <rect x="88" y="98" width="124" height="60" fill="#c89a5c" stroke="#8a6a3d"/><line x1="88" y1="112" x2="212" y2="112" stroke="#8a6a3d"/>
      <path d="M 150 20 v 18" stroke="#3ddc84" stroke-width="3"/><text x="160" y="30" font-size="11" fill="#333">vacío</text>`;
    else if (type === "pinza") g = `<rect x="70" y="40" width="160" height="18" rx="3" fill="#555c63"/>
      <rect x="78" y="58" width="16" height="104" fill="#7b848c"/><rect x="206" y="58" width="16" height="104" fill="#7b848c"/>
      <rect x="120" y="58" width="60" height="14" fill="#7b848c"/>
      <rect x="96" y="96" width="108" height="64" fill="#c89a5c" stroke="#8a6a3d"/>
      <path d="M 60 120 h 14 m -6 -6 l 6 6 l -6 6 M 240 120 h -14 m 6 -6 l -6 6 l 6 6" stroke="#e2001a" stroke-width="3" fill="none"/>`;
    else g = `<rect x="70" y="36" width="160" height="16" rx="3" fill="#555c63"/><rect x="74" y="52" width="14" height="110" fill="#7b848c"/>
      ${[0, 1, 2, 3, 4].map((i) => `<rect x="${74 + i * 2}" y="158" width="150" height="6" fill="#5f666d" opacity="${1 - i * 0.15}"/>`).join("")}
      <path d="M 100 156 q 50 -30 110 0 z" fill="#d8c8a6" stroke="#9b8a63"/><rect x="200" y="52" width="12" height="70" fill="#7b848c"/><rect x="150" y="118" width="62" height="8" fill="#7b848c"/>`;
    return svg(300, 190, `<rect width="300" height="190" fill="#f4f6f8"/>${g}`, "Herramienta");
  }

  const missing = new Set();
  /* <img> con foto opcional del usuario y la ilustración como respaldo */
  function img(kind, brand, model, data, cls) {
    const s = kind === "robot" ? robot(brand, model, data) : kind === "plc" ? plc(brand, model, data) : kind === "hmi" ? hmi(brand, model, data) : gripper(model);
    const fb = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
    const file = `img/${slug(kind === "gripper" ? "herramienta-" + model : model)}.jpg`;
    const src = missing.has(file) ? fb : file;   // si la foto ya falló una vez, usar la ilustración directamente
    return `<img class="${cls || "art"}" src="${src}" data-fb="${fb}" onerror="this.onerror=null;PAL.art.missing.add(this.getAttribute('src'));this.src=this.dataset.fb" alt="${String((brand || "") + " " + model).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}" loading="lazy">`;
  }

  return { robot, plc, hmi, gripper, img, slug, missing };
})();
