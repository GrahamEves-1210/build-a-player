// College Football class audit: every player's class (the `year` field in src/data/cfb-players.js) checked
// against ESPN's current college football rosters.
//
//   node scripts/cfb/class-audit.mjs            compare only: prints the pairs and writes the report
//   node scripts/cfb/class-audit.mjs --write    also fixes the `year` fields in src/data/cfb-players.js
//
// ESPN's roster gives each athlete's class (experience.abbreviation: FR, SO, JR, SR) but has no redshirt field.
// So the base class comes from ESPN and the redshirt flag the file already carries (RS-, read from ESPN's game
// logs when the data was built) stays: a file 'RS-SO' that ESPN lists as a senior becomes 'RS-SR'.
// A player ESPN doesn't list on his school's roster is left alone and named in the report.
// Only the `year: "..."` text of a changed row is touched; nothing else in a row moves.
// Rosters are cached (CACHE env, default the OS temp folder) so a second run doesn't hit ESPN again.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import os from 'node:os'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const FILE = path.join(root, 'src/data/cfb-players.js')
const REPORT = path.join(here, 'class-audit-report.txt')
const CACHE = process.env.CACHE || path.join(os.tmpdir(), 'bap-cfb-rosters')
const WRITE = process.argv.includes('--write')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

const { CFB_TEAMS } = await import(pathToFileURL(path.join(root, 'src/data/cfb-teams.js')).href)
const { CFB_QBS, CFB_WRS, CFB_RBS } = await import(pathToFileURL(FILE).href)
mkdirSync(CACHE, { recursive: true })

const wait = ms => new Promise(r => setTimeout(r, ms))
async function roster(espnId) {
  const f = path.join(CACHE, `${espnId}.json`)
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'))
  for (let i = 0; i < 4; i++) {
    try {
      // (without a limit ESPN stops at 100 names, so the back half of a big roster goes missing)
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${espnId}/roster?limit=300`, { headers: { 'User-Agent': UA } })
      if (res.ok) {
        const j = await res.json()
        const out = (j.athletes ?? []).flatMap(g => g.items ?? []).map(a => ({ id: String(a.id), name: a.fullName, pos: a.position?.abbreviation ?? null, cls: a.experience?.abbreviation ?? null, clsName: a.experience?.displayValue ?? null }))
        writeFileSync(f, JSON.stringify(out))
        return out
      }
    } catch {}
    await wait(800 * (i + 1))
  }
  return null
}
// a player not on any roster: his ESPN athlete page (displayExperience), if it still has him at a school
async function athlete(id) {
  const f = path.join(CACHE, `a-${id}.json`)
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'))
  try {
    const res = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/football/college-football/athletes/${id}`, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    const a = (await res.json()).athlete ?? {}
    const ABBR = { Freshman: 'FR', Sophomore: 'SO', Junior: 'JR', Senior: 'SR' }
    const out = { id: String(id), name: a.fullName, cls: ABBR[a.displayExperience] ?? null, clsName: a.displayExperience ?? null, school: a.team?.abbreviation ?? null, active: a.active !== false }
    writeFileSync(f, JSON.stringify(out))
    return out
  } catch { return null }
}

const BASES = new Set(['FR', 'SO', 'JR', 'SR'])
const players = [...CFB_QBS.map(p => ['QB', p]), ...CFB_WRS.map(p => ['WR', p]), ...CFB_RBS.map(p => ['RB', p])]
const byTeam = Object.fromEntries(CFB_TEAMS.map(t => [t.short, t]))
const rosters = {}
for (const t of CFB_TEAMS) { rosters[t.short] = await roster(t.espn); await wait(120) }
// every roster by athlete id (a player can show up under a different school after a move)
const anywhere = new Map()
for (const [short, r] of Object.entries(rosters)) for (const a of r ?? []) anywhere.set(a.id, { ...a, school: short })

const changes = [], missing = [], odd = [], pairs = {}
let checked = 0
for (const [pos, p] of players) {
  const own = (rosters[p.team] ?? []).find(a => a.id === String(p.espn))
  let a = own ?? anywhere.get(String(p.espn))
  let via = null
  if (!a) { const d = await athlete(p.espn); await wait(100); if (d?.cls && d.active) { a = d; via = 'athlete page' } }
  if (!a || !a.cls) { missing.push({ pos, p, why: !rosters[p.team] ? 'school roster did not load' : 'not on an ESPN roster or athlete page' }); continue }
  const cls = String(a.cls).toUpperCase()
  if (!BASES.has(cls)) { odd.push({ pos, p, cls }); continue }
  checked++
  const was = String(p.year ?? '')
  const rs = /^RS-/.test(was)
  const next = rs ? `RS-${cls}` : cls
  const k = `${was || '(none)'} -> ESPN ${cls}`
  pairs[k] = (pairs[k] ?? 0) + 1
  if (next !== was) changes.push({ pos, p, was, next, espn: a.clsName, elsewhere: own ? null : a.school })
}

const row = x => `${x.pos}  ${x.p.name} (${x.p.team}${byTeam[x.p.team] ? `, ${byTeam[x.p.team].school}` : ''}, espn ${x.p.espn})`
const lines = [
  `College Football class audit (${new Date().toISOString().slice(0, 10)}): src/data/cfb-players.js year vs ESPN rosters`,
  'Base class from ESPN (experience.abbreviation); the file\'s redshirt flag (RS-) kept, since ESPN has no redshirt field.',
  `Players: ${players.length} · checked against ESPN: ${checked} · changed: ${changes.length} · not found on ESPN: ${missing.length}${odd.length ? ` · unusual ESPN class: ${odd.length}` : ''}`,
  WRITE ? 'Applied to src/data/cfb-players.js.' : 'Compare only (run with --write to apply).',
  '',
  '── File class vs ESPN class (counts) ──',
  ...Object.entries(pairs).sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${String(n).padStart(4)}  ${k}`),
  '',
  `── Changed (${changes.length}) ──`,
  ...changes.map(x => `  ${row(x)}: ${x.was} -> ${x.next}  (ESPN: ${x.espn}${x.elsewhere ? `, listed at ${x.elsewhere}` : ''})`),
  '',
  `── Not found on ESPN, left as is (${missing.length}) ──`,
  ...missing.map(x => `  ${row(x)}: ${x.p.year} (${x.why})`),
  ...(odd.length ? ['', `── Unusual ESPN class, left as is (${odd.length}) ──`, ...odd.map(x => `  ${row(x)}: ${x.p.year} (ESPN: ${x.cls})`)] : []),
  '',
]
writeFileSync(REPORT, lines.join('\n'))
console.log(lines.slice(0, 8 + Object.keys(pairs).length).join('\n'))
console.log(`report: ${REPORT}`)

if (WRITE && changes.length) {
  let src = readFileSync(FILE, 'utf8')
  let n = 0
  for (const x of changes) {
    // the row is the one line holding this espn id; only its year text changes
    const re = new RegExp(`^(.*espn: "${x.p.espn}".*)$`, 'm')
    const m = src.match(re)
    const line = m?.[1]
    if (!line || !line.includes(`year: "${x.was}"`)) { console.warn(`skipped ${x.p.name}: row not found`); continue }
    src = src.replace(line, () => line.replace(`year: "${x.was}"`, `year: "${x.next}"`))
    n++
  }
  writeFileSync(FILE, src)
  console.log(`wrote ${n} class changes to ${FILE}`)
}
