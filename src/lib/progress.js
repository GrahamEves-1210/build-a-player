// App-only progression: XP + levels, the daily login streak, three daily
// missions, the Daily Challenge and the card collection. Started from main.jsx
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
// XP to go from level L to L+1 = 150 + 50·(L−1)
export const xpForLevel = L => 150 * (L - 1) + 25 * (L - 1) * (L - 2)
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
  { id: 'platinum', name: 'Platinum', streak: 30 },
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
  seasons4:  { tier: 1, goal: 4,  xp: 100, text: 'Simulate 4 seasons',           on: { season: () => 1 } },
  playoffs1: { tier: 1, goal: 1,  xp: 80,  text: 'Make the playoffs',            on: { season: d => d.playoffs ? 1 : 0 } },
  ovr85:     { tier: 1, goal: 1,  xp: 90,  text: 'Build an 85+ OVR player',      on: { season: d => d.ovr >= 85 ? 1 : 0 } },
  winning2:  { tier: 1, goal: 2,  xp: 90,  text: 'Post 2 winning seasons',       on: { season: d => (d.sport === 'bucket' ? d.wins >= 50 : d.wins >= 10) ? 1 : 0 } },
  epic1:     { tier: 1, goal: 1,  xp: 80,  text: 'Pull an Epic or Legend card',  on: { card: d => d.rank >= 2 ? 1 : 0 } },
  ring1:     { tier: 2, goal: 1,  xp: 150, text: 'Win a championship',           on: { season: d => d.champion ? 1 : 0 } },
  ovr90:     { tier: 2, goal: 1,  xp: 140, text: 'Build a 90+ OVR player',       on: { season: d => d.ovr >= 90 ? 1 : 0 } },
  award1:    { tier: 2, goal: 1,  xp: 130, text: 'Win a season award',           on: { season: d => d.award ? 1 : 0 } },
  legend1:   { tier: 2, goal: 1,  xp: 120, text: 'Pull a Legend card',           on: { card: d => d.rank >= 3 ? 1 : 0 } },
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
  { days: 3,  xp: 150 },
  { days: 7,  xp: 400,  unlock: 'inferno' },
  { days: 30, xp: 1500, unlock: 'platinum' },
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
  stats: { seasons: 0, rings: 0, spins: 0, best: 0 },
})
const keyFor = id => `bap_prog_${id || 'guest'}`
function load(id) {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(keyFor(id)) || '{}') } } catch { return blank() }
}

let uid = null
let user = null
let S = load(null)
let snap = null
let lastSeason = null
const listeners = new Set()

function totalXp() {
  if (!uid) return S.bonusXp + S.seasonXp
  const since = S.sync?.at ?? 0
  return S.bonusXp + (S.sync?.xp ?? 0) + S.pending.filter(p => p.at > since).reduce((a, p) => a + p.xp, 0) + S.adjust
}
function makeSnap() {
  const xp = totalXp()
  return { ...S, xp, lvl: levelInfo(xp), signedIn: !!uid, user, lastSeason }
}
function emit() {
  try { localStorage.setItem(keyFor(uid), JSON.stringify(S)) } catch {}
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
    toast({ kind: 'streak', title: st.count > 1 ? `${st.count}-DAY STREAK` : 'DAILY LOGIN', sub: `+${LOGIN_XP} XP` })
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
    if (m.n >= def.goal) toast({ kind: 'mission', title: 'MISSION COMPLETE', sub: def.text })
  }
}

export function claimMission(id) {
  const m = S.day?.missions.find(x => x.id === id)
  const def = MISSIONS[id]
  if (!m || m.claimed || m.n < def.goal) return 0
  m.claimed = true
  S.bonusXp += def.xp
  emit()
  return def.xp
}
export function claimStreak(days) {
  const r = STREAK_REWARDS.find(x => x.days === days)
  if (!r || S.streak.count < days || S.streak.claimed[days]) return 0
  S.streak.claimed[days] = true
  S.bonusXp += r.xp
  if (r.unlock) S.unlocks[r.unlock] = true
  emit()
  return r.xp
}
// Completing a team's set in the binder (every player on that roster) pays once
export const setReward = size => Math.min(1500, 25 * size)
export function claimSet(key, size) {
  S.sets ??= {}
  if (S.sets[key]) return 0
  S.sets[key] = true
  S.bonusXp += setReward(size)
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
    id: Date.now(), ref: d.ref ?? null, lines, xp, before, after: before + xp,
    missions: (S.day?.missions ?? []).map((m, i) => ({ ...m, before: missionsBefore[i] ?? 0, def: MISSIONS[m.id] })),
  }
  emit()
}

// Live modes hand out XP directly ({ xp, label })
function onXp(e) {
  const { xp, label } = e.detail || {}
  if (!xp) return
  S.bonusXp += xp
  toast({ kind: 'xp', title: `+${xp} XP`, sub: label || '' })
  emit()
}

function onSpin(e) {
  const { sport, pos, mode, player, pool } = e.detail || {}
  if (!player?.name) return
  S.stats.spins++
  bumpMissions('spin', {})
  const k = cardKey(sport, pos, mode, player.name, player.team)
  const isNew = !S.cards[k]
  S.cards[k] = isNew ? [1, Date.now()] : [S.cards[k][0] + 1, S.cards[k][1]]
  const rank = rarityRank(pool, player)
  bumpMissions('card', { isNew, rank })
  if (isNew) S.bonusXp += 5 + rank * 5
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
    emit()
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
  S = load(id)
  if (id && !S.mergedGuest && guestCards) {
    for (const [k, v] of Object.entries(guestCards)) if (!S.cards[k]) S.cards[k] = v
    S.mergedGuest = true
  }
  rollDay()
  if (!S.seenLevel) S.seenLevel = levelInfo(totalXp()).level
  applySpot()
  emit()
  sync()
}

let started = false
export function initProgress() {
  if (started) return
  started = true
  applySpot()
  window.addEventListener('bap:season', onSeason)
  window.addEventListener('bap:spin', onSpin)
  window.addEventListener('bap:xp', onXp)
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
