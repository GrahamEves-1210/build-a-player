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
// The balance (2026-11-24, scripts/franchise2/nba-talent.mjs: 20-25 seasons, five seeds): what the classes and the
// young men's ceilings bring in is what the decline and the retirements take out, so the league's count of 90+ men
// (17 on opening night), 85+ (43), 80+ (126) and men 35 and older (19) stays near where it starts. Before it, 85+ ran
// to 70-90 and 90+ to 30-35 inside ten seasons. The numbers that hold it: DECL and cliffAt (a point a year at 31-32,
// two from 33, three past 35), the ceilings of the real men (league.js peakFor = seedPotential here), the class's
// curve (pkMean), and how often a young man's ceiling jumps (ageMan). Change one and run the check.
// Retirement: by age, how good he still is and his deal. Role players go at about 32-35, stars play to 36-40; a man
// signed for next season almost never retires before 33, and a role player's career mostly ends when nobody signs him.
//
//   ageLeague(F) -> { retired: [Man], news: [...], builds: [{ i, n, from, to }] }   the seam: retirements (into
//                               F.retired; the wire for the GM's men, his builds and the notable careers), then every
//                               man a year older (ag, ys, a, o, pk); builds: the GM's builds who lost a step
//                                                       older (ag, ys, a, o, pk). Core has written car by then.
//   careerRow(y, s, line)       a SeasonLine as a car row (the checks use it; core writes its own)
//   ageMan(p, R, { mpg, cliff }) one man's year (mutates p); returns the OVR change (cliff false: no bad summer)
//   retireChance(p, { under })  the chance he retires this summer (under: signed for next season)
//   ageBuild(p, R, { mpg })     the GM's build a year older (the decline from 28; builds.js grows the young ones)
//   notable(p)                  a career the wire and the history page keep
//   seasonsOf(p, { on })        the seasons he played (a real man's NBA service before the save counted)
//   retireText(p, opts)         the wire's retirement line; retiredFacts(p): what the retired list keeps
//   prospect(R, { rank, spot, ag })   a draft prospect's grades: { p, g, o, pk, a, ag, ht, wt } (rank 1 = the best)
//   attrsFor(spot, o, R)        ten grades for a spot that come to this overall
//   seedPotential(p, R)         a real man's ceiling when he has none (core's league.js sets pk at setup)
import { rngOf, clamp } from '../rng'
import { ovrOf, groupOfPos, GUARD_TYPES, BIG_TYPES } from './skills'
import { coachDev } from './coach'
import { realCareer, careerTotals, savedSeasons, predates } from './realCareers'

const ATH = new Set(['speed', 'bounce'])
const TOUCH = new Set(['jumpShot', 'passing', 'playmaking', 'basketballIQ', 'clutch'])
const kindOf = t => (t === 'size' ? 'size' : ATH.has(t) ? 'ath' : TOUCH.has(t) ? 'touch' : 'body')
// the decline, grade points a year by age: [legs, body, touch]
// (the league's curve: about flat from 26 to 29, a point a year by 31 and 32, two from 33, three past 35. The
// summers a man turns 30 to 32 used to cost him 0.4 a year, and the league filled with 85s in their mid-thirties.)
const DECL = { 26: [0, 0, 0], 27: [0.04, 0, 0], 28: [0.12, 0.03, 0], 29: [0.3, 0.1, 0.02], 30: [0.52, 0.22, 0.05], 31: [0.72, 0.34, 0.09], 32: [0.9, 0.46, 0.13], 33: [1.08, 0.6, 0.2], 34: [1.3, 0.8, 0.3], 35: [1.5, 1.0, 0.4], 36: [1.7, 1.2, 0.5] }
// the cliff: the summer a veteran's body goes (the Achilles that never comes back, the knees, the year the legs are
// gone). From 31 on a few men a year lose in one summer what the curve takes in three.
const cliffAt = ag => (ag < 31 ? 0 : Math.min(0.16, 0.05 + 0.02 * (ag - 31)))
const declAt = ag => (ag < 26 ? [0, 0, 0] : DECL[Math.min(36, ag)])
// the share of the gap to his ceiling a young man closes in a year
const RATE = { 18: 0.3, 19: 0.3, 20: 0.29, 21: 0.27, 22: 0.25, 23: 0.23, 24: 0.21, 25: 0.17, 26: 0.1, 27: 0.05 }
const typesOf = g => (g === 'big' ? BIG_TYPES : GUARD_TYPES)
const OVR_PER_GRADE = 44 / 9

export function ageMan(p, R, { mpg = null, coach = 0, cliff = true } = {}) {
  const ag = p.ag, g = p.g ?? groupOfPos(p.p), types = typesOf(g), a = p.a
  const o0 = p.o ?? ovrOf(p)
  // the ceiling moves while he's young: a bust's sinks, a riser's climbs (now and then a big jump: the pick who pops)
  // (and now and then a young man stalls: the jumper never comes, the body breaks down, the ceiling drops)
  if (ag <= 24) {
    const pk0 = p.pk ?? o0
    p.pk = pk0 + R.n() * 1.7 - 0.4 + (R.u() < 0.02 ? 4 + R.u() * 5 : 0) - (ag <= 23 && R.u() < 0.03 ? 4 + R.u() * 5 : 0)
    p.pk = clamp(Math.min(o0 - 2, pk0), 99, p.pk)
  }
  // the breakout summer (one young man in two hundred a year): the jumper comes, the body fills out, he's a different
  // player in camp (the late pick or the undrafted man who becomes a starter, now and then a star)
  let pop = 0
  if (ag >= 20 && ag <= 24 && R.u() < 0.005) { pop = 3 + R.u() * 3; p.pk = Math.max(p.pk ?? o0, o0) + 8 + R.u() * 8 }
  // growth: part of the gap, faster for a young man who played real minutes
  let G = 0
  if (ag <= 27) {
    const gap = Math.max(0, (p.pk ?? o0) - o0)
    const play = mpg == null ? 1 : 0.8 + 0.35 * Math.min(1, mpg / 28)
    G = gap * (RATE[ag] ?? 0.3) * play + R.n() * (ag <= 24 ? 1.1 : 0.6) + pop
    // (his coaches: the head coach's player development and the development coach's, coach.js coachDev)
    if (ag <= 25) G += coach
    // (a bust: a ceiling under what he is now; he loses his place in the rotation and slides back toward it)
    const neg = (p.pk ?? o0) - o0
    if (neg < -1 && ag <= 25) G += neg * 0.5
  }
  // the legs grow only while he's young; the head grows into his late twenties
  const grow = t => { const k = kindOf(t); return k === 'size' ? (ag <= 22 ? 0.25 : 0) : k === 'ath' ? (ag <= 23 ? 0.6 : 0.1) : 1 }
  const W = types.map(t => grow(t))
  const wMean = W.reduce((s, x) => s + x, 0) / W.length
  const unit = G / (OVR_PER_GRADE * wMean)
  // how he plays: more legs than jumper ages fast, a shooter with a head ages well
  const legs = ((a.speed ?? 5) + (a.bounce ?? 5)) / 2, skill = ((a.jumpShot ?? 5) + (a.basketballIQ ?? 5)) / 2
  const style = clamp(0.65, 1.5, 1 + 0.07 * (legs - skill) + (g === 'guard' ? 0.08 : -0.06))
  const luck = Math.exp(R.n() * 0.3) * (cliff && R.u() < cliffAt(ag) ? 2.4 + R.u() * 1.2 : 1)
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
  // (his ceiling follows him up when he passes it; a bust's, under what he is, stays there until 27)
  if (ag >= 27) p.pk = p.o
  else if (p.o > (p.pk ?? 0) && (p.pk ?? 0) >= o0 - 2) p.pk = p.o
  p.pk = Math.round(p.pk)
  p.ag = ag + 1
  p.ys = (p.ys ?? 0) + 1
  return p.o - o0
}

// Retirement: his age, moved by how good he still is (a star plays years longer than a role player). A man under
// contract for next season plays it out: before 33 almost nobody walks away from guaranteed money, after it he's
// half as likely to as a free agent. The role players' careers end when nobody signs them (the street's cut at camp,
// offseason.js pruneStreet), not by retiring at 27.
const RET = { 30: 0.01, 31: 0.04, 32: 0.08, 33: 0.14, 34: 0.22, 35: 0.33, 36: 0.46, 37: 0.6, 38: 0.72, 39: 0.82, 40: 0.9 }
export function retireChance(p, { under = false } = {}) {
  const o = p.o ?? 70, ag = p.ag
  const shift = o >= 90 ? -3.5 : o >= 86 ? -2.5 : o >= 82 ? -1.5 : o >= 78 ? -0.5 : o >= 74 ? 0.5 : 1.5
  const eff = ag + shift
  let c = eff < 30 ? 0 : eff >= 41 ? 0.95 : RET[Math.floor(eff)] + (RET[Math.min(40, Math.floor(eff) + 1)] - RET[Math.floor(eff)]) * (eff % 1)
  // a veteran out of the league's level (the end of a bench, nobody's rotation), his deal done, calls it
  if (!under && o < 70 && ag >= 31) c = Math.max(c, 0.1 + (ag - 31) * 0.08)
  // (the forties: almost nobody; LeBron, Vince Carter and a handful of others)
  if (ag >= 40) c = Math.max(c, 0.5 + (ag - 40) * 0.2)
  if (under) c = ag < 33 ? Math.min(c, 0.003) : c * 0.5
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

// a notable career: the wire reports his retirement (and the history page keeps him: offseason.js)
// (tot: his whole career, the real seasons before the save included: careerTot)
export function notable(p, tot = careerTot(p)) {
  const aw = p.aw ?? []
  return (p.o ?? 0) >= 82 || tot.pts >= 12000 || seasonsOf(p) >= 15 || aw.some(a => ['MVP', 'DPOY', 'FMVP', 'ALL1', 'ALL2', 'ALL3', 'ROY', '6MOY'].includes(a.k)) || aw.filter(a => a.k === 'AS').length >= 2
}
const careerTot = p => careerTotals(p)
// The seasons he played, the way a retirement is written ("after 19 seasons"): a real man's NBA service before the
// save (realCareers.js) and his seasons in it; a man whose whole career is in this league, the seasons on his line;
// anyone else, his years of service and the one just played. on: he was on a roster this season (a year on a roster
// counts even when an injury took all of it).
export function seasonsOf(p, { on = false, aged = false } = {}) {
  const base = realCareer(p)
  const here = savedSeasons(p)
  if (base) return base.yrs + Math.max(here, on ? 1 : 0)
  if (!predates(p)) return Math.max(1, here)
  // (aged: the summer has already added the season just played to his years, as it has for a man cut from the street at camp)
  return (p.ys ?? 0) + (!aged && (on || here > 0) ? 1 : 0)
}
// The retirement as the wire reports it: his age, his seasons, his career averages (a real man's from his real
// career; a man whose earlier seasons the league has no numbers for gets none: no line is better than a false one),
// and what he leaves on the table. street: he went unsigned all summer first.
export function retireText(p, { on = false, street = false, deal = '' } = {}) {
  const tot = careerTot(p), yrs = seasonsOf(p, { on, aged: street })
  const avg = tot.whole && tot.gp >= 20 ? `, with career averages of ${(tot.pts / tot.gp).toFixed(1)} points, ${(tot.reb / tot.gp).toFixed(1)} rebounds and ${(tot.ast / tot.gp).toFixed(1)} assists` : ''
  return `${p.n}${street ? ', unsigned through the summer,' : ''} has retired at ${p.ag} after ${yrs} ${yrs === 1 ? 'season' : 'seasons'}${avg}.${deal}`
}
// what the retired list keeps of him beyond his rows (offseason.js retiredRow): his seasons, and his real career
// before the save as [games, points, rebounds, assists] (rc), so his page shows the whole of it
export function retiredFacts(p, { on = false, aged = false } = {}) {
  const base = realCareer(p)
  return { yrs: seasonsOf(p, { on, aged }), ...(base && { rc: [base.gp, base.pts, base.reb, base.ast] }), ...(p.num != null && { num: p.num }) }
}
export function ageLeague(F) {
  const R = rngOf(`nba-age-${F.seed}-${F.year}`)
  const where = teamOfId(F)
  const news = [], retired = [], builds = []
  const all = [...Object.values(F.teams).flatMap(T => T.r), ...(F.fa ?? [])]
  // the retirements: his age, his level, his deal. The GM's own builds too, a little later (from 35, the odds x0.6,
  // the way football's builds go), and none plays past 40.
  for (const p of all) {
    const under = where.has(p.i) && (p.y ?? 0) >= 2
    const c = retireChance(p, { under })
    if (p.b != null ? p.ag >= 40 || (p.ag >= 35 && R.u() < c * 0.6) : R.u() < c) retired.push(p)
  }
  const gone = new Set(retired.map(p => p.i))
  for (const T of Object.values(F.teams)) T.r = T.r.filter(p => !gone.has(p.i))
  if (F.fa) F.fa = F.fa.filter(p => !gone.has(p.i))
  for (const p of retired) {
    const tot = careerTot(p), s = where.get(p.i) ?? null
    const mine = s != null && s === F.team
    const on = s != null
    ;(F.retired ??= []).push({ n: p.n, i: p.i, ag: p.ag, ...retiredFacts(p, { on }), car: p.car ?? [], aw: p.aw ?? [], o: p.o, s, ...(p.b != null && { b: p.b }), ...((mine || p.b != null || new Set((p.car ?? []).filter(c => c.s === F.team).map(c => c.y)).size >= 3) && { gm: 1 }) })
    if (p.b != null && F.builds?.[p.b]) F.builds[p.b].done = F.year
    // the wire: every man off the GM's roster, his builds, and the notable careers
    if (!(mine || p.b != null || notable(p, tot))) continue
    const deal = mine && (p.y ?? 0) >= 2 ? ` He walks away from the final ${p.y - 1 === 1 ? 'year' : `${p.y - 1} years`} of his contract.` : ''
    news.push({ k: 'retire', i: p.i, ...(mine && { s }), text: retireText(p, { on, deal }) })
  }
  // a year older
  for (const p of all) {
    if (gone.has(p.i)) continue
    const l = F.ss?.[p.i]
    const mpg = l?.gp ? l.min / l.gp : 0
    if (p.b != null) { const d = ageBuild(p, R, { mpg: l ? mpg : null }); if (d) builds.push(d); continue }
    ageMan(p, R, { mpg: l ? mpg : null, coach: where.has(p.i) ? coachDev(F, where.get(p.i), p) : 0 })
  }
  return { retired, news, builds }
}
// The GM's build a year older: while he's young his grades go up a step at a time by the game's own rule
// (builds.js growBuilds, after this); from 28 he ages the way every man does (the same curve, the legs first), each
// grade moved by the league's change and rounded by the dice, so a whole grade comes off now and then, not a
// fraction every year. Returns { i, n, from, to } when his OVR moved down.
export function ageBuild(p, R, { mpg = null } = {}) {
  const was = p.o ?? ovrOf(p)
  if (p.ag >= 28) {
    const q = { ...p, a: { ...p.a } }
    ageMan(q, R, { mpg, cliff: false })   // (the league's curve, not its cliffs: the GM's own man never loses three years in a summer)
    for (const t of Object.keys(p.a)) {
      const d = (q.a[t] ?? p.a[t]) - p.a[t]
      if (d >= 0) continue
      const whole = Math.trunc(d), frac = d - whole
      p.a[t] = clamp(0, 11, Math.round(p.a[t]) + whole - (R.u() < -frac ? 1 : 0))
    }
    p.o = ovrOf(p)
  }
  p.ag++
  p.ys = (p.ys ?? 0) + 1
  p.pk = Math.max(p.pk ?? p.o, p.o)
  return p.o < was ? { i: p.i, n: p.n, from: was, to: p.o } : null
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
const pkMean = rank => 87.3 - 2.35 * Math.pow(Math.log(Math.max(1, rank)), 1.4)
export function prospect(R, { rank = 30, spot = null, ag = null } = {}) {
  const sp = spot ?? R.pick(['PG', 'SG', 'SG', 'SF', 'SF', 'PF', 'PF', 'C'])
  // right-skewed: most land near their slot, a few are far better (one pick in thirty)
  // (the top ten are the widest spread: the franchise player and the miss both come from there, so the league keeps
  // its 90s without filling up with 85s)
  let pk = pkMean(rank) + (rank <= 10 ? R.n() * 5.6 - 1 : R.n() * 4.5) + (R.u() < 0.03 ? 4 + R.u() * 6 : 0)
  // what the scouts can't see (hid: the board reads his ceiling without it): about one in six never develops (nearly one in three of the top ten) (his
  // ceiling is about what he is now or below it, so he slides back: the Bennetts, Thabeets and Okafors, most often the top picks, taken on what they
  // might become); one in fifty is a late bloomer, 10-20 better than anyone thought (the second-rounder who becomes
  // a star: the Jokics, Draymonds and Brunsons)
  // (his age in his rookie season, the age he turns in his draft year: one-and-done freshmen at the top of the board, more
  // upperclassmen after the lottery, a fifth-year senior now and then)
  const age = ag ?? (rank <= 14 ? R.pick([19, 19, 19, 20, 20, 21]) : R.pick([19, 20, 20, 21, 21, 22, 22, 22, 23]))
  const pk0 = clamp(60, 97, pk)
  const gap = Math.max(1, (25 - age) * 2 + 1 + R.n() * 2.5)
  const o = clamp(55, 84, Math.round(pk0 - gap))
  const roll = R.u()
  if (roll < (rank <= 10 ? 0.3 : 0.14)) pk = Math.min(pk0, o + 1 - R.u() * 13)
  else if (roll > 0.98) pk = pk0 + 10 + R.u() * 10
  pk = clamp(60, 97, pk)
  const hid = Math.round(pk - pk0)
  const [h0, h1] = HT[sp]
  const ht = h0 + R.int(0, h1 - h0)
  return { p: sp, g: groupOfPos(sp), o, pk: Math.round(pk), a: attrsFor(sp, o, R), ag: age, ht, wt: Math.round(ht * 2.85 - 7 + R.n() * 8), ys: 0, hid: Math.round(hid) }
}
export function seedPotential(p, R) {
  if (p.pk != null) return p
  const room = Math.max(0, 27 - p.ag)
  p.pk = Math.round(clamp(p.o ?? 70, 99, (p.o ?? 70) + room * (0.35 + R.u() * 1.15) + R.n() * 2.5))
  return p
}
