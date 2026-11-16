// FRANCHISE: the league's numbers. Every team's men get a real box score for every game (lib/teamSeason.js, the
// same box score the player's team gets), from the depth chart and the final score, so the league has leaders,
// awards have real stat lines and the wire has the week's big games.
//
//   leagueStats(F)            { [player id]: season totals } for every man who's played (the player's team: F.ss)
//   gameLines(F, wk)          the week's box scores: { [short]: { [player id]: line } }  (regular season, 0-based)
//   leaders(F, key, n)        the top n at a stat: [{ p, s (team), v }]
//   boxRoster(F, short)       a team's men as the box score reads them (the starters and the rotation)
//
// The league's boxes aren't saved (they're played again from the saved scores, seeded, the same every time); the
// player's own team's are the ones its games kept (F.ss). Played with each team's chart as it stands when read.
import { SHORTS, realOf } from './league'
import { startersOf, benchOf, groupOf, OL_SPOTS } from './roster'
import { KEYS, playFootballSeason } from '../teamSeason'
import { clamp, r1 } from './rng'

// ── Ratings for the box score ────────────────────────────────────────────────
// a man's 0-11 traits: a build's own; a real man's real ones, moved by how far his OVR has come since; a generated
// man's from his OVR
export const valOfOvr = o => clamp(0, 11, (-2.2 + Math.sqrt(Math.max(0, 4.84 + 0.96 * (o - 58)))) / 0.48)
export function boxTraits(F, p) {
  if (p.b != null) {
    const b = F.builds[p.b]?.build ?? {}
    const vals = Object.values(b).map(c => c?.val).filter(v => typeof v === 'number')
    const avg = vals.length ? vals.reduce((a, x) => a + x, 0) / vals.length : 5
    return Object.fromEntries(KEYS[p.p].map(k => [k, typeof b[k]?.val === 'number' ? b[k].val : avg]))
  }
  const real = realOf(p.p, p.n), base = valOfOvr(p.o), shift = real ? base - valOfOvr(real.o) : 0
  return Object.fromEntries(KEYS[p.p].map(k => [k, r1(clamp(0, 11, real ? (real.attrs[k] ?? base) + shift : base))]))
}
export const boxRatings = (F, p) => { const t = boxTraits(F, p); return KEYS[p.p].map(k => t[k]) }

export function boxRoster(F, short) {
  const L = startersOf(F, short), rot = benchOf(F, short)
  const out = [], dAt = {}
  const add = (p, st) => {
    const d = (dAt[p.p] = (dAt[p.p] ?? -1) + 1)
    const g = groupOf(p)
    out.push({ k: `p${p.i}`, n: p.n, pos: p.p, o: p.o, a: boxRatings(F, p), st, d, ...((p.p === 'dl' || p.p === 'db') && { sub: g === 'dt' || g === 's' ? g : g === 'edge' ? 'edge' : 'cb' }), ...(p.p === 'ol' && { sub: OL_SPOTS[d] ?? 'OL' }), ...(p.b != null && { s: String(p.b) }) })
  }
  // (the kicker's line is his kicks, from the game itself: kick.js, F.kst)
  Object.values(L).forEach(p => { if (p.p !== 'k') add(p, 1) })
  rot.forEach(p => add(p, 0))
  return out
}

// ── The league's season so far ───────────────────────────────────────────────
// a team's played regular-season games, in order
function playedOf(F, short) {
  const out = []
  F.sched.weeks.forEach((games, wk) => {
    const g = games.find(x => x.h === short || x.a === short)
    if (!g || g.hs == null) return
    const home = g.h === short
    out.push({ wk, opp: home ? g.a : g.h, home, mySc: home ? g.hs : g.as, oppSc: home ? g.as : g.hs, won: (home ? g.hs > g.as : g.as > g.hs) })
  })
  return out
}
// (kept in memory a season at a time; a team's boxes are played again only when it has played another game)
const CACHE = new Map()
function teamSeason(F, short) {
  const key = `${F.seed}|${F.year}`
  let C = CACHE.get(key)
  if (!C) { CACHE.clear(); C = {}; CACHE.set(key, C) }
  const games = playedOf(F, short)
  const have = C[short]
  if (have && have.n === games.length) return have
  const roster = boxRoster(F, short)
  const played = playFootballSeason({ roster, games: games.map(g => ({ wk: g.wk + 1, opponent: g.opp, home: g.home, won: g.won, mySc: g.mySc, oppSc: g.oppSc })), seed: `${F.seed}-${F.year}-lg-${short}` })
  const tot = {}
  for (const [k, v] of Object.entries(played.tot)) tot[k.slice(1)] = v
  const byWk = {}
  games.forEach((g, i) => { const s = played.reg[i]?.s ?? {}; byWk[g.wk] = Object.fromEntries(Object.entries(s).map(([k, v]) => [k.slice(1), v])) })
  C[short] = { n: games.length, tot, byWk }
  return C[short]
}
// one team's season of boxes worked out ahead (the hub does the league a team at a time while the phone is idle, so
// the first leaders, wire or ticker doesn't play 31 seasons at once)
export const warmStats = (F, short) => { if (short !== F.team && F.teams?.[short]) teamSeason(F, short) }
export function leagueStats(F) {
  const out = {}
  for (const s of SHORTS) {
    // (the player's team: its own games' box scores; the regular season's, kept when the playoffs start, F.ssr)
    if (s === F.team) { for (const [id, v] of Object.entries(F.ssr ?? F.ss ?? {})) out[id] = v; continue }
    Object.assign(out, teamSeason(F, s).tot)
  }
  // the kickers: every game's kicks as they were played (kick.js addKickStats)
  for (const [id, v] of Object.entries(F.kst ?? {})) out[id] = { ...(out[id] ?? {}), ...v }
  return out
}
// one week's lines for every team (the player's team: only its season totals are kept, so its line is the one the
// week's result card showed, read back from the log)
export function gameLines(F, wk) {
  const out = {}
  for (const s of SHORTS) if (s !== F.team) out[s] = teamSeason(F, s).byWk[wk] ?? {}
  return out
}
// who's on which team (id → short), and the man
export function whoIs(F) {
  const M = new Map()
  for (const s of SHORTS) for (const p of F.teams[s].r) M.set(String(p.i), { p, s })
  return M
}
// the league's best at a stat (only men still on a roster; a share of games played for a rate stat)
export function leaders(F, key, n = 5, { tot = leagueStats(F), who = whoIs(F), filter = null } = {}) {
  const out = []
  for (const [id, t] of Object.entries(tot)) {
    const v = typeof key === 'function' ? key(t) : t[key] ?? 0
    if (!v) continue
    const w = who.get(id)
    if (!w || (filter && !filter(w.p, t))) continue
    out.push({ p: w.p, s: w.s, v, t })
  }
  return out.sort((a, b) => b.v - a.v || a.p.i - b.p.i).slice(0, n)
}
export const LEADER_CATS = [
  { k: 'py', label: 'PASSING YARDS', unit: 'YDS' },
  { k: 'ptd', label: 'PASSING TOUCHDOWNS', unit: 'TD' },
  { k: 'ry', label: 'RUSHING YARDS', unit: 'YDS' },
  { k: 'ryd', label: 'RECEIVING YARDS', unit: 'YDS' },
  { k: 'rc', label: 'RECEPTIONS', unit: 'REC' },
  { k: 'tds', label: 'TOUCHDOWNS', unit: 'TD', f: t => (t.rtd ?? 0) + (t.rctd ?? 0) },
  { k: 'sck', label: 'SACKS', unit: 'SCK' },
  { k: 'dint', label: 'INTERCEPTIONS', unit: 'INT' },
  { k: 'tk', label: 'TACKLES', unit: 'TKL' },
  { k: 'fgm', label: 'FIELD GOALS', unit: 'FG' },
]
