"""Uso: python -m qetgen especificacion.yaml [-o salida.qet] [--bom lista.csv]"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from .bom import write_bom
from .circuits import generate
from .library import Library


def load_spec(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        return json.loads(text)
    import yaml  # PyYAML

    return yaml.safe_load(text)


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(prog="qetgen", description="Genera planos de fuerza y mando para QElectroTech")
    ap.add_argument("spec", type=Path, help="Especificación YAML o JSON")
    ap.add_argument("-o", "--output", type=Path, help="Archivo .qet de salida")
    ap.add_argument("--bom", type=Path, help="Archivo CSV con la lista de materiales")
    ap.add_argument("--lib", action="append", default=[], help="Carpeta extra de elementos .elmt")
    a = ap.parse_args(argv)

    spec = load_spec(a.spec)
    project = generate(spec, Library(a.lib), base_dir=a.spec.parent)
    out = a.output or a.spec.with_suffix(".qet")
    project.save(out)
    print(f"Proyecto generado: {out}  ({len(project.folios)} folios)")
    bom = a.bom or out.with_name(out.stem + "_materiales.csv")
    write_bom(project, bom)
    print(f"Lista de materiales: {bom}")


if __name__ == "__main__":
    main()
