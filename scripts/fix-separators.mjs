import { readFileSync, writeFileSync } from 'fs'

let src = readFileSync('./src/data/nba-players.js', 'utf8')

// Find the NBA_BIG_PLAYERS block and add separators per team within it
const bigStart = src.indexOf('export const NBA_BIG_PLAYERS')
const bigEnd   = src.indexOf('\nexport const NBA_PLAYERS')

const before = src.slice(0, bigStart)
const block  = src.slice(bigStart, bigEnd)
const after  = src.slice(bigEnd)

let lastTeam = null
const lines = block.split('\n')
const out = []
for (const line of lines) {
  const m = line.match(/^\s+\{ name: "[^"]+", short: "[^"]+", team: '([A-Z]+)'/)
  if (m && m[1] !== lastTeam) {
    if (lastTeam !== null) out.push('')
    out.push(`  // ─── ${m[1]} ───────────────────────────────────────────────────────────`)
    lastTeam = m[1]
  }
  out.push(line)
}

writeFileSync('./src/data/nba-players.js', before + out.join('\n') + after, 'utf8')
console.log('done')
