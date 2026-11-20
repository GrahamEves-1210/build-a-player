// NBA FRANCHISE: stand-ins for the cap engine (branch frnba-cap) and the game sim (branch frnba-sim) until they land.
// Just enough for the core to run a league: numbers in the right range, no real rules. seams.js re-exports these;
// at the merge seams.js points at the real files and this file goes.
import { rngOf, clamp, r1 } from '../rng'
import { depthOrder, teamOvr, SHORTS, manOf, ROSTER_MAX } from './league'

// ══ C: the game sim ══════════════════════════════════════════════════════════
const MIN = [34, 33, 32, 31, 30, 24, 21, 17, 12, 6]
export function rotationOf(F, s) {
  const d = depthOrder(F, s).filter(p => !p.rest)
  return d.slice(0, 10).map((p, k) => ({ i: p.i, st: k < 5, min: MIN[k] }))
}
function lines(F, s, pts, R) {
  const rot = rotationOf(F, s)
  const w = rot.map(x => x.min * Math.pow((manOf(F, x.i)?.o ?? 70) / 75, 3))
  const tw = w.reduce((a, b) => a + b, 0)
  return rot.map((x, k) => {
    const p = manOf(F, x.i)
    const share = w[k] / tw
    const pt = Math.round(pts * share)
    const big = p?.g === 'big'
    const fga = Math.max(0, Math.round(pt / 1.15)), tpa = big ? Math.round(fga * 0.15) : Math.round(fga * 0.42)
    const fta = Math.round(pt * 0.22)
    return {
      i: x.i, st: x.st, min: x.min, pts: pt, reb: Math.round(x.min * (big ? 0.3 : 0.14) * (0.6 + R.u() * 0.8)), oreb: 0,
      ast: Math.round(x.min * (p?.p === 'PG' ? 0.22 : 0.08) * (0.6 + R.u() * 0.8)), stl: R.int(0, 2), blk: big ? R.int(0, 2) : R.int(0, 1),
      tov: R.int(0, 3), pf: R.int(0, 4), fgm: Math.round(fga * 0.47), fga, tpm: Math.round(tpa * 0.36), tpa, ftm: Math.round(fta * 0.78), fta, pm: 0,
    }
  })
}
export function simGame(F, h, a, { seed } = {}) {
  const R = rngOf(seed ?? `${F.seed}-${F.year}-${F.day}-${h}-${a}`)
  const oh = teamOvr(F, h), oa = teamOvr(F, a)
  const base = 114
  let hs = Math.round(base + (oh - oa) * 0.9 + 1.5 + R.n() * 11)
  let as = Math.round(base + (oa - oh) * 0.9 - 1.5 + R.n() * 11)
  let ot = 0
  while (hs === as) { hs += R.int(4, 14); as += R.int(4, 14); ot++ }
  const q = [0, 1, 2, 3].map(() => [0, 0])
  for (const [k, tot] of [[0, hs], [1, as]]) { let left = tot; for (let i = 0; i < 3; i++) { const v = Math.round(tot / 4 + R.n() * 4); q[i][k] = v; left -= v } q[3][k] = left }
  return { hs, as, ot, q, box: { [h]: lines(F, h, hs, R), [a]: lines(F, a, as, R) } }
}
const ADD = ['gp', 'gs', 'min', 'pts', 'reb', 'oreb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'pm']
export function recordGame(F, g, res, { playoff = false } = {}) {
  const S = playoff ? (F.ps ??= {}) : (F.ss ??= {})
  for (const s of [g.h, g.a]) for (const l of res.box[s] ?? []) {
    const x = (S[l.i] ??= Object.fromEntries(ADD.map(k => [k, 0])))
    x.gp++; if (l.st) x.gs++
    for (const k of ADD.slice(2)) x[k] += l[k] ?? 0
    x.s = s
  }
}
export function rollInjuries(F, g, res) {
  if (F.noInj) return []
  const R = rngOf(`${F.seed}-inj-${F.year}-${g.d}-${g.h}`)
  const out = []
  for (const s of [g.h, g.a]) for (const l of res.box[s] ?? []) {
    if (R.u() < 0.0045) { const p = manOf(F, l.i); if (!p) continue; const n = R.chance(0.7) ? R.int(1, 6) : R.int(8, 30); p.inj = { g: n, k: R.pick(['sprained left ankle', 'sore right knee', 'strained hamstring', 'back spasms', 'sprained right wrist']) }; out.push({ i: p.i, s, k: p.inj.k, g: n }) }
  }
  return out
}
export function tickInjuries(F, s) {
  for (const p of F.teams[s].r) if (p.inj?.g) { p.inj.g--; if (p.inj.g <= 0) delete p.inj }
}
export const restFor = () => []
export function leaders(F, stat, n = 10, { playoff = false } = {}) {
  const S = playoff ? F.ps ?? {} : F.ss ?? {}
  const gp = Math.max(1, ...Object.values(S).map(x => x.gp))
  return Object.entries(S).filter(([, x]) => x.gp >= Math.max(1, gp * 0.7)).map(([i, x]) => ({ i: +i, s: x.s, v: r1(x[stat] / x.gp) })).sort((a, b) => b.v - a.v).slice(0, n)
}
export function seasonAwards(F) {
  const S = F.ss ?? {}
  const val = ([, x]) => (x.pts + x.reb * 1.2 + x.ast * 1.5) / Math.max(1, x.gp) * Math.min(1, x.gp / 60)
  const all = Object.entries(S).sort((a, b) => val(b) - val(a)).map(([i]) => +i)
  const rook = all.filter(i => manOf(F, i)?.rk === F.year)
  const bench = Object.entries(S).filter(([, x]) => x.gs < x.gp * 0.3).sort((a, b) => val(b) - val(a)).map(([i]) => +i)
  return { MVP: all[0], ROY: rook[0] ?? null, DPOY: all[3], '6MOY': bench[0] ?? null, MIP: all[8], ALL: [all.slice(0, 5), all.slice(5, 10), all.slice(10, 15)] }
}
export function finalsMvp(F, series) {
  const S = F.ps ?? {}
  const w = series.done
  return Object.entries(S).filter(([, x]) => x.s === w).sort((a, b) => b[1].pts - a[1].pts)[0]?.[0] * 1 || null
}
export function ageLeague(F) {
  const R = rngOf(`${F.seed}-age-${F.year}`)
  const retired = []
  for (const s of SHORTS) {
    const t = F.teams[s]
    for (const p of t.r.slice()) {
      p.ag++; p.ys = (p.ys ?? 0) + 1
      const step = p.ag <= 24 ? R.int(1, 4) : p.ag <= 28 ? R.int(0, 2) : p.ag <= 31 ? R.int(-2, 1) : R.int(-4, -1)
      p.o = clamp(40, 99, Math.min(p.pk + 1, p.o + step))
      if (p.ag >= 38 || (p.ag >= 34 && p.o < 70)) { t.r = t.r.filter(x => x !== p); retired.push(p) }
    }
  }
  for (const p of (F.fa ?? []).slice()) { p.ag++; if (p.ag >= 33) { F.fa = F.fa.filter(x => x !== p); retired.push(p) } }
  return { retired, news: [] }
}
// moments: a game that stops late and goes on
export function startGame(F, h, a, opts = {}) {
  const res = simGame(F, h, a, opts)
  // (the stand-in: the final known, the last minutes taken off so a moment can be played into them)
  const R = rngOf(`${opts.seed ?? 'g'}-late`)
  const late = { [h]: R.int(2, 7), [a]: R.int(2, 7) }
  return { F, h, a, res, late, hs: res.hs - late[h], as: res.as - late[a], left: 120, done: false, ot: res.ot }
}
export function playTo(G, sec) { G.left = sec; return G }
export function possession(G, s, out) { if (s === G.h) G.hs += out.pts ?? 0; else G.as += out.pts ?? 0; return G }
export function finishGame(G) {
  const R = rngOf(`${G.h}-${G.a}-${G.hs}-${G.as}-fin`)
  let hs = G.hs + R.int(0, 3), as = G.as + R.int(0, 3), ot = 0
  while (hs === as) { hs += R.int(5, 13); as += R.int(5, 13); ot++ }
  const res = G.res
  for (const [s, d] of [[G.h, hs - res.hs], [G.a, as - res.as]]) { const l = res.box[s]?.[0]; if (l) l.pts = Math.max(0, l.pts + d) }
  return { ...res, hs, as, ot: res.ot + ot }
}

// ══ B: the cap ═══════════════════════════════════════════════════════════════
const CAP0 = 165.0
export const capOf = y => r1(CAP0 * Math.pow(1.07, y - 2026))
export const taxOf = y => r1(capOf(y) * 1.215)
export const apron1Of = y => r1(capOf(y) * 1.267)
export const apron2Of = y => r1(capOf(y) * 1.344)
export const minOf = (ys, y) => r1((1.27 + Math.min(10, ys) * 0.12) * capOf(y) / CAP0)
export const maxOf = (ys, y) => r1(capOf(y) * (ys >= 10 ? 0.35 : ys >= 7 ? 0.3 : 0.25))
export const rookieScale = (pick, y) => r1(Math.max(2.2, 13.5 * Math.pow(0.9, pick - 1)) * capOf(y) / CAP0)
export function payroll(F, s) { return r1(F.teams[s].r.filter(p => !p.tw).reduce((a, p) => a + (p.$ ?? 0), 0)) }
export function capSheet(F, s) {
  const pay = payroll(F, s), y = F.year
  const cap = capOf(y), tax = taxOf(y), a1 = apron1Of(y), a2 = apron2Of(y)
  const over = pay < cap ? 'under' : pay < tax ? 'cap' : pay < a1 ? 'tax' : pay < a2 ? 'a1' : 'a2'
  return { pay, cap, tax, a1, a2, room: r1(Math.max(0, cap - pay)), over, bill: r1(Math.max(0, pay - tax) * 1.5) }
}
export function dealOnLoad(F, p) {
  if (p.tw) { p.$ = 0.6; p.y = 1; return }
  const v = marketOf(F, p)
  p.$ = v; p.y = clamp(1, 5, Math.round(1 + (31 - p.ag) / 3 + (p.o - 75) / 10)); p.sc = Array.from({ length: p.y - 1 }, () => v)
  if (p.ag <= 23) p.rs = 1
}
const marketOf = (F, p) => r1(clamp(minOf(p.ys ?? 0, F.year), maxOf(p.ys ?? 0, F.year), Math.pow(Math.max(0, p.o - 66) / 30, 2.2) * 58 + 1.3))
export function canSign(F, s, p, deal) {
  if (F.noCap && s === F.team) return { ok: true, via: 'room' }
  const n = F.teams[s].r.filter(x => !x.tw).length
  if (n >= ROSTER_MAX) return { ok: false, why: 'Roster full' }
  const c = capSheet(F, s)
  if (deal.$ <= c.room) return { ok: true, via: 'room' }
  if (deal.$ <= minOf(p.ys ?? 0, F.year) + 0.01) return { ok: true, via: 'min' }
  if (deal.$ <= 14.1 && c.over !== 'a2') return { ok: true, via: 'mle' }
  return { ok: false, why: 'No cap room' }
}
export function signMan(F, s, p, deal) {
  F.fa = (F.fa ?? []).filter(x => x !== p && x.i !== p.i)
  p.$ = deal.$; p.y = deal.y; p.sc = Array.from({ length: deal.y - 1 }, () => deal.$); p.bird = 0; p.sgn = F.year
  F.teams[s].r.push(p)
}
export function rookieDeal(F, p, pick) {
  if (pick.r === 1) { p.$ = rookieScale(pick.n, F.year + 1); p.y = 4; p.rs = 1; p.sc = [1, 2, 3].map(k => r1(p.$ * (1 + 0.05 * k))) }
  else { p.$ = minOf(0, F.year + 1); p.y = 2; p.sc = [p.$] }
}
export function seasonEndDeals(F) {
  const out = []
  for (const s of SHORTS) for (const p of F.teams[s].r.slice()) {
    p.y = (p.y ?? 1) - 1
    if (p.sc?.length) p.$ = p.sc.shift()
    p.bird = (p.bird ?? 0) + 1
    if (p.y <= 0) { F.teams[s].r = F.teams[s].r.filter(x => x !== p); p.was = s; F.fa.push(p); out.push(p) }
  }
  return out
}
export function resignOffer(F, p) { return { $: marketOf(F, p), y: clamp(1, 5, Math.round((32 - p.ag) / 2)) } }
export function askOf(F, p) { return { $: marketOf(F, p), y: clamp(1, 4, Math.round((33 - p.ag) / 2)) } }
export function cpuOffseason(F) {
  const R = rngOf(`${F.seed}-cpuoff-${F.year}`)
  const pool = () => (F.fa ?? []).slice().sort((a, b) => b.o - a.o)
  for (const s of SHORTS) {
    if (s === F.team) continue
    for (const p of pool()) {
      if (F.teams[s].r.filter(x => !x.tw).length >= 14) break
      const d = askOf(F, p)
      if (canSign(F, s, p, d).ok && R.chance(0.35)) signMan(F, s, p, d)
    }
  }
  return []
}
export function faDay() { return [] }
export function cutMan(F, s, id) {
  const t = F.teams[s], p = t.r.find(x => x.i === id)
  if (!p) return 0
  t.r = t.r.filter(x => x !== p)
  const dead = r1((p.$ ?? 0) * (p.y ?? 1))
  if (dead > 0) (t.dead ??= []).push({ n: p.n, $: p.$, y: p.y })
  delete p.$; p.y = 0
  F.fa.push(p)
  return dead
}
export function legalRoster(F, s, { season = true } = {}) {
  const t = F.teams[s], std = t.r.filter(p => !p.tw).length, tw = t.r.filter(p => p.tw).length
  if (std > ROSTER_MAX) return { ok: false, why: `${std} standard contracts, the limit is 15` }
  if (season && std < 13) return { ok: false, why: `${std} standard contracts, the minimum is 13` }
  if (tw > 3) return { ok: false, why: `${tw} two-way contracts, the limit is 3` }
  return { ok: true }
}
export const tradeValue = (F, x) => (x?.o ? Math.pow(Math.max(0, x.o - 60), 2) / (x.ag > 30 ? 1 + (x.ag - 30) * 0.2 : 1) : 40)
export function checkTrade() { return { ok: true } }
export function cpuAnswer() { return { yes: false } }
export function doTrade(F, deal) {
  const A = F.teams[deal.a], B = F.teams[deal.b]
  const ga = A.r.filter(p => deal.ga.includes(p.i)), gb = B.r.filter(p => deal.gb.includes(p.i))
  A.r = A.r.filter(p => !ga.includes(p)).concat(gb); B.r = B.r.filter(p => !gb.includes(p)).concat(ga)
  for (const k of deal.pa ?? []) F.picks[k].t = deal.b
  for (const k of deal.pb ?? []) F.picks[k].t = deal.a
}
export const cpuDeadline = () => []
