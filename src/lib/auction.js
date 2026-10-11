// TRAIT AUCTION — a Compete mode. Up to five real players, $100 each, four
// empty trait slots each. The spinner lands on a real player and one of their
// traits; everyone has BID_SECS to bid on it, and the high bid wins the trait.
// It runs until every slot is filled, then the builds are ranked by OVR
// (money left breaks a tie).
//   queue   → wait for players (2+ real players, never bots — like the pools)
//   auction → lots: spin → bidding → sold
//   result  → the ranking; your place goes to your Compete record
// The auctioneer is the leader (lowest vid present): it picks each lot, takes
// the bids, and calls them sold. Its calls carry the whole ledger (wallets,
// who won what), so a client that blinked catches up on the next one. If the
// auctioneer drops, the next-lowest vid finishes the open lot and carries on;
// lots are picked from the seed and the ledger, so either one picks the same.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { joinRoom, genCode, myVid } from './live'
import { seeded } from './rng'
import { getUsername } from './discord'
import { myCosmetics } from './progress'
import { SPORT } from './career'
import { calcOVR, calcOVRRB, calcOVRWR, calcOVRTE } from '../utils/simulation'
import { calcBucketOVR } from '../utils/bucketSimulation'
import { LITE_TYPES } from '../data/qbs'
import { RB_LITE_TYPES } from '../data/rbs'
import { WR_LITE_TYPES } from '../data/wrs'
import { TE_LITE_TYPES } from '../data/tes'
import { BUCKET_LITE_TYPES } from '../data/nba-attrs'

export const AUCTION_SIZE = 5
export const AUCTION_MIN = 2
export const AUCTION_FILL_SECS = 30
export const BUDGET = 100
export const BID_SECS = 10          // the bidding window on each lot
export const SPIN_MS = 2600         // the reel, before bidding opens
export const SOLD_MS = 2400         // the gavel, before the next spin
const GRACE_MS = 450                // late bids still in flight when the window shuts
export const FILLER_VAL = 3         // a slot nobody won by the end: a free agent

export const AUCTION_POS = { nfl: ['qb', 'rb', 'wr', 'te'], bucket: ['guard', 'big'] }
const LITE = { qb: LITE_TYPES, rb: RB_LITE_TYPES, wr: WR_LITE_TYPES, te: TE_LITE_TYPES, guard: BUCKET_LITE_TYPES, big: ['finishing', 'rebounding', 'interiorDefense', 'size'] }
const NFL_OVR = { qb: calcOVR, rb: calcOVRRB, wr: calcOVRWR, te: calcOVRTE }

// Everything the auction needs to know about a sport + position
export function auctionKit(sport, pos) {
  const S = SPORT[sport] ?? SPORT.nfl
  const p = AUCTION_POS[S.id].includes(pos) ? pos : AUCTION_POS[S.id][0]
  const types = LITE[p]
  const attr = S.attr[p] ?? {}
  const ovr = S.isBucket ? b => calcBucketOVR(b, types, p) : b => NFL_OVR[p](b, types)
  return {
    sport: S.id, pos: p, types, label: S.label[p],
    pool: S.pool[p].filter(x => x.attrs && types.some(t => x.attrs[t] != null)),
    attrLabel: t => attr[t]?.label ?? t,
    photo: S.photo, logo: S.logo,
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
  const cands = kit.pool.filter(p => p.attrs[trait] != null).sort((a, b) => a.name.localeCompare(b.name))
  const pl = cands[Math.floor(r() * cands.length)]
  return { n, trait, name: pl.name, team: pl.team, val: pl.attrs[trait] }
}

// A build from what you won (free agents in any slot left empty)
export function buildFrom(L, vid, types) {
  return Object.fromEntries(types.map(t => {
    const w = L.won[vid]?.[t]
    return [t, w ? { type: t, val: w.val, qbFull: w.name, team: w.team, price: w.price } : { type: t, val: FILLER_VAL, qbFull: 'Free agent', team: null, price: 0 }]
  }))
}
export function rankAuction(m, L, kit) {
  if (!m || !L) return []
  return m.players
    .map(p => {
      const build = buildFrom(L, p.vid, m.types)
      const quit = L.out.includes(p.vid)
      return { ...p, build, ovr: quit ? -1 : kit.calcOvr(build), left: L.wallets[p.vid] ?? 0, forfeit: quit }
    })
    .sort((a, b) => b.ovr - a.ovr || b.left - a.left || a.vid.localeCompare(b.vid))
    .map((p, i) => ({ ...p, place: i + 1 }))
}

const leaderOf = list => [...list].map(p => p.vid).sort()[0] ?? null

// ── The hook ─────────────────────────────────────────────────────────────────
export function useAuction({ enabled, user, sport, pos }) {
  const kit = useMemo(() => auctionKit(sport, pos), [sport, pos])
  const me = useMemo(() => ({ vid: myVid(), name: user ? (getUsername(user) || 'Player') : 'Guest', uid: user?.id ?? null, cos: myCosmetics() }), [user?.id]) // eslint-disable-line
  const [phase, setPhase] = useState('idle')         // idle | queue | auction | result
  const [queue, setQueue] = useState([])
  const [link, setLink] = useState('connecting')
  const [waited, setWaited] = useState(0)
  const [match, setMatch] = useState(null)           // { code, seed, created, sport, pos, types, bidSecs, players }
  const [present, setPresent] = useState([])
  // the floor: lot n, its stage, the high bid, who passed, and the ledger
  const [st, setSt] = useState(null)                 // { n, stage: 'wait'|'lot'|'sold', lot, t0, high, passed, sold, soldAt, L }
  const [now, setNow] = useState(Date.now())
  const queueRef = useRef(null)
  const roomRef = useRef(null)
  const stRef = useRef(null); stRef.current = st
  const matchRef = useRef(null); matchRef.current = match
  const presentRef = useRef([]); presentRef.current = present
  const kitRef = useRef(kit); kitRef.current = kit
  const booked = useRef(null)
  const entered = useRef(0)

  const leave = useCallback(() => {
    queueRef.current?.leave(); queueRef.current = null
    roomRef.current?.leave(); roomRef.current = null
    setPhase('idle'); setQueue([]); setMatch(null); setSt(null); setPresent([]); setWaited(0)
  }, [])
  useEffect(() => { if (!enabled) leave() }, [enabled, leave])
  useEffect(() => () => leave(), [leave])

  const amLeader = () => {
    const m = matchRef.current, s = stRef.current
    if (!m || !s) return false
    // before presence lands, the lowest vid in the match is the auctioneer
    const here = presentRef.current.filter(p => m.players.some(q => q.vid === p.vid) && !s.L.out.includes(p.vid))
    return leaderOf(here.length ? here : m.players.filter(p => !s.L.out.includes(p.vid))) === me.vid
  }

  // ── messages from the floor ──
  const onLot = useCallback(p => {
    setSt(s => {
      if (!s || p.lot.n < s.n || (p.lot.n === s.n && s.stage !== 'wait' && s.stage !== 'sold')) return s
      if (p.lot.n === s.n && s.stage === 'sold') return s
      return { ...s, n: p.lot.n, stage: 'lot', lot: p.lot, t0: Date.now() - (p.el || 0), high: null, passed: [], sold: null, L: p.L ?? s.L }
    })
  }, [])
  const onHigh = useCallback(p => setSt(s => (s && s.stage === 'lot' && p.n === s.n ? { ...s, high: { vid: p.vid, amount: p.amount } } : s)), [])
  const onPass = useCallback(p => setSt(s => (s && s.stage === 'lot' && p.n === s.n && !s.passed.includes(p.from) ? { ...s, passed: [...s.passed, p.from] } : s)), [])
  const onSold = useCallback(p => setSt(s => (s && p.n >= s.n && !(p.n === s.n && s.stage === 'sold') ? { ...s, n: p.n, stage: 'sold', lot: p.lot ?? s.lot, sold: p.sold, soldAt: Date.now(), high: null, L: p.L } : s)), [])
  const onDone = useCallback(p => { setSt(s => (s ? { ...s, stage: 'done', L: p.L } : s)); setPhase('result') }, [])

  // the auctioneer: takes a bid if it's good, and tells the room
  const takeBid = useCallback((vid, n, amount) => {
    const s = stRef.current, m = matchRef.current
    if (!s || !m || s.stage !== 'lot' || n !== s.n || Date.now() > s.t0 + SPIN_MS + m.bidSecs * 1000 + GRACE_MS) return false
    if (Date.now() < s.t0 + SPIN_MS - 300) return false
    if (!canBidOn(s.L, vid, m.types, s.lot.trait) || s.high?.vid === vid) return false
    if (amount < minNext(s.high) || amount > maxBid(s.L, vid, m.types)) return false
    const high = { vid, amount }
    stRef.current = { ...s, high }
    setSt(x => (x && x.n === n ? { ...x, high } : x))
    roomRef.current?.send('high', { n, vid, amount })
    return true
  }, [])

  const enterRoom = useCallback(m => {
    queueRef.current?.leave(); queueRef.current = null
    setMatch(m); matchRef.current = m
    const s0 = { n: 0, stage: 'wait', lot: null, t0: 0, high: null, passed: [], sold: null, soldAt: 0, L: freshLedger(m.players) }
    setSt(s0); stRef.current = s0
    setPhase('auction'); booked.current = null; entered.current = Date.now()
    const room = joinRoom(`auction-${m.code}`, me)
    roomRef.current = room
    room.onPresence(setPresent)
    room.on('lot', onLot)
    room.on('high', onHigh)
    room.on('pass', onPass)
    room.on('sold', onSold)
    room.on('done', onDone)
    room.on('bid', p => { if (amLeader()) takeBid(p.from, p.n, p.amount) })
    room.on('quit', p => setSt(s => (s && !s.L.out.includes(p.from) ? { ...s, L: { ...s.L, out: [...s.L.out, p.from] } } : s)))
    // someone (re)joined: anyone already on the floor catches them up (they may
    // be the auctioneer now, so it can't wait for the auctioneer to answer)
    room.on('hello', () => {
      const s = stRef.current
      if (!s || s.stage === 'wait') return
      if (s.stage === 'lot') { room.send('lot', { lot: s.lot, el: Date.now() - s.t0, L: s.L }); if (s.high) room.send('high', { n: s.n, ...s.high }) }
      else if (s.stage === 'sold') room.send('sold', { n: s.n, lot: s.lot, sold: s.sold, L: s.L })
    })
    setTimeout(() => room.send('hello', {}), 500)
  }, [me, onLot, onHigh, onPass, onSold, onDone, takeBid]) // eslint-disable-line react-hooks/exhaustive-deps

  const form = useCallback(list => {
    const code = genCode()
    const humans = [...list].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0)).slice(0, AUCTION_SIZE)
    const players = humans.map(h => ({ vid: h.vid, name: h.name, uid: h.uid ?? null, cos: h.cos ?? null }))
    return { code, seed: `au-${code}`, created: Date.now(), sport: kit.sport, pos: kit.pos, types: kit.types, bidSecs: BID_SECS, players }
  }, [kit])

  const join = useCallback(() => {
    if (!enabled) return
    roomRef.current?.leave(); roomRef.current = null
    setPhase('queue'); setWaited(0); setMatch(null); setSt(null)
    const q = joinRoom(`auction-q-${kit.sport}-${kit.pos}`, { ...me, ts: Date.now() })
    queueRef.current = q
    setLink('connecting'); q.onStatus(setLink)
    q.onPresence(list => {
      setQueue(list)
      if (list.length >= AUCTION_SIZE && leaderOf(list) === me.vid && queueRef.current === q) { const m = form(list); q.send('match', m); enterRoom(m) }
    })
    q.on('match', m => { if (m.players.some(p => p.vid === me.vid)) enterRoom(m) })
    q.on('fill', () => {
      const list = q.presence()
      if (list.length >= AUCTION_MIN && leaderOf(list) === me.vid && queueRef.current === q) { const m = form(list); q.send('match', m); enterRoom(m) }
    })
  }, [enabled, kit, me, form, enterRoom])

  const fillNow = useCallback(() => {
    const q = queueRef.current; if (!q) return
    const list = q.presence()
    if (list.length < AUCTION_MIN) return
    q.send('fill', {})
    if (leaderOf(list) === me.vid) { const m = form(list); q.send('match', m); enterRoom(m) }
  }, [me.vid, form, enterRoom])
  useEffect(() => {
    if (phase !== 'queue') return
    const id = setInterval(() => setWaited(w => w + 1), 1000)
    return () => clearInterval(id)
  }, [phase])
  useEffect(() => { if (phase === 'queue' && waited >= AUCTION_FILL_SECS && queue.length >= AUCTION_MIN) fillNow() }, [phase, waited, queue.length, fillNow])

  // ── the clock, and (when I'm the auctioneer) the gavel ──
  useEffect(() => {
    if (phase !== 'auction') return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      const s = stRef.current, m = matchRef.current, room = roomRef.current
      if (!s || !m || !room || !amLeader()) return
      const k = kitRef.current
      const next = () => {
        if (auctionOver(s.L, m, s.n)) {
          room.send('done', { L: s.L }); onDone({ L: s.L }); return
        }
        const lot = pickLot(m, s.L, k, s.n + 1)
        if (!lot) { room.send('done', { L: s.L }); onDone({ L: s.L }); return }
        const ns = { ...s, n: lot.n, stage: 'lot', lot, t0: t, high: null, passed: [], sold: null }
        stRef.current = ns; setSt(ns)
        room.send('lot', { lot, el: 0, L: s.L })
      }
      if (s.stage === 'wait') { if (t - entered.current > 2400) next(); return }
      if (s.stage === 'sold') { if (t - s.soldAt > SOLD_MS) next(); return }
      if (s.stage !== 'lot') return
      const end = s.t0 + SPIN_MS + m.bidSecs * 1000
      const open = t >= s.t0 + SPIN_MS
      // everyone who could still bid has passed (or it's down to the high bidder): close early
      const here = new Set(presentRef.current.map(p => p.vid)); here.add(me.vid)
      const could = m.players.filter(p => here.has(p.vid) && canBidOn(s.L, p.vid, m.types, s.lot.trait) && p.vid !== s.high?.vid)
      const settled = open && could.every(p => s.passed.includes(p.vid)) && (s.high || could.length > 0 || t > s.t0 + SPIN_MS + 1200)
      if (t < end + GRACE_MS && !settled) return
      const L = { ...s.L, wallets: { ...s.L.wallets }, won: { ...s.L.won }, log: [...s.L.log] }
      let sold = null
      if (s.high) {
        const { vid, amount } = s.high
        L.wallets[vid] -= amount
        L.won[vid] = { ...L.won[vid], [s.lot.trait]: { val: s.lot.val, name: s.lot.name, team: s.lot.team, price: amount } }
        sold = { vid, amount }
      }
      L.log = [{ n: s.n, trait: s.lot.trait, name: s.lot.name, val: s.lot.val, vid: sold?.vid ?? null, amount: sold?.amount ?? 0 }, ...L.log].slice(0, 30)
      const ns = { ...s, stage: 'sold', sold, soldAt: t, high: null, L }
      stRef.current = ns; setSt(ns)
      room.send('sold', { n: s.n, lot: s.lot, sold, L })
    }, 150)
    return () => clearInterval(id)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── my moves ──
  const bid = useCallback(amount => {
    const s = stRef.current, m = matchRef.current
    if (!s || !m || s.stage !== 'lot') return false
    if (amLeader()) return takeBid(me.vid, s.n, amount)
    if (!canBidOn(s.L, me.vid, m.types, s.lot.trait) || s.high?.vid === me.vid) return false
    if (amount < minNext(s.high) || amount > maxBid(s.L, me.vid, m.types)) return false
    roomRef.current?.send('bid', { n: s.n, amount })
    const high = { vid: me.vid, amount }   // shown now; the auctioneer's call settles it
    stRef.current = { ...s, high }; setSt(x => (x && x.n === s.n ? { ...x, high } : x))
    return true
  }, [me.vid, takeBid]) // eslint-disable-line react-hooks/exhaustive-deps
  const pass = useCallback(() => {
    const s = stRef.current
    if (!s || s.stage !== 'lot' || s.passed.includes(me.vid)) return
    roomRef.current?.send('pass', { n: s.n })
    onPass({ n: s.n, from: me.vid })
  }, [me.vid, onPass])

  // Book my place once
  const ranked = useMemo(() => rankAuction(match, st?.L, kit), [match, st?.L, kit])
  useEffect(() => {
    if (phase !== 'result' || !match || booked.current === match.code) return
    const mine = ranked.find(p => p.vid === me.vid)
    if (!mine || mine.forfeit) return
    booked.current = match.code
    window.dispatchEvent(new CustomEvent('bap:compete', { detail: { sport: match.sport, pos: match.pos, place: mine.place, of: ranked.length, ovr: mine.ovr, humans: match.players.length, mode: 'auction' } }))
  }, [phase, match, ranked, me.vid])

  // Leaving mid-auction: the room sees you quit, your record takes the forfeit
  const forfeit = useCallback(() => {
    const m = matchRef.current
    if (!m || phase !== 'auction') { leave(); return }
    roomRef.current?.send('quit', {})
    window.dispatchEvent(new CustomEvent('bap:compete', { detail: { sport: m.sport, pos: m.pos, place: m.players.length, of: m.players.length, ovr: 0, humans: m.players.length, forfeit: true, mode: 'auction' } }))
    booked.current = m.code
    setTimeout(leave, 300)
  }, [phase, leave])

  const retry = useCallback(() => { queueRef.current?.leave(); queueRef.current = null; join() }, [join])
  return { phase, queue, waited, link, match, st, now, present, ranked, me, kit, join, leave, retry, fillNow, bid, pass, forfeit }
}
