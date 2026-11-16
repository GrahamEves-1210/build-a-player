// The coaching carousel over many seasons, headless: how many head coaches change a year (the NFL: about 5-8),
// coordinators, where new head coaches come from, the league's play-callers' level (it should hold near year one),
// every team always with a head coach, an OC and a DC, and what the staffs add to the save.
//   bash scripts/franchise2/run.sh scripts/franchise2/coaches.mjs [seasons=15] [team=DEN]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'

const N = Number(process.argv[2] ?? 15), team = process.argv[3] ?? 'DEN'
FR.useContracts(CONTRACTS)
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen')
const F = FR.createFranchise({ seed: 'coach-' + team, team, owner: 'Graham', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 12 }], coach: { name: 'Isaiah Vance', style: 'developer', r: { talentDev: 7, offPlaycalling: 8, defPlaycalling: 5, culture: 6, situational: 6 } } })
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
function callers() {
  const o = [], d = []
  for (const s of FR.SHORTS) { o.push(FR.callerOf(F, s, 'off').v); d.push(FR.callerOf(F, s, 'def').v) }
  return [avg(o).toFixed(2), avg(d).toFixed(2)]
}
function full(when) {
  for (const s of FR.SHORTS) { const M = FR.staffMen(F, s); for (const k of ['hc', 'oc', 'dc']) if (!M[k]) bad(`${F.year} ${when}: ${s} has no ${k}`) }
  const names = FR.SHORTS.flatMap(s => { const M = FR.staffMen(F, s); return [M.hc, M.oc, M.dc].filter(Boolean).map(c => c.n) })
  if (new Set(names).size !== names.length) bad(`${F.year} ${when}: one man on two staffs`)
}
console.log(`year one callers off/def ${callers().join(' / ')} (the real league: 6.66 / 6.25)`)
full('start')
const tot = { hc: 0, oc: 0, dc: 0, fire: 0, ret: 0, poach: 0, src: { coord: 0, retread: 0, college: 0 }, mine: 0 }
const firedW = []
for (let y = 0; y < N; y++) {
  while (F.phase === 'season') { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') FR.playWeek(F, { moments: false })
  const recs = FR.records(F)
  FR.closeSeason(F)
  if (F.stage !== 'coaches') bad('the offseason did not open on the carousel')
  // the player: fire a coordinator whose side was bottom-eight, interview four, offer the best
  const [or, dr] = F.car.ranks[team]
  for (const [k, rk] of [['oc', or], ['dc', dr]]) if (rk >= 25) FR.fireMine(F, k)
  FR.runHires(F)   // (Black Monday done: the league hires its head coaches, then the player hires)
  for (const k of FR.myOpenings(F)) {
    tot.open = (tot.open ?? 0) + 1
    const list = FR.shortlist(F, k, 8)
    for (const c of list.slice(0, 4)) FR.interviewCoach(F, k, c.i)
    for (const c of list.slice(0, 4).map(c => FR.interviewView(F, k, c.i)).filter(Boolean).sort((a, b) => b.r[k === 'oc' ? 'offPlaycalling' : 'defPlaycalling'] - a.r[k === 'oc' ? 'offPlaycalling' : 'defPlaycalling'])) {
      const o = FR.offerCoach(F, k, c.c.i, { calls: true })
      if (o?.to === team) { tot.mine++; break }
    }
  }
  const ev = F.car.ev
  FR.closeCarousel(F)
  full('after the carousel')
  const hires = ev.filter(e => e.k === 'hire')
  const n = { hc: hires.filter(e => e.role === 'hc').length, oc: hires.filter(e => e.role === 'oc').length, dc: hires.filter(e => e.role === 'dc').length }
  const fires = ev.filter(e => e.k === 'fire' && e.role === 'hc'), rets = ev.filter(e => e.k === 'ret' && e.role === 'hc'), poach = ev.filter(e => e.k === 'leave')
  for (const e of fires) firedW.push(recs[e.s].w)
  for (const e of hires.filter(e => e.role === 'hc')) tot.src[e.from ? 'coord' : /HEAD COACH$/.test(e.was ?? '') ? 'college' : 'retread']++
  tot.hc += n.hc; tot.oc += n.oc; tot.dc += n.dc; tot.fire += fires.length; tot.ret += rets.length; tot.poach += poach.length
  console.log(`${F.year}: HC ${n.hc} new (${fires.length} fired: ${fires.map(e => `${e.s} ${e.rec}`).join(', ')}; ${rets.length} retired) · OC ${n.oc} · DC ${n.dc} · coordinators to HC ${poach.length}${poach.some(e => e.s === team) ? ' (one of ours)' : ''} · callers ${callers().join('/')} · pool ${F.cpool.length}`)
  if (y === 0) console.log('   wire:', FR.coachWire(F).slice(0, 6).map(x => x.text).join(' | '))
  if (n.hc > 12) bad(`${F.year}: ${n.hc} head-coach changes`)
  // the rest of the offseason, quickly
  FR.ageLeague(F); FR.openResign(F)
  for (const id of [...F.rs]) { const p = F.teams[team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? (p.o >= 80 ? 'option' : 'decline') : p.b != null || p.o >= 76) }
  FR.openFA(F); while (F.fad) FR.nextFADay(F)
  FR.openDraft(F); FR.startNight(F)
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft(F); FR.newSeason(F)
  full('new season')
}
const st = JSON.stringify({ staff: F.staff, cpool: F.cpool, car: F.car }).length
console.log(`  staff ${JSON.stringify(F.staff).length} · pool ${JSON.stringify(F.cpool).length} · car ${JSON.stringify(F.car).length} · one: ${JSON.stringify(F.staff.KC)}`)
console.log(`over ${N} seasons, a year: HC changes ${(tot.hc / N).toFixed(1)} (fired ${(tot.fire / N).toFixed(1)}, retired ${(tot.ret / N).toFixed(1)}) · OC ${(tot.oc / N).toFixed(1)} · DC ${(tot.dc / N).toFixed(1)} · coordinators made HC ${(tot.poach / N).toFixed(1)}`)
console.log(`new head coaches from: coordinators ${tot.src.coord}, fired/former head coaches ${tot.src.retread}, college ${tot.src.college} · the player's openings ${tot.open ?? 0}, hired from his interviews ${tot.mine}`)
console.log(`fired head coaches' wins: ${firedW.sort((a, b) => a - b).join(' ')} (mean ${avg(firedW).toFixed(1)})`)
console.log(`staffs in the save: ${(st / 1024).toFixed(1)} KB · whole save ${(FR.saveSize(F) / 1024).toFixed(0)} KB · hot seat now: ${JSON.stringify(FR.hotSeat(F))}`)
const hcAvg = (tot.hc / N)
if (hcAvg < 4 || hcAvg > 9.5) bad(`head-coach changes ${hcAvg.toFixed(1)} a year (NFL: about 5-8)`)
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: no problems')
{ const canon = x => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v)); const back = FR.unpackFranchise(FR.packFranchise(F)); const P = JSON.parse(FR.packFranchise(F)); console.log(`packed: staff ${(JSON.stringify(P.staff).length / 1024).toFixed(1)} KB, pool ${(JSON.stringify(P.cpool).length / 1024).toFixed(1)} KB, car ${(JSON.stringify(P.car).length / 1024).toFixed(1)} KB`); if (canon(back.staff) !== canon(F.staff) || canon(back.cpool) !== canon(F.cpool)) console.log('!! the staffs do not survive a save'); else console.log('save round trip: staffs OK') }
// placeholder and old-save coaches (no ratings, no staff at all) read without throwing
{
  const G = FR.createFranchise({ seed: 'ph', team: 'DEN', owner: 'x', builds: [], coach: { name: 'No Ratings' } })
  FR.ensureStaff(G); G.staff.KC.hc = { n: 'Placeholder' }; G.staff.KC.oc = { n: 'Nobody', r: null }; G.staff.KC.dc = null
  try {
    for (const s of ['KC', 'DEN']) { FR.coachOf(G, s); FR.coachEdge(G, s); FR.coachLate(G, s); FR.coachDev(G, s, { p: 'qb', ag: 22 }); FR.coachDev(G, s, { p: 'lb', ag: 22 }); FR.strength(G, s) }
    const H = { ...G }; delete H.staff; FR.coachOf(H, 'KC')
    FR.saneStaff(G); if (!Array.isArray(G.staff.KC.hc.r)) throw new Error('not fixed')
    console.log('placeholder coaches: OK')
  } catch (e) { console.log('!! placeholder coaches:', e.message) }
}
