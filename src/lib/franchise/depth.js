// FRANCHISE: depth charts and who actually lines up.
//
// A team's depth chart is t.depth = { SLOT: [player ids, best first] } for every slot in consts.SLOTS. The first
// n of a slot start (WR 3, EDGE 2, DT 2, LB 3, CB 2, S 2, one everywhere else); the rest are the order they
// come off the bench. The offensive line is five slots (LT LG C RG RT), each with its own order; a backup
// lineman is usually listed at more than one. KR is the kick returner.
//
// The staff sets it (best healthy man first, a first-year build starting at his spot); the user can set any
// slot by hand (setDepth) and it stays as he left it until he turns the staff back on.
import { SLOTS, OL_SPOTS, slotOf } from './consts'

const ol = p => p.pos === 'ol'
const isT = s => s === 'LT' || s === 'RT', isG = s => s === 'LG' || s === 'RG'
// how well a lineman listed at `from` plays `at`: 1 his own spot or its mirror, less the further he moves
export const olFit = (from, at) => (from === at ? 1 : (isT(from) && isT(at)) || (isG(from) && isG(at)) ? 0.985 : (isG(from) && at === 'C') || (from === 'C' && isG(at)) ? 0.96 : isT(from) && isG(at) ? 0.94 : 0.9)
export const available = p => !!p && !(p.inj && p.inj.wk > 0) && !p.hold
// what a man is worth on the depth chart: his OVR, a first-year build ahead of everyone, a hurt man behind
const score = (F, p) => p.ovr + (p.built && p.exp === 0 ? 100 : 0) - (available(p) ? 0 : 200)

export function autoDepth(F, t) {
  const P = t.roster.map(id => F.players[id]).filter(Boolean)
  const by = slot => P.filter(p => slotOf(p) === slot).sort((a, b) => score(F, b) - score(F, a) || a.id - b.id)
  const d = {}
  for (const s of SLOTS) if (s.pos && s.pos !== 'ol') d[s.slot] = by(s.slot).map(p => p.id)
  // the line: each spot takes the best man left for it (his own spot counts for more), starters first
  const line = P.filter(ol), used = new Set()
  const pickFor = (spot, pool) => pool.filter(p => !used.has(p.id)).sort((a, b) => score(F, b) * olFit(b.sub, spot) - score(F, a) * olFit(a.sub, spot) || a.id - b.id)[0]
  // (the men listed at a spot get first call on it, best first; then the open spots take the best of the rest)
  for (const spot of OL_SPOTS) { const own = line.filter(p => p.sub === spot && available(p)); const p = pickFor(spot, own); if (p) { d[spot] = [p.id]; used.add(p.id) } }
  for (const spot of OL_SPOTS) if (!d[spot]) { const p = pickFor(spot, line); d[spot] = p ? [p.id] : []; if (p) used.add(p.id) }
  for (const spot of OL_SPOTS) {
    const rest = line.filter(p => !used.has(p.id)).sort((a, b) => score(F, b) * olFit(b.sub, spot) - score(F, a) * olFit(a.sub, spot) || a.id - b.id)
    d[spot].push(...rest.map(p => p.id))
  }
  // the returner: the quickest back or receiver who doesn't start
  const starters = new Set([...(d.RB ?? []).slice(0, 1), ...(d.WR ?? []).slice(0, 2)])
  const ret = P.filter(p => (p.pos === 'rb' || p.pos === 'wr') && available(p)).sort((a, b) => retScore(b, starters) - retScore(a, starters) || a.id - b.id)
  d.KR = ret.slice(0, 2).map(p => p.id)
  t.depth = d
  return d
}
const retScore = (p, starters) => (p.a.speed ?? 5) * 2 + (p.pos === 'rb' ? (p.a.elusiveness ?? 5) + (p.a.burst ?? 5) : (p.a.afterCatch ?? 5) + (p.a.bodyControl ?? 5)) - (starters.has(p.id) ? 6 : 0)

// Keep a hand-set chart legal after roster moves: drop men who left, add new ones at the bottom of their slot
export function tidyDepth(F, t) {
  if (!t.depth) return autoDepth(F, t)
  const on = new Set(t.roster)
  const fresh = { ...t.depth }
  const want = {}
  for (const id of t.roster) { const p = F.players[id]; if (!p) continue; const s = slotOf(p); (want[p.pos === 'ol' ? 'OL' : s] ??= []).push(id) }
  for (const s of SLOTS) {
    const cur = (fresh[s.slot] ?? []).filter(id => on.has(id))
    const pool = s.slot === 'KR' ? cur : s.pos === 'ol' ? (want.OL ?? []) : (want[s.slot] ?? [])
    const have = new Set(cur)
    fresh[s.slot] = s.slot === 'KR' ? cur : [...cur.filter(id => pool.includes(id)), ...pool.filter(id => !have.has(id)).sort((a, b) => F.players[b].ovr - F.players[a].ovr)]
  }
  if (!fresh.KR?.length) { const auto = autoDepth(F, { ...t, depth: null, roster: t.roster }); fresh.KR = auto.KR }
  t.depth = fresh
  return fresh
}

// ── Game day ─────────────────────────────────────────────────────────────────
// The men who dress, healthy only, in depth order. A slot with nobody healthy borrows from the nearest group
// (the staff signs a body before that happens; this is the last line so a game can always be played).
const BORROW = { QB: ['RB', 'WR'], RB: ['WR', 'TE'], WR: ['RB', 'TE', 'CB'], TE: ['WR', 'RB'], EDGE: ['DT', 'LB'], DT: ['EDGE', 'LB'], LB: ['S', 'EDGE'], CB: ['S', 'WR'], S: ['CB', 'LB'], K: ['WR', 'S'] }
export function lineupOf(F, t) {
  const d = t.depth ?? autoDepth(F, t)
  const ok = id => available(F.players[id])
  const list = slot => (d[slot] ?? []).filter(ok).map(id => F.players[id])
  const L = {}
  for (const s of SLOTS) if (s.pos && s.pos !== 'ol') L[s.slot] = list(s.slot)
  for (const s of SLOTS) {
    if (!s.pos || s.pos === 'ol' || L[s.slot].length >= s.n) continue
    for (const from of BORROW[s.slot] ?? []) {
      const spare = L[from].slice(SLOTS.find(x => x.slot === from).n)
      while (L[s.slot].length < s.n && spare.length) { const p = spare.shift(); L[s.slot].push(p); L[from] = L[from].filter(x => x !== p) }
      if (L[s.slot].length >= s.n) break
    }
  }
  // the line: the first healthy man listed at each spot who isn't already in
  const used = new Set()
  L.OL = OL_SPOTS.map(spot => {
    const id = (d[spot] ?? []).find(x => ok(x) && !used.has(x))
    if (id != null) { used.add(id); return { p: F.players[id], spot } }
    return { p: null, spot }
  })
  for (const o of L.OL) {
    if (o.p) continue
    const any = t.roster.map(id => F.players[id]).filter(p => p && ol(p) && available(p) && !used.has(p.id)).sort((a, b) => b.ovr * olFit(b.sub, o.spot) - a.ovr * olFit(a.sub, o.spot))[0]
      ?? (L.TE.length > 1 ? L.TE[L.TE.length - 1] : L.DT[L.DT.length - 1] ?? null)
    if (any) { o.p = any; used.add(any.id) }
  }
  L.KR = (d.KR ?? []).filter(ok).map(id => F.players[id])
  if (!L.KR.length) L.KR = [L.RB[1] ?? L.WR[3] ?? L.WR[0] ?? L.RB[0]].filter(Boolean)
  return L
}
// the 22 starters and the kicker, as ids (for the roster table's starter mark)
export function startersOf(F, t) {
  const L = lineupOf(F, t), out = new Set()
  for (const s of SLOTS) if (s.pos && s.pos !== 'ol') L[s.slot].slice(0, s.n).forEach(p => out.add(p.id))
  L.OL.forEach(o => o.p && out.add(o.p.id))
  return out
}
