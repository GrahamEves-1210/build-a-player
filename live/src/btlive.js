// BLACKTOP LIVE online: one room per
// game, and the room is the referee. Every device sends its stick, its buttons, the dribble moves its small stick
// flicked (and which way), where it has its own player and, for a shot, the release quality its own meter timed; the room runs the one simulation (src/lib/btlive, the same code the
// practice screen runs on a phone) at 30 ticks a second with those inputs and sends everyone the state about 15 times
// a second. Every discrete thing (a make, a block, a steal, a pick, a board, the score, the shot clock) is decided
// here with the game's seeded rolls, so nobody's phone decides its own makes. A seat whose device goes quiet is played
// by the CPU until it comes back. The wire is src/lib/btlive/proto.js. Today's Blacktop rooms (index.js Room) are
// not touched.
//
// Two kinds of room. KING OF THE HILL online (since 2026-11-26): the queue (koth.js) makes the room with its three
// seats (who, his seat key, the real player he picked); only those three can say hello, each with his own key, and
// every build is read here from the rosters. It starts when all three are in (or after SHOW_MS without the missing
// one: the CPU plays his seat), and the result is booked here when it's over (book). A DEV room (a ?btserver link):
// what's below, and only for a page on this machine.
//
// The games (src/lib/btlive/modes.js): 1v1 (2 seats), 2v2 (4 seats: four people, each on his own man for the whole
// game) and King of the Hill (3 seats, every man for himself). The first one in sets the game; it starts when every
// seat has a person in it, or at once with CPUs in the empty seats when someone asks (practice: start). A rematch
// (again) keeps every seat as it is (the same people, the same CPUs with the same builds) with a new seed, and starts
// when every person still in has asked for it.
//
//   wss://…/btlive/room/<CODE>   (index.js routes it here)
import { createGame, step, cpuInput, kothLeave, HZ, GUARD_KEYS, BIG_KEYS, MODES, modeKey } from '../../src/lib/btlive/index.js'
import { seatNew, seatMsg, seatInput, snapOf, snapOf2, snapRows, SEND_EVERY, EVENT_KEEP, AWAY_MS, WIRE, SNAP_KEEP } from '../../src/lib/btlive/proto.js'
import { NBA_GUARD_PLAYERS } from '../../src/data/nba-guards.js'
import { NBA_BIG_PLAYERS } from '../../src/data/nba-bigs.js'
import { blacktopDelta } from '../../src/lib/rating.js'
import { bookRatings, bookVs } from './rating.js'
import { key, keyOk, reject } from './queue.js'

const STEP_MS = 1000 / HZ
const CPU_LEVEL = 'pro'
// a room the queue made (King of the Hill online, koth.js): how long the room waits for a seat's device to show up
// before the game starts without him (the CPU plays his seat, and it's a forfeit for him); and how long a man can be
// away in all (his line quiet, the CPU on his seat) before the game counts as one he left
const SHOW_MS = 20000
const AWAY_FORFEIT_TICKS = 20 * HZ
// a room nobody made (a dev link: ?btserver=…&btroom=…) only opens for a page on this machine
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
const str = (v, n = 40) => (typeof v === 'string' ? v.slice(0, n) : '')
const send = (ws, m) => { try { ws.send(JSON.stringify(m)) } catch {} }
const parse = d => { try { const m = JSON.parse(d); return m && typeof m === 'object' ? m : null } catch { return null } }
// a build as grades only, every one 0-11 (a device can't send a 20)
function cleanBuild(b, pos) {
  const out = {}
  for (const k of pos === 'big' ? BIG_KEYS : GUARD_KEYS) { const v = b?.[k]; const n = typeof v === 'number' ? v : v?.val; out[k] = { val: Number.isFinite(+n) ? Math.min(11, Math.max(0, +n)) : 5 } }
  return out
}
// a real player's build, from the rosters (King of the Hill online: the pick names him, the ratings are his own)
function realBuild(pick) {
  const pos = pick?.pos === 'big' ? 'big' : 'guard'
  const p = (pos === 'big' ? NBA_BIG_PLAYERS : NBA_GUARD_PLAYERS).find(x => x.name === pick?.name)
  if (!p) return null
  const build = Object.fromEntries((pos === 'big' ? BIG_KEYS : GUARD_KEYS).map(k => [k, { val: Math.min(11, Math.max(0, p.attrs?.[k] ?? 5)) }]))
  // (the photo is the device's to find, by the player's name: lib's headshots, never a link from a phone)
  return { pos, build, look: { photo: null, faceCenter: p.faceCenter ?? null, skin: p.skin ?? null, num: p.number != null ? String(p.number) : null, player: p.name } }
}
// (skin: his skin tone, num: his jersey number: what the screen draws his man with)
const cleanLook = l => ({ photo: /^(https:\/\/|\/)[\w\-./%?=&:]{1,300}$/.test(l?.photo ?? '') ? l.photo : null, faceCenter: Array.isArray(l?.faceCenter) ? l.faceCenter.slice(0, 2).map(v => Math.min(100, Math.max(0, +v || 50))) : null,
  skin: /^#[0-9a-f]{6}$/i.test(l?.skin ?? '') ? l.skin : null, num: /^\d{1,2}$/.test(String(l?.num ?? '')) ? String(l.num) : null })

export class BtLiveRoom {
  constructor(state, env) {
    this.env = env; this.state = state
    this.conns = new Map()        // ws -> vid
    this.made = null              // a room the queue made (koth.js): { code, mode, players, keys }; null: a dev room
    this.booked = null            // the seed of the last game booked (once a game)
    // (the queue's setup is kept, in case the room is put to sleep between the queue's call and the first hello)
    state?.blockConcurrencyWhile(async () => { const m = await state.storage.get('made'); if (m) this.setUp(m) })
    this.mode = null              // '1v1' | '2v2' | 'koth' (the first hello sets it)
    this.need = 2                 // people before it starts on its own (every seat, unless a dev link says fewer)
    this.seats = []               // { vid, name, pos, team, slot, build, look, cpu, seat (proto), ws }, in the game's order
    this.g = null                 // the game (sim state)
    this.votes = new Set()        // who has asked for a rematch (vids)
    this.loop = 0; this.t0 = 0; this.done = 0
    this.log = []; this.evq = 0   // what happened, numbered, for the snapshots
  }
  // the queue's three: their seats, in the order they came in, each with the real player he picked
  setUp(b) {
    if (this.made) return
    this.made = b
    this.mode = modeKey(b.mode, 'koth')
    this.keys = b.keys || {}
    const M = MODES[this.mode]
    this.need = M.seats
    this.seats = []
    b.players.slice(0, M.seats).forEach((p, i) => {
      const r = realBuild(p.pick) ?? realBuild({ name: 'Stephen Curry', pos: 'guard' })
      this.seats.push({ vid: str(p.vid, 64), uid: p.uid ?? null, name: str(p.name, 24) || 'Guest', pos: r.pos, team: i % M.teams, slot: Math.floor(i / M.teams), build: r.build, look: r.look, cpu: null, seat: seatNew(), ws: null, awayT: 0 })
    })
    // nobody's device shows in time: the game goes on without him
    // (one man alone is no game: he goes back to the queue, and nothing is booked)
    this.showTimer = setTimeout(() => {
      if (this.g) return
      const here = this.seats.filter(x => x.ws)
      if (here.length >= 2) return this.begin()
      for (const x of here) send(x.ws, { t: 'requeue' })
    }, Math.max(1000, (b.at ?? Date.now()) + SHOW_MS - Date.now()))
  }
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/init' && req.method === 'POST') {
      const b = await req.json().catch(() => null)
      if (!b || !Array.isArray(b.players)) return new Response('bad', { status: 400 })
      const made = { code: str(b.code, 8), mode: b.mode, players: b.players, keys: b.keys || {}, at: Date.now() }
      await this.state.storage.put('made', made)
      this.setUp(made)
      return new Response('ok')
    }
    const local = LOCAL.test(req.headers.get('Origin') || '')
    const [client, server] = Object.values(new WebSocketPair())
    server.accept()
    server.local = local
    server.addEventListener('message', e => this.onMessage(server, e.data))
    const bye = () => this.onClose(server)
    server.addEventListener('close', bye); server.addEventListener('error', bye)
    return new Response(null, { status: 101, webSocket: client })
  }
  onClose(ws) {
    try { ws.close(1000, 'bye') } catch {}            // finish the close (else the device's socket hangs in CLOSING)
    const vid = this.conns.get(ws)
    this.conns.delete(ws)
    const st = this.seats.find(x => x.vid === vid)
    if (st && st.ws === ws) st.ws = null
    // nobody left: stop the clock (a room with no one in it costs nothing). A queue's game everyone walked out of
    // is over for all of them: each one left it
    if (!this.conns.size) { this.stop(); if (this.made && this.g && this.g.phase !== 'over') this.book(true) }
    else this.rematchCheck()
  }
  stop() { if (this.loop) { clearInterval(this.loop); this.loop = 0 } }
  setupFor(i) {
    const M = MODES[this.mode]
    return { t: 'seat', i, size: M.perTeam, mode: this.mode, seed: this.seed, seats: this.seats.map(x => ({ name: x.name, pos: x.pos, team: x.team, cpu: !x.vid, look: x.look, build: x.build })) }
  }
  onMessage(ws, data) {
    const m = parse(data); if (!m) return
    const now = Date.now()
    if (m.t === 'hello') return this.hello(ws, m)
    const vid = this.conns.get(ws); if (!vid) return
    const st = this.seats.find(x => x.vid === vid)
    if (m.t === 'ping') return send(ws, { t: 'pong', c: m.c, k: this.g?.tick ?? 0 })
    if (m.t === 'in' && st) { seatMsg(st.seat, m, now); return }
    if (m.t === 'start' && !this.made && !this.g && this.seats.some(x => x.vid)) return this.begin()
    // a queue's game: he quit (QUIT on his device): out of it at once, the other two play on
    if (m.t === 'quit' && st && this.made && this.g && this.g.phase !== 'over') {
      this.leave(this.seats.indexOf(st))
      if (this.g.phase === 'over') { this.broadcast(); this.stop(); this.book() } else this.broadcast()
      return
    }
    if (m.t === 'again' && st && this.g?.phase === 'over') {
      // a queue's game runs it back only with all three still here; short a man, back to the queue
      if (this.made && this.seats.some(x => !x.ws)) return send(ws, { t: 'requeue' })
      this.votes.add(vid); this.rematchCheck()
    }
  }
  // a rematch: when every person still in (a live line) has asked for it
  rematchCheck() {
    if (this.g?.phase !== 'over' || !this.votes.size) return
    const inRoom = this.seats.filter(x => x.vid && x.ws)
    // (a queue's game: someone has gone since the asks began, so the ones who asked go back to the queue)
    if (this.made && inRoom.length < this.seats.length) { for (const x of inRoom) if (this.votes.has(x.vid)) send(x.ws, { t: 'requeue' }); this.votes.clear(); return }
    const have = inRoom.filter(x => this.votes.has(x.vid)).length
    if (have >= inRoom.length) return this.begin()
    for (const x of inRoom) send(x.ws, { t: 'again', have, need: inRoom.length })
  }
  hello(ws, m) {
    const vid = str(m.vid, 64); if (!vid) return
    ws.wire = m.v === WIRE ? WIRE : 1               // (wire 2: a snapshot every tick, each his own: broadcast)
    if (this.made) {
      // a queue's room: only its three, each with the key he queued with; his build, name and look are already here
      const st = this.seats.find(x => x.vid === vid)
      if (!st) { send(ws, { t: 'gone', why: 'full' }); return }
      if (!keyOk(this.keys, vid, key(m))) return reject(ws)
    } else if (ws.local === false) { send(ws, { t: 'gone', why: 'none' }); return }   // (fetch marks every socket; a headless check's own sockets are let in)
    for (const [w, v] of this.conns) if (v === vid && w !== ws) { this.conns.delete(w); try { w.close(1000, 'replaced') } catch {} }
    this.conns.set(ws, vid)
    let st = this.seats.find(x => x.vid === vid)
    if (!st) {
      if (this.g) { send(ws, { t: 'gone', why: 'started' }); return }
      if (!this.mode) {
        // (an old device that sends a size: 1 or 2; 3 was 3v3, gone: 1v1)
        this.mode = modeKey(m.mode ?? m.size)
        const M = MODES[this.mode]
        for (let t = 0; t < M.teams; t++) for (let slot = 0; slot < M.perTeam; slot++) this.seats.push({ vid: null, name: '', pos: null, team: t, slot, build: null, look: null, cpu: null, seat: seatNew(), ws: null })
        this.need = m.humans ? Math.min(M.seats, Math.max(1, m.humans | 0)) : M.seats
      }
      // a person plays his own build at his own position; the teams fill in turn (the second one in is on the other
      // side, the third back on the first), King of the Hill seat by seat
      const pos = m.pos === 'big' ? 'big' : 'guard'
      const open = this.seats.filter(x => !x.vid)
      const humans = this.seats.length - open.length
      const want = MODES[this.mode].teams === 2 ? humans % 2 : -1
      st = open.find(x => x.team === want) ?? open[0]
      if (!st) { send(ws, { t: 'gone', why: 'full' }); return }
      Object.assign(st, { vid, name: str(m.name, 24) || 'Guest', pos, build: cleanBuild(m.build, pos), look: cleanLook(m.look) })
      // the first one in brings the CPUs for the empty seats (a practice pick; on the real lobby the server picks)
      if (Array.isArray(m.cpus) && !this.cpus) this.cpus = m.cpus.slice(0, 6).map(c => ({ name: str(c.name, 24) || 'CPU', pos: c.pos === 'big' ? 'big' : 'guard', build: c.build, look: cleanLook(c.look) }))
    }
    st.ws = ws; st.seat.heard = Date.now()
    if (!this.g) {
      // (a queue's room has its three seats named from the start: who's in is whose device is here)
      const have = this.seats.filter(x => (this.made ? x.ws : x.vid)).length
      for (const [w] of this.conns) send(w, { t: 'wait', need: this.need, have, mode: this.mode })
      if (have >= this.need) this.begin()
      return
    }
    send(ws, this.setupFor(this.seats.indexOf(st)))
    send(ws, snapOf(this.g, this.log, this.acks()))
    if (this.g.phase !== 'over' && !this.loop) this.run()
  }
  // the CPUs for the empty seats, once (a rematch keeps them): the ones the first device brought, else a plain build.
  // In 2v2 a CPU plays the other position from his teammate's; one on one (and King of the Hill) the first person's
  fillCpus() {
    const pool = [...(this.cpus ?? [])]
    const first = this.seats.find(x => x.vid)?.pos ?? 'guard'
    for (const x of this.seats) {
      if (x.vid || x.cpu) continue
      const mate = this.seats.find(o => o !== x && o.team === x.team && o.pos)
      const pos = MODES[this.mode].perTeam > 1 ? (mate ? (mate.pos === 'big' ? 'guard' : 'big') : x.slot ? 'big' : 'guard') : first
      const i = pool.findIndex(c => c.pos === pos)
      const c = i >= 0 ? pool.splice(i, 1)[0] : { name: 'CPU', pos, build: null, look: null }
      Object.assign(x, { name: c.name, pos, look: c.look ?? { photo: null, faceCenter: null, skin: null, num: null }, build: cleanBuild(c.build, pos), cpu: true })
    }
  }
  begin() {
    this.fillCpus()
    this.seed = `btl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    // the seats in the order the game numbers its players (team 0 first)
    this.seats.sort((a, b) => a.team - b.team || a.slot - b.slot)
    const M = MODES[this.mode]
    const teams = [...Array(M.teams).keys()].map(t => this.seats.filter(x => x.team === t).map(x => ({ id: `t${t}p${x.slot}`, name: x.name, pos: x.pos, build: x.build })))
    this.g = createGame({ teams, seed: this.seed, mode: this.mode })
    this.log = []; this.evq = 0; this.votes.clear()
    for (const x of this.seats) { x.seat = { ...seatNew(), heard: x.seat.heard }; x.awayT = 0 }
    // a queue's game that starts a man short (his device never came): he's out of it from the tip (sim.js kothLeave)
    if (this.made) this.seats.forEach((x, i) => { if (!x.ws) this.leave(i) })
    clearTimeout(this.showTimer)
    this.seats.forEach((x, i) => x.ws && send(x.ws, this.setupFor(i)))
    this.run()
  }
  acks() { return this.seats.map(x => x.seat.relDone) }
  // King of the Hill online: man i is out of the game for good (sim.js kothLeave: he can't win it, the other two play
  // on). log: put what it did in the snapshots' events now (a quit between ticks; a tick logs its own)
  leave(i, log = true) {
    const g = this.g
    if (!g || g.mode !== 'koth' || g.gone?.[i]) return
    const n = g.events.length
    if (!kothLeave(g, i)) return
    if (log) for (const e of g.events.slice(n)) this.log.push({ ...e, sq: ++this.evq, k: g.tick })
  }
  run() {
    this.stop()
    this.t0 = Date.now() - (this.g.tick * STEP_MS)
    this.loop = setInterval(() => this.frame(), STEP_MS)
  }
  // one tick: every seat's input (a person's own, or the CPU while his line is quiet or the seat has nobody in it)
  tickOnce(now = Date.now()) {
    const g = this.g
    const inputs = this.seats.map((x, i) => {
      if (x.vid && now - x.seat.heard < AWAY_MS) return seatInput(x.seat, g, i)
      if (x.vid) x.awayT = (x.awayT ?? 0) + 1
      return cpuInput(g, i, CPU_LEVEL)
    })
    step(g, inputs)
    // a queue's game: a man whose line has been gone 20 s in all has left it (the other two play it out)
    if (this.made) this.seats.forEach((x, i) => { if (x.vid && (x.awayT ?? 0) > AWAY_FORFEIT_TICKS) this.leave(i, false) })
    for (const e of g.events) this.log.push({ ...e, sq: ++this.evq, k: g.tick })
    this.broadcast(g.tick % SEND_EVERY === 0 || g.phase === 'over')
    return inputs
  }
  frame() {
    const g = this.g
    if (!g) return this.stop()
    // the ticks due by the clock (a late timer catches up, at most a few at once)
    let due = Math.min(4, Math.floor((Date.now() - this.t0) / STEP_MS) - g.tick)
    const now = Date.now()
    while (due-- > 0 && g.phase !== 'over') this.tickOnce(now)
    while (this.log.length && this.log[0].k < g.tick - EVENT_KEEP) this.log.shift()
    if (g.phase === 'over') { this.broadcast(); this.stop(); if (this.made) this.book() }
  }
  // A queue's game is over (or everyone walked out of it): each man's rating (src/lib/rating.js, as in the lobbies:
  // the winner +20, the other one still in -12, a man who left -20) and the King of the Hill record (vs_results 'koth'),
  // once a game. A man who left (QUIT, his line away 20 s in all, or gone at the end) takes the forfeit, and since
  // kothLeave takes him out of it, his seat can never be the one that wins. The ones on an account
  // are told their new rating.
  async book(walked = false) {
    const g = this.g
    if (!g || this.booked === this.seed) return
    this.booked = this.seed
    const people = this.seats.map((x, i) => ({ x, i })).filter(({ x }) => x.uid)
    // (out: he left it, sim.js s.gone, so he could never win it; or his line was gone at the end)
    const out = ({ x, i }) => walked || !!g.gone?.[i] || !x.ws
    const won = ({ i }) => !walked && g.phase === 'over' && g.winner === i
    const ratings = await bookRatings(this.env, people.map(p => ({ vid: p.x.vid, uid: p.x.uid, delta: blacktopDelta({ won: won(p), forfeit: out(p) }) })))
    await bookVs(this.env, people.map(p => ({ uid: p.x.uid, result: out(p) ? 'forfeit' : won(p) ? 'win' : 'loss', position: p.x.pos, match_type: this.mode })))
    if (Object.keys(ratings).length) for (const [w] of this.conns) send(w, { t: 'rated', ratings })
  }
  // ── the snapshots (proto.js): wire 2 every tick, each device's own (written against the newest one his device has
  // said it has); wire 1 (an old app) every SEND_EVERY ticks, one for all (old: this tick is one of those)
  broadcast(old = true) {
    const g = this.g, acks = this.acks()
    if (this.histSeed !== this.seed) { this.hist = new Map(); this.histSeed = this.seed }
    let cur = this.hist.get(g.tick), one = null
    for (const [w, vid] of this.conns) {
      if (w.wire === WIRE) {
        // (a tick's rows are kept as first sent: a device that has that tick has those)
        if (!cur) {
          cur = snapRows(g, this.evq); this.hist.set(g.tick, cur)
          for (const k of this.hist.keys()) if (k < g.tick - SNAP_KEEP || k > g.tick) this.hist.delete(k)
        }
        const st = this.seats.find(x => x.vid === vid)
        const base = st && st.seat.sk >= 0 ? this.hist.get(st.seat.sk) ?? null : null
        try { w.send(JSON.stringify(snapOf2(g, cur, base, this.log, acks))) } catch {}
      } else if (old) { one ??= JSON.stringify(snapOf(g, this.log, acks)); try { w.send(one) } catch {} }
    }
  }
}
