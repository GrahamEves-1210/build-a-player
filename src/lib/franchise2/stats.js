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
import { lgAll, lgPut, addLines, wkPack, wkUnpack, oppPack, oppUnpack, TST_K } from './box'
import { records } from './standings'

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
  if (F.wkl?.wk !== wk) return {}
  return Object.fromEntries(Object.entries(F.wkl.s ?? {}).map(([s, by]) => [s, Object.fromEntries(Object.entries(by).map(([id, a]) => [id, wkUnpack(a)]))]))
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
    for (const [id, x] of Object.entries(t.byWk[last] ?? {})) { const y = wkPack(x); if (y) w[id] = y }
    F.wkl.s[s] = w
  }
  // the player's games: the other team's lines as his box score showed them (the week's replay; a playoff game's
  // own replay from its final)
  for (const row of F.log ?? []) {
    if (!row.bx || row.bx.ox) continue
    let lines = {}, roster = []
    try {
      if (row.wk != null && T[row.opp]) { lines = T[row.opp].byWk[row.wk - 1] ?? {}; roster = T[row.opp].roster }
      else {
        roster = boxRoster(F, row.opp)
        const played = playFootballSeason({ roster, games: [{ wk: 1, opponent: row.opp, home: !row.home, won: row.them > row.us, mySc: row.them, oppSc: row.us }], seed: `${F.seed}-${F.year}-pobox-${row.rd}-${row.opp}` })
        lines = Object.fromEntries(Object.entries(played.reg[0]?.s ?? {}).map(([k, v]) => [k.slice(1), v]))
      }
    } catch { lines = {} }
    row.bx.ox = oppPack(roster.map(p => ({ id: p.k.slice(1), pos: p.pos, d: p.d, sub: p.sub, line: lines[p.k.slice(1)] })))
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
// ── A team's season as a team (the team stats page) ─────────────────────────────────────────────────────────────
// TEAM_STATS: what a broadcast's team page shows, each a game's worth, with where it ranks in the league (1 = best:
// the most gained, the least given up). Points come from the scores; the rest from each game's box (F.tst).
// teamSeasonStats(F, s) → { g, rows: [{ k, label, v, txt, rank }], leaders: [{ k, label, p, v, txt }] } or null
// before a game. A save from before the tally was kept counts the games since (g says how many).
export const TEAM_STATS = [
  { k: 'ppg', label: 'POINTS PER GAME', side: 'off' },
  { k: 'ypg', label: 'YARDS PER GAME', side: 'off' },
  { k: 'pypg', label: 'PASSING YARDS PER GAME', side: 'off' },
  { k: 'rypg', label: 'RUSHING YARDS PER GAME', side: 'off' },
  { k: 'ypp', label: 'YARDS PER PASS ATTEMPT', side: 'off' },
  { k: 'ypc', label: 'YARDS PER CARRY', side: 'off' },
  { k: 'skd', label: 'SACKS ALLOWED', side: 'off', low: true },
  { k: 'papg', label: 'POINTS ALLOWED PER GAME', side: 'def', low: true },
  { k: 'oypg', label: 'YARDS ALLOWED PER GAME', side: 'def', low: true },
  { k: 'opypg', label: 'PASSING YARDS ALLOWED PER GAME', side: 'def', low: true },
  { k: 'orypg', label: 'RUSHING YARDS ALLOWED PER GAME', side: 'def', low: true },
  { k: 'sks', label: 'SACKS', side: 'def' },
  { k: 'take', label: 'TAKEAWAYS', side: 'to' },
  { k: 'give', label: 'GIVEAWAYS', side: 'to', low: true },
  { k: 'diff', label: 'TURNOVER DIFFERENTIAL', side: 'to' },
]
const per = (a, g) => (g ? a / g : 0)
function teamNumbers(F, R) {
  const out = {}
  for (const s of SHORTS) {
    const r = R[s], gp = r.w + r.l + r.t
    const a = F.tst?.[s]
    if (!gp) continue
    const t = a ? Object.fromEntries(TST_K.map((k, j) => [k, a[j]])) : null
    const g = t?.g ?? 0
    out[s] = {
      gp, g,
      ppg: per(r.pf, gp), papg: per(r.pa, gp),
      ...(g && {
        ypg: per(t.yds, g), pypg: per(t.py, g), rypg: per(t.ry, g), ypp: per(t.py, t.pa), ypc: per(t.ry, t.ra),
        skd: t.sk, oypg: per(t.oyds, g), opypg: per(t.opy, g), orypg: per(t.ory, g), sks: t.osk,
        take: t.oint + t.ofum, give: t.int + t.fum, diff: t.oint + t.ofum - t.int - t.fum,
      }),
    }
  }
  return out
}
const statTxt = (k, v) => (k === 'ypp' || k === 'ypc' || k.endsWith('pg') ? (Math.round(v * 10) / 10).toFixed(1) : k === 'diff' && v > 0 ? `+${v}` : String(v))
const TEAM_LEADS = [
  { k: 'py', label: 'PASS YDS', txt: t => `${t.ptd ?? 0} TD · ${t.int ?? 0} INT` },
  { k: 'ry', label: 'RUSH YDS', txt: t => `${t.ra ? (Math.round((t.ry / t.ra) * 10) / 10).toFixed(1) : '0.0'} YPC · ${t.rtd ?? 0} TD` },
  { k: 'ryd', label: 'REC YDS', txt: t => `${t.rc ?? 0} REC · ${t.rctd ?? 0} TD` },
  { k: 'tk', label: 'TACKLES', txt: t => `${t.tfl ?? 0} FOR LOSS` },
  { k: 'sck', label: 'SACKS', txt: t => `${t.qbh ?? 0} QB HITS` },
  { k: 'dint', label: 'INT', txt: t => `${t.pbu ?? 0} PASSES DEFENSED` },
]
export function teamSeasonStats(F, s, { tot = leagueStats(F), who = whoIs(F) } = {}) {
  const N = teamNumbers(F, records(F))
  const me = N[s]
  if (!me) return null
  const rows = []
  for (const c of TEAM_STATS) {
    const v = me[c.k]
    if (v == null) continue
    const all = Object.values(N).map(x => x[c.k]).filter(x => x != null)
    const rank = 1 + all.filter(x => (c.low ? x < v : x > v)).length
    rows.push({ ...c, v, txt: statTxt(c.k, v), rank, of: all.length })
  }
  const leaders = []
  for (const c of TEAM_LEADS) {
    let best = null
    for (const [id, t] of Object.entries(tot)) {
      const w = who.get(id)
      if (!w || w.s !== s || !(t[c.k] > 0)) continue
      if (!best || t[c.k] > best.t[c.k]) best = { p: w.p, t }
    }
    if (best) leaders.push({ k: c.k, label: c.label, p: best.p, v: best.t[c.k], txt: c.txt(best.t) })
  }
  return { gp: me.gp, g: me.g, rows, leaders }
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
  // (each table in depth order: the left tackle to the right tackle, the starters before the men who came in)
  roster.sort((a, b) => (a.d ?? 9) - (b.d ?? 9))
  const s = Object.fromEntries(Object.entries(bx.s ?? {}).map(([id, x]) => [`p${id}`, x]))
  const kp = row.kp ?? []
  const tds = m => kp.filter(x => x[1] === m && x[2] >= 6).length, fgs = m => kp.filter(x => x[1] === m && x[2] === 3).length
  const us = { ...bx.u, td: tds(1), fg: fgs(1) }, them = { ...bx.o, td: tds(0), fg: fgs(0) }
  // the other team's men: their lines from the same game, kept with it (box.js; an old save's, kept on load)
  const opp = oppUnpack(bx.ox)
  const oppRoster = opp.map(({ id, pos, d, sub }) => { const p = who(F, id); return { k: `p${id}`, n: p?.n ?? '?', pos, d, ...(sub && { sub }) } })
  const oppS = Object.fromEntries(opp.map(({ id, line }) => [`p${id}`, line]))
  oppRoster.sort((a, b) => (a.d ?? 9) - (b.d ?? 9))
  const kick = [0, 1].map(i => { const k = bx.kk?.[i], p = bx.kid?.[i] != null ? who(F, bx.kid[i]) : null; return k && p ? { n: p.n, line: k } : null })
  return { r: { team: F.team, roster }, game: { s, us, them }, opp: { r: { team: row.opp, roster: oppRoster }, game: { s: oppS, us: them, them: us } }, top: bx.top ?? [0, 0], fd: [firstDowns(us), firstDowns(them)], kick }
}
