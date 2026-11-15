// FRANCHISE: the league. Thirty-two real teams, every real player the game has on his real team (real ages),
// generated depth behind them, one salary and years left per man, starters picked automatically, and the team's
// ratings (OVR, OFFENSE, DEFENSE: ratings.js, and the same two on the football sim's 1–12) read from the men who play.
//
// A player (kept small: a league is ~1,000 of them):
//   i id · n name · p position · s spot (edge/dt, cb/s, LT…) · o OVR · ag age · pk the OVR he's headed for
//   $ salary ($M a year) · y years left · h ESPN headshot id · b the player's own build (index in F.builds)
//   in weeks out injured · rk rookie year · c college · dr [round, pick]
// (a real man's headshot is looked up by his name: photoOf)
import { NFL_TEAMS } from '../../data/nfl-teams'
import NFL_HEADSHOTS from '../../data/headshots.json'
import { BIRTH_NFL } from '../../data/player-ages'
import { QBS } from '../../data/qbs'
import { RBS } from '../../data/rbs'
import { WRS } from '../../data/wrs'
import { TES } from '../../data/tes'
import { DBS } from '../../data/dbs'
import { DLS } from '../../data/dls'
import { LBS } from '../../data/lbs'
import { OLS } from '../../data/ols'
import { FIRST_NAMES, LAST_NAMES } from '../playerNames'
import { ovrOf, nameOf, TYPES_OF } from '../squadSeason'
import { dlBuildSpot } from '../../utils/simulation'
import { olSpotOfBuild } from '../squadSeason'
import { rngOf, clamp, r1 } from './rng'
import { coachEdge, realEdge } from './coach'
import { startersOfTeam, benchOfTeam } from './roster'
import { rawRating, teamRating, toSim, fromSim, lastSeasonRes, SEASON_2025 } from './ratings'
import { marketValue, realDeal, signDeal, signRookie, buildSlot, seedDead } from './contracts'

export const FIRST_YEAR = 2026
export const POS = ['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db']
export const POS_LABEL = { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', ol: 'OL', dl: 'DL', lb: 'LB', db: 'DB' }
export const OFFENSE = ['qb', 'rb', 'wr', 'te', 'ol']
// a roster: at least MIN at each spot, never more than MAX (29 to 37 men: the ones who play)
export const MIN = { qb: 2, rb: 2, wr: 4, te: 2, ol: 6, dl: 5, lb: 3, db: 5 }
export const MAX = { qb: 3, rb: 3, wr: 5, te: 3, ol: 7, dl: 6, lb: 4, db: 6 }
// the starting 22, by slot
export const SLOTS = [
  ['qb1', 'qb'], ['rb1', 'rb'], ['wr1', 'wr'], ['wr2', 'wr'], ['wr3', 'wr'], ['te1', 'te'],
  ['ol1', 'ol'], ['ol2', 'ol'], ['ol3', 'ol'], ['ol4', 'ol'], ['ol5', 'ol'],
  ['edge1', 'dl', 'edge'], ['edge2', 'dl', 'edge'], ['dt1', 'dl', 'dt'], ['dt2', 'dl', 'dt'],
  ['lb1', 'lb'], ['lb2', 'lb'], ['lb3', 'lb'],
  ['cb1', 'db', 'cb'], ['cb2', 'db', 'cb'], ['s1', 'db', 's'], ['s2', 'db', 's'],
]
export const SLOT_LABEL = k => k.replace(/\d$/, '').toUpperCase() + (/\d$/.test(k) ? k.slice(-1) : '')

export const TEAMS = NFL_TEAMS.map(t => ({ short: t.short, name: t.name, nick: t.name.split(' ').slice(-1)[0], color: t.color, color2: t.color2, logo: t.logo, conf: t.conf, div: t.div, off: t.off, def: t.def }))
export const TEAM = Object.fromEntries(TEAMS.map(t => [t.short, t]))
export const SHORTS = TEAMS.map(t => t.short)

// ── The real players ─────────────────────────────────────────────────────────
const POOL = { qb: QBS, rb: RBS, wr: WRS, te: TES, ol: OLS, dl: DLS, lb: LBS, db: DBS }
const asBuild = (attrs, pos) => Object.fromEntries(TYPES_OF[pos].map(t => [t, { val: attrs?.[t] ?? 5 }]))
const spotOfReal = (pos, p) => (pos === 'dl' ? (p.subpos === 'dt' ? 'dt' : 'edge') : pos === 'db' ? (p.subpos === 's' ? 's' : 'cb') : pos === 'ol' ? (p.subpos ?? p.pos) : undefined)
let realCache = null
// every real man by position, with his OVR (the same OVR the rest of the game shows)
export function realPool() {
  if (realCache) return realCache
  realCache = {}
  for (const pos of POS) {
    const seen = new Set()
    realCache[pos] = POOL[pos].filter(p => p.attrs && p.team && !seen.has(p.name) && seen.add(p.name)).map(p => ({
      name: p.name, team: p.team, pos, s: spotOfReal(pos, p), o: ovrOf(pos, asBuild(p.attrs, pos)), attrs: p.attrs,
      h: p.headshot ?? NFL_HEADSHOTS[p.name] ?? null, age: BIRTH_NFL[p.name] ? clamp(21, 41, FIRST_YEAR - BIRTH_NFL[p.name]) : null, num: p.number ?? null,
    }))
  }
  return realCache
}
// a man's ESPN headshot id (real players only; a build's face is its own)
export const photoId = p => (p && p.b == null ? realOf(p.p, p.n)?.h ?? null : null)
const REAL_BY = new Map()
export function realOf(pos, name) {
  const k = `${pos}|${name}`
  if (!REAL_BY.has(k)) REAL_BY.set(k, realPool()[pos]?.find(p => p.name === name) ?? null)
  return REAL_BY.get(k)
}

// ── Money ────────────────────────────────────────────────────────────────────
// (the market, the cap and the rookie scale: lib/franchise2/contracts.js)
// what a man is worth a year ($M) on the open market, at his spot and rating
export const worth = p => marketValue(p)
export const yearsFor = p => (p.ag <= 26 ? 4 : p.ag <= 29 ? 3 : p.ag <= 31 ? 2 : 1)
export const payroll = roster => r1(roster.reduce((a, p) => a + (p.$ ?? 0), 0))

// ── Grades ───────────────────────────────────────────────────────────────────
// a player's OVR as a letter (the mode's own scale: the same letters every screen shows)
const GRADE_AT = [[97, 'S'], [93, 'A+'], [89, 'A'], [86, 'A-'], [83, 'B+'], [80, 'B'], [77, 'B-'], [74, 'C+'], [71, 'C'], [68, 'C-'], [64, 'D'], [0, 'F']]
export const GRADES = GRADE_AT.map(x => x[1]).reverse()
export const gradeOf = o => GRADE_AT.find(([v]) => o >= v)[1]
export const gradeIdx = o => GRADES.indexOf(gradeOf(o))
export const gradeFloor = i => GRADE_AT.find(x => x[1] === GRADES[clamp(0, GRADES.length - 1, i)])[0]

// ── Names ────────────────────────────────────────────────────────────────────
const MORE_FIRST = ['Aaron', 'Brandon', 'Chris', 'Derrick', 'Eric', 'Frank', 'Garrett', 'Hakeem', 'Ian', 'Jarvis', 'Kenny', 'Logan', 'Marcell', 'Nate', 'Omar', 'Pat', 'Quincy', 'Ricky', 'Shane', 'Tyrell', 'Victor', 'Will', 'Zach', 'Bryson', 'Carson', 'Damon', 'Ethan', 'Jalon', 'Kobe', 'Tariq']
const MORE_LAST = ['Adams', 'Barnes', 'Collins', 'Dixon', 'Evans', 'Foster', 'Griffin', 'Hughes', 'Ingram', 'James', 'Knox', 'Lewis', 'Moore', 'Nelson', 'Owens', 'Parker', 'Ross', 'Simmons', 'Tucker', 'Walker', 'Young', 'Banks', 'Curry', 'Dunn', 'Ford', 'Hill', 'Mack', 'Price', 'Shaw', 'Webb']
const FIRSTS = [...FIRST_NAMES, ...MORE_FIRST], LASTS = [...LAST_NAMES, ...MORE_LAST]
export const fakeName = R => `${R.pick(FIRSTS)} ${R.pick(LASTS)}`

// ── Making players ───────────────────────────────────────────────────────────
// the OVR a man is headed for, from where he is and how young (a veteran is already there)
export function peakFor(R, o, ag) {
  // (a young man has a few points a year left in him, fewer the closer he already is to the top)
  const left = Math.max(0, 27 - ag)
  return clamp(40, 99, Math.round(o + left * Math.max(0, 1.35 + R.n() * 0.75) * clamp(0.3, 1, (99 - o) / 18)))
}
export function makeReal(F, r, R) {
  const ag = r.age ?? R.int(23, 30)
  const p = { i: F.nid++, n: r.name, p: r.pos, o: r.o, ag }
  if (r.s) p.s = r.s
  p.pk = Math.max(p.o, peakFor(R, p.o, ag))
  // his real deal (src/data/nfl-contracts.json), or the market's estimate
  const d = realDeal(r.name, r.team, p, R)
  p.$ = d.$; p.y = d.y; p.g = d.g
  if (d.rc) p.rc = 1
  return p
}
const GEN_SPOT = { dl: ['edge', 'dt'], db: ['cb', 's'], ol: ['LT', 'LG', 'C', 'RG', 'RT'] }
// a depth player (no photo: his initials)
export function makeGen(F, pos, R, { o = null, ag = null } = {}) {
  const age = ag ?? R.int(23, 30)
  const p = { i: F.nid++, n: fakeName(R), p: pos, o: o ?? clamp(55, 76, Math.round(66 + R.n() * 4)), ag: age }
  if (GEN_SPOT[pos]) p.s = R.pick(GEN_SPOT[pos])
  p.pk = Math.max(p.o, peakFor(R, p.o, age) - 4)
  signDeal(p, { $: marketValue(p, F.year ?? FIRST_YEAR), y: R.int(1, 3) })
  return p
}
// the player's own build as a man on the roster
export const buildSpot = (pos, build) => (pos === 'dl' ? dlBuildSpot(build) : pos === 'db' ? (build?.size?.subpos === 's' ? 's' : 'cb') : pos === 'ol' ? olSpotOfBuild(build) : undefined)
export function makeBuilt(F, idx, R) {
  const B = F.builds[idx]
  const o = ovrOf(B.pos, B.build)
  const p = { i: F.nid++, n: B.name || nameOf(B.pos, B.build) || POS_LABEL[B.pos], p: B.pos, o, ag: B.age ?? 23, b: idx, ...(B.rk && { rk: B.rk }) }
  const s = buildSpot(B.pos, B.build)
  if (s) p.s = s
  p.pk = Math.min(99, o + Math.max(0, 27 - p.ag) + R.int(0, 2))   // (a build grows a step at a time)
  // a build is a rookie: the rookie scale at the slot his OVR would have gone in the draft (contracts.js buildSlot)
  signRookie(p, B.slot ?? buildSlot(o), F.year ?? FIRST_YEAR)
  B.slot = B.slot ?? buildSlot(o)
  B.pid = p.i
  return p
}

// ── Rosters ──────────────────────────────────────────────────────────────────
export const byPos = (roster, pos) => roster.filter(p => p.p === pos)
// trim a roster to the maximum at each spot (the weakest go; the player's own builds are never cut)
export function trim(roster, keep = new Set()) {
  const out = [], cut = []
  for (const pos of POS) {
    const at = byPos(roster, pos).sort((a, b) => (b.b != null) - (a.b != null) || keep.has(b.i) - keep.has(a.i) || b.o - a.o)
    const n = Math.max(MAX[pos], at.filter(p => p.b != null || keep.has(p.i)).length)
    out.push(...at.slice(0, n))
    cut.push(...at.slice(n))
  }
  return { roster: out, cut }
}
// fill a roster to the minimum at each spot with depth players
export function fillUp(F, roster, R) {
  for (const pos of POS) for (let n = byPos(roster, pos).length; n < MIN[pos]; n++) roster.push(makeGen(F, pos, R, { o: clamp(55, 72, Math.round(64 + R.n() * 3.5)) }))
  return roster
}

// ── Starters ─────────────────────────────────────────────────────────────────
// Who starts is the depth chart (lib/franchise2/roster.js): the player's own order on his team, by rating on the
// league's; the next healthy man up when a starter is hurt.
export const lineup = team => startersOfTeam(team)
// the men who play behind the starters (the box score's rotation): RB2, WR4, TE2, two more linemen, the nickel
export const rotation = (team, L = lineup(team)) => benchOfTeam(team, L)

// ── Strength ─────────────────────────────────────────────────────────────────
// The team ratings live in ratings.js (how each side is weighted and scaled, and why). Here: a team's numbers
// with its play-callers in, the sim's 1-12 made from them, and year one's carry-over from the real 2025 season.
export const rawStrength = (team, L = lineup(team)) => rawRating(team, L)
// Set once when the league is made: each team's share of its real 2025 season (team.res, rating points
// [off, def]), against what its men and its REAL play-callers add up to (never the player's own coach: his
// calls are his). It fades every offseason (offseason.js) and the rosters take over.
export function calibrate(F) {
  for (const s of SHORTS) {
    const t = F.teams[s]
    t.res = [0, 0]
    t.res = lastSeasonRes(s, teamRating(t, lineup(t), realEdge(s)))
  }
}
// A team's OVR, OFFENSE and DEFENSE (offR, defR: the numbers on screen, a player's OVR scale; the letter is
// gradeOf), and the same two on the football sim's 1-12 (off, def: what the games play). The play-callers are in
// both (coach.js coachEdge): the player's own coach on his team, the real staff everywhere else.
export function strength(F, short) {
  const t = F.teams[short], L = lineup(t)
  const R = teamRating(t, L, coachEdge(F, short))
  return { off: Math.round(toSim(R.off) * 100) / 100, def: Math.round(toSim(R.def) * 100) / 100, ovr: R.ovr, offR: R.off, defR: R.def }
}
// a side's letter: from the sim's 1-12 (strength's off / def) back to its rating, on the mode's one scale
export const sideGrade = v => gradeOf(Math.round(fromSim(v ?? 6)))

// ── A new league ─────────────────────────────────────────────────────────────
export function buildTeams(F) {
  const R = rngOf(`${F.seed}-league`)
  const pool = realPool()
  F.teams = {}
  for (const s of SHORTS) {
    const r = []
    for (const pos of POS) {
      const men = pool[pos].filter(p => p.team === s).sort((a, b) => b.o - a.o).slice(0, MAX[pos])
      for (const m of men) r.push(makeReal(F, m, R))
    }
    fillUp(F, r, R)
    F.teams[s] = { r }
  }
  seedDead(F)
  // every club's front office (its general manager and scouts: hidden, never on screen)
  const RF = rngOf(`${F.seed}-fo`)
  for (const s of SHORTS) F.teams[s].fo = newFrontOffice(RF, s)
}

// ── Front offices ────────────────────────────────────────────────────────────
// The NFL keeps its haves and have-nots because clubs aren't run equally well: some draft well, keep their core
// and find a quarterback, some miss for a decade. fo (0-1, 0.5 an average shop) is how well a league club is run.
// It moves how well it scouts the draft, how hard it reaches for a need, how it values a quarterback, and who it
// keeps when deals are up (draft.js cpuValue, market.js openResign). Never the player's team: his calls are his.
// Year one leans on how the club was really run going into 2026 (its 2025 season); a front office changes slowly,
// and a club that keeps losing cleans house (aging.js).
export function newFrontOffice(R, short = null) {
  const r = short && SEASON_2025[short], wp = r ? (r[0] + r[2] / 2) / 17 : 0.5
  return Math.round(clamp(0.05, 0.95, 0.5 + R.n() * 0.25 + (wp - 0.5) * 0.4) * 100) / 100
}
export const foOf = (F, s) => (s === F.team ? 0.5 : F.teams[s]?.fo ?? 0.5)
