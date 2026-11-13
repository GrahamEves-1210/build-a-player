// FRANCHISE: awards. The races all season (the same scores the votes are made from), then the season's
// honors: MVP, Offensive and Defensive Player of the Year, the rookies of the year, Coach of the Year,
// Protector of the Year (the best offensive lineman: the game's own award), All-Pro and the Pro Bowl.
import { TEAM_SHORTS, pct, ranks } from './core'
import { slotOf } from './consts'
import { CONF_OF } from './schedule'
import { statLine, passerRating, kPoints } from './stats'

const n = v => v ?? 0
const winK = (F, short) => { const r = F.teams[short]?.rec ?? { w: 0, l: 0, t: 0 }; return pct(r.w, r.l, r.t) }
// production scores (a season line)
const qbScore = s => n(s.py) / 100 + n(s.ptd) * 1.6 - n(s.pi) * 1.7 + n(s.ry) / 55 + n(s.rtd) * 1.5 - n(s.fum) * 1 + (n(s.pa) >= 200 ? (passerRating(s) - 90) * 0.35 : -10)
const skillScore = s => (n(s.ry) + n(s.cy)) / 20 + (n(s.rtd) + n(s.ctd) + n(s.krtd)) * 6 + n(s.rc) * 0.25 - n(s.fum) * 3
const defScore = (s, slot) => n(s.sa) * (slot === 'DT' ? 11 : 9) + n(s.tfl) * 2 + n(s.di) * (slot === 'CB' || slot === 'S' ? 12 : 10) + n(s.pd) * 2.4 + n(s.ff) * 5 + n(s.fr) * 3 + n(s.tk) * (slot === 'LB' ? 0.5 : 0.6) + n(s.dtd) * 10
const olScore = (p, s) => (p.ovr - 60) * 2.4 + n(s.pk) * 0.4 - n(s.sal) * 2 - (17 - Math.min(17, n(s.gs))) * 3
const kScore = s => kPoints(s) + (n(s.fga) ? (n(s.fgm) / s.fga - 0.85) * 120 : -50) + n(s.f5m) * 2
// how good a season a man is having at his own job (All-Pro, the Pro Bowl)
export function seasonScore(p) {
  const s = p.s, slot = slotOf(p)
  if (p.pos === 'qb') return qbScore(s)
  if (p.pos === 'k') return kScore(s)
  if (p.pos === 'ol') return olScore(p, s)
  if (p.pos === 'rb' || p.pos === 'wr' || p.pos === 'te') return skillScore(s) * (p.pos === 'te' ? 1.25 : 1)
  return defScore(s, slot) + (p.ovr - 60) * (slot === 'CB' ? 2.2 : slot === 'DT' ? 1.6 : 1)
}
const played = F => Object.values(F.players).filter(p => p.team && n(p.s.g) > 0)

// The five races. Each entry: { p | coach, short, score, line }
export function races(F, top = 5) {
  const P = played(F), games = Math.max(1, Math.max(...TEAM_SHORTS.map(s => { const r = F.teams[s].rec; return r ? r.w + r.l + r.t : 0 })))
  const rank = (list, f) => list.map(p => ({ p, short: p.team, score: f(p), line: statLine(p.pos, p.s) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, top)
  const team = p => 0.72 + 0.42 * winK(F, p.team)
  const MVP = rank(P.filter(p => ['qb', 'rb', 'wr'].includes(p.pos)), p => (p.pos === 'qb' ? qbScore(p.s) : skillScore(p.s) * 0.36) * team(p))
  const OPOY = rank(P.filter(p => ['qb', 'rb', 'wr', 'te'].includes(p.pos)), p => (p.pos === 'qb' ? qbScore(p.s) * 1.55 : skillScore(p.s)))
  const DPOY = rank(P.filter(p => ['dl', 'lb', 'db'].includes(p.pos)), p => defScore(p.s, slotOf(p)) * (0.9 + 0.2 * winK(F, p.team)))
  const rook = P.filter(p => p.exp === 0)
  const OROY = rank(rook.filter(p => ['qb', 'rb', 'wr', 'te'].includes(p.pos)), p => (p.pos === 'qb' ? qbScore(p.s) * 1.9 + 20 : skillScore(p.s)))
  const DROY = rank(rook.filter(p => ['dl', 'lb', 'db'].includes(p.pos)), p => defScore(p.s, slotOf(p)))
  const PROTECTOR = rank(P.filter(p => p.pos === 'ol' && n(p.s.gs) >= Math.min(10, games * 0.6)), p => olScore(p, p.s) + winK(F, p.team) * 6)
  // the coach who beat what his roster was supposed to do
  const COY = TEAM_SHORTS.map(s => {
    const r = F.teams[s].rec ?? { w: 0, l: 0, t: 0 }, g = r.w + r.l + r.t, exp = (F.pre?.[s] ?? 8.5) * g / 17
    return { coach: F.coaches[F.teams[s].staff.hc], short: s, score: g ? (r.w + r.t / 2 - exp) * 1.4 + pct(r.w, r.l, r.t) * 6 : 0, line: `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}` }
  }).filter(x => x.coach).sort((a, b) => b.score - a.score).slice(0, top)
  const share = list => { const tot = list.reduce((a, x) => a + Math.max(0, x.score), 0) || 1; list.forEach(x => { x.share = Math.round(Math.max(0, x.score) / tot * 100) / 100 }); return list }
  return { MVP: share(MVP), OPOY: share(OPOY), DPOY: share(DPOY), OROY: share(OROY), DROY: share(DROY), COY: share(COY), PROTECTOR: share(PROTECTOR) }
}
// expected wins from the roster a team starts the season with (Coach of the Year is measured against it)
export function setExpectations(F, ratingOf) {
  const v = Object.fromEntries(TEAM_SHORTS.map(s => [s, ratingOf(s)]))
  const mean = TEAM_SHORTS.reduce((a, s) => a + v[s], 0) / 32
  F.pre = Object.fromEntries(TEAM_SHORTS.map(s => [s, Math.round(Math.max(3, Math.min(14, 8.5 + (v[s] - mean) * 1.05)) * 10) / 10]))
}

const ALL_PRO = { QB: 1, RB: 1, WR: 3, TE: 1, LT: 1, LG: 1, C: 1, RG: 1, RT: 1, EDGE: 2, DT: 2, LB: 3, CB: 2, S: 2, K: 1 }
const PRO_BOWL = { QB: 3, RB: 3, WR: 4, TE: 2, LT: 2, LG: 2, C: 2, RG: 2, RT: 2, EDGE: 3, DT: 3, LB: 4, CB: 4, S: 3, K: 1 }
const enough = p => n(p.s.g) >= 9
export function allPro(F) {
  const P = played(F).filter(enough), out = []
  for (const slot in ALL_PRO) {
    const best = P.filter(p => slotOf(p) === slot).map(p => ({ p, sc: seasonScore(p) })).sort((a, b) => b.sc - a.sc).slice(0, ALL_PRO[slot])
    for (const x of best) out.push({ slot, p: x.p })
  }
  return out
}
export function proBowl(F) {
  const P = played(F).filter(enough), out = { AFC: [], NFC: [] }
  for (const conf of ['AFC', 'NFC']) for (const slot in PRO_BOWL) {
    const best = P.filter(p => slotOf(p) === slot && CONF_OF[p.team] === conf).map(p => ({ p, sc: seasonScore(p) })).sort((a, b) => b.sc - a.sc).slice(0, PRO_BOWL[slot])
    for (const x of best) out[conf].push({ slot, p: x.p })
  }
  return out
}
// The season's honors, booked on the players (p.aw: [year, code]) and returned for the history
export function seasonAwards(F) {
  const R = races(F, 3), y = F.year
  const win = (k, code) => { const x = R[k][0]; if (!x) return null; if (x.p) x.p.aw.push([y, code]); else if (x.coach) (x.coach.aw ??= []).push([y, code]); return x.p ? { id: x.p.id, name: x.p.name, team: x.short, pos: slotOf(x.p), line: x.line } : { coach: x.coach.id, name: x.coach.name, team: x.short, line: x.line } }
  const awards = { MVP: win('MVP', 'MVP'), OPOY: win('OPOY', 'OPOY'), DPOY: win('DPOY', 'DPOY'), OROY: win('OROY', 'OROY'), DROY: win('DROY', 'DROY'), COY: win('COY', 'COY'), PROTECTOR: win('PROTECTOR', 'PROT') }
  const ap = allPro(F), pb = proBowl(F)
  for (const x of ap) x.p.aw.push([y, 'AP'])
  for (const c of ['AFC', 'NFC']) for (const x of pb[c]) x.p.aw.push([y, 'PB'])
  return { awards, allPro: ap, proBowl: pb }
}
export const AWARD_NAME = { MVP: 'Most Valuable Player', OPOY: 'Offensive Player of the Year', DPOY: 'Defensive Player of the Year', OROY: 'Offensive Rookie of the Year', DROY: 'Defensive Rookie of the Year', COY: 'Coach of the Year', PROT: 'Protector of the Year', PROTECTOR: 'Protector of the Year', AP: 'First-Team All-Pro', PB: 'Pro Bowl', SB: 'Super Bowl champion', SBMVP: 'Super Bowl MVP', POTW: 'Player of the Week' }
export { ranks }
