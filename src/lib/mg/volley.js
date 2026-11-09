// VOLLEY: a corner's headed out and it drops on the edge of the box. It never drops the same way twice: a
// high looping one, one driven back at you at knee height, or one that bounces just in front of you (a half-volley),
// and it won't come straight to your feet. Two ways to finish it:
//   first time  hold SHOOT (SPACE) as it drops and let go as it gets to you: the release is the strike. Early and you
//               lean back and lift it over, late and you scuff it; the power bar is how hard. Aim with the stick.
//   a touch     TOUCH (E) as it gets to you, with the stick pointing at the target: a clean one sets it up and
//               opens the angle, a heavy one runs away from you. Then shoot (hold SHOOT, let go, tap again as you
//               strike it) before the defender charging out closes you down.
// Get in line with it first (the stick moves you): stretching for it costs accuracy. First touch is the touch's
// window, shot power the strike, finishing how clean the volley has to be.
import { byV, clamp, lerp, prog, outcome, rngOf, easeOut, easeIn, GOOD, GOLD, particles, nudge, manOf, lightMode } from './kit.js'
import { placeStamp } from './read.js'
import { camOf, P, staticStadium, net, goalFrame, ball, man, POSE, mix, runPose, kickPose, kitsOf, dress, boardWords, flashes, crowdUp, POST, BAR, NET_D,
  shooter, strikeOf, shotAt, keeperSave, shotHud, aimMark, celebration, scorerAt, mateAt, keeperBeaten, defenderBeaten, keeperRoar, strikerDenied, celebMs, skipOutro, padCtl, padInput, padStick, drawPads } from './soccer.js'

export const how = {
  volley: 'It drops on the edge of the box. Get in line with the stick, then hold SHOOT and let go as it arrives to volley it first time. Or TOUCH it as it arrives, the stick pointing at the target, and shoot before the defender closes in.',
}

const ME = { x: -1.5, z: -15.4 }, KEEP_Z = -0.7, RING = 620, HOLD = 700
const DROPS = {
  loop: { apex: 5.4, ms: 1550, y: 0.55, from: { x: 0.8, y: 2.6, z: -6.4 } },
  driven: { apex: 2.2, ms: 1050, y: 0.75, from: { x: 1.6, y: 2.4, z: -7.2 } },
  half: { apex: 4.2, ms: 1350, y: 0.5, from: { x: -0.4, y: 2.6, z: -6.8 }, bounce: true },
}

export function make({ v, seed, cast = null, situation = null }) {
  const r = rngOf(seed), tv = clamp((v - 1) / 10, 0, 1)
  const kind = ['loop', 'driven', 'half'][Math.floor(r() * 3)], D = DROPS[kind]
  const land = { x: ME.x + (r() - 0.5) * 2.6, z: ME.z + (r() - 0.5) * 1.2 }
  const startAt = 1300 + r() * 500, arriveAt = startAt + D.ms
  const Wv = byV(v, 55, 110), Wt = byV(v, 75, 150)
  const k = shooter(v, { fill: HOLD, windup: 170, pressure: situation ? 0.4 : 0.2 })
  const g = {
    t: 0, game: 'volley', zones: 'none', stick: true, pads: null, fx: [], done: null, outro: 2800, stamp: null,
    sit: situation ?? null, kind, D, land, startAt, arriveAt, Wv, Wt, k,
    phase: 'wait', me: { x: ME.x, z: ME.z, vx: 0, vz: 0, cycle: 0 }, df: { x: 1.8, z: -9.6, vx: 0, vz: 0, cycle: 0, st: 'hold' },
    touch: null, bl: null, shot: null, res: null, why: '', endAt: null, popAt: null, doneAt: null, ctl: padCtl(), vh: 640,
    who: { me: manOf(cast, 'us', 'st', 0), gk: manOf(cast, 'them', 'gk', 0), def: manOf(cast, 'them', 'cb', 0) },
    dirt: particles(24, 4), nudge: nudge(),
    hud: { prompt: 'WATCH IT DROP' },
    tick(dt) {
      g.t += dt
      const s = dt / 1000, o = padStick(g.ctl)
      if (g.phase === 'wait' && g.t >= startAt) { g.phase = 'drop'; g.fx.push('stamp'); g.hud.prompt = kind === 'half' ? 'IT’S GOING TO BOUNCE' : kind === 'loop' ? 'HIGH ONE, GET UNDER IT' : 'DRIVEN BACK AT HIM' }
      if (g.hud.prompt && g.t > startAt + 900) g.hud.prompt = null
      // moving into line with it (before it's on you), and on the ball after a touch
      if (!g.res && !g.shot && (g.phase === 'drop' || g.phase === 'wait' || g.phase === 'touched')) {
        const shaping = k.phase === 'power' && g.phase !== 'touched'
        const sp = g.phase === 'touched' ? 3.4 : shaping ? 0.8 : 3.4, acc = 1 - Math.exp(-s / 0.12)
        const ux = k.phase === 'idle' || g.phase !== 'touched' ? o.x : 0, uz = k.phase === 'idle' || g.phase !== 'touched' ? o.y : 0
        if (g.phase === 'touched') {
          // after a touch he goes on to it
          const dx = g.bl.x - g.me.x, dz = g.bl.z - 0.35 - g.me.z, d = Math.hypot(dx, dz)
          g.me.vx += ((d > 0.15 ? dx / d : 0) * Math.min(sp, d * 6) - g.me.vx) * acc; g.me.vz += ((d > 0.15 ? dz / d : 0) * Math.min(sp, d * 6) - g.me.vz) * acc
        } else { g.me.vx += (ux * sp - g.me.vx) * acc; g.me.vz += (uz * sp * 0.6 - g.me.vz) * acc }
        g.me.x = clamp(g.me.x + g.me.vx * s, -7, 5); g.me.z = clamp(g.me.z + g.me.vz * s, -18, -12.5)
        g.me.cycle += Math.hypot(g.me.vx, g.me.vz) * s / 2.2
      }
      // let it go by: it bounces past and they clear it
      if (g.phase === 'drop' && g.t > arriveAt + Math.max(Wv, Wt) * 2.2 && k.phase !== 'power') settle('cleared', 'Let it go by: they cleared it')
      if (g.phase === 'drop' && k.phase === 'power' && g.t > arriveAt + Wv * 2.5) volleyNow(g.t)
      if (g.phase === 'touched') {
        touchedTick(s)
        // aiming while he lines it up: no stick across is the far side from the keeper
        if (k.phase === 'power' || (k.phase === 'strike' && g.t < k.strikeAt - 30)) k.aimAt(Math.abs(o.x) > 0.2 ? o.x : (g.bl.x < 0 ? 0.6 : -0.6), o.y)
        if (k.tick(g.t)) strikeTouched()
      }
      defender(s)
      if (g.shot && !g.res) shotTick()
      if (g.endAt != null && !g.done && g.t >= g.endAt) finish()
    },
    input(a) {
      if (skipOutro(g, a)) return
      padInput(g.ctl, a, g.vh, { down: id => (id === 'S' ? sDown() : touchIt()), up: id => { if (id === 'S') sUp() } })
    },
  }
  // the ball, in the air on its way to you: where it is t ms after it was headed out
  g.dropAt = t => {
    const f = clamp((t - startAt) / D.ms, 0, 1.4)
    const y0 = D.from.y, y1 = D.y
    let y = lerp(y0, y1, Math.min(f, 1)) + Math.sin(Math.min(1, f) * Math.PI) * D.apex
    if (D.bounce && f > 0.78) { const b = Math.min(1, (f - 0.78) / 0.22); y = 0.11 + Math.sin(b * Math.PI * 0.5) * (y1 - 0.11) }
    if (D.bounce && f <= 0.78) y = lerp(y0, 0.11, f / 0.78) + Math.sin((f / 0.78) * Math.PI) * D.apex
    return { x: lerp(D.from.x, land.x, f), y: Math.max(0.11, f > 1 ? y1 - (f - 1) * 3 : y), z: lerp(D.from.z, land.z, f), spin: f * 12 }
  }
  const reachOf = () => Math.hypot(g.me.x - land.x, g.me.z - land.z)
  function sDown() {
    if (k.phase === 'strike' && g.phase === 'touched') { if (k.tap(g.t)) g.fx.push('h:light'); return }
    if (g.res || g.shot || k.phase !== 'idle') return
    if (g.phase === 'drop' || g.phase === 'wait') { k.press(g.t, 'volley'); return }
    if (g.phase === 'touched') k.press(g.t, padStick(g.ctl).y < -0.5 ? 'low' : 'driven')
  }
  function sUp() {
    if (k.phase !== 'power') return
    if (g.phase === 'drop' || g.phase === 'wait') return volleyNow(g.t)
    k.release(g.t)
  }
  // first time: the release is the strike
  function volleyNow(t) {
    if (g.shot) return
    k.power = clamp((t - k.at) / HOLD, 0, 1)
    const e = t - arriveAt, reach = reachOf()
    if (reach > 1.25) return settle('missed', 'Couldn’t get to it: swung at fresh air', true)
    if (Math.abs(e) > Wv * 1.8) return e < 0 ? miss('over', 'Snatched at it early: leaned back and skied it') : miss('missed', 'Too late: it was past him')
    const q = clamp(1 - Math.abs(e) / Wv, 0, 1)
    k.timed = q > 0.72 ? 'green' : q > 0.3 ? 'ok' : 'red'
    k.aimAt(padStick(g.ctl).x || -(Math.sign(-0.3) || 1) * 0.6, padStick(g.ctl).y)
    const at = g.dropAt(arriveAt)
    const s = strikeOf(k, { x: at.x, z: at.z }, { v, r, y0: at.y, weak: at.x < g.me.x - 0.3, speed: clamp(reach / 1.2, 0, 1) })
    // early: he's leaned back on it
    if (e < 0) { s.to.y += (-e / Wv) * 1.6; s.over = s.over || s.to.y > BAR; s.onTarget = s.onTarget && !s.over }
    g.shot = { ...s, at: t }
    k.phase = 'done'; k.relAt = t; k.strikeAt = t   // (the release is the strike: the bar stops)
    g.phase = 'shot'; g.choice = 'volley'
    keeperFor(g.shot)
    g.fx.push('stamp', 'h:medium')
  }
  function miss(kind, why) {
    const at = g.dropAt(Math.min(g.t, arriveAt))
    g.shot = { type: 'volley', from: { x: at.x, z: at.z, y: at.y }, to: { x: (r() - 0.5) * 6, y: kind === 'over' ? BAR + 3 : 0.3 }, T: 650, curve: 0, apex: kind === 'over' ? 2 : 0.2, power: 0.7, over: kind === 'over', wide: kind !== 'over', onTarget: false, at: g.t, speed: 20 }
    g.phase = 'shot'; g.choice = 'volley'
    g.fx.push('stamp')
    settle(kind, why, false, 700)
  }
  // the touch: as it arrives, with the stick where he wants it
  function touchIt() {
    if (g.phase !== 'drop' || g.touch || k.phase !== 'idle') return
    const e = g.t - arriveAt
    if (e < -Wt * 2.4) return
    const reach = reachOf()
    if (reach > 1.2 || Math.abs(e) > Wt * 2) return settle('cleared', reach > 1.2 ? 'Couldn’t get to it: they cleared it' : 'Miscontrolled it: they cleared it', true)
    const heavy = Math.abs(e) > Wt
    const o = padStick(g.ctl), d = Math.hypot(o.x, o.y) > 0.3 ? { x: o.x, z: Math.max(-0.3, o.y) } : { x: 0.2, z: 0.6 }
    const dl = Math.hypot(d.x, d.z) || 1, dist = heavy ? 2.1 : 0.75
    const at = g.dropAt(arriveAt)
    g.touch = { at: g.t, heavy }
    g.bl = { x: at.x, z: at.z, tx: at.x + (d.x / dl) * dist, tz: at.z + (d.z / dl) * dist, y: at.y }
    g.phase = 'touched'
    g.df.st = 'charge'; g.df.go = g.t + 260
    g.hud.prompt = heavy ? 'HEAVY TOUCH' : null
    g.fx.push('dribble', 'h:light')
  }
  function touchedTick(s) {
    const b = g.bl, a = (g.t - g.touch.at) / 1000
    const f = clamp(a / 0.38, 0, 1)
    b.x = lerp(b.x, b.tx, 0.18); b.z = lerp(b.z, b.tz, 0.18); b.y = Math.max(0.11, b.y * (1 - f))
    // (held too long, the defender's in: block)
  }
  function strikeTouched() {
    const b = g.bl
    const far = Math.hypot(b.x - g.me.x, b.z - g.me.z)
    const dPress = Math.hypot(g.df.x - b.x, g.df.z - b.z)
    const s = strikeOf(k, { x: b.x, z: b.z }, { v, r, pressure: clamp((2.6 - dPress) / 2, 0, 1), speed: clamp(far / 1.5, 0, 1) })
    g.shot = { ...s, at: g.t }
    g.phase = 'shot'; g.choice = 'touch'
    // the defender in the line of it blocks
    const lx = s.to.x - b.x, lz = -b.z, L = Math.hypot(lx, lz) || 1, tt = ((g.df.x - b.x) * lx + (g.df.z - b.z) * lz) / (L * L)
    if (tt > 0 && tt < 0.3 && Math.hypot(b.x + lx * tt - g.df.x, b.z + lz * tt - g.df.z) < (g.df.st === 'slide' ? 1.1 : 0.7)) g.shot.block = tt
    keeperFor(g.shot)
    g.fx.push('stamp', 'h:medium')
  }
  function keeperFor(s) { s.save = s.onTarget && s.block == null ? keeperSave(s, { x: -0.3 + clamp(g.me.x * 0.12, -0.8, 0.8), z: KEEP_Z, react: 240, reach: 0.8, up: 2.45, dive: 3.0 }, r) : null }
  function defender(s) {
    const d = g.df
    if (d.st === 'hold') return
    if (d.st === 'charge' && g.t >= d.go) {
      const tx = (g.bl?.x ?? g.me.x) + 0.2, tz = (g.bl?.z ?? g.me.z) + 0.9
      const dx = tx - d.x, dz = tz - d.z, dd = Math.hypot(dx, dz) || 1, sp = 5.6
      d.vx = (dx / dd) * sp; d.vz = (dz / dd) * sp
      d.x += d.vx * s; d.z += d.vz * s; d.cycle += sp * s / 2.5
      if (dd < 1.5) { d.st = 'slide'; d.at = g.t }
    }
    if (d.st === 'slide') {
      const a = g.t - d.at
      if (a < 380) { d.x += d.vx * s * 0.6; d.z += d.vz * s * 0.6 }
      if (!g.shot && !g.res && g.phase === 'touched' && a > 120) settle('blocked', 'Took too long: the defender closed him down and blocked it', true)
    }
  }
  function shotTick() {
    const s = g.shot, a = g.t - s.at
    if (s.block != null && a >= s.block * s.T) return settle('blocked', 'The defender got the block in')
    if (s.save?.saved && a >= s.save.f * s.T) return settle('saved', s.save.held ? 'Straight at the keeper' : 'On target, and a good save')
    if (a >= s.T && !g.res) {
      if (s.over) return settle('over', g.choice === 'volley' ? 'Leaned back: over the bar' : 'Over the bar')
      if (s.wide || !s.onTarget) return settle('wide', 'Dragged it wide')
      settle('goal', g.choice === 'volley' ? (s.timed === 'green' ? 'Caught it sweet on the volley' : 'Volleyed it in') : g.touch?.heavy ? 'Heavy touch, but he got it away' : 'Took a touch and finished it')
    }
  }
  function settle(kind, why, now = false, wait = 0) {
    if (g.res) return
    if (k.phase === 'power') { k.phase = 'done'; k.strikeAt = g.t }   // (no bar left filling once it's decided)
    g.res = kind; g.why = why; g.resAt = g.t; g.endAt = g.t + (wait || (now ? 380 : kind === 'goal' ? 120 : 60))
    if (kind === 'goal') {
      g.cel = celebration(`${seed}|vol`, { from: { x: g.me.x, z: g.me.z }, toward: { x: clamp(g.me.x + (g.me.x > -1 ? 1.8 : -1.8), -5, 3.5), z: g.me.z - 2.6 }, side: g.me.x > -1 ? 1 : -1, athletic: v >= 8, mates: [{ x: 3.6, z: -5.1 }, { x: -5.6, z: -8.1 }, { x: 2, z: -20 }] })
      g.kAt = { x: -0.3 + (Math.sign(g.shot.to.x) || 1) * 1.5, z: KEEP_Z, rot: (Math.sign(g.shot.to.x) || 1) * 1.42, ball: { x: clamp(g.shot.to.x, -3, 3), z: 1.5 } }
    }
  }
  function finish() {
    const goal = g.res === 'goal', vol = g.choice === 'volley'
    const q = goal ? clamp((vol ? 0.7 : 0.58) + (g.shot?.timed === 'green' ? 0.2 : 0.08), 0, 1) : clamp(0.08 + (g.res === 'saved' ? 0.15 : 0.05), 0, 0.4)
    g.done = outcome(q, goal, g.why); g.doneAt = g.t
    g.outro = goal ? celebMs() + 300 : lightMode() ? 1100 : 2200
    const word = { goal: 'GOAL', saved: 'SAVED', over: 'OVER THE BAR', wide: 'WIDE', blocked: 'BLOCKED', cleared: 'CLEARED', missed: 'MISSED IT' }[g.res]
    g.stamp = { text: word, good: goal, at: g.t, size: word.length > 9 ? 40 : 50 }
    if (goal) { g.popAt = g.t; g.fx.push('h:success') } else g.fx.push(g.res === 'saved' ? 'catchball' : 'deny', 'h:heavy')
  }
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
const camFor = view => camOf(view, { x: -0.9, y: 3.6, z: -24, F: 600, hzAt: 0.18 })
function ballNow(g) {
  const t = g.t, s = g.shot
  if (t < g.startAt) return null
  if (s) {
    const a = t - s.at
    if (s.block != null && a >= s.block * s.T) { const p = shotAt(s, s.block * s.T), b = clamp((a - s.block * s.T) / 700, 0, 1); return { x: p.x + 3 * b, y: 0.4 + Math.sin(b * Math.PI) * 1.6, z: p.z - 3 * b, spin: b * 10 } }
    if (s.save?.saved && a >= s.save.f * s.T) { if (s.save.held) return { x: s.save.x * 0.8, y: 0.8, z: KEEP_Z - 0.4, spin: 0, held: true }; const p = shotAt(s, s.save.f * s.T), b = clamp((a - s.save.f * s.T) / 520, 0, 1); return { x: p.x + Math.sign(p.x || 1) * 3 * b, y: Math.max(0.11, p.y + Math.sin(b * Math.PI) * 0.8), z: lerp(p.z, 2.2, b), spin: a / 30 } }
    if (a < s.T) return shotAt(s, a)
    const af = a - s.T
    if (g.res === 'goal') { if (g.kHold) return { x: g.kHold.x, y: 0.85, z: g.kHold.z - 0.25, spin: 0, held: true }; const b = clamp(af / 220, 0, 1), drop = clamp((af - 200) / 420, 0, 1); return { x: s.to.x * (1 + b * 0.1), y: Math.max(0.11, s.to.y - drop * drop * s.to.y), z: lerp(0, NET_D - 0.3, easeOut(b)), spin: 14 } }
    const b = clamp(af / 600, 0, 1)
    return { x: s.to.x * (1 + b * 0.3), y: s.to.y + b * (s.over ? 1.5 : 0), z: b * 6, spin: 14 }
  }
  if (g.bl) return { x: g.bl.x, y: g.bl.y, z: g.bl.z, spin: t / 50 }
  const p = g.dropAt(t)
  if (g.res === 'cleared' && t > g.arriveAt) { const a = (t - g.arriveAt) / 1000; return { x: p.x - a * 3, y: Math.max(0.11, 0.6 - a), z: p.z - a * 6, spin: 8 } }
  return p
}
function meAt(g) {
  const t = g.t, s = g.shot, me = g.me
  if (g.res === 'goal' && g.cel) return null
  if (s) {
    const a = t - s.at
    if (a < 300) { const kp = kickPose(0.45 + 0.55 * easeOut(a / 300), 1, { high: g.choice === 'volley' }); return { x: me.x, z: me.z, pose: g.choice === 'volley' ? { ...kp, lean: kp.lean - 0.28, hy: kp.hy - 3 } : kp } }
    if (!g.res) return { x: me.x, z: me.z, pose: kickPose(1) }
    return { x: me.x, z: me.z, pose: strikerDenied(g.res === 'blocked' ? 'tackle' : 'save', t - g.resAt - 200, kickPose(1)) }
  }
  if (g.res) return { x: me.x, z: me.z, pose: strikerDenied('miss', t - g.resAt, POSE.ready) }
  if (g.k.phase === 'power' || g.k.phase === 'strike') return { x: me.x, z: me.z, pose: kickPose(0.42 * clamp((t - g.k.at) / 500, 0, 1), 1) }
  if (g.touch) { const a = t - g.touch.at; if (a < 200) return { x: me.x, z: me.z, pose: { ...kickPose(0.25), ry: -20, rx: 6, hy: 50 } } }
  const sp = Math.hypot(me.vx, me.vz)
  if (sp > 0.5) return { x: me.x, z: me.z, pose: runPose(me.cycle % 1, clamp(sp / 4, 0.3, 0.8)) }
  return { x: me.x, z: me.z, pose: { ...POSE.ready, hlx: -26, hly: -64, hrx: 24, hry: -60, tilt: g.phase === 'drop' ? 0.8 : 0.2 } }
}
function defenderAt(g) {
  const d = g.df
  if (g.res === 'goal') return defenderBeaten(0, g.t - g.endAt, POSE.ready)
  if (d.st === 'slide') return { ...POSE.slide, hy: 22, lk: 0, rk: 0, face: 0, tilt: 0, lx: -22, ly: -6, rx: 20, ry: -10, hlx: -36, hly: -48, hrx: 30, hry: -44, rot: -0.5 }
  if (d.st === 'charge' && g.t > d.go) return runPose(d.cycle % 1, 1)
  return { ...POSE.ready, head: -0.3, tilt: 0.4 }
}
function keeperAt(g) {
  const t = g.t, s = g.shot, x0 = -0.3 + clamp(g.me.x * 0.12, -0.8, 0.8)
  if (g.res === 'goal' && g.cel) return null
  const bob = Math.abs(Math.sin(t / 170)) * 2.5
  if (!s || t < s.at) return { x: x0, lift: 0, pose: { ...(g.phase === 'wait' ? POSE.ready : POSE.set), hy: (g.phase === 'wait' ? 49 : 44) + bob } }
  const a = prog(t, s.at + 40, s.at + Math.max(220, (s.save?.f ?? 1) * s.T)), dir = Math.sign((s.save?.x ?? s.to.x) - x0) || 1
  if (g.res === 'saved' && t - g.resAt > 450) return { x: x0 + dir * 0.6, lift: 0, pose: keeperRoar(t - g.resAt - 450, POSE.stand) }
  if (s.save?.held) return { x: x0, lift: 0, pose: mix(POSE.set, { ...POSE.set, hlx: -8, hly: -64, hrx: 8, hry: -64 }, a) }
  if (!s.onTarget) return { x: x0, lift: 0, pose: mix(POSE.set, POSE.stand, a) }
  return { x: x0 + dir * 1.5 * easeOut(a), lift: Math.sin(a * Math.PI) * 0.45, pose: { ...POSE.dive, rot: dir * 1.4 * easeOut(a) } }
}
// the box after a corner: a few of theirs and ours, all eyes on it
const EXTRAS = [{ x: 0.6, z: -6.2, side: 'them', n: 15, header: true }, { x: -3.4, z: -4.2, side: 'them', n: 3 }, { x: 3.6, z: -5.1, side: 'us', n: 5 }, { x: -5.6, z: -8.1, side: 'us', n: 10 }, { x: 4.4, z: -3.0, side: 'them', n: 2 }]
export function draw(ctx, g, view) {
  g.vh = view.h
  const C = camFor(view), K = kitsOf(view), team = [view.colors.us, view.colors.trim], away = [view.colors.them, view.colors.themTrim ?? '#f4efe6']
  staticStadium(ctx, view, C, 'volley', { team, away, board: boardWords(g) })
  if (g.popAt != null && !view.empty) { crowdUp(ctx, C, team, g.t - g.popAt, 2400, away); flashes(ctx, C, view, g.t - g.popAt) }
  const b = ballNow(g), s = g.shot
  const ripple = g.res === 'goal' ? { x: s.to.x, y: s.to.y, at: s.at + s.T + 80 } : null
  net(ctx, C, ripple, g.t)
  if (b && b.z > 0.05 && !b.held) ball(ctx, C, b.x, b.y, b.z, b.spin)
  goalFrame(ctx, C)
  const gkLook = dress(K.gk, g.who.gk ?? { number: 1, skin: '#c09060' }, { front: true, sleeves: true }), meLook = dress(K.us, g.who.me ?? { number: 9 })
  const list = [], age = g.endAt != null ? g.t - g.endAt : 0
  if (g.res === 'goal' && g.cel) {
    const kb = keeperBeaten(g.cel, age, g.kAt)
    g.kHold = kb.holds ? { x: kb.x, z: kb.z } : null
    list.push({ z: kb.z, fn: () => man(ctx, C, kb.x, kb.z, kb.pose, { ...gkLook, front: kb.front }) })
    const sc = scorerAt(g.cel, age)
    list.push({ z: sc.z, fn: () => man(ctx, C, sc.x, sc.z, sc.pose, meLook, { lift: sc.lift, turn: sc.turn, name: g.who.me?.name }) })
    g.cel.mates.forEach((m, i) => { if (age < m.delay) return; const at = mateAt(g.cel, i, age, sc); list.push({ z: at.z, fn: () => man(ctx, C, at.x, at.z, at.pose, dress(K.us, { number: [5, 10, 6][i], skin: ['#f0c4a0', '#7a5030', '#c09060'][i] }), { lift: at.lift, turn: at.turn }) }) })
  } else {
    const kp = keeperAt(g)
    list.push({ z: KEEP_Z, fn: () => man(ctx, C, kp.x, KEEP_Z, kp.pose, gkLook, { lift: kp.lift }) })
    const me = meAt(g)
    list.push({ z: me.z, fn: () => man(ctx, C, me.x, me.z, me.pose, meLook, { name: g.who.me?.name }) })
  }
  list.push({ z: g.df.z, fn: () => man(ctx, C, g.df.x, g.df.z, defenderAt(g), dress(K.them, g.who.def ?? { number: 4, skin: '#5e3c22' }, { front: true })) })
  EXTRAS.forEach((e, i) => {
    if (g.res === 'goal' && e.side === 'us' && i !== 4) return   // (ours are off to celebrate)
    let pose = { ...POSE.ready, head: -0.2, tilt: 0.3 }
    if (e.header) { const a = g.t - (g.startAt - 60); pose = a < 0 ? { ...POSE.ready } : a < 420 ? { ...POSE.jump, hy: 50 } : POSE.ready }
    if (g.res === 'goal' && g.t > g.endAt + 250) pose = defenderBeaten(i, g.t - g.endAt - 250)
    const lift = e.header ? Math.max(0, Math.sin(clamp((g.t - g.startAt + 160) / 420, 0, 1) * Math.PI)) * 0.55 * (g.t > g.startAt - 160 && g.t < g.startAt + 260 ? 1 : 0) : 0
    list.push({ z: e.z, fn: () => man(ctx, C, e.x, e.z, pose, dress(e.side === 'us' ? K.us : K.them, { number: e.n, skin: e.n % 2 ? '#7a5030' : '#f0c4a0' }, { front: e.side === 'them' }), { lift }) })
  })
  if (b && b.z <= 0.05 && !b.held) list.push({ z: b.z - 0.02, fn: () => ball(ctx, C, b.x, b.y, b.z, b.spin) })
  list.sort((p, q) => q.z - p.z)
  for (const m of list) m.fn()
  if (b?.held) ball(ctx, C, b.x, b.y, b.z, b.spin, 0, false)
  // where it's dropping, and the ring closing on the moment
  if ((g.phase === 'drop' || g.phase === 'wait') && !g.res && g.t >= g.startAt) {
    const q = P(C, g.land.x, 0, g.land.z)
    if (q.ok) { ctx.strokeStyle = 'rgba(242,242,238,.5)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(q.x, q.y, 0.55 * q.s, 0.17 * q.s, 0, 0, 6.2832); ctx.stroke() }
    if (g.t >= g.arriveAt - RING) {
      const p = P(C, g.land.x, g.D.y, g.land.z), f = clamp((g.t - (g.arriveAt - RING)) / RING, 0, 1), late = g.t > g.arriveAt
      if (p.ok) { ctx.strokeStyle = late ? GOLD : 'rgba(255,255,255,.92)'; ctx.lineWidth = late ? 2.5 : 2; ctx.beginPath(); ctx.arc(p.x, p.y, lerp(1.3, 0.34, easeOut(f)) * p.s, 0, 6.2832); ctx.stroke() }
    }
  }
  if (g.k.phase !== 'idle' && !g.shot) { const o = padStick(g.ctl); aimMark(ctx, C, (o.x || 0.6) * (POST - 0.7), lerp(0.3, BAR - 0.45, (o.y + 1) / 2), { alpha: 0.85 }) }
  if (g.res === 'goal' && g.done && !g.kicked) { g.kicked = true; g.nudge.kick(g.t, 2.5, 0, 1, 180) }
  if (g.phase === 'touched' || g.choice === 'touch') shotHud(ctx, view, g.k, { t: g.t, y: view.keys ? view.h - 70 : view.h - 186 })
  else if (g.k.phase === 'power') shotHud(ctx, view, g.k, { t: g.t, y: view.keys ? view.h - 70 : view.h - 186 })
  drawPads(ctx, view, g.ctl, { move: 'MOVE · AIM', S: 'SHOOT', P: 'TOUCH' }, !g.done)
  placeStamp(g.stamp, view)
}
