// FRANCHISE: the league. Thirty-two real teams, every real player the game has on his real team (real ages),
// generated depth behind them, one salary and years left per man, starters picked automatically, and the team's
// strength (offense / defense on the football sim's 1–12 scale) read from the men who start.
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
import { marketValue, realDeal, signDeal, signRookie, buildSlot } from './contracts'

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
const W_OFF = { qb1: 0.34, rb1: 0.10, wr1: 0.12, wr2: 0.10, wr3: 0.07, te1: 0.08, ol1: 0.038, ol2: 0.038, ol3: 0.038, ol4: 0.038, ol5: 0.038 }
const W_DEF = { edge1: 0.12, edge2: 0.11, dt1: 0.11, dt2: 0.10, lb1: 0.08, lb2: 0.08, lb3: 0.08, cb1: 0.09, cb2: 0.08, s1: 0.08, s2: 0.07 }

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
    out.push(...at.slice(0, Math.max(MAX[pos], at.filter(p => p.b != null).length)))
    cut.push(...at.slice(Math.max(MAX[pos], at.filter(p => p.b != null).length)))
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
// raw: the weighted OVR of the men who start on each side
export function rawStrength(team, L = lineup(team)) {
  let off = 0, def = 0
  for (const [k, w] of Object.entries(W_OFF)) off += (L[k]?.o ?? 55) * w
  for (const [k, w] of Object.entries(W_DEF)) def += (L[k]?.o ?? 55) * w
  return { off, def }
}
// The calibration, set once when the league is made: the starting rosters read as the teams' real ratings
// (the football sim's 1–12), so year one plays like the real league; every team's gap between its real rating
// and what its men add up to (coaching, scheme) fades a little each year and the rosters take over.
const mean = a => a.reduce((x, y) => x + y, 0) / a.length
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))) || 1 }
export function calibrate(F) {
  const raws = SHORTS.map(s => rawStrength(F.teams[s]))
  const ro = TEAMS.map(t => t.off), rd = TEAMS.map(t => t.def)
  F.cal = { mo: r1(mean(raws.map(x => x.off))), so: r1(sd(raws.map(x => x.off)) * 10) / 10, md: r1(mean(raws.map(x => x.def))), sd: r1(sd(raws.map(x => x.def)) * 10) / 10, ro: r1(mean(ro)), rd: r1(mean(rd)), rso: r1(sd(ro)), rsd: r1(sd(rd)) }
  SHORTS.forEach((s, i) => {
    const m = scaled(F, raws[i])
    // (the real staff's play-calling is its own term, coach.js: the rest is what fades)
    const ce = realEdge(s)
    F.teams[s].res = [r1(TEAMS[i].off - m.off - ce.off), r1(TEAMS[i].def - m.def - ce.def)]
  })
}
const scaled = (F, raw) => ({ off: F.cal.ro + ((raw.off - F.cal.mo) / F.cal.so) * F.cal.rso, def: F.cal.rd + ((raw.def - F.cal.md) / F.cal.sd) * F.cal.rsd })
// A team's offense and defense on the sim's 1–12 scale, and its OVR (the starters' average, the number on screen).
// The head coach's play-calling is in it (coach.js coachEdge): the player's own coach on his team, the real staff
// everywhere else.
export function strength(F, short) {
  const t = F.teams[short], L = lineup(t), raw = rawStrength(t, L), m = scaled(F, raw)
  const ce = coachEdge(F, short)
  let off = m.off + (t.res?.[0] ?? 0) + ce.off, def = m.def + (t.res?.[1] ?? 0) + ce.def
  const starters = Object.values(L)
  return { off: r1(clamp(1, 12, off)), def: r1(clamp(1, 12, def)), ovr: Math.round(mean(starters.map(p => p.o))), rawOff: raw.off, rawDef: raw.def }
}
// the sim's 1–12 as a letter on the game's scale (Squad Builder's teamGrade)
const TG = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S']
export const sideGrade = v => TG[clamp(0, 11, Math.round(((v ?? 2) - 2) * 11 / 10))]

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
}
