// Close-ups of haircuts for checking (the creator's 'hair' crop, or any view), one tile per face.
//   bash scripts/franchise2/run.sh scripts/franchise2/hair-probe.mjs <out.html> <hairs,csv> [view] [size] [extra-face-json-list]
// extra: a JSON list of face overrides, each drawn for every hair (default: dark skin and fair skin)
import { writeFileSync } from 'node:fs'
import { buildFaceUrl } from '../../src/lib/franchise2/faces'
const [out, hairs, view = 'hair', size = '240', extra] = process.argv.slice(2)
const base = { skin: '#5e3a22', head: 'square', eyes: 'almond', brows: 'straight', nose: 'broad', mouth: 'full', hair: 'fade', hc: '#16110e', beard: 'none', stache: 'none', gear: 'none', eb: 'none', expr: 'neutral', bone: 7 }
const X = extra ? JSON.parse(extra) : [{}, { skin: '#eab996', hc: '#5a3b24' }]
let h = `<!doctype html><meta charset="utf-8"><body style="margin:4px;background:#08090b;color:#ccc;font:11px sans-serif">`
for (const hr of hairs.split(',')) for (const x of X) {
  const f = { ...base, hair: hr, ...x }
  h += `<span style="display:inline-block;margin:2px;text-align:center"><span style="display:block;width:${size}px;height:${size}px;background:#20242b"><img src="${buildFaceUrl({ pos: x.pos ?? 'wr', face: f }, '#0b2265', view)}" width="${size}" height="${size}"></span>${hr} ${JSON.stringify(x).slice(1, -1).replace(/"/g, '')}</span>`
}
writeFileSync(out, h + '</body>')
