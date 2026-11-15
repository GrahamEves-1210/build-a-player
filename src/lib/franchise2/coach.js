// FRANCHISE: the coaches. Every team's staff (a head coach, an offensive and a defensive coordinator), what each
// man does to the team, and the player's own head coach, built by the spin.
//
// THE STAFFS (F.staff[short] = { hc, oc, dc, call: { off: 'hc' | 'oc', def: 'hc' | 'dc' }, rec })
//   Year one is the real league: every club's real head coach, OC and DC from src/data/nfl-coaches.js, with the
//   real play-calling setup (a head coach who calls his own side, or the coordinator). The player's team keeps its
//   real OC and DC under the coach he built; the real head coach he replaced is out of work (the pool, F.cpool).
//   After that the staffs move: carousel.js (Black Monday, the hires, coaches aging and retiring).
//   A coach: { i, n, ag, r: [talentDev, off, def, culture, situational] (0-11), sd: 'off' | 'def' (his side),
//   st (the year he took this job), cv (his résumé line), hy / hw / hl (his seasons and record as a head coach in
//   this league), g (a made-up man's background, for his drawn face), nc (he doesn't need to call plays) }
//   The player's head coach is F.coach (finishCoach); his slot in F.staff holds `{ mine: 1 }`.
//
// WHAT EACH RATING DOES (the same rules for every team)
//   play-calling   the side's sim rating gets (v - mid) x 0.15 from WHOEVER CALLS THAT SIDE: the head coach when he
//                  calls it, else the coordinator (mid 5.53 offense, 5.94 defense: CALL_MID; an 11 is about +0.8)
//   situational    a close game late (4th quarter or overtime, within 8): the head coach (v - 4.66) x 0.2, and the
//                  two coordinators' average a little (x 0.1, against the real league's coordinators)
//   talentDev      a young man's growth (25 and under) a year: the head coach (v - 5.41) x 0.18, and his side's
//                  coordinator (v - 5.39) x 0.12 (the middles keep year one's league averages: see CALL_MID)
//   culture        chemistry (the player's team): how fast it builds a week, how much a turnover costs
// STYLE (the player's coach only): PLAYERS' COACH chemistry builds faster · DEVELOPER young players grow +1 a
// year · MOTIVATOR a lift in the playoffs and on a moment · RECRUITER the market and the draft lean his way.
// The league's first-year calibration (league.js calibrate) counts each team's REAL play-callers in (realEdge), so
// year one plays like the real league; a better caller than the real one lifts a team, a worse one costs it.
//
// No overall NUMBER for a coach on any screen (owner, 11-15): his five grades, and at most one letter (coachGrade).
//
// The engine's hooks (one call each, where the effect lands):
//   strength (league.js)     coachEdge(F, short)        { off, def } added to the team's sim ratings
//   the game (game.js)       coachLate(F, short)        the edge in a close game late
//   game day (season.js)     coachDay(F, short, { po }) the team's lift for the day (a Motivator in January)
//   chemistry (season.js)    chemWeek(F) / chemKept(F)  a week's growth / the share kept through a turnover
//   growth (aging.js)        coachDev(F, short, p)      OVR a year added to a young man's growth
//   scouting / market        recruits(F)                true for a Recruiter
import { NFL_COACHES, COACH_FREE_AGENTS } from '../../data/nfl-coaches'
import { NFL_TEAMS } from '../../data/nfl-teams'
import { clamp } from './rng'
import { seededShuffle } from '../rng'

export const CTYPES = ['talentDev', 'offPlaycalling', 'defPlaycalling', 'culture', 'situational']
export const CLABEL = { talentDev: 'TALENT DEVELOPMENT', offPlaycalling: 'OFFENSIVE PLAYCALLING', defPlaycalling: 'DEFENSIVE PLAYCALLING', culture: 'CULTURE BUILDING', situational: 'SITUATIONAL AWARENESS' }
export const CSHORT = { talentDev: 'DEV', offPlaycalling: 'OFF', defPlaycalling: 'DEF', culture: 'CUL', situational: 'SIT' }
export const ROLE = { HC: 'HEAD COACH', OC: 'OFF. COORDINATOR', DC: 'DEF. COORDINATOR' }
export const ROLE_LONG = { hc: 'head coach', oc: 'offensive coordinator', dc: 'defensive coordinator' }
export const STYLES = {
  players: { name: "PLAYERS' COACH", fx: 'CHEMISTRY BUILDS FASTER' },
  developer: { name: 'DEVELOPER', fx: 'YOUNG PLAYERS GROW FASTER' },
  motivator: { name: 'MOTIVATOR', fx: 'PLAYOFFS AND BIG MOMENTS' },
  recruiter: { name: 'RECRUITER', fx: 'FREE AGENTS AND PROSPECTS' },
}
// a 0-11 rating as a letter (the build page's scale: 0 F, 3 C, 6 B, 9 A, 11 S)
const LETTER = ['F', 'D-', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'S']
export const cLetter = v => LETTER[clamp(0, 11, Math.round(v ?? 0))]

// A coach's overall on the data file's own formula (its header), 0-99. Used inside the engine only (a free agent's
// pitch, a team's hiring list); never shown. `r`: { talentDev: 7, ... }; a line still open counts as the average.
function blend(r, role = 'hc') {
  const vals = CTYPES.map(t => r?.[t]).filter(v => typeof v === 'number')
  if (!vals.length) return null
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  const v = t => (typeof r[t] === 'number' ? r[t] : avg)
  if (role === 'oc' || role === 'dc') {
    const own = role === 'oc' ? 'offPlaycalling' : 'defPlaycalling', other = role === 'oc' ? 'defPlaycalling' : 'offPlaycalling'
    return 0.5 * v(own) + 0.2 * v('talentDev') + 0.15 * v('situational') + 0.1 * v('culture') + 0.05 * v(other)
  }
  const hi = Math.max(v('offPlaycalling'), v('defPlaycalling')), lo = Math.min(v('offPlaycalling'), v('defPlaycalling'))
  return 0.26 * v('culture') + 0.22 * v('situational') + 0.18 * v('talentDev') + 0.24 * hi + 0.10 * lo
}
export function coachOvr(r, role = 'hc') { const c = blend(r, role); return c == null ? null : clamp(0, 99, Math.round(46 + 5.1 * c)) }
// the one letter a screen may show for a coach (owner: grades, never a number)
export function coachGrade(r, role = 'hc') { const c = blend(r, role); return c == null ? null : cLetter(c) }

// ── The real staffs ──────────────────────────────────────────────────────────
const ORDER = { HC: 0, OC: 1, DC: 2 }
const STAFF = {}
for (const c of NFL_COACHES) if (c?.team && c.attrs && ORDER[c.role] != null) (STAFF[c.team] ??= []).push(c)
for (const k in STAFF) STAFF[k].sort((a, b) => ORDER[a.role] - ORDER[b.role])
export const staffOfReal = short => STAFF[short] ?? []
export const realHC = short => STAFF[short]?.find(c => c.role === 'HC') ?? null
// the teams whose staff the wheel can land on (every club, in the schedule's order)
export const STAFF_TEAMS = NFL_TEAMS.map(t => t.short).filter(s => STAFF[s]?.length)
const NICK = Object.fromEntries(NFL_TEAMS.map(t => [t.short, t.name.split(' ').slice(-1)[0]]))
export const nickOf = s => NICK[s] ?? s

// who calls a side's plays on a real staff: the head coach when he calls his own side, else the coordinator
function realCaller(short, side) {
  const st = STAFF[short] ?? [], hc = st.find(c => c.role === 'HC')
  if (hc?.calls === side) return hc
  return st.find(c => c.role === (side === 'off' ? 'OC' : 'DC')) ?? hc ?? null
}
const KEY = { off: 'offPlaycalling', def: 'defPlaycalling' }
// the real staff's edge for a team, as the league's calibration counts it in (never the player's coach)
export function realEdge(short) {
  const off = realCaller(short, 'off'), def = realCaller(short, 'def')
  return { off: callEdge(off?.attrs[KEY.off] ?? 5, 'off'), def: callEdge(def?.attrs[KEY.def] ?? 5, 'def') }
}

// ── A coach as the engine holds him ──────────────────────────────────────────
export const toArr = a => CTYPES.map(t => clamp(0, 11, Math.round(a?.[t] ?? 4)))
const RO = new WeakMap()
// his five ratings as { talentDev, offPlaycalling, ... } (a coach object's `r` array; the player's coach has his own)
export function rOf(c) {
  if (!c) return null
  if (c.mine) return null
  if (!Array.isArray(c.r)) return c.r && typeof c.r === 'object' ? c.r : null
  let o = RO.get(c)
  if (!o || o._k !== c.r.join()) { o = Object.fromEntries(CTYPES.map((t, j) => [t, c.r[j]])); Object.defineProperty(o, '_k', { value: c.r.join() }); RO.set(c, o) }
  return o
}
const yy = y => String(y).slice(-2)
// the real résumés of the coaches out of work in the data (facts from their careers; the rest read as "FORMER NFL …")
const CV_FA = {
  'Mike Tomlin': 'STEELERS HC 2007-25', 'Sean McDermott': 'BILLS HC 2017-25', 'Pete Carroll': 'RAIDERS HC 2025 · SEAHAWKS 2010-23',
  'Doug Pederson': 'JAGUARS HC 2022-24 · EAGLES 2016-20', 'Jon Gruden': 'RAIDERS HC 2018-21', 'Jason Garrett': 'COWBOYS HC 2010-19',
  'Rex Ryan': 'BILLS HC 2015-16 · JETS 2009-14', 'Marvin Lewis': 'BENGALS HC 2003-18', 'Jim Caldwell': 'LIONS HC 2014-17 · COLTS 2009-11',
  'Antonio Pierce': 'RAIDERS HC 2023-24', 'Ken Whisenhunt': 'CARDINALS HC 2007-12', 'Pat Shurmur': 'GIANTS HC 2018-19',
  'Jay Gruden': 'WASHINGTON HC 2014-19', 'Matt Canada': 'STEELERS OC 2021-23', 'Scott Turner': 'WASHINGTON OC 2020-22',
  'Greg Olson': 'FORMER RAIDERS OC', 'Jim Schwartz': 'FORMER BROWNS DC · LIONS HC 2009-13', 'Ejiro Evero': 'PANTHERS DC 2023-26',
  'Mike Zimmer': 'VIKINGS HC 2014-21', 'Don Martindale': 'GIANTS DC 2022-23 · RAVENS 2018-21', 'Lovie Smith': 'BEARS HC 2004-12',
  'Jerod Mayo': 'PATRIOTS HC 2024', 'Greg Manusky': 'FORMER WASHINGTON DC', 'Ed Donatell': 'VIKINGS DC 2022',
  'Gregg Williams': 'BILLS HC 2001-03', 'Wade Phillips': 'RAMS DC 2017-19', 'Mike Nolan': '49ERS HC 2005-08',
}
function fromReal(F, c, { team = c.team, role = c.role } = {}) {
  const side = role === 'OC' ? 'off' : role === 'DC' ? 'def' : c.side === 'off' ? 'off' : c.side === 'def' ? 'def' : (c.attrs.offPlaycalling >= c.attrs.defPlaycalling ? 'off' : 'def')
  const x = { i: F.cid++, n: c.name, ag: c.age ?? 45, r: toArr(c.attrs), sd: side, st: c.since ?? F.year, ...(c.interim && { int: 1 }), ...(c.title && { tl: 'DEF. PASS GAME COORD.' }) }
  if (!team) x.cv = CV_FA[c.name] ?? `FORMER NFL ${role === 'HC' ? 'HEAD COACH' : role === 'OC' ? 'OFFENSIVE COORDINATOR' : 'DEFENSIVE COORDINATOR'}`
  if (role === 'HC' || CV_FA[c.name]?.includes(' HC ')) x.hy = 1     // (a head coach before: the league knows him as one)
  return x
}
// The league's staffs, made once (createFranchise, or the first read of an older save)
export function ensureStaff(F) {
  if (F.staff) return F.staff
  F.cid = F.cid ?? 1
  F.staff = {}
  F.cpool = []
  for (const s of STAFF_TEAMS) {
    const st = STAFF[s], hc = st.find(c => c.role === 'HC'), oc = st.find(c => c.role === 'OC'), dc = st.find(c => c.role === 'DC')
    const T = { hc: null, oc: oc ? fromReal(F, oc) : null, dc: dc ? fromReal(F, dc) : null, call: { off: hc?.calls === 'off' ? 'hc' : 'oc', def: hc?.calls === 'def' ? 'hc' : 'dc' }, rec: [] }
    if (s === F.team) {
      T.hc = { mine: 1 }
      // the real head coach the player replaced: out of work, the pool's first man
      if (hc) { const x = fromReal(F, hc, { team: null }); x.cv = hc.since < F.year ? `${NICK[s].toUpperCase()} HC ${hc.since}-${yy(F.year - 1)}` : `FORMER ${NICK[s].toUpperCase()} HC`; x.hy = 1; x.out = 0; F.cpool.push(x) }
    } else T.hc = hc ? fromReal(F, hc) : null
    F.staff[s] = T
  }
  for (const c of COACH_FREE_AGENTS) { const x = fromReal(F, c, { team: null }); x.out = 1; F.cpool.push(x) }
  return F.staff
}
export const staffOf = (F, short) => ensureStaff(F)[short]
// the save: a coach as a row of values (the keys once), the rest of him (a résumé, a flag) in an object at the end
const CK = ['i', 'n', 'ag', 'r', 'sd', 'st', 'hy', 'hw', 'hl']
const crow = c => {
  if (!c || c.mine) return c
  const a = CK.map(k => c[k] ?? null), more = {}
  for (const k in c) if (!CK.includes(k) && c[k] != null) more[k] = c[k]
  if (Object.keys(more).length) a.push(more); else while (a.length && a[a.length - 1] === null) a.pop()
  return a
}
const cobj = a => {
  if (!Array.isArray(a)) return a
  const c = {}; CK.forEach((k, j) => { if (a[j] != null) c[k] = a[j] })
  const m = a[CK.length]; if (m && typeof m === 'object' && !Array.isArray(m)) Object.assign(c, m)
  return c
}
export function packStaff(F) {
  if (!F.staff) return {}
  return { staff: Object.fromEntries(Object.entries(F.staff).map(([s, T]) => [s, { ...T, hc: crow(T.hc), oc: crow(T.oc), dc: crow(T.dc) }])), cpool: (F.cpool ?? []).map(crow) }
}
export function unpackStaff(F) {
  if (!F.staff) return F
  for (const T of Object.values(F.staff)) { if (!T) continue; T.hc = cobj(T.hc); T.oc = cobj(T.oc); T.dc = cobj(T.dc) }
  F.cpool = (F.cpool ?? []).map(cobj)
  return F
}
// the player's coach in the staff's shape (his ratings as the five in order)
export function myHC(F) {
  const c = F.coach
  return c ? { mine: 1, n: c.name, r: toArr(c.r), sd: (c.r?.offPlaycalling ?? 5) >= (c.r?.defPlaycalling ?? 5) ? 'off' : 'def', face: c.face, style: c.style,
    // (his age: the one his face was picked at, a year older every season, so he greys on the staff screen)
    ...(c.face?.ag != null && { ag: c.face.ag + Math.max(0, F.year - (c.face.y ?? F.year)) }) } : null
}
// the three men on a team's staff now: { hc, oc, dc } (the player's head coach as myHC)
export function staffMen(F, short) {
  const T = staffOf(F, short)
  if (!T) return { hc: null, oc: null, dc: null }
  return { hc: T.hc?.mine ? myHC(F) : T.hc, oc: T.oc, dc: T.dc }
}
// the man who calls a side's plays on a team now, and the rating he calls it with (a job still open mid-carousel:
// the head coach has it)
export function callerOf(F, short, side, M = staffMen(F, short)) {
  const T = staffOf(F, short)
  const who = T?.call?.[side] === 'hc' || !M[side === 'off' ? 'oc' : 'dc'] ? 'hc' : side === 'off' ? 'oc' : 'dc'
  const c = M[who]
  return { who, c, v: (Array.isArray(c?.r) ? c.r[side === 'off' ? 1 : 2] : null) ?? 4 }
}

// (a coach with no ratings, an old save's or a placeholder: the middle of the scale)
const MID = Object.freeze(Object.fromEntries(CTYPES.map(t => [t, 5])))
// a team's head coach in the sim: { name, r: { the five }, calls: { off, def } (the two play-callers' ratings), ovr, mine }
export function coachOf(F, short) {
  const M = staffMen(F, short)
  const hc = M.hc
  const calls = { off: callerOf(F, short, 'off', M).v, def: callerOf(F, short, 'def', M).v }
  if (short === F.team && F.coach?.r) return { name: F.coach.name, r: F.coach.r, calls, ovr: coachOvr(F.coach.r), mine: true }
  const r = (hc && (hc.mine ? F.coach?.r : rOf(hc))) || MID
  return { name: hc?.n ?? null, r, calls, ovr: coachOvr(r) ?? 72, ...(hc?.mine && { mine: true }) }
}

// ── The effects ──────────────────────────────────────────────────────────────
const r2 = v => Math.round(v * 100) / 100
// The league-average references every rating is measured against. Re-centred 11-15, when the grades were re-rated
// on reputation (nfl-coaches.js): the real league's averages moved (year-one play-callers 6.13 / 5.31 -> 6.66 / 6.25,
// head coaches' talentDev 6.91 -> 7.31 and situational 6.03 -> 5.69), so each middle moved with them and the
// league's average edge in year one is what it was before; only who is above and below the middle changed.
const CALL_MID = { off: 5.53, def: 5.94 }
const HC_SIT = 4.66, HC_DEV = 5.41
export const callEdge = (v, side = 'off') => r2((v - CALL_MID[side]) * 0.15)
export function coachEdge(F, short) {
  const c = coachOf(F, short)
  return { off: callEdge(c.calls.off, 'off'), def: callEdge(c.calls.def, 'def') }
}
// a close game late (the 4th quarter or overtime, within one score): the head coach, and his coordinators a little
const SIT_COORD = 4.41   // (the real league's coordinators' average situational rating)
export function coachLate(F, short) {
  const M = staffMen(F, short)
  const hc = (Array.isArray(M.hc?.r) ? M.hc.r[4] : null) ?? 5
  const co = [M.oc, M.dc].filter(c => Array.isArray(c?.r)).map(c => c.r[4] ?? SIT_COORD)
  const avg = co.length ? co.reduce((a, b) => a + b, 0) / co.length : SIT_COORD
  return r2((hc - HC_SIT) * 0.2 + (avg - SIT_COORD) * 0.1)
}
// the day's lift (a Motivator in the playoffs)
export const coachDay = (F, short, { po = false } = {}) => (short === F.team && po && F.coach?.style === 'motivator' ? 0.5 : 0)
// a Motivator's moment: the build's normal rate on a big play, a little up
export const momentLift = F => (F.coach?.style === 'motivator' ? 0.04 : 0)
// chemistry (the player's team): a week's growth, and the share of it a roster turnover keeps
export function chemWeek(F) {
  const cul = F.coach?.r?.culture ?? 5
  return r2(0.15 + cul * 0.04 + (F.coach?.style === 'players' ? 0.25 : 0))
}
export const chemKept = F => clamp(0.4, 0.95, 0.55 + (F.coach?.r?.culture ?? 5) * 0.03 + (F.coach?.style === 'players' ? 0.06 : 0))
// growth: OVR a year added to a young man's (25 and under) on this team: the head coach's talent development and
// his side's coordinator's (offense: the OC; defense: the DC)
const OFF_POS = new Set(['qb', 'rb', 'wr', 'te', 'ol'])
const DEV_COORD = 5.39   // (the real league's coordinators' average talentDev: year one grows like before)
export function coachDev(F, short, p) {
  if (!p || p.ag > 25) return 0
  const c = coachOf(F, short), M = staffMen(F, short)
  const co = OFF_POS.has(p.p) ? M.oc : M.dc
  return r2(((c.r?.talentDev ?? 5) - HC_DEV) * 0.18 + (((Array.isArray(co?.r) ? co.r[0] : null) ?? DEV_COORD) - DEV_COORD) * 0.12 + (c.mine && F.coach?.style === 'developer' ? 1 : 0))
}
export const recruits = F => F.coach?.style === 'recruiter'

// ── The player's staff: who calls the plays ──────────────────────────────────
// side 'off' | 'def', who 'hc' (the player's head coach) or 'oc' / 'dc' (the coordinator). Head coaches take the calls
// back and hand them over in the NFL, in the offseason and during a season.
export function setCalls(F, side, who) {
  const T = staffOf(F, F.team)
  if (!T) return
  const co = side === 'off' ? 'oc' : 'dc'
  if (who !== 'hc' && who !== co) return
  if (who === co && !T[co]) return
  T.call = { ...T.call, [side]: who }
}

// ── The spin (the build page's rules, on head coaches) ───────────────────────
// The wheel is the other 31 clubs' real head coaches (owner, round 3b: no coordinators). It lands on one; take ONE
// of his five ratings into its line; five spins fill the five lines.
// A coach build: { seed, team (the player's club: its own coach is never on the wheel), n (spins dealt),
// rs (respins used), cur: { t, c } (the landing, a rating still to take), lines: { [type]: { v, from, t } } }
// Spin #n lands on the nth coach of the seed's order (nobody twice in a build); the respin is its own draw and never
// lands where it started. One respin a build, as with a player.
export const RESPINS = 1
export const newCoachBuild = (seed, team) => ({ seed, team, n: 0, rs: 0, cur: null, lines: {} })
export const wheelOf = team => STAFF_TEAMS.filter(s => s !== team).map(realHC)
const order = cb => seededShuffle(STAFF_TEAMS.filter(s => s !== cb.team), `${cb.seed}:hc`)
export function dealSpin(cb) {
  const t = order(cb)[cb.n % (STAFF_TEAMS.length - 1)]
  return { t, c: realHC(t).name }
}
export function dealRespin(cb) {
  const used = new Set(Object.values(cb.lines).map(l => l.t))
  const pool = STAFF_TEAMS.filter(s => s !== cb.team && s !== cb.cur?.t && !used.has(s))
  const t = seededShuffle(pool, `${cb.seed}:rs:${cb.n}`)[0]
  return { t, c: realHC(t).name }
}
export const coachByName = (t, name) => staffOfReal(t).find(c => c.name === name) ?? null
// take a rating off the landed coach into its line
export function takeLine(cb, type) {
  const c = cb.cur && coachByName(cb.cur.t, cb.cur.c)
  if (!c || cb.lines[type]) return cb
  return { ...cb, cur: null, lines: { ...cb.lines, [type]: { v: c.attrs[type], from: c.name, t: cb.cur.t } } }
}
export const linesDone = cb => CTYPES.every(t => cb?.lines?.[t])
// the finished coach for the franchise: { name, face, style, r: { the five }, from: { type: [coach, team] } }
export function finishCoach(cb, { name, face, style }) {
  const r = Object.fromEntries(CTYPES.map(t => [t, cb.lines[t]?.v ?? 5]))
  const from = Object.fromEntries(CTYPES.map(t => [t, cb.lines[t] ? [cb.lines[t].from, cb.lines[t].t] : null]))
  return { name, face, style, r, from }
}
// what he is, from his best rating (the card's one line)
const KIND = { talentDev: 'TEACHER', offPlaycalling: 'OFFENSIVE MIND', defPlaycalling: 'DEFENSIVE MIND', culture: 'CULTURE BUILDER', situational: 'GAME MANAGER' }
export function coachKind(r) {
  const top = CTYPES.filter(t => typeof r?.[t] === 'number').sort((a, b) => r[b] - r[a])
  return top.length ? KIND[top[0]] : null
}
