// The how-to-play demos on each Advanced game's card (components/app/MgDemo.jsx): a perfect player for each
// engine, playing one good rep. Each pilot is the balance bot for its engine (scripts/mg/bots/<engine>.mjs) with
// the human taken out: one steady reaction time, no timing error, no slips, no bites. It only reads what's on the
// screen, the same as the bots, so it plays the real rules and never changes them.
//
//   pilotFor(game, g) → step()       called every 1/120 s before g.tick, returns the inputs to send right then
//                                    (a press that's held till an 'up' says hold: true, for the picture only)
//   firstRep(game, g) → true | false | null   how the demo's one rep went (null: not decided yet)
//   CAPTION[engine]                    a short line over the demo, only where the game's own prompt needs help
const REACT = 250          // ms: a sharp player seeing it and moving
const RATE = 12            // taps a second, flat out

// ── catch: a press as the ball or the hand gets there, on its side ─────────────────
function catchPilot(g) {
  let i = 0
  return () => {
    if (i < g.balls.length && g.t >= g.balls[i].arrive) {
      const b = g.balls[i++]
      return [{ kind: 'down', zone: b.side ? 'R' : 'L', x: b.side ? 270 : 90, y: 0 }]
    }
  }
}

// ── cone: a tap as the closing ring lands ───────────────────────────────────────
function conePilot(g) {
  let legId = -1, at = Infinity
  return () => {
    if (g.done || g.phase === 'set') return
    if (g.legId !== legId) { legId = g.legId; at = g.k < g.n ? Math.max(g.leg.arrive, g.t + REACT) : Infinity }
    if (g.t >= at) { at = Infinity; return [{ kind: 'down', zone: null, x: 180, y: 0 }] }
  }
}

// ── cut: wait out the jab, go the other way on the real step. Iso: the crossover when the arm comes down ─
function cutPilot(g) {
  if (g.iso) {
    let beat = -1, saw = false, at = Infinity
    return () => {
      if (g.i !== beat) { beat = g.i; saw = false; at = Infinity }
      if (g.cur.res) return
      if (g.tell.reach && !saw) { saw = true; at = g.t + REACT + 130 + REACT * 0.2 }
      if (g.t >= at) { at = Infinity; const side = -g.hand; return [{ kind: 'down', zone: side < 0 ? 'L' : 'R', x: 0, y: 0 }] }
    }
  }
  let man = -1, sawLean = 0, sawLunge = 0, plan = null
  return () => {
    if (g.i !== man) { man = g.i; sawLean = 0; sawLunge = 0; plan = null }
    if (g.cur.res) return
    const { lean, lunge } = g.tell
    if (lean && lean !== sawLean) sawLean = lean
    if (lunge && !sawLunge) {
      sawLunge = lunge
      const side = g.rev ? lunge : -lunge
      plan = { at: g.t + REACT + 110 + REACT * (0.2 + (sawLean && sawLean !== lunge ? 0.2 : 0)), side }
    }
    if (plan && g.t >= plan.at) { const s = plan.side; plan = null; return [{ kind: 'down', zone: s < 0 ? 'L' : 'R', x: 0, y: 0 }] }
  }
}

// ── dash: on the gun, then one press a stride, left and right in turn ────────────────
function dashPilot(g) {
  let foot = 0, goSeen = false, first = Infinity, aim = Infinity, aimFor = -1
  const press = side => [{ kind: 'down', zone: side ? 'R' : 'L', x: 0, y: 0 }]
  return () => {
    if (g.done || g.phase === 'set') return
    if (!goSeen) { goSeen = true; first = g.goAt + REACT }
    if (g.firstPress == null) {
      if (g.t < first) return
      foot = 1 - foot
      return press(foot)
    }
    const rate = 13 * (1 - Math.min(0.1, ((g.t - g.goAt) / 1000) * 0.016))
    if (aimFor !== g.strideN) { aimFor = g.strideN; aim = g.strideAt + Math.max(g.needMs * 0.9, 1000 / rate) }
    if (g.t < aim) return
    aim = g.t + 1000 / rate
    foot = g.last == null ? foot : 1 - g.last
    return press(foot)
  }
}

// ── bench: one thumb, flat out ────────────────────────────────────────────────
function benchPilot(g) {
  let next = REACT
  return () => {
    if (g.done || g.t < next) return
    next = g.t + 1000 / (RATE * (1 - Math.min(0.22, (g.t / 1000) * 0.018)))
    return [{ kind: 'down', zone: null, x: 180, y: 300 }]
  }
}

// ── calls: read the look, take the right call ──────────────────────────────────
function callsPilot(g) {
  let call = null, at = 0
  return () => {
    if (g.phase !== 'read') { call = null; return }
    // (slow enough to watch the read happen, well inside the play clock)
    if (call !== g.call) { call = g.call; at = call.at + Math.min(1700, g.T - 400) }
    if (g.t >= at) return [{ kind: 'down', zone: call.c, x: 60 + call.c * 120, y: 600 }]
  }
}

// ── fast break: watch the last man, go where he isn't ────────────────────────────
function fastbreakPilot(g) {
  let rep = -1, sawOpen = false, sawBait = false, at = Infinity, k = 0
  return () => {
    if (g.i !== rep) { rep = g.i; sawOpen = false; sawBait = false; at = Infinity }
    if (g.rep.res) return
    const open = g.cues.indexOf('open'), bait = g.cues.indexOf('bait')
    if (bait >= 0) sawBait = true
    if (open >= 0 && !sawOpen) {
      sawOpen = true; k = open
      at = g.t + REACT + 170 + (g.rep.n === 3 ? 60 : 0) + REACT * 0.45 + (sawBait ? REACT * 0.2 + 60 : 0)
    }
    if (g.t >= at) { at = Infinity; return [{ kind: 'down', zone: k, x: 60 + k * 120, y: 700 }] }
  }
}

// ── fourth & goal: a receiver cuts as the ring closes and takes it on the right shoulder; a QB leads the open man ─
function goallinePilot(g) {
  const down = () => [{ kind: 'down', zone: null, x: 180, y: 500 }]
  if (g.me) {
    let cut = false, caught = false
    return () => {
      if (g.phase !== 'run') return
      if (!cut && g.t >= g.me.breakAt) { cut = true; return down() }
      if (g.ball && !caught && g.t >= g.ball.land) { caught = true; return [{ kind: 'down', zone: g.side ? 'R' : 'L', x: 180, y: 500 }] }
    }
  }
  const target = g.open
  const seeAt = target.breakAt + 120 + REACT
  const pw = 0.8, holdMs = pw * 250
  let pressed = false, upAt = Infinity
  return () => {
    if (g.phase !== 'run') return
    if (!pressed && g.t >= seeAt) {
      pressed = true
      const o = {}
      let air = 400
      for (let i = 0; i < 3; i++) { g.project(target, holdMs + air, o); air = g.airTo(o.x, o.y, pw) }
      const q = g.screenOf(o.x, o.y)
      upAt = g.t + holdMs
      return [{ kind: 'down', zone: null, x: q.x, y: q.y, exact: true, hold: true }]
    }
    if (g.t >= upAt) { upAt = Infinity; return [{ kind: 'up', zone: null, x: 180, y: 400 }] }
  }
}

// ── leverage. Seal: press the side the rusher goes, once a move. Sneak: wait out the cadence, go on the snap ─
function leveragePilot(g, game) {
  if (game === 'sneak') {
    let next = Infinity, seen = false
    return () => {
      if (g.done || g.phase === 'cadence') return
      if (!seen) { seen = true; next = g.snapAt + REACT }
      if (g.t < next) return
      next = g.t + 1000 / RATE
      return [{ kind: 'down', zone: null, x: 180, y: 300 }]
    }
  }
  const seen = []
  let nextAt = 0, ripFor = null, second = 0, secondSide = 0
  const press = side => [{ kind: 'down', zone: side < 0 ? 'L' : 'R', x: side < 0 ? 90 : 270, y: 600 }]
  return () => {
    if (g.done) return
    seen.push({ t: g.t, bar: g.bar, m: g.cur })
    const lag = 150
    while (seen.length > 1 && seen[1].t <= g.t - lag) seen.shift()
    const now = seen[0]
    if (g.t < 1000 || now.t > g.t - lag + 40) return
    if (second && g.t >= second) { second = 0; return press(secondSide) }
    if (g.t < nextAt) return
    const m = now.m
    const side = Math.abs(now.bar) > 0.1 ? Math.sign(now.bar) : m ? m.dir : 0
    if (!side || (Math.abs(now.bar) < g.green * 0.3 && (!m || g.t < m.pushAt - 60))) return
    nextAt = g.t + (1000 / RATE) * 2.8
    if (m?.rip && ripFor !== m) { ripFor = m; second = g.t + 1000 / RATE; secondSide = side }
    return press(side)
  }
}

// ── lockdown: never on the show, slide with the real first step ──────────────────
function lockdownPilot(g) {
  let move = -1, sawGo = false, at = Infinity, side = 0
  return () => {
    if (g.i !== move) { move = g.i; sawGo = false; at = Infinity }
    if (g.cur.res || g.done) return
    const { go } = g.tell
    if (go && !sawGo) { sawGo = true; side = go; at = g.t + REACT + 130 + REACT * 0.2 }
    if (g.t >= at) { at = Infinity; return [{ kind: 'down', zone: side < 0 ? 'L' : 'R', x: side < 0 ? 90 : 270, y: 400 }] }
  }
}

// ── meter: press when it's his turn, let go dead on the mark ──────────────────────
function meterPilot(g) {
  let seen = null, pressAt = 0, upAt = 0, down = false
  return () => {
    const m = g.rep
    if (seen !== m) {
      if (m.phase !== 'ready') return
      seen = m; down = false; upAt = 0
      pressAt = g.t + REACT
    }
    if (m.phase === 'ready' && !down && g.t >= pressAt) { down = true; return [{ kind: 'down', zone: null, x: 180, y: 300, hold: true }] }
    if (m.phase === 'hold' && down) {
      if (!upAt) upAt = m.at + Math.max(95, m.c)
      if (g.t >= upAt) { down = false; return [{ kind: 'up', zone: null, x: 180, y: 300 }] }
    }
  }
}

// ── half-court: slide him one way, cross him back (a double tap), take it to the rim, lay it in ──────
function halfcourtPilot(g) {
  let stage = 0, at = 0, side = 1, up = false
  const K = s => (s > 0 ? 'R' : 'L')
  return () => {
    if (g.done || g.phase === 'set' || g.phase === 'over') return
    const H = g.men[g.h], D = Math.hypot(H.x, H.z)
    if (g.phase === 'shot') {
      const s = g.shot
      if (up && (!s?.c || g.t >= s.at + s.c)) { up = false; return [{ kind: 'keyup', zone: 'S' }] }
      return
    }
    const shoot = () => { up = true; stage = 9; return [{ kind: 'keyup', zone: 'L' }, { kind: 'keyup', zone: 'R' }, { kind: 'keyup', zone: 'U' }, { kind: 'key', zone: 'S' }] }
    if (stage < 9 && (D <= 6.4 || g.clock < 2500)) return shoot()
    if (stage === 0) { stage = 1; at = g.t + 520; side = g.mir > 0 ? 1 : -1; return [{ kind: 'key', zone: K(side) }] }
    if (stage === 1 && g.t >= at) { stage = 2; at = g.t; return [{ kind: 'keyup', zone: K(side) }, { kind: 'key', zone: K(-side) }] }
    if (stage === 2 && g.t >= at + 50) { stage = 3; return [{ kind: 'keyup', zone: K(-side) }] }
    if (stage === 3 && g.t >= at + 100) { stage = 4; return [{ kind: 'key', zone: K(-side) }, { kind: 'key', zone: 'U' }] }
    if (stage === 4 && -side * H.x > 3) { stage = 5; return [{ kind: 'keyup', zone: K(-side) }] }
  }
}

// ── alley-oop: go up as the lob reaches the ring, throw it down as the ring closes ─────
function oopPilot(g) {
  let seen = null, jumpAt = Infinity, tapAt = Infinity, jumped = false, tapped = false
  return () => {
    const b = g.rep
    if (seen !== b && g.t >= b.relAt) {
      seen = b; jumped = false; tapped = false; tapAt = Infinity
      jumpAt = Math.max(b.relAt + REACT, b.aimAt)
    }
    if (seen === b && b.caught && tapAt === Infinity) tapAt = Math.max(g.t + REACT * 0.5, b.slamAt)
    const out = []
    if (seen === b && !jumped && g.t >= jumpAt) { jumped = true; out.push({ kind: 'down', zone: null, x: 180, y: 400 }) }
    if (seen === b && !tapped && g.t >= tapAt) { tapped = true; out.push({ kind: 'down', zone: null, x: 180, y: 400 }) }
    return out.length ? out : undefined
  }
}

// ── read: find the man who's really open, tap him (or his lane) ──────────────────
const SCAN = { 'hot-read': 250, gap: 250, 'jump-route': 260, pnr: 300, 'rim-protect': 40 }
function readPilot(g, game) {
  const scan = SCAN[game] ?? 250, aimed = g.zones === 'none'
  let rep = -1, sawOpen = false, at = Infinity, k = 0
  const tap = k => { if (!aimed) return { kind: 'down', zone: k, x: 60 + k * 120, y: 300 }; const q = g.aimAt(k); return { kind: 'down', zone: null, x: q.x, y: q.y } }
  return () => {
    if (g.i !== rep) { rep = g.i; sawOpen = false; at = Infinity }
    if (g.rep.res) return
    const open = g.cues.indexOf('open'), bait = g.cues.indexOf('bait')
    if (open >= 0 && !sawOpen) {
      sawOpen = true; k = open
      at = g.t + REACT + scan + REACT * (game === 'rim-protect' ? 0.15 : 0.45) + (bait >= 0 ? REACT * 0.2 + 60 : 0) + (aimed ? REACT * 0.15 + 40 : 0)
    }
    if (g.t >= at) { at = Infinity; return [tap(k)] }
  }
}

// ── rebound: read the side off the iron, go up as it reaches the ring ──────────────
function reboundPilot(g) {
  let seen = null, at = 0, fired = true
  return () => {
    const b = g.rep
    if (seen !== b && g.t >= b.hitAt) { seen = b; fired = false; at = Math.max(b.hitAt + REACT, b.aimAt) }
    if (!fired && g.t >= at) { fired = true; return [{ kind: 'down', zone: b.side ? 'R' : 'L', x: b.side ? 270 : 90, y: 400 }] }
  }
}

// ── rush. Pass rush: get off on the ball, beat his set. Run stuff: read the flow, shed the block ─
function rushPilot(g, game) {
  const press = zone => [{ kind: 'down', zone, x: 60 + zone * 120, y: 500 }]
  if (game === 'run-stuff') {
    const AIM = 58 + (345 - REACT) * 0.16 * 0.45
    let rep = -1, plan = null, sawCommit = false, lastPress = -999, shedDone = false
    return () => {
      if (g.i !== rep) { rep = g.i; plan = null; sawCommit = false; shedDone = false }
      const R = g.rep
      if (R.res || g.phase !== 'play') return
      const { commit, D } = g.tell
      if (commit && !sawCommit) { sawCommit = true; plan = { at: g.t + REACT + 140 + REACT * (0.2 + (R.fake ? 0.2 : 0)), side: R.dir } }
      if (plan && g.t >= plan.at) { const s = plan.side; plan = null; lastPress = g.t; return press(s < 0 ? 0 : 2) }
      if (!shedDone && sawCommit && !plan && D <= AIM && g.t - lastPress > 1000 / RATE) { shedDone = true; lastPress = g.t; return press(1) }
      if (!shedDone && !plan && R.rb.d < -10 && g.t - lastPress > 1000 / RATE) { shedDone = true; lastPress = g.t; return press(1) }
    }
  }
  let rep = -1, ex = 0, plan = null, off = null, sawFirst = null
  return () => {
    if (g.i !== rep) { rep = g.i; ex = 0; plan = null; off = null; sawFirst = null }
    const R = g.rep
    if (R.res || g.phase === 'set') return
    if (!R.go) {
      off ??= { at: g.t + REACT }
      if (g.t >= off.at) { off = null; return press(1) }
      return
    }
    if (R.won) return
    const { set, commit, ex: nowEx } = g.tell
    if (nowEx !== ex) { ex = nowEx; plan = null; sawFirst = null }
    if (set) sawFirst ??= set
    if (commit && set && !plan) plan = { at: g.t + REACT + 140 + REACT * (0.3 + (sawFirst !== set ? 0.18 : 0)), mv: g.answers(set)[0], tapped: false }
    if (plan && g.t >= plan.at && !plan.tapped) { plan.tapped = true; return press(g.zoneFor(plan.mv)) }
  }
}

// ── throw: read who's open, press where he'll be, hold, let go ───────────────────
function lead(g, p, pw) {
  const hold = pw * 350
  let air = 500
  const o = {}
  for (let i = 0; i < 3; i++) { g.project(p, hold + air, o); air = g.airTo(o.x, o.y, pw) }
  return { x: o.x, y: o.y, ms: hold + air, air, hold }
}
function laneClear(g, L) {
  const dx = L.x - g.QB.x, dy = L.y - g.QB.y
  for (const d of g.def) for (let f = 0.15; f < 0.9; f += 0.15) if (Math.hypot(d.x - (g.QB.x + dx * f), d.y - (g.QB.y + dy * f)) < 18) return false
  return true
}
const pressAt = (g, x, fy) => { const q = g.screenOf(x, fy); return [{ kind: 'down', zone: null, x: q.x, y: q.y, exact: true, hold: true }] }
const letGo = () => [{ kind: 'up', zone: null, x: 180, y: 400 }]
function throwPilot(g, game) {
  if (game === 'acc') {
    let rep = null, at = 0, upAt = 0
    return () => {
      if (g.phase !== 'run') { rep = null; return }
      if (rep !== g.rep) { rep = g.rep; at = (rep.read ?? 700) + REACT; upAt = 0 }
      const rt = g.t - rep.snap
      if (!g.hold) {
        if (upAt || rt < at) return
        const L = lead(g, rep, 0.5)
        upAt = rt + Math.max(30, L.hold)
        return pressAt(g, L.x, L.y)
      }
      if (rt >= upAt) return letGo()
    }
  }
  let nextRead = 0, plan = null
  const seeBy = REACT + 260
  const sep = (p, pw) => {
    const L = lead(g, p, pw)
    let near = Infinity, onHim = Infinity
    for (const d of g.back) {
      if (d.mark === p) { onHim = d.flip != null && d.y < p.y + 6 ? Math.hypot(d.x - p.x, d.y - p.y) : 8; continue }
      const a = Math.hypot(d.x - L.x, d.y - L.y)
      const b = Math.hypot(d.x + (d.vx ?? 0) * L.ms * 0.7 - L.x, d.y + (d.vy ?? 0) * L.ms * 0.7 - L.y)
      const c = d.spot ? Math.hypot(d.spot[0] - L.x, d.spot[1] - L.y) : Infinity
      near = Math.min(near, a, b, c)
    }
    return { s: Math.min(near - 13 - 0.062 * L.air, onHim - 24), L }
  }
  const POWERS = g.game === 'bomb' ? [0.35, 0.7, 0.1] : [0.55, 0.85, 0.25]
  return () => {
    if (g.phase !== 'run') return
    const rt = g.t - g.snap
    if (!plan) {
      if (rt < seeBy || rt < nextRead) return
      nextRead = rt + 110
      const hurry = rt > g.sackAt - REACT - 1300
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
      if (!best) { if (!hurry) return; best = { p: g.backs[0], s: 0, pw: 0.5 } }
      if (best.s < 6 && !hurry) return
      plan = { target: best.p, pw: best.pw, at: rt + Math.max(90, REACT * 0.45), upAt: 0 }
    }
    if (!g.hold && !plan.upAt) {
      if (rt < plan.at) return
      const L = lead(g, plan.target, plan.pw)
      plan.upAt = rt + Math.max(30, L.hold)
      return pressAt(g, L.x, L.y)
    }
    if (g.hold && rt >= plan.upAt) return letGo()
  }
}

// Pass Pro: slide on his real step, punch as the ring closes, sit on a bull, take the free man
function passproPilot(g) {
  let rep = -1, plan = null, seen = null, punchFor = null, holding = false, upAt = null
  const down = z => ({ kind: 'down', zone: z, x: 60 + z * 120, y: 500 }), up = z => ({ kind: 'up', zone: z, x: 60 + z * 120, y: 500 })
  return () => {
    const out = []
    if (upAt != null && g.t >= upAt) { upAt = null; out.push(up(1)) }
    if (g.i !== rep) { rep = g.i; plan = null; seen = null; punchFor = null; if (holding) { holding = false; out.push(up(1)) } }
    const tl = g.tell
    if (g.rep.res || g.phase !== 'play') return out.length ? out : undefined
    if (holding && tl.type !== 'anchor') { holding = false; out.push(up(1)) }
    const key = [tl.type, tl.side, tl.free, tl.bull, tl.commit].join('|')
    if (key !== seen) {
      seen = key
      if ((tl.type === 'mirror' || tl.type === 'recover') && tl.side && tl.commit) plan = { at: g.t + REACT * 0.5, side: tl.side }
      else if (tl.type === 'pickup' && tl.free) plan = { at: g.t + REACT + 140, side: tl.free }
      else if (tl.type === 'anchor' && tl.bull) plan = { at: g.t + REACT, hold: true }
    }
    if (tl.type === 'punch' && tl.contactAt != null && punchFor !== tl.contactAt) { punchFor = tl.contactAt; plan = { at: tl.contactAt, mid: true } }
    if (plan && g.t >= plan.at) {
      const p = plan
      plan = null
      if (p.hold) { holding = true; out.push(down(1)) }
      else if (p.mid) { out.push(down(1)); upAt = g.t + 70 }
      else out.push(down(g.zoneFor(p.side)))
    }
    return out.length ? out : undefined
  }
}
const PILOTS = { passpro: passproPilot, catch: catchPilot, cone: conePilot, cut: cutPilot, dash: dashPilot, bench: benchPilot, calls: callsPilot, fastbreak: fastbreakPilot, goalline: goallinePilot, leverage: leveragePilot, lockdown: lockdownPilot, meter: meterPilot, oop: oopPilot, halfcourt: halfcourtPilot, read: readPilot, rebound: reboundPilot, rush: rushPilot, throw: throwPilot }
export const pilotFor = (botName, g, game) => PILOTS[botName]?.(g, game) ?? (() => undefined)

// How the demo's one rep went. Most games mark it in the first of their dots; the one-play games in done.
// The two-minute drill shows its first play, and the bench a few seconds of it.
export function firstRep(game, g) {
  if (game === 'two-minute') { if (g.i > 0) return true; return g.call?.blown ? !!g.call.ok : null }
  if (game === 'bench' || game === 'nbench') return g.done ? g.done.hit : g.t >= 4200 ? true : null
  const d = g.hud?.dots
  if (d?.length && d[0] != null) return d[0]
  return g.done ? !!g.done.hit : null
}
// ms the demo keeps playing once its rep is in (the payoff), before it starts again
export const AFTER = { default: 850, 'two-minute': 1300, bench: 300, nbench: 300 }

// A short line over the demo where the game's own prompt doesn't say what the thumb does. {T}: TAP or CLICK
export const CAPTION = {
  catch: { wait: 'WATCH THE BALL', press: '{T} AS IT GETS THERE' },
  cone: { wait: 'WATCH THE RING', press: '{T} AS IT CLOSES' },
  cut: { wait: "DON'T BITE ON THE FAKE", press: '{T} THE OTHER WAY' },
  dash: { wait: 'WAIT FOR THE GUN', press: 'LEFT, RIGHT, IN RHYTHM' },
  bench: { press: '{T} AS FAST AS YOU CAN' },
  calls: { wait: 'READ THE DEFENSE', press: '{T} THE RIGHT CALL' },
  fastbreak: { wait: 'WATCH THE LAST MAN', press: '{T} WHERE HE ISN\'T' },
  goalline: { wait: 'WATCH THE PLAY', press: '{T} NOW' },
  leverage: { wait: 'WATCH HIS SHOULDERS', press: '{T} THE SIDE HE GOES' },
  lockdown: { wait: "DON'T BITE ON THE HESI", press: '{T} WITH HIS FIRST STEP' },
  meter: { press: 'HOLD…', up: 'RELEASE' },
  read: { wait: 'FIND THE OPEN MAN', press: '{T} HIM' },
  rebound: { wait: 'WATCH THE RIM', press: '{T} THE SIDE IT COMES OFF' },
  rush: { wait: 'WATCH THE BALL', press: '{T} NOW' },
  passpro: { wait: 'WATCH HIS FIRST STEP', press: '{T} THE WAY HE GOES' },
  throw: { wait: 'FIND THE OPEN MAN', press: "PRESS WHERE HE'S GOING", up: 'LET GO TO THROW' },
  halfcourt: { wait: 'SET HIM UP, THEN CROSS OVER' },
}
// (per game, or game:pos, where the engine's line doesn't fit. press can be a list: the first press, the second...)
export const CAPTION_GAME = {
  'goal-line:qb': { wait: 'WATCH THE PLAY', press: "PRESS WHERE HE'S GOING", up: 'LET GO TO THROW' },
  'goal-line:rb': { wait: 'WATCH THE RING', press: ['{T} AS IT CLOSES', '{T} WHERE THE BALL IS'] },
  'goal-line:wr': { wait: 'WATCH THE RING', press: ['{T} AS IT CLOSES', '{T} WHERE THE BALL IS'] },
  'goal-line:te': { wait: 'WATCH THE RING', press: ['{T} AS IT CLOSES', '{T} WHERE THE BALL IS'] },
  'alley-oop': { wait: 'WATCH THE LOB', press: ['{T} TO GO UP', '{T} TO THROW IT DOWN'] },
  sneak: { wait: 'WAIT FOR THE SNAP', press: '{T} AS FAST AS YOU CAN' },
  gap: { wait: 'READ THE BLOCKS', press: '{T} THE OPEN LANE' },
  'run-stuff': { wait: 'READ THE RUN', press: ['{T} THE SIDE HE RUNS', 'SHED HIM'] },
  'pass-rush': { wait: 'WATCH THE BALL', press: ['GET OFF ON THE BALL', '{T} THE MOVE THAT BEATS HIM'] },
}
