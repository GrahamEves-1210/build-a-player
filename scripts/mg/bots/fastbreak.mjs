// A human at Fast Break. There's one man to watch, the last defender, and three answers: the wing he left,
// keep it, or (in a 3-on-2) the other wing. Nothing on the floor marks it: he has to see the man move and
// know what it means. Assumed, the same way as Read's (bots/read.mjs):
//   LOOK: seeing a defender's step for what it is. One man, but he's moving and so are you: about 170 ms
//   CHOOSE: of his reaction, turning that into a pad. Three of them, and a 3-on-2 has two men to square
// He goes on a fake now and then (a hard show looks like the real thing), sometimes he's guessing before
// the man's gone anywhere, and his thumb slips to the wrong pad.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const LOOK = 170          // ms: the step has to happen before it's a commit
const LOOK3 = 60          // more in a 3-on-2: where's the other man
const CHOOSE = 0.45       // of his reaction
const SORT = 0.2, SORT_MS = 60   // he's just seen a fake: is this one real
const MISREAD = 4.5       // times his slip: how often a fake gets him
const GUESS = 1.5         // times his slip: how often he's gone before anything's happened
export default function makeBot(g, human, r) {
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  const misread = human.slip * MISREAD
  let rep = -1, sawOpen = false, sawBait = false, plan = null
  const tap = k => ({ kind: 'down', zone: k, x: 60 + k * 120, y: 700 })
  const others = k => [0, 1, 2].filter(z => z !== k && g.live[z])
  return () => {
    if (g.i !== rep) {
      rep = g.i; sawOpen = false; sawBait = false; plan = null
      // impatience: he's made up his mind before the man has
      if (r() < human.slip * GUESS) { const live = [0, 1, 2].filter(z => g.live[z]); plan = { at: g.t + 600 + r() * 900, k: live[Math.floor(r() * live.length)], guess: true } }
    }
    if (g.rep.res) return
    const open = g.cues.indexOf('open'), bait = g.cues.indexOf('bait')
    if (bait >= 0 && !sawBait) {
      sawBait = true
      if (r() < misread && (!plan || plan.guess)) plan = { at: g.t + after() + LOOK, k: bait }
    }
    if (open >= 0 && !sawOpen) {
      sawOpen = true
      const cost = LOOK + (g.rep.n === 3 ? LOOK3 : 0) + human.react * CHOOSE + (sawBait ? human.react * SORT + SORT_MS : 0)
      let k = open
      if (r() < human.slip) { const o = others(open); k = o[Math.floor(r() * o.length)] }
      const at = g.t + after() + cost
      if (!plan || (plan.guess && plan.at > at)) plan = { at, k }
      else if (plan.guess) { /* he was always going there */ }
    }
    if (plan && g.t >= plan.at) {
      const k = plan.k
      plan = null
      return [tap(k)]
    }
  }
}
