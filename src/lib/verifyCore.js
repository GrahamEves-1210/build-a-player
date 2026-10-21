// What the live server checks before a result reaches a public board (live/src/submit.js).
// Pure: no React, no storage, no network. A phone only says WHICH player filled each
// trait; every rating is looked up in the real data and every OVR is worked out here,
// the same way the game works it out (the run*Simulation functions).

import { seededShuffle } from './rng'
import { calcOVR, calcOVRRB, calcOVRWR, calcOVRTE, calcOVRDB, calcOVROL } from '../utils/simulation'
import { calcBucketOVR } from '../utils/bucketSimulation'
import { QBS, TYPES, LITE_TYPES } from '../data/qbs'
import { LEGENDS, LEGEND_TYPES } from '../data/qb-legends'
import { RBS, RB_TYPES, RB_LITE_TYPES } from '../data/rbs'
import { RB_LEGENDS } from '../data/rb-legends'
import { WRS, WR_TYPES, WR_LITE_TYPES } from '../data/wrs'
import { WR_LEGENDS } from '../data/wr-legends'
import { TES, TE_TYPES, TE_LITE_TYPES } from '../data/tes'
import { TE_LEGENDS } from '../data/te-legends'
import { DBS, DB_TYPES, DB_LITE_TYPES } from '../data/dbs'
import { DB_LEGENDS } from '../data/db-legends'
import { OLS, OL_TYPES, OL_LITE_TYPES } from '../data/ols'
import { NBA_GUARD_PLAYERS, GUARD_TYPES } from '../data/nba-guards'
import { NBA_BIG_PLAYERS, BIG_TYPES } from '../data/nba-bigs'
import { NBA_ALLTIME_GUARD_PLAYERS } from '../data/nba-guard-legends'
import { NBA_ALLTIME_BIG_PLAYERS } from '../data/nba-big-legends'
import { TEAMS } from '../data/nfl-teams'
import { NBA_TEAMS } from '../data/nba-teams'

// ── The Daily Challenge (lib/progress.js uses these too) ─────────────────────
// Everyone gets the same seeded spins each day; the position and mode follow the date
export const DC_POS = ['qb', 'wr', 'rb', 'db', 'te']
export const dayIndex = key => Math.round(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86400000)
export function dailyFor(key) {
  const i = dayIndex(key)
  return { key, pos: DC_POS[i % DC_POS.length], mode: Math.floor(i / DC_POS.length) % 2 ? 'all-time' : 'classic', seed: `bap-daily-${key}` }
}

// ── A season's pool, traits and OVR, as App.jsx / BucketApp.jsx pick them ─────
export function seasonKit(sport, pos, mode) {
  if (sport === 'bucket') {
    const big = pos === 'big', allTime = mode === 'all-time', types = big ? BIG_TYPES : GUARD_TYPES
    return {
      pool: allTime ? (big ? NBA_ALLTIME_BIG_PLAYERS : NBA_ALLTIME_GUARD_PLAYERS) : (big ? NBA_BIG_PLAYERS : NBA_GUARD_PLAYERS),
      types, teams: NBA_TEAMS, ovr: b => calcBucketOVR(b, types, big ? 'big' : 'guard'),
    }
  }
  const lite = mode === 'lite', allTime = mode === 'all-time'
  const k = {
    qb: { pool: allTime ? LEGENDS : QBS, types: lite ? LITE_TYPES : allTime ? LEGEND_TYPES : TYPES, ovr: (b, t) => calcOVR(b, t) },
    rb: { pool: allTime ? RB_LEGENDS : RBS, types: lite ? RB_LITE_TYPES : RB_TYPES, ovr: (b, t) => calcOVRRB(b, t) },
    wr: { pool: allTime ? WR_LEGENDS : WRS, types: lite ? WR_LITE_TYPES : WR_TYPES, ovr: (b, t) => calcOVRWR(b, t) },
    te: { pool: allTime ? TE_LEGENDS : TES, types: lite ? TE_LITE_TYPES : TE_TYPES, ovr: (b, t) => calcOVRTE(b, t) },
    // runDBSimulation / OL work the OVR out on their full trait lists, lite or not
    db: { pool: allTime ? DB_LEGENDS : DBS, types: lite ? DB_LITE_TYPES : DB_TYPES, ovr: b => calcOVRDB(b) },
    ol: { pool: OLS, types: lite ? OL_LITE_TYPES : OL_TYPES, ovr: b => calcOVROL(b) },
  }[pos]
  return k ? { ...k, teams: TEAMS, ovr: b => k.ovr(b, k.types) } : null
}

const nameOf = c => (typeof c?.qbFull === 'string' ? c.qbFull : typeof c?.qb === 'string' ? c.qb : typeof c?.name === 'string' ? c.name : null)
const findIn = (pool, name, team) => pool.find(p => p.name === name && (!team || p.team === team)) ?? pool.find(p => p.name === name) ?? null

// Every trait filled by a real player at that player's real rating. Returns the build
// the server believes, or why not (a missing trait, an unknown player, an edited rating)
export function realBuild(kit, sent) {
  if (!kit || !sent || typeof sent !== 'object') return { error: 'no build' }
  const build = {}
  for (const t of kit.types) {
    const c = sent[t], name = nameOf(c)
    if (!name) return { error: `missing ${t}` }
    const p = findIn(kit.pool, name, c.team)
    const val = p?.attrs?.[t]
    if (typeof val !== 'number') return { error: `unknown player for ${t}` }
    if (c.val != null && Number(c.val) !== val) return { error: `edited rating for ${t}` }
    build[t] = { type: t, val, qbFull: p.name, team: p.team }
  }
  return { build }
}

// A season's row: a real build, and the OVR it really has
export function checkSeason({ sport, pos, mode, build }) {
  const kit = seasonKit(sport, pos, mode)
  if (!kit) return { error: 'unknown position' }
  const r = realBuild(kit, build)
  if (r.error) return r
  return { ovr: Math.max(0, Math.min(99, Math.round(kit.ovr(r.build) ?? 0))), build: r.build }
}

// ── The Daily: a real build that the day's seeded spins could have dealt ─────
// SpinScreen (dailyPlan): spin #i lands on the ith team of the day's order (a team
// respin is just the next spin), the player is the first of that team's seeded order,
// and a player respin the next one in the same order. One player respin a build.
const DAILY_SLACK = 6     // spins past one a trait: a team respin, a reload mid-spin, a spin never placed
export function checkDaily(day, sent) {
  const dc = dailyFor(day)
  const kit = seasonKit('nfl', dc.pos, dc.mode)
  const r = realBuild(kit, sent)
  if (r.error) return r
  const draftable = new Set(kit.pool.map(p => p.team))
  const reel = (kit.teams.some(t => draftable.has(t.short)) ? kit.teams.filter(t => draftable.has(t.short)) : kit.teams)
    .slice().sort((a, b) => a.short.localeCompare(b.short))
  const order = seededShuffle(reel, `${dc.seed}:teams`)
  // every (spin, draw) and who it deals
  const deals = []
  for (let i = 0; i < kit.types.length + DAILY_SLACK; i++) {
    const team = order[i % order.length]
    const roster = kit.pool.filter(q => q.team === team.short).sort((a, b) => a.name.localeCompare(b.name))
    if (!roster.length) continue
    const o = seededShuffle(roster, `${dc.seed}:${i}:${team.short}`)
    for (const d of [0, 1]) deals.push({ i, d, name: o[d % o.length].name })
  }
  // match each trait to its own spin; at most one of them a player respin
  const traits = kit.types
  const used = new Set()
  const fit = (k, respins) => {
    if (k === traits.length) return true
    const name = r.build[traits[k]].qbFull
    for (const x of deals) {
      if (x.name !== name || used.has(x.i) || (x.d && respins >= 1)) continue
      used.add(x.i)
      if (fit(k + 1, respins + x.d)) return true
      used.delete(x.i)
    }
    return false
  }
  if (!fit(0, 0)) return { error: 'not the day\'s spins' }
  return { ovr: Math.max(0, Math.min(99, Math.round(kit.ovr(r.build) ?? 0))), build: r.build, pos: dc.pos, mode: dc.mode }
}

// ── Takeover Duo: the partner's build, as the host's phone will play it ───────
// Real players only, at no more than their real rating plus a bonus (ON FIRE's +1);
// anything else plays at the real rating, an unknown name as a free agent (3).
export function cleanPartnerBuild(sport, pos, build, bonus = 1) {
  if (!build || typeof build !== 'object') return { build: {}, changed: true }
  const kits = ['classic', 'all-time'].map(m => seasonKit(sport, pos, m)).filter(Boolean)
  const pool = kits.flatMap(k => k.pool)
  let changed = false
  const out = {}
  for (const [t, c] of Object.entries(build)) {
    if (!c) { out[t] = c; continue }
    const name = nameOf(c)
    const p = name ? findIn(pool, name, c.team) : null
    const real = p?.attrs?.[t]
    const v = Number(c.val)
    const ok = typeof real === 'number' ? Math.max(0, Math.min(11, Math.min(Number.isFinite(v) ? v : real, real + bonus))) : 3
    if (ok !== v) changed = true
    out[t] = { ...c, val: ok, ...(typeof real === 'number' ? {} : { qbFull: 'Free agent' }) }
  }
  return { build: out, changed, ovr: changed && kits[0] ? Math.round(kits[0].ovr(out) ?? 0) : null }
}
