// A human at the 2-on-1, with the thumbstick (aim) and the buttons (SHOOT, PASS). One man to watch, the last defender,
// and two answers: he steps up to you, square it; he drops off to the runner, shoot. The same read as Fast Break's
// (bots/fastbreak.mjs): he has to see the man move and know what it means. Assumed:
//   LOOK: seeing a defender's step for what it is, about 170 ms on top of his reaction
//   a fake (the step he sells you) gets him now and then, and now and then he goes before the man has
//   the shot: his stick's at the low corner away from the keeper (a thumb's width off), he lets go of the power where
//   he means to with his timing error (a fifth more), and taps as his foot meets it, with his timing error
import { FILL } from '../../../src/lib/mg/counter.js'
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
const LOOK = 170, CHOOSE = 0.35, MISREAD = 4.5, GUESS = 1.5, AIM_SD = 0.12
export default function makeBot(g, human, r) {
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  let plan = null, sawShow = false, sawCommit = false, stage = 'run', relAt = Infinity, tapAt = null
  if (r() < human.slip * GUESS) plan = { at: 1200 + r() * 1200, act: r() < 0.5 ? 'pass' : 'shoot', guess: true }
  const ex = gauss(r) * AIM_SD, ey = gauss(r) * AIM_SD
  const skip = r() < 0.12 + human.slip * 2
  const out = []
  return () => {
    out.length = 0
    if (g.done) return
    // the stick: a low corner, away from the keeper
    if (g.t > 400 && !g.shot) {
      const side = g.gk.x > 0.05 ? -1 : g.gk.x < -0.05 ? 1 : -g.rs
      out.push({ kind: 'stick', x: side * 0.82 + ex, y: -0.35 + ey })
    }
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
        if (plan.act === 'pass') { stage = 'done'; out.push({ kind: 'key', zone: 'P' }, { kind: 'keyup', zone: 'P' }) }
        else { stage = 'hold'; out.push({ kind: 'key', zone: 'S' }); relAt = g.t + 0.55 * FILL + gauss(r) * human.timing * 1.2 - (r() < human.slip ? 120 : 0) }
      }
    } else if (stage === 'hold' && g.t >= relAt) { stage = 'tap'; out.push({ kind: 'keyup', zone: 'S' }) }
    else if (stage === 'tap' && g.k.phase === 'strike') {
      if (skip) stage = 'done'
      else {
        if (tapAt == null) tapAt = g.k.strikeAt + gauss(r) * human.timing
        if (g.t >= tapAt) { stage = 'done'; out.push({ kind: 'key', zone: 'S' }, { kind: 'keyup', zone: 'S' }) }
      }
    }
    return out.length ? out.slice() : undefined
  }
}
