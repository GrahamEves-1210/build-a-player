// NBA Franchise: the summer market over several seasons. Do stars re-sign (or extend), how long are the deals by age,
// what do good veterans sign for at the end, does any team open a season over its hard cap, how far does the GM's
// payroll go when he keeps everyone, who holds the room exception, and what comes of the GM's offers.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-market.mjs [seasons=5] [seed=a] [team=BOS] [gm=keep|let]
// gm=keep: the GM re-signs every man he can and bids on the best free agents each day (his payroll against the owner)
import * as N from '../../src/lib/franchise2/nba/index'
import * as M from '../../src/lib/franchise2/nba/market'
import * as CP from '../../src/lib/franchise2/nba/cap'
const C = N.CAP_SIM
const Y = +(process.argv[2] ?? 5), SEED = process.argv[3] ?? 'a', TM = process.argv[4] ?? 'BOS', GM = process.argv[5] ?? 'keep'
const F = N.createNbaFranchise({ seed: 'mkt-' + SEED, team: TM, owner: 'G' })
const t0 = Date.now()
const L = (...a) => console.log(...a)
const where = id => N.SHORTS.find(s => F.teams[s].r.some(p => p.i === id)) ?? null
const tot = { stars: 0, stay: 0, moved: 0, unsigned: 0, ext: 0, rext: 0, rextMax: 0, hc: 0, cheap80: 0, left80: 0, roomBad: 0 }
const byAge = {}, byAgeS = {}
const gmOut = {}
let gmMax = 0, gmTax = 0
const sheetsSeen = { n: 0, matched: 0 }
const bucket = ag => (ag <= 24 ? '<=24' : ag <= 29 ? '25-29' : ag <= 32 ? '30-32' : '33+')
for (let yr = 0; yr < Y; yr++) {
  N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F); N.closeSeason(F)
  let stars = [], asks = {}, extBefore = new Set()
  while (F.phase === 'off') {
    const st = F.off.step
    if (st === 'resign') {
      const y = C.capYear(F)
      stars = F.fa.filter(p => p.fr && p.fr !== F.team && p.hy === y && (p.o ?? 0) >= 82).map(p => ({ i: p.i, n: p.n, o: p.o, ag: p.ag, fr: p.fr }))
      for (const s of N.SHORTS) for (const p of F.teams[s].r) if (p.ext != null) extBefore.add(`${p.i}-${p.ext}`)
      if (GM === 'keep') for (const i of [...(F.off.mine ?? [])]) { const r = N.resignMine(F, i, true); if (!r.ok) { const p = F.fa.find(x => x.i === i); if (p?.rfa) N.tenderQO(F, i, true) } }
    }
    if (st === 'fa') {
      for (let d = 0; d < C.FA_DAYS; d++) {
        if (GM === 'keep') {
          // the GM bids on the best man he can afford each day (his ask, or 90% of it every other day)
          for (const p of F.fa.slice().sort((a, b) => b.o - a.o).slice(0, 8)) { const a = C.askOf(F, p); const r = N.signFA(F, p.i, d % 2 ? { ...a, $: Math.round(a.$ * 9) / 10 } : a); if (r?.ok) break }
        }
        N.faNext(F)
        if (d === 0) for (const p of F.fa.slice().sort((a, b) => b.o - a.o).slice(0, 4)) asks[p.i] = [p.n, p.o, p.ag, M.askFor(F, p).$]
        for (const x of N.offerNews(F)) gmOut[x.k] = (gmOut[x.k] ?? 0) + 1
        if (GM === 'keep') for (const q of [...(F.rfq ?? [])]) { sheetsSeen.n++; const r = N.answerSheet(F, q.i, true); if (r?.matched) sheetsSeen.matched++ }
      }
      for (const [i, a] of Object.entries(asks)) { const p = F.fa.find(x => x.i === +i); a.push(p ? M.askFor(F, p).$ : 'signed') }
    }
    if (st === 'camp') {
      const T = F.teams[F.team]
      while (T.r.filter(p => !p.tw).length > 15) C.cutMan(F, F.team, T.r.filter(p => !p.tw && p.b == null).sort((a, b) => a.o - b.o)[0].i)
      for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) }
    }
    N.nextStep(F)
  }
  // the new season's books
  const y = F.year
  let stay = 0, moved = 0, uns = 0
  const out = []
  const deal = i => { const p = N.manOf(F, i); return p?.y ? ` $${p.$}x${p.y}` : '' }
  for (const x of stars) { const s = where(x.i); if (s === x.fr) stay++; else if (s) { moved++; out.push(`${x.n} ${x.o}/${x.ag} ${x.fr}->${s}${deal(x.i)}`) } else { uns++; out.push(`${x.n} ${x.o}/${x.ag} ${x.fr}->unsigned`) } }
  let ext = 0, rext = 0, rextMax = 0
  const rx = []
  for (const s of N.SHORTS) for (const p of F.teams[s].r) {
    if (p.ext == null || extBefore.has(`${p.i}-${p.ext}`) || s === F.team) continue
    if ((p.o ?? 0) >= 82) ext++
    if (p.rk != null && y - p.rk <= 4 && p.ys <= 4) { rext++; const mx = C.capOf(y + 1) * 0.25; rx.push(`${p.n} ${p.o} $${(p.sc?.[0] ?? 0).toFixed(1)}`); if ((p.sc?.[0] ?? 0) >= mx * 0.97) rextMax++ }
  }
  const vets = []
  const cheap = [], left = F.fa.filter(p => (p.o ?? 0) >= 80).map(p => `${p.n} ${p.o}/${p.ag}`)
  for (const s of N.SHORTS) for (const p of F.teams[s].r) {
    if (p.tw || p.rs || p.sgn !== y || p.ext === y) continue
    const mn = C.minOf(p.ys ?? 0, y)
    if ((p.o ?? 0) >= 80 && p.$ <= mn * 1.25 + 0.01) cheap.push(`${p.n} ${p.o}/${p.ag} $${p.$} rk ${C.rankOf(F, p).toFixed(0)}`)
    if ((p.o ?? 0) >= 80 && p.ag >= 30) vets.push(`${p.n} ${p.o}/${p.ag} ${s} $${p.$}x${p.y}`)
    if (p.$ <= mn * 1.3) continue
    const b = bucket(p.ag)
    ;(byAge[b] ??= {})[p.y] = (byAge[b][p.y] ?? 0) + 1
    if ((p.o ?? 0) >= 82) (byAgeS[b] ??= {})[p.y] = (byAgeS[b][p.y] ?? 0) + 1
  }
  const hc = []
  for (const s of N.SHORTS) { const lim = CP.hardCapOf(F, s); const pay = C.payroll(F, s); if (pay > lim + 0.05) hc.push(`${s} ${pay} > ${lim.toFixed(1)}`) }
  const room = []
  for (const s of N.SHORTS) { const e = F.teams[s].exc; if (e?.mk === 'room' && C.payroll(F, s) > C.apron1Of(y)) room.push(`${s} ${C.payroll(F, s)}`) }
  const gm = C.capSheet(F, F.team)
  gmMax = Math.max(gmMax, gm.pay / gm.cap); gmTax = Math.max(gmTax, gm.bill)
  tot.stars += stars.length; tot.stay += stay; tot.moved += moved; tot.unsigned += uns; tot.ext += ext; tot.rext += rext; tot.rextMax += rextMax
  tot.hc += hc.length; tot.cheap80 += cheap.length; tot.left80 += left.length; tot.roomBad += room.length
  L(`\n== ${y} season opens (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  L(`  82+ free agents (CPU): ${stars.length}, re-signed ${stay}, moved ${moved}, unsigned ${uns} | ${out.slice(0, 8).join('; ')}`)
  L(`  82+ extended: ${ext} | rookie-scale extensions ${rext} (at the max ${rextMax}): ${rx.slice(0, 6).join('; ')}`)
  L(`  80+ on <=1.25x the minimum: ${cheap.length} ${cheap.slice(0, 6).join('; ')} | 80+ unsigned: ${left.length} ${left.slice(0, 6).join('; ')}`)
  L(`  80+ vets (30+) signed this summer: ${vets.length} ${vets.slice(0, 8).join('; ')}`)
  const pays = N.SHORTS.map(s => C.payroll(F, s))
  L(`  league payroll: avg ${(pays.reduce((a, v) => a + v, 0) / 30 / C.capOf(y)).toFixed(2)}x cap, over the tax ${pays.filter(v => v > C.taxOf(y)).length}, over the 2nd apron ${pays.filter(v => v > C.apron2Of(y)).length}, under the cap ${pays.filter(v => v < C.capOf(y)).length}`)
  L(`  over the hard cap: ${hc.length} ${hc.join('; ')} | room MLE over the 1st apron: ${room.join('; ') || 'none'}`)
  L(`  GM ${F.team} $${gm.pay} (${(gm.pay / gm.cap).toFixed(2)}x cap, ${gm.over}) luxury tax $${gm.bill} | asks day1->end: ${Object.values(asks).map(a => `${a[0]} ${a[1]}/${a[2]} ${a[3]}->${a[4]}`).join('; ')}`)
}
L('\n== TOTAL', JSON.stringify(tot), `re-sign rate ${(tot.stay / Math.max(1, tot.stars) * 100).toFixed(0)}%`, 'GM max', gmMax.toFixed(2) + 'x cap', 'tax', gmTax, 'sheets', JSON.stringify(sheetsSeen), 'GM offers', JSON.stringify(gmOut))
L('deal lengths by age (non-minimum, signed this summer), all and 82+:')
for (const b of ['<=24', '25-29', '30-32', '33+']) L(`  ${b.padEnd(6)} ${JSON.stringify(byAge[b] ?? {})}   82+ ${JSON.stringify(byAgeS[b] ?? {})}`)
L(`${((Date.now() - t0) / 1000).toFixed(0)}s`)
