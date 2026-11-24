// NBA FRANCHISE: the coaches. Every team's staff (a head coach, a lead assistant who runs the offense, a defensive
// coordinator and a player development coach), what each man does to the team, the GM's own head coach (built by
// the spin in the setup, the way football's is: CoachBuild.jsx with this league's pieces), the hires he makes, and the
// league's coaching carousel each spring.
//
// THE STAFFS (F.staff[short] = { hc, oc, dc, pd, rec: [[w, l, playoffs]] })
//   Year one is the real league's head coaches (src/data/nba-coaches.js). The assistants are made-up men (the league's
//   real assistants change every summer and aren't tracked anywhere reliable), the same for every new franchise
//   (seeded by the team, not the save), so the setup's HIRE step shows the men the save will have.
//   The GM's team: his built coach is F.coach (finishCoach) and the staff's hc is { mine: 1 }; the real head coach he
//   took over from is out of work (F.cpool). A save from before coaches existed keeps its team's real head coach.
//   A coach: { i, n, ag, r: [dev, off, def, rot, late] (0-11), st (the season he took this job), cv (his résumé while
//   out of work), g (a made-up man's background, for his drawn face), real (a real coach), shot (his ESPN id when ESPN
//   has his studio headshot), hy / hw / hl (his seasons and record as a head coach in this league) }
//
// WHAT EACH RATING DOES (every team the same; a rating is measured against the real league's average, so the league
// as a whole plays as it did before coaches; the numbers are a shot's chance to go in, home court being 0.012):
//   off    the team's shots: the head coach (v - mid) x 0.0011, the lead assistant (v - 6) x 0.0005
//   def    the shots it gives up: the head coach and the defensive coordinator, the same weights
//   rot    a bench unit (three or more of the starters sitting): the head coach (v - mid) x 0.002 each way
//   late   the last five minutes of a game within five: the head coach (v - mid) x 0.004, his two coordinators a
//          little (x 0.0012)
//   dev    a young man's growth (25 and under), OVR a summer: the head coach (v - mid) x 0.15, the player
//          development coach (v - 6) x 0.1
//   STYLE (the GM's coach): PACE AND SPACE half a second quicker a trip and more threes · DEFENSE FIRST half a second
//   slower, the defense a little better and the offense a little worse · DEVELOPER young players +0.8 a summer ·
//   PLAYERS' COACH free agents weigh an offer from his team a little higher (market.js offerScore)
//   (scripts/franchise2/nba-coach.mjs measures it: the best staff against the worst over many seasons)
//
// No overall NUMBER for a coach on any screen (football's rule): his five grades and at most one letter (coachGrade).
import { NBA_COACHES, NBA_COACH_FREE_AGENTS } from '../../../data/nba-coaches'
import { TEAM, SHORTS, teamOvr } from './league'
import { rngOf, clamp } from '../rng'
import { seededShuffle } from '../../rng'
import { coachName } from '../coachNames'
import { cLetter } from '../coach'
import { addNews } from './news'
import { HEADSHOT_BASE } from '../../../utils/simulation'

export { cLetter }
export const CTYPES = ['dev', 'off', 'def', 'rot', 'late']
export const CLABEL = { dev: 'PLAYER DEVELOPMENT', off: 'OFFENSIVE SCHEME', def: 'DEFENSIVE SCHEME', rot: 'ROTATIONS', late: 'GAME MANAGEMENT' }
export const CSHORT = { dev: 'DEVELOPMENT', off: 'OFFENSE', def: 'DEFENSE', rot: 'ROTATIONS', late: 'GAME MGMT' }
// the words a staff screen uses: spelled out (full) and one word (a tight list)
export const CNAME = { dev: 'Player development', off: 'Offensive scheme', def: 'Defensive scheme', rot: 'Rotations', late: 'Game management' }
export const CWORD = { dev: 'Develop', off: 'Offense', def: 'Defense', rot: 'Rotations', late: 'Game mgmt' }
export const STYLES = {
  pace: { name: 'PACE AND SPACE', fx: 'MORE POSSESSIONS, MORE THREES' },
  defense: { name: 'DEFENSE FIRST', fx: 'A SLOWER GAME, A TOUGHER DEFENSE' },
  developer: { name: 'DEVELOPER', fx: 'YOUNG PLAYERS GROW FASTER' },
  players: { name: "PLAYERS' COACH", fx: 'FREE AGENTS LEAN HIS WAY' },
}
// the staff's jobs below the head coach
export const JOBS = ['oc', 'dc', 'pd']
export const JOB = { hc: 'HC', oc: 'AC', dc: 'DC', pd: 'PD' }
export const JOB_LONG = { hc: 'HEAD COACH', oc: 'LEAD ASSISTANT', dc: 'DEFENSIVE COORDINATOR', pd: 'PLAYER DEVELOPMENT' }
export const JOB_WHAT = { oc: 'Runs the offense', dc: 'Runs the defense', pd: 'Works with the young players' }
const OWN = { oc: 1, dc: 2, pd: 0 }   // (the line a job is hired for, in the five's order)

// ── Grades (never a number on screen) ────────────────────────────────────────
const W = { hc: [0.22, 0.24, 0.24, 0.12, 0.18], oc: [0.15, 0.55, 0.1, 0.08, 0.12], dc: [0.15, 0.1, 0.55, 0.08, 0.12], pd: [0.7, 0.1, 0.1, 0.05, 0.05] }
const arrOf = r => (Array.isArray(r) ? r : r && typeof r === 'object' ? CTYPES.map(t => r[t]) : null)
function blend(r, role = 'hc') {
  const a = arrOf(r)
  if (!a) return null
  const vals = a.filter(v => typeof v === 'number')
  if (!vals.length) return null
  const avg = vals.reduce((x, y) => x + y, 0) / vals.length
  return (W[role] ?? W.hc).reduce((s, w, j) => s + w * (typeof a[j] === 'number' ? a[j] : avg), 0)
}
export const coachGrade = (r, role = 'hc') => { const b = blend(r, role); return b == null ? null : cLetter(b) }
const score = (r, role) => blend(r, role) ?? 5
export const toArr = a => CTYPES.map(t => clamp(0, 11, Math.round(a?.[t] ?? 5)))
export const rOf = c => (!c || c.mine ? null : Array.isArray(c.r) ? Object.fromEntries(CTYPES.map((t, j) => [t, c.r[j]])) : c.r ?? null)

// ── The real head coaches ────────────────────────────────────────────────────
const BY_TEAM = Object.fromEntries(NBA_COACHES.map(c => [c.team, c]))
export const realHC = s => BY_TEAM[s] ?? null
export const STAFF_TEAMS = SHORTS.filter(s => BY_TEAM[s])
// the real league's average on each line (a rating is measured against it)
const MID = Object.fromEntries(CTYPES.map(t => [t, NBA_COACHES.reduce((a, c) => a + c.attrs[t], 0) / NBA_COACHES.length]))
const AMID = 6   // (a made-up assistant's line he was hired for: genAssistant's middle)
// (c.shot: the file, '<espn>.png' or '<espn>.jpg'; a save from before: the bare id, a .jpg)
export const coachShot = c => (c?.shot ? `${HEADSHOT_BASE}/nba-coaches/${/\./.test(String(c.shot)) ? c.shot : `${c.shot}.jpg`}` : null)
const realMan = (F, c, team) => ({ i: F.cid++, n: c.name, ag: c.age ?? 50, r: toArr(c.attrs), st: c.since ?? F.year, real: 1, ...(c.shot && { shot: `${c.espn}.${c.shot === 'png' ? 'png' : 'jpg'}` }), ...(team == null && c.cv && { cv: c.cv }), ...(team == null && { hy: 1 }) })

// ── Made-up assistants ───────────────────────────────────────────────────────
// NBA benches: about half white, two in five Black, a few others (the name and the drawn face follow it)
const MIX = [['w', 52], ['b', 40], ['l', 4], ['p', 4]]
const CV = {
  oc: ['ASSISTANT COACH', 'FRONT-OF-BENCH ASSISTANT', 'OFFENSIVE ASSISTANT'],
  dc: ['ASSISTANT COACH', 'FRONT-OF-BENCH ASSISTANT', 'DEFENSIVE ASSISTANT'],
  pd: ['PLAYER DEVELOPMENT ASSISTANT', 'SHOOTING COACH', 'ASSISTANT COACH'],
}
const OUTSIDE = { oc: ['G LEAGUE HEAD COACH', 'EUROLEAGUE HEAD COACH', 'COLLEGE ASSOCIATE HEAD COACH'], dc: ['G LEAGUE HEAD COACH', 'EUROLEAGUE ASSISTANT', 'COLLEGE ASSOCIATE HEAD COACH'], pd: ['G LEAGUE ASSISTANT', 'COLLEGE ASSISTANT', 'SKILLS TRAINER'] }
export function genAssistant(R, job, { taken = new Set(), id = null, team = null, kind = 'staff' } = {}) {
  const tot = MIX.reduce((a, x) => a + x[1], 0)
  let x = R.u() * tot, g = 'w'
  for (const [k, w] of MIX) { x -= w; if (x < 0) { g = k; break } }
  let n
  for (let k = 0; k < 30; k++) { n = coachName(R.u, g); if (!taken.has(n)) break }
  taken.add(n)
  const v = (m, s, lo = 1, hi = 10) => clamp(lo, hi, Math.round(m + R.n() * s))
  const r = CTYPES.map((t, j) => (j === OWN[job] ? v(AMID, 1.4) : v(4.6, 1.2)))
  const ag = job === 'pd' ? R.int(29, 46) : R.int(34, 58)
  const c = { i: id, n, ag, r, g, sd: job }
  if (kind === 'pool') c.cv = R.u() < 0.6 ? `${TEAM[team ?? R.pick(SHORTS)].nick.toUpperCase()} ${R.pick(CV[job])}` : R.pick(OUTSIDE[job])
  return c
}

// ── The league's staffs ──────────────────────────────────────────────────────
// the assistants every new franchise starts with (the same men in the setup and in the save)
let BASE = null
function baseStaffs() {
  if (BASE) return BASE
  const taken = new Set(NBA_COACHES.map(c => c.name).concat(NBA_COACH_FREE_AGENTS.map(c => c.name)))
  BASE = {}
  for (const s of SHORTS) {
    const R = rngOf(`nba-staff-${s}`)
    BASE[s] = Object.fromEntries(JOBS.map(k => { const c = genAssistant(R, k, { taken }); c.st = FIRST_ST(R); return [k, c] }))
  }
  BASE.taken = taken
  return BASE
}
const FIRST_ST = R => 2026 - R.int(0, 5)
export const baseStaffOf = s => baseStaffs()[s]
// F.staff, made once (createNbaFranchise, or the first read of an older save). mine: the setup's hires { oc, dc, pd }
export function ensureStaff(F, { mine = null } = {}) {
  if (F.staff) return F.staff
  F.cid = F.cid ?? 1
  F.staff = {}
  F.cpool = []
  const B = baseStaffs()
  for (const s of SHORTS) {
    const T = { hc: null, rec: [] }
    for (const k of JOBS) T[k] = { ...B[s][k], i: F.cid++, r: [...B[s][k].r] }
    const hc = realHC(s)
    if (s === F.team && F.coach) {
      T.hc = { mine: 1 }
      if (hc) { const x = realMan(F, hc, null); x.cv = `${TEAM[s].nick.toUpperCase()} HC ${hc.since}-${String(F.year).slice(-2)}`; x.out = 0; F.cpool.push(x) }
      // the men the GM hired in the setup (the assistant there before him to the pool)
      for (const k of JOBS) if (mine?.[k]) {
        const old = T[k]; old.cv = `${TEAM[s].nick.toUpperCase()} ${JOB_LONG[k]}`; old.out = 0; F.cpool.push(old)
        T[k] = { ...mine[k], i: F.cid++, r: [...mine[k].r], st: F.year }
        delete T[k].cv; delete T[k].key; delete T[k].home
      }
    } else T.hc = hc ? realMan(F, hc, s) : null
    F.staff[s] = T
  }
  for (const c of NBA_COACH_FREE_AGENTS) { const x = realMan(F, c, null); x.out = 1; F.cpool.push(x) }
  return F.staff
}
export const staffOf = (F, s) => ensureStaff(F)[s]
// the GM's built coach in the staff's shape
export function myHC(F) {
  const c = F.coach
  return c ? { mine: 1, n: c.name, r: toArr(c.r), face: c.face, style: c.style, ...(c.face?.ag != null && { ag: c.face.ag + Math.max(0, F.year - (c.face.y ?? F.year)) }) } : null
}
// the four men on a team's staff now (the GM's head coach as myHC)
export function staffMen(F, s) {
  const T = staffOf(F, s)
  if (!T) return { hc: null, oc: null, dc: null, pd: null }
  return { hc: T.hc?.mine ? myHC(F) : T.hc, oc: T.oc, dc: T.dc, pd: T.pd }
}
const line = (c, t) => (Array.isArray(c?.r) ? c.r[CTYPES.indexOf(t)] : null)

// ── The effects ──────────────────────────────────────────────────────────────
export const K = { hc: 0.0011, as: 0.0005, rot: 0.002, late: 0.004, lateAs: 0.0012, devHc: 0.15, devPd: 0.1, devStyle: 0.8 }
const r4 = v => Math.round(v * 10000) / 10000
// what a team's staff does in a game (game.js side(): shot chances, its pace and shot mix)
//   { off, def, rot, late, pace (seconds a trip), three (share of shots from three) }
export function coachSide(F, s) {
  if (!F?.teams?.[s]) return null
  const M = staffMen(F, s)
  const v = (c, t, mid) => (line(c, t) ?? mid) - mid
  const off = v(M.hc, 'off', MID.off) * K.hc + v(M.oc, 'off', AMID) * K.as
  const def = v(M.hc, 'def', MID.def) * K.hc + v(M.dc, 'def', AMID) * K.as
  const rot = v(M.hc, 'rot', MID.rot) * K.rot
  const asLate = (((line(M.oc, 'late') ?? 4.6) + (line(M.dc, 'late') ?? 4.6)) / 2 - 4.6) * K.lateAs
  const late = v(M.hc, 'late', MID.late) * K.late + asLate
  const st = s === F.team && M.hc?.mine ? F.coach?.style : null
  const out = { off: r4(off - (st === 'defense' ? 0.001 : 0)), def: r4(def + (st === 'defense' ? 0.002 : 0)), rot: r4(rot), late: r4(late) }
  if (st === 'pace') { out.pace = -0.5; out.three = 0.035 }
  if (st === 'defense') out.pace = 0.5
  return out
}
// OVR a summer added to a young man's growth (25 and under) on this team
export function coachDev(F, s, p) {
  if (!p || (p.ag ?? 30) > 25 || !F.teams?.[s]) return 0
  const M = staffMen(F, s)
  const st = s === F.team && M.hc?.mine && F.coach?.style === 'developer' ? K.devStyle : 0
  return Math.round((((line(M.hc, 'dev') ?? MID.dev) - MID.dev) * K.devHc + ((line(M.pd, 'dev') ?? AMID) - AMID) * K.devPd + st) * 100) / 100
}
// free agency: a players' coach's team (market.js offerScore adds it to the offer's pull)
export const coachPull = (F, s) => (s === F.team && F.coach?.style === 'players' ? 0.04 : 0)

// ── The spin (football's rules, on the NBA's head coaches) ───────────────────
export const RESPINS = 1
export const newCoachBuild = (seed, team) => ({ seed, team, n: 0, rs: 0, cur: null, lines: {} })
export const wheelOf = team => STAFF_TEAMS.filter(s => s !== team).map(realHC)
const order = cb => seededShuffle(STAFF_TEAMS.filter(s => s !== cb.team), `${cb.seed}:hc`)
export function dealSpin(cb) { const t = order(cb)[cb.n % (STAFF_TEAMS.length - 1)]; return { t, c: realHC(t).name } }
export function dealRespin(cb) {
  const used = new Set(Object.values(cb.lines).map(l => l.t))
  const pool = STAFF_TEAMS.filter(s => s !== cb.team && s !== cb.cur?.t && !used.has(s))
  const t = seededShuffle(pool, `${cb.seed}:rs:${cb.n}`)[0]
  return { t, c: realHC(t).name }
}
export const coachByName = (t, name) => (realHC(t)?.name === name ? realHC(t) : null)
export function takeLine(cb, type) {
  const c = cb.cur && coachByName(cb.cur.t, cb.cur.c)
  if (!c || cb.lines[type]) return cb
  return { ...cb, cur: null, lines: { ...cb.lines, [type]: { v: c.attrs[type], from: c.name, t: cb.cur.t } } }
}
export const linesDone = cb => CTYPES.every(t => cb?.lines?.[t])
export function finishCoach(cb, { name, face, style }) {
  const r = Object.fromEntries(CTYPES.map(t => [t, cb.lines[t]?.v ?? 5]))
  const from = Object.fromEntries(CTYPES.map(t => [t, cb.lines[t] ? [cb.lines[t].from, cb.lines[t].t] : null]))
  return { name, face, style, r, from }
}

// ── Hiring the staff: the setup's HIRE step and the offseason ────────────────
// Each opening: the man in the job now (a known quantity), and candidates from around the game (assistants on other
// benches, G League and overseas head coaches). A candidate's grades show once he's interviewed: IV_N a job.
export const IV_N = 3
// the setup's candidates for job k (no league yet: the team's man in the job, then five from the setup's seed)
export function setupCandidates(seed, team, k) {
  const B = baseStaffs()
  const R = rngOf(`${seed}-hire-${team}-${k}`)
  const taken = new Set(B.taken)
  const now = { ...B[team][k], key: `${k}-now`, home: 1, cv: `${TEAM[team].nick.toUpperCase()} ${JOB_LONG[k]} SINCE ${B[team][k].st}` }
  const list = Array.from({ length: 5 }, (_, j) => ({ ...genAssistant(R, k, { taken, kind: 'pool' }), key: `${k}-${j}` }))
  // (a few of them are the real thing: an outside man with a big reputation now and then)
  for (const c of list) if (R.u() < 0.25) c.r[OWN[k]] = clamp(0, 11, c.r[OWN[k]] + 2)
  return [now, ...list]
}
// the offseason's: the pool's men who fit, the league's best first by reputation, plus the GM's own staff's next man
export function staffCandidates(F, k, n = 6) {
  ensureStaff(F)
  const J = jobLog(F, k)
  const fits = F.cpool.filter(c => !c.real && !c.home && (c.sd === k || (!c.sd && k !== 'pd')) && !J.gone.includes(c.i))
  const R = rngOf(`${F.seed}-${F.year}-buzz-${k}`)
  const list = fits.map(c => ({ c, v: score(c.r, k) + (R.u() - 0.5) * 3 })).sort((a, b) => b.v - a.v).slice(0, n).map(x => x.c)
  return [...list, homeCandidate(F, k)]
}
function jobLog(F, k) {
  if (!F.stf || F.stf.y !== F.year) F.stf = { y: F.year, iv: {}, gone: {} }
  return { iv: (F.stf.iv[k] ??= []), gone: (F.stf.gone[k] ??= []) }
}
// promote from within: the best of three men already on the GM's bench (video coordinator, assistants behind the bench)
export function homeCandidate(F, k) {
  const J = F.stf?.y === F.year ? F.stf.home?.[k] : null
  if (J) { const c = F.cpool.find(x => x.i === J); if (c) return c }
  const R = rngOf(`${F.seed}-${F.year}-home-${k}`)
  const taken = takenNames(F)
  const room = [0, 1, 2].map(() => genAssistant(R, k, { taken }))
  const c = room.sort((a, b) => score(b.r, k) - score(a.r, k))[0]
  c.i = F.cid++; c.home = F.team; c.cv = `${TEAM[F.team].nick.toUpperCase()} ASSISTANT BEHIND THE BENCH`
  F.cpool.push(c)
  jobLog(F, k)
  ;(F.stf.home ??= {})[k] = c.i
  return c
}
function takenNames(F) {
  const out = new Set()
  for (const s of SHORTS) { const M = staffMen(F, s); for (const c of Object.values(M)) if (c?.n) out.add(c.n) }
  for (const c of F.cpool ?? []) out.add(c.n)
  return out
}
export const staffWindow = F => F.phase === 'off'
export const interviewsLeft = (F, k) => IV_N - (F.stf?.y === F.year ? F.stf.iv[k]?.length ?? 0 : 0)
export const gradesKnown = (F, c, k) => !!c && !!(c.home || (F.stf?.y === F.year && F.stf.iv[k]?.includes(c.i)))
export function interviewStaff(F, k, id) {
  if (!staffWindow(F)) return false
  const J = jobLog(F, k)
  if (J.iv.includes(id)) return true
  if (J.iv.length >= IV_N) return false
  J.iv.push(id)
  return true
}
// hire him into job k (the man there now goes to the pool); offseason only
export function hireStaff(F, k, id) {
  if (!staffWindow(F) || !JOBS.includes(k)) return null
  const T = staffOf(F, F.team)
  const c = F.cpool.find(x => x.i === id)
  if (!c || !(c.home || gradesKnown(F, c, k))) return null
  const old = T[k]
  if (old) { old.cv = `${TEAM[F.team].nick.toUpperCase()} ${JOB_LONG[k]} ${old.st ?? F.year}-${String(F.year).slice(-2)}`; old.out = 0; old.sd = k; delete old.home; F.cpool.push(old) }
  F.cpool = F.cpool.filter(x => x !== c)
  delete c.cv; delete c.out; delete c.home
  c.st = F.year + 1; c.sd = k
  T[k] = c
  if (F.stf?.home?.[k] === c.i) delete F.stf.home[k]
  addNews(F, { k: 'coach', tag: 'STAFF', s: F.team, text: `The ${TEAM[F.team].nick} have hired ${c.n} as ${k === 'oc' ? 'lead assistant' : k === 'dc' ? 'defensive coordinator' : 'player development coach'}${old ? `; ${old.n} will not return` : ''}` })
  return c
}
// let a man go: the job is open until he hires one (camp promotes from within if he doesn't)
export function fireStaff(F, k) {
  if (!staffWindow(F)) return false
  const T = staffOf(F, F.team), c = T[k]
  if (!c) return false
  T[k] = null
  c.cv = `${TEAM[F.team].nick.toUpperCase()} ${JOB_LONG[k]} ${c.st ?? F.year}-${String(F.year).slice(-2)}`; c.out = 0; c.sd = k
  F.cpool.push(c)
  return true
}
// the season about to start: an open job of the GM's is filled from within
export function fillStaff(F) {
  ensureStaff(F)
  const T = staffOf(F, F.team)
  for (const k of JOBS) if (!T[k]) { const c = homeCandidate(F, k); F.cpool = F.cpool.filter(x => x !== c); delete c.cv; delete c.home; c.st = F.year + 1; c.sd = k; T[k] = c }
  delete F.stf
}

// ── The owner's patience: the GM's head coach ────────────────────────────────
// No owner fires the GM's coach (he answers to the GM): after a bad stretch the hot seat shows. The last two seasons
// out of the postseason with 60 wins or fewer together, or three straight out of it.
export function hotSeat(F) {
  const h = (F.hist ?? []).slice(-3)
  if (h.length < 2) return null
  const out = x => x.finish === 'lottery' || x.finish === 'playin'
  const two = h.slice(-2), w2 = two.reduce((a, x) => a + x.w, 0), l2 = two.reduce((a, x) => a + x.l, 0)
  if (two.every(out) && w2 <= 60) return { n: 2, w: w2, l: l2 }
  if (h.length === 3 && h.every(out)) return { n: 3, w: h.reduce((a, x) => a + x.w, 0), l: h.reduce((a, x) => a + x.l, 0) }
  return null
}

// ── The carousel (closeSeason: the spring, after the Finals) ────────────────
// 1. The season on every head coach's record. 2. A year older; the old retire. 3. Firings on the grounds the NBA's
// owners fire on: a bad season, one well under what the roster should have won, a stretch of them, with patience for
// a coach in his first two years and for a winner. 4. Hires: the coaches out of work, the league's best assistants
// (an assistant hired away leaves his job to a new man), now and then a first-timer from the G League or overseas.
// The GM's assistants can be hired away as head coaches too (football's rule): the staff screen shows the job open.
// 5. Assistants move around the league (a few a year). recs: season.js records(F).
const NK = s => TEAM[s]?.nick ?? s
// what each roster should have won: wins fitted on the teams' OVR, this league, this season
export function expWins(F, recs) {
  const xs = Object.fromEntries(SHORTS.map(s => [s, teamOvr(F, s)]))
  const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1)
  const mx = mean(SHORTS.map(s => xs[s])), mw = mean(SHORTS.map(s => recs[s]?.w ?? 41))
  const cov = mean(SHORTS.map(s => (xs[s] - mx) * ((recs[s]?.w ?? 41) - mw))), vr = mean(SHORTS.map(s => (xs[s] - mx) ** 2)) || 1
  return s => mw + (cov / vr) * (xs[s] - mx)
}
// a résumé line as words: "G LEAGUE HEAD COACH" -> "G League head coach", "CELTICS ASSISTANT COACH" -> "Celtics assistant coach"
const NICKS = new Set(Object.values(TEAM).map(t => t.nick.toUpperCase()))
function cvWords(cv) {
  if (!cv) return null
  let t = cv.toLowerCase().replace(/\bg league\b/g, 'G League').replace(/\beuroleague\b/g, 'EuroLeague').replace(/\bhc\b/g, 'head coach')
  for (const n of NICKS) t = t.replace(new RegExp(`\\b${n.toLowerCase()}\\b`, 'g'), n.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' '))
  return t
}
export function coachCarousel(F, recs, po = new Set()) {
  ensureStaff(F)
  if (F.cyr === F.year) return []
  F.cyr = F.year
  const R = rngOf(`${F.seed}-${F.year}-nbacoaches`)
  const ev = []
  const expW = expWins(F, recs)
  // 1. the record
  for (const s of SHORTS) {
    const T = staffOf(F, s), r = recs[s] ?? { w: 0, l: 0 }
    T.rec = [...(T.rec ?? []), [r.w, r.l, po.has(s) ? 1 : 0]].slice(-6)
    if (T.hc && !T.hc.mine) { T.hc.hy = (T.hc.hy ?? 0) + 1; T.hc.hw = (T.hc.hw ?? 0) + r.w; T.hc.hl = (T.hc.hl ?? 0) + r.l }
  }
  // 2. a year older; a young coach learns a little, an old one slips; the old retire
  for (const s of SHORTS) {
    const T = staffOf(F, s)
    for (const k of ['hc', ...JOBS]) {
      const c = T[k]
      if (!c || c.mine) continue
      c.ag++
      if (c.ag <= 45 && R.u() < 0.3) { const j = R.int(0, 4); c.r[j] = Math.min(11, c.r[j] + 1) }
      if (c.ag >= 66 && R.u() < 0.25) { const j = R.int(0, 4); c.r[j] = Math.max(0, c.r[j] - 1) }
      const p = k === 'hc' ? (c.ag >= 66 ? 0.08 + (c.ag - 66) * 0.05 : 0) : (c.ag >= 62 ? 0.08 + (c.ag - 62) * 0.05 : 0)
      if (p > 0 && R.u() < p) { T[k] = null; if (k === 'hc') ev.push({ k: 'ret', s, n: c.n, ag: c.ag }) }
    }
  }
  for (const c of F.cpool) { c.ag++; c.out = (c.out ?? 0) + 1 }
  // 3. firings
  const open = []
  for (const s of SHORTS) {
    if (s === F.team) continue
    const T = staffOf(F, s), c = T.hc
    if (!c) { open.push(s); continue }
    const r = recs[s] ?? { w: 41 }, w = r.w, t = F.year - (c.st ?? F.year) + 1
    let p = w <= 20 ? 0.6 : w <= 27 ? 0.42 : w <= 34 ? 0.24 : w <= 41 ? 0.1 : w <= 48 ? 0.03 : 0.01
    const under = expW(s) - w
    if (under >= 10) p += 0.25; else if (under >= 6) p += 0.12; else if (under <= -6) p *= 0.4
    if (po.has(s)) p *= 0.35
    // (a stretch: the last three seasons under .400 together)
    const last = T.rec.slice(-3), lw = last.reduce((a, x) => a + x[0], 0), lg = last.reduce((a, x) => a + x[0] + x[1], 0)
    if (last.length === 3 && lw / Math.max(1, lg) < 0.4) p += 0.15
    p *= t <= 1 ? 0.15 : t === 2 ? 0.55 : 1
    if (R.u() < clamp(0, 0.9, p)) {
      T.hc = null; open.push(s)
      c.cv = `${NK(s).toUpperCase()} HC ${c.st}-${String(F.year).slice(-2)}`; c.out = 0; c.fired = F.year; c.fb = s
      F.cpool.push(c)
      ev.push({ k: 'fire', s, n: c.n, rec: `${r.w}-${r.l}`, yrs: t })
    }
  }
  // 4. hires: the market's head coaches, the league's best assistants, a first-timer from outside now and then
  const taken = takenNames(F)
  for (const s of R.shuffle(open)) {
    const cands = []
    for (const c of F.cpool) if (c.hy && c.fb !== s && !c.home) cands.push({ c, v: score(c.r, 'hc') + (c.ag >= 66 ? -1.2 : 0) - (c.out ?? 0) * 0.3 - (c.fired === F.year ? 2.6 : 0) + (R.u() - 0.5) * 2.2 })
    for (const o of SHORTS) { if (o === s) continue; const T = staffOf(F, o); for (const k of ['oc', 'dc']) { const c = T[k]; if (c && c.ag <= 58) cands.push({ c, from: [o, k], v: score(c.r, 'hc') + 0.35 + (R.u() - 0.5) * 2.2 }) } }
    const out = genAssistant(R, R.u() < 0.5 ? 'oc' : 'dc', { taken, kind: 'pool' })
    out.r = out.r.map(v => clamp(1, 10, v + R.int(0, 1)))
    cands.push({ c: out, v: score(out.r, 'hc') + (R.u() - 0.5) * 2.2 })
    cands.sort((a, b) => b.v - a.v)
    const pick = cands[0]
    const c = pick.c
    if (pick.from) {
      const [o, k] = pick.from
      staffOf(F, o)[k] = null
      ev.push({ k: 'leave', s: o, n: c.n, to: s, role: k, mine: o === F.team ? 1 : 0 })
    } else F.cpool = F.cpool.filter(x => x !== c)
    const was = c.cv
    delete c.cv; delete c.out; delete c.fired; delete c.fb
    c.st = F.year + 1; c.hy = c.hy ?? 0
    if (c.i == null) c.i = F.cid++
    staffOf(F, s).hc = c
    ev.push({ k: 'hire', s, n: c.n, from: pick.from ? `${NK(pick.from[0])} ${pick.from[1] === 'oc' ? 'lead assistant' : 'defensive coordinator'}` : null, ...(was && { was: cvWords(was) }), ...(c.hy && { hy: 1 }) })
  }
  // 5. the assistants: a few move on each summer; every open job is filled (not the GM's: his to fill)
  for (const s of SHORTS) {
    const T = staffOf(F, s)
    for (const k of JOBS) {
      if (s === F.team) continue
      if (T[k] && R.u() < 0.12) { const c = T[k]; T[k] = null; c.cv = `${NK(s).toUpperCase()} ${JOB_LONG[k]}`; c.out = 0; c.sd = k; F.cpool.push(c) }
      if (!T[k]) {
        const best = F.cpool.filter(c => !c.real && c.sd === k && !c.home && c.fb !== s).map(c => ({ c, v: score(c.r, k) + (R.u() - 0.5) * 2 })).sort((a, b) => b.v - a.v)[0]?.c
        const c = best && R.u() < 0.5 ? best : genAssistant(R, k, { taken })
        F.cpool = F.cpool.filter(x => x !== c)
        if (c.i == null) c.i = F.cid++
        delete c.cv; delete c.out; c.st = F.year + 1; c.sd = k
        T[k] = c
      }
    }
  }
  // the year's up-and-comers on the market, the old names thinning out (it stays about 40 men)
  for (const k of JOBS) for (let j = 0; j < 3; j++) { const c = genAssistant(R, k, { taken, kind: 'pool' }); c.i = F.cid++; c.out = 0; F.cpool.push(c) }
  F.cpool = F.cpool.filter(c => !(c.ag >= 70 || (c.out ?? 0) >= 4 || (!c.real && (c.out ?? 0) >= 2 && R.u() < 0.5)))
  if (F.cpool.length > 45) F.cpool = F.cpool.sort((a, b) => (b.real ? 1 : 0) - (a.real ? 1 : 0) || (a.out ?? 0) - (b.out ?? 0)).slice(0, 45)
  // the wire
  for (const e of ev) {
    const t = e.k === 'fire' ? `The ${NK(e.s)} have fired head coach ${e.n} after a ${e.rec} season${e.yrs > 1 ? `, his ${ordinal(e.yrs)} with the team` : ''}`
      : e.k === 'ret' ? `${NK(e.s)} head coach ${e.n} is retiring at ${e.ag}`
        : e.k === 'hire' ? (e.from ? `The ${NK(e.s)} have hired ${e.from} ${e.n} as head coach` : e.hy ? `The ${NK(e.s)} have hired ${e.n} as head coach${e.was ? ` (${e.was})` : ''}` : `The ${NK(e.s)} have hired ${e.n}${e.was ? `, ${/^(a|e(?!uro)|i|o)/i.test(e.was) ? 'an' : 'a'} ${e.was},` : ''} as head coach`)
          : `${e.n} leaves the ${NK(e.s)} bench to become head coach of the ${NK(e.to)}`
    addNews(F, { k: 'coach', tag: e.k === 'fire' ? 'FIRED' : e.k === 'ret' ? 'RETIRES' : e.k === 'hire' ? 'NEW COACH' : 'STAFF', s: e.k === 'leave' ? e.to : e.s, text: t })
  }
  F.cev = { y: F.year, ev }
  return ev
}
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
// Coach of the Year: the head coach whose team beat what its roster should have won by the most (a winning team)
export function coachOfYear(F, recs) {
  const exp = expWins(F, recs)
  let best = null
  for (const s of SHORTS) {
    const r = recs[s]; if (!r || r.w <= r.l) continue
    const M = staffMen(F, s); if (!M.hc) continue
    const v = r.w - exp(s) + r.w * 0.15
    if (!best || v > best.v) best = { s, n: M.hc.n, v, rec: `${r.w}-${r.l}` }
  }
  return best
}
export const CLG_NBA = 'nba'
