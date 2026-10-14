// TRAIT AUCTION: the rules, shared by the app (lib/auction.js) and the live server
// (live/src/auction.js), so the server enforces exactly what the app shows. Pure:
// no React, no network, no storage. The kit here is everything the rules need
// (the slots, the pool, a lot's numbers, a build's OVR); the app adds the photos
// and labels on top.

import { seeded } from './rng'
import { calcOVR } from '../utils/simulation'
import { calcBucketOVR } from '../utils/bucketSimulation'
import { TYPES, ATTR } from '../data/qbs'
import { GUARD_TYPES } from '../data/nba-guards'
import { BIG_TYPES } from '../data/nba-bigs'
import { BUCKET_ATTR } from '../data/nba-attrs'
import { QB_SAL_COLS, QB_SAL_POOL } from '../data/qb-salary'
import { SAL_COLS, BUCKET_SAL_POOL } from '../data/nba-salary'

export const AUCTION_SIZE = 3
export const AUCTION_MIN = 2         // real players only; three starts at once, two when the countdown runs out
export const AUCTION_FILL_SECS = 60   // the countdown: starts over every time someone joins
export const BUDGET = 100
export const BID_SECS = 8           // the clock when a lot opens, before anyone bids
export const RESET_SECS = 6         // every bid puts the clock back up to this: going once at 4, twice at 2
export const SPIN_MS = 3400         // the card shuffle + the reel, before bidding opens
export const SOLD_MS = 2400         // the gavel, before the next spin
export const GRACE_MS = 450                // late bids still in flight when the window shuts
export const FILLER_VAL = 3         // a slot nobody won by the end: a free agent

// Football is QB only; basketball has both spots
export const AUCTION_POS = { nfl: ['qb'], bucket: ['guard', 'big'] }
const avg = vs => (vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : 5)

// Everything the auction needs to know about a sport + position. The slots are
// Salary Cap's five columns; each covers one to three of the position's traits.
// Traits no slot covers (basketball's IQ, clutch, rebounding…) come from the
// average of the players you won, the way Salary Cap fills them.
export function auctionCoreKit(sport, pos) {
  const bucket = sport === 'bucket'
  const p = bucket ? (pos === 'big' ? 'big' : 'guard') : 'qb'
  const posTypes = bucket ? (p === 'big' ? BIG_TYPES : GUARD_TYPES) : TYPES
  const attr = bucket ? BUCKET_ATTR : ATTR
  const slots = bucket
    ? SAL_COLS.map(c => ({ key: c.key, label: c.label, types: p === 'big' ? c.bigTypes : c.guardTypes, alt: p === 'big' ? c.guardTypes : c.bigTypes }))
    : QB_SAL_COLS.map(c => ({ key: c.key, label: c.label, types: c.types, alt: [] }))
  const bySlot = Object.fromEntries(slots.map(sl => [sl.key, sl]))
  const covered = new Set(slots.flatMap(sl => sl.types))
  const loose = posTypes.filter(t => !covered.has(t))
  const valOf = (pl, sl, t) => pl.attrs?.[t] ?? sl.alt.map(a => pl.attrs?.[a]).find(v => v != null) ?? 5
  const ovr = bucket ? b => calcBucketOVR(b, posTypes, p) : b => calcOVR(b, posTypes)
  return {
    sport: bucket ? 'bucket' : 'nfl', pos: p,
    types: slots.map(sl => sl.key),                       // the auction's slots
    pool: bucket ? BUCKET_SAL_POOL : QB_SAL_POOL,
    attrLabel: k => bySlot[k]?.label ?? k,
    slotTraits: k => (bySlot[k]?.types ?? []).map(t => attr[t]?.label ?? t),
    // a lot: the player's numbers for the slot's traits (its grade is their average), plus the loose traits
    lotOf: (pl, k) => {
      const sl = bySlot[k]
      const vals = Object.fromEntries(sl.types.map(t => [t, valOf(pl, sl, t)]))
      const extra = Object.fromEntries(loose.filter(t => pl.attrs?.[t] != null).map(t => [t, pl.attrs[t]]))
      return { trait: k, name: pl.name, team: pl.team, val: Math.round(avg(Object.values(vals)) * 10) / 10, vals, extra }
    },
    // the full build behind a set of won slots (free agents in the empty ones)
    buildOf: won => {
      const b = {}
      for (const sl of slots) {
        const w = won?.[sl.key]
        for (const t of sl.types) b[t] = { type: t, val: w ? w.vals?.[t] ?? w.val : FILLER_VAL, qbFull: w?.name ?? 'Free agent', team: w?.team ?? null }
      }
      const got = Object.values(won ?? {})
      for (const t of loose) b[t] = { type: t, val: avg(got.map(w => w.extra?.[t]).filter(v => v != null)), qbFull: 'Team average', team: null }
      return b
    },
    calcOvr: b => Math.round(ovr(b) ?? 0),
  }
}

// ── The ledger (pure: the hook and the tests share it) ──────────────────────
export const freshLedger = players => ({
  wallets: Object.fromEntries(players.map(p => [p.vid, BUDGET])),
  won: Object.fromEntries(players.map(p => [p.vid, {}])),
  out: [],
  log: [],
})
export const openSlots = (L, vid, types) => types.filter(t => !L.won[vid]?.[t])
// you always keep $1 for each other empty slot, so you can fill them all
export function maxBid(L, vid, types) {
  const open = openSlots(L, vid, types).length
  return open ? Math.max(0, (L.wallets[vid] ?? 0) - (open - 1)) : 0
}
export const canBidOn = (L, vid, types, trait) => !L.out.includes(vid) && !L.won[vid]?.[trait] && maxBid(L, vid, types) >= 1
export const minNext = high => (high ? high.amount + 1 : 1)
// a set number of lots, so nobody can stall it by never bidding: whatever's
// still empty at the end is a free agent
export const maxLots = m => m.players.length * m.types.length + 10
export const auctionOver = (L, m, n) => n >= maxLots(m) || m.players.filter(p => !L.out.includes(p.vid)).every(p => openSlots(L, p.vid, m.types).length === 0)

// The next lot: a trait somebody still needs (the ones most of the room needs
// come up more), on a real player who has it
export function pickLot(m, L, kit, n) {
  const r = seeded(`${m.seed}:lot:${n}`)
  const live = m.players.filter(p => !L.out.includes(p.vid))
  const need = {}
  for (const p of live) for (const t of openSlots(L, p.vid, m.types)) need[t] = (need[t] || 0) + 1
  const bag = m.types.filter(t => need[t]).flatMap(t => Array(need[t]).fill(t))
  if (!bag.length) return null
  const trait = bag[Math.floor(r() * bag.length)]
  const cands = [...kit.pool].sort((a, b) => a.name.localeCompare(b.name))
  const pl = cands[Math.floor(r() * cands.length)]
  return { n, ...kit.lotOf(pl, trait) }
}

export function rankAuction(m, L, kit) {
  if (!m || !L) return []
  return m.players
    .map(p => {
      const won = L.won[p.vid] ?? {}
      const slots = Object.fromEntries(m.types.map(k => [k, won[k] ?? { val: FILLER_VAL, name: 'Free agent', price: 0 }]))
      const quit = L.out.includes(p.vid)
      return { ...p, slots, ovr: quit ? -1 : kit.calcOvr(kit.buildOf(won)), left: L.wallets[p.vid] ?? 0, forfeit: quit }
    })
    .sort((a, b) => b.ovr - a.ovr || b.left - a.left || a.vid.localeCompare(b.vid))
    .map((p, i) => ({ ...p, place: i + 1 }))
}

// When the hammer falls: the clock runs from the open, or from the last bid
export const lotEnd = (s, m) => (s.last ? s.last + (m.reset ?? RESET_SECS) * 1000 : s.t0 + SPIN_MS + m.bidSecs * 1000)
// what the auctioneer's calling, by the time left
export const callOf = left => (left > 4000 ? null : left > 2000 ? 'once' : 'twice')

const leaderOf = list => [...list].map(p => p.vid).sort()[0] ?? null

// Every client checks a ledger the room sends before taking it: wallets only go
// down and never below zero, a trait once won stays won, every won trait is a
// real player's real numbers for that slot, and each wallet is the budget less
// exactly what its traits cost. A crafted 'sold' or 'done' can't hand anyone 99s
// or rewrite who paid for what.
export function ledgerOk(prev, next, m, kit) {
  if (!next || !prev || typeof next !== 'object') return false
  const realLot = (w, t) => {
    if (!w || !m.types.includes(t)) return false
    const pl = kit.pool.find(x => x.name === w.name)
    if (!pl) return false
    return Math.abs(kit.lotOf(pl, t).val - Number(w.val)) < 0.01
  }
  for (const { vid } of m.players) {
    const wNew = Number(next.wallets?.[vid]), wOld = Number(prev.wallets?.[vid])
    if (!(wNew >= 0) || wNew > wOld) return false
    const won = next.won?.[vid] ?? {}, had = prev.won?.[vid] ?? {}
    let spent = 0
    for (const [t, w] of Object.entries(won)) { if (!realLot(w, t)) return false; spent += Number(w.price) || 0 }
    for (const [t, w] of Object.entries(had)) if (!won[t] || won[t].name !== w.name) return false
    if (BUDGET - wNew !== spent) return false
  }
  if ((prev.out ?? []).some(v => !(next.out ?? []).includes(v))) return false
  return true
}

