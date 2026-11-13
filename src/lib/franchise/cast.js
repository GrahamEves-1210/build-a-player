// FRANCHISE: the men on the field in a mini game. The same shape Career hands MgStage (lib/career.js gameCast):
//   { us, them, me }   us / them: { qb, rb, wr, te, ol, dl, lb, db, k: [man], xi }   man: { name (LAST NAME), number, skin, speed, ball?, yac? }
//   xi: the eleven a side by spot ({ qb, rb, wr, te, ol, edge, dt, lb, cb, s, dl, db, off, def }), each man also
//   { last, short ("J. ALLEN"), look: { number, skin } }
// Both teams are the real depth charts of the game being played, and `me` is the man taking the moment.
import { clamp } from './consts'
import { lineupOf } from './depth'
import { lastName } from './players'

const CATCH = new Set(['wr', 'te', 'rb'])
function castMan(p) {
  const a = p.a
  return {
    name: lastName(p.name).toUpperCase(), number: p.num ?? 0, skin: p.skin ?? '#7a5030',
    speed: clamp(((a.speed ?? a.legs ?? a.range ?? a.mobility ?? 6) - 6) / 5, -1, 1),
    ...(CATCH.has(p.pos) && a.hands != null ? { ball: clamp((a.hands * 0.5 + (a.bodyControl ?? a.strength ?? a.hands) * 0.3 + (a.size ?? a.hands) * 0.2 - 6) / 5, -1, 1) } : null),
    ...(CATCH.has(p.pos) && (a.afterCatch ?? a.elusiveness) != null ? { yac: a.afterCatch ?? a.elusiveness } : null),
  }
}
function xiMan(p) {
  const m = castMan(p), first = String(p.name ?? '').trim()[0]
  return { ...m, last: m.name, short: first ? `${first.toUpperCase()}. ${m.name}` : m.name, look: { number: m.number, skin: m.skin } }
}
// the shapes the games read (lib/career.js xiShape)
function xiShape(xi) {
  const at = (k, i) => xi[k]?.[i] ?? null
  xi.dl = [at('edge', 0), at('dt', 0), at('dt', 1), at('edge', 1)]
  xi.db = [at('cb', 0), at('cb', 1), at('s', 0), at('s', 1), ...[at('cb', 2), at('s', 2), at('lb', 3), at('edge', 2), at('dt', 2)].filter(Boolean).concat(null, null).slice(0, 2)]
  xi.off = [at('qb', 0), at('rb', 0), at('wr', 0), at('wr', 1), at('wr', 2), at('te', 0), ...[0, 1, 2, 3, 4].map(i => at('ol', i))]
  xi.def = [...xi.dl, at('lb', 0), at('lb', 1), at('lb', 2), ...xi.db.slice(0, 4)]
  return xi
}
// a man first at his own spot (the one taking the moment starts there)
const front = (list, p) => (p && list.some(x => x.id === p.id) ? [p, ...list.filter(x => x.id !== p.id)] : list)
function castTeam(F, short, me = null) {
  const L = lineupOf(F, F.teams[short])
  const mine = k => front(L[k] ?? [], me)
  const line = L.OL.map(o => o.p).filter(Boolean)
  const out = {
    qb: mine('QB').slice(0, 3).map(castMan), rb: mine('RB').slice(0, 3).map(castMan), wr: mine('WR').slice(0, 5).map(castMan), te: mine('TE').slice(0, 3).map(castMan),
    ol: front(line, me && me.pos === 'ol' ? me : null).map(castMan), dl: front([...L.EDGE.slice(0, 3), ...L.DT.slice(0, 3)], me && me.pos === 'dl' ? me : null).map(castMan),
    lb: mine('LB').slice(0, 5).map(castMan), db: front([...L.CB.slice(0, 2), ...L.S.slice(0, 2), ...L.CB.slice(2, 3), ...L.S.slice(2, 3)], me && me.pos === 'db' ? me : null).map(castMan), k: mine('K').slice(0, 1).map(castMan),
  }
  out.xi = xiShape({
    qb: mine('QB').slice(0, 2).map(xiMan), rb: mine('RB').slice(0, 2).map(xiMan), wr: mine('WR').slice(0, 5).map(xiMan), te: mine('TE').slice(0, 2).map(xiMan), ol: line.map(xiMan),
    edge: mine('EDGE').slice(0, 3).map(xiMan), dt: mine('DT').slice(0, 3).map(xiMan), lb: mine('LB').slice(0, 4).map(xiMan), cb: mine('CB').slice(0, 3).map(xiMan), s: mine('S').slice(0, 3).map(xiMan),
  })
  return out
}
// The cast for the stop that is up (or for any man: playerId). null when no game is on.
export function gameCast(F, playerId = null) {
  const G = F.game
  if (!G || G.user < 0) return null
  const us = G.user === 0 ? G.h : G.a, them = G.user === 0 ? G.a : G.h
  const p = F.players[playerId ?? G.pend?.player?.id] ?? null
  const mine = p && p.team === us ? p : null
  const me = mine ? { ...castMan(mine), me: true } : null
  return { us: castTeam(F, us, mine), them: castTeam(F, them, null), me }
}
// a camp drill's cast: the user's own team on both sides
export function campCast(F, playerId) {
  const p = F.players[playerId] ?? null
  return { us: castTeam(F, F.team, p), them: castTeam(F, F.team, null), me: p ? { ...castMan(p), me: true } : null }
}
