// NBA FRANCHISE: the season's awards, the All-Stars, the series MVPs and the records book (part C).
//
// Votes the way the real ones go:
// - MVP: the best production on a winner (a 30-point season on a lottery team doesn't win it).
// - DPOY: steals, blocks, the glass and the defender he is, on a good defensive team; bigs win most of them.
// - ROY, Sixth Man (more games off the bench than starting), Most Improved (the biggest jump from last season, not
//   a man back from an injury year), Clutch Player (points in the last five minutes of a game within five).
// - All-NBA: fifteen men, positionless (since 2024), by the MVP vote. All-Defense: ten. All-Rookie: ten.
// - The 65-game rule (the 2023 CBA): MVP, DPOY, Sixth Man, MIP, Clutch, All-NBA and All-Defense need 65 games of 20+
//   minutes (two of 15-20 count). ROY and All-Rookie don't.
// - All-Stars: 12 a conference at the break, five of them starters (two guards and three frontcourt men).
// - Finals MVP (the Bill Russell trophy), the conference finals MVPs (Larry Bird East, Magic Johnson West): the best
//   series on the winning side.
//
// The seam (nba/STATE.md):
//   seasonAwards(F) -> { MVP, ROY, DPOY, '6MOY', MIP, CLUTCH, ALL: [[5], [5], [5]], ALLDEF: [[5], [5]], ROOKIE: [[5], [5]],
//                        votes: { MVP: [{ i, v }, ...top 5], ... } }   ids (core writes them onto man.aw)
//   finalsMvp(F, series) -> manId     (seriesMvp: the same for any series, the conference finals)
// And:
//   allStars(F) -> { E: [12 ids], W: [12 ids], st: { E: [5], W: [5] } }   at the break, from the stats so far
//   eligible(row)          the 65-game rule
//   updateRecords(F) -> [news]   the season's marks into F.rec (single game, season, career, since the save began)
//   REAL_RECORDS            the NBA's own records, for the copy ("the NBA record is 100, Wilt Chamberlain in 1962")
import { perGame } from './stats'
import { prof } from './skills'

export const EAST = new Set(['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DET', 'IND', 'MIA', 'MIL', 'NYK', 'ORL', 'PHI', 'TOR', 'WAS'])
export const AWARD_NAME = {
  MVP: 'MOST VALUABLE PLAYER', ROY: 'ROOKIE OF THE YEAR', DPOY: 'DEFENSIVE PLAYER OF THE YEAR', '6MOY': 'SIXTH MAN OF THE YEAR',
  MIP: 'MOST IMPROVED PLAYER', CLUTCH: 'CLUTCH PLAYER OF THE YEAR', FMVP: 'FINALS MVP', ECF: 'EASTERN CONFERENCE FINALS MVP',
  WCF: 'WESTERN CONFERENCE FINALS MVP', ALL1: 'ALL-NBA FIRST TEAM', ALL2: 'ALL-NBA SECOND TEAM', ALL3: 'ALL-NBA THIRD TEAM',
  DEF1: 'ALL-DEFENSIVE FIRST TEAM', DEF2: 'ALL-DEFENSIVE SECOND TEAM', RK1: 'ALL-ROOKIE FIRST TEAM', RK2: 'ALL-ROOKIE SECOND TEAM', AS: 'ALL-STAR',
}

// ── Who's who ───────────────────────────────────────────────────────────────────
function menOf(F) {
  const m = new Map()
  for (const T of Object.values(F.teams)) for (const p of T.r) m.set(p.i, p)
  for (const p of F.fa ?? []) m.set(p.i, p)
  return m
}
// the regular season's wins (core's schedule: a played game has hs and as)
export function winsOf(F) {
  const w = {}, g = {}
  for (const x of F.sched ?? []) {
    if (x.hs == null || x.po) continue
    g[x.h] = (g[x.h] ?? 0) + 1; g[x.a] = (g[x.a] ?? 0) + 1
    const win = x.hs > x.as ? x.h : x.a
    w[win] = (w[win] ?? 0) + 1
  }
  return { w, g }
}
const winPct = (W, s) => (W.g[s] ? (W.w[s] ?? 0) / W.g[s] : 0.5)

// the 65-game rule: games of 20+ minutes, two of 15-20 allowed (a line without the counts: games played)
export const eligible = (r, need = 65) => (r.g20 != null ? r.g20 + Math.min(2, r.g15 ?? 0) : r.gp ?? 0) >= need

// production a game: points, boards, assists, stocks, less turnovers, and efficiency (true shooting over the league's 57%)
export function prod(r) {
  const s = perGame(r)
  return s.ppg + 0.42 * s.rpg + 0.9 * s.apg + 1.3 * s.spg + 1.1 * s.bpg - 0.9 * s.tpg + 0.3 * (s.ts - 57) * Math.min(1, s.ppg / 20)
}
const mvpScore = (r, wp) => prod(r) + 34 * (wp - 0.5) + (wp >= 0.68 ? 2 : 0)
function defScore(r, p, wp) {
  const s = perGame(r), d = p ? prof(p) : null
  return 2.4 * s.spg + 2.8 * s.bpg + 0.35 * (s.rpg - s.orpg) + (d ? 0.9 * d.def : 5) + 6 * (wp - 0.5) + Math.min(0, s.mpg - 28) * 0.3
}
const top = (list, n) => list.sort((a, b) => b.v - a.v).slice(0, n)
const fives = (list, n) => Array.from({ length: n }, (_, j) => list.slice(j * 5, j * 5 + 5).map(x => x.i))

export function seasonAwards(F) {
  const men = menOf(F), W = winsOf(F)
  const rows = Object.entries(F.ss ?? {}).map(([id, r]) => ({ i: +id, r, p: men.get(+id), wp: winPct(W, r.s) }))
  const ok = rows.filter(x => eligible(x.r))
  const rookie = x => x.p && (x.p.rk === F.year || (x.p.rk == null && (x.p.ys ?? 1) === 0))
  const mvp = top(ok.map(x => ({ i: x.i, v: mvpScore(x.r, x.wp) })), 15)
  const dpoy = top(ok.map(x => ({ i: x.i, v: defScore(x.r, x.p, x.wp) })), 10)
  const roy = top(rows.filter(rookie).filter(x => x.r.gp >= 30).map(x => ({ i: x.i, v: prod(x.r) * Math.min(1, x.r.gp / 60) })), 10)
  const sixth = top(ok.filter(x => x.r.gs * 2 < x.r.gp).map(x => ({ i: x.i, v: prod(x.r) + 6 * (x.wp - 0.5) })), 5)
  // the jump: this season against his last (a real season last year: 40+ games), never a rookie or a man who won MVP before
  const last = id => { const p = men.get(id); return (p?.car ?? []).filter(c => c.y === F.year - 1).reduce((a, c) => ({ gp: a.gp + c.gp, pts: a.pts + c.pts, reb: a.reb + c.reb, ast: a.ast + c.ast, min: a.min + c.min }), { gp: 0, pts: 0, reb: 0, ast: 0, min: 0 }) }
  const mip = top(ok.filter(x => !rookie(x) && !(x.p?.aw ?? []).some(a => a.k === 'MVP')).map(x => {
    const L = last(x.i); if (L.gp < 40) return null
    const s = perGame(x.r)
    const was = L.pts / L.gp + 0.5 * (L.reb + L.ast) / L.gp, now = s.ppg + 0.5 * (s.rpg + s.apg)
    return { i: x.i, v: now - was + 0.15 * (s.mpg - L.min / L.gp) }
  }).filter(Boolean), 5)
  // the first season of a save has no last season on record: the man who most outplayed what his rating said he'd do
  // (young, not a rookie), against the league's own line of production on OVR
  if (!mip.length) {
    const xs = ok.filter(x => x.p && !rookie(x)), n = xs.length
    if (n > 10) {
      const mx = xs.reduce((s, x) => s + x.p.o, 0) / n, my = xs.reduce((s, x) => s + prod(x.r), 0) / n
      const b = xs.reduce((s, x) => s + (x.p.o - mx) * (prod(x.r) - my), 0) / Math.max(1, xs.reduce((s, x) => s + (x.p.o - mx) ** 2, 0))
      mip.push(...top(xs.filter(x => x.p.ag <= 26).map(x => ({ i: x.i, v: prod(x.r) - (my + b * (x.p.o - mx)) })), 5))
    }
  }
  const clutch = top(ok.map(x => ({ i: x.i, v: (x.r.cp ?? 0) + 25 * (x.wp - 0.5) })), 5)
  const out = {
    MVP: mvp[0]?.i ?? null, DPOY: dpoy[0]?.i ?? null, ROY: roy[0]?.i ?? null, '6MOY': sixth[0]?.i ?? null, MIP: mip[0]?.i ?? null, CLUTCH: clutch[0]?.i ?? null,
    ALL: fives(mvp, 3), ALLDEF: fives(dpoy, 2), ROOKIE: fives(roy, 2),
    votes: { MVP: mvp.slice(0, 5), DPOY: dpoy.slice(0, 5), ROY: roy.slice(0, 5), '6MOY': sixth, MIP: mip, CLUTCH: clutch },
  }
  return out
}

// The All-Stars, at the break: the vote's production on a winner; five starters (two backcourt, three frontcourt),
// seven reserves (two guards, three frontcourt, two wild cards), each conference
export function allStars(F) {
  const men = menOf(F), W = winsOf(F)
  const out = { E: [], W: [], st: { E: [], W: [] } }
  const played = Math.max(1, ...Object.values(F.ss ?? {}).map(r => r.gp ?? 0))
  for (const c of ['E', 'W']) {
    const pool = Object.entries(F.ss ?? {}).map(([id, r]) => ({ i: +id, r, p: men.get(+id) }))
      .filter(x => x.p && (EAST.has(x.r.s) ? 'E' : 'W') === c && x.r.gp >= played * 0.6)
      .map(x => ({ ...x, v: prod(x.r) + 14 * (winPct(W, x.r.s) - 0.5), back: x.p.g !== 'big' && (x.p.p === 'PG' || x.p.p === 'SG') }))
      .sort((a, b) => b.v - a.v)
    const take = (list, n, into) => { for (const x of list) { if (n <= 0) break; if (!into.includes(x.i)) { into.push(x.i); n-- } } }
    const st = []
    take(pool.filter(x => x.back), 2, st); take(pool.filter(x => !x.back), 3, st)
    const res = [...st]
    take(pool.filter(x => x.back), 2, res); take(pool.filter(x => !x.back), 3, res); take(pool, 2, res)
    out.st[c] = st; out[c] = res
  }
  return out
}

// A series' MVP: the best series on the side that won it (its own lines, series.st; the postseason's if it has none)
// (without series.st, the postseason's lines: then the Finals weigh most, as the voters do, but the whole run counts)
export function seriesMvp(F, series) {
  const win = series.done ?? null
  const tot = series.st ?? F.ps ?? {}
  const list = Object.entries(tot).filter(([, r]) => !win || r.s === win).map(([id, r]) => ({ i: +id, v: prod(r) * Math.min(1, (r.gp ?? 0) / 4) }))
  return top(list, 1)[0]?.i ?? null
}
export const finalsMvp = seriesMvp

// ── The records book ────────────────────────────────────────────────────────────
export const REAL_RECORDS = {
  game: { pts: [100, 'Wilt Chamberlain', 1962], reb: [55, 'Wilt Chamberlain', 1960], ast: [30, 'Scott Skiles', 1990], tpm: [14, 'Klay Thompson', 2018], stl: [11, 'Larry Kenon', 1976], blk: [17, 'Elmore Smith', 1973] },
  season: { ppg: [50.4, 'Wilt Chamberlain', '1961-62'], rpg: [27.2, 'Wilt Chamberlain', '1960-61'], apg: [14.5, 'John Stockton', '1989-90'], tpm: [402, 'Stephen Curry', '2015-16'], spg: [3.67, 'Alvin Robertson', '1985-86'], bpg: [5.56, 'Mark Eaton', '1984-85'] },
}
const GAME_K = { pts: 'hi', reb: 'hr', ast: 'ha', tpm: 'h3', stl: 'hs', blk: 'hb' }
const SEASON_K = ['ppg', 'rpg', 'apg', 'spg', 'bpg']
const CAREER_K = ['pts', 'reb', 'ast', 'stl', 'blk', 'tpm', 'gp']
const LABEL = { pts: 'points', reb: 'rebounds', ast: 'assists', tpm: 'threes', stl: 'steals', blk: 'blocks', gp: 'games', ppg: 'points a game', rpg: 'rebounds a game', apg: 'assists a game', spg: 'steals a game', bpg: 'blocks a game', tpmS: 'threes in a season' }
export function updateRecords(F) {
  const men = menOf(F), rec = (F.rec ??= { game: {}, season: {}, career: {} })
  const news = []
  const beat = (book, k, v, i, n = men.get(i)?.n ?? '') => {
    const was = book[k]
    if (was && v <= was.v) return
    book[k] = { v, i, n, y: F.year }
    if (was && was.y < F.year && book !== rec.career) news.push({ k: 'record', i, text: `${n} set the league's mark since ${rec.from ?? F.year} for ${LABEL[k] ?? k}: ${v} (the old one: ${was.v}, ${was.n}).` })
  }
  rec.from ??= F.year
  const W = Math.max(1, ...Object.values(F.ss ?? {}).map(r => r.gp ?? 0))
  for (const [id, r] of Object.entries(F.ss ?? {})) {
    for (const [k, f] of Object.entries(GAME_K)) if (r[f]) beat(rec.game, k, r[f], +id)
    if ((r.gp ?? 0) >= W * 0.7) { const s = perGame(r); for (const k of SEASON_K) beat(rec.season, k, s[k], +id) }
    if (r.tpm) beat(rec.season, 'tpmS', r.tpm, +id)
  }
  // careers: what each man has done in this league (his rows since the save began, this season's included)
  for (const p of [...men.values(), ...(F.retired ?? [])]) {
    const rows = [...(p.car ?? [])]
    const cur = F.ss?.[p.i]
    if (cur && !rows.some(c => c.y === F.year)) rows.push(cur)
    if (!rows.length) continue
    for (const k of CAREER_K) { const v = rows.reduce((s, c) => s + (c[k] ?? 0), 0); if (v) beat(rec.career, k, v, p.i, p.n) }
  }
  return news
}
