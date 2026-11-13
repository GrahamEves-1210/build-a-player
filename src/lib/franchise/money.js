// FRANCHISE: money. Contracts, what a player is worth on the market, the cap sheet.
// All figures are $M to two places. A contract: { yrs, sal, guar, rookie, rd, opt, tag }
//   yrs   seasons left, counting the one being played     sal   cap hit a year
//   guar  guaranteed money still owed: what is left on the books (dead money) if he is cut
import { CAP_2026, FIRST_YEAR, MIN_SALARY, VET_MIN, TOP_SHARE, clamp, r2, slotOf } from './consts'

// the cap for a season (set once a year and kept in F.cap; this is year one's and the growth rule)
export const capFor = (year, prev = null, u = 0.5) => (year <= FIRST_YEAR || prev == null ? CAP_2026 : r2(prev * (1.05 + u * 0.03)))

// Where a position's market starts and tops out on the OVR scale. A quarterback is paid like a starter from
// the low 70s; everyone else has to be good before the money moves.
const CURVE = { QB: [68, 95, 1.2], K: [72, 94, 1.5] }
const curveOf = slot => CURVE[slot] ?? [66.5, 97, 1.22]
// the years a position is paid for: full value to `from`, then it falls to `floor` of it by `to`
const AGE = { QB: [34, 40, 0.45], RB: [27, 31, 0.3], K: [36, 42, 0.5], LT: [31, 36, 0.4], LG: [31, 36, 0.4], C: [31, 36, 0.4], RG: [31, 36, 0.4], RT: [31, 36, 0.4] }
const ageOf = slot => AGE[slot] ?? [29, 34, 0.35]
export function ageFactor(slot, age) {
  const [from, to, floor] = ageOf(slot)
  if (age <= from) return 1
  if (age >= to) return floor
  return 1 - (1 - floor) * (age - from) / (to - from)
}
// What a player would get a year on the open market at this cap
export function marketValue(p, cap = CAP_2026) {
  const slot = slotOf(p), [lo, hi, pow] = curveOf(slot)
  const x = clamp((p.ovr - lo) / (hi - lo), 0, 1.06)
  const top = (TOP_SHARE[slot] ?? 0.06) * cap
  const floor = p.exp >= 3 ? VET_MIN : MIN_SALARY
  const dev = 1 + (p.devKnown ? (p.dev ?? 0) * 0.02 : 0) + (p.age <= 25 ? 0.05 : 0)
  return r2(Math.max(floor, top * Math.pow(x, pow) * ageFactor(slot, p.age) * dev))
}
// How long a deal a man of this age signs
export function marketYears(p) {
  const slot = slotOf(p), [from] = ageOf(slot)
  const left = from + 2 - p.age
  if (p.ovr < 74) return left > 3 ? 2 : 1
  return clamp(left, 1, p.ovr >= 86 ? 5 : 4)
}
// the share of a new deal that is guaranteed: stars get more
export const marketGuar = p => clamp(0.25 + (p.ovr - 75) * 0.022, 0.1, 0.72)

export function newContract(p, { yrs, sal, guarShare = null, rookie = false, rd = null, opt = 0, tag = false } = {}) {
  const share = guarShare ?? marketGuar(p)
  return { yrs, sal: r2(sal), guar: r2(sal * yrs * share), rookie: rookie ? 1 : 0, rd: rd ?? null, opt, tag: !!tag }
}

// ── The rookie scale ─────────────────────────────────────────────────────────
// Four years, slotted by pick: the first pick about 4.3% of the cap a year, the last first-rounder 1.3%,
// then down to the minimum by the fourth round. First-rounders carry a fifth-year option.
export function rookieDeal(pick, cap = CAP_2026) {
  const round = Math.ceil(pick / 32)
  const first = 0.043 * cap, last = 0.013 * cap
  const sal = pick <= 32 ? first - (first - last) * Math.pow((pick - 1) / 31, 0.62)
    : pick <= 64 ? last * 0.78 - (pick - 33) * 0.018
    : pick <= 100 ? 1.45 - (pick - 65) * 0.006
    : Math.max(MIN_SALARY, 1.18 - (pick - 101) * 0.0018)
  const guarShare = pick <= 32 ? 1 : pick <= 64 ? 0.6 : pick <= 100 ? 0.25 : 0.08
  return { yrs: 4, sal: r2(Math.max(MIN_SALARY, sal)), guar: r2(Math.max(MIN_SALARY, sal) * 4 * guarShare), rookie: 1, rd: round, opt: round === 1 ? 1 : 0, tag: false }
}
// the fifth-year option's salary: the average of the 3rd to 25th salaries at his spot is the real rule; here the
// market value of a good starter there
export const optionSalary = (p, cap) => r2(Math.max(marketValue(p, cap) * 0.8, (TOP_SHARE[slotOf(p)] ?? 0.06) * cap * 0.32))

// ── The cap sheet ────────────────────────────────────────────────────────────
export function payroll(F, t) {
  let sum = 0
  for (const id of t.roster) sum += F.players[id]?.con?.sal ?? 0
  return r2(sum + (t.dead ?? 0))
}
export const capSpace = (F, t) => r2(F.cap - payroll(F, t))
// what cutting him does this season: the guarantee left stays on the books, the rest of the salary comes off
export function cutCost(p) {
  const sal = p.con?.sal ?? 0, dead = Math.min(p.con?.guar ?? 0, sal * (p.con?.yrs ?? 1))
  const now = r2(Math.min(dead, sal)), later = r2(dead - now)
  return { dead: r2(dead), deadNow: now, deadNext: later, saves: r2(sal - now) }
}
// each season played pays down the guarantee
export function burnGuarantee(con) {
  if (!con) return
  con.guar = r2(Math.max(0, con.guar - con.sal * 0.75))
}
export const moneyText = m => (m >= 100 ? `$${Math.round(m)}M` : m >= 10 ? `$${(Math.round(m * 10) / 10).toFixed(1)}M` : m >= 1 ? `$${m.toFixed(2)}M` : `$${Math.round(m * 1000)}K`)
