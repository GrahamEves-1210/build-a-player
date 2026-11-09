// A human attacking a cross, on a keyboard (the arrows move and aim, SPACE heads it). He picks a run for it: the
// near post, the back post or the spot. He waits for his marker to turn and watch the winger (a reaction after he
// does), then makes the run; a slip, or a slow read, and he goes while he's still being watched. Once it's in the air
// he gets under the ring and goes up as it closes, aimed at the side the keeper isn't on, with his timing error.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const after = () => Math.max(110, human.react + gauss(r) * human.reactSd)
  const run = r() < 0.4 ? { x: 2.6, z: -6.2 } : r() < 0.6 ? { x: -3.6, z: -7.6 } : { x: -0.4, z: -10.6 }
  const held = { L: 0, R: 0, U: 0, D: 0, S: 0 }
  const out = []
  let goAt = null, saw = false, jumped = false, jumpAt = null, aimSide = 0
  const key = (k, d) => { if (d && !held[k]) { held[k] = 1; out.push({ kind: 'key', zone: k }) } else if (!d && held[k]) { held[k] = 0; out.push({ kind: 'keyup', zone: k }) } }
  const toward = (x, z, tol = 0.35) => { const dx = x - g.me.x, dz = z - g.me.z; key('L', dx < -tol); key('R', dx > tol); key('U', dz > tol); key('D', dz < -tol) }
  return () => {
    out.length = 0
    if (g.done || g.res) { for (const k of Object.keys(held)) key(k, false); return out.length ? out.slice() : undefined }
    if (g.phase === 'mark') {
      // (he waits for the look as the winger shapes to cross it, the one that matters; now and then he goes on an earlier one)
      if (!saw && g.watching && (g.t > g.runMs - 700 || r() < 0.004)) { saw = true; goAt = g.t + after() * 0.75 }
      if (!saw && g.t > g.runMs - 700) { saw = true; goAt = g.t }   // (the cross is coming: go anyway)
      if (goAt != null && g.t >= goAt) toward(run.x, run.z)
      else toward(-0.8, -10.2, 0.6)
      return out.length ? out.slice() : undefined
    }
    if (g.phase === 'cross' && !jumped) {
      // get under it, then up as the ring closes, aiming away from the keeper
      if (jumpAt == null) { jumpAt = g.arriveAt - 250 + gauss(r) * human.timing * 1.3 + (r() < human.slip ? 110 : 0); aimSide = -(Math.sign(g.gk.x - g.to.x * 0.4) || 1) }
      const late = g.t > g.crossAt + after() * 0.6
      if (late && g.t < jumpAt - 90) toward(g.to.x, g.to.z, 0.25)
      else { key('U', false); key('D', false); key('L', aimSide < 0); key('R', aimSide > 0) }
      if (g.t >= jumpAt) { jumped = true; key('S', true) }
    } else if (jumped && held.S) key('S', false)
    return out.length ? out.slice() : undefined
  }
}
