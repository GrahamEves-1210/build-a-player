// A human at the free kick, with the thumbstick (aim) and the buttons (SHOOT, CURL). He looks at the set-up and picks
// a kick: mostly the curler over the wall into the corner on its side; now and then a driven one at the far corner,
// or low under the wall if nobody's lying behind it. Assumed:
//   AIM: he pushes the stick toward his spot, a thumb's width off (AIM_SD of the stick's travel)
//   POWER: the bar's a moving mark: he lets go where he means to (enough to get it over the wall, short of the
//          over-the-bar end) with his timing error, a fifth more
//   TAP: aimed at his foot meeting it, with his timing error. A nervous one doesn't tap at all now and then
import { FILL } from '../../../src/lib/mg/freekick.js'
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
const AIM_SD = 0.11
export default function makeBot(g, human, r) {
  const roll = r()
  const plan = roll < (human.slip < 0.02 ? 0.85 : 0.7) ? 'curl' : !g.sleeper && r() < 0.55 ? 'under' : 'far'
  const s = g.sgn
  // the stick: across (-1 the left post) and up (-1 low, 1 high)
  const want = plan === 'curl' ? { x: s * 0.93, y: 0.82 } : plan === 'far' ? { x: -s * 0.86, y: r() < 0.5 ? 0.7 : -0.4 } : { x: s * 0.5, y: -0.9 }
  want.x += gauss(r) * AIM_SD; want.y += gauss(r) * AIM_SD
  const key = plan === 'curl' ? 'P' : 'S'
  const power = plan === 'curl' ? 0.62 : 0.68
  const skip = r() < 0.12 + human.slip * 2
  let stage = 'aim', relAt = Infinity, tapAt = null
  const startAt = 1300 + human.react + 300 + r() * 600
  return () => {
    if (g.done) return
    if (stage === 'aim') {
      if (g.t < 600) return
      if (g.t < startAt) return [{ kind: 'stick', x: want.x, y: want.y }]
      stage = 'hold'
      relAt = g.t + power * FILL + gauss(r) * human.timing * 1.2 - (r() < human.slip ? 140 : 0)
      return [{ kind: 'stick', x: want.x, y: want.y }, { kind: 'key', zone: key }]
    }
    if (stage === 'hold' && g.t >= relAt) { stage = 'tap'; return [{ kind: 'keyup', zone: key }] }
    if (stage === 'tap' && g.k.phase === 'strike') {
      if (skip) { stage = 'done'; return }
      if (tapAt == null) tapAt = g.k.strikeAt + gauss(r) * human.timing
      if (g.t >= tapAt) { stage = 'done'; return [{ kind: 'key', zone: key }, { kind: 'keyup', zone: key }] }
    }
  }
}
