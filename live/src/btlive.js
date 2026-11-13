// BLACKTOP LIVE online (a prototype: nothing in the app reaches it yet; tested only under `wrangler dev`): one room per
// game, and the room is the referee. Every device sends its stick, its buttons, where it has its own player and, for a
// shot, the release quality its own meter timed; the room runs the one simulation (src/lib/btlive, the same code the
// practice screen runs on a phone) at 30 ticks a second with those inputs and sends everyone the state about 15 times
// a second. Every discrete thing (a make, a block, a steal, a pick, a board, the score, the shot clock) is decided
// here with the game's seeded rolls, so nobody's phone decides its own makes. A seat whose device goes quiet is played
// by the CPU until it comes back. The wire is src/lib/btlive/proto.js. Today's Blacktop rooms (index.js Room) are
// not touched.
//
//   ws://127.0.0.1:8787/btlive/room/<CODE>   (btlive-dev.js routes it here under wrangler dev; index.js does not yet)
import { createGame, step, cpuInput, HZ, GUARD_KEYS, BIG_KEYS } from '../../src/lib/btlive/index.js'
import { seatNew, seatMsg, seatInput, snapOf, SEND_EVERY, EVENT_KEEP, AWAY_MS } from '../../src/lib/btlive/proto.js'

const STEP_MS = 1000 / HZ
const CPU_LEVEL = 'pro'
const LAYOUT = { 1: ['any'], 2: ['guard', 'big'], 3: ['guard', 'guard', 'big'] }
const str = (v, n = 40) => (typeof v === 'string' ? v.slice(0, n) : '')
const send = (ws, m) => { try { ws.send(JSON.stringify(m)) } catch {} }
const parse = d => { try { const m = JSON.parse(d); return m && typeof m === 'object' ? m : null } catch { return null } }
// a build as grades only, every one 0-11 (a device can't send a 20)
function cleanBuild(b, pos) {
  const out = {}
  for (const k of pos === 'big' ? BIG_KEYS : GUARD_KEYS) { const v = b?.[k]; const n = typeof v === 'number' ? v : v?.val; out[k] = { val: Number.isFinite(+n) ? Math.min(11, Math.max(0, +n)) : 5 } }
  return out
}
const cleanLook = l => ({ photo: /^(https:\/\/|\/)[\w\-./%?=&:]{1,300}$/.test(l?.photo ?? '') ? l.photo : null, faceCenter: Array.isArray(l?.faceCenter) ? l.faceCenter.slice(0, 2).map(v => Math.min(100, Math.max(0, +v || 50))) : null })

export class BtLiveRoom {
  constructor(state, env) {
    this.env = env
    this.conns = new Map()        // ws -> vid
    this.size = 0                 // 1, 2, 3 (the first hello sets it)
    this.need = 2                 // people before it starts on its own
    this.seats = []               // { vid, name, pos, team, slot, build, look, cpu, seat (proto), ws }
    this.g = null                 // the game (sim state)
    this.loop = 0; this.t0 = 0; this.done = 0
    this.log = []; this.evq = 0   // what happened, numbered, for the snapshots
  }
  async fetch(req) {
    const [client, server] = Object.values(new WebSocketPair())
    server.accept()
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
    // nobody left: stop the clock (a room with no one in it costs nothing)
    if (!this.conns.size) this.stop()
  }
  stop() { if (this.loop) { clearInterval(this.loop); this.loop = 0 } }
  setupFor(i) {
    return { t: 'seat', i, size: this.size, seed: this.seed, seats: this.seats.map(x => ({ name: x.name, pos: x.pos, team: x.team, cpu: !x.vid, look: x.look, build: x.build })) }
  }
  onMessage(ws, data) {
    const m = parse(data); if (!m) return
    const now = Date.now()
    if (m.t === 'hello') return this.hello(ws, m)
    const vid = this.conns.get(ws); if (!vid) return
    const st = this.seats.find(x => x.vid === vid)
    if (m.t === 'ping') return send(ws, { t: 'pong', c: m.c, k: this.g?.tick ?? 0 })
    if (m.t === 'in' && st) { seatMsg(st.seat, m, now); return }
    if (m.t === 'start' && !this.g && this.seats.some(x => x.vid)) return this.begin()
    if (m.t === 'again' && this.g?.phase === 'over') return this.begin()
  }
  hello(ws, m) {
    const vid = str(m.vid, 64); if (!vid) return
    for (const [w, v] of this.conns) if (v === vid && w !== ws) { this.conns.delete(w); try { w.close(1000, 'replaced') } catch {} }
    this.conns.set(ws, vid)
    let st = this.seats.find(x => x.vid === vid)
    if (!st) {
      if (!this.size) { this.size = [1, 2, 3].includes(m.size) ? m.size : 1; this.need = Math.min(this.size * 2, Math.max(1, m.humans | 0 || 2)) }
      if (this.g) { send(ws, { t: 'gone', why: 'started' }); return }
      const pos = m.pos === 'big' ? 'big' : 'guard'
      // the seats: team by team in the size's layout; a person takes the first open seat for his position, the
      // teams filled in turn (the second person is on the other side)
      if (!this.seats.length) for (let t = 0; t < 2; t++) LAYOUT[this.size].forEach((p, slot) => this.seats.push({ vid: null, name: '', pos: p, team: t, slot, build: null, look: null, seat: seatNew(), ws: null }))
      const humans = this.seats.filter(x => x.vid).length
      const order = this.seats.filter(x => !x.vid).sort((a, b) => ((a.team === humans % 2 ? 0 : 1) - (b.team === humans % 2 ? 0 : 1)))
      st = order.find(x => x.pos === pos || x.pos === 'any') ?? order[0]
      if (!st) { send(ws, { t: 'gone', why: 'full' }); return }
      Object.assign(st, { vid, name: str(m.name, 24) || 'Guest', pos: st.pos === 'any' ? pos : st.pos, build: cleanBuild(m.build, st.pos === 'any' ? pos : st.pos), look: cleanLook(m.look) })
      // the first one in brings the CPUs for the empty seats (a practice pick; on the real lobby the server picks)
      if (Array.isArray(m.cpus) && !this.cpus) this.cpus = m.cpus.slice(0, 6).map(c => ({ name: str(c.name, 24) || 'CPU', pos: c.pos === 'big' ? 'big' : 'guard', build: c.build, look: cleanLook(c.look) }))
    }
    st.ws = ws; st.seat.heard = Date.now()
    if (!this.g) {
      const have = this.seats.filter(x => x.vid).length
      for (const [w] of this.conns) send(w, { t: 'wait', need: this.need, have })
      if (have >= this.need) this.begin()
      return
    }
    send(ws, this.setupFor(this.seats.indexOf(st)))
    send(ws, snapOf(this.g, this.log, this.acks()))
    if (!this.loop) this.run()
  }
  begin() {
    // the empty seats: the CPUs the first one brought, by position, else a plain build
    const pool = [...(this.cpus ?? [])]
    for (const x of this.seats) {
      if (x.vid) continue
      const i = pool.findIndex(c => c.pos === x.pos || x.pos === 'any')
      const c = i >= 0 ? pool.splice(i, 1)[0] : { name: 'CPU', pos: x.pos === 'any' ? 'guard' : x.pos, build: null, look: null }
      Object.assign(x, { name: c.name, pos: x.pos === 'any' ? c.pos : x.pos, look: c.look ?? { photo: null, faceCenter: null } })
      x.build = cleanBuild(c.build, x.pos)
    }
    this.seed = `btl-${Date.now().toString(36)}`
    const teams = [0, 1].map(t => this.seats.filter(x => x.team === t).map(x => ({ id: `t${t}p${x.slot}`, name: x.name, pos: x.pos, build: x.build })))
    // the seats in the order the game numbers its players (team 0 first)
    this.seats.sort((a, b) => a.team - b.team || a.slot - b.slot)
    this.g = createGame({ teams, seed: this.seed })
    this.log = []; this.evq = 0
    for (const x of this.seats) x.seat = { ...seatNew(), heard: x.seat.heard }
    this.seats.forEach((x, i) => x.ws && send(x.ws, this.setupFor(i)))
    this.run()
  }
  acks() { return this.seats.map(x => x.seat.relDone) }
  run() {
    this.stop()
    this.t0 = Date.now() - (this.g.tick * STEP_MS)
    this.loop = setInterval(() => this.frame(), STEP_MS)
  }
  frame() {
    const g = this.g
    if (!g) return this.stop()
    // the ticks due by the clock (a late timer catches up, at most a few at once)
    let due = Math.min(4, Math.floor((Date.now() - this.t0) / STEP_MS) - g.tick)
    const now = Date.now()
    while (due-- > 0 && g.phase !== 'over') {
      const inputs = this.seats.map((x, i) => (x.vid && now - x.seat.heard < AWAY_MS ? seatInput(x.seat, g, i) : cpuInput(g, i, CPU_LEVEL)))
      step(g, inputs)
      for (const e of g.events) this.log.push({ ...e, sq: ++this.evq, k: g.tick })
      if (g.tick % SEND_EVERY === 0 || g.phase === 'over') this.broadcast()
    }
    while (this.log.length && this.log[0].k < g.tick - EVENT_KEEP) this.log.shift()
    if (g.phase === 'over') { this.broadcast(); this.stop() }
  }
  broadcast() {
    const m = JSON.stringify(snapOf(this.g, this.log, this.acks()))
    for (const [w] of this.conns) { try { w.send(m) } catch {} }
  }
}
