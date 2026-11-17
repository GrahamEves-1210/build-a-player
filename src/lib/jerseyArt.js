// Jersey art for the app (the owner, 2026-11-17): the iOS/Android app shows no player photos and no team logos,
// the way FanDuel and Griddy stay clear of NFL licensing. A player is a jersey in his team's colours with his number
// on it, his team's abbreviation on a tag above the shoulder and his position on a badge under it; a team is its
// abbreviation on an oval tag in its colours. Plain SVG strings, so the same art works as an <img>, inside an SVG
// (a helmet decal) and on a share card's canvas. The website never loads this (lib/appArt.js decides).
//
// Inside the SVG a media query hides the tag and the badge when the picture is drawn small (a 40px avatar shows the
// jersey and the number; a card shows all three), so one picture fits every slot a photo used to fill.

const hex = c => {
  let s = String(c || '').trim().replace('#', '')
  if (s.length === 3) s = s.split('').map(x => x + x).join('')
  return /^[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : null
}
const rgb = c => { const h = hex(c); return h ? [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) : [128, 128, 128] }
const lum = c => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const dist = (a, b) => { const p = rgb(a), q = rgb(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }
const shade = (c, k) => '#' + rgb(c).map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join('')
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))

// the two colours as they read on the kit: the body, the trim (collar, sleeve stripes) and the number
export function kitColors(c1, c2) {
  const body = '#' + (hex(c1) ?? '5a6270')
  let trim = '#' + (hex(c2) ?? 'ffffff')
  if (dist(body, trim) < 60) trim = lum(body) > 0.4 ? '#111111' : '#ffffff'
  // the number: white on a dark or bright body, the trim colour (or black) on a pale one
  const num = contrast('#ffffff', body) >= 2.2 ? '#ffffff' : contrast(trim, body) >= 2.5 ? trim : '#111111'
  // the tag: the body colour with the trim colour on it, the way the team writes its name
  const tagText = contrast(trim, body) >= 2.2 ? trim : num
  return { body, trim, num, tagText }
}

const FONT = `font-family="'Arial Black','Helvetica Neue',Arial,Helvetica,sans-serif" font-weight="900"`

// a word that fits its box: shrink the letters, then squeeze them
const fitText = (text, cx, cy, maxW, size, fill, extra = '') => {
  const t = String(text ?? '')
  const est = t.length * size * 0.68
  const fs = est > maxW * 1.25 ? size * (maxW * 1.25) / est : size
  const squeeze = t.length * fs * 0.68 > maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : ''
  return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" ${FONT} font-size="${fs.toFixed(1)}" fill="${fill}"${squeeze}${extra}>${esc(t)}</text>`
}

// the football (and baseball / soccer) shirt, front on: shoulders, short sleeves with two stripes, a V collar
const TEE = {
  body: 'M44 24 L52 22 Q60 34 68 22 L76 24 L92 30 L104 52 L90 60 L86 54 L86 108 L34 108 L34 54 L30 60 L16 52 L28 30 Z',
  shade: 'M34 54 L34 108 L44 108 L44 50 Z',
  collar: 'M52 22 Q60 34 68 22 L72 23 Q60 44 48 23 Z',
  stripes: 'M19.5 46.5 L31.5 55.5 L30 58 L18 49 Z M22.5 41.5 L33 49.5 L31.8 52 L21.2 44 Z M100.5 46.5 L88.5 55.5 L90 58 L102 49 Z M97.5 41.5 L87 49.5 L88.2 52 L98.8 44 Z',
  numY: 76,
}
// basketball: a tank, deep armholes and a scoop neck, trimmed in the second colour
const TANK = {
  body: 'M40 20 L50 20 Q60 40 70 20 L80 20 Q80 44 92 54 L92 108 L28 108 L28 54 Q40 44 40 20 Z',
  shade: 'M28 54 L28 108 L38 108 L38 50 Z',
  collar: 'M50 20 Q60 40 70 20 L73 20 Q60 47 47 20 Z',
  stripes: 'M40 20 L37 20 Q37 46 26 54 L28 57 Q41 47 40 20 Z M80 20 L83 20 Q83 46 94 54 L92 57 Q79 47 80 20 Z',
  numY: 78,
}

const STYLE = '<style>@media (max-width:64px){.big{display:none}}</style>'

// A player: jersey in his team's colours, his number, and (drawn big enough) his team tag and his position badge.
// { league: 'nfl'|'nba'|'cfb'|'cbb'|'mlb'|'soc'|'nat', team: 'CIN', colors: [c1, c2], number: 9, pos: 'QB' }
export function jerseySvg({ league = 'nfl', team = '', colors, number = '', pos = '', size = 240 } = {}) {
  const tank = league === 'nba' || league === 'cbb'
  const S = tank ? TANK : TEE
  const known = !!(colors && colors[0])
  const k = known ? kitColors(colors[0], colors[1]) : { body: '#5a6270', trim: '#c9ced6', num: '#ffffff', tagText: '#ffffff' }
  const n = String(number ?? '').slice(0, 2)
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}">`, STYLE,
    `<path d="${S.body}" fill="${k.body}" stroke="${shade(k.body, 0.62)}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path d="${S.shade}" fill="#000" opacity=".12"/>`,
    `<path d="${S.stripes}" fill="${k.trim}"/>`,
    `<path d="${S.collar}" fill="${k.trim}"/>`,
    n ? fitText(n, 60, S.numY, n.length > 1 ? 40 : 24, 34, k.num, ` stroke="${shade(k.body, 0.55)}" stroke-width=".8" paint-order="stroke"`) : '',
  ]
  if (team && known) {
    parts.push(`<g class="big"><rect x="5" y="6" width="44" height="21" rx="10.5" fill="${k.body}" stroke="${k.tagText}" stroke-width="2"/>`,
      fitText(team, 27, 16.8, 34, 13, k.tagText), '</g>')
  }
  if (pos) {
    parts.push(`<g class="big"><rect x="${60 - 15}" y="99" width="30" height="17" rx="3" fill="#14161c" stroke="#ffffff" stroke-opacity=".55" stroke-width="1.2"/>`,
      fitText(pos, 60, 107.8, 23, 11, '#ffffff'), '</g>')
  }
  parts.push('</svg>')
  return parts.join('')
}

// A team: its abbreviation on an oval tag in its colours (where a logo was). A coach is his team's tag with HC.
export function teamMarkSvg({ team = '', colors, badge = '', size = 200 } = {}) {
  const known = !!(colors && colors[0])
  const k = known ? kitColors(colors[0], colors[1]) : { body: '#3a3f4a', tagText: '#ffffff' }
  const t = String(team).toUpperCase()
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">`,
    `<ellipse cx="50" cy="50" rx="46" ry="${badge ? 26 : 30}" fill="${k.body}" stroke="${k.tagText}" stroke-width="4"/>`,
    fitText(t, 50, 51, t.length > 3 ? 70 : 62, t.length > 3 ? 28 : 32, k.tagText),
    badge ? `<rect x="35" y="73" width="30" height="17" rx="3" fill="#14161c" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>${fitText(badge, 50, 81.8, 22, 11, '#fff')}` : '',
    '</svg>',
  ].join('')
}

export const svgUri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
