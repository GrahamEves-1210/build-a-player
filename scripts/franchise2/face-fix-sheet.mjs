// The owner's 11-18 face notes, on one sheet: LOCS (off the sides of the head), BRAIDS (the braid lines filling the
// cut), the HEADBAND (its fit on the head) and the DURAG (its tail): every head at both ends of the shape sliders,
// both skins, at 40 px, 64 px and large. Given an earlier run's JSON, each face sits beside its before.
//   bash scripts/franchise2/run.sh scripts/franchise2/face-fix-sheet.mjs <out.json> [before.json]
import { writeFileSync, readFileSync } from 'node:fs'
import { buildFaceUrl, FACE_HEAD } from '../../src/lib/franchise2/faces'
const [out = 'fix.json', prev] = process.argv.slice(2)
const base = { skin: '#5e3a22', head: 'square', eyes: 'almond', brows: 'straight', nose: 'broad', mouth: 'full', hair: 'fade', hc: '#16110e', beard: 'none', stache: 'none', gear: 'none', eb: 'none', expr: 'neutral', bone: 7 }
const B = (f, pos = 'wr', view = 'full') => buildFaceUrl({ pos, face: { ...base, ...f } }, '#0b2265', view)
const S = [], sec = (id, title, size, items) => S.push({ id, title, size, items })
const CASES = [['locs', { hair: 'locs' }], ['braids', { hair: 'cornrows' }], ['headband', { gear: 'headband', hair: 'fade' }], ['headband-long', { gear: 'headband', hair: 'locs' }], ['headband-afro', { gear: 'headband', hair: 'curly' }], ['durag', { gear: 'durag', hair: 'waves' }]]
for (const [id, f] of CASES) {
  const shapes = []
  for (const [hd] of FACE_HEAD) for (const [pos, wt] of [['wr', -1], ['ol', 1]]) for (const sk of ['#5e3a22', '#eab996'])
    shapes.push({ label: `${hd} ${pos} ${wt} ${sk === '#eab996' ? 'w' : 'b'}`, url: B({ ...f, head: hd, wt, chk: wt, jaw: wt, skin: sk, hc: sk === '#eab996' ? '#5a3b24' : '#16110e' }, pos) })
  sec(`shape-${id}`, `${id}: every head, -1 / +1`, 110, shapes)
  sec(`size-${id}`, `${id}: 40, 64, 300`, 0, [
    { label: '40', size: 40, url: B(f, 'wr', 'sm') }, { label: '64', size: 64, url: B(f, 'wr', 'sm') },
    { label: '40 w', size: 40, url: B({ ...f, skin: '#eab996', hc: '#5a3b24' }, 'wr', 'sm') }, { label: '64 w', size: 64, url: B({ ...f, skin: '#eab996', hc: '#5a3b24' }, 'wr', 'sm') },
    { label: '300', size: 300, url: B(f, 'wr', 'hero') }, { label: '300 w', size: 300, url: B({ ...f, skin: '#eab996', hc: '#5a3b24' }, 'wr', 'hero') },
    { label: 'close', size: 300, url: B(f, 'wr', 'hair') }, { label: 'close w', size: 300, url: B({ ...f, skin: '#eab996', hc: '#5a3b24' }, 'wr', 'hair') },
  ])
}
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
console.log('wrote', out)
