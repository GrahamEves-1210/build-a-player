// NBA FRANCHISE: free agency (the 2023 CBA's rules, the real market's habits).
//
// THE DAYS (faDay): free agency runs FA_DAYS rounds. On the first, the league's teams re-sign the men they want to
// keep (Bird rights let them go over the cap to do it: a star into the tax and past the aprons) and renounce the rest
// if they need the room; a few of the men want to test the market first. The teams over the tax shed salary to teams
// with room (trades.js salaryDumps). Then every round:
//   1. each team that needs a man makes an offer, with the money it can use: its cap room, else its mid-level
//      (non-taxpayer, taxpayer or room), else the bi-annual, else the minimum. Its front office won't add a man past
//      the line it spends to (contracts.js taxTolerance: a contender into the tax or the apron, a rebuilder never
//      over the cap). The GM's offers (F.fao) are in with the league's, the same way.
//   2. each free agent weighs his offers (offerScore): the money first (a year's salary against his ask, and the years:
//      an older man wants the security), then winning and his role, for some men the market (the big cities), and
//      home. He signs the best one when it reaches what he'll take that day (takeOf); otherwise he waits. His ask comes
//      down each day he's unsigned, and toward what the league can still pay when the room is gone.
//   3. a restricted free agent's offer sheet goes to his old team, which matches (and keeps him at those terms) when
//      he's worth it to them and they'll pay it. A sheet the GM's team signed (p.osh) is answered the next day; a sheet
//      on the GM's own RFA (F.rfq) is his to match or not (matchSheet) before the next day (unanswered: matched when his
//      team can). A matched sheet: no trade for a year (p.osm).
//   An RFA with no offer by the last day re-signs with his team at his price then, or signs his qualifying offer.
// THE GM'S TEAM: F.fao { [manId]: deal } its offers (and offer sheets) standing; F.rfq [{ i, s, d }] the offer sheets
// its own RFAs signed; F.fan { y, d, r: [{ i, n, k, s, d, why }] } what came of its offers in the last round.
// THE REST OF THE SUMMER (cpuOffseason): the rounds left, the sheets answered, the last calls (a star back to his own
// team or to the team with the most to pay him; good players for what the contenders have left), then every league
// team fills its roster to at least 14 standard deals (the minimum, from the pool; core's `make` makes a man when the
// pool runs dry), cuts down to 15, signs two-way men to two or three spots, and extends the young men and veterans it
// wants to keep.
import { coachPull } from './coach'
import { rngOf, clamp, r1 } from '../rng'
import { signText, termsText } from './news'
import { capOf, minOf, maxOf, twoWayOf, payroll, capYear, standardOf, twoWaysOf, holdOf, excOf, hardCapOf, floorOf } from './cap'
import {
  marketValue, worthOf, rankOf, termOf, canSign, signMan, rightsOf, resignOffer, renounce, situationOf,
  taxTolerance, lineOf, teamStrength, BIG_MARKET, mleFor, excFor, cutMan, cutCost, extensionAsk, extendMan,
  ROSTER_MAX, ROSTER_MIN, TWO_WAY_MAX, raiseMax, schedOf, legalRoster, outsideBest, sheetOf, superMaxOk,
} from './contracts'
import { salaryDumps, summerTrades } from './trades'

export const FA_DAYS = 6
// his ask comes down each day he goes unsigned (the market drying up), and toward what the league can still pay
const DECAY = [1, 0.95, 0.9, 0.84, 0.77, 0.7]
// what he'll take each day: the share of his ask an offer has to reach, its money with the rest of what he wants
// (a winner, a role, the lights, home) in it. The last day a role player takes what's there; a good player still
// wants a fair part of his price.
const TAKE = [0.98, 0.96, 0.94, 0.92, 0.88, 0.78]
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const shortsOf = F => Object.keys(F.teams ?? {})
const money = v => `$${r1(v)}M`
const fullName = s => s
// a star (by where he ranks or his rating), a good player, the rest
const tierOf = (F, p) => (rankOf(F, p) <= 60 || (p.o ?? 0) >= 85 ? 2 : rankOf(F, p) <= 150 ? 1 : 0)

// ── What a free agent wants ──────────────────────────────────────────────────
// his ask: his market (held to what the league can pay this summer, his own team aside), tilted by how he reads it,
// set the first day; each day after it comes down (DECAY), and when no other team has the money for it anymore, down
// toward what they do have (a star never under 60% of where it started: his own team can still pay it, or he takes a
// season and tries again; a good player a third). p.ask = { yr, b: the first day's, $: today's, y, d }
// the market's day an ask is for: the round being played, else the next one to be (the screen between rounds shows
// the ask the next round weighs offers against; before the first round day 1, once the days are done the last)
let playing = 0
export const marketDay = F => playing || clamp(1, FA_DAYS, faDayOf(F) + 1)
export function askFor(F, p) {
  const year = capYear(F)
  const day = marketDay(F)
  const mn = minOf(p.ys ?? 0, year)
  if (!p.ask || p.ask.yr !== year || p.ask.b == null) {
    const R = rngOf(`${F.seed}-${year}-fa-${p.i}`)
    const mv = Math.min(marketValue(F, p, year), Math.max(outsideBest(F, p), mn))
    const $ = r1(clamp(mn, maxOf(p.ys ?? 0, year), mv * (1 + R.n() * 0.05)))
    p.ask = { yr: year, b: $, $, y: termOf(F, p), d: 0 }
  }
  if (p.ask.d !== day) {
    const t = p.ask.b * DECAY[day - 1]
    const hold = [0, 0.35, 0.6][tierOf(F, p)]
    const $ = r1(Math.max(mn, Math.min(t, Math.max(outsideBest(F, p) * 1.05, p.ask.b * hold))))
    p.ask = { ...p.ask, $, d: day }
  }
  return p.ask
}
export function wantsOf(p) {
  const h = hash(`want-${p.i}-${p.n}`)
  const old = (p.ag ?? 27) >= 30
  return {
    win: (old ? 0.08 : 0.03) + (h % 7) * 0.012,          // a ring
    role: ((h >> 3) % 6) * 0.012 + ((p.ag ?? 27) <= 25 ? 0.03 : 0),  // minutes and shots
    mkt: (h >> 6) % 4 === 0 ? 0.06 : 0,                  // the lights (one in four)
    home: ((h >> 9) % 5) * 0.01 + 0.02,                  // loyalty to his team
  }
}
// what an offer is worth to him, as a share of his ask (1 = exactly what he asked, with nothing else in it)
export function offerScore(F, p, s, d, ctx = null) {
  const a = askFor(F, p), W = wantsOf(p)
  const sc = d.sc ?? schedOf(d)
  // (the years: an older man counts the security, a young one less; a year short of what he wants costs)
  const yrs = sc.length
  const sec = (p.ag ?? 27) >= 30 ? 0.06 : 0.025
  const yf = 1 + sec * (Math.min(yrs, a.y) - a.y) + 0.01 * Math.max(0, yrs - a.y)
  const strong = ctx?.str?.[s] ?? teamStrength(F, s)
  const mean = ctx?.mean ?? 75
  const win = clamp(-1, 1, (strong - mean) / 6)
  const role = roleOn(F, s, p)
  const mkt = BIG_MARKET.has(s) ? 1 : 0
  const home = p.fr === s ? 1 : 0
  const extra = 1 + W.win * win + W.role * (role - 0.5) * 2 + W.mkt * mkt + W.home * home + coachPull(F, s)
  return (sc[0] / Math.max(0.1, a.$)) * yf * extra
}
// the share of his ask he'll take today (seeded: some men wait a day longer than others)
export function takeOf(F, p, day = marketDay(F)) {
  const t = tierOf(F, p)
  if (day >= FA_DAYS) return t === 2 ? TAKE[FA_DAYS - 1] : t === 1 ? 0.45 : 0
  const R = rngOf(`${F.seed}-${capYear(F)}-take-${day}-${p.i}`)
  return TAKE[day - 1] * (1 + clamp(-0.04, 0.04, R.n() * 0.025)) + (t === 2 && day <= 3 ? 0.02 : 0)
}
// where he'd play there: 1 a starter, 0.5 rotation, 0 the end of the bench
export function roleOn(F, s, p) {
  const r = F.teams[s].r.filter(x => !x.tw && x.i !== p.i).map(x => x.o ?? 60).sort((a, b) => b - a)
  const ahead = r.filter(o => o > (p.o ?? 60)).length
  return ahead < 5 ? 1 : ahead < 9 ? 0.5 : 0
}

// ── What a team will do ──────────────────────────────────────────────────────
// is he one of the men a front office pays to keep: a star on the league's ladder, or one of its two best
export function keeperOf(F, s, p) {
  const rk = rankOf(F, p)
  if (rk <= 45) return true
  const better = F.teams[s].r.filter(x => !x.tw && x.i !== p.i && (x.o ?? 0) > (p.o ?? 0)).length
  return rk <= 90 && better < 2
}
// the payroll a team will go to to keep its own man ($M): one of the league's best in his prime, whatever it takes
// (no front office lets a top-25 player walk over the tax: it re-signs him and trades someone else); a star it keeps
// by where the team is (a contender just past the second apron, a big market's team in the mix to the first apron, the
// rest of the mix and the rebuilders to the tax line); anyone else to its line (top three on the team: the line for
// keeping; the rest the line for adding)
const STAR_LINE = { win: 'a2+', mid: 'tax', reb: 'tax' }
export function keepLine(F, s, p, year = capYear(F)) {
  const rk = rankOf(F, p)
  if (rk <= 25 && (p.ag ?? 27) <= 31) return Infinity
  const tol = taxTolerance(F, s)
  const sit = situationOf(F, s)
  if (rk <= 45) return Math.max(lineOf(sit === 'mid' && BIG_MARKET.has(s) ? 'a1' : STAR_LINE[sit], year), lineOf(tol.keep, year))
  const top3 = F.teams[s].r.filter(x => !x.tw && x.i !== p.i && (x.o ?? 0) > (p.o ?? 0)).length < 3
  return lineOf(top3 ? tol.keep : tol.add, year)
}
// does he want to test the market rather than re-sign (seeded, from his id and the summer): most stars stay; a
// veteran on a rebuilding team wants a winner, now and then a man just wants a new start
export function wantsOut(F, s, p) {
  const sit = situationOf(F, s)
  const ag = p.ag ?? 27
  const W = wantsOf(p)
  let ch = 0.07 + (sit === 'reb' && ag >= 27 ? 0.18 : 0) + (sit === 'mid' && ag >= 30 ? 0.05 : 0) - W.home * 2
  const R = rngOf(`${F.seed}-${capYear(F)}-out-${p.i}`)
  return R.u() < clamp(0.03, 0.5, ch)
}
// would team s keep its own free agent (re-sign him with his rights): he plays for it, he's worth what he asks, and
// it will pay it under the line it keeps its own men to (a star: into the tax and past the aprons, as the real league's
// contenders do)
export function keepsOwn(F, s, p) {
  const ask = resignOffer(F, p)
  if (!ask) return null
  const year = capYear(F)
  const sit = situationOf(F, s)
  const w = worthOf(F, p, year)
  const role = roleOn(F, s, p)
  const mn = minOf(p.ys ?? 0, year)
  const star = keeperOf(F, s, p)
  if (role === 0 && ask.$ > mn * 1.5) return null
  if (sit === 'reb' && (p.ag ?? 27) >= 30 && !(star && (p.ag ?? 27) <= 32) && ask.$ > mn * 2) return null
  if (w < ask.$ * (star ? 0.75 : role === 1 ? 0.85 : 1)) return null
  // (the front office's sums leave out the cap holds of its other free agents: holds aren't salary, and the men it
  // won't bring back come off when it renounces them)
  const spend = payroll(F, s, year, { holds: false }) + ask.$
  if (spend > keepLine(F, s, p, year) && ask.$ > mn + 0.05) return null
  if (payroll(F, s, year) - holdOf(p, year) + ask.$ + reserveOf(F, s, 1) > hardCapOf(F, s, year) + 0.01) return null
  return ask
}
// the best deal team s would offer free agent p now (or null): his ask, inside what it can use and will spend
function bidFor(F, s, p, day, ctx) {
  const year = capYear(F)
  const a = askFor(F, p)
  const sit = ctx.sit[s]
  const role = roleOn(F, s, p)
  const st = standardOf(F.teams[s]).length
  const ag = p.ag ?? 27
  // (it needs him: he'd play for it, or it needs bodies; a rebuilder wants young men, a contender men who help now; a
  // rebuilder with room left late in the summer takes a veteran on a short deal, to play him or trade him)
  if (role === 0 && st >= 13) return null
  const short = sit === 'reb' && ag >= 30 && a.$ > minOf(p.ys ?? 0, year) * 1.6
  if (short && (day < 3 || capOf(year) - payroll(F, s, year) < a.$ * 0.6)) return null
  const w = worthOf(F, p, year) * (sit === 'win' && role > 0 && ag >= 26 ? 1.1 : sit === 'reb' && ag <= 25 ? 1.1 : 1)
  const tol = taxTolerance(F, s)
  const own = rightsOf(p, s)
  const yrs = Math.min(a.y, short ? 2 : own === 'bird' ? 5 : 4)
  const base = Math.min(a.$, w * 1.05)
  const mn = minOf(p.ys ?? 0, year)
  const under = payroll(F, s, year) < floorOf(year)
  // (the least it offers: most of his ask in the first days; on the last, whatever it has)
  const lo = day >= FA_DAYS ? 0 : 0.75
  const tries = [base, a.$ * 0.9, ...(under ? [Math.min(a.$ * 1.25, w * 1.6, capOf(year) - payroll(F, s, year))] : [])]
  // (its channels: what's left under the cap, its mid-level, the bi-annual, the minimum)
  const pay = payroll(F, s, year) - (own ? holdOf(p, year) : 0)
  const room = capOf(year) - pay
  if (room > mn) tries.push(Math.min(room, base))
  const m = mleFor(F, s, year)
  if (m) tries.push(Math.min(m.$, base))
  const e = excFor(F, s, year)
  if (e.bae > 0.05) tries.push(Math.min(e.bae, base))
  tries.push(mn)
  const seen = new Set()
  for (const v of tries.map(r1).sort((x, y) => y - x)) {
    if (v < mn || seen.has(v) || v < a.$ * lo - 0.01) continue
    seen.add(v)
    // (a team under the salary floor overpays on a short deal rather than hand the shortfall back at season's end)
    // (and a team with real room pays up for the men it can get: the summer's room goes to someone)
    if (v > w * (under ? 1.6 : room >= 15 ? 1.3 : 1.1) && v > mn + 0.05) continue
    for (const y of [yrs, Math.min(yrs, 3), Math.min(yrs, 2), 1]) {
      const d = { $: v, y, r: v > mn + 0.05 ? raiseMax(own) * (v >= 15 ? 1 : 0.6) : 0 }
      const c = canSign(F, s, p, d)
      if (!c.ok) continue
      // (the line its front office spends to; a minimum deal always fits; a hard-capped team keeps room to fill out)
      const after = payroll(F, s, year) - (own ? holdOf(p, year) : 0) + v
      const line = own ? keepLine(F, s, p, year) : lineOf(tol.add, year)
      if (c.via !== 'min' && payroll(F, s, year, { holds: false }) + v > line) continue
      if (after + reserveOf(F, s, 1) > hardCapOf(F, s, year) + 0.01) continue
      return { ...d, via: c.via }
    }
  }
  return null
}

// ── The first day: rights, holds and dumps ───────────────────────────────────
function openMarket(F) {
  const news = []
  const year = capYear(F)
  for (const p of F.fa ?? []) askFor(F, p)
  // the league's teams keep their own (the GM's team does that on its screen): most of the men they want re-sign; a
  // few want to see what's out there first (their team can still bring them back with his rights, in the rounds)
  for (const s of shortsOf(F)) {
    if (s === F.team) continue
    for (const p of (F.fa ?? []).filter(x => x.fr === s && !x.rn && x.hy === year).sort((a, b) => rankOf(F, a) - rankOf(F, b))) {
      // (an RFA is kept with his qualifying offer out and the market sets his price, unless he's one of the good ones
      // his team signs before anyone else can)
      // (and not while the GM's offer sheet is in: it goes first)
      if (p.rfa && (rankOf(F, p) > 150 || F.fao?.[p.i])) continue
      if (wantsOut(F, s, p)) continue
      const ask = keepsOwn(F, s, p)
      if (ask && signMan(F, s, p, ask).ok && (p.o ?? 0) >= 78) news.push({ k: 'sign', tag: 'RE-SIGNED', s, text: signText('re-signs with', p, s) })
    }
    // the rest: renounced when the team wants its room, held (Bird rights for later) when it's over the cap anyway (a
    // star it would bring back stays held)
    const pay = payroll(F, s, year, { holds: false })
    if (pay < capOf(year) - 5) for (const p of (F.fa ?? []).filter(x => x.fr === s && !x.rn && x.hy === year && !x.rfa && !keeperOf(F, s, x))) renounce(F, s, p.i)
  }
  news.push(...salaryDumps(F))
  return news
}
const sumOf = p => r1([p.$ ?? 0, ...(p.sc ?? [])].slice(0, p.y ?? 0).reduce((a, v) => a + v, 0))
const dealSum = d => r1((d.sc ?? schedOf(d)).reduce((a, v) => a + v, 0))
const yrsText = y => (y === 1 ? 'one-year' : `${y}-year`)

// ── A round ──────────────────────────────────────────────────────────────────
// faDay(F, day): free agency through that day (core counts its days 1, 2, 3...: each call plays the rounds up to it,
// one a call). Returns the wire's items.
// (the day free agency is on: F.fad, for the league year F.fay; a new summer starts at 0)
export const faDayOf = F => (F.fay === capYear(F) ? F.fad ?? 0 : 0)
export function faDay(F, day = faDayOf(F) + 1) {
  const news = []
  const to = Math.min(FA_DAYS, Math.max(faDayOf(F) + 1, day | 0))
  while (faDayOf(F) < to) {
    const d = faDayOf(F) + 1
    F.fad = d
    F.fay = capYear(F)
    playing = d
    try {
      if (d === 1) news.push(...openMarket(F))
      news.push(...faRound(F, d))
    } finally { playing = 0 }
  }
  return news
}
// what a free agent asks on the open market today: { $, y }
export const askOf = (F, p) => { const a = askFor(F, p); return { $: a.$, y: a.y, r: a.$ >= 15 ? 0.05 : 0 } }
// the offer sheets from the round before, answered: the GM's RFAs' sheets he didn't answer (matched when his team
// can, on the wire), and the sheets the GM's team signed other teams' RFAs to (their teams match or let them go)
function settleSheets(F, news) {
  const year = capYear(F)
  for (const q of [...(F.rfq ?? [])]) {
    const p = (F.fa ?? []).find(x => x.i === q.i)
    const can = p && canSign(F, F.team, p, { ...q.d, sheet: 1 }).ok
    const r = matchSheet(F, F.team, q.i, !!can)
    for (const x of r.news ?? []) news.push({ ...x, text: `${x.text} (the deadline to match passed with no answer)` })
    if (p) gmLog(F, { i: p.i, n: p.n, k: r.matched ? 'matched' : 'lost', s: r.matched ? F.team : q.s, d: q.d, mine: 1 })
  }
  F.rfq = []
  for (const p of (F.fa ?? []).filter(x => x.osh)) {
    const { d } = p.osh, was = p.fr
    delete p.osh
    const md = { $: d.$, y: d.y, r: Math.min(d.r ?? 0, raiseMax(rightsOf(p, was))), sheet: 1 }
    if (was && aiMatches(F, was, p, d) && signMan(F, was, p, md).ok) {
      p.osm = { s: F.team, y: year }
      news.push({ k: 'sign', tag: 'MATCHED', s: was, text: matchedText(was, F.team, p) })
      gmLog(F, { i: p.i, n: p.n, k: 'matched', s: was, d })
      continue
    }
    // (not matched: the sheet binds; he's the GM's)
    const g = { ...d, sheet: 1 }
    const r = signMan(F, F.team, p, g)
    if (!r.ok) signMan(F, F.team, p, { ...g, via: 'room' }, { check: false })
    news.push({ k: 'sign', tag: 'OFFER SHEET', s: F.team, text: unmatchedText(was, F.team, p) })
    gmLog(F, { i: p.i, n: p.n, k: 'signed', s: F.team, d })
  }
}
// the GM's offers: what came of them in the last round (F.fan = { y, d: the day, r: [{ i, n, k: 'signed' | 'lost' |
// 'waiting' | 'sheet' | 'matched' | 'void', s, d, why? }] })
function gmLog(F, x) {
  const y = capYear(F), d = faDayOf(F)
  if (!F.fan || F.fan.y !== y || F.fan.d !== d) F.fan = { y, d, r: [] }
  F.fan.r = [...F.fan.r.filter(o => o.i !== x.i), x]
}
function faRound(F, day) {
  const news = []
  const year = capYear(F)
  const R = rngOf(`${F.seed}-${year}-faday-${day}`)
  const S = shortsOf(F)
  const str = Object.fromEntries(S.map(s => [s, teamStrength(F, s)]))
  const ctx = { str, mean: S.reduce((a, s) => a + str[s], 0) / S.length, sit: Object.fromEntries(S.map(s => [s, situationOf(F, s)])) }
  settleSheets(F, news)
  // (a man with an offer sheet out isn't on the market)
  const pool = () => (F.fa ?? []).filter(p => !sheetOf(F, p))
  // the offers: the GM's first (his team's offers stand until he pulls them or the man signs), then the league's, the
  // best men first, each team a few a day
  const offers = {}
  const add = (i, o) => { (offers[i] ??= []).push(o) }
  const mine = new Set()
  for (const [id, d] of Object.entries(F.fao ?? {})) {
    const p = (F.fa ?? []).find(x => x.i === +id)
    if (!p) continue
    const c = canSign(F, F.team, p, d)
    if (c.ok) { add(p.i, { s: F.team, d: { ...d, via: c.via } }); mine.add(p.i) }
    else { gmLog(F, { i: p.i, n: p.n, k: 'void', s: F.team, d, why: c.why }); delete F.fao[id] }
  }
  const men = [...pool()].sort((a, b) => rankOf(F, a) - rankOf(F, b))
  const busy = Object.fromEntries(S.map(s => [s, 0]))
  const spent = Object.fromEntries(S.map(s => [s, 0]))
  for (const p of men) {
    // (an old man at the end of the line waits for the summer's last calls; a good one is wanted like anyone)
    if ((p.ag ?? 27) >= 38 && day < FA_DAYS && rankOf(F, p) > 150) continue
    // (a filler (core's camp body, p.fl) isn't bid on: he signs for the minimum at camp, if anyone needs him)
    if (p.fl) continue
    for (const s of R.shuffle(S)) {
      if (s === F.team || busy[s] >= 3) continue
      // (what it's already offered this round counts against its room)
      if (spent[s] > 0 && payroll(F, s, year) + spent[s] > capOf(year) && busy[s] >= 1 && (p.o ?? 0) < 75) continue
      const st = standardOf(F.teams[s]).length + busy[s]
      if (st >= ROSTER_MAX + (F.phase === 'off' && (p.o ?? 0) >= 78 ? 3 : 0)) continue
      const b = bidFor(F, s, p, day, ctx)
      if (!b) continue
      add(p.i, { s, d: b })
      busy[s]++
      spent[s] += b.$
    }
  }
  // the men decide (the best first, so a team's room goes to the first man who takes it): the best offer, when it
  // reaches what he'll take today; otherwise he waits for a better one
  for (const p of men) {
    const list = (offers[p.i] ?? []).map(o => ({ ...o, u: offerScore(F, p, o.s, o.d, ctx) })).sort((a, b) => b.u - a.u)
    const take = takeOf(F, p, day)
    let signed = null
    for (const o of list) {
      if (o.u < take - 1e-9) break
      // (still legal now that others have signed)
      const c = canSign(F, o.s, p, o.d)
      if (!c.ok) continue
      if (p.rfa && p.fr && p.fr !== o.s && !p.rn) {
        // an offer sheet: his old team matches or lets him go
        const sheet = `${p.n} signs an offer sheet with the ${o.s}: ${termsText(o.d.y, dealSum(o.d))}; the ${p.fr} have a day to match`
        if (p.fr === F.team) { (F.rfq ??= []).push({ i: p.i, s: o.s, d: o.d }); signed = o.s; news.push({ k: 'sheet', tag: 'OFFER SHEET', s: o.s, text: sheet }); break }
        if (o.s === F.team) {
          // (the GM's sheet: his old team answers on the next day)
          p.osh = { s: F.team, d: { $: o.d.$, y: o.d.y, r: o.d.r ?? 0 } }
          delete F.fao?.[p.i]
          signed = o.s
          news.push({ k: 'sheet', tag: 'OFFER SHEET', s: F.team, text: sheet })
          gmLog(F, { i: p.i, n: p.n, k: 'sheet', s: p.fr, d: o.d })
          break
        }
        if (aiMatches(F, p.fr, p, o.d)) {
          const was = p.fr
          if (signMan(F, was, p, { $: o.d.$, y: o.d.y, r: Math.min(o.d.r ?? 0, raiseMax(rightsOf(p, was))), sheet: 1 }).ok) {
            p.osm = { s: o.s, y: year }
            news.push({ k: 'sign', tag: 'MATCHED', s: was, text: matchedText(was, o.s, p) })
            signed = was
            break
          }
        }
      }
      const r = signMan(F, o.s, p, o.d)
      if (!r.ok) continue
      if (o.s === F.team) { delete F.fao?.[p.i]; gmLog(F, { i: p.i, n: p.n, k: 'signed', s: F.team, d: o.d }) }
      // (his own team bringing him back re-signs him; a deal on the mid-level says so, the way the reporters do)
      const back = o.d.via === 'bird' || o.d.via === 'ebird' || o.d.via === 'nbird'
      if ((p.o ?? 0) >= 76 || sumOf(p) >= 30 || o.s === F.team) news.push({ k: 'sign', tag: back ? 'RE-SIGNED' : 'FREE AGENCY', s: o.s, text: signText(back ? 're-signs with' : 'signs with', p, o.s, { note: o.d.via === 'mle' || o.d.via === 'tmle' || o.d.via === 'rmle' ? ' (mid-level exception)' : '' }) })
      signed = o.s
      break
    }
    // the GM's offer, not taken: he went elsewhere, or he's waiting for more
    if (mine.has(p.i) && signed !== F.team && !p.osh) {
      if (signed) { gmLog(F, { i: p.i, n: p.n, k: 'lost', s: signed, d: F.fao?.[p.i] ?? null }); delete F.fao?.[p.i] }
      else gmLog(F, { i: p.i, n: p.n, k: 'waiting', s: F.team, d: F.fao?.[p.i], why: `He's waiting for a better offer: he asks ${money(askFor(F, p).$)} a year` })
    }
    // the last day: an unsigned RFA re-signs with his team if it wants him at his price now, else takes his
    // qualifying offer (one season, unrestricted after)
    if (!signed && day >= FA_DAYS && p.rfa && p.qo && p.fr && !p.rn) {
      const was = p.fr
      const keep = was !== F.team && keepsOwn(F, was, p)
      if (keep && signMan(F, was, p, keep).ok) { if ((p.o ?? 0) >= 76) news.push({ k: 'sign', tag: 'RE-SIGNED', s: was, text: signText('re-signs with', p, was) }) }
      // (a two-way man's qualifying offer is a two-way deal: he's back on one, restricted again next summer)
      else if (p.qtw) { if (signMan(F, was, p, { $: twoWayOf(year), y: 1, r: 0, tw: 1, sheet: 1 }).ok && (p.o ?? 0) >= 70) news.push({ k: 'sign', tag: 'QUALIFYING OFFER', s: was, text: `${p.n} signs his qualifying offer with the ${was}: 1 year, two-way contract` }) }
      else if (signMan(F, was, p, { $: p.qo, y: 1, r: 0, sheet: 1 }).ok) { delete p.rfa; news.push({ k: 'sign', tag: 'QUALIFYING OFFER', s: was, text: `${p.n} signs his qualifying offer with the ${was}: ${termsText(1, p.qo)}; he can be an unrestricted free agent next summer` }) }
    }
  }
  return news
}
// an AI team matching an offer sheet: he's worth it, and it'll pay it under the line it keeps its own men to (a star
// it keeps past the aprons)
function aiMatches(F, s, p, d) {
  const year = capYear(F)
  const w = worthOf(F, p, year)
  const after = payroll(F, s, year) - holdOf(p, year) + d.$
  const spend = payroll(F, s, year, { holds: false }) + d.$
  const young = (p.ag ?? 27) <= 25
  const star = keeperOf(F, s, p)
  return w >= d.$ * (star ? 0.75 : young ? 0.85 : 0.95) && spend <= Math.max(keepLine(F, s, p, year), lineOf(taxTolerance(F, s).keep, year)) && after + reserveOf(F, s, 1) <= hardCapOf(F, s, year) && canSign(F, s, p, { $: d.$, y: d.y, r: Math.min(d.r ?? 0, raiseMax(rightsOf(p, s))), sheet: 1 }).ok
}
// what a team keeps clear for the minimum deals it still needs to reach 14 (a hard-capped team can't go past its line
// to fill its roster)
export function reserveOf(F, s, adding = 0) {
  // (the league's teams to 15: core's camp fills them there)
  const need = Math.max(0, (s === F.team ? 14 : 15) - standardOf(F.teams[s]).length - adding)
  return need * minOf(5, capYear(F))   // (a camp body: a veteran's minimum, to be safe)
}

// ── The GM's moves ───────────────────────────────────────────────────────────
// an offer (an offer sheet to another team's RFA) for the next round: it stands until he pulls it or the man
// decides; the men weigh it with the league's offers (offerScore). { ok, why, via }
export function placeOffer(F, id, d) {
  const p = (F.fa ?? []).find(x => x.i === id)
  if (!p) return { ok: false, why: 'He has signed elsewhere' }
  const deal = { $: r1(d.$), y: d.y, r: d.r ?? (d.$ >= 15 ? 0.05 : 0) }
  const c = canSign(F, F.team, p, deal)
  if (!c.ok) return c
  F.fao = { ...(F.fao ?? {}), [id]: deal }
  return { ok: true, pending: true, via: c.via, sheet: !!(p.rfa && p.fr && p.fr !== F.team && !p.rn) }
}
export const offerSheet = (F, man, d) => placeOffer(F, man.i ?? man, d)
export function pullOffer(F, id) { if (F.fao?.[id]) { const n = { ...F.fao }; delete n[id]; F.fao = n } }
// how an offer reads to him before he decides: { u (its worth to him as a share of his ask), take (what he'll take
// today), chance: 'likely' | 'close' | 'unlikely', ask } (the league's offers aren't known to the GM: a likely offer
// can still lose to a better one)
export function offerLook(F, id, d) {
  const p = (F.fa ?? []).find(x => x.i === id)
  if (!p) return null
  const day = marketDay(F)
  const u = offerScore(F, p, F.team, d)
  const take = takeOf(F, p, day)
  return { u: r1(u * 100) / 100, take: r1(take * 100) / 100, chance: u >= take + 0.06 ? 'likely' : u >= take - 0.04 ? 'close' : 'unlikely', ask: askOf(F, p) }
}
// the most the GM's team can offer him now ($ a season, the first), and the years: { $, y, via } (null: nothing but the
// minimum fits, or not even that)
export function offerRoom(F, id) {
  const p = (F.fa ?? []).find(x => x.i === id)
  if (!p) return null
  const year = capYear(F)
  const own = rightsOf(p, F.team)
  const y = own === 'bird' ? 5 : 4
  const mx = maxOf(p.ys ?? 0, year, { superMax: own === 'bird' && superMaxOk(F, p, F.team), last: own ? p.$l ?? 0 : 0 })
  const mn = minOf(p.ys ?? 0, year)
  let lo = mn, hi = mx
  if (!canSign(F, F.team, p, { $: mn, y: 1, r: 0 }).ok) return null
  if (canSign(F, F.team, p, { $: mx, y: 1, r: 0 }).ok) return { $: mx, y, max: true }
  for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (canSign(F, F.team, p, { $: m, y: 1, r: 0 }).ok) lo = m; else hi = m }
  // (the exceptions run fewer years than room or rights)
  const v = r1(Math.floor(lo * 10) / 10)
  const ys = [y, 4, 3, 2, 1].find(n => canSign(F, F.team, p, { $: v, y: n, r: 0 }).ok) ?? 1
  return { $: v, y: ys, via: canSign(F, F.team, p, { $: v, y: 1, r: 0 }).via }
}
// once the market's days are done (or at camp) a free agent answers an offer at once: he signs if it's what he'll take
export function lateOffer(F, id, d) {
  const p = (F.fa ?? []).find(x => x.i === id)
  if (!p) return { ok: false, why: 'He has signed elsewhere' }
  const deal = { $: r1(d.$), y: d.y, r: d.r ?? 0 }
  const c = canSign(F, F.team, p, deal)
  if (!c.ok) return c
  const u = offerScore(F, p, F.team, deal)
  if (u < takeOf(F, p, FA_DAYS) - 1e-9) return { ok: false, why: `He turns it down: he wants ${money(askFor(F, p).$)} a year` }
  return signMan(F, F.team, p, deal)
}
// the GM's team matches (or not) an offer sheet its RFA signed
export function matchSheet(F, short, man, yes) {
  const id = man?.i ?? man
  const q = (F.rfq ?? []).find(x => x.i === id)
  const p = (F.fa ?? []).find(x => x.i === id)
  if (!q || !p) { F.rfq = (F.rfq ?? []).filter(x => x.i !== id); return { ok: false, why: 'No offer sheet' } }
  const year = capYear(F)
  if (yes) {
    const d = { ...q.d, sheet: 1 }
    const c = canSign(F, short, p, d)
    if (!c.ok) return { ok: false, why: c.why }
    F.rfq = F.rfq.filter(x => x.i !== id)
    signMan(F, short, p, d)
    p.osm = { s: q.s, y: year }
    return { ok: true, matched: true, news: [{ k: 'sign', tag: 'MATCHED', s: short, text: matchedText(short, q.s, p) }] }
  }
  // (not matched: he goes to the team that signed him to the sheet)
  F.rfq = F.rfq.filter(x => x.i !== id)
  delete p.rfa
  const r = signMan(F, q.s, p, { ...q.d, sheet: 1 }, { check: false })
  return { ok: r.ok, matched: false, news: [{ k: 'sign', tag: 'FREE AGENCY', s: q.s, text: unmatchedText(short, q.s, p) }] }
}
// an offer sheet matched, or not (p: the man, his deal on him now)
const matchedText = (was, by, p) => `The ${was} match the ${by}' offer sheet for ${p.n}: ${termsText(p.y, sumOf(p))}`
const unmatchedText = (was, by, p) => `${was ? `The ${was} decline` : 'His team declines'} to match; ${p.n} joins the ${by}: ${termsText(p.y, sumOf(p))}`
// the board: the best men still out there
export const faBoard = (F, n = 30) => [...(F.fa ?? [])].sort((a, b) => rankOf(F, a) - rankOf(F, b)).slice(0, n)
export const faDone = F => faDayOf(F) >= FA_DAYS

// ── The rest of the summer for the league's teams ────────────────────────────
// make(F, short, { tw }) -> Man: core's maker of a new man when the pool runs dry (optional)
export function cpuOffseason(F, { make = null } = {}) {
  const news = []
  while (!faDone(F)) news.push(...faDay(F, faDayOf(F) + 1))
  // (the sheets from the last day: answered now)
  settleSheets(F, news)
  news.push(...summerTrades(F, 8))
  const year = capYear(F)
  news.push(...lateSignings(F))
  const R = rngOf(`${F.seed}-${year}-camp`)
  for (const s of shortsOf(F)) {
    if (s === F.team) continue
    const team = F.teams[s]
    // cut down to 15 standard deals: the least useful man whose release costs least
    while (standardOf(team).length > ROSTER_MAX) {
      const low = standardOf(team).filter(p => p.b == null).sort((a, b) => (cutCost(F, a).total - cutCost(F, b).total) * 0.3 + ((a.o ?? 60) - (b.o ?? 60)))[0]
      if (!low) break
      cutMan(F, s, low.i, { stretch: cutCost(F, low).total > 15 })
    }
    // two-ways past three: the least of them released (nothing owed)
    while (twoWaysOf(team).length > TWO_WAY_MAX) { const low = [...twoWaysOf(team)].sort((a, b) => (a.o ?? 0) - (b.o ?? 0))[0]; cutMan(F, s, low.i) }
    // fill to 14 (a few teams carry 15): the best men left, at the minimum (a hard-capped team stops at 14)
    const want = 14 + (hash(`${F.seed}-${s}-${year}`) % 3 === 0 && payroll(F, s, year) + minOf(5, year) * 2 < hardCapOf(F, s, year) ? 1 : 0)
    let guard = 0
    while (standardOf(team).length < want && guard++ < 20) {
      const p = [...(F.fa ?? [])].filter(x => ((x.ag ?? 27) <= 36 || rankOf(F, x) <= 200) && rankOf(F, x) > 60 && (x.o ?? 0) < 85).sort((a, b) => rankOf(F, a) - rankOf(F, b)).find(x => canSign(F, s, x, { $: minOf(x.ys ?? 0, year), y: 1 }).ok)
      if (p) { signMan(F, s, p, { $: minOf(p.ys ?? 0, year), y: 1, r: 0, ng: 1 }); continue }
      if (!make) break
      const m = make(F, s, { tw: false })
      if (!m || !signMan(F, s, m, { $: minOf(m.ys ?? 0, year), y: 1, r: 0, ng: 1 }).ok) break
    }
    // two-ways: two or three young men (a made-up camp body on one season)
    const tw = 2 + (hash(`${F.seed}-${s}-tw-${year}`) % 2)
    guard = 0
    while (twoWaysOf(team).length < tw && guard++ < 6) {
      const p = [...(F.fa ?? [])].filter(x => (x.ys ?? 0) <= 4 && (x.ag ?? 27) <= 26).sort((a, b) => rankOf(F, a) - rankOf(F, b))[0]
      const d = { $: twoWayOf(year), y: 1 + (R.u() < 0.5 ? 1 : 0), r: 0, tw: 1 }
      if (p && canSign(F, s, p, d).ok) { signMan(F, s, p, { ...d, sc: Array(d.y).fill(twoWayOf(year)) }); continue }
      if (!make) break
      const m = make(F, s, { tw: true })
      if (!m) break
      if (!signMan(F, s, m, { $: twoWayOf(year), y: 1, r: 0, tw: 1, sc: [twoWayOf(year)] }).ok) break
    }
    news.push(...cpuExtensions(F, s))
  }
  // (the pool's rights and holds are spent with the summer)
  for (const p of F.fa ?? []) for (const k of ['fr', 'hy', 'rfa', 'qo', 'qot', 'rsl', 'ask', 'dco', 'osh']) delete p[k]
  F.fao = {}
  F.rfq = []
  return news
}
// the summer's last calls: a good player still out there signs with a team he'd play for. A star goes back to his own
// team first when it holds his rights (at what it will pay him now), else to the team with the most to pay him; a good
// player takes what a contender or a team in the mix has left (its mid-level, the bi-annual, else the minimum),
// waiving the last man on its bench to make room if it has to
function lateSignings(F) {
  const news = []
  const year = capYear(F)
  const S = shortsOf(F).filter(s => s !== F.team && situationOf(F, s) !== 'reb')
  const left = [...(F.fa ?? [])].filter(p => rankOf(F, p) <= 300 && !p.fl).sort((a, b) => rankOf(F, a) - rankOf(F, b))
  const used = new Set()
  const chan = s => { const m = mleFor(F, s, year); return Math.max(capOf(year) - payroll(F, s, year), m?.$ ?? 0, minOf(0, year)) }
  for (const p of left) {
    const tier = tierOf(F, p)
    const mn = minOf(p.ys ?? 0, year)
    const ask = askFor(F, p).$
    // (his own team, if it still holds his rights and wants him at his price now)
    const own = p.fr && !p.rn && p.fr !== F.team && rightsOf(p, p.fr) ? p.fr : null
    if (own && tier >= 1) {
      const k = keepsOwn(F, own, p)
      const d = k && { ...k, $: r1(Math.max(mn, Math.min(k.$, Math.max(ask, k.$ * 0.8)))) }
      if (d && signMan(F, own, p, d).ok) { if ((p.o ?? 0) >= 78) news.push({ k: 'sign', tag: 'RE-SIGNED', s: own, text: signText('re-signs with', p, own) }); continue }
    }
    const yrs = tier === 2 ? Math.min(termOf(F, p), (p.ag ?? 27) >= 33 ? 2 : 3) : tier === 1 ? ((p.ag ?? 27) >= 31 ? 1 : 2) : 1
    // (a star who can only get a fraction of his price takes one season and tries the market again next summer)
    const dOf = s => {
      if (tier === 0) return { $: mn, y: 1, r: 0 }
      const $ = r1(Math.max(mn, Math.min(ask, chan(s))))
      return { $, y: tier === 2 && $ < (p.ask?.b ?? ask) * 0.5 ? 1 : yrs, r: 0 }
    }
    const fit = (tier === 2 ? shortsOf(F).filter(s => s !== F.team) : S.filter(s => (tier >= 1 || !used.has(s)) && roleOn(F, s, p) >= 0.5))
      .sort((a, b) => (tier >= 1 ? chan(b) - chan(a) : 0) || teamStrength(F, b) - teamStrength(F, a))
    // (a team with a full roster waives its cheapest end-of-bench man to make room, once the deal is legal)
    const tryAt = (s, d0) => {
      const team = F.teams[s]
      let low = null
      if (standardOf(team).length >= ROSTER_MAX) {
        low = standardOf(team).filter(x => x.b == null && (x.o ?? 0) < (p.o ?? 0) - 4).sort((a, b) => cutCost(F, a).total - cutCost(F, b).total || (a.o ?? 0) - (b.o ?? 0))[0]
        if (!low || cutCost(F, low).total > 3) return null
      }
      // (the years an exception allows, else fewer)
      const d = [d0.y, 2, 1].filter(y => y <= d0.y).map(y => ({ ...d0, y })).find(x => canSign(F, s, p, x).ok)
      if (!d) return null
      if (low) cutMan(F, s, low.i)
      return signMan(F, s, p, d).ok ? d : null
    }
    let got = null
    for (const s of fit) { if (tier >= 1 && chan(s) < mn * 1.5) continue; const d = tryAt(s, dOf(s)); if (d) { got = [s, d]; break } }
    // (no one has the money: a good player takes the minimum with a team he'd play for, the best of them first)
    if (!got && tier >= 1) for (const s of S.filter(s => !used.has(s) && roleOn(F, s, p) >= 0.5).sort((a, b) => teamStrength(F, b) - teamStrength(F, a))) { const d = tryAt(s, { $: mn, y: 1, r: 0 }); if (d) { got = [s, d]; break } }
    if (!got) continue
    const [s, d] = got
    used.add(s)
    if ((p.o ?? 0) >= 78) news.push({ k: 'sign', tag: 'FREE AGENCY', s, text: signText('signs with', p, s) })
  }
  return news
}
// a league team extends the men it wants to keep (a rookie-scale man going into his fourth season, a veteran a year
// from free agency), when the price is one it will pay (a star: into the tax and the aprons)
export function cpuExtensions(F, s) {
  const news = []
  const year = capYear(F)
  for (const p of F.teams[s].r) {
    if (p.tw || p.y !== 1) continue
    // (the men a front office locks up early: a rookie-scale man who's become a starter, a veteran who's one of its
    // best: a star into his thirties)
    const rk = rankOf(F, p), ag = p.ag ?? 30
    if (p.rs ? rk > 110 : rk > 70 || (ag >= 31 && rk > 35) || ag >= 35) continue
    const ask = extensionAsk(F, s, p)
    if (!ask) continue
    const w = worthOf(F, { ...p, ag: (p.ag ?? 25) + 1 }, year + 1)
    const role = roleOn(F, s, p)
    if (role < 1 || w < ask.$ * 0.95) continue
    const line = Math.max(keepLine(F, s, p, year + 1), lineOf(taxTolerance(F, s).keep, year + 1))
    if (payroll(F, s, year + 1) + ask.$ > line) continue
    const r = extendMan(F, s, p, ask)
    if (r.ok && (p.o ?? 0) >= 78) news.push({ k: 'ext', tag: 'EXTENSION', s, text: r.text })
  }
  return news
}
// in the season, a league team under 14 signs the best man on the street to a minimum deal (a 10-day's spirit)
export function cpuFill(F, { make = null } = {}) {
  const year = capYear(F)
  for (const s of shortsOf(F)) {
    if (s === F.team) continue
    const team = F.teams[s]
    let guard = 0
    while (standardOf(team).length < ROSTER_MIN && guard++ < 4) {
      const p = [...(F.fa ?? [])].filter(x => rankOf(F, x) > 60 && (x.o ?? 0) < 85).sort((a, b) => rankOf(F, a) - rankOf(F, b)).find(x => canSign(F, s, x, { $: minOf(x.ys ?? 0, year), y: 1 }).ok)
      if (p) { signMan(F, s, p, { $: minOf(p.ys ?? 0, year), y: 1, r: 0, ng: 1 }); continue }
      const m = make?.(F, s, { tw: false })
      if (!m || !signMan(F, s, m, { $: minOf(m.ys ?? 0, year), y: 1, r: 0, ng: 1 }).ok) break
    }
  }
}
