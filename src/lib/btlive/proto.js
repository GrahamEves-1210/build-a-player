// BLACKTOP LIVE online: the wire. What a device sends the referee (the live server: live/src/btlive.js) and what the
// referee sends back, and the two pure halves that turn them into the simulation's inputs and back into a state.
// Pure: runs in the browser, in Node (scripts/btlive/net-check.mjs) and on the Worker.
//
// Messages are JSON, { t: type, ... }.
//   device -> referee
//     hello  { vid, name, pos: 'guard'|'big', build, look: { photo, faceCenter }, humans }   take a seat (or take it back)
//     in     { k, mx, my, x, y, vx, vy, h, n: [a, b, c], rel: { sn, q } | null }
//            k: his own count of messages (old ones are dropped). mx/my: the stick. x..vy: where his device has him.
//            h: the buttons held now (bits: 1 A, 2 B, 4 C). n: how many times each button has been pressed, ever:
//            a press is never lost to a dropped or late message, the next one carries it. rel: the release of his
//            shot as his own device timed it (sn: his A-press count when that shot started, q: quality 0-1); sent
//            again with every message until the referee says it has it (ack)
//     ping   { c }                                             (pong { c, k }: the round trip, and the referee's tick)
//     start  {}                                                the first one in starts with CPUs in the empty seats
//   referee -> device
//     seat   { i, size, seats: [{ name, pos, team, cpu, look }], seed, teams }   your seat and the game's setup
//     wait   { need, have }                                    not enough players yet
//     s      snapshot (snapOf), about 15 a second; carries the last second and a half of what happened (events with
//            a running number e.q), so a dropped snapshot loses nothing
//     gone   {}                                                no such game
import { HZ, T } from './tune.js'
import { meterSpec } from './meter.js'

export const SEND_EVERY = 2                       // the referee sends a snapshot every 2 ticks (15 a second)
export const EVENT_KEEP = Math.round(1.5 * HZ)    // ...with the events of the last 1.5 s
export const AWAY_MS = 1500                       // a player not heard from for this long is played by the CPU
const r2 = v => Math.round(v * 100) / 100
const PF = ['x', 'y', 'vx', 'vy', 'fx', 'fy']
const PI = ['actT', 'actN', 'burst', 'moveCd', 'stealCd', 'noAct', 'catchT', 'catchFrom']

// ── the referee's side ──────────────────────────────────────────────────────────────────────────────

// A seat's input as it comes in, and the input the step gets from it each tick
export const seatNew = () => ({ k: -1, mx: 0, my: 0, pos: null, h: 0, n: [0, 0, 0], used: [0, 0, 0], last: 0, rel: null, relDone: 0, gatherSn: null, heard: 0 })
const num = (v, lo, hi, d = 0) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d)
export function seatMsg(seat, m, now) {
  if (!Number.isInteger(m.k) || m.k <= seat.k) return false                 // old or repeated
  seat.k = m.k; seat.heard = now
  let mx = num(m.mx, -1, 1), my = num(m.my, -1, 1)
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l }
  seat.mx = mx; seat.my = my
  if (Number.isFinite(+m.x) && Number.isFinite(+m.y)) seat.pos = { x: +m.x, y: +m.y, vx: num(m.vx, -30, 30), vy: num(m.vy, -30, 30) }
  seat.h = (m.h | 0) & 7
  if (Array.isArray(m.n)) for (let b = 0; b < 3; b++) { const c = m.n[b] | 0; if (c > seat.n[b] && c < seat.n[b] + 50) seat.n[b] = c }
  if (m.rel && Number.isInteger(m.rel.sn) && m.rel.sn > seat.relDone) seat.rel = { sn: m.rel.sn, q: num(m.rel.q, 0, 1) }
  return true
}
// The input for this tick. Every press makes its own edge (a press that came in while the button already showed as
// held is let go for one tick first), so a tap that fell between two ticks still happens.
export function seatInput(seat, s, i) {
  const out = { mx: seat.mx, my: seat.my, pos: seat.pos, q: null, t: s.tick }
  let bits = 0
  for (let b = 0; b < 3; b++) {
    const bit = 1 << b, was = seat.last & bit
    if (seat.used[b] < seat.n[b]) {
      if (!was) { bits |= bit; seat.used[b]++ }                // the press, now
      // else: up for a tick, so the next one is a new press
    } else if (seat.h & bit && was) bits |= bit                 // still held
  }
  seat.last = bits
  out.shoot = out.steal = !!(bits & 1); out.pass = out.jump = !!(bits & 2); out.move = !!(bits & 4)
  // his shot: the one that started with his latest A press goes with the quality his device timed
  const p = s.players[i]
  if (p.act === 'gather') {
    if (seat.gatherSn == null) seat.gatherSn = seat.used[0]
    if (seat.rel && seat.rel.sn === seat.gatherSn) { out.q = seat.rel.q; seat.relDone = seat.rel.sn; seat.rel = null }
    else if (seat.rel && seat.rel.sn < seat.gatherSn) seat.rel = null
  } else seat.gatherSn = null
  return out
}

// What everyone gets: the state, small (ratings and the CPU's notes never change hands), and what just happened
export function snapOf(s, events, acks) {
  const p = s.players.map(o => {
    const a = PF.map(f => r2(o[f])).concat(PI.map(f => o[f]))
    a.push(o.act, o.shot ? [o.shot.kind, o.shot.three ? 1 : 0, o.shot.read, r2(o.shot.d)] : 0)
    return a
  })
  const b = s.ball
  return {
    t: 's', k: s.tick, ph: s.phase, pT: s.phaseT, po: s.poss, pn: s.possN, cl: s.clock, sc: s.score, gp: s.gamePoint ? 1 : 0, w: s.winner,
    nx: s.next, call: s.call, p,
    b: { st: b.st, holder: b.holder, x: r2(b.x), y: r2(b.y), z: r2(b.z), vx: r2(b.vx), vy: r2(b.vy), vz: r2(b.vz), from: b.from, to: b.to, t: b.t, n: b.n,
      sx: r2(b.sx), sy: r2(b.sy), sz: r2(b.sz), tx: r2(b.tx), ty: r2(b.ty), kind: b.kind, speed: b.speed, lastTeam: b.lastTeam, reb: b.reb, d: b.verdict ? r2(b.verdict.d) : 0 },
    e: events, a: acks, st: s.phase === 'over' ? s.stats : undefined,
  }
}

// ── the device's side ───────────────────────────────────────────────────────────────────────────────

// Write a snapshot into this device's copy of the state (made with createGame from the same setup). The player this
// device moves (me) keeps his own position; everything else is the referee's word.
export function applySnap(s, m, me) {
  s.tick = m.k; s.phase = m.ph; s.phaseT = m.pT; s.poss = m.po; s.possN = m.pn; s.clock = m.cl; s.score = m.sc; s.gamePoint = !!m.gp; s.winner = m.w
  s.next = m.nx; s.call = m.call
  m.p.forEach((a, i) => {
    const o = s.players[i]
    if (i !== me) PF.forEach((f, j) => { o[f] = a[j] })
    PI.forEach((f, j) => { o[f] = a[PF.length + j] })
    o.act = a[PF.length + PI.length]
    const sh = a[PF.length + PI.length + 1]
    o.shot = sh ? { kind: sh[0], three: !!sh[1], read: sh[2], d: sh[3], spec: meterSpec(sh[0], o.R, s.gamePoint) } : null
  })
  const b = s.ball
  Object.assign(b, m.b)
  b.verdict = { d: m.b.d }
  if (m.st) s.stats = m.st
}

// Where everyone else is drawn: a beat behind the latest word, eased between the two snapshots around that moment.
// buf: [{ k, p: Float32Array(x, y per player), b: [x, y, z] }] oldest first.
export function lerpAt(buf, k, out, ball) {
  if (!buf.length) return false
  let i = buf.length - 1
  while (i > 0 && buf[i - 1].k > k) i--
  const B = buf[i], A = i > 0 ? buf[i - 1] : B
  const f = B.k === A.k ? 1 : Math.min(1.25, Math.max(0, (k - A.k) / (B.k - A.k)))   // a little past the last: carry on
  for (let j = 0; j < out.length; j++) out[j] = A.p[j] + (B.p[j] - A.p[j]) * f
  for (let j = 0; j < 3; j++) ball[j] = A.b[j] + (B.b[j] - A.b[j]) * f
  return true
}

// what a release looks like on the wire: just the quality (the meter ran on the device)
export const relMsg = (sn, q) => ({ sn, q: Math.round(q * 1000) / 1000 })
void T
