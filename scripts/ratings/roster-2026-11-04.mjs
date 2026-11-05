// One-off, run once: the 11-04 roster moves. Adds the five QBs on 53-man rosters, cuts the practice
// squad QBs from any team now above three, moves the released players out, fixes two listed sizes.
import fs from 'node:fs'
const WRITE = process.argv.includes('--write')
const G = { F: 0, D: 1, 'C-': 2, C: 3, 'C+': 4, 'B-': 5, B: 6, 'B+': 7, 'A-': 8, A: 9, 'A+': 10, S: 11 }

function entryRange(text, name) {
  const m = new RegExp(`\\{\\s*name:\\s*(['"])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`).exec(text)
  if (!m) return null
  let depth = 0, i = m.index, q = null
  for (; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue }
    if (c === "'" || c === '"') q = c
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) break
  }
  let start = m.index
  while (start > 0 && text[start - 1] !== '\n') start--
  let end = i + 1
  if (text[end] === ',') end++
  if (text.slice(end, end + 2) === '\r\n') end += 2; else if (text[end] === '\n') end++
  return { start, end, body: text.slice(start, end) }
}
const dropEntry = (text, name) => { const e = entryRange(text, name); if (!e) throw new Error(`no ${name}`); return text.slice(0, e.start) + text.slice(e.end) }

let qbs = fs.readFileSync('src/data/qbs.js', 'utf8')
const nl = qbs.includes('\r\n') ? '\r\n' : '\n'
const onTeam = (text, t) => [...text.matchAll(new RegExp(`name:\\s*'([^']+)'[^\\n]*?team:\\s*'${t}'`, 'g'))].map(m => m[1])

// ── Add ──
const ADD = [
  { name: 'Dillon Gabriel', short: 'Gabriel', team: 'CLE', number: 8, skin: '#c09060', g: ['C+', 'B-', 'F', 'B-', 'B', 'C+', 'C+', 'B-', 'B-'] },
  { name: 'Drew Allar', short: 'Allar', team: 'PIT', number: 15, skin: '#f0c4a0', g: ['A-', 'C+', 'A+', 'C-', 'B', 'C', 'B-', 'C', 'C'], size: [77, 238] },
  { name: 'Jake Haener', short: 'Haener', team: 'NYG', number: 3, skin: '#f0c4a0', g: ['C+', 'C', 'D', 'B', 'B', 'B-', 'C+', 'B-', 'B-'], size: [73, 207] },
  { name: 'Cole Payton', short: 'Payton', team: 'PHI', number: 12, skin: '#f0c4a0', g: ['C-', 'B+', 'B', 'C-', 'B-', 'C-', 'B-', 'C', 'C-'], size: [75, 232] },
  { name: 'Jack Strand', short: 'Strand', team: 'ATL', number: 19, skin: '#f0c4a0', g: ['B+', 'B-', 'A', 'C-', 'B', 'C-', 'C+', 'C-', 'C-'], size: [75, 215] },
]
const KEYS = ['arm', 'legs', 'size', 'processing', 'leadership', 'vision', 'playmaking', 'accuracy', 'pocket-presence']
for (const a of ADD) {
  const head = qbs.indexOf(`  // ${a.team}`)
  if (head < 0) throw new Error(`no section ${a.team}`)
  const next = qbs.indexOf('  // ', head + 5)
  const sample = /teamName:\s*'([^']+)',\s*color:\s*'([^']+)',\s*color2:\s*'([^']+)'/.exec(qbs.slice(head, next))
  const attrs = KEYS.map((k, i) => `'${k}': ${G[a.g[i]]}`).join(', ')
  const line = `  { name: '${a.name}', short: '${a.short}', team: '${a.team}', teamName: '${sample[1]}', color: '${sample[2]}', color2: '${sample[3]}', skin: '${a.skin}', starter: false, number: ${a.number},${nl}    attrs: { ${attrs} } },${nl}`
  qbs = qbs.slice(0, next) + line + qbs.slice(next)
  if (a.size) {
    const anchor = "  'Dillon Gabriel':"
    const at = qbs.indexOf(anchor)
    if (at < 0) throw new Error('size table')
    qbs = qbs.slice(0, at) + `  '${a.name}': { height: ${a.size[0]}, weight: ${a.size[1]} },${nl}` + qbs.slice(at)
  }
}
// ── Practice squad QBs: gone only where the team is now above three ──
const PSQUAD = [['Luke Altmyer', 'DET'], ['Hendon Hooker', 'TEN'], ['Easton Stick', 'TB'], ['Will Levis', 'NYJ'], ['Kedon Slovis', 'GB'], ['Shane Buechele', 'BUF'], ['Josh Johnson', 'CIN'], ['Nick Mullens', 'JAX'], ['Brady Cook', 'MIA']]
for (const [name, team] of PSQUAD) {
  const list = onTeam(qbs, team)
  if (!list.includes(name)) { console.log(`  ${name}: not on ${team} in the file (${list.join(', ')})`); continue }
  if (list.length > 3) { qbs = dropEntry(qbs, name); console.log(`  cut ${name} from ${team}: ${list.length} QBs -> ${list.length - 1}`) }
  else console.log(`  kept ${name} on ${team}: only ${list.length} QBs (${list.join(', ')})`)
}
for (const t of ['CLE', 'PIT', 'NYG', 'PHI', 'ATL']) console.log(`  ${t} QBs: ${onTeam(qbs, t).join(', ')}`)

// ── Released ──
let guards = dropEntry(fs.readFileSync('src/data/nba-guards.js', 'utf8'), 'Kevin Porter Jr.')
let rbs = dropEntry(fs.readFileSync('src/data/rbs.js', 'utf8'), 'Joe Mixon')
let wrs = fs.readFileSync('src/data/wrs.js', 'utf8')
wrs = dropEntry(wrs, 'Darius Slayton')
console.log('  IND WRs:', [...wrs.matchAll(/name:\s*'([^']+)'[^\n]*?team:\s*'IND'[^\n]*?starter:\s*(true|false)/g)].map(m => `${m[1]}${m[2] === 'true' ? '*' : ''}`).join(', '))

// ── Sizes ──
let bigs = fs.readFileSync('src/data/nba-bigs.js', 'utf8')
const size = (name, h, w) => { const e = entryRange(bigs, name); const b = e.body.replace(/height:\s*\d+,\s*weight:\s*\d+/, `height: ${h}, weight: ${w}`); if (b === e.body) throw new Error(name); bigs = bigs.slice(0, e.start) + b + bigs.slice(e.end) }
size('Onyeka Okongwu', 82, 240); size('Nate Ament', 82, 211)

// ── Birth years the career ages need ──
let ages = fs.readFileSync('src/data/player-ages.js', 'utf8')
const anl = ages.includes('\r\n') ? '\r\n' : '\n'
for (const [n, y] of [['Dillon Gabriel', 2000], ['Drew Allar', 2004], ['Jake Haener', 1999], ['Cole Payton', 2003]]) {
  if (ages.includes(`"${n}"`)) continue
  const at = ages.indexOf('"Luke Altmyer"')
  ages = ages.slice(0, at) + `"${n}": ${y},${anl}  ` + ages.slice(at)
}
if (WRITE) {
  fs.writeFileSync('src/data/qbs.js', qbs); fs.writeFileSync('src/data/nba-guards.js', guards); fs.writeFileSync('src/data/rbs.js', rbs)
  fs.writeFileSync('src/data/wrs.js', wrs); fs.writeFileSync('src/data/nba-bigs.js', bigs); fs.writeFileSync('src/data/player-ages.js', ages)
  console.log('written')
}
