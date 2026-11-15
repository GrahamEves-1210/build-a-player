// FRANCHISE: the head coaches.
//
// Every CPU team is run by its real staff (src/data/nfl-coaches.js: head coach, offensive and defensive
// coordinator, five 0-11 ratings each, and who calls the plays). The player's team is run by the coach he SPINS:
// the build page's own mechanic, on coaches. Spin a team's staff, the wheel lands on one of its three coaches,
// take ONE of that man's five ratings into its line; five spins fill the five lines (one respin of the team and
// one of the coach a build, as with a player). Then a STYLE, a name and a face.
//
// The five ratings, and what each one does (the same rules for every team: a real staff on a CPU team, the
// player's built coach on his):
//   offPlaycalling  the offense on the sim's 1-12 scale: (v - 5) x 0.15  (a 10 is +0.75, a 2 is -0.45)
//   defPlaycalling  the defense, the same way
//   situational     a close game late (4th quarter or overtime, within 8): the team's edge (v - 5) x 0.2
//   talentDev       a young man's growth each offseason (25 and under): (v - 5) x 0.18 OVR a year
//   culture         chemistry (the player's team): how fast it builds a week, how much of it a turnover costs
// STYLE (the player's coach only): PLAYERS' COACH chemistry builds faster · DEVELOPER young players grow +1 a
// year · MOTIVATOR a lift in the playoffs and on a moment · RECRUITER the market and the draft lean his way.
//
// A CPU team's play-caller is whoever calls that side in real life (a head coach who calls his own side, or the
// coordinator); a built coach calls both. The league's first-year calibration (league.js calibrate) counts each
// team's real staff in, so year one still plays like the real league; the player's coach replaces the real
// head coach, so a better coach than the real one lifts the team and a worse one costs it.
//
// The engine's hooks (one call each, where the effect lands):
//   strength (league.js)     coachEdge(F, short)        { off, def } added to the team's sim ratings
//   the game (game.js)       coachLate(F, short)        the edge in a close game late
//   game day (season.js)     coachDay(F, short, { po }) the team's lift for the day (a Motivator in January)
//   chemistry (season.js)    chemWeek(F) / chemKept(F)  a week's growth / the share kept through a turnover
//   growth (offseason.js)    coachDev(F, short, p)      OVR a year added to a young man's growth
//   scouting / market        recruits(F)                true for a Recruiter
import { NFL_COACHES } from '../../data/nfl-coaches'
import { NFL_TEAMS } from '../../data/nfl-teams'
import { clamp } from './rng'
import { seededShuffle } from '../rng'

export const CTYPES = ['talentDev', 'offPlaycalling', 'defPlaycalling', 'culture', 'situational']
export const CLABEL = { talentDev: 'TALENT DEVELOPMENT', offPlaycalling: 'OFFENSIVE PLAYCALLING', defPlaycalling: 'DEFENSIVE PLAYCALLING', culture: 'CULTURE BUILDING', situational: 'SITUATIONAL AWARENESS' }
export const CSHORT = { talentDev: 'DEV', offPlaycalling: 'OFF', defPlaycalling: 'DEF', culture: 'CUL', situational: 'SIT' }
export const ROLE = { HC: 'HEAD COACH', OC: 'OFF. COORDINATOR', DC: 'DEF. COORDINATOR' }
export const STYLES = {
  players: { name: "PLAYERS' COACH", fx: 'CHEMISTRY BUILDS FASTER' },
  developer: { name: 'DEVELOPER', fx: 'YOUNG PLAYERS GROW FASTER' },
  motivator: { name: 'MOTIVATOR', fx: 'PLAYOFFS AND BIG MOMENTS' },
  recruiter: { name: 'RECRUITER', fx: 'FREE AGENTS AND PROSPECTS' },
}
// a 0-11 rating as a letter (the build page's scale: 0 F, 3 C, 6 B, 9 A, 11 S)
const LETTER = ['F', 'D-', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'S']
export const cLetter = v => LETTER[clamp(0, 11, Math.round(v ?? 0))]

// A head coach's overall, 0-99: the data file's own formula (its header), so a built coach reads on the same
// scale as the real ones. `r`: { talentDev: 7, ... }; a line still open counts as the average of the ones in.
export function coachOvr(r) {
  const vals = CTYPES.map(t => r?.[t]).filter(v => typeof v === 'number')
  if (!vals.length) return null
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  const v = t => (typeof r[t] === 'number' ? r[t] : avg)
  const hi = Math.max(v('offPlaycalling'), v('defPlaycalling')), lo = Math.min(v('offPlaycalling'), v('defPlaycalling'))
  return clamp(0, 99, Math.round(46 + 5.1 * (0.26 * v('culture') + 0.22 * v('situational') + 0.18 * v('talentDev') + 0.24 * hi + 0.10 * lo)))
}

// ── The real staffs ──────────────────────────────────────────────────────────
const ORDER = { HC: 0, OC: 1, DC: 2 }
const STAFF = {}
for (const c of NFL_COACHES) if (c?.team && c.attrs && ORDER[c.role] != null) (STAFF[c.team] ??= []).push(c)
for (const k in STAFF) STAFF[k].sort((a, b) => ORDER[a.role] - ORDER[b.role])
export const staffOf = short => STAFF[short] ?? []
export const realHC = short => STAFF[short]?.find(c => c.role === 'HC') ?? null
// the teams whose staff the wheel can land on (every club, in the schedule's order)
export const STAFF_TEAMS = NFL_TEAMS.map(t => t.short).filter(s => STAFF[s]?.length)

// who calls a side's plays on a real staff: the head coach when he calls his own side, else the coordinator
function callerOf(short, side) {
  const st = STAFF[short] ?? [], hc = st.find(c => c.role === 'HC')
  if (hc?.calls === side) return hc
  return st.find(c => c.role === (side === 'off' ? 'OC' : 'DC')) ?? hc ?? null
}
const KEY = { off: 'offPlaycalling', def: 'defPlaycalling' }
// a team's coach in the sim: the player's own on his team; elsewhere the real staff
//   { name, r: { the five }, calls: { off, def } (the two play-callers' ratings), mine }
const cache = new Map()
export function coachOf(F, short) {
  if (short === F.team && F.coach?.r) { const r = F.coach.r; return { name: F.coach.name, r, calls: { off: r.offPlaycalling ?? 5, def: r.defPlaycalling ?? 5 }, mine: true } }
  if (!cache.has(short)) {
    const hc = realHC(short)
    const off = callerOf(short, 'off'), def = callerOf(short, 'def')
    cache.set(short, hc ? { name: hc.name, r: hc.attrs, calls: { off: off?.attrs[KEY.off] ?? 5, def: def?.attrs[KEY.def] ?? 5 }, ovr: hc.ovr } : { name: null, r: Object.fromEntries(CTYPES.map(t => [t, 5])), calls: { off: 5, def: 5 } })
  }
  return cache.get(short)
}
// the real staff's edge for a team, as the league's calibration counts it in (never the player's coach)
export function realEdge(short) {
  const off = callerOf(short, 'off'), def = callerOf(short, 'def')
  return { off: callEdge(off?.attrs[KEY.off] ?? 5), def: callEdge(def?.attrs[KEY.def] ?? 5) }
}

// ── The effects ──────────────────────────────────────────────────────────────
const r2 = v => Math.round(v * 100) / 100
export const callEdge = v => r2((v - 5) * 0.15)
export function coachEdge(F, short) {
  const c = coachOf(F, short)
  return { off: callEdge(c.calls.off), def: callEdge(c.calls.def) }
}
// a close game late (the 4th quarter or overtime, within one score)
export const coachLate = (F, short) => r2(((coachOf(F, short).r.situational ?? 5) - 5) * 0.2)
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
// growth: OVR a year added to a young man's (25 and under) on this team, from the coach's talent development
export function coachDev(F, short, p) {
  if (!p || p.ag > 25) return 0
  const c = coachOf(F, short)
  return r2(((c.r.talentDev ?? 5) - 5) * 0.18 + (c.mine && F.coach?.style === 'developer' ? 1 : 0))
}
export const recruits = F => F.coach?.style === 'recruiter'

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
export const coachByName = (t, name) => staffOf(t).find(c => c.name === name) ?? null
// take a rating off the landed coach into its line
export function takeLine(cb, type) {
  const c = cb.cur && coachByName(cb.cur.t, cb.cur.c)
  if (!c || cb.lines[type]) return cb
  return { ...cb, cur: null, lines: { ...cb.lines, [type]: { v: c.attrs[type], from: c.name, t: cb.cur.t } } }
}
export const linesDone = cb => CTYPES.every(t => cb?.lines?.[t])
// the finished coach for the franchise: { name, face, style, r: { the five }, from: { type: [coach, team] }, ovr }
export function finishCoach(cb, { name, face, style }) {
  const r = Object.fromEntries(CTYPES.map(t => [t, cb.lines[t]?.v ?? 5]))
  const from = Object.fromEntries(CTYPES.map(t => [t, cb.lines[t] ? [cb.lines[t].from, cb.lines[t].t] : null]))
  return { name, face, style, r, from, ovr: coachOvr(r) }
}
// what he is, from his best rating (the card's one line)
const KIND = { talentDev: 'TEACHER', offPlaycalling: 'OFFENSIVE MIND', defPlaycalling: 'DEFENSIVE MIND', culture: 'CULTURE BUILDER', situational: 'GAME MANAGER' }
export function coachKind(r) {
  const top = CTYPES.filter(t => typeof r?.[t] === 'number').sort((a, b) => r[b] - r[a])
  return top.length ? KIND[top[0]] : null
}
