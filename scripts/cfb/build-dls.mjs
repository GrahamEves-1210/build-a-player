// College Football defensive linemen: builds src/data/cfb-dls.js (EDGE1, EDGE2, DT1 for every FBS team).
//
//   node scripts/cfb/build-dls.mjs                 grade and write src/data/cfb-dls.js
//   node scripts/cfb/build-dls.mjs --report        also print the selection, the formula top 60 and the checks
//
// Inputs (DL_DATA, default the session scratch folder .../cfbdef):
//   games-2026.json / games-2025.json / games-2024.json  every completed FBS game's defensive box score (ESPN summary)
//   dl/agg.json            the box scores rolled up per player and season, with game logs (dl/src/aggregate.mjs)
//   dl/raw/rosters.json    ESPN rosters for the 138 teams (dl/src/fetch-feeds.mjs rosters)
//   dl/raw/season-<yr>.json ESPN's byathlete defense feed 2022-2026 (games played, forced fumbles; dl/src/fetch-feeds.mjs seasons)
//   dl/picks.json          slot decisions made by hand after the box-score / injury check (who plays which slot)
//   dl/hand.json           hand grades from the scouting check (trait -> grade), each with its reason
//   dl/skin.json           skin tone sampled from each man's ESPN headshot (dl/src/skin.mjs)
// The grading recipe is written out in the data file's header (HEADER below), kept next to the code that does it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DATA = process.env.DL_DATA || '/tmp/claude-0/-home-user-build-a-player/4066ce4a-5b5d-58f9-9095-5442ae7c3c08/scratchpad/cfbdef'
const REPORT = process.argv.includes('--report')
const rd = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const rdOpt = (f, d) => (fs.existsSync(path.join(DATA, f)) ? rd(f) : d)

const { CFB_TEAMS } = await import(pathToFileURL(path.join(ROOT, 'src/data/cfb-teams.js')).href)
const { dlSizeGrade } = await import(pathToFileURL(path.join(ROOT, 'src/data/dls.js')).href).catch(() => ({}))
const AGG = rd('dl/agg.json')
const ROSTERS = rd('dl/raw/rosters.json')
const FEED = Object.fromEntries([2022, 2023, 2024, 2025, 2026].map(y => [y, Object.fromEntries(rd(`dl/raw/season-${y}.json`).map(r => [r.id, r]))]))
const PICKS = rdOpt('dl/picks.json', {})
const HAND = rdOpt('dl/hand.json', {})
const SKIN = rdOpt('dl/skin.json', {})
const HS = fs.existsSync(path.join(ROOT, 'src/data/cfb-headshots.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/cfb-headshots.json'), 'utf8')).headshots : {}

export const DL_TYPES = ['getOff', 'speed', 'size', 'powerMoves', 'finesseMoves', 'strength', 'playRecognition', 'bend', 'blockShed']
const P4 = new Set(['sec', 'bigten', 'big12', 'acc'])
const isP4 = t => P4.has(t.conf) || t.short === 'NDAM'
const TEAM = Object.fromEntries(CFB_TEAMS.map(t => [t.espn, t]))
const W_YR = { 2026: 1.0, 2025: 0.6, 2024: 0.35 }
const FCS_OFF = 12

// ── size (dls.js's own formula; copied here in case the import is unavailable) ──
const SIZE = dlSizeGrade ?? ((h, w, spot) => {
  const S = { edge: { lb: [233, 280], in: [73, 78] }, dt: { lb: [257, 345], in: [72, 78] } }[spot === 'dt' ? 'dt' : 'edge']
  const g = (v, [lo, hi]) => Math.max(0, Math.min(11, (v - lo) / (hi - lo) * 11))
  return Math.round(g(w, S.lb) * 0.85 + g(h, S.in) * 0.15)
})
// ── OVR: utils/simulation.js calcOVRDL (DL_ATTR_WEIGHT), then utils/cfbOvr.js collegeOVR ──
const DL_W = { getOff: 0.16, bend: 0.13, blockShed: 0.13, powerMoves: 0.12, finesseMoves: 0.12, strength: 0.10, playRecognition: 0.11, speed: 0.07, size: 0.06 }
const { collegeOVR } = await import(pathToFileURL(path.join(ROOT, 'src/utils/cfbOvr.js')).href)
function ovrDL(a) {
  const tw = DL_TYPES.reduce((s, t) => s + DL_W[t], 0)
  const avg = DL_TYPES.reduce((s, t) => s + a[t] * DL_W[t] / tw, 0)
  const min = Math.min(...DL_TYPES.map(t => a[t]))
  const bonus = min >= 9 ? 2 : min >= 8 ? 0.5 : 0
  return collegeOVR(Math.min(99, Math.max(0, Math.round(60 + 2.1 * avg + 0.21 * avg * avg + bonus))))
}

// ── 1. every defensive lineman on an FBS roster (+ the LB-listed edge rushers) ──
const DL_POS = new Set(['DE', 'DT', 'NT', 'DL', 'EDGE'])
const num = v => (typeof v === 'number' && isFinite(v) ? v : 0)
function seasonLine(id, yr) {
  const b = AGG.players[id]?.seasons?.[yr]
  const f = FEED[yr]?.[id]
  const box = b ?? { g: 0, tk: 0, solo: 0, sck: 0, tfl: 0, pd: 0, qbh: 0, int: 0, intYds: 0, intTd: 0, fr: 0, td: 0, log: [] }
  // games: ESPN's games played when the feed agrees with the box scores (same man, same level), else box-score games
  const fgp = num(f?.['general.gamesPlayed']), ftk = num(f?.['defensive.totalTackles'])
  const g = f && ftk <= box.tk * 1.15 + 2 ? Math.max(box.g, fgp) : box.g
  return { ...box, g, ff: num(f?.['general.fumblesForced']), team: box.team ?? f?.team ?? null }
}
// PFF's team grade pages (dl/pff-roster.json, from www.pff.com/grades/ncaa/teams/<team>?pos=ed|di) say who actually lines up
// on the edge (ED) or inside (DI) and how many snaps he has played in 2026; every FBS team has one.
const PFFR = rdOpt('dl/pff-roster.json', {})
const candidates = []
for (const [teamId, list] of Object.entries(ROSTERS)) {
  const team = TEAM[teamId]
  if (!team) continue
  for (let a of list) {
    const s26 = seasonLine(a.id, 2026)
    const pf = PFFR[a.id]
    let kind = null
    if (pf && (pf.snaps ?? 0) >= 30) kind = DL_POS.has(a.pos) ? 'dl' : 'pff-' + pf.pos // PFF charts him on the line (an LB-listed edge, a hybrid)
    else if (DL_POS.has(a.pos)) kind = 'dl'
    if (PICKS.force?.[a.id]) kind = kind ?? 'forced'
    if (!kind) continue
    // spot: where PFF lines him up (most snaps); the NFL file's rule on top: 285 lb and up plays inside
    // (PFF calls the ends of an odd front 'DI' when they line up over the tackle; under 265 lb he is an edge here)
    let spot = pf ? (pf.pos === 'di' && (a.w ?? 0) >= 265 ? 'dt' : 'edge') : (a.pos === 'DT' || a.pos === 'NT' ? 'dt' : 'edge')
    if ((a.w ?? 0) >= 285) spot = 'dt'
    spot = PICKS.spot?.[a.id] ?? spot
    // ESPN missing a height or weight: the spot's typical frame, flagged (bioGuess)
    const bioGuess = !a.w || !a.h
    if (bioGuess) a = { ...a, w: a.w || (spot === 'dt' ? 295 : 255), h: a.h || 75 }
    candidates.push({ id: a.id, a, team, kind, spot, bioGuess, pfr: pf ?? null, pffSnaps: pf ? pf.both.reduce((t, b) => t + (b[1] ?? 0), 0) : 0 })
  }
}

// ── 2. per-man stats, three seasons weighted 1.0 / 0.6 / 0.35 ──
for (const c of candidates) {
  c.lines = { 2026: seasonLine(c.id, 2026), 2025: seasonLine(c.id, 2025), 2024: seasonLine(c.id, 2024) }
  const W = {}, keys = ['g', 'tk', 'solo', 'sck', 'tfl', 'pd', 'qbh', 'ff', 'fr', 'int']
  for (const k of keys) W[k] = Object.entries(c.lines).reduce((s, [y, l]) => s + W_YR[y] * num(l[k]), 0)
  // 2026 counts go in per snap, not per game: PFF's 2026 snap count / 40 (a starter's median snaps a game) stands in for
  // his 2026 games. A 55-snap-a-game end piles up tackles and TFL a 40-snap rusher can't; per game, volume read as quality.
  // (2024-25 have no snap counts and stay per game.)
  c.g26eq = c.pffSnaps >= 40 ? c.pffSnaps / 40 : c.lines[2026].g
  W.g += W_YR[2026] * (c.g26eq - c.lines[2026].g)
  c.W = W
  c.careerG = [2022, 2023, 2024, 2025, 2026].reduce((s, y) => s + (y >= 2024 ? c.lines[y].g : num(FEED[y]?.[c.id]?.['general.gamesPlayed'])), 0)
  // schedule: average FPI offensive efficiency of the 2026 opponents he played (FCS = 12); no 2026 games = his team's slate
  const sched = AGG.teams[c.team.espn]?.[2026] ?? []
  const played = c.lines[2026].log.filter(l => l[6] === c.team.espn).map(l => sched[l[0]]).filter(Boolean)
  const opp = (played.length ? played : sched).map(g => TEAM[g.opp]?.offEff ?? FCS_OFF)
  c.oppOff = opp.length ? opp.reduce((s, v) => s + v, 0) / opp.length : 50
  // snap proxy: games played, the latest four counted 1.5x, each game 1 + 0.2 x (tackles + PD + 1.5 sacks + TFL + half his hurries, capped at 10)
  const N = sched.length
  let score = 0, last = -1, recent = 0
  for (const l of c.lines[2026].log) {
    if (l[6] !== c.team.espn) continue
    const i = l[0], w = 1 + (i >= N - 4 ? 0.5 : 0)
    const prod = l[1] + l[5] + 1.5 * l[2] + l[3] + 0.5 * l[4]
    score += w * (1 + 0.2 * Math.min(prod, 10))
    if (i >= N - 3) recent++
    last = Math.max(last, i)
  }
  c.snap = score
  c.missed = N ? N - 1 - last : 0 // team games since his last box-score line
  // ESPN's games-played count sees games where he played without a stat; games he sat = team games - games played
  const fgp = num(FEED[2026]?.[c.id]?.['general.gamesPlayed'])
  c.feedMissed = Math.max(0, N - Math.max(fgp, c.lines[2026].g))
  c.out = c.missed >= 2 && c.feedMissed >= 2 // both say he sat out the latest two games
  c.recent3 = recent
}

// ── 3. starters: the top two edges by PFF snaps, and the top interior man (his partner too when the partner's
// snaps are within 15%: two every-down tackles). Who is EDGE1 / EDGE2 and which tackle is DT1 is decided after grading
// (step 6): both edges start, so EDGE1 is the better graded; DT1 is the better of the starting tackles.
// PICKS.slots pins a team's three by hand (the box-score / injury check); PICKS.drop removes a man (season-ending injury).
const starters = []
const AUTO_OUT = []
const byTeam = {}
for (const c of candidates) (byTeam[c.team.espn] ??= []).push(c)
for (const t of CFB_TEAMS) {
  // a man with no box-score line in his team's last two games is treated as out (hurt or benched) unless the injury
  // check kept him (PICKS.keep: expected back this season); PICKS.drop removes a man outright (season-ending injury)
  const list = (byTeam[t.espn] ?? []).filter(c => !PICKS.drop?.[c.id] && (!c.out || PICKS.keep?.[c.id]))
  const pinned = PICKS.slots?.[t.short]
  {
    // who the snap counts would have started with nobody ruled out: named in the header when the box-score check benched him
    const all = (byTeam[t.espn] ?? []).filter(c => !PICKS.drop?.[c.id]).sort((a, b) => (b.pffSnaps - a.pffSnaps) || (b.snap - a.snap))
    const would = [...all.filter(c => c.spot === 'edge').slice(0, 2), ...all.filter(c => c.spot === 'dt').slice(0, 1)]
    for (const c of would) if (c.out && !PICKS.keep?.[c.id]) AUTO_OUT.push(`${c.a.name} (${t.short}, ${c.pffSnaps} snaps): no box-score line in the last ${c.missed} games and ${c.feedMissed} games missed on ESPN's games-played count${PICKS.outNote?.[c.id] ? '; ' + PICKS.outNote[c.id] : ''}`)
  }
  const byId = id => list.find(c => c.id === id) ?? candidates.find(c => c.id === id)
  // ranked by PFF's 2026 snap count (the box-score proxy breaks ties and covers a man PFF hasn't charted)
  const top = spot => list.filter(c => c.spot === spot).sort((a, b) => (b.pffSnaps - a.pffSnaps) || (b.snap - a.snap))
  let edges, dts
  if (pinned?.EDGE1 || pinned?.EDGE2) edges = [pinned.EDGE1, pinned.EDGE2].filter(Boolean).map(byId)
  else edges = []
  if (edges.length < 2) for (const c of top('edge')) if (edges.length < 2 && !edges.includes(c)) edges.push(c)
  // a three-down front with one charted edge (Army, Ole Miss's Rebel end): the lightest regular inside man under 285 lb
  // who plays the end spot takes the second edge
  if (edges.length < 2) for (const c of top('dt').filter(c => (c.a.w ?? 999) < 285)) if (edges.length < 2 && !edges.includes(c)) edges.push(c)
  if (pinned?.DT1) dts = [byId(pinned.DT1)]
  else { const d = top('dt').filter(c => !edges.includes(c)); dts = d.slice(0, 1); if (d[1] && d[1].pffSnaps >= 0.85 * d[0].pffSnaps) dts.push(d[1]) }
  edges.forEach((c, i) => { c.spot = 'edge'; starters.push({ c, slot: i === 0 ? 'EDGE1' : 'EDGE2', team: t.short, pinned: !!pinned?.EDGE1 }) })
  dts.forEach(c => { c.spot = 'dt'; starters.push({ c, slot: 'DT1', team: t.short, pinned: !!pinned?.DT1 }) })
}
const SLOT_OF = new Map(starters.map(s => [s.c.id, s.slot]))
const slotted = starters

// ── 4. z-scores against every qualified DL (4+ weighted games), rates shrunk toward a prior by slot ──
const pool = candidates.filter(c => c.W.g >= 4)
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }
const RATE = ['sck', 'qbh', 'tfl', 'tk', 'pd', 'ff', 'fr']
const priorRate = {}
for (const spot of ['edge', 'dt']) {
  const ps = pool.filter(c => c.spot === spot && c.W.g >= 8)
  priorRate[spot] = Object.fromEntries(RATE.map(k => [k, med(ps.map(c => c.W[k] / c.W.g))]))
}
const SNAPS_PER_GAME = 40
const SLOT_PRIOR = { EDGE1: 1.0, EDGE2: 0.85, DT1: 1.0, none: 0.7 }
const K = 5 // weighted games of prior
for (const c of candidates) {
  const f = SLOT_PRIOR[SLOT_OF.get(c.id) ?? 'none']
  c.rate = Object.fromEntries(RATE.map(k => [k, (c.W[k] + K * f * priorRate[c.spot][k]) / (c.W.g + K)]))
  c.rate.press = c.rate.sck + c.rate.qbh
  c.rate.solo = (c.W.solo + 3 * 0.45) / (c.W.tk + 3)
  c.rate.takeaway = c.rate.ff + c.rate.fr
}
const zOf = (vals) => { const m = vals.reduce((s, v) => s + v, 0) / vals.length; const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length) || 1; return v => (v - m) / sd }
// production z-scores are taken at his spot (edges against the 1,000-odd qualified edges, tackles against tackles): a
// tackle's sack rate is half an edge's, so pooled, every DT would read as a poor rusher. The gap between the spots is
// put back by the spot's base grades below (the NFL file's edge / DT shape). Count rates go in as square roots (sacks a
// game are skewed: one 16-sack season would otherwise stretch the scale for everyone else).
const ZK = ['sck', 'qbh', 'tfl', 'tk', 'pd', 'press', 'solo', 'takeaway']
const SQRT = new Set(['sck', 'qbh', 'tfl', 'pd', 'press', 'takeaway'])
const tf = (k, v) => (SQRT.has(k) ? Math.sqrt(Math.max(0, v)) : v)
const zopp = zOf(pool.map(c => c.oppOff))
const Z = {}
for (const spot of ['edge', 'dt']) {
  const ps = pool.filter(c => c.spot === spot)
  Z[spot] = Object.fromEntries(ZK.map(k => [k, zOf(ps.map(c => tf(k, c.rate[k])))]))
  Z[spot].w = zOf(ps.map(c => c.a.w)); Z[spot].h = zOf(ps.map(c => c.a.h)); Z[spot].car = zOf(ps.map(c => Math.sqrt(c.careerG)))
}
for (const c of candidates) {
  const Zs = Z[c.spot]
  const z = Object.fromEntries(ZK.map(k => [k, Zs[k](tf(k, c.rate[k]))]))
  z.w = Zs.w(c.a.w); z.h = Zs.h(c.a.h); z.car = Zs.car(Math.sqrt(c.careerG))
  c.z = z
  const edge = c.spot === 'edge'
  c.ev = {
    getOff: 0.4 * z.sck + 0.3 * z.qbh + 0.3 * z.tfl,
    bend: 0.7 * z.press + 0.3 * z.sck,
    finesseMoves: edge ? 0.45 * z.sck + 0.35 * z.qbh - 0.2 * z.w : 0.45 * z.sck + 0.35 * z.qbh - 0.2 * z.w,
    powerMoves: 0.4 * z.sck + 0.3 * z.tfl + 0.3 * z.w,
    strength: edge ? 0.55 * z.w + 0.3 * z.tfl + 0.15 * z.tk : 0.5 * z.w + 0.25 * z.tfl + 0.25 * z.tk,
    blockShed: 0.45 * z.tk + 0.35 * z.tfl + 0.2 * z.solo,
    playRecognition: 0.3 * z.tfl + 0.2 * z.pd + 0.2 * z.takeaway + 0.3 * z.car,
    speed: -0.75 * z.w + 0.25 * z.sck,
  }
}
const TR = Object.keys(pool[0].ev)
const zt = { edge: {}, dt: {} }
for (const spot of ['edge', 'dt']) for (const t of TR) zt[spot][t] = zOf(pool.filter(c => c.spot === spot).map(c => c.ev[t]))
// HIS LEVEL (the tight-end file's step 4): how good he is, from what he produces at his spot: 0.35 sacks, 0.25 hurries,
// 0.25 TFL, 0.15 tackles a game (shrunk rates, z at his spot), re-standardized, + 0.25 x the schedule z.
// A trait = 0.62 x level + 0.5 x (that trait's evidence minus the average of his eight evidence scores): the level
// decides how good he is, the evidence what he is good at (graded trait by trait, every trait of a productive rusher
// came out the same, because sacks feed all of them).
const SCHED = 0.25
const lv = { edge: null, dt: null }
for (const c of candidates) c.lvRaw = 0.35 * c.z.sck + 0.25 * c.z.qbh + 0.25 * c.z.tfl + 0.15 * c.z.tk
for (const spot of ['edge', 'dt']) lv[spot] = zOf(pool.filter(c => c.spot === spot).map(c => c.lvRaw))
// + 0.2 for a Power 4 team (Notre Dame included), - 0.2 otherwise (the tight-end file's step: a MAC line is not an SEC line,
// and the schedule z alone moved it too little)
const LEAGUE = 0.15
for (const c of candidates) { c.Lcore = lv[c.spot](c.lvRaw); c.Ladj = SCHED * zopp(c.oppOff) + (isP4(c.team) ? LEAGUE : -LEAGUE); c.L = c.Lcore + c.Ladj }

// ── 4b. PFF check: PFF's 2026 season grades from its public player pages (www.pff.com/ncaa/players/..., dl/pff-profiles.json:
// pass-rush grade, run-defense grade, pressures, snaps) and team grade pages (overall grade and snaps for every lineman).
// Box scores can't see pass-rush wins that don't end in a sack, double teams or run fits; PFF grades every snap.
// For each man PFF graded: his pass-rush grade and run-defense grade become z-scores among the graded men at his spot
// (no profile: his overall grade stands in for both), mapped onto the box-score level of the same men (mean and spread),
// then blended: pass level = box + w x (PFF pass - box), run level likewise, w = 0.55 x min(1, snaps / 350) at edge,
// 0.7 x at tackle (a tackle's box score sees the least of his work)
// (a 100-snap backup's PFF grade moves him less). The schedule and Power 4 terms are added after, since PFF grades
// are not adjusted for the opponent. Pass traits (get-off, bend, finesse, power) ride the pass level; run traits
// (strength, block shed, recognition) the run level; speed keeps the box-score level.
const PROF = rdOpt('dl/pff-profiles.json', {})
const avg = a => a.reduce((s, v) => s + v, 0) / a.length
const pffOf = c => {
  const p = PROF[c.id], r = c.pfr
  if (p && p.prush != null && p.rdef != null) return { pass: p.prush, run: p.rdef, snaps: p.snaps ?? r?.snaps ?? 0, passSnaps: p.passSnaps, runSnaps: p.runSnaps, src: 'profile' }
  if (r && r.grade != null) return { pass: r.grade, run: r.grade, snaps: r.snaps ?? 0, src: 'team page' }
  return null
}
for (const spot of ['edge', 'dt']) {
  const ms = candidates.filter(c => c.spot === spot && pffOf(c) && (pffOf(c).snaps ?? 0) >= 100)
  const Ls = ms.map(c => c.Lcore), mL = avg(Ls), sL = Math.sqrt(avg(Ls.map(v => (v - mL) ** 2)))
  const zp = zOf(ms.map(c => pffOf(c).pass)), zr = zOf(ms.map(c => pffOf(c).run))
  for (const c of candidates.filter(c => c.spot === spot)) {
    const f = pffOf(c)
    if (!f || f.snaps < 40) continue
    // each grade weighted by its own sample: a pass-rush grade by pass-rush snaps (full weight at 220, a starter's
    // median), a run-defense grade by run snaps (full at 200); a 115-run-snap grade moves him about half as far
    const cap = spot === 'dt' ? 0.7 : 0.55
    const wPass = cap * Math.min(1, f.passSnaps != null ? f.passSnaps / 220 : f.snaps / 350)
    const wRun = cap * Math.min(1, f.runSnaps != null ? f.runSnaps / 200 : f.snaps / 350)
    c.pffUse = { ...f, wPass, wRun, passL: mL + sL * zp(f.pass), runL: mL + sL * zr(f.run) }
    c.Lpass = c.Lcore + wPass * (c.pffUse.passL - c.Lcore) + c.Ladj
    c.Lrun = c.Lcore + wRun * (c.pffUse.runL - c.Lcore) + c.Ladj
  }
}
const pffMatched = new Map(candidates.filter(c => c.pffUse).map(c => [c.id, c.pffUse]))
const PASS_T = new Set(['getOff', 'bend', 'finesseMoves', 'powerMoves']), RUN_T = new Set(['strength', 'blockShed', 'playRecognition'])
for (const c of candidates) {
  const raw = Object.fromEntries(TR.map(t => [t, zt[c.spot][t](c.ev[t])]))
  const mean = TR.reduce((s, t) => s + raw[t], 0) / TR.length
  c.zt = {}
  for (const t of TR) {
    const lev = PASS_T.has(t) ? (c.Lpass ?? c.L) : RUN_T.has(t) ? (c.Lrun ?? c.L) : c.L
    let v = 0.62 * lev + 0.5 * (raw[t] - mean)
    // bend off the edge is what the box score shows; inside, a tackle's bend is mostly his prior
    if (t === 'bend' && c.spot === 'dt') v *= 0.45
    c.zt[t] = v
  }
}
// ── 5. the curve: cfb-players.js's (slope 2.0, eased below average, a lift at the top), from the spot's base ──
// base = the grade of the average qualified lineman at his spot (backups included); the edge / DT gap is the NFL file's
// (dls.js averages: edges getOff 7.8 speed 7.9 bend 7.2 finesse 7.4; tackles 5.4 / 4.2 / 3.6 / 4.5, power and strength higher inside)
const BASES = {
  edge: { getOff: 5.7, speed: 6.2, powerMoves: 5.1, finesseMoves: 5.5, strength: 5.3, playRecognition: 5.0, bend: 5.5, blockShed: 4.9 },
  dt: { getOff: 4.1, speed: 3.3, powerMoves: 5.8, finesseMoves: 3.4, strength: 6.5, playRecognition: 5.2, bend: 2.7, blockShed: 5.4 },
}
const SLOPE = 2.0
const curve = (z, base) => Math.max(0, Math.min(11, Math.round(base + 1.05 * SLOPE * z * (z < 0 ? 0.85 : 1) + 0.35 * Math.max(0, z - 1) ** 2)))
const capS = (g, z) => (g >= 11 && z < 2.7 ? 10 : g)

// ── 6. rows ──
const yearOf = c => {
  const cls = c.a.cls ?? 'FR'
  const years = { FR: 1, SO: 2, JR: 3, SR: 4 }[cls] ?? 1
  const gp = y => (y >= 2024 ? c.lines[y].g : num(FEED[y]?.[c.id]?.['general.gamesPlayed']))
  const seen = [2022, 2023, 2024, 2025, 2026].filter(y => gp(y) > 0)
  const first = seen[0] ?? 2026
  const enrolled = 2026 - years + 1
  let rs = 2026 - first + 1 > years
  for (let y = Math.max(enrolled, 2022); y <= 2025 && !rs; y++) if (gp(y) > 0 && gp(y) <= 4) rs = true
  return (rs ? 'RS-' : '') + cls
}
const SUFFIX = /\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i
const lastName = n => n.replace(SUFFIX, '').split(' ').slice(1).join(' ') || n
const out = []
for (const s of starters) {
  const c = s.c
  const g = {}
  for (const t of TR) g[t] = capS(curve(c.zt[t], BASES[c.spot][t]), c.zt[t])
  g.size = SIZE(c.a.h, c.a.w, c.spot)
  const formula = { ...g }
  const hand = HAND[c.id]
  if (hand) for (const [t, v] of Object.entries(hand.attrs ?? {})) g[t] = v
  const line = l => ({ g: l.g, tk: l.tk, solo: l.solo, sck: l.sck, tfl: l.tfl, pd: l.pd, qbh: l.qbh, int: l.int, intYds: l.intYds, intTd: l.intTd, ff: l.ff, fr: l.fr, td: l.td })
  const attrs = Object.fromEntries(DL_TYPES.map(t => [t, g[t]]))
  out.push({
    row: {
      name: c.a.name, short: null, team: c.team.short, teamName: c.team.name, conf: c.team.conf, color: c.team.color, color2: c.team.color2,
      skin: HS[c.id] ? (SKIN[c.id] ?? null) : null, starter: true, depth: s.slot === 'EDGE2' ? 2 : 1, slot: s.slot, subpos: c.spot, pos: 'dl',
      espnPos: c.a.pos, number: c.a.jersey != null ? Number(c.a.jersey) : null, year: yearOf(c), height: c.a.h, weight: c.a.w, espn: c.id,
      headshot: HS[c.id] ?? null, ovr: ovrDL(attrs), attrs, s26: line(c.lines[2026]), s25: line(c.lines[2025]),
    },
    c, formula, formulaOvr: ovrDL(formula), pinned: s.pinned,
  })
}
// EDGE1 / EDGE2 by grade (OVR, then the snap proxy), unless pinned; DT1 = the better starting tackle
{
  const keep = []
  for (const t of CFB_TEAMS) {
    const mine = out.filter(o => o.row.team === t.short)
    const rank = (a, b) => b.row.ovr - a.row.ovr || b.c.snap - a.c.snap
    const e = mine.filter(o => o.row.slot !== 'DT1')
    if (!e.some(o => o.pinned)) e.sort(rank)
    e.forEach((o, i) => { o.row.slot = i === 0 ? 'EDGE1' : 'EDGE2'; o.row.depth = i + 1 })
    const d = mine.filter(o => o.row.slot === 'DT1').sort(rank).slice(0, 1)
    keep.push(...e.slice(0, 2), ...d)
  }
  out.length = 0
  out.push(...keep)
}
// short names: last name; "F. Last" when two linemen on one team share it
for (const o of out) {
  const ln = lastName(o.row.name)
  const dup = out.filter(x => x.row.team === o.row.team && lastName(x.row.name) === ln).length > 1
  o.row.short = dup ? `${o.row.name[0]}. ${ln}` : ln
}

// ── 7. checks ──
const avgTrait = rows => rows.length ? rows.reduce((s, r) => s + DL_TYPES.reduce((a, t) => a + r.attrs[t], 0) / 9, 0) / rows.length : 0
const TEAMS_BY_SHORT = Object.fromEntries(CFB_TEAMS.map(t => [t.short, t]))
const grp = (p4, slot) => out.map(o => o.row).filter(r => isP4(TEAMS_BY_SHORT[r.team]) === p4 && r.slot === slot)
const dist = {}
for (const p4 of [true, false]) for (const slot of ['EDGE1', 'EDGE2', 'DT1']) dist[`${p4 ? 'P4' : 'G6'} ${slot}`] = { n: grp(p4, slot).length, avg: avgTrait(grp(p4, slot)), ovr: med(grp(p4, slot).map(r => r.ovr)) }
const traitAvg = {}
for (const p4 of [true, false]) for (const sp of ['edge', 'dt']) { const rs = out.map(o => o.row).filter(r => isP4(TEAMS_BY_SHORT[r.team]) === p4 && r.subpos === sp); traitAvg[`${p4 ? 'P4' : 'G6'} ${sp}`] = Object.fromEntries(DL_TYPES.map(t => [t, +(rs.reduce((s, r) => s + r.attrs[t], 0) / rs.length).toFixed(1)])) }
const ranked = [...out].sort((a, b) => b.row.ovr - a.row.ovr || b.c.zt.getOff - a.c.zt.getOff)
const ovrs = out.map(o => o.row.ovr).sort((a, b) => a - b)
const pct = p => ovrs[Math.floor(p * (ovrs.length - 1))]

if (REPORT) {
  console.log('candidates', candidates.length, 'pool', pool.length, 'rows', out.length)
  console.log('prior rates', JSON.stringify(priorRate))
  for (const [k, v] of Object.entries(dist)) console.log(k.padEnd(10), v.n, v.avg.toFixed(2), 'median ovr', v.ovr)
  console.log('trait averages', JSON.stringify(traitAvg))
  console.log('ovr p10/median/p90/max', pct(0.1), pct(0.5), pct(0.9), ovrs.at(-1))
  const fmt = o => `${String(o.row.ovr).padStart(3)} ${(o.formulaOvr !== o.row.ovr ? '(' + o.formulaOvr + ')' : '').padEnd(5)} ${o.row.slot.padEnd(5)} ${o.row.team.padEnd(5)} ${o.row.name.padEnd(24)} ${o.row.espnPos.padEnd(4)} ${o.row.height}/${o.row.weight} ${DL_TYPES.map(t => o.row.attrs[t]).join(' ')}  26: ${o.row.s26.g}g ${o.row.s26.tk}tk ${o.row.s26.sck}sk ${o.row.s26.tfl}tfl ${o.row.s26.qbh}qh ff${o.row.s26.ff} | 25: ${o.row.s25.g}g ${o.row.s25.sck}sk ${o.row.s25.tfl}tfl  opp ${o.c.oppOff.toFixed(0)}`
  console.log('pff matched', [...pffMatched.keys()].length, 'of P4 starters', out.filter(o => isP4(TEAMS_BY_SHORT[o.row.team]) && o.c.pffUse).length, '/', out.filter(o => isP4(TEAMS_BY_SHORT[o.row.team])).length)
  console.log('── top 60 ──'); for (const o of ranked.slice(0, 60)) console.log(fmt(o))
  if (process.argv.includes('--all')) { console.log('── all ──'); for (const o of out) console.log(fmt(o)) }
}

// ── 8. write ──
// a header note wrapped at 118 columns, continuation lines indented
const wrap = (t, first = '//   ', rest = '//     ') => { const out = []; let line = first; for (const w of t.split(' ')) { if ((line + w).length > 118 && line.trim() !== '//') { out.push(line.trimEnd()); line = rest } line += w + ' ' } out.push(line.trimEnd()); return out.join('\n') }
const HEADER = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'build-dls.header.txt'), 'utf8')
  .replace('{{DIST}}', Object.entries(dist).map(([k, v]) => `//     ${k.padEnd(9)} ${String(v.n).padStart(3)} rows · average trait ${v.avg.toFixed(1)} · median OVR ${v.ovr}`).join('\n'))
  .replace('{{TRAITS}}', Object.entries(traitAvg).map(([k, v]) => `//     ${k.padEnd(8)} ${DL_TYPES.map(t => `${t} ${v[t]}`).join(' · ')}`).join('\n'))
  .replace('{{OVR}}', `p10 ${pct(0.1)} · median ${pct(0.5)} · p90 ${pct(0.9)} · max ${ovrs.at(-1)}`)
  .replace('{{TOP}}', ranked.slice(0, 15).map((o, i) => `//     ${String(i + 1).padStart(2)}. ${o.row.ovr} ${o.row.name} (${o.row.team}, ${o.row.slot}): ${o.row.s26.sck} sacks, ${o.row.s26.tfl} TFL, ${o.row.s26.qbh} hurries in ${o.row.s26.g} games`).join('\n'))
  .replace('{{HAND}}', Object.entries(HAND).filter(([id]) => out.some(o => o.row.espn === id)).map(([id, h]) => { const o = out.find(x => x.row.espn === id); const ch = Object.entries(h.attrs ?? {}).filter(([t, v]) => o.formula[t] !== v).map(([t, v]) => `${t} ${o.formula[t]}->${v}`).join(', '); return wrap(`${o.row.name} (${o.row.team} ${o.row.slot}): ${ch || 'formula kept'}. ${h.why.replace(/^formula kept: /, '')}`) }).join('\n'))
  .replace('{{PICKS}}', [...Object.values(PICKS.drop ?? {}).map(n => `dropped: ${n}`), ...Object.values(PICKS.keep ?? {}).map(n => `kept: ${n}`), ...Object.entries(PICKS.slots ?? {}).map(([t, v]) => `${t}: ${v.why ?? ''}`), ...(PICKS.notes ?? []), ...AUTO_OUT.map(n => `out (box-score check): ${n}`)].map(n => wrap(n)).join('\n'))
  .replace('{{COUNT}}', String(out.length))
const ser = v => (v === null || v === undefined ? 'null' : typeof v === 'boolean' ? String(v) : typeof v === 'string' ? JSON.stringify(v) : typeof v === 'number' ? String(v) : Array.isArray(v) ? `[${v.map(ser).join(',')}]` : `{${Object.entries(v).map(([k, x]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${ser(x)}`).join(',')}}`)
const teamOrder = Object.fromEntries(CFB_TEAMS.map((t, i) => [t.short, i]))
const SLOT_ORDER = { EDGE1: 0, EDGE2: 1, DT1: 2 }
const rows = out.map(o => o.row).sort((a, b) => teamOrder[a.team] - teamOrder[b.team] || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot])
const js = `${HEADER.trimEnd()}

export const CFB_DL_TYPES = ${JSON.stringify(DL_TYPES).replace(/"/g, "'").replace(/,/g, ', ')}

// EDGE1, EDGE2 and DT1 for every FBS team, in cfb-teams.js order
export const CFB_DLS = [
${rows.map(r => '  ' + ser(r).replace(/: /g, ': ').replace(/,(?=[A-Za-z_"'])/g, ',')).join(',\n')},
]
`
fs.writeFileSync(path.join(ROOT, 'src/data/cfb-dls.js'), js)
fs.writeFileSync(path.join(DATA, 'dl/graded.json'), JSON.stringify(out.map(o => ({ ...o.row, formula: o.formula, formulaOvr: o.formulaOvr, zt: o.c.zt, L: o.c.L, Lpass: o.c.Lpass, Lrun: o.c.Lrun, pff: o.c.pffUse ?? null, pfr: o.c.pfr ?? null, prof: PROF[o.c.id] ?? null, oppOff: o.c.oppOff, snap: o.c.snap, missed: o.c.missed, kind: o.c.kind, careerG: o.c.careerG })), null, 0))
fs.writeFileSync(path.join(DATA, 'dl/candidates.json'), JSON.stringify(candidates.map(c => ({ id: c.id, name: c.a.name, team: c.team.short, pos: c.a.pos, h: c.a.h, w: c.a.w, kind: c.kind, spot: c.spot, snap: +c.snap.toFixed(1), missed: c.missed, recent3: c.recent3, slot: SLOT_OF.get(c.id) ?? null, s26: { g: c.lines[2026].g, tk: c.lines[2026].tk, sck: c.lines[2026].sck, tfl: c.lines[2026].tfl, qbh: c.lines[2026].qbh }, s25: { g: c.lines[2025].g, sck: c.lines[2025].sck, tfl: c.lines[2025].tfl, team: c.lines[2025].team } }))))
console.log(`wrote src/data/cfb-dls.js: ${rows.length} rows`)
