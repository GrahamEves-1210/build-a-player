// SQUAD BUILDER: the season (lib/squad.js is the save).
//
// One season for the whole squad, in three steps:
//   1. Strength: the team's real off/def, moved by each build against the
//      starter it pushes out of the lineup (better than him: the team gets better).
//   2. The season is played once from that strength, on a seeded RNG
//      (scriptNFLSeason / scriptBucketSeason): schedule, results, playoffs.
//   3. Each build plays that same season through its position's own sim (the
//      `script` argument), which only makes its stat line, then its award chances.
// So the squad shares one record, and the same squad and season number always
// play back the same way.

import { seeded } from './rng'
import { CAPS, POSITIONS, SPOTS, spotsOf } from './squad'
import {
  calcOVR, calcOVRRB, calcOVRWR, calcOVRTE, calcOVRDB, calcOVRDL, calcOVRLB,
  runSimulation, runRBSimulation, runWRSimulation, runTESimulation, runDBSimulation, runDLSimulation, runLBSimulation, scriptNFLSeason,
  calcMVPResult, calcOPOYResult, calcWROPOYResult, calcTEOPOYResult, calcDBDpoyResult, calcDLDpoyResult, calcLBDpoyResult,
  getArchetype, getArchetypeRB, getArchetypeWR, getArchetypeTE, getArchetypeDB, getArchetypeDL, getArchetypeLB, dlBuildSpot, nflHeadshot, HEADSHOT_BASE,
} from '../utils/simulation'
import { runBucketSimulation, scriptBucketSeason, calcBucketOVR, TEAM_RATINGS, getBucketGuardArchetype, getBucketBigArchetype } from '../utils/bucketSimulation'
import { QBS, TYPES } from '../data/qbs'
import { RBS, RB_TYPES } from '../data/rbs'
import { WRS, WR_TYPES } from '../data/wrs'
import { TES, TE_TYPES } from '../data/tes'
import { DBS, DB_TYPES } from '../data/dbs'
import { DLS, DL_TYPES } from '../data/dls'
import { LBS, LB_TYPES } from '../data/lbs'
import { NFL_TEAMS } from '../data/nfl-teams'
import { NBA_GUARD_PLAYERS, GUARD_TYPES } from '../data/nba-guards'
import { NBA_BIG_PLAYERS, BIG_TYPES } from '../data/nba-bigs'
import { NBA_TEAMS } from '../data/nba-teams'
import NFL_HEADSHOTS from '../data/headshots.json'
import NBA_HEADSHOTS from '../data/nba-headshots.json'

// ── Per position ─────────────────────────────────────────────────────────────
const POOL = { qb: QBS, rb: RBS, wr: WRS, te: TES, db: DBS, dl: DLS, lb: LBS, guard: NBA_GUARD_PLAYERS, big: NBA_BIG_PLAYERS }
export const TYPES_OF = { qb: TYPES, rb: RB_TYPES, wr: WR_TYPES, te: TE_TYPES, db: DB_TYPES, dl: DL_TYPES, lb: LB_TYPES, guard: GUARD_TYPES, big: BIG_TYPES }
const OVR = {
  qb: b => calcOVR(b, TYPES), rb: b => calcOVRRB(b, RB_TYPES), wr: b => calcOVRWR(b, WR_TYPES), te: b => calcOVRTE(b, TE_TYPES), db: b => calcOVRDB(b, DB_TYPES), dl: b => calcOVRDL(b, DL_TYPES), lb: b => calcOVRLB(b, LB_TYPES),
  guard: b => calcBucketOVR(b, GUARD_TYPES, 'guard'), big: b => calcBucketOVR(b, BIG_TYPES, 'big'),
}
export const ovrOf = (pos, build) => Math.round(OVR[pos]?.(build || {}) ?? 0)
const ARCH = {
  qb: (o, b) => getArchetype(o, b, TYPES), rb: (o, b) => getArchetypeRB(o, b, RB_TYPES), wr: (o, b) => getArchetypeWR(o, b, WR_TYPES),
  te: (o, b) => getArchetypeTE(o, b, TE_TYPES), db: (o, b) => getArchetypeDB(o, b, DB_TYPES), dl: (o, b) => getArchetypeDL(o, b, DL_TYPES), lb: (o, b) => getArchetypeLB(o, b, LB_TYPES),
  guard: (o, b) => getBucketGuardArchetype(o, b, GUARD_TYPES), big: (o, b) => getBucketBigArchetype(o, b, BIG_TYPES),
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
export const teamsOf = sport => (sport === 'bucket' ? NBA_TEAMS : NFL_TEAMS)
export const teamOf = (sport, short) => teamsOf(sport).find(t => t.short === short) ?? null
export const logoOf = (sport, short) => (sport === 'bucket' ? `/logos/nba/${short}.png` : teamOf(sport, short)?.logo ?? `/logos/${short}.png`)

// A real player's ratings read as a build (the OVR helpers only need each trait's value)
const asBuild = (p, types) => Object.fromEntries(types.map(t => [t, { val: p.attrs?.[t] ?? 5 }]))
// What an empty spot is worth (a team short at a position plays a backup)
const REPLACEMENT = { nfl: 62, bucket: 64 }

// The team's real starters at each position, best first (as many as the squad's caps)
const dlSpotIn = name => (POOL.dl.find(p => p.name === name)?.subpos === 'dt' ? 'dt' : 'edge')
export function startersOf(sport, short) {
  const out = {}, taken = new Set()
  // basketball: the team's real starters (starter: true, in either list: LeBron is marked in
  // both) start first, the same five as the season's Starting 5. Football picks by OVR (its
  // starter marks aren't kept as a depth chart)
  const marked = new Set(sport === 'bucket' ? POSITIONS[sport].flatMap(pos => POOL[pos].filter(p => p.team === short && p.starter).map(p => p.name)) : [])
  // basketball fills the bigs first: a forward listed in both groups (LeBron, Giannis) starts
  // at the four, the way his team plays him, and the guards fill around him
  for (const pos of sport === 'bucket' ? ['big', 'guard'] : POSITIONS[sport]) {
    const types = TYPES_OF[pos]
    out[pos] = POOL[pos]
      .filter(p => p.team === short && p.attrs && !taken.has(p.name))
      .map(p => ({ name: p.name, short: p.short || p.name.split(' ').slice(-1)[0], number: p.number ?? null, pos, ovr: Math.round(OVR[pos](asBuild(p, types))), photo: photoOf(sport, p), starter: marked.has(p.name), ...(pos === 'dl' && { spot: p.subpos === 'dt' ? 'dt' : 'edge' }) }))
      .sort((a, b) => (b.starter - a.starter) || (b.ovr - a.ovr))   // marked starters, then the best of the rest
      // (a line starts two ends and two tackles, the best at each; everyone else the best to the cap)
      .filter((p, i, all) => (pos === 'dl' ? all.slice(0, i + 1).filter(x => dlSpotIn(x.name) === dlSpotIn(p.name)).length <= 2 : i < CAPS[sport][pos]))
      .sort((a, b) => b.ovr - a.ovr)   // best first: a build pushes out the weakest
    out[pos].forEach(p => taken.add(p.name))   // a player listed at two spots starts at one
  }
  return out
}

// A DL build's spot on the line (its Size chip), and how a spot reads on screen
export const spotOfBuild = dlBuildSpot
export const SPOT_LABEL = { edge: 'EDGE', dt: 'DT' }

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

// Who starts where. Your builds take the starting jobs at their positions; the
// team's real starters fill the rest, best first; the ones your builds pushed
// out sit. Basketball follows the lineup board (squad.lineup: slot id → spot).
export function lineupOf(squad) {
  const { sport } = squad
  const starters = squad.team ? startersOf(sport, squad.team) : Object.fromEntries(POSITIONS[sport].map(p => [p, []]))
  const built = squad.slots.filter(s => s.build)
  const groups = {}, benched = {}
  for (const pos of POSITIONS[sport]) {
    const mine = built.filter(s => s.pos === pos)
    const open = Math.max(0, CAPS[sport][pos] - mine.length)
    const { start, sit } = pos === 'dl' ? dlFront(mine, starters[pos]) : { start: starters[pos].slice(0, open), sit: starters[pos].slice(open) }
    groups[pos] = [...mine.map(s => ({ you: s })), ...start.map(p => ({ real: p }))]
    benched[pos] = sit
  }
  if (sport !== 'bucket') return { groups, benched, starters }
  // the board: each build at its spot (or the first open one in its group), real players around them
  const spots = SPOTS.map(() => null)
  const at = spotsOf({ ...squad, slots: built })
  for (const s of built) if (at[s.id] != null) spots[at[s.id]] = { you: s }
  for (const pos of POSITIONS.bucket) {
    const real = groups[pos].filter(x => x.real)
    SPOTS.forEach((sp, i) => { if (sp.pos === pos && !spots[i]) spots[i] = real.shift() ?? { empty: true } })
  }
  return { groups, benched, starters, spots }
}

// ── Strength ─────────────────────────────────────────────────────────────────
// Each point of OVR a build has over the starter it replaces moves the team
// (football off/def 1–10; basketball off/def out of 100)
const MOVE = {
  qb: { off: 0.22 }, rb: { off: 0.09 }, wr: { off: 0.075 }, te: { off: 0.065 }, db: { def: 0.09 }, dl: { def: 0.10 }, lb: { def: 0.08 },
  guard: { off: 0.45, def: 0.15 }, big: { off: 0.25, def: 0.35 },
}
export function squadStrength(squad) {
  const { sport } = squad
  const real = sport === 'bucket'
    ? (TEAM_RATINGS[squad.team] ?? { off: 68, def: 65 })
    : (teamOf(sport, squad.team) ?? { off: 6, def: 6 })
  const starters = startersOf(sport, squad.team)
  let off = real.off, def = real.def
  const moves = []
  for (const pos of POSITIONS[sport]) {
    const mine = squad.slots.filter(s => s.pos === pos && s.build)
    if (!mine.length) continue
    // your builds push out the weakest starters at the position
    const cap = CAPS[sport][pos]
    const out = [...starters[pos]]
    while (out.length < cap) out.push({ ovr: REPLACEMENT[sport] })
    const pushed = pos === 'dl' ? dlFront(mine, out).sit : out.slice(cap - mine.length)
    const delta = mine.reduce((a, s) => a + ovrOf(pos, s.build), 0) - pushed.reduce((a, p) => a + p.ovr, 0)
    off += delta * (MOVE[pos].off ?? 0)
    def += delta * (MOVE[pos].def ?? 0)
    moves.push({ pos, delta })
  }
  const lim = sport === 'bucket' ? [40, 99] : [1, 12]
  const clamp = v => Math.round(Math.min(lim[1], Math.max(lim[0], v)) * 10) / 10
  return { off: clamp(off), def: clamp(def), baseOff: real.off, baseDef: real.def, moves }
}

// ── The season ───────────────────────────────────────────────────────────────
const r1 = v => Math.round((v ?? 0) * 10) / 10
// Two backs split the carries, three receivers the targets (football's sims each
// play one player as the whole position)
const SHARE = { rb: [1, 0.62], wr: [1, 0.75, 0.6], te: [1, 0.6], lb: [1, 0.88, 0.78] }   // (linebackers split the tackles)
const SHARED_KEYS = {
  rb: ['seasonRushYds', 'seasonRushTDs', 'seasonCarries', 'seasonRecYds', 'seasonRecTDs', 'seasonRecs', 'hundredYardGames'],
  wr: ['seasonRecs', 'seasonRecYds', 'seasonRecTDs', 'seasonTargets', 'hundredYardGames'],
  te: ['seasonRecs', 'seasonRecYds', 'seasonRecTDs', 'seasonTargets', 'hundredYardGames'],
  lb: ['seasonTackles', 'seasonTFL', 'seasonSacks', 'seasonQBHits', 'seasonPDs', 'seasonINTs', 'seasonFF'],
}
function share(res, pos, n) {
  const k = SHARE[pos]?.[n - 1]
  if (!k || k === 1) return res
  const out = { ...res }
  for (const f of SHARED_KEYS[pos]) if (typeof out[f] === 'number') out[f] = Math.round(out[f] * k)
  if (pos === 'rb' && out.seasonCarries) out.seasonYPC = r1(out.seasonRushYds / out.seasonCarries)
  return out
}
// A line shares the quarterback the same way: four rushers can't each have the season one has
// by himself (the most a whole team has ever had is 72). A sack a teammate got instead comes off
// the game it was in, with the TFL and the tackle it counted as, so every total still adds up.
const DL_SHARE = [1, 0.92, 0.84, 0.76]
const DL_TOTALS = { sacks: 'seasonSacks', tfl: 'seasonTFL', tackles: 'seasonTackles', qbHits: 'seasonQBHits', ff: 'seasonFF', fr: 'seasonFR', pbus: 'seasonPBUs', safeties: 'seasonSafeties' }
const keepOf = (n, p) => { let c = 0; for (let i = 0; i < n; i++) if (Math.random() < p) c++; return c }
function shareDLGame(g, k) {
  const sacks = keepOf(g.sacks, k), lost = g.sacks - sacks
  // run stops thin less: the run comes at each man about as often. Only what can't be a sack's TFL can go here.
  const runLost = keepOf(Math.max(0, g.tfl - g.sacks), (1 - k) / 2)
  const sackTflLost = Math.min(g.tfl - runLost, keepOf(lost, 0.85))   // 85% of sacks are also TFLs (runDLSimulation)
  const tfl = g.tfl - runLost - sackTflLost
  return { ...g, sacks, tfl, tackles: g.tackles - lost - runLost, qbHits: sacks + keepOf(g.qbHits - g.sacks, k), ff: keepOf(g.ff, k), safeties: Math.min(g.safeties, tfl) }
}
function shareDL(res, n) {
  const k = DL_SHARE[n - 1]
  if (!k || k === 1) return res
  const games = res.games.map(g => shareDLGame(g, k)), playoffRounds = (res.playoffRounds ?? []).map(g => shareDLGame(g, k))
  const out = { ...res, games, playoffRounds, bestGame: games.find(g => g.wk === res.bestGame?.wk) ?? res.bestGame }
  for (const [f, total] of Object.entries(DL_TOTALS)) out[total] = [...games, ...playoffRounds].reduce((a, g) => a + g[f], 0)
  const last = playoffRounds[playoffRounds.length - 1]
  if (res.sbResult?.won && last) out.sbResult = { won: true, ...Object.fromEntries(Object.keys(DL_TOTALS).map(f => [f, last[f]])) }
  return out
}

const NFL = {
  qb: { sim: (b, t, team, s) => runSimulation(b, t, team, false, s), award: ['MVP', calcMVPResult],
    line: r => [['YDS', r.seasonPassYds], ['TD', r.seasonTDs], ['INT', r.seasonINTs], ['RTG', r.seasonRating]] },
  rb: { sim: (b, t, team, s) => runRBSimulation(b, t, team, false, s), award: ['OPOY', calcOPOYResult],
    line: r => [['YDS', r.seasonRushYds], ['TD', (r.seasonRushTDs ?? 0) + (r.seasonRecTDs ?? 0)], ['YPC', r1(r.seasonYPC)], ['REC', r.seasonRecs]] },
  wr: { sim: (b, t, team, s) => runWRSimulation(b, t, team, false, s), award: ['OPOY', calcWROPOYResult],
    line: r => [['REC', r.seasonRecs], ['YDS', r.seasonRecYds], ['TD', r.seasonRecTDs], ['YPR', r1(r.seasonYPR)]] },
  te: { sim: (b, t, team, s) => runTESimulation(b, t, team, false, s), award: ['OPOY', calcTEOPOYResult],
    line: r => [['REC', r.seasonRecs], ['YDS', r.seasonRecYds], ['TD', r.seasonRecTDs], ['YPR', r1(r.seasonYPR)]] },
  db: { sim: (b, t, team, s) => runDBSimulation(b, team, false, s), award: ['DPOY', calcDBDpoyResult],
    line: r => [['TKL', r.seasonTackles], ['INT', r.seasonINTs], ['PBU', r.seasonPBUs], ['FF', r.seasonFF]] },
  dl: { sim: (b, t, team, s) => runDLSimulation(b, team, false, s), award: ['DPOY', calcDLDpoyResult],
    line: r => [['SCK', r.seasonSacks], ['TFL', r.seasonTFL], ['TKL', r.seasonTackles], ['QBH', r.seasonQBHits]] },
  lb: { sim: (b, t, team, s) => runLBSimulation(b, team, false, s), award: ['DPOY', calcLBDpoyResult],
    line: r => [['TKL', r.seasonTackles], ['SCK', r.seasonSacks], ['INT', r.seasonINTs], ['PD', r.seasonPDs]] },
}

// Math.random, seeded, for the length of fn (the football sims and awards roll it)
function withSeed(str, fn) {
  const real = Math.random
  Math.random = seeded(str)
  try { return fn() } finally { Math.random = real }
}
const intSeed = str => Math.floor(seeded(str)() * 4294967295)

// One award of a kind per season: two winners → the better build keeps it
function oneEach(lines) {
  const seen = new Set()
  for (const l of [...lines].sort((a, b) => b.ovr - a.ovr)) {
    if (!l.award?.won) continue
    if (seen.has(l.award.name)) l.award = { ...l.award, won: false, teammate: true }
    else seen.add(l.award.name)
  }
  return lines
}

export function runSquadSeason(squad, { raw = false } = {}) {
  const n = (squad.seasons?.length ?? 0) + 1
  const seed = `${squad.seed}-season-${n}`
  const out = squad.sport === 'bucket' ? bucketSeason(squad, seed) : withSeed(seed, () => footballSeason(squad))
  const result = { ...out.result, n, sport: squad.sport, team: squad.team, sandbox: !!squad.sandbox, size: squad.slots.length, at: Date.now() }
  return raw ? { result, raw: out.raw } : result
}

function footballSeason(squad) {
  const base = teamOf('nfl', squad.team)
  const str = squadStrength(squad)
  // the script plays the squad's real strength; each sim gets it inside its own 1–10 scale
  const script = scriptNFLSeason({ ...base, off: str.off, def: str.def })
  const simTeam = { ...base, off: Math.min(10, str.off), def: Math.min(10, str.def) }
  const built = squad.slots.filter(s => s.build)
  const raw = [], lines = []
  for (const s of built) {
    const P = NFL[s.pos]
    const n = built.filter(x => x.pos === s.pos).length
    const played = P.sim(s.build, s.types ?? TYPES_OF[s.pos], simTeam, script)
    const res = s.pos === 'dl' ? shareDL(played, n) : share(played, s.pos, n)
    const aw = P.award[1](res, false, base.short)
    const ovr = ovrOf(s.pos, s.build)
    raw.push(res)
    lines.push({ id: s.id, pos: s.pos, ovr, name: nameOf(s.pos, s.build), face: faceOf(s.build), stats: P.line(res), award: { name: P.award[0], won: !!aw.userWins, winner: aw.winner?.name ?? null }, ...(s.pos === 'dl' && { tag: res.spot }) })
  }
  oneEach(lines)
  return {
    raw,
    result: {
      wins: script.wins, losses: script.losses, playoffs: script.playoffs, champion: script.champion, hasBye: script.hasBye,
      games: script.games, rounds: script.rounds,
      strength: { off: str.off, def: str.def, baseOff: str.baseOff, baseDef: str.baseDef },
      lines,
    },
  }
}

// The ball gets shared: the more builds on the floor, the smaller each one's piece.
// Spot 1 (the point) and 4 (the four) run things; the 3 and the 5 finish them.
const BALL = [1, 0.9, 0.82, 0.76, 0.7]
const SPOT_USE = [1, 0.97, 0.93, 1, 0.95]
function bucketSeason(squad, seed) {
  const team = teamOf('bucket', squad.team)
  const str = squadStrength(squad)
  const script = scriptBucketSeason(team, { off: str.off, def: str.def }, intSeed(seed))
  const { spots } = lineupOf(squad)
  const built = squad.slots.filter(s => s.build)
  const raw = [], lines = []
  for (const s of built) {
    const spot = spots.findIndex(x => x?.you?.id === s.id)
    const usage = BALL[built.length - 1] * (SPOT_USE[spot] ?? 1)
    const res = runBucketSimulation(s.build, s.types ?? TYPES_OF[s.pos], { ...team, squad: true, usage }, s.pos, intSeed(`${seed}-${s.id}`), 'classic', script)
    raw.push(res)
    const mvpScore = res.ppg + res.apg * 1.5 + res.rpg * 0.75, dpoyScore = res.spg * 10 + res.bpg * 8
    const line = {
      id: s.id, pos: s.pos, spot, ovr: res.ovr, name: nameOf(s.pos, s.build), face: faceOf(s.build),
      stats: [['PPG', res.ppg], ['RPG', res.rpg], ['APG', res.apg], s.pos === 'big' ? ['BPG', res.bpg] : ['FG%', res.fgPct]],
      mvp: !!res.mvp, dpoy: !!res.dpoy, mvpScore, dpoyScore,
    }
    lines.push(line)
  }
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
    raw,
    result: {
      wins: script.wins, losses: script.losses, playoffs: script.madePlayoffs, champion: script.champion,
      seed: script.seed, conference: script.conference, log: script.games.map(g => (g.won ? 'W' : 'L')).join(''),
      rounds: script.playoffRounds.map(r => ({ type: r.type, name: r.name ?? null, label: r.label ?? null, opponent: r.opponent?.short ?? null, wins: r.wins ?? null, losses: r.losses ?? null, won: r.type === 'playin' ? !!r.advanced : !!r.won })),
      finals: finals ? { opponent: finals.opponent?.short ?? null, series: `${finals.wins}-${finals.losses}` } : null,
      strength: { off: str.off, def: str.def, baseOff: str.baseOff, baseDef: str.baseDef },
      lines: out,
    },
  }
}
