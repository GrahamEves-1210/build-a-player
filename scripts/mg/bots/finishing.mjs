// A human at the finishing drill, on a keyboard (the arrows aim, SPACE shoots, E curls). For each ball he reads
// the lit target, holds the arrows toward it (across, and up for a top one, down for a bottom one), holds SPACE for
// about half the bar (a bit more from further out), lets go, and the better players tap again on the strike. The
// first-time ball he hits as it gets to him, with his timing. Now and then he curls the far-post ones.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const after = () => Math.max(110, human.react + gauss(r) * human.reactSd)
  const tryTimed = r() < (human.react < 250 ? 0.85 : human.react < 300 ? 0.6 : 0.25)
  const held = { L: 0, R: 0, U: 0, D: 0, S: 0, P: 0 }
  const out = []
  let shot = -1, goAt = 0, relAt = 0, tapAt = null, btn = 'S', stage = 'idle'
  const key = (k, d) => { if (d && !held[k]) { held[k] = 1; out.push({ kind: 'key', zone: k }) } else if (!d && held[k]) { held[k] = 0; out.push({ kind: 'keyup', zone: k }) } }
  return () => {
    out.length = 0
    if (g.done) { for (const k of Object.keys(held)) key(k, false); return out.length ? out.slice() : undefined }
    if (g.phase !== 'aim') { for (const k of Object.keys(held)) key(k, false); return out.length ? out.slice() : undefined }
    if (g.i !== shot) {
      shot = g.i; stage = 'look'; tapAt = null
      const sh = g.shots[g.i], tx = sh.k % 2 ? 1 : -1, ty = sh.k < 2 ? 1 : sh.k < 4 ? -1 : 0
      const far = Math.sign(sh.spot.x) === -tx && Math.abs(sh.spot.x) > 4
      btn = far && r() < 0.5 ? 'P' : 'S'
      g.__want = { tx: r() < human.slip ? -tx : tx, ty }
      goAt = sh.spot.roll ? g.rollAt - g.k.fill * 0.55 - 170 + gauss(r) * human.timing * 1.3 : g.t + after() + 200
    }
    const w = g.__want
    key('L', w.tx < 0); key('R', w.tx > 0); key('U', w.ty > 0); key('D', w.ty < 0)
    if (stage === 'look' && g.t >= goAt) { key(btn, true); stage = 'power'; relAt = g.t + (btn === 'P' ? 0.62 : 0.52 + gauss(r) * 0.05) * g.k.fill + gauss(r) * human.timing * 1.3 }
    if (stage === 'power' && g.t >= relAt) { key(btn, false); stage = 'struck' }
    if (stage === 'struck' && g.k.phase === 'strike') {
      if (tapAt == null) tapAt = g.k.strikeAt + gauss(r) * human.timing * 1.2
      if (tryTimed && btn === 'S' && g.t >= tapAt) { key('S', true); stage = 'tapped' }
    }
    if (stage === 'tapped' && g.k.phase !== 'strike') key('S', false)
    return out.length ? out.slice() : undefined
  }
}
