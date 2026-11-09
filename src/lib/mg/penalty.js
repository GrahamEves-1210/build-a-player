// PENALTY KICK: twelve yards, the keeper on his line, the run-up yours.
//   aim      the stick (the arrows): where you're putting it, across the goal and high or low. You can change it
//            right up to the strike, but the longer you hold a corner, the more your hips give it away.
//   run-up   hold SHOOT (SPACE) to go: he runs up while the power bar fills, and he strikes it as he gets to the
//            ball. Too much power and it's over the bar; more power is less accurate, and a corner's harder to hit.
//   stutter  STUTTER (E) in the run-up: a check, a little hop. A keeper who's guessing often goes early on it, and
//            once he's gone you can put it the other way. Stutter too late and you've lost your rhythm.
//   finish   tap SHOOT again as your foot meets it: inside the window it's a perfect strike.
// The keeper: on his line, bouncing. He has a tell (he shades a side, or steps across), he reads a taker who's been
// looking at one corner, and some keepers stay big and save anything down the middle. The minute matters: a late
// one, or a shootout, is pressure, and pressure shrinks the window and costs accuracy (composure fights it).
import { byV, clamp, lerp, prog, outcome, rngOf, easeOut, easeIn, particles, nudge, manOf, lightMode } from './kit.js'
import { placeStamp } from './read.js'
import { camOf, P, staticStadium, net, goalFrame, ball, man, POSE, mix, runPose, kickPose, kitsOf, dress, boardWords, flashes, crowdUp, POST, BAR, NET_D,
  shooter, strikeOf, shotAt, keeperSave, shotHud, aimMark, celebration, scorerAt, mateAt, keeperBeaten, keeperRoar, strikerDenied, celebMs, skipOutro, padCtl, padInput, padStick, drawPads } from './soccer.js'

export const how = {
  penalty: 'Aim with the stick. Hold SHOOT to start the run-up, let go to set the power: too much and it’s over the bar. STUTTER in the run-up to make the keeper go early, then put it the other way. Tap SHOOT at the strike for a perfect penalty.',
}

const WHISTLE = 900
const RUN = 1250             // the run-up, from the first step to the ball
const STUT = 360             // the check
const SPOT_Z = -11, BALL_X = 0
const START = { x: -1.25, z: SPOT_Z - 2.5 }, PLANT = { x: -0.42, z: SPOT_Z - 0.32 }
const KEEP_Z = -0.25

export function make({ v, seed, cast = null, situation = null }) {
  const r = rngOf(seed), tv = clamp((v - 1) / 10, 0, 1)
  const late = situation?.clockText && /(\d+)/.test(situation.clockText) && +RegExp.$1 >= 80
  const shootout = !!situation?.shootout
  const pressure = shootout ? 0.85 : late ? 0.7 : situation ? 0.4 : 0.25
  const k = shooter(v, { pressure, fill: 900, windup: 160 })
  k.type = 'pen'
  // the keeper: which way he'll go (or stay big), whether his tell is honest, how he reacts to a stutter
  const stay = r() < 0.16, guess = r() < 0.5 ? -1 : 1
  const honest = r() < 0.62, tellSide = honest ? guess : -guess
  const jumpy = r() < byV(v, 0.5, 0.68)     // goes early on a stutter
  const readP = lerp(0.6, 0.18, tv) * (1 + pressure * 0.4)
  const g = {
    t: 0, game: 'penalty', zones: 'none', stick: true, pads: null, fx: [], done: null, outro: 2800, stamp: null,
    sit: situation ?? null, pressure, k, stay, guess, tellSide, jumpy,
    phase: 'set', runAt: null, arriveAt: null, stutAt: null, struckAt: null, shot: null, res: null, why: '', endAt: null, popAt: null, doneAt: null,
    kgoes: stay ? 0 : guess, kdive: null, diveAt: null, read: false, lean: 0, aimHold: 0, lastAim: 0,
    ctl: padCtl(), vh: 640,
    who: { me: manOf(cast, 'us', 'st', 0), gk: manOf(cast, 'them', 'gk', 0), mates: [manOf(cast, 'us', 'st', 1), manOf(cast, 'us', 'st', 2)] },
    dirt: particles(30, 5), nudge: nudge(),
    hud: { prompt: shootout ? 'SHOOTOUT · WAIT FOR THE WHISTLE' : 'WAIT FOR THE WHISTLE' },
    tick(dt) {
      g.t += dt
      const o = padStick(g.ctl)
      if (g.phase === 'set' && g.t >= WHISTLE) { g.phase = 'wait'; g.fx.push('whistle'); g.hud.prompt = 'PICK A CORNER' }
      // aiming: right up to the strike
      if (!g.shot && g.phase !== 'set') {
        k.aimAt(o.x, o.y)
        // (how long he's been showing one corner)
        const side = Math.abs(o.x) > 0.35 ? Math.sign(o.x) : 0
        if (side && side === g.lastAim) g.aimHold += dt; else g.aimHold = 0
        g.lastAim = side
      }
      if (g.phase === 'run') {
        // the stutter holds him up; he gets there, then it's struck
        const stutter = g.stutAt != null ? STUT : 0
        g.arriveAt = g.runAt + RUN + stutter
        if (g.struckAt == null && k.phase === 'strike') k.strikeAt = Math.max(k.strikeAt, g.arriveAt)
        if (g.struckAt == null && g.t >= g.arriveAt && k.phase === 'power') k.release(g.t)   // (got there still holding: he hits it)
        keeper()
      }
      if (k.tick(g.t) && !g.shot) strike()
      if (g.shot && !g.res) {
        const s = g.shot, a = g.t - s.at
        if (s.save?.saved && a >= s.save.f * s.T) resolve('saved', s.save.held ? (s.chip ? 'He stood up and caught the dink' : 'Too close to him: he held it') : g.read ? 'He read it and got there' : 'Guessed right and got a hand to it')
        else if (a >= s.T) {
          if (s.over) resolve('over', 'Leaned back: over the bar')
          else if (s.wide) resolve('wide', Math.abs(s.to.x) > POST ? 'Went for the corner and missed it' : 'Hit the post')
          else if (!s.onTarget) resolve('over', 'Over the bar')
          else resolve('goal', s.timed === 'green' ? 'Struck it perfectly' : g.kdive != null && g.kdive === -Math.sign(s.to.x) ? 'Sent him the wrong way' : Math.abs(s.to.x) < 1 && g.kdive ? 'Down the middle as he dived' : Math.abs(s.to.x) > POST - 0.9 ? 'Right in the corner' : 'Tucked it away')
        }
      }
      if (g.endAt != null && !g.done && g.t >= g.endAt) finish()
    },
    input(a) {
      if (skipOutro(g, a)) return
      padInput(g.ctl, a, g.vh, { down: id => (id === 'S' ? sDown() : stutter()), up: id => { if (id === 'S') sUp() } })
    },
  }
  function sDown() {
    if (k.phase === 'strike') { if (k.tap(g.t)) g.fx.push('h:light'); return }
    if (g.phase !== 'wait' || k.phase !== 'idle') return
    g.phase = 'run'; g.runAt = g.t; g.arriveAt = g.t + RUN
    k.press(g.t, 'pen'); g.hud.prompt = null
    // he's been staring at a corner: a keeper who reads it goes that way
    if (!stay && g.aimHold > 380 && r() < readP) { g.kgoes = g.lastAim; g.read = true }
    g.fx.push('h:light')
  }
  function sUp() { if (k.phase === 'power') k.release(g.t) }
  function stutter() {
    if (g.phase !== 'run' || g.stutAt != null || g.struckAt != null) return
    const into = g.t - g.runAt
    if (into > RUN - 220) { g.lostRhythm = true }   // (right at the ball: it throws him)
    g.stutAt = g.t
    g.fx.push('h:light')
    // a jumpy keeper goes on it: he's committed now
    if (!stay && jumpy && g.kdive == null && into < RUN - 150) { g.diveAt = g.t + 160 + r() * 120; g.early = true }
  }
  function keeper() {
    // his tell: a shade to one side in the run-up, then the dive, about as the ball's struck
    const toBall = g.arriveAt - g.t
    g.lean = g.kdive == null ? lerp(g.lean, toBall < 700 ? tellSide * 0.6 : 0, 0.05) : 0
    if (g.diveAt == null && !stay) g.diveAt = g.arriveAt - 130 + r() * 170
    if (g.kdive == null && g.diveAt != null && g.t >= g.diveAt) { g.kdive = g.kgoes; g.kAt = g.t; if (g.kgoes) g.fx.push('h:light') }
  }
  function strike() {
    g.struckAt = g.t
    const s = strikeOf(k, { x: BALL_X, z: SPOT_Z }, { v, r, foot: 1, pressure: g.lostRhythm ? 0.6 : 0 })
    g.shot = { ...s, at: g.t }
    // the keeper: gone the right way, gone the wrong way, or stood up
    const dived = g.kdive != null, side = Math.sign(s.to.x) || 0
    let K
    if (!dived && stay) K = { x: 0, z: KEEP_Z, react: byV(v, 150, 230), reach: 0.9, up: 2.4, dive: 3.6, read: 0 }
    else if (!dived) { g.kdive = g.kgoes; g.kAt = g.t; K = { x: 0, z: KEEP_Z, react: 90, reach: 0.6, up: 2.3, dive: 3.9, read: g.kgoes * 1.2 } }
    else K = { x: 0, z: KEEP_Z, react: 0, reach: 0.6, up: 2.25, dive: g.kgoes === side || (Math.abs(s.to.x) < 0.9 && g.kgoes) ? 3.7 : 0.4, read: g.kgoes }
    // gone early the other way: he can't get back
    if (dived && g.kgoes && g.kgoes !== side && Math.abs(s.to.x) > 0.9) K.reach = 0.2
    if (dived && g.kgoes && Math.abs(s.to.x) <= 0.9) K.reach = 0.25   // (down the middle as he goes)
    g.shot.save = s.onTarget ? keeperSave(g.shot, K, r) : null
    g.phase = 'struck'
    g.fx.push('stamp', 'h:medium')
  }
  function resolve(kind, why) {
    if (g.res) return
    g.res = kind; g.why = why; g.resAt = g.t; g.endAt = g.t + (kind === 'goal' ? 120 : 60)
    if (kind === 'goal') {
      g.cel = celebration(`${seed}|pen`, { from: { x: PLANT.x, z: PLANT.z }, toward: { x: (Math.sign(g.shot.to.x) || 1) * 0.9, z: -9 }, side: (Math.sign(g.shot.to.x) || 1), athletic: v >= 8, mates: [{ x: -6, z: -14.5 }, { x: -3.5, z: -16 }, { x: 4.5, z: -15 }] })
      g.kAt0 = { x: (g.kdive ?? 0) * 2.1, z: KEEP_Z, rot: (g.kdive || 1) * 1.42, ball: { x: clamp(g.shot.to.x, -3, 3), z: 1.5 } }
    }
  }
  function finish() {
    const goal = g.res === 'goal', s = g.shot
    const q = goal ? clamp(0.62 + (s.timed === 'green' ? 0.18 : 0) + (Math.abs(s.to.x) > POST - 1 ? 0.12 : 0) + (g.kdive && g.kdive !== Math.sign(s.to.x) ? 0.08 : 0), 0, 1) : clamp(0.1 + (g.res === 'saved' ? 0.15 : 0.05), 0, 0.4)
    g.done = outcome(q, goal, g.why); g.doneAt = g.t
    g.outro = goal ? celebMs() + 300 : lightMode() ? 1100 : 2300
    const word = { goal: 'GOAL', saved: 'SAVED', wide: 'MISSED', over: 'OVER THE BAR' }[g.res]
    g.stamp = { text: word, good: goal, at: g.t, size: word.length > 8 ? 40 : 50 }
    if (goal) { g.popAt = g.t; g.fx.push('h:success') } else g.fx.push(g.res === 'saved' ? 'catchball' : 'deny', 'h:heavy')
  }
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
// The broadcast's camera behind the taker, a touch to his left, the goal and the end behind it filling the top.
const camFor = view => camOf(view, { x: -0.3, y: 3.3, z: SPOT_Z - 10, F: 720, hzAt: 0.15 })
function takerAt(g) {
  const t = g.t
  if (g.phase === 'set' || g.phase === 'wait') {
    const breathe = Math.sin(t / 380) * 0.6
    return { x: START.x, z: START.z, pose: { ...POSE.ready, hy: 49 + breathe, tilt: 0.3, hlx: -18, hrx: 18 } }
  }
  if (g.res === 'goal' && g.cel) return null
  if (g.struckAt == null) {
    // the run-up: a curve in to the ball, the check if he stutters, the last long stride
    const stut = g.stutAt != null ? clamp((t - g.stutAt) / STUT, 0, 1) : 0
    const moving = g.stutAt != null && stut < 1 ? g.stutAt : t
    const runT = (moving - g.runAt) + (g.stutAt != null && stut >= 1 ? t - g.stutAt - STUT : 0)
    const f = clamp(runT / RUN, 0, 1), e = f * 0.85 + 0.15 * f * f
    const x = lerp(START.x, PLANT.x, e), z = lerp(START.z, PLANT.z - 0.1, e)
    if (g.stutAt != null && stut < 1) return { x, z, pose: { ...POSE.ready, hy: 48 + Math.sin(stut * Math.PI) * 4, lx: -9, rx: 9, ly: -Math.sin(stut * Math.PI) * 6, tilt: 0.2 }, lift: Math.sin(stut * Math.PI) * 0.12 }
    if (f >= 0.8) return { x, z, pose: kickPose(0.42 * prog(f, 0.8, 1), 1) }
    return { x, z, pose: runPose((runT / 320) % 1, 0.8) }
  }
  const after = t - g.struckAt
  if (after < 300) return { x: PLANT.x, z: PLANT.z, pose: kickPose(0.45 + 0.55 * easeOut(after / 300), 1, { high: g.shot?.over }) }
  // missed or saved: the head drops
  const base = mix(kickPose(1), POSE.stand, clamp((after - 300) / 200, 0, 1))
  return { x: PLANT.x, z: PLANT.z, pose: g.res ? strikerDenied('miss', after - 400, base) : base }
}
function keeperAt(g) {
  const t = g.t, s = g.shot
  if (g.res === 'goal' && g.cel) return null
  if (g.kdive == null) {
    const bounce = Math.abs(Math.sin(t / 170)) * 3, sway = Math.sin(t / 520) * 0.18
    const base = g.phase === 'run' && g.arriveAt - t < 450 ? POSE.set : POSE.ready
    return { x: sway + g.lean * 0.3, z: KEEP_Z, lift: 0, pose: { ...base, hy: base.hy + bounce, lean: g.lean * 0.15, hlx: base.hlx - 5, hrx: base.hrx + 5 } }
  }
  const K = g.kdive
  if (K === 0) {
    // stood big: goes for it as it comes
    const at = s ? s.at + 60 : Infinity, f = prog(t, at, at + 260), to = s ? s.to : { x: 0, y: 1 }
    const pose = { ...POSE.set, hy: lerp(44, 50, f), hlx: lerp(-22, to.x * 28 - 8, f), hly: lerp(-62, -40 - to.y * 30, f), hrx: lerp(22, to.x * 28 + 8, f), hry: lerp(-62, -40 - to.y * 30, f) }
    return after(g, { x: lerp(0, clamp(to.x, -1.2, 1.2) * 0.7, f), z: KEEP_Z, lift: 0, pose })
  }
  const d = prog(t - g.kAt, 0, 620)
  const flyX = K * lerp(0.2, 2.2, easeOut(d)), lift = Math.sin(Math.min(1, d) * Math.PI) * 0.6
  const high = (s?.to.y ?? 1) > 1.4
  const pose = d < 0.16 ? mix(POSE.set, { ...POSE.set, hy: 36, lean: K * 0.25 }, d / 0.16) : { ...POSE.dive, rot: K * lerp(0.4, high ? 1.2 : 1.45, easeOut((d - 0.16) / 0.84)) }
  return after(g, { x: flyX, z: KEEP_Z - d * 0.2, lift, pose })
}
// a save or a miss: up, and his celebration
function after(g, at) {
  if (g.endAt == null || g.res === 'goal') return at
  const age = g.t - g.endAt
  if (age < 450) return at
  const up = prog(age, 450, 800)
  return { x: at.x, z: at.z, lift: at.lift * (1 - up), pose: keeperRoar(age - 450, { ...at.pose, rot: (at.pose.rot ?? 0) * (1 - up) }) }
}
function ballNow(g) {
  const s = g.shot
  if (!s) return { x: BALL_X, y: 0.11, z: SPOT_Z, spin: 0 }
  const a = g.t - s.at
  if (s.save?.saved && a >= s.save.f * s.T) {
    const p = shotAt(s, s.save.f * s.T), f = clamp((a - s.save.f * s.T) / 520, 0, 1)
    if (s.save.held) return { x: lerp(p.x, 0.2, f), y: lerp(p.y, 0.9, f), z: -0.55, spin: 0, held: true }
    const sd = Math.sign(p.x) || 1
    return { x: p.x + sd * f * 3.2, y: Math.max(0.11, p.y + Math.sin(f * Math.PI) * 0.8 - f * 0.3), z: lerp(-0.3, 2.4, f), spin: 9 + f * 6 }
  }
  if (a < s.T) return shotAt(s, a)
  const af = a - s.T
  if (g.res === 'goal' || (!g.res && s.onTarget)) {
    if (g.kHold) return { x: g.kHold.x, y: 0.85, z: g.kHold.z - 0.25, spin: 0, held: true }
    const f = clamp(af / 200, 0, 1), drop = clamp((af - 200) / 420, 0, 1)
    return { x: s.to.x * (1 + f * 0.1), y: Math.max(0.11, s.to.y - drop * drop * s.to.y * 1.1), z: lerp(0, NET_D - 0.25, easeOut(f)), spin: 10 }
  }
  const f = clamp(af / 600, 0, 1)
  return { x: s.to.x + Math.sign(s.to.x) * f * 1.4, y: s.to.y + f * (s.over ? 1.4 : 0), z: f * 6, spin: 10 }
}
export function draw(ctx, g, view) {
  g.vh = view.h
  const C = camFor(view), K = kitsOf(view)
  const team = [view.colors.us, view.colors.trim], away = [view.colors.them, view.colors.themTrim ?? '#f4efe6']
  staticStadium(ctx, view, C, 'pen', { team, away, board: boardWords(g) })
  if (g.popAt != null && !view.empty) { crowdUp(ctx, C, team, g.t - g.popAt, 2400, away); flashes(ctx, C, view, g.t - g.popAt) }
  const b = ballNow(g)
  const ripple = g.res === 'goal' ? { x: g.shot.to.x, y: g.shot.to.y, at: g.shot.at + g.shot.T + 80 } : null
  net(ctx, C, ripple, g.t)
  if (b.z > 0.05 && !b.held) ball(ctx, C, b.x, b.y, b.z, b.spin)
  goalFrame(ctx, C)
  const gkLook = dress(K.gk, g.who.gk ?? { number: 1, skin: '#c09060' }, { front: true, sleeves: true }), meLook = dress(K.us, g.who.me ?? { number: 9, skin: '#8d5a3b' })
  const list = []
  const age = g.endAt != null ? g.t - g.endAt : 0
  if (g.res === 'goal' && g.cel) {
    const kb = keeperBeaten(g.cel, age, g.kAt0)
    g.kHold = kb.holds ? { x: kb.x, z: kb.z } : null
    list.push({ z: kb.z, fn: () => man(ctx, C, kb.x, kb.z, kb.pose, { ...gkLook, front: kb.front }) })
    const sc = scorerAt(g.cel, age)
    list.push({ z: sc.z, fn: () => man(ctx, C, sc.x, sc.z, sc.pose, meLook, { lift: sc.lift, turn: sc.turn, name: g.who.me?.name }) })
    g.cel.mates.forEach((m, i) => { if (age < m.delay) return; const at = mateAt(g.cel, i, age, sc); list.push({ z: at.z, fn: () => man(ctx, C, at.x, at.z, at.pose, dress(K.us, g.who.mates?.[i] ?? { number: [7, 10, 11][i], skin: ['#5e3c22', '#f0c4a0', '#c09060'][i] }), { lift: at.lift, turn: at.turn }) }) })
  } else {
    const kp = keeperAt(g)
    list.push({ z: KEEP_Z, fn: () => man(ctx, C, kp.x, kp.z, kp.pose, gkLook, { lift: kp.lift }) })
    const sp = takerAt(g)
    list.push({ z: sp.z, fn: () => man(ctx, C, sp.x, sp.z, sp.pose, meLook, { name: g.who.me?.name, lift: sp.lift ?? 0 }) })
  }
  if (b.z <= 0.05 && !b.held) list.push({ z: b.z + 0.01, fn: () => ball(ctx, C, b.x, b.y, b.z, b.spin) })
  list.sort((p, q) => q.z - p.z)
  for (const m of list) m.fn()
  if (b.held) ball(ctx, C, b.x, b.y, b.z, b.spin, 0, false)
  if (!g.shot && g.phase !== 'set') {
    const a = g.k.aim
    aimMark(ctx, C, a.x * (POST - 0.7), lerp(0.3, BAR - 0.45, (a.y + 1) / 2), { alpha: 0.9 })
  }
  if (g.res === 'goal' && g.done && !g.kicked) { g.kicked = true; g.nudge.kick(g.t, 2.5, 0, 1, 180) }
  shotHud(ctx, view, g.k, { t: g.t, y: view.keys ? view.h - 70 : view.h - 186 })
  drawPads(ctx, view, g.ctl, { move: 'AIM', S: 'SHOOT', P: 'STUTTER' }, !g.done)
  placeStamp(g.stamp, view)
}
