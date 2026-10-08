// BLACKTOP — live 3v3. One hook owns the whole life of a match so the screens
// only render:
//   queue  → the lobby: two squads of 2 guards + 1 big. You tap an open spot to
//            join that team in that role; when all six are taken (or bots fill
//            the rest after a wait) the run starts
//   build  → everyone builds on a shared 3:00 clock, team chat, roles; the leader
//            finalises: anyone AFK or gone gets an auto-build with ratings off
//   game   → every client plays back the same seeded streetball game
//   result → XP, record, rematch vote
// "Leader" is just the lowest vid among the humans present — nothing is ever
// stored server-side, and if the leader leaves the next vid takes over.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { joinRoom, genCode, myVid } from './live'
import { seeded, seededShuffle } from './rng'
import { simStreetball, buildFromPlayer } from './hoops'
import { clean, blockedIds, MIN_GAP_MS } from './chat'
import { supabase } from './supabase'
import { getUsername } from './discord'
import { myCosmetics } from './progress'

export const ROOM_SIZE = 6
export const BUILD_SECS = 180
export const FILL_AFTER_SECS = 20
// Teams are named for their captains: the first human dealt to a side, else its first bot
export const captainOf = (match, t) => match?.players.find(p => p.team === t && !p.bot) ?? match?.players.find(p => p.team === t) ?? null
const firstName = p => (p ? p.name.trim().split(/\s+/)[0].toUpperCase().slice(0, 10) : null)
export function teamNames(match) {
  const caps = [captainOf(match, 0), captainOf(match, 1)]
  const names = caps.map((c, t) => firstName(c) ?? (t === 0 ? 'A' : 'B'))
  if (names[0] === names[1]) {
    // the same first name on both sides: the second squad goes by its next player
    const alt = match?.players.find(p => p.team === 1 && p !== caps[1])
    names[1] = firstName(alt) ?? `${names[1]} II`
    if (names[0] === names[1]) names[1] = `${names[1]} II`
  }
  return names.map(n => `TEAM ${n}`)
}
export const teamName = (match, t) => teamNames(match)[t]
export const ROLES = [
  { id: 'balanced', name: 'BALANCED', sub: 'Play your game' },
  { id: 'score', name: 'SCORER', sub: 'Shoot more, pass less' },
  { id: 'play', name: 'PLAYMAKER', sub: 'Find teammates' },
  { id: 'lock', name: 'LOCKDOWN', sub: 'Guard their best' },
]
const BOT_NAMES = ['Smoke', 'Shifty', 'Glass', 'Sauce', 'Twitch', 'Hammer', 'Ghost', 'Blitz', 'Cash', 'Lefty', 'Rook', 'Stretch']

// The lobby's six spots: every squad is two guards and a big
export const SLOTS = [
  { id: '0g0', team: 0, pos: 'guard' }, { id: '0g1', team: 0, pos: 'guard' }, { id: '0b', team: 0, pos: 'big' },
  { id: '1g0', team: 1, pos: 'guard' }, { id: '1g1', team: 1, pos: 'guard' }, { id: '1b', team: 1, pos: 'big' },
]
export const slotById = id => SLOTS.find(x => x.id === id) ?? null
// Who holds each spot: the earliest claim wins a tie (both see the same answer)
export function holders(list) {
  const out = {}
  for (const p of list) {
    if (!p.slot || !slotById(p.slot)) continue
    const cur = out[p.slot]
    if (!cur || (p.claim ?? 0) < (cur.claim ?? 0) || ((p.claim ?? 0) === (cur.claim ?? 0) && p.vid < cur.vid)) out[p.slot] = p
  }
  return out
}

// Deal six players into two teams: bigs spread first, then guards, snake order
export function dealTeams(players, seed) {
  const bigs = seededShuffle(players.filter(p => p.pos === 'big'), seed + 'b')
  const guards = seededShuffle(players.filter(p => p.pos !== 'big'), seed + 'g')
  const order = [...bigs, ...guards]
  const snake = [0, 1, 1, 0, 0, 1]
  return order.map((p, i) => ({ ...p, team: snake[i % 6] }))
}

export function makeBots(n, seed, startPos = 'guard') {
  const r = seeded(seed + 'bots')
  const names = seededShuffle(BOT_NAMES, seed)
  return Array.from({ length: n }, (_, i) => ({
    vid: `bot-${seed}-${i}`, name: names[i % names.length], uid: null, bot: true,
    pos: i % 3 === 0 ? (startPos === 'big' ? 'guard' : 'big') : r() < .35 ? 'big' : 'guard',
  }))
}

// Ratings off: fill what's missing with random players' real values — no optimising
export function autoBuild(partial, types, pool, seed) {
  const r = seeded(seed)
  const out = { ...(partial || {}) }
  for (const t of types) {
    if (out[t]) continue
    const pl = pool[Math.floor(r() * pool.length)]
    if (!pl) continue
    out[t] = buildFromPlayer(pl, [t], pl.photo ?? null)[t]
  }
  return out
}

const leaderOf = list => [...list].filter(p => !p.bot).map(p => p.vid).sort()[0] ?? null

export function useBlacktop({ enabled, user, position, pools, types, build, player, photoFor, onExit, onSeatPos }) {
  // your look travels with you (lobby spots, chat): re-read when you change it
  const [cosV, setCosV] = useState(0)
  useEffect(() => { const on = () => setCosV(v => v + 1); window.addEventListener('bap:cosmetics', on); return () => window.removeEventListener('bap:cosmetics', on) }, [])
  const me = useMemo(() => ({ vid: myVid(), name: user ? (getUsername(user) || 'Player') : 'Guest', uid: user?.id ?? null, pos: position, cos: myCosmetics() }), [user?.id, position, cosV]) // eslint-disable-line
  const [phase, setPhase] = useState('idle')          // idle | queue | build | game | result
  const [queue, setQueue] = useState([])               // presence in the lobby
  const [mySlot, setMySlot] = useState(null)           // the spot I claimed in the lobby
  const [bumped, setBumped] = useState(false)          // someone beat me to a spot
  const [lobbyChat, setLobbyChat] = useState([])
  const [waited, setWaited] = useState(0)
  const [match, setMatch] = useState(null)             // { code, seed, created, players:[{vid,name,uid,pos,team,bot}] }
  const [present, setPresent] = useState([])           // presence in the room
  const [builds, setBuilds] = useState({})             // vid → { build, pos, role, player, filled, done }
  const [chat, setChat] = useState([])                 // [{ id, from, name, team, text, ts, all }]
  const [role, setRoleState] = useState('balanced')
  const [final, setFinal] = useState(null)             // { builds, roles, seed }
  const [clock, setClock] = useState(BUILD_SECS)
  const [rematchVotes, setRematchVotes] = useState(new Set())
  const roomRef = useRef(null)
  const queueRef = useRef(null)
  const lastSend = useRef(0)
  const lastChat = useRef(0)
  const finalSent = useRef(false)
  const stateRef = useRef({})
  const onSeatPosRef = useRef(onSeatPos); onSeatPosRef.current = onSeatPos
  const lastTyping = useRef(0)
  stateRef.current = { match, present, builds, build, position, role, player, final, phase }

  const leave = useCallback(() => {
    queueRef.current?.leave(); queueRef.current = null
    roomRef.current?.leave(); roomRef.current = null
    setPhase('idle'); setMatch(null); setPresent([]); setBuilds({}); setChat([]); setFinal(null); setQueue([]); setRematchVotes(new Set()); setMySlot(null); setLobbyChat([])
    finalSent.current = false
  }, [])
  useEffect(() => { if (!enabled) leave() }, [enabled, leave])
  useEffect(() => () => leave(), [leave])

  // ── Queue ──────────────────────────────────────────────────────────────────
  const enterRoom = useCallback(m => {
    queueRef.current?.leave(); queueRef.current = null
    setMatch(m); setPhase('build'); setBuilds({}); setChat([]); setFinal(null); setRematchVotes(new Set())
    finalSent.current = false
    const mine = m.players.find(p => p.vid === me.vid)
    if (mine?.pos) onSeatPosRef.current?.(mine.pos)
    const room = joinRoom(`blacktop-${m.code}`, { ...me, pos: mine?.pos ?? me.pos, team: mine?.team ?? 0, filled: 0, done: false })
    roomRef.current = room
    room.onPresence(setPresent)
    room.on('build', p => setBuilds(b => ({ ...b, [p.from]: { build: p.build, pos: p.pos, role: p.role, player: p.player, filled: p.filled, done: p.done } })))
    room.on('chat', p => {
      if (blockedIds().has(p.uid)) return
      setChat(c => [...c.slice(-80), { id: `${p.from}-${p.ts}`, from: p.from, uid: p.uid, name: p.name, cos: p.cos, team: p.team, text: clean(p.text), ts: p.ts, all: !!p.all }])
    })
    room.on('final', p => { setFinal(f => f ?? { builds: p.builds, roles: p.roles, seed: p.seed }); setPhase('game') })
    room.on('rematch', p => setRematchVotes(s => new Set([...s, p.from])))
    room.on('again', p => {
      setMatch(mm => ({ ...mm, seed: p.seed, created: p.created }))
      setBuilds({}); setFinal(null); setRematchVotes(new Set()); finalSent.current = false
      setPhase('build')
      window.dispatchEvent(new CustomEvent('bap:blacktop-rebuild'))
    })
  }, [me])

  // Builds the match from the spots: humans where they sat, bots in the rest
  const formFrom = useCallback((list, bots) => {
    const code = genCode()
    const held = holders(list)
    const bnames = seededShuffle(BOT_NAMES, code)
    let bi = 0
    const players = SLOTS.map(sl => {
      const h = held[sl.id]
      if (h) return { vid: h.vid, name: h.name, uid: h.uid ?? null, pos: sl.pos, team: sl.team, bot: false, slot: sl.id }
      return { vid: `bot-${code}-${sl.id}`, name: bnames[bi++ % bnames.length], uid: null, pos: sl.pos, team: sl.team, bot: true, slot: sl.id }
    })
    return { code, seed: code, created: Date.now(), players, bots }
  }, [])
  const seatedLeader = list => { const held = holders(list); return [...list].filter(p => p.slot && held[p.slot]?.vid === p.vid).map(p => p.vid).sort()[0] ?? null }

  const join = useCallback(() => {
    if (!enabled) return
    setPhase('queue'); setWaited(0); setMySlot(null); setLobbyChat([])
    const q = joinRoom('blacktop-q', { ...me, ts: Date.now(), slot: null, claim: 0 })
    queueRef.current = q
    q.onPresence(list => {
      setQueue(list)
      const held = holders(list)
      // beaten to my spot: step back out
      const mine = list.find(p => p.vid === me.vid)
      if (mine?.slot && held[mine.slot] && held[mine.slot].vid !== me.vid) {
        q.track({ slot: null, claim: 0 }); setMySlot(null); setBumped(true); setTimeout(() => setBumped(false), 2600)
        return
      }
      if (SLOTS.every(sl => held[sl.id]) && seatedLeader(list) === me.vid && queueRef.current === q) {
        const m = formFrom(list, false)
        q.send('match', m); enterRoom(m)
      }
    })
    q.on('match', m => { if (m.players.some(p => p.vid === me.vid)) enterRoom(m) })
    q.on('fill', () => {
      const list = q.presence()
      if (seatedLeader(list) === me.vid && queueRef.current === q) { const m = formFrom(list, true); q.send('match', m); enterRoom(m) }
    })
    q.on('chat', p => {
      if (blockedIds().has(p.uid)) return
      setLobbyChat(c => [...c.slice(-60), { id: `${p.from}-${p.ts}`, from: p.from, uid: p.uid, name: p.name, cos: p.cos, team: -1, text: clean(p.text), ts: p.ts, all: true }])
    })
  }, [enabled, me, enterRoom, formFrom]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tap a spot: claim it (null steps back out)
  const seat = useCallback(slotId => {
    const q = queueRef.current; if (!q) return
    const held = holders(q.presence())
    if (slotId && held[slotId] && held[slotId].vid !== me.vid) return
    q.track({ slot: slotId, claim: slotId ? Date.now() : 0 })
    setMySlot(slotId)
  }, [me.vid])

  // Bots take the open spots: any seated player can ask, the seated leader deals it
  const fillNow = useCallback(() => {
    const q = queueRef.current; if (!q) return
    q.send('fill', {})
    const list = q.presence()
    if (seatedLeader(list) === me.vid) { const m = formFrom(list, true); q.send('match', m); enterRoom(m) }
  }, [me.vid, enterRoom, formFrom]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== 'queue') return
    const id = setInterval(() => setWaited(w => w + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  // ── Build phase: share my build, keep the clock, finalise as leader ───────
  useEffect(() => {
    if (phase !== 'build' || !roomRef.current) return
    const now = Date.now()
    const send = () => {
      const { build, position, role, player } = stateRef.current
      const t = types[position === 'big' ? 'big' : 'guard']
      const filled = t.filter(k => build?.[k]).length
      const done = filled === t.length
      roomRef.current?.send('build', { build, pos: position, role, player, filled, done })
      roomRef.current?.track({ filled, done })
      setBuilds(b => ({ ...b, [me.vid]: { build, pos: position, role, player, filled, done } }))
      lastSend.current = Date.now()
    }
    if (now - lastSend.current > 250) send(); else { const id = setTimeout(send, 250); return () => clearTimeout(id) }
  }, [phase, build, role, player, position, types, me.vid])

  useEffect(() => {
    if (phase !== 'build' || !match) return
    const tick = () => {
      const left = Math.max(0, BUILD_SECS - Math.floor((Date.now() - match.created) / 1000))
      setClock(left)
      const { present, builds } = stateRef.current
      const humans = match.players.filter(p => !p.bot)
      const here = humans.filter(p => present.some(q => q.vid === p.vid))
      const allDone = here.length > 0 && here.every(p => builds[p.vid]?.done)
      if ((left <= 0 || allDone) && leaderOf(present) === me.vid && !finalSent.current) {
        finalSent.current = true
        const seed = `${match.seed}-${Date.now()}`
        const out = {}, roles = {}
        for (const p of match.players) {
          const t = p.pos === 'big' ? types.big : types.guard
          const have = builds[p.vid]?.build
          out[p.vid] = autoBuild(have, t, p.pos === 'big' ? pools.big : pools.guard, `${seed}-${p.vid}`)
          roles[p.vid] = builds[p.vid]?.role ?? 'balanced'
        }
        const f = { builds: out, roles, seed }
        roomRef.current?.send('final', f)
        setTimeout(() => roomRef.current?.send('final', f), 1500)   // once more for anyone who blinked
        setFinal(f); setPhase('game')
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [phase, match, me.vid, types, pools])

  const setRole = useCallback(r => setRoleState(r), [])
  const sendChat = useCallback((text, all = false) => {
    const now = Date.now()
    const inLobby = phase === 'queue'
    const room = inLobby ? queueRef.current : roomRef.current
    if (!room || !user || now - lastChat.current < MIN_GAP_MS) return false
    const t = clean(text); if (!t) return false
    lastChat.current = now
    const mine = match?.players.find(p => p.vid === me.vid)
    const msg = { uid: me.uid, name: me.name, cos: me.cos, team: inLobby ? -1 : (mine?.team ?? 0), text: t, ts: now, all: inLobby || all }
    room.send('chat', msg)
    room.track({ typing: 0 })
    const line = { id: `${me.vid}-${now}`, from: me.vid, ...msg }
    if (inLobby) setLobbyChat(c => [...c.slice(-60), line]); else setChat(c => [...c.slice(-80), line])
    return true
  }, [user, match, me, phase])
  // "... is typing" (shared through presence, at most every 2s)
  const typing = useCallback(() => {
    const now = Date.now()
    if (now - lastTyping.current < 2000) return
    lastTyping.current = now
    ;(phase === 'queue' ? queueRef.current : roomRef.current)?.track({ typing: now })
  }, [phase])

  // ── Game ───────────────────────────────────────────────────────────────────
  const game = useMemo(() => {
    if (!final || !match) return null
    const mk = p => ({ id: p.vid, name: p.name, pos: p.pos, role: final.roles[p.vid] ?? 'balanced', build: final.builds[p.vid], bot: p.bot, uid: p.uid })
    const teams = [match.players.filter(p => p.team === 0).map(mk), match.players.filter(p => p.team === 1).map(mk)]
    return { ...simStreetball({ teams, seed: final.seed, goal: 21, winBy: 2, cap: 25, names: [teamName(match, 0), teamName(match, 1)] }), teams }
  }, [final, match])

  const recorded = useRef(null)
  const finish = useCallback(() => {
    if (!game || !match || recorded.current === final?.seed) return
    recorded.current = final?.seed
    const mine = match.players.find(p => p.vid === me.vid)
    const won = mine && game.winner === mine.team
    const mvp = game.mvp === me.vid
    const xp = (won ? 40 : 15) + (mvp ? 20 : 0)
    const coins = (won ? 30 : 10) + (mvp ? 15 : 0)
    window.dispatchEvent(new CustomEvent('bap:xp', { detail: { xp, coins, label: won ? (mvp ? 'Blacktop win · MVP' : 'Blacktop win') : 'Blacktop game' } }))
    window.dispatchEvent(new CustomEvent('bap:blacktop', { detail: { won: !!won, mvp } }))
    if (user && supabase && !match.bots) {
      const line = game.stats[me.vid]
      supabase.from('vs_results').insert({ user_id: user.id, username: getUsername(user), result: won ? 'win' : 'loss', ovr: null, position: mine?.pos ?? position, match_type: '3v3' }).then(null, () => {})
      void line
    }
    setPhase('result')
  }, [game, match, final, me.vid, user, position])

  const voteRematch = useCallback(() => {
    if (!roomRef.current || !match) return
    roomRef.current.send('rematch', {})
    setRematchVotes(s => new Set([...s, me.vid]))
  }, [match, me.vid])
  // Every human still here has voted → the leader deals it again (whoever voted last)
  const againSent = useRef(null)
  useEffect(() => {
    if (phase !== 'result' || !match || !roomRef.current) return
    const humansHere = match.players.filter(p => !p.bot && present.some(q => q.vid === p.vid))
    if (!humansHere.length || !humansHere.every(p => rematchVotes.has(p.vid))) return
    if (leaderOf(present) !== me.vid || againSent.current === final?.seed) return
    againSent.current = final?.seed
    const again = { seed: genCode(), created: Date.now() }
    roomRef.current.send('again', again)
    setMatch(mm => ({ ...mm, ...again })); setBuilds({}); setFinal(null); setRematchVotes(new Set()); finalSent.current = false
    setPhase('build')
    window.dispatchEvent(new CustomEvent('bap:blacktop-rebuild'))
  }, [phase, rematchVotes, present, match, me.vid, final])

  const exit = useCallback(() => { leave(); onExit?.() }, [leave, onExit])

  const myTeam = match?.players.find(p => p.vid === me.vid)?.team ?? 0
  const visibleChat = useMemo(() => (phase === 'queue' ? lobbyChat : chat.filter(m => m.all || m.team === myTeam)), [chat, lobbyChat, myTeam, phase])
  const leader = leaderOf(present)
  const held = useMemo(() => holders(queue), [queue])
  const seated = Object.keys(held).length
  const typers = (phase === 'queue' ? queue : present.filter(p => match?.players.find(q => q.vid === p.vid)?.team === myTeam))
    .filter(p => p.vid !== me.vid && (p.typing ?? 0) > Date.now() - 3500).map(p => p.name)
  return {
    phase, me, queue, waited, held, seated, mySlot, seat, bumped,
    canFill: !!mySlot && waited >= FILL_AFTER_SECS && seated < ROOM_SIZE, join, fill: fillNow, leave: exit,
    match, present, builds, clock, role, setRole, chat: visibleChat, sendChat, typing, typers, myTeam, leader, isLeader: leader === me.vid,
    final, game, finish, rematchVotes, voteRematch, exit,
  }
}
