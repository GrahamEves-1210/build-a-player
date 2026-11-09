// The academy trial's first-touch test, two parts, an empty stadium, a coach with a clipboard:
//   KEEP-UPS: keep it off the floor, twelve at most. It drops to one foot or the other: press that foot, LEFT or
//             RIGHT, as it gets to it. Clean and it comes up the same; a little off and the next one's higher or lower,
//             and quicker. The wrong foot, or off it, and it's on the floor.
//   CONTROL: the coach drives three balls in along the ground, to your left foot or your right. Press that foot as it
//            gets to you: kill it dead, or at least keep it in the square. Wrong foot or off it and it's away from you.
// The coach's mark: a point a keep-up, three a ball controlled in the square. 15 passes.
// First touch is the windows. Everything a player (or a bot) needs is on the screen: the ball, its shadow, the coach.
import { byV, clamp, lerp, prog, outcome, rngOf, easeOut, GOOD, BAD, text, LABEL, particles } from './kit.js'
import { placeStamp } from './read.js'
import { camOf, P, stadium, man, ball, POSE, mix, runPose, kickPose, kitsOf, dress, line } from './soccer.js'

export const how = {
  'first-touch': 'Keep it up: LEFT or RIGHT, the foot it drops to, as it gets there. Then kill the coach’s passes dead, the foot it comes to.',
}

const MAX_UPS = 12, BALLS = 3, NEED = 15, PER_BALL = 3
const FOOT_Y = 0.26          // where a touch meets it, m
const SET = 1100
const ME = { x: 0, z: -30 }, COACH = { x: 2.4, z: -15 }
const GRAV = 9.8

export function make({ v, seed }) {
  const r = rngOf(seed)
  const W = byV(v, 62, 135)          // ms either side of a keep-up
  const W2 = byV(v, 64, 128)         // ms either side of a pass arriving
  const sides = Array.from({ length: MAX_UPS + 1 }, () => (r() < 0.5 ? -1 : 1))
  const passes = Array.from({ length: BALLS }, (_, k) => ({ side: r() < 0.5 ? -1 : 1, travel: (1080 - k * 70) * (0.92 + r() * 0.16), wait: 450 + r() * 350, res: null }))
  const g = {
    t: 0, zones: 'lr', pads: ['LEFT', 'RIGHT'], padLit: null, litAt: -999, fx: [], done: null, outro: 1900, stamp: null,
    W, W2, part: 'ups', phase: 'set', ups: 0, ctrl: 0, dead: 0,
    // the keep-ups: the last touch (when, where), the next one's contact time and side
    lastAt: 0, lastX: 0, hang: 760, nextAt: Infinity, side: sides[0], drop: null,
    // the passes
    k: 0, passAt: Infinity, arriveAt: Infinity, touch: null, passes,
    dust: particles(16, 2),
    hud: { prompt: 'KEEP IT UP · THE FOOT IT DROPS TO', dots: null },
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110) g.padLit = null
      if (g.phase === 'set' && g.t >= SET) {
        // he flicks it up to start: the first one comes down to a foot
        g.phase = 'ups'; g.lastAt = g.t; g.lastX = 0; g.hang = 820; g.nextAt = g.t + g.hang; g.side = sides[0]
      }
      if (g.phase === 'ups' && g.t > SET + 1400) g.hud.prompt = null
      if (g.phase === 'ups' && g.t > g.nextAt + W) dropIt('It hit the floor')
      if (g.phase === 'gap' && g.t >= g.nextPart) startPasses()
      if (g.phase === 'pass' && g.t >= g.passAt && !g.rolling) { g.rolling = true; g.fx.push('tap') }
      if (g.phase === 'pass' && !g.touch && g.t > g.arriveAt + W2) touchIt(null)
      if (g.phase === 'after' && g.t >= g.nextBall) { if (g.k + 1 >= BALLS) finish(); else { g.k++; nextPass() } }
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      const side = a.zone === 'L' ? -1 : a.zone === 'R' ? 1 : null
      if (side == null) return
      if (g.phase === 'ups') {
        const e = g.t - g.nextAt
        if (e < -W * 2.6) return                      // (nowhere near it yet: nothing)
        g.padLit = side < 0 ? 0 : 1; g.litAt = g.t
        if (e < -W) return dropIt('Swung at it too early')
        if (side !== g.side) return dropIt('Wrong foot: it ran off his shin')
        keepUp(Math.abs(e) / W)
        return
      }
      if (g.phase === 'pass' && !g.touch) {
        const e = g.t - g.arriveAt
        if (e < -W2 * 3) return
        g.padLit = side < 0 ? 0 : 1; g.litAt = g.t
        touchIt({ side, e })
      }
    },
  }
  function keepUp(off) {
    g.ups++
    g.fx.push('tap', 'h:light')
    const at = g.nextAt
    g.lastAt = at; g.lastX = g.side * 0.16
    if (g.ups >= MAX_UPS) { g.hang = 700; return partDone(`${MAX_UPS}: THAT’LL DO`) }
    // a clean one comes up the same; off it, higher or lower and quicker
    const base = lerp(780, 580, g.ups / MAX_UPS)
    g.hang = off <= 0.4 ? base : base * (r() < 0.5 ? 0.82 : 1.12) * (1 - (off - 0.4) * 0.2)
    g.side = sides[g.ups]
    g.nextAt = at + g.hang
  }
  function dropIt(why) {
    g.drop = { at: g.t, x: g.ballX?.() ?? 0, why }
    g.fx.push('deny', 'h:medium')
    partDone(g.ups >= 8 ? `${g.ups} KEEP-UPS` : 'DROPPED IT', why)
  }
  function partDone(word) {
    g.phase = 'gap'; g.nextPart = g.t + 1300; g.upsWhy = word
    g.stamp = { text: word, good: g.ups >= 10, at: g.t, size: 38, ms: 1100 }
  }
  function startPasses() { g.part = 'control'; g.hud.dots = passes.map(() => null); g.hud.prompt = 'KILL IT DEAD · THE FOOT IT COMES TO'; nextPass() }
  function nextPass() {
    const p = passes[g.k]
    g.phase = 'pass'; g.touch = null; g.rolling = false
    g.passAt = g.t + p.wait; g.arriveAt = g.passAt + p.travel
  }
  function touchIt(tt) {
    const p = passes[g.k]
    let res, word
    if (!tt) { res = 'miss'; word = 'GOT AWAY FROM HIM' }
    else if (tt.side !== p.side) { res = 'miss'; word = 'WRONG FOOT' }
    else if (tt.e < -W2) { res = 'miss'; word = 'WENT TO MEET IT TOO SOON' }
    else if (Math.abs(tt.e) <= W2 * 0.45) { res = 'dead'; word = 'KILLED IT' }
    else if (Math.abs(tt.e) <= W2) { res = 'ok'; word = 'GOOD TOUCH' }
    else { res = 'miss'; word = 'HEAVY TOUCH' }
    g.touch = { at: tt ? g.t : g.arriveAt + W2, res, e: tt?.e ?? W2 * 2 }
    p.res = res
    const ok = res !== 'miss'
    if (ok) { g.ctrl++; if (res === 'dead') g.dead++ }
    g.hud.prompt = null
    g.hud.dots[g.k] = ok
    g.stamp = { text: word, good: ok, at: g.t, size: 36, ms: 900 }
    g.fx.push(ok ? 'catchball' : 'deny', ok ? 'h:medium' : 'h:light')
    g.phase = 'after'; g.nextBall = g.t + 950
  }
  function finish() {
    const pts = g.ups + g.ctrl * PER_BALL, hit = pts >= NEED, max = MAX_UPS + BALLS * PER_BALL
    g.done = outcome(hit ? 0.5 + 0.5 * (pts - NEED) / (max - NEED) : 0.45 * pts / NEED, hit, `${g.ups} keep-ups · ${g.ctrl} of ${BALLS} controlled`, { ups: g.ups, made: g.ctrl, dead: g.dead, of: BALLS, pts })
    g.phase = 'over'; g.pads = null
    g.stamp = { text: hit ? (pts >= max - 2 ? 'SILKY' : 'GOOD FEET') : 'NOT ENOUGH', good: hit, at: g.t, size: 44 }
  }
  // where the ball is in the keep-ups (for the drop, and the picture)
  g.ballX = () => (g.phase === 'ups' ? lerp(g.lastX, g.side * 0.16, clamp((g.t - g.lastAt) / g.hang, 0, 1)) : g.lastX)
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
const camFor = view => camOf(view, { x: 0.35, y: 1.6, z: ME.z - 5.2, F: 500, hzAt: 0.4 })
// a keep-up touch: the foot up to meet it, the arms out for balance. f 0-1 through it, peaking at the middle
function touchPose(f, side) {
  const up = Math.sin(clamp(f, 0, 1) * Math.PI)
  const o = { ...POSE.stand, hy: 52, lx: -9, rx: 9, hlx: -30, hly: -60, hrx: 30, hry: -60, bow: 0.12 }
  if (side > 0) { o.rx = 6; o.ry = -22 * up } else { o.lx = -6; o.ly = -22 * up }
  o.lean = -side * 0.05 * up
  return o
}
function ballUps(g) {
  if (g.phase === 'set') {
    // on his foot, then flicked up
    return { x: 0.12, y: 0.11, z: ME.z + 0.35 }
  }
  if (g.drop && g.part === 'ups') {
    // down, a bounce, and away
    const a = (g.t - g.drop.at) / 1000, y0 = Math.max(0.11, ballYAt(g, g.drop.at))
    const fall = Math.max(0.11, y0 - 0.5 * GRAV * a * a)
    const after = Math.max(0, a - Math.sqrt(Math.max(0, 2 * (y0 - 0.11) / GRAV)))
    return { x: g.drop.x + after * 0.8 * (g.side || 1), y: fall > 0.11 ? fall : 0.11 + Math.max(0, Math.sin(after * 6) * 0.25 * Math.exp(-after * 3)), z: ME.z + 0.35 + after * 1.2 }
  }
  // (fifteen: one more up, and he stops it under his foot)
  if (g.phase !== 'ups' && g.t - g.lastAt > g.hang) return { x: g.lastX, y: 0.11, z: ME.z + 0.35 }
  return { x: g.ballX(), y: Math.max(0.11, ballYAt(g, g.t)), z: ME.z + 0.35 }
}
// a touch at lastAt sends it up to come down at FOOT_Y again after hang ms
function ballYAt(g, t) {
  const H = g.hang / 1000, a = (t - g.lastAt) / 1000, v0 = 0.5 * GRAV * H
  return FOOT_Y + v0 * a - 0.5 * GRAV * a * a
}
function ballPass(g) {
  const p = g.passes[g.k], me = ME
  const tx = me.x + p.side * 0.2, tz = me.z + 0.45
  if (g.t < g.passAt) return { x: COACH.x - 0.3, y: 0.11, z: COACH.z - 0.5, spin: 0 }
  const f = clamp((g.t - g.passAt) / p.travel, 0, 1.4)
  const fx = lerp(COACH.x - 0.3, tx, Math.min(1, f)), fz = lerp(COACH.z - 0.5, tz, Math.min(1, f))
  if (!g.touch || g.t < g.touch.at) {
    const over = Math.max(0, f - 1)
    return { x: fx + p.side * over * 0.6, y: 0.11, z: fz - over * 3, spin: -f * 18 }
  }
  const a = (g.t - g.touch.at) / 1000, res = g.touch.res
  if (res === 'dead') return { x: fx, y: 0.11, z: fz - 0.25 * (1 - Math.exp(-a * 8)), spin: -18 }
  if (res === 'ok') return { x: fx + p.side * 0.25 * (1 - Math.exp(-a * 5)), y: 0.11, z: fz - 0.7 * (1 - Math.exp(-a * 4)), spin: -18 }
  return { x: fx + p.side * (1 - Math.exp(-a * 2)) * 2.6, y: 0.11 + Math.max(0, Math.sin(a * 7) * 0.2 * Math.exp(-a * 3)), z: fz - (1 - Math.exp(-a * 1.6)) * 4.5, spin: -18 }
}
export function draw(ctx, g, view) {
  const C = camFor(view), K = kitsOf(view), team = [view.colors.us, view.colors.trim]
  // TODO(soccer.js): the empty academy stadium (no crowd) once soccer.js has it
  stadium(ctx, view, C, { team, board: g.part === 'ups' ? `KEEP-UPS  ${g.ups}` : `CONTROL  ${g.ctrl}/${BALLS}`, empty: true })
  // the square, in cones and chalk
  ctx.fillStyle = 'rgba(244,247,242,.5)'; ctx.beginPath()
  const S = 1.1
  line(ctx, C, ME.x - S, ME.z - S, ME.x + S, ME.z - S, 0.07); line(ctx, C, ME.x - S, ME.z + S, ME.x + S, ME.z + S, 0.07)
  line(ctx, C, ME.x - S, ME.z - S, ME.x - S, ME.z + S, 0.07); line(ctx, C, ME.x + S, ME.z - S, ME.x + S, ME.z + S, 0.07)
  ctx.fill()
  for (const [cx, cz] of [[-S, -S], [S, -S], [-S, S], [S, S]]) cone(ctx, C, ME.x + cx, ME.z + cz)
  // the coach: off to the side with his clipboard for the keep-ups, out in front with the balls for the passes
  const coachLook = { ...dress(K.staff, { skin: '#c09060' }), front: true }
  if (g.part === 'ups') {
    man(ctx, C, 2.6, ME.z + 3.2, g.phase === 'gap' && g.ups >= 10 ? { ...POSE.stand, hrx: 20, hry: -70 } : CLIP_POSE, coachLook)
    clipboard(ctx, C, 2.6, ME.z + 3.2)
  } else {
    const p = g.passes[g.k]
    let cpose = CLIP_POSE
    if (g.phase === 'pass' && g.t > g.passAt - 260 && g.t < g.passAt + 300) cpose = kickPose(clamp((g.t - g.passAt + 260) / 560, 0, 1))
    man(ctx, C, COACH.x, COACH.z, cpose, coachLook)
    // the bag of balls by him
    for (let i = 0; i < BALLS - 1 - g.k; i++) ball(ctx, C, COACH.x + 1.1 + (i % 2) * 0.3, 0.11, COACH.z - 0.2 - Math.floor(i / 2) * 0.3, i)
    void p
  }
  // you, in a training top
  const me = dress(K.train, { number: null, skin: view.cast?.us?.st?.[0]?.skin ?? view.cast?.me?.skin ?? '#8d5a3b' })
  let pose = POSE.ready
  if (g.part === 'ups') {
    if (g.phase === 'set') pose = touchPose(prog(g.t, SET - 260, SET + 40), 1)
    else if (g.drop) pose = mix(POSE.stand, POSE.hips, easeOut(prog(g.t - g.drop.at, 300, 700)))
    else {
      // the foot comes up into each touch: the last one going down, the next one coming up
      const since = g.t - g.lastAt, until = g.nextAt - g.t
      pose = until < 150 && g.phase === 'ups' ? touchPose(0.5 - until / 300, g.side) : since < 150 ? touchPose(0.5 + since / 300, g.lastX > 0 ? 1 : -1) : { ...POSE.ready, hlx: -26, hly: -58, hrx: 26, hry: -58 }
    }
  } else {
    const p = g.passes[g.k]
    if (g.touch && g.t - g.touch.at < 420) pose = touchPose(0.5 + (g.t - g.touch.at) / 840, p.side)
    else if (g.touch && g.touch.res === 'miss' && g.t - g.touch.at > 500) pose = POSE.hips
    else pose = { ...POSE.ready, hy: 49 }
  }
  const b = g.part === 'ups' ? ballUps(g) : ballPass(g)
  // the ball's shadow, there to read the drop by
  const sh = P(C, b.x, 0, b.z)
  if (sh.ok) { const k = clamp(1 - (b.y - 0.11) / 1.4, 0.35, 1); ctx.fillStyle = `rgba(2,10,6,${(0.38 * k).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 0.16 * sh.s * (1.6 - k * 0.6), 0.05 * sh.s, 0, 0, 6.2832); ctx.fill() }
  const behind = b.z < ME.z
  if (behind) ball(ctx, C, b.x, b.y, b.z, b.spin ?? (g.t / 90), 0, false)
  man(ctx, C, ME.x, ME.z, pose, me)
  if (!behind) ball(ctx, C, b.x, b.y, b.z, b.spin ?? (g.t / 90), 0, false)
  // the ring closing on the pass as it gets to you
  if (g.part === 'control' && g.phase === 'pass' && g.rolling && !g.touch) {
    const p = g.passes[g.k], f = clamp((g.t - (g.arriveAt - 520)) / 520, 0, 1)
    if (f > 0) {
      const q = P(C, ME.x + p.side * 0.2, 0, ME.z + 0.45), rr = lerp(1.6, 0.25, easeOut(f)) * q.s
      ctx.strokeStyle = g.t > g.arriveAt ? '#f7cf55' : 'rgba(255,255,255,.9)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.ellipse(q.x, q.y, rr, rr * 0.3, 0, 0, 6.2832); ctx.stroke()
    }
  }
  // the count, on the coach's sheet
  const y = 62
  text(ctx, g.part === 'ups' ? 'KEEP-UPS' : 'CONTROL', 12, y, { font: LABEL, size: 15, align: 'left', track: 1.4, color: 'rgba(255,255,255,.7)' })
  text(ctx, g.part === 'ups' ? `${g.ups}` : `${g.ctrl}/${BALLS}`, 12, y + 26, { font: "'BAP Anton', Anton, Impact, sans-serif", size: 30, align: 'left', color: '#f2f2ee' })
  if (g.part === 'control') text(ctx, `${g.ups} KEEP-UPS`, 12, y + 50, { font: LABEL, size: 13, align: 'left', track: 1.2, color: 'rgba(255,255,255,.55)' })
  placeStamp(g.stamp, view)
  void GOOD; void BAD; void runPose
}
const CLIP_POSE = { ...POSE.stand, hlx: -6, hly: -60, hrx: 8, hry: -62 }
function clipboard(ctx, C, X, Z) {
  const p = P(C, X - 0.02, 1.1, Z - 0.25)
  if (!p.ok) return
  ctx.fillStyle = '#c9b48e'; ctx.fillRect(p.x - 0.13 * p.s, p.y - 0.17 * p.s, 0.26 * p.s, 0.34 * p.s)
  ctx.fillStyle = '#f2f2ee'; ctx.fillRect(p.x - 0.1 * p.s, p.y - 0.13 * p.s, 0.2 * p.s, 0.27 * p.s)
}
function cone(ctx, C, X, Z) {
  const a = P(C, X, 0, Z), b = P(C, X, 0.22, Z)
  if (!a.ok) return
  const w = 0.11 * a.s
  ctx.fillStyle = '#f08a24'; ctx.beginPath(); ctx.moveTo(a.x - w, a.y); ctx.lineTo(a.x + w, a.y); ctx.lineTo(b.x, b.y); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(a.x - w, a.y - 1, w * 2, 1.5)
}
