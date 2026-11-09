// Throw: read the field, press the spot, let it go. Eleven on eleven from above, on a field of real
// proportions. A dot goes down where you press and a ring closes on it over one second; the ball
// leaves when you let go: a quick tap floats a lob, a full hold fires a bullet. A lob hangs, and a
// safety can get under it. A bullet beats a closing corner, but it needs a tighter lead and a man
// in its lane can bat it down. Whoever gets to the ball decides it.
//   bomb         deep routes, the ball long in the air
//   third-long   3rd & 9: past the yellow line; the further past it, the bigger the score
//   acc          the combine: no defense, four routes, each quicker. 3 of 4 passes
import { byV, clamp, lerp, outcome, layer, rngOf, prog, easeOut, easeIn, themOf, text, DISPLAY, LABEL, manOf, xiOf, paceOf, paintFieldDress, particles, nudge, reduceMotion } from './kit.js'
import { goalPosts, breakupPose, tilt, untilt, ground, stands, floodlight, vignette, athlete, warmAthlete, warmQb, qbStance, skinOf, dirOf, airBall, ballShadow, nameTag, crowdPop } from './art.js'

export const how = {
  acc: 'Press where the ball goes and lead him. Tap for a lob. Hold for a bullet.',
  'third-long': 'Find the open man past the yellow line. Press the spot. Tap for a lob. Hold for a bullet.',
  bomb: 'Find the man running free deep. Press the spot. Tap for a lob. Hold for a bullet.',
}

// ── The field. x: 0-360 across, the sidelines at 8 and 352 (53 1/3 yards). y: up from the line of
// scrimmage, 8.4 units a yard, sixty yards of it on the screen. Hashes and numbers where they
// really are. ────────────────────────────────────────────────────────────────────────────────────
export const YD = 8.4
export const SL = 8, SR = 352
const XYD = (SR - SL) / 53.33
export const HASH_L = SL + 23.58 * XYD, HASH_R = SR - 23.58 * XYD
export const NUM_L = SL + 12 * XYD, NUM_R = SR - 12 * XYD
const SET_MS = 900
const WR_V = 0.082, TE_V = 0.07, RB_V = 0.072
// the men in coverage: a corner or a safety flat out is a shade quicker than a receiver, a backer isn't, and nobody's quick going backwards
const DB_V = 0.084, LB_V = 0.074, PEDAL_V = 0.052
const FLIP_GAP = 17, FLIP_MS = 1100, TURN_MS = 170   // how much cushion he gives before he turns and runs, and what the turn costs
const TRAIL_TAU = 105, LEV = 17                      // in phase: this far behind (as a lag, ms) and this far to the side of him
const WIN_P = 0.84, HALF_P = 0.5                     // how often someone gets a step on his man: most snaps, not all of them
const GOAL = 50 * YD, TOP = GOAL + 10 * YD
const curve = (v, p) => Math.pow(clamp((v - 1) / 10, 0, 1), p)
export const catchOf = v => 7 + 35 * curve(v, 1.4)        // how far he can reach for it
export const scatterOf = v => byV(v, 3, 0.8)              // sd of where a good throw really lands
export const trackOf = v => 10 + 220 * curve(v, 1.3)      // how long before it lands his eyes find it, ms
// the ball: power 0 a lob, 1 a bullet. The bomb is a long, long way
// the meter: it closes this fast, and at the end of it the ball's gone on its own
export const HOLD_MS = 250
const speedOf = (game, arm, pw) => lerp(0.17, 0.2618, pw) * byV(arm, 0.78, 1.26)   // the same ball in every passing game
export const flightOf = (game, arm, d, pw) => 110 + d / speedOf(game, arm, pw)
// how far he can get it, in the air from where he stands. Past that, the mark stops: a weak arm can't get there
const rangeOf = arm => byV(arm, 40, 70) * YD
export function inRange(qb, x, y, arm) {
  const dx = x - qb.x, dy = y - qb.y, d = Math.hypot(dx, dy), R = rangeOf(arm)
  return d <= R ? { x, y } : { x: qb.x + (dx / d) * R, y: qb.y + (dy / d) * R }
}
// (even a rope climbs on a long throw: a 40-yard bullet goes over the backers, it's coming down that a man can get to it)
export const arcOf = (d, pw) => lerp(clamp(d * 0.42, 34, 140), Math.max(9, d * 0.1), Math.pow(pw, 0.7))
// the tackle: how fast a man closes, how near is touching him, how long they take to go down and how
// far their momentum carries them
const TACKLE_V = 0.092, TACKLE_R = 9, TACKLE_MS = 460, TACKLE_SLIDE = 11
const BODY_LEN = 2 * YD   // he falls forward: the ball's spotted at his head, this far past his feet
const HANDS = 14      // up to here a man can get a hand on it
const ARM = 1.3       // a ball out in front of him: he can extend for it, further than he can reach back
const CONTEST = 0.38  // a catch with a defender right there and the ball between them
const ROOM = 8        // a defender stays this far off a receiver's body: on his hip, not in him

const CLOSE = 24      // a touchdown: how near his mates get before they're jumping on him
const SACK_UP = 420   // a sack: how long after they're down before he gets up
const PICK_RUN = 1150 // a pick: how long he runs it back
// a number for the look of a game that isn't the rules' rng: who dances how
export const flairOf = seed => { const s = String(seed); let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff; return h }

function gaussOf(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()) }

// A route: points, then straight on. at() writes into a scratch point.
function mkPath(pts) {
  const segs = []
  let s0 = 0
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
    const len = Math.hypot(bx - ax, by - ay) || 1
    segs.push({ ax, ay, ux: (bx - ax) / len, uy: (by - ay) / len, s0, len })
    s0 += len
  }
  return { pts, segs, len: s0 }
}
function at(path, s, o) {
  const { segs } = path
  let sg = segs[0]
  for (let i = 1; i < segs.length && s >= segs[i].s0; i++) sg = segs[i]
  const d = Math.max(0, s - sg.s0)
  o.x = sg.ax + sg.ux * d; o.y = sg.ay + sg.uy * d; o.ux = sg.ux; o.uy = sg.uy
  return o
}
const A = { x: 0, y: 0, ux: 0, uy: 1 }, A2 = { x: 0, y: 0 }
// a route's shape from where he lines up: x toward the middle (units), y upfield
const SHAPES = {
  go: [[0, 0], [0, 900]],
  seam: [[0, 0], [16, 60], [16, 900]],
  post: [[0, 0], [0, 125], [150, 320], [300, 520]],
  corner: [[0, 0], [0, 125], [-90, 250], [-120, 305]],
  dig: [[0, 0], [0, 115], [300, 115]],
  comeback: [[0, 0], [0, 140], [-18, 120]],
  // real route depths: a hitch at 5, a stick at 6, a curl at 12, an out at 10, a slant, a flat, a shallow drive
  curl: [[0, 0], [0, 108], [8, 98]],
  stick: [[0, 0], [0, 58], [-10, 58]],
  hitch: [[0, 0], [0, 52], [5, 44]],
  out10: [[0, 0], [0, 92], [-90, 92]],
  slant: [[0, 0], [0, 26], [150, 120]],
  flat: [[0, 0], [-28, 20], [-110, 30]],
  drive: [[0, 0], [20, 60], [300, 72]],
  cross: [[0, 0], [0, 26], [250, 130], [420, 140]],
  check: [[0, 0], [-46, 22], [-110, 34]],
}
// a route headed upfield and out (a corner from the slot or the tight end) bends up the sideline a
// couple of yards inside it and keeps running, instead of running into the chalk and stopping there.
// Routes that go flat to the sideline (an out, a flat) are left alone: they're meant to end at it.
const LANE_L = SL + 18, LANE_R = SR - 18, BEND = 10
function byTheSideline(pts) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
    const len = Math.hypot(bx - ax, by - ay) || 1
    if ((by - ay) / len < 0.5) continue
    const side = bx < LANE_L + BEND ? -1 : bx > LANE_R - BEND ? 1 : 0
    if (!side || side * (bx - ax) <= 0) continue
    const lane = side < 0 ? LANE_L : LANE_R, edge = lane - side * BEND
    // where this leg reaches the edge of the lane (or here, if he's already out there)
    const t = (side < 0 ? ax > edge : ax < edge) ? (edge - ax) / (bx - ax) : 0
    const px = t ? edge : clamp(ax, LANE_L, LANE_R), py = ay + t * (by - ay)
    const out = pts.slice(0, i + 1)
    if (t) out.push([px, py])
    out.push([lane, py + BEND * 2], [lane, py + 900])
    return out
  }
  return pts
}
const BOMB_CALLS = [
  { X: 'go', H: 'post', Z: 'go', TE: 'seam', RB: null },
  { X: 'post', H: 'seam', Z: 'go', TE: 'corner', RB: null },
  { X: 'go', H: 'seam', Z: 'post', TE: 'cross', RB: 'check' },
]
const LONG_CALLS = [
  { X: 'curl', H: 'flat', Z: 'curl', TE: 'seam', RB: 'check' },         // curl-flat
  { X: 'hitch', H: 'corner', Z: 'hitch', TE: 'drive', RB: 'check' },    // smash
  { X: 'dig', H: 'seam', Z: 'go', TE: 'stick', RB: 'check' },           // dagger
  { X: 'go', H: 'out10', Z: 'comeback', TE: 'flat', RB: 'check' },      // sail
  { X: 'post', H: 'drive', Z: 'dig', TE: 'cross', RB: null },           // Y-cross
  { X: 'slant', H: 'out10', Z: 'slant', TE: 'seam', RB: 'check' },      // slants, with an out behind them
]
// where the seven behind the line go. m: man on him. z: a zone spot. deep: a safety over the top.
const COVERS = {
  c1: { name: 'man', cb: [{ m: 'X' }, { m: 'Z' }], n: { m: 'H' }, lb: [{ m: 'RB' }, { m: 'TE' }], s: [{ deep: 1, x: 180, y: 150 }, { z: [180, 80], x: 252, y: 68 }] },
  c3: { name: 'zone', cb: [{ z: [58, 204] }, { z: [302, 204] }], n: { z: [100, 86] }, lb: [{ z: [152, 80] }, { z: [212, 80] }], s: [{ deep: 1, x: 180, y: 150 }, { z: [276, 80], x: 262, y: 66 }] },
  c2: { name: 'zone', cb: [{ z: [36, 58] }, { z: [324, 58] }], n: { z: [100, 84] }, lb: [{ z: [152, 80] }, { z: [212, 80] }], s: [{ deep: 1, x: 96, y: 134, half: -1 }, { deep: 1, x: 264, y: 134, half: 1 }] },
}

// who's who on a real roster: the group and the man in it
const OFF_ROLE = { X: ['wr', 0], Z: ['wr', 1], H: ['wr', 2], TE: ['te', 0], RB: ['rb', 0], QB: ['qb', 0] }
const DEF_ROLE = { CB0: 0, CB1: 1, S0: 2, S1: 3, N: 4, S2: 5 }
// how far up his route a man makes his move: the first real break, or a step won on the way up
function moveAt(p, r) {
  const sg = p.path.segs.find(q => q.s0 >= 70)
  return Math.min(sg ? sg.s0 : 150, 170) + r() * 40
}

// ── An offense and a defense, on the ball ───────────────────────────────────────────────────────
function mkTeams(r, calls, Mx, cast, bomb = false) {
  const call = calls[Math.floor(r() * calls.length)]
  const flipped = Mx(0) !== 0
  const pacey = (id, base) => {
    const [g, i] = OFF_ROLE[id]
    return base * paceOf(cast, 'us', g, i)
  }
  // (every man on the field a real one, the full eleven a side: xiOf; the old groups when a cast has none)
  const lookO = id => { const [g, i] = OFF_ROLE[id]; return xiOf(cast, 'us', g, i) ?? manOf(cast, 'us', g, i) }
  // the ball is on a hash, or the middle of the field; the interior goes with it, the wideouts don't
  const BX = [HASH_L, 180, HASH_R][Math.floor(r() * 3)]
  const IN = x => x - 180 + BX
  const mk = (id, x, y, pts, v, scale = 0.78) => {
    const path = pts ? mkPath(pts) : null
    return { id, x, y, x0: x, y0: y, path, v, s: 0, scale, face: 0, spd: 0, elig: !!pts, sStop: 0, side: 'o' }
  }
  const route = (name, x, y) => {
    if (!name) return null
    const inward = x < 180 ? 1 : -1
    return byTheSideline(SHAPES[name].map(([dx, dy]) => [Mx(x + dx * inward), y + dy]))
  }
  // shotgun, 11 personnel: five on the line, a tight end and the X make it seven; slot, Z, back, QB off it
  const X = mk('X', Mx(30), -9, route(call.X, 30, -9), pacey('X', WR_V))
  const H = mk('H', Mx(98), -20, route(call.H, 98, -20), pacey('H', WR_V))
  const Z = mk('Z', Mx(330), -20, route(call.Z, 330, -20), pacey('Z', WR_V))
  const teX = IN(180 + 72)
  const TE = mk('TE', Mx(teX), -9, route(call.TE, teX, -9), pacey('TE', TE_V), 0.82)
  const rbX = IN(180 - 32)
  const RB = mk('RB', Mx(rbX), -42, route(call.RB, rbX, -42), pacey('RB', RB_V))
  const QB = mk('QB', Mx(BX), -42, null, 0, 0.82)
  // (left to right on the screen, whichever way the play's flipped)
  const OL = [-46, -23, 0, 23, 46].map((d, i) => { const o = mk(`OL${i}`, Mx(BX + d), -9, null, 0, 0.84); o.look = xiOf(cast, 'us', 'ol', flipped ? 4 - i : i) ?? manOf(cast, 'us', 'ol', flipped ? 4 - i : i); o.lo = (flipped ? 4 - i : i) % 2; return o })
  for (const p of [X, H, Z, TE, RB, QB]) p.look = lookO(p.id)
  const off = [...OL, TE, X, H, Z, RB, QB]
  const backs = [X, H, Z, TE, RB].filter(p => p.path)
  for (const p of backs) {
    let s = 0
    while (s < 1100) { at(p.path, s, A); if (A.y > TOP - 14 || A.x < 14 || A.x > 346) break; s += 3 }
    p.sStop = s
  }
  // a checkdown and a comeback settle where they end
  if (RB.path) RB.sStop = RB.path.len
  for (const [p, name] of [[X, call.X], [H, call.H], [Z, call.Z], [TE, call.TE]]) if (name === 'comeback' || name === 'curl' || name === 'stick' || name === 'hitch') p.sStop = p.path.len

  // the read. Most snaps one man gets a step, for a while; some snaps a second gets half of one; some
  // snaps nobody does, and it's a tight window or nothing. The quicker man wins more of them.
  const deep = backs.filter(p => p.id !== 'RB')
  const weightOf = p => Math.max(0.25, 1 + (p.v / (p.id === 'TE' ? TE_V : WR_V) - 1) * 20)
  const pick = list => {
    let left = r() * list.reduce((a, p) => a + weightOf(p), 0)
    for (const p of list) { left -= weightOf(p); if (left <= 0) return p }
    return list[list.length - 1]
  }
  const free = r() < WIN_P ? pick(deep) : null
  const semi = free && r() < HALF_P ? pick(deep.filter(p => p !== free)) : null
  const keys = Object.keys(COVERS)
  const coverKey = keys[Math.floor(r() * keys.length)]
  const cov = COVERS[coverKey]
  const nickel = r() < 0.6 || cov.name === 'man'
  const press = cov.name === 'man' && r() < 0.5
  const byId = { X, H, Z, TE, RB }
  const dk = (id, x, y, job0) => {
    // (a man on a back who stayed in to block drops into the hole instead)
    const stayed = job0.m && !byId[job0.m].path
    const job = stayed ? { z: [job0.m === 'RB' ? 150 : 210, 78] } : job0
    const mark = job.m ? byId[job.m] : null
    const db = id in DEF_ROLE
    const ri = DEF_ROLE[id]
    const has = (cast?.them?.db?.length ?? 0) > ri
    const v = (db ? DB_V * (has ? paceOf(cast, 'them', 'db', ri) : 1) : LB_V)
    const spot = job.z ? [Mx(job.z[0]), job.z[1]] : null
    return { id, x, y, x0: x, y0: y, mark, spot, spot0: spot, third: !!job.z && job.z[1] >= 150, deep: !!job.deep, half: job.half ? (Mx(180 + job.half * 60) < 180 ? -1 : 1) : 0, aimX: x, aimY: y, drive: 0, flip: null, v, look: (db ? xiOf(cast, 'them', 'db', ri) ?? (id === 'S2' ? xiOf(cast, 'them', 'lb', 2) : null) : xiOf(cast, 'them', 'lb', id === 'LB1' ? 1 : 0)) ?? (db && has ? manOf(cast, 'them', 'db', ri) : null), scale: 0.78, face: Math.PI, spd: 0, side: 'd', kind: job.deep ? 'safety' : job.z ? 'zone' : 'man' }
  }
  // the down four
  const DL = [-58, -20, 20, 58].map((d, i) => ({ id: `DL${i}`, x: Mx(BX + d), y: 10, x0: Mx(BX + d), y0: 10, scale: 0.84, face: Math.PI, spd: 0, side: 'd', kind: 'dl', look: xiOf(cast, 'them', 'dl', i) ?? (cast?.them?.dl?.length > i ? manOf(cast, 'them', 'dl', i) : null), lo: (i + 1) % 2 }))
  const back = []
  back.push(dk('CB0', X.x, press ? 12 : 46, cov.cb[0]), dk('CB1', Z.x, press ? 12 : 46, cov.cb[1]))
  back.push(dk('N', nickel ? H.x : Mx(BX), nickel ? 34 : 44, cov.n))
  // the bomb: they know it's coming. A backer comes off for a third safety, deep over the top with the other two
  if (bomb) {
    const side = r() < 0.5 ? -1 : 1, two = cov.s[1].deep
    back.push(two ? dk('S2', Mx(180), 150, { deep: 1 }) : dk('S2', Mx(180 + side * 84), 134, { deep: 1, half: side }))
  } else back.push(dk('LB0', Mx(BX - 32), 44, cov.lb[0]))
  back.push(dk('LB1', Mx(BX + 32), 44, cov.lb[1]))
  const ss = cov.s
  back.push(dk('S0', Mx(ss[0].x), ss[0].y, ss[0]), dk('S1', Mx(ss[1].x), ss[1].y, ss[1]))
  // What beats him, and only for a while. The man on him gets beat at the break: he loses a step and
  // has to chase. A zone man or a safety gets looked off: he's sold on something else until he reads
  // it, and comes back. After that the window shuts. Nobody's open for the whole play.
  const winAt = free ? Math.min(moveAt(free, r) / free.v + r() * 260, 1900) : Infinity
  const shutAt = winAt + 1050 + r() * 600
  for (const d of back) {
    d.beat = null
    d.lookedOff = 0
    if (free && d.mark === free) d.beat = { at: winAt, until: winAt + 1000, tau: 300, f: 0.74 }
    else if (semi && d.mark === semi) { const a = moveAt(semi, r) / semi.v + r() * 260; d.beat = { at: a, until: a + 650, tau: 175, f: 0.9 } }
    if (free && d.spot) {
      at(free.path, Math.min(free.sStop, moveAt(free, r) + 50), A)
      if (Math.hypot(d.spot0[0] - A.x, d.spot0[1] - A.y) < 100) { d.lookedOff = shutAt; d.soldOn = [lerp(d.spot0[0], 180, 0.55), d.spot0[1] * 0.72] }
    }
    if (free && d.deep) d.lookedOff = shutAt
  }
  // a man who beats it through the middle has moved the deep safety off it first
  let freeMid = 0
  if (free) { at(free.path, Math.min(free.sStop, 300), A); freeMid = Math.abs(A.x - 180) < 75 ? (r() < 0.5 ? -1 : 1) : 0 }
  return { off, def: [...DL, ...back], X, H, Z, TE, RB, QB, OL, DL, back, backs, free, semi, shutAt, freeMid, coverKey, call, nickel, BX: Mx(BX) }
}

// ── The play ────────────────────────────────────────────────────────────────────────────────────
export function make({ v, arm = v, seed, game, cast = null }) {
  return game === 'acc' ? makeAcc({ v, arm, seed, game }) : makePlay({ v, arm, seed, game, cast })
}
const DEF_H = 700
// a press on the screen → the spot on the field. A press on one of his own men aims at that man: the
// sprite stands up off the spot under his feet. (A bot aims at a field spot: exact.)
// where a man is on the screen, for his key: his chest, which is where a press on him goes
const keyTargetOf = (g, p) => { const q = tilt(g.cam, p.x, g.los - p.y * g.k); return { x: q.x, y: q.y - 15 * q.s } }
function aimOf(g, a, own) {
  const f = untilt(g.cam, a.x, a.y)
  if (!a.exact) {
    let best = null, bd = Infinity
    for (const p of own) {
      const q = tilt(g.cam, p.x, g.los - p.y * g.k)
      if (Math.abs(a.x - q.x) < 11 * q.s && a.y < q.y + 4 * q.s && a.y > q.y - 30 * q.s) {
        const e = Math.abs(a.x - q.x) + Math.abs(a.y - (q.y - 15 * q.s))
        if (e < bd) { bd = e; best = p }
      }
    }
    if (best) return { x: best.x, y: best.y }
  }
  return { x: f.x, y: (g.los - f.y) / g.k }
}
// (low in the picture: the QB's the man in front of us, and the field runs away from him)
const losOf = h => Math.round(h * 0.84)
const kOf = (los, top) => (los - 30) / top
function makePlay({ v, arm, seed, game, cast }) {
  const r = rngOf(seed)
  const mirror = r() < 0.5
  const Mx = x => (mirror ? 360 - x : x)
  const bomb = game === 'bomb'
  const T = mkTeams(r, bomb ? BOMB_CALLS : LONG_CALLS, Mx, cast, bomb)
  const line = bomb ? 0 : 9 * YD        // the line to gain (third & nine)
  const need = bomb ? 15 * YD : line    // how far down the field counts
  const reach = bomb ? catchOf(v) * 0.8 + 2 : catchOf(v) + 2, scat = scatterOf(v)
  // (the bomb: he's on the ball's placement sooner, and the rush gets home sooner)
  const track = trackOf(v) + (bomb ? 200 : 0)
  const sackAt = bomb ? byV(v, 3000, 3600) : byV(v, 3700, 4400)
  const los0 = losOf(DEF_H)
  const flair = flairOf(seed)
  const g = {
    t: 0, game, zones: 'none', aim: true, fx: [], done: null, outro: 1500, stamp: null,
    flair, nudge: nudge(), dirt: particles(48, flair + 1), cz: 1,
    phase: 'set', snap: SET_MS, mirror, ...T, GOAL, TOP, line, need, reach, scat, sackAt,
    ball: null, res: null, rush: 0, hold: null,
    los: los0, k: kOf(los0, TOP),
    tilted: true, cam: { w: 360, h: DEF_H },
    hud: { prompt: 'SET', dots: null },
    // what a QB can see: where a man's route takes him in ms
    project(p, ms, o = {}) {
      const s = Math.min(p.s + p.v * ms, p.sStop)
      at(p.path, s, A)
      o.x = A.x; o.y = A.y
      return o
    },
    airTo(x, y, pw) { return flightOf(game, arm, Math.hypot(x - g.QB.x, y - g.QB.y), pw) },
    screenY(fy) { return g.los - fy * g.k },
    // where a field spot is under the finger (through the camera, on the tilted games)
    screenOf(fx, fy) { return tilt(g.cam, fx, g.los - fy * g.k) },
    keyTargets() { return g.phase === 'run' ? T.backs.map(p => keyTargetOf(g, p)) : null },
    power() { return g.hold ? clamp((g.t - g.hold.at) / HOLD_MS, 0, 1) : 0 },
    tick(dt) {
      g.t += dt
      const rt = g.t - g.snap
      if (g.phase === 'set') {
        if (rt >= 0) { g.phase = 'run'; g.hud.prompt = 'PRESS WHERE THE BALL GOES'; g.fx.push('whistle') }
        return
      }
      step(rt, dt)
      // the ring has closed: a bullet, right now
      if (g.phase === 'run' && g.hold && g.t - g.hold.at >= HOLD_MS) letGo()
      // the pocket's going: say so while there's still time to do something about it
      if (g.phase === 'run' && !g.heat && rt >= sackAt * 0.72) { g.heat = true; if (!g.hold) g.hud.prompt = 'GET IT OUT'; g.hud.hot = true; g.fx.push('h:light') }
      if (g.phase === 'run' && rt >= sackAt) sacked()
      if (g.phase === 'air') {
        const b = g.ball
        batted(b)
        if (g.phase === 'air' && g.t >= b.land) settle()
      }
    },
    input(a) {
      if (g.phase !== 'run') return
      if (a.kind === 'down') {
        if (g.hold) return
        const f = aimOf(g, a, T.backs)
        const m = inRange(g.QB, clamp(f.x, 10, 350), clamp(f.y, -30, TOP), arm)
        g.hold = { fx: m.x, fy: m.y, at: g.t }
        g.hud.prompt = 'LET GO TO THROW'
        g.fx.push('h:light')
      } else if (a.kind === 'up' && g.hold) letGo()
    },
  }
  function letGo() {
    const pw = g.power(), h = g.hold
    g.hold = null
    throwTo(h.fx, h.fy, pw)
  }
  function throwTo(tx, ty, pw) {
    const lx = clamp(tx + gaussOf(r) * scat, 6, 354), ly = ty + gaussOf(r) * scat
    const d = Math.hypot(lx - g.QB.x, ly - g.QB.y)
    const flight = flightOf(game, arm, d, pw)
    let best = null, bd = Infinity
    for (const p of T.backs) {
      g.project(p, flight, A2)
      const e = Math.hypot(A2.x - lx, A2.y - ly)
      if (e < bd) { bd = e; best = p }
    }
    // who goes for it: the closest two. A man in zone is watching the QB and breaks as it leaves his
    // hand; a man in man has his back to it, and finds it late, off his man's eyes.
    const dd = T.back.map(q => ({ q, e: Math.hypot(q.x - lx, q.y - ly) })).sort((a, b) => a.e - b.e).slice(0, 2)
    for (const { q } of dd) if (q.kind !== 'man') q.drive = g.t + clamp(flight * (bomb ? 0.3 : 0.32), bomb ? 130 : 170, bomb ? 620 : 370)
    for (const q of T.back) if (q.kind === 'man' && (q.mark === best || dd.some(e => e.q === q))) q.drive = g.t + (bomb ? Math.max(flight * 0.25, flight - 620) : Math.max(flight * 0.38, flight - 380))
    g.ball = { x0: g.QB.x, y0: g.QB.y, tx, ty, lx, ly, pw, d, H: arcOf(d, pw), at: g.t, land: g.t + flight, flight, target: best, trackAt: g.t + flight - Math.min(flight * 0.7, track + 130 + (1 - pw) * 60), reach: reach * lerp(1.12, 0.78, pw) }
    g.phase = 'air'
    g.hud.prompt = null
    g.fx.push('swoosh', pw > 0.8 ? 'h:medium' : 'h:light')
  }
  // low and flat, a man in its lane gets a hand on it
  function batted(b) {
    const f = prog(g.t, b.at, b.land)
    if (f < 0.14 || f > 0.86) return
    if (b.H * Math.sin(f * Math.PI) >= HANDS) return
    const x = lerp(b.x0, b.lx, f), y = lerp(b.y0, b.ly, f)
    for (const q of T.back) {
      if (Math.hypot(q.x - x, q.y - y) < 7) {
        g.phase = 'over'
        b.lx = x; b.ly = y
        g.res = { why: 'bat', at: g.t, who: b.target, dq: q, x, y }
        g.done = outcome(0.08, false, 'Batted down.', { made: 0, of: 1 })
        g.stamp = { text: 'BATTED DOWN', good: false, at: g.t + 80 }
        g.fx.push('pop', 'h:medium')
        return
      }
    }
  }
  function sacked() {
    g.phase = 'over'
    g.hold = null
    const by = Math.hypot(T.DL[0].x - T.QB.x, T.DL[0].y - T.QB.y) <= Math.hypot(T.DL[3].x - T.QB.x, T.DL[3].y - T.QB.y) ? T.DL[0] : T.DL[3]
    const side = by.x <= T.QB.x ? 1 : -1      // he goes down away from the man who hit him
    g.res = { why: 'sack', at: g.t, by, side, x0: T.QB.x, y0: T.QB.y }
    g.hud.prompt = null
    g.done = outcome(0, false, 'The rush got there.', { made: 0, of: 1 }, true)
    g.stamp = { text: 'SACKED', good: false, at: g.t + TACKLE_MS }
    g.outro = 2500   // (he gets up and lets everyone know)
    g.fx.push('pop', 'h:heavy')
  }
  function settle() {
    const b = g.ball
    const tp = b.target
    const rr = Math.hypot(tp.x - b.lx, tp.y - b.ly)
    let dq = null, dd = Infinity
    for (const q of T.back) { const e = Math.hypot(q.x - b.lx, q.y - b.ly); if (e < dd) { dd = e; dq = q } }
    const RD = byV(v, 18, 12) * (bomb ? 1.25 : 1)   // a truer ball is further from his hands (and a bomb hangs: he has time to get there)
    const has = rr <= b.reach * (b.ly > tp.y ? ARM : 1)
    const contested = dd <= RD
    let why
    if (has && !contested) why = 'catch'
    else if (has) {
      // both of them there: the man nearer the ball has the better of it, and nothing's sure
      const edge = clamp((dd - rr) / RD, -1, 1)
      why = r() < clamp(CONTEST - (bomb ? 0.1 : 0) + edge * 0.5, 0.1, 0.92) ? 'catch' : 'swat'
    } else if (contested) why = dd < 6 && r() < 0.45 ? 'pick' : 'swat'
    else why = b.ly > tp.y + 5 ? 'over' : b.ly < tp.y - 5 ? 'under' : 'wide'
    g.phase = 'over'
    const res = { why, at: g.t, who: tp, dq, x: b.lx, y: b.ly }
    g.res = res
    if (why === 'catch') {
      tp.hasBall = true
      // what he gets after the catch: he runs upfield until a defender can actually get to him.
      // Each one takes his angle at full speed; the first to arrive makes the tackle.
      const V = TACKLE_V, RR = TACKLE_R
      let n1 = null, soon = Infinity
      for (const q of T.back) {
        const rx = q.x - tp.x, ry = q.y - tp.y
        const qa = tp.v * tp.v - V * V, qb = -2 * (ry * tp.v + RR * V), qc = rx * rx + ry * ry - RR * RR
        const tt = qc <= 0 ? 0 : (-qb - Math.sqrt(qb * qb - 4 * qa * qc)) / (2 * qa)
        if (tt < soon) { soon = tt; n1 = q }
      }
      const contactY = tp.y + tp.v * soon
      const endY = contactY + TACKLE_SLIDE
      const headY = endY + BODY_LEN, scores = headY >= GOAL, untouched = contactY >= GOAL
      res.scores = scores
      res.runner = tp
      if (!untouched) res.tackle = { y: contactY, end: endY, at: g.t + soon, done: g.t + soon + TACKLE_MS, by: n1, side: n1.x <= tp.x ? -1 : 1, hit: false }
      const when = untouched ? g.t + Math.max(0, GOAL - tp.y) / tp.v : res.tackle.done
      if (untouched) res.tdAt = when + 180
      const depth = scores ? GOAL : headY
      if (depth < need) {
        g.done = outcome(bomb ? 0.25 : 0.32, false, bomb ? 'A checkdown is no bomb.' : 'Short of the sticks.', { made: 0, of: 1 })
        g.stamp = { text: bomb ? 'TOO SHORT' : 'SHORT OF THE STICKS', good: false, at: when + 40, size: bomb ? 46 : 32 }
        g.outro = clamp(when - g.t + 1400, 1200, 4600)
        res.afterAt = when
        g.fx.push('h:medium')
        return
      }
      const past = depth - line
      const score = bomb ? clamp(0.6 + (depth / GOAL) * 0.4, 0.6, 1) : clamp(0.72 + (past / (20 * YD)) * 0.28, 0.72, 1)
      g.done = outcome(scores ? 1 : score, true, scores ? 'Touchdown.' : bomb ? `A ${Math.round(depth / YD)} yard strike.` : `${Math.round(past / YD)} past the sticks.`, { made: 1, of: 1 })
      g.stamp = { text: scores ? 'TOUCHDOWN' : bomb ? 'BIG GAIN' : 'FIRST DOWN', good: true, at: when + 40 }
      // (a touchdown is the payoff: time for the spike, his dance and everyone getting to him)
      g.outro = scores ? clamp(when - g.t + 2900, 2600, 6200) : clamp(when - g.t + 1700, 1400, 5000)
      res.afterAt = when
      g.fx.push('tap', 'h:heavy')
      return
    }
    const words = { pick: 'PICKED OFF', swat: 'BROKEN UP', over: 'OVERTHROWN', under: 'UNDERTHROWN', wide: 'INCOMPLETE' }
    const near = clamp(1 - rr / (reach * 4 + 40), 0, 1)
    g.done = outcome(why === 'pick' ? 0 : 0.1 + near * 0.2, false, words[why].toLowerCase(), { made: 0, of: 1 })
    g.stamp = { text: words[why], good: false, at: g.t + 120 }
    g.outro = why === 'pick' ? 2900 : 1900
    g.fx.push('pop', 'h:medium')
  }
  // everybody moves: closed forms for the lines, steering for everyone in space
  function step(rt, dt) {
    const over = g.phase === 'over'
    const res = g.res
    const slow = over && res ? clamp(1 - (g.t - res.at) / 500, 0, 1) : 1
    // the pocket: holds, then comes apart
    const f = clamp(rt / sackAt, 0, 1)
    g.rush = f
    const drop = easeOut(prog(rt, 0, 420))
    T.QB.y = lerp(-42, -52, drop) + (f > 0.55 ? (f - 0.55) * 16 : 0)
    if (res?.why === 'sack') T.QB.x = res.x0 + res.side * easeOut(prog(g.t, res.at, res.at + TACKLE_MS)) * 12
    T.OL.forEach((p, i) => {
      const push = easeIn(f) * (i === 0 || i === 4 ? 30 : 16)
      p.y = -9 - drop * 6 - push
      p.x = p.x0 + (p.x0 - T.BX) * 0.05 * drop
    })
    T.DL.forEach((d, i) => {
      if (res?.why === 'sack' && res.by === d) {
        // he has him: on the QB's near hip and going down with him. Then he's up, a step off him, for all to see
        const up = g.t >= res.at + TACKLE_MS + SACK_UP
        d.x = lerp(d.x, T.QB.x - res.side * (up ? 26 : 5), up ? 0.03 : 0.2); d.y = lerp(d.y, T.QB.y + (up ? 6 : -3), up ? 0.03 : 0.2)
      } else if (res?.why === 'sack' && (d === T.DL[0] || d === T.DL[3]) && g.t >= res.at + 300) {
        // the other end gets to his man
        const dx = res.by.x + (d.x0 < res.by.x ? -24 : 24) - d.x, dy = res.by.y + 8 - d.y
        d.x += clamp(dx, -0.08 * dt, 0.08 * dt); d.y += clamp(dy, -0.08 * dt, 0.08 * dt)
      } else if (i === 1 || i === 2) {
        // the tackles fight in the middle, on their man
        const o = T.OL[i === 1 ? 1 : 3]
        d.y = o.y + 17; d.x = lerp(d.x0, o.x + (i === 1 ? 3 : -3), drop)
      } else {
        // the ends bend round the edge to the QB's shoulders
        const side = d.x0 < T.BX ? -1 : 1
        const ff = easeIn(f)
        const wide = Math.sin(Math.min(1, f * 1.5) * Math.PI) * 18
        d.x = lerp(d.x0, T.QB.x + side * 12, ff) + side * wide
        d.y = lerp(10, T.QB.y + 7, Math.pow(f, 1.25))
        d.face = d.y > T.QB.y + 8 ? Math.PI - Math.atan2(T.QB.x - d.x, d.y - T.QB.y) : Math.PI
      }
    })
    // the eligibles
    const tk = res?.tackle
    for (const p of T.backs) {
      const px = p.x, py = p.y
      const b = g.ball
      if (p.hasBall) {
        // he's gone, until someone gets there
        if (tk && g.t >= tk.at) {
          if (!tk.hit && g.t >= tk.done) { tk.hit = true; g.fx.push('whistle') }
          if (!tk.met) { tk.met = true; g.fx.push('h:heavy') }
          p.y = lerp(tk.y, tk.end, easeOut(prog(g.t, tk.at, tk.done)))
        } else if (res?.tdAt != null && g.t >= res.tdAt) {
          // in, and he stops to spike it
        } else if (p.y < TOP - 16) {
          p.y += p.v * dt
          if (!(g.t < p.cutUntil)) {
            let near = null, nd = Infinity
            for (const q of T.back) { const e = Math.hypot(q.x - p.x, q.y - p.y); if (q.y > p.y - 10 && e < nd) { nd = e; near = q } }
            if (near && nd < 80) {
              const juke = nd < 42 && r() < 0.4, side = near.x > p.x ? -1 : 1
              p.cutV = side * (juke ? 0.14 : 0.05)
              p.cutUntil = g.t + (juke ? 130 : 420)
              if (juke) p.cutAt = g.t
            } else { p.cutV = 0; p.cutUntil = g.t + 140 }
          }
          p.x = clamp(p.x + p.cutV * dt, 24, 336)
        }
      } else if (over && res?.tdAt != null && g.t >= res.tdAt - 200) {
        // the rest of them get to him
        const dx = res.runner.x - p.x, dy = res.runner.y - p.y, e = Math.hypot(dx, dy)
        if (e > CLOSE) { const mv = Math.min(e - CLOSE, p.v * 1.1 * dt); p.x += (dx / e) * mv; p.y += (dy / e) * mv }
      } else if (over) {
        if (slow > 0) {
          if (p.off) { p.x += p.off.x * p.v * dt * slow; p.y += p.off.y * p.v * dt * slow }
          else { p.s = Math.min(p.s + p.v * dt * slow, p.sStop); at(p.path, p.s, A); p.x = A.x; p.y = A.y }
        }
      } else if (b && b.target === p && g.t >= b.trackAt) {
        // eyes up: he comes off his route and works to it, short or long, and sits under it
        const dx = b.lx - p.x, dy = b.ly - p.y, e = Math.hypot(dx, dy)
        if (e > 1.5) { const mv = Math.min(e, p.v * 1.2 * dt); p.x += (dx / e) * mv; p.y += (dy / e) * mv; p.off = { x: dx / e, y: dy / e } }
      } else {
        p.s = Math.min(p.s + p.v * dt, p.sStop)
        at(p.path, p.s, A)
        p.x = A.x; p.y = A.y
      }
      face(p, px, py, dt)
    }
    // a back with no route stays in and helps
    if (!T.RB.path) { T.RB.x = lerp(T.RB.x0, lerp(T.RB.x0, T.BX, 0.5), drop); T.RB.y = lerp(-42, -33, drop) }
    // the seven in space
    const runner = res?.runner ?? null
    for (const d of T.back) {
      if (res?.tdAt != null && g.t >= res.tdAt - 180) continue
      const px = d.x, py = d.y
      let ax = d.x, ay = d.y, spd = d.v
      const b = g.ball
      // (the ball's gone, or the play's over: he's turned and running at it)
      if (d.flip == null && (runner || (b && d.drive && g.t >= d.drive))) d.flip = rt
      if (tk && tk.by === d) {
        if (g.t < tk.at) {
          // his angle, at full speed, to where they meet
          const dx = runner.x - d.x, dy = tk.y - d.y, e = Math.hypot(dx, dy)
          if (e > 0.5) { const mv = Math.min(e, Math.max(TACKLE_V * dt, (e / Math.max(1, tk.at - g.t)) * dt)); d.x += (dx / e) * mv; d.y += (dy / e) * mv }
        } else {
          // arms round him: he's on his back hip and they go together
          d.x = lerp(d.x, runner.x + tk.side * 4, 0.16); d.y = lerp(d.y, runner.y - 3, 0.16)
        }
        face(d, px, py, dt)
        continue
      }
      if (runner) {
        // the rest pursue, and pull up at the pile
        ax = runner.x; ay = runner.y - 6; spd = tk && g.t >= tk.at ? 0.05 : 0.08
        if (Math.hypot(ax - d.x, ay - d.y) < 24) { ax = d.x; ay = d.y }
      }
      // (the pick: he takes it back the other way, then stops to show it off)
      else if (over && res?.why === 'pick' && res.dq === d) { ax = d.x; ay = g.t < res.at + PICK_RUN ? Math.max(-20, d.y - 60) : d.y; spd = 0.085 }
      else if (b && d.drive && g.t >= d.drive && !over) { ax = b.lx; ay = b.ly; spd = d.v * 0.94 }
      else if (d.mark) {
        const m = d.mark
        if (d.flip == null) {
          // the pedal: eyes on the QB, keeping his cushion, square to the man, until he has to turn
          ax = m.x; ay = m.y + 30; spd = PEDAL_V
          if (d.y - m.y < FLIP_GAP || rt > FLIP_MS || Math.abs(m.x - d.x) > 34) { d.flip = rt; d.aimX = d.x; d.aimY = d.y }
        } else {
          // the hips have turned: now he's in the man's hip pocket, on the side the throw comes from
          const bt = d.beat && rt >= d.beat.at && rt < d.beat.until ? d.beat : null
          const sp = Math.hypot(m.vx ?? 0, m.vy ?? 0) || 1, ux = (m.vx ?? 0) / sp, uy = (m.vy ?? 0) / sp
          const lx = (m.x < 180 ? 1 : -1) * LEV * Math.abs(uy), ly = -LEV * 0.9 * Math.abs(ux)
          const kk = 1 - Math.exp(-dt / (bt ? bt.tau : TRAIL_TAU))
          d.aimX += (m.x + lx - d.aimX) * kk
          d.aimY += (m.y + ly - d.aimY) * kk
          ax = d.aimX; ay = d.aimY
          spd = d.v * (bt ? bt.f : 1) * lerp(0.45, 1, prog(rt, d.flip, d.flip + TURN_MS))
        }
      } else if (d.deep) {
        // over the top of the deepest man in his half. Looked off, he's not looking at the man who's beating it.
        const sold = rt < d.lookedOff
        let top = null
        for (const p of T.backs) {
          if (p === T.RB || (sold && p === T.free)) continue
          if (d.half && (p.x - 180) * d.half < -40) continue
          if (!top || p.y > top.y) top = p
        }
        ay = top ? Math.max(d.y0 + 24, top.y + 40) : d.y0 + 46
        ax = top ? lerp(d.x0, top.x, 0.72) : d.x0
        if (sold) {
          if (!d.half && T.freeMid) ax = d.x0 + T.freeMid * 92
          else if (!d.half && top && (top.x - 180) * (T.free.x - 180) > 0) ax = d.x0
          // the man who's beating it is on his side: he's been pulled to the middle by the seam
          if (d.half && (T.free.x - 180) * d.half > 0) ax = lerp(d.x0, 180, 0.85)
        }
        if (d.flip == null && top && top.y > d.y - 34) d.flip = rt
        spd = d.flip == null ? Math.max(PEDAL_V, d.v * 0.8) : d.v
      } else if (d.spot) {
        // sold on something else for a while; then back where he belongs (a bot reads d.spot too: where he's going)
        const sold = rt < d.lookedOff
        d.spot = sold ? d.soldOn : d.spot0
        ax = d.spot[0]; ay = d.spot[1]
        if (d.third) {
          // a deep third: he bails, and carries whatever comes up the seam of it, staying on top
          let top = null
          for (const p of T.backs) {
            if (p === T.RB || (rt < T.shutAt && p === T.free) || Math.abs(p.x - d.spot[0]) > 92) continue
            if (!top || p.y > top.y) top = p
          }
          if (top) { ax = lerp(ax, top.x, 0.8); ay = Math.max(ay, top.y + 26) }
          if (d.flip == null && top && top.y > d.y - 40) d.flip = rt
          spd = d.flip == null ? Math.max(PEDAL_V, d.v * 0.8) : d.v
        } else {
          // underneath: drop to the spot, wall off whoever comes through it, on the QB's side of him
          let near = null, nd = 80
          for (const p of T.backs) {
            // (one man on him is enough: he leaves a man another defender already has)
            if ((rt < T.shutAt && p === T.free) || T.back.some(q => q !== d && (q.mark === p || (q.wall === p && q.id < d.id)))) continue
            const e = Math.hypot(p.x - d.spot[0], p.y - d.spot[1])
            if (e < nd) { nd = e; near = p }
          }
          d.wall = near
          if (near) { ax = lerp(ax, near.x, 0.64); ay = lerp(ay, near.y - 5, 0.64) }
          // and he reads the QB's eyes: a long hold on one spot draws him to it
          if (g.hold && Math.hypot(g.hold.fx - d.x, g.hold.fy - d.y) < 120) { ax = lerp(ax, g.hold.fx, 0.25); ay = lerp(ay, g.hold.fy, 0.25) }
          spd = d.v * 0.95
        }
      }
      const dx = ax - d.x, dy = ay - d.y, e = Math.hypot(dx, dy)
      const go = (over && !runner && res?.dq !== d ? slow : 1) * spd * dt
      if (e > 0.5) { const mv = Math.min(e, go); d.x += (dx / e) * mv; d.y += (dy / e) * mv }
      // nobody runs through anybody: he goes round them, a little a frame, so it never shows as a jump
      // (standing men are tall on the screen: off a man means beside him, not just behind him, until the ball's there)
      const contest = b && d.drive && g.t >= d.drive
      const rx = d.x, ry = d.y
      for (const q of T.back) if (q !== d) room(d, q.x, q.y, 19, 0.34)
      for (const p of T.backs) {
        if (contest || Math.abs(d.y - p.y) > 24) room(d, p.x, p.y, ROOM, 0.16)
        else if (Math.abs(d.x - p.x) < 17) d.x += (d.x < p.x || (d.x === p.x && d.x > 180) ? -1 : 1) * Math.min(0.26, (17 - Math.abs(d.x - p.x)) * 0.2)
      }
      const pushed = Math.hypot(d.x - rx, d.y - ry)
      if (pushed > 0.3) { d.x = rx + ((d.x - rx) / pushed) * 0.3; d.y = ry + ((d.y - ry) / pushed) * 0.3 }
      face(d, px, py, dt)
    }
  }
  function room(d, x, y, min, cap) {
    const dx = d.x - x, dy = d.y - y, e = Math.hypot(dx, dy)
    if (e >= min || e < 0.01) return
    const mv = Math.min(cap, (min - e) * 0.2)
    d.x += (dx / e) * mv; d.y += (dy / e) * mv
  }
  return g
}
function face(p, px, py, dt) {
  const vx = (p.x - px) / dt, vy = (p.y - py) / dt, sp = Math.hypot(vx, vy)
  p.vx = vx; p.vy = vy
  p.run = (p.run ?? 0) + sp * dt   // how far he's come: what his feet go by
  p.spd = lerp(p.spd, sp, 0.25)
  if (sp > 0.012) {
    const want = Math.atan2(vx, vy)
    let d = want - p.face
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    p.face += d * 0.14
  }
}

// ── The combine: a QB, receivers, cones ─────────────────────────────────────────────────────────
const ACC_ROUTES = [
  { name: 'SLANT', pts: [[64, 0], [64, 46], [344, 300]], v: 0.066, q: 0.94, read: 400 },
  { name: 'OUT', pts: [[110, 0], [110, 132], [14, 132]], v: 0.072, q: 0.98, read: 700 },
  { name: 'POST', pts: [[60, 0], [60, 132], [270, 300]], v: 0.078, q: 1.03, read: 800 },
  { name: 'GO', pts: [[42, 0], [42, 900]], v: 0.084, q: 1.08, read: 800 },
]
const ACC_SET = 600, ACC_POST = 620
export const accReach = v => 31 + 26 * curve(v, 1.1)
function makeAcc({ v, arm, seed, game }) {
  const r = rngOf(seed)
  const reach = accReach(v), scat = scatterOf(v)
  const reps = ACC_ROUTES.map(R => {
    const m = r() < 0.5
    const pts = m ? R.pts.map(([x, y]) => [360 - x, y]) : R.pts
    const path = mkPath(pts)
    let sStop = 0
    while (sStop < 1000) { at(path, sStop, A); if (A.y > 480 || A.x < 14 || A.x > 346) break; sStop += 3 }
    return { ...R, path, m, x: pts[0][0], y: 0, s: 0, sStop, snap: 0, ball: null, res: null, face: 0, spd: 0, ux: 0, uy: 1 }
  })
  const los0 = losOf(DEF_H)
  const g = {
    t: 0, game, zones: 'none', aim: true, fx: [], done: null, outro: 1300, stamp: null, acc: true,
    flair: flairOf(seed), nudge: nudge(), dirt: particles(24, flairOf(seed) + 3),
    phase: 'set', reps, rep: reps[0], i: 0, made: 0, sum: 0, outs: 0, reach, scat, TOP, hold: null,
    QB: { x: 180, y: -36 }, los: los0, k: kOf(los0, TOP), cam: { w: 360, h: DEF_H },
    hud: { prompt: 'PRESS WHERE THE BALL GOES', dots: reps.map(() => null) },
    project(p, ms, o = {}) { const s = Math.min(p.s + p.v * ms, p.sStop); at(p.path, s, A); o.x = A.x; o.y = A.y; return o },
    airTo(x, y, pw) { return flightOf(game, arm, Math.hypot(x - g.QB.x, y - g.QB.y), pw) },
    screenOf(fx, fy) { return tilt(g.cam, fx, g.los - fy * g.k) },
    power() { return g.hold ? clamp((g.t - g.hold.at) / HOLD_MS, 0, 1) : 0 },
    tick(dt) {
      g.t += dt
      const rep = g.rep
      if (g.phase === 'set') { if (g.t >= rep.snap) { g.phase = 'run'; g.hud.prompt = 'PRESS WHERE THE BALL GOES'; g.fx.push('tap') } return }
      if (g.phase === 'next') { if (g.t >= g.nextAt) { g.i++; start(reps[g.i], g.t) } moveOn(rep, dt); return }
      moveOn(rep, dt)
      if (g.phase === 'run' && g.hold && g.t - g.hold.at >= HOLD_MS) letGo()
      if (g.phase === 'run' && rep.s >= rep.sStop - 2) { g.hold = null; settle('none') }
      if (g.phase === 'air' && g.t >= rep.ball.land) settle()
    },
    input(a) {
      if (g.phase !== 'run') return
      if (a.kind === 'down') {
        if (g.hold) return
        const f = aimOf(g, a, [g.rep])
        const m = inRange(g.QB, clamp(f.x, 10, 350), clamp(f.y, -30, TOP), arm)
        g.hold = { fx: m.x, fy: m.y, at: g.t }
        g.hud.prompt = 'LET GO TO THROW'
        g.fx.push('h:light')
        return
      }
      if (a.kind === 'up' && g.hold) letGo()
    },
  }
  function letGo() {
    const rep = g.rep
    const pw = g.power(), h = g.hold
    g.hold = null
    const lx = clamp(h.fx + gaussOf(r) * scat, 6, 354), ly = h.fy + gaussOf(r) * scat
    const d = Math.hypot(lx - g.QB.x, ly - g.QB.y)
    const flight = flightOf(game, arm, d, pw)
    rep.ball = { tx: h.fx, ty: h.fy, lx, ly, pw, d, H: arcOf(d, pw), at: g.t, land: g.t + flight, flight, reach: reach * lerp(1.1, 0.82, pw), trackAt: g.t + flight - Math.min(flight * 0.55, 150) }
    g.phase = 'air'
    g.hud.prompt = null
    g.fx.push('swoosh', pw > 0.8 ? 'h:medium' : 'h:light')
  }
  function moveOn(rep, dt) {
    const px = rep.x, py = rep.y
    const b = rep.ball
    if (rep.res?.ok) { rep.y = Math.min(TOP - 16, rep.y + rep.v * dt) }
    else if (rep.res && rep.off) {
      // the ball's gone: he slows down the way he was going, not back onto his route
      const k = clamp(1 - (g.t - rep.res.at) / 500, 0, 1)
      rep.x += rep.off.x * rep.v * dt * k; rep.y += rep.off.y * rep.v * dt * k
    } else if (!rep.res?.stops) {
      // he runs his route, and only a ball ahead of him brings him off it: he doesn't come back for a short one
      let tracked = false
      if (b && !rep.res && g.t >= b.trackAt) {
        const dx = b.lx - rep.x, dy = b.ly - rep.y, e = Math.hypot(dx, dy)
        if ((dx * rep.ux + dy * rep.uy) > 0 && e > 1.5) {
          const mv = Math.min(e, rep.v * dt)
          rep.x += (dx / e) * mv; rep.y += (dy / e) * mv
          rep.off = { x: dx / e, y: dy / e }
          tracked = true
        }
      }
      if (!tracked) {
        rep.s = Math.min(rep.s + rep.v * dt, rep.sStop)
        at(rep.path, rep.s, A)
        rep.x = A.x; rep.y = A.y; rep.ux = A.ux; rep.uy = A.uy
      }
    }
    face(rep, px, py, dt)
  }
  function start(rep, now) {
    g.rep = rep
    rep.snap = now + ACC_SET
    g.phase = 'set'
    g.hud.prompt = rep.name
  }
  function settle(forced) {
    const rep = g.rep
    const b = rep.ball
    let why = forced ?? 'catch', e = 0
    if (!forced) {
      // on his line, and not behind him: a short ball dies in the grass
      const dx = b.lx - rep.x, dy = b.ly - rep.y
      e = Math.hypot(dx, dy)
      const along = dx * rep.ux + dy * rep.uy, side = Math.abs(dx * rep.uy - dy * rep.ux)
      if (along < -b.reach * 0.55) why = 'under'
      else if (along > b.reach * ARM) why = 'over'
      else if (side > b.reach * 0.85) why = 'wide'
    }
    const ok = why === 'catch'
    const q = ok ? clamp(1 - (e / b.reach) * 0.5, 0.5, 1) : 0
    rep.res = { ok, why, q, at: g.t }
    g.hud.prompt = null
    if (ok) { g.made++; g.sum += q }
    if (why === 'none') g.outs++
    g.hud.dots[g.i] = ok
    g.fx.push(ok ? 'tap' : 'pop', 'h:medium')
    if (g.i + 1 >= reps.length) {
      g.phase = 'over'
      const hit = g.made >= 3
      g.done = outcome(g.sum / reps.length, hit, `${g.made} of ${reps.length} completed`, { made: g.made, of: reps.length }, g.outs > 0 && g.outs >= reps.length - g.made)
      g.stamp = { text: g.made === 4 ? 'PERFECT' : `${g.made} OF 4`, good: hit, at: g.t + 900 }
      g.outro = 2300
    } else { g.phase = 'next'; g.nextAt = g.t + ACC_POST }
  }
  start(reps[0], 0)
  return g
}

// ── Drawing ─────────────────────────────────────────────────────────────────────────────────────
// The grass, to scale: mown in five-yard bands, sidelines, yard lines, a tick every yard at the
// real hashes and the sideline, numbers on their sides where they're painted. y0: where the goal
// line is on the screen; pyd: pixels a yard. One tile, blitted; a stamp for each number.
const tiles = new Map(), nums = new Map()
function grassTile(view, pyd, lines = true) {
  const id = `${view.px}|${pyd.toFixed(3)}|${lines ? 1 : 0}`
  let c = tiles.get(id)
  if (!c) {
    if (typeof document === 'undefined') return null
    if (tiles.size > 8) tiles.clear()
    const H = pyd * 10
    c = document.createElement('canvas')
    c.width = Math.round(view.w * view.px); c.height = Math.round(H * view.px)
    const x = c.getContext('2d', { alpha: false })
    x.scale(view.px, c.height / H)
    x.fillStyle = '#195a31'; x.fillRect(0, 0, view.w, H)
    x.fillStyle = '#237a41'; x.fillRect(SL, 0, SR - SL, pyd * 5)
    x.fillStyle = '#1e6e39'; x.fillRect(SL, pyd * 5, SR - SL, pyd * 5)
    if (lines) {
      x.fillStyle = 'rgba(255,255,255,.72)'
      x.fillRect(SL, 0, SR - SL, 1.8); x.fillRect(SL, pyd * 5, SR - SL, 1.8)
    }
    x.fillStyle = 'rgba(255,255,255,.6)'
    for (let i = 0; i < 10; i++) {
      if (i === 0 || i === 5) continue
      const yy = i * pyd
      x.fillRect(SL + 2, yy, 6, 1.2); x.fillRect(SR - 8, yy, 6, 1.2)
      x.fillRect(HASH_L - 4, yy, 8, 1.2); x.fillRect(HASH_R - 4, yy, 8, 1.2)
    }
    x.fillStyle = 'rgba(255,255,255,.92)'; x.fillRect(SL - 3, 0, 3, H); x.fillRect(SR, 0, 3, H)
    tiles.set(id, c)
  }
  return c
}
function numStamp(view, label, rot) {
  const id = `${label}|${rot}|${view.px}`
  let c = nums.get(id)
  if (!c) {
    if (typeof document === 'undefined') return null
    c = document.createElement('canvas')
    c.width = c.height = Math.ceil(30 * view.px)
    const x = c.getContext('2d')
    x.scale(view.px, view.px)
    x.translate(15, 15); x.rotate(rot)
    text(x, label, 0, 0, { font: DISPLAY, size: 17, track: 3, color: 'rgba(255,255,255,.62)' })
    nums.set(id, c)
  }
  return c
}
export function grass(ctx, view, y0, pyd, endColor, numbers = true, lines = true) {
  const { w, h } = view
  const tile = grassTile(view, pyd, lines)
  if (!tile) return
  const H = pyd * 10
  const off = ((y0 % H) + H) % H
  for (let yy = off - H; yy < h; yy += H) ctx.drawImage(tile, 0, yy, w, H)
  // the end zone and what's past it
  if (y0 > 0) {
    const back = y0 - H
    ctx.fillStyle = '#195a31'; ctx.fillRect(0, 0, w, Math.max(0, back))
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(SL - 3, 0, 3, y0); ctx.fillRect(SR, 0, 3, y0)
    ctx.fillStyle = endColor; ctx.fillRect(SL, back, SR - SL, H)
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(SL, back, SR - SL, H)
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(SL, y0 - 2, SR - SL, 3.5); ctx.fillRect(SL - 3, back - 2, SR - SL + 6, 3)
  }
  if (numbers) for (let n = 10; n <= 90; n += 10) {
    const y = y0 + n * pyd
    if (y < 30 || y > h + 16) continue
    const label = String(n <= 50 ? n : 100 - n)
    const a = numStamp(view, label, Math.PI / 2), b = numStamp(view, label, -Math.PI / 2)
    ctx.drawImage(a, NUM_L - 15, y - 15, 30, 30)
    ctx.drawImage(b, NUM_R - 15, y - 15, 30, 30)
  }
}

// the light version: Reduce Motion, or a machine that can't spare it. No turf, no crowd getting up, no sideline going mad
export const lightFx = () => reduceMotion() || (typeof document !== 'undefined' && document.documentElement.classList.contains('low-power'))
export function draw(ctx, g, view) {
  // (the words land in the backfield: the catch is downfield and stays in sight)
  if (g.stamp && g.stamp.y == null) g.stamp.y = view.h * 0.885
  return g.acc ? drawWorkout(ctx, g, view) : drawBroadcast(ctx, g, view)
}

// ── The broadcast view (third-long, for now): the same flat field and rules, seen through the camera ──
// real numbers on real positions
const NUMS = { QB: 7, RB: 28, X: 11, H: 84, Z: 15, TE: 87, OL0: 71, OL1: 64, OL2: 55, OL3: 66, OL4: 77, DL0: 94, DL1: 97, DL2: 91, DL3: 99, S2: 31, CB0: 24, CB1: 21, N: 32, LB0: 52, LB1: 45, S0: 38, S1: 26 }
const skinIdx = id => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 255; return h }
const O = { color: '', trim: '', pants: null, skin: '', number: null, dir: 'up', step: null, kit: 'pads', carry: false, size: 1, pose: null, fall: 0, fallX: 0, lift: 0 }
// the flat field, whatever its length: apron, turf to scale, end zone, the turf's grain, the coaches' box
export function paintFieldFlat(x, view, ez, pyd, us, numbers = true, lines = true) {
  x.fillStyle = '#123f23'; x.fillRect(-view.w * 0.25, 0, view.w * 1.5, view.h)
  grass(x, view, ez, pyd, us, numbers, lines)
  const H = pyd * 10
  // past the end line there's no more field
  if (ez - H > 0) { x.fillStyle = '#123f23'; x.fillRect(SL - 3, 0, SR - SL + 6, ez - H - 2) }
  if (ez > 0) {
    x.save(); x.beginPath(); x.rect(SL, ez - H, SR - SL, H - 2); x.clip()
    x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 9
    for (let i = -8; i < 20; i++) { x.beginPath(); x.moveTo(i * 34, ez); x.lineTo(i * 34 + 80, ez - H); x.stroke() }
    x.restore()
  }
  if (lines) paintFieldDress(x, view, ez, pyd, SL, SR)
  let seed = 11
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const grain = Math.round(6 * view.h)
  for (let i = 0; i < grain; i++) {
    x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)'
    x.fillRect(-view.w * 0.25 + rnd() * view.w * 1.5, rnd() * view.h, 1 + rnd() * 2.2, 0.8)
  }
  x.fillStyle = 'rgba(245,247,243,.5)'
  for (let y = 0; y < view.h; y += 14) { x.fillRect(-14, y, 2, 8); x.fillRect(view.w + 12, y, 2, 8) }
  x.fillStyle = 'rgba(10,20,14,.5)'; x.fillRect(-view.w * 0.25, 0, view.w * 0.25 - 26, view.h); x.fillRect(view.w + 26, 0, view.w * 0.25, view.h)
}
function paintFlat(x, view, g, c, los, k) {
  paintFieldFlat(x, view, g ? los - GOAL * k : los - 75 * YD * k, YD * k, c.us)
  // the line of scrimmage and the line to gain lie on the grass
  if (g) { x.fillStyle = '#3f86ff'; x.fillRect(SL, los - 1.6, SR - SL, 3.2) }
  if (g?.line) { x.fillStyle = '#f7d64a'; x.fillRect(SL, los - g.line * k - 2, SR - SL, 4) }
}
function groundLine(ctx, view, pts, los, k, top) {
  ctx.beginPath()
  for (let i = 0; i < pts.length; i++) {
    // long segments bend through the camera: walk them. Nobody's route leaves the field.
    const bx = clamp(pts[i][0], SL + 8, SR - 8), by = pts[i][1]
    const yy = Math.min(by, top)
    if (i === 0) { const q = tilt(view, bx, los - yy * k); ctx.moveTo(q.x, q.y); continue }
    const ax = clamp(pts[i - 1][0], SL + 8, SR - 8), ay0 = pts[i - 1][1]
    const ay = Math.min(ay0, top)
    const n = Math.max(1, Math.ceil(Math.abs(yy - ay) / 70))
    for (let j = 1; j <= n; j++) { const f = j / n; const q = tilt(view, lerp(ax, bx, f), los - lerp(ay, yy, f) * k); ctx.lineTo(q.x, q.y) }
  }
}
// a circle lying on the grass: squashed by how much the camera squashes the turf there
export function turfRing(ctx, view, x, y, r) {
  const a = tilt(view, x, y), b = tilt(view, x, y + 1)
  ctx.beginPath(); ctx.ellipse(a.x, a.y, r * a.s, r * Math.max(0.2, b.y - a.y), 0, 0, Math.PI * 2)
  return a
}
// the ring closes on the dot over the hold. Closed, it's gone.
export function drawHoldRing(ctx, view, x, y, pw) {
  const rad = lerp(46, 9, pw)
  turfRing(ctx, view, x, y, rad); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 6; ctx.stroke()
  // yellow: nearly a bullet
  const col = pw >= 0.8 ? '#ffd24a' : '#fff'
  turfRing(ctx, view, x, y, rad); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke()
  turfRing(ctx, view, x, y, 4.5); ctx.fillStyle = col; ctx.fill()
}
// where the ball is at f of its flight: its spot on the grass, how far above it, which way the nose points
// The snap: the ball sits with the center until the play starts (t < 0), then comes back to the QB.
export const SNAP_MS = 170
export const SPIKE_MS = 300   // the ball held up before he spikes it
export function snapBall(ctx, view, x0, y0, x1, y1, t) {
  if (t >= SNAP_MS) return
  const f = t <= 0 ? 0 : t / SNAP_MS, q = tilt(view, lerp(x0, x1, f), lerp(y0, y1, f))
  const z = 1 + (t <= 0 ? 0 : Math.sin(f * Math.PI) * 10 + f * 22)
  airBall(ctx, q.x, q.y - z * q.s, { ang: Math.PI / 2, len: 8.5 * q.s })
}
export function flightAt(view, x0, y0, x1, y1, f, H) {
  const pos = ff => {
    const q = tilt(view, lerp(x0, x1, ff), lerp(y0, y1, ff))
    return { x: q.x, y: q.y - (H * Math.sin(ff * Math.PI) + 32) * q.s, s: q.s }
  }
  const a = pos(f), n = pos(Math.min(1, f + 0.02)), o = pos(Math.max(0, f - 0.02))
  const up = H * Math.sin(f * Math.PI), start = pos(0).s, away = Math.min(1, a.s / start)
  return { gx: lerp(x0, x1, f), gy: lerp(y0, y1, f), lift: (up + 32) * a.s, x: a.x, y: a.y, dx: o.x - a.x, dy: o.y - a.y, ang: Math.atan2(n.y - o.y, n.x - o.x), len: a.s * Math.pow(away, 0.8) * (16 + up * 0.016), axis: [x1 - x0, y0 - y1, H * Math.PI * Math.cos(f * Math.PI)] }
}
function drawAirBall(ctx, air, b, t) {
  // (a rope is a rope: the air it just came through, a short thin line, gone on a lob)
  if (b.pw > 0.55 && air.dx != null) {
    ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = Math.max(1, air.len * 0.16); ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(air.x, air.y); ctx.lineTo(air.x + air.dx * 5, air.y + air.dy * 5); ctx.stroke(); ctx.lineCap = 'butt'
  }
  airBall(ctx, air.x, air.y, { axis: air.axis, len: air.len, spin: ((t - b.at) / 1000) * lerp(4, 6.5, b.pw) })
}
// ── After the snap: the things a play kicks up. All of this is the look: nothing here touches the rules or their rng ──
export const hop = (age, per, high) => Math.abs(Math.sin((age / per) * Math.PI)) * high
// turf off a man's feet. x, y: the field point on the flat picture
export function kickUp(g, view, x, y, n, speed = 1, spread = 1.25) {
  const q = tilt(view, x, y)
  g.dirt.burst('turf', q.x, q.y, g.t, { n, s: q.s, speed, spread })
}
export function puffAt(g, view, x, y, n) {
  const q = tilt(view, x, y)
  g.dirt.burst('dust', q.x, q.y - 2 * q.s, g.t, { n, s: q.s, spread: 1.5 })
}
// the scorer's own, once the ball's spiked. kind: his, from the seed. age: ms since the spike. Writes into a man's options
export function scorerDance(o, kind, age) {
  o.step = null; o.lift = 0
  switch (kind % 4) {
    case 0: o.pose = Math.floor(age / 170) % 2 ? 'griddy-a' : 'griddy-b'; o.step = Math.floor(age / 85) % 4; o.lift = hop(age, 340, 3); break
    case 1: o.pose = 'flex'; o.lift = age < 340 ? hop(age, 340, 16) : 0; break
    case 2: o.pose = 'arms-up'; o.lift = hop(age, 440, 15); break
    default: o.pose = 'point-up'; o.lift = age < 340 ? hop(age, 340, 12) : 0
  }
}
// the man who made the stop: a defender's own
export function stopperDance(o, kind, age) {
  o.step = null; o.lift = 0
  switch (kind % 3) {
    case 0: o.pose = 'flex'; o.lift = age < 300 ? hop(age, 300, 10) : 0; break
    case 1: o.pose = Math.floor(age / 170) % 2 ? 'griddy-a' : 'griddy-b'; o.step = Math.floor(age / 85) % 4; break
    default: o.pose = 'arms-up'; o.lift = hop(age, 420, 12)
  }
}
const LOOK = { color: '', trim: '', pants: '', skin: '', number: null, dir: 'down', step: null, kit: 'plain', carry: false, size: 0.82, pose: null, fall: 0, fallX: 0, lift: 0 }
// a man in stripes: the field judge. Stripes and a cap go on the plain figure
export function official(ctx, view, x, y, pose, step, lift = 0) {
  LOOK.color = '#eceae4'; LOOK.trim = '#eceae4'; LOOK.pants = '#1c1f22'; LOOK.skin = '#a87548'; LOOK.pose = pose; LOOK.step = step; LOOK.lift = lift; LOOK.size = 0.8; LOOK.dir = 'down'
  const q = athlete(ctx, view, x, y, LOOK), k = q.s * 0.8, feet = q.y - lift * k
  ctx.fillStyle = '#16191c'
  for (let i = -1; i <= 1; i++) ctx.fillRect(q.x + i * 3.6 * k - 0.65 * k, feet - 36.5 * k, 1.3 * k, 14 * k)
  ctx.fillRect(q.x - 4 * k, feet - 47.2 * k, 8 * k, 2.8 * k)
}
// the head coach: polo, khakis, cap, headset, the only man here who isn't wearing pads
export function coach(ctx, view, x, y, color, trim, pose, lift = 0) {
  LOOK.color = color; LOOK.trim = trim; LOOK.pants = '#a89a80'; LOOK.skin = '#c09060'; LOOK.pose = pose; LOOK.step = null; LOOK.lift = lift; LOOK.size = 0.86; LOOK.dir = 'down'
  const q = athlete(ctx, view, x, y, LOOK), k = q.s * 0.86, feet = q.y - lift * k
  ctx.fillStyle = color; ctx.fillRect(q.x - 4.4 * k, feet - 47.6 * k, 8.8 * k, 3 * k)
  ctx.fillStyle = '#10151a'; ctx.fillRect(q.x + 3.6 * k, feet - 45 * k, 1.5 * k, 3.4 * k)
}
// pylons on the corners of the end zone, the chains on the sideline: painted once
function pylon(x, view, fx, fy) {
  const q = tilt(view, fx, fy)
  if (!(q.s > 0)) return
  x.fillStyle = '#ff7a1a'; x.fillRect(q.x - 1.3 * q.s, q.y - 10 * q.s, 2.6 * q.s, 10 * q.s)
  x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(q.x + 0.5 * q.s, q.y - 10 * q.s, 0.8 * q.s, 10 * q.s)
}
export function endZonePylons(x, view, goalY, pyd) {
  for (const fy of [goalY, goalY - 10 * pyd]) { pylon(x, view, SL, fy); pylon(x, view, SR, fy) }
}
export function chainStick(x, view, fx, fy, label = null) {
  const q = tilt(view, fx, fy), s = q.s
  if (!(s > 0)) return
  x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(q.x, q.y - 0.6 * s, 7 * s, 1.2 * s)
  x.fillStyle = '#d9d7cf'; x.fillRect(q.x - 0.7 * s, q.y - 27 * s, 1.4 * s, 27 * s)
  x.fillStyle = '#ff7a1a'; x.fillRect(q.x - 4 * s, q.y - 33 * s, 8 * s, 7 * s)
  if (label) text(x, label, q.x, q.y - 29.3 * s, { font: LABEL, size: 7 * s, color: '#10151a' })
}
// the side that's going mad: over the men painted on that sideline, on their toes. Not every man: a real sideline isn't a drill
const KNOTS = [0.2, 0.235, 0.27, 0.4, 0.44, 0.47, 0.62, 0.655, 0.8]
function benchUp(ctx, view, h, side, look, t) {
  O.kit = 'pads'; O.number = null; O.carry = false; O.fall = 0; O.fallX = 0; O.size = 0.72; O.step = null
  O.color = look.color; O.trim = look.trim; O.pants = look.trim
  KNOTS.forEach((f, n) => {
    O.pose = n % 3 === 2 ? 'reach-r' : 'arms-up'; O.lift = hop(t + n * 83, 370 + (n % 3) * 60, 7)
    if (side < 0) { O.skin = skinOf(n * 3); O.dir = 'right'; athlete(ctx, view, -14 - ((n * 7) % 3) * 8, h * f, O) }
    else { O.skin = skinOf(n * 5 + 1); O.dir = 'left'; athlete(ctx, view, view.w + 14 + ((n * 5) % 3) * 8, h * (1.02 - f) - 40, O) }
  })
  O.lift = 0
}
// the camera leans in on what happened, slowly, once there's nothing left to aim at. It never shows past the picture.
function pushIn(ctx, g, view, los, k) {
  const res = g.res, b = g.ball
  // (want: how big the man it's about should be on the screen. A touchdown at the far end comes right up to him.)
  let size = 0, fx = 180, fy = 0, most = 2.3
  if (res?.why === 'sack') { size = 1.5; fx = res.x0; fy = g.QB.y + 12 }
  else if (res?.runner) { size = res.scores ? 1.3 : 1; fx = res.runner.x; fy = res.runner.y }
  else if (res?.why === 'pick') { size = 1.75; fx = res.dq.x; fy = res.dq.y }
  else if (res) { size = 0.82; fx = res.x; fy = res.y }
  else if (b && b.d > 28 * YD) { size = 0.7; fx = b.lx; fy = b.ly; most = 1.22 }   // (a long one in the air: a lean, the ball still has to come into it)
  leanIn(ctx, g, view, fx, los - fy * k, size, most)
}
export function leanIn(ctx, g, view, x, y, size, most = 2.3, at = 0.46) {
  const dt = Math.max(0, g.t - (g.camT ?? g.t))
  g.camT = g.t
  const q = tilt(view, x, y)
  const want = size ? clamp(size / q.s, 1.06, most) : 1
  g.cz = (g.cz ?? 1) + (want - (g.cz ?? 1)) * (1 - Math.exp(-dt / 380))
  if (g.cz < 1.002 || lightFx()) return
  const z = g.cz, e = 1 - Math.exp(-dt / 220), my = q.y - 22 * q.s
  g.cfx = g.cfx == null ? q.x : lerp(g.cfx, q.x, e); g.cfy = g.cfy == null ? my : lerp(g.cfy, my, e)
  ctx.translate(clamp(view.w / 2 - g.cfx * z, view.w * (1 - z), 0), clamp(view.h * at - g.cfy * z, view.h * (1 - z), 0))
  ctx.scale(z, z)
}
// a dead ball: it hits the turf and kicks, end over end, and stops
export function looseBall(ctx, view, x, y, age, hard) {
  const f = clamp(age / 460, 0, 1)
  const sx = x < 180 ? 1 : -1
  const gx = x + sx * f * (hard ? 40 : 18), gy = y + f * (hard ? 30 : 9)
  const q = ballShadow(ctx, view, gx, gy, 0)
  const drop = age < 170 ? 32 * (1 - age / 170) : 0
  const kick = age < 170 ? 0 : Math.sin(prog(age, 170, 460) * Math.PI) * (hard ? 14 : 6)
  airBall(ctx, q.x, q.y - (3 + drop + kick) * q.s, { ang: f < 1 ? age / 70 : 1.2, len: 12 * q.s })
}
// the QB's arm: held is how far through the hold (null: not holding), age how long since it left (<0: hasn't)
export function qbPose(held, age) {
  if (age >= 0) return age < 150 ? 'qb-rel' : age < 460 ? 'qb-follow' : null
  if (held != null) return held < 0.1 ? 'qb-hold' : 'qb-cock'
  return null
}
// a man's hands going up for the ball: off to the side it's coming down on. Near it, both; a stretch, one.
export function handsFor(ballX, manX, near) {
  return `${near ? 'catch' : 'reach'}-${ballX < manX ? 'l' : 'r'}`
}
function drawBroadcast(ctx, g, view) {
  const { h } = view
  const c = view.colors, them = themOf(view)
  const los = losOf(h), k = kOf(los, g.TOP)
  g.los = los; g.k = k; g.cam = view
  ctx.save()
  pushIn(ctx, g, view, los, k)
  // the camera doesn't move on this one, so the crowd and the field are one painted picture
  layer(ctx, view, `broadcast|${g.game}|${c.us}|${them.color}`, x => {
    stands(x, view, 'field', [c.us, c.trim])
    const hy = tilt(view, 0, 0).y
    ground(x, view, f => paintFlat(f, view, g, c, los, k), `flat|${g.game}|${c.us}`, 0, Math.round((h - hy) * view.px * 0.7))
    goalPosts(x, view, view.field?.backY)
    floodlight(x, view)
    endZonePylons(x, view, los - GOAL * k, YD * k)
    chainStick(x, view, SR + 5, los, '3')
    if (g.line) chainStick(x, view, SR + 5, los - g.line * k)
    // the benches: both teams, standing along their sidelines
    // (in knots, the way a sideline stands: not a fence)
    KNOTS.forEach((f, n) => {
      const fy = h * f
      O.pose = 'ready'; O.step = null; O.carry = false; O.fall = 0; O.fallX = 0; O.lift = 0; O.size = 0.72; O.kit = 'pads'; O.number = null; O.dir = 'right'   // (each sideline watches the field)
      O.color = c.us; O.trim = c.trim; O.pants = c.trim; O.skin = skinOf(n * 3)
      athlete(x, view, -14 - ((n * 7) % 3) * 8, fy, O)
      O.color = them.color; O.trim = them.trim; O.pants = them.trim; O.skin = skinOf(n * 5 + 1); O.dir = 'left'
      athlete(x, view, view.w + 14 + ((n * 5) % 3) * 8, h * (1.02 - f) - 40, O)
    })
  })
  const b = g.ball, res = g.res
  const fl = fy => los - fy * k
  // (called from the first frame: the moment itself costs nothing)
  const lite = lightFx()
  if (!lite) crowdPop(ctx, view, g.popTeam ?? (g.popTeam = [c.us, c.trim]), g.t - (g.popAt ?? -1e9), { ms: g.popMs ?? 1500, power: g.popP ?? 1 })

  // the routes, on the grass
  if (!b && !res) {
    ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'
    for (const p of g.backs) { groundLine(ctx, view, p.path.pts, los, k, g.TOP - 12, p.sStop); ctx.stroke() }
  }
  // the press: a dot and a ring closing, flat on the turf
  if (g.hold) drawHoldRing(ctx, view, g.hold.fx, fl(g.hold.fy), g.power())
  // where the ball's coming down, and its shadow on the way
  let air = null
  if (b && !res) {
    turfRing(ctx, view, b.tx, fl(b.ty), 7); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.stroke()
    air = flightAt(view, b.x0, fl(b.y0), b.lx, fl(b.ly), prog(g.t, b.at, b.land), b.H * k)
    ballShadow(ctx, view, air.gx, air.gy, air.lift)
  }

  // everyone, back to front
  const crowd = g.crowd ?? (g.crowd = [...g.def, ...g.off])
  crowd.sort((p, q) => q.y - p.y)
  const moving = g.phase !== 'set'
  const rt = g.t - g.snap
  const tk = res?.tackle
  // going down together: from the wrap until they're flat. The tackler is drawn right after his man, on top.
  const sack = res?.why === 'sack'
  const fallAt = tk ? tk.at + 100 : sack ? res.at + 60 : Infinity
  const fall0 = clamp((g.t - fallAt) / 320, 0, 1)
  const under = tk ? res.runner : sack ? g.QB : null
  const onTop = tk?.by ?? (sack ? res.by : null)
  const fallX = sack ? res.side : 0
  // what came of it, and the moment it's plain to see. mood: td, first, short, or how the ball died
  const mood = !g.done ? null : res?.why === 'catch' ? (g.done.hit ? (res.scores ? 'td' : 'first') : 'short') : res?.why ?? null
  const afterAt = !res ? Infinity : res.afterAt ?? res.at
  const after = g.t - afterAt
  // back on their feet: the tackler first (he's made his play, or he's beaten), and a man with a first down right after him
  const upAt = tk ? tk.done + 240 : sack ? res.at + TACKLE_MS + SACK_UP : Infinity
  const risen = clamp((g.t - upAt) / 260, 0, 1)
  const fall = fall0 * (1 - risen)
  const manRisen = mood === 'first' || (mood === 'td' && tk) ? clamp((g.t - upAt - 160) / 260, 0, 1) : 0
  const fallMan = fall0 * (1 - manRisen)
  beats(g, view, los, k, res, tk, b, rt, sack)
  // the man who was on him when he caught it (the nearest defender, picked once): he's not having it
  if (res?.why === 'catch' && res.cover === undefined) {
    let best = null, bd = Infinity
    for (const p of crowd) if (p.side === 'd' && p.kind !== 'dl' && p !== onTop) { const d = Math.hypot(p.x - res.who.x, p.y - res.who.y); if (d < bd) { bd = d; best = p } }
    res.cover = bd < 140 ? best : null
    // a catch in traffic, over him, and he's the one who brings him straight down: some of the time he tells the
    // ref it hit the ground (cope). Anything else, he just takes it: hands on hips or on his helmet, never a celebration
    res.cope = bd < 34 && ((Math.floor(res.at) >> 3) % 2) === 0
  }
  for (let i = 0; i < crowd.length; i++) {
    const p = crowd[i]
    if (p === onTop) continue
    drawMan(p)
    if (p === under && onTop) drawMan(onTop)
  }
  function drawMan(p) {
    const isD = p.side === 'd'
    const line = p.kind === 'dl' || p.id.startsWith('OL')
    O.color = isD ? them.color : c.us
    O.trim = isD ? them.trim : c.trim
    O.pants = isD ? them.trim : c.trim
    O.skin = skinFor(p)
    O.number = numFor(p)
    O.size = line ? 0.94 : p.id === 'QB' ? 0.9 : 0.86
    O.kit = 'pads'; O.pose = null; O.fall = 0; O.fallX = 0; O.carry = false; O.step = null; O.lift = 0
    if (line) {
      // the trenches: heads down, hands on each other. The ends get round the edge and run.
      const free = p.kind === 'dl' && (p.id === 'DL0' || p.id === 'DL3') && rt > 500
      O.dir = isD ? 'down' : 'up'
      // (once the ball's gone the man on the edge pulls up: he's not running on the spot)
      const beat = free && res && (sack ? false : g.t >= res.at + 200)
      if (beat) { O.pose = 'ready'; O.dir = 'down' }
      else if (free) { O.dir = dirOf(p.x < g.QB.x ? 1 : -1, 1); O.step = Math.floor(rt / 110) % 4 }
      else O.pose = moving ? 'block' : 'stance'
      // the big men's turn: the line gets to the end zone in its head; a sack, the rest of the front's up
      if (!isD && mood === 'td' && after > 120) { O.pose = 'arms-up'; O.lift = hop(after + p.x * 3, 470, 7) }
      if (!isD && mood === 'first' && after > 200) O.pose = 'ready'
      if (isD && sack && p !== res.by && g.t >= res.at + 480) { O.dir = 'down'; O.step = null; O.pose = 'arms-up'; O.lift = hop(g.t - res.at + p.x * 3, 430, 9) }
    } else if (p === g.QB) {
      const arm = sack ? null : qbPose(g.hold ? g.power() : null, b ? g.t - b.at : -1)
      O.dir = 'up'
      O.carry = !b && rt >= SNAP_MS
      if (arm) {
        // side on to throw, shoulder to his target
        O.pose = arm
        O.dir = (g.hold ? g.hold.fx : b.lx) < p.x ? 'left' : 'right'
        O.carry = arm === 'qb-hold'
      } else if (!sack && !b && rt >= SNAP_MS) {
        // the drop, then set with the ball at his shoulder (the picture only: T.QB moves him, as it always has)
        const st = qbStance(rt - SNAP_MS)
        O.pose = st.pose; O.step = st.step; O.carry = false
      }
      if (sack) { O.fall = fall0; O.fallX = fallX }   // (he stays down a while)
      // and how he takes it
      else if (mood === 'td' && after > 60) { O.dir = 'up'; O.step = null; O.carry = false; O.pose = 'arms-up'; O.lift = hop(after, 450, 13) }
      else if (mood === 'first' && after > 60) { O.dir = 'up'; O.step = null; O.carry = false; O.pose = 'reach-r'; O.lift = after < 300 ? hop(after, 300, 8) : 0 }
      else if (mood === 'pick' && after > 420) { O.dir = 'up'; O.step = null; O.carry = false; O.pose = 'hands-head' }
      else if (mood && mood !== 'td' && mood !== 'first' && after > 520) { O.dir = 'up'; O.step = null; O.carry = false; O.pose = 'hips' }
    } else {
      const sp = p.spd ?? 0
      if (moving && sp > 0.015) {
        const want = dirOf(p.vx ?? 0, -(p.vy ?? 0))
        // a man in coverage keeps his eyes on the QB until his hips turn and he runs
        p.dir = isD && p.flip == null ? 'down' : want
        O.step = Math.floor((p.run ?? 0) / 7) % 4
      } else if (!p.dir) p.dir = isD ? 'down' : 'up'
      O.dir = p.dir
      if (!moving) { O.pose = 'ready'; O.dir = isD ? 'down' : 'up' }
      if (res?.who === p && res.why === 'catch') O.carry = true
      if (res?.why === 'pick' && res.dq === p) O.carry = true
      // the hands: the man it's for goes up for it; whoever's contesting gets his up too
      if (b && g.t >= b.land - 190 && g.t < b.land + 100 && res?.why !== 'catch' && !(res?.why === 'pick' && res.dq === p)) {
        if (b.target === p) {
          O.pose = handsFor(b.lx, p.x, Math.hypot(b.lx - p.x, b.ly - p.y) < 22); O.dir = p.dir === 'down' ? 'down' : 'up'
        } else if (res?.dq === p && (res.why === 'swat' || res.why === 'bat')) {
          O.pose = b.lx < p.x ? 'swipe-l' : 'swipe-r'; O.dir = 'down'
        } else if (res?.dq === p && res.why === 'pick') {
          O.pose = handsFor(b.lx, p.x, true); O.dir = 'down'
        }
      }
      // the man who broke it up tells everyone it's incomplete
      if (res?.dq === p && res.why === 'swat' && g.t >= res.at + 420) { O.dir = 'down'; O.step = null; O.pose = breakupPose(g.t - res.at - 420, Math.floor(res.at)) }
      // the man who took it away: he shows everyone the ball. The rest of them get excited about it.
      if (res?.why === 'pick' && res.dq === p && g.t >= res.at + PICK_RUN) { O.dir = 'down'; O.step = null; O.pose = 'spike-up'; O.carry = true; O.lift = hop(g.t - res.at - PICK_RUN, 430, 11) }
      else if (mood === 'pick' && isD && after > 620 && Math.hypot(p.x - res.dq.x, p.y - res.dq.y) < 150) { O.dir = 'down'; O.step = null; O.pose = 'arms-up'; O.lift = hop(after + p.x * 3, 450, 9) }
      // the man the ball was for
      if (!isD && res?.who === p) {
        if (mood === 'pick' && after > 360) { O.dir = 'up'; O.step = null; O.pose = 'hands-head' }
        else if ((mood === 'over' || mood === 'under' || mood === 'wide') && after > 320) { O.dir = 'down'; O.step = null; O.pose = Math.floor(res.at) % 2 ? 'wave-a' : 'hips' }
        else if ((mood === 'swat' || mood === 'bat') && after > 420) { O.dir = 'up'; O.step = null; O.pose = 'hips' }
      }
      // a touchdown: ball up, and down it goes, and then it's his moment
      if (res?.tdAt != null && res.runner === p && g.t >= res.tdAt) {
        O.dir = 'up'; O.step = null; const a = g.t - res.tdAt
        O.pose = a < SPIKE_MS ? 'spike-up' : null; O.carry = a < SPIKE_MS
        if (a >= SPIKE_MS + 240) { O.dir = 'down'; scorerDance(O, g.flair, a - SPIKE_MS - 240) }
      }
      // his mates, when they get there. The defense stops where it is, and it's seen this before.
      if (mood === 'td' && !isD && res.runner !== p && res.tdAt != null && g.t >= res.tdAt && Math.hypot(p.x - res.runner.x, p.y - res.runner.y) < CLOSE + 8) { O.dir = 'down'; O.step = null; O.pose = 'arms-up'; O.lift = hop(g.t + p.x * 7, 440, 12) }
      if (mood === 'td' && isD && res.tdAt != null && g.t >= res.tdAt + 80) { O.dir = 'up'; O.step = null; O.pose = 'hips' }   // (scored on: hands on hips, never up)
      // the man he beat, once the catch is made and he's not the one bringing him down
      if (isD && res?.cover === p && p !== onTop && mood && g.t >= res.at + 520) {
        O.dir = 'down'; O.step = null; O.carry = false
        O.pose = 'hips'   // (beaten: hands on his hips, never up)
      }
      if (tk && res.runner === p) {
        O.dir = 'up'
        if (g.t >= tk.at) {
          O.fall = fallMan; O.fallX = 0; if (fall0 > 0) O.step = null
          // up, and tells the whole stadium which way it's going
          if (manRisen >= 1 && mood === 'first') { O.dir = 'down'; O.pose = p.x < 180 ? 'point-r' : 'point-l'; O.lift = hop(g.t - upAt - 420, 500, 5) * (g.t - upAt < 1000 ? 1 : 0) }
          else if (manRisen >= 1) { O.dir = 'down'; O.pose = 'arms-up'; O.lift = hop(g.t - upAt, 440, 13) }
        }
      }
    }
    // the man with his arms round him: square to him, and down the same way
    if (p === onTop && (tk ? g.t >= tk.at : true)) {
      const dx = under.x - p.x, dy = under.y - p.y
      O.dir = Math.abs(dx) > Math.abs(dy) * 1.4 ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'down' : 'up'
      O.pose = 'wrap'; O.step = null; O.fall = fall; O.fallX = fallX
      if (risen >= 1) {
        O.dir = 'down'; O.fall = 0; O.fallX = 0
        // he made the stop: he knows it. He gave up the first down: he's blowing. The catch was made over him and he
        // put him straight down: he's telling the ref it was incomplete
        if (res?.cope && res.cover === p && mood !== 'td') O.pose = breakupPose(g.t - upAt, 1)
        else if (sack || mood === 'short') stopperDance(O, g.flair, g.t - upAt - 260)
        else O.pose = 'hips'
      }
    }
    // (a hit shoves them both a step the way he came from)
    const jolt = tk && (p === under || p === onTop) ? tk.side * -6 * Math.max(0, 1 - (g.t - tk.at) / 170) * (g.t >= tk.at ? 1 : 0) : 0
    athlete(ctx, view, p.x + jolt, fl(p.y), O)
    // his name goes down with him, so a man nearer the camera stands in front of it. The line's are
    // smaller, and step down every other man so five of them side by side still read.
    if (p.look && !((p === under && (sack ? fall0 : fallMan) > 0) || (p === onTop && fall > 0))) {
      const q = tilt(view, p.x, fl(p.y)), line = p.id.startsWith('OL') || p.kind === 'dl'
      // (on a small canvas the linemen's names only cover the numbers: skill players keep theirs)
      // (once it's over and they're up, every man's name, the line's too)
      if (!(line && view.px < 1.6 && !(g.done && after > 900))) nameTag(ctx, view, q.x, q.y + (line && p.lo ? 7.5 * q.s : 0), p.look.name, line ? 0.72 : Math.max(0.8, q.s * 0.86))
    }
  }
  // loose ball
  snapBall(ctx, view, g.OL[2].x, fl(g.OL[2].y), g.QB.x, fl(g.QB.y), rt)
  if (res?.tdAt != null && g.t >= res.tdAt + SPIKE_MS) looseBall(ctx, view, res.runner.x + 6, fl(res.runner.y), g.t - res.tdAt - SPIKE_MS, true)
  if (b && res && res.why !== 'catch' && res.why !== 'pick') {
    const hard = res.why === 'swat' || res.why === 'bat'
    looseBall(ctx, view, b.lx, fl(b.ly), g.t - res.at, hard)
  }
  // the ball in the air, over everyone
  if (air) drawAirBall(ctx, air, b, g.t)
  if (!lightFx()) g.dirt.draw(ctx, g.t)
  // the man in stripes on the sideline: he comes down to the spot and calls it. The head coach beside his bench.
  const ref = res?.runner ?? (res?.dq && res.why === 'pick' ? res.dq : null)
  const refY0 = Math.max(g.line, 18 * YD), refTo = ref ? Math.min(GOAL, ref.y) : res && !sack ? res.y : refY0
  const refGo = res ? easeOut(prog(g.t, res.at + 80, res.at + 1100)) : 0
  const ry = lerp(refY0, refTo, refGo)
  const refSig = mood === 'td' && after > 40 ? 'arms-up' : mood === 'first' && after > 120 ? 'point-l' : (mood === 'over' || mood === 'under' || mood === 'wide' || mood === 'swat' || mood === 'bat') && after > 520 ? (Math.floor(after / 150) % 2 ? 'wave-a' : 'wave-b') : null
  official(ctx, view, SR + 3, fl(ry), refSig, !refSig && refGo > 0 && refGo < 0.98 ? Math.floor(g.t / 95) % 4 : null)
  const coachUp = mood === 'td' ? 'arms-up' : mood === 'first' ? 'reach-r' : mood === 'pick' || sack ? 'hands-head' : mood ? 'hips' : null
  coach(ctx, view, SL - 7, fl(3.5 * YD), c.us, c.trim, after > 160 ? coachUp : null, mood === 'td' && after > 160 ? hop(after, 470, 11) : 0)
  // the sidelines: whoever this is good for
  if (!lite && (mood === 'td' || mood === 'first') && after > 100) benchUp(ctx, view, h, -1, { color: c.us, trim: c.trim }, after)
  if (!lite && (mood === 'pick' || sack) && after > 240) benchUp(ctx, view, h, 1, them, after)
  ctx.restore()
  vignette(ctx, view)
  // the first look at a play bakes its men, a few a frame, before anyone needs them mid-stride
  if (g.phase === 'set') warmCrowd(g, c, them)
}
// the bowl gets up: how long, and how many of them
export function popCrowd(g, ms, power = 1) { g.popAt = g.t; g.popMs = ms; g.popP = power }
// what the play does to the grass, the camera and the bowl, the frame it happens. Each one once.
function beats(g, view, los, k, res, tk, b, rt, sack) {
  const fl = y => los - y * k
  // the snap: the front four come out of the ground
  if (!g.fxSnap && rt >= 0) { g.fxSnap = true; for (const d of g.DL) kickUp(g, view, d.x, fl(d.y), 3, 0.6) }
  // a long one in the air: they're getting up to see it
  if (b && !res && !g.fxAir && b.d > 30 * YD && g.t >= b.at + b.flight * 0.42) { g.fxAir = true; popCrowd(g, b.flight * 0.58 + 650, 0.6) }
  if (!res) return
  if (!res.fxP) {
    res.fxP = true
    if (res.why === 'catch' && g.done?.hit) popCrowd(g, res.scores ? 4200 : 1900)
    else if (res.why === 'sack') popCrowd(g, 1700)
    else if (res.why === 'pick') popCrowd(g, 2100)
    else if (res.why === 'swat' || res.why === 'bat') popCrowd(g, 1100, 0.6)
  }
  if (res.why === 'catch' && !res.fxC) { res.fxC = true; g.fx.push('catchball'); puffAt(g, view, res.who.x, fl(res.who.y), 2); g.nudge.kick(g.t, 1.4, 0, 1, 130) }
  // a runner's cuts throw it up behind him; a clod now and then as he goes
  const rn = res.runner
  if (rn && rn.hasBall) {
    const going = !(tk && g.t >= tk.at) && !(res.tdAt != null && g.t >= res.tdAt)
    if (going && rn.cutAt != null && rn.cutAt !== g.fxCut) { g.fxCut = rn.cutAt; kickUp(g, view, rn.x, fl(rn.y), 6, 0.9) }
    else if (going && g.t >= (g.fxClod ?? 0)) { g.fxClod = g.t + 190; kickUp(g, view, rn.x, fl(rn.y), 1, 0.5, 0.8) }
  }
  // the hit: he's stopped dead, and everything in the bowl felt it
  if (tk && g.t >= tk.at && !tk.fx) {
    tk.fx = true; g.fx.push('lock')
    kickUp(g, view, rn.x, fl(rn.y), 13, 1.15, 1.45); puffAt(g, view, rn.x, fl(rn.y), 3)
    g.nudge.kick(g.t, 4.2, tk.side * 0.7, 1, 210)
  }
  // they hit the deck
  if (tk && g.t >= tk.at + 340 && !tk.fx2) { tk.fx2 = true; kickUp(g, view, rn.x, fl(rn.y + 8), 6, 0.7, 1.4); puffAt(g, view, rn.x, fl(rn.y + 8), 2) }
  if (sack && !res.fx) {
    res.fx = true; g.fx.push('lock')
    kickUp(g, view, res.x0, fl(res.y0), 14, 1.2, 1.45); puffAt(g, view, res.x0, fl(res.y0), 3)
    g.nudge.kick(g.t, 6, res.side, 0.5, 260)
  }
  if (sack && g.t >= res.at + 340 && !res.fx2) { res.fx2 = true; g.fx.push('whistle'); kickUp(g, view, res.x0 + res.side * 14, fl(res.y0), 7, 0.75, 1.4); puffAt(g, view, res.x0 + res.side * 14, fl(res.y0), 2) }
  // a ball that dies on the grass
  if (b && res.why !== 'catch' && res.why !== 'pick' && res.why !== 'sack' && g.t >= res.at + 170 && !res.fxB) { res.fxB = true; kickUp(g, view, b.lx, fl(b.ly), 4, 0.6); if (res.why === 'swat' || res.why === 'bat') g.nudge.kick(g.t, 1.6, 0, 1, 130) }
  // the spike
  if (res.tdAt != null && g.t >= res.tdAt + SPIKE_MS && !res.fxS) { res.fxS = true; g.fx.push('pop', 'h:medium'); kickUp(g, view, rn.x + 6, fl(rn.y), 8, 1); g.nudge.kick(g.t, 2.4, 0, 1, 160) }
}
// The names go down last, and two that would run together: the nearer man's steps down a line. The list is reused.
const TAGS = []
let tagN = 0
export function startTags() { tagN = 0 }
export function tag(x, y, name, k) {
  const t = TAGS[tagN] ?? (TAGS[tagN] = { x: 0, y: 0, name: '', k: 1, w: 0 })
  t.x = x; t.y = y; t.name = name; t.k = k; t.w = (name.length * 4.1 + 6) * k
  tagN++
}
export function drawTags(ctx, view) {
  for (let i = 1; i < tagN; i++) {
    const t = TAGS[i]
    let j = i - 1
    while (j >= 0 && TAGS[j].y > t.y) { TAGS[j + 1] = TAGS[j]; j-- }
    TAGS[j + 1] = t
  }
  for (let i = 0; i < tagN; i++) {
    const t = TAGS[i]
    for (let j = 0; j < i; j++) {
      const o = TAGS[j]
      if (Math.abs(o.x - t.x) < (o.w + t.w) / 2 - 1 && Math.abs(o.y - t.y) < 8.5 * t.k) t.y = o.y + 8.5 * t.k
    }
    nameTag(ctx, view, t.x, t.y, t.name, t.k)
  }
  tagN = 0
}
const skinFor = p => p.look?.skin ?? skinOf(skinIdx(p.id))
const numFor = p => p.look?.number ?? NUMS[p.id] ?? null
function warmCrowd(g, c, them) {
  g.warmAt = g.warmAt ?? 0
  const list = g.crowd
  if (!list) return
  // the QB's arm and the receivers' hands, so the throw and the catch don't cost a frame when they come
  if (!g.warmPoses) {
    const skin = skinFor(g.QB)
    const us = { color: c.us, trim: c.trim, pants: c.trim, step: null, kit: 'pads' }
    g.warmPoses = ['qb-hold', 'qb-cock', 'qb-rel', 'qb-follow'].map(pose => ({ ...us, skin, number: null, dir: 'side', pose, carry: pose === 'qb-hold' }))
    for (const b of g.backs) for (const pose of ['catch-l', 'catch-r', 'reach-l', 'reach-r']) g.warmPoses.push({ ...us, skin: skinFor(b), number: numFor(b), dir: 'up', pose, carry: false })
    // and what comes after, so the payoff doesn't cost a frame either: the QB's reactions, his bench, the scorer's own dance
    for (const pose of ['arms-up', 'reach-r', 'hands-head', 'hips']) g.warmPoses.push({ ...us, skin, number: numFor(g.QB), dir: 'up', pose, carry: false })
    const dance = ['griddy-a', 'flex', 'arms-up', 'point-up'][g.flair % 4]
    for (const b of g.backs) for (const pose of [dance, 'arms-up', 'hips']) g.warmPoses.push({ ...us, skin: skinFor(b), number: numFor(b), dir: 'down', pose, carry: false })
    for (let n = 0; n < KNOTS.length; n++) {
      g.warmPoses.push({ ...us, number: null, skin: skinOf(n * 3), dir: 'side', pose: n % 3 === 2 ? 'reach-r' : 'arms-up', carry: false })
      g.warmPoses.push({ color: them.color, trim: them.trim, pants: them.trim, step: null, kit: 'pads', number: null, skin: skinOf(n * 5 + 1), dir: 'side', pose: n % 3 === 2 ? 'reach-r' : 'arms-up', carry: false })
    }
  }
  for (let n = 0; n < 4 && g.warmPoses.length; n++) warmAthlete(g.warmPoses.pop())
  warmQb({ color: c.us, trim: c.trim, pants: c.trim, skin: skinFor(g.QB), number: numFor(g.QB), kit: 'pads' })
  if (g.warmAt >= list.length * 12) return
  for (let n = 0; n < 6 && g.warmAt < list.length * 12; n++, g.warmAt++) {
    const p = list[g.warmAt % list.length]
    if (p.kind === 'dl' || p.id.startsWith('OL') || p.id === 'QB') continue
    const isD = p.side === 'd'
    const round = Math.floor(g.warmAt / list.length)
    const dir = round < 4 ? 'up' : round < 8 && isD ? 'down' : 'side'
    warmAthlete({ color: isD ? them.color : c.us, trim: isD ? them.trim : c.trim, pants: isD ? them.trim : c.trim, skin: skinFor(p), number: dir === 'side' ? null : numFor(p), dir, step: round % 4, kit: 'pads', carry: false })
  }
}

function cone(ctx, view, x, y) {
  const p = tilt(view, x, y), s = p.s
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(p.x - 4 * s, p.y + 2 * s, 9 * s, 2.5 * s)
  ctx.fillStyle = '#ff8a2a'
  ctx.beginPath(); ctx.moveTo(p.x, p.y - 9 * s); ctx.lineTo(p.x + 5 * s, p.y + 3 * s); ctx.lineTo(p.x - 5 * s, p.y + 3 * s); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(8,12,16,.82)'; ctx.lineWidth = 0.9; ctx.lineJoin = 'round'; ctx.stroke()
}
// the combine's building: no crowd, no team, steel and a wall with the one word on it
const DRILL_FIELD = { us: '#14324f' }
function paintHall(x, view, hy) {
  const { w, h } = view
  x.fillStyle = '#0f161d'; x.fillRect(0, 0, w, h)
  // the roof steel, the far wall's panels
  x.fillStyle = '#161f28'; x.fillRect(0, 44, w, hy - 44)
  x.fillStyle = 'rgba(0,0,0,.26)'
  for (let i = 0; i < 10; i++) x.fillRect(i * 36 + 16, 44, 2.5, hy - 44)
  x.fillStyle = '#0b1117'; x.fillRect(0, 58, w, 5); x.fillRect(0, hy * 0.52, w, 3)
  // the lights, flat bars on the roof
  x.fillStyle = '#dfe9ef'
  for (const lx of [50, 145, 215, 310]) x.fillRect(lx - 17, 72, 34, 3)
  // the padded wall at the end of the field
  const wh = Math.min(46, (hy - 44) * 0.42)
  x.fillStyle = '#102a44'; x.fillRect(0, hy - wh, w, wh)
  x.fillStyle = '#2f7fb8'; x.fillRect(0, hy - wh, w, 2.5); x.fillRect(0, hy - 4, w, 2)
  for (const f of [0.25, 0.75]) text(x, 'COMBINE', w * f, hy - wh / 2, { font: DISPLAY, size: wh * 0.46, color: 'rgba(255,255,255,.3)', track: 3 })
  // and down each side of the turf
  x.fillStyle = '#0b1b2b'; x.fillRect(0, hy, w, h - hy)
}
// the combine: an empty field, a QB, one receiver running, the others waiting their turn
function drawWorkout(ctx, g, view) {
  const { h } = view
  const c = view.colors
  const los = losOf(h), k = kOf(los, g.TOP)
  g.los = los; g.k = k; g.cam = view
  layer(ctx, view, 'broadcast|acc|hall', x => {
    const hy = tilt(view, 0, 0).y
    paintHall(x, view, hy)
    ground(x, view, f => paintFlat(f, view, g, DRILL_FIELD, los, k), 'flat|acc|hall', 0, Math.round((h - hy) * view.px * 0.7))
    floodlight(x, view)
  })
  const rep = g.rep, b = rep.ball, res = rep.res
  const fl = fy => los - fy * k
  const pts = rep.path.pts
  if (!res) {
    ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'
    groundLine(ctx, view, pts, los, k, g.TOP - 12); ctx.stroke()
  }
  for (let i = 0; i < pts.length - 1; i++) cone(ctx, view, pts[i][0] + (i ? 10 : -12), fl(pts[i][1]))
  if (g.hold) drawHoldRing(ctx, view, g.hold.fx, fl(g.hold.fy), g.power())
  let air = null
  if (b && !res) {
    turfRing(ctx, view, b.tx, fl(b.ty), 7); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.stroke()
    air = flightAt(view, g.QB.x, fl(g.QB.y), b.lx, fl(b.ly), prog(g.t, b.at, b.land), b.H * k)
    ballShadow(ctx, view, air.gx, air.gy, air.lift)
  }
  // the things a rep does to the grass, once each
  if (res?.ok && !res.fxC) { res.fxC = true; g.fx.push('catchball'); kickUp(g, view, rep.x, fl(rep.y), 3, 0.6); g.nudge.kick(g.t, 1.3, 0, 1, 120) }
  if (b && res && !res.ok && g.t >= res.at + 170 && !res.fxB) { res.fxB = true; kickUp(g, view, b.lx, fl(b.ly), 5, 0.7) }
  // the two men with stopwatches who decide all this, off the far hash
  const lastOk = res && g.t >= res.at + 80 ? res : null
  O.kit = 'plain'; O.fall = 0; O.fallX = 0; O.number = null; O.pants = '#a89a80'; O.color = '#20262c'; O.trim = '#20262c'; O.carry = false; O.step = null; O.size = 0.8; O.dir = 'down'; O.lift = 0
  O.skin = skinOf(1); O.pose = lastOk?.ok && lastOk.q > 0.82 ? 'reach-r' : lastOk && !lastOk.ok ? 'hips' : null
  athlete(ctx, view, SR + 8, fl(178), O)
  O.skin = skinOf(4); O.pose = g.done && g.made === 4 ? 'arms-up' : null
  athlete(ctx, view, SR + 11, fl(140), O)
  // the same men as the broadcast view, helmets and all
  O.kit = 'plain'; O.fall = 0; O.fallX = 0; O.pose = null; O.number = null; O.pants = '#20262c'; O.color = '#eef1f4'; O.trim = '#f4efe6'; O.carry = false
  // the ones still to run, off to the side, waiting
  for (let i = g.reps.length - 1; i > g.i; i--) {
    O.skin = skinOf(i * 3); O.step = null; O.dir = 'right'; O.size = 0.78
    athlete(ctx, view, 36 + (i - g.i - 1) * 24, los + 60, O)
  }
  O.skin = skinOf(1); O.size = 0.9; O.dir = 'up'; O.step = null; O.carry = !b; O.number = null
  const qa = qbPose(g.hold ? g.power() : null, b ? g.t - b.at : -1)
  if (qa) { O.pose = qa; O.dir = (g.hold ? g.hold.fx : b.lx) < g.QB.x ? 'left' : 'right'; O.carry = qa === 'qb-hold' }
  else if (!b) { O.pose = 'qb-set'; O.carry = false }   // (a drill: no snap, he's already set)
  else if (res && g.t >= res.at + 120) O.pose = res.ok ? (res.q > 0.82 ? 'reach-r' : null) : 'hips'
  athlete(ctx, view, g.QB.x, fl(g.QB.y), O)
  O.pose = null
  const moving = g.phase !== 'set' && (rep.spd ?? 0) > 0.015
  if (moving) rep.dir = dirOf(rep.vx ?? 0, -(rep.vy ?? 0))
  O.number = 11; O.skin = skinOf(6); O.size = 0.86; O.dir = rep.dir ?? 'up'; O.step = moving ? Math.floor((rep.run ?? 0) / 7) % 4 : null; O.carry = !!res?.ok
  if (b && !res?.ok && g.t >= b.land - 190 && g.t < b.land + 100) { O.pose = handsFor(b.lx, rep.x, Math.hypot(b.lx - rep.x, b.ly - rep.y) < 22); O.dir = 'up' }
  else if (res && !res.ok && g.t >= res.at + 340) { O.pose = 'hips'; O.step = null; O.dir = 'down' }
  const q = athlete(ctx, view, rep.x, fl(rep.y), O)
  if (air) drawAirBall(ctx, air, b, g.t)
  if (b && res && !res.ok) looseBall(ctx, view, b.lx, fl(b.ly), g.t - res.at, false)
  if (!lightFx()) g.dirt.draw(ctx, g.t)
  if (res && g.t - res.at < 660) {
    const word = res.ok ? (res.q > 0.82 ? 'IN STRIDE' : 'COMPLETE') : res.why === 'over' ? 'OVERTHROWN' : res.why === 'under' ? 'UNDERTHROWN' : res.why === 'wide' ? 'WIDE' : 'NO THROW'
    const wx = clamp(q.x, 80, 280), wy = clamp(q.y - 62 * q.s, 74, h)
    text(ctx, word, wx + 1, wy + 1, { font: DISPLAY, size: 24, color: 'rgba(0,0,0,.55)' })
    text(ctx, word, wx, wy, { font: DISPLAY, size: 24, color: res.ok ? '#35e07a' : '#ff5a48' })
  }
  vignette(ctx, view)
}
