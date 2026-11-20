// NBA FRANCHISE: the players over time (part C). Each offseason every man is a year older: the young grow toward
// their ceiling (pk), the prime holds, the thirties take the legs first, and the men at the end retire.
//
// The curve, by the kind of skill (0-11 grades, a year):
// - Athleticism (speed, bounce) peaks early: it holds to about 25 and is the first thing to go (from 27, faster
//   every year). A guard who lives on it (more legs than jumper) loses it faster still.
// - The body's skills (finishing, handle, defense, the glass) hold to about 29, then slide. A big's slide slower
//   (size doesn't age; a big's boards and rim protection outlast a guard's first step).
// - Touch and the head (the shot, passing, IQ, clutch) last into the mid-thirties; IQ still grows into the late
//   twenties. Shooters and skilled bigs age best, the way Curry, Nowitzki and Jokic have.
// Development: a young man closes part of the gap to his ceiling every year (about a quarter at 19-23, less after),
// with a good season's minutes speeding it up. The ceiling itself moves while he's young: most picks never reach the
// one the scouts saw, a few blow past it (the late picks who pop). By 27 he is what he is.
// Retirement: by age and how good he still is. Role players go at about 32-35, stars play to 36-40.
//
//   ageLeague(F) -> { retired: [Man], news: [...] }   the seam: retirements (into F.retired), then every man a year
//                                                       older (ag, ys, a, o, pk). Core has written car by then.
//   careerRow(y, s, line)       a SeasonLine as a car row (the checks use it; core writes its own)
//   ageMan(p, R, { mpg })       one man's year (mutates p); returns the OVR change
//   retireChance(p)             the chance he retires this summer
//   prospect(R, { rank, spot, ag })   a draft prospect's grades: { p, g, o, pk, a, ag, ht, wt } (rank 1 = the best)
//   attrsFor(spot, o, R)        ten grades for a spot that come to this overall
//   seedPotential(p, R)         a real man's ceiling when he has none (core's league.js sets pk at setup)
import { rngOf, clamp } from '../rng'
import { ovrOf, groupOfPos, GUARD_TYPES, BIG_TYPES } from './skills'

const ATH = new Set(['speed', 'bounce'])
const TOUCH = new Set(['jumpShot', 'passing', 'playmaking', 'basketballIQ', 'clutch'])
const kindOf = t => (t === 'size' ? 'size' : ATH.has(t) ? 'ath' : TOUCH.has(t) ? 'touch' : 'body')
// the decline, grade points a year by age: [legs, body, touch]
const DECL = { 26: [0.1, 0, 0], 27: [0.2, 0.04, 0], 28: [0.32, 0.1, 0], 29: [0.45, 0.18, 0.02], 30: [0.6, 0.28, 0.05], 31: [0.75, 0.38, 0.08], 32: [0.95, 0.52, 0.14], 33: [1.1, 0.66, 0.2], 34: [1.25, 0.8, 0.28], 35: [1.4, 0.95, 0.36], 36: [1.55, 1.1, 0.45] }
const declAt = ag => (ag < 26 ? [0, 0, 0] : DECL[Math.min(36, ag)])
// the share of the gap to his ceiling a young man closes in a year
const RATE = { 18: 0.3, 19: 0.3, 20: 0.29, 21: 0.27, 22: 0.25, 23: 0.23, 24: 0.21, 25: 0.18, 26: 0.14, 27: 0.08 }
const typesOf = g => (g === 'big' ? BIG_TYPES : GUARD_TYPES)
const OVR_PER_GRADE = 44 / 9

export function ageMan(p, R, { mpg = null } = {}) {
  const ag = p.ag, g = p.g ?? groupOfPos(p.p), types = typesOf(g), a = p.a
  const o0 = p.o ?? ovrOf(p)
  // the ceiling moves while he's young: a bust's sinks, a riser's climbs (now and then a big jump: the pick who pops)
  if (ag <= 24) {
    p.pk = (p.pk ?? o0) + R.n() * 1.7 - 0.3 + (R.u() < 0.03 ? 4 + R.u() * 6 : 0)
    p.pk = clamp(o0 - 2, 99, p.pk)
  }
  // growth: part of the gap, faster for a young man who played real minutes
  let G = 0
  if (ag <= 27) {
    const gap = Math.max(0, (p.pk ?? o0) - o0)
    const play = mpg == null ? 1 : 0.8 + 0.35 * Math.min(1, mpg / 28)
    G = gap * (RATE[ag] ?? 0.3) * play + R.n() * (ag <= 24 ? 1.1 : 0.6)
  }
  // the legs grow only while he's young; the head grows into his late twenties
  const grow = t => { const k = kindOf(t); return k === 'size' ? (ag <= 22 ? 0.25 : 0) : k === 'ath' ? (ag <= 23 ? 0.6 : 0.1) : 1 }
  const W = types.map(t => grow(t))
  const wMean = W.reduce((s, x) => s + x, 0) / W.length
  const unit = G / (OVR_PER_GRADE * wMean)
  // how he plays: more legs than jumper ages fast, a shooter with a head ages well
  const legs = ((a.speed ?? 5) + (a.bounce ?? 5)) / 2, skill = ((a.jumpShot ?? 5) + (a.basketballIQ ?? 5)) / 2
  const style = clamp(0.65, 1.5, 1 + 0.07 * (legs - skill) + (g === 'guard' ? 0.08 : -0.06))
  const luck = Math.exp(R.n() * 0.3)
  const [dA, dB, dT] = declAt(ag)
  for (let j = 0; j < types.length; j++) {
    const t = types[j], k = kindOf(t)
    let d = unit * W[j] * (1 + R.n() * 0.35)
    if (k === 'ath') d -= dA * style * luck
    else if (k === 'body') d -= dB * (g === 'big' && t !== 'finishing' ? 0.75 : 1) * style * luck
    else if (k === 'touch') d -= dT * luck - (t === 'basketballIQ' && ag >= 23 && ag <= 30 ? 0.12 : 0)
    a[t] = Math.round(clamp(0, 11, (a[t] ?? 5) + d) * 100) / 100
  }
  p.o = ovrOf(p)
  if (ag >= 27 || p.o > (p.pk ?? 0)) p.pk = Math.max(p.o, ag >= 27 ? p.o : p.pk)
  p.pk = Math.round(p.pk)
  p.ag = ag + 1
  p.ys = (p.ys ?? 0) + 1
  return p.o - o0
}

// Retirement: his age, moved by how good he still is (a star plays years longer than a role player)
const RET = { 30: 0.01, 31: 0.04, 32: 0.08, 33: 0.14, 34: 0.22, 35: 0.33, 36: 0.46, 37: 0.6, 38: 0.72, 39: 0.82, 40: 0.9 }
export function retireChance(p) {
  const o = p.o ?? 70, ag = p.ag
  const shift = o >= 90 ? -3.5 : o >= 86 ? -2.5 : o >= 82 ? -1.5 : o >= 78 ? -0.5 : o >= 74 ? 0.5 : 1.5
  const eff = ag + shift
  let c = eff < 30 ? 0 : eff >= 41 ? 0.95 : RET[Math.floor(eff)] + (RET[Math.min(40, Math.floor(eff) + 1)] - RET[Math.floor(eff)]) * (eff % 1)
  // a man out of the league's level (the end of a bench, nobody's rotation) leaves earlier
  if (o < 70 && ag >= 27) c = Math.max(c, 0.12 + (ag - 27) * 0.06)
  // (the forties: almost nobody; LeBron, Vince Carter and a handful of others)
  if (ag >= 40) c = Math.max(c, 0.5 + (ag - 40) * 0.2)
  return clamp(0, 1, c)
}

// a season's line as a career row (SeasonLine → car)
const CAR_K = ['gp', 'gs', 'min', 'pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta']
export function careerRow(y, s, line) {
  const row = { y, s }
  for (const k of CAR_K) row[k] = Math.round(line[k] ?? 0)
  return row
}
function teamOfId(F) {
  const m = new Map()
  for (const [s, T] of Object.entries(F.teams)) for (const p of T.r) m.set(p.i, s)
  return m
}

export function ageLeague(F) {
  const R = rngOf(`nba-age-${F.seed}-${F.year}`)
  const where = teamOfId(F)
  const news = [], retired = []
  const all = [...Object.values(F.teams).flatMap(T => T.r), ...(F.fa ?? [])]
  // the retirements (the GM's own builds are his call, never the dice)
  for (const p of all) {
    if (p.b != null) continue
    if (R.u() < retireChance(p)) retired.push(p)
  }
  const gone = new Set(retired.map(p => p.i))
  for (const T of Object.values(F.teams)) T.r = T.r.filter(p => !gone.has(p.i))
  if (F.fa) F.fa = F.fa.filter(p => !gone.has(p.i))
  for (const p of retired) {
    const tot = (p.car ?? []).reduce((s, r) => ({ gp: s.gp + r.gp, pts: s.pts + r.pts, reb: s.reb + r.reb, ast: s.ast + r.ast }), { gp: 0, pts: 0, reb: 0, ast: 0 })
    ;(F.retired ??= []).push({ n: p.n, i: p.i, ag: p.ag, yrs: p.ys ?? (p.car ?? []).length, car: p.car ?? [], aw: p.aw ?? [], o: p.o, s: where.get(p.i) ?? null })
    if ((p.o ?? 0) >= 84 || tot.pts >= 15000 || (p.aw ?? []).some(a => a.k === 'MVP' || a.k === 'ALL1'))
      news.push({ k: 'retire', i: p.i, text: `${p.n} has retired after ${p.ys ?? (p.car ?? []).length} seasons${tot.gp ? `, with career averages of ${(tot.pts / tot.gp).toFixed(1)} points, ${(tot.reb / tot.gp).toFixed(1)} rebounds and ${(tot.ast / tot.gp).toFixed(1)} assists` : ''}.` })
  }
  // a year older
  for (const p of all) {
    if (gone.has(p.i)) continue
    const l = F.ss?.[p.i]
    const mpg = l?.gp ? l.min / l.gp : 0
    if (p.b != null) { p.ag++; p.ys = (p.ys ?? 0) + 1; continue }   // the GM's build: core grows it from his own rules
    ageMan(p, R, { mpg: l ? mpg : null })
  }
  return { retired, news }
}

// ── Prospects and the made-up men ───────────────────────────────────────────────
const SHAPE = {
  PG: { jumpShot: 6, finishing: 5.5, passing: 7.5, handles: 7.5, perimeterDefense: 5, speed: 7, bounce: 5.5, size: 3.5, basketballIQ: 6.5, clutch: 5 },
  SG: { jumpShot: 7, finishing: 6, passing: 5, handles: 6, perimeterDefense: 5.5, speed: 6.5, bounce: 6, size: 5, basketballIQ: 5.5, clutch: 5 },
  SF: { jumpShot: 6, finishing: 6, passing: 4.5, handles: 5, perimeterDefense: 6, speed: 6, bounce: 6, size: 6.5, basketballIQ: 5.5, clutch: 5 },
  PF: { jumpShot: 5, finishing: 6, rebounding: 6, playmaking: 4, interiorDefense: 5.5, speed: 5.5, bounce: 6, size: 6, basketballIQ: 5, clutch: 4.5 },
  C: { jumpShot: 3.5, finishing: 6.5, rebounding: 7, playmaking: 3.5, interiorDefense: 7, speed: 4, bounce: 5.5, size: 7.5, basketballIQ: 5, clutch: 4 },
}
const HT = { PG: [73, 77], SG: [75, 79], SF: [78, 81], PF: [80, 83], C: [82, 86] }
export function attrsFor(spot, o, R) {
  const g = groupOfPos(spot), types = typesOf(g), base = SHAPE[spot] ?? SHAPE.SG
  const a = Object.fromEntries(types.map(t => [t, (base[t] ?? 5) + R.n() * 1.3]))
  for (let k = 0; k < 6; k++) {
    for (const t of types) a[t] = clamp(1, 11, a[t])
    const now = ovrOf({ g, a })
    if (Math.abs(now - o) < 0.5) break
    const shift = (o - now) / OVR_PER_GRADE
    for (const t of types) a[t] += shift
  }
  for (const t of types) a[t] = Math.round(clamp(0, 11, a[t]) * 100) / 100
  return a
}
// the ceiling the class's nth best prospect has, on average, and how far from it a 19-, 20-, 21-year-old is
const pkMean = rank => 86.5 - 2.6 * Math.pow(Math.log(Math.max(1, rank)), 1.4)
export function prospect(R, { rank = 30, spot = null, ag = null } = {}) {
  const sp = spot ?? R.pick(['PG', 'SG', 'SG', 'SF', 'SF', 'PF', 'PF', 'C'])
  const age = ag ?? (rank <= 14 ? R.pick([19, 19, 19, 20, 20, 21]) : R.pick([19, 20, 20, 21, 21, 22, 22]))
  // right-skewed: most land near their slot, a few are far better (one pick in twenty)
  let pk = pkMean(rank) + R.n() * 4.5 + (R.u() < 0.04 ? 5 + R.u() * 7 : 0)
  pk = clamp(60, 97, pk)
  const gap = Math.max(1, (25 - age) * 2 + 1 + R.n() * 2.5)
  const o = clamp(55, 84, Math.round(pk - gap))
  const [h0, h1] = HT[sp]
  const ht = h0 + R.int(0, h1 - h0)
  return { p: sp, g: groupOfPos(sp), o, pk: Math.round(Math.max(pk, o)), a: attrsFor(sp, o, R), ag: age, ht, wt: Math.round(ht * 2.85 - 7 + R.n() * 8), ys: 0 }
}
export function seedPotential(p, R) {
  if (p.pk != null) return p
  const room = Math.max(0, 27 - p.ag)
  p.pk = Math.round(clamp(p.o ?? 70, 99, (p.o ?? 70) + room * (0.6 + R.u() * 1.4) + R.n() * 2.5))
  return p
}
