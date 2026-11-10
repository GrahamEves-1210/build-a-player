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
  ctx.fillStyle = color
  // (only when it's asked for: setting it is a parse, and text is drawn every frame)
  if (track && 'letterSpacing' in ctx) { ctx.letterSpacing = `${track}px`; ctx.fillText(str, x, y); ctx.letterSpacing = '0px' }
  else ctx.fillText(str, x, y)
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
export const dressDims = new Map()
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
// A field that's had a season on it: the middle between the hashes scuffed thin, more of it round midfield and in front of
// the goal line. Baked into the flat field, seeded, the same every game.
function paintWear(x, view, ez, pyd, SL, SR) {
  let seed = 23
  const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const cx = (SL + SR) / 2, half = (SR - SL) * 0.17
  const y0 = ez, y1 = ez + 100 * pyd
  x.save(); x.beginPath(); x.rect(SL, Math.max(y0, 0), SR - SL, Math.min(y1, view.h) - Math.max(y0, 0)); x.clip()
  const patch = (px, py, rx, ry, a) => { x.fillStyle = `rgba(116,92,58,${a.toFixed(3)})`; x.beginPath(); x.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); x.fill() }
  // the worn corridor, in scuffs. (Only what's on this picture of the field.)
  const n = Math.round(view.h / 3)
  for (let i = 0; i < n; i++) {
    const py = R() * view.h, off = (R() + R() - 1) * half * 1.5, a = 0.09 + R() * 0.11
    patch(cx + off, py, 2 + R() * 9, 0.8 + R() * 2.2, a)
  }
  // heavier where everyone plays: the 50 and the goal mouth
  for (const at of [ez + 50 * pyd, ez + 2 * pyd]) {
    if (at < -30 || at > view.h + 30) continue
    for (let i = 0; i < 26; i++) patch(cx + (R() + R() - 1) * half * (at === ez + 50 * pyd ? 1.3 : 0.8), at + (R() + R() - 1) * pyd * 3, 2 + R() * 7, 1 + R() * 2.5, 0.1 + R() * 0.12)
  }
  x.restore()
}
// What's over the sideline: the coaches' box (a yellow line between the 25s), the benches and the coolers behind it, both sides.
function paintSideline(x, view, f, ez, pyd, SL, SR) {
  const a = ez + 25 * pyd, b = ez + 75 * pyd
  for (const sd of [-1, 1]) {
    const edge = sd < 0 ? SL : SR, at = d => edge + sd * d
    x.fillStyle = 'rgba(247,214,74,.62)'
    const y0 = Math.max(a, -4), y1 = Math.min(b, view.h + 4)
    if (y1 <= y0) continue
    x.fillRect(Math.min(at(30), at(32)), y0, 2, y1 - y0)
    // benches: long dark bars in runs, a cooler at the end of each
    for (let y = a + 3 * pyd; y < b - 6 * pyd; y += 7 * pyd) {
      if (y < -8 * pyd || y > view.h + 8 * pyd) continue
      const bx = at(52), bw = 7
      x.fillStyle = '#0b1218'; x.fillRect(bx - bw / 2 - 1, y - 1, bw + 2, 5 * pyd + 2)
      x.fillStyle = sd < 0 ? (f.color ?? '#1d3a5f') : '#20303e'; x.fillRect(bx - bw / 2, y, bw, 5 * pyd)
      x.fillStyle = '#e8772e'; x.fillRect(bx - 3, y + 5.6 * pyd, 6, 0.8 * pyd)
    }
  }
}
// ez: where the far goal line is painted; pyd: units a yard along the field. A yard across it is about 6.8 units.
export function paintFieldDress(x, view, ez, pyd, SL, SR) {
  const f = view.field
  if (!f) return
  const H = pyd * 10, ACROSS = 6.8
  f.backY = null
  // (the pylons go on the corners. A flat field is kept from game to game: it's remembered here for the next one that reuses it)
  dressDims.set(`${f.word}|${stage.tag}`, { pyd, SL, SR })
  paintWear(x, view, ez, pyd, SL, SR)
  paintSideline(x, view, f, ez, pyd, SL, SR)
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
  // (view.empty: the combine and camp's empty house, painted apart from the full one)
  const id = `${key}|${view.h}|${view.px}|${stage.tag}|${view.field?.id ?? ''}|${view.empty ? 'E' : ''}`
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
  skin = warmSkin(skin)
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
  skin = warmSkin(skin)
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
// A real keyboard key: a light keycap face on its darker edge, with a shadow under it. Pressed (lit), it sits down
// into the edge. The arrows are drawn, not typed (a font's arrow is a different shape on every machine); SPACE is a
// spacebar; ARROWS is the arrow cluster, one key up top and three under it
const ARROW_DIR = { '←': [-1, 0], '→': [1, 0], '↑': [0, -1], '↓': [0, 1] }
function capAt(ctx, x, y, w, h, lit) {
  const edge = 2.5, down = lit ? 1.6 : 0, top = y - h / 2
  ctx.fillStyle = 'rgba(0,0,0,.42)'; rr(ctx, x - w / 2 - 0.5, top + 1.5, w + 1, h + edge, 3.5); ctx.fill()
  ctx.fillStyle = lit ? '#8f9aa1' : '#a9b2b8'; rr(ctx, x - w / 2, top + down, w, h + edge - down, 3.5); ctx.fill()
  const fy = top + down, gr = ctx.createLinearGradient(0, fy, 0, fy + h)
  gr.addColorStop(0, lit ? '#e4e9ec' : '#fbfcfc'); gr.addColorStop(1, lit ? '#cdd4d8' : '#e2e6e9')
  ctx.fillStyle = gr; rr(ctx, x - w / 2 + 0.8, fy, w - 1.6, h - 1, 3); ctx.fill()
  return fy + (h - 1) / 2
}
function arrowGlyph(ctx, x, y, [dx, dy], k) {
  ctx.fillStyle = '#1b2429'; ctx.beginPath()
  const px = -dy, py = dx
  ctx.moveTo(x + dx * k, y + dy * k)
  ctx.lineTo(x - dx * k * 0.7 + px * k * 0.85, y - dy * k * 0.7 + py * k * 0.85)
  ctx.lineTo(x - dx * k * 0.7 - px * k * 0.85, y - dy * k * 0.7 - py * k * 0.85)
  ctx.closePath(); ctx.fill()
}
export function keyCap(ctx, x, y, label, dark = false) {
  const lit = !!dark
  if (label === 'ARROWS') {
    // the arrow cluster: ↑ over ← ↓ →
    const k = 12, h = 10.5, g = 1.6
    for (const [cx, cy, d] of [[x, y - h / 2 - g / 2 - 1.2, '↑'], [x - k - g, y + h / 2 + g / 2 - 1.2, '←'], [x, y + h / 2 + g / 2 - 1.2, '↓'], [x + k + g, y + h / 2 + g / 2 - 1.2, '→']]) {
      const fy = capAt(ctx, cx, cy, k, h, lit)
      arrowGlyph(ctx, cx, fy, ARROW_DIR[d], 2.6)
    }
    return
  }
  const dir = ARROW_DIR[label]
  const w = label === 'SPACE' ? 64 : dir || label.length === 1 ? 20 : Math.max(30, label.length * 7 + 12), h = 17
  const fy = capAt(ctx, x, y, w, h, lit)
  if (dir) arrowGlyph(ctx, x, fy, dir, 4)
  else text(ctx, label, x, fy + 0.5, { font: 'system-ui, sans-serif', size: label.length > 1 ? 8.5 : 11, weight: '700', color: '#1b2429', track: label.length > 1 ? 0.5 : 0 })
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
    // (padCue: the pad the game's line on the screen calls for, outlined)
    if (g.padCue === i && !lit) { ctx.strokeStyle = view.accent; ctx.lineWidth = 2.5; rr(ctx, x + 1.25, y + 1.25, pw - 2.5, h - 2.5, 5); ctx.stroke() }
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

// ── Juice: small, cheap, cosmetic. None of it touches the rules or the game's rng ──
// (The crowd getting up on a big moment is crowdPop, in art.js.)
//
// particles: a fixed pool, so a game can't allocate or pile up. Nothing to tick: each piece's path comes from its
// age, so a burst costs nothing per frame unless it's in the air, and nothing at all once they've landed. Make it
// in make() and fire it from the rules or from draw:
//   g.dirt = particles(40)                                        (the cap: the oldest piece gets reused)
//   const p = tilt(view, x, y)
//   g.dirt.burst('turf', p.x, p.y, g.t, { n: 10, s: p.s, ang: -Math.PI / 2, spread: 1.1 })
//   g.dirt.draw(ctx, g.t)                                         (once a frame, where it belongs in depth)
// x, y are screen units. kinds: 'turf' clods off a cut or a hit, 'dust' a soft puff, 'confetti' (pass colors: [c.us, c.trim, '#fff']).
// Options: n, s (the size there: a tilt's p.s), ang (radians, -PI/2 is straight up), spread (radians either side),
// speed (multiplies the kind's own), colors, life (ms). Confetti from the top of the screen: burst at y 30, ang PI/2.
const P_KINDS = {
  turf: { life: 430, speed: 105, grav: 620, size: 1.5, grow: 0, alpha: 1, land: true, colors: ['#2d8a4c', '#1f6b3a', '#5c4326', '#7c5c36', '#bfd3a8'] },
  dust: { life: 520, speed: 34, grav: -14, size: 3, grow: 2.4, alpha: 0.42, land: false, colors: ['#c9b48e', '#a8947a', '#d8cdb6'] },
  confetti: { life: 1900, speed: 120, grav: 95, size: 2.1, grow: 0, alpha: 1, land: false, flutter: true, colors: ['#ffffff', '#e8c15a', '#c9423a'] },
}
const P_NAMES = Object.keys(P_KINDS)
export function particles(cap = 40, seed = 1) {
  const x = new Float32Array(cap), y = new Float32Array(cap), vx = new Float32Array(cap), vy = new Float32Array(cap)
  const born = new Float64Array(cap), life = new Float32Array(cap), size = new Float32Array(cap), kind = new Uint8Array(cap)
  const color = new Array(cap).fill('#fff')
  let next = 0, until = -Infinity, s = (seed * 2654435761 + 1) >>> 0
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 }
  return {
    burst(name, px, py, t, { n = 8, s: scale = 1, ang = -Math.PI / 2, spread = 1, speed = 1, colors = null, life: ms = null } = {}) {
      const k = P_KINDS[name]
      if (!k) return
      const kindId = P_NAMES.indexOf(name), pal = colors ?? k.colors
      for (let i = 0; i < n; i++) {
        const j = next; next = (next + 1) % cap
        const a = ang + (rnd() * 2 - 1) * spread, v = k.speed * speed * scale * (0.45 + rnd() * 0.75)
        x[j] = px + (rnd() - 0.5) * 5 * scale; y[j] = py + (rnd() - 0.5) * 2 * scale
        vx[j] = Math.cos(a) * v; vy[j] = Math.sin(a) * v
        born[j] = t; life[j] = (ms ?? k.life) * (0.65 + rnd() * 0.5)
        size[j] = k.size * scale * (0.7 + rnd() * 0.7); kind[j] = kindId
        color[j] = pal[Math.floor(rnd() * pal.length)]
        if (t + life[j] > until) until = t + life[j]
      }
    },
    // round: dots instead of squares (the flat, clean look: a square at that size reads as a stray pixel block)
    draw(ctx, t, round = false) {
      if (t > until || lightMode()) return
      let last = null, alpha = 1
      for (let j = 0; j < cap; j++) {
        const age = t - born[j]
        if (age < 0 || age >= life[j]) continue
        const k = P_KINDS[P_NAMES[kind[j]]], sec = age / 1000, f = age / life[j]
        const py = y[j] + vy[j] * sec + 0.5 * k.grav * sec * sec
        if (k.land && py > y[j] + 1 && sec > 0.04) continue   // (back down on the turf: gone)
        const px = x[j] + vx[j] * sec * (k.flutter ? 1 - f * 0.6 : 1)
        const sz = size[j] * (1 + k.grow * f), a = k.alpha * (f > 0.6 ? (1 - f) / 0.4 : 1)
        if (a !== alpha) { ctx.globalAlpha = a; alpha = a }
        if (color[j] !== last) { ctx.fillStyle = color[j]; last = color[j] }
        if (k.flutter) {
          // (a flat scrap turning over in the air: it narrows and comes back)
          const turn = Math.abs(Math.cos(age / 95 + j))
          ctx.fillRect(px + Math.sin(age / 210 + j) * 5 - sz * turn, py - sz * 0.6, Math.max(0.5, sz * 2 * turn), sz * 1.2)
        } else if (round) { ctx.beginPath(); ctx.ellipse(px, py, sz / 2, sz * (k.land ? 0.36 : 0.5), 0, 0, 6.2832); ctx.fill() }
        else ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz * (k.land ? 0.72 : 1))
      }
      if (alpha !== 1) ctx.globalAlpha = 1
    },
  }
}
// Reduce Motion: the in-app switch and the phone's own setting both end up on this class (lib/settings.js)
export const reduceMotion = () => typeof document !== 'undefined' && document.documentElement.classList.contains('bap-reduce-motion')
// the light version: Reduce Motion, or a weak machine (html.low-power). No particles and no crowd getting up
export const lightMode = () => typeof document !== 'undefined' && (document.documentElement.classList.contains('low-power') || document.documentElement.classList.contains('bap-reduce-motion'))
// nudge: the camera takes a hit, brief and small, then settles. The host does the rest: put it on the game and kick it.
//   g.nudge = nudge()                            in make()
//   g.nudge?.kick(g.t, 5, 0, 1)                  on the hit. power: logical units (3 a thump, 5 a big hit, 8 at most).
//                                                dirX, dirY: which way the picture goes. ms: how long (190)
// The host wraps the game's draw in it, so the HUD, the pads and the stamp hold still. Does nothing under Reduce Motion.
// A game that kicks from draw is fine too, it's only a number. Don't kick it every tick: a bigger kick replaces a smaller one, never adds.
export function nudge() {
  let at = -Infinity, power = 0, dx = 0, dy = 1, len = 190
  const now = t => { const f = (t - at) / len; return f >= 0 && f < 1 ? power * (1 - f) * (1 - f) * Math.cos(f * 11) : 0 }
  return {
    kick(t, p = 4, dirX = 0, dirY = 1, ms = 190) {
      if (Math.abs(now(t)) > p) return
      at = t; power = Math.min(8, p); len = ms
      const m = Math.hypot(dirX, dirY) || 1; dx = dirX / m; dy = dirY / m
    },
    apply(ctx, t, view) {
      const a = now(t)
      if (!a || reduceMotion()) return
      // (a touch of push-in as it moves, so the edge of the picture never shows)
      const z = 1 + (2 * Math.abs(a)) / view.w, cx = view.w / 2, cy = view.h / 2
      ctx.translate(cx + dx * a, cy + dy * a); ctx.scale(z, z); ctx.translate(-cx, -cy)
    },
  }
}

// The real men in a Key Moment, from career's gameCast: view.cast / the make() arg. side: 'us' or 'them'; group: 'qb', 'wr', 'guard'...
// Null outside a career (practice): the scene keeps its own look. Spread it over a sprite's options:
//   athlete(ctx, view, x, y, { ...look, ...manOf(view.cast, 'them', 'wr', 0) })
export const manOf = (cast, side, group, i = 0) => {
  const list = cast?.[side]?.[group]
  if (!list?.length) return null
  const p = list[i % list.length]
  return { number: p.number, skin: p.skin, name: p.name, ...(p.ball != null ? { ball: p.ball } : null), ...(p.yac != null ? { yac: p.yac } : null) }
}
// The football games' full eleven a side (career's gameCast: cast.us.xi / cast.them.xi), every man real and
// tagged with his last name. Null in the demo clips and the bots' runs: the scene keeps its own look.
// spot: 'qb' 'rb' 'wr' 'te' 'ol' (left tackle to right tackle) | 'edge' 'dt' 'lb' 'cb' 's' |
//   'dl' the front four, left end to right end | 'db' corner, corner, safety, safety, nickel, third safety |
//   'off' / 'def' the eleven on the field. Each man: { name, last, short, number, skin, look: { number, skin }, me? }
export const xiOf = (cast, side, spot, i = 0) => cast?.[side]?.xi?.[spot]?.[i] ?? null
// a man's real speed, a little: multiply a run speed by this. (Chase runs by Higgins, nobody runs off the screen.)
export const paceOf = (cast, side, group, i = 0) => {
  const list = cast?.[side]?.[group]
  return list?.length ? 1 + (list[i % list.length].speed ?? 0) * 0.06 : 1
}

// Skin reads as skin only with red in it: a tone gone gray (too little saturation for its lightness) or off the
// natural hue range is pulled back to a warm brown at the same lightness. Natural tones come through untouched.
const WARM = new Map()
export function warmSkin(hex) {
  if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return hex
  let w = WARM.get(hex)
  if (w) return w
  const n = parseInt(hex.slice(1, 7), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn
  let h = 0, s = 0
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  const sMin = l < 0.3 ? 0.4 : l < 0.6 ? 0.38 : 0.42
  const h2 = d === 0 ? 22 : Math.min(30, Math.max(14, h > 180 ? 14 : h)), s2 = Math.max(s, sMin)
  if (h2 === h && s2 === s) { WARM.set(hex, hex); return hex }
  const c = (1 - Math.abs(2 * l - 1)) * s2, x = c * (1 - Math.abs(((h2 / 60) % 2) - 1)), m = l - c / 2
  const [r1, g1, b1] = h2 < 60 ? [c, x, 0] : [x, c, 0]
  const to = v => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0')
  w = `#${to(r1)}${to(g1)}${to(b1)}`
  WARM.set(hex, w)
  return w
}
