// A human in the trenches.
// seal: watches the rusher's shoulders and presses the side he goes, once a move, through a reaction lag.
// sneak: waits out the cadence (sometimes doesn't), reacts to the snap, then taps flat out.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r, game) { return game === 'sneak' ? sneakBot(g, human, r) : sealBot(g, human, r) }

function sealBot(g, human, r) {
  // he sees the fight through his reaction time, presses the side the rusher's on at his own pace, reads
  // the shoulder when it's clear, and now and then gets it the wrong way round. A rip: twice, fast.
  const misread = 0.03 + human.timing / 450 + human.slip
  const seen = []
  let nextAt = 0, ripFor = null, second = 0, secondSide = 0
  const press = side => [{ kind: 'down', zone: side < 0 ? 'L' : 'R', x: side < 0 ? 90 : 270, y: 600 }]
  return () => {
    if (g.done) return
    seen.push({ t: g.t, bar: g.bar, m: g.cur })
    const lag = Math.max(150, human.react + gauss(r) * human.reactSd * 0.3)
    while (seen.length > 1 && seen[1].t <= g.t - lag) seen.shift()
    const now = seen[0]
    if (g.t < 1000 || now.t > g.t - lag + 40) return
    if (second && g.t >= second) { second = 0; return press(secondSide) }
    if (g.t < nextAt) return
    const m = now.m
    // the bar first; if it's still in the middle, the shoulder he can see
    let side = Math.abs(now.bar) > 0.1 ? Math.sign(now.bar) : m ? m.dir : 0
    if (!side || (Math.abs(now.bar) < g.green * 0.3 && (!m || g.t < m.pushAt - 60))) return
    if (r() < misread) side = -side
    nextAt = g.t + (1000 / human.rate) * (2.2 + r() * 1.2)
    if (m?.rip && ripFor !== m) { ripFor = m; second = g.t + 1000 / human.rate; secondSide = side }
    return press(side)
  }
}

function sneakBot(g, human, r) {
  const form = 1 + gauss(r) * 0.08
  const jumpy = human.slip * 1.1
  let next = Infinity, seen = false, hutSeen = 0, base = -1
  const tap = [{ kind: 'down', zone: null, x: 180, y: 300 }]
  return () => {
    if (g.done) return
    if (g.phase === 'cadence') {
      if (g.base !== base) { base = g.base; hutSeen = 0 }
      // a dummy HUT is what jumps people
      if (g.hutN > hutSeen) {
        hutSeen = g.hutN
        if (r() < jumpy) { next = g.t + 90 + r() * 120; return }
      }
      if (g.t >= next && g.t >= g.fsAt + 800) { next = Infinity; return tap }
      return
    }
    if (!seen) { seen = true; next = g.snapAt + Math.max(120, human.react + gauss(r) * human.reactSd) }
    if (g.t < next) return
    next = g.t + Math.max(45, (1000 / (human.rate * form)) * (1 + gauss(r) * 0.12))
    if (r() < human.slip) return
    return tap
  }
}
