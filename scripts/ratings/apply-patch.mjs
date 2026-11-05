// Applies a ratings patch (scripts/ratings/<date>.txt) to src/data, and writes the Ratings tab's data.
//   node scripts/ratings/apply-patch.mjs 2026-11-04        dry run: what would change, what doesn't match
//   node scripts/ratings/apply-patch.mjs 2026-11-04 --write
// A "from" grade that doesn't match the file is reported; the "to" grade is what gets written.
import fs from 'node:fs'

const date = process.argv[2], WRITE = process.argv.includes('--write')
const GRADES = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S']
const FILES = { QB: ['src/data/qbs.js'], RB: ['src/data/rbs.js'], WR: ['src/data/wrs.js'], TE: ['src/data/tes.js'], DB: ['src/data/dbs.js'], Guards: ['src/data/nba-guards.js', 'src/data/nba-bigs.js'], Bigs: ['src/data/nba-bigs.js', 'src/data/nba-guards.js'] }
const ALIAS = {
  'post-snap processing': 'vision', 'pre-snap processing': 'processing', 'pocket presence': 'pocket-presence', 'arm strength': 'arm',
  'yards after catch': 'afterCatch', 'route running': 'routeRunning', 'body control': 'bodyControl', vertical: 'vertical',
  'ball skills': 'hands', 'zone iq': 'zoneIQ', 'man coverage': 'manCoverage', 'play recognition': 'playRecognition', 'run support': 'runSupport',
  'jump shot': 'jumpShot', 'perimeter defense': 'perimeterDefense', 'interior defense': 'interiorDefense', iq: 'basketballIQ',
}
const keyOf = label => ALIAS[label.toLowerCase()] ?? label.toLowerCase()
const src = {}
const read = f => (src[f] ??= fs.readFileSync(f, 'utf8'))

// the entry for a name: from its { to the matching }
function findEntry(text, name) {
  const m = new RegExp(`\\{\\s*name:\\s*(['"])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "\\\\?'")}\\1`).exec(text)
  if (!m) return null
  let depth = 0, i = m.index, q = null
  for (; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue }
    if (ch === "'" || ch === '"') q = ch
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) break
  }
  return { start: m.index, end: i + 1, body: text.slice(m.index, i + 1) }
}

// ── Parse ──
const lines = fs.readFileSync(`scripts/ratings/${date}.txt`, 'utf8').split(/\r?\n/)
let sport = null, group = null, player = null
const players = []
for (const raw of lines) {
  const l = raw.trim()
  if (!l) continue
  if (l.startsWith('# sport ')) { sport = l.slice(8); continue }
  if (l.startsWith('## ')) { group = l.slice(3); continue }
  if (!l.includes('→')) { player = { name: l, sport, group, changes: [], move: null }; players.push(player); continue }
  const t = /^TEAM (\S+) → (\S+)\s*(?:\((.*)\))?$/.exec(l)
  if (t) { player.move = { from: t[1], to: t[2], why: t[3] ?? null }; continue }
  const m = /^(S|F|D|[ABC][+-]?) (.+?) → (S|F|D|[ABC][+-]?) (.+?)(?:\s+\((.*)\))?$/.exec(l)
  if (!m) throw new Error(`Can't read: ${l}`)
  player.changes.push({ attr: m[2], from: m[1], to: m[3], why: m[5] ?? null })
}

// ── Check and apply ──
const notFound = [], mismatch = [], badKey = [], applied = []
const out = []
for (const p of players) {
  let file = null, e = null
  for (const f of FILES[p.group]) { e = findEntry(read(f), p.name); if (e) { file = f; break } }
  if (!e) { notFound.push(`${p.name} (${p.group})`); continue }
  const team = /team:\s*'([^']+)'/.exec(e.body)?.[1], teamName = /teamName:\s*'([^']+)'/.exec(e.body)?.[1] ?? null
  if (p.move) { out.push({ ...p, team, teamName, file }); continue }
  let body = e.body
  for (const c of p.changes) {
    const key = keyOf(c.attr)
    const re = new RegExp(`(['"]?)${key}\\1:\\s*(\\d+(?:\\.\\d+)?)`)
    const k = re.exec(body.slice(body.indexOf('attrs')))
    if (!k) { badKey.push(`${p.name}: "${c.attr}" (looked for ${key})`); continue }
    const now = Math.round(Number(k[2])), want = GRADES.indexOf(c.from), to = GRADES.indexOf(c.to)
    if (now !== want) mismatch.push(`${p.name} ${c.attr}: file has ${GRADES[now]}, notes say ${c.from}, setting ${c.to}`)
    c.from = GRADES[now]   // (the tab shows what actually changed)
    const at = body.indexOf('attrs') + k.index
    body = body.slice(0, at) + body.slice(at).replace(re, `$1${key}$1: ${to}`)
    applied.push(1)
  }
  if (WRITE && body !== e.body) src[file] = src[file].slice(0, e.start) + body + src[file].slice(e.end)
  out.push({ ...p, team, teamName, file })
}

console.log(`${players.length} players, ${applied.length} rating changes`)
console.log(`NOT FOUND (${notFound.length}):`, notFound.join(' | ') || 'none')
console.log(`BAD ATTR (${badKey.length}):`, badKey.join(' | ') || 'none')
console.log(`FROM MISMATCH (${mismatch.length}):\n  ${mismatch.join('\n  ') || 'none'}`)

// ── The Ratings tab's data, by team ──
const nbaNames = Object.fromEntries([...read('src/data/nba-teams.js').matchAll(/short:\s*'([A-Z]+)'[^}]*?name:\s*'([^']+)'|name:\s*'([^']+)'[^}]*?short:\s*'([A-Z]+)'/g)].map(m => (m[1] ? [m[1], m[2]] : [m[4], m[3]])))
const byTeam = list => {
  const by = new Map()
  for (const p of list) {
    if (p.move) continue
    const name = p.teamName ?? nbaNames[p.team] ?? p.team
    if (!by.has(p.team)) by.set(p.team, { team: p.team, name, players: [] })
    by.get(p.team).players.push({ name: p.name, changes: p.changes.map(c => ({ attr: c.attr, from: c.from, to: c.to, up: GRADES.indexOf(c.to) > GRADES.indexOf(c.from), why: c.why })) })
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name))
}
const data = { nfl: byTeam(out.filter(p => p.sport === 'nfl')), nba: byTeam(out.filter(p => p.sport === 'nba')), moves: out.filter(p => p.move).map(p => ({ name: p.name, from: p.team, to: p.move.to, why: p.move.why })) }
if (WRITE) {
  for (const [f, t] of Object.entries(src)) if (FILES.QB.concat(FILES.RB, FILES.WR, FILES.TE, FILES.DB, FILES.Guards).includes(f)) fs.writeFileSync(f, t)
  fs.writeFileSync('src/data/ratings-patch.js', `// Generated by scripts/ratings/apply-patch.mjs from scripts/ratings/${date}.txt: the Ratings tab, by team.\nexport const RATINGS_PATCH = ${JSON.stringify(data)}\n`)
  console.log('written')
}
console.log('nfl teams', data.nfl.length, 'nba teams', data.nba.length, 'moves', data.moves.length, '| nba name sample', data.nba[0]?.name)
