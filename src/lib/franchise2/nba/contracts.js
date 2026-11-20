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
import {
  capOf, taxOf, apron1Of, apron2Of, minOf, maxOf, maxPct, twoWayOf, rookieScale, excOf, excYears, indexed,
  payroll, capSheet, capYear, standardOf, twoWaysOf, holdOf, hardCapOf, overOf,
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
  const hc = hardCapOf(F, short)
  if (payroll(F, short) > hc + 0.05 && !(F.noCap && short === F.team)) return { ok: false, why: 'Over its hard cap', st, tw }
  return { ok: true, st, tw }
}
export const openSpots = (F, short) => (F.phase === 'off' ? Math.max(0, ROSTER_MAX - standardOf(F.teams[short]).length) : ROSTER_MAX - standardOf(F.teams[short]).length)

// ── The market ───────────────────────────────────────────────────────────────
// where he'll be next season, as a front office sees it (his OVR, the growth left in a young man, the slide in an
// older one; a big man slides sooner)
export function scoreOf(p) {
  const o = p.o ?? 60, ag = p.ag ?? 27
  const up = ag <= 24 ? clamp(0, 6, ((p.pk ?? o) - o) * (ag <= 21 ? 0.4 : ag <= 23 ? 0.3 : 0.2)) : 0
  const old = ag >= 31 ? (ag - 30) * (p.g === 'big' ? 1.4 : 1.1) : 0
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
// { [id]: { sc: score, rk: rank (scaled to 450 men) } } for every man in the league (rosters and the pool)
export function marketOf(F) {
  // (the key without building the list: this is read for every man in every trade the league weighs)
  let count = (F.fa ?? []).length
  for (const s in F.teams ?? {}) count += F.teams[s].r.length
  const key = `${F.year}|${F.phase}|${F.off?.step ?? ''}|${count}`
  const c = MK.get(F)
  if (c?.key === key) return c.m
  const men = allMen(F)
  const sc = men.map(([, p]) => [p.i, scoreOf(p)]).sort((a, b) => b[1] - a[1])
  // (the ladder is as long as the league: its rostered men and the street's best hundred and fifty; any more on the
  // street fall past the end of it)
  const n = men.filter(([s]) => s).length + Math.min(150, (F.fa ?? []).length)
  const k = 450 / Math.max(300, n)
  const m = {}
  sc.forEach(([i, s], j) => { m[i] = { sc: s, rk: 1 + j * k } })
  MK.set(F, { key, m, desc: sc.map(x => x[1]), k })
  return m
}
export const rankOf = (F, p) => marketOf(F)[p.i]?.rk ?? 300
// the rank a man of this score would have in the league now
export function rankAt(F, score) {
  marketOf(F)
  const { desc, k } = MK.get(F)
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
// how long he'd sign for: a young man the longest he can, a veteran shorter
export function termFor(p) {
  const ag = p.ag ?? 27
  return ag <= 26 ? 4 : ag <= 29 ? 3 : ag <= 32 ? 2 : 1
}

// ── Who qualifies for the supermax (Designated Veteran) ───────────────────────
// 7-9 years of service, with the team that drafted him (or traded for him on his rookie deal), and the MVP, the DPOY
// or All-NBA last season, or All-NBA in two of the last three
export function superMaxOk(F, p, short = null) {
  const ys = p.ys ?? 0
  if (ys < 7 || ys > 9) return false
  const s = short ?? p.fr ?? teamOf(F, p.i)
  if (!s || !(p.dr?.[3] === s || p.rt === s)) return false
  const aw = p.aw ?? [], last = F.year
  if (aw.some(a => a.y === last && ['MVP', 'DPOY', 'ALL1', 'ALL2', 'ALL3'].includes(a.k))) return true
  return aw.filter(a => a.y >= last - 2 && ['ALL1', 'ALL2', 'ALL3'].includes(a.k)).length >= 2
}
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
  for (const k of ['fr', 'was', 'hy', '$l', 'rsl', 'qo', 'rn', 'ask', 'fx', 'wv']) delete p[k]
  return p
}

// ── Starting deals (setup) ───────────────────────────────────────────────────
// realRow { $, y, sc?, opt?, rs? } when the data has his real deal; otherwise an estimate: a young first-rounder on
// his rookie scale (by his draft slot, or the slot his rating would have gone), a second-rounder or an undrafted man
// on the minimum, a veteran at about his market price when he signed, with a few years left on it.
// dealOnLoad(F, man, short | realRow): core calls it for every rostered man at setup, and at camp for the made-up
// men it adds (no deal yet). At camp a man gets what a camp body signs for: the minimum, or a two-way deal.
export function dealOnLoad(F, p, x = null) {
  loadOnce(F, p, x)
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
  p.bird = p.bird ?? Math.min(4, Math.max(0, Math.floor(R.u() * Math.min(5, (p.ys ?? 0) + 1))))
  if (realRow && realRow.$ > 0) {
    putDeal(F, p, { $: realRow.$, y: realRow.y ?? 1, sc: realRow.sc ? [realRow.$, ...realRow.sc] : null, opt: realRow.opt, rs: realRow.rs, r: 0.05 }, { year })
    if (!realRow.sc) p.sc = schedOf({ $: realRow.$, y: realRow.y ?? 1, r: 0.05 }).slice(1)
    p.sgn = year - Math.max(1, Math.min(4, (realRow.ago ?? 1)))
    p.sgd = -1
    p.real = 1
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
  const est = new Set(allMen(F).filter(([s, p]) => s && !p.real).map(([, p]) => p.i))
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
// the MLE a team can use now, and how much of it is left: { k, $, y } or null
export function mleFor(F, short, year = capYear(F)) {
  const e = excFor(F, short, year)
  const pay = payroll(F, short, year)
  if (e.mk) return e.mle > 0.05 ? { k: e.mk, $: e.mle, y: excYears(e.mk) } : null
  // (a team that went under the cap to sign men has the room exception, nothing more)
  if (e.room) return { k: 'room', $: excOf('room', year), y: excYears('room') }
  if (pay < apron1Of(year)) return { k: 'nt', $: excOf('nt', year), y: excYears('nt') }
  if (pay < apron2Of(year)) return { k: 'tp', $: excOf('tp', year), y: excYears('tp') }
  return null
}

// ── Can a team sign him, and how ─────────────────────────────────────────────
// deal { $, y, r?, opt?, tw? }. Returns { ok, via: 'room'|'mle'|'tmle'|'rmle'|'bae'|'min'|'bird'|'ebird'|'nbird'|
// 'rookie'|'tw', why }
export function rightsOf(p, short) {
  if (!p || p.fr !== short || p.rn) return null
  const b = p.bird ?? 0
  return b >= 3 ? 'bird' : b === 2 ? 'ebird' : 'nbird'
}
export const RIGHTS_TEXT = { bird: 'Bird rights', ebird: 'Early Bird rights', nbird: 'Non-Bird rights' }
const VIA_EXC = { nt: 'mle', tp: 'tmle', room: 'rmle' }
export function canSign(F, short, p, d) {
  const team = F.teams?.[short]
  if (!team || !p || !d) return { ok: false, why: 'Nothing to sign' }
  const year = capYear(F)
  const ys = p.ys ?? 0
  const free = F.noCap && short === F.team
  const st = standardOf(team).filter(x => x.i !== p.i).length, tw = twoWaysOf(team).filter(x => x.i !== p.i).length
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
  const rise = sc.slice(1).some((v, k) => v - sc[k] > first * raiseMax(own) + 0.06)
  if (rise) return { ok: false, why: `Raises are capped at ${Math.round(raiseMax(own) * 100)}% a season` }
  if (free) return { ok: true, via: own ?? 'room' }
  // (his own hold comes off when he signs)
  const hold = own ? holdOf(p, year) : 0
  const pay = payroll(F, short, year) - hold
  const after = pay + first
  const hc = hardCapOf(F, short, year)
  if (after > hc + 0.01) return { ok: false, why: `It would put the ${short} over their hard cap` }
  // rookies: his scale
  if (d.rs) return { ok: true, via: 'rookie' }
  // under the cap with room for him
  if (after <= capOf(year) + 0.01) return { ok: true, via: 'room' }
  // his own man: Bird rights
  if (own === 'bird') return { ok: true, via: 'bird' }
  if (own === 'ebird') {
    const lim = Math.max((p.$l ?? 0) * 1.75, indexed(12.5, year) * 1.05)
    if (first <= lim + 0.01 && yrs >= 2) return { ok: true, via: 'ebird' }
  }
  if (own === 'nbird' && first <= Math.max((p.$l ?? 0) * 1.2, mn * 1.2) + 0.01) return { ok: true, via: 'nbird' }
  // the minimum: two seasons at most, over any line
  if (first <= mn + 0.01 && yrs <= 2) return { ok: true, via: 'min' }
  // the mid-level (it hard-caps a team at the first apron, the taxpayer MLE at the second)
  const m = mleFor(F, short, year)
  if (m && first <= m.$ + 0.01 && yrs <= m.y) {
    const line = m.k === 'tp' ? apron2Of(year) : m.k === 'nt' ? apron1Of(year) : Infinity
    if (after <= line + 0.01) return { ok: true, via: VIA_EXC[m.k] }
  }
  // the bi-annual (not two seasons running; not over the first apron)
  const e = excFor(F, short, year)
  if (e.bae > 0.05 && first <= e.bae + 0.01 && yrs <= 2 && e.baeY !== year - 1 && after <= apron1Of(year) + 0.01 && pay > capOf(year)) return { ok: true, via: 'bae' }
  if (pay < capOf(year)) return { ok: false, why: `Only $${r1(capOf(year) - pay)}M of room` }
  return { ok: false, why: m ? `Over the cap: the ${m.k === 'tp' ? 'taxpayer ' : m.k === 'room' ? 'room ' : ''}mid-level tops out at $${r1(m.$)}M` : 'Over the second apron: minimum deals only' }
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
  if (c.via === 'room') e.room = 1
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
  const st = team ? standardOf(team).filter(x => x !== p).length : 0
  const tw = team ? twoWaysOf(team).filter(x => x !== p).length : 0
  // (an early second-rounder gets a standard deal when there's room for him; most go two-way)
  if (team && (pick <= 40 ? st < ROSTER_MAX : st < ROSTER_MAX - 1 && tw >= 2) || tw >= TWO_WAY_MAX) {
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
  const mv = marketValue(F, p, yr), t = termFor(p)
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
  p.y = Math.min(p.y, k)
  p.sc = (p.sc ?? []).slice(0, Math.max(0, p.y - 1))
  delete p.opt
}

// ── A team's situation (contending, in the mix, rebuilding) ──────────────────
// by its top eight men (the core's teamOvr is the screen's; this is the front office's own read), its record this
// season once it's 20 games in, and its age
const SIT = new WeakMap()
export function teamStrength(F, s) {
  // (in the summer, its own free agents it still holds the rights to count: it can bring them back)
  const own = F.phase === 'off' ? (F.fa ?? []).filter(p => p.fr === s && !p.rn) : []
  const r = [...F.teams[s].r.filter(p => !p.tw), ...own].map(p => p.o ?? 60).sort((a, b) => b - a)
  const w = [1, 1, 0.9, 0.8, 0.7, 0.55, 0.45, 0.35]
  return w.reduce((a, x, k) => a + x * (r[k] ?? 55), 0) / w.reduce((a, x) => a + x, 0)
}
function recordOf(F, s) {
  let w = 0, l = 0
  for (const g of F.sched ?? []) {
    if (g.hs == null) continue
    if (g.h === s) { if (g.hs > g.as) w++; else l++ }
    else if (g.a === s) { if (g.as > g.hs) w++; else l++ }
  }
  return { w, l }
}
export function situationOf(F, s) {
  const key = `${F.year}|${F.phase}|${F.off?.step ?? ''}|${Math.floor((F.day ?? 0) / 7)}`
  let c = SIT.get(F)
  if (c?.key !== key) {
    const S = shortsOf(F)
    const str = S.map(x => [x, teamStrength(F, x)]).sort((a, b) => b[1] - a[1])
    const rank = Object.fromEntries(str.map(([x], i) => [x, i + 1]))
    const m = {}
    for (const x of S) {
      const rec = F.phase === 'season' || F.phase === 'off' ? recordOf(F, x) : { w: 0, l: 0 }
      const g = rec.w + rec.l
      const wp = g ? rec.w / g : 0.5
      const live = g >= 20
      const n = S.length
      const sc = (live ? (wp - 0.5) * 2.4 : 0) + ((n + 1) / 2 - rank[x]) / (n / 2)
      m[x] = sc >= 0.5 ? 'win' : sc <= -0.45 ? 'reb' : 'mid'
    }
    c = { key, m }
    SIT.set(F, c)
  }
  return c.m[s] ?? 'mid'
}
export const SIT_TEXT = { win: 'CONTENDING', mid: 'IN THE MIX', reb: 'REBUILDING' }
// the big markets: some free agents want the lights
export const BIG_MARKET = new Set(['LAL', 'LAC', 'NYK', 'BKN', 'GSW', 'MIA', 'CHI', 'BOS', 'PHI', 'DAL', 'HOU', 'TOR'])
// how far an AI front office will spend: the line it won't cross for a new man ('cap', 'tax', 'a1', 'a2') and the one
// it will cross to keep its own (Bird rights)
export function taxTolerance(F, s) {
  const sit = situationOf(F, s)
  const big = BIG_MARKET.has(s)
  const h = hash(`${F.seed}-own-${s}`) % 3
  if (sit === 'win') return { add: h === 0 && !big ? 'tax' : 'a1', keep: big || h === 2 ? 'a2+' : 'a2' }
  if (sit === 'mid') return { add: h === 2 ? 'cap' : 'tax', keep: big ? 'a1' : 'tax' }
  return { add: 'cap', keep: 'tax' }
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
// what he'd extend for: his market then, his max at most
export function extensionAsk(F, s, p) {
  const e = extensionOk(F, s, p)
  if (!e.ok) return null
  const mv = marketValue(F, { ...p, ag: (p.ag ?? 25) + p.y, ys: (p.ys ?? 0) + p.y }, e.start)
  const $ = r1(Math.min(e.max, Math.max(minOf((p.ys ?? 0) + p.y, e.start), mv * (e.rookie ? 0.97 : 1.02))))
  return { $, y: Math.min(e.y, e.rookie ? 5 : termFor({ ag: p.ag + p.y })), r: 0.08 }
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
  p.sc = [...(p.sc ?? []), ...add]
  p.y += add.length
  p.ext = capYear(F)
  // (the rookie-scale man's option years are behind him; the new deal is a veteran's)
  if (p.rs) { delete p.rs; delete p.opt; delete p.rfa }
  if (p.opt && p.opt.yr < e.start) delete p.opt
  return { ok: true }
}

// ── Waivers and the stretch provision ────────────────────────────────────────
// what cutting him would leave on the books: { now (this league year), total, years } (non-guaranteed: nothing
// before January)
export function cutCost(F, p, { stretch = false } = {}) {
  if (!p || p.tw) return { now: 0, total: 0, years: 0 }
  const day = dayOf(F)
  if (p.ng && (F.phase === 'off' || day < (F.days ?? 170) * 0.45)) return { now: 0, total: 0, years: 0 }
  const rest = [p.$ ?? 0, ...(p.sc ?? [])].slice(0, p.y ?? 0)
  const total = r1(rest.reduce((a, v) => a + v, 0))
  if (!stretch || rest.length === 0) return { now: rest[0] ?? 0, total, years: rest.length }
  // stretched: in the offseason, everything over twice the seasons left plus one; in the season, this season stays,
  // the seasons after it stretch
  if (F.phase === 'off') {
    const yrs = rest.length * 2 + 1
    return { now: r1(total / yrs), total, years: yrs, stretch: true }
  }
  const later = rest.slice(1)
  const yrs = later.length * 2 + 1
  return { now: rest[0], total, years: later.length ? yrs + 1 : 1, stretch: true, later: later.length ? r1(later.reduce((a, v) => a + v, 0) / yrs) : 0 }
}
// waive him: off the roster to the pool; what's owed stays on the cap (team.dead: { n, $ a season, y seasons }).
// Returns the dead money this league year.
export function cutMan(F, short, id, { stretch = false } = {}) {
  const team = F.teams?.[short]
  const p = team?.r.find(x => x.i === id)
  if (!p) return 0
  const c = cutCost(F, p, { stretch })
  team.dead ??= []
  const cy = capYear(F)
  const put = (v, from, to, st = 0) => team.dead.push({ n: p.n, $: r1(v), y: to - cy + 1, from, to, ...(st && { st: 1 }) })
  if (c.total > 0) {
    if (!c.stretch) {
      // (each season as it was: the per-season average carries the same total)
      put(c.total / c.years, cy, cy + c.years - 1)
    } else if (F.phase === 'off') put(c.now, cy, cy + c.years - 1, 1)
    else {
      put(c.now, cy, cy)
      if (c.later > 0) put(c.later, cy + 1, cy + c.years - 1, 1)
    }
  }
  team.r = team.r.filter(x => x !== p)
  // (on the street: any team can sign him; no rights carry with him)
  for (const k of ['$', 'y', 'sc', 'opt', 'rs', 'rfa', 'tw', 'mh', 'ng', 'ntc', 'ext']) delete p[k]
  p.$ = 0; p.y = 0; p.bird = 0
  p.wv = capYear(F)
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
      if (!inn && (p.o ?? 0) >= 75) news.push({ k: 'option', tag: 'FREE AGENCY', s, text: `${p.n} declines his player option with the ${s} and will become a free agent.` })
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
      fa.$ = 0
      fa.y = 0
      for (const k of ['sc', 'opt', 'rs', 'mh', 'ng', 'ntc', 'ext', 'tw', 'rfa']) delete fa[k]
      if (restricted) {
        // the qualifying offer: 130% of a rookie deal's last salary (125% for anyone else), the minimum + $0.2M at least
        const qo = r1(Math.max(minOf(fa.ys ?? 0, nx) + 0.2, fa.$l * (fa.rsl ? 1.3 : 1.25)))
        const wants = s === F.team ? true : worthOf(F, fa, nx) >= qo * 0.9
        if (wants) { fa.rfa = 1; fa.qo = qo }
      }
      ;(F.fa ??= []).push(fa)
    }
    team.r = keep
  }
  // (a man in the pool a year or more with no team: his rights are gone)
  for (const p of F.fa ?? []) if (p.hy != null && p.hy < nx) { delete p.fr; delete p.hy; delete p.rfa; delete p.qo; delete p.rsl }
  return Object.assign(gone, { news })
}
// renounce him: his hold off the books, his rights gone (an RFA becomes unrestricted)
export function renounce(F, short, id) {
  const p = (F.fa ?? []).find(x => x.i === id && x.fr === short)
  if (!p) return false
  p.rn = 1
  delete p.rfa
  delete p.qo
  return true
}
// what he asks the GM's team to re-sign (his market; a man coming off a rookie deal or with Bird rights may give a
// little back to stay; a man who wants out asks for more). null when the GM's team holds no rights to him.
// THE MARKET THIS SUMMER: the most any other team could pay him now (its cap room, else its mid-level or
// bi-annual, else the minimum), the best of the league's. A free agent's price can't outrun it: when the room is gone,
// so is the money, and he takes what's there or goes back to his own team for less than his rating says.
const CH = new WeakMap()
function channels(F) {
  const year = capYear(F)
  const key = `${year}|${F.phase}|${F.off?.step ?? ''}|${F.fay === year ? F.fad ?? 0 : 0}`
  const c = CH.get(F)
  if (c?.key === key) return c.m
  const m = {}
  for (const s of shortsOf(F)) {
    // (the room it could clear: its payroll without the holds it would renounce)
    const pay = payroll(F, s, year, { holds: false })
    const room = capOf(year) - pay
    const e = excFor(F, s, year)
    const mle = e.mk ? e.mle ?? 0 : pay < apron1Of(year) ? excOf('nt', year) : pay < apron2Of(year) ? excOf('tp', year) : 0
    const full = standardOf(F.teams[s]).length >= ROSTER_MAX
    m[s] = full ? 0 : Math.max(room, mle, e.bae > 0.05 && e.baeY !== year - 1 && pay < apron1Of(year) ? e.bae : 0)
  }
  CH.set(F, { key, m })
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
  const y = Math.min(own === 'bird' ? 5 : 4, termFor(p) + ((p.ag ?? 27) <= 27 && rankOf(F, p) <= 60 ? 1 : 0))
  const $ = r1(clamp(minOf(p.ys ?? 0, year), maxOf(p.ys ?? 0, year, { superMax: own === 'bird' && superMaxOk(F, p, s), last: p.$l ?? 0 }), mv * tilt))
  return { $, y, r: raiseMax(own), via: own }
}
