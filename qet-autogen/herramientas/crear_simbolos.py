"""Crea los símbolos propios de qetgen (variador, partidor suave, bornes de equipo).

Uso: python herramientas/crear_simbolos.py   (los deja en qetgen/elementos/99_qetgen/)
"""
import uuid
from pathlib import Path
from xml.etree import ElementTree as ET

DST = Path(__file__).resolve().parents[1] / "qetgen" / "elementos" / "99_qetgen"
STYLE = "line-style:normal;line-weight:normal;filling:none;color:black"
FONT = "Sans Serif,{},-1,5,50,0,0,0,0,0"


def u():
    return "{" + str(uuid.uuid4()) + "}"


class Sym:
    def __init__(self, name_es, name_en, w, h, hx, hy):
        self.root = ET.Element("definition", {
            "type": "element", "link_type": "simple", "version": "0.90",
            "width": str(w), "height": str(h), "hotspot_x": str(hx), "hotspot_y": str(hy)})
        ET.SubElement(self.root, "uuid", {"uuid": u()})
        names = ET.SubElement(self.root, "names")
        ET.SubElement(names, "name", {"lang": "es"}).text = name_es
        ET.SubElement(names, "name", {"lang": "en"}).text = name_en
        ET.SubElement(self.root, "elementInformations")
        ET.SubElement(self.root, "informations").text = "Autor: qetgen. Licencia CC-BY 3.0"
        self.d = ET.SubElement(self.root, "description")

    def line(self, x1, y1, x2, y2):
        ET.SubElement(self.d, "line", {"x1": str(x1), "y1": str(y1), "x2": str(x2), "y2": str(y2),
                                       "antialias": "false", "end1": "none", "end2": "none",
                                       "length1": "1.5", "length2": "1.5", "style": STYLE})

    def rect(self, x, y, w, h):
        ET.SubElement(self.d, "rect", {"x": str(x), "y": str(y), "width": str(w), "height": str(h),
                                       "antialias": "false", "style": STYLE})

    def poly(self, pts):
        a = {"antialias": "false", "closed": "false", "style": STYLE}
        for i, (x, y) in enumerate(pts, 1):
            a[f"x{i}"], a[f"y{i}"] = str(x), str(y)
        ET.SubElement(self.d, "polygon", a)

    def text(self, x, y, txt, size=7):
        ET.SubElement(self.d, "text", {"x": str(x), "y": str(y), "text": txt, "rotation": "0",
                                       "font": FONT.format(size), "color": "#000000"})

    def label(self, x, y):
        dt = ET.SubElement(self.d, "dynamic_text", {
            "x": str(x), "y": str(y), "z": "10", "rotation": "0", "uuid": u(), "text_from": "ElementInfo",
            "Halignment": "AlignLeft", "Valignment": "AlignTop", "text_width": "-1",
            "keep_visual_rotation": "false", "frame": "false", "font": FONT.format(9)})
        ET.SubElement(dt, "text")
        ET.SubElement(dt, "info_name").text = "label"

    def term(self, x, y, o, name=""):
        ET.SubElement(self.d, "terminal", {"x": str(x), "y": str(y), "orientation": o,
                                           "name": name, "type": "Generic", "uuid": u()})

    def save(self, fname):
        DST.mkdir(parents=True, exist_ok=True)
        tree = ET.ElementTree(self.root)
        ET.indent(tree, space="    ")
        tree.write(DST / fname, encoding="utf-8")


def tripolar(s, inn=("L1", "L2", "L3"), out=("U", "V", "W")):
    """Caja 60x50 con 3 bornes arriba y 3 abajo (paso 20, sobre la grilla)."""
    s.rect(-30, -25, 60, 50)
    for i, x in enumerate((-20, 0, 20)):
        s.line(x, -40, x, -25)
        s.line(x, 25, x, 40)
        s.term(x, -40, "n", inn[i])
        s.term(x, 40, "s", out[i])
        s.text(x + 2, -28, inn[i], 4)
        s.text(x + 2, 34, out[i], 4)
    s.label(36, -12)


def main():
    v = Sym("Variador de frecuencia", "Variable frequency drive", 100, 90, 40, 45)
    tripolar(v)
    v.line(-30, 25, 30, -25)
    v.text(-25, -9, "~", 10)
    v.text(14, 20, "~", 10)
    v.text(4, 20, "f", 7)
    v.save("variador.elmt")

    p = Sym("Partidor suave", "Soft starter", 100, 90, 40, 45)
    tripolar(p)
    p.poly([(-22, 15), (-8, 15), (12, -12), (22, -12)])
    p.text(-24, -12, "U", 7)
    p.text(10, 21, "t", 7)
    p.save("partidor_suave.elmt")

    # Borne de un equipo (variador, PLC...) usado en el mando: salida (borne abajo) y entrada (borne arriba)
    for fname, o, ty, tag in (("borne_equipo_salida.elmt", "s", 20, "salida"),
                              ("borne_equipo_entrada.elmt", "n", -20, "entrada")):
        b = Sym(f"Borne de equipo ({tag})", f"Device terminal ({'output' if o == 's' else 'input'})", 50, 50, 15, 25)
        b.rect(-12, -8, 24, 16)
        b.line(0, ty, 0, 8 if o == "s" else -8)
        b.term(0, ty, o)
        b.label(16, -10)
        b.save(fname)


if __name__ == "__main__":
    main()
