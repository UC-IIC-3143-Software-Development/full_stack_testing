# Presentación de la clase

`Full-Stack-Testing-IA-DevSecOps.pptx` es la presentación de la clase práctica
"Full Stack Testing moderno con IA y DevSecOps" (IIC3143). Usa el mismo master, las mismas
fuentes (Bitter e Inter, incrustadas) y la misma portada que las clases 04-Testing y
06-Testing Frontend del curso. Cada diapositiva tiene notas del orador.

## Estructura (76 diapositivas)

| Parte | Contenido |
| ----- | --------- |
| Apertura | Portada, agenda, objetivos y la pregunta de la clase |
| 1. Por qué ahora | Evidencia del libro, tabla 3-1, pirámide, cono de helado y cupcake, mito del 100 por ciento, 7 reglas, tres barandas, industria (Meta y Google) |
| 2. Spec Driven Development | Qué es, anatomía de un SPEC, specs por capa, trazabilidad, OpenAPI, Spectral y oasdiff, Gherkin, IA en dos pasos, agente que propone tests |
| 3. El proyecto | Monorepo, la app, arquitectura en capas, dependency-cruiser |
| 4. Tipos de prueba | Mapa con los conteos reales de main (antes de SPEC-LIB-03), dobles de prueba y una diapositiva por tipo con código real del repo, incluidas las capturas de referencia visuales (`visual-baselines.yml`) |
| 5. DevSecOps y CI | Lazo DevSecOps, controles por etapa, shift left, Git Flow, trunk based, "¿Qué es esto?" (SAST, DAST, Semgrep, Trivy y dependencias), secretos, IaC y SBOM, herramientas por etapa, Semgrep, ZAP y el pipeline con sus dos ciclos de feedback |
| 6. Evidencia en el PR | Qué se publica, el comentario real del PR #10 (resumen y capturas de GitHub), Chrome sin interfaz |
| 7. Actividad práctica | SPEC-LIB-03 "Renovar préstamo" paso a paso, borrador, prompt y checklist, el PR de ejemplo (PR #10, `feat/renovar-prestamo`) con sus commits por fase y lo que el pipeline encontró (oasdiff y la tolerancia visual) |
| Cierre | Conclusiones, preguntas y referencias |

## Regenerar

```bash
cd docs/presentacion
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python build_deck.py
```

- `build_deck.py` arma todas las diapositivas con formas nativas editables (sin imágenes de
  diagramas). Antes de guardar valida el deck y falla si no se cumple alguna regla:
  - Estilo: sin guiones largos ni medios, sin punto y coma y sin voseo.
  - Notas del orador en todas las diapositivas.
  - Tamaños para proyectar: cuerpo, tablas y etiquetas de 12 pt o más, código de 10 pt o más y
    notas al margen (fuentes, pies de imagen) de 10 pt o más.
- Los avisos (`AVISO:`) que imprime son estimaciones de texto que podría no caber. Son
  conservadores: confírmalos con el render.
- Los fragmentos de código son extractos reales del repo. `...` marca líneas omitidas y se
  respetan las líneas tal como están en el archivo. Si cambias un archivo citado, actualiza el
  extracto.
- `deck_kit.py` tiene los estilos del curso, los tamaños mínimos y los helpers de dibujo
  (cajas, flechas, código, tablas).
- `plantilla/base-curso.pptx` es 04-Testing.pptx sin sus diapositivas: portada, master de contenido
  y fuentes. Se regenera con `python build_deck.py --base "/ruta/04-Testing.pptx"`.
- `img/` tiene capturas reales que toma Playwright en los flujos E2E (`frontend/evidence/`) y dos
  recortes del comentario de evidencia del PR #10 (`pr10-etapas.jpg` y `pr10-flujos.jpg`).
- `PR_COMMITS` en `build_deck.py` lista los commits del PR de ejemplo por fase. Si el PR cambia,
  actualízalo con `git log --oneline origin/main..feat/renovar-prestamo`.

## Revisión visual

```bash
.venv/bin/python build_deck.py --render /tmp/deck-png --fonts /ruta/fuentes
```

Convierte el deck a PDF con LibreOffice y a PNG con `pdftoppm`. LibreOffice no lee las fuentes
incrustadas del .pptx, así que para un render fiel pasa en `--fonts` una carpeta con los TTF de
Bitter e Inter (Google Fonts, licencia OFL) y una fuente monoespaciada renombrada como Consolas.
Sin `--fonts` el render sirve solo como aproximación. La monoespaciada de reemplazo suele ser un
poco más ancha que Consolas, así que si el código cabe en el render, cabe en PowerPoint.
