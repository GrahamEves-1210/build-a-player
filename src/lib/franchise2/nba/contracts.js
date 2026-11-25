// NBA FRANCHISE: contracts (the 2023 CBA). Pure functions on F (STATE.md's shape).
//
// A MAN'S DEAL (the Man fields this file owns)
//   $  salary this season ($M) · y seasons left incl. this one · sc [$M the seasons after] (y - 1 long)
//   opt { k: 'P' player option | 'T' team option | 'E' early termination, yr: the season it's on }
//   rs 1 on a rookie-scale deal · rfa 1 restricted when it ends · tw 1 two-way · ntc 1 no-trade clause
//   bird seasons with this team (Bird rights: 3+ full, 2 Early Bird, 0-1 Non-Bird; a trade keeps them)
//   sgn the league year he signed · sgd the day he signed (-1 in the offseason) · ys years of service
//   mh 1 a one-year minimum for a veteran (counts at the two-year minimum) · ng 1 non-guaranteed (no dead money
//   if he's waived before January) · ext the league year he signed an extension
//   (in F.fa, as a free agent:) fr the team he left · hy the league year its cap hold is for · $l his last salary
//   rsl 1 his rookie deal just ended · qo his qualifying offer (an RFA) · rn 1 renounced (no hold, no rights)
//   qot 1 the GM's team tendered his qualifying offer (the GM's own RFA stays restricted; untendered he walks)
//   dco $M the rookie-scale option his team declined: it can't pay him more than that to bring him back
//   wvb { s, t, to } waived by team s at time t (timeOf): s can't sign him again until a year on, or his old deal's end
//   osm { s, y } his offer sheet from team s was matched in league year y: no trade for a year (none to s)
//   osh { s, d } an offer sheet the GM's team signed him to, waiting on his team's answer (the next day)
//
// THE MARKET (marketOf): what a man would get in free agency, by where he ranks in the league (his OVR, the growth a
// young man has left, the decline an older one has started), on the real league's pay ladder: the top 12 men at the
// max, the 40th about 25% of the cap, the 90th 15%, the 180th about 7%, everyone past the 300th the minimum. A man is
// never paid past the max for his years of service, nor under his minimum. This reads the league as it is, so it
// holds whatever OVR scale the league plays on.
//
// THE SEASON'S END (seasonEndDeals, at the start of re-signing): player and team options for next season are
// decided, every deal ticks a year, years of service and Bird years go up, and the men whose deals are up go to the
// free-agent pool with their cap holds, rights and RFA qualifying offers.
import { rngOf, clamp, r1 } from '../rng'
import { fixNumbers } from './numbers'
import { extensionText, teamWords } from './news'
import { realDeal } from './league'
import {
  capOf, taxOf, apron1Of, apron2Of, minOf, maxOf, maxPct, twoWayOf, rookieScale, excOf, excYears, indexed,
  payroll, capPayroll, capSheet, capYear, standardOf, twoWaysOf, holdOf, hitOf, hardCapOf, overOf, EXC_TEXT,
} from './cap'

const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const shortsOf = F => Object.keys(F?.teams ?? {})
export const allMen = F => [...shortsOf(F).flatMap(s => F.teams[s].r.map(p => [s, p])), ...(F.fa ?? []).map(p => [null, p])]
export const teamOf = (F, id) => shortsOf(F).find(s => F.teams[s].r.some(p => p.i === id)) ?? null
export const findMan = (F, id) => { for (const s of shortsOf(F)) { const p = F.teams[s].r.find(x => x.i === id); if (p) return p } return (F.fa ?? []).find(p => p.i === id) ?? null }
// (the day in the season: core's index; -1 in the offseason)
export const dayOf = F => (F?.phase === 'season' ? F.day ?? 0 : F?.phase === 'off' ? -1 : (F?.days ?? 170))

// ── Rosters ──────────────────────────────────────────────────────────────────
// 15 standard deals and 3 two-way deals in the season, 14 standard at least (the CBA's minimum); 21 men in the
// offseason, two-ways in
export const ROSTER_MAX = 15, ROSTER_MIN = 14, TWO_WAY_MAX = 3, OFF_MAX = 21
// { season: true } judges an offseason roster by the season's rules (camp: is it ready for opening night)
export function legalRoster(F, short, { min = ROSTER_MIN, season = F?.phase !== 'off' } = {}) {
  const team = F.teams?.[short]
  if (!team) return { ok: false, why: 'No such team' }
  const st = standardOf(team).length, tw = twoWaysOf(team).length
  if (tw > TWO_WAY_MAX) return { ok: false, why: `${tw} two-way players (3 at most)`, st, tw }
  if (!season) {
    if (st + tw > OFF_MAX) return { ok: false, why: `${st + tw} players in the offseason (21 at most)`, st, tw }
  } else {
    if (st > ROSTER_MAX) return { ok: false, why: `${st} standard contracts (15 at most)`, st, tw }
    if (st < min) return { ok: false, why: `${st} standard contracts (${min} at least)`, st, tw }
  }
  // (the hard cap, less the minimum deals that brought the roster to 14: the roster minimum comes first, canSign)
  const hc = hardCapOf(F, short)
  if (payroll(F, short) - fillSlack(F, team) > hc + 0.05 && !(F.noCap && short === F.team)) return { ok: false, why: 'Over its hard cap', st, tw }
  return { ok: true, st, tw }
}
// the cap hits of the minimum deals a roster needed to reach 14 (its two cheapest, when it carries no more than 14)
function fillSlack(F, team) {
  const year = capYear(F)
  const std = standardOf(team)
  if (std.length > ROSTER_MIN) return 0
  const mins = std.filter(p => (p.$ ?? 0) <= minOf(p.ys ?? 0, year) + 0.05).map(p => hitOf(p, year, year)).sort((a, b) => a - b)
  return mins.slice(0, 2).reduce((a, v) => a + v, 0)
}
export const openSpots = (F, short) => (F.phase === 'off' ? Math.max(0, ROSTER_MAX - standardOf(F.teams[short]).length) : ROSTER_MAX - standardOf(F.teams[short]).length)

// ── The market ───────────────────────────────────────────────────────────────
// where he'll be next season, as a front office sees it (his OVR, the growth left in a young man, the slide in an
// older one; a big man slides sooner)
export function scoreOf(p) {
  const o = p.o ?? 60, ag = p.ag ?? 27
  const up = ag <= 24 ? clamp(0, 6, ((p.pk ?? o) - o) * (ag <= 21 ? 0.4 : ag <= 23 ? 0.3 : 0.2)) : 0
  // (the market pays for what a man is now: a 34-year-old who's still a top-ten player gets paid like one, for fewer years)
  const old = ag >= 32 ? (ag - 31) * (p.g === 'big' ? 1.0 : 0.8) : 0
  return o + up - old
}
// the pay ladder: [rank (of 450 men), share of the cap]
// (about 40 men a season end up on deals worth 25% of the cap or more, as in the real league)
const LADDER = [[1, 0.37], [8, 0.36], [16, 0.35], [25, 0.32], [35, 0.29], [45, 0.26], [60, 0.225], [90, 0.165],
  [130, 0.115], [180, 0.074], [240, 0.044], [300, 0.024], [360, 0.013], [450, 0.008]]
// what he'd be worth with no max (the trade value's measure): the top of the league is worth far more than the max
const WORTH = [[1, 0.62], [3, 0.52], [6, 0.45], [12, 0.38], [25, 0.3], [40, 0.25], [60, 0.205], [90, 0.15], [130, 0.105],
  [180, 0.068], [240, 0.04], [300, 0.021], [360, 0.012], [450, 0.008]]
function ladder(tab, r) {
  if (r <= tab[0][0]) return tab[0][1]
  for (let i = 1; i < tab.length; i++) {
    const [r1_, v1] = tab[i - 1], [r2, v2] = tab[i]
    if (r <= r2) return v1 + (v2 - v1) * (r - r1_) / (r2 - r1_)
  }
  return tab[tab.length - 1][1]
}
const MK = new WeakMap()
// the market's version: the league year, the phase, the summer's stop, whether the deals have ticked over, how many
// men the league holds (a draft, a camp fill, a retirement change it; a trade or a signing moves men without changing
// anyone's place) and VER, a counter anything that changes a man's rating mid-stop can bump (marketChanged). Read
// off F alone, so the same league always gives the same market (no clocks: the same seed plays out the same way).
let VER = 0
export const marketChanged = () => { VER++ }
// { [id]: { sc: score, rk: rank (scaled to 450 men) } } for every man in the league (rosters and the pool)
export function marketOf(F) {
  // (checked on every read without building a list or a string: this is read for every man in every trade the league
  // weighs)
  const c = MK.get(F.teams ?? F)   // (keyed by the league's teams: a trade's look-ahead hands in a copy of F)
  // (the men on rosters and the men on the street, each counted: the ladder's length is the rostered men and the
  // street's best hundred and fifty, so a signing off a long street changes every rank a little. Both are in the
  // version, so the market is the same whenever it's first read, in a save loaded again too)
  const street = (F.fa ?? []).length
  let count = street
  for (const s in F.teams ?? {}) count += F.teams[s].r.length
  if (c && c.n === count && c.fa === street && c.y === F.year && c.ph === F.phase && c.st === F.off?.step && c.sed === F.sed && c.v === VER) return c.m
  const men = allMen(F)
  const sc = men.map(([, p]) => [p.i, scoreOf(p)]).sort((a, b) => b[1] - a[1] || a[0] - b[0])
  // (the ladder is as long as the league: its rostered men and the street's best hundred and fifty; any more on the
  // street fall past the end of it)
  const n = men.filter(([s]) => s).length + Math.min(150, (F.fa ?? []).length)
  const k = 450 / Math.max(300, n)
  const m = {}
  sc.forEach(([i, s], j) => { m[i] = { sc: s, rk: 1 + j * k } })
  MK.set(F.teams ?? F, { m, desc: sc.map(x => x[1]), k, n: count, fa: street, y: F.year, ph: F.phase, st: F.off?.step, sed: F.sed, v: VER })
  return m
}
export const rankOf = (F, p) => marketOf(F)[p.i]?.rk ?? 300
// the rank a man of this score would have in the league now
export function rankAt(F, score) {
  marketOf(F)
  const { desc, k } = MK.get(F.teams ?? F)
  let lo = 0, hi = desc.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (desc[mid] > score) lo = mid + 1; else hi = mid }
  return 1 + lo * k
}
export const worthAt = (F, rk, year = capYear(F)) => ladder(WORTH, rk) * capOf(year)
// his price on the open market for the league year being signed in ($M a year)
export function marketValue(F, p, year = capYear(F)) {
  const rk = rankOf(F, p)
  const ys = p.ys ?? 0
  const v = ladder(LADDER, rk) * capOf(year)
  return r1(clamp(minOf(ys, year), maxOf(ys, year, { superMax: superMaxOk(F, p) }), v))
}
// what he's worth to a team with no max in the way ($M a year)
export const worthOf = (F, p, year = capYear(F)) => r1(Math.max(minOf(p.ys ?? 0, year), ladder(WORTH, rankOf(F, p)) * capOf(year)))
// how long he'd sign for, by his age and where he ranks (rk: his place on the league's ladder): a young man the
// longest he can; a good player in his prime four years; the real league's stars keep getting three and four years into
// their thirties (Siakam 4 at 30, George 4 at 34, Thompson and DeRozan 3 at 34, LeBron 2 at 39), a role player past 30
// one or two. With no rank (the setup's estimates), the older table.
export function termFor(p, rk = null) {
  const ag = p.ag ?? 27
  if (rk == null) return ag <= 26 ? 4 : ag <= 29 ? 3 : ag <= 32 ? 2 : 1
  if (ag <= 24) return rk <= 260 ? 4 : 2
  if (ag <= 29) return rk <= 60 ? 4 : rk <= 160 ? 3 : 2
  if (ag <= 32) return rk <= 60 ? (ag <= 31 ? 4 : 3) : rk <= 150 ? 3 : rk <= 250 ? 2 : 1
  if (ag <= 34) return rk <= 60 ? 3 : rk <= 150 ? 2 : 1
  return rk <= 60 ? 2 : 1
}
export const termOf = (F, p) => termFor(p, rankOf(F, p))

// ── Who qualifies for the supermax (Designated Veteran) ───────────────────────
// 7-9 years of service, with the team that drafted him (or traded for him on his rookie deal), and All-NBA or the DPOY
// last season or in two of the last three, or the MVP in any of the last three (the CBA's rule)
export function superMaxOk(F, p, short = null) {
  const ys = p.ys ?? 0
  if (ys < 7 || ys > 9) return false
  const s = short ?? p.fr ?? teamOf(F, p.i)
  if (!s || !(p.dr?.[3] === s || p.rt === s)) return false
  // (the last season with its awards in: the one just played in the summer, the one before during a season)
  const aw = p.aw ?? [], last = F.phase === 'off' ? F.year : F.year - 1
  const in3 = a => a.y <= last && a.y >= last - 2
  if (aw.some(a => in3(a) && a.k === 'MVP')) return true
  if (aw.some(a => a.y === last && HONORS.includes(a.k))) return true
  return new Set(aw.filter(a => in3(a) && HONORS.includes(a.k)).map(a => a.y)).size >= 2
}
const HONORS = ['DPOY', 'ALL1', 'ALL2', 'ALL3']
// the Rose rule: a man finishing his rookie deal who made All-NBA (or won the MVP) can extend at 30%
const roseOk = p => (p.aw ?? []).some(a => ['MVP', 'ALL1', 'ALL2', 'ALL3'].includes(a.k))

// ── Building a deal ──────────────────────────────────────────────────────────
// a deal: { $ first-season salary, y seasons, r raise a season (share of the first salary), opt?, tw?, via? }
// sched(deal): every season's salary
export const schedOf = d => Array.from({ length: d.y }, (_, k) => r1(d.$ * (1 + (d.r ?? 0) * k)))
// the raise a deal may carry: 8% with Bird or Early Bird rights, 5% for everyone else
export const raiseMax = via => (via === 'bird' || via === 'ebird' ? 0.08 : 0.05)
// put a deal on a man (no roster or cap checks: signMan does those)
export function putDeal(F, p, d, { year = capYear(F) } = {}) {
  const s = d.sc ?? schedOf(d)
  p.$ = s[0]
  p.y = s.length
  p.sc = s.slice(1)
  if (d.opt) p.opt = { ...d.opt }; else delete p.opt
  if (d.tw) p.tw = 1; else delete p.tw
  if (d.rs) p.rs = 1; else delete p.rs
  if (d.ng) p.ng = 1; else delete p.ng
  if (d.mh || (s.length === 1 && s[0] <= minOf(p.ys ?? 0, year) + 0.01 && (p.ys ?? 0) >= 3)) p.mh = 1; else delete p.mh
  // (he's restricted when it ends: a rookie-scale first-rounder, or a man with three years or less by then)
  if (d.rs || d.tw || (p.ys ?? 0) + s.length <= 3) p.rfa = 1; else delete p.rfa
  p.sgn = year
  p.sgd = dayOf(F)
  for (const k of ['fr', 'was', 'hy', '$l', 'rsl', 'qo', 'qtw', 'rn', 'ask', 'fx', 'wv', 'qot', 'dco', 'wvb', 'osm', 'osh']) delete p[k]
  return p
}

// ── Starting deals (setup) ───────────────────────────────────────────────────
// realRow { s: team, $, sc: [$M the seasons after], opt?, rs?, ng?, sg: league year signed, x: extension's league
// year, b: Bird years, rt } when the data has his real deal (data/nba-contracts.js, through league.js); { s, min: 1 }
// a made-up man on the minimum; otherwise an estimate: a young first-rounder on his rookie scale (by his draft slot,
// or the slot his rating would have gone), a second-rounder or an undrafted man on the minimum, a veteran at about
// his market price when he signed, with a few years left on it.
// dealOnLoad(F, man, short | realRow): core calls it for every rostered man at setup, and at camp for the made-up
// men it adds (no deal yet). At camp a man gets what a camp body signs for: the minimum, or a two-way deal.
export function dealOnLoad(F, p, x = null) {
  loadOnce(F, p, typeof x === 'string' ? x : x?.s ?? null)
  dealOne(F, p, x)
  runPending()
  return p
}
function dealOne(F, p, x) {
  const realRow = x && typeof x === 'object' ? x : null
  const year = capYear(F)
  const R = rngOf(`${F.seed}-deal-${p.i}-${p.n}`)
  if (p.tw) {
    p.bird = p.bird ?? 0
    putDeal(F, p, { sc: [twoWayOf(year), ...(R.u() < 0.5 ? [twoWayOf(year + 1)] : [])], tw: 1 }, { year })
    p.sgn = F.phase === 'off' ? year : year - 1
    return p
  }
  if (F.phase === 'off') {
    p.bird = 0
    putDeal(F, p, { $: minOf(p.ys ?? 0, year), y: 1, ng: 1 }, { year })
    return p
  }
  estimate(F, p, realRow, year, R)
  return p
}
function estimate(F, p, realRow, year, R) {
  p.bird = p.bird ?? (realRow ? realRow.b ?? 0 : Math.min(4, Math.max(0, Math.floor(R.u() * Math.min(5, (p.ys ?? 0) + 1)))))
  if (realRow && realRow.$ > 0) {
    // (his real deal: the money by season, the option on it, his Bird years with the team, the year he signed)
    const sc = realRow.sc ? [realRow.$, ...realRow.sc] : schedOf({ $: realRow.$, y: realRow.y ?? 1, r: 0.05 })
    putDeal(F, p, { sc: sc.map(v => Math.round(v * 100) / 100), opt: realRow.opt && realRow.opt.yr > year && realRow.opt.yr < year + sc.length ? realRow.opt : null, rs: realRow.rs, ng: realRow.ng }, { year })
    p.bird = realRow.b ?? p.bird
    // (Bird years are seasons under contract with the team, a season lost to injury included: a man on his own
    // team's books since before this league year has at least the seasons since he signed, whatever he played)
    if (realRow.sg != null && realRow.sg < year && realDeal(p.n)?.t === realRow.s) p.bird = Math.max(p.bird ?? 0, year - realRow.sg)
    p.sgn = realRow.sg ?? (realRow.rs && p.dr ? p.dr[0] : year - Math.max(1, Math.min(4, (realRow.ago ?? 1))))
    p.sgd = -1
    if (realRow.x != null) p.ext = realRow.x
    if (realRow.rt) p.rt = realRow.rt
    else if (realRow.rs && p.dr) p.rt = p.dr[3]
    p.real = 1
    return p
  }
  if (realRow?.min) {
    // (a made-up man on a real roster: the end of the bench, on the minimum)
    p.bird = 0
    putDeal(F, p, { $: minOf(p.ys ?? 0, year), y: 1 }, { year })
    p.sgn = year
    p.sgd = -1
    return p
  }
  const ys = p.ys ?? Math.max(0, (p.ag ?? 25) - 21)
  p.ys = ys
  const rd = p.dr?.[1], slot = p.dr?.[2]
  // a rookie-scale first-rounder in his first four seasons
  const young = ys <= 3 && (p.ag ?? 30) <= 25
  const rankNow = rankOf(F, p)
  const guessSlot = clamp(1, 30, Math.round(rankNow / 6))
  if (young && (rd === 1 || (rd == null && rankNow <= 250))) {
    const pick = rd === 1 ? slot : guessSlot
    const sc = rookieScale(pick, year - ys)
    const left = sc.slice(ys)
    p.bird = ys
    putDeal(F, p, { sc: left, rs: 1, opt: ys <= 2 ? { k: 'T', yr: year - ys + 3 } : null }, { year })
    p.sgn = year - ys
    p.sgd = -1
    p.rt = p.dr?.[3] ?? null
    if (!p.dr) delete p.rt
    return p
  }
  if (ys <= 2 && rankNow > 260) {
    // (a second-rounder or an undrafted man: the minimum, two seasons, the second non-guaranteed)
    putDeal(F, p, { $: minOf(ys, year), y: 1 + (R.u() < 0.6 ? 1 : 0), r: 0.0, ng: R.u() < 0.5 ? 1 : 0 }, { year })
    p.sc = p.sc.map((_, k) => minOf(ys + k + 1, year + k + 1))
    p.sgn = year - 1
    p.sgd = -1
    return p
  }
  // a veteran: signed a year or three ago, at about his market then (some overpaid, some bargains)
  const total = clamp(1, 5, termFor({ ag: p.ag - 1 }) + (rankNow <= 60 ? 1 : 0) + (R.u() < 0.3 ? 1 : 0))
  // (signed at least a season ago: a man signed this summer couldn't be traded until December)
  const ago = total <= 1 ? 1 : 1 + Math.floor(R.u() * (total - 1))
  const left = Math.max(1, total - ago + (total <= 1 ? 1 : 0))
  const mv = marketValue(F, p, year)
  const noise = clamp(0.6, 1.45, 1 + R.n() * 0.18 + (p.ag >= 31 ? 0.12 : 0))
  let first = clamp(minOf(ys, year), maxOf(ys, year), mv * noise / Math.pow(1.05, ago))
  // (the stars: the max for their service)
  if (rankNow <= 14) first = maxOf(ys - ago, year - ago) * (1 + 0.03 * ago)
  const r = first >= 20 ? 0.08 : 0.05
  const full = schedOf({ $: first, y: ago + left, r })
  putDeal(F, p, { sc: full.slice(ago) }, { year })
  p.sgn = year - ago
  p.sgd = -1
  // (an option on the last season: the good ones a player option, the odd one a team option)
  if (left >= 2 && R.u() < (rankNow <= 80 ? 0.3 : 0.12)) p.opt = { k: rankNow <= 120 ? 'P' : 'T', yr: year + left - 1 }
  if (rankNow <= 20 && (p.ys ?? 0) >= 10 && R.u() < 0.25) p.ntc = 1
  return p
}
// (core calls dealOnLoad one man at a time; once the last rostered man has his deal, the league's estimates are
// pulled into the real range together: normalize)
function loadOnce(F, p, x) {
  const S = shortsOf(F)
  const last = S[S.length - 1], t = F.teams[last]
  if (typeof x === 'string' && x === last && t?.r[t.r.length - 1] === p && !F.dlo) { F.dlo = 1; queueMicro(() => normalize(F)) }
}
// (the normalize waits for this man's own deal to be on him: it runs right after, in the same call)
let PENDING = null
const queueMicro = fn => { PENDING = fn }
const runPending = () => { const fn = PENDING; PENDING = null; fn?.() }
// every man at setup in one call (the checks use it; core may too): deals, then the league's range, then exceptions
export function dealsOnLoad(F, real = null) {
  F.dlo = 1
  for (const [, p] of allMen(F)) if (p.y == null || p.$ == null) { const row = real?.(p) ?? null; dealOnLoad(F, p, row) }
  normalize(F)
  return F
}
function normalize(F) {
  // (a team on its real deals is left as it is: its payroll is the real one; the made-up men on it hold the deals of
  // the real men the game doesn't carry, or the minimum)
  const est = new Set(allMen(F).filter(([s, p]) => s && !p.real && !F.teams[s].r.some(x => x.real)).map(([, p]) => p.i))
  // (the estimates are pulled into the real league's range, team by team: the CBA kept every real payroll between
  // about the salary floor and a few million past the second apron, so a team the estimates put far outside it has
  // its veterans' estimated deals scaled in)
  const year = F.year
  // (the best few rosters may sit past the second apron, as the real league's do; the next six past the first; the
  // rest by the tax line)
  const byStr = [...shortsOf(F)].sort((a, b) => teamStrength(F, b) - teamStrength(F, a))
  for (const s of shortsOf(F)) {
    const t = F.teams[s]
    const at = byStr.indexOf(s)
    const hi = at < 3 ? apron2Of(year) + 4 : at < 9 ? apron1Of(year) + 2 : taxOf(year) + 2
    const vets = t.r.filter(p => est.has(p.i) && !p.rs && !p.tw && p.$ > minOf(p.ys ?? 0, year) + 0.5 && rankOf(F, p) > 25)
    for (let k = 0; k < 6; k++) {
      const pay = payroll(F, s, year)
      const lo = capOf(year) * 0.93
      const flex = vets.reduce((a, p) => a + p.$, 0)
      if (!flex) break
      const f = pay > hi ? Math.max(0.6, 1 - (pay - hi) / flex) : pay < lo ? Math.min(1.2, 1 + (lo - pay) / flex) : 1
      if (Math.abs(f - 1) < 0.005) break
      for (const p of vets) {
        const mx = Math.min(maxOf(p.ys ?? 0, year), f > 1 ? marketValue(F, p, year) * 1.3 : Infinity), mn = minOf(p.ys ?? 0, year)
        if (f > 1 && p.$ >= mx) continue
        p.$ = r1(clamp(mn, mx * 1.05, p.$ * f))
        p.sc = (p.sc ?? []).map(v => r1(clamp(mn, mx * 1.4, v * f)))
      }
    }
  }
  for (const s of shortsOf(F)) { const t = F.teams[s]; t.dead ??= []; excFor(F, s) }
}

// ── Exceptions ───────────────────────────────────────────────────────────────
// team.exc = { yr, mk: the MLE it's using ('room'|'nt'|'tp'|null), mle: $ left of it, bae: $ left, baeY: the league
// year it last used the bi-annual, hc: 'a1'|'a2' a hard cap triggered, room: 1 it went under the cap to sign }
export function excFor(F, short, year = capYear(F)) {
  const t = F.teams[short]
  if (!t.exc || t.exc.yr !== year) t.exc = { yr: year, mk: null, mle: null, bae: excOf('bae', year), baeY: t.exc?.baeY ?? null, hc: null, room: 0 }
  return t.exc
}
// the mid-level exceptions a team could use now, best first: [{ k, $ (what's left of it), y, line (the payroll it
// can't pass using it) }]. A team that used its cap room has the room exception and nothing more; a team that never
// went under the cap has the non-taxpayer MLE below the first apron (it hard-caps the team there) and the taxpayer MLE
// below the second; past the second apron, neither.
const MLE_LINE = { nt: apron1Of, tp: apron2Of, room: apron2Of }
export function mleList(F, short, year = capYear(F)) {
  const e = excFor(F, short, year)
  const L = k => MLE_LINE[k](year)
  if (e.mk) return e.mle > 0.05 ? [{ k: e.mk, $: e.mle, y: excYears(e.mk), line: L(e.mk) }] : []
  if (e.room) return [{ k: 'room', $: excOf('room', year), y: excYears('room'), line: L('room') }]
  return ['nt', 'tp'].map(k => ({ k, $: excOf(k, year), y: excYears(k), line: L(k) }))
}
// the MLE a team can use now and how much of it fits under its line: { k, $, y } or null
export function mleFor(F, short, year = capYear(F)) {
  const pay = payroll(F, short, year)
  for (const m of mleList(F, short, year)) {
    const $ = r1(Math.min(m.$, m.line - pay))
    if ($ >= minOf(0, year)) return { k: m.k, $, y: m.y }
  }
  return null
}

// ── The owner's ceiling (the GM's team) ──────────────────────────────────────
// ownership sets how far the payroll may go, by its market and where the team is: a rebuilding team stops at the tax
// line (the first apron in a big market), a team in the mix at the first apron (the second in a big market), a
// contender at the second apron (a big market's contender a little past it). { $, k, why } (Infinity with no cap)
export const OWNER_LINE_TEXT = { tax: 'the luxury tax line', a1: 'the first apron', a2: 'the second apron', 'a2+': 'just past the second apron' }
export function ownerCap(F, year = capYear(F)) {
  const s = F?.team
  if (!s || F.noCap) return { $: Infinity, k: null, why: null }
  const sit = situationOf(F, s)
  const big = BIG_MARKET.has(s)
  const k = sit === 'reb' ? (big ? 'a1' : 'tax') : sit === 'mid' ? (big ? 'a2' : 'a1') : big ? 'a2+' : 'a2'
  const $ = r1(k === 'a2+' ? apron2Of(year) + capOf(year) * 0.08 : lineOf(k, year))
  return { $, k, sit, why: `Ownership won't take the ${s} payroll past $${$}M (${OWNER_LINE_TEXT[k]}) this league year` }
}

// ── A man his team waived ────────────────────────────────────────────────────
// a point in the league's calendar: the league year x 400, plus the day (the summer, the season's nights, the
// postseason and the draft after them)
export const timeOf = F => capYear(F) * 400 + (F.phase === 'season' ? 20 + (F.day ?? 0) : F.phase === 'off' ? (F.sed === F.year ? 0 : 300) : 250)
// the team that waived him can't sign him again for a year (or until the deal it waived would have run out)
export function waivedBy(F, short, p) {
  const w = p?.wvb
  if (!w || w.s !== short) return false
  return timeOf(F) < w.t + 400 && capYear(F) <= (w.to ?? Infinity)
}
// an offer sheet out on him: the GM's (osh, waiting on his team) or his team's to answer (F.rfq)
export function sheetOf(F, p) {
  if (p?.osh) return { s: p.osh.s, d: p.osh.d, by: p.osh.s, to: p.fr, mine: true }
  const q = (F.rfq ?? []).find(x => x.i === p?.i)
  return q ? { s: q.s, d: q.d, by: q.s, to: p.fr } : null
}

// ── Can a team sign him, and how ─────────────────────────────────────────────
// deal { $, y, r?, opt?, tw?, sheet? (an offer sheet being matched or signed) }. Returns { ok, via: 'room'|'mle'|
// 'tmle'|'rmle'|'bae'|'min'|'bird'|'ebird'|'nbird'|'rookie'|'tw', why, k? ('owner': the owner's ceiling) }
// His own team uses his rights first (a Bird re-signing never spends cap room), then the minimum, then room, then the
// mid-level, then the bi-annual.
export function rightsOf(p, short) {
  if (!p || p.fr !== short || p.rn) return null
  const b = p.bird ?? 0
  return b >= 3 ? 'bird' : b === 2 ? 'ebird' : 'nbird'
}
export const RIGHTS_TEXT = { bird: 'Bird rights', ebird: 'Early Bird rights', nbird: 'Non-Bird rights' }
const VIA_EXC = { nt: 'mle', tp: 'tmle', room: 'rmle' }
const LINE_TEXT = { a1: 'the first apron', a2: 'the second apron' }
// (the GM's team's reasons are read on his screens: its name the way a reporter says it, not its short)
export function canSign(F, short, p, d) {
  const c = canSignOf(F, short, p, d)
  if (!c.ok && c.why && short === F.team) c.why = teamWords(c.why)
  return c
}
function canSignOf(F, short, p, d) {
  const team = F.teams?.[short]
  if (!team || !p || !d) return { ok: false, why: 'Nothing to sign' }
  const year = capYear(F)
  const ys = p.ys ?? 0
  const free = F.noCap && short === F.team
  const st = standardOf(team).filter(x => x.i !== p.i).length, tw = twoWaysOf(team).filter(x => x.i !== p.i).length
  if (waivedBy(F, short, p)) return { ok: false, why: `The ${short} waived him: they can't sign him again until a year has passed` }
  const sh = d.sheet ? null : sheetOf(F, p)
  if (sh) return { ok: false, why: sh.mine ? `He has signed the ${sh.s} offer sheet; the ${sh.to} have a day to match it` : `He has signed an offer sheet with the ${sh.s}: match it or let him go` }
  // two-way: three at most, for a man with four years or less
  if (d.tw) {
    if (tw >= TWO_WAY_MAX) return { ok: false, why: 'All three two-way spots are full' }
    if (ys > 4) return { ok: false, why: 'Two-way deals are for players with four years of service or less' }
    if (F.phase === 'off' && st + tw >= OFF_MAX) return { ok: false, why: 'The offseason roster is full (21)' }
    return { ok: true, via: 'tw' }
  }
  if (F.phase !== 'off' && st >= ROSTER_MAX) return { ok: false, why: 'All 15 standard roster spots are full' }
  if (F.phase === 'off' && st + tw >= OFF_MAX) return { ok: false, why: 'The offseason roster is full (21)' }
  const sc = d.sc ?? schedOf(d)
  const first = sc[0], yrs = sc.length
  const mn = minOf(ys, year)
  if (first < mn - 0.01) return { ok: false, why: `Under the minimum for his years of service ($${mn}M)` }
  const own = rightsOf(p, short)
  const mx = maxOf(ys, year, { superMax: own === 'bird' && superMaxOk(F, p, short), last: own ? p.$l ?? 0 : 0 })
  if (first > mx + 0.01) return { ok: false, why: `Over his max ($${mx}M)` }
  if (yrs > (own === 'bird' ? 5 : 4)) return { ok: false, why: own === 'bird' ? '5 seasons at most' : '4 seasons at most (5 with Bird rights)' }
  const rise = sc.slice(1).some((v, k) => v - sc[k] > first * raiseMax(own) + 0.11)
  if (rise) return { ok: false, why: `Raises are capped at ${Math.round(raiseMax(own) * 100)}% a season` }
  // (a rookie-scale option his team declined: it can't pay him more than the option to bring him back)
  if (own && p.dco && first > p.dco + 0.01) return { ok: false, why: `After declining his option, the ${short} can pay him $${p.dco}M at most` }
  if (free) return { ok: true, via: own ?? 'room' }
  // the salaries (the tax, the aprons, the hard cap, the owner's line: cap holds never count there), and the payroll
  // cap room is counted from (the holds in; his own comes off when he signs)
  const pay = payroll(F, short, year)
  const after = pay + first
  const capPay = capPayroll(F, short, year) - (own ? holdOf(p, year) : 0)
  const isMin = first <= mn + 0.01 && yrs <= 2
  const hc = hardCapOf(F, short, year)
  // THE ROSTER MINIMUM COMES FIRST. A hard cap can't leave a team unable to field 14 men: a deal under one (or one
  // whose exception brings one) has to leave room for the minimum deals the roster still needs (`need`); and a
  // minimum deal for a roster under 14 always goes, whatever the line (legalRoster allows for it).
  const need = Math.max(0, ROSTER_MIN - (st + 1)) * minOf(2, year)
  const fills = isMin && st < ROSTER_MIN
  if (!fills && after > hc + 0.01) return { ok: false, why: `It would put the ${short} over ${LINE_TEXT[team.exc?.hc] ?? 'their hard cap'} ($${r1(hc)}M), their hard cap this league year`, k: 'hc' }
  if (!fills && after + need > hc + 0.01) return { ok: false, why: `It would leave the ${short} no room under ${LINE_TEXT[team.exc?.hc] ?? 'their hard cap'} ($${r1(hc)}M), their hard cap this league year, for the minimum deals a 14-man roster still needs ($${r1(need)}M)`, k: 'hc' }
  // rookies: his scale
  if (d.rs) return { ok: true, via: 'rookie' }
  // the GM's owner: no new money past his ceiling (a minimum deal always goes, and so does keeping one of his own men at
  // the taxpayer mid-level's size or less: owners sign off on a role player; a roster can't go short for $5M)
  const small = (own === 'bird' || own === 'ebird' || own === 'nbird') && first <= excOf('tp', year) + 0.01
  if (short === F.team && !isMin && !small) {
    const o = ownerCap(F, year)
    if (after > o.$ + 0.01) return { ok: false, why: o.why, k: 'owner' }
  }
  // his own man: Bird rights (over the cap, no room spent)
  if (own === 'bird') return { ok: true, via: 'bird' }
  if (own === 'ebird') {
    const lim = Math.max((p.$l ?? 0) * 1.75, indexed(12.5, year) * 1.05)
    if (first <= lim + 0.01 && yrs >= 2) return { ok: true, via: 'ebird' }
  }
  const nbLim = r1(Math.max((p.$l ?? 0) * 1.2, mn * 1.2))
  if (own === 'nbird' && first <= nbLim + 0.01) return { ok: true, via: 'nbird' }
  // the minimum: two seasons at most, over any line
  if (isMin) return { ok: true, via: 'min' }
  // under the cap with room for him
  if (capPay + first <= capOf(year) + 0.01) return { ok: true, via: 'room' }
  // the mid-level (the non-taxpayer MLE hard-caps a team at the first apron, the taxpayer MLE at the second)
  const L = mleList(F, short, year)
  // (the hard cap it brings has to leave room for the minimum deals the roster still needs)
  const under = m => after + (m.k === 'room' ? 0 : need) <= m.line + 0.01
  for (const m of L) if (first <= m.$ + 0.01 && yrs <= m.y && under(m)) return { ok: true, via: VIA_EXC[m.k] }
  // the bi-annual (not two seasons running; not over the first apron; not for a team that used its room)
  const e = excFor(F, short, year)
  if (!e.room && e.bae > 0.05 && first <= e.bae + 0.01 && yrs <= 2 && e.baeY !== year - 1 && after + need <= apron1Of(year) + 0.01 && capPay > capOf(year)) return { ok: true, via: 'bae' }
  // why not. His own team with Non-Bird rights (fewer than two seasons with it): 120% of his last salary is all his rights allow;
  // past that it needs room or an exception like any other team
  const ebLim = r1(Math.max((p.$l ?? 0) * 1.75, indexed(12.5, year) * 1.05))
  const nb = own === 'nbird' ? `With Non-Bird rights (fewer than two seasons with the ${short}) he can be paid $${nbLim}M at most, 120% of his last salary; more takes cap room or an exception. `
    : own === 'ebird' && first > ebLim + 0.01 ? `With Early Bird rights (two seasons with the ${short}) he can be paid $${ebLim}M at most, the greater of 175% of his last salary and 105% of the league's average salary; more takes cap room or an exception. `
    : own === 'ebird' ? 'An Early Bird deal runs two seasons at least; a one-year deal takes cap room or an exception. ' : ''
  const say = why => ({ ok: false, why: nb + why, ...(nb && { k: 'rights' }) })
  if (capPay < capOf(year) && !L.length) return say(`Only $${r1(capOf(year) - capPay)}M of room`)
  // (the line the exception would cross, else the most it pays)
  // (of the exceptions big enough for it, the one with the most room under its line)
  const fits = [...L].reverse().find(m => first <= m.$ + 0.01 && yrs <= m.y)
  const apron = fits && (fits.line === apron1Of(year) ? 'the first apron' : 'the second apron')
  if (fits && after <= fits.line + 0.01) return { ok: false, why: `${nb}The ${EXC_TEXT[fits.k]} hard-caps the ${short} at ${apron} ($${r1(fits.line)}M): this deal would leave no room under it for the minimum deals a 14-man roster still needs ($${r1(need)}M). Fill out the roster first, or offer less`, k: 'apron' }
  if (fits) return { ok: false, why: `${nb}The ${EXC_TEXT[fits.k]} would take the ${short} past ${apron} ($${r1(fits.line)}M), the hard cap that comes with it`, k: 'apron' }
  const m = L.find(m => under(m)) ?? L[0]
  if (capPay < capOf(year)) return say(`Only $${r1(capOf(year) - capPay)}M of room${m ? `; the ${EXC_TEXT[m.k]} pays $${r1(m.$)}M at most` : ''}`)
  return say(m ? `Over the cap: the ${EXC_TEXT[m.k]} pays $${r1(m.$)}M at most, for ${m.y} ${m.y === 1 ? 'season' : 'seasons'}` : 'Over the second apron: minimum deals only')
}
// sign him: off the pool onto the roster, the exception spent, the hard cap triggered. Returns { ok, via, why }
export function signMan(F, short, p, d, { check = true } = {}) {
  const c = check ? canSign(F, short, p, d) : { ok: true, via: d.via ?? 'room' }
  if (!c.ok) return c
  const team = F.teams[short]
  const year = capYear(F)
  const own = rightsOf(p, short)
  const sc = d.sc ?? schedOf(d)
  const e = excFor(F, short, year)
  // (only a deal that needed the room uses it: a team that goes under the cap gives up the mid-level for the room
  // exception)
  if (c.via === 'room' && !own && sc[0] > minOf(p.ys ?? 0, year) + 0.01 && !(F.noCap && short === F.team)) e.room = 1
  if (c.via === 'mle' || c.via === 'tmle' || c.via === 'rmle') {
    const k = c.via === 'mle' ? 'nt' : c.via === 'tmle' ? 'tp' : 'room'
    if (!e.mk) { e.mk = k; e.mle = excOf(k, year) }
    e.mle = r1(Math.max(0, e.mle - sc[0]))
    if (k === 'nt') e.hc = 'a1'
    else if (k === 'tp' && e.hc !== 'a1') e.hc = 'a2'
  }
  if (c.via === 'bae') { e.bae = 0; e.baeY = year; e.hc = 'a1' }
  F.fa = (F.fa ?? []).filter(x => x.i !== p.i)
  for (const s of shortsOf(F)) if (s !== short) F.teams[s].r = F.teams[s].r.filter(x => x.i !== p.i)
  if (!own) p.bird = 0
  putDeal(F, p, { ...d, sc }, { year })
  if (!team.r.includes(p)) team.r.push(p)
  fixNumbers(F, short)
  return { ok: true, via: c.via }
}

// ── The draft hook ───────────────────────────────────────────────────────────
// a drafted man's deal: a first-rounder signs his scale (four seasons, team options on the third and fourth); a
// second-rounder signs the minimum for two seasons if there's a standard spot, a two-way deal if not. pick: the
// overall number (1-60). Core places him on the roster; the deal goes on the man (returns it).
export function rookieDeal(F, p, pk) {
  const pick = typeof pk === 'number' ? pk : pk?.n ?? 60
  const year = F.phase === 'off' ? F.year + 1 : F.year
  p.ys = p.ys ?? 0
  // (signed on draft night, before the summer's ageLeague adds a year of service to every man: he starts a year short
  // so he plays his rookie season with none)
  if (F.phase === 'off' && F.off?.step === 'draft' && p.ys === 0 && F.sed !== F.year) p.ys = -1
  p.rk = p.rk ?? year
  p.bird = 0
  p.rt = p.dr?.[3] ?? null
  if (pick <= 30) {
    const sc = rookieScale(pick, year)
    putDeal(F, p, { sc, rs: 1, opt: { k: 'T', yr: year + 2 } }, { year })
    return { sc, rs: 1, via: 'rookie' }
  }
  const s = p.dr?.[3] ?? teamOf(F, p.i)
  const team = s ? F.teams[s] : null
  const st = team ? standardOf(team).filter(x => x !== p && (F.sed === F.year || (x.y ?? 1) >= 2 || (x.rk ?? 0) > F.year)).length : 0
  // (the two-way men whose deals run out this summer don't hold a spot)
  const tw = team ? twoWaysOf(team).filter(x => x !== p && (F.sed === F.year || (x.y ?? 1) >= 2)).length : 0
  // (about a third of the second round signs a standard deal, most of them early in the round; the rest go two-way,
  // as in the real league)
  const h = hash(`${F.seed}-r2-${p.i}-${p.n}`) % 100
  // (the drafting team's intent when it gives one: pk.tw true = a two-way deal, false = a standard deal, as room allows)
  const std = !!team && st < ROSTER_MAX && (pk?.tw === true ? false : pk?.tw === false ? true : pick <= 35 ? h < 70 : pick <= 45 ? h < 30 : h < 10)
  if (std || tw >= TWO_WAY_MAX) {
    const sc = [minOf(0, year), minOf(1, year + 1)].map(v => Math.max(v, 0))
    putDeal(F, p, { sc, ng: 1 }, { year })
    return { sc, via: 'min' }
  }
  const sc = [twoWayOf(year), twoWayOf(year + 1)]
  putDeal(F, p, { sc, tw: 1 }, { year })
  return { sc, tw: 1, via: 'tw' }
}

// ── Options ──────────────────────────────────────────────────────────────────
// the options on next season (decided at the start of re-signing): [{ p, s, k }]
export function optionsDue(F, short = null) {
  const yr = F.year + 1, out = []
  for (const s of shortsOf(F)) {
    if (short && s !== short) continue
    for (const p of F.teams[s].r) if (p.opt && p.opt.yr === yr && (p.y ?? 0) >= 2) out.push({ p, s, k: p.opt.k })
  }
  return out
}
// would the player take his option (P, E: opt in) — he opts in when the market won't pay him more over the years
// he'd get; a man past 33 takes the guaranteed money
export function playerOptsIn(F, p) {
  const yr = F.year + 1
  const opt = p.sc?.[0] ?? 0
  const mv = marketValue(F, p, yr), t = termOf(F, p)
  if ((p.ag ?? 27) >= 34) return mv < opt * 1.25
  // (the money he'd lock in elsewhere over the years, a little discounted for the risk of the market)
  return mv * Math.min(t, 4) * 0.92 < opt * Math.min(p.y - 1, 2) + mv * Math.max(0, Math.min(t, 4) - Math.min(p.y - 1, 2)) * 0.85 || mv < opt
}
// would the team pick up his team option (T)
export function teamKeeps(F, s, p) {
  const yr = F.year + 1
  const opt = p.sc?.[0] ?? 0
  const w = worthOf(F, p, yr)
  if (p.rs) return w >= opt * 0.8
  const sit = situationOf(F, s)
  return w >= opt * (sit === 'reb' ? 1.05 : 0.9)
}
// apply a decision (core's screen for the GM's team, or the AI): keep = true exercises
export function decideOption(F, p, keep) {
  if (!p?.opt) return
  const yr = p.opt.yr
  if (keep) {
    // (a rookie deal's third-year option, picked up: the fourth year's option is next)
    p.opt = p.rs && p.opt.k === 'T' && p.sgn != null && yr === p.sgn + 2 ? { k: 'T', yr: yr + 1 } : null
    if (!p.opt) delete p.opt
    return
  }
  // declined: the deal ends with this season
  const k = yr - F.year
  // (a rookie-scale option declined: he's an unrestricted free agent, and his team can't pay him more than the option
  // it turned down to bring him back)
  if (p.opt.k === 'T' && p.rs) { p.dco = r1(p.sc?.[k - 1] ?? p.$ ?? 0); delete p.rfa }
  p.y = Math.min(p.y, k)
  p.sc = (p.sc ?? []).slice(0, Math.max(0, p.y - 1))
  delete p.opt
}

// ── A team's situation (contending, in the mix, rebuilding) ──────────────────
// by its top eight men (the core's teamOvr is the screen's; this is the front office's own read), its record this
// season once it's 20 games in, and its age.
// The read is taken once a week in the season (and once at each of the summer's stops) and kept on the save (F.sit =
// { key, m: { [short]: 'win'|'mid'|'reb' }, rank: { [short]: 1..30 } }): a save reloaded in the middle of a week plays
// on with the read it had, so the same save always plays out the same way. The record it's taken on is the one
// through the last night before the week began, whenever in the week it's first asked for.
export function teamStrength(F, s) {
  // (in the summer, its own free agents it still holds the rights to count: it can bring them back)
  const own = F.phase === 'off' ? (F.fa ?? []).filter(p => p.fr === s && !p.rn) : []
  const r = [...F.teams[s].r.filter(p => !p.tw), ...own].map(p => p.o ?? 60).sort((a, b) => b - a)
  const w = [1, 1, 0.9, 0.8, 0.7, 0.55, 0.45, 0.35]
  return w.reduce((a, x, k) => a + x * (r[k] ?? 55), 0) / w.reduce((a, x) => a + x, 0)
}
function recordOf(F, s, before = Infinity) {
  let w = 0, l = 0
  for (const g of F.sched ?? []) {
    if (g.hs == null || g.d >= before) continue
    if (g.h === s) { if (g.hs > g.as) w++; else l++ }
    else if (g.a === s) { if (g.as > g.hs) w++; else l++ }
  }
  return { w, l }
}
function sitRead(F) {
  const wk = Math.floor((F.day ?? 0) / 7)
  const key = `${F.year}|${F.phase}|${F.off?.step ?? ''}|${wk}`
  let c = F.sit
  if (c?.key !== key) {
    const S = shortsOf(F)
    const str = S.map(x => [x, teamStrength(F, x)]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    const rank = Object.fromEntries(str.map(([x], i) => [x, i + 1]))
    const m = {}
    for (const x of S) {
      const rec = F.phase === 'season' ? recordOf(F, x, wk * 7) : F.phase === 'off' ? recordOf(F, x) : { w: 0, l: 0 }
      const g = rec.w + rec.l
      const wp = g ? rec.w / g : 0.5
      const live = g >= 20
      const n = S.length
      const sc = (live ? (wp - 0.5) * 2.4 : 0) + ((n + 1) / 2 - rank[x]) / (n / 2)
      m[x] = sc >= 0.5 ? 'win' : sc <= -0.45 ? 'reb' : 'mid'
    }
    c = { key, m, rank }
    F.sit = c
  }
  return c
}
export const situationOf = (F, s) => sitRead(F).m[s] ?? 'mid'
// where its roster ranks in the league (1 the strongest), as the front offices read it
export const strengthRank = (F, s) => sitRead(F).rank?.[s] ?? 15
export const SIT_TEXT = { win: 'CONTENDING', mid: 'IN THE MIX', reb: 'REBUILDING' }
// the big markets: some free agents want the lights
export const BIG_MARKET = new Set(['LAL', 'LAC', 'NYK', 'BKN', 'GSW', 'MIA', 'CHI', 'BOS', 'PHI', 'DAL', 'HOU', 'TOR'])
// HOW FAR AN AI FRONT OFFICE SPENDS (spendLines): the payroll it runs to ($M). The real league's habits: the luxury
// tax is for contenders. A team in the mix or rebuilding stays under the tax line (it lets a good-but-not-great
// player walk, or moves salary at the deadline, rather than pay it). A contender pays by its ownership (SPENDERS:
// the owners who have run tax bills under this CBA go to the second apron for one of the league's eight best
// rosters; FRUGAL: the owners who never pay the tax don't start now; the rest pay to the first apron when theirs is
// one of the five best). A league's owners differ a little from save to save (seeded: one in four a step looser or
// tighter). Past the second apron only a spender with one of the three best rosters goes, a little, and never two
// seasons running (the frozen pick and the repeater bills see to that: team.a2h, the seasons it finished past it).
//   keep: the line it re-signs and extends its own men to, and sells down to (trades.js sellDown)
//   add:  the line it won't cross for a new man
const SPENDERS = new Set(['BOS', 'GSW', 'LAC', 'PHX', 'NYK', 'MIN', 'DEN', 'MIL', 'LAL', 'CLE', 'PHI', 'MIA', 'DAL'])
const FRUGAL = new Set(['CHI', 'CHA', 'NOP', 'IND', 'UTA', 'WAS'])
// 2 a spender, 1 the middle, 0 frugal
export function ownerTier(F, s) {
  const base = SPENDERS.has(s) ? 2 : FRUGAL.has(s) ? 0 : 1
  const u = rngOf(`${F.seed}-owner-${s}`).u()
  return clamp(0, 2, base + (u < 0.13 ? -1 : u > 0.87 ? 1 : 0))
}
export function spendLines(F, s, year = capYear(F)) {
  const sit = situationOf(F, s)
  const cap = capOf(year), tax = taxOf(year), a1 = apron1Of(year), a2 = apron2Of(year)
  if (sit === 'win') {
    const o = ownerTier(F, s), rank = strengthRank(F, s)
    const top = o === 2 && rank <= 3 && !(F.teams[s]?.a2h ?? []).includes(year - 1)
    const keep = top ? a2 + cap * 0.04 : o === 2 && rank <= 8 ? a2 - 1 : o === 1 && rank <= 5 ? a1 - 1 : tax - 2.5
    return { sit, keep: r1(keep), add: r1(Math.min(keep, a1 - 1)) }
  }
  if (sit === 'mid') return { sit, keep: r1(tax - 2.5), add: r1(tax - 4) }
  return { sit, keep: r1(tax - 6), add: r1(Math.min(tax - 8, cap + excOf('nt', year))) }
}
// (the same lines by name, for the code that still reads them that way)
export function taxTolerance(F, s) {
  const sit = situationOf(F, s)
  return sit === 'win' ? { add: 'a1', keep: 'a2' } : sit === 'mid' ? { add: 'tax', keep: 'tax' } : { add: 'cap', keep: 'tax' }
}
export const lineOf = (k, year) => (k === 'cap' ? capOf(year) : k === 'tax' ? taxOf(year) : k === 'a1' ? apron1Of(year) : k === 'a2' ? apron2Of(year) : apron2Of(year) + 4)

// ── Extensions ───────────────────────────────────────────────────────────────
// a rookie-scale man after his third season (one year left): up to 5 seasons at 25% (30% for an All-NBA man, the
// Rose rule); a veteran two years after he signed, with two years or less left: up to 4 new seasons, the first up to
// 140% of his salary now. Returns { ok, why, max, y }
export function extensionOk(F, s, p) {
  if (!p || p.tw || (p.y ?? 0) < 1 || p.ext === capYear(F)) return { ok: false, why: 'Not eligible' }
  const year = F.year + (F.phase === 'off' ? 1 : 0)
  const start = year + p.y
  if (p.rs) {
    if (p.y !== 1) return { ok: false, why: 'Rookie-scale extensions come after his third season' }
    const pct = roseOk(p) ? 0.3 : 0.25
    return { ok: true, max: r1(capOf(start) * pct), y: 5, start, rookie: true }
  }
  if (year - (p.sgn ?? year) < 2) return { ok: false, why: 'Veterans can extend two years after signing' }
  if (p.y > 2) return { ok: false, why: 'Too many years left to extend' }
  const own = superMaxOk(F, p, s) ? 0.35 : maxPct((p.ys ?? 0) + p.y)
  return { ok: true, max: r1(Math.min(capOf(start) * own, Math.max((p.$ ?? 0) * 1.4, indexed(12.5, start) * 1.4))), y: 4, start }
}
// what he'd extend for: what he's worth on the league's pay ladder when the new deal starts (his age then; a young
// man's growth only half paid for: a front office pays for the player he is, with a little of the one he may become),
// his max at most. Only the league's best young players get the max (the real league's rookie-scale max deals go to
// All-NBA men and the top 20 or so)
export function extensionAsk(F, s, p) {
  const e = extensionOk(F, s, p)
  if (!e.ok) return null
  const then = { ...p, ag: (p.ag ?? 25) + p.y }
  let sc = scoreOf(then)
  if (sc > (p.o ?? 60)) sc = (p.o ?? 60) + (sc - (p.o ?? 60)) * 0.5
  const rk = rankAt(F, sc)
  const ys = (p.ys ?? 0) + p.y
  const mv = clamp(minOf(ys, e.start), maxOf(ys, e.start), ladder(LADDER, rk) * capOf(e.start))
  // (a rookie-scale man: the max for a real star only, one of the league's twenty best or an All-NBA man; the next
  // tier signs just under it, and a good young starter for 15-22% of the cap, the real league's $25-35M extensions:
  // he gives up some of his price for the security a year early)
  const rookie$ = rk <= 20 || roseOk(p) ? e.max : Math.min(e.max * 0.94, ladder(LADDER, rk) * capOf(e.start) * (rk <= 35 ? 0.86 : 0.8))
  const $ = r1(Math.min(e.max, Math.max(minOf(ys, e.start), e.rookie ? rookie$ : mv * 1.02)))
  return { $, y: Math.min(e.y, e.rookie ? (rk <= 120 ? 5 : 4) : termFor(then, rk)), r: 0.08 }
}
// sign it: the new seasons go on after the ones he has
export function extendMan(F, s, p, d) {
  const e = extensionOk(F, s, p)
  if (!e.ok) return e
  if (d.$ > e.max + 0.01) return { ok: false, why: `Over his max for an extension ($${e.max}M)` }
  // (a veteran's deal runs five seasons at most from the extension, the ones he has left in it)
  const yrs = e.rookie ? Math.min(d.y, e.y) : Math.min(d.y, e.y, 5 - p.y)
  if (yrs < 1) return { ok: false, why: 'No seasons left to add' }
  const add = schedOf({ $: d.$, y: yrs, r: Math.min(d.r ?? 0.08, 0.08) })
  // (the GM's owner: the payroll the new deal starts on can't pass his ceiling)
  if (s === F.team && !F.noCap && d.$ > minOf((p.ys ?? 0) + p.y, e.start) + 0.01) {
    const o = ownerCap(F, e.start)
    const at = payroll(F, s, e.start) + d.$
    if (at > o.$ + 0.01) return { ok: false, why: teamWords(`${o.why.replace(' this league year', '')} in ${e.start}-${String((e.start + 1) % 100).padStart(2, '0')}`), k: 'owner' }
  }
  p.sc = [...(p.sc ?? []), ...add]
  p.y += add.length
  p.ext = capYear(F)
  // (the rookie-scale man's option years are behind him; the new deal is a veteran's)
  if (p.rs) { delete p.rs; delete p.opt; delete p.rfa }
  if (p.opt && p.opt.yr < e.start) delete p.opt
  // (text: the wire's line for it)
  return { ok: true, text: extensionText(p, s, add.length) }
}

// ── Waivers and the stretch provision ────────────────────────────────────────
// what's guaranteed on his deal from now: his seasons up to a team option (a team option, a rookie scale's third and
// fourth years among them, is the team's to decline: waived, it owes nothing past it)
export function guaranteedOf(F, p) {
  const rest = [p.$ ?? 0, ...(p.sc ?? [])].slice(0, p.y ?? 0)
  if (p.opt?.k !== 'T') return rest
  const start = p.rk != null && p.rk > capYear(F) ? p.rk : capYear(F)
  return rest.slice(0, Math.max(0, p.opt.yr - start))
}
// what cutting him would leave on the books: { now (this league year), per (a season, as it would sit on the books),
// total, years, stretch?, later? (in the season: a season of the stretched years) } (non-guaranteed: nothing before
// January; a team option's seasons: nothing)
export function cutCost(F, p, { stretch = false } = {}) {
  const none = { now: 0, per: 0, total: 0, years: 0 }
  if (!p || p.tw) return none
  const day = dayOf(F)
  if (p.ng && (F.phase === 'off' || day < (F.days ?? 170) * 0.45)) return none
  const rest = guaranteedOf(F, p)
  // (a veteran's one-year minimum counts on the cap as the two-year man's minimum, on the roster or waived: the league
  // pays the difference, so waiving him doesn't raise the payroll)
  if (p.mh && rest.length) rest[0] = Math.min(rest[0], hitOf(p, capYear(F), capYear(F)) || rest[0])
  const total = r1(rest.reduce((a, v) => a + v, 0))
  if (!rest.length || total <= 0) return none
  if (!stretch) return { now: rest[0] ?? 0, per: r1(total / rest.length), total, years: rest.length }
  // stretched: in the summer (from July, the books on next season), everything over twice the seasons left plus one;
  // in the season (June included, the league year not yet over), this season stays, the seasons after it stretch
  if (summerOf(F)) {
    const yrs = rest.length * 2 + 1
    return { now: r1(total / yrs), per: r1(total / yrs), total, years: yrs, stretch: true }
  }
  const later = rest.slice(1)
  const yrs = later.length * 2 + 1
  const per = later.length ? r1(later.reduce((a, v) => a + v, 0) / yrs) : 0
  return { now: rest[0], per, total, years: later.length ? yrs + 1 : 1, stretch: true, later: per }
}
// the summer's books: the offseason once the deals have ticked over (seasonEndDeals; capYear is next season's)
const summerOf = F => F.phase === 'off' && F.sed === F.year
// can he be stretched (it spreads more seasons than a plain waiver would)
export const canStretch = (F, p) => cutCost(F, p, { stretch: true }).years > cutCost(F, p).years
// waive him: off the roster to the pool; what's owed stays on the cap (team.dead: { n, $ a season, y seasons }).
// Returns the dead money this league year.
export function cutMan(F, short, id, { stretch = false, force = false } = {}) {
  const team = F.teams?.[short]
  const p = team?.r.find(x => x.i === id)
  if (!p) return 0
  // (the roster floor: in the season the GM's team can't go under 13 standard contracts; season.js cutBlock says why)
  if (!force && short === F.team && F.phase !== 'off' && !p.tw && standardOf(team).length <= ROSTER_MIN - 1) return 0
  const c = cutCost(F, p, { stretch })
  team.dead ??= []
  const cy = capYear(F)
  const put = (v, from, to, st = 0) => team.dead.push({ n: p.n, $: r1(v), y: to - cy + 1, from, to, ...(st && { st: 1 }) })
  // (y: the seasons left from the books' season through `to`; offseason.js newSeason resets it from `to` each new
  // season, so a waiver ages once a league year whenever it was made)
  if (c.total > 0) {
    if (!c.stretch) {
      // (this season as it is, the seasons after it at their average: the same total)
      put(c.now, cy, cy)
      if (c.years > 1) put((c.total - c.now) / (c.years - 1), cy + 1, cy + c.years - 1)
    } else if (summerOf(F)) put(c.now, cy, cy + c.years - 1, 1)
    else {
      put(c.now, cy, cy)
      if (c.later > 0) put(c.later, cy + 1, cy + c.years - 1, 1)
    }
  }
  team.r = team.r.filter(x => x !== p)
  // (the last league year of the deal he was waived from: the waiving team can sign him again after it, or a year on)
  const start = p.rk != null && p.rk > cy ? p.rk : cy
  const to = start + Math.max(0, (p.y ?? 1) - 1)
  // (on the street: any team can sign him; no rights carry with him)
  for (const k of ['$', 'y', 'sc', 'opt', 'rs', 'rfa', 'tw', 'mh', 'ng', 'ntc', 'ext', 'fr', 'hy', 'qo', 'qtw', 'qot', 'dco', 'osm']) delete p[k]
  p.$ = 0; p.y = 0; p.bird = 0
  p.wv = capYear(F)
  p.wvb = { s: short, t: timeOf(F), to }
  ;(F.fa ??= []).push(p)
  return c.now
}

// ── The season's end: options, the years tick, deals expire ───────────────────
// called once at the start of re-signing (F.phase 'off', F.year the season just finished). The GM's team's options
// go the way core's screen set them (decideOption); any left undecided, the AI's way. Returns news items.
// Returns the men whose deals ended (now in F.fa, p.was = p.fr = the team he left), with .news (the wire's items).
// (Years of service: the sim's ageLeague adds them, before this; Bird years are added here.)
export function seasonEndDeals(F) {
  if (F.sed === F.year) return Object.assign([], { news: [] })
  F.sed = F.year
  const news = [], gone = []
  const nx = F.year + 1
  // options for next season
  for (const { p, s, k } of optionsDue(F)) {
    if (k === 'P' || k === 'E') {
      const inn = playerOptsIn(F, p)
      decideOption(F, p, inn)
      if (!inn && (p.o ?? 0) >= 75) news.push({ k: 'option', tag: 'FREE AGENCY', s, text: `${p.n} declines his player option with the ${s} and becomes a free agent` })
    } else {
      if (s === F.team && p.optd != null) { decideOption(F, p, !!p.optd); delete p.optd; continue }
      decideOption(F, p, teamKeeps(F, s, p))
    }
  }
  for (const s of shortsOf(F)) {
    const team = F.teams[s]
    // dead money: what's done is gone (core counts y down each new season; the years on it say when it ends)
    team.dead = (team.dead ?? []).filter(d => (d.to != null ? d.to >= nx : (d.y ?? 0) > 1))
    const keep = []
    for (const p of team.r) {
      // a Bird year (a man drafted this summer hasn't played yet)
      if (p.rk != null && p.rk > F.year) { keep.push(p); continue }
      p.bird = (p.bird ?? 0) + 1
      if (!Array.isArray(p.sc)) p.sc = Array.from({ length: Math.max(0, (p.y ?? 1) - 1) }, () => p.$ ?? 0)
      p.y = (p.y ?? 1) - 1
      if (p.y > 0) {
        p.$l = p.$
        p.$ = p.sc?.[0] ?? p.$
        p.sc = (p.sc ?? []).slice(1)
        // (no season is ever paid under the minimum for his service then)
        if (!p.tw) p.$ = r1(Math.max(p.$, minOf(p.ys ?? 0, nx)))
        if (p.mh) delete p.mh
        keep.push(p)
        continue
      }
      // his deal is up: a free agent, with his team's rights and hold
      const fa = p
      fa.fr = s
      fa.was = s
      gone.push(fa)
      fa.hy = nx
      fa.$l = p.$ ?? 0
      if (p.rs) fa.rsl = 1
      const restricted = !!p.rfa && !p.tw ? true : !!p.tw
      const wasTw = !!p.tw
      fa.$ = 0
      fa.y = 0
      for (const k of ['sc', 'opt', 'rs', 'mh', 'ng', 'ntc', 'ext', 'tw', 'rfa']) delete fa[k]
      if (restricted) {
        // the qualifying offer: 130% of a rookie deal's last salary (125% for anyone else), the minimum + $0.2M at least
        // (a two-way man's qualifying offer is another two-way deal, one season: fa.qtw)
        const qo = wasTw ? twoWayOf(nx) : r1(Math.max(minOf(fa.ys ?? 0, nx) + 0.2, fa.$l * (fa.rsl ? 1.3 : 1.25)))
        const wants = s === F.team || wasTw ? true : worthOf(F, fa, nx) >= qo * 0.9
        if (wants) { fa.rfa = 1; fa.qo = qo; if (wasTw) fa.qtw = 1 }
      }
      ;(F.fa ??= []).push(fa)
    }
    team.r = keep
  }
  // (a man in the pool a year or more with no team: his rights are gone)
  for (const p of F.fa ?? []) if (p.hy != null && p.hy < nx) { for (const k of ['fr', 'hy', 'rfa', 'qo', 'qtw', 'qot', 'rsl', 'dco']) delete p[k] }
  return Object.assign(gone, { news })
}
// renounce him: his hold off the books, his rights gone (an RFA becomes unrestricted)
export function renounce(F, short, id) {
  const p = (F.fa ?? []).find(x => x.i === id && x.fr === short)
  if (!p) return false
  p.rn = 1
  for (const k of ['rfa', 'qo', 'qtw', 'qot', 'dco']) delete p[k]
  return true
}
// what he asks the GM's team to re-sign (his market; a man coming off a rookie deal or with Bird rights may give a
// little back to stay; a man who wants out asks for more). null when the GM's team holds no rights to him.
// THE MARKET THIS SUMMER: the most any other team could pay him now (its cap room, else its mid-level or
// bi-annual, else the minimum), the best of the league's. A free agent's price can't outrun it: when the room is gone,
// so is the money, and he takes what's there or goes back to his own team for less than his rating says.
// (read once for each day of free agency and kept on the save, F.chn = { key, m: { [short]: $M } }: the asks a day's
// round weighs are set against the market as that day opened, in a save loaded again too)
function channels(F) {
  const year = capYear(F)
  const key = `${year}|${F.phase}|${F.off?.step ?? ''}|${F.fay === year ? F.fad ?? 0 : 0}`
  const c = F.chn
  if (c?.key === key) return c.m
  const m = {}
  for (const s of shortsOf(F)) {
    // (the room it could clear: its payroll without the holds it would renounce)
    const pay = payroll(F, s, year)
    const room = capOf(year) - pay
    const e = excFor(F, s, year)
    const mle = e.mk ? e.mle ?? 0 : pay < apron1Of(year) ? excOf('nt', year) : pay < apron2Of(year) ? excOf('tp', year) : 0
    const full = standardOf(F.teams[s]).length >= ROSTER_MAX
    m[s] = full ? 0 : r1(Math.max(room, mle, e.bae > 0.05 && e.baeY !== year - 1 && pay < apron1Of(year) ? e.bae : 0))
  }
  F.chn = { key, m }
  return m
}
export function outsideBest(F, p) {
  const m = channels(F)
  let best = minOf(p.ys ?? 0, capYear(F))
  // (his own team's hold comes off its books if it lets him go: its room counts that way)
  for (const [s, v] of Object.entries(m)) best = Math.max(best, s === p.fr && !p.rn ? Math.min(v + holdOf(p, capYear(F)), capOf(capYear(F))) * 0 : v)
  return r1(best)
}
export function resignOffer(F, p) {
  const s = p?.fr
  if (!s || p.rn) return null
  const year = capYear(F)
  // (what the open market would pay him; his own team pays about that, never under 70% of his rating's price)
  const mv0 = marketValue(F, p, year)
  const mv = F.phase === 'off' ? Math.max(mv0 * 0.7, Math.min(mv0, outsideBest(F, p) * 1.1)) : mv0
  const R = rngOf(`${F.seed}-${F.year}-ask-${p.i}`)
  const sit = situationOf(F, s)
  const tilt = (sit === 'win' ? 0.97 : sit === 'reb' && (p.ag ?? 27) >= 29 ? 1.08 : 1) * (1 + R.n() * 0.04)
  const own = rightsOf(p, s)
  const rk = rankOf(F, p)
  // (with Bird rights a good player in his prime takes the fifth year only his own team can give)
  const y = Math.min(own === 'bird' ? 5 : 4, termFor(p, rk) + (own === 'bird' && (p.ag ?? 27) <= 31 && rk <= 60 ? 1 : 0))
  let $ = r1(clamp(minOf(p.ys ?? 0, year), maxOf(p.ys ?? 0, year, { superMax: own === 'bird' && superMaxOk(F, p, s), last: p.$l ?? 0 }), mv * tilt))
  // (his rookie option declined: his team can pay him the option at most; he takes it if it's close to his price)
  if (p.dco) { if ($ > p.dco * 1.15) return null; $ = Math.min($, p.dco) }
  // (a two-way man worth no more than the minimum: he re-signs on another two-way deal, as two-way men do; one who
  // played his way past it asks for a standard contract)
  if (p.qtw && $ <= minOf(p.ys ?? 0, year) * 1.05 + 0.01 && (p.ys ?? 0) <= 3) return { $: twoWayOf(year), y: (p.ag ?? 24) <= 23 ? 2 : 1, r: 0, tw: 1, via: 'tw' }
  return { $, y, r: raiseMax(own), via: own }
}
