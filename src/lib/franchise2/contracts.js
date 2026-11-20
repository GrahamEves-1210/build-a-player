// FRANCHISE: contracts and the salary cap, the NFL's way, kept simple.
//
//   A man's deal:  $ cap hit a year ($M) · y years left · g signing bonus a year (what's owed if he's cut)
//                  rc 1 on a rookie deal · op the fifth-year option (1 there to pick up, 2 picked up) · ox its price
//   The cap:       capOf(year): the real cap ($301.2M in 2026), up about five percent a year after that.
//   Cap used:      every man's cap hit + dead money + the rest of the 53 (the men the mode doesn't play: the
//                  backups past the 38th man, the punter, the snapper, at about the minimum).
//   Signing:       a team signs a man only when his cap hit fits under the cap (capRoom >= his $).
//   Cutting:       his cap hit comes off; his bonus still owed (g x years left) hits this year's cap as dead money.
//
//   Real players' deals come from src/data/nfl-contracts.json (cap hit and years left) when it's there, through
//   realDeal(); until then (and for anyone the file doesn't have) the market estimate below.
//   Rookies sign the rookie wage scale by their draft slot (four years; a first-rounder's fifth-year option).
//   The player's own builds are rookies: each signs the scale at the slot his OVR would have gone (buildSlot).
//   Free agents and re-signings ask what the market pays a man at that spot and rating (marketValue).
//
// (Nothing here reads league.js when it loads; league.js reads this back for worth().)
import { clamp, r1 } from './rng'
import { TEAM, SHORTS } from './league'   // (read only inside functions: league.js reads this file back)

// ── The cap ──────────────────────────────────────────────────────────────────
const CAP = { 2024: 255.4, 2025: 279.2, 2026: 301.2 }
export const capOf = year => CAP[year] ?? r1(CAP[2026] * Math.pow(1.05, year - 2026))
const scaleOf = year => capOf(year) / CAP[2026]
// the league minimum by experience (2026, $M), the floor of every deal
export const minimumFor = (ag, year = 2026) => r1((ag <= 22 ? 0.885 : ag <= 23 ? 0.885 : ag <= 24 ? 1.03 : ag <= 25 ? 1.105 : ag <= 27 ? 1.18 : ag <= 29 ? 1.255 : 1.38) * scaleOf(year))
// the men past the ones the mode plays (a 53-man roster): about the minimum each, and the specialists
export const ROSTER_FULL = 53
// (the punter and the long snapper: about $4.5M between them; the kicker is on the roster with his own deal; the
// practice squad, about $4.5M more. A depth man past the 38th costs about $1.4M: the veterans among them are paid
// over the minimum. The real 2026 teams carry a median $53M outside the men the mode rosters; this counts $31M of
// it, the rest being the cap each real team rolled over from 2025, which the mode doesn't carry.)
export const restOf53 = (n, year = 2026) => r1(Math.max(0, ROSTER_FULL - n) * 1.4 * scaleOf(year) + 9 * scaleOf(year))

// ── The market ───────────────────────────────────────────────────────────────
// What a man at this spot and rating makes a year on the open market (2026 $M): the top of each spot is the real
// top of the market (QB $60M, WR $40M, EDGE $41M, CB $30M, LT $30M, DT $32M…), down to the minimum.
const MARKET = {
  qb: [[99, 60], [95, 55], [91, 50], [88, 43], [85, 34], [82, 22], [78, 10], [74, 4.5], [70, 2], [60, 1]],
  rb: [[96, 20.6], [92, 15], [88, 10.5], [85, 7], [82, 4.5], [78, 2.4], [74, 1.3], [60, 1]],
  wr: [[99, 40], [96, 35], [92, 29], [89, 23], [86, 17], [83, 11], [80, 6.5], [77, 3.2], [73, 1.4], [60, 1]],
  te: [[97, 19.1], [93, 16], [89, 12.5], [86, 9.5], [83, 6.5], [80, 4], [77, 2.2], [73, 1.2], [60, 1]],
  ot: [[97, 30], [94, 26], [91, 21], [88, 16.5], [85, 12], [82, 7.5], [79, 4], [75, 1.8], [60, 1]],
  og: [[97, 22.5], [94, 20], [91, 16.5], [88, 13], [85, 9], [82, 5.5], [79, 3], [75, 1.5], [60, 1]],
  c: [[97, 18], [94, 16], [91, 13.5], [88, 10.5], [85, 7.5], [82, 4.5], [79, 2.6], [75, 1.4], [60, 1]],
  edge: [[99, 41], [96, 36], [93, 30], [90, 24], [87, 17.5], [84, 11.5], [81, 7], [78, 3.5], [74, 1.5], [60, 1]],
  dt: [[99, 32], [96, 28], [93, 24], [90, 19.5], [87, 14.5], [84, 9.5], [81, 5.5], [78, 2.8], [74, 1.3], [60, 1]],
  lb: [[99, 21], [96, 19], [93, 16], [90, 12.5], [87, 9], [84, 6], [81, 3.8], [78, 2.2], [74, 1.2], [60, 1]],
  cb: [[99, 30], [96, 26.5], [93, 22.5], [90, 18], [87, 13], [84, 8.5], [81, 5], [78, 2.6], [74, 1.3], [60, 1]],
  s: [[99, 21], [96, 19], [93, 16.5], [90, 13.5], [87, 10], [84, 6.5], [81, 4], [78, 2.2], [74, 1.2], [60, 1]],
  // (the kicker: the top of the market $7M a year, Aubrey's and Boswell's deals; a starter $2-4M)
  k: [[97, 7], [93, 6], [89, 5], [85, 4], [81, 3], [77, 2], [73, 1.3], [60, 1]],
}
// a man's market: his spot (a lineman by where he lines up)
export const marketKey = p => (p.p === 'ol' ? (p.s === 'C' ? 'c' : p.s === 'LG' || p.s === 'RG' ? 'og' : 'ot') : p.p === 'dl' ? (p.s === 'dt' ? 'dt' : 'edge') : p.p === 'db' ? (p.s === 's' ? 's' : 'cb') : p.p)
export const MARKET_LABEL = { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', ot: 'OT', og: 'OG', c: 'C', edge: 'EDGE', dt: 'DT', lb: 'LB', cb: 'CB', s: 'S', k: 'K' }
function curve(tab, o) {
  if (o >= tab[0][0]) return tab[0][1]
  for (let i = 1; i < tab.length; i++) {
    const [o1, v1] = tab[i - 1], [o2, v2] = tab[i]
    if (o >= o2) return v2 + (v1 - v2) * (o - o2) / (o1 - o2)
  }
  return tab[tab.length - 1][1]
}
// THE ROLE THE MARKET SEES (the starter's line): the OVR of the last man who starts at his spot league-wide (the
// 32nd QB, the 96th WR, the 64th EDGE...). A man at or over it is paid as a starter; a man under it is a backup
// and is paid like one, whatever the curve says: a backup QB $3-10M (the real No. 2s: Mariota, Mayfield's old
// Tampa deal, Minshew, Tyrod Taylor), a backup at any other spot at most half of what the last starter there makes.
// marketLines(F) reads the league as it is; without it, the 2026 league's lines.
export const STARTERS = { qb: 32, rb: 32, wr: 96, te: 32, ot: 64, og: 64, c: 32, edge: 64, dt: 64, lb: 64, cb: 96, s: 64, k: 32 }
export const LINE_2026 = { qb: 77, rb: 77, wr: 77, te: 76, ot: 77, og: 76, c: 76, edge: 77, dt: 77, lb: 76, cb: 77, s: 76, k: 74 }
const midOf = o => 1 + 0.4 * clamp(0, 1, (92 - o) / 12) * clamp(0, 1, (o - 70) / 6)
// HOW AGE PRICES HIM: the share of his rating's price a man that old gets. Backs fall first (28), quarterbacks last
// (34 on: Wilson at 36 $10.5M, Flacco at 39 $4M); a man still at the top of his spot holds more of it (Stafford,
// Rodgers: elite at 35+ is still paid). A kicker's leg lasts into his late 30s.
export function ageShare(p) {
  const a = p.ag, elite = p.o >= 90
  if (p.p === 'k') return a >= 39 ? 0.7 : a >= 37 ? 0.85 : 1
  let f
  if (p.p === 'qb') f = a <= 32 ? 1 : a === 33 ? 0.9 : a === 34 ? 0.75 : a === 35 ? 0.62 : a === 36 ? 0.5 : 0.4
  else if (p.p === 'rb') f = a <= 26 ? 1 : a === 27 ? 0.92 : a === 28 ? 0.78 : a === 29 ? 0.65 : a === 30 ? 0.5 : 0.4
  else f = a <= 29 ? 1 : a === 30 ? 0.88 : a === 31 ? 0.76 : a === 32 ? 0.64 : a === 33 ? 0.52 : 0.42
  return elite ? Math.min(1, Math.max(f, f + (p.p === 'qb' ? 0.3 : 0.15))) : f
}
// what the market pays him a year: his rating at his spot as a starter, a backup's price under the line, less for age
export function marketValue(p, year = 2026, L = null) {
  const k = marketKey(p), tab = MARKET[k] ?? MARKET.lb
  // (the middle of the market, a solid starter, is paid more than the stars' curve alone says: the real league
  // spends most of its cap on its starters, not just its stars)
  let base = curve(tab, p.o) * midOf(p.o)
  const line = L?.[k] ?? LINE_2026[k] ?? 76
  if (p.o < line) {
    // a backup: a QB within 8 of the line $3-10M, the rest the curve's price; anyone else at most half the last starter's
    base = p.p === 'qb' ? (p.o >= line - 8 ? 3 + 7 * (p.o - (line - 8)) / 8 : Math.min(3, base)) : Math.min(base, curve(tab, line) * midOf(line) * 0.5)
  }
  return r1(Math.max(minimumFor(p.ag, year), base * ageShare(p) * scaleOf(year)))
}
// a starter on the market (at or over his spot's line)
export const startsInLeague = (p, L = null) => p.o >= (L?.[marketKey(p)] ?? LINE_2026[marketKey(p)] ?? 76)
// ── The starter's line at each spot ──────────────────────────────────────────
// The OVR of the last man who starts at each market spot league-wide (contracts.js STARTERS: the 32nd QB, the 96th
// WR...): the market pays a man under it as a backup. Read from the league as it is, once a stage.
const LINES = new WeakMap()
export function marketLines(F) {
  const key = `${F.year}|${F.phase}|${F.stage ?? ''}`
  const c = LINES.get(F)
  if (c?.key === key) return c.L
  const by = {}
  for (const s of SHORTS) for (const p of F.teams[s].r) if (!p.fl) (by[marketKey(p)] ??= []).push(p.o)
  for (const p of F.fa ?? []) if (!p.fl) (by[marketKey(p)] ??= []).push(p.o)
  const L = { ...LINE_2026 }
  for (const [k, a] of Object.entries(by)) { a.sort((x, y) => y - x); if (a.length) L[k] = a[Math.min(a.length, STARTERS[k] ?? 32) - 1] }
  LINES.set(F, { key, L })
  return L
}

// how long a deal runs at his age
export const termFor = p => (p.p === 'k' ? (p.ag <= 30 ? 4 : p.ag <= 34 ? 3 : p.ag <= 37 ? 2 : 1) : p.ag <= 25 ? 4 : p.ag <= 27 ? (p.o >= 85 ? 5 : 4) : p.ag <= 29 ? 3 : p.ag <= 31 ? 2 : 1)
// the share of a deal that's signing bonus (what's still owed if he's cut): stars get more of it up front
export const bonusShare = $ => ($ >= 30 ? 0.42 : $ >= 15 ? 0.35 : $ >= 6 ? 0.25 : $ >= 2.5 ? 0.12 : 0)
// a deal on a man (a new contract replaces his old one)
export function signDeal(p, { $, y, g = null }) {
  p.$ = r1($); p.y = y; p.g = r1(g ?? $ * bonusShare($))
  delete p.rc; delete p.op; delete p.ox; delete p.sc
  return p
}
// An extension (a man in the last year of his deal): this year's deal stands, the new years start next year: y new
// years at $ a year (sc), the new bonus spread over every year he's now signed for. Dead money if he's cut is the
// bonus a year times the years left, as with any deal.
export function extendDeal(p, { $, y, g = null }) {
  const now = Math.max(1, p.y ?? 1)
  const bonus = r1(g ?? $ * bonusShare($))
  p.sc = [...(Array.isArray(p.sc) ? p.sc.slice(0, now - 1) : Array.from({ length: now - 1 }, () => p.$)), ...Array.from({ length: y }, () => r1($))]
  p.y = now + y
  p.g = r1(Math.max(p.g ?? 0, bonus * y / p.y))
  delete p.rc; delete p.op; delete p.ox
  return p
}
// a man's cap hit k league years from now (0: this one), on the deal he has (null past its end)
export function hitIn(p, k = 0) {
  if (k >= (p.y ?? 0)) return null
  if (k === 0) return p.$ ?? 0
  if (Array.isArray(p.sc) && p.sc[k - 1] != null) return p.sc[k - 1]
  if (p.op === 2 && p.ox && k === p.y - 1) return p.ox
  return p.$ ?? 0
}
// his ask to stay (re-signing) or to come (free agency): the market, a few percent more for a man in his prime; a
// backup asks for a year or two (L: the league's starter lines, marketLines)
export const askOf = (p, year = 2026, L = null) => ({ $: r1(marketValue(p, year, L) * (p.ag <= 29 && p.o >= 85 ? 1.05 : 1)), y: startsInLeague(p, L) ? termFor(p) : Math.min(2, termFor(p)) })

// ── Real players' deals ──────────────────────────────────────────────────────
// src/data/nfl-contracts.json, read once (whatever its exact shape: a list or a map by name; cap hit in dollars or
// $M; years left). Headless scripts hand it in with useContracts().
let REAL = null
let loaded = {}
try { loaded = import.meta.glob('../../data/nfl-contracts.json', { eager: true, import: 'default' }) } catch { loaded = {} }
export function useContracts(data) { REAL = index(data); if (data?.teamDead) DEAD = data.teamDead; return new Set(REAL.values()).size }
const money = v => {
  if (v == null || v === '') return null
  const x = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,M\s]/g, ''))
  return Number.isFinite(x) ? r1(x > 1000 ? x / 1e6 : x) : null
}
const keyOf = n => String(n ?? '').toLowerCase().replace(/[^a-z]/g, '')
function index(data) {
  const out = new Map()
  if (!data) return out
  if (data.players && !Array.isArray(data.players)) data = Object.values(data.players)
  const rows = Array.isArray(data) ? data : Array.isArray(data.players) ? data.players : Array.isArray(data.contracts) ? data.contracts
    : Object.entries(data).filter(([k]) => !k.startsWith('_')).map(([name, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? { name, ...v } : null)).filter(Boolean)
  for (const r of rows) {
    const $ = money(r.capHit ?? r.cap_hit ?? r.cap ?? r.capHit2026 ?? r.hit ?? r.apy ?? r.aav)
    const y = r.yearsLeft ?? r.years_left ?? r.yearsRemaining ?? r.years_remaining ?? r.years ?? r.y
    if (!r.name || !($ > 0)) continue
    const yy = clamp(1, 7, Math.round(+y || 1))
    // (a bonus a year as given, or the dead money if he were cut now spread over the years left)
    const per = money(r.proratedBonus ?? r.prorated ?? r.bonusPerYear), dead = money(r.dead ?? r.deadCap ?? r.dead_cap)
    const g = per ?? (dead != null ? r1(dead / yy) : null)
    const apy = money(r.apy ?? r.aav), total = money(r.total)
    const sc = realSchedule({ $, y: yy, g, apy, total, rookie: !!r.rookie })
    // (a first-rounder still on his rookie deal whose option hasn't come up yet: the 2024 class on; the 2023 class's
    // was decided before 2026)
    const opt = r.rookie && r.draft?.[1] === 1 && +r.draft[0] >= 2024
    out.set(`${keyOf(r.name)}|${String(r.team ?? '').toUpperCase()}`, { $, y: yy, g, ...(sc && { sc }), ...(r.rookie && { rc: 1 }), ...(opt && { op: 1 }), ...(r.draft?.[0] && { dy: +r.draft[0] }) })
    out.set(keyOf(r.name), out.get(keyOf(r.name)) ?? { $, y: yy, g, ...(sc && { sc }) })
  }
  return out
}
// A real deal's cap hits after this year (2026's is the file's own cap hit). The file has each deal's APY, total, the
// years left and the bonus proration, not its year-by-year salaries, so the years after 2026 are built the way real
// deals are shaped: they average the APY (a little over it in a deal's back half: a deal already under way has paid
// its cheap early years) and rise year on year, about 12% of the APY a year (a rookie deal's base salaries about 6%).
// A deal whose years after 2026 are all new money (an extension signed on top of 2026: Hutchinson, Gibbs, Campbell)
// carries its APY on average over them. Never under the bonus still being spread plus the minimum.
// (Hutchinson: $10.1M in 2026, then $39.6M, $43.2M, $46.8M, $50.4M: his $180M over 2027-30.)
export function realSchedule({ $, y, g = 0, apy = null, total = null, rookie = false }) {
  const n = y - 1
  if (n <= 0) return null
  if (!(apy > 0)) return Array.from({ length: n }, () => r1($))
  const L = total > 0 ? clamp(1, 7, Math.round(total / apy)) : y
  const fresh = y > L
  const mean = fresh ? apy : apy * (rookie ? 1.04 : 1.08)
  const slope = rookie ? 0.06 : 0.12
  return Array.from({ length: n }, (_, i) => r1(Math.max((g ?? 0) + 1, mean * (1 + slope * (i - (n - 1) / 2)))))
}
function realTable() {
  if (REAL) return REAL
  const data = Object.values(loaded)[0]
  REAL = index(data)
  return REAL
}
// A real man's deal as the league starts: the data file's when it has him, else the market's estimate
// (R: a seeded roll for the estimate's years)
export function realDeal(name, team, p, R) {
  const T = realTable()
  const hit = T.get(`${keyOf(name)}|${String(team ?? '').toUpperCase()}`) ?? T.get(keyOf(name))
  if (hit) return { $: hit.$, y: hit.y, g: hit.g ?? r1(hit.$ * bonusShare(hit.$)), ...(hit.sc && { sc: [...hit.sc] }), ...(hit.rc && { rc: 1 }), ...(hit.op && { op: 1 }), ...(hit.dy && { dy: hit.dy }), src: 'real' }
  return estimateDeal(p, R)
}
export const realContractsLoaded = () => realTable().size > 0
// what the data file says of a real man's career, for his age when the data has no birth year (league.js makeReal):
// { dy: the year he was drafted, or null; rc: on his rookie deal; found: the file has his deal at all }
export function realCareer(name, team) {
  const hit = realTable().get(`${keyOf(name)}|${String(team ?? '').toUpperCase()}`)
  return { dy: hit?.dy ?? null, rc: !!hit?.rc, found: !!hit }
}
// each team's real dead money on the 2026 cap (the file's teamDead): it sits on year one's cap, then it's gone
let DEAD = null
export function realTeamDead(short) {
  if (!DEAD) DEAD = Object.values(loaded)[0]?.teamDead ?? {}
  const v = money(DEAD[short])
  return v > 0 ? v : 0
}
export function seedDead(F) {
  for (const s of Object.keys(F.teams)) { const d = realTeamDead(s); if (d > 0) F.teams[s].dead = [['DEAD MONEY FROM PAST DEALS', d]] }
  F.dsc = 1   // (a new league's deals already rise as the real ones do: dealsOnLoad has nothing to do)
}
// A save from before the real deals rose (F.dsc unset): every real man still on the deal the league started him on
// (his 2026 cap hit, flat, the years run down by the seasons since) gets the rest of its real years, rising as they
// should; this year's cap hit is the one his deal has now. Anyone re-signed, extended or restructured since keeps
// what he signed. Once a save (F.dsc).
export function dealsOnLoad(F) {
  if (!F?.teams || F.dsc) return F
  const T = realTable()
  if (T.size) {
    for (const s of Object.keys(F.teams)) for (const p of F.teams[s].r) {
      if (p.sc || p.b != null || !(p.y > 0)) continue
      const hit = T.get(keyOf(p.n))
      if (!hit?.sc || Math.abs((p.$ ?? 0) - hit.$) > 0.05) continue
      const k = hit.y - p.y
      if (k < 0 || k >= hit.y) continue
      const rest = hit.sc.slice(Math.max(0, k - 1))
      if (k > 0) p.$ = rest.shift()
      if (p.y > 1 && rest.length) p.sc = rest.slice(0, p.y - 1)
    }
  }
  F.dsc = 1
  return F
}
// the estimate: what the market pays him, partway through a deal of the usual length
export function estimateDeal(p, R) {
  // (a man 24 or under is still on his rookie deal: the scale where a man of his rating goes, the years he has left)
  if (p.ag <= 24) {
    const d = rookieScale(buildSlot(p.o - (24 - p.ag), p.p))
    return { $: d.$, y: clamp(1, 4, 25 - p.ag), g: d.g, rc: 1, src: 'est' }
  }
  const $ = marketValue(p)
  const y = clamp(1, 5, Math.round(termFor(p) * (0.4 + (R ? R.u() : 0.5) * 0.8)))
  return { $, y, g: r1($ * bonusShare($)), src: 'est' }
}

// ── The rookie wage scale ────────────────────────────────────────────────────
// By overall pick (1 = the first pick), four years, a cap hit a year (2026 $M): No. 1 about $12.2M a year, the end
// of the first round $3.6M, the second round $2.8M down to $1.7M, the third $1.6M to $1.4M, then near the
// minimum. First-rounders' deals are guaranteed; a first-rounder has a fifth-year option.
export function rookieScale(pick, year = 2026) {
  const n = clamp(1, 262, Math.round(pick))
  let $
  if (n <= 32) $ = 3.6 + (12.2 - 3.6) * Math.pow((32 - n) / 31, 2.4)
  else if (n <= 64) $ = 2.8 - (n - 33) * (1.1 / 31)
  else if (n <= 102) $ = 1.62 - (n - 65) * (0.22 / 37)
  else $ = 1.36 - (n - 103) * (0.36 / 159)
  $ = Math.max(minimumFor(21, year), $ * scaleOf(year))
  const round = n <= 32 ? 1 : n <= 64 ? 2 : n <= 102 ? 3 : n <= 140 ? 4 : n <= 176 ? 5 : n <= 220 ? 6 : 7
  return { $: r1($), y: 4, g: r1($ * (round === 1 ? 0.9 : round === 2 ? 0.45 : round === 3 ? 0.2 : 0.08)), round, opt: round === 1 }
}
// a rookie's deal on him
export function signRookie(p, pick, year = 2026) {
  const d = rookieScale(pick, year)
  p.$ = d.$; p.y = d.y; p.g = d.g; p.rc = 1; delete p.sc
  if (d.opt) { p.op = 1; p.ox = null } else delete p.op
  return p
}
// A build's rookie deal (owner 11-15): the real NFL rookie scale, priced by his OVR. A 90 or better signs the No. 1
// pick's deal; below that the pay steps down the scale (an 85 about the 12th pick's, an 80 the 33rd's, a 75 the
// 61st's, a 70 the 95th's, a 60 the 176th's). The pick is only the scale's price point: it is never shown.
// A kicker is priced where kickers really go: the best one a 3rd-rounder's deal (Moody went 99th, Aguayo 59th, a reach
// everyone remembers), an 85 a 4th-rounder's, an 80 a 6th-rounder's, below that an undrafted man's.
export const buildSlot = (o, pos = null) => (pos === 'k' ? clamp(64, 262, Math.round(64 + Math.pow(Math.max(0, 92 - o), 1.4) * 4)) : o >= 90 ? 1 : clamp(1, 224, Math.round(1 + Math.pow(90 - o, 1.55) * 0.9)))
// ── The CBA's tenders: the franchise tag, the transition tag, the fifth-year option ────────────────────────────
// Each is an average of the top salaries at his spot as a share of the cap (the CBA's spots: QB RB WR TE OL DE DT
// LB CB S K/P), measured on the real 2026 cap hits (src/data/nfl-contracts.json) and moved with the cap:
//   tag    the franchise tag: the top 5's average (QB 14.8% of the cap, about $44.7M in 2026)
//   trans  the transition tag: the top 10's
//   l1     the 3rd to 20th highest
//   basic  the 3rd to 25th highest
const TENDER = {
  qb: [14.83, 13.52, 9.91, 8.51], rb: [4.3, 3.83, 2.91, 2.66], wr: [9.41, 8.01, 5.54, 5.02], te: [4.3, 3.67, 2.81, 2.62],
  ol: [8.96, 8, 6.5, 6.15], de: [9.63, 8.05, 5.79, 5.31], dt: [10.12, 8.3, 5.8, 5.27], lb: [6.69, 5.22, 3.52, 3.25],
  cb: [7.42, 6.19, 4.48, 4.1], s: [7.44, 5.78, 3.85, 3.42], k: [2.06, 1.71, 1.03, 0.88],
}
const cbaSpot = p => (p.p === 'ol' ? 'ol' : p.p === 'dl' ? (p.s === 'dt' ? 'dt' : 'de') : p.p === 'db' ? (p.s === 's' ? 's' : 'cb') : TENDER[p.p] ? p.p : 'lb')
const tender = (p, j, year) => r1(TENDER[cbaSpot(p)][j] / 100 * capOf(year))
// his Pro Bowls (an All-Pro year counts: he was on the ballot) and his playing time, from his career lines
// (awards.js p.cr: [year, team, games, ...his three numbers, honor]); a man with no lines kept is read by whether he
// starts now (starts: true / false)
export function optionTier(p, starts = null) {
  const cr = Array.isArray(p.cr) ? p.cr.slice(-3) : []
  const pb = cr.filter(r => (r[6] ?? 0) >= 1).length
  const full = cr.filter(r => (r[2] ?? 0) >= 13).length, half = cr.filter(r => (r[2] ?? 0) >= 9).length
  // (the CBA: 75% of the snaps in two of three seasons; 50% the same way. Games played stand in for the snaps)
  const pt = full >= 2 ? 2 : half >= 2 ? 1 : cr.length ? 0 : starts ? 2 : 0
  return pb >= 2 ? 'tag' : pb === 1 || pt === 2 ? 'trans' : pt === 1 ? 'l1' : 'basic'
}
// The fifth-year option's price (the 2020 CBA): two Pro Bowls, the franchise tag; one Pro Bowl or 75% playing time,
// the transition tag; 50% playing time, the 3rd-20th average; otherwise the 3rd-25th (a QB's basic option about 8.5%
// of the cap, not the 14% it was). Fixed when it's picked up, from that year's salaries (year: the league year then).
export function optionPrice(p, year, starts = null) {
  const t = optionTier(p, starts)
  return tender(p, t === 'tag' ? 0 : t === 'trans' ? 1 : t === 'l1' ? 2 : 3, year)
}
export const OPTION_TIER_TEXT = { tag: 'TWO PRO BOWLS: THE FRANCHISE TAG', trans: 'PRO BOWL OR FULL-TIME STARTER', l1: 'PART-TIME STARTER', basic: 'BASIC LEVEL' }

// ── A team's cap ─────────────────────────────────────────────────────────────
// team.dead: [[name, $M]] dead money on this year's cap
// (a deal with no years left is off the books: he's up for a new one)
export const payrollOf = team => r1(team.r.reduce((a, p) => a + (p.y > 0 ? p.$ ?? 0 : 0), 0))
// the league year the cap is for: the offseason is already next year's (the new league year starts in March, after
// the coaching changes and the awards: until then the books are the season just played, its deals and its dead money)
export const capYear = F => (F.phase === 'off' && F.stage !== 'coaches' && F.stage !== 'awards' ? F.year + 1 : F.year)
export const deadOf = team => r1((team.dead ?? []).reduce((a, d) => a + d[1], 0))
// ROLLOVER (the NFL's carryover): the room a team didn't use in a league year is added to its cap the next one, up
// to a tenth of the cap (a club sitting on $120M doesn't bank it all year after year).
// team.co: [league year, $M] (set when the league ages, aging.js; a save from before it has none)
export const CARRY_MAX = 0.1
export const carryOf = (team, yr) => (team?.co?.[0] === yr ? team.co[1] : 0)
export function setCarry(F) {
  for (const s of SHORTS) {
    const t = F.teams[s]
    if (!t) continue
    // (the season just played, F.year: called before the deals tick; the player's team with no salary cap carries
    // nothing, there's no cap to carry)
    const yr = F.year, room = capOf(yr) + carryOf(t, yr) - payrollOf(t) - deadOf(t) - restOf53(t.r.filter(p => p.y > 0).length, yr)
    t.co = F.noCap && s === F.team ? null : [yr + 1, r1(clamp(0, capOf(yr + 1) * CARRY_MAX, room))]
    if (!t.co?.[1]) delete t.co
  }
}
export function capSheet(F, short = F.team) {
  const t = F.teams[short], yr = capYear(F), base = capOf(yr), carry = carryOf(t, yr), cap = r1(base + carry)
  const pay = payrollOf(t), dead = deadOf(t), rest = restOf53(t.r.filter(p => p.y > 0).length, yr)
  const used = r1(pay + dead + rest)
  // (the league rule NO SALARY CAP, rules.js: the player's team signs whoever it likes; the league's teams keep theirs)
  if (F.noCap && short === F.team) return { cap: base, base, carry: 0, pay, dead, rest, used, room: NO_CAP_ROOM, year: yr, nocap: true }
  return { cap, base, carry, pay, dead, rest, used, room: r1(cap - used), year: yr }
}
export const capRoom = (F, short = F.team) => capSheet(F, short).room
export const NO_CAP_ROOM = 999
// the room k league years past this one, on the deals already signed (the men under contract then, the rest of the
// 53 around them): what a front office looks at before it extends a man
export function roomAhead(F, short, k = 1) {
  if (F.noCap && short === F.team) return NO_CAP_ROOM
  const t = F.teams[short], yr = capYear(F) + k
  const men = t.r.filter(p => (p.y ?? 0) > k)
  const pay = men.reduce((a, p) => a + (hitIn(p, k) ?? 0), 0)
  return r1(capOf(yr) - pay - restOf53(Math.max(men.length, 44), yr))
}
export const canSign = (F, $, short = F.team) => capRoom(F, short) >= $ - 1e-9
// the room the front office could still clear by restructuring (makeRoom's two passes), without doing it
export function restructurable(F, short = F.team) {
  return r1(F.teams[short].r.filter(x => x.y >= 2 && (x.$ ?? 0) >= 4 && !x.rc && x.rx !== F.year).reduce((a, p) => { const m = r1(p.$ * 0.4); return a + r1(m - m / Math.max(2, p.y)) }, 0))
}
// what cutting him does: his cap hit off, his bonus still owed on as dead money
export function cutCost(p) {
  const dead = r1((p.g ?? 0) * Math.max(1, p.y ?? 1))
  return { dead, saves: r1((p.$ ?? 0) - dead) }
}
// what a release really does to the room, the number the release screens show: his cap hit off, his dead money on,
// and the roster spot he leaves filled at about the minimum (the rest of the 53): a backup at the minimum saves
// nothing, a man with bonus left can cost room
export function cutRoom(F, p, short = F.team) {
  const t = F.teams[short], yr = capYear(F), n = t.r.filter(x => x.y > 0).length
  const spot = p.y > 0 ? restOf53(n - 1, yr) - restOf53(n, yr) : 0
  return r1((p.y > 0 ? p.$ ?? 0 : 0) - cutCost(p).dead - spot)
}
export function cutMan(F, id, short = F.team) {
  const t = F.teams[short], p = t.r.find(x => x.i === id)
  if (!p) return null
  const c = cutCost(p)
  t.r = t.r.filter(x => x !== p)
  if (c.dead > 0) (t.dead ??= []).push([p.n, c.dead])
  // the wire has it; in the offseason he's a free agent the market can sign
  F.news = [...(F.news ?? []), { k: 'cut', tag: 'RELEASED', s: short, text: `${TEAM[short]?.nick ?? short} release ${p.n}`, y: F.year, wk: F.wk }].slice(-40)
  if (F.phase === 'off' && Array.isArray(F.fa) && !p.fl) { p.$ = marketValue(p, F.year + 1); p.y = termFor(p); p.g = 0; delete p.rc; delete p.op; delete p.sc; F.fa.push(p) }
  return { p, ...c }
}
// Getting under the cap (a league team, by the start of the new league year): first restructures, the way NFL
// teams do it (part of a big salary turned into a bonus spread over his years plus one added year: less on this
// year's cap, more owed if he's cut later), then releases, the most cap saved for the least football lost: backups
// before starters, the old and overpaid first. starters: the ids that start (they go last).
//   returns [{ k: 'rs' | 'cut', n, saves }]
// Room made by restructures alone (the biggest deals first, a man once a year, three or more years left so the money
// isn't all piled on a deal's last year), until there's need of it: a club keeping a star does this before it lets
// him go. returns [{ k: 'rs', n, saves }]
// (last: a club still over the cap after its releases restructures anyone with two years left, at any age)
export function makeRoom(F, short, need = 0, last = false) {
  const t = F.teams[short], out = []
  let room = capRoom(F, short)
  for (const p of t.r.filter(x => x.y >= (last ? 2 : 3) && (x.$ ?? 0) >= (last ? 4 : 8) && !x.rc && (last || x.ag <= 30) && x.rx !== F.year).sort((a, b) => b.$ - a.$)) {
    if (room >= need) break
    const saves = restructure(p)
    p.rx = F.year
    room = r1(room + saves)
    out.push({ k: 'rs', n: p.n, saves })
  }
  return out
}
// (need: the room to get to, more than zero when the club is making room to keep a man)
export function capComply(F, short, starters = new Set(), need = 0) {
  const t = F.teams[short]
  let room = capRoom(F, short)
  if (room >= need) return []
  const out = makeRoom(F, short, need)
  room = capRoom(F, short)
  const worthCut = p => { const c = cutCost(p); return c.saves - (starters.has(p.i) ? 12 : 0) - Math.max(0, p.o - 70) * 0.25 + Math.max(0, p.ag - 29) * 0.8 }
  for (let guard = 0; room < need && guard < 30; guard++) {
    const p = t.r.filter(x => x.b == null && !x.rc && !x.fl && x.y > 0 && cutCost(x).saves > 0.4).sort((a, b) => worthCut(b) - worthCut(a))[0]
    if (!p) break
    const c = cutMan(F, p.i, short)
    room = capRoom(F, short)
    out.push({ k: 'cut', n: p.n, saves: c?.saves ?? 0 })
  }
  if (room < need) out.push(...makeRoom(F, short, need, true))
  return out
}
// A restructure: 40% of this year's cap hit turned into a bonus spread over the years left on his deal (two or
// more). This year's hit drops by all but this year's share; every later year carries its share (sc): money moved
// forward, not saved, and more of it dead if he's cut. (No added years: a deal that grew a year at full pay each
// time was an extension nobody signed, and it snowballed: a $90M quarterback by 2030.) Returns what it clears now.
export function restructure(p) {
  const y = Math.max(2, p.y ?? 2)
  const move = r1(p.$ * 0.4), per = move / y, saves = r1(move - per)
  const later = Array.from({ length: y - 1 }, (_, k) => hitIn(p, k + 1) ?? p.$)
  p.sc = later.map(v => r1(v + per))
  p.$ = r1(p.$ - saves); p.g = r1((p.g ?? 0) + per); p.y = y
  delete p.op; delete p.ox
  return saves
}
// A year passes on every deal (in the offseason, as the league ages): a year off, and this year's cap hit is the
// next on his schedule (sc: a real deal's rising years, an extension's new money, a restructure's); a picked-up
// option's price is his cap hit in the option year. Dead money from last year is gone.
export function tickDeal(p) {
  p.y = Math.max(0, (p.y ?? 0) - 1)
  if (Array.isArray(p.sc)) {
    const next = p.sc.shift()
    if (p.y > 0 && next != null) p.$ = next
    if (!p.sc.length || p.y <= 1) delete p.sc
  }
  if (p.op === 2 && p.y === 1 && p.ox) { p.$ = p.ox; delete p.rc }
}
// The franchise tag: one a team a year, a one-year deal at the average of the top five cap hits at his spot as a
// share of the cap (TENDER), or 120% of what he made last year if that's more (a man tagged twice); all of it
// guaranteed: cut him and it's all dead money
export function tagPrice(p, year) {
  return r1(Math.max(tender(p, 0, year), p.rc ? 0 : (p.$ ?? 0) * 1.2))
}
export const optionDue = p => p.rc && p.op === 1 && p.y === 1
export function pickUpOption(F, p, starts = null) {
  p.ox = optionPrice(p, F.year + 1, starts); p.op = 2; p.y = 2
  return p.ox
}
export const declineOption = p => { p.op = 0 }
