// A contact sheet of drawn faces (faces.js), to look at them the way the screens show them: 28 made-up men by
// position at lower-third size on a team slab and on the dark page, a few large, and every haircut and beard.
//   bash scripts/franchise2/run.sh scripts/franchise2/faces-sheet.mjs <out.html>
import { writeFileSync } from 'node:fs'
import { faceUrl, buildFaceUrl, coachUrl, FACE_HAIR, FACE_BEARD, FACE_HEAD, FACE_GEAR } from '../../src/lib/franchise2/faces'

const out = process.argv[2] ?? 'faces.html'
const POS = ['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db']
const TEAMS = ['#fb4f14', '#0b2265', '#e31837', '#203731', '#241773', '#004c54', '#a71930', '#002244']
const men = Array.from({ length: 28 }, (_, i) => ({ key: `sheet-${i}-${i * 7}`, pos: POS[i % 8], color: TEAMS[i % 8] }))
const tile = (src, bg, size) => `<span style="display:inline-block;width:${size}px;height:${size}px;background:${bg};margin:3px;vertical-align:top"><img src="${src}" width="${size}" height="${size}"></span>`
const mine = { pos: 'wr', face: { skin: '#7a4a2c', head: 'square', eyes: 'almond', brows: 'thick', nose: 'broad', mouth: 'full', hair: 'locs', hc: '#b8893c', beard: 'full', stache: 'full', gear: 'eyeblack' } }
const old = { pos: 'qb', name: 'Old Save', face: { skin: '#eab996', hair: 'flow', hc: '#a8824e', beard: 'stubble' } }
let h = `<!doctype html><meta charset="utf-8"><body style="margin:12px;background:#08090b;color:#aaa;font:12px sans-serif">`
h += `<div>28 made-up men, 64 px on their team's colour</div>` + men.map(m => tile(faceUrl(m.key, m.pos, '#ffffff'), m.color, 64)).join('')
h += `<div>the same on the dark page, 64 px</div>` + men.map(m => tile(faceUrl(m.key, m.pos, m.color), '#171a1f', 64)).join('')
h += `<div>large: 132 px (the name step's lower-third), then a customised build and an older save's face</div>` + men.slice(0, 6).map(m => tile(faceUrl(m.key, m.pos, m.color), m.color, 132)).join('') + tile(buildFaceUrl(mine, '#fb4f14'), '#fb4f14', 132) + tile(buildFaceUrl(old, '#0b2265'), '#0b2265', 132)
h += `<div>up close: 260 px</div>` + [0, 2, 12, 17].map(i => tile(faceUrl(men[i].key, men[i].pos, men[i].color), '#171a1f', 260)).join('')
const cust = (k, list) => list.map(([v]) => tile(buildFaceUrl({ pos: 'te', face: { ...mine.face, hc: '#16110e', gear: 'none', [k]: v } }, '#d2aa4f'), '#20242b', 76)).join('')
h += `<div>every haircut (76 px)</div>` + cust('hair', FACE_HAIR)
h += `<div>every beard, head and gear</div>` + cust('beard', FACE_BEARD) + cust('head', FACE_HEAD) + cust('gear', FACE_GEAR)
const coaches = Array.from({ length: 24 }, (_, i) => ({ key: `coach-sheet-${i}`, ag: 36 + i * 1.4 | 0, color: TEAMS[i % 8] }))
h += `<div>24 coaches, ages 36 to 68, 64 px on the team's colour and 132 px</div>` + coaches.map(c => tile(coachUrl(c.key, { ag: c.ag, color: c.color }), c.color, 64)).join('')
h += '<br>' + coaches.slice(0, 8).map(c => tile(coachUrl(c.key, { ag: c.ag + 10, color: c.color }), '#171a1f', 132)).join('')
writeFileSync(out, h + '</body>')
console.log('wrote', out)
