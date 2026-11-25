// College Football defensive backs: builds src/data/cfb-dbs.js (CB1, CB2 and S1 for every FBS team).
//
//   node scripts/cfb/build-dbs.mjs            build the file (and print the checks)
//   node scripts/cfb/build-dbs.mjs --report   also print every slot's candidates and the top boards
//
// Inputs (DATA, default the session scratch folder; every file there is ESPN's, pulled 2026-11-25):
//   ../games-2024.json, games-2025.json, games-2026.json   every FBS game's box score, each man's defensive line
//   rosters.json      ESPN team rosters (teams/{id}/roster?limit=300): position, height, weight, class, jersey
//   feed-2024..2026   ESPN's season feed (statistics/byathlete?category=defense): games played, forced fumbles
//   fpi-raw.json      ESPN FPI 2026 (fitt/v3 powerindex): each team's offensive efficiency, for schedule strength
//   pos-web.txt       CB or S for the DB-listed rosters (ESPN lists 47 teams' backs only as "DB"), read off team
//                     previews, depth charts and beat coverage found by web search
// The hand-check (injuries, positions, grade moves, verified speeds) is the HAND table below, each with its reason.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DATA = process.env.DATA || '/tmp/claude-0/-home-user-build-a-player/4066ce4a-5b5d-58f9-9095-5442ae7c3c08/scratchpad/cfbdef/db'
const REPORT = process.argv.includes('--report')
const J = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const { CFB_TEAMS } = await import(pathToFileURL(path.join(ROOT, 'src/data/cfb-teams.js')).href)
const { DB_TYPES, dbSizeGrade } = await import(pathToFileURL(path.join(ROOT, 'src/data/dbs.js')).href).catch(() => ({}))
const HAND = (await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'dbs-hand.mjs')).href)).HAND

// ── the game's own numbers (src/data/dbs.js, src/utils/simulation.js calcOVRDB, src/utils/cfbOvr.js) ──────────
const TYPES = DB_TYPES ?? ['speed', 'size', 'fluidity', 'press', 'hands', 'zoneIQ', 'manCoverage', 'playRecognition', 'runSupport']
const SIZE = dbSizeGrade ?? ((h, w, spot) => { const s = spot === 's' ? { lb: [185, 218], w: 0.8 } : { lb: [175, 210], w: 0.7 }; const g = (v, [lo, hi]) => Math.max(0, Math.min(11, (v - lo) / (hi - lo) * 11)); return Math.round(g(w, s.lb) * s.w + g(h, [69, 75]) * (1 - s.w)) })
const W = { speed: 0.14, size: 0.06, fluidity: 0.10, press: 0.11, hands: 0.10, zoneIQ: 0.13, manCoverage: 0.15, playRecognition: 0.14, runSupport: 0.07 }
function calcOVRDB(a) {
  const vals = TYPES.map(t => a[t]), tw = TYPES.reduce((s, t) => s + W[t], 0)
  const avg = TYPES.reduce((s, t) => s + a[t] * W[t] / tw, 0)
  let ovr = 60 + 2.1 * avg + 0.21 * avg * avg
  const mn = Math.min(...vals); if (mn >= 9) ovr += 2; else if (mn >= 8) ovr += 0.5
  return Math.min(99, Math.max(0, Math.round(ovr)))
}
const collegeOVR = r => Math.min(99, r + (r >= 95 ? 2 : r >= 90 ? 1 : 0))

// ── teams, schedule strength ──────────────────────────────────────────────────────────────────────────────────────
const P4 = new Set(['sec', 'bigten', 'big12', 'acc'])
const isP4 = t => P4.has(t.conf) || t.short === 'NDAM'
const TEAM = new Map(CFB_TEAMS.map(t => [t.espn, t]))
const FBS = new Set(CFB_TEAMS.map(t => t.espn))
const FPI = new Map(J('fpi-raw.json').teams.map(x => [x.team.id, x.categories.find(c => c.name === 'efficiencies')?.values?.[2]]))
const FCS_OFF = 12   // an FCS opponent's offense, on FPI's 0-100 scale (the offense pools gave FCS defenses 12)
const offEff = id => FBS.has(id) ? (FPI.get(id) ?? 50) : FCS_OFF

// ── box scores: each man's season totals (FBS teams only) and his 2026 game lines ──────────────────────────────────
const n = v => { const x = parseFloat(v); return isFinite(x) ? x : 0 }
const KEYS = ['tk', 'solo', 'sck', 'tfl', 'pd', 'qbh', 'int', 'intYds', 'intTd', 'fr', 'td']
const P = {}, teamGames = {}
for (const season of [2026, 2025, 2024]) {
  const games = J(`../games-${season}.json`).sort((a, b) => a.date.localeCompare(b.date))
  for (const g of games) {
    if (season === 2026) for (const tid of g.teams) (teamGames[tid] ??= []).push(g.id)
    for (const p of g.players) {
      if (!/^\d+$/.test(p.id) || !FBS.has(p.team)) continue
      const d = p.cat.defensive, i = p.cat.interceptions, f = p.cat.fumbles
      if (!d && !i) continue
      const line = { tk: n(d?.TOT), solo: n(d?.SOLO), sck: n(d?.SACKS), tfl: n(d?.TFL), pd: n(d?.PD), qbh: n(d?.['QB HUR']), int: n(i?.INT), intYds: n(i?.YDS), intTd: n(i?.TD), fr: n(f?.REC), td: Math.max(n(d?.TD), n(i?.TD)) }
      const X = P[p.id] ??= { seasons: {}, g26: new Map() }
      const S = X.seasons[season] ??= { apps: 0, ...Object.fromEntries(KEYS.map(k => [k, 0])), opp: [] }
      S.apps++
      for (const k of KEYS) S[k] += line[k]
      S.opp.push(offEff(g.teams.find(t => t !== p.team)))
      if (season === 2026) X.g26.set(g.id, { team: p.team, ...line })
    }
  }
}
// ESPN's season feed: games played and forced fumbles (regular season; the box scores have no forced fumbles)
const FEED = {}
for (const season of [2026, 2025, 2024]) for (const a of J(`feed-${season}.json`)) {
  const gen = a.cats.find(c => c.name === 'general')?.totals ?? []
  ;(FEED[a.id] ??= {})[season] = { gp: n(gen[0]), ff: n(gen[1]) }
}
const seasonLine = (id, season) => {
  const S = P[id]?.seasons?.[season], F = FEED[id]?.[season]
  if (!S && !F?.gp) return null
  const o = { g: Math.max(S?.apps ?? 0, F?.gp ?? 0) }
  for (const k of ['tk', 'solo', 'sck', 'tfl', 'pd', 'qbh', 'int', 'intYds', 'intTd']) o[k] = S?.[k] ?? 0
  o.ff = F?.ff ?? 0; o.fr = S?.fr ?? 0; o.td = S?.td ?? 0
  return o
}

// ── rosters, positions ──────────────────────────────────────────────────────────────────────────────────────────────
const ROSTERS = J('rosters.json')
const DBPOS = new Set(['CB', 'S', 'DB', 'FS', 'SS', 'NB'])
// hand entries may be keyed "TEAM|Full Name" instead of the ESPN id
for (const part of ['out', 'subpos', 'grades', 'prefer', 'back']) for (const k of Object.keys(HAND[part])) {
  if (!k.includes('|')) continue
  const [team, name] = k.split('|'); const a = (ROSTERS[team] ?? []).find(x => x.name === name)
  if (!a) { console.warn(`hand ${part}: no ${name} on ${team}`); continue }
  HAND[part][a.id] = HAND[part][k]; delete HAND[part][k]
}
const WEB = {}
for (const line of fs.readFileSync(path.join(DATA, 'pos-web.txt'), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue
  const [team, ...rest] = line.split(' '); const body = rest.join(' ')
  for (const part of body.split(';')) { const m = part.trim().match(/^(.+)=(cb|s)$/); if (m) (WEB[team] ??= {})[m[1].trim()] = m[2] }
}
// stat profile for a "DB" nobody's coverage placed: a logistic fit on the 773 ESPN-labeled CB/S with 4+ weighted games
// (weight, height, tackles a game, PD share of plays, INT per PD); right 78% of the time overall, 91-96% at the ends
const POSW = J('possig-w.json')
function safetyProb(id, h, w) {
  let tk = 0, pd = 0, g = 0, it = 0
  for (const [s, wt] of [[2026, 1], [2025, 0.6], [2024, 0.35]]) { const L = seasonLine(id, s); if (L) { tk += wt * L.tk; pd += wt * L.pd; g += wt * L.g; it += wt * L.int } }
  g = Math.max(g, 1)
  const x = [1, ((w ?? 195) - 195) / 10, ((h ?? 72) - 72) / 2, (tk / g - 3.5) / 2, (pd / (tk + pd + 1e-9) - 0.15) / 0.1, (it + 0.5) / (pd + 1)]
  return 1 / (1 + Math.exp(-x.reduce((s, v, i) => s + v * POSW[i], 0)))
}
const posSource = {}
function subposOf(team, a) {
  if (HAND.subpos[a.id]) { posSource[a.id] = 'hand'; return HAND.subpos[a.id][0] }
  if (a.pos === 'CB' || a.pos === 'NB') { posSource[a.id] = 'espn'; return 'cb' }
  if (a.pos === 'S' || a.pos === 'FS' || a.pos === 'SS') { posSource[a.id] = 'espn'; return 's' }
  const web = WEB[team]?.[a.name]
  if (web) { posSource[a.id] = 'web'; return web }
  posSource[a.id] = 'stats'
  return safetyProb(a.id, a.h, a.w) > 0.5 ? 's' : 'cb'
}

// ── slots: depth by 2026 usage (tackles + 3 x PD + 4 x INT a game, the last four team games counted twice) ─────────────────────────────────────────────
const slotted = [], report = []
for (const t of CFB_TEAMS) {
  const tg = teamGames[t.espn] ?? [], N = tg.length
  const cands = []
  for (const a of ROSTERS[t.short] ?? []) {
    if (!DBPOS.has(a.pos) && !HAND.subpos[a.id]) continue
    const X = P[a.id]
    let score = 0, gp = 0, pattern = ''
    tg.forEach((gid, i) => {
      const x = X?.g26.get(gid); const w = i >= N - 4 ? 2 : 1
      if (x && x.team === t.espn) { gp++; score += w * (0.6 + 0.1 * (x.tk + 3 * x.pd + 4 * x.int)); pattern += x.tk + x.pd >= 3 ? 'X' : 'x' } else pattern += '.'
    })
    // ESPN's games played counts the games he was on the field without a stat (a corner nobody throws at): 0.6 each
    score += 0.6 * Math.max(0, (FEED[a.id]?.[2026]?.gp ?? 0) - gp)
    if (HAND.prefer[a.id]) score += typeof HAND.prefer[a.id] === 'object' ? HAND.prefer[a.id].bonus : 100
    cands.push({ a, sub: subposOf(t.short, a), score, gp, pattern })
  }
  cands.sort((x, y) => y.score - x.score)
  // a man who has missed his team's last 4 games is left out unless the hand-check says he is due back
  const ok = c => !HAND.out[c.a.id] && c.gp > 0 && (!/\.{4}$/.test(c.pattern) || HAND.back?.[c.a.id])
  const pick = []
  const cbs = cands.filter(c => c.sub === 'cb' && ok(c)), ss = cands.filter(c => c.sub === 's' && ok(c))
  for (const [i, c] of cbs.slice(0, 2).entries()) pick.push({ ...c, slot: `CB${i + 1}`, depth: i + 1 })
  if (ss[0]) pick.push({ ...ss[0], slot: 'S1', depth: 1 })
  // a roster short of corners or safeties takes its best remaining back by stat profile, so every slot is filled
  const used = new Set(pick.map(p => p.a.id))
  const rest = cands.filter(c => ok(c) && !used.has(c.a.id))
  while (pick.filter(p => p.slot.startsWith('CB')).length < 2 && rest.length) {
    rest.sort((x, y) => safetyProb(x.a.id, x.a.h, x.a.w) - safetyProb(y.a.id, y.a.h, y.a.w) || y.score - x.score)
    const c = rest.shift(); const k = pick.filter(p => p.slot.startsWith('CB')).length + 1
    pick.push({ ...c, sub: 'cb', slot: `CB${k}`, depth: k, filled: true })
  }
  if (!pick.some(p => p.slot === 'S1') && rest.length) {
    rest.sort((x, y) => safetyProb(y.a.id, y.a.h, y.a.w) - safetyProb(x.a.id, x.a.h, x.a.w) || y.score - x.score)
    pick.push({ ...rest.shift(), sub: 's', slot: 'S1', depth: 1, filled: true })
  }
  for (const p of pick) slotted.push({ team: t, N, ...p })
  report.push({ team: t.short, N, cands: cands.slice(0, 8).map(c => `${c.sub}${posSource[c.a.id][0]} ${c.a.name} ${c.score.toFixed(1)} ${c.pattern}${HAND.out[c.a.id] ? ' OUT' : ''}`) })
}

// ── grading ──────────────────────────────────────────────────────────────────────────────────────────────────────
// every roster DB with 4+ weighted FBS games is the pool a man is graded against, at his own subpos
const SW = [[2026, 1], [2025, 0.6], [2024, 0.35]]
function profile(id, sub, h, w, teamId) {
  const L = {}; for (const [s] of SW) L[s] = seasonLine(id, s)
  const T = { g: 0, tk: 0, solo: 0, tfl: 0, pd: 0, int: 0, intYds: 0, ff: 0 }
  for (const [s, wt] of SW) if (L[s]) for (const k of Object.keys(T)) T[k] += wt * L[s][k]
  const career = SW.reduce((s, [y]) => s + (L[y]?.g ?? 0), 0)
  const opp = P[id]?.seasons?.[2026]?.opp ?? []
  const tg = teamGames[teamId]?.length ?? 0
  return { id, sub, h: h ?? 72, w: w ?? 195, T, L, career, sched: opp.length ? opp.reduce((a, b) => a + b, 0) / opp.length : null, gpShare: tg ? (L[2026]?.g ?? 0) / tg : 0 }
}
const pool = []
for (const t of CFB_TEAMS) for (const a of ROSTERS[t.short] ?? []) {
  if (!DBPOS.has(a.pos) && !HAND.subpos[a.id]) continue
  const pr = profile(a.id, subposOf(t.short, a), a.h, a.w, t.espn)
  if (pr.T.g >= 4) pool.push(pr)
}
const K_RATE = 4   // games of the pool's rate added to every man's rates (small samples regress)
const rates = (pr, M) => {
  const g = pr.T.g + K_RATE, T = pr.T
  const defl = T.int + T.pd
  return {
    int: (T.int + K_RATE * M.int) / g, pd: (T.pd + K_RATE * M.pd) / g, defl: (defl + K_RATE * (M.int + M.pd)) / g,
    intShare: (T.int + 3 * M.intShare) / (defl + 3), tk: (T.tk + K_RATE * M.tk) / g, solo: (T.solo + 20 * M.solo) / (T.tk + 20),
    tfl: (T.tfl + K_RATE * M.tfl) / g, ff: (T.ff + K_RATE * M.ff) / g, intRet: (T.intYds + 3 * M.intRet) / (T.int + 3),
    career: Math.log(1 + pr.career), role: pr.gpShare, ht: pr.h, wt: pr.w,
  }
}
const mean = a => a.reduce((s, x) => s + x, 0) / a.length
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))) || 1 }
const BASE = {}, NORM = {}
for (const sub of ['cb', 's']) {
  const pp = pool.filter(p => p.sub === sub), sum = k => pp.reduce((s, p) => s + p.T[k], 0), G = sum('g')
  BASE[sub] = { int: sum('int') / G, pd: sum('pd') / G, tk: sum('tk') / G, tfl: sum('tfl') / G, ff: sum('ff') / G, intShare: sum('int') / (sum('int') + sum('pd')), solo: sum('solo') / sum('tk'), intRet: sum('intYds') / Math.max(1, sum('int')) }
  const R = pp.map(p => rates(p, BASE[sub]))
  NORM[sub] = Object.fromEntries(Object.keys(R[0]).map(k => [k, [mean(R.map(r => r[k])), sd(R.map(r => r[k]))]]))
  const sc = pp.filter(p => p.sched != null).map(p => p.sched); NORM[sub].sched = [mean(sc), sd(sc)]
}
// trait evidence (z-scores of the rates above; "-" = lower is better). Corners and safeties use the same mixes,
// each graded against his own position, with the ball-skill traits leaning on interceptions harder at safety.
const RECIPE = {
  hands:           { int: 0.45, defl: 0.35, intShare: 0.2 },
  manCoverage:     { pd: 0.45, int: 0.2, role: 0.35 },
  press:           { pd: 0.35, int: 0.15, role: 0.3, wt: 0.1, ht: 0.1 },
  zoneIQ:          { cb: { int: 0.4, pd: 0.3, career: 0.3 }, s: { int: 0.5, pd: 0.3, career: 0.2 } },
  runSupport:      { tk: 0.5, solo: 0.25, tfl: 0.25 },
  playRecognition: { int: 0.3, tfl: 0.25, ff: 0.15, career: 0.3 },
  fluidity:        { role: 0.4, pd: 0.3, wt: -0.3 },
  speed:           { role: 0.35, wt: -0.25, intRet: 0.15, pd: 0.25 },
}
const PRODUCTION = new Set(['hands', 'manCoverage', 'press', 'zoneIQ', 'runSupport', 'playRecognition'])
function evidence(pr) {
  const r = rates(pr, BASE[pr.sub]), Z = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (v - NORM[pr.sub][k][0]) / NORM[pr.sub][k][1]]))
  const ev = {}
  for (const [t, rec0] of Object.entries(RECIPE)) { const rec = rec0.cb ? rec0[pr.sub] : rec0; ev[t] = Object.entries(rec).reduce((s, [k, w]) => s + w * Z[k], 0) }
  return ev
}
// re-standardize each trait's evidence within the pool so every trait has the same spread
const EVN = {}
for (const sub of ['cb', 's']) {
  const E = pool.filter(p => p.sub === sub).map(evidence)
  EVN[sub] = Object.fromEntries(Object.keys(RECIPE).map(t => [t, [mean(E.map(e => e[t])), sd(E.map(e => e[t]))]]))
}
// HIS LEVEL (the TE file's step): how much he produces, at his position. Corners: plays on the ball (INT + PD) a game .3,
// PD a game .2, interceptions .15, role .15, tackles .05, experience .15. Safeties: tackles .25, interceptions .25, plays on the ball .2,
// role .15, experience .15. A trait is then 0.62 x his level + 0.5 x (that trait's evidence minus the average of his
// traits' evidence): the level decides how good he is, the evidence what he is good at.
const LEVEL = { cb: { defl: 0.3, pd: 0.2, int: 0.15, role: 0.15, tk: 0.05, career: 0.15 }, s: { tk: 0.25, int: 0.25, defl: 0.2, role: 0.15, career: 0.15 } }
const levelRaw = pr => { const r = rates(pr, BASE[pr.sub]); return Object.entries(LEVEL[pr.sub]).reduce((s, [k, w]) => s + w * (r[k] - NORM[pr.sub][k][0]) / NORM[pr.sub][k][1], 0) }
const LVN = {}
for (const sub of ['cb', 's']) { const L = pool.filter(p => p.sub === sub).map(levelRaw); LVN[sub] = [mean(L), sd(L)] }
const K_SHRINK = 5                                          // weighted games
const PRIOR = { CB1: 0.2, CB2: -0.1, S1: 0.2 }              // level z a man with no college games would get at the slot
const TIER = { P4: 0.25, G6: -0.2 }                         // the TE file's level step: a Power 4 schedule, or not
const SCHED = 0.25                                          // x the z of his 2026 opponents' FPI offensive efficiency
const LEVEL0 = { cb: -0.42, s: -0.6 }                       // centers the curve on starters (the pool counts backups)
const SLOPE = 2.0
const curve = z => { let g = 5.7 + 1.05 * SLOPE * z * (z < 0 ? 0.85 : 1) + 0.6 * Math.max(0, z - 1) ** 2; g = Math.round(g); if (g >= 11 && z < 2.7) g = 10; return Math.max(0, Math.min(11, g)) }

const rows = []
for (const s of slotted) {
  const a = s.a, t = s.team
  const pr = profile(a.id, s.sub, a.h, a.w, t.espn)
  const ev = evidence(pr)
  const schedZ = pr.sched == null ? 0 : (pr.sched - NORM[s.sub].sched[0]) / NORM[s.sub].sched[1]
  const nW = pr.T.g, keep = nW / (nW + K_SHRINK)
  let lv = (levelRaw(pr) - LVN[s.sub][0]) / LVN[s.sub][1] + SCHED * schedZ + (isP4(t) ? TIER.P4 : TIER.G6)
  lv = keep * lv + (1 - keep) * PRIOR[s.slot] + LEVEL0[s.sub]
  const e = Object.fromEntries(Object.keys(RECIPE).map(tr => [tr, (ev[tr] - EVN[s.sub][tr][0]) / EVN[s.sub][tr][1]]))
  const em = mean(Object.values(e))
  const zt = {}, attrs = {}
  for (const tr of Object.keys(RECIPE)) { zt[tr] = 0.62 * lv + 0.5 * keep * (e[tr] - em); attrs[tr] = curve(zt[tr]) }
  attrs.size = SIZE(a.h ?? 72, a.w ?? 195, s.sub)
  rows.push({ s, a, t, pr, zt, lv, attrs, formula: { ...attrs } })
}

// ── the hand-check: grade moves, verified speeds ───────────────────────────────────────────────────────────────────
const applied = []
for (const r of rows) {
  const h = HAND.grades[r.a.id]
  if (!h) continue
  for (const [tr, v] of Object.entries(h.set ?? {})) r.attrs[tr] = v
  if (h.shift) for (const tr of h.traits ?? Object.keys(RECIPE)) r.attrs[tr] = Math.max(0, Math.min(11, r.attrs[tr] + h.shift))
  applied.push(r.a.id)
}
for (const id of Object.keys(HAND.grades)) if (!applied.includes(id)) console.warn('hand grade for a man not in a slot:', id, HAND.grades[id].name)

// ── rows ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i
const shortName = (full, team, all) => {
  const parts = full.split(' '); while (parts.length > 1 && SUFFIX.test(parts.at(-1))) parts.pop()
  const last = parts.length > 1 ? parts.slice(1).join(' ') : parts[0]
  const clash = all.filter(x => x.t.short === team && x.a.id !== undefined && x.a.name !== full && x.a.name.split(' ').filter(p => !SUFFIX.test(p)).slice(1).join(' ') === last).length
  return clash ? `${parts[0][0]}. ${last}` : last
}
function classOf(id, exp) {
  const idx = { FR: 0, SO: 1, JR: 2, SR: 3 }[exp] ?? null
  if (idx == null) return exp ?? null
  // RS-: a college season of 4 games or fewer since his class says he enrolled (a 0-game year counts only after an
  // FBS season), or FBS games before that year; and he has a 5-game FBS season on record (FCS/JUCO years are invisible)
  const g = y => seasonLine(id, y)?.g ?? 0
  const full = [2024, 2025, 2026].some(y => g(y) >= 5)
  const thin = [2024, 2025].some(y => y >= 2026 - idx && g(y) <= 4 && (g(y) > 0 || [2024, 2025].some(z => z < y && g(z) > 0)))
  const early = [2024, 2025].some(y => y < 2026 - idx && g(y) > 0)
  const rs = full && (thin || early)
  return (rs ? 'RS-' : '') + exp
}
// headshot + skin: only when ESPN's photo is on disk (scripts/fetch-cfb-assets.mjs fetches it); no photo, initials
let sharp = null; try { sharp = (await import('sharp')).default } catch {}
async function skinOf(file) {
  if (!sharp || !fs.existsSync(file)) return null
  try {
    const { data, info } = await sharp(file).extract({ left: 125, top: 45, width: 100, height: 110 }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const px = []
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0
      if (r < 50 || r < g || r < b || g < b * 0.5 || (mn > 210 && mx - mn < 25) || sat < 0.08 || sat > 0.8) continue
      px.push([r, g, b, r + g + b])
    }
    if (px.length < 60) return null
    px.sort((x, y) => x[3] - y[3]); const m = px[Math.floor(px.length / 2)]
    return '#' + m.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('')
  } catch { return null }
}
const strip = L => L && { g: L.g, tk: L.tk, solo: L.solo, sck: L.sck, tfl: L.tfl, pd: L.pd, qbh: L.qbh, int: L.int, intYds: L.intYds, intTd: L.intTd, ff: L.ff, fr: L.fr, td: L.td }
const ORDER = { CB1: 0, CB2: 1, S1: 2 }
rows.sort((x, y) => CFB_TEAMS.indexOf(x.t) - CFB_TEAMS.indexOf(y.t) || ORDER[x.s.slot] - ORDER[y.s.slot])
const out = []
for (const r of rows) {
  const { a, t, s } = r
  const file = path.join(ROOT, 'public/headshots', `cfb_${a.id}.webp`)
  const has = fs.existsSync(file)
  const attrs = Object.fromEntries(TYPES.map(k => [k, r.attrs[k]]))
  out.push({
    name: a.name, short: shortName(a.name, t.short, rows), team: t.short, teamName: t.name, conf: t.conf, color: t.color, color2: t.color2,
    skin: has ? await skinOf(file) : null, starter: true, depth: s.depth, slot: s.slot, subpos: s.sub, pos: 'db', espnPos: a.pos,
    number: a.jersey != null && a.jersey !== '' ? +a.jersey : null, year: classOf(a.id, a.exp), height: a.h ?? null, weight: a.w ?? null,
    espn: a.id, headshot: has ? `cfb_${a.id}` : null, ovr: collegeOVR(calcOVRDB(attrs)), attrs,
    s26: strip(seasonLine(a.id, 2026)), s25: strip(seasonLine(a.id, 2025)),
    _p4: isP4(t), _z: r.zt, _formula: r.formula, _pr: r.pr, _pattern: s.pattern, _src: posSource[a.id], _filled: !!s.filled,
  })
}

// ── checks ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const avgTrait = list => list.length ? (list.reduce((s, p) => s + TYPES.reduce((a, k) => a + p.attrs[k], 0) / TYPES.length, 0) / list.length) : NaN
const grp = (p4, slot) => out.filter(p => p._p4 === p4 && p.slot === slot)
const checks = []
checks.push(`average trait grade (size included): P4 CB1 ${avgTrait(grp(true, 'CB1')).toFixed(1)} / CB2 ${avgTrait(grp(true, 'CB2')).toFixed(1)} / S1 ${avgTrait(grp(true, 'S1')).toFixed(1)}` +
  ` · G6 CB1 ${avgTrait(grp(false, 'CB1')).toFixed(1)} / CB2 ${avgTrait(grp(false, 'CB2')).toFixed(1)} / S1 ${avgTrait(grp(false, 'S1')).toFixed(1)}`)
checks.push(`all P4 ${avgTrait(out.filter(p => p._p4)).toFixed(1)} · all G6 ${avgTrait(out.filter(p => !p._p4)).toFixed(1)}`)
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))] }
const ov = out.map(p => p.ovr)
checks.push(`college OVR p10 / median / p90 / max: ${q(ov, 0.1)} / ${q(ov, 0.5)} / ${q(ov, 0.9)} / ${Math.max(...ov)}; ${ov.filter(x => x >= 95).length} rows at 95+`)
const top = [...out].sort((x, y) => y.ovr - x.ovr || avgTrait([y]) - avgTrait([x]))
const rank = id => top.findIndex(p => p.espn === id) + 1

{ const c = {}; for (const p of out) c[p._src] = (c[p._src] ?? 0) + 1; checks.push(`corner or safety from: ESPN's listing ${c.espn ?? 0}, web search ${c.web ?? 0}, hand ${c.hand ?? 0}, stat profile ${c.stats ?? 0} (Group of 6 rosters mostly; no coverage found)`) }
// the boards: where the names the 2027 draft boards rank first at the position land
const BOARD = ['Leonard Moore', 'Ashton Hampton', 'Ellis Robinson IV', 'Kelley Jones', 'Audavion Collins', 'Jyaire Hill', 'Jamari Sharpe', 'Zabien Brown',
  'KJ Bolden', 'Kingston Lopa', 'Ty Benefield', 'Jelani McDonald', 'Jackson Bennee', 'Bray Hubbard']
checks.push('2027 board names (Kiper, PFF, Brugler, PFN): ' + BOARD.map(nm => { const p = out.find(x => x.name === nm); return p ? `${nm} #${rank(p.espn)}` : `${nm} (not in a slot)` }).join(', '))
// the national leaders, every FBS player (2026 box scores): where they land
const NAMES = {}; for (const t of CFB_TEAMS) for (const a of ROSTERS[t.short] ?? []) NAMES[a.id] = `${a.name} (${t.short})`
for (const k of ['int', 'pd']) {
  const lead = Object.entries(P).filter(([, X]) => X.seasons[2026]).sort((a, b) => b[1].seasons[2026][k] - a[1].seasons[2026][k]).slice(0, 8)
  checks.push(`national 2026 ${k === 'int' ? 'INT' : 'PD'} leaders: ` + lead.map(([id, X]) => `${NAMES[id] ?? id} ${X.seasons[2026][k]} ${out.find(p => p.espn === id) ? '#' + rank(id) : '(not a slot: ' + (HAND.out[id] ? 'out' : 'second safety/corner behind the slot men') + ')'}`).join(', '))
}
if (REPORT) {
  for (const r of report) console.log(r.team, r.N, '\n   ' + r.cands.join('\n   '))
  console.log('\nTOP 40'); top.slice(0, 40).forEach((p, i) => console.log(i + 1, p.ovr, p.slot, p.team, p.name, JSON.stringify(p.attrs), `26: ${p.s26?.g}g ${p.s26?.tk}tk ${p.s26?.int}int ${p.s26?.pd}pd`))
  const lead = k => [...out].sort((x, y) => (y.s26?.[k] ?? 0) - (x.s26?.[k] ?? 0)).slice(0, 10).map(p => `${p.name} ${p.team} ${p.s26?.[k]} (#${rank(p.espn)})`)
  console.log('\nINT leaders among rows:', lead('int').join(', ')); console.log('PD leaders among rows:', lead('pd').join(', '))
}
console.log(checks.join('\n'))
fs.writeFileSync(path.join(DATA, 'out-rows.json'), JSON.stringify(out))

// ── the file ───────────────────────────────────────────────────────────────────────────────────────────────────────
const lit = v => v === null || v === undefined ? 'null' : typeof v === 'string' ? JSON.stringify(v) : typeof v === 'object' ? `{${Object.entries(v).map(([k, x]) => `${/^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${lit(x)}`).join(',')}}` : String(v)
const rowText = p => '  ' + lit(Object.fromEntries(Object.entries(p).filter(([k, v]) => !k.startsWith('_') && !(k === 's25' && v == null)))) + ','
const header = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'dbs-header.txt'), 'utf8')
  .replace('{{CHECKS}}', checks.map(c => '//   ' + c).join('\n'))
  .replace('{{TOP}}', top.slice(0, 15).map((p, i) => `//   ${String(i + 1).padStart(2)}. ${p.name} (${p.team} ${p.slot}) ${p.ovr}`).join('\n'))
  .replace('{{COUNTS}}', `${out.length} rows: ${out.filter(p => p.slot === 'CB1').length} CB1, ${out.filter(p => p.slot === 'CB2').length} CB2, ${out.filter(p => p.slot === 'S1').length} S1`)
  .replace('{{HEADSHOTS}}', String(out.filter(p => p.headshot).length))
  .replace('{{HAND}}', HAND.notes())
const body = `${header}\nexport const CFB_DB_TYPES = ${JSON.stringify(TYPES).replace(/"/g, "'").replace(/,/g, ', ')}\n\n// CB1, CB2 and S1 per team, in cfb-teams.js order\nexport const CFB_DBS = [\n${out.map(rowText).join('\n')}\n]\n`
fs.writeFileSync(path.join(ROOT, 'src/data/cfb-dbs.js'), body)
console.log('wrote src/data/cfb-dbs.js', out.length, 'rows')
