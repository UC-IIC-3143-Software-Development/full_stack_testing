#!/usr/bin/env node
// Convierte los videos .webm de Playwright en GIF livianos para el comentario del PR.
//
// GitHub no reproduce .webm dentro de un comentario, pero sí muestra GIF animados.
// La conversión usa tres pasadas de ffmpeg para que el GIF pese poco y se vea nítido:
//   1. baja a 8 cuadros por segundo y 640 px de ancho y congela el último cuadro 2 s
//      para que se alcance a leer el resultado (archivo intermedio sin pérdida)
//   2. calcula una paleta de 128 colores optimizada para ese video
//   3. aplica la paleta con dithering ordenado (menos ruido entre cuadros = menos peso)
//
// Uso: node tools/evidence/videos-to-gif.mjs <carpeta> [--fps 8] [--width 640] [--hold 2]
// Si ffmpeg no está instalado, avisa y termina sin error (el comentario enlaza al artefacto).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function findVideos(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.webm'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
}

const ffmpeg = (args) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])

export function hasFfmpeg() {
  return spawnSync('ffmpeg', ['-version']).status === 0
}

/** Convierte un video y devuelve la ruta del GIF, o lanza un error con el detalle de ffmpeg. */
export function convertToGif(video, { fps = 8, width = 640, hold = 2 } = {}) {
  const gif = video.replace(/\.webm$/, '.gif')
  const work = mkdtempSync(join(tmpdir(), 'gif-'))
  const scaled = join(work, 'scaled.mkv')
  const palette = join(work, 'palette.png')
  try {
    const steps = [
      [
        '-i',
        video,
        '-vf',
        `fps=${fps},scale=${width}:-2:flags=lanczos,tpad=stop_mode=clone:stop_duration=${hold}`,
        '-c:v',
        'ffv1',
        scaled,
      ],
      ['-i', scaled, '-vf', 'palettegen=max_colors=128:stats_mode=diff', palette],
      [
        '-i',
        scaled,
        '-i',
        palette,
        '-filter_complex',
        'paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
        '-loop',
        '0',
        gif,
      ],
    ]
    for (const args of steps) {
      const result = ffmpeg(args)
      if (result.status !== 0) throw new Error(result.stderr.toString().trim() || 'ffmpeg falló')
    }
    return gif
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

function readOption(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index > -1 ? Number(process.argv[index + 1]) : fallback
}

function main() {
  const dir = resolve(process.argv[2] ?? 'evidence')
  const options = {
    fps: readOption('fps', 8),
    width: readOption('width', 640),
    hold: readOption('hold', 2),
  }
  const videos = findVideos(dir)
  if (videos.length === 0) {
    console.log(`No hay videos .webm en ${dir}`)
    return
  }
  if (!hasFfmpeg()) {
    console.warn('ffmpeg no está instalado: los videos quedan solo como artefacto.')
    return
  }
  let failures = 0
  for (const video of videos) {
    try {
      const gif = convertToGif(video, options)
      const kb = (statSync(gif).size / 1024).toFixed(0)
      console.log(`GIF ${gif} (${kb} KB)`)
    } catch (error) {
      failures += 1
      console.warn(`No se pudo convertir ${video}: ${error.message}`)
    }
  }
  console.log(`${videos.length - failures} de ${videos.length} videos convertidos.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
