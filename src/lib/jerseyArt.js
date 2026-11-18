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

// ── Rarity frames (lib/progress.js RARITIES: Common, Rare, Epic, Legend) ──────────────────────────────────────────
const TIERS = [
  { rimHi: '#ffffff', rim: '#c7ced8', rimLo: '#77808f', glow: '#8d98aa', panel: '#3c4555', deep: '#161b23', ink: '#1f2530' },  // common: silver
  { rimHi: '#e2f6ff', rim: '#72c6f2', rimLo: '#2a6fb3', glow: '#4aa3ee', panel: '#17489c', deep: '#081a45', ink: '#082656' },  // rare: blue
  { rimHi: '#f6eaff', rim: '#c9a5f7', rimLo: '#7a4cc2', glow: '#9a6cf6', panel: '#4b22a8', deep: '#1d0752', ink: '#2a0c68' },  // epic: purple
  { rimHi: '#fff6c4', rim: '#f3c534', rimLo: '#a7720b', glow: '#e7b52c', panel: '#8d5e0b', deep: '#3a2503', ink: '#3b2600' },  // legend: gold
]

// the card is 276 × 200, a photo's shape (the slots it fills were made for ESPN headshots, 600 × 436)
const CW = 276, CH = 200
// the frame: a peaked "house" card, inset i from the edge of the box
const HX0 = 6, HX1 = CW - 6, HYB = CH - 4, EAVE = 28, PEAK = 6, HCX = CW / 2
const SLOPE = (EAVE - PEAK) / (HCX - HX0), SEC = Math.hypot(1, SLOPE)
function house(i, r = 7) {
  const l = HX0 + i, rt = HX1 - i, b = HYB - i
  const ey = EAVE - SLOPE * i + i * SEC, py = PEAK + i * SEC
  const rr = Math.max(1, r - i * 0.4)
  return `M${f1(l)} ${f1(ey)}L${HCX} ${f1(py)}L${f1(rt)} ${f1(ey)}V${f1(b - rr)}Q${f1(rt)} ${f1(b)} ${f1(rt - rr)} ${f1(b)}H${f1(l + rr)}Q${f1(l)} ${f1(b)} ${f1(l)} ${f1(b - rr)}Z`
}

// ── The jersey, three-quarters (card) ──────────────────────────────────────────────────────────────────────────
// Turned to the viewer's left: the near sleeve sticks out over the badge, the far side runs off the card's edge.
const TEE3 = {
  body: 'M146 50L130 54Q122 55 118 61L96 104L113 128L127 104C127 150 128 190 128 232L232 232V60Q216 52 196 49L186 48Q166 41 146 50Z',
  sleeve: 'M146 50L130 54Q122 55 118 61L96 104L113 128L127 104C128 88 130 70 134 53Z',
  seam: 'M134 53C130 70 128 88 127 104',
  hole: 'M146 50Q166 41 186 48L166 80Z',
  vee: 'M145 49L166 80L187 47',
  back: 'M148 50Q166 43 185 48',
  cuff: [[96, 104], [113, 128]],       // the cuff's two corners, sleeve stripes run parallel to it
  num: [166, 128, 36, 44],
  side: [127, 140],
}
const TANK3 = {
  body: 'M137 44L151 43Q166 84 212 48L212 212L124 212C123 172 121 140 115 112C127 98 136 74 137 44Z',
  sleeve: null,
  seam: null,
  hole: 'M151 43Q166 84 212 48L212 38Q180 34 151 43Z',
  vee: 'M151 42Q166 85 213 47',
  arm: 'M137 43C136 74 127 98 114 112',
  back: 'M152 43Q180 36 212 39',
  num: [165, 132, 40, 54],
  side: [115, 140],
}

// sleeve trim, drawn inside the sleeve's clip. Bands run parallel to the cuff: o is the distance up the sleeve from
// the cuff, t the distance along it (the cuff is len long); bow curves a band round the arm.
function sleeveTrim(kit, S) {
  const [kind, ...cols] = kit.sleeve ?? ['none']
  if (!S.sleeve || kind === 'none') return ''
  const [[ax, ay], [bx, by]] = S.cuff
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy)
  const ux = dx / len, uy = dy / len, nx = uy, ny = -ux     // along the cuff, and up the sleeve
  const p = (t, o) => `${f1(ax + ux * t + nx * o)} ${f1(ay + uy * t + ny * o)}`
  const band = (s, w, col, bow = 1.5) =>
    `<path d="M${p(-14, s)}Q${p(len / 2, s - bow)} ${p(len + 14, s)}L${p(len + 14, s + w)}Q${p(len / 2, s + w - bow)} ${p(-14, s + w)}Z" fill="${col}"/>`
  const c = cols[0] ?? '#ffffff', c2 = cols[1]
  if (kind === 'stripes') {
    let s = 5, out = ''
    const w = cols.length >= 3 ? 3.2 : 4.4
    for (const col of cols) { out += band(s, w, col); s += w + (cols.length >= 3 ? 0.15 : 2.8) }
    return out
  }
  if (kind === 'tiger') {
    // tapered tiger stripes reaching in from alternate edges of the sleeve, curving with the arm
    let out = ''
    ;[[6, 0, 0.8, 6.5], [17, 1, 0.74, 6], [28, 0, 0.7, 6], [39, 1, 0.6, 5.5]].forEach(([o, side, reach, w]) => {
      const T = t => (side ? len - t : t)
      const tip = len * reach
      out += `<path d="M${p(T(-8), o - w / 2)}Q${p(T(tip * 0.5), o - w * 0.75 - 1.5)} ${p(T(tip), o + 1.2)}Q${p(T(tip * 0.45), o + w * 0.35)} ${p(T(-8), o + w / 2)}Z"/>`
    })
    return `<g fill="${c}">${out}</g>`
  }
  if (kind === 'loops') return band(29, 3.6, c, 4) + band(36, 3.6, c, 4)   // the Colts' two loops over the shoulder
  if (kind === 'horn') {
    return (c2 ? `<path d="M146 51L131 54Q123 55 118 62L103 101L111 99L125 67Q128 63 135 62L148 60Z" fill="${c2}"/>` : '') +
      `<path d="M146 53L131 56Q124 57 120 63L106 100L111 98L124 66Q127 61 134 60L147 58Z" fill="${c}"/>`
  }
  if (kind === 'bolt') return `<path d="M146 53L130 57L133 59L118 66L122 67L104 104L125 70L121 69L136 62L133 60L148 58Z" fill="${c}"/>`
  return ''
}

// the jersey on the card; u is this picture's id prefix
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
    // the shadow it casts on the panel
    `<path d="${S.body}" fill="#000" opacity=".38" transform="translate(-6 5)"/>`,
    `<path d="${S.body}" fill="${kit.body}"/>`,
    `<g clip-path="url(#${u}b)">`,
  ]
  if (S.sleeve) out.push(`<g clip-path="url(#${u}s)">${sleeveTrim(kit, S)}<path d="${S.sleeve}" fill="url(#${u}sl)"/></g>`)
  // number, sewn on the chest (under the fabric's light and folds)
  if (n) out.push(block(n, nx, ny, nh, nw, { fill: kit.num, line: kit.line, lw: 0.3, drop: 0.16 }))
  out.push(
    // the side turning away, the chest catching the light, the hem in shadow
    `<rect x="100" y="30" width="60" height="190" fill="url(#${u}sd)"/>`,
    `<rect x="80" y="20" width="140" height="200" fill="url(#${u}ch)"/>`,
    `<rect x="80" y="140" width="140" height="80" fill="url(#${u}ft)"/>`,
    // folds: from the armpit across the chest, at the waist, and a lit ridge
    `<path d="M127 108Q146 120 156 144Q142 128 126 114Z" fill="#000" opacity=".2"/>`,
    `<path d="M124 170Q152 170 182 192Q152 180 124 177Z" fill="#000" opacity=".14"/>`,
    `<path d="M204 70Q214 106 210 150Q208 112 198 76Z" fill="#000" opacity=".12"/>`,
    `<path d="M128 132Q140 150 140 182Q134 152 124 138Z" fill="#fff" opacity="${dark ? 0.08 : 0.1}"/>`,
  )
  // the sleeve is its own plane, a shade off the chest; the seam where it's sewn on
  if (S.seam) out.push(`<path d="${S.sleeve}" fill="#000" opacity="${dark ? 0 : 0.03}"/>`,
    `<path d="${S.seam}" fill="none" stroke="#000" stroke-width="5" opacity=".14" transform="translate(2.4 0)"/>`,
    `<path d="${S.seam}" fill="none" stroke="${edge}" stroke-width="1.6"/><path d="${S.seam}" fill="none" stroke="#fff" stroke-width="1" opacity="${dark ? 0.18 : 0.26}" transform="translate(-1.6 0)"/>`)
  // the neck: the inside of the back, the back collar, the V trim
  out.push(
    `<path d="${S.hole}" fill="${hole}"/>`,
    `<path d="${S.back}" fill="none" stroke="${shade(kit.collar, 0.62)}" stroke-width="4"/>`,
    `<path d="${S.vee}" fill="none" stroke="${shade(kit.collar, 0.55)}" stroke-width="7" stroke-linejoin="miter"/>`,
    `<path d="${S.vee}" fill="none" stroke="${kit.collar}" stroke-width="5" stroke-linejoin="miter"/>`,
    `<path d="${S.vee}" fill="none" stroke="#fff" stroke-width="1.2" opacity=".35" transform="translate(0 -1.6)"/>`,
  )
  if (tank) out.push(`<path d="${S.arm}" fill="none" stroke="${shade(kit.collar, 0.55)}" stroke-width="8.6"/><path d="${S.arm}" fill="none" stroke="${kit.collar}" stroke-width="6.4"/>`)
  out.push('</g>')
  // cuff hem and outline
  if (S.sleeve) out.push(`<path d="M96 104L113 128" stroke="${shade(kit.body, 0.45)}" stroke-width="1.6" opacity=".7"/>`)
  out.push(`<path d="${S.body}" fill="none" stroke="${edge}" stroke-width="1.5" stroke-linejoin="round"/>`)
  return out.join('')
}

// ── The jersey, head-on and close (avatars) ─────────────────────────────────────────────────────────────────────
const TEE0 = {
  body: 'M70 16Q100 54 130 16L168 26Q192 36 210 64V210H-10V64Q8 36 32 26Z',
  sleeves: ['M32 26Q8 36 -10 64V134L36 124C40 92 46 56 56 21Z', 'M168 26Q192 36 210 64V134L164 124C160 92 154 56 144 21Z'],
  cuffs: [[[-10, 134], [36, 124]], [[164, 124], [210, 134]]],
  hole: 'M70 16Q100 4 130 16L100 54Z',
  vee: 'M68 14L100 55L132 14',
  back: 'M72 16Q100 6 128 16',
}
const TANK0 = {
  body: 'M66 8Q100 70 134 8L150 8Q150 66 190 86L210 88V210H-10V88L10 86Q50 66 50 8Z',
  hole: 'M66 8Q100 70 134 8L134 0H66Z',
  vee: 'M65 6Q100 74 135 6',
  arms: 'M50 6Q50 66 10 86L-10 88M150 6Q150 66 190 86L210 88',
}
function jersey0(kit, number, tank, u) {
  const S = tank ? TANK0 : TEE0
  const dark = lum(kit.body) < 0.035
  const edge = dark ? '#4a515c' : shade(kit.body, 0.55)
  const n = String(number ?? '').slice(0, 2)
  const out = [
    `<defs><clipPath id="${u}k"><path d="${S.body}"/></clipPath>` +
    `<radialGradient id="${u}kh" gradientUnits="userSpaceOnUse" cx="100" cy="80" r="110"><stop offset="0" stop-color="#fff" stop-opacity="${dark ? 0.2 : 0.16}"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient></defs>`,
    `<path d="${S.body}" fill="${kit.body}"/><g clip-path="url(#${u}k)">`,
  ]
  if (!tank) {
    const [kind, ...cols] = kit.sleeve ?? ['none']
    S.cuffs.forEach(([[ax, ay], [bx, by]], side) => {
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len
      const nx = uy, ny = -ux
      let bands = ''
      if (kind !== 'none') {
        const list = kind === 'stripes' ? cols : kind === 'loops' ? [cols[0], kit.body, cols[0]] : [cols[0], cols[0]]
        let s = 8
        const w = list.length >= 3 ? 6 : 8
        for (const c of list) {
          const p = (t, o) => `${f1(ax + ux * t + nx * o)} ${f1(ay + uy * t + ny * o)}`
          bands += `<path d="M${p(-20, s)}L${p(len + 20, s)}L${p(len + 20, s + w)}L${p(-20, s + w)}Z" fill="${c}"/>`
          s += w + (list.length >= 3 ? 0.4 : 5)
        }
      }
      out.push(`<clipPath id="${u}c${side}"><path d="${S.sleeves[side]}"/></clipPath><g clip-path="url(#${u}c${side})">${bands}</g>`)
      out.push(`<path d="${S.sleeves[side]}" fill="none" stroke="${edge}" stroke-width="2"/>`)
    })
  }
  if (n) out.push(block(n, 100, 122, 82, 156, { fill: kit.num, line: kit.line, lw: 0.5, drop: 0.25 }))
  out.push(`<rect x="-10" y="0" width="220" height="220" fill="url(#${u}kh)"/>`)
  out.push(`<path d="${S.hole}" fill="${dark ? '#050506' : shade(kit.body, 0.32)}"/>`)
  if (S.back) out.push(`<path d="${S.back}" fill="none" stroke="${shade(kit.collar, 0.62)}" stroke-width="5"/>`)
  out.push(`<path d="${S.vee}" fill="none" stroke="${shade(kit.collar, 0.55)}" stroke-width="13"/><path d="${S.vee}" fill="none" stroke="${kit.collar}" stroke-width="10"/>`)
  if (S.arms) out.push(`<path d="${S.arms}" fill="none" stroke="${shade(kit.collar, 0.55)}" stroke-width="13"/><path d="${S.arms}" fill="none" stroke="${kit.collar}" stroke-width="10"/>`)
  out.push('</g>', `<path d="${S.body}" fill="none" stroke="${edge}" stroke-width="2.4" stroke-linejoin="round"/>`)
  return out.join('')
}

// ── The badge: the team's abbreviation on an oval in its colours ───────────────────────────────────────────────
function badge(team, fill, ink, cx, cy, rx, ry, u) {
  const t = String(team ?? '').toUpperCase().slice(0, 5)
  const pale = lum(fill) > 0.55
  const ring = pale ? mix(ink, '#000', 0.25) : lum(fill) < 0.03 ? mix(ink, '#000', 0.3) : shade(fill, 0.5)
  const hiTop = mix(fill, '#fff', pale ? 0.15 : 0.22), lo = shade(fill, pale ? 0.86 : 0.72)
  return `<defs><linearGradient id="${u}og" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hiTop}"/><stop offset=".55" stop-color="${fill}"/><stop offset="1" stop-color="${lo}"/></linearGradient>` +
    `<linearGradient id="${u}or" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(ring, '#fff', 0.35)}"/><stop offset="1" stop-color="${shade(ring, 0.6)}"/></linearGradient></defs>` +
    `<ellipse cx="${cx}" cy="${cy + 3}" rx="${rx + 4}" ry="${ry + 4}" fill="#000" opacity=".35"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx + 4}" ry="${ry + 4}" fill="url(#${u}or)"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${u}og)"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${f1(rx - 4.5)}" ry="${f1(ry - 4.5)}" fill="none" stroke="${ink}" stroke-width="1.4" opacity=".55"/>` +
    `<path d="M${f1(cx - rx * 0.78)} ${f1(cy - ry * 0.32)}Q${cx} ${f1(cy - ry * 1.02)} ${f1(cx + rx * 0.78)} ${f1(cy - ry * 0.32)}Q${cx} ${f1(cy - ry * 0.62)} ${f1(cx - rx * 0.78)} ${f1(cy - ry * 0.32)}Z" fill="#fff" opacity="${pale ? 0.5 : 0.16}"/>` +
    (t ? block(t, cx, cy + 0.5, ry * 0.98, rx * 1.48, { wide: 1.28, fill: ink, line: pale ? null : shade(fill, 0.45), lw: 0.4, drop: pale ? 0.12 : 0.3 }) : '')
}

// the position plaque at the foot of the card: a small peaked tab in the frame's colour
function plaque(pos, T, u) {
  const p = String(pos ?? '').toUpperCase().slice(0, 4)
  if (!p) return ''
  const w = p.length > 2 ? 78 : 64, cx = HCX - 6, x0 = cx - w / 2, x1 = cx + w / 2, top = 150
  const shape = i => `M${f1(x0 + i)} ${f1(top + 7 + i * 0.3)}L${cx} ${f1(top + i)}L${f1(x1 - i)} ${f1(top + 7 + i * 0.3)}V${f1(CH - 3 - i)}H${f1(x0 + i)}Z`
  return `<defs><linearGradient id="${u}pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.rimHi}"/><stop offset=".5" stop-color="${T.rim}"/><stop offset="1" stop-color="${T.rimLo}"/></linearGradient>` +
    `<linearGradient id="${u}pf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(T.rim, '#fff', 0.5)}"/><stop offset="1" stop-color="${mix(T.rim, '#fff', 0.12)}"/></linearGradient></defs>` +
    `<path d="${shape(0)}" fill="#000" opacity=".4" transform="translate(-2 -2)"/>` +
    `<path d="${shape(0)}" fill="url(#${u}pg)"/>` +
    `<path d="${shape(4)}" fill="url(#${u}pf)"/>` +
    `<path d="M${f1(x0 + 4)} ${f1(top + 8.2)}L${cx} ${f1(top + 4)}L${f1(x1 - 4)} ${f1(top + 8.2)}" fill="none" stroke="#fff" stroke-width="1.4" opacity=".85"/>` +
    block(p, cx, top + 26.5, 22, w - 16, { fill: T.ink })
}

// ── Public ──────────────────────────────────────────────────────────────────────────────────────────────────────
let seq = 0
// the card, and under 64px wide the close crop: two nested pictures, one shown at a time
const STYLE = '<style>.sm{display:none}@media (max-width:64px){.big{display:none}.sm{display:inline}}</style>'

// A player: his card (big) and the close crop of his jersey (64px and under).
// { league: 'nfl'|'nba'|'cfb'|'cbb'|'mlb'|'soc'|'nat', team: 'CIN', colors: [c1, c2], number: 9, pos: 'QB',
//   rank: 0-3 (Common, Rare, Epic, Legend), size (height in px), variant: 'auto' | 'card' | 'small' }
export function jerseySvg({ league = 'nfl', team = '', colors, number = '', pos = '', rank = 0, size = 240, variant = 'auto' } = {}) {
  const u = 'j' + (++seq).toString(36)
  const tank = league === 'nba' || league === 'cbb'
  const kit = kitFor(league, team, colors)
  const T = TIERS[Math.max(0, Math.min(3, rank | 0))]
  const small = () => `<defs><radialGradient id="${u}bg" cx=".5" cy=".2" r=".95"><stop offset="0" stop-color="${T.glow}"/><stop offset=".55" stop-color="${T.panel}"/><stop offset="1" stop-color="${T.deep}"/></radialGradient></defs>` +
    `<rect width="200" height="200" fill="url(#${u}bg)"/><g transform="translate(18 30) scale(.82)">` + jersey0(kit, number, tank, u + 's') + '</g>'
  const card = () => {
    const known = !!(kit.badge && team)
    return `<defs><linearGradient id="${u}rm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.rimHi}"/><stop offset=".35" stop-color="${T.rim}"/><stop offset="1" stop-color="${T.rimLo}"/></linearGradient>` +
      `<linearGradient id="${u}bv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(T.rimLo, 0.7)}"/><stop offset="1" stop-color="${T.rimHi}"/></linearGradient>` +
      `<radialGradient id="${u}pn" gradientUnits="userSpaceOnUse" cx="150" cy="30" r="220"><stop offset="0" stop-color="${mix(T.glow, '#fff', 0.25)}"/><stop offset=".36" stop-color="${T.panel}"/><stop offset="1" stop-color="${T.deep}"/></radialGradient>` +
      `<linearGradient id="${u}hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".3" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
      `<clipPath id="${u}cd"><path d="${house(0)}"/></clipPath><clipPath id="${u}pc"><path d="${house(11)}"/></clipPath></defs>` +
      // rim, its lit edge, the bevel down into the panel, the panel
      `<path d="${house(0)}" fill="url(#${u}rm)"/>` +
      `<path d="${house(1.6)}" fill="none" stroke="url(#${u}hl)" stroke-width="1.6"/>` +
      `<path d="${house(9)}" fill="url(#${u}bv)"/>` +
      `<path d="${house(11)}" fill="url(#${u}pn)"/>` +
      `<g clip-path="url(#${u}pc)">` +
        // light falling from the top of the panel, and the floor the plaque stands on
        `<path d="M98 10L178 10L232 166L44 166Z" fill="#fff" opacity=".06"/>` +
        `<rect x="0" y="166" width="${CW}" height="40" fill="${T.deep}" opacity=".6"/>` +
        `<rect x="0" y="166" width="${CW}" height="1.4" fill="${T.rimHi}" opacity=".35"/>` +
        `<path d="${house(11)}" fill="none" stroke="#000" stroke-width="5" opacity=".28"/>` +
      `</g>` +
      (known ? badge(team, kit.badge[0], kit.badge[1], 70, 98, 50, 33, u + 'o') : '') +
      `<g clip-path="url(#${u}cd)"><g transform="translate(10 -14.6) scale(1.18)">${jersey3(kit, number, tank, u + 'j')}</g></g>` +
      plaque(pos, T, u + 'p')
  }
  const w = Math.round(size * CW / CH)
  if (variant === 'small') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">${small()}</svg>`
  if (variant === 'card') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" width="${w}" height="${size}">${card()}</svg>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${size}">${STYLE}` +
    `<svg class="big" viewBox="0 0 ${CW} ${CH}" width="100%" height="100%">${card()}</svg>` +
    `<svg class="sm" viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">${small()}</svg></svg>`
}

// A team (a coach, a team row): its oval badge. A coach's badge carries HC on a plaque under it.
export function teamMarkSvg({ league = 'nfl', team = '', colors, badge: tag = '', size = 200 } = {}) {
  const u = 'm' + (++seq).toString(36)
  const t = String(team).toUpperCase()
  const kit = kitFor(league, t, colors)
  const [fill, ink] = kit.badge ?? ['#3a3f4a', '#ffffff']
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    badge(t, fill, ink, 50, tag ? 44 : 50, 42, tag ? 26 : 29, u) +
    (tag ? `<g transform="translate(50 81) scale(.62) translate(-100 -181)">${plaque(tag, TIERS[0], u + 'p')}</g>` : '') +
    '</svg>'
}

export const svgUri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
