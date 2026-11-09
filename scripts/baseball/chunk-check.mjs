// After a vite build: which chunks hold baseball's rosters and sim, and does a football, basketball or soccer
// visit download any of them? Walks the static imports from the entry (index.html) and from each sport's app
// chunk (App, BucketApp, SoccerApp: what main.jsx loads for that address), and looks for baseball names in them.
//   node scripts/baseball/chunk-check.mjs F:/bap-dist/baseball-shell
import { readFileSync, readdirSync } from 'fs'
import path from 'path'
const dist = process.argv[2] ?? 'dist'
const dir = path.join(dist, 'assets')
const files = readdirSync(dir).filter(f => f.endsWith('.js'))
const src = Object.fromEntries(files.map(f => [f, readFileSync(path.join(dir, f), 'utf8')]))
const html = readFileSync(path.join(dist, 'index.html'), 'utf8')
const entry = [...html.matchAll(/assets\/([^"']+\.js)/g)].map(m => m[1]).filter(f => src[f])
// static imports of a chunk (import"./x.js", from"./x.js"), not import("./x.js")
const deps = f => [...src[f].matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)].map(m => m[1]).filter(d => src[d])
const closure = roots => { const seen = new Set(); const st = [...roots]; while (st.length) { const f = st.pop(); if (seen.has(f)) continue; seen.add(f); st.push(...deps(f)) } return seen }
// the baseball marks: current players, legends, and the sim's own words
const MARKS = ['Yordan Alvarez', 'Bobby Witt Jr.', 'Tarik Skubal', 'Paul Goldschmidt', 'Mariano Rivera', 'runBaseballSimulation', 'scriptBaseballSeason']
const has = f => MARKS.filter(m => src[f].includes(m))
const appChunk = name => files.find(f => new RegExp(`^${name}-[\\w-]+\\.js$`).test(f))
console.log('chunks with baseball rosters or sim:')
for (const f of files) { const h = has(f); if (h.length) console.log(`  ${f} (${Math.round(src[f].length / 1024)} KB): ${h.join(', ')}`) }
const base = closure(entry)
for (const [label, name] of [['every page (entry)', null], ['football', 'App'], ['basketball', 'BucketApp'], ['soccer', 'SoccerApp'], ['baseball', 'BaseballApp']]) {
  const c = name ? appChunk(name) : null
  if (name && !c) { console.log(`${label}: no ${name} chunk found`); continue }
  const set = name ? closure([...entry, c]) : base
  const bad = [...set].filter(f => has(f).length)
  const kb = [...set].reduce((s, f) => s + src[f].length, 0) / 1024
  console.log(`${label}: ${set.size} chunks, ${Math.round(kb)} KB of JS on first load${name ? ` (${c})` : ''} · baseball in it: ${bad.length ? bad.join(', ') : 'none'}`)
}
