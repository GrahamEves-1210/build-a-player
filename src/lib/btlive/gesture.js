// BLACKTOP LIVE: dribble moves off the one stick (the owner, 11-25: "merging the left and right stick so movement with
// the ball is more like dribble stick but you have to be more intentional to trigger them"). Pure: the screen feeds it
// the move stick as it goes (t in ms, x and y -1..1) and it says when the thumb made a move on purpose. What it hands
// back is the way of the flick (the old right stick's flick): which move that is stays the game's word (referee.moveOf:
// the basket and the hand the ball is in), so the moves, the CPU and the wire are all as they were.
//
// Steering never makes a move: a move is a fast change between two places the thumb HOLDS (still for a beat), and
// only three shapes count:
//   SNAP   held one way, then over to a new way at least GEST.snapDeg round inside GEST.snapMs (a hard cut, or
//          straight through the middle to the other side), or GEST.flickDeg inside GEST.flickMs: the move that way
//   PUMP   held one way, off to the middle and straight back out the same way inside GEST.pumpMs: the move that way
//          (toward the basket: the hesitation)
//   SPIN   held out, rolled round the outside at least GEST.spinDeg inside GEST.spinMs: a spin, ending the new way
// A slow curve, a drift, easing off to stop, a thumb landing and pushing out from the middle: none of them is a move.
export const GEST = {
  out0: 0.55,          // a held place counts from this far out (where the move starts from)
  out1: 0.75,          // ...and a move ends at least this far out
  still: 0.07,         // held: the thumb within this (of the stick's reach) of where it is...
  stillMs: 40,         // ...for this long
  snapMs: 100, snapDeg: 75,
  flickMs: 60, flickDeg: 40,   // ...or an eighth of a turn, very quickly (driving at the basket, a flick to the diagonal)
  pumpMs: 300, pumpDeg: 40, pumpIn: 0.45,
  spinMs: 300, spinDeg: 170, spinR: 0.5,
  keep: 700,           // ms of the stick kept
}

const ang = (ax, ay, bx, by) => { const c = (ax * bx + ay * by) / ((Math.hypot(ax, ay) * Math.hypot(bx, by)) || 1); return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI }
const unit = (x, y) => { const m = Math.hypot(x, y) || 1; return [x / m, y / m] }

// feed(t, x, y): null, or { kind: 'snap' | 'pump' | 'spin', dir: [x, y] (unit: the flick), via: [x, y] (a spin: the
// flick before it, a quarter turn back, that the spin rolls out of) }. reset(): the thumb came off
export function createGesture(o = GEST) {
  const H = []
  let anchor = null                 // the last place the thumb held, out: { t, x, y }
  function reset() { H.length = 0; anchor = null }
  function feed(t, x, y) {
    if (H.length && t < H[H.length - 1].t) reset()
    H.push({ t, x, y })
    while (H.length > 2 && t - H[0].t > o.keep) H.shift()
    const n = H.length - 1, now = H[n], r = Math.hypot(x, y)
    // held? every sample back to stillMs ago (and the one before that) within `still` of now
    let i = n
    while (i > 0 && t - H[i - 1].t <= o.stillMs) i--
    if (i === 0) return null
    for (let j = i - 1; j <= n; j++) if (Math.hypot(H[j].x - x, H[j].y - y) > o.still) return null
    if (r < o.out0) { if (anchor && t - anchor.t > o.spinMs) anchor = null; return null }
    // when it got here: the first of the run of samples that are all where it is now
    let a = i - 1
    while (a > 0 && Math.hypot(H[a - 1].x - x, H[a - 1].y - y) <= o.still) a--
    const arrive = H[a].t
    let out = null
    if (anchor && arrive > anchor.t && r >= o.out1) out = judge(anchor, H, a, now, arrive)
    anchor = { t, x, y }
    return out
  }
  function judge(A, H, a, now, arrive) {
    // how long it took: from the first sample off the held place to the first at the new one (samples come a frame
    // apart, so this is the quick part itself, not the frames either side of it)
    let leave = arrive
    for (let j = 0; j <= a; j++) if (H[j].t > A.t && Math.hypot(H[j].x - A.x, H[j].y - A.y) > o.still) { leave = H[j].t; break }
    const D = arrive - leave
    // the path between: how near the middle it came, how far round it went (over the outside only)
    let minR = Math.hypot(A.x, A.y), rot = 0, px = A.x, py = A.y
    for (let j = 0; j <= a; j++) {
      const h = H[j]
      if (h.t <= A.t) continue
      const hr = Math.hypot(h.x, h.y)
      minR = Math.min(minR, hr)
      if (hr >= 0.3 && Math.hypot(px, py) >= 0.3) { let d = Math.atan2(h.y, h.x) - Math.atan2(py, px); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; rot += d }
      if (hr >= 0.3) { px = h.x; py = h.y }
    }
    const turn = ang(A.x, A.y, now.x, now.y), dir = unit(now.x, now.y), deg = Math.abs(rot) * 180 / Math.PI
    if (D <= o.spinMs && deg >= o.spinDeg && minR >= o.spinR && (D > o.snapMs || deg >= 175)) {
      // the flick the spin rolls out of: a quarter turn back from where it ends, the way it came round
      const s = rot > 0 ? -1 : 1, c = Math.cos(s * Math.PI / 2), sn = Math.sin(s * Math.PI / 2)
      return { kind: 'spin', dir, via: [dir[0] * c - dir[1] * sn, dir[0] * sn + dir[1] * c], ms: D }
    }
    if ((D <= o.snapMs && turn >= o.snapDeg) || (D <= o.flickMs && turn >= o.flickDeg)) return { kind: 'snap', dir, ms: D }
    if (D <= o.pumpMs && turn <= o.pumpDeg && minR <= o.pumpIn) return { kind: 'pump', dir, ms: D }
    return null
  }
  return { feed, reset }
}

// The keyboard: a direction key tapped twice (a short tap, then again quickly) is the move that way; the other
// direction keys held at the time go with it (W held and A tapped twice: up and left). down(k, t) returns the key that
// was tapped twice, or null; up(k, t) as it's let go.
export const TAPS = { tapMs: 190, gapMs: 190 }
export function createTaps(o = TAPS) {
  const last = new Map()            // key -> { down, up }
  return {
    down(k, t) {
      const L = last.get(k)
      const hit = L && L.up != null && L.up - L.down <= o.tapMs && t - L.up <= o.gapMs
      last.set(k, { down: t, up: null, hit })
      if (hit) { last.set(k, { down: -1e9, up: null }); return k }   // (a third tap starts over)
      return null
    },
    up(k, t) { const L = last.get(k); if (L && L.up == null) L.up = t },
    reset() { last.clear() },
  }
}
