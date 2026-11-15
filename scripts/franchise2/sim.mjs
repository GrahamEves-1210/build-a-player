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
let F = FR.createFranchise({ seed: 'sim-' + team, team, owner: 'Graham', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 12 }, { pos: 'wr', build: asBuild(wr), name: 'Tre Holloway', num: 81 }], coach: { name: 'Isaiah Vance', style: 'developer', r: { talentDev: 7, offPlaycalling: 8, defPlaycalling: 5, culture: 6, situational: 6 }, ovr: 78 } })
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const meanOvr = () => { const all = FR.SHORTS.flatMap(s => Object.values(FR.lineup(F.teams[s])).map(p => p.o)); return (all.reduce((a, b) => a + b, 0) / all.length).toFixed(1) }
const H = seeded('hits')
let dealt = 0
let base = null
const ages = []
const realNames = new Set(FR.SHORTS.flatMap(s => F.teams[s].r.filter(p => FR.realOf(p.p, p.n)).map(p => p.n)))
function league() {
  const st = FR.SHORTS.flatMap(s => Object.values(FR.lineup(F.teams[s])))
  const all = FR.SHORTS.flatMap(s => F.teams[s].r)
  const avg = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 0
  const stars = all.filter(p => p.o >= 90)
  const rooms = FR.SHORTS.map(s => FR.capSheet(F, s).room).sort((a, b) => a - b)
  return { mean: avg(st.map(p => p.o)), age: avg(st.map(p => p.ag)), n90: stars.length, n95: all.filter(p => p.o >= 95).length, starAge: avg(stars.map(p => p.ag)), real: all.filter(p => realNames.has(p.n)).length, qb85: all.filter(p => p.p === 'qb' && p.o >= 85).length, room: rooms[16] }
}
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
  FR.openResign(F)
  for (const id of [...F.rs]) {
    const p = F.teams[team].r.find(x => x.i === id)
    if (FR.optionDue(p)) { FR.resignOne(F, id, p.o >= 80 ? 'option' : 'decline'); continue }
    const ask = FR.resignAsk(p, F)
    FR.resignOne(F, id, p.b != null || (p.o >= 76 && FR.canSign(F, ask.$)))
  }
  FR.openFA(F)
  let bids = 0, won = 0
  while (F.fad) {
    // a bid a day on the best man the team can fit, at his ask
    const p = FR.faBoard(F, 8).find(x => FR.canSign(F, x.$) && x.o >= 78)
    if (p) { const b = FR.placeBid(F, p.i, p.$); bids++; if (b?.to === team) won++ }
    FR.nextFADay(F)
  }
  for (const s of FR.SHORTS) { const c = FR.capSheet(F, s); if (c.room < -25) bad(`${F.year} ${s} ${-c.room}M over the cap after FA`) }
  FR.openDraft(F)
  // visit, film and star a few, then the draft: seven rounds (scripts/franchise2/draft.mjs checks scouting and trades)
  for (const x of FR.consensus(F).slice(0, 5)) { FR.interview(F, x.i); FR.film(F, x.i); FR.star(F, x.i) }
  FR.startNight(F)
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft(F)
  const mine = F.dr.picks.filter(p => p.s === team)
  if (F.dr.picks.length !== FR.PICKS_N || new Set(F.dr.picks.map(p => p.pid)).size !== FR.PICKS_N) bad('draft picks')
  if (mine.some(p => !F.teams[team].r.find(q => q.i === p.pid)?.rc)) bad('a pick without a rookie deal')
  console.log(`   offseason: ${ch.filter(c => c.k === 'ret').length} of ours retired, ${ch.filter(c => c.k === 'up').length} up, ${ch.filter(c => c.k === 'down').length} down; drafted ${mine.map(p => `${p.p.toUpperCase()} ${FR.GRADES[FR.gradeIdx(p.pk)]}${p.tag === 'G' ? ' GEM' : p.tag === 'B' ? ' BUST' : ''}`).join(', ')}; builds ${F.builds.map(b => `${b.pos} ${F.teams[team].r.find(p => p.b === F.builds.indexOf(b))?.o ?? 'gone'} age ${b.age}`).join(', ')}`)
  FR.newSeason(F)
  const size = FR.saveSize(F)
  const players = FR.SHORTS.reduce((a, s) => a + F.teams[s].r.length, 0)
  const cap = FR.capSheet(F, team)
  console.log(`   new season ${F.year}: ${players} players, cap ${cap.cap} used ${cap.used} room ${cap.room}, FA bids ${bids} won ${won}, save ${(size / 1024).toFixed(0)} KB, moments so far ${dealt}`)
  if (size > 190 * 1024) bad(`save ${size}`)   // (15 seasons in: about 170 KB)
  // the league's talent over the years (aging and growth): it should hold about where the real league started
  const L = league()
  console.log(`   league: starters ${L.mean} OVR, age ${L.age}, ${L.n90} men 90+, ${L.n95} 95+, stars' ages ${L.starAge}, real men left ${L.real}, QBs 85+ ${L.qb85}, cap room median ${L.room}M`)
  ages.push(L)
  if (y === 0) base = L
  else if (Math.abs(L.mean - base.mean) > 2.5) bad(`${F.year} league starters ${L.mean} vs ${base.mean} at the start`)
  if (L.n90 < base.n90 * 0.45 || L.n90 > base.n90 * 1.8) bad(`${F.year} ${L.n90} men 90+ (started with ${base.n90})`)
}
// the shape of a career: how old the league's starters are, and when men retire
console.log('starters 90+ by year:', ages.map(a => a.n90).join(' '), '· mean OVR by year:', ages.map(a => a.mean).join(' '))
{ const P = JSON.parse(FR.packFranchise(F)); console.log('save by part (KB):', Object.entries(P).map(([k, v]) => [k, JSON.stringify(v ?? null).length]).filter(([, n]) => n > 1500).map(([k, n]) => `${k} ${(n / 1024).toFixed(1)}`).join(', '), '· careers', FR.SHORTS.reduce((a, s) => a + F.teams[s].r.filter(p => p.cr).length, 0), '· men', FR.SHORTS.reduce((a, s) => a + F.teams[s].r.length, 0)) }
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: no problems')
