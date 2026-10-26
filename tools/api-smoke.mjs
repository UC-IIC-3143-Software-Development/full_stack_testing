#!/usr/bin/env node
// Smoke test de la API contra el stack real (etapa 9 del pipeline).
//
// Recorre TODAS las operaciones de specs/api/openapi.yaml en un flujo realista:
// crea un libro con un ISBN único, lo busca, lo presta, lo devuelve y prueba los
// errores principales (400, 404, 409). No reemplaza a los tests de contrato: su
// objetivo es demostrar que el sistema desplegado (imagen Docker + PostgreSQL)
// responde, y dejar evidencia con tiempos para el comentario del PR.
//
// Uso: BASE_URL=http://localhost:3001 node tools/api-smoke.mjs [--out evidence/api]
// Node 24, sin dependencias (fetch nativo).
import { randomInt } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const MISSING_UUID = '00000000-0000-4000-8000-000000000000'
const JSON_TYPE = /^application\/json/
const PROBLEM_TYPE = /^application\/problem\+json/

/** Genera un ISBN-13 válido y único para no chocar con datos de corridas anteriores. */
export function randomIsbn() {
  const body = `978${String(randomInt(0, 1_000_000_000)).padStart(9, '0')}`
  const sum = [...body].reduce((acc, digit, i) => acc + Number(digit) * (i % 2 === 0 ? 1 : 3), 0)
  return `${body}${(10 - (sum % 10)) % 10}`
}

/** Pasos del flujo. Cada paso declara la operación del contrato y el resultado esperado. */
export function buildSteps(token) {
  const email = `smoke-${token}@uc.cl`
  return [
    {
      name: 'estado del servicio',
      operationId: 'getHealth',
      method: 'GET',
      path: '/api/health',
      expect: 200,
    },
    {
      name: 'crear libro',
      operationId: 'createBook',
      method: 'POST',
      path: '/api/books',
      body: (ctx) => ({
        isbn: ctx.isbn,
        title: `Libro smoke ${token}`,
        author: 'Pipeline CI',
        totalCopies: 2,
      }),
      expect: 201,
      save: (ctx, json) => {
        ctx.bookId = json.id
      },
      check: (json) => (typeof json?.id === 'string' ? null : 'la respuesta no trae id'),
    },
    {
      name: 'ISBN repetido',
      operationId: 'createBook',
      method: 'POST',
      path: '/api/books',
      body: (ctx) => ({ isbn: ctx.isbn, title: 'Repetido', author: 'Pipeline CI', totalCopies: 1 }),
      expect: 409,
      code: 'ISBN_ALREADY_EXISTS',
    },
    {
      name: 'ISBN inválido',
      operationId: 'createBook',
      method: 'POST',
      path: '/api/books',
      body: () => ({ isbn: '978-0-00-000000-1', title: 'Falso', author: 'Nadie', totalCopies: 1 }),
      expect: 400,
      code: 'VALIDATION_ERROR',
    },
    {
      name: 'listar',
      operationId: 'listBooks',
      method: 'GET',
      path: '/api/books',
      expect: 200,
      check: (json, ctx) =>
        Array.isArray(json) && json.some((b) => b.id === ctx.bookId)
          ? null
          : 'el libro creado no aparece en la lista',
    },
    {
      name: 'buscar',
      operationId: 'listBooks',
      method: 'GET',
      path: '/api/books?q={q}',
      url: () => `/api/books?q=${encodeURIComponent(`SMOKE ${token}`)}`,
      expect: 200,
      check: (json, ctx) =>
        Array.isArray(json) && json.length === 1 && json[0].id === ctx.bookId
          ? null
          : 'la búsqueda no devuelve exactamente el libro creado',
    },
    {
      name: 'obtener',
      operationId: 'getBook',
      method: 'GET',
      path: '/api/books/{bookId}',
      url: (ctx) => `/api/books/${ctx.bookId}`,
      expect: 200,
    },
    {
      name: 'libro inexistente',
      operationId: 'getBook',
      method: 'GET',
      path: '/api/books/{bookId}',
      url: () => `/api/books/${MISSING_UUID}`,
      expect: 404,
      code: 'BOOK_NOT_FOUND',
    },
    {
      name: 'bookId no es UUID',
      operationId: 'getBook',
      method: 'GET',
      path: '/api/books/{bookId}',
      url: () => '/api/books/no-es-uuid',
      expect: 400,
      code: 'VALIDATION_ERROR',
    },
    {
      name: 'prestar',
      operationId: 'createLoan',
      method: 'POST',
      path: '/api/loans',
      body: (ctx) => ({ bookId: ctx.bookId, borrowerEmail: email }),
      expect: 201,
      save: (ctx, json) => {
        ctx.loanId = json.id
      },
      check: (json) => (json?.status === 'ACTIVE' ? null : 'el préstamo nuevo no está ACTIVE'),
    },
    {
      name: 'prestar libro inexistente',
      operationId: 'createLoan',
      method: 'POST',
      path: '/api/loans',
      body: () => ({ bookId: MISSING_UUID, borrowerEmail: email }),
      expect: 404,
      code: 'BOOK_NOT_FOUND',
    },
    {
      name: 'listar préstamos',
      operationId: 'listLoans',
      method: 'GET',
      path: '/api/loans?borrowerEmail={email}',
      url: () => `/api/loans?borrowerEmail=${encodeURIComponent(email)}`,
      expect: 200,
      check: (json, ctx) =>
        Array.isArray(json) && json.some((l) => l.id === ctx.loanId)
          ? null
          : 'el préstamo no aparece en la lista',
    },
    {
      name: 'listar préstamos sin correo',
      operationId: 'listLoans',
      method: 'GET',
      path: '/api/loans',
      expect: 400,
      code: 'VALIDATION_ERROR',
    },
    {
      name: 'renovar',
      operationId: 'renewLoan',
      method: 'POST',
      path: '/api/loans/{loanId}/renew',
      url: (ctx) => `/api/loans/${ctx.loanId}/renew`,
      expect: 200,
      check: (json) => (json?.renewalCount === 1 ? null : 'renewalCount no quedó en 1'),
    },
    {
      name: 'renovar de nuevo',
      operationId: 'renewLoan',
      method: 'POST',
      path: '/api/loans/{loanId}/renew',
      url: (ctx) => `/api/loans/${ctx.loanId}/renew`,
      expect: 409,
      code: 'RENEWAL_LIMIT_REACHED',
    },
    {
      name: 'devolver',
      operationId: 'returnLoan',
      method: 'POST',
      path: '/api/loans/{loanId}/return',
      url: (ctx) => `/api/loans/${ctx.loanId}/return`,
      expect: 200,
      check: (json) => (json?.status === 'RETURNED' ? null : 'el préstamo no quedó RETURNED'),
    },
    {
      name: 'devolver de nuevo',
      operationId: 'returnLoan',
      method: 'POST',
      path: '/api/loans/{loanId}/return',
      url: (ctx) => `/api/loans/${ctx.loanId}/return`,
      expect: 409,
      code: 'ALREADY_RETURNED',
    },
    {
      name: 'préstamo inexistente',
      operationId: 'returnLoan',
      method: 'POST',
      path: '/api/loans/{loanId}/return',
      url: () => `/api/loans/${MISSING_UUID}/return`,
      expect: 404,
      code: 'LOAN_NOT_FOUND',
    },
    {
      name: 'loanId no es UUID',
      operationId: 'returnLoan',
      method: 'POST',
      path: '/api/loans/{loanId}/return',
      url: () => '/api/loans/no-es-uuid/return',
      expect: 400,
      code: 'VALIDATION_ERROR',
    },
  ]
}

async function waitForHealth(baseUrl, waitMs) {
  const deadline = Date.now() + waitMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return true
    } catch {
      // Todavía no responde: se reintenta hasta el plazo
    }
    await new Promise((done) => setTimeout(done, 1000))
  }
  return false
}

export async function runSmoke({
  baseUrl,
  waitMs = 30_000,
  token = randomInt(1e6, 1e7).toString(36),
}) {
  const startedAt = new Date()
  const healthy = await waitForHealth(baseUrl, waitMs)
  const ctx = { isbn: randomIsbn() }
  const results = []

  for (const step of buildSteps(token)) {
    const url = step.url ? step.url(ctx) : step.path
    const body = step.body ? JSON.stringify(step.body(ctx)) : undefined
    const result = {
      name: step.name ?? step.operationId,
      operationId: step.operationId,
      method: step.method,
      path: step.path.replace(/\?.*$/, ''),
      url,
      expected: step.expect,
      actual: null,
      ms: null,
      ok: false,
      error: null,
    }
    const started = performance.now()
    try {
      const res = await fetch(`${baseUrl}${url}`, {
        method: step.method,
        headers: body ? { 'content-type': 'application/json' } : {},
        body,
        signal: AbortSignal.timeout(10_000),
      })
      result.ms = Math.round(performance.now() - started)
      result.actual = res.status
      const contentType = res.headers.get('content-type') ?? ''
      const json = await res.json().catch(() => null)
      const problems = []
      if (res.status !== step.expect) problems.push(`se esperaba ${step.expect}`)
      const expectedType = step.expect >= 400 ? PROBLEM_TYPE : JSON_TYPE
      if (!expectedType.test(contentType)) problems.push(`content-type inesperado: ${contentType}`)
      if (step.code && json?.code !== step.code)
        problems.push(`code ${json?.code} en vez de ${step.code}`)
      if (problems.length === 0 && step.check) {
        const failure = step.check(json, ctx)
        if (failure) problems.push(failure)
      }
      if (problems.length === 0 && step.save) step.save(ctx, json)
      result.ok = problems.length === 0
      result.error = problems.join(', ') || null
    } catch (error) {
      result.ms = Math.round(performance.now() - started)
      result.error = error.cause?.code ?? error.message
    }
    results.push(result)
  }

  const passed = results.filter((r) => r.ok).length
  return {
    baseUrl,
    healthy,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    total: results.length,
    passed,
    failed: results.length - passed,
    ok: passed === results.length,
    results,
  }
}

export function toMarkdown(report) {
  const lines = [
    '## Smoke de la API contra el stack real',
    '',
    `${report.ok ? '✅' : '❌'} **${report.passed} de ${report.total} verificaciones OK** contra \`${report.baseUrl}\` en ${report.durationMs} ms`,
    '',
    '| # | Operación | Método | Ruta | Caso | Esperado | Obtenido | ms | Resultado |',
    '| ---: | --- | --- | --- | --- | :---: | :---: | ---: | --- |',
  ]
  report.results.forEach((r, index) => {
    const status = r.ok ? '✅' : `❌ ${r.error ?? ''}`
    lines.push(
      `| ${index + 1} | \`${r.operationId}\` | ${r.method} | \`${r.path}\` | ${r.name} | ${r.expected} | ${r.actual ?? 'sin respuesta'} | ${r.ms ?? ''} | ${status} |`,
    )
  })
  return `${lines.join('\n')}\n`
}

async function main() {
  const outIndex = process.argv.indexOf('--out')
  const outDir = resolve(outIndex > -1 ? process.argv[outIndex + 1] : 'evidence/api')
  const baseUrl = (process.env.BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '')
  const report = await runSmoke({ baseUrl, waitMs: Number(process.env.SMOKE_WAIT_MS ?? 30_000) })

  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'endpoints.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(outDir, 'endpoints.md'), toMarkdown(report))

  for (const r of report.results) {
    const mark = r.ok ? 'OK  ' : 'FALLA'
    const detail = r.ok ? '' : `  (${r.error})`
    console.log(
      `${mark} ${r.method.padEnd(4)} ${r.url.padEnd(58)} ${String(r.actual ?? '---')} ${String(r.ms ?? '').padStart(5)} ms${detail}`,
    )
  }
  console.log(`\n${report.passed}/${report.total} verificaciones OK. Evidencia en ${outDir}`)
  process.exitCode = report.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
