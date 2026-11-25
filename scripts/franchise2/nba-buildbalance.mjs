// NBA Franchise: what three strong rookie builds do to a middling team, and how the playoffs treat favourites.
// For each seed: a league with three builds (83, 84, 87 OVR by default) on TEAM and the same league without them,
// one season each: regular-season wins, the builds' awards, how the season ended; and from every league played, every
// playoff series: how often the better record wins it, by round and by the gap in wins, beside what the two teams'
// regular-season records say should happen (log5 a game, home court 2-2-1-1-1), and how the No. 1 seeds finish.
//   FR_TMP=<dir> bash scripts/franchise2/run.sh scripts/franchise2/nba-buildbalance.mjs [seeds=20] [team=DET] [ovrs=83,84,87] [mode=both|with|without]
import * as N from '../../src/lib/franchise2/nba/index'
import { NBA_GUARD_PLAYERS } from '../../src/data/nba-guards'
import { NBA_BIG_PLAYERS } from '../../src/data/nba-bigs'
const SEEDS = +(process.argv[2] ?? 20), TEAM = process.argv[3] ?? 'DET', OVRS = (process.argv[4] ?? '83,84,87').split(',').map(Number), MODE = process.argv[5] ?? 'both'
const asB = a => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, { val: v }]))
// a real man's ratings at each OVR asked for: two guards and a big (the tester's three: a wing, a guard, a center)
function attrsAt(list, g, o) {
  const m = list.filter(p => p.attrs).map(p => ({ p, d: Math.abs(N.ovrOfAttrs(g, p.attrs) - o) })).sort((a, b) => a.d - b.d)[0].p
  const a = { ...m.attrs }
  // (no real man at that number: the nearest one's ratings, a grade at a time, until his OVR is it)
  for (let n = 0; n < 60 && N.ovrOfAttrs(g, a) !== o; n++) {
    const up = N.ovrOfAttrs(g, a) < o
    const ks = Object.keys(a).filter(k => (up ? a[k] < 11 : a[k] > 0)).sort((x, y) => (up ? a[x] - a[y] : a[y] - a[x]))
    a[ks[n % Math.max(1, Math.min(3, ks.length))]] += up ? 1 : -1
  }
  return a
}
const NAMES = ['Marcus Hale', 'Andre Whitfield', 'Caleb Okafor']
const builds = OVRS.map((o, k) => {
  const g = k === OVRS.length - 1 ? 'big' : 'guard'
  const a = attrsAt(g === 'big' ? NBA_BIG_PLAYERS : NBA_GUARD_PLAYERS, g, o)
  if (N.ovrOfAttrs(g, a) !== o) throw new Error(`no ${g} at ${o}`)
  return { pos: g, build: asB(a), name: NAMES[k] ?? `Build ${k}`, num: 40 + k }
})
console.log(`team ${TEAM} · builds ${builds.map((b, k) => `${b.pos} ${OVRS[k]}`).join(', ')} · ${SEEDS} seeds`)
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const f1 = v => v.toFixed(1)
// a best-of-seven's odds for the team with home court, from one game's odds at home (ph) and away (pa)
function seriesP(ph, pa) {
  const HOME = [1, 1, 0, 0, 1, 0, 1]
  const memo = new Map()
  const go = (w, l) => { if (w === 4) return 1; if (l === 4) return 0; const k = `${w}-${l}`; if (memo.has(k)) return memo.get(k); const p = HOME[w + l] ? ph : pa; const v = p * go(w + 1, l) + (1 - p) * go(w, l + 1); memo.set(k, v); return v }
  return go(0, 0)
}
const series = []      // every series: { rd, hiW, loW, won (the higher seed won), g, exp }
const ones = []        // every No. 1 seed: { w, fin, lostTo: [rd, score] }
const FIN = ['r1', 'r2', 'cf', 'finals', 'champ']
let homeW = 0, homeG = 0, poHomeW = 0, poHomeG = 0
function harvest(F) {
  const R = N.records(F)
  for (const g of F.sched) if (g.hs != null) { homeG++; if (g.hs > g.as) homeW++ }
  const hca = homeG ? homeW / homeG - 0.5 : 0.04
  ;(F.po.all ?? []).forEach((S, rd) => S.forEach(x => {
    const a = N.pct(R[x.hi]), b = N.pct(R[x.lo])
    const p = (a * (1 - b)) / (a * (1 - b) + b * (1 - a) || 1)
    for (const g of x.g) { poHomeG++; if (g.hs > g.as) poHomeW++ }
    series.push({ rd, hiW: R[x.hi].w, loW: R[x.lo].w, won: x.done === x.hi, g: x.g.length, exp: seriesP(Math.min(0.97, p + hca), Math.max(0.03, p - hca)) })
  }))
  for (const c of ['E', 'W']) {
    const s = F.po.final[c][0]
    let fin = 'champ', lost = null
    ;(F.po.all ?? []).forEach((S, rd) => { const x = S.find(q => q.hi === s || q.lo === s); if (x && x.done !== s && !lost) { fin = FIN[rd]; lost = `${Math.min(x.wh, x.wl)}-4 to a ${R[x.done].w}-win team` } })
    ones.push({ s, w: R[s].w, fin, lost })
  }
}
// the playoff teams' three best men: out as round one opens, games missed in the playoffs and in the regular season
const INJ = { open: 0, openOut: 0, openHurt: 0, poG: 0, poMiss: 0, rsG: 0, rsMiss: 0 }
const rows = { with: [], without: [] }
const awards = { ROY: 0, MVP: 0, DPOY: 0, '6MOY': 0, MIP: 0, ALL1: 0, ALL2: 0, ALL3: 0, DEF1: 0, DEF2: 0, RK1: 0, RK2: 0, AS: 0 }
const lines = []
const t0 = Date.now()
for (let k = 0; k < SEEDS; k++) {
  for (const mode of ['with', 'without']) {
    if (MODE !== 'both' && MODE !== mode) continue
    const F = N.createNbaFranchise({ seed: `bal-${k}`, team: TEAM, owner: 'G', builds: mode === 'with' ? builds : [] })
    const ovr0 = N.teamOvr(F, TEAM), rank0 = N.SHORTS.slice().sort((a, b) => N.teamOvr(F, b) - N.teamOvr(F, a)).indexOf(TEAM) + 1
    N.simTo(F, F.days)
    const mine = F.teams[TEAM].r.filter(p => p.b != null)
    const asIds = new Set(['E', 'W'].flatMap(c => [...(F.as?.[c]?.st ?? []), ...(F.as?.[c]?.res ?? [])]))
    // (the postseason a night at a time: as round one opens, each playoff team's three best men and who's out; then
    // their games played against their team's)
    N.startPostseason(F)
    let top3 = null, guard = 0
    while (F.po && F.po.stage !== 'done' && guard++ < 220) {
      if (!top3 && F.po.rd === 0) {
        top3 = {}
        for (const c of ['E', 'W']) for (const t of F.po.final[c]) {
          top3[t] = F.teams[t].r.filter(p => !p.tw).sort((x, y) => y.o - x.o).slice(0, 3).map(p => p.i)
          for (const id of top3[t]) { const p = F.teams[t].r.find(x => x.i === id); INJ.open++; if (!N.CAP_SIM.rotationOf(F, t, { playoff: true }).some(r => r.i === id)) INJ.openOut++; if ((p.inj?.g ?? 0) > 0) INJ.openHurt++ }
        }
      }
      N.playPoNight(F)
    }
    for (const t in top3 ?? {}) {
      const tg = F.po.all.flat().filter(x => x.hi === t || x.lo === t).reduce((n, x) => n + x.g.length, 0)
      for (const id of top3[t]) { INJ.poG += tg; INJ.poMiss += tg - (F.ps?.[id]?.gp ?? 0); INJ.rsG += 82; INJ.rsMiss += 82 - Math.min(82, F.ss?.[id]?.gp ?? 0) }
    }
    harvest(F)
    N.closeSeason(F)
    const h = F.hist.at(-1)
    rows[mode].push({ w: h.w, seed: h.seed, fin: h.finish, ovr0, rank0 })
    if (mode === 'with') {
      const ids = new Set(mine.map(p => p.i))
      for (const key of ['ROY', 'MVP', 'DPOY', '6MOY', 'MIP']) if (ids.has(h.aw[key]?.i)) awards[key]++
      ;(h.aw.ALL ?? []).forEach((t, j) => t.forEach(x => { if (ids.has(x.i)) awards[`ALL${j + 1}`]++ }))
      ;(h.aw.ALLDEF ?? []).forEach((t, j) => t.forEach(x => { if (ids.has(x.i)) awards[`DEF${j + 1}`]++ }))
      ;(h.aw.ROOKIE ?? []).forEach((t, j) => t.forEach(x => { if (ids.has(x.i)) awards[`RK${j + 1}`]++ }))
      for (const p of mine) if (asIds.has(p.i)) awards.AS++
      for (const p of mine) { const c = (p.car ?? []).at(-1); if (c?.gp) lines.push({ o: p.o, p: p.p, gp: c.gp, min: c.min / c.gp, pts: c.pts / c.gp, reb: c.reb / c.gp, ast: c.ast / c.gp }) }
    }
    console.log(`  ${`bal-${k}`.padEnd(7)} ${mode.padEnd(7)} OVR ${ovr0} (${rank0}) ${h.w}-${h.l} seed ${h.seed} ${h.finish}${mode === 'with' ? ` · ${mine.map(p => { const c = (p.car ?? []).at(-1); return c?.gp ? `${p.p} ${p.o}: ${f1(c.pts / c.gp)}/${f1(c.reb / c.gp)}/${f1(c.ast / c.gp)} ${f1(c.min / c.gp)}m` : p.p }).join(' | ')}` : ''}  [${((Date.now() - t0) / 1000).toFixed(0)}s]`)
  }
}
const cnt = (a, f) => { const o = {}; for (const x of a) { const k = f(x); o[k] = (o[k] ?? 0) + 1 } return o }
for (const mode of ['with', 'without']) {
  const a = rows[mode]
  if (!a.length) continue
  console.log(`\n${mode.toUpperCase()} builds (${a.length} seasons): team OVR ${f1(avg(a.map(x => x.ovr0)))} (rank ${f1(avg(a.map(x => x.rank0)))}) · wins ${f1(avg(a.map(x => x.w)))} (min ${Math.min(...a.map(x => x.w))}, max ${Math.max(...a.map(x => x.w))}) · seed ${f1(avg(a.map(x => x.seed)))} · No. 1 seed ${a.filter(x => x.seed === 1).length} · finish ${JSON.stringify(cnt(a, x => x.fin))}`)
}
if (rows.with.length) {
  console.log(`\nThe builds' awards over ${rows.with.length} seasons (${rows.with.length * builds.length} build-seasons): ${Object.entries(awards).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  for (const o of [...new Set(lines.map(x => x.o))].sort()) { const a = lines.filter(x => x.o === o); console.log(`  the ${o} (${a[0].p}): ${f1(avg(a.map(x => x.pts)))} pts ${f1(avg(a.map(x => x.reb)))} reb ${f1(avg(a.map(x => x.ast)))} ast in ${f1(avg(a.map(x => x.min)))} min, ${f1(avg(a.map(x => x.gp)))} gp`) }
}
console.log(`\nHome teams: regular season ${(100 * homeW / homeG).toFixed(1)}% of ${homeG} · playoffs ${(100 * poHomeW / poHomeG).toFixed(1)}% of ${poHomeG}`)
console.log(`Playoff series (${series.length}): the higher seed's share, beside what the two regular-season records say (log5 a game with the home edge)`)
const RD = ['first round', 'second round', 'conf finals', 'Finals']
for (let rd = 0; rd < 4; rd++) { const a = series.filter(x => x.rd === rd); if (a.length) console.log(`  ${RD[rd].padEnd(13)} ${a.filter(x => x.won).length}/${a.length} = ${(100 * a.filter(x => x.won).length / a.length).toFixed(0)}%  (records say ${(100 * avg(a.map(x => x.exp))).toFixed(0)}%)  ${f1(avg(a.map(x => x.g)))} games`) }
for (const [lo, hi] of [[-99, 0], [1, 5], [6, 10], [11, 15], [16, 99]]) { const a = series.filter(x => x.hiW - x.loW >= lo && x.hiW - x.loW <= hi); if (a.length) console.log(`  gap ${String(lo < -50 ? '<=0' : hi > 50 ? `${lo}+` : `${lo}-${hi}`).padEnd(6)} wins: ${a.filter(x => x.won).length}/${a.length} = ${(100 * a.filter(x => x.won).length / a.length).toFixed(0)}%  (records say ${(100 * avg(a.map(x => x.exp))).toFixed(0)}%)`) }
const big = series.filter(x => x.rd === 1 && x.hiW >= 58)
console.log(`  a 58+ win team in the second round: ${big.filter(x => x.won).length}/${big.length} won it (records say ${(100 * avg(big.map(x => x.exp))).toFixed(0)}%)`)
console.log(`No. 1 seeds (${ones.length}, ${f1(avg(ones.map(x => x.w)))} wins on average): ${JSON.stringify(cnt(ones, x => x.fin))}`)
const r2 = (lo, hi = 99) => { const a = series.filter(x => x.rd === 1 && x.hiW >= lo && x.hiW <= hi); return `${a.filter(x => x.won).length}/${a.length}${a.length ? ` = ${(100 * a.filter(x => x.won).length / a.length).toFixed(0)}%` : ''}` }
console.log(`  second-round series won by the team with home court, by its wins: 60+ ${r2(60)} · 57-59 ${r2(57, 59)} · 53-56 ${r2(53, 56)} · under 53 ${r2(0, 52)}`)
const ones2 = ones.filter(x => x.w >= 60 && x.fin !== 'r1')
console.log(`  60+ win No. 1 seeds in the second round: ${ones2.filter(x => x.fin !== 'r2').length}/${ones2.length} won it`)
if (INJ.open) console.log(`Playoff teams' three best men: ${(100 * INJ.openOut / INJ.open).toFixed(1)}% not in uniform as round one opens (${(100 * INJ.openHurt / INJ.open).toFixed(1)}% carrying an injury) · games missed: playoffs ${(100 * INJ.poMiss / INJ.poG).toFixed(1)}%, regular season ${(100 * INJ.rsMiss / INJ.rsG).toFixed(1)}%`)
const o60 = ones.filter(x => x.w >= 60)
console.log(`  60+ win No. 1 seeds (${o60.length}): ${JSON.stringify(cnt(o60, x => x.fin))}`)
console.log(`  out in the second round: ${ones.filter(x => x.fin === 'r2').map(x => `${x.s} ${x.w}W ${x.lost}`).join(' · ')}`)
console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`)
