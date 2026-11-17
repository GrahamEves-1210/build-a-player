// Writes names.js's FAMOUS list: every real man in the game's data (any sport, any era) whose first and last names
// are both on names.js's lists, so a made-up man never gets a real player's name.
//   node scripts/franchise2/names-famous.mjs   (rewrites the block after /*FAMOUS*/ in src/lib/franchise2/names.js)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FILE = join(ROOT, 'src', 'lib', 'franchise2', 'names.js')
const src = readFileSync(FILE, 'utf8')
const listOf = name => { const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\]\\n`)); return m ? [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'|"([^"]*)"/g)].map(x => x[1] ?? x[2]) : [] }
const firsts = new Set(['F_B', 'F_W', 'F_S', 'F_P', 'F_L'].flatMap(listOf))
const lasts = new Set(['L_COMMON', 'L_S', 'L_B', 'L_W', 'L_P', 'L_L'].flatMap(listOf))
const real = new Set()
const DATA = join(ROOT, 'src', 'data')
for (const f of readdirSync(DATA)) {
  if (!/\.(js|json)$/.test(f)) continue
  const t = readFileSync(join(DATA, f), 'utf8')
  for (const m of t.matchAll(/\bname["']?\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"([^"]*)")/g)) real.add((m[1] ?? m[2]).replace(/\\'/g, "'"))
  if (f.endsWith('.json')) for (const m of t.matchAll(/"([A-Z][A-Za-z.'-]+(?: [A-Z][A-Za-z.'-]+)+)"\s*:/g)) real.add(m[1])
}
const out = new Set()
for (const n of real) {
  const w = n.replace(/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/, '').split(/\s+/)
  if (w.length !== 2) continue
  if (firsts.has(w[0]) && lasts.has(w[1])) out.add(`${w[0]} ${w[1]}`)
}
const list = [...out].sort()
const body = list.map(n => `'${n.replace(/'/g, "\\'")}'`).join(', ')
const lines = []
let cur = '  '
for (const piece of body.split(', ')) { if (cur.length + piece.length > 140) { lines.push(cur.trimEnd()); cur = '  ' } cur += piece + ', ' }
if (cur.trim()) lines.push(cur.trimEnd())
const next = src.replace(/\/\*FAMOUS\*\/[\s\S]*?\/\*END\*\/\n|\/\*FAMOUS\*\/\n/, `/*FAMOUS*/\n${lines.join('\n')}\n  /*END*/\n`)
writeFileSync(FILE, next)
console.log(`${real.size} real names in the data · ${firsts.size} first names · ${lasts.size} last names · ${list.length} blocked`)
