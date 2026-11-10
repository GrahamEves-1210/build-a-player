// A human in pass pro. Every read is a body read: he sees the rusher's first step (wide, under or a bull) through
// his reaction time plus a beat to sort out which pad that is, then taps it, aiming at the moment the ring closes
// (a moment he can see coming). Sometimes he taps the wrong pad outright, sometimes he's jumpy and taps the moment
// he's decided, and now and then he guesses before the man has moved at all. A counter: he sees the show wide, then
// the step back under, and has to change his mind in time; sometimes he's already gone with the show.
const READ_MS = 140   // ms: looking at his body. The same for everyone
const READ = 0.3      // of his reaction: which pad that is
const BITE = 5        // times his slip, on top of a base: goes with a counter's show
const MISREAD = 3     // times his slip: the wrong pad outright
const GUESS = 1.5     // times his slip: taps before the man has moved
const AIM_ERR = 1.6   // times his timing: the tap, at a moment he can see coming
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())

export default function makeBot(g, human, r) {
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  const bite = 0.06 + human.slip * BITE
  let rep = -1, plan = null, seen = null, done = false
  const down = zone => ({ kind: 'down', zone, x: 60 + zone * 120, y: 560 })
  const wrong = z => [0, 1, 2].filter(k => k !== z)[Math.floor(r() * 2)]
  return () => {
    if (g.i !== rep) {
      rep = g.i; seen = null; done = false
      plan = r() < human.slip * GUESS ? { guess: true, delay: 80 + r() * 220, zone: Math.floor(r() * 3) } : null
    }
    const R = g.rep, tl = g.tell
    if (R.res || g.done || done || g.phase !== 'play') return
    if (plan?.guess && plan.at == null) plan.at = g.t + plan.delay
    if (tl.type && tl.type !== seen) {
      const first = seen == null
      seen = tl.type
      if (!plan?.guess && !(!first && plan && r() < bite)) {
        // which pad that is, then the tap: on the ring, or as soon as he's sure if that's later
        let zone = tl.zone
        if (r() < human.slip * MISREAD) zone = wrong(zone)
        const sure = g.t + after() + READ_MS + human.react * READ
        let aim = tl.contactAt + gauss(r) * human.timing * AIM_ERR
        if (r() < human.slip) aim = sure   // a jumpy one: as soon as he's decided
        plan = { at: Math.max(sure, aim), zone }
      }
    }
    if (plan && plan.at != null && g.t >= plan.at) {
      const z = plan.zone
      plan = null; done = true
      return [down(z)]
    }
  }
}
