// FRANCHISE: what the screens read. Pure functions of the league (API.md section 2).
import { SLOTS, OL_SPOTS, REG_WEEKS, PLAYOFF_ROUNDS, weekLabel, DEFAULT_SETTINGS, ROSTER_MAX, ROSTER_MIN, CAMP_MAX, MIN_AT, r2, slotOf } from './consts'
import { TEAM_SHORTS, teamRating, ranks, recText, touch, fail } from './core'
import { teamRef, playerRow, teamRows, depthMap, coachRow, playcall } from './rows'
import { payroll, cutCost } from './money'
import { autoDepth, tidyDepth } from './depth'
import { COACH_LABEL } from './coachData'

export const LIMITS = { ROSTER_MAX, ROSTER_MIN, CAMP_MAX, MIN_AT }

export const settingsOf = F => ({ ...DEFAULT_SETTINGS, ...F.settings })
export function setSetting(F, key, value) {
  if (!(key in DEFAULT_SETTINGS)) return fail(F, 'setting', 'There is no such setting.')
  F.settings[key] = typeof DEFAULT_SETTINGS[key] === 'boolean' ? !!value : value
  if (key === 'autoDepth' && value) autoDepth(F, F.teams[F.team])
  return touch(F)
}

// ── Team ─────────────────────────────────────────────────────────────────────
export const roster = (F, team = F.team) => teamRows(F, team)
export function depthChart(F, team = F.team) {
  const t = F.teams[team], dm = depthMap(F, t)
  return {
    auto: team !== F.team || !!F.settings.autoDepth,
    slots: SLOTS.map(s => ({ slot: s.slot, name: s.name, side: s.side, starters: s.n, players: (t.depth?.[s.slot] ?? []).map(id => playerRow(F, F.players[id], dm)).filter(Boolean) })),
  }
}
// the user takes a slot over: the order is his until the staff is handed the chart back
export function setDepth(F, slot, ids) {
  const t = F.teams[F.team], s = SLOTS.find(x => x.slot === slot)
  if (!s) return fail(F, 'slot', 'There is no such spot on the depth chart.')
  const on = new Set(t.roster)
  const fits = id => { const p = F.players[id]; return !!p && on.has(id) && (slot === 'KR' ? p.pos === 'rb' || p.pos === 'wr' || p.pos === 'db' : s.pos === 'ol' ? p.pos === 'ol' : slotOf(p) === slot) }
  const list = [...new Set(ids)].filter(fits)
  if (!list.length) return fail(F, 'depth', 'Nobody on that list plays there.')
  F.settings.autoDepth = false
  if (!t.depth) autoDepth(F, t)
  const rest = (t.depth[slot] ?? []).filter(id => !list.includes(id))
  t.depth[slot] = slot === 'KR' ? list : [...list, ...rest]
  // a lineman moved to the front of one spot comes off the front of the others
  if (OL_SPOTS.includes(slot)) for (const o of OL_SPOTS) if (o !== slot && t.depth[o]?.[0] === list[0] && t.depth[o].length > 1) t.depth[o] = [...t.depth[o].slice(1), t.depth[o][0]]
  tidyDepth(F, t)
  return touch(F)
}
export function autoDepthChart(F) { autoDepth(F, F.teams[F.team]); return touch(F) }

export function capSheet(F, team = F.team) {
  const t = F.teams[team], dm = depthMap(F, t), pay = payroll(F, t)
  const rows = t.roster.map(id => F.players[id]).filter(Boolean).map(p => ({ ...playerRow(F, p, dm), capHit: p.con?.sal ?? 0, pctOfCap: r2((p.con?.sal ?? 0) / F.cap * 100), cut: cutCost(p) }))
    .sort((a, b) => b.capHit - a.capHit || b.ovr - a.ovr)
  const next = [1, 2, 3].map(k => {
    const on = t.roster.map(id => F.players[id]).filter(p => (p.con?.yrs ?? 0) > k)
    return { year: F.year + k, label: ['', 'NEXT SEASON', 'IN TWO SEASONS', 'IN THREE SEASONS'][k], committed: r2(on.reduce((s, p) => s + p.con.sal, 0) + (k === 1 ? t.deadNext ?? 0 : 0)), players: on.length }
  })
  return { cap: F.cap, payroll: pay, dead: r2(t.dead ?? 0), relief: r2(t.relief ?? 0), deadNext: r2(t.deadNext ?? 0), restructureRoom: r2(Math.max(0, F.cap * 0.12 - (t.deadNext ?? 0))), space: r2(F.cap - pay), rows, next, on: !!F.settings.cap }
}

// ── Coaches ──────────────────────────────────────────────────────────────────
export function staffEffects(F, t) {
  const pc = playcall(F, t), out = []
  const word = v => (v >= 9 ? 'elite' : v >= 7.5 ? 'strong' : v >= 5.5 ? 'solid' : v >= 4 ? 'below average' : 'poor')
  out.push(`Offensive play-calling is ${word(pc.off)}: it ${pc.off >= 5.5 ? 'lifts' : 'holds back'} the offense's efficiency every snap.`)
  out.push(`Defensive play-calling is ${word(pc.def)}: it ${pc.def >= 5.5 ? 'lifts' : 'holds back'} the defense every snap.`)
  out.push(`${COACH_LABEL.talentDev[0]}${COACH_LABEL.talentDev.slice(1).toLowerCase()} is ${word(pc.dev)}: players earn XP ${pc.dev >= 5.5 ? 'faster' : 'slower'} and young players break out ${pc.dev >= 5.5 ? 'more' : 'less'} often.`)
  out.push(`Culture is ${word(pc.culture)}: it moves morale, holdouts and how free agents see the team.`)
  out.push(`Situational awareness is ${word(pc.sit)}: fourth downs, two-point tries, the clock late in halves and close games.`)
  return out
}
export function staff(F, team = F.team) {
  const t = F.teams[team], c = id => F.coaches[id]
  const used = r2(['hc', 'oc', 'dc'].reduce((s, k) => s + (c(t.staff[k])?.con?.sal ?? 0), 0) + (t.staffDead ?? 0))
  const total = t.staffBudget ?? 30
  const pc = playcall(F, t)
  return {
    hc: coachRow(F, c(t.staff.hc), 'HC'), oc: coachRow(F, c(t.staff.oc), 'OC'), dc: coachRow(F, c(t.staff.dc), 'DC'),
    scout: t.staff.scout ?? null, budget: { total, used, left: r2(total - used) }, playcall: { off: pc.off, def: pc.def }, effects: staffEffects(F, t),
  }
}

// ── League ───────────────────────────────────────────────────────────────────
export const gameId = (week, i) => `w${week}g${i}`
export function findGame(F, id) {
  const m = /^w(\d+)g(\d+)$/.exec(String(id))
  if (!m) return null
  const g = F.sched.weeks[m[1] - 1]?.[+m[2]]
  return g ? { g, week: +m[1], i: +m[2] } : null
}
export function gameRow(F, g, week, i) {
  return { id: gameId(week, i), week, home: teamRef(g.h), away: teamRef(g.a), played: g.hs != null, hs: g.hs ?? null, as: g.as ?? null, ot: !!g.ot, user: g.h === F.team || g.a === F.team, top: g.top ?? [], ...(g.rd && { round: g.rd }) }
}
export const weekGames = (F, week = F.week) => (F.sched.weeks[week - 1] ?? []).map((g, i) => gameRow(F, g, week, i))
export function schedule(F, team = F.team) {
  const out = []
  F.sched.weeks.forEach((games, w) => {
    const week = w + 1, i = games.findIndex(g => g.h === team || g.a === team)
    if (i < 0) { if (week <= REG_WEEKS) out.push({ week, label: weekLabel(week), bye: true, opp: null, home: false, played: week < F.week || F.phase !== 'regular', result: null, gameId: null }); return }
    const g = games[i], home = g.h === team, us = home ? g.hs : g.as, them = home ? g.as : g.hs
    out.push({ week, label: weekLabel(week), bye: false, opp: teamRef(home ? g.a : g.h), home, played: g.hs != null, result: g.hs == null ? null : { won: us > them, tied: us === them, us, them, ot: !!g.ot }, gameId: gameId(week, i) })
  })
  return out
}
export function recordOf(F, short) {
  const r = F.teams[short].rec
  return r ? { w: r.w, l: r.l, t: r.t, text: recText(r) } : { w: 0, l: 0, t: 0, text: '0-0' }
}
export const teams = F => TEAM_SHORTS.map(s => ({ ...teamRef(s), record: recordOf(F, s).text, user: s === F.team, state: F.teams[s].state ?? 'retool' }))
export function leagueRatings(F) {
  const by = {}
  for (const s of TEAM_SHORTS) by[s] = teamRating(F, F.teams[s])
  const off = ranks(Object.fromEntries(TEAM_SHORTS.map(s => [s, by[s].off]))), def = ranks(Object.fromEntries(TEAM_SHORTS.map(s => [s, by[s].def]))), ovr = ranks(Object.fromEntries(TEAM_SHORTS.map(s => [s, by[s].ovr])))
  return Object.fromEntries(TEAM_SHORTS.map(s => [s, { ...by[s], offRank: off[s], defRank: def[s], rank: ovr[s] }]))
}
export const pickText = (F, pk) => `${pk.y} Round ${pk.r}${pk.o !== pk.own ? ` (${pk.o})` : ''}`
export const playoffLabel = week => PLAYOFF_ROUNDS.find(r => r.week === week)?.name ?? null
