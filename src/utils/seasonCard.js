import { IS_APP, shareNative } from '../lib/platform'

// The season share card: a finished season as one poster, both sports.
//
//   drawSeasonCard(card, { format })     a canvas: 'story' 1080x1920 (Stories,
//                                        TikTok) or 'square' 1080x1080
//   shareCardImage(blob, { title, text, filename, save })
//                                        the phone's share sheet with the image
//                                        (app: Capacitor; web: Web Share with a
//                                        file), else a download. Resolves
//                                        'shared' | 'aborted' | 'downloaded' | 'error'
//   nflSeasonCard(...), bucketSeasonCard(...)   a season result → the card
//
// The card (only `hero` is needed; whatever's missing, the layout closes up):
//   { sport: 'nfl' | 'bucket', name, tag, hero: { value, label }, sub,
//     record, headline, tier: 'champ' | 'playoffs' | 'miss', ribbons: [..],
//     team: { name, short, color, color2, logo }, stats: [{ v, k }],
//     chips: [{ label, name, photo, faceCenter, val }], site }
// Career can hand in its own: hero { value: legacy, label: 'LEGACY' }, a career
// W-L as the record, rings and awards as ribbons, the build as chips.

export const SITE = 'build-a-player.com'
const SIZES = { story: [1080, 1920], square: [1080, 1080] }
const F = {
  num:  '"BAP Anton", Anton, Impact, "Arial Narrow Bold", sans-serif',
  lbl:  '"BAP Bebas", "Bebas Neue", "BAP Anton", Impact, sans-serif',
  mark: '"BAP Wordmark", "BAP Anton", Impact, sans-serif',
}
// each sport's own dark and accent (the app's --ag-bg, --ag-a1 / orange, --ag-accent)
const SPORT = {
  nfl:    { base: [5, 7, 5], brand: [73, 213, 189], em: [149, 213, 178], word: 'PLAYER' },
  bucket: { base: [7, 5, 4], brand: [251, 146, 60], em: [249, 115, 22], word: 'BUCKET' },
}
const WHITE = [255, 255, 255]
const GOLD = ['#f8e7a6', '#f2d675', '#d4af37']
const GRADES = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S']
const gradeOf = v => GRADES[Math.max(0, Math.min(11, Math.round(v ?? 0)))]
// the game's grade colors (ReportCard), a B- always green
function gradeColor(v0) {
  const v = Math.round(v0 ?? 0)
  return v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444'
}

// ── Color ────────────────────────────────────────────────────────────────────
const hex = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255] }
const lum = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
// the team's color for the lights: its first, or its second when the first is
// near black (Nets, Spurs); the sport's own accent without a team
function teamTint(team, brand) {
  const a = hex(team?.color), b = hex(team?.color2)
  if (a && lum(a) >= .07) return a
  if (b && lum(b) >= .07) return b
  return a ?? brand
}
// the same color lifted until it reads on the dark card
const lift = (c, to = .5) => { let x = c; for (let i = 0; i < 14 && lum(x) < to; i++) x = mix(x, WHITE, .12); return x }

// ── Fonts and images ─────────────────────────────────────────────────────────
async function loadFonts() {
  if (!document.fonts?.load) return
  const want = [[`400 200px ${F.num}`, '0123456789–-'], [`400 60px ${F.lbl}`, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'], [`900 40px ${F.mark}`, 'BUILD-A-PLAYERCKET']]
  await Promise.all(want.map(([f, t]) => document.fonts.load(f, t).catch(() => {})))
  await document.fonts.ready
}

const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))])
function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}
// only images that can't taint the card (a tainted canvas can't be saved or shared)
function clean(img) {
  if (!img) return null
  try {
    const c = document.createElement('canvas'); c.width = c.height = 2
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1)
    return img
  } catch { return null }
}
async function safeImage(src) {
  if (!src) return null
  const img = clean(await withTimeout(loadImage(src), 6000))
  if (img || !/^https?:/.test(src)) return img
  // a copy cached without its CORS headers: ask once more under its own URL
  return clean(await withTimeout(loadImage(`${src}${src.includes('?') ? '&' : '?'}card=1`), 6000))
}
// the game's stand-in faces aren't a photo of the player: initials instead
const realPhoto = src => (src && !/\/generic(dark|light)\./.test(src) ? src : null)

// ── Text ─────────────────────────────────────────────────────────────────────
const font = (ctx, size, fam = F.lbl, weight = 400) => { ctx.font = `${weight} ${size}px ${fam}` }
function width(ctx, s, sp) {
  if (!sp) return ctx.measureText(s).width
  const ch = [...s]
  return ch.reduce((w, c) => w + ctx.measureText(c).width, 0) + sp * (ch.length - 1)
}
// letter spacing by hand (Safari's canvas has none); shrinks to fit maxW
function say(ctx, s, x, y, { size, fam = F.lbl, weight = 400, color = '#fff', align = 'center', sp = 0, maxW = 0 }) {
  s = String(s ?? '')
  font(ctx, size, fam, weight)
  let w = width(ctx, s, sp)
  if (maxW && w > maxW) { const k = maxW / w; size *= k; sp *= k; font(ctx, size, fam, weight); w = width(ctx, s, sp) }
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color
  if (!sp) ctx.fillText(s, cx, y)
  else for (const c of s) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + sp }
  return { w, size }
}
// split a line into at most `max` lines that fit
function wrap(ctx, s, maxW, sp, max = 2) {
  const words = String(s).split(' '), lines = []
  let cur = ''
  for (const wd of words) {
    const t = cur ? `${cur} ${wd}` : wd
    if (cur && width(ctx, t, sp) > maxW && lines.length < max - 1) { lines.push(cur); cur = wd } else cur = t
  }
  if (cur) lines.push(cur)
  return lines
}
const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i
function lastName(full) {
  const p = String(full || '').trim().split(/\s+/)
  while (p.length > 1 && SUFFIX.test(p[p.length - 1])) p.pop()
  return (p.length > 1 ? p.slice(1).join(' ') : p[0] || '').toUpperCase()
}
const initials = full => String(full || '').split(/\s+/).filter(w => w && !SUFFIX.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'

// ── The stage: dark, the team's color, two banks of floodlights ─────────────
let grainTile = null
function grain() {
  if (grainTile) return grainTile
  const c = document.createElement('canvas'); c.width = c.height = 160
  const x = c.getContext('2d'), d = x.createImageData(160, 160)
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 10 }
  x.putImageData(d, 0, 0)
  return (grainTile = c)
}

function fixture(ctx, x, y, s, tilt, glow) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt)
  const w = 150 * s, h = 58 * s
  ctx.fillStyle = 'rgba(14,16,15,.92)'
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 8 * s); else ctx.rect(-w / 2, -h / 2, w, h)   // (no roundRect before iOS 16)
  ctx.fill()
  ctx.globalCompositeOperation = 'lighter'
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    const lx = -w / 2 + w * (c + .5) / 4, ly = -h / 2 + h * (r + .5) / 2
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 22 * s)
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.32, 'rgba(255,255,255,.9)'); g.addColorStop(.42, rgba(glow, .5)); g.addColorStop(1, rgba(glow, 0))
    ctx.fillStyle = g; ctx.fillRect(lx - 22 * s, ly - 22 * s, 44 * s, 44 * s)
  }
  ctx.restore()
}

function drawStage(ctx, W, H, { base, tint, logo, logoAt }) {
  ctx.fillStyle = rgba(base); ctx.fillRect(0, 0, W, H)
  // the team's color washing down from the lights
  const wash = ctx.createLinearGradient(0, 0, 0, H * .72)
  wash.addColorStop(0, rgba(tint, .46)); wash.addColorStop(.42, rgba(tint, .14)); wash.addColorStop(1, rgba(tint, 0))
  ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H)
  // the team's logo, huge and faint, behind the number
  if (logo && logoAt) {
    const s = logoAt.size, k = Math.min(s / logo.width, s / logo.height)
    ctx.save(); ctx.globalAlpha = .07
    ctx.drawImage(logo, logoAt.x - logo.width * k / 2, logoAt.y - logo.height * k / 2, logo.width * k, logo.height * k)
    ctx.restore()
  }
  // a bank of lights high in each corner, beams crossing toward the middle
  const glow = mix(tint, WHITE, .62), u = W / 1080
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  for (const side of [-1, 1]) {
    const sx = W / 2 + side * W * .43, sy = 60 * u
    for (const [aim, spread, a] of [[.06, .05, .13], [.22, .035, .09], [-.16, .03, .06]]) {
      const tx = W / 2 - side * W * aim, ty = H
      const ang = Math.atan2(ty - sy, tx - sx), len = Math.hypot(tx - sx, ty - sy)
      const g = ctx.createLinearGradient(sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len)
      g.addColorStop(0, rgba(glow, a)); g.addColorStop(.55, rgba(glow, a * .3)); g.addColorStop(1, rgba(glow, 0))
      ctx.fillStyle = g
      ctx.beginPath(); ctx.moveTo(sx, sy)
      ctx.lineTo(sx + Math.cos(ang - spread) * len, sy + Math.sin(ang - spread) * len)
      ctx.lineTo(sx + Math.cos(ang + spread) * len, sy + Math.sin(ang + spread) * len)
      ctx.closePath(); ctx.fill()
    }
    const r = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * .55)
    r.addColorStop(0, 'rgba(255,255,255,.42)'); r.addColorStop(.1, rgba(glow, .22)); r.addColorStop(.45, rgba(tint, .06)); r.addColorStop(1, rgba(tint, 0))
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H)
  }
  ctx.restore()
  for (const side of [-1, 1]) fixture(ctx, W / 2 + side * W * .43, 60 * u, u, side * -.32, glow)
  // dark edges, a darker floor for the footer
  const v = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .32, W / 2, H * .5, Math.max(W, H) * .78)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.62)')
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H)
  const floor = ctx.createLinearGradient(0, H * .78, 0, H)
  floor.addColorStop(0, rgba(base, 0)); floor.addColorStop(1, rgba(base, .9))
  ctx.fillStyle = floor; ctx.fillRect(0, H * .78, W, H * .22)
  // grain, so the gradients don't band once an app re-compresses the image
  ctx.save(); ctx.fillStyle = ctx.createPattern(grain(), 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore()
}

// ── Pieces ───────────────────────────────────────────────────────────────────
// the big number: white with the team's light glowing behind it
function bigNumber(ctx, s, x, baseline, size, tint, align = 'center') {
  font(ctx, size, F.num)
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic'
  const asc = ctx.measureText(s).actualBoundingBoxAscent || size * .86
  const g = ctx.createLinearGradient(0, baseline - asc, 0, baseline)
  g.addColorStop(0, '#ffffff'); g.addColorStop(.6, '#ffffff'); g.addColorStop(1, rgba(mix(WHITE, lift(tint, .5), .16)))
  ctx.save()
  ctx.shadowColor = rgba(tint, .6); ctx.shadowBlur = size * .18
  ctx.fillStyle = g; ctx.fillText(s, x, baseline)
  ctx.restore()
  ctx.fillStyle = g; ctx.fillText(s, x, baseline)
  ctx.textAlign = 'left'
}
const ascentOf = (ctx, s, size, fam = F.num) => { font(ctx, size, fam); return ctx.measureText(s).actualBoundingBoxAscent || size * .86 }
// the team's logo in a soft spotlight, so a dark logo (Jets, Raiders) still reads
function teamLogo(ctx, logo, x, y, w, h) {
  const cx = x + w / 2, cy = y + h / 2, r = Math.max(w, h) * .75
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(.5, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.drawImage(logo, x, y, w, h)
}

// a gold tag, slanted like the game's broadcast tags
function ribbonWidth(ctx, s, h) { font(ctx, h * .62); return width(ctx, s, h * .07) + h * 1.15 }
function ribbon(ctx, s, x0, cy, h) {
  const w = ribbonWidth(ctx, s, h), sk = h * .3, y0 = cy - h / 2
  const g = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h)
  g.addColorStop(0, GOLD[0]); g.addColorStop(.45, GOLD[1]); g.addColorStop(1, GOLD[2])
  ctx.save()
  ctx.shadowColor = 'rgba(212,175,55,.5)'; ctx.shadowBlur = h * .55
  ctx.beginPath(); ctx.moveTo(x0 + sk, y0); ctx.lineTo(x0 + w, y0); ctx.lineTo(x0 + w - sk, y0 + h); ctx.lineTo(x0, y0 + h); ctx.closePath()
  ctx.fillStyle = g; ctx.fill()
  ctx.restore()
  say(ctx, s, x0 + w / 2, cy + h * .22, { size: h * .62, sp: h * .07, color: '#1d1503' })
  return w
}
function ribbons(ctx, list, x, cy, h, align = 'center', gap = h * .4) {
  const ws = list.map(s => ribbonWidth(ctx, s, h))
  const total = ws.reduce((a, b) => a + b, 0) + gap * (list.length - 1)
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x
  list.forEach((s, i) => { ribbon(ctx, s, cx, cy, h); cx += ws[i] + gap })
}

// one trait's player: a round headshot (initials without one), the grade, the
// last name and the trait under it
function chip(ctx, c, img, cx, top, A, { tint, base, nameSize, labelSize, colW }) {
  const r = A / 2, cy = top + r
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  const bg = ctx.createRadialGradient(cx, cy - r * .35, r * .1, cx, cy, r)
  bg.addColorStop(0, rgba(mix(tint, base, .45))); bg.addColorStop(1, rgba(mix(tint, base, .85)))
  ctx.fillStyle = bg; ctx.fill()
  ctx.clip()
  if (img) {
    // like the game's avatar: a little larger than the circle, the head at the top
    const bw = A * .95, bh = A * 1.1, bx = cx - bw / 2, by = top + A + A * .035 - bh
    const k = Math.max(bw / img.width, bh / img.height), iw = img.width * k, ih = img.height * k
    const [px, py] = c.faceCenter ? [c.faceCenter[0] / 100, c.faceCenter[1] / 100] : [.5, 0]
    ctx.drawImage(img, bx + (bw - iw) * px, by + (bh - ih) * py, iw, ih)
  } else {
    say(ctx, initials(c.name), cx, cy + A * .15, { size: A * .4, fam: F.num, color: 'rgba(255,255,255,.9)' })
  }
  ctx.restore()
  ctx.beginPath(); ctx.arc(cx, cy, r - A * .012, 0, Math.PI * 2)
  ctx.lineWidth = Math.max(2, A * .025); ctx.strokeStyle = rgba(lift(tint, .55), .55); ctx.stroke()
  if (c.val != null) {
    const g = gradeOf(c.val), br = A * .2, bx = cx + r * .74, by = cy + r * .74
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2)
    ctx.fillStyle = gradeColor(c.val); ctx.fill()
    ctx.lineWidth = A * .04; ctx.strokeStyle = rgba(base); ctx.stroke()
    say(ctx, g, bx, by + br * .37, { size: br * (g.length > 1 ? 1.02 : 1.15), color: '#07120a' })
  }
  say(ctx, lastName(c.name), cx, top + A + nameSize * 1.12, { size: nameSize, sp: nameSize * .04, maxW: colW - 8 })
  if (c.label) say(ctx, String(c.label).split('/')[0].toUpperCase(), cx, top + A + nameSize * 1.12 + labelSize * 1.2, { size: labelSize, sp: labelSize * .12, color: 'rgba(255,255,255,.5)', maxW: colW - 8 })
}
const chipH = (A, nameSize, labelSize) => A + nameSize * 1.12 + labelSize * 1.25

// the wordmark: BUILD-A-PLAYER, the -A- in the sport's accent
function wordmark(ctx, word, x, y, size, em, align = 'left') {
  font(ctx, size, F.mark, 900)
  const parts = [['BUILD', '#fff'], ['-A-', rgba(em)], [word, '#fff']]
  const w = parts.reduce((a, [t]) => a + ctx.measureText(t).width, 0)
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  ctx.textAlign = 'left'
  for (const [t, col] of parts) { ctx.fillStyle = col; ctx.fillText(t, cx, y); cx += ctx.measureText(t).width }
  return w
}
function markWidth(mark, h) { return mark ? h * mark.width / mark.height : 0 }

// ── The card ─────────────────────────────────────────────────────────────────
export async function drawSeasonCard(card, { format = 'story' } = {}) {
  const [W, H] = SIZES[format] ?? SIZES.story
  const sp = SPORT[card.sport] ?? SPORT.nfl
  const tint = teamTint(card.team, sp.brand)
  const chips = (card.chips ?? []).filter(c => c && c.name)
  const [, logo, mark, ...faces] = await Promise.all([
    loadFonts(),
    safeImage(card.team?.logo),
    safeImage('/bap-mark.webp'),
    ...chips.map(c => safeImage(realPhoto(c.photo))),
  ])
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const env = { W, H, sp, tint, logo, mark, chips, faces }
  if (format === 'square') drawSquare(ctx, card, env)
  else drawStory(ctx, card, env)
  return canvas
}

const recordOf = card => (card.record ? String(card.record).replace(/-/g, '–') : '')
const headColor = tier => (tier === 'champ' ? null : tier === 'miss' ? 'rgba(255,255,255,.6)' : '#fff')
function headline(ctx, s, x, y, size, tier, align = 'center', maxW = 0) {
  if (tier !== 'champ') return say(ctx, s, x, y, { size, sp: size * .08, color: headColor(tier), align, maxW })
  // champions: gold
  font(ctx, size)
  const g = ctx.createLinearGradient(0, y - size * .75, 0, y)
  g.addColorStop(0, GOLD[0]); g.addColorStop(1, GOLD[2])
  ctx.save(); ctx.shadowColor = 'rgba(212,175,55,.45)'; ctx.shadowBlur = size * .4
  const out = say(ctx, s, x, y, { size, sp: size * .08, color: g, align, maxW })
  ctx.restore()
  return out
}
const statLine = stats => (stats ?? []).filter(s => s && s.v != null && s.v !== '').map(s => `${s.v} ${s.k}`).join('   ·   ')

// Story, 1080x1920: everything on one centered column. Rows that are missing
// close up, the number takes the room that's left, the column sits in the middle
// of the space between the top lights and the footer.
function drawStory(ctx, card, env) {
  const { W, H, sp, tint, logo, mark, chips, faces } = env
  const PAD = 70, TOP = 160, BOT = H - 280
  const rows = []
  const add = (h, draw) => rows.push({ h, draw })
  const gap = h => add(h, null)
  const rec = recordOf(card), stats = statLine(card.stats)
  const perRow = chips.length > 5 ? Math.ceil(chips.length / 2) : chips.length
  const chipRows = chips.length ? Math.ceil(chips.length / perRow) : 0
  const colW = (W - PAD * 2) / Math.max(5, perRow)
  const A = Math.min(102, colW * .55), nameSize = 31, labelSize = 19

  add(card.tag ? 100 : 60, y => {
    say(ctx, String(card.name || 'Guest').toUpperCase(), W / 2, y + 48, { size: 66, sp: 8, maxW: W - PAD * 2 })
    if (card.tag) say(ctx, card.tag, W / 2, y + 92, { size: 30, sp: 6, color: 'rgba(255,255,255,.6)', maxW: W - PAD * 2 })
  })
  gap(38)
  if (card.ribbons?.length) { add(64, y => ribbons(ctx, card.ribbons.slice(0, 3), W / 2, y + 32, 64)); gap(44) }
  const heroAt = rows.length; add(0, null)   // the number: sized below
  add(70, y => {
    // OVR · the build's name
    const label = card.hero?.label ?? 'OVR', sub = card.sub ? String(card.sub).toUpperCase() : ''
    font(ctx, 54); const lw = width(ctx, label, 6)
    font(ctx, 40); const dw = sub ? 52 : 0, sw = sub ? width(ctx, sub, 4) : 0
    const x = W / 2 - (lw + dw + sw) / 2
    say(ctx, label, x, y + 58, { size: 54, sp: 6, align: 'left' })
    if (sub) {
      say(ctx, '·', x + lw + dw / 2, y + 54, { size: 40, color: 'rgba(255,255,255,.4)' })
      say(ctx, sub, x + lw + dw, y + 56, { size: 40, sp: 4, align: 'left', color: 'rgba(255,255,255,.66)' })
    }
  })
  gap(64)
  const rs = 164, ra = rec ? ascentOf(ctx, rec, rs) : 0
  if (rec) {
    // the record, the team's logo beside it (its name under, without a logo)
    add(ra + 8, y => {
      const base = y + ra
      font(ctx, rs, F.num)
      const rw = ctx.measureText(rec).width
      const lh = ra * 1.02, lw = logo ? lh * logo.width / logo.height : 0
      let x = W / 2 - (rw + (logo ? lw + 32 : 0)) / 2
      if (logo) { teamLogo(ctx, logo, x, base - lh, lw, lh); x += lw + 32 }
      bigNumber(ctx, rec, x, base, rs, tint, 'left')
    })
  }
  if (card.team?.name && (!logo || !rec)) add(50, y => say(ctx, card.team.name.toUpperCase(), W / 2, y + 40, { size: 34, sp: 6, color: 'rgba(255,255,255,.6)', maxW: W - PAD * 2 }))
  if (card.headline) add(88, y => headline(ctx, card.headline, W / 2, y + 76, 70, card.tier, 'center', W - PAD * 2))
  if (stats) add(56, y => say(ctx, stats, W / 2, y + 46, { size: 38, sp: 3, color: 'rgba(255,255,255,.78)', maxW: W - PAD * 2 }))
  if (chips.length) {
    gap(56)
    add(34, y => {
      const t = 'THE BUILD'
      const { w } = say(ctx, t, W / 2, y + 24, { size: 28, sp: 9, color: 'rgba(255,255,255,.48)' })
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(PAD, y + 14); ctx.lineTo(W / 2 - w / 2 - 24, y + 14); ctx.moveTo(W / 2 + w / 2 + 24, y + 14); ctx.lineTo(W - PAD, y + 14); ctx.stroke()
    })
    gap(24)
    const ch = chipH(A, nameSize, labelSize)
    for (let r = 0; r < chipRows; r++) {
      const list = chips.slice(r * perRow, (r + 1) * perRow), off = r * perRow
      add(ch + (r < chipRows - 1 ? 14 : 0), y => list.forEach((c, i) => {
        const cx = W / 2 + (i - (list.length - 1) / 2) * colW
        chip(ctx, c, faces[off + i], cx, y, A, { tint, base: sp.base, nameSize, labelSize, colW })
      }))
    }
  }

  // the number takes what's left (within reason)
  const hero = String(card.hero?.value ?? '–')
  const used = rows.reduce((a, r) => a + r.h, 0)
  const k = ascentOf(ctx, hero, 100) / 100
  const size = Math.min(600, Math.max(260, (BOT - TOP - used - 18) / k))
  const asc = ascentOf(ctx, hero, size)
  rows[heroAt] = { h: asc + 18, draw: y => bigNumber(ctx, hero, W / 2, y + asc, size, tint) }
  const total = rows.reduce((a, r) => a + r.h, 0)
  const y0 = TOP + Math.max(0, (BOT - TOP - total) / 2)
  // the backdrop first: the team's logo, faint, behind the number
  const heroY = y0 + rows.slice(0, heroAt).reduce((a, r) => a + r.h, 0) + asc / 2
  drawStage(ctx, W, H, { base: sp.base, tint, logo, logoAt: { x: W / 2, y: heroY, size: Math.min(W * .95, asc * 2.1) } })
  let y = y0
  for (const r of rows) { r.draw?.(y); y += r.h }

  // footer: the mark and the wordmark, then where to play
  const mh = 58, mw = markWidth(mark, mh)
  font(ctx, 36, F.mark, 900)
  const ww = ['BUILD', '-A-', sp.word].reduce((a, t) => a + ctx.measureText(t).width, 0)
  const fx = W / 2 - (mw + (mark ? 20 : 0) + ww) / 2, fy = H - 190
  if (mark) ctx.drawImage(mark, fx, fy - mh / 2 - 2, mw, mh)
  wordmark(ctx, sp.word, fx + mw + (mark ? 20 : 0), fy + 13, 36, sp.em)
  say(ctx, `PLAY AT ${(card.site ?? SITE).toUpperCase()}`, W / 2, fy + 70, { size: 28, sp: 6, color: 'rgba(255,255,255,.55)' })
}

// Square, 1080x1080: the number on the left, the season on the right, the
// build in one row, the footer along the bottom
function drawSquare(ctx, card, env) {
  const { W, H, sp, tint, logo, mark, chips, faces } = env
  const PAD = 64
  const hero = String(card.hero?.value ?? '–')
  const heroSize = hero.length > 2 ? 300 : 370
  const asc = ascentOf(ctx, hero, heroSize)
  const LX = PAD + 200            // the left column's middle
  const RX = 510                  // the right column's left edge
  const RW = W - PAD - RX
  const TOPY = 222                // where the number and the season start
  const heroBase = TOPY + asc
  drawStage(ctx, W, H, { base: sp.base, tint, logo, logoAt: { x: LX, y: heroBase - asc / 2, size: 480 } })

  // who
  say(ctx, String(card.name || 'Guest').toUpperCase(), PAD, 112, { size: 58, sp: 7, align: 'left', maxW: W - PAD * 2 })
  if (card.tag) say(ctx, card.tag, PAD, 156, { size: 28, sp: 5, align: 'left', color: 'rgba(255,255,255,.6)', maxW: W - PAD * 2 })

  // the number
  bigNumber(ctx, hero, LX, heroBase, heroSize, tint)
  say(ctx, card.hero?.label ?? 'OVR', LX, heroBase + 62, { size: 50, sp: 6 })
  if (card.sub) say(ctx, String(card.sub).toUpperCase(), LX, heroBase + 106, { size: 30, sp: 4, color: 'rgba(255,255,255,.66)', maxW: 400 })

  // the season, stacked down the right
  let y = TOPY
  if (card.ribbons?.length) { ribbons(ctx, card.ribbons.slice(0, 2), RX, y + 24, 48, 'left', 14); y += 76 }
  const rec = recordOf(card)
  if (rec) {
    const rs = 136, ra = ascentOf(ctx, rec, rs), base = y + ra
    font(ctx, rs, F.num)
    let x = RX
    const lh = ra * 1.02, lw = logo ? lh * logo.width / logo.height : 0
    if (logo) { teamLogo(ctx, logo, x, base - lh, lw, lh); x += lw + 24 }
    bigNumber(ctx, rec, x, base, rs, tint, 'left')
    y = base + 6
  }
  if (card.team?.name && (!logo || !rec)) { say(ctx, card.team.name.toUpperCase(), RX, y + 36, { size: 28, sp: 4, align: 'left', color: 'rgba(255,255,255,.6)', maxW: RW }); y += 44 }
  if (card.headline) {
    const hs = 50
    font(ctx, hs)
    const lines = wrap(ctx, card.headline, RW, hs * .08, 2)
    lines.forEach((l, i) => headline(ctx, l, RX, y + 58 + i * hs * 1.02, hs, card.tier, 'left', RW))
    y += 58 + (lines.length - 1) * hs * 1.02
  }
  const stats = statLine(card.stats)
  if (stats) say(ctx, stats.replace(/ {3}· {3}/g, ' · '), RX, y + 50, { size: 30, sp: 2, align: 'left', color: 'rgba(255,255,255,.8)', maxW: RW })

  // the build, one row
  if (chips.length) {
    const top = 776, colW = (W - PAD * 2) / chips.length
    const A = Math.min(90, colW * .8), nameSize = chips.length > 9 ? 21 : 23, labelSize = 15
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(PAD, top - 36); ctx.lineTo(W - PAD, top - 36); ctx.stroke()
    chips.forEach((c, i) => chip(ctx, c, faces[i], PAD + colW * (i + .5), top, A, { tint, base: sp.base, nameSize, labelSize, colW }))
  }

  // footer
  const fy = H - 62, mh = 46, mw = markWidth(mark, mh)
  if (mark) ctx.drawImage(mark, PAD, fy - mh / 2 - 2, mw, mh)
  wordmark(ctx, sp.word, PAD + mw + (mark ? 16 : 0), fy + 10, 28, sp.em)
  say(ctx, (card.site ?? SITE).toUpperCase(), W - PAD, fy + 10, { size: 28, sp: 5, align: 'right', color: 'rgba(255,255,255,.55)' })
}

// ── Sharing ──────────────────────────────────────────────────────────────────
export function canShareFiles() {
  if (IS_APP) return true
  try {
    const f = new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' })
    return !!navigator.canShare?.({ files: [f] })
  } catch { return false }
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
// Nothing is awaited before navigator.share: Safari only opens the sheet straight
// from the tap. `save`: the web downloads; the app's sheet has Save Image.
export async function shareCardImage(blob, { title, text, filename = 'season.png', save = false }) {
  if (!blob) return 'error'
  if (IS_APP) return shareNative({ title, text: save ? undefined : text, blob, filename })
  if (!save) {
    const file = new File([blob], filename, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title, text }); return 'shared' } catch (e) {
        if (e?.name === 'AbortError') return 'aborted'
      }
    }
  }
  download(blob, filename)
  return 'downloaded'
}

// ── Season results → the card ────────────────────────────────────────────────
const n = v => (v == null || Number.isNaN(+v) ? null : +v)
const fmt = (v, dp = 0) => { const x = n(v); if (x == null) return null; return dp ? x.toFixed(dp) : Math.round(x).toLocaleString('en-US') }
const one = v => { const x = n(v); return x == null ? null : Number.isInteger(x) ? fmt(x) : fmt(x, 1) }

const NFL_OUT = {
  'Wild Card': 'OUT IN THE WILD CARD ROUND',
  'Divisional Round': 'OUT IN THE DIVISIONAL ROUND',
  'Conference Championship': 'LOST THE CONFERENCE TITLE GAME',
  'Super Bowl': 'LOST THE SUPER BOWL',
}
const NFL_AWARD = { qb: 'MVP', rb: 'OPOY', wr: 'OPOY', te: 'OPOY', db: 'DPOY', ol: 'ALL-PRO' }
const NFL_STATS = {
  qb: r => [[fmt(r.seasonPassYds), 'YDS'], [fmt(r.seasonTDs), 'TD'], [one(r.seasonRating), 'RTG']],
  rb: r => [[fmt(r.seasonRushYds), 'RUSH YDS'], [fmt((n(r.seasonRushTDs) ?? 0) + (n(r.seasonRecTDs) ?? 0)), 'TD'], [one(r.seasonYPC), 'YPC']],
  wr: r => [[fmt(r.seasonRecs), 'REC'], [fmt(r.seasonRecYds), 'YDS'], [fmt(r.seasonRecTDs), 'TD']],
  te: r => [[fmt(r.seasonRecs), 'REC'], [fmt(r.seasonRecYds), 'YDS'], [fmt(r.seasonRecTDs), 'TD']],
  db: r => [[fmt(r.seasonINTs), 'INT'], [fmt(r.seasonPBUs), 'PBU'], [fmt(r.seasonTackles), 'TKL']],
  ol: r => [[fmt(r.seasonPancakes), 'PANCAKES'], [fmt(r.seasonSacksAllowed), 'SACKS ALLOWED']],
}
const statsOf = list => list.filter(([v]) => v != null).map(([v, k]) => ({ v, k }))
const modeOf = (allTime, salary) => (salary ? 'SALARY CAP' : allTime ? 'ALL-TIME' : 'CURRENT')

// Football. rows: the build as the final report lists it ([{ label, data, val }])
export function nflSeasonCard({ result, rows = [], pos = 'qb', name, award = false, arch = null, salary = false }) {
  const { wins, losses, playoffs, sbResult, team } = result ?? {}
  const champ = !!sbResult?.won
  const tier = champ ? 'champ' : playoffs ? 'playoffs' : 'miss'
  return {
    sport: 'nfl',
    name: name || 'Guest',
    tag: [pos.toUpperCase(), modeOf(!!team?.isAllTime, salary)].join('  ·  '),
    hero: { value: result?.ovr ?? '–', label: 'OVR' },
    sub: arch && !/remaining$/.test(arch) ? arch : null,
    record: wins != null && losses != null ? `${wins}-${losses}` : null,
    headline: champ ? 'SUPER BOWL CHAMPIONS' : playoffs ? (NFL_OUT[sbResult?.round] ?? 'MADE THE PLAYOFFS') : 'MISSED THE PLAYOFFS',
    tier,
    ribbons: [champ && 'SUPER BOWL CHAMPS', award && NFL_AWARD[pos]].filter(Boolean),
    team: team ? { name: team.name, short: team.short, color: team.color, color2: team.color2, logo: team.logo ?? `/logos/${team.short}.png` } : null,
    stats: statsOf((NFL_STATS[pos] ?? NFL_STATS.qb)(result ?? {})),
    chips: rows.map(r => ({ label: r.label, name: r.data?.qbFull || r.data?.qb || r.data?.name, photo: r.data?.photo, faceCenter: r.data?.faceCenter, val: r.val ?? r.data?.val })),
  }
}

const NBA_OUT = {
  'First Round': 'OUT IN THE FIRST ROUND',
  'Conference Semifinals': 'OUT IN THE CONFERENCE SEMIS',
  'Conference Finals': 'LOST THE CONFERENCE FINALS',
  'NBA Finals': 'LOST THE NBA FINALS',
}
// Basketball. awards: the season's MVP / DPOY as the final report shows them
export function bucketSeasonCard({ result, build = {}, types = [], attrMap = {}, name, mvp = false, dpoy = false, arch = null, allTime = false, salary = false }) {
  const { wins, losses, champion, madePlayoffs, playoffRounds = [], team, position } = result ?? {}
  const series = playoffRounds.filter(r => r.type === 'series')
  const last = series[series.length - 1]
  const tier = champion ? 'champ' : madePlayoffs ? 'playoffs' : 'miss'
  const headline = champion ? 'NBA CHAMPIONS'
    : !madePlayoffs ? 'MISSED THE PLAYOFFS'
    : last ? (NBA_OUT[last.name] ?? `OUT IN THE ${String(last.name).toUpperCase()}`)
    : playoffRounds.some(r => r.type === 'playin' && !r.advanced) ? 'OUT IN THE PLAY-IN' : 'MADE THE PLAYOFFS'
  return {
    sport: 'bucket',
    name: name || 'Guest',
    tag: [position === 'big' ? 'BIG' : 'GUARD', modeOf(allTime, salary)].join('  ·  '),
    hero: { value: result?.ovr ?? '–', label: 'OVR' },
    sub: arch && !/remaining$/.test(arch) ? arch : null,
    record: wins != null && losses != null ? `${wins}-${losses}` : null,
    headline, tier,
    ribbons: [champion && 'NBA CHAMPS', mvp && 'MVP', dpoy && 'DPOY'].filter(Boolean),
    team: team ? { name: team.name, short: team.short, color: team.color, color2: team.color2, logo: `/logos/nba/${team.short}.png` } : null,
    stats: statsOf([[one(result?.ppg), 'PPG'], [one(result?.rpg), 'RPG'], [one(result?.apg), 'APG']]),
    chips: types.filter(t => build[t]).map(t => ({ label: attrMap[t]?.label ?? t, name: build[t].qbFull || build[t].qb || build[t].name, photo: build[t].photo, faceCenter: build[t].faceCenter, val: build[t].val })),
  }
}

// what goes with the image when it's shared
export function seasonShareText(card) {
  const bits = [`${card.hero?.value} ${card.hero?.label ?? 'OVR'}`, card.record && String(card.record).replace(/–/g, '-'), card.headline && card.headline.toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase())].filter(Boolean)
  return `${card.name}'s season: ${bits.join(', ')}. Play at ${card.site ?? SITE}`
}
export function seasonFileName(card, format = 'story') {
  const who = String(card.name || 'guest').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guest'
  return `${who}-season-${card.hero?.value ?? ''}-${format}.png`
}
