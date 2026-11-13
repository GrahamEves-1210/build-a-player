// FRANCHISE: the men. Real players come from the game's own rosters (src/data), with the game's own 0-11
// trait grades, OVR formulas and archetype names (utils/simulation.js). Everyone else is generated: depth
// behind the real starters, draft classes, street free agents. A generated player is clearly a backup: low
// grades, initials for a face, a made-up name that is never a real player's.
//
// A player (F.players[id]) is plain data:
//   id        number
//   name      full name          short: last name for a box score
//   pos       qb rb wr te ol dl lb db k           sub: LT LG C RG RT · edge dt · cb s (else null)
//   team      'KC' | null (free agent)
//   real      true: from the data files (photo, bio)      built: true: one of the user's builds      gen: generated
//   age, exp  age this season, seasons in the league
//   a         { trait: 0-11 }                     ovr: the position's own OVR formula (cached; reOvr after a change)
//   dev       0-3 NORMAL STAR SUPERSTAR ELITE     devKnown: false until he has played (a rookie's tier is hidden)
//   xp, pts   XP toward the next upgrade point, points to spend
//   con       { yrs, sal, guar, rookie, rd, opt, tag }: years left counting this one, $M a year, $M guaranteed left,
//             rookie deal, draft round, fifth-year option (0 none, 1 available, 2 exercised), franchise tag
//   mood      0-100                               drives: one or two of DRIVES
//   wear      0-100 (workload this season)        inj: null | { wk, what, ir }
//   s, car    this season's stats and the career totals (stats.js keys)       hist: season lines       aw: awards
//   num, ht, wt, skin, photo (headshot id | null), college, draft: [year, round, pick, team] | null

import { QBS, TYPES as QB_TYPES, ATTR as QB_ATTR, QB_PHYSICALS } from '../../data/qbs'
import { RBS, RB_TYPES, RB_ATTR } from '../../data/rbs'
import { WRS, WR_TYPES, WR_ATTR } from '../../data/wrs'
import { TES, TE_TYPES, TE_ATTR } from '../../data/tes'
import { OLS, OL_TYPES, OL_ATTR } from '../../data/ols'
import { DLS, DL_TYPES, DL_ATTR } from '../../data/dls'
import { LBS, LB_TYPES, LB_ATTR } from '../../data/lbs'
import { DBS, DB_TYPES, DB_ATTR } from '../../data/dbs'
import { KS, K_TYPES, K_ATTR } from '../../data/ks'
import { BIRTH_NFL } from '../../data/player-ages'
import HEADSHOTS from '../../data/headshots.json'
import { CFB_TEAMS } from '../../data/cfb-teams'
import { FIRST_NAMES, LAST_NAMES } from '../playerNames'
import {
  calcOVR, calcOVRRB, calcOVRWR, calcOVRTE, calcOVRDB, calcOVRDL, calcOVRLB, calcOVROL, calcOVRK,
  getArchetype, getArchetypeRB, getArchetypeWR, getArchetypeTE, getArchetypeDB, getArchetypeDL, getArchetypeLB, getArchetypeOL, getArchetypeK,
} from '../../utils/simulation'
import { FIRST_YEAR, OL_SPOTS, clamp, gradeOf, slotOf } from './consts'
import { rngOf, roll } from './rng'

export const TYPES_OF = { qb: QB_TYPES, rb: RB_TYPES, wr: WR_TYPES, te: TE_TYPES, ol: OL_TYPES, dl: DL_TYPES, lb: LB_TYPES, db: DB_TYPES, k: K_TYPES }
const ATTR_OF = { qb: QB_ATTR, rb: RB_ATTR, wr: WR_ATTR, te: TE_ATTR, ol: OL_ATTR, dl: DL_ATTR, lb: LB_ATTR, db: DB_ATTR, k: K_ATTR }
const OVR_FN = { qb: calcOVR, rb: calcOVRRB, wr: calcOVRWR, te: calcOVRTE, ol: calcOVROL, dl: calcOVRDL, lb: calcOVRLB, db: calcOVRDB, k: calcOVRK }
const ARCH_FN = { qb: getArchetype, rb: getArchetypeRB, wr: getArchetypeWR, te: getArchetypeTE, ol: getArchetypeOL, dl: getArchetypeDL, lb: getArchetypeLB, db: getArchetypeDB, k: getArchetypeK }
// a trait's name on screen: { label, short }
export const traitLabel = (pos, t) => ({ label: ATTR_OF[pos]?.[t]?.label ?? t, short: ATTR_OF[pos]?.[t]?.shortLabel ?? t.slice(0, 3).toUpperCase() })

// The OVR helpers read a build ({ trait: { val } }). One reusable wrapper per position keeps the hot paths
// (an offseason re-rates 1,700 men) from allocating.
const WRAP = Object.fromEntries(Object.entries(TYPES_OF).map(([pos, types]) => [pos, Object.fromEntries(types.map(t => [t, { val: 0 }]))]))
function wrapOf(pos, a, sub) {
  const w = WRAP[pos], types = TYPES_OF[pos]
  for (let i = 0; i < types.length; i++) w[types[i]].val = a[types[i]] ?? 5
  if (w.size) w.size.subpos = sub ?? undefined
  return w
}
export const ovrOf = (pos, a, sub = null) => OVR_FN[pos](wrapOf(pos, a, sub), TYPES_OF[pos]) ?? 60
export function reOvr(p) { p.ovr = ovrOf(p.pos, p.a, p.sub); if (!(p.peak >= p.ovr)) p.peak = p.ovr; return p.ovr }
export function archOf(p) { try { return ARCH_FN[p.pos](p.ovr, wrapOf(p.pos, p.a, p.sub), TYPES_OF[p.pos]) ?? null } catch { return null } }
// a man's ratings in the build format the mini games and the build screen read ({ trait: { val } })
export const asBuild = p => { const b = Object.fromEntries(TYPES_OF[p.pos].map(t => [t, { type: t, val: p.a[t] ?? 5 }])); if (b.size && p.sub) b.size.subpos = p.sub; return b }
export const lastName = name => { const parts = String(name || '').replace(/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i, '').split(' '); return parts[parts.length - 1] || name }
export const initials = name => String(name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

// ── The real pool ────────────────────────────────────────────────────────────
// One row per real player, keyed by name (a man listed at two positions plays his better one).
const rated = (p, types) => p.attrs && types.every(t => typeof p.attrs[t] === 'number')
const subOf = (pos, p) => (pos === 'ol' ? (OL_SPOTS.includes(p.pos) ? p.pos : OL_SPOTS.includes(p.subpos) ? p.subpos : 'LG')
  : pos === 'dl' ? (p.subpos === 'dt' ? 'dt' : 'edge') : pos === 'db' ? (p.subpos === 's' ? 's' : 'cb') : null)
function realRows() {
  const out = new Map()
  const lists = { qb: QBS, rb: RBS, wr: WRS, te: TES, ol: OLS, dl: DLS, lb: LBS, db: DBS, k: KS }
  for (const [pos, list] of Object.entries(lists)) {
    const types = TYPES_OF[pos]
    for (const p of list) {
      if (!rated(p, types) || !p.team) continue
      const sub = subOf(pos, p)
      const a = Object.fromEntries(types.map(t => [t, clamp(Math.round(p.attrs[t]), 0, 11)]))
      const row = { name: p.name, pos, sub, team: p.team, a, ovr: ovrOf(pos, a, sub), num: p.number ?? null, ht: p.height ?? QB_PHYSICALS[p.name]?.height ?? null, wt: p.weight ?? QB_PHYSICALS[p.name]?.weight ?? null, skin: p.skin ?? null,
        photo: p.headshot ?? HEADSHOTS[p.name] ?? null, starter: !!p.starter, since: typeof p.years === 'string' ? parseInt(p.years, 10) || null : null }
      const had = out.get(p.name)
      if (!had || row.ovr > had.ovr) out.set(p.name, row)
    }
  }
  return out
}
let REAL = null
export const realPool = () => (REAL ??= realRows())
export const realByName = name => realPool().get(name) ?? null

// A real player's age this first season. Linebackers have no birth year in the data: theirs is read from the year
// they joined the team and how good they are (a seeded guess, the same every time).
function realAge(row) {
  const born = BIRTH_NFL[row.name]
  if (born) return clamp(FIRST_YEAR - born, 20, 45)
  const u = roll(`age-${row.name}`)
  const since = row.since ? clamp(FIRST_YEAR - row.since, 0, 12) : 2
  const base = 22 + since + Math.floor(u * (since <= 1 ? (row.ovr >= 80 ? 6 : 3) : 3))
  return clamp(base, 21, 35)
}

// ── Names for generated players ──────────────────────────────────────────────
// The game's own name lists, with more of each so a 20-year league doesn't repeat itself, and never a real
// player's name.
const MORE_FIRST = ['Aaron', 'Brandon', 'Cedric', 'Dallas', 'Emmett', 'Felix', 'Garrett', 'Harlan', 'Ivan', 'Jarvis', 'Kendrick', 'Landon', 'Marlon', 'Nolan', 'Omar', 'Parker', 'Quincy', 'Roman', 'Sterling', 'Tobias', 'Ulysses', 'Vernon', 'Wesley', 'Xander', 'Yusuf', 'Zeke', 'Darnell', 'Elias', 'Franklin', 'Greyson', 'Hakeem', 'Isaac', 'Jonah', 'Kellen', 'Lorenzo', 'Maurice', 'Nate', 'Orlando', 'Percy', 'Raheem', 'Solomon', 'Trent', 'Uriah', 'Vince', 'Warren', 'Zaire', 'Devonte', 'Ezra', 'Jamir', 'Kobe']
const MORE_LAST = ['Adams', 'Bishop', 'Chambers', 'Douglas', 'Ellis', 'Foster', 'Gibson', 'Hamilton', 'Ingram', 'Jacobs', 'Keller', 'Lawson', 'Mercer', 'Nash', 'Owens', 'Porter', 'Ramsey', 'Shepherd', 'Tillman', 'Upshaw', 'Vaughn', 'Wallace', 'Young', 'Zimmerman', 'Barrett', 'Caldwell', 'Dorsey', 'Emerson', 'Finley', 'Gallagher', 'Hawkins', 'Irving', 'Jefferson', 'Knox', 'Langston', 'Monroe', 'Neal', 'Osborne', 'Pruitt', 'Randle', 'Sims', 'Tucker', 'Valentine', 'Winslow', 'Yarbrough', 'Battle', 'Coates', 'Dillard', 'Eubanks', 'Frazier']
const FIRSTS = [...FIRST_NAMES, ...MORE_FIRST], LASTS = [...LAST_NAMES, ...MORE_LAST]
const SUFFIX = ['', '', '', '', '', '', '', '', '', '', '', ' Jr.', ' Jr.', ' II', ' III']
// (taken: a Set of names already in the league)
export function genName(R, taken) {
  for (let i = 0; i < 40; i++) {
    const n = `${R.pick(FIRSTS)} ${R.pick(LASTS)}${i > 12 ? R.pick(SUFFIX) : ''}`
    if (!taken.has(n) && !realPool().has(n)) { taken.add(n); return n }
  }
  const n = `${R.pick(FIRSTS)} ${R.pick(LASTS)} ${['IV', 'V', 'VI'][R.int(0, 2)]}`
  taken.add(n)
  return n
}
// colleges a generated player comes from: the bigger programs more often
const COLLEGE_W = CFB_TEAMS.map(t => 1 + Math.max(0, (t.ovr ?? 5) - 3) ** 1.6)
export const genCollege = R => CFB_TEAMS[Math.max(0, R.wpick(COLLEGE_W))]?.school ?? 'State'
const SKINS = ['#8d5a3b', '#5e3c22', '#7a5030', '#c09060', '#f0c4a0', '#9a6840', '#3a2010', '#b07848']

// ── Generated ratings ────────────────────────────────────────────────────────
// What a position is built from (weights tilt a generated man toward a believable shape) and its body.
const BODY = {
  qb: [74, 78, 205, 240], rb: [68, 73, 195, 230], wr: [69, 76, 175, 220], te: [75, 79, 235, 265], ol: [75, 80, 295, 335],
  edge: [74, 79, 240, 275], dt: [73, 78, 285, 335], lb: [72, 76, 225, 250], cb: [69, 74, 180, 205], s: [70, 75, 195, 215], k: [69, 75, 180, 215],
}
const NUMS = { qb: [1, 19], rb: [20, 39], wr: [10, 19], te: [80, 89], ol: [60, 79], edge: [90, 99], dt: [90, 99], lb: [40, 59], cb: [20, 39], s: [20, 39], k: [1, 19] }
// A set of ratings whose average is about `avg` (0-11): every trait near it, one or two calling cards above,
// a hole or two below.
export function genAttrs(R, pos, avg, spread = 1.5) {
  const types = TYPES_OF[pos], a = {}
  for (const t of types) a[t] = avg + R.n() * spread
  const hi = R.pick(types), lo = R.pick(types)
  a[hi] += 1 + R.u() * 1.5
  if (lo !== hi) a[lo] -= 1 + R.u() * 1.2
  // pull the average back onto the mark
  const mean = types.reduce((s, t) => s + a[t], 0) / types.length
  for (const t of types) a[t] = clamp(Math.round(a[t] + (avg - mean)), 0, 11)
  return a
}
// ratings that land on a target OVR (a few nudges of single traits)
export function genAttrsToOvr(R, pos, sub, target, spread = 1.5) {
  // OVR = 60 + 2.1x + 0.21x^2 on the weighted average: solve for x
  const x = clamp((-2.1 + Math.sqrt(2.1 * 2.1 + 4 * 0.21 * Math.max(0, target - 60))) / (2 * 0.21), 0, 11)
  const a = genAttrs(R, pos, x, spread), types = TYPES_OF[pos]
  for (let i = 0; i < 24; i++) {
    const o = ovrOf(pos, a, sub)
    if (o === target) break
    const t = R.pick(types)
    if (o < target && a[t] < 11) a[t]++
    else if (o > target && a[t] > 0) a[t]--
  }
  return a
}

// A generated player. opts: { pos, sub, ovr, age, team, taken (names), dev, exp, college }
export function genPlayer(R, opts) {
  const { pos, sub = null } = opts
  const key = pos === 'dl' ? (sub === 'dt' ? 'dt' : 'edge') : pos === 'db' ? (sub === 's' ? 's' : 'cb') : pos
  const body = BODY[key] ?? BODY.lb, nums = NUMS[key] ?? [1, 99]
  const a = opts.a ?? genAttrsToOvr(R, pos, sub, opts.ovr ?? 66, opts.spread ?? 1.4)
  const age = opts.age ?? R.int(22, 27)
  const p = {
    id: 0, name: opts.name ?? genName(R, opts.taken ?? new Set()), pos, sub, team: opts.team ?? null, gen: true,
    age, exp: opts.exp ?? Math.max(0, age - 22), a, ovr: 0, peak: 0, dev: opts.dev ?? 0, devKnown: opts.devKnown ?? true, xp: 0, pts: 0,
    con: null, mood: 60, drives: [], wear: 0, inj: null, s: {}, car: {}, hist: [], aw: [],
    num: R.int(nums[0], nums[1]), ht: R.int(body[0], body[1]), wt: R.int(body[2], body[3]), skin: R.pick(SKINS), photo: null,
    college: opts.college ?? genCollege(R), draft: opts.draft ?? null,
  }
  reOvr(p)
  return p
}

// A real player as a league player (year one)
export function realPlayer(row) {
  const age = realAge(row)
  const p = {
    id: 0, name: row.name, pos: row.pos, sub: row.sub, team: row.team, real: true,
    age, exp: Math.max(0, age - 22), a: { ...row.a }, ovr: row.ovr, peak: row.ovr, dev: 0, devKnown: true, xp: 0, pts: 0,
    con: null, mood: 62, drives: [], wear: 0, inj: null, s: {}, car: {}, hist: [], aw: [],
    num: row.num, ht: row.ht, wt: row.wt, skin: row.skin, photo: row.photo, college: null, draft: null,
  }
  return p
}

// One of the user's builds as a league player. `b`: { pos, build, name?, number?, photo? } (a Squad Builder slot
// works as it is). A rating the build doesn't carry is the average of the ones it does.
export function builtPlayer(R, b, team, taken) {
  const pos = b.pos, types = TYPES_OF[pos], build = b.build ?? {}
  const vals = types.map(t => build[t]?.val).filter(v => typeof v === 'number')
  const avg = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 5
  const a = Object.fromEntries(types.map(t => [t, clamp(Math.round(typeof build[t]?.val === 'number' ? build[t].val : avg), 0, 11)]))
  const size = build.size ?? {}
  const sub = pos === 'ol' ? (OL_SPOTS.includes(b.spot) ? b.spot : OL_SPOTS.includes(size.subpos) ? size.subpos : 'LT')
    : pos === 'dl' ? ((b.spot ?? size.subpos) === 'dt' ? 'dt' : 'edge') : pos === 'db' ? ((b.spot ?? size.subpos) === 's' ? 's' : 'cb') : null
  // the build's face: the photo on its best trait (lib/squadSeason.js faceOf)
  const face = b.photo ?? Object.values(build).filter(c => c?.photo).sort((x, y) => (y.val ?? 0) - (x.val ?? 0))[0]?.photo ?? null
  const p = genPlayer(R, { pos, sub, a, age: 22, exp: 0, team, taken, name: (b.name && String(b.name).trim()) || undefined, dev: 1, college: b.college ?? undefined })
  p.gen = false; p.built = true; p.photo = face; p.skin = size.skin ?? p.skin
  if (typeof size.height === 'number') p.ht = size.height
  if (typeof size.weight === 'number') p.wt = size.weight
  if (b.number != null && b.number !== '') p.num = Number(b.number)
  return p
}

// ── Reading a player ─────────────────────────────────────────────────────────
export const traitRows = p => TYPES_OF[p.pos].map(t => ({ key: t, ...traitLabel(p.pos, t), val: p.a[t] ?? 0, grade: gradeOf(p.a[t] ?? 0) }))
export const spotLabel = p => slotOf(p)
