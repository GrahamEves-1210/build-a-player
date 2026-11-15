// A contact sheet of drawn faces (faces.js), to look at them the way the screens show them: 30 made-up men by
// position at list size (40 and 64 px) on a team slab and on the dark page, a few large, then every choice the face
// creator offers (each list, every skin tone and hair colour, each shape slider at both ends), the ages, the coaches,
// and an older save's face. It also times the builder (500 faces, built fresh) and prints the numbers.
//   bash scripts/franchise2/run.sh scripts/franchise2/faces-sheet.mjs <out.html>
import { writeFileSync } from 'node:fs'
import {
  faceUrl, faceSvg, lookOf, buildFaceUrl, coachUrl, FACE_HAIR, FACE_BEARD, FACE_HEAD, FACE_GEAR, FACE_EYES, FACE_BROWS, FACE_NOSE,
  FACE_MOUTH, FACE_STACHE, FACE_SKIN, FACE_HC, FACE_IRIS, FACE_EB, FACE_EAR, FACE_CHAIN, FACE_SLIDERS,
} from '../../src/lib/franchise2/faces'

const out = process.argv[2] ?? 'faces.html'
const POS = ['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db']
const TEAMS = ['#fb4f14', '#0b2265', '#e31837', '#203731', '#241773', '#004c54', '#a71930', '#002244']
// (30 men, a sample whose mix is the league's: about 57% Black, a third white, a few Polynesian and Latino men)
const men = Array.from({ length: 30 }, (_, i) => ({ key: `man10-${i}`, pos: POS[i % 8], color: TEAMS[i % 8] }))
const tile = (src, bg, size, label = '') => `<span style="display:inline-block;margin:3px;vertical-align:top;text-align:center;font-size:10px"><span style="display:block;width:${size}px;height:${size}px;background:${bg}"><img src="${src}" width="${size}" height="${size}"></span>${label}</span>`
const mine = { pos: 'wr', face: { skin: '#7a4a2c', head: 'square', eyes: 'almond', brows: 'thick', nose: 'broad', mouth: 'full', hair: 'locs', hc: '#b8893c', beard: 'full', stache: 'full', gear: 'none', eb: 'paint' } }
const old = { pos: 'qb', name: 'Old Save', face: { skin: '#eab996', hair: 'flow', hc: '#a8824e', beard: 'stubble', gear: 'eyeblack' } }
let h = `<!doctype html><meta charset="utf-8"><body style="margin:12px;background:#08090b;color:#aaa;font:12px sans-serif">`
const sec = t => `<div style="margin:14px 0 4px;color:#ddd">${t}</div>`
h += sec("30 made-up men, 40 px and 64 px on their team's colour (the list drawing)") + men.map(m => tile(faceUrl(m.key, m.pos, m.color, null, true), m.color, 40)).join('') + '<br>' + men.map(m => tile(faceUrl(m.key, m.pos, m.color, null, true), m.color, 64)).join('')
h += sec('the same on the dark page, 64 px') + men.map(m => tile(faceUrl(m.key, m.pos, m.color, null, true), '#08090b', 64)).join('')
h += sec("132 px: all 30 on their team colour, then a customised build and an older save's face") + men.map(m => tile(faceUrl(m.key, m.pos, m.color), m.color, 132)).join('') + tile(buildFaceUrl(mine, '#fb4f14'), '#fb4f14', 132) + tile(buildFaceUrl(old, '#0b2265'), '#0b2265', 132)
h += sec('up close: 300 px on the dark page') + [0, 2, 13, 10, 20, 9].map(i => tile(faceUrl(men[i].key, men[i].pos, men[i].color), '#08090b', 300)).join('')
const base = { ...mine.face, hc: '#16110e', eb: 'none', iris: '#2b1a10' }
const cust = (k, list, extra = {}, size = 92) => list.map(([v, label]) => tile(buildFaceUrl({ pos: 'te', face: { ...base, ...extra, [k]: v } }, '#d2aa4f'), '#20242b', size, label)).join('')
h += sec('every haircut') + cust('hair', FACE_HAIR, { beard: 'short' })
h += sec('the same haircuts on a white man, brown hair') + cust('hair', FACE_HAIR, { skin: '#eab996', hc: '#5a3b24', beard: 'none', stache: 'none', nose: 'straight', mouth: 'neutral', iris: '#47698c' })
h += sec('every beard, moustache, head') + cust('beard', FACE_BEARD, { stache: 'none', hair: 'fade' }) + '<br>' + cust('stache', FACE_STACHE, { beard: 'none', hair: 'fade' }) + '<br>' + cust('head', FACE_HEAD, { hair: 'buzz', beard: 'none', stache: 'none' })
h += sec('eyes, iris, brows, nose, mouth') + cust('eyes', FACE_EYES, { hair: 'fade' }) + '<br>' + cust('iris', FACE_IRIS, { hair: 'crew', skin: '#eab996', hc: '#5a3b24', beard: 'none', stache: 'none' }) + '<br>' + cust('brows', FACE_BROWS, { hair: 'fade' }) + '<br>' + cust('nose', FACE_NOSE, { hair: 'fade', beard: 'none', stache: 'none' }) + '<br>' + cust('mouth', FACE_MOUTH, { hair: 'fade', beard: 'none', stache: 'none' })
h += sec('gear: head, eye black, earrings, chain') + cust('gear', FACE_GEAR, { hair: 'fade' }) + cust('eb', FACE_EB, { hair: 'fade' }) + cust('ear', FACE_EAR, { hair: 'fade' }) + cust('chain', FACE_CHAIN, { hair: 'fade' })
h += sec('every skin tone (clean shaven, a fade)') + cust('skin', FACE_SKIN, { hair: 'fade', beard: 'none', stache: 'none' }, 76)
h += sec('every hair colour (a flow, a full beard, fair skin)') + cust('hc', FACE_HC, { hair: 'flow', skin: '#eab996', beard: 'full' }, 76)
h += sec('each shape slider at -1 and +1') + FACE_SLIDERS.map(([k, label]) => tile(buildFaceUrl({ pos: 'wr', face: { ...base, beard: 'none', stache: 'none', hair: 'fade', [k]: -1 } }, '#0b2265'), '#20242b', 92, `${label} -`) + tile(buildFaceUrl({ pos: 'wr', face: { ...base, beard: 'none', stache: 'none', hair: 'fade', [k]: 1 } }, '#0b2265'), '#20242b', 92, `${label} +`)).join('')
h += sec('one man aging: 22, 28, 31, 34 (league players)') + [22, 28, 31, 34].map(a => tile(faceUrl('sheet-2-14', 'wr', '#e31837', a), '#171a1f', 132, a)).join('') + [22, 28, 31, 34].map(a => tile(faceUrl('sheet-4-28', 'ol', '#203731', a), '#171a1f', 132, a)).join('')
const coaches = Array.from({ length: 24 }, (_, i) => ({ key: `coach-sheet-${i}`, ag: 36 + i * 1.4 | 0, color: TEAMS[i % 8] }))
h += sec('24 coaches, ages 36 to 68, 64 px on the team\'s colour and 132 px') + coaches.map(c => tile(coachUrl(c.key, { ag: c.ag, color: c.color }), c.color, 64)).join('')
h += '<br>' + coaches.slice(0, 8).map(c => tile(coachUrl(c.key, { ag: c.ag + 10, color: c.color }), '#171a1f', 132)).join('')

// the builder's cost: 500 different men, each built fresh (no cache)
const looks = Array.from({ length: 500 }, (_, i) => [lookOf(`bench-${i}`, POS[i % 8], 22 + (i % 13)), TEAMS[i % 8]])
for (let i = 0; i < 50; i++) faceSvg(looks[i][0], { color: looks[i][1] })   // (warm the JIT)
const ms = [], sizes = []
for (const [L, c] of looks) { const t = performance.now(); const s = faceSvg(L, { color: c }); ms.push(performance.now() - t); sizes.push(s.length) }
ms.sort((a, b) => a - b)
const urlSize = looks.slice(0, 100).reduce((a, [L, c], i) => a + faceUrl(`bench-${i}`, POS[i % 8], c).length, 0) / 100
const smSize = looks.reduce((a, [L, c]) => a + faceSvg(L, { color: c, view: 'sm' }).length, 0) / looks.length
const line = `500 faces: median ${ms[250].toFixed(3)} ms, p95 ${ms[475].toFixed(3)} ms, max ${ms[499].toFixed(2)} ms · SVG avg ${(sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024).toFixed(1)} KB (max ${(Math.max(...sizes) / 1024).toFixed(1)} KB) · data URL avg ${(urlSize / 1024).toFixed(1)} KB · list drawing avg ${(smSize / 1024).toFixed(1)} KB`
h += sec(line)
writeFileSync(out, h + '</body>')
console.log(line)
console.log('wrote', out)
