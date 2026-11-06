// A human going up for a lob from the wing. He sees the arc from the release and aims his press at the ball
// reaching the gold ring. On top of his hand's timing there's his eye: reading a ball on an arc to a ring is
// worth 60-90 ms either way (PERC), and he can't go before he's seen it go up. Caught, he times the tap to the
// ring closing on the rim the same way: he only sees that ring once he has it. A slip is a jumpy thumb, well early.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const PERC = human => 45 + human.timing * 0.75    // pro 54, good 65, avg 77, poor 92
export default function makeBot(g, human, r) {
  let seen = null, jumpAt = Infinity, tapAt = Infinity, jumped = false, tapped = false
  const sd = Math.hypot(human.timing, PERC(human))
  return () => {
    const b = g.rep
    if (seen !== b && g.t >= b.relAt) {
      seen = b; jumped = false; tapped = false; tapAt = Infinity
      const read = b.relAt + Math.max(60, human.react + gauss(r) * human.reactSd)
      jumpAt = Math.max(read, b.aimAt + gauss(r) * sd)
      if (r() < human.slip) jumpAt -= 220 + r() * 200
    }
    if (seen === b && b.caught && tapAt === Infinity) {
      tapAt = Math.max(g.t + human.react * 0.5, b.slamAt + gauss(r) * sd)
      if (r() < human.slip) tapAt = g.t + 60 + r() * 120
    }
    const out = []
    if (seen === b && !jumped && g.t >= jumpAt) { jumped = true; out.push({ kind: 'down', zone: null, x: 180, y: 400 }) }
    if (seen === b && !tapped && g.t >= tapAt) { tapped = true; out.push({ kind: 'down', zone: null, x: 180, y: 400 }) }
    return out.length ? out : undefined
  }
}
