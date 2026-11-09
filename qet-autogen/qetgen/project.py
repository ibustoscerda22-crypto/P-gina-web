"""Modelo de proyecto QElectroTech (.qet): folios, elementos, conductores y escritura XML."""
from __future__ import annotations

import copy
import datetime as _dt
import uuid as _uuid
from dataclasses import dataclass, field
from pathlib import Path
from xml.etree import ElementTree as ET

from .library import ORIENT, ElementDef, Library
from .symbols import sym

QET_VERSION = "0.90"

CONDUCTOR_DEFAULTS = {
    "type": "multi", "condsize": "1", "cable": "", "bus": "", "function": "",
    "tension_protocol": "", "conductor_color": "", "conductor_section": "",
    "onetextperfolio": "0", "numsize": "7", "displaytext": "1", "formula": "",
    "horizrotatetext": "0", "vertirotatetext": "270", "vertical-alignment": "AlignRight",
    "horizontal-alignment": "AlignBottom", "text_color": "#000000", "bicolor": "false",
    "color2": "#000000", "dash-size": "1", "freezeLabel": "false", "num": "",
}

DOCK_OFFSET = {"n": (0, 4), "s": (0, -4), "e": (-4, 0), "w": (4, 0)}

FONT_LABEL = "Sans Serif,9,-1,5,75,0,0,0,0,0"
FONT_SMALL = "Sans Serif,6,-1,5,50,0,0,0,0,0"


def new_uuid() -> str:
    return "{" + str(_uuid.uuid4()) + "}"


@dataclass
class Terminal:
    element: "Element"
    index: int
    id: int

    @property
    def tdef(self):
        return self.element.definition.terminals[self.index]

    @property
    def pos(self) -> tuple[float, float]:
        return self.element.x + self.tdef.x, self.element.y + self.tdef.y

    def __repr__(self) -> str:  # pragma: no cover - ayuda de depuración
        return f"<T {self.element.label}[{self.index}] {self.pos}>"


@dataclass
class Text:
    text: str
    x: float
    y: float
    font: str = FONT_SMALL
    color: str | None = None


class Element:
    def __init__(self, folio: "Folio", definition: ElementDef, x: float, y: float,
                 label: str = "", info: dict | None = None):
        self.folio = folio
        self.definition = definition
        self.x = x
        self.y = y
        self.label = label
        self.info: dict[str, str] = dict(info or {})
        self.uuid = new_uuid()
        self.links: list[Element] = []
        self.texts: list[Text] = []
        self.show_label = True
        self.terminals = [Terminal(self, i, folio.project.next_terminal_id())
                          for i in range(len(definition.terminals))]

    # --- acceso a bornes -------------------------------------------------
    def _sorted(self, orient: str) -> list[Terminal]:
        ts = [t for t in self.terminals if t.tdef.orientation == orient]
        key = (lambda t: t.tdef.x) if orient in "ns" else (lambda t: t.tdef.y)
        return sorted(ts, key=key)

    def top(self, k: int = 0) -> Terminal:
        return self._sorted("n")[k]

    def bottom(self, k: int = 0) -> Terminal:
        return self._sorted("s")[k]

    def right(self, k: int = 0) -> Terminal:
        return self._sorted("e")[k]

    def left(self, k: int = 0) -> Terminal:
        return self._sorted("w")[k]

    def tops(self) -> list[Terminal]:
        return self._sorted("n")

    def bottoms(self) -> list[Terminal]:
        return self._sorted("s")

    def pin(self, name: str) -> Terminal:
        for t in self.terminals:
            if t.tdef.name == name:
                return t
        raise KeyError(f"{self.label}: borne '{name}' no existe")

    # --- utilidades --------------------------------------------------------
    def link(self, other: "Element") -> None:
        """Enlace maestro/esclavo (referencias cruzadas bobina-contacto) o de reporte de folio."""
        if other not in self.links:
            self.links.append(other)
        if self not in other.links:
            other.links.append(self)

    def add_text(self, text: str, dx: float, dy: float, font: str = FONT_SMALL, color: str | None = None):
        self.texts.append(Text(text, dx, dy, font, color))
        return self

    @property
    def height_span(self) -> tuple[float, float]:
        ys = [t.y for t in self.definition.terminals] or [0]
        return min(ys), max(ys)

    # --- XML --------------------------------------------------------------
    def to_xml(self) -> ET.Element:
        e = ET.Element("element", {
            "type": f"embed://import/{self.definition.path}",
            "uuid": self.uuid, "x": _num(self.x), "y": _num(self.y), "z": "10",
            "orientation": "0", "prefix": "", "freezeLabel": "false",
        })
        ts = ET.SubElement(e, "terminals")
        for t in self.terminals:
            td = t.tdef
            # QET identifica el borne por su "dock point": 4 px hacia el interior del símbolo
            dx, dy = DOCK_OFFSET.get(td.orientation, (0, 0))
            ET.SubElement(ts, "terminal", {"x": _num(td.x + dx), "y": _num(td.y + dy),
                                           "orientation": str(ORIENT.get(td.orientation, 0)),
                                           "id": str(t.id)})
        ET.SubElement(e, "inputs")
        infos = ET.SubElement(e, "elementInformations")
        data = {"label": self.label, **self.info}
        for k, v in data.items():
            ei = ET.SubElement(infos, "elementInformation", {"show": "1", "name": k})
            ei.text = str(v)
        if self.links:
            lu = ET.SubElement(e, "links_uuids")
            for o in self.links:
                ET.SubElement(lu, "link_uuid", {"uuid": o.uuid})
        dts = ET.SubElement(e, "dynamic_texts")
        if self.show_label:
            anchor = self.definition.label_anchor() or (12, -10)
            dt = _dyn_text(dts, anchor[0], anchor[1], FONT_LABEL, "ElementInfo")
            ET.SubElement(dt, "text").text = self.label
            ET.SubElement(dt, "info_name").text = "label"
        for tx in self.texts:
            dt = _dyn_text(dts, tx.x, tx.y, tx.font, "UserText")
            ET.SubElement(dt, "text").text = tx.text
            if tx.color:
                ET.SubElement(dt, "color").text = tx.color
        ET.SubElement(e, "texts_groups")
        return e


def _dyn_text(parent, x, y, font, src) -> ET.Element:
    return ET.SubElement(parent, "dynamic_elmt_text", {
        "x": _num(x), "y": _num(y), "rotation": "0", "uuid": new_uuid(), "font": font,
        "text_from": src, "Halignment": "AlignLeft", "Valignment": "AlignTop",
        "text_width": "-1", "keep_visual_rotation": "true", "frame": "false",
    })


def _num(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else f"{v:g}"


@dataclass
class Conductor:
    t1: Terminal
    t2: Terminal
    num: str = ""
    color: str | None = None
    section: str = ""
    via: list[tuple[float, float]] | None = None  # puntos intermedios (trazado ortogonal)
    show_num: bool = True

    def segments(self) -> list[tuple[str, float]]:
        if not self.via:
            return []
        pts = [self.t1.pos, *self.via, self.t2.pos]
        segs: list[tuple[str, float]] = []
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            if x1 != x2 and y1 != y2:  # tramo diagonal: se parte en dos (horizontal + vertical)
                segs += [("horizontal", x2 - x1), ("vertical", y2 - y1)]
            elif x1 != x2:
                segs.append(("horizontal", x2 - x1))
            elif y1 != y2:
                segs.append(("vertical", y2 - y1))
        merged: list[tuple[str, float]] = []
        for o, l in segs:
            if merged and merged[-1][0] == o:
                merged[-1] = (o, merged[-1][1] + l)
            else:
                merged.append((o, l))
        return [(o, l) for o, l in merged if l != 0]

    def to_xml(self) -> ET.Element:
        attrs = dict(CONDUCTOR_DEFAULTS)
        attrs.update({"x": "0", "y": "0", "terminal1": str(self.t1.id),
                      "terminal2": str(self.t2.id), "num": self.num,
                      "conductor_section": self.section,
                      "displaytext": "1" if self.show_num else "0"})
        if self.color:
            attrs["color"] = self.color
        c = ET.Element("conductor", attrs)
        for o, l in self.segments():
            ET.SubElement(c, "segment", {"orientation": o, "length": _num(l)})
        ET.SubElement(c, "sequentialNumbers")
        return c


@dataclass
class FreeText:
    text: str
    x: float
    y: float
    size: int = 9
    bold: bool = False


class Folio:
    COLS, COLSIZE, ROWS, ROWSIZE = 17, 60, 8, 80

    def __init__(self, project: "Project", title: str, rows: int = 8):
        self.ROWS = rows
        self.show_numbers = True  # False: los números de conductor no se muestran en este folio
        self.project = project
        self.title = title
        self.elements: list[Element] = []
        self.conductors: list[Conductor] = []
        self.texts: list[FreeText] = []

    @property
    def width(self) -> int:
        return self.COLS * self.COLSIZE

    @property
    def height(self) -> int:
        return self.ROWS * self.ROWSIZE

    def add(self, rel: str, x: float, y: float, label: str = "", **info) -> Element:
        el = Element(self, self.project.library.get(sym(rel)), x, y, label, info)
        self.elements.append(el)
        return el

    def wire(self, a: Terminal, b: Terminal, num: str = "", color: str | None = None,
             section: str = "", via: list[tuple[float, float]] | None = None,
             y: float | None = None, x: float | None = None, show_num: bool = True) -> Conductor:
        """Une dos bornes.

        Sin `via`/`y`/`x` QElectroTech calcula el trazado automáticamente.
        `y=...` traza a→(a.x,y)→(b.x,y)→b (típico de barras y rieles de mando).
        `x=...` traza a→(x,a.y)→(x,b.y)→b.
        """
        if a.element.folio is not self or b.element.folio is not self:
            raise ValueError("Los conductores sólo pueden unir bornes del mismo folio")
        if y is not None:
            via = [(a.pos[0], y), (b.pos[0], y)]
        elif x is not None:
            via = [(x, a.pos[1]), (x, b.pos[1])]
        c = Conductor(a, b, num, color, section, via, show_num)
        self.conductors.append(c)
        return c

    def text(self, text: str, x: float, y: float, size: int = 9, bold: bool = False):
        self.texts.append(FreeText(text, x, y, size, bold))

    def to_xml(self, order: int) -> ET.Element:
        p = self.project
        d = ET.Element("diagram", {
            "version": QET_VERSION, "order": str(order), "title": self.title,
            "author": p.author, "date": p.date.strftime("%Y%m%d"), "filename": p.filename,
            "plant": p.plant, "locmach": p.location, "indexrev": p.revision,
            "folio": "%id/%total", "auto_page_num": "", "displayAt": "bottom",
            "cols": str(self.COLS), "colsize": str(self.COLSIZE), "displaycols": "true",
            "rows": str(self.ROWS), "rowsize": str(self.ROWSIZE), "displayrows": "true",
            "height": str(self.height + 20), "freezeNewElement": "false",
            "freezeNewConductor": "false",
        })
        dc = dict(CONDUCTOR_DEFAULTS)
        dc.pop("freezeLabel")
        ET.SubElement(d, "defaultconductor", dc)
        els = ET.SubElement(d, "elements")
        for el in self.elements:
            els.append(el.to_xml())
        cs = ET.SubElement(d, "conductors")
        for c in self.conductors:
            if not self.show_numbers:
                c.show_num = False
            cs.append(c.to_xml())
        ins = ET.SubElement(d, "inputs")
        for t in self.texts:
            weight = "75" if t.bold else "50"
            ET.SubElement(ins, "input", {
                "x": _num(t.x), "y": _num(t.y), "text": t.text, "rotation": "0",
                "font": f"Sans Serif,{t.size},-1,5,{weight},0,0,0,0,0",
                "color": "#000000", "frame": "false", "text_width": "-1",
            })
        return d


class Project:
    def __init__(self, title: str, author: str = "", library: Library | None = None,
                 plant: str = "", location: str = "", revision: str = "A"):
        self.title = title
        self.author = author
        self.plant = plant
        self.location = location
        self.revision = revision
        self.filename = ""
        self.date = _dt.date.today()
        self.library = library or Library()
        self.folios: list[Folio] = []
        self._tid = 1

    def next_terminal_id(self) -> int:
        tid = self._tid
        self._tid += 1
        return tid

    def folio(self, title: str, rows: int = 8) -> Folio:
        f = Folio(self, title, rows)
        self.folios.append(f)
        return f

    # --- numeración de conductores ---------------------------------------
    def autonumber(self, start: int = 1, fixed: dict[int, str] | None = None) -> None:
        """Numera los conductores por equipotencial (todos los cables de un mismo nodo
        llevan el mismo número). Las flechas de reporte enlazadas unen nodos entre folios.
        Los conductores que ya tienen `num` imponen ese nombre a su nodo."""
        parent: dict[int, int] = {}

        def find(i: int) -> int:
            while parent.setdefault(i, i) != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        def union(a: int, b: int) -> None:
            parent[find(a)] = find(b)

        conds = [c for f in self.folios for c in f.conductors]
        for c in conds:
            union(c.t1.id, c.t2.id)
        for f in self.folios:
            for el in f.elements:
                if el.definition.link_type in ("next_report", "previous_report"):
                    for o in el.links:
                        union(el.terminals[0].id, o.terminals[0].id)
        names: dict[int, str] = {}
        for c in conds:
            if c.num:
                names.setdefault(find(c.t1.id), c.num)
        n = start
        for c in conds:  # orden de creación = orden de lectura del plano
            r = find(c.t1.id)
            if r not in names:
                names[r] = str(n)
                n += 1
            c.num = names[r]

    # --- XML ------------------------------------------------------------
    def to_xml(self) -> ET.Element:
        root = ET.Element("project", {"title": self.title, "version": QET_VERSION})
        props = ET.SubElement(root, "properties")
        for name, val in (("saveddate", self.date.isoformat()),
                          ("savedfilename", self.filename)):
            pr = ET.SubElement(props, "property", {"show": "1", "name": name})
            pr.text = val
        nd = ET.SubElement(root, "newdiagrams")
        ET.SubElement(nd, "border", {"cols": str(Folio.COLS), "colsize": str(Folio.COLSIZE),
                                     "rows": str(Folio.ROWS), "rowsize": str(Folio.ROWSIZE),
                                     "displaycols": "true", "displayrows": "true"})
        ET.SubElement(nd, "inset", {"displayAt": "bottom", "folio": "%id/%total",
                                    "author": self.author, "title": self.title,
                                    "auto_page_num": "", "date": "null"})
        dc = dict(CONDUCTOR_DEFAULTS)
        dc.pop("freezeLabel")
        ET.SubElement(nd, "conductors", dc)
        ET.SubElement(nd, "report", {"label": "%f-%l%c"})
        xr = ET.SubElement(nd, "xrefs")
        for typ in ("coil", "protection", "commutator"):
            ET.SubElement(xr, "xref", {
                "type": typ, "displayhas": "cross", "snapto": "label", "xrefpos": "AlignBottom",
                "offset": "0", "showpowerctc": "true", "master_label": "%f-%l%c",
                "slave_label": "(%f-%l%c)", "delayprefix": "", "switchprefix": "",
                "powerprefix": ""})
        ET.SubElement(nd, "conductors_autonums", {"freeze_new_conductors": "false",
                                                  "current_autonum": ""})
        ET.SubElement(nd, "folio_autonums")
        ET.SubElement(nd, "element_autonums", {"freeze_new_elements": "false",
                                               "current_autonum": ""})
        for i, f in enumerate(self.folios, 1):
            root.append(f.to_xml(i))
        root.append(self._collection())
        return root

    def _collection(self) -> ET.Element:
        coll = ET.Element("collection")
        imp = ET.SubElement(coll, "category", {"name": "import"})
        names = ET.SubElement(imp, "names")
        for lang, txt in (("es", "Elementos importados"), ("en", "Imported elements"),
                          ("fr", "Éléments importés")):
            ET.SubElement(names, "name", {"lang": lang}).text = txt
        used = sorted({el.definition.path for f in self.folios for el in f.elements})
        cats: dict[str, ET.Element] = {"": imp}
        for rel in used:
            parts = rel.split("/")
            parent = imp
            for i in range(len(parts) - 1):
                key = "/".join(parts[: i + 1])
                if key not in cats:
                    c = ET.SubElement(parent, "category", {"name": parts[i]})
                    n = self.library.category_names(key)
                    if n is not None:
                        c.append(n)
                    cats[key] = c
                parent = cats[key]
            holder = ET.SubElement(parent, "element", {"name": parts[-1]})
            holder.append(copy.deepcopy(self.library.get(rel).root))
        return coll

    def save(self, path: str | Path) -> Path:
        path = Path(path)
        self.filename = path.stem
        tree = ET.ElementTree(self.to_xml())
        ET.indent(tree, space="    ")
        path.parent.mkdir(parents=True, exist_ok=True)
        tree.write(path, encoding="utf-8", xml_declaration=False)
        return path
