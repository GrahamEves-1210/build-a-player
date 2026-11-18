// Faces before/after: 12 made-up players (Black men in tight-coil cuts, smiling faces, every build) at 64 px (the list
// drawing) and large, the Career creator's big smile, and every tight-coil cut in every player hair colour. Writes the
// data URLs as JSON, so a second run after a change can sit beside the first.
//   bash scripts/franchise2/run.sh scripts/franchise2/faces-compare.mjs <out.json>
import { writeFileSync } from 'node:fs'
import { faceUrl, lookOf, buildFaceUrl, PLAYER_HC } from '../../src/lib/franchise2/faces'

const out = process.argv[2] ?? 'faces.json'
const COIL = new Set(['fade', 'buzz', 'waves', 'curly', 'afro', 'twists', 'hightop', 'frohawk', 'crew', 'receding'])
const want = [
  ['b', 'fade', 'warm', 'wr'], ['b', 'waves', 'slight', 'db'], ['b', 'buzz', 'warm', 'ol'], ['b', 'twists', null, 'rb'],
  ['b', 'curly', null, 'lb'], ['b', 'hightop', null, 'dl'], ['b', 'afro', null, 'te'], ['b', 'frohawk', null, 'qb'],
  ['w', null, 'warm', 'te'], ['w', null, 'half', 'qb'], ['p', null, 'warm', 'dl'], ['m', null, 'slight', 'ol'],
]
const TEAMS = ['#fb4f14', '#0b2265', '#e31837', '#203731', '#241773', '#004c54', '#a71930', '#002244', '#4f2683', '#125740', '#d50a0a', '#002c5f']
const picks = []
for (const [g, hair, expr, pos] of want) {
  for (let i = 0; i < 40000; i++) {
    const key = `cmp-${pos}-${i}`, L = lookOf(key, pos)
    if (L.g !== g || (hair && L.hair !== hair) || (expr && L.expr !== expr) || picks.some(p => p.key === key)) continue
    if (!expr && L.expr === 'neutral' && i < 30000) continue
    picks.push({ key, pos, label: `${pos} ${g} ${L.hair} ${L.expr} ${L.beard}` }); break
  }
}
const res = { players: [], creator: [], coils: [] }
picks.forEach((p, i) => res.players.push({ label: p.label, sm: faceUrl(p.key, p.pos, TEAMS[i], null, true), full: faceUrl(p.key, p.pos, TEAMS[i]) }))
const base = { skin: '#5e3a22', head: 'square', eyes: 'almond', brows: 'straight', nose: 'broad', mouth: 'full', hair: 'fade', hc: '#16110e', beard: 'none', stache: 'none', gear: 'none', eb: 'none', expr: 'grin' }
for (const f of [{}, { hair: 'waves', beard: 'goatee', stache: 'full' }, { skin: '#eab996', hair: 'textured', hc: '#5a3b24', nose: 'straight', mouth: 'neutral' }, { skin: '#a06c44', hair: 'twists', beard: 'short', stache: 'full' }])
  res.creator.push({ label: `creator grin ${f.hair ?? 'fade'}`, sm: buildFaceUrl({ pos: 'wr', face: { ...base, ...f } }, '#0b2265', 'sm'), full: buildFaceUrl({ pos: 'wr', face: { ...base, ...f } }, '#0b2265', 'hero') })
for (const hair of [...COIL].filter(h => h !== 'crew' && h !== 'receding')) for (const [hc] of PLAYER_HC)
  res.coils.push({ label: `${hair} ${hc}`, full: buildFaceUrl({ pos: 'wr', face: { ...base, expr: 'neutral', hair, hc } }, '#20242b') })
writeFileSync(out, JSON.stringify(res))
console.log(picks.map(p => p.label).join('\n'))
console.log('wrote', out)
