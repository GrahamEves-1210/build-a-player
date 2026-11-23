// NBA FRANCHISE: the rotation. Who starts, who plays, how many minutes each man is meant to get.
//
// A coach plays a lineup with a shape: a ball-handler and another guard, a wing or two, one or two bigs. He starts the
// best five that fit the five spots (PG, SG, SF, PF, C; a man can slide one spot over, a two-spot slide costs him a lot),
// and his backups come in at the same spots: each spot is 48 minutes, the starter plays 30-36 of them, a backup the
// rest. A star plays 34-36 (37 at most), 40-41 in the playoffs, where the rotation shortens to eight. A spot with no
// backup goes to the men next to it (the starter a few more minutes, a wing sliding down), so even a lopsided roster
// (six guards, one big) plays its men sensible minutes. The game (game.js) plays toward these targets and moves off
// them the way a real game does: foul trouble sits a man, a blowout empties the bench, a close fourth quarter goes to
// the closers, an overtime adds minutes.
//
//   rotationOf(F, short)       the seam (STATE.md): [{ i, st, min }] the men who play tonight, starters first, with
//                              their targets; honours team.rot (his order, the first five start) and team.min
//   planRotation(players, set) { st: [5 ids], order: [ids, starters first], min: { id: target minutes }, closers: [5 ids],
//                                spot: { id: 0..4 } (the spot he plays: PG..C) }
//       players: the men who can play tonight (healthy, not resting). set (the user's screen, optional):
//         { st: [ids] }        his five starters (any left out or not available: filled by the coach)
//         { order: [ids] }     his order for the bench
//         { po: true }         the playoffs' shorter rotation
//         { min: { id: m } }   minutes he wants for a man (0 = out of the rotation); the rest are scaled to fill 240
//   startersOf(players)        the coach's best five: the best men who fit the five spots
//   dressed(T, { po, year })   tonight's men: healthy, not resting; a two-way man only in the regular season, 50 games
//                              at most (p.twa = [season, games active]), and only when the team needs him (to make 13
//                              healthy men) or he'd be in its top ten
//   shapeCost(spots)           how far a five is from a real lineup (0 = one man at each spot; over 2.5 a coach won't)
//   MIN_CAP                    the most a target can be (37: the league's minutes leaders play 36-38 now)
import { posOf, groupOf } from './skills'

export const POS_IX = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 }
export const spotOf = p => p.sp ?? POS_IX[String(posOf(p)).toUpperCase()] ?? (groupOf(p) === 'big' ? 4 : 1)
// what a man gives up (in OVR) playing a spot this far from his own
const FIT = [0, 3, 9, 18, 30]
// a five's shape: its spots sorted against PG..C, each man's distance weighed
const SHAPE_W = [0, 0.5, 2, 5, 9]
export const SHAPE_OK = 2.5
export function shapeCost(spots) {
  const n = [0, 0, 0, 0, 0]
  for (const x of spots) n[x]++
  let c = 0, j = 0
  for (let v = 0; v < 5; v++) for (let q = 0; q < n[v]; q++, j++) c += SHAPE_W[Math.abs(v - j)]
  return c
}

// tonight's men: under contract, not hurt, not resting; the two-way men by the rules above
export const TW_GAMES = 50
export const twGames = (p, year) => (Array.isArray(p.twa) && p.twa[0] === year ? p.twa[1] : 0)
export function dressed(T, { po = false, year = null } = {}) {
  const ok = p => !(p.inj?.g > 0) && !p.rest
  const std = T.r.filter(p => !p.tw && ok(p))
  if (po) return std
  const tenth = std.map(p => p.o ?? 0).sort((a, b) => b - a)[9] ?? 0
  const out = [...std]
  for (const p of T.r.filter(x => x.tw && ok(x) && (year == null || twGames(x, year) < TW_GAMES)).sort((a, b) => (b.o ?? 0) - (a.o ?? 0)))
    if (out.length < 13 || (p.o ?? 0) > tenth) out.push(p)
  return out
}
export const setOf = T => ({ st: T.rot ? T.rot.slice(0, 5) : [], order: T.rot ?? null, min: T.min ?? null })
export function rotationOf(F, short, { playoff = false } = {}) {
  const T = F.teams[short], L = planRotation(dressed(T, { po: playoff, year: F.year }), { ...setOf(T), po: playoff })
  return L.order.filter(i => L.min[i] > 0).map(i => ({ i, st: L.st.includes(i), min: L.min[i] }))
}

export const MIN_CAP = 37
export const GAME_MIN = 240
const ovr = p => p.o ?? 70
const clampN = (lo, hi, v) => Math.min(hi, Math.max(lo, v))
// the starters' minutes by slot (the best first); the bench's come from what's left at their spots
const SLOT = [33.5, 32.5, 31.5, 30.5, 29.5]
// the playoffs: the stars play 38-41, the rotation shortens to eight
const SLOT_PO = [38, 37, 35.5, 34, 32]
export const MIN_CAP_PO = 41

// the best men for the five spots (forced: men who must be in it, the user's starters); returns [[man, spot]]
function fitFive(men, forced = []) {
  const rest = men.filter(p => !forced.includes(p)).sort((a, b) => ovr(b) - ovr(a)).slice(0, 11)
  const cands = [...forced, ...rest]
  const n = cands.length
  // best[k][mask]: the most the first k men can be worth filling the spots in mask (from[k][mask]: his spot, -1 sat)
  const NEG = -1e9
  let cur = new Float64Array(32).fill(NEG); cur[0] = 0
  const from = []
  for (let k = 0; k < n; k++) {
    const p = cands[k], sp = spotOf(p), o = ovr(p)
    const nx = new Float64Array(32).fill(NEG), fr = new Int8Array(32).fill(-2)
    for (let m = 0; m < 32; m++) {
      if (cur[m] <= NEG) continue
      if (k >= forced.length && cur[m] > nx[m]) { nx[m] = cur[m]; fr[m] = -1 }
      for (let j = 0; j < 5; j++) if (!(m & (1 << j))) { const v = cur[m] + o - FIT[Math.abs(sp - j)], m2 = m | (1 << j); if (v > nx[m2]) { nx[m2] = v; fr[m2] = j } }
    }
    from.push(fr); cur = nx
  }
  const bits = m => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1) + ((m >> 4) & 1)
  let bm = -1
  for (let m = 0; m < 32; m++) if (cur[m] > NEG && (bm < 0 || bits(m) > bits(bm) || (bits(m) === bits(bm) && cur[m] > cur[bm]))) bm = m
  const pick = []
  for (let k = n - 1, m = bm; k >= 0 && m >= 0; k--) { const j = from[k][m]; if (j >= 0) { pick.push([cands[k], j]); m &= ~(1 << j) } }
  return pick.reverse()
}
export const startersOf = players => fitFive(players).map(([p]) => p)

// a five that doesn't look like a lineup: swap in the men who fix it, giving up as little as possible (val: what a
// man is worth to the coach right now); the pool is everyone who could go in
export function reshape(pick, pool, val) {
  if (pick.length < 5) return pick
  let cost = shapeCost(pick.map(spotOf))
  for (let it = 0; it < 3 && cost > SHAPE_OK; it++) {
    let best = null
    for (const o of pick) for (const p of pool) {
      if (pick.includes(p)) continue
      const c = shapeCost(pick.map(x => spotOf(x === o ? p : x)))
      if (c >= cost) continue
      const score = c + Math.max(0, val(o) - val(p))
      if (!best || score < best.score) best = { o, p, c, score }
    }
    if (!best) break
    pick = pick.map(x => (x === best.o ? best.p : x)); cost = best.c
  }
  return pick
}

export function planRotation(players, set = {}) {
  const ids = new Set(players.map(p => p.i))
  const byId = new Map(players.map(p => [p.i, p]))
  const po = !!set.po
  const CAP = po ? MIN_CAP_PO : MIN_CAP
  const want = (set.st ?? []).filter(id => ids.has(id)).slice(0, 5).map(id => byId.get(id))
  const fit = fitFive(players, want)
  const spot = new Map(fit.map(([p, j]) => [p, j]))
  const five = fit.map(([p]) => p).sort((a, b) => ovr(b) - ovr(a))
  for (const p of players) spot.has(p) || spot.set(p, spotOf(p))
  const bench = players.filter(p => !five.includes(p)).sort((a, b) => ovr(b) - ovr(a))
  // his order for the bench (team.rot past the first five); men he didn't place go after, best first
  if (set.order?.length) { const at = id => { const j = set.order.indexOf(id); return j < 0 ? 999 : j }; bench.sort((a, b) => at(a.i) - at(b.i)) }
  const order = [...five, ...bench]
  const S = po ? SLOT_PO : SLOT
  const min = Object.fromEntries(order.map(p => [p.i, 0]))
  const left = [48, 48, 48, 48, 48]
  // the user's own numbers first: kept as set (a man's minutes come out of his spot, then the ones beside it)
  const fixed = new Set()
  const take = (p, want, maxD) => {
    let got = 0
    const j0 = spot.get(p)
    for (let d = 0; d <= maxD && got < want - 0.01; d++) {
      const js = d === 0 ? [j0] : [j0 - d, j0 + d].filter(j => j >= 0 && j < 5).sort((a, b) => left[b] - left[a])
      for (const j of js) { const t = Math.min(left[j], want - got); if (t > 0) { left[j] -= t; got += t } }
    }
    return got
  }
  for (const [k, m] of Object.entries(set.min ?? {})) {
    const p = byId.get(+k) ?? byId.get(k); if (!p) continue
    fixed.add(p)
    min[p.i] = Math.max(0, Math.min(MIN_CAP + 4, +m || 0))
    take(p, min[p.i], 4)
  }
  // the starters: the slot's minutes, a star a bit more, a weak starter a bit less (out of his spot, then the ones beside it)
  const top = ovr(order[0] ?? {})
  const tgt = new Map()
  five.forEach((p, k) => {
    if (fixed.has(p)) return
    const m = Math.min(CAP, S[k] + clampN(-4, 2.5, (ovr(p) - 84) * 0.28))
    tgt.set(p, m)
    min[p.i] = take(p, m, 1)
  })
  // the rest of each spot's minutes, two at a time, to the man worth the most in it: his OVR, less what he gives up
  // away from his own spot, less his legs (a starter past his target tires fast; a bench man's minutes add up); a man
  // not yet in the rotation costs a bit more to bring in (the playoffs: a lot more), so the coach plays nine or ten
  // (eight), not twelve. His order for the bench, if he set one, counts too.
  const at = set.order?.length ? id => { const j = set.order.indexOf(id); return j < 0 ? 99 : j } : null
  const benchRank = new Map(bench.map((p, k) => [p, k]))
  const ENTRY = po ? 7 : 3.5
  const capOf = p => (tgt.has(p) ? Math.min(CAP, tgt.get(p) + 2.5) : CAP - 6)
  const M = order.filter(p => !fixed.has(p)).map(p => ({ p, sp: spot.get(p), o: ovr(p), t: tgt.get(p), cap: capOf(p), bonus: at && !tgt.has(p) ? Math.max(0, 8 - 2 * benchRank.get(p)) : 0 }))
  const util = (x, j, loose) => {
    const d = Math.abs(x.sp - j)
    if (d > (loose ? 4 : 2)) return -Infinity
    const m = min[x.p.i]
    if (!loose && m >= x.cap - 0.05) return -Infinity
    return x.o - FIT[d] + x.bonus - (x.t != null ? 4 * Math.max(0, m - x.t) : 0.3 * m + (m <= 0 ? ENTRY : 0))
  }
  for (let guard = 0; guard < 400; guard++) {
    let j = 0
    for (let q = 1; q < 5; q++) if (left[q] > left[j]) j = q
    if (left[j] <= 0.01) break
    let best = null, bu = -Infinity, loose = false
    for (const x of M) { const u = util(x, j, false); if (u > bu) { bu = u; best = x } }
    if (!best) { loose = true; for (const x of M) { const u = util(x, j, true); if (u > bu) { bu = u; best = x } } }
    if (!best) break
    const t = Math.min(2, left[j], loose ? 2 : best.cap - min[best.p.i]); min[best.p.i] += t; left[j] -= t
  }
  // a man left with a few scraps: off the floor, his minutes to the men next to him who have room
  const free = order.filter(p => !fixed.has(p))
  const room = p => capOf(p) - min[p.i]
  for (const p of [...bench].reverse()) {
    if (fixed.has(p) || min[p.i] <= 0 || min[p.i] >= (po ? 6 : 4)) continue
    let m = min[p.i]; min[p.i] = 0
    for (const q of free.filter(x => x !== p && min[x.i] > 0).sort((a, b) => Math.abs(spot.get(a) - spot.get(p)) - Math.abs(spot.get(b) - spot.get(p)) || ovr(b) - ovr(a))) { const t = Math.min(m, room(q)); if (t > 0) { min[q.i] += t; m -= t } if (m <= 0) break }
    if (m > 0) min[p.i] += m
  }
  // the user's numbers over or under the 240: the coach's men scaled to fill the rest
  const fixedSum = [...fixed].reduce((s, p) => s + min[p.i], 0)
  const freeSum = free.reduce((s, p) => s + min[p.i], 0)
  const room0 = Math.max(0, GAME_MIN - fixedSum)
  if (fixed.size && freeSum > 0) for (const p of free) min[p.i] = Math.min(CAP, min[p.i] * room0 / freeSum)
  let rest = GAME_MIN - order.reduce((s, p) => s + min[p.i], 0)
  for (let pass = 0; pass < 3 && rest > 0.5; pass++) for (const p of free) { if (rest <= 0) break; const add = Math.min(rest, CAP - min[p.i], 8); if (add > 0 && min[p.i] > 0) { min[p.i] += add; rest -= add } }
  for (const p of order) min[p.i] = Math.round(min[p.i] * 10) / 10
  // closing a close game: the five best who play real minutes, shaped like a lineup (the starters most nights)
  const real = order.filter(p => min[p.i] >= 14)
  let closers = [...real].sort((a, b) => ovr(b) - ovr(a)).slice(0, 5)
  for (const p of order) if (closers.length < 5 && !closers.includes(p)) closers.push(p)
  closers = reshape(closers, real.length >= 5 ? real : order, p => ovr(p) / 3)
  return { st: five.map(p => p.i), order: order.map(p => p.i), min, closers: closers.map(p => p.i), spot: Object.fromEntries(order.map(p => [p.i, spot.get(p)])) }
}
