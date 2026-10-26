"""Genera la presentación de la clase práctica.

    python build_deck.py                      # escribe Full-Stack-Testing-IA-DevSecOps.pptx
    python build_deck.py --render /tmp/png    # además la convierte a PDF y PNG para revisarla
    python build_deck.py --base "/ruta/04-Testing.pptx"   # regenera la plantilla base

La plantilla base (plantilla/base-curso.pptx) sale de 04-Testing.pptx del profesor con
base_template.py: misma portada, mismo master y mismas fuentes, sin sus diapositivas.
Todos los diagramas son formas nativas editables.

Reglas que el generador verifica antes de guardar (falla si no se cumplen):
- Estilo del texto: sin guiones largos ni medios, sin punto y coma, sin voseo.
- Notas del orador en todas las diapositivas.
- Tamaños para proyectar: cuerpo de 12 pt o más, código de 10 pt o más y notas al margen
  (fuentes, pies de imagen) de 10 pt o más.
Los fragmentos de código son extractos reales del repo: "..." marca líneas omitidas.
"""

from __future__ import annotations

import argparse
import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import deck_kit as k
from deck_kit import (AQUA, BLACK, BLUE, BORDER, CODEBG, DPURPLE, GRAY, GREEN, INK, LIGHT, LIGHTBLUE, MUTED,
                      ORANGE, PINK, PLUM, PURPLE, RED, SAGE, TEAL, WHITE, Deck)

HERE = Path(__file__).resolve().parent
BASE = HERE / "plantilla" / "base-curso.pptx"
OUT = HERE / "Full-Stack-Testing-IA-DevSecOps.pptx"
IMG = HERE / "img"  # capturas reales de frontend/evidence (las toma Playwright en el pipeline)
REPO_URL = "github.com/UC-IIC-3143-Software-Development/full_stack_testing"
PULLS_URL = "https://github.com/UC-IIC-3143-Software-Development/full_stack_testing/pulls"

# Colores por tipo de etapa del pipeline (se repiten en todo el deck)
C_SEC = RED
C_QUAL = TEAL
C_TEST = GREEN
C_BUILD = ORANGE
C_EVID = PLUM
PINKBG = "FCE8EC"


# ============================================================================
# Helpers de composición
# ============================================================================
def source(d: Deck, s, text: str, x=0.45, y=5.02, w=8.3, align="l"):
    """Fuente o nota al margen al pie de la diapositiva (10 pt, gris)."""
    return d.text(s, x, y, w, 0.26, text, size=10, color=MUTED, align=align, caption=True)


def bullet_card(d: Deck, s, x, y, w, h, title, items, fill=LIGHT, title_color=TEAL, size=12, space_after=6):
    """Tarjeta con título en negrita y viñetas."""
    d.card(s, x, y, w, h, fill=fill)
    d.text(s, x + 0.15, y + 0.1, w - 0.3, 0.3, title, size=13, bold=True, color=title_color)
    d.text(s, x + 0.15, y + 0.48, w - 0.3, h - 0.55, items, size=size, bullets=True, space_after=space_after)


LABEL_COL = {"Qué es": TEAL, "Qué detecta": GREEN, "Herramienta": ORANGE, "Dónde corre": PLUM}


def type_slide(d: Deck, title: str, rows: list[tuple[str, str]], code, filename: str = "", lang="ts",
               notes="", book: str = "", layout="grid", code_w=6.1):
    """Formato común para cada tipo de prueba.

    layout="grid": las cuatro filas (qué es, qué detecta, herramienta, dónde corre) en una grilla de
    2 x 2 arriba y el código real a todo el ancho abajo (sirve para líneas largas).
    layout="side": las filas en una columna a la izquierda y uno o más bloques de código a la derecha.
    `code` es un string o una lista de (código, título).
    """
    s = d.content(title)
    blocks = code if isinstance(code, list) else [(code, filename)]
    if layout == "grid":
        cell_w, chip_w = 4.5, 1.3
        row_h = []
        for r in range(2):
            pair = rows[r * 2:r * 2 + 2]
            lines = max(k.est_lines(t, cell_w - chip_w - 0.2, 12) for _, t in pair)
            row_h.append(max(0.42, lines * 0.2 + 0.06))
        y = 1.05
        for r in range(2):
            for c in range(2):
                label, txt = rows[r * 2 + c]
                x = 0.45 + c * (cell_w + 0.1)
                d.chip(s, x, y + 0.02, chip_w, 0.32, label, fill=LABEL_COL.get(label, GRAY), size=12)
                d.text(s, x + chip_w + 0.12, y - 0.02, cell_w - chip_w - 0.12, row_h[r], txt, size=12,
                       space_after=0)
            y += row_h[r] + 0.07
        top = y + 0.04
        bottom = 5.0
        total_lines = sum(len(src.strip("\n").split("\n")) for src, _ in blocks)
        avail = bottom - top - 0.12 * (len(blocks) - 1)
        for src, ttl in blocks:
            n = len(src.strip("\n").split("\n"))
            h = (avail - 0.4 * len(blocks)) * n / total_lines + 0.4 if len(blocks) > 1 else avail
            d.code(s, 0.45, top, 9.1, h, src, lang=lang, title=ttl)
            top += h + 0.12
    else:
        left_w = 9.1 - code_w - 0.2
        y = 1.1
        for label, txt in rows:
            lines = k.est_lines(txt, left_w - 0.08, 12)
            h = lines * 0.2 + 0.06
            d.chip(s, 0.45, y, 1.4, 0.3, label, fill=LABEL_COL.get(label, GRAY), size=12)
            d.text(s, 0.45, y + 0.32, left_w, h, txt, size=12, space_after=0)
            y += 0.32 + h + 0.12
        if y > 5.0:
            k.WARNINGS.append(f"Filas de tipo de prueba desbordan ({y:.2f}): {title}")
        x = 0.45 + left_w + 0.2
        top, bottom = 1.1, 4.98
        total_lines = sum(len(src.strip("\n").split("\n")) for src, _ in blocks)
        avail = bottom - top - 0.12 * (len(blocks) - 1)
        for src, ttl in blocks:
            n = len(src.strip("\n").split("\n"))
            h = (avail - 0.4 * len(blocks)) * n / total_lines + 0.4 if len(blocks) > 1 else avail
            d.code(s, x, top, code_w, h, src, lang=lang, title=ttl)
            top += h + 0.12
    if book:
        source(d, s, book, y=5.04)
    d.notes(s, notes)
    return s


# ============================================================================
# A. Apertura
# ============================================================================
def part_a(d: Deck):
    d.section("Apertura")
    s = d.prs.slides[0]
    d._register(s)
    title, sub = [sh for sh in s.placeholders][:2]
    # Se reemplaza solo el texto: fuente, color y tamaño de la portada original se conservan.
    k.replace_text(title.text_frame, ["Full Stack Testing moderno con IA y DevSecOps"], size=30)
    sub.top = k.Inches(3.45)
    sub.height = k.Inches(0.75)
    k.replace_text(sub.text_frame, ["Clase práctica · IIC3143 Desarrollo de Software",
                                    "Gonzalo Martínez · gonzalo.martinez@uc.cl"], size=12)
    d.notes(s, """
        Bienvenida. Esta es una clase práctica: vamos a recorrer un proyecto real (Biblioteca UC, NestJS
        más Next.js) y su pipeline de CI. La pregunta que guía toda la clase es cómo aprovechar la IA para
        escribir software y tests sin terminar con miles de tests que no aportan. La base es el libro Full
        Stack Testing de Gayathri Mohan, segunda edición (O'Reilly 2026). El repo está en GitHub:
        UC-IIC-3143-Software-Development/full_stack_testing.
    """)

    s = d.content("Agenda")
    items = [
        ("Por qué ahora", "La IA y la explosión de tests", PINK),
        ("Spec Driven Development", "La spec manda, también a la IA", TEAL),
        ("El proyecto", "Biblioteca UC en capas", ORANGE),
        ("Tipos de prueba", "Uno por uno, con código real", GREEN),
        ("DevSecOps y CI", "Etapas, ramas y seguridad", PLUM),
        ("Evidencia en el PR", "Capturas, videos y endpoints", AQUA),
        ("Actividad práctica", "SPEC-LIB-03 con un agente", BLUE),
        ("Cierre", "Conclusiones y discusión", GRAY),
    ]
    w, h, gap = 2.15, 1.7, 0.2
    for i, (t, sub_t, col) in enumerate(items):
        x = 0.45 + (i % 4) * (w + gap)
        y = 1.2 + (i // 4) * (h + 0.22)
        d.card(s, x, y, w, h, fill=LIGHT)
        d.circle_num(s, x + 0.15, y + 0.15, 0.42, i + 1, fill=col, size=13)
        d.text(s, x + 0.15, y + 0.62, w - 0.3, 0.46, t, size=13, bold=True, color=INK, anchor="b")
        d.text(s, x + 0.15, y + 1.1, w - 0.3, 0.52, sub_t, size=12, color=GRAY)
    d.notes(s, """
        Siete partes y un cierre. Las partes 1 y 2 son el marco: por qué la IA cambia la forma de testear y
        cómo Spec Driven Development pone orden. Las partes 3 y 4 son el proyecto y cada tipo de prueba con
        su código. La parte 5 es DevSecOps y el pipeline, la 6 es la evidencia que queda en cada PR y la 7
        es la actividad práctica, donde implementan una feature nueva con un agente de IA y la comparan con
        el PR de ejemplo del repo.
    """)

    s = d.content("Al terminar la clase podrás")
    objs = [
        ("Explicar", "por qué más tests no es más calidad y qué barandas evitan que la IA infle la suite.", PINK),
        ("Especificar", "reglas con ID, un contrato OpenAPI y flujos Gherkin que guían a personas y agentes.", TEAL),
        ("Elegir", "el tipo de prueba y la capa correcta para cada riesgo, desde unit hasta DAST.", GREEN),
        ("Leer", "un pipeline de CI con DevSecOps y la evidencia que deja en cada Pull Request.", PLUM),
    ]
    for i, (verb, txt, col) in enumerate(objs):
        y = 1.3 + i * 0.9
        d.box(s, 0.9, y, 1.9, 0.62, verb, fill=col, size=15)
        d.text(s, 3.0, y, 6.2, 0.62, txt, size=14, anchor="m", color=INK)
    d.notes(s, """
        Cuatro verbos. Al final de la clase cada estudiante debería poder explicar, especificar, elegir y
        leer. Fíjate que ninguno dice escribir tests: escribir tests ya lo hace la IA en segundos. Lo que
        no hace bien es decidir cuáles valen la pena, en qué capa van y cómo se verifican en CI.
    """)

    s = d.center([
        "La IA escribe tests más rápido que cualquiera.",
        "El desafío ya no es [r]escribir tests[/], es [g]decidir cuáles valen la pena[/].",
    ], size=28)
    d.notes(s, """
        Frase para abrir la discusión. Pregunta al curso: si un agente te entrega 80 tests en un PR y todos
        pasan, ¿lo aceptas? La respuesta de esta clase es: depende de en qué capa están, qué regla verifica
        cada uno y si detectan defectos reales. Eso es lo que vamos a aprender a medir.
    """)


# ============================================================================
# B. Por qué ahora
# ============================================================================
def part_b(d: Deck):
    d.section("1. Por qué ahora")
    s = d.divider("Parte 1", "Por qué ahora", "La IA acelera el código y los tests. ¿Quién decide qué entra a la suite?")
    d.notes(s, "Primera parte: la evidencia del libro y de la industria sobre la IA generando tests.")

    s = d.content("Lo que encontró el libro al pedirle tests a la IA")
    stats = [
        ("70 a 80", "casos de prueba", "entregó Claude para el inicio de Amazon: muchos duplicados y con lógica "
         "de negocio inventada.", "p. 37", PINK),
        ("30", "tests REST Assured", "generó Claude Code desde un OpenAPI. Las validaciones de campos que "
         "incluyó van en unit.", "p. 102", ORANGE),
        ("en lote", "sin capa", "Las herramientas de IA tienden a generar tests en lote que no pertenecen a "
         "ninguna capa.", "p. 118", TEAL),
    ]
    for i, (big, label, txt, page, col) in enumerate(stats):
        x = 0.45 + i * 3.1
        d.card(s, x, 1.12, 2.9, 2.75, fill=LIGHT)
        d.text(s, x + 0.2, 1.2, 2.5, 0.7, big, size=34, bold=True, color=col, font=k.FONT_TITLE)
        d.text(s, x + 0.2, 1.9, 2.5, 0.3, label, size=13, bold=True, color=INK)
        d.text(s, x + 0.2, 2.25, 2.5, 1.25, txt, size=12, color=INK)
        d.text(s, x + 0.2, 3.52, 2.5, 0.26, f"Full Stack Testing, {page}", size=10, color=MUTED, caption=True)
    d.text(s, 0.45, 4.05, 9.1, 0.85, [
        "“Successful AI adoption is a **systems problem, not a tools problem**.”",
        "DORA, State of AI-assisted Software Development 2025 (citado en el libro, p. 15)",
    ], size=13, align="c", color=INK, space_after=2)
    d.notes(s, """
        Tres datos del libro. Uno: con un prompt amplio, Claude entregó entre 70 y 80 casos para el home de
        Amazon, muchos duplicados o superficiales, y a veces inventó lógica de negocio. Con un alcance
        pequeño (solo la búsqueda) los casos fueron buenos: el alcance acotado es la mejor forma de usar
        estas herramientas. Dos: Claude Code generó 30 tests de API desde un OpenAPI, pero las validaciones
        de campos que incluyó van en unit. Tres: la conclusión del capítulo 3, la IA genera en lote y sin
        respetar capas. La cita de DORA resume la idea: el problema es del sistema de trabajo, no de la
        herramienta.
    """)

    s = d.content("Tests micro y macro (Tabla 3-1)")
    rows = [
        ["Tipo", "Nivel", "Qué valida", "Esfuerzo", "Tiempo"],
        ["Unit", "Micro", "Un método de una clase", "Mínimo", "Rápido"],
        ["Integración", "Micro", "Dos componentes juntos", "Mínimo a moderado", "Rápido"],
        ["Contrato", "Micro", "El contrato entre dos servicios", "Moderado", "Medio"],
        ["Servicio", "Macro", "La funcionalidad en la API", "Moderado", "Medio"],
        ["UI", "Macro", "Un recorrido en la web", "Moderado", "Lento"],
        ["End to end", "Macro", "El recorrido completo", "Máximo", "Lento"],
    ]
    d.table(s, 0.45, 1.12, 6.25, rows, [1.25, 0.8, 2.45, 1.45, 0.85], row_h=0.5, first_col_bold=True)
    bullet_card(d, s, 6.9, 1.12, 2.65, 3.5, "Antes de un test de UI", [
        "¿Cuál es el propósito de este test?",
        "¿Podría lograr lo mismo con un test micro, más abajo?",
        "Si la respuesta es sí, el test baja de capa. También se le pregunta a la IA.",
    ], fill=LIGHTBLUE, space_after=8)
    source(d, s, "Libro, tabla 3-1 y p. 71 y 72")
    d.notes(s, """
        La tabla 3-1 del libro ordena los tipos de test por alcance. Micro: unit, integración y contrato.
        Macro: servicio, UI y end to end. A medida que sube el alcance sube el esfuerzo y el tiempo. El
        recuadro de la derecha es la pregunta que el libro recomienda hacerse cada vez que alguien, persona
        o agente, quiere agregar un test de UI.
    """)

    s = d.content("La pirámide: 10x : 5x : x")
    # Una sola pendiente para las tres capas: cada capa es un tramo del mismo triángulo.
    layers = [("UI", "x", ORANGE), ("Servicio y contrato", "5x", AQUA), ("Unit e integración", "10x", GREEN)]
    cx, top_y, lh, gap, base_w = 2.55, 1.2, 1.05, 0.06, 4.2
    total_h = 3 * lh + 2 * gap

    def width_at(yy):
        return base_w * (yy - top_y) / total_h

    for i, (name, mult, col) in enumerate(layers):
        y = top_y + i * (lh + gap)
        wb, wt = width_at(y + lh), width_at(y)
        if i == 0:
            d.box(s, cx - wb / 2, y, wb, lh, "", fill=col, shape="triangle")
            d.text(s, cx - 0.6, y + 0.5, 1.2, 0.5, mult, size=16, bold=True, color=WHITE, align="c")
        else:
            sp = d.box(s, cx - wb / 2, y, wb, lh, "", fill=col, shape="trapezoid")
            sp.adjustments[0] = (wb - wt) / 2 / min(wb, lh)
            d.text(s, cx - 1.2, y + 0.1, 2.4, 0.4, mult, size=18, bold=True, color=WHITE, align="c")
            d.text(s, cx - 1.5, y + 0.55, 3.0, 0.4, name, size=12, bold=True, color=WHITE, align="c")
    source(d, s, "Mike Cohn, citado en el libro, p. 72", x=cx - 1.8, y=top_y + total_h + 0.1, w=3.6, align="c")
    d.card(s, 5.1, 1.2, 4.45, 1.5, fill=LIGHT)
    d.text(s, 5.3, 1.28, 4.0, 0.3, "Antes", size=13, bold=True, color=RED)
    d.text(s, 5.3, 1.62, 4.05, 1.0, "**200+ tests de UI** que tardaban **8 horas** y fallaban al final por "
           "componentes dependientes o infraestructura.", size=12)
    d.card(s, 5.1, 2.9, 4.45, 1.5, fill=LIGHT)
    d.text(s, 5.3, 2.98, 4.0, 0.3, "Después de adoptar la pirámide", size=13, bold=True, color=GREEN)
    d.text(s, 5.3, 3.32, 4.05, 1.0, "**470 tests** micro y macro con feedback en **35 minutos**.", size=12)
    source(d, s, "Libro, p. 66 y 73", x=5.1, y=4.5, w=4.45)
    d.notes(s, """
        La pirámide de Mike Cohn: por cada x tests de UI, unos 5x de servicio y 10x de unit e integración.
        No es una regla matemática, es una guía de costo: más arriba, más lento y más caro de mantener. El
        caso del libro es muy concreto: un equipo pasó de más de 200 tests de UI que tardaban 8 horas a 470
        tests en total con feedback en 35 minutos. Tener más tests no fue el problema, el problema era
        dónde estaban.
    """)

    s = d.content("Antipatrones: cono de helado y cupcake")

    def mini_pyramid(x0, y0):
        d.box(s, x0 + 0.55, y0, 0.7, 0.55, "", fill=ORANGE, shape="triangle")
        t = d.box(s, x0 + 0.25, y0 + 0.58, 1.3, 0.55, "", fill=AQUA, shape="trapezoid")
        t.adjustments[0] = 0.5
        t = d.box(s, x0, y0 + 1.16, 1.8, 0.55, "", fill=GREEN, shape="trapezoid")
        t.adjustments[0] = 0.4

    def cone(x0, y0):
        d.box(s, x0 + 0.2, y0, 1.6, 0.7, "Manual", fill="F4B6C2", color=INK, size=12, shape="oval")
        d.box(s, x0, y0 + 0.6, 2.0, 0.4, "UI", fill=ORANGE, size=12, shape="rect")
        d.box(s, x0 + 0.25, y0 + 1.02, 1.5, 0.36, "Servicio", fill=AQUA, size=12, shape="rect")
        tri = d.box(s, x0 + 0.55, y0 + 1.4, 0.9, 0.5, "", fill=GREEN, shape="triangle")
        tri.rotation = 180
        d.text(s, x0 + 0.4, y0 + 1.4, 1.2, 0.3, "Unit", size=12, color=WHITE, bold=True, align="c")

    def cupcake(x0, y0):
        d.box(s, x0 + 0.15, y0, 1.7, 0.58, "Manual", fill="F4B6C2", color=INK, size=12, shape="oval")
        d.box(s, x0 - 0.1, y0 + 0.5, 2.2, 0.4, "UI (duplica)", fill=ORANGE, size=12, shape="rect")
        d.box(s, x0 - 0.05, y0 + 0.92, 2.1, 0.4, "Servicio (duplica)", fill=AQUA, size=12, shape="rect")
        t = d.box(s, x0 + 0.1, y0 + 1.34, 1.8, 0.5, "", fill=GREEN, shape="trapezoid")
        t.rotation = 180
        d.text(s, x0 + 0.4, y0 + 1.42, 1.2, 0.3, "Unit", size=12, color=WHITE, bold=True, align="c")

    for x, label, col in [(0.45, "Lo ideal", GREEN), (3.55, "Cono de helado", RED), (6.65, "Cupcake", RED)]:
        d.text(s, x, 1.08, 2.9, 0.3, label, size=14, bold=True, color=col, align="c")
    mini_pyramid(1.0, 1.55)
    cone(4.0, 1.5)
    cupcake(7.1, 1.5)
    for x, items in [
        (0.45, ["Base ancha de tests micro", "Pocos tests macro que recorren flujos", "Cada test en una sola capa"]),
        (3.55, ["Muchos tests de UI, pocos micro", "Feedback lento, defectos tarde", "Pruebas manuales igual"]),
        (6.65, ["El mismo caso en unit, API y UI", "Releases lentos, culpas cruzadas", "La IA lo agrava"]),
    ]:
        d.text(s, x, 3.5, 2.9, 1.4, items, size=12, bullets=True, space_after=4)
    source(d, s, "Libro, p. 114 a 116", y=4.95, w=9.1, align="c")
    d.notes(s, """
        Los dos antipatrones del libro. Cono de helado: la pirámide invertida, muchos tests de UI y pocos
        micro. Síntomas: esperas largas, defectos en la etapa de release y pruebas manuales aunque haya
        automatización. Cupcake: el mismo caso se prueba en todas las capas, por ejemplo los logins
        inválidos en unit y otra vez en UI. El libro dice explícitamente que usar IA para subir la
        cobertura rápido aumenta la probabilidad del cupcake, porque genera en lote. La solución que
        propone: acordar en el kickoff de cada historia qué tests van en cada capa y dejarlo escrito. En
        este proyecto eso queda escrito en la spec.
    """)

    s = d.content("El mito del 100 por ciento")
    d.card(s, 0.45, 1.1, 4.45, 1.55, fill=LIGHT)
    d.text(s, 0.62, 1.16, 4.1, 0.3, "Cobertura de código", size=13, bold=True, color=TEAL)
    d.text(s, 0.62, 1.5, 4.15, 1.1, [
        "Dice qué líneas **no** ejecutó ningún test",
        "No dice si los tests verifican algo",
        "Puede ser alta con un módulo sin tests",
    ], size=12, bullets=True, space_after=2)
    d.card(s, 5.1, 1.1, 4.45, 1.55, fill=LIGHT)
    d.text(s, 5.27, 1.16, 4.1, 0.3, "Mutation testing", size=13, bold=True, color=GREEN)
    d.text(s, 5.27, 1.5, 4.15, 1.1, [
        "Cambia el código (un mutante) y corre los tests",
        "Si un test falla, el mutante muere",
        "Efectivo pero lento: úsalo con criterio",
    ], size=12, bullets=True, space_after=2)
    d.code(s, 0.45, 2.8, 9.1, 0.98, """
if (pending.length >= MAX_UNRETURNED_LOANS) {
  throw new LoanLimitReachedError(borrowerEmail.value, MAX_UNRETURNED_LOANS)
}""", title="backend/src/loans/domain/loan-policy.ts (LOAN-R2, extracto)")
    d.code(s, 0.45, 3.9, 4.6, 0.85, """
- if (pending.length >= MAX_UNRETURNED_LOANS) {
+ if (pending.length > MAX_UNRETURNED_LOANS) {""", lang="txt", title="Un mutante que crea Stryker")
    d.card(s, 5.2, 3.9, 4.35, 1.05, fill=PINKBG)
    d.text(s, 5.35, 3.95, 4.1, 0.95, "Si ningún test usa **exactamente 3** préstamos, el mutante sobrevive con "
           "100 por ciento de cobertura. Lo mata **[LOAN-R2] rechaza el cuarto préstamo**.", size=12,
           anchor="m")
    source(d, s, "Libro, p. 116 y 117")
    d.notes(s, """
        Cobertura de código y mutation testing no miden lo mismo. La cobertura solo dice qué líneas nunca
        se ejecutaron. El libro advierte que incluso con 100 por ciento de cobertura de automatización
        aparecen bugs, y que el porcentaje puede ser alto aunque un módulo entero no tenga tests. Mutation
        testing responde otra pregunta: si meto un bug, ¿algún test lo detecta? El ejemplo es real del
        proyecto: si Stryker cambia mayor o igual por mayor en el límite de préstamos y nadie prueba el
        caso de 3 préstamos exactos, el mutante sobrevive. En el repo lo mata el test del valor límite de
        loan-policy.spec.ts. Es la forma más honesta de evaluar una suite generada por IA.
    """)

    s = d.content("7 reglas para que la IA no infle la suite")
    rules = [
        ("La capa más baja posible", "Validaciones de campos en unit, no en API ni UI", "Revisión y revisor IA"),
        ("Una partición, un test", "Máximo 6 tests por regla y capa", "tools/spec-trace.mjs"),
        ("Sin mocks por defecto", "Objetos reales, fakes en memoria y reloj fijo", "ESLint (jest.fn, vi.fn)"),
        ("Oráculos explícitos", "El valor esperado se escribe literal", "Revisión y revisor IA"),
        ("Independencia", "Cada test prepara su propio estado", "Tests en paralelo"),
        ("Nada débil ni frágil", "Sin toBeTruthy, sin esperas fijas", "ESLint (toBeTruthy, waitForTimeout)"),
        ("La IA propone, tú apruebas", "Lista de casos primero, un test a la vez", "CLAUDE.md y AGENTS.md"),
    ]
    rows = [["#", "Regla (constitución P4)", "Qué significa", "Quién la hace cumplir"]]
    for i, (r, m, who) in enumerate(rules, 1):
        rows.append([str(i), f"**{r}**", m, who])
    d.table(s, 0.45, 1.08, 9.1, rows, [0.35, 2.55, 3.55, 2.65], row_h=0.45, align=["c", "l", "l", "l"])
    source(d, s, "Basadas en el libro: p. 71, 90, 94, 96, 102 y 107. Texto completo en specs/constitution.md",
           w=9.1, align="c")
    d.notes(s, """
        Estas son las 7 reglas de la constitución del proyecto, el archivo specs/constitution.md, principio
        P4. Salen del libro: la capa más baja posible (p. 71 y 102), una conducta por test y tests
        independientes (p. 107), no duplicar tests (instrucciones de Copilot, p. 90), generar un test a la
        vez (p. 94) y el flujo de dos pasos donde la persona elige qué casos automatizar en cada capa
        (p. 96). La última columna es lo importante: una regla que nadie verifica es una sugerencia. Por eso
        cada regla tiene un mecanismo: spec-trace cuenta los tests por regla y capa, ESLint prohíbe jest.fn,
        vi.fn, toBeTruthy y waitForTimeout, y el revisor de IA mira lo que una herramienta no puede medir.
    """)

    s = d.content("Las reglas también son código: tres barandas")
    layers = [
        ("1. Instrucciones", "CLAUDE.md, AGENTS.md y la constitución. El agente las lee antes de escribir.",
         "Guía, no garantiza", AQUA),
        ("2. Linter", "ESLint rechaza mocks, esperas fijas y tests sin ID. Semgrep, new Date() en el dominio.",
         "Falla en segundos", ORANGE),
        ("3. CI", "spec-trace falla el PR, el revisor IA comenta y la mutación corre de noche.",
         "Falla el PR", RED),
    ]
    for i, (t, desc, tag, col) in enumerate(layers):
        x = 0.45 + i * 3.08
        d.card(s, x, 1.05, 2.94, 1.47, fill=LIGHT)
        d.box(s, x + 0.12, 1.12, 2.7, 0.32, t, fill=col, size=12, align="l", margin=0.08)
        d.text(s, x + 0.12, 1.47, 2.72, 0.7, desc, size=12, space_after=0)
        d.text(s, x + 0.12, 2.18, 2.72, 0.28, tag, size=12, bold=True, color=col)
    d.code(s, 0.45, 2.6, 9.1, 2.42, r"""
const TITLE_WITH_RULE_ID = '/^\\[[A-Z]+(-[A-Z0-9]+)+\\] /'
...
  'no-restricted-properties': [
    'error',
    { object: 'vi', property: 'fn', message: 'P4.3: usa objetos reales o fakes en memoria.' },
    { object: 'vi', property: 'mock', message: 'P4.3: usa MSW o fakes en memoria.' },
    ...
    {
      property: 'waitForTimeout',
      message: 'P4.6: nada de esperas fijas. Usa aserciones web-first.',
    },""", lang="js", title="frontend/eslint.config.mjs (extracto)")
    d.notes(s, """
        Las reglas se hacen cumplir en tres niveles. Primero las instrucciones: CLAUDE.md, AGENTS.md y la
        constitución, que el agente lee antes de escribir. Ayudan, pero un agente puede ignorarlas. Segundo
        el linter: el ESLint del frontend prohíbe vi.fn, vi.mock, toBeTruthy y waitForTimeout, y exige que
        cada título de test empiece con un ID de regla (en el backend lo mismo con jest.fn). Falla en
        segundos, en el editor o en la etapa 2 del pipeline. Semgrep agrega reglas propias, por ejemplo
        nada de new Date() en el dominio. Tercero el CI: spec-trace y el revisor de IA comentan o fallan el
        PR, y la mutación revisa la suite cada noche. Mientras más abajo en esta lista, más difícil es
        saltarse la regla.
    """)

    s = d.content("Qué hace la industria con IA y tests")
    cards = [
        ("Meta · TestGen-LLM", "FSE 2024",
         "Un LLM propone tests nuevos. Solo pasan los que **compilan**, **pasan de forma confiable** y "
         "**suben la cobertura**.", "Filtra antes de mostrar.", TEAL),
        ("Meta · ACH", "2025",
         "Generación guiada por mutantes: el LLM crea un bug plausible y luego un test que lo mata.",
         "Detectar fallas, no sumar tests.", ORANGE),
        ("Google · mutación en code review", "ICSE 2018",
         "Mutation testing **solo sobre las líneas cambiadas** del PR, con mutantes útiles para el revisor.",
         "Mutación incremental.", GREEN),
        ("Google · revisión con ML", "2023",
         "Un modelo propone cómo resolver comentarios de revisión y la persona acepta o descarta.",
         "La IA sugiere, la persona decide.", PLUM),
    ]
    for i, (name, ref, txt, lesson, col) in enumerate(cards):
        x = 0.45 + (i % 2) * 4.6
        y = 1.08 + (i // 2) * 1.97
        d.card(s, x, y, 4.45, 1.85, fill=LIGHT)
        d.box(s, x + 0.15, y + 0.12, 3.15, 0.36, name, fill=col, size=12, align="l", margin=0.08)
        d.text(s, x + 3.35, y + 0.12, 1.0, 0.36, ref, size=10, color=MUTED, align="r", anchor="m", caption=True)
        d.text(s, x + 0.15, y + 0.56, 4.15, 0.9, txt, size=12, color=INK)
        d.text(s, x + 0.15, y + 1.46, 4.15, 0.3, f"Lección: {lesson}", size=12, bold=True, color=col)
    d.notes(s, """
        Cuatro referencias de la industria, para que vean que esto no es teoría. Meta con TestGen-LLM
        (paper de FSE 2024): los tests que genera el LLM pasan por filtros automáticos antes de que un
        ingeniero los vea, y solo una fracción sobrevive. Meta con ACH (2025): usa mutantes para guiar la
        generación, el test existe para matar un bug concreto. Google lleva años corriendo mutation testing
        en code review (Petrović y otros, ICSE SEIP 2018), pero solo sobre las líneas cambiadas, porque
        correrlo completo es caro. Y Google Research mostró en 2023 un modelo que propone cómo resolver
        comentarios de revisión, siempre con una persona que decide. No hay que memorizar cifras: el patrón
        es filtrar, medir con mutación y dejar la decisión a una persona.
    """)


# ============================================================================
# C. Spec Driven Development
# ============================================================================
def part_c(d: Deck):
    d.section("2. Spec Driven Development")
    s = d.divider("Parte 2", "Spec Driven Development", "Si la IA escribe el código, la spec es lo que de verdad programas.")
    d.notes(s, "Segunda parte: cómo una spec con reglas identificadas ordena el trabajo de personas y agentes.")

    s = d.content("Qué es Spec Driven Development")
    d.text(s, 0.45, 1.1, 4.4, 1.2, [
        "Escribes una **spec** (requisitos, diseño técnico y arquitectura) y los agentes de IA desarrollan la "
        "feature de punta a punta, incluidos los tests.",
    ], size=13)
    d.text(s, 0.45, 2.3, 4.4, 0.3, "Herramientas: Kiro, Spec Kit, Tessl", size=12, bold=True, color=TEAL)
    for x, ttl, col, txt in [(0.45, "Crítica", RED, "Mantener documentos largos en vez de avanzar en pasos chicos."),
                             (2.72, "Ventaja", GREEN, "Si cambia un requisito, cambias la spec y los tests la siguen.")]:
        d.card(s, x, 2.75, 2.13, 1.95, fill=LIGHT)
        d.text(s, x + 0.12, 2.82, 1.9, 0.3, ttl, size=13, bold=True, color=col)
        d.text(s, x + 0.12, 3.16, 1.92, 1.5, txt, size=12)
    source(d, s, "Libro, p. 113", y=4.78, w=4.4)
    steps = [("Spec", "reglas con ID", TEAL), ("Contrato", "openapi.yaml", AQUA),
             ("Tests en rojo", "uno a la vez", RED), ("Código", "lo mínimo", ORANGE),
             ("Verde", "y evidencia", GREEN)]
    cx, cy, R = 7.2, 3.0, 1.42
    pos = [(cx + R * math.cos(-math.pi / 2 + i * 2 * math.pi / 5), cy + R * math.sin(-math.pi / 2 + i * 2 * math.pi / 5))
           for i in range(5)]
    hw, hh = 0.75, 0.36  # media caja

    def edge(dx, dy):
        # distancia del centro al borde de la caja en la dirección (dx, dy), más un respiro
        L = math.hypot(dx, dy)
        ux, uy = dx / L, dy / L
        t = min(hw / abs(ux) if ux else 99, hh / abs(uy) if uy else 99)
        return ux * (t + 0.05), uy * (t + 0.05)

    for i in range(5):
        x1, y1 = pos[i]
        x2, y2 = pos[(i + 1) % 5]
        ox, oy = edge(x2 - x1, y2 - y1)
        d.line(s, x1 + ox, y1 + oy, x2 - ox, y2 - oy, color=MUTED, width=1.75)
    for (t, sub, col), (x, y) in zip(steps, pos):
        d.box(s, x - hw, y - hh, 2 * hw, 2 * hh, paras=[f"**{t}**", sub], fill=col, size=12, space_after=0,
              margin=0.03)
    d.text(s, cx - 0.95, cy - 0.2, 1.9, 0.45, "Constitución P1", size=12, bold=True, color=GRAY, align="c",
           anchor="m")
    d.notes(s, """
        El libro define Spec Driven Development como un término nuevo de 2026: escribes una spec con el
        requisito, el diseño técnico y la arquitectura, y los agentes desarrollan la feature completa,
        incluidos los tests. Menciona Kiro de AWS, Spec Kit de GitHub y Tessl. También menciona la crítica:
        que se vuelve mantener documentos largos. En este proyecto la respuesta es mantener specs cortas y
        ejecutables, con IDs que los tests citan. El ciclo de la derecha es el principio P1 de la
        constitución: spec, contrato, tests que fallan, código y tests verdes. Siempre en ese orden.
    """)

    s = d.content("Anatomía de un SPEC")
    secs = [
        ("Encabezado", "ID, versión, contrato API, flujos y specs por capa", TEAL),
        ("Contexto", "El problema en lenguaje del negocio", AQUA),
        ("Supuestos", "Lo que el código da por hecho: reloj, UTC, sin login", AQUA),
        ("Reglas con ID", "LOAN-R2 · Límite por persona, con código de error", RED),
        ("Comportamiento en UI", "UI-LOAN-2: textos y colores exactos", ORANGE),
        ("Criterios de aceptación", "Tabla regla → capa → test", GREEN),
        ("Fuera de alcance", "Lo que NO se hace (renovar, multas)", GRAY),
    ]
    for i, (t, desc, col) in enumerate(secs):
        y = 1.08 + i * 0.54
        d.box(s, 0.45, y, 2.45, 0.44, t, fill=col, size=12, align="l", margin=0.1)
        d.text(s, 3.02, y, 3.2, 0.44, desc, size=12, anchor="m")
    bullet_card(d, s, 6.45, 1.08, 3.1, 3.7, "Formato de referencia", [
        "Sale del ejemplo de spec del curso: contexto, supuestos, reglas R1, R2... y mapa a los tests.",
        "Una spec por feature y una por capa.",
        "Si algo no está en la spec, el agente se detiene y la propone primero.",
    ], fill=LIGHTBLUE, space_after=8)
    d.notes(s, """
        Esta es la estructura que usamos, basada en el ejemplo de spec del curso (SPECS_EJEMPLO1): un
        encabezado con ID y versión, contexto, supuestos, reglas numeradas con ID, comportamiento en la
        interfaz, criterios de aceptación como tabla regla a test y fuera de alcance. Los supuestos son
        clave para la IA: le dicen qué puede dar por hecho, por ejemplo que el reloj es un puerto inyectable.
        Fuera de alcance evita que el agente invente funcionalidades. Y la regla de oro, que está en
        CLAUDE.md: si algo no está en la spec, el agente se detiene y propone la spec primero.
    """)

    s = d.content("Extracto de SPEC-LIB-02: Préstamos")
    d.code(s, 0.45, 1.08, 9.1, 2.4, """
- **LOAN-R1 · Copias disponibles.** Solo se presta si `availableCopies > 0`. Al prestar,
  `availableCopies` baja en 1. Si no hay copias: 409 `NO_COPIES_AVAILABLE`.
  Dos solicitudes simultáneas por la última copia: exactamente una tiene éxito
  (se garantiza en la base de datos con una actualización condicional dentro de una transacción).
- **LOAN-R2 · Límite por persona.** Una persona puede tener como máximo 3 préstamos no
  devueltos (activos o vencidos). El cuarto responde 409 `LOAN_LIMIT_REACHED`.
- **LOAN-R3 · Fecha de devolución.** `dueAt = loanedAt + 14 días`.
...
| LOAN-R2   | unit dominio `loan-policy.spec.ts` · contrato (409)                            |""",
           lang="md", title="specs/features/SPEC-LIB-02-prestamos.md (extracto)")
    ann = [
        ("ID de regla", "Lo citan los tests: [LOAN-R2] ...", RED),
        ("Código de error", "Contrato, backend y UI usan el mismo", ORANGE),
        ("Valor límite", "3 préstamos: un test justo en el borde", GREEN),
        ("Concurrencia", "Exige PostgreSQL real", AQUA),
        ("Mapa a tests", "Dice en qué capa va cada test", TEAL),
    ]
    for i, (t, desc, col) in enumerate(ann):
        x = 0.45 + i * 1.84
        d.card(s, x, 3.65, 1.74, 1.3, fill=LIGHT)
        d.box(s, x + 0.08, 3.72, 1.58, 0.34, t, fill=col, size=12, margin=0.03)
        d.text(s, x + 0.1, 4.1, 1.56, 0.82, desc, size=12)
    d.notes(s, """
        Este es un extracto literal de la spec de préstamos del repo. Fíjate en cinco cosas. Cada regla
        tiene un ID que los tests citan en su título. El código de error, por ejemplo LOAN_LIMIT_REACHED, es
        el mismo en el contrato OpenAPI, en el backend y en los mensajes de la interfaz. El límite de 3 es
        un valor límite explícito, que pide un test justo en el borde. La concurrencia por la última copia
        se dice en la spec, así que exige un test de integración con base de datos real. Y la tabla final
        dice en qué capa va cada test, que es exactamente la conversación que el libro recomienda tener en
        el kickoff de la historia.
    """)

    s = d.content("Una spec por capa")
    d.code(s, 0.45, 1.08, 9.1, 2.2, """
## Puede depender de / no puede depender de

- Puede: `shared/domain`.
- No puede: `@nestjs/*`, `typeorm`, `pg`, ni otras capas (ARCH-R1). No importa `books`:
  un préstamo guarda `bookId` y `bookTitle` como datos.
...
## Cómo se prueba esta capa

Tests unitarios sin dobles. Las fechas son literales ISO 8601 en UTC y el "ahora" se pasa
como parámetro: el dominio nunca lee el reloj. El estado no se guarda, se calcula.""", lang="md",
           title="backend/src/loans/domain/SPEC.md (extracto)")
    d.code(s, 0.45, 3.42, 4.6, 1.56, """
backend/src/loans/
├── domain/SPEC.md
├── application/SPEC.md
├── infrastructure/SPEC.md
└── presentation/SPEC.md
frontend/src/features/loans/SPEC.md""", lang="txt", title="Dónde viven")
    d.text(s, 5.25, 3.42, 4.3, 1.6, [
        "Cada capa declara qué **puede** y qué **no puede** importar: lo verifica dependency-cruiser.",
        "Dice qué se prueba ahí y qué **no**: eso evita el cupcake.",
        "Es la spec que recibe el agente cuando construye esa capa.",
    ], size=12, bullets=True, space_after=5)
    d.notes(s, """
        Además de la spec de feature, cada capa tiene su propio SPEC.md, hecho con la plantilla de
        specs/templates. Es la spec que se le da al agente cuando construye esa capa. Lo más valioso es
        decir cómo se prueba: la capa de dominio usa tests unitarios sin dobles y recibe el ahora como
        parámetro, así que nunca prueba HTTP ni base de datos. Esa línea, escrita, es lo que evita que el
        agente duplique el mismo caso en tres capas. Y las dependencias permitidas no son solo texto:
        dependency-cruiser las verifica en CI.
    """)

    s = d.content("Trazabilidad: regla → test")
    d.box(s, 0.45, 1.3, 1.5, 0.6, "LOAN-R2", fill=RED, size=14)
    targets = [("unit", "5", GREEN), ("integración", "1", AQUA), ("contrato", "1", TEAL),
               ("mocks MSW", "1", ORANGE)]
    for i, (layer, n, col) in enumerate(targets):
        x = 2.25 + i * 1.12
        if i == 0:
            d.line(s, 1.97, 1.6, x - 0.03, 1.6, color=MUTED, width=1.75)
        d.box(s, x, 1.18, 1.02, 0.84, paras=[f"**{n}**", layer], fill=col, size=12, space_after=0, margin=0.02)
    d.text(s, 6.85, 1.08, 2.7, 1.4, [
        "Cada test nombra su regla al inicio del título.",
        "spec-trace cuenta los tests por regla y capa.",
    ], size=12, bullets=True, space_after=4)
    source(d, s, "Conteo real de LOAN-R2 en npm run spec:trace", x=0.45, y=2.1, w=6.3)
    d.code(s, 0.45, 2.48, 9.1, 2.52, """
$ node tools/spec-trace.mjs --root tools/__fixtures__/spec-trace/bad
Regla        unit  Estado
CAT-R1       ·     sin tests
CAT-R2       7     excede presupuesto
FLOW-CAT-01  ·     sin tests
HUÉRFANO   backend/src/books/domain/search.spec.ts:14 normaliza el texto
ID NO EXISTE NOPE-R9  backend/src/books/domain/search.spec.ts:18
PRESUPUESTO CAT-R2 tiene 7 tests en unit (máx. 6)
PASOS SIN IMPLEMENTAR FLOW-CAT-01: ordeno por año

FALLA: 1/3 reglas cubiertas, 9 tests, 1 huérfanos, 1 IDs inexistentes, 1 sobre presupuesto""",
           lang="sh", title="Salida real con el repo de prueba que tiene un caso de cada falla")
    d.notes(s, """
        La trazabilidad convierte la spec en algo verificable. El script tools/spec-trace.mjs lee las reglas
        en negrita de las specs, los flujos de los archivos feature y los títulos de los tests. Arriba, el
        conteo real de LOAN-R2: 5 tests unitarios, 1 de integración, 1 de contrato y 1 de contrato de mocks.
        Abajo, la salida real contra el repo de prueba del propio script, que tiene un caso de cada falla:
        una regla sin tests, un test huérfano sin ID, un ID que no existe, una regla que supera el
        presupuesto de 6 tests por capa y un paso de Gherkin sin implementar. Ese presupuesto es la defensa
        más directa contra la IA que genera 30 variantes del mismo caso. Mientras agentes de IA construían
        este repo, BOOK-R1 llegó a 11 tests unitarios y el script lo detectó. Hoy main da 29 de 29 reglas
        cubiertas, 0 huérfanos y 0 sobre presupuesto.
    """)

    s = d.content("OpenAPI: el contrato es la fuente de verdad")
    d.code(s, 0.45, 1.05, 9.1, 2.62, """
/api/loans:
  ...
  post:
    operationId: createLoan
    tags: [loans]
    summary: Registra un préstamo
    ...
    responses:
      ...
      '409':
        description: |
          No se puede prestar: sin copias disponibles (LOAN-R1), límite de
          préstamos activos (LOAN-R2) o préstamo activo del mismo libro (LOAN-R4).""", lang="yaml",
           title="specs/api/openapi.yaml (extracto)")
    d.text(s, 0.45, 3.74, 9.1, 0.3, "Un archivo, cinco consumidores", size=13, bold=True, color=INK)
    uses = [
        ("Backend", "lo implementa y se valida contra él", TEAL),
        ("Frontend", "genera sus tipos con openapi-typescript", ORANGE),
        ("Mocks MSW", "se validan contra el mismo contrato", AQUA),
        ("Spectral y oasdiff", "revisan estilo y compatibilidad", PLUM),
        ("Schemathesis, ZAP", "lo usan para atacar la API", RED),
    ]
    for i, (t, desc, col) in enumerate(uses):
        x = 0.45 + i * 1.84
        d.box(s, x, 4.07, 1.74, 0.36, t, fill=col, size=12, margin=0.03)
        d.text(s, x, 4.47, 1.74, 0.56, desc, size=12)
    d.notes(s, """
        El contrato de la API vive en specs/api/openapi.yaml, en OpenAPI 3.1, y es la única fuente de verdad
        (principio P2). Todo cambio de API parte por este archivo. Fíjate que la descripción del 409 nombra
        las reglas LOAN-R1, LOAN-R2 y LOAN-R4: el contrato también está trazado a la spec. Un mismo archivo
        alimenta al backend, a los tipos del frontend, a los mocks del frontend, a Spectral y oasdiff, y a
        las herramientas que atacan la API: Schemathesis y OWASP ZAP.
    """)

    s = d.content("El contrato se verifica antes que el código")
    flow = [("openapi.yaml", "cambio en el PR", TEAL), ("Spectral", "estilo y reglas", PLUM),
            ("oasdiff", "¿rompe clientes?", RED), ("api:generate", "tipos del frontend", ORANGE),
            ("api:check", "drift = falla", GREEN)]
    w = 1.7
    for i, (t, sub, col) in enumerate(flow):
        x = 0.45 + i * (w + 0.15)
        d.box(s, x, 1.08, w, 0.72, paras=[f"**{t}**", sub], fill=col, size=12, space_after=0, margin=0.03)
        if i < len(flow) - 1:
            d.line(s, x + w + 0.01, 1.44, x + w + 0.14, 1.44, color=MUTED, width=1.75)
    d.code(s, 0.45, 1.95, 4.45, 2.12, """
biblioteca-paths-under-api:
  description: Todos los paths empiezan con /api.
  message: '{{property}} no empieza con /api.'
  severity: error
  given: $.paths
  then:
    field: '@key'
    function: pattern
    functionOptions:
      match: '^/api(/|$)'""", lang="yaml", title=".spectral.yaml (una regla propia)")
    checks = [
        ("Spectral", "Parte de spectral:oas y suma reglas del curso: 4xx con problem+json, ejemplos y "
         "paths bajo /api.", PLUM),
        ("oasdiff", "Compara con el contrato de main. Borrar un endpoint o exigir un campo nuevo es ERR "
         "y falla el PR.", RED),
        ("api:check", "Regenera los tipos y falla si no coinciden con los commiteados.", GREEN),
    ]
    y = 1.95
    for t, txt, col in checks:
        d.box(s, 5.08, y + 0.02, 1.2, 0.34, t, fill=col, size=12, margin=0.03)
        d.text(s, 6.38, y - 0.02, 3.17, 0.68, txt, size=12)
        y += 0.72
    d.code(s, 0.45, 4.18, 9.1, 0.84, """
$ npm run lint:openapi
No results with a severity of 'error' found!""", lang="sh", title="etapa 2 del pipeline, job contrato-openapi")
    d.notes(s, """
        Antes de una sola línea de código, el contrato pasa tres controles en la etapa 2. Spectral es un
        linter de contratos: parte del ruleset oficial de OpenAPI y agrega reglas del curso, por ejemplo que
        todo 4xx use application/problem+json, porque la interfaz muestra mensajes según el campo code, o
        que todos los paths empiecen con /api. oasdiff compara el contrato del PR con el de main y falla si
        el cambio rompe a los clientes, por ejemplo si se borra un endpoint o se agrega un campo
        obligatorio. Y api:check regenera los tipos del frontend y falla si no coinciden con lo que está
        commiteado: eso es drift entre contrato y código.
    """)

    s = d.content("Flujos en Gherkin: escribir el flujo es escribir el test")
    d.code(s, 0.45, 1.08, 6.5, 1.92, """
@SPEC-LIB-02
Característica: Préstamos
  ...
  @FLOW-PRE-01 @smoke
  Escenario: Pedir prestado un libro disponible
    Dado que estoy en el catálogo
    Cuando pido prestado "Cien años de soledad" con el correo "ana@uc.cl"
    Entonces veo el mensaje "Préstamo registrado"
    Y veo la fecha de devolución "16-03-2026\"""", lang="gherkin", title="specs/flows/prestamos.feature (extracto)")
    d.card(s, 7.1, 1.08, 2.45, 1.92, fill=LIGHTBLUE)
    d.text(s, 7.2, 1.14, 2.3, 1.82, [
        "Cada escenario es un test con su ID.",
        "@smoke corre también contra el stack real.",
        "Datos y reloj fijo: specs/flows/README.md",
    ], size=12, bullets=True, space_after=4)
    d.box(s, 0.45, 3.13, 1.15, 0.34, "bddgen", fill=PLUM, size=12)
    d.line(s, 1.02, 3.01, 1.02, 3.12, color=MUTED, width=1.75)
    d.code(s, 0.45, 3.5, 9.1, 1.5, """
When(
  'pido prestado {string} con el correo {string}',
  async ({ page }, title: string, email: string) => {
    ...
    await page.getByLabel('Correo').fill(email)
    await page.getByRole('button', { name: 'Pedir prestado', exact: true }).click()""", lang="ts",
           title="frontend/tests/e2e/steps/loans.steps.ts (extracto)")
    d.notes(s, """
        Los flujos de usuario también son spec. Están en specs/flows en Gherkin y en español. playwright-bdd
        lee estos archivos (comando bddgen) y genera los tests de Playwright: son los 7 flujos que corren en
        cada PR. Los pasos se implementan una sola vez en frontend/tests/e2e/steps, así que agregar un
        escenario nuevo es escribir texto. El tag smoke marca los flujos que también corren contra el stack
        real. Fíjate en la fecha de devolución: 16-03-2026 es exactamente el reloj fijo más 14 días
        (LOAN-R3), por eso el reloj fijo es parte de la spec.
    """)

    s = d.content("La IA en SDD: dos pasos y un juez")
    steps = [
        ("Spec y reglas", "SPEC-LIB-XX con IDs", TEAL),
        ("Paso 1: plan", "La IA propone casos: regla, capa y partición", ORANGE),
        ("Tú apruebas", "Podas duplicados y bajas casos de capa", RED),
        ("Paso 2: un test a la vez", "Falla por la razón correcta, después el código", GREEN),
        ("Revisor IA", "Otro modelo evalúa contra la spec", PLUM),
    ]
    w = 1.68
    for i, (t, sub, col) in enumerate(steps):
        x = 0.45 + i * (w + 0.18)
        d.box(s, x, 1.1, w, 1.38, paras=[f"**{t}**", sub], fill=col, size=12, space_after=3, margin=0.05)
        if i < len(steps) - 1:
            d.line(s, x + w + 0.01, 1.79, x + w + 0.17, 1.79, color=MUTED, width=1.75)
    d.code(s, 0.45, 2.68, 4.75, 1.62, """
| Regla   | Capa     | Partición                |
| LOAN-R2 | unit     | 2 préstamos: permite     |
| LOAN-R2 | unit     | 3 préstamos: rechaza     |
| LOAN-R2 | contrato | 409 LOAN_LIMIT_REACHED   |
| LOAN-R2 | UI       | ya cubierto: FLOW-PRE-03 |""", lang="md", title="Ejemplo de plan del paso 1")
    d.text(s, 5.4, 2.62, 4.15, 2.4, [
        "“...generate one test at a time, so that you can review them diligently!” (p. 94).",
        "El flujo de dos pasos existe para que **tú elijas** qué casos automatizar en cada capa (p. 96).",
        "El juez usa un modelo distinto y puntúa de 0 a 1 con razones (p. 103).",
    ], size=12, bullets=True, space_after=6)
    d.notes(s, """
        Así usamos la IA dentro de SDD. Paso uno: el agente lee la spec y propone una tabla de casos con
        regla, capa y partición, sin escribir código. Tú apruebas o podas, por ejemplo eliminas el caso de
        UI porque ya lo cubre el flujo FLOW-PRE-03. Paso dos: el agente escribe un test a la vez, verifica
        que falla por la razón correcta y recién ahí implementa. Al final, un revisor con otro modelo actúa
        como juez. Todo esto viene del libro: generar un test a la vez (p. 94), el flujo de dos pasos (p. 96)
        y el patrón LLM as the judge (p. 103). Y está escrito en CLAUDE.md del repo.
    """)

    s = d.content("Un agente que propone tests desde el OpenAPI")
    steps = [
        ("Disparo manual", "workflow_dispatch con un operationId", TEAL),
        ("Paso 1: plan", "docs/propuestas-ia/<op>.md", ORANGE),
        ("Paso 2: tests", "solo los casos nuevos", GREEN),
        ("Paso 3: verifica", "typecheck y spec-trace", PLUM),
        ("PR en borrador", "una persona aprueba el plan", RED),
    ]
    for i, (t, sub, col) in enumerate(steps):
        x = 0.45 + i * (w + 0.18)
        d.box(s, x, 1.08, w, 1.05, paras=[f"**{t}**", sub], fill=col, size=12, space_after=2, margin=0.05)
        if i < len(steps) - 1:
            d.line(s, x + w + 0.01, 1.6, x + w + 0.17, 1.6, color=MUTED, width=1.75)
    d.code(s, 0.45, 2.28, 9.1, 2.72, """
Paso 1. Plan. Crea docs/propuestas-ia/${{ inputs.operationId }}.md con una tabla:
| Caso | Partición o valor límite | Respuesta esperada (código y code) | Capa | ID de regla |
Reglas del plan:
- Solo casos que pertenecen a la capa de contrato (HTTP real contra el OpenAPI).
  Si un caso se detecta en una capa más baja (unit), anótalo en una sección
  "Fuera de esta capa" y NO lo propongas como test de contrato (P4.1).
- Máximo 6 casos por regla. Una partición, un caso (P4.2).
- Marca los casos que ya están cubiertos por tests existentes y no los repitas.
...
Paso 3. Verifica que compila con `npm run typecheck` dentro de backend y que la
trazabilidad sigue en verde con `node tools/spec-trace.mjs`.
No modifiques specs/ ni código de producción.""", lang="md",
           title=".github/workflows/ai-generate-tests.yml (prompt, extracto)")
    d.notes(s, """
        Este workflow es la versión con barandas del ejemplo del libro, donde Claude Code en GitHub Actions
        genera tests REST Assured desde un OpenAPI y abre un PR (p. 139 a 143). Aquí se dispara a mano para
        una sola operación del contrato, nunca para todo el OpenAPI. El agente primero escribe un plan con
        partición, código esperado, capa e ID de regla, y los casos que pertenecen a unit los deja fuera.
        Después escribe solo los casos nuevos en un archivo proposed, verifica que compilan y que spec-trace
        sigue en verde, y abre un PR en borrador con un checklist que una persona tiene que marcar. Es la
        regla P4.7 hecha automatización: la IA propone, una persona aprueba.
    """)


# ============================================================================
# D. El proyecto
# ============================================================================
def part_d(d: Deck):
    d.section("3. El proyecto")
    s = d.divider("Parte 3", "El proyecto: Biblioteca UC", "Catálogo de libros y préstamos. NestJS, Next.js y PostgreSQL en un monorepo.")
    d.notes(s, "Tercera parte: el proyecto de ejemplo que usaremos para mostrar cada tipo de prueba.")

    s = d.content("Mapa del monorepo")
    d.code(s, 0.45, 1.08, 5.5, 3.9, """
full_stack_testing/
├── specs/           fuente de verdad
│   ├── constitution.md
│   ├── architecture.md
│   ├── api/openapi.yaml
│   ├── features/    SPEC-LIB-01, SPEC-LIB-02
│   └── flows/       *.feature (Gherkin)
├── backend/         NestJS + TypeORM
├── frontend/        Next.js + MSW
├── tools/           spec-trace, evidencia
├── .github/         workflows de CI
├── clase-practica/  laboratorio
├── docs/            esta presentación
└── docker-compose.yml""", lang="txt", title=REPO_URL)
    stack = [("NestJS", TEAL), ("PostgreSQL", TEAL), ("TypeORM", TEAL), ("Next.js", ORANGE), ("React", ORANGE),
             ("MSW", ORANGE), ("Jest", GREEN), ("Vitest", GREEN), ("Playwright", GREEN), ("Testcontainers", GREEN),
             ("Spectral", PLUM), ("Semgrep", RED), ("Trivy", RED), ("OWASP ZAP", RED)]
    d.text(s, 6.15, 1.08, 3.4, 0.3, "Stack", size=13, bold=True)
    for i, (t, col) in enumerate(stack):
        x = 6.15 + (i % 2) * 1.72
        y = 1.48 + (i // 2) * 0.5
        d.chip(s, x, y, 1.64, 0.4, t, fill=col, size=12)
    d.notes(s, """
        El monorepo tiene cuatro carpetas importantes. specs es la fuente de verdad. backend es una API REST
        en NestJS con PostgreSQL y TypeORM. frontend es Next.js con MSW como mock server. tools tiene los
        scripts de CI: trazabilidad de specs, smoke de la API y la evidencia del PR. clase-practica tiene el
        laboratorio para podar suites infladas por IA. Los colores del stack se repiten en toda la clase:
        verde para pruebas, rojo para seguridad, naranjo para frontend y build.
    """)

    s = d.content("La app: Biblioteca UC")
    shots = [
        (IMG / "catalogo.png", ["Catálogo: insignia según las copias (UI-CAT-2)",
                                "y botón deshabilitado si está agotado (UI-CAT-3)."],
         "Captura de pantalla del catálogo de la Biblioteca UC"),
        (IMG / "limite-prestamos.png", ["Detalle del libro: el cuarto préstamo muestra",
                                        "el mensaje de LOAN-R2 (UI-LOAN-4)."],
         "Captura del error al superar el límite de préstamos"),
    ]
    for i, (img, caption, alt) in enumerate(shots):
        x = 0.45 + i * 4.65
        d.image(s, img, x, 1.08, w=4.45, alt=alt)
        d.text(s, x, 3.95, 4.45, 0.7, caption, size=12, color=INK, space_after=0)
    source(d, s, "Capturas reales que toma Playwright en el pipeline (FLOW-CAT-01 y FLOW-PRE-03), con el mock "
           "server y el reloj fijo.", y=4.75, w=9.1, align="c")
    d.notes(s, """
        Así se ve la app. A la izquierda el catálogo: cada libro muestra una insignia verde con las copias
        disponibles o roja si está agotado, y el botón Pedir prestado se deshabilita si no hay copias. A la
        derecha, el detalle de un libro cuando una persona que ya tiene 3 préstamos intenta pedir un cuarto:
        aparece el mensaje exacto que pide la spec. Estas imágenes no son mockups: son capturas que
        Playwright toma en cada ejecución de los flujos y que el pipeline publica en el PR.
    """)

    s = d.content("Arquitectura en capas")
    d.text(s, 0.45, 1.05, 4.4, 0.3, "Backend (NestJS)", size=13, bold=True, color=TEAL)
    for name, desc, y, col in [("presentation", "controllers y DTOs", 1.42, AQUA),
                               ("application", "casos de uso y puertos", 2.2, TEAL),
                               ("domain", "reglas puras", 2.98, GREEN)]:
        d.box(s, 0.45, y, 2.6, 0.64, paras=[f"**{name}**", desc], fill=col, size=12, space_after=0)
    d.box(s, 3.3, 2.2, 1.55, 1.42, paras=["**infrastructure**", "TypeORM y migraciones"], fill=ORANGE, size=12,
          space_after=0, margin=0.04)
    d.line(s, 1.75, 2.07, 1.75, 2.19, color=INK, width=1.5)
    d.line(s, 1.75, 2.85, 1.75, 2.97, color=INK, width=1.5)
    d.line(s, 3.28, 3.3, 3.07, 3.3, color=INK, width=1.5)
    d.line(s, 3.28, 2.52, 3.07, 2.52, color=INK, width=1.5)
    d.text(s, 0.45, 3.78, 4.45, 1.25, [
        "**ARCH-R1** domain no importa Nest, TypeORM ni pg",
        "**ARCH-R2** application usa puertos, no adaptadores",
        "**ARCH-R3** presentation no toca repositorios",
    ], size=12, bullets=True, space_after=2)
    d.text(s, 5.15, 1.05, 4.4, 0.3, "Frontend (Next.js)", size=13, bold=True, color=ORANGE)
    for name, y, col in [("app (rutas)", 1.42, ORANGE), ("features/*/components", 2.0, ORANGE),
                         ("features/*/hooks", 2.58, "B5651D"), ("shared/api", 3.16, "B5651D")]:
        d.box(s, 5.15, y, 2.45, 0.44, name, fill=col, size=12)
    for y in (1.87, 2.45, 3.03):
        d.line(s, 6.37, y, 6.37, y + 0.12, color=INK, width=1.5)
    d.box(s, 7.95, 2.0, 1.6, 1.02, paras=["**shared/domain**", "funciones puras"], fill=GREEN, size=12,
          space_after=0, margin=0.03)
    d.line(s, 7.62, 2.22, 7.93, 2.38, color=INK, width=1.5)
    d.line(s, 7.62, 2.8, 7.93, 2.66, color=INK, width=1.5)
    d.box(s, 7.95, 3.16, 1.6, 0.44, "mocks (MSW)", fill=AQUA, size=12)
    d.line(s, 7.93, 3.38, 7.62, 3.38, color=AQUA, width=1.5, dash=True)
    d.text(s, 5.15, 3.78, 4.4, 1.25, [
        "**ARCH-R6** shared/domain sin React ni API",
        "**ARCH-R7** componentes sin fetch directo",
        "**ARCH-R8** app no importa mocks",
    ], size=12, bullets=True, space_after=2)
    d.notes(s, """
        Las dependencias apuntan hacia adentro. En el backend, el dominio no conoce frameworks ni base de
        datos, la aplicación orquesta el dominio a través de puertos (interfaces de repositorio y reloj) y
        la infraestructura implementa esos puertos con TypeORM. Los controllers mapean los errores a
        application/problem+json. En el frontend las rutas componen componentes, los componentes usan hooks
        y los hooks usan el cliente generado desde OpenAPI. MSW se activa solo por variable de entorno, por
        eso app no lo importa. Las funciones puras, como el color de cada estado de préstamo, viven en
        shared/domain y se prueban con unit sin mocks. Cada regla ARCH tiene un ID, igual que las reglas de
        negocio.
    """)

    s = d.content("Test de arquitectura con dependency-cruiser")
    d.code(s, 0.45, 1.08, 5.0, 2.3, """
const LAYER = (layer) => `^src/[^/]+/${layer}/`
...
module.exports = {
  forbidden: [
    {
      name: 'ARCH-R1-dominio-puro',
      ...
      severity: 'error',
      from: { path: LAYER('domain') },
      to: { pathNot: LAYER('domain') },
    },""", lang="js", title="backend/.dependency-cruiser.cjs (extracto)")
    bullet_card(d, s, 5.65, 1.08, 3.9, 2.3, "Por qué importa", [
        "La IA importa lo que encuentra más cerca, no respeta capas por iniciativa propia.",
        "Una regla de la spec verificada en CI convierte la arquitectura en un test.",
    ], space_after=6)
    d.code(s, 0.45, 3.52, 9.1, 1.22, """
$ npm run test:arch
  error ARCH-R1-dominio-puro: src/loans/domain/loan.ts → node_modules/@nestjs/common/index.js

x 1 dependency violations (1 errors, 0 warnings). 68 modules, 170 dependencies cruised.""", lang="sh",
           title="Salida real al importar @nestjs/common en el dominio")
    source(d, s, "El libro lo llama architecture testing: ArchUnit en Java, p. 315", y=4.82)
    d.notes(s, """
        La arquitectura también se prueba. El libro, en el capítulo de requisitos transversales, muestra
        ArchUnit para Java. En TypeScript usamos dependency-cruiser: cada regla ARCH de la spec se traduce en
        una regla forbidden con el mismo ID. La salida de abajo es real: agregamos un import de
        @nestjs/common en la entidad de préstamo y el script falla con el ID de la regla. En el pipeline
        esto corre en la etapa 2 (npm run test:arch). Es especialmente útil con IA porque los agentes
        tienden a importar lo que tienen más cerca.
    """)


# ============================================================================
# E. Tipos de prueba
# ============================================================================
def part_e(d: Deck):
    d.section("4. Tipos de prueba")
    s = d.divider("Parte 4", "Tipos de prueba, uno por uno", "Qué es, qué detecta, con qué herramienta, dónde corre y un ejemplo real.")
    d.notes(s, "Cuarta parte. Cada tipo de prueba tiene la misma estructura para que sea fácil compararlos.")

    s = d.content("Mapa de pruebas del proyecto")
    bands = [
        ("Backend", "Jest", TEAL, [("56", "Unit dominio y aplicación", "etapa 5"),
                                    ("19", "Integración con PostgreSQL", "etapa 6"),
                                    ("12", "Contrato del proveedor", "etapa 6")]),
        ("Frontend", "Vitest", ORANGE, [("31", "Unit y componentes", "etapa 5"),
                                         ("23", "Contrato de mocks MSW", "etapa 5")]),
        ("Navegador", "Playwright", GREEN, [("7", "flujos", "Gherkin"), ("6", "estilo", "color"),
                                             ("4", "layout", "cajas"), ("4", "a11y", "WCAG"),
                                             ("4", "visual", "píxeles")]),
    ]
    y = 1.08
    for band, tool, col, items in bands:
        d.box(s, 0.45, y, 1.45, 0.78, paras=[f"**{band}**", tool], fill=col, size=12, space_after=0)
        n = len(items)
        gap = 0.1
        w = (9.55 - 2.02 - gap * (n - 1)) / n
        for i, (num, name, stage) in enumerate(items):
            x = 2.02 + i * (w + gap)
            d.card(s, x, y, w, 0.78, fill=LIGHT)
            num_w = 0.48 if n > 3 else 0.72
            d.text(s, x + 0.06, y, num_w, 0.78, num, size=22, bold=True, color=col, font=k.FONT_TITLE,
                   anchor="m", align="c")
            d.text(s, x + num_w + 0.06, y + 0.05, w - num_w - 0.1, 0.36, name, size=12, bold=True, anchor="m")
            d.text(s, x + num_w + 0.06, y + 0.4, w - num_w - 0.1, 0.32, stage, size=12, color=GRAY, anchor="m")
        y += 0.9
    d.text(s, 2.02, y - 0.02, 7.5, 0.3, "Los 25 tests de Playwright corren en la etapa 7, contra Next y MSW.",
           size=12, color=GRAY)
    y += 0.34
    d.box(s, 0.45, y, 1.45, 0.78, paras=["**Sistema**", "y transversal"], fill=PLUM, size=12, space_after=0)
    extra = [("Arquitectura", "etapa 2"), ("SAST y SCA", "etapas 3 y 4"), ("Stack real", "etapa 9"),
             ("DAST", "etapa 9"), ("Mutación", "nightly")]
    w = (9.55 - 2.02 - 0.1 * 4) / 5
    for i, (name, stage) in enumerate(extra):
        x = 2.02 + i * (w + 0.1)
        d.box(s, x, y, w, 0.78, paras=[f"**{name}**", stage], fill=LIGHT, color=INK, size=12, space_after=0,
              margin=0.02)
    source(d, s, "166 tests automatizados: 87 del backend, 54 de Vitest y 25 de Playwright. "
           "La etapa es la del pipeline (Parte 5).", y=y + 0.86, w=9.1)
    d.notes(s, """
        Este es el mapa completo con los conteos reales del repo. Backend: 56 unitarios de dominio y
        aplicación, 19 de integración con PostgreSQL y 12 de contrato del proveedor. Frontend con Vitest: 31
        unitarios y de componentes, y 23 que validan los mocks de MSW contra el OpenAPI. En el navegador,
        Playwright corre 7 flujos generados desde Gherkin, 6 pruebas de estilo, 4 de layout, 4 de
        accesibilidad y 4 de regresión visual. Fíjate en la forma: muchos tests abajo y pocos arriba, es la
        pirámide. La última franja son las pruebas de sistema contra el stack real (smoke de la API,
        Schemathesis, Playwright @smoke, k6 y Lighthouse), el análisis de seguridad y la mutación nocturna.
    """)

    s = d.content("Dobles de prueba: cuándo usar cada uno")
    rows = [
        ["Doble", "Qué es", "En este proyecto"],
        ["Dummy", "Se pasa pero no se usa", "Casi nunca hace falta"],
        ["Stub", "Respuestas fijas", "server.use() de MSW en un test"],
        ["Fake", "Implementación real y simple", "InMemoryLoanRepository, FixedClock"],
        ["Mock", "Verifica una interacción", "Solo con justificación escrita (P4.3)"],
    ]
    d.table(s, 0.45, 1.08, 5.9, rows, [0.9, 2.2, 2.8], row_h=0.5, first_col_bold=True)
    bullet_card(d, s, 6.55, 1.08, 3.0, 3.85, "Fakes que no mienten", [
        "Un fake puede alejarse del repositorio real y dar falsos verdes.",
        "Solución: **la misma suite de contrato** del puerto corre contra el fake y contra PostgreSQL.",
        "Si el fake miente, la suite lo delata.",
    ], fill=LIGHTBLUE, space_after=8)
    d.text(s, 0.45, 3.85, 5.9, 1.1, [
        "Un mock prueba **cómo** se hizo algo. Un fake prueba **qué** resultó.",
        "Los tests con mocks se rompen al refactorizar aunque el comportamiento siga igual.",
    ], size=12, bullets=True, space_after=5)
    d.notes(s, """
        Repaso rápido de dobles de prueba, que ya vieron en la clase de testing: dummy, stub, fake y mock. La
        política del proyecto es usar fakes por defecto: repositorios en memoria y un reloj fijo. Un mock
        verifica interacciones, el cómo, y por eso se rompe al refactorizar. El riesgo de los fakes es que
        se alejen del comportamiento real. La solución del repo es una suite de contrato del puerto, en
        backend/test/repository-contract, que corre dos veces: contra el fake en memoria y contra el
        repositorio TypeORM con PostgreSQL. Si el fake miente, falla.
    """)

    type_slide(d, "Unitarias de dominio, sin mocks", [
        ("Qué es", "Reglas puras del dominio, sin framework ni base de datos."),
        ("Qué detecta", "Errores en particiones y valores límite del ISBN."),
        ("Herramienta", "Jest con ts-jest. Objetos reales y oráculos literales."),
        ("Dónde corre", "Etapa 5, en cada PR. Milisegundos."),
    ], """
const invalidIsbn = { code: 'VALIDATION_ERROR', field: 'isbn', message: 'El ISBN no es válido' }

describe('Isbn', () => {
  it('[BOOK-R1] normaliza quitando guiones y espacios', () => {
    expect(Isbn.create('978-84-376 0494-7').value).toBe('9788437604947')
  })
  ...
  it('[BOOK-R1] rechaza un dígito verificador incorrecto', () => {
    expect(thrownBy(() => Isbn.create('978-0-00-000000-1'))).toMatchObject(invalidIsbn)
  })""", "backend/src/books/domain/isbn.spec.ts (extracto)",
               book="Libro: tests micro, p. 66 a 72. Buenos tests, p. 107.", notes="""
        Las unitarias de dominio son la base de la pirámide. Prueban reglas puras, sin Nest y sin base de
        datos, así que corren en milisegundos y no necesitan dobles. Fíjate en las particiones: un ISBN con
        guiones que se normaliza y un dígito verificador incorrecto (en el archivo también está el prefijo
        979 y el largo distinto de 13). Una partición, un test, no treinta variantes del mismo caso. El
        valor esperado está escrito literal, nunca recalculado con la misma lógica de producción.
    """)

    type_slide(d, "Unitarias de aplicación con fakes", [
        ("Qué es", "Un caso de uso completo con repositorios en memoria y reloj fijo."),
        ("Qué detecta", "Orquestación incorrecta: no descontar la copia."),
        ("Herramienta", "Jest con fakes: InMemory*Repository y FixedClock."),
        ("Dónde corre", "Etapa 5, en cada PR."),
    ], """
it('[LOAN-R2] rechaza el cuarto préstamo y no descuenta copias', async () => {
  const { app, books, cienAnos } = await appWithBooks()
  for (const book of books.slice(1)) {
    await app.createLoan.execute({ bookId: book.id, borrowerEmail: 'beto@uc.cl' })
  }

  const error = await rejectionOf(
    app.createLoan.execute({ bookId: cienAnos.id, borrowerEmail: 'beto@uc.cl' }),
  )

  expect(error).toBeInstanceOf(LoanLimitReachedError)
  expect((await app.books.findById(cienAnos.id))?.availableCopies).toBe(3)
})""", "backend/src/loans/application/create-loan.spec.ts (extracto)",
               book="Libro: dobles de prueba y aislamiento, cap. 3. Fakes en backend/test/fakes.", notes="""
        En la capa de aplicación probamos casos de uso. No hay mocks: el repositorio en memoria es una
        implementación real y simple del puerto, y el reloj fijo hace que las fechas sean deterministas. El
        arnés de test/support/application-harness.ts arma los casos de uso con esos fakes. El test verifica
        el resultado y el estado final: el error es LoanLimitReachedError y las copias del libro siguen
        siendo 3. No verifica qué métodos se llamaron. Si la IA te propone un jest.fn para el repositorio,
        ESLint lo rechaza y la constitución pide justificarlo por escrito.
    """)

    type_slide(d, "Integración con Testcontainers y PostgreSQL", [
        ("Qué es", "Repositorios TypeORM contra un PostgreSQL real en Docker."),
        ("Qué detecta", "SQL incorrecto, migraciones rotas, restricciones que faltan."),
        ("Herramienta", "Testcontainers (PostgreSQL 17) y Jest."),
        ("Dónde corre", "Etapa 6. Necesita Docker en el runner."),
    ], [("""
const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
  .withDatabase('biblioteca')
  .withUsername('biblioteca')
  .withPassword('biblioteca')
  .start()
process.env.DATABASE_URL = container.getConnectionUri()""", "test/support/postgres-global-setup.ts"),
         ("""
loanRepositoryContract('PostgreSQL', async () => {
  await truncateAll(dataSource)
  const unitOfWork = new TypeOrmUnitOfWork(dataSource)
  return {
    books: new TypeOrmBookRepository(unitOfWork),
    loans: new TypeOrmLoanRepository(unitOfWork),
  }
})""", "src/loans/infrastructure/loan.repository.int-spec.ts")],
               layout="side", code_w=5.9, book="Libro: Testcontainers, p. 179. Data testing, cap. 5.", notes="""
        Las pruebas de integración usan Testcontainers: cada corrida levanta un PostgreSQL limpio en Docker,
        con la misma imagen de producción y del pipeline, en un puerto al azar. Se corren las migraciones
        reales y cada test vacía las tablas antes de empezar. El libro lo recomienda porque una base
        compartida está contaminada por el desarrollo activo (p. 179). Fíjate en el segundo bloque: la misma
        suite de contrato del repositorio que corre contra el fake en memoria corre aquí contra PostgreSQL.
        Así el fake no puede mentir.
    """)

    s = d.content("Data testing: lo que solo la base de datos garantiza")
    items = [
        ("Migraciones", "Corren de verdad en cada test de integración: una migración rota falla en el PR.", TEAL),
        ("Restricciones", "CHECK de copias (BOOK-R4) e índice único de ISBN (BOOK-R2).", ORANGE),
        ("Concurrencia", "Cinco solicitudes por la última copia: exactamente una gana (LOAN-R1).", RED),
    ]
    for i, (t, txt, col) in enumerate(items):
        y = 1.1 + i * 1.25
        d.box(s, 0.45, y, 1.6, 1.05, t, fill=col, size=12)
        d.text(s, 2.18, y, 2.85, 1.05, txt, size=12, anchor="m")
    d.text(s, 5.2, 1.05, 4.35, 0.3, "La última copia de La casa de los espíritus", size=12, bold=True, align="c")
    pg_x, pg_y = 6.9, 1.62
    d.box(s, pg_x, pg_y, 2.65, 1.7, paras=["**PostgreSQL**"], fill=TEAL, size=12, anchor="t", margin=0.08)
    d.text(s, pg_x + 0.08, pg_y + 0.42, 2.5, 1.2, ["UPDATE books", "SET available_copies =",
                                                   "available_copies - 1", "WHERE id = :bookId",
                                                   "AND available_copies > 0"],
           size=10, color=WHITE, font=k.FONT_CODE, space_after=0, check=False)
    for i, n in enumerate(["ana", "beto", "carla", "diego", "eva"]):
        y = 1.45 + i * 0.44
        col = GREEN if i == 0 else RED
        d.box(s, 5.2, y, 1.2, 0.36, f"{n}@uc.cl", fill=AQUA, size=12, margin=0.02)
        d.line(s, 6.42, y + 0.18, pg_x - 0.02, pg_y + 0.3 + i * 0.27, color=col, width=1.75)
    d.text(s, 5.2, 3.75, 4.35, 0.3, "[g]1 × 201 Created[/]    [r]4 × 409 NO_COPIES_AVAILABLE[/]", size=12,
           align="c")
    d.text(s, 5.2, 4.1, 4.35, 0.85, "Una transacción aparte bloquea la fila para que las cinco compitan de "
           "verdad. Un fake en memoria nunca tiene esta carrera.", size=12, color=GRAY)
    d.notes(s, """
        El capítulo 5 del libro trata data testing. En este proyecto hay tres cosas que solo la base de
        datos garantiza: que las migraciones funcionen, que las restricciones existan y que la concurrencia
        se resuelva bien. El caso estrella es LOAN-R1: cinco personas piden la última copia al mismo tiempo.
        La spec exige que exactamente una gane, y el repositorio lo garantiza con un UPDATE condicional: si
        dos transacciones compiten, PostgreSQL bloquea la fila y la segunda vuelve a evaluar el WHERE y
        afecta 0 filas. El test real usa una barrera: otra transacción bloquea la fila, las cinco
        solicitudes quedan esperando y al liberarla compiten de verdad. Resultado: un 201 y cuatro 409. Un
        fake en memoria nunca va a reproducir esa carrera, así que este test vive en integración y en
        ninguna otra capa.
    """)

    s = d.content("Contrato bidireccional: un OpenAPI, dos lados")
    d.box(s, 3.85, 1.75, 2.3, 1.2, paras=["**openapi.yaml**", "fuente de verdad"], fill=TEAL, size=13,
          shape="doc", space_after=0)
    bullet_card(d, s, 0.45, 1.25, 3.2, 2.25, "Proveedor (backend)", [
        "supertest llama al controller real",
        "PostgreSQL en Testcontainers",
        "Cada respuesta se valida con el schema",
    ], title_color=TEAL, space_after=3)
    bullet_card(d, s, 6.35, 1.25, 3.2, 2.25, "Consumidor (frontend)", [
        "Los handlers MSW devuelven datos",
        "Cada respuesta mock se valida con el schema",
        "Si el mock miente, falla test:contract",
    ], title_color=ORANGE, space_after=3)
    d.line(s, 3.67, 2.35, 3.83, 2.35, color=INK, width=2, tail=True)
    d.line(s, 6.17, 2.35, 6.33, 2.35, color=INK, width=2, tail=True)
    d.card(s, 0.45, 3.72, 9.1, 1.2, fill=LIGHTBLUE)
    d.text(s, 0.65, 3.78, 8.7, 1.1, [
        "**¿Y Pact?** Pact hace contratos consumer-driven: cada consumidor publica lo que necesita y el "
        "proveedor lo verifica (p. 107). Conviene con muchos servicios y equipos. Aquí hay un solo consumidor, "
        "así que basta validar ambos lados contra el mismo OpenAPI.",
    ], size=12, anchor="m")
    d.notes(s, """
        El contrato se prueba por los dos lados. Del lado del proveedor, los 12 tests de contrato del backend
        usan supertest contra la app Nest real, con PostgreSQL en Testcontainers, y validan cada respuesta
        contra el schema del OpenAPI. Del lado del consumidor, los 23 tests de contrato de mocks validan que
        los handlers de MSW que usa el frontend también cumplen el OpenAPI. Así ninguno de los dos lados
        puede divergir en silencio. El libro presenta Pact, que es consumer-driven: tiene sentido con
        muchos consumidores y equipos. Con un solo frontend, validar ambos lados contra el OpenAPI es más
        simple y suficiente.
    """)

    type_slide(d, "Contrato del proveedor: supertest y OpenAPI", [
        ("Qué es", "HTTP real, del controller a PostgreSQL, contra el OpenAPI."),
        ("Qué detecta", "Campos que faltan o sobran, status y errores sin problem+json."),
        ("Herramienta", "supertest, Testcontainers y Ajv con el OpenAPI."),
        ("Dónde corre", "Etapa 6. Deja la cobertura del contrato en un JSON."),
    ], """
const loan = await request(running.http)
  .post('/api/loans')
  .send({ bookId: book.id, borrowerEmail: 'Ana@UC.cl' })
await expectToMatchContract(loan, 'createLoan')
expect(loan.status).toBe(201)
expect(loan.body).toMatchObject({
  bookId: book.id,
  bookTitle: 'La casa de los espíritus',
  borrowerEmail: 'ana@uc.cl',
  loanedAt: '2026-03-02T12:00:00.000Z',
  dueAt: '2026-03-16T12:00:00.000Z',
  returnedAt: null,
  status: 'ACTIVE',
})

const exhausted = await request(running.http)
  .post('/api/loans')
  .send({ bookId: book.id, borrowerEmail: 'beto@uc.cl' })
await expectToMatchContract(exhausted, 'createLoan')
expect(exhausted.status).toBe(409)""", "backend/test/contract/loans.contract.spec.ts (extracto)",
               layout="side", code_w=5.9, book="Libro: contract tests y service tests, p. 68 a 72 y 107.",
               notes="""
        Este es el test de contrato del proveedor: supertest entra por el controller y recorre todo el
        flujo hasta PostgreSQL real en Testcontainers. Pero ojo con el cupcake: aquí no se prueban todas las
        validaciones de campos, eso ya está en unit. Aquí se prueba un caso por código de respuesta del
        contrato y se valida que la forma de la respuesta coincida con el OpenAPI. Fíjate en el correo:
        entra como Ana@UC.cl y sale normalizado, y la fecha de devolución es el reloj fijo más 14 días. El
        reporte contract-coverage.json alimenta la tabla de endpoints que aparece en el PR.
    """)

    type_slide(d, "Fuzzing de API desde el contrato", [
        ("Qué es", "Genera requests a partir del OpenAPI: valores límite, tipos raros, strings enormes."),
        ("Qué detecta", "Errores 500 y respuestas que no cumplen el schema o los headers."),
        ("Herramienta", "Schemathesis: property based testing sobre el OpenAPI."),
        ("Dónde corre", "Etapa 9, contra el stack levantado con Docker."),
    ], """
- name: Schemathesis (property based testing desde el OpenAPI)
  if: ${{ !cancelled() && steps.stack.outcome == 'success' }}
  run: |
    ...
      schemathesis/schemathesis:stable run /specs/openapi.yaml \\
      --url http://localhost:3001 \\
      --checks not_a_server_error,status_code_conformance,content_type_conformance,... \\
      --phases examples,coverage,fuzzing \\
      --max-examples 50 \\
      --generation-database none \\
      --report junit --report-junit-path /reports/junit.xml \\""", ".github/workflows/ci.yml, job sistema (extracto)",
               lang="yaml", book="Libro: tests generados desde specs, cap. 3. Seguridad de APIs, cap. 7.", notes="""
        Esta es la forma sana de generar muchos casos: no con un LLM que escribe 500 tests que hay que
        mantener, sino con una herramienta determinista que explora el espacio de entradas del contrato
        cada vez que corre. Schemathesis lee el OpenAPI y genera requests en tres fases: los ejemplos del
        contrato, casos de cobertura y fuzzing, hasta 50 por operación. Revisa que no haya errores 500 y
        que status, content type, schema y headers de la respuesta calcen con el contrato. No queda código
        que mantener: si cambia el contrato, cambian los casos. El resultado queda en un reporte junit y en
        el comentario del PR.
    """)

    s = d.content("Mock server: el frontend se prueba sin backend")
    d.box(s, 0.45, 1.05, 1.65, 0.7, paras=["**Next.js**", "componentes"], fill=ORANGE, size=12, space_after=0)
    d.box(s, 2.4, 1.05, 1.65, 0.7, paras=["**MSW**", "intercepta /api"], fill=AQUA, size=12, space_after=0)
    d.line(s, 2.12, 1.4, 2.38, 1.4, color=INK, width=2)
    d.box(s, 0.45, 1.83, 3.6, 0.36, "Backend: no hace falta", fill="E4E7EC", color=GRAY, size=12)
    d.text(s, 4.3, 1.02, 5.25, 1.3, [
        "Intercepta en el navegador (Service Worker) y en Node.",
        "Los mismos handlers sirven para componentes, E2E y desarrollo.",
        "Se activa con `NEXT_PUBLIC_API_MOCKING` y valida contra el OpenAPI.",
    ], size=12, bullets=True, space_after=3)
    d.code(s, 0.45, 2.36, 9.1, 2.66, """
http.post('*/api/loans', async ({ request }) => {
  ...
  if (!book) return problem(404, 'BOOK_NOT_FOUND', 'No existe el libro solicitado')

  const notReturned = state.loans.filter(
    (l) => l.borrowerEmail === email && l.returnedAt === null,
  )
  if (notReturned.some((l) => l.bookId === bookId)) {
    return problem(409, 'DUPLICATE_LOAN', `${email} ya tiene prestado este libro`)
  }
  if (notReturned.length >= MAX_ACTIVE_LOANS) {
    return problem(409, 'LOAN_LIMIT_REACHED', `${email} ya tiene 3 préstamos activos`)
  }""", lang="ts", title="frontend/src/mocks/handlers.ts (extracto)")
    d.notes(s, """
        Idea clave de esta diapositiva: para probar el frontend no hace falta levantar el backend. MSW, Mock
        Service Worker, intercepta las requests a nivel de red: en el navegador con un Service Worker y en
        Node con un interceptor. La app hace fetch normal y no sabe que está mockeada: MSW se activa con la
        variable NEXT_PUBLIC_API_MOCKING y app no importa los mocks (ARCH-R8). Los mismos handlers sirven
        para los tests de componentes, para los E2E de Playwright en CI y para desarrollar sin backend. El
        handler respeta el mismo orden de validación que el backend, que está escrito en la spec. Y como
        los handlers se validan contra el OpenAPI, no pueden inventar respuestas que el backend nunca daría.
    """)

    type_slide(d, "Componentes con Vitest, Testing Library y MSW", [
        ("Qué es", "Renderiza un componente en jsdom y lo usa como persona: escribe, hace clic y lee."),
        ("Qué detecta", "Estados de UI incorrectos: errores mal mostrados, botones habilitados de más."),
        ("Herramienta", "Vitest, Testing Library y user-event. server.use() cambia el mock en un test."),
        ("Dónde corre", "Etapa 5 del frontend. Segundos, sin navegador."),
    ], """
it('[UI-LOAN-4] LOAN_LIMIT_REACHED muestra "Alcanzaste el máximo de 3 préstamos activos"', async () => {
  respondWithConflict('LOAN_LIMIT_REACHED')
  await borrow()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Alcanzaste el máximo de 3 préstamos activos',
  )
})""", "frontend/src/features/loans/components/BorrowForm.test.tsx (extracto)", lang="tsx",
               book="Libro: estrategia de testing frontend, p. 187.", notes="""
        En el frontend la mayoría de los casos se prueban a nivel de componente: rápido y sin navegador
        real. respondWithConflict usa server.use de MSW para que, solo en este test, el mock responda 409 con
        el código LOAN_LIMIT_REACHED. Verificamos que la persona ve el mensaje exacto de la spec, UI-LOAN-4.
        Las consultas son por rol y por etiqueta, como las usaría una persona o un lector de pantalla, no
        por clases CSS. Esto es behaviour testing, como vimos en la clase de frontend.
    """)

    type_slide(d, "E2E de flujos con Playwright", [
        ("Qué es", "Un navegador real recorre el flujo completo del usuario, escrito en Gherkin."),
        ("Qué detecta", "Integración entre páginas, rutas y estado: lo que unit no ve."),
        ("Herramienta", "Playwright con playwright-bdd, contra Next y MSW."),
        ("Dónde corre", "Etapa 7. Los @smoke también en la etapa 9, contra el stack real."),
    ], """
// Los flujos de specs/flows/*.feature se convierten en tests (npx bddgen): la spec ES el test.
const flowsDir = defineBddConfig({
  features: '../specs/flows/*.feature',
  featuresRoot: '../specs/flows',
  steps: ['tests/e2e/fixtures.ts', 'tests/e2e/steps/*.ts'],
  outputDir: '.features-gen',
  language: 'es',
  missingSteps: 'fail-on-gen',
})""", "frontend/playwright.config.ts (extracto)",
               book="Libro: UI tests y Playwright, p. 71 y 83 a 95.", notes="""
        Los E2E son pocos y recorren flujos, no validan campos. Cada escenario de los archivos feature es un
        test: hoy son 7. missingSteps fail-on-gen hace que falle la generación si un paso del Gherkin no está
        implementado. En la etapa 7 corren contra Next con MSW, sin backend, así que son rápidos y estables.
        Los marcados smoke corren otra vez en la etapa 9 contra el stack real con PostgreSQL. El proyecto
        flows graba video siempre y el fixture de evidencia toma una captura después de cada paso: eso es lo
        que después se publica en el PR.
    """)

    type_slide(d, "Visual regression con capturas", [
        ("Qué es", "Compara una captura actual con una referencia aprobada, píxel a píxel."),
        ("Qué detecta", "Cambios visuales no intencionales: espaciado, fuentes, elementos que faltan."),
        ("Herramienta", "Playwright toHaveScreenshot con tolerancia de 1 por ciento."),
        ("Dónde corre", "Etapa 7, con datos y reloj fijos. Solo en Linux."),
    ], """
// Regresión visual: compara contra imágenes de referencia generadas en Linux dentro de la
// imagen Docker de Playwright (fuentes y render idénticos a CI). En macOS se omiten.
...
test('[UI-CAT-4] catálogo completo en escritorio', async ({ page }) => {
  await openCatalog(page)
  await expect(page).toHaveScreenshot('catalogo-escritorio.png', { fullPage: true })
})
...
test('[UI-CAT-2] tarjeta de un libro agotado', async ({ page }) => {
  await openCatalog(page)
  await expect(bookCard(page, 'La casa de los espíritus')).toHaveScreenshot('tarjeta-agotada.png')
})""", "frontend/tests/visual/catalog.visual.spec.ts (extracto)",
               book="Libro: visual testing, cap. 6, p. 183 y 195.", notes="""
        El capítulo 6 del libro trata visual testing. Playwright trae toHaveScreenshot, que compara contra
        una referencia y falla si cambia más del 1 por ciento de los píxeles (maxDiffPixelRatio 0.01), con
        animaciones y cursor desactivados. Hay 4 pruebas visuales: el catálogo completo, una tarjeta
        disponible, una agotada y Mis préstamos. Tres consejos prácticos: las referencias se generan en el
        mismo sistema operativo que el CI, los datos y el reloj tienen que ser fijos, y actualizar una
        referencia es un cambio que alguien revisa en el PR. La siguiente diapositiva explica cómo se
        generan.
    """)

    s = d.content("Capturas de referencia: siempre en la imagen de CI")
    d.card(s, 0.45, 1.08, 4.45, 1.95, fill=LIGHT)
    d.text(s, 0.6, 1.14, 4.2, 0.3, "¿Por qué no en tu computador?", size=13, bold=True, color=RED)
    d.text(s, 0.6, 1.5, 4.2, 1.5, [
        "Fuentes, antialiasing y navegador cambian según el sistema: la misma página da otros píxeles.",
        "Una referencia hecha en macOS falla en CI aunque nada cambió.",
        "Por eso en otro sistema se omiten: `ignoreSnapshots` fuera de Linux.",
    ], size=12, bullets=True, space_after=3)
    d.box(s, 5.1, 1.08, 4.45, 0.62, paras=["**Imagen Docker de Playwright**",
                                          "playwright:v1.64.1-noble, fijada por digest"],
          fill=TEAL, size=12, space_after=0)
    for i, (t, sub, col) in enumerate([("Etapa 7 del CI", "compara las capturas", GREEN),
                                       ("visual-baselines.yml", "genera y commitea", PLUM)]):
        x = 5.1 + i * 2.3
        d.line(s, x + 1.07, 1.72, x + 1.07, 2.08, color=MUTED, width=1.75)
        d.box(s, x, 2.1, 2.15, 0.62, paras=[f"**{t}**", sub], fill=col, size=12, space_after=0, margin=0.03)
    d.text(s, 5.1, 2.78, 4.45, 0.3, "Mismo sistema, mismas fuentes, mismo navegador.", size=12, color=GRAY,
           align="c")
    d.text(s, 0.45, 3.18, 4.45, 0.3, "Cuando cambias la UI a propósito", size=13, bold=True, color=TEAL)
    steps = [
        "La etapa 7 falla: es lo esperado.",
        "Corres el workflow a mano sobre tu rama.",
        "Regenera y commitea las capturas.",
        "Revisas los PNG en el PR y relanzas el CI.",
    ]
    for i, st in enumerate(steps):
        y = 3.55 + i * 0.37
        d.circle_num(s, 0.45, y + 0.02, 0.28, i + 1, fill=TEAL, size=12)
        d.text(s, 0.82, y - 0.02, 4.1, 0.36, st, size=12, anchor="m")
    d.code(s, 5.1, 3.18, 4.45, 1.82, """
on:
  push:
    branches: [main]
    paths:
      - 'frontend/tests/visual/**'
      - '.github/workflows/visual-baselines.yml'
  workflow_dispatch:""", lang="yaml", title=".github/workflows/visual-baselines.yml")
    d.notes(s, """
        Las capturas de referencia de los tests visuales dependen del sistema operativo, de las fuentes
        instaladas y del navegador. Si cada persona las genera en su computador, una referencia hecha en
        macOS falla en el CI de Linux aunque la interfaz no haya cambiado. Por eso se generan en la misma
        imagen Docker de Playwright que usa la etapa 7, fijada por digest para que no cambie, con el
        workflow visual-baselines.yml. En main se generan solas la primera vez, cuando todavía no existen.
        Cuando cambias la interfaz a propósito, la etapa 7 falla, y eso es correcto. Entonces corres el
        workflow a mano (workflow_dispatch) sobre tu rama: corre npm run test:e2e con el proyecto visual y
        update-snapshots, y commitea frontend/tests/visual/__screenshots__ como github-actions. El revisor ve
        en el PR el antes y el después de cada imagen. Ojo: un commit hecho con GITHUB_TOKEN no dispara
        otros workflows, así que después hay que volver a correr el CI o hacer un push. Si tienes Docker,
        npm run test:visual:docker hace lo mismo en tu computador con la misma imagen.
    """)

    s = d.content("Estilos y posición: cambió el color, se movió la insignia")
    d.box(s, 0.45, 1.08, 3.6, 1.15, "", fill=WHITE, line=BORDER, line_w=1.25)
    d.text(s, 0.58, 1.16, 2.2, 0.5, "La casa de los espíritus", size=12, bold=True)
    d.box(s, 2.95, 1.18, 0.98, 0.32, "Agotado", fill="B42318", size=12, margin=0.02)
    d.box(s, 0.58, 1.74, 1.55, 0.36, "Pedir prestado", fill="E4E7EC", color=GRAY, size=12, margin=0.02)
    d.line(s, 4.0, 1.08, 4.0, 1.18, color=PURPLE, width=1.25, head=True, tail=True)
    d.text(s, 4.12, 1.0, 1.0, 0.26, "≤ 32 px", size=12, color=PURPLE, bold=True)
    d.text(s, 4.35, 1.35, 5.2, 0.95, [
        "**toHaveCSS** fija el color del token de diseño (UI-CAT-2).",
        "**boundingBox** fija la posición: la insignia arriba a la derecha (UI-CAT-4).",
    ], size=12, bullets=True, space_after=3)
    d.code(s, 0.45, 2.38, 9.1, 1.25, """
test('[UI-CAT-2] la insignia "Agotado" es roja --color-danger (#B42318)', async ({ page }) => {
  const badge = availabilityBadge(page, 'La casa de los espíritus')
  await expect(badge).toHaveText('Agotado')
  await expect(badge).toHaveCSS('background-color', 'rgb(180, 35, 24)')""", lang="ts",
           title="frontend/tests/style/catalog.style.spec.ts (extracto)")
    d.code(s, 0.45, 3.73, 9.1, 1.27, """
      const [card] = await boxes(page.getByRole('article', { name: title, exact: true }))
      const [badge] = await boxes(availabilityBadge(page, title))
      const gapRight = card.x + card.width - (badge.x + badge.width)
      expect(gapRight, `${title}: distancia al borde derecho`).toBeLessThanOrEqual(32)""", lang="ts",
           title="frontend/tests/layout/catalog.layout.spec.ts (extracto)")
    d.notes(s, """
        ¿Cómo verificar que algo cambió de color o de posición? Una captura completa detecta todo, pero
        falla por cualquier píxel y no dice qué se rompió. Estas pruebas son más precisas: toHaveCSS verifica
        que la insignia Agotado tenga exactamente el rojo del token de diseño #B42318, y boundingBox
        verifica que la insignia quede a 32 píxeles o menos del borde derecho y superior de su tarjeta.
        Otras pruebas de layout revisan que la grilla tenga 3 columnas en escritorio y 1 en móvil. Son 6
        pruebas de estilo y 4 de layout. Cuando fallan, el mensaje dice exactamente qué regla de la spec se
        rompió.
    """)

    type_slide(d, "Accesibilidad", [
        ("Qué es", "Audita la página contra reglas WCAG: contraste, etiquetas, roles."),
        ("Qué detecta", "Inputs sin label, contraste insuficiente, roles inválidos."),
        ("Herramienta", "axe-core con @axe-core/playwright. Lighthouse en la etapa 9."),
        ("Dónde corre", "Etapa 7, junto a los E2E con mock server."),
    ], """
async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)
  expect(summary).toEqual([])
}

test('[UI-CAT-1] el catálogo no tiene violaciones WCAG A/AA', async ({ page }) => {
  await openCatalog(page)
  await expectNoViolations(page)
})""", "frontend/tests/a11y/pages.a11y.spec.ts (extracto)",
               book="Libro, cap. 9: Lighthouse p. 295, axe-core p. 297, Pa11y p. 302.", notes="""
        Accesibilidad, capítulo 9 del libro. axe-core es el motor que usan muchas herramientas, y con
        @axe-core/playwright se integra en los mismos E2E: son 4 páginas auditadas contra WCAG 2.0 y 2.1
        nivel A y AA. Detecta problemas objetivos como inputs sin etiqueta o contraste insuficiente, que en
        este proyecto importa porque los estados usan colores. Fíjate en el oráculo: la lista de violaciones
        tiene que ser exactamente vacía, y si no, el mensaje dice cuáles son. Pero el libro es claro: la
        auditoría automática no reemplaza probar con teclado y lector de pantalla.
    """)

    type_slide(d, "Performance", [
        ("Qué es", "Latencia de la API bajo una carga chica y tiempos de carga del frontend."),
        ("Qué detecta", "Regresiones gruesas: una consulta sin índice, un N+1."),
        ("Herramienta", "k6 para la API y Lighthouse CI para el frontend."),
        ("Dónde corre", "Etapa 9, contra el stack real. La carga de verdad, en otro ambiente."),
    ], """
// No es una prueba de carga: son 5 usuarios virtuales durante 20 segundos contra
// el stack real. Sirve para detectar regresiones gruesas (una consulta sin índice,
// un N+1) antes de integrar.
...
export const options = {
  vus: 5,
  duration: '20s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
}""", "tools/perf/k6-smoke.js (extracto)", lang="js",
               book="Libro, cap. 8: JMeter p. 254, Gatling p. 261, Lighthouse p. 270.", notes="""
        Performance, capítulo 8. El libro muestra JMeter y Gatling para APIs y Lighthouse para frontend, con
        un dato muy bueno: Zalando bajó su feedback de performance de un día a 15 minutos con Lighthouse CI
        (p. 270). Aquí usamos k6 porque los scripts son JavaScript. En el PR corre una prueba de humo: 5
        usuarios virtuales durante 20 segundos, con umbrales de percentil 95 bajo 500 milisegundos y menos de
        1 por ciento de errores. Si no se cumplen, k6 termina con error y la etapa falla. Las pruebas de
        carga y estrés de verdad necesitan un ambiente dedicado.
    """)

    type_slide(d, "Mutation testing: de noche, no en cada PR", [
        ("Qué es", "Introduce bugs pequeños (mutantes) y revisa si algún test falla."),
        ("Qué detecta", "Tests que no verifican nada, valores límite sin cubrir."),
        ("Herramienta", "Stryker con Jest en el backend y Vitest en el frontend."),
        ("Dónde corre", "Nightly: mejora los tests, no bloquea PR."),
    ], [("""
const config = {
  ...
  testRunner: 'jest',
  jest: { configFile: 'jest.unit.config.js', enableFindRelatedTests: true },
  mutate: ['src/**/domain/**/*.ts', 'src/**/application/**/*.ts', '!src/**/*.spec.ts'],
  coverageAnalysis: 'perTest',
  ...
  thresholds: { high: 85, low: 70, break: 60 },""", "backend/stryker.config.mjs (extracto)"),
         ("""
    // Los dos casos de 14 dígitos contienen un ISBN válido al inicio o al final. Los agregamos
    // porque Stryker mostró que sin ellos nadie notaba si se borraba el ^ o el $ de la regex.""",
          "backend/src/books/domain/isbn.spec.ts: lo que encontró Stryker")],
               lang="js", book="Libro: code coverage y mutation testing, p. 116 y 117.", notes="""
        ¿Tiene sentido la mutación en el pipeline? Sí, pero no completa en cada PR, porque es lenta: el
        libro dice que es muy efectiva pero consume tiempo y hay que usarla con criterio. La respuesta de la
        industria es la de Google: mutar solo las líneas cambiadas durante el code review. Aquí corre
        completa en el pipeline nocturno. En el backend se muta solo dominio y aplicación, que es donde
        están las reglas, y el job falla si el puntaje baja de 60. El segundo bloque es un caso real: Stryker
        mostró que nadie notaba si se borraba el inicio o el fin de la expresión regular del ISBN, y por eso
        se agregaron dos casos. Así se mejora una suite: con evidencia, no sumando tests al azar.
    """)

    type_slide(d, "Revisión de código con IA basada en las specs", [
        ("Qué es", "Un agente revisa el diff contra la constitución, la arquitectura y los SPEC.md."),
        ("Qué detecta", "Tests sin ID o en la capa equivocada, mocks, capas cruzadas."),
        ("Herramienta", "Claude Code Action en GitHub Actions."),
        ("Dónde corre", "En cada PR listo para revisión. Solo comenta."),
    ], """
- name: Revisar el PR con Claude
  if: env.HAS_ANTHROPIC_KEY == 'true'
  uses: anthropics/claude-code-action@925afb53776cf1a2b738c6bdbed37b4d4000ef13 # v1.0.262
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    github_token: ${{ github.token }}
    prompt: |
      ...
      2. Obtén el diff con `gh pr diff` y revisa SOLO lo que cambió.
      ...
      5. Al final deja UN comentario de resumen con `gh pr comment` que tenga:
         veredicto (aprobar, aprobar con cambios menores o pedir cambios), reglas de spec""",
               ".github/workflows/ai-review.yml (extracto)", lang="yaml",
               book="Libro: reviewer agent y LLM as the judge, p. 103. Claude en Actions, p. 139.", notes="""
        El revisor de IA es un chatbot de code review, pero con una diferencia importante: no revisa con
        criterio genérico, revisa contra las reglas escritas en las specs y cita el ID de la regla que se
        incumple, por ejemplo P4.3 o ARCH-R3. El libro describe este patrón como reviewer agent y LLM as the
        judge: un modelo evalúa con criterios explícitos. Solo comenta, la decisión de merge es humana. Si no
        existe el secreto ANTHROPIC_API_KEY, o el PR viene de un fork, el job termina en verde con un aviso.
        La acción está fijada por SHA completo, igual que todas las acciones del repo.
    """)


# ============================================================================
# F. DevSecOps y CI
# ============================================================================
def part_f(d: Deck):
    d.section("5. DevSecOps y CI")
    s = d.divider("Parte 5", "DevSecOps y CI", "Seguridad en cada etapa, ramas cortas y un pipeline que explica sus decisiones.")
    d.notes(s, "Quinta parte: DevSecOps, estrategias de ramas y el pipeline del repo etapa por etapa.")

    s = d.content("DevSecOps: seguridad en todo el ciclo")

    def loop(cx, cy, rx, ry, col):
        d.box(s, cx - rx, cy - ry, 2 * rx, 2 * ry, "", fill=None, line=col, line_w=7, shape="oval")

    cyc = 2.8
    loop(3.05, cyc, 1.75, 1.15, TEAL)
    loop(6.95, cyc, 1.75, 1.15, ORANGE)
    d.box(s, 4.5, cyc - 0.42, 1.0, 0.84, "Sec", fill=RED, size=16, shape="oval")
    stages = [
        ("Plan", 3.05, cyc - 1.15, TEAL), ("Code", 1.3, cyc - 0.45, TEAL), ("Build", 1.3, cyc + 0.45, TEAL),
        ("Test", 3.05, cyc + 1.15, TEAL), ("Release", 6.95, cyc - 1.15, ORANGE), ("Deploy", 8.7, cyc - 0.45, ORANGE),
        ("Operate", 8.7, cyc + 0.45, ORANGE), ("Monitor", 6.95, cyc + 1.15, ORANGE),
    ]
    for name, x, y, col in stages:
        d.box(s, x - 0.6, y - 0.21, 1.2, 0.42, name, fill=WHITE, color=col, line=col, line_w=2, size=12)
    d.text(s, 2.25, cyc - 0.2, 1.6, 0.4, "Dev", size=16, bold=True, color=TEAL, align="c", anchor="m")
    d.text(s, 6.15, cyc - 0.2, 1.6, 0.4, "Ops", size=16, bold=True, color=ORANGE, align="c", anchor="m")
    d.text(s, 0.45, 4.38, 9.1, 0.6, "Cada etapa tiene un control de seguridad automático. La seguridad deja de "
           "ser una revisión al final y pasa a ser parte del flujo.", size=13, align="c", color=GRAY)
    d.notes(s, """
        DevOps es el lazo infinito: planificar, programar, construir, probar, liberar, desplegar, operar y
        monitorear, y volver a empezar. DevSecOps agrega seguridad en el centro: cada etapa tiene un control
        automático, en vez de una auditoría al final antes de salir a producción. El principio P5 de la
        constitución lo dice: seguridad desde el inicio. En la siguiente diapositiva vemos qué control va en
        cada etapa.
    """)

    s = d.content("Qué control de seguridad va en cada etapa")
    rows = [
        ["Etapa", "Control", "En este repo"],
        ["Plan", "Modelado de amenazas (STRIDE, p. 213)", "Specs con reglas y códigos de error"],
        ["Code", "Secretos antes del commit (Talisman, p. 238)", "Hook pre-commit con gitleaks"],
        ["Build", "SAST y análisis de dependencias (SCA)", "Semgrep, CodeQL, npm audit, Trivy fs"],
        ["Test", "DAST y fuzzing contra la app corriendo", "OWASP ZAP, Schemathesis"],
        ["Release", "Escaneo de imagen y SBOM", "Trivy image, SBOM CycloneDX"],
        ["Deploy", "Dockerfile y workflows como código", "hadolint, actionlint, zizmor"],
        ["Operate", "Mínimo privilegio", "USER node, permissions: {} por job"],
        ["Monitor", "CVE nuevas en lo ya integrado", "Dependabot semanal (no hay CD)"],
    ]
    d.table(s, 0.45, 1.08, 9.1, rows, [1.05, 4.25, 3.8], row_h=0.42, first_col_bold=True)
    d.notes(s, """
        Esta tabla baja DevSecOps a tierra. En Plan, modelado de amenazas con STRIDE, que el libro explica en
        el capítulo 7, y reglas con códigos de error en la spec. En Code, evitar que un secreto llegue al
        repo: el libro usa Talisman y aquí el hook pre-commit corre gitleaks. En Build, análisis estático y
        de dependencias. En Test, ataques reales contra la app corriendo. En Release, escanear la imagen y
        generar el SBOM. Deploy y Operate: el repo no tiene CD, pero los Dockerfile y los workflows se
        revisan como código, los contenedores corren sin root y cada job pide solo los permisos que
        necesita. Monitor: una dependencia que hoy está limpia mañana puede tener una CVE nueva, por eso
        Dependabot propone actualizaciones cada semana.
    """)

    s = d.content("Shift left: mover las pruebas al inicio")
    d.line(s, 0.8, 4.35, 5.6, 4.35, color=INK, width=1.5)
    d.line(s, 0.8, 4.35, 0.8, 1.25, color=INK, width=1.5)
    for i, lab in enumerate(["Requisitos", "Diseño", "Código", "Test", "Producción"]):
        d.text(s, 1.05 + i * 0.95 - 0.3, 4.42, 1.2, 0.3, lab, size=12, color=GRAY, align="c")
    d.text(s, 0.2, 1.2, 0.6, 0.3, "Costo", size=12, color=GRAY)
    for i, hgt in enumerate([0.25, 0.45, 0.8, 1.5, 2.75]):
        x = 1.05 + i * 0.95
        col = GREEN if i < 3 else (ORANGE if i == 3 else RED)
        d.box(s, x, 4.33 - hgt, 0.6, hgt, "", fill=col, shape="rect")
    d.line(s, 4.9, 1.55, 2.0, 1.55, color=PURPLE, width=3)
    d.text(s, 2.0, 1.15, 2.9, 0.32, "shift left", size=14, bold=True, color=PURPLE, align="c")
    bullet_card(d, s, 6.0, 1.1, 3.55, 3.75, "En el día a día", [
        "Kickoff de la historia con los tres amigos: negocio, desarrollo y testing.",
        "La IA como **cuarto amigo**: propone casos y amenazas para discutir.",
        "Tests automáticos en el PR, no en una fase de QA al final.",
        "La seguridad también se mueve a la izquierda.",
    ], space_after=6)
    source(d, s, "Libro, p. 4 a 6", y=4.8, w=5.4)
    d.notes(s, """
        Shift left es la idea central del libro: hacer las pruebas al principio y durante todo el desarrollo
        en vez de al final, porque un defecto cuesta más mientras más tarde se encuentra. El libro lo baja a
        prácticas: un kickoff de cada historia con negocio, desarrollo y testing, los tres amigos, y propone
        sumar a la IA como cuarto amigo, para proponer casos y amenazas que el equipo discute. Fíjate en la
        palabra discute: la IA aporta ideas, el equipo decide.
    """)

    # ------------------------------------------------------------------ Git Flow
    s = d.content("Git Flow: ramas de larga vida y releases")
    lanes = [("main", 1.32, TEAL), ("hotfix", 1.77, RED), ("release", 2.22, ORANGE), ("develop", 2.67, PLUM),
             ("feature", 3.12, GREEN)]
    Y = {n: y for n, y, _ in lanes}
    COL = {n: c for n, _, c in lanes}
    for name, y, col in lanes:
        d.chip(s, 0.45, y - 0.17, 1.2, 0.34, name, fill=col, size=12)
        permanent = name in ("main", "develop")
        d.line(s, 1.8, y, 9.5, y, color=col if permanent else "D8DEE4", width=3 if permanent else 1.0,
               head=False)

    def dot(lane, x, d_=0.2):
        d.box(s, x - d_ / 2, Y[lane] - d_ / 2, d_, d_, "", fill=COL[lane], shape="oval", line=WHITE, line_w=1.25)

    def branch(lane, parent, x0, x1, commits, targets):
        """Una rama temporal: sale de `parent` en x0, tiene commits y vuelve a cada (target, x)."""
        col = COL[lane]
        dot(parent, x0, 0.16)
        d.line(s, x0, Y[parent] + (0.09 if Y[lane] > Y[parent] else -0.09), x0, Y[lane], color=col, width=1.75,
               head=False)
        d.line(s, x0, Y[lane], x1, Y[lane], color=col, width=3.5, head=False)
        for x in commits:
            dot(lane, x)
        for target, x in targets:
            down = Y[target] > Y[lane]
            d.line(s, x, Y[lane], x, Y[target] + (-0.12 if down else 0.12), color=col, width=1.75)
            dot(target, x)

    branch("feature", "develop", 2.25, 3.65, [2.7, 3.2], [("develop", 3.65)])
    branch("hotfix", "main", 4.15, 5.2, [4.55], [("main", 4.95), ("develop", 5.2)])
    branch("feature", "develop", 5.55, 6.65, [5.95, 6.3], [("develop", 6.65)])
    branch("release", "develop", 6.95, 8.65, [7.4, 7.85], [("main", 8.4), ("develop", 8.65)])
    dot("main", 2.0)
    for x, tag in ((2.0, "v1.0"), (4.95, "v1.0.1"), (8.4, "v1.1")):
        d.text(s, x - 0.5, 0.98, 1.0, 0.26, tag, size=12, bold=True, color=TEAL, align="c")
    for n, x, lane in ((1, 2.95, "feature"), (2, 7.62, "release"), (3, 4.55, "hotfix")):
        d.circle_num(s, x - 0.15, Y[lane] + 0.13, 0.3, n, fill=INK, size=12)
    legend = [
        ("Una feature sale de develop, dura días o semanas y vuelve a develop.", GREEN),
        ("La release sale de develop, se estabiliza y entra a main (v1.1) y a develop.", ORANGE),
        ("El hotfix sale de main, corrige y entra a main (v1.0.1) y a develop.", RED),
    ]
    for i, (txt, col) in enumerate(legend):
        x = 0.45 + i * 3.08
        d.card(s, x, 3.62, 2.94, 0.98, fill=LIGHT)
        d.circle_num(s, x + 0.1, 3.7, 0.3, i + 1, fill=INK, size=12)
        d.text(s, x + 0.48, 3.66, 2.4, 0.92, txt, size=12)
    d.text(s, 0.45, 4.68, 9.1, 0.32, "Dos ramas permanentes (main y develop). Conviene cuando conviven varias "
           "versiones en producción.", size=12, color=GRAY, align="c")
    d.notes(s, """
        Git Flow, de Vincent Driessen, 2010. Hay dos ramas permanentes, las líneas gruesas: main con lo
        liberado y develop con lo integrado. Sigan los números. Uno: una feature sale de develop y vuelve a
        develop cuando termina, que puede ser semanas después. Dos: para liberar se crea una rama release
        desde develop, se estabiliza y se fusiona a main, donde se etiqueta la versión v1.1, y también de
        vuelta a develop. Tres: un hotfix sale de main, corrige el error en producción y entra a main como
        v1.0.1 y también a develop, para no perder el arreglo. Funciona cuando hay versiones numeradas que
        conviven, por ejemplo una app móvil o una librería. El costo: integración tardía y merges grandes.
    """)

    # ------------------------------------------------------------------ Trunk based
    s = d.content("Trunk Based Development: un tronco y ramas de horas")
    y0 = 1.95
    d.chip(s, 0.45, y0 - 0.17, 1.2, 0.34, "main", fill=TEAL, size=12)
    d.line(s, 1.8, y0, 9.5, y0, color=TEAL, width=3.5, head=True)
    branches = [(2.0, "3 horas"), (3.85, "1 día"), (5.7, "4 horas"), (7.55, "2 días")]
    for i, (x, dur) in enumerate(branches):
        x_end = x + 1.15
        yb = y0 + 0.62
        d.box(s, x - 0.1, y0 - 0.1, 0.2, 0.2, "", fill=TEAL, shape="oval", line=WHITE, line_w=1.25)
        d.line(s, x + 0.05, y0 + 0.08, x + 0.3, yb - 0.06, color=GREEN, width=1.75, head=False)
        d.line(s, x + 0.3, yb, x_end - 0.3, yb, color=GREEN, width=3, head=False)
        for cxp in (x + 0.38, x_end - 0.38):
            d.box(s, cxp - 0.08, yb - 0.08, 0.16, 0.16, "", fill=GREEN, shape="oval")
        d.line(s, x_end - 0.3, yb - 0.06, x_end - 0.05, y0 + 0.1, color=GREEN, width=1.75)
        d.box(s, x_end - 0.12, y0 - 0.12, 0.24, 0.24, "", fill=TEAL, shape="oval", line=WHITE, line_w=1.25)
        d.box(s, x_end - 0.17, y0 - 0.66, 0.34, 0.34, "✓", fill=GREEN, size=12, shape="oval", margin=0)
        d.text(s, x - 0.05, yb + 0.1, 1.25, 0.3, dur, size=12, color=GREEN, bold=True, align="c")
    d.text(s, 4.2, y0 - 0.98, 4.0, 0.3, "CI completo en cada PR", size=12, color=GREEN, bold=True)
    d.circle_num(s, 3.35, y0 + 0.42, 0.3, 1, fill=INK, size=12)
    d.circle_num(s, 3.55, y0 - 0.66, 0.3, 2, fill=INK, size=12)
    d.circle_num(s, 9.05, y0 + 0.2, 0.3, 3, fill=INK, size=12)
    cards = [
        ("Ramas cortas", "Horas, máximo 2 días (constitución P6). Integrar seguido evita merges grandes."),
        ("PR con CI", "Cada PR corre el pipeline completo. Si falla, no entra."),
        ("main siempre verde", "Lo incompleto entra apagado detrás de un feature flag y se libera desde main."),
    ]
    for i, (t, txt) in enumerate(cards):
        x = 0.45 + i * 3.08
        d.card(s, x, 3.25, 2.94, 1.72, fill=LIGHT)
        d.circle_num(s, x + 0.12, 3.35, 0.3, i + 1, fill=INK, size=12)
        d.text(s, x + 0.5, 3.33, 2.35, 0.34, t, size=13, bold=True, color=TEAL)
        d.text(s, x + 0.12, 3.75, 2.72, 1.18, txt, size=12)
    d.notes(s, """
        Trunk based development: todos integran a main, el tronco. Sigan los números. Uno: las ramas duran
        horas o a lo más un par de días, la constitución del proyecto lo fija en menos de 2 días. Dos: cada
        rama entra por un PR que corre el pipeline completo, el check verde que ven arriba. Tres: main tiene
        que estar siempre verde, y si se rompe, arreglarlo es la prioridad del equipo. Lo que no está
        terminado se integra igual, pero apagado detrás de un feature flag, en vez de vivir semanas en una
        rama aparte. El libro lo dice al hablar de control de versiones: una rama de feature de larga vida
        es un antipatrón.
    """)

    s = d.content("¿Git Flow o trunk based?")
    rows = [
        ["", "Git Flow", "Trunk Based"],
        ["Vida de las ramas", "Semanas", "Horas o pocos días"],
        ["Integración", "Al final, merges grandes", "Continua, lotes pequeños"],
        ["Releases", "Programados, rama release", "Cuando quieras, desde main"],
        ["Lo incompleto", "Vive en la rama", "Detrás de feature flags"],
        ["Conviene si", "Varias versiones vivas", "Servicio web con CI confiable"],
    ]
    d.table(s, 0.45, 1.08, 5.75, rows, [1.65, 2.05, 2.05], row_h=0.5, first_col_bold=True)
    bullet_card(d, s, 6.4, 1.08, 3.15, 3.9, "Por qué el CI empuja TBD", [
        "DORA: lead time, frecuencia de despliegue, recuperación, tasa de fallas y retrabajo (p. 144).",
        "Con IA se escribe más código por día: con ramas largas, los merges explotan.",
    ], fill=LIGHTBLUE, space_after=8)
    d.text(s, 0.45, 4.25, 5.75, 0.7, "Lotes pequeños = PR pequeños = evidencia que alguien sí alcanza a revisar.",
           size=13, bold=True, color=INK)
    d.notes(s, """
        Comparación directa. Git Flow tiene sentido con varias versiones vivas, por ejemplo apps instaladas
        que no se actualizan solas. Para un servicio web con CI confiable, trunk based gana. Las métricas
        DORA del libro (p. 144) lo explican: lead time corto y despliegues frecuentes requieren lotes
        pequeños, y los equipos de alto desempeño despliegan varias veces al día. Con IA esto se vuelve más
        importante: si cada persona produce el triple de código, las ramas largas generan conflictos enormes
        y PRs que nadie revisa de verdad. Pregunta para el curso: ¿qué usan hoy en el proyecto del curso?
    """)

    # ------------------------------------------------------------------ ¿Qué es esto?
    s = d.content("¿Qué es esto? SAST, DAST, Semgrep, Trivy y dependencias")
    rows = [
        ("SAST", "Static Application Security Testing", "Revisa el código **sin ejecutarlo**. Como revisar los "
         "planos de un edificio.", "Semgrep y CodeQL, etapa 3", RED),
        ("DAST", "Dynamic Application Security Testing", "Ataca la app **ya corriendo**, desde afuera. Como "
         "probar las puertas del edificio.", "OWASP ZAP contra el stack, etapa 9", RED),
        ("Semgrep", "una herramienta de SAST", "Busca patrones peligrosos con reglas legibles. Puedes escribir "
         "reglas propias.", "Registro + .semgrep/rules.yml, etapa 3", ORANGE),
        ("Trivy", "escáner todo terreno", "Busca CVE en dependencias e imágenes, secretos y "
         "configuración insegura.", "Trivy fs (etapa 4) y Trivy image (etapa 8)", ORANGE),
        ("Dependencias", "SCA: Software Composition Analysis", "Revisa las librerías de terceros contra bases "
         "de vulnerabilidades (CVE).", "dependency review y npm audit (etapa 4), Dependabot", PLUM),
    ]
    d.text(s, 2.25, 1.0, 4.3, 0.28, "Qué es, en simple", size=12, bold=True, color=GRAY)
    d.text(s, 6.75, 1.0, 2.8, 0.28, "En este repo", size=12, bold=True, color=GRAY)
    for i, (name, full, what, here, col) in enumerate(rows):
        y = 1.3 + i * 0.74
        d.card(s, 0.45, y, 9.1, 0.66, fill=LIGHT)
        d.box(s, 0.45, y, 1.65, 0.66, paras=[f"**{name}**"], fill=col, size=14, space_after=0)
        d.text(s, 2.25, y + 0.02, 4.35, 0.62, what, size=12, anchor="m")
        d.text(s, 6.75, y + 0.02, 2.75, 0.62, here, size=12, anchor="m", color=TEAL, bold=True)
    source(d, s, "SAST mira el código, DAST mira la app corriendo y SCA mira el código de otros. "
           "Semgrep y Trivy son herramientas concretas.", y=5.02, w=9.1)
    d.notes(s, """
        Esta es la diapositiva de qué es esto. SAST, Static Application Security Testing, analiza el código
        sin ejecutarlo, como revisar los planos de un edificio: encuentra inyección SQL o XSS mirando el
        código. DAST, Dynamic Application Security Testing, ataca la aplicación ya corriendo, desde afuera y
        por HTTP, como probar las puertas y ventanas del edificio terminado: encuentra headers faltantes o
        errores que filtran datos. Semgrep es una herramienta de SAST: busca patrones con reglas que se leen
        casi como código, y el repo tiene reglas propias que salen de las specs. Trivy es un escáner todo
        terreno: vulnerabilidades conocidas (CVE) en las dependencias del repo y en las imágenes Docker,
        secretos y configuración insegura. Y el análisis de dependencias, SCA, revisa el código que no
        escribimos nosotros: las librerías de npm. En el PR lo hacen dependency review y npm audit, y
        Dependabot propone actualizaciones cada semana.
    """)

    s = d.content("Otras siglas que vas a ver: secretos, IaC y SBOM")
    cards = [
        ("Secretos", "Secret scanning", "Busca llaves y tokens en el código y en todo el historial de git.",
         "gitleaks (etapa 1) y el hook pre-commit", "Llaves olvidadas en la puerta", RED),
        ("IaC", "Infraestructura como código", "Revisa Dockerfile, compose y workflows como si fueran código.",
         "hadolint, actionlint y zizmor (etapa 2)", "Revisar las instalaciones", ORANGE),
        ("SBOM", "Software Bill of Materials", "Inventario de todo lo que va dentro de la imagen.",
         "Trivy genera el SBOM CycloneDX (etapa 8)", "La lista de ingredientes", PLUM),
    ]
    for i, (ab, full, what, here, analog, col) in enumerate(cards):
        x = 0.45 + i * 3.08
        d.card(s, x, 1.08, 2.94, 3.9, fill=LIGHT)
        d.text(s, x + 0.15, 1.14, 2.6, 0.5, ab, size=22, bold=True, color=col, font=k.FONT_TITLE)
        d.text(s, x + 0.15, 1.66, 2.65, 0.3, full, size=12, color=GRAY)
        d.text(s, x + 0.15, 2.04, 2.65, 0.85, what, size=12)
        d.text(s, x + 0.15, 2.95, 2.65, 0.3, "En este repo", size=12, bold=True, color=TEAL)
        d.text(s, x + 0.15, 3.27, 2.65, 0.68, here, size=12)
        d.text(s, x + 0.15, 4.12, 2.65, 0.7, f"Analogía: {analog}", size=12, italic=True, color=col)
    d.notes(s, """
        Tres siglas más. El escaneo de secretos busca llaves y tokens, también en el historial de git,
        porque borrar un archivo no borra el commit. Por eso corre primero, en la etapa 1, y también en el
        hook pre-commit, antes de que el secreto llegue al historial. IaC, infraestructura como código: el
        Dockerfile, el compose y los workflows también tienen errores de seguridad, como un contenedor que
        corre como root o una acción de GitHub sin fijar. hadolint revisa los Dockerfile, actionlint la
        sintaxis de los workflows y zizmor su seguridad. Y el SBOM es la lista de ingredientes de la imagen:
        cuando sale una CVE nueva, responde en minutos si te afecta.
    """)

    s = d.content("Las herramientas de seguridad, etapa por etapa")
    rows = [
        ["Herramienta", "Tipo", "Qué detecta", "Etapa"],
        ["gitleaks", "Secretos", "Llaves y tokens en commits y en el historial", "1"],
        ["hadolint, actionlint, zizmor", "IaC y CI", "Dockerfile y workflows inseguros o mal escritos", "2"],
        ["Semgrep", "SAST", "Patrones inseguros, también con reglas propias", "3"],
        ["CodeQL", "SAST", "Un input que fluye hasta una consulta o la respuesta", "3"],
        ["Dependency review, npm audit", "SCA", "Dependencias con CVE high o crítica", "4"],
        ["Trivy", "SCA, secretos, IaC", "CVE en el repo y en las imágenes, misconfig", "4 y 8"],
        ["SBOM (CycloneDX)", "SBOM", "Inventario de cada imagen", "8"],
        ["OWASP ZAP", "DAST", "Headers, cookies e inyecciones en la app corriendo", "9"],
        ["Schemathesis", "Fuzzing", "Errores 500 y desvíos del contrato", "9"],
    ]
    d.table(s, 0.45, 1.08, 9.1, rows, [2.6, 1.75, 4.05, 0.7], row_h=0.38, first_col_bold=True,
            align=["l", "l", "l", "c"])
    d.notes(s, """
        Y estas son las herramientas concretas, en el orden en que aparecen en el pipeline. gitleaks para
        secretos. hadolint, actionlint y zizmor para Dockerfile y workflows. Semgrep y CodeQL para SAST:
        Semgrep con reglas legibles, incluso reglas propias, y CodeQL con análisis de flujo de datos.
        Dependency review y npm audit para dependencias, y Trivy, la navaja suiza, que escanea el repo en la
        etapa 4 y las imágenes en la etapa 8, donde también genera el SBOM en formato CycloneDX. OWASP ZAP es
        el DAST, el libro lo trabaja en la p. 229, y Schemathesis hace fuzzing desde el contrato. Los
        resultados en formato SARIF aparecen en la pestaña Security de GitHub.
    """)

    type_slide(d, "SAST con reglas de la spec: Semgrep", [
        ("Qué es", "Análisis estático con reglas propias que convierten decisiones de la spec en chequeos."),
        ("Qué detecta", "Hora del sistema en el dominio, SQL concatenado, fetch en componentes."),
        ("Herramienta", "Semgrep con reglas del registro y .semgrep/rules.yml. CodeQL suma flujo de datos."),
        ("Dónde corre", "Etapa 3. Un hallazgo ERROR rompe el build y queda en la pestaña Security."),
    ], """
- id: biblioteca-usar-clock
  languages: [typescript]
  severity: ERROR
  message: >-
    No leas la hora del sistema en domain ni application. Recibe la hora desde el
    puerto Clock (SPEC-LIB-02, LOAN-R6): así los tests usan un reloj fijo y el
    estado OVERDUE es determinista.
  ...
  pattern-either:
    - pattern: Date.now()
    - pattern: new Date()""", ".semgrep/rules.yml (extracto)", lang="yaml",
               book="Libro: SAST en la estrategia de seguridad, p. 225.", notes="""
        Semgrep es el SAST principal del pipeline. Además de las reglas del registro (p/default, typescript,
        nodejs y owasp-top-ten), el repo tiene reglas propias que salen de las specs. Esta prohíbe leer la
        hora del sistema en el dominio y en la aplicación, porque LOAN-R6 calcula el estado vencido con el
        reloj y los tests necesitan un reloj fijo. Si un agente escribe new Date() en un caso de uso, el PR
        falla con un mensaje que cita la regla de la spec. Otras reglas prohíben SQL concatenado (inyección
        SQL), fetch directo en componentes (ARCH-R7) y dangerouslySetInnerHTML. Las reglas propias también
        tienen tests: el job corre semgrep --test antes de escanear.
    """)

    type_slide(d, "DAST: OWASP ZAP contra el stack real", [
        ("Qué es", "Ataca la app corriendo: baseline al frontend y API scan guiado por el OpenAPI."),
        ("Qué detecta", "Headers de seguridad faltantes, cookies inseguras, inyecciones."),
        ("Herramienta", "OWASP ZAP con reglas versionadas en tools/zap/rules.tsv."),
        ("Dónde corre", "Etapa 9. Una alerta High o una regla FAIL rompe el build."),
    ], """
# Formato: <id de regla><TAB><IGNORE|WARN|FAIL><TAB>(<nombre>)
# Toda regla ignorada lleva su justificación en el comentario de arriba.
...
# HSTS solo tiene sentido sobre HTTPS. En CI el stack corre en http://localhost.
10035   IGNORE  (Strict-Transport-Security Header Not Set)
...
# Reglas que se mantienen visibles a propósito (hallazgos reales para conversar en clase):
10038   WARN    (Content Security Policy (CSP) Header Not Set)
...
# Inyecciones: si aparecen, el build falla aunque ZAP las considere de riesgo medio.
40018   FAIL    (SQL Injection)""", "tools/zap/rules.tsv (extracto)", lang="sh",
               book="Libro: ZAP, p. 229. Estrategia de seguridad, p. 225.", notes="""
        OWASP ZAP es el DAST: ataca la aplicación ya corriendo, por HTTP, sin mirar el código. Corre en la
        etapa 9, cuando el stack completo está levantado con Docker. Hace un baseline pasivo sobre el
        frontend y un API scan activo que usa el OpenAPI para saber qué endpoints atacar. Lo importante
        didácticamente es este archivo: cada alerta que se ignora tiene su justificación escrita y versionada,
        igual que el código. Algunas se dejan como WARN a propósito, como la falta de Content Security
        Policy, para conversarlas en clase. Y las inyecciones son FAIL: si aparecen, el build falla.
    """)

    # ------------------------------------------------------------------ Pipeline
    s = d.content("El pipeline del repo: dos ciclos de feedback")
    d.box(s, 0.45, 2.35, 1.1, 1.0, paras=["**0**", "Detectar cambios"], fill=GRAY, size=12, space_after=0,
          margin=0.03)
    # primer ciclo: etapas 1 a 7 en paralelo
    fx, fw = 1.75, 4.05
    d.box(s, fx, 1.05, fw, 3.42, "", fill=None, line=BORDER, line_w=1.25, dash=True)
    d.text(s, fx + 0.1, 1.07, fw - 0.2, 0.3, "Primer ciclo: en paralelo, sin desplegar", size=12, bold=True,
           color=GRAY)
    first = [("Secretos", "gitleaks", C_SEC), ("Calidad y spec", "lint, tipos, contrato", C_QUAL),
             ("SAST", "Semgrep y CodeQL", C_SEC), ("Dependencias", "npm audit, Trivy fs", C_SEC),
             ("Unitarios", "Jest y Vitest", C_TEST), ("Integración", "Testcontainers", C_TEST),
             ("E2E", "Playwright + MSW", C_TEST)]
    for i, (t, tools, col) in enumerate(first):
        y = 1.42 + i * 0.43
        d.box(s, fx + 0.1, y, fw - 0.2, 0.37, "", fill=LIGHT)
        d.circle_num(s, fx + 0.15, y + 0.035, 0.3, i + 1, fill=col, size=12)
        d.text(s, fx + 0.52, y, 1.45, 0.37, t, size=12, bold=True, color=col, anchor="m")
        d.text(s, fx + 1.98, y, fw - 2.1, 0.37, tools, size=12, anchor="m")
    d.line(s, 1.57, 2.85, fx - 0.02, 2.85, color=MUTED, width=1.75)
    # segundo ciclo: build y sistema
    sx = 6.0
    d.box(s, sx, 1.05, 2.45, 3.42, "", fill=None, line=BORDER, line_w=1.25, dash=True)
    d.text(s, sx + 0.08, 1.07, 2.3, 0.3, "Segundo ciclo: corriendo", size=12, bold=True, color=GRAY)
    d.box(s, sx + 0.1, 1.42, 1.0, 2.9, paras=["**8**", "Build", "Trivy image", "SBOM"], fill=C_BUILD, size=12,
          space_after=2, margin=0.03)
    d.box(s, sx + 1.3, 1.42, 1.05, 1.75, paras=["**9**", "Sistema", "smoke, k6, Lighthouse"], fill=C_TEST,
          size=12, space_after=2, margin=0.03)
    d.box(s, sx + 1.3, 3.3, 1.05, 1.02, paras=["**9**", "DAST", "ZAP"], fill=C_SEC, size=12, space_after=1,
          margin=0.03)
    d.line(s, sx + 1.12, 2.3, sx + 1.28, 2.3, color=MUTED, width=1.5)
    d.line(s, sx + 1.12, 3.8, sx + 1.28, 3.8, color=MUTED, width=1.5)
    d.line(s, fx + fw + 0.02, 2.85, sx - 0.02, 2.85, color=MUTED, width=1.75)
    # evidencia y resultado
    ex = 8.62
    d.box(s, ex, 1.42, 0.93, 1.6, paras=["**10**", "Evidencia en el PR"], fill=C_EVID, size=12, space_after=2,
          margin=0.03)
    d.box(s, ex, 3.2, 0.93, 1.12, paras=["**Resultado**", "un check"], fill=INK, size=12, space_after=2,
          margin=0.02)
    d.line(s, sx + 2.47, 2.2, ex - 0.02, 2.2, color=MUTED, width=1.75)
    # nightly
    d.box(s, 0.45, 4.6, 9.1, 0.42, "", fill=WHITE, line=PLUM, line_w=1.25, dash=True)
    d.text(s, 0.55, 4.6, 1.0, 0.42, "Nightly", size=12, bold=True, color=PLUM, anchor="m")
    d.text(s, 1.5, 4.6, 8.0, 0.42, "Stryker en backend y frontend · flujos en Firefox y WebKit · ZAP full scan "
           "(a mano)", size=12, anchor="m")
    d.notes(s, """
        Este es el pipeline real de .github/workflows/ci.yml, y el dibujo muestra algo importante: no es una
        fila de etapas una tras otra. La etapa 0 mira qué carpetas cambió el PR, para no probar el backend
        si solo cambió el frontend. Después viene el primer ciclo de feedback: las etapas 1 a 7 corren en
        paralelo y ninguna necesita desplegar nada. Secretos, calidad y spec (lint, tipos, arquitectura,
        Spectral, oasdiff, spec-trace, hadolint, actionlint y zizmor), SAST, dependencias, unitarios,
        integración con contrato y E2E con el mock server. El segundo ciclo necesita la app construida: la
        etapa 8 construye las imágenes una sola vez, cuando calidad y unitarios están en verde, las escanea
        con Trivy y genera el SBOM. La etapa 9 levanta ese mismo artefacto con PostgreSQL y corre en
        paralelo las pruebas de sistema (smoke de la API, Schemathesis, Playwright @smoke, k6 y Lighthouse) y
        el DAST con ZAP. La etapa 10 espera a todas y publica la evidencia en el PR, y el job Resultado es
        el único check que exige la protección de la rama. Lo lento va de noche. El libro cita a Humble y
        Farley: la etapa de build and test debería durar lo que tomarse una taza de té (p. 127).
    """)


# ============================================================================
# G. Evidencia en el PR
# ============================================================================
def part_g(d: Deck):
    d.section("6. Evidencia en el PR")
    s = d.divider("Parte 6", "Evidencia en el PR", "Que el revisor vea lo que cambió sin descargar nada.")
    d.notes(s, "Sexta parte: qué publica el pipeline en cada Pull Request y por qué.")

    s = d.content("Qué publica el pipeline en cada PR")
    items = [
        ("Capturas", "Una por paso de cada flujo E2E", ["frontend/evidence/", "manifest.json"], ORANGE),
        ("GIF", "El video de cada flujo, visible en GitHub", ["videos/", "FLOW-*.webm"], AQUA),
        ("Endpoints", "Status que probaron el contrato y el smoke", ["backend/reports/", "contract-coverage.json"],
         GREEN),
        ("Seguridad", "Resumen de cada herramienta y la etapa que falló", ["reportes JSON", "de cada job"], RED),
    ]
    for i, (t, desc, src, col) in enumerate(items):
        x = 0.45 + i * 2.32
        d.card(s, x, 1.08, 2.18, 2.35, fill=LIGHT)
        d.box(s, x + 0.15, 1.2, 1.88, 0.42, t, fill=col, size=13)
        d.text(s, x + 0.15, 1.72, 1.9, 1.0, desc, size=12, color=INK)
        d.text(s, x + 0.12, 2.8, 1.96, 0.55, src, size=10, color=GRAY, font=k.FONT_CODE, space_after=0)
    flow = [("Artefactos de los jobs", TEAL), ("tools/evidence", PLUM), ("Comentario único en el PR", GREEN)]
    for i, (t, col) in enumerate(flow):
        x = 0.7 + i * 3.0
        d.box(s, x, 3.65, 2.6, 0.5, t, fill=col, size=12)
        if i < 2:
            d.line(s, x + 2.62, 3.9, x + 2.98, 3.9, color=MUTED, width=1.75)
    d.text(s, 0.45, 4.3, 9.1, 0.7, "El comentario se actualiza en cada push (no se acumulan) y cada ítem lleva "
           "el ID del flujo o de la regla.", size=12, color=GRAY, align="c")
    d.notes(s, """
        El principio P6 dice que todo cambio entra por PR con evidencia. Concretamente se publican cuatro
        cosas: capturas de cada paso de los flujos, los videos convertidos a GIF para verlos directamente en
        GitHub, la tabla de endpoints que probaron el contrato y el smoke, y un resumen de seguridad y
        calidad. Todo sale de archivos con formato acordado en specs/architecture.md: el manifest.json del
        frontend y el contract-coverage.json del backend. La etapa 10 descarga los artefactos, convierte los
        videos a GIF con ffmpeg, publica las imágenes en la rama evidence y arma un solo comentario que se
        actualiza en cada push.
    """)

    s = d.content("Así se ve el comentario")
    d.box(s, 0.45, 1.05, 9.1, 3.97, "", fill=WHITE, line=BORDER, line_w=1)
    d.box(s, 0.45, 1.05, 9.1, 0.42, "", fill=CODEBG, line=BORDER, line_w=1, shape="rect")
    d.text(s, 0.6, 1.05, 8.8, 0.42, "**github-actions** comentó · Evidencia de CI · PR #42 · "
           "[r]Hay etapas con fallas[/]", size=12, anchor="m", color=INK)
    d.text(s, 0.6, 1.55, 4.3, 0.3, "Flujos de usuario (mock server)", size=12, bold=True)
    flows = [("FLOW-CAT-01", "busqueda.png", GREEN, "✓"), ("FLOW-PRE-01", "prestamo-registrado.png", GREEN, "✓"),
             ("FLOW-PRE-03", "limite-prestamos.png", RED, "✗")]
    for i, (fid, img, col, mark) in enumerate(flows):
        x = 0.6 + i * 1.42
        d.image(s, IMG / img, x, 1.9, w=1.32, alt=f"Captura de {fid}")
        d.text(s, x - 0.05, 2.75, 1.42, 0.26, f"{mark} {fid}", size=10, bold=True, color=col, align="c",
               font=k.FONT_CODE)
    d.text(s, 0.6, 3.1, 4.3, 0.3, "Seguridad y calidad", size=12, bold=True)
    d.text(s, 0.6, 3.42, 4.35, 1.55, [
        "[g]✓[/] gitleaks 0 · Trivy CRITICAL 0",
        "[g]✓[/] Lighthouse accesibilidad 100",
        "[g]✓[/] k6 p95 21.7 ms",
        "[r]✗[/] ZAP API scan: 1 alerta High",
    ], size=12, space_after=1)
    d.text(s, 5.15, 1.55, 4.3, 0.3, "Endpoints verificados (contrato)", size=12, bold=True)
    rows = [["Operación", "Status probados"],
            ["getHealth", "200"],
            ["listBooks", "200 · 400"],
            ["createBook", "201 · 400 · 409"],
            ["getBook", "200 · 400 · 404"],
            ["listLoans", "200 · 400"],
            ["createLoan", "201 · 400 · 404 · 409"],
            ["returnLoan", "200 · 400 · 404 · 409"]]
    d.table(s, 5.15, 1.9, 4.25, rows, [1.6, 2.65], row_h=0.34, header_fill="F0F3F6", header_color=INK)
    source(d, s, "Ejemplo generado por tools/evidence/build-comment.mjs con datos de prueba: "
           "docs/ejemplo-comentario-pr.md", y=5.05, w=9.1)
    d.notes(s, """
        Este es el comentario que deja el pipeline, resumido del ejemplo real que está en
        docs/ejemplo-comentario-pr.md, generado con datos de prueba. Arriba dice si hay etapas con fallas.
        A la izquierda, los flujos de usuario con sus capturas y el GIF del recorrido, cada uno con su ID:
        aquí FLOW-PRE-03 falló y el revisor ve la captura del error sin clonar nada. A la derecha, la tabla
        de endpoints con los status que efectivamente probó el contrato, que sale de contract-coverage.json.
        Abajo, el resumen de seguridad y calidad: en este ejemplo el API scan de ZAP encontró una alerta
        High, así que la etapa 9 falla y el PR no se puede integrar hasta resolverla. Pregunta para el curso:
        ¿qué miran primero si les toca revisar este PR?
    """)

    s = d.content("Chrome sin interfaz como testigo")
    d.text(s, 0.45, 1.05, 4.45, 1.45, [
        "En CI, Playwright lanza **Chromium headless**: el mismo motor de Chrome, sin ventana.",
        "Captura después de cada paso y video del flujo: el revisor ve lo que vería una persona.",
    ], size=12, bullets=True, space_after=4)
    d.text(s, 5.1, 1.05, 4.45, 1.45, [
        "El libro toma capturas en el teardown cuando un test falla en CI (p. 86).",
        "**Lighthouse** usa el mismo Chrome para medir rendimiento y accesibilidad (p. 270).",
    ], size=12, bullets=True, space_after=4)
    d.code(s, 0.45, 2.6, 9.1, 2.4, """
    // El ID del flujo viene del tag del escenario en el .feature (@FLOW-PRE-01).
    const flowId = testInfo.tags.find((tag) => tag.startsWith('@FLOW-'))?.slice(1) ?? 'SIN-ID'
    ...
        const name = `${flowId}-${counter}-${slug(stepTitle)}.png`
        const file = path.join(SCREENSHOTS_DIR, name)
        await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' })
...
// Una captura después de cada paso: la secuencia cuenta el flujo en el comentario del PR.
AfterStep(async ({ evidence, $step }) => {
  await evidence.capture($step.title)
})""", lang="ts", title="frontend/tests/e2e/fixtures.ts (extracto)")
    d.notes(s, """
        La inspiración viene del libro: en el capítulo 3, con Selenium, toma una captura en el teardown cada
        vez que un test falla en CI, porque es lo más útil para depurar. Nosotros vamos un paso más allá:
        una captura después de cada paso de Gherkin y video siempre, no solo al fallar, porque además
        sirven como evidencia para el revisor. El nombre de cada captura lleva el ID del flujo, que sale del
        tag del escenario. Todo corre en Chromium headless, que es Chrome sin ventana. Lighthouse usa el
        mismo motor para medir rendimiento y accesibilidad, y DevTools queda para la exploración manual.
    """)


# ============================================================================
# H. Actividad práctica y cierre
# ============================================================================
def part_h(d: Deck):
    d.section("7. Actividad práctica")
    s = d.divider("Parte 7", "Actividad: renovar un préstamo", "SPEC-LIB-03, de la spec al PR con evidencia, con un agente de IA.")
    d.notes(s, "Séptima parte: la actividad práctica. Se trabaja en parejas, con el repo clonado.")

    s = d.content("Paso a paso con SDD")
    steps = [
        ("Spec", "Escribe SPEC-LIB-03 con la plantilla de specs/templates.", TEAL, "10 min"),
        ("Contrato", "Agrega renewLoan al OpenAPI y regenera los tipos (api:generate).", AQUA, "10 min"),
        ("Verifica", "Spectral y oasdiff: ¿el cambio es compatible?", PLUM, "5 min"),
        ("Plan", "El agente propone casos (regla, capa, partición). Tú apruebas o podas.", ORANGE, "10 min"),
        ("Rojo", "Tests que fallan, capa por capa, uno a la vez.", RED, "20 min"),
        ("Verde", "Código mínimo hasta que pasen. spec-trace sin huérfanos.", GREEN, "20 min"),
        ("PR", "Abre el PR y lee la evidencia y el comentario del revisor IA.", BLUE, "15 min"),
    ]
    for i, (t, desc, col, tm) in enumerate(steps):
        y = 1.05 + i * 0.47
        d.circle_num(s, 0.45, y + 0.04, 0.36, i + 1, fill=col, size=13)
        d.text(s, 0.95, y, 1.2, 0.44, t, size=13, bold=True, color=col, anchor="m")
        d.text(s, 2.15, y, 6.3, 0.44, desc, size=12, anchor="m")
        d.chip(s, 8.6, y + 0.07, 0.95, 0.32, tm, fill=LIGHT, color=GRAY, size=12)
    d.card(s, 0.45, 4.42, 9.1, 0.6, fill=LIGHTBLUE)
    d.text(s, 0.6, 4.42, 8.8, 0.6, "Regla: **ningún paso se salta**. Si el agente escribe código antes de que "
           "apruebes el plan, se descarta y se vuelve al paso 4.", size=12, anchor="m")
    d.notes(s, """
        Siete pasos, más o menos 90 minutos. Primero escriben la spec con la plantilla de specs/templates,
        después cambian el contrato, regeneran los tipos del frontend y lo verifican con Spectral y oasdiff.
        Recién ahí le piden al agente un plan de tests, lo revisan y lo podan. Después rojo y verde, un test
        a la vez. Al final abren el PR y leen la evidencia. La regla más importante: si el agente se adelanta
        y escribe código sin plan aprobado, se descarta. El objetivo no es terminar rápido, es practicar el
        proceso.
    """)

    s = d.content("Borrador de SPEC-LIB-03: Renovar préstamo")
    d.code(s, 0.45, 1.08, 5.75, 3.9, """
# SPEC-LIB-03 · Renovar préstamo

## Reglas de negocio (borrador para completar)

- **RENEW-R1 · Extensión.** Renovar suma 7 días
  a `dueAt` (no a la hora actual) e incrementa
  `renewalCount` en 1.
- **RENEW-R2 · Una sola vez.** Con
  `renewalCount = 1` responde 409
  `RENEWAL_LIMIT_REACHED`.
- **RENEW-R3 · Solo al día.** ¿Vencido?
  ¿Devuelto? ¿Justo en `dueAt`? (completa)
- **RENEW-R4 · Inexistente.** ¿404? ¿400?
  (completa)

## Fuera de alcance
Reservas y listas de espera.""", lang="md", title="Borrador para partir")
    bullet_card(d, s, 6.4, 1.08, 3.15, 3.9, "Lo que la spec debe resolver", [
        "¿Se puede renovar justo en dueAt? Es el valor límite de LOAN-R6.",
        "¿Qué responde un préstamo vencido o devuelto?",
        "¿Los códigos nuevos entran al enum ErrorCode?",
        "¿Cómo se ve en la UI? Escribe el flujo en Gherkin.",
    ], space_after=6)
    d.notes(s, """
        Este es un borrador para partir: RENEW-R1 y R2 vienen escritas, R3 y R4 las completan ustedes. Lo
        interesante son las preguntas de la derecha. ¿Qué pasa justo en el instante del vencimiento? Esa es
        una partición de valor límite que conecta con LOAN-R6. ¿Qué responde un préstamo vencido o uno ya
        devuelto? Los nuevos códigos de error obligan a cambiar el enum ErrorCode del contrato, y oasdiff
        les va a decir si ese cambio rompe a los clientes. Y el flujo de UI se escribe en Gherkin, así el
        test E2E sale solo. La versión final de esta spec está en el PR de ejemplo, que vemos al cerrar.
    """)

    s = d.content("El prompt para el agente y el checklist del PR")
    d.code(s, 0.45, 1.08, 5.6, 3.0, """
Lee specs/constitution.md, specs/architecture.md
y specs/features/SPEC-LIB-03-renovacion.md.

1. No escribas código todavía. Propón la lista
   de tests como tabla: regla, capa, partición o
   valor límite y archivo. Máximo 6 por regla y
   capa. Ningún caso repetido entre capas.
2. Espera mi aprobación.
3. Escribe un test a la vez. Muéstrame que falla
   por la razón correcta y recién ahí implementa.
4. Antes de terminar corre spec:trace y los
   scripts lint, typecheck y test:* de la app.""", lang="txt", title="Prompt (Claude Code, Copilot o Cursor)")
    d.card(s, 0.45, 4.2, 5.6, 0.8, fill=PINKBG)
    d.text(s, 0.6, 4.2, 5.35, 0.8, "Si el plan trae más de 6 casos para una regla o casos repetidos entre "
           "capas, **recházalo** y pide que justifique cada caso.", size=12, anchor="m")
    checks = [
        "Spec y OpenAPI en el mismo PR",
        "Spectral y oasdiff en verde",
        "Cada test con [RENEW-Rx]",
        "Ningún mock sin justificación",
        "GIF del flujo de renovación",
        "Seguridad sin hallazgos nuevos",
        "Rama de menos de 2 días",
    ]
    d.text(s, 6.25, 1.05, 3.3, 0.3, "Checklist del PR", size=13, bold=True, color=TEAL)
    for i, c in enumerate(checks):
        y = 1.45 + i * 0.5
        d.box(s, 6.25, y + 0.07, 0.28, 0.28, "", fill=WHITE, line=TEAL, line_w=1.5, radius=0.04)
        d.text(s, 6.65, y, 2.9, 0.42, c, size=12, anchor="m")
    d.notes(s, """
        El prompt es corto a propósito: el libro advierte que las instrucciones muy largas se ignoran
        (p. 96). Lo importante ya está en la constitución y en CLAUDE.md, el prompt solo apunta a los
        archivos y fija el orden de trabajo. A la derecha está el checklist que revisa la pareja antes de
        pedir revisión, que es un resumen de la plantilla de PR del repo (.github/pull_request_template.md).
        Si todo está bien, el comentario de evidencia debería mostrar el nuevo flujo de renovación con su GIF
        y la tabla de endpoints con renewLoan.
    """)

    s = d.content("El PR de ejemplo: feat/renovar-prestamo")
    phases = [
        ("1 · Spec y contrato", TEAL, PR_COMMITS["spec"],
         "Reglas RENEW-R1 a R4, renewLoan en el OpenAPI y el flujo FLOW-PRE-04."),
        ("2 · Rojo", RED, PR_COMMITS["red"],
         "Tests que citan RENEW-Rx y UI-RENEW-x. Fallan: todavía no hay código."),
        ("3 · Verde", GREEN, PR_COMMITS["green"],
         "El código mínimo para que pasen. spec-trace sin huérfanos."),
    ]
    y = 1.05
    for label, col, commits, txt in phases:
        h = 0.3 + 0.2 * len(commits) + 0.28
        d.card(s, 0.45, y, 9.1, h, fill=LIGHT)
        d.box(s, 0.45, y, 1.75, h, label, fill=col, size=12, margin=0.05)
        d.text(s, 2.35, y + 0.05, 7.1, 0.2 * len(commits) + 0.08, commits, size=10, font=k.FONT_CODE,
               color=INK, space_after=0, check=False)
        d.text(s, 2.35, y + 0.13 + 0.2 * len(commits), 7.1, 0.34, txt, size=12)
        y += h + 0.1
    d.text(s, 0.45, y + 0.02, 9.1, 0.3, "Lo que publica el pipeline en el PR", size=13, bold=True, color=TEAL)
    evid = [("GIF de FLOW-PRE-04", AQUA), ("renewLoan en endpoints", GREEN),
            ("RENEW-R1 a R4 trazadas", TEAL), ("oasdiff y seguridad", RED)]
    for i, (t, col) in enumerate(evid):
        x = 0.45 + i * 2.3
        d.box(s, x, y + 0.36, 2.2, 0.56, t, fill=col, size=12, margin=0.04)
    d.text(s, 0.45, y + 0.98, 9.1, 0.3, f"Se abre en {PULLS_URL}", size=12, bold=True, color=TEAL, align="c")
    d.notes(s, """
        Este es el PR de ejemplo del repo, en la rama feat/renovar-prestamo, y resuelve la misma actividad
        que acaban de hacer. Léanlo commit por commit, porque el orden es el mensaje. Primero la spec y el
        contrato: SPEC-LIB-03 con las reglas RENEW-R1 a R4, la operación renewLoan y el campo renewalCount
        en el OpenAPI, y el flujo FLOW-PRE-04 en Gherkin, sin una línea de código. Después los tests en
        rojo, en el frontend y en el backend: citan los IDs de la spec y fallan porque todavía no hay
        implementación. Recién después la implementación, el verde. Fíjense que en cada commit el pipeline
        cuenta una historia distinta: en el commit de spec oasdiff revisa que el contrato siga siendo
        compatible, en el rojo los tests fallan por la razón correcta y en el verde todo pasa. Al final el
        comentario del PR muestra el GIF de FLOW-PRE-04, la fila nueva de renewLoan en la tabla de
        endpoints, las reglas RENEW en spec-trace y el resumen de seguridad. El PR está en la pestaña Pull
        requests del repositorio.
    """)

    d.section("Cierre")
    s = d.content("Conclusiones")
    takeaways = [
        ("La spec es el prompt", "Reglas con ID, contrato y flujos guían a personas y agentes.", TEAL),
        ("Capa más baja posible", "Cada test vive donde detecta el defecto. Sin cupcake.", GREEN),
        ("La IA propone, tú decides", "Plan primero, un test a la vez, revisor como juez.", ORANGE),
        ("Mide lo que importa", "Trazabilidad y mutación, no cantidad de tests ni cobertura.", PLUM),
        ("Seguridad y evidencia en cada PR", "DevSecOps es parte del flujo, no una etapa final.", RED),
    ]
    for i, (t, desc, col) in enumerate(takeaways):
        y = 1.15 + i * 0.76
        d.circle_num(s, 0.7, y + 0.04, 0.5, i + 1, fill=col, size=14)
        d.text(s, 1.4, y, 3.6, 0.58, t, size=14, bold=True, color=col, anchor="m")
        d.text(s, 5.05, y, 4.5, 0.58, desc, size=13, anchor="m")
    d.notes(s, """
        Cinco ideas para llevarse. Uno: si la IA escribe el código, la spec es lo que de verdad programas.
        Dos: cada test en la capa más baja que detecta el defecto. Tres: la IA propone y tú decides, con un
        plan aprobado y un test a la vez. Cuatro: mide con trazabilidad y mutación, no con cantidad de tests
        ni porcentaje de cobertura. Cinco: la seguridad y la evidencia son parte de cada PR.
    """)

    s = d.content("Para discutir")
    qs = [
        "¿Qué test de tu proyecto borrarías mañana? ¿Por qué nadie lo extrañaría?",
        "Si un agente te entrega 50 tests en un PR, ¿con qué criterio aceptas cada uno?",
        "Si el pipeline tuviera que tardar 5 minutos, ¿qué etapas moverías a nightly?",
        "¿Git Flow o trunk based para el proyecto del curso? Argumenta con métricas DORA.",
    ]
    for i, q in enumerate(qs):
        x = 0.45 + (i % 2) * 4.6
        y = 1.15 + (i // 2) * 1.9
        d.card(s, x, y, 4.45, 1.7, fill=LIGHT)
        d.text(s, x + 0.2, y + 0.1, 0.6, 0.6, "?", size=28, bold=True, color=BLUE, font=k.FONT_TITLE)
        d.text(s, x + 0.8, y + 0.15, 3.5, 1.4, q, size=14, anchor="m")
    d.notes(s, """
        Preguntas para cerrar en plenario. La primera obliga a pensar en el valor de cada test. La segunda
        es la situación real que van a vivir con agentes. La tercera obliga a priorizar etapas del pipeline.
        La cuarta conecta con su proyecto del curso. No hay una respuesta correcta, lo importante es que
        argumenten con lo visto en clase.
    """)

    s = d.content("Referencias")
    d.text(s, 0.45, 1.05, 4.5, 3.6, [
        "**Libro base.** G. Mohan, Full Stack Testing, 2.ª ed., O'Reilly, 2026.",
        "**DORA.** State of AI-assisted Software Development, 2025.",
        "**Meta.** Alshahwan et al., TestGen-LLM, FSE 2024.",
        "**Meta.** Mutation-Guided LLM-based Test Generation (ACH), 2025.",
        "**Google.** Petrović et al., State of Mutation Testing at Google, ICSE SEIP 2018.",
        "**Google Research.** Resolving code review comments with ML, 2023.",
    ], size=12, bullets=True, space_after=4)
    d.text(s, 5.15, 1.05, 4.4, 3.6, [
        "**SDD.** GitHub Spec Kit, AWS Kiro, Tessl.",
        "**Contrato.** OpenAPI 3.1, Spectral, oasdiff, openapi-typescript, Schemathesis, Pact.",
        "**Pruebas.** Jest, Vitest, Testing Library, MSW, Playwright, playwright-bdd, Testcontainers, "
        "supertest, axe-core, Lighthouse, k6, Stryker, dependency-cruiser.",
        "**Seguridad.** gitleaks, Semgrep, CodeQL, Trivy, hadolint, actionlint, zizmor, OWASP ZAP, CycloneDX.",
    ], size=12, bullets=True, space_after=4)
    d.text(s, 0.45, 4.68, 9.1, 0.32, f"Repo: {REPO_URL}", size=13, bold=True, color=TEAL, align="c")
    d.notes(s, """
        Referencias de la clase. El libro base es la segunda edición de Full Stack Testing. Los papers de Meta
        y Google son lectura recomendada para quien quiera profundizar en generación de tests con LLM y
        mutation testing a escala. Todas las herramientas del proyecto son open source y están configuradas
        en el repo.
    """)


# Commits del PR de ejemplo (rama feat/renovar-prestamo), en el orden en que se hicieron.
PR_COMMITS = {
    "spec": ["docs(specs): SPEC-LIB-03 renovar préstamo (contrato y flujo primero)"],
    "red": ["test(frontend): renovar préstamo en Mis préstamos y mock server (fallan: SDD rojo)",
            "test(backend): renovar préstamo RENEW-R1 a RENEW-R4 (fallan: SDD rojo)"],
    "green": ["feat(frontend): renovar préstamo desde Mis préstamos (SPEC-LIB-03)",
              "feat(backend): renovar préstamo en todas las capas (SPEC-LIB-03)"],
}


# ============================================================================
# Validación de estilo y salida
# ============================================================================
FORBIDDEN = {"—": "guion largo", "–": "guion medio", ";": "punto y coma"}
VOSEO = re.compile(r"\b(usá|tenés|podés|sabés|querés|mirá|hacé|fijate|decí|vení|andá|probá|escribí|corré|"
                   r"agregá|elegí|leé|pensá|contá|revisá)\b", re.IGNORECASE)


def _frames(slide):
    """Text frames de una diapositiva con el nombre de su forma (las celdas de tabla se llaman "table")."""
    for shape in slide.shapes:
        if shape.has_text_frame:
            yield shape.name, shape.text_frame
        if getattr(shape, "has_table", False) and shape.has_table:
            for row in shape.table.rows:
                for cell in row.cells:
                    yield "table", cell.text_frame


def validate_text(prs) -> list[str]:
    problems = []
    for i, slide in enumerate(prs.slides, 1):
        texts = [tf.text for _, tf in _frames(slide)]
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame.text.strip():
            texts.append(slide.notes_slide.notes_text_frame.text)
        else:
            problems.append(f"Diapositiva {i}: sin notas del orador")
        for t in texts:
            for ch, name in FORBIDDEN.items():
                if ch in t:
                    problems.append(f"Diapositiva {i}: {name} en {t[:60]!r}")
            m = VOSEO.search(t)
            if m:
                problems.append(f"Diapositiva {i}: voseo '{m.group(0)}' en {t[:60]!r}")
    return problems


def check_sizes(prs) -> list[str]:
    """Tamaños mínimos para proyectar: 12 pt en cuerpo, 10 pt en código y en notas al margen."""
    problems = []
    for i, slide in enumerate(prs.slides, 1):
        for name, tf in _frames(slide):
            for p in tf.paragraphs:
                for r in p.runs:
                    if not r.text.strip() or r.font.size is None:
                        continue
                    pt = r.font.size.pt
                    if r.font.name == k.FONT_CODE:
                        minimum = k.MIN_CODE
                    elif name.startswith("caption"):
                        minimum = k.MIN_CAPTION
                    else:
                        minimum = k.MIN_BODY
                    if pt < minimum:
                        problems.append(f"Diapositiva {i}: {pt:g} pt (mínimo {minimum}) en {r.text[:50]!r}")
    return problems


def build(base: Path = BASE, out: Path = OUT) -> Path:
    d = Deck(str(base))
    for part in (part_a, part_b, part_c, part_d, part_e, part_f, part_g, part_h):
        part(d)
    k.add_sections(d.prs, d.sections)
    problems = validate_text(d.prs) + check_sizes(d.prs)
    if problems:
        print("\n".join(problems))
        sys.exit("El deck no cumple las reglas de estilo o de tamaño (ver arriba).")
    d.prs.core_properties.title = "Full Stack Testing moderno con IA y DevSecOps"
    d.prs.core_properties.author = "IIC3143 Desarrollo de Software"
    d.prs.core_properties.language = "es-CL"
    d.prs.save(str(out))
    for w in k.WARNINGS:
        print("AVISO:", w)
    print(f"{out.name}: {len(d.prs.slides)} diapositivas, {d.notes_count} con notas, "
          f"{out.stat().st_size / 1024:.0f} KB")
    return out


def render(pptx: Path, outdir: Path, fonts: Path | None = None) -> None:
    """Convierte a PDF con LibreOffice y a PNG con pdftoppm (para revisión visual).

    Si se pasa `fonts`, esas fuentes (Bitter, Inter y una monoespaciada con nombre Consolas) se cargan en
    un perfil temporal de LibreOffice para que el render use métricas parecidas a las de PowerPoint.
    Sin ellas LibreOffice sustituye las fuentes y el render es solo aproximado.
    """
    outdir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="lo_profile_") as prof:
        user = Path(prof) / "user"
        (user / "fonts").mkdir(parents=True)
        if fonts:
            for f in fonts.glob("*.ttf"):
                shutil.copy(f, user / "fonts" / f.name)
        subprocess.run(["soffice", f"-env:UserInstallation=file://{prof}", "--headless", "--convert-to", "pdf",
                        "--outdir", str(outdir), str(pptx)], check=True, capture_output=True, timeout=600)
    pdf = outdir / (pptx.stem + ".pdf")
    for old in outdir.glob("slide-*.png"):
        old.unlink()
    subprocess.run(["pdftoppm", "-png", "-r", "110", str(pdf), str(outdir / "slide")], check=True)
    print(f"Render: {pdf} y {len(list(outdir.glob('slide-*.png')))} PNG en {outdir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", type=Path, help="Regenera la plantilla base desde 04-Testing.pptx")
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--render", type=Path, help="Carpeta donde dejar el PDF y los PNG de revisión")
    ap.add_argument("--fonts", type=Path, help="Carpeta con TTF de Bitter e Inter para un render fiel")
    args = ap.parse_args()
    if args.base:
        from base_template import build_base

        build_base(args.base, BASE)
    out = build(BASE, args.out)
    if args.render:
        render(out, args.render, args.fonts)
