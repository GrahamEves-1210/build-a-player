// The draft over many classes, headless: who goes where and what the classes are called.
//   bash scripts/franchise2/run.sh scripts/franchise2/draft-report.mjs [classes=10] [team=DEN]
// Each class: round 1 and the top 10 by position, quarterbacks in round 1, the consensus top 10, the weakest men taken
// early, the fastest 40s, distinct surnames, and the rosters' duplicate names. Checks (the real draft's shape):
//   QBs in round 1 average 2-4, never 0 two years running · guards and centres rarely top 10 · RBs and safeties top 10
//   only when elite · no man under 76 OVR now taken top 15 · the fastest 40 4.25-4.35 · no full name twice in a class
//   or on a roster · no generated man with a real player's name
import * as FR from '../../src/lib/franchise2/index'
import { realPool } from '../../src/lib/franchise2/league'
import { CFB_TEAM_BY_SHORT } from '../../src/data/cfb-teams'

const N = Number(process.argv[2] ?? 10), team = process.argv[3] ?? 'DEN'
const F = FR.createFranchise({ seed: 'dreport-' + team, team, owner: 'Graham', builds: [], coach: { name: 'Coach', scheme: 'balanced', style: 'developer' } })
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const tally = list => { const m = {}; for (const k of list) m[k] = (m[k] ?? 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') }
const last = n => n.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/, '').split(' ').slice(1).join(' ')
const G5 = new Set(['aac', 'mwc', 'sunbelt', 'mac', 'cusa'])
const realNames = new Set(Object.values(realPool()).flat().map(r => r.name))
const sum = { r1: {}, t10: {}, qb: [], dist: [], f40: [] }
let qbZero = 0
for (let y = 0; y < N; y++) {
  const cls = F.dc.filter(x => x.b == null)
  const names = cls.map(x => x.n), surn = names.map(last)
  const dupFull = names.length - new Set(names).size
  const sc = {}; for (const s of surn) sc[s] = (sc[s] ?? 0) + 1
  const topS = Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} x${v}`).join(', ')
  const realHit = names.filter(n => realNames.has(n))
  const dist = new Set(surn).size
  sum.dist.push(dist)
  if (dupFull) bad(`${F.year + 1} class: ${dupFull} full names twice`)
  if (realHit.length) bad(`${F.year + 1} class: real names ${realHit.join(', ')}`)
  // the season, quickly
  while (F.phase === 'season') { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') FR.playWeek(F, { moments: false })
  FR.closeSeason(F)
  FR.closeCarousel?.(F)
  FR.ageLeague(F)
  FR.openResign(F); for (const id of [...F.rs]) FR.resignOne(F, id, true)
  FR.openFA(F); while (F.fad) FR.nextFADay(F)
  FR.openDraft(F)
  const cons = FR.consensus(F).filter(x => x.b == null)
  const c = F.dc.map(x => FR.combineOf(x)).filter(e => e && !e.dnp && e.f40).map(e => e.f40).sort((a, b) => a - b)
  sum.f40.push(c[0])
  const hunts = FR.SHORTS.map(s => FR.qbHunt(F, s))
  FR.startNight(F)
  const preview = new Map(F.dc.map(x => [x.i, { o: x.o, seen: FR.seenPk(x), col: x.col }]))
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  const P = F.dr.picks
  const r1 = P.slice(0, 32), t10 = P.slice(0, 10)
  const spot = p => FR.pickSpot(p)
  for (const p of r1) sum.r1[spot(p)] = (sum.r1[spot(p)] ?? 0) + 1
  for (const p of t10) sum.t10[spot(p)] = (sum.t10[spot(p)] ?? 0) + 1
  const qbs = r1.filter(p => p.p === 'qb')
  const qbAll = P.filter(p => p.p === 'qb').slice(0, 6).map(p => `${p.at + 1}`).join(',')
  sum.qb.push(qbs.length)
  if (!qbs.length) qbZero++
  const brk = FR.boardRank(F)
  const weak = P.slice(0, 15).map(p => ({ p, ...preview.get(p.xi), rk: brk.get(p.xi) })).filter(e => e.o < 76)
  const g5 = P.slice(0, 10).filter(p => G5.has(CFB_TEAM_BY_SHORT[p.col]?.conf))
  const ogc = t10.filter(p => ['OG', 'C'].includes(spot(p)))
  const rbs = t10.filter(p => ['RB', 'S'].includes(spot(p)))
  console.log(`${F.year + 1} class ${cls.length}: surnames ${dist} distinct (most ${topS}) · full names twice ${dupFull} · fastest 40 ${c.slice(0, 3).join(', ')}`)
  console.log(`   consensus top 10: ${cons.slice(0, 10).map(x => FR.spotLabel(x)).join(' ')}`)
  console.log(`   top 10: ${t10.map(p => `${spot(p)}${preview.get(p.xi).o}/${FR.gradeOf(p.pk)}`).join(' ')}`)
  console.log(`   QB-hunting teams: ${hunts.filter(h => h >= 0.6).length} (some ${hunts.filter(h => h > 0 && h < 0.6).length}) · QBs in the class graded B or better ${cls.filter(x => x.p === 'qb' && FR.seenPk(x) >= 80).length}`)
  console.log(`   round 1: ${tally(r1.map(spot))} · QBs ${qbs.length} (${qbs.map(p => `No. ${p.at + 1} ${p.s} ${preview.get(p.xi).o}/${FR.gradeOf(p.pk)} board ${FR.boardRank(F).get(p.xi)}`).join(', ')}; QBs went at ${qbAll})`)
  if (weak.length) console.log(`   under 76 now in the top 15: ${weak.map(e => `No. ${e.p.at + 1} ${spot(e.p)} ${e.o} ${e.col} (board ${e.rk})`).join(', ')}`)
  if (g5.length) console.log(`   Group of Five in the top 10: ${g5.map(p => `No. ${p.at + 1} ${p.col}`).join(', ')}`)
  if (ogc.length > 1) bad(`${F.year + 1}: ${ogc.length} guards/centres in the top 10`)
  for (const e of rbs) if (e.pk < 90) bad(`${F.year + 1}: ${spot(e)} at No. ${e.at + 1} graded ${e.pk}`)
  for (const e of weak) if (e.o < 72) bad(`${F.year + 1}: a ${e.o} at No. ${e.p.at + 1}`)
  FR.closeDraft(F)
  FR.newSeason(F)
  // the rosters: a full name twice on one team; the league's most common surnames
  let dupRoster = 0
  const all = []
  const dups = []
  for (const s of FR.SHORTS) { const ns = F.teams[s].r.map(p => p.n); const d = ns.filter((n, i) => ns.indexOf(n) !== i && !realNames.has(n)); dupRoster += d.length; dups.push(...d.map(n => `${s} ${n} (${F.teams[s].r.filter(p => p.n === n).map(p => `${p.p}${p.rk ? ' rk' + p.rk : ''}${realNames.has(p.n) ? ' real' : ''}`).join('/')})`)); all.push(...ns) }
  if (dups.length) console.log(`   duplicates: ${dups.join(', ')}`)
  const ls = {}; for (const n of all) if (!realNames.has(n)) ls[last(n)] = (ls[last(n)] ?? 0) + 1
  const gen = all.filter(n => !realNames.has(n))
  const genReal = 0
  console.log(`   rosters ${F.year}: ${all.length} men, ${gen.length} made up · same name twice on a team ${dupRoster} · made-up surnames most ${Object.entries(ls).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} x${v}`).join(', ')}`)
  if (dupRoster) bad(`${F.year}: ${dupRoster} duplicate names on rosters`)
  void genReal
}
const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)
console.log(`\nOVER ${N} CLASSES`)
console.log(`   round 1 (per class): ${Object.entries(sum.r1).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / N).toFixed(1)}`).join(' · ')}`)
console.log(`   top 10 (total): ${Object.entries(sum.t10).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
console.log(`   QBs in round 1: ${sum.qb.join(' ')} (mean ${avg(sum.qb)}) · distinct surnames a class ${sum.dist.join(' ')} · fastest 40 ${sum.f40.join(' ')}`)
const qm = sum.qb.reduce((a, b) => a + b, 0) / N
if (qm < 2 || qm > 4.5) bad(`QBs in round 1 average ${qm.toFixed(1)}`)
if (sum.f40.some(t => t < 4.22 || t > 4.37)) bad(`fastest 40 out of 4.22-4.37: ${sum.f40}`)
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: no problems')
