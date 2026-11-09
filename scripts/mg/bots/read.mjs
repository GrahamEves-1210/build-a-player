// A human at the Read engine. There are no marks on the field, so what he has to do is scan: look at
// each man, see who has a step, check why. That takes time for anyone, more than seeing a light.
// Assumed, from real touch choice times of 450-650 ms with marked targets, plus a scan of the play:
//   avg about 750 ms to find the answer, about 880 ms when something else looks right too
//   poor about 890 / 1040, good about 660 / 780, pro about 560 / 660
// Each game's SCAN is what there is to take in (the coverage takes the longest; the 3-on-1 is one ball,
// so a real rise reads quickly: avg about 590 ms with the reach). And he misreads now and then: he goes for what looks right without seeing what's wrong with
// it. Slip: sometimes the thumb just goes to the wrong man. When he has to tap a man rather than a side
// of the screen he also has to reach, and the tap lands with some error.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const SCAN = { 'hot-read': 250, gap: 250, 'jump-route': 260, 'zone-drop': 260, pnr: 300, 'rim-protect': 40 }  // ms: looking across the play. The same for everyone
const MISREAD = { 'hot-read': 3.5, gap: 5, 'jump-route': 3.5, 'zone-drop': 3.5, pnr: 4.5, 'rim-protect': 5 }     // times his slip
const CHOOSE = 0.45    // of his reaction: settling on one man
const CHOOSE_ONE = 0.15 // the 3-on-1: he's already watching the man with the ball
const BITE = 2.5       // the 3-on-1: times his slip, how often a catch gets him going too soon
const SORT = 0.2       // of his reaction, plus SORT_MS: two men look right, which one is it
const SORT_MS = 60
const REACH = 0.15     // of his reaction, plus REACH_MS: finding one man and reaching for him
const REACH_MS = 40
const AIM = 13         // how far off a tap lands, sd
export default function makeBot(g, human, r, game) {
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  const scan = SCAN[game] ?? 250, misread = human.slip * (MISREAD[game] ?? 3.5)
  const n = g.cues.length, aimed = g.zones === 'none'
  let rep = -1, sawOpen = false, sawBait = false, plan = null, held = null
  const tap = k => { const q = aimed ? g.aimAt(k) : null; return aimed
    ? { kind: 'down', zone: null, x: q.x + gauss(r) * AIM, y: q.y + gauss(r) * AIM }
    : { kind: 'down', zone: k, x: 60 + k * 120, y: 300 } }
  return () => {
    if (g.i !== rep) { rep = g.i; sawOpen = false; sawBait = false; plan = null }
    if (g.rep.res) return
    const open = g.cues.indexOf('open'), bait = g.cues.indexOf('bait')
    if (g.carrier != null && g.carrier !== held) {
      held = g.carrier
      if (held >= 0 && !plan && open < 0 && r() < human.slip * BITE) plan = { at: g.t + after(), k: held }
    }
    if (bait >= 0 && !sawBait) {
      sawBait = true
      if (r() < misread && !plan) plan = { at: g.t + after() + scan * 0.6, k: bait }
    }
    if (open >= 0 && !sawOpen) {
      sawOpen = true
      const cost = scan + human.react * (game === 'rim-protect' ? CHOOSE_ONE : CHOOSE) + (bait >= 0 ? human.react * SORT + SORT_MS : 0) + (aimed ? human.react * REACH + REACH_MS : 0)
      let k = open
      if (r() < human.slip) k = (open + 1 + Math.floor(r() * (n - 1))) % n
      if (bait >= 0 && r() < misread) k = bait
      plan = { at: g.t + after() + cost, k }
    }
    if (plan && g.t >= plan.at) {
      const k = plan.k
      plan = null
      return [tap(k)]
    }
  }
}
