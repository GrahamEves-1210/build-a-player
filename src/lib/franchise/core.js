// FRANCHISE: the small state helpers everything else stands on (rosters, the logs, team strength).
import { NFL_TEAMS } from '../../data/nfl-teams'
import { SLOTS, GROUPS, MIN_AT, groupOf, slotOf, clamp, r1 } from './consts'
import { lineupOf, olFit, tidyDepth, autoDepth } from './depth'
import { freeNumber } from './players'

export const TEAM_INFO = Object.fromEntries(NFL_TEAMS.map(t => [t.short, t]))
export const TEAM_SHORTS = NFL_TEAMS.map(t => t.short)
export const teamName = short => TEAM_INFO[short]?.name ?? short
export const nick = short => (TEAM_INFO[short]?.name ?? short).split(' ').slice(-1)[0]
// the city part: "Kansas City", "New York"
export const city = short => (TEAM_INFO[short]?.name ?? short).split(' ').slice(0, -1).join(' ')

// Every action hands back a new top-level object (so React sees a change) around the same league, which is
// changed in place. `flash` is the answer to the last action: null, or { ok, code, msg }.
export const touch = (F, flash = null) => ({ ...F, rev: (F.rev ?? 0) + 1, flash })
export const fail = (F, code, msg) => ({ ...F, flash: { ok: false, code, msg } })
export const ok = (F, msg = null, extra = null) => touch(F, msg || extra ? { ok: true, msg, ...extra } : null)

// ── Rosters ──────────────────────────────────────────────────────────────────
export function addPlayer(F, p) {
  p.id = F.nextId++
  F.players[p.id] = p
  return p
}
export function joinTeam(F, p, short) {
  leaveTeam(F, p)
  p.team = short
  const t = F.teams[short]
  if (!t.roster.includes(p.id)) t.roster.push(p.id)
  F.fa = F.fa.filter(id => id !== p.id)
  oneNumber(F, t, p)
  depthAfterMove(F, t)
}
// Nobody shares a number on a team. When a new man's number is taken, the one who gives way is the generated
// player (a real player keeps the number he is known by; a build's number is the user's), else the newcomer.
function oneNumber(F, t, p) {
  const others = t.roster.map(id => F.players[id]).filter(x => x && x.id !== p.id)
  const taken = new Set(others.map(x => x.num).filter(n => n != null))
  if (p.num == null) { if (!p.real) p.num = freeNumber(p, taken); return }
  if (!taken.has(p.num)) return
  const keeps = x => (x.built ? 3 : x.real ? 2 : x.draft && !x.gen ? 1 : 0)
  const holder = others.find(x => x.num === p.num)
  const out = keeps(holder) < keeps(p) ? holder : p
  if (out === holder) taken.add(p.num)
  out.num = freeNumber(out, taken)
}
// the same rule over a whole league (a new league, and a save from before the rule)
export function fixNumbers(F) {
  let n = 0
  for (const s in F.teams) {
    const P = F.teams[s].roster.map(id => F.players[id]).filter(Boolean)
    const keeps = x => (x.built ? 3 : x.real ? 2 : x.draft && !x.gen ? 1 : 0)
    const seen = new Map()
    for (const p of [...P].sort((a, b) => keeps(b) - keeps(a) || a.id - b.id)) {
      if (p.num == null) { if (p.real) continue; p.num = -1 }
      if (!seen.has(p.num) && p.num >= 0) { seen.set(p.num, p); continue }
      p.num = freeNumber(p, new Set(P.filter(x => x !== p).map(x => x.num).filter(v => v != null && v >= 0)))
      seen.set(p.num, p); n++
    }
  }
  return n
}
export function leaveTeam(F, p) {
  if (!p.team) return
  const t = F.teams[p.team]
  if (t) { t.roster = t.roster.filter(id => id !== p.id); depthAfterMove(F, t) }
  p.team = null
}
export function toFreeAgency(F, p) {
  leaveTeam(F, p)
  if (!F.fa.includes(p.id)) F.fa.push(p.id)
  p.con = null; p.hold = undefined; p.want = undefined; p.block = undefined
}
// (the staff re-sets the chart unless the user has taken it over; a hand-set chart is only kept legal)
export function depthAfterMove(F, t) {
  if (t.short === F.team && !F.settings.autoDepth) tidyDepth(F, t)
  else autoDepth(F, t)
}
export const rosterOf = (F, short) => F.teams[short].roster.map(id => F.players[id]).filter(Boolean)
export const activeCount = (F, t) => t.roster.reduce((n, id) => n + (F.players[id]?.inj?.ir ? 0 : 1), 0)
export function groupCounts(F, t, healthyOnly = false) {
  const c = Object.fromEntries(GROUPS.map(g => [g, 0]))
  for (const id of t.roster) { const p = F.players[id]; if (!p) continue; if (healthyOnly && p.inj && p.inj.wk > 0) continue; c[groupOf(p)]++ }
  return c
}
export function rosterProblems(F, t, max) {
  const out = [], c = groupCounts(F, t), n = activeCount(F, t)
  for (const g of GROUPS) if (c[g] < MIN_AT[g]) out.push(`${t.short} has ${c[g]} ${g} (needs ${MIN_AT[g]})`)
  if (n > max) out.push(`${t.short} carries ${n} (limit ${max})`)
  return out
}

// ── The logs ─────────────────────────────────────────────────────────────────
// news: { id, y, w, kind, head, body?, team?, pid? }   kinds: game award injury trade signing draft owner league milestone staff
export function addNews(F, kind, head, extra = {}) {
  F.news.unshift({ id: F.newsId = (F.newsId ?? 0) + 1, y: F.year, w: F.phase === 'offseason' ? 0 : F.week, kind, head, ...extra })
  if (F.news.length > 90) F.news.length = 90
}
// transactions: { id, y, w, type, team, text, pid? }   types: sign release trade draft ir activate extend tag retire hire fire
export function addTx(F, type, team, text, pid = null) {
  F.tx.unshift({ id: F.txId = (F.txId ?? 0) + 1, y: F.year, w: F.phase === 'offseason' ? 0 : F.week, type, team, text, ...(pid != null && { pid }) })
  if (F.tx.length > 240) F.tx.length = 240
}

// ── Team strength ────────────────────────────────────────────────────────────
// What each starter is worth to the unit, on the OVR scale (the weights add to 1 a side). The quarterback is
// most of an offense; the rush and the corners most of a defense.
const W_OFF = { QB: 0.34, RB: 0.07, WR: [0.11, 0.08, 0.05], TE: 0.06, OL: 0.058 }
const W_DEF = { EDGE: [0.13, 0.1], DT: [0.09, 0.07], LB: [0.08, 0.07, 0.05], CB: [0.12, 0.09], S: [0.08, 0.07], NB: 0.05 }
const REPL = 62
export function teamRating(F, t) {
  const L = lineupOf(F, t)
  const o = (p, fit = 1) => (p ? p.ovr * fit : REPL)
  let off = o(L.QB[0]) * W_OFF.QB + o(L.RB[0]) * W_OFF.RB + o(L.TE[0]) * W_OFF.TE
  W_OFF.WR.forEach((w, i) => { off += o(L.WR[i]) * w })
  for (const x of L.OL) off += o(x.p, x.p ? olFit(x.p.sub, x.spot) : 1) * W_OFF.OL
  let def = o(L.CB[2] ?? L.S[2]) * W_DEF.NB
  for (const g of ['EDGE', 'DT', 'LB', 'CB', 'S']) W_DEF[g].forEach((w, i) => { def += o(L[g][i]) * w })
  const k = o(L.K[0])
  return { off: r1(off), def: r1(def), ovr: r1(off * 0.52 + def * 0.44 + k * 0.04) }
}
// 1-32 ranks of anything: rankOf(values by short, higher is better) → { short: rank }
export function ranks(vals, lowIsBest = false) {
  const order = Object.keys(vals).sort((a, b) => (lowIsBest ? vals[a] - vals[b] : vals[b] - vals[a]) || (a < b ? -1 : 1))
  return Object.fromEntries(order.map((s, i) => [s, i + 1]))
}
export const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
export const pct = (w, l, t = 0) => (w + l + t ? (w + t / 2) / (w + l + t) : 0)
export const recText = r => `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`
export { slotOf, SLOTS, clamp }
