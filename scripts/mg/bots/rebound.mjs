// A human under the rim: the side only shows when the ball comes off the iron. He reads that
// (reaction), and aims his press at the moment the ball reaches the gold ring on its arc (timing,
// a little worse on a quicker carom). If he's still reading then, he goes when he's read it.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  let seen = null, at = 0, side = 0, fired = true
  return () => {
    const b = g.rep
    if (seen !== b && g.t >= b.hitAt) {
      seen = b; fired = false
      const read = b.hitAt + Math.max(60, human.react + gauss(r) * human.reactSd)
      const aim = b.aimAt + gauss(r) * human.timing * (760 / b.air)
      at = Math.max(read, aim)
      side = r() < human.slip ? 1 - b.side : b.side
    }
    if (!fired && g.t >= at) {
      fired = true
      return [{ kind: 'down', zone: side ? 'R' : 'L', x: side ? 270 : 90, y: 400 }]
    }
  }
}
