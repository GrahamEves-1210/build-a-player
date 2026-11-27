// Colour arithmetic for the app's drawn art (lib/jerseyArt.js, lib/teamBadge.js)
export const hex = c => {
  let s = String(c || '').trim().replace('#', '')
  if (s.length === 3) s = s.split('').map(x => x + x).join('')
  return /^[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : null
}
export const rgb = c => { const h = hex(c); return h ? [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) : [128, 128, 128] }
export const lum = c => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
export const dist = (a, b) => { const p = rgb(a), q = rgb(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }
export const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
export const shade = (c, k) => toHex(rgb(c).map(v => v * k))
export const mix = (a, b, t) => { const p = rgb(a), q = rgb(b); return toHex(p.map((v, i) => v + (q[i] - v) * t)) }
export const norm = c => '#' + (hex(c) ?? '5a6270')
// the first colour that reads on bg (contrast ratio at least min), else white or near-black
export const readOn = (bg, list, min = 3) => list.find(c => c && contrast(c, bg) >= min) ?? (contrast('#ffffff', bg) >= contrast('#111111', bg) ? '#ffffff' : '#111111')
