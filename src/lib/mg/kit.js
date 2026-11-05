// The shared kit for the skill games (lib/mg/*.js). A game is two things:
//
//   make({ v, seed, def }) → g   the rules: no DOM, no timers, no sounds. Time only moves
//                                through g.tick(dt), so the same game runs in a browser and in
//                                scripts/mg/balance.mjs, where a simulated human plays it.
//   draw(ctx, g, view)           the picture of g right now. ctx is scaled: draw in logical
//                                units, view.w is always 360 and view.h is 520-780.
//
// g must have:
//   tick(dt)        advance dt ms (the host always steps 1000/120)
//   input(a)        a = { kind: 'down' | 'up', zone, x, y }   zone: 'L' | 'R' on g.zones 'lr',
//                   0 | 1 | 2 on 'three', null on 'none'. x, y are logical units.
//   zones           'none' | 'lr' | 'three': how the screen splits under a finger
//   done            null, then { score 0-1, hit, note, raw, out } when the game is decided.
//                   The game keeps ticking after this: the outro is its payoff.
//   outro           ms the host keeps drawing after done (default 1100)
//   fx              array the host empties each frame: 'tap' 'pop' 'whistle' 'claim' 'deny' 'swoosh',
//                   or 'h:light' 'h:medium' 'h:heavy' 'h:success' for haptics
//   hud             { prompt: 'CATCH IT', dots: [null|true|false, ...] }; the host draws it
//   pads            optional labels for the thumb pads, e.g. ['LEFT', 'RIGHT']; the host draws them
//   stamp           optional { text, good, at } (at = g.t when it landed); the host draws it
import { seeded } from '../rng.js'

export const STEP = 1000 / 120
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export const lerp = (a, b, f) => a + (b - a) * f
export const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1)
export const easeOut = f => 1 - (1 - f) * (1 - f)
export const easeIn = f => f * f
export const easeInOut = f => (f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f))
export const rngOf = seed => seeded(`mg-${seed}`)
// what a trait (1-11) buys: lo at grade 1, hi at grade 11
export const byV = (v, lo, hi) => lerp(lo, hi, clamp((v - 1) / 10, 0, 1))
// the outcome both a game and its stamp speak in
export const outcome = (score, hit, note = null, raw = null, out = false) => ({ score: clamp(score, 0, 1), hit: !!hit, note, raw, out: !!out })

// ── Fonts ───────────────────────────────────────────────────────────────────
export const DISPLAY = `'BAP Anton', Anton, Impact, sans-serif`
export const LABEL = `'BAP Bebas', 'Bebas Neue', Impact, sans-serif`
export const BODY = `Outfit, system-ui, sans-serif`
export function text(ctx, str, x, y, { font = LABEL, size = 16, color = '#fff', align = 'center', base = 'middle', track = 0, weight = '' } = {}) {
  ctx.font = `${weight ? `${weight} ` : ''}${size}px ${font}`
  ctx.textAlign = align; ctx.textBaseline = base
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${track}px`
  ctx.fillStyle = color
  ctx.fillText(str, x, y)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
}
export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r) }
export const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2) }

// ── Painted backgrounds ─────────────────────────────────────────────────────
// A background is painted once per size and blitted: nothing else on screen is big enough to
// cost a frame. (key: what's painted; the size comes from the view.)
const layers = new Map()
export const stage = { tag: '' }   // (which camera: what's baked through one doesn't fit another)
// ── The home field: whose logo is on the 50 and whose name is in the end zone ──
// view.field, painted into the flat field once (never per frame). The logo comes in a moment later: its
// id changes when it does, and the baked pictures are made again once.
const logos = new Map()
function logoOf(short, onReady) {
  let e = logos.get(short)
  if (!e && typeof Image !== 'undefined') {
    e = { img: new Image(), ok: false, wait: [] }
    logos.set(short, e)
    e.img.onload = () => { e.ok = true; for (const fn of e.wait) fn(); e.wait.length = 0 }
    e.img.src = `/logos/${short}.png`
  }
  if (e && !e.ok) e.wait.push(onReady)
  return e
}
export const romanOf = n => [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((o, [v, r]) => { while (n >= v) { o.s += r; n -= v } return o }, { s: '' }).s
// the end zone's lettering: the second colour if it reads on the first, otherwise white
const lumOf = hex => { const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16) || 0; return 0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255) }
const inkFor = (bg, second) => (second && Math.abs(lumOf(bg) - lumOf(second)) >= 70 ? second : lumOf(bg) > 170 ? '#10151a' : '#ffffff')
export function fieldFor(home, superBowl = null) {
  if (superBowl) return { id: `sb|${superBowl}`, superBowl, end: '#0b1f3a', endText: '#e8c15a', word: 'SUPER BOWL' }
  if (!home?.short) return null
  const nick = String(home.name ?? home.short).trim().split(/\s+/).pop().toUpperCase()
  const f = { id: home.short, short: home.short, end: home.color, endText: inkFor(home.color, home.color2), word: nick, color: home.color, trim: home.color2 ?? '#ffffff', logo: null }
  const e = logoOf(home.short, () => { f.logo = e.img; f.id = `${home.short}|logo` })
  if (e?.ok) { f.logo = e.img; f.id = `${home.short}|logo` }
  return f
}
function endZone(x, f, top, H, SL, SR) {
  x.fillStyle = f.end; x.fillRect(SL, top, SR - SL, H)
  const size = H * 0.72
  x.save(); x.translate((SL + SR) / 2, top + H / 2 + 1)
  x.font = `${size}px ${DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'
  if ('letterSpacing' in x) x.letterSpacing = '3px'
  // stretched across the zone, whatever the name's length
  const tw = x.measureText(f.word).width, room = (SR - SL) * 0.84
  x.scale(room / tw, 1)
  x.lineJoin = 'round'; x.strokeStyle = 'rgba(8,12,16,.6)'; x.lineWidth = Math.max(1.5, H * 0.025); x.strokeText(f.word, 0, 0)
  x.fillStyle = f.endText; x.fillText(f.word, 0, 0)
  if ('letterSpacing' in x) x.letterSpacing = '0px'
  x.restore()
  x.fillStyle = 'rgba(255,255,255,.92)'; x.fillRect(SL, top + H - 2, SR - SL, 3.5); x.fillRect(SL - 3, top - 2, SR - SL + 6, 3)
}
// ez: where the far goal line is painted; pyd: units a yard along the field. A yard across it is about 6.8 units.
export function paintFieldDress(x, view, ez, pyd, SL, SR) {
  const f = view.field
  if (!f) return
  const H = pyd * 10, ACROSS = 6.8
  f.backY = null
  if (ez > 0 && ez - H < view.h) {
    // past the back line the field's over: a flat apron out to the stands
    if (ez - H > 0) { x.fillStyle = '#123f23'; x.fillRect(-view.w * 0.25, 0, view.w * 1.5, ez - H) }
    endZone(x, f, ez - H, H, SL, SR)
    f.backY = ez - H
  }
  const far = ez + 100 * pyd
  if (far < view.h && far + H > 0) endZone(x, f, far, H, SL, SR)
  const mid = ez + 50 * pyd
  if (mid < -H * 2 || mid > view.h + H * 2) return
  const cx = (SL + SR) / 2, ratio = pyd / ACROSS   // (so a circle on the turf is a circle on the turf)
  if (f.superBowl) {
    x.save(); x.translate(cx, mid); x.scale(1, ratio); x.rotate(Math.PI / 2)
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.strokeStyle = 'rgba(8,12,16,.75)'; x.lineWidth = 2.4
    x.font = `15px ${DISPLAY}`; x.fillStyle = f.endText; x.strokeText('SUPER BOWL', 0, -24); x.fillText('SUPER BOWL', 0, -24)
    x.font = `38px ${DISPLAY}`; x.fillStyle = f.endText; x.strokeText(f.superBowl, 0, 8); x.fillText(f.superBowl, 0, 8)
    x.restore()
    return
  }
  // (the flat field's yards are a different size in each game; sized off them, so it's the same patch of turf)
  const across = 150, along = Math.max(pyd * 13, 96)
  x.save(); x.translate(cx, mid)
  if (f.logo) {
    x.scale(across / 100, along / 100); x.rotate(Math.PI / 2)
    const iw = f.logo.naturalWidth || 1, ih = f.logo.naturalHeight || 1, k = Math.min(100 / iw, 100 / ih)
    // (the Jets' wordmark sits in a white oval with a green ring, as on their field)
    if (f.short === 'NYJ') {
      x.beginPath(); x.ellipse(0, 0, iw * k * 0.56, ih * k * 0.31, 0, 0, Math.PI * 2); x.fillStyle = f.color; x.fill()
      x.beginPath(); x.ellipse(0, 0, iw * k * 0.53, ih * k * 0.28, 0, 0, Math.PI * 2); x.fillStyle = '#ffffff'; x.fill()
    }
    x.drawImage(f.logo, -iw * k / 2, -ih * k / 2, iw * k, ih * k)
  } else {
    x.scale(1, ratio); x.rotate(Math.PI / 2)
    x.font = `30px ${DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = f.color; x.fillText(f.short, 0, 1)
  }
  x.restore()
}
export function layer(ctx, view, key, paint) {
  const id = `${key}|${view.h}|${view.px}|${stage.tag}|${view.field?.id ?? ''}`
  let c = layers.get(id)
  if (!c) {
    if (typeof document === 'undefined') return
    if (layers.size > 24) layers.clear()
    c = document.createElement('canvas')
    c.width = Math.round(view.w * view.px); c.height = Math.round(view.h * view.px)
    const x = c.getContext('2d', { alpha: false })
    x.scale(view.px, view.px)
    paint(x, view)
    layers.set(id, c)
  }
  ctx.drawImage(c, 0, 0, view.w, view.h)
}

// Grass in mown bands, with yard lines and hashes. Yards run up the screen.
// opt.los: y of the line of scrimmage; opt.gap: px between yard lines; opt.endzone: y it starts above
export function paintTurf(x, view, { gap = 62, offset = 0, numbers = true, endzone = null, endColor = '#14324f' } = {}) {
  const { w, h } = view
  x.fillStyle = '#1f6b3a'; x.fillRect(0, 0, w, h)
  for (let i = -1, y = offset - gap; y < h; i++, y += gap) {
    x.fillStyle = i % 2 ? '#1c6336' : '#22733f'
    x.fillRect(0, y, w, gap)
  }
  if (endzone != null) { x.fillStyle = endColor; x.fillRect(0, 0, w, endzone); x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(0, endzone - 2, w, 3) }
  x.fillStyle = 'rgba(255,255,255,.62)'
  for (let y = offset; y < h; y += gap) {
    if (endzone != null && y < endzone) continue
    x.fillRect(0, y - 1, w, 2)
    for (let k = 1; k < 5; k++) { const hy = y + (gap * k) / 5; x.fillRect(w * 0.36 - 5, hy, 10, 1.5); x.fillRect(w * 0.64 - 5, hy, 10, 1.5) }
  }
  if (numbers) {
    let n = 50
    for (let y = offset; y < h; y += gap * 2, n -= 10) {
      if (n <= 0 || (endzone != null && y < endzone)) continue
      text(x, String(n), 26, y, { font: DISPLAY, size: 22, color: 'rgba(255,255,255,.34)' })
      text(x, String(n), w - 26, y, { font: DISPLAY, size: 22, color: 'rgba(255,255,255,.34)' })
    }
  }
}
// A field that runs past: one painted tile (two five-yard bands, the lines, the hashes), blitted
// over and over. y: how far the camera has come, in logical units. Call it instead of layer().
export const TURF_GAP = 118
const tiles = new Map()
export function turfScroll(ctx, view, y = 0) {
  const id = view.px
  let c = tiles.get(id)
  if (!c) {
    if (typeof document === 'undefined') return
    const H = TURF_GAP * 2
    c = document.createElement('canvas')
    c.width = Math.round(view.w * view.px); c.height = Math.round(H * view.px)
    const x = c.getContext('2d', { alpha: false })
    x.scale(view.px, view.px)
    x.fillStyle = '#23783f'; x.fillRect(0, 0, view.w, TURF_GAP)
    x.fillStyle = '#1e6d38'; x.fillRect(0, TURF_GAP, view.w, TURF_GAP)
    // the mower's grain, faint
    x.fillStyle = 'rgba(255,255,255,.018)'
    for (let i = 0; i < 8; i++) x.fillRect(i * 45, 0, 22, H)
    x.fillStyle = 'rgba(255,255,255,.78)'
    x.fillRect(0, 0, view.w, 3); x.fillRect(0, TURF_GAP, view.w, 3)
    for (const b of [0, TURF_GAP]) for (let k = 1; k < 5; k++) { const hy = b + (TURF_GAP * k) / 5; x.fillRect(view.w * 0.33 - 8, hy, 16, 2); x.fillRect(view.w * 0.67 - 8, hy, 16, 2) }
    tiles.set(id, c)
  }
  const H = TURF_GAP * 2, off = ((y % H) + H) % H
  for (let yy = off - H; yy < view.h; yy += H) ctx.drawImage(c, 0, yy, view.w, H)
}

// A regulation NBA half court from above, to scale: the screen's width is the court's 50 feet.
// rimY: the rim's height on the screen; the baseline is 5'3" behind it. Everything else follows:
// lane 16' wide, free-throw line 19' from the baseline, three-point arc 23'9" from the rim,
// 22' in the corners, where it runs straight to the baseline.
export const COURT_FT = 7.2   // logical units a foot
export function paintCourt(x, view, { rimY = 96, paint = '#8a3f1e' } = {}) {
  const { w, h } = view, ft = COURT_FT, cx = w / 2
  const base = rimY - 5.25 * ft
  // past the baseline: the dark of the stands
  x.fillStyle = '#12181c'; x.fillRect(0, 0, w, h)
  // maple boards, close in tone
  x.fillStyle = '#c98f55'; x.fillRect(0, base, w, h - base)
  for (let i = 0; i * 18 < w; i++) {
    x.fillStyle = i % 3 === 0 ? 'rgba(255,235,200,.05)' : i % 3 === 1 ? 'rgba(90,50,15,.05)' : 'rgba(0,0,0,0)'
    x.fillRect(i * 18, base, 18, h - base)
  }
  const line = 'rgba(255,255,255,.92)'
  // the lane and the free-throw circle
  const laneW = 16 * ft, ftY = base + 19 * ft
  x.fillStyle = paint; x.fillRect(cx - laneW / 2, base, laneW, ftY - base)
  x.strokeStyle = line; x.lineWidth = 2.2
  x.strokeRect(cx - laneW / 2, base, laneW, ftY - base)
  x.beginPath(); x.arc(cx, ftY, 6 * ft, 0, Math.PI * 2); x.stroke()
  // the block marks up the lane
  x.fillStyle = line
  for (const d of [7, 8, 11, 14]) { const y = base + d * ft; x.fillRect(cx - laneW / 2 - 5, y, 5, 2); x.fillRect(cx + laneW / 2, y, 5, 2) }
  // the three-point line: straight from the baseline in the corners, then the arc around the rim
  const R = 23.75 * ft, corner = 22 * ft, join = Math.sqrt(R * R - corner * corner), a = Math.atan2(join, corner)
  x.beginPath()
  x.moveTo(cx - corner, base); x.lineTo(cx - corner, rimY + join)
  x.arc(cx, rimY, R, Math.PI - a, a, true)
  x.lineTo(cx + corner, base); x.stroke()
  // the baseline, the restricted arc, the backboard and rim
  x.fillStyle = line; x.fillRect(0, base - 1, w, 2.2)
  x.beginPath(); x.arc(cx, rimY, 4 * ft, 0, Math.PI); x.stroke()
  x.fillStyle = '#e8edf2'; x.fillRect(cx - 3 * ft, base + 4 * ft - 2, 6 * ft, 3.5)
  x.strokeStyle = '#f26a1b'; x.lineWidth = 3; circle(x, cx, rimY, 0.9 * ft); x.stroke()

}
// A dark arena for the side-on drills (dash, bench, jump, shots): a floor line under a wall
export function paintArena(x, view, { floor = 0.74, wall = '#10181c', ground = '#1a2a2e', line = 'rgba(255,255,255,.14)' } = {}) {
  const { w, h } = view, fy = h * floor
  x.fillStyle = wall; x.fillRect(0, 0, w, fy)
  x.fillStyle = ground; x.fillRect(0, fy, w, h - fy)
  x.fillStyle = line; x.fillRect(0, fy, w, 2)
}

// ── Players from above ──────────────────────────────────────────────────────
// A shadow, the shoulders, the helmet. face: radians, 0 = up the screen. stride: 0-1 of a step
export function player(ctx, x, y, { color = '#1b6fd1', trim = '#fff', face = 0, stride = null, scale = 1.55, helmet = true, skin = '#8d5a3b', num = null } = {}) {
  ctx.save()
  ctx.translate(x, y); ctx.scale(scale, scale)
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(2.5, 3.5, 13, 9.5, face, 0, Math.PI * 2); ctx.fill()
  ctx.rotate(face)
  if (stride != null) {
    const s = Math.sin(stride * Math.PI * 2) * 5
    ctx.fillStyle = '#20262c'
    ctx.beginPath(); ctx.ellipse(-5, -s, 3.2, 5, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(5, s, 3.2, 5, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.2
  ctx.fillStyle = color; rr(ctx, -13.5, -7, 27, 14, 7); ctx.fill(); ctx.stroke()
  ctx.fillStyle = trim; ctx.fillRect(-12.5, -1.2, 5.5, 2.6); ctx.fillRect(7, -1.2, 5.5, 2.6)
  if (helmet) {
    ctx.fillStyle = trim; circle(ctx, 0, -0.5, 7.4); ctx.fill(); ctx.stroke()
    ctx.fillStyle = color; ctx.fillRect(-1.5, -7.6, 3, 14)
    ctx.strokeStyle = '#20262c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -0.5, 7.6, -2.3, -0.84); ctx.stroke()
  } else {
    ctx.fillStyle = skin; circle(ctx, 0, 0, 6.4); ctx.fill()
  }
  ctx.restore()
  if (num != null) text(ctx, String(num), x, y + 16 * scale, { size: 10 * scale, color: 'rgba(255,255,255,.8)' })
}
export const OPP = { color: '#c9423a', trim: '#f4efe6' }
// the other team, for this game (Career: who the player is facing)
export const themOf = view => ({ color: view.colors.them, trim: view.colors.themTrim })
// A football seen from above, turned to where it's going
export function football(ctx, x, y, { ang = 0, scale = 1.5 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(scale, scale)
  ctx.fillStyle = '#7a4420'; ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 7.2, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke()
  ctx.fillStyle = '#f4efe6'; ctx.fillRect(-0.7, -3.2, 1.4, 6.4); ctx.fillRect(-2, -1.8, 4, 0.9); ctx.fillRect(-2, 0.8, 4, 0.9)
  ctx.restore()
}
export function basketball(ctx, x, y, { r = 11, spin = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin)
  ctx.fillStyle = '#e8772e'; circle(ctx, 0, 0, r); ctx.fill()
  ctx.strokeStyle = 'rgba(40,18,6,.8)'; ctx.lineWidth = Math.max(1, r * 0.13)
  ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke()
  ctx.beginPath(); ctx.arc(-r * 1.1, 0, r * 0.8, -0.8, 0.8); ctx.stroke()
  ctx.beginPath(); ctx.arc(r * 1.1, 0, r * 0.8, Math.PI - 0.8, Math.PI + 0.8); ctx.stroke()
  ctx.restore()
}
// a ring on the ground under someone: who to look at. Flat, no glow.
export function ring(ctx, x, y, r, color, width = 3) { ctx.strokeStyle = color; ctx.lineWidth = width; circle(ctx, x, y, r); ctx.stroke() }
export const GOOD = '#35e07a', BAD = '#ff5a48', GOLD = '#f5dc8a'

// ── A figure from the side ──────────────────────────────────────────────────
// A pictogram athlete in the team's colour, for the side-on drills. A pose is angles in radians,
// 0 = straight down, positive = forward (toward +x): hip, knee (bend), shoulder, elbow, for each
// side, plus lean (torso, from upright). Everything hangs off the hip at x, y.
export function figure(ctx, x, y, pose, { color = '#1b6fd1', skin = '#8d5a3b', shorts = '#20262c', scale = 1, flip = false } = {}) {
  const U = 21, L = 21, A = 15, F = 15, T = 34
  const { lean = 0, hipF = 0, kneeF = 0, hipB = 0, kneeB = 0, armF = 0, elbF = 0, armB = 0, elbB = 0 } = pose
  ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -scale : scale, scale)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const limb = (ox, oy, a1, a2, l1, l2, w, col, col2 = col) => {
    const kx = ox + Math.sin(a1) * l1, ky = oy + Math.cos(a1) * l1
    const fx = kx + Math.sin(a1 - a2) * l2, fy = ky + Math.cos(a1 - a2) * l2
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(kx, ky); ctx.stroke()
    ctx.strokeStyle = col2; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke()
    return [fx, fy]
  }
  const sx = Math.sin(lean) * T, sy = -Math.cos(lean) * T   // the shoulders
  // far side first
  limb(sx, sy, armB, elbB, A, F, 6, skin)
  limb(0, 0, hipB, kneeB, U, L, 8, shorts, skin)
  ctx.strokeStyle = color; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(sx, sy); ctx.stroke()
  limb(0, 0, hipF, kneeF, U, L, 8, shorts, skin)
  limb(sx, sy, armF, elbF, A, F, 6.5, skin)
  ctx.fillStyle = skin; circle(ctx, sx + Math.sin(lean) * 14, sy - Math.cos(lean) * 14, 9); ctx.fill()
  ctx.restore()
}

// ── What the host draws over every game ─────────────────────────────────────
export function hud(ctx, view, g, title) {
  const h = g.hud ?? {}
  ctx.fillStyle = 'rgba(6,10,12,.78)'; ctx.fillRect(0, 0, view.w, 44)
  text(ctx, title, 12, 23, { font: DISPLAY, size: 19, align: 'left' })
  if (h.dots?.length) {
    const n = h.dots.length, gap = n > 6 ? 13 : 17
    for (let i = 0; i < n; i++) {
      const d = h.dots[i], x = view.w - 14 - (n - 1 - i) * gap
      ctx.fillStyle = d === true ? GOOD : d === false ? BAD : 'rgba(255,255,255,.2)'
      circle(ctx, x, 22, 5.5); ctx.fill()
    }
  }
  // the real score, when the game has one (a playoff moment, or a practice one like it)
  if (g.sit) {
    const n = h.dots?.length ?? 0
    const right = view.w - 12 - (n ? 14 + (n - 1) * (n > 6 ? 13 : 17) : 0)
    text(ctx, `${g.sit.us} ${g.sit.mine}  ${g.sit.them} ${g.sit.opp}`, right, 23, { font: DISPLAY, size: 19, align: 'right' })
  }
  if (h.prompt) {
    const y = view.h - (g.pads ? 96 : 0) - 30
    ctx.font = `18px ${LABEL}`
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px'
    const tw = ctx.measureText(h.prompt).width + 24
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
    ctx.fillStyle = 'rgba(6,10,12,.72)'; rr(ctx, view.w / 2 - tw / 2, y - 15, tw, 30, 4); ctx.fill()
    text(ctx, h.prompt, view.w / 2, y + 1, { size: 18, track: 1.5, color: h.hot ? GOLD : '#fff' })
  }
}
// On a computer: the key that presses it, in a small keycap
export function keyCap(ctx, x, y, label, dark = false) {
  const w = label.length > 1 ? 46 : 20, h = 16
  ctx.fillStyle = dark ? 'rgba(6,16,12,.16)' : 'rgba(8,12,16,.72)'
  rr(ctx, x - w / 2, y - h / 2, w, h, 3); ctx.fill()
  text(ctx, label, x, y + 0.5, { font: 'system-ui, sans-serif', size: label.length > 1 ? 9.5 : 12, weight: '700', color: dark ? '#06100c' : '#fff', track: label.length > 1 ? 0.6 : 0 })
}
export const LR_KEYS = ['←', '→'], THREE_KEYS = ['←', '↑', '→']
const keyOfPad = (g, i) => (g.pads.length === 1 ? (g.zones === 'three' ? THREE_KEYS[1] : 'SPACE') : g.zones === 'lr' ? LR_KEYS[i] : THREE_KEYS[i])
// The thumb pads: where a finger actually lands. The whole half of the screen counts.
export function pads(ctx, view, g) {
  if (!g.pads) return
  const n = g.pads.length, y = view.h - 88, h = 80, gap = 8, pw = (view.w - gap * (n + 1)) / n
  ctx.fillStyle = '#0a1013'; ctx.fillRect(0, y - 8, view.w, h + 16)
  g.pads.forEach((label, i) => {
    const x = gap + i * (pw + gap), lit = g.padLit === i
    ctx.fillStyle = lit ? view.accent : '#1c262b'
    rr(ctx, x, y, pw, h, 6); ctx.fill()
    text(ctx, label, x + pw / 2, y + h / 2 + (view.keys ? -9 : 1), { font: DISPLAY, size: 24, color: lit ? '#06100c' : '#fff' })
    if (view.keys) keyCap(ctx, x + pw / 2, y + h - 17, keyOfPad(g, i), lit)
  })
}
// A word landing on the play. It lands hard and stays: no fade-up.
export function stamp(ctx, view, g) {
  const s = g.stamp
  if (!s) return
  const age = g.t - s.at
  if (age < 0 || (s.ms && age > s.ms)) return
  const k = 1 + 0.5 * (1 - easeOut(clamp(age / 110, 0, 1)))
  ctx.save()
  ctx.translate(view.w / 2, s.y ?? view.h * 0.4); ctx.scale(k, k); ctx.rotate(-0.03)
  ctx.font = `${s.size ?? 46}px ${DISPLAY}`
  const tw = ctx.measureText(s.text).width + 26, th = (s.size ?? 46) + 16
  ctx.fillStyle = s.good ? GOOD : s.good === false ? BAD : '#fff'
  ctx.fillRect(-tw / 2, -th / 2, tw, th)
  text(ctx, s.text, 0, 2, { font: DISPLAY, size: s.size ?? 46, color: '#07100b' })
  ctx.restore()
}

// The real men in a Key Moment, from career's gameCast: view.cast / the make() arg. side: 'us' or 'them'; group: 'qb', 'wr', 'guard'...
// Null outside a career (practice): the scene keeps its own look. Spread it over a sprite's options:
//   athlete(ctx, view, x, y, { ...look, ...manOf(view.cast, 'them', 'wr', 0) })
export const manOf = (cast, side, group, i = 0) => {
  const list = cast?.[side]?.[group]
  if (!list?.length) return null
  const p = list[i % list.length]
  return { number: p.number, skin: p.skin, name: p.name }
}
// a man's real speed, a little: multiply a run speed by this. (Chase runs by Higgins, nobody runs off the screen.)
export const paceOf = (cast, side, group, i = 0) => {
  const list = cast?.[side]?.[group]
  return list?.length ? 1 + (list[i % list.length].speed ?? 0) * 0.06 : 1
}
