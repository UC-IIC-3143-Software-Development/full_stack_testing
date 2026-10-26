import path from 'node:path'
import type { NextConfig } from 'next'

// Destino del proxy /api. Se lee en el build: en Docker llega como ARG BACKEND_URL.
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'
const isDev = process.env.NODE_ENV !== 'production'

// Cabeceras de seguridad (DevSecOps): las revisa OWASP ZAP en el DAST del pipeline.
// Next necesita 'unsafe-inline' para sus scripts de hidratación si no se usan nonces.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

// En el monorepo cada app es independiente: la raíz de Next es esta carpeta.
const appRoot = path.resolve(process.cwd())

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: appRoot,
  turbopack: { root: appRoot },
  // Valor por defecto documentado en specs/architecture.md. Al quedar siempre definido,
  // Next lo inlinea y elimina el código de MSW de los builds sin mocking.
  env: { NEXT_PUBLIC_API_MOCKING: process.env.NEXT_PUBLIC_API_MOCKING ?? 'disabled' },
  poweredByHeader: false,
  // Las instrucciones para agentes de IA del proyecto viven en AGENTS.md y CLAUDE.md de la raíz.
  // Sin esto, `next dev` crea un frontend/AGENTS.md genérico.
  agentRules: false,
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
