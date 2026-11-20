// NBA FRANCHISE: the salary cap, the luxury tax and the aprons (the 2023 CBA, real 2025-26 numbers).
//
// THE NUMBERS (by season start year: 2025 = the 2025-26 season)
//   2025-26: cap $154.647M · tax $187.895M · first apron $195.945M · second apron $207.824M
//   They grow with the league's revenue: about 7% a year for 2026-27 and 2027-28 (the league's projections under the
//   new media deal, inside the CBA's 10% smoothing limit), then 5% a year. The exceptions, the minimum scale, the
//   rookie scale and the tax brackets grow with the cap, as the CBA indexes them.
//
// WHAT COUNTS (payroll): every standard contract's cap hit (a one-year minimum deal for a man with 3+ years counts at
//   the two-year minimum, the league reimburses the rest), plus dead money (waived salary, stretched or not), plus in
//   the offseason the cap holds: his own free agents not yet renounced (Bird rights), his unsigned first-round picks,
//   and an empty-roster charge (the rookie minimum for every spot under 12). Two-way deals count for nothing.
//
// THE LINES (capSheet over): under the cap · over the cap · over the tax · over the first apron · over the second.
//   Over the first apron: no bi-annual, no non-taxpayer MLE (the taxpayer MLE only), 110% salary matching in trades
//   (as the owner's brief has it), no sign-and-trade acquisitions.
//   Over the second apron: no taxpayer MLE either (the minimum only), no aggregating salaries in a trade, no cash, its
//   first-round pick seven years out is frozen, and 100% matching.
//   Hard caps: using the non-taxpayer MLE or the bi-annual hard-caps a team at the first apron for the league year;
//   using the taxpayer MLE or aggregating in a trade, at the second apron (team.exc.hc).
//
// THE TAX BILL (taxBill): on the payroll over the tax line at the end of the regular season, by $5M brackets
//   (indexed): $1.50, $1.75, $2.50, $3.25 for each dollar, then +$0.50 a bracket. A repeater (a taxpayer in three of
//   the previous four seasons) pays $2.50, $2.75, $3.50, $4.25, then +$0.50.
//
// F.noCap: the GM's team plays with no cap or tax (its sheet reads as room to spare); the league's teams still run
// their books.
import { r1 } from '../rng'

// ── The numbers ──────────────────────────────────────────────────────────────
const LINES = {
  2023: [136.021, 165.294, 172.346, 182.794],
  2024: [140.588, 170.814, 178.132, 188.931],
  2025: [154.647, 187.895, 195.945, 207.824],
}
const GROW = { 2026: 1.07, 2027: 1.07 }
const growOf = y => GROW[y] ?? 1.05
function linesOf(year) {
  if (LINES[year]) return LINES[year]
  if (year < 2023) return LINES[2023]
  const prev = linesOf(year - 1)
  const g = growOf(year)
  LINES[year] = prev.map(v => Math.round(v * g * 1000) / 1000)
  return LINES[year]
}
export const capOf = year => r1(linesOf(year)[0])
export const taxOf = year => r1(linesOf(year)[1])
export const apron1Of = year => r1(linesOf(year)[2])
export const apron2Of = year => r1(linesOf(year)[3])
// (the exact line, for the sums: $M to three places)
const exact = (year, k) => linesOf(year)[k]
// a number indexed to the cap from its 2025-26 value
export const indexed = (v2025, year) => Math.round(v2025 * exact(year, 0) / exact(2025, 0) * 1000) / 1000

// ── The minimum scale (2025-26, by years of service) ─────────────────────────
const MIN_2025 = [1.273, 2.049, 2.296, 2.379, 2.462, 2.667, 2.874, 3.080, 3.304, 3.316, 3.634]
export const minOf = (ys = 0, year = 2025) => r1(indexed(MIN_2025[Math.max(0, Math.min(10, ys | 0))], year))
const minExact = (ys, year) => indexed(MIN_2025[Math.max(0, Math.min(10, ys | 0))], year)
// a two-way deal: half the rookie minimum, off the cap
export const twoWayOf = year => r1(indexed(0.636, year))

// ── The max (by years of service) ───────────────────────────────────────────
// 0-6 years: 25% of the cap · 7-9: 30% · 10+: 35%. The supermax (Designated Veteran) lets a 7-9 year man who
// qualifies sign at 35%. A max never starts below 105% of his last salary.
export const maxPct = ys => (ys >= 10 ? 0.35 : ys >= 7 ? 0.3 : 0.25)
export function maxOf(ys = 0, year = 2025, { superMax = false, last = 0 } = {}) {
  const pct = superMax ? 0.35 : maxPct(ys)
  return r1(Math.max(exact(year, 0) * pct, last * 1.05))
}

// ── The exceptions (2025-26) ─────────────────────────────────────────────────
//   room MLE $8.781M (3 years, a team that used its room) · non-taxpayer MLE $14.104M (4 years) · taxpayer MLE
//   $5.685M (2 years) · bi-annual $5.134M (2 years, not two seasons running)
export const EXC = { room: [8.781, 3], nt: [14.104, 4], tp: [5.685, 2], bae: [5.134, 2] }
export const excOf = (k, year) => r1(indexed(EXC[k][0], year))
export const excYears = k => EXC[k][1]
export const EXC_TEXT = { room: 'room exception', nt: 'non-taxpayer mid-level', tp: 'taxpayer mid-level', bae: 'bi-annual exception' }

// ── The rookie scale (first round, 2025-26 first-year salaries at 120% of scale) ──
const ROOKIE_2025 = [13.83, 12.38, 11.12, 10.03, 9.11, 8.31, 7.62, 7.02, 6.48, 6.15, 5.84, 5.55, 5.27, 5.01, 4.76,
  4.52, 4.29, 4.12, 3.96, 3.80, 3.65, 3.51, 3.38, 3.24, 3.14, 3.08, 2.99, 2.94, 2.90, 2.85]
// four seasons: +4.5% in the second and third (the third a team option), the fourth (a team option) up 26% for the
// No. 1 pick to about 76% for No. 30
export function rookieScale(pick, year = 2025) {
  const k = Math.max(1, Math.min(30, pick | 0)) - 1
  const y1 = indexed(ROOKIE_2025[k], year)
  const y2 = y1 * 1.045, y3 = y2 * 1.045, y4 = y3 * (1.261 + 0.5 * k / 29)
  return [y1, y2, y3, y4].map(r1)
}

// ── The tax ──────────────────────────────────────────────────────────────────
const RATES = [1.5, 1.75, 2.5, 3.25], REPEAT = [2.5, 2.75, 3.5, 4.25]
export function taxBill(over, year = 2025, repeater = false) {
  if (!(over > 0)) return 0
  const step = indexed(5, year), R = repeater ? REPEAT : RATES
  let bill = 0, left = over, i = 0
  while (left > 1e-9) {
    const part = Math.min(step, left)
    bill += part * (R[i] ?? R[3] + 0.5 * (i - 3))
    left -= part
    i++
  }
  return r1(bill)
}
// a repeater: a taxpayer in three of the four seasons before this one (team.txh: the years it paid)
export const isRepeater = (team, year) => (team?.txh ?? []).filter(y => y < year && y >= year - 4).length >= 3

// ── A man's cap hit ──────────────────────────────────────────────────────────
// his salary in season `year` when the books are on season `cy` (a man drafted for next season starts then)
export function salaryIn(p, year, cy) {
  if (!p || !((p.y ?? 0) > 0)) return 0
  const start = p.rk != null && p.rk > cy ? p.rk : cy
  const k = year - start
  if (k < 0 || k >= p.y) return 0
  return k === 0 ? p.$ ?? 0 : p.sc?.[k - 1] ?? 0
}
// (a two-way man counts nothing; a one-year minimum for a 3+ year man counts as the two-year minimum)
export function hitOf(p, year, cy = year) {
  if (!p || p.tw) return 0
  const v = salaryIn(p, year, cy)
  if (v > 0 && p.mh && (p.ys ?? 0) >= 3) return Math.min(v, minExact(2, year))
  return v
}
// dead money in season `year` (an entry { $, y, from? } runs y seasons from `from`, or from the books' season)
export const deadIn = (d, year, cy) => { const a = d.from ?? cy; return year >= a && year < a + (d.y ?? 0) ? d.$ ?? 0 : 0 }
export const deadThisYear = (team, cy) => r1((team?.dead ?? []).reduce((a, d) => a + deadIn(d, cy, cy), 0))

// ── Cap holds (the offseason) ────────────────────────────────────────────────
// his own free agent until signed or renounced: by his rights and last salary (2023 CBA), never more than his max:
//   full Bird 150% of his last salary (190% if it was under the league average) · Early Bird 130% · Non-Bird 120%
//   · a man finishing his rookie deal 250% (200% over the average) · a man on the minimum, the minimum
// an unsigned first-round pick: his scale salary
const AVG_2025 = 12.5
export function holdOf(p, year) {
  const last = p.$l ?? p.$ ?? 0
  const ys = p.ys ?? 0
  const mn = minExact(ys, year)
  if (last <= mn * 1.02) return r1(mn)
  const avg = indexed(AVG_2025, year)
  let f
  if (p.rsl) f = last < avg ? 2.5 : 2
  else if ((p.bird ?? 0) >= 3) f = last < avg ? 1.9 : 1.5
  else if ((p.bird ?? 0) === 2) f = 1.3
  else f = 1.2
  return r1(Math.min(maxOf(ys, year), Math.max(mn, last * f)))
}
// the holds on a team's books: its free agents in F.fa (fr: the team he left; rn: renounced)
export function holdsOf(F, short, year) {
  if (!F || F.phase !== 'off') return []
  const out = []
  for (const p of F.fa ?? []) if (p.fr === short && !p.rn && p.hy === year) out.push({ n: p.n, i: p.i, $: holdOf(p, year), k: 'fa' })
  return out
}

// ── Payroll and the sheet ────────────────────────────────────────────────────
// the league year being spent: next season's once the deals have ticked over at the start of re-signing
// (contracts.js seasonEndDeals sets F.sed); this season's until then
export const capYear = F => (F?.phase === 'off' && F.sed === F.year ? F.year + 1 : F?.year ?? 2025)
export const standardOf = team => (team?.r ?? []).filter(p => !p.tw)
export const twoWaysOf = team => (team?.r ?? []).filter(p => p.tw)

export function payroll(F, short, year = capYear(F), { holds = true } = {}) {
  const team = F?.teams?.[short]
  if (!team) return 0
  const cy = capYear(F)
  let pay = 0
  for (const p of team.r) pay += hitOf(p, year, cy)
  for (const d of team.dead ?? []) pay += deadIn(d, year, cy)
  if (year === cy && holds) {
    const H = holdsOf(F, short, year)
    pay += H.reduce((a, h) => a + h.$, 0)
    // the empty-roster charge: the rookie minimum for each spot under 12 (men and holds)
    if (F.phase === 'off') {
      const n = standardOf(team).filter(p => salaryIn(p, year, cy) > 0).length + H.length
      if (n < 12) pay += (12 - n) * minExact(0, year)
    }
  }
  return r1(pay)
}

export const OVER_TEXT = { under: 'UNDER THE CAP', cap: 'OVER THE CAP', tax: 'IN THE TAX', a1: 'OVER THE FIRST APRON', a2: 'OVER THE SECOND APRON' }
export function overOf(pay, year) {
  if (pay > exact(year, 3)) return 'a2'
  if (pay > exact(year, 2)) return 'a1'
  if (pay > exact(year, 1)) return 'tax'
  if (pay > exact(year, 0)) return 'cap'
  return 'under'
}
export const NO_CAP_ROOM = 999
// { pay, cap, tax, a1, a2, room (under the cap; 0 over it), over, bill (the tax this payroll would cost), repeater,
//   toTax, toA1, toA2 (room under each line), year, holds, dead }
export function capSheet(F, short = F?.team, year = capYear(F)) {
  const team = F?.teams?.[short]
  const pay = payroll(F, short, year)
  const cap = capOf(year), tax = taxOf(year), a1 = apron1Of(year), a2 = apron2Of(year)
  const rep = isRepeater(team, year)
  const free = F?.noCap && short === F.team
  const over = free ? 'under' : overOf(pay, year)
  const bill = free ? 0 : taxBill(pay - exact(year, 1), year, rep)
  return {
    year, pay, cap, tax, a1, a2, over, bill, repeater: rep,
    room: free ? NO_CAP_ROOM : r1(Math.max(0, exact(year, 0) - pay)),
    toTax: r1(exact(year, 1) - pay), toA1: r1(exact(year, 2) - pay), toA2: r1(exact(year, 3) - pay),
    holds: holdsOf(F, short, year), dead: r1((team?.dead ?? []).reduce((a, d) => a + deadIn(d, year, capYear(F)), 0)), free: !!free,
  }
}
// the line a team would sit at with `add` more payroll
export const overAfter = (F, short, add, year = capYear(F)) => (F?.noCap && short === F.team ? 'under' : overOf(payroll(F, short, year) + add, year))
// the hard cap a team has triggered this league year (team.exc.hc), as a payroll ceiling
export function hardCapOf(F, short, year = capYear(F)) {
  const e = F?.teams?.[short]?.exc
  if (!e || e.yr !== year || !e.hc) return Infinity
  return e.hc === 'a1' ? exact(year, 2) : exact(year, 3)
}

// ── The season's tax (season end) ────────────────────────────────────────────
// at the end of the regular season each team over the tax line pays; its year goes on its record (repeater). The
// tax collected goes back in equal shares to the teams under the line (part of it, as the league does). Returns
// [{ s, over, bill, repeater }] for the wire.
export function assessTax(F, year = F.year) {
  const out = []
  for (const s of Object.keys(F.teams ?? {})) {
    if (F.noCap && s === F.team) continue
    const team = F.teams[s]
    const pay = payroll(F, s, year, { holds: false })
    const over = r1(pay - exact(year, 1))
    if (over > 0) {
      const rep = isRepeater(team, year)
      const bill = taxBill(over, year, rep)
      team.txh = [...(team.txh ?? []).filter(y => y >= year - 5 && y !== year), year]
      out.push({ s, pay, over, bill, repeater: rep })
    }
  }
  const pot = out.reduce((a, x) => a + x.bill, 0)
  const under = Object.keys(F.teams ?? {}).filter(s => !out.some(x => x.s === s))
  const share = under.length ? r1(pot * 0.5 / under.length) : 0
  F.taxl = { y: year, paid: out, share }
  return out
}
