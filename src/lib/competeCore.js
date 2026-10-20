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
import { TEAMS } from '../data/nfl-teams'
import { NBA_TEAMS } from '../data/nba-teams'

export const POOL_SIZE = 5
export const FILL_AFTER_SECS = 60     // the countdown: starts over every time someone joins
export const MIN_POOL = 2             // real players only; five starts at once, fewer when the countdown runs out
export const BUILD_SECS = 300
const UNKNOWN_VAL = 3                 // a slot the server can't match to a real player: a free agent
// A pool's regular spins follow its seed (seededTeams / seededPlayer), so the server knows
// every player they deal. Respins are each player's own draw (SpinScreen separateRespins):
// one team respin and one player respin, so at most two picks may come from off the seed.
const OFF_SEED_MAX = 2
const SEED_SLACK = 2                  // spins past one-a-slot that still count (a pick never placed)

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
export function scoreBuild(sport, pos, sent, seed = null, vid = null) {
  const kit = competeKit(sport, pos)
  if (!kit || !sent || typeof sent !== 'object') return { ovr: 0, build: {} }
  const legal = seed ? dealtBy(sport, kit, seed, sent, vid) : null
  const build = {}
  for (const t of kit.types) {
    const c = sent[t]
    const name = legal && !legal.has(t) ? null : typeof c?.qbFull === 'string' ? c.qbFull : typeof c?.name === 'string' ? c.name : null
    const p = name && (kit.pool.find(x => x.name === name && (!c.team || x.team === c.team)) ?? kit.pool.find(x => x.name === name))
    const val = p?.attrs?.[t]
    build[t] = { type: t, val: typeof val === 'number' ? val : UNKNOWN_VAL, qbFull: p?.name ?? 'Free agent', team: p?.team ?? null, ...(p?.subpos ? { subpos: p.subpos } : {}) }
  }
  return { ovr: Math.max(0, Math.min(99, Math.round(kit.ovr(build) ?? 0))), build }
}

// Which slots hold a player this pool could have dealt: each regular spin's player
// once, plus up to OFF_SEED_MAX respun picks. A slot outside that scores as a free agent,
// so a phone can't send the league's best player for every slot.
// the reel's nth player (SpinScreen: order[playerDraw % order.length])
const drawOf = (order, d) => (order.length ? order[d % order.length] : null)
const nameOf = c => (typeof c?.qbFull === 'string' ? c.qbFull : typeof c?.name === 'string' ? c.name : null)
// Which slots of a sent build hold a player its seeded spins really dealt. Each chip says
// where it came from (SpinScreen chipSpin: spin #i, a regular spin, a player respin or a
// team respin) and that one draw is checked: one pick a spin, one team respin and one
// player respin in all. Without a respin seed (an older Compete app): each regular
// spin's player once, plus two respun picks.
export function legalSlots({ seed, rs = null, types, pool, teams, sent }) {
  const order = seededTeams(seed, teams, pool)
  const N = types.length + SEED_SLACK
  const ok = new Set()
  if (!sent || typeof sent !== 'object' || !order.length) return ok
  if (rs) {
    const usedSpin = new Set(); let tr = 0, pr = 0
    for (const t of types) {
      const c = sent[t], name = nameOf(c), s = c?.spin
      const i = Number.isInteger(s?.i) ? s.i : -1, d = Number.isInteger(s?.d) ? s.d : 0
      if (!name || i < 0 || i >= N || usedSpin.has(i) || d < 0 || d > 1) continue
      const team = order[i % order.length]
      let p = null
      if (s.how === 'spin' && d === 0) p = seededPlayer(seed, i, team, pool)
      else if (s.how === 'pr' && d === 1 && pr < 1) { p = drawOf(respinPlayers(rs, i, team, pool), 1); if (p?.name === name) pr++ }
      else if (s.how === 'tr' && tr < 1 && (d === 0 || pr < 1)) {
        const rt = respinTeam(rs, i, teams, pool)
        p = rt ? drawOf(respinPlayers(rs, i, rt, pool), d) : null
        if (p?.name === name) { tr++; if (d === 1) pr++ }
      }
      if (p?.name === name) { ok.add(t); usedSpin.add(i) }
    }
    return ok
  }
  const left = new Map()
  for (let i = 0; i < N; i++) {
    const p = seededPlayer(seed, i, order[i % order.length], pool)
    if (p) left.set(p.name, (left.get(p.name) ?? 0) + 1)
  }
  const off = []
  for (const t of types) {
    const name = nameOf(sent[t]); if (!name) continue
    if (left.get(name) > 0) { left.set(name, left.get(name) - 1); ok.add(t) } else off.push(t)
  }
  off.slice(0, OFF_SEED_MAX).forEach(t => ok.add(t))
  return ok
}
const dealtBy = (sport, kit, seed, sent, vid) =>
  legalSlots({ seed, rs: vid ? `${seed}:${vid}` : null, types: kit.types, pool: kit.pool, teams: sport === 'bucket' ? NBA_TEAMS : TEAMS, sent })

// The teams the reel shows (only those with someone to draft), in a fixed order
const reelTeams = (teams, pool) => {
  const draftable = new Set(pool.map(p => p.team))
  const list = teams.some(t => draftable.has(t.short)) ? teams.filter(t => draftable.has(t.short)) : teams
  return [...list].sort((a, b) => a.short.localeCompare(b.short))
}
const rosterOf = (team, pool) => pool.filter(q => q.team === team.short).sort((a, b) => a.name.localeCompare(b.name))
// The pool's spin order — the same lookup SpinScreen makes for seeded spins
export function seededTeams(seed, teams, pool) {
  return seededShuffle(reelTeams(teams, pool), `${seed}:teams`)
}
// A seat's respins (SpinScreen with seedPlan.respinSeed = `${seed}:${vid}`) on its spin #i
export const respinTeam = (rs, i, teams, pool) => seededShuffle(reelTeams(teams, pool), `${rs}:teams:${i}`)[0] ?? null
export const respinPlayers = (rs, i, team, pool) => seededShuffle(rosterOf(team, pool), `${rs}:${i}:${team.short}`)
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
