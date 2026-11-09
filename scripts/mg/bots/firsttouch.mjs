// A human at the first-touch test. Keep-ups: he watches it come down (a ball he can see falling: a timed press, with
// his timing error) to the foot it's drifting to; now and then the wrong foot. The passes: the same, aimed at the ball
// getting to him, on the side it's rolling to.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  let target = null, pressAt = Infinity, side = 0
  const down = s => [{ kind: 'down', zone: s < 0 ? 'L' : 'R', x: s < 0 ? 90 : 270, y: 600 }]
  return () => {
    if (g.done) return
    if (g.phase === 'ups') {
      const key = `u${g.ups}`
      if (target !== key) {
        target = key
        side = r() < human.slip ? -g.side : g.side
        pressAt = Math.max(g.t + human.react * 0.6, g.nextAt + gauss(r) * human.timing * 1.1)
      }
      if (g.t >= pressAt) { pressAt = Infinity; return down(side) }
      return
    }
    if (g.phase === 'pass' && !g.touch) {
      const key = `p${g.k}`
      if (target !== key && g.rolling) {
        target = key
        const p = g.passes[g.k]
        side = r() < human.slip ? -p.side : p.side
        pressAt = g.arriveAt + gauss(r) * human.timing * 1.15
      }
      if (g.t >= pressAt) { pressAt = Infinity; return down(side) }
    }
  }
}
