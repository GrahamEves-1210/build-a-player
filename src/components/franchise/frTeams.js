import { NFL_TEAMS } from '../../data/nfl-teams'

// The 32 clubs as Franchise shows them: the name, the logo, the division, and the ACCENT: the one colour a
// franchise's screens are dressed in (franchise.css --fr-team, with --fr-ink for type on it).
//
// The accent is the club's own colour whenever it can be seen on the mode's near-black field. Eleven clubs wear
// a navy, a black or a deep green that disappears there, so theirs is lifted: the same hue, lighter, until a bar
// of it reads against the field (the Raiders' black has no hue to lift: theirs is the silver).

const hexToRgb = hex => { const h = String(hex).replace('#', ''); const n = parseInt(h.length === 3 ? h.replace(/./g, c => c + c) : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const lin = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
export const luminance = hex => { const [r, g, b] = hexToRgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) }
const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
function toHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
  if (!d) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')
}

export const FIELD = '#0a0c0f'
const READS = 2.6   // a bar of the accent against the field: at least this contrast
// the colour a bar is drawn in on the field, from the club's two colours
export function accentOf(color, color2) {
  if (contrast(color, FIELD) >= READS) return color
  let [h, s, l] = toHsl(color)
  if (s < 0.12) return color2 && contrast(color2, FIELD) >= READS ? color2 : '#a5acaf'
  let out = color
  for (let i = 0; i < 40 && contrast(out, FIELD) < READS; i++) { l += 0.015; out = fromHsl(h, Math.min(1, s), Math.min(0.7, l)) }
  return out
}
// type on a bar of that colour: white unless the bar is a light one
export const inkOn = color => (contrast(color, '#ffffff') >= 3 ? '#ffffff' : FIELD)

const nick = name => name.split(' ').pop()
export const FR_TEAMS = NFL_TEAMS.map(t => {
  const accent = accentOf(t.color, t.color2)
  return { short: t.short, name: t.name, nick: nick(t.name), city: t.name.slice(0, t.name.length - nick(t.name).length - 1), logo: t.logo, raw: t.color, color2: t.color2, accent, ink: inkOn(accent), conf: t.conf, div: t.div }
})
export const TEAM = Object.fromEntries(FR_TEAMS.map(t => [t.short, t]))
export const teamOf = short => TEAM[short] ?? { short: short ?? '', name: short ?? '', nick: short ?? '', city: '', logo: null, raw: '#12161b', color2: '#12161b', accent: '#f2f4f5', ink: FIELD, conf: '', div: '' }
// the eight divisions in the order a standings page reads, each with its four clubs (alphabetical by city)
export const DIVISIONS = ['AFC East', 'AFC North', 'AFC South', 'AFC West', 'NFC East', 'NFC North', 'NFC South', 'NFC West']
  .map(div => ({ div, conf: div.slice(0, 3), teams: FR_TEAMS.filter(t => t.div === div).sort((a, b) => a.name.localeCompare(b.name)) }))

// The mode's colours go on <html> (franchise.css reads them everywhere, sheets and the game day included)
export function dressFor(short) {
  const s = document.documentElement.style
  if (!short || !TEAM[short]) { s.removeProperty('--fr-team'); s.removeProperty('--fr-ink'); s.removeProperty('--fr-team-raw'); return }
  const t = TEAM[short]
  s.setProperty('--fr-team', t.accent); s.setProperty('--fr-ink', t.ink); s.setProperty('--fr-team-raw', t.raw)
}
