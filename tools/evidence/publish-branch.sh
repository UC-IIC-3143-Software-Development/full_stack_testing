#!/usr/bin/env bash
# Publica las imágenes de evidencia (PNG, GIF, JPG) en la rama huérfana "evidence".
#
# Por qué una rama huérfana: los artefactos de Actions se descargan como zip y no
# se pueden mostrar dentro de un comentario. Una rama sin historia compartida con
# main guarda solo imágenes y GitHub las sirve en raw.githubusercontent.com, así
# el comentario del PR muestra capturas y GIF sin servicios externos.
#
# Uso:   tools/evidence/publish-branch.sh <carpeta-origen> <destino-en-la-rama>
# Ej.:   tools/evidence/publish-branch.sh artifacts pr-12/987654321
# Requiere GITHUB_TOKEN (contents: write) y GITHUB_REPOSITORY.
# EVIDENCE_REMOTE permite usar otro remoto (por ejemplo un repo local en pruebas).
set -euo pipefail

if [ "$#" -ne 2 ]
then
  echo "Uso: $0 <carpeta-origen> <destino-en-la-rama>" >&2
  exit 2
fi

src="$(cd "$1" && pwd)"
dest="$2"
branch="${EVIDENCE_BRANCH:-evidence}"
remote="${EVIDENCE_REMOTE:-https://x-access-token:${GITHUB_TOKEN:-}@github.com/${GITHUB_REPOSITORY:-}.git}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

publish() {
  rm -rf "$work"
  mkdir -p "$work"
  git -C "$work" init -q
  git -C "$work" remote add origin "$remote"
  if git -C "$work" fetch -q --depth 1 origin "$branch" 2>/dev/null
  then
    git -C "$work" checkout -q -b "$branch" FETCH_HEAD
  else
    # Primera vez: se crea la rama sin historia
    git -C "$work" checkout -q --orphan "$branch"
    printf '%s\n' \
      '# Evidencia de CI' \
      '' \
      'Rama generada por la etapa 10 del pipeline (.github/workflows/ci.yml).' \
      'Guarda capturas y GIF de cada PR en pr-<número>/<run_id>/. No se integra a main.' \
      > "$work/README.md"
  fi

  mkdir -p "$work/$dest"
  rsync -a --prune-empty-dirs \
    --include='*/' --include='*.png' --include='*.gif' --include='*.jpg' --include='*.jpeg' \
    --exclude='*' "$src/" "$work/$dest/"

  git -C "$work" add -A
  if git -C "$work" diff --cached --quiet
  then
    echo "No hay imágenes nuevas para publicar."
    return 0
  fi
  git -C "$work" \
    -c user.name='github-actions[bot]' \
    -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
    commit -q -m "evidencia: ${dest}"
  git -C "$work" push -q origin "HEAD:refs/heads/${branch}"
}

# Dos PR pueden publicar al mismo tiempo: si el push es rechazado se reintenta
# desde la punta nueva de la rama (cada PR escribe en su propia carpeta).
for attempt in 1 2 3
do
  if publish
  then
    echo "Evidencia publicada en ${branch}:${dest}"
    exit 0
  fi
  echo "Intento ${attempt} rechazado. Se reintenta con la rama actualizada."
  sleep $((attempt * 3))
done
echo "No se pudo publicar la evidencia." >&2
exit 1
