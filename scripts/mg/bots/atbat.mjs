// A human at the plate (the At-Bat, the Walk-Off, batting practice). He watches the ball out of the hand and keeps
// tracking it: after his reaction time his read on where it'll cross is rough (rougher the more it breaks, better once
// he's picked up the spin) and it sharpens as it comes, a beat behind what's on the screen. He steers the zone on to his
// read the way a thumb does (fast, then fine) and decides as he starts the swing: in the zone (as he reads it) he goes,
// off the plate he takes, unless he's fooled (a slip) or protecting with two strikes. His timing is aimed at the ball
// getting there, off by his timing error, and a changeup after a fastball gets him out front. CONTACT with two strikes,
// POWER when he's ahead in the count and it's out over the plate.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
const SW_MS = { contact: 135, power: 155 }
const LAG = 170   // ms: the eye on a moving ball, to the thumb
export default function makeBot(g, human, r) {
  const skill = Math.max(0, Math.min(1, (440 - human.react) / 225))
  const out = []
  let pitchId = -1, plan = null, held = false
  return () => {
    out.length = 0
    if (held) { out.push({ kind: 'keyup', zone: plan?.key ?? 'S' }); held = false }
    if (g.done || g.res) { out.push({ kind: 'stick', x: 0, y: 0 }); return out.slice() }
    if (g.phase !== 'flight') {
      // between pitches: the zone back toward the middle of the plate
      const dx = 0 - g.pci.x, dy = 0.78 - g.pci.y
      out.push({ kind: 'stick', x: Math.max(-1, Math.min(1, dx / 0.15)) * (Math.abs(dx) < 0.02 ? 0 : 1), y: Math.max(-1, Math.min(1, dy / 0.15)) * (Math.abs(dy) < 0.02 ? 0 : 1) })
      return out.slice()
    }
    const p = g.pitch
    if (pitchId !== g.relAt) {
      pitchId = g.relAt
      const brk = Math.hypot(p.M.x, p.M.y)
      plan = { seeAt: g.relAt + Math.max(150, human.react + gauss(r) * human.reactSd), nx: gauss(r), ny: gauss(r), brk, key: 'S', pressAt: null, go: null, decided: false }
      // the timing: aimed at it arriving; a slower one than he's just seen gets him out front
      const lastMph = g.last?.mph ?? p.mph, fooled = lastMph - p.mph > 5 ? -(lastMph - p.mph) * (5.5 - 4 * skill) : 0
      plan.err = gauss(r) * human.timing * 1.2 + fooled
    }
    if (g.t < plan.seeAt) return
    const picked = g.reveal != null
    const seen = Math.max(0, Math.min(1, (g.t - LAG - g.relAt) / p.T))
    const sd = ((0.11 - 0.055 * skill) + plan.brk * (picked ? 0.28 : 0.55)) * Math.pow(1 - seen, 1.25) + 0.012 + 0.01 * (1 - skill)
    const T = { x: p.to.x + plan.nx * sd, y: p.to.y + plan.ny * sd * 0.85 }
    if (!plan.decided) {
      // which swing: from his first read; when: aimed at it getting there
      plan.decided = true
      const pre = { x: p.to.x + plan.nx * sd * 1.3, y: p.to.y + plan.ny * sd * 1.1 }
      const middle = Math.abs(pre.x) < 0.14 && pre.y > 0.6 && pre.y < 0.98, two = g.count.s >= 2
      plan.key = g.tee ? 'P' : two ? 'S' : (g.count.b > g.count.s && middle) || (middle && r() < 0.3) ? 'P' : 'S'
      plan.pressAt = g.arrive - SW_MS[plan.key === 'P' ? 'power' : 'contact'] + plan.err
      plan.go = true
    }
    // the call to go or hold, as he starts the swing, on his read then
    if (plan.go === true && g.t >= plan.pressAt) {
      const two = g.count.s >= 2
      const inz = Math.abs(T.x) <= 0.27 && T.y >= 0.45 && T.y <= 1.11, near = Math.abs(T.x) <= 0.36 && T.y >= 0.36 && T.y <= 1.22
      let go = g.tee ? true : inz ? r() > 0.06 : two && near ? r() < 0.45 : r() < human.slip * 2 + 0.05
      if (g.count.b === 3 && g.count.s === 0) go = inz && r() < 0.3
      plan.go = go ? 'now' : false
    }
    // steer the zone on to his read
    const dx = T.x - g.pci.x, dy = T.y - g.pci.y, k = 0.06 + (1 - skill) * 0.05
    out.push({ kind: 'stick', x: Math.max(-1, Math.min(1, dx / k)) * (Math.abs(dx) < 0.01 ? 0 : 1), y: Math.max(-1, Math.min(1, dy / k)) * (Math.abs(dy) < 0.01 ? 0 : 1) })
    if (plan.go === 'now' && !g.swing) { out.push({ kind: 'key', zone: plan.key }); held = true; plan.go = false }
    return out.slice()
  }
}
