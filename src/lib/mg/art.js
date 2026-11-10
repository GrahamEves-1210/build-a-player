// The look of the skill games: a broadcast camera on the field, and real little athletes.
//
//   tilt(view, x, y)           a point on the flat field (the logical top-down space a game plays in)
//                              → where the camera sees it, and how big things are there { x, y, s }
//   untilt(view, sx, sy)       a tap on the screen → the point on the field (so aiming stays true)
//   ground(ctx, view, paint, key, scroll)  the field, painted flat once, drawn through the camera
//   stands(ctx, view)          what's behind and beside the field
//   vignette(ctx, view)        the broadcast's falloff at the edges
//   athlete(ctx, view, x, y, { ... })   a player standing at a field point: sprite, shadow, in depth
//
// Sprites are painted once per look (team colours, number, facing, step) and stamped, so 22 players
// cost 22 drawImages a frame. Nothing here touches the rules: a game keeps its field coordinates.
import { circle, rr, text, stage, lerp, lightMode, dressDims, DISPLAY, LABEL, warmSkin } from './kit.js'

// ── The camera ──────────────────────────────────────────────────────────────
// k: how much smaller the far end of the field is than the near end. topFrac: where the far end sits.
// zoom: how wide the near end is. men: how big the players are for the field, the way Crash the Glass
// fills the screen with them. e: how far the camera looks down (a ball's nose goes by it). res: a sprite's sharpness.
const COURT = { id: 'court', k: 0.72, topFrac: 0.17, zoom: 1, men: 1, e: 0.62, res: 2.6 }
// Football, on the floor with the players. How low a game can go is what it has to read:
const READ = { id: 'read', k: 1.45, topFrac: 0.25, zoom: 1.2, men: 1.38, e: 0.36, res: 3.4 }  // a QB's: the whole coverage, to the end zone
const NEAR = { id: 'near', k: 2.1, topFrac: 0.29, zoom: 1.3, men: 1.5, e: 0.3, res: 4 }       // a few men and a few yards
const DOWN = { id: 'down', k: 2.6, topFrac: 0.33, zoom: 1.3, men: 1.6, e: 0.24, res: 5 }       // man to man: the man is the picture
const OPEN = { id: 'open', k: 1.5, topFrac: 0.05, zoom: 1.3, men: 1.5, e: 0.36, res: 4 }       // nothing but field, all the way up: he can see downfield
const OPENRUN = { id: 'openrun', k: 1.7, topFrac: 0.05, zoom: 1.3, men: 1.6, e: 0.3, res: 5 }   // the juke drills: field and nothing else, man to man
const GOAL = { id: 'goal', k: 2.1, topFrac: 0.29, zoom: 1.62, men: 1.2, e: 0.3, res: 4 }       // Fourth & Goal: in close on a short field
const LINE = { id: 'line', k: 2.1, topFrac: 0.29, zoom: 1.1, men: 1.25, e: 0.3, res: 5 }      // in the trenches (rush.js draws its men big itself)
// (eleven a side need room: the same cameras with smaller men, so the line reads and nobody stands on anybody)
const READ11 = { ...READ, id: 'read11', men: 1.04 }, NEAR11 = { ...NEAR, id: 'near11', men: 1.1 }
// Zone Drop: the backer and the short routes in front of him, a step closer than the safety's look down the field
const ZONE11 = { ...NEAR, id: 'zone11', zoom: 1.5, men: 1.12 }
const CAMS = {
  bomb: READ11, 'third-long': READ11, acc: READ, 'hot-read': READ11, audible: READ11, 'two-minute': READ11,
  gap: NEAR11, 'jump-route': NEAR11, 'zone-drop': ZONE11, sneak: NEAR11, 'goal-line': GOAL, catch: GOAL, release: NEAR, cone: NEAR, gauntlet: OPEN,
  'pass-rush': LINE, 'run-stuff': LINE,
  seal: DOWN, juke: OPENRUN, 'juke-wr': OPENRUN, 'juke-te': OPENRUN, 'tackle-angle': OPENRUN, escape: DOWN,
}
let CAM = COURT, far = 1 / (1 + CAM.k)
const CAM_U = [0, Math.sin(COURT.e), Math.cos(COURT.e)], CAM_V = [0, Math.cos(COURT.e), -Math.sin(COURT.e)]
// Every game plays under one camera, set as it's made (lib/mg/index.js), so its layout, its bot's aim and its picture agree.
export function useCamera(game) {
  const next = CAMS[game] ?? COURT
  if (next === CAM) return
  CAM = next; far = 1 / (1 + CAM.k); stage.tag = CAM === COURT ? '' : CAM.id
  CAM_U[1] = Math.sin(CAM.e); CAM_U[2] = Math.cos(CAM.e); CAM_V[1] = Math.cos(CAM.e); CAM_V[2] = -Math.sin(CAM.e)
  sprites.clear(); spriteBytes = 0; nearLook.clear(); bakeQ.length = 0; bakeIds.clear()
}
const horizon = view => view.h * CAM.topFrac
export function tilt(view, x, y) {
  const t = y / view.h
  const s0 = 1 / (1 + CAM.k * (1 - t)), g = s0 * CAM.zoom
  const hy = horizon(view)
  // g: the field's scale here. s: a man's, and everything that goes with him (his hands, his shadow, his tag)
  return { x: view.w / 2 + (x - view.w / 2) * g, y: hy + (view.h - hy) * ((s0 - far) / (1 - far)), s: g * CAM.men, g }
}
export function untilt(view, sx, sy) {
  const hy = horizon(view)
  const s0 = Math.max(far, far + ((sy - hy) / (view.h - hy)) * (1 - far))
  const t = 1 - (1 / s0 - 1) / CAM.k
  return { x: view.w / 2 + (sx - view.w / 2) / (s0 * CAM.zoom), y: t * view.h }
}

// ── The field through the camera ────────────────────────────────────────────
// paint(x, view): draws the flat field, once. scroll: logical units the field has moved down.
const flats = new Map()
function flatOf(view, key, paint) {
  const id = `${key}|${view.h}|${view.px}|${view.field?.id ?? ''}`
  let c = flats.get(id)
  if (!c && typeof document !== 'undefined') {
    if (flats.size > 16) flats.clear()
    c = document.createElement('canvas')
    c.width = Math.round(view.w * 1.5 * view.px); c.height = Math.round(view.h * view.px)
    const x = c.getContext('2d', { alpha: false })
    x.scale(view.px, view.px)
    x.translate(view.w * 0.25, 0)   // (room past the sidelines: the far end shows it)
    paint(x, view)
    c.backY = view.field?.backY ?? null
    flats.set(id, c)
  }
  return c
}
const STRIPS = () => (CAM === COURT ? 72 : 110)
// strips: a camera that doesn't move can bake the ground once, in as many as it likes
// wall: a field with no edges, stretched so its far end still reaches both sides of the screen
export function ground(ctx, view, paint, key, scroll = 0, strips = STRIPS(), wall = false) {
  const c = flatOf(view, key, paint)
  if (!c) return
  if (view.field) view.field.backY = c.backY
  const hy = horizon(view), H = view.h, pxW = c.width / 1.5 / view.w, srcH = c.height
  ctx.imageSmoothingQuality = strips < 100 ? 'low' : 'high'   // (a field going by at speed: nobody sees the difference, and slow machines do)
  for (let i = 0; i < strips; i++) {
    // equal bands on screen; each pulls the band of the flat field the camera sees there
    const a = hy + ((H - hy) * i) / strips, b = hy + ((H - hy) * (i + 1)) / strips + 0.6
    const fa = untilt(view, view.w / 2, a), fb = untilt(view, view.w / 2, b)
    const s = (tilt(view, view.w / 2, fa.y).g + tilt(view, view.w / 2, fb.y).g) / 2
    const dw = wall ? Math.max(view.w * 1.5 * s, view.w + 2) : view.w * 1.5 * s, dx = view.w / 2 - dw / 2
    let sy = ((fa.y - scroll) % H + H) % H, sh = Math.max(0.5, fb.y - fa.y)
    if (sy + sh > H) sh = H - sy
    ctx.drawImage(c, 0, (sy / H) * srcH, c.width, (sh / H) * srcH, dx, a, dw, b - a)
  }
  void pxW
}

// The goalposts on the back line of the end zone, through the camera. For a baked picture, so they cost nothing per frame.
export function goalPosts(ctx, view, y, big = 1) {
  if (y == null || y < 0) return
  const q = tilt(view, 180, y), ft = big * (view.w - 16) * q.g / 160, base = q.y - 1, bar = base - 10 * ft * 1.25, half = 9.25 * ft, top = bar - 20 * ft * 1.25
  const neck = base - (bar - base) * -0.45, lean = 3.5 * ft
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // the pylons, on the four corners of the end zone
  const f = view.field && dressDims.get(`${view.field.word}|${stage.tag}`)
  if (f) for (const py of [y, y + 10 * f.pyd]) for (const px of [f.SL, f.SR]) {
    const p = tilt(view, px, py), pw = Math.max(1.6, (view.w - 16) * p.g / 160 * big * 0.75), ph = pw * 3.1
    ctx.fillStyle = '#ff6a13'; ctx.fillRect(p.x - pw / 2, p.y - ph, pw, ph)
    ctx.fillStyle = '#c64a06'; ctx.fillRect(p.x, p.y - ph, pw / 2, ph)
    ctx.fillStyle = '#fff'; ctx.fillRect(p.x - pw / 2, p.y - ph * 0.62, pw, Math.max(0.6, ph * 0.1))
  }
  // the pad round its foot
  ctx.fillStyle = '#20262c'; ctx.fillRect(q.x - 1.6 * ft, neck, 3.2 * ft, base - neck)
  // the post, curving forward to the middle of the bar, then the bar and the two uprights
  ctx.strokeStyle = '#f2d21f'; ctx.lineWidth = Math.max(1.6, 0.9 * ft)
  ctx.beginPath(); ctx.moveTo(q.x, base); ctx.lineTo(q.x, neck); ctx.quadraticCurveTo(q.x, bar + lean, q.x, bar); ctx.stroke()
  ctx.lineWidth = Math.max(1.3, 0.7 * ft)
  ctx.beginPath(); ctx.moveTo(q.x - half, top); ctx.lineTo(q.x - half, bar); ctx.lineTo(q.x + half, bar); ctx.lineTo(q.x + half, top); ctx.stroke()
  ctx.restore()
}
// A moving field is drawn in strips, so its edges come out as stairs. This lays clean ones over it: the sideline
// a straight white line, the apron past it one flat colour. A few filled shapes, nothing for a slow machine to notice.
export function cleanEdges(ctx, view, SL, SR, apron = '#123f23') {
  const a = tilt(view, SL, 0), b = tilt(view, SL, view.h), c = tilt(view, SR, 0), d = tilt(view, SR, view.h)
  ctx.fillStyle = apron
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(-40, b.y); ctx.lineTo(-40, a.y); ctx.closePath()
  ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.lineTo(view.w + 40, d.y); ctx.lineTo(view.w + 40, c.y); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = '#f5f7f3'; ctx.lineCap = 'butt'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke()
}

// ── Behind the field ────────────────────────────────────────────────────────
const backs = new Map()
// An empty house (the combine, training camp): the same rows, nobody in them. Seat backs in the stadium's colours,
// sections of them in the home colour, a step darker than people would be.
export const SEATS = ['#161c23', '#1a2129', '#1e252e', '#20282f']
export function crowdRows(x, x0, x1, y0, y1, rows, base, team, rnd, dim = 1, empty = false) {
  const pal = ['#1b222b', '#262e38', '#313a45', '#3f4954', '#55606b', '#6d6459', '#8a8f96', '#b9bcc0']
  const n = Math.round(rows * 1.9)
  for (let r = 0; r < n; r++) {
    const f = r / Math.max(1, n - 1)
    const y = y0 + (y1 - y0) * f, size = (base + f * base * 0.8) * 0.58, gap = size * 1.22
    for (let px = x0 + rnd() * gap; px < x1; px += gap) {
      // whole sections of them in the home colours
      const home = Math.sin(px * 0.045 + r * 0.14) > 0.45 && rnd() < 0.72
      const tint = home ? team[rnd() < 0.8 ? 0 : 1] : pal[Math.floor(rnd() * pal.length)]
      if (empty) { x.globalAlpha = home ? 0.32 : 1; x.fillStyle = home ? tint : SEATS[r % SEATS.length]; x.fillRect(px, y + size * 0.45, size * 0.92, size * 0.8); x.globalAlpha = 1; continue }
      x.fillStyle = tint
      x.fillRect(px, y, size, size * 1.25)
    }
  }
  if (dim < 1) { x.fillStyle = `rgba(4,8,14,${1 - dim})`; x.fillRect(x0, y0 - 2, x1 - x0, y1 - y0 + base * 3) }
}
function paintStands(x, view, tone, team) {
  const { w, h } = view, hy = h * CAM.topFrac, E = !!view.empty
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  // the night over the bowl
  const sky = x.createLinearGradient(0, 0, 0, hy)
  sky.addColorStop(0, '#04070c'); sky.addColorStop(1, '#141c26')
  x.fillStyle = sky; x.fillRect(0, 0, w, h)
  const lo = hy * 0.34, mid = hy * 0.62
  // the upper deck, the ribbon board, the lower bowl
  crowdRows(x, 0, w, lo, mid - 5, 6, 1.5, team, rnd, 0.72, E)
  x.fillStyle = '#05080c'; x.fillRect(0, mid - 4, w, 8)
  for (let i = 0; i < 9; i++) { x.fillStyle = i % 2 ? team[0] : '#0d1a24'; x.fillRect(i * (w / 9), mid - 2.5, w / 9 - 1, 5) }
  crowdRows(x, 0, w, mid + 5, hy - 13, 7, 2, team, rnd, 0.95, E)
  // the crowd down each side, past the benches
  crowdRows(x, -2, w * 0.2, hy, h * 0.72, 44, 2.6, team, rnd, 0.62, E)
  crowdRows(x, w * 0.8, w + 2, hy, h * 0.72, 44, 2.6, team, rnd, 0.62, E)
  // the wall at the far end, with its boards
  x.fillStyle = '#0a1016'; x.fillRect(0, hy - 12, w, 12)
  for (let i = 0; i < 5; i++) {
    x.fillStyle = i % 2 ? team[0] : '#f1f3f4'
    x.fillRect(i * (w / 5) + 1, hy - 10.5, w / 5 - 2, 9)
    text(x, 'BUILD-A-PLAYER', i * (w / 5) + w / 10, hy - 5.8, { font: DISPLAY, size: 6.6, track: 0.6, color: i % 2 ? '#fff' : '#10161c' })
  }
  // the lights, and what they do to the haze
  for (let i = 0; i < 5; i++) {
    const lx = w * (0.1 + i * 0.2), ly = hy * 0.4
    // (an empty house runs half the lights: every other bank dark)
    if (E && i % 2) { x.fillStyle = '#2a323b'; x.fillRect(lx - 11, ly - 1.4, 22, 2.8); continue }
    const g = x.createRadialGradient(lx, ly, 1, lx, ly, 62)
    g.addColorStop(0, 'rgba(235,245,255,.42)'); g.addColorStop(0.2, 'rgba(210,228,255,.13)'); g.addColorStop(1, 'rgba(200,220,255,0)')
    x.fillStyle = g; x.fillRect(lx - 62, ly - 62, 124, 124)
    x.fillStyle = '#f3f8ff'; x.fillRect(lx - 11, ly - 1.4, 22, 2.8)
  }
}
// The football stage: the wall of people Crash the Glass plays in front of, the same rows, the home
// colours in sections and the lights over them, with the boards at the foot of it, carried down each side
// of the field where this camera sees the side stands. The field goes over it.
const lumOf = hex => { const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16); return Number.isFinite(n) ? (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255 : 0.5 }
// a colour you can read on another: the one asked for if it shows, else white or black
export const inkOn = (bg, want) => (Math.abs(lumOf(bg) - lumOf(want)) > 0.2 ? want : lumOf(bg) > 0.55 ? '#10151a' : '#fff')
// the same for a stadium board, which sits under a 28% shade: ink a little darker than the shaded board is dark on dark
export const boardInk = (bg, want) => { const s = lumOf(bg) * 0.72, w = lumOf(want); return w < s && s - w < 0.35 ? '#fff' : inkOn(bg, want) }
// A stadium, not a wall of dots: the bowl's aisles and decks, the ribbon board between them, the shade under the
// overhang, the light banks, the video board over the far end. A big game gets gold on the boards and the bulbs going off. Baked once.
function bowlDress(x, view, foot, top, us, trim) {
  const { w } = view, U = view.h / 640, f = view.field, big = !!f?.superBowl
  const rib = top + (foot - top) * 0.46, gold = '#e8c15a', ledBg = big ? '#0b1f3a' : '#060a0e'
  // the upper deck sits back in the shade, and the overhang throws more on the rows just under it
  x.fillStyle = 'rgba(3,6,10,.3)'; x.fillRect(0, top, w, rib - top)
  const under = x.createLinearGradient(0, rib, 0, rib + 14 * U)
  under.addColorStop(0, 'rgba(3,6,10,.62)'); under.addColorStop(1, 'rgba(3,6,10,0)')
  x.fillStyle = under; x.fillRect(0, rib, w, 14 * U)
  // the aisles, running up each deck toward the far rim: they cut the rows into sections
  const aisle = (y0, y1, n, off) => {
    x.fillStyle = 'rgba(4,7,11,.5)'
    x.beginPath()
    for (let i = 0; i <= n; i++) {
      const fx = w * ((i + off) / n), lean = (fx - w / 2) * 0.16, wide = 2.6 * U
      x.moveTo(fx - wide / 2, y1); x.lineTo(fx + wide / 2, y1); x.lineTo(fx - lean + wide * 0.36, y0); x.lineTo(fx - lean - wide * 0.36, y0); x.closePath()
    }
    x.fill()
  }
  aisle(rib + 5 * U, foot, 6, 0.5)
  aisle(top + 2 * U, rib - 4 * U, 8, 0)
  // the ribbon board: the home name running round the bowl
  const rh = 8 * U, led = big ? gold : us, ink = big ? '#0b1f3a' : boardInk(us, trim)
  x.fillStyle = '#04070b'; x.fillRect(0, rib - rh / 2 - 1.2 * U, w, rh + 2.4 * U)
  x.fillStyle = ledBg; x.fillRect(0, rib - rh / 2, w, rh)
  const word = big ? 'SUPER BOWL' : f?.word ?? 'BUILD-A-PLAYER', segs = 4
  for (let i = 0; i < segs; i++) {
    const a = (i * w) / segs, b = w / segs
    x.fillStyle = led; x.globalAlpha = big ? 1 : 0.9; x.fillRect(a + 1, rib - rh / 2 + 0.8 * U, b - 2, rh - 1.6 * U); x.globalAlpha = 1
    text(x, word, a + b / 2, rib + 0.3 * U, { font: DISPLAY, size: 5.8 * U, track: 0.7, color: ink })
  }
  // the light banks along the rim of the upper deck
  for (const c of [0.1, 0.3, 0.7, 0.9]) {
    const bw = 36 * U, bx = w * c - bw / 2, by = top - 5 * U
    x.fillStyle = '#080c11'; x.fillRect(bx - 1.5, by - 1.5, bw + 3, 7 * U + 3)
    // (an empty house runs half the banks: the outside two stay dark)
    x.fillStyle = view.empty && (c === 0.1 || c === 0.9) ? '#262d35' : '#eef4fb'
    for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) x.fillRect(bx + 1 + i * (bw / 9), by + 0.5 + j * 3.4 * U, bw / 9 - 2, 2.2 * U)
  }
  // the video board over the far end, on its two legs
  const room = rib - rh / 2 - 3 * U - Math.max(46, top - 8 * U)
  if (room > 16 * U) {
    const bh = Math.min(room, 30 * U), bw = bh * 3.5, bx = w / 2 - bw / 2, by = rib - rh / 2 - 3 * U - bh
    x.fillStyle = '#06090d'; x.fillRect(bx + bw * 0.14, by + bh, 3 * U, 4 * U); x.fillRect(bx + bw * 0.86 - 3 * U, by + bh, 3 * U, 4 * U)
    x.fillStyle = '#0a0e13'; x.fillRect(bx - 2 * U, by - 2 * U, bw + 4 * U, bh + 4 * U)
    x.fillStyle = big ? '#0b1f3a' : '#10161d'; x.fillRect(bx, by, bw, bh)
    // a band of the home colour along the top and the foot, the name big in between
    const band = bh * 0.14
    x.fillStyle = big ? gold : us; x.fillRect(bx, by, bw, band); x.fillRect(bx, by + bh - band, bw, band)
    const line = big ? `SUPER BOWL ${f.superBowl}` : word
    x.save(); x.font = `${bh * 0.5}px ${DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'
    const tw = x.measureText(line).width, fit = Math.min(1, (bw * 0.86) / tw)
    x.translate(w / 2, by + bh / 2 + 0.5); x.scale(fit, 1)
    x.fillStyle = big ? gold : boardInk('#10161d', trim === '#f4efe6' ? '#ffffff' : trim); x.fillText(line, 0, 0)
    x.restore()
  }
  // a big game: bulbs going off all over the building, caught mid-flash
  if (big && !view.empty) {
    let seed = 91
    const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    x.fillStyle = '#fffdf0'
    for (let i = 0; i < 46; i++) { const d = (0.8 + R() * 0.8) * U; x.fillRect(R() * w, top + R() * (foot - top), d, d) }
  }
}
// close: the people as they look up close, bigger, with heads (Fourth & Goal)
function paintFieldBowl(x, view, team, close = false) {
  const { w, h } = view, hy = horizon(view), U = h / 640, us = team[0]
  const mix = (a, b, f) => a + (b - a) * f
  const bg = x.createLinearGradient(0, 0, 0, hy)
  bg.addColorStop(0, '#05080c'); bg.addColorStop(0.5, '#0b1219'); bg.addColorStop(1, '#141c26')
  x.fillStyle = bg; x.fillRect(0, 0, w, h)
  let seed = 7
  const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const pal = ['#2b323b', '#37404a', '#232931', '#434d57', '#4d4a45', us, '#5b3029', '#26394a', '#6a6860']
  // where the field's edge is on this row (the side stands are only seen outside it)
  const edge = y => w / 2 - w * 0.75 * CAM.zoom * (far + ((y - hy) / (h - hy)) * (1 - far))
  let y = 50 * U, row = 0
  while (y < h) {
    const low = y > hy, ex = low ? edge(y) : w
    if (ex < -8) break
    const f = y / hy, hs = (close ? (low ? mix(4.4, 6.5, (y - hy) / (h * 0.3)) : mix(2.2, 4.4, f)) : (low ? mix(2.3, 3.4, (y - hy) / (h * 0.3)) : mix(1.2, 2.4, f))) * U, gap = hs * (close ? 2.5 : 2.3)
    for (let px = -gap + (row % 2) * gap * 0.5; px < w + gap; px += gap) {
      const jit = R()
      if (jit < (close ? 0.05 : 0.11) || (low && px > ex && px < w - ex)) continue
      const home = Math.sin(px * 0.045 + row * 0.25) > 0.45 && R() < 0.72
      x.fillStyle = home ? us : pal[Math.floor(R() * pal.length)]
      x.globalAlpha = low ? 0.55 : mix(0.36, 0.72, f)
      // (an empty house: a seat back where each person would be, in the seats' own colours, sections in the home colour)
      if (view.empty) { if (!home) x.fillStyle = SEATS[row % SEATS.length]; x.globalAlpha = home ? x.globalAlpha * 0.4 : Math.min(1, x.globalAlpha * 1.3); x.fillRect(px - hs * 0.8, y + hs * (close ? 0.9 : 0.5), hs * 1.6, hs * (close ? 1.1 : 1)); continue }
      if (close) {
        x.fillRect(px - hs * 0.9, y + hs * 0.2, hs * 1.8, hs * 1.8)
        x.fillStyle = R() < 0.5 ? '#6e5340' : '#463326'
        x.beginPath(); x.arc(px + (jit - 0.5) * hs * 0.6, y - hs * 0.15, hs * 0.62, 0, 6.3); x.fill()
      } else x.fillRect(px - hs * 0.85 + (jit - 0.5) * hs * 0.7, y + (R() - 0.5) * hs * 0.5, hs * 1.7, hs * 2.1)
    }
    x.globalAlpha = 1
    y += hs * (close ? 2.7 : 2.5); row++
  }
  // the lights over it all
  const b = x.createLinearGradient(0, 44, 0, hy)
  b.addColorStop(0, 'rgba(255,246,228,.09)'); b.addColorStop(1, 'rgba(255,246,228,0)')
  x.fillStyle = b
  for (const c of view.empty ? [180] : [62, 180, 298]) { x.beginPath(); x.moveTo(c - 11, 44); x.lineTo(c + 11, 44); x.lineTo(c + 70, hy); x.lineTo(c - 70, hy); x.fill() }
  if (!close) bowlDress(x, view, hy - 19 * U, 50 * U, us, team[1])
  // the boards down each side, then across the far end
  const bh = 19 * U, ink = boardInk(us, team[1])
  for (const sd of [-1, 1]) {
    const y1 = hy + (h - hy) * Math.min(1, ((1 / (1.5 * CAM.zoom) - far) / (1 - far)) + 0.05)
    const at = yy => (sd < 0 ? edge(yy) : w - edge(yy))
    const wallH = yy => bh * (1 + 2.4 * ((yy - hy) / (h - hy)))
    x.beginPath(); x.moveTo(at(hy), hy); x.lineTo(at(y1), y1); x.lineTo(at(y1), y1 - wallH(y1)); x.lineTo(at(hy), hy - bh); x.closePath()
    x.fillStyle = '#0a0e12'; x.fill()
    x.fillStyle = us; x.fill()
    x.fillStyle = 'rgba(0,0,0,.34)'; x.fill()
    x.strokeStyle = '#0a0e12'; x.lineWidth = 1.6; x.stroke()
    // the name, over and over along it, a word's length getting longer as the wall comes toward us
    x.save(); x.font = `${11 * U}px ${DISPLAY}`; x.textAlign = 'left'; x.textBaseline = 'middle'
    const tw = x.measureText('BUILD-A-PLAYER').width
    x.fillStyle = ink
    for (let yy = hy + 2; yy < y1 - 4;) {
      const y2 = Math.min(y1, yy + wallH(yy) * 2.7), lo = sd < 0 ? y2 : yy, hi = sd < 0 ? yy : y2
      // (read left to right on the screen: from the near end on the left wall, from the far end on the right)
      const ax = at(lo), bx = at(hi), mid = wallH((yy + y2) / 2)
      x.save()
      x.transform((bx - ax) / tw, (hi - lo) / tw, 0, mid / bh, ax, lo - mid / 2)
      x.fillText('BUILD-A-PLAYER', tw * 0.06, 0)
      x.restore()
      yy = y2 + wallH(y2) * 0.35
    }
    x.restore()
  }
  // the far end, corner to corner
  const c0 = edge(hy), c1 = w - c0
  x.fillStyle = '#0a0e12'; x.fillRect(c0, hy - bh, c1 - c0, bh)
  x.fillStyle = us; x.fillRect(c0, hy - bh + 2 * U, c1 - c0, bh - 4 * U)
  x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(c0, hy - bh + 2 * U, c1 - c0, bh - 4 * U)
  const n = Math.max(1, Math.floor((c1 - c0) / (98 * U)))
  for (let i = 0; i < n; i++) text(x, 'BUILD-A-PLAYER', c0 + ((c1 - c0) * (i + 0.5)) / n, hy - bh / 2 + 0.5, { font: DISPLAY, size: 11 * U, color: ink, track: 1 })
}
export function stands(ctx, view, tone = 'field', team = ['#39424c', '#aab0b6']) {
  const id = `${tone}|${team.join()}|${view.h}|${view.px}|${CAM.id}|${view.field?.word ?? ''}|${view.field?.superBowl ?? ''}|${view.empty ? 'E' : ''}`
  let c = backs.get(id)
  if (!c && typeof document !== 'undefined') {
    if (backs.size > 8) backs.clear()
    c = document.createElement('canvas'); c.width = Math.round(view.w * view.px); c.height = Math.round(view.h * view.px)
    const x = c.getContext('2d', { alpha: false }); x.scale(view.px, view.px); if (CAM === COURT) paintStands(x, view, tone, team); else paintFieldBowl(x, view, team, tone === 'field-close')
    backs.set(id, c)
  }
  if (c) ctx.drawImage(c, 0, 0, view.w, view.h)
}
// The crowd getting up on a big moment: a touchdown, a sack, a pick. Not marks on top of the stands: the rows that are
// already there come up a little and catch the light, in their own colours, a raised arm here and there in the home
// colour, whole sections at a time. Two baked frames (arms up, arms coming down), one drawImage a frame while it lasts
// and nothing at all otherwise. Call it every frame, right after the stage and before the men:
//   crowdPop(ctx, view, [c.us, c.trim], g.t - (g.popAt ?? -1e9))      and set g.popAt = g.t on the moment
// The first call paints the frames whatever the age, so call it from the first frame and the moment itself costs nothing.
// Options: ms (1500), power (0-1, how much of it shows), foot, top (logical y of the rows to fill: default the football bowl.
// In an arena pass foot: G.wallY - 22 * view.h / 640). Reduce Motion or a weak machine (lightMode): nothing.
const pops = new Map()
function popFrames(view, team, top, foot) {
  const id = `${team.join()}|${view.h}|${view.px}|${Math.round(top)}|${Math.round(foot)}|${CAM.id}`
  let f = pops.get(id)
  if (f || typeof document === 'undefined') return f
  if (pops.size > 4) pops.clear()
  const { w, h } = view, U = h / 640, hy = horizon(view), res = Math.min(2, view.px), bottom = CAM === COURT ? foot : Math.min(h * 0.62, hy + (h - hy) * 0.38)
  const edge = y => w / 2 - w * 0.75 * CAM.zoom * (far + ((y - hy) / (h - hy)) * (1 - far))
  // the bowl's own people: the same muted shirts the seated rows are painted in, and the home colour
  const us = team[0], pal = ['#2b323b', '#37404a', '#434d57', '#4d4a45', '#26394a', '#5b5850', us, us]
  f = { frames: [], h: bottom }
  // whole sections go up together, others stay in their seats
  const sect = (px, row) => Math.sin(px * 0.031 + row * 0.13) + Math.sin(px * 0.09 + 1.7) * 0.5 > 0.25
  // (the football bowl's ribbon and video board aren't people: nobody stands up in front of them)
  const bowl = CAM !== COURT, rib = top + (foot + 2 * U - top) * 0.46
  const onBoard = (px, y, hs) => bowl && ((y > rib - 7 * U && y < rib + 9 * U + hs * 1.5) || (y < rib && Math.abs(px - w / 2) < 60 * U))
  for (let n = 0; n < 2; n++) {
    const c = document.createElement('canvas'); c.width = Math.round(w * res); c.height = Math.round(bottom * res)
    const x = c.getContext('2d'); x.scale(res, res)
    let seed = 41
    const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    // the light catching a section on its feet: a faint warm lift over its rows, nothing you'd see as a shape
    const wash = (x0, y0, ww, hh) => { x.fillStyle = 'rgba(255,238,210,.07)'; x.fillRect(x0, y0, ww, hh) }
    // one person up: the shirt a touch higher than the seat, a head, and maybe an arm (rarely two) in the home colour.
    // (the seats are the same both frames: only whose arm is up changes)
    const man = (px, py, hs, low) => {
      const a = R(), b = R(), up = py - hs * (low ? 0.5 : 0.4)
      x.globalAlpha = low ? 0.6 : 0.55
      x.fillStyle = pal[Math.floor(b * pal.length)]
      x.fillRect(px - hs * 0.85, up, hs * 1.7, hs * 2)
      x.fillStyle = a < 0.5 ? '#5e4636' : '#3e2d22'
      x.fillRect(px - hs * 0.5, up - hs * 0.95, hs, hs)
      const raised = (a * 7) % 1, wave = n === (b < 0.5 ? 0 : 1)
      if (raised < 0.5) {
        x.fillStyle = raised < 0.36 ? us : pal[Math.floor(a * 5)]
        const arm = wave ? hs * 1.3 : hs * 0.75, side = raised < 0.21 ? -1 : 1
        x.fillRect(px + side * hs * 0.65 - hs * 0.2, up - arm, hs * 0.4, arm)
        if (raised < 0.07) x.fillRect(px - side * hs * 0.65 - hs * 0.2, up - arm, hs * 0.4, arm)
      }
      x.globalAlpha = 1
    }
    // (the people the size of the rows under them: an arena's bowl is close and big, the football bowl's far off)
    const court = CAM === COURT
    let y = top + 3 * U, row = 0
    while (y < foot) {
      const hs = (court ? lerp(2.4, 5, y / Math.max(1, foot)) * 0.92 : lerp(1.2, 2.3, (y - top) / Math.max(1, foot - top))) * U, gap = hs * (court ? 2.5 : 2.6)
      let runAt = null
      for (let px = (row % 2) * gap * 0.5; px < w + gap; px += gap) {
        const on = sect(px, row) && !onBoard(px, y, hs)
        if (on && runAt == null) runAt = px
        if (!on && runAt != null) { wash(runAt - gap / 2, y - hs * 1.4, px - runAt, hs * 3.2); runAt = null }
        if (on && R() < 0.62) man(px, y, hs, false)
      }
      if (runAt != null) wash(runAt - gap / 2, y - hs * 1.4, w - runAt + gap, hs * 3.2)
      y += hs * (court ? 2.7 : 2.6); row++
    }
    // down each side, where this camera sees the side stands, outside the boards
    if (CAM !== COURT) {
      y = hy + 6 * U; row = 0
      while (y < bottom) {
        const hs = lerp(2.3, 3.3, (y - hy) / (bottom - hy)) * U, gap = hs * 2.6, room = edge(y) - 4 * U - 19 * U * (1 + 2.4 * ((y - hy) / (h - hy))) * 0.2
        for (let px = (row % 2) * gap * 0.5; px < room; px += gap) {
          if (sect(px, row) && R() < 0.62) man(px, y, hs, true)
          if (sect(w - px, row) && R() < 0.62) man(w - px, y, hs, true)
        }
        y += hs * 2.6; row++
      }
    }
    f.frames.push(c)
  }
  pops.set(id, f)
  return f
}
export function crowdPop(ctx, view, team, age, { ms = 1500, power = 1, top = null, foot = null } = {}) {
  if (lightMode() || view.empty) return   // (the light version: they stay in their seats, and nothing's painted for it. An empty house: nobody to get up)
  const U = view.h / 640
  const f = popFrames(view, team, top ?? 50 * U, foot ?? (horizon(view) - 21 * U))
  if (!f || !(age >= 0) || age >= ms) return
  // up over a quarter of a second, held, back down over half a second
  const rise = age < 260 ? age / 260 : age > ms - 500 ? (ms - age) / 500 : 1
  ctx.globalAlpha = rise * Math.min(1, power)
  ctx.drawImage(f.frames[Math.floor(age / 240) % 2], 0, 0, view.w, f.h)
  ctx.globalAlpha = 1
}
// what the lights do to the field: haze at the far end, a pool of light on the middle, the near end falling off
const lightPics = new Map()
export function floodlight(x, view) {
  const { w, h } = view, hy = h * CAM.topFrac
  if (CAM !== COURT) {
    // as on the hardwood: the far end falls off into the crowd's shadow, the lights land on the near grass
    // (one picture, painted once: a field going by lays this over itself every frame)
    const id = `${h}|${CAM.id}`
    let c = lightPics.get(id)
    if (!c && typeof document !== 'undefined') {
      if (lightPics.size > 6) lightPics.clear()
      c = document.createElement('canvas'); c.width = w; c.height = h
      const l = c.getContext('2d')
      const fall = l.createLinearGradient(0, hy, 0, hy + (h - hy) * 0.5)
      fall.addColorStop(0, 'rgba(4,10,6,.34)'); fall.addColorStop(1, 'rgba(4,10,6,0)')
      l.fillStyle = fall; l.fillRect(0, hy, w, (h - hy) * 0.5)
      l.fillStyle = 'rgba(0,0,0,.3)'; l.fillRect(0, hy, w, 2)
      // the banks' light landing on the grass: a pool down the middle of the field, falling off toward each sideline
      const my = hy + (h - hy) * 0.58, r = (h - hy) * 0.62
      l.save(); l.translate(w / 2, my); l.scale(1, 0.72)
      const pool = l.createRadialGradient(0, 0, r * 0.12, 0, 0, r)
      pool.addColorStop(0, 'rgba(255,252,235,.075)'); pool.addColorStop(1, 'rgba(255,252,235,0)')
      l.fillStyle = pool; l.fillRect(-r, -r, r * 2, r * 2)
      l.restore()
      lightPics.set(id, c)
    }
    if (c) x.drawImage(c, 0, 0, w, h)
    return
  }
  const haze = x.createLinearGradient(0, hy, 0, hy + (h - hy) * 0.3)
  haze.addColorStop(0, 'rgba(190,215,240,.09)'); haze.addColorStop(1, 'rgba(190,215,240,0)')
  x.fillStyle = haze; x.fillRect(0, hy, w, (h - hy) * 0.3)
  const pool = x.createRadialGradient(w / 2, h * 0.52, h * 0.05, w / 2, h * 0.52, h * 0.5)
  pool.addColorStop(0, 'rgba(255,255,235,.1)'); pool.addColorStop(1, 'rgba(255,255,235,0)')
  x.fillStyle = pool; x.fillRect(0, hy, w, h - hy)
}
const vigs = new Map()
export function vignette(ctx, view) {
  // (the football stage is lit like the arena: only a touch at the corners)
  const id = `${view.h}|${view.px}|${CAM === COURT ? 1 : 0}`
  let c = vigs.get(id)
  if (!c && typeof document !== 'undefined') {
    c = document.createElement('canvas'); c.width = Math.round(view.w); c.height = Math.round(view.h)
    const x = c.getContext('2d')
    const g = x.createRadialGradient(view.w / 2, view.h * 0.55, view.h * 0.3, view.w / 2, view.h * 0.55, view.h * 0.72)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${CAM === COURT ? 0.42 : 0.16})`)
    x.fillStyle = g; x.fillRect(0, 0, view.w, view.h)
    vigs.set(id, c)
  }
  if (c) ctx.drawImage(c, 0, 0, view.w, view.h)
}

// A field worth looking at, flat, for ground(): mown bands with grain, real sidelines, hashes and
// numbers. yards: logical units per yard. los: optional line. Goal: { y, color, name }.
export function paintGrass(x, view, { yards = 6.75, offset = 0, goal = null } = {}) {
  const { w, h } = view, L = -w * 0.25, W = w * 1.5
  x.fillStyle = '#17532d'; x.fillRect(L, 0, W, h)
  const band = yards * 5
  for (let i = 0, y = offset - band * 2; y < h; i++, y += band) {
    x.fillStyle = i % 2 ? '#1f6b3a' : '#267a44'
    x.fillRect(L, y, W, band)
  }
  // grain: turf isn't a flat colour
  let seed = 11
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 5200; i++) {
    x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)'
    x.fillRect(L + rnd() * W, rnd() * h, 1 + rnd() * 2, 0.8)
  }
  // out of bounds: the sideline border, the apron
  const inset = 8
  x.fillStyle = '#123f23'; x.fillRect(L, 0, -L + inset - 3, h); x.fillRect(w - inset + 3, 0, -L, h)
  x.fillStyle = '#f4f6f2'; x.fillRect(inset - 3, 0, 3.5, h); x.fillRect(w - inset, 0, 3.5, h)
  // the lines
  x.fillStyle = 'rgba(245,247,243,.86)'
  for (let y = offset % band; y < h; y += band) x.fillRect(inset, y - 0.9, w - inset * 2, 1.8)
  for (let y = offset % yards; y < h; y += yards) {
    x.fillRect(inset + 3, y - 0.5, 4, 1); x.fillRect(w - inset - 7, y - 0.5, 4, 1)
    x.fillRect(w * 0.355, y - 0.5, 5, 1); x.fillRect(w * 0.645 - 5, y - 0.5, 5, 1)
  }
  if (goal) {
    x.fillStyle = goal.color; x.fillRect(inset, 0, w - inset * 2, goal.y)
    x.fillStyle = 'rgba(245,247,243,.95)'; x.fillRect(inset, goal.y - 1.6, w - inset * 2, 3.2)
    if (goal.name) text(x, goal.name, w / 2, goal.y * 0.5, { font: DISPLAY, size: Math.min(34, goal.y * 0.5), color: 'rgba(255,255,255,.82)', track: 3 })
  }
}

// ── The athletes ────────────────────────────────────────────────────────────
// A small figure the way a sports game draws one: big shoulders, a real helmet, an outline, two-tone.
// dir: 'up' away from the camera, 'down' toward it, 'side' (mirrored for the other way).
// step: 0-3 through a stride; null stands. kit: 'pads' (helmet and pads), 'hoops', 'plain' (combine).
const INK = 'rgba(8,12,16,.82)'
const shade = (hex, f) => {
  const c = v => Math.max(0, Math.min(255, Math.round(v * f)))
  const str = String(hex), m = str.match(/^rgb((d+),(d+),(d+))$/)   // (a tone of a tone)
  if (m) return `rgb(${c(+m[1])},${c(+m[2])},${c(+m[3])})`
  let h = str.replace('#', '').slice(0, 6)
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  if (!Number.isFinite(n)) return hex
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`
}
// The drills' arms: where the hands go, [lx, ly, rx, ry], facing or back to the camera.
// '-l' and '-r' are the screen's left and right.
const DRILL_ARMS = {
  'spike-up': [-11, -21, 13, -44],                                 // the ball up, about to spike it
  'wave-a': [-25, -27, 25, -27], 'wave-m': [-13, -24, 13, -24], 'wave-b': [5, -23, -5, -21],     // the incomplete signal: long arms sweeping out and across at the waist
  'belt-a': [-13, -38, -8, -40], 'belt-m': [-4, -30, 1, -31], 'belt-b': [6, -20, 10, -22],      // the seatbelt: both hands up at one shoulder, pulled together across his chest to the other hip
  'arms-up': [-12, -43, 12, -43],                                  // a rusher, both arms high
  'catch-l': [-13, -42, 0, -44], 'catch-r': [0, -44, 13, -42],     // both hands up to the ball
  'reach-l': [-14, -41, 8, -17], 'reach-r': [-8, -17, 14, -41],  // one hand going up for it
  'swipe-l': [-20, -28, 8, -17], 'swipe-r': [-8, -17, 20, -28],    // knocking a jab away
  'shoulder-l': [-16, -38, -5, -41], 'shoulder-r': [5, -41, 16, -38],  // both hands at one shoulder, elbows in: a ball coming down over it
  'jab-l': [-14, -30, 7, -21], 'jab-r': [-7, -21, 14, -30],  // the release: a hand knocking the press away, elbow in
  dive: [-8, -46, 8, -46],                                         // laid out: both arms straight past his helmet
  'fight-l': [-17, -26, 8, -19], 'fight-r': [-8, -19, 17, -26], 'fight2-l': [-16, -31, 8, -21], 'fight2-r': [-8, -21, 16, -31],  // a hand on the man beside him
  'toss-l': [-20, -24, 8, -17], 'toss-r': [-8, -17, 20, -24],    // flicking a caught ball aside
  slide: [-16, -24, 16, -24], back: [-12, -25, 12, -25],           // a defender's hands
  'hands-head': [-9, -40, 9, -40], hips: [-15, -21, 15, -21], flex: [-20, -36, 20, -36], 'point-up': [-11, -19, 9, -49],   // after the play: can't believe it, a breather, the guns, one finger at the sky
  'griddy-a': [-5, -37, 15, -22], 'griddy-b': [-15, -22, 5, -37],  // the dance
  'point-l': [-27, -31, 8, -17], 'point-r': [-8, -17, 27, -31],    // an arm straight out: first down, that way
  touch: [-11, -20, 9, -6],                                        // low, a hand on the ground
}
// A quarterback from the side: [farX, farY, nearX, nearY]
const THROW_ARMS = {
  'qb-hold': [5.6, -29.5, 4.2, -31], 'qb-cock': [9, -31, -9, -37], 'qb-rel': [4, -22, 10, -39], 'qb-follow': [-3, -21, 10, -22],
}
// ── The football player ─────────────────────────────────────────────────
// The same man as the basketball games draw (meter.js athleteFront): tapered limbs with one ink line round
// them, knees and elbows that solve, in the same rig units (about 110 to the top of his head), scaled to fit
// the sprite. Painted once per look, as ever. Only the kit differs: helmet, pads, pants to the knee, socks.
const RIG = 0.42
const R_THIGH = 27, R_SHIN = 27, R_UARM = 20, R_FARM = 21, R_TORSO = 34
const rigBone = (x, x0, y0, r0, x1, y1, r1) => {
  const a = Math.atan2(y1 - y0, x1 - x0), q = Math.PI / 2
  x.moveTo(x0 + Math.cos(a + q) * r0, y0 + Math.sin(a + q) * r0)
  x.arc(x0, y0, r0, a + q, a - q); x.arc(x1, y1, r1, a - q, a + q); x.closePath()
}
// where the elbow goes: off the line to the hand, toward (px, py), as far as the arm's length makes it
export const rigArm = (ax, ay, tx, ty, px, py) => {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 0.001
  const mx = R_UARM + R_FARM - 0.02
  if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx }
  const ux = dx / d, uy = dy / d, along = px * ux + py * uy, h = Math.sqrt(Math.max(0, R_UARM * R_UARM - (d * d) / 4))
  return { jx: ax + dx / 2 + (px - ux * along) * h, jy: ay + dy / 2 + (py - uy * along) * h, ex: ax + dx, ey: ay + dy }
}
// the body for a pose: hip height, feet, hands (y up is negative), a little lean
export function padsPose(dir, step, pose, carry) {
  const swing = step == null ? 0 : Math.round(Math.sin((step / 4) * Math.PI * 2) * 100) / 100
  const o = { hy: 53, lean: 0, lx: -8, ly: 0, rx: 8, ry: 0, hlx: -16, hly: -47, hrx: 16, hry: -47 }
  const low = pose === 'touch' ? 15 : pose === 'block' || pose === 'stance' ? 9 : pose === 'slide' ? 6 : pose === 'ready' || pose === 'wrap' || pose === 'back' ? 4 : 0
  o.hy -= low
  if (low) { o.lx = -15; o.rx = 15 }
  if (pose === 'touch') { o.lx = -20; o.rx = 20 }
  if (pose === 'slide') { const w = (step ?? 0) % 2 ? 26 : 18; o.lx = -w; o.rx = w }
  if (pose === 'back' && swing) { if (swing > 0) o.ly = -7; else o.ry = -7 }
  if (step != null && !low) {
    // running: the feet come in under him and the heel kicks up behind, one then the other, arms opposite.
    // He's lowest as a foot lands and tallest pushing off
    const up = Math.abs(swing)
    o.lx = -6.5; o.rx = 6.5
    if (swing > 0) o.ly = -24 * swing; else if (swing < 0) o.ry = 24 * swing
    o.hy = 52.5 + up * 3
    o.lean = swing * 0.05
    o.hlx = -15.5 + swing * 1.5; o.hly = -54 + swing * 9; o.hrx = 15.5 + swing * 1.5; o.hry = -54 - swing * 9
  }
  // the quarterback from behind. qb-drop: short quick steps back, the ball at his chest (out of sight in front of him).
  // qb-set: knees soft, feet staggered, the ball up by his throwing shoulder
  if (pose === 'qb-drop') { o.hy = 52; o.lx = -8; o.rx = 8; o.ly = swing > 0 ? -6 * swing : 0; o.ry = swing < 0 ? 6 * swing : 0; o.lean = swing * 0.025; o.hlx = 8; o.hly = -70; o.hrx = -8; o.hry = -70; return o }
  if (pose === 'qb-set') { o.hy = 50; o.lean = 0.02; o.lx = -10; o.ly = -3; o.rx = 10; o.ry = 0; o.hlx = 7; o.hly = -84; o.hrx = 17; o.hry = -90; return o }
  // a back at full speed (the juke drills): heels up behind him, a moment off the ground between strides, arms pumping
  if (pose === 'sprint') {
    const s = Math.sin(((step ?? 0) / 4) * Math.PI * 2), up = Math.abs(s), fly = 1 - up
    o.lx = -4.4 - Math.max(0, s) * 2.6; o.rx = 4.4 + Math.max(0, -s) * 2.6
    o.ly = -Math.max(0, s) * 34 - fly * 3.5; o.ry = -Math.max(0, -s) * 34 - fly * 3.5
    o.hy = 52 + fly * 4; o.lean = s * 0.08
    o.hlx = -15 + s * 2; o.hly = -56 + s * 13; o.hrx = 15 + s * 2; o.hry = -56 - s * 13
    if (carry) { o.hlx = -19; o.hly = -60 }
    return o
  }
  // the cut: sat down, the outside foot planted way out, everything going over the other way
  if (pose === 'plant-l' || pose === 'plant-r') {
    const sd = pose === 'plant-r' ? 1 : -1
    o.hy = 43; o.lean = sd * 0.3
    if (sd > 0) { o.lx = -31; o.ly = 0; o.rx = 9; o.ry = -11 } else { o.rx = 31; o.ry = 0; o.lx = -9; o.ly = -11 }
    o.hlx = sd > 0 ? -27 : -8; o.hly = sd > 0 ? -52 : -38; o.hrx = sd > 0 ? 8 : 27; o.hry = sd > 0 ? -38 : -52
    if (carry) { o.hlx = -19; o.hly = -55 }
    return o
  }
  const drill = DRILL_ARMS[pose]   // (the table's hands are in the old figure's units)
  if (drill) {
    const shift = pose === 'touch' ? 10 : pose === 'slide' ? 5 : pose === 'back' ? 3 : 0
    o.hlx = drill[0] / RIG; o.hly = Math.min(-5, (drill[1] + shift) / RIG); o.hrx = drill[2] / RIG; o.hry = Math.min(-5, (drill[3] + shift) / RIG)
  } else if (pose === 'block' || pose === 'stance' || pose === 'wrap') {
    // hands on his man: up at the shoulders from behind, at the chest from in front
    const y = dir === 'up' ? -o.hy - 4 : -o.hy - 14, w = dir === 'up' ? 18 : 16
    o.hlx = -w; o.hly = y; o.hrx = w; o.hry = y
  } else if (pose === 'ready') { o.hlx = -18; o.hly = -o.hy - 1; o.hrx = 18; o.hry = -o.hy - 1 }
  if (carry && !drill) { o.hlx = -19; o.hly = -62 + (53 - o.hy) * 0.6 }
  return o
}
// A limb with some shape: the same tapered bone, its two long sides curved out by b0 and b1, and the far end
// cut flat for a hem if flat. One flat tone goes down the side away from the light (the light's up and to the left).
export function limb(x, x0, y0, r0, x1, y1, r1, b0 = 0, b1 = 0, flat = false) {
  const a = Math.atan2(y1 - y0, x1 - x0), q = Math.PI / 2, nx = Math.cos(a + q), ny = Math.sin(a + q)
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, rm = (r0 + r1) / 2
  x.moveTo(x0 + nx * r0, y0 + ny * r0)
  x.arc(x0, y0, r0, a + q, a - q)
  x.quadraticCurveTo(mx - nx * (rm + b1), my - ny * (rm + b1), x1 - nx * r1, y1 - ny * r1)
  if (flat) x.lineTo(x1 + nx * r1, y1 + ny * r1); else x.arc(x1, y1, r1, a - q, a + q)
  x.quadraticCurveTo(mx + nx * (rm + b0), my + ny * (rm + b0), x0 + nx * r0, y0 + ny * r0)
  x.closePath()
}
export function limbShade(x, x0, y0, r0, x1, y1, r1, b0 = 0, b1 = 0, w = 0.36) {
  const a = Math.atan2(y1 - y0, x1 - x0), q = Math.PI / 2
  let nx = Math.cos(a + q), ny = Math.sin(a + q), b = b0
  if (nx * 0.8 + ny * 0.6 < 0) { nx = -nx; ny = -ny; b = b1 }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, rm = (r0 + r1) / 2, i = 1 - 2 * w
  x.moveTo(x0 + nx * r0, y0 + ny * r0)
  x.quadraticCurveTo(mx + nx * (rm + b), my + ny * (rm + b), x1 + nx * r1, y1 + ny * r1)
  x.lineTo(x1 + nx * r1 * i, y1 + ny * r1 * i)
  x.quadraticCurveTo(mx + nx * (rm * i + b * 0.3), my + ny * (rm * i + b * 0.3), x0 + nx * r0 * i, y0 + ny * r0 * i)
  x.closePath()
}
const CLEAT = '#20262c', SOLE = '#e8ebe6'
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase()
const stripeOf = (pants, trim, jersey) => (same(trim, pants) ? jersey : trim)
// A cleat: heel, ankle collar, a toe that comes down to the sole, a white plate and studs. out: which way the toe
// points; len: how much of the foot shows (long from the side, short end on)
function cleat(x, ex, ey, out, len, col, accent) {
  const heel = ex - out * 3.3, toe = ex + out * len, g = ey + 4.3
  x.fillStyle = col; x.strokeStyle = INK; x.lineWidth = 1; x.beginPath()
  x.moveTo(heel, g); x.lineTo(heel - out * 0.5, ey + 0.2)
  x.quadraticCurveTo(ex, ey - 2.6, ex + out * 2.3, ey - 1.1)
  x.quadraticCurveTo(toe - out * 1.3, ey + 0.4, toe + out * 0.7, ey + 2.1)
  x.quadraticCurveTo(toe + out * 1.3, g - 0.4, toe + out * 0.5, g)
  x.closePath(); x.fill(); x.stroke()
  x.strokeStyle = accent; x.lineWidth = 1.1; x.lineCap = 'butt'; x.beginPath(); x.moveTo(heel + out * 0.6, ey + 2.5); x.lineTo(ex + out * 2.4, ey + 0.9); x.stroke(); x.lineCap = 'round'
  const a = Math.min(heel, toe + out * 0.5), w = Math.abs(toe + out * 0.5 - heel)
  x.fillStyle = SOLE; x.fillRect(a, g - 0.2, w, 1)
  x.fillStyle = INK; x.fillRect(a + 0.4, g + 0.8, 1.2, 0.8); x.fillRect(a + w - 1.6, g + 0.8, 1.2, 0.8); if (w > 8) x.fillRect(a + w * 0.5 - 0.6, g + 0.8, 1.2, 0.8)
}
// A leg in the kit, by its joints. face: 'front' (a knee pad shows), 'back' (the crease behind the knee), 'side'.
function kitLeg(x, hx, hy, jx, jy, ex, ey, out, jersey, pants, trim, bare, face, len) {
  const sl = Math.hypot(ex - jx, ey - jy) || 1, dx = (ex - jx) / sl, dy = (ey - jy) / sl
  const bOut = out > 0 ? 0.3 : 1.6, bIn = out > 0 ? 1.6 : 0.3   // (the calf swells on the outside of the leg)
  x.fillStyle = INK; x.beginPath(); limb(x, hx, hy, 7.8, jx, jy, 6.1, 1, 1); limb(x, jx, jy, 6.1, ex, ey, 4.1, bOut, bIn); x.fill()
  if (bare) {
    // shorts: bare from above the knee, a real calf, a low sock
    x.fillStyle = bare; x.beginPath(); limb(x, jx, jy, 5.1, ex, ey, 3.1, bOut, bIn); limb(x, lerp(hx, jx, 0.45), lerp(hy, jy, 0.45), 6.2, jx, jy, 5.2); x.fill()
    x.fillStyle = shade(bare, 0.78); x.beginPath(); limbShade(x, jx, jy, 5.1, ex, ey, 3.1, bOut, bIn); limbShade(x, lerp(hx, jx, 0.45), lerp(hy, jy, 0.45), 6.2, jx, jy, 5.2); x.fill()
    const a = lerp(jx, ex, 0.7), b = lerp(jy, ey, 0.7), n = 3.6
    x.fillStyle = '#f3f3f0'; x.beginPath(); x.moveTo(a - dy * n, b + dx * n); x.lineTo(ex - dy * 3.1, ey + dx * 3.1); x.lineTo(ex + dy * 3.1, ey - dx * 3.1); x.lineTo(a + dy * n, b - dx * n); x.closePath(); x.fill()
    cleat(x, ex, ey, out, len, CLEAT, '#8b949c')
    const mx = lerp(hx, jx, 0.66), my = lerp(hy, jy, 0.66)
    x.fillStyle = pants; x.beginPath(); limb(x, hx, hy, 6.8, mx, my, 6.5, 0.6, 0.6, true); x.fill()
    x.fillStyle = 'rgba(0,0,0,.16)'; x.beginPath(); limbShade(x, hx, hy, 6.8, mx, my, 6.5, 0.6, 0.6); x.fill()
    const tl = Math.hypot(jx - hx, jy - hy) || 1, tx = (jx - hx) / tl, ty = (jy - hy) / tl
    x.strokeStyle = INK; x.lineWidth = 1; x.beginPath(); x.moveTo(mx - ty * 6.5, my + tx * 6.5); x.lineTo(mx + ty * 6.5, my - tx * 6.5); x.stroke()
    return
  }
  // the sock: a stripe at the top, the shin falling away from the light
  x.fillStyle = shade(jersey, 0.86); x.beginPath(); limb(x, jx, jy, 5.1, ex, ey, 3.2, bOut, bIn); x.fill()
  x.fillStyle = 'rgba(0,0,0,.2)'; x.beginPath(); limbShade(x, jx, jy, 5.1, ex, ey, 3.2, bOut, bIn); x.fill()
  const bf = 0.36, ba = lerp(jx, ex, bf), bb = lerp(jy, ey, bf), bn = lerp(5.3, 3.3, bf)
  x.strokeStyle = trim; x.lineWidth = 1.6; x.lineCap = 'butt'; x.beginPath(); x.moveTo(ba - dy * bn, bb + dx * bn); x.lineTo(ba + dy * bn, bb - dx * bn); x.stroke(); x.lineCap = 'round'
  cleat(x, ex, ey, out, len, CLEAT, stripeOf(CLEAT, trim, '#e8ebe6'))
  // the pants: to just below the knee with a flat hem, the stripe down the outside of the thigh, the pad over the knee
  const kx = jx + dx * 3.2, ky = jy + dy * 3.2
  x.fillStyle = pants; x.beginPath(); limb(x, hx, hy, 6.8, kx, ky, 5, 1, 1, true); x.fill()
  x.fillStyle = 'rgba(0,0,0,.13)'; x.beginPath(); limbShade(x, hx, hy, 6.8, kx, ky, 5, 1, 1); x.fill()
  x.strokeStyle = INK; x.lineWidth = 1; x.beginPath(); x.moveTo(kx - dy * 5.1, ky + dx * 5.1); x.lineTo(kx + dy * 5.1, ky - dx * 5.1); x.stroke()
  const tl = Math.hypot(jx - hx, jy - hy) || 1, tx = (jx - hx) / tl, ty = (jy - hy) / tl
  if (face === 'side') { x.strokeStyle = stripeOf(pants, trim, jersey); x.lineWidth = 1.7; x.lineCap = 'butt'; x.beginPath(); x.moveTo(hx, hy); x.lineTo(jx - tx * 2.4, jy - ty * 2.4); x.stroke(); x.lineCap = 'round' }
  if (face === 'back') {
    x.strokeStyle = 'rgba(0,0,0,.26)'; x.lineWidth = 1; x.beginPath(); x.moveTo(jx - 3, jy + 1); x.quadraticCurveTo(jx, jy + 2.6, jx + 3, jy + 1); x.stroke()
  } else {
    // the knee pad is a shape under the cloth: a tone, and the line along its top
    const px = face === 'side' ? jx + tl * 0 + 1.8 : jx, r = face === 'side' ? 2.6 : 3.3
    x.fillStyle = 'rgba(0,0,0,.11)'; x.beginPath(); limb(x, px - tx * 2.6, jy - ty * 2.6, r, px + dx * 0.4, jy + dy * 0.4, r * 0.92); x.fill()
    x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(px - r, jy - ty * 4.4); x.quadraticCurveTo(px, jy - ty * 6.4, px + r, jy - ty * 4.4); x.stroke()
  }
}
function padsLeg(x, hx, hy, fx, fy, out, jersey, pants, bare, trim, face) {
  const ex = fx, ey = fy - 2.6, reach = Math.max(0, Math.min(1, 1 - Math.hypot(ex - hx, ey - hy) / (R_THIGH + R_SHIN)))
  const jx = (hx + ex) / 2 + out * reach * 9, jy = (hy + ey) / 2 - reach * 2
  kitLeg(x, hx, hy, jx, jy, ex, ey, out, jersey, pants, trim, bare, face, 4)
  return { hx, hy, jx, jy, out }
}
// the stripe down the pants: from the belt along the outside of the thigh to the knee, over the hips
function thighStripe(x, { hx, hy, jx, jy, out }, col) {
  const tl = Math.hypot(jx - hx, jy - hy) || 1, tx = (jx - hx) / tl, ty = (jy - hy) / tl
  let nx = ty, ny = -tx
  if (nx * out < 0) { nx = -nx; ny = -ny }
  x.moveTo(hx + out * 3.6, hy - 6.4); x.quadraticCurveTo(hx + nx * 4.8, hy + ny * 4.8, jx + nx * 3.5 - tx * 2.4, jy + ny * 3.5 - ty * 2.4)
}
// A bare head: a real hairline, the nape and the ears showing, not a black ball
export function bareHead(x, hx, hy, view, skin) {
  const R = 9.2, hair = '#17120e', dark = shade(skin, 0.76)
  x.fillStyle = dark
  if (view !== 'side') { circle(x, hx - R + 0.2, hy + 1, 2); x.fill(); circle(x, hx + R - 0.2, hy + 1, 2); x.fill() }
  x.fillStyle = skin; x.strokeStyle = INK; x.lineWidth = 1.4; x.beginPath()
  x.arc(hx, hy - 0.5, R, Math.PI, 0); x.quadraticCurveTo(hx + R, hy + 7, hx + 3, hy + R); x.lineTo(hx - 3, hy + R); x.quadraticCurveTo(hx - R, hy + 7, hx - R, hy - 0.5); x.closePath(); x.fill(); x.stroke()
  x.fillStyle = dark; x.beginPath(); x.moveTo(hx + R - 0.6, hy); x.quadraticCurveTo(hx + R - 1, hy + 6.5, hx + 3, hy + R - 0.6); x.quadraticCurveTo(hx + 6, hy + 4, hx + 5.4, hy - 2); x.closePath(); x.fill()
  x.fillStyle = hair; x.beginPath()
  if (view === 'up') {
    x.arc(hx, hy - 0.5, R + 0.2, 0.2, Math.PI - 0.2, true); x.quadraticCurveTo(hx, hy + 6.8, hx + (R + 0.2) * Math.cos(0.2), hy - 0.5 + (R + 0.2) * Math.sin(0.2)); x.closePath(); x.fill()
    return
  }
  if (view === 'down') {
    x.arc(hx, hy - 0.5, R + 0.2, Math.PI + 0.1, -0.1); x.lineTo(hx + 7.6, hy - 2.6); x.lineTo(hx + 5.8, hy - 4.8); x.quadraticCurveTo(hx, hy - 5.8, hx - 5.8, hy - 4.8); x.lineTo(hx - 7.6, hy - 2.6); x.closePath(); x.fill()
    x.fillRect(hx - 4.4, hy - 2.4, 3, 0.9); x.fillRect(hx + 1.4, hy - 2.4, 3, 0.9)
    x.fillRect(hx - 3.9, hy - 0.6, 2, 1.5); x.fillRect(hx + 1.9, hy - 0.6, 2, 1.5)
    x.fillStyle = dark; x.fillRect(hx - 2, hy + 4.8, 4, 0.9)
    return
  }
  // side on, looking +x: hair over the crown and down the back, the ear, the eye
  x.arc(hx, hy - 0.5, R + 0.2, -0.3, Math.PI * 0.82, true); x.quadraticCurveTo(hx - 3, hy + 1, hx - 2.2, hy - 3.6); x.quadraticCurveTo(hx + 3, hy - 5.4, hx + R * 0.95, hy - 3.2); x.closePath(); x.fill()
  x.fillRect(hx + 3.8, hy - 0.6, 2.2, 1.5)
  x.fillStyle = dark; circle(x, hx - 2.2, hy + 1.2, 2); x.fill()
}
// The hand on the end of an arm: a glove with a thumb, fingers closed
function kitHand(x, ex, ey, ux, uy, out, col, line) {
  const tx = ex + ux * 4.2, ty = ey + uy * 4.2, px = -uy, py = ux, sgn = (px * -out >= 0 ? 1 : -1), bx = ex + ux * 1.6 + px * sgn * 2.6, by = ey + uy * 1.6 + py * sgn * 2.6, cx = bx + ux * 2 + px * sgn * 0.6, cy = by + uy * 2 + py * sgn * 0.6
  x.fillStyle = INK; x.beginPath(); limb(x, ex, ey, 4, tx, ty, 3.5); limb(x, bx, by, 2, cx, cy, 1.7); x.fill()
  x.fillStyle = col; x.beginPath(); limb(x, ex, ey, 3.1, tx, ty, 2.6); limb(x, bx, by, 1.2, cx, cy, 0.9); x.fill()
  x.strokeStyle = line; x.lineWidth = 0.8; x.beginPath(); x.moveTo(tx - px * 2 - ux * 0.8, ty - py * 2 - uy * 0.8); x.lineTo(tx + px * 2 - ux * 0.8, ty + py * 2 - uy * 0.8); x.stroke()
}
// The arm: a sleeve cut flat with a band on it over the upper arm, a forearm that swells below the elbow and
// narrows to the wrist, a wrist tape and a glove. Painted once, so it can afford all that.
function kitArm(x, sx, sy, a, out, jersey, trim, skin, glove) {
  const sdx = a.ex - a.jx, sdy = a.ey - a.jy, sl = Math.hypot(sdx, sdy) || 1, ux = sdx / sl, uy = sdy / sl
  const skin2 = shade(skin, 0.78)
  x.fillStyle = INK; x.beginPath(); limb(x, sx, sy, 7.1, a.jx, a.jy, 5.3, 0.8, 0.8); limb(x, a.jx, a.jy, 5.3, a.ex, a.ey, 3.8, 1, 1); x.fill()
  x.fillStyle = skin; x.beginPath(); limb(x, a.jx, a.jy, 4.2, a.ex, a.ey, 2.7, 1, 1); x.fill()
  x.fillStyle = skin2; x.beginPath(); limbShade(x, a.jx, a.jy, 4.2, a.ex, a.ey, 2.7, 1, 1); x.fill()
  const tx = a.jx - sx, ty = a.jy - sy, tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl, mx = lerp(sx, a.jx, 0.84), my = lerp(sy, a.jy, 0.84)
  x.fillStyle = jersey; x.beginPath(); limb(x, sx, sy, 6, mx, my, 4.7, 0.8, 0.8, true); x.fill()
  x.fillStyle = 'rgba(0,0,0,.16)'; x.beginPath(); limbShade(x, sx, sy, 6, mx, my, 4.7, 0.8, 0.8); x.fill()
  x.lineCap = 'butt'
  x.strokeStyle = INK; x.lineWidth = 0.9; x.beginPath(); x.moveTo(mx - nx * 4.9, my - ny * 4.9); x.lineTo(mx + nx * 4.9, my + ny * 4.9); x.stroke()
  const bx = lerp(sx, a.jx, 0.68), by = lerp(sy, a.jy, 0.68)
  x.strokeStyle = trim; x.lineWidth = 1.7; x.beginPath(); x.moveTo(bx - nx * 5.1, by - ny * 5.1); x.lineTo(bx + nx * 5.1, by + ny * 5.1); x.stroke()
  x.lineCap = 'round'
  if (glove) {
    const gx = lerp(a.jx, a.ex, 0.84), gy = lerp(a.jy, a.ey, 0.84), n = 3.1
    x.strokeStyle = '#f3f3f0'; x.lineWidth = 2.4; x.lineCap = 'butt'; x.beginPath(); x.moveTo(gx + uy * n, gy - ux * n); x.lineTo(gx - uy * n, gy + ux * n); x.stroke(); x.lineCap = 'round'
  }
  kitHand(x, a.ex, a.ey, ux, uy, out, glove ?? skin, glove ? 'rgba(0,0,0,.3)' : skin2)
}
function padsSleeveArm(x, sx, sy, hx, hy, out, jersey, trim, skin, glove = null) {
  const up = Math.max(0, Math.min(1, (sy - hy) / 30))
  const a = rigArm(sx, sy, hx, hy, out * (0.22 - 0.12 * up), 0.92)
  kitArm(x, sx, sy, a, out, jersey, trim, skin, glove)
  return a
}
function padsBall(x, bx, by, tilt0) {
  x.fillStyle = '#7a4420'; x.strokeStyle = INK; x.lineWidth = 1.6
  x.beginPath(); x.ellipse(bx, by, 6.6, 9.8, tilt0, 0, Math.PI * 2); x.fill(); x.stroke()
  x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1; x.beginPath(); x.moveTo(bx - 2.6, by); x.lineTo(bx + 2.6, by); x.stroke()
}
function padsHelmet(x, hx, hy, view, color, trim, skin) {
  const R = 10.6, cage = '#d9dde1', cy = hy - 1
  const stripeCol = same(color, trim) ? '#f4efe6' : color
  if (view === 'side') {
    // the shell, turned: brow to crown to the back of the neck, the jaw flap, the face in the opening
    const shell = () => {
      x.beginPath(); x.arc(hx - 1, cy, R, -0.26, 2.42, true)
      x.quadraticCurveTo(hx - 9.6, hy + 8, hx - 7.4, hy + 9.4); x.lineTo(hx + 1, hy + 10.2); x.quadraticCurveTo(hx + 4.6, hy + 9.8, hx + 5.2, hy + 6.4)
      x.quadraticCurveTo(hx + 2.6, hy + 2.2, hx + 4, hy - 1.8); x.closePath()
    }
    // the face and the cage behind the shell's edge
    x.fillStyle = shade(skin, 0.86); x.beginPath(); x.moveTo(hx + 2.6, hy - 3.4); x.lineTo(hx + 9.2, hy - 3.2); x.quadraticCurveTo(hx + 9.8, hy + 2, hx + 8.8, hy + 6.4); x.lineTo(hx + 3, hy + 7); x.closePath(); x.fill()
    x.fillStyle = '#10141a'; x.fillRect(hx + 6, hy - 1, 2.6, 1.3)
    x.fillStyle = trim; x.strokeStyle = INK; x.lineWidth = 1.5; shell(); x.fill(); x.stroke()
    x.save(); shell(); x.clip()
    x.fillStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.moveTo(hx - 12, hy + 12); x.lineTo(hx - 12, hy + 1); x.quadraticCurveTo(hx - 3, hy + 8.4, hx + 6, hy + 5); x.lineTo(hx + 6, hy + 12); x.closePath(); x.fill()
    x.fillStyle = 'rgba(255,255,255,.24)'; x.beginPath(); x.moveTo(hx - 7.4, hy - 4); x.quadraticCurveTo(hx - 4, hy - 9, hx + 2.6, hy - 8.6); x.quadraticCurveTo(hx - 3.4, hy - 7.4, hx - 7.4, hy - 4); x.closePath(); x.fill()
    x.restore()
    // the stripe follows the crown
    x.strokeStyle = stripeCol; x.lineWidth = 1.9; x.lineCap = 'butt'; x.beginPath(); x.arc(hx - 1, cy, R - 1, -0.72, -2.8, true); x.stroke(); x.lineCap = 'round'
    // the ear hole
    x.fillStyle = 'rgba(255,255,255,.2)'; circle(x, hx - 2, hy + 2.4, 2.5); x.fill()
    x.fillStyle = '#0c1014'; circle(x, hx - 2, hy + 2.4, 1.5); x.fill()
    // the cage, standing off the front of the helmet
    const bars = () => { x.beginPath(); x.moveTo(hx + 4.2, hy - 2.2); x.quadraticCurveTo(hx + 12, hy - 2.6, hx + 12.6, hy + 2.6); x.quadraticCurveTo(hx + 12.4, hy + 8.2, hx + 4.8, hy + 8.8); x.moveTo(hx + 4.6, hy + 2.8); x.lineTo(hx + 12.6, hy + 2.6); x.moveTo(hx + 8.8, hy - 2); x.lineTo(hx + 9, hy + 8); x.stroke() }
    x.strokeStyle = INK; x.lineWidth = 2; bars(); x.strokeStyle = cage; x.lineWidth = 1.05; bars()
    return
  }
  const shell = () => {
    x.beginPath(); x.arc(hx, cy, R, Math.PI * 0.94, Math.PI * 0.06)
    x.quadraticCurveTo(hx + R + 0.5, hy + 6.5, hx + R * 0.72, hy + R * 0.97)
    x.lineTo(hx - R * 0.72, hy + R * 0.97)
    x.quadraticCurveTo(hx - R - 0.5, hy + 6.5, hx - R * 0.99, hy + 2.1)
    x.closePath()
  }
  x.fillStyle = trim; x.strokeStyle = INK; x.lineWidth = 1.5; shell(); x.fill(); x.stroke()
  x.save(); shell(); x.clip()
  // shadow low and to the right, a hard highlight high on the left: two flat tones on the shell
  x.fillStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.moveTo(hx + R + 1, hy - 7); x.quadraticCurveTo(hx + 5.4, hy + 3, hx - R - 1, hy + 7.6); x.lineTo(hx - R - 1, hy + R + 1); x.lineTo(hx + R + 1, hy + R + 1); x.closePath(); x.fill()
  x.fillStyle = 'rgba(255,255,255,.26)'; x.beginPath(); x.moveTo(hx - 8.6, hy - 2.4); x.quadraticCurveTo(hx - 8.2, hy - 9, hx - 2.8, hy - 10); x.quadraticCurveTo(hx - 6.6, hy - 7.2, hx - 8.6, hy - 2.4); x.closePath(); x.fill()
  x.restore()
  // the ear holes, each with a little ring of snap
  for (const d of [-1, 1]) { x.fillStyle = 'rgba(255,255,255,.16)'; circle(x, hx + d * (R - 2.3), hy + 2.8, 1.9); x.fill(); x.fillStyle = '#0c1014'; circle(x, hx + d * (R - 2.3), hy + 2.8, 1.1); x.fill() }
  const stripe = h => { x.fillStyle = 'rgba(8,12,16,.5)'; x.fillRect(hx - 2.3, hy - R - 0.6, 4.6, h); x.fillStyle = stripeCol; x.fillRect(hx - 1.7, hy - R - 0.5, 3.4, h - 0.2) }
  x.save(); shell(); x.clip()
  if (view === 'up') {
    stripe(R * 2 - 3)
    // the padding showing at the bottom
    x.fillStyle = 'rgba(8,12,16,.62)'; x.beginPath(); x.moveTo(hx - R * 0.72, hy + R * 0.97); x.quadraticCurveTo(hx, hy + R * 0.42, hx + R * 0.72, hy + R * 0.97); x.closePath(); x.fill()
    x.restore()
    return
  }
  stripe(5.6)
  x.restore()
  // the opening: dark round the face, the brow's shadow over the eyes, the cage across the front
  x.fillStyle = '#0c1014'; x.beginPath(); x.roundRect(hx - 6.9, hy - 4.2, 13.8, 13, 3.2); x.fill()
  x.fillStyle = skin; x.beginPath(); x.roundRect(hx - 5.5, hy - 3.2, 11, 11.6, 3); x.fill()
  x.fillStyle = shade(skin, 0.76); x.fillRect(hx - 5.5, hy - 3.2, 11, 2.2); x.fillRect(hx + 2, hy - 1, 3.5, 9)
  x.fillStyle = '#10141a'; x.fillRect(hx - 3.9, hy - 1, 2.6, 1.4); x.fillRect(hx + 1.3, hy - 1, 2.6, 1.4)
  const bars = () => { x.beginPath(); x.moveTo(hx - 8.6, hy + 2); x.lineTo(hx + 8.6, hy + 2); x.moveTo(hx - 7.4, hy + 5.6); x.quadraticCurveTo(hx, hy + 7.2, hx + 7.4, hy + 5.6); x.moveTo(hx - 2.2, hy + 2); x.lineTo(hx - 2.4, hy + 9); x.moveTo(hx + 2.2, hy + 2); x.lineTo(hx + 2.4, hy + 9); x.stroke() }
  x.strokeStyle = 'rgba(8,12,16,.6)'; x.lineWidth = 1.9; bars(); x.strokeStyle = cage; x.lineWidth = 1.05; bars()
}
const FALL_Y = [1, 0.8, 0.6, 0.42]   // down the field and away: how much of his height shows, a stage at a time
function paintPads(x, { color, trim, pants, skin, number, dir, step, carry, pose, kit, fallStage = 0 }) {
  const plain = kit === 'plain', fy = FALL_Y[fallStage], glove = plain ? null : trim
  // (the head is round whatever the body's doing)
  const headOf = (hx, hy, v) => {
    x.save(); x.translate(hx, hy); x.scale(1, 1 / fy); x.translate(-hx, -hy)
    if (plain) bareHead(x, hx, hy, v, skin); else padsHelmet(x, hx, hy, v, color, trim, skin)
    x.restore()
  }
  x.save(); x.scale(RIG, RIG * fy); x.lineCap = 'round'; x.lineJoin = 'round'
  const neckCol = shade(skin, 0.74)
  if (dir === 'side') {
    // from the side, facing +x
    const swing = step == null ? 0 : [1, 0, -1, 0][step], thr = THROW_ARMS[pose]
    const hipY = -53, sy = hipY - R_TORSO + 2, sx = swing ? 3 : 1
    // two legs, always: a man standing side on has one a little ahead of the other
    const far = swing ? swing * 22 : pose === 'qb-hold' ? 9 : 7, near = swing ? -swing * 22 : pose === 'qb-hold' ? -8 : -6
    const legSide = (fx, fy2, f) => {
      const ex = fx, ey = fy2 - 2.6, reach = Math.max(0, Math.min(1, 1 - Math.hypot(ex, ey - hipY) / (R_THIGH + R_SHIN)))
      const jx = ex / 2 + reach * 11 + 2.6, jy = (hipY + ey) / 2 - reach * 2
      kitLeg(x, 0, hipY, jx, jy, ex, ey, 1, shade(color, f), shade(pants, f), shade(trim, f), plain ? shade(skin, f) : null, 'side', 6.4)
    }
    const armSide = (hx, hy, f = 1) => {
      const a = rigArm(sx, sy, hx, hy, -0.4, 0.8)
      kitArm(x, sx, sy, a, 1, shade(color, f), shade(trim, f), shade(skin, f), plain ? null : shade(trim, f))
    }
    if (thr) armSide(thr[0] / RIG, thr[1] / RIG, 0.84); else armSide(sx + (swing ? swing * 16 : 4), -50 - swing * 2, 0.84)
    legSide(far, swing > 0 ? -8 : 0, 0.8)
    legSide(near, swing < 0 ? -8 : 0, 1)
    // the hips side on: a seat behind, flat in front, the belt on top
    x.fillStyle = pants; x.strokeStyle = INK; x.lineWidth = 1.2; x.beginPath()
    x.moveTo(-8.4, hipY - 4); x.lineTo(8.2, hipY - 4); x.quadraticCurveTo(9.6, hipY + 2, 7.4, hipY + 8); x.lineTo(-6, hipY + 9); x.quadraticCurveTo(-11.4, hipY + 3, -8.4, hipY - 4); x.closePath(); x.fill(); x.stroke()
    x.fillStyle = 'rgba(0,0,0,.14)'; x.beginPath(); x.moveTo(-8.4, hipY - 4); x.lineTo(-3.4, hipY - 4); x.lineTo(-2.4, hipY + 9); x.lineTo(-6, hipY + 9); x.quadraticCurveTo(-11.4, hipY + 3, -8.4, hipY - 4); x.closePath(); x.fill()
    if (!plain) { x.strokeStyle = stripeOf(pants, trim, color); x.lineWidth = 1.9; x.lineCap = 'butt'; x.beginPath(); x.moveTo(0, hipY - 3); x.lineTo(0.6, hipY + 9); x.stroke(); x.lineCap = 'round' }
    // the body side on: narrower than it is from the front, the pads standing proud of the chest, the jersey tucked in
    const side = () => { x.beginPath(); x.moveTo(-8.2, hipY); x.quadraticCurveTo(-9.6, sy + 18, -12.2, sy + 7); x.quadraticCurveTo(-12.4, sy - 5, sx - 1, sy - 6); x.quadraticCurveTo(13.4, sy - 5.4, 12.4, sy + 7); x.quadraticCurveTo(10, sy + 16, 8.6, hipY); x.closePath() }
    x.fillStyle = color; x.strokeStyle = INK; x.lineWidth = 1.5; side(); x.fill(); x.stroke()
    x.save(); side(); x.clip()
    x.fillStyle = 'rgba(0,0,0,.16)'; x.beginPath(); x.moveTo(-14, hipY + 1); x.lineTo(-14, sy - 7); x.lineTo(-6.6, sy - 7); x.quadraticCurveTo(-3, sy + 14, -3.4, hipY + 1); x.closePath(); x.fill()
    x.fillStyle = 'rgba(255,255,255,.13)'; x.beginPath(); x.moveTo(1, sy - 5.6); x.quadraticCurveTo(11, sy - 5, 11.2, sy + 3); x.quadraticCurveTo(7, sy - 2, 1, sy - 3); x.closePath(); x.fill()
    x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 1; x.beginPath(); x.moveTo(8, hipY - 6); x.quadraticCurveTo(4, hipY - 8, 1, hipY - 6); x.moveTo(7.6, hipY - 11); x.quadraticCurveTo(5, hipY - 12.4, 3, hipY - 11); x.stroke()
    x.restore()
    x.fillStyle = INK; x.fillRect(-8.6, hipY - 0.8, 17.4, 1)
    const hy = sy - 13
    x.fillStyle = neckCol; x.beginPath(); rigBone(x, sx - 0.5, sy - 2, 5.2, sx + 1, hy, 4.4); x.fill()
    headOf(sx + 1, hy, 'side')
    if (carry && !thr) padsBall(x, 13, -66, -0.35)
    if (thr) {
      armSide(thr[2] / RIG, thr[3] / RIG)
      if (pose === 'qb-cock') padsBall(x, thr[2] / RIG - 2, thr[3] / RIG - 5, 1.1)
      if (pose === 'qb-hold') padsBall(x, thr[2] / RIG + 3, thr[3] / RIG - 5, 1.1)
    } else if (pose === 'wrap') armSide(24, -68)
    else armSide(sx + (swing ? -swing * 16 : 2), -50 + swing * 2)
    x.restore()
    return
  }
  const back = dir === 'up', o = padsPose(dir, step, pose, carry)
  const sl = Math.sin(o.lean), cl = Math.cos(o.lean), hipY = -o.hy
  const sx = sl * R_TORSO, sy = hipY - cl * R_TORSO
  const turned = pose === 'qb-set', SH = plain ? 13.5 : 15.5, rx = sx + cl * (turned ? SH + 0.6 : SH), ry = sy + sl * SH + (turned ? 3.2 : 2.5), lx = sx - cl * (turned ? SH - 1.8 : SH), ly = sy - sl * SH + (turned ? 1.4 : 2.5)
  const ballAt = () => padsBall(x, o.hlx - 3, o.hly - 2, 0.25)
  const face = back ? 'back' : 'front'
  // arms hanging or held out go behind the jersey, shoulder under the armhole. Only hands on the chest cross in front.
  const armsOver = !back && pose && pose !== 'slide' && pose !== 'ready' && pose !== 'back' && pose !== 'touch' && pose !== 'sprint' && pose !== 'plant-l' && pose !== 'plant-r'
  if (!armsOver) {
    if (back && carry && !DRILL_ARMS[pose]) ballAt()
    padsSleeveArm(x, lx, ly, o.hlx, o.hly, -1, color, trim, skin, glove)
    padsSleeveArm(x, rx, ry, o.hrx, o.hry, 1, color, trim, skin, glove)
  }
  x.fillStyle = INK; x.beginPath(); rigBone(x, -cl * 5, hipY - sl * 5 - 1, 8.1, cl * 5, hipY + sl * 5 - 1, 8.1); x.fill()
  const legL = padsLeg(x, -cl * 6.2, hipY - sl * 6.2, o.lx, o.ly, -1, color, pants, plain ? skin : null, trim, face)
  const legR = padsLeg(x, cl * 6.2, hipY + sl * 6.2, o.rx, o.ry, 1, color, pants, plain ? skin : null, trim, face)
  // the hips: one piece from the belt to the fork, as wide as the thighs and no wider
  x.save(); x.translate(0, hipY); x.rotate(o.lean)
  x.fillStyle = pants; x.beginPath(); x.moveTo(-10.6, -7); x.lineTo(10.6, -7); x.quadraticCurveTo(12.9, 0, 12.9, 6); x.lineTo(2, 9.6); x.lineTo(0, 12.4); x.lineTo(-2, 9.6); x.lineTo(-12.9, 6); x.quadraticCurveTo(-12.9, 0, -10.6, -7); x.closePath(); x.fill()
  x.fillStyle = 'rgba(0,0,0,.13)'; x.beginPath(); x.moveTo(7.2, -7); x.lineTo(10.6, -7); x.quadraticCurveTo(12.9, 0, 12.9, 6); x.lineTo(7.3, 7.6); x.closePath(); x.fill()
  x.strokeStyle = 'rgba(8,12,16,.5)'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(0, 2); x.lineTo(0, 12); x.stroke()
  x.restore()
  if (!plain) { x.strokeStyle = stripeOf(pants, trim, color); x.lineWidth = 1.7; x.lineCap = 'butt'; x.beginPath(); thighStripe(x, legL); thighStripe(x, legR); x.stroke(); x.lineCap = 'round' }
  // the neck
  const hx = sx + sl * 14, hy = sy - cl * 14
  x.fillStyle = neckCol; x.beginPath(); rigBone(x, sx, sy, 5.8, hx, hy, 4.6); x.fill()
  // the jersey over the pads: wide, square shoulders, in to the waist
  x.save(); x.translate(sx, sy); x.rotate(o.lean)
  if (plain) x.scale(0.84, 1)   // (no pads under a t-shirt)
  if (turned) x.transform(0.95, 0.045, 0, 1, 0.3, 0)
  const body = () => { x.beginPath(); x.moveTo(-7, -3); x.lineTo(7, -3); x.quadraticCurveTo(15.6, -3, 17.6, 3.5); x.quadraticCurveTo(18.2, 9, 12.8, 14); x.lineTo(10.4, R_TORSO - 1); x.lineTo(-10.4, R_TORSO - 1); x.lineTo(-12.8, 14); x.quadraticCurveTo(-18.2, 9, -17.6, 3.5); x.quadraticCurveTo(-15.6, -3, -7, -3); x.closePath() }
  x.fillStyle = color; x.strokeStyle = INK; x.lineWidth = 1.5; body(); x.fill(); x.stroke()
  x.save(); body(); x.clip()
  x.fillStyle = 'rgba(0,0,0,.15)'; x.beginPath(); x.moveTo(19, 0); x.quadraticCurveTo(9.6, 13, 6.4, R_TORSO); x.lineTo(20, R_TORSO); x.closePath(); x.fill()
  if (!plain) {
    // the pads' edge under the cloth, and light along the near shoulder
    x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.moveTo(-18, 5); x.quadraticCurveTo(-16, -3, -7, -3); x.lineTo(-6, 1); x.quadraticCurveTo(-13, 2, -18, 5); x.closePath(); x.fill()
    x.strokeStyle = 'rgba(0,0,0,.2)'; x.lineWidth = 1; x.beginPath(); x.moveTo(-13.4, 13); x.quadraticCurveTo(-8, 10.6, -6, 5.5); x.moveTo(13.4, 13); x.quadraticCurveTo(8, 10.6, 6, 5.5); x.stroke()
  }
  // the cloth bunches where it tucks in
  x.strokeStyle = 'rgba(0,0,0,.2)'; x.lineWidth = 0.95; x.beginPath()
  x.moveTo(-9.4, R_TORSO - 8); x.quadraticCurveTo(-6, R_TORSO - 6.2, -3.6, R_TORSO - 4); x.moveTo(9.2, R_TORSO - 9); x.quadraticCurveTo(6.4, R_TORSO - 6.8, 4.6, R_TORSO - 4)
  x.moveTo(-9.8, R_TORSO - 13); x.quadraticCurveTo(-8, R_TORSO - 12, -6.4, R_TORSO - 10.4); x.stroke()
  x.restore()
  // the collar
  x.lineCap = 'butt'
  if (back) {
    x.fillStyle = shade(color, 0.72); x.beginPath(); x.moveTo(-5.6, -3); x.quadraticCurveTo(0, 0.4, 5.6, -3); x.closePath(); x.fill()
    x.strokeStyle = trim; x.lineWidth = 1.7; x.beginPath(); x.moveTo(-5.8, -2.6); x.quadraticCurveTo(0, 1, 5.8, -2.6); x.stroke()
  } else if (plain) {
    x.fillStyle = neckCol; x.beginPath(); x.moveTo(-5.2, -3); x.quadraticCurveTo(0, 2.4, 5.2, -3); x.closePath(); x.fill()
    x.strokeStyle = shade(color, 0.72); x.lineWidth = 1.7; x.beginPath(); x.moveTo(-5.4, -2.6); x.quadraticCurveTo(0, 3.2, 5.4, -2.6); x.stroke()
  } else {
    x.fillStyle = neckCol; x.beginPath(); x.moveTo(-5, -3); x.lineTo(0, 2.6); x.lineTo(5, -3); x.closePath(); x.fill()
    x.strokeStyle = trim; x.lineWidth = 1.8; x.lineJoin = 'miter'; x.beginPath(); x.moveTo(-5.4, -2.8); x.lineTo(0, 3.6); x.lineTo(5.4, -2.8); x.stroke(); x.lineJoin = 'round'
  }
  // tucked in: the waistband over the jersey
  x.fillStyle = pants; x.fillRect(-10.8, R_TORSO - 2.8, 21.6, 4.2)
  x.fillStyle = INK; x.fillRect(-10.9, R_TORSO - 3.4, 21.8, 1.2)
  x.lineCap = 'round'
  if (number != null) text(x, String(number), 0, back ? 15 : 16, { font: DISPLAY, size: String(number).length > 1 ? 18.5 : 21, color: inkOn(color, trim) })
  x.restore()
  headOf(hx, hy, back ? 'up' : 'down')
  if (armsOver) {
    padsSleeveArm(x, lx, ly, o.hlx, o.hly, -1, color, trim, skin, glove)
    padsSleeveArm(x, rx, ry, o.hrx, o.hry, 1, color, trim, skin, glove)
  }
  if (!back && carry && !DRILL_ARMS[pose]) ballAt()
  if (pose === 'qb-set') padsBall(x, o.hrx + 2, o.hry - 6, 0.4)
  x.restore()
}
function paintAthlete(x, { color, trim, pants, skin, number, dir, step, kit, carry, pose }) {
  const P = kit === 'pads'
  const line = (w = 1) => { x.lineWidth = P ? w * 0.68 : w; x.strokeStyle = INK }
  const swing = step == null ? 0 : [1, 0, -1, 0][step]
  x.lineCap = 'round'; x.lineJoin = 'round'

  // A thigh in the pants, a calf in the sock (or bare), a real shoe with a sole
  const leg = (hipX, hipY, footX, footY) => {
    const kx = (hipX + footX) / 2 + (footX >= hipX ? 0.7 : -0.7), ky = (hipY + footY) / 2
    x.strokeStyle = INK; x.lineWidth = P ? 7 : 9.4; x.beginPath(); x.moveTo(hipX, hipY); x.lineTo(kx, ky); x.stroke()
    x.lineWidth = P ? 5.2 : 7.6; x.beginPath(); x.moveTo(kx, ky); x.lineTo(footX, footY - 2); x.stroke()
    x.strokeStyle = P ? shade(color, 0.85) : skin; x.lineWidth = P ? 4 : 5.8; x.beginPath(); x.moveTo(kx, ky); x.lineTo(footX, footY - 2); x.stroke()
    x.strokeStyle = pants; x.lineWidth = P ? 5.8 : 7.8; x.beginPath(); x.moveTo(hipX, hipY); x.lineTo(kx, ky); x.stroke()
    const side = footX >= hipX ? 0.6 : -0.6
    const sw = P ? 0.8 : 1
    x.fillStyle = INK; rr(x, footX - 4.7 * sw + side, footY - 3.4 * sw, 9.4 * sw, 4.9 * sw, 2.4 * sw); x.fill()
    x.fillStyle = '#20262c'; rr(x, footX - 3.8 * sw + side, footY - 2.7 * sw, 7.6 * sw, 3.2 * sw, 1.6 * sw); x.fill()
    x.fillStyle = '#e8ebe6'; x.fillRect(footX - 3.2 * sw + side, footY - 0.5, 6.4 * sw, P ? 0.6 : 0.9)
  }
  // Upper arm in the sleeve, forearm, and a hand on the end of it
  const arm = (sx, sy, hx, hy, sleeve = true) => {
    const up = hy < sy   // (raised: the elbow's under it. Down: out at the side. From the side: behind him)
    const mx = (sx + hx) / 2 + (dir === 'side' ? -1 : (sx >= 0 ? 1 : -1) * (up ? 0.7 : 1.3)), my = (sy + hy) / 2 + (up ? 1.2 : 0.3)
    x.strokeStyle = INK; x.lineWidth = P ? 5.6 : 7.4; x.beginPath(); x.moveTo(sx, sy); x.lineTo(mx, my); x.stroke()
    x.lineWidth = P ? 4.9 : 6.4; x.beginPath(); x.moveTo(mx, my); x.lineTo(hx, hy); x.stroke()
    x.strokeStyle = skin; x.lineWidth = P ? 3.7 : 4.6; x.beginPath(); x.moveTo(mx, my); x.lineTo(hx, hy); x.stroke()
    x.strokeStyle = sleeve ? color : skin; x.lineWidth = P ? 4.8 : 5.8; x.beginPath(); x.moveTo(sx, sy); x.lineTo(mx, my); x.stroke()
    x.fillStyle = skin; x.strokeStyle = INK; x.lineWidth = P ? 0.7 : 1; circle(x, hx, hy, P ? 2.2 : 2.9); x.fill(); x.stroke()
  }

  if (dir === 'side') {
    // the far arm and leg first
    leg(-1, -18.5, -swing * 9, 0)
    const thr = THROW_ARMS[pose]
    if (thr) arm(1, -29, thr[0], thr[1], kit !== 'hoops')
    else arm(1, -29, 1 + swing * 7, -19, kit !== 'hoops')
    leg(1, -18.5, swing * 9 + 1, swing === 0 ? 0 : -1)
    // torso, leaning into the run
    x.fillStyle = color; line(1.1); x.beginPath()
    x.moveTo(-6.4, -17.5); x.lineTo(-10, -31); x.quadraticCurveTo(0, -38.5, 9.5, -31); x.lineTo(6.8, -17.5); x.closePath(); x.fill(); x.stroke()
    x.fillStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.moveTo(-6.4, -17.5); x.lineTo(-10, -31); x.lineTo(-4, -35); x.lineTo(-1.8, -17.5); x.closePath(); x.fill()
    if (thr) {
      arm(-1, -29, thr[2], thr[3], kit !== 'hoops')
      if (pose === 'qb-cock') { x.fillStyle = '#7a4420'; x.strokeStyle = INK; x.lineWidth = 0.9; x.beginPath(); x.ellipse(thr[2] - 1, thr[3] - 2, 5, 3.2, 0.5, 0, Math.PI * 2); x.fill(); x.stroke() }
    } else if (pose === 'wrap') arm(-1, -29, 11, -26, kit !== 'hoops')
    else arm(-1, -29, -1 - swing * 7, -18, kit !== 'hoops')
    if (carry) { x.fillStyle = '#7a4420'; x.strokeStyle = INK; x.lineWidth = 0.9; x.beginPath(); x.ellipse(5, -24, 5, 3.2, -0.3, 0, Math.PI * 2); x.fill(); x.stroke() }
  } else {
    const a = dir === 'up' ? -1 : 1
    const low = pose === 'touch' ? 10 : pose === 'block' || pose === 'stance' ? 7 : pose === 'slide' ? 5 : pose === 'ready' || pose === 'wrap' || pose === 'back' ? 3 : 0
    if (low) {
      // knees bent, feet wide
      const wide = pose === 'slide' ? ((step ?? 0) % 2 ? 12 : 7.5) : 8.5
      leg(-4, -18.5 + low, -wide, pose === 'back' && swing > 0 ? -3 : 0)
      leg(4, -18.5 + low, wide, pose === 'back' && swing < 0 ? -3 : 0)
      x.translate(0, low)
    } else {
      leg(-3.2, -18.5, -4.2, step == null ? 0 : swing > 0 ? -3 : 0)
      leg(3.2, -18.5, 4.2, step == null ? 0 : swing < 0 ? -3 : 0)
    }
    // arms pump opposite the legs (a lineman's are out in front, on his man)
    const drill = DRILL_ARMS[pose]
    if (drill) {
      arm(-9.5, -30, drill[0], drill[1], kit !== 'hoops')
      arm(9.5, -30, drill[2], drill[3], kit !== 'hoops')
    } else if (pose === 'block' || pose === 'stance' || pose === 'wrap') {
      if (dir === 'up') { arm(-9.5, -30, -6.5, -38, kit !== 'hoops'); arm(9.5, -30, 6.5, -38, kit !== 'hoops') }
    } else {
      arm(-9.5, -30, -10.5, -20 + swing * 4.5 * a, kit !== 'hoops')
      arm(9.5, -30, 10.5, -20 - swing * 4.5 * a, kit !== 'hoops')
    }
    // the torso: wide at the pads, narrow at the belt
    const sh = kit === 'pads' ? 10.8 : 9.2, waist = kit === 'pads' ? 6.5 : 6.8
    // hips: the legs hang from these
    x.fillStyle = pants; line(1.1); rr(x, -waist - 0.2, -22, (waist + 0.2) * 2, 7.5, 2.6); x.fill(); x.stroke()
    x.fillStyle = color; line(1.1); x.beginPath()
    x.moveTo(-waist, -18.5); x.quadraticCurveTo(-waist - 1, -24.5, -sh + 0.6, -29.5); x.quadraticCurveTo(-sh - 0.4, -35, -5, -35.6)
    x.lineTo(5, -35.6); x.quadraticCurveTo(sh + 0.4, -35, sh - 0.6, -29.5); x.quadraticCurveTo(waist + 1, -24.5, waist, -18.5); x.closePath(); x.fill(); x.stroke()
    x.fillStyle = 'rgba(0,0,0,.16)'; x.beginPath(); x.moveTo(2.5, -18.5); x.lineTo(2.5, -35.6); x.lineTo(5, -35.6); x.quadraticCurveTo(sh + 0.4, -35, sh - 0.6, -29.5); x.quadraticCurveTo(waist + 1, -24.5, waist, -15); x.closePath(); x.fill()
    // the shoulder pads catch the light
    x.fillStyle = 'rgba(255,255,255,.13)'; x.beginPath(); x.moveTo(-sh + 1, -30.5); x.quadraticCurveTo(-sh + 1, -34.6, -5, -34.8); x.lineTo(-5, -32); x.quadraticCurveTo(-8, -32, -sh + 1, -30.5); x.fill()
    if (number != null) text(x, String(number), 0, -26.5, { font: DISPLAY, size: P ? (String(number).length > 1 ? 8.4 : 9.4) : String(number).length > 1 ? 10 : 11.5, color: P ? inkOn(color, trim) : trim })
    if ((pose === 'block' || pose === 'stance' || pose === 'wrap') && dir === 'down') { arm(-9.5, -30, -6, -21, kit !== 'hoops'); arm(9.5, -30, 6, -21, kit !== 'hoops') }
    if (carry) { x.fillStyle = '#7a4420'; x.strokeStyle = INK; x.lineWidth = 0.9; x.beginPath(); x.ellipse(-10, -23, 3.6, 5, 0.25, 0, Math.PI * 2); x.fill(); x.stroke() }
  }

  // the head
  const hx = dir === 'side' ? 1 : 0, hy = -41
  if (kit === 'pads') {
    x.save(); x.translate(hx, -39.4); x.scale(0.76, 0.76); x.translate(-hx, -hy)
    const R = 6.9
    x.fillStyle = trim; x.strokeStyle = INK; x.lineWidth = 1.1; circle(x, hx, hy, R); x.fill(); x.stroke()
    x.fillStyle = 'rgba(0,0,0,.14)'; x.beginPath(); x.arc(hx, hy, R, -0.5, 1.5); x.lineTo(hx, hy); x.closePath(); x.fill()
    x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.ellipse(hx - 2.5, hy - 3, 2, 1.1, -0.6, 0, Math.PI * 2); x.fill()
    if (dir === 'up') { x.fillStyle = color; x.fillRect(hx - 1, hy - R + 0.3, 2, R * 2 - 0.6) }
    else if (dir === 'down') {
      x.fillStyle = color; x.fillRect(hx - 1, hy - R + 0.3, 2, 4)
      // the face, dark under the brim, and two bars across it
      x.fillStyle = shade(skin, 0.72); rr(x, hx - 4.5, hy - 2, 9, 6.8, 2.2); x.fill()
      x.fillStyle = '#10141a'; x.fillRect(hx - 3.2, hy - 0.9, 2.3, 1.1); x.fillRect(hx + 0.9, hy - 0.9, 2.3, 1.1)
      x.strokeStyle = '#c9ced2'; x.lineWidth = 1.05; x.beginPath(); x.moveTo(hx - 5.2, hy + 1.5); x.lineTo(hx + 5.2, hy + 1.5); x.moveTo(hx - 4.6, hy + 3.8); x.lineTo(hx + 4.6, hy + 3.8); x.stroke()
    } else {
      x.fillStyle = color; x.fillRect(hx - R + 2, hy - R + 0.9, 7, 1.8)
      x.fillStyle = shade(skin, 0.72); rr(x, hx + 1.2, hy - 2, 5.2, 6, 1.6); x.fill()
      x.strokeStyle = '#c9ced2'; x.lineWidth = 1.05; x.beginPath(); x.moveTo(hx + 1.8, hy + 1); x.lineTo(hx + 8, hy + 1); x.moveTo(hx + 2.2, hy + 3.6); x.lineTo(hx + 7.4, hy + 3.6); x.moveTo(hx + 7.6, hy + 0.4); x.lineTo(hx + 7.4, hy + 4); x.stroke()
      x.fillStyle = 'rgba(0,0,0,.42)'; circle(x, hx - 1.6, hy + 0.8, 1); x.fill()
    }
    x.restore()
  } else {
    x.fillStyle = skin; x.strokeStyle = INK; x.lineWidth = 1.1; circle(x, hx, hy + 1, 6.2); x.fill(); x.stroke()
    x.fillStyle = '#17120e'; x.beginPath(); x.arc(hx, hy + 0.4, 6.2, Math.PI, 0); x.closePath(); x.fill()
    if (dir === 'up' && kit === 'plain') {
      x.fillStyle = '#17120e'; circle(x, hx, hy + 1, 6.2); x.fill()
      const look = pose && pose.endsWith('-l') ? -1 : pose && pose.endsWith('-r') ? 1 : 0
      if (look) { x.fillStyle = skin; x.beginPath(); x.ellipse(hx + look * 3.9, hy + 2, 2.3, 3.8, 0, 0, Math.PI * 2); x.fill() }
    }
    if (dir === 'down') { x.fillStyle = '#17120e'; circle(x, hx - 2.2, hy + 2, 0.7); circle(x, hx + 2.2, hy + 2, 0.7); x.fill(); circle(x, hx - 2.2, hy + 2, 0.7); x.fill() }
  }
}
// A man's last name under his feet, small. Painted once per name.
const tags = new Map()
// Names stay sharp: with the pixel look on, the stage opens a queue for the frame (tagLayerBegin), every name drawn into
// the game's own picture is collected instead (where it lands on screen, with the camera's move and zoom), and the stage
// paints them on its full-resolution HUD layer (tagLayerFlush). Anything drawn on another canvas still paints in place
let TAG_Q = null, TAG_CANVAS = null
export function tagLayerBegin(canvas) { TAG_Q = []; TAG_CANVAS = canvas }
export function tagLayerFlush(hctx) {
  const q = TAG_Q; TAG_Q = null; TAG_CANVAS = null
  if (!q) return
  for (const t of q) { hctx.globalAlpha = t.a; hctx.drawImage(t.c, t.x, t.y, t.w, t.h) }
  hctx.globalAlpha = 1
}
export function nameTag(ctx, view, px, py, name, k = 1) {
  if (!name) return
  let c = tags.get(name)
  if (!c && typeof document !== 'undefined') {
    if (tags.size > 80) tags.clear()
    const R = 3, H = 13
    const m = document.createElement('canvas').getContext('2d')
    m.font = `9.4px ${LABEL}`
    const W = Math.ceil(m.measureText(name).width + 6)
    c = document.createElement('canvas'); c.width = W * R; c.height = H * R; c.w = W; c.h = H
    const x = c.getContext('2d')
    x.scale(R, R); x.font = `9.4px ${LABEL}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'
    x.strokeStyle = 'rgba(6,10,12,.82)'; x.lineWidth = 2.2; x.strokeText(name, W / 2, H / 2)
    x.fillStyle = 'rgba(255,255,255,.94)'; x.fillText(name, W / 2, H / 2)
    tags.set(name, c)
  }
  if (!c) return
  const x0 = px - (c.w * k) / 2, y0 = py + 1.5 * k
  if (TAG_Q && ctx.canvas === TAG_CANVAS) {
    // (to the stage's sharp layer: the game's units, 360 across, through this frame's camera)
    const m = ctx.getTransform(), base = ctx.canvas.width / 360, sc = m.a / base
    TAG_Q.push({ c, x: (m.a * x0 + m.c * y0 + m.e) / base, y: (m.b * x0 + m.d * y0 + m.f) / base, w: c.w * k * sc, h: c.h * k * sc, a: ctx.globalAlpha })
    return
  }
  ctx.drawImage(c, x0, y0, c.w * k, c.h * k)
}
// (queued, not painted: the host paints what fits between frames, bakeSome below, so a long warm list can't cost a frame)
export function warmAthlete(opts) { queueBake({ pose: null, ...opts }) }
// The quarterback after the snap, by how long it's been since the ball got to him: three short steps back, then set.
// (Only the picture: where he is and when the ball goes are the game's.)
const QB_STANCE = { pose: 'qb-set', step: null }, QB_STEPS = [1, 0, 3]
export const QB_DROP_MS = 240
export function qbStance(ms) {
  if (ms >= QB_DROP_MS) { QB_STANCE.pose = 'qb-set'; QB_STANCE.step = null } else { QB_STANCE.pose = 'qb-drop'; QB_STANCE.step = QB_STEPS[Math.floor(Math.max(0, ms) / 80)] }
  return QB_STANCE
}
// His frames, one a call, before the snap, so the drop doesn't cost a frame when it comes
const qbWarm = new Set()
export function warmQb(look) {
  const key = [look.color, look.trim, look.pants, look.skin, look.number, look.kit, resFor()].join('|')
  if (qbWarm.has(key)) return
  const has = o => sprites.has(spriteId(o, resFor()))
  const up = { kit: 'pads', ...look, dir: 'up', carry: false, fallStage: 0 }
  for (const o of [{ ...up, pose: 'qb-drop', step: 1 }, { ...up, pose: 'qb-drop', step: 0 }, { ...up, pose: 'qb-drop', step: 3 }, { ...up, pose: 'qb-set', step: null }, { ...up, pose: 'qb-hold', step: null, dir: 'side', number: null, carry: true }]) {
    if (!has(o)) { spriteOf(o); return }
  }
  if (qbWarm.size > 40) qbWarm.clear()
  qbWarm.add(key)
}
const sprites = new Map()
const BOX = 56, FEET = 50
const RES_TIERS = [1.5, 2, 2.5, 3, 4, 5]
// past this the looks unused longest go, a few at a time (11 on 11, each number his own sprite, needs the room on a big screen)
const SPRITE_BYTES = (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory < 4) ? 40e6 : 90e6
let spriteBytes = 0, lastPx = 2, spriteTick = 0, bakeSpent = 0, bakeRoom = Infinity
// how many sprite pixels a man needs: his biggest on this camera (at the near end), on this screen
// (one per camera, so a look warmed up before the snap is the same sprite the play draws)
const resFor = () => {
  // (past 2x there's sharpness to spare: a man's near-end size on the nose, a third less to paint and to hold)
  const need = CAM.zoom * CAM.men * (lastPx > 2 ? 1 : 1.25) * lastPx
  return RES_TIERS.find(t => t >= need) ?? RES_TIERS[RES_TIERS.length - 1]
}
// (every man, every frame: no array to throw away. A missing field reads the same as a null one.)
const sk = v => (v == null ? '' : v)
const spriteId = (o, res) => `${sk(o.color)}|${sk(o.trim)}|${sk(o.pants)}|${sk(o.skin)}|${sk(o.number)}|${sk(o.dir)}|${sk(o.step)}|${sk(o.kit)}|${sk(o.carry)}|${sk(o.pose)}|${o.fallStage ?? 0}|${res}`
// (the small man's outline is worked out on these two, so it costs one new canvas a sprite, not three)
let scratchA = null, scratchB = null
function spriteOf(opts, res = resFor()) {
  const id = spriteId(opts, res)
  let c = sprites.get(id)
  if (c) {
    // (most recently used goes last, once a frame, so what's on the field is the last thing to go)
    if (c.used !== spriteTick) { c.used = spriteTick; sprites.delete(id); sprites.set(id, c) }
    return c
  }
  if (typeof document === 'undefined') return c
  const px = BOX * res
  while (spriteBytes > SPRITE_BYTES && sprites.size) {
    const [k, old] = sprites.entries().next().value
    if (old.used === spriteTick) break
    spriteBytes -= old.width * old.height * 4
    sprites.delete(k)
  }
  const small = res <= 2
  if (small) {
    if (!scratchA || scratchA.width !== px) {
      scratchA = document.createElement('canvas'); scratchA.width = px; scratchA.height = px
      scratchB = document.createElement('canvas'); scratchB.width = px; scratchB.height = px
    }
    c = scratchA
  } else { c = document.createElement('canvas'); c.width = px; c.height = px }
  const x = c.getContext('2d')
  x.setTransform(1, 0, 0, 1, 0, 0); if (small) x.clearRect(0, 0, px, px)
  x.scale(res, res); x.translate(BOX / 2, FEET)
  if (opts.kit === 'pads' || opts.kit === 'plain') paintPads(x, opts); else paintAthlete(x, opts)
  // a small man: his outline goes round once more, so he still reads at thirty pixels tall (done once, here)
  if (small) {
    const t = scratchB.getContext('2d')
    t.globalCompositeOperation = 'copy'; t.drawImage(c, 0, 0); t.globalCompositeOperation = 'source-in'; t.fillStyle = 'rgb(8,12,16)'; t.fillRect(0, 0, px, px)
    const out = document.createElement('canvas'); out.width = px; out.height = px
    const o = out.getContext('2d'), d = Math.max(0.7, res * 0.34)
    for (const [dx, dy] of [[-d, 0], [d, 0], [0, -d], [0, d]]) o.drawImage(scratchB, dx, dy)
    o.drawImage(c, 0, 0)
    c = out
  }
  c.used = spriteTick
  sprites.set(id, c)
  spriteBytes += px * px * 4
  return c
}
// ── Painting sprites without costing a frame ──
// A look the field hasn't needed yet is painted between frames from a queue. If a man needs one right now and this
// frame has already spent its time, he wears the nearest look there is for a frame or two (same team, same way, usually the
// same pose) and his own is painted next. The host calls spriteFrame at the top of a frame, bakeSome at the end.
const nearLook = new Map(), bakeQ = [], bakeIds = new Set()
let liveCtx = null
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : 0)
function queueBake(o) {
  if (typeof document === 'undefined') return
  const id = spriteId(o, resFor())
  if (sprites.has(id) || bakeIds.has(id) || bakeQ.length > 240) return
  bakeIds.add(id); bakeQ.push(o)
}
const remember = (o, c) => { nearLook.set(`${o.color}|${o.dir}|${o.kit}|${o.pose}|${o.step}`, c); nearLook.set(`${o.color}|${o.dir}|${o.kit}`, c) }
function bakeOne(o) { const a = nowMs(), c = spriteOf(o); bakeSpent += nowMs() - a; if (c) remember(o, c); return c }
export function spritePx(px) { lastPx = px }
// room: ms this frame's men may spend on sprites they need (Infinity: paint them all, nobody's playing yet)
export function spriteFrame(room = 4, live = null) { spriteTick++; bakeSpent = 0; bakeRoom = room; liveCtx = live }
// the queue, for up to ms. Returns how many are still waiting.
export function bakeSome(ms = 2) {
  const end = nowMs() + ms
  while (bakeQ.length && nowMs() < end) {
    const o = bakeQ.shift()
    bakeIds.delete(spriteId(o, resFor()))
    bakeOne(o)
  }
  return bakeQ.length
}
function lookFor(o, live) {
  const id = spriteId(o, resFor()), c = sprites.get(id)
  if (c) { if (c.used !== spriteTick) { c.used = spriteTick; sprites.delete(id); sprites.set(id, c) } return c }
  if (!live || bakeSpent < bakeRoom) return bakeOne(o)   // (going into a baked picture: it stays there, so it has to be his own)
  const near = nearLook.get(`${o.color}|${o.dir}|${o.kit}|${o.pose}|${o.step}`) ?? nearLook.get(`${o.color}|${o.dir}|${o.kit}`)
  if (!near) return bakeOne(o)
  queueBake(o)
  return near
}
const SKINS = ['#8d5a3b', '#5e3c22', '#7a5030', '#c09060', '#f0c4a0', '#9a6840', '#5e3c22', '#a87548']
export const skinOf = i => SKINS[Math.abs(i) % SKINS.length]
// which way someone's facing, from how they're moving on the field (dx, dy in field units)
export const dirOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')

// x, y: the field point under his feet. size: 1 is a player the height the camera gives him at the near end
export function athlete(ctx, view, x, y, { color = '#1b6fd1', trim = '#f4efe6', pants = null, skin = '#8d5a3b', number = null, dir = 'up', step = null, kit = 'pads', carry = false, size = 1, name = null, pose = null, fall = 0, fallX = 0, squat = 0, lift = 0 } = {}) {
  skin = warmSkin(skin)
  const p = tilt(view, x, y)
  const k = p.s * size * (kit === 'pads' ? 0.92 : 1)
  if (view.px) lastPx = view.px
  const fallStage = fall > 0 && !fallX ? (fall < 0.34 ? 1 : fall < 0.67 ? 2 : 3) : 0
  if (!(k > 0) || p.y - FEET * k > view.h) return p   // (past the camera, or off the bottom of the screen)
  // the shadow lies on the field, thrown long and low
  ctx.fillStyle = 'rgba(0,0,0,.3)'
  ctx.beginPath(); ctx.ellipse(p.x + (5 + fallX * fall * 26) * k, p.y + 0.5 * k - fall * 6 * k, (13 + fall * 3) * k, (4 + fall * 5) * k, 0.12, 0, Math.PI * 2); ctx.fill()
  const flip = dir === 'left'
  const c = lookFor({ color, trim, pants: pants ?? (kit === 'pads' ? '#eceae2' : '#20262c'), skin, number: dir === 'up' || dir === 'down' ? number : null, dir: dir === 'left' || dir === 'right' ? 'side' : dir, step, kit, carry, pose, fallStage }, ctx === liveCtx)
  if (!c) return p
  const w = BOX * k, top = p.y - (FEET + lift) * k   // (lift: off the ground, in his own units, his shadow staying down)
  // going down: he pitches over from the feet the way he was going (fallX -1 left, 0 away from the
  // camera, 1 right) and lies flat on the turf. No spin. fall: 0 up, 1 all the way down.
  if (fall > 0 && fallX) {
    const e = 1 - (1 - fall) * (1 - fall)
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(fallX * e * 1.4); if (flip) ctx.scale(-1, 1)
    ctx.drawImage(c, -w / 2, -FEET * k, w, w)
    ctx.restore()
    return p
  }
  // leaning at the camera: the same man, a little shorter on the screen
  if (squat > 0) { const q = w * (1 - squat); ctx.drawImage(c, p.x - w / 2, p.y - FEET * k * (1 - squat), w, q) }
  else if (flip) { ctx.save(); ctx.translate(p.x, 0); ctx.scale(-1, 1); ctx.drawImage(c, -w / 2, top, w, w); ctx.restore() }
  else ctx.drawImage(c, p.x - w / 2, top, w, w)
  if (name) nameTag(ctx, view, p.x, p.y, name, Math.max(0.8, k))
  return p
}

// ── A football in the air ──────────────────────────────────────────────
// A real prolate ball seen from this camera. It flies nose first, so going away from the camera it's
// foreshortened to nearly its round end, and the spiral is the laces and seams turning around the nose,
// not the ball flipping. axis: where the nose points, [right, downfield, up] in any units.
// (Without one, ang: the way it's going on the screen, 0 to the right.) spin: revolutions so far.
// (CAM_U: the screen's up, in the world. CAM_V: the way the camera looks. Both from the camera, above.)
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit3 = a => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / m, a[1] / m, a[2] / m] }
// A DB after a breakup: half of them signal incomplete, half buckle the seatbelt. age: ms since he started. key picks which
export function breakupPose(age, key) {
  if (key % 2) {
    const i = Math.floor(age / 120) % 4
    return ['wave-a', 'wave-m', 'wave-b', 'wave-m'][i]
  }
  // reach up, pull across, click: once, and he holds it
  return age < 240 ? 'belt-a' : age < 400 ? 'belt-m' : 'belt-b'
}
export function airBall(ctx, x, y, { ang = 0, len = 13, spin = 0, axis = null } = {}) {
  const a = unit3(axis ?? [Math.cos(ang), -Math.sin(ang) * CAM_U[1], -Math.sin(ang) * CAM_U[2]])
  const RL = len / 2, RW = len * 0.31
  const ax = a[0], ay = dot3(a, CAM_U), az = dot3(a, CAM_V)
  const major = Math.max(RW, Math.sqrt((RL * RL) * (ax * ax + ay * ay) + (RW * RW) * (az * az)))
  const rot = Math.atan2(-ay, ax)
  ctx.save(); ctx.translate(x, y)
  // the silhouette: pointed along the axis, as round as a circle when it's nose-on
  ctx.save(); ctx.rotate(rot)
  const lens = () => { ctx.beginPath(); ctx.moveTo(-major, 0); ctx.bezierCurveTo(-major * 0.55, -RW * 1.34, major * 0.55, -RW * 1.34, major, 0); ctx.bezierCurveTo(major * 0.55, RW * 1.34, -major * 0.55, RW * 1.34, -major, 0); ctx.closePath() }
  lens(); ctx.fillStyle = '#8f4f22'; ctx.fill()
  ctx.restore()
  ctx.save(); ctx.rotate(rot); lens(); ctx.clip(); ctx.rotate(-rot)
  // lit from above
  ctx.fillStyle = 'rgba(255,214,160,.2)'; ctx.fillRect(-major - 2, -major - 2, major * 2 + 4, major * 0.8)
  ctx.fillStyle = 'rgba(30,12,2,.3)'; ctx.fillRect(-major - 2, RW * 0.34, major * 2 + 4, major + RW)
  // around the axis: the seams and the laces, in the ball's own frame
  const b1 = unit3(cross3(a, CAM_V)), b2 = cross3(a, b1), phi = spin * Math.PI * 2
  const point = (s, q, lift = 1) => {
    const r = Math.sqrt(Math.max(0, 1 - s * s)) * RW * lift, c = Math.cos(q), n = Math.sin(q)
    const P = [a[0] * s * RL + (b1[0] * c + b2[0] * n) * r, a[1] * s * RL + (b1[1] * c + b2[1] * n) * r, a[2] * s * RL + (b1[2] * c + b2[2] * n) * r]
    return [P[0], -dot3(P, CAM_U)]
  }
  const facing = q => -(b1[1] * Math.cos(q) + b2[1] * Math.sin(q)) * CAM_V[1] - (b1[2] * Math.cos(q) + b2[2] * Math.sin(q)) * CAM_V[2]
  const meridian = (q, s0, s1) => { ctx.beginPath(); for (let k = 0; k <= 6; k++) { const [px, py] = point(s0 + ((s1 - s0) * k) / 6, q); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py) } ctx.stroke() }
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(40,18,6,.62)'; ctx.lineWidth = Math.max(0.6, len * 0.035)
  for (const q of [phi + Math.PI / 2, phi + Math.PI, phi + Math.PI * 1.5]) if (facing(q) > 0.02) meridian(q, -0.96, 0.96)
  if (facing(phi) > -0.02) {
    ctx.strokeStyle = '#f6f2e8'; ctx.lineWidth = Math.max(0.7, len * 0.05)
    meridian(phi, -0.36, 0.36)
    ctx.lineWidth = Math.max(0.6, len * 0.042)
    ctx.beginPath()
    for (let k = -2; k <= 2; k++) {
      const s = k * 0.16, [x0, y0] = point(s, phi - 0.42), [x1, y1] = point(s, phi + 0.42)
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1)
    }
    ctx.stroke()
  }
  ctx.restore()
  ctx.rotate(rot); lens(); ctx.strokeStyle = 'rgba(24,10,2,.88)'; ctx.lineWidth = Math.max(0.8, len * 0.05); ctx.stroke()
  ctx.restore()
}
// its shadow on the turf at a field point, the further below it the softer and wider
export function ballShadow(ctx, view, x, y, lift = 0) {
  const p = tilt(view, x, y)
  ctx.fillStyle = `rgba(0,0,0,${(0.38 - Math.min(0.2, lift / 700)).toFixed(2)})`
  if (!(p.s > 0)) return
  ctx.beginPath(); ctx.ellipse(p.x, p.y, (5 + lift * 0.03) * p.s, (2.2 + lift * 0.01) * p.s, 0, 0, Math.PI * 2); ctx.fill()
  return p
}

// ── A field the camera moves along ──────────────────────────────────────────
// paint(x): the whole flat field, len units long, painted once. at: how far down that painting the
// flat view's top edge sits right now. The picture is kept and only redrawn when the camera has moved,
// so a held camera costs one drawImage and a moving one its strips.
const rolls = new Map()
export function rollingField(ctx, view, { key, len, paint, at, under, over, strips = 44, res = 0.8 }) {
  if (typeof document === 'undefined') return
  const id = `${key}|${view.h}|${view.px}|${CAM.id}|${view.empty ? 'E' : ''}`
  let r = rolls.get(id)
  if (!r) {
    if (rolls.size > 3) rolls.clear()
    const flat = document.createElement('canvas')
    flat.width = Math.round(view.w * 1.5 * view.px * res); flat.height = Math.round(len * view.px * res)
    const f = flat.getContext('2d', { alpha: false })
    f.scale(view.px * res, view.px * res); f.translate(view.w * 0.25, 0)
    paint(f)
    const pic = document.createElement('canvas')
    pic.width = Math.round(view.w * view.px); pic.height = Math.round(view.h * view.px)
    const p = pic.getContext('2d', { alpha: false })
    p.scale(view.px, view.px)
    r = { flat, pic, p, at: null, rows: null }
    rolls.set(id, r)
  }
  // moving: the quick strips. Held still: once more, in fine ones, so the sidelines run true.
  const moved = r.at !== at
  if (moved || !r.fine) {
    const p = r.p, hy = horizon(view), H = view.h
    const rowsOf = n => {
      const rows = []
      for (let i = 0; i < n; i++) {
        const a = hy + ((H - hy) * i) / n, b = hy + ((H - hy) * (i + 1)) / n + 0.6
        const fa = untilt(view, view.w / 2, a).y, fb = untilt(view, view.w / 2, b).y
        const s = (tilt(view, view.w / 2, fa).g + tilt(view, view.w / 2, fb).g) / 2
        rows.push({ a, h: b - a, fa, fh: Math.max(0.5, fb - fa), dw: view.w * 1.5 * s })
      }
      return rows
    }
    r.quick ??= rowsOf(strips)
    r.finer ??= rowsOf(Math.round((H - hy) * view.px * 0.4))
    under?.(p)
    const sc = r.flat.height / len
    for (const q of moved && r.at !== null ? r.quick : r.finer) p.drawImage(r.flat, 0, (q.fa + at) * sc, r.flat.width, q.fh * sc, view.w / 2 - q.dw / 2, q.a, q.dw, q.h)
    over?.(p)
    r.fine = !moved || r.at === null
    r.at = at
  }
  ctx.drawImage(r.pic, 0, 0, view.w, view.h)
}
// a painted line straight across the field, at a flat y, through the camera
export function turfLine(ctx, view, x0, x1, y, color, width = 3) {
  const a = tilt(view, x0, y), b = tilt(view, x1, y)
  ctx.fillStyle = color
  ctx.fillRect(a.x, a.y - (width * a.s) / 2, b.x - a.x, width * a.s)
  // the line to gain has the chain crew's stick at the end of it, just over the sideline
  if (color === '#f7d64a' && b.x < view.w - 4) sideStick(ctx, b.x + 9 * b.g, b.y, b.g)
}
function sideStick(ctx, x, y, g) {
  const tall = 36 * g, wd = Math.max(1, 1.9 * g)
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x, y - 0.5, tall * 0.42, Math.max(1, 1.6 * g))
  ctx.fillStyle = '#f2f4f1'; ctx.fillRect(x - wd / 2, y - tall, wd, tall)
  ctx.fillStyle = '#ff6a13'; ctx.fillRect(x - wd * 2.6, y - tall - 8 * g, wd * 5.2, 9 * g)
}
