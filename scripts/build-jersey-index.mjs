// The app's jersey art (lib/jerseyArt.js) needs, for every headshot file, the player's team, number and position,
// and for every team its two colours. This reads every roster and team table in src/data (through Vite, the way
// the game loads them) and writes src/data/jersey-index.json. Run from the repo root:
//   node scripts/build-jersey-index.mjs
// npm run build:app runs it first, so the app always ships an index that matches its rosters.
import { createServer } from 'vite'
import { readdirSync, writeFileSync } from 'fs'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() } }
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const load = f => server.ssrLoadModule('/src/data/' + f)

const NFL_HS = (await load('headshots.json')).default
const NBA_HS = (await load('nba-headshots.json')).default
const MLB_HS = (await load('mlb-headshots.json')).default
const SOC_HS = (await load('soccer-headshots.json')).default
const COACH_HS = (await load('coach-headshots.json')).default

// ── teams: league → short → [color, color2] ──────────────────────────────────────────────────────────────────
const teams = { nfl: {}, nba: {}, cfb: {}, cbb: {}, mlb: {}, soc: {}, nat: {} }
const addTeams = (lg, list) => { for (const t of list ?? []) if (t?.short && t.color && !teams[lg][t.short]) teams[lg][t.short] = [t.color, t.color2 || '#ffffff'] }
addTeams('nfl', (await load('nfl-teams.js')).TEAMS)
addTeams('nba', (await load('nba-teams.js')).NBA_TEAMS)
addTeams('cfb', (await load('cfb-teams.js')).CFB_TEAMS)
const cbbT = await load('cbb-teams.js'); addTeams('cbb', cbbT.CBB_TEAMS); addTeams('cbb', cbbT.CBB_OTHER_TEAMS)
addTeams('mlb', (await load('mlb-teams.js')).MLB_TEAMS)
addTeams('soc', (await load('soccer-clubs.js')).SOCCER_ALL_CLUBS)
addTeams('nat', (await load('soccer-nations.js')).WC_ALL_NATIONS)

// ── players: headshot key (path under /headshots, no extension) → "lg|TEAM|number|POS" ───────────────────────
const strip = s => String(s).replace(/^\/?headshots\//, '').replace(/\.(webp|png|jpe?g)$/i, '')
const POS_BY_FILE = { qbs: 'QB', 'qb-legends': 'QB', rbs: 'RB', 'rb-legends': 'RB', wrs: 'WR', 'wr-legends': 'WR', tes: 'TE', 'te-legends': 'TE',
  dbs: 'DB', 'db-legends': 'DB', dls: 'DL', 'dl-legends': 'DL', lbs: 'LB', 'lb-legends': 'LB', ols: 'OL', 'ol-legends': 'OL', ks: 'K', 'k-legends': 'K' }
const leagueOf = f => /^(nba-)/.test(f) ? 'nba' : /^cfb-/.test(f) ? 'cfb' : /^cbb-/.test(f) ? 'cbb' : /^mlb-/.test(f) ? 'mlb' : /^soccer-/.test(f) ? 'soc' : 'nfl'
// a pool named for its position (QB_POOL, CFB_WRS, MLB_PITCHERS) says what its rows play
const HINT = n => { const m = /(?:^|_)(QB|RB|WR|TE|DB|DL|LB|OL|K)S?(?:_|$)/.exec(n); return m ? m[1] : /PITCHER/.test(n) ? 'P' : '' }
const posOf = (p, f, lg, hint) => {
  if (lg === 'mlb') return String(p.role ?? (p.position === 'pit' || hint === 'P' ? 'P' : '')).toUpperCase().slice(0, 3)
  const raw = p.pos ?? p.position ?? p.subpos ?? POS_BY_FILE[f] ?? hint ?? ''
  let s = String(raw).toUpperCase()
  if (lg === 'nfl' && POS_BY_FILE[f] && !/^(QB|RB|WR|TE|CB|S|FS|SS|DB|EDGE|DT|DE|DL|LB|OLB|ILB|MLB|OT|OG|G|T|C|OL|K|P)$/.test(s)) s = POS_BY_FILE[f]
  return s.slice(0, 4)
}
const keyOf = (p, lg) => {
  if (p.headshot) return strip(p.headshot)
  if (lg === 'nfl' && NFL_HS[p.name]) return strip(NFL_HS[p.name])
  if (lg === 'nba' && NBA_HS[p.name]) return 'nba/' + strip(NBA_HS[p.name])
  if (lg === 'mlb' && p.espn != null && MLB_HS[String(p.espn)]) return strip(MLB_HS[String(p.espn)])
  if (lg === 'soc' && p.espn != null && SOC_HS[String(p.espn)]) return strip(SOC_HS[String(p.espn)])
  return null
}
const players = {}
const byName = {}   // name → entry, for headshot maps keyed by a name no roster row carries
const seen = new Set()
function addRow(p, f, lg, hint) {
  if (!p || typeof p !== 'object' || typeof p.name !== 'string' || !p.team || typeof p.team !== 'string') return
  const team = p.team, num = p.number ?? p.num ?? '', pos = posOf(p, f, lg, hint)
  const tl = lg === 'soc' && teams.nat[team] && !teams.soc[team] ? 'nat' : lg
  const v = `${tl}|${team}|${num}|${pos}`
  const k = keyOf(p, lg)
  // a photo in headshots/nba/ is an NBA photo: an NBA row beats a college row that borrows it
  if (k && (!players[k] || (k.startsWith('nba/') && lg === 'nba' && !players[k].startsWith('nba|')))) players[k] = v
  if (!byName[lg + '|' + p.name]) byName[lg + '|' + p.name] = v
}
function walk(x, f, lg, hint, depth = 0) {
  if (!x || depth > 3 || seen.has(x)) return
  if (typeof x !== 'object') return
  seen.add(x)
  if (Array.isArray(x)) { for (const r of x) { if (r && typeof r === 'object' && typeof r.name === 'string') addRow(r, f, lg, hint); else walk(r, f, lg, hint, depth + 1) } return }
  for (const [k, v] of Object.entries(x)) walk(v, f, lg, HINT(k.toUpperCase()) || hint, depth + 1)
}
// current rosters first (a legend shares his photo with nobody, but a current player's team is the one he plays for)
const files = readdirSync('src/data').filter(f => f.endsWith('.js')).map(f => f.slice(0, -3))
const order = f => (/legend|goat|resume|depth-chart|draft|salary|contracts/.test(f) ? 1 : 0)
files.sort((a, b) => order(a) - order(b) || a.localeCompare(b))
for (const f of files) {
  let m
  try { m = await load(f + '.js') } catch (e) { console.warn('skip', f, e.message.split('\n')[0]); continue }
  const lg = leagueOf(f)
  for (const [n, v] of Object.entries(m)) walk(v, f, lg, HINT(n))
}
// headshot maps keyed by name, for names that only show up in a pool without a photo field of its own
for (const [name, id] of Object.entries(NFL_HS)) { const k = strip(id); if (!players[k] && byName['nfl|' + name]) players[k] = byName['nfl|' + name] }
for (const [name, id] of Object.entries(NBA_HS)) { const k = 'nba/' + strip(id); if (!players[k] && byName['nba|' + name]) players[k] = byName['nba|' + name] }
// coaches: their team's mark, no jersey number
const coaches = (await load('nfl-coaches.js'))
for (const c of [...(coaches.NFL_COACHES ?? []), ...(coaches.COACH_FREE_AGENTS ?? [])]) {
  const f = COACH_HS[c.name]; if (!f) continue
  const k = strip(f); if (!players[k]) players[k] = `nfl|${c.team ?? ''}||HC`
}
for (const [name, f] of Object.entries(COACH_HS)) { const k = strip(f); if (!players[k]) players[k] = 'nfl|||HC' }

const out = { teams, p: players }
writeFileSync('src/data/jersey-index.json', JSON.stringify(out))
const total = { nfl: 0, nba: 0, cfb: 0, cbb: 0, mlb: 0, soc: 0, nat: 0 }
for (const v of Object.values(players)) total[v.split('|')[0]]++
console.log('jersey-index:', Object.keys(players).length, 'players', JSON.stringify(total), Object.fromEntries(Object.entries(teams).map(([k, v]) => [k, Object.keys(v).length])))
await server.close()
