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
const SCAN = { 'hot-read': 250, gap: 250, 'jump-route': 260, 'zone-drop': 260, pnr: 300, 'rim-protect': 40 }
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

// Pass Pro: balance the bar. Hold the pad that pushes the marker back to the middle, leading it a little, and let
// go as it comes back (on an inside move or a spin, let go as soon as it's called)
function passproPilot(g) {
  let held = null, rep = -1
  const out = []
  const press = z => {
    if (held === z) return
    if (held) out.push({ kind: 'up', zone: held, id: 1 })
    if (z) out.push({ kind: 'down', zone: z, id: 1, hold: true })
    held = z
  }
  return () => {
    out.length = 0
    if (g.i !== rep) { rep = g.i; press(null) }
    const R = g.rep, tl = g.tell
    if (g.phase !== 'play' || R.res || R.beat || R.hurry) press(null)
    else if (tl.call && tl.call !== 'SPEED RUSH' && tl.call !== 'BULL RUSH' && g.t - tl.callAt > REACT * 0.6 && g.t - tl.callAt < REACT * 0.6 + 140) press(null)
    else {
      const ahead = tl.m + R.dm * 0.16
      if (ahead > tl.zone * 0.35) press(g.OUT)
      else if (ahead < -tl.zone * 0.35) press(g.IN)
      else if (Math.abs(ahead) < tl.zone * 0.12 || (held === g.OUT && ahead < 0) || (held === g.IN && ahead > 0)) press(null)
    }
    return out.length ? out.slice() : undefined
  }
}
// ── soccer ──────────────────────────────────────────────────────────────────
// (the free-control soccer games take keys, as Get a Bucket's pilot does: the arrows, SPACE, E)
const keyer = () => {
  const held = {}, out = []
  return { out, key: (k, d) => { if (d && !held[k]) { held[k] = 1; out.push({ kind: 'key', zone: k }) } else if (!d && held[k]) { held[k] = 0; out.push({ kind: 'keyup', zone: k }) } }, flush: () => (out.length ? out.splice(0) : undefined) }
}
// penalty: aim late in the run-up at a corner, two thirds of the power, the timed finish; if he goes early, the other way
function penaltyPilot(g) {
  const K = keyer()
  let side = g.tellSide ? -g.tellSide : 1, stage = 0, rel = 0
  return () => {
    if (g.done || g.res || g.phase === 'set') return K.flush()
    if (stage === 0 && g.phase === 'wait' && g.t > 1300) { K.key('S', true); stage = 1; rel = g.t + g.k.fill * 0.6 }
    if (stage >= 1 && g.struckAt == null) { if (g.kdive) side = -g.kdive; K.key(side < 0 ? 'L' : 'R', true); K.key(side < 0 ? 'R' : 'L', false); K.key('U', true) }
    if (stage === 1 && g.t >= rel) { K.key('S', false); stage = 2 }
    if (stage === 2 && g.k.phase === 'strike' && g.t >= g.k.strikeAt) { K.key('S', true); stage = 3 }
    return K.flush()
  }
}
// one-on-one: run at him, and from the edge of the box pick the far corner, the timed finish
function oneononePilot(g) {
  const K = keyer()
  let stage = 0, rel = 0
  return () => {
    if (g.done || g.res || g.phase === 'set') return K.flush()
    const b = g.bl, D = Math.hypot(b.x, b.z), near = Math.hypot(b.x - g.me.x, b.z - g.me.z)
    if (stage === 0) { K.key('U', D > 21); if (Math.abs(g.me.x) > 3) K.key(g.me.x > 0 ? 'L' : 'R', true); else { K.key('L', false); K.key('R', false) } }
    if (stage === 0 && D < 15.5 && near < 2.4) { K.key('U', false); const sd = -(Math.sign(g.gk.x - b.x * 0.3) || 1); K.key(sd < 0 ? 'L' : 'R', true); K.key(sd < 0 ? 'R' : 'L', false); K.key('S', true); stage = 1; rel = g.t + g.k.fill * 0.6 }
    if (stage === 1 && g.t >= rel) { K.key('S', false); stage = 2 }
    if (stage === 2 && g.k.phase === 'strike' && g.t >= g.k.strikeAt) { K.key('S', true); stage = 3 }
    return K.flush()
  }
}
// header: wait for him to watch the winger, then the run to the back post; up as the ring closes, away from the keeper
function headerPilot(g) {
  const K = keyer()
  let go = null, jumped = false
  return () => {
    if (g.done || g.res) return K.flush()
    if (g.phase === 'mark') {
      if (go == null && g.watching && g.t > g.runMs - 700) go = g.t + REACT * 0.3
      // (the back post: away from the side he marks you on)
      if (go != null && g.t >= go) { const dx = -3.8 - g.me.x, dz = -8 - g.me.z; K.key('R', dx > 0.3); K.key('L', dx < -0.3); K.key('U', dz > 0.3); K.key('D', dz < -0.3) }
      return K.flush()
    }
    if (!jumped && g.phase === 'cross') {
      if (g.t < g.arriveAt - 380) { const dx = g.to.x - g.me.x, dz = g.to.z - g.me.z; K.key('R', dx > 0.2); K.key('L', dx < -0.2); K.key('U', dz > 0.2); K.key('D', dz < -0.2) }
      else { K.key('U', false); K.key('D', false); const sd = -(Math.sign(g.gk.x - g.to.x * 0.4) || 1); K.key(sd < 0 ? 'L' : 'R', true); K.key(sd < 0 ? 'R' : 'L', false) }
      if (g.t >= g.arriveAt - 250) { jumped = true; K.key('S', true) }
    }
    return K.flush()
  }
}
// volley: in line with it, then first time, let go right as it gets to him
function volleyPilot(g) {
  const K = keyer()
  let stage = 0
  return () => {
    if (g.done || g.res) return K.flush()
    if (g.phase === 'drop' && stage < 2) {
      if (g.t < g.arriveAt - 420) { const dx = g.land.x - g.me.x, dz = g.land.z - g.me.z; K.key('R', dx > 0.2); K.key('L', dx < -0.2); K.key('U', dz > 0.25); K.key('D', dz < -0.25) }
      else { K.key('U', false); K.key('D', false); K.key('L', false); K.key('R', true) }
      if (stage === 0 && g.t >= g.arriveAt - 440) { K.key('S', true); stage = 1 }
      if (stage === 1 && g.t >= g.arriveAt) { K.key('S', false); stage = 2 }
    }
    return K.flush()
  }
}
// slalom: the way the arrow points, as the ring closes
function slalomPilot(g) {
  let k = -1
  return () => {
    if (g.done || g.phase !== 'run' || g.k >= g.n) return
    const c = g.cuts[g.k]
    if (g.k !== k && g.t >= c.arrive) { k = g.k; return [{ kind: 'down', zone: c.want < 0 ? 'L' : 'R', x: 0, y: 0 }] }
  }
}
// finishing: the arrows at the lit target, half the bar, the timed finish
function finishingPilot(g) {
  const K = keyer()
  let shot = -1, stage = 0, rel = 0
  return () => {
    if (g.done) return K.flush()
    if (g.phase !== 'aim') { K.key('S', false); return K.flush() }
    if (g.i !== shot) { shot = g.i; stage = 0 }
    const sh = g.shots[g.i], tx = sh.k % 2 ? 1 : -1, ty = sh.k < 2 ? 1 : sh.k < 4 ? -1 : 0
    K.key('L', tx < 0); K.key('R', tx > 0); K.key('U', ty > 0); K.key('D', ty < 0)
    const go = sh.spot.roll ? g.rollAt - g.k.fill * 0.5 - 180 : g.at + REACT + 200
    if (stage === 0 && g.t >= go) { K.key('S', true); stage = 1; rel = g.t + g.k.fill * 0.5 }
    if (stage === 1 && g.t >= rel) { K.key('S', false); stage = 2 }
    if (stage === 2 && g.k.phase === 'strike' && g.t >= g.k.strikeAt) { K.key('S', true); stage = 3 }
    if (stage === 3 && g.k.phase !== 'strike') K.key('S', false)
    return K.flush()
  }
}
// free kick: the curler, stick to the top corner on the wall's side, a good weight on it, the tap on the strike
function freekickPilot(g) {
  let st = 'aim', relAt = Infinity, tapped = false
  return () => {
    if (g.done) return
    const stick = { kind: 'stick', x: g.sgn * 0.93, y: 0.8 }
    if (st === 'aim') { if (g.phase !== 'aim' || g.t < 1300 + REACT + 200) return [stick]; st = 'hold'; relAt = g.t + 0.62 * 900; return [stick, { kind: 'key', zone: 'P' }] }
    if (st === 'hold' && g.t >= relAt) { st = 'tap'; return [{ kind: 'keyup', zone: 'P' }] }
    if (st === 'tap' && !tapped && g.k.phase === 'strike' && g.t >= g.k.strikeAt) { tapped = true; return [{ kind: 'key', zone: 'P' }, { kind: 'keyup', zone: 'P' }] }
  }
}
// 2-on-1: wait for the last man; he steps up, square it; he drops off, shoot low away from the keeper
function counterPilot(g) {
  let st = 'run', at = Infinity, relAt = Infinity, tapped = false
  return () => {
    if (g.done) return
    const out = [{ kind: 'stick', x: (g.gk.x > 0 ? -1 : 1) * 0.82, y: -0.35 }]
    if (st === 'run' && g.commitAt != null && at === Infinity) at = g.t + REACT
    if (st === 'run' && g.t >= at) {
      if (g.goes === 'ball') { st = 'done'; out.push({ kind: 'key', zone: 'P' }, { kind: 'keyup', zone: 'P' }) }
      else { st = 'hold'; relAt = g.t + 0.55 * 720; out.push({ kind: 'key', zone: 'S' }) }
    } else if (st === 'hold' && g.t >= relAt) { st = 'tap'; out.push({ kind: 'keyup', zone: 'S' }) }
    else if (st === 'tap' && !tapped && g.k.phase === 'strike' && g.t >= g.k.strikeAt) { tapped = true; out.push({ kind: 'key', zone: 'S' }, { kind: 'keyup', zone: 'S' }) }
    return g.shot || g.pass ? out.slice(1) : out
  }
}
// first touch: the foot it drops to as it gets there; then the foot the pass comes to
function firsttouchPilot(g) {
  let last = null
  return () => {
    if (g.done) return
    if (g.phase === 'ups' && g.t >= g.nextAt && last !== `u${g.ups}`) { last = `u${g.ups}`; return [{ kind: 'down', zone: g.side < 0 ? 'L' : 'R', x: 0, y: 0 }] }
    if (g.phase === 'pass' && !g.touch && g.t >= g.arriveAt && last !== `p${g.k}`) { last = `p${g.k}`; return [{ kind: 'down', zone: g.passes[g.k].side < 0 ? 'L' : 'R', x: 0, y: 0 }] }
  }
}
// ── baseball ────────────────────────────────────────────────────────────────
// at the plate: the zone on to where it's crossing, a swing at the strikes as it gets there (power when it's middle),
// the takes on the ones off the plate; batting practice, power every time
function atbatPilot(g) {
  let id = null, plan = null
  return () => {
    if (g.done || g.res || g.phase !== 'flight') return [{ kind: 'stick', x: 0, y: 0 }]
    const p = g.pitch
    if (id !== g.relAt) { id = g.relAt; const inz = Math.abs(p.to.x) <= 0.26 && p.to.y >= 0.47 && p.to.y <= 1.09; const mid = Math.abs(p.to.x) < 0.13; plan = { go: g.tee || inz, key: g.tee || (mid && g.count.s < 2) ? 'P' : 'S', at: g.arrive - (g.tee || (mid && g.count.s < 2) ? 155 : 135) } }
    if (g.t < g.relAt + REACT) return
    const dx = p.to.x - g.pci.x, dy = p.to.y - g.pci.y
    const out = [{ kind: 'stick', x: Math.abs(dx) < 0.01 ? 0 : Math.max(-1, Math.min(1, dx / 0.06)), y: Math.abs(dy) < 0.01 ? 0 : Math.max(-1, Math.min(1, dy / 0.06)) }]
    if (plan.go && !g.swing && g.t >= plan.at) { plan.go = false; out.push({ kind: 'key', zone: plan.key }, { kind: 'keyup', zone: plan.key }) }
    return out
  }
}
// on the mound: the catcher's sign, the glove to the corner (or the bullpen's spot), just under the red line, the release
function pitchPilot(g) {
  let id = null, plan = null
  return () => {
    if (g.done || g.res) return
    if (g.phase === 'set' && id !== `${g.n}|${g.bi}`) {
      id = `${g.n}|${g.bi}`
      const B = g.batters[g.bi]?.prof, away = B ? (B.hand > 0 ? 1 : -1) : 1
      const to = g.game === 'bullpen' ? g.target : g.game === 'pitch-velo' ? { x: 0, y: 0.78 } : g.count.s === 2 ? { x: away * 0.3, y: 0.4 } : { x: away * 0.18, y: 0.6 }
      plan = { to, ready: Math.max(g.at + 600, g.t + REACT * 2), held: false, rel: null, tapped: false, want: g.game === 'pitch-velo' ? 1 : 0.82 }
    }
    if (!plan) return
    if (g.phase === 'set') {
      const dx = plan.to.x - g.aim.x, dy = plan.to.y - g.aim.y
      const out = [{ kind: 'stick', x: Math.abs(dx) < 0.01 ? 0 : Math.max(-1, Math.min(1, dx / 0.08)), y: Math.abs(dy) < 0.01 ? 0 : Math.max(-1, Math.min(1, dy / 0.08)) }]
      if (!plan.held && g.t >= plan.ready && Math.hypot(dx, dy) < 0.02) { plan.held = true; plan.rel = g.t + g.k.fill * plan.want; out.push({ kind: 'key', zone: 'S' }) }
      return out
    }
    const out = [{ kind: 'stick', x: 0, y: 0 }]
    if (g.k.phase === 'power' && plan.rel != null && g.t >= plan.rel) { plan.rel = null; out.push({ kind: 'keyup', zone: 'S' }) }
    if (g.k.phase === 'deliver' && !plan.tapped && g.t >= g.k.strikeAt) { plan.tapped = true; out.push({ kind: 'key', zone: 'S' }, { kind: 'keyup', zone: 'S' }) }
    return out
  }
}
// on first: a good lead, then the read (a beat longer on a lefty), GO on the move home, BACK on the throw over
function stealPilot(g) {
  let seen = null, plan = null
  return () => {
    if (g.done || g.res) return
    const out = []
    if ((g.phase === 'lead' || g.phase === 'set') && g.goAt == null && !g.dive) { const d = 3.8 - g.lead; out.push({ kind: 'stick', x: Math.abs(d) < 0.08 ? 0 : Math.max(-1, Math.min(1, d / 0.4)), y: 0 }) }
    if (g.moveAt != null && seen !== g.moveAt) { seen = g.moveAt; plan = { at: g.moveAt + REACT + (g.lefty ? 230 : 0), key: g.move === 'home' ? 'S' : 'P' } }
    if (plan && g.t >= plan.at) { out.push({ kind: 'key', zone: plan.key }, { kind: 'keyup', zone: plan.key }); plan = null }
    return out.length ? out : undefined
  }
}
// in right field: on line, the crow hop, let go at the top
function ofarmPilot(g) {
  let rep = -1, held = false
  return () => {
    if (g.done) return
    if (g.rep !== rep) { rep = g.rep; held = false }
    if (g.phase === 'field' && !held && g.t >= g.at + REACT) { held = true; return [{ kind: 'key', zone: 'S' }] }
    if (g.phase === 'hop' && g.t - g.holdAt >= 360) return [{ kind: 'keyup', zone: 'S' }]
    if (g.phase === 'roll' || g.phase === 'field') return [{ kind: 'stick', x: -g.aim.x / 2, y: -0.3 }]
  }
}
const PILOTS = { passpro: passproPilot, catch: catchPilot, cone: conePilot, cut: cutPilot, dash: dashPilot, bench: benchPilot, calls: callsPilot, fastbreak: fastbreakPilot, goalline: goallinePilot, leverage: leveragePilot, lockdown: lockdownPilot, meter: meterPilot, oop: oopPilot, halfcourt: halfcourtPilot, read: readPilot, rebound: reboundPilot, rush: rushPilot, throw: throwPilot,
  penalty: penaltyPilot, oneonone: oneononePilot, header: headerPilot, volley: volleyPilot, slalom: slalomPilot, finishing: finishingPilot,
  freekick: freekickPilot, counter: counterPilot, firsttouch: firsttouchPilot,
  atbat: atbatPilot, pitch: pitchPilot, steal: stealPilot, ofarm: ofarmPilot }
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
export const AFTER = { default: 850, 'two-minute': 1300, bench: 300, nbench: 300, penalty: 1300, 'one-on-one': 1300, header: 1300, volley: 1300, 'free-kick': 1300, 'two-on-one': 1300, 'at-bat': 1500, 'walk-off': 1500, 'strike-out': 1500, 'escape-jam': 1500, 'steal-second': 1300 }

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
  passpro: { wait: 'KEEP THE MARKER IN THE MIDDLE', press: 'HOLD TO SLIDE WITH HIM' },
  throw: { wait: 'FIND THE OPEN MAN', press: "PRESS WHERE HE'S GOING", up: 'LET GO TO THROW' },
  halfcourt: { wait: 'SET HIM UP, THEN CROSS OVER' },
  penalty: { wait: 'PICK A CORNER, THEN RUN UP' },
  oneonone: { wait: 'THROUGH ON GOAL: PICK A SPOT' },
  header: { wait: 'MOVE WHEN HE’S BALL-WATCHING' },
  volley: { wait: 'GET IN LINE AND HIT IT FIRST TIME' },
  slalom: { wait: 'WATCH THE RING', press: '{T} THE WAY IT POINTS' },
  finishing: { wait: 'FIND THE TARGET AND STRIKE IT' },
  freekick: { wait: 'AIM FOR THE CORNER OVER THE WALL', press: 'HOLD CURL…', up: 'LET GO' },
  counter: { wait: 'WATCH THE LAST MAN', press: 'HE STEPS UP: PASS · HE DROPS OFF: SHOOT' },
  firsttouch: { wait: 'WATCH IT DROP', press: '{T} THE FOOT IT DROPS TO' },
  atbat: { wait: 'PICK UP THE SPIN', press: 'SWING AS IT GETS THERE' },
  pitch: { wait: 'SET THE GLOVE', press: 'HOLD PITCH…', up: 'TAP ON THE RELEASE' },
  steal: { wait: 'WATCH HIS FIRST MOVE', press: 'GO ON THE LEG KICK' },
  ofarm: { wait: 'LINE IT UP ON THE PLATE', press: 'HOLD THROUGH THE CROW HOP…', up: 'LET IT GO' },
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
  'zone-drop': { wait: 'EYES ON THE QB', press: '{T} THE MAN HE THROWS TO' },
  'pass-rush': { wait: 'WATCH THE BALL', press: ['GET OFF ON THE BALL', '{T} THE MOVE THAT BEATS HIM'] },
  sprint30: { wait: 'WAIT FOR THE WHISTLE', press: 'LEFT, RIGHT, IN RHYTHM' },
  sixty: { wait: 'WAIT FOR THE GUN', press: 'LEFT, RIGHT, IN RHYTHM' },
  'exit-velo': { wait: 'ZONE ON THE TOSS', press: 'DRIVE IT' },
  'pitch-velo': { wait: 'THE GUNS ARE UP', press: 'HOLD TO THE TOP…', up: 'TAP ON THE RELEASE' },
  spin: { wait: 'GRIP THE SLIDER', press: 'HOLD PITCH…', up: 'SNAP IT OFF' },
  bullpen: { wait: 'THE TARGET ON HIS GLOVE', press: 'HOLD PITCH…', up: 'TAP ON THE RELEASE' },
}
