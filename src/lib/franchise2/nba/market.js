// NBA FRANCHISE: free agency (the 2023 CBA's rules, the real market's habits).
//
// THE DAYS (faDay): free agency runs FA_DAYS rounds. On the first, the league's teams re-sign the men they want to
// keep inside the line their ownership spends to (contracts.js spendLines: Bird rights let them go over the cap, but
// the tax is for contenders; a star is kept whatever the line, the room made by moving other salary) and renounce
// the rest if they need the room; a few of the men want to test the market first. The teams past their lines move
// salary (trades.js sellDown). Then every round:
//   1. each team that needs a man makes an offer, with the money it can use: its cap room, else its mid-level
//      (non-taxpayer, taxpayer or room), else the bi-annual, else the minimum, never past the line it adds men to,
//      the money it's holding for a star of its own, or the room a hard cap leaves it to fill out its roster. The
//      GM's offers (F.fao) are in with the league's, the same way.
//   2. each free agent weighs his offers (offerScore): the money first (a year's salary against his ask, and the years:
//      an older man wants the security), then winning and his role, for some men the market (the big cities), and
//      home. He signs the best one when it reaches what he'll take that day (takeOf); otherwise he waits. His ask comes
//      down each day he's unsigned, and toward what the league can still pay when the room is gone.
//   3. a restricted free agent's offer sheet (the league's teams sign few: they tie up room and get matched) goes to
//      his old team, which matches a good young player nearly always. A sheet the GM's team signed (p.osh) is answered
//      the next day; a sheet on the GM's own RFA (F.rfq) is his to match or not (matchSheet) before the next day
//      (unanswered: matched when his team can). A matched sheet: no trade for a year (p.osm).
//   4. from the third day, sign-and-trades between the league's teams (signAndTrades); every day, a team clears the
//      room for a star nobody holds the rights to (clearRoom: its own free agents renounced, contracts moved, one
//      or two waived and stretched if it takes that).
//   An RFA with no offer by the last day settles with his team (rfaDeal), or signs his qualifying offer (the end of
//   the bench, and the few who bet on themselves).
// THE GM'S TEAM: F.fao { [manId]: deal } its offers (and offer sheets) standing; F.rfq [{ i, s, d }] the offer sheets
// its own RFAs signed; F.fan { y, d, r: [{ i, n, k, s, d, why }] } what came of its offers in the last round.
// THE REST OF THE SUMMER (cpuOffseason): the rounds left, the sheets answered, the last calls (the late market: one
// rule for the league's teams and the GM's late offers), then every league team fills its roster to at least 14
// standard deals (the minimum, from the pool; core's `make` makes a man when the pool runs dry), cuts down to 15,
// signs two-way men to two or three spots, extends the young men and veterans it wants to keep, and moves salary if
// it's still past its line.
import { coachPull } from './coach'
import { rngOf, clamp, r1 } from '../rng'
import { signText, termsText } from './news'
import { capOf, minOf, maxOf, twoWayOf, payroll, capPayroll, capYear, standardOf, twoWaysOf, holdOf, excOf, hardCapOf, floorOf, apron1Of, apron2Of, indexed } from './cap'
import {
  marketValue, worthOf, rankOf, termOf, canSign, signMan, rightsOf, resignOffer, renounce, situationOf,
  spendLines, strengthRank, teamStrength, BIG_MARKET, mleFor, excFor, cutMan, cutCost, extensionAsk, extendMan,
  ROSTER_MAX, ROSTER_MIN, TWO_WAY_MAX, OFF_MAX, raiseMax, schedOf, legalRoster, outsideBest, sheetOf, superMaxOk,
} from './contracts'
import { sellDown, shedTo, summerTrades, doTrade, matchLimit, teamSide, whyNot, manValue } from './trades'

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
// the payroll a team will go to to keep its own man ($M). One of the league's dozen best in his prime: whatever it
// takes (no front office lets a franchise player walk over the tax). A star (the top forty): past the second apron
// by a little, for any team: it re-signs him and moves salary elsewhere after (trades.js sellDown); a team
// already so deep that keeping him would leave it far past the second apron can't, and works a sign-and-trade
// instead. Anyone else: the line its ownership spends to (contracts.js spendLines: one of its best five to the line
// for keeping, the rest of the bench to the line for adding). That is where a good-but-not-great player walks: a
// team in the mix doesn't pay the tax to keep its sixth man.
export function keepLine(F, s, p, year = capYear(F)) {
  const rk = rankOf(F, p), ag = p.ag ?? 27
  if (rk <= 12 && ag <= 32) return Infinity
  const L = spendLines(F, s, year)
  if (rk <= 40 && ag <= 32) return Math.max(L.keep, apron2Of(year) + capOf(year) * 0.06)
  const better = F.teams[s].r.filter(x => !x.tw && x.i !== p.i && (x.o ?? 0) > (p.o ?? 0)).length
  return better < 5 ? L.keep : L.add
}
// after a deal starting at `first` (and under the hard cap its exception brings: the first apron for the
// non-taxpayer mid-level, the bi-annual and a sign-and-trade, the second for the taxpayer mid-level), can team s
// still fill out its roster on minimum deals
function fitsHard(F, s, first, via = null, pend = 0) {
  const year = capYear(F)
  const hc = hardCapOf(F, s, year)
  const line = Math.min(hc, via === 'mle' || via === 'bae' || via === 'snt' ? apron1Of(year) : via === 'tmle' ? apron2Of(year) : Infinity)
  // (pend: the money held for its own unsigned stars, counted when this deal would bring a hard cap it doesn't have)
  return payroll(F, s, year) + first + reserveOf(F, s, 1) + (line < hc ? pend : 0) <= line + 0.01
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
export const keepsOwn = (F, s, p) => { const k = keepCheck(F, s, p); return k.no ? null : k.ask }
// the same, with the reason it won't: { ask, no: null | 'ask' | 'role' | 'reb' | 'worth' | 'line' | 'hard', over }
// (over: how far past its line keeping him would take it)
function keepCheck(F, s, p) {
  const ask0 = resignOffer(F, p)
  if (!ask0) return { ask: null, no: 'ask' }
  // (the deal has to be one its rights allow: ownDeal)
  const ask = ownDeal(F, s, p, ask0)
  if (!ask) return { ask: ask0, no: 'rights' }
  const year = capYear(F)
  const sit = situationOf(F, s)
  const w = worthOf(F, p, year)
  const role = roleOn(F, s, p)
  const mn = minOf(p.ys ?? 0, year)
  const star = keeperOf(F, s, p)
  if (role === 0 && ask.$ > mn * 1.5) return { ask, no: 'role' }
  if (sit === 'reb' && (p.ag ?? 27) >= 30 && !(star && (p.ag ?? 27) <= 32) && ask.$ > mn * 2) return { ask, no: 'reb' }
  if (w < ask.$ * (star ? 0.75 : role === 1 ? 0.85 : 1)) return { ask, no: 'worth' }
  // (the front office's sums are salaries: cap holds aren't payroll; the minimum deals that fill out the roster are)
  const spend = payroll(F, s, year) + ask.$ + reserveOf(F, s, 1)
  if (spend > keepLine(F, s, p, year) && ask.$ > mn + 0.05) return { ask, no: 'line', over: spend - keepLine(F, s, p, year) }
  if (!fitsHard(F, s, ask.$)) return { ask, no: 'hard' }
  return { ask, no: null }
}
// HIS OWN TEAM'S DEAL, WHEN ITS RIGHTS FALL SHORT OF HIS PRICE. A man two seasons with his team (Early Bird rights)
// can be paid about the average salary by it, one season in (Non-Bird) 120% of his last salary: a second-round find
// who has become a starter is worth far more, and his team can't pay it. With nobody holding the cap room for him
// either, he does what the real league's do (Austin Reaves, 2023): he takes the most his own team can give him (its
// rights, or its mid-level if that's more), for two seasons, and gets paid when his Bird rights are full. He only
// passes on it when another team can pay him clearly more. Returns the deal (his ask, when that's legal), or null.
function ownDeal(F, s, p, ask) {
  if (ask.tw) return ask
  const year = capYear(F)
  const own = rightsOf(p, s)
  if (own === 'bird' || !own) return ask
  const mn = minOf(p.ys ?? 0, year)
  const lim = own === 'ebird' ? Math.max((p.$l ?? 0) * 1.75, indexed(12.5, year) * 1.05) : Math.max((p.$l ?? 0) * 1.2, mn * 1.2)
  if (ask.$ <= lim + 0.01 || canSign(F, s, p, ask).ok) return ask
  const outside = outsideBest(F, p)
  for (const v of [lim, mleFor(F, s, year)?.$ ?? 0].map(x => Math.floor(x * 10) / 10).sort((a, b) => b - a)) {
    if (v < mn || v >= ask.$ || v < outside * 0.85) continue
    const d = { $: v, y: Math.max(2, Math.min(ask.y, 2)), r: 0.05, via: own }
    if (canSign(F, s, p, d).ok) return d
  }
  return null
}
// a good young player: the kind a team keeps through restricted free agency
const goodYoung = (F, p) => (p.ag ?? 27) <= 26 && (rankOf(F, p) <= 170 || (p.o ?? 0) >= 76)
// a star of its own a team means to keep (one of the league's forty best, in his prime)
const isStar = (F, p) => rankOf(F, p) <= 40 && (p.ag ?? 27) <= 32
// keep him, making the room if the payroll is the only thing in the way: a front office that can't fit a star of its
// own moves other salary first (trades.js shedTo). Returns the deal, or null; news gets the trades.
function keepStar(F, s, p, news) {
  let k = keepCheck(F, s, p)
  if (k.no === 'line' && isStar(F, p) && k.over <= capOf(capYear(F)) * 0.2) {
    news.push(...shedTo(F, s, payroll(F, s, capYear(F)) - k.over - 0.5, { held: heldBy(F) }))
    k = keepCheck(F, s, p)
  }
  return k.no ? null : k.ask
}
// THE LAST CALL ON A STAR OF ITS OWN. The summer is ending, nobody has the room for him and no sign-and-trade came
// together: a real contender (one of the league's six best rosters) that hasn't just spent a season past the second
// apron brings him back at what he asks now rather than lose him for nothing, well past the second apron for a
// season if it has to (the 2024-25 Suns' kind of payroll), and sells down from there. Anyone else lets him go.
function lastKeep(F, s, p) {
  const year = capYear(F)
  if (!isStar(F, p) || wantsOut(F, s, p)) return null
  const k = keepCheck(F, s, p)
  if (k.no !== 'line') return null
  const L = spendLines(F, s, year)
  if (L.sit !== 'win' || strengthRank(F, s) > 6 || (F.teams[s].a2h ?? []).includes(year - 1)) return null
  const $ = Math.min(k.ask.$, Math.max(askFor(F, p).$, k.ask.$ * 0.8))
  if (payroll(F, s, year) + $ + reserveOf(F, s, 1) > apron2Of(year) + capOf(year) * 0.13) return null
  return fitsHard(F, s, $) ? k.ask : null
}
// the money a team is holding for stars of its own still unsigned (their asks today): it doesn't spend that, or take
// on a hard cap, until they've decided
function pendingOf(F, s, but = null) {
  const year = capYear(F)
  let sum = 0
  for (const p of F.fa ?? []) if (p.fr === s && !p.rn && p.hy === year && p !== but && (isStar(F, p) || (p.rfa && goodYoung(F, p) && rankOf(F, p) <= 150))) sum += askFor(F, p).$
  return sum
}
// (for trades.js: a team holding money for its own doesn't take on another team's salary meanwhile)
const heldBy = F => s => pendingOf(F, s)
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
  if (short && (day < 3 || capOf(year) - capPayroll(F, s, year) < a.$ * 0.6)) return null
  const w = worthOf(F, p, year) * (sit === 'win' && role > 0 && ag >= 26 ? 1.1 : sit === 'reb' && ag <= 25 ? 1.1 : 1)
  const own = rightsOf(p, s)
  // (another team's restricted free agent: an offer sheet ties up a team's room for a day and is nearly always
  // matched, so the league's teams sign few: a good player, from the second day, with the cap room for it)
  const sheet = !!(p.rfa && p.fr && p.fr !== s && !p.rn)
  if (sheet && (day < 2 || tierOf(F, p) < 1 || hash(`${F.seed}-${year}-sheet-${s}-${p.i}`) % 3)) return null
  const yrs = Math.min(a.y, short ? 2 : own === 'bird' ? 5 : 4)
  const base = Math.min(a.$, w * 1.05)
  const mn = minOf(p.ys ?? 0, year)
  const under = payroll(F, s, year) < floorOf(year)
  // (the least it offers: most of his ask in the first days; on the last, whatever it has)
  const lo = day >= FA_DAYS ? 0 : 0.75
  const tries = [base, a.$ * 0.9, ...(under ? [Math.min(a.$ * 1.25, w * 1.6, capOf(year) - capPayroll(F, s, year))] : [])]
  // (its channels: what's left under the cap, its mid-level, the bi-annual, the minimum)
  const room = capOf(year) - (capPayroll(F, s, year) - (own ? holdOf(p, year) : 0))
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
      if (sheet && c.via !== 'room') continue
      // (the line its front office spends to, the minimum deals that fill out the roster counted; a minimum deal
      // always fits; a hard-capped team keeps room to fill out)
      // (and the money it's holding for a star of its own who hasn't decided)
      const pend = pendingOf(F, s, p)
      const line = own ? keepLine(F, s, p, year) : spendLines(F, s, year).add - pend
      if (c.via !== 'min' && payroll(F, s, year) + v + reserveOf(F, s, 1) > line) continue
      if (!fitsHard(F, s, v, c.via, pend)) continue
      return { ...d, via: c.via, ln: line }
    }
  }
  return null
}

// ── The first day: rights, holds and dumps ───────────────────────────────────
function openMarket(F) {
  const news = []
  const year = capYear(F)
  for (const p of F.fa ?? []) askFor(F, p)
  // (the summer's first call: a star with nobody's rights on him, and the team that makes the room for him)
  news.push(...clearRoom(F, 1, { sit: Object.fromEntries(shortsOf(F).map(s => [s, situationOf(F, s)])) }, { early: true }))
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
      // (a good young restricted man is settled now, before the team spends its summer elsewhere: rfaDeal)
      const ask = keepStar(F, s, p, news) ?? (p.rfa ? rfaDeal(F, s, p, news) : null)
      if (ask && signMan(F, s, p, ask).ok && (p.o ?? 0) >= 78) news.push({ k: 'sign', tag: 'RE-SIGNED', s, text: signText('re-signs with', p, s) })
    }
    // the rest: renounced when the team wants its room, held (Bird rights for later) when it's over the cap anyway (a
    // star it would bring back stays held)
    const pay = payroll(F, s, year)
    if (pay < capOf(year) - 5) for (const p of (F.fa ?? []).filter(x => x.fr === s && !x.rn && x.hy === year && !x.rfa && !keeperOf(F, s, x))) renounce(F, s, p.i)
  }
  news.push(...sellDown(F, { held: heldBy(F) }))
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
      if (spent[s] > 0 && capPayroll(F, s, year) + spent[s] > capOf(year) && busy[s] >= 1 && (p.o ?? 0) < 75) continue
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
      // (a league team made each of its offers inside its budget; now that others have taken theirs, this one still
      // has to fit its line and leave it the room to fill out under a hard cap)
      if (o.s !== F.team && (!fitsHard(F, o.s, o.d.$, c.via) || (c.via !== 'min' && payroll(F, o.s, year) + o.d.$ + reserveOf(F, o.s, 1) > (o.d.ln ?? Infinity)))) continue
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
      const keep = was !== F.team && rfaDeal(F, was, p, news)
      // (the offer's amount is read before he signs: signing clears it off him)
      const qo = p.qo
      if (keep && signMan(F, was, p, keep).ok) { if ((p.o ?? 0) >= 76) news.push({ k: 'sign', tag: 'RE-SIGNED', s: was, text: signText('re-signs with', p, was) }) }
      // (a two-way man's qualifying offer is a two-way deal: he's back on one, restricted again next summer)
      else if (p.qtw) { if (signMan(F, was, p, { $: twoWayOf(year), y: 1, r: 0, tw: 1, sheet: 1 }).ok && (p.o ?? 0) >= 70) news.push({ k: 'sign', tag: 'QUALIFYING OFFER', s: was, text: `${p.n} signs his qualifying offer with the ${was}: 1 year, two-way contract` }) }
      else if (signMan(F, was, p, { $: qo, y: 1, r: 0, sheet: 1 }).ok) { delete p.rfa; news.push({ k: 'sign', tag: 'QUALIFYING OFFER', s: was, text: `${p.n} signs his qualifying offer with the ${was}: ${termsText(1, qo)}; he can be an unrestricted free agent next summer` }) }
    }
  }
  // (from the third day: the sign-and-trades, for the good players no team could sign outright; every day, a team
  // clears the room for a star nobody holds the rights to)
  if (day >= 3) news.push(...signAndTrades(F, day, ctx))
  news.push(...clearRoom(F, day, ctx))
  return news
}
// a restricted free agent no team signed to a sheet, and his own team, on the last day. They settle: his price as it
// stands, when the team would keep him at it (keepsOwn); a good young player the team's sums turned down still
// re-signs, at what it can pay him (his worth, the most his rights or its exception allow), because a front office
// doesn't let a young starter play out a qualifying offer and walk a year later: it pays him and moves salary
// elsewhere. A few bet on themselves and take the qualifying offer anyway (one to three a summer in the real
// league); the end of the bench plays on it. Returns the deal, or null (the qualifying offer).
function rfaDeal(F, s, p, news = []) {
  const year = capYear(F)
  const k = keepsOwn(F, s, p)
  if (k && canSign(F, s, p, k).ok) return k
  if (!goodYoung(F, p) || roleOn(F, s, p) === 0) return null
  if (rngOf(`${F.seed}-${year}-qo-${p.i}`).u() < 0.05) return null
  const ask = resignOffer(F, p)
  if (!ask) return null
  const w = worthOf(F, p, year), qo = p.qo ?? 0
  const top = Math.min(ask.$, Math.max(w, qo * 1.1))
  const m = mleFor(F, s, year)
  const line = Math.max(keepLine(F, s, p, year), apron2Of(year))
  // (the payroll in the way: it moves other salary first, as it would for a star)
  const over = payroll(F, s, year) + top + reserveOf(F, s, 1) - line
  if (over > 0 && over <= capOf(year) * 0.12) news.push(...shedTo(F, s, payroll(F, s, year) - over - 0.5, { held: heldBy(F) }))
  // (what the team can pay: his price, or what his rights or its mid-level allow (a man two years in, on Early Bird
  // rights, is held to about the average salary: the real league's second-round finds sign for that); a deal well
  // short of his price is a two-year bridge, never a long one)
  for (const v of [top, top * 0.85, m?.$ ?? 0, indexed(12.5, year) * 1.05, top * 0.7].map(r1).filter(v => v > qo + 0.05 && v <= top + 0.01).sort((a, b) => b - a)) {
    for (const y of [ask.y, 3, 2].filter((y, j, A) => y <= (v < top * 0.75 ? 2 : ask.y) && A.indexOf(y) === j)) {
      const d = { ...ask, $: v, y }
      const c = canSign(F, s, p, d)
      if (!c.ok || !fitsHard(F, s, v, c.via)) continue
      if (payroll(F, s, year) + v + reserveOf(F, s, 1) > line) continue
      return d
    }
  }
  return null
}
// an AI team matching an offer sheet. A good young player: matched, nearly always, as the real league's are (the
// team pays him and moves salary elsewhere if the tax says so), unless the sheet is far past what he's worth or the
// second apron is in the way. Anyone else: when he's worth it and it fits the line the team keeps its own men to.
function aiMatches(F, s, p, d) {
  const year = capYear(F)
  const w = worthOf(F, p, year)
  const after = payroll(F, s, year) + d.$
  if (!fitsHard(F, s, d.$) || !canSign(F, s, p, { $: d.$, y: d.y, r: Math.min(d.r ?? 0, raiseMax(rightsOf(p, s))), sheet: 1 }).ok) return false
  if (goodYoung(F, p) && roleOn(F, s, p) > 0) return d.$ <= w * 1.4 && after <= Math.max(keepLine(F, s, p, year), apron2Of(year))
  return w >= d.$ * (keeperOf(F, s, p) ? 0.75 : 0.95) && after + reserveOf(F, s, 1) <= keepLine(F, s, p, year)
}
// ── Sign-and-trades (between the league's teams) ─────────────────────────────
// A good player whose team holds his rights and won't pay him (or who wants out), and a team that wants him with no
// room to sign him: his old team signs him to the deal and sends him there for salary that makes it legal, the way
// most good players change teams in a league where almost nobody has cap room. The CBA's terms: three or four
// seasons, raises of 5%; the team that gets him is hard-capped at the first apron and has to be under it after; his
// old team takes back no more than the trade rules allow (trades.js matchLimit) and stays inside the line it spends
// to. Both sides come out ahead by their own books (trades.js teamSide): the buyer gets its man, the seller gets
// players it can use for a man who was leaving. At most two a day.
function signAndTrades(F, day, ctx) {
  const news = []
  const year = capYear(F)
  const R = rngOf(`${F.seed}-${year}-snt-${day}`)
  const S = shortsOf(F).filter(s => s !== F.team)
  const cap = capOf(year), a1 = apron1Of(year)
  const hit = q => (q.tw ? 0 : q.$ ?? 0)
  const men = (F.fa ?? []).filter(p => !p.fl && !p.rfa && !p.rn && p.fr && p.fr !== F.team && p.hy === year && !sheetOf(F, p) && !F.fao?.[p.i] && (rankOf(F, p) <= 110 || (p.o ?? 0) >= 82))
    .sort((a, b) => rankOf(F, a) - rankOf(F, b))
  let done = 0
  for (const p of men) {
    if (done >= 2) break
    const A = p.fr, ask = askFor(F, p)
    // (a man the mid-level can pay signs that way)
    if (ask.$ < excOf('nt', year) * 0.9) continue
    const d = { $: ask.$, y: clamp(3, 4, ask.y), r: 0.05 }
    // (his old team signs him with its rights: the deal has to be one they allow: Bird rights any salary to his max,
    // Early Bird and Non-Bird their limits)
    const own = rightsOf(p, A)
    const lim = own === 'bird' ? Infinity : own === 'ebird' ? Math.max((p.$l ?? 0) * 1.75, indexed(12.5, year) * 1.05) : Math.max((p.$l ?? 0) * 1.2, minOf(p.ys ?? 0, year) * 1.2)
    if (d.$ > lim + 0.01) continue
    const pc = { ...p, $: d.$, y: d.y, sc: schedOf(d).slice(1) }
    const w = worthOf(F, p, year)
    const payA = payroll(F, A, year), capA = capPayroll(F, A, year) - holdOf(p, year)
    const lineA = Math.min(hardCapOf(F, A, year), spendLines(F, A, year).keep + 1)
    const buyers = R.shuffle(S).filter(B => B !== A && roleOn(F, B, p) === 1 && !(ctx.sit[B] === 'reb' && (p.ag ?? 27) >= 27) && w * (ctx.sit[B] === 'win' ? 1.15 : 1.05) >= d.$)
      .sort((x, y) => ctx.str[y] - ctx.str[x])
    let made = false
    for (const B of buyers) {
      const payB = payroll(F, B, year), capB = capPayroll(F, B, year)
      const lineB = Math.min(a1, hardCapOf(F, B, year), Math.max(spendLines(F, B, year).keep, a1))
      const top3 = new Set(standardOf(F.teams[B]).slice().sort((x, y) => (y.o ?? 0) - (x.o ?? 0)).slice(0, 3).map(q => q.i))
      const pool = standardOf(F.teams[B]).filter(q => !top3.has(q.i) && q.b == null && hit(q) > 0 && !whyNot(F, B, q)).sort((x, y) => hit(y) - hit(x) || x.i - y.i).slice(0, 9)
      // (what it sends: one man, or two, the least salary that works for both teams)
      const sets = [...pool.map(q => [q]), ...pool.flatMap((q, j) => pool.slice(j + 1).map(t => [q, t]))]
        .map(set => ({ set, O: set.reduce((x, q) => x + hit(q), 0) })).sort((x, y) => x.O - y.O)
      for (const { set, O } of sets) {
        const n = set.length
        const afterB = payB - O + d.$, afterA = payA + O
        // the buyer: legal (room, or the salaries match), under the first apron with the room to fill out
        if (capB - O + d.$ > cap + 0.25 && d.$ > matchLimit(F, B, O, afterB, year) + 0.001) continue
        if (afterB + reserveOf(F, B, 1 - n) > lineB + 0.01) continue
        // the seller: legal (it takes back no more than his salary allows), inside its line, a roster it can carry
        if (capA + O > cap + 0.25 && O > matchLimit(F, A, d.$, afterA, year) + 0.001) continue
        if (afterA + reserveOf(F, A, n) > lineA + 0.01) continue
        if (F.teams[A].r.length + n > OFF_MAX) continue
        const sideA = teamSide(F, A, { pl: set, pk: [] }, { pl: [], pk: [] })
        if (sideA.gain < 1) continue
        const sideB = teamSide(F, B, { pl: [pc], pk: [] }, { pl: set, pk: [] })
        if (sideB.gain < 2) continue
        // done: his old team signs him, then sends him on
        if (!signMan(F, A, p, { ...d, sc: schedOf(d) }, { check: false }).ok) continue
        doTrade(F, { a: B, b: A, ga: set.map(q => q.i), gb: [p.i], pa: [], pb: [] }, { user: false })
        excFor(F, B, year).hc = 'a1'
        news.push({ k: 'sign', tag: 'SIGN-AND-TRADE', s: B, big: rankOf(F, p) <= 40, text: `${p.n} joins the ${B} in a sign-and-trade with the ${A}: ${termsText(d.y, dealSum(d))}. ${andNames(set.map(q => q.n))} ${n === 1 ? 'goes' : 'go'} to the ${A}` })
        made = true
        break
      }
      if (made) break
    }
    if (made) done++
  }
  return news
}
// ── A team clears the room (the league's teams) ──────────────────────────────
// A star on the market with no team holding his rights (his old team renounced him), and nobody with the cap room
// for him: a team that wants him makes the room, the way the Knicks did for Brunson, the Sixers for George and the
// Bucks for Turner. It renounces its own free agents, moves contracts to teams that can take them (trades.js shedTo:
// into room, a trade exception or a mid-level, a pick attached when the contract needs one), and if that leaves it
// short, waives and stretches a contract or two it can live without (the Bucks and Lillard's, 2025). Then it signs
// him at about his market price, for three or four seasons. Tried on a copy of the league first: nobody guts a roster
// for a star it then can't fit. Every day of the market, the best such man first, one signing a day. One of the
// league's dozen best in his prime is worth more of a roster (a longer reach), and a rebuilding team takes the call
// too: he's the rebuild.
// THE FIRST MORNING (early): a star with no team's rights on him (renounced, or off the street) is the summer's
// first call. The teams within reach move before they've re-signed anyone or spent an exception: the league still
// has its room and its mid-levels to take the contracts, and the men to move aren't freshly signed. Later in the
// week the same door is far narrower.
const franchiseMan = (F, p) => rankOf(F, p) <= 12 && (p.ag ?? 27) <= 30
function clearRoom(F, day, ctx, { early = false } = {}) {
  const news = []
  const year = capYear(F), cap = capOf(year)
  const S = shortsOf(F).filter(s => s !== F.team)
  // (a star nobody holds the rights to, or one his own team can't keep; the first morning, only the men with no
  // rights on them: the GM's own free agents are his to offer first)
  const loose = p => (early ? !p.fr || !!p.rn : !(p.fr && !p.rn && p.fr !== F.team) || (day >= 3 && !!keepCheck(F, p.fr, p).no))
  const stars = (F.fa ?? []).filter(p => isStar(F, p) && !p.fl && !p.rfa && !sheetOf(F, p) && !F.fao?.[p.i] && loose(p))
    .sort((a, b) => rankOf(F, a) - rankOf(F, b))
  const drop = (G, B) => { for (const x of G.fa ?? []) if (x.fr === B && !x.rn && !x.rfa && !isStar(G, x)) renounce(G, B, x.i) }
  // (the contracts a team would waive and stretch to finish the job: not its three best men, not a man it signed or
  // traded for this summer, not a young man on his rookie deal, nobody the league would give much for; the ones that
  // free the most room first)
  let worthless = 12
  const stretchable = (G, B) => {
    const std = standardOf(G.teams[B])
    const core = new Set(std.slice().sort((x, y) => (y.o ?? 0) - (x.o ?? 0)).slice(0, 3).map(q => q.i))
    return std.filter(q => !core.has(q.i) && q.b == null && !q.rs && q.sgn !== year && !(q.tx && q.tx[1] === year) && (q.$ ?? 0) >= 6 && manValue(G, q) <= worthless)
      .map(q => ({ q, free: (q.$ ?? 0) - cutCost(G, q, { stretch: true }).now })).filter(x => x.free >= 3).sort((x, y) => y.free - x.free || x.q.i - y.q.i)
  }
  for (const p of stars.slice(0, 2)) {
    const mv = marketValue(F, p, year), w = worthOf(F, p, year)
    const top = franchiseMan(F, p)
    // (his price: what he asks today; a man with no team behind him still gets most of his market from a team
    // that makes the room for him)
    const held = !!(p.fr && !p.rn && p.fr !== F.team)
    const d = { $: r1(held ? askFor(F, p).$ : Math.min(mv, Math.max(askFor(F, p).$, mv * 0.85))), y: Math.min(4, Math.max(top ? 3 : 2, termOf(F, p))), r: 0.05 }
    // (a team with the room already will bid for him in the round)
    if (S.some(B => capPayroll(F, B, year) + d.$ <= cap + 0.01)) continue
    const reach = cap * (top ? 0.42 : 0.28)
    // (what it will let go to make the room: more for a franchise player)
    const give = top ? 2.5 : 1.5
    worthless = top ? 30 : 15
    const buyers = S.filter(B => roleOn(F, B, p) === 1 && (top || !(ctx.sit[B] === 'reb' && (p.ag ?? 27) >= 28)) && w * 1.1 >= d.$ && !pendingOf(F, B))
      .map(B => ({ B, gap: payroll(F, B, year) + reserveOf(F, B, 1) + d.$ - cap })).filter(x => x.B !== p.fr && x.gap > 0 && x.gap <= reach).sort((x, y) => x.gap - y.gap || (x.B < y.B ? -1 : 1))
    for (const { B } of buyers.slice(0, 4)) {
      // (the room is counted with the empty-roster charges in: a second and third pass move what the first left)
      const need = X => capPayroll(X, B, year) + d.$ - cap
      const clear = X => {
        drop(X, B)
        const out = []
        for (let k = 0; k < 3; k++) { const n = need(X); if (n <= 0.01) break; out.push(...shedTo(X, B, payroll(X, B, year) - n - 0.3, { held: heldBy(X), give })) }
        // (still short: a contract or two waived and stretched, when that finishes it)
        if (need(X) > 0.01) {
          const L = stretchable(X, B).slice(0, 2)
          // (an open roster spot costs a rookie minimum of cap room: counted in what each waiver frees)
          const spot = standardOf(X.teams[B]).length <= 12 ? minOf(0, year) : 0
          if (L.reduce((a, x) => a + x.free - spot, 0) >= need(X) - 0.01) for (const { q } of L) {
            if (need(X) <= 0.01) break
            cutMan(X, B, q.i, { stretch: true })
            out.push({ k: 'cut', tag: 'WAIVED', s: B, text: `The ${B} have waived ${q.n} and stretched what he's owed to clear cap room` })
          }
        }
        return out
      }
      const G = JSON.parse(JSON.stringify(F))
      clear(G)
      const pc = (G.fa ?? []).find(x => x.i === p.i)
      if (!pc || canSign(G, B, pc, d).via !== 'room') continue
      news.push(...clear(F))
      if (signMan(F, B, p, d).ok) news.push({ k: 'sign', tag: 'FREE AGENCY', s: B, big: true, text: signText('signs with', p, B) })
      return news
    }
  }
  return news
}
const andNames = L => (L.length <= 1 ? L.join('') : `${L.slice(0, -1).join(', ')} and ${L[L.length - 1]}`)
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
// THE LATE MARKET (once free agency's days are done, and at camp). One rule for every team, the GM's and the
// league's:
//   - a man signs the best offer on the table (offerScore: the money against his ask, the years, a winner, a role,
//     the lights, home);
//   - a star offered less than half of what he asked the first day takes one season and tries the market again (a
//     good player, two at most): nobody locks a top player up for years at mid-level money;
//   - what a league team puts in front of him (lateDeal): the most it can pay by cap room, its mid-level or the
//     bi-annual, up to his ask, inside the line its front office spends to; the minimum if that's all it has.
// The GM's late offer (lateOffer) is weighed against the best of the league's: he signs with the GM when it's at
// least as good as anything a league team would offer him now.
const lateYears = (F, p, $) => {
  const t = tierOf(F, p), b = p.ask?.b ?? askFor(F, p).b ?? 0
  return $ >= b * 0.5 ? 5 : t === 2 ? 1 : t === 1 ? 2 : 5
}
// the deal league team s would offer him now: { d, low (the man it waives to make room, or null) } or null
function lateDeal(F, s, p) {
  const year = capYear(F)
  const tier = tierOf(F, p)
  const mn = minOf(p.ys ?? 0, year)
  const ask = askFor(F, p).$
  const team = F.teams[s]
  // (a full roster: its cheapest end-of-bench man is waived to make room, when that costs next to nothing)
  let low = null
  if (standardOf(team).length >= ROSTER_MAX) {
    low = standardOf(team).filter(x => x.b == null && (x.o ?? 0) < (p.o ?? 0) - 4).sort((a, b) => cutCost(F, a).total - cutCost(F, b).total || (a.o ?? 0) - (b.o ?? 0))[0]
    if (!low || cutCost(F, low).total > 3) return null
  }
  const m = mleFor(F, s, year)
  const chan = Math.max(capOf(year) - capPayroll(F, s, year), m?.$ ?? 0, mn)
  const yrs = tier === 2 ? Math.min(termOf(F, p), (p.ag ?? 27) >= 33 ? 2 : 3) : tier === 1 ? ((p.ag ?? 27) >= 31 ? 1 : 2) : 1
  const line = spendLines(F, s, year).add
  for (const v of (tier === 0 ? [mn] : [Math.min(ask, chan), mn]).map(x => r1(Math.max(mn, x)))) {
    for (const y of [yrs, 2, 1].filter((n, j, A) => n <= Math.min(yrs, lateYears(F, p, v)) && A.indexOf(n) === j)) {
      const d = { $: v, y, r: 0 }
      const c = canSign(F, s, p, d)
      if (!c.ok || !fitsHard(F, s, v, c.via)) continue
      if (c.via !== 'min' && payroll(F, s, year) + v + reserveOf(F, s, 1) > line) continue
      return { d: { ...d, via: c.via }, low }
    }
  }
  return null
}
// the best of the league's late offers for him: { s, d, low, u } or null
function lateBest(F, p, teams) {
  let best = null
  for (const s of teams) {
    const x = lateDeal(F, s, p)
    if (!x) continue
    const u = offerScore(F, p, s, x.d)
    if (!best || u > best.u + 1e-9) best = { s, ...x, u }
  }
  return best
}
// the league teams that would take a call on him late: a star, anyone; a good player or a role player, the teams
// not rebuilding that he'd play for
const lateTeams = (F, p) => shortsOf(F).filter(s => s !== F.team && (tierOf(F, p) === 2 || (situationOf(F, s) !== 'reb' && roleOn(F, s, p) >= 0.5)))
// once the market's days are done (or at camp) a free agent answers the GM's offer at once
export function lateOffer(F, id, d) {
  const p = (F.fa ?? []).find(x => x.i === id)
  if (!p) return { ok: false, why: 'He has signed elsewhere' }
  const deal = { $: r1(d.$), y: d.y, r: d.r ?? 0 }
  const c = canSign(F, F.team, p, deal)
  if (!c.ok) return c
  const maxY = lateYears(F, p, deal.$)
  if (deal.y > maxY) return { ok: false, why: `At ${money(deal.$)} a year he'll sign for ${maxY === 1 ? 'one season' : 'two seasons at most'}, then try the market again: he wants ${money((p.ask?.b ?? 0) * 0.5)} a year or more to commit for longer` }
  const u = offerScore(F, p, F.team, deal)
  const best = lateBest(F, p, lateTeams(F, p))
  if (best && u < best.u - 1e-9) return { ok: false, why: `He turns it down: he has a better offer on the table (${money(best.d.$)} a year for ${best.d.y} ${best.d.y === 1 ? 'season' : 'seasons'})` }
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
  // (the rosters are set: a team still past the line its ownership spends to moves salary before camp)
  news.push(...sellDown(F))
  // (the pool's rights and holds are spent with the summer)
  for (const p of F.fa ?? []) for (const k of ['fr', 'hy', 'rfa', 'qo', 'qot', 'rsl', 'ask', 'dco', 'osh']) delete p[k]
  F.fao = {}
  F.rfq = []
  return news
}
// the summer's last calls (the late market's rule above): a good player still out there goes back to his own team
// first when it holds his rights and wants him at his price now; else he signs the best of the offers the league's
// teams have left for him (a team's cheapest end-of-bench man waived to make room if it has to)
function lateSignings(F) {
  const news = []
  const year = capYear(F)
  const left = [...(F.fa ?? [])].filter(p => rankOf(F, p) <= 300 && !p.fl).sort((a, b) => rankOf(F, a) - rankOf(F, b))
  const used = new Set()
  for (const p of left) {
    const tier = tierOf(F, p)
    const mn = minOf(p.ys ?? 0, year)
    const ask = askFor(F, p).$
    // (his own team, if it still holds his rights and wants him at his price now)
    const own = p.fr && !p.rn && p.fr !== F.team && rightsOf(p, p.fr) ? p.fr : null
    if (own && tier >= 1) {
      const k = keepStar(F, own, p, news) ?? lastKeep(F, own, p)
      const d = k && { ...k, $: r1(Math.max(mn, Math.min(k.$, Math.max(ask, k.$ * 0.8)))) }
      if (d && signMan(F, own, p, d).ok) { if ((p.o ?? 0) >= 78) news.push({ k: 'sign', tag: 'RE-SIGNED', s: own, text: signText('re-signs with', p, own) }); continue }
    }
    // (a role player: one late signing a team)
    const best = lateBest(F, p, lateTeams(F, p).filter(s => tier >= 1 || !used.has(s)))
    if (!best) continue
    if (best.low) cutMan(F, best.s, best.low.i)
    if (!signMan(F, best.s, p, best.d).ok) continue
    used.add(best.s)
    if ((p.o ?? 0) >= 78) news.push({ k: 'sign', tag: 'FREE AGENCY', s: best.s, text: signText('signs with', p, best.s, { note: best.d.via === 'mle' || best.d.via === 'tmle' || best.d.via === 'rmle' ? ' (mid-level exception)' : '' }) })
  }
  return news
}
// a league team extends the men it wants to keep (a rookie-scale man going into his fourth season, a veteran a year
// from free agency), when the price is one it will pay: inside the line it keeps its own men to on the season the
// new deal starts (a franchise player whatever it takes: keepLine)
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
    if (payroll(F, s, year + 1) + ask.$ > keepLine(F, s, p, year + 1)) continue
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
