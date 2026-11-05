// A human at the agility drills: aims a tap at the moment the closing ring lands. The timing error
// grows on a short leg, his rhythm is gone after a slip, and now and then he jumps it.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export default function makeBot(g, human, r) {
  let legId = -1, plan = null
  return () => {
    if (g.done || g.phase === 'set') return
    if (g.legId !== legId) {
      legId = g.legId
      plan = null
      if (g.k < g.n) {
        const L = g.leg
        const legMs = L.arrive - L.t0
        const prev = g.k > 0 ? g.cuts[g.k - 1].res : true
        const quick = clamp(1000 / legMs, 0.85, 1.3) * (prev === false ? 1.15 : 1)
        const jumped = r() < human.slip ? -210 : 0
        const at = L.arrive + jumped + gauss(r) * human.timing * quick
        const soonest = g.t + human.react + gauss(r) * human.reactSd * 0.5
        plan = { at: Math.max(at, soonest) }
      }
    }
    if (plan && g.t >= plan.at) {
      plan = null
      return [{ kind: 'down', zone: null, x: 180, y: 0 }]
    }
  }
}
