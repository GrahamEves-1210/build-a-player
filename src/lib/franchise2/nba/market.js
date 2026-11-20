// NBA FRANCHISE: free agency (the 2023 CBA's rules, the real market's habits).
//
// THE DAYS (faDay): free agency runs FA_DAYS rounds. On the first, the league's teams re-sign the men they want to
// keep (Bird rights let them go over the cap to do it) and renounce the rest if they need the room; the teams over
// the tax shed salary to teams with room (trades.js salaryDumps). Then every round:
//   1. each team that needs a man makes an offer, with the money it can use: its cap room, else its mid-level
//      (non-taxpayer, taxpayer or room), else the bi-annual, else the minimum. Its front office won't add a man past
//      the line it spends to (contracts.js taxTolerance: a contender into the tax or the apron, a rebuilder never
//      over the cap).
//   2. each free agent weighs his offers: the money first (a year's salary and the years: an older man wants the
//      security), then winning and his role, and for some men the market (the big cities). He signs the best one when
//      it's at least what he'll settle for that day (his ask on the first, 18% under it by the fourth, the minimum by
//      the last); otherwise he waits.
//   3. a restricted free agent's offer sheet goes to his old team, which matches (and keeps him at those terms) when
//      he's worth it to them and they'll pay it. The GM's team answers its own (matchSheet), within the day.
//   An RFA with no offer by the last day signs his qualifying offer (one season, unrestricted after).
// THE GM'S TEAM: F.fao { [manId]: deal } its offers (and offer sheets) for the next round; F.rfq [{ i, s, deal }] the
// offer sheets its own RFAs signed that it must match or not.
// THE REST OF THE SUMMER (cpuOffseason): the rounds left, then every league team fills its roster to at least 14
// standard deals (the minimum, from the pool; core's `make` makes a man when the pool runs dry), cuts down to 15,
// signs two-way men to two or three spots, and extends the young men and veterans it wants to keep.
import { rngOf, clamp, r1 } from '../rng'
import { capOf, minOf, twoWayOf, payroll, capYear, standardOf, twoWaysOf, holdOf, excOf, hardCapOf, floorOf } from './cap'
import {
  marketValue, worthOf, rankOf, termFor, canSign, signMan, rightsOf, resignOffer, renounce, situationOf,
  taxTolerance, lineOf, teamStrength, BIG_MARKET, mleFor, excFor, cutMan, cutCost, extensionAsk, extendMan,
  ROSTER_MAX, ROSTER_MIN, TWO_WAY_MAX, raiseMax, schedOf, legalRoster, outsideBest,
} from './contracts'
import { salaryDumps, summerTrades } from './trades'

export const FA_DAYS = 6
const FLOOR = [1, 0.94, 0.88, 0.82, 0.7, 0]
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const shortsOf = F => Object.keys(F.teams ?? {})
const money = v => `$${r1(v)}M`
const fullName = s => s

// ── What a free agent wants ──────────────────────────────────────────────────
// his ask (set once, the first day: his market, tilted by how he reads it) and what he cares about past the money
// (from his id: everyone's a little different, the same every time)
export function askFor(F, p) {
  if (p.ask && p.ask.yr === capYear(F)) return p.ask
  const year = capYear(F)
  const R = rngOf(`${F.seed}-${year}-fa-${p.i}`)
  // (his price, held to what the league can pay this summer)
  const mv = Math.min(marketValue(F, p, year), Math.max(outsideBest(F, p), minOf(p.ys ?? 0, year)))
  const $ = r1(clamp(minOf(p.ys ?? 0, year), Infinity, mv * (1 + R.n() * 0.05)))
  p.ask = { yr: year, $, y: termFor(p) }
  return p.ask
}
export function wantsOf(p) {
  const h = hash(`want-${p.i}-${p.n}`)
  const old = (p.ag ?? 27) >= 30
  return {
    win: (old ? 0.08 : 0.03) + (h % 7) * 0.012,          // a ring
    role: ((h >> 3) % 6) * 0.012 + ((p.ag ?? 27) <= 25 ? 0.03 : 0),  // minutes and shots
    mkt: (h >> 6) % 4 === 0 ? 0.06 : 0,                  // the lights (one in four)
    home: ((h >> 9) % 5) * 0.01,                         // loyalty to his team
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
  const extra = 1 + W.win * win + W.role * (role - 0.5) * 2 + W.mkt * mkt + W.home * home
  return (sc[0] / Math.max(0.1, a.$)) * yf * extra
}
// where he'd play there: 1 a starter, 0.5 rotation, 0 the end of the bench
export function roleOn(F, s, p) {
  const r = F.teams[s].r.filter(x => !x.tw && x.i !== p.i).map(x => x.o ?? 60).sort((a, b) => b - a)
  const ahead = r.filter(o => o > (p.o ?? 60)).length
  return ahead < 5 ? 1 : ahead < 9 ? 0.5 : 0
}

// ── What a team will do ──────────────────────────────────────────────────────
// would team s keep its own free agent (re-sign him with his rights): he plays for it, he's worth what he asks, and
// it will pay it under the line it keeps its own men to
export function keepsOwn(F, s, p) {
  const ask = resignOffer(F, p)
  if (!ask) return null
  const year = capYear(F)
  const sit = situationOf(F, s)
  const w = worthOf(F, p, year)
  const role = roleOn(F, s, p)
  if (role === 0 && ask.$ > minOf(p.ys ?? 0, year) * 1.5) return null
  if (sit === 'reb' && (p.ag ?? 27) >= 30 && ask.$ > minOf(p.ys ?? 0, year) * 2) return null
  if (w < ask.$ * (role === 1 ? 0.85 : 1)) return null
  const tol = taxTolerance(F, s)
  const after = payroll(F, s, year) - holdOf(p, year) + ask.$
  // (a top-three man on the team is kept up to the line for keeping; anyone else up to the line for adding)
  const top3 = F.teams[s].r.filter(x => !x.tw && (x.o ?? 0) > (p.o ?? 0)).length < 3
  if (after > lineOf(top3 ? tol.keep : tol.add, year) && ask.$ > minOf(p.ys ?? 0, year) + 0.05) return null
  if (after + reserveOf(F, s, 1) > hardCapOf(F, s, year) + 0.01) return null
  return ask
}
// the best deal team s would offer free agent p now (or null): his ask, inside what it can use and will spend
function bidFor(F, s, p, day, ctx) {
  const year = capYear(F)
  const a = askFor(F, p)
  const sit = ctx.sit[s]
  const role = roleOn(F, s, p)
  const st = standardOf(F.teams[s]).length
  // (it needs him: he'd play for it, or it needs bodies; a rebuilder wants young men, a contender men who help now)
  if (role === 0 && st >= 13) return null
  if (sit === 'reb' && (p.ag ?? 27) >= 30 && a.$ > minOf(p.ys ?? 0, year) * 1.6) return null
  const w = worthOf(F, p, year) * (sit === 'win' && role > 0 && (p.ag ?? 27) >= 26 ? 1.1 : sit === 'reb' && (p.ag ?? 27) <= 25 ? 1.1 : 1)
  const floor = FLOOR[Math.min(FLOOR.length - 1, day - 1)]
  const tol = taxTolerance(F, s)
  const yrs = Math.min(a.y, (p.ag ?? 27) >= 31 ? 2 : 4)
  const own = rightsOf(p, s)
  const base = Math.min(a.$, w * 1.05)
  void 0
  const mn = minOf(p.ys ?? 0, year)
  const under = payroll(F, s, year) < floorOf(year)
  const tries = [base, a.$ * Math.max(floor, 0.75), ...(under ? [Math.min(a.$ * 1.25, w * 1.6, capOf(year) - payroll(F, s, year))] : [])]
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
    if (v < mn || seen.has(v) || v < a.$ * floor - 0.01) continue
    seen.add(v)
    // (a team under the salary floor overpays on a short deal rather than hand the shortfall back at season's end)
    // (and a team with real room pays up for the men it can get: the summer's room goes to someone)
    if (v > w * (under ? 1.6 : room >= 15 ? 1.3 : 1.1) && v > mn + 0.05) continue
    for (const y of [yrs, Math.min(yrs, 2), 1]) {
      const d = { $: v, y, r: v > mn + 0.05 ? raiseMax(own) * (v >= 15 ? 1 : 0.6) : 0 }
      const c = canSign(F, s, p, d)
      if (!c.ok) continue
      // (the line its front office spends to; a minimum deal always fits; a hard-capped team keeps room to fill out)
      const after = payroll(F, s, year) - (own ? holdOf(p, year) : 0) + v
      if (c.via !== 'min' && after > lineOf(own ? tol.keep : tol.add, year)) continue
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
  // the league's teams keep their own (the GM's team does that on its screen)
  for (const s of shortsOf(F)) {
    if (s === F.team) continue
    for (const p of (F.fa ?? []).filter(x => x.fr === s && !x.rn && x.hy === year)) {
      // (an RFA is kept with his qualifying offer out; the market sets his price)
      if (p.rfa) continue
      const ask = keepsOwn(F, s, p)
      if (ask && signMan(F, s, p, ask).ok && (p.o ?? 0) >= 78) news.push({ k: 'sign', tag: 'RE-SIGNED', s, text: `${p.n} is re-signing with the ${s} on a ${ask.y}-year, ${money(sumOf(p))} deal.` })
    }
    // the rest: renounced when the team wants its room, held (Bird rights for later) when it's over the cap anyway
    const pay = payroll(F, s, year, { holds: false })
    if (pay < capOf(year) - 5) for (const p of (F.fa ?? []).filter(x => x.fr === s && !x.rn && x.hy === year && !x.rfa)) renounce(F, s, p.i)
  }
  news.push(...salaryDumps(F))
  return news
}
const sumOf = p => r1([p.$ ?? 0, ...(p.sc ?? [])].slice(0, p.y ?? 0).reduce((a, v) => a + v, 0))

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
    if (d === 1) news.push(...openMarket(F))
    news.push(...faRound(F, d))
  }
  return news
}
// what a free agent asks on the open market: { $, y }
export const askOf = (F, p) => { const a = askFor(F, p); return { $: a.$, y: a.y, r: a.$ >= 15 ? 0.05 : 0 } }
function faRound(F, day) {
  const news = []
  const year = capYear(F)
  const R = rngOf(`${F.seed}-${year}-faday-${day}`)
  const S = shortsOf(F)
  const str = Object.fromEntries(S.map(s => [s, teamStrength(F, s)]))
  const ctx = { str, mean: S.reduce((a, s) => a + str[s], 0) / S.length, sit: Object.fromEntries(S.map(s => [s, situationOf(F, s)])) }
  // (the GM's sheets from last round that it never answered: matched, if it can)
  for (const q of [...(F.rfq ?? [])]) news.push(...(matchSheet(F, F.team, q.i, true).news ?? []))
  F.rfq = []
  const pool = () => (F.fa ?? []).filter(p => p.b == null || true)
  // the offers: the best men first, each team a few a day
  const offers = {}
  const add = (i, o) => { (offers[i] ??= []).push(o) }
  for (const [id, d] of Object.entries(F.fao ?? {})) {
    const p = (F.fa ?? []).find(x => x.i === +id)
    if (!p) continue
    const c = canSign(F, F.team, p, d)
    if (c.ok) add(p.i, { s: F.team, d: { ...d, via: c.via } })
  }
  const men = [...pool()].sort((a, b) => rankOf(F, a) - rankOf(F, b))
  const busy = Object.fromEntries(S.map(s => [s, 0]))
  const spent = Object.fromEntries(S.map(s => [s, 0]))
  for (const p of men) {
    if ((p.ag ?? 27) >= 38 && day < FA_DAYS) continue
    for (const s of R.shuffle(S)) {
      if (s === F.team || busy[s] >= 3) continue
      // (what it's already offered this round counts against its room)
      if (spent[s] > 0 && payroll(F, s, year) + spent[s] > capOf(year) && busy[s] >= 1 && (p.o ?? 0) < 75) continue
      const st = standardOf(F.teams[s]).length + busy[s]
      if (st >= ROSTER_MAX) continue
      const b = bidFor(F, s, p, day, ctx)
      if (!b) continue
      add(p.i, { s, d: b })
      busy[s]++
      spent[s] += b.$
    }
  }
  // the men decide (the best first, so a team's room goes to the first man who takes it)
  const floor = FLOOR[Math.min(FLOOR.length - 1, day - 1)]
  for (const p of men) {
    const list = (offers[p.i] ?? []).map(o => ({ ...o, u: offerScore(F, p, o.s, o.d, ctx) })).sort((a, b) => b.u - a.u)
    let signed = false
    for (const o of list) {
      if (o.u < floor - 1e-9 && !(day >= FA_DAYS)) break
      // (still legal now that others have signed)
      const c = canSign(F, o.s, p, o.d)
      if (!c.ok) continue
      if (p.rfa && p.fr && p.fr !== o.s && !p.rn) {
        // an offer sheet: his old team matches or lets him go
        if (p.fr === F.team) { (F.rfq ??= []).push({ i: p.i, s: o.s, d: o.d }); signed = true; news.push({ k: 'sheet', tag: 'OFFER SHEET', s: o.s, text: `${p.n} has signed an offer sheet with the ${o.s}: ${o.d.y} years, ${money(sumOf({ $: o.d.$, y: o.d.y, sc: schedOf(o.d).slice(1) }))}. The ${p.fr} have the right to match.` }); break }
        if (aiMatches(F, p.fr, p, o.d)) {
          const was = p.fr
          if (signMan(F, was, p, { $: o.d.$, y: o.d.y, r: Math.min(o.d.r ?? 0, raiseMax(rightsOf(p, was))) }).ok) {
            news.push({ k: 'sign', tag: 'MATCHED', s: was, text: `The ${was} have matched the ${o.s}' offer sheet for ${p.n}: ${o.d.y} years, ${money(sumOf(p))}.` })
            signed = true
            break
          }
        }
      }
      const r = signMan(F, o.s, p, o.d)
      if (!r.ok) continue
      if (o.s === F.team) delete F.fao?.[p.i]
      if ((p.o ?? 0) >= 76 || sumOf(p) >= 30) news.push({ k: 'sign', tag: 'FREE AGENCY', s: o.s, text: `${p.n} has agreed to a ${p.y}-year, ${money(sumOf(p))} deal with the ${o.s}${o.d.via === 'mle' || o.d.via === 'tmle' || o.d.via === 'rmle' ? ', using the mid-level exception' : o.d.via === 'bird' ? ', re-signing with Bird rights' : ''}.` })
      signed = true
      break
    }
    // the last day: an unsigned RFA takes his qualifying offer
    if (!signed && day >= FA_DAYS && p.rfa && p.qo && p.fr && !p.rn) {
      const d = { $: p.qo, y: 1, r: 0 }, was = p.fr
      if (signMan(F, was, p, d).ok) { delete p.rfa; news.push({ k: 'sign', tag: 'QUALIFYING OFFER', s: was, text: `${p.n} signs his qualifying offer with the ${was} and will be an unrestricted free agent next summer` }) }
    }
  }
  // (the GM's offers are for one round)
  F.fao = Object.fromEntries(Object.entries(F.fao ?? {}).filter(([id]) => (F.fa ?? []).some(x => x.i === +id)))
  return news
}
// an AI team matching an offer sheet: he's worth it, and it'll pay it under the line it keeps its own men to
function aiMatches(F, s, p, d) {
  const year = capYear(F)
  const w = worthOf(F, p, year)
  const tol = taxTolerance(F, s)
  const after = payroll(F, s, year) - holdOf(p, year) + d.$
  const young = (p.ag ?? 27) <= 25
  return w >= d.$ * (young ? 0.85 : 0.95) && after + reserveOf(F, s, 1) <= Math.min(lineOf(tol.keep, year), hardCapOf(F, s, year)) && canSign(F, s, p, { $: d.$, y: d.y, r: Math.min(d.r ?? 0, raiseMax(rightsOf(p, s))) }).ok
}
// what a team keeps clear for the minimum deals it still needs to reach 14 (a hard-capped team can't go past its line
// to fill its roster)
export function reserveOf(F, s, adding = 0) {
  // (the league's teams to 15: core's camp fills them there)
  const need = Math.max(0, (s === F.team ? 14 : 15) - standardOf(F.teams[s]).length - adding)
  return need * minOf(0, capYear(F))
}

// ── The GM's moves ───────────────────────────────────────────────────────────
// an offer (or an offer sheet to an RFA) for the next round: { ok, why }
export function placeOffer(F, id, d) {
  const p = (F.fa ?? []).find(x => x.i === id)
  if (!p) return { ok: false, why: 'He has signed elsewhere' }
  const c = canSign(F, F.team, p, d)
  if (!c.ok) return c
  F.fao = { ...(F.fao ?? {}), [id]: { $: r1(d.$), y: d.y, r: d.r ?? 0 } }
  return { ok: true, via: c.via }
}
export const offerSheet = (F, man, d) => placeOffer(F, man.i ?? man, d)
export function pullOffer(F, id) { if (F.fao?.[id]) { const n = { ...F.fao }; delete n[id]; F.fao = n } }
// the GM's team matches (or not) an offer sheet its RFA signed
export function matchSheet(F, short, man, yes) {
  const id = man?.i ?? man
  const q = (F.rfq ?? []).find(x => x.i === id)
  const p = (F.fa ?? []).find(x => x.i === id)
  F.rfq = (F.rfq ?? []).filter(x => x.i !== id)
  if (!q || !p) return { ok: false, why: 'No offer sheet' }
  if (yes) {
    const c = canSign(F, short, p, q.d)
    if (c.ok) { signMan(F, short, p, q.d); return { ok: true, matched: true, news: [{ k: 'sign', tag: 'MATCHED', s: short, text: `The ${short} have matched the ${q.s}' offer sheet for ${p.n}` }] } }
  }
  // (not matched, or it can't: he goes to the team that signed him to the sheet)
  delete p.rfa
  const r = signMan(F, q.s, p, q.d, { check: false })
  return { ok: r.ok, matched: false, news: [{ k: 'sign', tag: 'FREE AGENCY', s: q.s, text: `The ${short} decline to match. ${p.n} joins the ${q.s}` }] }
}
// the board: the best men still out there
export const faBoard = (F, n = 30) => [...(F.fa ?? [])].sort((a, b) => rankOf(F, a) - rankOf(F, b)).slice(0, n)
export const faDone = F => faDayOf(F) >= FA_DAYS

// ── The rest of the summer for the league's teams ────────────────────────────
// make(F, short, { tw }) -> Man: core's maker of a new man when the pool runs dry (optional)
export function cpuOffseason(F, { make = null } = {}) {
  const news = []
  while (!faDone(F)) news.push(...faDay(F, faDayOf(F) + 1))
  news.push(...summerTrades(F, 3))
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
    // fill to 14 (a few teams carry 15): the best men left, at the minimum
    const want = 14 + (hash(`${F.seed}-${s}-${year}`) % 3 === 0 ? 1 : 0)
    let guard = 0
    while (standardOf(team).length < want && guard++ < 20) {
      const p = [...(F.fa ?? [])].filter(x => (x.ag ?? 27) <= 36).sort((a, b) => rankOf(F, a) - rankOf(F, b)).find(x => canSign(F, s, x, { $: minOf(x.ys ?? 0, year), y: 1 }).ok)
      if (p) { signMan(F, s, p, { $: minOf(p.ys ?? 0, year), y: 1, r: 0, ng: 1 }); continue }
      if (!make) break
      const m = make(F, s, { tw: false })
      if (!m || !signMan(F, s, m, { $: minOf(m.ys ?? 0, year), y: 1, r: 0, ng: 1 }).ok) break
    }
    // two-ways: two or three young men
    const tw = 2 + (hash(`${F.seed}-${s}-tw-${year}`) % 2)
    guard = 0
    while (twoWaysOf(team).length < tw && guard++ < 6) {
      const p = [...(F.fa ?? [])].filter(x => (x.ys ?? 0) <= 4 && (x.ag ?? 27) <= 26).sort((a, b) => rankOf(F, a) - rankOf(F, b))[0]
      const d = { $: twoWayOf(year), y: 1 + (R.u() < 0.5 ? 1 : 0), r: 0, tw: 1 }
      if (p && canSign(F, s, p, d).ok) { signMan(F, s, p, { ...d, sc: Array(d.y).fill(twoWayOf(year)) }); continue }
      if (!make) break
      const m = make(F, s, { tw: true })
      if (!m) break
      if (!signMan(F, s, m, { ...d, sc: Array(d.y).fill(twoWayOf(year)) }).ok) break
    }
    news.push(...cpuExtensions(F, s))
  }
  // (the pool's rights and holds are spent with the summer)
  for (const p of F.fa ?? []) { delete p.fr; delete p.hy; delete p.rfa; delete p.qo; delete p.rsl; delete p.ask }
  F.fao = {}
  F.rfq = []
  return news
}
// the summer's last calls: a good player still out there signs a one-year minimum with a team he'd play for (a
// contender or a team in the mix), which waives the last man on its bench to make room if it has to
function lateSignings(F) {
  const news = []
  const year = capYear(F)
  const S = shortsOf(F).filter(s => s !== F.team && situationOf(F, s) !== 'reb')
  const left = [...(F.fa ?? [])].filter(p => (p.ag ?? 30) <= 37 && rankOf(F, p) <= 300).sort((a, b) => rankOf(F, a) - rankOf(F, b))
  const used = new Set()
  for (const p of left) {
    const d = { $: minOf(p.ys ?? 0, year), y: 1, r: 0 }
    const fit = S.filter(s => !used.has(s) && roleOn(F, s, p) >= 0.5).sort((a, b) => teamStrength(F, b) - teamStrength(F, a))
    for (const s of fit) {
      const team = F.teams[s]
      if (standardOf(team).length >= ROSTER_MAX) {
        const low = standardOf(team).filter(x => x.b == null && (x.o ?? 0) < (p.o ?? 0) - 4).sort((a, b) => cutCost(F, a).total - cutCost(F, b).total || (a.o ?? 0) - (b.o ?? 0))[0]
        if (!low || cutCost(F, low).total > 3) continue
        cutMan(F, s, low.i)
      }
      if (!signMan(F, s, p, d).ok) continue
      used.add(s)
      if ((p.o ?? 0) >= 78) news.push({ k: 'sign', tag: 'FREE AGENCY', s, text: `${p.n} has agreed to a one-year, ${money(d.$)} deal with the ${s}` })
      break
    }
  }
  return news
}
// a league team extends the men it wants to keep (a rookie-scale man going into his fourth season, a veteran a year
// from free agency), when the price is one it will pay
export function cpuExtensions(F, s) {
  const news = []
  const year = capYear(F)
  for (const p of F.teams[s].r) {
    if (p.tw || p.y !== 1) continue
    // (the men a front office locks up early: a rookie-scale man who's become a starter, a veteran still in his prime
    // who's one of its best)
    const rk = rankOf(F, p)
    if (p.rs ? rk > 110 : rk > 70 || (p.ag ?? 30) >= 31) continue
    const ask = extensionAsk(F, s, p)
    if (!ask) continue
    const w = worthOf(F, { ...p, ag: (p.ag ?? 25) + 1 }, year + 1)
    const role = roleOn(F, s, p)
    if (role < 1 || w < ask.$ * 0.95) continue
    const tol = taxTolerance(F, s)
    if (payroll(F, s, year + 1) + ask.$ > lineOf(tol.keep, year + 1)) continue
    const r = extendMan(F, s, p, ask)
    if (r.ok && (p.o ?? 0) >= 78) news.push({ k: 'ext', tag: 'EXTENSION', s, text: `${p.n} has agreed to a ${ask.y}-year, ${money(schedOf(ask).reduce((a, v) => a + v, 0))} extension with the ${s}.` })
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
      const p = [...(F.fa ?? [])].sort((a, b) => rankOf(F, a) - rankOf(F, b)).find(x => canSign(F, s, x, { $: minOf(x.ys ?? 0, year), y: 1 }).ok)
      if (p) { signMan(F, s, p, { $: minOf(p.ys ?? 0, year), y: 1, r: 0, ng: 1 }); continue }
      const m = make?.(F, s, { tw: false })
      if (!m || !signMan(F, s, m, { $: minOf(m.ys ?? 0, year), y: 1, r: 0, ng: 1 }).ok) break
    }
  }
}
