// Every haircut, to check the hair against the head (owner 11-17: lines that don't sit on the hair, temples peeking out
// past it, the side part's lines, the locs): each cut on every skin tone, in every hair colour, on every head at both
// ends of the shape sliders, at 40 px, 64 px and large, then the coaches and a run of made-up players. Writes the data
// URLs as JSON and a sheet beside it; given an earlier run's JSON, the sheet puts that run's face beside each one.
//   bash scripts/franchise2/run.sh scripts/franchise2/hair-sheet.mjs <out.json> [before.json]
import { writeFileSync, readFileSync } from 'node:fs'
import { faceUrl, buildFaceUrl, coachUrl, FACE_HAIR, FACE_HC, FACE_SKIN, FACE_HEAD } from '../../src/lib/franchise2/faces'

const [out = 'hair.json', prev] = process.argv.slice(2)
const base = { skin: '#5e3a22', head: 'square', eyes: 'almond', brows: 'straight', nose: 'broad', mouth: 'full', hair: 'fade', hc: '#16110e', beard: 'none', stache: 'none', gear: 'none', eb: 'none', expr: 'neutral', bone: 7 }
const B = (f, pos = 'wr', color = '#0b2265', view = 'full') => buildFaceUrl({ pos, face: { ...base, ...f } }, color, view)
const S = []
const sec = (id, title, size, items) => S.push({ id, title, size, items })
const HAIRS = FACE_HAIR.map(x => x[0])
const SKINS = ['#33201a', '#4e2f1e', '#5e3a22', '#7a4a2c', '#a06c44', '#c99064', '#deae84', '#eab996', '#f6dccb']
for (const h of HAIRS) {
  sec(`skin-${h}`, `${h}: every skin tone (black or brown hair)`, 110, SKINS.map(sk => ({ label: sk, url: B({ hair: h, skin: sk, hc: sk > '#b' ? '#5a3b24' : '#16110e' }) })))
  sec(`hc-${h}`, `${h}: every hair colour (dark skin, then fair)`, 84, [...FACE_HC.map(([c, l]) => ({ label: l, url: B({ hair: h, hc: c, skin: '#7a4a2c' }) })), ...FACE_HC.map(([c, l]) => ({ label: l, url: B({ hair: h, hc: c, skin: '#eab996' }) }))])
  const shapes = []
  for (const [hd] of FACE_HEAD) for (const [pos, wt] of [['wr', -1], ['ol', 1]]) for (const sk of ['#5e3a22', '#eab996']) shapes.push({ label: `${hd} ${pos} wt${wt} ${sk === '#eab996' ? 'w' : 'b'}`, url: B({ hair: h, head: hd, wt, chk: wt, jaw: wt, skin: sk, hc: sk === '#eab996' ? '#5a3b24' : '#16110e' }, pos) })
  for (const bone of [11, 222, 333, 444, 555, 666]) shapes.push({ label: `bone ${bone}`, url: B({ hair: h, bone, head: 'broad', wt: 1 }, 'dl') })
  sec(`shape-${h}`, `${h}: every head, narrowest and widest (wt, cheekbones, jaw at -1 / +1), a few bones`, 96, shapes)
  sec(`size-${h}`, `${h}: 40 px, 64 px (list drawing), 300 px`, 0, [
    { label: '40', size: 40, url: B({ hair: h }, 'wr', '#0b2265', 'sm') }, { label: '64', size: 64, url: B({ hair: h }, 'wr', '#0b2265', 'sm') },
    { label: '40 w', size: 40, url: B({ hair: h, skin: '#eab996', hc: '#5a3b24' }, 'wr', '#0b2265', 'sm') }, { label: '64 w', size: 64, url: B({ hair: h, skin: '#eab996', hc: '#5a3b24' }, 'wr', '#0b2265', 'sm') },
    { label: '300', size: 300, url: B({ hair: h }, 'wr', '#0b2265', 'hero') }, { label: '300 w', size: 300, url: B({ hair: h, skin: '#eab996', hc: '#5a3b24' }, 'wr', '#0b2265', 'hero') },
  ])
}
const TEAMS = ['#fb4f14', '#0b2265', '#e31837', '#203731', '#241773', '#004c54', '#a71930', '#002244']
sec('coaches', '24 coaches, ages 36 to 68', 110, Array.from({ length: 24 }, (_, i) => ({ label: `${36 + i * 1.4 | 0}`, url: coachUrl(`coach-sheet-${i}`, { ag: 36 + i * 1.4 | 0, color: TEAMS[i % 8] }) })))
const POS = ['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db']
sec('players', '60 made-up players', 110, Array.from({ length: 60 }, (_, i) => ({ label: POS[i % 8], url: faceUrl(`hair7-${i}`, POS[i % 8], TEAMS[i % 8]) })))
sec('players-sm', 'the same at 64 px', 64, Array.from({ length: 60 }, (_, i) => ({ label: '', url: faceUrl(`hair7-${i}`, POS[i % 8], TEAMS[i % 8], null, true) })))
writeFileSync(out, JSON.stringify(S))

const before = prev ? Object.fromEntries(JSON.parse(readFileSync(prev, 'utf8')).map(s => [s.id, s])) : null
const tile = (it, size, b) => {
  const z = it.size ?? size
  const one = (u, tag) => `<span style="display:inline-block;width:${z}px;height:${z}px;background:#20242b;${tag ? 'outline:1px solid #555' : ''}"><img src="${u}" width="${z}" height="${z}"></span>`
  return `<span style="display:inline-block;margin:3px 6px 3px 3px;vertical-align:top;text-align:center;font-size:10px">${b ? one(b.url, 1) : ''}${one(it.url)}<br>${it.label}</span>`
}
let h = `<!doctype html><meta charset="utf-8"><body style="margin:12px;background:#08090b;color:#aaa;font:12px sans-serif">${prev ? '<div style="color:#ddd">each pair: before (outlined), after</div>' : ''}`
for (const s of S) h += `<div id="${s.id}" style="margin:14px 0 4px;color:#ddd">${s.title}</div>` + s.items.map((it, i) => tile(it, s.size, before?.[s.id]?.items[i])).join('')
writeFileSync(out.replace(/\.json$/, '.html'), h + '</body>')
console.log('wrote', out, S.length, 'sections')
