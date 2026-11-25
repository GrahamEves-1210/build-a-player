// PENALTY KICK: twelve yards, the keeper on his line, the run-up yours.
//   aim      the stick (the arrows): where you're putting it, across the goal and high or low. You can change it
//            right up to the strike, but the longer you hold a corner, the more your hips give it away.
//   run-up   hold SHOOT (SPACE) to go: he runs up while the power bar fills, and he strikes it as he gets to the
//            ball. Too much power and it's over the bar; more power is less accurate, and a corner's harder to hit.
//   stutter  STUTTER (E) in the run-up: a check, a little hop. A keeper who's guessing often goes early on it, and
//            once he's gone you can put it the other way. Stutter too late and you've lost your rhythm.
//   finish   tap SHOOT again as your foot meets it: inside the window it's a perfect strike.
//   or DRAW it (a finger, or the mouse): from the ball to your spot, the way the phone games do it (soccer.js's draw
//            the shot). The stroke is the penalty: where it ends is where it's going, its pace is the power (too
//            quick and it's over the bar), a bow in it bends it, and a soft one up the middle is the Panenka. Let go
//            and he runs up and strikes it as drawn. STUTTER still works, and a new stroke in the run-up changes it:
//            stutter, watch him go, and draw it the other way.
// The keeper: on his line, bouncing. He has a tell (he shades a side, or steps across), he reads a taker who's been
// looking at one corner, and some keepers stay big and save anything down the middle. The minute matters: a late
// one, or a shootout, is pressure, and pressure shrinks the window and costs accuracy (composure fights it).
import { byV, clamp, lerp, prog, outcome, rngOf, easeOut, easeIn, particles, nudge, manOf, lightMode } from './kit.js'
import { placeStamp } from './read.js'
import { camOf, P, staticStadium, net, goalFrame, ball, man, POSE, mix, runPose, kickPose, kitsOf, dress, boardWords, flashes, crowdUp, POST, BAR, NET_D,
  shooter, strikeOf, shotAt, keeperSave, shotHud, aimMark, celebration, scorerAt, mateAt, keeperBeaten, keeperDive, keeperLanded, keeperUp, heldBall, parried, strikerDenied, celebMs, skipOutro, padCtl, padInput, padStick, drawPads,
  stroke, strokeDown, strokeMove, strokeUp, readStroke, drawnShot, strokeTrail, ghostStroke, drawnSoFar, padLayout } from './soccer.js'
import { tip } from './soccerPads.js'

export const how = {
  penalty: 'Draw it from the ball to your spot: the quicker the stroke, the harder it’s hit (too quick and it’s over the bar), bend it to curl it, a soft one up the middle to chip it. STUTTER in the run-up and a keeper who’s guessing goes early: draw it again the other way. On a keyboard: aim with the arrows, hold SPACE to run up and let go to set the power, then tap it again at the strike.',
}

const WHISTLE = 900
const RUN = 1250             // the run-up, from the first step to the ball
const RUN_D = 1000           // (a drawn one: he's set, and he goes as soon as it's drawn)
const READ_D = 0.45          // (a keeper reads a drawn one's hips less than a taker who's stood staring at a corner)
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
  const stay = r() < 0.13, guess = r() < 0.5 ? -1 : 1
  const honest = r() < 0.62, tellSide = honest ? guess : -guess
  const jumpy = r() < byV(v, 0.5, 0.68)     // goes early on a stutter
  const readP = lerp(0.6, 0.18, tv) * (1 + pressure * 0.4)
  const g = {
    t: 0, game: 'penalty', zones: 'none', stick: true, pads: null, fx: [], done: null, outro: 2800, stamp: null,
    sit: situation ?? null, pressure, k, stay, guess, tellSide, jumpy,
    phase: 'set', runAt: null, arriveAt: null, stutAt: null, struckAt: null, shot: null, res: null, why: '', endAt: null, popAt: null, doneAt: null,
    kgoes: stay ? 0 : guess, kdive: null, diveAt: null, read: false, lean: 0, aimHold: 0, lastAim: 0,
    ctl: padCtl(), vh: 640, st: stroke(), run: RUN, lastView: null, readyAt: null,
    who: { me: manOf(cast, 'us', 'st', 0), gk: manOf(cast, 'them', 'gk', 0), mates: [manOf(cast, 'us', 'st', 1), manOf(cast, 'us', 'st', 2)] },
    dirt: particles(30, 5), nudge: nudge(),
    // (the words go over the controls, in the picture: the HUD's own line would sit on the STUTTER button and the keys)
    hud: { prompt: null }, say: shootout ? 'SHOOTOUT · WAIT FOR THE WHISTLE' : 'WAIT FOR THE WHISTLE',
    tick(dt) {
      g.t += dt
      const o = padStick(g.ctl)
      if (g.phase === 'set' && g.t >= WHISTLE) { g.phase = 'wait'; g.readyAt = g.t; g.fx.push('whistle'); g.say = null }
      // aiming: right up to the strike
      if (!g.shot && g.phase !== 'set' && !k.drawn) {
        k.aimAt(o.x, o.y)
        // (how long he's been showing one corner)
        const side = Math.abs(o.x) > 0.35 ? Math.sign(o.x) : 0
        if (side && side === g.lastAim) g.aimHold += dt; else g.aimHold = 0
        g.lastAim = side
      }
      if (g.phase === 'run') {
        // the stutter holds him up; he gets there, then it's struck
        const stutter = g.stutAt != null ? STUT : 0
        g.arriveAt = g.runAt + g.run + stutter
        if (g.struckAt == null && k.phase === 'strike') k.strikeAt = Math.max(k.strikeAt, g.arriveAt)
        // (drawing it again as he gets there: he waits on it, a beat)
        if (g.struckAt == null && k.drawn && g.st.on) k.strikeAt = Math.max(k.strikeAt, Math.min(g.t + 30, g.arriveAt + 380))
        if (g.struckAt == null && g.t >= g.arriveAt && k.phase === 'power') k.release(g.t)   // (got there still holding: he hits it)
        keeper()
      }
      if (k.tick(g.t) && !g.shot) strike()
      if (g.shot && !g.res) {
        const s = g.shot, a = g.t - s.at
        if (s.save?.saved && a >= s.save.f * s.T) resolve('saved', s.save.held ? (s.chip ? 'He stood up and caught the dink' : (s.save.stretch ?? 0) < 0.5 ? 'Too close to him: he held it' : 'He went the right way and held it') : g.read ? 'He read it and got there' : 'Guessed right and got a hand to it')
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
      if (drawIn(a)) return
      padInput(g.ctl, a, g.vh, { down: id => (id === 'S' ? sDown() : stutter()), up: id => { if (id === 'S') sUp() } })
    },
  }
  function sDown() {
    if (k.phase === 'strike') { if (k.tap(g.t)) g.fx.push('h:light'); return }
    if (g.phase !== 'wait' || k.phase !== 'idle') return
    g.phase = 'run'; g.runAt = g.t; g.run = RUN; g.arriveAt = g.t + RUN
    k.press(g.t, 'pen'); g.say = null
    // he's been staring at a corner: a keeper who reads it goes that way
    if (!stay && g.aimHold > 380 && r() < readP) { g.kgoes = g.lastAim; g.read = true }
    g.fx.push('h:light')
  }
  function sUp() { if (k.phase === 'power') k.release(g.t) }
  // ── drawing it: any finger (or the mouse) but the one on STUTTER ──
  const viewNow = () => g.lastView ?? { w: 360, h: g.vh }
  g.aimView = () => { const C = camFor(viewNow()); return { C, ball: P(C, BALL_X, 0.11, SPOT_Z) } }
  function drawIn(a) {
    if (a.kind !== 'down' && a.kind !== 'move' && a.kind !== 'up') return false
    const id = a.id ?? 0, st = g.st
    if (a.kind === 'down') {
      if (!g.keysView) { const B = padLayout(g.vh).P; if (Math.hypot(a.x - B.x, a.y - B.y) < B.r + 12) return false }
      if ((g.phase !== 'wait' && g.phase !== 'run') || g.struckAt != null || (k.phase === 'power' && !k.drawn)) return true
      strokeDown(st, a.x, a.y, g.t, id, g.aimView().ball)
      return true
    }
    if (id !== st.id) return false
    if (a.kind === 'move') { strokeMove(st, a.x, a.y, g.t, id); return true }
    strokeUp(st, a.x, a.y, g.t, id)
    if (g.struckAt != null) return true
    const rd = readStroke(st, g.aimView().C, { foot: 1, base: 'pen' })
    if (rd.tap || rd.back) { if (g.phase === 'wait') { g.say = 'DRAW IT UP TO THE GOAL'; g.sayAt = g.t } return true }
    if (g.phase === 'wait') {
      g.phase = 'run'; g.runAt = g.t; g.run = RUN_D; g.arriveAt = g.t + RUN_D; g.say = null
      // his hips: a keeper who reads him goes the way he's going
      if (!stay && Math.abs(rd.x) > 1.2 && r() < readP * READ_D) { g.kgoes = Math.sign(rd.x); g.read = true }
      g.fx.push('h:light')
    }
    drawnShot(k, rd, g.t, 0)
    return true
  }
  function stutter() {
    if (g.phase !== 'run' || g.stutAt != null || g.struckAt != null) return
    const into = g.t - g.runAt
    if (into > g.run - 220) { g.lostRhythm = true }   // (right at the ball: it throws him)
    g.stutAt = g.t
    g.fx.push('h:light')
    // a jumpy keeper goes on it: he's committed now
    if (!stay && jumpy && g.kdive == null && into < g.run - 150) { g.diveAt = g.t + 160 + r() * 120; g.early = true }
  }
  function keeper() {
    // his tell: a shade to one side in the run-up, then the dive, about as the ball's struck
    const toBall = g.arriveAt - g.t
    g.lean = g.kdive == null ? lerp(g.lean, toBall < 700 ? tellSide * 0.6 : 0, 0.05) : 0
    if (g.diveAt == null && !stay) g.diveAt = g.arriveAt - 130 + r() * 170
    if (g.kdive == null && g.diveAt != null && g.t >= g.diveAt) { g.kdive = g.kgoes; g.kAt = g.t; g.kx0 = swayX(g); if (g.kgoes) g.fx.push('h:light') }
  }
  function strike() {
    g.struckAt = g.t
    const s = strikeOf(k, { x: BALL_X, z: SPOT_Z }, { v, r, foot: 1, pressure: g.lostRhythm ? 0.6 : 0 })
    g.shot = { ...s, at: g.t }
    // the keeper: gone the right way, gone the wrong way, or stood up
    const dived = g.kdive != null, side = Math.sign(s.to.x) || 0
    let K
    if (!dived && stay) K = { x: 0, z: KEEP_Z, react: byV(v, 150, 230), reach: 0.9, up: 2.4, dive: 3.6, read: 0 }
    else if (!dived) { g.kdive = g.kgoes; g.kAt = g.t; g.kx0 = swayX(g); K = { x: 0, z: KEEP_Z, react: 90, reach: 0.6, up: 2.3, dive: 3.9, read: g.kgoes * 1.2 } }
    else K = { x: 0, z: KEEP_Z, react: 0, reach: 0.6, up: 2.25, dive: g.kgoes === side || (Math.abs(s.to.x) < 0.9 && g.kgoes) ? 3.0 : 0.4, read: g.kgoes }
    // gone early the other way: he can't get back
    if (dived && g.kgoes && g.kgoes !== side && Math.abs(s.to.x) > 0.9) K.reach = 0.2
    if (dived && g.kgoes && Math.abs(s.to.x) <= 0.9) K.reach = 0.25   // (down the middle as he goes)
    // the Panenka: dinked down the middle as he goes, he's on the floor; stood up, he catches it
    if (s.chip && g.kgoes && (Math.abs(s.to.x) < 1.2 || Math.sign(s.to.x) !== g.kgoes)) { K.up = 0.55; K.dive = 0.6 }
    // gone early on the stutter, he's on the grass by the time it's struck: only a low one near him is still his
    const early = dived && !!g.kgoes && g.t - g.kAt > 220
    if (early) K.up = 0.95
    g.shot.save = s.onTarget ? keeperSave(g.shot, K, r) : null
    // The picture of it. Where his dive takes his hands: on to the ball when he saves it, half a metre short when it
    // beats him on his side, his own way when he's gone the wrong one. A keeper who stood up goes late for one away
    // from him, and stays on his feet for one near him
    const sv = g.shot.save, fk = clamp((KEEP_Z - SPOT_Z) / -SPOT_Z, 0, 1), cross = shotAt(g.shot, fk * s.T), arrive = g.t + fk * s.T
    if (g.kx0 == null) g.kx0 = swayX(g)
    const off = cross.x - g.kx0, sideK = Math.sign(off) || 1, far = Math.abs(off) > 1.15
    if (g.kdive) {
      const t0 = g.kAt, at = arrive - t0
      if (early) g.kd = { K: g.kdive, t0 }
      else if (sv?.saved && sideK === g.kdive) g.kd = { K: g.kdive, t0, hx: Math.abs(off), hy: cross.y, at }
      else if (sideK === g.kdive && far && Math.abs(off) < 5) g.kd = { K: g.kdive, t0, hx: Math.max(0.9, Math.abs(off) - 0.5), hy: cross.y > 1.9 ? cross.y - 0.4 : cross.y, at }
      else g.kd = { K: g.kdive, t0 }
    } else if (far && (sv?.saved || Math.abs(off) < 4.6)) {
      const t0 = g.t + 130
      g.kd = { K: sideK, t0, hx: sv?.saved ? Math.abs(off) : Math.max(0.9, Math.abs(off) - 0.7), hy: cross.y, at: Math.max(300, arrive - t0) }
    } else g.kd = { K: 0, off, y: cross.y }
    g.kd.setAt = g.t
    g.phase = 'struck'
    g.fx.push('stamp', 'h:medium')
  }
  function resolve(kind, why) {
    if (g.res) return
    g.res = kind; g.why = why; g.resAt = g.t; g.endAt = g.t + (kind === 'goal' ? 120 : 60)
    if (kind === 'goal') {
      g.cel = celebration(`${seed}|pen`, { sit: g.sit, from: { x: PLANT.x, z: PLANT.z }, toward: { x: (Math.sign(g.shot.to.x) || 1) * 0.9, z: -9 }, side: (Math.sign(g.shot.to.x) || 1), athletic: v >= 8, mates: [{ x: -6, z: -14.5 }, { x: -3.5, z: -16 }, { x: 4.5, z: -15 }] })
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
    const f = clamp(runT / g.run, 0, 1), e = f * 0.85 + 0.15 * f * f
    const x = lerp(START.x, PLANT.x, e), z = lerp(START.z, PLANT.z - 0.1, e)
    if (g.stutAt != null && stut < 1) return { x, z, pose: { ...POSE.ready, hy: 48 + Math.sin(stut * Math.PI) * 4, lx: -9, rx: 9, ly: -Math.sin(stut * Math.PI) * 6, tilt: 0.2 }, lift: Math.sin(stut * Math.PI) * 0.12 }
    if (f >= 0.8) return { x, z, pose: kickPose(0.42 * prog(f, 0.8, 1), 1) }
    return { x, z, pose: runPose((runT / 320) % 1, 0.8) }
  }
  const after = t - g.struckAt
  if (after < 300) return { x: PLANT.x, z: PLANT.z, pose: kickPose(0.45 + 0.55 * easeOut(after / 300), 1, { high: g.shot?.over }) }
  // missed or saved: the head drops
  const base = mix(kickPose(1), POSE.stand, clamp((after - 300) / 200, 0, 1))
  return { x: PLANT.x, z: PLANT.z, pose: g.res ? strikerDenied(g.res === 'saved' ? 'save' : 'miss', t - g.resAt - 150, base) : base }
}
// the keeper on his line before he goes: bouncing, swaying, shading the side his tell gives away
const swayX = g => Math.sin(g.t / 520) * 0.18 + g.lean * 0.3
const DIVE0 = { hx: 2.5, hy: 1, at: 540 }
const smooth = f => f * f * (3 - 2 * f)
// the dive he's in. Before the ball's struck it's a dive his way; once it is, it bends to where the ball's going
function diveNow(g) {
  const kd = g.kd, K = kd?.K ?? g.kdive, t0 = kd?.t0 ?? g.kAt, aimed = kd?.hx != null
  const b = aimed ? smooth(prog(g.t, kd.setAt, kd.setAt + 110)) : 0
  const o = aimed ? { hx: lerp(DIVE0.hx, kd.hx, b), hy: lerp(DIVE0.hy, kd.hy, b), at: kd.at } : DIVE0
  const d = keeperDive(g.t - t0, K, o)
  return { ...d, x: (g.kx0 ?? 0) + d.dx, t0, K, o: aimed ? kd : DIVE0 }
}
function keeperAt(g) {
  const t = g.t, kd = g.kd
  const goal = g.res === 'goal' && g.cel, ballIn = { x: clamp(g.shot?.to.x ?? 0, -3, 3), z: 1.5 }
  const going = kd ? kd.K !== 0 && t >= kd.t0 : !!g.kdive
  if (!going && !(kd && kd.K === 0) && g.kdive !== 0) {
    // (stood up, about to go late: set, where he was)
    if (kd) return { x: g.kx0, z: KEEP_Z, lift: 0, pose: POSE.set }
    const bounce = Math.abs(Math.sin(t / 170)) * 3
    const base = g.phase === 'run' && g.arriveAt - t < 450 ? POSE.set : POSE.ready
    return { x: swayX(g), z: KEEP_Z, lift: 0, pose: { ...base, hy: base.hy + bounce, lean: g.lean * 0.15, hlx: base.hlx - 5, hrx: base.hrx + 5 } }
  }
  if (!going) {
    // stood big: his hands go to it as it comes
    const s = g.shot, at = s ? s.at + 60 : Infinity, f = easeOut(prog(t, at, at + 260)), off = kd?.off ?? 0, y = kd?.y ?? 1
    const shift = clamp(off, -1, 1) * 0.55, hx = clamp((off - shift) / 0.0164, -34, 34), hy = -clamp(y / 0.0164, 22, 118)
    const pose = { ...POSE.set, hy: lerp(44, y > 1.5 ? 53 : 48, f), hlx: lerp(-22, hx - 7, f), hly: lerp(-62, hy, f), hrx: lerp(22, hx + 7, f), hry: lerp(-62, hy, f) }
    const me = { x: (g.kx0 ?? 0) + shift * f, z: KEEP_Z, lift: y > 2 ? Math.sin(f * Math.PI) * 0.25 : 0, pose }
    if (goal) { const kb = keeperBeaten(g.cel, t - g.endAt, { ...me, rot: 0, lift: 0, ball: ballIn }); g.kHold = kb.holds ? { x: kb.x, z: kb.z } : null; return kb }
    if (g.res && t - g.resAt > 380) { const u = keeperUp(t - g.resAt - 380, { rot: 0, pose }, true, !!g.shot?.save?.held); return { ...me, lift: 0, pose: u.pose } }
    return me
  }
  const d = diveNow(g), landAt = d.t0 + d.end + 80
  if (t < landAt || !g.res) return { x: d.x, z: KEEP_Z, lift: d.lift, pose: d.pose, flying: true }
  const L = keeperLanded(d.K, d.o), at = { x: (g.kx0 ?? 0) + L.dx, z: KEEP_Z, rot: L.rot, lift: L.lift }
  // beaten: down where he landed, then up and into the net for it
  if (goal) { const kb = keeperBeaten(g.cel, t - Math.max(landAt, g.endAt), { ...at, ball: ballIn }); g.kHold = kb.holds ? { x: kb.x, z: kb.z } : null; return kb }
  // a save or a miss: up off the grass, and his roar
  const u = keeperUp(t - Math.max(landAt, g.resAt + 300), at, true, !!g.shot?.save?.held)
  return { x: at.x, z: KEEP_Z, lift: u.lift, pose: u.pose }
}
function ballNow(g) {
  const s = g.shot
  if (!s) return { x: BALL_X, y: 0.11, z: SPOT_Z, spin: 0 }
  const a = g.t - s.at
  if (s.save?.saved && a >= s.save.f * s.T) {
    const p = shotAt(s, s.save.f * s.T), f = clamp((a - s.save.f * s.T) / 520, 0, 1)
    if (s.save.held) return { x: p.x, y: p.y, z: KEEP_Z - 0.3, spin: 0, held: true, age: a - s.save.f * s.T }
    return parried(p, a - s.save.f * s.T, KEEP_Z)
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
  g.vh = view.h; g.keysView = !!view.keys; g.lastView = { w: view.w, h: view.h }
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
  const kp = keeperAt(g)
  list.push({ z: kp.z, fn: () => man(ctx, C, kp.x, kp.z, kp.pose, kp.front === false ? { ...gkLook, front: false } : gkLook, { lift: kp.lift ?? 0 }) })
  if (b.held && b.age != null) { const h = heldBall(kp, b.age); b.x = h.x; b.y = h.y }
  if (g.res === 'goal' && g.cel) {
    const sc = scorerAt(g.cel, age)
    list.push({ z: sc.z, fn: () => man(ctx, C, sc.x, sc.z, sc.pose, meLook, { lift: sc.lift, turn: sc.turn, name: g.who.me?.name }) })
    g.cel.mates.forEach((m, i) => { if (age < m.delay) return; const at = mateAt(g.cel, i, age, sc); list.push({ z: at.z, fn: () => man(ctx, C, at.x, at.z, at.pose, dress(K.us, g.who.mates?.[i] ?? { number: [7, 10, 11][i], skin: ['#5e3c22', '#f0c4a0', '#c09060'][i] }), { lift: at.lift, turn: at.turn }) }) })
  } else {
    const sp = takerAt(g)
    list.push({ z: sp.z, fn: () => man(ctx, C, sp.x, sp.z, sp.pose, meLook, { name: g.who.me?.name, lift: sp.lift ?? 0 }) })
  }
  if (b.z <= 0.05 && !b.held) list.push({ z: b.z + 0.01, fn: () => ball(ctx, C, b.x, b.y, b.z, b.spin) })
  list.sort((p, q) => q.z - p.z)
  for (const m of list) m.fn()
  if (b.held) ball(ctx, C, b.x, b.y, b.z, b.spin, 0, false)
  // the spot: where it's drawn to (or where the stick's pointing, on the keys)
  const dr = g.k.drawn
  if (!g.shot && dr) aimMark(ctx, C, dr.x, dr.y, { alpha: 0.9 })
  else if (!g.shot && g.phase !== 'set' && (view.keys || g.k.phase !== 'idle')) {
    const a = g.k.aim
    aimMark(ctx, C, a.x * (POST - 0.7), lerp(0.3, BAR - 0.45, (a.y + 1) / 2), { alpha: 0.9 })
  }
  if (g.res === 'goal' && g.done && !g.kicked) { g.kicked = true; g.nudge.kick(g.t, 2.5, 0, 1, 180) }
  strokeTrail(ctx, g.st, g.t, { C, k: g.k, base: 'pen', foot: 1 })
  // (the words: under the taker's feet and over the STUTTER button on a phone, whatever its height; over the keys on a computer)
  const tipY = view.keys ? undefined : Math.min(P(C, START.x, 0, START.z).y + 32, view.h - 106)
  // the first one: how it's done, a stroke drawn off the ball into the top corner, and the line under it
  if (g.phase === 'wait' && !g.st.on && !dr && g.k.phase === 'idle') {
    const b = P(C, BALL_X, 0.11, SPOT_Z), to = P(C, 2.75, 1.75, 0)
    if (drawnSoFar() < 2) ghostStroke(ctx, { x: b.x, y: b.y }, { x: to.x, y: to.y }, 0.1, g.t - g.readyAt - 300)
    tip(ctx, view, g.say && g.t - g.sayAt < 1600 ? g.say : view.keys ? 'DRAW IT WITH THE MOUSE · OR AIM AND SPACE' : 'DRAW IT FROM THE BALL TO YOUR SPOT', tipY, 14)
  } else if (g.phase === 'set' && g.say) tip(ctx, view, g.say, tipY, 14)
  shotHud(ctx, view, g.k, { t: g.t, y: view.keys ? view.h - 70 : view.h - 186 })
  drawPads(ctx, view, g.ctl, view.keys ? { move: 'AIM', S: 'SHOOT', P: 'STUTTER' } : { stick: false, S: null, P: 'STUTTER' }, !g.done)
  placeStamp(g.stamp, view)
}
