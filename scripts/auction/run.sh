#!/usr/bin/env bash
# Bundle the Trait Auction rules check with Vite's esbuild and run it in Node.
#   bash scripts/auction/run.sh [scripts/auction/core-check.mjs]
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${1:-scripts/auction/core-check.mjs}"
OUT="${TMPDIR:-/tmp}/bap-auction-$(basename "$SRC" .mjs).bundle.mjs"
"$ROOT/node_modules/.bin/esbuild" "$ROOT/$SRC" --bundle --platform=node --format=esm --log-level=warning \
  --define:import.meta.env={\"DEV\":false} --log-override:duplicate-object-key=silent --loader:.json=json --outfile="$OUT"
node --max-old-space-size=1536 "$OUT"
