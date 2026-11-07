"""Carga de definiciones de elementos (.elmt) de la biblioteca de QElectroTech."""
from __future__ import annotations

import copy
import os
from dataclasses import dataclass, field
from pathlib import Path
from xml.etree import ElementTree as ET

ORIENT = {"n": 0, "e": 1, "s": 2, "w": 3}

BUNDLED = Path(__file__).parent / "elementos"
SYSTEM_PATHS = [
    Path("/usr/share/qelectrotech/elements"),
    Path("/usr/local/share/qelectrotech/elements"),
    Path("C:/Program Files/QElectroTech/elements"),
    Path("C:/Program Files (x86)/QElectroTech/elements"),
    Path("/Applications/qelectrotech.app/Contents/Resources/elements"),
]


@dataclass
class TerminalDef:
    x: float
    y: float
    orientation: str  # n, e, s, w
    name: str = ""
    uuid: str = ""


@dataclass
class ElementDef:
    path: str  # ruta relativa dentro de la biblioteca, p.ej. 10_electric/.../bobine3.elmt
    root: ET.Element
    terminals: list[TerminalDef] = field(default_factory=list)

    @property
    def link_type(self) -> str:
        return self.root.get("link_type", "simple")

    @property
    def kind_type(self) -> str:
        for k in self.root.iter("kindInformation"):
            if k.get("name") == "type":
                return (k.text or "").strip()
        return ""

    def name(self, lang: str = "es") -> str:
        names = {n.get("lang"): n.text for n in self.root.iter("name")}
        return names.get(lang) or names.get("en") or Path(self.path).stem

    def label_anchor(self) -> tuple[float, float] | None:
        """Posición del texto 'label' en la definición (input tagg=label o dynamic_text)."""
        for dt in self.root.iter("dynamic_text"):
            info = dt.find("info_name")
            if info is not None and (info.text or "") == "label":
                return float(dt.get("x", 0)), float(dt.get("y", 0))
        for i in self.root.iter("input"):
            if i.get("tagg") == "label":
                return float(i.get("x", 0)), float(i.get("y", 0)) - 8
        return None

    def has_dynamic_label(self) -> bool:
        for dt in self.root.iter("dynamic_text"):
            info = dt.find("info_name")
            if info is not None and (info.text or "") == "label":
                return True
        return False


class Library:
    """Busca elementos primero en las rutas extra, luego en la copia incluida y en QElectroTech."""

    def __init__(self, extra_paths: list[str | Path] | None = None):
        paths: list[Path] = [Path(p) for p in (extra_paths or [])]
        env = os.environ.get("QET_ELEMENTS")
        if env:
            paths.append(Path(env))
        paths.append(BUNDLED)
        paths += SYSTEM_PATHS
        self.paths = [p for p in paths if p.is_dir()]
        self._cache: dict[str, ElementDef] = {}

    def locate(self, rel: str) -> Path:
        for base in self.paths:
            f = base / rel
            if f.is_file():
                return f
        raise FileNotFoundError(f"Elemento no encontrado en la biblioteca: {rel} (rutas: {self.paths})")

    def get(self, rel: str) -> ElementDef:
        if rel not in self._cache:
            f = self.locate(rel)
            root = ET.parse(f).getroot()
            terms = [
                TerminalDef(
                    x=float(t.get("x", 0)),
                    y=float(t.get("y", 0)),
                    orientation=t.get("orientation", "n"),
                    name=t.get("name", ""),
                    uuid=t.get("uuid", ""),
                )
                for t in root.iter("terminal")
            ]
            self._cache[rel] = ElementDef(rel, root, terms)
        return self._cache[rel]

    def category_names(self, rel_dir: str) -> ET.Element | None:
        """Devuelve el nodo <names> del archivo qet_directory de una categoría, si existe."""
        for base in self.paths:
            f = base / rel_dir / "qet_directory"
            if f.is_file():
                try:
                    names = ET.parse(f).getroot().find("names")
                    return copy.deepcopy(names) if names is not None else None
                except ET.ParseError:
                    return None
        return None
