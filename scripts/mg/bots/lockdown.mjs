// A human on the ball in Lockdown: he watches the handler's body. A show (a jab, a hesi) and the real first step
// start the same, so a share of shows get a press: the bite the game punishes. The real step he reads like Iso's
// reach (cut.mjs): his reaction, a look at which way the ball went, and then his thumb. Assumed: avg about
// 530 ms from the first step to his thumb, poor 650, good 450, pro 370. A slipped thumb goes the wrong way.
const READ_MS = 130   // ms: which way is the ball going. The same for everyone
const READ = 0.2      // of his reaction, on top
const BITE = 3        // times his slip: how often a show gets a press
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  let move = -1, sawShow = 0, sawGo = false, plan = null
  return () => {
    if (g.i !== move) { move = g.i; sawShow = 0; sawGo = false; plan = null }
    if (g.cur.res || g.done) return
    const { show, go } = g.tell
    if (show && show !== sawShow) { sawShow = show; if (!plan && r() < human.slip * BITE) plan = { at: g.t + after() * 0.8, side: show } }
    if (!show) sawShow = 0
    if (go && !sawGo) {
      sawGo = true
      // (a bite already on its way stays on its way)
      if (!plan || plan.at > g.t + 90) plan = { at: g.t + after() + READ_MS + human.react * READ, side: r() < human.slip ? -go : go }
    }
    if (plan && g.t >= plan.at) {
      const p = plan
      plan = null
      return [{ kind: 'down', zone: p.side < 0 ? 'L' : 'R', x: p.side < 0 ? 90 : 270, y: 400 }]
    }
  }
}
