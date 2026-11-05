// A human on the bench: one thumb flat out, for ten seconds. The rate varies run to run, jitters tap
// to tap and fades as the arm tires. A slip here is a tap that didn't land.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const form = 1 + gauss(r) * 0.09
  // finding the tempo: the first tap is a reaction to the game starting
  let next = Math.max(120, human.react + gauss(r) * human.reactSd)
  return () => {
    if (g.done || g.t < next) return
    const fade = 1 - Math.min(0.22, (g.t / 1000) * 0.018)
    const rate = human.rate * form * fade
    next = g.t + Math.max(45, (1000 / rate) * (1 + gauss(r) * 0.12))
    if (r() < human.slip) return
    return [{ kind: 'down', zone: null, x: 180, y: 300 }]
  }
}
