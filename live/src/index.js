// Build-A-Player live server: Blacktop 3v3 and 2v2 (live/, its own Worker; the site's
// payments API is server/, a different thing).
//
// One referee for the whole game, so every phone sees the same one:
//   Lobby (one, shared)  the six spots, lobby chat; when all six are taken it
//                        makes a match and sends those six to a Room. A practice
//                        room (you + five CPUs) starts at once.
//   Room (one a match)   the build clock, everyone's build progress, the start
//                        (with who didn't finish: they're out, a CPU takes the
//                        spot), the calls for each possession, reactions, chat,
//                        rematch.
// The server never runs the game itself: every phone runs the same engine on
// the same inputs (the builds, the seed, the calls), and the inputs only ever
// come from here, in one order, so the games can't come apart.
//
// Client → server and server → client messages are JSON: { t: type, ...fields }.
//
// The Trait Auction (auction.js) and Compete pools (compete.js) live here too:
// there the server runs the whole thing itself (the auctioneer; the scorer).

import { AuctionQueue, AuctionRoom, validSportPos } from './auction.js'
import { CompeteQueue, CompeteRoom, validCompete } from './compete.js'
import { cleanBuild } from '../../src/lib/blacktopCore.js'
import { handleSubmit } from './submit.js'
import { whoIs } from './auth.js'
import { handleReset } from './reset.js'
export { AuctionQueue, AuctionRoom, CompeteQueue, CompeteRoom }

const BUILD_SECS = 180
const PRACTICE_BUILD_SECS = 600
const CALL_MS = 3200
const CALL_WAIT_MAX = 4500         // the call window opens when everyone's at the check-up, or after this
const SLOTS = [
  { id: '0g0', team: 0, pos: 'guard' }, { id: '0g1', team: 0, pos: 'guard' }, { id: '0b', team: 0, pos: 'big' },
  { id: '1g0', team: 1, pos: 'guard' }, { id: '1g1', team: 1, pos: 'guard' }, { id: '1b', team: 1, pos: 'big' },
]
// 2v2 (its own lobby): a guard and a big a side
const SLOTS_2 = SLOTS.filter(sl => sl.id !== '0g1' && sl.id !== '1g1')
// 1v1 (its own lobby): one spot a side, and you say guard or big as you take it
const SLOTS_1 = [{ id: '0x', team: 0, pos: 'any' }, { id: '1x', team: 1, pos: 'any' }]
const slotsFor = size => (size === 1 ? SLOTS_1 : size === 2 ? SLOTS_2 : SLOTS)
const lobbyName = size => (size === 1 ? 'blacktop1' : size === 2 ? 'blacktop2' : 'blacktop')
const sizeOf = v => (v === 1 || v === 2 ? v : 3)
// the position a spot plays: its own, or (a 1v1 spot) the one asked for
const posFor = (sl, asked) => (sl.pos === 'any' ? (asked === 'big' ? 'big' : 'guard') : sl.pos)
const BOT_NAMES = ['Smoke', 'Shifty', 'Glass', 'Sauce', 'Twitch', 'Hammer', 'Ghost', 'Blitz', 'Cash', 'Lefty', 'Rook', 'Stretch']
const OFF_CALLS = ['drive', 'pullup', 'post', 'pass']
const DEF_CALLS = ['press', 'sag', 'help']
// a 1v1 has nobody to pass to and nobody to help (src/lib/hoops.js offCallsFor/defCallsFor)
const callsFor = (size, offense) => (offense ? OFF_CALLS : DEF_CALLS).filter(c => size > 1 || (c !== 'pass' && c !== 'help'))
const EMOTES = ['🔥', '🧊', '💰', '😤', '👏', '😂']

const ORIGINS = [/^https:\/\/(www\.)?build-a-player\.com$/, /^https:\/\/([a-z0-9-]+\.)?build-a-player\.pages\.dev$/, /^https:\/\/localhost$/, /^https?:\/\/localhost(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/]
const originOk = o => !o || ORIGINS.some(re => re.test(o))

const code6 = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[b % 32]).join('')
const str = (v, n = 40) => (typeof v === 'string' ? v.slice(0, n) : '')
const send = (ws, msg) => { try { ws.send(JSON.stringify(msg)) } catch {} }
const parse = data => { try { const m = JSON.parse(data); return m && typeof m === 'object' ? m : null } catch { return null } }
// who a player is, as everyone sees them (only what's safe to show)
const pub = h => ({ vid: str(h.vid), name: str(h.name, 24) || 'Guest', uid: str(h.uid, 64) || null, cos: h.cos && typeof h.cos === 'object' ? h.cos : null })
// a seat's secret (see queue.js): kept server-side, never sent to anyone
const key = m => str(m?.key, 64) || null
const keyOk = (keys, vid, k) => !keys?.[vid] || keys[vid] === k
const reject = ws => { send(ws, { t: 'taken', why: 'seat' }); try { ws.close(1000, 'seat taken') } catch {} }

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    if (url.pathname === '/health') return new Response('ok')
    // results for the boards, checked before they're saved (submit.js)
    const sub = url.pathname.match(/^\/api\/submit\/([a-z]+)$/)
    if (sub) return handleSubmit(req, env, sub[1])
    // forgot password: the reset link goes to the account's contact email (reset.js)
    if (url.pathname === '/api/reset-request') return handleReset(req, env)
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Build-A-Player live server', { status: 426 })
    if (!originOk(req.headers.get('Origin'))) return new Response('forbidden', { status: 403 })
    if (url.pathname === '/lobby') return env.LOBBY.get(env.LOBBY.idFromName('blacktop')).fetch(req)
    if (url.pathname === '/lobby2') return env.LOBBY.get(env.LOBBY.idFromName('blacktop2')).fetch(req)
    if (url.pathname === '/lobby1') return env.LOBBY.get(env.LOBBY.idFromName('blacktop1')).fetch(req)
    if (url.pathname === '/auction/q') {
      const sport = url.searchParams.get('sport'), pos = url.searchParams.get('pos')
      if (!validSportPos(sport, pos)) return new Response('bad', { status: 400 })
      return env.AUCTION_QUEUE.get(env.AUCTION_QUEUE.idFromName(`${sport}-${pos}`)).fetch(req)
    }
    if (url.pathname === '/compete/q') {
      const sport = url.searchParams.get('sport'), pos = url.searchParams.get('pos')
      if (!validCompete(sport, pos)) return new Response('bad', { status: 400 })
      return env.COMPETE_QUEUE.get(env.COMPETE_QUEUE.idFromName(`${sport}-${pos}`)).fetch(req)
    }
    const cp = url.pathname.match(/^\/compete\/room\/([A-Z0-9]{6})$/)
    if (cp) return env.COMPETE_ROOM.get(env.COMPETE_ROOM.idFromName(cp[1])).fetch(req)
    const au = url.pathname.match(/^\/auction\/room\/([A-Z0-9]{6})$/)
    if (au) return env.AUCTION_ROOM.get(env.AUCTION_ROOM.idFromName(au[1])).fetch(req)
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{6})$/)
    if (m) return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req)
    return new Response('not found', { status: 404 })
  },
}

// ── Lobby ────────────────────────────────────────────────────────────────────
export class Lobby {
  constructor(state, env) {
    this.env = env
    this.conns = new Map()     // ws → player
    this.spots = {}            // slotId → { ...player, at }
    this.held = {}             // slotId → { vid, until } a squad running it back, on its way
    this.size = 3              // 3v3, or 2v2 (the /lobby2 one): set by the first request
  }
  get slots() { return slotsFor(this.size) }
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/lobby2' || url.searchParams.get('size') === '2') this.size = 2
    if (url.pathname === '/lobby1' || url.searchParams.get('size') === '1') this.size = 1
    // a squad running it back: hold a side for them (both guards and the big together)
    if (url.pathname === '/hold' && req.method === 'POST') {
      const { players, keys = {} } = await req.json()
      const now = Date.now()
      for (const [id, h] of Object.entries(this.held)) if (h.until < now) delete this.held[id]
      const free = sl => !this.spots[sl.id] && !this.held[sl.id]
      for (const team of [0, 1]) {
        const side = this.slots.filter(sl => sl.team === team && free(sl))
        const plan = []
        const left = [...side]
        for (const p of players) { const i = left.findIndex(sl => sl.pos === p.pos || sl.pos === 'any'); if (i < 0) break; plan.push([left[i], p]); left.splice(i, 1) }
        if (plan.length === players.length) {
          for (const [sl, p] of plan) this.held[sl.id] = { ...pub(p), key: keys[p.vid] ?? null, pos: p.pos === 'big' ? 'big' : 'guard', until: now + 60000 }
          this.broadcast(this.state())
          return new Response(JSON.stringify({ ok: true }))
        }
      }
      return new Response(JSON.stringify({ ok: false }))
    }
    const [client, server] = Object.values(new WebSocketPair())
    server.accept()
    server.addEventListener('message', e => this.onMessage(server, e.data))
    const bye = () => this.onClose(server)
    server.addEventListener('close', bye); server.addEventListener('error', bye)
    return new Response(null, { status: 101, webSocket: client })
  }
  state() {
    const now = Date.now()
    // a spot held for a squad on its way shows as taken (it's theirs)
    const show = sl => {
      const h = this.spots[sl.id] ?? (this.held[sl.id] && this.held[sl.id].until > now ? this.held[sl.id] : null)
      return h ? { ...pub(h), pos: h.pos ?? sl.pos } : null
    }
    return { t: 'lobby', size: this.size, spots: Object.fromEntries(this.slots.map(sl => [sl.id, show(sl)])), here: [...this.conns.values()].map(pub) }
  }
  broadcast(msg) { for (const ws of this.conns.keys()) send(ws, msg) }
  async onMessage(ws, data) {
    const m = parse(data); if (!m) return
    if (m.t === 'hello') {
      // the name and account come from the player's session, not from what the phone says
      const who = await whoIs(m.token, this.env)
      const p = { ...pub(m), uid: who.uid, name: who.name, key: key(m) }; if (!p.vid) return
      // one connection a player: a reconnect replaces the old one (with the same key only)
      for (const [w, q] of this.conns) if (q.vid === p.vid && w !== ws && q.key && q.key !== p.key) return reject(ws)
      if (Object.values(this.spots).some(s => s.vid === p.vid && s.key && s.key !== p.key)) return reject(ws)
      for (const [w, q] of this.conns) if (q.vid === p.vid && w !== ws) { this.conns.delete(w); try { w.close(1000, 'replaced') } catch {} }
      this.conns.set(ws, p)
      // back from a game with the squad: straight into the spot held for them
      const mine = Object.entries(this.held).find(([, h]) => h.vid === p.vid && h.until > Date.now() && (!h.key || h.key === p.key))
      if (mine) { const h = this.held[mine[0]]; delete this.held[mine[0]]; this.spots[mine[0]] = { ...p, at: Date.now(), pos: h.pos } }
      this.broadcast(this.state())
      if (mine && this.slots.every(sl => this.spots[sl.id])) await this.makeMatch()
      return
    }
    const me = this.conns.get(ws); if (!me) return
    if (m.t === 'seat') {
      const want = this.slots.find(sl => sl.id === m.slot) ? m.slot : null
      const heldFor = want && this.held[want] && this.held[want].until > Date.now() ? this.held[want].vid : null
      if (want && ((this.spots[want] && this.spots[want].vid !== me.vid) || (heldFor && heldFor !== me.vid))) return send(ws, { t: 'bumped' })
      for (const id of Object.keys(this.spots)) if (this.spots[id].vid === me.vid) delete this.spots[id]
      if (want) this.spots[want] = { ...me, at: Date.now(), pos: posFor(this.slots.find(sl => sl.id === want), m.pos) }
      this.broadcast(this.state())
      if (this.slots.every(sl => this.spots[sl.id])) await this.makeMatch()
      return
    }
    if (m.t === 'chat') {
      const text = str(m.text, 120).trim(); if (!text) return
      return this.broadcast({ t: 'chat', from: me.vid, name: me.name, uid: me.uid, cos: me.cos, text, ts: Date.now(), all: true })
    }
    if (m.t === 'typing') return this.broadcast({ t: 'typing', from: me.vid, name: me.name })
    if (m.t === 'practice') {
      // you and CPUs, at once: you take a spot for your position, CPUs the rest
      const pos = m.pos === 'big' ? 'big' : 'guard'
      const code = code6()
      const mine = this.slots.find(sl => (sl.pos === pos || sl.pos === 'any') && sl.team === 0)
      // a test fill (the lobby's TEST button): the CPUs come dressed as players, with
      // the usernames and looks the client made up (still CPUs underneath: they build
      // and call like any CPU, and nothing they do is recorded)
      const mimic = Array.isArray(m.mimic) ? m.mimic.slice(0, 6).map(x => ({
        name: str(x?.name, 20).replace(/[^a-zA-Z0-9_-]/g, '') || null,
        cos: x?.cos && typeof x.cos === 'object' ? Object.fromEntries(['avatar', 'nameColor', 'nameFx', 'plate'].filter(k => typeof x.cos[k] === 'string').map(k => [k, x.cos[k].slice(0, 40)])) : null,
      })) : null
      let b = 0
      const players = this.slots.map((sl, i) => {
        if (sl === mine) return { ...pub(me), pos, team: sl.team, slot: sl.id, bot: false }
        const look = mimic?.[b++]
        return { vid: `bot-${code}-${sl.id}`, name: look?.name || BOT_NAMES[(i * 5) % BOT_NAMES.length], uid: null, cos: look?.cos ?? null, pos: posFor(sl, code.charCodeAt(0) % 2 ? 'big' : 'guard'), team: sl.team, slot: sl.id, bot: true, ...(look?.name ? { mimic: true } : {}) }
      })
      await this.env.ROOM.get(this.env.ROOM.idFromName(code)).fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, players, practice: true, size: this.size, keys: { [me.vid]: me.key ?? null } }) })
      for (const id of Object.keys(this.spots)) if (this.spots[id].vid === me.vid) delete this.spots[id]
      send(ws, { t: 'match', code, players })
      this.broadcast(this.state())
    }
  }
  async makeMatch() {
    const code = code6()
    const players = this.slots.map(sl => ({ ...pub(this.spots[sl.id]), pos: this.spots[sl.id].pos ?? posFor(sl, 'guard'), team: sl.team, slot: sl.id, bot: false }))
    const keys = Object.fromEntries(this.slots.map(sl => [this.spots[sl.id].vid, this.spots[sl.id].key ?? null]))
    await this.env.ROOM.get(this.env.ROOM.idFromName(code)).fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, players, practice: false, size: this.size, keys }) })
    const vids = new Set(players.map(p => p.vid))
    this.spots = {}
    for (const [ws, p] of this.conns) if (vids.has(p.vid)) send(ws, { t: 'match', code, players })
    this.broadcast(this.state())
  }
  onClose(ws) {
    const me = this.conns.get(ws); this.conns.delete(ws)
    if (!me) return
    // still connected somewhere else (a reconnect): keep the spot
    if ([...this.conns.values()].some(p => p.vid === me.vid)) return
    for (const id of Object.keys(this.spots)) if (this.spots[id].vid === me.vid) delete this.spots[id]
    this.broadcast(this.state())
  }
}

// ── Room: one match ──────────────────────────────────────────────────────────
export class Room {
  constructor(state, env) {
    this.env = env
    this.conns = new Map()      // ws → vid
    this.m = null               // { code, players, practice, seed, created, phase, builds, final, locks, ... }
    this.timers = new Set()
  }
  later(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); fn() }, ms); this.timers.add(id); return id }
  clear(id) { if (id) { clearTimeout(id); this.timers.delete(id) } }
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/init' && req.method === 'POST') {
      const b = await req.json()
      this.m = { code: b.code, players: b.players, practice: !!b.practice, size: sizeOf(b.size), seed: b.code, round: 0 }
      this.keys = b.keys || {}
      this.startBuild()
      return new Response('ok')
    }
    const [client, server] = Object.values(new WebSocketPair())
    server.accept()
    server.addEventListener('message', e => this.onMessage(server, e.data))
    const bye = () => this.onClose(server)
    server.addEventListener('close', bye); server.addEventListener('error', bye)
    return new Response(null, { status: 101, webSocket: client })
  }
  broadcast(msg) { for (const ws of this.conns.keys()) send(ws, msg) }
  here() { return [...new Set(this.conns.values())] }
  humans() { return this.m.players.filter(p => !p.bot) }
  snapshot(viewer) {
    const m = this.m
    // while building, the other team's builds show only how far along they are
    const team = m.players.find(p => p.vid === viewer)?.team
    const builds = m.phase !== 'build' ? m.builds : Object.fromEntries(Object.entries(m.builds ?? {}).map(([v, b]) =>
      [v, m.players.find(p => p.vid === v)?.team === team ? b : { build: {}, role: 'balanced', filled: b.filled, done: b.done, player: null }]))
    return {
      t: 'room', now: Date.now(), code: m.code, players: m.players, practice: m.practice, size: m.size, seed: m.seed, created: m.created, ends: m.ends, phase: m.phase,
      here: this.here(), builds, final: m.final, locks: m.locks, votes: [...m.votes],
    }
  }
  startBuild() {
    const m = this.m
    for (const id of this.timers) clearTimeout(id)
    this.timers.clear()
    m.phase = 'build'
    m.created = Date.now()
    m.ends = m.created + (m.practice ? PRACTICE_BUILD_SECS : BUILD_SECS) * 1000
    m.builds = {}              // vid → { build, role, filled, done }
    m.final = null
    m.locks = {}               // pn → { 0: call, 1: call }
    m.calls = {}               // pn → { 0: call, 1: call } as they come in
    m.at = {}                  // pn → { team, vids: Set, first, timer }
    m.votes = new Set()
    m.goneAt = {}
    m.startTimer = this.later(() => this.start(), m.ends - Date.now())
  }
  // the game starts: anyone who didn't finish is out and a CPU takes the spot
  start() {
    const m = this.m
    if (!m || m.phase !== 'build') return
    const here = new Set(this.here())
    // out: didn't finish, or finished but left for good (gone 20s+); a blip with a finished build is fine
    const afk = this.humans().filter(p => !m.builds[p.vid]?.done || (!here.has(p.vid) && Date.now() - (m.goneAt[p.vid] ?? 0) > 20000)).map(p => p.vid)
    m.final = {
      seed: `${m.seed}-f`,
      // the server's own copy of every build: only what each seat's spins dealt, at real ratings
      builds: Object.fromEntries(m.players.map(p => [p.vid, afk.includes(p.vid) || p.bot ? null : cleanBuild(m.builds[p.vid]?.build, p.pos, m.code, p.vid)])),
      roles: Object.fromEntries(m.players.map(p => [p.vid, m.builds[p.vid]?.role ?? 'balanced'])),
      afk,
    }
    m.phase = 'game'
    this.broadcast({ t: 'final', final: m.final })
  }
  maybeStartEarly() {
    const m = this.m
    if (m.phase !== 'build') return
    const here = new Set(this.here())
    const now = Date.now()
    // everyone here is done, and anyone not here has been gone 20s (they're not coming back)
    const ready = this.humans().every(p => (here.has(p.vid) ? m.builds[p.vid]?.done : now - (m.goneAt[p.vid] ?? now) > 20000))
    if (here.size && ready) this.start()
  }
  // a check-up: the window opens when every player still here has reached it (or after a few seconds)
  arrive(pn, team, vid) {
    const m = this.m
    if (m.phase !== 'game' || m.locks[pn] || !Number.isInteger(pn) || pn < 0 || pn > 400) return
    const a = (m.at[pn] ??= { team: team === 1 ? 1 : 0, vids: new Set(), first: Date.now(), timer: null, opened: false })
    a.vids.add(vid)
    if (!a.timer) a.timer = this.later(() => this.lock(pn), CALL_WAIT_MAX + CALL_MS)
    const live = this.humans().filter(p => !m.final.afk.includes(p.vid) && this.here().includes(p.vid))
    if (!a.opened && live.every(p => a.vids.has(p.vid))) {
      a.opened = true
      this.clear(a.timer)
      a.timer = this.later(() => this.lock(pn), CALL_MS + 250)
      this.broadcast({ t: 'open', pn })
    }
  }
  lock(pn) {
    const m = this.m
    if (m.locks[pn]) return
    const a = m.at[pn]
    const c = m.calls[pn] ?? {}
    // a side with nobody to call it (CPUs, or everyone gone) calls something now and then
    for (const t of [0, 1]) {
      if (c[t] != null) continue
      const anyone = this.humans().some(p => p.team === t && !m.final.afk.includes(p.vid) && this.here().includes(p.vid))
      if (!anyone && Math.random() < 0.55) { const opts = callsFor(m.size, (a?.team ?? 0) === t); c[t] = opts[Math.floor(Math.random() * opts.length)] }
    }
    m.locks[pn] = { 0: c[0] ?? null, 1: c[1] ?? null }
    if (a) this.clear(a.timer)
    this.broadcast({ t: 'lock', pn, calls: m.locks[pn] })
  }
  async onMessage(ws, data) {
    const msg = parse(data); if (!msg) return
    // a room the server no longer has (everyone left and it was cleared): over
    if (!this.m) { if (msg.t === 'hello') { send(ws, { t: 'gone' }); try { ws.close(1000, 'no game') } catch {} } return }
    const m = this.m
    if (msg.t === 'hello') {
      const vid = str(msg.vid)
      const me = m.players.find(p => p.vid === vid && !p.bot)
      if (!me) { send(ws, { t: 'gone' }); try { ws.close(1000, 'not in this game') } catch {} return }
      if (!keyOk(this.keys, vid, key(msg))) return reject(ws)
      for (const [w, v] of this.conns) if (v === vid && w !== ws) { this.conns.delete(w); try { w.close(1000, 'replaced') } catch {} }
      this.conns.set(ws, vid)
      delete m.goneAt?.[vid]
      // back after everyone had left (the clocks were stopped): the build clock runs again
      if (m.phase === 'build' && !this.timers.has(m.startTimer)) m.startTimer = this.later(() => this.start(), Math.max(0, m.ends - Date.now()))
      send(ws, this.snapshot(vid))
      return this.broadcast({ t: 'here', here: this.here() })
    }
    const vid = this.conns.get(ws); if (!vid) return
    const me = m.players.find(p => p.vid === vid)
    if (!me) return
    switch (msg.t) {
      case 'build': {
        if (m.phase !== 'build') return
        const b = { build: msg.build && typeof msg.build === 'object' ? msg.build : {}, role: ['balanced', 'score', 'play', 'lock'].includes(msg.role) ? msg.role : 'balanced', filled: Math.max(0, Math.min(12, msg.filled | 0)), done: !!msg.done, player: msg.player ?? null }
        m.builds[vid] = b
        // your team sees your build as you make it; the other team only sees how far along you are
        for (const [w, v] of this.conns) {
          const p = m.players.find(x => x.vid === v)
          send(w, p?.team === me.team ? { t: 'build', from: vid, ...b } : { t: 'build', from: vid, build: {}, role: 'balanced', filled: b.filled, done: b.done, player: null })
        }
        return this.maybeStartEarly()
      }
      case 'at': return this.arrive(msg.pn, msg.team, vid)
      case 'call': {
        if (m.phase !== 'game' || !Number.isInteger(msg.pn) || m.locks[msg.pn] || m.final.afk.includes(vid)) return
        // a play, a defense, or a pass to a named teammate ('pass:<vid>', one on the caller's team)
        const passTo = typeof msg.v === 'string' && msg.v.startsWith('pass:') ? m.players.find(p => p.vid === msg.v.slice(5) && p.team === me.team && p.vid !== vid) : null
        if (!callsFor(m.size, true).includes(msg.v) && !callsFor(m.size, false).includes(msg.v) && !passTo) return
        const c = (m.calls[msg.pn] ??= {})
        if (c[me.team] == null) c[me.team] = msg.v
        return
      }
      case 'emote': if (EMOTES.includes(msg.e)) this.broadcast({ t: 'emote', from: vid, e: msg.e, ts: Date.now() }); return
      case 'chat': {
        const text = str(msg.text, 120).trim(); if (!text) return
        const line = { t: 'chat', from: vid, name: me.name, uid: me.uid, cos: me.cos, team: me.team, text, ts: Date.now(), all: !!msg.all }
        for (const [w, v] of this.conns) { const p = m.players.find(x => x.vid === v); if (line.all || p?.team === me.team) send(w, line) }
        return
      }
      case 'typing': { for (const [w, v] of this.conns) { const p = m.players.find(x => x.vid === v); if (p?.team === me.team && v !== vid) send(w, { t: 'typing', from: vid, name: me.name }) } return }
      case 'done': { if (m.phase === 'game') m.phase = 'result'; return }
      case 'rematch': {
        // running it back is a squad thing: when everyone on my team who's still
        // here has voted, the lobby holds a side for us and we go back together
        if (m.phase === 'build') return
        m.votes.add(vid)
        this.broadcast({ t: 'votes', votes: [...m.votes] })
        const squad = this.humans().filter(p => p.team === me.team && this.here().includes(p.vid))
        if (!squad.length || !squad.every(p => m.votes.has(p.vid))) return
        if (m.practice) { for (const [w, v] of this.conns) if (squad.some(p => p.vid === v)) send(w, { t: 'requeue', practice: true }); return }
        const res = await this.env.LOBBY.get(this.env.LOBBY.idFromName(lobbyName(m.size))).fetch(`https://lobby/hold?size=${m.size}`, { method: 'POST', body: JSON.stringify({ players: squad.map(p => ({ vid: p.vid, name: p.name, uid: p.uid, cos: p.cos, pos: p.pos })), keys: Object.fromEntries(squad.map(p => [p.vid, this.keys[p.vid] ?? null])) }) })
        const ok = (await res.json().catch(() => ({}))).ok
        for (const [w, v] of this.conns) if (squad.some(p => p.vid === v)) send(w, { t: 'requeue', held: !!ok })
        return
      }
    }
  }
  onClose(ws) {
    const vid = this.conns.get(ws); this.conns.delete(ws)
    if (!vid || !this.m) return
    if (this.here().includes(vid)) return
    if (this.m.goneAt) this.m.goneAt[vid] = Date.now()
    this.broadcast({ t: 'here', here: this.here() })
    // 20s on, if they're still gone, the rest may not have to wait for them
    if (this.m.phase === 'build') this.later(() => this.maybeStartEarly(), 20500)
    // the rest are done building: no need to wait on someone who left
    this.maybeStartEarly()
    // nobody left at all: stop the clocks
    if (!this.conns.size) { for (const id of this.timers) clearTimeout(id); this.timers.clear() }
  }
}
