// A human in the Three-Point Contest. The meter is spot-up's, so the release is the meter bot's: aimed at the middle of
// the green with timing error, worse on a quicker meter, and now and then a finger comes off early. What's new is the
// rhythm. On a rack he can see the next ball coming up off it, so he's on the button about as it gets to his set (a
// better player a touch before, and the game starts the shot the moment it's there); the first ball at a new spot he
// has to see first. A shooter who's holding through the pick never waits on himself.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const FLOOR = 95   // (a let-go any sooner is a flinch, and the game ignores it)
export default function makeBot(g, human, r) {
  let seen = null, pressAt = Infinity, upAt = 0, down = false, prevSi = -1
  return () => {
    const m = g.rep
    if (!m || g.done || g.horned) return
    let out
    if (seen !== m && (m.phase === 'wait' || m.phase === 'ready')) {
      // (filled to the top and gone without him: his finger's still down)
      if (down) { down = false; out = [{ kind: 'up', zone: null, x: 180, y: 400 }] }
      seen = m; upAt = 0
      // in rhythm on a rack: on the button about when the ball's up. A new spot: he sees it, then goes
      const rhythm = m.si === prevSi
      const lag = rhythm ? (human.react - 300) * 0.9 + gauss(r) * human.reactSd * 0.7 : human.react * 0.7 + gauss(r) * human.reactSd
      pressAt = m.readyAt + Math.max(-140, lag)
      prevSi = m.si
      if (out) return out
    }
    if (seen === m && !down && (m.phase === 'wait' || m.phase === 'ready') && g.t >= pressAt) {
      down = true
      return [{ kind: 'down', zone: null, x: 180, y: 400 }]
    }
    if (seen === m && m.phase === 'hold' && down) {
      if (!upAt) {
        const quick = 900 / m.fill                       // a quicker meter is harder to feel
        const deep = m.kind === 'deep' ? 1.08 : 1          // and the deep ball's a longer, harder look
        const off = gauss(r) * human.timing * quick * deep
        const slip = r() < human.slip ? -(120 + r() * 160) : 0
        upAt = m.at + Math.max(FLOOR, m.c + off + slip)
      }
      if (g.t >= upAt) { down = false; return [{ kind: 'up', zone: null, x: 180, y: 400 }] }
    }
  }
}
