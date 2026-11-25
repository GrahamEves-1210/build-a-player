// The trade finder and the free-agent list, headless (lib/franchise2/finder.js, street.js), over a few seasons:
//   1  every offer the finder shows for the GM's men and picks is legal (checkTrade), taken by its team when it's
//      proposed (proposeTrade, on a copy of the save), and leaves both teams' caps and rosters legal
//   2  every price it quotes for a man around the league is the same, and nothing in the package is there for
//      nothing (take any one piece out and the team says no)
//   3  a man it says can't be had isn't had for two first-round picks either (the answers no package changes)
//   4  the free-agent list is the men who can be signed: at each time of year the list is F.fa, a man marked SIGN
//      signs (cap and roster legal after), a man not marked doesn't; in free agency CAN AFFORD is what setOffer takes
//   5  the men nobody signed stay on the street into the season, the list rides in the save, an old save loads
//   6  a GM who takes every finder deal the gauge says he wins doesn't run away with the league
//   bash scripts/franchise2/run.sh scripts/franchise2/finder-check.mjs [seasons=3] [team=NYJ] [seed]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'
import { seeded } from '../../src/lib/rng'

FR.useContracts(CONTRACTS)
const N = Number(process.argv[2] ?? 3), team = process.argv[3] ?? 'NYJ', SEED = process.argv[4] ?? '', MODE = process.argv[5] ?? ''   // (MODE: 'nobot' the same seasons without the bot's deals; 'botonly' the bot without the proofs)
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen')
const F = FR.createFranchise({ seed: 'finder-' + team + SEED, team, owner: 'G', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 12 }], coach: { name: 'Test Coach', style: 'players', r: { talentDev: 6, offPlaycalling: 6, defPlaycalling: 6, culture: 6, situational: 6 }, ovr: 76 } })
const H = seeded('finder-bot' + SEED)
const copy = () => FR.unpackFranchise(FR.packFranchise(F))
const v0 = x => Math.round(x)
const T = { shop: 0, shopOffers: 0, shopNone: 0, find: 0, priced: 0, deals: 0, nos: {}, minimal: 0, proved: 0, ratio: [], ms: { shop: 0, find: 0 }, slow: {}, times: { shop: [], find: [] }, street: 0, signed: 0, refused: 0, market: 0, next: 0, bot: [], botDeals: 0 }

// (the save read back, as a player opening the game has it: nothing worked out ahead and kept from an earlier week.
// The engine keeps a team's situation, the draft order it projects and the market's lines for the week; a copy made
// after a trade in that week reads them fresh, so the finder and its proof both run on copies)
const copyOf = X => FR.unpackFranchise(FR.packFranchise(X))
// both teams legal after a trade made on a copy
function legalAfter(X, G, s, tag, was) {
  for (const t of [G.team, s]) {
    const room = FR.capRoom(G, t)
    if (!(G.noCap && t === G.team) && room < -0.05 && room < was[t] - 0.05) bad(`${tag}: ${t} cap ${was[t]} → ${room}`)
    if (G.phase === 'season') for (const pos of FR.POS) {
      const n = G.teams[t].r.filter(p => p.p === pos && !p.fl).length, b = X.teams[t].r.filter(p => p.p === pos && !p.fl).length
      if (n > Math.max(FR.MAX[pos], b)) bad(`${tag}: ${t} has ${n} at ${pos}`)
    }
  }
}
// one finder result: legal, taken by its team's own book, close to even; proposed for real on a copy when asked
function prove(X, o, tag, real) {
  const c = FR.checkTrade(X, o.s, o.give, o.get)
  if (!c.ok) { bad(`${tag}: not legal: ${c.text}`); return }
  if (!FR.decide(X, o.s, o.give, o.get).ok) { bad(`${tag}: the ${o.s} say no`); return }
  if (Math.abs((c.cap.after ?? 0) - (o.cap.after ?? 0)) > 0.05 || Math.abs((c.cap.dead ?? 0) - (o.cap.dead ?? 0)) > 0.05) bad(`${tag}: cap shown ${o.cap.after} (dead ${o.cap.dead}), real ${c.cap.after} (${c.cap.dead})`)
  // (never a deal the league would laugh at: the other team gets at least FIND_EVEN of what it gives, by the chart)
  const g = FR.gauge(X, o.s, o.give, o.get)
  if (g.give < g.get * FR.FIND_EVEN - 1e-6) bad(`${tag}: the ${o.s} give ${v0(g.get)} for ${v0(g.give)}`)
  if (g.get > 0) T.ratio.push(g.give / g.get)
  if (!real) return
  T.proved++
  const G = copyOf(X), was = { [G.team]: FR.capRoom(G, G.team), [o.s]: FR.capRoom(G, o.s) }
  const r = FR.proposeTrade(G, o.s, o.give, o.get)
  if (!r.ok) { bad(`${tag}: proposed and turned down (${r.text})`); return }
  legalAfter(X, G, o.s, tag, was)
  // (and with ACCEPT, the finder's own button)
  if (!FR.acceptDeal(copyOf(X), o.s, o.give, o.get).ok) bad(`${tag}: acceptDeal turned it down`)
}
const timed = (k, tag, fn) => { const t0 = performance.now(); const r = fn(); const ms = performance.now() - t0; T.times[k].push(ms); if (ms > T.ms[k]) { T.ms[k] = ms; T.slow[k] = tag } return r }
function checkFinder(tag, light = false) {
  if (MODE === 'botonly') return
  const X = copyOf(F)
  const names = (s, x) => [...x.pl.map(id => X.teams[s].r.find(p => p.i === id)?.n ?? `#${id}`), ...x.pk].join(' + ') || 'nothing'
  const W = FR.tradeWindow(X)
  const mine = X.teams[X.team].r.filter(p => p.b == null && !p.fl)
  if (!W.open) {
    const r = FR.shopOffers(X, { pl: [mine[0].i], pk: [] }), d = FR.findDeals(X, { g: 'wr' })
    if (r.open || r.list.length || d.open || d.list.length) bad(`${tag}: the finder is open with the window shut`)
    return
  }
  // (the screens have read the league before the finder opens: the first search doesn't pay for that)
  FR.tradeTeams(X); FR.tradeOffers(X)
  // 1. shop: a few of his men (a star, a starter, a backup, one at random) and picks
  const can = mine.filter(p => !FR.tradeable(X, X.team, p)).sort((a, b) => b.o - a.o)
  const picks = FR.picksBy(X)[X.team]
  const gives = [
    ...[can[0], can[4], can[Math.floor(can.length * 0.6)], can[Math.floor(H() * can.length)]].filter(Boolean).map(p => ({ pl: [p.i], pk: [] })),
    ...(can.length >= 6 ? [{ pl: [can[2].i, can[can.length - 1].i], pk: [] }] : []),
    ...(picks.length ? [{ pl: [], pk: [picks[0]] }, { pl: [], pk: [picks[Math.floor(H() * picks.length)]] }] : []),
    ...(can[1] && picks[1] ? [{ pl: [can[1].i], pk: [picks[1]] }] : []),
  ].slice(0, light ? 3 : 99)
  for (const give of gives) {
    const r = timed('shop', `${tag} ${names(X.team, give)}`, () => FR.shopOffers(X, give))
    T.shop++
    if (!r.list.length) { T.shopNone++; if (!r.line) bad(`${tag}: no offers for ${names(X.team, give)} and no reason given`) }
    for (let i = 1; i < r.list.length; i++) if (r.list[i].g.get > r.list[i - 1].g.get + 1e-6) bad(`${tag}: offers out of order`)
    // (every one legal and taken by its own book; the best three and two at random made for real on a copy)
    const sample = new Set([...r.list.slice(0, 3), ...[0, 1].map(() => r.list[Math.floor(H() * r.list.length)]).filter(Boolean)])
    for (const o of [...r.list, ...r.dumps]) {
      T.shopOffers++
      if (o.k === 'dump' ? o.get.pl.length + o.get.pk.length : !(o.get.pl.length + o.get.pk.length)) bad(`${tag}: a wrong offer from the ${o.s}`)
      if (o.k === 'player' && !o.get.pl.length) bad(`${tag}: a player offer without a player`)
      prove(X, o, `${tag} shop ${names(X.team, give)} → ${o.s} ${names(o.s, o.get)}`, sample.has(o) || o.k === 'dump')
    }
  }
  // a man who can't be traded says why
  const stuck = X.teams[X.team].r.find(p => p.b != null) ?? mine.find(p => FR.tradeable(X, X.team, p))
  if (stuck) { const r = FR.shopOffers(X, { pl: [stuck.i], pk: [] }); if (r.list.length || !r.line) bad(`${tag}: ${stuck.n} can't be traded but the finder has offers`) }
  // 2, 3. find: every room
  for (const g of light ? FR.FIND_GROUPS.filter(() => H() < 0.3) : FR.FIND_GROUPS) {
    const q = H() < 0.5 ? { g } : { g, minO: 76 + Math.floor(H() * 12), ...(H() < 0.4 && { ageMax: 27 }), ...(H() < 0.3 && { max$: 12 }) }
    const d = timed('find', `${tag} ${JSON.stringify(q)}`, () => FR.findDeals(X, q))
    T.find++
    T.priced += d.priced
    for (const r of [...d.list, ...d.no]) {
      const p = r.p
      if (FR.groupOf(p) !== g || (q.minO && p.o < q.minO) || (q.ageMax && p.ag > q.ageMax) || (q.max$ != null && p.$ > q.max$)) bad(`${tag}: ${p.n} doesn't fit ${JSON.stringify(q)}`)
    }
    for (const r of d.list) {
      T.deals++
      const label = `${tag} find ${r.p.n} (${r.s}) ← ${names(X.team, r.give)}`
      prove(X, r, label, T.deals % 5 === 0)
      // nothing in the package is there for nothing: without any one piece the team says no (or the deal stops being
      // close to even)
      const parts = [...r.give.pl.map(id => ['pl', id]), ...r.give.pk.map(k => ['pk', k])]
      if (parts.length > 1) for (const [k, v] of parts) {
        const less = { pl: r.give.pl.filter(x => k !== 'pl' || x !== v), pk: r.give.pk.filter(x => k !== 'pk' || x !== v) }
        T.minimal++
        const gl = FR.gauge(X, r.s, less, r.get)
        if (gl.give >= gl.get * FR.FIND_EVEN && FR.checkTrade(X, r.s, less, r.get).ok && FR.decide(X, r.s, less, r.get).ok && !(k === 'pl' && r.p.p === 'qb')) bad(`${label}: the ${r.s} take it without ${v}`)
      }
    }
    for (const r of d.no) {
      T.nos[r.why] = (T.nos[r.why] ?? 0) + 1
      if (!r.text) bad(`${tag}: ${r.p.n} can't be had and no reason given`)
      // (the answers no package changes: two firsts don't either)
      if (['hurt', 'deal', 'done', 'new', 'cap', 'qb'].includes(r.why)) {
        const firsts = picks.filter(k => FR.parsePick(k).r === 1).slice(0, 2)
        if (firsts.length && FR.checkTrade(X, r.s, { pl: [], pk: firsts }, { pl: [r.p.i], pk: [] }).ok && FR.decide(X, r.s, { pl: [], pk: firsts }, { pl: [r.p.i], pk: [] }).ok) bad(`${tag}: ${r.p.n} "${r.text}" but two firsts get him`)
      }
    }
  }
}
// 4. the free-agent list against what can really be signed
function checkMarket(tag, kind) {
  const F0 = F
  if (MODE === 'botonly') return FR.marketRead(F0)
  return checkMarketOn(copyOf(F0), tag, kind)
}
function checkMarketOn(F, tag, kind) {
  const copy = () => copyOf(F)
  const M = FR.marketRead(F)
  if (kind && M.W.k !== kind) bad(`${tag}: the list is '${M.W.k}', expected '${kind}'`)
  const real = (F.fa ?? []).filter(p => !p.fl)
  if (M.W.k !== 'shut' && (M.men.length !== real.length || M.men.some(p => !real.includes(p)))) bad(`${tag}: the list has ${M.men.length} men, ${real.length} are free agents`)
  if (M.W.k === 'shut') { for (const p of real.slice(0, 5)) if (FR.signStreet(copy(), p.i).ok) bad(`${tag}: ${p.n} signed with the list shut`); return M }
  for (const p of M.men) {
    const r = FR.marketRow(F, p, M.V, M.W)
    if (!(r.ask?.$ > 0) || !(r.ask.y >= 1) || !r.fit) bad(`${tag}: ${p.n} has no price or fit on the list`)
    if (M.W.k === 'street') {
      T.street++
      const G = copy(), was = FR.capRoom(G), n0 = Object.fromEntries(FR.POS.map(pos => [pos, G.teams[G.team].r.filter(x => x.p === pos && !x.fl).length]))
      const s = FR.signStreet(G, p.i)
      if (s.ok !== r.sign) bad(`${tag}: ${p.n} listed ${r.sign ? 'SIGN' : `no (${r.why})`} but signStreet says ${s.ok ? 'yes' : s.text}`)
      if (!s.ok) { T.refused++; continue }
      T.signed++
      const me = G.teams[G.team].r, got = me.find(x => x.i === p.i)
      if (!got || got.y !== 1 || Math.abs(got.$ - r.ask.$) > 0.01) bad(`${tag}: ${p.n} signed for ${got?.$}x${got?.y}, listed ${r.ask.$}x1`)
      if ((G.fa ?? []).some(x => x.i === p.i)) bad(`${tag}: ${p.n} signed and still on the street`)
      const room = FR.capRoom(G)
      if (!G.noCap && room < -0.05) bad(`${tag}: signing ${p.n} left the ${team} ${room} under (was ${was})`)
      if (Math.abs(room - r.cap.after) > 0.15) bad(`${tag}: ${p.n} cap after shown ${r.cap.after}, real ${room}`)
      if (G.phase === 'season') for (const pos of FR.POS) { const n = me.filter(x => x.p === pos && !x.fl).length; if (n > Math.max(FR.MAX[pos], n0[pos])) bad(`${tag}: signing ${p.n} left ${n} at ${pos}`) }
      for (const x of r.cut) if (me.some(y => y.i === x.i)) bad(`${tag}: ${x.n} was to be released for ${p.n} and wasn't`)
      if (me.length < F.teams[F.team].r.length - 1 - r.cut.length) bad(`${tag}: signing ${p.n} lost men from the roster`)
    } else {
      if (r.sign) bad(`${tag}: ${p.n} marked SIGN outside the street`)
      if (FR.signStreet(F, p.i).ok) bad(`${tag}: ${p.n} signed off the list during '${M.W.k}'`)
      if (M.W.k === 'market') {
        T.market++
        // (CAN AFFORD is what the offer screen takes at his ask)
        const was = F.fao
        if (FR.setOffer(F, p.i, { $: p.$, y: p.y, b: 0 }) !== r.can) bad(`${tag}: ${p.n} asks ${p.$}, room ${FR.roomLeft(F, p.i)}: listed ${r.can ? 'CAN' : "CAN'T"} afford`)
        F.fao = was
        if (r.fav && r.fav.s !== F.team && !r.rivals.some(x => x.s === r.fav.s)) bad(`${tag}: ${p.n} expected to sign with a team that isn't bidding`)
      } else T.next++
    }
  }
  return M
}
// 6. the GM who takes every finder deal the gauge says he wins
function bot(tag) {
  if (MODE === 'nobot' || !FR.tradeWindow(F).open) return
  const can = F.teams[F.team].r.filter(p => !FR.tradeable(F, F.team, p) && p.o >= 76).sort(() => H() - 0.5).slice(0, 3)
  for (const p of can) {
    if (!F.teams[F.team].r.includes(p)) continue
    const best = FR.shopOffers(F, { pl: [p.i], pk: [] }).list.filter(o => o.g.get > o.g.give)[0]
    if (!best) continue
    const a = FR.acceptDeal(F, best.s, best.give, best.get)
    if (a.ok) { T.botDeals++; T.bot.push({ give: best.g.give, get: best.g.get, line: a.line, tag }) } else bad(`${tag}: the bot's deal was turned down (${a.text})`)
  }
  const g = FR.FIND_GROUPS[Math.floor(H() * 10)]
  const d = FR.findDeals(F, { g, minO: 80 }).list.filter(r => r.g.get > r.g.give)[0]
  if (d) { const a = FR.acceptDeal(F, d.s, d.give, d.get); if (a.ok) { T.botDeals++; T.bot.push({ give: d.g.give, get: d.g.get, line: a.line, tag }) } else bad(`${tag}: the bot's deal was turned down (${a.text})`) }
}

const mineR = () => F.teams[F.team].r
const street0 = FR.marketMen(F).length
for (let y = 0; y < N; y++) {
  const t0 = performance.now()
  let streetAtWk1 = 0
  while (F.phase === 'season') {
    const tag = `${F.year} wk ${F.wk + 1}`
    // (every week up to the deadline and the week after it; the list every third week)
    if (F.wk <= FR.TRADE_DEADLINE + 1) checkFinder(tag, ![0, 4, FR.TRADE_DEADLINE, FR.TRADE_DEADLINE + 1].includes(F.wk))
    if (F.wk % 3 === 0) { const M = checkMarket(tag, 'street'); if (F.wk === 0) streetAtWk1 = M.men.length }
    if (F.wk <= FR.TRADE_DEADLINE && F.wk % 2 === 1) bot(tag)
    // (the week's card about a veteran still unsigned: the list's price)
    if (F.wk === 4) { const ev = FR.eventNow(F, 'street'); if (ev) { const p = F.fa.find(x => x.i === ev.pid); if (Math.abs(ev.cost - FR.streetDeal(F, p).$) > 0.01) bad(`${tag}: the street card signs ${p.n} at ${ev.cost}, the list at ${FR.streetDeal(F, p).$}`) } }
    FR.playWeek(F, { moments: false })
    if (F.ev) F.ev = null
  }
  checkMarket(`${F.year} post`, 'shut')
  FR.intoPlayoffs(F)
  checkFinder(`${F.year} playoffs`); checkMarket(`${F.year} playoffs`, 'shut')
  FR.simPlayoffs(F)
  FR.closeSeason(F); FR.closeCarousel(F)
  checkFinder(`${F.year} awards`); checkMarket(`${F.year} awards`, 'shut')
  FR.ageLeague(F); FR.openResign(F)
  checkFinder(`${F.year} re-sign`); checkMarket(`${F.year} re-sign`, 'next')
  for (const id of [...F.rs]) { const p = mineR().find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? (p.o >= 80 ? 'option' : 'decline') : p.b != null || p.o >= 76) }
  bot(`${F.year} re-sign`)
  FR.openFA(F)
  const onMarket = FR.marketMen(F).length
  while (F.fad) {
    checkMarket(`${F.year} fa day ${F.fad}`, 'market')
    const p = FR.faBoard(F, 12).find(x => FR.roomLeft(F) >= x.$ && x.o >= 78)
    if (p) FR.setOffer(F, p.i, { $: p.$, y: p.y, b: 0 })
    FR.nextFADay(F)
  }
  const left = FR.marketMen(F)
  if (left.length > FR.STREET_KEEP + left.filter(p => p.cc).length) bad(`${F.year}: ${left.length} men kept on the street`)
  if ((F.fa ?? []).some(p => p.fl)) bad(`${F.year}: a filler on the street`)
  checkMarket(`${F.year} fa closed`, 'street')
  FR.openDraft(F)
  checkFinder(`${F.year} draft week`); checkMarket(`${F.year} draft week`, 'street'); bot(`${F.year} draft week`)
  FR.startNight(F)
  checkFinder(`${F.year} draft night`)
  { const M = FR.marketRead(F); if (M.W.open) bad('the street is open on draft night'); for (const p of M.men.slice(0, 3)) if (FR.signStreet(copy(), p.i).ok) bad('a man signed on draft night') }
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft(F)
  checkFinder(`${F.year} after the draft`); checkMarket(`${F.year} after the draft`, 'street')
  const h = F.hist[F.hist.length - 1], st = FR.strength(F, F.team)
  FR.autoCamp(F); FR.newSeason(F)
  const now = FR.marketMen(F)
  console.log(`${F.year - 1}: the ${team} went ${h.w}-${h.l}${h.t ? `-${h.t}` : ''} (${h.fin}), ${st.ovr} OVR after the draft`)
  console.log(`${F.year - 1}: street at Week 1 ${streetAtWk1} · market ${onMarket} · unsigned after it ${left.length} (best ${left.slice().sort((a, b) => b.o - a.o).slice(0, 4).map(p => `${p.n} ${p.p} ${p.o}/${p.ag}`).join(', ')}) · on the street for ${F.year}: ${now.length} · ${(performance.now() - t0).toFixed(0)} ms`)
  if (now.length < Math.min(left.length, 5)) bad(`${F.year}: the unsigned men didn't stay on the street (${left.length} → ${now.length})`)
}
// 5. the save: the street rides in it; a save from before the street loads
{
  const s = FR.packFranchise(F), G = FR.depthOnLoad(FR.upgradeSave(FR.unpackFranchise(s)))
  if (FR.marketMen(G).length !== FR.marketMen(F).length) bad('the street was lost in the save')
  const p = FR.marketMen(G)[0]
  if (p && FR.marketRow(G, p).ask.$ !== FR.marketRow(F, F.fa.find(x => x.i === p.i)).ask.$) bad('a street price changed in the save')
  const old = JSON.parse(s); old.fa = []
  const O = FR.depthOnLoad(FR.upgradeSave(FR.unpackFranchise(JSON.stringify(old))))
  const M = FR.marketRead(O)
  if (M.W.k !== 'street' || M.men.length !== 0) bad('a save with nobody on the street')
  const none = JSON.parse(s); delete none.fa
  const O2 = FR.depthOnLoad(FR.upgradeSave(FR.unpackFranchise(JSON.stringify(none))))
  if (FR.marketRead(O2).men.length !== 0 || !FR.shopOffers(O2, { pl: [O2.teams[O2.team].r.find(x => !FR.tradeable(O2, O2.team, x)).i], pk: [] }).open) bad('a save without a free-agent list')
  console.log(`save: ${Math.round(s.length / 1024)} KB with ${FR.marketMen(F).length} on the street (${Math.round(JSON.stringify(old).length / 1024)} KB without)`)
}
const sum = a => a.reduce((x, y) => x + y, 0)
const given = sum(T.bot.map(t => t.give)), got = sum(T.bot.map(t => t.get))
const med = a => [...a].sort((x, y) => x - y)[a.length >> 1] ?? 0, p95 = a => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)] ?? 0
console.log(`\nshop: ${T.shop} searches, ${T.shopOffers} offers (${T.shopNone} searches with none) · median ${med(T.times.shop).toFixed(0)} ms, 95% under ${p95(T.times.shop).toFixed(0)} ms, slowest ${T.ms.shop.toFixed(0)} ms (${T.slow.shop})`)
console.log(`find: ${T.find} searches, ${T.priced} men priced, ${T.deals} deals, ${T.minimal} pieces tested · can't be had: ${Object.entries(T.nos).map(([k, v]) => `${k} ${v}`).join(', ')} · median ${med(T.times.find).toFixed(0)} ms, 95% under ${p95(T.times.find).toFixed(0)} ms, slowest ${T.ms.find.toFixed(0)} ms (${T.slow.find})`)
console.log(`every result legal and taken by its team's book; ${T.proved} made for real on a copy of the save · what the other team gets for what it gives: lowest ${Math.min(...T.ratio).toFixed(2)}, median ${med(T.ratio).toFixed(2)} (never under ${FR.FIND_EVEN})`)
console.log(`list: ${T.street} street rows (${T.signed} signed on a copy, ${T.refused} rightly refused) · ${T.market} market rows · ${T.next} look-ahead rows · street at the start ${street0}`)
console.log(`the bot: ${T.botDeals} finder deals taken, value sent ${v0(given)}, back ${v0(got)}: net ${v0(got - given)}`)
for (const t of T.bot.slice(0, 12)) console.log(`   [${t.tag}] ${t.line} · ${v0(t.give)} / ${v0(t.get)}`)
if (MODE) { console.log(`(${MODE}: the counts aren't checked)`); process.exit(problems.length ? 1 : 0) }
if (T.shopOffers < 50 * N) bad(`only ${T.shopOffers} offers found`)
if (T.deals < 30 * N) bad(`only ${T.deals} deals priced`)
if (T.ms.shop > 400 || T.ms.find > 400) bad(`a search took ${Math.max(T.ms.shop, T.ms.find).toFixed(0)} ms`)
if (got - given > Math.max(400, given * 0.12)) bad(`the bot came out ${v0(got - given)} ahead over ${T.botDeals} deals`)
console.log(problems.length ? `\n${problems.length} PROBLEMS` : '\nOK')
process.exit(problems.length ? 1 : 0)
