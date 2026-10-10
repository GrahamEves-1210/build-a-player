// COMPETE — five-player pools. Everyone in a pool gets the same spins (the
// Daily Challenge's seeded order, but per pool), builds on their own, and the
// pool is ranked by OVR. Respins are each player's own (they don't use up the
// shared order); the next regular spin is back on the pool's sequence.
//   queue  → wait for a pool of 5 players (after a wait, 2+ can start: no bots)
//   build  → build on the game page with the pool's seed; LOCK IN sends the OVR
//   result → everyone's OVR ranked; your place goes to your Compete stats
// Bots play the very same spins: every client works their builds out from the
// seed, so nothing is sent for them. "Leader" is the lowest vid among the
// humans in the queue; nothing is stored server-side.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { joinRoom, genCode, myVid } from './live'
import { seeded, seededShuffle } from './rng'
import { getUsername } from './discord'
import { myCosmetics } from './progress'

export const POOL_SIZE = 5
export const FILL_AFTER_SECS = 30
export const MIN_POOL = 2          // real players only: a pool never fills with bots
export const BUILD_SECS = 300

// The pool's spin order — the same lookup SpinScreen makes for seeded spins
export function seededTeams(seed, teams, pool) {
  const draftable = new Set(pool.map(p => p.team))
  const list = teams.some(t => draftable.has(t.short)) ? teams.filter(t => draftable.has(t.short)) : teams
  return seededShuffle([...list].sort((a, b) => a.short.localeCompare(b.short)), `${seed}:teams`)
}
export function seededPlayer(seed, i, team, pool) {
  const roster = pool.filter(q => q.team === team.short).sort((a, b) => a.name.localeCompare(b.name))
  return roster.length ? seededShuffle(roster, `${seed}:${i}:${team.short}`)[0] : null
}

// A bot's build from the pool's spins: on each spin it takes the open slot
// where this player is best — with some judgment noise, more for weaker bots
export function botBuild({ seed, idx, skill, teams, pool, types, calcOvr }) {
  const r = seeded(`${seed}:bot:${idx}`)
  const order = seededTeams(seed, teams, pool)
  const build = {}
  for (let i = 0; i < 40 && types.some(t => !build[t]); i++) {
    const team = order[i % order.length]
    const p = seededPlayer(seed, i, team, pool)
    if (!p?.attrs) continue
    const open = types.filter(t => !build[t] && p.attrs[t] != null)
    if (!open.length) continue
    const pick = open
      .map(t => ({ t, score: p.attrs[t] + (r() - 0.5) * (1 - skill) * 6 }))
      .sort((a, b) => b.score - a.score)[0].t
    build[pick] = { type: pick, val: p.attrs[pick], qbFull: p.name, team: p.team }
  }
  return { build, ovr: Math.round(calcOvr(build) ?? 0) }
}

const leaderOf = list => [...list].map(p => p.vid).sort()[0] ?? null

export function rankResults(match, results) {
  if (!match) return []
  return match.players
    .map(p => ({ ...p, res: results[p.vid] ?? null }))
    .sort((a, b) => (b.res?.ovr ?? -1) - (a.res?.ovr ?? -1) || (a.res?.at ?? 9e15) - (b.res?.at ?? 9e15))
    .map((p, i) => ({ ...p, place: i + 1 }))
}

export function useCompete({ enabled, user, sport, pos, botFor }) {
  const me = useMemo(() => ({ vid: myVid(), name: user ? (getUsername(user) || 'Player') : 'Guest', uid: user?.id ?? null, cos: myCosmetics() }), [user?.id]) // eslint-disable-line
  const [phase, setPhase] = useState('idle')        // idle | queue | build | result
  const [queue, setQueue] = useState([])
  const [link, setLink] = useState('connecting')     // 'connecting' | 'live' | 'local' (this device only)
  const [waited, setWaited] = useState(0)
  const [match, setMatch] = useState(null)          // { code, seed, created, sport, pos, players:[{vid,name,uid,cos,bot,skill}] }
  const [results, setResults] = useState({})        // vid → { ovr, at, build }
  const [clock, setClock] = useState(BUILD_SECS)
  const queueRef = useRef(null)
  const roomRef = useRef(null)
  const booked = useRef(null)
  const botForRef = useRef(botFor); botForRef.current = botFor

  const leave = useCallback(() => {
    queueRef.current?.leave(); queueRef.current = null
    roomRef.current?.leave(); roomRef.current = null
    setPhase('idle'); setQueue([]); setMatch(null); setResults({}); setWaited(0)
  }, [])
  useEffect(() => { if (!enabled) leave() }, [enabled, leave])
  useEffect(() => () => leave(), [leave])

  const enterRoom = useCallback(m => {
    queueRef.current?.leave(); queueRef.current = null
    setMatch(m); setResults({}); setPhase('build'); booked.current = null
    const room = joinRoom(`compete-${m.code}`, me)
    roomRef.current = room
    room.on('result', p => setResults(rs => ({ ...rs, [p.from]: { ovr: p.ovr, at: p.at, build: p.build } })))
    // bots: worked out locally from the same seed (identical on every client)
    const out = {}
    m.players.forEach((p, i) => {
      if (!p.bot) return
      const b = botForRef.current?.(m.seed, i, p.skill, m.pos)
      if (b) out[p.vid] = { ovr: b.ovr, at: m.created + 60000 + i * 9000, build: b.build }
    })
    setResults(rs => ({ ...out, ...rs }))
  }, [me])

  const form = useCallback(list => {
    const code = genCode()
    const humans = [...list].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0)).slice(0, POOL_SIZE)
    const players = humans.map(h => ({ vid: h.vid, name: h.name, uid: h.uid ?? null, cos: h.cos ?? null, bot: false }))
    return { code, seed: `cp-${code}`, created: Date.now(), sport, pos, players }
  }, [sport, pos])

  const join = useCallback(() => {
    if (!enabled) return
    roomRef.current?.leave(); roomRef.current = null
    setPhase('queue'); setWaited(0); setMatch(null); setResults({})
    const q = joinRoom(`compete-q-${sport}-${pos}`, { ...me, ts: Date.now() })
    queueRef.current = q
    setLink('connecting'); q.onStatus(setLink)
    q.onPresence(list => {
      setQueue(list)
      if (list.length >= POOL_SIZE && leaderOf(list) === me.vid && queueRef.current === q) {
        const m = form(list); q.send('match', m); enterRoom(m)
      }
    })
    q.on('match', m => { if (m.players.some(p => p.vid === me.vid)) enterRoom(m) })
    q.on('fill', () => {
      const list = q.presence()
      if (list.length >= MIN_POOL && leaderOf(list) === me.vid && queueRef.current === q) { const m = form(list); q.send('match', m); enterRoom(m) }
    })
  }, [enabled, sport, pos, me, form, enterRoom])

  // Start with who's here (2+ real players): anyone can ask, the leader deals it
  const fillNow = useCallback(() => {
    const q = queueRef.current; if (!q) return
    const list = q.presence()
    if (list.length < MIN_POOL) return
    q.send('fill', {})
    if (leaderOf(list) === me.vid) { const m = form(list); q.send('match', m); enterRoom(m) }
  }, [me.vid, form, enterRoom])
  useEffect(() => {
    if (phase !== 'queue') return
    const id = setInterval(() => setWaited(w => w + 1), 1000)
    return () => clearInterval(id)
  }, [phase])
  useEffect(() => { if (phase === 'queue' && waited >= FILL_AFTER_SECS && queue.length >= MIN_POOL) fillNow() }, [phase, waited, queue.length, fillNow])

  // My build is in: send it to the pool
  const submit = useCallback((ovr, build) => {
    if (!match || results[me.vid]) return
    const at = Date.now()
    const slim = Object.fromEntries(Object.entries(build || {}).filter(([, v]) => v).map(([t, v]) => [t, { val: v.val, qbFull: v.qbFull, team: v.team }]))
    roomRef.current?.send('result', { ovr, at, build: slim })
    setTimeout(() => roomRef.current?.send('result', { ovr, at, build: slim }), 1500)   // once more for anyone who blinked
    setResults(rs => ({ ...rs, [me.vid]: { ovr, at, build: slim } }))
  }, [match, results, me.vid])

  // The clock, and the pool is over once every human is in (or time's up)
  useEffect(() => {
    if (phase !== 'build' || !match) return
    const tick = () => {
      const left = Math.max(0, BUILD_SECS - Math.floor((Date.now() - match.created) / 1000))
      setClock(left)
      const humans = match.players.filter(p => !p.bot)
      if (left <= 0 || humans.every(p => results[p.vid])) setPhase('result')
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [phase, match, results])

  // Book my place once (stats, XP, coins: lib/progress.js)
  useEffect(() => {
    if (phase !== 'result' || !match || booked.current === match.code || !results[me.vid]) return
    booked.current = match.code
    const ranked = rankResults(match, results)
    const mine = ranked.find(p => p.vid === me.vid)
    const humans = match.players.filter(p => !p.bot).length
    window.dispatchEvent(new CustomEvent('bap:compete', { detail: { sport: match.sport, pos: match.pos, place: mine.place, of: ranked.length, ovr: results[me.vid].ovr, humans } }))
  }, [phase, match, results, me.vid])

  const ranked = useMemo(() => rankResults(match, results), [match, results])
  const retry = useCallback(() => { queueRef.current?.leave(); queueRef.current = null; join() }, [join])
  return { phase, queue, waited, match, results, ranked, clock, me, link, retry, join, leave, fillNow, submit, inPool: phase === 'build' || phase === 'result' }
}
