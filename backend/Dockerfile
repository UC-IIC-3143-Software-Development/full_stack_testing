# syntax=docker/dockerfile:1
# Imagen del backend (multi-stage). El contexto de build es la RAÍZ del repo porque el
# contrato vive en specs/api/openapi.yaml:
#
#   docker build -f backend/Dockerfile -t biblioteca-backend .
#
# BuildKit usa backend/Dockerfile.dockerignore (lista blanca de lo que entra al contexto).

# 1. Dependencias exactas del lockfile. --ignore-scripts: ningún paquete ejecuta código al
#    instalarse (defensa básica de cadena de suministro).
FROM node:24-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --ignore-scripts

# 2. Compila TypeScript y deja solo las dependencias de producción.
FROM deps AS build
COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json ./
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev --ignore-scripts

# 3. Imagen final: sin compilador, sin devDependencies, usuario no root.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    OPENAPI_PATH=/app/openapi.yaml
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# El validador de requests lee el contrato en runtime.
COPY --chown=node:node specs/api/openapi.yaml ./openapi.yaml
USER node
EXPOSE 3001
# Las migraciones corren al iniciar (DB_RUN_MIGRATIONS=false las desactiva).
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health > /dev/null || exit 1
CMD ["node", "dist/main.js"]
