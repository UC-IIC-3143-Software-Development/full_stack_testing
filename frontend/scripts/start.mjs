// Inicia el build de producción con el servidor standalone de Next (output: 'standalone'),
// el mismo que corre la imagen Docker. `next start` no está soportado con standalone.
//   PORT=3000 node scripts/start.mjs
import { spawn } from 'node:child_process'
import { cpSync, existsSync } from 'node:fs'

const standalone = '.next/standalone'
if (!existsSync(`${standalone}/server.js`)) {
  console.error('No hay build standalone. Corre `npm run build` o `npm run build:mock` primero.')
  process.exit(1)
}

// El servidor standalone espera los assets estáticos y public/ junto a server.js.
cpSync('.next/static', `${standalone}/.next/static`, { recursive: true })
cpSync('public', `${standalone}/public`, { recursive: true })

const server = spawn(process.execPath, ['server.js'], {
  cwd: standalone,
  stdio: 'inherit',
  // HOSTNAME explícito: dentro de Docker esa variable trae el id del contenedor.
  env: { ...process.env, PORT: process.env.PORT ?? '3000', HOSTNAME: '0.0.0.0' },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal))
server.on('exit', (code) => process.exit(code ?? 0))
