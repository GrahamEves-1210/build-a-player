// The academy trial's finishing drill, in the empty ground: five balls, each from somewhere different (the edge of
// the box, the left and right channels at an angle, the spot, and one rolled across by the coach to hit first
// time), and a target hung in the goal that lights up for each one: a top corner, a bottom corner, near post or far.
//   shooting  the shooting model every soccer game uses: hold SHOOT (SPACE), aim with the stick (the arrows: across,
//             up for the top corners, down for the bottom), let go to strike it, tap SHOOT again at contact for a
//             perfect strike. CURL (E) held is a finesse shot: curled, placed, more accurate, less pace. Too much
//             power and it's over; from an angle the far post's the harder one to find.
// Three of five in the target pass. Finishing is the target's size and the shot's accuracy; shot power the pace.
import { byV, clamp, lerp, prog, outcome, rngOf, easeOut, GOOD, BAD, GOLD, text, DISPLAY, LABEL, nudge, lightMode } from './kit.js'
import { placeStamp } from './read.js'
import { camOf, P, stadium, net, goalFrame, ball, man, POSE, mix, kickPose, runPose, kitsOf, dress, POST, BAR, NET_D,
  shooter, strikeOf, shotAt, shotHud, aimMark, scout, skipOutro, padCtl, padInput, padStick, drawPads } from './soccer.js'

export const how = {
  finishing: 'Five balls from five spots. Hold SHOOT and aim at the lit target with the stick, let go to strike it, tap SHOOT again at contact. Hold CURL for a placed, curled finish. Three of five in the target.',
}

const N = 5, NEED = 3, GAP = 900
// where the balls are taken from, and the targets: the four corners and the two posts at the middle height
const SPOTS = [{ x: 0, z: -16.5, name: 'EDGE OF THE BOX' }, { x: -8.5, z: -13, name: 'LEFT CHANNEL' }, { x: 8.5, z: -13.5, name: 'RIGHT CHANNEL' }, { x: 0, z: -11, name: 'THE SPOT' }, { x: -2.5, z: -15, name: 'FIRST TIME', roll: true }]
export const TARGETS = [[-(POST - 0.7), 1.9], [POST - 0.7, 1.9], [-(POST - 0.7), 0.45], [POST - 0.7, 0.45], [-(POST - 0.7), 1.2], [POST - 0.7, 1.2]]

export function make({ v, seed }) {
  const r = rngOf(seed)
  const R = byV(v, 0.34, 0.6)
  // the order of the spots (the first-time ball always last but one), and a target for each, not the same twice
  const order = [0, 1, 2, 3].sort(() => r() - 0.5); order.splice(3, 0, 4)
  let last = -1
  const shots = order.map(si => { let k = Math.floor(r() * TARGETS.length); if (k === last) k = (k + 1) % TARGETS.length; last = k; return { spot: SPOTS[si], k, res: null } })
  const k = shooter(v, { fill: 820, windup: 180 })
  const g = {
    t: 0, game: 'finishing', zones: 'none', stick: true, pads: null, fx: [], done: null, outro: 1900, stamp: null,
    shots, i: 0, R, made: 0, k, phase: 'set', at: 700, shot: null, nextAt: null, rollAt: null, doneAt: null,
    ctl: padCtl(), vh: 640, camX: shots[0].spot.x * 0.85, camZ: shots[0].spot.z - 7.4,
    hud: { prompt: 'SET', dots: shots.map(() => null) },
    tick(dt) {
      g.t += dt
      const o = padStick(g.ctl), sh = shots[g.i]
      if (g.phase === 'set' && g.t >= g.at) start()
      if (g.phase === 'aim') {
        if (k.phase === 'power' || (k.phase === 'strike' && g.t < k.strikeAt - 30)) k.aimAt(o.x, o.y)
        // the ball rolled across: it's there when it's there, and he hits it as it gets to him
        if (sh.spot.roll && k.phase === 'strike') k.strikeAt = Math.max(k.strikeAt, g.rollAt)
        if (k.tick(g.t)) strike()
        if (sh.spot.roll && g.t > g.rollAt + 900 && k.phase === 'idle') { g.shot = { miss: true, at: g.t }; land(false, 'LET IT GO') }
        if (g.t > g.at + 7000 && k.phase === 'idle') { k.press(g.t, 'driven'); k.release(g.t + 400) }
      }
      if (g.phase === 'fly' && g.t >= g.shot.at + g.shot.T) land()
      if (g.phase === 'gap' && g.t >= g.nextAt) { if (g.i + 1 >= N) finish(); else { g.i++; start() } }
      const want = shots[g.i].spot
      const kk = 1 - Math.exp(-dt / 260)
      g.camX += (want.x * 0.85 - g.camX) * kk; g.camZ += (want.z - 7.4 - g.camZ) * kk
    },
    input(a) {
      if (skipOutro(g, a)) return
      padInput(g.ctl, a, g.vh, {
        down: id => { if (g.phase !== 'aim') return; if (k.phase === 'strike' && id === 'S') { if (k.tap(g.t)) g.fx.push('h:light'); return } if (k.phase === 'idle') k.press(g.t, id === 'P' ? 'finesse' : padStick(g.ctl).y < -0.6 ? 'low' : 'driven') },
        up: id => { if (k.phase === 'power' && ((id === 'P') === (k.type === 'finesse'))) k.release(g.t) },
      })
    },
  }
  function start() {
    g.phase = 'aim'; g.at = g.t; g.shot = null; k.reset(); k.type = 'driven'
    const sh = shots[g.i]
    g.hud.prompt = sh.spot.roll ? 'FIRST TIME: HIT IT AS IT COMES' : sh.spot.name
    g.rollAt = sh.spot.roll ? g.t + 1500 : null
    if (sh.spot.roll) g.fx.push('tap')
  }
  function strike() {
    const sh = shots[g.i]
    const from = sh.spot.roll ? rollPos(g, g.t) : { x: sh.spot.x, z: sh.spot.z }
    const late = sh.spot.roll ? Math.abs(g.t - g.rollAt) / 160 : 0
    if (sh.spot.roll) { k.type = k.type === 'finesse' ? 'finesse' : 'volley'; if (late > 1) k.timed = 'red' }
    const s = strikeOf(k, from, { v, foot: 1, weak: false })
    g.shot = { ...s, at: g.t }
    g.phase = 'fly'; g.hud.prompt = null
    g.fx.push('stamp', 'h:medium')
  }
  function land(hitIn = null, word = null) {
    const sh = shots[g.i], s = g.shot
    let hit = false, inGoal = false
    if (!s.miss) {
      const [tx, ty] = TARGETS[sh.k]
      inGoal = s.onTarget
      hit = inGoal && Math.hypot(s.to.x - tx, s.to.y - ty) <= g.R
    }
    if (hitIn != null) hit = hitIn
    sh.res = hit; g.hud.dots[g.i] = hit
    if (hit) g.made++
    g.stamp = { text: word ?? (hit ? 'TARGET' : s.over ? 'OVER' : s.wide ? 'WIDE' : inGoal ? 'MISSED IT' : 'OFF TARGET'), good: hit, at: g.t, size: 40, ms: 900 }
    g.fx.push(hit ? 'catchball' : 'deny', hit ? 'h:medium' : 'h:light')
    g.phase = 'gap'; g.nextAt = g.t + GAP
  }
  function finish() {
    const hit = g.made >= NEED
    g.done = outcome(hit ? 0.5 + 0.5 * (g.made - NEED) / (N - NEED) : 0.45 * g.made / NEED, hit, `${g.made} of ${N} on target`, { made: g.made, of: N })
    g.doneAt = g.t
    g.phase = 'over'
    g.outro = lightMode() ? 1100 : 1900
    g.stamp = { text: hit ? (g.made === N ? 'PERFECT' : 'GOOD FINISHING') : 'NOT ENOUGH', good: hit, at: g.t, size: 44 }
  }
  return g
}
// the first-time ball: rolled across from the coach on the right, to the spot
function rollPos(g, t) {
  const sh = g.shots[g.i], to = sh.spot, from = { x: to.x + 9, z: to.z + 3 }
  const f = clamp(1 - (g.rollAt - t) / 1500, 0, 1.3)
  return { x: lerp(from.x, to.x, f), z: lerp(from.z, to.z, f) }
}

// ── The picture ─────────────────────────────────────────────────────────────
// a target: rings in a round frame, tied in the goal. Lit, the chalk and red; hit, it swings
function target(ctx, C, k, lit, R, swing) {
  const [x, y] = TARGETS[k]
  const p = P(C, x, y, 0.05)
  if (!p.ok) return
  const r = R * p.s, rot = swing ? Math.sin(swing / 70) * Math.exp(-swing / 380) * 0.4 : 0
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rot)
  ctx.fillStyle = '#0b1014'; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, 6.2832); ctx.fill()
  const cols = lit ? ['#f2f2ee', '#c9423a', '#f2f2ee', '#c9423a'] : ['#4a5259', '#30373d', '#4a5259', '#30373d']
  for (let i = 0; i < 4; i++) { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(0, 0, r * (1 - i * 0.24), 0, 6.2832); ctx.fill() }
  ctx.restore()
  ctx.strokeStyle = 'rgba(236,240,242,.6)'; ctx.lineWidth = 1
  const sx = Math.sign(x), a = P(C, sx * POST, y > 1 ? BAR : 0.2, 0), b = P(C, x, y > 1 ? BAR : 0.2, 0)
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(a.x, a.y); ctx.moveTo(p.x, p.y); ctx.lineTo(b.x, b.y); ctx.stroke()
}
function ballNow(g) {
  const sh = g.shots[Math.min(g.i, N - 1)], s = g.shot
  if (!s || s.miss) { if (sh.spot.roll) { if (g.rollAt == null) return null; const p = rollPos(g, g.t); return { x: p.x, y: 0.11, z: p.z, spin: g.t / 40 } } return { x: sh.spot.x, y: 0.11, z: sh.spot.z, spin: 0 } }
  const a = g.t - s.at
  if (a < s.T) return shotAt(s, a)
  const after = a - s.T
  if (s.onTarget) { const f = clamp(after / 220, 0, 1), drop = clamp((after - 200) / 400, 0, 1); return { x: s.to.x, y: Math.max(0.11, s.to.y - drop * drop * s.to.y), z: lerp(0, NET_D - 0.3, easeOut(f)), spin: 14 } }
  const f = clamp(after / 600, 0, 1)
  return { x: s.to.x * (1 + f * 0.3), y: Math.max(0.11, s.to.y + f * 0.6), z: f * 5, spin: 14 }
}
export function draw(ctx, g, view) {
  g.vh = view.h
  const C = camOf(view, { x: g.camX, y: 3.4, z: g.camZ, F: 600, hzAt: 0.2 }), K = kitsOf(view), team = [view.colors.us, view.colors.trim]
  stadium(ctx, view, C, { team, board: `FINISHING  ${g.made}/${N}`, empty: true })
  const s = g.shot, b = ballNow(g)
  const ripple = s && s.onTarget && !s.miss ? { x: s.to.x, y: s.to.y, at: s.at + s.T } : null
  net(ctx, C, ripple, g.t)
  if (b && b.z > 0.05) ball(ctx, C, b.x, b.y, b.z, b.spin)
  goalFrame(ctx, C)
  const sh = g.shots[Math.min(g.i, N - 1)]
  for (let k = 0; k < TARGETS.length; k++) {
    const swing = s && sh.res && sh.k === k && g.t > s.at + s.T ? g.t - s.at - s.T : 0
    target(ctx, C, k, sh.k === k && g.phase !== 'over', k === sh.k ? g.R : g.R * 0.75, swing)
  }
  // the staff: the coach with the balls on the right of the box, scouts with clipboards on the touchline
  const staff = dress(K.staff, { skin: '#c09060' })
  man(ctx, C, sh.spot.x + 9.4, sh.spot.z + 3.2, g.phase === 'over' && g.done?.hit ? POSE.point : sh.spot.roll && g.rollAt && g.t < g.rollAt - 1300 ? kickPose(0.8, -1) : POSE.stand, { ...staff, front: true })
  for (const [X, Z, sk] of [[-21.5, -8, '#6d4229'], [-22.4, -11.5, '#f0c4a0'], [21.8, -6, '#8d5a3b']]) scout(ctx, C, X, Z, { ...staff, skin: sk, front: true }, g.t)
  // you, the ball at your feet
  let pose = POSE.ready
  if (g.phase === 'fly' || g.phase === 'gap') {
    const a = g.t - s.at
    pose = s.miss ? POSE.drop : a < 300 ? kickPose(0.45 + 0.55 * easeOut(a / 300), 1, { high: s.type === 'chip' }) : a < 700 ? kickPose(1) : sh.res ? mix(kickPose(1), POSE.fist, easeOut(prog(a, 700, 950))) : mix(kickPose(1), POSE.hips, easeOut(prog(a, 700, 1000)))
  } else if (g.k.phase === 'power' || g.k.phase === 'strike') pose = kickPose(0.42 * clamp((g.t - g.k.at) / 600, 0, 1))
  const me = sh.spot.roll && b && g.phase === 'aim' ? { x: sh.spot.x - 0.42, z: sh.spot.z - 0.3 } : { x: sh.spot.x - 0.42, z: sh.spot.z - 0.3 }
  man(ctx, C, me.x, me.z, pose, dress(K.train, { number: null, skin: view.cast?.me?.skin ?? '#8d5a3b' }))
  if (b && b.z <= 0.05) ball(ctx, C, b.x, b.y, b.z, b.spin)
  if (g.phase === 'aim' && (g.k.phase === 'power' || g.k.phase === 'strike')) { const a = g.k.aim; aimMark(ctx, C, a.x * (POST - 0.7), g.k.type === 'low' ? 0.25 : lerp(0.3, BAR - 0.45, (a.y + 1) / 2)) }
  text(ctx, `BALL ${Math.min(g.i + 1, N)} OF ${N}`, 12, 60, { font: LABEL, size: 16, align: 'left', color: 'rgba(255,255,255,.8)' })
  shotHud(ctx, view, g.k, { t: g.t, y: view.keys ? view.h - 70 : view.h - 186 })
  drawPads(ctx, view, g.ctl, { move: 'AIM', S: 'SHOOT', P: 'CURL' }, !g.done)
  placeStamp(g.stamp, view)
}
