// SQUAD BUILDER: the season (lib/squad.js is the save).
//
// One season for the whole squad, played as one team:
//   1. Strength: the team's real off/def, moved by each build against the
//      starter it pushes out of the lineup (better than him: the team gets better).
//   2. The schedule, every result and score and the playoffs are played once from that
//      strength, on a seeded RNG (scriptNFLSeason / scriptBucketSeason; basketball's scores
//      are set from both teams' ratings here).
//   3. The team plays that season (lib/teamSeason.js): the builds at their spots, the team's
//      real players everywhere else, a box score every game that adds up to the score. The
//      builds' awards and everyone's honors come from those numbers.
// So the squad shares one record and one stat sheet, and the same squad and season number
// always play back the same way. The result keeps season totals and a snapshot of the roster;
// any game's box score is played again from them (seasonBox).

import { seeded } from './rng'
import { CAPS, POSITIONS, SPOTS, spotsOf, spotsFor } from './squad'
import { EV, KEYS, playFootballSeason, playBucketSeason, honorsOf, fbCase, bkCase, minutesPlan, olGrades, olLineQ } from './teamSeason'
import {
  calcOVR, calcOVRRB, calcOVRWR, calcOVRTE, calcOVRDB, calcOVRDL, calcOVRLB, calcOVROL, scriptNFLSeason,
  calcMVPResult, calcOPOYResult, calcWROPOYResult, calcTEOPOYResult, calcDBDpoyResult, calcDLDpoyResult, calcLBDpoyResult, calcOLAllProResult,
  getArchetype, getArchetypeRB, getArchetypeWR, getArchetypeTE, getArchetypeDB, getArchetypeDL, getArchetypeLB, getArchetypeOL, dlBuildSpot, olBuildSpot, nflHeadshot, HEADSHOT_BASE, valToGrade,
} from '../utils/simulation'
import { scriptBucketSeason, calcBucketOVR, TEAM_RATINGS, ALLTIME_TEAM_RATINGS, getBucketGuardArchetype, getBucketBigArchetype } from '../utils/bucketSimulation'
import { QBS, TYPES } from '../data/qbs'
import { RBS, RB_TYPES } from '../data/rbs'
import { WRS, WR_TYPES } from '../data/wrs'
import { TES, TE_TYPES } from '../data/tes'
import { DBS, DB_TYPES } from '../data/dbs'
import { DLS, DL_TYPES } from '../data/dls'
import { LBS, LB_TYPES } from '../data/lbs'
import { OLS, OL_TYPES } from '../data/ols'
import { NFL_TEAMS, ALLTIME_RATINGS } from '../data/nfl-teams'
import { NBA_GUARD_PLAYERS, GUARD_TYPES } from '../data/nba-guards'
import { NBA_BIG_PLAYERS, BIG_TYPES } from '../data/nba-bigs'
import { NBA_TEAMS } from '../data/nba-teams'
import NFL_HEADSHOTS from '../data/headshots.json'
import NBA_HEADSHOTS from '../data/nba-headshots.json'
// soccer (the third sport): the club season and the World Cup are the soccer engine's. Its rosters and
// engine load only for a soccer squad (lib/squadSoccer.js): football and basketball never download them.
// SoccerApp calls loadSquadSoccer() before Squad Builder shows; until then soccer's lists are empty.
import { SOCCER_TYPES as ST_TYPES } from '../data/soccer-attrs'
let SX = { SOCCER_CLUBS: [], WC_NATIONS: [], SOCCER_STRIKERS: [], WC_STRIKERS: [], SOCCER_HEADSHOTS: {} }
let sxLoad = null
export const loadSquadSoccer = () => (sxLoad ??= import('./squadSoccer.js').then(m => { SX = m; return m }))
// baseball (the fourth sport): the whole club's season is lib/squadBaseball.js (its rosters and engine with it),
// loaded the same way: BaseballApp calls loadSquadBaseball() before Squad Builder shows. Until then BB is null.
let BB = null
let bbLoad = null
export const loadSquadBaseball = () => (bbLoad ??= import('./squadBaseball.js').then(m => { BB = m; return m }))
// ALL-TIME (football and basketball, squad.pool 'alltime'): each franchise's legends are the roster, and the
// season is the sport's All-Time mode (the all-time team ratings and fields). The legend lists load with an
// all-time squad only (loadSquadLegends: AppSquad waits for it before it shows one); until then AT is empty.
const AT = { qb: [], rb: [], wr: [], te: [], db: [], dl: [], lb: [], ol: [], guard: [], big: [] }
const atLoad = {}
const atKey = sport => (sport === 'bucket' ? 'bucket' : 'nfl')
export const legendsReady = sport => !!atLoad[atKey(sport)]?.done
export function loadSquadLegends(sport) {
  const key = atKey(sport)
  if (!atLoad[key]) {
    const p = key === 'bucket'
      ? Promise.all([import('../data/nba-guard-legends'), import('../data/nba-big-legends')]).then(([g, b]) => { AT.guard = g.NBA_ALLTIME_GUARD_PLAYERS; AT.big = b.NBA_ALLTIME_BIG_PLAYERS })
      : Promise.all([import('../data/qb-legends'), import('../data/rb-legends'), import('../data/wr-legends'), import('../data/te-legends'), import('../data/db-legends'), import('../data/dl-legends'), import('../data/lb-legends'), import('../data/ol-legends')])
        .then(([q, r, w, t, d, l, lb, ol]) => { Object.assign(AT, { qb: q.LEGENDS, rb: r.RB_LEGENDS, wr: w.WR_LEGENDS, te: t.TE_LEGENDS, db: d.DB_LEGENDS, dl: l.DL_LEGENDS, lb: lb.LB_LEGENDS, ol: ol.OL_LEGENDS }) })
    atLoad[key] = { done: false }
    atLoad[key].p = p.then(() => { atLoad[key].done = true }, e => { delete atLoad[key]; throw e })
  }
  return atLoad[key].p
}
// (a squad saved before the pool had none: it's 'current')
const poolOf = sq => (sq?.pool === 'alltime' ? 'alltime' : 'current')

// ── Per position ─────────────────────────────────────────────────────────────
const POOL = { qb: QBS, rb: RBS, wr: WRS, te: TES, db: DBS, dl: DLS, lb: LBS, ol: OLS, guard: NBA_GUARD_PLAYERS, big: NBA_BIG_PLAYERS }
export const TYPES_OF = { qb: TYPES, rb: RB_TYPES, wr: WR_TYPES, te: TE_TYPES, db: DB_TYPES, dl: DL_TYPES, lb: LB_TYPES, ol: OL_TYPES, guard: GUARD_TYPES, big: BIG_TYPES, st: ST_TYPES }
const OVR = {
  qb: b => calcOVR(b, TYPES), rb: b => calcOVRRB(b, RB_TYPES), wr: b => calcOVRWR(b, WR_TYPES), te: b => calcOVRTE(b, TE_TYPES), db: b => calcOVRDB(b, DB_TYPES), dl: b => calcOVRDL(b, DL_TYPES), lb: b => calcOVRLB(b, LB_TYPES), ol: b => calcOVROL(b, OL_TYPES),
  guard: b => calcBucketOVR(b, GUARD_TYPES, 'guard'), big: b => calcBucketOVR(b, BIG_TYPES, 'big'),
  st: b => SX.calcSoccerOVR(b, ST_TYPES),
  bat: b => BB?.ovrOf('bat', b) ?? 0, pit: b => BB?.ovrOf('pit', b) ?? 0,
}
export const ovrOf = (pos, build) => Math.round(OVR[pos]?.(build || {}) ?? 0)
const ARCH = {
  qb: (o, b) => getArchetype(o, b, TYPES), rb: (o, b) => getArchetypeRB(o, b, RB_TYPES), wr: (o, b) => getArchetypeWR(o, b, WR_TYPES),
  te: (o, b) => getArchetypeTE(o, b, TE_TYPES), db: (o, b) => getArchetypeDB(o, b, DB_TYPES), dl: (o, b) => getArchetypeDL(o, b, DL_TYPES), lb: (o, b) => getArchetypeLB(o, b, LB_TYPES), ol: (o, b) => getArchetypeOL(o, b, OL_TYPES),
  guard: (o, b) => getBucketGuardArchetype(o, b, GUARD_TYPES), big: (o, b) => getBucketBigArchetype(o, b, BIG_TYPES),
  st: (o, b) => SX.getSoccerArchetype(o, b, ST_TYPES),
  bat: (o, b) => BB?.nameOf('bat', b) ?? null, pit: (o, b) => BB?.nameOf('pit', b) ?? null,
}
export const nameOf = (pos, build) => { try { return ARCH[pos]?.(ovrOf(pos, build), build) ?? null } catch { return null } }
// a build's face: the photo on its best trait
export function faceOf(build) {
  const chips = Object.values(build || {}).filter(c => c?.photo)
  return chips.sort((a, b) => (b.val ?? 0) - (a.val ?? 0))[0]?.photo ?? null
}
const photoOf = (sport, p) => (sport === 'bucket'
  ? (NBA_HEADSHOTS[p.name] ? `${HEADSHOT_BASE}/nba/${NBA_HEADSHOTS[p.name]}.webp` : null)
  : nflHeadshot(p.headshot ?? NFL_HEADSHOTS[p.name]))
// (soccer: `pool` 'current' the clubs, 'alltime' the World Cup nations; a code is looked up in the
// clubs first when no pool is given. A side outside the data has no crest: null, the initials show)
export const teamsOf = (sport, pool) => (sport === 'bucket' ? NBA_TEAMS : sport === 'baseball' ? (BB?.MLB_TEAMS ?? []) : sport === 'soccer' ? (pool === 'alltime' ? SX.WC_NATIONS : SX.SOCCER_CLUBS) : NFL_TEAMS)
export const teamOf = (sport, short, pool) => (sport === 'soccer' && !pool
  ? SX.SOCCER_CLUBS.find(t => t.short === short) ?? SX.WC_NATIONS.find(t => t.short === short) ?? null
  : teamsOf(sport, pool).find(t => t.short === short) ?? null)
export const logoOf = (sport, short, pool) => (sport === 'bucket' ? `/logos/nba/${short}.png`
  : sport === 'baseball' ? (short ? `/logos/mlb/${short}.png` : null)
  : sport === 'soccer' ? soccerLogo(short, pool)
  : teamOf(sport, short)?.logo ?? `/logos/${short}.png`)
function soccerLogo(short, pool) {
  if (pool !== 'alltime' && SX.SOCCER_CLUBS.some(t => t.short === short)) return `/logos/soccer/${short}.png`
  if (pool !== 'current' && SX.WC_NATIONS.some(t => t.short === short)) return `/logos/nations/${short}.png`
  return null
}
// an NFL team by its full name (the schedule keeps names)
export const nflShort = name => NFL_TEAMS.find(t => t.name === name)?.short ?? null

// A real player's ratings read as a build (the OVR helpers only need each trait's value)
const asBuild = (p, types) => Object.fromEntries(types.map(t => [t, { val: p.attrs?.[t] ?? 5 }]))
// What an empty spot is worth (a team short at a position plays a backup)
const REPLACEMENT = { nfl: 62, bucket: 64 }

// The team's real starters at each position, best first (as many as the squad's caps)
const dlSpotIn = name => (POOL.dl.find(p => p.name === name)?.subpos === 'dt' ? 'dt' : 'edge')
// (an all-time man carries his own ratings and the mark that he's a legend: lg)
const realOf = (pos, p, sport, marked, pool) => ({ name: p.name, short: p.short || p.name.split(' ').slice(-1)[0], number: p.number ?? null, pos, ovr: Math.round(OVR[pos](asBuild(p, TYPES_OF[pos]))), photo: photoOf(sport, p), starter: !!marked?.has(p.name), ...(pos === 'dl' && { spot: p.subpos === 'dt' ? 'dt' : 'edge' }), ...(pos === 'db' && { spot: p.subpos === 's' ? 's' : 'cb' }), ...(pos === 'ol' && { spot: p.subpos ?? p.pos }), ...(pool === 'alltime' && { lg: true, attrs: p.attrs }) })
// the players a position draws from: the current rosters, or (ALL-TIME) the franchises' legends
const listOf = (pos, pool) => (pool === 'alltime' ? AT[pos] : POOL[pos])
// ALL-TIME: a spot the franchise's legends can't fill is a reserve at the club's level, every trait a B-
// (the way baseball's squads play an open spot: the platoon, a spot starter). No photo: the initial shows.
const RESERVE_VAL = 5
function reserveOf(pos, i) {
  const attrs = Object.fromEntries([...new Set([...(TYPES_OF[pos] ?? []), ...(KEYS[pos] ?? [])])].map(t => [t, RESERVE_VAL]))
  return { name: 'Reserve', key: `r:Reserve:${pos}${i}`, short: 'Reserve', number: null, pos, ovr: Math.round(OVR[pos](asBuild({ attrs }, TYPES_OF[pos]))), photo: null, starter: false, lg: true, gen: true, attrs, ...(pos === 'dl' && { spot: 'dt' }), ...(pos === 'db' && { spot: 'cb' }), ...(pos === 'ol' && { spot: null }) }
}
const reservesIn = list => list.filter(p => p.gen).length
export function startersOf(sport, short, pool) {
  const at = pool === 'alltime'
  const out = {}, taken = new Set()
  // basketball: the team's real starters (starter: true, in either list: LeBron is marked in
  // both) start first, the same five as the season's Starting 5. Football picks by OVR (its
  // starter marks aren't kept as a depth chart)
  const marked = new Set(sport === 'bucket' ? POSITIONS[sport].flatMap(pos => listOf(pos, pool).filter(p => p.team === short && p.starter).map(p => p.name)) : [])
  // basketball fills the bigs first: a forward listed in both groups (LeBron, Giannis) starts
  // at the four, the way his team plays him, and the guards fill around him
  // (the offensive line always: its starters set the line an OL build is measured against, OL_LIVE or not)
  for (const pos of sport === 'bucket' ? ['big', 'guard'] : [...POSITIONS[sport], ...(POSITIONS[sport].includes('ol') ? [] : ['ol'])]) {
    const all = listOf(pos, pool)
      .filter(p => p.team === short && p.attrs && !taken.has(p.name))
      .map(p => realOf(pos, p, sport, marked, pool))
      .sort((a, b) => (b.starter - a.starter) || (b.ovr - a.ovr))   // marked starters, then the best of the rest
    // (a line starts two ends and two tackles, the best at each; everyone else the best to the cap)
    if (!at) out[pos] = all.filter((p, i) => (pos === 'dl' ? all.slice(0, i + 1).filter(x => dlSpotIn(x.name) === dlSpotIn(p.name)).length <= 2 : i < CAPS[sport][pos]))
    else {
      // ALL-TIME: the same, and a franchise short of legends inside has an edge rusher kick in (its four
      // linemen all start); a spot still open is a reserve's
      const two = pos === 'dl' ? all.filter((p, i) => all.slice(0, i + 1).filter(x => x.spot === p.spot).length <= 2) : []
      const list = (pos === 'dl' ? [...two, ...all.filter(p => !two.includes(p))] : all).slice(0, CAPS[sport][pos])
      while (list.length < CAPS[sport][pos]) list.push(reserveOf(pos, reservesIn(list) + 1))
      out[pos] = list
    }
    out[pos].sort((a, b) => b.ovr - a.ovr)   // best first: a build pushes out the weakest
    out[pos].forEach(p => taken.add(p.name))   // a player listed at two spots starts at one
  }
  return out
}
// Everyone the team has at a position, best first (the depth behind the starters)
function depthOf(sport, short, pos, pool) {
  return listOf(pos, pool).filter(p => p.team === short && p.attrs).map(p => realOf(pos, p, sport, null, pool)).sort((a, b) => b.ovr - a.ovr)
}
// ALL-TIME depth: every football roster in the game carries at least this many at a position (the
// receivers' WR4 is the one a franchise's legends can leave open), and a basketball bench is five deep
const AT_DEPTH = { qb: 1, rb: 3, wr: 4, te: 3, db: 4, dl: 4 }

// A DL build's spot on the line (its Size chip), and how a spot reads on screen
export const spotOfBuild = dlBuildSpot
export const SPOT_LABEL = { edge: 'EDGE', dt: 'DT', cb: 'CB', s: 'S', LT: 'LT', LG: 'LG', C: 'C', RG: 'RG', RT: 'RT' }
const dbSpotOfBuild = build => (build?.size?.subpos === 's' ? 's' : 'cb')

// A front lines up two on the edge and two inside. The builds take their spots; the real
// starters who fill the rest are the ones the line is short of (best first), then the best
// left. So an EDGE build sits the real EDGE he beats out, not a tackle he doesn't play over.
function dlFront(mine, real) {
  const open = Math.max(0, CAPS.nfl.dl - mine.length), rest = [...real], start = []
  for (const spot of ['edge', 'dt']) {
    let need = 2 - mine.filter(s => dlBuildSpot(s.build) === spot).length
    while (need-- > 0 && start.length < open) {
      const i = rest.findIndex(p => p.spot === spot)
      if (i < 0) break
      start.push(rest.splice(i, 1)[0])
    }
  }
  while (start.length < open && rest.length) start.push(rest.shift())
  return { start: start.sort((a, b) => b.ovr - a.ovr), sit: rest }
}

// The offensive line is five spots, LT to RT. Each OL build takes its Size chip's spot (a second build
// at a taken spot slides to the nearest open one: tackle to tackle, guard to guard, then inward), and
// the team's real starters fill the spots left, each at his own spot first. `line`: spot → { you } | { real }.
export const OL_SPOTS = ['LT', 'LG', 'C', 'RG', 'RT']
const OL_NEAR = { LT: ['LT', 'RT', 'LG', 'RG', 'C'], RT: ['RT', 'LT', 'RG', 'LG', 'C'], LG: ['LG', 'RG', 'C', 'LT', 'RT'], RG: ['RG', 'LG', 'C', 'RT', 'LT'], C: ['C', 'LG', 'RG', 'LT', 'RT'] }
export const olSpotOfBuild = build => (OL_SPOTS.includes(olBuildSpot(build)) ? olBuildSpot(build) : 'LT')
function olFront(mine, real) {
  const line = {}, rest = [...real]
  const sorted = [...mine].sort((a, b) => ovrOf('ol', b.build) - ovrOf('ol', a.build))
  for (const s of sorted.slice(0, OL_SPOTS.length)) { const at = OL_NEAR[olSpotOfBuild(s.build)].find(sp => !line[sp]); line[at] = { you: s } }
  for (const sp of OL_SPOTS) {
    if (line[sp]) continue
    const i = rest.findIndex(p => p.spot === sp)
    if (i >= 0) line[sp] = { real: rest.splice(i, 1)[0] }
  }
  for (const sp of OL_SPOTS) if (!line[sp] && rest.length) { const p = rest.shift(); line[sp] = { real: { ...p, spot: sp } } }
  const start = OL_SPOTS.filter(sp => line[sp]?.real).map(sp => line[sp].real)
  return { line, start, sit: rest }
}

// How deep each football position goes in a game: the starters, then the backs, receivers,
// tight ends, linemen and DBs who still play (the nickel, the line's rotation)
export const ROTATION = { qb: 1, rb: 3, wr: 5, te: 3, dl: 6, lb: 4, db: 6, ol: 5 }
const BENCH = 5   // basketball: a nine- or ten-man rotation

// Who starts where. Your builds take the starting jobs at their positions; the
// team's real starters fill the rest, best first; the ones your builds pushed
// out sit, or play behind them (`rotation`: football's depth that plays, basketball's
// bench). Basketball follows the lineup board (squad.lineup: slot id → spot).
export function lineupOf(squad) {
  const { sport } = squad
  if (sport === 'soccer') return soccerLineup(squad)
  if (sport === 'baseball') return BB.lineupOf(squad)
  const pool = poolOf(squad), allTime = pool === 'alltime'
  const starters = squad.team ? startersOf(sport, squad.team, pool) : Object.fromEntries(POSITIONS[sport].map(p => [p, []]))
  const built = squad.slots.filter(s => s.build)
  const groups = {}, benched = {}, rotation = {}
  for (const pos of POSITIONS[sport]) {
    const mine = built.filter(s => s.pos === pos)
    const open = Math.max(0, CAPS[sport][pos] - mine.length)
    const { start, sit } = pos === 'dl' ? dlFront(mine, starters[pos]) : pos === 'ol' ? olFront(mine, starters[pos]) : { start: starters[pos].slice(0, open), sit: starters[pos].slice(open) }
    groups[pos] = [...mine.map(s => ({ you: s })), ...start.map(p => ({ real: p }))]
    benched[pos] = sit
  }
  if (sport !== 'bucket') {
    if (squad.team) {
      const used = new Set(POSITIONS.nfl.flatMap(pos => groups[pos].filter(x => x.real).map(x => x.real.name)))
      for (const pos of POSITIONS.nfl) {
        rotation[pos] = depthOf(sport, squad.team, pos, pool).filter(p => !used.has(p.name)).slice(0, Math.max(0, ROTATION[pos] - groups[pos].length))
        rotation[pos].forEach(p => used.add(p.name))
        // (ALL-TIME: a franchise with fewer legends than the position's depth plays a reserve there)
        if (allTime) while (groups[pos].length + rotation[pos].length < (AT_DEPTH[pos] ?? 0)) rotation[pos].push(reserveOf(pos, groups[pos].filter(x => x.real?.gen).length + reservesIn(rotation[pos]) + 1))
      }
    } else POSITIONS.nfl.forEach(pos => { rotation[pos] = [] })
    return { groups, benched, starters, rotation }
  }
  // the board: each build at its spot (or the first open one in its group), real players around them
  const spots = SPOTS.map(() => null)
  const at = spotsOf({ ...squad, slots: built })
  for (const s of built) if (at[s.id] != null) spots[at[s.id]] = { you: s }
  for (const pos of POSITIONS.bucket) {
    const real = groups[pos].filter(x => x.real)
    SPOTS.forEach((sp, i) => { if (sp.pos === pos && !spots[i]) spots[i] = real.shift() ?? { empty: true } })
  }
  // the bench: everyone else on the roster, best first (a man listed as a guard and a big once, at his better rating)
  const onFloor = new Set(spots.filter(x => x?.real).map(x => x.real.name))
  const all = new Map()
  if (squad.team) for (const pos of POSITIONS.bucket) for (const p of depthOf(sport, squad.team, pos, pool)) if (!onFloor.has(p.name) && !(all.get(p.name)?.ovr >= p.ovr)) all.set(p.name, p)
  rotation.bench = [...all.values()].sort((a, b) => b.ovr - a.ovr).slice(0, BENCH)
  // (ALL-TIME: a franchise's legends run seven to ten deep; reserves, a guard then a big, fill its bench to five)
  if (allTime && squad.team) for (let i = 0; rotation.bench.length < BENCH; i++) rotation.bench.push(reserveOf(i % 2 ? 'big' : 'guard', `b${i + 1}`))
  return { groups, benched, starters, spots, rotation }
}

// ── Strength ─────────────────────────────────────────────────────────────────
// Each point of OVR a build has over the starter it replaces moves the team
// (football off/def 1–10; basketball off/def out of 100)
const MOVE = {
  qb: { off: 0.22 }, rb: { off: 0.09 }, wr: { off: 0.075 }, te: { off: 0.065 }, db: { def: 0.09 }, dl: { def: 0.10 }, lb: { def: 0.08 }, ol: { off: 0.024 },
  guard: { off: 0.45, def: 0.15 }, big: { off: 0.25, def: 0.35 },
}
export function squadStrength(squad) {
  const { sport } = squad
  if (sport === 'soccer') return soccerStrength(squad)
  if (sport === 'baseball') return BB.strengthOf(squad)
  // (ALL-TIME: the franchise at its peak, All-Time mode's rating; its builds against the legends they replace)
  const pool = poolOf(squad)
  const real = pool === 'alltime'
    ? (sport === 'bucket' ? (ALLTIME_TEAM_RATINGS[squad.team] ?? { off: 84, def: 82 }) : (ALLTIME_RATINGS[squad.team] ?? { off: 8, def: 8 }))
    : sport === 'bucket'
      ? (TEAM_RATINGS[squad.team] ?? { off: 68, def: 65 })
      : (teamOf(sport, squad.team) ?? { off: 6, def: 6 })
  const starters = startersOf(sport, squad.team, pool)
  let off = real.off, def = real.def
  const moves = []
  for (const pos of [...POSITIONS[sport], ...(sport === 'nfl' && !POSITIONS.nfl.includes('ol') ? ['ol'] : [])]) {
    const mine = squad.slots.filter(s => s.pos === pos && s.build)
    if (!mine.length) continue
    // your builds push out the weakest starters at the position
    const cap = CAPS[sport][pos]
    const out = [...starters[pos]]
    while (out.length < cap) out.push({ ovr: REPLACEMENT[sport] })
    const pushed = pos === 'dl' ? dlFront(mine, out).sit : pos === 'ol' ? olFront(mine, out.map(p => ({ spot: null, ...p }))).sit : out.slice(cap - mine.length)
    const delta = mine.reduce((a, s) => a + ovrOf(pos, s.build), 0) - pushed.reduce((a, p) => a + p.ovr, 0)
    off += delta * (MOVE[pos].off ?? 0)
    def += delta * (MOVE[pos].def ?? 0)
    moves.push({ pos, delta })
  }
  const lim = sport === 'bucket' ? [40, 99] : [1, 12]
  const clamp = v => Math.round(Math.min(lim[1], Math.max(lim[0], v)) * 10) / 10
  return { off: clamp(off), def: clamp(def), baseOff: real.off, baseDef: real.def, moves }
}

// ── The roster that plays the season ────────────────────────────────────────
// A snapshot of every man in the rotation, kept with the result so the season (and any game
// of it) plays back the same after the squad or the rosters change:
//   k key (b:<slot> a build, r:<name> a real player) · n name (a build: its archetype) · pos
//   o OVR · a ratings (teamSeason KEYS order) · st starts · d order at the position (football)
//   sub EDGE/DT, CB/S · s the build's slot · spot basketball's 0–4 (a starter)
// (a build's face is on its line: result.lines[].face)
const r2 = v => Math.round(v * 100) / 100
function buildRatings(pos, build) {
  const vals = Object.values(build || {}).map(c => c?.val).filter(v => typeof v === 'number')
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 5
  return KEYS[pos].map(k => r2(typeof build?.[k]?.val === 'number' ? build[k].val : avg))
}
function realRatings(pos, name, team) {
  const p = POOL[pos].find(x => x.name === name && x.team === team) ?? POOL[pos].find(x => x.name === name)
  return KEYS[pos].map(k => p?.attrs?.[k] ?? 5)
}
const subOf = (pos, x) => (pos === 'dl' ? (x.you ? dlBuildSpot(x.you.build) : x.real.spot)
  : pos === 'db' ? (x.you ? dbSpotOfBuild(x.you.build) : x.real.spot) : undefined)
function snap(pos, x, team, extra) {
  const sub = subOf(pos, x)
  if (x.you) {
    const b = x.you.build
    return { k: `b:${x.you.id}`, s: x.you.id, n: nameOf(pos, b) ?? pos.toUpperCase(), pos, o: ovrOf(pos, b), a: buildRatings(pos, b), ...(sub && { sub }), ...extra }
  }
  // (ALL-TIME: a legend's own ratings, marked lg; a reserve is gen too, with its own key: they're all 'Reserve')
  if (x.real.lg) return { k: x.real.key ?? `r:${x.real.name}`, n: x.real.name, pos, o: x.real.ovr, a: KEYS[pos].map(k => x.real.attrs?.[k] ?? 5), lg: 1, ...(x.real.gen && { gen: 1 }), ...(sub && { sub }), ...extra }
  return { k: `r:${x.real.name}`, n: x.real.name, pos, o: x.real.ovr, a: realRatings(pos, x.real.name, team), ...(sub && { sub }), ...extra }
}
export function rosterOf(squad) {
  if (squad.sport === 'soccer') return soccerRoster(squad)
  if (squad.sport === 'baseball') return BB.rosterOf(squad)
  const L = lineupOf(squad)
  const out = []
  if (squad.sport === 'bucket') {
    const bench = [...L.rotation.bench]
    L.spots.forEach((x, i) => {
      if (x?.you) out.push(snap(x.you.pos, x, squad.team, { spot: i, st: 1 }))
      else if (x?.real) out.push(snap(SPOTS[i].pos, x, squad.team, { spot: i, st: 1 }))
      else if (bench.length) { const p = bench.shift(); out.push(snap(p.pos, { real: p }, squad.team, { spot: i, st: 1 })) }   // a spot the roster can't fill: the best man off the bench
    })
    bench.forEach((p, d) => out.push(snap(p.pos, { real: p }, squad.team, { st: 0, d })))
    return out
  }
  const built = squad.slots.filter(s => s.build)
  // the linebackers (LB is hidden: they're on the field only with a linebacker build, from the dev switch)
  const withLB = POSITIONS.nfl.includes('lb') || built.some(s => s.pos === 'lb')
  const groups = { ...L.groups }, rotation = { ...L.rotation }
  if (withLB && !groups.lb) {
    const mine = built.filter(s => s.pos === 'lb'), real = squad.team ? depthOf('nfl', squad.team, 'lb', poolOf(squad)) : []
    const open = Math.max(0, CAPS.nfl.lb - mine.length)
    groups.lb = [...mine.map(s => ({ you: s })), ...real.slice(0, open).map(p => ({ real: p }))]
    rotation.lb = real.slice(open, open + Math.max(0, ROTATION.lb - groups.lb.length))
  }
  for (const pos of ['qb', 'rb', 'wr', 'te', 'dl', ...(withLB ? ['lb'] : []), 'db']) {
    // the builds take the top spots at their position (WR1, RB1…), best first, then the real starters
    const start = (groups[pos] ?? []).map(x => ({ x, o: x.you ? ovrOf(pos, x.you.build) : x.real.ovr })).sort((a, b) => (!!b.x.you - !!a.x.you) || (b.o - a.o))
    start.forEach(({ x }, d) => out.push(snap(pos, x, squad.team, { st: 1, d })))
    ;(rotation[pos] ?? []).forEach((p, j) => out.push(snap(pos, { real: p }, squad.team, { st: 0, d: start.length + j })))
  }
  // the offensive line, LT to RT, last (so everyone before it keeps his place in the snapshot and the
  // season's seeded streams). OL is hidden: the line is on the field only with an OL build, from the dev switch.
  if (POSITIONS.nfl.includes('ol') || built.some(s => s.pos === 'ol')) {
    const { line } = olFront(built.filter(s => s.pos === 'ol'), squad.team ? startersOf('nfl', squad.team, poolOf(squad)).ol ?? [] : [])
    OL_SPOTS.forEach((sp, d) => { if (line[sp]) out.push(snap('ol', line[sp], squad.team, { st: 1, d, sub: sp })) })
  }
  return out
}

// Every slot by its depth spot, the same everywhere: QB1, RB1–RB3, WR1–WR5, TE1–TE3, EDGE1/DT1 (the line by
// spot), CB1/S1 (the secondary by spot), LB1…; basketball's starters by spot (PG–C), the bench BN1–BN5
const subGroup = p => (p.pos === 'dl' ? (p.sub === 'dt' ? 'DT' : 'EDGE') : p.pos === 'db' ? (p.sub === 's' ? 'S' : 'CB') : p.pos.toUpperCase())
export function roleOf(p, roster) {
  if (!p) return ''
  if (p.pos === 'guard' || p.pos === 'big') return p.spot != null ? SPOTS[p.spot]?.label : `BN${(p.d ?? 0) + 1}`
  if (p.pos === 'st') return p.tag ?? 'ST'
  if (p.pos === 'bat' || p.pos === 'pit') return p.tag ?? p.role ?? ''   // baseball: the spot (SS, SP2, CL)   // soccer: the spot up front (LW, ST, RW · LS, RS, CAM)
  if (p.pos === 'ol') return p.sub ?? 'OL'   // one man a spot: LT, LG, C, RG, RT
  const tag = subGroup(p)
  if (!roster) return `${tag}${(p.d ?? 0) + 1}`
  const same = roster.filter(q => q.pos === p.pos && subGroup(q) === tag).sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
  return `${tag}${Math.max(0, same.findIndex(q => q.k === p.k)) + 1}`
}
// A team's offense or defense as a grade on the game's F–S scale (football rates 1–12, basketball out of 100;
// soccer's attack and defence are 0–100 too: the clubs run 79–100, the nations 66–100)
export const teamGrade = (sport, v, pool) => valToGrade(sport === 'bucket' ? ((v ?? 55) - 55) * 11 / 40
  : sport === 'baseball' ? ((v ?? 5.5) - 1) * 11 / 9   // (baseball's off/def run 1–10)
  : sport === 'soccer' ? (pool === 'alltime' ? ((v ?? 66) - 64) * 11 / 36 : ((v ?? 79) - 77) * 11 / 23)
  : ((v ?? 2) - 2) * 11 / 10)
// A real player's headshot by name (a build's is its face: `faces`, slot id → face)
const photoCache = new Map()
export function photoFor(sport, p, faces) {
  if (!p) return null
  if (p.s || p.k?.startsWith('b:')) return faces?.[p.s] ?? null
  // ALL-TIME: a legend's ESPN headshot from the legend lists (once they're in); a reserve has none
  if (p.gen) return null
  if (p.lg) {
    if (!legendsReady(sport)) return null
    const k = `at|${sport}|${p.pos}|${p.n}`
    if (!photoCache.has(k)) { const x = AT[p.pos]?.find(q => q.name === p.n); photoCache.set(k, x ? photoOf(sport === 'bucket' ? 'bucket' : 'nfl', x) : null) }
    return photoCache.get(k)
  }
  const key = `${sport}|${p.pos}|${p.n}`
  if (!photoCache.has(key) && sport === 'baseball') photoCache.set(key, BB?.photoOf(p) ?? null)
  if (!photoCache.has(key) && sport === 'soccer') photoCache.set(key, soccerPhoto([...SX.SOCCER_STRIKERS, ...SX.WC_STRIKERS].find(q => q.name === p.n)))
  if (!photoCache.has(key)) {
    const x = POOL[p.pos]?.find(q => q.name === p.n)
    photoCache.set(key, x ? photoOf(sport === 'bucket' ? 'bucket' : 'nfl', x) : null)
  }
  return photoCache.get(key)
}

// ── The season ───────────────────────────────────────────────────────────────
const r1 = v => Math.round((v ?? 0) * 10) / 10

// Math.random, seeded, for the length of fn (the football script and the award helpers roll it)
function withSeed(str, fn) {
  const real = Math.random
  Math.random = seeded(str)
  try { return fn() } finally { Math.random = real }
}
const intSeed = str => Math.floor(seeded(str)() * 4294967295)

export function runSquadSeason(squad, { raw = false } = {}) {
  const n = (squad.seasons?.length ?? 0) + 1
  const seed = `${squad.seed}-season-${n}`
  const out = squad.sport === 'baseball' ? BB.baseballSeason(squad, seed) : squad.sport === 'soccer' ? soccerSeason(squad, seed) : squad.sport === 'bucket' ? bucketSeason(squad, seed) : footballSeason(squad, seed)
  const result = { ...out.result, ev: EV, sd: seed, n, sport: squad.sport, team: squad.team, sandbox: !!squad.sandbox, size: squad.slots.length, at: Date.now(), ...((squad.sport === 'nfl' || squad.sport === 'bucket') && { pool: poolOf(squad) }) }
  return raw ? { result, raw: out.raw } : result
}

// Official NFL passer rating
export function passerRating(c, a, y, td, int) {
  if (!a) return 0
  const k = v => Math.min(2.375, Math.max(0, v))
  return Math.round(((k((c / a - 0.3) * 5) + k((y / a - 3) * 0.25) + k((td / a) * 20) + k(2.375 - (int / a) * 25)) / 6) * 1000) / 10
}
// A football man's season line, by position (the four numbers on his card)
export function fbLine(pos, t = {}) {
  const g = k => t[k] ?? 0
  switch (pos) {
    case 'qb': return [['YDS', g('py')], ['TD', g('ptd')], ['INT', g('int')], ['RTG', r1(passerRating(g('pc'), g('pa'), g('py'), g('ptd'), g('int')))]]
    case 'rb': return [['YDS', g('ry')], ['TD', g('rtd') + g('rctd')], ['YPC', r1(g('ra') ? g('ry') / g('ra') : 0)], ['REC', g('rc')]]
    case 'wr': case 'te': return [['REC', g('rc')], ['YDS', g('ryd')], ['TD', g('rctd')], ['YPR', r1(g('rc') ? g('ryd') / g('rc') : 0)]]
    case 'db': return [['TKL', g('tk')], ['INT', g('dint')], ['PBU', g('pbu')], ['FF', g('ff')]]
    case 'dl': return [['SCK', g('sck')], ['TFL', g('tfl')], ['TKL', g('tk')], ['QBH', g('qbh')]]
    case 'lb': return [['TKL', g('tk')], ['SCK', g('sck')], ['INT', g('dint')], ['PD', g('pbu') + g('dint')]]
    case 'ol': return [['SACKS', g('sa')], ['PRESS', g('prs')], ['PNK', g('pnk')], ['GRADE', olGrades(t).all]]
    default: return []
  }
}
// …and the rest of it, smaller
export function fbMore(pos, t = {}) {
  const g = k => t[k] ?? 0
  switch (pos) {
    case 'qb': return [`${g('pc')}/${g('pa')}`, `${r1(g('pa') ? (100 * g('pc')) / g('pa') : 0)}%`, `${g('ry')} RUSH YDS`, `${g('rtd')} RUSH TD`]
    case 'rb': return [`${g('ra')} CAR`, `${g('rtd')} RUSH TD`, `${g('ryd')} REC YDS`, `${g('rctd')} REC TD`]
    case 'wr': case 'te': return [`${g('tg')} TGT`, `${r1(g('tg') ? (100 * g('rc')) / g('tg') : 0)}% CATCH`]
    case 'db': return [`${g('p6')} PICK-6`, `${g('tfl')} TFL`]
    case 'dl': return [`${g('ff')} FF`, `${g('fr')} FR`, `${g('pbu')} PBU`]
    case 'lb': return [`${g('tfl')} TFL`, `${g('qbh')} QBH`, `${g('ff')} FF`]
    case 'ol': { const gr = olGrades(t); return [`${g('pen')} PEN (${g('hold')} HOLD, ${g('fst')} FS)`, `${g('qbha')} QB HITS`, `PASS ${gr.pass} · RUN ${gr.run}`, `${g('sn').toLocaleString()} SNAPS`] }
    default: return []
  }
}
export function bkLine(pos, t = {}) {
  const gp = Math.max(1, t.gp ?? 0), pg = k => r1((t[k] ?? 0) / gp)
  return [['PPG', pg('pts')], ['RPG', pg('reb')], ['APG', pg('ast')], pos === 'big' ? ['BPG', pg('blk')] : ['FG%', r1(t.fga ? (100 * t.fgm) / t.fga : 0)]]
}
export function bkMore(pos, t = {}) {
  const gp = Math.max(1, t.gp ?? 0), pg = k => r1((t[k] ?? 0) / gp)
  const pct = (m, a) => `${r1(t[a] ? (100 * (t[m] ?? 0)) / t[a] : 0)}%`
  return [`${pg('mn')} MIN`, pos === 'big' ? `${pct('fgm', 'fga')} FG` : `${pg('blk')} BPG`, `${pct('tpm', 'tpa')} 3PT`, `${pg('stl')} SPG`]
}

// One award of a kind per season: two winners → the one with the better season keeps it
function oneEach(lines) {
  const seen = new Set()
  for (const l of [...lines].sort((a, b) => (b.case ?? b.ovr) - (a.case ?? a.ovr))) {
    if (!l.award?.won) continue
    if (l.award.name === 'ALL-PRO') continue   // (a line has five All-Pro spots, one a man)
    if (seen.has(l.award.name)) l.award = { ...l.award, won: false, teammate: true }
    else seen.add(l.award.name)
  }
  return lines.map(({ case: _c, ...l }) => l)
}
const minAttr = build => Math.min(...Object.values(build || {}).map(c => c?.val).filter(v => typeof v === 'number'))
const chipNames = (build, types) => [...new Set(types.map(t => build?.[t]?.qbFull).filter(Boolean))]

const FB_AWARD = { qb: ['MVP', calcMVPResult], rb: ['OPOY', calcOPOYResult], wr: ['OPOY', calcWROPOYResult], te: ['OPOY', calcTEOPOYResult], db: ['DPOY', calcDBDpoyResult], dl: ['DPOY', calcDLDpoyResult], lb: ['DPOY', calcLBDpoyResult], ol: ['ALL-PRO', calcOLAllProResult] }
// what the award helpers read off a season (the old per-position sims' names for the team's numbers)
function awardInput(p, t, build, wins, playoffs) {
  const g = k => t?.[k] ?? 0
  const base = { ovr: p.o, wins, playoffs }
  switch (p.pos) {
    case 'qb': return { ...base, seasonTDs: g('ptd'), seasonRushTDs: g('rtd'), seasonPassYds: g('py'), seasonRushYds: g('ry'), seasonINTs: g('int') }
    case 'rb': return { ...base, seasonRushYds: g('ry'), seasonRushTDs: g('rtd'), seasonRecYds: g('ryd'), seasonRecTDs: g('rctd'), seasonYPC: g('ra') ? g('ry') / g('ra') : 0 }
    case 'wr': case 'te': return { ...base, seasonRecYds: g('ryd'), seasonRecTDs: g('rctd'), seasonRecs: g('rc') }
    case 'db': return { ...base, seasonINTs: g('dint'), seasonPBUs: g('pbu'), seasonTackles: g('tk'), seasonPickSixes: g('p6'), minAttrVal: minAttr(build) }
    case 'dl': return { ...base, seasonSacks: g('sck'), seasonTFL: g('tfl'), seasonQBHits: g('qbh'), seasonFF: g('ff'), seasonTackles: g('tk'), minAttrVal: minAttr(build), spot: p.sub === 'dt' ? 'DT' : 'EDGE', buildNames: chipNames(build, DL_TYPES) }
    case 'lb': return { ...base, seasonTackles: g('tk'), seasonINTs: g('dint'), seasonSacks: g('sck'), seasonPDs: g('pbu') + g('dint'), seasonFF: g('ff'), seasonTFL: g('tfl'), seasonPickSixes: g('p6'), minAttrVal: minAttr(build), buildNames: chipNames(build, LB_TYPES) }
    case 'ol': return { ...base, seasonSacksAllowed: g('sa'), seasonPressures: g('prs'), seasonPancakes: g('pnk'), seasonPenalties: g('pen'), seasonQBHits: g('qbha'), seasonGrade: olGrades(t).all, minAttrVal: minAttr(build), spot: p.sub ?? null }
    default: return base
  }
}

function footballSeason(squad, seed) {
  const base = teamOf('nfl', squad.team)
  const str = squadStrength(squad)
  // (ALL-TIME: All-Time mode's league, every opponent at its peak, its playoff field and its award races)
  const pool = poolOf(squad), at = pool === 'alltime'
  // the season's results (the script plays the squad's real strength)
  const script = withSeed(seed, () => scriptNFLSeason({ ...base, off: str.off, def: str.def }, at))
  const roster = rosterOf(squad)
  const games = script.games.map(({ wk, opponent, home, won, mySc, oppSc }) => ({ wk, opponent, home, won, mySc, oppSc }))
  const rounds = script.rounds.map(({ round, opponent, home, weather, won, mySc, oppSc, overtime }) => ({ round, opponent, home, weather, won, mySc, oppSc, overtime }))
  const strength = { off: str.off, def: str.def, baseOff: str.baseOff, baseDef: str.baseDef }
  // an OL build: the team's real line is what the squad's line is measured against (kept with the result)
  if (roster.some(p => p.pos === 'ol' && p.s)) {
    const real = (startersOf('nfl', squad.team, pool).ol ?? []).map(p => snap('ol', { real: p }, squad.team, { sub: p.spot }))
    const q = olLineQ(real)
    strength.olBase = q ? { pass: q.pass, run: q.run } : { pass: 0.5, run: 0.5 }
  }
  const played = playFootballSeason({ roster, games, rounds, strength, seed })
  const honors = honorsOf('nfl', roster, played.tot, { wins: script.wins })
  const bySlot = Object.fromEntries(squad.slots.map(s => [s.id, s]))
  const lines = withSeed(`${seed}-awards`, () => roster.filter(p => p.s).map(p => {
    const t = played.tot[p.k], build = bySlot[p.s]?.build
    const [name, calc] = FB_AWARD[p.pos]
    const aw = calc(awardInput(p, t, build, script.wins, script.playoffs), at, base?.short)
    const c = fbCase(p, t, script.wins)
    // a lineman's All-Pro is the vote (the award); a Pro Bowl short of it stays his honor
    if (p.pos === 'ol') { if (aw.userWins) honors[p.k] = 'AP'; else if (honors[p.k] === 'AP') honors[p.k] = 'PB' }
    return { id: p.s, pos: p.pos, ovr: p.o, name: p.n, face: faceOf(build), stats: fbLine(p.pos, t), award: { name, won: !!aw.userWins, winner: aw.winner?.name ?? null }, case: c.v / c.ap, ...(p.sub && { tag: SPOT_LABEL[p.sub] }), ...(honors[p.k] && !(p.pos === 'ol' && aw.userWins) && { honor: honors[p.k] }) }
  }))
  return {
    raw: played,
    result: {
      wins: script.wins, losses: script.losses, playoffs: script.playoffs, champion: script.champion, hasBye: script.hasBye,
      games, rounds, strength, lines: oneEach(lines),
      roster, tot: played.tot, tt: played.team, honors,
    },
  }
}

// ── Basketball: the scores, from both teams' ratings ────────────────────────
// The script decides who won each game; the score follows what the two teams are: a great
// offense scores more, a great defense gives up less, and a team's margins follow its strength.
function gauss(r) { let a = r(); if (a < 1e-12) a = 1e-12; return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * r()) }
function bucketScore(r, us, them, won, playoff) {
  const exp = (o, d) => 113 + 0.4 * (o - 72) - 0.4 * (d - 72) - (playoff ? 3 : 0)
  const my = exp(us.off, them.def), op = exp(them.off, us.def)
  let x = 0
  for (let t = 0; t < 14; t++) { x = my - op + gauss(r) * 12; if (won ? x >= 1 : x <= -1) break; x = 0 }
  let m = Math.max(1, Math.round(Math.abs(x) || 1 + r() * 6))
  const ot = m <= 4 && r() < 0.24 ? (r() < 0.15 ? 2 : 1) : 0
  if (ot) m = 1 + Math.floor(r() * 7)
  let T = Math.round(Math.max(170, Math.min(290, my + op + gauss(r) * 13 + ot * 22)))
  if ((T + m) % 2) T++
  const hi = (T + m) / 2, lo = (T - m) / 2
  return { my: won ? hi : lo, op: won ? lo : hi, ot }
}
function bucketGames(script, str, team, seed, allTime = false) {
  const r = seeded(`${seed}-scores`)
  const us = { off: str.off, def: str.def }
  const rate = allTime ? s => ALLTIME_TEAM_RATINGS[s] ?? { off: 84, def: 82 } : s => TEAM_RATINGS[s] ?? { off: 68, def: 65 }
  const reg = script.games.map(g => ({ o: g.opponent, h: g.home ? 1 : 0, ...bucketScore(r, us, rate(g.opponent), g.won, false) }))
  const po = []
  const at = s => script.standings?.[s - 1]?.short ?? null
  script.playoffRounds.forEach((rd, ri) => {
    if (rd.type === 'playin') {
      const s0 = script.seed
      const opps = s0 <= 8 ? [at(s0 === 7 ? 8 : 7), at(9)] : [at(s0 === 9 ? 10 : 9), at(s0 === 9 ? 7 : 8)]
      ;(rd.games ?? []).forEach((w, j) => {
        const o = opps[j] ?? rd.opponent?.short
        const theirSeed = script.standings?.findIndex(t => t.short === o) + 1
        po.push({ o, h: theirSeed > s0 ? 1 : 0, ...bucketScore(r, us, rate(o), w === 'W', true), r: ri, gm: j + 1, pi: 1 })
      })
      return
    }
    const o = rd.opponent?.short
    // the better seed is home in games 1, 2, 5 and 7 (the Finals: the better record)
    const homeCourt = rd.roundIndex === 3 ? script.wins >= (rd.opponent?.wins ?? 60) : (script.seed ?? 8) <= (rd.opponent?.seed ?? 8)
    ;(rd.games ?? []).forEach((w, j) => {
      const first = [0, 1, 4, 6].includes(j)
      po.push({ o, h: (homeCourt ? first : !first) ? 1 : 0, ...bucketScore(r, us, rate(o), w === 'W', true), r: ri, gm: j + 1 })
    })
  })
  return { reg, po }
}
// kept compact: [opponent, home, our score, theirs, overtimes(, round, game, play-in)]
const packGames = gs => gs.map(g => [g.o, g.h, g.my, g.op, g.ot, ...(g.r != null ? [g.r, g.gm, g.pi ?? 0] : [])])
export const unpackGames = gs => (gs ?? []).map(([o, h, my, op, ot, r, gm, pi]) => ({ o, h, my, op, ot, ...(r != null && { r, gm, pi }) }))

function bucketSeason(squad, seed) {
  const team = teamOf('bucket', squad.team)
  const str = squadStrength(squad)
  // (ALL-TIME: All-Time mode's league, every franchise at its peak, and its MVP field: Jordan, LeBron, Magic, Bird, Kareem)
  const at = poolOf(squad) === 'alltime'
  const script = scriptBucketSeason(team, { off: str.off, def: str.def }, intSeed(seed), at)
  const { reg, po } = bucketGames(script, str, team, seed, at)
  const roster = rosterOf(squad)
  const played = playBucketSeason({ roster, sched: reg, playoffs: po, seed })
  const honors = honorsOf('bucket', roster, played.tot, { wins: script.wins, gp: reg.length })
  // MVP and DPOY, the way a solo season votes them: the best stat case against the league's
  // real candidates (a seeded roll), the MVP only from a playoff team
  const ar = seeded(`${seed}-awards`)
  const cands = at ? [[30, 5, 5, 3, 6, 2], [26, 4, 7, 3, 7, 2], [19, 4, 11, 3, 7, 2], [23, 5, 6, 2, 9, 3], [25, 4, 3, 2, 13, 3]]
    : [[31, 4, 5, 3, 4, 2], [26, 4, 8, 3, 11, 3], [29, 4, 8, 3, 8, 2], [23, 5, 3, 2, 10, 3], [27, 4, 5, 3, 11, 2]]
  const top = Math.max(...cands.map(([p, pr, a, ar2, rb, rr]) => (p + ar() * pr) + (a + ar() * ar2) * 1.5 + (rb + ar() * rr) * 0.75))
  const bySlot = Object.fromEntries(squad.slots.map(s => [s.id, s]))
  const lines = roster.filter(p => p.s).map(p => {
    const t = played.tot[p.k], gp = Math.max(1, t?.gp ?? 0), pg = k => (t?.[k] ?? 0) / gp
    const mvpScore = pg('pts') + pg('ast') * 1.5 + pg('reb') * 0.75, dpoyScore = pg('stl') * 10 + pg('blk') * 8 + (script.seed <= 4 ? 4 : script.seed <= 8 ? 2 : 0)
    const mvp = !!script.madePlayoffs && mvpScore > top
    const dpoy = dpoyScore >= 26 + ar() * 10 && !mvp
    return {
      id: p.s, pos: p.pos, spot: p.spot ?? SPOTS.findIndex(sp => sp.pos === p.pos), ovr: p.o, name: p.n, face: faceOf(bySlot[p.s]?.build),
      stats: bkLine(p.pos, t), mvp, dpoy, mvpScore, dpoyScore, ...(honors[p.k] && { honor: honors[p.k] }),
    }
  })
  // one MVP and one DPOY a season: the best case among the squad's winners
  const keep = (flag, score) => [...lines].filter(l => l[flag]).sort((a, b) => b[score] - a[score])[0]?.id ?? null
  const mvp = keep('mvp', 'mvpScore')
  const dpoy = keep('dpoy', 'dpoyScore') === mvp ? [...lines].filter(l => l.dpoy && l.id !== mvp).sort((a, b) => b.dpoyScore - a.dpoyScore)[0]?.id ?? null : keep('dpoy', 'dpoyScore')
  const out = lines.map(({ mvp: m, dpoy: d, mvpScore, dpoyScore, ...l }) => ({
    ...l,
    award: l.id === mvp ? { name: 'MVP', won: true } : l.id === dpoy ? { name: 'DPOY', won: true } : m || d ? { name: m ? 'MVP' : 'DPOY', won: false, teammate: true } : null,
  }))
  const finals = script.playoffRounds.find(r => r.type === 'series' && r.roundIndex === 3)
  return {
    raw: played,
    result: {
      wins: script.wins, losses: script.losses, playoffs: script.madePlayoffs, champion: script.champion,
      seed: script.seed, conference: script.conference, log: script.games.map(g => (g.won ? 'W' : 'L')).join(''),
      rounds: script.playoffRounds.map(r => ({ type: r.type, name: r.name ?? null, label: r.label ?? null, opponent: r.opponent?.short ?? null, wins: r.wins ?? null, losses: r.losses ?? null, won: r.type === 'playin' ? !!r.advanced : !!r.won })),
      finals: finals ? { opponent: finals.opponent?.short ?? null, series: `${finals.wins}-${finals.losses}` } : null,
      strength: { off: str.off, def: str.def, baseOff: str.baseOff, baseDef: str.baseDef },
      lines: out,
      roster, tot: played.tot, tt: played.team, honors, g: packGames(reg), pg: packGames(po),
    },
  }
}

// ── Soccer: the front line, one season for the side ─────────────────────────
// Up to three striker builds play the front spots of the squad's shape (lib/squad.js SOCCER_SHAPES); the
// team's real forwards fill the spots left, each where he plays (a left winger on the left, the No. 9 in
// the middle), and its real midfield and back line are the rest of the XI (the club's own att/def).
//   1. Strength: each build against the real man it pushes out of his spot, both measured the soccer
//      engine's way (soccerStrikerLift: the side's attack with that man as its No. 9), weighted by the
//      spot (the No. 9 counts most, a wide forward or a No. 10 less).
//   2. scriptSoccerSeason plays every match once from that attack: the league table, the domestic cup and
//      Europe (TOP DIVISIONS), or the group and the knockouts (WORLD CUP).
//   3. Each man up front plays his line inside those scores (runSoccerSimulation with the script), one
//      after another: the goals a man scores are taken out of what's left for the next, so the front
//      line's goals are a share of the team's and never more than it scored. (His share of what's left is
//      raised by what the men before him took, so the order doesn't cost anyone.)
//   4. The awards: one Golden Boot and one Player of the Season (World Cup: Golden Boot, Golden Ball) across
//      the squad and the real field the engine plays (which leaves out the side's own players: they're here).
const soccerPlayers = pool => (pool === 'alltime' ? SX.WC_STRIKERS : SX.SOCCER_STRIKERS)
const soccerPool = sq => (sq?.pool === 'alltime' ? 'alltime' : 'current')
const FORWARD_ROLES = new Set(['ST', 'SS', 'LW', 'RW'])
const roleOfReal = p => p?.role ?? 'ST'
function soccerPhoto(p) {
  const f = p?.espn != null ? SX.SOCCER_HEADSHOTS[String(p.espn)] : null
  return f ? `${HEADSHOT_BASE}/${String(f).replace(/\.(webp|png|jpe?g)$/i, '')}.webp` : null
}
// where a real player plays each spot, best fit first (a spot no one fits stays open)
const SPOT_FIT = {
  ST: ['ST', 'SS', 'LW', 'RW', 'AM'], LS: ['ST', 'SS', 'LW', 'RW', 'AM'], RS: ['ST', 'SS', 'RW', 'LW', 'AM'],
  LW: ['LW', 'RW', 'SS', 'ST', 'AM'], RW: ['RW', 'LW', 'SS', 'ST', 'AM'], CAM: ['AM', 'SS', 'CM', 'LW', 'RW', 'ST'],
}
const NINE = new Set(['ST', 'LS'])
// how much a spot moves the side's attack, and how much of the chances it gets (team.usage)
const SPOT_WEIGHT = { ST: 1, LS: 0.85, RS: 0.85, LW: 0.7, RW: 0.7, CAM: 0.6 }
const SPOT_USAGE = { ST: 0.85, LS: 0.72, RS: 0.72, LW: 0.6, RW: 0.6, CAM: 0.45 }
// a spot the side can't fill: a squad player (every trait a C+)
const SQUAD_PLAYER = Object.fromEntries(ST_TYPES.map(t => [t, { val: 4 }]))
const soccerTeamRow = (pool, short) => (pool === 'alltime' ? SX.WC_NATIONS : SX.SOCCER_CLUBS).find(t => t.short === short) ?? null
// the side's own attackers and midfielders (the pool's), best first
const sideCache = new Map()
function soccerSide(pool, short) {
  const key = `${pool}|${short}`
  if (!sideCache.has(key)) {
    const seen = new Set()
    const list = soccerPlayers(pool).filter(p => p.team === short && p.attrs && !seen.has(p.name) && seen.add(p.name))
      .map(p => ({ name: p.name, short: p.short || p.name.split(' ').slice(-1)[0], number: p.number ?? null, pos: 'st', role: roleOfReal(p), ovr: Math.round(SX.calcSoccerOVR(asBuild(p, ST_TYPES), ST_TYPES)), photo: soccerPhoto(p), starter: !!p.starter, age: p.age ?? null, attrs: p.attrs }))
      .sort((a, b) => b.ovr - a.ovr)
    sideCache.set(key, list)
  }
  return sideCache.get(key)
}
// The side's real front line in a shape: the No. 9 spot first (its starter), then each spot by fit
function soccerRealFront(pool, short, list) {
  const left = [...soccerSide(pool, short)]
  const out = list.map(() => null)
  const order = list.map((_, i) => i).sort((a, b) => (NINE.has(list[b].label) ? 1 : 0) - (NINE.has(list[a].label) ? 1 : 0) || a - b)
  let nine = true
  for (const i of order) {
    const fit = SPOT_FIT[list[i].label] ?? SPOT_FIT.ST
    let best = -1, bk = null
    left.forEach((p, j) => {
      const f = fit.indexOf(p.role)
      if (f < 0) return
      const k = [nine && NINE.has(list[i].label) && p.starter ? 0 : 1, f, -p.ovr]
      if (!bk || k[0] < bk[0] || (k[0] === bk[0] && (k[1] < bk[1] || (k[1] === bk[1] && k[2] < bk[2])))) { bk = k; best = j }
    })
    if (NINE.has(list[i].label)) nine = false
    if (best >= 0) out[i] = left.splice(best, 1)[0]
  }
  return out
}
function soccerLineup(squad) {
  const pool = soccerPool(squad), list = spotsFor(squad)
  const real = squad.team ? soccerRealFront(pool, squad.team, list) : list.map(() => null)
  const built = squad.slots.filter(s => s.build)
  const at = spotsOf({ ...squad, slots: built })
  const spots = list.map((sp, i) => {
    const s = built.find(b => at[b.id] === i)
    return s ? { you: s, spot: i } : real[i] ? { real: real[i], spot: i } : { empty: true, spot: i }
  })
  const playing = new Set(spots.filter(x => x.real).map(x => x.real.name))
  const side = squad.team ? soccerSide(pool, squad.team) : []
  return {
    spots, real,
    benched: { st: real.filter((p, i) => p && spots[i].you) },   // the real forwards a build pushed out
    rotation: { bench: side.filter(p => !playing.has(p.name)) },  // everyone else of the side's in the data
    groups: { st: spots.filter(x => !x.empty) }, starters: { st: real.filter(Boolean) },
  }
}
const liftCache = new Map()
const liftAtt = (build, short, mode, key) => {
  if (!key) return SX.soccerStrikerLift(build, { short }, mode).att
  const k = `${mode}|${short}|${key}`
  if (!liftCache.has(k)) liftCache.set(k, SX.soccerStrikerLift(build, { short }, mode).att)
  return liftCache.get(k)
}
function soccerStrength(squad) {
  const pool = soccerPool(squad), mode = pool, list = spotsFor(squad)
  const src = soccerTeamRow(pool, squad.team) ?? { att: 80, def: 80 }
  const L = soccerLineup(squad)
  let att = src.att
  const moves = []
  L.spots.forEach((x, i) => {
    if (!x.you || !squad.team) return
    const was = L.real[i]
    const theirs = was ? liftAtt(asBuild(was, ST_TYPES), squad.team, mode, `r:${was.name}`) : liftAtt(SQUAD_PLAYER, squad.team, mode, 'squad-player')
    const d = (SPOT_WEIGHT[list[i].label] ?? 0.7) * (liftAtt(x.you.build, squad.team, mode) - theirs)
    att += d
    moves.push({ pos: 'st', spot: i, delta: r1(d) })
  })
  return { off: r1(Math.min(112, Math.max(50, att))), def: src.def, baseOff: src.att, baseDef: src.def, moves }
}
// the season's snapshot of the front line: k, s (a build's slot), n, pos 'st', o, spot, tag, role (real)
function soccerRoster(squad) {
  const list = spotsFor(squad)
  return soccerLineup(squad).spots.filter(x => !x.empty).map(x => (x.you
    ? { k: `b:${x.you.id}`, s: x.you.id, n: nameOf('st', x.you.build) ?? 'Striker', pos: 'st', o: ovrOf('st', x.you.build), spot: x.spot, tag: list[x.spot].label }
    : { k: `r:${x.real.name}`, n: x.real.name, pos: 'st', o: x.real.ovr, spot: x.spot, tag: list[x.spot].label, role: x.real.role }))
}
const SOCCER_TOT = ['apps', 'starts', 'mins', 'goals', 'assists', 'shots', 'sot', 'xg', 'bcm', 'pens', 'hatTricks', 'braces', 'motm', 'avgRating', 'conversion', 'goalsPer90']
const compactTie = t => ({
  comp: t.comp, name: t.name, o: t.opponent?.short ?? null, on: t.opponent?.name ?? null, x: t.opponent?.extra ? 1 : 0,
  legs: (t.legs ?? []).map(g => [g.mySc, g.oppSc, g.neutral ? 2 : g.home ? 1 : 0]), agg: t.agg ?? null, won: !!t.won, et: !!t.et,
  sh: t.shootout ? [t.shootout.my, t.shootout.opp] : null, final: !!t.final,
})
const compactRow = r => ({ short: r.short, name: r.name, played: r.played, wins: r.wins, draws: r.draws, losses: r.losses, gf: r.gf, ga: r.ga, gd: r.gd, points: r.points, pos: r.pos })
const ord = n => `${n}${(n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

function soccerSeason(squad, seed) {
  const pool = soccerPool(squad), mode = pool
  const str = soccerStrength(squad)
  const script = SX.scriptSoccerSeason({ short: squad.team }, { att: str.off, def: str.def }, seed, mode)
  const roster = soccerRoster(squad)
  const L = soccerLineup(squad)
  const bySlot = Object.fromEntries(squad.slots.map(s => [s.id, s]))
  // the men up front, the biggest share of the chances first
  const members = roster.map(p => {
    const real = p.s ? null : L.real[p.spot]
    return { p, build: p.s ? bySlot[p.s]?.build : asBuild(real, ST_TYPES), real, usage: SPOT_USAGE[p.tag] ?? 0.6 }
  }).sort((a, b) => b.usage - a.usage || a.p.spot - b.p.spot)
  const W = script.world
  // (a result's fixtures are the world's, by week: the same order as `order`)
  const order = W.fixtures.map((f, i) => ({ wk: f.wk, i })).sort((a, b) => a.wk - b.wk || a.i - b.i).map(x => x.i)
  const used = W.fixtures.map(() => 0)
  let share = 0, field = null, stars = null
  for (const m of members) {
    const sc = { ...script, world: { ...W, fixtures: W.fixtures.map((f, i) => (used[i] ? { ...f, mySc: f.mySc - used[i], oppSc: f.oppSc - used[i] } : f)) }, ...(field && { field, stars }) }
    const usage = m.usage / Math.max(0.3, 1 - share)
    const res = SX.runSoccerSimulation(m.build, ST_TYPES, { short: squad.team, squad: true, usage, ...(m.real?.age != null && { age: m.real.age }) }, mode, `${seed}|${m.p.k}`, 'classic', sc)
    let g = 0, seen = 0
    res.fixtures.forEach((x, k) => {
      const wi = order[k]
      seen += (W.fixtures[wi].mySc - used[wi]) * Math.min(4 / 3, (x.mins ?? 0) / 90)
      g += x.goals ?? 0
      used[wi] += x.goals ?? 0
    })
    share = Math.min(0.85, share + (seen > 0 ? g / seen : 0) * (1 - share))
    m.res = res
    // the World Cup's award field is played by the first man's run: everyone after him races the same one
    if (mode === 'alltime' && !field && res.book) {
      const b = res.book, n = b.boot.length, young = new Set((b.young ?? []).map(x => x.name))
      field = b.boot.map((x, i) => ({ ...x, age: young.has(x.name) ? 21 : null, score: b.ball[i]?.score ?? 0 }))
      stars = b.ball.slice(n).map(x => ({ ...x, age: young.has(x.name) ? 21 : null }))
    }
  }
  const R0 = members[0].res, B = R0.book
  // every match: the score (the first man's run plays the script's scores as they are) and each man's line
  const fx = R0.fixtures.map(x => ({
    c: x.comp, r: x.round ?? null, l: x.leg ?? null, o: x.opponent, on: x.oppName ?? null, x: x.oppExtra ? 1 : 0, h: x.neutral ? 2 : x.home ? 1 : 0,
    my: x.mySc, op: x.oppSc, res: x.result, t: x.through ?? null, et: x.et ? 1 : 0, sh: x.shootout ? [x.shootout.my, x.shootout.opp] : null, st: x.stage ?? null,
  }))
  const ml = Object.fromEntries(members.map(m => [m.p.k, m.res.fixtures.map(x => (x.mins ? [x.mins, x.goals, x.assists, x.rating ?? 0] : 0))]))
  const tot = Object.fromEntries(members.map(m => [m.p.k, {
    ...Object.fromEntries(SOCCER_TOT.map(k => [k, m.res[k] ?? 0])),
    allGoals: m.res.allComps?.goals ?? m.res.goals, allAssists: m.res.allComps?.assists ?? m.res.assists, allApps: m.res.allComps?.apps ?? m.res.apps,
  }]))
  // the goals nobody up front scored, the midfield's and the back line's (the league's; the World Cup's all)
  const others = mode === 'alltime'
    ? Math.max(0, fx.reduce((a, f) => a + f.my, 0) - members.reduce((a, m) => a + (m.res.goals ?? 0), 0))
    : Math.max(0, R0.gf - members.reduce((a, m) => a + (m.res.goals ?? 0), 0))

  // ── the awards: one winner each, among the squad's men and the real field ──
  // (the side's own players in the data are here, up front or on the bench: none of them is in the field too)
  const sideNames = new Set(soccerSide(pool, squad.team).map(p => p.name))
  const outside = x => !(x?.team === squad.team && sideNames.has(x.name))
  const F = { ...B, league: (B.league ?? []).filter(outside), stars: (B.stars ?? []).filter(outside), bdo: (B.bdo ?? []).filter(outside), boot: (B.boot ?? []).filter(outside), ball: (B.ball ?? []).filter(outside) }
  // (the Golden Boot is the forwards': a real midfielder filling the No. 10 races only for the others)
  const eligible = m => !m.real || FORWARD_ROLES.has(m.real.role)
  const who = m => ({ k: m.p.k, team: squad.team })
  const awards = {}
  const won = Object.fromEntries(members.map(m => [m.p.k, []]))
  const honor = {}
  if (mode === 'alltime') {
    const bf = F.boot ?? []
    const better = (x, me) => x.goals > me.goals || (x.goals === me.goals && (x.assists > me.assists || (x.assists === me.assists && x.mins < me.mins)))
    const ours = members.filter(m => eligible(m) && m.res.goals > 0).map(m => ({ m, goals: m.res.goals, assists: m.res.assists, mins: m.res.mins }))
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.mins - b.mins)[0]
    const top = [...bf].sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.mins - b.mins)[0]
    const bootOurs = !!ours && !bf.some(x => better(x, ours))
    awards.boot = { name: 'Golden Boot', winner: bootOurs ? { ...who(ours.m), goals: ours.goals } : top ? { name: top.name, team: top.team, goals: top.goals } : null }
    if (bootOurs) won[ours.m.p.k].push('Golden Boot')
    awards.race = [...members.filter(eligible).map(m => ({ ...who(m), goals: m.res.goals, assists: m.res.assists })), ...bf.map(x => ({ name: x.name, team: x.team, goals: x.goals, assists: x.assists }))]
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || (a.k ? -1 : b.k ? 1 : 0)).slice(0, 5)
    const ball = [...members.map(m => ({ ...who(m), score: m.res.goldenBall?.score ?? 0 })), ...(F.ball ?? []).map(x => ({ name: x.name, team: x.team, score: x.score }))]
      .sort((a, b) => b.score - a.score || (a.k ? -1 : 1))
    awards.ball = { name: 'Golden Ball', winner: ball[0] ? { k: ball[0].k, name: ball[0].name, team: ball[0].team } : null }
    ball.slice(0, 3).forEach((x, i) => { if (!x.k) return; if (i === 0) won[x.k].push('Golden Ball'); else honor[x.k] = i === 1 ? 'SILVER BALL' : 'BRONZE BALL' })
  } else {
    const lf = F.league ?? []
    const ours = members.filter(m => eligible(m) && m.res.goals > 0).sort((a, b) => b.res.goals - a.res.goals || b.res.assists - a.res.assists || a.res.mins - b.res.mins)[0]
    const top = [...lf].sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0]
    const bootOurs = !!ours && ours.res.goals >= (top?.goals ?? 0)
    awards.boot = { name: F.meta?.boot ?? 'Golden Boot', shared: bootOurs && ours.res.goals === top?.goals, winner: bootOurs ? { ...who(ours), goals: ours.res.goals } : top ? { name: top.name, team: top.team, goals: top.goals } : null }
    if (bootOurs) won[ours.p.k].push(awards.boot.name)
    awards.race = [...members.filter(eligible).map(m => ({ ...who(m), goals: m.res.goals, assists: m.res.assists })), ...lf.map(x => ({ name: x.name, team: x.team, goals: x.goals, assists: x.assists }))]
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || (a.k ? -1 : b.k ? 1 : 0)).slice(0, 5)
    const pots = [...members.map(m => ({ ...who(m), s: m.res.goals + 0.6 * m.res.assists + (F.posBonus ?? 0) })), ...lf.map(x => ({ name: x.name, team: x.team, s: x.pots })), ...(F.stars ?? []).map(x => ({ name: x.name, team: x.team, s: x.pots }))]
      .sort((a, b) => b.s - a.s || (a.k ? -1 : 1))
    awards.poty = { name: F.meta?.poty ?? 'Player of the Season', winner: pots[0] ? { k: pots[0].k, name: pots[0].name, team: pots[0].team } : null }
    if (pots[0]?.k) won[pots[0].k].push(awards.poty.name)
    const bdo = [...members.map(m => ({ ...who(m), score: m.res.ballonDor?.score ?? 0 })), ...(F.bdo ?? []).map(x => ({ name: x.name, team: x.team, score: x.score }))]
      .sort((a, b) => b.score - a.score || (a.k ? -1 : 1))
    awards.bdo = { name: "Ballon d'Or", winner: bdo[0] ? { k: bdo[0].k, name: bdo[0].name, team: bdo[0].team } : null }
    bdo.slice(0, 10).forEach((x, i) => { if (!x.k) return; if (i === 0) won[x.k].push("Ballon d'Or"); else honor[x.k] = `BALLON D'OR ${ord(i + 1).toUpperCase()}` })
    // (the Team of the Season rides along with a Ballon d'Or top ten)
    members.forEach(m => { if (m.res.teamOfSeason) honor[m.p.k] = honor[m.p.k] ? `${honor[m.p.k]} · TEAM OF THE SEASON` : 'TEAM OF THE SEASON' })
  }
  const statsOf = t => [['GOALS', t.goals], ['ASSISTS', t.assists], ['APPS', t.apps], ['RATING', t.avgRating ? r1(t.avgRating).toFixed(1) : '—']]
  const lines = members.filter(m => m.p.s).sort((a, b) => a.p.spot - b.p.spot).map(m => ({
    id: m.p.s, pos: 'st', spot: m.p.spot, tag: m.p.tag, ovr: m.p.o, name: m.p.n, face: faceOf(m.build), stats: statsOf(tot[m.p.k]),
    award: won[m.p.k][0] ? { name: won[m.p.k][0], won: true } : null, awards: won[m.p.k], ...(honor[m.p.k] && { honor: honor[m.p.k] }),
  }))
  const mates = members.filter(m => !m.p.s).sort((a, b) => a.p.spot - b.p.spot).map(m => ({ k: m.p.k, awards: won[m.p.k], ...(honor[m.p.k] && { honor: honor[m.p.k] }) }))
  const common = {
    pool, shape: squad.shape ?? '433', mode,
    wins: R0.wins, draws: R0.draws, losses: R0.losses, points: R0.points, gf: R0.gf, ga: R0.ga, gd: R0.gd,
    seed: R0.seed, champion: !!R0.champion, playoffs: !!R0.madePlayoffs, trophies: R0.trophies ?? [],
    standings: (R0.standings ?? []).map(compactRow), rounds: (R0.playoffRounds ?? []).map(compactTie),
    strength: { off: str.off, def: str.def, baseOff: str.baseOff, baseDef: str.baseDef },
    lines, mates, roster, tot, others, fx, ml, awards,
  }
  if (mode === 'alltime') return { result: { ...common, group: R0.conference, finish: R0.finish } }
  return {
    result: {
      ...common,
      league: R0.league ? { id: R0.league.id, name: R0.league.name, short: R0.league.short, size: R0.league.size, games: R0.league.games, cup: R0.league.cup } : null,
      cup: R0.cup ? { name: R0.cup.name, result: R0.cup.result, champion: !!R0.cup.champion, winner: R0.cup.winner ?? null } : null,
      europe: R0.europe ? { comp: R0.europe.comp, name: R0.europe.name, position: R0.europe.position, result: R0.europe.result, champion: !!R0.europe.champion, winner: R0.europe.winner ?? null } : null,
      qualified: R0.qualified ?? null, relegated: !!R0.relegated,
    },
  }
}
// soccer's matches as one list, in date order (league games numbered as matchweeks)
const COMP_LABEL = { league: 'LEAGUE', cup: 'CUP', ucl: 'CHAMPIONS LEAGUE', uel: 'EUROPA LEAGUE', wc: 'WORLD CUP' }
function soccerSchedule(r) {
  let lg = 0, gr = 0
  return (r.fx ?? []).map((f, i) => {
    const po = r.mode === 'alltime' ? f.st !== 'group' : f.c !== 'league'
    const label = f.c === 'league' ? `MW ${++lg}` : r.mode === 'alltime' && f.st === 'group' ? `MD ${++gr}` : String(f.r ?? COMP_LABEL[f.c] ?? '').toUpperCase()
    return { i, po, comp: f.c, label, round: f.r, leg: f.l, opp: f.o, oppName: f.on, extra: !!f.x, home: f.h === 1, neutral: f.h === 2, won: f.res === 'W', drawn: f.res === 'D', res: f.res, my: f.my, op: f.op, et: !!f.et, sh: f.sh, through: f.t }
  })
}
// One soccer match, the men up front: minutes, goals, assists, rating (0 minutes: didn't play)
export function soccerMatch(r, i) {
  return (r.roster ?? []).map(p => { const x = r.ml?.[p.k]?.[i]; return { p, mins: x ? x[0] : 0, goals: x ? x[1] : 0, assists: x ? x[2] : 0, rating: x ? x[3] : null } })
}
export const soccerOrdinal = ord

// ── Reading a result ─────────────────────────────────────────────────────────
// A result from the team engine (the old shape kept only the builds' lines)
export const isTeamResult = r => !!(r && r.ev && Array.isArray(r.roster) && r.tot && r.sd)
// Every game's box score, played again from the result (the same engine only; null otherwise). A season
// is played back once and kept (by its seed and time, so a copy of the result finds it too); the screen
// asks for it in idle time after it opens (seasonBoxSoon), so neither the result nor a box score waits.
const boxCache = new Map()
const boxKey = r => `${r.sd}|${r.at}|${r.n}|${r.team}`
export const seasonBoxReady = r => (isTeamResult(r) && r.ev === EV && boxCache.has(boxKey(r)) ? boxCache.get(boxKey(r)) : undefined)
export function seasonBox(r) {
  if (!isTeamResult(r) || r.ev !== EV || r.sport === 'soccer') return null   // (soccer keeps every match's lines in the result: r.fx, r.ml)
  const key = boxKey(r)
  if (boxCache.has(key)) return boxCache.get(key)
  let out = null
  try {
    out = r.sport === 'baseball' ? (BB?.baseballBox(r) ?? null) : r.sport === 'bucket'
      ? playBucketSeason({ roster: r.roster, sched: unpackGames(r.g), playoffs: unpackGames(r.pg), seed: r.sd })
      : playFootballSeason({ roster: r.roster, games: r.games, rounds: r.rounds, strength: r.strength, seed: r.sd })
  } catch { out = null }
  if (boxCache.size > 6) boxCache.delete(boxCache.keys().next().value)
  boxCache.set(key, out)
  return out
}
// …played back when the page is idle; `done` gets it (returns a cancel)
export function seasonBoxSoon(r, done) {
  const ready = seasonBoxReady(r)
  if (ready !== undefined) { done(ready); return () => {} }
  const run = () => done(seasonBox(r))
  if (typeof window !== 'undefined' && window.requestIdleCallback) { const id = window.requestIdleCallback(run, { timeout: 300 }); return () => window.cancelIdleCallback?.(id) }
  const t = setTimeout(run, 120)
  return () => clearTimeout(t)
}
// The schedule as one list: every game with its score (football keeps team names; basketball shorts)
export function scheduleOf(r) {
  if (r.sport === 'soccer') return soccerSchedule(r)
  if (r.sport === 'baseball') return BB?.baseballSchedule(r) ?? []
  if (r.sport === 'bucket') {
    const roundName = i => { const x = r.rounds?.[i]; return x?.type === 'playin' ? 'PLAY-IN' : (x?.name ?? 'PLAYOFFS').toUpperCase() }
    return [
      ...unpackGames(r.g).map((g, i) => ({ i, po: false, label: `G${i + 1}`, opp: g.o, home: !!g.h, won: g.my > g.op, my: g.my, op: g.op, ot: g.ot ?? 0 })),
      ...unpackGames(r.pg).map((g, i) => ({ i, po: true, label: g.pi ? 'PLAY-IN' : `${roundName(g.r)} · G${g.gm}`, round: roundName(g.r), gm: g.gm, opp: g.o, home: !!g.h, won: g.my > g.op, my: g.my, op: g.op, ot: g.ot ?? 0 })),
    ]
  }
  return [
    ...(r.games ?? []).map((g, i) => ({ i, po: false, label: `WK ${g.wk ?? i + 1}`, opp: nflShort(g.opponent) ?? g.opponent, oppName: g.opponent, home: !!g.home, won: !!g.won, my: g.mySc, op: g.oppSc })),
    ...(r.rounds ?? []).map((g, i) => ({ i, po: true, label: (g.round ?? 'PLAYOFFS').toUpperCase(), opp: nflShort(g.opponent) ?? g.opponent, oppName: g.opponent, home: !!g.home, won: !!g.won, my: g.mySc, op: g.oppSc, ot: g.overtime ? 1 : 0 })),
  ]
}
// The ready screen's basketball minutes (a normal night)
export function projectedMinutes(squad) {
  try { return minutesPlan(rosterOf(squad)) } catch { return {} }
}
export { bkCase }
