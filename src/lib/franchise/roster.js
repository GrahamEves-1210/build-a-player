// FRANCHISE: roster moves. Signing, releasing, injured reserve, and the staff's upkeep that keeps every team
// able to field a legal lineup every week (the CPU's teams always; the user's when autoRoster is on).
import { ROSTER_MAX, ROSTER_MIN, CAMP_MAX, MIN_AT, TARGET_AT, GROUPS, MIN_SALARY, VET_MIN, clamp, r2, groupOf, slotOf } from './consts'
import { addTx, joinTeam, toFreeAgency, activeCount, groupCounts, teamName, depthAfterMove } from './core'
import { payroll, cutCost, marketValue } from './money'
import { topUpFreeAgents } from './league'

export const rosterLimit = F => (F.phase === 'offseason' ? CAMP_MAX : ROSTER_MAX)
export const minDeal = p => ({ yrs: 1, sal: p.exp >= 3 ? VET_MIN : MIN_SALARY, guar: 0, rookie: 0, rd: null, opt: 0, tag: false })

// Cutting a man: what is left of his guarantee stays on the books (this year, the rest next year)
export function release(F, p, { quiet = false } = {}) {
  const short = p.team
  if (!short) return
  const t = F.teams[short], c = cutCost(p)
  t.dead = r2((t.dead ?? 0) + c.deadNow); t.deadNext = r2((t.deadNext ?? 0) + c.deadNext)
  if (!quiet) addTx(F, 'release', short, `${teamName(short)} released ${slotOf(p)} ${p.name}.`, p.id)
  toFreeAgency(F, p)
  p.mood = clamp(p.mood - 4, 5, 95)
}
export function sign(F, p, short, con, { quiet = false, word = 'signed' } = {}) {
  p.con = { ...con }
  joinTeam(F, p, short)
  p.block = undefined; p.want = undefined; p.hold = undefined
  if (!quiet) addTx(F, 'sign', short, `${teamName(short)} ${word} ${slotOf(p)} ${p.name}${con.sal > 2 ? ` (${con.yrs} year${con.yrs > 1 ? 's' : ''}, $${con.sal.toFixed(1)}M a year)` : ''}.`, p.id)
}
// A restructure: part of this season's cap hit is moved to next year. It is a loan against next year's cap
// (t.relief comes off this year's payroll, the same amount is dead money next year), so it has a limit: a team
// can carry at most 12% of the cap into next year this way.
export const reliefRoom = (F, t) => r2(Math.max(0, F.cap * 0.12 - (t.deadNext ?? 0)))
export function restructure(F, t, amount) {
  const x = r2(Math.min(amount, reliefRoom(F, t)))
  if (x <= 0) return 0
  t.relief = r2((t.relief ?? 0) + x); t.deadNext = r2((t.deadNext ?? 0) + x)
  return x
}
// A team over the cap gets under it, the way a front office does: first the men paid well over what they are
// worth go, then money is pushed into next year (to the limit), then the worst deals left are cut until it fits.
// A build is never cut for the cap; if only builds are left the limit on restructures gives way.
// Returns what was done, for the user's own team's log.
export function capFix(F, t) {
  const did = []
  if (!F.settings.cap) return did
  const over = () => r2(payroll(F, t) - F.cap)
  const cut = (minOver) => {
    // (in season a team has to dress a roster: the cap does not take it under the minimum; what is left is carried)
    if (F.phase !== 'offseason' && activeCount(F, t) <= ROSTER_MIN) return null
    const c = groupCounts(F, t)
    return t.roster.map(id => F.players[id]).filter(p => p && p.con && !p.built && !p.con.tag && p.con.sal > 2.5 && c[groupOf(p)] > MIN_AT[groupOf(p)] && cutCost(p).saves > 0.5 && p.con.sal - marketValue(p, F.cap) > minOver)
      .sort((a, b) => (b.con.sal - marketValue(b, F.cap)) - (a.con.sal - marketValue(a, F.cap)) || a.id - b.id)[0]
  }
  for (let guard = 0; guard < 10 && over() > 0.001; guard++) { const p = cut(1.2); if (!p) break; release(F, p); did.push(`Released ${slotOf(p)} ${p.name} for cap room`) }
  if (over() > 0.001) { const x = restructure(F, t, over()); if (x > 0) { did.push(`Restructured contracts to move $${x.toFixed(1)}M into next year`); if (t.short === F.team) addTx(F, 'extend', t.short, `${teamName(t.short)} restructured contracts, moving $${x.toFixed(1)}M of cap charges into next season.`) } }
  for (let guard = 0; guard < 30 && over() > 0.001; guard++) { const p = cut(-1e9); if (!p) break; release(F, p); did.push(`Released ${slotOf(p)} ${p.name} for cap room`) }
  // (nothing left to cut but the GM's own builds: the rest is carried, whatever the limit says)
  if (over() > 0.001) { const x = over(); t.relief = r2((t.relief ?? 0) + x); t.deadNext = r2((t.deadNext ?? 0) + x) }
  return did
}
export const fitUnderCap = capFix
// the best street free agent at a group (never a man asking real money: those sign in free agency)
function bestStreet(F, group, R) {
  let best = null
  // (a younger man a point behind is the better signing)
  const v = p => p.ovr - Math.max(0, p.age - 26) * 0.8
  for (const id of F.fa) { const p = F.players[id]; if (!p || groupOf(p) !== group || (p.inj && p.inj.wk > 0)) continue; if (!best || v(p) > v(best)) best = p }
  if (!best) { topUpFreeAgents(F, R, F.fa.length + 16); for (const id of F.fa) { const p = F.players[id]; if (p && groupOf(p) === group && (!best || p.ovr > best.ovr)) best = p } }
  return best
}
// who goes when the roster is one too many: the worst healthy man at the group furthest over what it needs,
// never a build, never a man who starts
function cutCandidate(F, t, keep = null) {
  const c = groupCounts(F, t), start = new Set()
  const d = t.depth ?? {}
  for (const k in d) (d[k] ?? []).slice(0, k === 'WR' || k === 'LB' ? 3 : k === 'EDGE' || k === 'DT' || k === 'CB' || k === 'S' ? 2 : 1).forEach(id => start.add(id))
  let best = null, bestScore = -1e9
  for (const id of t.roster) {
    const p = F.players[id]
    if (!p || p.built || p.inj?.ir || p === keep) continue
    const g = groupOf(p), spare = c[g] - MIN_AT[g]
    if (spare <= 0) continue
    const score = (c[g] - TARGET_AT[g]) * 6 - p.ovr - (start.has(id) ? 40 : 0) - (p.dev ?? 0) * 3 - (p.age <= 23 ? 5 : p.age <= 25 ? 2.5 : p.age >= 31 ? -5 : p.age >= 29 ? -2 : 0) - (p.rk && p.draft ? 8 : 0) + (p.con?.sal > 3 ? -6 : 0)
    if (score > bestScore) { bestScore = score; best = p }
  }
  return best
}
// healthy bodies a team needs to dress a full lineup with a man behind it
const DRESS = { QB: 2, RB: 2, WR: 4, TE: 2, OL: 6, EDGE: 3, DT: 3, LB: 4, CB: 3, S: 3, K: 1 }
// The staff's weekly upkeep. Returns what it did (for the user's recap).
export function upkeep(F, t, R) {
  const did = []
  const P = () => t.roster.map(id => F.players[id]).filter(Boolean)
  // the long-term injured go to injured reserve; healed men come off it
  for (const p of P()) if (p.inj && p.inj.wk >= 4 && !p.inj.ir) { p.inj.ir = true; addTx(F, 'ir', t.short, `${teamName(t.short)} placed ${slotOf(p)} ${p.name} on injured reserve.`, p.id) }
  for (let guard = 0; guard < 24; guard++) {
    const healthy = groupCounts(F, t, true), all = groupCounts(F, t)
    const g = GROUPS.find(k => healthy[k] < DRESS[k] || all[k] < MIN_AT[k])
    if (!g) break
    const p = bestStreet(F, g, R)
    if (!p) break
    sign(F, p, t.short, minDeal(p))
    did.push(`Signed ${slotOf(p)} ${p.name}`)
  }
  // a thin roster is filled back up: the group furthest under what a full roster carries first
  const floor = F.phase === 'offseason' ? 0 : t.short === F.team ? ROSTER_MIN : ROSTER_MAX - 2
  for (let guard = 0; guard < 16 && activeCount(F, t) < floor; guard++) {
    const c = groupCounts(F, t)
    const g = [...GROUPS].sort((a, b) => (TARGET_AT[b] - c[b]) - (TARGET_AT[a] - c[a]))[0]
    const p = bestStreet(F, g, R)
    if (!p) break
    sign(F, p, t.short, minDeal(p), { quiet: true })
  }
  const limit = rosterLimit(F)
  for (let guard = 0; guard < 30 && activeCount(F, t) > limit; guard++) {
    // a hurt man who will miss weeks goes to injured reserve before anyone is cut
    const hurt = P().filter(p => p.inj && p.inj.wk >= 2 && !p.inj.ir).sort((a, b) => b.inj.wk - a.inj.wk)[0]
    if (hurt) { hurt.inj.ir = true; addTx(F, 'ir', t.short, `${teamName(t.short)} placed ${slotOf(hurt)} ${hurt.name} on injured reserve.`, hurt.id); continue }
    const out = cutCandidate(F, t)
    if (!out) break
    release(F, out)
    did.push(`Released ${slotOf(out)} ${out.name}`)
  }
  did.push(...capFix(F, t))
  depthAfterMove(F, t)
  return did
}
// what a free agent asks for in season (a street free agent: the minimum; a real one: most of his market)
export function streetAsk(F, p) {
  const mv = marketValue(p, F.cap), floor = p.exp >= 3 ? VET_MIN : MIN_SALARY
  return { years: 1, perYear: r2(Math.max(floor, mv * 0.8)), guaranteed: 0 }
}
