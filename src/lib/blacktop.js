// BLACKTOP — live 3v3. One hook owns the whole life of a match so the screens
// only render:
//   queue  → the lobby: two squads of 2 guards + 1 big. You tap an open spot to
//            join that team in that role; when all six are taken the run
//            starts (real players only, no bots in the lobby)
//   build  → everyone builds on a shared 3:00 clock, team chat, roles; the leader
//            finalises: anyone AFK or gone gets an auto-build with ratings off
//   game   → every client plays back the same seeded streetball game
//   result → XP, record, rematch vote
// "Leader" is just the lowest vid among the humans present — nothing is ever
// stored server-side, and if the leader leaves the next vid takes over.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { joinRoom, genCode, myVid, myDevice, claimLive, releaseLive, markEntered, clearEntered, takeEntered } from './live'
import { seeded, seededShuffle } from './rng'
import { simStreetball, buildFromPlayer } from './hoops'
import { clean, blockedIds, MIN_GAP_MS } from './chat'
import { supabase } from './supabase'
import { getUsername } from './discord'
import { myCosmetics, whenProgressReady } from './progress'

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

// Quick reactions on the court
export const EMOTES = ['🔥', '🧊', '💰', '😤', '👏', '😂']

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

// A build from the room: every rating is 0-11, and a chip naming a real player
// carries that player's real number (nobody plays with made-up 11s)
function buildOk(b, pool) {
  if (!b || typeof b !== 'object') return false
  for (const [t, chip] of Object.entries(b)) {
    if (!chip) continue
    const v = Number(chip.val)
    if (!(v >= 0 && v <= 11)) return false
    const pl = chip.qbFull ? pool.find(x => x.name === chip.qbFull) : null
    if (pl && pl.attrs?.[t] != null && pl.attrs[t] !== v) return false
  }
  return true
}
// the same picks (who, at what): the dealer can't swap anyone's build
const samePicks = (a, b) => Object.keys({ ...a, ...b }).every(t => (a?.[t]?.qbFull ?? null) === (b?.[t]?.qbFull ?? null) && Number(a?.[t]?.val) === Number(b?.[t]?.val))

export function useBlacktop({ enabled, user, position, pools, types, build, player, photoFor, onExit, onSeatPos }) {
  // your look travels with you (lobby spots, chat): re-read when you change it
  const [cosV, setCosV] = useState(0)
  useEffect(() => { const on = () => setCosV(v => v + 1); window.addEventListener('bap:cosmetics', on); return () => window.removeEventListener('bap:cosmetics', on) }, [])
  const me = useMemo(() => ({ vid: myVid(), dev: myDevice(), name: user ? (getUsername(user) || 'Player') : 'Guest', uid: user?.id ?? null, pos: position, cos: myCosmetics() }), [user?.id, position, cosV]) // eslint-disable-line
  // a game this device left before it was decided (reload, the app killed): it's a loss
  useEffect(() => {
    const e = takeEntered('blacktop'); if (!e) return
    whenProgressReady(() => window.dispatchEvent(new CustomEvent('bap:blacktop', { detail: { won: false, mvp: false, line: null, bots: false, score: null, team: e.team ?? 0, forfeit: true } })))
  }, [])
  const [phase, setPhase] = useState('idle')          // idle | queue | build | game | result
  const [queue, setQueue] = useState([])               // presence in the lobby
  const [link, setLink] = useState('connecting')       // 'connecting' | 'live' | 'local' (this device only)
  const [mySlot, setMySlot] = useState(null)           // the spot I claimed in the lobby
  const [bumped, setBumped] = useState(false)          // someone beat me to a spot
  const [lobbyChat, setLobbyChat] = useState([])
  const [waited, setWaited] = useState(0)
  const [match, setMatch] = useState(null)             // { code, seed, created, players:[{vid,name,uid,pos,team,bot}] }
  const [present, setPresent] = useState([])           // presence in the room
  // the live game's calls: what each team called for possession pn, collected
  // by the leader and locked for everyone ({ [pn]: { 0: call, 1: call } })
  const [locks, setLocks] = useState({})
  const [myCalls, setMyCalls] = useState({})            // { [pn]: call } what I tapped
  const callsRef = useRef({})                           // the leader's collection
  const [emotes, setEmotes] = useState([])              // [{ id, from, e, ts }] quick reactions
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
  const poolsRef = useRef(pools); poolsRef.current = pools

  const leave = useCallback(() => {
    queueRef.current?.leave(); queueRef.current = null
    roomRef.current?.leave(); roomRef.current = null
    setPhase('idle'); setMatch(null); setPresent([]); setBuilds({}); setChat([]); setFinal(null); setQueue([]); setRematchVotes(new Set()); setMySlot(null); setLobbyChat([])
    finalSent.current = false
    releaseLive()
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
    if (mine) markEntered({ kind: 'blacktop', code: m.code, team: mine.team ?? 0 })
    const poolOf = pos => (pos === 'big' ? poolsRef.current?.big : poolsRef.current?.guard) ?? []
    // a player's build: only from someone in the game, never for me, and only real ratings
    room.on('build', p => {
      const who = m.players.find(x => x.vid === p.from)
      if (!who || p.from === me.vid || !buildOk(p.build, poolOf(who.pos))) return
      setBuilds(b => ({ ...b, [p.from]: { build: p.build, pos: who.pos, role: p.role, player: p.player, filled: p.filled, done: p.done } }))
    })
    room.on('chat', p => {
      if (blockedIds().has(p.uid)) return
      setChat(c => [...c.slice(-80), { id: `${p.from}-${p.ts}`, from: p.from, uid: p.uid, name: p.name, cos: p.cos, team: p.team, text: clean(p.text), ts: p.ts, all: !!p.all }])
    })
    // the game: only from the dealer (the lowest id here), on the game's own seed
    // (nobody picks a lucky one), every build real, and nobody's picks swapped
    room.on('final', p => {
      const st = stateRef.current, mm = st.match
      // (the dealer by what I see here, or the lowest id in the game: views of who's here can differ for a moment)
      if (!mm || ![leaderOf(st.present.length ? st.present : mm.players), leaderOf(mm.players)].includes(p.from) || p.seed !== `${mm.seed}-f`) return
      for (const pl of mm.players) {
        const b = p.builds?.[pl.vid]
        if (!buildOk(b, poolOf(pl.pos))) return
        const sent = pl.vid !== me.vid && st.builds[pl.vid]?.done ? st.builds[pl.vid].build : null
        if (sent && !samePicks(sent, Object.fromEntries(Object.entries(b).filter(([t]) => sent[t])))) return
      }
      setFinal(f => f ?? { builds: p.builds, roles: p.roles, seed: p.seed }); setLocks({}); setMyCalls({}); callsRef.current = {}; setPhase('game')
    })
    room.on('rematch', p => { if (m.players.some(x => x.vid === p.from)) setRematchVotes(s => new Set([...s, p.from])) })
    // a call: the first one in for a team and possession counts
    room.on('call', p => {
      const who = m.players.find(x => x.vid === p.from)
      if (!who || who.team !== p.team || !Number.isInteger(p.pn) || typeof p.v !== 'string') return
      const c = (callsRef.current[p.pn] ??= {})
      if (c[p.team] == null) c[p.team] = p.v
    })
    // the leader's lock for a possession: everyone plays it with these
    room.on('lock', p => {
      const st = stateRef.current, mm = st.match
      if (!mm || ![leaderOf(st.present.length ? st.present : mm.players), leaderOf(mm.players)].includes(p.from) || !Number.isInteger(p.pn)) return
      setLocks(l => (l[p.pn] ? l : { ...l, [p.pn]: { 0: p.calls?.[0] ?? null, 1: p.calls?.[1] ?? null } }))
    })
    room.on('emote', p => {
      if (!m.players.some(x => x.vid === p.from) || !EMOTES.includes(p.e)) return
      setEmotes(list => [...list.slice(-12), { id: `${p.from}-${p.ts}`, from: p.from, e: p.e, ts: Date.now() }])
    })
    room.on('again', p => {
      const st = stateRef.current, mm = st.match
      if (!mm || ![leaderOf(st.present.length ? st.present : mm.players), leaderOf(mm.players)].includes(p.from) || p.seed !== `${mm.seed}r`) return
      markEntered({ kind: 'blacktop', code: m.code, team: m.players.find(x => x.vid === me.vid)?.team ?? 0 })
      setMatch(x => ({ ...x, seed: p.seed, created: Date.now() }))
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
      if (h) return { vid: h.vid, name: h.name, uid: h.uid ?? null, cos: h.cos ?? null, pos: sl.pos, team: sl.team, bot: false, slot: sl.id }
      return { vid: `bot-${code}-${sl.id}`, name: bnames[bi++ % bnames.length], uid: null, pos: sl.pos, team: sl.team, bot: true, slot: sl.id }
    })
    return { code, seed: code, created: Date.now(), players, bots }
  }, [])
  const seatedLeader = list => { const held = holders(list); return [...list].filter(p => p.slot && held[p.slot]?.vid === p.vid).map(p => p.vid).sort()[0] ?? null }

  const join = useCallback(() => {
    if (!enabled) return
    // one live game per device: another tab or window is already in one
    if (!claimLive('blacktop')) { setPhase('busy'); return }
    setPhase('queue'); setWaited(0); setMySlot(null); setLobbyChat([])
    const q = joinRoom('blacktop-q', { ...me, ts: Date.now(), slot: null, claim: 0 })
    queueRef.current = q
    setLink('connecting'); q.onStatus(setLink)
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
    // real players only: the lobby never fills with bots (a player who doesn't
    // finish their build is built for them once the game is on)
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
        const seed = `${match.seed}-f`        // the game's own seed: the dealer doesn't pick it
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
        setFinal(f); setLocks({}); setMyCalls({}); callsRef.current = {}; setPhase('game')
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
    if (!room || now - lastChat.current < MIN_GAP_MS) return false
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
    const mk = p => ({ id: p.vid, name: p.name, pos: p.pos, role: final.roles[p.vid] ?? 'balanced', build: final.builds[p.vid], bot: p.bot, uid: p.uid, cos: p.cos ?? null })
    const teams = [match.players.filter(p => p.team === 0).map(mk), match.players.filter(p => p.team === 1).map(mk)]
    return { ...simStreetball({ teams, seed: final.seed, goal: 11, winBy: 2, cap: 15, names: [teamName(match, 0), teamName(match, 1)], calls: locks }), teams }
  }, [final, match, locks])

  const recorded = useRef(null)
  const book = useCallback(() => {
    if (!game || !match || recorded.current === final?.seed) return false
    recorded.current = final?.seed
    clearEntered(match.code)
    const mine = match.players.find(p => p.vid === me.vid)
    const won = mine && game.winner === mine.team
    const mvp = game.mvp === me.vid
    const xp = (won ? 40 : 15) + (mvp ? 20 : 0)
    const coins = (won ? 15 : 5) + (mvp ? 8 : 0)
    window.dispatchEvent(new CustomEvent('bap:xp', { detail: { xp, coins, label: won ? (mvp ? 'Blacktop win · MVP' : 'Blacktop win') : 'Blacktop game' } }))
    window.dispatchEvent(new CustomEvent('bap:blacktop', { detail: { won: !!won, mvp, line: game.stats[me.vid] ?? null, bots: !!match.bots, score: game.score, team: mine?.team ?? 0 } }))
    if (user && supabase && !match.bots) {
      const line = game.stats[me.vid]
      supabase.from('vs_results').insert({ user_id: user.id, username: getUsername(user), result: won ? 'win' : 'loss', ovr: null, position: mine?.pos ?? position, match_type: '3v3' }).then(null, () => {})
      void line
    }
    return true
  }, [game, match, final, me.vid, user, position])
  // the game is decided the moment it's dealt: book it then (the playback is just the show)
  useEffect(() => { if (game) book() }, [game, book])
  const finish = useCallback(() => { book(); setPhase('result') }, [book])

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
    const again = { seed: `${match.seed}r`, created: Date.now() }   // the next game's seed follows from this one
    roomRef.current.send('again', again)
    markEntered({ kind: 'blacktop', code: match.code, team: match.players.find(x => x.vid === me.vid)?.team ?? 0 })
    setMatch(mm => ({ ...mm, ...again })); setBuilds({}); setFinal(null); setRematchVotes(new Set()); finalSent.current = false
    setPhase('build')
    window.dispatchEvent(new CustomEvent('bap:blacktop-rebuild'))
  }, [phase, rematchVotes, present, match, me.vid, final])

  const exit = useCallback(() => { leave(); onExit?.() }, [leave, onExit])

  const myTeam = match?.players.find(p => p.vid === me.vid)?.team ?? 0
  const visibleChat = useMemo(() => (phase === 'queue' ? lobbyChat : chat.filter(m => m.all || m.team === myTeam)), [chat, lobbyChat, myTeam, phase])
  const leader = leaderOf(present)
  // my call for possession pn (offense or defense: the screen offers the right ones)
  const call = useCallback((pn, v) => {
    if (myCalls[pn] != null) return
    setMyCalls(c => ({ ...c, [pn]: v }))
    const c = (callsRef.current[pn] ??= {})
    if (c[myTeam] == null) c[myTeam] = v
    roomRef.current?.send('call', { pn, team: myTeam, v })
  }, [myCalls, myTeam])
  // lock possession pn: the leader sends what came in; anyone else only if the
  // leader's lock never arrives (fallback: what I collected)
  const lockCalls = useCallback((pn, send) => {
    const calls = { 0: callsRef.current[pn]?.[0] ?? null, 1: callsRef.current[pn]?.[1] ?? null }
    setLocks(l => (l[pn] ? l : { ...l, [pn]: calls }))
    if (send) roomRef.current?.send('lock', { pn, calls })
  }, [])
  const emote = useCallback(e => {
    if (!EMOTES.includes(e)) return
    const ts = Date.now()
    setEmotes(list => [...list.slice(-12), { id: `${me.vid}-${ts}`, from: me.vid, e, ts }])
    roomRef.current?.send('emote', { e, ts })
  }, [me.vid])
  const held = useMemo(() => holders(queue), [queue])
  const seated = Object.keys(held).length
  const typers = (phase === 'queue' ? queue : present.filter(p => match?.players.find(q => q.vid === p.vid)?.team === myTeam))
    .filter(p => p.vid !== me.vid && (p.typing ?? 0) > Date.now() - 3500).map(p => p.name)
  return {
    phase, me, queue, waited, held, seated, mySlot, seat, bumped, link, retry: () => { queueRef.current?.leave(); queueRef.current = null; join() },
    canFill: false, join, leave: exit, leaveLobby: leave,
    match, present, builds, clock, role, setRole, chat: visibleChat, sendChat, typing, typers, myTeam, leader, isLeader: leader === me.vid,
    final, game, finish, rematchVotes, voteRematch, exit,
    locks, myCalls, call, lockCalls, emotes, emote,
  }
}
