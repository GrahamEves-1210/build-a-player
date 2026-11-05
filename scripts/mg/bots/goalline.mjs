// A human at Fourth & Goal. A receiver: presses to cut as the ring closes, then the shoulder the ball
// comes over as it gets to him, each with his timing error. A quarterback: reads who's open through his reaction time,
// presses a lead on him, holds, lets go. A slip: throws it to the wrong man.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const down = () => [{ kind: 'down', zone: null, x: 180, y: 500 }]
export default function makeBot(g, human, r) {
  return g.me ? receiver(g, human, r) : qb(g, human, r)
}
function receiver(g, human, r) {
  const me = g.me
  // the ring's closing the whole way: a press aimed at a moment you can see coming. Then which
  // shoulder (the lit pad, the ball) and when; a slip is the wrong pad.
  const cutAim = me.breakAt + gauss(r) * human.timing
  let catchAim = null, cut = false, caught = false
  return () => {
    if (g.phase !== 'run') return
    if (!cut && g.t >= cutAim) { cut = true; return down() }
    if (g.ball && catchAim == null) catchAim = g.ball.land + gauss(r) * human.timing
    if (catchAim != null && !caught && g.t >= catchAim) {
      caught = true
      const sd = r() < human.slip ? 1 - g.side : g.side
      return [{ kind: 'down', zone: sd ? 'R' : 'L', x: 180, y: 500 }]
    }
  }
}
function qb(g, human, r) {
  const AIM = 0.28
  const target = r() < human.slip * 2 ? g.recs.find(p => p !== g.open) : g.open
  // he sees it when the man's come out of his break, and he's looking at the right one in time
  const seeAt = target.breakAt + 120 + Math.max(60, human.react + gauss(r) * human.reactSd)
  const pw = 0.8, holdMs = pw * 250
  let pressed = false, upAt = Infinity
  return () => {
    if (g.phase !== 'run') return
    if (!pressed && g.t >= seeAt) {
      pressed = true
      const o = {}
      let air = 400
      for (let i = 0; i < 3; i++) { g.project(target, holdMs + air, o); air = g.airTo(o.x, o.y, pw) }
      const q = g.screenOf(o.x + gauss(r) * human.timing * AIM, o.y + (gauss(r) * human.timing * AIM) / 8.4)
      upAt = g.t + holdMs + gauss(r) * human.timing * 0.5
      return [{ kind: 'down', zone: null, x: q.x, y: q.y, exact: true }]
    }
    if (g.t >= upAt) { upAt = Infinity; return [{ kind: 'up', zone: null, x: 180, y: 400 }] }
  }
}
