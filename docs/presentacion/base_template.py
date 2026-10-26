"""Prepara la plantilla base del curso a partir de 04-Testing.pptx.

La presentación del profesor pesa unos 20 MB: 7 masters, 98 layouts, 100 diapositivas
e imágenes. Para el deck nuevo solo necesitamos:

- la portada (diapositiva 1, con su ilustración y el logo UC),
- el master de contenido (fondo blanco, títulos Bitter y texto Inter) con 4 layouts,
- las fuentes incrustadas que usan esos elementos.

Este script borra todo lo demás a nivel de paquete (zip + XML), sin dejar partes
huérfanas, y escribe plantilla/base-curso.pptx (unos cientos de KB).

Uso:
    python base_template.py "/ruta/a/04-Testing.pptx"
"""

from __future__ import annotations

import posixpath
import re
import sys
import zipfile
from pathlib import Path

from lxml import etree

HERE = Path(__file__).resolve().parent
OUT = HERE / "plantilla" / "base-curso.pptx"

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
}
R_ID = "{%s}id" % NS["r"]

# Master de la portada (layout TITLE con la ilustración) y master de contenido.
KEEP_MASTERS = {
    "ppt/slideMasters/slideMaster2.xml": {"ppt/slideLayouts/slideLayout12.xml"},
    "ppt/slideMasters/slideMaster3.xml": {
        "ppt/slideLayouts/slideLayout46.xml",  # TITLE_AND_BODY
        "ppt/slideLayouts/slideLayout47.xml",  # TITLE_2 (frase central)
        "ppt/slideLayouts/slideLayout48.xml",  # TITLE_ONLY (la mayoría de las diapositivas)
        "ppt/slideLayouts/slideLayout58.xml",  # BLANK
    },
}
KEEP_SLIDES = {"ppt/slides/slide1.xml"}  # portada


def rels_path(part: str) -> str:
    d, f = posixpath.split(part)
    return posixpath.join(d, "_rels", f + ".rels")


def resolve(part: str, target: str) -> str:
    return posixpath.normpath(posixpath.join(posixpath.dirname(part), target))


def parse(data: bytes) -> etree._Element:
    return etree.fromstring(data, etree.XMLParser(remove_blank_text=False))


def dump(el: etree._Element) -> bytes:
    return etree.tostring(el, xml_declaration=True, encoding="UTF-8", standalone=True)


def build_base(original: Path, out: Path = OUT) -> Path:
    with zipfile.ZipFile(original) as z:
        parts = {n: z.read(n) for n in z.namelist()}

    # 1. presentation.xml: solo la portada y los dos masters que usamos.
    pres = "ppt/presentation.xml"
    pres_rels_name = rels_path(pres)
    pres_rels = parse(parts[pres_rels_name])
    rid_target = {
        r.get("Id"): resolve(pres, r.get("Target")) for r in pres_rels.findall("rel:Relationship", NS)
    }
    pres_xml = parse(parts[pres])
    drop_rids: set[str] = set()
    for sld in pres_xml.findall("p:sldIdLst/p:sldId", NS):
        if rid_target[sld.get(R_ID)] not in KEEP_SLIDES:
            drop_rids.add(sld.get(R_ID))
            sld.getparent().remove(sld)
    for m in pres_xml.findall("p:sldMasterIdLst/p:sldMasterId", NS):
        if rid_target[m.get(R_ID)] not in KEEP_MASTERS:
            drop_rids.add(m.get(R_ID))
            m.getparent().remove(m)

    # 2. En cada master, solo los layouts que usamos.
    for master, keep_layouts in KEEP_MASTERS.items():
        mrels_name = rels_path(master)
        mrels = parse(parts[mrels_name])
        mrid = {r.get("Id"): resolve(master, r.get("Target")) for r in mrels.findall("rel:Relationship", NS)}
        mxml = parse(parts[master])
        dropped = set()
        for lid in mxml.findall("p:sldLayoutIdLst/p:sldLayoutId", NS):
            if mrid[lid.get(R_ID)] not in keep_layouts:
                dropped.add(lid.get(R_ID))
                lid.getparent().remove(lid)
        for r in mrels.findall("rel:Relationship", NS):
            if r.get("Id") in dropped:
                mrels.remove(r)
        parts[master] = dump(mxml)
        parts[mrels_name] = dump(mrels)

    # 3. La portada no lleva notas heredadas: python-pptx crea unas nuevas.
    srels_name = rels_path("ppt/slides/slide1.xml")
    srels = parse(parts[srels_name])
    for r in srels.findall("rel:Relationship", NS):
        if r.get("Type").endswith("/notesSlide"):
            srels.remove(r)
    parts[srels_name] = dump(srels)

    # 4. Fuentes incrustadas: solo las que aparecen en las partes que quedan.
    used_fonts: set[str] = set()
    for name in [*KEEP_SLIDES, *KEEP_MASTERS, *(l for ls in KEEP_MASTERS.values() for l in ls)]:
        used_fonts |= set(re.findall(rb'typeface="([^"]+)"', parts[name]))
    used = {f.decode() for f in used_fonts}
    for ef in pres_xml.findall("p:embeddedFontLst/p:embeddedFont", NS):
        face = ef.find("p:font", NS).get("typeface")
        if face not in used:
            for child in ef:
                if child.get(R_ID):
                    drop_rids.add(child.get(R_ID))
            ef.getparent().remove(ef)

    for r in pres_rels.findall("rel:Relationship", NS):
        if r.get("Id") in drop_rids:
            pres_rels.remove(r)
    parts[pres] = dump(pres_xml)
    parts[pres_rels_name] = dump(pres_rels)

    # 5. Recorre las relaciones desde la raíz y descarta todo lo inalcanzable.
    reachable: set[str] = set()
    stack = ["_rels/.rels"]
    while stack:
        rname = stack.pop()
        if rname not in parts:
            continue
        owner = rname.replace("_rels/", "").removesuffix(".rels")
        for r in parse(parts[rname]).findall("rel:Relationship", NS):
            if r.get("TargetMode") == "External":
                continue
            target = resolve(owner, r.get("Target")) if owner else r.get("Target").lstrip("/")
            if target in parts and target not in reachable:
                reachable.add(target)
                stack.append(rels_path(target))
    keep = {"[Content_Types].xml", "_rels/.rels"} | reachable
    keep |= {rels_path(p) for p in reachable if rels_path(p) in parts}
    parts = {n: b for n, b in parts.items() if n in keep}

    # 6. [Content_Types].xml sin overrides de partes borradas.
    ct = parse(parts["[Content_Types].xml"])
    for o in ct.findall("ct:Override", NS):
        if o.get("PartName").lstrip("/") not in parts:
            ct.remove(o)
    parts["[Content_Types].xml"] = dump(ct)

    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        # [Content_Types].xml primero, como recomienda OPC.
        z.writestr("[Content_Types].xml", parts.pop("[Content_Types].xml"))
        for name in sorted(parts):
            z.writestr(name, parts[name])
    return out


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    path = build_base(Path(sys.argv[1]))
    print(f"Plantilla base: {path} ({path.stat().st_size / 1024:.0f} KB)")
