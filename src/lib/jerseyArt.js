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

// ── The jersey: a product shot ───────────────────────────────────────────────────────────────────────────────────
// Front on, the way a team store photographs it: set-in short sleeves, a yoke across the shoulders, side panels a
// shade darker, a clean V collar. One soft light from the upper left, the far side falling away, a faint knit, and
// a soft shadow where it meets the tile: nothing drawn round it. 200 × 200, the shadow included.
const TEE = {
  body: 'M79 21C70 23 56 27 43 33C30 39 22 49 16 63L9 95C19 101 30 104 41 105L49 89C50 121 50 160 50 187C80 193 120 193 150 187C150 160 150 121 151 89L159 105C170 104 181 101 191 95L184 63C178 49 170 39 157 33C144 27 130 23 121 21L100 49Z',
  sleeves: ['M43 33C30 39 22 49 16 63L9 95C19 101 30 104 41 105L49 89C49 67 52 48 59 29Z', 'M157 33C170 39 178 49 184 63L191 95C181 101 170 104 159 105L151 89C151 67 148 48 141 29Z'],
  seams: ['M59 29C52 48 49 67 49 89', 'M141 29C148 48 151 67 151 89'],
  cuffs: [[[9, 95], [41, 105]], [[159, 105], [191, 95]]],
  panels: ['M49 89C50 121 50 160 50 187L63 189C63 160 62 124 59 93Z', 'M151 89C150 121 150 160 150 187L137 189C137 160 138 124 141 93Z'],
  yoke: 'M58 30Q100 50 142 30',
  back: 'M79 21Q100 11 121 21L100 49Z',
  vee: 'M78 20L100 50L122 20',
  backCollar: 'M80 20Q100 12 120 20',
  num: [100, 122, 50, 84],
}
const TANK = {
  body: 'M66 13Q100 64 134 13L151 11Q149 56 175 80L174 188Q100 196 26 188L25 80Q51 56 49 11Z',
  sleeves: [],
  panels: ['M25 80Q30 84 38 88L39 189L26 188Z', 'M175 80Q170 84 162 88L161 189L174 188Z'],
  back: 'M66 13Q100 4 134 13Q100 64 66 13Z',
  vee: 'M65 11Q100 68 135 11',
  arms: 'M49 9Q51 56 25 80M151 9Q149 56 175 80',
  backCollar: 'M67 12Q100 5 133 12',
  num: [100, 128, 56, 92],
}

// u: this picture's id prefix; small: drawn 44px or under (no knit, no folds, a bigger number)
function jersey(kit, number, tank, u, { small = false } = {}) {
  const S = tank ? TANK : TEE
  const L = lum(kit.body), dark = L < 0.04, pale = L > 0.6
  const n = String(number ?? '').slice(0, 2)
  const [nx, ny, nh, nw] = S.num
  // light and shade, scaled to the cloth: a black kit needs more light to show its form, a white one more shade
  const hi = dark ? 0.34 : pale ? 0.5 : 0.24, lo = dark ? 0.45 : pale ? 0.16 : 0.36
  const trim = kit.line ?? (contrast(kit.collar, kit.body) > 1.4 ? kit.collar : null)
  const collarLo = shade(kit.collar, pale ? 0.82 : 0.7)
  const out = [
    `<defs><clipPath id="${u}b"><path d="${S.body}"/></clipPath>` +
    `<filter id="${u}sh" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>` +
    (small ? '' : `<filter id="${u}sf" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter>`) +
    // the light: from the upper left, across and down
    `<linearGradient id="${u}lx" gradientUnits="userSpaceOnUse" x1="20" y1="30" x2="185" y2="120"><stop offset="0" stop-color="#fff" stop-opacity="${hi}"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="${lo * 0.35}"/><stop offset="1" stop-color="#000" stop-opacity="${lo}"/></linearGradient>` +
    `<linearGradient id="${u}ly" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="192"><stop offset="0" stop-color="#fff" stop-opacity="${hi * 0.35}"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${lo * 0.55}"/></linearGradient>` +
    `<radialGradient id="${u}ao" gradientUnits="userSpaceOnUse" cx="100" cy="30" r="40"><stop offset="0" stop-color="#000" stop-opacity="${dark ? 0.5 : 0.32}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>` +
    (small ? '' : `<pattern id="${u}kn" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.3" height="2.6" fill="#fff" opacity="${dark ? 0.022 : 0.045}"/></pattern>`) +
    `<linearGradient id="${u}cl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${mix(kit.collar, '#fff', 0.18)}"/><stop offset="1" stop-color="${collarLo}"/></linearGradient></defs>`,
    // where it meets the tile
    `<ellipse cx="100" cy="190" rx="62" ry="6" fill="#000" opacity=".55" filter="url(#${u}sh)"/>`,
    `<path d="${S.body}" fill="${kit.body}"/>`,
    `<g clip-path="url(#${u}b)">`,
    ...(S.panels ?? []).map(pn => `<path d="${pn}" fill="${shade(kit.body, pale ? 0.9 : 0.8)}"/>`),
  ]
  S.sleeves.forEach((sl, i) => out.push(`<clipPath id="${u}c${i}"><path d="${sl}"/></clipPath><g clip-path="url(#${u}c${i})">${sleeveTrim(kit, S.cuffs[i])}</g>`))
  // the number, sewn on: straight, centred, outlined in the trim
  if (n) out.push(block(n, nx, ny + (small ? 3 : 0), small ? nh * 1.2 : nh, small ? nw * 1.15 : nw, { fill: kit.num, line: trim, lw: small ? 0.42 : 0.32, stem: 2 }))
  if (!small) out.push(`<rect x="0" y="0" width="200" height="200" fill="url(#${u}kn)"/>`)
  out.push(
    `<rect x="0" y="0" width="200" height="200" fill="url(#${u}lx)"/>`,
    `<rect x="0" y="0" width="200" height="200" fill="url(#${u}ly)"/>`,
    `<rect x="0" y="0" width="200" height="200" fill="url(#${u}ao)"/>`,
  )
  if (!small) out.push(
    // soft folds: from the armpits, and where it gathers at the waist
    `<g filter="url(#${u}sf)" fill="#000"><path d="M50 96Q72 110 80 134L74 136Q66 116 49 104Z" opacity=".22"/><path d="M150 96Q128 110 120 134L126 136Q134 116 151 104Z" opacity=".3"/><path d="M58 168Q100 160 142 170L142 175Q100 167 58 174Z" opacity=".16"/></g>`,
    `<path d="M66 112Q72 145 68 178" fill="none" stroke="#fff" stroke-width="5" opacity="${dark ? 0.06 : 0.08}" filter="url(#${u}sf)"/>`,
  )
  // the seams: the sleeves set in, the yoke across the shoulders
  ;(S.seams ?? []).forEach(sm => out.push(`<path d="${sm}" fill="none" stroke="#000" stroke-width="1.1" opacity="${dark ? 0.5 : 0.22}"/><path d="${sm}" fill="none" stroke="#fff" stroke-width=".8" opacity="${dark ? 0.08 : 0.14}" transform="translate(-1.1 0)"/>`))
  if (S.yoke && !small) out.push(`<path d="${S.yoke}" fill="none" stroke="#000" stroke-width="1" opacity="${dark ? 0.4 : 0.14}"/>`)
  // the collar: the inside of the back, the back band, the V
  out.push(
    `<path d="${S.back}" fill="${dark ? '#030404' : shade(kit.body, 0.38)}"/>`,
    `<path d="${S.backCollar}" fill="none" stroke="${collarLo}" stroke-width="3.2" stroke-linecap="round"/>`,
    `<path d="${S.vee}" fill="none" stroke="url(#${u}cl)" stroke-width="${tank ? 6 : 5.4}" stroke-linejoin="miter" stroke-miterlimit="6"/>`,
    `<path d="${S.vee}" fill="none" stroke="#000" stroke-width="1" opacity=".25" stroke-linejoin="miter" stroke-miterlimit="6" transform="translate(0 3)"/>`,
  )
  if (S.arms) out.push(`<path d="${S.arms}" fill="none" stroke="${kit.collar}" stroke-width="5.4"/>`)
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
    (team ? labelL(team, 20, 36, 26, '#ffffff', 0.95) : '') +
    (pos ? labelL(pos, 20, 66, 13, '#c4ccc9') : '') +
    (T.name ? labelL(T.name, 20, 86, 11, T.line, T.a) : '') +
    `<g transform="translate(80 6) scale(.97)">${jersey(kit, number, tank, u + 'j')}</g>`
}
function cardSquare(kit, team, number, pos, tank, T, u) {
  return tile(200, 200, 18, washOf(kit), T, u, [100, 86, 120]) +
    `<g transform="translate(26 8) scale(.74)">${jersey(kit, number, tank, u + 'j')}</g>` +
    (team ? labelL(team, 18, 176, 20, '#ffffff', 0.95) : '') +
    (pos ? label(pos, 200 - 18 - 12, 176, 13, 44, '#c4ccc9') : '')
}
// a row's picture: the jersey in a small rounded tile
function cardSmall(kit, number, tank, u, small) {
  return tile(200, 200, 40, washOf(kit), TIERS[0], u, [100, 92, 130]) +
    `<g transform="translate(17 17) scale(.83)">${jersey(kit, number, tank, u + 'j', { small })}</g>`
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
  const u = 'j' + (++seq).toString(36)
  const tank = league === 'nba' || league === 'cbb'
  const kit = kitFor(league, team, colors)
  const T = TIERS[Math.max(0, Math.min(3, rank | 0))]
  const w = Math.round(size * 276 / 200)
  const svg = (cls, vb, body) => `<svg class="${cls}" viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${body}</svg>`
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

// A team (a coach, a team row): its abbreviation on a small flat chip in its colour. A coach's chip carries HC
// under it, small.
export function teamMarkSvg({ league = 'nfl', team = '', colors, badge: chip = '', size = 200 } = {}) {
  const t = String(team).toUpperCase()
  const kit = kitFor(league, t, colors)
  const [fill, ink0] = kit.badge ?? [kit.body ?? '#3a3f4a', '#ffffff']
  const ink = contrast(ink0, fill) >= 3 ? ink0 : contrast('#ffffff', fill) >= 3 ? '#ffffff' : '#111111'
  const y = chip ? 24 : 30, h = 40
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    `<rect x="4" y="${y}" width="92" height="${h}" rx="10" fill="${fill}"/>` +
    `<rect x="4.5" y="${y + 0.5}" width="91" height="${h - 1}" rx="9.5" fill="none" stroke="#fff" stroke-opacity="${lum(fill) < 0.04 ? 0.22 : 0.1}"/>` +
    label(t, 50, y + h / 2, 22, 74, ink) +
    (chip ? label(chip, 50, 82, 12, 40, '#c9d1cf') : '') +
    '</svg>'
}

export const svgUri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
