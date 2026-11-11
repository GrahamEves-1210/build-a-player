// A human at Kick Return. He steers off what he saw a moment ago (his reaction), and his thumb wobbles (his
// timing): the stick never points exactly where he means it. Under the kick he reads its flight, off at first and
// truer as it comes down. With it, he looks for room: a fan of ways to go, the one with ground and nobody
// getting there first (lib/mg/kickret.js steer, the same read the demo makes, with the human put back in).
// He jukes a man closing in front of him, a beat late, and now and then at nothing.
import { steer } from '../../../src/lib/mg/kickret.js'
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const LOOK_MS = 110       // ms between his looks: he steers in little corrections, not every frame
const WOBBLE = 0.32       // radians of stick error, for an average thumb (timing 42 ms)
const READ_YD = 0.028     // yards of misread on the kick, a ms of his timing, while it's high

export default function makeBot(g, human, r) {
  const delay = (human.react * 0.6) / 1000
  const err = WOBBLE * (human.timing / 42)
  const misread = { x: gauss(r) * human.timing * READ_YD, d: gauss(r) * human.timing * READ_YD * 1.4 }
  let next = 0, jukeAt = Infinity, last = null, wob = 0
  return () => {
    if (g.done || g.phase !== 'live') return
    const out = []
    if (g.t >= next) {
      next = g.t + LOOK_MS + r() * 40
      const k = g.ball.state === 'air' ? Math.min(1, g.ball.z / 18) ** 1.5 : 0
      // (his thumb's error drifts: it doesn't jump from one side to the other every look)
      wob = wob * 0.6 + gauss(r) * err * 0.55
      const s = steer(g, { delay, err: 0, rnd: r, landErr: { x: misread.x * k, d: misread.d * k } })
      if (g.me.carry) { const a = (s.a ?? 0) + wob; s.x = Math.sin(a); s.y = Math.cos(a) }
      if (!last || Math.abs(s.x - last.x) > 0.05 || Math.abs(s.y - last.y) > 0.05) { last = s; out.push({ kind: 'stick', x: s.x, y: s.y }) }
      if (s.juke && jukeAt === Infinity && g.t - g.me.juke > 900) jukeAt = g.t + human.react * 0.55 + gauss(r) * human.timing
      else if (!s.juke && g.me.carry && jukeAt === Infinity && r() < human.slip * 0.15) jukeAt = g.t + 50
    }
    if (g.t >= jukeAt) { jukeAt = Infinity; out.push({ kind: 'juke' }) }
    return out.length ? out : undefined
  }
}
