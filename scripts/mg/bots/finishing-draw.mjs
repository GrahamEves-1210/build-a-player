// A human at the finishing drill with a finger: for each ball he reads the lit target and draws it there from the
// ball (soccer.js's draw the shot), about half pace (the sharper ones for the top of the range), now and then bowed
// to curl a far-post one. The first-time ball he draws as it comes, finishing the stroke as it gets to him.
import { planStroke, spotOf, sender } from './drawstroke.mjs'
import { TARGETS } from '../../../src/lib/mg/finishing.js'
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const after = () => Math.max(110, human.react + gauss(r) * human.reactSd)
  const sharp = human.react < 300
  const S = sender(g), out = []
  let shot = -1, goAt = 0, planned = false
  return () => {
    out.length = 0
    if (g.done) return
    if (g.phase === 'aim' && g.i !== shot) {
      shot = g.i; planned = false
      const sh = g.shots[g.i]
      goAt = sh.spot.roll ? g.rollAt - 180 - 160 + gauss(r) * human.timing * 1.3 : g.t + after() + 200
    }
    if (g.phase === 'aim' && !planned && g.t >= goAt) {
      planned = true
      const sh = g.shots[g.i], [tx0, ty] = TARGETS[sh.k]
      const tx = r() < human.slip ? -tx0 : tx0
      const far = Math.sign(sh.spot.x) === -Math.sign(tx) && Math.abs(sh.spot.x) > 4
      const curl = far && r() < 0.5
      const { C, ball } = g.aimView()
      S.add(planStroke(g.t, ball, spotOf(C, tx, ty), { power: sharp ? (g.k.band(curl ? 'finesse' : 'driven')[0] + g.k.band(curl ? 'finesse' : 'driven')[1]) / 2 : curl ? 0.62 : 0.52, bend: curl ? -Math.sign(tx) * 0.16 : 0 }, human, r))
    }
    S.due(out)
    return out.length ? out.slice() : undefined
  }
}
