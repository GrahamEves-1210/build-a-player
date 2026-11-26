// BLACKTOP LIVE: dribble moves off the one stick (the owner, 11-25: "trigger more dribble moves with left stick, almost
// any quick motion should trigger it that direction"). Pure: the screen feeds it the move stick as it goes (t in ms,
// x and y -1..1) and it says when the thumb made a quick motion. What it hands back is the way of the flick: which
// move that is stays the game's word (referee.moveOf: the basket and the hand the ball is in), so the moves, the CPU
// and the wire are all as they were.
//
// A move is the stick going a long way fast: inside GEST.winMs it has covered at least GEST.dist of its reach (a
// flick out from rest, a snap sideways, straight across through the middle: the cross back) and it ends out past
// GEST.out. The move goes the way the stick ends up. Plain steering is slow: it never gets that far that fast. Letting
// go (the stick back to the middle) is never a move, and neither is the thumb landing and pushing out at once (it
// has to have been on the stick for GEST.armMs first). One quick motion is one move (GEST.lockMs before the next).
export const GEST = {
  winMs: 120,          // the window...
  dist: 0.55,          // ...and how far the stick has to go in it (of its reach)
  out: 0.5,            // where it has to end up, at least (out from the middle)
  armMs: 110,          // the thumb on the stick this long before a flick from where it landed counts
  lockMs: 140,         // after a move, this long before another one
  still: 0.06,         // the thumb has landed: a sample this close to the last one...
  settleMs: 70,        // ...or this long after the motion was read (the move goes where the stick is then)
  keep: 400,           // ms of the stick kept
}

const unit = (x, y) => { const m = Math.hypot(x, y) || 1; return [x / m, y / m] }

// feed(t, x, y): null, or { kind: 'flick', dir: [x, y] (unit), ms (how long the motion took) }. reset(): the thumb came off
export function createGesture(o = GEST) {
  const H = []
  let t0 = -1, lock = -1e9, pend = null
  function reset() { H.length = 0; t0 = -1; pend = null }
  function feed(t, x, y) {
    if (H.length && t < H[H.length - 1].t) reset()
    if (t0 < 0) t0 = t
    H.push({ t, x, y })
    while (H.length > 2 && t - H[0].t > o.keep) H.shift()
    // a quick motion read, waiting for the thumb to land where it's going (still for a sample, or GEST.settleMs on)
    if (pend) {
      const p = H[H.length - 2], r = Math.hypot(x, y)
      if (r < o.out * 0.8) { pend = null; return null }
      if (Math.hypot(p.x - x, p.y - y) > o.still && t - pend.t < o.settleMs) return null
      const ms = t - pend.from
      pend = null; lock = t
      return { kind: 'flick', dir: unit(x, y), ms }
    }
    if (t - lock < o.lockMs) return null
    const r = Math.hypot(x, y)
    if (r < o.out) return null
    // the farthest the stick was from here inside the window
    let far = null, fd = 0
    for (let i = H.length - 2; i >= 0; i--) {
      const h = H[i]
      if (t - h.t > o.winMs) break
      const d = Math.hypot(h.x - x, h.y - y)
      if (d > fd) { fd = d; far = h }
    }
    if (!far || fd < o.dist) return null
    // (the thumb only just landed and pushed straight out: that's starting to move, not a flick)
    if (far.t - t0 < o.armMs) return null
    // (the motion has to have been made since the last move: not the tail of the one already read)
    if (far.t < lock) return null
    pend = { t, from: far.t }
    return feed2(t, x, y)
  }
  // (the same sample again: maybe it has landed already)
  function feed2(t, x, y) { const p = H[H.length - 2]; if (Math.hypot(p.x - x, p.y - y) <= o.still * 0.5) { const ms = t - pend.from; pend = null; lock = t; return { kind: 'flick', dir: unit(x, y), ms } } return null }
  return { feed, reset }
}

// The keyboard: a direction key tapped (down and up again quickly) is the move that way, with the other direction
// keys held at the time (W held and A tapped: up and left); a new key that turns the way he's going hard (a quarter
// turn or more: D held, then A, or W held and D pressed) is the move the new way at once.
//   down(k, t, before, after): before/after are the stick's way (unit, or [0, 0]) as the key goes down. Returns true
//   when that is a move now (the change of direction). up(k, t): true when the key was a tap (a move now)
export const TAPS = { tapMs: 170, turnDeg: 60 }
export function createTaps(o = TAPS) {
  const down = new Map()            // key -> { t, fired }
  const turnCos = Math.cos(o.turnDeg * Math.PI / 180)
  return {
    down(k, t, before, after) {
      const moving = Math.hypot(before[0], before[1]) > 0.5, going = Math.hypot(after[0], after[1]) > 0.5
      const turn = moving && going && before[0] * after[0] + before[1] * after[1] <= turnCos
      down.set(k, { t, fired: turn })
      return turn
    },
    up(k, t) { const d = down.get(k); down.delete(k); return !!d && !d.fired && t - d.t <= o.tapMs },
    reset() { down.clear() },
  }
}
