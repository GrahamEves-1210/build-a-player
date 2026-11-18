// Basketball's tank (owner 11-18: "jersey on basketball needs big work he's NAKED"): the hoops kit on every body
// width, in dark, light and bright team colours, at 40 px, 64 px and large, plus the app figure's face (appFace.js).
// Given an earlier run's JSON, each face sits beside its before.
//   bash scripts/franchise2/run.sh scripts/franchise2/tank-sheet.mjs <out.json> [before.json]
import { writeFileSync, readFileSync } from 'node:fs'
import { faceSvg, lookOf } from '../../src/lib/franchise2/faces'
import { toUrl } from '../../src/lib/franchise2/faceArt'
import { figureFaceUrl } from '../../src/lib/appFace'
const [out = 'tank.json', prev] = process.argv.slice(2)
const TEAMS = [['#552583', 'LAL'], ['#007a33', 'BOS'], ['#1d1160', 'CHA'], ['#ce1141', 'CHI'], ['#ffffff', 'white'], ['#fdb927', 'gold'], ['#0e2240', 'navy'], ['#3b4652', 'slate']]
const U = (L, color, view = 'full') => toUrl(faceSvg(L, { color, view }))
const S = [], sec = (id, title, size, items) => S.push({ id, title, size, items })
const base = (i, pos) => ({ ...lookOf(`tank-${i}`, pos), kit: 'hoops', eb: 'none', ag: 24 })
sec('colors', 'team colours (wr build)', 110, TEAMS.map(([c, n], i) => ({ label: n, url: U(base(i, 'wr'), c) })))
sec('widths', 'body widths: wr, cb, te, lb, ol, dl (wt -1 / +1)', 110, ['wr', 'cb', 'te', 'lb', 'ol', 'dl'].flatMap((pos, i) => [-1, 1].map(wt => ({ label: `${pos} ${wt}`, url: U({ ...base(i + 10, pos), wt }, TEAMS[i % 8][0]) }))))
sec('sizes', '40, 64, 300', 0, [
  { label: '40', size: 40, url: U(base(3, 'wr'), '#552583', 'sm') }, { label: '64', size: 64, url: U(base(3, 'wr'), '#552583', 'sm') },
  { label: '40', size: 40, url: U(base(4, 'lb'), '#ce1141', 'sm') }, { label: '64', size: 64, url: U(base(4, 'lb'), '#ce1141', 'sm') },
  { label: '300', size: 300, url: U(base(3, 'wr'), '#552583', 'hero') }, { label: '300', size: 300, url: U(base(4, 'lb'), '#3b4652', 'hero') },
])
sec('app', 'the app figure face (appFace.js)', 110, TEAMS.map(([c], i) => ({ label: `app ${i}`, url: figureFaceUrl({ qbFull: `Player ${i}`, skinColor: ['#5e3a22', '#eab996', '#8a5634', '#c99064'][i % 4], teamColor: c }) })))
writeFileSync(out, JSON.stringify(S))
const before = prev ? Object.fromEntries(JSON.parse(readFileSync(prev, 'utf8')).map(s => [s.id, s])) : null
const tile = (it, size, b) => {
  const z = it.size ?? size
  const one = (u, tag) => `<span style="display:inline-block;width:${z}px;height:${z}px;background:#3a4452;${tag ? 'outline:1px solid #888' : ''}"><img src="${u}" width="${z}" height="${z}"></span>`
  return `<span style="display:inline-block;margin:3px 6px 3px 3px;vertical-align:top;text-align:center;font-size:10px">${b ? one(b.url, 1) : ''}${one(it.url)}<br>${it.label}</span>`
}
let h = `<!doctype html><meta charset="utf-8"><body style="margin:12px;background:#08090b;color:#aaa;font:12px sans-serif">${prev ? '<div style="color:#ddd">each pair: before (outlined), after</div>' : ''}`
for (const s of S) h += `<div id="${s.id}" style="margin:14px 0 4px;color:#ddd">${s.title}</div>` + s.items.map((it, i) => tile(it, s.size, before?.[s.id]?.items[i])).join('')
writeFileSync(out.replace(/\.json$/, '.html'), h + '</body>')
console.log('wrote', out)
