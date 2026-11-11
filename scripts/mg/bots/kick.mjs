// A human kicking: he watches a needle or a bar coming to a mark and presses when it gets there, through his own
// timing error (he can see it coming, so it is his timing that's off, not his reaction). He aims at the middle of
// the green on the aim bar; on the power bar he aims a little past the mark, nearer the top the longer the kick,
// and he doesn't swing over the top on purpose unless the kick is past his range. Now and then he just presses late.
// A needle that shakes (the game on it, not much nerve) he follows by its drift, not its jumps: his eye smooths it.
// The onside kick: the middle of the 10-to-13 on the distance bar, the ring as it closes, the leap as the ball comes down.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())

export default function makeBot(g, human, r, game) {
  const press = () => [{ kind: 'down', zone: null, id: 1, x: 180, y: 560 }, { kind: 'up', zone: null, id: 1, x: 180, y: 560 }]
  let phase = null, since = 0, err = 0, slip = false, from = 0, hist = []
  const fresh = () => { since = g.t; err = gauss(r) * human.timing; slip = r() < human.slip; from = 0; hist = [] }
  // what he's watching, and how fast it has been moving over the last tenth of a second
  const watch = val => {
    hist.push([g.t, val])
    while (hist.length > 2 && g.t - hist[0][0] > 110) hist.shift()
    const [t0, v0] = hist[0]
    return hist.length < 6 || g.t === t0 ? null : (val - v0) / (g.t - t0)
  }
  return () => {
    if (g.done) return
    if (g.phase !== phase) { phase = g.phase; fresh() }
    // he needs a moment to find the bar before he can time it
    if (g.t - since < human.react * 0.7) return
    if (game === 'onside') {
      if (g.phase === 'dist') {
        const y = g.yards(), v = watch(y)
        // on its way up through 10: he presses for 11.5
        if (v > 0 && y - v * err >= (slip ? 14.5 : 11.5)) return press()
        return
      }
      if (g.phase === 'strike') { if (g.ring() * 760 <= (slip ? -160 : err)) return press(); return }
      if (g.phase === 'hop' && g.leap == null) { if (g.t - g.hopAt() >= (slip ? 200 : err)) return press(); return }
      return
    }
    if (g.phase === 'aim') {
      const n = g.needle(), v = watch(n), c = g.centre()
      if (v == null) return
      // he lets it come to him: once it's out past the green he waits for it to come back, and presses as it crosses the middle
      if (!from) { if (Math.abs(n - c) > g.half() * 1.15 || Math.abs(n) > 0.9) from = Math.sign(n - c) || 1; return }
      const late = slip ? Math.min(g.half() * 1.3, 0.97 - Math.abs(c)) : 0
      if ((c - (n - v * err)) * from >= late && Math.sign(v) === -from) return press()
      return
    }
    if (g.phase === 'power') {
      const p = g.power(), v = watch(p)
      if (!(v > 0)) return
      const need = g.need()
      // the mark he swings for: between what it needs and the top; past his range, the last of the overswing
      const want = need >= 1 ? Math.min(1.12, need + 0.02) : need + (1 - need) * 0.55
      if (p >= 1.13 || p - v * err >= Math.min(1.14, slip ? want + 0.12 : want)) return press()
    }
  }
}
