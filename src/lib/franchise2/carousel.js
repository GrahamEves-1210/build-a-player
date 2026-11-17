// FRANCHISE: the coaching carousel, the offseason's first stop (the NFL's Black Monday and the weeks after it).
//
// openCarousel(F) runs when the season closes (awards.js closeSeason), in the order the league does it (owner,
// 11-16: the player is part of Black Monday, not told about it afterwards):
//   1. The season goes on every head coach's record; play-callers move a step with what their side did (a top-5
//      unit's caller often gets better, a bottom-5 one's worse; young coaches learn, old ones slip).
//   2. Every coach is a year older. Old coaches retire (head coaches from about 66, coordinators from about 64).
//   3. BLACK MONDAY. CPU teams fire head coaches on the grounds the NFL does: a bad season, a disappointing one
//      (fewer wins than the roster should have won), two bad ones in a row, with patience for a first- or
//      second-year coach and for a winner. Coordinators go when their side is near the bottom of the league.
//      The player makes his own calls the same day: keep or fire his OC and DC (Staff.jsx, BLACK MONDAY).
//   4. runHires(F), once he's done with Monday: the head-coach openings are filled: the league's hot coordinators (a top unit, a play-caller, young),
//      fired head coaches, college head coaches. A coordinator hired as a head coach leaves a hole behind him
//      (on the player's team too: the NFL lets any team interview another's coordinators for a head-coaching job).
//   5. A new head coach brings his own coordinators, unless the one there is good enough to keep.
//   6. The hiring: he interviews the men out of work (four interviews an opening; the coordinators he and the league
//      fired on Monday are in the pool, the ones a new head coach let go too), and offers the job; a man with other offers picks the best job for him
//      (calling plays first, then a winner, then the head coach). The league's own coordinator openings fill when the
//      player is done (closeCarousel), from the same pool.
// The pool (F.cpool): every coach out of work (fired, passed over, the real ones out of the league) plus the year's
// up-and-comers (NFL position coaches, college coordinators, college head coaches), who stay a year if nobody hires
// them. The wire reports each move (coachWire).
//   F.car = { y, v: 2, ev: [moves], mine: { oc|dc: { iv: [ids interviewed], gone: [ids] } }, hd (the head-coach hires
//   are done), done }  (a car with no v: an older save's, its hires already done in openCarousel)
import { SHORTS, strength } from './league'
import { records, recText } from './standings'
import { rngOf, clamp, roll } from './rng'
import { coachName } from './coachNames'
import { callerYear, cultureYear, coachAge } from './potential'
import { COACH_MIX } from './faces'
import { ensureStaff, staffOf, staffMen, coachOvr, coachGrade, rOf, nickOf, ROLE_LONG, cLetter, CTYPES, toArr, brokeWord, BROKEN_WORD } from './coach'

const SIDE = { oc: 'off', dc: 'def' }
const J = { off: 1, def: 2 }
const yy = y => String(y).slice(-2)
const NK = s => nickOf(s).toUpperCase()
const ROLE_ABBR = { hc: 'HC', oc: 'OC', dc: 'DC' }

// ── Up-and-comers: the year's new names ──────────────────────────────────────
const SCHOOLS = ['MICHIGAN', 'OHIO STATE', 'GEORGIA', 'ALABAMA', 'OREGON', 'TEXAS', 'LSU', 'PENN STATE', 'NOTRE DAME', 'CLEMSON', 'USC', 'WASHINGTON', 'UTAH', 'IOWA', 'OLE MISS', 'TENNESSEE', 'MISSOURI', 'KANSAS STATE', 'OKLAHOMA', 'MIAMI', 'FLORIDA STATE', 'WISCONSIN', 'INDIANA', 'BOISE STATE', 'TEXAS A&M', 'SMU', 'ARIZONA STATE', 'BYU']
const POS_JOB = { off: ['QB COACH', 'PASS GAME COORD.', 'RUN GAME COORD.', 'WR COACH', 'OL COACH', 'TE COACH'], def: ['LB COACH', 'SECONDARY COACH', 'DL COACH', 'DEF. PASS GAME COORD.', 'DEF. RUN GAME COORD.', 'DEF. BACKS COACH'] }
// NFL coaching staffs: mostly white, about a fifth Black, a few others (faces.js COACH_MIX); the name and the drawn
// face both follow it (coachNames.js, faces.js coachLook)
const BG = COACH_MIX
function takenNames(F) {
  const out = new Set()
  for (const s of SHORTS) { const M = staffMen(F, s); for (const c of [M.hc, M.oc, M.dc]) if (c?.n) out.add(c.n) }
  for (const c of F.cpool ?? []) out.add(c.n)
  return out
}
// kind: 'pos' an NFL position coach · 'col' a college coordinator · 'colhc' a college head coach · 'home' the
// player's own staff (promote from within)
export function genCoach(F, R, side, kind, { team, taken = takenNames(F) } = {}) {
  const g = BG[R.wpick(BG.map(x => x[1]))][0]
  let n
  for (let k = 0; k < 30; k++) { n = coachName(R.u, g); if (!taken.has(n)) break }
  taken.add(n)
  const v = (m, s, lo = 1, hi = 9) => clamp(lo, hi, Math.round(m + R.n() * s))
  const hc = kind === 'colhc'
  const own = hc ? v(4.6, 1.4) : kind === 'home' ? v(3.4, 1.0, 2, 6) : v(3.6, 1.4)
  const r = side === 'off'
    ? [v(5.1, 1.3), own, hc ? v(3, 0.8) : 2, hc ? v(5.4, 1.3) : v(3.7, 0.9), v(hc ? 4.8 : 4.3, 1.1)]
    : [v(5.1, 1.3), hc ? v(3, 0.8) : 2, own, hc ? v(5.4, 1.3) : v(3.6, 0.9), v(hc ? 4.8 : 4.3, 1.1)]
  const ag = hc ? R.int(42, 58) : kind === 'col' ? R.int(35, 52) : R.int(31, 46)
  const cv = kind === 'colhc' ? `${R.pick(SCHOOLS)} HEAD COACH` : kind === 'col' ? `${R.pick(SCHOOLS)} ${side === 'off' ? 'OC' : 'DC'}` : `${NK(team ?? R.pick(SHORTS))} ${R.pick(POS_JOB[side])}`
  return { i: F.cid++, n, ag, r, sd: side, st: F.year + 1, cv, g, ...(R.u() >= 0.85 && { nc: 1 }), nw: 1, ...(kind === 'colhc' && { col: 1 }), ...(kind === 'home' && { home: team }) }
}

// ── How the league reads a coach ─────────────────────────────────────────────
const blendOf = (c, role) => { const r = rOf(c); return r ? (coachOvr(r, role) - 46) / 5.1 : 4 }
// a team's hiring list for a coordinator's job: his side's play-calling first, then teaching and the game late
function coordScore(F, c, role, salt) {
  const r = c.r, j = J[SIDE[role]]
  return r[j] + r[0] * 0.25 + r[4] * 0.15 - (c.ag > 66 ? 1.5 : 0) + (c.hy ? 0.3 : 0) + (roll(`${F.seed}-${F.year}-cs-${c.i}-${salt}`) - 0.5) * 3
}
// (a team doesn't rehire the man it let go this offseason)
const letGo = (F, c, s) => c.fb === s && c.fired === F.year
// fits a coordinator's job (his own side; a former head coach from that side too)
// (a former head coach takes a coordinator's job in his fifties, not at the end of a long career)
const fitsRole = (c, role) => c.sd === SIDE[role] && !c.col && (c.hy ? c.ag <= 60 : c.ag <= 68)

// every coach readable (an old save's or a placeholder coach: five ratings in the middle-low range, an age, a side)
export function saneStaff(F) {
  const fix = c => {
    if (!c || c.mine) return
    if (!Array.isArray(c.r) || c.r.length !== 5) c.r = toArr(c.r && typeof c.r === 'object' && !Array.isArray(c.r) ? c.r : null)
    c.ag = c.ag ?? 45
    if (c.sd !== 'off' && c.sd !== 'def') c.sd = c.r[1] >= c.r[2] ? 'off' : 'def'
  }
  for (const s of SHORTS) { const T = F.staff?.[s]; if (T) { fix(T.hc); fix(T.oc); fix(T.dc); T.call = T.call ?? { off: 'oc', def: 'dc' }; T.rec = T.rec ?? [] } }
  for (const c of F.cpool ?? []) fix(c)
  F.cpool = (F.cpool ?? []).filter(Boolean)
}
// ── 1-5: openCarousel ────────────────────────────────────────────────────────
export function openCarousel(F) {
  ensureStaff(F); saneStaff(F)
  const R = rngOf(`${F.seed}-${F.year}-coaches`)
  const recs = records(F)
  const po = new Set([...(F.po?.seeds?.AFC ?? []), ...(F.po?.seeds?.NFC ?? [])])
  // the sides' ranks: points scored (1 = the most) and allowed (1 = the fewest)
  const offRank = rankBy(SHORTS, s => -recs[s].pf), defRank = rankBy(SHORTS, s => recs[s].pa)
  // what the roster should have won: wins fitted on the teams' strength (off + def), this league, this season
  const xs = Object.fromEntries(SHORTS.map(s => { const st = strength(F, s); return [s, st.off + st.def] }))
  const mx = mean(SHORTS.map(s => xs[s])), mw = mean(SHORTS.map(s => recs[s].w + recs[s].t / 2))
  const cov = mean(SHORTS.map(s => (xs[s] - mx) * (recs[s].w - mw))), vr = mean(SHORTS.map(s => (xs[s] - mx) ** 2)) || 1
  const expW = s => mw + (cov / vr) * (xs[s] - mx)
  const car = { y: F.year, v: 2, ev: [], mine: {}, ranks: Object.fromEntries(SHORTS.map(s => [s, [offRank[s], defRank[s]]])) }
  F.car = car
  const ev = e => car.ev.push({ ...e, ...(e.s === F.team && { mine: 1 }) })

  // 1. the season on the record; the callers move with their sides
  for (const s of SHORTS) {
    const T = staffOf(F, s), M = staffMen(F, s), r = recs[s]
    T.rec = [...(T.rec ?? []), [r.w, r.l, r.t, po.has(s) ? 1 : 0]].slice(-6)
    if (T.hc && !T.hc.mine) { T.hc.hy = (T.hc.hy ?? 0) + 1; T.hc.hw = (T.hc.hw ?? 0) + r.w; T.hc.hl = (T.hc.hl ?? 0) + r.l }
    for (const side of ['off', 'def']) {
      const who = T.call?.[side] === 'hc' ? 'hc' : side === 'off' ? 'oc' : 'dc'
      const c = M[who]
      if (!c || c.mine) continue
      const rk = side === 'off' ? offRank[s] : defRank[s], j = J[side]
      // (up to his hidden ceiling: potential.js)
      callerYear(c, j, rk, R)
    }
    if (T.hc && !T.hc.mine) cultureYear(T.hc, r.w, R)
  }
  // 2. a year older; the young learn, the old slip; the old retire
  const everyone = []
  for (const s of SHORTS) { const T = staffOf(F, s); for (const k of ['hc', 'oc', 'dc']) if (T[k] && !T[k].mine) everyone.push([T[k], s, k]) }
  for (const [c] of everyone) {
    c.ag++
    coachAge(c, R)
  }
  for (const c of F.cpool) { c.ag++; c.out = (c.out ?? 0) + 1 }
  for (const [c, s, k] of everyone) {
    const T = staffOf(F, s), r = recs[s]
    const p = k === 'hc' ? (c.ag >= 64 ? 0.1 + (c.ag - 64) * 0.05 + (r.w <= 6 ? 0.1 : 0) : 0) : (c.ag >= 64 ? 0.1 + (c.ag - 64) * 0.05 : 0)
    if (p > 0 && R.u() < p) { T[k] = null; ev({ k: 'ret', role: k, s, n: c.n, ag: c.ag, id: c.i }) }
  }
  // 3. Black Monday: head coaches
  const hcOpen = []
  for (const s of SHORTS) {
    const T = staffOf(F, s), c = T.hc
    if (s === F.team) continue
    if (!c) { hcOpen.push(s); continue }
    const r = recs[s], w = r.w + r.t / 2
    const t = F.year - (c.st ?? F.year) + 1
    const prev = T.rec.length >= 2 ? T.rec[T.rec.length - 2] : null
    let p = w <= 3 ? 0.92 : w <= 4 ? 0.86 : w <= 5 ? 0.74 : w <= 6 ? 0.58 : w <= 7 ? 0.34 : w <= 8 ? 0.16 : w <= 9 ? 0.07 : 0.015
    if (po.has(s)) p *= 0.15
    if (w >= 11) p = 0                                  // (an 11-win coach keeps his job)
    p *= t <= 1 ? 0.22 : t === 2 ? 0.65 : 1
    if (prev && prev[0] <= 6) p *= 1.3
    const recentPo = T.rec.slice(-4, -1).some(x => x[3])
    if (t >= 5 && recentPo) p *= 0.6
    p *= clamp(0.55, 1.6, 1 + 0.12 * (expW(s) - w))
    p *= clamp(0.7, 1.15, 1.25 - c.r[3] * 0.05)
    if (R.u() < clamp(0, 0.95, p)) {
      T.hc = null; hcOpen.push(s)
      c.cv = `${NK(s)} HC ${tenureText(c.st, F.year)}`; c.out = 0; c.fired = F.year; c.fb = s; F.cpool.push(c)
      ev({ k: 'fire', role: 'hc', s, n: c.n, id: c.i, rec: recText(r), yrs: t })
    }
  }
  // coordinators whose side sank (the head coach kept: a new one decides his own staff below)
  for (const s of SHORTS) {
    if (s === F.team) continue
    const T = staffOf(F, s)
    if (!T.hc) continue
    for (const k of ['oc', 'dc']) {
      const c = T[k]; if (!c) continue
      const rk = k === 'oc' ? offRank[s] : defRank[s]
      const t = F.year - (c.st ?? F.year) + 1
      let p = rk >= 29 ? 0.6 : rk >= 25 ? 0.42 : rk >= 21 ? 0.14 : 0.02
      if (po.has(s)) p *= 0.25
      if (T.call?.[SIDE[k]] === 'hc') p *= 0.45          // (his head coach calls that side: less of it is on him)
      if (t <= 1) p *= 0.5
      if (c.int) p = Math.max(p, 0.6)                     // (an interim coordinator: most teams hire a real one)
      if (R.u() < p) { T[k] = null; toPool(F, c, s, k); ev({ k: 'fire', role: k, s, n: c.n, id: c.i, rank: rk }) }
    }
  }
  // the year's new names (after the firings, so the pool knows who's out)
  const taken = takenNames(F)
  for (let j = 0; j < 8; j++) F.cpool.push(genCoach(F, R, 'off', j < 5 ? 'pos' : 'col', { taken }))
  for (let j = 0; j < 8; j++) F.cpool.push(genCoach(F, R, 'def', j < 5 ? 'pos' : 'col', { taken }))
  for (let j = 0; j < 3; j++) F.cpool.push(genCoach(F, R, j % 2 ? 'def' : 'off', 'colhc', { taken }))
  // (4. the head-coach hires wait for the player's own Monday: runHires)
  car.step = 'monday'
  F.stage = 'coaches'
  return car
}
// 4-5. The head-coach hires, the worst record first, once the player has made his Monday calls (a coordinator he
// fired can be hired as someone's head coach; one he kept can leave for a head-coaching job)
export function runHires(F) {
  const car = F.car
  if (!car || car.hd || !car.v || car.done) return false
  saneStaff(F)
  const R = rngOf(`${F.seed}-${F.year}-coaches-hires`)
  const recs = records(F)
  const offRank = Object.fromEntries(SHORTS.map(s => [s, car.ranks?.[s]?.[0] ?? 16])), defRank = Object.fromEntries(SHORTS.map(s => [s, car.ranks?.[s]?.[1] ?? 16]))
  const ev = e => car.ev.push({ ...e, ...(e.s === F.team && { mine: 1 }) })
  const hcOpen = SHORTS.filter(s => s !== F.team && !staffOf(F, s).hc).sort((a, b) => recs[a].w - recs[b].w)
  for (const s of hcOpen) hireHC(F, R, s, { offRank, defRank, ev })
  car.hd = 1
  return true
}
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
function rankBy(list, f) { const o = [...list].sort((a, b) => f(a) - f(b)); return Object.fromEntries(o.map((s, i) => [s, i + 1])) }
const tenureText = (st, y) => (st >= y ? `${y}` : `${st}-${yy(y)}`)
function toPool(F, c, s, k) {
  c.cv = `${NK(s)} ${ROLE_ABBR[k]} ${tenureText(c.st ?? F.year, F.year)}`
  c.out = 0; c.fired = F.year; c.fb = s; delete c.int; delete c.tl
  F.cpool.push(c)
}
// a head coach for team s: the league's hot coordinators, fired head coaches, college head coaches
function hireHC(F, R, s, { offRank, defRank, ev }) {
  const cands = []
  for (const c of F.cpool) {
    if (c.ag > 68 || c.out > 3 || letGo(F, c, s)) continue
    if (c.hy) {
      const wp = (c.hw ?? 0) + (c.hl ?? 0) > 0 ? c.hw / (c.hw + c.hl) : 0.5
      cands.push({ c, from: null, v: blendOf(c, 'hc') + 0.1 + (wp - 0.5) * 2 - 0.3 * Math.max(0, c.out - 1) - (c.fired === F.year ? 0.4 : 0) })
    } else if (c.col) cands.push({ c, from: null, v: blendOf(c, 'hc') + 0.3 })
  }
  for (const o of SHORTS) {
    if (o === s) continue
    const T = staffOf(F, o)
    for (const k of ['oc', 'dc']) {
      const c = T[k]
      if (!c || c.ag > 60 || c.st > F.year) continue      // (hired this offseason: not a candidate yet)
      const rk = k === 'oc' ? offRank[o] : defRank[o], calls = T.call?.[SIDE[k]] !== 'hc'
      const unit = rk <= 5 ? 0.8 : rk <= 10 ? 0.4 : rk >= 23 ? -0.6 : 0
      cands.push({ c, from: [o, k], v: blendOf(c, 'hc') + 0.5 + unit + (calls ? 0.3 : -0.3) + (c.ag <= 44 ? 0.3 : c.ag >= 55 ? -0.5 : 0) })
    }
  }
  for (const x of cands) x.v += R.n() * 0.55
  cands.sort((a, b) => b.v - a.v)
  const pick = cands[R.wpick(cands.slice(0, 4).map((x, i) => [5, 3, 2, 1][i]))] ?? null
  const T = staffOf(F, s)
  const c = pick?.c ?? genCoach(F, R, R.u() < 0.5 ? 'off' : 'def', 'colhc')
  let fromText = null
  if (pick?.from) {
    const [o, k] = pick.from, OT = staffOf(F, o)
    OT[k] = null
    if (OT.call?.[SIDE[k]] !== 'hc') OT.call = { ...OT.call, [SIDE[k]]: k }
    fromText = `${nickOf(o)} ${ROLE_LONG[k]}`
    ev({ k: 'leave', role: k, s: o, n: c.n, id: c.i, to: s })
  } else F.cpool = F.cpool.filter(x => x !== c)
  const was = c.cv
  c.st = F.year + 1; delete c.out; delete c.fired; delete c.fb; delete c.nw; delete c.col; delete c.cv
  T.hc = c; T.rec = []
  // he calls his own side when he's a good play-caller on it
  const j = J[c.sd]
  const calls = c.r[j] >= 8 ? R.u() < 0.8 : c.r[j] >= 6 ? R.u() < 0.35 : false
  T.call = { off: c.sd === 'off' && calls ? 'hc' : 'oc', def: c.sd === 'def' && calls ? 'hc' : 'dc' }
  ev({ k: 'hire', role: 'hc', s, n: c.n, id: c.i, from: fromText, was })
  // 5. his coordinators: a good one stays; the one on his own side, if he calls it, most often goes
  for (const k of ['oc', 'dc']) {
    const x = T[k]
    if (!x) continue
    const good = x.r[J[SIDE[k]]] >= 7
    const keep = (T.call[SIDE[k]] === 'hc' ? 0.2 : good ? 0.55 : 0.3)
    if (R.u() >= keep) { T[k] = null; toPool(F, x, s, k); ev({ k: 'fire', role: k, s, n: x.n, id: x.i, newHC: 1 }) }
  }
}

// ── 6. The player's stop ─────────────────────────────────────────────────────
export const IV_N = 4
export const carouselOn = F => F.phase === 'off' && F.stage === 'coaches' && F.car && !F.car.done
// his jobs open now (a coordinator who retired or left for a head-coaching job, or one he fired)
export function myOpenings(F) {
  const T = staffOf(F, F.team)
  return ['oc', 'dc'].filter(k => !T[k])
}
export function fireMine(F, k) {
  if (!carouselOn(F)) return false
  const T = staffOf(F, F.team), c = T[k]
  if (!c) return false
  T[k] = null
  if (T.call?.[SIDE[k]] !== 'hc') T.call = { ...T.call, [SIDE[k]]: k }
  toPool(F, c, F.team, k)
  F.car.ev.push({ k: 'fire', role: k, s: F.team, n: c.n, id: c.i, mine: 1 })
  return true
}
const jobOf = (F, k) => (F.car.mine[k] ??= { iv: [], gone: [] })
// the men a team in need could hire for job k, best first, as the league sees them (no grades: the interview shows them)
export function shortlist(F, k, n = 8) {
  if (!F.car) return []
  saneStaff(F)
  const J0 = jobOf(F, k)
  const list = F.cpool.filter(c => fitsRole(c, k) && !c.home && !J0.gone.includes(c.i)).map(c => ({ c, v: coordScore(F, c, k, 'buzz') })).sort((a, b) => b.v - a.v).slice(0, n).map(x => x.c)
  return [...list, homeCandidate(F, k)]
}
// promote from within: his own position coach (always takes it)
export function homeCandidate(F, k) {
  const J0 = jobOf(F, k)
  if (J0.home) { const c = F.cpool.find(x => x.i === J0.home); if (c) return c }
  const R = rngOf(`${F.seed}-${F.year}-home-${k}`)
  const c = genCoach(F, R, SIDE[k], 'home', { team: F.team })
  F.cpool.push(c); J0.home = c.i
  return c
}
// the CPU teams that want him for the same job (he's on their short list), and whether they'd let him call plays
function rivalsFor(F, c, k) {
  const out = []
  for (const s of SHORTS) {
    if (s === F.team) continue
    const T = staffOf(F, s)
    if (T[k] || !T.hc) continue
    const top = F.cpool.filter(x => fitsRole(x, k) && !x.home && !letGo(F, x, s)).map(x => ({ x, v: coordScore(F, x, k, s) })).sort((a, b) => b.v - a.v).slice(0, 3)
    if (top.some(y => y.x === c)) out.push({ s, calls: T.call?.[SIDE[k]] !== 'hc' })
  }
  return out
}
export function interviewCoach(F, k, id) {
  const J0 = jobOf(F, k)
  if (J0.iv.includes(id)) return true
  if (J0.iv.length >= IV_N) return false
  J0.iv.push(id)
  return true
}
export const interviewsLeft = (F, k) => IV_N - (F.car?.mine?.[k]?.iv.length ?? 0)
export function interviewView(F, k, id) {
  const c = F.cpool.find(x => x.i === id)
  if (!c) return null
  const r = rOf(c)
  return { c, r, grade: coachGrade(r, k), wants: !c.nc, rivals: c.home ? [] : rivalsFor(F, c, k), seen: c.home || F.car.mine[k]?.iv.includes(id) }
}
// what a job is worth to him: calling the plays first, then a winner, then the head coach (and a little that's just
// him: the city, the money, the people he knows). Each part kept, so the screen can say why he picked a team.
function jobParts(F, c, s, calls) {
  const r = records(F)[s]   // (last season's record: the schedule is still last season's in the offseason)
  const wp = r ? (r.w + r.t / 2) / Math.max(1, r.w + r.l + r.t) : 0.5
  const M = staffMen(F, s), hr = M.hc ? rOf(M.hc) ?? F.coach?.r : null
  const hcv = s === F.team ? coachOvr(F.coach?.r ?? {}) : hr ? coachOvr(hr) : 72
  // (the player's team, two hiring cycles after its head coach went back on a play-calling promise: coach.js brokeWord)
  const word = s === F.team && brokeWord(F) ? BROKEN_WORD : 1
  return { calls: calls ? (c.nc ? 0.1 : 0.35) * word : 0, win: wp * 0.3, hc: clamp(0, 1, (hcv - 60) / 30) * 0.15, fit: roll(`${F.seed}-${F.year}-jv-${c.i}-${s}`) * 0.2 }
}
const sumParts = x => x.calls + x.win + x.hc + x.fit + (x.first ?? 0)
function jobValue(F, c, s, calls) { return sumParts(jobParts(F, c, s, calls)) }
// The offer. calls: he calls that side's plays. Returns { to (the team he picks), board: [{ s, calls, v }] }
export function offerCoach(F, k, id, { calls = true } = {}) {
  if (!carouselOn(F)) return null
  runHires(F)
  // (the side that isn't his head coach's: the coordinator always calls it)
  if (staffMen(F, F.team).hc?.sd !== SIDE[k]) calls = true
  const T = staffOf(F, F.team)
  if (T[k]) return null
  const c = F.cpool.find(x => x.i === id)
  if (!c || !(c.home || F.car.mine[k]?.iv.includes(id))) return null
  // (the team that interviewed him and offers first has the edge: the other teams are still interviewing)
  const board = [{ s: F.team, calls, ...(c.home ? { v: 9 } : { parts: { ...jobParts(F, c, F.team, calls), first: 0.12 } }) }, ...(c.home ? [] : rivalsFor(F, c, k).map(x => ({ ...x, parts: jobParts(F, c, x.s, x.calls) })))]
  for (const b of board) if (b.parts) b.v = sumParts(b.parts)
  board.sort((a, b) => b.v - a.v)
  const to = board[0].s
  if (to === F.team) {
    placeCoach(F, F.team, k, c)
    T.call = { ...T.call, [SIDE[k]]: calls ? k : 'hc' }
    // the play-calling on the head coach's own side, handed over to get him: a promise for his first season
    // (coach.js promiseOf / breakPromise)
    if (calls && staffMen(F, F.team).hc?.sd === SIDE[k]) T.pr = { ...(T.pr ?? {}), [SIDE[k]]: { c: c.i, n: c.n, y: F.year + 1 } }
  } else {
    placeCoach(F, to, k, c)
    const OT = staffOf(F, to)
    if (OT.call?.[SIDE[k]] !== 'hc') OT.call = { ...OT.call, [SIDE[k]]: k }
    jobOf(F, k).gone.push(c.i)
  }
  return { to, board, c }
}
function placeCoach(F, s, k, c) {
  F.cpool = F.cpool.filter(x => x !== c)
  const was = c.cv
  c.st = F.year + 1; delete c.out; delete c.fired; delete c.fb; delete c.nw; delete c.home; delete c.cv
  staffOf(F, s)[k] = c
  F.car.ev.push({ k: 'hire', role: k, s, n: c.n, id: c.i, ...(s === F.team && { mine: 1, was }) })
}
// Why he took the job he took, in plain words: the part of the winning offer that beat the player's (or, when the
// player won, beat the best other offer). { k: 'calls' | 'win' | 'hc' | 'first' | 'fit' | 'only' | 'home', s, vs }
export function offerWhy(F, res) {
  if (!res?.board?.length) return null
  const win = res.board.find(b => b.s === res.to), mine = res.board.find(b => b.s === F.team)
  if (res.c?.home || !win?.parts) return { k: 'home', s: res.to }
  const other = res.to === F.team ? res.board.find(b => b.s !== F.team) : mine
  if (!other) return { k: 'only', s: res.to }
  const d = Object.fromEntries(['calls', 'win', 'hc', 'first', 'fit'].map(k => [k, (win.parts[k] ?? 0) - (other.parts?.[k] ?? 0)]))
  const k = Object.keys(d).sort((a, b) => d[b] - d[a])[0]
  return { k: d[k] > 0.02 ? k : 'fit', s: res.to, vs: other.s }
}
export function setCarStep(F, step) {
  if (!F.car) return
  if (step !== 'monday') runHires(F)
  F.car.step = step
}

// The player done: the league's openings fill, the pool thins out, on to the awards
export function closeCarousel(F) {
  const car = F.car
  if (!car || car.done) { if (F.stage === 'coaches') F.stage = 'awards'; return }
  runHires(F)
  const R = rngOf(`${F.seed}-${F.year}-coaches-close`)
  saneStaff(F)
  // (a job of his still open: his own position coach steps up)
  for (const k of myOpenings(F)) { const c = homeCandidate(F, k); placeCoach(F, F.team, k, c); const T = staffOf(F, F.team); if (T.call?.[SIDE[k]] !== 'hc') T.call = { ...T.call, [SIDE[k]]: k } }
  const teams = R.shuffle(SHORTS.filter(s => s !== F.team))
  for (const k of ['oc', 'dc']) for (const s of teams) {
    const T = staffOf(F, s)
    if (T[k]) continue
    const best = F.cpool.filter(c => fitsRole(c, k) && !c.home && !letGo(F, c, s)).map(c => ({ c, v: coordScore(F, c, k, s) })).sort((a, b) => b.v - a.v)[0]?.c
    const c = best ?? genCoach(F, R, SIDE[k], 'pos', { team: s })
    if (!best) F.cpool.push(c)
    placeCoach(F, s, k, c)
    if (T.call?.[SIDE[k]] !== 'hc') T.call = { ...T.call, [SIDE[k]]: k }
  }
  // every team a full staff (a head coach too: a college head coach if the pool had nobody)
  for (const s of SHORTS) { const T = staffOf(F, s); if (!T.hc) { const c = genCoach(F, R, 'off', 'colhc'); c.st = F.year + 1; delete c.cv; T.hc = c; T.call = { off: 'oc', def: 'dc' }; car.ev.push({ k: 'hire', role: 'hc', s, n: c.n, id: c.i }) } }
  // the pool: the men nobody hired move on (TV, college jobs, retirement); the up-and-comers go back to their jobs
  F.cpool = F.cpool.filter(c => {
    if (c.home) return false
    if (c.nw) return R.u() < 0.35
    const p = c.ag >= 70 ? 0.55 : c.out >= 3 ? 0.45 : c.ag >= 64 ? 0.3 : 0.12
    return R.u() >= p
  })
  for (const c of F.cpool) delete c.nw
  if (F.cpool.length > 40) F.cpool = F.cpool.sort((a, b) => (b.hy ? 1 : 0) - (a.hy ? 1 : 0) || a.out - b.out).slice(0, 40)
  car.done = 1; delete car.mine; delete car.ranks
  F.stage = 'awards'
}

// ── The player's head coach: the owner's patience ────────────────────────────
// No owner fires the player's coach (the player IS the coach): after a bad stretch the owner's warning shows instead.
// Hot: the last two seasons 11 wins or fewer together, or three straight out of the playoffs with 7 or fewer wins each.
export function hotSeat(F) {
  const h = (F.hist ?? []).slice(-3)
  if (h.length < 2) return null
  const two = h.slice(-2), w2 = two.reduce((a, x) => a + x.w, 0), l2 = two.reduce((a, x) => a + x.l, 0)
  const out = x => x.fin === 'out'
  if (w2 <= 11 && two.every(out)) return { n: 2, w: w2, l: l2 }
  if (h.length === 3 && h.every(x => out(x) && x.w <= 7)) return { n: 3, w: h.reduce((a, x) => a + x.w, 0), l: h.reduce((a, x) => a + x.l, 0) }
  return null
}

// ── The wire ─────────────────────────────────────────────────────────────────
const RL = { hc: 'head coach', oc: 'offensive coordinator', dc: 'defensive coordinator' }
export function moveText(F, e) {
  const t = nickOf(e.s)
  if (e.k === 'fire' && e.role === 'hc') return `${t} fire head coach ${e.n} after a ${e.rec} season`
  if (e.k === 'fire') return `${t} fire ${RL[e.role]} ${e.n}`
  if (e.k === 'ret') return `${t} ${RL[e.role]} ${e.n} retires at ${e.ag}`
  if (e.k === 'hire' && e.role === 'hc') return e.from ? `${t} hire ${e.from} ${e.n} as head coach` : `${t} hire ${e.n} as head coach`
  if (e.k === 'hire') return `${t} hire ${e.n} as ${RL[e.role]}`
  if (e.k === 'leave') return `${e.n} leaves the ${t} to coach the ${nickOf(e.to)}`
  return ''
}
// his résumé line: a man on a staff by his job and the year he took it; a man out of work by his last job
export function cvOf(F, c, s, k) {
  if (!c) return ''
  if (c.mine) return ''
  if (s && k) return `${NK(s)} ${c.tl ?? ROLE_ABBR[k]} SINCE ${c.st ?? F.year}`
  return c.cv ?? ''
}
// the wire's items for this offseason's moves (news.js wire: the offseason's block)
export function coachWire(F) {
  const car = F.car
  if (!car || car.y !== F.year || F.phase !== 'off') return []
  const TAG = { fire: 'FIRED', ret: 'RETIRED', hire: 'HIRED' }
  return car.ev.filter(e => e.k !== 'leave').map(e => ({ k: 'coach', tag: TAG[e.k], s: e.s, text: moveText(F, e), big: e.role === 'hc' || !!e.mine }))
}
// the grades a screen shows for a coach (never a number): the five letters, and one letter for his job
export const gradesOf = (c, role = 'hc') => { const r = rOf(c) ?? c?.r; return r ? { five: CTYPES.map(t => [t, cLetter(r[t])]), one: coachGrade(r, role) } : null }
