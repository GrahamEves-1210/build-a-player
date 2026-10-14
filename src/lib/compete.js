// COMPETE — five-player pools. Everyone in a pool gets the same spins (the
// Daily Challenge's seeded order, but per pool), builds on their own, and the
// pool is ranked by OVR. Respins are each player's own (they don't use up the
// shared order); the next regular spin is back on the pool's sequence.
//   queue  → wait for a pool of 5 players (after a wait, 2+ can start: no bots)
//   build  → build on the game page with the pool's seed; LOCK IN sends the build
//   result → everyone's OVR ranked; your place goes to your Compete stats
// The live server runs the pool (live/src/compete.js): the queue, the seed, the
// clock, and the scoring: it works each OVR out from the real ratings of the
// players in the build (lib/competeCore.js), never from what a phone claims.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { myVid, myDevice, claimLive, releaseLive, liveElsewhere, markEntered, clearEntered, takeEntered } from './live'
import { liveSocket } from './blacktopServer'
import { getUsername } from './discord'
import { myCosmetics, whenProgressReady } from './progress'
import { BUILD_SECS, FILL_AFTER_SECS, rankResults } from './competeCore'

export * from './competeCore'

export function useCompete({ enabled, user, sport, pos }) {
  const me = useMemo(() => ({ vid: myVid(), dev: myDevice(), name: user ? (getUsername(user) || 'Player') : 'Guest', uid: user?.id ?? null, cos: myCosmetics() }), [user?.id]) // eslint-disable-line
  // a pool this device left mid-game (reload, the app killed): book it as the forfeit it was
  useEffect(() => {
    const e = takeEntered('compete'); if (!e) return
    whenProgressReady(() => window.dispatchEvent(new CustomEvent('bap:compete', { detail: { sport: e.sport, pos: e.pos, place: e.of, of: e.of, ovr: 0, humans: e.humans, forfeit: true } })))
  }, [])
  const [phase, setPhase] = useState('idle')        // idle | busy | queue | build | result
  const [queue, setQueue] = useState([])
  const [startsAt, setStartsAt] = useState(null)
  const [link, setLink] = useState('connecting')
  const [match, setMatch] = useState(null)          // { code, seed, created, sport, pos, players }
  const [results, setResults] = useState({})        // vid → { ovr, at, build, forfeit }
  const [now, setNow] = useState(Date.now())
  const qRef = useRef(null), roomRef = useRef(null)
  const booked = useRef(null)
  const matchRef = useRef(null); matchRef.current = match

  const closeAll = () => { qRef.current?.close(); qRef.current = null; roomRef.current?.close(); roomRef.current = null }
  const leave = useCallback(() => {
    closeAll()
    setPhase('idle'); setQueue([]); setStartsAt(null); setMatch(null); setResults({})
    releaseLive()
  }, [])
  useEffect(() => { if (!enabled) leave() }, [enabled, leave])
  useEffect(() => () => leave(), [leave])

  // the server's word on the pool (its clock arrives as "how long ago")
  const onRoom = useCallback(msg => {
    if (msg.t === 'gone') { leave(); return }
    if (msg.t !== 'state' || !msg.m) return
    const { sinceCreated, ...m } = msg.m
    setMatch(prev => ({ ...m, created: prev?.code === m.code && prev.created ? prev.created : Date.now() - (sinceCreated ?? 0) }))
    setResults(msg.results ?? {})
    if (msg.phase === 'result') setPhase('result')
  }, [leave])
  const enterRoom = useCallback((code, players) => {
    qRef.current?.close(); qRef.current = null
    // the seed is the pool's code: the build can start at once, before the room's first word
    setMatch({ code, seed: `cp-${code}`, created: Date.now(), sport, pos, players }); setResults({}); setPhase('build'); booked.current = null
    markEntered({ kind: 'compete', code, sport, pos, of: players.length, humans: players.length })
    roomRef.current = liveSocket(`/compete/room/${code}`, () => ({ t: 'hello', vid: me.vid }), onRoom, setLink)
  }, [sport, pos, me.vid, onRoom])

  const join = useCallback(() => {
    if (!enabled) return
    // one live game per device: another tab or window is already in one
    if (!claimLive('compete')) { setPhase('busy'); return }
    closeAll()
    setPhase('queue'); setMatch(null); setResults({}); setQueue([]); setStartsAt(null)
    qRef.current = liveSocket(`/compete/q?sport=${sport}&pos=${pos}`, () => ({ t: 'hello', ...me }), msg => {
      if (msg.t === 'queue') { setQueue(msg.list ?? []); setStartsAt(msg.startsIn == null ? null : Date.now() + msg.startsIn) }
      else if (msg.t === 'match' && msg.players?.some(p => p.vid === me.vid)) enterRoom(msg.code, msg.players)
    }, setLink)
  }, [enabled, sport, pos, me, enterRoom])
  // start with who's here (2+): anyone can ask
  const fillNow = useCallback(() => qRef.current?.send({ t: 'fill' }), [])
  const retry = useCallback(() => { closeAll(); join() }, [join])

  useEffect(() => {
    if (phase !== 'queue' && phase !== 'build') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase])
  const waited = startsAt ? Math.max(0, FILL_AFTER_SECS - Math.ceil((startsAt - now) / 1000)) : 0
  const clock = match ? Math.max(0, BUILD_SECS - Math.floor((now - match.created) / 1000)) : BUILD_SECS

  // My build is in: the server scores it (shown here at the phone's number until its word comes back)
  const submit = useCallback((ovr, build) => {
    if (!match || results[me.vid]) return
    const slim = Object.fromEntries(Object.entries(build || {}).filter(([, v]) => v).map(([t, v]) => [t, { val: v.val, qbFull: v.qbFull, team: v.team }]))
    roomRef.current?.send({ t: 'submit', build: slim })
    setResults(rs => ({ ...rs, [me.vid]: { ovr, at: Date.now(), build: slim } }))
  }, [match, results, me.vid])

  // Book my place once, from the server's result (stats, XP, coins: lib/progress.js).
  // No build in when the clock ran out: that's a forfeit (sitting it out doesn't dodge a loss)
  useEffect(() => {
    if (phase !== 'result' || !match || booked.current === match.code) return
    booked.current = match.code
    clearEntered(match.code); releaseLive()
    const mine = results[me.vid]
    if (!mine || mine.forfeit) {
      window.dispatchEvent(new CustomEvent('bap:compete', { detail: { sport: match.sport, pos: match.pos, place: match.players.length, of: match.players.length, ovr: 0, humans: match.players.length, forfeit: true } }))
      return
    }
    const ranked = rankResults(match, results)
    const me2 = ranked.find(p => p.vid === me.vid)
    window.dispatchEvent(new CustomEvent('bap:compete', { detail: { sport: match.sport, pos: match.pos, place: me2.place, of: ranked.length, ovr: mine.ovr, humans: match.players.length } }))
  }, [phase, match, results, me.vid])

  // Leaving mid-pool: the server marks the DNF, my record takes the forfeit
  const forfeit = useCallback(() => {
    const m = matchRef.current
    if (!m || results[me.vid]) { leave(); return }
    roomRef.current?.send({ t: 'quit' })
    window.dispatchEvent(new CustomEvent('bap:compete', { detail: { sport: m.sport, pos: m.pos, place: m.players.length, of: m.players.length, ovr: 0, humans: m.players.length, forfeit: true } }))
    booked.current = m.code
    clearEntered(m.code)
    setTimeout(leave, 300)
  }, [results, me.vid, leave])

  const ranked = useMemo(() => rankResults(match, results), [match, results])
  return { phase, queue, waited, match, results, ranked, clock, me, link, retry, join, leave, forfeit, fillNow, submit, inPool: phase === 'build' || phase === 'result', elsewhere: liveElsewhere }
}
