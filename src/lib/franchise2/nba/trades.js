// NBA FRANCHISE: trades (the football mode's value approach and its protections, with the NBA's rules).
//
// THE WINDOW: the offseason (from the Finals on, draft night included) and the regular season through the deadline
// day (F.ddl). Never in the play-in or the playoffs.
//
// THE RULES (checkTrade), for each team, after the trade:
//   - salary matching, when it ends up over the cap: it takes back at most 200% of what it sends + $250K (sending up
//     to $7.5M), what it sends + $7.5M (up to $29M), 125% + $250K past that (the 2023 CBA's brackets, indexed to the
//     cap since 2023-24). A team still under the cap after it absorbs freely (and up to its room + $250K past it).
//     Over the first apron: 100%. Over the second: 100%, and it can't aggregate two salaries to take one back. A man
//     on a minimum deal (two years or less) comes in on the minimum exception, no salary back. A trade exception
//     (team.tpe) can take in salary with nothing going back, the team no further than the first apron after.
//   - hard caps: a team hard-capped (contracts.js exc.hc) can't end up over its line; taking back more than it sends
//     hard-caps a team at the first apron, aggregating salaries at the second.
//   - trade exceptions: a team over the cap that sends out more than it takes back gets one for the difference (each
//     man's salary matched against what comes in, the biggest first), good for a year (calDay + 365).
//   - rosters: 15 standard deals at most (21 men in the offseason), 13 at least in the season, 3 two-way.
//   - recently signed men: a free agent (or a man re-signed) can't be traded until December 15 or three months after
//     he signed, whichever is later; a draft pick's rights can be dealt on draft night, then not for 30 days after he
//     signs (from camp on); an offer sheet his team matched, not for a year (p.osm); a man traded for can't have his
//     salary combined with others for two months (p.txd); a man the GM's team traded for can't go back to the team it
//     got him from this league year (no buy-backs).
//   - picks: only a team's own (as owned now); a top-N protection may be put on a first as it's traded; a swap right
//     (the other team may swap its first for this team's first that year; once per pick, and it goes with the pick if
//     it's sold: the holder's pick carries sw.with, the giver's sw.by); the Stepien rule (never without a first
//     in two drafts running); a team over the second apron can't trade its first seven drafts out (frozen).
//   - a man with a no-trade clause can't be moved without his say (the league's teams don't ask).
//
// WHAT A MAN IS WORTH (manValue, a scale where the No. 1 pick is 160 and the 30th 20): where he ranks in the league
// on a curve that climbs fast at the top (contracts.js WORTH: the best players are worth more than the max), by his
// age (the prime he has left over the years he's signed: a productive veteran on a short deal loses little), by his
// deal (what he's paid against what he's worth over the years he's signed, an option year the way its holder will
// use it; an expiring deal in the season is a rental; a man paid far past his worth is a burden, worth less than
// nothing), and by his health (the share of this season he'll miss, more of an expiring deal's value).
// WHAT HE GIVES NOW (nowValue): his level today, for the rest of the season he'll be there for: a contender's measure.
// WHAT A PICK IS WORTH (pickValue): the chart at the slot it should land (the standings and the team's strength;
// further out, toward the middle), a protection's odds of conveying, and a year's discount for each draft out.
//
// WHAT A TEAM SEES (teamSide): the same values moved by its situation (contending, in the mix, rebuilding: a
// rebuilder wants picks and youth and pays little for veterans; a contender pays for a man who plays now and won't
// let one of its own go for less than he gives it this season), its
// rotation (a man who wouldn't play for it is worth half), the tax its payroll would cost (a taxpayer gains from
// shedding salary), and a package of players counted the way the league counts it: the best one whole, the rest
// less (75%, 55%, 40%...), so three backups never add up to a star.
//
// A DEAL (cpuAnswer): the league team takes it when what it gets beats what it gives by its margin (7%, more for
// every deal it's already made with the GM's team this league year); a star goes only for a real piece back; a man
// it just traded for stays put; a man the GM's team just traded for is worth no more than it paid; a contender
// doesn't take a deal that leaves it weaker for the rest of the season (nowStrength). Short by a
// reachable amount, it counters (asks for a pick, or takes something off its side).
//
// THE LEAGUE'S OWN DEALS: contenders buy veterans from rebuilders for picks and salary filler before the deadline
// (cpuDeadline: almost none before December 15, about half in the deadline's last week, deadline day included); in
// the summer, taxpayers move bad money to teams with room, with a pick for their trouble
// (salaryDumps).
//
// State: F.picks (core) [{ y, r, o, t, pr: { top, rl? } | null, sw: { with } | { by } | null }] · F.trl [deal log]
// · F.trc { team: [day, turned-down calls] } · p.tx [team he came from, league year, day, paid (the GM's side's
// value)] · p.txd (calDay he was traded) · p.osm ({ s, y }: the team whose offer sheet was matched, the league year) · team.tpe [{ $, n, until }]
import { rngOf, clamp, r1 } from '../rng'
import { capOf, apron1Of, apron2Of, payroll, capYear, standardOf, twoWaysOf, hitOf, taxBill, taxOf, isRepeater, hardCapOf, minOf } from './cap'
const minOfY = year => minOf(5, year)
import { rankOf, rankAt, worthAt, scoreOf, worthOf, marketValue, situationOf, teamStrength, excFor, ROSTER_MAX, OFF_MAX, TWO_WAY_MAX, dayOf, cutMan } from './contracts'

const shortsOf = F => Object.keys(F.teams ?? {})
// (the league's own deals collect their wire items here while cpuDeadline / salaryDumps run)
let SINK = null
const PKG = [1, 0.75, 0.55, 0.4, 0.3, 0.2]
export const TRADE_MAX = 6                // (players and picks a side)
const CALLS = 6, DEALS_WITH = 3
const ROUND = ['first', 'second']

// ── The window ───────────────────────────────────────────────────────────────
export function tradeWindow(F) {
  if (!F?.teams) return { open: false, why: '' }
  if (F.phase === 'season') {
    if (F.pend) return { open: false, why: 'Game in progress' }
    if (F.ddl != null && (F.day ?? 0) > F.ddl) return { open: false, why: 'The trade deadline has passed. Trades reopen after the Finals.' }
    return { open: true, left: F.ddl != null ? F.ddl - (F.day ?? 0) : null }
  }
  if (F.phase === 'off') return { open: true, off: true }
  return { open: false, why: 'No trades during the postseason.' }
}
// the league year a trade is filed in
const lyOf = F => capYear(F)

// ── The calendar inside the season (core's day index) ────────────────────────
// core's day index counts calendar days from opening night (F.cal0); without it, a 174-day season, December 15 on
// day 55
const SEASON_DAYS = 174
const dayScale = F => (F.days ?? SEASON_DAYS) / SEASON_DAYS
export const dec15 = F => (F.cal0 ? Math.round((Date.UTC(F.year, 11, 15) - F.cal0) / 86400000) : Math.round(55 * dayScale(F)))
const months3 = F => (F.cal0 ? 91 : Math.round(90 * dayScale(F)))
// a calendar count of days across seasons, for the CBA's rules counted in days (two months, thirty days, a year):
// the season's days from opening night (about October 21), the offseason's stops at about their dates (the Finals
// over in mid-June, the draft late in June, free agency from July 1, camp in late September)
const OFF_DAY = { awards: 236, lottery: 238, draft: 246, resign: 252, fa: 254, camp: 330, done: 345 }
const DRAFT_DAY = OFF_DAY.draft
const yearBase = F => ((F.year ?? 2026) - 2000) * 365
export function calDay(F) {
  const base = yearBase(F)
  if (F.phase === 'season') return base + Math.round(F.cal0 ? F.day ?? 0 : (F.day ?? 0) / dayScale(F))
  if (F.phase === 'off') return base + (OFF_DAY[F.off?.step] ?? 300) + (F.off?.step === 'fa' ? Math.min(10, (F.fad ?? 0) * 2) : 0)
  return base + 200
}
// a man drafted this summer, on the deal he signed at the draft (a first-rounder's scale, a second-rounder's
// standard or two-way deal)
const pickDeal = p => p.rk != null && p.sgn === p.rk && (p.rs || p.dr?.[0] === p.rk)
const draftedNow = (F, p) => F.phase === 'off' && p.rk === F.year + 1 && pickDeal(p)
// when a recently signed man can be traded (a day index; -1 = now; Infinity = not this offseason)
export function tradableFrom(F, p) {
  // (a draft pick: on draft night his rights can be dealt; once he signs, thirty days after, so from August on,
  // and all of his rookie season)
  if (draftedNow(F, p)) return F.off?.step === 'draft' || calDay(F) >= yearBase(F) + DRAFT_DAY + 30 ? -1 : Infinity
  if (pickDeal(p)) return -1
  // (an offer sheet his team matched: not for a year)
  if (p.osm != null && (p.osm.y ?? p.osm) === lyOf(F)) return Infinity
  if (p.sgn == null || p.sgn !== lyOf(F)) return -1
  // (the spring, before the league year turns over: everyone signed last summer or in the season is past it)
  if (F.phase === 'off' && F.sed !== F.year) return -1
  const at = p.sgd ?? -1
  if (at < 0) return dec15(F)
  return Math.max(dec15(F), at + months3(F))
}
// why a recently signed man can't go yet (or null)
function lockText(F, p) {
  const from = tradableFrom(F, p)
  if (from < 0 || (from !== Infinity && F.phase === 'season' && (F.day ?? 0) >= from)) return null
  if (draftedNow(F, p)) return `${p.n} signed his rookie contract this summer and can't be traded until 30 days after he signed`
  if (p.osm != null && (p.osm.y ?? p.osm) === lyOf(F)) return `${p.n}'s offer sheet was matched this summer: he can't be traded for a year`
  return `${p.n} signed recently and can't be traded until ${from === Infinity || from <= dec15(F) ? 'December 15' : 'three months after he signed'}`
}
// a man acquired in a trade can't be combined with other salaries in another trade for two months
const AGG_DAYS = 60
const aggLocked = (F, p) => p.txd != null && calDay(F) - p.txd < AGG_DAYS

// ── Picks ────────────────────────────────────────────────────────────────────
// a deal's pick entry: an index into F.picks, or { i, top: N } (a protection put on it as it's traded), or
// { swap: year } (the right to swap firsts that year, from the team giving it)
const pIdx = e => (typeof e === 'number' ? e : e?.i ?? null)
export const nextDraft = F => (F.phase === 'off' && (F.drd === F.year + 1 || F.drafts?.[F.year + 1]) ? F.year + 2 : F.year + 1)
export const picksOf = (F, s) => (F.picks ?? []).map((k, i) => ({ ...k, i })).filter(k => k.t === s && k.y >= nextDraft(F))
// a team's first in a draft, for the Stepien rule (an unprotected first it owns, its own or another's)
const hasFirst = (picks, s, y) => picks.some(k => k.y === y && k.r === 1 && k.t === s && !k.pr)
export function stepienOk(F, s, picks = F.picks ?? []) {
  const y0 = nextDraft(F)
  const last = Math.max(y0, ...picks.map(k => k.y))
  for (let y = y0; y < last; y++) if (!hasFirst(picks, s, y) && !hasFirst(picks, s, y + 1)) return false
  return true
}
// where a team's pick should land in its round (1 = first): the standings in the season, the team's strength in the
// offseason; drafts further out drift to the middle
const PJ = new WeakMap()
function projOrder(F) {
  const key = `${F.year}|${F.phase}|${F.day ?? 0}|${F.off?.step ?? ''}`
  const c = PJ.get(F)
  if (c?.key === key) return c.m
  const S = shortsOf(F)
  const str = Object.fromEntries(S.map(s => [s, teamStrength(F, s)]))
  const mean = S.reduce((a, s) => a + str[s], 0) / S.length
  const rec = Object.fromEntries(S.map(s => [s, { w: 0, l: 0 }]))
  for (const g of F.sched ?? []) if (g.hs != null) { const hw = g.hs > g.as; rec[g.h] && (hw ? rec[g.h].w++ : rec[g.h].l++); rec[g.a] && (hw ? rec[g.a].l++ : rec[g.a].w++) }
  const proj = s => { const r = rec[s], g = r.w + r.l, ex = clamp(0.15, 0.85, 0.5 + (str[s] - mean) * 0.045); return (r.w + ex * Math.max(0, 82 - g)) / Math.max(82, g) }
  const o = [...S].sort((a, b) => proj(a) - proj(b))
  const m = Object.fromEntries(o.map((s, i) => [s, i + 1]))
  PJ.set(F, { key, m })
  return m
}
// the chart (slot 1..60)
const CHART = [[1, 160], [2, 135], [3, 120], [4, 105], [5, 95], [6, 86], [7, 78], [8, 72], [9, 66], [10, 61], [14, 46], [20, 32], [25, 25], [30, 20], [31, 9], [40, 5], [50, 3], [60, 1.5]]
export function slotValue(n) {
  if (n <= 1) return CHART[0][1]
  for (let i = 1; i < CHART.length; i++) {
    const [a, va] = CHART[i - 1], [b, vb] = CHART[i]
    if (n <= b) return va + (vb - va) * (n - a) / (b - a)
  }
  return 1.5
}
// a pick's value, any team's: { v, slot (expected), conv (the odds a protected pick conveys) }
export function pickValue(F, k) {
  if (!k) return { v: 0 }
  const out = k.y - nextDraft(F)
  const n = shortsOf(F).length || 30
  // (the order's set: the slot itself)
  if (k.n) return { v: slotValue(k.n) * (k.pr?.top && (k.n - (k.r - 1) * n) <= k.pr.top ? 0.25 : 1), slot: k.n, conv: 1 }
  const now = projOrder(F)[k.o] ?? (n + 1) / 2
  const mid = (n + 1) / 2
  const w = out <= 0 ? (F.phase === 'season' ? 0.75 : 0.85) : out === 1 ? 0.4 : 0.15
  const slot = w * now + (1 - w) * mid
  const sd = out <= 0 ? (F.phase === 'season' ? 4 : 5) : 8
  // the odds of every slot in its round (a normal around the projection), the protection's cut
  let v = 0, conv = 0, tot = 0
  for (let s = 1; s <= n; s++) {
    const pdf = Math.exp(-0.5 * ((s - slot) / sd) ** 2)
    tot += pdf
    const val = slotValue(k.r === 1 ? s : n + s)
    if (k.pr?.top && s <= k.pr.top) { v += pdf * val * 0.25; continue }  // (it rolls to the next year: a quarter of it)
    conv += pdf
    v += pdf * val
  }
  v /= tot
  conv /= tot
  // (a swap on it: sw.with, its owner may swap it for that team's first, so it's worth a little more; sw.by, that
  // team may swap its first for this one, so it's worth a little less)
  if (k.sw?.with) v *= 1.06
  else if (k.sw?.by) v *= 0.9
  // (a draft further out is a guess, and a front office discounts it: the 2033 first is worth about half of next June's)
  return { v: v * Math.pow(0.9, Math.max(0, out)), slot, conv }
}

// ── What a man is worth ──────────────────────────────────────────────────────
// the league's scale: his rank's worth (a share of the cap) on a curve
// (a young man is traded for what he'll be: his ceiling counts more than the market's one-year read of it)
function tradeRank(F, p) {
  const ag = p.ag ?? 27, o = p.o ?? 60
  if (ag > 23) return rankOf(F, p)
  const extra = clamp(0, 10, ((p.pk ?? o) - o) * (ag <= 20 ? 0.45 : ag <= 22 ? 0.35 : 0.25)) - clamp(0, 6, ((p.pk ?? o) - o) * (ag <= 21 ? 0.4 : 0.3))
  return Math.min(rankOf(F, p), rankAt(F, scoreOf(p) + Math.max(0, extra)))
}
const talentPts = (F, p) => { const w = worthAt(F, tradeRank(F, p)) / capOf(capYear(F)); return 100 * Math.pow(Math.max(0, w) / 0.3, 1.7) }
// (the market's rank already marks an older man down for what he is now: scoreOf takes a point or so a year off
// past 31. This is the prime he has left over the years he's signed for. A productive veteran on a short deal
// loses less of it: he only has to be good for the seasons he's paid for)
const AGE_F = [[22, 1.25], [23, 1.2], [24, 1.15], [25, 1.1], [26, 1.05], [27, 1], [28, 0.96], [29, 0.92], [30, 0.88], [31, 0.84], [32, 0.8], [33, 0.75], [34, 0.7], [35, 0.66], [36, 0.62]]
function ageF(p, yrs = 2) {
  const a = p.ag ?? 27
  const base = a <= 22 ? 1.25 : AGE_F.find(([x]) => x === a)?.[1] ?? 0.58
  if (base >= 1) return base
  const soft = clamp(0.45, 1, 1 - ((p.o ?? 60) - 80) * 0.04) * (yrs <= 1 ? 0.6 : yrs === 2 ? 0.8 : 1)
  return 1 - (1 - base) * soft
}
const salaries = (p, n = 9) => [p.$ ?? 0, ...(p.sc ?? [])].slice(0, Math.min(n, p.y ?? 0))
// the books' season that each of his salaries is for (an option year is marked by p.opt.yr)
const optAt = (F, p, k) => (p.opt && p.opt.yr != null && capYear(F) + k >= p.opt.yr ? p.opt.k : null)
// his deal against his worth: { f (a multiplier), burden (pts a team carries for the overpay) }
// (an option year counts the way the option's holder will use it: a team option is the team's to drop if he isn't
// worth it, so it's upside only; a player option is his to walk away from if he's worth more, so it's downside only)
function dealOf(F, p) {
  const sal = salaries(p, 4)
  if (!sal.length) return { f: 0, burden: 0 }
  const W = worthOf(F, p)
  const yrs = sal.length
  let sur = 0, tot = 0, over = 0
  sal.forEach((s, k) => {
    const wk = W * Math.pow(p.ag >= 30 ? 0.88 : p.ag <= 24 ? 1.06 : 0.98, k), dk = Math.pow(0.85, k)
    const o = optAt(F, p, k)
    const d = o === 'T' ? Math.max(0, wk - s) : o === 'P' ? Math.min(0, wk - s) : wk - s
    sur += d * dk; tot += wk * dk
    if (o !== 'T') over += Math.max(0, s - wk * 1.05) * dk
  })
  let f = clamp(0.35, 1.5, 1 + 0.6 * sur / Math.max(1, tot))
  // (an expiring deal: the rest of a season, then his Bird rights; a rookie deal comes with restricted free agency)
  if (yrs === 1 && !p.rs) f *= F.phase === 'season' ? 0.6 + 0.4 * (1 - (F.day ?? 0) / (F.days ?? SEASON_DAYS)) : 0.85
  // (a rookie-scale deal is cheap control however he's playing: never a burden)
  if (p.rs) return { f: Math.min(1.4, Math.max(0.8, f) * 1.1), burden: 0, yrs }
  return { f, burden: over * 0.8, yrs }
}
// ── Injuries ─────────────────────────────────────────────────────────────────
// the games his team has left this season (the next season's 82 in the offseason)
const GL = new WeakMap()
function gamesLeft(F, s) {
  if (F.phase !== 'season') return 82
  const key = `${F.year}|${F.day ?? 0}`
  let c = GL.get(F)
  if (c?.key !== key) {
    const m = {}
    for (const g of F.sched ?? []) if (g.hs == null) { m[g.h] = (m[g.h] ?? 0) + 1; m[g.a] = (m[g.a] ?? 0) + 1 }
    c = { key, m }
    GL.set(F, c)
  }
  return c.m[s] ?? 0
}
const teamOfMan = (F, p) => Object.keys(F.teams).find(s => F.teams[s].r.includes(p))
// his share of what's left of this season he'll be there for: 1 healthy, 0 out through the playoffs; { now, out }
// (out: the games he'll miss; a long one, like a torn Achilles, leaves a doubt about the man who comes back)
export function availOf(F, p, s = null) {
  const g = p?.inj?.g ?? 0
  if (!(g > 0) || F.noInj) return { now: 1, out: 0, left: null }
  const left = gamesLeft(F, s ?? teamOfMan(F, p))
  // (the regular season's games left and a playoff run's 16: the playoffs count double for a team playing for them)
  const reg = Math.max(0, left - g), po = Math.max(0, 16 - Math.max(0, g - left))
  const now = clamp(0, 1, (reg + po * 2) / Math.max(1, left + 32))
  return { now, out: g, left, season: g >= left }
}
function injF(F, p, yrs) {
  const a = availOf(F, p)
  if (a.now >= 1) return 1
  // (this season's part of his value: most of an expiring deal, a share of a long one)
  const share = clamp(0.25, 0.9, 1.2 / Math.max(1, yrs))
  return (1 - share * (1 - a.now)) * (a.out >= 50 ? 0.9 : 1)
}
// his value on the league's scale (the gauge's number); can be below zero for a bad contract
export function manValue(F, p) {
  if (!p || p.tw) return p?.tw ? 1 : 0
  const d = dealOf(F, p)
  return talentPts(F, p) * ageF(p, d.yrs) * d.f * injF(F, p, d.yrs) - d.burden
}
// what he gives a team this season (a contender's measure): his level now, whatever his age, for the part of the
// season (and the playoffs) he'll be there for; an overpaid man's money still counts against it a little
export function nowValue(F, p, s = null) {
  if (!p || p.tw) return 0
  const w = worthAt(F, rankAt(F, p.o ?? 60)) / capOf(capYear(F))
  const pts = 100 * Math.pow(Math.max(0, w) / 0.3, 1.7)
  const rest = F.phase === 'season' ? 0.55 + 0.45 * (1 - (F.day ?? 0) / (F.days ?? SEASON_DAYS)) : 1
  return pts * rest * availOf(F, p, s).now * 0.8 - dealOf(F, p).burden * 0.5
}
// tradeValue(F, man | pick, forTeam): the value to a team (its situation and rotation in it), or the league's
export function tradeValue(F, x, forTeam = null) {
  if (x == null) return 0
  const k = typeof x === 'number' ? F.picks?.[x] : x.y != null && x.r != null && x.o ? x : null
  if (k) return pickValue(F, k).v * (forTeam ? pickMod(situationOf(F, forTeam)) : 1)
  if (!forTeam) return manValue(F, x)
  return inValue(F, forTeam, x, new Set(), situationOf(F, forTeam))
}
const pickMod = sit => (sit === 'reb' ? 1.15 : sit === 'win' ? 0.85 : 1)

// ── A team's side of a deal ──────────────────────────────────────────────────
function rotationRoom(F, s, gone) {
  return F.teams[s].r.filter(x => !x.tw && !gone.has(x.i)).map(x => x.o ?? 60).sort((a, b) => b - a)
}
function inValue(F, s, p, gone, sit) {
  const room = rotationRoom(F, s, gone)
  const ahead = room.filter(o => o > (p.o ?? 60)).length
  const role = ahead < 5 ? 1.05 : ahead < 8 ? 0.9 : ahead < 10 ? 0.6 : 0.3
  let m = 1
  if (sit === 'reb') m = p.ag >= 29 ? 0.55 : p.ag >= 27 ? 0.8 : p.ag <= 24 ? 1.15 : 1
  else if (sit === 'win') m = p.ag >= 25 && ahead < 8 ? 1.12 : 1
  let v = manValue(F, p)
  // (a contender pays for what he gives it this season, not for the man he'll be; one hurt for the stretch run is
  // worth what he'll be next year, less)
  if (sit === 'win') {
    const a = availOf(F, p)
    if (a.now < 1 && v > 0) v *= 1 - 0.5 * (1 - a.now)
    if (ahead < 8) v = Math.max(v, nowValue(F, p, s) * 0.6)
  }
  let out = v > 0 ? v * role * m : v * (sit === 'reb' ? 0.7 : sit === 'win' ? 1.25 : 1)
  // (a man the GM's team just traded for: nobody pays more than it did, this league year)
  if (s !== F.team && p.tx?.[3] != null && p.tx[1] === lyOf(F)) out = Math.min(out, p.tx[3] * 0.95)
  return out
}
function outValue(F, s, p, sit) {
  const room = rotationRoom(F, s, new Set())
  const at = room.filter(o => o > (p.o ?? 60)).length
  let m = 1
  if (sit === 'reb') m = p.ag >= 29 ? 0.7 : p.ag <= 24 ? 1.2 : 1
  else if (sit === 'win') m = at < 8 ? 1.15 : 1
  // (a cornerstone: young and among the league's best)
  if (rankOf(F, p) <= 20 && (p.ag ?? 30) <= 27) m *= 1.3
  const v = manValue(F, p)
  // (a contender's rotation man is worth what he gives it now: it doesn't sell this season for the future)
  if (sit === 'win' && at < 8) return Math.max(v > 0 ? v * m : v, nowValue(F, p, s) * (at < 5 ? 0.8 : 0.65))
  return v > 0 ? v * m * (at < 10 ? 1 : 0.8) : v
}
// a team's strength for the rest of this season after a deal: contracts.js teamStrength's read of its top eight, on
// the men who'll play (one out for the stretch run counts as a replacement)
const SW8 = [1, 1, 0.9, 0.8, 0.7, 0.55, 0.45, 0.35]
export function nowStrength(F, s, outIds = new Set(), inMen = []) {
  const r = [...F.teams[s].r.filter(p => !p.tw && !outIds.has(p.i)), ...inMen.filter(p => !p.tw)]
    .map(p => (availOf(F, p, s).now < 0.5 ? 55 : p.o ?? 60)).sort((a, b) => b - a)
  return SW8.reduce((a, x, k) => a + x * (r[k] ?? 55), 0) / SW8.reduce((a, x) => a + x, 0)
}
// the tax a payroll change saves (or costs) team s this season and the next, in value points (1 point per $2M)
function taxSwing(F, s, outMen, inMen) {
  if (F.noCap && s === F.team) return 0
  const y = capYear(F)
  let pts = 0
  for (const k of [0, 1]) {
    const yr = y + k
    const pay = payroll(F, s, yr)
    const d = inMen.reduce((a, p) => a + (salaries(p)[k] ?? 0), 0) - outMen.reduce((a, p) => a + (salaries(p)[k] ?? 0), 0)
    const rep = isRepeater(F.teams[s], yr)
    const before = taxBill(pay - taxOf(yr), yr, rep), after = taxBill(pay + d - taxOf(yr), yr, rep)
    // (the money itself counts too, a little: an owner pays every dollar of salary)
    pts += ((before - after) * 0.5 - d * 0.12) * (k ? 0.6 : 1) * (F.phase === 'season' && k === 0 ? 1 - (F.day ?? 0) / (F.days ?? SEASON_DAYS) * 0.5 : 1)
  }
  return pts
}
export function teamSide(F, s, inn, out) {
  const sit = s === F.team ? 'mid' : situationOf(F, s)
  const gone = new Set(out.pl.map(p => p.i))
  const ins = inn.pl.map(p => ({ p, v: inValue(F, s, p, gone, sit) })).sort((a, b) => b.v - a.v)
  const pos = ins.filter(x => x.v > 0), neg = ins.filter(x => x.v <= 0)
  const vIn = pos.reduce((a, x, j) => a + x.v * (PKG[j] ?? 0.2), 0) + neg.reduce((a, x) => a + x.v, 0) + inn.pk.reduce((a, k) => a + pickValue(F, k).v * pickMod(sit), 0)
  const vOut = out.pl.reduce((a, p) => a + outValue(F, s, p, sit), 0) + out.pk.reduce((a, k) => a + pickValue(F, k).v * pickMod(sit), 0)
  const tax = taxSwing(F, s, out.pl, inn.pl)
  // (more men in than out: a roster spot each)
  const cost = Math.max(0, inn.pl.filter(p => !p.tw).length - out.pl.filter(p => !p.tw).length) * 2
  const why = ins.length && ins[0].v > 0 && sit === 'reb' && ins[0].p.ag >= 29 ? 'reb' : null
  return { in: vIn, out: vOut, tax, cost, gain: vIn - vOut + tax - cost, sit, why, ins }
}

// ── Salary matching ──────────────────────────────────────────────────────────
// what a team sending `out` ($M) may take back, by the line it ends up at
export function matchLimit(F, s, out, after, year = capYear(F)) {
  const ix = capOf(year) / 136.021
  if (after > apron2Of(year)) return out
  if (after > apron1Of(year)) return out   // (over the first apron: no more back than goes out, the 2023 CBA)
  const t1 = 7.5 * ix, t2 = 29 * ix
  if (out <= t1) return out * 2 + 0.25 * ix
  if (out <= t2) return out + 7.5 * ix
  return out * 1.25 + 0.25 * ix
}
// a man on a minimum deal of two years or less: a team over the cap can take him in with the minimum exception,
// no salary going back for him
export const onMinimum = (p, year) => !p.tw && (p.y ?? 0) >= 1 && (p.y ?? 0) <= 2 && hitOf(p, year, year) > 0 && hitOf(p, year, year) <= minOf(p.ys ?? 0, year) + 0.05
// a team's trade exceptions still good (team.tpe [{ $, n, until }]; until a calDay)
export const tpesOf = (F, s) => (F.teams[s]?.tpe ?? []).filter(x => x.until > calDay(F) && x.$ > 0.05)
// one team's side of the rules: { ok, why, O, I, after, hc1 (it takes back more than it sends: hard-capped at the
// first apron), tpe (the exception it absorbs into), agg }
function sideRules(F, s, outMen, inMen, outPk, inPk, cuts = 0) {
  const year = capYear(F)
  const team = F.teams[s]
  const free = F.noCap && s === F.team
  const O = outMen.reduce((a, p) => a + hitOf(p, year, year), 0)
  const I = inMen.reduce((a, p) => a + hitOf(p, year, year), 0)
  const pay = payroll(F, s, year)
  const after = pay - O + I
  const cap = capOf(year)
  // (the men it takes in on the minimum exception need no salary back)
  const IM = I - inMen.filter(p => onMinimum(p, year)).reduce((a, p) => a + hitOf(p, year, year), 0)
  const big = Math.max(0, ...outMen.map(p => hitOf(p, year, year)))
  const agg = !free && outMen.length >= 2 && IM > big + 0.001 && after > cap + 0.001
  let hc1 = false, tpe = null
  if (!free && I > 0.001) {
    if (after > cap + 0.001 && IM > 0.001) {
      const room = pay < cap ? O + cap - pay + 0.25 : 0
      const lim = Math.max(matchLimit(F, s, O, after, year), room)
      if (IM > lim + 0.001) {
        // (a trade exception can absorb it instead: all the salary coming in under one exception, nothing combined
        // with it, and the team no further than the first apron after)
        const fit = tpesOf(F, s).filter(x => IM <= x.$ + 0.001).sort((x, y) => x.$ - y.$)[0]
        if (fit && after <= apron1Of(year) + 0.001) tpe = fit
        else return { ok: false, why: `The ${s} would take back $${r1(IM)}M for $${r1(O)}M out; they can take back $${r1(lim)}M at most`, k: 'match' }
      }
      // (taking back more than it sends, past what its room covers: hard-capped at the first apron, the 2023 CBA)
      if (IM > O + 0.001 && IM > room + 0.001) hc1 = true
      // (no aggregating over the second apron: two salaries out to take one bigger one back)
      if (after > apron2Of(year) && agg) return { ok: false, why: `The ${s} would be over the second apron: they can't combine salaries in a trade`, k: 'agg' }
      // (a man it traded for in the last two months can't be combined with other salaries yet)
      const lock = agg && !tpe ? outMen.find(p => aggLocked(F, p)) : null
      if (lock) return { ok: false, why: `${lock.n} was traded for in the last two months: his salary can't be combined with others in a trade yet`, k: 'agg' }
    }
    // (a hard-capped team keeps room for the minimum deals that fill it out: core fills the league's to 15)
    const st0 = standardOf(team).filter(p => !outMen.includes(p)).length + inMen.filter(p => !p.tw).length
    const fill = F.phase === 'off' ? Math.max(0, (s === F.team ? 14 : 15) - st0) * minOfY(year) : 0
    const hc = Math.min(hardCapOf(F, s, year), hc1 ? apron1Of(year) : Infinity, agg ? apron2Of(year) : Infinity) - fill
    if (after > hc + 0.001) return { ok: false, why: `The ${s} would go over their hard cap`, k: 'hard' }
  }
  // rosters
  const st = standardOf(team).filter(p => !outMen.includes(p)).length + inMen.filter(p => !p.tw).length
  const tw = twoWaysOf(team).filter(p => !outMen.includes(p)).length + inMen.filter(p => p.tw).length
  if (F.phase === 'off' ? st + tw > OFF_MAX : st > ROSTER_MAX + cuts) return { ok: false, why: `The ${s} would have too many players (${F.phase === 'off' ? '21 in the offseason' : '15 standard contracts'})`, k: 'roster' }
  if (F.phase === 'season' && st < 13) return { ok: false, why: `The ${s} would be under 13 players`, k: 'roster' }
  if (tw > TWO_WAY_MAX) return { ok: false, why: `The ${s} would have more than 3 two-way players`, k: 'roster' }
  // frozen pick (over the second apron: its first seven drafts out)
  const frozenY = nextDraft(F) + 6
  if (!free && (after > apron2Of(year) || pay > apron2Of(year)) && outPk.some(k => k.r === 1 && k.y >= frozenY)) return { ok: false, why: `The ${s} are over the second apron: their first-round pick seven years out is frozen`, k: 'frozen' }
  return { ok: true, O, I, IM, after, hc1, tpe, agg, big }
}
// the picks after a deal (for the Stepien check and to make it): [Pick]
function picksAfter(F, deal) {
  const P = (F.picks ?? []).map(k => ({ ...k }))
  const move = (list, to, from) => {
    for (const e of list ?? []) {
      if (e?.swap != null) {
        // (core's way: the holder's own first carries sw: { with: the giver }; it takes the better of the two)
        const hold = P.find(k => k.y === e.swap && k.r === 1 && k.o === to && k.t === to)
        const giv = P.find(k => k.y === e.swap && k.r === 1 && k.o === from)
        if (hold && giv) { hold.sw = { with: from }; giv.sw = { by: to } }
        continue
      }
      const i = pIdx(e)
      if (i == null || !P[i]) continue
      P[i].t = to
      if (e?.top) P[i].pr = { top: e.top }
    }
  }
  move(deal.pa, deal.b, deal.a)
  move(deal.pb, deal.a, deal.b)
  return P
}
// the whole deal: { ok, why, k }
export function checkTrade(F, deal) {
  const W = tradeWindow(F)
  if (!W.open) return { ok: false, why: W.why, k: 'shut' }
  const { a, b } = deal
  if (!a || !b || a === b || !F.teams[a] || !F.teams[b]) return { ok: false, why: 'Pick a team', k: 'team' }
  const am = (deal.ga ?? []).map(id => F.teams[a].r.find(p => p.i === id)), bm = (deal.gb ?? []).map(id => F.teams[b].r.find(p => p.i === id))
  if (am.some(p => !p) || bm.some(p => !p)) return { ok: false, why: 'A player in the deal is no longer there', k: 'gone' }
  const n = am.length + bm.length + (deal.pa ?? []).length + (deal.pb ?? []).length
  if (!n) return { ok: false, why: 'Add players or picks', k: 'empty' }
  if (am.length + (deal.pa ?? []).length > TRADE_MAX || bm.length + (deal.pb ?? []).length > TRADE_MAX) return { ok: false, why: `${TRADE_MAX} players and picks a side at most`, k: 'many' }
  for (const [s, men] of [[a, am], [b, bm]]) for (const p of men) {
    const w = whyNot(F, s, p)
    if (w) return { ok: false, why: w, k: 'man', who: p }
  }
  // picks: owned, real, not twice, protections on firsts only
  for (const [s, list] of [[a, deal.pa ?? []], [b, deal.pb ?? []]]) {
    const seen = new Set()
    for (const e of list) {
      if (e?.swap != null) {
        const o = s === a ? b : a
        const mine = (F.picks ?? []).find(k => k.y === e.swap && k.r === 1 && k.o === s && k.t === s)
        const theirs = (F.picks ?? []).find(k => k.y === e.swap && k.r === 1 && k.o === o && k.t === o)
        if (!mine || !theirs || mine.pr || theirs.pr) return { ok: false, why: `A ${e.swap} swap needs both teams to own their own unprotected first`, k: 'pick' }
        // (one swap a pick: a first already promised in a swap can't be promised again)
        if (mine.sw || theirs.sw) return { ok: false, why: `A ${e.swap} first in the deal already carries a swap`, k: 'pick' }
        if (seen.has(`sw${e.swap}`)) return { ok: false, why: 'A swap is in the deal twice', k: 'pick' }
        seen.add(`sw${e.swap}`)
        continue
      }
      const i = pIdx(e), k = F.picks?.[i]
      if (!k || k.t !== s || k.y < nextDraft(F)) return { ok: false, why: 'A pick in the deal has changed hands', k: 'pick' }
      if (seen.has(i)) return { ok: false, why: 'A pick is in the deal twice', k: 'pick' }
      seen.add(i)
      if (e?.top != null && (k.r !== 1 || k.pr || e.top < 1 || e.top > 29)) return { ok: false, why: 'Protections go on unprotected first-round picks (top 1 to 29)', k: 'pick' }
    }
  }
  const pk = (list) => (list ?? []).filter(e => e?.swap == null).map(e => F.picks[pIdx(e)])
  const ra = sideRules(F, a, am, bm, pk(deal.pa), pk(deal.pb), deal.cut?.[a] ?? 0)
  if (!ra.ok) return ra
  const rb = sideRules(F, b, bm, am, pk(deal.pb), pk(deal.pa), deal.cut?.[b] ?? 0)
  if (!rb.ok) return rb
  const P = picksAfter(F, deal)
  for (const s of [a, b]) if (!stepienOk(F, s, P)) return { ok: false, why: `The Stepien rule: the ${s} can't go two straight drafts without a first-round pick`, k: 'stepien' }
  return { ok: true, a: ra, b: rb }
}
// why a man can't be traded now (or null)
export function whyNot(F, s, p) {
  if (!p) return 'No such player'
  if (p.b != null && s === F.team && F.lockBuilds) return `${p.n} is the franchise's own build`
  if (p.ntc) return `${p.n} has a no-trade clause`
  return lockText(F, p)
}

// ── The league team's answer ─────────────────────────────────────────────────
const dealsWith = (F, s) => (F.trl ?? []).filter(d => d.ly === lyOf(F) && d.u && (d.a === s || d.b === s)).length
const dealsAll = F => (F.trl ?? []).filter(d => d.ly === lyOf(F) && d.u).length
const callKey = F => `${lyOf(F)}-${F.phase}-${F.phase === 'season' ? Math.floor((F.day ?? 0) / 7) : F.off?.step ?? ''}`
const callsLeft = (F, s) => { const c = F.trc?.[s]; return c && c[0] === callKey(F) ? CALLS - c[1] : CALLS }
const marginOf = (F, s, out, user = true) => (user ? Math.max(4, out * 0.07) * (1 + 0.6 * dealsWith(F, s) + 0.1 * dealsAll(F)) : Math.max(2, out * 0.03))
function resolve(F, deal) {
  const am = (deal.ga ?? []).map(id => F.teams[deal.a].r.find(p => p.i === id)).filter(Boolean)
  const bm = (deal.gb ?? []).map(id => F.teams[deal.b].r.find(p => p.i === id)).filter(Boolean)
  const ak = (deal.pa ?? []).map(e => (e?.swap != null ? { swap: e.swap } : { ...F.picks[pIdx(e)], ...(e?.top && { pr: { top: e.top } }) }))
  const bk = (deal.pb ?? []).map(e => (e?.swap != null ? { swap: e.swap } : { ...F.picks[pIdx(e)], ...(e?.top && { pr: { top: e.top } }) }))
  return { am, bm, ak, bk }
}
// a swap right's value to its holder: what the better of the two picks adds, about a fifth of a pick in the middle
const swapValue = (F, giver, y) => { const o = projOrder(F)[giver] ?? 15; const out = y - nextDraft(F); return Math.max(2, (20 - o) * 0.9 + 6) * Math.pow(0.9, Math.max(0, out)) }
const pkList = (F, list, giver) => list.map(k => (k.swap != null ? { y: k.swap, r: 1, o: giver, sw: 1, _swap: swapValue(F, giver, k.swap) } : k))
// team s (deal.b, the league's team) on a deal with deal.a: { yes, why, short, side, need }
export function decide(F, deal, { user = true } = {}) {
  const { a, b } = deal
  const { am, bm, ak, bk } = resolve(F, deal)
  const ly = lyOf(F)
  if (user && dealsWith(F, b) >= DEALS_WITH) return { yes: false, why: 'done' }
  // no buy-backs: a man this team traded away this league year doesn't come back
  const back = am.find(p => p.tx?.[0] === b && p.tx[1] === ly)
  if (back) return { yes: false, why: 'back', who: back }
  // a man it just traded for isn't going back out
  const fresh = bm.find(p => p.tx && p.tx[1] === ly && p.tx[2] != null && (F.phase !== 'season' || (F.day ?? 0) - p.tx[2] < 40))
  if (fresh) return { yes: false, why: 'new', who: fresh }
  const inPk = pkList(F, ak, a), outPk = pkList(F, bk, b)
  const side = teamSide(F, b, { pl: am, pk: inPk.filter(k => !k._swap) }, { pl: bm, pk: outPk.filter(k => !k._swap) })
  const sw = inPk.reduce((x, k) => x + (k._swap ?? 0), 0) - outPk.reduce((x, k) => x + (k._swap ?? 0), 0)
  side.in += Math.max(0, sw); side.out += Math.max(0, -sw); side.gain += sw
  if (side.in <= 0.5 && side.tax <= 1) return { yes: false, why: 'nothing', side, short: Infinity }
  // a contender doesn't take a step back this season, whatever the future it's offered
  if (side.sit === 'win' && bm.length) {
    const before = nowStrength(F, b), after = nowStrength(F, b, new Set(bm.map(p => p.i)), am)
    if (after < before - (F.phase === 'season' ? 0.25 : 0.4)) return { yes: false, why: 'win', side, short: Infinity, who: [...bm].sort((x, y) => (y.o ?? 0) - (x.o ?? 0))[0] }
  }
  // a star goes only for a real piece back: one player or pick worth at least half of him
  const top = Math.max(0, ...bm.map(p => outValue(F, b, p, side.sit)))
  if (user && top >= 60) {
    const best = Math.max(0, ...side.ins.map(x => x.v), ...inPk.map(k => (k._swap ?? pickValue(F, k).v) * pickMod(side.sit)))
    if (best < top * 0.5) return { yes: false, why: 'star', side, short: Infinity, who: [...bm].sort((x, y) => (y.o ?? 0) - (x.o ?? 0))[0] }
  }
  const need = marginOf(F, b, side.out, user)
  const short = need - side.gain
  return { yes: short <= 0, why: short <= 0 ? 'yes' : side.why ?? 'short', short, side, need }
}
export function sayOf(F, s, d) {
  const N = s, who = d.who?.n
  if (d.yes) return `The ${N} accept. The deal is done.`
  switch (d.why) {
    case 'done': return `The ${N} are done dealing with the ${F.team} this season.`
    case 'back': return `The ${N} traded ${who} away this season. They won't take him back.`
    case 'new': return `The ${N} just traded for ${who}. He isn't going anywhere.`
    case 'calls': return `The ${N} have stopped taking calls this week.`
    case 'nothing': return `The ${N} want something back.`
    case 'star': return `The ${N} want a front-line player or a high pick for ${who}, not depth.`
    case 'reb': return `The ${N} are rebuilding. They want picks and young players, not veterans.`
    case 'win': return `The ${N} are playing for this season. They won't move ${who ?? 'him'} for a step back.`
    default: return d.short <= (d.need ?? 5) * 1.5 ? `The ${N} want a little more.` : `The ${N} say the offer isn't close.`
  }
}
// the league team's answer to the GM's proposal: { yes, counter?, why, text }
export function cpuAnswer(F, deal) {
  const c = checkTrade(F, deal)
  if (!c.ok) return { yes: false, why: c.k, text: c.why }
  const d = decide(F, deal)
  if (d.yes) return { yes: true, why: 'yes', text: sayOf(F, deal.b, d), side: d.side }
  const ct = counterOf(F, deal, d)
  return { yes: false, why: d.why, text: ct ? `The ${deal.b} came back with a counter.` : sayOf(F, deal.b, d), ...(ct && { counter: ct }), short: d.short }
}
// a counter within reach: one of the GM's picks added (the cheapest that covers it), or one thing off the league
// team's side; the one that moves the gauge least
export function counterOf(F, deal, d) {
  if (!d.side || !(d.short > 0) || d.short > Math.max(60, d.side.out * 0.8)) return null
  if (d.why !== 'short' && d.why !== 'reb') return null
  const tries = []
  const used = new Set((deal.pa ?? []).map(pIdx))
  for (const k of picksOf(F, deal.a)) if (!used.has(k.i)) tries.push({ ...deal, pa: [...(deal.pa ?? []), k.i] })
  if ((deal.gb ?? []).length + (deal.pb ?? []).length >= 2) {
    for (const id of deal.gb ?? []) tries.push({ ...deal, gb: deal.gb.filter(x => x !== id) })
    for (const e of deal.pb ?? []) tries.push({ ...deal, pb: deal.pb.filter(x => x !== e) })
  }
  let best = null
  const base = gauge(F, deal)
  for (const t of tries) {
    if (!checkTrade(F, t).ok) continue
    const e = decide(F, t)
    if (!e.yes) continue
    const g = gauge(F, t)
    const moved = (g.a - base.a) + (base.b - g.b)
    if (!best || moved < best.moved) best = { t, moved }
  }
  return best ? { a: best.t.a, b: best.t.b, ga: best.t.ga ?? [], gb: best.t.gb ?? [], pa: best.t.pa ?? [], pb: best.t.pb ?? [] } : null
}
// the gauge: what each side sends, the league's way: { a, b, lean (-1 a gives far more .. 1 a gets far more) }
const pkg = vals => { const s = [...vals].sort((x, y) => y - x); return s.filter(v => v > 0).reduce((t, v, j) => t + v * (PKG[j] ?? 0.2), 0) + s.filter(v => v <= 0).reduce((t, v) => t + v, 0) }
export function gauge(F, deal) {
  const { am, bm, ak, bk } = resolve(F, deal)
  const pv = (list, giver) => pkList(F, list, giver).reduce((t, k) => t + (k._swap ?? pickValue(F, k).v), 0)
  const ga = pkg(am.map(p => manValue(F, p))) + pv(ak, deal.a)
  const gb = pkg(bm.map(p => manValue(F, p))) + pv(bk, deal.b)
  const lean = Math.abs(ga) + Math.abs(gb) > 0 ? clamp(-1, 1, (gb - ga) / Math.max(Math.abs(ga), Math.abs(gb), 8)) : 0
  return { a: ga, b: gb, lean }
}

// ── Making a trade ───────────────────────────────────────────────────────────
const posOf = p => p.p ?? (p.g === 'big' ? 'C' : 'G')
const andList = a => (a.length <= 1 ? a[0] ?? '' : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)
function pickWords(F, k, giver) {
  if (k.swap != null) return `the right to swap ${k.swap} first-round picks`
  const prot = k.pr?.top ? ` (top-${k.pr.top} protected)` : ''
  return k.o === giver ? `a ${k.y} ${ROUND[k.r - 1]}-round pick${prot}` : `the ${k.o}' ${k.y} ${ROUND[k.r - 1]}-round pick${prot}`
}
export function tradeLine(F, deal) {
  const { am, bm, ak, bk } = resolve(F, deal)
  // (picks the way a report lists them: the firsts before the seconds, the nearest year first; swaps last)
  const order = list => [...list].sort((x, y) => (x.swap != null) - (y.swap != null) || (x.r ?? 1) - (y.r ?? 1) || (x.y ?? x.swap ?? 0) - (y.y ?? y.swap ?? 0))
  const got = andList([...bm.map(p => `${posOf(p)} ${p.n}`), ...order(bk).map(k => pickWords(F, k, deal.b))])
  const gave = andList([...am.map(p => `${posOf(p)} ${p.n}`), ...order(ak).map(k => pickWords(F, k, deal.a))])
  if (!gave) return `The ${deal.a} acquire ${got} from the ${deal.b}`
  if (!got) return `The ${deal.a} send ${gave} to the ${deal.b}`
  return `The ${deal.a} acquire ${got} from the ${deal.b} for ${gave}`
}
// make it (no checks: checkTrade and cpuAnswer first). Returns { line, news: [the wire's item] }.
export function doTrade(F, deal, { user = null } = {}) {
  const ly = lyOf(F)
  const { a, b } = deal
  const { am, bm } = resolve(F, deal)
  const line = tradeLine(F, deal)
  const g = gauge(F, deal)
  const isUser = user ?? (a === F.team || b === F.team)
  // the books: aggregating salaries over the cap hard-caps a team at the second apron; taking back more than it
  // sends, at the first; an exception it absorbs a man into is used up; sending out more than it takes back, over
  // the cap, makes a trade exception for the difference (good for a year)
  const year = capYear(F), now = calDay(F)
  for (const [s, out, inn] of [[a, am, bm], [b, bm, am]]) {
    if (F.noCap && s === F.team) continue
    const sr = sideRules(F, s, out, inn, [], [])
    const team = F.teams[s]
    if (sr.agg || sr.hc1) {
      const e = excFor(F, s, year)
      if (sr.hc1) e.hc = 'a1'
      else if (e.hc !== 'a1') e.hc = 'a2'
    }
    team.tpe = (team.tpe ?? []).filter(x => x.until > now && x.$ > 0.05)
    if (sr.tpe) {
      const x = team.tpe.find(t => t.until === sr.tpe.until && t.n === sr.tpe.n && Math.abs(t.$ - sr.tpe.$) < 0.001)
      if (x) x.$ = r1(Math.max(0, x.$ - (sr.IM ?? 0)))
      team.tpe = team.tpe.filter(t => t.$ > 0.05)
      continue
    }
    if (sr.after > capOf(year) + 0.001 && !sr.agg && out.length) {
      // (each man out matched against what comes in, the biggest salary first; what's left of each is an exception)
      let left = sr.IM ?? 0
      for (const p of [...out].sort((x, y) => hitOf(y, year, year) - hitOf(x, year, year))) {
        const h = hitOf(p, year, year), used = Math.min(h, left)
        left -= used
        if (h - used >= 0.5) team.tpe.push({ $: r1(h - used), n: p.n, until: now + 365 })
      }
    }
    if (!team.tpe.length) delete team.tpe
  }
  // (what the GM's side paid for each man it gets: shared by what each is worth)
  const paid = (men, sent) => { const vals = men.map(p => Math.max(0, manValue(F, p))), tot = vals.reduce((x, v) => x + v, 0); return vals.map(v => (tot > 0 ? sent * v / tot : 0)) }
  const paidA = a === F.team ? paid(bm, g.a) : [], paidB = b === F.team ? paid(am, g.b) : []
  const move = (p, from, to, pd) => {
    F.teams[from].r = F.teams[from].r.filter(x => x !== p)
    F.teams[to].r.push(p)
    // (Bird rights travel with him in a trade; the rookie-deal team for the supermax is the one that traded for him)
    if (p.rs) p.rt = to
    p.tx = [from, ly, F.phase === 'season' ? F.day ?? 0 : -1, ...(pd != null ? [Math.round(pd)] : [])]
    // (the day, for the two months before his salary can be combined with others in a trade)
    p.txd = now
  }
  am.forEach((p, j) => move(p, a, b, paidB[j] ?? null))
  bm.forEach((p, j) => move(p, b, a, paidA[j] ?? null))
  F.picks = picksAfter(F, deal)
  const ent = { ly, y: F.year, d: F.day ?? 0, ph: F.phase, a, b, ag: am.map(p => p.n), bg: bm.map(p => p.n), pa: deal.pa ?? [], pb: deal.pb ?? [], gv: [Math.round(g.a), Math.round(g.b)], mv: [am.map(p => Math.round(manValue(F, p))), bm.map(p => Math.round(manValue(F, p)))], t: line, ...(isUser && { u: 1 }) }
  F.trl = [...(F.trl ?? []).filter(d => d.ly >= ly - 1), ent]
  const item = { k: 'trade', tag: 'TRADE', s: a, text: line, ...([...am, ...bm].some(p => rankOf(F, p) <= 40) && { big: true }) }
  SINK?.push(item)
  F.trn = (F.trn ?? 0) + 1
  return { line, news: [item] }
}
// the GM proposes (deal.a = F.team): { ok (done), say: 'yes'|'no'|'counter'|'bad', text, counter }
export function proposeTrade(F, deal) {
  const c = checkTrade(F, deal)
  if (!c.ok) return { ok: false, say: 'bad', text: c.why }
  if (callsLeft(F, deal.b) <= 0) return { ok: false, say: 'no', text: sayOf(F, deal.b, { why: 'calls' }) }
  const ans = cpuAnswer(F, deal)
  if (ans.yes) { const t = doTrade(F, deal); return { ok: true, say: 'yes', text: ans.text, line: t.line, news: t.news } }
  const k = callKey(F), was = F.trc?.[deal.b]
  F.trc = { ...(F.trc ?? {}), [deal.b]: [k, was && was[0] === k ? was[1] + 1 : 1] }
  return { ok: false, say: ans.counter ? 'counter' : 'no', text: ans.text, counter: ans.counter ?? null, why: ans.why }
}

// ── The league's own deals ───────────────────────────────────────────────────
// salary filler: the team's least valuable men (out of its top seven) whose salaries make a deal legal for both
// sides; returns [men] or null
function fillerFor(F, s, need, avoid = new Set(), max = 3) {
  const year = capYear(F)
  // (the core stays: the team's best four; a deadline deal moves the rotation's mid-salary men, the way the league's do)
  const top7 = new Set(F.teams[s].r.filter(p => !p.tw).sort((x, y) => (y.o ?? 0) - (x.o ?? 0)).slice(0, 4).map(p => p.i))
  const pool = F.teams[s].r.filter(p => !p.tw && !top7.has(p.i) && !avoid.has(p.i) && !whyNot(F, s, p) && hitOf(p, year, year) > 0).sort((x, y) => (need > 12 ? hitOf(y, year, year) - hitOf(x, year, year) : 0) || manValue(F, x) - manValue(F, y))
  const out = []
  let sum = 0
  for (const p of pool) {
    if (sum >= need) break
    out.push(p); sum += hitOf(p, year, year)
    if (out.length >= max) break
  }
  return sum >= need ? out : null
}
// the fewest of team s's picks worth at least `want` to `to` (seconds first): [index] or null
function picksCover(F, s, want, to) {
  const mine = picksOf(F, s).map(k => ({ i: k.i, v: pickValue(F, k).v * pickMod(situationOf(F, to)), r: k.r })).sort((x, y) => x.v - y.v)
  if (want <= 0) return []
  // (never far past what's owed: a first isn't thrown in to cover a second's worth)
  const ok = v => v >= want && v <= want * 1.5 + 4
  for (const k of mine) if (ok(k.v)) return [k.i]
  for (let x = 0; x < mine.length; x++) for (let y = x + 1; y < mine.length; y++) if (ok(mine[x].v + mine[y].v)) return [mine[x].i, mine[y].i]
  return null
}
// one deal: rebuilding team a's veteran to contender b, for filler and picks (both sides by their own book; in the
// deadline's last week, `wide`, more of the seller's men are on the table and the buyer pays a little over its book)
function tryBuy(F, R, a, b, wide = false) {
  const year = capYear(F)
  const vets = F.teams[a].r.filter(p => !p.tw && !whyNot(F, a, p) && (p.ag ?? 0) >= 25 && rankOf(F, p) <= 230 && manValue(F, p) > 2 && !(p.tx && p.tx[1] === lyOf(F)))
  for (const p of R.shuffle(vets).slice(0, wide ? 5 : 3)) {
    // (the contender's filler, enough to match; none needed if it has the room)
    const sal = hitOf(p, year, year)
    const payB = payroll(F, b, year)
    let fill = []
    // (a trade exception big enough takes him in with nothing going back)
    const tpeOk = tpesOf(F, b).some(x => x.$ >= sal) && payB + sal <= apron1Of(year) && !onMinimum(p, year)
    if (payB + sal > capOf(year) && !tpeOk && !onMinimum(p, year)) {
      // smallest out that matches: invert the brackets (out such that limit(out) >= sal)
      let lo = 0, hi = sal * 1.2
      for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (matchLimit(F, b, m, payB - m + sal, year) >= sal) hi = m; else lo = m }
      fill = fillerFor(F, b, hi, new Set(), F.phase === 'season' ? 2 + (standardOf(F.teams[a]).length < 15 ? 1 : 0) : 4)
      if (!fill) continue
    }
    const cutN = F.phase === 'season' ? Math.max(0, standardOf(F.teams[a]).length - 1 + fill.length - ROSTER_MAX) : 0
    if (cutN > 2) continue
    const base = { a: b, b: a, ga: fill.map(x => x.i), gb: [p.i], pa: [], pb: [], ...(cutN && { cut: { [a]: cutN } }) }
    if (!checkTrade(F, base).ok) continue
    // the rebuilder's price, in the contender's picks
    const sideA = teamSide(F, a, { pl: fill, pk: [] }, { pl: [p], pk: [] })
    const want = -sideA.gain + marginOf(F, a, sideA.out, false)
    const pk = picksCover(F, b, want, a)
    if (pk == null) continue
    const deal = { ...base, pa: pk }
    if (!checkTrade(F, deal).ok) continue
    const dA = decide(F, { a: b, b: a, ga: deal.ga, gb: deal.gb, pa: deal.pa, pb: [] }, { user: false })
    const sideB = teamSide(F, b, { pl: [p], pk: [] }, { pl: fill, pk: pk.map(i => F.picks[i]) })
    if (!dA.yes) continue
    // (in the deadline's last week a buyer pays a little over its own book: its season is now)
    if (sideB.gain < (wide ? -0.1 * sideB.out : marginOf(F, b, sideB.out, false))) continue
    // (never a give-away the league would laugh at)
    const g = gauge(F, deal)
    if (g.a < g.b * 0.75 || g.b < g.a * 0.75) continue
    doTrade(F, deal, { user: false })
    // (the seller makes room: its lowest-paid, least-used men waived, the way a team clears a spot after a deadline deal)
    if (cutN) for (const m of standardOf(F.teams[a]).filter(x => !deal.ga.includes(x.i)).sort((x, y) => (x.$ ?? 0) - (y.$ ?? 0) || (x.o ?? 0) - (y.o ?? 0)).slice(0, cutN)) cutMan(F, a, m.i)
    return true
  }
  return false
}
// before the deadline (core calls it each day): the buyers and sellers talk, more as the deadline nears.
// Returns the wire items it added.
export function cpuDeadline(F, day = F.day ?? 0) {
  if (F.phase !== 'season' || F.ddl == null || day > F.ddl) return []
  SINK = []
  const R = rngOf(`${F.seed}-${F.year}-deadline-${day}`)
  const left = F.ddl - day
  // (the real league: 20-odd deals between opening night and the deadline, almost none before December 15, when
  // the summer's signings become tradable, and about half in the deadline's last week)
  const early = day < dec15(F)
  const tries = left === 0 ? 24 : left <= 2 ? 4 : left <= 7 ? 2 : left <= 21 ? 1 : early ? (R.u() < 0.015 ? 1 : 0) : R.u() < 0.2 ? 1 : 0
  for (let t = 0; t < tries; t++) {
    if (R.u() > (left <= 1 ? 0.9 : 0.75)) continue
    const S = shortsOf(F).filter(s => s !== F.team)
    const sellers = R.shuffle(S.filter(s => situationOf(F, s) === 'reb' || (situationOf(F, s) === 'mid' && R.u() < 0.3)))
    const buyers = R.shuffle(S.filter(s => situationOf(F, s) === 'win' || (situationOf(F, s) === 'mid' && R.u() < 0.4)))
    // (the deadline's last week: every front office is on the phone)
    const wide = left <= 7
    outer: for (const a of sellers.slice(0, wide ? 30 : 8)) for (const b of buyers.slice(0, wide ? 30 : 6)) if (a !== b && tryBuy(F, R, a, b, wide)) break outer
  }
  const out = SINK
  SINK = null
  // (deadline day: the taxpayers' salary dumps, a pick attached)
  if (left <= 1) out.push(...salaryDumps(F))
  return out
}
// the summer's trades between the league's teams (core can call it on any offseason stop; cpuOffseason does): a
// few veterans from rebuilders to contenders. Returns wire items.
export function summerTrades(F, n = 4) {
  SINK = []
  const R = rngOf(`${F.seed}-${capYear(F)}-summer-${F.off?.step ?? ''}`)
  const S = shortsOf(F).filter(s => s !== F.team)
  for (let t = 0; t < n * 2 && SINK.length < n; t++) {
    const sellers = R.shuffle(S.filter(s => situationOf(F, s) !== 'win'))
    const buyers = R.shuffle(S.filter(s => situationOf(F, s) !== 'reb'))
    outer: for (const a of sellers.slice(0, 6)) for (const b of buyers.slice(0, 5)) if (a !== b && tryBuy(F, R, a, b)) break outer
  }
  const out = SINK
  SINK = null
  return out
}
// the summer's salary dumps: a team over the tax line (or the second apron) sends a contract it would rather not
// pay to a team with the room to take it, with a pick for the trouble. Returns wire items.
export function salaryDumps(F) {
  SINK = []
  const year = capYear(F)
  const R = rngOf(`${F.seed}-${year}-dumps`)
  const S = shortsOf(F).filter(s => s !== F.team)
  let done = 0
  for (const a of R.shuffle(S)) {
    if (done >= 6) break
    const pay = payroll(F, a, year)
    if (pay <= taxOf(year) + 1) continue
    // its worst contracts, by what they cost against what they're worth
    // (only a contract that's a burden: a man worth more than he's paid is traded for value, not dumped)
    const bad = F.teams[a].r.filter(p => !p.tw && !whyNot(F, a, p) && (p.$ ?? 0) >= 6).map(p => ({ p, v: manValue(F, p) })).filter(x => x.v < 0).sort((x, y) => x.v - y.v).slice(0, 3)
    for (const { p } of bad) {
      const sal = hitOf(p, year, year)
      const takers = S.filter(b => b !== a && payroll(F, b, year) + sal <= capOf(year) + 0.25)
      let made = false
      for (const b of R.shuffle(takers).slice(0, 6)) {
        const base = { a, b, ga: [p.i], gb: [], pa: [], pb: [] }
        if (!checkTrade(F, base).ok) continue
        const sideB = teamSide(F, b, { pl: [p], pk: [] }, { pl: [], pk: [] })
        const want = -sideB.gain + marginOf(F, b, Math.abs(sideB.in), false)
        const pk = picksCover(F, a, want, b)
        if (pk == null) continue
        const deal = { ...base, pa: pk }
        if (!checkTrade(F, deal).ok || !decide(F, { a, b, ga: deal.ga, gb: [], pa: deal.pa, pb: [] }, { user: false }).yes) continue
        // (the sender: the tax it saves and the man it loses, against the picks)
        const sideA = teamSide(F, a, { pl: [], pk: [] }, { pl: [p], pk: pk.map(i => F.picks[i]) })
        if (sideA.gain < 0) continue
        doTrade(F, deal, { user: false })
        made = true
        done++
        break
      }
      if (made) break
    }
  }
  const out = SINK
  SINK = null
  return out
}
