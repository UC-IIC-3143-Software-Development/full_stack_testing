# Instrucciones para Gemini

Las instrucciones para agentes de IA de este repo están en `CLAUDE.md` y `AGENTS.md`.
Léelas antes de cambiar o revisar código y síguelas al pie de la letra.

Los workflows `ai-review.yml` y `ai-generate-tests.yml` usan Gemini CLI con la acción
`google-github-actions/run-gemini-cli` y le piden cargar también `AGENTS.md` y `CLAUDE.md`
(`context.fileName` en la configuración), así que las reglas son las mismas para todos los agentes.
