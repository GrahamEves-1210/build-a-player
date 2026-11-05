// A human at the Throw engine. He reads the field through his reaction time, picks a man and how
// hard to throw it, presses a lead, holds, and lets go. Where he presses: where that man's route
// (drawn on the field) takes him by the time the ball gets there, hold included, plus aiming error.
// The table's `timing` is in ms; a press is in space. Two errors, both from it: judging the lead, 1 ms =
// 0.4 field units (avg about 17, two yards); and the finger on the glass, 1 ms = 0.3 screen units
// (avg about 13), which through the tilted camera costs more the further downfield he's aiming.
// His let-go is off by human.timing in ms too. A slip here is throwing to the wrong man.
const AIM = 0.4, FINGER = 0.3
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
let rnorm = () => 0
export default function makeBot(g, human, r, game) {
  return game === 'acc' ? acc(g, human, r) : play(g, human, r)
}
// (it aims at a spot on the field, so it goes through the camera and skips the press-on-a-man snap)
const press = (g, x, fy, finger = 0) => { const q = g.screenOf(x, fy); return [{ kind: 'down', zone: null, x: q.x + finger * rnorm(), y: q.y + finger * rnorm(), exact: true }] }
const release = () => [{ kind: 'up', zone: null, x: 180, y: 400 }]
// the lead, given how long he'll hold and how hard it'll go
function lead(g, p, pw) {
  const hold = pw * 350
  let air = 500
  const o = {}
  for (let i = 0; i < 3; i++) { g.project(p, hold + air, o); air = g.airTo(o.x, o.y, pw) }
  return { x: o.x, y: o.y, ms: hold + air, air, hold }
}
function laneClear(g, L) {
  const dx = L.x - g.QB.x, dy = L.y - g.QB.y
  for (const d of g.def) {
    for (let f = 0.15; f < 0.9; f += 0.15) {
      if (Math.hypot(d.x - (g.QB.x + dx * f), d.y - (g.QB.y + dy * f)) < 18) return false
    }
  }
  return true
}
function play(g, human, r, game) {
  rnorm = () => gauss(r)
  let nextRead = 0, plan = null
  const seeBy = human.react + 260
  // can anyone get there before it does? (a poorer eye judges that worse)
  const sep = (p, pw) => {
    const L = lead(g, p, pw)
    let near = Infinity, onHim = Infinity
    for (const d of g.back) {
      // the man on him runs with him wherever the ball goes: what counts is the step he's got on him.
      // Until he's by him, and the corner has turned, he hasn't got one.
      if (d.mark === p) { onHim = d.flip != null && d.y < p.y + 6 ? Math.hypot(d.x - p.x, d.y - p.y) : 8; continue }
      // where he is, and where he's headed
      const a = Math.hypot(d.x - L.x, d.y - L.y)
      const b = Math.hypot(d.x + (d.vx ?? 0) * L.ms * 0.7 - L.x, d.y + (d.vy ?? 0) * L.ms * 0.7 - L.y)
      // (a zone man is going to his spot: you can see the coverage by the way he drops)
      const c = d.spot ? Math.hypot(d.spot[0] - L.x, d.spot[1] - L.y) : Infinity
      const dd = Math.min(a, b, c)
      if (dd < near) near = dd
    }
    return { s: Math.min(near - 13 - 0.062 * L.air, onHim - 24) + gauss(r) * human.timing * 0.12, L }
  }
  // the bomb floats unless it has to go; a third-down throw wants some zip
  const POWERS = g.game === 'bomb' ? [0.35, 0.7, 0.1] : [0.55, 0.85, 0.25]
  return () => {
    if (g.phase !== 'run') return
    const rt = g.t - g.snap
    if (!plan) {
      if (rt < seeBy || rt < nextRead) return
      nextRead = rt + 110
      // the deadline: he sees the rush too
      const hurry = rt > g.sackAt - human.react - 1300
      let best = null
      for (const pw of POWERS) {
        for (const p of g.backs) {
          const { s, L } = sep(p, pw)
          if (L.y < g.need + 12) continue
          if (pw > 0.45 && !laneClear(g, L)) continue
          if (!best || s > best.s + 1) best = { p, s, pw }
        }
        if (best && best.s >= 6) break
      }
      if (!best) {
        if (!hurry) return
        best = { p: g.backs[Math.floor(r() * g.backs.length)], s: 0, pw: 0.5 }
      }
      if (best.s < 6 && !hurry) return
      let target = best.p
      // now and then he locks on the wrong man
      if (r() < human.slip) { const others = g.backs.filter(x => x !== best.p); target = others[Math.floor(r() * others.length)] }
      plan = { target, pw: best.pw, at: rt + Math.max(90, (human.react + gauss(r) * human.reactSd) * 0.45), upAt: 0 }
    }
    if (!g.hold && !plan.upAt) {
      if (rt < plan.at) return
      const L = lead(g, plan.target, plan.pw)
      const sd = human.timing * AIM
      plan.upAt = rt + Math.max(30, L.hold + gauss(r) * human.timing)
      return press(g, L.x + gauss(r) * sd, L.y + gauss(r) * sd, human.timing * FINGER)
    }
    if (g.hold && rt >= plan.upAt) return release()
  }
}
function acc(g, human, r) {
  rnorm = () => gauss(r)
  let rep = null, at = 0, upAt = 0
  return () => {
    if (g.phase !== 'run') { rep = null; return }
    if (rep !== g.rep) { rep = g.rep; at = (rep.read ?? 700) + human.react + gauss(r) * human.reactSd; upAt = 0 }
    const rt = g.t - rep.snap
    if (!g.hold) {
      if (upAt || rt < at) return
      const pw = 0.5
      const L = lead(g, rep, pw)
      const sd = human.timing * AIM * (rep.q ?? 1) * (r() < human.slip ? 3.5 : 1)
      upAt = rt + Math.max(30, L.hold + gauss(r) * human.timing)
      return press(g, L.x + gauss(r) * sd, L.y + gauss(r) * sd, human.timing * FINGER)
    }
    if (rt >= upAt) return release()
  }
}
