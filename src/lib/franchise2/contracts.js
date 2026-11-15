// FRANCHISE: contracts and the salary cap, the NFL's way, kept simple.
//
//   A man's deal:  $ cap hit a year ($M) · y years left · g signing bonus a year (what's owed if he's cut)
//                  rc 1 on a rookie deal · op the fifth-year option (1 there to pick up, 2 picked up) · ox its price
//   The cap:       capOf(year): the real cap ($301.2M in 2026), up about five percent a year after that.
//   Cap used:      every man's cap hit + dead money + the rest of the 53 (the men the mode doesn't play: the
//                  backups past the 37th man, the kicker, the punter, the snapper, at about the minimum).
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

// ── The cap ──────────────────────────────────────────────────────────────────
const CAP = { 2024: 255.4, 2025: 279.2, 2026: 301.2 }
export const capOf = year => CAP[year] ?? r1(CAP[2026] * Math.pow(1.05, year - 2026))
const scaleOf = year => capOf(year) / CAP[2026]
// the league minimum by experience (2026, $M), the floor of every deal
export const minimumFor = (ag, year = 2026) => r1((ag <= 22 ? 0.885 : ag <= 23 ? 0.885 : ag <= 24 ? 1.03 : ag <= 25 ? 1.105 : ag <= 27 ? 1.18 : ag <= 29 ? 1.255 : 1.38) * scaleOf(year))
// the men past the ones the mode plays (a 53-man roster): about the minimum each, and the specialists
export const ROSTER_FULL = 53
export const restOf53 = (n, year = 2026) => r1(Math.max(0, ROSTER_FULL - n) * 1.1 * scaleOf(year) + 7.5 * scaleOf(year))

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
}
// a man's market: his spot (a lineman by where he lines up)
export const marketKey = p => (p.p === 'ol' ? (p.s === 'C' ? 'c' : p.s === 'LG' || p.s === 'RG' ? 'og' : 'ot') : p.p === 'dl' ? (p.s === 'dt' ? 'dt' : 'edge') : p.p === 'db' ? (p.s === 's' ? 's' : 'cb') : p.p)
export const MARKET_LABEL = { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', ot: 'OT', og: 'OG', c: 'C', edge: 'EDGE', dt: 'DT', lb: 'LB', cb: 'CB', s: 'S' }
function curve(tab, o) {
  if (o >= tab[0][0]) return tab[0][1]
  for (let i = 1; i < tab.length; i++) {
    const [o1, v1] = tab[i - 1], [o2, v2] = tab[i]
    if (o >= o2) return v2 + (v1 - v2) * (o - o2) / (o1 - o2)
  }
  return tab[tab.length - 1][1]
}
// what the market pays him a year: his rating at his spot, less for age (a back at 28, anyone past 30)
export function marketValue(p, year = 2026) {
  const base = curve(MARKET[marketKey(p)] ?? MARKET.lb, p.o)
  const age = p.p === 'rb' ? (p.ag >= 30 ? 0.55 : p.ag >= 28 ? 0.75 : 1) : p.p === 'qb' ? (p.ag >= 37 ? 0.7 : p.ag >= 34 ? 0.88 : 1) : p.ag >= 33 ? 0.6 : p.ag >= 31 ? 0.78 : p.ag >= 30 ? 0.9 : 1
  return r1(Math.max(minimumFor(p.ag, year), base * age * scaleOf(year)))
}
// how long a deal runs at his age
export const termFor = p => (p.ag <= 25 ? 4 : p.ag <= 27 ? (p.o >= 85 ? 5 : 4) : p.ag <= 29 ? 3 : p.ag <= 31 ? 2 : 1)
// the share of a deal that's signing bonus (what's still owed if he's cut): stars get more of it up front
export const bonusShare = $ => ($ >= 30 ? 0.42 : $ >= 15 ? 0.35 : $ >= 6 ? 0.25 : $ >= 2.5 ? 0.12 : 0)
// a deal on a man (a new contract replaces his old one)
export function signDeal(p, { $, y, g = null }) {
  p.$ = r1($); p.y = y; p.g = r1(g ?? $ * bonusShare($))
  delete p.rc; delete p.op; delete p.ox
  return p
}
// his ask to stay (re-signing) or to come (free agency): the market, a few percent more for a man in his prime
export const askOf = (p, year = 2026) => ({ $: r1(marketValue(p, year) * (p.ag <= 29 && p.o >= 85 ? 1.05 : 1)), y: termFor(p) })

// ── Real players' deals ──────────────────────────────────────────────────────
// src/data/nfl-contracts.json, read once (whatever its exact shape: a list or a map by name; cap hit in dollars or
// $M; years left). Headless scripts hand it in with useContracts().
let REAL = null
let loaded = {}
try { loaded = import.meta.glob('../../data/nfl-contracts.json', { eager: true, import: 'default' }) } catch { loaded = {} }
export function useContracts(data) { REAL = index(data); return REAL?.size ?? 0 }
const money = v => {
  if (v == null || v === '') return null
  const x = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,M\s]/g, ''))
  return Number.isFinite(x) ? r1(x > 1000 ? x / 1e6 : x) : null
}
const keyOf = n => String(n ?? '').toLowerCase().replace(/[^a-z]/g, '')
function index(data) {
  const out = new Map()
  if (!data) return out
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
    out.set(`${keyOf(r.name)}|${String(r.team ?? '').toUpperCase()}`, { $, y: yy, g })
    out.set(keyOf(r.name), out.get(keyOf(r.name)) ?? { $, y: yy, g })
  }
  return out
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
  if (hit) return { $: hit.$, y: hit.y, g: hit.g ?? r1(hit.$ * bonusShare(hit.$)), src: 'real' }
  return estimateDeal(p, R)
}
export const realContractsLoaded = () => realTable().size > 0
// the estimate: what the market pays him, partway through a deal of the usual length
export function estimateDeal(p, R) {
  // (a man 24 or under is still on his rookie deal: the scale where a man of his rating goes, the years he has left)
  if (p.ag <= 24) {
    const d = rookieScale(buildSlot(p.o - (24 - p.ag)))
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
  p.$ = d.$; p.y = d.y; p.g = d.g; p.rc = 1
  if (d.opt) { p.op = 1; p.ox = null } else delete p.op
  return p
}
// The slot a build signs at: where a man of his OVR would have gone in the draft (a 99 at No. 1, an 85 around the
// end of the first round, a 78 in the second, anything under 70 in the third round's back half)
export const buildSlot = o => clamp(1, 100, Math.round(1 + Math.pow(Math.max(0, 99 - o), 1.18) * 1.85))
// the fifth-year option's price: the top of his spot's market for a top-10 pick, a step below for the rest
export function optionPrice(p, year) {
  const top = (MARKET[marketKey(p)] ?? MARKET.lb)
  const pick = p.dr?.[1] ?? 32
  const v = pick <= 10 ? curve(top, 93) : curve(top, 88)
  return r1(v * scaleOf(year))
}

// ── A team's cap ─────────────────────────────────────────────────────────────
// team.dead: [[name, $M]] dead money on this year's cap
export const payrollOf = team => r1(team.r.reduce((a, p) => a + (p.$ ?? 0), 0))
export const deadOf = team => r1((team.dead ?? []).reduce((a, d) => a + d[1], 0))
export function capSheet(F, short = F.team) {
  const t = F.teams[short], cap = capOf(F.year)
  const pay = payrollOf(t), dead = deadOf(t), rest = restOf53(t.r.length, F.year)
  const used = r1(pay + dead + rest)
  return { cap, pay, dead, rest, used, room: r1(cap - used) }
}
export const capRoom = (F, short = F.team) => capSheet(F, short).room
export const canSign = (F, $, short = F.team) => capRoom(F, short) >= $ - 1e-9
// what cutting him does: his cap hit off, his bonus still owed on as dead money
export function cutCost(p) {
  const dead = r1((p.g ?? 0) * Math.max(1, p.y ?? 1))
  return { dead, saves: r1((p.$ ?? 0) - dead) }
}
export function cutMan(F, id, short = F.team) {
  const t = F.teams[short], p = t.r.find(x => x.i === id)
  if (!p) return null
  const c = cutCost(p)
  t.r = t.r.filter(x => x !== p)
  if (c.dead > 0) (t.dead ??= []).push([p.n, c.dead])
  return { p, ...c }
}
// A year passes on every deal (in the offseason, as the league ages): a year off; a picked-up option's price is his
// cap hit in the option year. Dead money from last year is gone.
export function tickDeal(p) {
  p.y = Math.max(0, (p.y ?? 0) - 1)
  if (p.op === 2 && p.y === 1 && p.ox) { p.$ = p.ox; delete p.rc }
}
export const optionDue = p => p.rc && p.op === 1 && p.y === 1
export function pickUpOption(F, p) {
  p.ox = optionPrice(p, F.year + 1); p.op = 2; p.y = 2
  return p.ox
}
export const declineOption = p => { p.op = 0 }
