// FRANCHISE: faces for the men the game makes up (draft prospects, rookies, generated depth, free agents).
// Real players use their ESPN headshot and the player's builds their own face; this is for everyone else, and never
// for a real man without a photo (initials beat a made-up face on a real player).
//
// The look is one coherent person, not parts picked at random: first his background (weighted by position the way
// NFL rooms actually are), then a skin tone, hair style, hair colour and facial hair that go together on real players.
// A Black player gets a fade, waves, locs, twists, cornrows, a high-top or a shaved head in black hair; a white
// player gets a crew cut, a side part, a flow, a buzz; a Polynesian lineman long black hair tied back or a buzz.
//
//   lookOf(key, pos)              the look, seeded by the key (his name): { g, skin, hair, hc, beard, brow, wide }
//   faceSvg(look, { color })      an SVG headshot (100 × 100, transparent, shoulders in the jersey colour)
//   faceUrl(key, pos, color)      the same as a data: URL for an <img> (cached)
//   genFace(p, color)             a league man's face url (p: league.js's player): his key is his name
//
// Pure: no DOM, no Math.random. The same name always draws the same man (a prospect keeps his face as a rookie).
import { seeded } from '../rng'

// ── Who he is ────────────────────────────────────────────────────────────────
// background: b Black · w white · m mixed (light brown, curly) · p Polynesian · l Latino
// (the shares by room, from the game's own rosters: QB rooms and offensive lines are about half white, corners
// almost all Black, Polynesian men mostly on the lines)
const MIX = {
  qb: { b: 0.38, w: 0.52, m: 0.06, p: 0.02, l: 0.02 },
  rb: { b: 0.80, w: 0.10, m: 0.07, p: 0.02, l: 0.01 },
  wr: { b: 0.78, w: 0.13, m: 0.07, p: 0.01, l: 0.01 },
  te: { b: 0.40, w: 0.48, m: 0.07, p: 0.03, l: 0.02 },
  ol: { b: 0.40, w: 0.44, m: 0.05, p: 0.08, l: 0.03 },
  dl: { b: 0.74, w: 0.11, m: 0.06, p: 0.07, l: 0.02 },
  lb: { b: 0.62, w: 0.25, m: 0.07, p: 0.04, l: 0.02 },
  db: { b: 0.86, w: 0.06, m: 0.06, p: 0.01, l: 0.01 },
}
const SKIN = {
  b: ['#8a5634', '#7a4a2c', '#6c4026', '#5e3a22', '#50301c', '#432818', '#9c6440', '#3a2214'],
  w: ['#f1c8a8', '#eab996', '#f4d2b6', '#e0ad8c', '#ecc2a2', '#d9a582'],
  m: ['#b98058', '#c68e64', '#a9734e', '#d29c70'],
  p: ['#b07a50', '#a06c44', '#966442', '#bc875a'],
  l: ['#c99064', '#d4a074', '#b88259', '#deae84'],
}
// hair styles each background wears, and how often
const HAIR = {
  b: [['fade', 26], ['waves', 14], ['buzz', 12], ['locs', 14], ['twists', 9], ['cornrows', 7], ['hightop', 5], ['shaved', 9], ['afro', 4]],
  w: [['crew', 26], ['sidepart', 12], ['textured', 16], ['flow', 13], ['buzz', 15], ['curly', 5], ['shaved', 5], ['mullet', 4], ['fade', 4]],
  m: [['fade', 26], ['curly', 26], ['buzz', 14], ['twists', 10], ['locs', 8], ['afro', 6], ['shaved', 6], ['textured', 4]],
  p: [['bun', 30], ['long', 18], ['buzz', 18], ['fade', 18], ['curly', 10], ['shaved', 6]],
  l: [['fade', 34], ['crew', 22], ['textured', 16], ['buzz', 14], ['curly', 8], ['shaved', 6]],
}
// hair colour by background (black hair is near-black, never a cartoon black)
const HC = {
  b: [['#16110e', 88], ['#2a1d15', 10], ['#b8893c', 2]],      // (the last: blond-dyed tips, locs and twists only)
  w: [['#5a3b24', 26], ['#3a271a', 28], ['#a8824e', 18], ['#c9a46c', 8], ['#86492a', 6], ['#1e1814', 8], ['#6e4a2e', 6]],
  m: [['#1e1611', 60], ['#35251a', 34], ['#6a4528', 6]],
  p: [['#15110e', 82], ['#2a1d15', 18]],
  l: [['#17120f', 62], ['#33241a', 38]],
}
const BEARD = {
  b: [['none', 34], ['goatee', 18], ['full', 26], ['chin', 10], ['stache', 8], ['stubble', 4]],
  w: [['none', 42], ['stubble', 20], ['full', 24], ['goatee', 6], ['stache', 4], ['chin', 4]],
  m: [['none', 44], ['goatee', 18], ['full', 18], ['stubble', 12], ['chin', 8]],
  p: [['none', 36], ['full', 36], ['goatee', 18], ['stubble', 10]],
  l: [['none', 44], ['goatee', 22], ['full', 16], ['stubble', 12], ['stache', 6]],
}
const pickW = (r, list) => { const t = list.reduce((a, x) => a + x[1], 0); let u = r() * t; for (const x of list) { u -= x[1]; if (u < 0) return x[0] } return list[list.length - 1][0] }
const BIG = new Set(['ol', 'dl', 'te'])

export function lookOf(key, pos = 'wr') {
  const r = seeded(`face|${key}`)
  const mix = MIX[pos] ?? MIX.wr
  const g = pickW(r, Object.entries(mix).map(([k, v]) => [k, v * 100]))
  const skin = SKIN[g][Math.floor(r() * SKIN[g].length)]
  let hair = pickW(r, HAIR[g])
  let hc = pickW(r, HC[g])
  // dyed tips only on locs or twists; otherwise his natural colour
  if (g === 'b' && hc === '#b8893c' && hair !== 'locs' && hair !== 'twists') hc = '#16110e'
  let beard = pickW(r, BEARD[g])
  // (a shaved head usually comes with a beard; a mullet with a moustache now and then)
  if (hair === 'shaved' && beard === 'none' && r() < 0.6) beard = 'full'
  const brow = hc === '#b8893c' ? '#16110e' : hc
  return { g, skin, hair, hc, beard, brow, wide: BIG.has(pos) ? 1 : pos === 'lb' || pos === 'rb' ? 0.5 : 0, eye: r() < 0.5 ? 0 : 1 }
}

// ── Drawing ──────────────────────────────────────────────────────────────────
const hex = h => parseInt(h.slice(1, 7), 16)
const mixC = (a, b, k) => { const x = hex(a), y = hex(b); const c = s => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k); return `#${[16, 8, 0].map(s => c(s).toString(16).padStart(2, '0')).join('')}` }
const shade = (c, k) => mixC(c, '#000000', k)
const lite = (c, k) => mixC(c, '#ffffff', k)

// the head (the face's outline) for a man of width w (0 slim … 1 a lineman)
const headPath = w => {
  const L = 32.6 - w * 1.6, R = 67.4 + w * 1.6, J = 58 + w * 1.2, j = 42 - w * 1.2
  return `M${L} 41 C${L} 27 ${40 - w} 20.5 50 20.5 C${60 + w} 20.5 ${R} 27 ${R} 41 C${R} 52 ${R - 3.6} 60 ${J} 64.2 C${J - 3} 66.6 ${j + 3} 66.6 ${j} 64.2 C${L + 3.6} 60 ${L} 52 ${L} 41 Z`
}
// the hair on top of the head; back: what falls behind the head (drawn first)
function hairParts(look, w) {
  const { hair, hc, skin } = look
  const L = 32.6 - w * 1.6, R = 67.4 + w * 1.6
  const cap = (top, line) => `M${L + 0.2} 40 C${L - 0.6} 26 ${39 - w} ${top} 50 ${top} C${61 + w} ${top} ${R + 0.6} 26 ${R - 0.2} 40 C${R - 1.2} 33 ${R - 3.4} ${line + 1.6} ${R - 6.4} ${line + 0.4} C${57} ${line - 1} ${43} ${line - 1} ${L + 6.4} ${line + 0.4} C${L + 3.4} ${line + 1.6} ${L + 1.2} 33 ${L + 0.2} 40 Z`
  const sides = op => `<path d="M${L + 0.2} 40 L${L + 0.6} 47 L${L + 2.6} 47 L${L + 2.4} 33 Z M${R - 0.2} 40 L${R - 0.6} 47 L${R - 2.6} 47 L${R - 2.4} 33 Z" fill="${hc}" opacity="${op}"/>`
  const front = [], back = []
  switch (hair) {
    case 'shaved': front.push(`<path d="${cap(20.8, 28.6)}" fill="${hc}" opacity="0.12"/>`); break
    case 'buzz': front.push(`<path d="${cap(20.4, 28.4)}" fill="${hc}" opacity="0.78"/>`); break
    case 'waves': front.push(`<path d="${cap(20, 28)}" fill="${hc}"/>`, `<path d="M41 23.6 Q45.5 22.4 50 23.6 Q54.5 24.8 59 23.6 M39 26.2 Q44.5 25 50 26.2 Q55.5 27.4 61 26.2" stroke="${lite(hc, 0.16)}" stroke-width="0.7" fill="none"/>`); break
    case 'fade': front.push(`<path d="${cap(18.2, 28)}" fill="${hc}"/>`, sides(0.45)); break
    case 'hightop': front.push(`<path d="M${L + 2.4} 34 L${L + 2.8} 13 Q${L + 3.4} 10.4 ${L + 7} 10 L${R - 7} 10 Q${R - 3.4} 10.4 ${R - 2.8} 13 L${R - 2.4} 34 C${R - 4} 30 ${R - 8} 28.2 50 28.2 C${L + 8} 28.2 ${L + 4} 30 ${L + 2.4} 34 Z" fill="${hc}"/>`, sides(0.4)); break
    case 'afro': {
      front.push(`<path d="M${L - 1.6} 40 C${L - 3.6} 24 ${L + 5} 14 50 14 C${R - 5} 14 ${R + 3.6} 24 ${R + 1.6} 40 C${R} 33 ${R - 3} 29 ${R - 7} 28.6 C57 27.6 43 27.6 ${L + 7} 28.6 C${L + 3} 29 ${L} 33 ${L - 1.6} 40 Z" fill="${hc}"/>`)
      front.push([[L - 0.6, 33], [L + 1, 25.6], [L + 5.6, 19.4], [43, 15.6], [50, 14.4], [57, 15.6], [R - 5.6, 19.4], [R - 1, 25.6], [R + 0.6, 33]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.4" fill="${hc}"/>`).join(''))
      break
    }
    case 'twists': case 'locs': {
      const tip = hc === '#b8893c'
      const base = tip ? '#16110e' : hc
      front.push(`<path d="${cap(19.4, 28.4)}" fill="${base}"/>`)
      const bumps = [[L + 3, 29.4], [L + 6.5, 24], [43, 21], [50, 20], [57, 21], [R - 6.5, 24], [R - 3, 29.4], [46.5, 24.6], [53.5, 24.6]]
      front.push(bumps.map(([x, y]) => `<circle cx="${x}" cy="${y - 1}" r="${hair === 'locs' ? 3.3 : 3.8}" fill="${base}"/>`).join(''))
      if (tip) front.push(bumps.slice(0, 7).map(([x, y]) => `<circle cx="${x}" cy="${y - 2.4}" r="1.8" fill="${hc}"/>`).join(''))
      if (hair === 'locs') {
        // the locs fall behind the ears to the neck
        const xs = [L - 2.2, L + 0.8, R - 0.8, R + 2.2]
        back.push(xs.map((x, i) => `<rect x="${x - 1.8}" y="30" width="3.6" height="${30 + (i % 2) * 4}" rx="1.8" fill="${base}"/>`).join(''))
        if (tip) back.push(xs.map((x, i) => `<rect x="${x - 1.8}" y="${54 + (i % 2) * 4}" width="3.6" height="6" rx="1.8" fill="${hc}"/>`).join(''))
      }
      break
    }
    case 'cornrows': {
      front.push(`<path d="${cap(19.8, 28)}" fill="${hc}"/>`)
      const rows = [38, 43, 48, 53, 58, 62].map(x => `M${x} 28 Q${(x + 50) / 2} 22 ${50 + (x - 50) * 0.4} 20.6`).join(' ')
      front.push(`<path d="${rows}" stroke="${shade(skin, 0.1)}" stroke-width="0.8" fill="none" opacity="0.55"/>`)
      back.push(`<path d="M${L + 3} 44 L${L + 4} 62 M${R - 3} 44 L${R - 4} 62" stroke="${hc}" stroke-width="2.6" stroke-linecap="round"/>`)
      break
    }
    case 'crew': front.push(`<path d="M${L + 0.2} 39 C${L - 1} 26 ${39 - w} 18.6 50 18.6 C${61 + w} 18.6 ${R + 1} 26 ${R - 0.2} 39 C${R - 0.8} 33 ${R - 2.4} 30 ${R - 5} 28.6 C58 26.8 51 27.6 47 27 C42 26.4 ${L + 5} 28 ${L + 3} 31 C${L + 1.6} 33.6 ${L + 0.8} 36 ${L + 0.2} 39 Z" fill="${hc}"/>`); break
    case 'sidepart': front.push(`<path d="M${L} 40 C${L - 1.6} 25 ${38 - w} 17.4 50.5 17.4 C${63 + w} 17.4 ${R + 2} 25 ${R} 40 C${R - 0.8} 33 ${R - 2} 29.6 ${R - 4.4} 28 C58 25 48 24.4 42 27.6 C38.4 29.6 ${L + 2.6} 33 ${L} 40 Z" fill="${hc}"/>`, `<path d="M42.4 18.6 Q41.2 22.6 42.4 27.2" stroke="${lite(hc, 0.22)}" stroke-width="0.8" fill="none"/>`); break
    case 'textured': front.push(`<path d="M${L + 0.2} 39 C${L - 1} 25 ${39 - w} 17 50 17 C${61 + w} 17 ${R + 1} 25 ${R - 0.2} 39 C${R - 1} 33 ${R - 3} 30 ${R - 5} 29 L${R - 7} 25.6 L${R - 9.6} 28.4 L56 24.6 L53.4 28 L50 24 L47 27.6 L44 24.4 L41.6 28.4 L39 25.4 L${L + 4.6} 29.6 C${L + 2} 32 ${L + 0.8} 35.4 ${L + 0.2} 39 Z" fill="${hc}"/>`); break
    case 'curly': front.push(`<path d="${cap(18.6, 28.6)}" fill="${hc}"/>`, [[L + 3.4, 28], [L + 6.6, 22.6], [43, 19.4], [50, 18.4], [57, 19.4], [R - 6.6, 22.6], [R - 3.4, 28], [46.5, 23], [53.5, 23], [40, 26], [60, 26]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${hc}"/>`).join('')); break
    case 'flow': case 'mullet': case 'long': {
      const to = hair === 'long' ? 74 : hair === 'flow' ? 60 : 66
      back.push(`<path d="M${L - 2.4} 40 C${L - 3.4} 23 ${39 - w} 15.6 50 15.6 C${61 + w} 15.6 ${R + 3.4} 23 ${R + 2.4} 40 L${R + 3} ${to - 6} C${R + 1} ${to} ${R - 3} ${to} ${R - 4.6} ${to - 3} L${R - 4} 46 L${L + 4} 46 L${L + 4.6} ${to - 3} C${L + 3} ${to} ${L - 1} ${to} ${L - 3} ${to - 6} Z" fill="${hc}"/>`)
      front.push(`<path d="M${L + 0.2} 40 C${L - 1} 25 ${39 - w} 17.6 50 17.6 C${61 + w} 17.6 ${R + 1} 25 ${R - 0.2} 40 C${R - 1.6} 32 ${R - 6} 27.4 55 28 C48 28.6 43 27.4 38.6 29.8 C${L + 3} 32 ${L + 1} 35.6 ${L + 0.2} 40 Z" fill="${hc}"/>`)
      break
    }
    case 'bun':
      front.push(`<path d="${cap(19.6, 28.2)}" fill="${hc}"/>`, `<ellipse cx="50" cy="15.4" rx="6.4" ry="5" fill="${hc}"/>`, `<path d="M44 19 Q50 21 56 19" stroke="${lite(hc, 0.14)}" stroke-width="0.8" fill="none"/>`)
      break
  }
  return { front: front.join(''), back: back.join('') }
}
function beardOf(look, w) {
  const { beard, hc } = look
  const L = 32.6 - w * 1.6, R = 67.4 + w * 1.6, J = 58 + w * 1.2, j = 42 - w * 1.2
  const stache = `<path d="M44.4 55.4 Q50 53 55.6 55.4 Q53 56.2 50 55.6 Q47 56.2 44.4 55.4 Z" fill="${hc}"/>`
  const full = op => `<path d="M${L + 0.4} 44 C${L + 0.6} 53 ${L + 4} 60.4 ${j} 64.2 C${j + 3} 66.8 ${J - 3} 66.8 ${J} 64.2 C${R - 4} 60.4 ${R - 0.6} 53 ${R - 0.4} 44 C${R - 2.4} 50 ${R - 5} 53.4 ${R - 9} 54.6 C56 53.2 44 53.2 ${L + 9} 54.6 C${L + 5} 53.4 ${L + 2.4} 50 ${L + 0.4} 44 Z" fill="${hc}" opacity="${op}"/>`
  switch (beard) {
    case 'full': return full(0.96) + stache
    case 'stubble': return full(look.g === 'w' ? 0.2 : 0.3)
    case 'goatee': return `<path d="M45 58.6 C45.6 64.6 54.4 64.6 55 58.6 C53 60 47 60 45 58.6 Z" fill="${hc}"/>` + stache
    case 'chin': return `<path d="M46.4 59.6 C47 63.4 53 63.4 53.6 59.6 C52 60.4 48 60.4 46.4 59.6 Z" fill="${hc}"/>`
    case 'stache': return stache
    default: return ''
  }
}
export function faceSvg(look, { color = '#2a2f36' } = {}) {
  const w = look.wide ?? 0
  const sk = look.skin, dk = shade(sk, 0.16), dk2 = shade(sk, 0.3)
  const lip = look.g === 'w' ? mixC(sk, '#a0524a', 0.32) : shade(sk, 0.26)
  const nw = 11 + w * 3   // half the neck's width
  const jersey = color, collar = shade(color, 0.32)
  const { front, back } = hairParts(look, w)
  const L = 32.6 - w * 1.6, R = 67.4 + w * 1.6
  const ey = look.eye ? 42.4 : 42
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`
    + back
    + `<path d="M2 100 C3 88 14 81.4 ${50 - nw - 7} 77 C${50 - nw - 2} 75 ${50 - nw} 72.6 ${50 - nw} 70 L${50 + nw} 70 C${50 + nw} 72.6 ${50 + nw + 2} 75 ${50 + nw + 7} 77 C86 81.4 97 88 98 100 Z" fill="${jersey}"/>`
    + `<path d="M${50 - nw} 58 L${50 - nw} 75 C${50 - nw + 4} 80.4 ${50 + nw - 4} 80.4 ${50 + nw} 75 L${50 + nw} 58 Z" fill="${dk}"/>`
    + `<path d="M${50 - nw - 1.4} 73.4 C${50 - nw + 3} 81.6 ${50 + nw - 3} 81.6 ${50 + nw + 1.4} 73.4" stroke="${collar}" stroke-width="3" fill="none"/>`
    + `<ellipse cx="${L + 0.4}" cy="45" rx="3" ry="5" fill="${dk}"/><ellipse cx="${R - 0.4}" cy="45" rx="3" ry="5" fill="${dk}"/>`
    + `<path d="${headPath(w)}" fill="${sk}"/>`
    // the shadow side: a hard-edged split down the far cheek
    + `<path d="M${R} 41 C${R} 52 ${R - 3.6} 60 ${58 + w * 1.2} 64.2 C${57} 65.2 ${56} 65.6 ${55} 65.8 C${60} 58 ${62.6} 50 ${62.6} 41 C${62.6} 33 ${60} 26 ${56} 21.4 C${63} 23 ${R} 30 ${R} 41 Z" fill="${dk}" opacity="0.5"/>`
    + beardOf(look, w)
    + `<path d="M39.4 ${ey - 3.4} Q43.4 ${ey - 5.6} 47.2 ${ey - 3.8}" stroke="${look.brow}" stroke-width="1.7" stroke-linecap="round" fill="none"/>`
    + `<path d="M52.8 ${ey - 3.8} Q56.6 ${ey - 5.6} 60.6 ${ey - 3.4}" stroke="${look.brow}" stroke-width="1.7" stroke-linecap="round" fill="none"/>`
    + `<ellipse cx="43.4" cy="${ey}" rx="2.4" ry="1.35" fill="#e6ddd2"/><ellipse cx="56.6" cy="${ey}" rx="2.4" ry="1.35" fill="#e6ddd2"/>`
    + `<circle cx="43.6" cy="${ey}" r="1.3" fill="#24190f"/><circle cx="56.4" cy="${ey}" r="1.3" fill="#2a1e16"/>`
    + `<path d="M50.2 ${ey + 1} L48 50.2 Q50 51.8 52.4 50.4" stroke="${dk2}" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="M45.6 57.2 Q50 58.8 54.4 57.2" stroke="${lip}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
    + front
    + `</svg>`
}

const CACHE = new Map()
export function faceUrl(key, pos, color) {
  const k = `${key}|${pos}|${color ?? ''}`
  let u = CACHE.get(k)
  if (!u) {
    u = `data:image/svg+xml,${encodeURIComponent(faceSvg(lookOf(key, pos), { color }))}`
    if (CACHE.size > 800) CACHE.clear()
    CACHE.set(k, u)
  }
  return u
}
// a league man's face (a made-up man only: the caller checks he isn't real and isn't a build)
export const genFace = (p, color) => (p ? faceUrl(p.fk ?? p.n, p.p, color) : null)

// ── A build's face: the player's own pick ────────────────────────────────────
// Every build gets a face of its own (never a real man's photo). It starts as one coherent made-up man (lookOf, keyed
// by the setup's seed and the roster spot), and the player can change the four things a man changes about how he
// looks: skin tone, hair, hair colour, facial hair. Saved on the build as B.face = { skin, hair, hc, beard }.
//   FACE_SKIN, FACE_HAIR, FACE_HC, FACE_BEARD   the picker's choices (value, label)
//   defaultFace(key, pos)     a coherent random look, snapped to the picker's choices
//   buildLook(B)              the look the drawing reads (B.face, or the default from his name)
//   buildFaceUrl(B, color)    the build's face as a data: URL
export const FACE_SKIN = [
  ['#f4d2b6', 'FAIR'], ['#eab996', 'LIGHT'], ['#d9a582', 'SAND'], ['#deae84', 'TAN'], ['#c99064', 'OLIVE'], ['#b98058', 'GOLDEN'],
  ['#a06c44', 'BRONZE'], ['#9c6440', 'BROWN'], ['#8a5634', 'CHESTNUT'], ['#7a4a2c', 'MAHOGANY'], ['#5e3a22', 'DEEP'], ['#432818', 'DARKEST'],
]
export const FACE_HAIR = [
  ['fade', 'FADE'], ['buzz', 'BUZZ'], ['waves', 'WAVES'], ['crew', 'CREW'], ['textured', 'TEXTURED'], ['sidepart', 'PART'],
  ['curly', 'CURLS'], ['twists', 'TWISTS'], ['locs', 'LOCS'], ['cornrows', 'BRAIDS'], ['afro', 'AFRO'], ['hightop', 'HIGH TOP'],
  ['flow', 'FLOW'], ['long', 'LONG'], ['bun', 'BUN'], ['mullet', 'MULLET'], ['shaved', 'SHAVED'],
]
export const FACE_HC = [
  ['#16110e', 'BLACK'], ['#2a1d15', 'DARK'], ['#5a3b24', 'BROWN'], ['#86492a', 'AUBURN'], ['#a8824e', 'SANDY'], ['#c9a46c', 'BLOND'], ['#b8893c', 'TIPS'],
]
export const FACE_BEARD = [
  ['none', 'CLEAN'], ['stubble', 'STUBBLE'], ['chin', 'STRAP'], ['goatee', 'GOATEE'], ['stache', 'STACHE'], ['full', 'FULL'],
]
const lum = c => { const x = hex(c); return 0.299 * ((x >> 16) & 255) + 0.587 * ((x >> 8) & 255) + 0.114 * (x & 255) }
const near = (list, c) => list.reduce((a, x) => (Math.abs(lum(x[0]) - lum(c)) < Math.abs(lum(a[0]) - lum(c)) ? x : a))[0]
// (the drawing's lip colour and how dark stubble reads go by how light the skin is)
const groupOfSkin = s => (lum(s) > 175 ? 'w' : lum(s) > 120 ? 'm' : 'b')
const HAIRS = new Set(FACE_HAIR.map(x => x[0])), BEARDS = new Set(FACE_BEARD.map(x => x[0]))
export function defaultFace(key, pos) {
  const L = lookOf(`build|${key}`, pos)
  return { skin: near(FACE_SKIN, L.skin), hair: HAIRS.has(L.hair) ? L.hair : 'fade', hc: FACE_HC.some(x => x[0] === L.hc) ? L.hc : near(FACE_HC, L.hc), beard: BEARDS.has(L.beard) ? L.beard : 'none' }
}
export function buildLook(B) {
  const f = B?.face ?? defaultFace(B?.name ?? 'build', B?.pos)
  const pos = B?.pos ?? 'wr'
  // dyed tips only show on locs and twists; on any other cut the colour underneath is black
  const hc = f.hc === '#b8893c' && f.hair !== 'locs' && f.hair !== 'twists' ? '#16110e' : f.hc
  return { g: groupOfSkin(f.skin), skin: f.skin, hair: f.hair, hc, beard: f.beard, brow: f.hc === '#b8893c' ? '#16110e' : hc, wide: BIG.has(pos) ? 1 : pos === 'lb' || pos === 'rb' ? 0.5 : 0, eye: 0 }
}
const BCACHE = new Map()
export function buildFaceUrl(B, color) {
  if (!B) return null
  const L = buildLook(B)
  const k = `${L.skin}|${L.hair}|${L.hc}|${L.beard}|${L.wide}|${color ?? ''}`
  let u = BCACHE.get(k)
  if (!u) {
    u = `data:image/svg+xml,${encodeURIComponent(faceSvg(L, { color }))}`
    if (BCACHE.size > 400) BCACHE.clear()
    BCACHE.set(k, u)
  }
  return u
}
