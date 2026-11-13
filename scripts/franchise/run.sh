#!/usr/bin/env bash
# Bundle a franchise script with the esbuild that ships with Vite and run the bundle in Node.
#   bash scripts/franchise/run.sh scripts/franchise/check.mjs [args...]
# (Node cannot resolve the repo's extensionless imports, and utils/simulation.js reads import.meta.env.)
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$1"; shift
NAME="$(basename "$SRC" .mjs)"
OUT="${FR_TMP:-F:/bap-agents/franchise/tmp}/$NAME.bundle.mjs"
mkdir -p "$(dirname "$OUT")"
"$ROOT/node_modules/.bin/esbuild" "$ROOT/$SRC" --bundle --platform=node --format=esm --log-level=warning \
  --define:import.meta.env.DEV=false --loader:.json=json --outfile="$OUT"
node --max-old-space-size=1536 "$OUT" "$@"
