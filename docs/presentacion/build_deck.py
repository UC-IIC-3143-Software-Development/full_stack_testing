"""Genera la presentación de la clase práctica.

    python build_deck.py                      # escribe Full-Stack-Testing-IA-DevSecOps.pptx
    python build_deck.py --render /tmp/png    # además la convierte a PDF y PNG para revisarla
    python build_deck.py --base "/ruta/04-Testing.pptx"   # regenera la plantilla base

La plantilla base (plantilla/base-curso.pptx) sale de 04-Testing.pptx del profesor con
base_template.py: misma portada, mismo master y mismas fuentes, sin sus diapositivas.
Todos los diagramas son formas nativas editables.
"""

from __future__ import annotations

import argparse
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

# Colores por tipo de etapa del pipeline (se repiten en todo el deck)
C_SEC = RED
C_QUAL = TEAL
C_TEST = GREEN
C_BUILD = ORANGE
C_EVID = PLUM


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
    sub.top = k.Inches(3.5)
    sub.height = k.Inches(0.7)
    k.replace_text(sub.text_frame, ["Clase práctica · IIC3143 Desarrollo de Software",
                                    "Gonzalo Martínez · gonzalo.martinez@uc.cl"], size=11)
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
    w, h, gap = 2.15, 1.55, 0.2
    for i, (t, sub_t, col) in enumerate(items):
        x = 0.45 + (i % 4) * (w + gap)
        y = 1.45 + (i // 4) * (h + 0.3)
        d.card(s, x, y, w, h, fill=LIGHT)
        d.circle_num(s, x + 0.15, y + 0.17, 0.42, i + 1, fill=col, size=13)
        d.text(s, x + 0.15, y + 0.66, w - 0.3, 0.44, t, size=12, bold=True, color=INK, anchor="b")
        d.text(s, x + 0.15, y + 1.12, w - 0.3, 0.38, sub_t, size=10, color=GRAY)
    d.notes(s, """
        Siete partes y un cierre. Las partes 1 y 2 son el marco: por qué la IA cambia la forma de testear y
        cómo Spec Driven Development pone orden. Las partes 3 y 4 son el proyecto y cada tipo de prueba con
        su código. La parte 5 es DevSecOps y el pipeline, la 6 es la evidencia que queda en cada PR y la 7
        es la actividad práctica donde ustedes implementan una feature nueva con un agente de IA.
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
        ("70 a 80", "casos de prueba", "entregó Claude para la página de inicio de Amazon. Muchos duplicados, "
         "superficiales y con lógica de negocio inventada.", "p. 37", PINK),
        ("30", "tests REST Assured", "generó Claude Code desde un OpenAPI. Las validaciones de entrada que "
         "incluyó pertenecen a la capa unit, no a la API.", "p. 102", ORANGE),
        ("en lote", "sin capa", "Las herramientas de IA tienden a generar tests en lote que no pertenecen a "
         "ninguna capa en particular.", "p. 118", TEAL),
    ]
    for i, (big, label, txt, page, col) in enumerate(stats):
        x = 0.45 + i * 3.1
        d.card(s, x, 1.2, 2.9, 2.75, fill=LIGHT)
        d.text(s, x + 0.2, 1.3, 2.5, 0.75, big, size=34, bold=True, color=col, font=k.FONT_TITLE)
        d.text(s, x + 0.2, 2.02, 2.5, 0.3, label, size=11, bold=True, color=INK)
        d.text(s, x + 0.2, 2.36, 2.5, 1.2, txt, size=10.5, color=INK)
        d.text(s, x + 0.2, 3.58, 2.5, 0.28, f"Full Stack Testing, {page}", size=9, color=MUTED)
    d.text(s, 0.45, 4.15, 9.1, 0.8, [
        "“Successful AI adoption is a **systems problem, not a tools problem**.”",
        "DORA, State of AI-assisted Software Development 2025 (citado en el libro, p. 15)",
    ], size=12, align="c", color=INK, space_after=2)
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
        ["Integración", "Micro", "Integración entre dos componentes", "Mínimo a moderado", "Rápido"],
        ["Contrato", "Micro", "El contrato entre dos servicios que se integran", "Moderado", "Medio"],
        ["Servicio", "Macro", "La funcionalidad en la capa de API", "Moderado", "Medio"],
        ["UI", "Macro", "Un recorrido del usuario en la web", "Moderado", "Lento"],
        ["End to end", "Macro", "El recorrido completo, con sistemas downstream", "Máximo", "Lento"],
    ]
    d.table(s, 0.45, 1.2, 6.0, rows, [1.2, 0.8, 3.0, 1.4, 0.8], row_h=0.5, size=10.5, first_col_bold=True)
    d.card(s, 6.75, 1.2, 2.8, 3.5, fill=LIGHTBLUE)
    d.text(s, 6.95, 1.32, 2.4, 0.3, "Antes de un test de UI", size=11.5, bold=True, color=TEAL)
    d.text(s, 6.95, 1.75, 2.4, 2.4, [
        "¿Cuál es el propósito de este test?",
        "¿Podría lograr lo mismo con un test micro, más abajo?",
        "Si la respuesta es sí, el test baja de capa. Esa pregunta también se le hace a la IA.",
    ], size=11, bullets=True, space_after=8)
    d.text(s, 6.95, 4.25, 2.4, 0.3, "Libro, p. 71 y 72", size=9, color=MUTED)
    d.notes(s, """
        La tabla 3-1 del libro ordena los tipos de test por alcance. Micro: unit, integración y contrato.
        Macro: servicio, UI y end to end. A medida que sube el alcance sube el esfuerzo y el tiempo. El
        recuadro de la derecha es la pregunta que el libro recomienda hacerse cada vez que alguien, persona
        o agente, quiere agregar un test de UI.
    """)

    s = d.content("La pirámide: 10x : 5x : x")
    # Una sola pendiente para las tres capas: cada capa es un tramo del mismo triángulo.
    layers = [("UI", "x", ORANGE), ("Servicio y contrato", "5x", AQUA), ("Unit e integración", "10x", GREEN)]
    cx, top_y, lh, gap, base_w = 2.55, 1.25, 1.05, 0.06, 4.2
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
            d.text(s, cx - 1.2, y + 0.12, 2.4, 0.4, mult, size=18, bold=True, color=WHITE, align="c")
            d.text(s, cx - 1.4, y + 0.55, 2.8, 0.4, name, size=11, bold=True, color=WHITE, align="c")
    d.text(s, cx - 1.6, top_y + total_h + 0.12, 3.2, 0.3, "Mike Cohn, citado en el libro, p. 72", size=9,
           color=MUTED, align="c")
    # antes y después
    d.card(s, 5.1, 1.25, 4.45, 1.45, fill=LIGHT)
    d.text(s, 5.3, 1.33, 4.0, 0.3, "Antes", size=11, bold=True, color=RED)
    d.text(s, 5.3, 1.65, 4.0, 1.0, "**200+ tests de UI** que tardaban **8 horas** y fallaban al final por "
           "componentes dependientes o infraestructura.", size=11.5)
    d.card(s, 5.1, 2.95, 4.45, 1.45, fill=LIGHT)
    d.text(s, 5.3, 3.03, 4.0, 0.3, "Después de adoptar la pirámide", size=11, bold=True, color=GREEN)
    d.text(s, 5.3, 3.35, 4.0, 1.0, "**470 tests** micro y macro con feedback en **35 minutos**.", size=11.5)
    d.text(s, 5.1, 4.5, 4.45, 0.3, "Libro, p. 66 y 73", size=9, color=MUTED)
    d.notes(s, """
        La pirámide de Mike Cohn: por cada x tests de UI, unos 5x de servicio y 10x de unit e integración.
        No es una regla matemática, es una guía de costo: más arriba, más lento y más caro de mantener. El
        caso del libro es muy concreto: un equipo pasó de más de 200 tests de UI que tardaban 8 horas a 470
        tests en total con feedback en 35 minutos. Tener más tests no fue el problema, el problema era
        dónde estaban.
    """)

    s = d.content("Antipatrones: cono de helado y cupcake")
    # pirámide ideal pequeña
    def mini_pyramid(x0, y0):
        d.box(s, x0 + 0.55, y0, 0.7, 0.55, "", fill=ORANGE, shape="triangle")
        t = d.box(s, x0 + 0.25, y0 + 0.58, 1.3, 0.55, "", fill=AQUA, shape="trapezoid")
        t.adjustments[0] = 0.5
        t = d.box(s, x0, y0 + 1.16, 1.8, 0.55, "", fill=GREEN, shape="trapezoid")
        t.adjustments[0] = 0.4

    # cono de helado
    def cone(x0, y0):
        d.box(s, x0 + 0.2, y0, 1.6, 0.75, "Manual", fill="F4B6C2", color=INK, size=10, shape="oval")
        d.box(s, x0, y0 + 0.62, 2.0, 0.38, "UI", fill=ORANGE, size=10, shape="rect")
        d.box(s, x0 + 0.3, y0 + 1.02, 1.4, 0.34, "Servicio", fill=AQUA, size=9.5, shape="rect")
        tri = d.box(s, x0 + 0.6, y0 + 1.38, 0.8, 0.5, "", fill=GREEN, shape="triangle")
        tri.rotation = 180
        d.text(s, x0 + 0.5, y0 + 1.4, 1.0, 0.3, "Unit", size=9, color=WHITE, bold=True, align="c")

    def cupcake(x0, y0):
        d.box(s, x0 + 0.15, y0, 1.7, 0.6, "Manual", fill="F4B6C2", color=INK, size=10, shape="oval")
        d.box(s, x0, y0 + 0.5, 2.0, 0.4, "UI (duplica abajo)", fill=ORANGE, size=9.5, shape="rect")
        d.box(s, x0 + 0.05, y0 + 0.92, 1.9, 0.4, "Servicio (duplica)", fill=AQUA, size=9.5, shape="rect")
        t = d.box(s, x0 + 0.1, y0 + 1.34, 1.8, 0.5, "", fill=GREEN, shape="trapezoid")
        t.rotation = 180
        d.text(s, x0 + 0.5, y0 + 1.42, 1.0, 0.3, "Unit", size=9.5, color=WHITE, bold=True, align="c")

    cols = [(0.45, "Lo ideal", GREEN), (3.55, "Cono de helado", RED), (6.65, "Cupcake", RED)]
    for x, label, col in cols:
        d.text(s, x, 1.15, 2.9, 0.3, label, size=13, bold=True, color=col, align="c")
    mini_pyramid(1.0, 1.6)
    cone(4.0, 1.55)
    cupcake(7.1, 1.55)
    d.text(s, 0.45, 3.55, 2.9, 1.3, [
        "Base ancha de tests micro",
        "Pocos tests macro que recorren flujos",
        "Cada test en una sola capa",
    ], size=10.5, bullets=True)
    d.text(s, 3.55, 3.55, 2.9, 1.3, [
        "Muchos tests de UI, pocos micro",
        "Feedback lento, defectos tarde",
        "Pruebas manuales aunque hay automatización",
    ], size=10.5, bullets=True)
    d.text(s, 6.65, 3.55, 2.9, 1.3, [
        "El mismo caso probado en unit, API y UI",
        "Releases lentos, culpas cruzadas",
        "La IA lo agrava al generar en lote",
    ], size=10.5, bullets=True)
    d.text(s, 0.45, 4.75, 9.1, 0.28, "Libro, p. 114 a 116", size=9, color=MUTED, align="c")
    d.notes(s, """
        Los dos antipatrones del libro. Cono de helado: la pirámide invertida, muchos tests de UI y pocos
        micro. Síntomas: esperas largas, defectos en la etapa de release y pruebas manuales aunque haya
        automatización. Cupcake: el mismo caso se prueba en todas las capas, por ejemplo los logins
        inválidos en unit y otra vez en UI. El libro dice explícitamente que usar IA para subir la
        cobertura rápido aumenta la probabilidad del cupcake. La solución que propone: acordar en el
        kickoff de cada historia qué tests van en cada capa y dejarlo escrito. En este proyecto eso queda
        escrito en la spec.
    """)

    s = d.content("El mito del 100 por ciento")
    d.card(s, 0.45, 1.2, 4.3, 1.75, fill=LIGHT)
    d.text(s, 0.65, 1.28, 3.9, 0.3, "Cobertura de código", size=12, bold=True, color=TEAL)
    d.text(s, 0.65, 1.62, 3.9, 1.3, [
        "Dice qué líneas **no** ejecutó ningún test",
        "No dice si los tests verifican algo",
        "Puede ser alta aunque un módulo tenga cero tests",
    ], size=10.5, bullets=True)
    d.card(s, 0.45, 3.1, 4.3, 1.75, fill=LIGHT)
    d.text(s, 0.65, 3.18, 3.9, 0.3, "Mutation testing", size=12, bold=True, color=GREEN)
    d.text(s, 0.65, 3.52, 3.9, 1.3, [
        "Cambia el código (crea un mutante) y corre los tests",
        "Si algún test falla, el mutante muere. Si no, sobrevive",
        "Muy efectivo pero lento: úsalo con criterio (p. 116)",
    ], size=10.5, bullets=True)
    d.code(s, 5.0, 1.2, 4.55, 2.35, """
// producción: LOAN-R2, máximo 3 no devueltos
if (pending.length >= MAX_UNRETURNED_LOANS) {
  throw new LoanLimitReachedError(/* ... */)
}

// mutante que crea Stryker: >= pasa a >
if (pending.length > MAX_UNRETURNED_LOANS) {
  throw new LoanLimitReachedError(/* ... */)
}""", title="backend/src/loans/domain/loan-policy.ts")
    d.card(s, 5.0, 3.7, 4.55, 1.15, fill="FCE8EC")
    d.text(s, 5.15, 3.76, 4.25, 1.05, [
        "Si ningún test usa **exactamente 3** préstamos, el mutante sobrevive con 100 por ciento de "
        "cobertura. En el repo lo mata el test del **valor límite**: [LOAN-R2] rechaza el cuarto préstamo.",
    ], size=10.5, color=INK)
    d.notes(s, """
        Cobertura de código y mutation testing no miden lo mismo. La cobertura solo dice qué líneas nunca
        se ejecutaron. El libro advierte que incluso con 100 por ciento de cobertura de automatización
        aparecen bugs, y que el porcentaje puede ser alto aunque un módulo entero no tenga tests. Mutation
        testing responde otra pregunta: si meto un bug, ¿algún test lo detecta? El ejemplo es real del
        proyecto: si cambio mayor o igual por mayor en el límite de préstamos y nadie prueba el caso de 3
        préstamos exactos, el mutante sobrevive. Es la forma más honesta de evaluar una suite generada por
        IA.
    """)

    s = d.content("7 reglas para que la IA no infle la suite")
    rules = [
        ("La capa más baja posible", "Validaciones de campos en unit, no en API ni UI", "Revisión y revisor IA"),
        ("Una partición, un test", "Particiones y valores límite, máximo 6 por regla y capa", "tools/spec-trace.mjs"),
        ("Sin mocks por defecto", "Objetos reales o fakes en memoria y reloj fijo", "ESLint (vi.fn, jest.mock)"),
        ("Oráculos explícitos", "El valor esperado se escribe literal", "Revisión y revisor IA"),
        ("Independencia", "Cada test prepara su propio estado", "Tests en paralelo"),
        ("Nada débil ni frágil", "Sin toBeTruthy, sin waitForTimeout, sin duplicar capas", "ESLint y spec-trace"),
        ("La IA propone, tú apruebas", "Lista de casos primero, después un test a la vez", "CLAUDE.md y AGENTS.md"),
    ]
    rows = [["#", "Regla (constitución P4)", "Qué significa", "Quién la hace cumplir"]]
    for i, (r, m, who) in enumerate(rules, 1):
        rows.append([str(i), f"**{r}**", m, who])
    d.table(s, 0.45, 1.15, 9.1, rows, [0.35, 2.3, 4.0, 2.2], row_h=0.44, size=10.5,
            align=["c", "l", "l", "l"])
    d.text(s, 0.45, 4.8, 9.1, 0.28, "Basadas en el libro: p. 71, 90, 94, 96, 102 y 107", size=9, color=MUTED,
           align="c")
    d.notes(s, """
        Estas son las 7 reglas de la constitución del proyecto, el archivo specs/constitution.md, principio
        P4. Salen del libro: la capa más baja posible (p. 71 y 102), una conducta por test y tests
        independientes (p. 107), no duplicar tests (instrucciones de Copilot, p. 90), generar un test a la
        vez (p. 94) y el flujo de dos pasos donde la persona elige qué casos automatizar en cada capa
        (p. 96). La última columna es lo importante: una regla que nadie verifica es una sugerencia. Por eso
        cada regla tiene un mecanismo, desde un script en CI hasta el revisor de IA.
    """)

    s = d.content("Las reglas también son código: tres barandas")
    layers = [
        ("1. Instrucciones", "CLAUDE.md, AGENTS.md y la constitución. El agente las lee antes de escribir.",
         "Guía, no garantiza", AQUA),
        ("2. Linter", "ESLint y Semgrep fallan en segundos si aparece un mock, una espera fija o un test sin ID.",
         "Falla al escribir", ORANGE),
        ("3. CI", "spec-trace (huérfanos y presupuesto), mutación, revisor IA y evidencia en el PR.",
         "Falla el PR", RED),
    ]
    for i, (t, desc, tag, col) in enumerate(layers):
        y = 1.2 + i * 1.22
        d.box(s, 0.45, y, 1.75, 1.05, t, fill=col, size=12)
        d.text(s, 2.32, y + 0.05, 2.45, 0.7, desc, size=10, color=INK)
        d.text(s, 2.32, y + 0.74, 2.45, 0.28, tag, size=9.5, bold=True, color=col)
    d.code(s, 4.95, 1.2, 4.6, 3.67, """
// La política de tests (P4) también la verifica el linter:
// un agente no puede colar mocks, esperas fijas ni tests
// sin ID de regla.
const testPolicy = {
  'no-restricted-syntax': ['error', {
    selector: `CallExpression[callee.name=/^(it|test)$/]
      > Literal:first-child[value!=${TITLE_WITH_RULE_ID}]`,
    message: 'P1.4: el título del test debe empezar con '
      + 'el ID de la regla, por ejemplo "[LOAN-R2] ..."',
  }],
  'no-restricted-properties': ['error',
    { object: 'vi', property: 'fn',
      message: 'P4.3: usa objetos reales o fakes.' },
    { property: 'toBeTruthy',
      message: 'P4.6: aserción débil.' },
    { property: 'waitForTimeout',
      message: 'P4.6: nada de esperas fijas.' },
  ],
}""", lang="js", title="frontend/eslint.config.mjs (extracto)")
    d.notes(s, """
        Las reglas se hacen cumplir en tres niveles. Primero las instrucciones: CLAUDE.md, AGENTS.md y la
        constitución, que el agente lee antes de escribir. Ayudan, pero un agente puede ignorarlas. Segundo
        el linter: el ESLint del frontend prohíbe vi.fn, toBeTruthy y waitForTimeout, y exige que cada título
        de test empiece con un ID de regla. Esto falla en segundos, en el editor o en el hook. Semgrep hace
        lo mismo con reglas de arquitectura. Tercero el CI: spec-trace, mutación y el revisor de IA fallan el
        PR. Mientras más abajo en esta lista, más difícil es saltarse la regla.
    """)

    s = d.content("Qué hace la industria con IA y tests")
    cards = [
        ("Meta · TestGen-LLM", "FSE 2024",
         "Un LLM propone tests que mejoran los existentes. Cada test pasa filtros: **compila**, **pasa de forma "
         "confiable** y **aumenta la cobertura**. Solo una fracción llega a revisión humana.",
         "Filtra antes de mostrar.", TEAL),
        ("Meta · ACH", "2025",
         "Generación guiada por mutantes: el LLM crea un bug plausible y luego un test que lo mata.",
         "El objetivo es detectar fallas, no sumar tests.", ORANGE),
        ("Google · mutación en code review", "ICSE SEIP 2018, Petrović et al.",
         "Mutation testing **solo sobre las líneas cambiadas** del PR, con mutantes filtrados para que sean "
         "útiles al revisor.", "Mutación incremental, no la suite completa.", GREEN),
        ("Google Research · code review con ML", "2023",
         "Un modelo propone cómo resolver los comentarios de revisión y la persona acepta o descarta.",
         "La IA sugiere, la persona decide.", PLUM),
    ]
    for i, (name, ref, txt, lesson, col) in enumerate(cards):
        x = 0.45 + (i % 2) * 4.6
        y = 1.15 + (i // 2) * 1.9
        d.card(s, x, y, 4.45, 1.75, fill=LIGHT)
        d.box(s, x + 0.15, y + 0.14, 2.9, 0.32, name, fill=col, size=10, align="l", margin=0.08)
        d.text(s, x + 3.1, y + 0.14, 1.25, 0.32, ref, size=8, color=MUTED, align="r", anchor="m")
        d.text(s, x + 0.15, y + 0.55, 4.15, 0.85, txt, size=10, color=INK)
        d.text(s, x + 0.15, y + 1.38, 4.15, 0.3, f"Lección: {lesson}", size=10, bold=True, color=col)
    d.notes(s, """
        Cuatro referencias de la industria, para que vean que esto no es teoría. Meta con TestGen-LLM
        (paper de FSE 2024): los tests que genera el LLM pasan por filtros automáticos antes de que un
        ingeniero los vea, y solo una fracción sobrevive. Meta con ACH (2025): usa mutantes para guiar la
        generación, el test existe para matar un bug concreto. Google lleva años corriendo mutation testing
        en code review, pero solo sobre las líneas cambiadas, porque correrlo completo es caro. Y Google
        Research mostró en 2023 un modelo que propone cómo resolver comentarios de revisión, siempre con una
        persona que decide. Ojo: no hay que memorizar cifras, la idea es el patrón: filtrar, medir con
        mutación y dejar la decisión a una persona.
    """)


# ============================================================================
# C. Spec Driven Development
# ============================================================================
def part_c(d: Deck):
    d.section("2. Spec Driven Development")
    s = d.divider("Parte 2", "Spec Driven Development", "Si la IA escribe el código, la spec es lo que de verdad programas.")
    d.notes(s, "Segunda parte: cómo una spec con reglas identificadas ordena el trabajo de personas y agentes.")

    s = d.content("Qué es Spec Driven Development")
    d.text(s, 0.45, 1.2, 4.3, 1.5, [
        "Escribes una **spec** (requisitos, diseño técnico y arquitectura) y los agentes de IA desarrollan la "
        "feature de punta a punta, incluidos los tests.",
    ], size=12)
    d.text(s, 0.45, 2.3, 4.3, 0.3, "Herramientas: Kiro, Spec Kit, Tessl", size=11, bold=True, color=TEAL)
    d.box(s, 0.45, 2.75, 2.08, 1.55, "", fill=LIGHT)
    d.text(s, 0.55, 2.8, 1.9, 0.3, "Crítica", size=10.5, bold=True, color=RED)
    d.text(s, 0.55, 3.1, 1.9, 1.15, "Mantener documentación extensa en vez de avanzar en pasos pequeños.",
           size=9.5)
    d.box(s, 2.67, 2.75, 2.08, 1.55, "", fill=LIGHT)
    d.text(s, 2.77, 2.8, 1.9, 0.3, "Ventaja", size=10.5, bold=True, color=GREEN)
    d.text(s, 2.77, 3.1, 1.9, 1.15, "Si cambia un requisito, cambias la spec y los tests se reconectan.",
           size=9.5)
    d.text(s, 0.45, 4.45, 4.3, 0.28, "Libro, p. 113", size=9, color=MUTED)
    # ciclo
    steps = [("1", "Spec", "reglas con ID", TEAL), ("2", "Contrato", "openapi.yaml", AQUA),
             ("3", "Tests en rojo", "uno a la vez", RED), ("4", "Código", "lo mínimo", ORANGE),
             ("5", "Verde", "y evidencia", GREEN)]
    import math
    cx, cy, R = 7.2, 2.95, 1.35
    pos = []
    for i in range(5):
        a = -math.pi / 2 + i * 2 * math.pi / 5
        pos.append((cx + R * math.cos(a), cy + R * math.sin(a)))
    hw, hh = 0.66, 0.33  # media caja

    def edge(dx, dy):
        # distancia del centro al borde de la caja en la dirección (dx, dy), más un respiro
        L = math.hypot(dx, dy)
        ux, uy = dx / L, dy / L
        t = min(hw / abs(ux) if ux else 99, hh / abs(uy) if uy else 99)
        return ux * (t + 0.06), uy * (t + 0.06)

    for i in range(5):
        x1, y1 = pos[i]
        x2, y2 = pos[(i + 1) % 5]
        ox, oy = edge(x2 - x1, y2 - y1)
        d.line(s, x1 + ox, y1 + oy, x2 - ox, y2 - oy, color=MUTED, width=1.75)
    for (n, t, sub, col), (x, y) in zip(steps, pos):
        d.box(s, x - 0.66, y - 0.33, 1.32, 0.66, paras=[f"**{t}**", sub], fill=col, size=10, space_after=0)
    d.text(s, cx - 0.9, cy - 0.25, 1.8, 0.5, "Constitución P1", size=10, bold=True, color=GRAY, align="c",
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
        ("Encabezado", "ID, versión, contrato API, flujos, specs por capa", TEAL),
        ("Contexto", "El problema en lenguaje del negocio", AQUA),
        ("Supuestos", "Lo que el código puede dar por hecho (reloj, UTC, sin login)", AQUA),
        ("Reglas con ID", "LOAN-R2 · Límite por persona. Verificables, con código de error", RED),
        ("Comportamiento en UI", "UI-LOAN-2: textos y colores exactos", ORANGE),
        ("Criterios de aceptación", "Tabla regla → capa → test", GREEN),
        ("Fuera de alcance", "Lo que NO se hace (renovar, multas)", GRAY),
    ]
    for i, (t, desc, col) in enumerate(secs):
        y = 1.15 + i * 0.52
        d.box(s, 0.45, y, 2.3, 0.42, t, fill=col, size=10.5, align="l", margin=0.1)
        d.text(s, 2.9, y, 3.3, 0.42, desc, size=10, anchor="m")
    d.card(s, 6.45, 1.15, 3.1, 3.55, fill=LIGHTBLUE)
    d.text(s, 6.6, 1.25, 2.8, 0.3, "Formato de referencia", size=11.5, bold=True, color=TEAL)
    d.text(s, 6.6, 1.6, 2.8, 3.0, [
        "Sale del ejemplo SPECS_EJEMPLO1 del curso: contexto, supuestos, reglas R1, R2... y mapa a los tests.",
        "Una spec por feature y una por capa.",
        "Si algo no está en la spec, el agente se detiene y la propone primero.",
    ], size=10, bullets=True, space_after=6)
    d.notes(s, """
        Esta es la estructura que usamos, basada en el ejemplo de spec del curso (SPECS_EJEMPLO1): un
        encabezado con ID y versión, contexto, supuestos, reglas numeradas con ID, comportamiento en la
        interfaz, criterios de aceptación como tabla regla a test y fuera de alcance. Los supuestos son
        clave para la IA: le dicen qué puede dar por hecho, por ejemplo que el reloj es un puerto inyectable.
        Fuera de alcance evita que el agente invente funcionalidades. Y la regla de oro, que está en
        CLAUDE.md: si algo no está en la spec, el agente se detiene y propone la spec primero.
    """)

    s = d.content("Extracto de SPEC-LIB-02: Préstamos")
    d.code(s, 0.45, 1.15, 5.6, 3.75, """
## Reglas de negocio

- **LOAN-R1 · Copias disponibles.** Solo se presta si
  `availableCopies > 0`. Si no hay copias: 409
  `NO_COPIES_AVAILABLE`. Dos solicitudes simultáneas
  por la última copia: exactamente una tiene éxito.
- **LOAN-R2 · Límite por persona.** Máximo 3 préstamos
  no devueltos. El cuarto responde 409
  `LOAN_LIMIT_REACHED`.
- **LOAN-R3 · Fecha de devolución.**
  `dueAt = loanedAt + 14 días`.

| Regla   | Capa y test que la verifica                       |
| LOAN-R2 | unit dominio `loan-policy.spec.ts` · contrato (409) |""",
           lang="md", title="specs/features/SPEC-LIB-02-prestamos.md", size=9.5)
    notes_x = 6.3
    ann = [
        ("ID de regla", "Lo citan los tests: [LOAN-R2] ...", RED),
        ("Código de error", "Contrato y UI usan el mismo código", ORANGE),
        ("Valor límite", "3 préstamos: el test del borde exacto", GREEN),
        ("Caso de concurrencia", "Se prueba con PostgreSQL real", AQUA),
        ("Mapa a tests", "Dice en qué capa va cada test", TEAL),
    ]
    for i, (t, desc, col) in enumerate(ann):
        y = 1.15 + i * 0.75
        d.box(s, notes_x, y, 3.25, 0.3, t, fill=col, size=10, align="l", margin=0.08)
        d.text(s, notes_x, y + 0.32, 3.25, 0.35, desc, size=10, color=INK)
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
    tree = """
backend/src/loans/
├── domain/SPEC.md          reglas puras, sin dobles
├── application/SPEC.md     casos de uso, fakes
├── infrastructure/SPEC.md  TypeORM, Testcontainers
└── presentation/SPEC.md    HTTP, contrato

frontend/src/features/loans/SPEC.md
frontend/src/mocks/SPEC.md"""
    d.code(s, 0.45, 1.15, 4.6, 1.95, tree, lang="txt", title="Dónde viven")
    d.code(s, 5.25, 1.15, 4.3, 3.75, """
# SPEC · loans · capa domain

## Puede depender de / no puede depender de
- Puede: `shared/domain`.
- No puede: `@nestjs/*`, `typeorm`, `pg`, ni
  otras capas (ARCH-R1).

## Reglas que implementa
| Regla   | Dónde                  | Test         |
| LOAN-R2 | `assertCanBorrow`      | loan-policy  |
| LOAN-R3 | `Loan.open`            | loan.spec.ts |
| LOAN-R6 | `Loan.statusAt(now)`   | loan.spec.ts |

## Cómo se prueba esta capa
Tests unitarios sin dobles. El "ahora" se pasa
como parámetro: el dominio nunca lee el reloj.""", lang="md", title="backend/src/loans/domain/SPEC.md (extracto)")
    d.text(s, 0.45, 3.3, 4.6, 1.6, [
        "Cada capa declara qué **puede** y qué **no puede** importar (lo verifica dependency-cruiser).",
        "Dice qué se prueba ahí y qué **no**: eso evita el cupcake.",
        "Es la spec que recibe el agente cuando construye esa capa.",
    ], size=11, bullets=True, space_after=6)
    d.notes(s, """
        Además de la spec de feature, cada capa tiene su propio SPEC.md con la plantilla de
        specs/templates. Es la spec que se le da al agente cuando construye esa capa. Lo más valioso es la
        sección de qué no se prueba aquí: por ejemplo, la capa de dominio no prueba HTTP ni base de datos.
        Esa línea, escrita, es lo que evita que el agente duplique el mismo caso en tres capas. Y las
        dependencias permitidas no son solo texto: dependency-cruiser las verifica en CI.
    """)

    s = d.content("Trazabilidad: regla → test")
    d.box(s, 0.45, 1.25, 1.6, 0.55, "LOAN-R2", fill=RED, size=13)
    d.text(s, 0.45, 1.85, 1.6, 0.5, "Límite de 3 préstamos", size=9.5, color=GRAY, align="c")
    targets = [("unit", "loan-policy.spec.ts", GREEN), ("contrato", "loans.contract.spec.ts", AQUA),
               ("E2E", "FLOW-PRE-03", ORANGE)]
    for i, (layer, f, col) in enumerate(targets):
        y = 1.2 + i * 0.75
        d.line(s, 2.1, 1.52, 2.55, y + 0.3, color=MUTED, width=1.25)
        d.box(s, 2.6, y, 0.95, 0.6, layer, fill=col, size=10)
        d.text(s, 3.6, y, 1.58, 0.6, f, size=8, font=k.FONT_CODE, anchor="m", color=INK)
    d.text(s, 0.45, 3.55, 4.6, 1.35, [
        "Cada test nombra su regla al inicio del título.",
        "Falla si hay un **test huérfano** (sin ID), una regla sin tests, un ID que no existe o más de 6 "
        "tests por regla y capa.",
    ], size=10.5, bullets=True, space_after=5)
    d.code(s, 5.2, 1.15, 4.35, 3.75, """
$ npm run spec:trace
Regla      unit integ contr comp e2e Estado
BOOK-R1      11     .     1    .   . excede
BOOK-R2       1     2     1    .   . ok
LOAN-R1       4     1     1    .   . ok
LOAN-R2       5     1     1    .   . ok
UI-LOAN-4     .     .     .    3   . ok
FLOW-PRE-03   .     .     .    .   1 ok
...
✗ PRESUPUESTO BOOK-R1 tiene 11 tests
  en unit (máx. 6)
✗ ID NO EXISTE MOCK-R1
  handlers.contract.test.ts:282

FALLA: 29/29 reglas cubiertas,
118 tests, 0 huérfanos""", lang="sh", title="Salida real durante la construcción del repo")
    d.notes(s, """
        La trazabilidad es lo que convierte la spec en algo verificable. El script tools/spec-trace.mjs lee
        las reglas en negrita de las specs, los flujos de los archivos feature y los títulos de los tests.
        Falla en cuatro casos: una regla sin tests, un test sin ID (huérfano), un test que cita un ID que no
        existe y una regla que supera el presupuesto de tests por capa. Ese presupuesto es la defensa más
        directa contra la IA que genera 30 variantes del mismo caso. La salida es real: mientras agentes de
        IA construían este mismo repo, BOOK-R1 llegó a 11 tests unitarios y el script lo detectó. Es
        exactamente el problema de esta clase, atrapado por una baranda automática.
    """)

    s = d.content("OpenAPI: el contrato es la fuente de verdad")
    d.code(s, 0.45, 1.15, 5.2, 3.75, """
/api/loans:
  post:
    operationId: createLoan
    tags: [loans]
    summary: Registra un préstamo
    responses:
      '201':
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Loan'
      '404':
        $ref: '#/components/responses/NotFound'
      '409':
        description: Sin copias (LOAN-R1), límite
          (LOAN-R2) o préstamo duplicado (LOAN-R4)""", lang="yaml", title="specs/api/openapi.yaml", size=9.5)
    uses = [
        ("Backend", "lo implementa y sus respuestas se validan contra él", TEAL),
        ("Frontend", "genera sus tipos con openapi-typescript", ORANGE),
        ("Mocks MSW", "se validan contra el mismo contrato", AQUA),
        ("Spectral", "revisa el estilo del contrato", PLUM),
        ("Schemathesis y ZAP", "lo usan para atacar la API", RED),
    ]
    d.text(s, 5.9, 1.15, 3.65, 0.3, "Un archivo, cinco consumidores", size=12, bold=True, color=INK)
    for i, (t, desc, col) in enumerate(uses):
        y = 1.55 + i * 0.66
        d.box(s, 5.9, y, 1.3, 0.5, t, fill=col, size=9.5)
        d.text(s, 7.3, y, 2.25, 0.5, desc, size=9.5, anchor="m")
    d.notes(s, """
        El contrato de la API vive en specs/api/openapi.yaml, en OpenAPI 3.1, y es la única fuente de verdad
        (principio P2). Todo cambio de API parte por este archivo. Fíjate que la descripción del 409 nombra
        las reglas LOAN-R1, LOAN-R2 y LOAN-R4: el contrato también está trazado a la spec. Un mismo archivo
        alimenta al backend, a los tipos del frontend, a los mocks del frontend, al linter Spectral y a las
        herramientas de seguridad que atacan la API.
    """)

    s = d.content("El contrato se verifica antes que el código")
    flow = [
        ("openapi.yaml", "cambio en el PR", TEAL, 0.45),
        ("Spectral", "estilo y reglas del curso", PLUM, 2.35),
        ("oasdiff", "¿rompe a los clientes?", RED, 4.25),
        ("openapi-typescript", "tipos del frontend", ORANGE, 6.15),
    ]
    for i, (t, sub, col, x) in enumerate(flow):
        d.box(s, x, 1.25, 1.65, 0.75, paras=[f"**{t}**", sub], fill=col, size=10, space_after=0)
        if i < len(flow) - 1:
            d.line(s, x + 1.68, 1.62, x + 1.87, 1.62, color=MUTED, width=1.75)
    d.box(s, 8.05, 1.25, 1.5, 0.75, paras=["**api:check**", "drift = falla"], fill=GREEN, size=10,
          space_after=0)
    d.line(s, 7.83, 1.62, 8.02, 1.62, color=MUTED, width=1.75)
    d.code(s, 0.45, 2.3, 4.45, 2.6, """
extends:
  - spectral:oas
rules:
  # Un path fuera de /api nunca llega al backend
  biblioteca-paths-under-api:
    description: Todos los paths empiezan con /api.
    severity: error
    given: $.paths
    then:
      field: '@key'
      function: pattern
      functionOptions:
        match: '^/api(/|$)'""", lang="yaml", title=".spectral.yaml (extracto)")
    d.code(s, 5.1, 2.3, 4.45, 2.6, """
$ npm run lint:openapi
✓ No results with a severity of 'error'

$ oasdiff breaking main.yaml openapi.yaml
✗ error api-path-removed-without-deprecation
  DELETE /api/loans/{loanId}

$ npm run api:check   # en frontend/
✓ los tipos coinciden con el contrato""", lang="sh", title="etapa 2 del pipeline", size=9)
    d.notes(s, """
        Antes de una sola línea de código, el contrato pasa tres controles. Spectral es un linter de
        contratos: parte del ruleset oficial de OpenAPI y agrega reglas del curso, por ejemplo que todo 4xx
        use application/problem+json, porque la interfaz muestra mensajes según el campo code. oasdiff compara
        el contrato del PR con el de main y falla si el cambio rompe a los clientes, por ejemplo si se borra
        un endpoint o se agrega un campo obligatorio. Y api:check regenera los tipos del frontend y falla si
        no coinciden con lo que está commiteado: eso es drift entre contrato y código.
    """)

    s = d.content("Flujos en Gherkin: escribir el flujo es escribir el test")
    d.code(s, 0.45, 1.15, 5.9, 2.2, """
# language: es
@SPEC-LIB-02
Característica: Préstamos

  @FLOW-PRE-01 @smoke
  Escenario: Pedir prestado un libro disponible
    Dado que estoy en el catálogo
    Cuando pido prestado "Cien años de soledad" con el correo "ana@uc.cl"
    Entonces veo el mensaje "Préstamo registrado"
    Y veo la fecha de devolución "16-03-2026\"""", lang="gherkin", title="specs/flows/prestamos.feature (extracto)")
    d.card(s, 6.55, 1.15, 3.0, 2.2, fill=LIGHTBLUE)
    d.text(s, 6.7, 1.22, 2.7, 2.1, [
        "Cada escenario es un test de Playwright con su ID (@FLOW-PRE-01).",
        "@smoke: también corre contra el stack real.",
        "Los datos de prueba y el reloj fijo también son spec (specs/flows/README.md).",
    ], size=10, bullets=True, space_after=5)
    d.box(s, 0.45, 3.85, 1.05, 0.55, "bddgen", fill=PLUM, size=10.5)
    d.line(s, 1.0, 3.38, 1.0, 3.83, color=MUTED, width=1.75)
    d.line(s, 1.52, 4.12, 1.68, 4.12, color=MUTED, width=1.75)
    d.code(s, 1.7, 3.5, 7.85, 1.45, """
When('pido prestado {string} con el correo {string}', async ({ page }, title: string, email: string) => {
  await bookCard(page, title).getByRole('link', { name: /pedir prestado/i }).click()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await page.getByLabel('Correo').fill(email)
  await page.getByRole('button', { name: 'Pedir prestado', exact: true }).click()
})""", lang="ts", title="frontend/tests/e2e/steps/loans.steps.ts (extracto)")
    d.notes(s, """
        Los flujos de usuario también son spec. Están en specs/flows en Gherkin y en español. playwright-bdd
        lee estos archivos (comando bddgen) y genera los tests de Playwright. Los pasos se implementan una
        sola vez en frontend/tests/e2e/steps, así que agregar un escenario nuevo es escribir texto. El tag
        smoke marca los flujos que también corren contra el stack real. Fíjate en la fecha de devolución:
        16-03-2026 es exactamente el reloj fijo más 14 días (LOAN-R3), por eso el reloj fijo es parte de la
        spec.
    """)

    s = d.content("La IA en SDD: dos pasos y un juez")
    steps = [
        ("Spec y reglas", "SPEC-LIB-XX con IDs", TEAL),
        ("Paso 1: plan", "La IA propone casos: regla, capa y partición", ORANGE),
        ("Tú apruebas", "Podas duplicados y subes casos a la capa baja", RED),
        ("Paso 2: un test a la vez", "Falla por la razón correcta, después el código", GREEN),
        ("Revisor IA", "Otro modelo evalúa contra la spec (LLM-as-judge)", PLUM),
    ]
    w = 1.68
    for i, (t, sub, col) in enumerate(steps):
        x = 0.45 + i * (w + 0.18)
        d.box(s, x, 1.3, w, 1.25, paras=[f"**{t}**", sub], fill=col, size=10, space_after=3)
        if i < len(steps) - 1:
            d.line(s, x + w + 0.01, 1.92, x + w + 0.17, 1.92, color=MUTED, width=1.75)
    d.code(s, 0.45, 2.85, 5.0, 1.6, """
| Regla   | Capa     | Partición               |
| LOAN-R2 | unit     | 2 préstamos: permite    |
| LOAN-R2 | unit     | 3 préstamos: rechaza    |
| LOAN-R2 | contrato | 409 LOAN_LIMIT_REACHED  |
| LOAN-R2 | UI       | (ya cubierto en E2E-03) |""", lang="md", title="Plan propuesto por el agente (paso 1)", size=9)
    d.text(s, 5.7, 2.85, 3.85, 2.1, [
        "“Generate one test at a time, so that you can review them diligently” (p. 94).",
        "El flujo de dos pasos existe para que **tú elijas** qué casos automatizar en cada capa (p. 96).",
        "El juez usa un modelo distinto al que generó y puntúa de 0 a 1 con razones (p. 103).",
    ], size=10, bullets=True, space_after=6)
    d.notes(s, """
        Así usamos la IA dentro de SDD. Paso uno: el agente lee la spec y propone una tabla de casos con
        regla, capa y partición, sin escribir código. Tú apruebas o podas, por ejemplo eliminas el caso de
        UI porque ya lo cubre un flujo E2E. Paso dos: el agente escribe un test a la vez, verifica que falla
        por la razón correcta y recién ahí implementa. Al final, un revisor con otro modelo actúa como juez.
        Todo esto viene del libro: generar un test a la vez (p. 94), el flujo de dos pasos (p. 96) y el
        patrón LLM as the judge (p. 103). Y está escrito en CLAUDE.md y AGENTS.md del repo.
    """)


    s = d.content("Un agente que propone tests desde el OpenAPI")
    steps = [
        ("Disparo manual", "workflow_dispatch con un operationId", TEAL),
        ("Paso 1: plan", "docs/propuestas-ia/<op>.md: caso, partición, código, capa, regla", ORANGE),
        ("Paso 2: tests", "*.proposed.contract.spec.ts, solo casos nuevos", GREEN),
        ("Paso 3: verifica", "typecheck y spec-trace en verde", PLUM),
        ("PR en borrador", "Una persona aprueba el plan antes del código", RED),
    ]
    for i, (t, sub, col) in enumerate(steps):
        y = 1.15 + i * 0.76
        d.box(s, 0.45, y, 3.5, 0.64, paras=[f"**{t}**", sub], fill=col, size=9.5, space_after=1, align="l",
              margin=0.1)
        if i < len(steps) - 1:
            d.line(s, 2.2, y + 0.65, 2.2, y + 0.75, color=MUTED, width=1.5)
    d.code(s, 4.15, 1.15, 5.4, 3.8, """
Paso 1. Plan. Crea docs/propuestas-ia/<op>.md con una tabla:
| Caso | Partición o valor límite | Respuesta | Capa | ID |
Reglas del plan:
- Solo casos que pertenecen a la capa de contrato.
  Si un caso se detecta en una capa más baja (unit),
  anótalo en "Fuera de esta capa" y NO lo propongas.
- Máximo 6 casos por regla. Una partición, un caso.
- Marca los casos que ya están cubiertos y no los repitas.

Paso 2. Tests. Escribe solo los casos nuevos del plan.
Cada título empieza con el ID de la regla.
Sin mocks, sin aserciones débiles, oráculos literales.

Paso 3. Verifica que compila con npm run typecheck y
que la trazabilidad sigue en verde (spec-trace).
No modifiques specs/ ni código de producción.""", lang="md", title=".github/workflows/ai-generate-tests.yml (prompt, extracto)")
    d.notes(s, """
        Este workflow es la versión con barandas del ejemplo del libro, donde Claude Code en GitHub Actions
        genera tests REST Assured desde un OpenAPI y abre un PR (p. 139 a 143). Aquí se dispara a mano para
        una sola operación del contrato, nunca para todo el OpenAPI. El agente primero escribe un plan con
        partición, código esperado, capa e ID de regla, y los casos que pertenecen a unit los deja fuera.
        Después escribe solo los casos nuevos, verifica que compilan y que spec-trace sigue en verde, y abre
        un PR en borrador con un checklist que una persona tiene que marcar. Es la regla P4.7 hecha
        automatización: la IA propone, una persona aprueba.
    """)


# ============================================================================
# D. El proyecto
# ============================================================================
def part_d(d: Deck):
    d.section("3. El proyecto")
    s = d.divider("Parte 3", "El proyecto: Biblioteca UC", "Catálogo de libros y préstamos. NestJS, Next.js y PostgreSQL en un monorepo.")
    d.notes(s, "Tercera parte: el proyecto de ejemplo que usaremos para mostrar cada tipo de prueba.")

    s = d.content("Mapa del monorepo")
    d.code(s, 0.45, 1.15, 5.3, 3.75, """
full_stack_testing/
├── specs/            fuente de verdad
│   ├── constitution.md  architecture.md
│   ├── api/openapi.yaml
│   ├── features/  SPEC-LIB-01, SPEC-LIB-02
│   └── flows/     *.feature (Gherkin)
├── backend/          NestJS + TypeORM + PostgreSQL
├── frontend/         Next.js + MSW
├── tools/            spec-trace, evidencia del PR
├── .github/workflows CI con DevSecOps
└── docs/             esta presentación""", lang="txt", title="github.com/UC-IIC-3143-Software-Development/full_stack_testing", size=9.5)
    stack = [("NestJS", TEAL), ("PostgreSQL", TEAL), ("TypeORM", TEAL), ("Next.js", ORANGE), ("React", ORANGE),
             ("MSW", ORANGE), ("Jest", GREEN), ("Vitest", GREEN), ("Playwright", GREEN), ("Testcontainers", GREEN),
             ("Spectral", PLUM), ("Semgrep", RED), ("Trivy", RED), ("ZAP", RED)]
    d.text(s, 6.0, 1.15, 3.55, 0.3, "Stack", size=12, bold=True)
    for i, (t, col) in enumerate(stack):
        x = 6.0 + (i % 2) * 1.8
        y = 1.55 + (i // 2) * 0.47
        d.chip(s, x, y, 1.7, 0.36, t, fill=col, size=10)
    d.notes(s, """
        El monorepo tiene cuatro carpetas importantes. specs es la fuente de verdad. backend es una API REST
        en NestJS con PostgreSQL y TypeORM. frontend es Next.js con MSW como mock server. tools tiene los
        scripts de CI: trazabilidad de specs, smoke de la API y la evidencia del PR. Los colores del stack
        se repiten en toda la clase: verde para pruebas, rojo para seguridad, naranjo para frontend y build.
    """)

    s = d.content("La app: Biblioteca UC")
    shots = [
        (IMG / "catalogo.png", "Catálogo: insignia verde o roja según las copias (UI-CAT-2) y botón deshabilitado "
         "si está agotado (UI-CAT-3).", "Captura de pantalla del catálogo de la Biblioteca UC"),
        (IMG / "limite-prestamos.png", "Detalle del libro: el cuarto préstamo muestra el mensaje de LOAN-R2 "
         "(UI-LOAN-4).", "Captura del error al superar el límite de préstamos"),
    ]
    for i, (img, caption, alt) in enumerate(shots):
        x = 0.45 + i * 4.65
        d.image(s, img, x, 1.15, w=4.45, alt=alt)
        d.text(s, x, 4.02, 4.45, 0.5, caption, size=10, color=INK)
    d.text(s, 0.45, 4.6, 9.1, 0.3, "Capturas reales que toma Playwright en el pipeline (FLOW-CAT-01 y FLOW-PRE-03), "
           "con el mock server y el reloj fijo.", size=9, color=MUTED, align="c")
    d.notes(s, """
        Así se ve la app. A la izquierda el catálogo: cada libro muestra una insignia verde con las copias
        disponibles o roja si está agotado, y el botón Pedir prestado se deshabilita si no hay copias. A la
        derecha, el detalle de un libro cuando una persona que ya tiene 3 préstamos intenta pedir un cuarto:
        aparece el mensaje exacto que pide la spec. Estas imágenes no son mockups: son capturas que
        Playwright toma en cada ejecución de los flujos y que el pipeline publica en el PR.
    """)

    s = d.content("Arquitectura en capas")
    # backend
    d.text(s, 0.45, 1.12, 4.4, 0.3, "Backend (NestJS)", size=12, bold=True, color=TEAL)
    layers = [("presentation", "controllers, DTOs, problem+json", 1.5, AQUA),
              ("application", "casos de uso y puertos", 2.3, TEAL),
              ("domain", "reglas puras: ISBN, préstamo", 3.1, GREEN)]
    for name, desc, y, col in layers:
        d.box(s, 0.45, y, 2.6, 0.62, paras=[f"**{name}**", desc], fill=col, size=9.5, space_after=0)
    d.box(s, 3.35, 2.3, 1.5, 1.42, paras=["**infrastructure**", "TypeORM, migraciones"], fill=ORANGE, size=9.5,
          space_after=0)
    d.line(s, 1.75, 2.13, 1.75, 2.28, color=INK, width=1.5)
    d.line(s, 1.75, 2.93, 1.75, 3.08, color=INK, width=1.5)
    d.line(s, 3.33, 3.4, 3.07, 3.4, color=INK, width=1.5)
    d.line(s, 3.33, 2.6, 3.07, 2.6, color=INK, width=1.5)
    d.text(s, 0.45, 3.9, 4.4, 1.05, [
        "**ARCH-R1** domain no importa Nest, TypeORM ni pg",
        "**ARCH-R2** application depende de puertos, no de infraestructura",
        "**ARCH-R3** presentation no toca repositorios",
    ], size=9.5, bullets=True, space_after=2)
    # frontend
    d.text(s, 5.15, 1.12, 4.4, 0.3, "Frontend (Next.js)", size=12, bold=True, color=ORANGE)
    fl = [("app (rutas)", 1.5, ORANGE), ("features/*/components", 2.08, ORANGE),
          ("features/*/hooks", 2.66, "B5651D"), ("shared/api", 3.24, "B5651D")]
    for name, y, col in fl:
        d.box(s, 5.15, y, 2.4, 0.42, name, fill=col, size=10)
    for y in (1.93, 2.51, 3.09):
        d.line(s, 6.35, y, 6.35, y + 0.13, color=INK, width=1.5)
    d.box(s, 7.95, 2.08, 1.6, 1.0, paras=["**shared/domain**", "funciones puras"], fill=GREEN, size=9.5,
          space_after=0)
    d.line(s, 7.57, 2.29, 7.93, 2.45, color=INK, width=1.5)
    d.line(s, 7.57, 2.87, 7.93, 2.7, color=INK, width=1.5)
    d.box(s, 7.95, 3.24, 1.6, 0.42, "mocks (MSW)", fill=AQUA, size=10)
    d.line(s, 7.93, 3.45, 7.57, 3.45, color=AQUA, width=1.5, dash=True)
    d.text(s, 5.15, 3.9, 4.4, 1.05, [
        "**ARCH-R6** shared/domain no importa React ni la API",
        "**ARCH-R7** los componentes no llaman fetch directo",
        "**ARCH-R8** app no importa mocks (MSW se activa por variable)",
    ], size=9.5, bullets=True, space_after=2)
    d.notes(s, """
        Las dependencias apuntan hacia adentro. En el backend, el dominio no conoce frameworks ni base de
        datos, la aplicación orquesta el dominio a través de puertos (interfaces de repositorio y reloj) y
        la infraestructura implementa esos puertos con TypeORM. En el frontend las rutas componen
        componentes, los componentes usan hooks y los hooks usan el cliente generado desde OpenAPI. Las
        funciones puras, como el color de cada estado de préstamo, viven en shared/domain y se prueban con
        unit sin mocks. Cada regla ARCH tiene un ID, igual que las reglas de negocio.
    """)

    s = d.content("Test de arquitectura con dependency-cruiser")
    d.code(s, 0.45, 1.15, 5.4, 2.75, """
// Cada regla lleva su ID para que el error apunte a la spec
const LAYER = (layer) => `^src/[^/]+/${layer}/`

module.exports = {
  forbidden: [
    {
      name: 'ARCH-R1-dominio-puro',
      severity: 'error',
      from: { path: LAYER('domain') },
      to: { pathNot: LAYER('domain') },
    },
    { name: 'ARCH-R4-sin-ciclos', severity: 'error',
      from: {}, to: { circular: true } },
  ],
}""", lang="js", title="backend/.dependency-cruiser.cjs (extracto)")
    d.code(s, 0.45, 4.05, 5.4, 0.85, """
$ npm run test:arch
✗ error ARCH-R1-dominio-puro:
  src/loans/domain/loan.ts → node_modules/@nestjs/common""", lang="sh")
    d.card(s, 6.1, 1.15, 3.45, 3.75, fill=LIGHT)
    d.text(s, 6.3, 1.25, 3.1, 0.3, "Por qué importa", size=12, bold=True, color=TEAL)
    d.text(s, 6.3, 1.65, 3.1, 3.2, [
        "La IA no respeta capas por iniciativa propia: importa lo que encuentra más cerca.",
        "Una regla escrita en la spec, verificada en CI, convierte la arquitectura en un test.",
        "El libro lo llama architecture testing: ArchUnit en Java, aquí dependency-cruiser (p. 315).",
    ], size=10.5, bullets=True, space_after=8)
    d.notes(s, """
        La arquitectura también se prueba. El libro, en el capítulo 10 de requisitos transversales, muestra
        ArchUnit para Java. En TypeScript usamos dependency-cruiser: cada regla ARCH de la spec se traduce en
        una regla forbidden. Si un agente, por comodidad, importa algo de Nest dentro del dominio, el
        pipeline falla en la etapa 2 con el ID de la regla. Esto es especialmente útil con IA porque los
        agentes tienden a importar lo que tienen más cerca.
    """)


# ============================================================================
# E. Tipos de prueba
# ============================================================================
def type_slide(d: Deck, title: str, rows: list[tuple[str, str]], code: str, filename: str, lang="ts",
               code_size=None, notes=""):
    """Formato común para cada tipo de prueba: cinco filas a la izquierda y código real a la derecha."""
    s = d.content(title)
    label_col = {"Qué es": TEAL, "Qué detecta": GREEN, "Herramienta": ORANGE, "Dónde corre": PLUM,
                 "Libro": PINK}
    y = 1.2
    for label, txt in rows:
        lines = k.est_lines(txt, 2.62, 10.5)
        h = max(0.36, lines * 0.18 + 0.08)
        d.chip(s, 0.45, y + 0.01, 1.12, 0.3, label, fill=label_col.get(label, GRAY), size=9.5)
        d.text(s, 1.66, y - 0.02, 2.66, h, txt, size=10.5, color=INK, space_after=0)
        y += h + 0.12
    if y > 5.05:
        k.WARNINGS.append(f"Filas de tipo de prueba desbordan ({y:.2f}): {title}")
    d.code(s, 4.45, 1.15, 5.1, 3.8, code, lang=lang, title=filename, size=code_size)
    d.notes(s, notes)
    return s


def part_e(d: Deck):
    d.section("4. Tipos de prueba")
    s = d.divider("Parte 4", "Tipos de prueba, uno por uno", "Qué es, qué detecta, con qué herramienta, dónde corre y un ejemplo real.")
    d.notes(s, "Cuarta parte. Cada tipo de prueba tiene la misma estructura para que sea fácil compararlos.")

    s = d.content("Mapa de pruebas del proyecto")
    bands = [
        ("Micro: backend", TEAL, [("Unit dominio", "5"), ("Unit aplicación con fakes", "5"),
                                  ("Integración PostgreSQL", "6"), ("Data testing", "6"),
                                  ("Contrato proveedor", "6"), ("Fuzzing del contrato", "6")]),
        ("Frontend sin backend", ORANGE, [("Unit shared/domain", "5"), ("Componentes con MSW", "5"),
                                          ("Contrato de mocks", "5"), ("E2E de flujos", "7"),
                                          ("Visual, color y posición", "7"), ("Accesibilidad", "7")]),
        ("Sistema y transversales", PLUM, [("Arquitectura", "2"), ("SAST y dependencias", "3 y 4"),
                                           ("Smoke en stack real", "9"), ("DAST con ZAP", "9"),
                                           ("Performance", "9"), ("Mutación", "noche")]),
    ]
    for bi, (band, col, items) in enumerate(bands):
        y = 1.15 + bi * 1.25
        d.box(s, 0.45, y, 1.55, 1.05, band, fill=col, size=10.5)
        for i, (name, stage) in enumerate(items):
            x = 2.15 + (i % 3) * 2.48
            yy = y + (i // 3) * 0.55
            d.box(s, x, yy, 2.36, 0.47, "", fill=LIGHT)
            d.text(s, x + 0.08, yy, 1.65, 0.47, name, size=9.5, anchor="m", color=INK, bold=True)
            d.chip(s, x + 1.74, yy + 0.1, 0.55, 0.27, stage, fill=col, size=8.5)
    d.text(s, 0.45, 4.92, 9.1, 0.28, "El número es la etapa del pipeline donde corre (ver Parte 5). "
           "La revisión con IA comenta cada PR.", size=9, color=MUTED, align="c")
    d.notes(s, """
        Este es el mapa completo. Tres franjas: las pruebas micro del backend, el frontend probado sin
        backend gracias al mock server, y las pruebas de sistema y transversales. El número de cada caja es
        la etapa del pipeline donde corre. Vamos a ver cada una con la misma estructura: qué es, qué detecta,
        herramienta, dónde corre, página del libro y un ejemplo del repo.
    """)

    s = d.content("Dobles de prueba: cuándo usar cada uno")
    rows = [
        ["Doble", "Qué es", "En este proyecto"],
        ["Dummy", "Un objeto que se pasa pero no se usa", "Casi nunca hace falta"],
        ["Stub", "Respuestas fijas a llamadas", "Handlers MSW en tests de componentes"],
        ["Fake", "Implementación real pero simple", "InMemoryLoanRepository, FixedClock"],
        ["Mock", "Verifica que ocurrió una interacción", "Solo con justificación escrita (P4.3)"],
    ]
    d.table(s, 0.45, 1.15, 5.6, rows, [0.9, 2.3, 2.4], row_h=0.5, size=10.5, first_col_bold=True)
    d.card(s, 6.3, 1.15, 3.25, 3.75, fill=LIGHTBLUE)
    d.text(s, 6.45, 1.25, 2.95, 0.3, "Fakes que no mienten", size=12, bold=True, color=TEAL)
    d.text(s, 6.45, 1.65, 2.95, 3.2, [
        "Un fake puede divergir del repositorio real y dar falsos verdes.",
        "Solución: **la misma suite de contrato** del puerto corre contra el fake (unit) y contra TypeORM "
        "con PostgreSQL (integración).",
        "Si el fake miente, la suite lo delata.",
    ], size=10.5, bullets=True, space_after=7)
    d.text(s, 0.45, 3.85, 5.6, 1.0, [
        "Un mock prueba **cómo** se hizo algo. Un fake prueba **qué** resultó.",
        "Los tests con mocks se rompen al refactorizar aunque el comportamiento siga igual.",
    ], size=10.5, bullets=True, space_after=5)
    d.notes(s, """
        Repaso rápido de dobles de prueba, que ya vieron en la clase de testing: dummy, stub, fake y mock. La
        política del proyecto es usar fakes por defecto: un repositorio en memoria y un reloj fijo. Un mock
        verifica interacciones, el cómo, y por eso se rompe al refactorizar. El riesgo de los fakes es que
        se alejen del comportamiento real. La solución es una suite de contrato del puerto que corre dos
        veces: contra el fake y contra el repositorio real en PostgreSQL. Si el fake miente, falla.
    """)

    type_slide(d, "Unitarias de dominio, sin mocks", [
        ("Qué es", "Prueba reglas puras del dominio: entidades y value objects, sin framework ni base de datos."),
        ("Qué detecta", "Errores de lógica en particiones y valores límite: guiones, prefijo 979, dígito verificador."),
        ("Herramienta", "Jest con ts-jest. Objetos reales, oráculos literales."),
        ("Dónde corre", "Etapa 5 · unit, en cada push. Milisegundos."),
        ("Libro", "Tests micro, p. 66 a 72. Buenos tests, p. 107."),
    ], """
const invalidIsbn = {
  code: 'VALIDATION_ERROR',
  field: 'isbn',
  message: 'El ISBN no es válido',
}

describe('Isbn', () => {
  it('[BOOK-R1] normaliza quitando guiones y espacios', () => {
    expect(Isbn.create('978-84-376 0494-7').value)
      .toBe('9788437604947')
  })

  it('[BOOK-R1] acepta el prefijo 979', () => {
    expect(Isbn.create('979-10-323-0569-0').value)
      .toBe('9791032305690')
  })

  it('[BOOK-R1] rechaza un dígito verificador incorrecto', () => {
    expect(thrownBy(() => Isbn.create('978-0-00-000000-1')))
      .toMatchObject(invalidIsbn)
  })
})""", "backend/src/books/domain/isbn.spec.ts (extracto)", notes="""
        Las unitarias de dominio son la base de la pirámide. Prueban reglas puras, sin Nest y sin base de
        datos, así que corren en milisegundos y no necesitan dobles. Fíjate en las particiones: un ISBN con
        guiones que se normaliza, el prefijo 979 que también es válido y un dígito verificador incorrecto.
        Una partición, un test, no treinta variantes del mismo caso. El valor esperado está escrito literal, nunca
        recalculado con la misma lógica de producción.
    """)

    type_slide(d, "Unitarias de aplicación con fakes", [
        ("Qué es", "Prueba un caso de uso completo con repositorios en memoria y un reloj fijo."),
        ("Qué detecta", "Orquestación incorrecta: no descontar la copia, fecha de devolución mal calculada."),
        ("Herramienta", "Jest. Fakes: InMemoryBookRepository, InMemoryLoanRepository, InMemoryUnitOfWork y FixedClock."),
        ("Dónde corre", "Etapa 5 · unit, en cada push."),
        ("Libro", "Dobles de prueba y aislamiento, cap. 3."),
    ], """
// Sin mocks: los tests verifican el estado final de los
// repositorios, no qué métodos se llamaron.
export function createApplication() {
  const books = new InMemoryBookRepository()
  const loans = new InMemoryLoanRepository()
  const clock = new FixedClock(FIXED_NOW)
  const unitOfWork = new InMemoryUnitOfWork([books, loans])
  return { books, loans, clock,
    createLoan: new CreateLoan(books, loans, unitOfWork, clock) }
}

it('[LOAN-R2] rechaza el cuarto préstamo y no descuenta copias',
  async () => {
    const { app, books, cienAnos } = await appWithBooks()
    for (const book of books.slice(1)) {
      await app.createLoan.execute(
        { bookId: book.id, borrowerEmail: 'beto@uc.cl' })
    }
    const error = await rejectionOf(app.createLoan.execute(
      { bookId: cienAnos.id, borrowerEmail: 'beto@uc.cl' }))
    expect(error).toBeInstanceOf(LoanLimitReachedError)
    expect((await app.books.findById(cienAnos.id))
      ?.availableCopies).toBe(3)
  })""", "application-harness.ts y create-loan.spec.ts (extracto)", notes="""
        En la capa de aplicación probamos casos de uso. No hay mocks: el repositorio en memoria es una
        implementación real y simple del puerto, y el reloj fijo hace que las fechas sean deterministas. El
        test verifica el resultado y el estado final: el error es LoanLimitReachedError y las copias del
        libro siguen siendo 3. No verifica qué métodos se llamaron. Si la IA te propone un jest.fn para el
        repositorio, el linter lo rechaza y la constitución pide justificarlo por escrito.
    """)

    type_slide(d, "Integración con Testcontainers y PostgreSQL", [
        ("Qué es", "Prueba los repositorios TypeORM contra un PostgreSQL real que se crea y destruye en Docker."),
        ("Qué detecta", "SQL incorrecto, migraciones rotas, índices y restricciones que faltan."),
        ("Herramienta", "Testcontainers (@testcontainers/postgresql, postgres:17-alpine) y Jest."),
        ("Dónde corre", "Etapa 6 · integración y contrato. Necesita Docker en el runner."),
        ("Libro", "Testcontainers, p. 179. Data testing, cap. 5."),
    ], """
// test/support/postgres-global-setup.ts: un contenedor por
// corrida, en un puerto libre elegido al azar
const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
  .withDatabase('biblioteca')
  .start()
process.env.DATABASE_URL = container.getConnectionUri()

// src/loans/infrastructure/loan.repository.int-spec.ts
beforeAll(async () => {
  dataSource = await openMigratedDataSource() // migraciones
})
beforeEach(async () => {
  await truncateAll(dataSource) // cada test arma su estado
})

// La MISMA suite de contrato que corre contra el fake
loanRepositoryContract('PostgreSQL', async () => {
  const unitOfWork = new TypeOrmUnitOfWork(dataSource)
  return {
    books: new TypeOrmBookRepository(unitOfWork),
    loans: new TypeOrmLoanRepository(unitOfWork),
  }
})""", "backend/test y src/loans/infrastructure (extracto)", notes="""
        Las pruebas de integración usan Testcontainers: cada corrida levanta un PostgreSQL limpio en Docker,
        en un puerto al azar, corre las migraciones reales y cada test vacía las tablas antes de empezar. El
        libro lo recomienda porque una base compartida está contaminada por el desarrollo activo (p. 179).
        Fíjate en la última parte: la misma suite de contrato del repositorio que corre contra el fake en
        memoria corre aquí contra PostgreSQL. Así el fake no puede mentir.
    """)

    s = d.content("Data testing: lo que solo la base de datos garantiza")
    items = [
        ("Migraciones", "Se corren de verdad en cada test de integración. Una migración rota falla en el PR, "
         "no en producción.", TEAL),
        ("Restricciones", "CHECK 0 <= availableCopies <= totalCopies y el índice único de ISBN (BOOK-R2, "
         "BOOK-R4).", ORANGE),
        ("Concurrencia", "Cinco solicitudes simultáneas por la última copia: exactamente una gana (LOAN-R1).", RED),
    ]
    for i, (t, txt, col) in enumerate(items):
        y = 1.2 + i * 1.22
        d.box(s, 0.45, y, 1.55, 1.02, t, fill=col, size=11)
        d.text(s, 2.15, y, 2.95, 1.02, txt, size=10.5, anchor="m")
    # diagrama concurrencia (loan.repository.int-spec.ts)
    d.text(s, 5.3, 1.12, 4.25, 0.3, "La última copia de La casa de los espíritus", size=11, bold=True, align="c")
    names = ["ana", "beto", "carla", "diego", "eva"]
    pg_y = 2.05
    d.box(s, 7.6, pg_y, 1.95, 1.3, paras=["**PostgreSQL**", "UPDATE books", "SET available = available - 1",
                                         "WHERE available > 0"], fill=TEAL, size=8.5, space_after=0)
    for i, n in enumerate(names):
        y = 1.55 + i * 0.47
        col = GREEN if i == 0 else RED
        d.box(s, 5.3, y, 1.2, 0.36, f"{n}@uc.cl", fill=AQUA, size=9.5)
        d.line(s, 6.52, y + 0.18, 7.58, pg_y + 0.25 + i * 0.2, color=col, width=1.75)
    d.text(s, 5.3, 3.95, 4.25, 0.28, "[g]1 × 201 Created[/]    [r]4 × 409 NO_COPIES_AVAILABLE[/]", size=10,
           align="c")
    d.text(s, 5.3, 4.3, 4.25, 0.65, "Una transacción aparte bloquea la fila (FOR UPDATE) para que las cinco "
           "compitan de verdad. Un fake en memoria nunca tiene esta carrera.", size=9.5, color=GRAY)
    d.notes(s, """
        El capítulo 5 del libro trata data testing. En este proyecto hay tres cosas que solo la base de
        datos garantiza: que las migraciones funcionen, que las restricciones existan y que la concurrencia
        se resuelva bien. El caso estrella es LOAN-R1: cinco personas piden la última copia al mismo tiempo.
        La spec exige que exactamente una gane, y eso se garantiza con una actualización condicional dentro
        de una transacción. El test real usa una barrera: otra transacción bloquea la fila con FOR UPDATE,
        las cinco solicitudes quedan esperando y al liberar compiten de verdad. Un fake en memoria nunca va
        a reproducir esa carrera, así que este test vive en la capa de integración y en ninguna otra.
    """)

    s = d.content("Contrato bidireccional: un OpenAPI, dos lados")
    d.box(s, 3.85, 1.9, 2.3, 1.2, paras=["**openapi.yaml**", "fuente de verdad"], fill=TEAL, size=11,
          shape="doc", space_after=0)
    d.box(s, 0.45, 1.5, 2.9, 2.0, "", fill=LIGHT)
    d.text(s, 0.6, 1.58, 2.6, 0.3, "Proveedor (backend)", size=11.5, bold=True, color=TEAL)
    d.text(s, 0.6, 1.95, 2.6, 1.5, [
        "supertest llama al controller real",
        "Testcontainers detrás",
        "Cada respuesta se valida contra el schema",
    ], size=10, bullets=True, space_after=3)
    d.box(s, 6.65, 1.5, 2.9, 2.0, "", fill=LIGHT)
    d.text(s, 6.8, 1.58, 2.6, 0.3, "Consumidor (frontend)", size=11.5, bold=True, color=ORANGE)
    d.text(s, 6.8, 1.95, 2.6, 1.5, [
        "Los handlers MSW devuelven datos",
        "Cada respuesta mock se valida contra el schema",
        "Si el mock miente, falla test:contract",
    ], size=10, bullets=True, space_after=3)
    d.line(s, 3.37, 2.5, 3.83, 2.5, color=INK, width=2, tail=True)
    d.line(s, 6.17, 2.5, 6.63, 2.5, color=INK, width=2, tail=True)
    d.card(s, 0.45, 3.75, 9.1, 1.15, fill=LIGHTBLUE)
    d.text(s, 0.65, 3.83, 8.7, 1.0, [
        "**¿Y Pact?** Pact hace contratos consumer-driven: cada consumidor publica lo que necesita y el "
        "proveedor lo verifica (p. 107). Conviene con muchos servicios y equipos. Aquí hay un solo consumidor, "
        "así que basta validar ambos lados contra el mismo OpenAPI.",
    ], size=10.5)
    d.notes(s, """
        El contrato se prueba por los dos lados. Del lado del proveedor, los tests de contrato del backend
        usan supertest contra la app Nest real, con PostgreSQL en Testcontainers, y validan cada respuesta
        contra el schema del OpenAPI. Del lado del consumidor, los mocks de MSW que usa el frontend también
        se validan contra el mismo OpenAPI. Así ninguno de los dos lados puede divergir en silencio. El libro
        presenta Pact, que es consumer-driven: tiene sentido con muchos consumidores y equipos. Con un solo
        frontend, validar ambos lados contra el OpenAPI es más simple y suficiente.
    """)

    type_slide(d, "Contrato del proveedor: supertest y OpenAPI", [
        ("Qué es", "Un flujo HTTP real: controller, caso de uso, repositorio y PostgreSQL. La respuesta se valida "
         "contra el OpenAPI."),
        ("Qué detecta", "Campos que faltan o sobran, status equivocados y errores sin problem+json."),
        ("Herramienta", "supertest, Testcontainers y Ajv con el OpenAPI (expectToMatchContract)."),
        ("Dónde corre", "Etapa 6. Escribe reports/contract-coverage.json para la evidencia."),
        ("Libro", "Contract tests y service tests, p. 68 a 72 y 107."),
    ], """
// [LOAN-R1] [LOAN-R3] [LOAN-R5] flujo completo: prestar,
// agotar, listar, devolver y devolver otra vez
const book = await createBook(
  running.http, CATALOG.casaEspiritus, 1)

const loan = await request(running.http)
  .post('/api/loans')
  .send({ bookId: book.id, borrowerEmail: 'Ana@UC.cl' })
await expectToMatchContract(loan, 'createLoan')
expect(loan.status).toBe(201)
expect(loan.body).toMatchObject({
  borrowerEmail: 'ana@uc.cl',
  dueAt: '2026-03-16T12:00:00.000Z',
  status: 'ACTIVE',
})

const exhausted = await request(running.http)
  .post('/api/loans')
  .send({ bookId: book.id, borrowerEmail: 'beto@uc.cl' })
await expectToMatchContract(exhausted, 'createLoan')
expect(exhausted.status).toBe(409)""", "backend/test/contract/loans.contract.spec.ts (extracto)", notes="""
        Este es el test de contrato del proveedor: supertest entra por el controller y recorre todo el
        flujo hasta PostgreSQL real en Testcontainers. Pero ojo con el cupcake: aquí no se prueban todas las
        validaciones de campos, eso ya está en unit. Aquí se prueba un caso por código de respuesta del
        contrato y se valida que la forma de la respuesta coincida con el OpenAPI. El reporte
        contract-coverage.json alimenta la tabla de endpoints que aparece en el PR.
    """)

    type_slide(d, "Fuzzing de API desde el contrato", [
        ("Qué es", "Genera cientos de requests a partir del OpenAPI: valores límite, tipos raros, strings enormes."),
        ("Qué detecta", "Respuestas 500, respuestas que no cumplen el schema y validaciones que faltan."),
        ("Herramienta", "Schemathesis (property-based testing sobre OpenAPI)."),
        ("Dónde corre", "Etapa 9 · sistema, contra el stack levantado con Docker."),
        ("Libro", "Tests generados desde specs, cap. 3. Seguridad de APIs, cap. 7."),
    ], """
$ schemathesis run specs/api/openapi.yaml \\
    --url http://localhost:3001 \\
    --checks all \\
    --max-examples 50

POST /api/loans        ✓ 50 casos
GET  /api/books        ✓ 50 casos
POST /api/books        ✗ 1 falla
  not_a_server_error: 500 con
  {"title": "", "totalCopies": 51}

# La IA no escribe estos casos: el contrato
# ya describe el espacio de entradas.""", "etapa 9 del pipeline", lang="sh", notes="""
        Esta es la forma sana de generar muchos casos: no con un LLM que escribe 500 tests que hay que
        mantener, sino con una herramienta determinista que explora el espacio de entradas del contrato
        cada vez que corre. Schemathesis lee el OpenAPI y genera requests con valores límite y tipos
        inesperados. Detecta respuestas 500 y respuestas que no cumplen el schema. No queda código que
        mantener: si cambia el contrato, cambian los casos.
    """)

    s = d.content("Mock server: el frontend se prueba sin backend")
    d.box(s, 0.45, 1.2, 1.75, 0.8, paras=["**Next.js**", "componentes y hooks"], fill=ORANGE, size=10,
          space_after=0)
    d.box(s, 2.55, 1.2, 1.75, 0.8, paras=["**MSW**", "intercepta /api/*"], fill=AQUA, size=10, space_after=0)
    d.box(s, 0.45, 2.3, 3.85, 0.42, "Backend: no hace falta", fill="E4E7EC", color=GRAY, size=10)
    d.line(s, 2.22, 1.6, 2.53, 1.6, color=INK, width=2)
    d.text(s, 0.45, 2.95, 3.85, 2.0, [
        "Intercepta las requests en el navegador (Service Worker) y en Node.",
        "Los mismos handlers sirven para componentes, E2E y desarrollo local.",
        "Se activa con `NEXT_PUBLIC_API_MOCKING`. La app no sabe que está mockeada (ARCH-R8).",
        "Sus respuestas se validan contra el OpenAPI (handlers.contract.test.ts).",
    ], size=10, bullets=True, space_after=4)
    d.code(s, 4.45, 1.15, 5.1, 3.8, """
http.post('*/api/loans', async ({ request }) => {
  // ... valida el body: 400 VALIDATION_ERROR
  const state = store.read()
  const book = findBook(state, bookId)
  if (!book) {
    return problem(404, 'BOOK_NOT_FOUND',
      'No existe el libro solicitado')
  }
  const notReturned = state.loans.filter((l) =>
    l.borrowerEmail === email && l.returnedAt === null)
  if (notReturned.some((l) => l.bookId === bookId)) {
    return problem(409, 'DUPLICATE_LOAN',
      `${email} ya tiene prestado este libro`)
  }
  if (notReturned.length >= MAX_ACTIVE_LOANS) {
    return problem(409, 'LOAN_LIMIT_REACHED',
      `${email} ya tiene 3 préstamos activos`)
  }
  // ... NO_COPIES_AVAILABLE y 201 con el reloj fijo
})""", lang="ts", title="frontend/src/mocks/handlers.ts (extracto)")
    d.notes(s, """
        Idea clave de esta diapositiva: para probar el frontend no hace falta levantar el
        backend. MSW, Mock Service Worker, intercepta las requests a nivel de red: en el navegador con un
        Service Worker y en Node con un interceptor. La app hace fetch normal y no sabe que está mockeada.
        Los mismos handlers sirven para los tests de componentes, para los E2E de Playwright en CI y para
        desarrollar sin backend. Y como los handlers se validan contra el OpenAPI, no pueden inventar
        respuestas que el backend nunca daría.
    """)

    type_slide(d, "Componentes con Vitest, Testing Library y MSW", [
        ("Qué es", "Renderiza un componente en jsdom y lo usa como persona: escribe, hace clic, lee lo que aparece."),
        ("Qué detecta", "Estados de UI incorrectos: errores mal mostrados, botones habilitados de más."),
        ("Herramienta", "Vitest, Testing Library, user-event y MSW en Node."),
        ("Dónde corre", "Etapa 5 · unit del frontend. Segundos, sin navegador."),
        ("Libro", "Estrategia de testing frontend, p. 187."),
    ], """
/** server.use() reemplaza el handler solo en este test:
 *  así forzamos cada 409 del contrato. */
function respondWithConflict(code: string) {
  server.use(
    http.post('*/api/loans', () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Conflict',
          status: 409, code, detail: code },
        { status: 409, headers:
          { 'Content-Type': 'application/problem+json' } },
      ),
    ),
  )
}

it('[UI-LOAN-4] LOAN_LIMIT_REACHED muestra "Alcanzaste..."',
  async () => {
    respondWithConflict('LOAN_LIMIT_REACHED')
    await borrow() // escribe el correo y hace clic
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Alcanzaste el máximo de 3 préstamos activos',
    )
  })""", "frontend/src/features/loans/components/BorrowForm.test.tsx", lang="tsx", notes="""
        En el frontend la mayoría de los casos se prueban a nivel de componente: rápido y sin navegador
        real. Fíjate en server.use: para este test el mock server responde 409 y verificamos que la persona
        ve el mensaje exacto de la spec, UI-LOAN-4. Las consultas son por rol y por etiqueta, como las usaría
        una persona o un lector de pantalla, no por clases CSS. Esto es behaviour testing, como vimos en la
        clase de frontend.
    """)

    type_slide(d, "E2E de flujos con Playwright", [
        ("Qué es", "Un navegador real recorre el flujo completo del usuario, escrito en Gherkin."),
        ("Qué detecta", "Integración entre páginas, rutas y estado: lo que unit y componentes no ven."),
        ("Herramienta", "Playwright con playwright-bdd. Contra Next y MSW, sin backend."),
        ("Dónde corre", "Etapa 7 con mock server. Los @smoke también en etapa 9 contra el stack real."),
        ("Libro", "UI tests y Playwright, p. 71 y 83 a 95."),
    ], """
// Los flujos de specs/flows/*.feature se convierten en
// tests (npx bddgen): la spec ES el test.
const flowsDir = defineBddConfig({
  features: '../specs/flows/*.feature',
  steps: ['tests/e2e/fixtures.ts', 'tests/e2e/steps/*.ts'],
  language: 'es',
  missingSteps: 'fail-on-gen',
})

export default defineConfig({
  use: { baseURL, locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure' },
  projects: [
    { name: 'flows', testDir: flowsDir,
      use: { video: { mode: 'on' } } },
    { name: 'visual', testDir: 'tests/visual' },
    { name: 'style', testDir: 'tests/style' },
    { name: 'layout', testDir: 'tests/layout' },
    { name: 'a11y', testDir: 'tests/a11y' },
  ],
})""", "frontend/playwright.config.ts (extracto)", notes="""
        Los E2E son pocos y recorren flujos, no validan campos. Cada escenario de los archivos feature es un
        test. En la etapa 7 corren contra Next con MSW, sin backend, así que son rápidos y estables. Los
        marcados smoke corren otra vez en la etapa 9 contra el stack real con PostgreSQL. Fíjate en la
        configuración: screenshot y video siempre activados. Eso es lo que después se publica como
        evidencia en el PR.
    """)

    type_slide(d, "Visual regression con capturas", [
        ("Qué es", "Compara una captura actual con una referencia aprobada, píxel a píxel."),
        ("Qué detecta", "Cambios visuales no intencionales: espaciado, fuentes, elementos que desaparecen."),
        ("Herramienta", "Playwright toHaveScreenshot (usa pixelmatch). Referencias generadas en Linux."),
        ("Dónde corre", "Etapa 7 · E2E con mock server. Datos y reloj fijos."),
        ("Libro", "Visual testing, cap. 6, p. 183 y 195."),
    ], """
// Referencias generadas en Linux, en la imagen Docker de
// Playwright (fuentes y render idénticos a CI)
test('[UI-CAT-4] catálogo completo en escritorio',
  async ({ page }) => {
    await openCatalog(page)
    await expect(page).toHaveScreenshot(
      'catalogo-escritorio.png', { fullPage: true })
  })

test('[UI-CAT-2] tarjeta de un libro agotado',
  async ({ page }) => {
    await openCatalog(page)
    await expect(bookCard(page, 'La casa de los espíritus'))
      .toHaveScreenshot('tarjeta-agotada.png')
  })

// playwright.config.ts
ignoreSnapshots: process.platform !== 'linux',
expect: {
  toHaveScreenshot: { animations: 'disabled',
    caret: 'hide', maxDiffPixelRatio: 0.01 },
},""", "frontend/tests/visual/catalog.visual.spec.ts", notes="""
        El capítulo 6 del libro trata visual testing. Playwright trae toHaveScreenshot, que compara contra
        una referencia usando pixelmatch. Tres consejos prácticos: las referencias se generan en el mismo
        sistema operativo que el CI (por eso en contenedor Linux), los datos y el reloj tienen que ser fijos,
        y actualizar una referencia es un cambio que alguien revisa en el PR, no un comando que se corre
        para que el CI quede verde.
    """)

    s = d.content("Estilos y posición: cambió el color, se movió la insignia")
    d.code(s, 0.45, 1.15, 5.45, 3.8, """
// Color: estilo computado contra el token de la spec
test('[UI-CAT-2] la insignia "Agotado" es roja ...',
  async ({ page }) => {
    const badge = availabilityBadge(page,
      'La casa de los espíritus')
    await expect(badge).toHaveText('Agotado')
    await expect(badge).toHaveCSS('background-color',
      'rgb(180, 35, 24)') // #B42318
  })

// Posición: cajas comparadas entre sí, no píxeles
test('[UI-CAT-4] la insignia queda en la esquina ...',
  async ({ page }) => {
    const [card] = await boxes(page.getByRole('article',
      { name: title, exact: true }))
    const [badge] = await boxes(availabilityBadge(page, title))
    const gapRight = card.x + card.width
      - (badge.x + badge.width)
    expect(gapRight).toBeLessThanOrEqual(32)
    expect(badge.y - card.y).toBeLessThanOrEqual(32)
  })""", lang="ts", title="frontend/tests/style y tests/layout (extracto)")
    # tarjeta dibujada a partir de la captura real
    d.box(s, 6.15, 1.3, 3.4, 1.85, "", fill=WHITE, line=BORDER, line_w=1.25)
    d.text(s, 6.3, 1.42, 2.1, 0.5, "La casa de los espíritus", size=10, bold=True)
    d.text(s, 6.3, 1.95, 1.9, 0.3, "Isabel Allende", size=9, color=GRAY)
    d.text(s, 6.3, 2.22, 2.2, 0.3, "ISBN 978-00-633-7677-9", size=8, color=MUTED)
    d.box(s, 8.5, 1.42, 0.92, 0.3, "Agotado", fill="B42318", size=9)
    d.box(s, 6.3, 2.62, 1.3, 0.36, "Pedir prestado", fill="E4E7EC", color=GRAY, size=8.5)
    d.line(s, 9.42, 1.18, 9.42, 1.4, color=PURPLE, width=1.25, head=True, tail=True)
    d.text(s, 7.6, 0.98, 1.75, 0.22, "≤ 32 px", size=8.5, color=PURPLE, bold=True, align="r")
    d.text(s, 6.15, 3.3, 3.4, 1.65, [
        "**toHaveCSS** fija el color del token de diseño (UI-CAT-2) y el gris del botón deshabilitado (UI-CAT-3).",
        "**boundingBox** fija la posición: insignia arriba a la derecha y grilla de 3 columnas en 1280 px, 1 en "
        "390 px (UI-CAT-4).",
    ], size=9.5, bullets=True, space_after=4)
    d.notes(s, """
        ¿Cómo verificar que algo cambió de color o de posición? Una captura completa detecta
        todo, pero falla por cualquier píxel y no dice qué se rompió. Estas pruebas son más precisas:
        toHaveCSS verifica que la insignia Agotado tenga exactamente el rojo del token de diseño #B42318, y
        boundingBox verifica que la insignia esté en la esquina superior derecha de la tarjeta y que la
        grilla tenga 3 columnas en escritorio y 1 en móvil. Cuando fallan, el mensaje dice exactamente qué
        regla de la spec se rompió.
    """)

    type_slide(d, "Accesibilidad", [
        ("Qué es", "Audita la página contra reglas WCAG: contraste, etiquetas, roles, foco."),
        ("Qué detecta", "Inputs sin label, contraste insuficiente, imágenes sin texto alternativo."),
        ("Herramienta", "axe-core con @axe-core/playwright. Lighthouse para el puntaje general."),
        ("Dónde corre", "Etapa 7, junto a los E2E con mock server."),
        ("Libro", "Cap. 9: Lighthouse p. 295, axe-core p. 297, Pa11y p. 302."),
    ], """
// Cero violaciones WCAG 2.0 y 2.1, nivel A y AA. No reemplaza
// la revisión manual con teclado y lector de pantalla.
async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.length})`)
  expect(summary).toEqual([])
}

test('[UI-CAT-1] el catálogo no tiene violaciones WCAG A/AA',
  async ({ page }) => {
    await openCatalog(page)
    await expectNoViolations(page)
  })""", "frontend/tests/a11y/pages.a11y.spec.ts (extracto)", notes="""
        Accesibilidad, capítulo 9 del libro. axe-core es el motor que usan muchas herramientas, y con
        @axe-core/playwright se integra en los mismos E2E. Detecta problemas objetivos como inputs sin
        etiqueta o contraste insuficiente, que en este proyecto importa porque los estados usan colores.
        Pero el libro es claro: la auditoría automática no reemplaza probar con teclado y lector de pantalla.
    """)

    type_slide(d, "Performance", [
        ("Qué es", "Mide tiempos de carga del frontend y latencia de la API bajo carga."),
        ("Qué detecta", "Regresiones de rendimiento: bundles que crecen, endpoints que se vuelven lentos."),
        ("Herramienta", "k6 contra la API y Lighthouse para el frontend. El libro usa JMeter y Gatling."),
        ("Dónde corre", "Etapa 9, contra el stack real. La carga de verdad va en un ambiente dedicado."),
        ("Libro", "Cap. 8: JMeter p. 254, Gatling p. 261, Lighthouse p. 270."),
    ], """
// No es una prueba de carga: 5 usuarios virtuales durante
// 20 segundos contra el stack real (etapa 9).
export const options = {
  vus: 5,
  duration: '20s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
}

// Cada iteración: listar el catálogo, prestar, ver mis
// préstamos y devolver.
export default function ({ bookId }) {
  const email = `k6-${__VU}-${__ITER}@uc.cl`
  const list = http.get(`${BASE_URL}/api/books`,
    { tags: { name: 'listBooks' } })
  check(list, { 'listBooks 200': (r) => r.status === 200 })
  // ...
}""", "tools/perf/k6-smoke.js (extracto)", lang="js", notes="""
        Performance, capítulo 8. El libro muestra JMeter y Gatling para APIs y Lighthouse para frontend, con
        un dato muy bueno: Zalando bajó su feedback de performance de un día a 15 minutos con Lighthouse CI
        (p. 270). Aquí usamos k6 porque los scripts son JavaScript. En el PR corre una prueba de humo: 5
        usuarios virtuales durante 20 segundos, con umbrales de percentil 95 bajo 500 milisegundos y menos de
        1 por ciento de errores. Detecta regresiones gruesas, como una consulta sin índice. Las pruebas de
        carga de verdad necesitan un ambiente dedicado.
    """)

    type_slide(d, "Mutation testing: de noche, no en cada PR", [
        ("Qué es", "Introduce bugs pequeños (mutantes) y revisa si algún test falla."),
        ("Qué detecta", "Tests que no verifican nada, valores límite sin cubrir, oráculos débiles."),
        ("Herramienta", "Stryker (StrykerJS) con Jest y Vitest."),
        ("Dónde corre", "Nightly, backend y frontend. Su reporte mejora los tests, no bloquea PR."),
        ("Libro", "Code coverage y mutation testing, p. 116 a 117."),
    ], """
// Es lento (corre los tests muchas veces), por eso va en
// el pipeline nightly y no en cada PR.
const config = {
  testRunner: 'jest',
  jest: {
    configFile: 'jest.unit.config.js',
    enableFindRelatedTests: true,
  },
  mutate: [
    'src/**/domain/**/*.ts',
    'src/**/application/**/*.ts',
    '!src/**/*.spec.ts',
  ],
  coverageAnalysis: 'perTest',
  thresholds: { high: 85, low: 70, break: 60 },
}

// En un PR puntual: npx stryker run --incremental""", "backend/stryker.config.mjs (extracto)", lang="js", notes="""
        ¿Tiene sentido la mutación en el pipeline? Sí, pero no completa en cada PR, porque es lenta: el
        libro dice que es muy efectiva pero consume tiempo y hay que usarla con criterio. La respuesta de la
        industria es la de Google: mutar solo las líneas cambiadas durante el code review. Aquí corre
        completa en el pipeline nocturno y en modo incremental cuando se pide. Se muta solo dominio y
        aplicación, que es donde están las reglas, y el build falla si el puntaje baja de 60. El reporte es
        la mejor medida de si una suite generada por IA sirve.
    """)

    type_slide(d, "Revisión de código con IA basada en las specs", [
        ("Qué es", "Un agente revisa el diff del PR contra la constitución, la arquitectura y el SPEC.md de cada capa."),
        ("Qué detecta", "Tests sin ID o en la capa equivocada, mocks sin justificar, capas cruzadas, secretos."),
        ("Herramienta", "Claude Code Action en GitHub Actions. Otro modelo como juez."),
        ("Dónde corre", "En cada PR. Solo comenta. Sin el secreto (PR desde forks) termina en verde."),
        ("Libro", "Reviewer agent y LLM-as-judge p. 103. Claude en Actions p. 139."),
    ], """
- name: Revisar el PR con Claude
  uses: anthropics/claude-code-action@925afb5 # v1.0.262
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: |
      1. Lee primero specs/constitution.md (P4 y P5),
         specs/architecture.md (ARCH-R1 a ARCH-R8), las
         specs de features y el SPEC.md de cada capa.
      2. Obtén el diff con `gh pr diff` y revisa SOLO
         lo que cambió.
      3. Política de tests (P4): tests sin ID, más de 6
         por regla y capa, mocks sin justificación,
         tests duplicados entre capas ...
      4. Comenta en línea citando el ID de la regla.
      5. Deja UN resumen con veredicto.
    claude_args: |
      --max-turns 30""", ".github/workflows/ai-review.yml (extracto)", lang="yaml", notes="""
        El revisor de IA es un chatbot de code review, pero con una diferencia importante: no
        revisa con criterio genérico, revisa contra las reglas escritas en las specs y cita el ID de la regla
        que se incumple. El libro describe este patrón como reviewer agent y LLM as the judge: un modelo
        distinto al que generó el código evalúa con criterios explícitos y puntaje de 0 a 1. Solo comenta,
        la decisión de merge es humana. Y si el repo es público, el secreto de la API no está disponible en
        PRs desde forks, así que el job tiene que tolerar esa ausencia.
    """)


# ============================================================================
# F. DevSecOps y CI
# ============================================================================
def part_f(d: Deck):
    d.section("5. DevSecOps y CI")
    s = d.divider("Parte 5", "DevSecOps y CI", "Seguridad en cada etapa, ramas cortas y un pipeline que explica sus decisiones.")
    d.notes(s, "Quinta parte: DevSecOps, estrategias de ramas y el pipeline del repo etapa por etapa.")

    s = d.content("DevSecOps: seguridad en todo el ciclo")
    import math

    def loop(cx, cy, rx, ry, col):
        d.box(s, cx - rx, cy - ry, 2 * rx, 2 * ry, "", fill=None, line=col, line_w=7, shape="oval")

    cyc = 2.85
    loop(3.05, cyc, 1.75, 1.15, TEAL)
    loop(6.95, cyc, 1.75, 1.15, ORANGE)
    d.box(s, 4.5, cyc - 0.42, 1.0, 0.84, "Sec", fill=RED, size=15, shape="oval")
    stages = [
        ("Plan", 3.05, cyc - 1.15, TEAL), ("Code", 1.3, cyc - 0.45, TEAL), ("Build", 1.3, cyc + 0.45, TEAL),
        ("Test", 3.05, cyc + 1.15, TEAL), ("Release", 6.95, cyc - 1.15, ORANGE), ("Deploy", 8.7, cyc - 0.45, ORANGE),
        ("Operate", 8.7, cyc + 0.45, ORANGE), ("Monitor", 6.95, cyc + 1.15, ORANGE),
    ]
    for name, x, y, col in stages:
        d.box(s, x - 0.55, y - 0.2, 1.1, 0.4, name, fill=WHITE, color=col, line=col, line_w=2, size=11)
    d.text(s, 2.25, cyc - 0.2, 1.6, 0.4, "Dev", size=16, bold=True, color=TEAL, align="c", anchor="m")
    d.text(s, 6.15, cyc - 0.2, 1.6, 0.4, "Ops", size=16, bold=True, color=ORANGE, align="c", anchor="m")
    d.text(s, 0.45, 4.42, 9.1, 0.5, "Cada etapa tiene un control de seguridad automático. La seguridad deja de "
           "ser una revisión al final y pasa a ser parte del flujo.", size=11, align="c", color=GRAY)
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
        ["Plan", "Modelado de amenazas (STRIDE, p. 213), reglas de validación en la spec", "specs con códigos de error"],
        ["Code", "Secretos antes del commit (Talisman, p. 238), revisión con IA", "gitleaks, revisor IA"],
        ["Build", "SAST y análisis de dependencias (SCA)", "Semgrep, CodeQL, Trivy fs"],
        ["Test", "DAST y fuzzing contra la app corriendo", "OWASP ZAP, Schemathesis"],
        ["Release", "Escaneo de imagen y SBOM", "Trivy image, SBOM CycloneDX"],
        ["Deploy", "Dockerfile, compose y workflows como código", "hadolint, actionlint, zizmor"],
        ["Operate", "Contenedores sin root, mínimo privilegio", "USER node en los Dockerfile"],
        ["Monitor", "CVE nuevas sobre lo ya liberado", "Fuera de alcance (no hay CD)"],
    ]
    d.table(s, 0.45, 1.15, 9.1, rows, [1.0, 4.9, 3.2], row_h=0.405, size=10, first_col_bold=True)
    d.notes(s, """
        Esta tabla baja DevSecOps a tierra. En Plan, modelado de amenazas con STRIDE, que el libro explica en
        el capítulo 7. En Code, evitar que un secreto llegue al repo, con un pre-commit como Talisman o con
        gitleaks. En Build, análisis estático y de dependencias. En Test, ataques reales contra la app
        corriendo. En Release, escanear la imagen y generar el SBOM. Deploy y Operate quedan fuera porque hoy
        no hacemos CD, pero los Dockerfile ya corren sin root. Monitor: una dependencia que hoy está limpia
        mañana puede tener una CVE nueva, por eso hay escaneo nocturno.
    """)

    s = d.content("Shift left: mover las pruebas al inicio")
    # curva costo
    d.line(s, 0.8, 4.4, 5.6, 4.4, color=INK, width=1.5)
    d.line(s, 0.8, 4.4, 0.8, 1.3, color=INK, width=1.5)
    for i, lab in enumerate(["Requisitos", "Diseño", "Código", "Test", "Producción"]):
        d.text(s, 1.05 + i * 0.95 - 0.25, 4.47, 1.1, 0.28, lab, size=9, color=GRAY, align="c")
    d.text(s, 0.2, 1.25, 0.55, 0.9, "Costo", size=9.5, color=GRAY)
    heights = [0.25, 0.45, 0.8, 1.5, 2.8]
    for i, hgt in enumerate(heights):
        x = 1.05 + i * 0.95
        col = GREEN if i < 3 else (ORANGE if i == 3 else RED)
        d.box(s, x, 4.38 - hgt, 0.6, hgt, "", fill=col, shape="rect")
    d.line(s, 4.9, 1.6, 2.0, 1.6, color=PURPLE, width=3)
    d.text(s, 2.0, 1.25, 2.9, 0.3, "shift left", size=12, bold=True, color=PURPLE, align="c")
    d.card(s, 6.0, 1.2, 3.55, 3.65, fill=LIGHT)
    d.text(s, 6.2, 1.3, 3.2, 0.3, "En el día a día", size=12, bold=True, color=TEAL)
    d.text(s, 6.2, 1.7, 3.2, 3.1, [
        "Kickoff de la historia con los tres amigos: negocio, desarrollo y testing.",
        "La IA como **cuarto amigo**: propone casos y amenazas para discutir.",
        "Tests automáticos en el PR, no en una fase de QA al final.",
        "La seguridad también se mueve a la izquierda.",
    ], size=10.5, bullets=True, space_after=6)
    d.text(s, 0.45, 4.8, 5.4, 0.28, "Libro, p. 4 a 6", size=9, color=MUTED)
    d.notes(s, """
        Shift left es la idea central del libro: hacer las pruebas al principio y durante todo el desarrollo
        en vez de al final, porque un defecto cuesta más mientras más tarde se encuentra. El libro lo baja a
        prácticas: un kickoff de cada historia con negocio, desarrollo y testing, los tres amigos, y propone
        sumar a la IA como cuarto amigo, para proponer casos y amenazas que el equipo discute. Fíjate en la
        palabra discute: la IA aporta ideas, el equipo decide.
    """)

    s = d.content("Git Flow")
    lanes = [("main", 1.35, TEAL), ("hotfix", 1.9, RED), ("release", 2.45, ORANGE), ("develop", 3.0, PLUM),
             ("feature/a", 3.55, GREEN), ("feature/b", 4.1, GREEN)]
    for name, y, col in lanes:
        d.chip(s, 0.45, y - 0.15, 1.15, 0.3, name, fill=col, size=9.5)
        d.line(s, 1.75, y, 9.5, y, color="C9D1D9", width=1.25, head=False)
    Y = {n: y for n, y, _ in lanes}
    COL = {n: c for n, _, c in lanes}

    def commit(lane, x):
        d.box(s, x - 0.11, Y[lane] - 0.11, 0.22, 0.22, "", fill=COL[lane], shape="oval")

    def link(l1, x1, l2, x2):
        d.line(s, x1 + 0.08, Y[l1] + (0.08 if Y[l2] > Y[l1] else -0.08), x2 - 0.08,
               Y[l2] + (-0.08 if Y[l2] > Y[l1] else 0.08), color=COL[l2] if Y[l2] > Y[l1] else COL[l1],
               width=1.5)

    for x in (2.0, 5.2, 8.9):
        commit("main", x)
    for x in (2.4, 3.6, 5.6, 6.6, 8.5, 9.3):
        commit("develop", x)
    for x in (2.9, 3.25):
        commit("feature/a", x)
    for x in (4.1, 4.7, 6.1):
        commit("feature/b", x)
    commit("hotfix", 4.5)
    for x in (7.3, 7.9):
        commit("release", x)
    link("main", 2.0, "develop", 2.4)
    link("develop", 2.4, "feature/a", 2.9)
    link("feature/a", 3.25, "develop", 3.6)
    link("develop", 3.6, "feature/b", 4.1)
    link("main", 3.9, "hotfix", 4.5)
    link("hotfix", 4.5, "main", 5.2)
    link("hotfix", 4.5, "develop", 5.6)
    link("feature/b", 6.1, "develop", 6.6)
    link("develop", 6.6, "release", 7.3)
    link("release", 7.9, "main", 8.9)
    link("release", 7.9, "develop", 8.5)
    for x, tag in ((2.0, "v1.0"), (5.2, "v1.0.1"), (8.9, "v1.1")):
        d.text(s, x - 0.4, 1.0, 0.8, 0.25, tag, size=8.5, bold=True, color=TEAL, align="c")
    d.text(s, 0.45, 4.45, 9.1, 0.55, "Ramas de larga vida (main y develop), features que duran semanas y "
           "releases programados. Útil cuando mantienes varias versiones en producción a la vez.", size=10.5,
           align="c", color=GRAY)
    d.notes(s, """
        Git Flow, de Vincent Driessen, 2010. Dos ramas permanentes: main con lo liberado y develop con lo
        integrado. Las features salen de develop y vuelven cuando terminan, que puede ser semanas después.
        Para liberar se crea una rama release que se estabiliza y se fusiona a main y a develop. Los
        hotfix salen de main. Funciona cuando hay versiones numeradas que conviven, por ejemplo una app
        móvil o una librería. El costo: integración tardía y merges grandes.
    """)

    s = d.content("Trunk Based Development")
    y0 = 2.5
    d.chip(s, 0.45, y0 - 0.15, 1.15, 0.3, "main", fill=TEAL, size=9.5)
    d.line(s, 1.75, y0, 9.5, y0, color=TEAL, width=3, head=True)
    xs = [2.1, 2.9, 3.7, 4.5, 5.3, 6.1, 6.9, 7.7, 8.5]
    for i, x in enumerate(xs):
        d.box(s, x - 0.12, y0 - 0.12, 0.24, 0.24, "", fill=TEAL, shape="oval")
        d.box(s, x - 0.13, y0 - 0.62, 0.26, 0.26, "✓", fill=GREEN, size=8, shape="oval", margin=0)
    for x in (2.1, 3.7, 5.3, 6.9):
        d.line(s, x + 0.05, y0 + 0.1, x + 0.3, y0 + 0.65, color=GREEN, width=1.5, head=False)
        d.box(s, x + 0.25, y0 + 0.58, 0.18, 0.18, "", fill=GREEN, shape="oval")
        d.line(s, x + 0.45, y0 + 0.62, x + 0.74, y0 + 0.12, color=GREEN, width=1.5)
    d.text(s, 2.0, y0 + 0.8, 5.5, 0.3, "ramas cortas: horas, máximo 2 días (constitución P6)", size=10,
           color=GREEN, bold=True)
    d.text(s, 2.0, y0 - 1.0, 6.0, 0.3, "CI completo en cada PR y en cada merge a main", size=10, color=GREEN,
           bold=True)
    d.card(s, 0.45, 3.75, 4.45, 1.15, fill=LIGHT)
    d.text(s, 0.6, 3.82, 4.15, 1.05, [
        "**Feature flags**: lo incompleto se integra apagado. `renewals: off` hasta que la feature esté lista.",
    ], size=10.5)
    d.card(s, 5.1, 3.75, 4.45, 1.15, fill=LIGHT)
    d.text(s, 5.25, 3.82, 4.15, 1.05, [
        "**main siempre verde**: si el pipeline falla, arreglarlo es la prioridad del equipo.",
    ], size=10.5)
    d.notes(s, """
        Trunk based development: todos integran a main, el tronco, en ramas que duran horas o a lo más un
        par de días. La constitución del proyecto lo fija en menos de 2 días. Cada PR corre el pipeline
        completo y main tiene que estar siempre verde. Lo que no está terminado se integra igual, pero
        apagado detrás de un feature flag, por ejemplo la renovación de préstamos que harán en la actividad.
        El libro lo dice al hablar de control de versiones: una rama de feature de larga vida es un
        antipatrón.
    """)

    s = d.content("¿Git Flow o trunk based?")
    rows = [
        ["", "Git Flow", "Trunk Based"],
        ["Vida de las ramas", "Semanas", "Horas o pocos días"],
        ["Integración", "Al final, merges grandes", "Continua, lotes pequeños"],
        ["Releases", "Programados, rama release", "Cuando quieras, desde main"],
        ["Lo incompleto", "Vive en la rama", "Detrás de feature flags"],
        ["Conviene si", "Varias versiones vivas a la vez", "Servicio web con CI confiable"],
    ]
    d.table(s, 0.45, 1.15, 5.7, rows, [1.6, 2.05, 2.05], row_h=0.46, size=10.5, first_col_bold=True)
    d.card(s, 6.4, 1.15, 3.15, 3.75, fill=LIGHTBLUE)
    d.text(s, 6.55, 1.25, 2.85, 0.3, "Por qué el CI moderno empuja TBD", size=11.5, bold=True, color=TEAL)
    d.text(s, 6.55, 1.65, 2.85, 3.2, [
        "DORA: lead time, frecuencia de despliegue, tiempo de recuperación, tasa de fallas y retrabajo (p. 144).",
        "Los equipos de alto desempeño despliegan varias veces al día y se recuperan en menos de una hora.",
        "Con IA se escribe más código por día: con ramas largas, los merges explotan.",
    ], size=10, bullets=True, space_after=6)
    d.text(s, 0.45, 4.05, 5.7, 0.8, "Lotes pequeños = PR pequeños = evidencia que alguien sí alcanza a revisar.",
           size=11, bold=True, color=INK)
    d.notes(s, """
        Comparación directa. Git Flow tiene sentido con varias versiones vivas, por ejemplo apps instaladas
        que no se actualizan solas. Para un servicio web con CI confiable, trunk based gana. Las métricas
        DORA del libro (p. 144) lo explican: lead time corto y despliegues frecuentes requieren lotes
        pequeños. Y con IA esto se vuelve más importante: si cada persona produce el triple de código, las
        ramas largas generan conflictos enormes y PRs que nadie revisa de verdad. Pregunta para el curso:
        ¿qué usan hoy en el proyecto del curso?
    """)

    s = d.content("¿Qué es esto? Las siglas de la seguridad")
    cards = [
        ("SAST", "Static Application Security Testing", "Analiza el código fuente sin ejecutarlo.",
         "Inyección SQL, XSS, APIs inseguras", "Revisar los planos"),
        ("DAST", "Dynamic Application Security Testing", "Ataca la app corriendo, desde afuera, por HTTP.",
         "Headers faltantes, cookies inseguras, errores que filtran datos", "Probar las puertas del edificio"),
        ("SCA", "Software Composition Analysis", "Revisa tus dependencias contra bases de CVE.",
         "Librerías vulnerables, licencias", "Revisar los materiales comprados"),
        ("Secretos", "Secret scanning", "Busca llaves y tokens en el código y en el historial de git.",
         "Tokens de GitHub, llaves de AWS, .env", "Llaves olvidadas en la puerta"),
        ("IaC", "Infraestructura y contenedores", "Revisa Dockerfile, compose y configuración.",
         "Contenedor como root, versiones sin fijar", "Revisar las instalaciones"),
        ("SBOM", "Software Bill of Materials", "Inventario de todo lo que va dentro del artefacto.",
         "Responde: ¿nos afecta la CVE de hoy?", "La lista de ingredientes"),
    ]
    cols = [RED, RED, ORANGE, RED, ORANGE, PLUM]
    for i, (ab, full, what, finds, analog) in enumerate(cards):
        x = 0.45 + (i % 3) * 3.07
        y = 1.12 + (i // 3) * 1.9
        d.card(s, x, y, 2.95, 1.78, fill=LIGHT)
        d.text(s, x + 0.12, y + 0.06, 1.4, 0.4, ab, size=17, bold=True, color=cols[i], font=k.FONT_TITLE)
        d.text(s, x + 1.25, y + 0.08, 1.6, 0.4, full, size=8, color=GRAY, align="r", anchor="m")
        d.text(s, x + 0.12, y + 0.5, 2.7, 0.42, what, size=9.5, color=INK)
        d.text(s, x + 0.12, y + 0.95, 2.7, 0.42, f"**Detecta:** {finds}", size=9, color=INK)
        d.text(s, x + 0.12, y + 1.4, 2.7, 0.3, f"Analogía: {analog}", size=9, color=cols[i], italic=True)
    d.notes(s, """
        Esta es la diapositiva de qué es esto. SAST analiza el código sin ejecutarlo, como revisar los
        planos de un edificio. DAST ataca la aplicación ya corriendo, desde afuera, como probar las puertas
        del edificio terminado. SCA revisa las dependencias, los materiales que compraste. El escaneo de
        secretos busca llaves y tokens, también en el historial de git, porque borrar un archivo no borra
        el commit. IaC revisa la infraestructura como código, por ejemplo un Dockerfile que corre como root.
        Y el SBOM es la lista de ingredientes: cuando sale una CVE nueva, responde en minutos si te afecta.
    """)

    s = d.content("¿Qué es esto? Las herramientas del pipeline")
    rows = [
        ["Herramienta", "Tipo", "Qué detecta", "Etapa"],
        ["gitleaks", "Secretos", "Llaves y tokens en commits y en el historial", "1"],
        ["Semgrep", "SAST", "Patrones inseguros con reglas legibles, también reglas propias", "3"],
        ["CodeQL", "SAST", "Flujo de datos: un input que llega a una consulta o a la respuesta", "3"],
        ["Dependency Review", "SCA", "Dependencias nuevas del PR con CVE o licencia no permitida", "4"],
        ["Trivy", "SCA, secretos, IaC", "CVE en node_modules y en la imagen, Dockerfile mal configurado", "4 y 8"],
        ["hadolint, zizmor", "IaC y CI", "Dockerfile con malas prácticas, workflows de Actions inseguros", "2"],
        ["SBOM (CycloneDX)", "SBOM", "Inventario del artefacto, se adjunta al run", "8"],
        ["OWASP ZAP", "DAST", "Headers, cookies, errores y ataques sobre la API corriendo", "9"],
        ["Schemathesis", "Fuzzing", "Respuestas 500 y desvíos del contrato", "9"],
    ]
    d.table(s, 0.45, 1.12, 9.1, rows, [1.75, 1.6, 5.0, 0.75], row_h=0.37, size=10, first_col_bold=True,
            align=["l", "l", "l", "c"])
    d.notes(s, """
        Y estas son las herramientas concretas del pipeline. gitleaks para secretos. Semgrep y CodeQL para
        SAST: Semgrep con reglas legibles, incluso reglas propias del curso, y CodeQL con análisis de flujo de
        datos. Dependency Review y Trivy para dependencias. Trivy es la navaja suiza: escanea dependencias,
        secretos, configuración e imágenes. hadolint revisa el Dockerfile. El SBOM se genera en formato
        CycloneDX. OWASP ZAP es el DAST, el libro lo trabaja en la p. 229. Y Schemathesis hace fuzzing desde
        el contrato. Los resultados en formato SARIF aparecen en la pestaña Security de GitHub.
    """)

    type_slide(d, "SAST con reglas de la spec: Semgrep", [
        ("Qué es", "Análisis estático con reglas propias que convierten decisiones de la spec en chequeos."),
        ("Qué detecta", "Hora del sistema en el dominio, SQL concatenado, fetch en componentes, "
         "dangerouslySetInnerHTML."),
        ("Herramienta", "Semgrep con reglas del registro y .semgrep/rules.yml. CodeQL para flujo de datos."),
        ("Dónde corre", "Etapa 3 · SAST. Los hallazgos llegan como SARIF a la pestaña Security."),
        ("Libro", "SAST en la estrategia de seguridad, p. 225."),
    ], r"""
- id: biblioteca-usar-clock
  languages: [typescript]
  severity: ERROR
  message: >-
    No leas la hora del sistema en domain ni application.
    Recibe la hora desde el puerto Clock (SPEC-LIB-02,
    LOAN-R6): así los tests usan un reloj fijo y el
    estado OVERDUE es determinista.
  metadata:
    rule: LOAN-R6
  paths:
    include:
      - 'backend/src/**/domain/**'
      - 'backend/src/**/application/**'
  pattern-either:
    - pattern: Date.now()
    - pattern: new Date()""", ".semgrep/rules.yml (extracto)", lang="yaml", notes="""
        Semgrep es el SAST principal del pipeline. Además de las reglas genéricas del registro, el repo tiene
        reglas propias que salen de las specs. Esta, por ejemplo, prohíbe leer la hora del sistema en el
        dominio y en la aplicación, porque LOAN-R6 calcula el estado vencido con el reloj y los tests
        necesitan un reloj fijo. Si un agente escribe new Date() en un caso de uso, el PR falla con un
        mensaje que cita la regla de la spec. Otras reglas prohíben SQL concatenado (inyección SQL) y fetch
        directo en componentes (ARCH-R7). CodeQL complementa con análisis de flujo de datos.
    """)

    type_slide(d, "DAST: OWASP ZAP contra el stack real", [
        ("Qué es", "Ataca la app corriendo desde afuera: baseline sobre el frontend y API scan guiado por el OpenAPI."),
        ("Qué detecta", "Headers de seguridad faltantes, cookies inseguras, errores que filtran información."),
        ("Herramienta", "OWASP ZAP con reglas versionadas en tools/zap/rules.tsv."),
        ("Dónde corre", "Etapa 9, contra el stack levantado con Docker. Una alerta High rompe el build."),
        ("Libro", "ZAP, p. 229. Estrategia de seguridad, p. 225."),
    ], r"""
# Formato: <id de regla> <IGNORE|WARN|FAIL> (<nombre>)
# Toda regla ignorada lleva su justificación arriba.
# Lo que no aparece queda como WARN: se informa en el PR.

# HSTS solo tiene sentido sobre HTTPS. En CI el stack
# corre en http://localhost.
10035   IGNORE  (Strict-Transport-Security Header Not Set)

# El API scan envía datos inválidos a propósito y la
# API responde 4xx según el contrato: es lo correcto.
100000  IGNORE  (A Client Error response code was returned)

# tools/zap/check-alerts.mjs rompe el build si queda
# alguna alerta High que no esté ignorada.""", "tools/zap/rules.tsv (extracto)", lang="sh", notes="""
        OWASP ZAP es el DAST: ataca la aplicación ya corriendo, por HTTP, sin mirar el código. Corre en la
        etapa 9, cuando el stack completo está levantado con Docker. Hace un baseline sobre el frontend y un
        API scan que usa el OpenAPI para saber qué endpoints atacar. Lo importante didácticamente es este
        archivo: cada alerta que se ignora tiene su justificación escrita y versionada, igual que el código.
        Así el equipo no silencia alertas sin explicar por qué. Una alerta High no ignorada rompe el build.
    """)

    s = d.content("El pipeline del repo, etapa por etapa")
    stages = [
        ("Secretos", "gitleaks sobre todo el historial", C_SEC),
        ("Calidad y spec", "lint, tipos, arquitectura, Spectral, oasdiff, spec-trace, hadolint, zizmor", C_QUAL),
        ("SAST", "Semgrep (reglas propias) y CodeQL", C_SEC),
        ("Dependencias", "dependency review, npm audit, Trivy fs", C_SEC),
        ("Unit", "dominio y aplicación sin mocks, componentes con MSW", C_TEST),
        ("Integración y contrato", "Testcontainers y supertest contra el OpenAPI", C_TEST),
        ("E2E con mock server", "Playwright + MSW: flujos, visual, estilos, layout, a11y", C_TEST),
        ("Build e imágenes", "docker build, Trivy image, SBOM", C_BUILD),
        ("Sistema y DAST", "smoke, Schemathesis, @smoke, k6, Lighthouse, ZAP", C_SEC),
        ("Evidencia en el PR", "capturas, GIF, endpoints y seguridad", C_EVID),
    ]
    w, h = 1.68, 1.12
    for i, (t, tools, col) in enumerate(stages):
        row = i // 5
        idx = i % 5 if row == 0 else 4 - (i % 5)
        x = 0.45 + idx * (w + 0.175)
        y = 1.15 + row * 1.5
        d.box(s, x, y, w, h, "", fill=LIGHT)
        d.circle_num(s, x + 0.08, y + 0.08, 0.34, i + 1, fill=col, size=10)
        d.text(s, x + 0.46, y + 0.06, w - 0.5, 0.42, t, size=9.5, bold=True, color=col, anchor="m")
        d.text(s, x + 0.08, y + 0.5, w - 0.14, 0.6, tools, size=8.5, color=INK)
        if row == 0 and idx < 4:
            d.line(s, x + w + 0.01, y + h / 2, x + w + 0.165, y + h / 2, color=MUTED, width=1.5)
        if row == 1 and idx > 0:
            d.line(s, x - 0.01, y + h / 2, x - 0.165, y + h / 2, color=MUTED, width=1.5)
    d.line(s, 0.45 + 4 * (w + 0.175) + w / 2, 1.15 + h + 0.02, 0.45 + 4 * (w + 0.175) + w / 2, 2.63,
           color=MUTED, width=1.5)
    # nightly
    d.box(s, 0.45, 4.35, 9.1, 0.62, "", fill=WHITE, line=PLUM, line_w=1.25, dash=True)
    d.text(s, 0.6, 4.35, 1.5, 0.62, "Nightly", size=11, bold=True, color=PLUM, anchor="m")
    d.text(s, 1.8, 4.35, 7.6, 0.62, "Mutación con Stryker (backend y frontend) · los mismos flujos en Firefox y WebKit · "
           "ZAP full scan (manual, opcional)", size=10, anchor="m")
    for i, (lab, col) in enumerate([("Seguridad", C_SEC), ("Calidad y spec", C_QUAL), ("Pruebas", C_TEST),
                                    ("Build", C_BUILD), ("Evidencia", C_EVID)]):
        d.box(s, 0.6 + i * 1.75, 3.97, 0.18, 0.18, "", fill=col, shape="oval")
        d.text(s, 0.84 + i * 1.75, 3.91, 1.5, 0.3, lab, size=9, color=GRAY, anchor="m")
    d.notes(s, """
        Este es el pipeline del repo. Diez etapas en el PR: secretos primero porque es lo más barato y lo
        más grave, después calidad y spec, SAST y dependencias. Luego las pruebas: unit, integración y
        contrato, y E2E con el mock server. Después se construyen las imágenes, se levanta el stack real y se
        ataca con ZAP. Al final se publica la evidencia en el PR. En la práctica varias etapas corren en
        paralelo, y un job inicial (etapa 0) detecta qué carpetas cambiaron para no correr lo que no hace
        falta. Lo que tarda mucho, como mutación o los flujos en Firefox y WebKit, va en el pipeline
        nocturno. El objetivo del libro para el build and test es el tiempo de una taza de té (p. 127).
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
        ("Capturas", "Una por paso de cada flujo E2E", "frontend/evidence/manifest.json", ORANGE),
        ("Videos y GIF", "El recorrido del usuario de cada flujo", "videos/FLOW-*.webm → GIF", AQUA),
        ("Endpoints", "Qué operaciones y status probó el contrato", "backend/reports/contract-coverage.json", GREEN),
        ("Seguridad", "Hallazgos de SAST, SCA, imagen y DAST", "SARIF y reporte de ZAP", RED),
    ]
    for i, (t, desc, src, col) in enumerate(items):
        x = 0.45 + i * 2.32
        d.card(s, x, 1.2, 2.15, 2.25, fill=LIGHT)
        d.box(s, x + 0.15, 1.35, 1.85, 0.42, t, fill=col, size=11.5)
        d.text(s, x + 0.15, 1.9, 1.85, 0.75, desc, size=10.5, color=INK)
        d.text(s, x + 0.15, 2.7, 1.85, 0.65, src, size=8.5, color=GRAY, font=k.FONT_CODE)
    flow = [("Artefactos de los jobs", TEAL), ("tools/evidence", PLUM), ("Comentario único en el PR", GREEN)]
    for i, (t, col) in enumerate(flow):
        x = 0.9 + i * 3.0
        d.box(s, x, 3.8, 2.3, 0.55, t, fill=col, size=10.5)
        if i < 2:
            d.line(s, x + 2.32, 4.07, x + 2.98, 4.07, color=MUTED, width=1.75)
    d.text(s, 0.45, 4.5, 9.1, 0.45, "El comentario se actualiza en cada push (no se acumulan comentarios) y "
           "cada ítem lleva el ID del flujo o de la regla.", size=10, color=GRAY, align="c")
    d.notes(s, """
        El principio P6 dice que todo cambio entra por PR con evidencia. Concretamente se publican cuatro
        cosas: capturas de cada paso de los flujos, videos convertidos a GIF para verlos directamente en
        GitHub, la tabla de endpoints que probó el contrato y un resumen de seguridad. Todo sale de archivos
        con formato acordado en specs/architecture.md: el manifest.json del frontend y el
        contract-coverage.json del backend. Un script en tools arma un solo comentario que se actualiza en
        cada push.
    """)

    s = d.content("Así se ve el comentario")
    d.box(s, 0.45, 1.12, 9.1, 3.85, "", fill=WHITE, line=BORDER, line_w=1)
    d.box(s, 0.45, 1.12, 9.1, 0.42, "", fill=CODEBG, line=BORDER, line_w=1, shape="rect")
    d.box(s, 0.6, 1.18, 0.3, 0.3, "CI", fill=GRAY, size=7.5, shape="oval", margin=0)
    d.text(s, 1.0, 1.15, 6.0, 0.36, "**github-actions** comentó · Evidencia de CI · PR #42 · commit 3f2a9c1", size=9.5,
           anchor="m", color=INK)
    d.text(s, 0.65, 1.62, 4.2, 0.3, "Flujos de usuario (Playwright + MSW)", size=10.5, bold=True)
    flows = [("FLOW-CAT-01", "Buscar sin tildes", "busqueda.png"),
             ("FLOW-PRE-01", "Pedir prestado", "prestamo-registrado.png"),
             ("FLOW-PRE-03", "Límite de 3", "limite-prestamos.png")]
    for i, (fid, name, img) in enumerate(flows):
        x = 0.65 + i * 1.43
        d.image(s, IMG / img, x, 1.97, w=1.32, alt=f"Captura de {fid}")
        d.text(s, x, 2.84, 1.32, 0.22, f"✓ {fid}", size=8, bold=True, color=GREEN, align="c", font=k.FONT_CODE)
        d.text(s, x, 3.05, 1.32, 0.22, name, size=8, color=GRAY, align="c")
    d.text(s, 0.65, 3.42, 4.2, 0.3, "Seguridad", size=10.5, bold=True)
    d.text(s, 0.65, 3.72, 4.25, 1.15, [
        "✓ gitleaks: 0 secretos",
        "✓ Semgrep y CodeQL: 0 hallazgos nuevos",
        "✓ Trivy: 0 críticas ni altas",
        "! ZAP: 2 avisos de severidad baja",
    ], size=9.5, space_after=1, color=INK)
    rows = [["Endpoint", "Status probados", ""],
            ["GET /api/health", "200", "✓"],
            ["GET /api/books", "200 · 400", "✓"],
            ["POST /api/books", "201 · 400 · 409", "✓"],
            ["GET /api/books/{id}", "200 · 400 · 404", "✓"],
            ["POST /api/loans", "201 · 400 · 404 · 409", "✓"],
            ["GET /api/loans", "200 · 400", "✓"],
            ["POST /api/loans/{id}/return", "200 · 404 · 409", "✓"]]
    d.text(s, 5.15, 1.62, 4.2, 0.3, "Endpoints (contrato vs OpenAPI)", size=10.5, bold=True)
    d.table(s, 5.15, 1.97, 4.25, rows, [2.1, 1.75, 0.4], row_h=0.34, size=8.5, header_fill="F0F3F6",
            header_color=INK, align=["l", "l", "c"], col_colors=[None, None, GREEN])
    d.notes(s, """
        Este es el mockup del comentario que deja el pipeline. Arriba, los flujos de usuario con sus
        capturas y el GIF del recorrido, cada uno con su ID, por ejemplo FLOW-PRE-03 que muestra el error de
        límite de préstamos. A la derecha, la tabla de endpoints con los status que efectivamente probó el
        contrato, sale de contract-coverage.json. Abajo, el resumen de seguridad. Un revisor puede entender
        el PR sin clonar ni levantar nada. El repo tiene un ejemplo real generado en
        docs/ejemplo-comentario-pr.md.
    """)

    s = d.content("Chrome sin interfaz como testigo")
    d.text(s, 0.45, 1.15, 4.35, 3.75, [
        "En CI, Playwright lanza **Chromium headless**: el mismo motor de Chrome, sin ventana.",
        "Captura en cada paso, video del flujo y trace al fallar: el revisor ve lo mismo que vería una persona.",
        "El libro toma capturas en el teardown cuando un test falla en CI (Selenium, p. 86).",
        "**Lighthouse** corre sobre el mismo Chrome headless: performance, accesibilidad y buenas prácticas (p. 270).",
        "Chrome DevTools sigue siendo la herramienta de exploración manual (cap. 2).",
    ], size=10.5, bullets=True, space_after=6)
    d.code(s, 5.0, 1.15, 4.55, 3.75, """
// Fixtures de los flujos BDD: reloj fijo y capturas
// de evidencia para el PR
export const test = base.extend<{ evidence: Evidence }>({
  page: fixedClockPage,
  evidence: async ({ page }, use, testInfo) => {
    // El ID viene del tag del escenario (@FLOW-PRE-01)
    const flowId = testInfo.tags
      .find((tag) => tag.startsWith('@FLOW-'))
      ?.slice(1) ?? 'SIN-ID'
    let counter = 0
    await use({
      async capture(stepTitle) {
        counter += 1
        const name =
          `${flowId}-${counter}-${slug(stepTitle)}.png`
        await page.screenshot({ path: join(DIR, name),
          animations: 'disabled', caret: 'hide' })
      },
    })
  },
})""", lang="ts", title="frontend/tests/e2e/fixtures.ts (extracto)")
    d.notes(s, """
        La inspiración viene del libro: en el capítulo 3, con Selenium, toma una captura en el teardown cada
        vez que un test falla en CI, porque es lo más útil para depurar. Nosotros vamos un paso más allá:
        capturas y video siempre, no solo al fallar, porque además sirven como evidencia para el revisor.
        Todo corre en Chromium headless, que es Chrome sin ventana. Lighthouse usa el mismo motor para medir
        performance y accesibilidad, y DevTools queda para la exploración manual.
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
        ("Spec", "Escribe SPEC-LIB-03 con RENEW-R1 a R3 (plantilla)", TEAL, "10 min"),
        ("Contrato", "Agrega la operación renewLoan al OpenAPI", AQUA, "10 min"),
        ("Verifica", "Spectral y oasdiff: ¿cambio compatible?", PLUM, "5 min"),
        ("Plan", "El agente propone casos. Tú apruebas o podas", ORANGE, "10 min"),
        ("Rojo", "Tests que fallan, capa por capa, uno a la vez", RED, "20 min"),
        ("Verde", "Código mínimo. spec-trace sin huérfanos", GREEN, "20 min"),
        ("PR", "Lee la evidencia y el comentario del revisor IA", BLUE, "15 min"),
    ]
    w = 1.2
    for i, (t, desc, col, tm) in enumerate(steps):
        x = 0.45 + i * (w + 0.117)
        d.circle_num(s, x + w / 2 - 0.25, 1.25, 0.5, i + 1, fill=col, size=14)
        if i < len(steps) - 1:
            d.line(s, x + w / 2 + 0.27, 1.5, x + w + 0.117 + w / 2 - 0.27, 1.5, color=MUTED, width=1.5,
                   head=False)
        d.text(s, x, 1.85, w, 0.3, t, size=12, bold=True, color=col, align="c")
        d.text(s, x, 2.2, w, 1.3, desc, size=9.5, align="c", color=INK)
        d.chip(s, x + 0.25, 3.55, w - 0.5, 0.28, tm, fill=LIGHT, color=GRAY, size=8.5)
    d.card(s, 0.45, 4.05, 9.1, 0.85, fill=LIGHTBLUE)
    d.text(s, 0.6, 4.1, 8.8, 0.75, "Regla de la actividad: **ningún paso se salta**. Si el agente escribe "
           "código antes de que apruebes el plan, se descarta y se vuelve al paso 4.", size=11, anchor="m")
    d.notes(s, """
        Siete pasos, más o menos 90 minutos. Primero escriben la spec con la plantilla, después cambian el
        contrato y lo verifican con Spectral y oasdiff. Recién ahí le piden al agente un plan de tests, lo
        revisan y lo podan. Después rojo y verde, un test a la vez. Al final abren el PR y leen la evidencia.
        La regla más importante: si el agente se adelanta y escribe código sin plan aprobado, se descarta.
        El objetivo no es terminar rápido, es practicar el proceso.
    """)

    s = d.content("Borrador de SPEC-LIB-03: Renovar préstamo")
    d.code(s, 0.45, 1.15, 5.6, 3.75, """
# SPEC-LIB-03 · Renovar préstamo

## Reglas de negocio (borrador para completar)

- **RENEW-R1 · Solo préstamos activos.** Se renueva
  un préstamo `ACTIVE`. Vencido o devuelto: 409
  `LOAN_NOT_RENEWABLE`.
- **RENEW-R2 · Una renovación.** Cada préstamo se
  renueva como máximo 1 vez: 409
  `RENEWAL_LIMIT_REACHED`.
- **RENEW-R3 · Nueva fecha.** `dueAt` se extiende
  7 días desde el `dueAt` actual.

## Fuera de alcance
Reservas y listas de espera.""", lang="md", title="specs/features/SPEC-LIB-03-renovacion.md", size=9.5)
    d.card(s, 6.3, 1.15, 3.25, 3.75, fill=LIGHT)
    d.text(s, 6.45, 1.25, 2.95, 0.3, "Lo que la spec debe resolver", size=11.5, bold=True, color=TEAL)
    d.text(s, 6.45, 1.65, 2.95, 3.2, [
        "¿Se puede renovar el día exacto de dueAt? Es el valor límite de LOAN-R6.",
        "¿Qué status y body responde el 200?",
        "¿Los nuevos códigos de error entran al enum ErrorCode?",
        "¿Cómo se ve en la UI? Escribe el flujo en Gherkin.",
    ], size=10, bullets=True, space_after=6)
    d.notes(s, """
        Este es un borrador para partir. Las reglas son simples a propósito: solo se renuevan préstamos
        activos, una vez, y la fecha se extiende 7 días. Lo interesante son las preguntas de la derecha. ¿Qué
        pasa el día exacto del vencimiento? Esa es una partición de valor límite que conecta con LOAN-R6. Los
        nuevos códigos de error obligan a cambiar el enum del contrato, y oasdiff les va a decir si ese
        cambio rompe a los clientes. Y el flujo de UI se escribe en Gherkin, así el test E2E sale solo.
    """)

    s = d.content("El prompt para el agente y el checklist del PR")
    d.code(s, 0.45, 1.15, 5.5, 2.95, """
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
   scripts lint, typecheck y test:* de la app.""", lang="txt", title="Prompt (Claude Code, Copilot o Cursor)", size=10.5)
    d.card(s, 0.45, 4.25, 5.5, 0.65, fill="FCE8EC")
    d.text(s, 0.6, 4.25, 5.2, 0.65, "Si el plan trae más de 6 casos para una regla o casos repetidos entre "
           "capas, **recházalo** y pide que justifique cada caso.", size=10, anchor="m")
    checks = [
        "Spec y OpenAPI cambian en el mismo PR",
        "Spectral y oasdiff en verde",
        "Cada test nuevo con [RENEW-Rx] en el título",
        "Ningún mock sin justificación escrita",
        "Video del flujo de renovación en la evidencia",
        "Seguridad sin hallazgos nuevos",
        "Rama de menos de 2 días",
    ]
    d.text(s, 6.2, 1.15, 3.35, 0.3, "Checklist del PR", size=12, bold=True, color=TEAL)
    for i, c in enumerate(checks):
        y = 1.55 + i * 0.47
        d.box(s, 6.2, y + 0.05, 0.26, 0.26, "", fill=WHITE, line=TEAL, line_w=1.5, radius=0.04)
        d.text(s, 6.55, y, 3.0, 0.4, c, size=10, anchor="m")
    d.notes(s, """
        El prompt es corto a propósito: el libro advierte que las instrucciones muy largas se ignoran
        (p. 96). Lo importante ya está en la constitución, el prompt solo apunta a los archivos y fija el
        orden de trabajo. A la derecha está el checklist que revisa la pareja antes de pedir revisión. Si
        todo está bien, el comentario de evidencia debería mostrar el nuevo flujo de renovación con su video
        y la tabla de endpoints con el nuevo endpoint.
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
        y = 1.2 + i * 0.74
        d.circle_num(s, 0.9, y + 0.04, 0.5, i + 1, fill=col, size=14)
        d.text(s, 1.6, y, 3.4, 0.58, t, size=14, bold=True, color=col, anchor="m")
        d.text(s, 5.0, y, 4.5, 0.58, desc, size=11.5, anchor="m")
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
        y = 1.2 + (i // 2) * 1.85
        d.card(s, x, y, 4.45, 1.65, fill=LIGHT)
        d.text(s, x + 0.2, y + 0.1, 0.6, 0.6, "?", size=28, bold=True, color=BLUE, font=k.FONT_TITLE)
        d.text(s, x + 0.8, y + 0.15, 3.5, 1.35, q, size=12.5, anchor="m")
    d.notes(s, """
        Preguntas para cerrar en plenario. La primera obliga a pensar en el valor de cada test. La segunda
        es la situación real que van a vivir con agentes. La tercera obliga a priorizar etapas del pipeline.
        La cuarta conecta con su proyecto del curso. No hay una respuesta correcta, lo importante es que
        argumenten con lo visto en clase.
    """)

    s = d.content("Referencias")
    d.text(s, 0.45, 1.15, 4.5, 3.4, [
        "**Libro base.** G. Mohan, Full Stack Testing, 2.ª ed., O'Reilly, 2026. Caps. 1 a 10.",
        "**DORA.** State of AI-assisted Software Development, 2025.",
        "**Meta.** Alshahwan et al., Automated Unit Test Improvement using Large Language Models at Meta, FSE 2024.",
        "**Meta.** Mutation-Guided LLM-based Test Generation at Meta (ACH), 2025.",
        "**Google.** State of Mutation Testing at Google, ICSE SEIP 2018. Petrović et al., Practical Mutation "
        "Testing at Scale.",
        "**Google Research.** Resolving code review comments with ML, 2023.",
    ], size=9.5, bullets=True, space_after=5)
    d.text(s, 5.15, 1.15, 4.4, 3.4, [
        "**SDD.** GitHub Spec Kit, AWS Kiro, Tessl.",
        "**Contrato.** OpenAPI 3.1, Spectral, oasdiff, openapi-typescript, Schemathesis, Pact.",
        "**Pruebas.** Jest, Vitest, Testing Library, MSW, Playwright, playwright-bdd, Testcontainers, "
        "supertest, axe-core, Lighthouse, k6, Stryker, dependency-cruiser.",
        "**Seguridad.** gitleaks, Semgrep, CodeQL, Trivy, hadolint, OWASP ZAP, CycloneDX.",
    ], size=9.5, bullets=True, space_after=5)
    d.text(s, 0.45, 4.35, 9.1, 0.3, "Repo: github.com/UC-IIC-3143-Software-Development/full_stack_testing",
           size=10, bold=True, color=TEAL, align="c")
    d.notes(s, """
        Referencias de la clase. El libro base es la segunda edición de Full Stack Testing. Los papers de Meta
        y Google son lectura recomendada para quien quiera profundizar en generación de tests con LLM y
        mutation testing a escala. Todas las herramientas del proyecto son open source y están configuradas
        en el repo.
    """)


# ============================================================================
# Validación de estilo y salida
# ============================================================================
FORBIDDEN = {"\u2014": "guion largo", "\u2013": "guion medio", "\u003b": "punto y coma"}
VOSEO = re.compile(r"\b(usá|tenés|podés|sabés|querés|mirá|hacé|fijate|decí|vení|andá|probá|escribí|corré|"
                   r"agregá|elegí|leé|pensá|contá|revisá)\b", re.IGNORECASE)


def validate_text(prs) -> list[str]:
    problems = []
    for i, slide in enumerate(prs.slides, 1):
        texts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                texts.append(shape.text_frame.text)
            if shape.has_table:
                for row in shape.table.rows:
                    for cell in row.cells:
                        texts.append(cell.text)
        if slide.has_notes_slide:
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


def build(base: Path = BASE, out: Path = OUT) -> Path:
    d = Deck(str(base))
    for part in (part_a, part_b, part_c, part_d, part_e, part_f, part_g, part_h):
        part(d)
    k.add_sections(d.prs, d.sections)
    problems = validate_text(d.prs)
    if problems:
        print("\n".join(problems))
        sys.exit("El texto no cumple las reglas de estilo (ver arriba).")
    d.prs.core_properties.title = "Full Stack Testing moderno con IA y DevSecOps"
    d.prs.core_properties.author = "IIC3143 Desarrollo de Software"
    d.prs.core_properties.language = "es-CL"
    d.prs.save(str(out))
    for w in k.WARNINGS:
        print("AVISO:", w)
    print(f"{out.name}: {len(d.prs.slides)} diapositivas, {out.stat().st_size / 1024:.0f} KB")
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
