// A human at the Catch engine: a press is aimed at the moment the ball or the hand arrives, with
// timing error, and a slip now and then. The gauntlet's error grows as the throws come closer
// together; a deep ball is about as hard each snap; the jabs get quicker.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export default function makeBot(g, human, r, game) {
  const plan = g.balls.map((b, k) => {
    const gap = k ? b.arrive - g.balls[k - 1].arrive : 1000
    const quick = game === 'gauntlet' ? clamp(850 / gap, 0.9, 1.15) : game === 'release' ? clamp(620 / b.air, 1, 1.25) : 1
    return { off: gauss(r) * human.timing * quick, side: r() < human.slip ? 1 - b.side : b.side }
  })
  let i = 0
  return () => {
    if (i < plan.length && g.t >= g.balls[i].arrive + plan[i].off) {
      const p = plan[i++]
      return [{ kind: 'down', zone: p.side ? 'R' : 'L', x: 0, y: 0 }]
    }
  }
}
