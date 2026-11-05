// Catching and the hands at the line. Everything is on the screen in advance (a coincidence task):
// the skill is timing, and Hands widens the window. Reused by:
//   gauntlet   the combine drill. He runs one yard line from sideline to sideline at speed. Seven
//              quarterbacks stand still along it, staggered side to side; each throws in turn, he
//              catches with his hands, tosses it aside and snaps his head to the next.
//   catch      a key moment on a real drive, three snaps on the real field: he runs a route with the
//              corner on one hip, the quarterback throws to the other, and the camera goes with him.
//              A catch moves the chains; a miss is the next down from the same spot.
//   release    press coverage: the corner is squared up over him at the line, he jabs, the
//              receiver swipes the hand away and gets by.
import { byV, clamp, circle, lerp, outcome, layer, football, rngOf, prog, easeOut, easeIn, easeInOut, themOf, ring, rr, GOOD, BAD, GOLD, text, DISPLAY, LABEL, manOf, paceOf, stage } from './kit.js'
import { nameTag, tilt, untilt, ground, stands, floodlight, vignette, paintGrass, athlete, warmAthlete, skinOf, goalPosts, rollingField, turfLine, breakupPose, ballShadow, airBall as artBall } from './art.js'
import { placeStamp, put, action } from './read.js'
import { drawTags, paintFieldFlat, flightAt, snapBall, looseBall, qbPose, SNAP_MS, SL, SR } from './throw.js'

export const how = {
  gauntlet: 'Seven QBs, side to side. Press the side of the throw as the ball reaches his hands.',
  catch: 'Three snaps. Press the shoulder the ball comes over as it drops in.',
  release: 'He jabs at your chest. Press the side of each jab as his hand gets there.',
}
const SETUP = {
  gauntlet: { n: 7, need: 4, win0: 80, win1: 130, verb: 'CAUGHT' },
  catch:    { n: 3, need: 2, win0: 32, win1: 76, verb: 'CAUGHT' },
  release:  { n: 3, need: 2, win0: 26, win1: 68, verb: 'JABS BEATEN' },
}
const TAU = Math.PI * 2

// ── The gauntlet's run: 24 units to a yard, a field 53 yards wide ───────────
const G_LEAD = 700, G_V = 190, G_TAU = 1.0, G_END = 1280
const G_FIRST = 170, G_GAP = 150, G_OFF = 150, G_FWD = 18, G_AIR = 560, G_WIND = 320, G_HAND = 18
const runRaw = sec => (sec <= 0 ? 0 : G_V * (sec - G_TAU * (1 - Math.exp(-sec / G_TAU))))
function timeAt(y) {
  let lo = 0, hi = 30
  for (let i = 0; i < 34; i++) { const m = (lo + hi) / 2; if (runRaw(m) < y) lo = m; else hi = m }
  return hi
}
const G_END_T = timeAt(G_END)
// where he is on the field at time t: planted at the sideline, then at speed, easing up past the far one
function runY(t) {
  const sec = (t - G_LEAD) / 1000
  if (sec < G_END_T) return runRaw(sec)
  return G_END + 0.5 * G_V * (1 - Math.exp(-(sec - G_END_T) / 0.5))
}
function gauntletThrows(r, S) {
  const first = r() < 0.5 ? 0 : 1
  return Array.from({ length: S.n }, (_, k) => {
    const side = (first + k) % 2
    const qy = G_FIRST + k * G_GAP + (r() - 0.5) * 22, cy = qy + G_FWD
    const arrive = G_LEAD + timeAt(cy) * 1000
    return { side, qx: side ? G_OFF : -G_OFF, qy, cy, wind: arrive - G_AIR - G_WIND, from: arrive - G_AIR, air: G_AIR, arrive, res: null, off: 0, at: 0, why: null }
  })
}

// ── The catch: three snaps, cut to the next line of scrimmage between them ──
const PYD = 11, C_V = 11.5, C_REL = 0.4                // flat units a yard (the goal-line camera's); his top speed, yards a second
const C_AIR = 1000, C_THROW = 950, C_SET = 800, C_PLAYOUT = 1300, C_ARC = 92
const C_SPLIT = 104, C_FADE = 12, C_HIP = 24, C_CLEAN = 0.8, C_TACK = 430
const C_RING = 650, C_R0 = 36, C_R = 11
const C_TAKEOFF = 170            // a throw that leads him: how long before the ball he leaves his feet
// the hand fight at the line eats his first steps; then he's gone
const routeYards = sec => {
  if (sec <= 0) return 0
  if (sec < C_REL) { const f = sec / C_REL; return 1.1 * f * f }
  const x = sec - C_REL
  return 1.1 + C_V * (x - 0.16 * (1 - Math.exp(-x / 0.16)))
}
// how far he's gone since the ball got there: on and away, or a few yards and he's wrapped up, or pulling up
function yacAt(b, age, pace) {
  const sec = Math.max(0, age) / 1000
  // laid out: in the air, then the slide
  if (b.lead) { const air = C_TAKEOFF / 1000; return C_V * pace * Math.min(sec, air) + (sec > air ? 2.6 * (1 - Math.exp(-(sec - air) / 0.22)) : 0) }
  if (b.res === 0) return 5 * (1 - Math.exp(-sec / 0.34))
  if (b.res == null || b.res >= C_CLEAN) return C_V * pace * sec
  return C_V * pace * Math.min(sec, C_TACK / 1000) + 0.4 * prog(age, C_TACK, C_TACK + 300)
}
function snaps(r, S, pace) {
  let t0 = 0
  const leads = Math.floor(r() * S.n)
  return Array.from({ length: S.n }, (_, k) => {
    // he's split out either way, and the ball can come over either shoulder: read it. The corner sits on
    // the other hip, the throw goes away from him
    const side = r() < 0.5 ? 0 : 1, lead = k === leads, wide = lead ? (side ? -1 : 1) : r() < 0.5 ? -1 : 1
    const snap = t0 + C_SET, from = snap + C_THROW + (r() - 0.5) * 120, arrive = from + C_AIR
    const sa = (arrive - snap) / 1000, sgn = side ? 1 : -1
    // (one throw of the three leads him: right over him and a little ahead, and he lays out for it, in across the field)
    const b = { side, lead, wide, wx: 180 + wide * C_SPLIT, sgn, t0, snap, from, air: C_AIR, arrive, sa, depth: routeYards(sa) * pace, res: null, off: 0, at: 0, why: null, pick: null, end: arrive + C_PLAYOUT }
    t0 = b.end
    return b
  })
}

// ── The release: the hand fight, from the snap ──────────────────────────────
const R_SNAP = 850
function jabs(r, S) {
  let at = R_SNAP + 180, last = null, run = 0
  const AIR = [620, 560, 500]
  const wide = r() < 0.5 ? -1 : 1
  return Array.from({ length: S.n }, (_, k) => {
    let side = r() < 0.5 ? 0 : 1
    if (side === last && run >= 2) side = 1 - side
    run = side === last ? run + 1 : 1; last = side
    const air = AIR[k] ?? 500, arrive = at + air
    const b = { side, wide, sgn: side ? 1 : -1, from: at, air, arrive, res: null, off: 0, at: 0, why: null }
    at = arrive + 230
    return b
  })
}

export function make({ v, seed, game, cast = null, pos = null }) {
  const S = SETUP[game] ?? SETUP.gauntlet
  // the man himself (a tight end catches too), and how quick he is next to the corner on him
  const group = pos === 'te' ? 'te' : 'wr'
  const pace = game === 'gauntlet' ? 1 : paceOf(cast, 'us', group, 0), cbPace = game === 'gauntlet' ? 1 : paceOf(cast, 'them', 'db', 0)
  const r = rngOf(seed)
  const win = byV(v, S.win0, S.win1)
  const balls = game === 'catch' ? snaps(r, S, pace) : game === 'release' ? jabs(r, S) : gauntletThrows(r, S)
  const g = {
    t: 0, game, zones: 'lr', pads: game === 'catch' ? ['LEFT SHOULDER', 'RIGHT SHOULDER'] : ['LEFT', 'RIGHT'], padLit: null, fx: [], done: null, outro: game === 'gauntlet' ? 1700 : 1500, stamp: null,
    balls, win, S, group, pace, cbPace, litAt: -999, lastAt: 0, prevSide: balls[0].side, doneAt: 0, made: 0,
    hud: { prompt: 'SET', dots: balls.map(() => null), hot: false },
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110) {
        g.padLit = null
      }
      for (let k = 0; k < balls.length; k++) {
        const b = balls[k]
        if (b.res == null && g.t > b.arrive + win + 40) settle(k, false, 'late')
      }
      prompt()
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      const side = a.zone === 'L' ? 0 : a.zone === 'R' ? 1 : null
      if (side == null) return
      g.padLit = side; g.litAt = g.t
      // only one ball is ever live: a press well before it means nothing
      const k = balls.findIndex(b => b.res == null)
      if (k < 0) return
      const off = Math.abs(g.t - balls[k].arrive)
      if (off > win + 170) { g.fx.push('h:light'); return }
      const b = balls[k]
      b.pick = side
      if (side !== b.side) settle(k, false, 'wrong', off)
      else settle(k, off <= win, g.t < b.arrive ? 'early' : 'late', off)
    },
  }
  let promptKey = -1
  function prompt() {
    if (g.done) return
    const k = balls.findIndex(b => b.res == null)
    if (k < 0) return
    const b = balls[k], word = b.side ? 'RIGHT' : 'LEFT'
    g.hud.hot = g.t >= b.arrive - win
    if (game === 'gauntlet') {
      const key = g.t < G_LEAD ? 0 : g.t < b.wind ? 1 : 2 + k
      if (key === promptKey) return
      promptKey = key
      g.hud.prompt = key === 0 ? 'SET' : key === 1 ? null : `QB ${word}`
    } else if (game === 'catch') {
      g.hud.prompt = null   // (the down and the spot are drawn with the play)
    } else {
      const key = g.t < R_SNAP ? 0 : 1 + k
      if (key === promptKey) return
      promptKey = key
      g.hud.prompt = key === 0 ? 'SET' : `JAB ${word}`
    }
  }
  function settle(k, ok, why, off = 0) {
    const b = balls[k]
    b.res = ok ? clamp(1 - (off / win) * 0.5, 0.5, 1) : 0
    b.at = g.t; b.off = off; b.why = why
    g.hud.dots[k] = ok
    g.prevSide = b.side; g.lastAt = g.t
    g.fx.push(ok ? 'tap' : 'pop', ok ? 'h:light' : 'h:medium')
    if (game === 'catch' && k < balls.length - 1) g.stamp = { text: ok ? 'CAUGHT' : b.lead ? 'INCOMPLETE' : 'BROKEN UP', good: ok, at: Math.max(g.t, b.arrive), ms: 1000, size: 46 }
    if (balls.every(x => x.res != null)) {
      const made = balls.filter(x => x.res).length
      const score = balls.reduce((s, x) => s + x.res, 0) / balls.length
      const hit = made >= S.need
      g.done = outcome(score, hit, `${made} of ${balls.length} ${S.verb.toLowerCase()}`, { made, of: balls.length })
      g.made = made; g.doneAt = g.t
      g.hud.prompt = null; g.hud.hot = false
      const word = game === 'catch' ? (ok ? 'CAUGHT' : b.lead ? 'INCOMPLETE' : 'BROKEN UP')
        : game === 'release' ? (hit ? 'CLEAN RELEASE' : 'JAMMED')
          : hit ? (made === balls.length ? 'PERFECT' : 'GOOD HANDS') : 'DROPPED'
      // (the catch game's word is this rep's. The others wait, so the last rep's own result shows first)
      g.stamp = { text: word, good: game === 'catch' ? ok : hit, at: Math.max(g.t, b.arrive) + (game === 'catch' ? 120 : 900), size: 46 }
      g.verdictAt = Math.max(g.t, b.arrive) + 900
      g.outro = (g.outro ?? 1500) + 800
    }
  }
  return g
}

// ── The picture: the broadcast camera, the same as every other game ─────────
// Everything below is a point on the flat field put through tilt(). Rules never see it.
const QB_TOP = '#8b949c', COACH = '#20262c', DRILL_TOP = '#eef1f4'   // combine gear: neutral
const QB_SKIN = ['#8d5a3b', '#c99a76', '#6d4329', '#d6ac8a', '#a06a44', '#7a4b30', '#c08e6a']
const lit = new Map()
// the lights and the falloff at the edges, for the cameras that move: painted once as one layer,
// so they're one full-screen blit a frame, not two
function lights(ctx, view) {
  const id = `${view.h}|${view.px}|${stage.tag}`
  let c = lit.get(id)
  if (!c && typeof document !== 'undefined') {
    if (lit.size > 6) lit.clear()
    c = document.createElement('canvas'); c.width = view.w; c.height = view.h
    const x = c.getContext('2d')
    floodlight(x, view); vignette(x, view)
    lit.set(id, c)
  }
  if (c) ctx.drawImage(c, 0, 0, view.w, view.h)
}
// a band across the field, on the ground
function band(ctx, view, y0, y1, color) {
  const ya = Math.max(0, y0), yb = Math.min(view.h, y1)
  if (yb <= ya) return
  const a = tilt(view, -90, ya), b = tilt(view, 450, ya), c = tilt(view, 450, yb), d = tilt(view, -90, yb)
  ctx.fillStyle = color
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill()
}
// a ring lying flat on the field
function turfRing(ctx, view, x, y, r) {
  const a = tilt(view, x, y), b = tilt(view, x, y + 1)
  ctx.beginPath(); ctx.ellipse(a.x, a.y, Math.max(0.5, r * a.s), Math.max(0.5, r * Math.max(0.2, b.y - a.y)), 0, 0, Math.PI * 2)
  return a
}
// the timing aid: the band is the window, the ring lands in the middle of it when the ball does
function timing(ctx, view, x, y, r0, r1, ms, left, win) {
  const rate = (r0 - r1) / ms, wide = Math.max(4, rate * win * 2)
  turfRing(ctx, view, x, y, r1); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = wide; ctx.stroke()
  const inside = Math.abs(left) <= win
  turfRing(ctx, view, x, y, Math.max(5, r1 + left * rate)); ctx.strokeStyle = inside ? GOOD : '#fff'; ctx.lineWidth = inside ? 4 : 3; ctx.stroke()
}
// a ball in the air: its shadow on the grass, the ball lifted above it
function airBall(ctx, view, x, y, lift, ang, size = 1.5) {
  const p = tilt(view, x, y)
  const a = Math.max(0.14, 0.36 - lift / 560)
  ctx.fillStyle = `rgba(0,0,0,${a.toFixed(2)})`
  ctx.beginPath(); ctx.ellipse(p.x + 1, p.y, (5 + lift * 0.012) * p.s, (2.4 + lift * 0.005) * p.s, 0, 0, Math.PI * 2); ctx.fill()
  artBall(ctx, p.x, p.y - lift * p.s, { axis: [Math.sin(ang), Math.cos(ang), 0.12], len: 8.6 * size * p.s, spin: performance.now() / 180 })
}
function payoff(ctx, g, view) {
  if (!g.done || !g.stamp || g.t < (g.verdictAt ?? g.stamp.at) + 180) return
  const yy = view.h - 126 - 52   // over the stamp
  ctx.fillStyle = 'rgba(6,10,12,.86)'; ctx.fillRect(180 - 112, yy - 18, 224, 36)
  text(ctx, `${g.made} OF ${g.balls.length} ${g.S.verb}`, 180, yy + 1, { font: LABEL, size: 24, track: 1.5, color: g.made === g.balls.length ? GOLD : '#fff' })
}

// ── The gauntlet ────────────────────────────────────────────────────────────
// The field turned a quarter: the yard lines run away from the camera and he's on one. Painted
// flat once. What crosses his path (hash rows, sidelines, numbers, QBs) is laid over it in field space.
function paintTurned(x, view) {
  const { w, h } = view, L = -w * 0.25, W = w * 1.5, gap = 118
  x.fillStyle = '#1f6b3a'; x.fillRect(L, 0, W, h)
  for (let i = -3; i < 3; i++) { x.fillStyle = i % 2 ? '#1f6b3a' : '#267a44'; x.fillRect(180 + i * gap, 0, gap, h) }
  // cut across too, so the grass shows him moving
  const n = Math.max(2, Math.round(h / 240) * 2), cross = h / n
  x.fillStyle = 'rgba(0,0,0,.055)'
  for (let i = 0; i < n; i += 2) x.fillRect(L, i * cross, W, cross)
  let seed = 11
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 5200; i++) {
    x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)'
    x.fillRect(L + rnd() * W, rnd() * h, 1 + rnd() * 2, 0.8)
  }
  x.fillStyle = 'rgba(245,247,243,.86)'
  for (let i = -3; i <= 3; i++) x.fillRect(180 + i * gap - 1.3, 0, 2.6, h)
}
const HASH_ROWS = [46, 566, 714, G_END - 46]
const G_SIZE = 1.35, QB_SIZE = 1.3, HANDS = 40 * G_SIZE
function drawGauntlet(ctx, g, view) {
  const { w, h } = view, t = g.t, balls = g.balls
  const A = Math.round(h * 0.82), y = runY(t), X = 180
  const fy = wy => A - (wy - y)
  // nothing but field, all the way up the screen
  ctx.fillStyle = '#1f6b3a'; ctx.fillRect(0, 0, w, h)
  ground(ctx, view, f => paintTurned(f, view), 'gauntlet', y, 60)
  // the hash marks: a tick a yard, in rows across his path
  ctx.fillStyle = 'rgba(245,247,243,.8)'
  for (let i = 0; i < HASH_ROWS.length; i++) {
    const row = fy(HASH_ROWS[i])
    if (row < 6 || row > h) continue
    const p = tilt(view, X, row), tick = Math.max(3, (tilt(view, X, row + 8).y - tilt(view, X, row - 8).y))
    for (let k = -12; k <= 12; k++) if (k) ctx.fillRect(p.x + k * 24 * p.s - p.s, p.y - tick / 2, 2 * p.s, tick)
  }
  // the numbers, split by his line, feet toward the nearest sideline
  for (const ny of [216, G_END - 216]) {
    const row = fy(ny)
    if (row < 20 || row > h + 40) continue
    const p = tilt(view, X, row), q = tilt(view, X, row + 10)
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.s, (q.y - p.y) / 10); if (ny > 600) ctx.rotate(Math.PI)
    text(ctx, '4', -38, 0, { font: DISPLAY, size: 66, color: 'rgba(245,247,243,.82)' })
    text(ctx, '0', 38, 0, { font: DISPLAY, size: 66, color: 'rgba(245,247,243,.82)' })
    ctx.restore()
  }
  // the sidelines, and the apron past them
  const near = fy(0), farLine = fy(G_END)
  if (near < h + 8) { band(ctx, view, near + 7, h, '#123f23'); band(ctx, view, near - 7, near + 7, '#f4f6f2') }
  if (farLine > -8) { band(ctx, view, 0, farLine - 7, '#123f23'); band(ctx, view, farLine - 7, farLine + 7, '#f4f6f2') }
  // the scouts past the far sideline
  // (the coaches stand off to the sides: his line runs on between them)
  if (farLine - 44 > 2) for (let i = 0; i < 3; i++) athlete(ctx, view, X + [-125, 85, 140][i], farLine - 44, { color: COACH, pants: '#a89a80', skin: QB_SKIN[i], kit: 'plain', dir: 'down', size: 1.15 })
  // balls he's finished with, lying where they came down
  for (let k = 0; k < balls.length; k++) drawSpent(ctx, g, view, balls[k], fy)
  // the quarterbacks further up the field than him, far to near: planted, they never move
  for (let k = balls.length - 1; k >= 0; k--) { const b = balls[k]; if (fy(b.qy) <= A) drawQB(ctx, view, b, X + b.qx, fy(b.qy), t, k) }
  // timing: the ring on the ground under the hand the ball is going to
  const live = balls.find(b => b.res == null) ?? null
  if (live && t >= live.arrive - 680) timing(ctx, view, X + (live.side ? G_HAND : -G_HAND), A, 64, 22, 680, live.arrive - t, g.win)
  // him: hands up for the ball, then tossing it, head snapping to the next QB
  const holding = balls.find(b => b.res && t >= b.at && t < Math.max(b.at, b.arrive) + 190)
  const reaching = holding ?? balls.find(b => b.res === 0 && t >= b.at && t < b.at + 180)
  const tossing = balls.find(b => b.res && t >= Math.max(b.at, b.arrive) + 190 && t < Math.max(b.at, b.arrive) + 300)
  const lookSide = t < g.lastAt + 90 ? g.prevSide : live ? live.side : g.prevSide
  const go = t >= G_LEAD
  const pose = !go ? 'ready'
    : reaching ? `catch-${reaching.side ? 'r' : 'l'}`
      : tossing ? `toss-${tossing.side ? 'r' : 'l'}`
        : g.done ? null : `look-${lookSide ? 'r' : 'l'}`
  const me = athlete(ctx, view, X, A, { color: DRILL_TOP, kit: 'plain', dir: 'up', step: go ? (Math.floor(y / 10) % 8) / 2 : null, pose, size: G_SIZE })
  // the ball in the air: from that QB's hand to his hands
  for (let k = 0; k < balls.length; k++) {
    const b = balls[k]
    if (t < b.from) continue
    if (b.res != null && t >= Math.max(b.at, b.arrive)) continue
    const f = prog(t, b.from, b.arrive), s = b.side ? 1 : -1
    const lift = lerp(36 * QB_SIZE, HANDS, f) + Math.sin(f * Math.PI) * 13
    airBall(ctx, view, X + lerp(b.qx * 0.88, s * G_HAND, f), fy(lerp(b.qy, b.cy, f)), lift, s * -1.45, 1.6)
  }
  // in his hands
  if (holding && t >= holding.arrive) {
    const s = holding.side ? 1 : -1, k = me.s * G_SIZE
    football(ctx, me.x + s * 7 * k, me.y - 46 * k, { ang: s * 1.25, scale: 1.3 * me.s })
  }
  // the quarterbacks he's passed
  for (let k = 0; k < balls.length; k++) { const b = balls[k]; if (fy(b.qy) > A) drawQB(ctx, view, b, X + b.qx, fy(b.qy), t, k) }
  lights(ctx, view)
  // a word for each ball, over his head
  const just = balls.find(b => b.res != null && t >= b.at && t - Math.max(b.at, b.arrive) < 300)
  if (just) {
    const yy = me.y - 76 * me.s * G_SIZE / 1.35 - 14
    text(ctx, just.res ? 'GOT IT' : 'DROP', me.x + 1, yy + 1, { font: DISPLAY, size: 24, color: 'rgba(0,0,0,.6)' })
    text(ctx, just.res ? 'GOT IT' : 'DROP', me.x, yy, { font: DISPLAY, size: 24, color: just.res ? '#fff' : BAD })
  }
  payoff(ctx, g, view)
}
// A QB on his spot, side on to the camera, facing the line: ball at his chest, cocks, throws, follows through
function drawQB(ctx, view, b, x, y, t, k) {
  if (y < 4 || y > view.h + 30) return
  const pose = t < b.wind ? 'qb-hold' : t < b.from ? 'qb-cock' : t < b.from + 150 ? 'qb-rel' : t < b.from + 400 ? 'qb-follow' : null
  athlete(ctx, view, x, y, { color: QB_TOP, skin: QB_SKIN[k % QB_SKIN.length], kit: 'plain', dir: b.side ? 'left' : 'right', pose, carry: pose === 'qb-hold', size: QB_SIZE })
}
// A ball after the catch: tossed aside, or off his hands, then lying on the field
function drawSpent(ctx, g, view, b, fy) {
  if (b.res == null) return
  const t = g.t, s = b.side ? 1 : -1, base = Math.max(b.at, b.arrive)
  let bx, by, lift, ang
  if (b.res) {
    const age = t - (base + 190)
    if (age < 0) return
    const f = clamp(age / 430, 0, 1)
    bx = s * (G_HAND + 92 * f); by = b.cy + 100 * easeOut(f)
    lift = lerp(HANDS, 0, f) + Math.sin(f * Math.PI) * 26; ang = age * 0.02 * (1 - f) + 1.35
  } else {
    const age = t - base
    if (age < 0) return
    // on past him the way it was going, and down
    const f = clamp(age / 460, 0, 1)
    bx = s * G_HAND - s * (10 + 120 * easeOut(f)); by = b.cy + 30 * f
    lift = HANDS * (1 - f) * (1 - f); ang = age * 0.025 * (1 - f) + 1.35
  }
  const row = fy(by)
  if (row < 2 || row > view.h + 20) return
  airBall(ctx, view, 180 + bx, row, lift, ang, 1.3)
}

// ── A real snap ─────────────────────────────────────────────────────────────
// The field's bands repeat exactly in a screenful, so it can run past for as long as he does
function bandOf(h) { return h / Math.max(2, Math.round(h / 146) * 2) }
const flatGrass = (view, b) => f => paintGrass(f, view, { yards: b / 5 })
const us = c => ({ color: c.us, trim: c.trim, pants: c.trim })
const OL_F = [-60, -30, 0, 30, 60], DL_F = [-45, -15, 15, 45]
// who's who, from the roster: nothing outside a career
function menOf(g, cast) {
  return g.men ?? (g.men = { me: manOf(cast, 'us', g.group, 0), cb: manOf(cast, 'them', 'db', 0), sf: (cast?.them?.db?.length ?? 0) > 2 ? manOf(cast, 'them', 'db', 2) : null, qb: manOf(cast, 'us', 'qb', 0), rb: manOf(cast, 'us', 'rb', 0), ol: [0, 1, 2, 3, 4].map(i => manOf(cast, 'us', 'ol', i)) })
}
// a real man: his number and skin now, his name at the end of the frame so nobody stands on it.
// shift: his name moved along his feet, for when another man's right on top of him
function real(ctx, view, x, y, look, opts, shift = 0) {
  const q = athlete(ctx, view, x, y, look ? { ...opts, number: look.number, skin: look.skin } : opts)
  if (look && !opts.fall) nameTag(ctx, view, q.x + shift * q.s, q.y, look.name, Math.min(1.05, Math.max(0.8, q.s * (opts.size ?? 1) * 0.85)))
  return q
}
// a man on the line: his name smaller, stepping down every other man
function liner(ctx, view, x, y, look, opts, lo) {
  const q = athlete(ctx, view, x, y, { ...opts, ...(look ? { number: look.number, skin: look.skin } : null) })
  if (look) nameTag(ctx, view, q.x, q.y + (lo ? 7.5 * q.s : 0), look.name, 0.72)
}
// ── The contested catch ─────────────────────────────────────────────────────
// The real field, painted once, end zone and logo and all; the camera rolls with him up it. The men are
// sprites, sorted by put()/action(), so a man nearer the camera stands in front of a name further up.
const C_START = 58              // yards from the far goal line, at the first snap: the logo's just ahead of him
const C_MIN = 11                 // the closest a drive's line of scrimmage comes to the goal line
const WR_SIZE = 0.8, MEN_SIZE = 0.8, SF_SIZE = 0.8
const HAND_UP = 40, HAND_OUT = 14    // his hands at the ball: how high and how far out from his middle, in sprite units
function lineOf(g, k) {
  let G = C_START
  for (let j = 0; j < k; j++) { const b = g.balls[j]; if (b.res) G = Math.max(C_MIN, G - b.depth - yacAt(b, C_PLAYOUT, g.pace)) }
  return G
}
function downOf(balls, k) {
  let d = 1
  for (let j = 0; j < k; j++) d = balls[j].res ? 1 : d + 1
  return d
}
const lookOf = (m, number, skin) => (m ? { number: m.number, skin: m.skin, name: m.name } : { number, skin })
const bare = (m, number, skin) => (m ? { number: m.number, skin: m.skin } : { number, skin })
// the two benches go by with the field; each watches it, and each stands on the apron, off the grass
function sidelines(x, view, goalY, col, them) {
  const O = { pose: 'ready', step: null, carry: false, fall: 0, fallX: 0, size: 0.72, number: null, kit: 'pads' }
  for (let yd = -4; yd < 72; yd += 6) {
    const n = Math.abs(yd * 7) % 11, y = goalY + yd * PYD
    if (n > 6 || y < view.h * 0.2 || y > view.h - 60) continue
    athlete(x, view, -14 - (n % 3) * 8, y, { ...O, dir: 'right', color: col.us, trim: col.trim, pants: col.trim, skin: skinOf(n) })
    athlete(x, view, view.w + 14 + (n % 3) * 8, y + 12, { ...O, dir: 'left', color: them.color, trim: them.trim, pants: them.trim, skin: skinOf(n + 3) })
  }
}
function drawCatch(ctx, g, view) {
  const { w, h } = view, t = g.t, balls = g.balls, col = view.colors, them = themOf(view)
  let i = 0
  for (let k = 0; k < balls.length; k++) if (t >= balls[k].t0) i = k
  const b = balls[i], sec = (t - b.snap) / 1000, age = t - b.arrive, sgn = b.sgn, s = b.side ? 'r' : 'l', G = lineOf(g, i)
  const lead = b.lead, caught = b.res > 0, missed = b.res === 0, clean = caught && !lead && b.res >= C_CLEAN
  const hurt = caught && !clean && !lead, men = menOf(g, view.cast)
  // ── the camera: the formation and the QB, until he's run into the shot; then it goes with him
  const padTop = h - 96, catchV = untilt(view, 180, padTop - 150).y, L0 = untilt(view, 180, padTop - 50).y - 7 * PYD, lock = L0 - catchV
  let wy = sec <= 0 ? 0 : age < 0 ? routeYards(sec) * g.pace : b.depth + yacAt(b, age, g.pace)
  wy = Math.min(wy, G + 9)        // (the back of the end zone)
  const L = L0 + (age < 0 ? Math.max(0, Math.min(b.depth, G + 9) * PYD - lock) * Math.pow(prog(sec, 0.45, b.sa), 1.3) : Math.max(0, wy * PYD - lock))
  const fl = yd => L - yd * PYD, goalY = fl(G)
  const goalAt = h + 6 * PYD, len = goalAt + 60 * PYD + h, paintView = { w, h: len, px: view.px, field: view.field }
  rollingField(ctx, view, {
    key: `catch|${col.us}|${col.trim}|${them.color}|${view.field?.id ?? ''}`, len, strips: 84, res: 0.62,
    at: Math.round((goalAt + G * PYD - L) * 2) / 2,
    paint: x => paintFieldFlat(x, paintView, goalAt, PYD, col.us),
    under: x => stands(x, view, 'field', [col.us, col.trim]),
    over: x => {
      floodlight(x, view)
      if (view.field && goalY - 10 * PYD > 4) goalPosts(x, view, goalY - 10 * PYD)
      sidelines(x, view, goalY, col, them)
    },
  })
  const los = fl(0)
  if (los < h) turfLine(ctx, view, SL, SR, los, '#3f86ff', 2.4)
  if (G >= 10) turfLine(ctx, view, SL, SR, fl(10), '#f7d64a', 2.8)
  const usT = { color: col.us, trim: col.trim }, themT = { color: them.color, trim: them.trim }
  const on = sec > 0, stride = Math.floor(t / 52) % 4
  // ── him
  // the release: a jab at the corner's side, then back across him and through
  const hip = -sgn, toward = hip < 0 ? 'r' : 'l', hipS = hip < 0 ? 'l' : 'r'
  const shake = sec < 0.12 ? hip * 10 * easeOut(prog(sec, 0, 0.12)) : lerp(hip * 10, sgn * 9, easeInOut(prog(sec, 0.12, 0.3)))
  const wx = b.wx + shake + sgn * C_FADE * easeInOut(prog(sec, 1.0, b.sa))
  const down = hurt ? prog(age, C_TACK, C_TACK + 300) : 0
  const pick = b.pick ?? b.side, reach = `shoulder-${pick ? 'r' : 'l'}`
  const tucked = caught && age >= 200
  const release = !on ? 'ready' : sec < 0.12 ? `jab-${hipS}` : sec < 0.24 ? `jab-${s}` : sec < C_REL ? `reach-${s}` : null
  const wrPose = sec < C_REL ? release : tucked ? null
    : caught ? (age > -300 || t >= b.at ? `shoulder-${s}` : null)
      : missed ? (t >= b.at && age < 240 ? reach : null)
        : age > -300 ? `shoulder-${s}` : null
  const stopped = missed && age > 620
  const wrLook = lookOf(men.me, 88, skinOf(4))
  // the layout: he's in the air before it's decided, and it's his hands that get there or don't
  const rise = lead ? prog(age, caught ? 980 : 720, (caught ? 980 : 720) + 220) : 0
  const layout = lead ? prog(age, -C_TAKEOFF, 70) * (1 - rise) : 0
  if (!layout) {
    const up = lead && rise >= 1
    put(wx, fl(wy), usT, { ...wrLook, dir: 'up', step: !on || stopped || down || up ? null : stride, pose: up ? (caught ? null : 'ready') : lead ? (age > -300 ? `shoulder-${s}` : wrPose) : wrPose, carry: tucked, fall: down, size: WR_SIZE })
  }
  // ── the corner: pressed up on him, hands on him. He gets turned, gives up a step, and recovers to the hip the ball isn't going to
  const off = sec < 0.24 ? 9 : lerp(9, C_HIP, easeInOut(prog(sec, 0.24, 0.62)))
  let cbx = wx + hip * off
  const gap = sec < C_REL ? 1.6 - wy : sec < 0.82 ? lerp(0.5, -2, easeInOut(prog(sec, C_REL, 0.82))) : lerp(-2, -0.5, easeInOut(prog(sec, 0.82, 1.5)))
  let cby = wy + gap - clamp((g.pace - g.cbPace) * wy * 0.08, -0.3, 0.5)
  const fighting = `${Math.floor(t / 110) % 2 ? 'fight' : 'fight2'}-${toward}`
  let cbPose = !on ? 'ready' : sec < 0.24 ? `${sec < 0.12 ? 'fight' : 'fight2'}-${toward}` : sec < 1.05 ? null : age < -190 ? fighting : `reach-${toward}`
  let cbDir = sec < 0.24 ? 'down' : sec < C_REL + 0.04 ? (hip < 0 ? 'left' : 'right') : 'up', cbStep = !on || sec < 0.24 ? null : stride, cbFall = 0, cbZ = 0
  if (lead && age >= 0) {
    // he can only watch: it's on the receiver now
    cbPose = age < 260 ? `reach-${toward}` : null
    cbStep = age < 260 ? stride : null
    if (missed && age >= 420) { cbDir = 'down'; cbPose = breakupPose(age - 420, Math.floor(b.arrive)) }
  } else if (missed && age >= 0) {
    // through his hands: across his back to the ball, then he lets everyone know
    const go = easeOut(prog(age, 0, 130))
    cbx = lerp(cbx, wx + sgn * 20, go); cby = lerp(cby, wy + 0.9, go)
    cbPose = age < 300 ? `reach-${s}` : null
    cbStep = age < 420 ? stride : null
    if (age >= 420) { cbDir = 'down'; cbPose = breakupPose(age - 420, Math.floor(b.arrive)) }
  } else if (hurt && age >= 0) {
    const on2 = easeOut(prog(age, C_TACK - 200, C_TACK))
    cbx = lerp(cbx, wx + hip * 7, on2); cby = lerp(cby, wy + 0.12, on2)
    cbPose = age < C_TACK - 200 ? `reach-${toward}` : 'wrap'
    cbStep = age < C_TACK - 200 ? stride : null
    cbFall = down; cbZ = 2
  } else if (clean && age >= 0) {
    // he dives and gets nothing but air: the field goes on without him
    const frozen = b.depth + yacAt(b, 240, g.pace) - 0.5
    if (age >= 240) { cby = frozen; cbFall = prog(age, 240, 520); cbStep = null; cbPose = null }
    else cbPose = `reach-${toward}`
  }
  cby = Math.min(cby, G + 9.6)
  // (wrapped up, one name's plenty: his would sit on top of the receiver's)
  put(cbx, fl(cby), themT, { ...(cbPose === 'wrap' ? bare : lookOf)(men.cb, 24, skinOf(3)), dir: cbDir, step: cbStep, pose: cbPose, fall: cbFall, size: WR_SIZE, z: fl(cby) + cbZ })
  // ── the safety, deep, coming to it a beat late
  const sfGo = prog(t, b.from + 150, b.arrive + 1000), sfBase = 27 + Math.min(Math.max(sec, 0), 0.9) * 2
  const sfx0 = 180 - b.wide * 34, sfy = Math.min(lerp(sfBase, b.depth + 9, sfGo), G + 9.5), sfx = lerp(sfx0, wx - b.wide * 36, sfGo)
  if (fl(sfy) > 6) put(sfx, fl(sfy), themT, { ...lookOf(men.sf, 31, skinOf(6)), dir: 'down', step: sfGo > 0 ? stride : null, pose: sfGo > 0 ? null : 'ready', size: SF_SIZE })
  // ── the rest of them, at the line
  const qbY = fl(-5 - 2 * easeOut(prog(sec, 0, 0.6))), qbAge = t - b.from
  if (fl(0) - 16 < h) {
    for (let k = 0; k < DL_F.length; k++) put(180 + DL_F[k], fl(0.9), themT, { dir: 'down', pose: on ? 'block' : 'stance', ...bare(null, 90 + k, skinOf(k + 2)), size: MEN_SIZE })
    for (let k = 0; k < OL_F.length; k++) put(180 + OL_F[k], fl(-0.9), usT, { dir: 'up', pose: on ? 'block' : 'stance', ...bare(men.ol[k], 70 + k, skinOf(k + 9)), size: MEN_SIZE })
  }
  if (qbY - 10 < h) {
    const wind = qbAge >= -240 && qbAge < 0, pose = wind ? 'qb-cock' : qbPose(null, qbAge)
    put(180, qbY, usT, { ...lookOf(men.qb, 7, skinOf(9)), dir: pose ? (b.wide < 0 ? 'left' : 'right') : 'up', pose, carry: !pose && qbAge < 0, size: MEN_SIZE })
    put(180 - b.wide * 26, fl(-4.5), usT, { ...lookOf(men.rb, 28, skinOf(7)), dir: 'up', pose: 'ready', size: MEN_SIZE })
  }
  action(ctx, view)
  if (sec < SNAP_MS / 1000 && los < h) snapBall(ctx, view, 180, los, 180, qbY, sec * 1000)
  // him in the air: the same sprite pitched over from his feet, up off the grass by the jump. A baked stamp, no new figure.
  const q0 = tilt(view, wx, fl(wy)), k0 = q0.s * WR_SIZE * 0.92
  const hop = lead ? Math.sin(prog(age, -C_TAKEOFF, 190) * Math.PI) * 15 * k0 : 0
  if (layout) {
    if (hop > 0.5) { ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.beginPath(); ctx.ellipse(q0.x + sgn * 22 * k0, q0.y + 1, 26 * k0, 5 * k0, 0, 0, Math.PI * 2); ctx.fill() }
    ctx.save(); ctx.translate(0, -hop)
    athlete(ctx, view, wx, fl(wy), { ...usT, pants: col.trim, ...wrLook, name: null, dir: 'up', pose: caught ? (age < 150 ? 'dive' : null) : age < 260 ? 'dive' : null, carry: caught && age >= 150, fall: layout, fallX: sgn, size: WR_SIZE })
    ctx.restore()
  } else if (on && !lead && String(wrPose).startsWith('shoulder-') || (lead && !rise && age > -300 && age < -C_TAKEOFF)) {
    // over the shoulder: his head turned back to it, the other hand coming across (the sprite's back hides that arm)
    const sd = (lead ? s : wrPose.slice(-1)) === 'r' ? 1 : -1
    ctx.fillStyle = men.me?.skin ?? skinOf(4); ctx.strokeStyle = 'rgba(8,12,16,.82)'; ctx.lineWidth = 0.8 * k0
    circle(ctx, q0.x + sd * 9.6 * k0, q0.y - 38.5 * k0, 2.1 * k0); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(q0.x + sd * 3.5 * k0, q0.y - 39 * k0, 1.7 * k0, 3 * k0, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#d7dadc'; ctx.lineWidth = 0.9 * k0; ctx.beginPath(); ctx.moveTo(q0.x + sd * 5 * k0, q0.y - 41.5 * k0); ctx.lineTo(q0.x + sd * 5 * k0, q0.y - 36.5 * k0); ctx.stroke()
  }
  // ── the ball and the catch point: both are in the world, so they stay put as the camera rolls
  const depth = Math.min(b.depth, G + 9), spot = fl(depth), wrEnd = b.wx + sgn * (9 + C_FADE), ka = tilt(view, wrEnd, spot), kk = ka.s * WR_SIZE * 0.92
  // where his hands will be when it gets there: at the shoulder, or at full stretch, in the air
  const handOut = lead ? 44 : HAND_OUT, cx = wrEnd + sgn * handOut * kk / ka.g, lift2 = (lead ? 28 : HAND_UP) * kk
  if (b.res == null || t < b.arrive) {
    if (t >= b.from) {
      const f = prog(t, b.from, b.arrive), qx = 180 + b.wide * 6
      const air = flightAt(view, qx, qbY, cx, spot, f, lead ? C_ARC * 1.25 : C_ARC), up = (lift2 - 32 * tilt(view, air.gx, air.gy).s) * f * f
      ballShadow(ctx, view, air.gx, air.gy, air.lift + up)
      artBall(ctx, air.x, air.y - up, { axis: air.axis, len: air.len * lerp(0.95, 0.72, f), spin: (t - b.from) / 180 })
    }
    if (age > -C_RING && age < g.win + 40) {
      const q = tilt(view, cx, spot), ry = q.y - lift2, rate = (C_R0 - C_R) / C_RING, inside = Math.abs(age) <= g.win
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,.4)'; circle(ctx, q.x, ry, C_R); ctx.stroke()
      ctx.lineWidth = inside ? 3 : 2; ctx.strokeStyle = inside ? GOOD : '#fff'; circle(ctx, q.x, ry, Math.max(4, C_R - age * rate)); ctx.stroke()
    }
  } else if (caught && lead && age < 150) {
    // at the end of his arms
    const e = 1 - (1 - layout) * (1 - layout), ang = e * 1.4
    artBall(ctx, q0.x + sgn * Math.sin(ang) * 46 * k0, q0.y - Math.cos(ang) * 46 * k0 - hop, { axis: [sgn, 0.2, 0.3], len: 11.5 * k0 })
  } else if (caught && !lead && age < 200) {
    // in both hands, at the shoulder
    const bx = q0.x + sgn * HAND_OUT * k0, by = q0.y - HAND_UP * k0
    artBall(ctx, bx, by, { axis: [sgn * 0.5, 0.2, 1], len: 11.5 * k0 })
    ctx.fillStyle = men.me?.skin ?? skinOf(4); ctx.strokeStyle = 'rgba(8,12,16,.82)'; ctx.lineWidth = 0.8 * k0
    circle(ctx, bx - sgn * 4.4 * k0, by + 1.5 * k0, 2.1 * k0); ctx.fill(); ctx.stroke()
  } else if (missed && lead) {
    // past his fingers and into the grass ahead of him: he landed short
    const f = clamp(age / 170, 0, 1), gx = cx + sgn * 8 * f, gy = spot - 22 * f
    if (f < 1) { const q = ballShadow(ctx, view, gx, gy, lift2 * (1 - f)); artBall(ctx, q.x, q.y - lift2 * (1 - f), { axis: [sgn, 0.6, -0.5], len: 11.5 * q.s * 0.7 }) }
    else looseBall(ctx, view, gx, gy, age, false)
  } else if (missed) {
    // off the hands: up and away, then down on the grass
    const f = clamp(age / 520, 0, 1), gx = cx + sgn * 44 * easeOut(f), gy = spot - 16 * easeOut(f)
    if (f < 1) {
      const lift = lift2 * (1 - f) * (1 - f) + Math.sin(f * Math.PI) * 26
      const q = ballShadow(ctx, view, gx, gy, lift)
      artBall(ctx, q.x, q.y - lift, { axis: [Math.cos(age / 50), 0.3, Math.sin(age / 50)], len: 9.5 * q.s })
    } else looseBall(ctx, view, gx, gy, age - 350, true)
  }
  vignette(ctx, view)
  // what the play is, while they're set
  if (t >= b.t0 && !on) {
    const dn = ['1ST', '2ND', '3RD', '4TH'][downOf(balls, i) - 1] ?? '4TH', spotText = G > 50 ? `OWN ${100 - Math.round(G)}` : G < 50 ? `OPP ${Math.round(G)}` : 'MIDFIELD'
    const say = `${dn} & ${G < 10 ? 'GOAL' : 10}  ·  ${spotText}`
    ctx.fillStyle = 'rgba(6,10,12,.78)'; rr(ctx, w / 2 - 92, 54, 184, 28, 4); ctx.fill()
    text(ctx, say, w / 2, 69, { size: 17, track: 1.2 })
  }
  // why it was a miss, under the word
  if (missed && age >= 0 && age < 950 && !(g.done && t >= g.verdictAt)) {
    const why = b.why === 'wrong' ? 'WRONG SHOULDER' : b.why === 'early' ? 'TOO EARLY' : 'TOO LATE', yy = h - 126 - 52
    ctx.fillStyle = 'rgba(6,10,12,.9)'; rr(ctx, w / 2 - 74, yy - 12, 148, 24, 4); ctx.fill()
    text(ctx, why, w / 2, yy + 1, { size: 16, track: 1.2 })
  }
  payoff(ctx, g, view)
}

// ── Press coverage ──────────────────────────────────────────────────────────
function drawRelease(ctx, g, view) {
  const { h } = view, t = g.t, balls = g.balls, c = view.colors, them = themOf(view)
  const s = balls[0].wide, bd = bandOf(h)
  const men = menOf(g, view.cast)
  const L = Math.round(h * 0.8), base = s < 0 ? 84 : 276, size = 1.4
  const row = Math.round(L / bd) * bd       // the line of scrimmage is on a yard line
  layer(ctx, view, `release|${s}|${c.us}|${them.color}|${c.trim}`, x => {
    stands(x, view, 'field', [c.us, c.trim])
    const hy = tilt(view, 0, 0).y
    ground(x, view, flatGrass(view, bd), `grass|${bd.toFixed(2)}`, 0, Math.round((h - hy) * view.px * 0.7))
    band(x, view, row - 1.6, row + 1.6, '#2f7fe0')
    band(x, view, row - bd * 2 - 1.6, row - bd * 2 + 1.6, '#f2d21f')
    floodlight(x, view)
  })
  const sec = (t - R_SNAP) / 1000, moving = sec > 0
  // the hand fight moves them: a swiped jab gains him ground, a landed one costs it
  let wrx = base, wry = row + 10, cbx = base, cby = row - 34
  for (let k = 0; k < balls.length; k++) {
    const b = balls[k]
    if (b.res == null) continue
    const e = easeOut(prog(t, b.at, b.at + 170))
    if (b.res) { wry -= 6 * e; wrx -= b.sgn * 8 * e; cbx -= b.sgn * 2 * e; cby += 1 * e }
    else { wry += 6 * e; wrx += b.sgn * 6 * e; cby += 4 * e; cbx += b.sgn * 2 * e }
  }
  // decided: he's by him at a receiver's speed, or he's ridden off his line
  const end = g.done ? g.doneAt : 0
  let cbDir = 'down', dist = 0
  if (end) {
    const age = t - end, lastSgn = balls[balls.length - 1].sgn
    if (g.done.hit) {
      const run = Math.max(0, age - 60) / 1000
      dist = 125 * g.pace * (run - 0.34 * (1 - Math.exp(-run / 0.34)))
      wrx -= lastSgn * 32 * easeOut(clamp(age / 320, 0, 1)); wry -= dist
      cbDir = age > 240 ? 'up' : 'down'
      cby -= 32 * Math.max(0, age - 480) / 1000
    } else {
      const f = easeOut(clamp(age / 700, 0, 1))
      wrx += s * 30 * f; cbx += s * 26 * f; wry -= 10 * f; cby -= 10 * f
    }
  }
  const stepNow = moving ? Math.floor(t / 90) % 4 : null
  // the safety deep, then the corner and the receiver, then the line and the backfield in front
  real(ctx, view, base - s * 50, row - bd * 3.2, men.sf, { color: them.color, trim: them.trim, pants: them.trim, dir: 'down', pose: 'ready', size: 1 })
  const swiping = balls.find(b => b.res && t >= b.at && t < b.at + 200)
  const wrPose = !moving ? 'ready' : swiping ? `swipe-${swiping.side ? 'r' : 'l'}` : null
  const cbPose = !moving ? 'ready' : cbDir === 'up' ? null : 'ready'
  let cbP, wrP
  const drawCB = () => { cbP = real(ctx, view, cbx, cby, men.cb, { color: them.color, trim: them.trim, pants: them.trim, dir: cbDir, step: stepNow, pose: cbPose, size }, -s * 23) }
  const drawWR = () => { wrP = real(ctx, view, wrx, wry, men.me, { ...us(c), dir: 'up', step: stepNow, pose: wrPose, size }) }
  if (wry < cby) { drawWR(); drawCB() } else { drawCB(); drawWR() }
  for (let i = 0; i < 3; i++) athlete(ctx, view, base - s * (104 + i * 32), row - 13, { color: them.color, trim: them.trim, pants: them.trim, dir: 'down', pose: moving ? 'block' : 'stance', size: 0.98 })
  for (let i = 0; i < 4; i++) liner(ctx, view, base - s * (90 + i * 32), row + 13, men.ol[i], { ...us(c), dir: 'up', pose: moving ? 'block' : 'stance', size: 0.98 }, i % 2)
  real(ctx, view, base - s * 150, row + 44 + 20 * easeOut(prog(sec, 0, 0.8)), men.qb, { ...us(c), dir: 'up', carry: true, size: 0.98 })
  // his jab: the arm comes from the corner's shoulder to the receiver's chest
  ctx.lineCap = 'round'
  const kc = cbP.s * size, kw = wrP.s * size, cbSkin = men.cb?.skin ?? '#8d5a3b'
  for (let k = 0; k < balls.length; k++) {
    const b = balls[k], sgn = b.sgn
    const shX = cbP.x + sgn * 9 * kc, shY = cbP.y - 30 * kc + 3 * kc
    const chX = wrP.x + sgn * 9 * kw, chY = wrP.y - 30 * kw
    if (b.res == null) {
      if (t < b.from - 120) continue
      const f = easeIn(prog(t, b.from, b.arrive))
      forearm(ctx, shX, shY, lerp(shX + sgn * 4 * kc, chX, f), lerp(shY + 2 * kc, chY, f), them.color, kc, sgn, cbSkin)
      const left = b.arrive - t
      if (left < 560) {
        const rate = (46 - 15) / 560, wide = Math.max(4, rate * g.win * 2)
        ring(ctx, chX, chY, 15, 'rgba(255,255,255,.4)', wide)
        const inside = Math.abs(left) <= g.win
        ring(ctx, chX, chY, Math.max(5, 15 + left * rate), inside ? GOOD : '#fff', inside ? 4 : 3)
      }
    } else {
      const age = t - b.at
      if (age > 360 || end) continue
      if (b.res) {
        // swiped: the corner's hand knocked out wide, then back to him
        const e = easeOut(clamp(age / 130, 0, 1)), back = easeIn(clamp((age - 130) / 230, 0, 1))
        const hx = lerp(chX, shX + sgn * 26 * kc, e), hy = lerp(chY, shY + 7 * kc, e)
        if (back < 1) forearm(ctx, shX, shY, lerp(hx, shX, back), lerp(hy, shY, back), them.color, kc, sgn, cbSkin)
      } else {
        // it lands: his hand stays on the chest a moment
        const back = easeIn(clamp((age - 150) / 200, 0, 1))
        forearm(ctx, shX, shY, lerp(chX, shX, back), lerp(chY, shY, back), them.color, kc, sgn, cbSkin)
      }
    }
  }
  ctx.lineCap = 'butt'
  drawTags(ctx, view)
  vignette(ctx, view)
  const say = balls.find(b => b.res != null && !end && t - b.at < 280 && t >= b.at)
  if (say) {
    const word = say.res ? 'SWIPE' : 'JAMMED'
    // (below his name, when he has one)
    const wordY = wrP.y + (men.me ? 30 : 20)
    text(ctx, word, wrP.x + 1, wordY + 1, { font: DISPLAY, size: 24, color: 'rgba(0,0,0,.6)' })
    text(ctx, word, wrP.x, wordY, { font: DISPLAY, size: 24, color: say.res ? '#fff' : BAD })
  }
  payoff(ctx, g, view)
}
// a corner's arm, at his size: the sleeve to an elbow that bends out, the bare forearm, a glove on the end.
// It never reaches further than an arm does.
function forearm(ctx, x0, y0, x1, y1, sleeve, k, side, skin) {
  const LEN = 9 * k, full = Math.hypot(x1 - x0, y1 - y0) || 1, d = Math.min(full, LEN * 1.96)
  const ux = (x1 - x0) / full, uy = (y1 - y0) / full, hx = x0 + ux * d, hy = y0 + uy * d
  const out = Math.sqrt(Math.max(0, LEN * LEN - (d / 2) * (d / 2)))
  // (the elbow goes out and down, away from the body)
  const ex = (x0 + hx) / 2 + side * Math.abs(uy) * out, ey = (y0 + hy) / 2 + Math.abs(ux) * out
  const seg = (ax, ay, bx, by, ink, col) => {
    ctx.strokeStyle = 'rgba(8,12,16,.82)'; ctx.lineWidth = ink + 1.4 * k
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
    ctx.strokeStyle = col; ctx.lineWidth = ink
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
  }
  seg(ex, ey, hx, hy, 3.6 * k, skin)
  seg(x0, y0, ex, ey, 4.6 * k, sleeve)
  ctx.fillStyle = 'rgba(8,12,16,.82)'; circle(ctx, hx, hy, 3 * k); ctx.fill()
  ctx.fillStyle = '#20262c'; circle(ctx, hx, hy, 2.3 * k); ctx.fill()
}

// Every look a game will need, painted a few a frame while he's in his stance, so a first-time
// pose can't cost a frame in the middle of the run.
export function warmUp(g, list) {
  if (!g.warmList) g.warmList = list()
  for (let i = 0; i < 4 && g.warmList.length; i++) warmAthlete(g.warmList.pop())
}
const STEPS = [0, 1, 2, 3]
function catchLooks(g, view) {
  const c = view.colors, them = themOf(view), out = [], men = menOf(g, view.cast)
  const add = o => out.push({ kit: 'pads', number: null, step: null, carry: false, pose: null, ...o })
  const usT = { color: c.us, trim: c.trim, pants: c.trim }, hisT = { color: them.color, trim: them.trim, pants: them.trim }
  const m = { ...usT, number: men.me?.number ?? 88, skin: men.me?.skin ?? skinOf(4) }, d = { ...hisT, number: men.cb?.number ?? 24, skin: men.cb?.skin ?? skinOf(3) }
  add({ ...m, dir: 'up', pose: 'ready' }); add({ ...d, dir: 'down', pose: 'ready' })
  for (const step of STEPS) {
    for (const pose of [null, 'shoulder-l', 'shoulder-r', 'jab-l', 'jab-r', 'reach-l', 'reach-r']) add({ ...m, dir: 'up', step, pose })
    add({ ...m, dir: 'up', step, carry: true })
    for (const pose of [null, 'fight-l', 'fight-r', 'fight2-l', 'fight2-r', 'reach-l', 'reach-r']) add({ ...d, dir: 'up', step, pose })
    add({ ...d, number: null, dir: 'side', step })
  }
  add({ ...m, dir: 'up', pose: 'dive' }); add({ ...m, dir: 'up', carry: true })
  for (const pose of ['fight-l', 'fight-r', 'fight2-l', 'fight2-r']) add({ ...d, dir: 'down', pose })
  for (const pose of ['wave-a', 'wave-m', 'wave-b', 'belt-a', 'belt-m', 'belt-b']) add({ ...d, dir: 'down', pose })
  add({ ...d, dir: 'up', pose: 'wrap' })
  men.ol.forEach((o, k) => { for (const pose of ['stance', 'block']) add({ ...usT, number: o?.number ?? 70 + k, skin: o?.skin ?? skinOf(k + 9), dir: 'up', pose }) })
  for (let k = 0; k < DL_F.length; k++) for (const pose of ['stance', 'block']) add({ ...hisT, number: 90 + k, skin: skinOf(k + 2), dir: 'down', pose })
  const q = { ...usT, number: men.qb?.number ?? 7, skin: men.qb?.skin ?? skinOf(9) }
  add({ ...q, dir: 'up', carry: true }); add({ ...q, dir: 'up' })
  for (const pose of ['qb-cock', 'qb-rel', 'qb-follow']) add({ ...q, number: null, dir: 'side', pose })
  add({ ...usT, number: men.rb?.number ?? 28, skin: men.rb?.skin ?? skinOf(7), dir: 'up', pose: 'ready' })
  const sf = { ...hisT, number: men.sf?.number ?? 31, skin: men.sf?.skin ?? skinOf(6), dir: 'down' }
  add({ ...sf, pose: 'ready' }); for (const step of STEPS) add({ ...sf, step })
  for (let n = 0; n <= 6; n++) { add({ ...usT, number: null, skin: skinOf(n), dir: 'side', pose: 'ready' }); add({ ...hisT, number: null, skin: skinOf(n + 3), dir: 'side', pose: 'ready' }) }
  return out
}
function looksOf(g, view) {
  const c = view.colors, them = themOf(view), out = []
  const add = o => out.push({ number: null, step: null, carry: false, pose: null, skin: '#8d5a3b', ...o })
  if (g.game === 'gauntlet') {
    const plain = { kit: 'plain', trim: '#f4efe6', pants: '#20262c' }
    add({ ...plain, color: DRILL_TOP, dir: 'up', pose: 'ready' })
    for (const step of STEPS) for (const pose of [null, 'look-l', 'look-r', 'catch-l', 'catch-r', 'toss-l', 'toss-r']) add({ ...plain, color: DRILL_TOP, dir: 'up', step, pose })
    QB_SKIN.forEach(skin => {
      add({ ...plain, color: QB_TOP, skin, dir: 'side', pose: 'qb-hold', carry: true })
      for (const pose of ['qb-cock', 'qb-rel', 'qb-follow', null]) add({ ...plain, color: QB_TOP, skin, dir: 'side', pose })
    })
    return out
  }
  if (g.game === 'catch') return catchLooks(g, view)
  const men = menOf(g, view.cast), lookOf = m => (m ? { number: m.number, skin: m.skin } : null)
  const mine = { kit: 'pads', color: c.us, trim: c.trim, pants: c.trim, ...lookOf(men.me) }, his = { kit: 'pads', color: them.color, trim: them.trim, pants: them.trim, ...lookOf(men.cb) }
  for (const pose of ['stance', 'block']) { add({ ...mine, dir: 'up', pose }); add({ ...his, dir: 'down', pose }) }
  add({ ...mine, dir: 'up', pose: 'ready' }); add({ ...his, dir: 'down', pose: 'ready' }); add({ ...mine, dir: 'up', carry: true }); add({ ...mine, dir: 'up' })
  // (the line, the QB and the safety, if they're real men)
  const plain = { kit: 'pads', color: c.us, trim: c.trim, pants: c.trim }
  men.ol.forEach(m => { if (m) for (const pose of ['stance', 'block']) add({ ...plain, ...lookOf(m), dir: 'up', pose }) })
  if (men.qb) { add({ ...plain, ...lookOf(men.qb), dir: 'up', carry: true }); add({ ...plain, ...lookOf(men.qb), dir: 'up' }) }
  if (men.sf) { add({ ...his, ...lookOf(men.sf), dir: 'down', pose: 'ready' }); for (const step of STEPS) add({ ...his, ...lookOf(men.sf), dir: 'down', step }) }
  for (const step of STEPS) {
    for (const pose of [null, 'swipe-l', 'swipe-r']) add({ ...mine, dir: 'up', step, pose })
    for (const dir of ['up', 'down']) add({ ...his, dir, step })
    add({ ...his, dir: 'down', step, pose: 'ready' })
  }
  return out
}
export function draw(ctx, g, view) {
  warmUp(g, () => looksOf(g, view))
  placeStamp(g.stamp, view)
  if (g.game === 'catch') drawCatch(ctx, g, view)
  else if (g.game === 'release') drawRelease(ctx, g, view)
  else drawGauntlet(ctx, g, view)
}
