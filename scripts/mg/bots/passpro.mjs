// A human in pass pro. Every read is a body read, like the pass rush from the other side (bots/rush.mjs): he sees
// which way the rusher goes, through his reaction time, plus a beat to sort it out. Sometimes he goes on the first
// step he sees (a counter's show is made to get that), sometimes he reads it wrong. The punch is aimed at a moment
// he can see coming (the ring closing). A bull: he sees the pads drop and sits down on the anchor, and lets go when
// the man's stopped. A twist or a blitz: a little longer to see who's free.
const READ_MS = 140   // ms: looking at his body. The same for everyone
const READ = 0.3      // of his reaction: which way
const PICK = 0.4      // of his reaction: which of two men is free
const BITE = 5        // times his slip, on top of a base: goes on the counter's show
const MISREAD = 3     // times his slip: reads it wrong outright
const JUMP = 2        // times his slip: jumps on the hard count
const AIM_ERR = 1.6   // times his timing: the punch, at a moment he can see coming
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())

export default function makeBot(g, human, r) {
  const after = () => Math.max(120, human.react + gauss(r) * human.reactSd * 1.25)
  const bite = 0.06 + human.slip * BITE
  let rep = -1, plan = null, seenSide = null, seenType = null, seenFree = null, seenBull = false, punchFor = null, holding = false, upAt = null, sawHard = false, off = null
  const down = (zone, x = 60 + zone * 120) => ({ kind: 'down', zone, x, y: 560 })
  const up = zone => ({ kind: 'up', zone, x: 60 + zone * 120, y: 560 })
  return () => {
    const out = []
    if (upAt != null && g.t >= upAt) { upAt = null; out.push(up(1)) }
    if (g.i !== rep) { rep = g.i; plan = null; seenSide = null; seenType = null; seenFree = null; seenBull = false; punchFor = null; sawHard = false; off = null; if (holding) { holding = false; out.push(up(1)) } }
    const R = g.rep, tl = g.tell
    if (R.res || g.done) return out.length ? out : undefined
    if (g.phase === 'set') {
      if (tl.hard && !sawHard) { sawHard = true; if (r() < human.slip * JUMP) off = g.t + after() * 0.7 }
      if (off != null && g.t >= off) { off = null; out.push(down(1)); upAt = g.t + 80 }
      return out.length ? out : undefined
    }
    const type = tl.type
    if (type !== seenType) {
      // a new exchange: whatever he was about to do is moot
      if (holding && type !== 'anchor') { holding = false; out.push(up(1)) }
      seenType = type; seenSide = null; seenFree = null; seenBull = false
      if (plan && !plan.keep) plan = null
    }
    if (type === 'mirror' || type === 'recover') {
      if (tl.side && tl.side !== seenSide) {
        const first = seenSide == null
        seenSide = tl.side
        let side = tl.side
        if (type === 'mirror' && first && !tl.commit && r() < bite) plan = { at: g.t + after() * 0.8, side }
        else {
          if (r() < human.slip * MISREAD) side = -side
          const extra = type === 'recover' ? 60 : READ_MS + human.react * (READ + (first ? 0 : 0.18))
          plan = { at: g.t + after() + extra, side }
        }
      }
    } else if (type === 'pickup') {
      if (tl.free && tl.free !== seenFree) {
        seenFree = tl.free
        let side = tl.free
        if (r() < human.slip * MISREAD) side = -side
        plan = { at: g.t + after() + READ_MS + human.react * PICK, side }
      }
    } else if (type === 'punch') {
      if (punchFor !== tl.contactAt && tl.contactAt != null) {
        punchFor = tl.contactAt
        // he's coming: aim the punch at the moment the ring meets him
        let at = tl.contactAt + gauss(r) * human.timing * AIM_ERR
        if (r() < human.slip) at -= 160 + r() * 120   // a jumpy one
        plan = { at: Math.max(g.t + 90, at), mid: true }
      }
    } else if (type === 'anchor') {
      if (tl.bull && !seenBull) {
        seenBull = true
        plan = { at: g.t + after() + READ_MS * 0.6 + human.react * 0.2, hold: true }
      }
    }
    if (plan && g.t >= plan.at) {
      const p = plan
      plan = null
      if (p.hold) { if (!holding) { holding = true; out.push(down(1)) } }
      else if (p.mid) { out.push(down(1)); upAt = g.t + 70 }
      else {
        const z = r() < human.slip * 0.5 ? 1 : g.zoneFor(p.side)
        out.push(down(z)); if (z === 1) upAt = g.t + 70
      }
    }
    return out.length ? out : undefined
  }
}
