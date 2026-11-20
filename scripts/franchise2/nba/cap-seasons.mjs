// The cap engine over several seasons of AI moves (deadline deals, options, re-signing, free agency, salary dumps,
// camp cuts), checked against the CBA and the real league's ranges.
//   FR_TMP=F:/bap-agents/frnba-cap/tmp bash scripts/franchise2/run.sh scripts/franchise2/nba/cap-seasons.mjs [seasons=4] [seed]
import { makeLeague, playDay, runDraft, ageLeague, filler, newSeason } from './fixture'
import { rngOf } from '../../../src/lib/franchise2/rng'
import * as CAP from '../../../src/lib/franchise2/nba/cap'
import * as K from '../../../src/lib/franchise2/nba/contracts'
import * as M from '../../../src/lib/franchise2/nba/market'
import * as T from '../../../src/lib/franchise2/nba/trades'

const N = Number(process.argv[2] ?? 4), SEED = process.argv[3] ?? 'nba-cap'
const F = makeLeague({ seed: SEED, team: 'BOS' })
const S = Object.keys(F.teams)
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const R = rngOf(SEED + '-bot')
const make = (F, s, { tw }) => filler(F, R, tw)
// the wire, the way core keeps it (every item the engine returns)
const NEWS = []
const news = items => { for (const x of items ?? []) NEWS.push(x) }

// the tax, worked by hand: $5M brackets (indexed), 1.5 / 1.75 / 2.5 / 3.25 then +0.5 (repeaters 2.5 / 2.75 / 3.5 / 4.25)
function taxByHand(over, year, rep) {
  if (over <= 0) return 0
  const step = 5 * CAP.capOf(year) / 154.647
  const base = rep ? [2.5, 2.75, 3.5, 4.25] : [1.5, 1.75, 2.5, 3.25]
  let t = 0, i = 0, left = over
  while (left > 1e-9) { const part = Math.min(step, left); t += part * (i < 4 ? base[i] : base[3] + 0.5 * (i - 3)); left -= part; i++ }
  return Math.round(t * 10) / 10
}
function legalAll(where, { off = false } = {}) {
  for (const s of S) {
    if (s === F.team) continue
    // (at camp the league's rosters can be short of 14: core's newSeason fills them)
    const L = K.legalRoster(F, s, off ? { season: false } : {})
    if (!L.ok) bad(`${where}: ${s} ${L.why}`)
    const pay = CAP.payroll(F, s), hc = CAP.hardCapOf(F, s)
    if (pay > hc + 0.05) bad(`${where}: ${s} payroll $${pay}M over its hard cap $${hc}M`)
    for (const p of F.teams[s].r) {
      if (!(p.y > 0)) bad(`${where}: ${s} ${p.n} on the roster with no deal`)
      if (!p.tw && p.$ < CAP.minOf(p.ys ?? 0, CAP.capYear(F)) - 0.06 && !p.rs) bad(`${where}: ${s} ${p.n} paid $${p.$}M, under his minimum`)
      if ((p.sc?.length ?? 0) !== p.y - 1) bad(`${where}: ${s} ${p.n} schedule length ${p.sc?.length} for ${p.y} years`)
      if (!p.tw && p.$ > CAP.maxOf(p.ys ?? 0, CAP.capYear(F), { superMax: true, last: p.$l ?? p.$ }) * 1.4 + 0.1) bad(`${where}: ${s} ${p.n} paid $${p.$}M, far past his max`)
    }
  }
  const ids = new Map()
  for (const [s, p] of K.allMen(F)) { if (ids.has(p.i)) bad(`${where}: ${p.n} in two places (${ids.get(p.i)} and ${s})`); ids.set(p.i, s) }
}
function books(tag) {
  const year = CAP.capYear(F)
  const rows = S.map(s => ({ s, ...CAP.capSheet(F, s) }))
  const pays = rows.map(r => r.pay)
  const mean = pays.reduce((a, b) => a + b, 0) / S.length
  const men = K.allMen(F).filter(([s, p]) => s && !p.tw).map(([, p]) => p)
  const maxers = men.filter(p => p.$ >= CAP.capOf(year) * 0.25 - 0.05).length
  const total = pays.reduce((a, b) => a + b, 0)
  console.log(`${tag}: cap $${CAP.capOf(year)}M · payroll mean $${mean.toFixed(1)}M (${(mean / CAP.capOf(year)).toFixed(2)} caps) low $${Math.min(...pays)}M high $${Math.max(...pays)}M · tax ${rows.filter(r => ['tax', 'a1', 'a2'].includes(r.over)).length} · apron1 ${rows.filter(r => ['a1', 'a2'].includes(r.over)).length} · apron2 ${rows.filter(r => r.over === 'a2').length} · under ${rows.filter(r => r.over === 'under').length} · max deals ${maxers} · pool ${F.fa.length}`)
  // the real league's ranges (2025-26: mean payroll about 1.15 caps, nobody far past the second apron, 30-50 max deals)
  if (mean / CAP.capOf(year) < 1.0 || mean / CAP.capOf(year) > 1.28) bad(`${tag}: mean payroll ${(mean / CAP.capOf(year)).toFixed(2)} caps`)
  if (Math.max(...pays) > CAP.apron2Of(year) + 30) bad(`${tag}: a payroll of $${Math.max(...pays)}M`)
  if (Math.min(...pays) < CAP.capOf(year) * 0.75) bad(`${tag}: a payroll of $${Math.min(...pays)}M`)
  if (maxers < 18 || maxers > 60) bad(`${tag}: ${maxers} max deals`)
  return { mean, total, maxers }
}
// the GM's team, run by a simple bot through the public API
function botResign() {
  for (const p of F.fa.filter(x => x.fr === F.team && !x.rn)) {
    const ask = M.keepsOwn(F, F.team, p)
    if (ask) K.signMan(F, F.team, p, ask)
  }
}
function botFA(day) {
  const year = CAP.capYear(F)
  const top = M.faBoard(F, 20)
  for (const p of top) {
    if (K.standardOf ? false : false) break
    const a = M.askFor(F, p)
    if (M.roleOn(F, F.team, p) < 0.5) continue
    const r = M.placeOffer(F, p.i, { $: a.$, y: a.y, r: 0.05 })
    if (r.ok) break
  }
  if (day === M.FA_DAYS) {
    const st = () => CAP.standardOf(F.teams[F.team]).length
    let g = 0
    while (st() < 14 && g++ < 10) { const p = M.faBoard(F, 40).find(x => K.canSign(F, F.team, x, { $: CAP.minOf(x.ys ?? 0, year), y: 1 }).ok) ?? make(F, F.team, {}); K.signMan(F, F.team, p, { $: CAP.minOf(p.ys ?? 0, year), y: 1, r: 0 }, { check: false }) }
    while (st() > 15) { const low = CAP.standardOf(F.teams[F.team]).sort((a, b) => a.o - b.o)[0]; K.cutMan(F, F.team, low.i) }
  }
}

const tally = { trades: 0, dumps: 0, deadline: 0, absurd: 0, signings: 0, matched: 0, sheets: 0, tax: [] }
const start = books('setup')
legalAll('setup')
for (let season = 0; season < N; season++) {
  const tag = `${F.year}-${String(F.year + 1).slice(2)}`
  // the regular season
  F.phase = 'season'
  const tr0 = F.trn ?? 0
  for (let d = 0; d < F.days; d++) {
    playDay(F)
    news(T.cpuDeadline(F, F.day - 1))
    if (d % 7 === 0) M.cpuFill(F, { make })
    if (d === F.ddl) legalAll(`${tag} deadline`)
  }
  tally.deadline += (F.trn ?? 0) - tr0
  // the tax, at the end of the regular season
  const paid = CAP.assessTax(F, F.year)
  for (const x of paid) {
    const hand = taxByHand(CAP.payroll(F, x.s, F.year, { holds: false }) - CAP.taxOf(F.year), F.year, x.repeater)
    if (Math.abs(hand - x.bill) > 0.15) bad(`${tag}: ${x.s} tax $${x.bill}M, by hand $${hand}M`)
  }
  tally.tax.push(`${tag}: ${paid.length} taxpayers, $${Math.round(paid.reduce((a, x) => a + x.bill, 0))}M (${paid.filter(x => x.repeater).length} repeaters; top ${[...paid].sort((a, b) => b.bill - a.bill).slice(0, 3).map(x => `${x.s} $${x.bill}M`).join(', ')}); under the floor: ${(F.taxl?.floor ?? []).map(x => `${x.s} $${x.$}M`).join(', ') || 'none'}`)
  // the offseason: awards, lottery, draft, then re-signing (ageLeague first, then the deals tick), free agency, camp
  F.phase = 'off'; F.off = { step: 'awards' }
  runDraft(F)
  F.off.step = 'resign'
  ageLeague(F)
  const opts = K.optionsDue(F).length
  const gone = K.seasonEndDeals(F)
  news(gone.news)
  if (CAP.capYear(F) !== F.year + 1) bad('the cap year did not turn over')
  botResign()
  F.off.step = 'fa'
  const tr1 = F.trn ?? 0, n1 = NEWS.length
  const pool0 = new Map(F.fa.map(p => [p.i, p.fr ?? null]))
  for (let d = 1; d <= M.FA_DAYS; d++) { botFA(d); news(M.faDay(F, d)) }
  news(M.cpuOffseason(F))
  const fresh = NEWS.slice(n1)
  tally.matched += fresh.filter(x => x.tag === 'MATCHED').length
  tally.sheets += fresh.filter(x => x.tag === 'OFFER SHEET').length
  tally.dumps += (F.trn ?? 0) - tr1
  F.off.step = 'camp'
  legalAll(`${tag} camp`, { off: true })
  console.log(`${tag}: ${opts} options, ${gone.length} deals up, ${fresh.filter(x => x.tag === 'MATCHED').length} offer sheets matched, ${fresh.filter(x => x.k === 'ext').length} extensions, ${(F.trn ?? 0) - tr1} summer dumps`)
  const moved = K.allMen(F).filter(([s, p]) => s && pool0.has(p.i)).map(([s, p]) => ({ s, p, back: pool0.get(p.i) === s })).sort((a, b) => b.p.$ - a.p.$)
  tally.signings += moved.length
  console.log(`    ${moved.length} of ${pool0.size} free agents signed (${moved.filter(x => x.back).length} back with their team); top: ` + moved.slice(0, 10).map(x => `${x.p.n} ${x.p.o}/${x.p.ag} -> ${x.s}${x.back ? '*' : ''} $${x.p.$}x${x.p.y}`).join(' · '))
  const unsigned = F.fa.filter(p => pool0.has(p.i)).sort((a, b) => b.o - a.o).slice(0, 5)
  console.log('    best unsigned: ' + unsigned.map(p => `${p.n} ${p.o}/${p.ag}`).join(' · '))
  for (const x of fresh.filter(x => x.k === 'trade').slice(0, 4)) console.log('    ' + x.text)
  // the next season (core's newSeason: CPU rosters cut and filled, the year turns)
  newSeason(F, { cutMan: K.cutMan, dealOnLoad: K.dealOnLoad }, R)
  legalAll(`${F.year} opening night`)
  books(`${F.year} opening night`)
}
{
  const year = CAP.capYear(F)
  const top = S.map(s => [s, CAP.payroll(F, s)]).sort((a, b) => b[1] - a[1])[0]
  console.log(`highest payroll ${top[0]} $${top[1]}M: ` + F.teams[top[0]].r.filter(p => !p.tw).sort((a, b) => b.$ - a.$).map(p => `${p.n} ${p.o}/${p.ag} $${p.$}x${p.y}`).join(' · ') + ` · dead $${CAP.deadThisYear(F.teams[top[0]], year)}M`)
}
// the league's own trades: none absurd
for (const d of (F.trl ?? []).filter(x => !x.u)) {
  const [a, b] = d.gv
  const big = Math.max(Math.abs(a), Math.abs(b))
  // (a dump: one side sends players, the other sends nothing back at all)
  const dump = (d.ag.length && !d.bg.length && !(d.pb ?? []).length) || (d.bg.length && !d.ag.length && !(d.pa ?? []).length)
  if (dump) {
    // a dump: the man sent is a burden (worth less than nothing), and what goes with him is about what he costs
    const men = d.ag.length ? d.mv[0] : d.mv[1]
    if (men.some(v => v > 3)) { tally.absurd++; bad(`absurd dump (a man worth something): ${d.t} [${d.mv}]`) }
    if (Math.abs(a - b) > 40) { tally.absurd++; bad(`absurd dump (far too much attached): ${d.t} (${a} vs ${b})`) }
  } else if (big > 25 && Math.min(a, b) < big * 0.45) { tally.absurd++; bad(`absurd: ${d.t} (${a} vs ${b})`) }
}
console.log(`trades: ${F.trn ?? 0} made (${tally.deadline} in the seasons, ${tally.dumps} in the summers)`)
if ((F.trn ?? 0) < N * 4) bad(`only ${F.trn ?? 0} trades in ${N} seasons`)
for (const d of (F.trl ?? []).slice(-8)) console.log(`    ${d.y} ${d.ph}: ${d.t} [${d.gv}]`)
for (const t of tally.tax) console.log('tax ' + t)
console.log(problems.length ? `${problems.length} PROBLEMS` : 'ALL CHECKS PASS')
process.exit(problems.length ? 1 : 0)
