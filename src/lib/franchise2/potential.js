// FRANCHISE: potential, the hidden half of every man (and every coach).
//
// A PLAYER'S POTENTIAL is pk, "the OVR he's headed for" (league.js): every active man has one (real men, generated
// men, drafted rookies, the player's builds), kept for his whole career. It is never shown as a number. The screens
// show what a scout would say (scoutRead): a ceiling ("PRO BOWL CEILING") and where he is on the road ("STILL
// DEVELOPING", "NEAR HIS CEILING", "IN HIS PRIME", "PAST HIS PEAK"). Our own men are read closely (the coaches see them every day); a man
// on another team or on the market through a wider lens, and a late bloomer the draft missed (hb) only by his own
// team. A draft prospect's read is the scouting department's (draft.js viewOf), on the same scale.
//
// A YEAR OF GROWTH (growthOf, every offseason, aging.js):
//   age      each position has its own curve: backs peak first and fall fastest, quarterbacks last and slowest,
//            linemen grow steadily and hold the longest (CURVE, FALL)
//   ceiling  a young man grows the rest of the way to pk over the years he has left to grow, never far past it
//   playing time  starters grow faster than men who only practise (pt: 1 a starter, less a part-timer)
//   production    his season against what a man of his rating at his spot does (prodScores): a good year adds,
//                 a bad one costs; a backup who plays well when he gets the snaps can show he's more than a
//                 backup (his ceiling moves up): the few unknowns who break out each year
//   coaches  the head coach's and his coordinator's talent development, the front office (aging.js)
//   luck     a little of it every year
// Past his prime the ceiling is where he is: pk follows him down.
//
// A COACH'S POTENTIAL is cx (0-11, hidden): the highest any of his five ratings can climb. A young coach under it
// learns a little every year; a side that ranks near the top lifts its play-caller (up to cx), one near the bottom
// costs him; a winning head coach's culture grows; past 63 the ratings slip. The player's own head coach too.
import { SHORTS } from './league'
import { leagueStats } from './stats'
import { records } from './standings'
import { clamp } from './rng'

// ── Age curves ───────────────────────────────────────────────────────────────
// [growing until, prime until, the age most are gone by]
// (a kicker grows into his late 20s and kicks into his late 30s: Vinatieri, Tucker, Gostkowski, Prater)
export const CURVE = { qb: [27, 33, 38], rb: [24, 27, 31], wr: [25, 29, 33], te: [26, 30, 34], ol: [26, 32, 35], dl: [25, 30, 33], lb: [25, 29, 32], db: [24, 29, 32], k: [29, 35, 40] }
// the fall past his prime: [the first year's OVR, more each year after]
const FALL = { qb: [1.1, 0.6], rb: [2.2, 1.1], wr: [1.5, 0.8], te: [1.4, 0.7], ol: [1.2, 0.6], dl: [1.4, 0.7], lb: [1.5, 0.8], db: [1.6, 0.85], k: [0.8, 0.45] }
const curveOf = p => CURVE[p.p] ?? [26, 29, 33]

// ── Production ───────────────────────────────────────────────────────────────
// a season's work at each spot, a game (the box score's keys: stats.js)
const g = (t, k) => t?.[k] ?? 0
const WORK = {
  qb: t => g(t, 'py') + 20 * g(t, 'ptd') - 45 * g(t, 'int') + g(t, 'ry') + 20 * g(t, 'rtd'),
  rb: t => g(t, 'ry') + g(t, 'ryd') + 20 * (g(t, 'rtd') + g(t, 'rctd')),
  wr: t => g(t, 'ryd') + 20 * g(t, 'rctd') + 2 * g(t, 'rc'),
  te: t => g(t, 'ryd') + 20 * g(t, 'rctd') + 2 * g(t, 'rc'),
  ol: t => 3 * g(t, 'pnk') - 12 * g(t, 'sa'),
  dl: t => 25 * g(t, 'sck') + 8 * g(t, 'tfl') + 2 * g(t, 'tk'),
  lb: t => 2 * g(t, 'tk') + 25 * g(t, 'sck') + 30 * g(t, 'dint') + 8 * g(t, 'tfl'),
  db: t => 30 * g(t, 'dint') + 8 * g(t, 'pbu') + 2 * g(t, 'tk'),
  k: t => 9 * g(t, 'fgm') - 18 * (g(t, 'fga') - g(t, 'fgm')) + 6 * g(t, 'm50') + 2 * g(t, 'xpm') - 8 * (g(t, 'xpa') - g(t, 'xpm')),
}
// Every man's season against the league's men at his spot with his rating (-2..2: 0 is what his rating says he'd do;
// a short season counts for less). { [id]: { z, gp } }
export function prodScores(F, tot = leagueStats(F)) {
  const out = {}
  const by = {}
  for (const s of SHORTS) for (const p of F.teams[s].r) {
    const t = tot[String(p.i)]
    if (!t?.gp || t.gp < 4 || !WORK[p.p]) continue
    ;(by[p.p] ??= []).push([p, WORK[p.p](t) / t.gp, t.gp])
  }
  for (const rows of Object.values(by)) {
    if (rows.length < 6) continue
    const n = rows.length, mo = rows.reduce((a, r) => a + r[0].o, 0) / n, mr = rows.reduce((a, r) => a + r[1], 0) / n
    const cov = rows.reduce((a, r) => a + (r[0].o - mo) * (r[1] - mr), 0), vo = rows.reduce((a, r) => a + (r[0].o - mo) ** 2, 0) || 1
    const b = cov / vo
    const res = rows.map(r => r[1] - (mr + b * (r[0].o - mo)))
    const sd = Math.sqrt(res.reduce((a, x) => a + x * x, 0) / n) || 1
    rows.forEach((r, j) => { out[r[0].i] = { z: clamp(-2, 2, res[j] / sd) * Math.min(1, r[2] / 12), gp: r[2] } })
  }
  return out
}
// the share of the season he played: a starter 1, a man in the rotation by his games, a backup who never got on 0
export const playTime = (starter, gp = 0) => (starter ? 1 : clamp(0, 0.7, (gp / 17) * 0.7))

// ── A year of growth ─────────────────────────────────────────────────────────
// ctx: { pt (playing time 0-1), prod (production -2..2), dev (the coaches' and the front office's OVR a year) }
export function growthOf(p, R, { pt = 0, prod = 0, dev = 0 } = {}) {
  const [grow, prime] = curveOf(p)
  const pk = Math.max(p.o, p.pk ?? p.o)
  // a backup who played well when he got the snaps: there's more there than a backup (his ceiling moves up)
  if (p.ag >= 23 && p.ag <= prime - 1 && p.o < 82 && prod >= 1 && pt >= 0.25 && R.u() < (pt < 1 ? 0.4 : 0.2)) p.pk = pk + Math.round(4 + R.u() * 5)
  const gap = Math.max(0, (p.pk ?? pk) - p.o)
  let d
  if (p.ag <= grow) {
    // a share of the rest of the way to his ceiling, more the fewer years he has left to grow (a wide spread: some
    // boom early); what's left after the last of them comes in his prime, by playing. (A late bloomer, the one the
    // draft missed (hb), gets there in two or three years once he's in the building.)
    const left = Math.max(1, grow + 1 - p.ag)
    const share = p.hb ? 0.5 : 1 / (left + 0.35)
    d = gap * share * (0.55 + 0.8 * R.u()) * (0.8 + 0.3 * pt) + dev + prod * 0.5 + R.n() * 0.85
  } else if (p.ag <= prime) {
    // in his prime: what's left of his ceiling comes when he plays and produces; else he holds, a point either way
    const f = gap > 0 ? clamp(0, 0.85, 0.15 + 0.35 * pt + 0.25 * Math.max(0, prod)) * (0.5 + R.u()) : 0
    d = gap * f + prod * 0.45 + R.n() * 0.6
  } else {
    // past it: a little more each year; a man still producing slips slower
    const [a, b] = FALL[p.p] ?? [1.4, 0.7]
    d = -(a + b * (p.ag - prime - 1)) * (0.55 + 0.9 * R.u()) + clamp(-0.5, 2, prod) * 0.45 + R.n() * 0.4
  }
  // (nobody passes his ceiling while he's still on the way up; nobody jumps more than 8 in a year)
  if (p.ag <= prime) d = Math.min(d, Math.max(0, (p.pk ?? p.o) - p.o))
  return Math.round(Math.min(8, d))
}
// after the year: a man past his ceiling raised it; past his prime his ceiling is where he is
export function settlePk(p) {
  if (p.o > (p.pk ?? 0)) p.pk = p.o
  if (p.ag > curveOf(p)[1]) p.pk = p.o
}

// ── What the scouts say ──────────────────────────────────────────────────────
// (a stable -1..1 per man, so a read doesn't change every time it's looked at)
const h01 = (a, b) => { let h = Math.imul((a | 0) ^ 0x5bd1e995, 0x9E3779B1) ^ Math.imul((b | 0) + 0x7F4A7C15, 0x85EBCA77); h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; return (h >>> 0) / 4294967296 }
// the ceiling as scouts put it
// (the league's starters average about 82: a starter's ceiling is 81 and up, a Pro Bowl one 91)
const CEIL = [[95, 'ALL-PRO'], [91, 'PRO BOWL'], [86, 'QUALITY STARTER'], [81, 'STARTER'], [76, 'SPOT STARTER'], [70, 'BACKUP'], [0, 'DEPTH']]
// (a kicker: a team carries one, so the scouts' words are a job or a camp leg, never a backup)
const K_CEIL = [[95, 'ALL-PRO'], [91, 'PRO BOWL'], [85, 'QUALITY STARTER'], [78, 'STARTER'], [0, 'CAMP LEG']]
export const ceilWord = (v, pos = null) => (pos === 'k' ? K_CEIL : CEIL).find(([x]) => v >= x)[1]
// Our read of a man: { ceil: 'PRO BOWL', stage: 'STILL DEVELOPING' | 'NEAR HIS CEILING' | 'IN HIS PRIME' | 'PAST HIS PEAK', line } (never a
// number). own: he's on our roster (the coaches see him every day: a closer read, and a late bloomer is known)
export function scoutRead(p, own = false) {
  if (!p) return null
  const [grow, prime] = curveOf(p)
  const truth = Math.max(p.o, (p.pk ?? p.o) - (own ? 0 : p.hb ?? 0))
  const read = truth + (h01(p.i, 41) - 0.5) * (own ? 2 : 5)
  const room = read - p.o
  const stage = p.ag > prime ? 'PAST HIS PEAK' : room >= 2.5 && p.ag < prime ? 'STILL DEVELOPING' : p.ag <= grow ? 'NEAR HIS CEILING' : 'IN HIS PRIME'
  const ceil = ceilWord(stage === 'STILL DEVELOPING' ? read : Math.max(p.o, Math.min(read, p.o + 2)), p.p)
  return { ceil, stage, line: stage === 'PAST HIS PEAK' ? stage : ceil === 'DEPTH' ? 'DEPTH PLAYER' : ceil === 'CAMP LEG' ? 'CAMP LEG' : `${ceil} CEILING` }
}

// ── Coaches ──────────────────────────────────────────────────────────────────
// his ceiling: the best of his five now, and room above it for a young man (a stable roll of his own)
export function coachCeil(c) {
  if (c.cx != null) return c.cx
  const top = Math.max(...c.r)
  const young = clamp(0, 1, (54 - (c.ag ?? 50)) / 18)
  const h = h01(c.i ?? 7, 97)
  c.cx = clamp(top, 11, Math.round(top + ((c.ag ?? 50) < 60 ? 1 : 0) + young * 4 * h * h))
  return c.cx
}
// his side's rank (1 the best of 32) moves the man who called it; j his rating's index
export function callerYear(c, j, rk, R) {
  const cx = coachCeil(c)
  if (rk <= 5 && c.r[j] < cx && R.u() < (c.r[j] >= 8 ? 0.25 : 0.35)) c.r[j]++
  else if (rk >= 26 && R.u() < (c.r[j] >= 6 ? 0.4 : 0.25)) c.r[j] = Math.max(1, c.r[j] - 1)
}
// a head coach's culture: a winner's grows (to his ceiling), a 4-win team's slips
export function cultureYear(c, w, R) {
  const cx = coachCeil(c)
  if (w >= 12 && c.r[3] < cx && R.u() < 0.3) c.r[3]++
  else if (w <= 4 && R.u() < 0.25) c.r[3] = Math.max(1, c.r[3] - 1)
}
// a year older (call after c.ag++): a young coach under his ceiling learns (his side's play-calling, teaching);
// past 63 a rating slips
export function coachAge(c, R) {
  const cx = coachCeil(c)
  const side = c.sd === 'def' ? 2 : 1
  if (c.ag <= 50) {
    const room = [side, 0].filter(j => c.r[j] < cx)
    if (room.length && R.u() < 0.1 + Math.max(0, cx - Math.max(...c.r)) * 0.05) { const j = room[Math.floor(R.u() * room.length)]; c.r[j]++ }
  }
  if (c.ag >= 63 && R.u() < 0.2 + (c.ag - 63) * 0.03) { const j = Math.floor(R.u() * 5); c.r[j] = Math.max(1, c.r[j] - 1) }
}
// The player's own head coach, the same rules: the side(s) he calls by where they ranked, his culture by the wins,
// his age. Returns the changes [{ t, from, to }] for the camp report.
const KEYS = ['talentDev', 'offPlaycalling', 'defPlaycalling', 'culture', 'situational']
export function myCoachYear(F, R) {
  const C = F.coach
  if (!C?.r || typeof C.r !== 'object') return []
  const was = { ...C.r }
  const c = { i: 1, n: C.name, r: KEYS.map(k => clamp(0, 11, Math.round(C.r[k] ?? 5))), ag: C.face?.ag != null ? C.face.ag + Math.max(0, F.year - (C.face.y ?? F.year)) : 50, cx: C.cx, sd: (C.r.offPlaycalling ?? 5) >= (C.r.defPlaycalling ?? 5) ? 'off' : 'def' }
  if (c.cx == null) c.cx = clamp(Math.max(...c.r), 11, Math.max(...c.r) + 1)
  const recs = records(F)
  const rank = key => 1 + SHORTS.filter(s => (key === 'pf' ? recs[s].pf > recs[F.team].pf : recs[s].pa < recs[F.team].pa)).length
  const T = F.staff?.[F.team]
  if (T?.call?.off === 'hc') callerYear(c, 1, rank('pf'), R)
  if (T?.call?.def === 'hc') callerYear(c, 2, rank('pa'), R)
  cultureYear(c, recs[F.team].w, R)
  coachAge(c, R)
  C.cx = c.cx
  const out = []
  KEYS.forEach((k, j) => { if (c.r[j] !== Math.round(was[k] ?? 5)) { out.push({ t: k, from: Math.round(was[k] ?? 5), to: c.r[j] }); C.r = { ...C.r, [k]: c.r[j] } } })
  return out
}

// ── Saves ────────────────────────────────────────────────────────────────────
// an older save: every man gets a ceiling (a veteran's is where he is: older saves dropped it past his prime)
export function fillPotential(F) {
  for (const s of Object.keys(F.teams ?? {})) for (const p of F.teams[s].r) if (p.pk == null) p.pk = p.o
  for (const p of F.fa ?? []) if (p.pk == null) p.pk = p.o
}
