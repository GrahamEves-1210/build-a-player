// What the live server checks before a result reaches a public board (live/src/submit.js).
// Pure: no React, no storage, no network. A phone only says WHICH player filled each
// trait; every rating is looked up in the real data and every OVR is worked out here,
// the same way the game works it out (the run*Simulation functions).

import { seededShuffle } from './rng'
import { calcOVR, calcOVRRB, calcOVRWR, calcOVRTE, calcOVRDB, calcOVROL, runSimulation } from '../utils/simulation'
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
import { TEAMS, NFL_TEAMS } from '../data/nfl-teams'
import { NBA_TEAMS } from '../data/nba-teams'
import { QB_SAL_POOL, QB_SAL_COLS } from '../data/qb-salary'
import { BUCKET_SAL_POOL, SAL_COLS, salTypesFor, playerPosGroup } from '../data/nba-salary'
import { salaryKit, TIERS, TIER_BANDS, BUDGET_OPTIONS, RECENT_PENALTY, budgetForDateStr, yesterdaySeedOf } from './salaryCore'

// ── The Daily Challenge (lib/progress.js uses these too) ─────────────────────
// Everyone gets the same seeded spins each day; the sport, position and mode follow the
// date. From DC_BOTH on, the days alternate football and basketball (football's positions
// and basketball's guard / big each take their turn, Current then All-Time); before it,
// every day was football.
export const DC_POS = ['qb', 'wr', 'rb', 'db', 'te']
export const DC_BUCKET_POS = ['guard', 'big']
export const DC_BOTH = '2026-10-23'
export const dayIndex = key => Math.round(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86400000)
export function dailyFor(key) {
  const i = dayIndex(key), seed = `bap-daily-${key}`
  if (key < DC_BOTH) return { key, sport: 'nfl', pos: DC_POS[i % DC_POS.length], mode: Math.floor(i / DC_POS.length) % 2 ? 'all-time' : 'classic', seed }
  const j = Math.floor((i - dayIndex(DC_BOTH)) / 2)
  if ((i - dayIndex(DC_BOTH)) % 2) return { key, sport: 'bucket', pos: DC_BUCKET_POS[j % 2], mode: Math.floor(j / 2) % 2 ? 'all-time' : 'classic', seed }
  return { key, sport: 'nfl', pos: DC_POS[j % DC_POS.length], mode: Math.floor(j / DC_POS.length) % 2 ? 'all-time' : 'classic', seed }
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
  const kit = seasonKit(dc.sport, dc.pos, dc.mode)
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
  return { ovr: Math.max(0, Math.min(99, Math.round(kit.ovr(r.build) ?? 0))), build: r.build, pos: dc.pos, mode: dc.mode, sport: dc.sport }
}

// ── Salary Cap: picks off a real board, inside the budget, at the score they make ──────
// A play sends its five picks ({ name, price } per column, in column order). A daily play
// must be dealable from that day's board (lib/salaryCore.js; or the copy the day froze,
// when it checks out), with at most one shuffle (a column's five players reordered and
// repriced, or one price tier's five players moved across columns); an Infinite play
// (a board nobody kept) must put every player at the price their ratings earn, with the
// same one-shuffle allowance. The score is worked out here, the way the game works it out.
const SAL = {
  nfl: { cols: QB_SAL_COLS, pool: QB_SAL_POOL, kit: salaryKit({ typesFor: (p, col) => col.types }), typesFor: (p, col) => col.types },
  bucket: { cols: SAL_COLS, pool: BUCKET_SAL_POOL, kit: salaryKit({ typesFor: salTypesFor }), typesFor: salTypesFor },
}
const salTier = price => TIERS.indexOf(Number(price))
// picks legal on a board: as dealt, or with one column / one tier shuffled
function legalOn(grid, picks) {
  const at = (ci, p) => grid[ci]?.[salTier(p.price)]?.name === p.name
  if (picks.every((p, ci) => at(ci, p))) return true
  for (let c = 0; c < picks.length; c++) {
    if (picks.every((p, ci) => (ci === c ? grid[c].some(x => x.name === p.name) : at(ci, p)))) return true
  }
  for (let t = 0; t < TIERS.length; t++) {
    if (picks.every((p, ci) => (salTier(p.price) === t ? grid.some(col => col[t]?.name === p.name) : at(ci, p)))) return true
  }
  return false
}
// The tier a player's ratings earn in a column (Infinite boards: nobody marked down)
function naturalTier(S, p, col) {
  const regulars = S.pool.filter(x => !x.legend)
  if (p.legend) return S.kit.legendTierFor(p, col, regulars)
  const ranked = regulars.map(x => [x.name, S.kit.catScore(x, col)]).sort((a, b) => b[1] - a[1]).map(x => x[0])
  const r = ranked.indexOf(p.name), n = ranked.length
  return TIER_BANDS.findIndex(([lo, hi]) => r >= Math.floor(lo * n) && r < Math.max(Math.floor(lo * n) + 1, Math.floor(hi * n)))
}
function legalInfinite(S, picks, real) {
  const fits = (ci, p) => { const t = naturalTier(S, real[ci], S.cols[ci]); return real[ci].legend ? Math.abs(t - salTier(p.price)) <= 1 : t === salTier(p.price) }
  if (picks.every((p, ci) => fits(ci, p))) return true
  for (let c = 0; c < picks.length; c++) if (picks.every((p, ci) => ci === c || fits(ci, p))) return true
  for (let t = 0; t < TIERS.length; t++) {
    if (picks.every((p, ci) => (salTier(p.price) === t ? S.cols.some(col => naturalTier(S, real[ci], col) === t) : fits(ci, p)))) return true
  }
  return false
}
// The day's frozen copy, as the game accepts it (QBSalaryCap.jsx trustedFrozen): real players
// at real ratings, at most 2 legends, and no star in a tier far cheaper than their rank
function trustedFrozen(S, frozen, date) {
  if (!Array.isArray(frozen) || frozen.length !== S.cols.length || !frozen.every(c => Array.isArray(c) && c.length === TIERS.length)) return false
  const recent = S.kit.getPickedNamesForSeed(yesterdaySeedOf(date), S.cols, S.pool)
  const regulars = S.pool.filter(p => !p.legend)
  let legends = 0
  for (let ci = 0; ci < frozen.length; ci++) {
    const col = S.cols[ci]
    const ranked = regulars.map(p => [p.name, S.kit.catScore(p, col) - (recent.has(p.name) ? RECENT_PENALTY : 0)]).sort((x, y) => y[1] - x[1]).map(x => x[0])
    for (let ti = 0; ti < TIERS.length; ti++) {
      const cell = frozen[ci][ti]
      if (!cell || cell.price !== TIERS[ti] || typeof cell.name !== 'string') return false
      const real = S.pool.find(p => p.name === cell.name && p.team === cell.team) ?? S.pool.find(p => p.name === cell.name)
      if (!real || Object.entries(cell.attrs || {}).some(([k, v]) => v !== (real.attrs?.[k] ?? 5))) return false
      if (real.legend) { if (++legends > 2) return false; continue }
      if (ranked.indexOf(real.name) / Math.max(1, ranked.length) < TIER_BANDS[ti][0] - 0.2) return false
    }
  }
  return true
}
const clampN = (v, lo, hi) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.max(lo, Math.min(hi, Number(v))) : null)
// sport 'nfl' | 'bucket'; pos: the app's position (basketball scores a big's or a guard's
// traits); frozen: the day's frozen board if there is one; sent: what the phone reported
// (an Infinite play's season stats, which can't be replayed)
export function checkSalaryCap({ sport, date, infinite = false, picks, pos = 'guard', frozen = null, sent = {} }) {
  const S = SAL[sport === 'bucket' ? 'bucket' : 'nfl']
  if (!Array.isArray(picks) || picks.length !== S.cols.length) return { error: 'five picks' }
  const real = []
  for (let ci = 0; ci < picks.length; ci++) {
    const p = picks[ci]
    if (!p || typeof p.name !== 'string' || salTier(p.price) < 0) return { error: 'bad pick' }
    const r = S.pool.find(x => x.name === p.name && (!p.team || x.team === p.team)) ?? S.pool.find(x => x.name === p.name)
    if (!r) return { error: `unknown player ${p.name}` }
    real.push(r)
  }
  const spent = picks.reduce((s, p) => s + Number(p.price), 0)
  if (spent > (infinite ? Math.max(...BUDGET_OPTIONS) : budgetForDateStr(date))) return { error: 'over the budget' }
  if (infinite) { if (!legalInfinite(S, picks, real)) return { error: 'not off a board' } }
  else if (!legalOn(S.kit.dailyGrid(S.cols, S.pool, date), picks) && !(frozen && trustedFrozen(S, frozen, date) && legalOn(frozen, picks))) return { error: "not on the day's board" }
  // the board shows each pick's card: its photo (only the game's own headshots), colors, number
  const okPhoto = u => typeof u === 'string' && /^(https:\/\/cdn\.jsdelivr\.net\/gh\/GrahamEves-1210\/build-a-player@main\/public\/headshots\/|\/headshots\/)[\w./-]+$/.test(u) ? u : null
  const okColor = c => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : null)
  const clean = picks.map((p, ci) => ({ name: real[ci].name, team: real[ci].team, price: Number(p.price), photo: okPhoto(p.photo), teamColor: okColor(p.teamColor), number: Number.isInteger(p.number) && p.number >= 0 && p.number <= 99 ? p.number : null }))

  if (S === SAL.nfl) {
    // QBSalaryCap.jsx buildFromSel: each column's traits at the player's real ratings
    const build = {}
    S.cols.forEach((col, ci) => col.types.forEach(type => { build[type] = { type, val: real[ci].attrs?.[type] ?? 5, qb: real[ci].name, qbFull: real[ci].name, team: real[ci].team } }))
    TYPES.forEach(type => { if (!build[type]) build[type] = { ...build[S.cols[0].types[0]], type, val: real[0].attrs?.[type] ?? 5 } })
    if (infinite) {
      return { row: { picks: clean, overall_score: Math.round(calcOVR(build, TYPES) ?? 0), budget_used: spent,
        pass_yds: clampN(sent.pass_yds, 0, 7000), pass_tds: clampN(sent.pass_tds, 0, 70), ints: clampN(sent.ints, 0, 40) } }
    }
    // the daily season: the date's team on the date's RNG (App.jsx handleQBSalaryConfirm)
    const dateSeed = parseInt(date.replace(/-/g, ''), 10)
    let h = dateSeed | 0; h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) | 0; h ^= h >>> 16
    const team = NFL_TEAMS[Math.floor(((h >>> 0) / 0x100000000) * NFL_TEAMS.length)]
    const realRandom = Math.random
    let s = dateSeed | 0
    Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
    let result
    try { result = runSimulation(build, TYPES, team, false) } finally { Math.random = realRandom }
    return { row: { picks: clean, overall_score: result.ovr, budget_used: spent, pass_yds: result.seasonPassYds ?? null, pass_tds: result.seasonTDs ?? null, ints: result.seasonINTs ?? null } }
  }

  // basketball (BucketSalaryCap.jsx buildFromSel + BucketApp.jsx handleSalaryCapConfirm)
  const cardAttrs = ci => Object.fromEntries(S.typesFor(real[ci], S.cols[ci]).map(t => [t, real[ci].attrs?.[t] ?? 5]))
  const build = {}
  S.cols.forEach((col, ci) => {
    const a = cardAttrs(ci)
    col.guardTypes.forEach(type => { build[type] = { type, val: a[type] ?? col.bigTypes.map(t => a[t]).find(v => v != null) ?? 5, qbFull: real[ci].name, team: real[ci].team } })
  })
  const avg = k => { const v = real.map(p => p.attrs?.[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 5 }
  for (const k of ['basketballIQ', 'clutch', 'rebounding']) build[k] = { type: k, val: avg(k), qbFull: real[4].name, team: real[4].team }
  const types = pos === 'big' ? BIG_TYPES : GUARD_TYPES
  const capPos = playerPosGroup(real[4]) === 'big' ? 'big' : 'guard'
  const fallback = build.passing ?? build.playmaking ?? Object.values(build)[0]
  types.forEach(t => { if (!build[t]) build[t] = { ...fallback, type: t } })
  if (capPos === 'big') {
    if (build.perimeterDefense) build.interiorDefense = { ...build.perimeterDefense, type: 'interiorDefense' }
    if (!build.playmaking) build.playmaking = { ...(build.passing ?? fallback), type: 'playmaking' }
  }
  // the board's stat line (BucketSalaryCap.jsx calcStats: each column's best card rating)
  const best = ci => Math.max(...Object.values(cardAttrs(ci)))
  const [f, sh, , pl, sz] = [0, 1, 2, 3, 4].map(best)
  return { row: { picks: clean, overall_score: Math.round(calcBucketOVR(build, types, capPos) ?? 0), budget_used: spent,
    ppg: +((f + sh) / 2 * 2.6 + 1.8).toFixed(1), apg: +(pl * 0.8 + 0.5).toFixed(1), rpg: +(sz * 1.0 + 1.2).toFixed(1) } }
}
