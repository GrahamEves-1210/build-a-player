#!/usr/bin/env bash
# Bundle a franchise2 script with Vite's esbuild and run it in Node.
#   bash scripts/franchise2/run.sh scripts/franchise2/sim.mjs [args...]
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$1"; shift
NAME="$(basename "$SRC" .mjs)"
OUT="${FR_TMP:-F:/bap-agents/franchise2/tmp}/$NAME.bundle.mjs"
mkdir -p "$(dirname "$OUT")"
"$ROOT/node_modules/.bin/esbuild" "$ROOT/$SRC" --bundle --platform=node --format=esm --log-level=warning \
  --define:import.meta.env={\"DEV\":false} --log-override:duplicate-object-key=silent --loader:.json=json --outfile="$OUT"
node --max-old-space-size=1536 "$OUT" "$@"
