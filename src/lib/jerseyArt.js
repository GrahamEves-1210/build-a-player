// Player and team art for the app (the owner, 2026-11-17/18): the iOS/Android app shows no player photos and no
// team logos, the way FanDuel and Griddy stay clear of NFL licensing. A player is a collectible card: a peaked frame
// in his rarity's colour, his team's abbreviation on an oval badge, his jersey turned three-quarters in the team's real
// kit (colours, collar, sleeve stripes or pattern, the number in block letters) and his position on a plaque. A team
// is the oval badge on its own. Only colours, stripes and numbers: no logos, no wordmarks, no helmets.
//
// Plain SVG strings, so the same art works as an <img>, inside an SVG (a helmet decal) and on a share card's canvas.
// The website never loads this (lib/appArt.js decides). Every letter and number is drawn as a path (an <img> can't
// load the app's fonts), so the art looks the same on every phone.
//
// One picture fills every slot a photo used to: drawn 64px or smaller (avatars, list rows) a media query inside the
// SVG swaps the card for a close, head-on crop of the jersey and its number on the rarity colour.
import { NFL_KITS } from './kitData'

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
const GLYPH = {
  0: 'M1.15 1.15H4.85V8.85H1.15Z', 1: 'M1.3 2.7L3.1 1.15V8.85M1.5 8.85H4.7', 2: 'M1.15 1.15H4.85V5H1.15V8.85H4.85',
  3: 'M1.15 1.15H4.85V8.85H1.15M2.1 5H4.85', 4: 'M1.15 1.15V5.7H4.85M4.85 1.15V8.85', 5: 'M4.85 1.15H1.15V5H4.85V8.85H1.15',
  6: 'M4.85 1.15H1.15V8.85H4.85V5H1.15', 7: 'M1.15 1.15H4.85V2.9L2.9 8.85', 8: 'M1.15 1.15H4.85V8.85H1.15ZM1.15 5H4.85',
  9: 'M4.85 5H1.15V1.15H4.85V8.85H1.15',
  A: 'M1.15 8.85V1.15H4.85V8.85M1.15 5.2H4.85', B: 'M1.15 1.15H3.9L4.85 2.1V4.1L3.9 5H1.15ZM3.9 5L4.85 5.9V7.9L3.9 8.85H1.15V5',
  C: 'M4.85 1.15H1.15V8.85H4.85', D: 'M1.15 1.15H3.5L4.85 2.5V7.5L3.5 8.85H1.15Z', E: 'M4.85 1.15H1.15V8.85H4.85M1.15 5H4',
  F: 'M4.85 1.15H1.15V8.85M1.15 5H4', G: 'M4.85 2.4V1.15H1.15V8.85H4.85V5.6H3.9', H: 'M1.15 1.15V8.85M4.85 1.15V8.85M1.15 5H4.85',
  I: 'M3 1.15V8.85M1.3 1.15H4.7M1.3 8.85H4.7', J: 'M4.85 1.15V8.85H1.15V6.3', K: 'M1.15 1.15V8.85M1.15 5H2.5L4.85 1.4M2.5 5L4.85 8.6',
  L: 'M1.15 1.15V8.85H4.85', M: 'M1.15 8.85V1.15L3.5 4.7L5.85 1.15V8.85', N: 'M1.15 8.85V1.15L4.85 8.85V1.15',
  O: 'M1.15 1.15H4.85V8.85H1.15Z', P: 'M1.15 8.85V1.15H4.85V5.2H1.15', Q: 'M1.15 1.15H4.85V8.85H1.15ZM3.3 6.9L5 9.2',
  R: 'M1.15 8.85V1.15H4.85V5H1.15M3.1 5L4.85 8.6', S: 'M4.85 1.15H1.15V5H4.85V8.85H1.15', T: 'M0.9 1.15H5.1M3 1.15V8.85',
  U: 'M1.15 1.15V8.85H4.85V1.15', V: 'M1.15 1.15V5.6L3 8.7L4.85 5.6V1.15', W: 'M1.15 1.15V8.85L3.5 5.3L5.85 8.85V1.15',
  X: 'M1.3 1.4L4.7 8.6M4.7 1.4L1.3 8.6', Y: 'M1.15 1.15V4.3L3 5.7L4.85 4.3V1.15M3 5.7V8.85', Z: 'M1.15 1.15H4.85L1.2 8.85H4.85',
  '&': 'M4.85 8.85L1.5 3.4V1.15H3.6V3.2L1.15 6.1V8.85H3.5L4.85 6.8', '-': 'M1.6 5H4.4', '.': 'M2.2 8.85H3.8', "'": 'M3 1.15V3.2',
}
const WIDE = { M: 7, W: 7 }
const GAP = 0.85
const STEM = 2.3

// a word in block letters, centred on (cx, cy), h tall, squeezed to fit maxW: { fill, line (outline colour),
// lw (outline width in cell units), drop (a soft shadow under it) }
function block(text, cx, cy, h, maxW, { fill, line = null, lw = 0.55, drop = 0, wide = 1 }) {
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
  const s = h / 10
  const sx = Math.min(s * wide, maxW / W)
  const path = d.join('')
  const tf = `translate(${f1(cx - (W * sx) / 2)} ${f1(cy - h / 2)}) scale(${sx.toFixed(3)} ${s.toFixed(3)})`
  const st = w => `fill="none" stroke-width="${f1(w * 100) / 100}" stroke-linejoin="bevel" stroke-linecap="square"`
  return `<g transform="${tf}">` +
    (drop ? `<path d="${path}" ${st(STEM + 2 * (line ? lw : 0) + 0.4)} stroke="#000" opacity="${drop}" transform="translate(0.35 0.5)"/>` : '') +
    (line ? `<path d="${path}" ${st(STEM + 2 * lw)} stroke="${line}"/>` : '') +
    `<path d="${path}" ${st(STEM)} stroke="${fill}"/></g>`
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
  if (!colors || !colors[0]) return { body: '#5d6573', num: '#ffffff', line: null, collar: '#c4cad3', sleeve: ['stripes', '#c4cad3'], badge: null }
  const c = kitColors(colors[0], colors[1])
  const line = c.num === '#ffffff' && c.trim !== '#ffffff' && contrast(c.trim, c.body) >= 1.6 ? c.trim : null
  return { body: c.body, num: c.num, line, collar: c.trim, sleeve: ['stripes', c.trim, c.trim], badge: [c.body, c.tagText] }
}

// ── Rarity tiers (lib/progress.js RARITIES: Common, Rare, Epic, Legend) ──────────────────────────────────────────
const TIERS = [
  { rimHi: '#ffffff', rim: '#c7ced8', rimLo: '#77808f', glow: '#8d98aa', ink: '#1f2530' },  // common: silver
  { rimHi: '#e2f6ff', rim: '#72c6f2', rimLo: '#2a6fb3', glow: '#4aa3ee', ink: '#082656' },  // rare: blue
  { rimHi: '#f6eaff', rim: '#c9a5f7', rimLo: '#7a4cc2', glow: '#9a6cf6', ink: '#2a0c68' },  // epic: purple
  { rimHi: '#fff6c4', rim: '#f3c534', rimLo: '#a7720b', glow: '#e7b52c', ink: '#3b2600' },  // legend: gold
]
// the panel every card sits on: the app's own dark green-black, the rarity's light falling on it
const PANEL = '#0c1715', PANEL_LO = '#060c0b'

// the card is 276 × 200, a photo's shape (the slots it fills were made for ESPN headshots, 600 × 436); the square
// card, for square slots, is 200 × 200
const CW = 276, CH = 200
// the frame: a slab with two corners cut on the diagonal (top left, bottom right) and two rounded, inset i
function slab(i, w = CW, h = CH, cut = 24, r = 10) {
  const x0 = 3 + i, y0 = 3 + i, x1 = w - 3 - i, y1 = h - 3 - i
  const c = Math.max(2, cut - i * 0.59), rr = Math.max(1, r - i)
  return `M${f1(x0)} ${f1(y0 + c)}L${f1(x0 + c)} ${f1(y0)}H${f1(x1 - rr)}Q${f1(x1)} ${f1(y0)} ${f1(x1)} ${f1(y0 + rr)}V${f1(y1 - c)}` +
    `L${f1(x1 - c)} ${f1(y1)}H${f1(x0 + rr)}Q${f1(x0)} ${f1(y1)} ${f1(x0)} ${f1(y1 - rr)}Z`
}
// ── Sleeve trim ─────────────────────────────────────────────────────────────────────────────────────────────────
// Drawn inside a sleeve's clip. Bands run parallel to the cuff [[ax, ay], [bx, by]]: o is the distance up the
// sleeve from the cuff, t the distance along it; bow curves a band round the arm. three: the three-quarter
// jersey's own horn and bolt shapes.
function sleeveTrim(kit, cuff, three = false) {
  const [kind, ...cols] = kit.sleeve ?? ['none']
  if (kind === 'none') return ''
  const [[ax, ay], [bx, by]] = cuff
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy)
  const ux = dx / len, uy = dy / len, nx = uy, ny = -ux     // along the cuff, and up the sleeve
  const p = (t, o) => `${f1(ax + ux * t + nx * o)} ${f1(ay + uy * t + ny * o)}`
  const band = (s, w, col, bow = 1.5) =>
    `<path d="M${p(-14, s)}Q${p(len / 2, s - bow)} ${p(len + 14, s)}L${p(len + 14, s + w)}Q${p(len / 2, s + w - bow)} ${p(-14, s + w)}Z" fill="${col}"/>`
  const c = cols[0] ?? '#ffffff', c2 = cols[1]
  const k = len / 30   // a head-on sleeve is about as long as the three-quarter one's cuff
  if (kind === 'stripes') {
    let s = 5 * k, out = ''
    const w = (cols.length >= 3 ? 3.2 : 4.4) * k
    for (const col of cols) { out += band(s, w, col); s += w + (cols.length >= 3 ? 0.15 : 2.8) * k }
    return out
  }
  if (kind === 'tiger') {
    // tapered tiger stripes reaching in from alternate edges of the sleeve, curving with the arm
    let out = ''
    ;[[6, 0, 0.8, 6.5], [17, 1, 0.74, 6], [28, 0, 0.7, 6], [39, 1, 0.6, 5.5]].forEach(([o, side, reach, w]) => {
      o *= k; w *= k
      const T = t => (side ? len - t : t)
      const tip = len * reach
      out += `<path d="M${p(T(-8), o - w / 2)}Q${p(T(tip * 0.5), o - w * 0.75 - 1.5)} ${p(T(tip), o + 1.2)}Q${p(T(tip * 0.45), o + w * 0.35)} ${p(T(-8), o + w / 2)}Z"/>`
    })
    return `<g fill="${c}">${out}</g>`
  }
  if (kind === 'loops') return band(29 * k, 3.6 * k, c, 4) + band(36 * k, 3.6 * k, c, 4)   // the Colts' two loops over the shoulder
  if (kind === 'horn') {
    if (three) return (c2 ? `<path d="M146 51L131 54Q123 55 118 62L103 101L111 99L125 67Q128 63 135 62L148 60Z" fill="${c2}"/>` : '') +
      `<path d="M146 53L131 56Q124 57 120 63L106 100L111 98L124 66Q127 61 134 60L147 58Z" fill="${c}"/>`
    // head-on: the horn's curve over the top of the shoulder
    return (c2 ? band(29 * k, 9 * k, c2, 7) : '') + band(30 * k, 6.5 * k, c, 7)
  }
  if (kind === 'bolt') {
    if (three) return `<path d="M146 53L130 57L133 59L118 66L122 67L104 104L125 70L121 69L136 62L133 60L148 58Z" fill="${c}"/>`
    const z = [[-14, 16], [len * 0.42, 21], [len * 0.36, 17], [len + 14, 25], [len + 14, 31], [len * 0.6, 25], [len * 0.66, 29], [-14, 22]]
    return `<path d="M${z.map(([t, o]) => p(t, o * k)).join('L')}Z" fill="${c}"/>`
  }
  return ''
}

// ── The jersey, three-quarters ─────────────────────────────────────────────────────────────────────────────────
// Turned to the viewer's left: the near sleeve sticks out, the far side runs off.
const TEE3 = {
  body: 'M146 50L130 54Q122 55 118 61L96 104L113 128L127 104C127 150 128 190 128 232L232 232V60Q216 52 196 49L186 48Q166 41 146 50Z',
  sleeve: 'M146 50L130 54Q122 55 118 61L96 104L113 128L127 104C128 88 130 70 134 53Z',
  seam: 'M134 53C130 70 128 88 127 104',
  hole: 'M146 50Q166 41 186 48L166 80Z',
  vee: 'M145 49L166 80L187 47',
  back: 'M148 50Q166 43 185 48',
  cuff: [[96, 104], [113, 128]],
  num: [166, 128, 36, 44],
  side: [127, 140],
}
const TANK3 = {
  body: 'M137 44L151 43Q166 84 212 48L212 212L124 212C123 172 121 140 115 112C127 98 136 74 137 44Z',
  hole: 'M151 43Q166 84 212 48L212 38Q180 34 151 43Z',
  vee: 'M151 42Q166 85 213 47',
  arm: 'M137 43C136 74 127 98 114 112',
  back: 'M152 43Q180 36 212 39',
  num: [165, 132, 40, 54],
  side: [115, 140],
}
function jersey3(kit, number, tank, u) {
  const S = tank ? TANK3 : TEE3
  const dark = lum(kit.body) < 0.035, pale = lum(kit.body) > 0.6
  const edge = dark ? '#4a515c' : shade(kit.body, 0.55)
  const hole = dark ? '#0b0c0e' : mix(kit.body, '#000', 0.55)
  const n = String(number ?? '').slice(0, 2)
  const [nx, ny, nh, nw] = S.num
  const hi = dark ? 0.2 : pale ? 0.5 : 0.17
  const out = [
    `<defs><clipPath id="${u}b"><path d="${S.body}"/></clipPath>` + (S.sleeve ? `<clipPath id="${u}s"><path d="${S.sleeve}"/></clipPath>` : '') +
    `<linearGradient id="${u}sd" gradientUnits="userSpaceOnUse" x1="${S.side[0]}" y1="0" x2="${S.side[1]}" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="${u}ch" gradientUnits="userSpaceOnUse" cx="168" cy="96" r="64"><stop offset="0" stop-color="#fff" stop-opacity="${hi}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${u}ft" gradientUnits="userSpaceOnUse" x1="0" y1="150" x2="0" y2="205"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>` +
    `<linearGradient id="${u}sl" gradientUnits="userSpaceOnUse" x1="108" y1="70" x2="124" y2="124"><stop offset="0" stop-color="#fff" stop-opacity="${hi * 0.8}"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient></defs>`,
    `<path d="${S.body}" fill="#000" opacity=".38" transform="translate(-6 5)"/>`,
    `<path d="${S.body}" fill="${kit.body}"/>`,
    `<g clip-path="url(#${u}b)">`,
  ]
  if (S.sleeve) out.push(`<g clip-path="url(#${u}s)">${sleeveTrim(kit, S.cuff, true)}<path d="${S.sleeve}" fill="url(#${u}sl)"/></g>`)
  if (n) out.push(block(n, nx, ny, nh, nw, { fill: kit.num, line: kit.line, lw: 0.3, drop: 0.16 }))
  out.push(
    `<rect x="100" y="30" width="60" height="190" fill="url(#${u}sd)"/>`,
    `<rect x="80" y="20" width="140" height="200" fill="url(#${u}ch)"/>`,
    `<rect x="80" y="140" width="140" height="80" fill="url(#${u}ft)"/>`,
    `<path d="M127 108Q146 120 156 144Q142 128 126 114Z" fill="#000" opacity=".2"/>`,
    `<path d="M124 170Q152 170 182 192Q152 180 124 177Z" fill="#000" opacity=".14"/>`,
    `<path d="M204 70Q214 106 210 150Q208 112 198 76Z" fill="#000" opacity=".12"/>`,
    `<path d="M128 132Q140 150 140 182Q134 152 124 138Z" fill="#fff" opacity="${dark ? 0.08 : 0.1}"/>`,
  )
  if (S.seam) out.push(`<path d="${S.sleeve}" fill="#000" opacity="${dark ? 0 : 0.03}"/>`,
    `<path d="${S.seam}" fill="none" stroke="#000" stroke-width="5" opacity=".14" transform="translate(2.4 0)"/>`,
    `<path d="${S.seam}" fill="none" stroke="${edge}" stroke-width="1.6"/><path d="${S.seam}" fill="none" stroke="#fff" stroke-width="1" opacity="${dark ? 0.18 : 0.26}" transform="translate(-1.6 0)"/>`)
  out.push(
    `<path d="${S.hole}" fill="${hole}"/>`,
    `<path d="${S.back}" fill="none" stroke="${shade(kit.collar, 0.62)}" stroke-width="4"/>`,
    `<path d="${S.vee}" fill="none" stroke="${shade(kit.collar, 0.55)}" stroke-width="7" stroke-linejoin="miter"/>`,
    `<path d="${S.vee}" fill="none" stroke="${kit.collar}" stroke-width="5" stroke-linejoin="miter"/>`,
    `<path d="${S.vee}" fill="none" stroke="#fff" stroke-width="1.2" opacity=".35" transform="translate(0 -1.6)"/>`,
  )
  if (tank) out.push(`<path d="${S.arm}" fill="none" stroke="${shade(kit.collar, 0.55)}" stroke-width="8.6"/><path d="${S.arm}" fill="none" stroke="${kit.collar}" stroke-width="6.4"/>`)
  out.push('</g>')
  if (S.sleeve) out.push(`<path d="M96 104L113 128" stroke="${shade(kit.body, 0.45)}" stroke-width="1.6" opacity=".7"/>`)
  out.push(`<path d="${S.body}" fill="none" stroke="${edge}" stroke-width="1.5" stroke-linejoin="round"/>`)
  return out.join('')
}

// ── The jersey, head-on and whole ──────────────────────────────────────────────────────────────────────────────
// The way it hangs in a locker: collar, both sleeves, the hem. It fills a 200 × 200 box with nothing behind it, so
// on its own it sits straight on whatever row or card it lands in.
const TEEF = {
  body: 'M74 16L42 26Q24 34 15 56L2 94L31 105L45 79L46 190Q100 198 154 190L155 79L169 105L198 94L185 56Q176 34 158 26L126 16Q100 7 74 16Z',
  sleeves: ['M42 26Q24 34 15 56L2 94L31 105L45 79Q46 50 54 22Z', 'M158 26Q176 34 185 56L198 94L169 105L155 79Q154 50 146 22Z'],
  seams: ['M54 22Q46 50 45 79', 'M146 22Q154 50 155 79'],
  cuffs: [[[2, 94], [31, 105]], [[169, 105], [198, 94]]],
  hole: 'M74 16Q100 8 126 16L100 47Z',
  vee: 'M71 13L100 49L129 13',
  back: 'M77 15Q100 8 123 15',
  num: [100, 121, 56, 94],
}
const TANKF = {
  body: 'M64 12Q100 66 136 12L152 10Q150 58 178 82L176 190Q100 198 24 190L22 82Q50 58 48 10Z',
  hole: 'M64 12Q100 66 136 12Q100 3 64 12Z',
  vee: 'M62 9Q100 72 138 9',
  arms: 'M48 8Q50 58 22 82M152 8Q150 58 178 82',
  back: 'M66 11Q100 4 134 11',
  num: [100, 128, 62, 104],
}
function jerseyF(kit, number, tank, u) {
  const S = tank ? TANKF : TEEF
  const dark = lum(kit.body) < 0.035, pale = lum(kit.body) > 0.6
  const edge = dark ? '#59616d' : shade(kit.body, 0.5)
  const hole = dark ? '#060708' : mix(kit.body, '#000', 0.6)
  const n = String(number ?? '').slice(0, 2)
  const [nx, ny, nh, nw] = S.num
  const hi = dark ? 0.22 : pale ? 0.45 : 0.2
  const out = [
    `<defs><clipPath id="${u}b"><path d="${S.body}"/></clipPath>` +
    // across the chest: the sides turning away, the light from the upper left
    `<linearGradient id="${u}sd" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="180" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>` +
    `<radialGradient id="${u}ch" gradientUnits="userSpaceOnUse" cx="84" cy="62" r="96"><stop offset="0" stop-color="#fff" stop-opacity="${hi}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${u}ft" gradientUnits="userSpaceOnUse" x1="0" y1="140" x2="0" y2="196"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient></defs>`,
    // a thin rim of light round it, so a black or navy kit still stands off a dark card or row (a white one gets a
    // soft dark rim instead)
    `<path d="${S.body}" fill="none" stroke="${pale ? '#000' : '#fff'}" stroke-opacity="${pale ? 0.22 : dark ? 0.3 : 0.12}" stroke-width="7" stroke-linejoin="round"/>`,
    `<path d="${S.body}" fill="${kit.body}"/>`,
    `<g clip-path="url(#${u}b)">`,
  ]
  if (!tank) S.sleeves.forEach((sl, i) => {
    out.push(`<clipPath id="${u}c${i}"><path d="${sl}"/></clipPath><g clip-path="url(#${u}c${i})">${sleeveTrim(kit, S.cuffs[i])}` +
      // the sleeve is its own plane, a shade off the chest
      `<path d="${sl}" fill="#000" opacity="${i ? 0.1 : dark ? 0 : 0.03}"/></g>`)
  })
  // the number, sewn on the chest (under the fabric's light and folds)
  // (drawn small, the number is the one thing to read: a bigger one takes its place, and the folds and seams go)
  if (n) out.push(`<g class="nm">${block(n, nx, ny, nh, nw, { fill: kit.num, line: kit.line, lw: 0.32, drop: 0.18, wide: 1.08 })}</g>`,
    `<g class="nb" display="none">${block(n, nx, ny + 4, nh * 1.22, nw * 1.18, { fill: kit.num, line: kit.line, lw: 0.42, wide: 1.12 })}</g>`)
  out.push(
    `<rect x="-10" y="0" width="220" height="210" fill="url(#${u}sd)"/>`,
    `<rect x="-10" y="0" width="220" height="210" fill="url(#${u}ch)"/>`,
    `<rect x="-10" y="130" width="220" height="80" fill="url(#${u}ft)"/>`,
    // folds: from each armpit in toward the chest, at the waist, and a lit ridge down the left
    `<g class="fx">`,
    `<path d="M47 92Q70 104 82 130Q66 114 46 102Z" fill="#000" opacity=".18"/>`,
    `<path d="M153 92Q130 104 118 130Q134 114 154 102Z" fill="#000" opacity=".22"/>`,
    `<path d="M50 166Q100 156 150 170Q100 164 50 173Z" fill="#000" opacity=".12"/>`,
    `<path d="M62 118Q68 148 64 180Q60 150 57 122Z" fill="#fff" opacity="${dark ? 0.07 : 0.1}"/>`,
    `<path d="M140 126Q146 150 143 178Q140 152 136 130Z" fill="#000" opacity=".1"/>`,
  )
  if (!tank) S.seams.forEach((sm, i) => out.push(
    `<path d="${sm}" fill="none" stroke="#000" stroke-width="5" opacity=".13" transform="translate(${i ? -2.4 : 2.4} 0)"/>`,
    `<path d="${sm}" fill="none" stroke="${edge}" stroke-width="1.6"/>`,
    `<path d="${sm}" fill="none" stroke="#fff" stroke-width="1" opacity="${dark ? 0.16 : 0.24}" transform="translate(${i ? 1.6 : -1.6} 0)"/>`))
  out.push('</g>')
  // the neck: the inside of the back, the back collar, the V trim
  out.push(
    `<path d="${S.hole}" fill="${hole}"/>`,
    `<path d="${S.back}" fill="none" stroke="${shade(kit.collar, 0.62)}" stroke-width="4"/>`,
    `<path d="${S.vee}" fill="none" stroke="${shade(kit.collar, 0.55)}" stroke-width="${tank ? 9 : 8}" stroke-linejoin="miter"/>`,
    `<path d="${S.vee}" fill="none" stroke="${kit.collar}" stroke-width="${tank ? 6.6 : 5.8}" stroke-linejoin="miter"/>`,
    `<path d="${S.vee}" fill="none" stroke="#fff" stroke-width="1.2" opacity=".32" transform="translate(0 -1.8)"/>`,
  )
  if (S.arms) out.push(`<path d="${S.arms}" fill="none" stroke="${shade(kit.collar, 0.55)}" stroke-width="9"/><path d="${S.arms}" fill="none" stroke="${kit.collar}" stroke-width="6.6"/>`)
  out.push('</g>')
  if (!tank) S.cuffs.forEach(([[ax, ay], [bx, by]]) => out.push(`<path d="M${ax} ${ay}L${bx} ${by}" stroke="${shade(kit.body, 0.42)}" stroke-width="1.6" opacity=".7"/>`))
  out.push(`<path d="${S.body}" fill="none" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>`)
  return out.join('')
}

// ── The team tag: its abbreviation on a slanted plate in its colours, a trim stripe along the foot ──────────────
// (x, y) is the plate's top-left before the slant, w × h its size; the slant leans it forward like a scoreboard's
function tag(team, fill, ink, x, y, w, h, u, { lean = 0.24, shadow = true } = {}) {
  const t = String(team ?? '').toUpperCase().slice(0, 5)
  const d = h * lean
  const shape = (i, top = y, bot = y + h) => `M${f1(x + d + i)} ${f1(top + i)}H${f1(x + w + d - i)}L${f1(x + w - i)} ${f1(bot - i)}H${f1(x + i)}Z`
  const pale = lum(fill) > 0.55
  // (a black or navy plate gets a lit rim, so it never sinks into a dark row)
  const rim = pale ? mix(ink, '#000', 0.2) : lum(fill) < 0.03 ? mix(fill, '#fff', 0.38) : shade(fill, 0.48)
  const stripe = contrast(ink, fill) >= 1.6 ? ink : '#ffffff'
  const sh = Math.max(2.5, h * 0.11)
  // letters that don't read on the plate (red on navy) go white; the team's second colour stays in the stripe
  if (contrast(ink, fill) < 3) ink = contrast('#ffffff', fill) >= 3 ? '#ffffff' : '#111111'
  const lineCol = pale ? null : shade(fill, 0.42)
  return `<defs><linearGradient id="${u}tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(fill, '#fff', pale ? 0.12 : 0.2)}"/><stop offset=".6" stop-color="${fill}"/><stop offset="1" stop-color="${shade(fill, pale ? 0.88 : 0.75)}"/></linearGradient></defs>` +
    (shadow ? `<path d="${shape(0)}" fill="#000" opacity=".4" transform="translate(2.5 3.5)"/>` : '') +
    `<path d="${shape(0)}" fill="${rim}"/>` +
    `<path d="${shape(2)}" fill="url(#${u}tg)"/>` +
    `<path d="M${f1(x + d * (sh + 2) / h + 2)} ${f1(y + h - sh - 2)}H${f1(x + w + d * (sh + 2) / h - 2)}L${f1(x + w - 2)} ${f1(y + h - 2)}H${f1(x + 2)}Z" fill="${stripe}"/>` +
    `<path d="M${f1(x + d + 3)} ${f1(y + 3.2)}H${f1(x + w + d - 3)}" stroke="#fff" stroke-width="1.2" opacity="${pale ? 0.6 : 0.28}"/>` +
    (t ? block(t, x + w / 2 + d * 0.5, y + (h - sh) / 2 + 0.5, (h - sh) * 0.64, w * 0.72, { wide: 1.22, fill: ink, line: lineCol, lw: 0.4, drop: pale ? 0.1 : 0.28 }) : '')
}

// the position: a short slanted chip in the rarity's metal
function posChip(pos, T, x, y, h, u) {
  const p = String(pos ?? '').toUpperCase().slice(0, 4)
  if (!p) return ''
  const w = h * (p.length > 2 ? 2.5 : 2), d = h * 0.24
  const shape = i => `M${f1(x + d + i)} ${f1(y + i)}H${f1(x + w + d - i)}L${f1(x + w - i)} ${f1(y + h - i)}H${f1(x + i)}Z`
  return `<defs><linearGradient id="${u}pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.rimHi}"/><stop offset=".5" stop-color="${T.rim}"/><stop offset="1" stop-color="${T.rimLo}"/></linearGradient></defs>` +
    `<path d="${shape(0)}" fill="#000" opacity=".4" transform="translate(2 3)"/>` +
    `<path d="${shape(0)}" fill="url(#${u}pg)"/>` +
    `<path d="M${f1(x + d + 2)} ${f1(y + 2.4)}H${f1(x + w + d - 2)}" stroke="#fff" stroke-width="1.2" opacity=".7"/>` +
    block(p, x + w / 2 + d * 0.5, y + h / 2 + 0.4, h * 0.6, w * 0.78, { fill: T.ink })
}

// ── Cards ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The rim in the rarity's metal, the app's dark panel with the rarity's light on it, the jersey whole and
// head-on, the tag and the position stacked on the left. Square slots get the square card: the jersey up top,
// the tag and the position along the foot.
function frame(shape, w, h, T, u, lightAt) {
  const [lx, ly, lr] = lightAt
  return `<defs><linearGradient id="${u}rm" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="${T.rimHi}"/><stop offset=".4" stop-color="${T.rim}"/><stop offset="1" stop-color="${T.rimLo}"/></linearGradient>` +
    `<linearGradient id="${u}pb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PANEL}"/><stop offset="1" stop-color="${PANEL_LO}"/></linearGradient>` +
    `<radialGradient id="${u}sp" gradientUnits="userSpaceOnUse" cx="${lx}" cy="${ly}" r="${lr}"><stop offset="0" stop-color="${T.glow}" stop-opacity=".62"/><stop offset=".55" stop-color="${T.glow}" stop-opacity=".16"/><stop offset="1" stop-color="${T.glow}" stop-opacity="0"/></radialGradient>` +
    `<clipPath id="${u}pc"><path d="${shape(4.5)}"/></clipPath></defs>` +
    `<path d="${shape(0)}" fill="url(#${u}rm)"/>` +
    `<path d="${shape(1.3)}" fill="none" stroke="#fff" stroke-width="1.1" opacity=".45"/>` +
    `<path d="${shape(4.5)}" fill="url(#${u}pb)"/>` +
    `<g clip-path="url(#${u}pc)"><rect width="${w}" height="${h}" fill="url(#${u}sp)"/>` +
      `<path d="${shape(4.5)}" fill="none" stroke="#000" stroke-width="5" opacity=".35"/></g>`
}

function cardWide(kit, team, number, pos, tank, T, u) {
  const known = !!(kit.badge && team)
  const shadow = `<ellipse cx="190" cy="181" rx="62" ry="6" fill="#000" opacity=".45"/>`
  const top = known ? 56 : 74
  return frame(slab, CW, CH, T, u, [190, 70, 150]) +
    `<g clip-path="url(#${u}pc)">${shadow}<g transform="translate(110 20) scale(.8)">${jerseyF(kit, number, tank, u + 'j')}</g></g>` +
    (known ? tag(team, kit.badge[0], kit.badge[1], 18, top, 92, 44, u + 't') : '') +
    posChip(pos, T, 22, top + (known ? 54 : 0), 26, u + 'p')
}

function cardSquare(kit, team, number, pos, tank, T, u) {
  const known = !!(kit.badge && team)
  const sq = i => slab(i, 200, 200, 20, 10)
  return frame(sq, 200, 200, T, u, [100, 64, 120]) +
    `<g clip-path="url(#${u}pc)"><ellipse cx="100" cy="164" rx="56" ry="5" fill="#000" opacity=".45"/><g transform="translate(29 18) scale(.71)">${jerseyF(kit, number, tank, u + 'j')}</g></g>` +
    (known ? tag(team, kit.badge[0], kit.badge[1], 16, 148, 82, 36, u + 't') : '') +
    posChip(pos, T, known ? 112 : 70, 154, 26, u + 'p')
}

// ── Public ──────────────────────────────────────────────────────────────────────────────────────────────────────
let seq = 0
// One picture for every slot a photo used to fill, chosen by the slot's own size (lib/appArt.js draws it to the
// slot's box): 72px wide or less, the jersey on its own; a square-ish slot, the square card; a wide one, the card.
const STYLE = '<style>.sq,.sm,.nb{display:none}@media (max-aspect-ratio:6/5){.big{display:none}.sq{display:inline}}' +
  '@media (max-width:72px),(max-height:60px){.big,.sq{display:none}.sm{display:inline}}' +
  '@media (max-width:44px),(max-height:44px){.fx,.nm{display:none}.nb{display:inline}}</style>'

// A player. { league: 'nfl'|'nba'|'cfb'|'cbb'|'mlb'|'soc'|'nat', team: 'CIN', colors: [c1, c2], number: 9, pos: 'QB',
//   rank: 0-3 (Common, Rare, Epic, Legend), size (height in px), variant: 'auto' | 'card' | 'square' | 'small' }
export function jerseySvg({ league = 'nfl', team = '', colors, number = '', pos = '', rank = 0, size = 240, variant = 'auto' } = {}) {
  const u = 'j' + (++seq).toString(36)
  const tank = league === 'nba' || league === 'cbb'
  const kit = kitFor(league, team, colors)
  const T = TIERS[Math.max(0, Math.min(3, rank | 0))]
  const w = Math.round(size * CW / CH)
  const svg = (cls, vb, body, fit = 'meet') => `<svg ${cls ? `class="${cls}" ` : ''}viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid ${fit}">${body}</svg>`
  if (variant === 'small') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">${jerseyF(kit, number, tank, u)}</svg>`
  if (variant === 'card') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" width="${w}" height="${size}">${cardWide(kit, team, number, pos, tank, T, u)}</svg>`
  if (variant === 'square') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">${cardSquare(kit, team, number, pos, tank, T, u)}</svg>`
  // (no size of its own: the slot's box is its viewport, so the media queries above see the slot)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">${STYLE}` +
    svg('big', `0 0 ${CW} ${CH}`, cardWide(kit, team, number, pos, tank, T, u + 'w')) +
    svg('sq', '0 0 200 200', cardSquare(kit, team, number, pos, tank, T, u + 'q')) +
    svg('sm', '0 0 200 200', jerseyF(kit, number, tank, u + 's')) + '</svg>'
}

// A team (a coach, a team row): its tag on its own, square so it drops into any logo slot. A coach's tag carries a
// small HC chip under it.
export function teamMarkSvg({ league = 'nfl', team = '', colors, badge: chip = '', size = 200 } = {}) {
  const u = 'm' + (++seq).toString(36)
  const t = String(team).toUpperCase()
  const kit = kitFor(league, t, colors)
  const [fill, ink] = kit.badge ?? ['#3a3f4a', '#ffffff']
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    tag(t, fill, ink, 4, chip ? 22 : 30, 82, 40, u, { shadow: false }) +
    (chip ? posChip(chip, TIERS[0], 27, 67, 24, u + 'p') : '') +
    '</svg>'
}

export const svgUri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)

