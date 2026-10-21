// Watching Blacktop: the games being played right now, listed under each mode on the
// Blacktop menu, and a seat in the stands for one of them (live/src/games.js and the
// Room's watching, live/src/index.js). A spectator gets only what everyone in the game
// already has (who's playing, the builds once it's tipped off, each possession's calls
// as they lock, the reactions) and plays the game out on this phone from the same
// inputs, like every player does. It's not a seat: no build, no calls, no chat, nothing
// on anyone's record, and leaving costs nothing.
//
// A server that doesn't know watching yet never answers: the list stays empty.

import { useEffect, useMemo, useRef, useState } from 'react'
import { LIVE_URL } from './liveUrl'
import { playOut } from './blacktopServer'

const STALE_MS = 2 * 60 * 1000     // a game that hasn't checked in for two minutes is over
const NONE = new Set()
const NO_CALLS = {}
const NOBODY = { vid: null }
const noop = () => {}

// A socket that only listens (no seat key, no session: watching needs neither) and
// comes back after a drop, until it's closed. One that never opens at all (a server
// without it) stops trying after a few goes.
function listen(path, first, onMsg, onStatus) {
  let ws = null, closed = false, tries = 0, timer = null, opened = false
  const open = () => {
    if (closed) return
    onStatus?.('connecting')
    try { ws = new WebSocket(`${LIVE_URL}${path}`) } catch { return }
    ws.onopen = () => { tries = 0; opened = true; onStatus?.('live'); if (first) ws.send(JSON.stringify(first)) }
    ws.onmessage = e => { try { onMsg(JSON.parse(e.data)) } catch {} }
    ws.onclose = () => {
      if (closed) return
      if (!opened && tries >= 4) { closed = true; onStatus?.('off'); return }
      onStatus?.('connecting'); timer = setTimeout(open, Math.min(30000, 1000 * 2 ** tries++))
    }
    ws.onerror = () => { try { ws.close() } catch {} }
  }
  open()
  return { close: () => { closed = true; clearTimeout(timer); try { ws?.close(1000, 'bye') } catch {} } }
}

// The live games by mode ({ 1: [...], 2: [...], 3: [...] }), most watched first, while `on`
export function useLiveGames(on) {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!on || !LIVE_URL) return
    const sock = listen('/games', null, m => {
      if (m?.t !== 'games' || !Array.isArray(m.games)) return
      // the server's clock, on this phone's
      const skew = (Number(m.now) || Date.now()) - Date.now()
      setList(m.games.filter(g => g && typeof g.code === 'string').map(g => ({ ...g, started: (Number(g.started) || Date.now()) - skew, ts: (Number(g.ts) || Date.now()) - skew })))
    })
    return () => { sock.close(); setList([]) }
  }, [on])
  // one that goes quiet drops off (the server takes it down too, when it hears)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { if (!list.length) return; const id = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(id) }, [list.length])
  return useMemo(() => {
    const by = { 1: [], 2: [], 3: [] }
    for (const g of list) if (by[g.size] && now - g.ts < STALE_MS) by[g.size].push(g)
    for (const k of [1, 2, 3]) by[k].sort((a, b) => (b.watchers ?? 0) - (a.watchers ?? 0) || b.started - a.started)
    return by
  }, [list, now])
}

// Where a spectator starts: on the last possession that's been called (a few seconds
// behind the players, so there's a play to watch right away), or the tip-off itself
// (null: from the reveal) when nothing's been called yet
function startFrom(game, locks) {
  const checks = game.plays.flatMap((p, i) => (p.type === 'check' ? [[p.pn, i]] : []))
  const open = checks.findIndex(([pn]) => !locks?.[pn])
  const called = (open < 0 ? checks : checks.slice(0, open)).filter(([pn]) => locks?.[pn])
  return called.length ? called[called.length - 1][1] : null
}

// A seat in the stands of game `code`: the same shape BlacktopGame plays from, read-only
export function useBlacktopWatch({ code, pools, types }) {
  const [state, setState] = useState('joining')      // joining | live | full | gone | ended (the feed went after we'd seen it)
  const [link, setLink] = useState('connecting')
  const [match, setMatch] = useState(null)
  const [final, setFinal] = useState(null)
  const [locks, setLocks] = useState({})
  const [emotes, setEmotes] = useState([])
  const [watchers, setWatchers] = useState(0)
  useEffect(() => {
    if (!code || !LIVE_URL) { setState('gone'); return }
    let seated = false, sock = null
    // no answer (a server that doesn't know watching, a game that's gone): give up
    const timer = setTimeout(() => { if (!seated) { setState('gone'); sock?.close() } }, 9000)
    sock = listen(`/room/${code}`, { t: 'watch' }, m => {
      if (m.t === 'watching') {
        seated = true
        setMatch(prev => prev ?? { code, seed: m.seed, players: m.players ?? [], bots: false })
        setFinal(m.final ?? null); setLocks(m.locks ?? {}); setWatchers(m.n ?? 1); setState('live')
        return
      }
      if (m.t === 'lock') return setLocks(l => (l[m.pn] ? l : { ...l, [m.pn]: m.calls }))
      if (m.t === 'emote') return setEmotes(list => [...list.slice(-12), { id: `${m.from}-${m.ts}`, from: m.from, e: m.e, ts: Date.now() }])
      if (m.t === 'watchers') return setWatchers(m.n ?? 0)
      if (m.t === 'nowatch' || m.t === 'gone') {
        sock?.close()
        setState(s => (s === 'live' ? 'ended' : m.why === 'full' ? 'full' : 'gone'))
      }
    }, setLink)
    return () => { clearTimeout(timer); sock?.close() }
  }, [code])

  const game = useMemo(() => playOut({ final, match, locks, pools, types }), [final, match, locks, pools, types])
  const startAt = useRef(undefined)
  if (game && startAt.current === undefined) startAt.current = startFrom(game, locks)

  return {
    server: true, watch: true, me: NOBODY, state, link, watchers, startAt: startAt.current ?? null,
    match, final, game, locks, emotes,
    // what a seat would do, done by nobody: no check-ins, no calls, no reactions, no record
    arrive: noop, finish: noop, call: noop, emote: noop, lockCalls: noop, myCalls: NO_CALLS, rematchVotes: NONE, voteRematch: noop, isLeader: false,
  }
}
