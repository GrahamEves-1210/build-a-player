// A human at the Rush engine. The tackle's set is a body read: he has to see which of three things the
// man is doing, and a set he doesn't mean sells the same first step. Assumed, from cut.js's body read plus
// a third choice: avg about 600 ms from his commit to a thumb, poor 725, good 515, pro 420, and a get-off
// that's his plain touch reaction to the ball moving. Now and then he goes on the first step he sees,
// jumps on the hard count, or reads it wrong.
const READ_MS = 140   // ms: looking at his body. The same for everyone
const READ = 0.3      // of his reaction: which of three
const SWITCH = 0.18   // of his reaction: and he showed something else first
const BITE = 5        // times his slip: goes on a set the man doesn't mean
const MISREAD = 3.5   // times his slip: reads it wrong outright
const JUMP = 2        // times his slip: jumps on the hard count
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())

export default function makeBot(g, human, r, game) {
  return game === 'run-stuff' ? runBot(g, human, r) : rushBot(g, human, r)
}
function rushBot(g, human, r) {
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  let rep = -1, ex = 0, plan = null, off = null, sawHard = false, shownSet = null, sawFirst = null
  const press = zone => [{ kind: 'down', zone, x: 60 + zone * 120, y: 500 }]
  return () => {
    if (g.i !== rep) { rep = g.i; ex = 0; plan = null; off = null; sawHard = false; shownSet = null; sawFirst = null }
    const R = g.rep
    if (R.res) return
    if (g.phase === 'set') {
      if (g.tell.hard && !sawHard) { sawHard = true; if (r() < human.slip * JUMP) off = { at: g.t + after() * 0.7 } }
      if (off && g.t >= off.at) { off = null; return press(1) }
      return
    }
    if (!R.go) {
      off ??= { at: g.t + after() }
      if (g.t >= off.at) { off = null; return press(1) }
      return
    }
    if (R.won) return
    const { set, commit, ex: nowEx } = g.tell
    if (nowEx !== ex) { ex = nowEx; plan = null; shownSet = null; sawFirst = null }
    if (set && set !== shownSet) {
      shownSet = set
      sawFirst ??= set
      if (!commit && !plan && r() < human.slip * BITE) plan = { at: g.t + after(), mv: g.answers(set)[0] }
    }
    if (commit && (!plan || !plan.real) && set) {
      let mv = g.answers(set)[0]
      if (r() < human.slip * MISREAD) mv = ['inside', 'bull', 'edge'].filter(m => !g.answers(set).includes(m))[Math.floor(r() * 2) % 2] ?? mv
      plan = { at: g.t + after() + READ_MS + human.react * (READ + (sawFirst !== set ? SWITCH : 0)), mv, real: true }
      plan.tapped = false
    }
    if (plan && g.t >= plan.at && !plan.tapped) {
      plan.tapped = true
      const mv = plan.mv
      const z = r() < human.slip ? Math.floor(r() * 3) : g.zoneFor(mv)
      if (!plan.real) plan = null
      return press(z)
    }
  }
}

// The run: he reads the flow as a body read of two ways, slower when it's a counter (he has to see it
// come back); then he times the shed to the back running at him, a thing he can see coming.
const AIM = 58        // units off him he's trying to shed at
const SORT = 0.2      // of his reaction: which way
const FLIP = 0.2      // of his reaction: it came back
const AIM_ERR = 1.7   // times his timing, as an aim at something moving
function runBot(g, human, r) {
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  let rep = -1, plan = null, sawFlow = 0, sawCommit = false, aim = AIM, lastPress = -999, shedDone = false
  const press = zone => { lastPress = g.t; return [{ kind: 'down', zone, x: 60 + zone * 120, y: 500 }] }
  return () => {
    if (g.i !== rep) {
      rep = g.i; plan = null; sawFlow = 0; sawCommit = false; shedDone = false
      const V = 0.16
      aim = AIM + gauss(r) * human.timing * V * AIM_ERR - (human.react - 345) * V * 0.45
      if (r() < human.slip) aim += 40
    }
    const R = g.rep
    if (R.res || g.phase !== 'play') return
    const { flow, commit, D } = g.tell
    if (flow && flow !== sawFlow) {
      const first = !sawFlow
      sawFlow = flow
      if (first && !commit && r() < human.slip * BITE) plan = { at: g.t + after(), side: flow }
    }
    if (commit && !sawCommit) {
      sawCommit = true
      const flipped = R.fake
      let side = R.dir
      if (r() < human.slip * MISREAD) side = -side
      plan = { at: g.t + after() + READ_MS + human.react * (SORT + (flipped ? FLIP : 0)), side, then: R.dir }
    }
    if (plan && g.t >= plan.at) {
      const p = plan
      plan = p.then && p.then !== p.side ? { at: g.t + human.react * 1.3, side: p.then } : null
      return press(p.side < 0 ? 0 : 2)
    }
    if (!shedDone && sawCommit && !plan && D <= aim && g.t - lastPress > 1000 / human.rate) {
      shedDone = true
      return press(1)
    }
    // he's gone by and the thumb hasn't moved: everyone does press eventually
    if (!shedDone && !plan && R.rb.d < -10 && g.t - lastPress > 1000 / human.rate) { shedDone = true; return press(1) }
  }
}
