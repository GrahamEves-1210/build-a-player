// FRANCHISE: scouting and the draft.
//
// THE CLASS (made when a season starts, drafted in the spring): about 300 college players. Each one is a whole player:
// a position and spot, the nine ratings a build at his position has (TYPES_OF), a real school, class and age, height,
// weight, a college number, combine numbers, a college stat line week by week, and a character the staff can only
// learn by sitting down with him. Two things are hidden: his ratings (the scouts see them through what they've done)
// and where he's headed (pk, his ceiling: his ratings now, the years he has to grow, his character).
//
// THE MEDIA sees everyone a little wrong (each man's own error, m): their board (the consensus) and their mock drafts
// come from that, move week to week with what he does on Saturdays, and get closer to the truth as the season goes and
// after the combine. The league's teams see between the two (half the media's error, plus their own). A GEM is a man
// the consensus has too low, a BUST one it has too high; nobody knows which until the cards are turned over.
//
// SCOUTING: the scouting department's time, 3 assignments a week (4 with a Recruiter), banked until it's spent:
//   FILM (1)       one prospect's tape: his skill ratings narrowed a step (a second session pins them)
//   GAME (2)       this week's college game: every prospect on both teams, one look at his skills and his body
//   SENIOR BOWL (2) the week of the playoffs: every senior in the class, one look
//   THE COMBINE    late February, after the Super Bowl: everyone who works out (40, vertical, bench, 3-cone), his
//                  physical ratings narrowed; the spring adds 12 assignments to the bank (pro days, more film)
//   PRO DAY (2)    a school's workout in March or April: everyone there, physicals pinned, skills a step
//   TOP-30 VISIT   the 30 pre-draft visits the NFL allows a team: his mental ratings pinned and his character known
// A rating is unknown (the media's number, ± 2 grades), narrowed (± 1, around a guess that may be a step off), or
// known. Our grade on a man is what the known ratings add up to; it's only as good as the work behind it.
//
// THE DRAFT: the real order (non-playoff teams worst record first, then the playoff teams by the round they went out,
// the Super Bowl loser 31st and the champion 32nd), seven rounds of 32 (224 picks; no compensatory picks). The league
// picks by value and need, trades up now and then (the trade value chart); the player can trade up or down too.
// A pick signs the rookie scale at his slot (contracts.js); the slot is read as the real draft's pick number, so a
// 4th-rounder signs a 4th-rounder's deal.
//
// API (screens: components/franchise2/Draft.jsx):
//   makeClass(F) · prospect state on F.dc · F.board (our board, in order) · F.sc (the scouting budget)
//   scoutsLeft(F) · film(F, id) · slateOf(F) · attend(F, gi) · interview(F, id) · proDay(F, col) · autoScout(F)
//   viewOf(F, x)  our read on him: { known, lo, hi, est, grade, range, traits: [{ t, kind, k, lo, hi, v }], report… }
//   buzzOf(F, x) · consensus(F) · mockDraft(F) · stockMoves(F) · draftNews(F) (the ticker's lines)
//   openDraft(F) · combineOf(x) · startNight(F) · cpuPicks(F) · userPick · autoPick · simRest
//   tradeUpOffers · tradeDownOffers · acceptTrade · draftDone · pickTeam · draftReview(F)
//   ratingsOf(p): any league man's nine ratings ({ trait: { val } }, a build's shape), fitted to his OVR now
import { TEAM, SHORTS, POS, MIN, POS_LABEL, gradeOf, GRADES, fakeName, realOf, realPool } from './league'
import { standings, finishOf, pct } from './standings'
import { rngOf, clamp, r1 } from './rng'
import { ovrOf, TYPES_OF } from '../squadSeason'
import { signRookie } from './contracts'
import { depthChart, groupOf, fixNumbers } from './roster'
import { CFB_TEAMS, CFB_TEAM_BY_SHORT } from '../../data/cfb-teams'

export const ROUNDS_N = 7
export const PICKS_N = 32 * ROUNDS_N
export const ROUND_TEXT = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH']

// ── Small tools ──────────────────────────────────────────────────────────────
// a quick, stable 0..1 from two numbers (the noise that has to be the same every time it's read)
const h01 = (a, b) => { let h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x7F4A7C15, 0x85EBCA77); h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15; return (h >>> 0) / 4294967296 }
const g01 = (a, b) => { const u = Math.max(1e-9, h01(a, b)), v = h01(a, b + 7919); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v) }
const strHash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h }
const HEXS = '0123456789ab'
const enc = arr => arr.map(v => HEXS[clamp(0, 11, Math.round(v))]).join('')
const dec = s => Array.from(String(s ?? ''), c => HEXS.indexOf(c))
const asBuild = (pos, vals) => Object.fromEntries(TYPES_OF[pos].map((t, j) => [t, { val: vals[j] }]))
const ovrV = (pos, vals) => ovrOf(pos, asBuild(pos, vals))

// what kind of rating each one is: p physical (the combine and pro days), s skill (film and games), m mental (interviews)
const KIND = {
  qb: { arm: 'p', legs: 'p', size: 'p', processing: 'm', leadership: 'm', vision: 'm', playmaking: 's', accuracy: 's', 'pocket-presence': 's' },
  rb: { speed: 'p', burst: 'p', strength: 'p', size: 'p', balance: 's', elusiveness: 's', vision: 'm', hands: 's', carrying: 's' },
  wr: { speed: 'p', bodyControl: 's', vertical: 'p', routeRunning: 's', release: 's', hands: 's', awareness: 'm', size: 'p', afterCatch: 's' },
  te: { speed: 'p', blocking: 's', vertical: 'p', routeRunning: 's', strength: 'p', hands: 's', awareness: 'm', size: 'p', afterCatch: 's' },
  ol: { size: 'p', length: 'p', anchor: 's', passPro: 's', runBlock: 's', mobility: 'p', blitzPickup: 'm', discipline: 'm', pancake: 's' },
  dl: { getOff: 'p', speed: 'p', size: 'p', powerMoves: 's', finesseMoves: 's', strength: 'p', playRecognition: 'm', bend: 'p', blockShed: 's' },
  lb: { range: 'p', size: 'p', power: 'p', tackling: 's', blockShed: 's', zoneInstincts: 'm', passRush: 's', playRecognition: 'm', leadership: 'm' },
  db: { speed: 'p', size: 'p', fluidity: 'p', press: 's', hands: 's', zoneIQ: 'm', manCoverage: 's', playRecognition: 'm', runSupport: 's' },
}
export const kindOf = (pos, t) => KIND[pos]?.[t] ?? 's'
export const KIND_LABEL = { p: 'PHYSICAL', s: 'SKILL', m: 'MENTAL' }

// ── Where he's headed ────────────────────────────────────────────────────────
// the years he has to grow (a 21-year-old has more road than a 23-year-old fifth-year senior), and character:
// 2 a high-character worker (+2), 1 nothing to note, 0 concerns (-4: he won't reach what his body says he could)
const ROOM = ag => (ag <= 20 ? 13 : ag === 21 ? 11.5 : ag === 22 ? 9.5 : ag === 23 ? 7.5 : 5.5)
const CH_EFF = [-4, 0, 2]
export const CHAR_TEXT = ['CONCERNS', 'CLEAN', 'HIGH CHARACTER']

// ── The class ────────────────────────────────────────────────────────────────
// how many at each position (about the real draft's mix: linemen and corners the most, few quarterbacks)
const CLASS_MIX = { qb: 15, rb: 22, wr: 40, te: 18, ol: 52, dl: 50, lb: 30, db: 49 }
const SPOTS = { dl: [['edge', 0.55], ['dt', 0.45]], db: [['cb', 0.58], ['s', 0.42]], ol: [['LT', 0.22], ['LG', 0.18], ['C', 0.2], ['RG', 0.18], ['RT', 0.22]] }
// height (in) and weight (lb) of the average man at each spot, and how much weight a step of Size carries
const BODY = { qb: [75, 219, 5], rb: [70, 212, 5], wr: [73, 196, 5], te: [77, 250, 6], LT: [78, 315, 7], RT: [78, 318, 7], LG: [76, 314, 7], RG: [76, 314, 7], C: [75, 304, 6], edge: [76, 257, 7], dt: [75, 305, 8], lb: [74, 235, 5], cb: [71, 191, 4], s: [72, 204, 4] }
const bodyKey = (pos, s) => (pos === 'ol' || pos === 'dl' || pos === 'db' ? s : pos)
// the college numbers a position wears
const NUM_RANGE = { qb: [[1, 19]], rb: [[0, 9], [20, 39]], wr: [[0, 19], [80, 89]], te: [[80, 89], [40, 49]], ol: [[50, 79]], dl: [[90, 99], [50, 59], [0, 9]], lb: [[0, 9], [30, 59]], db: [[0, 9], [20, 39]] }
// where the class comes from: every FBS school, the strong programs far more often
const SCHOOL_W = CFB_TEAMS.map(t => Math.pow(Math.max(1, t.ovr ?? 4), 2.6) * (['sec', 'b10'].includes(t.conf) ? 1.5 : ['acc', 'b12'].includes(t.conf) ? 1.1 : 0.6))

export function makeClass(F) {
  const R = rngOf(`${F.seed}-${F.year}-class`)
  const out = []
  let id = 1
  for (const [pos, n] of Object.entries(CLASS_MIX)) for (let k = 0; k < n; k++) out.push(makeProspect(F, R, pos, id++))
  F.dc = out
  F.board = []
  F.sc = { b: 3, w: 0, u: 0, att: [], cmb: 0, ivd: [], pdd: [] }
}
function makeProspect(F, R, pos, id) {
  const T = TYPES_OF[pos]
  // his ceiling first (the class's talent: a few 90s, a first round from about 83 up, a long tail), then his age
  let pk = Math.round(75.5 + R.n() * 6.4 + (R.u() < 0.012 ? 7 : 0))
  pk = clamp(60, 97, pk)
  const ag = R.wpick([0.03, 0.32, 0.45, 0.2]) + 20
  const ch = R.wpick([0.12, 0.7, 0.18])
  const up = r1(R.n() * 1.4)   // what nobody can see: some men just grow more
  const target = clamp(50, 84, Math.round(pk - ROOM(ag) - CH_EFF[ch] - up))
  // his ratings: a shape (what he's good at), lifted to where his OVR is now
  const shape = T.map(() => R.n() * 1.5)
  const a = fitVals(pos, shape, target)
  const o = ovrV(pos, a)
  pk = clamp(o, 97, Math.round(o + ROOM(ag) + CH_EFF[ch] + up))
  // the media's read of each rating: his own error (some men they love, some they miss) plus a little on each
  const z = R.int(1, 2 ** 20)
  const spots = SPOTS[pos]
  const s = spots ? spots[R.wpick(spots.map(x => x[1]))][0] : undefined
  const [h0, w0, wk] = BODY[bodyKey(pos, s)]
  const size = a[T.indexOf('size')] ?? 5
  const wt = Math.round(w0 + (size - 5) * wk + R.n() * 5)
  const ht = clamp(h0 - 5, h0 + 5, Math.round(h0 + (size - 5) * 0.35 + R.n() * 1.3))
  const ranges = NUM_RANGE[pos]
  const [lo, hi] = ranges[R.int(0, ranges.length - 1)]
  const col = CFB_TEAMS[R.wpick(SCHOOL_W)].short
  const cl = ag <= 20 ? 0 : ag === 21 ? (R.u() < 0.7 ? 1 : 2) : ag === 22 ? (R.u() < 0.6 ? 3 : 2) : 4   // SO, JR, RS-JR, SR, RS-SR
  return { i: id, n: fakeName(R), p: pos, ...(s && { s }), ag, o, pk, col, ht, wt, nu: R.int(lo, hi), a: enc(a), k: '0'.repeat(T.length), kc: 0, ch, z, sv: 0, cl }
}
export const CLASS_LABEL = ['SO', 'JR', 'RS-JR', 'SR', 'RS-SR']
const isSenior = x => x.cl >= 3

// ratings shaped like `shape`, lifted (or lowered) together until the OVR is `target`
function fitVals(pos, shape, target) {
  let lo = -8, hi = 14
  const at = k => shape.map(v => clamp(0, 11, Math.round(v + k)))
  for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (ovrV(pos, at(mid)) < target) lo = mid; else hi = mid }
  const a = at(hi), b = at(lo)
  return Math.abs(ovrV(pos, b) - target) < Math.abs(ovrV(pos, a) - target) ? b : a
}
// A league man's nine ratings, a build's shape ({ trait: { val } }), at his OVR now: a drafted man's own (as he grows
// they move with him), a real man's from the data, anyone else's a plain shape from his name.
const RATE = new Map()
export function ratingsOf(p) {
  if (!p) return null
  if (p.b != null) return null   // (a build: F.builds[p.b].build)
  const key = `${p.p}|${p.n}|${p.a ?? ''}|${p.o}`
  if (RATE.has(key)) return RATE.get(key)
  const T = TYPES_OF[p.p]
  let vals
  if (p.a) {
    const a = dec(p.a), mean = a.reduce((x, y) => x + y, 0) / a.length
    vals = ovrV(p.p, a) === p.o ? a : fitVals(p.p, a.map(v => v - mean), p.o)
  } else {
    const r = realOf(p.p, p.n)
    if (r?.attrs) vals = T.map(t => r.attrs[t] ?? 5)
    else { const z = strHash(p.n ?? ''); vals = fitVals(p.p, T.map((_, j) => g01(z, j) * 1.4), p.o) }
  }
  const out = asBuild(p.p, vals)
  if (RATE.size > 3000) RATE.clear()
  RATE.set(key, out)
  return out
}

// ── The scouting budget ──────────────────────────────────────────────────────
export const PER_WEEK = F => (F.coach?.style === 'recruiter' ? 4 : 3)
// the weeks gone by since the class was made (the regular season, then the playoffs; the offseason counts them all)
export function weeksIn(F) {
  if (F.phase === 'season') return F.wk
  if (F.phase === 'post') return 18
  if (F.phase === 'playoffs') return 18 + (F.po?.rd ?? 0)
  return 22
}
// The days bank up to four weeks' worth (a scout's time doesn't keep); the spring adds 12 and the cap doubles.
// Days past the cap aren't lost: the department works without the GM and puts them into film on its own choices.
export const SPRING = 12
const capOf = F => (F.sc?.cmb ? 24 : 12)
export const scoutsLeft = F => (F.sc ? Math.max(0, Math.min(capOf(F), (F.sc.b ?? 3) + PER_WEEK(F) * Math.max(0, weeksIn(F) - (F.sc.w ?? 0)))) : 0)
export function syncScouts(F) {
  if (!F.sc) return
  const t = weeksIn(F), w = F.sc.w ?? 0
  if (t <= w) return
  const tot = (F.sc.b ?? 3) + PER_WEEK(F) * (t - w)
  F.sc.b = Math.min(capOf(F), tot); F.sc.w = t
  if (tot > F.sc.b && !nightOn(F)) deptFilm(F, tot - F.sc.b)
}
// the spring: the Super Bowl is played (the combine, the visits, the pro days), until the draft starts
export const springOn = F => !!F.sc && (F.phase === 'done' || F.phase === 'off') && !nightOn(F)
export const VISITS = 30
const spend = (F, n) => { syncScouts(F); if ((F.sc.b ?? 0) < n) return false; F.sc.b -= n; F.sc.u = (F.sc.u ?? 0) + n; return true }
const nightOn = F => !!F.dr && F.dr.ph !== 'pre'
export const canScout = F => !!F.sc && !nightOn(F)

// what a man's ratings are known to: '0' unknown, '1' narrowed, '2' known
const setK = (x, j, lv) => { const k = x.k.split(''); if (+k[j] < lv) k[j] = String(lv); x.k = k.join('') }
const raise = (x, kinds, to = null) => {
  const T = TYPES_OF[x.p]
  T.forEach((t, j) => { if (kinds.includes(kindOf(x.p, t))) setK(x, j, to ?? Math.min(2, +x.k[j] + 1)) })
}
const byId = (F, id) => F.dc.find(x => x.i === id)

// FILM: one man's tape, his skills a step (twice: known)
export function film(F, id) {
  const x = byId(F, id)
  if (!x || !canScout(F) || filmDone(x)) return false
  if (!spend(F, 1)) return false
  raise(x, ['s'])
  x.sv |= (x.sv & 1) ? 2 : 1
  return true
}
export const filmDone = x => (x.sv & 3) === 3 || x.b != null
// TOP-30 VISIT: a prospect in the building for a day (thirty a year): his mental ratings and his character
export const visitsLeft = F => Math.max(0, VISITS - (F.sc?.ivd?.length ?? 0))
export function interview(F, id) {
  const x = byId(F, id)
  if (!x || !springOn(F) || visitsLeft(F) < 1 || x.kc || x.b != null) return false
  F.sc.ivd.push(x.i)
  raise(x, ['m'], 2); x.kc = 1; x.sv |= 32
  return true
}
// PRO DAY: a school's workout (two assignments): everyone there, his body pinned and his skills a step
export function proDay(F, col) {
  if (!springOn(F) || !F.sc.cmb || F.sc.pdd.includes(col)) return false
  const xs = F.dc.filter(x => x.col === col)
  if (!xs.length || !spend(F, 2)) return false
  F.sc.pdd.push(col)
  for (const x of xs) { raise(x, ['p'], 2); raise(x, ['s']); x.sv |= 16 }
  return xs.map(x => x.i)
}

// ── Saturdays: the college slate ─────────────────────────────────────────────
// Each week three college games worth a scout's trip (the schools with the most prospects, conference games in the
// regular season); the playoffs' weeks have the Senior Bowl. One trip a week.
const schoolsWith = F => { const m = new Map(); for (const x of F.dc) if (x.col && x.b == null) m.set(x.col, (m.get(x.col) ?? 0) + 1); return m }
const byeOf = col => 2 + (Math.abs(strHash(col)) % 11)
export const collegeWeek = F => (F.phase === 'season' ? F.wk + 1 : null)
export function slateOf(F) {
  if (!F.sc || F.dr) return null
  const wk = weeksIn(F)
  if (F.phase === 'post' || F.phase === 'playoffs' || F.phase === 'done') {
    const xs = F.dc.filter(x => isSenior(x) && x.b == null)
    return { wk, label: 'SENIOR BOWL', games: [{ k: 'sb', h: null, a: null, xs: xs.map(x => x.i) }], went: F.sc.att.includes(wk) }
  }
  const cw = wk + 1
  const label = cw <= 12 ? `WEEK ${cw}` : cw === 13 ? 'RIVALRY WEEK' : cw === 14 ? 'CONFERENCE TITLES' : cw <= 16 ? 'BOWL SEASON' : 'COLLEGE FOOTBALL PLAYOFF'
  const counts = schoolsWith(F)
  const R = rngOf(`${F.seed}-${F.year}-slate-${cw}`)
  const pool = [...counts.entries()].filter(([c, n]) => n >= 2 && (cw > 13 || byeOf(c) !== cw)).map(([c, n]) => ({ c, n: n + R.u() * 3, conf: CFB_TEAM_BY_SHORT[c]?.conf })).sort((a, b) => b.n - a.n)
  const games = [], used = new Set()
  const many = cw >= 15 ? 2 : 3
  for (const t of pool) {
    if (games.length >= many) break
    if (used.has(t.c)) continue
    // an opponent: a conference rival in the regular season, anyone strong after it
    const opp = pool.filter(o => !used.has(o.c) && o.c !== t.c && (cw > 14 || o.conf === t.conf))
    const o = opp.length ? opp[Math.min(opp.length - 1, R.int(0, 2))] : null
    if (!o) continue
    used.add(t.c); used.add(o.c)
    const home = R.u() < 0.5
    const [h, a] = home ? [t.c, o.c] : [o.c, t.c]
    games.push({ k: 'g', h, a, xs: F.dc.filter(x => x.col === h || x.col === a).map(x => x.i) })
  }
  return { wk, label, games, went: F.sc.att.includes(wk) }
}
// GAME: a scout's trip to one of this week's games (two assignments): everyone in it, one look at his skills and body
export function attend(F, gi) {
  const sl = slateOf(F)
  const g = sl?.games[gi]
  if (!g || sl.went || !canScout(F)) return null
  if (!spend(F, 2)) return null
  F.sc.att.push(sl.wk)
  for (const id of g.xs) { const x = byId(F, id); if (!x) continue; raise(x, ['s', 'p'], null); x.sv |= g.k === 'sb' ? 64 : 4 }
  return g
}

// ── What he did on Saturdays ─────────────────────────────────────────────────
// A game's line from his ratings (the same every time it's read): passing, rushing, receiving, the defense's numbers.
const tv = (x, t) => { const j = TYPES_OF[x.p].indexOf(t); return j < 0 ? 5 : dec(x.a)[j] }
const cnt = (mean, u) => Math.max(0, Math.round(mean + (u - 0.5) * 2 * Math.sqrt(Math.max(0.2, mean)) * 1.1))
export function gameLine(x, w) {
  const z = x.z, u = j => h01(z, w * 31 + j), lift = (dec(x.a).reduce((a, b) => a + b, 0) / 9 - 4.5) * 0.08
  switch (x.p) {
    case 'qb': {
      const att = Math.round(31 + (u(1) - 0.5) * 14), pctC = clamp(0.42, 0.82, 0.6 + (tv(x, 'accuracy') - 5) * 0.018 + (u(2) - 0.5) * 0.16)
      const cmp = Math.round(att * pctC), yds = Math.max(40, Math.round(att * (7.4 + (tv(x, 'arm') - 5) * 0.22 + (tv(x, 'playmaking') - 5) * 0.14 + (u(3) - 0.5) * 4)))
      const ru = tv(x, 'legs') >= 6 ? Math.round((tv(x, 'legs') - 4) * 9 + (u(6) - 0.5) * 40) : 0
      return { cmp, att, yds, td: cnt(clamp(0.7, 3.6, 1.9 + lift * 2.5 + (tv(x, 'processing') - 5) * 0.12), u(4)), int: cnt(clamp(0.25, 1.1, 0.7 - (tv(x, 'vision') - 5) * 0.07), u(5)), ry: ru, rtd: ru > 30 ? cnt(0.4, u(7)) : 0 }
    }
    case 'rb': {
      const car = Math.round(17 + (u(1) - 0.5) * 10), ypc = 5 + (tv(x, 'speed') + tv(x, 'vision') - 10) * 0.12 + (u(2) - 0.5) * 3.2
      return { car, ry: Math.max(-4, Math.round(car * ypc)), rtd: cnt(0.9 + lift * 3, u(3)), rec: cnt(1.6 + (tv(x, 'hands') - 5) * 0.25, u(4)), ryd: 0 }
    }
    case 'wr': case 'te': {
      const base = x.p === 'wr' ? 4.6 : 3.2
      const rec = cnt(base + (tv(x, 'routeRunning') + tv(x, 'hands') - 10) * 0.18, u(1))
      return { rec, ryd: Math.round(rec * (x.p === 'wr' ? 13.5 : 11) * (0.7 + u(2) * 0.6) + (tv(x, 'speed') - 5) * rec * 0.5), rctd: cnt((x.p === 'wr' ? 0.55 : 0.38) + lift * 2, u(3)) }
    }
    case 'ol': return { st: 1, sa: u(1) < 0.16 - (tv(x, 'passPro') - 5) * 0.015 ? 1 : 0 }
    case 'dl': return { tk: cnt(x.s === 'dt' ? 3 : 3.5, u(1)), tfl: cnt(0.8 + lift * 2, u(2)) * 1, sck: Math.round(cnt(Math.max(0.1, 0.45 + (tv(x, 'getOff') + tv(x, x.s === 'dt' ? 'powerMoves' : 'bend') - 10) * 0.07), u(3)) * 2) / 2 }
    case 'lb': return { tk: cnt(7 + (tv(x, 'tackling') - 5) * 0.4, u(1)), tfl: cnt(0.7, u(2)), sck: Math.round(cnt(Math.max(0.05, 0.25 + (tv(x, 'passRush') - 5) * 0.05), u(3)) * 2) / 2, int: u(4) < 0.06 ? 1 : 0 }
    default: return { tk: cnt(x.s === 's' ? 5.5 : 4, u(1)), int: u(2) < 0.08 + (tv(x, 'hands') - 5) * 0.012 ? 1 : 0, pbu: cnt(Math.max(0.2, 0.9 + (tv(x, 'manCoverage') - 5) * 0.12), u(3)) }
  }
}
// his college season so far (twelve games, a week off), up to the week the NFL season is in
export function seasonLine(F, x) {
  if (x.b != null) return null
  const last = F.phase === 'season' ? Math.min(13, F.wk) : 13
  const out = { g: 0 }
  for (let w = 1; w <= last; w++) {
    if (w === byeOf(x.col)) continue
    out.g++
    for (const [k, v] of Object.entries(gameLine(x, w))) out[k] = (out[k] ?? 0) + v
  }
  return out.g ? out : null
}
const n1 = v => (Number.isInteger(v) ? v : v.toFixed(1))
// a line the way a broadcast graphic writes it
export function lineText(pos, s) {
  if (!s) return ''
  switch (pos) {
    case 'qb': return `${s.cmp}/${s.att} · ${s.yds.toLocaleString('en-US')} YDS · ${s.td} TD · ${s.int} INT${s.ry >= 150 || (s.g == null && s.ry >= 30) ? ` · ${s.ry} RUSH` : ''}`
    case 'rb': return `${s.car} CAR · ${s.ry.toLocaleString('en-US')} YDS · ${s.rtd} TD${s.rec ? ` · ${s.rec} REC` : ''}`
    case 'wr': case 'te': return `${s.rec} REC · ${s.ryd.toLocaleString('en-US')} YDS · ${s.rctd} TD`
    case 'ol': return s.g != null ? `${s.g} STARTS · ${s.sa} ${s.sa === 1 ? 'SACK' : 'SACKS'} ALLOWED` : (s.sa ? '1 SACK ALLOWED' : 'NO SACKS ALLOWED')
    case 'dl': return `${s.tk} TKL · ${n1(s.tfl)} TFL · ${n1(s.sck)} SACKS`
    case 'lb': return `${s.tk} TKL · ${n1(s.tfl)} TFL · ${n1(s.sck)} SACKS${s.int ? ` · ${s.int} INT` : ''}`
    default: return `${s.tk} TKL · ${s.int} INT · ${s.pbu} PBU`
  }
}

// ── The combine ──────────────────────────────────────────────────────────────
// Measured from his body (the same every time): the 40, the vertical, the bench (225 lb), the 3-cone. Some top men
// skip the 40 to run at their pro day, about one in ten doesn't work out at all, quarterbacks don't bench.
const F40 = { qb: ['legs', 4.82], rb: ['speed', 4.56], wr: ['speed', 4.53], te: ['speed', 4.74], ol: ['mobility', 5.26], dl: ['speed', 4.86], lb: ['range', 4.67], db: ['speed', 4.52] }
const VERT = { qb: ['legs', 31], rb: ['burst', 34.5], wr: ['vertical', 35.5], te: ['vertical', 33], ol: ['mobility', 27.5], dl: ['getOff', 31.5], lb: ['range', 34.5], db: ['fluidity', 36.5] }
const BENCH = { qb: null, rb: ['strength', 19], wr: ['size', 13], te: ['strength', 20], ol: ['anchor', 26], dl: ['strength', 25], lb: ['power', 22], db: ['press', 14] }
const CONE = { qb: ['legs', 7.12], rb: ['elusiveness', 7.05], wr: ['bodyControl', 6.94], te: ['speed', 7.14], ol: ['mobility', 7.78], dl: ['bend', 7.3], lb: ['range', 7.06], db: ['fluidity', 6.95] }
export function combineOf(x) {
  if (x.b != null) return null
  const z = x.z, sk = h01(z, 901)
  const out = { dnp: sk < 0.09 }
  if (out.dnp) return out
  const [t40, b40] = F40[x.p]
  const dtB = x.p === 'dl' && x.s === 'dt' ? 0.2 : 0
  out.f40 = x.pk >= 88 && h01(z, 902) < 0.3 ? null : Math.round((b40 + dtB - (tv(x, t40) - 5) * 0.034 + g01(z, 903) * 0.025) * 100) / 100
  const [tv1, bv] = VERT[x.p]
  out.vert = Math.round((bv - (dtB ? 3 : 0) + (tv(x, tv1) - 5) * 1.0 + g01(z, 904) * 1.2) * 2) / 2
  out.bench = BENCH[x.p] ? Math.max(6, Math.round(BENCH[x.p][1] + (tv(x, BENCH[x.p][0]) - 5) * 1.5 + (x.s === 'dt' ? 3 : 0) + g01(z, 905) * 2)) : null
  const [tc, bc] = CONE[x.p]
  out.cone = h01(z, 906) < 0.25 ? null : Math.round((bc + (dtB ? 0.25 : 0) - (tv(x, tc) - 5) * 0.045 + g01(z, 907) * 0.05) * 100) / 100
  return out
}
// the combine: everyone who works out has his body narrowed a step (the numbers are on screen). It's held once the
// Super Bowl is played; the screens call it when the spring comes, the draft calls it if nobody has.
export function runCombine(F) {
  if (!F.sc || F.sc.cmb || !(F.phase === 'done' || F.phase === 'off')) return
  syncScouts(F)
  F.sc.cmb = 1
  F.sc.b = Math.min(capOf(F), (F.sc.b ?? 0) + SPRING)
  for (const x of F.dc) { const c = combineOf(x); if (c && !c.dnp) { raise(x, ['p']); x.sv |= 8 } }
}

// ── The media ────────────────────────────────────────────────────────────────
// Their projection of a man (an OVR he's headed for): their read of his ratings and his age, moved by his Saturdays
// (a good game, a bad one), drawn toward the truth as the season goes, and after the combine by what he ran.
const BUZZ = new Map()
// The media's read of each rating: their error on the whole man is `miss` OVR points (up or down alike, about 5),
// each rating a little off besides. Drawn from his own seed, so it's never saved.
const MEDIA = new Map()
export function mediaOf(x) {
  if (x.b != null) return dec(x.a)
  const k = `${x.p}|${x.z}|${x.a}`
  let m = MEDIA.get(k)
  if (!m) {
    const a = dec(x.a), o = ovrV(x.p, a)
    m = fitVals(x.p, a.map((v, j) => v + g01(x.z, 40 + j) * 0.8), clamp(45, 95, o + Math.round(g01(x.z, 39) * 5.2)))
    if (MEDIA.size > 4000) MEDIA.clear()
    MEDIA.set(k, m)
  }
  return m
}
const mediaBase = x => ovrV(x.p, mediaOf(x)) + ROOM(x.ag)
export function buzzOf(F, x, t = weeksIn(F), cmb = F.sc?.cmb ?? 0) {
  if (x.b != null) return x.pk
  const key = `${F.seed}|${F.year}|${x.i}|${t}|${cmb}`
  let v = BUZZ.get(key)
  if (v != null) return v
  const base = mediaBase(x)
  let walk = 0
  for (let w = 1; w <= Math.min(t, 16); w++) walk += (h01(x.z, 500 + w) - 0.5) * 1.5
  v = base + walk + (x.pk - base) * 0.12 * Math.min(1, t / 18)
  if (cmb) {
    const T = TYPES_OF[x.p], a = dec(x.a), m = mediaOf(x)
    const phys = T.map((tt, j) => (kindOf(x.p, tt) === 'p' ? a[j] : m[j]))
    const c = combineOf(x)
    if (c && !c.dnp) v += (ovrV(x.p, phys) - ovrV(x.p, m)) * 0.6
  }
  v = r1(clamp(55, 99, v))
  if (BUZZ.size > 20000) BUZZ.clear()
  BUZZ.set(key, v)
  return v
}
// the consensus board: everyone by the media's projection
export function consensus(F, t) {
  return [...F.dc].map(x => ({ x, v: buzzOf(F, x, t) })).sort((a, b) => b.v - a.v || a.x.i - b.x.i).map(e => e.x)
}
export const rankMap = (F, t) => new Map(consensus(F, t).map((x, r) => [x.i, r + 1]))
export const projRound = rank => (rank <= 32 ? 1 : rank <= 64 ? 2 : rank <= 100 ? 3 : rank <= 136 ? 4 : rank <= 176 ? 5 : rank <= 216 ? 6 : rank <= 250 ? 7 : null)
export const projText = rank => { const r = projRound(rank); return r ? `RD ${r}` : 'UDFA' }
// who moved this week (the media's projection a week ago and now)
export function stockMoves(F, n = 6) {
  const t = weeksIn(F)
  if (t < 1) return []
  const now = rankMap(F, t), before = rankMap(F, t - 1)
  return F.dc.filter(x => x.b == null && now.get(x.i) <= 120).map(x => ({ x, d: before.get(x.i) - now.get(x.i), rank: now.get(x.i) }))
    .filter(e => Math.abs(e.d) >= 6).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, n)
}

// ── The draft order ──────────────────────────────────────────────────────────
// Non-playoff teams by record, worst first; then the playoff teams by the round they went out (wild card, divisional,
// conference), then the Super Bowl's loser and its winner. Ties: the easier schedule (opponents' win percentage)
// picks first, as the league breaks them; then a coin flip (here: the seed).
export function draftOrder(F) {
  const S = standings(F)
  const depth = s => ({ out: 0, wc: 1, div: 2, conf: 3, sb: 4, champ: 5 }[F.po ? finishOf(F, s) : 'out'] ?? 0)
  const opp = Object.fromEntries(SHORTS.map(s => [s, []]))
  for (const wk of F.sched?.weeks ?? []) for (const g of wk) { opp[g.h]?.push(g.a); opp[g.a]?.push(g.h) }
  const sos = s => { const o = opp[s]; return o.length ? o.reduce((a, t) => a + pct(S.R[t]), 0) / o.length : 0.5 }
  const flip = s => h01(strHash(`${F.seed}${F.year}`), strHash(s))
  return [...SHORTS].sort((a, b) => depth(a) - depth(b) || pct(S.R[a]) - pct(S.R[b]) || sos(a) - sos(b) || flip(a) - flip(b))
}
// a pick's number as the real draft counts it (the real draft has compensatory picks from the 3rd round on: our 4th
// round's 10th pick is about the 112th pick, so he signs a 112th pick's deal)
const REAL_START = [1, 33, 65, 103, 141, 177, 221], REAL_LEN = [32, 32, 38, 38, 36, 44, 37]
export const realNo = at => { const r = Math.floor(at / 32), k = at % 32; return REAL_START[r] + Math.floor(k * REAL_LEN[r] / 32) }
export const roundOf = at => Math.floor(at / 32) + 1
export const inRound = at => (at % 32) + 1
// The trade value chart (the one teams have used since the 1990s): No. 1 is 3,000 points, No. 32 590, No. 64 270
const CHART = [[1, 3000], [2, 2600], [3, 2200], [4, 1800], [5, 1700], [6, 1600], [7, 1500], [8, 1400], [9, 1350], [10, 1300], [12, 1200], [16, 1000], [20, 850], [24, 740], [28, 660], [32, 590], [33, 580], [40, 500], [48, 420], [56, 340], [64, 270], [72, 230], [80, 190], [96, 116], [112, 72], [128, 42], [160, 27], [192, 14], [224, 2]]
export function pickValue(at) {
  const n = at + 1
  for (let i = 1; i < CHART.length; i++) {
    const [a, va] = CHART[i - 1], [b, vb] = CHART[i]
    if (n <= b) return Math.exp(Math.log(va) + (Math.log(vb) - Math.log(va)) * (n - a) / (b - a))
  }
  return 2
}

// ── Mock drafts ──────────────────────────────────────────────────────────────
// The media's first round: the order as it stands, each team the best man on the consensus at a spot it needs.
export function needsOf(F, s) {
  const dc = depthChart(F, s)
  const out = {}
  for (const [g, n] of [['qb', 1], ['rb', 1], ['wr', 3], ['te', 1], ['ol', 5], ['edge', 2], ['dt', 2], ['lb', 3], ['cb', 2], ['s', 2]]) {
    const men = dc[g] ?? []
    // the weakest starter in the room (a line's fourth man: one weak guard is a need, not an emergency)
    const worst = men[Math.max(0, n - (n >= 5 ? 2 : 1))]?.o ?? 60
    const old = men.slice(0, n).some(p => p.ag >= 31)
    out[g] = clamp(0, 4, (78 - worst) / 3 + (men.length < n + 1 ? 1 : 0) + (old ? 0.6 : 0))
    if (g === 'qb' && (men[0]?.o ?? 0) >= 84 && men[0].ag <= 33) out[g] = 0
  }
  return out
}
const GROUP_V = { qb: 3, edge: 1.8, ot: 1.4, cb: 1, wr: 0.7, dt: 0.3, s: -0.8, lb: -1.2, og: -1.7, c: -2, te: -1.6, rb: -1.8 }
const gKey = x => (x.p === 'ol' ? (x.s === 'LT' || x.s === 'RT' ? 'ot' : x.s === 'C' ? 'c' : 'og') : groupOf(x))
const needKey = x => groupOf(x)
export function mockDraft(F, n = 32) {
  const order = draftOrder(F)
  const t = weeksIn(F)
  const pool = consensus(F, t).filter(x => x.b == null).slice(0, 90)
  const taken = new Set(), out = []
  for (let k = 0; k < n; k++) {
    const s = order[k]
    const need = needsOf(F, s)
    let best = null, bv = -1e9
    for (const x of pool) { if (taken.has(x.i)) continue; const v = buzzOf(F, x, t) + need[needKey(x)] * 0.9 + GROUP_V[gKey(x)]; if (v > bv) { bv = v; best = x } }
    if (!best) break
    taken.add(best.i)
    out.push({ at: k, s, xi: best.i })
  }
  return out
}
export const mockVersion = F => (F.dr ? 'FINAL' : `${1 + Math.floor(weeksIn(F) / 6)}.0`)

// ── Our read on a man ────────────────────────────────────────────────────────
// Each rating: known (exact), narrowed (a guess that may be a step off, ± 1), or unknown (the media's number, ± 2).
// Our grade on him is what those add up to, plus his age; his character only counts once we've sat down with him.
export function viewOf(F, x) {
  const T = TYPES_OF[x.p], a = dec(x.a), m = mediaOf(x)
  const traits = T.map((t, j) => {
    const k = x.b != null ? 2 : +x.k[j]
    const ou = h01(x.z, 300 + j), off = ou < 0.2 ? -1 : ou > 0.8 ? 1 : 0
    const v = k === 2 ? a[j] : k === 1 ? clamp(0, 11, a[j] + off) : m[j]
    const w = k === 2 ? 0 : k === 1 ? 1 : 2
    return { t, kind: kindOf(x.p, t), k, v, lo: clamp(0, 11, v - w), hi: clamp(0, 11, v + w) }
  })
  const est = ovrV(x.p, traits.map(e => e.v)), lo = ovrV(x.p, traits.map(e => e.lo)), hi = ovrV(x.p, traits.map(e => e.hi))
  const room = ROOM(x.ag), kc = x.kc || x.b != null
  const chE = kc ? CH_EFF[x.ch] : 0
  const known = traits.filter(e => e.k === 2).length, seen = traits.filter(e => e.k >= 1).length
  // (what we haven't seen ourselves we take from the consensus: the media's read as it stands now)
  const unseen = traits.filter(e => e.k === 0).length / T.length
  const lean = x.b != null ? 0 : (buzzOf(F, x) - mediaBase(x)) * unseen
  const my = Math.round(clamp(55, 99, est + room + chE + lean))
  return {
    traits, known, seen, all: T.length, now: est,
    my, lo: Math.round(clamp(55, 99, lo + room + lean + (kc ? chE : CH_EFF[0]))), hi: Math.round(clamp(55, 99, hi + room + lean + (kc ? chE : CH_EFF[2]))),
    grade: gradeOf(my), kc,
  }
}
export const rangeText = v => { const a = gradeOf(v.lo), b = gradeOf(v.hi); return a === b ? a : `${a} – ${b}` }
// how much we know of him, 0..1 (what the screens show as the scouting meter on a man)
export const knownShare = x => (x.b != null ? 1 : x.k.split('').reduce((s, c) => s + +c, 0) / (x.k.length * 2) * 0.85 + (x.kc ? 0.15 : 0))

// ── The scouting report ──────────────────────────────────────────────────────
// Written the way a scout writes: what he does well, what will get him beat, his character, where he fits.
// Only what our people have seen goes in it.
const SAY = {
  speed: ['Long speed; runs away from angles.', 'Lacks the speed to separate late in the down.'],
  'speed.dl': ['Closes on the quarterback in a hurry.', 'Doesn\'t close once he wins the corner.'],
  'speed.te': ['Stretches the seam.', 'Lacks the speed to threaten the seam.'],
  'size.qb': ['Prototype frame; sees over the line.', 'Undersized; batted balls show up on tape.'],
  'size.rb': ['Built to carry it 20 times a game.', 'Small frame; durability questions.'],
  'size.wr': ['Big target with a wide catch radius.', 'Slight build; gets rerouted by press.'],
  'size.te': ['Full-grown frame for in-line work.', 'Light for the position.'],
  'size.ol': ['Big frame with room to add more.', 'Short on mass for the position.'],
  'size.dl': ['Thick lower half; hard to move.', 'Light for where he lines up.'],
  'size.lb': ['Big enough to take on guards.', 'Undersized; gets swallowed by blocks.'],
  'size.db': ['Length to match up with big receivers.', 'Gets outmuscled by bigger receivers.'],
  arm: ['Drives the ball outside the numbers.', 'Average arm; deep outs float on him.'],
  legs: ['A real threat as a runner on designed calls.', 'Not a threat to pull it and run.'],
  processing: ['Sets protections and checks plays at the line.', 'Slow to diagnose pressure before the snap.'],
  'vision.qb': ['Gets through his progressions; finds the open man.', 'Locks onto his first read.'],
  'leadership.qb': ['Commands the huddle.', 'Quiet; not a vocal leader yet.'],
  'leadership.lb': ['Runs the defense; a green-dot candidate.', 'Not the one setting the front yet.'],
  playmaking: ['Makes plays off schedule when the pocket breaks down.', 'Rarely creates when the first look is covered.'],
  accuracy: ['Accurate at all three levels.', 'Ball placement comes and goes.'],
  'pocket-presence': ['Climbs the pocket under pressure.', 'Bails from clean pockets.'],
  burst: ['Explosive through the hole.', 'Slow to get to top speed.'],
  'strength.rb': ['Runs through arm tackles.', 'Goes down on first contact.'],
  'strength.te': ['Strong at the point of attack.', 'Gets moved off his spot as a blocker.'],
  'strength.dl': ['Resets the line of scrimmage.', 'Gets moved off the ball by double teams.'],
  balance: ['Keeps his feet through contact.', 'Goes down when he\'s hit low.'],
  elusiveness: ['Makes the first man miss in space.', 'Not much wiggle in the open field.'],
  'vision.rb': ['Patient; sees the cutback lane.', 'Misses cutbacks; runs into the pile.'],
  hands: ['Natural hands; catches it away from his body.', 'Body-catcher; drops show up on tape.'],
  'hands.db': ['Finishes the interceptions he gets to.', 'Drops the interceptions he gets to.'],
  carrying: ['Ball security is a strength.', 'Fumbles on tape; ball security is a concern.'],
  bodyControl: ['Adjusts to the ball in the air; good sideline feet.', 'Struggles to adjust to off-target throws.'],
  vertical: ['Wins above the rim on contested balls.', 'Doesn\'t play above his size in the air.'],
  routeRunning: ['Sharp, sudden route runner.', 'Rounds off his breaks.'],
  'routeRunning.te': ['Uses leverage to win in the seam.', 'Limited route tree.'],
  release: ['Beats press off the line.', 'Gets jammed by physical corners.'],
  awareness: ['Finds the soft spot in zone.', 'Drifts into coverage against zone.'],
  afterCatch: ['Dangerous after the catch.', 'Little after the catch.'],
  blocking: ['Effective in-line blocker.', 'A liability as a blocker.'],
  length: ['Long arms; keeps rushers off his frame.', 'Short arms; may have to kick inside.'],
  anchor: ['Anchors against the bull rush.', 'Gets walked back by power.'],
  passPro: ['Clean pass sets; mirrors speed rushers.', 'Oversets; gives up the inside counter.'],
  runBlock: ['Moves people in the run game.', 'Doesn\'t sustain run blocks.'],
  mobility: ['Gets to the second level; fits a zone scheme.', 'Heavy-footed on the move.'],
  blitzPickup: ['Picks up stunts and blitzes.', 'Late passing off stunts.'],
  discipline: ['Few penalties on tape.', 'Penalty-prone; the holding calls pile up.'],
  pancake: ['Finishes blocks through the whistle.', 'Doesn\'t finish blocks.'],
  getOff: ['Explosive first step.', 'Late off the ball.'],
  powerMoves: ['Long-arm and bull rush win consistently.', 'No power counter when his first move fails.'],
  finesseMoves: ['Quick hands; wins with the swim and the spin.', 'Limited pass-rush plan.'],
  playRecognition: ['Reads his keys and finds the ball.', 'Bites on play-action and misdirection.'],
  'playRecognition.db': ['Reads the quarterback and breaks early.', 'Late to read route combinations.'],
  bend: ['Bends the edge at full speed.', 'Stiff hips; rounds off his rush.'],
  blockShed: ['Sheds blocks to make the tackle.', 'Stays blocked too long.'],
  range: ['Sideline-to-sideline range.', 'Limited range outside the box.'],
  power: ['Downhill thumper; delivers the hit.', 'Absorbs contact instead of delivering it.'],
  tackling: ['Wraps up; a reliable open-field tackler.', 'Misses tackles in space.'],
  zoneInstincts: ['Instinctive in zone; undercuts throws.', 'Loses his landmarks in zone.'],
  passRush: ['Productive blitzer.', 'Little as a pass rusher.'],
  fluidity: ['Fluid hips; turns and runs without wasted steps.', 'Tight hips; struggles to turn and run.'],
  press: ['Physical in press; reroutes receivers.', 'Gets beat off the line in press.'],
  zoneIQ: ['Reads the quarterback in zone.', 'Gets lost in zone assignments.'],
  manCoverage: ['Sticky in man coverage.', 'Gives up separation in man.'],
  runSupport: ['Comes downhill and fits the run.', 'Hesitant in run support.'],
}
const say = (pos, t, good) => (SAY[`${t}.${pos}`] ?? SAY[t] ?? ['', ''])[good ? 0 : 1]
const CHAR_LINES = [
  ['Suspended for a game this season. Staff has questions about his maturity.', 'Missed time for a violation of team rules.', 'Two schools in three years; questions about his work habits.'],
  ['No off-field concerns.', 'Coaches describe a quiet, steady worker.'],
  ['Two-year captain. Coaches praise his work habits.', 'First one in the building, by every account.', 'Team captain; runs the weight room.'],
]
// NFL.com-style grade lines: what a man of our grade becomes
const BOTTOM = [[92, 'Pro Bowl talent.'], [88, 'Year 1 starter.'], [84, 'Will be a good starter within two years.'], [80, 'Good backup with starter potential.'], [75, 'Backup and special teams.'], [70, 'Chance to make a roster.'], [0, 'Priority free agent.']]
// a real man he plays like (our known ratings against the league's, shape only, men about where he's headed)
function compOf(x, v) {
  if (v.seen < 6) return null
  const pool = (realPool()[x.p] ?? []).filter(r => (!x.s || x.p === 'ol' || r.s === x.s) && Math.abs(r.o - v.my) <= 7)
  const mine = v.traits.map(e => e.v), mm = mine.reduce((a, b) => a + b, 0) / mine.length
  let best = null, bd = 1e9
  for (const r of pool) {
    const T = TYPES_OF[x.p], vals = T.map(t => r.attrs?.[t] ?? 5), rm = vals.reduce((a, b) => a + b, 0) / vals.length
    const d = vals.reduce((s, val, j) => s + (val - rm - (mine[j] - mm)) ** 2, 0) + h01(x.z, strHash(r.name)) * 0.5
    if (d < bd) { bd = d; best = r }
  }
  return best ? { name: best.name, team: best.team } : null
}
export function reportOf(F, x, v = viewOf(F, x)) {
  if (x.b != null) return { lines: [], char: null, bottom: BOTTOM.find(([g]) => v.my >= g)[1], comp: null }
  const seen = v.traits.filter(e => e.k >= 1)
  const good = seen.filter(e => e.v >= 7).sort((a, b) => b.v - a.v || b.k - a.k).slice(0, 2)
  const bad = seen.filter(e => e.v <= 4).sort((a, b) => a.v - b.v || b.k - a.k).slice(0, 1)
  const lines = [...good.map(e => ({ good: true, t: e.t, text: say(x.p, e.t, true) })), ...bad.map(e => ({ good: false, t: e.t, text: say(x.p, e.t, false) }))]
  if (!lines.length && seen.length >= 3) {
    const mid = [...seen].sort((a, b) => b.v - a.v)[0]
    lines.push({ good: true, t: mid.t, text: say(x.p, mid.t, true).replace(/\.$/, '') + ', when he\'s at his best.' })
  }
  const pool = CHAR_LINES[x.ch]
  return {
    lines,
    char: v.kc ? pool[Math.floor(h01(x.z, 77) * pool.length)] : null,
    bottom: v.seen >= 3 ? BOTTOM.find(([g]) => v.my >= g)[1] : null,
    comp: compOf(x, v),
  }
}

// ── Our board ────────────────────────────────────────────────────────────────
export function star(F, id) { F.board = F.board.includes(id) ? F.board.filter(x => x !== id) : [...F.board, id] }
export function moveOnBoard(F, id, d) {
  const i = F.board.indexOf(id), j = clamp(0, F.board.length - 1, i + d)
  if (i < 0 || i === j) return
  const b = [...F.board]; b.splice(i, 1); b.splice(j, 0, id); F.board = b
}
// LET THE SCOUTS WORK: the department spends what's banked the way a scouting director would (this week's best game
// when it has men on our board or at our needs, then film on our board's men, then the best at our needs)
export function autoScout(F) {
  if (!canScout(F)) return 0
  let used = 0
  const need = needsOf(F, F.team)
  const wanted = x => F.board.includes(x.i) || need[needKey(x)] >= 2
  const sl = slateOf(F)
  if (sl && !sl.went && scoutsLeft(F) >= 2) {
    const score = g => g.xs.reduce((s, id) => { const x = byId(F, id); return s + (x && wanted(x) ? 2 : 1) * (x && (x.sv & 4) ? 0.3 : 1) }, 0)
    const gi = sl.games.map((g, i) => [i, score(g)]).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (gi != null && attend(F, gi)) used += 2
  }
  for (const x of filmOrder(F)) { if (scoutsLeft(F) < 1) break; if (film(F, x.i)) used++ }
  return used
}
// who the department puts on tape: our board first, then our needs, then the consensus's order
function filmOrder(F) {
  const need = needsOf(F, F.team), ranked = rankMap(F)
  const wanted = x => F.board.includes(x.i) || need[needKey(x)] >= 2
  return F.dc.filter(x => x.b == null && !filmDone(x)).sort((a, b) => (F.board.includes(b.i) - F.board.includes(a.i)) || (wanted(b) - wanted(a)) || ranked.get(a.i) - ranked.get(b.i))
}
function deptFilm(F, n) {
  const order = filmOrder(F)
  for (let k = 0; k < n && order.length; k++) {
    const x = order[Math.floor(k / 2) % order.length]
    if (filmDone(x)) continue
    raise(x, ['s']); x.sv |= (x.sv & 1) ? 2 : 1
  }
}

// ── Sandbox: a build into the class ──────────────────────────────────────────
// The player's own build as a prospect (the build page's Sandbox: ADD A PROSPECT). He knows him: every rating is known.
// The media sees him as he is; the league's teams leave him for the player (he's his to take).
export function addProspect(F, b, { col = null } = {}) {
  const B = F.builds[b]
  const T = TYPES_OF[B.pos]
  const vals = T.map(t => B.build?.[t]?.val ?? 5)
  const o = ovrV(B.pos, vals)
  const sp = B.pos === 'dl' ? (B.build?.size?.subpos === 'dt' ? 'dt' : 'edge') : B.pos === 'db' ? (B.build?.size?.subpos === 's' ? 's' : 'cb') : B.pos === 'ol' ? 'LT' : undefined
  const [h0, w0] = BODY[bodyKey(B.pos, sp)]
  const x = {
    i: Math.max(0, ...F.dc.map(p => p.i)) + 1, n: B.name ?? `${POS_LABEL[B.pos]} Prospect`, p: B.pos, ...(sp && { s: sp }), ag: 21, o, pk: clamp(o, 99, o + ROOM(21)),
    col, ht: h0, wt: w0, nu: B.num ?? 0, a: enc(vals), k: '2'.repeat(T.length), kc: 1, ch: 1, z: 7 + b * 131, sv: 0, cl: 1, b,
  }
  F.dc.push(x)
  F.board = [x.i, ...F.board.filter(id => id !== x.i)]
  return x
}

// ── The draft ────────────────────────────────────────────────────────────────
// stages: pre (the final board: the last visits and pro days) → night (the picks) → done
export function openDraft(F) {
  if (!F.sc) F.sc = { b: 3, w: weeksIn(F), u: 0, att: [], cmb: 0, ivd: [], pdd: [] }
  const order = draftOrder(F)
  F.dr = { ph: 'pre', order, own: Array.from({ length: PICKS_N }, (_, k) => order[k % 32]), at: 0, picks: [], tr: [] }
  runCombine(F)
  F.stage = 'draft'
}
export function startNight(F) { if (!F.dr) return; F.dr.ph = 'night'; F.dr.fin = Object.fromEntries(F.dc.map(x => [x.i, buzzOf(F, x)])) }
export const pickTeam = (F, at = F.dr.at) => F.dr.own[at]
export const draftDone = F => !!F.dr && F.dr.at >= PICKS_N
export const myPicks = F => F.dr.own.map((s, at) => (s === F.team && at >= F.dr.at ? at : null)).filter(v => v != null)
const finalBuzz = (F, x) => F.dr?.fin?.[x.i] ?? buzzOf(F, x)
// a stamp on a man once the truth is out: the consensus had him two grades (6 points) too low, or too high
export const tagOf = (pk, bz) => (pk - bz >= 5 ? 'G' : bz - pk >= 5 ? 'B' : 'S')
export const TAG_TEXT = { G: 'GEM', B: 'BUST', S: 'SOLID' }

// how a league team rates a man: what he really is, half the media's error, its own scouts' error; what it needs;
// what the position is worth (a quarterback or a pass rusher goes earlier than a running back of the same grade)
function cpuValue(F, s, x, need, rd) {
  const seen = x.pk + (finalBuzz(F, x) - x.pk) * 0.5 + g01(strHash(s), x.z) * 1.6
  const pv = GROUP_V[gKey(x)] * (rd >= 4 ? 0.5 : 1)
  return seen + need[needKey(x)] * (rd <= 2 ? 1.1 : 1.4) + pv
}
// the player's man is taken: he goes on the roster, signs his slot's deal, and the pick goes on the board
function take(F, s, x, via = null) {
  F.dc = F.dc.filter(p => p !== x)
  const at = F.dr.at, rd = roundOf(at)
  const bz = finalBuzz(F, x)
  const p = { i: F.nid++, n: x.n, p: x.p, ...(x.s && { s: x.s }), o: x.o, ag: x.ag, pk: x.pk, rk: F.year + 1, c: x.col, dr: [rd, at + 1], a: x.a, nu: x.nu, tg: tagOf(x.pk, bz), ...(x.b != null && { b: x.b }) }
  signRookie(p, realNo(at), F.year + 1)
  if (x.b != null) { F.builds[x.b].pid = p.i; F.builds[x.b].age = x.ag; F.builds[x.b].draft = [rd, at + 1, s]; delete F.builds[x.b].prospect }
  F.teams[s].r.push(p)
  try { fixNumbers(F, s) } catch { /* (the depth chart file's numbering; a number is cosmetic) */ }
  const v = s === F.team ? viewOf(F, x) : null
  const pick = { at, s, pid: p.i, xi: x.i, n: x.n, p: x.p, ...(x.s && { sp: x.s }), col: x.col, pk: x.pk, bz: Math.round(bz), tag: p.tg, ...(v && { my: v.my, lo: v.lo, hi: v.hi, kn: Math.round(knownShare(x) * 100) }), ...(via && { via }), ...(x.b != null && { b: x.b }) }
  F.dr.picks.push(pick)
  F.dr.at++
  return pick
}
// one league team's pick (it may trade up first: another team a few picks back sends its pick and a later one)
function cpuPickOne(F) {
  const at = F.dr.at, rd = roundOf(at)
  const R = rngOf(`${F.seed}-${F.year}-dr-${at}`)
  if (rd <= 2 && R.u() < 0.06) {
    const from = F.dr.own[at]
    const up = R.int(at + 3, Math.min(PICKS_N - 1, at + 14))
    const who = F.dr.own[up]
    const later = F.dr.own.findIndex((o, k) => k >= at + 32 && k > up && o === who)
    if (who !== F.team && who !== from && later > 0 && pickValue(up) + pickValue(later) >= pickValue(at) * 0.95) {
      F.dr.own[at] = who; F.dr.own[up] = from; F.dr.own[later] = from
      F.dr.tr.push({ at, up: who, down: from, got: [up, later] })
    }
  }
  const s = F.dr.own[at]
  const need = needsOf(F, s)
  let best = null, bv = -1e9
  for (const x of F.dc) { if (x.b != null) continue; const v = cpuValue(F, s, x, need, rd); if (v > bv) { bv = v; best = x } }
  if (!best) { F.dr.at++; return null }
  return take(F, s, best)
}
// the league's teams pick until the player is on the clock (or the draft is over)
export function cpuPicks(F, max = Infinity) {
  const made = []
  while (!draftDone(F) && pickTeam(F) !== F.team && made.length < max) { const p = cpuPickOne(F); if (p) made.push(p) }
  return made
}
export function userPick(F, id) {
  if (draftDone(F) || pickTeam(F) !== F.team) return null
  const x = byId(F, id)
  return x ? take(F, F.team, x) : null
}
// AUTO: the highest man left on our board; with the board empty, our best grade at a spot we need
export function autoPick(F) {
  const left = F.board.map(id => byId(F, id)).filter(Boolean)
  let x = left[0]
  if (!x) {
    const need = needsOf(F, F.team)
    const score = y => { const v = viewOf(F, y); return v.my + need[needKey(y)] * 0.8 + GROUP_V[gKey(y)] * 0.3 }
    x = [...F.dc].sort((a, b) => score(b) - score(a))[0]
  }
  return x ? userPick(F, x.i) : null
}
// the rest of the draft on autopilot (the later rounds, when the player has seen enough)
export function simRest(F) {
  const out = []
  while (!draftDone(F)) { out.push(...cpuPicks(F)); if (!draftDone(F)) { const p = autoPick(F); if (p) out.push(p) } }
  return out
}

// ── Trades on draft night (the value chart; this year's picks only) ───────────
// TRADE UP: a team ahead of the player's next pick takes his pick and enough of his later ones to cover the
// difference, plus a little (teams want about 5% over the chart to move down)
export function tradeUpOffers(F) {
  if (draftDone(F)) return []
  const mine = myPicks(F)
  const next = mine[0]
  if (next == null || next === F.dr.at) return []
  const targets = [...new Set([F.dr.at, Math.floor((F.dr.at + next) / 2), next - 1])].filter(t => t >= F.dr.at && t < next && F.dr.own[t] !== F.team && roundOf(t) >= roundOf(next) - 1)
  const out = []
  for (const t of targets) {
    const want = pickValue(t) * 1.05 - pickValue(next)
    const rest = mine.slice(1).sort((a, b) => a - b)
    let give = null
    const one = [...rest].reverse().find(k => pickValue(k) >= want)   // the latest single pick that covers it
    if (one != null) give = [one]
    else { let sum = 0; const g = []; for (const k of rest) { if (sum >= want) break; g.push(k); sum += pickValue(k) } if (sum >= want) give = g }
    if (!give) continue
    out.push({ k: 'up', with: F.dr.own[t], get: [t], give: [next, ...give] })
  }
  return out
}
// TRADE DOWN: on the clock, teams a little further back offer their pick and a later one for this one
export function tradeDownOffers(F) {
  if (draftDone(F) || pickTeam(F) !== F.team) return []
  const at = F.dr.at, val = pickValue(at)
  const R = rngOf(`${F.seed}-${F.year}-td-${at}`)
  const seen = new Set(), out = []
  for (let t = at + 3; t < Math.min(PICKS_N, at + 24) && out.length < 3; t++) {
    const s = F.dr.own[t]
    if (s === F.team || seen.has(s)) continue
    seen.add(s)
    if (R.u() < 0.45) continue   // (not every team wants to move up)
    const later = F.dr.own.map((o, k) => (o === s && k > t ? k : null)).filter(k => k != null)
    // (the latest pick of theirs that covers the difference: moving up a few spots costs a mid-round pick, not a 2nd)
    const add = [...later].reverse().find(k => pickValue(t) + pickValue(k) >= val * 1.02) ?? null
    if (add == null) continue
    out.push({ k: 'down', with: s, get: [t, add], give: [at] })
  }
  return out
}
export function acceptTrade(F, o) {
  for (const k of o.give) if (F.dr.own[k] !== F.team) return false
  for (const k of o.get) if (F.dr.own[k] !== o.with) return false
  for (const k of o.give) F.dr.own[k] = o.with
  for (const k of o.get) F.dr.own[k] = F.team
  F.dr.tr.push({ at: F.dr.at, up: o.k === 'up' ? F.team : o.with, down: o.k === 'up' ? o.with : F.team, got: o.k === 'up' ? o.give : o.get, mine: 1 })
  return true
}
export const pickLabel = at => `RD ${roundOf(at)} · NO. ${at + 1}`

// ── After the draft ──────────────────────────────────────────────────────────
// How good our scouting was: our grade on each man we took against the truth, and the media's against it.
// The league's gems and busts, where they went.
const SCOUT_GRADE = [[1.6, 'A+'], [2.4, 'A'], [3.2, 'A-'], [4, 'B+'], [4.8, 'B'], [5.6, 'B-'], [6.5, 'C+'], [7.5, 'C'], [99, 'D']]
export function draftReview(F) {
  const picks = F.dr.picks
  const mine = picks.filter(p => p.s === F.team)
  const err = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
  const myErr = err(mine.map(p => Math.abs((p.my ?? p.bz) - p.pk)))
  const mediaErr = err(mine.map(p => Math.abs(p.bz - p.pk)))
  const gems = picks.filter(p => p.tag === 'G' && p.b == null).sort((a, b) => (b.pk - b.bz) - (a.pk - a.bz)).slice(0, 3)
  const busts = picks.filter(p => p.tag === 'B' && p.b == null).sort((a, b) => (b.bz - b.pk) - (a.bz - a.pk)).slice(0, 3)
  // the best value: the highest true grade taken after the first round
  const steal = picks.filter(p => p.at >= 32 && p.b == null).sort((a, b) => b.pk - a.pk)[0] ?? null
  const grade = myErr == null ? null : SCOUT_GRADE.find(([e]) => myErr <= e)[1]
  return { mine, myErr: myErr == null ? null : r1(myErr), mediaErr: mediaErr == null ? null : r1(mediaErr), grade, mediaGrade: mediaErr == null ? null : SCOUT_GRADE.find(([e]) => mediaErr <= e)[1], gems, busts, steal }
}
// the class goes in the history (once): our picks, what we thought, what they were
export function closeDraft(F) {
  if (!F.dr || F.dr.closed) return
  const rv = draftReview(F)
  F.dh = [...(F.dh ?? []), { y: F.year + 1, g: rv.grade, picks: rv.mine.map(p => ({ n: p.n, p: p.p, pid: p.pid, no: p.at + 1, pk: p.pk, my: p.my ?? null, tag: p.tag })) }]
  F.dr.closed = 1
}

// ── The ticker's lines (the hub's league ticker reads these) ─────────────────
export function draftNews(F, n = 4) {
  if (!F.dc?.length) return []
  const out = []
  const ranks = rankMap(F)
  for (const e of stockMoves(F, n)) {
    const x = e.x, sch = CFB_TEAM_BY_SHORT[x.col]?.school?.toUpperCase() ?? ''
    out.push({ k: 'news', tag: 'DRAFT', text: `${sch} ${spotLabel(x)} ${x.n.toUpperCase()} ${e.d > 0 ? 'UP' : 'DOWN'} TO NO. ${ranks.get(x.i)} ON THE CONSENSUS BOARD` })
  }
  return out
}
export const spotLabel = x => (x.p === 'dl' || x.p === 'db' ? (x.s ?? x.p).toUpperCase() : x.p === 'ol' ? (x.s === 'LT' || x.s === 'RT' ? 'OT' : x.s === 'C' ? 'C' : 'OG') : POS_LABEL[x.p])
// (a pick on the board keeps the team in s and the man's spot in sp)
export const pickSpot = pk => spotLabel({ p: pk.p, s: pk.sp })
export const heightText = h => `${Math.floor(h / 12)}-${h % 12}`


// ── Saving the class ─────────────────────────────────────────────────────────
// (o is read back from his ratings; the media's read is drawn from z)
const DK = ['i', 'n', 'p', 's', 'ag', 'pk', 'col', 'ht', 'wt', 'nu', 'a', 'k', 'kc', 'ch', 'z', 'sv', 'cl', 'b']
export const packClass = dc => (dc ?? []).map(x => { const a = DK.map(k => x[k] ?? null); while (a.length && a[a.length - 1] === null) a.pop(); return a })
export const unpackClass = rows => (rows ?? []).map(a => { const x = {}; DK.forEach((k, j) => { if (a[j] != null) x[k] = a[j] }); x.o = ovrV(x.p, dec(x.a)); return x })
