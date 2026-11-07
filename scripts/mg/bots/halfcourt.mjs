// A human at Get a Bucket, on a keyboard (the arrows, a double tap for a move, SPACE to shoot, E to pass). He picks
// a way to go at it for the trip: get his man sliding one way and cross him back, then drive it, pull up when he's
// got room, or drive and kick when the help comes. What he can see is what's on the floor: where everyone is, which
// way your man is going, a man reaching. Assumed:
//   LOOK: he re-reads the floor every so often (his reaction time, more or less), and moves off what he saw then
//   a reach: he sees it start, a reaction later his thumbs answer it (most of the time it's already over)
//   the release: aimed at the middle of the green, with his timing error, a slipped finger now and then
// He's not perfect with the stick either: a slip is a key held a beat too long, or a move that doesn't come out.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const hyp = Math.hypot
export default function makeBot(g, human, r) {
  const after = () => Math.max(110, human.react + gauss(r) * human.reactSd)
  const roll = r()
  const plan0 = roll < 0.45 ? 'drive' : roll < 0.75 ? 'jumper' : 'kick'
  let plan = plan0
  const held = { L: false, R: false, U: false, D: false }
  const last = { L: -1e9, R: -1e9, U: -1e9, D: -1e9 }
  let lockUntil = 0, queue = [], nextLook = 0, want = { x: 0, y: 1 }
  let setup = null, crossed = false, shooting = false, upAt = 0, passed = 0, handler = 0, sawReach = new Set()
  let pickedAt = 0, spinTried = 0
  const out = []
  const push = a => out.push(a)
  const key = (k, down) => { if (down) { held[k] = true; last[k] = g.t; push({ kind: 'key', zone: k }) } else { held[k] = false; push({ kind: 'keyup', zone: k }) } }
  // move the keys to point where he wants to go (and never a quick re-press: that would be a move)
  const steerKeys = () => {
    if (g.t < lockUntil) return
    const m = hyp(want.x, want.y)
    const w = { L: m > 0.1 && want.x < -0.38 * m, R: m > 0.1 && want.x > 0.38 * m, U: m > 0.1 && want.y > 0.38 * m, D: m > 0.1 && want.y < -0.38 * m }
    for (const k of ['L', 'R', 'U', 'D']) {
      if (w[k] && !held[k] && g.t - last[k] > 300) key(k, true)
      else if (!w[k] && held[k]) key(k, false)
    }
  }
  // a move: a double tap of a direction, then he keeps it held
  const doubleTap = k => {
    const t = g.t
    for (const o of ['L', 'R', 'U', 'D']) if (held[o]) key(o, false)
    if (r() < human.slip * 2) { queue.push({ at: t + 30, a: [k, true] }); lockUntil = t + 200; return }   // (a fumble: only one tap)
    queue.push({ at: t + 15, a: [k, true] }, { at: t + 60, a: [k, false] }, { at: t + 110, a: [k, true] })
    lockUntil = t + 140
  }
  return () => {
    out.length = 0
    for (let i = 0; i < queue.length; i++) if (queue[i].a[0] !== 'X' && g.t >= queue[i].at) { const [k, d] = queue[i].a; key(k, d); queue.splice(i--, 1) }
    if (g.done || g.phase === 'set' || g.phase === 'over') return out.length ? out.slice() : undefined
    const men = g.men, H = men[0], D = hyp(H.x, H.z)
    // he kicked it out: cut to the rim while it comes back (a give-and-go)
    if (g.h !== 0) { handler = g.h; want = { x: (Math.abs(H.x) > 2 ? -Math.sign(H.x) * 0.3 : 0.2) , y: 1 }; steerKeys(); return out.length ? out.slice() : undefined }
    if (g.h !== handler) {
      // he's caught it: a new trip from here
      handler = g.h; setup = null; crossed = false; pickedAt = g.t
      plan = plan0 === 'kick' ? 'jumper' : plan0
    }
    // the release
    if (g.phase === 'shot') {
      const s = g.shot
      if (s && (s.kind === 'jumper' || s.meter) && !s.rel && shooting) {
        if (!upAt) {
          const quick = 900 / s.fill
          const slip = r() < human.slip ? -(120 + r() * 160) : 0
          upAt = s.at + Math.max(95, s.c + gauss(r) * human.timing * quick + slip)
        }
        if (g.t >= upAt) { shooting = false; upAt = 0; push({ kind: 'keyup', zone: 'S' }) }
      } else if (shooting && s && s.kind !== 'jumper' && !s.meter) { shooting = false; push({ kind: 'keyup', zone: 'S' }) }
      return out.length ? out.slice() : undefined
    }
    if (shooting) { shooting = false; push({ kind: 'keyup', zone: 'S' }) }
    const shoot = () => { for (const o of ['L', 'R', 'U', 'D']) if (held[o]) key(o, false); shooting = true; upAt = 0; push({ kind: 'key', zone: 'S' }) }
    // a reach on him: a reaction later, the ball goes to the other hand
    for (let i = 5; i < 10; i++) {
      const q = men[i]
      if (q.st === 'reach' && !sawReach.has(`${i}-${q.stAt}`)) {
        sawReach.add(`${i}-${q.stAt}`)
        const ballSide = H.hand, theirSide = Math.sign(q.x - H.x) || 1
        if (ballSide === theirSide && r() > human.slip * 3) queue.push({ at: g.t + after(), a: ['X', ballSide] })
      }
    }
    for (let i = 0; i < queue.length; i++) if (queue[i].a[0] === 'X' && g.t >= queue[i].at) { const s = queue[i].a[1]; queue.splice(i--, 1); doubleTap(s > 0 ? 'L' : 'R') }
    if (g.t < nextLook) { steerKeys(); return out.length ? out.slice() : undefined }
    nextLook = g.t + Math.max(90, human.react * 0.55 + gauss(r) * 40)
    // what he sees
    let open = Infinity, near = null
    for (let i = 5; i < 10; i++) { const q = men[i], e = hyp(q.x - H.x, q.z - H.z); if (e < open) { open = e; near = q } }
    const d = men[5], dd = hyp(d.x - H.x, d.z - H.z)
    const ahead = (q, m) => ((q.x - m.x) * -m.x + (q.z - m.z) * -m.z) / (hyp(m.x, m.z) || 1)
    const dFront = d.st === 'ok' && dd < 5.5 && ahead(d, H) > 1.2
    const clock = g.clock
    // out of time: up it goes
    if (clock < 1500 + human.react) { shoot(); return out.slice() }
    // kick it to the open man when the help's come
    if ((plan === 'kick' || plan === 'drive') && g.target >= 0 && g.t - pickedAt > 400 && D < 19) {
      let helpOn = false
      for (let i = 5; i < 10; i++) { const q = men[i]; if (q.help && hyp(q.x - H.x, q.z - H.z) < 8) helpOn = true }
      const R = men[g.target]
      let rOpen = Infinity
      for (let i = 5; i < 10; i++) rOpen = Math.min(rOpen, hyp(men[i].x - R.x, men[i].z - R.z))
      if (helpOn && rOpen > (plan === 'kick' ? 8 : 10) && passed < 1 && r() > human.slip * 2) { passed++; push({ kind: 'key', zone: 'P' }); return out.slice() }
    }
    if (D <= 6.6) { shoot(); return out.slice() }
    if (plan === 'jumper' && D > 8 && D < 25 && open > 5.6 - (clock < 4000 ? 1.5 : 0)) { shoot(); return out.slice() }
    if (plan === 'drive' && D > 8 && D < 23.5 && open > 7.5) { shoot(); return out.slice() }
    // the dance: slide him one way, cross him back the other
    if (!crossed && dFront) {
      if (!setup) setup = { side: r() < 0.5 ? -1 : 1, until: g.t + 260 + r() * 380 }
      if (g.t < setup.until) { want = { x: setup.side, y: 0.35 }; steerKeys(); return out.length ? out.slice() : undefined }
      if (g.t - pickedAt > 150 && g.t >= g.moveReady) {
        crossed = true
        const s = -setup.side
        doubleTap(s < 0 ? 'L' : 'R')
        want = { x: s, y: 0.6 }
        return out.slice()
      }
    }
    // walled off with him chest to chest: spin off him, now and then
    if (dFront && dd < 2.7 && g.t - spinTried > 900 && g.t >= g.moveReady && r() < 0.5) { spinTried = g.t; doubleTap('D'); return out.slice() }
    if (dFront && crossed && dd < 3.4 && g.t - spinTried > 900) { crossed = false; setup = null }
    // get to the rim, off the side he's beaten
    const side = Math.abs(H.x) > 2 ? Math.sign(H.x) : (setup ? -setup.side : 1)
    const tx = D > 11 ? side * 3.2 : side * 1.2, tz = D > 11 ? -6 : -1.5
    want = { x: tx - H.x, y: tz - H.z }
    void near
    steerKeys()
    return out.length ? out.slice() : undefined
  }
}
