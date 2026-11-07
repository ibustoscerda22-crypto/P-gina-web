"""Lista de materiales (CSV) a partir del proyecto generado."""
from __future__ import annotations

import csv
from pathlib import Path

from .project import Project

SKIP = {"slave", "next_report", "previous_report"}


def write_bom(project: Project, path: str | Path) -> Path:
    rows = []
    for n, f in enumerate(project.folios, 1):
        for el in f.elements:
            if el.definition.link_type in SKIP or not el.label or el.label == "RED":
                continue
            funcion = " ".join(t.text.replace("\n", " ") for t in el.texts if t.text)
            rows.append((el.label, el.definition.name("es"), funcion, f"{n} - {f.title}"))
    path = Path(path)
    with path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(["Etiqueta", "Equipo", "Función", "Folio"])
        w.writerows(rows)
    return path
