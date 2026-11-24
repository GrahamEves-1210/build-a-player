// NBA rosters, headless: the shared pools every mode reads (data/nba-guards.js, nba-bigs.js) and the league NBA
// Franchise opens with, then the floor season by season.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-rosters.mjs [seasons=0] [espnRows.json]
// The pools: every man on a team on the spin wheel, no man on two teams, no name|team card twice, ratings, a height
// and a weight, a birth year, a jersey number once a team. The league at the open: at least 10 real men a team
// (data/nba-franchise-roster.js adds only what it takes), the rest fillers (p.fl) on one-year minimums, no other
// made-up men, the waived men on the street, the opening-night injuries on the right men; a table of real men,
// additions, fillers and payroll a team. With seasons > 0: full seasons and summers, and at every opening night each
// CPU team's real-or-drafted men (the floor: 10) against its fillers. With ESPN's rows ({ team, name }): how many of
// each team's ESPN men Franchise opens with.
import * as N from '../../src/lib/franchise2/nba/index'
import { realPool, isReal } from '../../src/lib/franchise2/nba/league'
import { NBA_GUARD_PLAYERS } from '../../src/data/nba-guards'
import { NBA_BIG_PLAYERS } from '../../src/data/nba-bigs'
import { NBA_TEAMS } from '../../src/data/nba-teams'
import { NBA_DAY_ONE_INJURIES } from '../../src/data/nba-injuries'
import { NBA_FRANCHISE_ADDS, NBA_FRANCHISE_STREET, REAL_FLOOR } from '../../src/data/nba-franchise-roster'
import { BIRTH_NBA } from '../../src/data/player-ages'
import fs from 'fs'

const SEASONS = +(process.argv[2] ?? 0), espnFile = process.argv[3]
const bad = []
const flag = m => { bad.push(m); console.log('  !! ' + m) }
const X = N.CAP_SIM

// ── the shared pools ──
const shorts = new Set(NBA_TEAMS.map(t => t.short))
const all = [...NBA_GUARD_PLAYERS.map(p => [p, 'guard']), ...NBA_BIG_PLAYERS.map(p => [p, 'big'])]
const teamOf = new Map(), card = new Set(), nums = {}
// (Knecht's card stays a Laker by the owner's call, 11-23; Thybulle wears his old 4)
const KNOWN_DUP = new Set(['LAL#4'])
for (const [p, g] of all) {
  if (!shorts.has(p.team)) flag(`${p.name}: team ${p.team} is not on the wheel`)
  if (teamOf.has(p.name) && teamOf.get(p.name) !== p.team) flag(`${p.name} on ${teamOf.get(p.name)} and ${p.team}`)
  teamOf.set(p.name, p.team)
  const key = `${g}|${p.name}|${p.team}`
  if (card.has(key)) flag(`card twice: ${key}`)
  card.add(key)
  if (!p.attrs || Object.values(p.attrs).some(v => typeof v !== 'number')) flag(`${p.name}: ratings missing`)
  if (!p.height || !p.weight) flag(`${p.name}: no height/weight`)
  if (!(p.name in BIRTH_NBA)) flag(`${p.name}: no birth year`)
  if (p.number != null) {
    nums[p.team] ??= {}
    const was = nums[p.team][String(p.number)]
    if (was && was !== p.name && !KNOWN_DUP.has(`${p.team}#${p.number}`)) flag(`${p.team} #${p.number}: ${was} and ${p.name}`)
    nums[p.team][String(p.number)] = p.name
  }
}
console.log(`pools: ${all.length} cards, ${teamOf.size} men`)

// ── the league at the open ──
const F = N.createNbaFranchise({ seed: 'rosters', team: 'BOS', owner: 'Graham' })
const yr = X.capYear(F)
const added = new Set(NBA_FRANCHISE_ADDS.map(r => r.name))
const esp = espnFile ? JSON.parse(fs.readFileSync(espnFile, 'utf8')) : null
const loose = n => n.normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase().replace(/[.'\-]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').split(/\s+/).filter(Boolean).join(' ')
console.log('team  real  added  fillers(std+tw)  payroll  ' + (esp ? 'ESPN men carried' : ''))
for (const s of N.SHORTS) {
  const r = F.teams[s].r
  const real = r.filter(isReal), fl = r.filter(p => p.fl)
  const other = r.filter(p => !isReal(p) && !p.fl)
  if (real.length < REAL_FLOOR) flag(`${s}: ${real.length} real men at the open`)
  if (other.length) flag(`${s}: made-up men that aren't fillers: ${other.map(p => p.n).join(', ')}`)
  for (const p of fl) {
    if (p.y !== 1) flag(`${s} filler ${p.n}: ${p.y} years`)
    if (!p.tw && p.$ > X.minOf(p.ys ?? 0, yr) + 0.01) flag(`${s} filler ${p.n}: $${p.$}M, over the minimum`)
    if (p.o > 66) flag(`${s} filler ${p.n}: OVR ${p.o}`)
  }
  const n = {}
  for (const p of r) if (p.num != null) { if (n[p.num]) flag(`${s} #${p.num}: ${n[p.num]} and ${p.n}`); n[p.num] = p.n }
  let espTxt = ''
  if (esp) { const mine = esp.filter(e => e.team === s); const have = new Set(real.map(p => loose(p.n))); espTxt = `${mine.filter(e => have.has(loose(e.name))).length}/${mine.length}` }
  console.log(`${s}   ${String(real.length).padStart(2)}    ${real.filter(p => added.has(p.n)).length}      ${String(fl.length).padStart(2)} (${fl.filter(p => !p.tw).length}+${fl.filter(p => p.tw).length})       ${X.payroll(F, s, yr).toFixed(1).padStart(6)}   ${espTxt}`)
}
const street = new Set((F.fa ?? []).map(p => p.n))
for (const n of NBA_FRANCHISE_STREET) if (realPool().some(r => r.name === n) && !street.has(n)) flag(`${n} is not on the street`)
const hurt = N.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.inj).map(p => `${s} ${p.n} (${p.inj.k}, ${p.inj.g} g)`))
console.log(`opening night out: ${hurt.join('; ')}`)
if (hurt.length !== Object.keys(NBA_DAY_ONE_INJURIES).length) flag('an opening-night injury did not land')
const G = N.createNbaFranchise({ seed: 'rosters', team: 'BOS', owner: 'Graham', rules: { inj: false } })
if (N.SHORTS.some(s => G.teams[s].r.some(p => p.inj))) flag('injuries off, yet a man starts hurt')

// ── the floor, season by season ──
for (let y = 0; y < SEASONS; y++) {
  while (F.phase === 'season') { const out = N.playNext(F, { moments: false }); if (out?.pending) N.momentSim(F, N.momentPlan(F)) }
  N.startPostseason(F)
  while (F.phase === 'playin' || F.phase === 'playoffs') { const out = N.playPoNight(F, { moments: false }); if (out?.pending) N.momentSim(F, N.momentPlan(F)) }
  N.closeSeason(F)
  while (F.phase === 'off') {
    const st = F.off.step
    if (st === 'resign') for (const i of [...(F.off.mine ?? [])]) N.resignMine(F, i, true)
    if (st === 'camp') { const T = F.teams[F.team]; while (T.r.filter(p => !p.tw).length > 15) { const p = T.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0]; X.cutMan(F, F.team, p.i) } }
    N.nextStep(F)
  }
  const rows = N.SHORTS.map(s => { const r = F.teams[s].r; return [s, r.filter(isReal).length, r.filter(p => p.fl).length, r.filter(p => !isReal(p) && !p.fl).length] })
  for (const [s, re] of rows) if (s !== F.team && re < REAL_FLOOR) flag(`${F.year}: ${s} opens with ${re} real or drafted men`)
  console.log(`${F.year} opening night: real or drafted ${Math.min(...rows.map(r => r[1]))}-${Math.max(...rows.map(r => r[1]))} a team, fillers ${rows.reduce((a, r) => a + r[2], 0)}, other made-up ${rows.reduce((a, r) => a + r[3], 0)}`)
  console.log('  real/fillers(+other made-up): ' + rows.map(([s, re, fl, gn]) => `${s} ${re}/${fl}${gn ? '+' + gn : ''}`).join(' '))
}
console.log(bad.length ? `${bad.length} PROBLEMS` : 'OK')
