// NBA rosters, headless: the real pools every mode reads (data/nba-guards.js, nba-bigs.js) and the league NBA
// Franchise builds from them.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-rosters.mjs [espnRows.json]
// Checks: every pool man on a real team (the spin wheel's NBA_TEAMS), no man on two teams, no name|team card twice,
// a jersey number once a team, everyone with ratings, a height and a weight; the league: 15 standard men and two or
// three two-way men a team, the real men a team, the opening-night injuries on the right men; with ESPN's rosters
// (a JSON list of { team, name }), every ESPN man in the pool on his team and nobody ESPN doesn't list.
import * as N from '../../src/lib/franchise2/nba/index'
import { NBA_GUARD_PLAYERS } from '../../src/data/nba-guards'
import { NBA_BIG_PLAYERS } from '../../src/data/nba-bigs'
import { NBA_TEAMS } from '../../src/data/nba-teams'
import { NBA_DAY_ONE_INJURIES } from '../../src/data/nba-injuries'
import { BIRTH_NBA } from '../../src/data/player-ages'
import HS from '../../src/data/nba-headshots.json'
import fs from 'fs'

const bad = []
const flag = m => { bad.push(m); console.log('  !! ' + m) }
const shorts = new Set(NBA_TEAMS.map(t => t.short))
const all = [...NBA_GUARD_PLAYERS.map(p => [p, 'guard']), ...NBA_BIG_PLAYERS.map(p => [p, 'big'])]
const teamOf = new Map(), card = new Set(), nums = {}
for (const [p, g] of all) {
  if (!shorts.has(p.team)) flag(`${p.name}: team ${p.team} is not on the wheel`)
  if (teamOf.has(p.name) && teamOf.get(p.name) !== p.team) flag(`${p.name} on ${teamOf.get(p.name)} and ${p.team}`)
  teamOf.set(p.name, p.team)
  const key = `${g}|${p.name}|${p.team}`
  if (card.has(key)) flag(`card twice: ${key}`)
  card.add(key)
  if (!p.attrs || Object.values(p.attrs).some(v => typeof v !== 'number')) flag(`${p.name}: ratings missing`)
  if (!p.height || !p.weight) flag(`${p.name}: no height/weight`)
  if (p.number != null) {
    nums[p.team] ??= {}
    const was = nums[p.team][String(p.number)]
    if (was && was !== p.name) flag(`${p.team} #${p.number}: ${was} and ${p.name}`)
    nums[p.team][String(p.number)] = p.name
  }
  if (!(p.name in BIRTH_NBA)) flag(`${p.name}: no birth year`)
}
const men = [...teamOf.keys()]
console.log(`pool: ${all.length} cards, ${men.length} men, ${men.filter(n => HS[n]).length} with an ESPN photo, ${all.filter(([p]) => p.number == null).length} cards without a number`)

const espnFile = process.argv[2]
if (espnFile) {
  const E = JSON.parse(fs.readFileSync(espnFile, 'utf8'))
  const norm = n => n.normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase().replace(/[.'\-]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').split(/\s+/).filter(Boolean).join(' ')
  const pool = new Map(men.map(n => [norm(n), teamOf.get(n)]))
  const esp = new Map(E.map(e => [norm(e.name), e.team]))
  let miss = 0, wrong = 0, extra = 0
  for (const [n, t] of esp) { if (!pool.has(n)) { miss++; flag(`ESPN ${t} ${n}: not in the pool`) } else if (pool.get(n) !== t) { wrong++; flag(`${n}: pool ${pool.get(n)}, ESPN ${t}`) } }
  for (const [n, t] of pool) if (!esp.has(n)) { extra++; flag(`${t} ${n}: not on an ESPN roster`) }
  console.log(`vs ESPN: ${esp.size} men, ${miss} missing, ${wrong} on the wrong team, ${extra} the pool has that ESPN doesn't`)
}

const F = N.createNbaFranchise({ seed: 'rosters', team: 'BOS', owner: 'Graham' })
const rows = []
for (const s of N.SHORTS) {
  const r = F.teams[s].r
  const std = r.filter(p => !p.tw), tw = r.filter(p => p.tw)
  const real = r.filter(p => !p.gn)
  rows.push(`${s} ${std.length}+${tw.length} real ${real.length} (std ${std.filter(p => !p.gn).length}, tw ${tw.filter(p => !p.gn).length}) made-up ${r.length - real.length}`)
  if (std.length !== 15) flag(`${s}: ${std.length} standard men`)
  if (tw.length < 2 || tw.length > 3) flag(`${s}: ${tw.length} two-way men`)
  const n = {}
  for (const p of r) if (p.num != null) { if (n[p.num]) flag(`${s} league #${p.num}: ${n[p.num]} and ${p.n}`); n[p.num] = p.n }
}
console.log(rows.join('\n'))
const hurt = N.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.inj).map(p => `${s} ${p.n} ${p.inj.k} ${p.inj.g}g${p.inj.se ? ' (season)' : ''}`))
const faHurt = (F.fa ?? []).filter(p => p.inj).map(p => `FA ${p.n} ${p.inj.k}`)
console.log(`opening night out: ${hurt.length + faHurt.length}\n  ` + [...hurt, ...faHurt].join('\n  '))
for (const n of Object.keys(NBA_DAY_ONE_INJURIES)) if (!teamOf.has(n)) flag(`injury list: ${n} is not in the pool`)
if (hurt.length + faHurt.length !== Object.keys(NBA_DAY_ONE_INJURIES).length) flag('an opening-night injury did not land')
const G = N.createNbaFranchise({ seed: 'rosters', team: 'BOS', owner: 'Graham', rules: { inj: false } })
if (N.SHORTS.some(s => G.teams[s].r.some(p => p.inj))) flag('injuries off, yet a man starts hurt')
console.log(`free agents at the start: ${F.fa.length} (${F.fa.filter(p => !p.gn).map(p => p.n).join(', ')})`)
console.log(bad.length ? `${bad.length} PROBLEMS` : 'OK')
