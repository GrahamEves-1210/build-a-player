// Plays full seasons and offseasons through the Franchise engine, headless, and checks them:
// the schedule's shape, records, the bracket, aging, the league's talent over time, save size, speed.
//   bash scripts/franchise2/run.sh scripts/franchise2/sim.mjs [seasons=6] [team=DEN] [moments=1]
import * as FR from '../../src/lib/franchise2/index'
import { scheduleProblems } from '../../src/lib/franchise2/schedule'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'
import { seeded } from '../../src/lib/rng'

const N = Number(process.argv[2] ?? 6), team = process.argv[3] ?? 'DEN', moments = process.argv[4] !== '0'
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen'), wr = WRS.find(p => p.attrs && p.name === 'Puka Nacua') ?? WRS.find(p => p.attrs)
let F = FR.createFranchise({ seed: 'sim-' + team, team, owner: 'Graham', builds: [{ pos: 'qb', build: asBuild(qb) }, { pos: 'wr', build: asBuild(wr) }], coach: { name: 'Coach', scheme: 'air', style: 'developer' } })
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const meanOvr = () => { const all = FR.SHORTS.flatMap(s => Object.values(FR.lineup(F.teams[s])).map(p => p.o)); return (all.reduce((a, b) => a + b, 0) / all.length).toFixed(1) }
const H = seeded('hits')
let dealt = 0
for (let y = 0; y < N; y++) {
  const t0 = performance.now()
  const sp = scheduleProblems(F.sched.weeks, F.sched.bye); if (sp.length) bad(`${F.year} schedule: ${sp.slice(0, 3)}`)
  while (F.phase === 'season') {
    const r = FR.playWeek(F, { moments })
    if (r.pending) { dealt++; const v = FR.momentView(F); FR.finishMoment(F, H() < FR.normalRate(F.teams[F.team].r.find(p => p.i === v.pid).o)) }
    if (F.ev) FR.chooseEvent(F, H() < 0.5 ? 0 : 1)
  }
  const recs = FR.records(F)
  for (const s of FR.SHORTS) { const r = recs[s]; if (r.w + r.l + r.t !== 17) bad(`${F.year} ${s} played ${r.w + r.l + r.t}`) }
  const ties = FR.SHORTS.reduce((a, s) => a + recs[s].t, 0) / 2
  FR.intoPlayoffs(F)
  const po = F.po
  for (const c of ['AFC', 'NFC']) { if (new Set(po.seeds[c]).size !== 7 || po.seeds[c].some(s => FR.CONF_OF[s] !== c)) bad(`${F.year} ${c} seeds ${po.seeds[c]}`) }
  if (po.rounds[0].length !== 6 || po.rounds[0].some(g => g.h === po.seeds.AFC[0] || g.h === po.seeds.NFC[0] || g.a === po.seeds.AFC[0] || g.a === po.seeds.NFC[0])) bad(`${F.year} wild card round`)
  while (F.phase === 'playoffs') {
    const r = FR.playWeek(F, { moments })
    if (r.pending) { dealt++; const v = FR.momentView(F); FR.finishMoment(F, H() < FR.normalRate(F.teams[F.team].r.find(p => p.i === v.pid).o)) }
  }
  // nobody twice in a run; every round half the teams; the Super Bowl across conferences
  const met = {}
  po.rounds.forEach((games, i) => { if (games.length !== [6, 4, 2, 1][i]) bad(`round ${i} has ${games.length}`); for (const g of games) { for (const [a, b] of [[g.h, g.a], [g.a, g.h]]) { met[a] ??= new Set(); if (met[a].has(b)) bad(`${a} met ${b} twice`); met[a].add(b) } if (g.hs === g.as) bad('playoff tie') } })
  const sb = po.rounds[3][0]; if (FR.CONF_OF[sb.h] === FR.CONF_OF[sb.a]) bad('Super Bowl in one conference')
  // the 1 seed hosts the conference's later rounds while it's alive
  const t1 = performance.now()
  const banner = FR.closeSeason(F)
  const my = recs[team]
  console.log(`${F.year} ${team} ${FR.recText(my)} ${banner.fin}${banner.seed ? ` (${banner.seed} seed)` : ''} · champ ${po.champ} over ${po.runner} ${po.score} · MVP ${F.aw.mvp?.n} (${F.aw.mvp?.t}) · ties ${ties} · ovr ${FR.strength(F, team).ovr} · league starters ${meanOvr()} · hype ${F.hype} chem ${F.chem} · ${(t1 - t0).toFixed(0)} ms`)
  const ch = FR.ageLeague(F)
  const retired = FR.SHORTS.length
  FR.openResign(F)
  for (const id of [...F.rs]) { const p = F.teams[team].r.find(x => x.i === id); FR.resignOne(F, id, p.b != null || (p.o >= 74 && FR.resignAsk(p).$ <= FR.budgetLeft(F))) }
  FR.openFA(F)
  for (let r = 0; r < 3; r++) { const id = F.offers.find(i => { const p = F.fa.find(x => x.i === i); return p && p.$ <= FR.budgetLeft(F) }); if (id) FR.signFA(F, id); FR.nextFA(F) }
  // scout and star a few, then draft
  for (const x of F.dc.slice(0, 5)) { FR.scout(F, x.i); FR.star(F, x.i) }
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  const mine = F.dr.picks.filter(p => p.s === team)
  if (F.dr.picks.length !== 96 || new Set(F.dr.picks.map(p => p.pid)).size !== 96) bad('draft picks')
  console.log(`   offseason: ${ch.filter(c => c.k === 'ret').length} of ours retired, ${ch.filter(c => c.k === 'up').length} up, ${ch.filter(c => c.k === 'down').length} down; drafted ${mine.map(p => `${p.p.toUpperCase()} ${FR.GRADES[FR.gradeIdx(p.pk)]}${p.tag === 'G' ? ' GEM' : p.tag === 'B' ? ' BUST' : ''}`).join(', ')}; builds ${F.builds.map(b => `${b.pos} ${F.teams[team].r.find(p => p.b === F.builds.indexOf(b))?.o ?? 'gone'} age ${b.age}`).join(', ')}`)
  FR.newSeason(F)
  const size = FR.saveSize(F)
  const players = FR.SHORTS.reduce((a, s) => a + F.teams[s].r.length, 0)
  console.log(`   new season ${F.year}: ${players} players, budget ${F.budget} payroll ${FR.payroll(F.teams[team].r)}, save ${(size / 1024).toFixed(0)} KB, moments so far ${dealt}`)
  if (size > 160 * 1024) bad(`save ${size}`)
}
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: no problems')
