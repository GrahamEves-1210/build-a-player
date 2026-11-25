// A human at the free kick with a finger: he draws it (soccer.js's draw the shot). Mostly the curler: a bowed line
// from the ball into the top corner on the wall's side, bowed his foot's way (the inside of the boot), at a good pace
// to get it up and over; now and then driven at the far corner, or short and quick along the grass under the wall if
// nobody's lying behind it. The sharper ones go nearer the post and for the top of the range.
import { planStroke, spotOf, sender } from './drawstroke.mjs'
import { POST } from '../../../src/lib/mg/soccer.js'
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const plan = r() < (human.slip < 0.02 ? 0.85 : 0.7) ? 'curl' : !g.sleeper && r() < 0.55 ? 'under' : 'far'
  const sharp = human.react < 300, s = g.sgn
  const S = sender(g), out = []
  const startAt = 1300 + human.react + 300 + r() * 600 + Math.abs(gauss(r)) * 200
  let drawn = false
  return () => {
    out.length = 0
    if (g.done) return
    if (!drawn && g.t >= startAt && g.phase === 'aim') {
      drawn = true
      const { C, ball } = g.aimView()
      const m = sharp ? 0.6 : 0.85
      let X, Y, want
      if (plan === 'curl') { X = s * (POST - m); Y = 1.72; want = { bend: g.foot * (sharp ? 0.2 : 0.17), power: sharp ? 0.8 : 0.7 } }
      else if (plan === 'far') { X = -s * (POST - m); Y = r() < 0.5 ? 1.6 : 0.5; want = { bend: 0, power: sharp ? 0.7 : 0.62 } }
      else { X = s * 1.6; Y = 0.15; want = { bend: 0, power: 0.66 } }
      const to = plan === 'under' ? { x: ball.x + (spotOf(C, X, 0).x - ball.x) * 0.55, y: ball.y + (spotOf(C, X, 0).y - ball.y) * 0.55 } : spotOf(C, X, Y)
      S.add(planStroke(g.t, ball, to, want, human, r))
    }
    S.due(out)
    return out.length ? out.slice() : undefined
  }
}
