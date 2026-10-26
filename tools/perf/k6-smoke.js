// Prueba de humo de rendimiento con k6 (etapa 9 del pipeline).
//
// No es una prueba de carga: son 5 usuarios virtuales durante 20 segundos contra
// el stack real. Sirve para detectar regresiones gruesas (una consulta sin índice,
// un N+1) antes de integrar. Las pruebas de carga y estrés de verdad van en otro
// pipeline con un ambiente dedicado.
//
// Umbrales (si no se cumplen, k6 termina con código distinto de 0):
//   - p95 de la duración de las solicitudes menor a 500 ms
//   - menos de 1 % de solicitudes fallidas
//
// Uso: k6 run -e BASE_URL=http://localhost:3001 tools/perf/k6-smoke.js
import { check, sleep } from 'k6'
import http from 'k6/http'

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3001').replace(/\/$/, '')
const SUMMARY_PATH = __ENV.K6_SUMMARY_PATH || 'evidence/perf/k6-summary.json'
const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } }

export const options = {
  vus: 5,
  duration: '20s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
}

function isbnWithCheckDigit(prefix12) {
  let sum = 0
  for (const [index, digit] of [...prefix12].entries()) {
    sum += Number(digit) * (index % 2 === 0 ? 1 : 3)
  }
  return `${prefix12}${(10 - (sum % 10)) % 10}`
}

// setup() corre una vez: crea un libro propio con 50 copias para no tocar los datos sembrados
export function setup() {
  const suffix = String(Date.now()).slice(-9)
  const res = http.post(
    `${BASE_URL}/api/books`,
    JSON.stringify({
      isbn: isbnWithCheckDigit(`978${suffix}`),
      title: `Libro k6 ${suffix}`,
      author: 'Prueba de rendimiento',
      totalCopies: 50,
    }),
    JSON_HEADERS,
  )
  if (res.status !== 201) throw new Error(`No se pudo crear el libro de prueba: HTTP ${res.status}`)
  return { bookId: res.json('id') }
}

// Cada iteración: listar el catálogo, prestar, ver mis préstamos y devolver.
// Al devolver, la copia vuelve al stock y el siguiente usuario la puede pedir.
export default function ({ bookId }) {
  const email = `k6-${__VU}-${__ITER}@uc.cl`

  const list = http.get(`${BASE_URL}/api/books`, { tags: { name: 'listBooks' } })
  check(list, { 'listBooks 200': (r) => r.status === 200 })

  const loan = http.post(
    `${BASE_URL}/api/loans`,
    JSON.stringify({ bookId, borrowerEmail: email }),
    { ...JSON_HEADERS, tags: { name: 'createLoan' } },
  )
  check(loan, { 'createLoan 201': (r) => r.status === 201 })

  const mine = http.get(`${BASE_URL}/api/loans?borrowerEmail=${encodeURIComponent(email)}`, {
    tags: { name: 'listLoans' },
  })
  check(mine, { 'listLoans 200': (r) => r.status === 200 })

  if (loan.status === 201) {
    const back = http.post(`${BASE_URL}/api/loans/${loan.json('id')}/return`, null, {
      tags: { name: 'returnLoan' },
    })
    check(back, { 'returnLoan 200': (r) => r.status === 200 })
  }

  // Tiempo de "pensar" de una persona entre acciones: sin esto, 5 usuarios virtuales
  // se convierten en miles de solicitudes por segundo y deja de ser una prueba de humo.
  sleep(0.5)
}

// Resumen propio en JSON (lo lee tools/evidence/build-comment.mjs) y en texto corto.
export function handleSummary(data) {
  const metric = (name) => data.metrics[name] || { values: {}, thresholds: {} }
  const duration = metric('http_req_duration')
  const failed = metric('http_req_failed')
  const thresholds = {}
  let ok = true
  for (const name of ['http_req_duration', 'http_req_failed']) {
    thresholds[name] = {}
    for (const [expression, result] of Object.entries(metric(name).thresholds || {})) {
      thresholds[name][expression] = result.ok
      ok = ok && result.ok
    }
  }
  const summary = {
    ok,
    baseUrl: BASE_URL,
    durationSeconds: 20,
    requests: metric('http_reqs').values.count || 0,
    iterations: metric('iterations').values.count || 0,
    avg: Number((duration.values.avg || 0).toFixed(1)),
    p95: Number((duration.values['p(95)'] || 0).toFixed(1)),
    failedRate: failed.values.rate || 0,
    thresholds,
  }
  const text = [
    `k6 smoke contra ${BASE_URL}`,
    `  solicitudes: ${summary.requests} (${summary.iterations} iteraciones)`,
    `  duración promedio: ${summary.avg} ms, p95: ${summary.p95} ms (umbral 500 ms)`,
    `  solicitudes fallidas: ${(summary.failedRate * 100).toFixed(2)} % (umbral 1 %)`,
    `  resultado: ${ok ? 'umbrales cumplidos' : 'umbrales NO cumplidos'}`,
    '',
  ].join('\n')
  return { stdout: text, [SUMMARY_PATH]: JSON.stringify(summary, null, 2) }
}
