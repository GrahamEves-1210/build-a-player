// TRAIT AUCTION: the rules, shared by the app (lib/auction.js) and the live server
// (live/src/auction.js), so the server enforces exactly what the app shows. Pure:
// no React, no network, no storage. The kit here is everything the rules need
// (the slots, the pool, a lot's numbers, a build's OVR); the app adds the photos
// and labels on top.

import { seeded } from './rng'
import { calcOVR, calcOVRRB, calcOVRWR } from '../utils/simulation'
import { calcBucketOVR } from '../utils/bucketSimulation'
import { ATTR } from '../data/qbs'
import { GUARD_TYPES } from '../data/nba-guards'
import { BIG_TYPES } from '../data/nba-bigs'
import { BUCKET_ATTR } from '../data/nba-attrs'
import { FB_SAL } from '../data/fb-salary'
import { SAL_COLS, BUCKET_SAL_POOL } from '../data/nba-salary'

export const AUCTION_SIZE = 3       // a room of three bidders
export const AUCTION_MIN = 2         // real players only: two start when the countdown runs out (or either asks)
export const AUCTION_FILL_SECS = 30   // the countdown: starts over every time someone joins
export const BUDGET = 20            // every dollar counts: you always keep $1 for each other empty slot
const BETTER_ODDS = 0.6           // how often a lot is the better of two players drawn (pickLot)
export const BID_SECS = 8           // the clock when a lot opens, before anyone bids
export const RESET_SECS = 6         // every bid puts the clock back up to this: going once at 4, twice at 2
export const SPIN_MS = 3400         // the card shuffle + the reel, before bidding opens
export const BACK_SPIN_MS = 1400    // a card back from the deck: no reel, it's already face up
export const SOLD_MS = 2400         // the gavel, before the next spin
export const DRAW_MS = 2600         // the draw: the cards turning over for the slots still open (plus DRAW_STEP_MS each)
export const DRAW_STEP_MS = 420
export const GRACE_MS = 450                // late bids still in flight when the window shuts
export const FILLER_VAL = 3         // a slot nobody won by the end: a free agent

// Football: QB, RB or WR (each on its Salary Cap board's five slots); basketball: guard or big; soccer: the striker
export const AUCTION_POS = { nfl: ['qb', 'rb', 'wr'], bucket: ['guard', 'big'], soccer: ['st'] }
// One queue a sport (owner 11-26): nobody picks the position. When the room fills, its seed draws it, so every seat
// gets the same one and any phone can check the server's word (posOk). The queue asks for pos 'any'; a phone from
// before this asks for its own position and gets a room at that position, as it always did.
export const AUCTION_ANY = 'any'
export const auctionPosFor = (sport, seed) => {
  const list = AUCTION_POS[sport] ?? []
  return list.length <= 1 ? (list[0] ?? null) : list[Math.floor(seeded(`${seed}:pos`)() * list.length)]
}
export const posOk = m => !!m && (!m.anyPos || m.pos === auctionPosFor(m.sport, m.seed))
const NFL_OVR = { qb: calcOVR, rb: calcOVRRB, wr: calcOVRWR }
const avg = vs => (vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : 5)

// Everything the auction needs to know about a sport + position. The slots are
// Salary Cap's five columns; each covers one to three of the position's traits.
// Traits no slot covers (basketball's IQ, clutch, rebounding…) come from the
// average of the players you won, the way Salary Cap fills them.
// A sport whose rosters stay out of this file's bundle adds its kit (soccer: lib/soccerAuction.js, which the soccer
// app and the live worker import)
const ADDED_KITS = {}
export const addAuctionKit = (sport, make) => { ADDED_KITS[sport] = make }
export function auctionCoreKit(sport, pos) {
  if (ADDED_KITS[sport]) return ADDED_KITS[sport](pos)
  if (!AUCTION_POS[sport] || sport === 'soccer') throw new Error(`auction: no kit for ${sport}`)
  const bucket = sport === 'bucket'
  const p = bucket ? (pos === 'big' ? 'big' : 'guard') : AUCTION_POS.nfl.includes(pos) ? pos : 'qb'
  const fb = bucket ? null : FB_SAL[p]
  const posTypes = bucket ? (p === 'big' ? BIG_TYPES : GUARD_TYPES) : fb.types
  const attr = bucket ? BUCKET_ATTR : ATTR
  const slots = bucket
    ? SAL_COLS.map(c => ({ key: c.key, label: c.label, types: p === 'big' ? c.bigTypes : c.guardTypes, alt: p === 'big' ? c.guardTypes : c.bigTypes }))
    : fb.cols.map(c => ({ key: c.key, label: c.label, types: c.types, alt: [] }))
  // the position's own OVR, the same function its builds use, unrounded (calcOvr takes it to one decimal)
  const ovr = bucket ? b => calcBucketOVR(b, posTypes, p, true) : b => NFL_OVR[p](b, posTypes, true)
  return slotKit({ sport: bucket ? 'bucket' : 'nfl', pos: p, slots, posTypes, attr, pool: bucket ? BUCKET_SAL_POOL : fb.pool, ovr })
}

// The kit from a sport's five slots (each { key, label, types, alt }), its traits, their labels, the pool and its OVR
export function slotKit({ sport, pos, slots, posTypes, attr, pool, ovr }) {
  const bySlot = Object.fromEntries(slots.map(sl => [sl.key, sl]))
  const covered = new Set(slots.flatMap(sl => sl.types))
  const loose = posTypes.filter(t => !covered.has(t))
  const valOf = (pl, sl, t) => pl.attrs?.[t] ?? sl.alt.map(a => pl.attrs?.[a]).find(v => v != null) ?? 5
  return {
    sport, pos,
    types: slots.map(sl => sl.key),                       // the auction's slots
    pool,
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
    // to one decimal (87.4): whole numbers tied too often (owner 11-26)
    calcOvr: b => Math.round((ovr(b) ?? 0) * 10) / 10,
  }
}

// ── The ledger (pure: the hook and the tests share it) ──────────────────────
//   back: the cards that went unsold (their grades shown), which can come back up
//   closer: the first bidder to fill his build (the rest went to the draw)
export const freshLedger = players => ({
  wallets: Object.fromEntries(players.map(p => [p.vid, BUDGET])),
  won: Object.fromEntries(players.map(p => [p.vid, {}])),
  out: [],
  log: [],
  back: [],
  seen: [],
  closer: null,
})
export const openSlots = (L, vid, types) => types.filter(t => !L.won[vid]?.[t])
// you always keep $1 for each other empty slot, so you can fill them all
export function maxBid(L, vid, types) {
  const open = openSlots(L, vid, types).length
  return open ? Math.max(0, (L.wallets[vid] ?? 0) - (open - 1)) : 0
}
export const canBidOn = (L, vid, types, trait) => !L.out.includes(vid) && !L.won[vid]?.[trait] && maxBid(L, vid, types) >= 1
// can he still top what's on the lot (the slot open, not already high, the money for the next bid)
export const canTop = (L, vid, types, trait, high) => canBidOn(L, vid, types, trait) && high?.vid !== vid && maxBid(L, vid, types) >= minNext(high)
export const minNext = high => (high ? high.amount + 1 : 1)
// a set number of lots, so nobody can stall it by never bidding: whatever's
// still empty at the end is a free agent
export const maxLots = m => m.players.length * m.types.length + 10
export const auctionOver = (L, m, n) => n >= maxLots(m) || m.players.filter(p => !L.out.includes(p.vid)).every(p => openSlots(L, p.vid, m.types).length === 0)

const lotCard = l => ({ trait: l.trait, name: l.name, team: l.team, val: l.val, vals: l.vals, extra: l.extra })
const sameCard = (a, b) => a.trait === b.trait && a.name === b.name
const byName = pool => [...pool].sort((a, b) => a.name.localeCompare(b.name))

// The odds lean toward better cards (owner 11-26): a player comes up for a slot with weight 1 + GRADE_TILT x g², g his
// grade step there (0 = F … 11 = S, valToGrade's scale), for the lots and the draw alike. (Straight 1 + k·g flattens
// out at about +0.8 of a grade however big k gets; the square reaches a full grade at k = 0.06.) The average card is about one grade
// higher than an even draw (C+/B- → B/B+); S and A come up clearly more, C and D still come up. Seeded like
// everything else: one number from the seed picks the player, so the server, the phones and the ledger check agree.
// (scripts/auction/core-check.mjs prints the grade spread with and without it, for every sport and position.)
export let GRADE_TILT = 0.06
export const setGradeTilt = k => { GRADE_TILT = k; TILT.clear() }   // (the rules check only: it measures 0 against the real one)
const TILT = new Map()   // kit → slot → { cands, cum, total }
function tilted(kit, t) {
  let byKit = TILT.get(kit)
  if (!byKit) { byKit = {}; TILT.set(kit, byKit) }
  if (!byKit[t]) {
    const cands = byName(kit.pool)
    let total = 0
    const cum = cands.map(pl => (total += 1 + GRADE_TILT * Math.max(0, Math.min(11, Math.round(kit.lotOf(pl, t).val))) ** 2))
    byKit[t] = { cands, cum, total }
  }
  return byKit[t]
}
// one number in [0, 1) → a player for slot t, by those weights
export function pickFor(kit, t, x) {
  const { cands, cum, total } = tilted(kit, t)
  const want = x * total
  let lo = 0, hi = cum.length - 1
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] > want) hi = mid; else lo = mid + 1 }
  return cands[lo]
}

// The next lot: a trait somebody still needs (the ones most of the room needs
// come up more), on a real player who has it. Now and then it's a card that went
// back into the deck unsold: it comes up face up, its grade already known
export function pickLot(m, L, kit, n) {
  const r = seeded(`${m.seed}:lot:${n}`)
  const live = m.players.filter(p => !L.out.includes(p.vid))
  const need = {}
  for (const p of live) for (const t of openSlots(L, p.vid, m.types)) need[t] = (need[t] || 0) + 1
  const bag = m.types.filter(t => need[t]).flatMap(t => Array(need[t]).fill(t))
  if (!bag.length) return null
  const trait = bag[Math.floor(r() * bag.length)]
  // no repeats (owner 11-26): a player who has already come up, sold or not, never comes up again
  const seen = new Set(L.seen ?? [])
  const fresh = x => { for (let i = 0; i < 40; i++) { const pl = pickFor(kit, trait, i ? r() : x); if (!seen.has(seenKey(pl.name))) return pl } return null }
  // a slightly better field than pure chance: a second player is drawn, and
  // the better of the two at this slot is the lot most of the time (each drawn by the grade-leaning odds above)
  const one = fresh(r()), two = fresh(r())
  if (!one) return null
  const a = kit.lotOf(one, trait), b = two ? kit.lotOf(two, trait) : a
  return { n, ...(r() < BETTER_ODDS && b.val > a.val ? b : a) }
}
// a lot up: it's been seen, and never comes up again in this auction (owner 11-26: no repeats)
export const seenKey = name => name   // a player, whatever the slot: like Salary Cap's board, nobody comes up twice
export const takeLot = (L, lot) => (lot ? { ...L, seen: [...(L.seen ?? []), seenKey(lot.name)] } : L)
// no bids: the card is gone (it never comes back; owner 11-26)
export function returnLot(L) { return L }

// Somebody has filled his build while others still have open slots: that's the
// auction. Every other bidder's open slots are dealt a random card
// (any player in the pool, by the grade-leaning odds, at no cost), one seeded draw a seat a slot, so it's
// the same on every phone and the server's word can be checked
// (owner 11-27: with three in, the first to fill is done and the other two keep bidding; the draw comes only when one
// bidder is left building, and deals his open slots)
export const stillBuilding = (L, m) => m.players.filter(p => !L.out.includes(p.vid) && openSlots(L, p.vid, m.types).length > 0)
export const finishedEarly = (L, m, vid) => !!vid && !L.out.includes(vid) && openSlots(L, vid, m.types).length === 0
  && stillBuilding(L, m).length === 1
// the first to fill his build (the tiebreak's "filled first"), marked the moment he does
export const markCloser = (L, m, vid) => (!L.closer && vid && openSlots(L, vid, m.types).length === 0 ? { ...L, closer: vid } : L)
// (seen: the player-slots that already came up, or were dealt; the draw never repeats one)
export function drawCard(m, kit, vid, t, seen = null) {
  const r = seeded(`${m.seed}:draw:${vid}:${t}`)
  let pl = pickFor(kit, t, r())
  for (let i = 0; seen && seen.has(seenKey(pl.name)) && i < 40; i++) pl = pickFor(kit, t, r())
  seen?.add(seenKey(pl.name))
  return lotCard(kit.lotOf(pl, t))
}
export function drawFor(m, L, kit) {
  const cards = {}, seen = new Set(L.seen ?? [])
  for (const p of m.players) {
    if (L.out.includes(p.vid)) continue
    for (const t of openSlots(L, p.vid, m.types)) (cards[p.vid] ??= {})[t] = drawCard(m, kit, p.vid, t, seen)
  }
  return cards
}
// the draw, into the ledger: free, and marked as drawn
export function applyDraw(L, cards, by) {
  const won = { ...L.won }
  for (const [vid, got] of Object.entries(cards)) {
    won[vid] = { ...won[vid] }
    for (const [t, c] of Object.entries(got)) won[vid][t] = { val: c.val, vals: c.vals, extra: c.extra, name: c.name, team: c.team, price: 0, drawn: true }
  }
  return { ...L, won, closer: L.closer ?? by }
}

export function rankAuction(m, L, kit) {
  if (!m || !L) return []
  return m.players
    .map(p => {
      const won = L.won[p.vid] ?? {}
      const slots = Object.fromEntries(m.types.map(k => [k, won[k] ?? { val: FILLER_VAL, name: 'Free agent', price: 0 }]))
      const quit = L.out.includes(p.vid)
      return { ...p, slots, ovr: quit ? -1 : kit.calcOvr(kit.buildOf(won)), left: L.wallets[p.vid] ?? 0, forfeit: quit, closer: L.closer === p.vid }
    })
    // OVR to one decimal; dead level, the money left (spent less for the same build), then whoever filled his build
    // first (it ended the auction), then the seat (owner 11-26: money before filling first)
    .sort((a, b) => b.ovr - a.ovr || b.left - a.left || (b.closer - a.closer) || a.vid.localeCompare(b.vid))
    .map((p, i) => ({ ...p, place: i + 1 }))
}

// When the hammer falls: the clock runs from the open, or from the last bid
export const spinOf = lot => (lot?.known ? BACK_SPIN_MS : SPIN_MS)
export const lotEnd = (s, m) => (s.last ? s.last + (m.reset ?? RESET_SECS) * 1000 : s.t0 + spinOf(s.lot) + m.bidSecs * 1000)
// what the auctioneer's calling, by the time left
export const callOf = left => (left > 4000 ? null : left > 2000 ? 'once' : 'twice')

// Every client checks a ledger the room sends before taking it: wallets only go
// down and never below zero, a trait once won stays won, every won trait is a
// real player's real numbers for that slot, and each wallet is the budget less
// exactly what its traits cost. A crafted 'sold' or 'done' can't hand anyone 99s
// or rewrite who paid for what.
export function ledgerOk(prev, next, m, kit) {
  if (!next || !prev || typeof next !== 'object') return false
  // the room's position is the one its seed draws (a room that drew it)
  if (!posOk(m) || (kit && m.pos && kit.pos !== m.pos)) return false
  const realLot = (w, t) => {
    if (!w || !m.types.includes(t)) return false
    const pl = kit.pool.find(x => x.name === w.name)
    if (!pl) return false
    return Math.abs(kit.lotOf(pl, t).val - Number(w.val)) < 0.01
  }
  let dealt = null   // the draw, worked out from the ledger before it (it never repeats a card that came up)
  for (const { vid } of m.players) {
    const wNew = Number(next.wallets?.[vid]), wOld = Number(prev.wallets?.[vid])
    if (!(wNew >= 0) || wNew > wOld) return false
    const won = next.won?.[vid] ?? {}, had = prev.won?.[vid] ?? {}
    let spent = 0
    for (const [t, w] of Object.entries(won)) {
      if (!realLot(w, t)) return false
      // a drawn card: free, and exactly the seeded draw for this seat and slot
      if (w.drawn && !had[t]) { dealt ??= drawFor(m, prev, kit); if (Number(w.price) !== 0 || dealt[vid]?.[t]?.name !== w.name) return false }
      spent += Number(w.price) || 0
    }
    for (const [t, w] of Object.entries(had)) if (!won[t] || won[t].name !== w.name) return false
    if (BUDGET - wNew !== spent) return false
  }
  if ((prev.out ?? []).some(v => !(next.out ?? []).includes(v))) return false
  return true
}

