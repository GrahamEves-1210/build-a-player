// COMPETE pools: the rules, shared by the app (lib/compete.js) and the live server
// (live/src/compete.js). Pure: no React, no network, no storage.
// A submitted build is only trusted for WHICH player filled each slot: the
// server looks every rating up in the real data and works the OVR out itself,
// so a phone can't claim a number it never drew.

import { seeded, seededShuffle } from './rng'
import { calcOVR, calcOVRRB, calcOVRWR, calcOVRTE, calcOVRDB } from '../utils/simulation'
import { calcBucketOVR } from '../utils/bucketSimulation'
import { QBS, TYPES } from '../data/qbs'
import { RBS, RB_TYPES } from '../data/rbs'
import { WRS, WR_TYPES } from '../data/wrs'
import { TES, TE_TYPES } from '../data/tes'
import { DBS, DB_TYPES } from '../data/dbs'
import { NBA_GUARD_PLAYERS, GUARD_TYPES } from '../data/nba-guards'
import { NBA_BIG_PLAYERS, BIG_TYPES } from '../data/nba-bigs'

export const POOL_SIZE = 5
export const FILL_AFTER_SECS = 60     // the countdown: starts over every time someone joins
export const MIN_POOL = 2             // real players only; five starts at once, fewer when the countdown runs out
export const BUILD_SECS = 300
const UNKNOWN_VAL = 3                 // a slot the server can't match to a real player: a free agent

export const COMPETE_POS = { nfl: ['qb', 'rb', 'wr', 'te', 'db'], bucket: ['guard', 'big'] }
const NFL = {
  qb: { pool: QBS, types: TYPES, ovr: b => calcOVR(b) },
  rb: { pool: RBS, types: RB_TYPES, ovr: b => calcOVRRB(b) },
  wr: { pool: WRS, types: WR_TYPES, ovr: b => calcOVRWR(b) },
  te: { pool: TES, types: TE_TYPES, ovr: b => calcOVRTE(b) },
  db: { pool: DBS, types: DB_TYPES, ovr: b => calcOVRDB(b) },
}
const BUCKET = {
  guard: { pool: NBA_GUARD_PLAYERS, types: GUARD_TYPES, ovr: b => calcBucketOVR(b, GUARD_TYPES, 'guard') },
  big: { pool: NBA_BIG_PLAYERS, types: BIG_TYPES, ovr: b => calcBucketOVR(b, BIG_TYPES, 'big') },
}
export const competeKit = (sport, pos) => (sport === 'bucket' ? BUCKET[pos] : NFL[pos]) ?? null

// The build the server believes: every slot's rating looked up from the named
// player (name + team), never taken from the phone
export function scoreBuild(sport, pos, sent) {
  const kit = competeKit(sport, pos)
  if (!kit || !sent || typeof sent !== 'object') return { ovr: 0, build: {} }
  const build = {}
  for (const t of kit.types) {
    const c = sent[t]
    const name = typeof c?.qbFull === 'string' ? c.qbFull : typeof c?.name === 'string' ? c.name : null
    const p = name && (kit.pool.find(x => x.name === name && (!c.team || x.team === c.team)) ?? kit.pool.find(x => x.name === name))
    const val = p?.attrs?.[t]
    build[t] = { type: t, val: typeof val === 'number' ? val : UNKNOWN_VAL, qbFull: p?.name ?? 'Free agent', team: p?.team ?? null, ...(p?.subpos ? { subpos: p.subpos } : {}) }
  }
  return { ovr: Math.max(0, Math.min(99, Math.round(kit.ovr(build) ?? 0))), build }
}

// The pool's spin order — the same lookup SpinScreen makes for seeded spins
export function seededTeams(seed, teams, pool) {
  const draftable = new Set(pool.map(p => p.team))
  const list = teams.some(t => draftable.has(t.short)) ? teams.filter(t => draftable.has(t.short)) : teams
  return seededShuffle([...list].sort((a, b) => a.short.localeCompare(b.short)), `${seed}:teams`)
}
export function seededPlayer(seed, i, team, pool) {
  const roster = pool.filter(q => q.team === team.short).sort((a, b) => a.name.localeCompare(b.name))
  return roster.length ? seededShuffle(roster, `${seed}:${i}:${team.short}`)[0] : null
}

// A bot's build from the pool's spins: on each spin it takes the open slot
// where this player is best — with some judgment noise, more for weaker bots
export function botBuild({ seed, idx, skill, teams, pool, types, calcOvr }) {
  const r = seeded(`${seed}:bot:${idx}`)
  const order = seededTeams(seed, teams, pool)
  const build = {}
  for (let i = 0; i < 40 && types.some(t => !build[t]); i++) {
    const team = order[i % order.length]
    const p = seededPlayer(seed, i, team, pool)
    if (!p?.attrs) continue
    const open = types.filter(t => !build[t] && p.attrs[t] != null)
    if (!open.length) continue
    const pick = open
      .map(t => ({ t, score: p.attrs[t] + (r() - 0.5) * (1 - skill) * 6 }))
      .sort((a, b) => b.score - a.score)[0].t
    build[pick] = { type: pick, val: p.attrs[pick], qbFull: p.name, team: p.team }
  }
  return { build, ovr: Math.round(calcOvr(build) ?? 0) }
}

export function rankResults(match, results) {
  if (!match) return []
  return match.players
    .map(p => ({ ...p, res: results[p.vid] ?? null }))
    .sort((a, b) => (b.res?.ovr ?? -1) - (a.res?.ovr ?? -1) || (a.res?.at ?? 9e15) - (b.res?.at ?? 9e15))
    .map((p, i) => ({ ...p, place: i + 1 }))
}
