// A team's badge in the app (owner 11-27: "AAA and instantly recognizable as that team"), drawn wherever the website
// shows a team's logo (lib/appArt.js). It is never the team's mark: an original crest shape per league, the team's
// real colours, the stripe order off its uniform's sleeves or its shirt's pattern, and its city or school
// abbreviation as a monogram. No mascot, no logo shape, no wordmark, no helmet decal, nothing traced.
//
//   NFL     a pro crest: chamfered top, a point at the foot, the sleeve stripes across it
//   NBA     a roundel: rim, pin line, the ball's seams pressed faintly into the field
//   college a varsity shield with a chevron in the school's second colour (conferences: the same, in graphite)
//   soccer  a club crest: the abbreviation on the field, the shirt's pattern (stripes, hoops, halves, a sash) below a rule
//
// Enamel and metal: a lit rim, a dark keyline that keeps a navy badge off a dark screen, a soft sheen across the top.
// Drawn 40px or under (a list row, a scoreboard) the sheen and the fine work drop out and the letters grow
// (a media query inside the SVG picks, so one picture serves every size).
import { NFL_LOOKS, NBA_LOOKS, SOC_KITS } from './teamLooks.js'
import { norm, lum, contrast, dist, shade, mix, readOn } from './artColor.js'
import { word } from './artType.js'

const f1 = n => (Math.round(n * 10) / 10).toString()

// ── The look: field, rim, letters, stripes ────────────────────────────────────────────────────────────────────────
export function badgeLook(league, team, colors) {
  if (league === 'nfl' && NFL_LOOKS[team]) return { ...NFL_LOOKS[team] }
  if (league === 'nba' && NBA_LOOKS[team]) return { ...NBA_LOOKS[team] }
  if (league === 'conf' || !colors?.[0]) return { f: '#2a3038', r: '#aeb6bf', i: '#e8ecef', l: '#14181d', b: ['#aeb6bf'] }
  const c1 = norm(colors[0]), c2 = norm(colors[1] ?? '#ffffff')
  // a white or pale first colour (a white home shirt) makes a weak field: the second colour takes the field and
  // the white goes to the rim and the letters
  let f = c1, s = c2
  if (lum(c1) > 0.7 && lum(c2) < 0.5) { f = c2; s = c1 }
  // a second colour too close to the first to show (red on red) gives way to white, or near-black on a pale field
  if (dist(f, s) < 70) s = lum(f) > 0.45 ? '#16181b' : '#ffffff'
  // letters: on a pale field, the second colour (or near-black) edged in white; on a dark one, the second colour
  // when it's a bright one that reads (maize on navy), else white, edged in the second colour
  const pale = lum(f) > 0.4
  let i, l
  if (pale) { i = contrast(s, f) >= 3 && lum(s) < 0.3 ? s : '#16181b'; l = '#ffffff' }
  else {
    i = s !== '#ffffff' && contrast(s, f) >= 3.2 && lum(s) > 0.25 ? s : '#ffffff'
    l = i === s ? shade(f, 0.4) : contrast(s, f) >= 1.5 ? s : shade(f, 0.45)
    if (dist(l, i) < 40) l = shade(f, 0.45)
  }
  const look = { f, r: s, i, l, b: [s, lum(s) > 0.75 ? shade(f, 0.55) : '#ffffff', s] }
  if (league === 'soc' && SOC_KITS[team]) look.k = SOC_KITS[team]
  return look
}

// ── Shapes (100 × 100, drawn on the rim's centre line: the rim is a stroke either side) ───────────────────────────
const SHAPE = {
  pro: 'M21 9H79L91 19V54C91 69 77 80 50 93C23 80 9 69 9 54V19Z',
  shield: 'M11 10H89V50C89 72 73 84 50 93C27 84 11 72 11 50Z',
  club: 'M11 13Q50 4 89 13V52C89 73 72 85 50 93C28 85 11 73 11 52Z',
}
const isRound = kind => kind === 'round'
const shapeEl = (kind, attrs) => (isRound(kind) ? `<circle cx="50" cy="50" r="41.5" ${attrs}/>` : `<path d="${SHAPE[kind]}" ${attrs}/>`)
const kindOf = league => (league === 'nfl' ? 'pro' : league === 'nba' ? 'round' : league === 'soc' || league === 'nat' ? 'club' : 'shield')

// the field's pattern, clipped to the field
function pattern(kind, look, u) {
  const out = []
  if (kind === 'pro' && look.b?.length) {
    // the sleeve stripes, across the crest below the letters
    const n = look.b.length, w = n >= 3 ? 4.2 : 5.2, gap = n >= 3 ? 0 : 2.4
    let y = 69 - (n * w + (n - 1) * gap) / 2
    for (const c of look.b) { out.push(`<rect x="0" y="${f1(y)}" width="100" height="${f1(w)}" fill="${c}"/>`); y += w + gap }
  }
  if (kind === 'round') {
    // the team's own pattern, then the ball's seams pressed into the field over it, so every roundel keeps its
    // seams (owner 11-27: Portland's stripes had hidden them); on a black field the seams are a lighter grey, not
    // a darker black that can't show (Portland, Brooklyn, Miami, San Antonio)
    if (look.k === 'pin') for (let x = 14; x < 90; x += 7) out.push(`<rect x="${x}" y="0" width="1.1" height="100" fill="${look.p}" opacity=".5"/>`)
    if (look.k === 'diag') for (let x = -40; x < 110; x += 13) out.push(`<path d="M${x} 100L${x + 50} 0H${x + 54}L${x + 4} 100Z" fill="${look.r}" opacity=".5"/>`)
    out.push(`<g fill="none" stroke="${lum(look.f) < 0.03 ? mix(look.f, '#ffffff', 0.2) : shade(look.f, 0.62)}" stroke-width="1.6" opacity="${look.k ? 0.8 : 0.55}"><path d="M8 50H92M50 8V92"/><path d="M22 18C34 34 34 66 22 82M78 18C66 34 66 66 78 82"/></g>`)
  }
  if (kind === 'shield') {
    // a varsity chevron in the second colour, edged in the field's own shade
    const c = look.b?.[0] ?? look.r
    const edge = lum(look.f) < 0.05 ? mix(look.f, '#fff', 0.25) : shade(look.f, 0.6)
    out.push(`<path d="M0 57L50 75L100 57V68L50 86L0 68Z" fill="${edge}"/><path d="M0 59L50 77L100 59V66L50 84L0 66Z" fill="${c}"/>`)
  }
  if (kind === 'club' && look.k) {
    const [p, a, b] = look.k
    out.push(`<clipPath id="${u}lo"><rect x="0" y="58" width="100" height="50"/></clipPath><g clip-path="url(#${u}lo)">`)
    if (p === 'stripes') { out.push(`<rect width="100" height="100" fill="${a}"/>`); for (let x = 9; x < 100; x += 16) out.push(`<rect x="${x}" y="0" width="8" height="100" fill="${b}"/>`) }
    if (p === 'hoops') { out.push(`<rect width="100" height="100" fill="${a}"/>`); for (let y = 6; y < 100; y += 14) out.push(`<rect x="0" y="${y}" width="100" height="7" fill="${b}"/>`) }
    if (p === 'halves') out.push(`<rect width="50" height="100" fill="${a}"/><rect x="50" width="50" height="100" fill="${b}"/>`)
    if (p === 'sash') out.push(`<rect width="100" height="100" fill="${a}"/><path d="M-10 18L18 -10L110 82L82 110Z" fill="${b}"/>`)
    if (p === 'diag') out.push(`<path d="M0 0H100L0 100Z" fill="${a}"/><path d="M100 0V100H0Z" fill="${b}"/>`)
    if (p === 'band') out.push(`<rect width="100" height="100" fill="${a}"/><rect x="0" y="22" width="100" height="14" fill="${b}"/>`)
    if (p === 'centre') out.push(`<rect width="100" height="100" fill="${a}"/><rect x="36" y="0" width="28" height="100" fill="#ffffff"/><rect x="40" y="0" width="20" height="100" fill="${b}"/>`)
    out.push(`</g><rect x="0" y="56" width="100" height="3.4" fill="${look.r}"/><rect x="0" y="59.4" width="100" height="1" fill="#000" opacity=".3"/>`)
  }
  return out.join('')
}


// ── Drawing ─────────────────────────────────────────────────────────────────────────────────────────────────────
let seq = 0
function badge(kind, look, t, u, small) {
  const rimW = small ? 7 : 6, key = small ? 2.2 : 1.6
  const rimHi = mix(look.r, '#ffffff', lum(look.r) > 0.6 ? 0.5 : 0.35), rimLo = shade(look.r, lum(look.r) > 0.6 ? 0.72 : 0.6)
  const fHi = mix(look.f, '#ffffff', lum(look.f) < 0.03 ? 0.14 : 0.12), fLo = shade(look.f, 0.72)
  // a rim the same colour as the field (none given): lifted so the edge still shows
  // a club whose shirt has a pattern: the pattern below a rule, the letters on the plain field above it
  const banner = kind === 'club' && look.k && !small
  const n = t.length
  // the monogram: as big as the shape allows, smaller for three letters
  const [cy, h, maxW] = kind === 'round' ? [50, n >= 3 ? 30 : 36, 60] : kind === 'club' ? (banner ? [35, n >= 3 ? 24 : 28, 58] : [46, n >= 3 ? 30 : 36, 62])
    : kind === 'pro' ? [small ? 44 : 41, n >= 3 ? (small ? 34 : 29) : (small ? 38 : 34), small ? 70 : 64] : [small ? 44 : 40, n >= 3 ? (small ? 32 : 29) : (small ? 38 : 34), small ? 70 : 64]
  // the letters: a collegiate block on the football crests and the college shields, the app's condensed face on
  // the roundel and the club crest, and on every badge drawn small (it holds up best at 20px)
  const varsity = !small && (kind === 'pro' || kind === 'shield')
  const ink = look.i
  const out = [
    `<defs><clipPath id="${u}c">${shapeEl(kind, '')}</clipPath>` +
    `<linearGradient id="${u}r" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${rimHi}"/><stop offset=".45" stop-color="${look.r}"/><stop offset="1" stop-color="${rimLo}"/></linearGradient>` +
    `<linearGradient id="${u}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fHi}"/><stop offset=".55" stop-color="${look.f}"/><stop offset="1" stop-color="${fLo}"/></linearGradient></defs>`,
    // the keyline, the field and its pattern, the pin line, then the rim over its edge
    shapeEl(kind, `fill="#0a0c0f" stroke="#0a0c0f" stroke-width="${rimW + 2 * key}" stroke-linejoin="round"`),
    shapeEl(kind, `fill="url(#${u}f)"`),
    `<g clip-path="url(#${u}c)">`,
    small && kind !== 'pro' ? '' : pattern(kind, look, u),
    look.p && !small ? shapeEl(kind, `fill="none" stroke="${look.p}" stroke-width="${rimW + 4.4}"`) : '',
    '</g>',
    shapeEl(kind, `fill="none" stroke="url(#${u}r)" stroke-width="${rimW}" stroke-linejoin="round"`),
  ]
  out.push(word(varsity ? 'varsity' : 'mono', t, 50, cy, h, maxW, { fill: ink, line: look.l, lw: small ? 4 : 3.2, line2: '#0a0c0f', lw2: small ? 2 : 1.6, bold: varsity ? 3 : 0.8, track: varsity ? 3 : 5, shadow: small ? 0 : 0.35, id: u + 'm' }))
  if (!small) {
    // the sheen: a pane of light across the top left, and a lit edge just inside the rim
    out.push(`<g clip-path="url(#${u}c)"><path d="M-5 -5H105V20L-5 60Z" fill="#fff" opacity="${lum(look.f) > 0.5 ? 0.16 : 0.09}"/></g>`)
    // the rim's lit edge
    out.push(shapeEl(kind, `fill="none" stroke="#fff" stroke-width=".7" opacity=".4" transform="translate(50 50) scale(1.04) translate(-50 -50)"`))
  }
  return out.join('')
}

// A team's badge. { league: 'nfl'|'nba'|'cfb'|'cbb'|'soc'|'nat'|'mlb'|'conf', team: 'KC', colors: [c1, c2] (any
// team without a hand-set look), chip: a small plate under it ('HC' on a coach), size }
const prep = (league, team, colors) => {
  const t = String(team ?? '').toUpperCase().replace(/[^A-Z0-9&]/g, '').slice(0, 4)
  return [league === 'conf' ? 'shield' : kindOf(league), badgeLook(league, t, colors), t]
}
// the badge's drawing on its own (100 × 100 units), for a picture that sets it in a corner (lib/jerseyArt.js)
export function badgeBody({ league = 'nfl', team = '', colors, small = false } = {}) {
  const [kind, look, t] = prep(league, team, colors)
  return badge(kind, look, t, 'c' + (++seq).toString(36) + '_', small)
}

export function teamBadgeSvg({ league = 'nfl', team = '', colors, chip = '', size = 200 } = {}) {
  const u = 'b' + (++seq).toString(36) + '_'
  const [kind, look, t] = prep(league, team, colors)
  const both = (body, bodySm) => `<style>.s{display:none}@media (max-width:40px){.l{display:none}.s{display:inline}}</style><g class="l">${body}</g><g class="s">${bodySm}</g>`
  if (chip) {
    // a coach: the badge a little smaller, his title on a dark plate across its foot
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><g transform="translate(12 2) scale(.76)">${badge(kind, look, t, u, false)}</g>` +
      `<rect x="28" y="76" width="44" height="18" rx="4" fill="#0a0c0f"/><rect x="29.5" y="77.5" width="41" height="15" rx="3" fill="#20262d" stroke="${look.r}" stroke-width="1"/>` +
      word('mono', chip, 50, 85, 9, 34, { fill: '#e8ecef', id: u + 'h' }) + '</svg>'
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    both(badge(kind, look, t, u + 'l', false), badge(kind, look, t, u + 's', true)) + '</svg>'
}

// A conference: its three letters on the slanted tag the app used before the badges (owner 11-25 and 11-27: a
// conference must not look like a team), finished like the badges: a dark keyline, a brushed-silver rim, a graphite
// plate lit from above, a silver stripe along its foot and the letters in the badges' face. Drawn 40px or under the
// sheen and the stripe's highlight drop out.
export function confTagSvg({ text = '', size = 200 } = {}) {
  const u = 'f' + (++seq).toString(36) + '_'
  const t = String(text).toUpperCase().replace(/[^A-Z0-9&]/g, '').slice(0, 4)
  const x = 6, y = 28, w = 82, h = 44, d = h * 0.24
  const plate = i => `M${f1(x + d + i)} ${f1(y + i)}H${f1(x + w + d - i)}L${f1(x + w - i)} ${f1(y + h - i)}H${f1(x + i)}Z`
  const sh = 7
  const body = small => `<path d="${plate(-1.6)}" fill="#0a0c0f"/>` +
    `<path d="${plate(0)}" fill="url(#${u}r)"/>` +
    `<path d="${plate(2.6)}" fill="url(#${u}f)"/>` +
    // the stripe along the foot
    `<path d="M${f1(x + 2.6 + d * (sh + 2.6) / h)} ${f1(y + h - 2.6 - sh)}H${f1(x + w + d * (sh + 2.6) / h - 2.6)}L${f1(x + w - 2.6)} ${f1(y + h - 2.6)}H${f1(x + 2.6)}Z" fill="url(#${u}r)"/>` +
    (small ? '' : `<path d="M${f1(x + d + 4)} ${f1(y + 4.4)}H${f1(x + w + d - 4)}" stroke="#fff" stroke-width=".9" opacity=".4"/>` +
      `<path d="M${f1(x + d + 2.6)} ${f1(y + 2.6)}H${f1(x + w + d - 2.6)}L${f1(x + w - 2.6 - d * 0.45)} ${f1(y + h * 0.45)}H${f1(x + 2.6 + d * 0.55)}Z" fill="#fff" opacity=".07"/>`) +
    word('mono', t, x + w / 2 + d * 0.5, y + (h - sh) / 2 + 1, small ? 26 : 23, w * (small ? 0.74 : 0.66), { fill: '#eef1f3', line: '#0a0c0f', lw: small ? 4 : 3, bold: 0.6, track: 5, shadow: small ? 0 : 0.3, id: u + (small ? 's' : 'l') })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><defs>` +
    `<linearGradient id="${u}r" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#f1f4f6"/><stop offset=".45" stop-color="#b4bcc4"/><stop offset="1" stop-color="#6c747d"/></linearGradient>` +
    `<linearGradient id="${u}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b434c"/><stop offset=".6" stop-color="#262c33"/><stop offset="1" stop-color="#191d22"/></linearGradient></defs>` +
    `<style>.s{display:none}@media (max-width:40px){.l{display:none}.s{display:inline}}</style><g class="l">${body(false)}</g><g class="s">${body(true)}</g></svg>`
}
