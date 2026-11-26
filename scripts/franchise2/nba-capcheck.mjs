// NBA Franchise: the cap rules, one check each (the 2023 CBA). Prints PASS/FAIL lines and a count at the end.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-capcheck.mjs [seed=c2]
import * as N from '../../src/lib/franchise2/nba/index'
import * as K from '../../src/lib/franchise2/nba/contracts'
import * as M from '../../src/lib/franchise2/nba/market'
import * as CP from '../../src/lib/franchise2/nba/cap'
const C = N.CAP_SIM
// (the cases are set up on one league's state: on 'cc' after the 11-23 schedule change NYK's cap holds keep setPay from
// reaching 'over the cap, under the apron', and BOS's owner limit refuses the match — both right, just not the case asked)
const SEED = process.argv[2] ?? 'c2'
let fails = 0, passes = 0
const ok = (cond, what, more = '') => { if (cond) passes++; else fails++; console.log(`${cond ? 'PASS' : 'FAIL'} ${what}${more ? ' | ' + more : ''}`) }
const clone = F => N.unpackNba(N.packNba(F))
const setPay = (F, s, target) => { const p = F.teams[s].r.filter(p => !p.tw).sort((a, b) => b.$ - a.$)[0]; p.$ = Math.max(1, Math.round((p.$ + target - C.payroll(F, s)) * 10) / 10); return p }

// ── the numbers ──
ok(Math.abs(CP.taxStep(2023) - 5) < 0.01 && Math.abs(CP.taxStep(2027) - 5 * C.capOf(2027) / 136.021) < 0.02, 'tax brackets are $5M in 2023-24, indexed to the cap since', `2027 step ${CP.taxStep(2027)}`)
ok(CP.isRepeater({ s: 'BOS' }, 2026) && !CP.isRepeater({ s: 'OKC' }, 2026), 'Boston opens as a repeater (taxpayer 2022-23 to 2024-25), OKC does not')

// ── a league at its first free agency ──
const F0 = N.createNbaFranchise({ seed: SEED, team: 'BOS', owner: 'G' })
const bosStart = C.capSheet(F0, 'BOS')
N.simTo(F0, F0.days); N.startPostseason(F0); N.simPostseason(F0); N.closeSeason(F0)
while (F0.off.step !== 'resign') { if (F0.off.step === 'draft') N.draftTo(F0, { stopMine: false }); N.nextStep(F0) }
const y = C.capYear(F0)
const RS = clone(F0)   // the re-sign stop
N.nextStep(F0)          // to free agency (day 0)
const T = 'NYK'          // a league team: no owner's ceiling in the way
const fa = F => [...F.fa].filter(p => p.fr !== 'BOS' && p.fr !== T && !p.rfa && !p.wvb).sort((a, b) => b.o - a.o)

// #7 the room exception: only for a team that used its room; a Bird re-signing never uses room
{
  const F = clone(F0)
  const own = F.fa.find(p => p.fr && p.fr !== F.team && !p.rfa && (p.bird ?? 0) >= 3 && p.$l > 3)
  const s = own.fr
  // (under the cap: his Bird re-signing goes by Bird rights, not room)
  for (const p of F.teams[s].r.filter(p => !p.tw).slice(3)) F.teams[s].r = F.teams[s].r.filter(x => x !== p)
  const c = C.canSign(F, s, own, { $: own.$l, y: 2, r: 0 })
  C.signMan(F, s, own, { $: own.$l, y: 2, r: 0 })
  ok(c.via === 'bird' && !F.teams[s].exc.room, '#7 a Bird re-signing under the cap uses Bird rights and leaves the room flag off', `${JSON.stringify(c)} exc ${JSON.stringify(F.teams[s].exc)}`)
  // (over the second apron: minimum deals only, even with the room flag on)
  const G = clone(F0); G.teams[T].exc = null; K.excFor(G, T); G.teams[T].exc.room = 1; setPay(G, T, C.apron2Of(y) + 3)
  const p = fa(G)[2]
  const r1 = C.canSign(G, T, p, { $: CP.excOf('room', y), y: 2, r: 0 }), r2 = C.canSign(G, T, p, { $: C.minOf(p.ys, y), y: 2, r: 0 })
  ok(!r1.ok && r2.ok && r2.via === 'min', '#7 over the second apron: no room MLE, the minimum only', `${JSON.stringify(r1)} / ${JSON.stringify(r2)}`)
  // (over the cap, never under it: the NT-MLE, not the room MLE)
  const H = clone(F0); H.teams[T].exc = null; K.excFor(H, T); setPay(H, T, C.capOf(y) + 10)
  const r3 = C.canSign(H, T, fa(H)[2], { $: CP.excOf('nt', y), y: 3, r: 0.05 })
  ok(r3.ok && r3.via === 'mle', '#7 over the cap with no room used: the non-taxpayer MLE', JSON.stringify(r3))
  // (just under the first apron: the NT-MLE would pass it; the message says so; the taxpayer MLE fits)
  // (a roster of 13: an exception's hard cap has to leave room for the minimum deals a 14-man roster still needs)
  const J = clone(F0); J.teams[T].exc = null; K.excFor(J, T)
  for (const x of [...J.fa].filter(x => !x.fr && !x.wvb).sort((a, b) => a.o - b.o)) { if (J.teams[T].r.filter(q => !q.tw).length >= 13) break; C.signMan(J, T, x, { $: C.minOf(x.ys ?? 0, y), y: 1, r: 0 }) }
  setPay(J, T, C.apron1Of(y) - 5)
  const r4 = C.canSign(J, T, fa(J)[2], { $: CP.excOf('nt', y), y: 3, r: 0.05 }), r5 = C.canSign(J, T, fa(J)[2], { $: CP.excOf('tp', y), y: 2, r: 0 })
  ok(!r4.ok && /first apron/.test(r4.why ?? '') && r5.ok && r5.via === 'tmle', '#7 the NT-MLE past the first apron is refused for the apron (hard cap), the taxpayer MLE fits', `${r4.why} / ${JSON.stringify(r5)}`)
  // (a signing with room sets the flag, then the room MLE is all that's left)
  const L = clone(F0); for (const x of L.fa.filter(x => x.fr === T)) C.renounce(L, T, x.i); L.teams[T].exc = null; K.excFor(L, T); setPay(L, T, C.capOf(y) - 25 - (CP.capPayroll(L, T) - C.payroll(L, T)))   // ($25M of room, the empty-roster charges counted)
  const q = fa(L)[1]
  const r6 = C.signMan(L, T, q, { $: 20, y: 2, r: 0 })
  ok(r6.via === 'room' && L.teams[T].exc.room === 1 && K.mleFor(L, T)?.k === 'room', '#7 a team that signs with its room gets the room MLE', `${JSON.stringify(r6)} ${JSON.stringify(K.mleFor(L, T))}`)
}

// #26 a waived first-rounder: only the guaranteed years are dead money (not the team-option years)
{
  const F = clone(F0)
  const s = N.SHORTS.find(s => F.teams[s].r.some(p => p.rs && p.opt?.k === 'T' && p.y >= 3))
  const p = F.teams[s].r.find(p => p.rs && p.opt?.k === 'T' && p.y >= 3)
  const c = C.cutCost(F, p)
  const g = p.opt.yr - y
  ok(c.years === g, '#26 a rookie-scale man waived owes his seasons up to the team option, not past it', `${p.n} y ${p.y} opt ${p.opt.yr} -> ${JSON.stringify(c)}`)
}

// #27 a declined rookie-scale option: unrestricted, and his team can pay him no more than the option
{
  const F = N.createNbaFranchise({ seed: SEED + '-opt', team: 'OKC', owner: 'G' })
  N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F); N.closeSeason(F)
  const opts = N.teamOptions(F).filter(o => o.p.rs)
  for (const o of opts) N.setOption(F, o.p.i, false)
  while (F.off.step !== 'resign') { if (F.off.step === 'draft') N.draftTo(F, { stopMine: false }); N.nextStep(F) }
  const men = opts.map(o => F.fa.find(p => p.i === o.p.i)).filter(Boolean)
  ok(men.length > 0 && men.every(p => !p.rfa && !p.qo && p.dco > 0), '#27 declined rookie options: unrestricted free agents with the option as his team\'s limit', men.map(p => `${p.n} rfa ${p.rfa ?? 0} dco ${p.dco}`).join('; ') || 'no rookie options on OKC')
  const p = men[0]
  if (p) { const c = C.canSign(F, 'OKC', p, { $: p.dco + 2, y: 2, r: 0 }); ok(!c.ok && /option/.test(c.why), '#27 his team can\'t pay him past the declined option', c.why) }
}

// #28 the GM's RFAs: an untendered one walks, a tendered one stays restricted
{
  const F = clone(RS)
  const rf = (F.off.mine ?? []).map(i => F.fa.find(p => p.i === i)).filter(p => p?.rfa)
  if (rf.length) {
    const info = N.resignInfo(F, rf[0].i)
    ok(info && info.qo > 0 && info.hold > 0 && info.rights, '#28 resignInfo has the QO, his rights, his hold and the room letting him go opens', JSON.stringify({ ...info, can: info.can?.ok }))
    N.tenderQO(F, rf[0].i, true)
    N.nextStep(F)
    const a = F.fa.find(p => p.i === rf[0].i), b = rf[1] && F.fa.find(p => p.i === rf[1].i)
    ok(a?.rfa && a.fr === F.team && (!b || (!b.rfa && b.rn)), '#28 the tendered RFA stays restricted, the untendered one is unrestricted', `${a?.n} rfa ${a?.rfa} | ${b ? `${b.n} rfa ${b.rfa ?? 0} rn ${b.rn ?? 0}` : 'one RFA only'}`)
  } else console.log('(no GM RFAs this seed: #28 skipped)')
}

// #31 / #14 waive and stretch: the stretch reads in the shape the team screen reads; he can't come back for a year
{
  const F = clone(F0)
  const p = F.teams.BOS.r.filter(q => !q.tw && q.y >= 2 && !q.ng && !q.rs).sort((a, b) => a.$ - b.$)[0]
  const cs = C.cutCost(F, p, { stretch: true }), cn = C.cutCost(F, p)
  ok(cs.per != null && cs.years > cn.years && Math.abs(cs.per * cs.years - cs.total) < 0.3, '#14 cutCost carries per/years for the stretch (NbaTeam reads costS.per)', `${JSON.stringify(cs)} vs ${JSON.stringify(cn)}`)
  C.cutMan(F, 'BOS', p.i, { stretch: true })
  const r = N.signFA(F, p.i, { $: C.minOf(p.ys, y), y: 1 })
  ok(!r.ok && /waived/.test(r.why), '#31 the team that waived him can\'t sign him back for a year', r.why)
}

// #42 the GM's offers are bids: nothing signs on day 0, the man decides with the league's offers on day 1
{
  const F = clone(F0)
  const T0 = F.teams.BOS
  T0.r = T0.r.filter(p => p.tw || p.$ < 8); T0.dead = []
  const best = fa(F).slice(0, 3)
  const placed = best.map(p => ({ p, r: N.signFA(F, p.i, { $: Math.round(C.askOf(F, p).$ * 0.8 * 10) / 10, y: C.askOf(F, p).y }) }))
  ok(placed.some(x => x.r.offer) && placed.every(x => !T0.r.includes(x.p)), '#42 an offer is a bid: nobody is signed on day 0', placed.map(x => `${x.p.n} ${JSON.stringify(x.r).slice(0, 60)}`).join('; '))
  const ask1 = best.map(p => M.askFor(F, p).$)
  N.faNext(F)
  const out = N.offerNews(F)
  ok(out.length > 0, '#42 the next day says what came of each offer', out.map(x => `${x.n}: ${x.k}${x.s ? ' ' + x.s : ''}`).join('; '))
  for (let d = 0; d < 4; d++) N.faNext(F)
  const still = best.filter(p => F.fa.includes(p))
  ok(still.every((p, k) => M.askFor(F, p).$ <= ask1[best.indexOf(p)]), '#42 asks come down over the days', still.map(p => `${p.n} ${ask1[best.indexOf(p)]} -> ${M.askFor(F, p).$}`).join('; ') || 'all signed')
}

// #2 an offer to another team's RFA is an offer sheet his team answers the next day
{
  const F = clone(F0)
  const T0 = F.teams.BOS
  T0.r = T0.r.filter(p => p.tw || p.$ < 6); T0.dead = []
  const rfas = F.fa.filter(p => p.rfa && p.fr && p.fr !== 'BOS').sort((a, b) => b.o - a.o)
  let done = false
  const tried = []
  for (const p0 of rfas.slice(0, 10)) {
    // (each try on its own copy: his own team may simply outbid the GM, and then he re-signs there)
    const F = clone(F0)
    const T0 = F.teams.BOS
    T0.r = T0.r.filter(p => p.tw || p.$ < 6); T0.dead = []
    const p = F.fa.find(x => x.i === p0.i)
    const a = C.askOf(F, p)
    const r = N.signFA(F, p.i, { $: N.offerRoom(F, p.i)?.$ ?? a.$, y: 4 })
    if (!r.ok) continue
    if (!done) ok(r.sheet && !T0.r.includes(p), '#2 an offer to another team\'s RFA is an offer sheet, not a signing', `${p.n} of ${p.fr}`)
    N.faNext(F)
    const k = N.offerNews(F).find(x => x.i === p.i)
    if (k?.k !== 'sheet') { tried.push(`${p.n}: ${k?.k} ${k?.s ?? ''}`); done = true; continue }
    ok(p.osh && !T0.r.includes(p), '#2 he signs the sheet; his team has a day to match', `${JSON.stringify(k)} (before him: ${tried.join('; ') || 'none'})`)
    const was = p.fr
    N.faNext(F)
    const on = N.teamOfMan(F, p.i)
    const n2 = N.offerNews(F).find(x => x.i === p.i)
    ok(on === was || on === 'BOS', '#2 the next day his team matches or he joins the GM', `now on ${on} (${n2?.k}); news: ${F.news.slice(-6).map(x => x.text).filter(t => t.includes(p.n)).join(' / ')}`)
    if (on === was) ok(p.osm?.s === 'BOS', '#31 a matched sheet carries the one-year trade restriction (p.osm)', JSON.stringify(p.osm))
    done = true
    break
  }
  if (!done) console.log('(no RFA the GM could bid on: #2 skipped)')
}

// #2 the GM's own RFA with a sheet out: no plain Sign; he answers it (match or let go)
{
  const F = clone(F0)
  const mine = F.fa.find(p => p.fr === 'BOS' && p.rfa) ?? (() => { const p = fa(F)[5]; p.fr = 'BOS'; p.rfa = 1; p.qo = 5; p.hy = y; p.bird = 3; p.$l = 4; return p })()
  setPay(F, 'BOS', C.taxOf(y) - 20)   // (room under the owner's ceiling to match: #43 is the case where there isn't)
  F.rfq = [{ i: mine.i, s: 'NYK', d: { $: 12, y: 3, r: 0.05 } }]
  const r = N.signFA(F, mine.i, { $: 20, y: 4 })
  const c = C.canSign(F, 'BOS', mine, { $: 20, y: 4, r: 0 })
  ok(!r.ok && !c.ok && /offer sheet/.test(c.why), '#2 the GM can\'t sign his own RFA around the sheet', c.why)
  const m = N.answerSheet(F, mine.i, true)
  ok(m.ok && m.matched && F.teams.BOS.r.includes(mine) && mine.osm, '#2 matching keeps him on the sheet\'s terms, with the trade restriction', `${JSON.stringify(m).slice(0, 120)} osm ${JSON.stringify(mine.osm)}`)
}

// #43 the owner's ceiling: the GM can't re-sign past it; the message says why
{
  const F = clone(RS)
  const o = K.ownerCap(F)
  setPay(F, 'BOS', o.$ - 1)
  const p = (F.off.mine ?? []).map(i => F.fa.find(x => x.i === i)).filter(x => x && (x.bird ?? 0) >= 3).sort((a, b) => b.o - a.o)[0]   // (a man with full Bird rights: a Non-Bird man hits his rights' limit first)
  if (p) {
    const r = N.resignMine(F, p.i, true)
    const ask = C.resignOffer(F, p)
    ok(ask && ask.$ > C.minOf(p.ys, y) + 1 ? !r.ok && /Ownership/.test(r.why) : true, '#43 the owner stops a Bird re-signing past his ceiling', `${p.n} ask ${JSON.stringify(ask)} -> ${r.why ?? 'signed'} (ceiling ${o.$} ${o.k})`)
  }
}

// #23 a build: the man he replaces is waived with his guaranteed money on the books, and the cap line is noted
{
  const F0B = N.createNbaFranchise({ seed: SEED + '-b', team: 'BOS', owner: 'G' })
  const F = N.createNbaFranchise({ seed: SEED + '-b', team: 'BOS', owner: 'G', builds: [{ pos: 'guard', build: Object.fromEntries(['jumpShot', 'finishing', 'passing', 'handles', 'perimeterDefense', 'speed', 'bounce', 'size', 'basketballIQ', 'clutch'].map(k => [k, { val: 11 }])), name: 'Test Guard', num: 77 }] })
  const n = F.news.find(x => /cap|apron|tax/i.test(x.text) && x.s === 'BOS')
  ok(!!n, '#23 adding a build puts the team\'s cap line on the wire', n?.text ?? F.news.slice(-3).map(x => x.text).join(' / '))
  const rel = F.fa.find(p => p.was === 'BOS' && p.wvb)
  const dead = C.capSheet(F, 'BOS').dead
  const was = F0B.teams.BOS.r.filter(x => !x.tw).length
  ok(was < 15 ? !rel : !!rel?.wvb, '#23 a man is waived only when the 15 spots are full, through waivers (his guaranteed money stays)', rel ? `${rel.n} waived, BOS dead money ${dead}` : `no one released (${was} standard deals before the build)`)
}

// #11 second-round picks: about a third sign standard deals, the rest two-way
{
  const F = clone(F0)
  const r2 = N.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.dr?.[0] === F.year + 1 && p.dr?.[1] === 2))
  const std = r2.filter(p => !p.tw).length
  ok(r2.length >= 25 && std <= r2.length * 0.45 && std >= 4, '#11 second-rounders: most go two-way', `${std} of ${r2.length} standard`)
}
console.log(`\n${passes} passed, ${fails} failed (BOS opened at $${bosStart.pay}M, ${bosStart.over})`)
