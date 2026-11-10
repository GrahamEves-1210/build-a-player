// A human at Hit Stick. Two jobs. The read: he sees which hole the back is pressing (his feet and shoulders,
// the man getting washed out of it), a body read of six places, then taps across to it a gap at a time at his
// tapping rate. A jump cut or a bounce he has to see happen and react to all over again. The hit: the ring is a
// thing he can see coming, so he aims a tap at the moment it closes, with his timing error, a little worse for
// something that's moving at him. Now and then he reads the wrong hole, or gets there and taps far too soon.
const READ_MS = 120   // ms: looking at the back. The same for everyone
const SORT = 0.35     // of his reaction: which of six holes
const AGAIN = 0.25    // of his reaction: and he's changed his mind (a cut)
const MISREAD = 3     // times his slip: goes to the gap next to it
const JUMPY = 1.5     // times his slip: taps the moment the ring shows
const AIM_ERR = 1.4   // times his timing, as an aim at a man running at him
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())

export default function makeBot(g, human, r) {
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  let held = null, rep = -1, seen = 0, want = null, goAt = Infinity, hit = null, ringSeen = false
  const at = z => ({ zone: z, x: 60 + z * 120, y: 500 })
  return () => {
    if (g.i !== rep) { held = null; rep = g.i; seen = 0; want = null; goAt = Infinity; hit = null; ringSeen = false }
    const R = g.rep, tl = g.tell
    if (R.res || g.phase !== 'play') { if (held) { const z = held.z; held = null; return [{ kind: 'up', ...at(z) }] } return }
    // the read: a new hole on show
    if (tl.hole && tl.hole !== seen) {
      const first = !seen
      seen = tl.hole
      let hole = tl.hole
      if (r() < human.slip * MISREAD) { const n = Math.abs(hole), s = Math.sign(hole); hole = s * (n === 3 ? 2 : n === 1 ? (r() < 0.5 ? 2 : -1) : r() < 0.5 ? 1 : 3) }
      // (where he means to stop: about on it, off by his thumb's timing as he slides)
      want = g.holeX(hole) + gauss(r) * human.timing * 0.12
      goAt = g.t + after() + READ_MS + human.react * (SORT + (first ? 0 : AGAIN))
    }
    // the hit: aim at the ring closing
    if (tl.ring && !ringSeen) {
      ringSeen = true
      const jumpy = r() < human.slip * JUMPY
      hit = { at: jumpy ? g.t + after() * 0.5 : g.t + tl.rem + gauss(r) * human.timing * AIM_ERR, rem: tl.rem, from: g.t }
    }
    if (hit && !hit.tapped && tl.ring && Math.abs((g.t + tl.rem) - (hit.from + hit.rem)) > 70 && human.react < tl.rem) {
      const err = hit.at - (hit.from + hit.rem)
      hit = { at: g.t + tl.rem + err, rem: tl.rem, from: g.t }
    }
    if (hit && !hit.tapped && g.t >= hit.at) {
      hit.tapped = true
      const out = held ? [{ kind: 'up', ...at(held.z) }] : []
      held = null
      return [...out, { kind: 'down', ...at(1) }]
    }
    // the slide: held toward his spot, let go as he gets there (he sees it a beat late, so the coast is guessed)
    const x = R.me.x
    if (held) {
      const left = (want - x) * held.dir
      if (want == null || left <= g.coast() * 0.8 + Math.abs(R.vx) * human.react * 0.12 || R.tapAt != null) { const z = held.z; held = null; want = left < -14 ? want : null; goAt = g.t + human.react * 0.6; return [{ kind: 'up', ...at(z) }] }
      return
    }
    if (want != null && g.t >= goAt && !hit?.tapped && R.tapAt == null) {
      if (Math.abs(want - x) < 9) { want = null; return }
      let z = want < x ? 0 : 2
      if (r() < human.slip) z = 2 - z
      held = { z, dir: z ? 1 : -1 }
      return [{ kind: 'down', ...at(z) }]
    }
  }
}
