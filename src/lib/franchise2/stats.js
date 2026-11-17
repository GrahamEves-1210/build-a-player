// FRANCHISE: the league's numbers. Every game's box score, both teams, is made when the game is played (box.js) and
// its men's lines are kept, so the league has leaders, awards have real stat lines and the wire has the week's big
// games, and none of it changes afterwards (owner, 2026-11-17: a man hurt or traded keeps the season he played).
//
//   leagueStats(F)            { [player id]: season totals } for every man who's played (the league's men: F.lg;
//                             the player's team: F.ss, its regular season F.ssr once the playoffs start)
//   gameLines(F, wk)          the last week's lines: { [short]: { [player id]: line } }  (regular season, 0-based)
//   leaders(F, key, n)        the top n at a stat: [{ p, s (team), v }]
//   boxRoster(F, short)       a team's men as the box score reads them (the starters and the rotation)
//   freezeOldSeason(F)        a save from before the lines were kept: what the old replay gave, kept once
import { SHORTS, realOf } from './league'
import { startersOf, benchOf, groupOf, OL_SPOTS } from './roster'
import { KEYS, playFootballSeason } from '../teamSeason'
import { clamp, r1 } from './rng'
import { lgAll, lgPut, addLines } from './box'

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
// (the hub's idle work used to play the league's boxes again here; they're kept now, so there's nothing to do)
export const warmStats = () => {}
export function leagueStats(F) {
  const out = lgAll(F.lg)
  // (the player's team: its own games' box scores; the regular season's, kept when the playoffs start, F.ssr; a man
  // traded in the season has his lines from both teams)
  for (const [id, v] of Object.entries(F.ssr ?? F.ss ?? {})) out[id] = out[id] ? addLines(out[id], v) : v
  // the kickers: every game's kicks as they were played (kick.js addKickStats)
  for (const [id, v] of Object.entries(F.kst ?? {})) out[id] = { ...(out[id] ?? {}), ...v }
  return out
}
// the last week's lines for every team but the player's (kept with the week, box.js recordBox; an older week: none)
export function gameLines(F, wk) {
  return F.wkl?.wk === wk ? F.wkl.s ?? {} : {}
}

// ── A save from before the lines were kept ───────────────────────────────────
// Its league's lines were played again from the saved scores every time they were read (the replay below, with each
// team's chart as it stood). On load that replay is run once and kept, and from then on it never changes: the
// league's season so far, the last week's lines, and the other team's lines in each of the player's games.
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
function oldTeamSeason(F, short) {
  const games = playedOf(F, short)
  const roster = boxRoster(F, short)
  const played = playFootballSeason({ roster, games: games.map(g => ({ wk: g.wk + 1, opponent: g.opp, home: g.home, won: g.won, mySc: g.mySc, oppSc: g.oppSc })), seed: `${F.seed}-${F.year}-lg-${short}` })
  const tot = {}
  for (const [k, v] of Object.entries(played.tot)) tot[k.slice(1)] = v
  const byWk = {}
  games.forEach((g, i) => { const s = played.reg[i]?.s ?? {}; byWk[g.wk] = Object.fromEntries(Object.entries(s).map(([k, v]) => [k.slice(1), v])) })
  return { tot, byWk, pos: Object.fromEntries(roster.map(p => [p.k.slice(1), p.pos])), roster }
}
const WK_K = ['py', 'ptd', 'int', 'ry', 'rtd', 'rc', 'ryd', 'rctd', 'sck', 'dint']
const nonzero = x => Object.fromEntries(Object.entries(x ?? {}).filter(([, v]) => v))
const pickKeys = (x, keys) => Object.fromEntries(keys.filter(k => x?.[k]).map(k => [k, x[k]]))
// (true when it kept anything; the save then has F.lg and this never runs on it again)
export function freezeOldSeason(F) {
  if (F.lg || !F.teams || !F.sched?.weeks) return false
  F.lg = {}
  let last = -1
  F.sched.weeks.forEach((games, w) => { if (games.some(g => g.hs != null)) last = w })
  if (last < 0) return false
  const T = {}
  for (const s of SHORTS) if (s !== F.team) T[s] = oldTeamSeason(F, s)
  for (const t of Object.values(T)) for (const [id, line] of Object.entries(t.tot)) if (line.gp) lgPut(F.lg, t.pos[id], id, line)
  F.wkl = { wk: last, s: {} }
  for (const [s, t] of Object.entries(T)) {
    const w = {}
    for (const [id, x] of Object.entries(t.byWk[last] ?? {})) { const y = pickKeys(x, WK_K); if (Object.keys(y).length) w[id] = y }
    F.wkl.s[s] = w
  }
  // the player's games: the other team's lines as his box score showed them (the week's replay; a playoff game's
  // own replay from its final)
  for (const row of F.log ?? []) {
    if (!row.bx || row.bx.os) continue
    let lines = {}, roster = []
    try {
      if (row.wk != null && T[row.opp]) { lines = T[row.opp].byWk[row.wk - 1] ?? {}; roster = T[row.opp].roster }
      else {
        roster = boxRoster(F, row.opp)
        const played = playFootballSeason({ roster, games: [{ wk: 1, opponent: row.opp, home: !row.home, won: row.them > row.us, mySc: row.them, oppSc: row.us }], seed: `${F.seed}-${F.year}-pobox-${row.rd}-${row.opp}` })
        lines = Object.fromEntries(Object.entries(played.reg[0]?.s ?? {}).map(([k, v]) => [k.slice(1), v]))
      }
    } catch { lines = {} }
    const os = {}, oro = {}
    for (const p of roster) { const id = p.k.slice(1), x = nonzero(lines[id]); if (Object.keys(x).length) { os[id] = x; oro[id] = [p.pos, p.d ?? 0, p.sub ?? null, null] } }
    row.bx.os = os; row.bx.oro = oro
  }
  return true
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

// ── One game's box score (the player's game: season.js keeps it on its result, row.bx) ───────────────────────────────
// For the box score sheet (SquadSeason.jsx BoxSheet): { r: { team, roster }, game: { s, us, them }, opp: { r, game },
// top: [ours, theirs] (seconds), fd: [ours, theirs], kick: [{ n, line }] } or null when the game kept none (a game
// played before box scores were kept). The other team's men: their lines from the same game (bx.os, bx.oro).
// first downs from the lines (the league's game: about one a completion and a half, one every four or five carries)
export const firstDowns = T => Math.round((T.pc ?? 0) * 0.55 + (T.ra ?? 0) * 0.22 + 1.2)
const who = (F, id) => { for (const s of SHORTS) { const p = F.teams[s].r.find(x => String(x.i) === String(id)); if (p) return p } return (F.fa ?? []).find(x => String(x.i) === String(id)) ?? null }
export function gameBox(F, row) {
  if (!row?.bx) return null
  const bx = row.bx
  // the men as they lined up that day (their places kept with the box: a man hurt or gone since still has his line)
  const roster = []
  if (bx.ro) for (const [id, [pos, d, sub, b]] of Object.entries(bx.ro)) { const p = who(F, id); roster.push({ k: `p${id}`, n: p?.n ?? '?', pos, d, ...(sub && { sub }), ...(b != null && { s: String(b) }) }) }
  else {
    roster.push(...boxRoster(F, F.team))
    const have = new Set(roster.map(p => p.k.slice(1)))
    for (const id of Object.keys(bx.s ?? {})) if (!have.has(id)) { const p = who(F, id); if (p) roster.push({ k: `p${p.i}`, n: p.n, pos: p.p, o: p.o, d: 9, ...(p.b != null && { s: String(p.b) }) }) }
  }
  const s = Object.fromEntries(Object.entries(bx.s ?? {}).map(([id, x]) => [`p${id}`, x]))
  const kp = row.kp ?? []
  const tds = m => kp.filter(x => x[1] === m && x[2] >= 6).length, fgs = m => kp.filter(x => x[1] === m && x[2] === 3).length
  const us = { ...bx.u, td: tds(1), fg: fgs(1) }, them = { ...bx.o, td: tds(0), fg: fgs(0) }
  // the other team's men: their lines from the same game, kept with it (box.js; an old save's, kept on load)
  const oppRoster = []
  for (const [id, [pos, d, sub]] of Object.entries(bx.oro ?? {})) { const p = who(F, id); oppRoster.push({ k: `p${id}`, n: p?.n ?? '?', pos, d, ...(sub && { sub }) }) }
  const oppS = Object.fromEntries(Object.entries(bx.os ?? {}).map(([id, x]) => [`p${id}`, x]))
  const kick = [0, 1].map(i => { const k = bx.kk?.[i], p = bx.kid?.[i] != null ? who(F, bx.kid[i]) : null; return k && p ? { n: p.n, line: k } : null })
  return { r: { team: F.team, roster }, game: { s, us, them }, opp: { r: { team: row.opp, roster: oppRoster }, game: { s: oppS, us: them, them: us } }, top: bx.top ?? [0, 0], fd: [firstDowns(us), firstDowns(them)], kick }
}
