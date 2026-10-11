// App-only progression: XP + levels, coins + the shop, achievements, the daily
// login streak, three daily missions, the Daily Challenge and the card collection. Started from main.jsx
// when IS_APP; the games only fire window events and this file listens:
//   'bap:season' { sport, pos, mode, wins, losses, playoffs, champion, award, ovr, sandbox, daily }
//   'bap:spin'   { sport, pos, mode, player, pool }          (a player was revealed)
// It announces changes with 'bap:progress' and reveals with 'bap:card' / 'bap:toast'.
//
// Everything lives on the device, per account ("guest" when signed out). A
// signed-in player's season XP is rebuilt from their saved seasons (count
// queries), so it follows them to a new phone; seasons played since the last
// rebuild are held as "pending" until the database counts include them.

import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { getUsername } from './discord'
import { itemById, forSale, DEFAULTS, ITEMS } from './cosmetics'
import { ACHIEVEMENTS, achById } from './achievements'
import { IS_APP } from './platform'

// ── Days (America/New_York, same as the Salary Cap daily) ────────────────────
const NY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const nyParts = (t = Date.now()) => Object.fromEntries(NY.formatToParts(new Date(t)).map(p => [p.type, p.value]))
export function dayKey(offsetDays = 0) {
  const p = nyParts(Date.now() + offsetDays * 86400000)
  return `${p.year}-${p.month}-${p.day}`
}
export const dayIndex = key => Math.round(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86400000)
export function msToReset() {
  const p = nyParts()
  return Math.max(0, 86400000 - ((+p.hour * 60 + +p.minute) * 60 + +p.second) * 1000)
}

// ── Seeded randomness lives in rng.js (re-exported for the Daily Challenge) ──
export { seeded, seededShuffle } from './rng'
import { seeded } from './rng'

// ── Levels, titles, unlocks ──────────────────────────────────────────────────
// XP to go from level L to L+1 = 200 + 75·(L−1): early levels come in a few
// sessions, the later ones (and their unlocks) take weeks of regular play
export const xpForLevel = L => 200 * (L - 1) + 75 * (L - 1) * (L - 2) / 2
const TITLES = [[60, 'GOAT'], [45, 'Hall of Famer'], [30, 'MVP'], [20, 'All-Pro'], [10, 'Pro Bowler'], [5, 'Starter'], [1, 'Rookie']]
export const titleFor = L => TITLES.find(([min]) => L >= min)[1]
export const TITLE_LEVELS = TITLES.map(([lvl, name]) => ({ level: lvl, name })).reverse()
export function levelInfo(xp) {
  let L = 1
  while (xpForLevel(L + 1) <= xp) L++
  const base = xpForLevel(L), need = xpForLevel(L + 1) - base
  return { level: L, into: xp - base, need, pct: (xp - base) / need, title: titleFor(L) }
}

// Stage spotlight colours (home stage, avatar ring, player card)
export const SPOTLIGHTS = [
  { id: 'classic',  name: 'Classic',  level: 1 },
  { id: 'gold',     name: 'Gold',     level: 5 },
  { id: 'ice',      name: 'Ice',      level: 10 },
  { id: 'crimson',  name: 'Crimson',  level: 15 },
  { id: 'onyx',     name: 'Onyx',     level: 20 },
  { id: 'royal',    name: 'Royal',    level: 30 },
  { id: 'holo',     name: 'Holo',     level: 45 },
  { id: 'inferno',  name: 'Inferno',  streak: 7 },
  { id: 'platinum', name: 'Platinum', streak: 21 },
]

// What climbing from level `from` to `level` brings: titles and spotlights
// (a big season or a claim can skip a level, so it's a range)
export function levelUnlocks(level, from = level - 1) {
  const inRange = l => l > Math.max(1, from) && l <= level
  return {
    title: TITLE_LEVELS.filter(t => inRange(t.level)).at(-1)?.name ?? null,
    spots: SPOTLIGHTS.filter(s => s.level && inRange(s.level)),
  }
}

// ── Season XP ────────────────────────────────────────────────────────────────
// Same weights the rebuild from saved seasons uses (see sync), so a season is
// worth the same either way.
export const XP = { season: 20, winning: 15, playoffs: 25, ring: 100, award: 60 }
export function seasonLines(d) {
  const winning = d.sport === 'bucket' ? d.wins >= 50 : d.wins >= 10
  const lines = [{ label: 'Season played', xp: XP.season }]
  if (winning) lines.push({ label: 'Winning season', xp: XP.winning })
  if (d.playoffs && d.sport !== 'bucket') lines.push({ label: 'Made the playoffs', xp: XP.playoffs })
  if (d.champion) lines.push({ label: d.sport === 'bucket' ? 'NBA Champions' : 'Super Bowl Champions', xp: XP.ring })
  if (d.award) lines.push({ label: d.awardName ? `${d.awardName} award` : 'Season award', xp: XP.award })
  return lines
}

// ── Missions ─────────────────────────────────────────────────────────────────
const MISSIONS = {
  seasons2:  { tier: 0, goal: 2,  xp: 60,  text: 'Simulate 2 seasons',           on: { season: () => 1 } },
  spins12:   { tier: 0, goal: 12, xp: 50,  text: 'Spin 12 players',              on: { spin: () => 1 } },
  cards3:    { tier: 0, goal: 3,  xp: 60,  text: 'Collect 3 new cards',          on: { card: d => d.isNew ? 1 : 0 } },
  alltime1:  { tier: 0, goal: 1,  xp: 50,  text: 'Play an All-Time season',      on: { season: d => d.mode === 'all-time' ? 1 : 0 } },
  bucket1:   { tier: 0, goal: 1,  xp: 50,  text: 'Play a Build-A-Bucket season', on: { season: d => d.sport === 'bucket' ? 1 : 0 } },
  daily1:    { tier: 0, goal: 1,  xp: 60,  text: 'Play the Daily Challenge',     on: { season: d => d.daily ? 1 : 0 } },
  compete1:  { tier: 0, goal: 1,  xp: 70,  text: 'Play a Compete pool',          on: { compete: () => 1 } },
  online1:   { tier: 0, goal: 1,  xp: 60,  text: 'Play any online game',         on: { compete: () => 1, bt: () => 1, h2h: () => 1 } },
  seasons4:  { tier: 1, goal: 4,  xp: 100, text: 'Simulate 4 seasons',           on: { season: () => 1 } },
  playoffs1: { tier: 1, goal: 1,  xp: 80,  text: 'Make the playoffs',            on: { season: d => d.playoffs ? 1 : 0 } },
  ovr85:     { tier: 1, goal: 1,  xp: 90,  text: 'Build an 85+ OVR player',      on: { season: d => d.ovr >= 85 ? 1 : 0 } },
  winning2:  { tier: 1, goal: 2,  xp: 90,  text: 'Post 2 winning seasons',       on: { season: d => (d.sport === 'bucket' ? d.wins >= 50 : d.wins >= 10) ? 1 : 0 } },
  epic1:     { tier: 1, goal: 1,  xp: 80,  text: 'Pull an Epic or Legend card',  on: { card: d => d.rank >= 2 ? 1 : 0 } },
  top3:      { tier: 1, goal: 1,  xp: 100, text: 'Finish top 3 in a Compete pool', on: { compete: d => d.place <= 3 ? 1 : 0 } },
  bt1:       { tier: 1, goal: 1,  xp: 90,  text: 'Play a Blacktop game',         on: { bt: () => 1 } },
  h2h1:      { tier: 1, goal: 1,  xp: 90,  text: 'Play a Blacktop 1v1',      on: { h2h: () => 1 } },
  compete2:  { tier: 1, goal: 2,  xp: 110, text: 'Play 2 Compete pools',         on: { compete: () => 1 } },
  ring1:     { tier: 2, goal: 1,  xp: 150, text: 'Win a championship',           on: { season: d => d.champion ? 1 : 0 } },
  ovr90:     { tier: 2, goal: 1,  xp: 140, text: 'Build a 90+ OVR player',       on: { season: d => d.ovr >= 90 ? 1 : 0 } },
  award1:    { tier: 2, goal: 1,  xp: 130, text: 'Win a season award',           on: { season: d => d.award ? 1 : 0 } },
  legend1:   { tier: 2, goal: 1,  xp: 120, text: 'Pull a Legend card',           on: { card: d => d.rank >= 3 ? 1 : 0 } },
  cpwin1:    { tier: 2, goal: 1,  xp: 160, text: 'Win a Compete pool',           on: { compete: d => d.place === 1 ? 1 : 0 } },
  btwin1:    { tier: 2, goal: 1,  xp: 150, text: 'Win a Blacktop game',          on: { bt: d => d.won ? 1 : 0 } },
  h2hwin1:   { tier: 2, goal: 1,  xp: 150, text: 'Win a Blacktop 1v1',       on: { h2h: d => d.won ? 1 : 0 } },
}
export const missionDef = id => MISSIONS[id]
// One easy, one medium, one hard — each about something different (seasons / spins / cards)
function pickMissions(key) {
  const r = seeded(`missions-${key}`)
  const kinds = new Set()
  return [0, 1, 2].map(tier => {
    const all = Object.keys(MISSIONS).filter(id => MISSIONS[id].tier === tier)
    const fresh = all.filter(id => !kinds.has(Object.keys(MISSIONS[id].on)[0]))
    const ids = fresh.length ? fresh : all
    const id = ids[Math.floor(r() * ids.length)]
    kinds.add(Object.keys(MISSIONS[id].on)[0])
    return id
  })
}

export const STREAK_REWARDS = [
  { days: 3,  xp: 200 },
  { days: 7,  xp: 500,  unlock: 'inferno' },
  { days: 21, xp: 1200, unlock: 'platinum' },
]
export const LOGIN_XP = 25

// ── Daily Challenge ──────────────────────────────────────────────────────────
// Everyone gets the same position, mode and spins for the day.
const DC_POS = ['qb', 'wr', 'rb', 'db', 'te']
export function dailyChallenge(key = dayKey()) {
  const i = dayIndex(key)
  return { key, pos: DC_POS[i % DC_POS.length], mode: Math.floor(i / DC_POS.length) % 2 ? 'all-time' : 'classic', seed: `bap-daily-${key}` }
}

// ── Card rarity (a player's rank within their own pool) ──────────────────────
export const RARITIES = ['Common', 'Rare', 'Epic', 'Legend']
const avgAttr = p => { const v = Object.values(p?.attrs || {}).filter(x => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }
const rankCache = new WeakMap()
export function rarityRank(pool, player) {
  if (!pool?.length || !player) return 0
  let ranks = rankCache.get(pool)
  if (!ranks) {
    const sorted = [...pool].sort((a, b) => avgAttr(b) - avgAttr(a))
    ranks = new Map(sorted.map((p, i) => {
      const pct = i / sorted.length
      return [`${p.name}|${p.team}`, pct < 0.06 ? 3 : pct < 0.2 ? 2 : pct < 0.5 ? 1 : 0]
    }))
    rankCache.set(pool, ranks)
  }
  return ranks.get(`${player.name}|${player.team}`) ?? 0
}
export const cardKey = (sport, pos, mode, name, team) => `${sport}|${pos}|${mode === 'all-time' ? 'at' : 'cur'}|${name}|${team}`

// ── Store ────────────────────────────────────────────────────────────────────
const blank = () => ({
  v: 1,
  bonusXp: 0,                 // missions, streak, login, new cards (device only)
  seasonXp: 0,                // guest seasons
  sync: null,                 // { xp, at, ... } rebuilt from saved seasons (signed in)
  pending: [],                // [{ at, xp }] signed-in seasons since the last rebuild
  adjust: 0,                  // keeps the total from dropping when a rebuild lands lower
  cards: {},                  // cardKey → [count, firstSeen]
  cardsSynced: false,
  mergedGuest: false,
  streak: { last: null, count: 0, best: 0, start: null, claimed: {} },
  day: null,                  // { key, missions: [{ id, n, claimed }] }
  dc: null,                   // { key, spins, ovr, done, posted }
  sets: {},                   // binder team sets whose reward was claimed
  unlocks: {},
  spot: 'classic',
  seenLevel: 0,
  stats: { ...BLANK_STATS },
  // coins + the shop (app)
  coins: 0,
  coinsEarned: 0,
  owned: {},                  // itemId → when it was bought / earned
  equip: { ...DEFAULTS },     // slot → itemId
  shopFree: null,             // day the free daily coins were claimed
  discordPaid: false,         // the one-time Join the Discord coins
  feedbackPaid: false,        // the one-time Send Feedback coins
  adDay: null, adN: 0,        // videos watched for coins today (3 a day)
  levelPaid: 0,               // highest level already paid out in coins
  // achievements
  ach: {},                    // id → when it was unlocked
  achClaimed: {},             // id → when its reward was claimed
  walletAt: 0,                // last change to coins/items/achievements (server sync)
})
const BLANK_STATS = {
  seasons: 0, rings: 0, spins: 0, best: 0,
  wins: 0, winning: 0, playoffs: 0, awards: 0, perfect: 0, ovr90: 0, ovr95: 0, allTime: 0,
  nflSeasons: 0, bucketSeasons: 0, positions: {}, daily: 0, legends: 0,
  btGames: 0, btWins: 0, btMvp: 0, tkCities: 0, tkRuns: 0, dcBest: 0, purchases: 0,
  // Compete pools: places are 1–5; avg place = placeSum / played
  compete: { played: 0, wins: 0, podiums: 0, placeSum: 0, ovrSum: 0, best: 0, streak: 0, bestStreak: 0, beaten: 0, recent: [] },
  // Blacktop career line (btGames / btWins / btMvp above are the long-standing counters)
  bt: { streak: 0, bestStreak: 0, pts: 0, ast: 0, reb: 0, stl: 0, blk: 0, fgm: 0, fga: 0, highPts: 0, recent: [] },
  // Blacktop 1v1 (the website also keeps vs_results; this follows the wallet)
  h2h: { played: 0, wins: 0, losses: 0, forfeits: 0, streak: 0, bestStreak: 0, recent: [] },
  // Online rating across the live modes (see rateOnline)
  online: { rating: 800, best: 800, played: 0 },
}
const ONLINE_KEYS = ['compete', 'bt', 'h2h', 'online']
const fixStats = st => { for (const k of ONLINE_KEYS) st[k] = { ...BLANK_STATS[k], ...(st[k] || {}) }; return st }
const keyFor = id => `bap_prog_${id || 'guest'}`
function load(id) {
  try {
    const saved = JSON.parse(localStorage.getItem(keyFor(id)) || '{}')
    const b = blank()
    return { ...b, ...saved, stats: fixStats({ ...b.stats, ...(saved.stats || {}), positions: { ...(saved.stats?.positions || {}) } }), equip: { ...DEFAULTS, ...(saved.equip || {}) } }
  } catch { return blank() }
}

// Items taken out of the shop: owners get the coins back, once per account (the
// flag syncs with the wallet), and anything equipped goes back to the default
const RETIRED = { 'snd-roar': 400 }        // Stadium Roar: a crowd, removed with the crowd sounds
function retireItems(st) {
  st.retired = st.retired || {}
  for (const [id, refund] of Object.entries(RETIRED)) {
    for (const [slot, on] of Object.entries(st.equip || {})) if (on === id) st.equip[slot] = DEFAULTS[slot] ?? null
    if (!st.owned?.[id]) continue
    delete st.owned[id]
    if (!st.retired[id]) { st.coins = (st.coins || 0) + refund; st.retired[id] = Date.now() }
  }
  return st
}

let uid = null
let user = null
let S = retireItems(load(null))
let snap = null
let lastSeason = null
const listeners = new Set()

// XP and levels need an account (app and website): a guest stays unranked
export const xpOpen = () => !!uid
// "+60 XP · +40 COINS" with whatever this player can actually earn ('' if nothing)
export const rewardText = (xp, coins) => [xp && xpOpen() ? `+${xp} XP` : '', coins && walletOpen() ? `+${coins} COINS` : ''].filter(Boolean).join(' · ')
function totalXp() {
  if (!uid) return 0
  const since = S.sync?.at ?? 0
  return S.bonusXp + (S.sync?.xp ?? 0) + S.pending.filter(p => p.at > since).reduce((a, p) => a + p.xp, 0) + S.adjust
}
function makeSnap() {
  const xp = totalXp()
  const lvl = levelInfo(xp)
  const claimable = ACHIEVEMENTS.filter(a => S.ach[a.id] && !S.achClaimed[a.id]).length
  return { ...S, xp, lvl, signedIn: !!uid, user, lastSeason, pro: isPro(), claimable, freeReady: S.shopFree !== dayKey() }
}
function emit(quiet = false) {
  payLevels()
  checkAch(quiet)
  try { localStorage.setItem(keyFor(uid), JSON.stringify(S)) } catch {}
  if (uid) { schedulePush(); pushCos() }   // pushCos only sends when the public profile changed
  snap = makeSnap()
  listeners.forEach(fn => fn())
  window.dispatchEvent(new CustomEvent('bap:progress'))
}
export const getProgress = () => (snap ??= makeSnap())
export function useProgress() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, getProgress)
}
// Toasts raised before the toast layer mounts (the login streak on launch) wait here
const toastQueue = []
const toast = detail => { toastQueue.push(detail); window.dispatchEvent(new CustomEvent('bap:toast')) }
export const takeToasts = () => toastQueue.splice(0)

// ── Day roll: streak + missions ──────────────────────────────────────────────
function rollDay() {
  const k = dayKey()
  const st = S.streak
  let changed = false
  if (st.last !== k) {
    if (st.last === dayKey(-1)) st.count += 1
    else { st.count = 1; st.start = k; st.claimed = {} }
    st.last = k
    st.best = Math.max(st.best, st.count)
    S.bonusXp += LOGIN_XP
    if (uid) toast({ kind: 'streak', title: st.count > 1 ? `${st.count}-DAY STREAK` : 'DAILY LOGIN', sub: `+${LOGIN_XP} XP` })
    changed = true
  }
  if (S.day?.key !== k) {
    S.day = { key: k, missions: pickMissions(k).map(id => ({ id, n: 0, claimed: false })) }
    changed = true
  }
  if (S.dc && S.dc.key !== k) { S.dc = null; changed = true }
  return changed
}

function bumpMissions(kind, d) {
  if (!S.day) return
  for (const m of S.day.missions) {
    const def = MISSIONS[m.id]
    const fn = def?.on[kind]
    if (!fn || m.n >= def.goal) continue
    const add = fn(d)
    if (!add) continue
    m.n = Math.min(def.goal, m.n + add)
    if (m.n >= def.goal && uid) toast({ kind: 'mission', title: 'MISSION COMPLETE', sub: def.text })
  }
}

export function claimMission(id) {
  const m = S.day?.missions.find(x => x.id === id)
  const def = MISSIONS[id]
  if (!m || m.claimed || m.n < def.goal) return 0
  m.claimed = true
  S.bonusXp += def.xp
  earn(missionCoins(def.xp), null, true)
  emit()
  return def.xp
}
export const missionCoins = xp => Math.round(xp * 0.3)
export function claimStreak(days) {
  const r = STREAK_REWARDS.find(x => x.days === days)
  if (!r || S.streak.count < days || S.streak.claimed[days]) return 0
  S.streak.claimed[days] = true
  S.bonusXp += r.xp
  earn(Math.round(r.xp / 4), null, true)
  if (r.unlock) S.unlocks[r.unlock] = true
  emit()
  return r.xp
}
// Completing a team's set in the binder (every player on that roster) pays once
export const setReward = size => Math.min(600, 10 * size)
export function claimSet(key, size) {
  S.sets ??= {}
  if (S.sets[key]) return 0
  S.sets[key] = true
  S.bonusXp += setReward(size)
  earn(Math.round(setReward(size) / 4), null, true)
  emit()
  return setReward(size)
}
export function isUnlocked(spot, level = getProgress().lvl.level) {
  if (spot.streak) return !!S.unlocks[spot.id]
  return level >= spot.level
}
export function setSpotlight(id) {
  S.spot = id
  applySpot()
  emit()
}
function applySpot() {
  document.documentElement.setAttribute('data-spot', S.spot || 'classic')
}
export function markLevelSeen() {
  const L = getProgress().lvl.level
  if (S.seenLevel !== L) { S.seenLevel = L; emit() }
}

// Seasons so far (saved seasons + this device's newer ones)
export function careerSeasons() {
  if (!uid) return S.stats.seasons
  const since = S.sync?.at ?? 0
  return (S.sync?.seasons ?? 0) + S.pending.filter(p => p.at > since).length
}

// Championships so far (saved seasons + this device's newer ones)
export function careerRings() {
  if (!uid) return S.stats.rings
  const since = S.sync?.at ?? 0
  return (S.sync?.rings ?? 0) + S.pending.filter(p => p.at > since && p.ring).length
}

// ── Daily Challenge state ────────────────────────────────────────────────────
export function dailyState() {
  const dc = dailyChallenge()
  if (!S.dc || S.dc.key !== dc.key) return { ...dc, spins: 0, done: false }
  return { ...dc, ...S.dc }
}
export function setDailySpins(n) {
  const dc = dailyChallenge()
  if (!S.dc || S.dc.key !== dc.key) S.dc = { key: dc.key, spins: 0, done: false }
  if (S.dc.done || n <= S.dc.spins) return
  S.dc.spins = n
  emit()
}
async function postDaily(ovr, pos, mode, build) {
  if (!uid || !supabase) return
  const { error } = await supabase.from('daily_challenge_results').insert({
    day: S.dc.key, user_id: uid, username: getUsername(user) || 'Player', ovr, position: pos, mode, build,
  })
  if (!error || error.code === '23505') { S.dc.posted = true; emit() }   // 23505: already posted today
}
export async function fetchDailyBoard(key = dayKey()) {
  if (!supabase) return { rows: [], error: true }
  const { data, error } = await supabase.from('daily_challenge_results')
    .select('user_id,username,ovr,created_at').eq('day', key)
    .order('ovr', { ascending: false }).order('created_at', { ascending: true }).limit(50)
  if (error) return { rows: [], error: true }
  return { rows: data ?? [] }
}

// ── Events from the games ────────────────────────────────────────────────────
function onSeason(e) {
  const d = e.detail || {}
  if (d.sandbox) {   // custom ratings: no XP, no rewards panel
    if (d.daily) toast({ kind: 'xp', title: 'DAILY NOT COUNTED', sub: 'Custom ratings were on for this build' })
    lastSeason = null; emit(); return
  }
  const before = totalXp()
  const lines = seasonLines(d)
  const xp = lines.reduce((a, l) => a + l.xp, 0)
  if (d.localOnly) S.bonusXp += xp                       // modes the database doesn't keep (Salary Cap)
  else if (uid) S.pending.push({ at: Date.now(), xp, ring: !!d.champion })
  else S.seasonXp += xp
  S.stats.seasons++
  if (d.champion) S.stats.rings++
  if (d.ovr > S.stats.best) S.stats.best = d.ovr
  const st = S.stats
  st.wins += d.wins ?? 0
  if (d.sport === 'bucket' ? d.wins >= 50 : d.wins >= 10) st.winning++
  if (d.playoffs) st.playoffs++
  if (d.award) st.awards++
  if (d.losses === 0 && d.wins > 0) st.perfect++
  if (d.ovr >= 90) st.ovr90++
  if (d.ovr >= 95) st.ovr95++
  if (d.mode === 'all-time') st.allTime++
  if (d.sport === 'bucket') st.bucketSeasons++; else { st.nflSeasons++; if (d.pos) st.positions[d.pos] = 1 }
  if (d.daily) st.daily++
  const coins = seasonCoins(d)
  earn(coins, null, true)
  const missionsBefore = (S.day?.missions ?? []).map(m => m.n)
  bumpMissions('season', d)
  if (d.daily) {
    const dc = dailyChallenge()
    if (!S.dc || S.dc.key !== dc.key) S.dc = { key: dc.key, spins: 0, done: false }
    if (!S.dc.done) {
      S.dc.done = true
      S.dc.ovr = d.ovr
      postDaily(d.ovr, d.pos, d.mode, d.build ?? null)
    }
  }
  lastSeason = {
    id: Date.now(), ref: d.ref ?? null, lines, xp, before, after: before + xp, coins: walletOpen() ? coins : 0,
    missions: (S.day?.missions ?? []).map((m, i) => ({ ...m, before: missionsBefore[i] ?? 0, def: MISSIONS[m.id] })),
  }
  emit()
}

// Live modes hand out XP directly ({ xp, label })
function onXp(e) {
  const { xp, label, coins } = e.detail || {}
  if (!xp && !coins) return
  S.bonusXp += xp || 0
  if (coins) earn(coins, null, true)
  const t = rewardText(xp, coins)
  if (t) toast({ kind: 'xp', title: t, sub: label || '' })
  emit()
}

// ═════════════════════════════════════════════════════════════════════════════
// Online: rating, tiers and the live-mode bookers (Compete, Blacktop, 1v1)
// ═════════════════════════════════════════════════════════════════════════════
// One rating across the live modes. Wins against real players move it most;
// games where bots filled the seats count for less. Tiers are the ladder.
export const ONLINE_TIERS = [[0, 'Rookie'], [900, 'Starter'], [1100, 'Pro'], [1300, 'All-Star'], [1500, 'MVP'], [1750, 'Legend']]
export const tierFor = r => ONLINE_TIERS.reduce((t, x) => (r >= x[0] ? x : t), ONLINE_TIERS[0])
export const nextTier = r => ONLINE_TIERS.find(x => x[0] > r) ?? null
export const tierIndex = r => ONLINE_TIERS.findIndex(x => x === tierFor(r))
const ordinal = n => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? 'th'}`
const pushRecent = (arr, v, n = 10) => { arr.push(v); while (arr.length > n) arr.shift() }
// delta → rating; remembers the tier change for the toast / result screens
function rateOnline(delta, mode, extra = {}) {
  const o = S.stats.online = { ...BLANK_STATS.online, ...(S.stats.online || {}) }
  const before = o.rating
  o.rating = Math.max(100, Math.round(o.rating + delta))
  o.played++
  if (o.rating > o.best) o.best = o.rating
  const was = tierFor(before)[1], now = tierFor(o.rating)[1]
  const up = tierIndex(o.rating) > tierIndex(before), down = tierIndex(o.rating) < tierIndex(before)
  S.lastOnline = { mode, delta: o.rating - before, rating: o.rating, tier: now, up, down, at: Date.now(), ...extra }
  if (up) toast({ kind: 'online', title: `TIER UP · ${now.toUpperCase()}`, sub: `${o.rating} online rating`, ms: 3200 })
  else if (down) toast({ kind: 'online', title: `DOWN TO ${now.toUpperCase()}`, sub: `${o.rating} online rating`, ms: 2600 })
  void was
  return o.rating - before
}

// A Compete pool finished: your place → stats, rating, XP and coins
export const COMPETE_REWARDS = { 1: [80, 30], 2: [50, 18], 3: [35, 10], 4: [20, 5], 5: [15, 2] }
const COMPETE_RATING = { 1: 24, 2: 12, 3: 4, 4: -6, 5: -12 }
// Leaving a live pool: last place, a bigger rating hit, nothing earned
export const FORFEIT_RATING = -20
function onCompete(e) {
  const { place, ovr, of = 5, humans = 1, forfeit = false, mode = 'pool' } = e.detail || {}
  if (!place) return
  const what = mode === 'auction' ? 'auction' : 'pool'
  const c = S.stats.compete = { ...BLANK_STATS.compete, ...(S.stats.compete || {}) }
  if (forfeit) {
    c.played++; c.placeSum += of; c.streak = 0
    pushRecent(c.recent, of)
    const scale = 0.5 + 0.5 * Math.min(1, Math.max(0, humans - 1) / 4)
    rateOnline(FORFEIT_RATING * scale, 'compete', { place: of, forfeit: true, streak: 0 })
    emit()
    return
  }
  const pbOvr = (ovr || 0) > c.best && c.played > 0
  c.played++; c.placeSum += place; c.ovrSum += ovr || 0; c.beaten += Math.max(0, of - place)
  if (place === 1) { c.wins++; c.streak++; if (c.streak > c.bestStreak) c.bestStreak = c.streak } else c.streak = 0
  if (place <= 3) c.podiums++
  if ((ovr || 0) > c.best) c.best = ovr
  pushRecent(c.recent, place)
  // real opponents move the rating; a pool of bots counts half
  const scale = 0.5 + 0.5 * Math.min(1, Math.max(0, humans - 1) / 4)
  const delta = rateOnline((COMPETE_RATING[place] ?? -12) * scale, 'compete', { place, pbOvr, streak: c.streak })
  const [xp, coins] = COMPETE_REWARDS[place] ?? COMPETE_REWARDS[5]
  S.bonusXp += xp
  earn(coins, null, true)
  bumpMissions('compete', { place })
  toast({ kind: 'xp', title: rewardText(xp, coins) || (place === 1 ? `${what.toUpperCase()} WON` : `${ordinal(place).toUpperCase()} PLACE`), sub: `${place === 1 ? `You won the ${what}` : `Compete · ${ordinal(place)} place`} · ${delta >= 0 ? '+' : ''}${delta} rating` })
  emit()
}

// A Blacktop game finished: W/L, MVP, my box-score line → career line, rating
function onBlacktop(e) {
  const d = e.detail || {}
  S.stats.btGames++
  if (d.won) S.stats.btWins++
  if (d.mvp) S.stats.btMvp++
  const b = S.stats.bt = { ...BLANK_STATS.bt, ...(S.stats.bt || {}) }
  const line = d.line || {}
  const highPts = (line.pts || 0) > b.highPts && S.stats.btGames > 1
  for (const k of ['pts', 'ast', 'reb', 'stl', 'blk', 'fgm', 'fga']) b[k] += line[k] || 0
  if ((line.pts || 0) > b.highPts) b.highPts = line.pts
  if (d.won) { b.streak++; if (b.streak > b.bestStreak) b.bestStreak = b.streak } else b.streak = 0
  pushRecent(b.recent, d.won ? 'W' : 'L')
  const scale = d.bots ? 0.5 : 1
  // walked out of the run's build: a forfeit's hit, no mission credit
  rateOnline((d.forfeit ? FORFEIT_RATING : (d.won ? 20 : -12) + (d.mvp ? 5 : 0)) * scale, 'bt', { won: !!d.won, mvp: !!d.mvp, highPts, streak: b.streak, forfeit: !!d.forfeit })
  if (!d.forfeit) bumpMissions('bt', { won: !!d.won })
  emit()
}

// A 1v1 finished: 'win' | 'loss' | 'forfeit' | 'walkover' (they left)
function onH2H(e) {
  const { result, sport } = e.detail || {}
  if (!result) return
  const h = S.stats.h2h = { ...BLANK_STATS.h2h, ...(S.stats.h2h || {}) }
  const won = result === 'win' || result === 'walkover'
  h.played++
  if (won) { h.wins++; h.streak++; if (h.streak > h.bestStreak) h.bestStreak = h.streak } else { h.losses++; h.streak = 0; if (result === 'forfeit') h.forfeits++ }
  pushRecent(h.recent, won ? 'W' : 'L')
  const delta = rateOnline(result === 'win' ? 25 : result === 'walkover' ? 10 : result === 'forfeit' ? -20 : -15, 'h2h', { won, streak: h.streak, sport })
  if (result !== 'walkover') toast({ kind: 'online', title: won ? 'BLACKTOP 1V1 · W' : 'BLACKTOP 1V1 · L', sub: `${delta >= 0 ? '+' : ''}${delta} rating${h.streak >= 2 ? ` · ${h.streak} straight` : ''}` })
  bumpMissions('h2h', { won })
  emit()
}

function onSpin(e) {
  const { sport, pos, mode, player, pool } = e.detail || {}
  if (!player?.name) return
  S.stats.spins++
  bumpMissions('spin', {})
  if (!walletOpen()) { emit(); return }
  const k = cardKey(sport, pos, mode, player.name, player.team)
  const isNew = !S.cards[k]
  S.cards[k] = isNew ? [1, Date.now()] : [S.cards[k][0] + 1, S.cards[k][1]]
  const rank = rarityRank(pool, player)
  bumpMissions('card', { isNew, rank })
  if (isNew) { S.bonusXp += 2 + rank * 3; earn([1, 2, 5, 15][rank] ?? 1, null, true); if (rank >= 3) S.stats.legends++ }
  emit()
  window.dispatchEvent(new CustomEvent('bap:card', { detail: { isNew, rank, rarity: RARITIES[rank], name: player.name, team: player.team, sport, pos, mode, count: S.cards[k][0] } }))
}

// ── Rebuild season XP + cards from saved seasons (signed in) ─────────────────
let syncing = false
async function sync(force = false) {
  if (!uid || !supabase || syncing) return
  if (!force && S.sync && Date.now() - S.sync.at < 30 * 60 * 1000) return
  if (S.pending.some(p => Date.now() - p.at < 15000)) return     // a save may still be landing
  syncing = true
  const id = uid
  const startedAt = Date.now()
  try {
    const count = q => q.then(r => (r.error ? null : r.count ?? 0))
    const base = () => supabase.from('simulations').select('id', { count: 'exact', head: true }).eq('user_id', id)
    const [seasons, playoffs, rings, winning, bucketAwards, allPros, acct] = await Promise.all([
      count(base()),
      count(base().eq('playoffs', true)),
      count(base().eq('champion', true)),
      count(base().or('and(game_mode.like.bucket*,wins.gte.50),and(game_mode.not.like.bucket*,wins.gte.10)')),
      count(base().or('mvp.is.true,dpoy.is.true')),
      count(base().eq('season_award', 'allpro')),
      supabase.from('accounts').select('classic_mvps,alltime_mvps,classic_opoys,alltime_opoys,classic_dpoys,alltime_dpoys').eq('id', id).maybeSingle().then(r => r.data ?? {}, () => ({})),
    ])
    if (uid !== id || seasons == null) return
    const awards = Object.values(acct).reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0) + (bucketAwards ?? 0) + (allPros ?? 0)
    const xp = seasons * XP.season + (winning ?? 0) * XP.winning + (playoffs ?? 0) * XP.playoffs + (rings ?? 0) * XP.ring + awards * XP.award
    const beforeTotal = totalXp()
    S.sync = { xp, at: startedAt, seasons, playoffs, rings, awards }
    S.pending = S.pending.filter(p => p.at > startedAt)
    const after = totalXp()
    if (after < beforeTotal && S.seenLevel > 0) S.adjust += beforeTotal - after
    // Career import / a new device: no level-up fanfare for XP that was already earned
    S.seenLevel = Math.max(S.seenLevel, levelInfo(totalXp()).level)
    S.levelPaid = Math.max(S.levelPaid || 0, levelInfo(totalXp()).level)
    emit(true)
    if (!S.cardsSynced) syncCards(id)
  } finally { syncing = false }
}

// Seasons store the players each trait came from — seed the binder with them.
async function syncCards(id) {
  const { data, error } = await supabase.from('simulations')
    .select('build,game_mode,position').eq('user_id', id)
    .order('created_at', { ascending: false }).limit(800)
  if (error || uid !== id) return
  for (const row of data ?? []) {
    const gm = row.game_mode || 'classic'
    let sport = 'nfl', pos = 'qb', mode = gm.includes('all-time') ? 'all-time' : 'classic'
    if (gm.startsWith('bucket')) { sport = 'bucket'; pos = row.position === 'big' ? 'big' : 'guard' }
    else if (/^(rb|wr|te|db)-/.test(gm)) pos = gm.slice(0, 2)
    else if (gm.startsWith('ol-')) continue
    for (const v of Object.values(row.build || {})) {
      if (!v?.qb || !v.team) continue
      const k = cardKey(sport, pos, mode, v.qb, v.team)
      if (!S.cards[k]) S.cards[k] = [1, Date.now()]
    }
  }
  S.cardsSynced = true
  emit()
}

let loaded = false
function switchUser(u) {
  const id = u?.id ?? null
  user = u ?? null
  if (loaded && id === uid) { emit(); return }
  loaded = true
  const guestCards = id ? load(null).cards : null
  uid = id
  S = retireItems(load(id))
  if (id && !S.mergedGuest && guestCards) {
    for (const [k, v] of Object.entries(guestCards)) if (!S.cards[k]) S.cards[k] = v
    S.mergedGuest = true
  }
  rollDay()
  if (!S.seenLevel) S.seenLevel = levelInfo(totalXp()).level
  if (!S.levelPaid) S.levelPaid = levelInfo(totalXp()).level
  applySpot()
  emit(true)                 // achievements already earned unlock quietly (rewards wait in the list)
  sync()
  // coins bought on the website land after the wallet is pulled (so a newer remote wallet can't overwrite them)
  pullWallet(id).then(() => claimCoinPurchases())
  if (IS_APP) import('./iap').then(m => m.iapUser(id)).catch(() => {})
}

let started = false
export function initProgress() {
  if (started) return
  started = true
  applySpot()
  watchCoinReturn()
  window.addEventListener('bap:season', onSeason)
  window.addEventListener('bap:feedback-sent', () => claimFeedbackCoins())
  window.addEventListener('bap:spin', onSpin)
  window.addEventListener('bap:xp', onXp)
  window.addEventListener('bap:blacktop', onBlacktop)
  window.addEventListener('bap:h2h', onH2H)
  window.addEventListener('bap:takeover', e => { const d = e.detail || {}; if (d.city) S.stats.tkCities++; if (d.run) S.stats.tkRuns++; emit() })
  window.addEventListener('bap:compete', onCompete)
  window.addEventListener('bap:dc', e => { const n = e.detail?.streak ?? 0; if (n > S.stats.dcBest) { S.stats.dcBest = n; emit() } })
  window.addEventListener('bap:pro', () => emit(true))
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !loaded) return
    if (rollDay()) emit()
    sync()
  })
  if (!supabase) { switchUser(null); return }
  // The session is read from storage, so this settles before anyone can play
  supabase.auth.getSession().then(({ data }) => switchUser(data.session?.user ?? null), () => switchUser(null))
  supabase.auth.onAuthStateChange((_e, session) => switchUser(session?.user ?? null))
}

// ═════════════════════════════════════════════════════════════════════════════
// Coins, the shop and cosmetics
// ═════════════════════════════════════════════════════════════════════════════
// Balance: a typical season pays ~25–35, a title run ~100. A regular day of play
// (a handful of seasons, the missions, the daily drop) is roughly 300–400 coins:
// commons in a day or two, rares in about a week, epics in a few weeks,
// legendaries are a long chase (one to two months, or coins). Within a tier the
// showiest items cost the most (lib/cosmetics.js).
export const COINS = { season: 10, winNfl: 1, winNba: 0.25, playoffs: 10, ring: 40, award: 25, daily: 20, level: 40, free: 25, freePro: 50 }
export function seasonCoins(d) {
  if (d.sandbox) return 0
  let c = COINS.season + Math.round((d.wins ?? 0) * (d.sport === 'bucket' ? COINS.winNba : COINS.winNfl))
  if (d.playoffs) c += COINS.playoffs
  if (d.champion) c += COINS.ring
  if (d.award) c += COINS.award
  if (d.daily) c += COINS.daily
  return c
}
// Website: coins and cards need an account (the app keeps a guest's on the phone)
export const walletOpen = () => IS_APP || !!uid
function earn(n, label, quiet = false) {
  n = Math.round(n || 0)
  if (n <= 0 || !walletOpen()) return
  S.coins += n
  S.coinsEarned += n
  S.walletAt = Date.now()
  if (!quiet) toast({ kind: 'coins', title: `+${n} COINS`, sub: label || '' })
  window.dispatchEvent(new CustomEvent('bap:coins', { detail: { n, quiet } }))
}
// Every level climbed pays coins once
function payLevels() {
  const L = levelInfo(totalXp()).level
  if (!S.levelPaid) { S.levelPaid = L; return }
  if (L > S.levelPaid) { earn((L - S.levelPaid) * COINS.level, `Level ${L}`, true); S.levelPaid = L }
}

export const isPro = () => { try { return localStorage.getItem('bap_subscribed') === '1' } catch { return false } }
export const owns = id => { const i = itemById(id); return !!i && (i.free || !!S.owned[id]) }

// Today's deals: three items, 30% off, the same for everyone
export function dealsFor(key = dayKey()) {
  const r = seeded(`deals-${key}`)
  const pool = ITEMS.filter(i => forSale(i) && !i.pro && i.rarity >= 1)
  const picks = []
  while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
  return picks.map(i => ({ id: i.id, price: Math.max(10, Math.round((i.price * 0.7) / 10) * 10) }))
}
export function priceOf(id) {
  const i = itemById(id)
  if (!i) return 0
  return dealsFor().find(d => d.id === id)?.price ?? i.price
}
// Why an item can't be bought right now (null = it can)
export function lockReason(id, level = getProgress().lvl.level) {
  const i = itemById(id)
  if (!i) return 'Not found'
  if (owns(id)) return null
  if (i.ach) return `Achievement: ${achById(i.ach)?.title ?? 'reward'}`
  if (i.pro && !isPro()) return 'BAP Pro members only'
  if (i.level && level < i.level) return `Reach level ${i.level}`
  return null
}
export function buy(id) {
  const i = itemById(id)
  if (!i || !forSale(i)) return { ok: false, reason: 'Not for sale' }
  if (owns(id)) return { ok: false, reason: 'Already yours' }
  const lock = lockReason(id)
  if (lock) return { ok: false, reason: lock }
  const price = priceOf(id)
  if (S.coins < price) return { ok: false, reason: `Need ${(price - S.coins).toLocaleString()} more coins`, short: price - S.coins }
  S.coins -= price
  S.owned[id] = Date.now()
  S.stats.purchases++
  S.walletAt = Date.now()
  emit()
  window.dispatchEvent(new CustomEvent('bap:purchase', { detail: { id } }))
  return { ok: true, price }
}
export function equip(slot, id) {
  if (id && (!owns(id) || itemById(id)?.slot !== slot)) return false
  S.equip = { ...S.equip, [slot]: id ?? DEFAULTS[slot] ?? null }
  S.walletAt = Date.now()
  emit()
  window.dispatchEvent(new CustomEvent('bap:cosmetics', { detail: myCosmetics() }))
  return true
}
// What other players see (chat, lobbies): the look, not the sounds
// Everything other players see of you: the look and the victory (live rooms send it; accounts.cos keeps it)
export const myCosmetics = () => ({ avatar: S.equip.avatar ?? null, nameColor: S.equip.nameColor ?? null, nameFx: S.equip.nameFx ?? null, plate: S.equip.plate ?? null, winFx: S.equip.winFx || DEFAULTS.winFx, winSound: S.equip.winSound || DEFAULTS.winSound })
export const myVictory = () => ({ fx: S.equip.winFx || DEFAULTS.winFx, sound: S.equip.winSound || DEFAULTS.winSound })

// Join the Discord: one-time coins once the account has Discord linked
// (linking it also joins the server — lib/discord.js finishDiscordSignIn)
export const DISCORD_COINS = 500
export const hasDiscord = u => !!(u?.identities?.some(i => i.provider === 'discord') || u?.app_metadata?.providers?.includes('discord') || u?.app_metadata?.provider === 'discord')
export function claimDiscordCoins() {
  if (!uid || S.discordPaid || !hasDiscord(user)) return 0
  S.discordPaid = true
  earn(DISCORD_COINS, 'Joined the Discord', true)
  emit()
  return DISCORD_COINS
}

// ── Bought coins ─────────────────────────────────────────────────────────────
// App: the store confirms the purchase and the coins go straight in (lib/iap.js).
export function grantCoins(n, label = 'Coins purchased') {
  if (!n) return
  earn(n, label)
  emit()
}
// Website: Stripe's webhook records the purchase (coin_purchases); the game
// collects it once through claim_coin_purchases(), which marks it collected in
// the same step so it can never be collected twice (supabase/coin_purchases.sql).
let claiming = false
export async function claimCoinPurchases() {
  if (!supabase || !uid || claiming) return 0
  claiming = true
  try {
    const { data, error } = await supabase.rpc('claim_coin_purchases')
    const n = !error && typeof data === 'number' ? data : 0
    if (n > 0) { grantCoins(n, 'Coins purchased'); window.dispatchEvent(new CustomEvent('bap:coinpack', { detail: { n } })) }
    return n
  } catch { return 0 } finally { claiming = false }
}
// Back from Stripe (?coins=1): the webhook can land a moment after us, so ask a few times
export function watchCoinReturn() {
  try {
    const u = new URL(window.location.href)
    if (!u.searchParams.has('coins')) return
    u.searchParams.delete('coins')
    window.history.replaceState({}, '', u.pathname + (u.search ? u.search : '') + u.hash)
  } catch { return }
  let tries = 0
  const tick = async () => { if ((await claimCoinPurchases()) > 0 || ++tries >= 10) return; setTimeout(tick, 3000) }
  setTimeout(tick, 1500)
}

// Watch a video: 100 coins, up to 3 times a day
export const AD_COINS = 100, AD_MAX = 3
export const adsLeft = () => (S.adDay === dayKey() ? Math.max(0, AD_MAX - (S.adN || 0)) : AD_MAX)
export function claimAdCoins() {
  if (!walletOpen() || adsLeft() <= 0) return 0
  if (S.adDay !== dayKey()) { S.adDay = dayKey(); S.adN = 0 }
  S.adN++
  earn(AD_COINS, 'Thanks for watching')
  emit()
  return AD_COINS
}

// Send feedback: one-time coins the first time a message goes through
export const FEEDBACK_COINS = 150
export function claimFeedbackCoins() {
  if (S.feedbackPaid || !walletOpen()) return 0
  S.feedbackPaid = true
  earn(FEEDBACK_COINS, 'Thanks for the feedback')
  emit()
  return FEEDBACK_COINS
}

export function claimFreeCoins() {
  if (S.shopFree === dayKey() || !walletOpen()) return 0
  S.shopFree = dayKey()
  const n = isPro() ? COINS.freePro : COINS.free
  earn(n, 'Daily drop', true)
  emit()
  return n
}

// ═════════════════════════════════════════════════════════════════════════════
// Achievements
// ═════════════════════════════════════════════════════════════════════════════
export function achStats() {
  const st = S.stats
  const pos = st.positions || {}
  const L = levelInfo(totalXp()).level
  return {
    ...st,
    seasons: Math.max(st.seasons, careerSeasons()), rings: Math.max(st.rings, careerRings()),
    positions: ['qb', 'rb', 'wr', 'te', 'db'].filter(p => pos[p]).length,
    twoSport: st.nflSeasons > 0 && st.bucketSeasons > 0 ? 1 : 0,
    cards: Object.keys(S.cards).length, streak: S.streak.best ?? 0, level: L,
    cpPlayed: st.compete?.played ?? 0, cpWins: st.compete?.wins ?? 0, cpPodiums: st.compete?.podiums ?? 0, cpStreak: st.compete?.bestStreak ?? 0, cpBeaten: st.compete?.beaten ?? 0,
    btStreak: st.bt?.bestStreak ?? 0, btPts: st.bt?.pts ?? 0, h2hWins: st.h2h?.wins ?? 0, h2hStreak: st.h2h?.bestStreak ?? 0,
    onlineBest: st.online?.best ?? 0, onlinePlayed: st.online?.played ?? 0,
    owned: Object.keys(S.owned).length,
    fullFit: S.equip.plate && S.equip.nameColor && S.equip.nameFx ? 1 : 0,
    coinsEarned: S.coinsEarned,
  }
}
function checkAch(quiet) {
  const st = achStats()
  for (const a of ACHIEVEMENTS) {
    if (S.ach[a.id] || (st[a.metric] ?? 0) < a.goal) continue
    S.ach[a.id] = Date.now()
    S.walletAt = Date.now()
    if (!quiet && uid) {   // a guest can't claim it, so there's nothing to announce
      toast({ kind: 'ach', title: 'ACHIEVEMENT UNLOCKED', sub: a.title, ms: 3200 })
      window.dispatchEvent(new CustomEvent('bap:achievement', { detail: { id: a.id } }))
    }
  }
}
export function claimAch(id) {
  const a = achById(id)
  if (!a || !S.ach[id] || S.achClaimed[id]) return null
  S.achClaimed[id] = Date.now()
  S.bonusXp += a.xp
  earn(a.coins, null, true)
  if (a.item) S.owned[a.item] = Date.now()
  S.walletAt = Date.now()
  emit()
  return { xp: a.xp, coins: a.coins, item: a.item }
}

// ═════════════════════════════════════════════════════════════════════════════
// The wallet follows the account (accounts.app_profile, see supabase/app_shop.sql).
// Last change wins; items and achievements are merged, never lost.
// ═════════════════════════════════════════════════════════════════════════════
const WALLET_KEYS = ['coins', 'coinsEarned', 'owned', 'equip', 'ach', 'achClaimed', 'stats', 'shopFree', 'levelPaid', 'discordPaid', 'feedbackPaid', 'retired']
let pushTimer = null
function schedulePush() {
  if (!supabase || !uid) return
  clearTimeout(pushTimer)
  const id = uid
  pushTimer = setTimeout(() => {
    if (uid !== id) return
    const app_profile = Object.fromEntries(WALLET_KEYS.map(k => [k, S[k]]))
    app_profile.at = S.walletAt
    supabase.from('accounts').update({ app_profile }).eq('id', id).then(null, () => {})
    pushCos(id)
  }, 2500)
}
// The public copy of my look (leaderboards, results: supabase/public_cosmetics.sql).
// Its own write, so a database without the column never blocks the wallet.
let cosSent = ''
// The public profile (accounts.cos): the looks everyone sees, plus the level and
// online rating a friend's profile shows
function pushCos(id = uid) {
  if (!supabase || !id) return
  const o = S.stats?.online
  const cos = { ...myCosmetics(), level: levelInfo(totalXp()).level, rating: o?.played ? o.rating : null }, key = id + JSON.stringify(cos)
  if (key === cosSent) return
  cosSent = key
  supabase.from('accounts').update({ cos }).eq('id', id).then(({ error }) => { if (error) cosSent = '' }, () => { cosSent = '' })
}
async function pullWallet(id) {
  if (!supabase || !id) return
  try {
    const { data, error } = await supabase.from('accounts').select('app_profile').eq('id', id).maybeSingle()
    if (error || uid !== id || !data?.app_profile) return
    const w = data.app_profile
    const newer = (w.at ?? 0) > (S.walletAt ?? 0)
    S.owned = { ...(w.owned || {}), ...S.owned }
    S.retired = { ...(w.retired || {}), ...(S.retired || {}) }
    S.ach = { ...(w.ach || {}), ...S.ach }
    S.achClaimed = { ...(w.achClaimed || {}), ...S.achClaimed }
    const st = { ...S.stats }
    for (const [k, v] of Object.entries(w.stats || {})) {
      if (k === 'positions') st.positions = { ...(v || {}), ...(st.positions || {}) }
      else if (ONLINE_KEYS.includes(k) && v) {
        // counters: the larger; the live streak, the rating and the recent form: the newer side
        const mine = { ...BLANK_STATS[k], ...(st[k] || {}) }
        st[k] = Object.fromEntries(Object.keys(BLANK_STATS[k]).map(f => {
          const a = mine[f], b = v[f]
          if (Array.isArray(BLANK_STATS[k][f])) return [f, newer ? (b ?? a) : (a ?? b)]
          if (f === 'streak' || f === 'rating') return [f, newer ? (b ?? a) : (a ?? b)]
          return [f, Math.max(a ?? 0, b ?? 0)]
        }))
      }
      else if (typeof v === 'number') st[k] = Math.max(st[k] ?? 0, v)
    }
    S.stats = fixStats(st)
    S.coinsEarned = Math.max(S.coinsEarned, w.coinsEarned ?? 0)
    S.discordPaid = !!(S.discordPaid || w.discordPaid)
    S.feedbackPaid = !!(S.feedbackPaid || w.feedbackPaid)
    if (newer) {
      S.coins = w.coins ?? S.coins
      S.equip = { ...DEFAULTS, ...(w.equip || {}) }
      S.shopFree = w.shopFree ?? S.shopFree
      S.levelPaid = Math.max(S.levelPaid || 0, w.levelPaid || 0)
      S.walletAt = w.at
    }
    retireItems(S)                          // after the merge, so the refund survives a newer cloud wallet
    emit(true)
  } catch {}
}
