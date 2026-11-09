// A human in right field for the arm drill. While the ball rolls out he lines the throw up on the plate (off by his
// aim) and keeps it on a line; once it's in his glove he goes into the crow hop after his reaction time, and lets go
// aimed at the top of the meter, off by his timing.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const out = []
  let rep = -1, aimX = 0, holdAt = null, relAt = null
  return () => {
    out.length = 0
    if (g.done) return
    if (g.rep !== rep && g.phase === 'roll') { rep = g.rep; aimX = gauss(r) * 0.8; holdAt = null; relAt = null }
    if (g.phase === 'roll' || g.phase === 'field') {
      const dx = aimX - g.aim.x
      out.push({ kind: 'stick', x: Math.abs(dx) < 0.1 ? 0 : Math.max(-1, Math.min(1, dx / 1.5)), y: -0.35 })
    }
    if (g.phase === 'field' && holdAt == null) holdAt = g.at + Math.max(150, human.react + gauss(r) * human.reactSd)
    if (g.phase === 'field' && g.t >= holdAt) { out.push({ kind: 'key', zone: 'S' }); relAt = g.t + 360 + gauss(r) * human.timing * 1.25; holdAt = Infinity }
    if (g.phase === 'hop' && relAt != null && g.t >= relAt) { out.push({ kind: 'keyup', zone: 'S' }); relAt = null }
    return out.length ? out.slice() : undefined
  }
}
