// A human through on goal, on a keyboard (the arrows, SPACE to shoot, E to chip). He picks a way to finish it for the
// run: most go for the far corner from the edge of the box, some take the keeper on and go round him when he
// commits, and anyone dinks a keeper who's come miles off his line. What he can see is what's on the pitch: where
// everyone is, the keeper's state. Assumed:
//   LOOK: he re-reads the play every so often (his reaction time, more or less), and moves off what he saw then
//   the power bar: he aims for about two thirds of it, off by his timing error
//   the timed finish: the better players try it, aimed at the strike, with their timing error
//   a slip: a key held a beat too long, or a move that doesn't come out
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const after = () => Math.max(110, human.react + gauss(r) * human.reactSd)
  const roll = r()
  const plan = g.kOff ? (roll < 0.55 ? 'chip' : 'shoot') : roll < 0.62 ? 'shoot' : roll < 0.85 ? 'round' : 'curl'
  const range = 12 + r() * 5 + (human.react < 300 ? 1.5 : 0)
  const tryTimed = r() < (human.react < 250 ? 0.85 : human.react < 300 ? 0.6 : human.react < 400 ? 0.3 : 0.1)
  const held = { L: 0, R: 0, U: 0, D: 0, S: 0, P: 0 }
  const out = [], queue = []
  let nextLook = 0, stage = 'run', relAt = 0, tapAt = 0, aimSide = 0, sawDown = false, roundAt = 0, roundSide = 0
  const key = (k, d) => { if (d && !held[k]) { held[k] = 1; out.push({ kind: 'key', zone: k }) } else if (!d && held[k]) { held[k] = 0; out.push({ kind: 'keyup', zone: k }) } }
  const steer = (x, up) => {
    key('L', x < -0.3); key('R', x > 0.3); key('U', !!up); key('D', false)
  }
  return () => {
    out.length = 0
    for (let i = 0; i < queue.length; i++) if (g.t >= queue[i].at) { const q = queue.splice(i--, 1)[0]; key(q.k, q.d) }
    if (g.done || g.res || g.phase === 'set') { for (const k of Object.keys(held)) key(k, false); return out.length ? out.slice() : undefined }
    const m = g.me, K = g.gk, b = g.bl, D = Math.hypot(b.x, b.z)
    if (stage === 'power') {
      // holding: aimed at the far side from the keeper, let go at about two thirds
      if (g.t >= relAt) { key(plan === 'curl' ? 'P' : 'S', false); stage = 'struck'; tapAt = null }
      return out.length ? out.slice() : undefined
    }
    if (stage === 'struck') {
      if (tapAt == null && g.k.phase === 'strike') tapAt = g.k.strikeAt + gauss(r) * human.timing * 1.2 + (r() < human.slip ? 120 : 0)
      if (tryTimed && tapAt != null && g.k.phase === 'strike' && g.t >= tapAt) { key('S', true); queue.push({ at: g.t + 40, k: 'S', d: false }); stage = 'done' }
      return out.length ? out.slice() : undefined
    }
    if (stage === 'done' || stage === 'chipped') return out.length ? out.slice() : undefined
    if (g.t < nextLook) return out.length ? out.slice() : undefined
    nextLook = g.t + after() * 0.45
    const dBack = Math.hypot(g.df.x - m.x, g.df.z - m.z)
    const kD = Math.hypot(K.x - m.x, K.z - m.z)
    // the keeper's committed: go round him, the other way
    if ((plan === 'round' || kD < 3.5) && (K.st === 'down' || K.st === 'rush') && !sawDown) {
      sawDown = true; roundSide = -(K.side || Math.sign(K.x - m.x) || 1); roundAt = g.t + after() * 0.7
    }
    if (roundAt && g.t >= roundAt && stage === 'run') {
      // a snap of the stick: the near side for a moment, then hard the other way
      key('L', false); key('R', false)
      const a = roundSide > 0 ? 'L' : 'R', bb = roundSide > 0 ? 'R' : 'L'
      key(a, true); queue.push({ at: g.t + 60, k: a, d: false }, { at: g.t + 75, k: bb, d: true }, { at: g.t + 420, k: bb, d: false })
      if (r() < human.slip * 3) queue.length = 1
      stage = 'rounded'; roundAt = 0; nextLook = g.t + 500
      return out.length ? out.slice() : undefined
    }
    if (stage === 'rounded') {
      // past him: put it in the empty net
      if (Math.hypot(b.x - m.x, b.z - m.z) < 2.4) { key('S', true); stage = 'power'; relAt = g.t + 260 + gauss(r) * human.timing; aimSide = -Math.sign(K.x - b.x) || 1; key(aimSide < 0 ? 'L' : 'R', true) }
      return out.length ? out.slice() : undefined
    }
    // the dink: he's well off his line and coming
    if (plan === 'chip' && K.z < -5 && kD < 11 && kD > 3.5 && Math.hypot(b.x - m.x, b.z - m.z) < 2.2) {
      key('P', true); queue.push({ at: g.t + 70 + Math.abs(gauss(r)) * 30, k: 'P', d: false }); stage = 'chipped'
      return out.length ? out.slice() : undefined
    }
    // the shot: in range, the ball close
    if ((plan === 'shoot' || plan === 'curl' || (plan === 'chip' && D < 12)) && D < range && Math.hypot(b.x - m.x, b.z - m.z) < 2.6 && stage === 'run') {
      steer(0, false)
      aimSide = -(Math.sign(K.x - b.x * 0.3) || 1)
      if (r() < human.slip) aimSide = -aimSide
      key(aimSide < 0 ? 'L' : 'R', true)
      key(plan === 'curl' ? 'P' : 'S', true)
      const want = (plan === 'curl' ? 0.62 : 0.6) + gauss(r) * 0.06
      relAt = g.t + want * g.k.fill + gauss(r) * human.timing * 1.4
      stage = 'power'
      return out.length ? out.slice() : undefined
    }
    // running: cut in from a channel toward the middle, sprint when the defender's close behind
    const lane = Math.sign(m.x) * Math.min(Math.abs(m.x), 3.5)
    const sprint = (dBack < 4.2 || (plan === 'round' && D > 14)) && D > range + 5
    steer(clamp((lane - m.x) / 3, -1, 1), sprint)
    // the man arriving, the keeper committed to you: square it
    if (g.mt?.on && (K.st === 'down' || K.st === 'rush' || kD < 4) && stage === 'run' && r() < 0.5) { key('U', false); key('D', true); key('S', true); queue.push({ at: g.t + 60, k: 'S', d: false }, { at: g.t + 100, k: 'D', d: false }); stage = 'done' }
    return out.length ? out.slice() : undefined
  }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
