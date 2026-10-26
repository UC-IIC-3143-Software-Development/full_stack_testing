# Fixtures de evidencia

Artefactos de ejemplo con la misma forma que dejan las etapas del pipeline.
Se usan para probar `tools/evidence/build-comment.mjs` y para generar
`docs/ejemplo-comentario-pr.md` con `npm run evidence:example`.

Los datos son ficticios (CVE de ejemplo, alertas de ZAP inventadas para mostrar
cómo se ve una falla, issues de SonarQube de ejemplo). `sonarqube/summary.json` tiene
la forma que deja `tools/sonarqube/run.mjs`. `api-smoke/endpoints.json` salió de una
corrida real de `tools/api-smoke.mjs` contra el fake de `tools/__fixtures__/fake-api.mjs`.
