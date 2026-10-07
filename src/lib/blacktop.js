// BLACKTOP — live 3v3. One hook owns the whole life of a match so the screens
// only render:
//   queue  → 6 players gather (or bots fill after a wait) → the leader deals teams
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

export const ROOM_SIZE = 6
export const BUILD_SECS = 180
export const FILL_AFTER_SECS = 20
export const TEAM_NAMES = ['SHIRTS', 'SKINS']
export const ROLES = [
  { id: 'balanced', name: 'BALANCED', sub: 'Play your game' },
  { id: 'score', name: 'SCORER', sub: 'Shoot more, pass less' },
  { id: 'play', name: 'PLAYMAKER', sub: 'Find teammates' },
  { id: 'lock', name: 'LOCKDOWN', sub: 'Guard their best' },
]
const BOT_NAMES = ['Smoke', 'Shifty', 'Glass', 'Sauce', 'Twitch', 'Hammer', 'Ghost', 'Blitz', 'Cash', 'Lefty', 'Rook', 'Stretch']

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

export function useBlacktop({ enabled, user, position, pools, types, build, player, photoFor, onExit }) {
  const me = useMemo(() => ({ vid: myVid(), name: user ? (getUsername(user) || 'Player') : 'Guest', uid: user?.id ?? null, pos: position }), [user?.id, position]) // eslint-disable-line
  const [phase, setPhase] = useState('idle')          // idle | queue | build | game | result
  const [queue, setQueue] = useState([])               // presence in the queue
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
  stateRef.current = { match, present, builds, build, position, role, player, final, phase }

  const leave = useCallback(() => {
    queueRef.current?.leave(); queueRef.current = null
    roomRef.current?.leave(); roomRef.current = null
    setPhase('idle'); setMatch(null); setPresent([]); setBuilds({}); setChat([]); setFinal(null); setQueue([]); setRematchVotes(new Set())
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
    const room = joinRoom(`blacktop-${m.code}`, { ...me, team: mine?.team ?? 0, filled: 0, done: false })
    roomRef.current = room
    room.onPresence(setPresent)
    room.on('build', p => setBuilds(b => ({ ...b, [p.from]: { build: p.build, pos: p.pos, role: p.role, player: p.player, filled: p.filled, done: p.done } })))
    room.on('chat', p => {
      if (blockedIds().has(p.uid)) return
      setChat(c => [...c.slice(-80), { id: `${p.from}-${p.ts}`, from: p.from, uid: p.uid, name: p.name, team: p.team, text: clean(p.text), ts: p.ts, all: !!p.all }])
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

  const join = useCallback(() => {
    if (!enabled) return
    setPhase('queue'); setWaited(0)
    const q = joinRoom('blacktop-q', { ...me, ts: Date.now() })
    queueRef.current = q
    const sorted = list => [...list].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0) || a.vid.localeCompare(b.vid))
    const form = (list, bots) => {
      const code = genCode()
      const humans = sorted(list).slice(0, ROOM_SIZE).map(({ vid, name, uid, pos }) => ({ vid, name, uid, pos, bot: false }))
      const all = [...humans, ...makeBots(Math.max(0, ROOM_SIZE - humans.length), code, position)].slice(0, ROOM_SIZE)
      const m = { code, seed: code, created: Date.now(), players: dealTeams(all, code), bots }
      q.send('match', m)
      enterRoom(m)
    }
    q.onPresence(list => {
      setQueue(sorted(list))
      if (list.length >= ROOM_SIZE && leaderOf(list) === me.vid) form(list, false)
    })
    q.on('match', m => { if (m.players.some(p => p.vid === me.vid)) enterRoom(m) })
    q.on('fill', () => { const list = q.presence(); if (leaderOf(list) === me.vid) form(list, true) })
  }, [enabled, me, position, enterRoom])

  // the leader doesn't receive its own broadcast: act locally too
  const fillNow = useCallback(() => {
    const q = queueRef.current; if (!q) return
    q.send('fill', {})
    const list = q.presence()
    if (leaderOf(list) === me.vid) {
      const code = genCode()
      const humans = [...list].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0)).slice(0, ROOM_SIZE).map(({ vid, name, uid, pos }) => ({ vid, name, uid, pos, bot: false }))
      const all = [...humans, ...makeBots(ROOM_SIZE - humans.length, code, position)]
      const m = { code, seed: code, created: Date.now(), players: dealTeams(all, code), bots: true }
      q.send('match', m)
      enterRoom(m)
    }
  }, [me.vid, position, enterRoom])
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
    if (!roomRef.current || !user || now - lastChat.current < MIN_GAP_MS) return false
    const t = clean(text); if (!t) return false
    lastChat.current = now
    const mine = match?.players.find(p => p.vid === me.vid)
    const msg = { uid: me.uid, name: me.name, team: mine?.team ?? 0, text: t, ts: now, all }
    roomRef.current.send('chat', msg)
    setChat(c => [...c.slice(-80), { id: `${me.vid}-${now}`, from: me.vid, ...msg }])
    return true
  }, [user, match, me])

  // ── Game ───────────────────────────────────────────────────────────────────
  const game = useMemo(() => {
    if (!final || !match) return null
    const mk = p => ({ id: p.vid, name: p.name, pos: p.pos, role: final.roles[p.vid] ?? 'balanced', build: final.builds[p.vid], bot: p.bot, uid: p.uid })
    const teams = [match.players.filter(p => p.team === 0).map(mk), match.players.filter(p => p.team === 1).map(mk)]
    return { ...simStreetball({ teams, seed: final.seed, goal: 21, winBy: 2, cap: 25 }), teams }
  }, [final, match])

  const recorded = useRef(null)
  const finish = useCallback(() => {
    if (!game || !match || recorded.current === final?.seed) return
    recorded.current = final?.seed
    const mine = match.players.find(p => p.vid === me.vid)
    const won = mine && game.winner === mine.team
    const mvp = game.mvp === me.vid
    const xp = (won ? 40 : 15) + (mvp ? 20 : 0)
    window.dispatchEvent(new CustomEvent('bap:xp', { detail: { xp, label: won ? (mvp ? 'Blacktop win · MVP' : 'Blacktop win') : 'Blacktop game' } }))
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
  const visibleChat = useMemo(() => chat.filter(m => m.all || m.team === myTeam), [chat, myTeam])
  const leader = leaderOf(present)
  return {
    phase, me, queue, waited, canFill: waited >= FILL_AFTER_SECS && queue.length < ROOM_SIZE, join, fill: fillNow, leave: exit,
    match, present, builds, clock, role, setRole, chat: visibleChat, sendChat, myTeam, leader, isLeader: leader === me.vid,
    final, game, finish, rematchVotes, voteRematch, exit,
  }
}
