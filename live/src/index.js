// Build-A-Player live server: Blacktop 3v3 (live/, its own Worker; the site's
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

const BUILD_SECS = 180
const PRACTICE_BUILD_SECS = 600
const CALL_MS = 2200
const CALL_WAIT_MAX = 4500         // the call window opens when everyone's at the check-up, or after this
const SLOTS = [
  { id: '0g0', team: 0, pos: 'guard' }, { id: '0g1', team: 0, pos: 'guard' }, { id: '0b', team: 0, pos: 'big' },
  { id: '1g0', team: 1, pos: 'guard' }, { id: '1g1', team: 1, pos: 'guard' }, { id: '1b', team: 1, pos: 'big' },
]
const BOT_NAMES = ['Smoke', 'Shifty', 'Glass', 'Sauce', 'Twitch', 'Hammer', 'Ghost', 'Blitz', 'Cash', 'Lefty', 'Rook', 'Stretch']
const OFF_CALLS = ['drive', 'pullup', 'post', 'pass']
const DEF_CALLS = ['press', 'sag', 'help']
const EMOTES = ['🔥', '🧊', '💰', '😤', '👏', '😂']

const ORIGINS = [/^https:\/\/(www\.)?build-a-player\.com$/, /^https:\/\/[a-z0-9-]+\.build-a-player\.pages\.dev$/, /^https?:\/\/localhost(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/]
const originOk = o => !o || ORIGINS.some(re => re.test(o))

const code6 = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[b % 32]).join('')
const str = (v, n = 40) => (typeof v === 'string' ? v.slice(0, n) : '')
const send = (ws, msg) => { try { ws.send(JSON.stringify(msg)) } catch {} }
const parse = data => { try { const m = JSON.parse(data); return m && typeof m === 'object' ? m : null } catch { return null } }
// who a player is, as everyone sees them (only what's safe to show)
const pub = h => ({ vid: str(h.vid), name: str(h.name, 24) || 'Guest', uid: str(h.uid, 64) || null, cos: h.cos && typeof h.cos === 'object' ? h.cos : null })

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    if (url.pathname === '/health') return new Response('ok')
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Build-A-Player live server', { status: 426 })
    if (!originOk(req.headers.get('Origin'))) return new Response('forbidden', { status: 403 })
    if (url.pathname === '/lobby') return env.LOBBY.get(env.LOBBY.idFromName('blacktop')).fetch(req)
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
  }
  async fetch(req) {
    const [client, server] = Object.values(new WebSocketPair())
    server.accept()
    server.addEventListener('message', e => this.onMessage(server, e.data))
    const bye = () => this.onClose(server)
    server.addEventListener('close', bye); server.addEventListener('error', bye)
    return new Response(null, { status: 101, webSocket: client })
  }
  state() {
    return { t: 'lobby', spots: Object.fromEntries(SLOTS.map(sl => [sl.id, this.spots[sl.id] ? pub(this.spots[sl.id]) : null])), here: [...this.conns.values()].map(pub) }
  }
  broadcast(msg) { for (const ws of this.conns.keys()) send(ws, msg) }
  async onMessage(ws, data) {
    const m = parse(data); if (!m) return
    if (m.t === 'hello') {
      const p = pub(m); if (!p.vid) return
      // one connection a player: a reconnect replaces the old one
      for (const [w, q] of this.conns) if (q.vid === p.vid && w !== ws) { this.conns.delete(w); try { w.close(1000, 'replaced') } catch {} }
      this.conns.set(ws, p)
      return this.broadcast(this.state())
    }
    const me = this.conns.get(ws); if (!me) return
    if (m.t === 'seat') {
      const want = SLOTS.find(sl => sl.id === m.slot) ? m.slot : null
      if (want && this.spots[want] && this.spots[want].vid !== me.vid) return send(ws, { t: 'bumped' })
      for (const id of Object.keys(this.spots)) if (this.spots[id].vid === me.vid) delete this.spots[id]
      if (want) this.spots[want] = { ...me, at: Date.now() }
      this.broadcast(this.state())
      if (SLOTS.every(sl => this.spots[sl.id])) await this.makeMatch()
      return
    }
    if (m.t === 'chat') {
      const text = str(m.text, 120).trim(); if (!text) return
      return this.broadcast({ t: 'chat', from: me.vid, name: me.name, uid: me.uid, cos: me.cos, text, ts: Date.now(), all: true })
    }
    if (m.t === 'typing') return this.broadcast({ t: 'typing', from: me.vid, name: me.name })
    if (m.t === 'practice') {
      // you and five CPUs, at once: you take a spot for your position, CPUs the rest
      const pos = m.pos === 'big' ? 'big' : 'guard'
      const code = code6()
      const mine = SLOTS.find(sl => sl.pos === pos && sl.team === 0)
      const players = SLOTS.map((sl, i) => (sl === mine
        ? { ...me, pos: sl.pos, team: sl.team, slot: sl.id, bot: false }
        : { vid: `bot-${code}-${sl.id}`, name: BOT_NAMES[(i * 5) % BOT_NAMES.length], uid: null, cos: null, pos: sl.pos, team: sl.team, slot: sl.id, bot: true }))
      await this.env.ROOM.get(this.env.ROOM.idFromName(code)).fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, players, practice: true }) })
      for (const id of Object.keys(this.spots)) if (this.spots[id].vid === me.vid) delete this.spots[id]
      send(ws, { t: 'match', code, players })
      this.broadcast(this.state())
    }
  }
  async makeMatch() {
    const code = code6()
    const players = SLOTS.map(sl => ({ ...pub(this.spots[sl.id]), pos: sl.pos, team: sl.team, slot: sl.id, bot: false }))
    await this.env.ROOM.get(this.env.ROOM.idFromName(code)).fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, players, practice: false }) })
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
      this.m = { code: b.code, players: b.players, practice: !!b.practice, seed: b.code, round: 0 }
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
  snapshot() {
    const m = this.m
    return {
      t: 'room', now: Date.now(), code: m.code, players: m.players, practice: m.practice, seed: m.seed, created: m.created, ends: m.ends, phase: m.phase,
      here: this.here(), builds: m.builds, final: m.final, locks: m.locks, votes: [...m.votes],
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
      builds: Object.fromEntries(m.players.map(p => [p.vid, afk.includes(p.vid) ? null : m.builds[p.vid]?.build ?? null])),
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
      if (!anyone && Math.random() < 0.55) { const opts = (a?.team ?? 0) === t ? OFF_CALLS : DEF_CALLS; c[t] = opts[Math.floor(Math.random() * opts.length)] }
    }
    m.locks[pn] = { 0: c[0] ?? null, 1: c[1] ?? null }
    if (a) this.clear(a.timer)
    this.broadcast({ t: 'lock', pn, calls: m.locks[pn] })
  }
  onMessage(ws, data) {
    const msg = parse(data); if (!msg) return
    // a room the server no longer has (everyone left and it was cleared): over
    if (!this.m) { if (msg.t === 'hello') { send(ws, { t: 'gone' }); try { ws.close(1000, 'no game') } catch {} } return }
    const m = this.m
    if (msg.t === 'hello') {
      const vid = str(msg.vid)
      const me = m.players.find(p => p.vid === vid && !p.bot)
      if (!me) { send(ws, { t: 'gone' }); try { ws.close(1000, 'not in this game') } catch {} return }
      for (const [w, v] of this.conns) if (v === vid && w !== ws) { this.conns.delete(w); try { w.close(1000, 'replaced') } catch {} }
      this.conns.set(ws, vid)
      delete m.goneAt?.[vid]
      // back after everyone had left (the clocks were stopped): the build clock runs again
      if (m.phase === 'build' && !this.timers.has(m.startTimer)) m.startTimer = this.later(() => this.start(), Math.max(0, m.ends - Date.now()))
      send(ws, this.snapshot())
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
        this.broadcast({ t: 'build', from: vid, ...b })
        return this.maybeStartEarly()
      }
      case 'at': return this.arrive(msg.pn, msg.team, vid)
      case 'call': {
        if (m.phase !== 'game' || !Number.isInteger(msg.pn) || m.locks[msg.pn] || m.final.afk.includes(vid)) return
        if (!OFF_CALLS.includes(msg.v) && !DEF_CALLS.includes(msg.v)) return
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
        if (m.phase === 'build') return
        m.votes.add(vid)
        this.broadcast({ t: 'votes', votes: [...m.votes] })
        const live = this.humans().filter(p => this.here().includes(p.vid))
        if (live.length && live.every(p => m.votes.has(p.vid))) {
          m.round++; m.seed = `${m.code}r${m.round}`
          // the ones who left are CPUs from here on
          const here = new Set(this.here())
          m.players = m.players.map(p => (p.bot || here.has(p.vid) ? p : { ...p, bot: true, vid: `bot-${m.code}-${p.slot}-${m.round}`, name: BOT_NAMES[(m.round * 3 + SLOTS.findIndex(s => s.id === p.slot)) % BOT_NAMES.length], uid: null, cos: null }))
          this.startBuild()
          this.broadcast(this.snapshot())
        }
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
