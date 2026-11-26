// BLACKTOP LIVE: dribble moves off the one stick. Pure: the screen feeds it the move stick as it goes (t in ms, x and
// y -1..1) and it says when the thumb clearly meant a move. What it hands back is the way of it: which move that is
// stays the game's word (referee.moveOf: the basket, the hand the ball is in, how he's going).
//
// The owner, 11-26: "spin moves trigger too often". A move has to be meant, and steering never makes one. Three
// motions are moves, nothing else is:
//   a tap     the stick out fast (GEST.dist of its reach inside GEST.winMs, out past GEST.out) and back again (to
//             where it started, or the middle, or the thumb off it) inside GEST.retMs. The move goes where it went.
//             From rest: forward a hesitation, back a step-back, a side a move to that side.
//   a snap    holding it out (driving), the stick thrown round to a new way GEST.snapDeg or more off the old one, the
//             whole motion inside GEST.snapMs, and held there: a crossover off a drive, a step-back out of one
//   a roll    the stick rolled round the rim, GEST.rollDeg inside GEST.rollMs (or GEST.rollBack starting from the back:
//             back and around), never in near the middle: the spin, rolled that way
// Steering is slow beside those: pushing out from rest and holding is starting to run, turning round is a turn, letting
// go is letting go. One move at a time (GEST.lockMs before the next).
export const GEST = {
  dist: 0.6,           // a tap or a snap: the stick this far from where it was...
  winMs: 110,          // ...inside this long
  out: 0.6,            // ...and out at least this far
  near: 0.42,          // (a tap all the way out, past full: this far is enough: a hard flick from a light push)
  full: 0.75,
  outMs: 85,           // a tap: all the way out inside this long of leaving...
  retMs: 300,          // ...and back inside this long
  ret: 0.35,           // ...back to within this of where it started, or
  mid: 0.3,            // ...in this near the middle
  snapDeg: 85,         // a snap: round this far from the way it was held...
  snapMs: 75,          // ...the motion inside this long, and landed
  snapFrom: 0.4,       // ...held at least this far out before it
  snapRoll: 120,       // (a snap is a throw, not a roll: one that went round this far or more isn't one)
  still: 0.07,         // landed: a sample this close to the last one
  rollDeg: 215,        // a roll: round this far...
  rollBack: 165,       // ...or this far when it starts in the back half and comes round to the front (back and around)
  rollMs: 300,         // ...inside this long
  rollR: 0.45,         // ...never nearer the middle than this
  rollEnd: 45,         // ms without it turning: the roll is over (and before it's far enough: two turns, not one roll)
  rollSlow: 140,       // deg/s: turning slower than this, it isn't rolling...
  rollGap: 45,         // ...and this long of that before it got round: it was two turns, not one roll
  lockMs: 150,         // after a move, this long before another one
  keep: 600,           // ms of the stick kept
}

const D2R = Math.PI / 180
const unit = (x, y) => { const m = Math.hypot(x, y) || 1; return [x / m, y / m] }
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }
const angBetween = (ax, ay, bx, by) => Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / ((Math.hypot(ax, ay) * Math.hypot(bx, by)) || 1))))

// feed(t, x, y): null, or { kind: 'flick', dir: [x, y] (unit), ms, how: 'tap' | 'snap' } or { kind: 'roll', dir: [x, y]
// (where it ended up), turn (radians, signed: the way it rolled), ms }. release(t): the thumb came off (a tap let go
// out there counts; returns the same or null). reset(): forget it all. aim(x, y): the way to the basket on the stick
// (the back half, for a back-and-around roll)
export function createGesture(o = GEST) {
  const H = []
  let lock = -1e9, cand = null, roll = null, fx = 0, fy = -1
  function reset() { H.length = 0; cand = null; roll = null }
  function aim(x, y) { const m = Math.hypot(x, y); if (m > 0.1) { fx = x / m; fy = y / m } }
  const fire = (t, e) => { lock = t; cand = null; roll = null; return e }
  // a tap's way out: far enough from where it was (or nearly, all the way out), out there, and quick getting there
  function tapped(c) {
    const far = Math.hypot(c.px - c.bx, c.py - c.by)
    if (c.peakR < o.out || !(far >= o.dist || (far >= o.near && c.peakR >= o.full))) return false
    for (const h of H) if (h.t >= c.t0 && Math.hypot(h.x - c.bx, h.y - c.by) >= 0.85 * c.peakD) return h.t - c.t0 <= o.outMs
    return true
  }
  // a tap that went out and the thumb came off before it came back: the tap, as he let go
  function release(t) {
    let e = null
    if (cand && t - cand.t0 <= o.retMs && t - lock >= o.lockMs && !roll?.hit && tapped(cand)) e = { kind: 'flick', dir: unit(cand.px, cand.py), ms: cand.pt - cand.t0, how: 'tap' }
    else if (roll?.hit && t - lock >= o.lockMs) e = { kind: 'roll', dir: unit(H[H.length - 1].x, H[H.length - 1].y), turn: roll.c - (roll.c0 ?? 0), ms: roll.last - roll.t0 }
    if (e) lock = t
    reset()
    return e
  }

  // the roll: how far round the stick has gone (signed), out at the rim, the same way, inside rollMs
  function rollStep(prev, t, x, y, r) {
    const pr = Math.hypot(prev.x, prev.y)
    if (r < o.rollR || pr < o.rollR) { if (roll?.hit) return endRoll(t, prev.x, prev.y); roll = null; return null }
    const da = wrap(Math.atan2(y, x) - Math.atan2(prev.y, prev.x))
    // (a jump of the angle from one sample to the next is the stick going across the middle, not round the rim)
    if (Math.abs(da) > 55 * D2R) { if (roll?.hit) return endRoll(t, prev.x, prev.y); roll = null; return null }
    if (!roll || (Math.abs(da) > 4 * D2R && Math.sign(da) !== roll.sgn && !roll.hit)) {
      roll = Math.abs(da) > 0.5 * D2R ? { sgn: Math.sign(da), pts: [{ t: prev.t, c: 0, a: Math.atan2(prev.y, prev.x) }, { t, c: da, a: Math.atan2(y, x) }], c: da, hit: false, last: t, t0: prev.t } : null
      return null
    }
    if (roll.hit && Math.sign(da) !== roll.sgn && Math.abs(da) > 4 * D2R) return endRoll(t, prev.x, prev.y)
    roll.c += da
    roll.pts.push({ t, c: roll.c, a: Math.atan2(y, x) })
    if (Math.abs(da) > o.rollSlow * D2R * (t - prev.t) / 1000) roll.last = t
    // (it stopped turning before it got round: that was a turn; a roll is one motion)
    if (!roll.hit && t - roll.last >= o.rollGap) { roll = { sgn: Math.sign(da) || 1, pts: [{ t, c: roll.c, a: Math.atan2(y, x) }], c: roll.c, hit: false, last: t, t0: t }; return null }
    if (!roll.hit) {
      // (only the part of it inside rollMs counts: a slow turn never gets there)
      while (roll.pts.length > 2 && t - roll.pts[1].t > o.rollMs) roll.pts.shift()
      const first = roll.pts[0], sweep = Math.abs(roll.c - first.c)
      const fromBack = Math.cos(first.a) * -fx + Math.sin(first.a) * -fy > Math.cos(70 * D2R), toFront = (x * fx + y * fy) / (r || 1) > 0
      if (sweep >= o.rollDeg * D2R || (fromBack && toFront && sweep >= o.rollBack * D2R)) { roll.hit = true; roll.t0 = first.t; roll.c0 = first.c }
    } else if (t - roll.last >= o.rollEnd) return endRoll(t, x, y)
    return null
  }
  function endRoll(t, x, y) {
    const R = roll
    if (!R || !R.hit || t - lock < o.lockMs) { roll = null; return null }
    return fire(t, { kind: 'roll', dir: unit(x, y), turn: R.c - (R.c0 ?? 0), ms: R.last - R.t0 })
  }

  function feed(t, x, y) {
    if (H.length && t < H[H.length - 1].t) reset()
    const prev = H[H.length - 1]
    H.push({ t, x, y })
    while (H.length > 2 && t - H[0].t > o.keep) H.shift()
    const r = Math.hypot(x, y)
    if (prev) { const e = rollStep(prev, t, x, y, r); if (e) return e }
    if (t - lock < o.lockMs) { cand = null; return null }
    if (!cand) {
      // the farthest the stick was from here inside the window (where it was as the window opened counts too)
      let far = null, fd = 0
      for (let i = H.length - 2; i >= 0; i--) {
        const h = H[i], old = t - h.t > o.winMs
        const d = Math.hypot(h.x - x, h.y - y)
        if (d > fd) { fd = d; far = h }
        if (old) break
      }
      if (!far || fd < o.near || far.t < lock) return null
      // (when it left there: the last sample still by it)
      let t0 = far.t
      for (let i = H.length - 2; i >= 0; i--) { const h = H[i]; if (Math.hypot(h.x - far.x, h.y - far.y) <= 0.12) { t0 = h.t; break } }
      cand = { t0, bx: far.x, by: far.y, px: x, py: y, peakD: fd, peakR: r, pt: t, arr: -1 }
    } else {
      const d = Math.hypot(x - cand.bx, y - cand.by)
      if (d > cand.peakD) { cand.peakD = d; cand.px = x; cand.py = y; cand.peakR = r; cand.pt = t }
    }
    const c = cand
    // (a roll that got round far enough is a spin, whatever it does as it ends; one nearly that far is neither)
    const rolled = roll ? Math.abs(roll.c - roll.pts[0].c) : 0
    // back where it started, or to the middle: a tap (if it got out there first), else nothing
    if ((Math.hypot(x - c.bx, y - c.by) <= o.ret || r <= o.mid) && t > c.pt) {
      if (roll?.hit) return endRoll(t, x, y)
      if (tapped(c)) return fire(t, { kind: 'flick', dir: unit(c.px, c.py), ms: c.pt - c.t0, how: 'tap' })
      cand = null; return null
    }
    // landed out there: a snap, if it was held out before and thrown round far enough, quick enough
    if (prev && Math.hypot(prev.x - x, prev.y - y) <= o.still && r >= o.out) {
      if (roll?.hit) return endRoll(t, x, y)
      if (c.arr < 0) c.arr = prev.t
      if (rolled < o.snapRoll * D2R && Math.hypot(c.bx, c.by) >= o.snapFrom && angBetween(c.bx, c.by, x, y) >= o.snapDeg * D2R && c.arr - c.t0 <= o.snapMs) return fire(t, { kind: 'flick', dir: unit(x, y), ms: c.arr - c.t0, how: 'snap' })
    } else c.arr = -1
    if (t - c.t0 > o.retMs) cand = null
    return null
  }
  return { feed, reset, release, aim }
}

// The keyboard: a direction key tapped (down and up again quickly) is the move that way, with the other direction
// keys held at the time (W held and A tapped: up and left); a new key that turns the way he's going hard (a quarter
// turn or more: D held, then A, or W held and D pressed) is the move the new way at once. SHIFT is the spin (the
// screen: engine.js keySpin).
//   down(k, t, before, after): before/after are the stick's way (unit, or [0, 0]) as the key goes down. Returns true
//   when that is a move now (the change of direction). up(k, t, before, after): 'turn', 'tap' or null
export const TAPS = { tapMs: 170, turnDeg: 60 }
export function createTaps(o = TAPS) {
  const down = new Map()            // key -> { t, fired }
  const turnCos = Math.cos(o.turnDeg * Math.PI / 180)
  const turned = (a, b) => Math.hypot(a[0], a[1]) > 0.5 && Math.hypot(b[0], b[1]) > 0.5 && a[0] * b[0] + a[1] * b[1] <= turnCos
  return {
    // a key going down: true when it turns him hard (a move the new way, now)
    down(k, t, before, after) {
      const turn = turned(before, after)
      down.set(k, { t, fired: turn })
      return turn
    },
    // a key coming up: 'turn' when letting it go turns him hard (D and A both held, D let go: he's going left now),
    // 'tap' when it was a quick tap (the move the way it pointed), else null
    up(k, t, before = [0, 0], after = [0, 0]) {
      const d = down.get(k); down.delete(k)
      if (turned(before, after)) return 'turn'
      return d && !d.fired && t - d.t <= o.tapMs ? 'tap' : null
    },
    reset() { down.clear() },
  }
}
