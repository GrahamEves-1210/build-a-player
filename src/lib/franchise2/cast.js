// FRANCHISE: the men in a moment (the mini game's cast), from the two teams' depth charts as they stand that week.
// The shape is Career's gameCast (lib/career.js; the games read it through lib/mg/kit.js manOf / xiOf):
//   { us: { qb: [..], rb, wr, te, ol (LT to RT), dl, lb, db, xi }, them: { … }, me }
// Each man: { name (LAST), number, skin, speed (-1..1), ball?, yac? }; the eleven a side (xi) adds last, short, look.
// Every man is a real man on that roster (the player's builds by the names their players gave them, with their own
// numbers); an injured man doesn't play (the chart's next healthy man does). The build in the moment is `me`.
import { QBS } from '../../data/qbs'
import { RBS } from '../../data/rbs'
import { WRS } from '../../data/wrs'
import { TES } from '../../data/tes'
import { DBS } from '../../data/dbs'
import { DLS } from '../../data/dls'
import { LBS } from '../../data/lbs'
import { OLS } from '../../data/ols'
import { depthChart, startersOf, jersey } from './roster'
import { buildLook, lookOf, facePos } from './faces'

const SKINS = ['#8d5a3b', '#5e3c22', '#7a5030', '#c09060', '#f0c4a0', '#9a6840']
const CATCHERS = new Set(['wr', 'te', 'rb'])
let IX = null
const index = () => (IX ??= new Map([QBS, RBS, WRS, TES, DBS, DLS, LBS, OLS].flatMap(list => list.map(p => [p.name, p]))))
const hashOf = t => { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return Math.abs(h) }
const SUFFIX = /\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i
const lastOf = n => { const w = String(n).replace(SUFFIX, '').trim().split(/\s+/); return w[w.length - 1] }
const c1 = v => Math.max(-1, Math.min(1, v))

// one man as the games read him
function castMan(F, p) {
  const B = p.b != null ? F.builds[p.b] : null
  const raw = B ? null : index().get(p.n)
  const h = hashOf(p.n ?? '?')
  const last = (raw?.short && String(p.n).replace(SUFFIX, '').endsWith(raw.short.replace(/^[A-Z]\.\s*/, '')) ? raw.short.replace(/^[A-Z]\.\s*/, '') : lastOf(p.n)).toUpperCase()
  const first = String(p.n ?? '').trim()[0]
  const at = B ? Object.fromEntries(Object.entries(B.build ?? {}).map(([k, v]) => [k, v?.val])) : raw?.attrs ?? null
  // (a build: the skin his player picked for his face; a made-up man: his drawn face's; a real man: his own)
  const skin = B ? buildLook(B).skin : raw?.skin ?? (raw ? SKINS[h % SKINS.length] : lookOf(p.fk ?? p.n, facePos(p)).skin)
  const number = jersey(F, p) ?? raw?.number ?? null
  const m = {
    name: last, last, short: first ? `${first.toUpperCase()}. ${last}` : last, number, skin, look: { number, skin },
    speed: c1(((at?.speed ?? at?.pace ?? 6) - 6) / 5),
    ...(CATCHERS.has(p.p) && at?.hands != null ? { ball: c1((at.hands * 0.5 + (at.bodyControl ?? at.strength ?? at.hands) * 0.3 + (at.size ?? at.hands) * 0.2 - 6) / 5) } : null),
    ...(CATCHERS.has(p.p) && (at?.afterCatch ?? at?.elusiveness) != null ? { yac: at.afterCatch ?? at.elusiveness } : null),
  }
  return m
}

// one team's men: the starters first in each room, then the next man or two up
export function castSide(F, short, meId = null) {
  const C = depthChart(F, short, { healthy: true }), L = startersOf(F, short)
  const M = p => { const m = castMan(F, p); return p.i === meId ? { ...m, me: true } : m }
  const room = (k, n) => C[k].slice(0, n).map(M)
  const at = k => (L[k] ? M(L[k]) : null)
  const line = ['ol1', 'ol2', 'ol3', 'ol4', 'ol5'].map(at).filter(Boolean)
  const edge = [at('edge1'), at('edge2'), ...room('edge', 3).slice(2)].filter(Boolean)
  const dt = [at('dt1'), at('dt2'), ...room('dt', 3).slice(2)].filter(Boolean)
  const cb = [at('cb1'), at('cb2'), ...room('cb', 3).slice(2)].filter(Boolean)
  const s = [at('s1'), at('s2'), ...room('s', 3).slice(2)].filter(Boolean)
  const lb = [at('lb1'), at('lb2'), at('lb3'), ...room('lb', 4).slice(3)].filter(Boolean)
  const behind = (k, slot, n) => [at(slot), ...C[k].filter(p => p !== L[slot]).slice(0, n - 1).map(M)].filter(Boolean)
  const qb = behind('qb', 'qb1', 2), rb = behind('rb', 'rb1', 3), te = behind('te', 'te1', 3)
  const wr = [at('wr1'), at('wr2'), at('wr3'), ...room('wr', 5).slice(3)].filter(Boolean)
  // (a room short of healthy men for its starting spots takes the next man from the room beside it, the way a team
  // does on Sunday: a safety drops into the box, an end stands up as a backer, a receiver lines up in the slot)
  const used = new Set([qb, rb, wr, te, line, edge, dt, lb, cb, s].flat().map(m => m.name + m.number))
  const NEXT = { lb: ['s', 'edge', 'dt', 'cb'], edge: ['dt', 'lb'], dt: ['edge'], cb: ['s'], s: ['cb', 'lb'], wr: ['te', 'rb'], te: ['wr'], ol: ['dt'] }
  const NEED = { lb: [lb, 3], edge: [edge, 2], dt: [dt, 2], cb: [cb, 2], s: [s, 2], wr: [wr, 3], te: [te, 1], ol: [line, 5] }
  for (const [k, [list, n]] of Object.entries(NEED)) {
    for (const from of NEXT[k]) for (const p of C[from] ?? []) {
      if (list.length >= n) break
      const m = M(p), key = m.name + m.number
      if (!used.has(key)) { used.add(key); list.push(m) }
    }
  }
  const x = (list, i) => list[i] ?? null
  const xi = { qb, rb, wr, te, ol: line, edge, dt, lb, cb, s }
  xi.dl = [x(edge, 0), x(dt, 0), x(dt, 1), x(edge, 1)]
  xi.db = [x(cb, 0), x(cb, 1), x(s, 0), x(s, 1), ...[x(cb, 2), x(s, 2), x(lb, 3), x(edge, 2), x(dt, 2)].filter(Boolean).concat(null, null).slice(0, 2)]
  xi.off = [x(qb, 0), x(rb, 0), x(wr, 0), x(wr, 1), x(wr, 2), x(te, 0), ...[0, 1, 2, 3, 4].map(i => x(line, i))]
  xi.def = [...xi.dl, x(lb, 0), x(lb, 1), x(lb, 2), ...xi.db.slice(0, 4)]
  return { qb, rb, wr, te, ol: line, dl: [...edge.slice(0, 2), ...dt.slice(0, 2), ...edge.slice(2), ...dt.slice(2)], lb, db: [...cb.slice(0, 2), ...s.slice(0, 2), ...cb.slice(2), ...s.slice(2)], xi }
}

// The moment's cast: the player's team (the build in the moment as `me`, first in his room) and the other team
export function momentCast(F, opp, pid) {
  const us = castSide(F, F.team, pid), them = castSide(F, opp)
  const p = F.teams[F.team].r.find(x => x.i === pid)
  const me = p ? { ...castMan(F, p), me: true } : null
  if (me) {
    const g = p.p
    if (us[g]) us[g] = [me, ...us[g].filter(m => !m.me)]
  }
  return { us, them, me }
}
