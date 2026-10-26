#!/usr/bin/env node
// Compuerta de OWASP ZAP: falla si hay alertas High (o reglas marcadas FAIL) que
// no estén ignoradas en tools/zap/rules.tsv.
//
// ZAP se ejecuta con -I para que las advertencias no rompan el build. Este script
// lee el reporte JSON y decide con un criterio explícito y versionado en el repo.
//
// Uso: node tools/zap/check-alerts.mjs reports/zap/zap-frontend.json reports/zap/zap-api.json
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Lee rules.tsv y devuelve un Map id de regla a acción (IGNORE, WARN, FAIL). */
export function loadRules(file = join(here, 'rules.tsv')) {
  const rules = new Map()
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue
    const [id, action] = line.split('\t')
    rules.set(id.trim(), action.trim())
  }
  return rules
}

/** Devuelve las alertas que bloquean: High no ignoradas o reglas marcadas FAIL. */
export function blockingAlerts(report, rules) {
  const blocking = []
  for (const site of report.site ?? []) {
    for (const alert of site.alerts ?? []) {
      const action = rules.get(String(alert.pluginid))
      if (action === 'IGNORE') continue
      if (Number(alert.riskcode) >= 3 || action === 'FAIL') {
        blocking.push({ site: site['@name'], id: alert.pluginid, name: alert.name ?? alert.alert })
      }
    }
  }
  return blocking
}

function main() {
  const rules = loadRules()
  const files = process.argv.slice(2)
  let blocking = []
  for (const file of files) {
    if (!existsSync(file)) {
      console.warn(`No existe ${file}: se omite (¿falló el escaneo antes de generar el reporte?)`)
      continue
    }
    blocking = blocking.concat(blockingAlerts(JSON.parse(readFileSync(file, 'utf8')), rules))
  }
  for (const alert of blocking) console.log(`BLOQUEA  ${alert.site}  [${alert.id}] ${alert.name}`)
  console.log(
    blocking.length === 0
      ? 'ZAP: sin alertas que bloqueen.'
      : `ZAP: ${blocking.length} alertas bloquean el PR.`,
  )
  process.exitCode = blocking.length === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
