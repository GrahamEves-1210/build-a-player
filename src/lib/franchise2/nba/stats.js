// NBA FRANCHISE: season stats from the box scores, the league leaders.
//
// The seam (nba/STATE.md):
//   recordGame(F, game, res, { playoff, series })   every man's line into F.ss (the postseason's into F.ps; with a
//                                           series, into series.st too, for the Finals and conference finals MVPs)
//   leaders(F, stat, n = 10, { playoff })   [{ i, s, v }] the top men in a per-game stat, qualified the NBA's way
// And:
//   addLine(row, line, short)   one box line into a SeasonLine (row: { gp, gs, min, pts, reb, oreb, ... , s })
//   perGame(row)                { gp, gs, mpg, ppg, rpg, orpg, apg, spg, bpg, tpg, fpg, fgp, tpp, ftp, tpm, ts, pm, ... }
//   leadersIn(tot, stat, { n, teamGames, filter })   the same list from any table of SeasonLines
//   LEADER_CATS                 the categories a League screen shows, with labels
//   gameScore(line)             Hollinger's game score (the night's best performer)
//   teamSeason(results)         each team's season from a list of Res (with h, a): PPG, OPP, pace, the box totals
//
// SeasonLine: { gp, gs, min, pts, reb, oreb, ast, stl, blk, tov, pf, fgm, fga, tpm, tpa, ftm, fta, pm, s,
//               cp (clutch points), hi hr ha h3 hs hb (his best night: points, boards, assists, threes, steals, blocks),
//               dd, td (double- and triple-doubles), g40 (40-point games), g20 / g15 (games of 20+ / 15-19 minutes) }
// A man who changes teams keeps one line (s: the team he plays for now), as the NBA's own season totals do.
const SUM_K = ['min', 'pts', 'reb', 'oreb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'pm', 'cp']

export function addLine(row, l, short = null) {
  if (!l || !(l.min > 0)) return row
  row.gp = (row.gp ?? 0) + 1
  row.gs = (row.gs ?? 0) + (l.st ? 1 : 0)
  for (const k of SUM_K) row[k] = (row[k] ?? 0) + (l[k] ?? 0)
  if (short) row.s = short
  // the season's best nights (the records book reads them), and the 65-game rule's count: 20 minutes a game, or 15-20
  row.hi = Math.max(row.hi ?? 0, l.pts ?? 0); row.hr = Math.max(row.hr ?? 0, l.reb ?? 0); row.ha = Math.max(row.ha ?? 0, l.ast ?? 0)
  row.h3 = Math.max(row.h3 ?? 0, l.tpm ?? 0); row.hs = Math.max(row.hs ?? 0, l.stl ?? 0); row.hb = Math.max(row.hb ?? 0, l.blk ?? 0)
  if (l.min >= 20) row.g20 = (row.g20 ?? 0) + 1
  else if (l.min >= 15) row.g15 = (row.g15 ?? 0) + 1
  const tens = [l.pts, l.reb, l.ast, l.stl, l.blk].filter(x => x >= 10).length
  if (tens >= 2) row.dd = (row.dd ?? 0) + 1
  if (tens >= 3) row.td = (row.td ?? 0) + 1
  if ((l.pts ?? 0) >= 40) row.g40 = (row.g40 ?? 0) + 1
  return row
}

export function recordGame(F, game, res, { playoff = false, series = null } = {}) {
  const tot = playoff ? (F.ps ??= {}) : (F.ss ??= {})
  for (const [short, lines] of Object.entries(res.box)) for (const l of lines) {
    if (!(l.min > 0)) continue
    addLine((tot[l.i] ??= {}), l, short)
    // a playoff series keeps its own lines (its MVP: awards.js seriesMvp)
    if (series) addLine(((series.st ??= {})[l.i] ??= {}), l, short)
  }
  return tot
}

const r1 = v => Math.round(v * 10) / 10
const pct = (m, a) => (a ? Math.round(m / a * 1000) / 10 : 0)
export function perGame(r) {
  const g = r.gp || 1
  const tsa = (r.fga ?? 0) + 0.44 * (r.fta ?? 0)
  return {
    gp: r.gp ?? 0, gs: r.gs ?? 0, mpg: r1((r.min ?? 0) / g), ppg: r1((r.pts ?? 0) / g), rpg: r1((r.reb ?? 0) / g), orpg: r1((r.oreb ?? 0) / g),
    apg: r1((r.ast ?? 0) / g), spg: r1((r.stl ?? 0) / g), bpg: r1((r.blk ?? 0) / g), tpg: r1((r.tov ?? 0) / g), fpg: r1((r.pf ?? 0) / g),
    fgp: pct(r.fgm, r.fga), tpp: pct(r.tpm, r.tpa), ftp: pct(r.ftm, r.fta), tpm: r1((r.tpm ?? 0) / g), tpa: r1((r.tpa ?? 0) / g), fta: r1((r.fta ?? 0) / g),
    pm: r1((r.pm ?? 0) / g), ts: tsa ? Math.round((r.pts ?? 0) / (2 * tsa) * 1000) / 10 : 0, cp: r.cp ?? 0, dd: r.dd ?? 0, td: r.td ?? 0, hi: r.hi ?? 0,
  }
}
export const gameScore = l => r1(l.pts + 0.4 * l.fgm - 0.7 * l.fga - 0.4 * (l.fta - l.ftm) + 0.7 * l.oreb + 0.3 * (l.reb - l.oreb) + l.stl + 0.7 * l.ast + 0.7 * l.blk - 0.4 * l.pf - l.tov)

// The NBA's rules for the per-game titles: 70% of his team's games (58 of 82); the shooting titles by makes
// (300 field goals, 82 threes, 125 free throws in a full season), all scaled to the games played so far
export const QUAL = {
  games: tg => Math.ceil(tg * 0.7),
  fgp: (r, tg) => (r.fgm ?? 0) >= 300 * tg / 82, tpp: (r, tg) => (r.tpm ?? 0) >= 82 * tg / 82, ftp: (r, tg) => (r.ftm ?? 0) >= 125 * tg / 82,
}
export const LEADER_CATS = [
  ['ppg', 'POINTS'], ['rpg', 'REBOUNDS'], ['apg', 'ASSISTS'], ['spg', 'STEALS'], ['bpg', 'BLOCKS'],
  ['fgp', 'FIELD GOAL %'], ['tpm', '3-POINTERS MADE'], ['tpp', '3-POINT %'], ['ftp', 'FREE THROW %'], ['mpg', 'MINUTES'],
]
export const gamesIn = tot => Math.max(1, ...Object.values(tot).map(r => r.gp ?? 0))
export function leadersIn(tot, stat, { n = 10, teamGames = gamesIn(tot), filter = null, playoff = false } = {}) {
  const rows = []
  const minG = playoff ? Math.min(4, teamGames) : QUAL.games(teamGames)
  for (const [id, r] of Object.entries(tot)) {
    if (filter && !filter(+id, r)) continue
    const shoot = QUAL[stat]
    if (!playoff && shoot ? !shoot(r, teamGames) : (r.gp ?? 0) < minG) continue
    rows.push({ i: +id, s: r.s, v: perGame(r)[stat] })
  }
  return rows.sort((a, b) => b.v - a.v).slice(0, n)
}
// (a total's name reads as its per-game stat: 'pts' is points a game, as the leaders board shows them)
const ALIAS = { pts: 'ppg', reb: 'rpg', ast: 'apg', stl: 'spg', blk: 'bpg', min: 'mpg', tov: 'tpg', oreb: 'orpg' }
export const leaders = (F, stat, n = 10, { playoff = false } = {}) => leadersIn((playoff ? F.ps : F.ss) ?? {}, ALIAS[stat] ?? stat, { n, playoff })

export function teamSeason(results) {
  const T = {}
  for (const g of results) for (const k of ['h', 'a']) {
    const s = g[k], o = g[k === 'h' ? 'a' : 'h'], t = (T[s] ??= { g: 0, w: 0, pts: 0, opp: 0, poss: 0 })
    const mine = k === 'h' ? g.hs : g.as, theirs = k === 'h' ? g.as : g.hs
    t.g++; if (mine > theirs) t.w++
    t.pts += mine; t.opp += theirs
    const sum = lines => lines.reduce((x, l) => { for (const kk of SUM_K) x[kk] = (x[kk] ?? 0) + (l[kk] ?? 0); return x }, {})
    const X = sum(g.box[s]), Y = sum(g.box[o])
    for (const [kk, v] of Object.entries(X)) if (kk !== 'pts' && kk !== 'min' && kk !== 'pm') t[kk] = (t[kk] ?? 0) + v
    // possessions (the standard estimate, both sides averaged), per 48 minutes
    const est = Z => Z.fga + 0.44 * Z.fta - Z.oreb + Z.tov
    t.poss += (est(X) + est(Y)) / 2 * 48 / (48 + 5 * (g.ot ?? 0))
  }
  for (const t of Object.values(T)) { t.ppg = r1(t.pts / t.g); t.oppg = r1(t.opp / t.g); t.pace = r1(t.poss / t.g); t.l = t.g - t.w }
  return T
}
