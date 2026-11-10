"""Plantilla de empresa: se toma de un proyecto .qet de referencia.

De la referencia se reutiliza:
- el/los cajetines (titleblock templates, con logos) y el tamaño de folio,
- la configuración de proyecto (<newdiagrams>: conductores, referencias cruzadas...),
- los símbolos incrustados en su colección (tienen prioridad sobre la biblioteca estándar),
- folios completos para copiar tal cual (p.ej. PORTADA o DATOS TÉCNICOS), con reemplazo de textos.

El archivo de referencia NO se modifica.
"""
from __future__ import annotations

import copy
import unicodedata
from pathlib import Path
from xml.etree import ElementTree as ET


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return " ".join(s.upper().replace(".", " ").split())


class Plantilla:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.root = ET.parse(self.path).getroot()
        self.titleblocks = self.root.find("titleblocktemplates")
        self.newdiagrams = self.root.find("newdiagrams")
        self.diagrams = self.root.findall("diagram")
        b = self.newdiagrams.find("border") if self.newdiagrams is not None else None
        first = self.diagrams[0].attrib if self.diagrams else {}
        src = b.attrib if b is not None else first
        self.cols = int(src.get("cols", 17))
        self.colsize = int(float(src.get("colsize", 60)))
        self.rows = int(src.get("rows", 8))
        self.rowsize = int(float(src.get("rowsize", 80)))
        self.titleblock_name = first.get("titleblocktemplate") or (
            self.newdiagrams.find("inset").get("titleblocktemplate", "") if self.newdiagrams is not None else "")
        self.titleblock_collection = first.get("titleblocktemplateCollection", "embedded")
        self.elements = self._embedded_elements()

    def _embedded_elements(self) -> dict[str, ET.Element]:
        """{ruta relativa: <definition>} de la colección incrustada (bajo la categoría 'import')."""
        out: dict[str, ET.Element] = {}
        coll = self.root.find("collection")
        if coll is None:
            return out

        def walk(node: ET.Element, prefix: list[str]):
            for ch in node:
                if ch.tag == "category":
                    walk(ch, prefix + [ch.get("name", "")])
                elif ch.tag == "element":
                    d = ch.find("definition")
                    if d is not None:
                        out["/".join(prefix[1:] + [ch.get("name", "")])] = d

        walk(coll, [])
        return out

    def folio(self, title: str) -> ET.Element | None:
        """Primer folio cuyo título coincide (sin importar mayúsculas/tildes)."""
        key = _norm(title)
        for d in self.diagrams:
            if _norm(d.get("title", "")) == key:
                return d
        return None

    def titleblocks_xml(self) -> ET.Element | None:
        return copy.deepcopy(self.titleblocks) if self.titleblocks is not None else None

    def newdiagrams_xml(self) -> ET.Element | None:
        return copy.deepcopy(self.newdiagrams) if self.newdiagrams is not None else None
