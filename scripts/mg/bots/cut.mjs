// A human at the Cut engine: he watches the man's body. Nothing marks the side, and a jab sells the same
// step and reach as the real commit, so he has to wait for it to go on past the jab, then read which way,
// then go. Assumed, from real two-way touch choices of 400-500 ms plus reading a body rather than a light:
// avg about 525 ms, poor 640, good 450, pro 370, and about 70-90 ms more when it's switched sides on him.
// The jab itself gets a press a lot of the time, which is the mistake the game punishes: the man then
// mirrors him and he has to cut all the way back. If his thumb slips he corrects it, if there's time.
const READ_MS = 110  // ms: looking at his body. The same for everyone
const READ = 0.2     // of his reaction: which way is he going
const SWITCH = 0.2   // of his reaction: and a fake that switched sides
const BITE = 5       // times his slip: how often a jab gets a press
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  if (g.iso) return isoBot(g, human, r)
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  const bite = human.slip * BITE
  const zone = s => (s < 0 ? 'L' : 'R')
  let man = -1, sawLean = 0, sawLunge = 0, plan = null
  return () => {
    if (g.i !== man) { man = g.i; sawLean = 0; sawLunge = 0; plan = null }
    if (g.cur.res) return
    const { lean, lunge } = g.tell
    if (lean && lean !== sawLean) {
      sawLean = lean
      if (r() < bite) plan = { at: g.t + after(), side: g.rev ? lean : -lean }
    }
    if (lunge && !sawLunge) {
      sawLunge = lunge
      const want = g.rev ? lunge : -lunge
      const sort = READ_MS + human.react * (READ + (sawLean && sawLean !== lunge ? SWITCH : 0))
      plan = { at: g.t + after() + sort, side: r() < human.slip ? -want : want, then: want }
    }
    if (plan && g.t >= plan.at) {
      const p = plan
      plan = p.then && p.then !== p.side ? { at: g.t + human.react * 0.8, side: p.then } : null
      return [{ kind: 'down', zone: zone(p.side), x: 0, y: 0 }]
    }
  }
}

// The crossover: he knows which way he's going (the other hand), so it's all in the when. A shoulder fake and
// the real reach start the same; he has to see the arm come down. Assumed: avg about 530 ms from the first
// move to his thumb, poor 650, good 450, pro 370. Sometimes the fake gets him.
const ISO_READ = 130, ISO_BITE = 2
function isoBot(g, human, r) {
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  let beat = -1, sawShade = false, sawReach = false, plan = null
  return () => {
    if (g.i !== beat) { beat = g.i; sawShade = false; sawReach = false; plan = null }
    if (g.cur.res) return
    const { shade, reach } = g.tell
    if (shade && !sawShade) { sawShade = true; if (r() < human.slip * ISO_BITE) plan = { at: g.t + after() * 0.8 } }
    if (!shade) sawShade = false
    if (reach && !sawReach) { sawReach = true; plan = { at: g.t + after() + ISO_READ + human.react * READ, slip: r() < human.slip } }
    if (plan && g.t >= plan.at) {
      const p = plan
      plan = null
      // a slipped thumb goes to the hand it's already in: a hesitation, and the clock's still running
      const side = p.slip ? g.hand : -g.hand
      return [{ kind: 'down', zone: side < 0 ? 'L' : 'R', x: 0, y: 0 }]
    }
  }
}
