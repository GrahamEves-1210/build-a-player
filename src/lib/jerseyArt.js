// Player and team art for the app (the owner, 2026-11-17/18): the iOS/Android app shows no player photos and no
// team logos, the way the big fantasy apps stay clear of licensing. A player is his jersey shot like a team store's
// product photo (the team's real kit: colours, collar, sleeve trim, the number in athletic block), on a dark rounded
// tile washed with the team's colour; his team and position are small condensed type, his tier a hairline. A team is
// its abbreviation on a small flat chip. Only colours, stripes and numbers: no logos, no wordmarks, no helmets.
//
// Plain SVG strings, so the same art works as an <img> and on a share card's canvas. The website never loads this
// (lib/appArt.js decides). Every letter and number is drawn as a path (an <img> can't load the app's fonts), so the
// art looks the same on every phone.
//
// One picture fills every slot a photo used to: media queries inside the SVG pick the card, the square card or the
// small tile by the slot's own size.
import { NFL_KITS } from './kitData.js'
import { NBA_LOOKS, SOC_KITS } from './teamLooks.js'
import { word } from './artType.js'
import { badgeBody } from './teamBadge.js'

const hex = c => {
  let s = String(c || '').trim().replace('#', '')
  if (s.length === 3) s = s.split('').map(x => x + x).join('')
  return /^[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : null
}
const rgb = c => { const h = hex(c); return h ? [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) : [128, 128, 128] }
const lum = c => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const dist = (a, b) => { const p = rgb(a), q = rgb(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
const shade = (c, k) => toHex(rgb(c).map(v => v * k))
const mix = (a, b, t) => { const p = rgb(a), q = rgb(b); return toHex(p.map((v, i) => v + (q[i] - v) * t)) }
const f1 = n => (Math.round(n * 10) / 10).toString()

// ── Block letters ───────────────────────────────────────────────────────────────────────────────────────────────
// Each glyph is the centre line of a heavy stroke on a 6 × 10 cell (M and W are 7 wide). Stroked with bevelled
// joins it gives the squared, clipped-corner block of a jersey number; stroked wider underneath, its outline.
// Digits are an athletic block on a 7 × 10 cell, every corner clipped, the counters open enough to read small;
// letters a condensed gothic on 6 × 10 (M and W 7), the round letters clipped the same way.
const GLYPH = {
  0: 'M1.1 2.3L2.3 1.1H4.7L5.9 2.3V7.7L4.7 8.9H2.3L1.1 7.7Z', 1: 'M1 2.5L2.6 1.1V8.9',
  2: 'M1.1 2.3L2.3 1.1H4.7L5.9 2.3V3.9L1.1 8.9H5.9', 3: 'M1.1 1.1H5.9L3.3 4.6H4.7L5.9 5.8V7.7L4.7 8.9H1.1',
  4: 'M4.5 8.9V1.1L1.1 6.3H5.9', 5: 'M5.9 1.1H1.3L1.1 4.7H4.7L5.9 5.9V7.7L4.7 8.9H1.1',
  6: 'M5.9 1.1H2.3L1.1 2.3V7.7L2.3 8.9H4.7L5.9 7.7V5.9L4.7 4.7H1.1', 7: 'M1.1 1.1H5.9V2.4L2.9 8.9',
  8: 'M2.3 4.8L1.1 3.6V2.3L2.3 1.1H4.7L5.9 2.3V3.6L4.7 4.8H2.3L1.1 6V7.7L2.3 8.9H4.7L5.9 7.7V6L4.7 4.8',
  9: 'M5.9 4.9H2.3L1.1 3.7V2.3L2.3 1.1H4.7L5.9 2.3V7.7L4.7 8.9H1.1',
  A: 'M1.15 8.85V2.05L2.05 1.15H3.95L4.85 2.05V8.85M1.15 5.2H4.85', B: 'M1.15 1.15H3.9L4.85 2.1V4.1L3.9 5H1.15ZM3.9 5L4.85 5.9V7.9L3.9 8.85H1.15V5',
  C: 'M4.85 2.05L3.95 1.15H2.05L1.15 2.05V7.95L2.05 8.85H3.95L4.85 7.95', D: 'M1.15 1.15H3.5L4.85 2.5V7.5L3.5 8.85H1.15Z', E: 'M4.85 1.15H1.15V8.85H4.85M1.15 5H4',
  F: 'M4.85 1.15H1.15V8.85M1.15 5H4', G: 'M4.85 2.05L3.95 1.15H2.05L1.15 2.05V7.95L2.05 8.85H3.95L4.85 7.95V5.6H3.4', H: 'M1.15 1.15V8.85M4.85 1.15V8.85M1.15 5H4.85',
  I: 'M1.6 1.15V8.85', J: 'M4.85 1.15V7.95L3.95 8.85H2.05L1.15 7.95V6.6', K: 'M1.15 1.15V8.85M1.15 5H2.5L4.85 1.4M2.5 5L4.85 8.6',
  L: 'M1.15 1.15V8.85H4.85', M: 'M1.15 8.85V1.15L3.5 4.7L5.85 1.15V8.85', N: 'M1.15 8.85V1.15L4.85 8.85V1.15',
  O: 'M1.15 2.05L2.05 1.15H3.95L4.85 2.05V7.95L3.95 8.85H2.05L1.15 7.95Z', P: 'M1.15 8.85V1.15H3.95L4.85 2.05V4.3L3.95 5.2H1.15',
  Q: 'M1.15 2.05L2.05 1.15H3.95L4.85 2.05V7.95L3.95 8.85H2.05L1.15 7.95ZM3.3 6.9L5 9.2',
  R: 'M1.15 8.85V1.15H3.95L4.85 2.05V4.1L3.95 5H1.15M3.1 5L4.85 8.6', S: 'M4.85 2.05L3.95 1.15H2.05L1.15 2.05V4.1L2.05 5H3.95L4.85 5.9V7.95L3.95 8.85H2.05L1.15 7.95', T: 'M0.9 1.15H5.1M3 1.15V8.85',
  U: 'M1.15 1.15V7.95L2.05 8.85H3.95L4.85 7.95V1.15', V: 'M1.15 1.15V5.6L3 8.7L4.85 5.6V1.15', W: 'M1.15 1.15V8.85L3.5 5.3L5.85 8.85V1.15',
  X: 'M1.3 1.4L4.7 8.6M4.7 1.4L1.3 8.6', Y: 'M1.15 1.15V4.3L3 5.7L4.85 4.3V1.15M3 5.7V8.85', Z: 'M1.15 1.15H4.85L1.2 8.85H4.85',
  '&': 'M4.85 8.85L1.5 3.4V1.15H3.6V3.2L1.15 6.1V8.85H3.5L4.85 6.8', '-': 'M1.6 5H4.4', '.': 'M2.2 8.85H3.8', "'": 'M3 1.15V3.2',
}
const WIDE = { I: 3.2, M: 7, W: 7, 0: 7, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 7, 8: 7, 9: 7, 1: 3.7 }
const GAP = 0.85
const STEM = 2.3

// a word in block letters, centred on (cx, cy), h tall, made smaller (never squeezed) to fit maxW: { fill, line
// (outline colour), lw (outline width in cell units), drop (a soft shadow under it), stem (stroke weight in cell
// units: 2.3 the heavy athletic block of a jersey number, about 1.3 a condensed label), round (rounded joins) }
function block(text, cx, cy, h, maxW, { fill, line = null, lw = 0.55, drop = 0, wide = 1, stem = STEM, round = false, opacity = 1 }) {
  const chars = [...String(text ?? '').toUpperCase()]
  let x = 0
  const d = []
  for (const ch of chars) {
    const w = WIDE[ch] ?? 6
    if (GLYPH[ch]) d.push(GLYPH[ch].replace(/([MLHVZ])([^MLHVZ]*)/g, (m, cmd, args) => {
      if (cmd === 'Z') return 'Z'
      const n = args.trim().split(/[\s,]+/).map(Number)
      if (cmd === 'H') return 'H' + f1(n[0] + x)
      if (cmd === 'V') return 'V' + n[0]
      return cmd + f1(n[0] + x) + ' ' + n[1]
    }))
    x += (ch === ' ' ? 3.5 : w) + GAP
  }
  const W = Math.max(1, x - GAP)
  // one scale both ways, so every stroke is the same weight
  const k = Math.min(h / 10, maxW / W)
  const sy = k
  const path = d.join('')
  const tf = `translate(${f1(cx - (W * k) / 2)} ${f1(cy - (10 * sy) / 2)}) scale(${k.toFixed(3)} ${sy.toFixed(3)})`
  const st = w => `fill="none" stroke-width="${f1(w * 100) / 100}" stroke-linejoin="${round ? 'round' : 'miter'}" stroke-miterlimit="2" stroke-linecap="${round ? 'round' : 'square'}"`
  return `<g transform="${tf}"${opacity < 1 ? ` opacity="${opacity}"` : ''}>` +
    (drop ? `<path d="${path}" ${st(stem + 2 * (line ? lw : 0) + 0.4)} stroke="#000" opacity="${drop}" transform="translate(0.25 0.45)"/>` : '') +
    (line ? `<path d="${path}" ${st(stem + 2 * lw)} stroke="${line}"/>` : '') +
    `<path d="${path}" ${st(stem)} stroke="${fill}"/></g>`
}

// ── Kits ────────────────────────────────────────────────────────────────────────────────────────────────────────
// the two colours as they read on the kit: the body, the trim (collar, sleeve stripes) and the number
export function kitColors(c1, c2) {
  const body = '#' + (hex(c1) ?? '5a6270')
  let trim = '#' + (hex(c2) ?? 'ffffff')
  if (dist(body, trim) < 60) trim = lum(body) > 0.4 ? '#111111' : '#ffffff'
  const num = contrast('#ffffff', body) >= 2.2 ? '#ffffff' : contrast(trim, body) >= 2.5 ? trim : '#111111'
  const tagText = contrast(trim, body) >= 2.2 ? trim : num
  return { body, trim, num, tagText }
}

// a team's kit: the NFL's from kitData, everyone else's from their two colours
function kitFor(league, team, colors) {
  if (league === 'nfl' && NFL_KITS[team]) {
    const k = NFL_KITS[team]
    return { ...k, badge: k.badge ?? [k.body, contrast(k.num, k.body) >= 2 ? k.num : '#ffffff'] }
  }
  // the NBA's from the same hand-set colours as its badges (lib/teamLooks.js): the body, the number, its outline,
  // the neck and armhole trim
  if (league === 'nba' && NBA_LOOKS[team]) {
    const k = NBA_LOOKS[team]
    return { body: k.f, num: k.i, line: k.l, collar: k.r, sleeve: ['none'], badge: [k.f, k.i], neck: k.n }
  }
  if (!colors || !colors[0]) return { body: '#5d6573', num: '#ffffff', line: null, collar: '#c4cad3', sleeve: ['stripes', '#c4cad3'], badge: null }
  const c = kitColors(colors[0], colors[1])
  const line = c.num === '#ffffff' && c.trim !== '#ffffff' && contrast(c.trim, c.body) >= 1.6 ? c.trim : null
  return { body: c.body, num: c.num, line, collar: c.trim, sleeve: ['stripes', c.trim, c.trim], badge: [c.body, c.tagText] }
}

// ── Tiers (lib/progress.js RARITIES: Common, Rare, Epic, Legend) ─────────────────────────────────────────────────
// A tier is a hairline across the top of the tile and a small word, never a coloured frame.
const TIERS = [
  { name: '', line: '#ffffff', a: 0.14 },
  { name: 'RARE', line: '#9fc9e6', a: 0.7 },
  { name: 'EPIC', line: '#b9a2f2', a: 0.8 },
  { name: 'LEGEND', line: '#e2bd63', a: 0.95 },
]
const TILE = '#0d1110', TILE_LO = '#080b0a'

// ── Sleeve trim ─────────────────────────────────────────────────────────────────────────────────────────────────
// Drawn inside a sleeve's clip. Bands run parallel to the cuff [[ax, ay], [bx, by]]: o is the distance up the
// sleeve from the cuff, t the distance along it; bow curves a band round the arm.
function sleeveTrim(kit, cuff) {
  const [kind, ...cols] = kit.sleeve ?? ['none']
  if (kind === 'none') return ''
  const [[ax, ay], [bx, by]] = cuff
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy)
  const ux = dx / len, uy = dy / len, nx = uy, ny = -ux     // along the cuff, and up the sleeve
  const p = (t, o) => `${f1(ax + ux * t + nx * o)} ${f1(ay + uy * t + ny * o)}`
  const band = (s, w, col, bow = 2) =>
    `<path d="M${p(-14, s)}Q${p(len / 2, s - bow)} ${p(len + 14, s)}L${p(len + 14, s + w)}Q${p(len / 2, s + w - bow)} ${p(-14, s + w)}Z" fill="${col}"/>`
  const c = cols[0] ?? '#ffffff', c2 = cols[1]
  const k = len / 30
  if (kind === 'stripes') {
    let s = 4.5 * k, out = ''
    const w = (cols.length >= 3 ? 3 : 4) * k
    for (const col of cols) { out += band(s, w, col); s += w + (cols.length >= 3 ? 0.1 : 2.6) * k }
    return out
  }
  if (kind === 'tiger') {
    let out = ''
    ;[[6, 0, 0.8, 6.5], [17, 1, 0.74, 6], [28, 0, 0.7, 6], [39, 1, 0.6, 5.5]].forEach(([o, side, reach, w]) => {
      o *= k; w *= k
      const T = t => (side ? len - t : t)
      const tip = len * reach
      out += `<path d="M${p(T(-8), o - w / 2)}Q${p(T(tip * 0.5), o - w * 0.75 - 1.5)} ${p(T(tip), o + 1.2)}Q${p(T(tip * 0.45), o + w * 0.35)} ${p(T(-8), o + w / 2)}Z"/>`
    })
    return `<g fill="${c}">${out}</g>`
  }
  if (kind === 'loops') return band(29 * k, 3.6 * k, c, 4) + band(36 * k, 3.6 * k, c, 4)
  if (kind === 'horn') return (c2 ? band(29 * k, 9 * k, c2, 7) : '') + band(30 * k, 6.5 * k, c, 7)
  if (kind === 'bolt') {
    const z = [[-14, 16], [len * 0.42, 21], [len * 0.36, 17], [len + 14, 25], [len + 14, 31], [len * 0.6, 25], [len * 0.66, 29], [-14, 22]]
    return `<path d="M${z.map(([t, o]) => p(t, o * k)).join('L')}Z" fill="${c}"/>`
  }
  return ''
}

// a football club's shirt pattern (lib/teamLooks.js SOC_KITS), over the body, under the number
function shirtPattern(pat) {
  if (!pat) return ''
  const [p, a, b] = pat
  if (p === 'stripes') { let o = `<rect width="200" height="200" fill="${a}"/>`; for (let x = 15; x < 200; x += 30) o += `<rect x="${x}" y="0" width="15" height="200" fill="${b}"/>`; return o }
  if (p === 'hoops') { let o = `<rect width="200" height="200" fill="${a}"/>`; for (let y = 40; y < 200; y += 32) o += `<rect x="0" y="${y}" width="200" height="16" fill="${b}"/>`; return o }
  if (p === 'halves') return `<rect width="100" height="200" fill="${a}"/><rect x="100" width="100" height="200" fill="${b}"/>`
  if (p === 'sash') return `<rect width="200" height="200" fill="${a}"/><path d="M30 20L62 20L190 170L190 200L160 200L30 50Z" fill="${b}"/>`
  if (p === 'diag') return `<path d="M0 0H200L0 200Z" fill="${a}"/><path d="M200 0V200H0Z" fill="${b}"/>`
  if (p === 'band') return `<rect width="200" height="200" fill="${a}"/><rect x="0" y="62" width="200" height="26" fill="${b}"/>`
  if (p === 'centre') return `<rect width="200" height="200" fill="${a}"/><rect x="78" y="0" width="44" height="200" fill="#ffffff"/><rect x="85" y="0" width="30" height="200" fill="${b}"/>`
  return ''
}

// ── The jersey: a product shot ───────────────────────────────────────────────────────────────────────────────────
// Front on, the way a team store photographs it, with the cloth's form: light falling on the chest and the
// shoulders, the sides turning away into shade, the hem a touch darker, side panels set in with stitched seams, a
// collar and cuffs (or a tank's bindings) with real thickness, and a fine knit or mesh drawn at large sizes only.
// Three cuts: a football jersey over pads ('tee'), a slim basketball tank ('tank'), a football club's shirt
// ('soc'). 200 × 200, the shadow included.
const TEE = {
  body: 'M79 21C70 23 56 27 43 33C30 39 22 49 16 63L9 95C19 101 30 104 41 105L49 89C50 121 50 160 50 187C80 193 120 193 150 187C150 160 150 121 151 89L159 105C170 104 181 101 191 95L184 63C178 49 170 39 157 33C144 27 130 23 121 21L100 49Z',
  sleeves: ['M43 33C30 39 22 49 16 63L9 95C19 101 30 104 41 105L49 89C49 67 52 48 59 29Z', 'M157 33C170 39 178 49 184 63L191 95C181 101 170 104 159 105L151 89C151 67 148 48 141 29Z'],
  seams: ['M59 29C52 48 49 67 49 89', 'M141 29C148 48 151 67 151 89'],
  cuffs: [[[9, 95], [41, 105]], [[159, 105], [191, 95]]],
  panels: ['M49 89C50 121 50 160 50 187L63 189C63 160 62 124 59 93Z', 'M151 89C150 121 150 160 150 187L137 189C137 160 138 124 141 93Z'],
  panelSeams: ['M59 93C62 124 63 160 63 189', 'M141 93C138 124 137 160 137 189'],
  yoke: 'M58 30Q100 50 142 30',
  back: 'M79 21Q100 11 121 21L100 49Z',
  collar: 'M78 20L100 50L122 20',
  backCollar: 'M80 20Q100 12 120 20',
  hem: 'M50 187C80 193 120 193 150 187',
  // where the light gathers: the chest, and each shoulder over its pad
  vol: [[100, 92, 64], [66, 44, 34], [134, 44, 34]],
  sides: [40, 160],
  num: [100, 122, 50, 84],
  collarW: 5.6,
}
// a modern basketball tank: narrow straps, deep armholes, a slim body that tapers a little to the hem
const TANK = {
  body: 'M82 14L64 15C63 52 56 86 42 98L46 186Q100 194 154 186L158 98C144 86 137 52 136 15L118 14L100 52Z',
  bodyRound: 'M82 14L64 15C63 52 56 86 42 98L46 186Q100 194 154 186L158 98C144 86 137 52 136 15L118 14Q100 46 82 14Z',
  sleeves: [],
  panels: ['M42 98C47 100 52 102 56 105L58 188L46 186Z', 'M158 98C153 100 148 102 144 105L142 188L154 186Z'],
  panelSeams: ['M56 105L58 188', 'M144 105L142 188'],
  back: 'M82 14Q100 6 118 14L100 52Z',
  backRound: 'M82 14Q100 6 118 14Q100 46 82 14Z',
  collar: 'M81 13L100 53L119 13',
  collarRound: 'M81 13Q100 48 119 13',
  backCollar: 'M83 13Q100 7 117 13',
  arms: ['M64 14C63 52 56 86 42 98', 'M136 14C137 52 144 86 158 98'],
  hem: 'M46 186Q100 194 154 186',
  vol: [[100, 96, 54], [72, 30, 16], [128, 30, 16]],
  sides: [42, 158],
  num: [100, 118, 44, 70],
  collarW: 5,
}
// a football club's shirt: no pads, the sleeves set in and angled down, a crew collar
const SOC = {
  body: 'M80 20Q100 14 120 20L148 28C160 32 170 40 178 52L190 78C182 84 172 88 162 90L152 74C151 110 151 150 152 186Q100 193 48 186C49 150 49 110 48 74L38 90C28 88 18 84 10 78L22 52C30 40 40 32 52 28Z',
  sleeves: ['M52 28C40 32 30 40 22 52L10 78C18 84 28 88 38 90L48 74C47 58 50 42 58 27Z', 'M148 28C160 32 170 40 178 52L190 78C182 84 172 88 162 90L152 74C153 58 150 42 142 27Z'],
  seams: ['M58 27C50 42 47 58 48 74', 'M142 27C150 42 153 58 152 74'],
  cuffs: [[[10, 78], [38, 90]], [[162, 90], [190, 78]]],
  panels: ['M48 74C49 110 49 150 48 186L58 187C58 150 58 112 56 80Z', 'M152 74C151 110 151 150 152 186L142 187C142 150 142 112 144 80Z'],
  panelSeams: ['M56 80C58 112 58 150 58 187', 'M144 80C142 112 142 150 142 187'],
  back: 'M80 20Q100 14 120 20Q100 36 80 20Z',
  collar: 'M79 20Q100 37 121 20',
  backCollar: 'M80 20Q100 13 120 20',
  hem: 'M48 186Q100 193 152 186',
  vol: [[100, 92, 58], [64, 40, 26], [136, 40, 26]],
  sides: [48, 152],
  num: [100, 114, 44, 70],
  collarW: 5,
}
const CUTS = { tee: TEE, tank: TANK, soc: SOC }

// a hem or a cuff turned over: a dark line where it folds, a lit edge under it
const fold = (d, dark) => `<path d="${d}" fill="none" stroke="#000" stroke-width="1" opacity="${dark ? 0.4 : 0.16}"/><path d="${d}" fill="none" stroke="#fff" stroke-width=".7" opacity="${dark ? 0.1 : 0.18}" transform="translate(0 1.2)"/>`
// a seam: the join, and its stitches beside it
const seam = (d, dark, stitch) => `<path d="${d}" fill="none" stroke="#000" stroke-width="1" opacity="${dark ? 0.55 : 0.26}"/>` +
  (stitch ? `<path d="${d}" fill="none" stroke="#fff" stroke-width=".55" stroke-dasharray="1.6 1.5" opacity="${dark ? 0.16 : 0.26}" transform="translate(1.6 0)"/>` : '')

// u: this picture's id prefix; cut: 'tee' | 'tank' | 'soc'; small: drawn 44px or under (flat light, no knit, no
// folds, no stitches, a bigger number)
function jersey(kit, number, cut, u, { small = false } = {}) {
  const S = CUTS[cut] ?? TEE
  const round = cut === 'tank' && kit.neck === 'round'
  const bodyD = round ? S.bodyRound : S.body
  const L = lum(kit.body), dark = L < 0.04, pale = L > 0.6
  const n = String(number ?? '').slice(0, 2)
  const [nx, ny, nh, nw] = S.num
  // light and shade, kept light (owner 11-27: the team's colour first, bright and true, only a hint of form): a
  // black kit gets a little more light to show its shape, a white one a little more shade
  const hi = dark ? 0.2 : pale ? 0.3 : 0.17, lo = (dark ? 0.2 : pale ? 0.1 : 0.15) * (small ? 0.6 : 1)
  const trim = kit.line ?? (contrast(kit.collar, kit.body) > 1.4 ? kit.collar : null)
  const collarHi = mix(kit.collar, '#fff', 0.25), collarLo = shade(kit.collar, pale ? 0.8 : 0.66)
  const [sx0, sx1] = S.sides, mid = (sx0 + sx1) / 2, half = (sx1 - sx0) / 2
  const defs = [
    `<clipPath id="${u}b"><path d="${bodyD}"/></clipPath>`,
    `<filter id="${u}sh" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>`,
    // the sides turning away from the light (the far side deeper), the hem a touch darker, the top lit
    `<linearGradient id="${u}sd" gradientUnits="userSpaceOnUse" x1="${sx0 - 6}" y1="0" x2="${sx1 + 6}" y2="0"><stop offset="0" stop-color="#000" stop-opacity="${lo * 0.8}"/><stop offset=".16" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${lo}"/></linearGradient>`,
    `<linearGradient id="${u}ly" gradientUnits="userSpaceOnUse" x1="0" y1="14" x2="0" y2="194"><stop offset="0" stop-color="#fff" stop-opacity="${hi * 0.35}"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${lo * 0.35}"/></linearGradient>`,
    // the volumes: the chest and the shoulders catch the light, a little up and to the left
    ...S.vol.map(([cx, cy, r], i) => `<radialGradient id="${u}v${i}" gradientUnits="userSpaceOnUse" cx="${cx - r * 0.12}" cy="${cy - r * 0.1}" r="${r}"><stop offset="0" stop-color="#fff" stop-opacity="${hi * (i ? 0.75 : 0.85)}"/><stop offset=".55" stop-color="#fff" stop-opacity="${hi * (i ? 0.25 : 0.3)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`),
    // under the collar, where the neck sits
    `<radialGradient id="${u}ao" gradientUnits="userSpaceOnUse" cx="100" cy="${cut === 'tank' ? 22 : 28}" r="${cut === 'tank' ? 34 : 40}"><stop offset="0" stop-color="#000" stop-opacity="${dark ? 0.3 : 0.16}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="${u}cl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${collarHi}"/><stop offset=".5" stop-color="${kit.collar}"/><stop offset="1" stop-color="${collarLo}"/></linearGradient>`,
  ]
  if (!small) defs.push(
    `<filter id="${u}sf" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter>`,
    // a tank's mesh, faint (a football or club shirt is left smooth: the knit dulled the colour, owner 11-27)
    cut === 'tank' ? `<pattern id="${u}kn" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".5" fill="#fff" opacity="${dark ? 0.06 : 0.07}"/></pattern>` : '',
  )
  const out = [
    `<defs>${defs.join('')}</defs>`,
    // where it meets the tile
    `<ellipse cx="100" cy="190" rx="${half + 12}" ry="6" fill="#000" opacity=".4" filter="url(#${u}sh)"/>`,
    `<path d="${bodyD}" fill="${kit.body}"/>`,
    `<g clip-path="url(#${u}b)">`,
    shirtPattern(kit.pat),
    // (the side panels a shade deeper, over a club's pattern too)
    ...(S.panels ?? []).map(pn => `<path d="${pn}" fill="#000" opacity="${pale ? 0.05 : 0.08}"/>`),
  ]
  // a tank's side piping in the trim
  if (cut === 'tank' && kit.collar && !small) S.panelSeams.forEach(d => out.push(`<path d="${d}" fill="none" stroke="${kit.collar}" stroke-width="2.2"/>`))
  S.sleeves.forEach((sl, i) => out.push(`<clipPath id="${u}c${i}"><path d="${sl}"/></clipPath><g clip-path="url(#${u}c${i})">${sleeveTrim(kit, S.cuffs[i])}</g>`))
  // the number, sewn on: a collegiate block (a club's rounder face), outlined in the trim, lit from above
  if (n) out.push(word(kit.face ?? 'num', n, nx, ny + (small ? 3 : 0), small ? nh * 1.25 : nh * 1.06, small ? nw * 1.2 : nw * 1.04,
    { fill: kit.num, bold: kit.face === 'soc' ? 1 : small ? 2.6 : 2.2, line: kit.pat ? (lum(kit.num) > 0.5 ? '#111111' : '#ffffff') : trim && dist(trim, kit.num) > 40 ? trim : shade(kit.body, 0.5),
      lw: small || kit.pat ? 5 : 3.6, track: kit.face === 'soc' ? 3 : 4, shadow: small ? 0 : 0.28, bevel: !small, id: u + 'n' }))
  if (!small && cut === 'tank') out.push(`<rect width="200" height="200" fill="url(#${u}kn)"/>`)
  // the form, over everything sewn on, so the number follows the cloth
  out.push(
    ...S.vol.map((_, i) => `<rect width="200" height="200" fill="url(#${u}v${i})"/>`),
    `<rect width="200" height="200" fill="url(#${u}sd)"/>`,
    `<rect width="200" height="200" fill="url(#${u}ly)"/>`,
    `<rect width="200" height="200" fill="url(#${u}ao)"/>`,
  )
  if (!small) {
    // soft folds: from the armpits, and where it gathers at the waist
    const ax = cut === 'tank' ? 12 : 0
    out.push(`<g filter="url(#${u}sf)" fill="#000"><path d="M${50 + ax} 96Q${72 + ax / 2} 110 80 134L74 136Q${66 + ax / 2} 116 ${49 + ax} 104Z" opacity=".1"/><path d="M${150 - ax} 96Q${128 - ax / 2} 110 120 134L126 136Q${134 - ax / 2} 116 ${151 - ax} 104Z" opacity=".14"/></g>`)
    ;(S.panelSeams ?? []).forEach(d => out.push(seam(d, dark, true)))
    ;(S.seams ?? []).forEach(d => out.push(seam(d, dark, true)))
    if (S.yoke) out.push(`<path d="${S.yoke}" fill="none" stroke="#000" stroke-width="1" opacity="${dark ? 0.4 : 0.14}"/>`)
    // the cuffs turned over
    ;(S.cuffs ?? []).forEach(([[ax0, ay0], [bx, by]]) => {
      const dx = bx - ax0, dy = by - ay0, len = Math.hypot(dx, dy), ox = (dy / len) * 4.5, oy = (-dx / len) * 4.5
      out.push(fold(`M${f1(ax0 + ox - dx * 0.1)} ${f1(ay0 + oy - dy * 0.1)}L${f1(bx + ox + dx * 0.1)} ${f1(by + oy + dy * 0.1)}`, dark))
    })
  } else (S.seams ?? []).forEach(d => out.push(seam(d, dark, false)))
  // the collar: the inside of the back, the back band, then the front band with its thickness, the shadow it casts
  // on the chest and the lit edge along its top; a tank's armholes bound the same way
  const band = (d, w, cast = true) => (small || !cast ? '' : `<path d="${d}" fill="none" stroke="#000" stroke-width="${w}" opacity=".15" stroke-linejoin="round" transform="translate(0 2.2)"/>`) +
    `<path d="${d}" fill="none" stroke="url(#${u}cl)" stroke-width="${w}" stroke-linejoin="round"/>` +
    (small ? '' : `<path d="${d}" fill="none" stroke="#fff" stroke-width=".8" opacity="${pale ? 0.5 : 0.35}" stroke-linejoin="round" transform="translate(0 -${f1(w * 0.32)})"/><path d="${d}" fill="none" stroke="#000" stroke-width=".7" opacity=".18" stroke-linejoin="round" transform="translate(0 ${f1(w * 0.36)})"/>`)
  out.push(
    `<path d="${round ? S.backRound : S.back}" fill="${dark ? '#030404' : shade(kit.body, 0.34)}"/>`,
    `<path d="${S.backCollar}" fill="none" stroke="${collarLo}" stroke-width="3.2" stroke-linecap="round"/>`,
  )
  // (a tank's armholes: the binding only, no cast shadow, which read as a dark outline round the tank)
  ;(S.arms ?? []).forEach(d => out.push(band(d, small ? 5 : 4, false)))
  out.push(band(round ? S.collarRound : S.collar, small ? S.collarW + 1 : S.collarW))
  out.push('</g>')
  return out.join('')
}

// ── Tiles ────────────────────────────────────────────────────────────────────────────────────────────────────────
// The app's dark surface, a 1px hairline, the team's colour as a low wash of light behind the jersey and nothing
// else. Type is the app's condensed caps, drawn as paths.
function tile(w, h, r, wash, T, u, at) {
  const [cx, cy, rr] = at
  return `<defs><radialGradient id="${u}w" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${rr}"><stop offset="0" stop-color="${wash}" stop-opacity=".62"/><stop offset=".55" stop-color="${wash}" stop-opacity=".2"/><stop offset="1" stop-color="${wash}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${u}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${TILE}"/><stop offset="1" stop-color="${TILE_LO}"/></linearGradient>` +
    `<clipPath id="${u}k"><rect width="${w}" height="${h}" rx="${r}"/></clipPath></defs>` +
    `<rect width="${w}" height="${h}" rx="${r}" fill="url(#${u}t)"/>` +
    `<g clip-path="url(#${u}k)"><rect width="${w}" height="${h}" fill="url(#${u}w)"/>` +
    (T.name ? `<rect x="${r}" y="1" width="${w - 2 * r}" height="1.5" fill="${T.line}" opacity="${T.a}"/>` : '') + '</g>' +
    `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="${r - 0.5}" fill="none" stroke="#fff" stroke-opacity=".08"/>`
}
// the colour the tile's light takes: the kit's, lifted off black so a black kit still glows a little
const washOf = kit => (lum(kit.body) < 0.03 ? mix(kit.collar, '#5a6068', 0.45) : lum(kit.body) > 0.6 ? mix(kit.collar, '#ffffff', 0.25) : kit.body)
const label = (t, x, y, h, maxW, fill, opacity = 1) => block(t, x, y, h, maxW, { fill, stem: 1.35, opacity })
// left-aligned: block centres its text, so measure it first
function labelL(t, x, y, h, fill, opacity = 1) {
  const chars = [...String(t ?? '').toUpperCase()]
  const W = chars.reduce((a, ch) => a + (ch === ' ' ? 3.5 : WIDE[ch] ?? 6) + GAP, -GAP)
  return label(t, x + (W * h / 10) / 2, y, h, 999, fill, opacity)
}

// the card: the team and the position set small on the left, the jersey the picture
function card(kit, team, number, pos, tank, T, u) {
  const W = 276, H = 200
  return tile(W, H, 16, washOf(kit), T, u, [180, 104, 150]) +
    (kit.crest ? `<g transform="translate(12 14) scale(.56)">${kit.crest()}</g>` : team ? labelL(team, 20, 36, 26, '#ffffff', 0.95) : '') +
    (pos ? labelL(pos, 20, kit.crest ? 86 : 66, 13, '#c4ccc9') : '') +
    (T.name ? labelL(T.name, 20, kit.crest ? 106 : 86, 11, T.line, T.a) : '') +
    `<g transform="translate(80 6) scale(.97)">${jersey(kit, number, tank, u + 'j')}</g>`
}
function cardSquare(kit, team, number, pos, tank, T, u) {
  return tile(200, 200, 18, washOf(kit), T, u, [100, 86, 120]) +
    `<g transform="translate(26 8) scale(.74)">${jersey(kit, number, tank, u + 'j')}</g>` +
    (kit.crest ? `<g transform="translate(10 148) scale(.46)">${kit.crest()}</g>` : team ? labelL(team, 18, 176, 20, '#ffffff', 0.95) : '') +
    (pos ? label(pos, 200 - 18 - 12, 176, 13, 44, '#c4ccc9') : '')
}
// a row's picture: the jersey in a small rounded tile
function cardSmall(kit, number, tank, u, small) {
  return tile(200, 200, 40, washOf(kit), TIERS[0], u, [100, 92, 130]) +
    `<g transform="${small ? 'translate(7 6) scale(.93)' : 'translate(14 12) scale(.86)'}">${jersey(kit, number, tank, u + 'j', { small })}</g>`
}

// ── Public ──────────────────────────────────────────────────────────────────────────────────────────────────────
let seq = 0
// One picture for every slot a photo used to fill, chosen by the slot's own size (lib/appArt.js draws it to the
// slot's box): 72px or less, the jersey in a small tile (44px and under, simplified); a square-ish slot, the square
// card; a wide one, the card.
const STYLE = '<style>.sq,.sm,.xs{display:none}@media (max-aspect-ratio:6/5){.big{display:none}.sq{display:inline}}' +
  '@media (max-width:72px),(max-height:60px){.big,.sq{display:none}.sm{display:inline}}' +
  '@media (max-width:44px),(max-height:44px){.sm{display:none}.xs{display:inline}}</style>'

// A player. { league: 'nfl'|'nba'|'cfb'|'cbb'|'mlb'|'soc'|'nat', team: 'CIN', colors: [c1, c2], number: 9, pos: 'QB',
//   rank: 0-3 (Common, Rare, Epic, Legend), size (height in px), variant: 'auto' | 'card' | 'square' | 'small' }
export function jerseySvg({ league = 'nfl', team = '', colors, number = '', pos = '', rank = 0, size = 240, variant = 'auto' } = {}) {
  const u = 'j' + (++seq).toString(36) + '_'
  // the cut: a slim tank for basketball, a club shirt for football clubs and nations, else a football jersey
  const tank = league === 'nba' || league === 'cbb' ? 'tank' : league === 'soc' || league === 'nat' ? 'soc' : 'tee'
  const kit = kitFor(league, team, colors)
  if (league === 'soc' || league === 'nat') kit.face = 'soc'
  if (league === 'soc' && SOC_KITS[team]) kit.pat = SOC_KITS[team]
  // the team's badge in the card's corner (lib/teamBadge.js), where the team has colours to draw it in
  if (team && (colors?.[0] || (league === 'nfl' && NFL_KITS[team]) || (league === 'nba' && NBA_LOOKS[team]))) kit.crest = () => badgeBody({ league, team, colors })
  const T = TIERS[Math.max(0, Math.min(3, rank | 0))]
  const w = Math.round(size * 276 / 200)
  const svg = (cls, vb, body) => `<svg class="${cls}" viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${body}</svg>`
  // the jersey on its own, no tile, for the screens that set it loose (simplified drawn 44px or under)
  if (variant === 'bare') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">` +
    '<style>.xs{display:none}@media (max-width:44px){.fu{display:none}.xs{display:inline}}</style>' +
    `<g class="fu">${jersey(kit, number, tank, u + 'f')}</g><g class="xs">${jersey(kit, number, tank, u + 'x', { small: true })}</g></svg>`
  if (variant === 'small') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">${cardSmall(kit, number, tank, u, size <= 44)}</svg>`
  if (variant === 'card') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 276 200" width="${w}" height="${size}">${card(kit, team, number, pos, tank, T, u)}</svg>`
  if (variant === 'square') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">${cardSquare(kit, team, number, pos, tank, T, u)}</svg>`
  // (no size of its own: the slot's box is its viewport, so the media queries above see the slot)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">${STYLE}` +
    svg('big', '0 0 276 200', card(kit, team, number, pos, tank, T, u + 'w')) +
    svg('sq', '0 0 200 200', cardSquare(kit, team, number, pos, tank, T, u + 'q')) +
    svg('sm', '0 0 200 200', cardSmall(kit, number, tank, u + 's', false)) +
    svg('xs', '0 0 200 200', cardSmall(kit, number, tank, u + 'x', true)) + '</svg>'
}

export const svgUri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
