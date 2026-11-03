// TRAIT AUCTION — a Compete mode. 1v1: two real players, $20 each, and
// Salary Cap's five rating slots each (football: QB). A card is pulled from
// the five-slot deck and the spinner lands on a real player; the grade stays
// hidden until the gavel. Bidding is +$1 at a time, going once, going twice:
// every bid puts the clock back up (RESET_SECS), and when it runs out the high
// bid wins it: that player's numbers for every trait the slot covers.
// It runs until every slot is filled, then the builds are ranked by OVR
// (money left breaks a tie).
//   queue   → wait for players (2+ real players, never bots — like the pools)
//   auction → lots: spin → bidding → sold
//   result  → the ranking; your place goes to your Compete record
// The live server is the auctioneer (live/src/auction.js): it picks every lot,
// checks every bid, runs the clock and ranks the builds. This phone sends its
// bids and passes and shows what the server says. The rules both sides use are
// lib/auctionCore.js.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { myVid, myDevice, claimLive, releaseLive, markEntered, clearEntered, takeEntered } from './live'
import { liveSocket } from './blacktopServer'
import { getUsername } from './discord'
import { myCosmetics, whenProgressReady } from './progress'
import { SPORT } from './career'
import { auctionCoreKit, AUCTION_FILL_SECS } from './auctionCore'

export * from './auctionCore'

// the rules' kit, plus what the screens show: the position's name, photos, logos
export function auctionKit(sport, pos) {
  const k = auctionCoreKit(sport, pos)
  const S = SPORT[k.sport]
  return { ...k, label: S.label[k.pos], photo: S.photo, logo: S.logo }
}

export function useAuction({ enabled, user, sport, pos }) {
  const kit = useMemo(() => auctionKit(sport, pos), [sport, pos])
  const me = useMemo(() => ({ vid: myVid(), dev: myDevice(), name: user ? (getUsername(user) || 'Player') : 'Guest', uid: user?.id ?? null, cos: myCosmetics() }), [user?.id]) // eslint-disable-line
  // an auction this device left mid-way (reload, the app killed): book the forfeit it was
  useEffect(() => {
    const e = takeEntered('auction'); if (!e) return
    whenProgressReady(() => window.dispatchEvent(new CustomEvent('bap:compete', { detail: { sport: e.sport, pos: e.pos, place: e.of, of: e.of, ovr: 0, humans: e.of, forfeit: true, mode: 'auction' } })))
  }, [])
  const [phase, setPhase] = useState('idle')         // idle | busy | queue | auction | result
  const [queue, setQueue] = useState([])
  const [startsAt, setStartsAt] = useState(null)     // the queue's countdown, on this phone's clock
  const [link, setLink] = useState('connecting')
  const [match, setMatch] = useState(null)           // { code, seed, created, sport, pos, types, bidSecs, reset, players }
  const [present, setPresent] = useState([])
  const [st, setSt] = useState(null)                 // { n, stage, lot, t0, last, high, passed, sold, soldAt, L }
  const [ranked, setRanked] = useState([])
  const [now, setNow] = useState(Date.now())
  const qRef = useRef(null), roomRef = useRef(null)
  const stRef = useRef(null); stRef.current = st
  const matchRef = useRef(null); matchRef.current = match
  const booked = useRef(null)

  const closeAll = () => { qRef.current?.close(); qRef.current = null; roomRef.current?.close(); roomRef.current = null }
  const leave = useCallback(() => {
    closeAll()
    setPhase('idle'); setQueue([]); setStartsAt(null); setMatch(null); setSt(null); setPresent([]); setRanked([])
    releaseLive()
  }, [])
  useEffect(() => { if (!enabled) leave() }, [enabled, leave])
  useEffect(() => () => leave(), [leave])

  // the server's word on the room: its times arrive as "how long ago", set on this clock
  const onRoom = useCallback(msg => {
    if (msg.t === 'gone') { leave(); return }
    if (msg.t !== 'state' || !msg.m || !msg.st) return
    const t = Date.now(), s = msg.st
    setMatch(msg.m)
    setPresent((msg.here ?? []).map(vid => ({ vid })))
    setSt({ ...s, t0: t - (s.el ?? 0), last: s.sinceLast != null ? t - s.sinceLast : 0, soldAt: s.sinceSold != null ? t - s.sinceSold : 0 })
    if (s.stage === 'done') { setRanked(msg.ranked ?? []); setPhase('result') }
  }, [leave])
  const enterRoom = useCallback((code, players) => {
    qRef.current?.close(); qRef.current = null
    setMatch({ code, players, types: kit.types, sport: kit.sport, pos: kit.pos }); setPhase('auction'); booked.current = null
    markEntered({ kind: 'auction', code, sport: kit.sport, pos: kit.pos, of: players.length })
    roomRef.current = liveSocket(`/auction/room/${code}`, () => ({ t: 'hello', vid: me.vid }), onRoom, setLink)
  }, [kit, me.vid, onRoom])

  const join = useCallback(() => {
    if (!enabled) return
    if (!claimLive('auction')) { setPhase('busy'); return }
    closeAll()
    setPhase('queue'); setMatch(null); setSt(null); setQueue([]); setStartsAt(null)
    qRef.current = liveSocket(`/auction/q?sport=${kit.sport}&pos=${kit.pos}`, () => ({ t: 'hello', ...me }), msg => {
      if (msg.t === 'queue') { setQueue(msg.list ?? []); setStartsAt(msg.startsIn == null ? null : Date.now() + msg.startsIn) }
      else if (msg.t === 'match' && msg.players?.some(p => p.vid === me.vid)) enterRoom(msg.code, msg.players)
    }, setLink)
  }, [enabled, kit, me, enterRoom])
  const fillNow = useCallback(() => qRef.current?.send({ t: 'fill' }), [])
  const retry = useCallback(() => { closeAll(); join() }, [join])

  // the clock the screens read (the bidding bar, going once / twice)
  useEffect(() => {
    if (phase !== 'auction' && phase !== 'queue') return
    const id = setInterval(() => setNow(Date.now()), 150)
    return () => clearInterval(id)
  }, [phase])
  // the queue countdown, as seconds already waited (the screens count down from AUCTION_FILL_SECS)
  const waited = startsAt ? Math.max(0, AUCTION_FILL_SECS - Math.ceil((startsAt - now) / 1000)) : 0

  // my moves: shown at once, the server's next word settles them
  const bid = useCallback(amount => {
    const s = stRef.current
    if (!s || s.stage !== 'lot' || !roomRef.current) return false
    roomRef.current.send({ t: 'bid', n: s.n, amount })
    setSt(x => (x && x.n === s.n ? { ...x, high: { vid: me.vid, amount }, last: Date.now() } : x))
    return true
  }, [me.vid])
  const pass = useCallback(() => {
    const s = stRef.current
    if (!s || s.stage !== 'lot' || s.passed.includes(me.vid)) return
    roomRef.current?.send({ t: 'pass', n: s.n })
    setSt(x => (x && x.n === s.n ? { ...x, passed: [...x.passed, me.vid] } : x))
  }, [me.vid])

  // Book my place once
  useEffect(() => {
    if (phase !== 'result' || !match || booked.current === match.code) return
    const mine = ranked.find(p => p.vid === me.vid)
    if (!mine || mine.forfeit) return
    booked.current = match.code
    clearEntered(match.code); releaseLive()
    window.dispatchEvent(new CustomEvent('bap:compete', { detail: { sport: match.sport, pos: match.pos, place: mine.place, of: ranked.length, ovr: mine.ovr, humans: match.players.length, mode: 'auction' } }))
  }, [phase, match, ranked, me.vid])

  // Leaving mid-auction: the server marks you out, your record takes the forfeit
  const forfeit = useCallback(() => {
    const m = matchRef.current
    if (!m || phase !== 'auction') { leave(); return }
    roomRef.current?.send({ t: 'quit' })
    window.dispatchEvent(new CustomEvent('bap:compete', { detail: { sport: m.sport, pos: m.pos, place: m.players.length, of: m.players.length, ovr: 0, humans: m.players.length, forfeit: true, mode: 'auction' } }))
    booked.current = m.code
    clearEntered(m.code)
    setTimeout(leave, 300)
  }, [phase, leave])

  return { phase, queue, waited, link, match, st, now, present, ranked, me, kit, join, leave, retry, fillNow, bid, pass, forfeit }
}
