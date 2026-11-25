// Soccer's ratings and pools, checked (2026-11-16): node scripts/soccer/attrs-check.mjs
//  - every player in both pools (every club row, the 2026 World Cup's) has exactly the nine keys of data/soccer-attrs.js,
//    each an integer 0-11, and none of the ten old ones (firstTouch, linkUp, strength, offBall)
//  - a player in both pools has the same bio, ESPN id and attrs; Size is soccerSizeGrade of his bio
//  - the Champions League pool (the wheel and the card binder): every player's club is one of the 36, 8 a club, one
//    main striker a club, no name|club twice (so every card can be landed on a spin)
//  - old saves: migrateSoccerKeys turns a ten-trait build into the nine
// (WORLD CUP mode's legends, since 11-16 a pool of their own with peak ratings: scripts/soccer/wc-legends-check.mjs)
import { SOCCER_ALL_STRIKERS, UCL_STRIKERS, WC2026_STRIKERS as WC_STRIKERS, SOCCER_STRIKERS } from '../../src/data/soccer-strikers.js'
import { UCL_CLUBS, UCL_SHORTS, SOCCER_CLUBS } from '../../src/data/soccer-clubs.js'
import { SOCCER_TYPES, SOCCER_ATTR, soccerSizeGrade, migrateSoccerKeys } from '../../src/data/soccer-attrs.js'

const errs = []
const err = m => { if (errs.length < 60) errs.push(m) }
const OLD = ['firstTouch', 'linkUp', 'strength', 'offBall']
if (SOCCER_TYPES.length !== 9 || SOCCER_TYPES.some(t => !SOCCER_ATTR[t]) || Object.keys(SOCCER_ATTR).length !== 9) err('SOCCER_TYPES / SOCCER_ATTR are not the nine')

const rows = [...SOCCER_ALL_STRIKERS.map(p => ['club', p]), ...WC_STRIKERS.map(p => ['wc', p])]
for (const [pool, p] of rows) {
  const k = Object.keys(p.attrs ?? {})
  if (k.length !== 9 || !SOCCER_TYPES.every(t => k.includes(t))) err(`${pool} ${p.name} (${p.team}): keys ${k.join(',')}`)
  if (OLD.some(t => t in (p.attrs ?? {}))) err(`${pool} ${p.name}: an old key`)
  for (const t of SOCCER_TYPES) { const v = p.attrs?.[t]; if (!Number.isInteger(v) || v < 0 || v > 11) err(`${pool} ${p.name}: ${t} = ${v}`) }
}
// both pools: the same man, the same bio and grades
const byName = new Map()
for (const [, p] of rows) { const k = p.espn ?? p.name; if (!byName.has(k)) byName.set(k, []); byName.get(k).push(p) }   // (by ESPN id: two Vitinhas)
let both = 0
for (const [, list] of byName) {
  const name = list[0].name
  if (list.length < 2) continue
  both++
  const [a] = list
  for (const b of list.slice(1)) {
    for (const f of ['height', 'weight', 'age', 'espn']) if (a[f] !== b[f]) err(`${name}: ${f} ${a[f]} vs ${b[f]}`)
    for (const t of SOCCER_TYPES) if (a.attrs[t] !== b.attrs[t]) err(`${name}: ${t} ${a.attrs[t]} vs ${b.attrs[t]} (${a.team}/${b.team})`)
  }
  if (!list.some(p => soccerSizeGrade(p.height, p.weight, p.role) === a.attrs.size)) err(`${name}: size ${a.attrs.size} is not his bio's`)
}
for (const [, list] of byName) if (list.length === 1 && soccerSizeGrade(list[0].height, list[0].weight, list[0].role) !== list[0].attrs.size) err(`${list[0].name}: size not from his bio`)

// the Champions League pool
const ucl = new Set(UCL_CLUBS.map(c => c.short))
if (UCL_CLUBS.length !== 36 || ucl.size !== 36 || UCL_SHORTS.some(s => !ucl.has(s)) || UCL_CLUBS.some(c => !c.name || !(c.att > 0) || !(c.def > 0) || !(c.w > 0))) err('UCL_CLUBS is not 36 complete clubs')
const seen = new Set()
for (const p of UCL_STRIKERS) {
  if (!ucl.has(p.team)) err(`card ${p.name}: ${p.team} is not on the wheel`)
  const k = `${p.name}|${p.team}`
  if (seen.has(k)) err(`card ${k} twice`)
  seen.add(k)
}
for (const s of UCL_SHORTS) {
  const mine = UCL_STRIKERS.filter(p => p.team === s)
  if (mine.length < 3 || mine.length > 8) err(`${s}: ${mine.length} players (3 to 8)`)
  if (mine.filter(p => p.starter).length !== 1) err(`${s}: ${mine.filter(p => p.starter).length} main strikers`)
}
// Career's pool: the domestic leagues' clubs only
const career = new Set(SOCCER_CLUBS.map(c => c.short))
if (SOCCER_STRIKERS.some(p => !career.has(p.team))) err('Career pool has a player outside its leagues')
// an old save
const old = { finishing: { val: 9 }, shotPower: { val: 7 }, heading: { val: 6 }, dribbling: { val: 8 }, firstTouch: { val: 6 }, linkUp: { val: 5 }, pace: { val: 10 }, strength: { val: 4 }, offBall: { val: 9 }, composure: { val: 8 } }
const m = migrateSoccerKeys({ build: old, types: Object.keys(old) })
if (m.types.length !== 9 || !SOCCER_TYPES.every(t => m.types.includes(t) && m.build[t]?.val != null) || m.build.dribbling.val !== 7 || OLD.some(t => t in m.build)) err(`old save: ${JSON.stringify(m)}`)

const W = UCL_CLUBS.reduce((s, c) => s + c.w, 0)
const top = [...UCL_CLUBS].sort((a, b) => b.w - a.w).slice(0, 12)
console.log(`${rows.length} rows (${SOCCER_ALL_STRIKERS.length} club, ${WC_STRIKERS.length} 2026 World Cup), ${both} players in both pools`)
console.log(`Champions League pool: ${UCL_STRIKERS.length} players at ${UCL_CLUBS.length} clubs; spins on the 12 biggest: ${(top.reduce((s, c) => s + c.w, 0) / W * 100).toFixed(1)}%`)
console.log(errs.length ? `ERRORS (${errs.length}):\n${errs.join('\n')}` : 'nine keys everywhere, both pools identical, every card on the wheel: OK')
process.exitCode = errs.length ? 1 : 0
