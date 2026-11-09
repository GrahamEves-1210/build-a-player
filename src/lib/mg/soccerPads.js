// The controls of a stick game (the Get a Bucket layout), for the soccer games played with the shared shooting model
// (soccer.js: shooter, strikeOf, shotAt, keeperSave): the left half of the screen is the stick, the right two buttons.
// Keys: arrows / WASD aim, SPACE the big button, E the small one (MgStage sends them as 'key' S and P).
//   newCtl()                         the controls' state
//   control(ctl, a, vh, t, { a, b })  a host input; a(down) / b(down) fire on a button's press (true) and let-go (false)
//   stickOf(ctl)                     the stick now, -1..1 each way (up +). Keys give the full corner, not a shortened one
//   drawControls(ctx, view, ctl, { stick, a, b }, live, t)   the stick and the buttons on a phone, keycaps on a computer
//   tip(ctx, view, str, y, size)     a line over the controls
import { clamp, text, rr, circle, keyCap, LABEL, DISPLAY } from './kit.js'

// ── The controls ────────────────────────────────────────────────────────────
const LAYOUT = new Map()
export function padsOf(h) {
  let c = LAYOUT.get(h)
  if (!c) { c = { stick: { x: 82, y: h - 96, R: 44 }, a: { x: 360 - 66, y: h - 92, r: 42 }, b: { x: 360 - 162, y: h - 62, r: 28 } }; LAYOUT.set(h, c) }
  return c
}
export const newCtl = () => ({ tid: null, ox: 0, oy: 0, tx: 0, ty: 0, ax: 0, ay: 0, ext: false, keys: { L: 0, R: 0, U: 0, D: 0 }, aId: null, bId: null, aLit: -999, bLit: -999, out: { x: 0, y: 0 } })
// a = the host's input. on: { a(down), b(down) } with down true on the press, false on the let-go. vh: the view's height
export function control(ctl, a, vh, t, on) {
  if (a.kind === 'stick') { ctl.ax = clamp(a.x, -1, 1); ctl.ay = clamp(a.y, -1, 1); ctl.ext = true; return }
  if (a.kind === 'key' || a.kind === 'keyup') {
    const k = a.zone, dn = a.kind === 'key'
    if (k === 'S') { if (dn && ctl.aId == null) { ctl.aId = 'key'; ctl.aLit = t; on.a?.(true) } else if (!dn && ctl.aId === 'key') { ctl.aId = null; on.a?.(false) } return }
    if (k === 'P') { if (dn && ctl.bId == null) { ctl.bId = 'key'; ctl.bLit = t; on.b?.(true) } else if (!dn && ctl.bId === 'key') { ctl.bId = null; on.b?.(false) } return }
    if (k in ctl.keys) ctl.keys[k] = dn ? 1 : 0
    return
  }
  const id = a.id ?? 0, C = padsOf(vh)
  if (a.kind === 'down') {
    if (a.x < 180) { ctl.tid = id; ctl.ox = a.x; ctl.oy = a.y; ctl.tx = 0; ctl.ty = 0 }
    else if (on.b && Math.hypot(a.x - C.b.x, a.y - C.b.y) < C.b.r + 14) { if (ctl.bId == null) { ctl.bId = id; ctl.bLit = t; on.b(true) } }
    else if (ctl.aId == null) { ctl.aId = id; ctl.aLit = t; on.a?.(true) }
  } else if (a.kind === 'move') {
    if (id === ctl.tid) { const R = C.stick.R; ctl.tx = clamp((a.x - ctl.ox) / R, -1.4, 1.4); ctl.ty = clamp(-(a.y - ctl.oy) / R, -1.4, 1.4); const m = Math.hypot(ctl.tx, ctl.ty); if (m > 1) { ctl.tx /= m; ctl.ty /= m } }
  } else if (a.kind === 'up') {
    if (id === ctl.tid) { ctl.tid = null; ctl.tx = 0; ctl.ty = 0 }
    else if (id === ctl.aId) { ctl.aId = null; on.a?.(false) }
    else if (id === ctl.bId) { ctl.bId = null; on.b?.(false) }
  }
}
// where the stick is now (-1..1 each way, up is +)
export function stickOf(ctl) {
  const o = ctl.out
  if (ctl.tid != null) { o.x = ctl.tx; o.y = ctl.ty }
  else if (ctl.ext) { o.x = ctl.ax; o.y = ctl.ay }
  else { o.x = ctl.keys.R - ctl.keys.L; o.y = ctl.keys.U - ctl.keys.D }   // (a corner on the keys is the corner: aimTo reads each way on its own)
  return o
}
// the stick and the two buttons on a phone; the keys on a computer. labels: { stick, a, b } (b null: one button)
export function drawControls(ctx, view, ctl, labels, live = true, t = 0) {
  const C = padsOf(view.h), s = ctl.out
  if (view.keys) {
    const y = view.h - 22
    ctx.fillStyle = 'rgba(6,10,12,.72)'; rr(ctx, 8, y - 15, view.w - 16, 30, 5); ctx.fill()
    keyCap(ctx, 34, y, 'ARROWS', ctl.keys.L || ctl.keys.R || ctl.keys.U || ctl.keys.D)
    text(ctx, labels.stick, 60, y + 1, { size: 13, align: 'left', track: 1 })
    keyCap(ctx, 140, y, 'SPACE', ctl.aId === 'key'); text(ctx, labels.a, 178, y + 1, { size: 13, align: 'left', track: 1 })
    if (labels.b) { keyCap(ctx, 252, y, 'E', ctl.bId === 'key'); text(ctx, labels.b, 268, y + 1, { size: 13, align: 'left', track: 1 }) }
    return
  }
  const ax = ctl.tid != null ? ctl.ox : C.stick.x, ay = ctl.tid != null ? ctl.oy : C.stick.y, R = C.stick.R
  ctx.globalAlpha = live ? 1 : 0.4
  ctx.fillStyle = 'rgba(6,10,12,.42)'; circle(ctx, ax, ay, R + 6); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2; circle(ctx, ax, ay, R + 6); ctx.stroke()
  ctx.fillStyle = ctl.tid != null || Math.hypot(s.x, s.y) > 0.1 ? '#e9eef0' : 'rgba(233,238,240,.7)'
  circle(ctx, ax + s.x * R, ay - s.y * R, 19); ctx.fill()
  ctx.strokeStyle = 'rgba(6,10,12,.5)'; ctx.lineWidth = 1.5; ctx.stroke()
  if (ctl.tid == null) text(ctx, labels.stick, ax, ay + R + 18, { size: 12, track: 1.2, color: 'rgba(255,255,255,.62)' })
  const btn = (c, lit, label, size) => {
    ctx.fillStyle = lit ? view.accent : 'rgba(28,38,43,.9)'; circle(ctx, c.x, c.y, c.r); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.stroke()
    text(ctx, label, c.x, c.y + 1, { font: DISPLAY, size, color: lit ? '#06100c' : '#fff' })
  }
  btn(C.a, ctl.aId != null && live, labels.a, labels.a.length > 6 ? 15 : 18)
  if (labels.b) btn(C.b, (ctl.bId != null || t - ctl.bLit < 140) && live, labels.b, 14)
  ctx.globalAlpha = 1
}
// a line in the picture over the controls (the opening words, a tip)
export function tip(ctx, view, str, y = view.h - (view.keys ? 60 : 168), size = 15) {
  ctx.font = `${size}px ${LABEL}`
  const tw = ctx.measureText(str).width + 24 + str.length * 1.4
  ctx.fillStyle = 'rgba(6,10,12,.72)'; rr(ctx, view.w / 2 - tw / 2, y - 14, tw, 28, 4); ctx.fill()
  text(ctx, str, view.w / 2, y + 1, { size, track: 1.4, color: '#fff' })
}
