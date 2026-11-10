// A human at Kick Return. Three jobs. The catch: the ball coming down is a thing he can see coming, so he
// aims a press at the moment it gets to him, with his timing error. The read: the wall shows the return (the
// seal, the lane opening), a read of three places; he holds across to it and lets go as he gets there, the
// coast guessed a beat late. A lane that closes on him he has to see happen and react to all over again.
// The moves: the man closing is another ring he can see coming, a little worse for something running at him.
// Now and then he reads the wrong lane, or presses the move far too soon.
const READ_MS = 120   // ms: looking at the wall. The same for everyone
const SORT = 0.3      // of his reaction: which of three lanes
const AGAIN = 0.25    // of his reaction: and it's moved
const MISREAD = 2.5   // times his slip: goes to the lane next to it
const JUMPY = 1.5     // times his slip: presses the moment the ring shows
const CATCH_ERR = 1.1 // times his timing: a ball dropping onto him
const AIM_ERR = 1.4   // times his timing: a man running at him
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())

export default function makeBot(g, human, r) {
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  let rep = -1, seen = 0, want = null, goAt = Infinity, held = null, hit = null, ringFor = null
  const at = z => ({ zone: z, x: 60 + z * 120, y: 500 })
  return () => {
    if (g.i !== rep) { held = null; rep = g.i; seen = 0; want = null; goAt = Infinity; hit = null; ringFor = null }
    const R = g.rep, tl = g.tell
    if (R.res || g.phase !== 'play') { if (held) { const z = held.z; held = null; return [{ kind: 'up', ...at(z) }] } return }
    // a ring: the catch, or the next man (aim at the moment it closes)
    const key = tl.ring ? `${tl.what}${R.j}` : null
    if (key && key !== ringFor) {
      ringFor = key
      const jumpy = tl.what !== 'catch' && r() < human.slip * JUMPY
      const err = gauss(r) * human.timing * (tl.what === 'catch' ? CATCH_ERR : AIM_ERR)
      hit = { at: jumpy ? g.t + after() * 0.5 : g.t + tl.rem + err, err, from: g.t, rem: tl.rem, tapped: false }
    }
    // (he's a little quicker or slower getting there than it looked: he keeps his aim on it)
    if (hit && !hit.tapped && tl.ring && Math.abs((g.t + tl.rem) - (hit.from + hit.rem)) > 60 && human.react < tl.rem) hit = { ...hit, at: g.t + tl.rem + hit.err, from: g.t, rem: tl.rem }
    if (hit && !hit.tapped && g.t >= hit.at) {
      hit.tapped = true
      const out = held ? [{ kind: 'up', ...at(held.z) }] : []
      held = null
      return [...out, { kind: 'down', ...at(1) }]
    }
    // the read: the lane on show, a new one
    if (tl.lane != null && tl.laneN !== seen) {
      const first = !seen
      seen = tl.laneN
      let lane = tl.lane
      if (r() < human.slip * MISREAD) lane = lane === 0 ? (r() < 0.5 ? -1 : 1) : 0
      want = g.laneX(lane) + gauss(r) * human.timing * 0.12
      goAt = g.t + after() + READ_MS + human.react * (SORT + (first ? 0 : AGAIN))
    }
    // the slide: held toward the lane, let go as he gets there
    const x = R.me.x
    if (held) {
      const left = (want - x) * held.dir
      if (want == null || left <= g.coast() * 0.8 + Math.abs(R.vx) * human.react * 0.12) { const z = held.z; held = null; want = left < -14 ? want : null; goAt = g.t + human.react * 0.6; return [{ kind: 'up', ...at(z) }] }
      return
    }
    if (want != null && g.t >= goAt && !R.wallDone) {
      if (Math.abs(want - x) < 9) { want = null; return }
      let z = want < x ? 0 : 2
      if (r() < human.slip) z = 2 - z
      held = { z, dir: z ? 1 : -1 }
      return [{ kind: 'down', ...at(z) }]
    }
  }
}
