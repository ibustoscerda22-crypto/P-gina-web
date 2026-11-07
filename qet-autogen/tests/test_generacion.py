"""Pruebas de coherencia del .qet generado (ejecutar: python -m pytest tests  o  python tests/test_generacion.py)."""
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import yaml  # noqa: E402

from qetgen.circuits import generate  # noqa: E402
from qetgen.library import Library  # noqa: E402

DOCK = {"0": (0, 4), "2": (0, -4), "1": (-4, 0), "3": (4, 0)}


def _project(tmp: Path):
    spec = yaml.safe_load((Path(__file__).parents[1] / "ejemplos" / "planta_ejemplo.yaml").read_text("utf-8"))
    out = generate(spec, Library()).save(tmp / "planta.qet")
    return ET.parse(out).getroot()


def test_conductores_apuntan_a_bornes_existentes(tmp_path):
    root = _project(tmp_path)
    for diagram in root.iter("diagram"):
        ids = {t.get("id") for t in diagram.iter("terminal") if t.get("id")}
        conds = list(diagram.find("conductors"))
        assert conds, "folio sin conductores"
        for c in conds:
            assert c.get("terminal1") in ids and c.get("terminal2") in ids


def test_bornes_coinciden_con_la_definicion(tmp_path):
    root = _project(tmp_path)
    defs = {}
    for holder in root.find("collection").iter("element"):
        d = holder.find("definition")
        defs[holder.get("name")] = {(float(t.get("x")), float(t.get("y")), t.get("orientation"))
                                    for t in d.iter("terminal")}
    omap = {"0": "n", "1": "e", "2": "s", "3": "w"}
    for el in root.iter("element"):
        if not el.get("type"):
            continue
        name = el.get("type").rsplit("/", 1)[1]
        for t in el.find("terminals"):
            dx, dy = DOCK[t.get("orientation")]
            key = (float(t.get("x")) - dx, float(t.get("y")) - dy, omap[t.get("orientation")])
            assert key in defs[name], f"{name}: borne {key} no existe en la definición"


def test_trazados_coherentes(tmp_path):
    """La suma de segmentos debe llevar de un borne al otro (si no, QET descarta el trazado)."""
    root = _project(tmp_path)
    for diagram in root.iter("diagram"):
        pos = {}
        for el in diagram.iter("element"):
            ex, ey = float(el.get("x")), float(el.get("y"))
            for t in el.find("terminals"):
                dx, dy = DOCK[t.get("orientation")]
                pos[t.get("id")] = (ex + float(t.get("x")) - dx, ey + float(t.get("y")) - dy)
        for c in diagram.find("conductors"):
            segs = c.findall("segment")
            if not segs:
                continue
            w = sum(float(s.get("length")) for s in segs if s.get("orientation") == "horizontal")
            h = sum(float(s.get("length")) for s in segs if s.get("orientation") == "vertical")
            (x1, y1), (x2, y2) = pos[c.get("terminal1")], pos[c.get("terminal2")]
            assert abs((x2 - x1) - w) <= 1 and abs((y2 - y1) - h) <= 1


if __name__ == "__main__":
    import tempfile

    for fn in (test_conductores_apuntan_a_bornes_existentes, test_bornes_coinciden_con_la_definicion,
               test_trazados_coherentes):
        with tempfile.TemporaryDirectory() as d:
            fn(Path(d))
        print("OK", fn.__name__)
