// A human at the 2-on-1 on a phone: the same read as the keyboard bot (counter.mjs), watching the last man, but the
// shot's drawn (soccer.js's draw the shot): a stroke on the right of the screen, as though from the ball, at the low
// corner away from the keeper, about two thirds pace (the sharper ones for the top of the range). The pass is PASS.
import { planStroke, spotOf, sender } from './drawstroke.mjs'
import { POST } from '../../../src/lib/mg/soccer.js'
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
const LOOK = 170, CHOOSE = 0.35, MISREAD = 4.5, GUESS = 1.5
export default function makeBot(g, human, r) {
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  const sharp = human.react < 300
  let plan = null, sawShow = false, sawCommit = false, stage = 'run'
  if (r() < human.slip * GUESS) plan = { at: 1200 + r() * 1200, act: r() < 0.5 ? 'pass' : 'shoot', guess: true }
  const S = sender(g), out = []
  return () => {
    out.length = 0
    if (g.done) return
    if (stage === 'run') {
      if (g.showAt != null && !sawShow) {
        sawShow = true
        if (r() < human.slip * MISREAD && (!plan || plan.guess)) plan = { at: g.t + after() + LOOK, act: g.showTo === 'ball' ? 'pass' : 'shoot' }
      }
      if (g.commitAt != null && !sawCommit) {
        sawCommit = true
        let act = g.goes === 'ball' ? 'pass' : 'shoot'
        if (r() < human.slip) act = act === 'pass' ? 'shoot' : 'pass'
        const at = g.t + after() + LOOK + human.react * CHOOSE + (sawShow ? 60 : 0)
        if (!plan || (plan.guess && plan.at > at)) plan = { at, act }
      }
      if (plan && g.t >= plan.at) {
        stage = 'done'
        if (plan.act === 'pass') out.push({ kind: 'key', zone: 'P' }, { kind: 'keyup', zone: 'P' })
        else {
          const side = g.gk.x > 0.05 ? -1 : g.gk.x < -0.05 ? 1 : -g.rs
          const { C, ball } = g.aimView(), to = spotOf(C, side * (POST - (sharp ? 0.6 : 0.85)), 0.55)
          const from = { x: 250 + gauss(r) * 10, y: g.vh - 170 + gauss(r) * 10 }
          S.add(planStroke(g.t, from, { x: from.x + (to.x - ball.x), y: from.y + (to.y - ball.y) }, { power: sharp ? 0.72 : 0.6, bend: 0, ring: true }, human, r))
        }
      }
    }
    S.due(out)
    return out.length ? out.slice() : undefined
  }
}
