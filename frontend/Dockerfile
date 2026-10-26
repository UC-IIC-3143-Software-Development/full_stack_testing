# syntax=docker/dockerfile:1
# Frontend de la Biblioteca UC: Next.js standalone en una imagen mínima y sin root.
# El contexto es la RAÍZ del repo (monorepo):
#   docker build -f frontend/Dockerfile -t biblioteca-frontend .
#   docker build -f frontend/Dockerfile --build-arg BACKEND_URL=http://api:3001 .

# ---------- 1. Dependencias (se cachean mientras no cambie el lockfile) ----------
FROM node:25-alpine AS deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- 2. Build ----------
FROM node:25-alpine AS build
WORKDIR /app/frontend
# Destino del rewrite /api. Next lo graba en el build, por eso es ARG y no ENV de runtime.
ARG BACKEND_URL=http://backend:3001
ENV BACKEND_URL=${BACKEND_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY frontend/ ./
RUN npm run build

# ---------- 3. Runtime: solo el servidor standalone y los assets ----------
FROM node:25-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./.next/static
COPY --from=build --chown=node:node /app/frontend/public ./public
# El Service Worker de MSW solo sirve en modo mock: no se publica en producción.
RUN rm -f ./public/mockServiceWorker.js
# P5.3: la imagen corre con un usuario sin privilegios (el usuario "node" de la imagen base).
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1
CMD ["node", "server.js"]
