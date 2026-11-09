// A human on the edge of the box as it drops, on a keyboard (the arrows move and aim, SPACE shoots, E touches). He
// gets in line with it (a reaction after it's headed out), then most hit it first time: SPACE held as it comes down,
// let go as it gets to him, with his timing error. The rest take a touch away from the defender and shoot.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const after = () => Math.max(110, human.react + gauss(r) * human.reactSd)
  const plan = r() < 0.6 ? 'volley' : 'touch'
  const held = { L: 0, R: 0, U: 0, D: 0, S: 0, P: 0 }
  const out = []
  let moveAt = null, pressAt = null, relAt = null, touchAt = null, stage = 'wait', aim = r() < 0.5 ? -1 : 1, tapAt = null
  const tryTimed = r() < (human.react < 250 ? 0.85 : human.react < 300 ? 0.6 : 0.25)
  const key = (k, d) => { if (d && !held[k]) { held[k] = 1; out.push({ kind: 'key', zone: k }) } else if (!d && held[k]) { held[k] = 0; out.push({ kind: 'keyup', zone: k }) } }
  return () => {
    out.length = 0
    if (g.done || g.res) { for (const k of Object.keys(held)) key(k, false); return out.length ? out.slice() : undefined }
    if (g.phase === 'drop' && moveAt == null) moveAt = g.t + after()
    if (g.phase === 'drop' && stage === 'wait') {
      // in line with where it's coming down
      if (moveAt != null && g.t >= moveAt && g.t < g.arriveAt - 380) { const dx = g.land.x - g.me.x, dz = g.land.z - g.me.z; key('L', dx < -0.25); key('R', dx > 0.25); key('U', dz > 0.3); key('D', dz < -0.3) }
      else if (g.t >= g.arriveAt - 380) { key('U', false); key('D', false); key('L', aim < 0); key('R', aim > 0) }
      if (plan === 'volley') {
        if (pressAt == null) { pressAt = g.arriveAt - 430 - r() * 80; relAt = g.arriveAt + gauss(r) * human.timing * 1.25 + (r() < human.slip ? 110 : 0) }
        if (g.t >= pressAt && !held.S) key('S', true)
        if (g.t >= relAt && held.S) { key('S', false); stage = 'done' }
      } else {
        if (touchAt == null) touchAt = g.arriveAt + gauss(r) * human.timing * 1.25
        if (g.t >= touchAt) { key('P', true); stage = 'touched'; relAt = null }
      }
    } else if (stage === 'touched' && g.phase === 'touched') {
      if (held.P) key('P', false)
      aim = -(Math.sign(g.df.x - g.me.x) || 1) * 0.8
      key('L', aim < 0); key('R', aim > 0)
      if (relAt == null && g.t > g.touch.at + after() * 0.5) { key('S', true); relAt = g.t + (0.6 + gauss(r) * 0.06) * g.k.fill + gauss(r) * human.timing * 1.4 }
      if (relAt != null && held.S && g.t >= relAt && g.k.phase === 'power') key('S', false)
      if (g.k.phase === 'strike' && tapAt == null) tapAt = g.k.strikeAt + gauss(r) * human.timing * 1.2
      if (tryTimed && tapAt != null && g.t >= tapAt && !held.S && g.k.phase === 'strike') { key('S', true); tapAt = Infinity }
    } else if (held.S && g.k.phase !== 'power') key('S', false)
    return out.length ? out.slice() : undefined
  }
}
