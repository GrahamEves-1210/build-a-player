// Trades, headless (lib/franchise2/trades.js): what men and picks are worth, the league's calls and its own deals,
// and a GM trying to fleece the league, over a few seasons.
//   bash scripts/franchise2/run.sh scripts/franchise2/trades-check.mjs [seasons=4] [team=NYJ] [seed]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'
import { seeded } from '../../src/lib/rng'

FR.useContracts(CONTRACTS)
const N = Number(process.argv[2] ?? 4), team = process.argv[3] ?? 'NYJ', SEED = process.argv[4] ?? ''
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen')
const F = FR.createFranchise({ seed: 'trades-' + team + SEED, team, owner: 'G', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 12 }], coach: { name: 'Test Coach', style: 'players', r: { talentDev: 6, offPlaycalling: 6, defPlaycalling: 6, culture: 6, situational: 6 }, ovr: 76 } })
const H = seeded('trade-bot' + SEED)
const nameOf = p => `${p.n} (${p.p.toUpperCase()} ${p.o}, ${p.ag})`
const v0 = x => Math.round(x)

// ── 1. The scale: men and picks ──────────────────────────────────────────────
{
  const all = FR.SHORTS.flatMap(s => F.teams[s].r.map(p => [s, p])).filter(([, p]) => p.b == null && !p.fl)
  const top = [...all].sort((a, b) => FR.valueOf(F, b[1]) - FR.valueOf(F, a[1])).slice(0, 8)
  console.log('most valuable men:', top.map(([s, p]) => `${p.n} ${s} ${p.p} ${p.o}/${p.ag} $${p.$}x${p.y} = ${v0(FR.valueOf(F, p))}`).join(' · '))
  for (const o of [72, 76, 80, 84, 88, 92]) {
    const m = all.filter(([, p]) => p.o === o)
    const vs = m.map(([, p]) => FR.valueOf(F, p)).sort((a, b) => a - b)
    if (vs.length) console.log(`  OVR ${o}: ${vs.length} men, median ${v0(vs[vs.length >> 1])}, top ${v0(vs[vs.length - 1])}`)
  }
  const pk = FR.picksBy(F)
  console.log('picks:', ['1', '2', '3', '5'].map(r => `${team} rd ${r}: ${v0(FR.pickWorth(F, FR.pickKey(F.year + 1, +r, team)))} / next ${v0(FR.pickWorth(F, FR.pickKey(F.year + 2, +r, team)))}`).join(' · '))
  if (pk[team].length !== 14) bad(`${team} has ${pk[team].length} picks`)
}

// ── 2. The exploits, tried every week before the deadline ───────────────────
const tally = { proposed: 0, took: 0, fleece: 0, user: [], aiai: [], offers: 0, offersTaken: 0, absurd: 0, backups: 0, back: 0, oracle: [] }
const mine = () => F.teams[F.team].r
const tradeableMen = s => F.teams[s].r.filter(p => !FR.tradeable(F, s, p))
const gaugeOf = (s, give, get) => FR.gauge(F, s, give, get)
const counts = () => Object.fromEntries(FR.SHORTS.map(s => [s, Object.fromEntries(FR.POS.map(pos => [pos, F.teams[s].r.filter(p => p.p === pos && !p.fl).length]))]))
let before = null
function legal(where) {
  if (F.phase !== 'season' || !before) return
  for (const s of FR.SHORTS) for (const pos of FR.POS) {
    const n = F.teams[s].r.filter(p => p.p === pos && !p.fl).length
    if (n > Math.max(FR.MAX[pos], before[s][pos])) bad(`${where}: a trade left the ${s} with ${n} at ${pos}`)
  }
}
// a GM working the phones: a star for three backups, a man traded and bought back, then deal after deal at the
// team's price, each one a little in his favour if he can find it
function workPhones(tag) {
  if (!FR.tradeWindow(F).open) return
  before = counts()
  const others = FR.SHORTS.filter(s => s !== F.team)
  // three backups for a star
  {
    const s = others[Math.floor(H() * others.length)]
    const star = tradeableMen(s).filter(p => p.o >= 86).sort((a, b) => b.o - a.o)[0]
    const L = new Set(Object.values(FR.startersOf(F, F.team)).map(p => p.i))
    const backs = star ? tradeableMen(F.team).filter(p => !L.has(p.i) && p.o <= star.o - 10 && p.o <= 79).sort((a, b) => b.o - a.o).slice(0, 3) : []
    if (star && backs.length === 3) {
      const r = FR.proposeTrade(F, s, { pl: backs.map(p => p.i), pk: [] }, { pl: [star.i], pk: [] })
      tally.backups++
      if (r.ok) bad(`${tag}: ${s} gave ${nameOf(star)} for three backups ${backs.map(nameOf).join(', ')}`)
    }
  }
  // repeated small overpays: the bot asks for each team's best man it can find for a pick or two, takes any yes,
  // and takes a counter only when the gauge still leans its way
  for (let k = 0; k < 6; k++) {
    const s = others[Math.floor(H() * others.length)]
    const theirs = tradeableMen(s).filter(p => p.o >= 78 && p.p !== 'k').sort(() => H() - 0.5)[0]
    if (!theirs) continue
    const myPicks = FR.picksBy(F)[F.team].map(k2 => [k2, FR.pickWorth(F, k2)]).sort((a, b) => a[1] - b[1])
    const want = FR.valueOf(F, theirs) * (0.75 + H() * 0.2)
    const pk = myPicks.find(x => x[1] >= want)?.[0] ?? myPicks[myPicks.length - 1]?.[0]
    if (!pk) continue
    const give = { pl: [], pk: [pk] }, get = { pl: [theirs.i], pk: [] }
    const g = gaugeOf(s, give, get)
    const r = FR.proposeTrade(F, s, give, get)
    tally.proposed++
    if (r.ok) { tally.took++; tally.user.push({ s, gain: g.get - g.give, give: g.give, get: g.get, line: r.line }); continue }
    if (r.counter) {
      const gc = gaugeOf(s, r.counter.give, r.counter.get)
      if (gc.get - gc.give > 0) {
        const a = FR.acceptDeal(F, s, r.counter.give, r.counter.get)
        if (a.ok) { tally.took++; tally.user.push({ s, gain: gc.get - gc.give, give: gc.give, get: gc.get, line: a.line, counter: 1 }) }
      }
    }
  }
  // the man traded, then bought back
  {
    const last = (F.trl ?? []).filter(d => d.u && d.ly === FR.capYear(F) && d.ag.length).slice(-1)[0]
    if (last) {
      const s = last.b, p = F.teams[s].r.find(x => last.ag.includes(x.n))
      if (p) {
        const pk = FR.picksBy(F)[F.team].sort((a, b) => FR.pickWorth(F, b) - FR.pickWorth(F, a))[0]
        const r = FR.proposeTrade(F, s, { pl: [], pk: [pk] }, { pl: [p.i], pk: [] })
        tally.back++
        if (r.ok || (r.counter && FR.acceptDeal(F, s, r.counter.give, r.counter.get).ok)) bad(`${tag}: bought ${p.n} back from the ${s}`)
      }
    }
  }
  // the oracle: the GM who knows each team's book, selling his veterans for the most picks a team will give, taking
  // only what the gauge says he wins
  for (let k = 0; k < 3; k++) {
    const s = others[Math.floor(H() * others.length)]
    const L = new Set(Object.values(FR.startersOf(F, F.team)).map(p => p.i))
    const vets = tradeableMen(F.team).filter(p => p.o >= 78 && p.p !== 'k').sort(() => H() - 0.5).slice(0, 3)
    const pk = FR.picksBy(F)[s].sort((a, b) => FR.pickWorth(F, b) - FR.pickWorth(F, a)).slice(0, 9)
    let best = null
    for (const p of vets) {
      const combos = [...pk.map(x => [x]), ...pk.flatMap((x, i) => pk.slice(i + 1).map(y => [x, y]))]
      for (const c of combos) {
        const give = { pl: [p.i], pk: [] }, get = { pl: [], pk: c }
        if (!FR.checkTrade(F, s, give, get).ok || !FR.decide(F, s, give, get).ok) continue
        const g = gaugeOf(s, give, get)
        if (g.get - g.give > (best?.gain ?? 0)) best = { give, get, gain: g.get - g.give, g }
      }
    }
    void L
    if (best) { const a = FR.acceptDeal(F, s, best.give, best.get); if (a.ok) { tally.oracle.push(best.gain); tally.user.push({ s, gain: best.gain, give: best.g.give, get: best.g.get, line: a.line, oracle: 1 }) } }
  }
  // the league's calls: take about half
  const seenO = new Set()
  for (let o = FR.tradeOffers(F).find(x => !seenO.has(x.id)); o; o = FR.tradeOffers(F).find(x => !seenO.has(x.id))) {
    seenO.add(o.id)
    tally.offers++
    const g = gaugeOf(o.s, o.give, o.get)
    console.log(`   offer [${tag}] ${o.k} from the ${o.s}: ${FR.tradeLine(F, F.team, o.s, o.give.pl.map(id => F.teams[F.team].r.find(p => p.i === id)), o.give.pk, o.get.pl.map(id => F.teams[o.s].r.find(p => p.i === id)), o.get.pk)} · value ${v0(g.give)} / ${v0(g.get)}`)
    if (g.get < g.give * 0.75 || g.give < g.get * 0.6) bad(`${tag}: an offer from the ${o.s} that isn't close: gives ${v0(g.get)} for ${v0(g.give)}`)
    if (H() < 0.5) { const r = FR.answerOffer(F, o.id, true); if (r.ok) { tally.offersTaken++; tally.user.push({ s: o.s, gain: g.get - g.give, give: g.give, get: g.get, line: r.line, offer: 1 }) } }
    else FR.answerOffer(F, o.id, false)
  }
  legal(tag)
  for (const s of FR.SHORTS) if (s !== F.team && FR.capRoom(F, s) < -0.05 && !capWas[s]) bad(`${tag}: ${s} over the cap after trades: ${FR.capRoom(F, s)}`)
}
const capWas = {}
const noteCap = () => { for (const s of FR.SHORTS) capWas[s] = FR.capRoom(F, s) < -0.05 }

// every trade the league made, read off the log: none lopsided
function audit() {
  for (const d of F.trl ?? []) {
    if (d.seen) continue
    d.seen = 1
    fresh.push(d)
    const [a, b] = d.gv ?? [0, 0]
    if (!d.u) tally.aiai.push(d)
    // (the player's team may overpay; a league team never gives far more than it gets)
    const lo = d.u ? (d.a === F.team ? a : b) : Math.min(a, b), hi = d.u ? (d.a === F.team ? b : a) : Math.max(a, b)
    if (hi >= 120 && lo < hi * 0.55) { tally.absurd++; bad(`lopsided: ${d.a}<-${d.b} gave ${a} got ${b} (${d.ag.join(', ')} | ${d.bg.join(', ')} | ${d.ak.join(' ')} | ${d.bk.join(' ')})`) }
    // a man the GM just traded for, flipped within six weeks of the same window: never for much more than he cost
    if (d.u) {
      const mine = d.a === F.team, sent = mine ? d.ag : d.bg, got = mine ? d.bg : d.ag, sv = mine ? a : b, gvv = mine ? b : a
      const key = `${d.y}${d.ph}`
      const flips = sent.filter(n => acq[n] && acq[n].key === key && (d.ph !== 'season' || d.wk - acq[n].wk < 6))
      if (flips.length && flips.length === sent.length && !(mine ? d.ak : d.bk).length) {
        const paid = flips.reduce((x, n) => x + acq[n].val, 0)
        if (gvv > paid * 1.2 + 40) bad(`flip: ${flips.join(', ')} bought for ${Math.round(paid)}, sold for ${gvv}`)
      }
      for (const n of got) acq[n] = { key, wk: d.wk, val: sv / Math.max(1, got.length) }
    }
  }
}

const acq = {}
const perSeason = []
let fresh = []
for (let y = 0; y < N; y++) {
  const t0 = performance.now()
  fresh = []
  while (F.phase === 'season') {
    noteCap()
    workPhones(`${F.year} wk ${F.wk + 1}`)
    FR.playWeek(F, { moments: false })
    if (F.ev) F.ev = null
    audit()
  }
  FR.intoPlayoffs(F)
  if (FR.tradeWindow(F).open) bad('the window is open in the playoffs')
  FR.simPlayoffs(F)
  FR.closeSeason(F); FR.closeCarousel(F)
  if (FR.tradeWindow(F).open) bad('the window is open at the awards')
  FR.ageLeague(F); FR.openResign(F)
  for (const id of [...F.rs]) { const p = mine().find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? (p.o >= 80 ? 'option' : 'decline') : p.b != null || p.o >= 76) }
  noteCap(); workPhones(`${F.year} re-sign`); audit()
  FR.openFA(F)
  while (F.fad) { const p = FR.faBoard(F, 8).find(x => FR.canSign(F, x.$) && x.o >= 78); if (p) FR.placeBid(F, p.i, p.$); FR.nextFADay(F) }
  FR.openDraft(F)
  noteCap(); workPhones(`${F.year} draft`); audit()
  // every pick traded for this draft is in its order: 224 slots, every team's count matches the trades
  if (F.dr.own.length !== FR.PICKS_N) bad('draft order length')
  if (Object.keys(F.tpk ?? {}).some(k => FR.parsePick(k).y === F.year + 1)) bad('a traded pick for this draft left out of its order')
  FR.startNight(F)
  if (FR.tradeWindow(F).open) bad('the window is open on draft night')
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft(F)
  if (F.dr.picks.length !== FR.PICKS_N) bad('draft picks')
  noteCap(); workPhones(`${F.year} after the draft`); audit()
  FR.autoCamp(F); FR.newSeason(F)
  audit()
  const made = fresh
  const u = made.filter(d => d.u).length, ai = made.length - u
  perSeason.push({ y: F.year - 1, u, ai })
  console.log(`${F.year - 1}: ${made.length} trades (${u} with the ${team}, ${ai} between league teams) · ${(performance.now() - t0).toFixed(0)} ms`)
  for (const d of made) console.log(`   ${d.u ? '*' : ' '} [${d.ph === 'off' ? 'off' : `wk ${d.wk}`}] ${d.t} · value ${d.gv?.join(' / ')}`)
}

// ── 3. The numbers ───────────────────────────────────────────────────────────
const sum = a => a.reduce((x, y) => x + y, 0)
const ug = tally.user.map(t => t.gain), given = sum(tally.user.map(t => t.give)), got = sum(tally.user.map(t => t.get))
console.log(`\nthe GM's phones: ${tally.proposed} proposals, ${tally.took} taken (counters included), ${tally.offers} offers from the league, ${tally.offersTaken} accepted`)
console.log(`   value sent ${v0(given)}, value back ${v0(got)} (the league's own values): net ${v0(got - given)} over ${tally.user.length} deals, best single ${v0(Math.max(0, ...ug))}`)
console.log(`   the oracle (the most picks a team gives for his veterans, taken only when the gauge says he wins): ${tally.oracle.length} deals, ${v0(sum(tally.oracle))} gained`)
console.log(`   three backups for a star: tried ${tally.backups}, all turned down · bought back: tried ${tally.back}`)
console.log(`league trades a season: ${perSeason.map(x => x.ai).join(', ')} · with the ${team}: ${perSeason.map(x => x.u).join(', ')}`)
if (got - given > Math.max(400, given * 0.12)) bad(`the GM came out ${v0(got - given)} ahead over ${tally.user.length} deals`)
if (sum(perSeason.map(x => x.ai)) < N) bad('fewer than one league trade a season')
if (sum(perSeason.map(x => x.ai)) > N * 9) bad('too many league trades')
// save and load: the trade state rides in the save; an old save without it loads
{
  const s = FR.packFranchise(F), G = FR.depthOnLoad(FR.upgradeSave(FR.unpackFranchise(s)))
  if (JSON.stringify(G.tpk ?? {}) !== JSON.stringify(F.tpk ?? {})) bad('traded picks lost in the save')
  const old = JSON.parse(s); delete old.tpk; delete old.tro; delete old.trl; delete old.trc; delete old.nto
  const O = FR.depthOnLoad(FR.upgradeSave(FR.unpackFranchise(JSON.stringify(old))))
  if (!O || FR.tradeAssets(O, O.team).picks.length !== 14 || !FR.tradeWindow(O).open) bad('a save without trade data')
}
console.log(problems.length ? `\n${problems.length} PROBLEMS` : '\nOK')
process.exit(problems.length ? 1 : 0)
