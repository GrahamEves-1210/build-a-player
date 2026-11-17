// FRANCHISE: one game's box score, both teams at once, made the moment the game is played and kept.
// (owner, 2026-11-17: "stats must be recorded when games are played and never change afterwards")
//
//   playBox(F, S, seed)      the finished game S (game.js) → { h, a }: each side's men's lines (`p{id}` → line),
//                            their places that day, and the side's fumbles lost. The game's own touchdowns, field
//                            goals, safeties and turnovers are the box's; each side's sacks and interceptions are
//                            the other side's sacks and picks.
//   finishBox(B)             after the moments and the scoring summary have had their say: every team line is the
//                            sum of its men's lines (the passer's completions and yards are his receivers')
//   recordBox(F, B, po)      the men's lines into the season (F.lg, the league's men; F.lgp in the playoffs; the
//                            player's own team keeps F.ss as before) and the week's lines for the wire (F.wkl)
//   lgLine(F.lg, id) · lgAll(store)   the season so far as plain lines
//
// The season's lines are kept small: a man's line is an array in his position's order (LGK), only the men who played.
import { boxRoster } from './stats'
import { playFootballSeason } from '../teamSeason'
import { rngOf, clamp } from './rng'

// ── The season's lines, small ────────────────────────────────────────────────
const QB_K = ['pa', 'pc', 'py', 'ptd', 'int', 'sk', 'ra', 'ry', 'rtd']
const SK_K = ['ra', 'ry', 'rtd', 'tg', 'rc', 'ryd', 'rctd']
const OL_K = ['sn', 'pbs', 'rbs', 'sa', 'prs', 'qbha', 'pnk', 'hold', 'fst', 'pen']
const DF_K = ['tk', 'sck', 'tfl', 'qbh', 'dint', 'pbu', 'ff', 'fr', 'p6']
export const LGK = { qb: QB_K, rb: SK_K, wr: SK_K, te: SK_K, ol: OL_K, dl: DF_K, lb: DF_K, db: DF_K }
// (the week's lines the wire reads: the big days and the marks passed, news.js; kept as arrays in this order)
export const WK_K = ['py', 'ptd', 'int', 'ry', 'rtd', 'rc', 'ryd', 'rctd', 'sck', 'dint']
export function wkPack(line) { const a = WK_K.map(k => line?.[k] ?? 0); while (a.length && !a[a.length - 1]) a.pop(); return a.length ? a : null }
export const wkUnpack = a => Object.fromEntries(WK_K.map((k, j) => [k, a[j] ?? 0]).filter(([, v]) => v))
// A game's other side, kept on the player's row small: { [id]: [pos, place, spot, ...his line in LGK order] }
export function oppPack(list) {
  const ox = {}
  for (const { id, pos, d, sub, line } of list) {
    const keys = LGK[pos]
    if (!keys) continue
    const v = keys.map(k => line?.[k] ?? 0)
    while (v.length && !v[v.length - 1]) v.pop()
    if (v.length) ox[id] = [pos, d ?? 0, sub ?? 0, ...v]
  }
  return ox
}
export const oppUnpack = ox => Object.entries(ox ?? {}).map(([id, [pos, d, sub, ...v]]) => ({ id, pos, d, sub: sub || null, line: Object.fromEntries((LGK[pos] ?? []).map((k, j) => [k, v[j] ?? 0]).filter(([, x]) => x)) }))

// a line into a store: store[pos][id] = [games, ...the position's numbers] (trailing zeros dropped)
export function lgAdd(store, pos, id, line) {
  const keys = LGK[pos]
  if (!keys) return
  const by = store[pos] ?? (store[pos] = {})
  const a = by[id] ?? [0]
  a[0] = (a[0] ?? 0) + 1
  keys.forEach((k, j) => { const v = line?.[k]; if (v) a[j + 1] = (a[j + 1] ?? 0) + v })
  for (let j = 1; j < a.length; j++) if (a[j] == null) a[j] = 0
  while (a.length > 1 && !a[a.length - 1]) a.pop()
  by[id] = a
}
// a whole season's line into a store (an old save's, frozen on load: stats.js freezeOldSeason)
export function lgPut(store, pos, id, line) {
  const keys = LGK[pos]
  if (!keys) return
  const a = [line.gp ?? 0, ...keys.map(k => line[k] ?? 0)]
  while (a.length > 1 && !a[a.length - 1]) a.pop()
  ;(store[pos] ??= {})[id] = a
}
const unpackLine =(pos, a) => { const o = { gp: a[0] ?? 0 }; LGK[pos].forEach((k, j) => { if (a[j + 1]) o[k] = a[j + 1] }); return o }
// every man's season in a store, as plain lines ({ [id]: line })
export function lgAll(store) {
  const out = {}
  for (const [pos, by] of Object.entries(store ?? {})) for (const [id, a] of Object.entries(by)) out[id] = unpackLine(pos, a)
  return out
}
export function lgLine(store, id) {
  for (const [pos, by] of Object.entries(store ?? {})) if (by[id]) return unpackLine(pos, by[id])
  return null
}
// two lines added (a man traded in the season has some of each)
export function addLines(a, b) {
  const o = { ...a }
  for (const [k, v] of Object.entries(b ?? {})) if (typeof v === 'number') o[k] = k === 'lg' ? Math.max(o[k] ?? 0, v) : (o[k] ?? 0) + v
  return o
}

// ── One game, both sides ─────────────────────────────────────────────────────
// each man's luck for the season (the same all year: a hot hand is a hot season; a little wider than the old 6%, the
// way a receiver's or a back's year swings: the league's leaders come from the men who had theirs)
const luckOf = (F, roster) => new Map(roster.map(p => [p.k, clamp(0.85, 1.15, 1 + rngOf(`${F.seed}-${F.year}-luck-${p.k}`).n() * 0.075)]))
// the season's sacks so far for the pass rushers (the sim eases a man off past a big number: teamSeason.js heat)
function sacksSoFar(F, roster) {
  const m = new Map()
  for (const p of roster) {
    if (p.pos !== 'dl') continue
    const id = p.k.slice(1)
    const v = (F.ss?.[id]?.sck ?? 0) + (lgLine(F.lg, id)?.sck ?? 0)
    if (v) m.set(p.k, v)
  }
  return m
}
// The league's own numbers for the box (lib/teamSeason.js playFootballSeason tune), against the NFL's typical leaders
// (2026-11-17, scripts/franchise2/realism.mjs): an elite receiver draws more of his team's targets than the old cap
// let him (Chase, Hill, Jefferson, Kupp: 35-41% of their teams' receiving yards, 1,700-1,950 yards), and an elite
// passer's share of his team's touchdowns tops out nearer two in three (the leaders' 35-45, 40-plus not every year)
export const FB_TUNE = { tgtCap: 0.3, tgtK: 0.4, pTdBase: 0.6, pTdK: 0.1, pTdMax: 0.66, ypaK: 4, attK: 12, carCap: 0.8, carK: 0.4, heatAt: 11, heatK: 0.3 }
// a passer's interceptions so far this season (the box eases him off past ten: below)
const picksSoFar = (F, k) => { const id = k.slice(1); return (F.ss?.[id]?.int ?? 0) + (lgLine(F.lg, id)?.int ?? 0) }
const other = s => (s === 'h' ? 'a' : 'h')
const add = (o, k, v) => { if (v) o[k] = (o[k] ?? 0) + v }
const sum = (lines, men, k) => men.reduce((a, p) => a + (lines[p.k]?.[k] ?? 0), 0)
// move a count across men until their total is `target` (up: by weight; down: from the men who have the most)
function setTotal(R, lines, men, k, target, w, up = null, down = null) {
  let have = sum(lines, men, k)
  for (let n = 0; have < target && n < 40; n++) {
    const i = R.wpick(men.map(w))
    const o = lines[men[i].k] ??= {}
    o[k] = (o[k] ?? 0) + 1; have++
    up?.(o)
  }
  for (let n = 0; have > target && n < 40; n++) {
    const has = men.filter(p => (lines[p.k]?.[k] ?? 0) > 0)
    if (!has.length) break
    const p = has[R.wpick(has.map(x => lines[x.k][k]))], o = lines[p.k]
    o[k]--; have--
    if (!o[k]) delete o[k]
    down?.(o)
  }
}
const dec = (o, k) => { if (o[k]) { o[k]--; if (!o[k]) delete o[k] } }

// The game S finished (or a moment's game: S as it ended). seed: the box's own (the same game, the same box).
export function playBox(F, S, seed) {
  const R = rngOf(`${seed}-fit`)
  const B = { S, seed }
  for (const side of ['h', 'a']) {
    const short = S.G[side], roster = boxRoster(F, short)
    const mine = side === 'h' ? S.hs : S.as, theirs = side === 'h' ? S.as : S.hs
    const plays = S.plays.filter(p => p.s === side)
    // the game's own scores: its touchdowns (a moment's own touchdown is named and credited by the moment), its
    // field goals and safeties
    const split = { td: plays.filter(p => p.k === 'td' && !p.snap).length, xp: 0, two: 0, fg: plays.filter(p => p.k === 'fg').length, sf: plays.filter(p => p.k === 'sf').length }
    const played = playFootballSeason({ roster, games: [{ mySc: mine, oppSc: theirs, split, noP6: true }], seed: `${seed}-${side}`, luck: luckOf(F, roster), run: { sacks: sacksSoFar(F, roster) }, tune: FB_TUNE })
    const g = played.reg[0]
    B[side] = { short, roster, s: g.s, fum: g.us.fum ?? 0, dfum: 0 }
  }
  // the game's turnovers (its drives that ended in one; a moment's own is added with the moment) and sacks, each
  // side's offense against the other's defense
  for (const side of ['h', 'a']) {
    const O = B[side], D = B[other(side)]
    const qbs = O.roster.filter(p => p.pos === 'qb'), qb = qbs.find(p => O.s[p.k]?.pa) ?? qbs[0]
    const dfn = D.roster.filter(p => p.pos === 'dl' || p.pos === 'lb' || p.pos === 'db')
    const ql = qb ? (O.s[qb.k] ??= {}) : {}
    const T = Math.max(0, S.dr.filter(d => d.s === side && d.res === 'to').length - S.plays.filter(p => p.k === 'snap' && p.s === side && p.to).length)
    let int = ql.int ?? 0, fum = O.fum
    if (int + fum !== T) {
      const pInt = (int + 0.58) / (int + fum + 1)
      int = 0
      for (let k = 0; k < T; k++) if (R.u() < pInt) int++
    }
    // (a passer past ten picks is coached to throw it away and stop forcing it, or he's benched for a series: the
    // league's leaders throw 15 to 18, not 22 to 26; the game's turnover is a fumble instead)
    const had = qb && !S.G.po ? picksSoFar(F, qb.k) : 0
    if (had > 10) { const keep = 1 / (1 + 0.12 * (had - 10)); for (let k = int; k > 0; k--) if (R.u() > keep) int-- }
    int = Math.min(int, Math.max(0, (ql.pa ?? 0) - (ql.pc ?? 0)))
    fum = T - int
    if (qb) { if (int) ql.int = int; else delete ql.int }
    O.fum = fum
    // the picks and the loose balls are the other side's
    setTotal(R, D.s, dfn, 'dint', int, p => 0.05 + (D.s[p.k]?.dint ?? 0) + (D.s[p.k]?.pbu ?? 0) * 0.3 + (p.pos === 'db' ? 0.6 : p.pos === 'lb' ? 0.25 : 0.03))
    setTotal(R, D.s, dfn, 'fr', fum, p => 0.2 + (D.s[p.k]?.tk ?? 0))
    for (const p of dfn) { const o = D.s[p.k]; if (o?.fr && (o.ff ?? 0) < o.fr && sum(D.s, dfn, 'ff') < fum) o.ff = o.fr }
    // a sack is the passer's and a rusher's: the two sims' counts met in the middle
    const so = ql.sk ?? 0, sd = sum(D.s, dfn, 'sck'), mid = (so + sd) / 2
    const sk = Math.floor(mid) + (R.u() < mid - Math.floor(mid) ? 1 : 0)
    if (qb) { if (sk) ql.sk = sk; else delete ql.sk }
    setTotal(R, D.s, dfn, 'sck', sk, p => 0.05 + (D.s[p.k]?.sck ?? 0) + (D.s[p.k]?.qbh ?? 0) * 0.4 + (p.pos === 'dl' ? 0.5 : p.pos === 'lb' ? 0.2 : 0.02),
      o => { add(o, 'tk', 1); add(o, 'tfl', 1); add(o, 'qbh', 1) }, o => { dec(o, 'tk'); dec(o, 'tfl'); dec(o, 'qbh') })
    // (the line's sacks allowed: no more than the passer took; the new ones mostly on a lineman)
    const line = O.roster.filter(p => p.pos === 'ol')
    if (line.length) {
      const was = sum(O.s, line, 'sa')
      const want = was > sk ? sk : Math.min(sk, was + [...Array(Math.max(0, sk - so))].filter(() => R.u() < 0.7).length)
      setTotal(R, O.s, line, 'sa', want, p => 0.3 + (O.s[p.k]?.prs ?? 0), o => { add(o, 'prs', 1); add(o, 'qbha', 1) })
    }
    // (passes defended: never more than the throws that weren't caught or picked)
    const inc = Math.max(0, (ql.pa ?? 0) - (ql.pc ?? 0) - int)
    setTotal(R, D.s, dfn, 'pbu', Math.min(sum(D.s, dfn, 'pbu'), inc), () => 1)
  }
  return B
}

// The moments' snaps on the men who made them: each side's lines (st: the player's men, ot: theirs), and a fumble
// lost on a moment is the side's
export function addMoments(B, us, ms = []) {
  const them = other(us)
  for (const m of ms) {
    for (const [id, line] of Object.entries(m.st ?? {})) for (const [k, v] of Object.entries(line)) add(B[us].s[`p${id}`] ??= {}, k, v)
    for (const [id, line] of Object.entries(m.ot ?? {})) for (const [k, v] of Object.entries(line)) add(B[them].s[`p${id}`] ??= {}, k, v)
    if (m.to === 'fum') B[m.side === 'off' ? us : them].dfum++
  }
}

// Every team line from its men's: the passer's numbers are his receivers', the team's are the sum of its men's
export function finishBox(B) {
  const team = {}
  for (const side of ['h', 'a']) {
    const X = B[side], s = X.s
    const qbs = X.roster.filter(p => p.pos === 'qb')
    const qb = [...qbs].sort((a, b) => (s[b.k]?.pa ?? 0) - (s[a.k]?.pa ?? 0))[0]
    const rec = X.roster.filter(p => p.pos !== 'qb' && p.pos !== 'ol')
    // (a receiver is targeted at least as often as he catches it)
    for (const p of rec) { const o = s[p.k]; if (o?.rc && (o.tg ?? 0) < o.rc) o.tg = o.rc }
    if (qb) {
      const o = s[qb.k] ??= {}
      const pc = sum(s, rec, 'rc'), py = sum(s, rec, 'ryd'), td = sum(s, rec, 'rctd'), tg = sum(s, rec, 'tg')
      o.pc = pc; o.py = py; o.ptd = td
      o.pa = Math.max(o.pa ?? 0, tg, pc + (o.int ?? 0))
      for (const k of ['pc', 'py', 'ptd', 'pa']) if (!o[k]) delete o[k]
    }
    const pa = sum(s, qbs, 'pa'), pc = sum(s, qbs, 'pc'), py = sum(s, qbs, 'py'), sk = sum(s, qbs, 'sk'), int = sum(s, qbs, 'int')
    const ra = sum(s, X.roster, 'ra'), ry = sum(s, X.roster, 'ry')
    const fum = (X.fum ?? 0) + (X.dfum ?? 0)
    team[side] = { yds: py + ry, py, ry, pa, pc, ra, sk, int, fum, to: int + fum }
  }
  B.team = team
  return B
}

// The game into the season: the league's men's lines (F.lg; the playoffs F.lgp), the player's men (F.ss, the same as
// ever, the playoffs included: F.ssr keeps the regular season), and the week's lines for the wire
// (the headless checks look at every game's box as it's kept: scripts/franchise2/records-check.mjs)
export const BOXLOG = { fn: null }
export function recordBox(F, B, po) {
  BOXLOG.fn?.(F, B, po)
  const store = po ? (F.lgp ??= {}) : (F.lg ??= {})
  if (!po && (F.wkl?.wk !== F.wk)) F.wkl = { wk: F.wk, s: {} }
  for (const side of ['h', 'a']) {
    const X = B[side]
    const mine = X.short === F.team
    for (const p of X.roster) {
      const id = p.k.slice(1), line = X.s[p.k] ?? {}
      if (mine) { const ss = F.ss ?? (F.ss = {}); const t = ss[id] ??= { gp: 0 }; t.gp++; for (const [k, v] of Object.entries(line)) if (typeof v === 'number' && v) t[k] = (t[k] ?? 0) + v; continue }
      lgAdd(store, p.pos, id, line)
      if (!po) {
        const w = wkPack(line)
        if (w) (F.wkl.s[X.short] ??= {})[id] = w
      }
    }
  }
}
// the other side of the player's game, for his row (season.js; stats.js gameBox reads it back)
export const oppOf = X => oppPack(X.roster.map(p => ({ id: p.k.slice(1), pos: p.pos, d: p.d, sub: p.sub, line: X.s[p.k] })))
