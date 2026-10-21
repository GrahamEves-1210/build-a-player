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
import { passSeason, seasonById, seasonOver, tierAt, xpForTier } from './pass'
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
import { dailyFor } from './verifyCore'
import { saveDaily } from './submit'
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

// Login streak: every 3 days pays XP (as long as it lasts); 7, 21 and 60 days each unlock
// a look only streak keepers have (and the spotlights)
export const STREAK_EVERY = { days: 3, xp: 150 }
export const STREAK_REWARDS = [
  { days: 7,  xp: 500,  unlock: 'inferno', item: 'av-streak' },
  { days: 21, xp: 1200, unlock: 'platinum', item: 'rs-wildfire' },
  { days: 60, xp: 3000, item: 'ent-eternal' },
]
export const LOGIN_XP = 25

// ── Daily Challenge ──────────────────────────────────────────────────────────
// Everyone gets the same position, mode and spins for the day.
// the day's position, mode and seed: one definition, shared with the live server's check (verifyCore)
export function dailyChallenge(key = dayKey()) { return dailyFor(key) }

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
  bonusXp: 0,                 // missions, streak, login, new cards: earned on this device
  bonusOther: {},             // the same from the account's other devices (device id → XP)
  todayOther: {},             // today's tally on the account's other devices (device id → { d, xp, g })
  seasonXp: 0,                // guest seasons
  today: null,                // { d: day, xp, g }: today's XP and games (Player of the Day)
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
  coinsSynced: null,          // the account's coins as of the last sync: coins move by what changed here since
  // the Builder Pass (lib/pass.js): season id → { base: the account's XP when it first saw the
  // season, final: the season's XP once it ended, f / p: free / premium tiers claimed }
  pass: {},
  inv: {},                    // boosts (BOOSTS): device id → { got: { kind: n }, used: { kind: n } }
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
  bt2: { games: 0, wins: 0, mvp: 0, streak: 0, bestStreak: 0, pts: 0, ast: 0, reb: 0, stl: 0, blk: 0, fgm: 0, fga: 0, highPts: 0, recent: [] },
  // Blacktop 1v1 (the lobby and practice, on the Blacktop engine)
  bt1: { games: 0, wins: 0, mvp: 0, streak: 0, bestStreak: 0, pts: 0, ast: 0, reb: 0, stl: 0, blk: 0, fgm: 0, fga: 0, highPts: 0, recent: [] },
  h2h: { played: 0, wins: 0, losses: 0, forfeits: 0, streak: 0, bestStreak: 0, recent: [] },
  // 1v1 by sport (h2h above is both together: achievements and the rating read it).
  // Basketball's is a game, so it keeps a line: points, shots, steals, blocks (games = games with a line)
  h2hN: { played: 0, wins: 0, losses: 0, forfeits: 0, streak: 0, bestStreak: 0, recent: [] },
  h2hB: { played: 0, wins: 0, losses: 0, forfeits: 0, streak: 0, bestStreak: 0, recent: [], games: 0, pts: 0, fgm: 0, fga: 0, stl: 0, blk: 0, highPts: 0 },
  // Online rating across the live modes (see rateOnline)
  online: { rating: 800, best: 800, played: 0 },
}
const ONLINE_KEYS = ['compete', 'bt', 'bt2', 'bt1', 'h2h', 'h2hN', 'h2hB', 'online']
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
const RETIRED = { 'snd-roar': 400, 'snd-sax': 5400, 'snd-pro-anthem': 18000, 'snd-pizzi': 1400, 'ct-patchwork': 1900, 'snd-riser': 6000, 'snd-bassdrop': 21500, 'snd-rise': 15500 }   // Stadium Roar (a crowd), Sax Solo, Pro Anthem, String Section, the Patchwork court, Synth Riser, Bass Drop, The Big Rise
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
// Today's tally for Player of the Day (on the public profile, accounts.cos.today):
// the XP earned today playing (games, live play, missions, the login), and the games
// finished. One-time claims (achievements, streak milestones, sets) don't count.
// supabase/score_guards.sql caps what a save can claim.
function tally(xp = 0, game = 0) {
  const k = dayKey()
  if (S.today?.d !== k) { if (S.today?.xp) S.prevDay = S.today; S.today = { d: k, xp: 0, g: 0 } }
  S.today.xp += Math.max(0, Math.round(xp || 0))
  S.today.g += game
}
function totalXp() {
  if (!uid) return 0
  const since = S.sync?.at ?? 0
  const others = Object.values(S.bonusOther || {}).reduce((a, x) => a + (+x || 0), 0)
  return S.bonusXp + others + (S.sync?.xp ?? 0) + S.pending.filter(p => p.at > since).reduce((a, p) => a + p.xp, 0) + S.adjust
}
function makeSnap() {
  const xp = totalXp()
  const lvl = levelInfo(xp)
  const claimable = ACHIEVEMENTS.filter(a => S.ach[a.id] && !S.achClaimed[a.id]).length
  return { ...S, xp, lvl, signedIn: !!uid, user, lastSeason, pro: isPro(), claimable, freeReady: S.shopFree !== dayKey(), bp: passInfo(), boosts: Object.fromEntries(Object.keys(BOOSTS).map(k => [k, boostLeft(k)])) }
}
function emit(quiet = false) {
  startPass()
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
// Streak freezes: bought with coins, held up to FREEZE_MAX, one used for each missed day
export const FREEZE_PRICE = 250, FREEZE_MAX = 2
export function buyFreeze() {
  const st = S.streak
  if (!walletOpen()) return { ok: false, reason: 'Sign in to buy one' }
  if ((st.freezes ?? 0) >= FREEZE_MAX) return { ok: false, reason: `You can hold ${FREEZE_MAX}` }
  if (S.coins < FREEZE_PRICE) return { ok: false, reason: `Need ${(FREEZE_PRICE - S.coins).toLocaleString()} more coins` }
  S.coins -= FREEZE_PRICE
  st.freezes = (st.freezes ?? 0) + 1
  S.walletAt = Date.now()
  emit()
  return { ok: true }
}
// A broken streak, today only, once a week (app): a video puts it back as if no day was missed
export const RESTORE_EVERY = 7 * 86400000
export function streakLost() {
  const st = S.streak, l = st.lost
  if (!l || l.day !== dayKey() || st.count > 1 || (st.restoredAt && Date.now() - st.restoredAt < RESTORE_EVERY)) return null
  return l
}
export function restoreStreak() {
  const st = S.streak, l = streakLost()
  if (!l) return false
  st.count = l.count + 1; st.start = l.start; st.claimed = { ...(l.claimed || {}) }
  st.best = Math.max(st.best, st.count)
  st.lost = null; st.restoredAt = Date.now()
  emit()
  return true
}
function rollDay() {
  const k = dayKey()
  const st = S.streak
  let changed = false
  // signed in: the login streak waits for the account's wallet (another device may already
  // have counted today), then pullWallet rolls it
  if (st.last !== k && !(uid && pulledFor !== uid)) {
    // missed a day or two: a freeze covers each one, and the streak goes on
    const missed = [1, 2].find(n => st.last === dayKey(-(n + 1))) ?? 0
    const saved = missed && st.count > 0 && (st.freezes ?? 0) >= missed ? missed : 0
    if (st.last === dayKey(-1) || saved) { st.count += 1; if (saved) st.freezes -= saved }
    else {
      // a real streak just broke: remember it for today, so a video can bring it back (restoreStreak)
      st.lost = st.count >= 3 ? { day: k, count: st.count, start: st.start, claimed: st.claimed } : null
      st.count = 1; st.start = k; st.claimed = {}
    }
    st.last = k
    st.best = Math.max(st.best, st.count)
    S.bonusXp += LOGIN_XP; tally(LOGIN_XP)
    if (uid) toast({ kind: 'streak', title: st.count > 1 ? `${st.count}-DAY STREAK` : st.lost && IS_APP ? `${st.lost.count}-DAY STREAK BROKE` : 'DAILY LOGIN', sub: saved ? `Streak freeze used${saved > 1 ? ' ×2' : ''} · +${LOGIN_XP} XP` : st.lost && IS_APP && streakLost() ? 'Bring it back on the Daily tab' : `+${LOGIN_XP} XP` })
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
  S.bonusXp += def.xp; tally(def.xp)
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
  if (r.item && !S.owned[r.item]) S.owned[r.item] = Date.now()
  S.walletAt = Date.now()
  emit()
  return r.xp
}
// Every 3 days of the streak: the XP for each block reached and not yet claimed
export const streakEveryReady = (st = S.streak) => Math.max(0, Math.floor((st.count || 0) / STREAK_EVERY.days) - (st.claimed?.every || 0))
export function claimStreakEvery() {
  const n = streakEveryReady()
  if (!n || !uid) return 0
  S.streak.claimed = { ...(S.streak.claimed || {}), every: Math.floor(S.streak.count / STREAK_EVERY.days) }
  const xp = n * STREAK_EVERY.xp
  S.bonusXp += xp
  earn(Math.round(xp / 4), null, true)
  S.walletAt = Date.now()
  emit()
  return xp
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
// Who played today's Daily first on this device (any account, or a guest). Everyone
// gets the same spins, so a run as a guest (or another account) shows the whole day's
// order: a score from someone else on this device afterwards doesn't post.
const DC_DEVICE = 'bap_dc_device'
const dcDevice = () => { try { return JSON.parse(localStorage.getItem(DC_DEVICE) || 'null') } catch { return null } }
function claimDailyDevice(key) {
  const c = dcDevice()
  if (c?.key === key) return
  try { localStorage.setItem(DC_DEVICE, JSON.stringify({ key, by: uid || 'guest' })) } catch {}
}
const dailyScouted = key => { const c = dcDevice(); return !!c && c.key === key && c.by !== (uid || 'guest') }
export function setDailySpins(n) {
  const dc = dailyChallenge()
  if (!S.dc || S.dc.key !== dc.key) S.dc = { key: dc.key, spins: 0, done: false }
  claimDailyDevice(dc.key)
  if (S.dc.done || n <= S.dc.spins) return
  S.dc.spins = n
  emit()
}
// Left the Daily Challenge mid-run: today is over, no score, no second try
export function forfeitDaily() {
  const dc = dailyChallenge()
  if (!S.dc || S.dc.key !== dc.key) S.dc = { key: dc.key, spins: 0, done: false }
  if (S.dc.done) return
  S.dc.done = true
  S.dc.forfeit = true
  S.dc.ovr = null
  emit()
}
async function postDaily(ovr, pos, mode, build) {
  if (!uid || !supabase) return
  if (dailyScouted(S.dc.key)) {
    S.dc.posted = false
    toast({ kind: 'xp', title: 'DAILY NOT POSTED', sub: "Today's Daily was already played on this device" })
    return emit()
  }
  // checked by the live server (the day's own spins, the real OVR) on its way to the board
  const { error } = await saveDaily({
    day: S.dc.key, user_id: uid, username: getUsername(user) || 'Player', ovr, position: pos, mode, build,
  })
  if (!error || error.code === '23505') { S.dc.posted = true; emit() }   // 23505: already posted today
}
// Players of the Day: the most XP earned today, across every mode (accounts.cos.today)
export async function fetchPlayersOfDay(key = dayKey()) {
  if (!supabase) return { rows: [], error: true }
  const { data, error } = await supabase.from('accounts')
    .select('id,username,cos').eq('cos->today->>d', key)
    .order('cos->today->xp', { ascending: false }).limit(3)
  if (error) return { rows: [], error: true }
  return { rows: (data ?? []).filter(r => r.username && r.cos?.today?.xp > 0) }
}
// Yesterday's board, for the payout: a player's tally for that day is either still
// "today" on their profile (they haven't played since) or moved to "yday"
export const POTD_COINS = [500, 300, 200]
export async function fetchPlayersOfDayFor(day) {
  if (!supabase) return { rows: [], error: true }
  const q = f => supabase.from('accounts').select('id,username,cos').eq(`cos->${f}->>d`, day).order(`cos->${f}->xp`, { ascending: false }).limit(10)
  const [a, b] = await Promise.all([q('today'), q('yday')])
  if (a.error && b.error) return { rows: [], error: true }
  const byId = new Map()
  for (const [r, f] of [...(a.data ?? []).map(r => [r, 'today']), ...(b.data ?? []).map(r => [r, 'yday'])]) {
    const t = r.cos?.[f]
    if (r.username && t?.d === day && t.xp > 0 && !byId.has(r.id)) byId.set(r.id, { ...r, day: t })
  }
  return { rows: [...byId.values()].sort((x, y) => y.day.xp - x.day.xp || x.id.localeCompare(y.id)).slice(0, 3) }
}
// The morning after: a top-3 finish yesterday pays once
let potdChecking = false
async function payPlayersOfDay() {
  const y = dayKey(-1)
  // only once the account's wallet is in: a cleared device would otherwise pay again
  if (!uid || !supabase || S.potdPaid === y || potdChecking || pulledFor !== uid) return
  potdChecking = true
  try {
    const r = await fetchPlayersOfDayFor(y)
    if (r.error || !uid) return
    S.potdPaid = y
    const i = r.rows.findIndex(x => x.id === uid)
    if (i >= 0) {
      earn(POTD_COINS[i], null, true)
      toast({ kind: 'coins', title: `PLAYER OF THE DAY · ${['1ST', '2ND', '3RD'][i]}`, sub: `+${POTD_COINS[i]} coins for yesterday` })
    }
    emit()
  } finally { potdChecking = false }
}
// ── The Weekly Cup: every Daily posted Monday to Sunday (New York) adds its OVR; the top 10
// win coins and the Cup Contender avatar, paid the next time they open the game
// (supabase/weekly_cup.sql weekly_cup). The board falls back to adding up the rows here.
export const CUP_COINS = [2000, 1200, 800, 500, 500, 500, 500, 500, 500, 500]
export const CUP_ITEM = 'av-cup'
const keyOfIndex = i => new Date(i * 86400000).toISOString().slice(0, 10)
export const weekOf = (key = dayKey()) => { const i = dayIndex(key); return keyOfIndex(i - ((i + 3) % 7)) }   // its Monday
export const weekEnds = (key = dayKey()) => keyOfIndex(dayIndex(weekOf(key)) + 6)
export async function fetchWeeklyCup(week = weekOf()) {
  if (!supabase) return { rows: [], error: true }
  const { data, error } = await supabase.rpc('weekly_cup', { p_start: week })
  if (!error) return { rows: data ?? [] }
  const end = keyOfIndex(dayIndex(week) + 6)
  const r = await supabase.from('daily_challenge_results').select('user_id,username,ovr,created_at').gte('day', week).lte('day', end).limit(5000)
  if (r.error) return { rows: [], error: true }
  const by = new Map()
  for (const x of r.data ?? []) {
    const o = by.get(x.user_id) ?? { user_id: x.user_id, username: x.username, total: 0, days: 0, best: 0, first: x.created_at }
    o.total += x.ovr; o.days++; o.best = Math.max(o.best, x.ovr); if (x.created_at < o.first) o.first = x.created_at
    by.set(x.user_id, o)
  }
  return { rows: [...by.values()].sort((a, b) => b.total - a.total || a.days - b.days || String(a.first).localeCompare(String(b.first))).slice(0, 50) }
}
let cupChecking = false
async function payWeeklyCup() {
  const last = weekOf(keyOfIndex(dayIndex(weekOf()) - 7))
  if (!uid || !supabase || S.cupPaid === last || cupChecking || pulledFor !== uid) return
  cupChecking = true
  try {
    const r = await fetchWeeklyCup(last)
    if (r.error || !uid) return
    S.cupPaid = last
    const i = r.rows.findIndex(x => x.user_id === uid)
    if (i >= 0 && i < CUP_COINS.length) {
      earn(CUP_COINS[i], null, true)
      if (!S.owned[CUP_ITEM]) S.owned[CUP_ITEM] = Date.now()
      S.cupWon = { week: last, place: i + 1 }
      toast({ kind: 'coins', title: `WEEKLY CUP · #${i + 1}`, sub: `+${CUP_COINS[i].toLocaleString()} coins and the Cup Contender avatar` })
    }
    S.walletAt = Date.now()
    emit()
  } finally { cupChecking = false }
}
// fetched once behind the loading screen, so home opens with the board already in
let potd = null
export function prefetchPlayersOfDay() { potd = { at: Date.now(), p: fetchPlayersOfDay() }; return potd.p }
export const cachedPlayersOfDay = () => (potd && Date.now() - potd.at < 60000 ? potd.p : null)
export const myToday = () => (S.today?.d === dayKey() ? S.today : { d: dayKey(), xp: 0, g: 0 })
export async function fetchDailyBoard(key = dayKey()) {
  if (!supabase) return { rows: [], error: true }
  const { data, error } = await supabase.from('daily_challenge_results')
    .select('user_id,username,ovr,created_at').eq('day', key)
    .order('ovr', { ascending: false }).order('created_at', { ascending: true }).limit(50)
  if (error) return { rows: [], error: true }
  return { rows: data ?? [] }
}

// ── Events from the games ────────────────────────────────────────────────────
const INFINITE_PAID = 10
function onSeason(e) {
  const d = e.detail || {}
  if (d.sandbox) {   // custom ratings: no XP, no rewards panel
    if (d.daily) toast({ kind: 'xp', title: 'DAILY NOT COUNTED', sub: 'Custom ratings were on for this build' })
    lastSeason = null; emit(); return
  }
  // Infinite Salary Cap replays without end: only so many plays a day pay out
  if (d.mode === 'salarycap' && d.infinite) {
    const k = dayKey(0)
    if (S.salInf?.key !== k) S.salInf = { key: k, n: 0 }
    if (S.salInf.n >= INFINITE_PAID) {
      toast({ kind: 'xp', title: 'INFINITE · JUST FOR FUN', sub: `XP and coins pay on your first ${INFINITE_PAID} Infinite plays a day` })
      lastSeason = null; emit(); return
    }
    S.salInf.n++
  }
  const before = totalXp()
  const lines = seasonLines(d)
  const xp = lines.reduce((a, l) => a + l.xp, 0)
  if (d.localOnly) S.bonusXp += xp                       // modes the database doesn't keep (Salary Cap)
  else if (uid) S.pending.push({ at: Date.now(), xp, ring: !!d.champion })
  else S.seasonXp += xp
  tally(xp, 1)
  // a 2x XP boost: the season's XP again
  let boost = 0
  if (uid && xp > 0 && boostLeft('xp') > 0) {
    boost = xp
    invAdd('xp', 'used', 1)
    S.bonusXp += boost; tally(boost)
    lines.push({ label: '2x XP boost', xp: boost })
  }
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
  // Coin Rush: the season's coins again
  const coins = seasonCoins(d)
  let rush = 0
  if (walletOpen() && coins > 0 && boostLeft('rush') > 0) { rush = coins; invAdd('rush', 'used', 1) }
  earn(coins + rush, null, true)
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
    id: Date.now(), ref: d.ref ?? null, lines, xp: xp + boost, before, after: before + xp + boost, coins: walletOpen() ? coins + rush : 0, rush, missedCoins: walletOpen() ? 0 : coins,
    missions: (S.day?.missions ?? []).map((m, i) => ({ ...m, before: missionsBefore[i] ?? 0, def: MISSIONS[m.id] })),
  }
  emit()
}

// Live modes hand out XP directly ({ xp, label })
function onXp(e) {
  const { xp, label, coins } = e.detail || {}
  if (!xp && !coins) return
  S.bonusXp += xp || 0; tally(xp)
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
  S.bonusXp += xp; tally(xp, 1)
  earn(coins, null, true)
  bumpMissions('compete', { place })
  toast({ kind: 'xp', title: rewardText(xp, coins) || (place === 1 ? `${what.toUpperCase()} WON` : `${ordinal(place).toUpperCase()} PLACE`), sub: `${place === 1 ? `You won the ${what}` : `Compete · ${ordinal(place)} place`} · ${delta >= 0 ? '+' : ''}${delta} rating` })
  emit()
}

// A Blacktop game finished: W/L, MVP, my box-score line → career line, rating
// (a 2v2 keeps its own record, stats.bt2; the rating and missions are shared)
function onBlacktop(e) {
  const d = e.detail || {}
  const two = d.size === 2 || d.size === 1, key = d.size === 1 ? 'bt1' : 'bt2'
  let b
  if (two) {
    b = S.stats[key] = { ...BLANK_STATS[key], ...(S.stats[key] || {}) }
    b.games++
    if (d.won) b.wins++
    if (d.mvp) b.mvp++
  } else {
    S.stats.btGames++
    if (d.won) S.stats.btWins++
    if (d.mvp) S.stats.btMvp++
    b = S.stats.bt = { ...BLANK_STATS.bt, ...(S.stats.bt || {}) }
  }
  const line = d.line || {}
  const highPts = (line.pts || 0) > b.highPts && (two ? b.games : S.stats.btGames) > 1
  for (const k of ['pts', 'ast', 'reb', 'stl', 'blk', 'fgm', 'fga']) b[k] += line[k] || 0
  if ((line.pts || 0) > b.highPts) b.highPts = line.pts
  if (d.won) { b.streak++; if (b.streak > b.bestStreak) b.bestStreak = b.streak } else b.streak = 0
  pushRecent(b.recent, d.won ? 'W' : 'L')
  // practice against CPUs: no rating either way (CPU builds are random, so it was a rating farm)
  const scale = d.bots ? 0 : 1
  // walked out of the run's build: a forfeit's hit, no mission credit
  rateOnline((d.forfeit ? FORFEIT_RATING : (d.won ? 20 : -12) + (d.mvp ? 5 : 0)) * scale, 'bt', { won: !!d.won, mvp: !!d.mvp, highPts, streak: b.streak, forfeit: !!d.forfeit })
  if (!d.forfeit) { bumpMissions('bt', { won: !!d.won }); tally(0, 1) }
  emit()
}

// A 1v1 finished: 'win' | 'loss' | 'forfeit' | 'walkover' (they left)
function onH2H(e) {
  const { result, sport, line } = e.detail || {}
  if (!result) return
  const won = result === 'win' || result === 'walkover'
  // the record both ways: all 1v1s together, and this sport's own
  const k = sport === 'bucket' ? 'h2hB' : 'h2hN'
  for (const key of ['h2h', k]) {
    const r = S.stats[key] = { ...BLANK_STATS[key], ...(S.stats[key] || {}) }
    r.played++
    if (won) { r.wins++; r.streak++; if (r.streak > r.bestStreak) r.bestStreak = r.streak } else { r.losses++; r.streak = 0; if (result === 'forfeit') r.forfeits++ }
    pushRecent(r.recent, won ? 'W' : 'L')
  }
  // a basketball 1v1 played out: its line
  if (k === 'h2hB' && line && typeof line === 'object') {
    const b = S.stats.h2hB
    b.games++
    for (const f of ['pts', 'fgm', 'fga', 'stl', 'blk']) b[f] += Math.max(0, Math.round(Number(line[f]) || 0))
    b.highPts = Math.max(b.highPts, Math.round(Number(line.pts) || 0))
  }
  const h = S.stats.h2h
  const delta = rateOnline(result === 'win' ? 25 : result === 'walkover' ? 10 : result === 'forfeit' ? -20 : -15, 'h2h', { won, streak: h.streak, sport })
  if (result !== 'walkover') toast({ kind: 'online', title: `${sport === 'bucket' ? 'BLACKTOP' : 'FOOTBALL'} 1V1 · ${won ? 'W' : 'L'}`, sub: `${delta >= 0 ? '+' : ''}${delta} rating${h.streak >= 2 ? ` · ${h.streak} straight` : ''}` })
  bumpMissions('h2h', { won }); if (result !== 'forfeit') tally(0, 1)
  emit()
}

function onSpin(e) {
  const d = e.detail || {}
  if (!d.player?.name) return
  S.stats.spins++
  bumpMissions('spin', {})
  if (!cardsOpen()) { emit(); return }
  addCard(d)
}
// A card into the binder (a spin, or a pack from the Builder Pass)
function addCard({ sport, pos, mode, player, pool, pack = false }) {
  const k = cardKey(sport, pos, mode, player.name, player.team)
  const isNew = !S.cards[k]
  S.cards[k] = isNew ? [1, Date.now()] : [S.cards[k][0] + 1, S.cards[k][1]]
  const rank = rarityRank(pool, player)
  bumpMissions('card', { isNew, rank })
  if (isNew) { S.bonusXp += 2 + rank * 3; tally(2 + rank * 3); earn([1, 2, 5, 15][rank] ?? 1, null, true); if (rank >= 3) S.stats.legends++ }
  emit()
  window.dispatchEvent(new CustomEvent('bap:card', { detail: { isNew, rank, rarity: RARITIES[rank], name: player.name, team: player.team, sport, pos, mode, count: S.cards[k][0], pack } }))
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
// the loading screen waits on this (main.jsx): the account read, its wallet and seasons pulled
let settle
export const progressSettled = new Promise(r => { settle = r })
// run once the store is listening and holds the right account (a forfeit booked
// on page load must land on the player who left, not on a guest store)
const readyFns = []
export function whenProgressReady(fn) { if (loaded) setTimeout(fn, 0); else readyFns.push(fn) }
function switchUser(u) {
  const id = u?.id ?? null
  user = u ?? null
  if (loaded && id === uid) { emit(); return }
  loaded = true
  const guestCards = id ? load(null).cards : null
  uid = id
  S = retireItems(load(id))
  passOwn = new Set(cachedPassOwn(id))
  if (id && !S.mergedGuest && guestCards) {
    for (const [k, v] of Object.entries(guestCards)) if (!S.cards[k]) S.cards[k] = v
    S.mergedGuest = true
  }
  rollDay()
  if (!S.seenLevel) S.seenLevel = levelInfo(totalXp()).level
  if (!S.levelPaid) S.levelPaid = levelInfo(totalXp()).level
  applySpot()
  emit(true)                 // achievements already earned unlock quietly (rewards wait in the list)
  syncName(id)
  const synced = sync()
  // coins bought on the website land after the wallet is pulled (so a newer remote wallet can't overwrite them)
  const pulled = pullWallet(id)
  pulled.then(() => { claimCoinPurchases(); payPlayersOfDay(); payWeeklyCup(); loadPassOwners(id) })
  Promise.allSettled([synced, pulled]).then(() => settle())
  if (IS_APP) import('./iap').then(m => m.iapUser(id)).catch(() => {})
  readyFns.splice(0).forEach(fn => setTimeout(fn, 0))
}

let started = false
export function initProgress() {
  if (started) return
  started = true
  applySpot()
  watchCoinReturn()
  watchPassReturn()
  window.addEventListener('bap:season', onSeason)
  window.addEventListener('bap:feedback-sent', () => claimFeedbackCoins())
  window.addEventListener('bap:spin', onSpin)
  window.addEventListener('bap:xp', onXp)
  window.addEventListener('bap:blacktop', onBlacktop)
  window.addEventListener('bap:h2h', onH2H)
  window.addEventListener('bap:takeover', e => { const d = e.detail || {}; if (d.city) { S.stats.tkCities++; tally(0, 1) } if (d.run) S.stats.tkRuns++; emit() })
  window.addEventListener('bap:compete', onCompete)
  window.addEventListener('bap:dc', e => { const n = e.detail?.streak ?? 0; if (n > S.stats.dcBest) { S.stats.dcBest = n; emit() } })
  window.addEventListener('bap:pro', () => emit(true))
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !loaded) return
    if (rollDay()) emit()
    payPlayersOfDay()
    payWeeklyCup()
    sync()
    // back on this tab or app: what the account did elsewhere comes in first
    if (uid) pullWallet(uid)
  })
  if (!supabase) { switchUser(null); return }
  // The session is read from storage, so this settles before anyone can play
  supabase.auth.getSession().then(({ data }) => switchUser(data.session?.user ?? null), () => switchUser(null))
  supabase.auth.onAuthStateChange((_e, session) => switchUser(session?.user ?? null))
}

// ═════════════════════════════════════════════════════════════════════════════
// Coins, the shop and cosmetics
// ═════════════════════════════════════════════════════════════════════════════
// Balance: a typical season pays ~25–35, a title run ~100. A day of play is
// ~300 coins (20 minutes) to ~600 (an hour), more with the videos. Prices
// (lib/cosmetics.js) climb gently and overlap across rarities: commons in a day
// or two, rares within a week, epics in one to two weeks, legendaries (~5,500–
// 13,000) in two to four.
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
// Coins (and XP) are for accounts only; a guest earns neither, anywhere
export const walletOpen = () => !!uid
// the card binder: a guest's is kept on the device (app and website alike) and merged in at sign-in
export const cardsOpen = () => true
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
  const pool = ITEMS.filter(i => forSale(i) && !i.pro && !i.unlock && i.rarity >= 1)
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
  if (i.streak) return `Login streak: ${i.streak} days in a row`
  if (i.cup) return 'Weekly Cup: finish a week in the top 10'
  if (i.pass) return `Builder Pass · ${seasonById(i.pass.season)?.name ?? 'Season'} · tier ${i.pass.tier}`
  if (i.pro && !isPro()) return 'BAP Pro members only'
  if (i.level && level < i.level) return `Reach level ${i.level}`
  return null
}
export function buy(id) {
  if (!walletOpen()) return { ok: false, reason: 'Sign in to use coins' }
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
export const myCosmetics = () => ({ avatar: S.equip.avatar ?? null, nameColor: S.equip.nameColor ?? null, nameFx: S.equip.nameFx ?? null, plate: S.equip.plate ?? null, winFx: S.equip.winFx || DEFAULTS.winFx, winSound: S.equip.winSound || DEFAULTS.winSound, entrance: S.equip.entrance ?? null })
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
// The Builder Pass (lib/pass.js)
// ═════════════════════════════════════════════════════════════════════════════
// A player's place in the season is the XP earned since it started: the account's XP
// total when it first saw the season is kept (pass[id].base; the lowest any device saw),
// set only once the account's wallet and its season rebuild are in, so XP earned before
// the season never counts. Once the season ends its XP is frozen (final).
// Who bought the premium track comes from pass_owners (the Stripe webhook writes it).
let passOwn = new Set()
const passOwnKey = id => `bap_pass_${id}`
const cachedPassOwn = id => { try { return id ? JSON.parse(localStorage.getItem(passOwnKey(id)) || '[]') : [] } catch { return [] } }
const passOf = s => ((S.pass ||= {})[s.id] ||= { base: null, f: {}, p: {} })
function passXp(s) {
  const ps = S.pass?.[s.id]
  if (!uid || ps?.base == null) return 0
  return Math.max(0, ps.final ?? (totalXp() - ps.base))
}
// Mark where this season starts (and ends) for the account; runs on every change
function startPass() {
  const day = dayKey(), s = passSeason(day)
  if (!uid || !s || pulledFor !== uid || !S.sync) return
  const ps = S.pass?.[s.id]
  if (ps?.base == null) { if (!seasonOver(s, day)) passOf(s).base = totalXp(); return }
  if (ps.final == null && seasonOver(s, day)) ps.final = Math.max(0, totalXp() - ps.base)
}
export const ownsPass = sid => passOwn.has(sid)
export function passInfo() {
  const day = dayKey(), s = passSeason(day)
  if (!s) return null
  const ps = S.pass?.[s.id] ?? {}
  const xp = passXp(s), tier = tierAt(xp), owned = passOwn.has(s.id)
  const waiting = (tr, key) => Object.keys(s[key]).filter(t => +t <= tier && !ps[tr]?.[t]).length
  return {
    season: s, xp, tier, into: xp - xpForTier(tier), owned, over: seasonOver(s, day), started: ps.base != null,
    claimed: { f: ps.f || {}, p: ps.p || {} }, ready: !uid || ps.base == null ? 0 : waiting('f', 'free') + (owned ? waiting('p', 'premium') : 0),
  }
}
// ── Boosts: consumables from the pass and the shop. Each device counts what it got
// and used (inv[device]), added up across the account (two devices can't erase each other's)
export const BOOSTS = {
  xp:   { name: '2x XP', short: '2x XP', desc: 'Your next seasons count double XP.', unit: 'season', price: 350, per: 3 },
  rush: { name: 'Coin Rush', short: 'Coin Rush', desc: 'Your next seasons pay double coins.', unit: 'season', per: 3, passOnly: true },
  hot:  { name: 'Hot Hand', short: 'Hot Hand', desc: 'Career: +2 to every grade for your next 3 games (6 in basketball). Use it from the season screen.', unit: 'use', price: 400, per: 1 },
  heal: { name: 'Quick Heal', short: 'Quick Heal', desc: 'Career: an injury keeps you out half as long. Offered when you get hurt.', unit: 'use', price: 300, per: 1 },
}
const invSum = (k, f) => Object.values(S.inv || {}).reduce((a, d) => a + (+d?.[f]?.[k] || 0), 0)
export const boostLeft = k => (uid ? Math.max(0, invSum(k, 'got') - invSum(k, 'used')) : 0)
function invAdd(k, f, n) {
  const me = ((S.inv ||= {})[DEV] ||= { got: {}, used: {} })
  me[f] = { ...(me[f] || {}), [k]: (+me[f]?.[k] || 0) + n }
}
// Spend one (Career's Hot Hand / Quick Heal); false if there's none
export function spendBoost(k) {
  if (!BOOSTS[k] || boostLeft(k) <= 0) return false
  invAdd(k, 'used', 1)
  S.walletAt = Date.now()
  emit()
  return true
}
export function buyBoost(k) {
  const b = BOOSTS[k]
  if (!walletOpen()) return { ok: false, reason: 'Sign in to buy boosts' }
  if (!b || b.passOnly || !b.price) return { ok: false, reason: 'Not for sale' }
  if (S.coins < b.price) return { ok: false, reason: `Need ${(b.price - S.coins).toLocaleString()} more coins`, short: b.price - S.coins }
  S.coins -= b.price
  invAdd(k, 'got', b.per)
  S.walletAt = Date.now()
  emit()
  return { ok: true }
}
// An item already owned (bought before it moved to the pass) pays coins instead
const DUP_COINS = [150, 400, 800, 1500]
// Claim one reward: track 'f' (free) or 'p' (premium), and the tier. Returns what it paid, or null
export function claimPass(track, tier) {
  const s = passSeason(dayKey())
  if (!uid || !s || (track !== 'f' && track !== 'p')) return null
  const r = (track === 'p' ? s.premium : s.free)[tier]
  const ps = passOf(s)
  if (!r || ps.base == null || ps[track]?.[tier] || tierAt(passXp(s)) < tier) return null
  if (track === 'p' && !passOwn.has(s.id)) return null
  ps[track] = { ...(ps[track] || {}), [tier]: Date.now() }
  let got
  if (r.coins) { earn(r.coins, 'Builder Pass', true); got = { coins: r.coins } }
  else if (r.freeze) {
    const st = S.streak
    if ((st.freezes ?? 0) < FREEZE_MAX) { st.freezes = (st.freezes ?? 0) + 1; got = { freeze: 1 } }
    else { earn(FREEZE_PRICE, 'Builder Pass', true); got = { coins: FREEZE_PRICE, full: true } }
  }
  else if (r.boost) { invAdd('xp', 'got', r.boost); got = { boost: r.boost } }
  else if (r.rush) { invAdd('rush', 'got', r.rush); got = { rush: r.rush } }
  else if (r.hot) { invAdd('hot', 'got', r.hot); got = { hot: r.hot } }
  else if (r.heal) { invAdd('heal', 'got', r.heal); got = { heal: r.heal } }
  else if (r.pack) { got = { pack: r.pack, min: r.min }; openPack(r.pack, r.min) }
  else if (r.item) {
    if (S.owned[r.item]) { const n = DUP_COINS[itemById(r.item)?.rarity ?? 0]; earn(n, 'Builder Pass', true); got = { item: r.item, dup: n } }
    else { S.owned[r.item] = Date.now(); got = { item: r.item } }
  }
  S.walletAt = Date.now()
  emit()
  return got
}
// A card pack: random players from the game's pools (football and basketball, current and
// all-time); `min` is the lowest rarity of the first card (1 Rare, 2 Epic, 3 Legend)
const PACK_POS = { nfl: ['qb', 'rb', 'wr', 'te', 'db'], bucket: ['guard', 'big'] }
async function openPack(n, min = 0) {
  const { seasonKit } = await import('./verifyCore')
  const pick = list => list[Math.floor(Math.random() * list.length)]
  for (let k = 0; k < n; k++) {
    const sport = Math.random() < 0.7 ? 'nfl' : 'bucket'
    const pos = pick(PACK_POS[sport])
    const mode = Math.random() < 0.3 ? 'all-time' : 'classic'
    const pool = seasonKit(sport, pos, mode)?.pool ?? []
    const fits = k === 0 && min ? pool.filter(p => rarityRank(pool, p) >= min) : pool
    const player = pick(fits.length ? fits : pool)
    if (player) addCard({ sport, pos, mode, player, pool, pack: true })
  }
}
// Who bought which season's pass (pass_owners: a player can read their own rows)
async function loadPassOwners(id = uid) {
  if (!supabase || !id) return false
  try {
    const { data, error } = await supabase.from('pass_owners').select('season').eq('user_id', id)
    if (error || uid !== id) return false
    const had = passOwn.size
    passOwn = new Set((data ?? []).map(r => r.season))
    try { localStorage.setItem(passOwnKey(id), JSON.stringify([...passOwn])) } catch {}
    emit(true)
    return passOwn.size > had
  } catch { return false }
}
export const refreshPass = () => loadPassOwners(uid)
// Back from Stripe (?pass=1): the webhook can land a moment after us, so ask a few times
export function watchPassReturn() {
  try {
    const u = new URL(window.location.href)
    if (!u.searchParams.has('pass')) return
    u.searchParams.delete('pass')
    window.history.replaceState({}, '', u.pathname + (u.search ? u.search : '') + u.hash)
  } catch { return }
  let tries = 0
  const tick = async () => {
    const s = passSeason(dayKey())
    if (uid && ((await loadPassOwners(uid)) || (s && passOwn.has(s.id)))) { window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'pass' })); return }
    if (++tries < 10) setTimeout(tick, 3000)
  }
  setTimeout(tick, 1500)
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
// potdPaid, dc, day and sets ride along so clearing the device (or a second one) can't pay a reward twice
const WALLET_KEYS = ['coins', 'coinsEarned', 'owned', 'equip', 'ach', 'achClaimed', 'stats', 'shopFree', 'levelPaid', 'discordPaid', 'feedbackPaid', 'retired', 'potdPaid', 'dc', 'day', 'sets', 'salInf', 'streak', 'unlocks', 'cards', 'pass', 'inv', 'cupPaid', 'cupWon']
let pushTimer = null, pushing = false, pushAgain = false
function schedulePush() {
  if (!supabase || !uid) return
  clearTimeout(pushTimer)
  const id = uid
  pushTimer = setTimeout(() => runPush(id), 2500)
}
// This device's id: XP and today's tally are kept per device and added up across the account
const DEV = (() => { try { let d = localStorage.getItem('bap_dev_id'); if (!d) { d = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)); localStorage.setItem('bap_dev_id', d) } return d } catch { return 'dev' } })()
function walletOut() {
  const app_profile = Object.fromEntries(WALLET_KEYS.map(k => [k, S[k]]))
  app_profile.at = S.walletAt
  app_profile.bonus = { ...(S.bonusOther || {}), [DEV]: S.bonusXp }
  const tday = Object.fromEntries(Object.entries(S.todayOther || {}).filter(([, v]) => v?.d === dayKey()))
  if (S.today?.d === dayKey()) tday[DEV] = S.today
  app_profile.todayBy = tday
  return app_profile
}
// Pull, merge, push: the account's wallet as it is now, plus what changed here
async function runPush(id) {
  if (pushing) { pushAgain = true; return }
  pushing = true
  try {
    // a save only lands if nobody saved since we read (rev): otherwise read, merge and try again,
    // so two devices saving at the same moment can't erase each other's coins
    for (let tries = 0; tries < 4 && uid === id; tries++) {
      const { data, error } = await supabase.from('accounts').select('app_profile').eq('id', id).maybeSingle()
      if (error || uid !== id) return
      const w = data?.app_profile
      if (w) mergeRemote(w)
      const app_profile = { ...walletOut(), rev: `${DEV.slice(0, 8)}-${Date.now().toString(36)}-${tries}` }
      let q = supabase.from('accounts').update({ app_profile }).eq('id', id)
      if (w?.rev) q = q.eq('app_profile->>rev', w.rev)
      const { data: saved, error: wErr } = await q.select('id')
      if (wErr) break
      if (saved?.length) { S.coinsSynced = app_profile.coins; break }
    }
    settleLocal()
    pushCos(id)
  } catch {} finally {
    pushing = false
    if (pushAgain) { pushAgain = false; schedulePush() }
  }
}
// Store and show the merged wallet without starting another push
function settleLocal() {
  try { localStorage.setItem(keyFor(uid), JSON.stringify(S)) } catch {}
  snap = makeSnap()
  listeners.forEach(fn => fn())
  window.dispatchEvent(new CustomEvent('bap:progress'))
}
// The public copy of my look (leaderboards, results: supabase/public_cosmetics.sql).
// Its own write, so a database without the column never blocks the wallet.
let cosSent = ''
// The public profile (accounts.cos): the looks everyone sees, plus the level and
// online rating a friend's profile shows
function pushCos(id = uid) {
  if (!supabase || !id) return
  const o = S.stats?.online
  // today's tally and the day before (yesterday's board pays out the morning after: payPlayersOfDay)
  // today's tally: this device's plus the account's other devices' (Players of the Day)
  const others = Object.values(S.todayOther || {}).filter(v => v?.d === S.today?.d)
  const today = S.today ? { ...S.today, xp: S.today.xp + others.reduce((a, v) => a + (v.xp || 0), 0), g: S.today.g + others.reduce((a, v) => a + (v.g || 0), 0) } : null
  const cos = { ...myCosmetics(), level: levelInfo(totalXp()).level, rating: o?.played ? o.rating : null, today, yday: S.prevDay ?? null }, key = id + JSON.stringify(cos)
  if (key === cosSent) return
  cosSent = key
  supabase.from('accounts').update({ cos }).eq('id', id).then(({ error }) => { if (error) cosSent = '' }, () => { cosSent = '' })
}
// The account row carries the name the game shows, and has to exist for the wallet
// to save: a Discord sign-in never wrote either (its name lives in the Discord
// profile). Once a session, the row is made if missing and the name brought up to date;
// lists that read accounts.username (Players of the Day, friend search) then find it.
let namedFor = null
function syncName(id) {
  const name = getUsername(user)
  if (!supabase || !id || !name || namedFor === id) return
  namedFor = id
  supabase.from('accounts').upsert({ id, username: name }, { onConflict: 'id' }).then(({ error }) => { if (error) namedFor = null }, () => { namedFor = null })
}
// the same day on both sides: merge it; otherwise the later day wins
const mergeDay = (a, b, both) => (!b ? a : !a ? b : a.key === b.key ? both(a, b) : (String(a.key) > String(b.key) ? a : b))
let pulledFor = null
// The account's wallet merged into this device's: items, achievements and counters are
// combined (never lost), coins move by what changed on each side since the last sync,
// XP and today's tally add up per device, the login streak follows the latest day
function mergeRemote(w) {
  if (!w || typeof w !== 'object') return
  const newer = (w.at ?? 0) > (S.walletAt ?? 0)
  // this device's first merge with the account: its own copy can look newer only because
  // something was stamped here before the account's wallet arrived (achievements unlocked
  // from the season rebuild): the account's coins and look still win, never a blank device's
  const first = S.coinsSynced == null
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
  if (String(w.potdPaid ?? '') > String(S.potdPaid ?? '')) S.potdPaid = w.potdPaid
  if (String(w.cupPaid ?? '') > String(S.cupPaid ?? '')) { S.cupPaid = w.cupPaid; S.cupWon = w.cupWon ?? S.cupWon }
  S.sets = { ...(w.sets || {}), ...(S.sets || {}) }
  S.dc = mergeDay(S.dc, w.dc, (a, b) => ({ ...b, ...a, spins: Math.max(a.spins || 0, b.spins || 0), done: !!(a.done || b.done),
    forfeit: !!(a.forfeit || b.forfeit), posted: !!(a.posted || b.posted), ovr: a.ovr ?? b.ovr ?? null }))
  S.salInf = mergeDay(S.salInf, w.salInf, (a, b) => ({ ...a, n: Math.max(a.n || 0, b.n || 0) }))
  S.day = mergeDay(S.day, w.day, (a, b) => ({ ...a, missions: (a.missions || []).map(m => {
    const o = (b.missions || []).find(x => x.id === m.id)
    return o ? { ...m, n: Math.max(m.n || 0, o.n || 0), claimed: !!(m.claimed || o.claimed) } : m
  }) }))
  if (typeof w.coins === 'number') {
    // what this device earned or spent since the last sync, on top of the account's coins now
    if (S.coinsSynced != null) S.coins = Math.max(0, w.coins + (S.coins - S.coinsSynced))
    else S.coins = newer ? w.coins : Math.max(w.coins, S.coins || 0)
    S.coinsSynced = w.coins
  }
  // XP from missions, logins, cards…: each device's own count, added up
  S.bonusOther = { ...(S.bonusOther || {}) }
  for (const [d, xp] of Object.entries(w.bonus || {})) {
    if (d === DEV) S.bonusXp = Math.max(S.bonusXp, +xp || 0)
    else S.bonusOther[d] = Math.max(S.bonusOther[d] || 0, +xp || 0)
  }
  // today's tally (Players of the Day): each device's own, added up when it's shown
  S.todayOther = Object.fromEntries(Object.entries({ ...(S.todayOther || {}), ...(w.todayBy || {}) })
    .filter(([d, v]) => d !== DEV && v?.d === dayKey())
    .map(([d, v]) => [d, (S.todayOther?.[d]?.xp ?? 0) > (v.xp ?? 0) ? S.todayOther[d] : v]))
  if (w.todayBy?.[DEV]?.d === dayKey() && S.today?.d === dayKey()) {
    S.today = { ...S.today, xp: Math.max(S.today.xp, w.todayBy[DEV].xp || 0), g: Math.max(S.today.g, w.todayBy[DEV].g || 0) }
  }
  // the login streak: the side that saw the latest day; rewards claimed on either side stay claimed
  if (w.streak && typeof w.streak === 'object') {
    const a = S.streak, b = w.streak
    const keep = String(b.last ?? '') > String(a.last ?? '') ? b : a
    const same = a.start && a.start === b.start   // the same streak on both: rewards claimed on either stay claimed
    S.streak = { ...keep, best: Math.max(a.best || 0, b.best || 0), claimed: same ? { ...(b.claimed || {}), ...(a.claimed || {}), every: Math.max(a.claimed?.every || 0, b.claimed?.every || 0) } : { ...(keep.claimed || {}) },
      freezes: a.last === b.last ? Math.max(a.freezes || 0, b.freezes || 0) : (keep.freezes || 0) }
  }
  S.unlocks = { ...(w.unlocks || {}), ...(S.unlocks || {}) }
  // the Builder Pass: the lowest starting XP any device saw, tiers claimed on either side
  if (w.pass && typeof w.pass === 'object') {
    const lo = (a, b) => (a == null ? b ?? null : b == null ? a : Math.min(a, b))
    const out = { ...(S.pass || {}) }
    for (const [k, b] of Object.entries(w.pass)) {
      if (!b || typeof b !== 'object') continue
      const a = out[k] || {}
      out[k] = { base: lo(a.base, b.base), final: lo(a.final, b.final), f: { ...(b.f || {}), ...(a.f || {}) }, p: { ...(b.p || {}), ...(a.p || {}) } }
    }
    S.pass = out
  }
  // boosts: each device's own counts, the larger of the two copies
  if (w.inv && typeof w.inv === 'object') {
    const out = { ...(S.inv || {}) }
    for (const [d, b] of Object.entries(w.inv)) {
      if (!b || typeof b !== 'object') continue
      const a = out[d] || {}
      const mx = f => Object.fromEntries([...new Set([...Object.keys(a[f] || {}), ...Object.keys(b[f] || {})])].map(k => [k, Math.max(+a[f]?.[k] || 0, +b[f]?.[k] || 0)]))
      out[d] = { got: mx('got'), used: mx('used') }
    }
    S.inv = out
  }
  // the card binder: everything collected on any device, the most copies, the first time seen
  if (w.cards && typeof w.cards === 'object') {
    const c = { ...(S.cards || {}) }
    for (const [k, v] of Object.entries(w.cards)) {
      if (!Array.isArray(v)) continue
      c[k] = c[k] ? [Math.max(c[k][0] || 0, v[0] || 0), Math.min(c[k][1] || v[1], v[1] || c[k][1])] : v
    }
    S.cards = c
  }
  // a level's coins are paid once for the account, whichever device got there first
  S.levelPaid = Math.max(S.levelPaid || 0, w.levelPaid || 0)
  if (newer || first) {
    S.equip = { ...DEFAULTS, ...(w.equip || {}) }
    S.shopFree = w.shopFree ?? S.shopFree
    S.walletAt = w.at ?? S.walletAt
  }
  retireItems(S)                          // after the merge, so the refund survives a newer cloud wallet
}
async function pullWallet(id) {
  if (!supabase || !id) return
  try {
    const { data, error } = await supabase.from('accounts').select('app_profile').eq('id', id).maybeSingle()
    if (error || uid !== id) return
    // a new account's wallet is empty: nothing to merge, but today is rolled here (the login streak waited for this)
    if (data?.app_profile) mergeRemote(data.app_profile)
    pulledFor = id
    rollDay()
    emit(true)
  } catch {}
}
