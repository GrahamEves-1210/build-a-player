// NBA Franchise: the trade rules and the league teams' trade sense, headless.
//   FR_TMP=<tmp> bash scripts/franchise2/run.sh scripts/franchise2/nba-trades.mjs
// Checks: contenders don't sell their season (the "worse now" check), injured men's value, option years, the rookie
// trade locks through the summer, the 2023 CBA's trade rules (first-apron hard cap past 100%, two months before a
// man traded for is aggregated, trade exceptions, the minimum exception, two-way men), protections that step down,
// swaps that can't be sold twice, and the league's own deals by date (deadline day included).
import * as N from '../../src/lib/franchise2/nba/index'
import * as T from '../../src/lib/franchise2/nba/trades'
import * as CP from '../../src/lib/franchise2/nba/cap'
const C = N.CAP_SIM
const L = (...a) => console.log(...a)
let bad = 0
const ok = (c, msg) => { L(`${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) bad++ }
const clone = F => N.unpackNba(N.packNba(F))
const man = (F, n) => { for (const s of N.SHORTS) { const p = F.teams[s].r.find(p => p.n === n); if (p) return [s, p] } return [null, null] }
const year = F => C.capYear(F)
// (one man's salary moved so the team's payroll lands on a line; he's kept out of the deals below)
const setPay = (F, s, target) => { const p = F.teams[s].r.filter(p => !p.tw).sort((a, b) => b.$ - a.$)[0]; p.$ = Math.max(1, p.$ + target - C.payroll(F, s)); p.ntc = 1; return p }

const F0 = N.createNbaFranchise({ seed: 'qa-trades', team: 'WAS', owner: 'G' })

// ── 1. contenders and old stars ──────────────────────────────────────────────
{
  const F = clone(F0)
  const [s, curry] = man(F, 'Stephen Curry')
  L(`\n1. ${s} (${C.situationOf(F, s)}) ${curry.n} ${curry.o}/${curry.ag}: league value ${T.manValue(F, curry).toFixed(0)}, now ${T.nowValue(F, curry).toFixed(0)}`)
  // (on his real deal he's owed $62.6M x3 at 38: the league fairly prices that low. The age curve is checked on the
  // same man on an expiring deal; the contender's "now" value is what keeps him in Golden State)
  const exp = { ...curry, y: 1, $: 40, sc: [40], op: undefined }   // (an expiring deal at about his worth)
  ok(T.manValue(F, exp) > 60, 'a 91-OVR 38-year-old on an expiring deal is worth more than a late first (60+)')
  ok(T.nowValue(F, curry) > 60, 'to a contender this season he is worth more than a late first (60+)')
  const mine = F.teams.WAS.r.filter(p => !p.tw && !C.whyNot(F, 'WAS', p)).sort((a, b) => b.$ - a.$)
  // (every other year's first: the Stepien rule)
  const picks = T.picksOf(F, 'WAS').filter(k => k.r === 1).filter((k, j) => j % 2 === 0).map(k => k.i)
  // the GM's package of futures and filler for him (the first filler that makes it legal)
  let deal = null
  for (const p of mine) { const d = { a: 'WAS', b: s, ga: [p.i], gb: [curry.i], pa: picks.slice(0, 4), pb: [] }; if (C.checkTrade(F, d).ok) { deal = d; break } }
  for (let i = 0; !deal && i < mine.length; i++) for (let j = i + 1; !deal && j < mine.length; j++) { const d = { a: 'WAS', b: s, ga: [mine[i].i, mine[j].i], gb: [curry.i], pa: picks.slice(0, 3), pb: [] }; if (C.checkTrade(F, d).ok) deal = d }
  const filler = F.teams.WAS.r.find(p => p.i === deal.ga[0])
  const c = C.checkTrade(F, deal), d = T.decide(F, deal)
  L(`   ${filler.n} and four firsts for him: legal ${c.ok} ${c.why ?? ''} -> ${d.yes ? 'YES' : 'no'} (${d.why}) ${T.sayOf(F, s, d)}`)
  ok(c.ok && !d.yes && d.why === 'win', 'a contender won\'t sell its star for futures in the season')
}

// ── 2. injuries ──────────────────────────────────────────────────────────────
{
  const F = clone(F0)
  const [s, p] = man(F, 'Jayson Tatum')
  const v0 = T.manValue(F, p)
  p.inj = { g: 75, k: 'torn right Achilles' }
  const v1 = T.manValue(F, p)
  L(`\n2. ${p.n} healthy ${v0.toFixed(0)}, out 75 games ${v1.toFixed(0)} (avail ${T.availOf(F, p).now.toFixed(2)})`)
  ok(v1 < v0 * 0.75, 'a 75-game injury takes a quarter or more off his value')
  const [s2, q] = man(F, 'LaMelo Ball')
  if (s !== 'WAS' && s2) {
    const G = clone(F); G.team = s
    const pp = G.teams[s].r.find(x => x.i === p.i); pp.inj = { g: 75, k: 'torn right Achilles' }
    const deal = { a: s, b: s2, ga: [pp.i], gb: [q.i], pa: [], pb: [] }
    const ch = C.checkTrade(G, deal)
    L(`   ${p.n} (hurt) for ${q.n}: legal ${ch.ok} -> ${ch.ok ? (T.decide(G, deal).yes ? 'YES' : 'no') : ch.why}`)
    ok(!ch.ok || !T.decide(G, deal).yes, 'an injured star doesn\'t fetch a healthy one')
  }
  p.inj = { g: 200, k: 'torn ACL' }
  const [ws] = Object.keys(F.teams).filter(x => C.situationOf(F, x) === 'win')
  L(`   out for the season: league ${T.manValue(F, p).toFixed(0)}, to a contender (${ws}) ${C.tradeValue(F, p, ws).toFixed(0)}`)
  ok(C.tradeValue(F, p, ws) < T.manValue(F, p), 'a contender pays less than the league for a man out for the season')
}

// ── 3. option years ──────────────────────────────────────────────────────────
{
  const F = clone(F0)
  const [, p] = man(F, 'Derrick White')
  const base = { $: p.$, y: p.y, sc: p.sc, opt: p.opt }
  p.y = 2; p.sc = [p.$ * 1.08]; delete p.opt
  const g = T.manValue(F, p)
  p.opt = { k: 'T', yr: year(F) + 1 }; const t = T.manValue(F, p)
  p.opt = { k: 'P', yr: year(F) + 1 }; const pl = T.manValue(F, p)
  L(`\n3. ${p.n} two years: guaranteed ${g.toFixed(1)}, team option ${t.toFixed(1)}, player option ${pl.toFixed(1)}`)
  ok(t >= g - 0.01 && pl <= g + 0.01 && t > pl, 'a team option is worth at least the guaranteed year, a player option at most')
  Object.assign(p, base)
}

// ── 4. the rookie locks through the summer ───────────────────────────────────
{
  const F = clone(F0)
  N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F); N.closeSeason(F)
  const rook = s => F.teams[s].r.filter(p => p.rs && p.rk === F.year)
  const lastYear = N.SHORTS.flatMap(s => rook(s).map(p => [s, p]))
  const steps = {}
  while (F.phase === 'off') {
    const st = F.off.step
    const locked = lastYear.filter(([s, p]) => F.teams[s].r.includes(p) && C.whyNot(F, s, p)).length
    const drafted = N.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.rk === F.year + 1 && p.dr).map(p => [s, p]))
    const dl = drafted.filter(([s, p]) => C.whyNot(F, s, p))
    const r2 = drafted.filter(([, p]) => p.dr[1] === 2 && !p.tw)
    steps[st] = { locked, drafted: drafted.length, dlocked: dl.length, msg: dl[0] ? C.whyNot(F, dl[0][0], dl[0][1]) : '', r2: r2.length, r2l: r2.filter(([s, p]) => C.whyNot(F, s, p)).length }
    if (st === 'resign') for (const i of [...(F.off.mine ?? [])]) N.resignMine(F, i, true)
    if (st === 'camp') { const Tm = F.teams[F.team]; while (Tm.r.filter(p => !p.tw).length > 15) C.cutMan(F, F.team, Tm.r.filter(p => !p.tw && p.b == null).sort((a, c) => a.o - c.o)[0].i); for (const p of N.minPool(F)) { if (Tm.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) } }
    N.nextStep(F)
  }
  L(`\n4. last season's ${lastYear.length} rookie-scale men locked, and this summer's draftees, by stop:`)
  for (const [st, x] of Object.entries(steps)) L(`   ${st}: last year's rookies locked ${x.locked}; drafted ${x.drafted}, locked ${x.dlocked} (2nd-round standard ${x.r2}, locked ${x.r2l}) ${x.msg}`)
  ok(['awards', 'lottery', 'draft'].every(k => !steps[k] || steps[k].locked === 0), 'last season\'s rookies are tradable at the awards, lottery and draft')
  ok(!steps.draft || steps.draft.dlocked === 0, 'draft night: the picks\' rights can be dealt')
  ok(['resign', 'fa'].every(k => !steps[k] || (steps[k].dlocked === steps[k].drafted && /30 days/.test(steps[k].msg))), 'after he signs: locked 30 days, said so')
  ok(!steps.camp || steps.camp.dlocked === 0, 'by camp the draftees (both rounds) can be traded')
  const day0 = N.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.rk === F.year && p.dr && !p.tw).map(p => [s, p]))
  ok(day0.every(([s, p]) => !C.whyNot(F, s, p)), `opening night: all ${day0.length} rookies on their draft deals can be traded`)
}

// ── 5. the CBA's trade rules ─────────────────────────────────────────────────
{
  const F = clone(F0)
  const y = year(F)
  // (a) more than 100% back: hard-capped at the first apron
  const s = 'WAS'
  setPay(F, s, C.apron1Of(y) - 14)
  const mine = F.teams[s].r.filter(q => !q.tw && !C.whyNot(F, s, q) && q.$ > 12 && q.$ < 30).sort((a, b) => b.$ - a.$)[0]
  const tg = N.SHORTS.filter(x => x !== s).flatMap(x => F.teams[x].r.filter(q => !q.tw && !C.whyNot(F, x, q) && q.$ > mine.$ + 2 && q.$ < mine.$ + 6).map(q => [x, q]))[0]
  const deal = { a: s, b: tg[0], ga: [mine.i], gb: [tg[1].i], pa: [], pb: [] }
  const c = C.checkTrade(F, deal)
  L(`\n5a. ${s} at ${C.payroll(F, s)} sends ${mine.$} takes ${tg[1].$}: ${c.ok ? 'legal' : c.why}`)
  if (c.ok) { C.doTrade(F, deal); ok(F.teams[s].exc?.hc === 'a1', `hard-capped at the first apron (${F.teams[s].exc?.hc})`) }
  // the other side sent more than it took back: a trade exception
  const tp = F.teams[tg[0]].tpe ?? []
  L(`    ${tg[0]} trade exceptions: ${JSON.stringify(tp)} (pay ${C.payroll(F, tg[0])}, cap ${C.capOf(y)})`)
  if (C.payroll(F, tg[0]) > C.capOf(y)) ok(tp.length === 1 && Math.abs(tp[0].$ - (tg[1].$ - mine.$)) < 0.2, 'the team that sent more salary has a trade exception for the difference')
  // (b) two months before a man traded for is aggregated
  const got = F.teams[s].r.find(q => q.i === tg[1].i)
  const other = F.teams[s].r.filter(q => !q.tw && q !== got && !C.whyNot(F, s, q) && q.$ > 3).sort((a, b) => a.$ - b.$)[0]
  const big = N.SHORTS.filter(x => x !== s && x !== tg[0]).flatMap(x => F.teams[x].r.filter(q => !q.tw && !C.whyNot(F, x, q) && q.$ > got.$ + 1 && q.$ < got.$ + other.$).map(q => [x, q]))[0]
  if (big) {
    const d2 = { a: s, b: big[0], ga: [got.i, other.i], gb: [big[1].i], pa: [], pb: [] }
    const c2 = C.checkTrade(F, d2)
    L(`5b. ${got.n} (just traded for) and ${other.n} for ${big[1].n}: ${c2.ok ? 'legal' : c2.why}`)
    ok(!c2.ok && c2.k === 'agg', 'a man traded for can\'t be aggregated for two months')
    const G = clone(F); G.teams[s].r.find(q => q.i === got.i).txd -= 61
    const c3 = C.checkTrade(G, d2)
    ok(c3.ok || c3.k !== 'agg', `two months on, he can (${c3.ok ? 'legal' : c3.why})`)
  }
  // (c) the trade exception absorbs a man
  const H = clone(F0)
  const hs = 'WAS'
  setPay(H, hs, C.capOf(y) + 8)
  // (a spot for him: the roster's last man waived)
  const cutLow = (G, t) => C.cutMan(G, t, G.teams[t].r.filter(q => !q.tw && !q.ntc).sort((a, b) => a.$ - b.$)[0].i)
  cutLow(H, hs)
  setPay(H, hs, C.capOf(y) + 8)
  H.teams[hs].tpe = [{ $: 9, n: 'Test', until: T.calDay(H) + 100 }]
  const cand = N.SHORTS.filter(x => x !== hs).flatMap(x => H.teams[x].r.filter(q => !q.tw && !C.whyNot(H, x, q) && q.$ > 6 && q.$ <= 9 && !T.onMinimum(q, y)).map(q => [x, q]))[0]
  const d4 = { a: hs, b: cand[0], ga: [], gb: [cand[1].i], pa: [T.picksOf(H, hs).find(k => k.r === 2).i], pb: [] }
  const c4 = C.checkTrade(H, d4)
  L(`5c. ${hs} over the cap with a $9M exception takes ${cand[1].n} ($${cand[1].$}M) for a second: ${c4.ok ? 'legal' : c4.why}`)
  ok(c4.ok, 'a trade exception absorbs his salary')
  if (c4.ok) { C.doTrade(H, d4); ok(!(H.teams[hs].tpe?.length) || H.teams[hs].tpe[0].$ < 9 - 6 + 0.01, `the exception is used up (${JSON.stringify(H.teams[hs].tpe ?? [])})`) }
  H.teams[hs].tpe = [{ $: 9, n: 'Test', until: T.calDay(H) - 1 }]
  // (d) the minimum exception: over the cap, a man on the minimum for a second
  const M = clone(F0)
  setPay(M, hs, C.apron1Of(y) + 2)
  cutLow(M, hs)
  setPay(M, hs, C.apron1Of(y) + 2)
  const mn = N.SHORTS.filter(x => x !== hs).flatMap(x => M.teams[x].r.filter(q => !C.whyNot(M, x, q) && T.onMinimum(q, y)).map(q => [x, q]))[0]
  const d5 = { a: hs, b: mn[0], ga: [], gb: [mn[1].i], pa: [T.picksOf(M, hs).find(k => k.r === 2).i], pb: [] }
  const c5 = C.checkTrade(M, d5)
  L(`5d. ${hs} over the first apron takes ${mn[1].n} ($${mn[1].$}M, minimum) for a second: ${c5.ok ? 'legal' : c5.why}`)
  ok(c5.ok, 'the minimum exception: no salary back needed')
  // (e) two-way men
  const tw = N.SHORTS.filter(x => x !== hs).flatMap(x => M.teams[x].r.filter(q => q.tw && !C.whyNot(M, x, q)).map(q => [x, q]))[0]
  const myTw = M.teams[hs].r.filter(q => q.tw).length
  if (tw) { const c6 = C.checkTrade(M, { a: hs, b: tw[0], ga: [], gb: [tw[1].i], pa: [T.picksOf(M, hs).find(k => k.r === 2).i], pb: [] }); L(`5e. a two-way man (${tw[1].n}) for a second (${myTw} two-ways now): ${c6.ok ? 'legal' : c6.why}`); ok(c6.ok || (myTw >= 3 && c6.k === 'roster'), 'two-way men can be traded') }
}

// ── 6. protections and swaps ─────────────────────────────────────────────────
{
  const F = clone(F0)
  N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F); N.closeSeason(F)
  const y = F.year + 1
  const R = N.records(F)
  const worst = N.SHORTS.slice().sort((a, b) => R[a].w - R[b].w)
  const [w1, w2, w3] = worst
  // w1's first to BOS, top-10 protected; w1's next first already belongs to someone else (the debt must not vanish)
  const k1 = F.picks.find(k => k.y === y && k.r === 1 && k.o === w1); k1.t = 'BOS'; k1.pr = { top: 10 }
  const k1n = F.picks.find(k => k.y === y + 1 && k.r === 1 && k.o === w1); k1n.t = 'NYK'
  // a swap: w2 holds the right to swap with the 30th-best team's pick... the best team gives the swap to w3's pick
  const best = worst[29]
  const sdeal = { a: best, b: w3, ga: [], gb: [], pa: [{ swap: y }], pb: [] }
  // (in the offseason before the lottery the window is open)
  const before = C.checkTrade(F, sdeal)
  L(`\n6. ${best} gives ${w3} the ${y} swap: ${before.ok ? 'legal' : before.why}`)
  if (before.ok) {
    C.doTrade(F, sdeal)
    const again = C.checkTrade(F, { a: best, b: w2, ga: [], gb: [], pa: [{ swap: y }], pb: [] })
    ok(!again.ok, `the same swap can't be sold twice (${again.why})`)
    // best sells its (swap-encumbered) first to NOP: the swap goes with it
    const bk = F.picks.findIndex(k => k.y === y && k.r === 1 && k.o === best)
    F.picks[bk].t = 'NOP'
  }
  N.nextStep(F) // the lottery
  const k1a = F.picks.find(k => k.y === y && k.r === 1 && k.o === w1)
  const owed = F.picks.filter(k => k.o === w1 && k.t === 'BOS' && k.y > y)
  L(`   ${w1}'s ${y} first: No. ${k1a.n}, to ${k1a.t}; BOS is owed ${owed.map(k => `${k.y} ${k.r === 1 ? '1st' : '2nd'} ${k.pr ? `top-${k.pr.top}` : 'unprotected'}`).join(', ') || 'nothing'}`)
  if (k1a.n <= 10) ok(k1a.t === w1 && owed.length && owed.every(k => !k.pr || k.pr.top <= 5), 'a protected pick that rolls steps down, and the debt lands even when next year\'s first was gone')
  const sw3 = F.picks.find(k => k.y === y && k.r === 1 && k.o === w3), swb = F.picks.find(k => k.y === y && k.r === 1 && k.o === best)
  L(`   the swap: ${w3}'s pick No. ${sw3.n} -> ${sw3.t}; ${best}'s No. ${swb.n} -> ${swb.t}`)
  if (before.ok) ok(sw3.n < swb.n ? sw3.t === w3 && swb.t === 'NOP' : sw3.t === 'NOP' && swb.t === w3, 'the swap is honoured against the pick\'s new owner')
}

// ── 7. the league's own deals by date ────────────────────────────────────────
{
  const F = clone(F0)
  const days = []
  let seen = F.trn ?? 0
  while (F.phase === 'season') {
    N.playDay(F)
    if ((F.trn ?? 0) > seen) { for (const e of (F.trl ?? []).slice(-((F.trn ?? 0) - seen))) days.push(e.d); seen = F.trn }
  }
  const d15 = T.dec15({ ...F, day: 0 }), ddl = F.ddl
  const early = days.filter(d => d < d15).length, week = days.filter(d => d > ddl - 7).length, dday = days.filter(d => d === ddl).length
  L(`\n7. ${days.length} deals in the season: before Dec 15 ${early}, the deadline's last week ${week}, on deadline day ${dday}`)
  ok(early <= Math.max(1, days.length * 0.1), 'almost none before December 15')
  ok(week >= days.length * 0.35, 'a good share in the deadline\'s last week')
  ok(dday >= 1, 'deals on deadline day')
}

L(`\n${bad ? `${bad} FAILED` : 'all ok'}`)
