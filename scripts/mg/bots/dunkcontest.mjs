// A human in the Dunk Contest: each ring is a closing circle he can see coming, so he aims at it meeting its mark,
// with his hand's timing error and a little more for reading the ring (PERC). The rules run slow at the top of the hard
// dunks: his error is in real ms, so it shrinks in game ms by the rate there. A hold: he grips once he sees the ring and
// lets go on it. Now and then (slip) a jumpy thumb goes well early on one of the steps.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const PERC = human => 20 + human.timing * 0.5    // pro 26, good 33, avg 41, poor 51
export default function makeBot(g, human, r) {
  const sd = Math.hypot(human.timing, PERC(human))
  const slipK = r() < human.slip ? Math.floor(r() * g.steps.length) : -1
  let plan = null, upAt = Infinity
  const down = () => ({ kind: 'down', zone: null, x: 180, y: 400 }), up = () => ({ kind: 'up', zone: null, x: 180, y: 400 })
  return () => {
    const out = []
    if (g.t >= upAt) { upAt = Infinity; out.push(up()) }
    const s = g.steps[g.k]
    if (!s || g.fail || g.done || s.T == null) return out.length ? out : undefined
    const seen = Math.max(s.cueAt, s.liveAt ?? 0)
    if (g.t < seen) return out.length ? out : undefined
    if (!plan || plan.k !== g.k) {
      // (he needs a beat on the ring to read it: one that's barely up when it closes is aimed late)
      const read = seen + Math.max(120, human.react * 0.55 + gauss(r) * human.reactSd * 0.5) * s.rate
      let at = s.T + gauss(r) * sd * s.rate
      if (g.k === slipK) at = s.T - (s.W + (90 + r() * 160) * s.rate)
      plan = { k: g.k, at: Math.max(at, read), grip: seen + Math.max(80, human.react + gauss(r) * human.reactSd) * s.rate, gripped: false }
    }
    if (s.kind === 'hold') {
      if (!plan.gripped && g.t >= Math.min(plan.grip, plan.at - 150 * s.rate)) { plan.gripped = true; upAt = Infinity; if (!g.held) out.push(down()) }
      if (plan.gripped && g.held && g.t >= plan.at) out.push(up())
    } else if (!plan.done && g.t >= plan.at) {
      plan.done = true; out.push(down()); upAt = g.t + 85
    }
    return out.length ? out : undefined
  }
}
