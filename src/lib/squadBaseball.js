// SQUAD BUILDER, baseball's half: the club a baseball squad plays as, and its season. Its own module so
// football, basketball and soccer's Squad Builder never download the rosters or the engine: lib/squadSeason.js
// loads it (loadSquadBaseball) before a baseball squad shows (BaseballApp does that when it opens Squad Builder),
// and its baseball branches call in here.
//
// The club (lib/squad.js BASEBALL_SPOTS): the nine in the lineup (C to DH), the five-man rotation and the closer.
// The builds take the spots they were picked for; the club's real players fill the rest, each at his own position
// first. A regular a build pushes off his spot moves to the nearest one that's open (a shortstop to second, a
// catcher to DH), or to the bench when nothing is. A starter pushed out of the rotation goes to the bullpen. A spot
// the data can't fill is the club's platoon (a lineup spot), a spot starter (the rotation) or the committee (the
// closer): the club's generic level, the way the engine plays it.
//
// The season, one club, one schedule (utils/baseballSimulation.js):
//   1. Strength: each build against the man it really replaces (the one who leaves the lineup or the staff, or the
//      club's generic level at an open spot), baseballBuildLift's off/def moves added up.
//   2. scriptBaseballSeason plays all 162 games once from that strength: every score, the standings, the October
//      bracket and the award field (the club's own players are left out of the field: they're all here).
//   3. Every man in the lineup and on the staff, builds and real players, plays his line inside those scores
//      (runBaseballSimulation with the script). The hitters go one after another, the builds first: the runs and
//      RBI a man takes are passed on (team.spent), so the lineup's R and RBI never pass the club's runs in any game.
//      The starters take different days (team.slot); the closer's runs are held inside what the starter left.
//   4. The awards: one winner of each across the club (the best case keeps it), the field's when nobody here won;
//      the World Series and LCS MVPs from the series lines.
// A result keeps the scores, the totals and a snapshot of every man (his ratings), so any game's box score plays
// back the same (baseballBox), in idle time.

import { spotsOf, BASEBALL_SPOTS } from './squad'
import { seeded } from './rng'
import { HEADSHOT_BASE } from '../utils/simulation'
import {
  runBaseballSimulation, scriptBaseballSeason, baseballBuildLift, baseballTeam10, calcBaseballOVR, getBaseballArchetype, rebookBaseball, baseballTotals,
  BAT_TRAITS, PIT_TRAITS,
} from '../utils/baseballSimulation'
import { MLB_TEAMS } from '../data/mlb-teams'
import { MLB_BATTERS } from '../data/mlb-batters'
import { MLB_PITCHERS } from '../data/mlb-pitchers'
import { MLB_LEGEND_BATTERS } from '../data/mlb-legend-batters'
import { MLB_LEGEND_PITCHERS } from '../data/mlb-legend-pitchers'
import MLB_HEADSHOTS from '../data/mlb-headshots.json'

export { MLB_TEAMS }
export const KEYS = { bat: BAT_TRAITS, pit: PIT_TRAITS }
const PLAYERS = { current: { bat: MLB_BATTERS, pit: MLB_PITCHERS }, alltime: { bat: MLB_LEGEND_BATTERS, pit: MLB_LEGEND_PITCHERS } }
const poolOf = sq => (sq?.pool === 'alltime' ? 'alltime' : 'current')
const r1 = v => Math.round((v ?? 0) * 10) / 10
const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const asBuild = (vals, keys) => Object.fromEntries(keys.map((k, i) => [k, { val: Array.isArray(vals) ? vals[i] ?? 5 : vals?.[k] ?? 5 }]))
export const BAT_SPOTS = BASEBALL_SPOTS.map((sp, i) => (sp.pos === 'bat' ? i : -1)).filter(i => i >= 0)
export const PIT_SPOTS = BASEBALL_SPOTS.map((sp, i) => (sp.pos === 'pit' ? i : -1)).filter(i => i >= 0)
const ROT_SPOTS = PIT_SPOTS.filter(i => BASEBALL_SPOTS[i].role === 'SP')
const CL_SPOT = PIT_SPOTS.find(i => BASEBALL_SPOTS[i].role === 'CL')
const spotOfLabel = l => BASEBALL_SPOTS.findIndex(sp => sp.label === l)

// ── OVR, names and faces ─────────────────────────────────────────────────────
// (role: a pitcher's job: 'SP' or 'CL' weighs his traits the way the job does; none, his stamina decides)
export const ovrOf = (pos, build, role) => Math.round(calcBaseballOVR(build || {}, KEYS[pos === 'pit' ? 'pit' : 'bat'], role ?? (pos === 'pit' ? 'pit' : 'bat')) || 0)
export function nameOf(pos, build) {
  try { const p = pos === 'pit' ? 'pit' : 'bat'; return getBaseballArchetype(ovrOf(p, build), build, KEYS[p], p) } catch { return null }
}
const hsFile = p => { const f = p?.espn != null ? MLB_HEADSHOTS[String(p.espn)] : null; return f ? `${HEADSHOT_BASE}/${String(f).replace(/\.(webp|png|jpe?g)$/i, '')}.webp` : null }
// every player in the data by name (a build's age is its chips' players', the way the engine reads it)
const BY_NAME = new Map()
for (const pool of ['current', 'alltime']) for (const pos of ['bat', 'pit']) for (const p of PLAYERS[pool][pos]) if (!BY_NAME.has(p.name)) BY_NAME.set(p.name, p)
// a man in a snapshot (k r:Name) or a real player: his ESPN headshot; a build's face is its own (faces)
export const photoOf = p => (p?.s || p?.k?.startsWith('b:') ? null : hsFile(BY_NAME.get(p?.n ?? p?.name)))
const buildAge = build => {
  const ages = Object.values(build || {}).filter(Boolean).map(c => c.age ?? BY_NAME.get(c.qbFull ?? c.name)?.age).filter(a => typeof a === 'number')
  return ages.length ? Math.round(avg(ages)) : null
}
export const teamRow = short => MLB_TEAMS.find(t => t.short === short) ?? null

// ── The club in the data ─────────────────────────────────────────────────────
const clubCache = new Map()
function clubOf(pool, short) {
  const key = `${pool}|${short}`
  if (!clubCache.has(key)) {
    const seen = new Set()
    const one = (p, pos) => {
      const k = `${pos}:${p.name}`
      if (seen.has(k)) return null
      seen.add(k)
      const role = pos === 'bat' ? (BASEBALL_SPOTS.some(sp => sp.pos === 'bat' && sp.label === p.role) ? p.role : 'DH') : (p.role === 'SP' ? 'SP' : p.role === 'CL' ? 'CL' : 'RP')
      return { name: p.name, short: p.short || p.name.split(' ').slice(-1)[0], number: p.number ?? null, pos, role, ovr: ovrOf(pos, asBuild(p.attrs, KEYS[pos]), pos === 'pit' ? (role === 'SP' ? 'SP' : 'CL') : 'bat'), photo: hsFile(p), starter: !!p.starter, age: p.age ?? null, attrs: p.attrs }
    }
    const bats = PLAYERS[pool].bat.filter(p => p.team === short && p.attrs).map(p => one(p, 'bat')).filter(Boolean).sort((a, b) => b.ovr - a.ovr)
    const pits = PLAYERS[pool].pit.filter(p => p.team === short && p.attrs).map(p => one(p, 'pit')).filter(Boolean)
    // the rotation: the marked ace first, then the best; the pen: the closer first
    const rot = pits.filter(p => p.role === 'SP').sort((a, b) => (b.starter - a.starter) || (b.ovr - a.ovr))
    const pen = pits.filter(p => p.role !== 'SP').sort((a, b) => ((b.role === 'CL') - (a.role === 'CL')) || (b.ovr - a.ovr))
    clubCache.set(key, { bats, rot, pen })
  }
  return clubCache.get(key)
}
// every player the club has in the pool, out of the award field (they're all with the squad: playing, or sat)
const clubExclude = (pool, short) => {
  const c = clubOf(pool, short)
  return [...c.bats.map(p => `bat:${p.name}`), ...[...c.rot, ...c.pen].map(p => `pit:${p.name}`)]
}

// where a regular can move when his own spot is taken (the nearest on the field, then DH; nobody moves to catcher)
const NEAR = { C: ['DH', '1B'], '1B': ['DH', '3B', 'LF', 'RF'], '2B': ['SS', '3B', '1B', 'DH'], '3B': ['1B', '2B', 'SS', 'DH'], SS: ['2B', '3B', 'CF', 'DH'], LF: ['RF', 'CF', '1B', 'DH'], CF: ['LF', 'RF', 'DH'], RF: ['LF', 'CF', '1B', 'DH'], DH: ['1B', 'LF', 'RF'] }
function placeBats(bats, spots) {
  const placed = new Map()
  for (const p of bats) { const i = spotOfLabel(p.role); if (i >= 0 && !spots[i]) { spots[i] = { real: p, spot: i }; placed.set(p.name, i) } }
  for (const p of bats) {
    if (placed.has(p.name)) continue
    for (const l of NEAR[p.role] ?? ['DH']) { const i = spotOfLabel(l); if (!spots[i]) { spots[i] = { real: p, spot: i, moved: true }; placed.set(p.name, i); break } }
  }
  return placed
}

// ── The lineup and the staff ─────────────────────────────────────────────────
// spots: one a spot (BASEBALL_SPOTS order) { you: slot } | { real, moved? } | { open: true }, with `spot`.
// benched: the regulars with no spot left; pen: the starters pushed out of the rotation and the relievers.
// order: the batting order, spot → 1–9. leaves: who each build really replaces (slot id → a real man or null).
export function lineupOf(squad) {
  const pool = poolOf(squad)
  const club = squad?.team ? clubOf(pool, squad.team) : { bats: [], rot: [], pen: [] }
  const built = (squad?.slots ?? []).filter(s => s.build)
  const at = spotsOf({ ...squad, slots: built })
  const spots = BASEBALL_SPOTS.map(() => null)
  for (const s of built) if (at[s.id] != null) spots[at[s.id]] = { you: s, spot: at[s.id] }
  const placed = placeBats(club.bats, spots)
  // the rotation in order around the builds; the closer
  const rot = [...club.rot]
  for (const i of ROT_SPOTS) if (!spots[i] && rot.length) spots[i] = { real: rot.shift(), spot: i }
  const pen = [...club.pen]
  if (!spots[CL_SPOT] && pen.length && pen[0].role === 'CL') spots[CL_SPOT] = { real: pen.shift(), spot: CL_SPOT }
  BASEBALL_SPOTS.forEach((sp, i) => { if (!spots[i]) spots[i] = { open: true, spot: i } })
  const benched = club.bats.filter(p => !placed.has(p.name))
  const toPen = [...rot, ...pen]
  // who each build replaces: the man who isn't in the club's own lineup (or staff) any more, at its spot first
  const base = BASEBALL_SPOTS.map(() => null)
  placeBats(club.bats, base)
  club.rot.slice(0, ROT_SPOTS.length).forEach((p, j) => { base[ROT_SPOTS[j]] = { real: p } })
  if (club.pen[0]?.role === 'CL') base[CL_SPOT] = { real: club.pen[0] }
  const now = new Set(spots.filter(x => x.real).map(x => `${x.real.pos}:${x.real.name}`))
  const gone = { bat: [], pit: [] }
  base.forEach((x, i) => { const pos = BASEBALL_SPOTS[i].pos; if (!x) gone[pos].push({ i, man: null }); else if (!now.has(`${pos}:${x.real.name}`)) gone[pos].push({ i, man: x.real }) })
  const leaves = {}
  const mine = spots.filter(x => x.you)
  for (const x of mine) {   // (his own spot's man, when that man left; else a man who left; else an open spot)
    const g = gone[x.you.pos]
    let j = g.findIndex(y => y.i === x.spot)
    if (j < 0) j = g.findIndex(y => y.man)
    if (j < 0) j = 0
    leaves[x.you.id] = g[j]?.man ?? null
    if (j < g.length) g.splice(j, 1)
  }
  return { spots, benched, pen: toPen, order: battingOrder(spots), leaves, pool, real: club }
}
// today's way: a high on-base man with legs leads off, the best bat hits second, then the rest by the bat
const batVal = a => 0.3 * a.contact + 0.3 * a.power + 0.2 * a.eye + 0.12 * a.gap + 0.08 * a.avoidK
const leadVal = a => 0.4 * a.eye + 0.35 * a.contact + 0.25 * a.speed
const valsOf = x => {
  if (x.you) return Object.fromEntries(BAT_TRAITS.map(k => [k, x.you.build?.[k]?.val ?? 5]))
  return Object.fromEntries(BAT_TRAITS.map(k => [k, x.real.attrs?.[k] ?? 5]))
}
function battingOrder(spots) {
  const men = BAT_SPOTS.map(i => spots[i]).filter(x => x && !x.open).map(x => ({ spot: x.spot, v: valsOf(x) }))
  men.sort((a, b) => batVal(b.v) - batVal(a.v) || a.spot - b.spot)
  const order = {}
  const top = men.slice(0, 6).filter((m, i) => i > 0 && m.v.speed >= 6)
  const lead = (top.length ? top : men.slice(1)).sort((a, b) => leadVal(b.v) - leadVal(a.v) || a.spot - b.spot)[0] ?? men[0]
  let n = 2
  if (lead) order[lead.spot] = 1
  for (const m of men) if (m !== lead) order[m.spot] = n++
  for (const i of BAT_SPOTS) if (order[i] == null) order[i] = n++   // (the platoon spots bat at the bottom)
  return order
}

// ── Strength ─────────────────────────────────────────────────────────────────
const liftCache = new Map()
function liftOf(build, short, pos, mode, role, replaces) {
  const key = `${mode}|${short}|${pos}|${role}|${replaces || '-'}|${KEYS[pos].map(k => build?.[k]?.val ?? '-').join(',')}`
  if (!liftCache.has(key)) {
    if (liftCache.size > 400) liftCache.clear()
    liftCache.set(key, baseballBuildLift(build, { short, role, replaces: replaces || false }, pos, mode))
  }
  return liftCache.get(key)
}
export function strengthOf(squad) {
  const pool = poolOf(squad)
  if (!squad?.team) return { off: 5.5, def: 5.5, baseOff: 5.5, baseDef: 5.5, moves: [] }
  const base = baseballTeam10({ short: squad.team }, pool)
  const L = lineupOf(squad)
  let off = base.off, def = base.def
  const moves = []
  for (const x of L.spots) {
    if (!x.you) continue
    const sp = BASEBALL_SPOTS[x.spot], pos = sp.pos
    const lf = liftOf(x.you.build, squad.team, pos, pool, pos === 'pit' ? sp.role : sp.label, L.leaves[x.you.id]?.name ?? null)
    const d = { off: lf.off - base.off, def: lf.def - base.def }
    off += d.off; def += d.def
    moves.push({ pos, spot: x.spot, off: r1(d.off), def: r1(d.def), replaced: L.leaves[x.you.id]?.name ?? null })
  }
  const clamp = v => r1(Math.min(11.5, Math.max(0, v)))
  return { off: clamp(off), def: clamp(def), baseOff: base.off, baseDef: base.def, moves }
}

// ── The roster that plays the season ────────────────────────────────────────
// A snapshot of every man who plays, kept with the result so the season (and any game of it) plays back the same:
//   k key (b:<slot> a build, r:<name> a real hitter, rp:<name> a real pitcher: a two-way man is both) · s the build's slot · n name (a build: its archetype)
//   pos 'bat' | 'pit' · role C…DH, SP, CL · tag the spot (SS, SP2, CL) · spot · o OVR · a ratings (the engine's
//   trait order) · order batting order · slot the rotation turn (0–4) · age · mv a regular out of position
export function rosterOf(squad) {
  const L = lineupOf(squad)
  const out = []
  for (const x of L.spots) {
    if (x.open) continue
    const sp = BASEBALL_SPOTS[x.spot], pos = sp.pos
    const role = pos === 'bat' ? sp.label : sp.role
    const extra = { pos, role, tag: sp.label, spot: x.spot, ...(pos === 'bat' ? { order: L.order[x.spot] } : role === 'SP' ? { slot: ROT_SPOTS.indexOf(x.spot) } : {}) }
    if (x.you) {
      const b = x.you.build
      const age = buildAge(b)
      out.push({ k: `b:${x.you.id}`, s: x.you.id, n: nameOf(pos, b) ?? sp.name, o: ovrOf(pos, b, pos === 'pit' ? role : 'bat'), a: KEYS[pos].map(k => b?.[k]?.val ?? 5), ...(age != null && { age }), ...extra })
    } else {
      const p = x.real
      out.push({ k: `${pos === 'pit' ? 'rp' : 'r'}:${p.name}`, n: p.name, o: ovrOf(pos, asBuild(p.attrs, KEYS[pos]), pos === 'pit' ? role : 'bat'), a: KEYS[pos].map(k => p.attrs?.[k] ?? 5), ...(p.age != null && { age: p.age }), ...(x.moved && { mv: p.role }), ...extra })
    }
  }
  return out
}

// ── The season ───────────────────────────────────────────────────────────────
// the line a man's game keeps for the box score (0: he didn't play)
const BAT_G = ['pa', 'ab', 'r', 'h', 'doubles', 'triples', 'hr', 'rbi', 'bb', 'k', 'sb', 'hbp', 'sf']
const PIT_G = ['outs', 'h', 'r', 'er', 'bb', 'k', 'hr', 'pitches', 'w', 'l', 'sv', 'hld', 'gs', 'bs']
const gameLine = (p, g) => (p.pos === 'bat' ? (g?.gp ? BAT_G.map(k => g[k] ?? 0) : 0) : (g?.app ? PIT_G.map(k => g[k] ?? 0) : 0))
const unLine = (p, x) => (x ? Object.fromEntries((p.pos === 'bat' ? BAT_G : PIT_G).map((k, i) => [k, x[i]])) : null)
// a reliever's runs held inside what the starter left (the script's score is the game's)
function holdRuns(g, room) {
  if (!g?.app || (g.r ?? 0) <= room) return false
  g.r = Math.max(0, room); g.er = Math.min(g.er ?? 0, g.r); g.hr = Math.min(g.hr ?? 0, g.r); g.h = Math.max(g.h ?? 0, g.hr)
  return true
}
const seriesGames = res => (res.playoffRounds ?? []).filter(r => r.type === 'series').flatMap(r => r.games ?? [])
// One game's staff made to fit the game: the innings first (no closer behind a complete game; a starter he
// relieves leaves him his inning), then the runs (the closer's inside what the starter left). The lines that changed.
const ipText = o => `${Math.floor(o / 3)}.${o % 3}`
const PIT_ZERO = { app: 0, gs: 0, outs: 0, ip: '0.0', bf: 0, pitches: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, hbp: 0, w: 0, l: 0, sv: 0, hld: 0, bs: 0, svo: 0, qs: 0, cg: 0, sho: 0, nh: 0, dec: null }
const decOf = x => (x.w ? 'W' : x.l ? 'L' : x.sv ? 'S' : x.hld ? 'H' : x.bs ? 'BS' : null)
function fitStaff(sp, rps, g) {
  const changed = new Set()
  const pen = rps.filter(x => x?.app)
  const max = (g.innings ?? 9) * 3 - (g.walkedOff ? 1 : 0)
  if (sp?.app && pen.length) {
    const relief = pen.reduce((a, x) => a + (x.outs ?? 0), 0)
    if (sp.outs + relief > max) {
      if (sp.outs >= max - 3) for (const x of pen) { Object.assign(x, PIT_ZERO, { sat: true }); changed.add(x) }
      else {
        sp.outs = Math.max(3, max - relief); sp.ip = ipText(sp.outs); sp.k = Math.min(sp.k ?? 0, sp.outs)
        sp.cg = 0; sp.sho = 0; sp.qs = sp.outs >= 18 && (sp.er ?? 0) <= 3 ? 1 : 0
        if (sp.w && sp.outs < 15) sp.w = 0
        sp.dec = decOf(sp); changed.add(sp)
      }
    }
  }
  // a blown save: the lead was there when the starter left. His runs fit inside what the closer left him, and the
  // decision is the closer's (the loss), or nobody's (a comeback after the blown save: no win for the starter)
  const blown = pen.find(x => x.app && x.bs)
  if (sp?.app && blown) {
    const fit = Math.max(0, (g.oppSc ?? 0) - pen.reduce((a, x) => a + (x.app ? x.r ?? 0 : 0), 0))
    if ((sp.r ?? 0) > fit || sp.w || sp.l) {
      sp.r = Math.min(sp.r ?? 0, fit); sp.er = Math.min(sp.er ?? 0, sp.r); sp.hr = Math.min(sp.hr ?? 0, sp.r); sp.h = Math.max(sp.h ?? 0, sp.hr)
      sp.w = 0; sp.l = 0; sp.sho = sp.cg && !sp.r ? 1 : 0; sp.qs = sp.outs >= 18 && sp.er <= 3 ? 1 : 0; sp.dec = decOf(sp)
      changed.add(sp)
    }
  }
  let room = (g.oppSc ?? 0) - (sp?.app ? sp.r ?? 0 : 0)
  for (const x of pen) { if (!x.app) continue; if (holdRuns(x, room)) changed.add(x); room -= x.r ?? 0 }
  return changed
}

// The lineup's share of the club's runs, game by game. Each man's line is drawn on its own (his runs and RBI
// inside what the men before him took), so the men in the lineup can fall short of what a real lineup drives in:
// over a season the starters score about their share of the plate appearances (the platoon spots, the days off
// and the pinch hitters the rest) and drive in about 95% of the runs they score (B-R team batting, 2024-26: RBI
// run 94-96% of runs). The runs and RBI are moved to that share, one at a time, to the men with room for them
// (a man on base who didn't score, a hit that could drive one in), never more than the club scored. A line that
// changed is booked again (his season, his awards).
const SPOT_PA = [4.65, 4.55, 4.45, 4.35, 4.24, 4.13, 4.02, 3.91, 3.8]
const RBI_OF_R = 0.95
function shareRuns(bats, runs, script, seed, mode) {
  if (!bats.length) return
  const rand = seeded(`${seed}|share`)
  const round = v => { const f = Math.floor(v); return f + (rand() < v - f ? 1 : 0) }
  const pick = (men, w) => { const tot = men.reduce((a, m) => a + w(m), 0); if (tot <= 0) return null; let u = rand() * tot; for (const m of men) { u -= w(m); if (u <= 0) return m } return men[men.length - 1] }
  const dirty = new Set(), dirtyPo = new Set()
  const fitGame = (lines, my, poKey) => {
    const on = lines.filter(([, g]) => g?.gp)
    if (!on.length) return
    const env = Math.max(0.7, 1 + 0.026 * (my - 4.4))
    const used = new Set(on.map(([p]) => p.order))
    const pa = on.reduce((a, [, g]) => a + (g.pa ?? 0), 0)
    const rest = SPOT_PA.reduce((a, x, o) => a + (used.has(o + 1) ? 0 : x * env), 0)
    const share = pa / Math.max(1, pa + rest) * 0.985
    const tR = Math.min(my, round(my * share)), tRbi = Math.min(my, round(my * share * RBI_OF_R))
    const mark = p => (poKey ? dirtyPo : dirty).add(p.k)
    const fit = (key, target, room, floor) => {
      let sum = on.reduce((a, [, g]) => a + (g[key] ?? 0), 0)
      for (let n = 0; sum < target && n < 40; n++) { const m = pick(on, ([, g]) => Math.max(0, room(g) - (g[key] ?? 0))); if (!m) break; m[1][key]++; sum++; mark(m[0]) }
      for (let n = 0; sum > target && n < 40; n++) { const m = pick(on, ([, g]) => Math.max(0, (g[key] ?? 0) - floor(g))); if (!m) break; m[1][key]--; sum--; mark(m[0]) }
    }
    // (runs: a home run is his own; on base otherwise. RBI: his home runs drive in themselves; a hit drives in up to
    // three, an out (a sac fly, a groundout) one)
    fit('r', tR, g => (g.hr ?? 0) + Math.max(0, (g.h ?? 0) - (g.hr ?? 0)) + (g.bb ?? 0) + (g.hbp ?? 0), g => g.hr ?? 0)
    fit('rbi', tRbi, g => 4 * (g.hr ?? 0) + 3 * Math.max(0, (g.h ?? 0) - (g.hr ?? 0)) + Math.min(1, Math.max(0, (g.ab ?? 0) - (g.h ?? 0)) + (g.sf ?? 0)), g => g.hr ?? 0)
  }
  script.games.forEach((x, i) => fitGame(bats.map(p => [p, runs[p.k].games[i]]), x.mySc, false))
  const byG = Object.fromEntries(bats.map(p => [p.k, new Map(seriesGames(runs[p.k]).map(x => [x.g, x]))]))
  for (const g of seriesGames(runs[bats[0].k])) fitGame(bats.map(p => [p, byG[p.k].get(g.g)]), g.mySc, true)
  for (const p of bats) {
    if (!dirty.has(p.k) && !dirtyPo.has(p.k)) continue
    const res = runs[p.k]
    const ctx = { mode, pos: res.pos, frRate: res.frRate, runIdx: res.runIdx }
    if (dirtyPo.has(p.k)) for (const rd of (res.playoffRounds ?? []).filter(r => r.type === 'series')) rd.line = baseballTotals(rd.games, 'bat', ctx)
    const R = dirty.has(p.k) ? { ...rebookBaseball(res, res.games), playoffRounds: res.playoffRounds } : res
    if (dirtyPo.has(p.k)) { const gs = seriesGames(R); R.postseason = { ...R.postseason, games: gs, line: baseballTotals(gs, 'bat', ctx), series: (R.playoffRounds ?? []).filter(r => r.type === 'series').map(r => ({ name: r.name, short: r.short, opp: r.opponent?.short, won: r.won, wins: r.wins, losses: r.losses, line: r.line })) } }
    runs[p.k] = R
  }
}

// One season for the club: the script, then every man's line inside it (the season and its box scores both)
function playClub({ team, mode, str, roster, seed, exclude }) {
  const script = scriptBaseballSeason({ short: team, exclude }, { off: str.off, def: str.def }, `${seed}|club`, mode)
  const spent = Array.from({ length: 220 }, () => ({ r: 0, rbi: 0 }))
  const runs = {}
  const tm = p => ({ short: team, role: p.role, exclude, ...(p.age != null && { age: p.age }) })
  // the hitters: the builds first (their lines are drawn whole), then the regulars, in batting order
  const bats = roster.filter(p => p.pos === 'bat').sort((a, b) => ((!!b.s) - (!!a.s)) || (a.order - b.order))
  for (const p of bats) {
    const res = runBaseballSimulation(asBuild(p.a, BAT_TRAITS), BAT_TRAITS, { ...tm(p), order: p.order, spent }, 'bat', mode, `${seed}|${p.k}`, 'classic', script)
    res.games.forEach((g, i) => { if (g.gp) { spent[i].r += g.r ?? 0; spent[i].rbi += g.rbi ?? 0 } })
    for (const g of seriesGames(res)) if (g.gp && spent[162 + g.g]) { spent[162 + g.g].r += g.r ?? 0; spent[162 + g.g].rbi += g.rbi ?? 0 }
    runs[p.k] = res
  }
  shareRuns(bats, runs, script, seed, mode)
  // the staff: the starters on their days, then the closer inside what they left
  const pits = roster.filter(p => p.pos === 'pit').sort((a, b) => ((a.role === 'SP' ? 0 : 1) - (b.role === 'SP' ? 0 : 1)) || ((a.slot ?? 9) - (b.slot ?? 9)))
  for (const p of pits) runs[p.k] = runBaseballSimulation(asBuild(p.a, PIT_TRAITS), PIT_TRAITS, { ...tm(p), ...(p.role === 'SP' && { slot: p.slot }) }, 'pit', mode, `${seed}|${p.k}`, 'classic', script)
  const sps = pits.filter(p => p.role === 'SP'), pen = pits.filter(p => p.role !== 'SP')
  if (pen.length) {
    const dirty = new Map()   // k → { reg, po }
    const mark = (k, po) => { const d = dirty.get(k) ?? { reg: false, po: false }; d[po ? 'po' : 'reg'] = true; dirty.set(k, d) }
    const fit = (spOf, rpOf, g, po) => {
      const sp = spOf(), rps = pen.map(p => [p.k, rpOf(p)])
      for (const x of fitStaff(sp?.[1], rps.map(y => y[1]), g)) mark(x === sp?.[1] ? sp[0] : rps.find(y => y[1] === x)[0], po)
    }
    script.games.forEach((g, i) => fit(() => { for (const p of sps) { const x = runs[p.k].games[i]; if (x?.app) return [p.k, x] } return null }, p => runs[p.k].games[i], g, false))
    const byG = Object.fromEntries(pits.map(p => [p.k, new Map(seriesGames(runs[p.k]).map(x => [x.g, x]))]))
    for (const g of seriesGames(runs[pits[0].k])) fit(() => { for (const p of sps) { const x = byG[p.k].get(g.g); if (x?.app) return [p.k, x] } return null }, p => byG[p.k].get(g.g), g, true)
    // a line that changed is booked again: the season from its games (the record, WAR, the awards), October's lines
    for (const [k, d] of dirty) {
      const res = runs[k]
      if (d.po) for (const rd of (res.playoffRounds ?? []).filter(r => r.type === 'series')) rd.line = baseballTotals(rd.games, 'pit', { mode, role: res.role })
      const R = d.reg ? { ...rebookBaseball(res, res.games), playoffRounds: res.playoffRounds } : res
      if (d.po) { const gs = seriesGames(R); R.postseason = { ...R.postseason, games: gs, line: baseballTotals(gs, 'pit', { mode, role: R.role }), series: (R.playoffRounds ?? []).filter(r => r.type === 'series').map(r => ({ name: r.name, short: r.short, opp: r.opponent?.short, won: r.won, wins: r.wins, losses: r.losses, line: r.line })) } }
      runs[k] = R
    }
  }
  return { script, runs }
}

// ── The awards: one of each across the club ─────────────────────────────────
const AWARD = {
  mvp: 'MVP', cyYoung: 'Cy Young', roy: 'Rookie of the Year', reliever: 'Reliever of the Year', hankAaron: 'Hank Aaron Award',
  battingTitle: 'Batting Title', hrLeader: 'Home Run Leader', rbiLeader: 'RBI Leader', sbLeader: 'Stolen Base Leader',
  kLeader: 'Strikeout Leader', winsLeader: 'Wins Leader', eraTitle: 'ERA Title', svLeader: 'Saves Leader',
}
const VOTED = ['mvp', 'cyYoung', 'roy', 'reliever', 'hankAaron']
const LEADS = { battingTitle: 'avg', hrLeader: 'hr', rbiLeader: 'rbi', sbLeader: 'sb', kLeader: 'k', winsLeader: 'w', eraTitle: 'era', svLeader: 'sv' }
const SS_SLOT = { C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', LF: 'OF', CF: 'OF', RF: 'OF', DH: 'DH' }
const scoreBat = c => (c?.tb ?? 0) + 1.3 * (c?.rbi ?? 0) + 0.5 * (c?.runs ?? c?.r ?? 0) + 0.4 * (c?.bb ?? 0) + 1.5 * (c?.hr ?? 0)
const scorePit = c => 0.5 * (c?.outs ?? 0) + 0.4 * (c?.k ?? 0) - 2 * (c?.er ?? 0) + 3 * (c?.w ?? 0) + 2.5 * (c?.sv ?? 0)
// a field entry, kept small (a name, the club, the line that won it)
const entry = e => (e ? { name: e.name, team: e.team, role: e.role, ...(e.hr != null ? { hr: e.hr, avg: e.avg, rbi: e.rbi, war: e.war } : { w: e.w, l: e.l, era: e.era, k: e.k, sv: e.sv, war: e.war }) } : null)

function awardsOf(roster, runs, lg) {
  const won = Object.fromEntries(roster.map(p => [p.k, []]))
  const honor = Object.fromEntries(roster.map(p => [p.k, []]))
  const A = {}
  const of = p => runs[p.k]?.awards ?? {}
  // the voted awards and the titles: the best case among the men who won it here
  for (const key of [...VOTED, ...Object.keys(LEADS)]) {
    const wins = roster.filter(p => of(p)[key]?.won)
    const val = p => (VOTED.includes(key) ? of(p)[key]?.winner?.score ?? 0 : (key === 'eraTitle' ? -(of(p)[key]?.value ?? 99) : of(p)[key]?.value ?? 0))
    const best = wins.sort((a, b) => val(b) - val(a))[0]
    const field = roster.map(p => of(p)[key]).find(a => a && !a.won && a.winner && !a.winner.isPlayer)?.winner ?? null
    A[key] = { key, name: key === 'reliever' ? (lg === 'NL' ? 'Trevor Hoffman NL Reliever of the Year' : 'Mariano Rivera AL Reliever of the Year') : AWARD[key], winner: best ? { k: best.k } : entry(field) }
    if (best) won[best.k].push(key)
  }
  // the Triple Crown: all three titles to one man
  for (const p of roster) {
    const w = new Set(won[p.k])
    if ((w.has('battingTitle') && w.has('hrLeader') && w.has('rbiLeader')) || (w.has('winsLeader') && w.has('eraTitle') && w.has('kLeader'))) { won[p.k].push('tripleCrown'); A.tripleCrown = { key: 'tripleCrown', name: 'Triple Crown', winner: { k: p.k } } }
  }
  // by position: a Silver Slugger a spot (three in the outfield), a Gold Glove a spot; All-Star, All-MLB
  const ss = {}
  for (const p of roster.filter(x => of(x).silverSlugger?.won).sort((a, b) => (of(a).silverSlugger.rank ?? 9) - (of(b).silverSlugger.rank ?? 9))) {
    const s = SS_SLOT[p.role] ?? 'DH'
    ss[s] = (ss[s] ?? 0) + 1
    if (ss[s] <= (s === 'OF' ? 3 : 1)) honor[p.k].push('SILVER SLUGGER')
  }
  for (const p of roster) {
    const a = of(p)
    if (a.goldGlove?.won) honor[p.k].push('GOLD GLOVE')
    if (a.allMLB?.team) honor[p.k].push(a.allMLB.team === 'first' ? 'ALL-MLB FIRST TEAM' : 'ALL-MLB SECOND TEAM')
    if (a.allStar?.selected) honor[p.k].push(a.allStar.starter ? 'ALL-STAR STARTER' : 'ALL-STAR')
  }
  // October: the series MVPs from the series lines (only the series the club won)
  const seriesMvp = short => {
    const lines = roster.map(p => {
      const s = (runs[p.k]?.postseason?.series ?? []).find(x => x.short === short || (short === 'LCS' && /CS$/.test(x.short ?? '') && x.short !== 'WS'))
      return s?.won && s.line ? { p, v: p.pos === 'bat' ? scoreBat(s.line) : scorePit(s.line) } : null
    }).filter(Boolean)
    return lines.sort((a, b) => b.v - a.v)[0]?.p ?? null
  }
  const ws = seriesMvp('WS'), cs = seriesMvp('LCS')
  if (ws) { won[ws.k].push('wsMvp'); A.wsMvp = { key: 'wsMvp', name: 'World Series MVP', winner: { k: ws.k } } }
  if (cs) { won[cs.k].push('lcsMvp'); A.lcsMvp = { key: 'lcsMvp', name: `${lg}CS MVP`, winner: { k: cs.k } } }
  return { A, won, honor }
}
const AWARD_NAME = { ...AWARD, tripleCrown: 'Triple Crown', wsMvp: 'World Series MVP', lcsMvp: 'LCS MVP' }
export const awardName = (key, lg) => (key === 'lcsMvp' ? `${lg ?? ''}CS MVP` : key === 'reliever' ? 'Reliever of the Year' : AWARD_NAME[key] ?? key)
const KEY_TAG = { mvp: 'bmvp', cyYoung: 'cy', wsMvp: 'wsmvp', tripleCrown: 'tc', roy: 'roy', reliever: 'rel', hankAaron: 'aaron', lcsMvp: 'lcs', battingTitle: 'bat', hrLeader: 'hr', kLeader: 'so', eraTitle: 'era' }
const HONOR_TAG = [[/^SILVER SLUGGER/, 'ss'], [/^GOLD GLOVE/, 'gg'], [/^ALL-MLB/, 'mlb'], [/^ALL-STAR/, 'asg']]
// the big ones first (a line's headline award)
const RANK = ['mvp', 'cyYoung', 'wsMvp', 'tripleCrown', 'roy', 'reliever', 'hankAaron', 'lcsMvp', 'battingTitle', 'hrLeader', 'eraTitle', 'kLeader', 'rbiLeader', 'winsLeader', 'svLeader', 'sbLeader']

// ── A man's season, compact ─────────────────────────────────────────────────
const BAT_TOT = ['g', 'pa', 'ab', 'h', 'doubles', 'triples', 'hr', 'rbi', 'runs', 'bb', 'k', 'sb', 'cs', 'avg', 'obp', 'slg', 'ops', 'opsPlus', 'war', 'tb', 'hitStreak', 'multiHR', 'grandSlams', 'walkoffs']
const PIT_TOT = ['w', 'l', 'era', 'g', 'gs', 'ip', 'outs', 'h', 'r', 'er', 'bb', 'k', 'hr', 'whip', 'sv', 'svo', 'bs', 'hld', 'qs', 'cg', 'sho', 'fip', 'war', 'eraPlus', 'k9']
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o?.[k] ?? 0]))
function totOf(p, res) {
  const keys = p.pos === 'bat' ? BAT_TOT : PIT_TOT
  const t = pick(res, keys)
  if (p.pos === 'bat') t.tb = (t.h - t.doubles - t.triples - t.hr) + 2 * t.doubles + 3 * t.triples + 4 * t.hr
  const ps = res.postseason?.line
  if (ps && (ps.g || ps.gs)) t.ps = pick(ps, p.pos === 'bat' ? ['g', 'ab', 'h', 'hr', 'rbi', 'runs', 'avg', 'ops'] : ['g', 'gs', 'ip', 'w', 'l', 'sv', 'era', 'k'])
  return t
}
export const rate3 = v => (typeof v === 'number' ? (v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, '')) : '—')
export function batLine(t = {}) { return [['AVG', rate3(t.avg)], ['HR', t.hr ?? 0], ['RBI', t.rbi ?? 0], ['OPS', rate3(t.ops)]] }
export function pitLine(t = {}, role) {
  return role === 'SP'
    ? [['W-L', `${t.w ?? 0}-${t.l ?? 0}`], ['ERA', (t.era ?? 0).toFixed(2)], ['K', t.k ?? 0], ['IP', t.ip ?? '0.0']]
    : [['SV', t.sv ?? 0], ['ERA', (t.era ?? 0).toFixed(2)], ['K', t.k ?? 0], ['WHIP', (t.whip ?? 0).toFixed(2)]]
}
export const statLine = (p, t) => (p.pos === 'bat' ? batLine(t) : pitLine(t, p.role))
// …and the rest of it, smaller
export function moreLine(p, t = {}) {
  if (p.pos === 'bat') return [`${t.h ?? 0} H`, `${t.runs ?? 0} R`, `${t.doubles ?? 0} 2B`, `${t.sb ?? 0} SB`, `${t.bb ?? 0} BB`, `OPS+ ${t.opsPlus ?? 0}`, `${(t.war ?? 0).toFixed(1)} WAR`]
  return p.role === 'SP'
    ? [`${t.gs ?? 0} GS`, `${t.qs ?? 0} QS`, `${t.bb ?? 0} BB`, `${(t.whip ?? 0).toFixed(2)} WHIP`, `${(t.fip ?? 0).toFixed(2)} FIP`, `${(t.war ?? 0).toFixed(1)} WAR`]
    : [`${t.g ?? 0} G`, `${t.svo ?? 0} SVO`, `${t.bs ?? 0} BLOWN`, `${t.w ?? 0}-${t.l ?? 0}`, `${t.ip ?? '0.0'} IP`, `${t.bb ?? 0} BB`, `${(t.fip ?? 0).toFixed(2)} FIP`, `${(t.war ?? 0).toFixed(1)} WAR`]
}

// a build's face: the photo on its best trait
const faceOfBuild = build => Object.values(build || {}).filter(c => c?.photo).sort((a, b) => (b.val ?? 0) - (a.val ?? 0))[0]?.photo ?? null
const rowOf = r => ({ short: r.short, w: r.wins, l: r.losses, gb: r.gb ?? 0, wcgb: r.wcgb ?? null, seed: r.seed ?? null, cl: r.clinched ?? null, us: r.isUs ? 1 : 0, rs: r.rs, ra: r.ra })
const woOf = g => (g.walkoff ? 1 : g.walkedOff ? -1 : 0)

export function baseballSeason(squad, seed) {
  const pool = poolOf(squad), mode = pool
  const str = strengthOf(squad)
  const roster = rosterOf(squad)
  const exclude = clubExclude(pool, squad.team)
  const { script, runs } = playClub({ team: squad.team, mode, str, roster, seed, exclude })
  const R0 = runs[roster[0].k]
  const lg = R0.league
  const { A, won, honor } = awardsOf(roster, runs, lg)
  // who started each game (the snapshot's index; -1 a spot starter or a bullpen day)
  const sps = roster.map((p, i) => [p, i]).filter(([p]) => p.role === 'SP')
  const starterOf = (i, po) => { for (const [p, j] of sps) { const g = po ? seriesGames(runs[p.k]).find(x => x.g === i) : runs[p.k].games[i]; if (g?.app && g.gs) return j } return -1 }
  const g = script.games.map((x, i) => [x.opponent, x.home ? 1 : 0, x.mySc, x.oppSc, x.innings ?? 9, woOf(x), starterOf(i, false), R0.games[i]?.date ?? ''])
  const rounds = (R0.playoffRounds ?? []).map(r => (r.type === 'series'
    ? { type: 'series', name: r.name, short: r.short, opp: r.opponent?.short ?? null, oppSeed: r.opponent?.seed ?? null, wins: r.wins, losses: r.losses, won: !!r.won, bestOf: r.bestOf }
    : { type: 'bye', name: r.name, short: r.short, won: true }))
  const pg = []
  ;(R0.playoffRounds ?? []).forEach((r, ri) => { if (r.type === 'series') (r.games ?? []).forEach(x => pg.push([x.opponent, x.home ? 1 : 0, x.mySc, x.oppSc, x.innings ?? 9, woOf(x), starterOf(x.g, true), x.date ?? '', ri, x.n, x.g])) })
  const tot = Object.fromEntries(roster.map(p => [p.k, totOf(p, runs[p.k])]))
  const bySlot = Object.fromEntries(squad.slots.map(s => [s.id, s]))
  const headline = list => [...list].sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b))
  const lines = roster.filter(p => p.s).map(p => {
    const w = headline(won[p.k])
    return {
      id: p.s, pos: p.pos, role: p.role, tag: p.tag, spot: p.spot, ovr: p.o, name: p.n, face: faceOfBuild(bySlot[p.s]?.build), stats: statLine(p, tot[p.k]),
      award: w[0] ? { name: awardName(w[0], lg), won: true } : null, awards: w.map(k => awardName(k, lg)), ...(honor[p.k].length && { honor: honor[p.k][0], honors: honor[p.k] }),
    }
  })
  const mates = roster.filter(p => !p.s).map(p => ({ k: p.k, awards: headline(won[p.k]).map(k => awardName(k, lg)), honors: honor[p.k] }))
  // the builds' awards as the season tags progress.js counts (lib/baseballAwards.js: bmvp, cy, ss, gg…)
  const tags = [...new Set(roster.filter(p => p.s).flatMap(p => [...won[p.k].map(k => KEY_TAG[k]), ...honor[p.k].map(h => HONOR_TAG.find(([re]) => re.test(h))?.[1])]).filter(Boolean))]
  // what the rest of the club did: the runs the lineup's platoon and bench scored, the bullpen's wins and runs
  const rs = g.reduce((a, x) => a + x[2], 0), ra = g.reduce((a, x) => a + x[3], 0)
  const sum = (pos, key) => roster.filter(p => p.pos === pos).reduce((a, p) => a + (tot[p.k][key] ?? 0), 0)
  const others = { r: rs - sum('bat', 'runs'), rbi: rs - sum('bat', 'rbi'), ra: ra - sum('pit', 'r'), w: script.wins - sum('pit', 'w'), l: script.losses - sum('pit', 'l') }
  // the league's home run race: the club's men and the field's leaders
  const hrTop = roster.map(p => runs[p.k]?.awards?.hrLeader?.top).find(t => t?.length) ?? []
  const race = [...roster.filter(p => p.pos === 'bat').map(p => ({ k: p.k, hr: tot[p.k].hr })), ...hrTop.filter(e => !e.isPlayer).map(e => ({ name: e.name, team: e.team, hr: e.hr }))]
    .sort((a, b) => b.hr - a.hr || (a.k ? -1 : b.k ? 1 : 0)).slice(0, 5)
  const div = R0.divisions?.[lg]?.[R0.division] ?? []
  return {
    raw: runs,
    result: {
      pool, mode, league: lg, division: R0.division,
      wins: script.wins, losses: script.losses, playoffs: !!R0.madePlayoffs, champion: !!R0.champion, seed: R0.playoffSeed ?? null, leagueRank: R0.leagueRank,
      divRank: R0.divRank, divisionTitle: !!R0.divisionTitle, wildCard: !!R0.wildCard, hasBye: !!R0.hasBye, pennant: !!R0.pennant, eliminatedIn: R0.eliminatedIn ?? null,
      gb: R0.gb ?? 0, rs, ra, wsWinner: R0.wsWinner ?? null,
      standings: div.map(rowOf), wild: (R0.wildCardRace?.[lg] ?? []).slice(0, 6).map(rowOf),
      rounds, g, pg,
      strength: { off: str.off, def: str.def, baseOff: str.baseOff, baseDef: str.baseDef },
      lines, mates, roster, tot, others, awards: A, race, ex: exclude, tags,
    },
  }
}

// ── Reading a result ─────────────────────────────────────────────────────────
// every game as one list, in order: the regular season (G1–G162), then October
export function baseballSchedule(r) {
  const rd = r.rounds ?? []
  const row = (x, i, po) => ({ i, po, opp: x[0], home: !!x[1], my: x[2], op: x[3], won: x[2] > x[3], inn: x[4], wo: x[5], sp: x[6], date: x[7], ...(po ? { ri: x[8], gm: x[9], label: `${rd[x[8]]?.short ?? 'PS'} · G${x[9]}`, round: rd[x[8]]?.name ?? 'Postseason' } : { label: `G${i + 1}` }), ...(x[4] > 9 && { ot: x[4] - 9 }) })
  return [...(r.g ?? []).map((x, i) => row(x, i, false)), ...(r.pg ?? []).map((x, i) => row(x, i, true))]
}
// every game's box score, played again from the result: each man's line ({ k → line }), the score checked
// against the one kept (a season the data has moved under plays back null: the box can't be trusted)
export function baseballBox(r) {
  const roster = r.roster ?? []
  if (!roster.length || !r.team) return null
  const { script, runs } = playClub({ team: r.team, mode: r.mode ?? r.pool ?? 'current', str: r.strength, roster, seed: r.sd, exclude: r.ex ?? [] })
  const same = script.games.length === (r.g ?? []).length && script.games.every((x, i) => x.mySc === r.g[i][2] && x.oppSc === r.g[i][3])
  if (!same) return null
  const reg = script.games.map((_, i) => ({ s: Object.fromEntries(roster.map(p => [p.k, unLine(p, gameLine(p, runs[p.k].games[i]))])) }))
  const byG = Object.fromEntries(roster.map(p => [p.k, new Map(seriesGames(runs[p.k]).map(x => [x.g, x]))]))
  const po = (r.pg ?? []).map(x => ({ s: Object.fromEntries(roster.map(p => [p.k, unLine(p, gameLine(p, byG[p.k].get(x[10])))])) }))
  return { reg, po }
}
// a snapshot man's spot, the way the lineup card reads (SS, SP2, CL)
export const spotTag = p => p?.tag ?? p?.role ?? ''
