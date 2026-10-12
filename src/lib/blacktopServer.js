// BLACKTOP on the live server (live/src/index.js): the same hook the screens
// already use (useBlacktop's shape), with the server as the one referee. The
// lobby and the room are WebSockets; the server decides the start, who's out,
// and every possession's calls, and this phone plays the game from exactly what
// it sends (the engine runs here, on the server's inputs, so every phone shows
// the same game).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { myVid, claimLive, releaseLive, markEntered, clearEntered, takeEntered } from './live'
import { seededShuffle } from './rng'
import { simStreetball } from './hoops'
import { clean, blockedIds, MIN_GAP_MS } from './chat'
import { supabase } from './supabase'
import { getUsername } from './discord'
import { myCosmetics, whenProgressReady } from './progress'
import { SLOTS, BUILD_SECS, BOT_NAMES, teamName, autoBuild, buildOk } from './blacktopCore'

export const LIVE_URL = (import.meta.env.VITE_LIVE_URL || '').replace(/\/$/, '')

// A socket that reconnects (and says hello again) until it's closed on purpose
function liveSocket(path, hello, onMsg, onStatus) {
  let ws = null, closed = false, tries = 0, timer = null
  const open = () => {
    if (closed) return
    onStatus?.('connecting')
    ws = new WebSocket(`${LIVE_URL}${path}`)
    ws.onopen = () => { tries = 0; onStatus?.('live'); ws.send(JSON.stringify(hello())) }
    ws.onmessage = e => { try { onMsg(JSON.parse(e.data)) } catch {} }
    ws.onclose = () => { if (closed) return; onStatus?.('connecting'); timer = setTimeout(open, Math.min(8000, 500 * 2 ** tries++)) }
    ws.onerror = () => { try { ws.close() } catch {} }
  }
  open()
  return {
    send: m => { if (ws?.readyState === 1) ws.send(JSON.stringify(m)) },
    close: () => { closed = true; clearTimeout(timer); try { ws?.close(1000, 'bye') } catch {} },
  }
}

export function useBlacktopServer({ enabled, user, position, pools, types, build, player, onExit, onSeatPos }) {
  const [cosV, setCosV] = useState(0)
  useEffect(() => { const on = () => setCosV(v => v + 1); window.addEventListener('bap:cosmetics', on); return () => window.removeEventListener('bap:cosmetics', on) }, [])
  const me = useMemo(() => ({ vid: myVid(), name: user ? (getUsername(user) || 'Player') : 'Guest', uid: user?.id ?? null, pos: position, cos: myCosmetics() }), [user?.id, position, cosV]) // eslint-disable-line
  const meRef = useRef(me); meRef.current = me
  // a game this device left before it was decided (reload, the app killed): it's a loss
  useEffect(() => {
    const e = takeEntered('blacktop'); if (!e) return
    whenProgressReady(() => window.dispatchEvent(new CustomEvent('bap:blacktop', { detail: { won: false, mvp: false, line: null, bots: false, score: null, team: e.team ?? 0, forfeit: true } })))
  }, [])

  const [phase, setPhase] = useState('idle')          // idle | queue | build | game | result
  const [link, setLink] = useState('connecting')
  const [spots, setSpots] = useState({})              // slotId → player | null
  const [lobbyHere, setLobbyHere] = useState([])
  const [bumped, setBumped] = useState(false)
  const [lobbyChat, setLobbyChat] = useState([])
  const [waited, setWaited] = useState(0)
  const [match, setMatch] = useState(null)            // { code, seed, created, ends, players, bots }
  const [here, setHere] = useState([])                // vids in the room
  const [builds, setBuilds] = useState({})
  const [chat, setChat] = useState([])
  const [typingFrom, setTypingFrom] = useState({})    // vid → { name, ts }
  const [role, setRoleState] = useState('balanced')
  const [final, setFinal] = useState(null)
  const [locks, setLocks] = useState({})
  const [myCalls, setMyCalls] = useState({})
  const [emotes, setEmotes] = useState([])
  const [clock, setClock] = useState(BUILD_SECS)
  const [votes, setVotes] = useState(new Set())
  const [kicked, setKicked] = useState(false)
  const lobbyRef = useRef(null), roomRef = useRef(null)
  const skew = useRef(0)                              // server clock minus this one
  const arrived = useRef(new Set())
  const lastChat = useRef(0), lastTyping = useRef(0)
  const onSeatPosRef = useRef(onSeatPos); onSeatPosRef.current = onSeatPos

  const closeAll = () => { lobbyRef.current?.close(); lobbyRef.current = null; roomRef.current?.close(); roomRef.current = null }
  const leave = useCallback(() => {
    closeAll()
    setPhase('idle'); setMatch(null); setHere([]); setBuilds({}); setChat([]); setFinal(null); setLocks({}); setMyCalls({}); setSpots({}); setLobbyHere([]); setVotes(new Set()); setLobbyChat([])
    arrived.current = new Set()
    releaseLive()
  }, [])
  useEffect(() => { if (!enabled) leave() }, [enabled, leave])
  useEffect(() => () => closeAll(), [])

  // ── The room ───────────────────────────────────────────────────────────────
  const enterRoom = useCallback((code, players, practice) => {
    lobbyRef.current?.close(); lobbyRef.current = null
    const mine = players.find(p => p.vid === meRef.current.vid)
    if (mine?.pos) onSeatPosRef.current?.(mine.pos)
    setMatch({ code, seed: code, created: Date.now(), ends: Date.now() + BUILD_SECS * 1000, players, bots: practice })
    setPhase('build'); setBuilds({}); setChat([]); setFinal(null); setLocks({}); setMyCalls({}); setVotes(new Set()); arrived.current = new Set()
    if (mine) markEntered({ kind: 'blacktop', code, team: mine.team ?? 0 })
    roomRef.current = liveSocket(`/room/${code}`, () => ({ t: 'hello', vid: meRef.current.vid }), m => {
      if (m.t === 'room') {
        skew.current = (m.now ?? Date.now()) - Date.now()
        const loc = ts => ts - skew.current
        setMatch(prev => {
          const rebuilt = prev && prev.seed !== m.seed
          if (rebuilt) { window.dispatchEvent(new CustomEvent('bap:blacktop-rebuild')); markEntered({ kind: 'blacktop', code, team: m.players.find(p => p.vid === meRef.current.vid)?.team ?? 0 }) }
          return { code: m.code, seed: m.seed, created: loc(m.created), ends: loc(m.ends), players: m.players, bots: m.practice }
        })
        setHere(m.here ?? [])
        setBuilds(m.builds ?? {})
        setVotes(new Set(m.votes ?? []))
        setLocks(m.locks ?? {})
        if (m.phase === 'build') { setFinal(null); setMyCalls({}); arrived.current = new Set(); setPhase('build') }
        else if (m.final) { setFinal(m.final); setPhase(p => (p === 'result' ? p : 'game')) }
        return
      }
      if (m.t === 'here') return setHere(m.here ?? [])
      if (m.t === 'build') return setBuilds(b => ({ ...b, [m.from]: { build: m.build, role: m.role, filled: m.filled, done: m.done, player: m.player } }))
      if (m.t === 'final') { setFinal(m.final); setPhase('game'); return }
      if (m.t === 'lock') return setLocks(l => (l[m.pn] ? l : { ...l, [m.pn]: m.calls }))
      if (m.t === 'emote') return setEmotes(list => [...list.slice(-12), { id: `${m.from}-${m.ts}`, from: m.from, e: m.e, ts: Date.now() }])
      if (m.t === 'chat') {
        if (blockedIds().has(m.uid)) return
        return setChat(c => [...c.slice(-80), { id: `${m.from}-${m.ts}`, from: m.from, uid: m.uid, name: m.name, cos: m.cos, team: m.team, text: clean(m.text), ts: m.ts, all: !!m.all }])
      }
      if (m.t === 'typing') return setTypingFrom(t => ({ ...t, [m.from]: { name: m.name, ts: Date.now() } }))
      if (m.t === 'votes') return setVotes(new Set(m.votes ?? []))
      if (m.t === 'gone') { leave(); onExit?.() }
    }, setLink)
  }, [leave, onExit])

  // ── The lobby ──────────────────────────────────────────────────────────────
  const join = useCallback((practice = false) => {
    if (!enabled) return
    if (!claimLive('blacktop')) { setPhase('busy'); return }
    setPhase('queue'); setWaited(0); setLobbyChat([]); setKicked(false)
    lobbyRef.current = liveSocket('/lobby', () => ({ t: 'hello', ...meRef.current }), m => {
      if (m.t === 'lobby') { setSpots(m.spots ?? {}); setLobbyHere(m.here ?? []); return }
      if (m.t === 'bumped') { setBumped(true); setTimeout(() => setBumped(false), 2600); return }
      if (m.t === 'match') return enterRoom(m.code, m.players, !!m.players.filter(p => p.bot).length)
      if (m.t === 'chat') {
        if (blockedIds().has(m.uid)) return
        return setLobbyChat(c => [...c.slice(-60), { id: `${m.from}-${m.ts}`, from: m.from, uid: m.uid, name: m.name, cos: m.cos, team: -1, text: clean(m.text), ts: m.ts, all: true }])
      }
      if (m.t === 'typing') setTypingFrom(t => ({ ...t, [m.from]: { name: m.name, ts: Date.now() } }))
    }, setLink)
    if (practice) setTimeout(() => lobbyRef.current?.send({ t: 'practice', pos: meRef.current.pos }), 600)
  }, [enabled, enterRoom])
  const seat = useCallback(slotId => lobbyRef.current?.send({ t: 'seat', slot: slotId }), [])

  useEffect(() => {
    if (phase !== 'queue') return
    const id = setInterval(() => setWaited(w => w + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  // ── Build: my build to the room (and again every few seconds) ─────────────
  const stateRef = useRef({}); stateRef.current = { build, position, role, player }
  const sendBuild = useCallback(() => {
    const { build: b, position: pos, role: rl, player: pl } = stateRef.current
    const t = types[pos === 'big' ? 'big' : 'guard']
    const filled = t.filter(k => b?.[k]).length
    roomRef.current?.send({ t: 'build', build: b ?? {}, role: rl, player: pl ?? null, filled, done: filled === t.length })
  }, [types])
  useEffect(() => { if (phase !== 'build') return; const id = setTimeout(sendBuild, 200); return () => clearTimeout(id) }, [phase, build, role, player, position, sendBuild])
  useEffect(() => { if (phase !== 'build') return; const id = setInterval(sendBuild, 5000); return () => clearInterval(id) }, [phase, sendBuild])
  useEffect(() => {
    if (phase !== 'build' || !match) return
    const tick = () => setClock(Math.max(0, Math.ceil((match.ends - Date.now()) / 1000)))
    tick(); const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [phase, match])

  const setRole = useCallback(r => setRoleState(r), [])
  const sendChat = useCallback((text, all = false) => {
    const now = Date.now()
    const sock = phase === 'queue' ? lobbyRef.current : roomRef.current
    if (!sock || now - lastChat.current < MIN_GAP_MS) return false
    const t = clean(text); if (!t) return false
    lastChat.current = now
    sock.send({ t: 'chat', text: t, all: phase === 'queue' || all })
    return true
  }, [phase])
  const typing = useCallback(() => {
    const now = Date.now(); if (now - lastTyping.current < 2000) return
    lastTyping.current = now
    ;(phase === 'queue' ? lobbyRef.current : roomRef.current)?.send({ t: 'typing' })
  }, [phase])

  // ── The game: the engine on the server's inputs ───────────────────────────
  const game = useMemo(() => {
    if (!final || !match) return null
    const out = new Set(final.afk ?? [])
    const cpu = seededShuffle(BOT_NAMES, `${final.seed}-afk`)
    let ci = 0
    const poolOf = pos => (pos === 'big' ? pools?.big : pools?.guard) ?? []
    const mk = p => {
      const t = p.pos === 'big' ? types.big : types.guard
      const sent = final.builds?.[p.vid]
      // a build that isn't real is treated as empty: the same answer on every phone
      const b = autoBuild(sent && buildOk(sent, poolOf(p.pos)) ? sent : null, t, poolOf(p.pos), `${final.seed}-${p.vid}`)
      return out.has(p.vid)
        ? { id: p.vid, name: cpu[ci++ % cpu.length], pos: p.pos, role: 'balanced', build: b, bot: true, uid: null, cos: null }
        : { id: p.vid, name: p.name, pos: p.pos, role: final.roles?.[p.vid] ?? 'balanced', build: b, bot: p.bot, uid: p.uid, cos: p.cos ?? null }
    }
    const teams = [match.players.filter(p => p.team === 0).map(mk), match.players.filter(p => p.team === 1).map(mk)]
    return { ...simStreetball({ teams, seed: final.seed, goal: 11, winBy: 2, cap: 15, names: [teamName(match, 0), teamName(match, 1)], calls: locks }), teams }
  }, [final, match, locks, pools, types])

  const recorded = useRef(null)
  const book = useCallback(() => {
    if (!game || !match || !final || recorded.current === final.seed || final.afk?.includes(me.vid)) return false
    // (booked at the end: until the last possession's calls are in, the game can still change)
    recorded.current = final.seed
    clearEntered(match.code)
    const mine = match.players.find(p => p.vid === me.vid)
    const won = mine && game.winner === mine.team
    const mvp = game.mvp === me.vid
    const xp = (won ? 40 : 15) + (mvp ? 20 : 0)
    const coins = (won ? 15 : 5) + (mvp ? 8 : 0)
    window.dispatchEvent(new CustomEvent('bap:xp', { detail: { xp, coins, label: won ? (mvp ? 'Blacktop win · MVP' : 'Blacktop win') : 'Blacktop game' } }))
    window.dispatchEvent(new CustomEvent('bap:blacktop', { detail: { won: !!won, mvp, line: game.stats[me.vid] ?? null, bots: !!match.bots, score: game.score, team: mine?.team ?? 0 } }))
    if (user && supabase && !match.bots) supabase.from('vs_results').insert({ user_id: user.id, username: getUsername(user), result: won ? 'win' : 'loss', ovr: null, position: mine?.pos ?? position, match_type: '3v3' }).then(null, () => {})
    return true
  }, [game, match, final, me.vid, user, position])
  const finish = useCallback(() => { book(); setPhase('result'); roomRef.current?.send({ t: 'done' }) }, [book])
  const voteRematch = useCallback(() => roomRef.current?.send({ t: 'rematch' }), [])
  const exit = useCallback(() => { leave(); onExit?.() }, [leave, onExit])

  // didn't finish in time: a CPU has the spot, and I'm out (it counts as leaving the game)
  useEffect(() => {
    if (!final?.afk?.includes(me.vid)) return
    setKicked(true)
    const mineT = match?.players.find(p => p.vid === me.vid)?.team ?? 0
    window.dispatchEvent(new CustomEvent('bap:blacktop', { detail: { won: false, mvp: false, line: null, bots: false, score: null, team: mineT, forfeit: true } }))
    clearEntered(match?.code)
    exit()
  }, [final]) // eslint-disable-line react-hooks/exhaustive-deps

  // the calls: I'm at check-up pn (the server opens the window when everyone is), my call, reactions
  const arrive = useCallback((pn, team) => {
    if (arrived.current.has(pn)) return
    arrived.current.add(pn)
    roomRef.current?.send({ t: 'at', pn, team })
  }, [])
  const call = useCallback((pn, v) => {
    if (myCalls[pn] != null) return
    setMyCalls(c => ({ ...c, [pn]: v }))
    roomRef.current?.send({ t: 'call', pn, v })
  }, [myCalls])
  const emote = useCallback(e => roomRef.current?.send({ t: 'emote', e }), [])

  const myTeam = match?.players.find(p => p.vid === me.vid)?.team ?? 0
  const visibleChat = useMemo(() => (phase === 'queue' ? lobbyChat : chat.filter(m => m.all || m.team === myTeam)), [chat, lobbyChat, myTeam, phase])
  // the shapes the screens expect: the lobby's people with their spots, who holds each spot
  const slotOf = vid => Object.entries(spots).find(([, p]) => p?.vid === vid)?.[0] ?? null
  const queue = lobbyHere.map(p => ({ ...p, slot: slotOf(p.vid) }))
  const held = Object.fromEntries(Object.entries(spots).filter(([, p]) => p))
  const present = (match?.players ?? []).filter(p => here.includes(p.vid))
  const now = Date.now()
  const typers = Object.entries(typingFrom).filter(([vid, x]) => vid !== me.vid && now - x.ts < 3500 && (phase === 'queue' || match?.players.find(p => p.vid === vid)?.team === myTeam)).map(([, x]) => x.name)
  return {
    server: true,
    phase, me, queue, waited, held, seated: Object.keys(held).length, mySlot: slotOf(me.vid), seat, bumped, link,
    retry: () => { closeAll(); join() }, canFill: false, join, practice: () => join(true), leave: exit, leaveLobby: leave,
    match, present, builds, clock, role, setRole, chat: visibleChat, sendChat, typing, typers, myTeam, leader: null, isLeader: false,
    final, game, finish, rematchVotes: votes, voteRematch, exit,
    locks, myCalls, call, arrive, lockCalls: () => {}, emotes, emote, kicked, clearKicked: () => setKicked(false),
  }
}
