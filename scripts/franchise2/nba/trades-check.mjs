// NBA trades, headless: the value scale, the CBA's trade rules, and a GM trying to fleece the league (a star for
// backups, buy-backs, flips, lopsided offers), on the real league.
//   FR_TMP=F:/bap-agents/frnba-cap/tmp bash scripts/franchise2/run.sh scripts/franchise2/nba/trades-check.mjs [seed]
import { makeLeague, playDay } from './fixture'
import { rngOf } from '../../../src/lib/franchise2/rng'
import * as CAP from '../../../src/lib/franchise2/nba/cap'
import * as K from '../../../src/lib/franchise2/nba/contracts'
import * as T from '../../../src/lib/franchise2/nba/trades'

const SEED = process.argv[2] ?? 'nba-trades'
const F = makeLeague({ seed: SEED, team: 'BOS' })
const S = Object.keys(F.teams), ME = F.team
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const ok = (c, m) => (c ? console.log('  ok ' + m) : bad(m))
const R = rngOf(SEED + '-gm')
const v0 = x => Math.round(x)
const men = s => F.teams[s].r.filter(p => !p.tw)
const pickIdx = (s, y, r) => F.picks.findIndex(k => k.t === s && k.o === s && k.y === y && k.r === r)
const tag = p => `${p.n} (${p.o}/${p.ag} $${p.$}x${p.y})`

// ── 1. The scale ─────────────────────────────────────────────────────────────
{
  const all = S.flatMap(s => men(s).map(p => [s, p]))
  const top = [...all].sort((a, b) => T.manValue(F, b[1]) - T.manValue(F, a[1])).slice(0, 8)
  console.log('most valuable:', top.map(([s, p]) => `${p.n} ${s} ${p.o}/${p.ag} $${p.$}x${p.y} = ${v0(T.manValue(F, p))}`).join(' · '))
  const worst = [...all].sort((a, b) => T.manValue(F, a[1]) - T.manValue(F, b[1])).slice(0, 5)
  console.log('worst contracts:', worst.map(([s, p]) => `${p.n} ${s} ${p.o}/${p.ag} $${p.$}x${p.y} = ${v0(T.manValue(F, p))}`).join(' · '))
  const y = F.year + 1
  console.log('picks:', [1, 5, 14, 30, 31, 45, 60].map(n => `No. ${n} ${v0(T.slotValue(n))}`).join(' · '), '| BOS next first', v0(T.pickValue(F, F.picks[pickIdx(ME, y, 1)]).v), '· in 3 years', v0(T.pickValue(F, F.picks[pickIdx(ME, y + 2, 1)]).v), '· top-10 protected', v0(T.pickValue(F, { ...F.picks[pickIdx(ME, y, 1)], pr: { top: 10 } }).v))
  ok(T.slotValue(1) > T.slotValue(10) && T.slotValue(10) > T.slotValue(30) && T.slotValue(30) > T.slotValue(31), 'the chart falls with the slot')
}

// ── 2. The rules ─────────────────────────────────────────────────────────────
{
  // matching: find a team over the first apron, and offer it a bigger salary than it sends
  const year = CAP.capYear(F)
  const rich = S.filter(s => s !== ME && CAP.payroll(F, s) > CAP.apron1Of(year)).sort((a, b) => CAP.payroll(F, b) - CAP.payroll(F, a))[0]
  if (rich) {
    const small = men(rich).filter(p => !T.whyNot(F, rich, p)).sort((a, b) => a.$ - b.$).find(p => p.$ >= 3)
    const big = men(ME).filter(p => !T.whyNot(F, ME, p) && p.$ > (small?.$ ?? 0) * 1.6 + 1).sort((a, b) => a.$ - b.$)[0]
    if (small && big) {
      const c = T.checkTrade(F, { a: ME, b: rich, ga: [big.i], gb: [small.i], pa: [], pb: [] })
      ok(!c.ok && c.k === 'match', `an apron team (${rich}, $${CAP.payroll(F, rich)}M) can't take back $${big.$}M for $${small.$}M: ${c.why ?? 'allowed'}`)
    }
  }
  // the brackets: $5M out may bring back $10.25M, $20M out $27.5M, $40M out $50.25M (2023-24 dollars, indexed)
  const ix = CAP.capOf(year) / 136.021
  const L = (o) => T.matchLimit(F, ME, o * ix, CAP.capOf(year) + 1, year) / ix
  ok(Math.abs(L(5) - 10.25) < 0.01 && Math.abs(L(20) - 27.5) < 0.01 && Math.abs(L(40) - 50.25) < 0.01, `matching brackets: $5M -> $${L(5).toFixed(2)}M, $20M -> $${L(20).toFixed(2)}M, $40M -> $${L(40).toFixed(2)}M`)
  ok(Math.abs(T.matchLimit(F, ME, 20, CAP.apron1Of(year) + 1, year) - 22) < 0.01 && Math.abs(T.matchLimit(F, ME, 20, CAP.apron2Of(year) + 1, year) - 20) < 0.01, 'over the first apron 110%, over the second 100%')
  // the Stepien rule: two straight firsts out
  const y = T.nextDraft(F)
  const other = S.find(s => s !== ME && CAP.payroll(F, s) < CAP.capOf(year))
  const c2 = T.checkTrade(F, { a: ME, b: other ?? S[1], ga: [], gb: [], pa: [pickIdx(ME, y + 1, 1), pickIdx(ME, y + 2, 1)], pb: [] })
  ok(!c2.ok && c2.k === 'stepien', `two straight firsts out: ${c2.why ?? 'allowed'}`)
  const c3 = T.checkTrade(F, { a: ME, b: other ?? S[1], ga: [], gb: [], pa: [pickIdx(ME, y + 1, 1), pickIdx(ME, y + 3, 1)], pb: [] })
  ok(c3.ok, `firsts two years apart are fine: ${c3.why ?? 'allowed'}`)
  // protections and swaps
  const c4 = T.checkTrade(F, { a: ME, b: other ?? S[1], ga: [], gb: [], pa: [{ i: pickIdx(ME, y, 1), top: 10 }, { swap: y + 2 }], pb: [] })
  ok(c4.ok, `a top-10 protected first and a swap: ${c4.why ?? 'allowed'}`)
  // the second apron freezes the first seven drafts out
  const a2 = S.find(s => s !== ME && CAP.payroll(F, s) > CAP.apron2Of(year))
  if (a2) {
    const c5 = T.checkTrade(F, { a: a2, b: other ?? S[1], ga: [], gb: [], pa: [pickIdx(a2, y + 6, 1)], pb: [] })
    ok(!c5.ok && (c5.k === 'frozen' || c5.k === 'stepien'), `${a2} over the second apron trades its 7th-year first: ${c5.why ?? 'allowed'}`)
  }
  // recently signed: a man signed this summer waits for December 15
  const p = men(other ?? S[1])[0]
  const was = [p.sgn, p.sgd]
  p.sgn = CAP.capYear(F); p.sgd = -1
  ok(!!T.whyNot(F, other, p), `a man signed in the summer: ${T.whyNot(F, other, p)}`)
  F.day = T.dec15(F) + 1
  ok(!T.whyNot(F, other, p), `on December 16 he can be traded (day ${F.day}, Dec 15 = day ${T.dec15(F)})`)
  ;[p.sgn, p.sgd] = was
  F.day = F.ddl + 1
  ok(!T.tradeWindow(F).open, `after the deadline (day ${F.ddl}): ${T.tradeWindow(F).why}`)
  F.day = 0
}

// ── 3. The exploits ──────────────────────────────────────────────────────────
const tally = { tries: 0, took: 0, fleece: 0 }
// a star for three backups
{
  let refused = 0, tried = 0
  for (const s of S.filter(x => x !== ME)) {
    const star = men(s).filter(p => !T.whyNot(F, s, p)).sort((a, b) => T.manValue(F, b) - T.manValue(F, a))[0]
    if (!star || T.manValue(F, star) < 60) continue
    const top8 = new Set(men(ME).sort((a, b) => b.o - a.o).slice(0, 8).map(p => p.i))
    const backs = men(ME).filter(p => !top8.has(p.i) && !T.whyNot(F, ME, p)).sort((a, b) => b.o - a.o).slice(0, 3)
    if (backs.length < 3) continue
    const d = { a: ME, b: s, ga: backs.map(p => p.i), gb: [star.i], pa: [], pb: [] }
    if (!T.checkTrade(F, d).ok) continue
    tried++
    const ans = T.cpuAnswer(F, d)
    if (!ans.yes) refused++
    else bad(`${s} gave ${tag(star)} for three backups`)
  }
  ok(tried === 0 || refused === tried, `a star for three backups: refused ${refused} of ${tried}`)
}
// lopsided offers: the GM offers a little less than fair, again and again
{
  F.day = 20
  for (let k = 0; k < 400; k++) {
    const s = S.filter(x => x !== ME)[Math.floor(R() * 29)]
    const theirs = men(s).filter(p => !T.whyNot(F, s, p))
    const mine = men(ME).filter(p => !T.whyNot(F, ME, p))
    const want = theirs[Math.floor(R() * theirs.length)]
    if (!want) continue
    const give = [...mine].sort(() => R() - 0.5).slice(0, 1 + Math.floor(R() * 2))
    const d = { a: ME, b: s, ga: give.map(p => p.i), gb: [want.i], pa: [], pb: [] }
    if (!T.checkTrade(F, d).ok) continue
    tally.tries++
    const g = T.gauge(F, d)
    const ans = T.cpuAnswer(F, d)
    if (ans.yes) {
      tally.took++
      if (g.lean > 0.2) { tally.fleece++; bad(`${s} took a lopsided deal: ${T.tradeLine(F, d)} (gauge ${v0(g.a)} for ${v0(g.b)})`) }
      // don't make it: keep the league as it is for the next try
    }
  }
  ok(tally.fleece === 0, `lopsided offers: ${tally.took} of ${tally.tries} legal offers accepted, ${tally.fleece} in the GM's favour by 20%+`)
}
// buy-backs and flips
{
  F.day = 20
  let done = null
  for (const s of S.filter(x => x !== ME)) {
    for (const p of men(s).filter(x => !T.whyNot(F, s, x) && T.manValue(F, x) > 15 && T.manValue(F, x) < 60)) {
      // the GM pays a fair price in picks and matching salary
      const pk = F.picks.map((k, i) => [k, i]).filter(([k]) => k.t === ME && k.y >= T.nextDraft(F)).sort((a, b) => T.pickValue(F, a[0]).v - T.pickValue(F, b[0]).v)
      const filler = men(ME).filter(x => !T.whyNot(F, ME, x) && x.$ >= p.$ * 0.8 && x.$ <= p.$ * 1.25 && T.manValue(F, x) < 6)[0]
      for (const [, i] of pk.slice(-8)) {
        const d = { a: ME, b: s, ga: filler ? [filler.i] : [], gb: [p.i], pa: [i], pb: [] }
        if (!T.checkTrade(F, d).ok) continue
        const ans = T.cpuAnswer(F, d)
        if (ans.yes) { T.doTrade(F, d); done = { s, p, d }; break }
      }
      if (done) break
    }
    if (done) break
  }
  if (!done) bad('no fair trade found to test buy-backs and flips')
  else {
    console.log(`  the GM's trade: ${done.d && T.tradeLine(F, { ...done.d, ga: [], gb: [], pa: [], pb: [] })}${done.p.n} from ${done.s}`)
    // buy-back: the team that sold him won't take him back this league year
    const back = { a: ME, b: done.s, ga: [done.p.i], gb: [], pa: [], pb: [] }
    const ans = T.cpuAnswer(F, back)
    ok(!ans.yes && (ans.why === 'back' || !T.checkTrade(F, back).ok), `the ${done.s} won't take ${done.p.n} back: ${ans.text}`)
    // the flip: nobody pays more than the GM paid for him
    const paid = done.p.tx?.[3] ?? 0
    let best = 0
    for (const s of S.filter(x => x !== ME && x !== done.s)) {
      const pk = F.picks.map((k, i) => [k, i]).filter(([k]) => k.t === s && k.y >= T.nextDraft(F)).sort((a, b) => T.pickValue(F, b[0]).v - T.pickValue(F, a[0]).v)
      for (let n = 1; n <= 3; n++) {
        const d = { a: ME, b: s, ga: [done.p.i], gb: [], pa: [], pb: pk.slice(0, n).map(([, i]) => i) }
        if (!T.checkTrade(F, d).ok) continue
        if (T.cpuAnswer(F, d).yes) best = Math.max(best, T.gauge(F, d).b)
      }
    }
    ok(best <= paid * 1.05 + 1, `flipping ${done.p.n}: paid ${v0(paid)}, the best offer back ${v0(best)}`)
  }
}
console.log(problems.length ? `${problems.length} PROBLEMS` : 'ALL CHECKS PASS')
process.exit(problems.length ? 1 : 0)
