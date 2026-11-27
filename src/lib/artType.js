// Lettering for the app's drawn art (team badges, jersey numbers): the glyph outlines in lib/artGlyphs.js set as one
// path and drawn in layers the way a sewn number is built: a soft shadow, the outer twill, the inner twill, the face.
// The face is stroked in its own colour too, so a light display face reads as a heavy athletic block.
import GLYPHS from './artGlyphs.js'

const f1 = n => (Math.round(n * 10) / 10).toString()
const r1 = n => Math.round(n * 10) / 10

// a glyph's path moved right by dx (absolute M/L/Q/C commands only, which is all artGlyphs holds)
const ARGS = { M: 2, L: 2, Q: 4, C: 6 }
function shift(d, dx) {
  if (!dx) return d
  return d.replace(/([MLQC])([^MLQCZ]*)/g, (m, c, a) => {
    const n = a.match(/-?\d*\.?\d+/g)?.map(Number) ?? []
    if (n.length !== ARGS[c]) return m
    return c + n.map((v, i) => (i % 2 ? f1(v) : f1(v + dx))).join(' ').replace(/ -/g, '-')
  })
}

// a word laid out on the glyphs' own scale: { d, w (ink width), cap } with the ink starting at x 0
const layoutCache = new Map()
export function layout(set, text, track = 0) {
  const key = set + '|' + text + '|' + track
  let v = layoutCache.get(key)
  if (v) return v
  const S = GLYPHS[set]
  let x = 0, first = null, right = 0
  const parts = []
  for (const ch of String(text ?? '').toUpperCase()) {
    const g = S.g[ch]
    if (!g) { x += 22 + track; continue }
    const [adv, l, rr, d] = g
    if (first == null) first = l
    parts.push(shift(d, r1(x - first)))
    right = x + rr - first
    x += adv + track
  }
  v = { d: parts.join(''), w: Math.max(1, right), cap: S.cap }
  layoutCache.set(key, v)
  return v
}

// A word, centred on (cx, cy) by its cap height, h tall (never squeezed: made smaller to fit maxW).
//   fill     the face                 bold   extra weight on the face, in glyph units (100 to the em)
//   line     the inner twill (null)   lw     its width beyond the face
//   line2    the outer twill (null)   lw2    its width beyond the inner
//   shadow   0–1, a soft drop under it  stretch  horizontal scale (1 = as drawn)
// id: a unique id prefix, so the word is defined once and drawn by reference in every layer.
export function word(set, text, cx, cy, h, maxW, o = {}) {
  const { fill = '#fff', bold = 0, line = null, lw = 0, line2 = null, lw2 = 0, shadow = 0, stretch = 1, track = 0, id, opacity = 1 } = o
  const L = layout(set, text, track)
  if (!L.d) return ''
  const pad = bold + (line ? lw : 0) + (line2 ? lw2 : 0)
  // the scale that fits the cap height (and the outlines) in h, and the whole width in maxW
  let k = h / (L.cap + 2 * pad)
  k = Math.min(k, maxW / ((L.w + 2 * pad) * stretch))
  const kx = k * stretch
  const tf = `translate(${f1(cx - (L.w * kx) / 2)} ${f1(cy + (L.cap * k) / 2)}) scale(${kx.toFixed(4)} ${k.toFixed(4)})`
  const sw = w => `stroke-width="${f1(w)}" stroke-linejoin="miter" stroke-miterlimit="3"`
  const ref = `<path id="${id}" d="${L.d}"/>`
  const use = attrs => `<use href="#${id}" ${attrs}/>`
  let out = `<g transform="${tf}"${opacity < 1 ? ` opacity="${opacity}"` : ''}><defs>${ref}</defs>`
  if (shadow) out += use(`fill="#000" stroke="#000" ${sw(2 * pad + 3)} opacity="${shadow}" transform="translate(1.5 4)"`)
  if (line2) out += use(`fill="${line2}" stroke="${line2}" ${sw(2 * (bold + lw + lw2))}`)
  if (line) out += use(`fill="${line}" stroke="${line}" ${sw(2 * (bold + lw))}`)
  out += use(`fill="${fill}"${bold ? ` stroke="${fill}" ${sw(2 * bold)}` : ''}`)
  return out + '</g>'
}
