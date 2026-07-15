import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const positions = require('../src/data/nba-positions.json')

const src = readFileSync('./src/data/nba-players.js', 'utf8')

// Extract both arrays
const guardMatch = src.match(/export const NBA_GUARD_PLAYERS\s*=\s*(\[[\s\S]*?\n\])/)
const bigMatch   = src.match(/export const NBA_BIG_PLAYERS\s*=\s*(\[[\s\S]*?\n\])/)

const guards = eval(guardMatch[1])
const bigs   = eval(bigMatch[1])
const all    = [...guards, ...bigs]

// Average attrs
const avg = p => {
  const vals = Object.values(p.attrs)
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

// Group by team
const byTeam = {}
for (const p of all) {
  if (!byTeam[p.team]) byTeam[p.team] = []
  byTeam[p.team].push(p)
}

// For each team, sort non-starters by avg attr asc → least notable first
const teams = Object.keys(byTeam).sort()
let totalCandidates = 0

for (const team of teams) {
  const players = byTeam[team]
  const starters = players.filter(p => p.starter || p.captain)
  const bench    = players.filter(p => !p.starter && !p.captain)
    .sort((a, b) => avg(a) - avg(b))

  // Keep top ~4-5 bench players, flag the rest
  const keepBench = bench.slice(-5)
  const remove    = bench.slice(0, -5)

  totalCandidates += remove.length

  if (remove.length === 0) continue

  console.log(`\n── ${team} (${players.length} total, ${starters.length} starters, removing ${remove.length}) ──`)
  for (const p of remove) {
    const pos = positions[p.name]?.pos ?? '??'
    console.log(`  ${p.name.padEnd(30)} ${pos}  avg=${avg(p).toFixed(1)}`)
  }
}

console.log(`\nTotal candidates for removal: ${totalCandidates}`)
console.log(`Current total: ${all.length}  →  After: ${all.length - totalCandidates}`)
