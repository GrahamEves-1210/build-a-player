// A human in pass pro: he balances the bar with his thumbs. He sees the marker late (his eyes and his thumb are a
// beat behind the screen), judges where it's going from how it's moving, and holds the pad that pushes it back,
// letting go as it comes back to the middle. He leads it a little to beat his own lag (a better player leads it
// more, so he overshoots less); he re-decides a few times a second, not every frame; now and then he holds the
// wrong pad. When the call changes (INSIDE MOVE, SPIN MOVE, RIP) he reacts to the word too: lets go of the slide
// he's on, unless he's already gone with the show.
const TRACK = 0.55   // of his reaction: watching a thing he's already watching, the lag is shorter
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())

export default function makeBot(g, human, r) {
  const hist = []                      // what the screen showed: [t, m]
  const lead = Math.min(0.95, Math.max(0.3, 1 - human.timing / 120))   // how much of his lag he makes up
  const every = 1000 / human.rate
  const bite = 0.08 + human.slip * 5
  let rep = -1, holding = null, nextAt = 0, wrongUntil = 0, call = null, callSeen = null, lag = 0, out = []
  const press = z => {
    if (holding === z) return
    if (holding) out.push({ kind: 'up', zone: holding, id: 1, x: holding === 'L' ? 90 : 270, y: 560 })
    if (z) out.push({ kind: 'down', zone: z, id: 1, x: z === 'L' ? 90 : 270, y: 560 })
    holding = z
  }
  const seen = at => {
    // the marker as it was at time at (the history is short: a snap is 3 s)
    for (let i = hist.length - 1; i >= 0; i--) if (hist[i][0] <= at) return hist[i][1]
    return hist.length ? hist[0][1] : 0
  }
  return () => {
    out = []
    if (g.i !== rep) { rep = g.i; hist.length = 0; call = null; callSeen = null; press(null); lag = human.react * TRACK }
    const R = g.rep, tl = g.tell
    if (g.done || R.res || R.beat || R.hurry || g.phase !== 'play') { press(null); return out.length ? out : undefined }
    hist.push([g.t, tl.m])
    if (hist.length > 600) hist.shift()
    // a new call: he reads the word
    if (tl.call !== call) { call = tl.call; if (call && call !== 'SPEED RUSH' && call !== 'BULL RUSH') callSeen = { at: g.t + Math.max(120, human.react + gauss(r) * human.reactSd), bit: r() < bite } }
    if (callSeen && g.t >= callSeen.at) { if (!callSeen.bit) { press(null); nextAt = g.t + every * 0.8 } callSeen = null }
    if (g.t < nextAt) return out.length ? out : undefined
    nextAt = g.t + every * (0.75 + r() * 0.5)
    const l = lag + gauss(r) * human.reactSd * 0.4
    const m0 = seen(g.t - l), m1 = seen(g.t - l - 70)
    const vel = (m0 - m1) / 0.07
    // where he thinks it's going, and where he thinks it'd be safe to let go
    const ahead = m0 + vel * ((l * lead) / 1000 + 0.06) + gauss(r) * human.timing / 400
    const th = tl.zone * 0.45, rel = tl.zone * 0.15
    let want = holding
    const outPad = g.OUT, inPad = g.IN
    if (ahead > th) want = outPad
    else if (ahead < -th) want = inPad
    else if (Math.abs(ahead) < rel || (holding === outPad && ahead < 0) || (holding === inPad && ahead > 0)) want = null
    if (g.t < wrongUntil) return out.length ? out : undefined
    if (want && r() < human.slip * 0.6) { want = want === outPad ? inPad : outPad; wrongUntil = g.t + every }
    press(want)
    return out.length ? out : undefined
  }
}
