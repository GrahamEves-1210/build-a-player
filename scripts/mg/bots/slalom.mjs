// A human at the slalom: the arrow says which way, the ring says when. He aims a press at the ring closing on the
// ball, with his timing error (a little worse on a short gap, and after a slip his rhythm's gone), and now and then
// his thumb goes the wrong way or jumps it.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  let k = -1, arrive = 0, plan = null
  return () => {
    if (g.done || g.phase !== 'run' || g.k >= g.n) return
    const c = g.cuts[g.k]
    if (g.k !== k || c.arrive !== arrive) {
      k = g.k; arrive = c.arrive
      if (!Number.isFinite(arrive)) { plan = null; return }
      const prev = g.k > 0 ? g.cuts[g.k - 1].res : true
      const err = gauss(r) * human.timing * (prev === false ? 1.25 : 1.05)
      const jumped = r() < human.slip ? -200 : 0
      const soonest = g.t + human.react * 0.6
      plan = { at: Math.max(arrive + err + jumped, soonest), side: r() < human.slip ? -c.want : c.want }
    }
    if (plan && g.t >= plan.at) { const p = plan; plan = null; return [{ kind: 'down', zone: p.side < 0 ? 'L' : 'R', x: 0, y: 0 }] }
  }
}
