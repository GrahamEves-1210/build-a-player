// FRANCHISE: the depth chart. THE order every game reads: who starts, who comes in behind him, who plays the
// moment. The games (lineup(), strength, the box score) and the moments' cast all read it from here.
//
//   depthChart(F, short, { healthy })  { qb: [men in order], rb, wr, te, ol, edge, dt, lb, cb, s }
//   startersOf(F, short)               { qb1, rb1, wr1..3, te1, ol1..5 (LT LG C RG RT), edge1..2, dt1..2, lb1..3, cb1..2, s1..2 }
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
import { realOf } from './league'

// the chart's rooms, in the order the screen shows them: [key, label, roster position, spot, starters]
export const GROUPS = [
  ['qb', 'QB', 'qb', null, 1], ['rb', 'RB', 'rb', null, 1], ['wr', 'WR', 'wr', null, 3], ['te', 'TE', 'te', null, 1], ['ol', 'OL', 'ol', null, 5],
  ['edge', 'EDGE', 'dl', 'edge', 2], ['dt', 'DT', 'dl', 'dt', 2], ['lb', 'LB', 'lb', null, 3], ['cb', 'CB', 'db', 'cb', 2], ['s', 'S', 'db', 's', 2],
]
export const GROUP = Object.fromEntries(GROUPS.map(([k, label, pos, spot, n]) => [k, { k, label, pos, spot, n }]))
export const GROUP_KEYS = GROUPS.map(g => g[0])
export const OFF_GROUPS = ['qb', 'rb', 'wr', 'te', 'ol'], DEF_GROUPS = ['edge', 'dt', 'lb', 'cb', 's']
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
// the line by rating, then its five starters stood at their own spots, left tackle to right tackle
function olOrder(men) {
  const all = [...men].sort(byOvr), five = all.slice(0, 5), rest = all.slice(5)
  const line = OL_SPOTS.map(spot => { const i = five.findIndex(p => p.s === spot); return i >= 0 ? five.splice(i, 1)[0] : null })
  return [...line.map(p => p ?? five.shift()).filter(Boolean), ...rest]
}
// the default order: by rating (the player's own builds first in his first chart, the job is his to lose)
function ratedOrder(team, k, buildsFirst = false) {
  const men = team.r.filter(p => groupOf(p) === k)
  const sort = buildsFirst ? (a, b) => (b.b != null) - (a.b != null) || byOvr(a, b) : byOvr
  if (k === 'ol' && !buildsFirst) return olOrder(men)
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
  if (t.r.some(p => p.b == null && p.nu == null)) fixNumbers(F, short)
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
  for (const [k, n] of Object.entries(ROT)) out.push(...C[k].filter(p => !p.in && !p.fl && !on.has(p.i)).slice(0, n))
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
// back to the order the ratings say
export function resetChart(F) {
  const t = F.teams[F.team]
  t.dc = Object.fromEntries(GROUP_KEYS.map(k => [k, ratedOrder(t, k).map(p => p.i)]))
  return t.dc
}

// ── Numbers ──────────────────────────────────────────────────────────────────
// the NFL's rules by spot (2021 on), the range a new man is given first
const NUM_RULE = { qb: [[1, 19], [0, 49]], rb: [[20, 39], [0, 49], [80, 89]], wr: [[10, 19], [80, 89], [0, 49]], te: [[80, 89], [40, 49]], ol: [[60, 79], [50, 59]], edge: [[90, 99], [50, 59]], dt: [[90, 99], [50, 79]], lb: [[40, 59], [0, 39]], cb: [[20, 39], [0, 19]], s: [[20, 49], [0, 19]] }
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
export function jersey(F, p) {
  if (!p) return null
  if (p.b != null && F.builds?.[p.b]?.num != null) return F.builds[p.b].num
  return p.nu ?? realOf(p.p, p.n)?.num ?? null
}
// every man on a team gets a number, nobody shares one (a build's is his; a real man keeps his own when it's free)
export function fixNumbers(F, short) {
  const t = F.teams[short], taken = new Set()
  const men = [...t.r].sort((a, b) => (b.b != null) - (a.b != null) || (realOf(b.p, b.n)?.num != null) - (realOf(a.p, a.n)?.num != null) || b.o - a.o || a.i - b.i)
  for (const p of men) {
    let n = p.b != null ? F.builds?.[p.b]?.num : p.nu ?? realOf(p.p, p.n)?.num
    if (n != null && !taken.has(n)) { taken.add(n); if (p.b == null && p.nu !== n) p.nu = n; continue }
    const rules = NUM_RULE[groupOf(p)] ?? [[1, 99]]
    let got = null
    for (const [lo, hi] of rules) {
      const span = hi - lo + 1, start = hash(`${p.n}${p.i}`) % span
      for (let k = 0; k < span && got == null; k++) { const x = lo + ((start + k) % span); if (!taken.has(x)) got = x }
      if (got != null) break
    }
    if (got == null) got = [...Array(100).keys()].find(x => !taken.has(x)) ?? 0
    taken.add(got)
    if (p.b == null) p.nu = got
  }
}
