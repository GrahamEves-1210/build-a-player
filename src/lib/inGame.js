// A playoff moment inside the game it belongs to (the owner, 2026-11-14: "they are supposed to be in game moments
// where you jump in for your player"). Three steps, in this order:
//   1. The game first. It is played, possession by possession (an inning's at-bats, a match's minutes), on the two
//      teams' strength, up to the point where his moment comes. The moment comes at the latest point of the game that
//      is still live for his position (a two-minute drive only down one score late, a stop only when the other team
//      has the ball and a score changes the game, a walk-off only for the home side in the 9th, tied or behind); a game
//      that never was, from early in the 4th quarter. The moment dealt is one that fits the state there.
//   2. The play changes the scoreboard by exactly what happened in it: a touchdown is six and the try, a field goal
//      three, a stop is a drive with no points, a pick is their ball on a short field; a shot is its two or three; a
//      goal is a goal; an at-bat is the runs that scored and the outs that were made.
//   3. The rest of the game is played from there, on the same two teams, and nothing comes after a last play.
// The only thing tuned is where moments land (how the game was going before it): across his build's usual rate at
// the play (the rate Career's sim lands it at), the game is won as often as it is with no moments at all. A player
// only wins more by playing the play better than his build would. scripts/moments/calibrate.mjs checks it.
//
// Everything here is a pure function of the seed: a reload deals the same game, the same state, the same rest of it.
import { seeded } from './rng.js'

const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const add = (M, k, p) => { if (p > 1e-13) M.set(k, (M.get(k) ?? 0) + p) }
const inR = (m, a, b) => m >= a && m <= b
// f increasing: the x in [lo, hi] where f(x) = target (an end when it never gets there)
function solve(f, target, lo, hi, it = 34) {
  if (f(lo) >= target) return lo
  if (f(hi) <= target) return hi
  for (let i = 0; i < it; i++) { const m = (lo + hi) / 2; if (f(m) < target) lo = m; else hi = m }
  return (lo + hi) / 2
}
// one of a weighted list [{ p, ... }] for u in [0, total)
const pickW = (u, list) => { let acc = 0; for (const x of list) { acc += x.p; if (u < acc) return x } return list[list.length - 1] }
const drawPair = (r, list) => { let u = r(), acc = 0; for (const x of list) { acc += x[1]; if (u < acc) return x[0] } return list[list.length - 1][0] }
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const where = (us, them, mine, opp) => (mine < opp ? `${us} down ${mine}-${opp} to ${them}` : mine > opp ? `${us} up ${mine}-${opp} on ${them}` : `${us} and ${them} tied at ${mine}`)
const freshOf = (list, used) => { const f = list.filter(g => !used.includes(g)); return f.length ? f : list }

// ── Where the moment lands ───────────────────────────────────────────────────
// The checkpoints of a game, earliest to latest, each a distribution over its states (a key). kernels[k](key): the
// states at checkpoint k + 1 from that one (the game played on between them). branchesOf(k, key): the moments that
// fit there, each with its probability (summing to how often the moment is live there; the earliest is always live).
// The moment comes at the latest live checkpoint: { k, key, w } is the chance it lands at k in state key.
function landing(init, kernels, branchesOf) {
  const K = kernels.length + 1
  const f = [init]
  for (let k = 0; k < K - 1; k++) { const nx = new Map(); for (const [key, p] of f[k]) for (const [k2, q] of kernels[k](key)) add(nx, k2, p * q); f.push(nx) }
  const liveOf = (k, key) => branchesOf(k, key).reduce((s, b) => s + b.p, 0)
  const N = Array.from({ length: K }, () => new Map())
  const surv = (k, key) => {
    if (k === K - 1) return 1
    let v = N[k].get(key)
    if (v != null) return v
    v = 0
    for (const [k2, q] of kernels[k](key)) v += q * (1 - liveOf(k + 1, k2)) * surv(k + 1, k2)
    N[k].set(key, v)
    return v
  }
  const out = []
  for (let k = 0; k < K; k++) for (const [key, p] of f[k]) { const w = p * surv(k, key); if (w > 1e-12) out.push({ k, key, w }) }
  return out
}
// the chance to win, over where the moment lands and how the play goes: h(b) his rate at the play (1: always lands it)
const expectOf = (land, branchesOf, h) => land.reduce((s, x) => s + x.w * branchesOf(x.k, x.key).reduce((t, b) => { const q = h(b); return t + b.p * (q * b.wHit + (1 - q) * b.wMiss) }, 0), 0)
const memo1 = fn => { const M = new Map(); return (k, key) => { const id = `${k}#${key}`; let v = M.get(id); if (!v) { v = fn(k, key); M.set(id, v) } return v } }
const memoK = fn => { const M = new Map(); return key => { let v = M.get(key); if (!v) { v = fn(key); M.set(key, v) } return v } }
// the checkpoint the game's own path landed on: the latest one live (u: its coin), and the branch there
function landOn(keys, coins, branchesOf) {
  for (let k = keys.length - 1; k >= 0; k--) {
    const bs = branchesOf(k, keys[k]), live = bs.reduce((s, b) => s + b.p, 0)
    if (coins[k] < live || k === 0) return { k, branch: pickW(Math.min(coins[k], live - 1e-12), bs) }
  }
  return null
}

// ═════════════════════════════════════════════════════════════════════════════
// FOOTBALL: 22 possessions (11 a side), a touchdown, a field goal or nothing on each
// ═════════════════════════════════════════════════════════════════════════════
const FB_N = 22, FB_SLICE = 3600 / FB_N
const fbLeft = i => Math.round(3600 - (i - 1) * FB_SLICE)   // the clock as possession i starts
// a team's drive: an NFL drive scores a touchdown about one time in five, a field goal about one in seven (22 a game)
const fbSide = d => ({ td: clamp(0.21 * Math.exp(d), 0.04, 0.62), fg: clamp(0.15 * Math.exp(0.5 * d), 0.05, 0.3) })
const fbOut = s => [[7, s.td], [3, s.fg], [0, 1 - s.td - s.fg]]
function fbRates(d) {
  const u = fbSide(d), t = fbSide(-d), a = u.td * 7 + u.fg * 3, b = t.td * 7 + t.fg * 3
  return { u, t, ot: a / (a + b), d }
}
const endP = (m, ot) => (m > 0 ? 1 : m < 0 ? 0 : ot)
const conv = (M, out, sg) => { const nx = new Map(); for (const [m, p] of M) for (const [x, q] of out) add(nx, m + sg * x, p * q); return nx }
function fbFull(d) {
  const R = fbRates(d)
  let M = new Map([[0, 1]])
  for (let i = 0; i < FB_N / 2; i++) { M = conv(M, fbOut(R.u), 1); M = conv(M, fbOut(R.t), -1) }
  let w = 0
  for (const [m, p] of M) w += p * endP(m, R.ot)
  return w
}
// a drive with s seconds to work with: a full one past 2:30, then less of a chance to get anywhere (a field goal needs less)
function fbDrive(base, s, boost = 1) {
  const tdF = s >= 150 ? 1 : Math.max(0.03, (s / 150) ** 1.4), fgF = s >= 80 ? 1 : Math.max(0.08, s / 80)
  const td = Math.min(0.85, base.td * tdF * boost), fg = Math.min(0.9 - td, base.fg * fgF * boost)
  return [[7, td], [3, fg], [0, 1 - td - fg]]
}
// The rest of a game from margin m (his side's), T seconds left, side ('u' his team, 't' theirs) with the ball.
// A team ahead with the ball and 2:30 or less kneels it out. boost: the first drive's field position (a short field, a pin)
function fbV(R, memo, m, T, side, boost = 1) {
  if (T <= 5) return endP(m, R.ot)
  if ((side === 'u' ? m > 0 : m < 0) && T <= 150) return endP(m, R.ot)
  const key = `${m}|${Math.round(T)}|${side}|${boost}`
  let v = memo.get(key)
  if (v != null) return v
  const s = Math.min(T, FB_SLICE), sg = side === 'u' ? 1 : -1, nx = side === 'u' ? 't' : 'u'
  v = 0
  for (const [x, q] of fbDrive(R[side], s, boost)) if (q > 0) v += q * fbV(R, memo, m + sg * x, T - s, nx, 1)
  memo.set(key, v)
  return v
}
// the same, played: the points each side adds, the scoring plays, overtime
function fbRest(R, r, m, T, side, boost = 1) {
  const ev = []
  let add2 = { u: 0, t: 0 }
  for (let first = true; T > 5; first = false) {
    const mm = m + add2.u - add2.t
    if ((side === 'u' ? mm > 0 : mm < 0) && T <= 150) break
    const s = Math.min(T, FB_SLICE), x = drawPair(r, fbDrive(R[side], s, first ? boost : 1))
    if (x) { add2[side] += x; ev.push({ side, pts: x, T: T - s }) }
    T -= s; side = side === 'u' ? 't' : 'u'
  }
  let ot = null
  if (m + add2.u - add2.t === 0) {
    const w = r() < R.ot, by = r() < 0.6 ? 3 : 6
    if (w) add2.u += by; else add2.t += by
    ot = w ? 'w' : 'l'
  }
  return { u: add2.u, t: add2.t, ev, ot }
}

const FB_PASS = new Set(['hot-read', 'bomb', 'escape', 'third-long', 'audible', 'catch', 'juke-wr', 'release', 'juke-te', 'pass-pro'])
const FB_RUN = new Set(['gap', 'juke', 'seal'])
const FB_STOP = new Set(['jump-route', 'zone-drop', 'tackle-angle', 'pass-rush', 'run-stuff', 'hit-stick'])
// Where a play fits (i: the possession it comes on, 22 the last; m: his side's margin; ls: what the other side scored on
// the drive before). Late it has to matter; at the 18th (early in the 4th) anything goes.
function fbFits(t, i, m, ls) {
  if (t === 'two-minute') return i === 22 && inR(m, -8, -4)                // (only a touchdown does it)
  if (t === 'goal-line') return i === 22 && inR(m, -7, -4)                 // (down three or less, or level, he'd kick)
  if (t === 'kick-return') return ls > 0 && (i === 22 ? inR(m, -8, 3) : i === 20 ? inR(m, -10, 8) : true)   // (they've just scored)
  if (t === 'sneak') return i === 22 ? inR(m, -8, 3) : i === 20 ? inR(m, -10, 10) : true
  if (FB_RUN.has(t)) return i === 22 ? inR(m, -3, 8) : i === 20 ? inR(m, -8, 10) : true                     // (running late is what a team that's close does)
  if (FB_PASS.has(t)) return i === 22 ? inR(m, -8, 3) : i === 20 ? inR(m, -10, 8) : true
  if (FB_STOP.has(t)) return i === 22 ? inR(m, -3, 8) : i === 20 ? inR(m, -8, 10) : true                    // (a score of theirs changes the game)
  return false
}
// the clock when it comes up (the last possession starts at 2:44)
function fbClocks(t, i) {
  if (i !== 22) { const L = fbLeft(i); return [L - 15, L - 40, L - 65, L - 90] }
  if (t === 'two-minute') return [92, 86, 80]
  if (t === 'goal-line') return [33, 27, 20, 14, 8]
  if (t === 'kick-return') return [fbLeft(22)]
  if (t === 'sneak') return [150, 120, 95, 70, 45]
  if (FB_RUN.has(t)) return [155, 140, 125, 110, 95]
  if (FB_STOP.has(t)) return [150, 125, 100, 75, 50]
  return [160, 140, 120, 100, 75, 50]
}
// The play, on the board: a list of { p, u, t (points it puts up), next (who has the ball after), T (the clock after),
// boost, tag }. F: what the game's own report showed (lib/situations.js momentFacts), or null (a simulated moment:
// the build's usual hit or miss). d: the drive the play is part of, scored on from there.
function fbPlay(R, b, hit, F) {
  const { game: t, m, clock: c } = b, us = R.u, them = R.t
  const pts = F?.pts, to = !!F?.to || (F?.ints ?? 0) > 0
  const drive = (td, fg, used, side = 'u', tag = 'drive') => {
    const T = Math.max(0, c - used), nx = side === 'u' ? 't' : 'u', sg = side
    return [{ p: td, [sg]: 7, next: nx, T, tag: 'td' }, { p: fg, [sg]: 3, next: nx, T, tag: 'fg' }, { p: Math.max(0, 1 - td - fg), next: nx, T, tag }]
  }
  if (t === 'game-winner') return [{ p: 1, u: hit || pts === 3 ? 3 : 0, next: null, T: 0, tag: hit ? 'fg' : 'miss' }]
  if (t === 'deep-kick') {
    // (a report without the extra point, Simple mode's field goals only: the try after the touchdown at the usual rate)
    if (pts != null) return b.kicks?.some(k => k.xp) && F?.xpa == null ? [{ p: 0.94, u: pts + 1, next: 't', T: c - 10, tag: 'kicks' }, { p: 0.06, u: pts, next: 't', T: c - 10, tag: 'kicks' }] : [{ p: 1, u: pts, next: 't', T: c - 10, tag: 'kicks' }]
    // his kicks today, each made at about his usual rate for its kind, a little better or worse with the drill
    let M = new Map([[0, 1]])
    for (const k of b.kicks) {
      const q = k.xp ? (hit ? 0.99 : 0.88) : k.long ? (hit ? 0.8 : 0.35) : hit ? 0.95 : 0.66
      const nx = new Map(); for (const [x, p] of M) { add(nx, x + (k.xp ? 1 : 3), p * q); add(nx, x, p * (1 - q)) }; M = nx
    }
    return [...M].map(([u, p]) => ({ p, u, next: 't', T: c - 10, tag: 'kicks' }))
  }
  if (t === 'onside') {
    if (!hit) return [{ p: 1, next: 't', T: 0, tag: 'kneel' }]
    // recovered near midfield with about a minute and no timeouts: a field goal is close, a touchdown is a long way
    const td = clamp(0.1 + us.td * 0.5, 0.1, 0.35), fg = m >= -3 ? clamp(0.3 + us.fg, 0.3, 0.6) : 0
    return [{ p: td, u: 7, next: null, T: 0, tag: 'td' }, { p: fg, u: 3, next: null, T: 0, tag: 'fg' }, { p: 1 - td - fg, next: null, T: 0, tag: 'short' }]
  }
  if (t === 'two-minute' || t === 'goal-line' || t === 'sneak') {
    const T = Math.max(0, c - (t === 'two-minute' ? 72 : 5))
    const scored = pts != null ? pts >= 6 : hit
    if (scored) {
      if (t === 'goal-line') return [{ p: 1, u: m <= -7 ? 8 : 7, next: 't', T, tag: 'td' }]   // (the screen's own scoreboard: enough to go ahead)
      if (t === 'sneak') return [{ p: 1, u: pts ?? 7, next: 't', T: Math.max(0, c - 6), tag: 'td' }]
      // six, then the try: down two after it, go for two; otherwise kick it (down one, to tie)
      const m6 = m + 6
      return m6 === -2 ? [{ p: 0.48, u: 8, next: 't', T, tag: 'td' }, { p: 0.52, u: 6, next: 't', T, tag: 'td2' }]
        : [{ p: 0.94, u: 7, next: 't', T, tag: 'td' }, { p: 0.06, u: 6, next: 't', T, tag: 'tdx' }]
    }
    if (t === 'two-minute' && pts === 3) return [{ p: 1, u: 3, next: 't', T: Math.max(0, c - 60), tag: 'fg' }]
    // turned over on downs (at the goal line, they're pinned at the one)
    return [{ p: 1, next: 't', T: Math.max(0, c - (t === 'two-minute' ? 55 : 5)), boost: t === 'two-minute' ? 1 : 0.5, tag: to ? 'pick' : 'downs' }]
  }
  if (t === 'kick-return') {
    if (pts >= 6) return [{ p: 1, u: pts, next: 't', T: c - 14, tag: 'td' }]
    if (F?.allowed === 2) return [{ p: 1, t: 2, next: 't', T: c - 6, tag: 'safety' }]
    return hit ? drive(clamp(us.td * 1.6, 0.1, 0.6), us.fg, Math.min(c, 150)) : drive(us.td * 0.65, us.fg * 0.85, Math.min(c, 150))
  }
  if (FB_STOP.has(t)) {
    if (hit) return [{ p: 1, next: 'u', T: Math.max(0, c - (F?.to ? 20 : 35)), boost: F?.to ? 1.4 : 1, tag: F?.to ? 'takeaway' : 'stop' }]
    if (m < 0 && c <= 150) return [{ p: 1, next: 'u', T: 0, tag: 'clock' }]   // (ahead, they run it out)
    return drive(clamp(them.td * 2.2 + 0.1, 0.3, 0.8), clamp(them.fg * 1.1, 0.08, 0.3), Math.min(c, 110), 't')
  }
  // a play in his team's drive (a conversion, a big gain, a block, a catch)
  if (pts >= 6) return [{ p: 1, u: pts, next: 't', T: Math.max(0, c - 8), tag: 'td' }]
  if (to) return [{ p: 1, next: 't', T: Math.max(0, c - 10), boost: 1.35, tag: 'pick' }]
  if (hit) {
    if (m > 0 && c <= 160 && b.i === 22) return [{ p: 1, next: 't', T: 0, tag: 'iced' }]   // (one more first down, and they kneel)
    return drive(clamp(us.td * 2 + 0.1, 0.25, 0.8), clamp(us.fg * 1.3, 0.1, 0.35), Math.min(c, 140))
  }
  return [{ p: clamp(us.fg * 0.5, 0.04, 0.15), u: 3, next: 't', T: Math.max(0, c - 25), tag: 'fg' }, { p: 1 - clamp(us.fg * 0.5, 0.04, 0.15), next: 't', T: Math.max(0, c - 25), tag: 'punt' }]
}
const fbAfter = (R, memo, b, o) => {
  const m2 = b.m + (o.u ?? 0) - (o.t ?? 0)
  return o.next == null || o.T <= 5 ? endP(m2, R.ot) : fbV(R, memo, m2, o.T, o.next, o.boost ?? 1)
}
const fbW = (R, memo, b, hit) => fbPlay(R, b, hit, null).reduce((s, o) => s + o.p * fbAfter(R, memo, b, o), 0)

function fbModel(ctx) {
  const { pool, used, hOf } = ctx
  const d = solve(fbFull, ctx.pGame, -3, 3)
  const R = fbRates(d), memo = new Map()
  const kick = pool.some(g => g === 'game-winner' || g === 'deep-kick' || g === 'onside')
  const side = kick || pool.some(g => FB_PASS.has(g) || FB_RUN.has(g) || g === 'sneak' || g === 'two-minute' || g === 'goal-line' || g === 'kick-return') ? 'u' : 't'
  const trackLs = pool.includes('kick-return')
  const CPS = [18, 20, 22]
  const mk = (game, i, m, ls, clock, p, pre = 0, kicks = null) => {
    const b = { p, game, i, m: m + pre, ls, clock, pre, kicks, h: hOf(game) }
    b.wHit = fbW(R, memo, b, true); b.wMiss = fbW(R, memo, b, false)
    return b
  }
  const spread = (list, i, m, ls, p) => list.flatMap(g => { const cl = fbClocks(g, i); return cl.map(c => mk(g, i, m, ls, c, p / list.length / cl.length)) })
  const branchesOf = memo1((k, key) => {
    const i = CPS[k], [m, ls, nf, td] = key.split('|').map(Number)
    if (kick) {
      const out = []
      if (i === 22) {
        // the last drive gets into range for the last snap (tied, or a field goal ties or wins it)
        if (inR(m, -3, 0) && pool.includes('game-winner')) { const q = clamp(R.u.td + R.u.fg + 0.1, 0.3, 0.7); for (const c of [2, 3, 4]) out.push(mk('game-winner', i, m, ls, c, q / 3)) }
        // or it scores, and they're still behind: the onside kick
        if (pool.includes('onside')) for (const [x, q] of [[7, R.u.td], [3, R.u.fg]]) if (inR(m + x, -8, -1) && !inR(m, -3, 0)) for (const c of [108, 96, 84, 72, 62]) out.push(mk('onside', i, m, ls, c, q / 5, x))
        return out
      }
      // his kicks today: the field goal tries his team's drives have ended in (the extra point after the last
      // touchdown with them). A game where they've had none: the drive that stalls in long range, once
      if (!pool.includes('deep-kick')) { if (i === 18) for (const c of fbClocks('game-winner', i)) out.push(mk('game-winner', i, m, ls, c, 1 / 4)); return out }
      const kicks = [...Array.from({ length: nf }, () => ({ fg: true })), ...(nf ? [] : [{ fg: true, long: true }]), ...(td ? [{ xp: true }] : [])]
      const live = i === 18 ? 1 : nf > 0 && inR(m, -14, 14) ? 1 : 0
      if (live) for (const c of fbClocks('deep-kick', i)) out.push(mk('deep-kick', i, m, ls, c, 1 / 4, -3 * nf - td, kicks))
      return out
    }
    let fit = pool.filter(g => fbFits(g, i, m, ls))
    if (!fit.length && i === 18) fit = pool.filter(g => g !== 'two-minute' && g !== 'goal-line' && g !== 'kick-return')
    if (!fit.length && i === 18) fit = pool
    if (!fit.length) return []
    return spread(freshOf(fit, used), i, m, ls, 1)
  })
  // the game before the moment, on the lean dp (his side's possessions are the even ones when it's his team's ball)
  const build = dp => {
    const Rp = fbRates(dp), ms = side === 'u' ? Rp.u : Rp.t, os = side === 'u' ? Rp.t : Rp.u, sgM = side === 'u' ? 1 : -1
    // (a kicker's state carries his team's field goal drives, up to four, and whether they've scored a touchdown)
    const stepM = M => { const nx = new Map(); for (const [key, p] of M) { const [m, ls, nf, td] = key.split('|').map(Number); for (const [x, q] of fbOut(ms)) add(nx, `${m + sgM * x}|${ls}|${kick ? Math.min(4, nf + (x === 3 ? 1 : 0)) : 0}|${kick && (td || x === 7) ? 1 : 0}`, p * q) } return nx }
    const stepO = M => { const nx = new Map(); for (const [key, p] of M) { const [m, , nf, td] = key.split('|').map(Number); for (const [x, q] of fbOut(os)) add(nx, `${m - sgM * x}|${trackLs ? x : 0}|${nf}|${td}`, p * q) } return nx }
    let init = new Map([['0|0|0|0', 1]])
    for (let j = 0; j < 8; j++) init = stepO(stepM(init))
    init = stepO(init)
    const kernel = memoK(key => [...stepO(stepM(new Map([[key, 1]])))])
    return { init, kernels: [kernel, kernel] }
  }
  const E = (dp, h) => { const { init, kernels } = build(dp); return expectOf(landing(init, kernels, branchesOf), branchesOf, h) }
  return {
    d, R, branchesOf, E,
    // the game's own path to its last possession on the lean, the scores at each checkpoint
    path(dp, r) {
      const Rp = fbRates(dp), at = []
      let mine = 0, opp = 0, ls = 0, nf = 0, td = 0
      const snap = () => at.push({ key: `${mine - opp}|${trackLs ? ls : 0}|${kick ? Math.min(4, nf) : 0}|${kick ? td : 0}`, mine, opp })
      for (let i = 1; i <= 21; i++) {
        if (i === 18 || i === 20) snap()
        const msPoss = i % 2 === 0, owner = msPoss === (side === 'u') ? 'u' : 't'
        const x = drawPair(r, fbOut(Rp[owner]))
        if (owner === 'u') { mine += x; if (x === 3) nf++; if (x === 7) td = 1 } else opp += x
        if (!msPoss) ls = x
      }
      snap()
      return at
    },
  }
}
const NUM = ['No', 'One', 'Two', 'Three', 'Four', 'Five']
// what his day at the tee is: the field goal tries his team's drives ended in, and the extra point
function kickTail(kicks) {
  if (!kicks?.length) return 'A long field goal try.'
  const fg = kicks.filter(k => !k.xp).length, xp = kicks.some(k => k.xp)
  if (fg === 1 && kicks[0].long && !xp) return 'A long field goal try.'
  const f = fg === 1 ? 'A field goal try' : `${NUM[fg] ?? fg} field goal tries`
  return xp ? (fg ? `${f} and an extra point.` : 'An extra point.') : `${f}.`
}
function fbSit(b, ids, mine, opp) {
  const { us, them } = ids, t = b.game, m = mine - opp
  const tail = t === 'two-minute' ? (m <= -8 ? 'Needs a touchdown and two.' : 'Needs a touchdown.')
    : t === 'goal-line' ? 'Fourth and goal at the five.'
    : t === 'sneak' ? 'Fourth and inches.'
    : t === 'third-long' ? 'Third and long.' : t === 'bomb' ? 'Time for a deep shot.'
    : t === 'kick-return' ? `${them} just scored. They kick it off.`
    : t === 'game-winner' ? (m <= -3 ? 'Field goal to tie it.' : 'Field goal for the win.')
    : t === 'deep-kick' ? kickTail(b.kicks)
    : t === 'onside' ? 'No timeouts. They need the ball back.'
    : FB_STOP.has(t) ? (m < 0 ? `${them} has the ball. ${us} needs a stop to get it back.` : `${them} has the ball. ${us} needs a stop.`)
    : FB_RUN.has(t) && m > 0 && b.i === 22 ? 'One more first down ends it.' : ''
  const clockText = mmss(b.clock)
  const before = t === 'deep-kick' && b.kicks?.length && !(b.kicks.length === 1 && b.kicks[0].long) ? ' before his kicks' : ''
  return { us, them, mine, opp, hoops: false, clock: b.clock, clockText, period: '4TH', line: `${where(us, them, mine, opp)}${before}, ${clockText} left in the 4th.`, tail }
}
function fbNote(R, ids, res, pick) {
  const { us, them } = ids
  if (res.ot) return res.ot === 'w' ? 'Won it in overtime.' : 'Lost it in overtime.'
  const last = res.ev[res.ev.length - 1]
  if (last) return `${last.side === 'u' ? us : them} ${last.pts === 7 ? 'scored a touchdown' : 'kicked a field goal'} ${last.T <= 5 ? 'on the last drive' : `with ${mmss(last.T)} left`}.`
  if (pick.tag === 'takeaway') return 'The takeaway ended it.'
  if (pick.tag === 'iced') return `${us} ran out the clock.`
  return null
}

// ═════════════════════════════════════════════════════════════════════════════
// BASKETBALL: 96 possessions a side, each worth 0 to 3
// ═════════════════════════════════════════════════════════════════════════════
const BK_POS = 96, BK_SEC = 2880 / BK_POS
function bkSide(d) {
  const e = Math.exp(clamp(d, -1.2, 0.55)), p3 = 0.12 * e, p2 = 0.38 * e, p1 = 0.045
  return [[3, p3], [2, p2], [1, p1], [0, 1 - p3 - p2 - p1]]
}
const BK_FT = [[2, 0.6], [1, 0.34], [0, 0.06]], BK_HEAVE = [[3, 0.05], [2, 0.08], [0, 0.87]]
// points over n possessions: an array (index: points)
function bkPts(side, n, cache) {
  if (cache[n]) return cache[n]
  let a = [1]
  for (let i = 0; i < n; i++) { const b = new Array(a.length + 3).fill(0); for (let x = 0; x < a.length; x++) if (a[x] > 1e-14) for (const [v, q] of side) b[x + v] += a[x] * q; a = b }
  return (cache[n] = a)
}
// win from margin m with a possessions left for his side and b for theirs (a tie goes to overtime: ot)
function bkCount(Rk, m, a, b) {
  const A = bkPts(Rk.u, a, Rk.cu), B = bkPts(Rk.t, b, Rk.ct)
  let w = 0, tie = 0
  const cum = []; let s = 0
  for (let y = 0; y < B.length; y++) { s += B[y]; cum[y] = s }
  for (let x = 0; x < A.length; x++) {
    if (A[x] < 1e-14) continue
    const need = m + x                         // he wins when their points y < need
    const lo = need - 1
    w += A[x] * (lo < 0 ? 0 : cum[Math.min(lo, B.length - 1)])
    if (need >= 0 && need < B.length) tie += A[x] * B[need]
  }
  return w + tie * Rk.ot
}
function bkRates(d) {
  const Rk = { u: bkSide(d), t: bkSide(-d), cu: {}, ct: {}, d }
  // overtime: five minutes, ten possessions a side; level again, again
  Rk.ot = 0.5
  const w10 = bkCount({ ...Rk, ot: 0 }, 0, 10, 10), l10 = bkCount({ ...Rk, u: Rk.t, t: Rk.u, cu: Rk.ct, ct: Rk.cu, ot: 0 }, 0, 10, 10)
  Rk.ot = w10 / Math.max(1e-9, w10 + l10)
  return Rk
}
const bkFull = d => bkCount(bkRates(d), 0, BK_POS, BK_POS)
const BK = {
  iso: { s: 'u', reps: 1, late: [-3, 2] }, 'half-court': { s: 'u', reps: 1, late: [-3, 2] }, 'post-up': { s: 'u', reps: 1, late: [-3, 2] },
  'clutch-shot': { s: 'u', reps: 1, late: [-3, 0], only: true, last: true }, 'free-throws': { s: 'u', reps: 1, late: [-2, 3], only: true },
  lockdown: { s: 't', reps: 1, late: [0, 3] },
  // (the trips a stretch of play gives him: as many as the game has in it, seeded. The lob and the boards are three a drill)
  pnr: { s: 'u', reps: 4, opts: [3, 4] }, 'fast-break': { s: 'u', reps: 3, opts: [2, 3] }, 'alley-oop': { s: 'u', reps: 3 }, 'rim-protect': { s: 't', reps: 4, opts: [3, 4] }, board: { s: 't', reps: 3 },
}
const repsOf = b => b.reps ?? BK[b.game].reps
// n trips, each one good at q: the points they add (per: points a good one is worth)
function trips(n, q, per, k = 'u') {
  let M = new Map([[0, 1]])
  for (let i = 0; i < n; i++) { const nx = new Map(); for (const [x, p] of M) for (const [v, w] of per) { add(nx, x + v, p * q * w); } for (const [x, p] of M) add(nx, x, p * (1 - q)); M = nx }
  return [...M].map(([x, p]) => ({ p, [k]: x }))
}
const BK_REM = [14, 6, 1]   // possessions a side left at each checkpoint: about 6:45, 2:50 and the last half-minute
function bkClocks(t, k) {
  if (k === 0) return [410, 395, 380, 365]
  if (k === 1) return [180, 168, 156, 146]
  if (t === 'clutch-shot') return [2.8]
  if (t === 'free-throws') return [5.5, 4, 2.6, 1.2]
  return [24, 19, 14, 9]
}
// the play: { p, u, t (points), lost (boards lost: their putbacks) }
function bkPlay(b, hit, F) {
  const t = b.game, m = b.m
  const list = (pairs, k = 'u') => pairs.map(([x, p]) => ({ p, [k]: x }))
  if (BK[t].s === 't') {
    if (t === 'board') {
      const lost = F?.reb != null ? Math.max(0, 3 - F.reb) : null
      const L = lost != null ? [[lost, 1]] : hit ? [[0, 0.6], [1, 0.4]] : [[1, 0.4], [2, 0.4], [3, 0.2]]
      // each board lost: their putback about half the time
      const C = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1]], out = []
      for (const [n, p] of L) for (let k = 0; k <= n; k++) out.push({ p: p * C[n][k] * 0.55 ** k * 0.45 ** (n - k), t: 2 * k, lost: n })
      return out
    }
    if (F?.allowed != null) return [{ p: 1, t: F.allowed }]
    if (t === 'lockdown') return [{ p: 1, t: hit ? 0 : 2 }]
    return trips(repsOf(b), hit ? 0.18 : 0.6, [[2, 1]], 't')   // (the rim: two each time one goes in over him)
  }
  if (F?.pts != null) return [{ p: 1, u: F.pts }]
  if (t === 'free-throws') return list(hit ? [[2, 1]] : [[1, 0.72], [0, 0.28]])
  if (t === 'clutch-shot') return list(hit ? (m <= -2 ? [[3, 1]] : [[2, 0.4], [3, 0.6]]) : [[0, 1]])
  if (t === 'half-court') return list(hit ? [[2, 0.7], [3, 0.3]] : [[0, 1]])
  if (t === 'pnr') return trips(repsOf(b), hit ? 0.82 : 0.35, [[2, 0.7], [3, 0.3]])
  if (t === 'fast-break' || t === 'alley-oop') return trips(repsOf(b), hit ? 0.85 : 0.3, [[2, 1]])
  return list(hit ? [[2, 1]] : [[0, 1]])   // (one trip: the iso, the post move)
}
// after the play: the last possession (late) or the rest of the quarter's
function bkAfter(Rk, b, o) {
  const m2 = b.m + (o.u ?? 0) - (o.t ?? 0), spec = BK[b.game]
  if (b.k < 2) return bkCount(Rk, m2, BK_REM[b.k] - (spec.s === 'u' ? repsOf(b) : 0), BK_REM[b.k] - (spec.s === 't' ? repsOf(b) : 0))
  if (spec.last) return endP(m2, Rk.ot)
  // the other side's last trip: ahead, they're fouled and go to the line; behind or level, a shot (a heave with under 4 left)
  const other = spec.s === 'u' ? 't' : 'u', left = b.game === 'free-throws' ? b.clock : b.clock - 7
  const lead = other === 'u' ? m2 > 0 : m2 < 0
  const poss = lead ? BK_FT : left < 4 ? BK_HEAVE : Rk[other]
  let w = 0
  for (const [x, q] of poss) w += q * endP(m2 + (other === 'u' ? x : -x), Rk.ot)
  return w
}
// a late moment landed that leaves his team ahead is the game: the other side's last trip comes up empty (owner 11-23,
// a player lost after landing the go-ahead shot: "if it's a game-winner clutch shot you should 100% win")
const bkSealed = (b, o, hit) => hit && b.k === 2 && b.m + (o.u ?? 0) - (o.t ?? 0) > 0
const bkW = (Rk, b, hit) => bkPlay(b, hit, null).reduce((s, o) => s + o.p * (bkSealed(b, o, hit) ? 1 : bkAfter(Rk, b, o)), 0)
function bkModel(ctx) {
  const { pool, used, hOf } = ctx
  const d = solve(bkFull, ctx.pGame, -1.2, 0.55)
  const Rk = bkRates(d)
  const mk = (game, k, m, clock, p, reps) => { const b = { p, game, k, m, clock, reps, h: hOf(game) }; b.wHit = bkW(Rk, b, true); b.wMiss = bkW(Rk, b, false); return b }
  const branchesOf = memo1((k, key) => {
    const m = Number(key)
    let fit = pool.filter(g => BK[g] && (k === 2 ? !!BK[g].late && inR(m, ...BK[g].late) : !BK[g].only && (k === 0 || inR(m, -8, 8))))
    if (!fit.length && k === 0) fit = pool.filter(g => BK[g] && !BK[g].only)
    if (!fit.length && k === 0) fit = pool.filter(g => BK[g])
    if (!fit.length) return []
    const list = freshOf(fit, used)
    return list.flatMap(g => { const cl = bkClocks(g, k), ro = BK[g].opts ?? [BK[g].reps]; return cl.flatMap(c => ro.map(n => mk(g, k, m, c, 1 / list.length / cl.length / ro.length, n))) })
  })
  const delta = (Rp, n) => { const A = bkPts(Rp.u, n, Rp.cu), B = bkPts(Rp.t, n, Rp.ct), out = new Map(); for (let x = 0; x < A.length; x++) if (A[x] > 1e-13) for (let y = 0; y < B.length; y++) if (B[y] > 1e-13) add(out, x - y, A[x] * B[y]); return out }
  const build = dp => {
    const Rp = { u: bkSide(dp), t: bkSide(-dp), cu: {}, ct: {} }
    const init = new Map([...delta(Rp, BK_POS - BK_REM[0])].map(([m, p]) => [String(m), p]))
    const k1 = delta(Rp, BK_REM[0] - BK_REM[1]), k2 = delta(Rp, BK_REM[1] - BK_REM[2])
    const kern = D => memoK(key => { const m = Number(key), out = []; for (const [x, p] of D) out.push([String(m + x), p]); return out })
    return { init, kernels: [kern(k1), kern(k2)], Rp }
  }
  const E = (dp, h) => { const { init, kernels } = build(dp); return expectOf(landing(init, kernels, branchesOf), branchesOf, h) }
  return {
    d, R: Rk, branchesOf, E,
    path(dp, r) {
      const U = bkSide(dp), T = bkSide(-dp), at = []
      let mine = 0, opp = 0
      for (let i = 0; i < BK_POS - 1; i++) {
        if (i === BK_POS - BK_REM[0] || i === BK_POS - BK_REM[1]) at.push({ key: String(mine - opp), mine, opp })
        mine += drawPair(r, U); opp += drawPair(r, T)
      }
      at.push({ key: String(mine - opp), mine, opp })
      return at
    },
  }
}
// the rest, played: the possessions left (late: the other side's last trip), overtime
function bkRest(Rk, b, o, r) {
  const spec = BK[b.game], add2 = { u: 0, t: 0 }
  let m2 = b.m + (o.u ?? 0) - (o.t ?? 0), last = null
  if (b.k < 2) {
    let a = BK_REM[b.k] - (spec.s === 'u' ? repsOf(b) : 0), c = BK_REM[b.k] - (spec.s === 't' ? repsOf(b) : 0)
    while (a > 0 || c > 0) {
      if (a > 0) { const x = drawPair(r, Rk.u); add2.u += x; a--; if (x) last = { side: 'u', x } }
      if (c > 0) { const x = drawPair(r, Rk.t); add2.t += x; c--; if (x) last = { side: 't', x } }
    }
  } else if (!spec.last) {
    const other = spec.s === 'u' ? 't' : 'u', left = b.game === 'free-throws' ? b.clock : b.clock - 7
    const lead = other === 'u' ? m2 > 0 : m2 < 0
    const x = drawPair(r, lead ? BK_FT : left < 4 ? BK_HEAVE : Rk[other])
    add2[other] += x
    if (x) last = { side: other, x, ft: lead }
  }
  m2 += add2.u - add2.t
  let ot = null
  for (let n = 0; m2 === 0 && n < 4; n++) {
    let a = 0, c = 0
    for (let i = 0; i < 10; i++) { a += drawPair(r, Rk.u); c += drawPair(r, Rk.t) }
    add2.u += a; add2.t += c; m2 += a - c; ot = n + 1
  }
  if (m2 === 0) { if (r() < Rk.ot) add2.u += 2; else add2.t += 2; m2 = add2.u - add2.t + b.m + (o.u ?? 0) - (o.t ?? 0) }
  return { u: add2.u, t: add2.t, ot, last }
}
function bkSit(b, ids, mine, opp) {
  const { us, them } = ids, t = b.game, late = b.k === 2
  const clockText = b.clock < 10 ? b.clock.toFixed(1) : mmss(b.clock)
  const tail = BK[t].s === 't' ? (t === 'board' ? 'The shot goes up.' : mine >= opp ? `${them} has the ball. ${us} needs a stop.` : `${them} has the ball. ${us} needs a stop to get it back.`)
    : t === 'clutch-shot' ? (late ? 'One shot left.' : 'The shot clock is winding down.') : t === 'free-throws' ? 'Two shots at the line.'
    : t === 'fast-break' ? 'A steal, and they’re running.' : t === 'half-court' && late ? 'One possession. Get a bucket.' : ''
  return { us, them, mine, opp, hoops: true, clock: b.clock, clockText, period: '4TH', line: `${where(us, them, mine, opp)}, ${clockText} left in the 4th.`, tail }
}

// ═════════════════════════════════════════════════════════════════════════════
// SOCCER: goals by the minute, extra time, penalties; the deciding leg of a tie
// ═════════════════════════════════════════════════════════════════════════════
const SC_RATE = 1.32 / 90, SC_END = 93, SC_HOME = 0.12
const pois = (lam, n = Math.max(9, Math.ceil(lam + 6 * Math.sqrt(lam) + 4))) => { const out = []; let p = Math.exp(-lam); for (let k = 0; k <= n; k++) { out.push(p); p *= lam / (k + 1) } return out }
function scDelta(lu, lt) { const A = pois(lu), B = pois(lt), out = new Map(); for (let a = 0; a < A.length; a++) for (let b = 0; b < B.length; b++) add(out, a - b, A[a] * B[b]); return out }
const scPens = d => clamp(0.5 + 0.06 * d, 0.38, 0.62)
const scLam = (d, home) => { const h = home === true ? SC_HOME : home === false ? -SC_HOME : 0; return { u: SC_RATE * Math.exp(d + h), t: SC_RATE * Math.exp(-d - h) } }
const convD = (A, B) => { const out = new Map(); for (const [x, p] of A) for (const [y, q] of B) add(out, x + y, p * q); return out }
const legHome = (home, leg) => (home == null ? null : leg === 1 ? !home : home)
// from aggregate margin m at minute t of a leg (leg 1 of two: the rest of it, then all of the second): extra time in
// the second leg when it's level, then penalties
function scV(d, m, t, home, leg = 2) {
  const Lc = scLam(d, legHome(home, leg)), L2 = scLam(d, home), mins = Math.max(0.5, SC_END - t)
  let D = scDelta(Lc.u * mins, Lc.t * mins)
  if (leg === 1) D = convD(D, scDelta(L2.u * 90, L2.t * 90))
  const E = scDelta(L2.u * 30, L2.t * 30)
  let w = 0
  for (const [x, p] of D) {
    const m2 = m + x
    if (m2 !== 0) { w += m2 > 0 ? p : 0; continue }
    for (const [y, q] of E) w += p * q * (y > 0 ? 1 : y < 0 ? 0 : scPens(d))
  }
  return w
}
const scFull = (d, legs, home) => scV(d, 0, SC_END - 90, home, legs === 2 ? 1 : 2)
const SC_CP = [60, 72, 85]
const scMinutes = k => (k === 0 ? [56, 59, 62, 64] : k === 1 ? [68, 70, 73, 76] : [82, 84, 86, 88, 90, 92])
// (a two-legged tie: the moment in the first leg about a third of the time, in the second the rest)
const SC_LEG1 = 0.35
// (the tie is still on at the hour mark, two goals in it at most: before 2026-11-25 a moment could come with the tie gone,
// 0-5 down on aggregate, and finish 0-9)
const SC_OPEN = 2
function scModel(ctx) {
  const { pool, used, hOf, legs, home } = ctx
  const d = solve(x => scFull(x, legs, home), ctx.pGame, -1.5, 1.5)
  const LEGS = legs === 2 ? [[1, SC_LEG1], [2, 1 - SC_LEG1]] : [[2, 1]]
  const mk = (game, k, m, minute, p, leg) => { const b = { p, game, k, m, minute, leg, h: hOf(game) }; b.wHit = scV(d, m + 1, minute, home, leg); b.wMiss = scV(d, m, minute, home, leg); return b }
  const branchesOf = memo1((k, key) => {
    const [leg, m] = key.split('|').map(Number)
    // live: late in the second leg (or a final) a goal has to swing it; in a first leg, anything but a rout
    if (leg === 2 && ((k === 2 && !inR(m, -1, 1)) || (k === 1 && !inR(m, -2, 1)))) return []
    if (leg === 1 && k > 0 && !inR(m, -2, 2)) return []
    const list = freshOf(pool, used), mins = scMinutes(k)
    return list.flatMap(g => mins.map(t => mk(g, k, m, t, 1 / list.length / mins.length, leg)))
  })
  const build = (dp, leg) => {
    const L1 = scLam(dp, legHome(home, 1)), Lc = scLam(dp, legHome(home, leg))
    let M = new Map([[0, 1]])
    if (legs === 2 && leg === 2) M = scDelta(L1.u * 90, L1.t * 90)
    const init = new Map()
    for (const [m, p] of convD(M, scDelta(Lc.u * SC_CP[0], Lc.t * SC_CP[0]))) if (inR(m, -SC_OPEN, SC_OPEN)) add(init, `${leg}|${m}`, p)
    const tot = [...init.values()].reduce((s, p) => s + p, 0)
    for (const [k, p] of init) init.set(k, p / tot)
    const kern = mins => { const D = scDelta(Lc.u * mins, Lc.t * mins); return memoK(key => { const m = Number(key.split('|')[1]); return [...D].map(([x, p]) => [`${leg}|${m + x}`, p]) }) }
    return { init, kernels: [kern(SC_CP[1] - SC_CP[0]), kern(SC_CP[2] - SC_CP[1])] }
  }
  const E = (dp, h) => LEGS.reduce((s, [leg, w]) => { const { init, kernels } = build(dp, leg); return s + w * expectOf(landing(init, kernels, branchesOf), branchesOf, h) }, 0)
  const goals = (r, lam) => { let n = 0, p = Math.exp(-lam), s = p; const u = r(); while (u > s && n < 12) { n++; p *= lam / n; s += p } return n }
  return {
    d, branchesOf, E, span: 1.2,   // (the lean stays where the hour-mark cut is sound: past it E stops rising)
    path(dp, r) {
      const leg = legs === 2 && r() < SC_LEG1 ? 1 : 2
      const L1 = scLam(dp, legHome(home, 1)), Lc = scLam(dp, legHome(home, leg))
      // (the hour mark with the tie still on: replayed until it is, the way build's init is cut)
      for (let n = 0; ; n++) {
        const leg1 = legs === 2 && leg === 2 ? [goals(r, L1.u * 90), goals(r, L1.t * 90)] : null
        let mine = 0, opp = 0, t0 = 0
        const at = [], base = leg1 ? leg1[0] - leg1[1] : 0
        for (const t of SC_CP) { mine += goals(r, Lc.u * (t - t0)); opp += goals(r, Lc.t * (t - t0)); t0 = t; at.push({ key: `${leg}|${base + mine - opp}`, mine, opp, leg1, leg, legs }) }
        if (inR(base + at[0].mine - at[0].opp, -SC_OPEN, SC_OPEN) || n > 200) return at
      }
    },
    // the rest: of this leg, of the second one when this is the first, extra time, penalties
    rest(b, scored, r) {
      const Lc = scLam(d, legHome(home, b.leg)), L2 = scLam(d, home), mins = Math.max(0.5, SC_END - b.minute)
      const cur = { u: goals(r, Lc.u * mins), t: goals(r, Lc.t * mins) }
      const next = b.leg === 1 ? { u: goals(r, L2.u * 90), t: goals(r, L2.t * 90) } : null
      let m2 = b.m + scored + cur.u - cur.t + (next ? next.u - next.t : 0), et = null, pens = null
      const last = next ?? cur
      if (m2 === 0) {
        const eu = goals(r, L2.u * 30), etm = goals(r, L2.t * 30)
        last.u += eu; last.t += etm; m2 += eu - etm; et = eu + etm > 0
        if (m2 === 0) pens = r() < scPens(d) ? 'won' : 'lost'
      }
      return { cur, next, et, pens, won: m2 > 0 || pens === 'won', u: cur.u + (next?.u ?? 0), t: cur.t + (next?.t ?? 0) }
    },
  }
}
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six']
function scSit(b, ids, mine, opp, leg1, first) {
  const { us, them } = ids, minute = b.minute, extra = minute - 90
  const clockText = extra > 0 ? `90+${extra}'` : `${minute}'`
  const when = extra > 0 ? `${extra === 1 ? 'a minute' : `${WORDS[extra]} minutes`} into stoppage time` : `${ordinal(minute)} minute`
  const night = mine === opp ? `${us} and ${them} level at ${mine}-${opp}` : mine > opp ? `${us} lead ${them} ${mine}-${opp}` : `${us} trail ${them} ${mine}-${opp}`
  const agg = leg1 ? `, ${mine + leg1[0]}-${opp + leg1[1]} on aggregate` : ''
  const TAIL = { penalty: 'Penalty.', 'one-on-one': 'Through on goal.', header: 'A cross coming in.', volley: 'It drops in the box.', 'free-kick': 'Free kick on the edge of the area.', 'two-on-one': 'Two on one on the break.' }
  return { us, them, mine, opp, hoops: false, soccer: true, clock: minute, minute, clockText, period: '2ND', leg: first ? 1 : 2, line: `${first ? 'First leg. ' : ''}${night}${agg}, ${when}.`, tail: TAIL[b.game] ?? '' }
}

// ═════════════════════════════════════════════════════════════════════════════
// BASEBALL: at-bat by at-bat inside the moment's inning, half-innings around it
// ═════════════════════════════════════════════════════════════════════════════
// a plate appearance, league-wide (K 22.5%, BB 8.5%, .245/.315/.405 or so), the hits and walks up or down by edge e
const PA0 = [['K', 0.225], ['O', 0.455], ['BB', 0.085], ['1B', 0.145], ['2B', 0.045], ['3B', 0.005], ['HR', 0.04]]
function paOf(e) {
  const k = Math.exp(e), on = PA0.slice(2).map(([x, p]) => [x, p * k]), onS = on.reduce((s, x) => s + x[1], 0), sc = Math.min(1, 0.6 / onS)
  const ons = on.map(([x, p]) => [x, p * sc]), left = 1 - ons.reduce((s, x) => s + x[1], 0)
  return [['K', left * 0.33], ['O', left * 0.67], ...ons]
}
const B1 = 1, B2 = 2, B3 = 4
const nOn = b => (b & 1) + ((b >> 1) & 1) + ((b >> 2) & 1)
// what a result does: [p, outs after, bases after, runs]
function paMove(kind, o, b) {
  const f = b & B1, s = b & B2, t = b & B3
  if (kind === 'K') return [[1, o + 1, b, 0]]
  if (kind === 'HR') return [[1, o, 0, nOn(b) + 1]]
  if (kind === '3B') return [[1, o, B3, nOn(b)]]
  if (kind === '2B') { const base = (t ? 1 : 0) + (s ? 1 : 0); return f ? [[0.4, o, B2, base + 1], [0.6, o, B2 | B3, base]] : [[1, o, B2, base]] }
  if (kind === '1B') { const r3 = t ? 1 : 0; return s ? [[0.6, o, B1 | (f ? B2 : 0), r3 + 1], [0.4, o, B1 | B3 | (f ? B2 : 0), r3]] : [[1, o, B1 | (f ? B2 : 0), r3]] }
  if (kind === 'BB') { if (!f) return [[1, o, b | B1, 0]]; if (!s) return [[1, o, b | B1 | B2, 0]]; if (!t) return [[1, o, B1 | B2 | B3, 0]]; return [[1, o, b, 1]] }
  if (kind === 'SF') return [[1, o + 1, b & ~B3, t && o < 2 ? 1 : 0]]
  if (kind === 'DP') return [[1, o + 2, (b & ~B1), 0]]
  // a ball in play for an out: with less than two out, a double play off a man on first, a run in from third
  if (o >= 2) return [[1, 3, b, 0]]
  const out = []
  let rest = 1
  if (f) { out.push([0.14, o + 2, b & ~B1, 0]); rest -= 0.14 }
  if (t) { out.push([rest * 0.35, o + 1, (b & ~B3), 1]); rest *= 0.65 }
  out.push([rest, o + 1, s && !t ? (b & ~B2) | B3 : b, 0])
  return out
}
// the runs a half-inning adds from (outs, bases) on: an array (index: runs, 9 for 9 or more)
function halfRuns(PA, o0, b0, cache) {
  const id = `${o0}|${b0}`
  if (cache[id]) return cache[id]
  const done = new Array(10).fill(0)
  let live = new Map([[`${o0}|${b0}|0`, 1]])
  for (let it = 0; it < 80 && live.size; it++) {
    const nx = new Map()
    for (const [key, p] of live) {
      const [o, b, r] = key.split('|').map(Number)
      for (const [kind, q] of PA) for (const [pp, o2, b2, dr] of paMove(kind, o, b)) {
        const w = p * q * pp
        if (o2 >= 3) done[r] += w
        else add(nx, `${o2}|${b2}|${Math.min(9, r + dr)}`, w)
      }
    }
    live = new Map([...nx].filter(([, p]) => p > 1e-11))
  }
  return (cache[id] = done)
}
// a half: 0-17 (inning h/2 + 1, the top on even). us bats the bottom at home
const halfInn = h => Math.floor(h / 2) + 1
function bsRates(d) { return { u: { PA: paOf(d), c: {} }, t: { PA: paOf(-d), c: {} }, d } }
const bsBat = (home, h) => ((h % 2 === 1) === home ? 'u' : 't')
// after half h ends, margin m (his side's): the rest of the game
function bsAfter(R, home, h, m, memo) {
  const bottom = h % 2 === 1, inn = halfInn(h)
  if (bottom && inn >= 9 && m !== 0) return m > 0 ? 1 : 0
  if (bottom && inn >= 9) return R.x
  if (!bottom && inn >= 9 && (home ? m > 0 : m < 0)) return m > 0 ? 1 : 0   // (the home side ahead after the top of the 9th)
  return bsFrom(R, home, h + 1, m, memo)
}
function bsFrom(R, home, h, m, memo) {
  const key = `${h}|${m}`
  let v = memo.get(key)
  if (v != null) return v
  const side = bsBat(home, h), dist = halfRuns(R[side].PA, 0, 0, R[side].c)
  v = 0
  for (let x = 0; x < dist.length; x++) if (dist[x] > 1e-12) v += dist[x] * bsAfter(R, home, h, m + (side === 'u' ? x : -x), memo)
  memo.set(key, v)
  return v
}
// mid-half: (outs, bases) with side batting in half h. In the bottom of the 9th or later the game ends when the home
// side goes ahead (the runs after the winning one don't change who won)
function bsMid(R, home, h, o, b, m, memo) {
  const bottom = h % 2 === 1
  if (bottom && halfInn(h) >= 9 && (home ? m > 0 : m < 0)) return m > 0 ? 1 : 0
  if (o >= 3) return bsAfter(R, home, h, m, memo)
  const side = bsBat(home, h), dist = halfRuns(R[side].PA, o, b, R[side].c)
  let v = 0
  for (let x = 0; x < dist.length; x++) if (dist[x] > 1e-12) v += dist[x] * bsAfter(R, home, h, m + (side === 'u' ? x : -x), memo)
  return v
}
function bsExtras(R) {
  const A = halfRuns(R.t.PA, 0, 0, R.t.c), B = halfRuns(R.u.PA, 0, 0, R.u.c)
  let w = 0, l = 0
  for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) { if (b > a) w += A[a] * B[b]; else if (a > b) l += A[a] * B[b] }
  return w / (w + l)
}
function bsGame(d, home) { const R = bsRates(d); R.x = bsExtras(R); return { R, w: bsFrom(R, home, 0, 0, new Map()) } }
// the moments: who bats, and where in the inning each one is (m: his side's margin as it comes up)
const BS_BAT = new Set(['at-bat', 'walk-off', 'steal-second'])
function bsFits(t, ctx, h, o, b, m, relax) {
  const bottom = h % 2 === 1, inn = halfInn(h)
  if (t === 'walk-off') return ctx.home && bottom && inn >= 9 && m <= 0 && nOn(b) >= 1 - m   // (the winning run on base)
  if (t === 'at-bat') return (relax || inR(m, -3, 2)) && (nOn(b) >= 1 || inR(m, -1, 0))
  if (t === 'steal-second') return b === B1 && o < 2 && (relax || inR(m, -2, 0))
  if (t === 'strike-out') return !!(b & B3) && o < 2 && (relax || inR(m, -1, 3))
  if (t === 'escape-jam') return b === 7 && o === 1 && (relax || inR(m, -1, 4))
  return false
}
// the play: [p, outs after, bases after, runs (for the side batting)]
function bsPlay(t, o, b, hit, raw) {
  const R = raw && typeof raw === 'object' ? raw : null
  if (t === 'steal-second') return hit ? [[1, o, B2, 0]] : [[1, o + 1, 0, 0]]
  // the moment's own report: the runs that scored and the outs made; the men left on from what the ball did
  if (R && (Number.isFinite(R.runs) || Number.isFinite(R.pts))) {
    const runs = Number.isFinite(R.runs) ? R.runs : R.pts, outs = Number.isFinite(R.outs) ? R.outs : (['K', 'GO', 'FO', 'LO', 'PO', 'SF', 'FC'].includes(R.result) ? 1 : R.result === 'DP' ? 2 : 0)
    const o2 = Math.min(3, o + outs)
    if (o2 >= 3) return [[1, 3, 0, runs]]
    const kind = { GO: 'O', FO: 'O', LO: 'K', PO: 'K', FC: 'O' }[R.result] ?? R.result
    const mv = PA_KINDS.has(kind) ? paMove(kind, o, b).sort((x, y) => Math.abs(x[3] - runs) - Math.abs(y[3] - runs))[0] : null
    let b2 = mv ? mv[2] : b
    // (the bases can't hold more men than came up, less the runs and the outs)
    while (nOn(b2) > nOn(b) + 1 - runs - outs && b2) b2 &= b2 - 1
    return [[1, o2, b2, runs]]
  }
  const mix = list => list.flatMap(([kind, p]) => paMove(kind, o, b).map(([q, o2, b2, r]) => [p * q, o2, b2, r]))
  if (t === 'strike-out') return hit ? mix([['K', 1]]) : mix([['SF', 0.35], ['1B', 0.45], ['BB', 0.2]])
  if (t === 'escape-jam') return hit ? [[1, 3, 0, 0]] : mix([['1B', 0.4], ['BB', 0.3], ['SF', 0.3]])
  return hit ? mix([['1B', 0.55], ['2B', 0.2], ['HR', 0.1], ['BB', 0.15]]) : mix([['K', 0.45], ['O', 0.55]])
}
const PA_KINDS = new Set(['K', 'O', 'BB', '1B', '2B', '3B', 'HR', 'SF', 'DP'])
const bsW = (R, home, b, hit, memo) => bsPlay(b.game, b.o, b.b, hit, null).reduce((s, [p, o2, b2, x]) => s + p * bsMid(R, home, b.hf, o2, b2, b.m + (b.bat === 'u' ? x : -x), memo), 0)
// The inning his moment comes in, at-bat by at-bat until it does: the states it can come up in, conditioned on it
// coming up (the inning is the one it came in). { key: 'o|b|r' (r: runs scored in the half before it) → p }
function bsAbsorb(PA, ctx, h, m0, sideSign, relax) {
  const fits = (o, b, r) => ctx.pool.filter(t => bsFits(t, ctx, h, o, b, m0 + sideSign * r, relax))
  // (the bottom of the 9th or later: the home side going ahead ends the game, and there's no moment after it)
  const late = h % 2 === 1 && halfInn(h) >= 9
  let live = new Map([['0|0|0', 1]])
  const got = new Map()
  for (let it = 0; it < 60 && live.size; it++) {
    const nx = new Map()
    for (const [key, p] of live) {
      const [o, b, r] = key.split('|').map(Number)
      if (fits(o, b, r).length) { add(got, key, p); continue }
      for (const [kind, q] of PA) for (const [pp, o2, b2, dr] of paMove(kind, o, b)) {
        const r2 = Math.min(9, r + dr)
        if (o2 < 3 && !(late && sideSign * (m0 + sideSign * r2) > 0)) add(nx, `${o2}|${b2}|${r2}`, p * q * pp)
      }
    }
    live = new Map([...nx].filter(([, p]) => p > 1e-11))
  }
  const tot = [...got.values()].reduce((s, p) => s + p, 0)
  return { got, tot, fits }
}
function bsModel(ctx) {
  const { pool, used, hOf, home } = ctx
  const d = solve(x => bsGame(x, home).w, ctx.pGame, -1.5, 1.5)
  const { R } = bsGame(d, home)
  R.x = bsExtras(R)
  const memo = new Map()
  const bat = pool.some(g => BS_BAT.has(g)) ? 'u' : 't'
  const msHome = bat === 'u' ? home : !home
  const HS = [7, 8, 9].map(n => 2 * n - (msHome ? 1 : 2))   // his side's half in the 7th, 8th and 9th
  const sg = bat === 'u' ? 1 : -1
  const branchesOf = memo1((k, key) => {
    const m = Number(key), h = HS[k], bottom = h % 2 === 1
    if (bottom && halfInn(h) >= 9 && (home ? m > 0 : m < 0)) return []   // (the home side ahead: no bottom of the 9th)
    const relax = k === 0
    if (!relax && !(bat === 'u' ? inR(m, -4, 2) : inR(m, -2, 4))) return []
    const { got, tot, fits } = bsAbsorb(R[bat].PA, ctx, h, m, sg, relax)
    if (tot < 1e-7) {
      if (k) return []
      const x = { p: 1, game: pool[0], hf: h, o: 0, b: 0, r: 0, m, m0: m, bat, h: hOf(pool[0]) }
      x.wHit = bsW(R, home, x, true, memo); x.wMiss = bsW(R, home, x, false, memo)
      return [x]
    }
    const out = []
    for (const [s, p] of got) {
      const [o, b, r] = s.split('|').map(Number), list = freshOf(fits(o, b, r), used)
      for (const g of list) {
        const x = { p: p / tot / list.length, game: g, hf: h, o, b, r, m: m + sg * r, m0: m, bat, h: hOf(g) }
        x.wHit = bsW(R, home, x, true, memo); x.wMiss = bsW(R, home, x, false, memo)
        out.push(x)
      }
    }
    return out
  })
  const runsDelta = (dp, side) => { const Rp = bsRates(dp); return halfRuns(Rp[side].PA, 0, 0, Rp[side].c) }
  const build = dp => {
    const U = runsDelta(dp, 'u'), T = runsDelta(dp, 't')
    let M = new Map([[0, 1]])
    for (let hh = 0; hh < HS[0]; hh++) { const D = bsBat(home, hh) === 'u' ? U : T, s = bsBat(home, hh) === 'u' ? 1 : -1, nx = new Map(); for (const [m, p] of M) for (let x = 0; x < 10; x++) add(nx, m + s * x, p * D[x]); M = nx }
    const init = new Map([...M].map(([m, p]) => [String(m), p]))
    // two halves between his: his own, then theirs
    const kern = memoK(key => { const m = Number(key), Ms = bat === 'u' ? U : T, Os = bat === 'u' ? T : U, out = new Map(); for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) add(out, String(m + sg * x - sg * y), Ms[x] * Os[y]); return [...out] })
    return { init, kernels: [kern, kern] }
  }
  const E = (dp, hh) => { const { init, kernels } = build(dp); return expectOf(landing(init, kernels, branchesOf), branchesOf, hh) }
  return {
    d, R, branchesOf, E, HS, bat, sg,
    path(dp, r) {
      const Rp = bsRates(dp), at = []
      let mine = 0, opp = 0
      for (let hh = 0; hh < HS[2]; hh++) {
        if (HS.includes(hh)) at.push({ key: String(mine - opp), mine, opp })
        const s = bsBat(home, hh), dist = halfRuns(Rp[s].PA, 0, 0, Rp[s].c)
        const x = drawPair(r, dist.map((p, i) => [i, p]))
        if (s === 'u') mine += x; else opp += x
      }
      at.push({ key: String(mine - opp), mine, opp })
      return at
    },
    // the inning up to his moment, at-bat by at-bat, conditioned on it coming up (the same states bsAbsorb counts)
    inning(b0, r, relax) {
      const PA = R[bat].PA, fits = (o, b, x) => pool.filter(t => bsFits(t, ctx, b0.hf, o, b, b0.m0 + sg * x, relax))
      for (let tries = 0; tries < 400; tries++) {
        let o = 0, b = 0, x = 0
        for (let n = 0; n < 40 && o < 3; n++) {
          if (fits(o, b, x).length) return { o, b, r: x }
          const kind = drawPair(r, PA), mv = paMove(kind, o, b), u = r()
          let acc = 0, pick = mv[mv.length - 1]
          for (const v of mv) { acc += v[0]; if (u < acc) { pick = v; break } }
          o = pick[1]; b = pick[2]; if (o < 3) x += pick[3]
          if (b0.hf % 2 === 1 && halfInn(b0.hf) >= 9 && sg * (b0.m0 + sg * x) > 0) break   // (walked off: that game is over)
        }
      }
      return null
    },
  }
}
// the rest of the game, played: the half from (outs, bases), then the halves left (a walk-off stops on the winning run)
function bsRest(R, home, h, o, b, mine, opp, r) {
  let ev = []
  const bump = (side, x, hh) => { if (!x) return; if (side === 'u') mine += x; else opp += x; ev.push({ side, x, inn: halfInn(hh), bottom: hh % 2 === 1 }) }
  const walkOff = hh => hh % 2 === 1 && halfInn(hh) >= 9 && (home ? mine > opp : opp > mine)
  // the current half, at-bat by at-bat
  {
    const side = bsBat(home, h), PA = R[side].PA
    for (let n = 0; n < 40 && o < 3 && !walkOff(h); n++) {
      const kind = drawPair(r, PA), mv = paMove(kind, o, b), u = r()
      let acc = 0, pick = mv[mv.length - 1]
      for (const v of mv) { acc += v[0]; if (u < acc) { pick = v; break } }
      o = pick[1]; b = pick[2]
      if (o < 3) bump(side, pick[3], h)
    }
  }
  let extras = false
  for (let hh = h + 1; hh < 40; hh++) {
    const prev = hh - 1, bottom = prev % 2 === 1
    if (bottom && halfInn(prev) >= 9 && mine !== opp) break
    if (walkOff(prev)) break
    if (hh % 2 === 1 && halfInn(hh) >= 9 && (home ? mine > opp : opp > mine)) break   // (no bottom of the 9th)
    if (halfInn(hh) > 9) extras = true
    const side = bsBat(home, hh), dist = halfRuns(R[side].PA, 0, 0, R[side].c)
    let x = drawPair(r, dist.map((p, i) => [i, p]))
    // (a walk-off: the game's over on the winning run, a homer counts all of them)
    if (hh % 2 === 1 && halfInn(hh) >= 9) { const need = side === 'u' ? opp - mine + 1 : mine - opp + 1; if (x >= need && need > 0 && r() < 0.7) x = need }
    bump(side, x, hh)
  }
  if (mine === opp) { if (r() < R.x) mine++; else opp++; extras = true }
  return { mine, opp, ev, extras }
}
const OUTS_W = ['nobody out', 'one out', 'two out']
const ON_W = { 0: 'bases empty', 1: 'a runner on first', 2: 'a runner on second', 4: 'a runner on third', 3: 'runners on first and second', 5: 'runners on the corners', 6: 'runners on second and third', 7: 'bases loaded' }
function bsSit(b, ids, mine, opp, ctx) {
  const { us, them } = ids, half = b.hf % 2 === 1 ? 'B' : 'T', inning = halfInn(b.hf)
  const [balls, strikes] = b.game === 'walk-off' ? [[1, 2], [2, 2]][b.o % 2] : [0, 0]
  const count = balls || strikes ? `, ${balls}-${strikes} count` : ''
  const TAIL = {
    'walk-off': 'Two strikes. The winning run is on.', 'at-bat': 'A big at-bat.', 'steal-second': 'He’s on first. Get into scoring position.',
    'strike-out': 'A runner on third: he needs a strikeout.', 'escape-jam': 'Bases loaded, one out. A strikeout or a ground ball.',
  }
  const on = [!!(b.b & B1), !!(b.b & B2), !!(b.b & B3)]
  const line = `${ctx.gameNo ? `Game ${ctx.gameNo}. ` : ''}${half === 'B' ? 'Bottom' : 'Top'} of the ${ordinal(inning)}, ${OUTS_W[b.o]}, ${ON_W[b.b]}${count}. ${where(us, them, mine, opp)}.`
  return { us, them, mine, opp, hoops: false, baseball: true, def: b.bat === 't', inning, half, outs: b.o, on, balls, strikes, clock: inning, clockText: `${half === 'B' ? 'BOT' : 'TOP'} ${inning}`, period: ordinal(inning).toUpperCase(), line, tail: TAIL[b.game] ?? '', gameNo: ctx.gameNo ?? null, home: !!ctx.home }
}

// ═════════════════════════════════════════════════════════════════════════════
// The round's moment: plan it (the game to it, the state, the play dealt), then play it (what he did, the rest)
// ═════════════════════════════════════════════════════════════════════════════
// ctx: { sport: 'nfl' | 'hoops' | 'soccer' | 'baseball', seed, pGame (the game's win chance), pool (the plays his
// position has, after Simple mode's filter), used (the ones played already this postseason), hOf(game) (his rate),
// us, them, legs / home (soccer), home / gameNo (baseball) }
const MODELS = { nfl: fbModel, hoops: bkModel, soccer: scModel, baseball: bsModel }
const SOLVED = new Map(), PLANS = new Map()
const keep = (M, id, v) => { if (M.size > 80) M.delete(M.keys().next().value); M.set(id, v); return v }
// the model and the lean (the same for every seed with these teams, this build, these plays)
function solved(ctx) {
  const id = JSON.stringify([ctx.sport, ctx.pGame, ctx.pool, ctx.used, ctx.pool.map(g => Math.round(ctx.hOf(g) * 1000)), ctx.legs ?? null, ctx.home ?? null])
  if (SOLVED.has(id)) return SOLVED.get(id)
  const M = MODELS[ctx.sport](ctx)
  const hSim = b => b.h
  // where moments land: the lean that keeps the game won as often as it is with no moments, at his usual rate
  const dPre = solve(x => M.E(x, hSim), ctx.pGame, M.d - (M.span ?? 2.5), M.d + (M.span ?? 2.5), 26)
  return keep(SOLVED, id, { M, dPre, all: M.E(dPre, hSim) })
}
// the snaps a multi-snap drill plays in this spot: the drive it's in (a short clock is fewer of them)
const FB_REPS = new Set(['hot-read', 'gap', 'jump-route', 'zone-drop', 'hit-stick', 'run-stuff'])
// a field goal try's distance, the way the league's tries fall (the long one: a drive that stalled out at 50-plus)
const KICK_D = [[22, 0.1], [27, 0.12], [33, 0.14], [38, 0.14], [43, 0.15], [47, 0.14], [51, 0.12], [55, 0.09]]
export function planMoment(ctx) {
  const id = JSON.stringify([ctx.seed, ctx.sport, ctx.pGame, ctx.pool, ctx.used, ctx.pool.map(g => Math.round(ctx.hOf(g) * 1000)), ctx.legs ?? null, ctx.home ?? null, ctx.gameNo ?? null, ctx.us, ctx.them])
  if (PLANS.has(id)) return PLANS.get(id)
  const { M, dPre, all } = solved(ctx)
  const r = seeded(`ig-${ctx.seed}`)
  const at = M.path(dPre, r), coins = at.map(() => r())
  const { k, branch } = landOn(at.map(x => x.key), coins, M.branchesOf)
  const ids = { us: ctx.us, them: ctx.them }, rr = seeded(`ig-${ctx.seed}-reps`)
  let mine = at[k].mine, opp = at[k].opp, sit, b = branch
  if (ctx.sport === 'nfl') {
    mine += b.pre ?? 0
    sit = fbSit(b, ids, mine, opp)
    if (FB_REPS.has(b.game)) sit.reps = b.i === 22 && b.clock < 60 ? 3 : rr() < 0.5 ? 3 : 4
    // his kicks: the distances the drives ended at (the extra point is the 33-yard try)
    if (b.kicks) sit.kicks = b.kicks.map(x => ({ d: x.xp ? 33 : x.long ? 50 + Math.floor(rr() * 9) : drawPair(rr, KICK_D) + Math.floor(rr() * 4), xp: !!x.xp }))
  } else if (ctx.sport === 'hoops') { sit = bkSit(b, ids, mine, opp); if (BK[b.game].opts) sit.reps = b.reps }
  else if (ctx.sport === 'soccer') sit = scSit(b, ids, mine, opp, at[k].leg1, at[k].legs === 2 && at[k].leg === 1)
  else {
    // the inning to his moment, at-bat by at-bat: the runs before it are on the board (his side's or theirs)
    const inn = M.inning(b, seeded(`ig-${ctx.seed}-inning`), k === 0)
    const sp = inn ?? { o: b.o, b: b.b, r: b.r ?? 0 }
    const fits = ctx.pool.filter(t => bsFits(t, ctx, b.hf, sp.o, sp.b, b.m0 + M.sg * sp.r, k === 0))
    const list = freshOf(fits.length ? fits : [b.game], ctx.used)
    const game = list[Math.floor(seeded(`ig-${ctx.seed}-pick`)() * list.length)]
    b = { ...b, game, o: sp.o, b: sp.b, r: sp.r, m: b.m0 + M.sg * sp.r, h: ctx.hOf(game) }
    const memo = new Map()
    b.wHit = bsW(M.R, ctx.home, b, true, memo); b.wMiss = bsW(M.R, ctx.home, b, false, memo)
    if (M.bat === 'u') mine += sp.r; else opp += sp.r
    sit = bsSit(b, ids, mine, opp, ctx)
  }
  return keep(PLANS, id, { ctx, M, k, b, game: b.game, mine, opp, sit, all, hit: b.wHit, miss: b.wMiss, dPre, leg1: at[k].leg1 ?? null })
}
// the chance over the moment's whole spread at a fixed rate (1: always lands it, 0: never), for the calibration
export const expectAt = (plan, h) => plan.M.E(plan.dPre, () => h)

// What he did, and the rest of the game from there: { mine, opp, won, note, got (his side's points in the play),
// gave (theirs), tds (touchdowns in the play), legs / pens / et (soccer), walkoff (baseball) }.
// hit: the drill's own verdict. F: momentFacts of the game's report (null: simulated). raw: the report itself.
export function playMoment(plan, hit, F = null, raw = null) {
  const { ctx, M, b } = plan, r = seeded(`ig-${ctx.seed}-play`)
  const ids = { us: ctx.us, them: ctx.them }
  if (ctx.sport === 'nfl') {
    const list = fbPlay(M.R, b, hit, F), o = pickW(r() * list.reduce((s, x) => s + x.p, 0), list)
    let mine = plan.mine + (o.u ?? 0), opp = plan.opp + (o.t ?? 0)
    const rest = o.next == null || o.T <= 5 ? { u: 0, t: 0, ev: [], ot: null } : fbRest(M.R, r, mine - opp, o.T, o.next, o.boost ?? 1)
    if (!rest.ot && mine + rest.u === opp + rest.t) { const w = r() < M.R.ot, by = r() < 0.6 ? 3 : 6; if (w) rest.u += by; else rest.t += by; rest.ot = w ? 'w' : 'l' }
    mine += rest.u; opp += rest.t
    const tds = o.tag === 'td' || o.tag === 'td2' || o.tag === 'tdx' ? Math.max(1, Math.floor((o.u ?? 0) / 6)) : 0
    return { mine, opp, won: mine > opp, note: fbNote(M.R, ids, rest, o), got: o.u ?? 0, gave: o.t ?? 0, tds, tag: o.tag }
  }
  if (ctx.sport === 'hoops') {
    const list = bkPlay(b, hit, F), o = pickW(r() * list.reduce((s, x) => s + x.p, 0), list)
    const rest = bkSealed(b, o, hit) ? { u: 0, t: 0, ot: 0, last: null } : bkRest(M.R, b, o, r)
    const mine = plan.mine + (o.u ?? 0) + rest.u, opp = plan.opp + (o.t ?? 0) + rest.t
    const ot = rest.ot ? (rest.ot > 1 ? `${WORDS[rest.ot]} overtimes` : 'overtime') : null
    const note = ot ? (mine > opp ? `Won it in ${ot}.` : `Lost it in ${ot}.`)
      : b.k === 2 && rest.last ? `${rest.last.side === 'u' ? ctx.us : ctx.them} ${rest.last.ft ? `made ${rest.last.x === 2 ? 'both' : 'one'} at the line` : rest.last.x === 3 ? 'hit a three at the buzzer' : 'scored at the buzzer'}.` : null
    return { mine, opp, won: mine > opp, note, got: o.u ?? 0, gave: o.t ?? 0 }
  }
  if (ctx.sport === 'soccer') {
    const scored = F?.pts != null ? F.pts : hit ? 1 : 0
    const rest = M.rest(b, scored, r)
    const legNow = [plan.mine + scored + rest.cur.u, plan.opp + rest.cur.t]
    const legs = b.leg === 1 ? [legNow, [rest.next.u, rest.next.t]] : plan.leg1 ? [plan.leg1, legNow] : [legNow]
    const mine = legs.reduce((s, l) => s + l[0], 0), opp = legs.reduce((s, l) => s + l[1], 0)
    const note = rest.pens ? (rest.pens === 'won' ? 'Won it on penalties.' : 'Lost on penalties.') : rest.et ? (rest.won ? 'Won it in extra time.' : 'Lost it in extra time.')
      : b.leg === 1 ? (rest.won ? `${ctx.usName ?? ctx.us} saw it out in the second leg.` : `${ctx.themName ?? ctx.them} turned it around in the second leg.`)
      : rest.t && !rest.won ? `${ctx.themName ?? ctx.them} scored late.` : rest.u && rest.won && !scored ? `${ctx.usName ?? ctx.us} found a late goal.` : null
    return { mine, opp, won: rest.won, note, got: scored, legs, pens: rest.pens, et: rest.et }
  }
  // baseball: the at-bat's or the pitch's own result (the runs and the outs), then the rest
  const R = raw && typeof raw === 'object' ? raw : null
  const list = bsPlay(b.game, b.o, b.b, hit, R)
  const u = r() * list.reduce((s, x) => s + x[0], 0)
  let pk = list[list.length - 1], acc = 0
  for (const x of list) { acc += x[0]; if (u < acc) { pk = x; break } }
  const [, o2, b2, x] = pk
  // (the score right after the play, when the game kept it: that's the board)
  let mine = plan.mine, opp = plan.opp
  if (R?.final && Number.isFinite(R.final.mine) && Number.isFinite(R.final.opp)) { mine = R.final.mine; opp = R.final.opp }
  else if (b.bat === 'u') mine += x; else opp += x
  const over = b.hf % 2 === 1 && halfInn(b.hf) >= 9 && (ctx.home ? mine > opp : opp > mine)
  const rest = over ? { mine, opp, ev: [], extras: false } : bsRest(M.R, ctx.home, b.hf, o2, b2, mine, opp, r)
  const lastEv = rest.ev[rest.ev.length - 1], won = rest.mine > rest.opp
  const note = over ? null : rest.extras ? (won ? 'Won it in extra innings.' : 'Lost it in extra innings.')
    : lastEv ? `${lastEv.side === 'u' ? ctx.us : ctx.them} scored in the ${ordinal(lastEv.inn)}.` : null
  return { mine: rest.mine, opp: rest.opp, won, note, got: b.bat === 'u' ? mine - plan.mine : 0, gave: b.bat === 't' ? opp - plan.opp : 0, walkoff: over && !!ctx.home && won }
}
