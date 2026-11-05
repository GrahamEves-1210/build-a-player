// A human at the meter: presses once he's seen it's his turn (clock on: as soon as he can), then
// lets go aimed at what's on the screen, the middle of the green or the peak, with timing error. A
// quicker meter is harder to judge, nerves make it worse, and now and then a finger comes off early.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const FLOOR = 95   // (a let-go any sooner is a flinch, and the game ignores it)
export default function makeBot(g, human, r) {
  let seen = null, pressAt = 0, upAt = 0, down = false
  return () => {
    const m = g.rep
    if (seen !== m) {
      // a new rep: whatever happened to the last one (it may have filled and gone without him)
      if (m.phase !== 'ready') return
      seen = m; down = false; upAt = 0
      pressAt = g.t + Math.max(60, human.react + gauss(r) * human.reactSd)
    }
    if (m.phase === 'ready' && !down && g.t >= pressAt) {
      down = true
      return [{ kind: 'down', zone: null, x: 180, y: 300 }]
    }
    if (m.phase === 'hold' && down) {
      if (!upAt) {
        const quick = m.peak ? 790 / m.c : 900 / m.fill   // a quicker meter is harder to feel
        const nerves = m.wob ? 1.15 : 1                   // and the shake doesn't help
        const off = gauss(r) * human.timing * quick * nerves
        const slip = r() < human.slip ? -(120 + r() * 160) : 0
        upAt = m.at + Math.max(FLOOR, m.c + off + slip)
      }
      if (g.t >= upAt) { down = false; return [{ kind: 'up', zone: null, x: 180, y: 300 }] }
    }
  }
}
