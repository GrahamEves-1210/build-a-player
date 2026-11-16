// Soccer's nine ratings for every player (the owner, 2026-11-16). Step 3 of 3, after fotmob-compact.mjs and
// ucl-squads.mjs:   node scripts/soccer/grade-nine.mjs [rawDir] [--dry]   (rawDir default F:/bap-agents/socattr/raw)
//
// Reads: scripts/soccer/ratings-v1.json (the ten grades as they were on 11-15), scripts/soccer/ucl-additions.json
// (the Champions League players to add, with bios), rawDir/fotmob-players.json (FotMob leaderboards, 2025-26 and
// 2026-27), rawDir/players/{fotmobId}.json (FotMob player pages of the added players: foot, shot maps).
// Writes: the attrs of every row in src/data/soccer-strikers.js, the added rows, scripts/soccer/fotmob-ids.json
// (which FotMob player each row was read from) and rawDir/grade-nine-report.json (inputs per player).
//
// The nine and where each comes from (the method is in data/soccer-strikers.js's header too):
//   pace, finishing, shotPower, heading, composure  kept from the ten (hand corrections in FIX below)
//   positioning   Off-Ball Movement's grade, kept
//   dribbling     the old Dribbling and First Touch half and half, put back on Dribbling's own spread (rank for rank)
//   passing       new, from FotMob: chances created, xA and assists per 90, big chances created per 90, pass
//                 completion and accurate passes per 90; z-scores on the Top Divisions regulars, lowered for weaker
//                 leagues, pulled toward a prior when minutes are few (900 minutes = half data, half prior; the prior
//                 is half the old Link-Up grade's z, or the role's average for a new player), then cut on the grade
//                 table below
//   size          data/soccer-attrs.js soccerSizeGrade(height, weight, role)
// Players new to the data (the Champions League top-up): the kept traits are predicted from their FotMob numbers
// and bio by a ridge regression fitted on the players who have grades, then put on each trait's spread by rank.
// A player already in the World Cup pool takes his World Cup grades instead (both pools stay identical).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { soccerSizeGrade } from '../../src/data/soccer-attrs.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ARGS = process.argv.slice(2)
const DRY = ARGS.includes('--dry')
const RAW = ARGS.find(a => !a.startsWith('--')) ?? 'F:/bap-agents/socattr/raw'
const DATA_FILE = path.join(ROOT, 'src', 'data', 'soccer-strikers.js')
const HERE = path.join(ROOT, 'scripts', 'soccer')
const V1 = JSON.parse(fs.readFileSync(path.join(HERE, 'ratings-v1.json'), 'utf8'))
const ADD = JSON.parse(fs.readFileSync(path.join(HERE, 'ucl-additions.json'), 'utf8'))
const FMP = JSON.parse(fs.readFileSync(path.join(RAW, 'fotmob-players.json'), 'utf8'))
const NINE = ['pace', 'finishing', 'shotPower', 'dribbling', 'passing', 'positioning', 'heading', 'size', 'composure']

// ── Hand corrections after the spot-check (2026-11-16): trait -> grade, with the reason ──
// Passing: the stats count passes that end in a shot, so the deep passers who set the tempo or play the pass before
// the assist come out a grade low against how they're rated everywhere (Kane's link-up was S, Modrić's and Rodri's
// passing are among the best of their time). Pace: Kanté is predicted from Süper Lig numbers with no tracking data;
// F (the bottom 2.5%) is too low even at 35.
export const FIX = {
  'Harry Kane': { passing: 10 },
  'Luka Modric': { passing: 9 },
  'Rodri': { passing: 9 },
  "N'Golo Kanté": { pace: 3 },
}

// ── helpers ──
const norm = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/ı/g, 'i').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
const toks = s => norm(s).split(' ').filter(Boolean)
const sameName = (a, b) => { const A = toks(a), B = toks(b); if (!A.length || !B.length) return false; if (A.join(' ') === B.join(' ')) return true; const [s, l] = A.length <= B.length ? [A, B] : [B, A]; return s.length > 1 ? s.every(t => l.includes(t)) : s[0].length > 3 && l[l.length - 1] === s[0] }
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1)
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))) || 1 }
const clampG = g => Math.max(0, Math.min(11, Math.round(g)))
// The grade table (data/soccer-strikers.js header): S top 1.5%, A+ next 3%, A 5%, A- 8%, B+ 11%, B 14%, B- 15%,
// C+ 14%, C 12%, C- 9%, D 5%, F the rest
const SHARE = [1.5, 3, 5, 8, 11, 14, 15, 14, 12, 9, 5]   // S .. D, from the top
function cutsOf(values) {
  const v = [...values].sort((a, b) => b - a), cuts = []
  let acc = 0
  for (const s of SHARE) { acc += s; cuts.push(v[Math.min(v.length - 1, Math.floor(acc / 100 * v.length))]) }
  return cuts   // cuts[i]: the lowest value of grade 11 - i
}
const gradeBy = (cuts, x) => { for (let i = 0; i < cuts.length; i++) if (x > cuts[i]) return 11 - i; return 0 }
// rank-for-rank: x's place among `ref` values -> the grade at that place among `grades`
function rankMap(ref, grades) {
  const r = [...ref].sort((a, b) => a - b), g = [...grades].sort((a, b) => a - b), n = r.length
  return x => {
    let lo = 0, hi = n
    while (lo < hi) { const m = (lo + hi) >> 1; if (r[m] < x) lo = m + 1; else hi = m }
    let eq = lo; while (eq < n && r[eq] === x) eq++
    const q = (lo + (eq - lo) / 2) / n
    return g[Math.min(n - 1, Math.max(0, Math.round(q * (n - 1))))]
  }
}

// ── League level (z), as the header's: weaker leagues lower the output ──
const LEVEL = {
  47: 0, 87: -0.05, 54: -0.1, 55: -0.1, 53: -0.25, 42: 0.1, 73: -0.3, 77: -0.2,
  57: -0.5, 61: -0.5, 48: -0.5, 71: -0.6, 40: -0.6, 268: -0.6, 130: -0.7, 536: -0.7, 230: -0.7, 112: -0.7,
  64: -0.8, 38: -0.8, 69: -0.8, 46: -0.8, 135: -0.8, 122: -0.8, 63: -0.8, 146: -0.8, 140: -0.8, 86: -0.8, 110: -0.8,
  441: -0.9, 59: -0.9, 67: -0.9, 252: -0.9, 182: -0.9, 196: -0.9, 223: -0.9,
  9080: -1.0, 189: -1.0, 212: -1.0, 127: -1.0, 136: -1.0, 538: -1.0, 176: -1.0,
  535: -1.1, 113: -1.1, 120: -1.1, 270: -1.1, 519: -1.1, 537: -1.1, 530: -1.1, 262: -1.1, 173: -1.1,
}
const levelOf = key => LEVEL[FMP.leagues[key]?.lid] ?? -1.0

// ── A player's FotMob numbers over both seasons (every league, cups too) ──
function statsOf(fid) {
  const p = FMP.players[fid]
  if (!p) return null
  let min = 0, lvl = 0
  const tot = { g: 0, pg: 0, xg: 0, xgot: 0, bcm: 0, a: 0, xa: 0, cc: 0, bcc: 0, pw: 0 }
  const rate = { sh90: [0, 0], sot90: [0, 0], ap90: [0, 0], acc: [0, 0], lb90: [0, 0], dr90: [0, 0], drp: [0, 0], pw3: [0, 0], rating: [0, 0] }
  let ts = null, big5 = 0
  for (const [key, l] of Object.entries(p.s)) {
    const m = l.min ?? 0
    if (!m) continue
    min += m; lvl += m * levelOf(key)
    if ([47, 87, 54, 55, 53].includes(+FMP.leagues[key].lid)) big5 += m
    for (const k of Object.keys(tot)) tot[k] += l[k] ?? 0
    for (const k of Object.keys(rate)) if (l[k] != null) { rate[k][0] += l[k] * m; rate[k][1] += m }
    if (l.ts) ts = Math.max(ts ?? 0, l.ts)
  }
  if (!min) return null
  const p90 = v => v / min * 90
  const r = k => (rate[k][1] ? rate[k][0] / rate[k][1] : null)
  return {
    min, big5, level: lvl / min, ts,
    g90: p90(tot.g), npg90: p90(tot.g - tot.pg), xg90: p90(tot.xg), a90: p90(tot.a), xa90: p90(tot.xa), cc90: p90(tot.cc), bcc90: p90(tot.bcc),
    pw90: p90(tot.pw), gmx: (tot.g - tot.pg - tot.xg) / Math.max(1, tot.xg + 2), xgotx: (tot.xgot - tot.xg) / Math.max(1, tot.xg + 2), bcmx: tot.bcm / Math.max(1, tot.xg + 2),
    sh90: r('sh90'), sot90: r('sot90'), ap90: r('ap90'), acc: r('acc'), lb90: r('lb90'), dr90: r('dr90'), drp: r('drp'), pw3: r('pw3'), rating: r('rating'),
  }
}

// ── The rows in the data file ──
const SRC = fs.readFileSync(DATA_FILE, 'utf8')
const CRLF = SRC.includes('\r\n')
let text = SRC.replace(/\r\n/g, '\n')
const wcAt = text.indexOf('export const WC_STRIKERS')
const ROW_RE = /  \{ name: "([^"]+)"[^\n]*?team: '([A-Z0-9]+)'[^\n]*?\n    attrs: \{[^}]*\} \},/g
const parseRow = (m, pool) => {
  const line = m[0]
  const num = k => { const x = line.match(new RegExp(`${k}: (-?\\d+|null)`)); return x && x[1] !== 'null' ? +x[1] : null }
  const str = k => line.match(new RegExp(`${k}: '([^']*)'`))?.[1] ?? null
  return { pool, name: m[1], team: m[2], nation: str('nation'), height: num('height'), weight: num('weight'), age: num('age'), espn: num('espn'), role: str('role') ?? 'ST', key: `${m[1]}|${m[2]}`, text: line }
}
const clubRows = [...text.slice(0, wcAt).matchAll(ROW_RE)].map(m => parseRow(m, 'club'))
const wcRows = [...text.slice(wcAt).matchAll(ROW_RE)].map(m => parseRow(m, 'wc'))

// ── Which FotMob player each row is (saved to fotmob-ids.json; a name in there wins on a rerun) ──
const IDS_FILE = path.join(HERE, 'fotmob-ids.json')
const IDS = fs.existsSync(IDS_FILE) ? JSON.parse(fs.readFileSync(IDS_FILE, 'utf8')) : {}
const byTok = new Map()
for (const [id, p] of Object.entries(FMP.players)) for (const t of toks(p.n)) { if (!byTok.has(t)) byTok.set(t, []); byTok.get(t).push(id) }
const CLUB_WORDS = { FCB: ['bayern'], INT: ['inter', 'internazionale'], ATM: ['atletico'], PSG: ['paris saint'], MCI: ['manchester city'], MUN: ['manchester united'], RBL: ['leipzig'], BVB: ['dortmund'], B04: ['leverkusen'], BMG: ['gladbach'], SGE: ['frankfurt'], TSG: ['hoffenheim'], VFB: ['stuttgart'], ROM: ['roma'], MIL: ['milan'], NAP: ['napoli'], OLM: ['marseille'] }
const clubNames = (() => { try { return Object.fromEntries([...fs.readFileSync(path.join(ROOT, 'src', 'data', 'soccer-clubs.js'), 'utf8').matchAll(/short: '([A-Z0-9]+)', name: "([^"]+)"/g)].map(m => [m[1], m[2]])) } catch { return {} } })()
const teamHit = (row, team) => {
  const t = norm(team), words = CLUB_WORDS[row.team] ?? [norm(clubNames[row.team] ?? '')]
  return words.some(w => w && (t.includes(w) || w.includes(t)))
}
const keptIds = new Map()
for (const [short, c] of Object.entries(ADD.clubs)) for (const k of c.kept) if (k.fotmob) keptIds.set(`${k.name}|${short}`, String(k.fotmob))
// an added player's row (on a rerun): the FotMob id he was picked with
const addedId = row => { const c = ADD.clubs[row.team]; const x = row.pool === 'club' && c ? c.added.find(a => sameName(a.name, row.name) || sameName(a.fotmobName, row.name)) : null; return x ? String(x.fotmob) : null }
// names FotMob spells another way (looked up by hand, 11-16)
const MANUAL_IDS = { 'Charalambos Kostoulas': '1561249', 'Yéremy Pino': '1047676', 'Oliver McBurnie': '509151', 'Fatawu Issahaku': '1265626', 'Abde Rebbach': '1200941',
  'Javi Guerra': '1284429', 'Jon Rowe': '1113694', 'Yannick Engelhardt': '1269497', 'Junior Adamu': '882163', 'Habib Diallo': '601145', 'Frantz Pierrot': '833641' }
function findId(row) {
  if (MANUAL_IDS[row.name]) return MANUAL_IDS[row.name]
  if (addedId(row)) return addedId(row)
  if (IDS[row.key]) return IDS[row.key]
  if (keptIds.has(row.key)) return keptIds.get(row.key)
  const cand = new Set()
  for (const t of toks(row.name)) for (const id of byTok.get(t) ?? []) cand.add(id)
  const hits = [...cand].filter(id => sameName(FMP.players[id].n, row.name))
  if (!hits.length) return null
  const score = id => {
    const p = FMP.players[id], lines = Object.values(p.s)
    const club = row.pool === 'club' && lines.some(l => l.team && teamHit(row, l.team))
    const nat = p.c && row.nation && p.c === row.nation
    const mins = lines.reduce((s, l) => s + (l.min ?? 0), 0)
    return (club ? 1e6 : 0) + (nat ? 1e5 : 0) + mins
  }
  hits.sort((a, b) => score(b) - score(a))
  const best = hits[0], p = FMP.players[best]
  const ok = (row.pool === 'club' && Object.values(p.s).some(l => l.team && teamHit(row, l.team))) || (p.c && row.nation && p.c === row.nation) || hits.length === 1
  return ok ? best : null
}

// ── Added players: their rows-to-be ──
const added = []
for (const [short, c] of Object.entries(ADD.clubs)) for (const a of c.added) added.push({ ...a, team: short, pool: 'club', key: `${a.name}|${short}`, fid: String(a.fotmob), isNew: true })
const pageOf = fid => { const f = path.join(RAW, 'players', `${fid}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null }

// every player once (club row, World Cup row and added rows of the same man share one entry)
const people = new Map()   // id key -> { rows: [], v1, fid, stats, role, height, weight }
const keyOf = (fid, name) => (fid ? `f${fid}` : `n${norm(name)}`)
const ids = {}
for (const row of [...clubRows, ...wcRows]) {
  const fid = findId(row)
  ids[row.key] = fid ?? null
  const k = keyOf(fid, row.name)
  const e = people.get(k) ?? { rows: [], fid, name: row.name }
  e.rows.push(row)
  e.v1 = e.v1 ?? (row.pool === 'club' ? V1.club[row.key] : V1.wc[row.key]) ?? null
  people.set(k, e)
}
for (const a of added) {
  // already in the data (a World Cup player): one man, the World Cup grades
  let e = people.get(keyOf(a.fid, a.name))
  if (!e) for (const x of people.values()) if (x.rows.some(r => r.pool === 'wc' && sameName(r.name, a.name) && (!x.fid || x.fid === a.fid))) { e = x; break }
  if (!e) { e = { rows: [], fid: a.fid, name: a.name, v1: null }; people.set(keyOf(a.fid, a.name), e) }
  e.rows.push(a)
  e.fid = e.fid ?? a.fid
}
for (const e of people.values()) {
  e.stats = e.fid ? statsOf(e.fid) : null
  const r0 = e.rows.find(r => r.pool === 'club' && V1.club[r.key]) ?? e.rows.find(r => r.pool === 'wc') ?? e.rows.find(r => r.isNew) ?? e.rows[0]
  e.role = r0.role; e.height = r0.height; e.weight = r0.weight; e.age = r0.age
}
const P = [...people.values()]
const graded = P.filter(e => e.v1)
// (the Top Divisions regulars as they were graded: a club row in the 11-15 grades, 900+ FotMob minutes)
const regulars = graded.filter(e => e.rows.some(r => r.pool === 'club' && V1.club[r.key]) && (e.stats?.min ?? 0) >= 900)

// ── Passing ──
const PASS_W = { cc90: 0.28, xa90: 0.24, bcc90: 0.12, a90: 0.12, acc: 0.12, ap90: 0.12 }
const ROLES = ['ST', 'SS', 'LW', 'RW', 'AM', 'CM', 'DM']
const passStd = Object.fromEntries(Object.keys(PASS_W).map(k => { const v = regulars.map(e => e.stats[k]).filter(x => x != null); return [k, [mean(v), sd(v)]] }))
const roleMean = (k, role) => { const v = regulars.filter(e => e.role === role).map(e => e.stats[k]).filter(x => x != null); return v.length ? mean(v) : passStd[k][0] }
function passZ(e) {
  const s = e.stats
  if (!s) return null
  let z = 0
  for (const [k, w] of Object.entries(PASS_W)) { const v = s[k] ?? roleMean(k, e.role); z += w * (v - passStd[k][0]) / passStd[k][1] }
  return z + 0.6 * s.level
}
const luGrades = graded.map(e => e.v1.linkUp)
const luM = mean(luGrades), luS = sd(luGrades)
for (const e of P) e.pz = passZ(e)
const rolePrior = Object.fromEntries(ROLES.map(r => { const v = regulars.filter(e => e.role === r).map(e => e.pz); return [r, v.length ? mean(v) : 0] }))
const K = 900
for (const e of P) {
  const prior = e.v1 ? 0.5 * (e.v1.linkUp - luM) / luS : rolePrior[e.role] ?? 0
  const m = e.stats?.min ?? 0
  e.passScore = e.pz == null ? prior : (m * e.pz + K * prior) / (m + K)
}
const passCuts = cutsOf(regulars.map(e => e.passScore))
for (const e of P) e.passing = gradeBy(passCuts, e.passScore)

// ── Dribbling: old dribbling and first touch, put back on dribbling's spread ──
const clubGraded = graded.filter(e => e.rows.some(r => r.pool === 'club'))
const blend = v => 0.5 * v.dribbling + 0.5 * v.firstTouch
const dribMap = rankMap(clubGraded.map(e => blend(e.v1)), clubGraded.map(e => e.v1.dribbling))
for (const e of graded) e.dribblingNew = dribMap(blend(e.v1))

// ── New players: the kept traits from a ridge regression on the graded players ──
const FEAT = ['g90', 'npg90', 'xg90', 'a90', 'xa90', 'cc90', 'bcc90', 'gmx', 'xgotx', 'bcmx', 'pw90', 'sh90', 'sot90', 'ap90', 'acc', 'lb90', 'dr90', 'drp', 'pw3', 'rating', 'ts']
const featOf = e => {
  const s = e.stats ?? {}
  const shrink = (k, v) => { const m = s.min ?? 0, rm = fm[k]; return v == null ? rm : (m * v + 600 * rm) / (m + 600) }
  const x = FEAT.map(k => shrink(k, s[k]))
  const h = e.height ?? 71, w = e.weight ?? Math.round(22.7 * h * h / 703)
  return [...x, s.level ?? -0.9, Math.log1p(s.min ?? 0), h, w, e.age ?? 26, ...ROLES.map(r => (e.role === r ? 1 : 0))]
}
const withStats = graded.filter(e => (e.stats?.min ?? 0) >= 300)
const fm = Object.fromEntries(FEAT.map(k => { const v = withStats.map(e => e.stats[k]).filter(x => x != null); return [k, v.length ? mean(v) : 0] }))
function ridge(X, y, lam) {
  const n = X.length, d = X[0].length
  const mu = Array.from({ length: d }, (_, j) => mean(X.map(r => r[j]))), sg = Array.from({ length: d }, (_, j) => sd(X.map(r => r[j])))
  const Z = X.map(r => r.map((v, j) => (v - mu[j]) / sg[j]))
  const ym = mean(y)
  const A = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? lam : 0)))
  const b = Array.from({ length: d }, (_, i) => Z.reduce((s, r, k) => s + r[i] * (y[k] - ym), 0))
  // solve A w = b (Gauss-Jordan)
  const M = A.map((r, i) => [...r, b[i]])
  for (let c = 0; c < d; c++) {
    let p = c; for (let r = c + 1; r < d; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    const v = M[c][c] || 1e-9
    for (let j = c; j <= d; j++) M[c][j] /= v
    for (let r = 0; r < d; r++) if (r !== c) { const f = M[r][c]; for (let j = c; j <= d; j++) M[r][j] -= f * M[c][j] }
  }
  const wv = M.map(r => r[d])
  return x => ym + x.reduce((s, v, j) => s + wv[j] * (v - mu[j]) / sg[j], 0)
}
const PRED = ['pace', 'finishing', 'shotPower', 'heading', 'composure', 'positioning', 'dribbling']
const v1Of = (e, t) => (t === 'positioning' ? e.v1.offBall : t === 'dribbling' ? e.dribblingNew : e.v1[t])
const models = {}, fit = {}
for (const t of PRED) {
  const X = withStats.map(featOf), y = withStats.map(e => v1Of(e, t))
  const f = ridge(X, y, 8)
  const preds = X.map(f)
  const r2 = 1 - mean(y.map((v, i) => (v - preds[i]) ** 2)) / sd(y) ** 2
  models[t] = { f, map: rankMap(preds, y) }
  fit[t] = Math.round(r2 * 100) / 100
}

// ── The nine for everyone ──
for (const e of P) {
  const a = {}
  if (e.v1) {
    a.pace = e.v1.pace; a.finishing = e.v1.finishing; a.shotPower = e.v1.shotPower; a.heading = e.v1.heading; a.composure = e.v1.composure
    a.positioning = e.v1.offBall; a.dribbling = e.dribblingNew
  } else {
    const x = featOf(e)
    for (const t of PRED) a[t] = models[t].map(models[t].f(x))
    e.predicted = true
  }
  a.passing = e.passing
  a.size = soccerSizeGrade(e.height, e.weight, e.role)
  const fix = FIX[e.name]
  if (fix) for (const [t, g] of Object.entries(fix)) if (NINE.includes(t)) a[t] = g
  e.attrs = Object.fromEntries(NINE.map(t => [t, clampG(a[t])]))
}

// ── Write the data file ──
const attrsText = a => `attrs: { ${NINE.map(t => `${t}: ${a[t]}`).join(', ')} }`
const byKey = new Map()
for (const e of P) for (const r of e.rows) byKey.set(`${r.pool}:${r.key}`, e)
text = text.replace(ROW_RE, (m0, name, team, off) => {
  const pool = off < text.indexOf('export const WC_STRIKERS') ? 'club' : 'wc'
  const e = byKey.get(`${pool}:${name}|${team}`)
  return e ? m0.replace(/attrs: \{[^}]*\}/, attrsText(e.attrs)) : m0
})
// the added rows
const PARTICLE = new Set(['de', 'van', 'da', 'dos', 'di', 'del', 'der', 'den', 'le', 'la', 'el', 'ter', 'von', 'mac'])
const shortOf = name => { const w = name.split(' '); if (w.length === 1) return name; let i = w.length - 1; while (i > 0 && PARTICLE.has(w[i - 1].toLowerCase())) i--; const s = w.slice(i).join(' '); return s[0].toUpperCase() + s.slice(1) }
const footOf = fid => { const pg = pageOf(fid); const v = pg?.playerInformation?.find(x => x.translationKey === 'preferred_foot')?.value?.key; return v === 'left' || v === 'right' || v === 'both' ? v : 'right' }
const SKIN = (() => { const f = path.join(HERE, 'ucl-skin.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {} })()
const rowText = (a, starter) => {
  const e = [...people.values()].find(x => x.rows.includes(a))
  const wc = e.rows.find(r => r.pool === 'wc')
  const q = s => JSON.stringify(s)
  const height = wc?.height ?? a.height, weight = wc?.weight ?? a.weight, age = wc?.age ?? a.age, espn = wc?.espn ?? a.espn
  const skin = wc?.text.match(/skin: '([^']*)'/)?.[1] ?? SKIN[a.fid] ?? null
  const foot = wc?.text.match(/foot: '([^']*)'/)?.[1] ?? footOf(a.fid)
  return `  { name: ${q(wc?.name ?? a.name)}, short: ${q(shortOf(wc?.name ?? a.name))}, team: '${a.team}', nation: '${wc?.nation ?? a.nationCode}', number: ${a.number ?? null}, height: ${height ?? null}, weight: ${weight ?? null}, age: ${age ?? null}, foot: '${foot}', skin: ${skin ? `'${skin}'` : null}, espn: ${espn ?? null}, starter: ${starter}, position: 'ST', role: '${a.role}',\n    ${attrsText(e.attrs)} },`
}
const NEW_CLUBS = Object.entries(ADD.clubs).filter(([, c]) => !c.kept.length).map(([s]) => s)
for (const [short, c] of Object.entries(ADD.clubs)) {
  // (a rerun: the rows already written stay where they are and only get their attrs again)
  const mine = added.filter(a => a.team === short && !clubRows.some(r => r.team === short && sameName(r.name, a.name)))
  if (!mine.length) continue
  const isNewClub = NEW_CLUBS.includes(short)
  // a new club's main striker: its ST with the most league minutes this season (then last season), else its SS
  let starter = null
  if (isNewClub) {
    const pick = r => mine.filter(a => a.role === r).sort((x, y) => y.m27 - x.m27 || y.m26 - x.m26)[0]
    starter = pick('ST') ?? pick('SS') ?? mine[0]
  }
  const block = mine.map(a => rowText(a, a === starter)).join('\n')
  if (isNewClub) {
    const head = `\n  // ─── ${short} ────────────────────────────────────────────────────────────\n`
    const end = text.indexOf('\n]\n', 0)
    text = text.slice(0, end) + '\n' + head.slice(1) + block + text.slice(end)
  } else {
    // after the club's last row in the club list
    const clubPart = text.slice(0, text.indexOf('export const WC_STRIKERS'))
    let last = -1
    for (const m of clubPart.matchAll(ROW_RE)) if (m[2] === short) last = m.index + m[0].length
    if (last < 0) throw new Error(`no rows for ${short}`)
    text = text.slice(0, last) + '\n' + block + text.slice(last)
  }
}

// ── Report ──
const report = P.map(e => ({ name: e.name, teams: e.rows.map(r => r.team), role: e.role, fotmob: e.fid ?? null, min: e.stats?.min ?? 0, level: e.stats ? Math.round(e.stats.level * 100) / 100 : null,
  pass: e.stats ? { cc90: +(e.stats.cc90).toFixed(2), xa90: +(e.stats.xa90).toFixed(2), a90: +(e.stats.a90).toFixed(2), acc: e.stats.acc, ap90: e.stats.ap90 } : null,
  passScore: Math.round(e.passScore * 100) / 100, predicted: !!e.predicted, attrs: e.attrs, v1: e.v1 }))
fs.writeFileSync(path.join(RAW, 'grade-nine-report.json'), JSON.stringify({ fit, passCuts: passCuts.map(x => Math.round(x * 100) / 100), regulars: regulars.length, people: report }, null, 0).replace(/\},\{"name"/g, '},\n{"name"'))
fs.writeFileSync(IDS_FILE, JSON.stringify(Object.fromEntries(Object.entries(ids).sort()), null, 1) + '\n')
if (!DRY) fs.writeFileSync(DATA_FILE, CRLF ? text.replace(/\n/g, '\r\n') : text)
const noStats = P.filter(e => !e.stats || e.stats.min < 450)
console.log(`${P.length} players (${regulars.length} regulars cut the passing grades), ${added.length} rows added, ${P.filter(e => e.predicted).length} predicted`)
console.log('model fit (R^2):', JSON.stringify(fit))
console.log(`${noStats.length} with under 450 FotMob minutes (passing leans on the prior)`)
