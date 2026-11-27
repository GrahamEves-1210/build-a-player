// TRAIT AUCTION, its own online mode (Compete is retired, owner 11-26). Two or
// three real players, $20 each and Salary Cap's five rating slots for the position
// (football QB, RB or WR; basketball guard or big). A card is pulled for one of the
// slots and lands on a real player; a new card's grade stays face down until the
// gavel. Bidding is +$1 (or +$3) at a time, going once, going twice: every bid puts
// the clock back up (RESET_SECS), and when it runs out the high bid wins that
// player's numbers for every trait the slot covers. The clock is called at once
// when nobody left can bid. A card nobody bids on turns over anyway and goes back
// in the deck face up, so it can come back up with its grade known. The first
// bidder to fill all five slots ends it: everyone else's open slots go to the draw
// (a random card each, free). Then the builds are ranked by OVR (a tie goes to the
// one who filled his build first, then money left).
//   queue   → wait for players (2 or 3 real players, never bots)
//   auction → lots: spin → bidding → sold, and the draw at the end
//   result  → the ranking; the place goes to the online record
// The live server is the auctioneer (live/src/auction.js): it picks every lot,
// checks every bid, runs the clock, deals the draw and ranks the builds. This phone
// sends its bids and passes and shows what the server says. The rules both sides
// use are lib/auctionCore.js.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { myVid, myDevice, claimLive, releaseLive, markEntered, clearEntered, takeEntered } from './live'
import { liveSocket } from './blacktopServer'
import { getUsername } from './discord'
import { myCosmetics, whenProgressReady } from './progress'
import { SPORT } from './career'
import { auctionCoreKit, AUCTION_FILL_SECS, AUCTION_POS, AUCTION_ANY, posOk } from './auctionCore'
import { nflHeadshot } from '../utils/simulation'
import { teamHint } from './teamHint'
import { APP_ART } from './platform'

export * from './auctionCore'

// the rules' kit, plus what the screens show: the position's name, photos, logos
// every position a sport's room can draw: its tag and its name (the lobby lists them; the reveal lands on one)
export const POS_INFO = {
  nfl: [{ pos: 'qb', tag: 'QB', name: 'Quarterback' }, { pos: 'rb', tag: 'RB', name: 'Running back' }, { pos: 'wr', tag: 'WR', name: 'Wide receiver' }],
  bucket: [{ pos: 'guard', tag: 'GUARD', name: 'Guard' }, { pos: 'big', tag: 'BIG', name: 'Big' }],
  soccer: [{ pos: 'st', tag: 'ST', name: 'Striker' }],
}
// (college: the same positions)
POS_INFO.cfb = POS_INFO.nfl
POS_INFO.cbb = POS_INFO.bucket
export const posInfo = (sport, pos) => POS_INFO[sport]?.find(o => o.pos === pos) ?? null

// a slot's name in full on every auction screen (Salary Cap's board shortens a few for its column heads)
const FULL = { ELUSIVE: 'ELUSIVENESS' }
const fullLabel = f => k => { const l = f(k); return FULL[l] ?? l }

// a sport that adds its own kit adds its look too (soccer: lib/soccerAuctionUi.js)
const LOOKS = {}
export const addAuctionLook = (sport, look) => { LOOKS[sport] = look }
export function auctionKit(sport, pos) {
  const k = auctionCoreKit(sport, pos)
  if (LOOKS[k.sport]) { const L = typeof LOOKS[k.sport] === 'function' ? LOOKS[k.sport](k.pos) : LOOKS[k.sport]; return { ...k, ...L, label: L.label, attrLabel: fullLabel(k.attrLabel) } }
  const S = SPORT[k.sport]
  // the lot's card: his photo the way Salary Cap finds it (the headshot list, else the pool's own headshot; no photo,
  // the app draws his team's jersey, the website shows the team's logo), on his team's colour
  const byName = new Map(k.pool.map(p => [p.name, p]))
  const tint = Object.fromEntries((S.teams ?? []).map(t => [t.short, t.color]))
  const lg = k.sport === 'bucket' ? 'nba' : 'nfl'
  const photo = (name, team) => {
    const p = byName.get(name)
    const src = S.photo(name) ?? (p?.headshot ? nflHeadshot(p.headshot) : null)
    if (src) return teamHint(src, team ?? p?.team)
    return APP_ART && p ? `/headshots/x/${lg}/${team ?? p.team}/${p.number ?? ''}.webp` : null
  }
  return { ...k, label: S.label[k.pos], photo, logo: S.logo, teamColor: team => tint[team] ?? '#3a2a22', attrLabel: fullLabel(k.attrLabel) }
}

// One queue a sport: the room draws the position (lib/auctionCore auctionPosFor). The kit is the room's once it's
// known, the sport's first position until then
// (the app's sport, or the college one it joined: join('cfb') / join('cbb'), owner 11-27. A college kit is added
// by lib/collegeAuctionUi.js, which the lobby imports before it joins)
export function useAuction({ enabled, user, sport }) {
  const [match, setMatch] = useState(null)           // { code, seed, created, sport, pos, anyPos, types, bidSecs, reset, players }
  const [active, setActive] = useState(sport)        // the queue joined: the app's sport or its college one
  const activeRef = useRef(sport); activeRef.current = active
  useEffect(() => { setActive(sport) }, [sport])
  const roomPos = match?.pos ?? null
  const kit = useMemo(() => auctionKit(active, roomPos ?? AUCTION_POS[active]?.[0]), [active, roomPos])
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
    if (!posOk(msg.m)) return   // a room whose position isn't the one its seed draws: not taken
    const t = Date.now(), s = msg.st
    setMatch(msg.m)
    setPresent((msg.here ?? []).map(vid => ({ vid })))
    setSt({ ...s, t0: t - (s.el ?? 0), last: s.sinceLast != null ? t - s.sinceLast : 0, soldAt: s.sinceSold != null ? t - s.sinceSold : 0 })
    if (s.stage === 'done') { setRanked(msg.ranked ?? []); setPhase('result') }
  }, [leave])
  const enterRoom = useCallback((code, players) => {
    qRef.current?.close(); qRef.current = null
    setMatch({ code, players, sport: activeRef.current, pos: null, types: null }); setPhase('auction'); booked.current = null
    markEntered({ kind: 'auction', code, sport: activeRef.current, pos: AUCTION_ANY, of: players.length })
    roomRef.current = liveSocket(`/auction/room/${code}`, () => ({ t: 'hello', vid: me.vid }), onRoom, setLink)
  }, [kit, me.vid, onRoom])

  const join = useCallback((which = activeRef.current) => {
    if (!enabled) return
    if (!AUCTION_POS[which]) which = sport
    if (!claimLive('auction')) { setPhase('busy'); return }
    closeAll()
    setActive(which)
    setPhase('queue'); setMatch(null); setSt(null); setQueue([]); setStartsAt(null)
    qRef.current = liveSocket(`/auction/q?sport=${which}&pos=${AUCTION_ANY}`, () => ({ t: 'hello', ...me }), msg => {
      if (msg.t === 'queue') { setQueue(msg.list ?? []); setStartsAt(msg.startsIn == null ? null : Date.now() + msg.startsIn) }
      else if (msg.t === 'match' && msg.players?.some(p => p.vid === me.vid)) enterRoom(msg.code, msg.players)
    }, setLink)
  }, [enabled, sport, me, enterRoom])
  const fillNow = useCallback(() => qRef.current?.send({ t: 'fill' }), [])
  const retry = useCallback(() => { closeAll(); join(activeRef.current) }, [join])

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
