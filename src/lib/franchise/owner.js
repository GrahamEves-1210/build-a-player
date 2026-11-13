// FRANCHISE: the owner. Two or three goals for the season set from how strong the roster is, a job-security
// meter for the general manager, and the verdict when the season ends. Below the floor the GM is fired: other
// teams in the same league call, and the save carries on with one of them.
import { REG_WEEKS, clamp } from './consts'
import { TEAM_SHORTS, teamRating, ranks, addNews, teamName, nick, pct } from './core'
import { standing, finishText } from './standings'
import { DIV_OF } from './schedule'
import { directionOf, STATE_LABEL } from './state'

export const SECURITY_FLOOR = 20
export const securityWord = s => (s >= 75 ? 'SECURE' : s >= 50 ? 'STEADY' : s >= 32 ? 'WARM SEAT' : 'HOT SEAT')

// Goals for a team this season, from the direction its GM has declared (for a CPU team: its state) and how
// strong the roster is. Each: { id, text, weight, kind, n? }
//   contend   the playoffs and a run in them           retool   a winning record, in the race, a step forward
//   rebuild   develop the young players, win more than last year, hit on the draft
export function goalsFor(F, short) {
  const by = Object.fromEntries(TEAM_SHORTS.map(s => [s, teamRating(F, F.teams[s]).ovr]))
  const rk = ranks(by)[short]
  const dir = short === F.team ? directionOf(F) : F.teams[short].state ?? 'retool'
  const last = F.teams[short].last?.w ?? Math.round((F.pre?.[short] ?? 8) - 1)
  if (dir === 'contend') {
    return rk <= 5
      ? [{ id: 'conf', kind: 'conf', text: 'Reach the conference championship', weight: 3 }, { id: 'div', kind: 'div', text: `Win the ${DIV_OF[short]}`, weight: 2 }, { id: 'top', kind: 'unit', text: 'Finish in the top ten in points scored or points allowed', weight: 1 }]
      : [{ id: 'po', kind: 'po', text: 'Make the playoffs', weight: 3 }, { id: 'pwin', kind: 'pwin', text: 'Win a playoff game', weight: 2 }, { id: 'top', kind: 'unit', text: 'Finish in the top ten in points scored or points allowed', weight: 1 }]
  }
  if (dir === 'rebuild') {
    return [
      { id: 'dev', kind: 'dev', n: 2, text: 'Develop the young core: two players 24 or younger finish the year an 80 overall or better', weight: 3 },
      { id: 'more', kind: 'more', n: clamp(last, 2, 9), text: `Win more than ${clamp(last, 2, 9)} games: a step forward from last season`, weight: 2 },
      { id: 'rook', kind: 'rook', text: 'Hit on the draft: a rookie starts eight games', weight: 2 },
    ]
  }
  return [
    { id: 'wins', kind: 'wins', n: 9, text: 'Finish with a winning record', weight: 3 },
    { id: 'hunt', kind: 'wins', n: 8, text: 'Be in the playoff race into December (8 wins)', weight: 2 },
    { id: 'more', kind: 'more', n: clamp(last, 4, 10), text: `Take a step forward: win more than ${clamp(last, 4, 10)} games`, weight: 1 },
  ]
}
export function startOwner(F) {
  F.owner = { goals: goalsFor(F, F.team), verdict: null, dir: directionOf(F) }
}
// where each goal stands: { done: true | false | null (still open), progress }
export function goalState(F, g, final = false) {
  const t = F.teams[F.team], r = t.rec ?? { w: 0, l: 0, t: 0, pf: 0, pa: 0 }, left = Math.max(0, 17 - (r.w + r.l + r.t))
  const po = F.playoffs
  const seeded = po ? po.seeds.AFC.includes(F.team) || po.seeds.NFC.includes(F.team) : null
  const open = v => (final ? !!v : v ? true : null)
  switch (g.kind) {
    case 'wins': return { done: r.w >= g.n ? true : r.w + left < g.n || final ? false : null, progress: `${r.w} of ${g.n} wins` }
    case 'po': return { done: seeded == null ? (final ? false : null) : seeded, progress: seeded ? 'In the playoffs' : seeded === false ? 'Missed the playoffs' : `${r.w}-${r.l}` }
    case 'div': { if (!po && !final) return { done: null, progress: `${r.w}-${r.l}` }; const S = standing(F); const won = S.divisions[DIV_OF[F.team]][0] === F.team; return { done: won, progress: won ? 'Division champions' : 'Did not win the division' } }
    case 'conf': { if (!po) return { done: final ? false : null, progress: `${r.w}-${r.l}` }; const out = po.out?.[F.team]; const made = po.champion === F.team || out === 'sb' || out === 'conf'; const alive = seeded && !out && po.champion == null; return { done: made ? true : alive ? null : false, progress: seeded ? (finishText(F, F.team) || 'Still playing') : 'Missed the playoffs' } }
    case 'unit': { const pf = {}, pa = {}; for (const s of TEAM_SHORTS) { const x = F.teams[s].rec ?? { pf: 0, pa: 0 }; pf[s] = x.pf; pa[s] = -x.pa } const a = ranks(pf)[F.team], b = ranks(pa)[F.team]; const ok = a <= 10 || b <= 10; return { done: final || left === 0 ? ok : null, progress: `${ord(a)} in scoring, ${ord(b)} in points allowed` } }
    case 'dev': { const n = t.roster.map(id => F.players[id]).filter(p => p && p.age <= 24 && p.ovr >= 80).length; return { done: n >= g.n ? true : final ? false : null, progress: `${n} of ${g.n}` } }
    case 'cap': { let pay = t.dead ?? 0; for (const id of t.roster) pay += F.players[id]?.con?.sal ?? 0; const room = F.cap - pay; return { done: final ? room >= 8 : null, progress: `$${room.toFixed(1)}M of room` } }
    case 'pwin': { if (!po) return { done: final ? false : null, progress: `${r.w}-${r.l}` }; let won = 0; for (let w = 18; w < F.sched.weeks.length; w++) for (const g of F.sched.weeks[w] ?? []) if (g.hs != null && ((g.h === F.team && g.hs > g.as) || (g.a === F.team && g.as > g.hs))) won++; const alive = seeded && !po.out?.[F.team] && po.champion == null; return { done: won > 0 ? true : alive ? null : false, progress: won ? `${won} playoff win${won > 1 ? 's' : ''}` : seeded ? (alive ? 'In the playoffs' : 'One and done') : seeded === false ? 'Missed the playoffs' : `${r.w}-${r.l}` } }
    case 'more': return { done: r.w > g.n ? true : r.w + left <= g.n || final ? false : null, progress: `${r.w} wins (${g.n} to beat)` }
    case 'rook': { const n = t.roster.map(id => F.players[id]).filter(p => p && p.exp === 0 && (p.s.gs ?? 0) >= 8).length; return { done: n >= 1 ? true : final || left < 8 - Math.max(0, ...t.roster.map(id => F.players[id]).filter(p => p && p.exp === 0).map(p => p.s.gs ?? 0)) ? false : null, progress: n ? `${n} rookie${n > 1 ? 's' : ''} with eight starts` : 'No rookie has eight starts yet' } }
    case 'rival': { const S = standing(F), x = S.R[F.team]; return { done: x.dw >= 3 ? true : final || left === 0 ? false : null, progress: `${x.dw}-${x.dl} in the division` } }
    default: return { done: open(false), progress: '' }
  }
}
const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

// a small weekly drift: the owner watches the scoreboard
export function ownerWeek(F, recap) {
  if (!recap?.user || F.week > REG_WEEKS) return
  const u = recap.user
  F.gm.security = clamp(F.gm.security + (u.won ? 0.5 : u.tied ? 0 : -0.6) + (u.won && u.us - u.them >= 17 ? 0.2 : 0) - (!u.won && u.them - u.us >= 21 ? 0.4 : 0), 0, 100)
}
// The season is over: the verdict. Returns { verdict, goals, security, delta, fired, pts }
export function ownerVerdict(F) {
  if (!F.owner) startOwner(F)
  const goals = F.owner.goals.map(g => ({ ...g, ...goalState(F, g, true) }))
  let delta = 0, pts = 1
  for (const g of goals) { delta += g.done ? g.weight * 5 : -g.weight * 5.5; if (g.done) pts += g.weight >= 3 ? 2 : 1 }
  const champ = F.playoffs?.champion === F.team
  if (champ) { delta += 30; pts += 3 } else if (F.playoffs?.out?.[F.team] === 'sb') { delta += 12; pts += 1 }
  const r = F.teams[F.team].rec ?? { w: 0, l: 0, t: 0 }
  const dir = F.owner.dir ?? directionOf(F)
  if (dir === 'rebuild') { if (delta < -8) delta = -8 }                     // losing is forgiven in a rebuild; standing still is not
  else if (pct(r.w, r.l, r.t) < 0.25) delta -= 6
  if (dir === 'contend' && !(F.playoffs?.seeds.AFC.includes(F.team) || F.playoffs?.seeds.NFC.includes(F.team))) delta -= 5
  const before = F.gm.security
  F.gm.security = clamp(Math.round(before + delta), 0, 100)
  const met = goals.filter(g => g.done).length
  const verdict = champ ? `A championship. Ownership could not ask for more from ${F.gm.name}.`
    : met === goals.length ? `Every goal met${dir === 'rebuild' ? ' in a rebuilding year' : ''}. Ownership is fully behind ${F.gm.name}.`
    : dir === 'rebuild' && delta >= 0 ? `The record is not the point yet. The rebuild is on schedule.`
    : dir === 'contend' && delta < 0 ? `This roster was built to win now, and it did not. Ownership's patience is short.`
    : met === 0 ? `None of the season's goals were met. Ownership expects a response.`
    : delta >= 0 ? `A season that moved the franchise forward.` : `Ownership wanted more from this season.`
  const fired = !!F.settings.firing && F.gm.security < SECURITY_FLOOR && !champ
  F.owner.verdict = { text: verdict, goals, security: F.gm.security, delta: Math.round(F.gm.security - before), fired, pts }
  F.gm.pts = (F.gm.pts ?? 0) + pts
  if (fired) addNews(F, 'owner', `${teamName(F.team)} part ways with general manager ${F.gm.name}`, { team: F.team })
  return F.owner.verdict
}
// Fired: who calls. The weaker rosters with patient owners.
export function jobOffersFor(F) {
  const by = Object.fromEntries(TEAM_SHORTS.map(s => [s, teamRating(F, F.teams[s]).ovr])), rk = ranks(by)
  const rep = (F.gm.rings ?? 0) * 6 + pct(F.gm.w, F.gm.l, F.gm.t) * 20
  return TEAM_SHORTS.filter(s => s !== F.team && rk[s] >= (rep >= 16 ? 12 : 18)).sort((a, b) => rk[a] - rk[b]).slice(0, 4)
    .map(s => ({ short: s, rank: rk[s], ovr: by[s], pitch: rk[s] >= 26 ? `A full rebuild, and the time to do it. The ${nick(s)} want a builder.` : `A roster a few pieces short. The ${nick(s)} think ${F.gm.name} can find them.` }))
}
