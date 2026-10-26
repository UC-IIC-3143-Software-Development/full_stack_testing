# Presentación de la clase

`Full-Stack-Testing-IA-DevSecOps.pptx` es la presentación de la clase práctica
"Full Stack Testing moderno con IA y DevSecOps" (IIC3143). Usa el mismo master, las mismas
fuentes (Bitter e Inter, incrustadas) y la misma portada que las clases 04-Testing y
06-Testing Frontend del curso. Cada diapositiva tiene notas del orador.

## Estructura (71 diapositivas)

| Parte | Contenido |
| ----- | --------- |
| Apertura | Portada, agenda, objetivos y la pregunta de la clase |
| 1. Por qué ahora | Evidencia del libro, tabla 3-1, pirámide, cono de helado y cupcake, mito del 100 por ciento, 7 reglas, tres barandas, industria (Meta y Google) |
| 2. Spec Driven Development | Qué es, anatomía de un SPEC, specs por capa, trazabilidad, OpenAPI, Spectral y oasdiff, Gherkin, IA en dos pasos, agente que propone tests |
| 3. El proyecto | Monorepo, la app, arquitectura en capas, dependency-cruiser |
| 4. Tipos de prueba | Una diapositiva por tipo con el mismo formato y código real del repo |
| 5. DevSecOps y CI | Lazo DevSecOps, controles por etapa, shift left, Git Flow, trunk based, siglas y herramientas de seguridad, Semgrep, ZAP, pipeline |
| 6. Evidencia en el PR | Qué se publica, cómo se ve el comentario, Chrome sin interfaz |
| 7. Actividad práctica | SPEC-LIB-03 "Renovar préstamo" paso a paso, prompt y checklist |
| Cierre | Conclusiones, preguntas y referencias |

## Regenerar

```bash
cd docs/presentacion
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python build_deck.py
```

- `build_deck.py` arma todas las diapositivas con formas nativas editables (sin imágenes de
  diagramas) y valida el estilo del texto: falla si encuentra guiones largos, punto y coma o voseo.
- `deck_kit.py` tiene los estilos del curso y los helpers de dibujo (cajas, flechas, código, tablas).
- `plantilla/base-curso.pptx` es 04-Testing.pptx sin sus diapositivas: portada, master de contenido
  y fuentes. Se regenera con `python build_deck.py --base "/ruta/04-Testing.pptx"`.
- `img/` tiene capturas reales que toma Playwright en los flujos E2E (`frontend/evidence/`).

## Revisión visual

```bash
.venv/bin/python build_deck.py --render /tmp/deck-png --fonts /ruta/fuentes
```

Convierte el deck a PDF con LibreOffice y a PNG con `pdftoppm`. LibreOffice no lee las fuentes
incrustadas del .pptx, así que para un render fiel pasa en `--fonts` una carpeta con los TTF de
Bitter e Inter (Google Fonts, licencia OFL) y una fuente monoespaciada renombrada como Consolas.
Sin `--fonts` el render sirve solo como aproximación.
