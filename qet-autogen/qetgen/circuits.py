"""Generadores de circuitos: esquema de fuerza (multifilar) y esquema de mando (escalera).

Todo se construye a partir de una especificación (dict / YAML), ver `ejemplos/`.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from .project import Element, Folio, Project, Terminal

ROWS = 9  # folios de 17 x 9 cuadros (1020 x 720 px)


# ----------------------------------------------------------------------------
# Utilidades
# ----------------------------------------------------------------------------
def wrap(text: str, width: int = 14) -> str:
    """Parte un texto en varias líneas para que no invada la columna vecina."""
    lines, cur = [], ""
    for w in text.split():
        if cur and len(cur) + 1 + len(w) > width:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    return "\n".join(lines)


class Namer:
    """Etiquetas secuenciales por prefijo: KM1, KM2, S1, H1..."""

    def __init__(self):
        self.count: dict[str, int] = defaultdict(int)

    def __call__(self, prefix: str) -> str:
        self.count[prefix] += 1
        return f"{prefix}{self.count[prefix]}"


def place(folio: Folio, symbol: str, x: float, y_top: float, label: str = "", **info) -> Element:
    """Coloca un símbolo de forma que su borne superior quede exactamente en (x, y_top)."""
    el = folio.add(symbol, 0, 0, label, **info)
    tops = el.tops()
    ref = tops[0].tdef if tops else el.definition.terminals[0]
    el.x, el.y = x - ref.x, y_top - ref.y
    return el


def place_bottom(folio: Folio, symbol: str, x: float, y_bottom: float, label: str = "", **info) -> Element:
    """Coloca un símbolo de forma que su borne inferior quede en (x, y_bottom)."""
    el = folio.add(symbol, 0, 0, label, **info)
    ref = el.bottoms()[0].tdef
    el.x, el.y = x - ref.x, y_bottom - ref.y
    return el


class Bus:
    """Potencial que recorre uno o varios folios (barra de fuerza o riel de mando).

    Cada borne que se conecta a la barra se une al anterior con un trazado que pasa por
    la cota `y` (así se dibuja como barra horizontal con derivaciones). Al cambiar de
    folio se insertan flechas de reporte enlazadas (QElectroTech muestra la referencia).
    """

    def __init__(self, name: str, color: str | None = None, num: str | None = None):
        self.name = name
        self.color = color
        self.num = name if num is None else num
        self.last: Terminal | None = None
        self.last_y: float = 0

    def attach(self, folio: Folio, t: Terminal, y: float,
               via: list[tuple[float, float]] | None = None) -> None:
        if self.last is None:
            self.last, self.last_y = t, y
            return
        if self.last.element.folio is not folio:
            old = self.last.element.folio
            out = old.add("flecha_salida", old.width - 50, self.last_y, self.name)
            old.wire(self.last, out.left(), y=self.last_y, color=self.color, num=self.num, show_num=False)
            inc = folio.add("flecha_entrada", 40, y, self.name)
            out.link(inc)
            self.last = inc.right()
        if via is not None:
            folio.wire(self.last, t, via=[(self.last.pos[0], y), *via], color=self.color, num=self.num, show_num=False)
        else:
            folio.wire(self.last, t, y=y, color=self.color, num=self.num, show_num=False)
        self.last, self.last_y = t, y


# ----------------------------------------------------------------------------
# Esquema de fuerza
# ----------------------------------------------------------------------------
class PowerSheet:
    BUS_Y = {"L1": 220, "L2": 240, "L3": 260, "N": 280}
    PE_Y = 712
    TOP = 310   # bornes superiores de las protecciones de cada salida (GV: 310..390)
    KM_TOP = 440  # bornes superiores de los contactores (440..480)
    F_TOP = 530   # relé térmico (530..572)
    M_TOP = 600   # bornes superiores del motor

    def __init__(self, gen: "Generator"):
        self.gen = gen
        self.buses = {n: Bus(n) for n in ("L1", "L2", "L3", "N")}
        self.pe = Bus("PE", "#00a000")
        self.folio: Folio | None = None
        self.x = 0

    def new_folio(self) -> Folio:
        n = sum(1 for f in self.gen.project.folios if f.title.startswith("Fuerza"))
        self.folio = self.gen.project.folio("Fuerza" + (f" ({n + 1})" if n else ""), ROWS)
        self.folio.show_numbers = bool(self.gen.spec.get("numerar_fuerza", False))
        self.x = 80
        return self.folio

    def reserve(self, width: int) -> tuple[Folio, float]:
        """Reserva un ancho para una salida; abre folio nuevo si no cabe."""
        if self.folio is None or self.x + width > self.folio.width - 60:
            self.new_folio()
        x0 = self.x + width / 2
        self.x += width
        return self.folio, x0

    # --- cabecera: acometida + interruptor general -------------------------
    def head(self, spec: dict) -> None:
        f = self.new_folio()
        src = f.add("fuente_3f_n_pe", 40, 80, "RED")
        tension = spec.get("tension", "3x400/230 V 50 Hz")
        f.text(f"Acometida {tension}", 130, 22, 8, True)
        q0 = f.add("interruptor_4p", 140, 170, self.gen.names("Q"))
        q0.add_text(wrap(spec.get("interruptor_general", "Interruptor general"), 18), 46, 2)
        tops = q0.tops()
        for i, ph in enumerate(("L1", "L2", "L3", "N")):
            a = src.right(i)
            f.wire(a, tops[i], via=[(tops[i].pos[0], a.pos[1])], num=ph)
        for i, ph in enumerate(("L1", "L2", "L3", "N")):
            self.buses[ph].attach(f, q0.bottoms()[i], self.BUS_Y[ph])
        pe = src.right(4)
        self.pe.last, self.pe.last_y = pe, self.PE_Y
        for ph, y in self.BUS_Y.items():
            f.text(ph, f.width - 50, y - 12, 7)
        f.text("PE", f.width - 50, self.PE_Y - 12, 7)
        self.x = 220

    def tap3(self, f: Folio, el: Element) -> None:
        for i, ph in enumerate(("L1", "L2", "L3")):
            self.buses[ph].attach(f, el.tops()[i], self.BUS_Y[ph])

    def protection(self, f: Folio, x0: float, m: "MotorCtx") -> Element:
        """Guardamotor (por defecto) o disyuntor + relé térmico."""
        if m.proteccion == "guardamotor":
            q = place(f, "guardamotor", x0 - 20, self.TOP, m.q)
            q.add_text(m.spec.get("ajuste", ""), 30, -45)
        else:  # disyuntor_termico | disyuntor
            q = place(f, "interruptor_3p", x0 - 20, self.TOP, m.q)
            q.add_text(m.spec.get("interruptor", ""), 32, -40)
        self.tap3(f, q)
        return q

    def thermal(self, f: Folio, x0: float, m: "MotorCtx", above: list[Terminal]) -> list[Terminal]:
        if m.proteccion != "disyuntor_termico":
            return above
        fr = place(f, "rele_termico", x0 - 20, self.F_TOP, m.f)
        fr.add_text(m.spec.get("ajuste", ""), 50, 18)
        for a, b in zip(above, fr.tops()):
            f.wire(a, b)
        m.thermal_el = fr
        return fr.bottoms()

    def motor(self, f: Folio, x0: float, m: "MotorCtx", feed: list[Terminal]) -> Element:
        mot = place(f, "motor_3f", x0 - 20, self.M_TOP, m.m)
        for a, b in zip(feed, mot.tops()):
            f.wire(a, b)
        self.pe.attach(f, mot.right(), self.PE_Y)
        mot.add_text(self.motor_text(m), 36, -16)
        return mot

    @staticmethod
    def motor_text(m: "MotorCtx") -> str:
        return wrap(" ".join(v for v in (m.spec.get("descripcion", ""), m.spec.get("potencia", "")) if v), 16)

    # --- salidas -------------------------------------------------------------
    def directo(self, m: "MotorCtx") -> None:
        f, x0 = self.reserve(140)
        q = self.protection(f, x0, m)
        km = place(f, "contactor_3p", x0 - 20, self.KM_TOP, m.km[0])
        for a, b in zip(q.bottoms(), km.tops()):
            f.wire(a, b)
        feed = self.thermal(f, x0, m, km.bottoms())
        self.motor(f, x0, m, feed)
        m.power_contacts = [km]
        m.prot_el = q

    def inversor(self, m: "MotorCtx") -> None:
        f, x0 = self.reserve(260)
        q = self.protection(f, x0, m)
        km1 = place(f, "contactor_3p", x0 - 20, self.KM_TOP, m.km[0])
        km2 = place(f, "contactor_3p", x0 + 80, self.KM_TOP, m.km[1])
        for i, (a, b) in enumerate(zip(q.bottoms(), km1.tops())):
            f.wire(a, b)
            f.wire(km1.tops()[i], km2.tops()[i], y=self.KM_TOP - 30 + 8 * i)
        # KM2 invierte L1 <-> L3
        swap = [2, 1, 0]
        for i, b in enumerate(km2.bottoms()):
            dst = km1.bottoms()[swap[i]]
            f.wire(b, dst, y=self.KM_TOP + 50 + 8 * i)
        feed = self.thermal(f, x0, m, km1.bottoms())
        self.motor(f, x0, m, feed)
        m.power_contacts = [km1, km2]
        m.prot_el = q

    def estrella_triangulo(self, m: "MotorCtx") -> None:
        f, x0 = self.reserve(300)
        xa, xb, xc = x0 - 100, x0, x0 + 90  # KM1/F/motor | KM3 (triángulo) | KM2 (estrella)
        q = self.protection(f, xa, m)
        km1 = place(f, "contactor_3p", xa - 20, self.KM_TOP, m.km[0])  # línea
        for a, b in zip(q.bottoms(), km1.tops()):
            f.wire(a, b)
        feed = self.thermal(f, xa, m, km1.bottoms())
        mot = place(f, "motor_3f_6bornes", xa - 20, self.M_TOP, m.m)
        for a, b in zip(feed, mot.tops()):
            f.wire(a, b)
        mot.add_text(self.motor_text(m), -95, -10)
        pe = mot.pin("PE")
        px, py = pe.pos
        self.pe.attach(f, pe, self.PE_Y, via=[(px + 40, self.PE_Y), (px + 40, py - 10), (px, py - 10)])
        # KM3 triángulo, alimentado aguas abajo de KM1: L1->W2, L2->U2, L3->V2
        km3 = place(f, "contactor_3p", xb - 20, self.F_TOP, m.km[2])
        for i, (a, b) in enumerate(zip(km1.bottoms(), km3.tops())):
            f.wire(a, b, y=self.KM_TOP + 55 + 8 * i)
        u2, v2, w2 = mot.pin("U2"), mot.pin("V2"), mot.pin("W2")
        for i, (src, dst) in enumerate(zip(km3.bottoms(), (w2, u2, v2))):
            f.wire(src, dst, y=w2.pos[1] + 12 + 8 * i)
        # KM2 estrella: cortocircuita U2-V2-W2 (tomado de las salidas de KM3)
        km2 = place(f, "contactor_3p", xc - 20, self.M_TOP, m.km[1])
        b3 = km3.bottoms()
        for i, dst in enumerate(km2.tops()):
            f.wire(b3[i], dst, y=b3[i].pos[1] + 8 + 6 * i)
        b = km2.bottoms()
        f.wire(b[0], b[1], y=b[0].pos[1] + 10)
        f.wire(b[1], b[2], y=b[0].pos[1] + 10)
        m.power_contacts = [km1, km2, km3]
        m.prot_el = q

    def _drive(self, m: "MotorCtx", symbol: str, title: str) -> None:
        """Salida con variador o partidor suave (contactor de línea opcional)."""
        f, x0 = self.reserve(150)
        q = self.protection(f, x0, m)
        above = q.bottoms()
        if m.km:
            km = place(f, "contactor_3p", x0 - 20, self.KM_TOP - 10, m.km[0])
            for a, b in zip(above, km.tops()):
                f.wire(a, b)
            above = km.bottoms()
            m.power_contacts = [km]
        d = place(f, symbol, x0 - 20, 500, m.u)
        d.add_text(wrap(" ".join(v for v in (title, m.spec.get("modelo", "")) if v), 14), 36, 4)
        for a, b in zip(above, d.tops()):
            f.wire(a, b)
        self.motor(f, x0, m, d.bottoms())
        m.prot_el = q
        m.drive_el = d

    def variador(self, m: "MotorCtx") -> None:
        self._drive(m, "variador", "Variador de frecuencia")

    def partidor_suave(self, m: "MotorCtx") -> None:
        self._drive(m, "partidor_suave", "Partidor suave")

    def control_supply(self, spec: dict) -> tuple[Terminal, Terminal]:
        f, x0 = self.reserve(100)
        q = place(f, "interruptor_1p_n", x0 - 10, self.TOP, self.gen.names("Q"))
        q.add_text("Mando " + spec.get("tension_mando", "230 VAC"), 30, -45)
        self.buses["L1"].attach(f, q.tops()[0], self.BUS_Y["L1"])
        self.buses["N"].attach(f, q.tops()[1], self.BUS_Y["N"])
        return q.bottoms()[0], q.bottoms()[1]


# ----------------------------------------------------------------------------
# Esquema de mando (escalera)
# ----------------------------------------------------------------------------
class Ladder:
    RAIL_TOP = 60
    SUBRAIL = 170  # riel después de la parada de emergencia
    FIRST = 200  # cota del primer borne de cada línea
    RAIL_BOT = 690
    LOAD_BOTTOM = 650
    COL = 70
    GAP = 20

    def __init__(self, gen: "Generator"):
        self.gen = gen
        self.L = Bus("L", "#c00000")
        self.Lp = Bus("L'", "#c00000")
        self.N = Bus("N", "#0000c0")
        self.folio: Folio | None = None
        self.x = 0

    def new_folio(self) -> Folio:
        n = sum(1 for f in self.gen.project.folios if f.title.startswith("Mando"))
        self.folio = self.gen.project.folio("Mando" + (f" ({n + 1})" if n else ""), ROWS)
        self.x = 100
        return self.folio

    def reserve(self, ncols: int) -> tuple[Folio, list[float]]:
        if self.folio is None or self.x + ncols * self.COL > self.folio.width - 40:
            self.new_folio()
        cols = [self.x + i * self.COL for i in range(ncols)]
        self.x += ncols * self.COL
        return self.folio, cols

    def column(self, f: Folio, x: float, items: list["Item"], y0: float | None = None) -> list[Element]:
        """Apila elementos en serie en la columna x. Las cargas (bobinas, lámparas)
        se alinean abajo."""
        y = y0 if y0 is not None else self.FIRST
        els: list[Element] = []
        for it in items:
            if it.load:
                el = place_bottom(f, it.symbol, x, self.LOAD_BOTTOM, it.label)
            else:
                el = place(f, it.symbol, x, y, it.label)
            if it.master is not None:
                el.link(it.master)
            if it.text:
                if it.load:
                    el.add_text(wrap(it.text, 12), 10, -62)
                else:
                    el.add_text(wrap(it.text, 12), 14, 14)
            if els:
                f.wire(els[-1].bottoms()[0], el.tops()[0])
            els.append(el)
            ys = [t.pos[1] for t in el.terminals]
            y = max(ys) + self.GAP
        return els

    def to_rails(self, f: Folio, els: list[Element], start: str | Terminal = "L'", end="N",
                 start_y: float | None = None) -> None:
        top, bot = els[0].tops()[0], els[-1].bottoms()[0]
        if start == "L'":
            self.Lp.attach(f, top, self.SUBRAIL)
        elif start == "L":
            self.L.attach(f, top, self.RAIL_TOP)
        elif isinstance(start, Terminal):
            f.wire(start, top, y=start_y)
        if end == "N":
            self.N.attach(f, bot, self.RAIL_BOT)
        elif isinstance(end, Terminal):
            f.wire(bot, end)

    def parallel(self, f: Folio, x: float, across: Element, it: "Item") -> Element:
        """Contacto en paralelo con `across` (p.ej. autorretención)."""
        el = place(f, it.symbol, x, across.tops()[0].pos[1], it.label)
        if it.master is not None:
            el.link(it.master)
        if it.text:
            el.add_text(it.text, 14, 18)
        f.wire(across.tops()[0], el.tops()[0], y=across.tops()[0].pos[1] - 10)
        f.wire(el.bottoms()[0], across.bottoms()[0], y=across.bottoms()[0].pos[1] + 10)
        return el


@dataclass
class Item:
    symbol: str
    label: str = ""
    master: Element | None = None
    text: str = ""
    load: bool = False


@dataclass
class MotorCtx:
    spec: dict
    m: str
    q: str
    f: str
    km: list[str]
    kt: str = ""
    proteccion: str = "guardamotor"
    power_contacts: list[Element] = field(default_factory=list)
    prot_el: Element | None = None
    thermal_el: Element | None = None
    u: str = ""
    drive_el: Element | None = None


# ----------------------------------------------------------------------------
# Generador principal
# ----------------------------------------------------------------------------
ARRANQUES = ("directo", "inversor", "estrella_triangulo", "variador", "partidor_suave")
PROTECCIONES = ("guardamotor", "disyuntor_termico", "disyuntor")


class Generator:
    def __init__(self, spec: dict, library=None):
        self.spec = spec
        p = spec.get("proyecto", {})
        self.project = Project(p.get("titulo", "Proyecto"), p.get("autor", ""), library,
                               plant=p.get("planta", ""), location=p.get("ubicacion", ""),
                               revision=str(p.get("revision", "A")))
        self.names = Namer()
        self.power = PowerSheet(self)
        self.ladder = Ladder(self)
        self.motors: list[MotorCtx] = []

    # ------------------------------------------------------------------
    def build(self) -> Project:
        alim = self.spec.get("alimentacion", {})
        cargas = self.spec.get("cargas", [])
        self.power.head(alim)
        for c in cargas:
            if c.get("tipo", "motor") == "motor":
                self._power_motor(c)
        l_out, n_out = self.power.control_supply(alim)
        # rieles de mando: vienen del interruptor de mando del folio de fuerza
        self.ladder.L.last, self.ladder.L.last_y = l_out, l_out.pos[1] + 20
        self.ladder.N.last, self.ladder.N.last_y = n_out, n_out.pos[1] + 30
        self._emergency()
        for m in self.motors:
            self._control_motor(m)
        for c in cargas:
            if c.get("tipo", "motor") != "motor":
                self._control_simple(c)
        if self.spec.get("portada", True):
            self._cover()
        self.project.autonumber()
        return self.project

    def _cover(self) -> None:
        """Folio 1: carátula con datos del proyecto e índice de folios."""
        pr = self.project
        f = pr.folio("Portada e índice", ROWS)
        pr.folios.insert(0, pr.folios.pop())
        p = self.spec.get("proyecto", {})
        f.text(pr.title, 60, 80, 22, True)
        y = 150
        for k, v in (("Cliente", p.get("cliente", "")), ("Planta", pr.plant), ("Ubicación", pr.location),
                     ("Autor", pr.author), ("Fecha", pr.date.strftime("%d-%m-%Y")), ("Revisión", pr.revision),
                     ("Alimentación", self.spec.get("alimentacion", {}).get("tension", "")),
                     ("Tensión de mando", self.spec.get("alimentacion", {}).get("tension_mando", ""))):
            if v:
                f.text(f"{k}:", 60, y, 10, True)
                f.text(str(v), 220, y, 10)
                y += 26
        f.text("Índice de folios", 560, 150, 12, True)
        for i, fo in enumerate(pr.folios, 1):
            f.text(f"{i:>2}", 560, 160 + i * 24, 10)
            f.text(fo.title, 600, 160 + i * 24, 10)
        f.text("Generado con qetgen para QElectroTech", 60, 660, 7)

    # ------------------------------------------------------------------
    def _power_motor(self, c: dict) -> None:
        arr = c.get("arranque", "directo")
        if arr not in ARRANQUES:
            raise ValueError(f"Arranque desconocido '{arr}'. Opciones: {', '.join(ARRANQUES)}")
        drive = arr in ("variador", "partidor_suave")
        nkm = {"directo": 1, "inversor": 2, "estrella_triangulo": 3}.get(arr, 0)
        if drive and c.get("contactor_linea", arr == "partidor_suave"):
            nkm = 1
        prot = c.get("proteccion", "disyuntor" if arr == "variador" else "guardamotor")
        if prot not in PROTECCIONES:
            raise ValueError(f"Protección desconocida '{prot}'. Opciones: {', '.join(PROTECCIONES)}")
        m = MotorCtx(
            spec=c, m=c.get("tag") or self.names("M"),
            q=self.names("QM" if prot == "guardamotor" else "Q"),
            f=self.names("F") if prot == "disyuntor_termico" else "",
            km=[self.names("KM") for _ in range(nkm)],
            kt=self.names("KT") if arr == "estrella_triangulo" else "",
            proteccion=prot,
            u=self.names("U") if drive else "",
        )
        getattr(self.power, arr)(m)
        self.motors.append(m)

    def _emergency(self) -> None:
        f, (x,) = self.ladder.reserve(1)
        if self.spec.get("parada_emergencia", True):
            items = [Item("parada_emergencia", self.names("S"), text="Parada de emergencia")]
        else:
            items = [Item("contacto_na", "", text="Puente")]
        els = self.ladder.column(f, x, items, y0=self.ladder.RAIL_TOP + 40)
        self.ladder.to_rails(f, els, start="L", end=None)
        self.ladder.Lp.last, self.ladder.Lp.last_y = els[-1].bottoms()[0], self.ladder.SUBRAIL
        f.text("Circuito de mando " + self.spec.get("alimentacion", {}).get("tension_mando", "230 VAC"),
               20, 10, 8, True)

    def _prot_contact(self, m: MotorCtx, normally_open=False) -> Item | None:
        if m.proteccion == "disyuntor":
            return None
        if m.proteccion == "guardamotor":
            sym = "contacto_guardamotor_na" if normally_open else "contacto_guardamotor_nc"
            return Item(sym, m.q, m.prot_el)
        sym = "contacto_termico_na" if normally_open else "contacto_termico_nc"
        return Item(sym, m.f, m.thermal_el)

    def _start_stop(self, m: MotorCtx, f: Folio, x: float, x_hold: float, coil: str,
                    text: str, mando: str, coil_symbol: str = "bobina"):
        """Línea de marcha/paro: [protección] [paro] [marcha || autorretención] [bobina].
        Devuelve (elementos de la línea, elemento de marcha)."""
        L = self.ladder
        pre = [i for i in (self._prot_contact(m),) if i]
        if mando == "selector":
            cmd = [Item("selector", self.names("S"), text="Marcha/Paro")]
        else:
            cmd = [Item("pulsador_nc", self.names("S"), text="Paro"),
                   Item("pulsador_na", self.names("S"), text="Marcha")]
        els = L.column(f, x, pre + cmd + [Item(coil_symbol, coil, text=text, load=True)])
        L.to_rails(f, els)
        start_el = els[len(pre) + len(cmd) - 1]
        if mando != "selector":
            L.parallel(f, x_hold, start_el, Item("contacto_na", coil, els[-1]))
        return els, start_el

    def _control_motor(self, m: MotorCtx) -> None:
        c = m.spec
        arr = c.get("arranque", "directo")
        mando = c.get("mando", "pulsadores")
        desc = c.get("descripcion", m.m)
        drive = arr in ("variador", "partidor_suave")
        lamps = []
        if c.get("piloto_marcha", True):
            lamps.append("marcha")
        if c.get("piloto_falla", True) and (drive or m.proteccion != "disyuntor"):
            lamps.append("falla")
        L = self.ladder
        hold = 0 if mando == "selector" else 1  # columna extra para la autorretención

        if arr == "directo":
            f, cols = L.reserve(1 + hold + len(lamps))
            els, _ = self._start_stop(m, f, cols[0], cols[-1] if not hold else cols[1], m.km[0], desc, mando)
            coils = {m.km[0]: els[-1]}
            run = m.km[0]
            lamp_cols = cols[1 + hold:]

        elif arr == "inversor":
            f, cols = L.reserve(4 + len(lamps))
            k1, k2 = m.km
            pre = [i for i in (self._prot_contact(m),) if i]
            common = L.column(f, cols[0], pre + [Item("pulsador_nc", self.names("S"), text="Paro")])
            L.to_rails(f, common, end=None)
            node = common[-1].bottoms()[0]
            y1 = node.pos[1] + L.GAP
            r1 = L.column(f, cols[0], [Item("pulsador_na", self.names("S"), text="Adelante"),
                                       Item("contacto_nc", k2), Item("bobina", k1, text=f"{desc} adelante", load=True)], y0=y1)
            f.wire(node, r1[0].tops()[0])
            r2 = L.column(f, cols[2], [Item("pulsador_na", self.names("S"), text="Atrás"),
                                       Item("contacto_nc", k1), Item("bobina", k2, text=f"{desc} atrás", load=True)], y0=y1)
            f.wire(node, r2[0].tops()[0], y=node.pos[1] + 10)
            for r in (r1, r2):
                L.N.attach(f, r[-1].bottoms()[0], L.RAIL_BOT)
            r1[1].link(r2[-1])
            r2[1].link(r1[-1])
            L.parallel(f, cols[1], r1[0], Item("contacto_na", k1, r1[-1]))
            L.parallel(f, cols[3], r2[0], Item("contacto_na", k2, r2[-1]))
            coils = {k1: r1[-1], k2: r2[-1]}
            run = k1
            lamp_cols = cols[4:]

        elif arr == "estrella_triangulo":
            f, cols = L.reserve(5 + len(lamps))
            k1, k2, k3 = m.km
            main, start_el = self._start_stop(m, f, cols[0], cols[1], k1, f"{desc} línea", "pulsadores")
            node = start_el.bottoms()[0]
            y1 = node.pos[1] + L.GAP
            kt = L.column(f, cols[2], [Item("bobina_temporizada", m.kt, text="Temporizador Y-D", load=True)])
            f.wire(node, kt[0].tops()[0], y=node.pos[1] + 10)
            star = L.column(f, cols[3], [Item("contacto_nc_temporizado", m.kt, kt[0]),
                                         Item("contacto_nc", k3), Item("bobina", k2, text="Estrella", load=True)], y0=y1)
            f.wire(kt[0].tops()[0], star[0].tops()[0], y=node.pos[1] + 10)
            delta = L.column(f, cols[4], [Item("contacto_na_temporizado", m.kt, kt[0]),
                                          Item("contacto_nc", k2), Item("bobina", k3, text="Triángulo", load=True)], y0=y1)
            f.wire(star[0].tops()[0], delta[0].tops()[0], y=node.pos[1] + 10)
            for r in (kt, star, delta):
                L.N.attach(f, r[-1].bottoms()[0], L.RAIL_BOT)
            star[1].link(delta[-1])
            delta[1].link(star[-1])
            coils = {k1: main[-1], k2: star[-1], k3: delta[-1], m.kt: kt[0]}
            run = k1
            lamp_cols = cols[5:]

        else:  # variador | partidor_suave
            ka = self.names("KA")
            n_km = len(m.km)
            f, cols = L.reserve(1 + hold + n_km + 1 + len(lamps))
            main, start_el = self._start_stop(m, f, cols[0], cols[1] if hold else cols[0], ka,
                                              f"{desc} marcha", mando)
            coils = {ka: main[-1]}
            ci = 1 + hold
            if n_km:
                node = start_el.bottoms()[0]
                kmc = L.column(f, cols[ci], [Item("bobina", m.km[0], text="Contactor de línea", load=True)])
                f.wire(node, kmc[0].tops()[0], y=node.pos[1] + 10)
                L.N.attach(f, kmc[-1].bottoms()[0], L.RAIL_BOT)
                coils[m.km[0]] = kmc[0]
                ci += 1
            # orden de marcha al equipo (entrada digital con su fuente interna de 24 VDC)
            di = L.column(f, cols[ci], [Item("borne_equipo_salida", m.u, text="+24V"),
                                        Item("contacto_na", ka, main[-1]),
                                        Item("borne_equipo_entrada", m.u, text="DI1 marcha")],
                          y0=L.FIRST + 60)
            di[0].add_text(wrap("Orden a " + ("variador" if arr == "variador" else "partidor")
                                + " (24 VDC interno)", 14), -20, -62)
            run = ka
            lamp_cols = cols[ci + 1:]

        # enlace contactos de potencia -> bobinas
        for pc in m.power_contacts:
            pc.link(coils[pc.label])

        for kind, x in zip(lamps, lamp_cols):
            if kind == "marcha":
                items = [Item("contacto_na", run, coils[run]),
                         Item("lampara", self.names("H"), text=f"{desc} en marcha (verde)", load=True)]
            else:
                if drive:
                    contact = Item("contacto_na", m.u, text="Relé falla equipo")
                else:
                    contact = self._prot_contact(m, normally_open=True)
                items = [contact, Item("lampara", self.names("H"), text=f"{desc} falla (rojo)", load=True)]
            els = L.column(f, x, items)
            L.to_rails(f, els, start="L" if kind == "falla" else "L'")

    def _control_simple(self, c: dict) -> None:
        sym = {"lampara": "lampara", "baliza": "baliza", "electrovalvula": "electrovalvula",
               "rele": "bobina"}.get(c.get("tipo"), c.get("tipo"))
        prefix = {"lampara": "H", "baliza": "H", "electrovalvula": "Y", "bobina": "KA"}.get(sym, "E")
        f, (x,) = self.ladder.reserve(1)
        items = []
        mando = c.get("mando", "selector")
        if mando == "selector":
            items.append(Item("selector", self.names("S"), text=c.get("texto_mando", "On/Off")))
        elif mando == "pulsador":
            items.append(Item("pulsador_na", self.names("S")))
        items.append(Item(sym, c.get("tag") or self.names(prefix), text=c.get("descripcion", ""), load=True))
        els = self.ladder.column(f, x, items)
        self.ladder.to_rails(f, els)


def generate(spec: dict, library=None) -> Project:
    return Generator(spec, library).build()
