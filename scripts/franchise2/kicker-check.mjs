// Kickers in Franchise, over several seasons: one K on every roster at each season's start (never more than two in a
// season: a hurt kicker and the man signed for him), the real starters in year one (ks.js) with real ages and deals,
// the player's K build in place of his team's kicker (the veteran released), the league's kicking against the NFL's
// (FG about 85%, XP about 95%, 50+ about 70%), kickers' careers into their late 30s, no K on the MVP / OPOY / DPOY
// ballots but a K on the All-Pro team, the draft's rare kicker late. Then a save from before kickers, read back
// (index.js depthOnLoad: the kickers added, seeded, the same on a second load).
//   bash scripts/franchise2/run.sh scripts/franchise2/kicker-check.mjs [seasons=4] [team=DAL]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { KS } from '../../src/data/ks'

const N = Number(process.argv[2] ?? 4), team = process.argv[3] ?? 'DAL'
FR.useContracts(CONTRACTS)
const store = new Map()
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }
const problems = []
const bad = m => { if (problems.length < 60) console.log('  !! ' + m); problems.push(m) }
const kb = { power: { val: 8 }, accuracy: { val: 8 }, clutch: { val: 7 } }
const realK = KS.find(k => k.team === team)
const F = FR.createFranchise({ seed: 'kick-' + team, team, owner: 'G', builds: [{ pos: 'k', build: kb, name: 'Nico Brandt', num: 3 }] })

// ── year one ──
const ks = s => F.teams[s].r.filter(p => p.p === 'k')
for (const s of FR.SHORTS) {
  const k = ks(s)
  if (k.length !== 1) bad(`start ${s}: ${k.length} kickers`)
  if (s === team) continue
  const real = KS.find(x => x.team === s)
  if (k[0]?.n !== real?.name) bad(`start ${s}: kicker ${k[0]?.n}, the real one is ${real?.name}`)
  if (!FR.photoId(k[0])) bad(`start ${s}: ${k[0]?.n} has no headshot`)
}
const mineK = ks(team)[0]
if (mineK?.b == null) bad(`${team}: the build is not the kicker (${mineK?.n})`)
const rel = (F.fa ?? []).find(p => p.n === realK.name)
console.log(`${team}: ${mineK?.n} (${mineK?.o}) kicks; ${realK.name} ${rel ? `released, on the street (${rel.o})` : 'NOT on the street'} · dead money ${JSON.stringify(F.teams[team].dead ?? [])}`)
if (!rel) bad(`${realK.name} not released`)
const ages = FR.SHORTS.map(s => ks(s)[0]).filter(p => p && p.b == null).map(p => p.ag)
console.log(`year-one kickers: ages ${Math.min(...ages)}-${Math.max(...ages)}, deals ${FR.SHORTS.filter(s => s !== team).map(s => `${s} $${ks(s)[0].$}M/${ks(s)[0].y}y`).slice(0, 6).join(', ')} …`)
{ const C = FR.depthChart(F, team); if (C.k?.length !== 1) bad(`${team} chart K room has ${C.k?.length}`); if (FR.startersOf(F, team).k1?.i !== mineK?.i) bad(`${team}: build is not K1`) }

const seasons = []
let maxK = 0
for (let y = 0; y < N; y++) {
  for (const s of FR.SHORTS) { const n = ks(s).length; if (n !== 1) bad(`${F.year} wk1 ${s}: ${n} kickers`) }
  while (F.phase === 'season') {
    FR.playWeek(F, { moments: false })
    if (F.ev) FR.chooseEvent(F, y % 2)
    for (const s of FR.SHORTS) { const n = ks(s).length; maxK = Math.max(maxK, n); if (n > 2) bad(`${F.year} wk${F.wk} ${s}: ${n} kickers`); if (!n) bad(`${F.year} wk${F.wk} ${s}: no kicker`) }
  }
  const tot = Object.values(F.kst ?? {})
  const sum = k => tot.reduce((a, t) => a + (t[k] ?? 0), 0)
  const games = FR.SHORTS.length * 17
  const row = { y: F.year, fg: sum('fgm') / sum('fga'), xp: sum('xpm') / sum('xpa'), f50: sum('m50') / Math.max(1, sum('a50')), fga: sum('fga') / games, a50: sum('a50') / games, lg: Math.max(...tot.map(t => t.lg)) }
  const kAll = FR.SHORTS.map(s => ks(s)[0]).filter(Boolean)
  row.ovr = kAll.reduce((a, p) => a + p.o, 0) / kAll.length
  row.ag = kAll.reduce((a, p) => a + p.ag, 0) / kAll.length
  row.old = kAll.filter(p => p.ag >= 36).length
  // (the leaders: the most field goals; a kicker's season line)
  const L = FR.leaders(F, 'fgm', 3)
  row.lead = L.map(x => `${x.p.n} ${FR.statLine(x.p, x.t)}`).join(' | ')
  FR.intoPlayoffs(F); FR.simPlayoffs(F)
  FR.closeSeason(F)
  const aw = F.aw
  for (const k of ['mvp', 'opoy', 'dpoy', 'oroy', 'droy']) if (aw[k]?.p === 'k') bad(`${F.year} ${k} to a kicker`)
  const apK = aw.ap.filter(x => x.spot === 'k')
  if (apK.length !== 1) bad(`${F.year} ${apK.length} All-Pro kickers`)
  row.ap = apK.map(x => `${x.n} (${x.line})`).join('')
  seasons.push(row)
  FR.ageLeague(F)
  FR.openResign(F)
  for (const id of [...F.rs]) { const p = F.teams[F.team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? 'option' : p.o >= 76) }
  FR.openFA(F)
  row.faK = F.fa.filter(p => p.p === 'k').length
  while (F.fad) FR.nextFADay(F)
  row.dcK = (F.dc ?? []).filter(x => x.p === 'k').length
  { const board = FR.consensus(F, 22); row.kRank = board.map((x, r) => (x.p === 'k' ? `#${r + 1}` : null)).filter(Boolean).join('/') }
  FR.openDraft(F); while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  row.kPicks = F.dr.picks.filter(x => x.p === 'k').map(x => `R${Math.floor(x.at / 32) + 1}#${x.at + 1}`).join(' ') || 'none'
  FR.closeDraft?.(F)
  FR.newSeason(F)
}
for (const s of FR.SHORTS) { const n = ks(s).length; if (n !== 1) bad(`${F.year} wk1 ${s}: ${n} kickers`) }
const pc = v => `${(v * 100).toFixed(1)}%`
for (const r of seasons) console.log(`${r.y}: FG ${pc(r.fg)} · XP ${pc(r.xp)} · 50+ ${pc(r.f50)} · FGA a team-game ${r.fga.toFixed(2)} · 50+ tries ${r.a50.toFixed(2)} · long ${r.lg} · K OVR ${r.ovr.toFixed(1)} age ${r.ag.toFixed(1)} (${r.old} 36+) · FA kickers ${r.faK} · class ${r.dcK} (big board ${r.kRank}) · drafted ${r.kPicks}\n    leaders ${r.lead}\n    All-Pro K ${r.ap}`)
const all = k => seasons.reduce((a, r) => a + r[k], 0) / seasons.length
console.log(`average: FG ${pc(all('fg'))} · XP ${pc(all('xp'))} · 50+ ${pc(all('f50'))} · most kickers on one roster in a season ${maxK}`)
if (all('fg') < 0.82 || all('fg') > 0.88) bad(`FG% ${pc(all('fg'))} outside 82-88`)
if (all('xp') < 0.93 || all('xp') > 0.97) bad(`XP% ${pc(all('xp'))} outside 93-97`)
if (all('f50') < 0.62 || all('f50') > 0.78) bad(`50+ ${pc(all('f50'))} outside 62-78`)
const oldest = Math.max(...FR.SHORTS.map(s => ks(s)[0]?.ag ?? 0))
console.log(`oldest kicker now ${oldest}`)

// ── a save from before kickers ──
const X = FR.createFranchise({ seed: 'oldsave', team: 'KC', owner: 'G', builds: [] })
for (let w = 0; w < 3; w++) FR.playWeek(X, { moments: false })
for (const s of FR.SHORTS) { const t = X.teams[s]; t.r = t.r.filter(p => p.p !== 'k'); if (t.dc) delete t.dc.k }
delete X.kst
store.set('bap_fr2_slot_1', FR.packFranchise({ ...X, slot: 1 }))
const A = FR.loadFranchise(1), B = FR.loadFranchise(1)
if (!A) bad('old save did not load')
else {
  const missing = FR.SHORTS.filter(s => A.teams[s].r.filter(p => p.p === 'k').length !== 1)
  if (missing.length) bad(`old save: ${missing.join(' ')} without exactly one kicker`)
  const names = s => A.teams[s].r.filter(p => p.p === 'k').map(p => `${p.n} ${p.ag} $${p.$}M ${p.y}y`).join()
  const same = FR.SHORTS.every(s => names(s) === B.teams[s].r.filter(p => p.p === 'k').map(p => `${p.n} ${p.ag} $${p.$}M ${p.y}y`).join())
  if (!same) bad('old save: a second load gave different kickers')
  console.log(`old save: kickers added on load, e.g. KC ${names('KC')}, DAL ${names('DAL')} · same on a second load: ${same}`)
  A.ev = null; A.pend = null
  FR.playWeek(A, { moments: false })
  if (!Object.keys(A.kst ?? {}).length) bad('old save: no kicking lines after a week')
}
console.log(problems.length ? `${problems.length} problems` : 'kickers: all good')
process.exit(problems.length ? 1 : 0)
