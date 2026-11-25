// A human through on goal on a phone: the left thumb steers (sent here as the arrows), the right one draws the shot on
// the right of the screen (soccer.js's draw the shot). The same runs as the keyboard bot (oneonone.mjs): most go for
// the far corner from the edge of the box, some take the keeper on and go round him, anyone dinks a keeper who's come
// miles off his line. The shot: a stroke from his thumb's spot, pointed where he wants it on the goal (the ring shows
// him), about two thirds pace (the sharper ones for the top of the range), bowed for the curler, soft for the dink,
// drawn back for the cut-back.
import { planStroke, spotOf, sender } from './drawstroke.mjs'
import { POST } from '../../../src/lib/mg/soccer.js'
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const after = () => Math.max(110, human.react + gauss(r) * human.reactSd)
  const roll = r(), sharp = human.react < 300
  const plan = g.kOff ? (roll < 0.55 ? 'chip' : 'shoot') : roll < 0.62 ? 'shoot' : roll < 0.85 ? 'round' : 'curl'
  const range = 12 + r() * 5 + (sharp ? 1.5 : 0) - 2.6   // (a stroke's quicker than holding the bar: he lets it run on that bit closer)
  const held = { L: 0, R: 0, U: 0, D: 0 }
  const out = [], queue = [], S = sender(g)
  let nextLook = 0, stage = 'run', sawDown = false, roundAt = 0, roundSide = 0
  const key = (k, d) => { if (d && !held[k]) { held[k] = 1; out.push({ kind: 'key', zone: k }) } else if (!d && held[k]) { held[k] = 0; out.push({ kind: 'keyup', zone: k }) } }
  const steer = (x, up) => { key('L', x < -0.3); key('R', x > 0.3); key('U', !!up); key('D', false) }
  // a stroke on the right of the screen, as though from the ball, to a spot on the goal
  const shoot = (X, Y, want) => {
    const { C, ball } = g.aimView(), to = spotOf(C, X, Y)
    const from = { x: 262 + gauss(r) * 10, y: g.vh - 150 + gauss(r) * 10 }
    S.add(planStroke(g.t + 30, from, { x: from.x + (to.x - ball.x), y: from.y + (to.y - ball.y) }, { ...want, ring: true }, human, r))
  }
  const pace = () => (sharp ? 0.72 : 0.6)
  return () => {
    out.length = 0
    for (let i = 0; i < queue.length; i++) if (g.t >= queue[i].at) { const q = queue.splice(i--, 1)[0]; key(q.k, q.d) }
    S.due(out)
    if (g.done || g.res || g.phase === 'set') { for (const k of Object.keys(held)) key(k, false); return out.length ? out.slice() : undefined }
    if (stage === 'done') return out.length ? out.slice() : undefined
    if (g.t < nextLook) return out.length ? out.slice() : undefined
    nextLook = g.t + after() * 0.45
    const m = g.me, K = g.gk, b = g.bl, D = Math.hypot(b.x, b.z)
    const dBack = Math.hypot(g.df.x - m.x, g.df.z - m.z), kD = Math.hypot(K.x - m.x, K.z - m.z)
    const open = () => { let s = -(Math.sign(K.x - b.x * 0.3) || 1); if (r() < human.slip) s = -s; return s }
    const margin = sharp ? 0.6 : 0.85
    if ((plan === 'round' || kD < 3.5) && (K.st === 'down' || K.st === 'rush') && !sawDown) { sawDown = true; roundSide = -(K.side || Math.sign(K.x - m.x) || 1); roundAt = g.t + after() * 0.7 }
    if (roundAt && g.t >= roundAt && stage === 'run') {
      key('L', false); key('R', false)
      const a = roundSide > 0 ? 'L' : 'R', bb = roundSide > 0 ? 'R' : 'L'
      key(a, true); queue.push({ at: g.t + 60, k: a, d: false }, { at: g.t + 75, k: bb, d: true }, { at: g.t + 420, k: bb, d: false })
      if (r() < human.slip * 3) queue.length = 1
      stage = 'rounded'; roundAt = 0; nextLook = g.t + 500
      return out.length ? out.slice() : undefined
    }
    if (stage === 'rounded') {
      if (Math.hypot(b.x - m.x, b.z - m.z) < 2.4) { const s = -Math.sign(K.x - b.x) || 1; shoot(s * (POST - 1.2), 0.5, { power: 0.5, bend: 0 }); stage = 'done' }
      return out.length ? out.slice() : undefined
    }
    if (plan === 'chip' && K.z < -5 && kD < 11 && kD > 3.5 && Math.hypot(b.x - m.x, b.z - m.z) < 2.2) {
      shoot(open() * 1.2, 1.7, { power: 0.25, bend: 0 }); stage = 'done'
      return out.length ? out.slice() : undefined
    }
    if ((plan === 'shoot' || plan === 'curl' || (plan === 'chip' && D < 12)) && D < range && Math.hypot(b.x - m.x, b.z - m.z) < 2.6 && stage === 'run') {
      steer(0, false)
      const s = open()
      if (plan === 'curl') shoot(s * (POST - margin), 1.3, { power: pace() + 0.06, bend: -s * 0.17 })
      else shoot(s * (POST - margin), r() < 0.5 ? 0.4 : 1.4, { power: pace(), bend: 0 })
      stage = 'done'
      return out.length ? out.slice() : undefined
    }
    const lane = Math.sign(m.x) * Math.min(Math.abs(m.x), 3.5)
    const sprint = (dBack < 4.2 || (plan === 'round' && D > 14)) && D > range + 5
    steer(Math.max(-1, Math.min(1, (lane - m.x) / 3)), sprint)
    // the man arriving, the keeper committed to you: drawn back across for him
    if (g.mt?.on && (K.st === 'down' || K.st === 'rush' || kD < 4) && stage === 'run' && r() < 0.5) {
      const from = { x: 262, y: g.vh - 200 }
      S.add(planStroke(g.t + 20, from, { x: from.x + (g.mt.x < m.x ? -90 : 90), y: from.y + 50 }, { power: 0.5, bend: 0 }, human, r))
      key('U', false); stage = 'done'
    }
    return out.length ? out.slice() : undefined
  }
}
