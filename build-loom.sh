#!/usr/bin/env bash
# Build each of src/engine.ts's DEMOS for the web, from the engine's Demo
# Sources into a folder of its own under "Loom Demo Builds" here, named by its
# slug, with the engine's own Play Web pipeline (play-web.ps1 -Output). Every
# demo's page loads one player, built into the engine folder beside them with
# all of their scripts, so a visitor downloads the engine once. The engine
# lives outside this repo, so this reaches over to it. Vite serves the folders
# under /engine-build/demos in dev and copies them into dist on build, the same
# arrangement the Unity games use.
#
# LOOM overrides where the engine is, and OUT where the builds go. Its
# play-web.ps1 finds emsdk itself.
set -euo pipefail

LOOM="${LOOM:-/c/Users/3hoze/Desktop/Loom}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${OUT:-$HERE/Loom Demo Builds}"
ENGINE=engine

# Each demo's source folder, and the slug it is built under.
DEMOS=(
  Physics:physics
  Raycasts:raycasts
  ShaderTime:shader-time
  PreVertex:pre-vertex
  PixelPass:pixel-pass
)

# Builds the project at $1, with its scene at $2, into a web folder beside it.
# Each is built from a copy, since the build leaves a Build folder in the
# project it builds.
play_web() {
  powershell -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$LOOM/play-web.ps1")" \
    -Project "$(cygpath -w "$1")" \
    -Scene "$(cygpath -w "$1/$2")" \
    -Output "$(cygpath -w "$(dirname "$1")/web")"
}

# Its page and files, without the player it was linked into.
build_demo() (
  copy="$(mktemp -d)"
  trap 'rm -rf "$copy"' EXIT
  cp -r "$LOOM/Demo Sources/$1" "$copy/$1"
  play_web "$copy/$1" Scenes/Main.loomscene
  rm "$copy/web"/player.*
  sed -i "s#\"player\.js\"#\"../$ENGINE/player.js\"#g" "$copy/web/index.html"
  rm -rf "$OUT/$2"
  mkdir -p "$OUT"
  mv "$copy/web" "$OUT/$2"
)

# The one player, linked with every script of the demos named, under the names
# their headers have. Two headers of one name would be one file here.
build_engine() (
  copy="$(mktemp -d)"
  trap 'rm -rf "$copy"' EXIT
  project="$copy/Engine"
  mkdir -p "$project/Scripts" "$project/Scenes"
  printf 'name=Engine\nscripts=Scripts/Engine.vcxproj\n' > "$project/Engine.loomproject"
  touch "$project/Scenes/Main.loomscene"
  for name in "$@"; do
    for header in "$LOOM/Demo Sources/$name/Scripts"/*.hpp; do
      [ -e "$header" ] || continue
      if [ -e "$project/Scripts/$(basename "$header")" ]; then
        echo "Two demos have a script called $(basename "$header")." >&2
        exit 1
      fi
      cp "$header" "$project/Scripts/"
    done
  done
  play_web "$project" Scenes/Main.loomscene
  rm -rf "$OUT/$ENGINE"
  mkdir -p "$OUT/$ENGINE"
  mv "$copy/web"/player.* "$OUT/$ENGINE/"
)

build_engine "${DEMOS[@]%%:*}"
for demo in "${DEMOS[@]}"; do
  build_demo "${demo%%:*}" "${demo#*:}"
done
