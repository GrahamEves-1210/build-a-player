// FRANCHISE: the depth chart. THE order every game reads: who starts, who comes in behind him, who plays the
// moment. The games (lineup(), strength, the box score) and the moments' cast all read it from here.
//
//   depthChart(F, short, { healthy })  { qb: [men in order], rb, wr, te, ol, edge, dt, lb, cb, s, k }
//   startersOf(F, short)               { qb1, rb1, wr1..3, te1, ol1..5 (LT LG C RG RT), edge1..2, dt1..2, lb1..3, cb1..2, s1..2, k1 }
//   benchOf(F, short)                  the rotation behind the starters (RB2, WR4, TE2, two more linemen, the nickel back)
//   swapInChart(F, a, b) · moveInChart(F, id, to) · setGroup(F, id, group) · resetChart(F)   (the player's team)
//   jersey(F, p) · fixNumbers(F, short)                   the number on his back
//
// The player's team keeps its chart (team.dc: group → ids); a man who joins is slotted in where his OVR puts him,
// a man who leaves drops out. The league's teams set theirs by rating every time it's read. Injured men keep their
// place on the chart but don't play: the next healthy man moves up, and a room that runs dry borrows from the room
// beside it (a safety plays corner, an end slides inside), the way a team does on Sunday.
//
// (This file reads nothing from league.js when it loads: league.js reads it back for lineup().)
import { realOf, SHORTS } from './league'

// the chart's rooms, in the order the screen shows them: [key, label, roster position, spot, starters]
export const GROUPS = [
  ['qb', 'QB', 'qb', null, 1], ['rb', 'RB', 'rb', null, 1], ['wr', 'WR', 'wr', null, 3], ['te', 'TE', 'te', null, 1], ['ol', 'OL', 'ol', null, 5],
  ['edge', 'EDGE', 'dl', 'edge', 2], ['dt', 'DT', 'dl', 'dt', 2], ['lb', 'LB', 'lb', null, 3], ['cb', 'CB', 'db', 'cb', 2], ['s', 'S', 'db', 's', 2],
  ['k', 'K', 'k', null, 1],
]
export const GROUP = Object.fromEntries(GROUPS.map(([k, label, pos, spot, n]) => [k, { k, label, pos, spot, n }]))
export const GROUP_KEYS = GROUPS.map(g => g[0])
export const OFF_GROUPS = ['qb', 'rb', 'wr', 'te', 'ol'], DEF_GROUPS = ['edge', 'dt', 'lb', 'cb', 's'], ST_GROUPS = ['k']
// how many men a room keeps behind its starters: one everywhere, none behind the kicker (no NFL team carries two)
export const backupsOf = k => (k === 'k' ? 0 : 1)
export const OL_SPOTS = ['LT', 'LG', 'C', 'RG', 'RT']
// the room a man is in
export const groupOf = p => (p.p === 'dl' ? (p.s === 'dt' ? 'dt' : 'edge') : p.p === 'db' ? (p.s === 's' ? 's' : 'cb') : p.p)
// the room that lends a man when one runs dry
const BORROW = { edge: 'dt', dt: 'edge', cb: 's', s: 'cb' }
// how deep the rotation goes behind the starters (the box score's men who play)
const ROT = { rb: 1, wr: 1, te: 1, edge: 1, dt: 1, cb: 1 }
// a starting slot's label: QB1 → QB, OL by spot, EDGE1
export const slotName = k => (k.startsWith('ol') ? OL_SPOTS[+k.slice(2) - 1] : k.replace(/\d$/, '').toUpperCase())

// ── The order ────────────────────────────────────────────────────────────────
// (a filler backup, league.js fillUp, is behind every real man in his room whatever the ratings say)
const byOvr = (a, b) => (a.fl ?? 0) - (b.fl ?? 0) || b.o - a.o || (b.b != null) - (a.b != null) || a.i - b.i
// The line goes by spot (owner, 2026-11-17: "a C spot holds an RT"): the chart's first five are the LT, LG, C, RG
// and RT, each the best man for that spot, his own spot first. A man can slide over (a guard to centre, a left tackle
// to the right side) for a few points of rating; a tackle at centre or a centre at tackle almost never.
// spotCost(spot, s): the OVR a man gives up playing `spot` when he's a `s`
const TACKLE = new Set(['LT', 'RT'])
export function spotCost(spot, s) {
  if (!s || s === spot) return s ? 0 : 5
  const t1 = TACKLE.has(spot), t2 = TACKLE.has(s)
  if (t1 && t2) return 3
  if (!t1 && !t2) return spot === 'C' || s === 'C' ? 4 : 2
  return spot === 'C' || s === 'C' ? 25 : 6
}
// the best man left for a spot (a filler only when nobody else is left)
function bestFor(spot, men) {
  let best = -1, v = -Infinity
  men.forEach((p, i) => { const x = p.o - spotCost(spot, p.s) - (p.fl ? 100 : 0); if (x > v) { v = x; best = i } })
  return best
}
// (the spots filled hardest first: the tackles and the centre, then the guards)
const FILL_ORDER = ['LT', 'C', 'RT', 'LG', 'RG']
function olOrder(men, sort = byOvr) {
  const left = [...men].sort(sort), line = {}
  // (the player's own builds first: a build lineman holds his own spot)
  for (const p of left.filter(x => x.b != null && sort !== byOvr)) { const spot = OL_SPOTS.includes(p.s) && !line[p.s] ? p.s : FILL_ORDER.find(x => !line[x]); if (spot) { line[spot] = p; left.splice(left.indexOf(p), 1) } }
  // (each spot's own man first, the best real one who plays it; then the spots nobody plays, the best fit left)
  for (const spot of FILL_ORDER) { if (line[spot]) continue; const i = left.findIndex(p => p.s === spot && !p.fl); if (i >= 0) line[spot] = left.splice(i, 1)[0] }
  for (const spot of FILL_ORDER) { if (line[spot] || !left.length) continue; line[spot] = left.splice(bestFor(spot, left), 1)[0] }
  // (then the swaps that make the line better: two starters trading spots, or a backup in for a starter; the
  // greedy pass alone can put a right guard at left guard and the left guard at right guard)
  // (the left tackle counts a little more, then the right: on a tie the better man protects the blind side)
  const val = (spot, p) => (p ? (p.o - spotCost(spot, p.s) - (p.fl ? 100 : 0)) * (spot === 'LT' ? 1.02 : spot === 'RT' ? 1.01 : 1) : -999)
  const fixed = spot => line[spot]?.b != null && sort !== byOvr
  // (the best single move each pass, until none helps: two starters trade spots, a backup comes in at a spot, or a
  // backup comes in and the man he replaces slides to another spot, pushing that one out)
  const open = a => !fixed(a) && line[a]
  for (let pass = 0; pass < 8; pass++) {
    let best = 0, move = null
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const a = OL_SPOTS[i], b = OL_SPOTS[j]
      if (!open(a) || !open(b)) continue
      const g = val(a, line[b]) + val(b, line[a]) - val(a, line[a]) - val(b, line[b])
      if (g > best) { best = g; move = () => { [line[a], line[b]] = [line[b], line[a]] } }
    }
    left.forEach((x, k) => {
      for (const a of OL_SPOTS) {
        if (!open(a)) continue
        const g = val(a, x) - val(a, line[a])
        if (g > best) { best = g; move = () => { left[k] = line[a]; line[a] = x } }
        for (const c of OL_SPOTS) {
          if (c === a || !open(c)) continue
          const g2 = val(a, x) + val(c, line[a]) - val(a, line[a]) - val(c, line[c])
          if (g2 > best) { best = g2; move = () => { const out = line[c]; line[c] = line[a]; line[a] = x; left[k] = out } }
        }
      }
    })
    if (!move) break
    move()
  }
  left.sort(sort)
  return [...OL_SPOTS.map(s => line[s]).filter(Boolean), ...left]
}
// the default order: by rating (the player's own builds first in his first chart, the job is his to lose); the line
// by spot
function ratedOrder(team, k, buildsFirst = false) {
  const men = team.r.filter(p => groupOf(p) === k)
  const sort = buildsFirst ? (a, b) => (b.b != null) - (a.b != null) || byOvr(a, b) : byOvr
  if (k === 'ol') return olOrder(men, sort)
  return [...men].sort(sort)
}
// The player's chart, kept up to date with who's on the roster: gone men out, new men in where their OVR puts them
export function chartOf(team) {
  if (!team.dc) {
    team.dc = Object.fromEntries(GROUP_KEYS.map(k => [k, ratedOrder(team, k, true).map(p => p.i)]))
    return team.dc
  }
  const byId = new Map(team.r.map(p => [p.i, p]))
  const placed = new Set()
  for (const k of GROUP_KEYS) {
    const ids = (team.dc[k] ?? []).filter(id => { const p = byId.get(id); return p && groupOf(p) === k && !placed.has(id) && placed.add(id) })
    team.dc[k] = ids
  }
  for (const p of [...team.r].sort(byOvr)) {
    if (placed.has(p.i)) continue
    const k = groupOf(p), ids = team.dc[k]
    let at = p.fl ? -1 : ids.findIndex(id => byId.get(id).fl || byId.get(id).o < p.o)
    if (at < 0) at = ids.length
    ids.splice(at, 0, p.i); placed.add(p.i)
  }
  return team.dc
}
// one team's rooms in order (team object): the player's from his chart, the league's by rating
export function chartTeam(team) {
  if (team.dc || team.mine) {
    const dc = chartOf(team), byId = new Map(team.r.map(p => [p.i, p]))
    return Object.fromEntries(GROUP_KEYS.map(k => [k, dc[k].map(id => byId.get(id))]))
  }
  return Object.fromEntries(GROUP_KEYS.map(k => [k, ratedOrder(team, k)]))
}
export function depthChart(F, short = F.team, { healthy = false } = {}) {
  const t = F.teams[short]
  if (short === F.team && !t.dc) chartOf(t)
  // (a man new to the team gets his number the first time the chart is read)
  if (t.r.some(p => p.b == null && !numHere(p, short))) fixNumbers(F, short)
  const C = chartTeam(t)
  if (healthy) for (const k of GROUP_KEYS) C[k] = C[k].filter(p => !p.in)
  return C
}

// ── Who plays ────────────────────────────────────────────────────────────────
// the starting 22 from a chart (the next healthy man up; a dry room borrows from the one beside it)
export function startersFromChart(C) {
  const used = new Set(), out = {}
  const healthy = k => C[k].filter(p => !p.in && !used.has(p.i))
  for (const [k, , , , n] of GROUPS) {
    // the line by spot: a man hurt is replaced at his own spot by the best backup for it (the others stay put)
    if (k === 'ol') {
      const bench = C.ol.slice(5).filter(p => !p.in)
      OL_SPOTS.forEach((spot, j) => {
        let p = C.ol[j] && !C.ol[j].in && !used.has(C.ol[j].i) ? C.ol[j] : null
        if (!p) { const free = bench.filter(x => !used.has(x.i)); const i = bestFor(spot, free); p = i >= 0 ? free[i] : null }
        if (p) { out[`ol${j + 1}`] = p; used.add(p.i) }
      })
      continue
    }
    for (let j = 1; j <= n; j++) {
      const p = healthy(k)[0] ?? (BORROW[k] ? healthy(BORROW[k])[GROUP[BORROW[k]].n] ?? healthy(BORROW[k]).slice(-1)[0] : null)
      if (p) { out[`${k}${j}`] = p; used.add(p.i) }
    }
  }
  return out
}
export const startersOfTeam = team => startersFromChart(chartTeam(team))
export const startersOf = (F, short = F.team) => startersOfTeam(F.teams[short])
// the men who come in behind the starters, in chart order (a filler backup isn't one: he plays when injuries make
// him a starter)
export function benchFromChart(C, L = startersFromChart(C)) {
  const on = new Set(Object.values(L).map(p => p.i)), out = []
  // real men first; a filler only takes a rotation spot nobody else can (a team's only nickel corner), never an empty slot
  for (const [k, n] of Object.entries(ROT)) { const ok = C[k].filter(p => !p.in && !on.has(p.i)); out.push(...[...ok.filter(p => !p.fl), ...ok.filter(p => p.fl)].slice(0, n)) }
  return out
}
export const benchOfTeam = (team, L) => benchFromChart(chartTeam(team), L)
export const benchOf = (F, short = F.team) => benchOfTeam(F.teams[short])
// where a man stands: { k: group, at: 0-based place on the chart, starts: slot key or null }
export function placeOf(F, short, id) {
  const C = depthChart(F, short), L = startersOf(F, short)
  for (const k of GROUP_KEYS) {
    const at = C[k].findIndex(p => p.i === id)
    if (at >= 0) return { k, at, starts: Object.entries(L).find(([, p]) => p.i === id)?.[0] ?? null }
  }
  return null
}

// ── The player changes it ────────────────────────────────────────────────────
const mineDc = F => chartOf(F.teams[F.team])
// two men trade places (in one room, or across the two rooms of a spot: an end and a tackle)
export function swapInChart(F, a, b) {
  const dc = mineDc(F), t = F.teams[F.team]
  const pa = t.r.find(p => p.i === a), pb = t.r.find(p => p.i === b)
  if (!pa || !pb || a === b) return false
  const ka = groupOf(pa), kb = groupOf(pb)
  if (ka === kb) { const L = dc[ka], i = L.indexOf(a), j = L.indexOf(b); [L[i], L[j]] = [L[j], L[i]]; return true }
  if (BORROW[ka] !== kb) return false
  const i = dc[ka].indexOf(a), j = dc[kb].indexOf(b)
  pa.s = GROUP[kb].spot; pb.s = GROUP[ka].spot
  dc[ka][i] = b; dc[kb][j] = a
  return true
}
// a man to a place in his room (0: the top)
export function moveInChart(F, id, to) {
  const dc = mineDc(F), p = F.teams[F.team].r.find(x => x.i === id)
  if (!p) return false
  const L = dc[groupOf(p)], i = L.indexOf(id)
  L.splice(i, 1); L.splice(Math.max(0, Math.min(L.length, to)), 0, id)
  return true
}
// a man to the other room of his spot (CB ↔ S, EDGE ↔ DT), at the bottom of it
export function setGroup(F, id, k) {
  const dc = mineDc(F), p = F.teams[F.team].r.find(x => x.i === id)
  const from = p && groupOf(p)
  if (!p || BORROW[from] !== k) return false
  dc[from] = dc[from].filter(x => x !== id)
  // (his drawn face stays the one he was drawn with: faces.js facePos reads fs first)
  if (p.fs == null && p.s) p.fs = p.s
  p.s = GROUP[k].spot
  dc[k].push(id)
  return true
}
// back to the order the ratings say (the line: each spot's best man, by rating within the spot)
export function resetChart(F) {
  const t = F.teams[F.team]
  t.dc = Object.fromEntries(GROUP_KEYS.map(k => [k, ratedOrder(t, k).map(p => p.i)]))
  return t.dc
}
// Camp is over (offseason.js newSeason): last year's order was set for last year's men, so the chart is set again by
// rating, the way the first one was (the player's builds first in their rooms: the job is his to lose)
export function sortChartAfterCamp(F) {
  const t = F.teams[F.team]
  t.dc = Object.fromEntries(GROUP_KEYS.map(k => [k, ratedOrder(t, k, true).map(p => p.i)]))
  return t.dc
}
// The chart's out of date (in the season: a man back from injury, a jump at camp, a trade): a healthy man rated 3 or
// more over a starter ahead of him in his room (a backup over a starter, a WR3 over the WR1). [{ k, starter, better }] (the Team screen offers the reset)
export function staleChart(F) {
  const C = depthChart(F, F.team), L = startersOf(F, F.team), out = []
  const on = new Set(Object.values(L).map(p => p.i))
  for (const [k, , , , n] of GROUPS) {
    if (k === 'k') continue
    const starters = Object.entries(L).filter(([s]) => s.replace(/\d$/, '') === k).map(([s, p]) => [s, p])
    for (const p of C[k]) {
      if (on.has(p.i) || p.in || p.fl || p.b != null) continue
      for (const [slot, st] of starters) {
        if (groupOf(st) !== k || st.b != null) continue
        const spot = k === 'ol' ? OL_SPOTS[+slot.slice(2) - 1] : null
        const gap = spot ? (p.o - spotCost(spot, p.s)) - (st.o - spotCost(spot, st.s)) : p.o - st.o
        if (gap >= 3) { out.push({ k, starter: st, better: p }); break }
      }
    }
    // (and among the starters off the line: a WR3 rated well past the WR1 ahead of him gets fewer of the throws)
    if (k !== 'ol' && !out.some(x => x.k === k)) {
      const up = C[k].filter(p => on.has(p.i) && !p.in && !p.fl)
      for (let i = 1; i < up.length; i++) { const hi = up.slice(0, i).find(x => x.b == null && up[i].b == null && up[i].o >= x.o + 3); if (hi) { out.push({ k, starter: hi, better: up[i] }); break } }
    }
    void n
  }
  return out
}

// ── Numbers ──────────────────────────────────────────────────────────────────
// the NFL's rules by spot (2021 on), the range a new man is given first
const NUM_RULE = { qb: [[1, 19], [0, 49]], rb: [[20, 39], [0, 49], [80, 89]], wr: [[10, 19], [80, 89], [0, 49]], te: [[80, 89], [40, 49]], ol: [[60, 79], [50, 59]], edge: [[90, 99], [50, 59]], dt: [[90, 99], [50, 79]], lb: [[40, 59], [0, 39]], cb: [[20, 39], [0, 19]], s: [[20, 49], [0, 19]], k: [[1, 19], [0, 49], [90, 99]] }
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
export function jersey(F, p) {
  if (!p) return null
  if (p.b != null && F.builds?.[p.b]?.num != null) return F.builds[p.b].num
  return p.nu != null ? p.nu % 100 : realOf(p.p, p.n)?.num ?? null
}
// The number and the team it's from, in one field (p.nu = number + 100 x (the team's place + 1)), so a man who joins
// is known by it with nothing more kept on every man; a number under 100 came from somewhere else (a college's, the
// data's)
const teamCode = short => 100 * (SHORTS.indexOf(short) + 1)
export const numHere = (p, short) => p.nu != null && p.nu >= 100 && p.nu - (p.nu % 100) === teamCode(short)
// every man on a team gets a number, nobody shares one. A build's is his. A man already on the team keeps the one he
// wears there (numHere: the number is marked as this team's); a man who joins (a pick, a signing, a trade) takes the number he
// wore before (his college's, his old team's, a real man's own) only when nobody here wears it and it's legal at his
// spot, and otherwise a free one in his spot's range (owner, 2026-11-17: a rookie was taking a veteran's number).
const legalAt = (g, n) => (NUM_RULE[g] ?? [[0, 99]]).some(([lo, hi]) => n >= lo && n <= hi)
export function fixNumbers(F, short) {
  const t = F.teams[short], taken = new Set()
  const here = p => p.b == null && numHere(p, short), code = teamCode(short)
  const men = [...t.r].sort((a, b) => (b.b != null) - (a.b != null) || here(b) - here(a) || (realOf(b.p, b.n)?.num != null) - (realOf(a.p, a.n)?.num != null) || b.o - a.o || a.i - b.i)
  for (const p of men) {
    const n = p.b != null ? F.builds?.[p.b]?.num : p.nu != null ? p.nu % 100 : realOf(p.p, p.n)?.num
    if (n != null && !taken.has(n) && (p.b != null || here(p) || legalAt(groupOf(p), n))) { taken.add(n); if (p.b == null) p.nu = n + code; continue }
    const rules = NUM_RULE[groupOf(p)] ?? [[1, 99]]
    let got = null
    for (const [lo, hi] of rules) {
      const span = hi - lo + 1, start = hash(`${p.n}${p.i}`) % span
      for (let k = 0; k < span && got == null; k++) { const x = lo + ((start + k) % span); if (!taken.has(x)) got = x }
      if (got != null) break
    }
    if (got == null) got = [...Array(100).keys()].find(x => !taken.has(x)) ?? 0
    taken.add(got)
    if (p.b == null) p.nu = got + code
  }
}
// A save from before numbers were kept by team: every man's number is his team's (one pass that settles any two men
// sharing one, the higher rated keeping it)
export function numbersOnLoad(F) {
  if (!F?.teams || F.nt) return F
  for (const [s, t] of Object.entries(F.teams)) {
    // (every number already on a team is that team's; two men on one number: the higher rated keeps it)
    const seen = new Set()
    for (const p of [...t.r].sort((a, b) => b.o - a.o)) {
      if (p.b != null || p.nu == null || p.nu >= 100) continue
      if (seen.has(p.nu)) continue
      seen.add(p.nu); p.nu += teamCode(s)
    }
    fixNumbers(F, s)
  }
  F.nt = 1
  return F
}
