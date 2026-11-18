// FRANCHISE: the league. Thirty-two real teams, every real player the game has on his real team (real ages),
// generated depth behind them, one salary and years left per man, starters picked automatically, and the team's
// ratings (OVR, OFFENSE, DEFENSE: ratings.js, and the same two on the football sim's 1–12) read from the men who play.
//
// A player (kept small: a league is ~1,000 of them):
//   i id · n name · p position · s spot (edge/dt, cb/s, LT…) · o OVR · ag age · pk the OVR he's headed for
//   $ salary ($M a year) · y years left · h ESPN headshot id · b the player's own build (index in F.builds)
//   in weeks out injured · rk rookie year · c college · dr [round, pick] · fl a filler backup (fillUp)
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
import { KS } from '../../data/ks'
import { nameFor } from './names'
import { tidyName } from './copy'
import { ovrOf, nameOf, TYPES_OF } from '../squadSeason'
import { dlBuildSpot } from '../../utils/simulation'
import { olSpotOfBuild } from '../squadSeason'
import { rngOf, clamp, r1 } from './rng'
import { coachEdge, realEdge } from './coach'
import { startersOfTeam, benchOfTeam, groupOf, backupsOf } from './roster'
import { rawRating, teamRating, toSim, fromSim, lastSeasonRes, SEASON_2025 } from './ratings'
import { marketValue, realDeal, signDeal, signRookie, buildSlot, seedDead, minimumFor, capYear } from './contracts'

export const FIRST_YEAR = 2026
// (the order every list in the mode reads: the offense, the defense, then special teams)
export const POS = ['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db', 'k']
export const POS_LABEL = { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', ol: 'OL', dl: 'DL', lb: 'LB', db: 'DB', k: 'K' }
export const OFFENSE = ['qb', 'rb', 'wr', 'te', 'ol']
export const DEFENSE = ['dl', 'lb', 'db']
// a roster: at least MIN at each spot, never more than MAX (30 to 38 men: the ones who play). One kicker: an NFL
// team carries one on the 53 and signs another only when he's hurt (season.js endWeek)
export const MIN = { qb: 2, rb: 2, wr: 4, te: 2, ol: 6, dl: 5, lb: 3, db: 5, k: 1 }
export const MAX = { qb: 3, rb: 3, wr: 5, te: 3, ol: 7, dl: 6, lb: 4, db: 6, k: 1 }
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
const POOL = { qb: QBS, rb: RBS, wr: WRS, te: TES, ol: OLS, dl: DLS, lb: LBS, db: DBS, k: KS }
const asBuild = (attrs, pos) => Object.fromEntries(TYPES_OF[pos].map(t => [t, { val: attrs?.[t] ?? 5 }]))
const spotOfReal = (pos, p) => (pos === 'dl' ? (p.subpos === 'dt' ? 'dt' : 'edge') : pos === 'db' ? (p.subpos === 's' ? 's' : 'cb') : pos === 'ol' ? (p.subpos ?? p.pos) : undefined)
let realCache = null
// every real man by position, with his OVR (the same OVR the rest of the game shows)
export function realPool() {
  if (realCache) return realCache
  realCache = {}
  for (const pos of POS) {
    const seen = new Set()
    // (a name as the screens write it: "Jr." with its period, whichever way the data has it)
    realCache[pos] = POOL[pos].filter(p => p.attrs && p.team && !seen.has(p.name) && seen.add(p.name)).map(p => ({
      name: tidyName(p.name), team: p.team, pos, s: spotOfReal(pos, p), o: ovrOf(pos, asBuild(p.attrs, pos)), attrs: p.attrs,
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
  if (!REAL_BY.has(k)) { const n = tidyName(name); REAL_BY.set(k, realPool()[pos]?.find(p => p.name === n) ?? null) }
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
// (names.js: a made-up man's name fits his position's room, his face, and is never a real player's)
// pos: his position or spot (the face's room); opts: names.js nameFor's (taken, surn)
export const fakeName = (R, pos = 'any', opts = {}) => nameFor(R, pos, opts)
// a made-up name nobody on the roster already has
// (also: more men to stay clear of, the draft class: a man signed now never shares a name with one drafted later)
export const freshName = (R, roster = [], pos = 'any', also = []) => fakeName(R, pos, { taken: new Set([...roster, ...also].map(p => p.n)) })

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
  if (d.sc) p.sc = d.sc      // (the years after this one: a real deal's cap hits rise)
  if (d.op) { p.op = 1; p.ox = null }
  if (d.dy >= FIRST_YEAR) p.rk = d.dy   // (a real rookie of this season: his draft year, as a pick's rk)
  return p
}
const GEN_SPOT = { dl: ['edge', 'dt'], db: ['cb', 's'], ol: ['LT', 'LG', 'C', 'RG', 'RT'] }
// a depth player (no photo: his initials)
export function makeGen(F, pos, R, { o = null, ag = null } = {}) {
  const age = ag ?? R.int(23, 30)
  // (a kicker off the street is a working NFL leg, a few points under the league's average one)
  const s = GEN_SPOT[pos] ? R.pick(GEN_SPOT[pos]) : null
  const p = { i: F.nid++, n: fakeName(R, s ?? pos, { taken: new Set((F.dc ?? []).map(x => x.n)) }), p: pos, o: o ?? (pos === 'k' ? clamp(68, 84, Math.round(76 + R.n() * 4)) : clamp(55, 76, Math.round(66 + R.n() * 4))), ag: age }
  if (s) p.s = s
  p.gn = 1   // (made up: never a re-sign call for the player, owner 11-18)
  p.pk = Math.max(p.o, peakFor(R, p.o, age) - 4)
  signDeal(p, { $: marketValue(p, F.year ?? FIRST_YEAR), y: R.int(1, 3) })
  return p
}
// a build's ceiling: a little past a drafted man's room at his age (draft.js ROOM: a 22-year-old about nine and a half), so he keeps
// growing into his late twenties the way a good young starter does (2026-11-17: five or six, and a build stopped at
// his ceiling at 24)
export const buildPeak = (o, ag, extra = 1) => Math.min(99, o + Math.round(Math.max(0, 28 - ag) * 1.8) + extra)
// the player's own build as a man on the roster
export const buildSpot = (pos, build) => (pos === 'dl' ? dlBuildSpot(build) : pos === 'db' ? (build?.size?.subpos === 's' ? 's' : 'cb') : pos === 'ol' ? olSpotOfBuild(build) : undefined)
// The men the player's builds replace (owner 11-18): a build takes the job of the best starter at his spot still on
// the team, a second build at the spot the next best, in the setup's order (a spot with no starter left: its best
// backup). The spot: an edge or a tackle inside the line, a corner or a safety, a tackle or an inside man on the line
// (before he's built, the position). Returns the replaced man (or null) for each build, in order.
export function replacedBy(team, builds) {
  const L = Object.values(lineup(team)).filter(p => p.b == null)
  const pool = team.r.filter(p => p.b == null && !p.fl)
  const taken = new Set()
  const unitOfSpot = s => (['LT', 'RT'].includes(s) ? 'ot' : 'oi')
  return builds.map(B => {
    if (!B?.pos) return null
    const s = B.build ? buildSpot(B.pos, B.build) : undefined
    const same = p => p.p === B.pos && (!s || (B.pos === 'ol' ? unitOf(p) === unitOfSpot(s) : p.s === s))
    const best = list => list.filter(p => same(p) && !taken.has(p.i)).sort((a, b) => b.o - a.o)[0]
    const m = best(L) ?? best(pool) ?? null
    if (m) taken.add(m.i)
    return m
  })
}
export function makeBuilt(F, idx, R) {
  const B = F.builds[idx]
  const o = ovrOf(B.pos, B.build)
  const p = { i: F.nid++, n: B.name || nameOf(B.pos, B.build) || POS_LABEL[B.pos], p: B.pos, o, ag: B.age ?? 23, b: idx, ...(B.rk && { rk: B.rk }) }
  const s = buildSpot(B.pos, B.build)
  if (s) p.s = s
  p.pk = buildPeak(o, p.ag, R.int(0, 2))   // (a build grows a step at a time)
  // a build is a rookie: the rookie scale at the slot his OVR would have gone in the draft (contracts.js buildSlot)
  signRookie(p, B.slot ?? buildSlot(o, B.pos), F.year ?? FIRST_YEAR)
  B.slot = B.slot ?? buildSlot(o, B.pos)
  B.pid = p.i
  return p
}

// ── Rosters ──────────────────────────────────────────────────────────────────
export const byPos = (roster, pos) => roster.filter(p => p.p === pos)
// ── Depth ────────────────────────────────────────────────────────────────────
// Every room on the depth chart is two deep: its starters and a man behind them, the way an NFL depth chart reads.
// The line is one room of seven: the five, a swing tackle and an inside man who backs up at guard and centre.
//   DEPTH [unit, roster position, starters]: a unit is a chart room (the line split into its tackles and its inside)
// Where the real rosters leave a starting job empty, a generated starter takes it (63-68, a normal row). Where a
// room has its starters and nobody behind them, ONE filler backup is signed (fl: 1): 63-68, 23-29, a one-year
// minimum deal. A filler never outranks a real man (roster.js byOvr), sits out the weekly rotation (he plays when
// injuries force it), is the first man cut, and leaves when his year is up (market.js openResign). The Team screen
// draws his row smaller.
// The kicker's room is one man and no filler behind him (roster.js backupsOf: no NFL team carries a second kicker).
export const DEPTH = [['qb', 'qb', 1], ['rb', 'rb', 1], ['wr', 'wr', 3], ['te', 'te', 1], ['ot', 'ol', 2], ['oi', 'ol', 3], ['edge', 'dl', 2], ['dt', 'dl', 2], ['lb', 'lb', 3], ['cb', 'db', 2], ['s', 'db', 2], ['k', 'k', 1]]
const TACKLES = ['LT', 'RT'], INSIDE = ['C', 'LG', 'RG']
export const unitOf = p => (p.p === 'ol' ? (TACKLES.includes(p.s) ? 'ot' : 'oi') : groupOf(p))
const UNITS_OF = Object.fromEntries(POS.map(pos => [pos, DEPTH.filter(u => u[1] === pos)]))
// the spot a new man in a unit takes: the one the unit has fewest of (a centre first inside)
function unitSpot(k, men) {
  const spots = k === 'ot' ? TACKLES : k === 'oi' ? INSIDE : null
  if (!spots) return GEN_SPOT_OF[k] ?? null
  return [...spots].sort((a, b) => men.filter(p => p.s === a).length - men.filter(p => p.s === b).length)[0]
}
const GEN_SPOT_OF = { edge: 'edge', dt: 'dt', cb: 'cb', s: 's' }
// a generated starter (a room the real rosters leave short) or a filler backup (fl; top: the lowest man ahead of him,
// so the chart never shows a backup rated over the starter he's behind)
export function makeDepth(F, pos, spot, R, fl = false, top = 68, roster = []) {
  // (a kicker signed to start: a working NFL leg, 70-77)
  const o = pos === 'k' ? R.int(70, 77) : R.int(63, clamp(63, 68, top)), ag = R.int(23, 29)
  const p = { i: F.nid++, n: freshName(R, roster, spot ?? pos, F.dc ?? []), p: pos, o, ag }
  if (spot) p.s = spot
  p.pk = fl ? o : Math.max(o, peakFor(R, o, ag) - 4)
  signDeal(p, { $: minimumFor(ag, capYear(F)), y: 1, g: 0 })
  if (fl) p.fl = 1
  else p.gn = 1   // (made up: never a re-sign call for the player, owner 11-18)
  return p
}
// The men a position keeps (at: sorted, the ones that must stay first): each unit its starters and a man behind
// them (the best of the unit; its filler only when nobody else), a place held for a unit that has nobody to keep,
// then the best of the rest up to n. Fillers are never kept for anything but their unit's backup job.
function keepAt(at, pos, n, must = 0) {
  const sel = at.slice(0, must), units = UNITS_OF[pos]
  const inUnit = k => sel.filter(p => unitOf(p) === k)
  let held = 0
  for (const [k, , st] of units) {
    const want = st + backupsOf(k)
    for (const p of at) {
      const have = inUnit(k)
      if (have.length >= want) break
      if (unitOf(p) !== k || sel.includes(p)) continue
      if (p.fl && (have.length < st || have.some(x => x.fl))) continue
      sel.push(p)
    }
    held += Math.max(0, want - inUnit(k).length)
  }
  for (const p of at) { if (sel.length + held >= n) break; if (!p.fl && !sel.includes(p)) sel.push(p) }
  return sel
}
// trim a roster to the maximum at each spot (the weakest go, fillers first; every room keeps its two-deep; the
// player's own builds are never cut; the kickers in camp: the better leg keeps the job, a draft pick or not)
// cpu: a league team's cut-down, which reads a man the way a front office does: his rating, less a little a year past
// 29 (a declining veteran costs more and has less left: he has to be clearly better to keep his place over a young
// man), plus a young man's upside as the scouts see it. The player's own team is cut by rating alone.
const keepValue = p => p.o - Math.max(0, p.ag - (p.p === 'qb' || p.p === 'k' ? 32 : 29)) * 1.2 + (p.ag <= 25 ? clamp(0, 3, ((p.pk ?? p.o) - (p.hb ?? 0) - p.o) * 0.4) : 0)
export function trim(roster, keep = new Set(), { cpu = false } = {}) {
  const out = [], cut = []
  const v = cpu ? keepValue : p => p.o
  for (const pos of POS) {
    const kept = p => pos !== 'k' && keep.has(p.i)
    const at = byPos(roster, pos).sort((a, b) => (b.b != null) - (a.b != null) || kept(b) - kept(a) || (a.fl ?? 0) - (b.fl ?? 0) || v(b) - v(a))
    const must = at.filter(p => p.b != null || kept(p)).length
    const sel = keepAt(at, pos, Math.max(MAX[pos], must), must)
    out.push(...sel)
    cut.push(...at.filter(p => !sel.includes(p)))
  }
  return { roster: out, cut }
}
// every room two deep: a generated starter where a starting job is empty, one filler where a room has nobody
// behind its starters, and a filler no room needs any more let go (the roster array, changed in place; cut false:
// in the season, when a filler under contract stays on even if a real backup arrives)
export function fillUp(F, roster, R, { cut = true } = {}) {
  for (const [k, pos, st] of DEPTH) {
    const bk = backupsOf(k)
    const unit = () => roster.filter(p => p.p === pos && unitOf(p) === k)
    const fl = unit().filter(p => p.fl), real = unit().length - fl.length
    if (cut) for (const p of fl.slice(real >= st + bk || !bk ? 0 : 1)) roster.splice(roster.indexOf(p), 1)
    for (let have = real; have < st; have++) roster.push(makeDepth(F, pos, unitSpot(k, unit()), R, false, 68, roster))
    // (the line is one room on the chart: its filler is rated under the whole line)
    if (bk && unit().length < st + 1) roster.push(makeDepth(F, pos, unitSpot(k, unit()), R, true, Math.min(...roster.filter(p => p.p === pos && !p.fl && (pos === 'ol' || unitOf(p) === k)).map(p => p.o)), roster))
  }
  return roster
}
// a league's rooms two deep (a save from before the fillers, read back; a week's cuts and trades)
export function fillLeague(F, R = rngOf(`${F.seed}-${F.year}-${F.wk ?? 0}-depth`)) {
  for (const s of SHORTS) fillUp(F, F.teams[s].r, R, { cut: false })
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
      // (the best at the position, each room's two-deep kept first: keepAt)
      const at = pool[pos].filter(p => p.team === s).sort((a, b) => b.o - a.o).map(m => ({ p: pos, s: m.s, o: m.o, m }))
      for (const x of keepAt(at, pos, MAX[pos])) r.push(makeReal(F, x.m, R))
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
