// A human in the Dunk Contest: each ring is a closing circle he can see coming, so he aims at it meeting its mark,
// with his hand's timing error and a little more for reading the ring (PERC). The rules can run slow in the air: his
// error is in real ms, so it shrinks in game ms by the rate there. A hold: he grips once he sees the ring and lets go
// on it. Now and then (slip) a jumpy thumb goes well early on one of the steps.
// Reading a ring takes time. One he's had in view for a good while (READ_MS, real) he times as well as he times
// anything; one that's barely up when it closes he can only react to: he's late by about his reaction time, and his
// timing on it is looser. (The bot before 11-24 aimed every ring with the same error however late it showed up, which
// is why the old medium dunks, a finish ring up for 0.2 s, measured far easier than they played.)
// The in-game dunk menu (g.phase 'pick'): he takes whatever's on the cursor, a beat later; the try's card (g.phase
// 'card') he taps away.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const PERC = human => 20 + human.timing * 0.5    // pro 26, good 33, avg 41, poor 51
const READ_MS = 450
export default function makeBot(g, human, r) {
  const sd = Math.hypot(human.timing, PERC(human))
  let slipK = -2, plan = null, upAt = Infinity, picked = false
  const down = () => ({ kind: 'down', zone: null, x: 180, y: 400 }), up = () => ({ kind: 'up', zone: null, x: 180, y: 400 })
  return () => {
    const out = []
    if (g.phase === 'pick') {
      if (!picked && (g.pickT ?? 0) >= 400) { picked = true; return [{ kind: 'key', zone: 'S' }] }
      return
    }
    // (the try's card: he taps it away once he's read it)
    if (g.phase === 'card') return (g.cardT ?? 0) >= 500 ? [{ kind: 'key', zone: 'S' }] : undefined
    if (g.phase !== 'run') return
    if (slipK === -2) slipK = r() < human.slip ? Math.floor(r() * g.steps.length) : -1
    if (g.t >= upAt) { upAt = Infinity; out.push(up()) }
    const s = g.steps[g.k]
    if (!s || g.fail || g.done || s.T == null) return out.length ? out : undefined
    // (when the ring is first drawn: the engine's showAt, which can be before it's live; or when it goes live)
    const vis = s.showAt ?? Math.max(s.cueAt, s.liveAt ?? 0)
    if (g.t < vis) return out.length ? out : undefined
    if (!plan || plan.k !== g.k) {
      const rate = s.rate || 1
      const upReal = (s.T - vis) / rate                 // (how long, real, he's had it in view when it closes)
      const short = Math.max(0, (READ_MS - upReal) / READ_MS)
      let at = s.T + gauss(r) * sd * (1 + 1.2 * short) * rate
      // (the soonest he can get there off a ring he's only now seeing: most of his reaction time)
      const react = (human.react * (0.55 + 0.4 * short) + gauss(r) * human.reactSd * 0.5) * rate
      at = Math.max(at, vis + Math.max(120 * rate, react))
      if (g.k === slipK) at = s.T - (s.W + (90 + r() * 160) * rate)
      plan = { k: g.k, at, grip: vis + Math.max(80, human.react + gauss(r) * human.reactSd) * rate, gripped: false }
    }
    if (s.kind === 'hold') {
      if (!plan.gripped && g.t >= Math.min(plan.grip, plan.at - 150 * s.rate)) { plan.gripped = true; upAt = Infinity; if (!g.held) out.push(down()) }
      if (plan.gripped && g.held && g.t >= plan.at) out.push(up())
    } else if (!plan.done && g.t >= plan.at) {
      plan.done = true; out.push(down()); upAt = g.t + 85
    }
    return out.length ? out : undefined
  }
}
