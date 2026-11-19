// Every jersey the app draws has a number (owner, 2026-11-19). Fails if any row of the jersey index, or a photo the
// index doesn't know, would draw a blank. Run after scripts/build-jersey-index.mjs:  node scripts/check-jersey-numbers.mjs
import { readFileSync } from 'node:fs'
import { numberFor } from '../src/lib/jerseyNumber.js'

const INDEX = JSON.parse(readFileSync(new URL('../src/data/jersey-index.json', import.meta.url), 'utf8'))
let bad = 0, own = 0, picked = 0
for (const [key, row] of Object.entries(INDEX.p)) {
  const [lg, , num, pos] = row.split('|')
  if (pos === 'HC') continue   // a coach is his team's mark, not a jersey
  const n = numberFor(key, pos, num, lg)
  if (n === '' || n == null || !/^\d{1,2}$/.test(n)) { bad++; console.log('BLANK', key, row) }
  else if (num !== '') own++
  else picked++
}
for (const lg of ['nfl', 'nba']) if (!/^\d{1,2}$/.test(numberFor('unknown-photo', '', '', lg))) { bad++; console.log('BLANK unknown photo', lg) }
console.log(`jersey numbers: ${own} their own, ${picked} picked for the position, ${bad} blank`)
process.exit(bad ? 1 : 0)
