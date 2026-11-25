// A human on the spot with a finger: he draws his penalty (soccer.js's draw the shot). He picks a corner (now and then
// the middle), the better ones nearer the post; most hit it at about two thirds pace, a few bend it into the far side
// or dink one down the middle. Some stutter and, if the keeper's gone, draw it again the other way.
import { planStroke, spotOf, sender } from './drawstroke.mjs'
import { POST } from '../../../src/lib/mg/soccer.js'
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const after = () => Math.max(110, human.react + gauss(r) * human.reactSd)
  const sharp = human.react < 300
  let side = r() < 0.1 ? 0 : r() < 0.5 ? -1 : 1
  const high = r() < 0.3, stut = r() < 0.32, bendIt = r() < 0.25, panenka = side === 0 && r() < 0.4
  const margin = sharp ? 0.55 : 0.8
  const S = sender(g), out = []
  let goAt = null, stage = 'wait', stutAt = null, sawDive = false
  const draw = t0 => {
    const { C, ball } = g.aimView()
    const X = side * (POST - margin), Y = panenka ? 1.5 : high ? 1.75 : 0.45
    const to = spotOf(C, X, Y)
    S.clear(); S.add(planStroke(t0, ball, to, { power: panenka ? 0.25 : sharp ? 0.75 : 0.62, bend: bendIt && side ? side * 0.12 : 0 }, human, r))
  }
  return () => {
    out.length = 0
    if (g.done || g.res) return
    if (g.phase === 'set') return
    if (goAt == null) { goAt = g.t + after() + (sharp ? 200 : 500) }
    if (stage === 'wait' && g.t >= goAt) { draw(g.t); stage = 'drawn' }
    if (stage === 'drawn' && g.phase === 'run') {
      stage = 'run'
      if (stut) stutAt = g.t + 250 + r() * 300
    }
    if (stage === 'run' && g.struckAt == null) {
      if (stutAt != null && g.t >= stutAt) { out.push({ kind: 'key', zone: 'P' }, { kind: 'keyup', zone: 'P' }); stutAt = null }
      // he's gone early: draw it the other way
      if (!sawDive && g.kdive != null) { sawDive = true; if (g.kdive) { const at = g.t + after() * 0.9; side = -g.kdive; draw(at) } }
    }
    S.due(out)
    return out.length ? out.slice() : undefined
  }
}
