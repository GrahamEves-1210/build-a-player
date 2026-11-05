// A human at the Calls engine. Reading takes time: longer the slower you are (real players ran out
// of clock on the first version, so this is a slow, careful read), and a look with a whole defense
// to read takes a little longer than a down, a clock and three plays. Once it's read he's
// usually right, but not always. If the clock is about to run out he stabs at one.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r, game) {
  const M = game === 'two-minute' ? 12 : 12.6
  let call = null, at = 0, z = 0
  return () => {
    if (g.phase !== 'read') { call = null; return }
    if (call !== g.call) {
      call = g.call
      const read = (human.react + gauss(r) * human.reactSd) * M
      const stab = g.T - human.react * 0.6
      const wrong = r() < human.slip * 2
      if (read < stab) { at = call.at + read; z = wrong ? (call.c + 1 + Math.floor(r() * 2)) % 3 : call.c }
      else { at = call.at + stab; z = Math.floor(r() * 3) }
    }
    if (g.t >= at) return [{ kind: 'down', zone: z, x: 60 + z * 120, y: 600 }]
  }
}
