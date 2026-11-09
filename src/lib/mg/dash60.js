// THE 60-YARD DASH, the showcase's sprint, in first person on the outfield grass down the right-field line of an empty
// ballpark: the 40's rules (lib/mg/dash.js: set, the gun at a moment nobody can time, then LEFT RIGHT LEFT RIGHT as fast
// as you can; the same foot twice does nothing; his legs run at his speed, not at your presses) over 60 yards. Cones
// every ten, the timing gates at the start, 30 and 60, the scouts at the finish with their stopwatches, the time on the
// scoreboard. (The rules are the 40's, written out here so the football game never moves for baseball.)
import { clamp, lerp, outcome, rngOf, prog, easeOut, text, DISPLAY, LABEL, GOOD, BAD, GOLD, nudge } from './kit.js'
import { dashTarget } from './combineNorms.js'
import { curve, clockSlab, officialStrip, officialPunch, OFFICIAL_MS, calm, stopwatch } from './dash.js'
import { placeStamp } from './read.js'
import { camOf, P, park, baller, uniforms, dressB, BP, flatB, lineB } from './baseball.js'

export const how = {
  sixty: 'The 60, on the outfield grass. Wait for the gun. Then alternate LEFT and RIGHT as fast as possible.',
}

// top speed (yards a second) against the time it runs over 60 yards on a solid go (measured the same way as the 40's:
// the best go a person can have, the 40's bot; see scripts/mg/calib-dash.mjs)
const CAPOF_60 = [[5.12, 14], [5.28, 13.5], [5.45, 13], [5.63, 12.5], [5.83, 12], [6.05, 11.5], [6.29, 11], [6.55, 10.5], [6.83, 10], [7.15, 9.5], [7.5, 9], [7.89, 8.5], [8.33, 8]]
const S = { dist: 60, range: 1.3, gun: 'gun', splitAt: 30, slack: 0.52, capOf: CAPOF_60 }
const BY_GAP = [[110, 1], [140, 0.94], [180, 0.84], [250, 0.66], [400, 0.4], [700, 0.12], [1100, 0]]
const TAU_UP = 0.62, TAU_DOWN = 0.5, STRIDE_YD = 4.8, GIVE_UP = 13000, RESET = 720

export function make({ v, seed, pos, capOverride }) {
  const r = rngOf(seed)
  const target = dashTarget('sixty', pos === 'pit' ? 'pit' : 'bat', v)
  const cap = capOverride ?? curve(target, S.capOf), passAt = target + S.slack
  const slow = passAt + S.range * 0.5
  const wait = () => 900 + r() * 1500
  const g = {
    t: 0, game: 'sixty', zones: 'lr', pads: ['LEFT', 'RIGHT'], padLit: null, fx: [], done: null, outro: 1700, stamp: null,
    S, cap, dist: S.dist,
    phase: 'set', gunT: wait(), goAt: null, falses: 0, fsAt: -9999, penalty: 0,
    y: 0, speed: 0, last: null, strideAt: 0, strideN: 0, lastPress: 0, firstPress: null, gapAvg: 200,
    needMs: 0, cycle: 0, crossed: null, split: null, splitAt: -9999, finalSecs: null,
    hud: { prompt: 'WAIT FOR THE GUN' },
    tick(dt) {
      g.t += dt
      const s = dt / 1000
      if (g.phase === 'set') {
        if (g.t >= g.gunT) { g.phase = 'run'; g.goAt = g.t; g.lastPress = g.t; g.fx.push('pop', 'h:medium'); g.hud.prompt = null }
        return
      }
      if (g.done) g.speed *= Math.exp(-s / 0.55)
      else if (g.firstPress != null) {
        const want = cap * curve(Math.max(g.gapAvg, g.t - g.lastPress), BY_GAP)
        g.speed += (want - g.speed) * (1 - Math.exp(-s / (want > g.speed ? TAU_UP : TAU_DOWN)))
      }
      const was = g.y
      g.y += g.speed * s
      const top = clamp(g.speed / (cap * 0.72), 0, 1)
      g.cycle += (g.speed * s) / lerp(2.8, STRIDE_YD, top)
      if (g.done) { g.padLit = null; return }
      g.padLit = g.firstPress == null ? null : 1 - (g.last ?? 1)
      if (g.split == null && g.y >= S.splitAt) { g.split = clock(); g.splitAt = g.t }
      if (g.firstPress != null) g.hud.prompt = null
      if (g.y >= g.dist) { g.crossed = g.t - dt * clamp((g.y - g.dist) / (g.y - was || 1), 0, 1); finish() }
      else if (g.t - g.goAt >= GIVE_UP) finish(true)
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      const side = a.zone === 'L' ? 0 : a.zone === 'R' ? 1 : null
      if (side == null) return
      if (g.phase === 'set') return falseStart()
      g.lastPress = g.t
      if (g.firstPress == null) { g.firstPress = g.t; stride(side, true); return }
      if (side === g.last) return
      stride(side)
    },
  }
  function falseStart() {
    if (g.t < g.fsAt + RESET) return
    g.falses++; g.fsAt = g.t
    g.gunT = g.t + RESET + wait()
    if (g.falses > 2) g.penalty += 0.1
    g.stamp = { text: g.falses > 2 ? 'FALSE START +0.10' : 'FALSE START', good: false, at: g.t, ms: RESET - 20, size: g.falses > 2 ? 32 : 46 }
    g.fx.push('deny', 'h:heavy')
    if (g.falses >= 5) { g.phase = 'run'; g.goAt = g.t; g.lastPress = g.t; g.done = outcome(0, false, 'Disqualified', { secs: GIVE_UP / 1000 }); g.stamp = { text: 'DISQUALIFIED', good: false, at: g.t, size: 46 }; g.hud.prompt = null }
  }
  function stride(side, first = false) {
    g.gapAvg = first ? 200 : g.gapAvg * 0.7 + (g.t - g.strideAt) * 0.3
    g.last = side; g.strideAt = g.t; g.strideN++
    if (g.strideN % 2 === 0) g.fx.push('tap')
    g.fx.push('h:light')
  }
  const clock = () => (g.t - g.goAt) / 1000 + g.penalty
  function finish(gaveUp = false) {
    const secs = gaveUp ? GIVE_UP / 1000 : (g.crossed - g.goAt) / 1000 + g.penalty
    const score = gaveUp ? 0 : clamp((slow - secs) / S.range, 0, 1)
    const hit = score >= 0.5
    const react = g.firstPress != null ? g.firstPress - g.goAt : 9999
    const parts = [gaveUp ? 'Pulled up' : react < 260 ? 'Great start' : react < 400 ? 'Clean start' : 'Slow start']
    if (g.falses) parts.push(g.falses > 1 ? `${g.falses} false starts` : 'False start')
    g.done = outcome(score, hit, [gaveUp ? null : `${secs.toFixed(2)}s`, ...parts].filter(Boolean).join(' · '), { secs: Math.round(secs * 100) / 100 })
    g.finalSecs = secs
    g.hud.prompt = null; g.padLit = null
    g.stamp = { text: gaveUp ? 'PULLED UP' : hit ? 'PLUS RUNNER' : 'TOO SLOW', good: hit, at: g.t, size: 46 }
    g.fx.push('swoosh')
  }
  g.clock = () => (g.goAt == null ? g.penalty : g.finalSecs != null ? g.finalSecs : clock())
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
// The lane runs on the outfield grass alongside the right-field line, toward the corner: the foul pole, the wall and
// the empty bleachers ahead, the line and the seats on the right, the outfield on the left.
const YD = 0.9144, DIR = { x: Math.SQRT1_2, z: Math.SQRT1_2 }, START = { x: 23.5, z: 26.5 }, LANE = 1.5
const at = (d, side = 0) => ({ x: START.x + DIR.x * d + DIR.z * side, z: START.z + DIR.z * d - DIR.x * side })
const smooth = f => f * f * (3 - 2 * f)
const MPH = 2.045
function camFor(g, view) {
  const first = g.firstPress, quiet = calm()
  const up = first == null ? 0 : smooth(prog(g.t, first, first + 320))
  const top = clamp(g.speed / (g.cap * 0.72), 0, 1)
  const bob = quiet ? 0 : Math.sin(g.cycle * Math.PI * 4) * 0.045 * top
  let fs = 0
  const fsAge = g.t - g.fsAt
  if (fsAge < 720 && first == null) fs = fsAge < 200 ? easeOut(fsAge / 200) : 1 - easeOut((fsAge - 200) / 520)
  const m = g.y * YD - lerp(0.45, 0.1, up) + fs * 0.3, p = at(m)
  return camOf(view, { x: p.x, y: lerp(1.15, 1.66, Math.max(up, fs * 0.5)) + bob, z: p.z, yaw: Math.PI / 4, pitch: lerp(0.09, 0.03, up), F: 330, cy: 0.36 })
}
function gate(ctx, C, d, hit, finish) {
  for (const sd of [-1, 1]) {
    const q = at(d, sd * (LANE + 0.5)), a = P(C, q.x, 0, q.z), b = P(C, q.x, 1.05, q.z)
    if (!a.ok || a.d < 0.8) continue
    ctx.strokeStyle = '#161b20'; ctx.lineWidth = Math.max(1, 0.05 * a.s)
    ctx.beginPath(); ctx.moveTo(a.x - 0.18 * a.s, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(a.x + 0.18 * a.s, a.y); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.stroke()
    ctx.fillStyle = finish ? GOLD : '#d8dde1'; ctx.fillRect(b.x - 0.1 * b.s, b.y - 0.16 * b.s, 0.2 * b.s, 0.16 * b.s)
    ctx.fillStyle = hit ? GOOD : '#c9423a'; ctx.fillRect(b.x - 0.04 * b.s, b.y - 0.11 * b.s, 0.08 * b.s, 0.06 * b.s)
  }
}
function cones(ctx, C) {
  for (let yd = 10; yd < 60; yd += 10) for (const sd of [-1, 1]) {
    const q = at(yd * YD, sd * LANE), p = P(C, q.x, 0, q.z)
    if (!p.ok || p.d < 0.9) continue
    const h = 0.3 * p.s, w = 0.22 * p.s
    ctx.fillStyle = '#f08a24'; ctx.beginPath(); ctx.moveTo(p.x - w / 2, p.y); ctx.lineTo(p.x + w / 2, p.y); ctx.lineTo(p.x, p.y - h); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#f4f6f2'; ctx.fillRect(p.x - w * 0.22, p.y - h * 0.55, w * 0.44, Math.max(0.6, h * 0.12))
  }
}
function drawClock(ctx, g, view) {
  const { w } = view, y = 44, ph = 52
  const over = g.crossed == null ? -1 : g.t - g.crossed, official = over >= OFFICIAL_MS || (g.done && g.crossed == null)
  const col = official ? (g.done.hit ? GOOD : BAD) : g.goAt != null ? '#fff' : 'rgba(255,255,255,.5)'
  const q = over >= 0 ? officialPunch(over) : 1
  if (q !== 1) { ctx.save(); ctx.translate(w / 2, y + ph / 2); ctx.scale(q, q); ctx.translate(-w / 2, -(y + ph / 2)) }
  clockSlab(ctx, view, Math.min(g.clock(), 99.99).toFixed(2), col, g.y / g.dist)
  if (q !== 1) ctx.restore()
  const dim = 'rgba(255,255,255,.72)'
  if (g.split != null) text(ctx, `30 YD ${g.split.toFixed(2)}`, 12, y + ph / 2 - 1, { font: LABEL, size: 17, align: 'left', color: g.t - g.splitAt < 520 ? GOLD : dim })
  text(ctx, `${Math.min(60, Math.floor(g.y))} YD`, w - 12, y + ph / 2 - 11, { font: LABEL, size: 16, align: 'right', color: dim })
  if (g.goAt != null) text(ctx, `${(g.done ? g.topMph ?? 0 : g.speed * MPH).toFixed(1)} MPH`, w - 12, y + ph / 2 + 9, { font: LABEL, size: 16, align: 'right', color: !g.done && g.speed >= g.cap * 0.965 ? GOLD : dim })
  if (over >= 0) {
    const react = g.firstPress != null ? Math.max(0, (g.firstPress - g.goAt) / 1000) : 0
    officialStrip(ctx, view, over, g.done?.hit, `REACTION ${react.toFixed(2)}   TOP ${(g.topMph ?? 0).toFixed(1)} MPH`)
  }
}
export function draw(ctx, g, view) {
  if (g.goAt != null && !g.done) g.topMph = Math.max(g.topMph ?? 0, g.speed * MPH)
  if (g.done && g.crossed != null && !g.settled) { g.settled = true; if (g.stamp) g.stamp.at += OFFICIAL_MS; g.outro = (g.outro ?? 1700) + OFFICIAL_MS }
  if (g.crossed != null && !g.official && g.t - g.crossed >= OFFICIAL_MS) { g.official = true; g.fx.push('stamp') }
  const C = camFor(g, view), K = uniforms(view, true)
  g.nudge ??= nudge()
  if (g.firstPress != null && !g.felt) { g.felt = true; g.nudge.kick(g.t, 1.6, 0, -1, 130) }
  const team = [view.colors.us, view.colors.trim]
  park(ctx, view, C, { team, empty: true, lite: true })
  // the lane: its edges chalked on the grass, the start line, the finish in gold
  const a0 = at(0, -LANE), a1 = at(60 * YD, -LANE), b0 = at(0, LANE), b1 = at(60 * YD, LANE)
  ctx.fillStyle = 'rgba(244,247,242,.7)'; ctx.beginPath(); lineB(ctx, C, a0.x, a0.z, a1.x, a1.z, 0.06); lineB(ctx, C, b0.x, b0.z, b1.x, b1.z, 0.06)
  const s0 = at(0, -LANE - 0.6), s1 = at(0, LANE + 0.6); lineB(ctx, C, s0.x, s0.z, s1.x, s1.z, 0.1); ctx.fill()
  const f0 = at(60 * YD, -LANE - 0.6), f1 = at(60 * YD, LANE + 0.6); ctx.fillStyle = GOLD; ctx.beginPath(); lineB(ctx, C, f0.x, f0.z, f1.x, f1.z, 0.22); ctx.fill()
  // the scouts at the finish with their watches, more of them along the line with clipboards
  const over = g.crossed == null ? -1 : g.t - g.crossed, good = g.done?.hit, watchUp = g.crossed == null || g.t < g.crossed + 240
  const scout = dressB(K.scout, { skin: '#c09060' }, { front: true, noBat: true })
  for (const [side, dz, sk] of [[-LANE - 1.6, 1.2, '#6d4229'], [LANE + 1.7, 1.6, '#c09060'], [LANE + 3.1, 3.4, '#8d5a3b'], [-LANE - 3, 2.6, '#f0c4a0']]) {
    const q = at(60 * YD + dz, side)
    const pose = over >= OFFICIAL_MS && side > 0 && good ? BP.point : watchUp ? { ...BP.stand, hrx: 13, hry: -86 } : BP.stand
    const p = baller(ctx, C, q.x, q.z, pose, { ...scout, skin: sk, cap: sk === '#c09060' ? '#1f2a3a' : '#3a2a1e' })
    if (p.ok && watchUp) { const k = p.s * 1.85 / 110; stopwatch(ctx, p.x + 13 * k, p.y - 88 * k, Math.max(0.6, k * 1.4)) }
  }
  for (const yd of [60, 30, 0]) gate(ctx, C, yd * YD, g.y >= yd && g.goAt != null, yd === 60)
  cones(ctx, C)
  // the starter, off to the side of the line with his gun
  const st = at(3, -LANE - 3.4), sp = baller(ctx, C, st.x, st.z, g.phase === 'set' ? { ...BP.stand, hrx: 16, hry: -118, fr: 1 } : BP.stand, { ...dressB(K.staff, { skin: '#5e3c22' }, { front: true }) })
  void sp
  drawClock(ctx, g, view)
  const { w } = view, wordY = C.cy + Math.min(150, (view.h - 96 - C.cy) * 0.35)
  placeStamp(g.stamp, view)
  if (g.phase === 'set' && g.t >= g.fsAt + RESET) text(ctx, 'SET', w / 2, wordY, { font: DISPLAY, size: 46, color: '#fff' })
  else if (g.phase === 'run' && !g.done && g.t - g.goAt < 420) {
    const q = 1 + 0.4 * (1 - easeOut(clamp((g.t - g.goAt) / 110, 0, 1)))
    ctx.save(); ctx.translate(w / 2, wordY); ctx.scale(q, q); text(ctx, 'GO', 0, 0, { font: DISPLAY, size: 62, color: GOLD }); ctx.restore()
  }
}
