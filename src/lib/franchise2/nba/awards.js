// NBA FRANCHISE: the season's awards, the All-Stars, the series MVPs and the records book (part C).
//
// Votes the way the real ones go:
// - MVP: the best production on a winner (a 30-point season on a lottery team doesn't win it), and voter fatigue: the
//   reigning MVP needs a clearly better season to win again; three straight is the record and a fourth all but never.
// - DPOY: steals, blocks, the defensive glass and the defender he is, each measured against the men at his spot
//   (guards, wings, bigs), on a good defensive team; bigs still win most of them, guards and wings some.
// - ROY, Sixth Man (more games off the bench than starting, 10+ a game), Most Improved (the biggest jump from last
//   season, now a real rotation player: 12+ points, 24+ minutes; not a man back from an injury year), Clutch Player
//   (points in the last five minutes of a game within five, on a winning team).
// - All-NBA: fifteen men, positionless (since 2024), on the season itself: production first, then his defense, then
//   his team's record as one factor among them (a 33-point scorer on a losing team still makes a team; a 16-point
//   role player on the league's best team doesn't). The MVP vote weighs winning far more: nearly every MVP comes
//   from a 50-win team (Westbrook in 2017 and Jokic in 2022 are the exceptions, on historic seasons).
//   All-Defense: ten, positionless but as the voters go (three or more guards, two or more wings, five bigs at most).
//   All-Rookie: ten, the rookies who played a real part (games and minutes count, not a per-game line off the bench).
// - The 65-game rule (the 2023 CBA): MVP, DPOY, Sixth Man, MIP, Clutch, All-NBA and All-Defense need 65 games of 20+
//   minutes (two of 15-20 count; a man who never played 20 minutes has none), or 62 and a season-ending injury.
//   ROY and All-Rookie don't.
// - No Coach of the Year: the league has no coaches.
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
//   updateRecords(F) -> [news]   the season's marks into F.rec (the league's single game, season and career books, and
//                           the GM's team's own), the wire's lines for the marks that fell
//   REAL_RECORDS            the NBA's own records going into 2026-27; realRecord(book, key), RECORD_ROWS, recordValue
//   hallOfFamer(row), hallClass(row), hallScore(row)   the Hall of Fame, off a retired man's row
import { perGame } from './stats'
import { prof } from './skills'
import { careerTotals } from './realCareers'

export const EAST = new Set(['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DET', 'IND', 'MIA', 'MIL', 'NYK', 'ORL', 'PHI', 'TOR', 'WAS'])
export const AWARD_NAME = {
  MVP: 'MOST VALUABLE PLAYER', ROY: 'ROOKIE OF THE YEAR', DPOY: 'DEFENSIVE PLAYER OF THE YEAR', '6MOY': 'SIXTH MAN OF THE YEAR',
  MIP: 'MOST IMPROVED PLAYER', CLUTCH: 'CLUTCH PLAYER OF THE YEAR', FMVP: 'FINALS MVP', ECF: 'EASTERN CONFERENCE FINALS MVP',
  WCF: 'WESTERN CONFERENCE FINALS MVP', ALL1: 'ALL-NBA FIRST TEAM', ALL2: 'ALL-NBA SECOND TEAM', ALL3: 'ALL-NBA THIRD TEAM',
  DEF1: 'ALL-DEFENSIVE FIRST TEAM', DEF2: 'ALL-DEFENSIVE SECOND TEAM', RK1: 'ALL-ROOKIE FIRST TEAM', RK2: 'ALL-ROOKIE SECOND TEAM', AS: 'ALL-STAR', ASMVP: 'ALL-STAR GAME MVP',
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

// the 65-game rule: games of 20+ minutes, two of 15-20 allowed. A man who never played 20 minutes in a game has no
// g20 on his line: that's none, not his games played. The near-miss exception: 62 games and a season-ending injury.
export const ruleGames = r => (r?.g20 ?? 0) + Math.min(2, r?.g15 ?? 0)
export const eligible = (r, need = 65, p = null) => ruleGames(r) >= need || (need === 65 && ruleGames(r) >= 62 && (p?.inj?.g ?? 0) >= 5)

// production a game: points, boards, assists, stocks, less turnovers, and efficiency (true shooting over the league's 57%)
export function prod(r) {
  const s = perGame(r)
  return s.ppg + 0.42 * s.rpg + 0.75 * s.apg + 1.3 * s.spg + 1.1 * s.bpg - 0.9 * s.tpg + 0.3 * (s.ts - 57) * Math.min(1, s.ppg / 20)
}
// the voters' read of a season: what he produced, and the defender he was (the box score's stocks are in prod; this is
// the rest of it, the All-Defensive vote's own measure, for the men who stand out there)
const seasonValue = (x, zf) => prod(x.r) + 0.45 * Math.max(0, Math.min(6, zf(x)))
// All-NBA: the season first, his team's record a factor: about four points of production from a .500 team to a
// 60-win team, and a losing record costs more (the voters name a man off a losing team about once a year: Doncic's
// 32 a game for a 38-win team in 2023 made the first team, most 25-point scorers on lottery teams make none)
const allNbaScore = (x, zf) => seasonValue(x, zf) + 17 * (x.wp - 0.5) - 26 * Math.max(0, 0.5 - x.wp)
// MVP: the best season on a team that won. The record counts for much more than it does for All-NBA, a top seed for a
// little more again, and under 50 wins the case falls away fast (the voters have gone there twice in forty years)
const mvpTeam = wp => 34 * (wp - 0.5) + (wp >= 0.68 ? 2 : 0) - 70 * Math.max(0, 0.61 - wp)
const mvpScore = (x, zf) => seasonValue(x, zf) + mvpTeam(x.wp)
// voter fatigue: the voters look for a new story. The reigning MVP needs a clearly better season to win again, a
// third straight is rare and a fourth all but never happens (the record is three: Russell, Chamberlain, Bird); a man
// with a shelf of them in the last few years gives a little back too
function fatigue(p, year) {
  const won = new Set((p?.aw ?? []).filter(a => a.k === 'MVP').map(a => a.y))
  let run = 0
  while (won.has(year - 1 - run)) run++
  let recent = 0
  for (let y = year - 10; y < year; y++) if (won.has(y)) recent++
  return [0, 2.5, 5.5, 12][Math.min(3, run)] + 1.4 * recent
}
// defense: steals, blocks, the defensive glass and the defender he is, each against the men who play his spot
// (a guard's 1.8 steals beside a center's 3 blocks), then the team's defense and his minutes. The bigs still win most
// (rim protection is worth the most), the way the voters have gone.
const DGRP = p => (!p ? 'W' : p.p === 'PG' || p.p === 'SG' ? 'G' : p.p === 'SF' ? 'W' : 'B')
function defNorm(rows) {
  const by = {}
  for (const x of rows) {
    const s = perGame(x.r), d = x.p ? prof(x.p) : null
    x.dv = [s.spg, s.bpg, s.rpg - s.orpg, d ? d.def : 5]
    ;(by[DGRP(x.p)] ??= []).push(x.dv)
  }
  const st = {}
  for (const [g, L] of Object.entries(by)) st[g] = [0, 1, 2, 3].map(j => { const v = L.map(a => a[j]), m = v.reduce((a, b) => a + b, 0) / v.length; return [m, Math.max(0.15, Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length))] })
  return x => { const S = st[DGRP(x.p)], z = j => Math.max(-2.5, Math.min(2.5, (x.dv[j] - S[j][0]) / S[j][1])); const B = DGRP(x.p) === 'B'; return S ? z(0) * (B ? 0.6 : 1.3) + z(1) * (B ? 1.2 : 0.3) + z(2) * 0.4 + z(3) * (B ? 1.1 : 1.3) : 0 }
}
function defScore(x, wp, zf) {
  const s = perGame(x.r)
  return zf(x) + 0.1 * s.bpg + 5 * (wp - 0.5) + Math.min(0, s.mpg - 28) * 0.15
}
// the All-Defensive teams: positionless since 2024, but the voters still name guards and wings (most years three or
// four guards and a couple of wings among the ten): at least three guards, two wings, no more than five bigs, and
// no team of five with more than three bigs
function allDefense(list, men) {
  const grp = i => DGRP(men.get(i))
  const pick = [], need = { G: 3, W: 2 }, maxB = 5
  for (const x of list) {
    if (pick.length >= 10) break
    const g = grp(x.i), left = 10 - pick.length
    const owe = Math.max(0, need.G - pick.filter(y => grp(y.i) === 'G').length) + Math.max(0, need.W - pick.filter(y => grp(y.i) === 'W').length)
    if (g === 'B' && pick.filter(y => grp(y.i) === 'B').length >= maxB) continue
    if (!(g in need && pick.filter(y => grp(y.i) === g).length < need[g]) && left <= owe) continue
    pick.push(x)
  }
  const first = [], second = []
  for (const x of pick) {
    const big = t => t.filter(y => grp(y.i) === 'B').length
    if (first.length < 5 && !(grp(x.i) === 'B' && big(first) >= 3)) first.push(x)
    else second.push(x)
  }
  while (first.length < 5 && second.length) first.push(second.shift())
  return [first.map(x => x.i), second.slice(0, 5).map(x => x.i)]
}
const top = (list, n) => list.sort((a, b) => b.v - a.v).slice(0, n)
const fives = (list, n) => Array.from({ length: n }, (_, j) => list.slice(j * 5, j * 5 + 5).map(x => x.i))

export function seasonAwards(F) {
  const men = menOf(F), W = winsOf(F)
  const rows = Object.entries(F.ss ?? {}).map(([id, r]) => ({ i: +id, r, p: men.get(+id), wp: winPct(W, r.s) }))
  const ok = rows.filter(x => eligible(x.r, 65, x.p))
  const rookie = x => x.p && (x.p.rk === F.year || (x.p.rk == null && (x.p.ys ?? 1) === 0))
  const zf = defNorm(ok)
  const allNba = top(ok.map(x => ({ i: x.i, v: allNbaScore(x, zf) })), 15)
  // (the MVP vote: the season and the record, then voter fatigue)
  const mvp = top(ok.map(x => ({ i: x.i, v: mvpScore(x, zf) - fatigue(x.p, F.year) })), 15)
  const dpoy = top(ok.map(x => ({ i: x.i, v: defScore(x, x.wp, zf) })), 40)
  // the rookies: the vote goes to the men who played a part all season (a starter's 12 points over a deep-bench man's
  // tidy line in 9 minutes): production, weighed by his games and his minutes. The men with a real role first (half
  // the season, 14 minutes a night); a thin class is filled out from the rest who played.
  const tg = Math.max(1, ...rows.map(x => x.r.gp ?? 0))
  const rkScore = x => { const s = perGame(x.r); return (prod(x.r) + 6) * Math.min(1, x.r.gp / (tg * 0.73)) * Math.sqrt(Math.min(1, s.mpg / 26)) }
  const rks = rows.filter(rookie).filter(x => x.r.gp >= tg * 0.3)
  const role = x => x.r.gp >= tg * 0.5 && x.r.min / x.r.gp >= 14
  const roy = [...top(rks.filter(role).map(x => ({ i: x.i, v: rkScore(x) })), 10), ...top(rks.filter(x => !role(x)).map(x => ({ i: x.i, v: rkScore(x) })), 10)].slice(0, 10)
  // (Sixth Man: a real scorer off the bench, ten a game or more)
  const sixth = top(ok.filter(x => x.r.gs * 2 < x.r.gp && perGame(x.r).ppg >= 10).map(x => ({ i: x.i, v: prod(x.r) + 6 * (x.wp - 0.5) })), 5)
  // the jump: this season against his last (a real season last year: 40+ games), never a rookie or a man who won MVP before
  const last = id => { const p = men.get(id); return (p?.car ?? []).filter(c => c.y === F.year - 1).reduce((a, c) => ({ gp: a.gp + c.gp, pts: a.pts + c.pts, reb: a.reb + c.reb, ast: a.ast + c.ast, min: a.min + c.min }), { gp: 0, pts: 0, reb: 0, ast: 0, min: 0 }) }
  const mip = top(ok.filter(x => !rookie(x) && !(x.p?.aw ?? []).some(a => a.k === 'MVP')).map(x => {
    const L = last(x.i); if (L.gp < 40) return null
    const s = perGame(x.r)
    // (a man who's now a real rotation player: 12 points a game, 24 minutes)
    if (s.ppg < 12 || s.mpg < 24) return null
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
      mip.push(...top(xs.filter(x => x.p.ag <= 25 && x.p.o < 84 && perGame(x.r).ppg >= 12).map(x => ({ i: x.i, v: prod(x.r) - (my + b * (x.p.o - mx)) })), 5))
    }
  }
  // Clutch: the points that won games, on a team that won them (every winner of it has played on a winning team)
  const cl = ok.filter(x => x.wp >= 0.5)
  const clutch = top((cl.length >= 5 ? cl : ok).map(x => ({ i: x.i, v: (x.r.cp ?? 0) * (0.7 + 0.6 * x.wp) + 60 * (x.wp - 0.5) })), 5)
  const out = {
    MVP: mvp[0]?.i ?? null, DPOY: dpoy[0]?.i ?? null, ROY: roy[0]?.i ?? null, '6MOY': sixth[0]?.i ?? null, MIP: mip[0]?.i ?? null, CLUTCH: clutch[0]?.i ?? null,
    ALL: fives(allNba, 3), ALLDEF: allDefense(dpoy, men), ROOKIE: fives(roy, 2),
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
// F.rec = { from (the first season on the books), game: {}, season: {}, career: {}, fr: { s, game, season, career } }
//   game / season: the league's marks since the save began; each { v, i, n, y, s? (his team) }
//   career: the active record holders, their real seasons before the save counted (realCareers.js), so the points
//           record is LeBron James's real total and whatever is added to it here
//   fr: the same three books for the GM's team alone (s), from its men's seasons with it
// REAL_RECORDS: the NBA's own records going into 2026-27, the measure for every one of them. game and season:
// [value, holder, when]. career: the record among men no longer playing (the men still playing are in the league and
// carry their real totals).
export const REAL_RECORDS = {
  game: { pts: [100, 'Wilt Chamberlain', 1962], reb: [55, 'Wilt Chamberlain', 1960], ast: [30, 'Scott Skiles', 1990], tpm: [14, 'Klay Thompson', 2018], stl: [11, 'Larry Kenon', 1976], blk: [17, 'Elmore Smith', 1973] },
  season: { ppg: [50.4, 'Wilt Chamberlain', '1961-62'], rpg: [27.2, 'Wilt Chamberlain', '1960-61'], apg: [14.5, 'John Stockton', '1989-90'], tpm: [402, 'Stephen Curry', '2015-16'], spg: [3.67, 'Alvin Robertson', '1985-86'], bpg: [5.56, 'Mark Eaton', '1984-85'] },
  career: { pts: [38387, 'Kareem Abdul-Jabbar', '1969-89'], reb: [23924, 'Wilt Chamberlain', '1959-73'], ast: [15806, 'John Stockton', '1984-2003'], stl: [3265, 'John Stockton', '1984-2003'], blk: [3830, 'Hakeem Olajuwon', '1984-2002'], tpm: [2973, 'Ray Allen', '1996-2014'], gp: [1611, 'Robert Parish', '1976-97'] },
}
const GAME_K = { pts: 'hi', reb: 'hr', ast: 'ha', tpm: 'h3', stl: 'hs', blk: 'hb' }
const SEASON_K = ['ppg', 'rpg', 'apg', 'spg', 'bpg']
const CAREER_K = ['pts', 'reb', 'ast', 'stl', 'blk', 'tpm', 'gp']
// the books' rows, in the order a records page shows them: [key, label]
export const RECORD_ROWS = {
  game: [['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['tpm', 'Threes'], ['stl', 'Steals'], ['blk', 'Blocks']],
  season: [['ppg', 'Points a game'], ['rpg', 'Rebounds a game'], ['apg', 'Assists a game'], ['tpmS', 'Threes made'], ['spg', 'Steals a game'], ['bpg', 'Blocks a game']],
  career: [['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['tpm', 'Threes'], ['stl', 'Steals'], ['blk', 'Blocks'], ['gp', 'Games']],
}
// the NBA's own record for a row of a book, or null: [value, holder, when]
export const realRecord = (book, k) => REAL_RECORDS[book]?.[k === 'tpmS' ? 'tpm' : k] ?? null
// a mark as it's written: an average to a tenth (the NBA's own steals and blocks records to the hundredth they're
// kept at), a count with its commas
export const recordValue = (k, v) => (SEASON_K.includes(k) ? (Math.round(v * 10) / 10 === v ? v.toFixed(1) : String(v)) : Math.round(v).toLocaleString('en-US'))
const seasonTxt = y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`
const NOUN = { pts: 'points', reb: 'rebounds', ast: 'assists', tpm: 'threes', stl: 'steals', blk: 'blocks', ppg: 'points', rpg: 'rebounds', apg: 'assists', spg: 'steals', bpg: 'blocks', tpmS: 'threes' }
const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const poss = n => `${n}'${/s$/.test(n) ? '' : 's'}`
// A record as a beat writer files it: the man, the number, what it's the most of, and whose mark it passed.
//   an NBA record (past the real one, or past the record a man set in this league after breaking the real one):
//     "Luka Doncic's 429 threes are the most in a season in NBA history, past Stephen Curry's 402 in 2015-16."
//   the league's best since the save began (never said as "since": the seasons counted are the ones on the books):
//     "Ausar Thompson's 3.1 steals a game are the most in a season in the last three years, past Cooper Flagg's 2.9 in 2026-27."
function recordText(F, book, k, b, was, from) {
  const real = realRecord(book, k)
  const num = recordValue(k, b.v), per = SEASON_K.includes(k)
  const what = `${poss(b.n)} ${num} ${NOUN[k]}${per ? ' a game' : book === 'game' ? ' in a game' : ''}`
  const are = `${what} ${per || num !== '1' ? 'are' : 'is'}`
  const span = book === 'game' ? 'in a game' : 'in a season'
  // (whose mark he passed: the old holder, his own said as his own; a mark set in this league by its season, the
  // NBA's own by the year or season the book gives)
  const old = (w, when) => `${w.i != null && w.i === b.i ? 'his own' : poss(w.n)} ${recordValue(k, w.v)} in ${when}`
  if (real && b.v > real[0]) return `${are} the most ${span} in NBA history, past ${was && was.v > real[0] ? old(was, seasonTxt(was.y)) : old({ n: real[1], v: real[0] }, real[2])}.`
  if (!was) return null
  const n = F.year - from + 1
  return `${are} the most ${span} in the last ${WORDS[n] ?? n} years, past ${old(was, seasonTxt(was.y))}.`
}
export function updateRecords(F) {
  const men = menOf(F), rec = (F.rec ??= { game: {}, season: {}, career: {} })
  const news = []
  const from = (rec.from ??= F.year)
  // the season's best in every mark first: when two men pass the old mark in one season, the book and the wire name
  // the man who finished with it
  const best = new Map()
  const put = (B, book, k, v, i, n, s) => { if (!(v > 0)) return; const key = `${book}.${k}`, m = (best.get(B) ?? best.set(B, {}).get(B)); if (!m[key] || v > m[key].v) m[key] = { book, k, v, i, n, s } }
  const mine = F.team
  // (the GM's team's own book; a save from before it starts from its men's seasons on their career lines)
  const fresh = !rec.fr || rec.fr.s !== mine
  const fr = fresh ? (rec.fr = { s: mine, game: {}, season: {}, career: {} }) : rec.fr
  const tg = Math.max(1, ...Object.values(F.ss ?? {}).map(r => r.gp ?? 0))
  for (const [id, r] of Object.entries(F.ss ?? {})) {
    const p = men.get(+id), n = p?.n ?? ''
    if (!n) continue
    // (his whole season with the GM's team: a man traded in or out has his best nights on one line, whoever he played them for)
    const allHere = r.s === mine && !(Array.isArray(r.sp) && r.sp.length)
    for (const [k, f] of Object.entries(GAME_K)) if (r[f]) { put(rec, 'game', k, r[f], +id, n, r.s); if (allHere) put(fr, 'game', k, r[f], +id, n, r.s) }
    if ((r.gp ?? 0) >= tg * 0.7) { const s = perGame(r); for (const k of SEASON_K) { put(rec, 'season', k, s[k], +id, n, r.s); if (allHere) put(fr, 'season', k, s[k], +id, n, r.s) } }
    if (r.tpm) { put(rec, 'season', 'tpmS', r.tpm, +id, n, r.s); if (allHere) put(fr, 'season', 'tpmS', r.tpm, +id, n, r.s) }
  }
  // careers: every man's whole career, his real seasons before the save and his seasons here (this one included)
  for (const p of men.values()) {
    const cur = F.ss?.[p.i]
    const t = careerTotals(p, cur && !(p.car ?? []).some(c => c.y === F.year) ? cur : null)
    if (!t.gp) continue
    // (a made-up veteran's earlier seasons aren't numbers anyone has: his career is what he's done here)
    for (const k of CAREER_K) put(rec, 'career', k, t[k], p.i, p.n, null)
  }
  // the franchise's careers: what each man has done for this team since the save began (his rows with it)
  const hereRows = p => { const rows = (p.car ?? []).filter(c => c.s === mine && !c.y2), cur = F.ss?.[p.i]; if (cur?.gp && cur.s === mine && !(Array.isArray(cur.sp) && cur.sp.length) && !rows.some(c => c.y === F.year)) rows.push({ ...cur, y: F.year }); return rows }
  for (const p of men.values()) {
    const rows = hereRows(p)
    if (!rows.length) continue
    for (const k of CAREER_K) put(fr, 'career', k, rows.reduce((a, c) => a + (c[k] ?? 0), 0), p.i, p.n, mine)
    // (the first time: his earlier seasons with the team go in the season book too)
    if (fresh) for (const c of rows) if (c.y < F.year && c.gp >= 57) {
      const old = fr.season
      for (const [k, f] of [['ppg', 'pts'], ['rpg', 'reb'], ['apg', 'ast'], ['spg', 'stl'], ['bpg', 'blk']]) { const v = Math.round((c[f] ?? 0) / c.gp * 10) / 10; if (v > (old[k]?.v ?? 0)) old[k] = { v, i: p.i, n: p.n, y: c.y, s: mine } }
      if ((c.tpm ?? 0) > (old.tpmS?.v ?? 0)) old.tpmS = { v: c.tpm, i: p.i, n: p.n, y: c.y, s: mine }
    }
  }
  for (const [B, m] of best) for (const b of Object.values(m)) {
    const book = B[b.book], was = book[b.k]
    if (was && b.v <= was.v) continue
    book[b.k] = { v: b.v, i: b.i, n: b.n, y: F.year, ...(b.s && { s: b.s }) }
    // the wire: the league's game and season marks (a career mark grows every night: the book shows it)
    if (B !== rec || b.book === 'career') continue
    if (was && was.y >= F.year) continue
    // (a mark over the one season before it isn't a story: an NBA record always is, the league's own from its third season)
    const real = realRecord(b.book, b.k)
    if (!(real && b.v > real[0]) && F.year - from < 2) continue
    const text = recordText(F, b.book, b.k, b, was, from)
    if (text) news.push({ k: 'record', i: b.i, ...(b.s && { s: b.s }), text })
  }
  return news
}
// ── The Hall of Fame ─────────────────────────────────────────────────────────────
// Who goes in, off a retired man's row (offseason.js retiredRow): an MVP, or a career that adds up to one: his points,
// boards and assists (his real seasons counted), his All-NBA teams, All-Star Games, titles and trophies in this league.
// A real man's honors before the save aren't in the league's data, so the men who had a Hall of Fame career before
// 2026-27 go in on it (HALL_RESUME: the league MVPs, the Finals MVPs with a second title, the NBA's 75th Anniversary
// Team's active members, and the multi-time champions and All-NBA regulars beside them).
// The wait is the Hall's own: two full seasons retired, so a man whose last season was 2026-27 is in the class of 2030.
export const HALL_RESUME = new Set(['LeBron James', 'Stephen Curry', 'Kevin Durant', 'James Harden', 'Russell Westbrook', 'Chris Paul', 'Kawhi Leonard', 'Giannis Antetokounmpo', 'Anthony Davis', 'Damian Lillard', 'Nikola Jokic', 'Joel Embiid', 'Shai Gilgeous-Alexander', 'Luka Doncic', 'Jayson Tatum', 'Kyrie Irving', 'Klay Thompson', 'Draymond Green', 'Paul George', 'Jimmy Butler III', 'Jimmy Butler', 'Rudy Gobert'])
const HALL_PTS = { MVP: 8, FMVP: 5, DPOY: 4, ALL1: 3, ALL2: 2, ALL3: 1.5, ROY: 1, DEF1: 1, '6MOY': 0.5 }
export function hallScore(r) {
  const [, pts = 0, reb = 0, ast = 0] = r.t ?? []
  let v = pts / 1000 + 0.6 * reb / 1000 + 0.9 * ast / 1000 + 1.5 * (r.as ?? 0) + 1.5 * (r.ch ?? 0)
  for (const a of r.aw ?? []) v += HALL_PTS[String(a).slice(4)] ?? 0
  return v
}
export const hallOfFamer = r => !!r && r.t != null && ((r.b == null && HALL_RESUME.has(r.n)) || (r.aw ?? []).some(a => String(a).slice(4) === 'MVP') || hallScore(r) >= 30)
export const hallClass = r => (r.y != null ? r.y + 4 : null)
