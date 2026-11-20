// NBA Franchise, headless: full seasons and summers through the engine, checking what a real league would show.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-sim.mjs [seasons=3] [team=BOS] [moments=1]
import * as N from '../../src/lib/franchise2/nba/index'
const SEASONS = +(process.argv[2] ?? 3), TEAMX = process.argv[3] ?? 'BOS', MOM = process.argv[4] !== '0'
const bad = []
const flag = m => { bad.push(m); console.log('  !! ' + m) }
const t0 = Date.now()
let F = N.createNbaFranchise({ seed: 'nsim-' + TEAMX, team: TEAMX, owner: 'Graham' })
console.log('created', Date.now() - t0, 'ms', 'save', (N.nbaSaveSize(F) / 1024).toFixed(0), 'KB')
for (let y = 0; y < SEASONS; y++) {
  const t = Date.now()
  let moments = 0
  // the GM's games with moments (simmed), everyone else straight
  while (F.phase === 'season') {
    const out = N.playNext(F, { moments: MOM })
    if (out?.pending) { moments++; const plan = N.momentPlan(F); N.momentSim(F, plan) }
  }
  const P = N.scheduleProblems(F)
  if (P.bad.length) flag(`schedule: ${P.bad.slice(0, 3).join('; ')}`)
  const R = N.records(F)
  const pf = N.SHORTS.map(s => R[s].pf / R[s].g), w = N.SHORTS.map(s => R[s].w)
  console.log(`${F.year}: ${(Date.now() - t)} ms, moments ${moments}, PPG ${Math.min(...pf).toFixed(1)}-${Math.max(...pf).toFixed(1)}, wins ${Math.min(...w)}-${Math.max(...w)}, ${TEAMX} ${N.recText(R[TEAMX])}`)
  if (N.SHORTS.some(s => R[s].g !== 82)) flag('a team without 82 games')
  N.startPostseason(F)
  while (F.phase === 'playin' || F.phase === 'playoffs') {
    const out = N.playPoNight(F, { moments: MOM })
    if (out?.pending) { const plan = N.momentPlan(F); N.momentSim(F, plan) }
  }
  const S = F.po.all
  for (const rd of S) for (const x of rd) if (Math.max(x.wh, x.wl) !== 4 || x.g.length > 7) flag(`series ${x.hi}-${x.lo} ${x.wh}-${x.wl}`)
  console.log(`  trades so far ${F.trn ?? 0}, taxpayers ${(F.taxl?.paid ?? []).length}`)
  console.log(`  champ ${F.po.champ}, finals ${S[3][0].hi}-${S[3][0].lo} ${S[3][0].wh}-${S[3][0].wl}, seeds E ${F.po.final.E.join(' ')}`)
  for (const k of ['pts', 'reb', 'ast']) { const L = N.CAP_SIM.leaders(F, k, 1); console.log(`  leader ${k}: ${L[0]?.v}`) }
  N.closeSeason(F)
  const aw = F.hist.at(-1).aw
  console.log(`  MVP ${aw.MVP?.n}, ROY ${aw.ROY?.n}`)
  while (F.phase === 'off') {
    const st = F.off.step
    if (st === 'lottery') console.log('  lottery', F.lot.order.slice(0, 4).join(' '), N.lotteryText(F.lot).join('; '))
    if (st === 'resign') for (const i of [...(F.off.mine ?? [])]) N.resignMine(F, i, true)
    if (st === 'camp') { const T = F.teams[F.team]; while (T.r.filter(p => !p.tw).length > 15) { const p = T.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0]; N.CAP_SIM.cutMan(F, F.team, p.i) } }
    N.nextStep(F)
  }
  for (const s of N.SHORTS) { const r = F.teams[s].r, std = r.filter(p => !p.tw).length; if (std > 15 || std < 13) flag(`${s} has ${std} standard men`); if (r.filter(p => p.tw).length > 3) flag(`${s} two-way > 3`) }
  const ages = N.SHORTS.flatMap(s => F.teams[s].r.map(p => p.ag)); console.log(`  ages ${Math.min(...ages)}-${Math.max(...ages)}, avg ovr top8 ${(N.SHORTS.reduce((a, s) => a + N.teamOvr(F, s), 0) / 30).toFixed(1)}, save ${(N.nbaSaveSize(F) / 1024).toFixed(0)} KB`)
  { const P = JSON.parse(N.packNba(F)); const sz = Object.entries(P).map(([k, v]) => [k, JSON.stringify(v).length]).sort((a, b) => b[1] - a[1]).slice(0, 8); console.log('  size', sz.map(([k, v]) => `${k} ${(v / 1024).toFixed(0)}K`).join(' ')); const T = P.teams; let car = 0, aw = 0, rest = 0; for (const t of Object.values(T)) for (const r of t.r) { const m = r[r.length - 1]; if (m && typeof m === 'object' && !Array.isArray(m)) { car += JSON.stringify(m.car ?? '').length; aw += JSON.stringify(m.aw ?? '').length; rest += JSON.stringify(m).length } } console.log(`  men extras ${(rest / 1024).toFixed(0)}K car ${(car / 1024).toFixed(0)}K aw ${(aw / 1024).toFixed(0)}K`) }
  const J = JSON.parse(JSON.stringify(N.unpackNba(N.packNba(F)))); if (J.sched.length !== F.sched.length) flag('pack/unpack lost games')
}
console.log(bad.length ? `${bad.length} problems` : 'no problems', `${Date.now() - t0} ms`)
