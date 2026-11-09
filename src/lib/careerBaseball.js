// CAREER, BASEBALL: a batter's or a pitcher's career, its own module. lib/career.js runs every sport on one engine;
// baseball's rules, its data and its engine live here, so a football, basketball or soccer career never downloads
// them. career.js loads this with ensureSport('baseball') and this file registers SPORT.baseball (registerSport).
//   The draft: the MLB Draft Combine (showcase drills), sit-downs with scouts and front offices, then the MLB Draft
//   (20 rounds, a slot from the showcase, the build, the interviews and the club's need) and a signing bonus.
//   The minors: Opening Day at Double-A or Triple-A (by the slot and the build), a short stint, then the call-up.
//   The season: 162 games through the season director, his lineup spot or his place in the rotation / bullpen,
//   the All-Star break (the Game and the Home Run Derby), the trade deadline, the postseason (twelve clubs, the
//   Wild Card Series, the Division Series, the LCS and the World Series, every one a series).
//   The offseason: club control (pre-arbitration, arbitration in years 3-6), free agency after six years of
//   service, extension offers, trade requests, development points, Tommy John risk for pitchers.
//   The legacy: MVPs, Cy Youngs and rings first; the Hall of Fame is the BBWAA's vote at Cooperstown (75%).
import {
  SPORT, registerSport, depthChart, teamFit, makeRoster, seasonScore, bookSeason, roundOdds, lastPlayOf, momentHitRate, seriesPlay, seriesState, bestOf,
  countedHonors, earnLegacy, CAREER_X, pickLabel, registerDrills,
} from './career'
import { GAMES, PLAYOFF_GAMES, COMBINE_GAMES } from './minigames'
import { seeded } from './rng'
import { momentSituation, finalScore } from './situations'
import { RECORDS } from './seasonFacts'
import { seasonRaw, registerStats } from './careerStats'
import { HEADSHOT_BASE } from '../utils/simulation'
import * as SIM from '../utils/baseballSimulation'
import { MLB_TEAMS } from '../data/mlb-teams'
import * as MB from '../data/mlb-batters'
import * as MP from '../data/mlb-pitchers'
import * as LBM from '../data/mlb-legend-batters'
import * as LPM from '../data/mlb-legend-pitchers'
import { MLB_ATTR, BAT_TYPES, PIT_TYPES } from '../data/mlb-attrs'
import MLB_HEADSHOTS from '../data/mlb-headshots.json'
import { BAT_RESUMES, PIT_RESUMES } from '../data/legacy-resumes-baseball'
import './baseballFacts'       // the records and milestones (lib/seasonFacts.js RECORDS.baseball)
import './baseballSeason'      // the season's story cards, the in-game moments and the playoff scoreboard
import './baseballDirector'    // the season director's baseball (lib/seasonDirector.js registerDirector)
import { BAT_DEFS, PIT_DEFS } from './baseballStats'

const { rosterOf, keepRoster, rosterYrs, outOf, LAST_PLAY, goalMet, buildOf, byOvr, clamp, r10, FIRST_SEASON, fitFor, hashN } = CAREER_X
const arrOf = (m, name) => m?.[name] ?? Object.values(m ?? {}).find(v => Array.isArray(v)) ?? []
const BATTERS = arrOf(MB, 'MLB_BATTERS'), PITCHERS = arrOf(MP, 'MLB_PITCHERS')
const LEGEND_BATTERS = arrOf(LBM, 'MLB_LEGEND_BATTERS'), LEGEND_PITCHERS = arrOf(LPM, 'MLB_LEGEND_PITCHERS')
const ovrOfBuild = (b, pos) => Math.round(SIM.calcBaseballOVR(b, pos === 'pit' ? PIT_TYPES : BAT_TYPES, pos) ?? 70)
const logit = u0 => { const u = clamp(u0, 0.001, 0.999); return Math.log(u / (1 - u)) }
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
const r3 = v => Math.round(v * 1000) / 1000
const r2 = v => Math.round(v * 100) / 100
const last = n => String(n ?? '').split(' ').filter(w => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w)).pop() ?? n
// innings from outs, the way a box score prints them: 6.2 is six and two-thirds
export const ipText = outs => `${Math.floor((outs ?? 0) / 3)}.${(outs ?? 0) % 3}`
// a rate as the scoreboard prints it: .312, 1.045
export const rate3 = v => (v == null ? '—' : v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, ''))
export const money = m => (m >= 100 ? `$${Math.round(m)}M` : m >= 10 ? `$${r10(m)}M` : m >= 1 ? `$${r2(m).toFixed(2).replace(/0$/, '')}M` : `$${Math.round(m * 1000)}K`)

// ── The clubs ────────────────────────────────────────────────────────────────
const TEAM_BY = new Map(MLB_TEAMS.map(t => [t.short, t]))
const TWO_WORD = /\s(Red Sox|White Sox|Blue Jays)$/
const nickOfTeam = t => t?.nick ?? TWO_WORD.exec(t?.name ?? '')?.[1] ?? String(t?.name ?? '').split(' ').slice(-1)[0]
export const LEAGUE_NAME = { AL: 'American League', NL: 'National League' }
const leagueOf = short => (TEAM_BY.get(short)?.league === 'NL' ? 'NL' : 'AL')
const memo = new Map()
function mlbTeam(short) {
  if (memo.has(short)) return memo.get(short)
  const t = TEAM_BY.get(short) ?? MLB_TEAMS[0]
  const out = { short: t.short, name: t.name, nick: nickOfTeam(t), color: t.color, color2: t.color2, off: clamp(t.off ?? 5.5, 1, 10), def: clamp(t.def ?? 5.5, 1, 10), conf: LEAGUE_NAME[t.league] ?? t.league, div: `${t.league} ${t.division}`, league: t.league, division: t.division }
  memo.set(short, out)
  return out
}
// (a club's strength this season: its ratings and the offseason's drift)
const clubStr = (c, short) => { const t = mlbTeam(short), d = c.league?.[short] ?? { off: 0, def: 0 }; return (t.off + d.off + t.def + d.def) / 2 }

// ── The players ──────────────────────────────────────────────────────────────
const BY_NAME = new Map([...LEGEND_BATTERS, ...LEGEND_PITCHERS, ...BATTERS, ...PITCHERS].map(p => [p.name, p]))
const BORN = new Map([...BATTERS, ...PITCHERS].filter(p => typeof p.age === 'number').map(p => [p.name, FIRST_SEASON - p.age]))
const ROLE_BY = new Map([...BATTERS, ...PITCHERS].filter(p => p.role).map(p => [p.name, p.role]))
const hsKey = p => { const f = p?.espn != null ? MLB_HEADSHOTS[String(p.espn)] : null; return f ? String(f).replace(/\.(webp|png|jpe?g)$/i, '') : null }
const mlbPhoto = p => { const k = hsKey(p); return k ? `${HEADSHOT_BASE}/${k}.webp` : null }
// a man's role: the data's (C … DH, SP / RP / CL), else one fixed by his name (a made-up pick)
const FIELD_ROLES = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']
export function roleOf(p, g = 'bat') {
  const r = p?.slot ?? ROLE_BY.get(p?.name)
  if (r) return r
  const h = hashN(`${p?.name}-role`)
  return g === 'pit' ? (h % 9 < 4 ? 'SP' : 'RP') : FIELD_ROLES[h % 8]
}
const isSP = role => role === 'SP'
// His own role. A pitcher: a starter when his stamina carries a lineup three times through (B- or better), else a
// reliever. A batter: where his glove, his arm and his legs put him on the field (DH when they don't).
// Rookie of the Year: under 130 at-bats or 50 innings in the majors before this season
const rookieOf = c => (c.pos === 'pit' ? (c.mlbOuts ?? 0) < 150 : (c.mlbAB ?? 0) < 130)
export function pitRole(c) { if (c.pitRole) return c.pitRole; return (c.build?.stamina?.val ?? 5) >= 5 ? 'SP' : 'RP' }
export function fieldPosOf(build) {
  const v = k => build?.[k]?.val ?? 5
  const f = v('fielding'), a = v('arm'), s = v('speed')
  if (f >= 8 && a >= 7 && s >= 5) return 'SS'
  if (f >= 7 && s >= 8) return 'CF'
  if (a >= 8 && f >= 6) return s >= 6 ? 'RF' : '3B'
  if (f >= 7 && a >= 6 && s <= 4) return 'C'
  if (f >= 7) return '2B'
  if (f >= 5) return s >= 5 ? 'LF' : '1B'
  return f >= 3 ? '1B' : 'DH'
}
export const fieldPos = c => c.fieldPos ?? fieldPosOf(c.build)
export const POS_WORD = { C: 'catcher', '1B': 'first baseman', '2B': 'second baseman', '3B': 'third baseman', SS: 'shortstop', LF: 'left fielder', CF: 'center fielder', RF: 'right fielder', DH: 'designated hitter', SP: 'starting pitcher', RP: 'reliever', CL: 'closer' }
const POS_AT = { C: 'catcher', '1B': 'first base', '2B': 'second base', '3B': 'third base', SS: 'shortstop', LF: 'left field', CF: 'center field', RF: 'right field', DH: 'designated hitter' }

// ── The lineup, the rotation, the bullpen ────────────────────────────────────
// The batting order: the best bat hits second, then third, the next leads off (the modern card), then 4-9.
const SPOT_OF_RANK = [2, 3, 1, 4, 5, 6, 7, 8, 9]
// plate appearances a start by the spot in the order (2023-25 MLB averages: leadoff about 4.65, ninth 3.8)
const PA_AT = { 1: 4.65, 2: 4.55, 3: 4.45, 4: 4.35, 5: 4.25, 6: 4.15, 7: 4.05, 8: 3.95, 9: 3.85 }
export function usageOf(c) {
  const dc = depthChart(c)
  if (c.pos === 'pit') {
    const role = pitRole(c), i = dc.idx + 1
    if (role === 'SP') return i <= 5 ? { kind: 'rotation', role: 'SP', spot: i, label: `NO. ${i} STARTER`, starter: true } : { kind: 'long', role: 'SP', spot: i, label: 'LONG RELIEF', starter: false }
    return i === 1 ? { kind: 'closer', role: 'CL', spot: 1, label: 'CLOSER', starter: true } : i <= 3 ? { kind: 'setup', role: 'RP', spot: i, label: 'SETUP', starter: false } : { kind: 'pen', role: 'RP', spot: i, label: 'BULLPEN', starter: false }
  }
  if (!dc.starter) return { kind: 'bench', spot: null, label: 'BENCH', starter: false, fp: fieldPos(c) }
  const spot = SPOT_OF_RANK[dc.idx] ?? dc.idx + 1
  return { kind: 'lineup', spot, label: `BATTING ${ordinal(spot).toUpperCase()}`, starter: true, fp: fieldPos(c) }
}
// what the sim plays (utils/baseballSimulation.js reads these): team.role (his position, or SP / RP / CL), team.order
// (his spot), team.usage (the share of the games he starts; an everyday player's rest days are the sim's own) and
// team.bench. A long man is a starter with a few spot starts; a middle reliever pitches less often than a setup man.
function usageNumbers(c, u) {
  const age = c.age ?? 27
  if (c.pos === 'pit') {
    if (u.kind === 'rotation') return { role: 'SP', usage: age >= 39 ? 0.88 : 1, bench: false }
    if (u.kind === 'long') return { role: 'SP', usage: 0.25, bench: true }
    if (u.kind === 'closer') return { role: 'CL', usage: 1, bench: false }
    return { role: 'RP', usage: u.kind === 'setup' ? 1 : 0.78, bench: u.kind !== 'setup' }
  }
  if (u.kind === 'bench') return { role: u.fp, usage: 0.32, order: 9, bench: true }
  return { role: u.fp, usage: age >= 37 ? 0.88 : age >= 35 ? 0.94 : 1, order: u.spot, bench: false }
}

// ── The league table: the other 29 clubs' records, seeded by the season (the sim plays his club's) ──
// Twelve make it: three division winners and three wild cards a league. Seeds 1-2 (the best division winners) sit
// out the Wild Card Series. A record from strength: a .375-.625 club, about 61 to 101 wins, give or take six.
function leagueTable(tb, wins, short) {
  const r = seeded(tb.seed)
  const rows = MLB_TEAMS.map(t => {
    const s = tb.str?.[t.short] ?? (mlbTeam(t.short).off + mlbTeam(t.short).def) / 2
    const w = t.short === short ? wins : clamp(Math.round(162 * clamp(0.5 + (s - 5.5) * 0.05, 0.33, 0.67) + (r() + r() + r() - 1.5) * 10), 50, 112)
    return { short: t.short, league: t.league, division: t.division, wins: w, losses: 162 - w, s, isUs: t.short === short }
  })
  const order = (a, b) => b.wins - a.wins || b.s - a.s || (a.isUs ? -1 : 1)
  const seeds = {}
  for (const lg of ['AL', 'NL']) {
    const L = rows.filter(x => x.league === lg).sort(order)
    const leaders = [...new Set(L.map(x => x.division))].map(d => L.find(x => x.division === d)).sort(order)
    const wc = L.filter(x => !leaders.includes(x)).slice(0, 3)
    ;[...leaders, ...wc].forEach((x, i) => { x.seed = i + 1; x.divWin = i < 3 })
    seeds[lg] = [...leaders, ...wc].map(x => ({ short: x.short, wins: x.wins, seed: x.seed, divWin: x.divWin }))
    // games back of the last wild card, for everyone else
    const cut = wc[2]?.wins ?? 0
    for (const x of L) if (!x.seed) x.gb = cut - x.wins
  }
  const me = rows.find(x => x.isUs)
  const div = rows.filter(x => x.league === me?.league && x.division === me?.division).sort(order).map(x => ({ short: x.short, wins: x.wins, losses: x.losses }))
  return { seed: me?.seed ?? null, divWin: !!me?.divWin, gb: me?.gb ?? 0, seeds, div }
}

// ── One game, whatever the sim calls its fields (lib/../utils/baseballSimulation.js), in Career's shape ──
const num = (...v) => { for (const x of v) if (typeof x === 'number' && Number.isFinite(x)) return x; return 0 }
const outsOfIp = ip => { const n = Number(ip); if (!Number.isFinite(n) || n <= 0) return 0; const w = Math.floor(n), f = n - w; return Math.abs(f * 10 - Math.round(f * 10)) < 1e-6 && Math.round(f * 10) <= 2 ? w * 3 + Math.round(f * 10) : Math.round(n * 3) }
function normGame(g, i, pos) {
  const L = g.line ?? g.stats ?? g.box ?? g
  const opp = g.opp ?? g.oppShort ?? (typeof g.opponent === 'object' ? g.opponent?.short : g.opponent) ?? null
  const mySc = num(g.mySc, g.rs, g.runs, g.myRuns, g.myScore), oppSc = num(g.oppSc, g.ra, g.oppRuns, g.oppScore)
  const won = typeof g.won === 'boolean' ? g.won : g.result ? g.result === 'W' : mySc > oppSc
  // (a day he sat: rest, the bench, or the sim's own injured list: `il`, so the screens can say so)
  const out = { g: i + 1, wk: i + 1, opponent: opp, home: g.home ?? (g.away != null ? !g.away : i % 2 === 0), mySc, oppSc, won, ...(g.reason === 'IL' ? { il: 1 } : {}) }
  if (pos === 'pit') {
    const outs = Number.isFinite(L.outs) ? L.outs : outsOfIp(L.ip ?? L.IP)
    const dec = String(L.dec ?? L.decision ?? '').toUpperCase()
    const app = (L.app ?? L.appeared ?? (outs > 0 || num(L.bf, L.er) > 0 || !!dec)) ? 1 : 0
    return { ...out, app, gs: num(L.gs) > 0 || L.gs === true ? 1 : 0, outs, ha: num(L.ha, L.hAllowed, L.h), er: num(L.er), bb: num(L.bb, L.bbA), k: num(L.k, L.so, L.ks), hra: num(L.hra, L.hrAllowed, L.hr), hbp: num(L.hbp),
      w: num(L.w) > 0 || dec === 'W' ? 1 : 0, l: num(L.l) > 0 || dec === 'L' ? 1 : 0, sv: num(L.sv) > 0 || dec === 'S' || dec === 'SV' ? 1 : 0, hld: num(L.hld) > 0 || dec === 'H' || dec === 'HLD' ? 1 : 0, bs: num(L.bs) > 0 ? 1 : 0,
      ...(L.nh ? { nh: 1 } : {}), ...(L.cg ? { cg: 1 } : {}), ...(L.sho ? { sho: 1 } : {}) }
  }
  const ab = num(L.ab, L.AB), bb = num(L.bb, L.BB), hbp = num(L.hbp), sf = num(L.sf)
  const pa = num(L.pa, L.PA) || ab + bb + hbp + sf
  const app = num(L.gp, L.app) > 0 || pa > 0 ? 1 : 0
  return { ...out, app, gs: app ? (L.gs == null ? 1 : num(L.gs) > 0 ? 1 : 0) : 0, pa, ab, h: num(L.h, L.hits), d: num(L.d, L.doubles, L['2b']), t: num(L.t, L.triples, L['3b']), hr: num(L.hr, L.HR), rbi: num(L.rbi, L.RBI), r: num(L.r, L.runsScored), bb, hbp, sf, k: num(L.k, L.so, L.SO), sb: num(L.sb), cs: num(L.cs),
    ...(L.wo ? { wo: 1 } : {}), ...(L.cycle ? { cycle: 1 } : {}), ...(L.slam ? { slam: num(L.slam) } : {}) }
}
const ZERO_BAT = { app: 0, gs: 0, pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, r: 0, bb: 0, hbp: 0, sf: 0, k: 0, sb: 0, cs: 0 }
const ZERO_PIT = { app: 0, gs: 0, outs: 0, ha: 0, er: 0, bb: 0, k: 0, hra: 0, hbp: 0, w: 0, l: 0, sv: 0, hld: 0 }
const unit = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296 }
// the sim's season, as Career keeps it: his games in Career's shape, his club's place in the table
// (a game keeps only what it has: a 162-game season is saved several times over mid-season, the director's runs, so
// the zeros go; everything that reads a game reads a missing stat as 0)
const KEEP = new Set(['g', 'wk', 'opponent', 'home', 'mySc', 'oppSc', 'won'])
const compact = g => { const o = {}; for (const [k, v] of Object.entries(g)) if (KEEP.has(k) || (v !== 0 && v !== false && v != null)) o[k] = v; return o }
function careerRun(r, pos, t) {
  let games = (r?.games ?? []).map((g, i) => compact(normGame(g, i, pos)))
  // (a sim that plays him every day when Career has him on the bench: the days he sits are the ones he didn't play)
  const share = t.usage
  if (pos === 'bat' && t.bench && share != null && share < 0.9) {
    const apps = games.filter(g => g.app).length / Math.max(1, games.length)
    if (apps > share + 0.12) games = games.map((g, i) => (unit(`${t.tbl?.seed}-dnp-${i}`) < share / apps ? g : { ...g, ...ZERO_BAT }))
  }
  const wins = games.filter(g => g.won).length
  const tbl = leagueTable(t.tbl ?? { seed: 'x' }, wins, t.short)
  // (the sim's book: its world and the vote's noise, so the season's awards can be decided again from the games played)
  const simRef = r?.book ? { book: { ...r.book, field: null }, position: pos, role: r.role, pos: r.pos ?? null, frRate: r.frRate ?? 0, runIdx: r.runIdx ?? 0, v: r.v ?? null, mode: r.mode ?? 'current' } : null
  return { wins, losses: games.length - wins, games, seed: tbl.seed, madePlayoffs: tbl.seed != null, divWin: tbl.divWin, gb: tbl.gb, seeds: tbl.seeds, div: tbl.div, lg: leagueOf(t.short), ovr: r?.ovr ?? null, short: t.short, tbl: t.tbl, simRef }
}
// after the moments moved a game or two: the table again from the record he really posted
function bbFinal(f, t) {
  if (!f.short || !f.tbl) return f
  const tbl = leagueTable(f.tbl, t.wins, f.short)
  // (whether he's in stays what the season already showed: the director drew this run to match it)
  return { ...f, seed: f.madePlayoffs ? tbl.seed ?? 6 : null, divWin: tbl.divWin, gb: tbl.gb, seeds: tbl.seeds, div: tbl.div }
}

// ── A season's numbers, from the games he played ─────────────────────────────
// 2025 MLB: .245/.315/.404 (OPS+ 100), the wOBA weights and scale, a 4.10 FIP; FanGraphs' replacement level
// (about 20 runs a 600 plate appearances for a hitter, .120 wins a nine innings for a starter, .030 for a reliever)
// and its positional adjustments (runs a 162 games). Baseball-Reference / FanGraphs league pages, 2025.
export const LG = { obp: 0.315, slg: 0.404, woba: 0.313, wobaScale: 1.23, fip: 4.1, fipC: 3.1, rpw: 9.7, dRPW: 9.6 }
const POS_ADJ = { C: 12.5, SS: 7.5, CF: 2.5, '2B': 2.5, '3B': 2.5, LF: -7.5, RF: -7.5, '1B': -12.5, DH: -17.5 }
const sum = (list, k) => list.reduce((s, g) => s + (g[k] ?? 0), 0)
// the field: his glove and his arm (and at center, his legs), in runs over 150 games (OAA's range, about -15 to +15)
export const fieldRuns = (build, fp) => (fp === 'DH' ? 0 : ((build?.fielding?.val ?? 5) - 5.5) * 2.4 + ((build?.arm?.val ?? 5) - 5.5) * (['SS', '3B', 'RF', 'C'].includes(fp) ? 0.9 : 0.4) + (fp === 'CF' ? ((build?.speed?.val ?? 5) - 5.5) * 0.8 : 0))
export function batLine(games, build = null, fp = 'DH') {
  const P = games.filter(g => !g.sat && g.app)
  const s = Object.fromEntries(['pa', 'ab', 'h', 'd', 't', 'hr', 'rbi', 'r', 'bb', 'hbp', 'sf', 'k', 'sb', 'cs'].map(k => [k, sum(P, k)]))
  const singles = s.h - s.d - s.t - s.hr, tb = s.h + s.d + 2 * s.t + 3 * s.hr
  const avg = s.ab ? s.h / s.ab : 0, obp = s.ab + s.bb + s.hbp + s.sf ? (s.h + s.bb + s.hbp) / (s.ab + s.bb + s.hbp + s.sf) : 0, slg = s.ab ? tb / s.ab : 0
  const woba = s.ab + s.bb + s.sf + s.hbp ? (0.69 * s.bb + 0.72 * s.hbp + 0.88 * singles + 1.25 * s.d + 1.59 * s.t + 2.04 * s.hr) / (s.ab + s.bb + s.sf + s.hbp) : 0
  const runs = ((woba - LG.woba) / LG.wobaScale) * s.pa + (s.sb * 0.2 - s.cs * 0.42) + (((build?.speed?.val ?? 5) + (build?.baserunning?.val ?? 5)) - 11) * 0.45 * (s.pa / 650)
    + fieldRuns(build, fp) * (P.length / 150) + (POS_ADJ[fp] ?? 0) * (P.length / 162) + 20 * (s.pa / 600)
  return { ...s, d2: s.d, t3: s.t, gp: P.length, tb, avg: r3(avg), obp: r3(obp), slg: r3(slg), ops: r3(obp + slg), opsPlus: s.pa ? Math.round(100 * (obp / LG.obp + slg / LG.slg - 1)) : 0, war: s.pa ? r10(runs / LG.rpw) : 0 }
}
export function pitLine(games, role = 'SP') {
  const P = games.filter(g => !g.sat && g.app)
  const s = Object.fromEntries(['gs', 'outs', 'ha', 'er', 'bb', 'k', 'hra', 'hbp', 'w', 'l', 'sv', 'hld'].map(k => [k, sum(P, k)]))
  const ip = s.outs / 3
  const fip = ip ? (13 * s.hra + 3 * (s.bb + s.hbp) - 2 * s.k) / ip + LG.fipC : 0
  const rel = s.gs < P.length / 2
  // (a reliever's innings are higher leverage: a closer's count about 1.8 times, a setup man's 1.4)
  const lev = !rel ? 1 : role === 'CL' ? 1.8 : 1.3
  const war = ip ? ((LG.fip - fip) / LG.dRPW + (rel ? 0.03 : 0.12)) * (ip / 9) * (rel ? (1 + lev) / 2 : 1) : 0
  return { ...s, gp: P.length, ip: r10(ip), era: s.outs ? r2(s.er * 27 / s.outs) : 0, whip: s.outs ? r2((s.ha + s.bb) * 3 / s.outs) : 0, fip: r2(fip), k9: s.outs ? r10(s.k * 27 / s.outs) : 0, bb9: s.outs ? r10(s.bb * 27 / s.outs) : 0, war: r10(war), qs: P.filter(g => g.gs && g.outs >= 18 && g.er <= 3).length, cg: P.filter(g => g.gs && g.outs >= 27).length, sho: P.filter(g => g.gs && g.outs >= 27 && g.er === 0).length }
}
const seasonLine = (c, f) => (c.pos === 'pit' ? pitLine(f.games ?? [], usageNumbers(c, usageOf(c)).role) : batLine(f.games ?? [], c.build, fieldPos(c)))

// the showcase drills: the mini games' list when it's in (COMBINE_GAMES), else these; [id, label, the trait it tests]
const SHOWCASE = {
  bat: [['sixty', '60-yard dash', 'speed'], ['exit-velo', 'Exit velocity', 'power'], ['arm-strength', 'Throw home from right', 'arm']],
  pit: [['pitch-velo', 'Fastball velocity', 'velocity'], ['spin', 'Breaking ball spin', 'breaking'], ['bullpen', 'Bullpen session', 'command']],
}
const LABEL = Object.fromEntries([...SHOWCASE.bat, ...SHOWCASE.pit].map(([id, label, trait]) => [id, [label, trait]]))
const titleCase = s => String(s ?? '').toLowerCase().replace(/(^|\s|-)([a-z])/g, (m, a, b) => a + b.toUpperCase())
function combineOf(pos) {
  const ids = COMBINE_GAMES?.[pos]
  if (!ids?.length) return SHOWCASE[pos]
  return ids.map(id => [id, LABEL[id]?.[0] ?? titleCase(GAMES[id]?.title ?? id), LABEL[id]?.[1] ?? GAMES[id]?.traits?.find(t => (pos === 'pit' ? PIT_TYPES : BAT_TYPES).includes(t)) ?? (pos === 'pit' ? 'velocity' : 'power')])
}

// The build the sim plays in a Career. Past an A- (8) a grade counts for less: a career's development takes a build
// to all A+ and S, and the sim's line for that runs past any real season (17 WAR, 63 home runs a year). The league
// adjusts to a hitter like that (they pitch around him, the best relievers face him late) and an arm like that only
// carries so far over 33 starts: so an S bat plays like about an 8.5 (an S arm a 8.9), the level of the real
// best (Aaron Judge's 10.8 WAR in 2024, Tarik Skubal's 2.39 ERA). (CAREER_TOP: the share of a grade past 8 that counts)
// (a pitcher keeps a little more of it: the real best arms, Bob Gibson 1968, Dwight Gooden 1985, run past 11 WAR)
export const CAREER_TOP = { bat: 0.15, pit: 0.3 }
const careerBuild = (b, pos) => Object.fromEntries(Object.entries(b ?? {}).map(([t, ch]) => [t, ch && typeof ch.val === 'number' && ch.val > 8 ? { ...ch, val: 8 + (ch.val - 8) * CAREER_TOP[pos === 'pit' ? 'pit' : 'bat'] } : ch]))

// ── Baseball ─────────────────────────────────────────────────────────────────
const BASEBALL = {
  id: 'baseball', league: 'MLB', isBucket: false, isBaseball: true, screen: 'ag-screen--baseball', site: 'build-a-player.com/baseball',
  card: { accent: '#f1e9d8', glow: '#c8102e' },   // (the share cards: ball leather and red stitching)
  teams: MLB_TEAMS, logo: s => `/logos/mlb/${s}.png`,
  teamOf: short => mlbTeam(short),
  status: core => (core >= 7.2 ? 'Contender' : core >= 6 ? 'In the hunt' : core >= 4.8 ? 'Middle of the pack' : 'Rebuilding'),
  positions: ['bat', 'pit'],
  side: { bat: 'off', pit: 'def' },
  label: { bat: 'BATTER', pit: 'PITCHER' }, posName: { bat: 'Batter', pit: 'Pitcher' },
  types: { bat: BAT_TYPES, pit: PIT_TYPES }, attr: { bat: MLB_ATTR, pit: MLB_ATTR },
  pool: { bat: BATTERS, pit: PITCHERS },
  // the 26-man roster: thirteen position players and thirteen pitchers (nine in the lineup, five in the rotation)
  groups: ['bat', 'pit'], starters: { bat: 9, pit: 5 }, keep: { bat: 13, pit: 13 }, slots: {},
  depthLabel: (pos, i) => (pos === 'pit' ? `P${i}` : `B${i}`),
  ovr: (pos, b) => ovrOfBuild(b, pos),
  realOvr: (pos, p) => Math.round(p.ovr ?? ovrOfBuild(buildOf(pos === 'pit' ? PIT_TYPES : BAT_TYPES, p), pos)),
  photo: name => mlbPhoto(BY_NAME.get(name)),
  sim: pos => (b, t, seed) => careerRun(SIM.runBaseballSimulation(careerBuild(b, pos), pos === 'pit' ? PIT_TYPES : BAT_TYPES, t, pos, 'current', seed ?? null, 'career'), pos, t),
  // what the sim plays: his club on Career's 1-10 scale (the lineup around a batter, the staff around a pitcher),
  // how much of the season is his, and the seed of the league table
  simTeam: (t, fit, m, c) => {
    const u = usageOf(c)
    const pit = c.pos === 'pit'
    const str = Object.fromEntries(MLB_TEAMS.map(x => [x.short, clubStr(c, x.short)]))
    const n = usageNumbers(c, u)
    // (fast: the director's many re-runs skip the award field; the season's awards are booked once, bbSeason)
    return { short: t.short, name: t.name, league: t.league, career: true, fast: true, replaces: false, off: clamp(fit.off + (pit ? 0 : fit.adj) + (m.off ?? 0), 1, 10), def: clamp(fit.def + (pit ? fit.adj : 0) + (m.def ?? 0), 1, 10),
      role: n.role, usage: n.usage, bench: n.bench, ...(n.order ? { order: n.order } : {}), ...(u.kind === 'rotation' ? { slot: u.spot - 1 } : {}), rookie: rookieOf(c), age: c.age, year: c.season, contractYear: c.contract?.left === 1, tbl: { seed: `${c.seed}-tbl-${c.year}`, str } }
  },
  // the club around him: a batter's lineup (protection, men on base) and its pitching; a pitcher's staff, the
  // lineup scoring for him and the gloves behind him
  fit: (ro, pos, notMe, spot, short, yrs = 0) => {
    const vs = (list, med, per) => (list.length ? r10(clamp(6 + (list.reduce((s, p) => s + p.ovr, 0) / list.length - med) * per, 1, 11)) : 4)
    const bats = (ro.bat ?? []).filter(notMe).sort(byOvr).slice(0, 8), arms = (ro.pit ?? []).filter(notMe)
    const rot = arms.filter(p => isSP(roleOf(p, 'pit'))).sort(byOvr).slice(0, 5), pen = arms.filter(p => !isSP(roleOf(p, 'pit'))).sort(byOvr).slice(0, 4)
    const lineG = vs(bats, 80, 0.55), rotG = vs(rot, 80, 0.55), penG = vs(pen, 76, 0.55)
    const groups = pos === 'pit' ? [{ k: 'ROTATION', v: rotG, names: rot.map(p => p.name) }, { k: 'BULLPEN', v: penG, names: pen.map(p => p.name) }, { k: 'LINEUP', v: lineG, names: bats.slice(0, 4).map(p => p.name) }]
      : [{ k: 'LINEUP', v: lineG, names: bats.slice(0, 4).map(p => p.name) }, { k: 'ROTATION', v: rotG, names: rot.map(p => p.name) }, { k: 'BULLPEN', v: penG, names: pen.map(p => p.name) }]
    const adj = pos === 'pit' ? (lineG - 6) * 0.12 + (penG - 6) * 0.08 : (lineG - 6) * 0.15
    return { groups, adj, need: 11 - (pos === 'pit' ? (rotG + penG) / 2 : lineG), lineup: lineG, rotation: rotG, bullpen: penG }
  },
  fitNote: (f, pos) => (pos === 'pit' ? (f.lineup >= 8 ? 'A lineup that scores. Run support turns his good starts into wins.' : f.lineup < 5 ? 'A lineup that can’t hit. He’ll lose some 2-1 games he pitched well enough to win.' : f.bullpen < 5 ? 'A shaky bullpen behind him. Leads he hands over don’t always hold.' : 'An honest lineup and an honest bullpen. The ball is in his hand.')
    : (f.lineup >= 8 ? 'Protection in the order: pitchers have to come after him, and the men in front of him get on.' : f.lineup < 5 ? 'Not much around him in the order. Pitchers will work around him.' : 'An honest lineup around him. The at-bats decide it.')),
  physical: { bat: ['speed', 'arm'], pit: ['velocity', 'stamina'] },
  // the eye at the plate, clutch and the reads on the bases; a pitcher's command, his control, his head
  ageless: ['eye', 'clutch', 'baserunning', 'command', 'control', 'pitchIQ', 'composure'],
  finalsAward: 'WORLD SERIES MVP',
  ageShift: () => 0,
  trainUntil: () => 27, declineAt: () => 32,
  // (drafted at 21-22: 2 points a year through 24, 1 through 29, then the prime holds)
  devYoung: () => 24, devPrime: () => 30,
  durTraitOf: { bat: 'speed', pit: 'stamina' },
  bigInjury: 40,
  draft: { rounds: 20, stock: () => [1, 1], rookie: () => ({ kind: 'control', years: 6, left: 6, perYear: 0.78 }), posList: ['RHP', 'SS', 'OF', 'C', 'LHP', '3B', 'CF', '2B', '1B', 'RHP', 'LHP', 'OF'] },
  // the MLB Draft Combine and showcase: the mini games agent's drills (lib/minigames.js COMBINE_GAMES.bat / .pit
  // when they're in; until a drill is there it plays as simulated, from the trait). Read when a career starts.
  get combine() { return { bat: combineOf('bat'), pit: combineOf('pit') } },
  goals: {
    bat: (ovr, c) => {
      const pow = (c?.build?.power?.val ?? 5) >= 7, fast = (c?.build?.speed?.val ?? 5) >= 8
      return [pow ? ['hr', 'Hit', ovr >= 92 ? 38 : ovr >= 86 ? 30 : ovr >= 80 ? 22 : 15, 'home runs'] : fast ? ['sb', 'Steal', ovr >= 90 ? 40 : 25, 'bases'] : ['h', 'Collect', ovr >= 92 ? 190 : ovr >= 86 ? 170 : 150, 'hits'],
        ['rbi', 'Drive in', ovr >= 92 ? 110 : ovr >= 86 ? 95 : 75, 'runs'], ['war', 'Post', ovr >= 92 ? 7 : ovr >= 86 ? 5 : ovr >= 80 ? 3 : 2, 'WAR']]
    },
    pit: (ovr, c) => (pitRole(c ?? {}) === 'SP'
      ? [['w', 'Win', ovr >= 92 ? 17 : ovr >= 86 ? 14 : 11, 'games'], ['k', 'Strike out', ovr >= 92 ? 230 : ovr >= 86 ? 190 : 150, 'batters'], ['era', 'Post an ERA of', ovr >= 92 ? 2.75 : ovr >= 86 ? 3.25 : 3.9, 'or better', true]]
      : [['sv', 'Save', ovr >= 90 ? 38 : ovr >= 84 ? 30 : 20, 'games'], ['k', 'Strike out', ovr >= 90 ? 85 : 70, 'batters'], ['era', 'Post an ERA of', ovr >= 90 ? 2.25 : ovr >= 84 ? 2.9 : 3.5, 'or better', true]]),
  },
  seasonStats: (pos, f) => (pos === 'pit' ? pitLine(f.games ?? []) : batLine(f.games ?? [])),
  rateKeys: ['avg', 'obp', 'slg', 'ops', 'opsPlus', 'era', 'whip', 'fip', 'k9', 'bb9', 'ip'],
  averages: null,
  headline: { bat: ['h', 'hr', 'avg'], pit: ['w', 'k', 'era'] },
  extra: { bat: ['rbi', 'ops', 'war'], pit: ['sv', 'whip', 'war'] },
  awardName: { bat: 'MVP', pit: 'CY YOUNG' },
  honor: 'All-Star', honors: 'ALL-STARS', first: 'All-MLB First Team',
  minGames: { award: 0, first: 0, honor: 0 },
  proBowl: { bat: () => false, pit: () => false }, allPro: { bat: () => false, pit: () => false }, allProNear: { bat: () => false, pit: () => false },
  award: () => false,
  // (a season, 0 to about 1: WAR first, then the rate stat, then how the club did)
  seasonScore: (pos, s) => { const st = s.stats ?? {}; const rel = pos === 'pit' && (st.gs ?? 0) < (st.gp ?? 0) / 2; return clamp(clamp((st.war ?? 0) / (rel ? 3 : pos === 'pit' ? 7 : 8), -0.2, 1.3) * 0.65 + (pos === 'pit' ? clamp((4.6 - (st.era || 4.6)) / 2.4, 0, 1.2) : clamp(((st.opsPlus ?? 100) - 85) / 80, 0, 1.2)) * 0.15 + (s.wins ?? 81) / 100 * 0.2, 0, 1.25) },
  legacyProd: (pos, st) => (st.war ?? 0) * 1 + (st.h ?? 0) / 300 + (st.hr ?? 0) / 40 + (st.w ?? 0) / 25 + (st.k ?? 0) / 400 + (st.sv ?? 0) / 40,
  made: f => !!f.madePlayoffs,
  rounds: ['Wild Card Series', 'Division Series', 'Championship Series', 'World Series'], final: 'World Series', series: true,
  lineKeys: ['h', 'hr', 'rbi', 'ab', 'k', 'outs', 'er', 'w', 'sv'],
  step: 18, gameWord: 'GAME', snaps: 'playing time', injScale: 17 / 162, oldInjuries: true, moneyWord: 'WAR',   // (injScale: the engine's per-game risk over a 162-game season; the sim skips its own injured list for team.career)
  // [what, games out (low, high), how often]. Only the season-enders list ends a season (by position: injuriesOf)
  injuries: [['hamstring strain', 10, 25, 6]],
  seasonEnders: ['torn ACL'],
  // salaries, $ millions a year (2026: the league minimum $780K; the top AAV $51M, Juan Soto; a pitcher's $43.3M, Max Scherzer and Justin Verlander)
  money: { bat: [0.78, 51], pit: [0.78, 43.3] },
  moneyOf: c => BASEBALL.money[c.pos] ?? [0.78, 45],
  primeNote: pos => (pos === 'pit' ? 'Velocity and stamina can be trained until 28 (the last year at double the cost) and start to fade at 32; the pitches until 35; command, control, composure and pitch IQ for good. Command, control, composure and pitch IQ never fade. Tommy John is the risk on every arm, more on a fragile one.' : 'Speed and arm can be trained until 28 (the last year at double the cost) and start to fade at 32; contact, power and the glove until 35; the eye, avoiding strikeouts, baserunning and clutch for good. The eye, baserunning smarts and clutch never fade. Big injuries and a fragile body can cost a grade.'),
  // (the ages the real ones are gone by; shirt numbers; the trait that gives his face)
  retireAt: { bat: 39, pit: 41 }, castNum: { bat: [1, 79], pit: [11, 99] }, face: { bat: 'eye', pit: 'pitchIQ' },
  groupLabel: (g, p) => (g === 'pit' ? (isSP(roleOf(p, 'pit')) ? (p?.throws === 'L' ? 'LHP' : 'RHP') : 'RP') : roleOf(p, 'bat')),
}
const INJURIES = {
  bat: [['hamstring strain', 10, 25, 6], ['oblique strain', 15, 35, 5], ['hand contusion (hit by a pitch)', 7, 15, 4], ['sprained ankle', 7, 20, 3], ['lower back tightness', 5, 12, 3], ['wrist sprain', 10, 30, 3], ['concussion (7-day IL)', 7, 12, 1], ['knee sprain', 15, 40, 2], ['broken hand', 30, 50, 1], ['shoulder strain', 15, 30, 2]],
  pit: [['shoulder inflammation', 15, 30, 5], ['elbow inflammation', 15, 30, 5], ['forearm strain', 15, 40, 4], ['blister on his pitching hand', 7, 15, 3], ['oblique strain', 15, 30, 3], ['lower back strain', 10, 20, 2], ['lat strain', 30, 60, 2], ['hamstring strain', 10, 20, 2]],
}
const ENDERS = { bat: ['torn ACL', 'torn labrum', 'broken wrist'], pit: ['torn UCL (Tommy John surgery)', 'torn UCL (Tommy John surgery)', 'torn labrum', 'torn rotator cuff'] }
const TJ = 'torn UCL (Tommy John surgery)'
// the rooms the data leaves short: a bench of made-up position players, a rotation of five and a bullpen of eight,
// every made-up man below the real ones (the data is each club's core)
BASEBALL.fill = {
  // (below the real ones, but never into a spiral: years on, when the real ones have aged out, a bench is a bench of
  // 70s; and a made-up man takes a spot on the field nobody else plays)
  bat: (list, pick, keep) => {
    while (list.length < keep) { const low = list.length ? Math.min(...list.map(p => p.ovr)) : 78, open = FIELD_ROLES.find(r => !list.some(x => roleOf(x, 'bat') === r)), p = pick(open ?? null); list.push({ ...p, age: 23 + (p.age - 21) * 3, ovr: clamp(Math.min(p.ovr, Math.max(low - 1, 72)), 60, 86) }) }
    return [...list].sort(byOvr).slice(0, keep)
  },
  pit: (list, pick, keep) => {
    const sp = () => list.filter(p => isSP(roleOf(p, 'pit'))), low = l => (l.length ? Math.min(...l.map(p => p.ovr)) : 78)
    while (sp().length < 5 && list.length < keep) { const l = low(sp()), p = pick('SP'); list.push({ ...p, age: 23 + (p.age - 21) * 3, ovr: clamp(Math.min(p.ovr, Math.max(l - 1, 72)), 60, 86) }) }
    while (list.length < keep) { const l = low(list.filter(p => !isSP(roleOf(p, 'pit')))), p = pick('RP'); list.push({ ...p, age: 24 + (p.age - 21) * 3, ovr: clamp(Math.min(p.ovr, Math.max(l - 1, 70)), 60, 84) }) }
    return [...list].sort(byOvr).slice(0, keep)
  },
}
BASEBALL.statLabel = {
  gp: 'G', pa: 'PA', ab: 'AB', h: 'H', d2: '2B', t3: '3B', hr: 'HR', rbi: 'RBI', r: 'R', bb: 'BB', so: 'K', sb: 'SB', avg: 'AVG', obp: 'OBP', slg: 'SLG', ops: 'OPS', opsPlus: 'OPS+', war: 'WAR', tb: 'TB',
  w: 'W', l: 'L', era: 'ERA', gs: 'GS', ip: 'IP', outs: 'IP', k: 'K', whip: 'WHIP', sv: 'SV', hld: 'HLD', fip: 'FIP', k9: 'K/9', ha: 'H', er: 'ER', hra: 'HR', qs: 'QS', cg: 'CG', sho: 'SHO',
}
// a stat as a baseball page prints it (the screens: AppCareer reads S.fmtStat)
BASEBALL.fmtStat = (k, v) => (v == null ? '—' : ['avg', 'obp', 'slg', 'ops'].includes(k) ? rate3(v) : ['era', 'whip', 'fip'].includes(k) ? Number(v).toFixed(2) : k === 'outs' ? ipText(v) : k === 'ip' ? ipText(Math.round(v * 3)) : k === 'war' || k === 'k9' ? Number(v).toFixed(1) : Number(v).toLocaleString())

// ═════════════════════════════════════════════════════════════════════════════
// THE DRAFT: the MLB Draft Combine and showcase, the sit-downs, twenty rounds, a signing bonus
// ═════════════════════════════════════════════════════════════════════════════
const N_TEAMS = MLB_TEAMS.length, ROUNDS = 20, MAX_PICK = N_TEAMS * ROUNDS
// where the build goes on talent alone: pick ranges by OVR (a 95 goes first or second, a 72 on day three)
const STOCK = [[95, 1, 3], [92, 1, 8], [89, 3, 18], [86, 10, 34], [83, 25, 70], [80, 50, 120], [77, 90, 200], [74, 150, 320], [70, 250, 450], [-99, 380, 600]]
export function bbStock(c) {
  const [, lo0, hi0] = STOCK.find(([min]) => c.ovr >= min)
  const mid = (lo0 + hi0) / 2, span = 3 + mid * 0.22
  const d = c.draft, played = (d?.combine ?? []).filter(x => x.pct != null)
  const comb = played.length ? played.reduce((s, x) => s + x.pct, 0) / played.length : 0
  const inter = (d?.interviews ?? []).reduce((s, x) => s + (x.answer != null ? x.a[x.answer].stock : 0), 0)
  const shift = Math.round(-comb * span - inter * Math.max(1, mid * 0.03))
  const lo = clamp(lo0 + shift, 1, MAX_PICK), hi = clamp(hi0 + shift, lo, MAX_PICK)
  return { lo, hi, shift }
}
const band = o => { const { round, slot } = pickLabel(o, 'baseball'); return { round, part: slot <= 10 ? 'Early' : slot <= 20 ? 'Mid' : 'Late' } }
export function draftText(c) {
  const { lo, hi } = bbStock(c), a = band(lo), b = band(hi)
  if (a.round === b.round) return a.part === b.part ? `${a.part} ${ordinal(a.round)} round` : `${a.part}–${b.part.toLowerCase()} ${ordinal(a.round)} round`
  if (b.round - a.round >= 3) return `Rounds ${a.round}–${b.round}`
  return `${a.part} ${ordinal(a.round)} – ${b.part.toLowerCase()} ${ordinal(b.round)} round`
}
// the order: worst records first (the lottery's top six, close enough), seeded
function draftOrder(c) { const r = seeded(`draft-${c.seed}`); return MLB_TEAMS.map(t => mlbTeam(t.short)).sort((a, b) => (a.off + a.def + r() * 3) - (b.off + b.def + r() * 3)).map(t => t.short) }
// the 2025 draft's slot values (MLB's bonus pool, Baseball America): No. 1 about $11.1M, No. 10 $6.1M, the end of
// round one $2.9M, the end of round two $1.25M, round five about $430K, round ten $165K; after round ten, $150K
export function slotValue(o) {
  if (o <= 1) return 11.1
  if (o <= 30) return r2(11.1 * Math.exp(-0.0466 * (o - 1)) + 0.3)
  if (o <= 75) return r2(2.9 * Math.exp(-0.0187 * (o - 30)))
  if (o <= 300) return r2(Math.max(0.165, 1.25 * Math.exp(-0.0094 * (o - 75))))
  return 0.15
}
const INTERVIEWS_BASEBALL = [
  { who: 'Scouting director', q: 'Our reports have a chase problem: breaking balls down and away with two strikes. Fair?', a: [
    { t: 'It’s true. I’ve been working on shortening up with two strikes all spring.', stock: 2, persona: 'grinder' },
    { t: 'Pitchers throw it there because they can’t get me anywhere else.', stock: 1, persona: 'confident' },
    { t: 'I don’t worry about strikeouts. I hit the ball out.', stock: -1, persona: 'cocky' } ] },
  { who: 'General manager', q: 'A start at Double-A, maybe for a full year. How does that sit?', a: [
    { t: 'Whatever it takes. I’ll make the decision hard for you.', stock: 2, persona: 'grinder' },
    { t: 'I won’t be there long. You’ll see.', stock: 1, persona: 'confident' },
    { t: 'I’m ready for the big leagues now. Bus rides aren’t for me.', stock: -2, persona: 'cocky' } ] },
  { who: 'Area scout', q: 'I’ve seen twenty of the games. Tell me about the one worth a do-over.', a: [
    { t: 'The regional final. I tried to do too much and expanded the zone all night. I learned from it.', stock: 2, persona: 'grinder' },
    { t: 'I don’t have many of those. I usually show up.', stock: 1, persona: 'confident' },
    { t: 'None. The umpire cost us that one.', stock: -2, persona: 'cocky' } ] },
  { who: 'Farm director', q: 'Our player development staff will want to change something in the swing. Open to that?', a: [
    { t: 'Absolutely. Show me the data and I’ll put in the work.', stock: 2, persona: 'grinder' },
    { t: 'If it makes me better, sure. It’s gotten me this far, though.', stock: 1, persona: 'confident' },
    { t: 'My swing is my swing. I’m not changing it.', stock: -2, persona: 'cocky' } ] },
  { who: 'President of baseball operations', q: 'Signability matters to us. Is it the highest bidder or nothing?', a: [
    { t: 'I want to play pro ball. We’ll work out something fair.', stock: 1, persona: 'grinder' },
    { t: 'My advisor will handle it. I know what I’m worth.', stock: 1, persona: 'confident' },
    { t: 'If it’s not over slot, I’m going back to school.', stock: -2, persona: 'cocky' } ] },
  { who: 'Manager', q: 'We’re a team that runs. Bunt when we ask, take the extra base, play the game right. Is that the player we’re getting?', a: [
    { t: 'That’s how I was raised to play. Whatever wins the game.', stock: 2, persona: 'grinder' },
    { t: 'I’ll do it, and I’ll still be the one driving in the runs.', stock: 1, persona: 'confident' },
    { t: 'I don’t bunt. I’m a middle-of-the-order bat.', stock: -1, persona: 'cocky' } ] },
  { who: 'Head athletic trainer', q: 'The medicals flagged some soreness last spring. Be straight with us.', a: [
    { t: 'It was tendinitis. Here are the MRI reports and my throwing program, read them.', stock: 2, persona: 'grinder' },
    { t: 'I never missed a start because of it.', stock: 1, persona: 'confident' },
    { t: 'Trainers worry too much.', stock: -2, persona: 'cocky' } ] },
  { who: 'General manager', q: 'A veteran calls out the rookie in the clubhouse for not running out a ground ball. What happens next?', a: [
    { t: 'He’s right. I tell him so and I run out the next one.', stock: 2, persona: 'grinder' },
    { t: 'I answer it on the field the next day.', stock: 1, persona: 'confident' },
    { t: 'I tell him to worry about his own at-bats.', stock: -2, persona: 'cocky' } ] },
]
const INTERVIEWS_PITCHER = [
  { who: 'Pitching coordinator', q: 'The fastball plays up in the zone. What’s the plan when a hitter starts sitting on it?', a: [
    { t: 'Change his eye level: the curveball off the same tunnel, then back up the ladder.', stock: 2, persona: 'confident' },
    { t: 'Mix in the changeup early in counts so he can’t sit on anything.', stock: 1, persona: 'grinder' },
    { t: 'I throw it harder. Let him try to catch up.', stock: -1, persona: 'cocky' } ] },
  { who: 'Manager', q: '100 pitches in the sixth with a one-run lead. I come out to get the ball. What’s the answer?', a: [
    { t: 'Nothing. I hand you the ball and trust the bullpen.', stock: 2, persona: 'grinder' },
    { t: 'I tell you I’ve got one more hitter in me, then I give you the ball.', stock: 1, persona: 'confident' },
    { t: 'I tell you it’s my game and I’m finishing it.', stock: -2, persona: 'cocky' } ] },
  { who: 'Head athletic trainer', q: 'Our doctors want to see the elbow. Any tightness, ever?', a: [
    { t: 'Some last spring. I shut it down, did the rehab, here are the reports.', stock: 2, persona: 'grinder' },
    { t: 'Never missed a start.', stock: 1, persona: 'confident' },
    { t: 'My arm’s made of rubber. No need to look.', stock: -2, persona: 'cocky' } ] },
]
const P_SWAP = q => !/swing|chase|bunt/.test(q.q)
export function bbInterviews(c) {
  const r = seeded(`int-${c.seed}`)
  const order = draftOrder(c)
  const { lo, hi } = bbStock(c)
  const near = []
  for (let o = Math.max(1, lo - 4); o <= Math.min(MAX_PICK, hi + 4) && near.length < N_TEAMS; o++) { const t = order[(o - 1) % N_TEAMS]; if (!near.includes(t)) near.push(t) }
  const teams = near.map(t => ({ t, k: r() })).sort((a, b) => a.k - b.k).slice(0, 4).map(x => x.t)
  const bank = c.pos === 'pit' ? [...INTERVIEWS_BASEBALL.filter(P_SWAP), ...INTERVIEWS_PITCHER] : INTERVIEWS_BASEBALL
  const qs = [...bank].sort(() => r() - 0.5).slice(0, teams.length)
  return { ...c, draft: { ...c.draft, interviews: qs.map((q, i) => ({ ...q, a: [...q.a].sort(() => r() - 0.5), team: teams[i], answer: null })) } }
}
const TICKER = ['Cade Holloway', 'Marcus Delgado', 'Tanner Kessler', 'Jalen Arroyo', 'Brooks Whitley', 'Mateo Rosado', 'Gavin Lindgren', 'Eli Bratton', 'Nico Cardenas', 'Wyatt Dunmore', 'Ryder Ellsworth', 'Kai Fairchild', 'Dominic Galvan', 'Luke Pruitt', 'Javier Quinlan', 'Hayden Zamora']
// draft day: his pick inside the window, at the club that needs him most and liked him most in the room
export function bbDraft(c) {
  const r = seeded(`draft2-${c.seed}`)
  const order = draftOrder(c)
  const { lo, hi } = bbStock(c)
  const interest = {}
  for (const x of c.draft.interviews ?? []) if (x.answer != null) interest[x.team] = (interest[x.team] ?? 0) + x.a[x.answer].stock
  const need = short => teamFit(short, c.pos, { sport: 'baseball' }).need
  const cands = []
  for (let o = lo; o <= hi; o++) { const team = order[(o - 1) % N_TEAMS]; cands.push({ o, team, w: need(team) ** 2 + 1 + Math.max(0, interest[team] ?? 0) * 8 }) }
  const total = cands.reduce((s, x) => s + x.w, 0)
  let roll = r() * total, mine = cands[0]
  for (const x of cands) { roll -= x.w; if (roll <= 0) { mine = x; break } }
  const picks = []
  for (let o = Math.max(1, mine.o - 6); o < mine.o; o++) picks.push({ o, ...pickLabel(o, 'baseball'), team: order[(o - 1) % N_TEAMS], player: TICKER[(o * 7) % TICKER.length], pos: BASEBALL.draft.posList[(o * 5) % BASEBALL.draft.posList.length] })
  picks.push({ o: mine.o, ...pickLabel(mine.o, 'baseball'), team: mine.team, you: true })
  const roster = makeRoster(mine.team, 'baseball')
  const fit = teamFit(mine.team, c.pos, { roster, name: c.name, sport: 'baseball' })
  // the bonus: the slot's value, a little over for a pick the club wanted (a top one signs at slot or just under)
  const slot = slotValue(mine.o), bonus = r2(slot * (mine.o <= 10 ? 0.97 + r() * 0.05 : 0.9 + r() * 0.2 + Math.max(0, interest[mine.team] ?? 0) * 0.03))
  const lbl = pickLabel(mine.o, 'baseball')
  const met = (c.draft.interviews ?? []).some(x => x.team === mine.team)
  // where he opens his first year: Triple-A for a top-five pick or a big-league-ready build, else Double-A; the
  // games until the call-up from the build (a 95 is up in a couple of weeks, a 78 by the summer, a 70 in September)
  const level = mine.o <= 5 || c.ovr >= 86 ? 'AAA' : 'AA'
  const base = c.ovr >= 94 ? 8 : c.ovr >= 90 ? 18 : c.ovr >= 86 ? 35 : c.ovr >= 82 ? 60 : c.ovr >= 78 ? 85 : c.ovr >= 74 ? 110 : 135
  const games = clamp(Math.round(base * (level === 'AAA' ? 0.85 : 1.1) + (r() - 0.5) * 20 - (mine.o <= 3 ? 8 : 0)), 3, 150)
  const minors = { level, games, done: false, line: minorsLine(c, level, games, r) }
  const contract = { kind: 'control', years: 6, left: 6, perYear: 0.78, bonus }
  return {
    ...c, phase: 'draft', step: 'day', draft: { ...c.draft, picks, pick: picks[picks.length - 1], bonus, slot }, team: mine.team, roster, fit, contract, minors, service: 0, earnings: r10((c.earnings ?? 0) + bonus),
    fieldPos: c.pos === 'bat' ? fieldPosOf(c.build) : null, pitRole: c.pos === 'pit' ? ((c.build?.stamina?.val ?? 5) >= 5 ? 'SP' : 'RP') : null,
    decisions: [...c.decisions, { year: 1, text: `Drafted in round ${lbl.round}, pick ${lbl.slot} (No. ${mine.o} overall) by the ${fit.name}${met ? ' (they interviewed him)' : ''}. Signed for a ${money(bonus)} bonus (slot ${money(slot)}).` }],
  }
}
// his line in the minors before the call-up (the build at Double-A or Triple-A: a level below him, so it plays up)
function minorsLine(c, level, games, r) {
  const o = c.ovr ?? 75, up = level === 'AA' ? 0.012 : 0
  if (c.pos === 'pit') {
    const gs = Math.max(1, Math.round(games / 5)), ip = Math.round(gs * (4.8 + (o - 75) * 0.05) * 3)
    const era = r2(clamp(5.2 - (o - 70) * 0.12 - up * 40 + (r() - 0.5) * 0.8, 1.2, 6.5)), k = Math.round(ip / 3 * (0.9 + (o - 70) * 0.02))
    return { gs, outs: ip, era, k, w: Math.round(gs * 0.45), l: Math.round(gs * 0.25) }
  }
  const ab = Math.round(games * 3.8), avg = r3(clamp(0.235 + (o - 70) * 0.0045 + up + (r() - 0.5) * 0.03, 0.18, 0.38))
  const hr = Math.round(ab * clamp(0.02 + ((c.build?.power?.val ?? 5) - 5) * 0.006 + (o - 75) * 0.0008, 0.002, 0.09))
  return { g: games, ab, h: Math.round(ab * avg), hr, rbi: Math.round(hr * 2.6 + ab * 0.06), avg, ops: r3(clamp(0.62 + (o - 70) * 0.012 + up * 2 + (r() - 0.5) * 0.06, 0.5, 1.15)), sb: Math.round(games * Math.max(0, ((c.build?.speed?.val ?? 5) - 5) * 0.05)) }
}
const LEVEL = { AA: 'Double-A', AAA: 'Triple-A' }
export const levelName = l => LEVEL[l] ?? l
const minorsText = (c, m) => (c.pos === 'pit' ? `${m.line.w}-${m.line.l}, a ${m.line.era.toFixed(2)} ERA and ${m.line.k} strikeouts in ${ipText(m.line.outs)} innings` : `${rate3(m.line.avg)} with ${m.line.hr} home runs and a ${rate3(m.line.ops)} OPS in ${m.line.g} games`)

// ═════════════════════════════════════════════════════════════════════════════
// THE SEASON
// ═════════════════════════════════════════════════════════════════════════════
// The All-Star break: after about 96 games (mid-July). The trade deadline: about 108 (the end of July).
const ASB = total => Math.round(total * 96 / 162)
// Opening Day: the minors, a rehab, his role
function bbStart(c, D, dc, team) {
  const feed = []
  const u = usageOf(c), T = mlbTeam(c.team)
  let out = 0
  const m = c.minors
  if (m && !m.done) {
    out = clamp(m.games, 0, D.total - 6)
    if (out > 0) { D.sidelined(0, out); feed.push({ k: 0, note: `Opening Day. ${c.name} starts the year at ${levelName(m.level)}, in the ${T.nick}’ system. The big-league club is watching.`, noteKind: 'THE MINORS' }) }
  }
  if (c.rehab?.games > 0) {
    const n = clamp(c.rehab.games, 1, D.total)
    if (n > out) { D.sidelined(out, n - out); out = n }
    feed.push({ k: 0, note: n >= D.total ? `${c.name} spends the whole season rehabbing from ${c.rehab.what}.` : `${c.name} opens the season on the 60-day IL, still rehabbing from ${c.rehab.what}.`, noteKind: 'INJURED LIST' })
  }
  const role = c.pos === 'pit' ? (u.kind === 'rotation' ? `In the ${T.nick}’ rotation: the No. ${u.spot} starter.` : u.kind === 'long' ? 'Sixth in line for the rotation: long relief and spot starts.' : u.kind === 'closer' ? `The ${T.nick}’ closer. The ninth inning is his.` : u.kind === 'setup' ? 'Setup man: the eighth inning, the big outs before the closer.' : 'In the bullpen: middle relief, the sixth and seventh innings.')
    : u.kind === 'lineup' ? `Batting ${ordinal(u.spot)} in the ${T.nick}’ lineup, playing ${POS_AT[u.fp]}.` : `On the bench behind the everyday lineup: platoon starts, pinch-hit at-bats, a day off for a regular.`
  feed.push({ k: 0, note: role, noteKind: c.pos === 'pit' ? (u.kind === 'rotation' || u.kind === 'long' ? 'ROTATION' : 'BULLPEN') : 'LINEUP' })
  return { feed, role: u.starter ? 'Starter' : 'Backup', active: { out0: out, usage: u, asb: ASB(D.total) } }
}
// the career's totals before this season, the season so far on top: for the milestones
const CAREER_MARKS = {
  bat: [['h', 3000, '3,000 hits'], ['hr', 500, '500 home runs'], ['hr', 600, '600 home runs'], ['hr', 700, '700 home runs'], ['h', 4000, '4,000 hits'], ['hr', 762, 'Barry Bonds’ career home run record (762)'], ['h', 4256, 'Pete Rose’s career hits record (4,256)'], ['sb', 500, '500 stolen bases']],
  pit: [['w', 300, '300 wins'], ['k', 3000, '3,000 strikeouts'], ['sv', 500, '500 saves'], ['k', 4000, '4,000 strikeouts'], ['w', 511, 'Cy Young’s career wins record (511)'], ['k', 5714, 'Nolan Ryan’s career strikeout record (5,714)'], ['sv', 652, 'Mariano Rivera’s career saves record (652)']],
}
const before = (c, k) => c.seasons.reduce((s, x) => s + (x.stats?.[k] ?? 0), 0)
// story beats while the games go by: the call-up, back from the IL, the All-Star break, a milestone
function bbBeat(c, D, k) {
  const a = c.active, notes = [], set = {}
  let stop = false
  const T = mlbTeam(c.team)
  const g = D.games[k - 1]
  const out0 = a.out0 ?? 0
  if (out0 > 0 && k === out0 + 1 && !g?.sat) {
    const m = c.minors
    if (m && !m.done) {
      const opp = g?.opponent ? mlbTeam(g.opponent).nick : 'their opponent'
      notes.push({ note: `${c.name} gets the call. The ${T.nick} bring him up from ${levelName(m.level)} after ${minorsText(c, m)}. He makes his big-league debut ${g?.home ? 'at home' : 'on the road'} against the ${opp}.`, noteKind: 'CALLED UP' })
    } else notes.push({ note: `Activated off the injured list. ${c.name} is back in the ${T.nick}’ ${c.pos === 'pit' ? 'rotation' : 'lineup'}.`, noteKind: 'BACK FROM THE IL' })
    stop = true
  }
  // the All-Star break: the first half picks the team; the Home Run Derby the night before
  if (k === (a.asb ?? ASB(D.total)) && !a.asg) {
    const first = D.games.slice(0, k)
    const asg = allStarPick(c, first, k)
    set.asg = asg
    if (asg.picked) {
      notes.push({ note: asg.start ? `${c.name} is voted in as the ${LEAGUE_NAME[leagueOf(c.team)]}’s starter${c.pos === 'bat' ? ` at ${POS_AT[fieldPos(c)]}` : ' on the mound'}. An All-Star.` : `${c.name} is named to the ${leagueOf(c.team)} All-Star team. ${asg.why}`, noteKind: 'ALL-STAR' })
      if (asg.derby) notes.push({ note: asg.derby.won ? `Home Run Derby champion. ${c.name} hits ${asg.derby.hr} in the final round and takes the trophy home.` : `${c.name} takes part in the Home Run Derby: ${asg.derby.hr} home runs, out in the ${asg.derby.round}.`, noteKind: 'HOME RUN DERBY' })
      if (asg.mvp) notes.push({ note: `All-Star Game MVP. ${c.name} ${c.pos === 'pit' ? 'strikes out the side in his inning' : 'drives in the go-ahead run'} for the ${leagueOf(c.team)}.`, noteKind: 'ALL-STAR GAME' })
    } else if (first.filter(x => !x.sat).length > 20) notes.push({ note: `The All-Star break. ${c.name} watches the Midsummer Classic from home this year.`, noteKind: 'ALL-STAR BREAK' })
    stop = true
  }
  // career milestones as they fall
  if (g && !g.sat) {
    const P = D.games.slice(0, k).filter(x => !x.sat)
    const done = new Set(a.ms ?? [])
    for (const [key, n, label] of CAREER_MARKS[c.pos] ?? []) {
      const was = before(c, key) + P.slice(0, -1).reduce((s, x) => s + (x[key] ?? 0), 0), now = was + (g[key] ?? 0)
      if (was < n && now >= n && !done.has(label)) { done.add(label); notes.push({ note: `${label.startsWith(label.match(/^[A-Z][a-z]+ [A-Z]/)?.[0] ?? '#') ? `${c.name} passes ${label}` : `Career milestone: ${label}. ${c.name} gets there ${g.home ? 'at home' : 'on the road'} against the ${g.opponent ? mlbTeam(g.opponent).nick : 'opposition'}`}.`, noteKind: 'MILESTONE' }); stop = true }
    }
    if (done.size !== (a.ms ?? []).length) set.ms = [...done]
  }
  return notes.length || Object.keys(set).length ? { notes, set, stop } : null
}
// The All-Star team, from the first half: about the best tenth of the league's regulars, with the fans' vote for
// a big name (reputation); every club sends one. The Derby takes eight hitters with power and a pile of home runs.
function allStarPick(c, games, k) {
  const r = seeded(`${c.seed}-asg-${c.year}`)
  const P = games.filter(g => !g.sat && g.app)
  const fame = ((c.rep ?? 5) - 5) * 0.25
  if (c.pos === 'pit') {
    const L = pitLine(games, usageNumbers(c, a0(c)).role), rel = L.gs < L.gp / 2
    const pace = L.war * 162 / Math.max(1, k)
    const sc = rel ? (L.sv >= 20 ? 1 : 0) + (L.era <= 2.2 && L.outs >= 90 ? 1 : 0) + pace / 3 : pace / 3 + (L.era <= 2.8 && L.outs >= 270 ? 0.5 : 0) + (L.w >= 11 ? 0.3 : 0)
    const bar = 1.6 + 0.35 * logit(r()) - fame
    const picked = P.length >= (rel ? 18 : 10) && sc > bar
    return { picked, start: picked && !rel && sc > bar + 1.4, why: rel ? `${L.sv} saves and a ${L.era.toFixed(2)} ERA in the first half.` : `${L.w}-${L.l} with a ${L.era.toFixed(2)} ERA at the break.`, mvp: picked && r() < 0.04, line: { era: L.era, w: L.w, sv: L.sv, k: L.k } }
  }
  const L = batLine(games, c.build, fieldPos(c)), pace = L.war * 162 / Math.max(1, k)
  const sc = pace / 5.2 + (L.ops >= 0.9 ? 0.25 : 0) + (L.hr >= 24 ? 0.25 : 0)
  const bar = 1.05 + 0.25 * logit(r()) - fame * 0.6
  const picked = L.pa >= 200 && sc > bar
  // the Derby: an All-Star with power and 18+ at the break, now and then asked and he goes
  const pow = c.build?.power?.val ?? 5
  const asked = picked && L.hr >= 18 && pow >= 7 && r() < 0.65
  let derby = null
  if (asked) { const wp = clamp(0.12 + (pow - 8) * 0.07 + (L.hr - 24) * 0.006, 0.05, 0.42), won = r() < wp, rounds = ['first round', 'semifinals', 'final'], rd = won ? 2 : r() < 0.45 ? 0 : 1; derby = { won, hr: won ? 14 + Math.floor(r() * 10) : 8 + Math.floor(r() * 12), round: rounds[rd] } }
  return { picked, start: picked && sc > bar + 0.9, derby, why: `${rate3(L.avg)} with ${L.hr} home runs and a ${rate3(L.ops)} OPS at the break.`, mvp: picked && r() < 0.035, line: { avg: L.avg, hr: L.hr, ops: L.ops } }
}
const a0 = c => c.active?.usage ?? usageOf(c)
// the season's line from the director's games (his, the days he played)
function bbSeasonStats(c, f) { return seasonLine(c, f) }

// ── The postseason: the twelve-club bracket, series by series ────────────────
const ROUND_LEN = { 'Wild Card Series': 3, 'Division Series': 5, 'Championship Series': 7, 'World Series': 7 }
export const roundName = (name, lg) => (name === 'Division Series' ? `${lg}DS` : name === 'Championship Series' ? `${lg}CS` : name)
export const roundTitle = (name, lg) => (name === 'Division Series' ? `${LEAGUE_NAME[lg]} Division Series` : name === 'Championship Series' ? `${LEAGUE_NAME[lg]} Championship Series` : name)
function bbBracket(c, f) {
  const r = seeded(`${c.seed}-po-${c.year}`)
  const lg = leagueOf(c.team), other = lg === 'AL' ? 'NL' : 'AL'
  const seeds = f.seeds?.[lg] ?? [], mine = f.seed ?? 6
  const wins = short => (f.seeds?.[lg] ?? []).concat(f.seeds?.[other] ?? []).find(x => x.short === short)?.wins ?? 85
  const myW = f.wins ?? 90
  const st = c.simTeam ?? {}
  const star = Math.max(0, (c.ovr ?? 80) - 88) * 0.003
  // a game: the records (a 100-win club over an 88-win one about 56%), home field, a superstar's tilt
  const gameP = (opp, home) => clamp(0.5 + (myW - wins(opp)) / 162 * 0.9 + (home ? 0.012 : -0.012) + star + ((st.off ?? 5.5) + (st.def ?? 5.5) - 11) * 0.004, 0.34, 0.68)
  const at = n => seeds.find(x => x.seed === n)
  const pickOf = list => { const ok = list.filter(Boolean); if (!ok.length) return null; const w = ok.map(x => Math.exp((x.wins - 88) / 9)), t = w.reduce((a, b) => a + b, 0); let u = r() * t; for (let i = 0; i < ok.length; i++) { u -= w[i]; if (u <= 0) return ok[i] } return ok[ok.length - 1] }
  const names = mine <= 2 ? ['Division Series', 'Championship Series', 'World Series'] : ['Wild Card Series', 'Division Series', 'Championship Series', 'World Series']
  // the other side of the bracket: 1 plays the 4-5 winner, 2 the 3-6 winner
  const top = mine === 1 || mine === 4 || mine === 5 ? 1 : 2
  const ds = top === 1 ? [at(4), at(5)].filter(x => x?.seed !== mine) : [at(3), at(6)].filter(x => x?.seed !== mine)
  const otherSide = top === 1 ? [at(2), pickOf([at(3), at(6)])] : [at(1), pickOf([at(4), at(5)])]
  const rounds = names.map(name => {
    let opp, home
    if (name === 'Wild Card Series') { opp = at(9 - mine); home = mine <= 4 }
    else if (name === 'Division Series') { opp = mine <= 2 ? pickOf(ds) : at(top); home = mine <= 2 }
    else if (name === 'Championship Series') { opp = pickOf(otherSide) ?? at(top === 1 ? 2 : 1); home = myW >= (opp?.wins ?? 0) }
    else { opp = pickOf((f.seeds?.[other] ?? []).slice(0, 4)); home = myW >= (opp?.wins ?? 0) }
    opp = opp ?? { short: MLB_TEAMS.find(t => t.short !== c.team)?.short, wins: 88 }
    const n = ROUND_LEN[name], g = gameP(opp.short, home)
    const p = clamp(Math.round(bestOf(n, g) * 100) / 100, 0.05, 0.95)
    const pw = clamp(Math.round(bestOf(n, clamp(g - 0.025, 0.3, 0.7)) * 100) / 100, 0.05, 0.95)
    return { name, short: roundName(name, name === 'World Series' ? '' : lg), title: roundTitle(name, lg), bestOf: n, opp: opp.short, oppName: mlbTeam(opp.short).name, oppWins: opp.wins, home, p, pw, g: r3(g), played: false, series: true, close: true }
  })
  return { idx: 0, rounds, line: [], used: [], stage: 'round', won: false, out: false, lg, seed: mine }
}
function bbFinishLeague(c, f) {
  if (!f.madePlayoffs) return bookSeason({ ...c, active: { ...c.active, final: f, po: null } })
  const po = bbBracket(c, f)
  if (c.active.out) return bookSeason({ ...c, active: { ...c.active, final: f, po: bbWatch(c, po) } })
  return { ...c, active: { ...c.active, final: f, po } }
}
// a series' score that fits who won it: a favourite takes it short, an even one goes the distance
function seriesScore(r, n, won, p) {
  const need = (n + 1) / 2, fav = won ? p : 1 - p
  const len = fav >= 0.75 ? [0, 0, 1] : fav >= 0.55 ? [0, 1, 1, 2] : [1, 2, 2]
  const other = Math.min(need - 1, len[Math.floor(r() * len.length)])
  return won ? [need, other] : [other, need]
}
// his line in a series, from his season's rates (the moment's own at-bat or inning on top)
function seriesLine(c, f, n, score, won, hit, r) {
  const k = clamp(0.8 + (score ?? 0.5) * 0.4 + (r() - 0.5) * 0.25, 0.55, 1.4)
  if (c.pos === 'pit') {
    const L = pitLine(f.games ?? [], usageNumbers(c, a0(c)).role), rel = (L.gs ?? 0) < (L.gp ?? 1) / 2
    const starts = rel ? 0 : Math.max(1, Math.round(n / 3.5)), apps = rel ? Math.max(1, Math.round(n * 0.6)) : starts
    const outs = rel ? apps * 3 : Math.round(starts * clamp(L.outs / Math.max(1, L.gs) * (0.85 + k * 0.15), 12, 27))
    const er = Math.max(0, Math.round((L.era || 4) / 27 * outs / k + (r() - 0.5)))
    const kk = Math.round((L.k9 || 8) / 27 * outs * k)
    return { app: apps, gs: starts, outs, er, k: kk, ha: Math.round(outs / 3 * 0.85 / k), bb: Math.round(outs / 3 * 0.3), w: !rel && won ? Math.min(starts, 1 + (r() < 0.3 ? 1 : 0)) : 0, l: !rel && !won ? 1 : 0, sv: rel && won && usageNumbers(c, a0(c)).role === 'CL' ? 1 + (hit ? 1 : 0) : 0, era: outs ? r2(er * 27 / outs) : 0 }
  }
  const L = batLine(f.games ?? [], c.build, fieldPos(c))
  const ab = Math.round(n * 3.9), hr0 = (L.hr || 0) / Math.max(1, L.ab)
  let h = Math.min(ab, Math.round(ab * (L.avg || 0.25) * k + (r() - 0.5) * 1.4)), hr = Math.min(h, Math.floor(ab * hr0 * k + r()))
  if (hit) { h = Math.max(h, 1); if (hr === 0 && hr0 > 0.03 && r() < 0.5) hr = 1 }
  const rbi = hr + Math.floor((h - hr) * 0.35 + r() * 1.5) + (hit ? 1 : 0)
  return { app: n, ab, h, hr, rbi, bb: Math.round(n * 0.35), k: Math.round(ab * 0.22 / k), avg: ab ? r3(h / ab) : 0 }
}
// The round's moment is in. A last-play moment (a walk-off at-bat, the last out of a save) decides one game of the
// series, the need-th; the games around it are played at the series' own game rate (lib/career.js seriesPlay), so
// the odds the card showed are the odds it was played at.
// The moment's game inside the series: the need-th game (the series score going in is seriesState's), and whether
// his club bats last in it. The higher seed hosts games 1-2 and 5 of a best of five (2-2-1), 1-2 and 6-7 of a best of
// seven (2-3-2), and all three of the Wild Card Series.
const HOSTS = { 3: [1, 2, 3], 5: [1, 2, 5], 7: [1, 2, 6, 7] }
function bbGameAt(c, po) {
  const rd = po.rounds[po.idx]
  const { a, b } = seriesState(c, po.idx, rd)
  const n = a + b + 1, hosts = HOSTS[rd.bestOf] ?? HOSTS[7]
  return { n, a, b, home: rd.home === false ? !hosts.includes(n) : hosts.includes(n) }
}
// (a walk-off needs the last at-bat: on the road that game deals another moment)
const bbAllowGame = (c, po) => (po?.rounds?.[po.idx] && !bbGameAt(c, po).home ? g => g !== 'walk-off' : null)
const OUTS_W = ['nobody out', 'one out', 'two out']
const ON_W = { '000': 'bases empty', '100': 'a runner on first', '010': 'a runner on second', '001': 'a runner on third', '110': 'runners on first and second', '101': 'runners on the corners', '011': 'runners on second and third', '111': 'bases loaded' }
// The moment's situation, set in its game: at the plate he bats in the bottom at home and the top on the road, on the
// mound the other way round, and a home side ahead after the top of the 9th never bats again (that spot moves to the 8th)
function bbMomentSit(c, po, game) {
  const rd = po?.rounds?.[po.idx]
  if (!rd || !game) return null
  const base = momentSituation(game, `${c.seed}-${c.year}-${po.idx}`, { us: c.team, them: rd.opp })
  if (!base?.baseball) return base
  const at = bbGameAt(c, po)
  const half = base.def ? (at.home ? 'T' : 'B') : (at.home ? 'B' : 'T')
  const homeAhead = at.home ? base.mine > base.opp : base.opp > base.mine
  const inning = half === 'B' && base.inning >= 9 && homeAhead ? 8 : base.inning
  const tail = game === 'walk-off' && half === 'T' ? 'Two strikes. The go-ahead run is on.' : base.tail
  const { us, them, mine, opp, outs, on, balls, strikes } = base
  const where = mine < opp ? `${us} down ${mine}-${opp} to ${them}` : mine > opp ? `${us} up ${mine}-${opp} on ${them}` : `${us} and ${them} tied at ${mine}`
  const count = balls || strikes ? `, ${balls}-${strikes} count` : ''
  const line = `Game ${at.n}. ${half === 'B' ? 'Bottom' : 'Top'} of the ${ordinal(inning)}, ${OUTS_W[outs]}, ${ON_W[on.map(Number).join('')]}${count}. ${where}.`
  return { ...base, inning, half, clock: inning, clockText: `${half === 'B' ? 'BOT' : 'TOP'} ${inning}`, period: ordinal(inning).toUpperCase(), line, tail, gameNo: at.n, home: at.home }
}
// seriesPlay's own draws (the same seed, the same order), and whether his club won the moment's game
function bbSeriesPlay(c, idx, rd, LAST, hit, h) {
  const { a, b, g, need } = seriesState(c, idx, rd), r = seeded(`${c.seed}-${c.year}-${idx}-series-rest`)
  let x = a, y = b
  const gw = !!(hit || (LAST === 'hit' && r() < clamp((g - h) / (1 - h), 0.03, 0.97)))
  if (gw) x++; else y++
  while (x < need && y < need) { if (r() < g) x++; else y++ }
  return { won: x === need, my: x, opp: y, gw }
}
// The round's moment is in. A last-play moment (a walk-off at-bat) decides one game of the series, the need-th; the
// games around it are played at the series' own game rate (lib/career.js seriesPlay), so the odds the card showed are
// the odds it was played at. raw: the moment's own result (lib/mg: raw.pts, the runs he drove in or let in;
// raw.final, the score right after the play). That game's final grows out of raw.final: a walk-off ends it there
// (a single in a tie reads 5-4), anything else is played out from that score (lib/situations.js finalScore).
function bbRound(c, score, game = null, hit = score >= 0.5, raw = null) {
  const a = c.active, po = a.po, f = a.final
  const rd = po.rounds[po.idx]
  const r = seeded(`${c.seed}-por-${c.year}-${po.idx}`)
  const auto = score == null
  const odds = roundOdds(c, rd, game, auto)
  let won = r() < (auto ? odds.all : hit ? odds.hit : odds.miss)
  const LAST = lastPlayOf(c, rd, game)
  const ser = !auto && LAST ? bbSeriesPlay(c, po.idx, rd, LAST, hit, momentHitRate(c, game)) : null
  if (ser) won = ser.won
  if (auto) score = won ? 0.8 : 0.25
  // the moment's game: its number, who bats last and its final
  let moment = null, mySc, oppSc
  const sit = !auto && game ? bbMomentSit(c, po, game) : null
  if (sit?.baseball) {
    const R = raw && typeof raw === 'object' ? raw : { pts: raw }
    const fin0 = R.final && Number.isFinite(R.final.mine) && Number.isFinite(R.final.opp) ? R.final : null
    const now = fin0 ? { ...sit, mine: fin0.mine, opp: fin0.opp } : sit
    // (a walk-off: the winning run is in and the game is over on the play)
    const walked = !sit.def && sit.half === 'B' && sit.inning >= 9 && now.mine > now.opp
    let gw
    if (ser) { gw = walked || ser.gw; [mySc, oppSc] = [ser.my, ser.opp] }
    else {
      // a moment that isn't the last play: the game still turns on it (about three in four when he comes through),
      // and the series around it agrees with the round (won: the odds above): the score going in, that game, the rest
      const st = seriesState(c, po.idx, rd), need = st.need, rr = seeded(`${c.seed}-${c.year}-${po.idx}-gw`)
      gw = walked || rr() < (hit ? 0.74 : 0.36)
      if (gw && !won && st.a + 1 >= need) gw = false
      if (!gw && won && st.b + 1 >= need) gw = true
      const x = st.a + (gw ? 1 : 0), y = st.b + (gw ? 0 : 1)
      // (that game can end it: then the loser's count stands)
      ;[mySc, oppSc] = won ? [need, x >= need ? y : y + Math.floor(rr() * (need - y))] : [y >= need ? x : x + Math.floor(rr() * (need - x)), need]
    }
    const end = walked && gw ? { mine: now.mine, opp: now.opp, note: null } : finalScore(now, game, gw, !!hit, `${c.seed}-${c.year}-${po.idx}`, fin0 ? 0 : R.pts ?? null)
    // (level after the moment and settled later: that's extra innings, not a lead held)
    const extras = now.mine === now.opp && (sit.inning >= 9 || now.inning >= 9) && !(walked && gw)
    const note = extras ? (end.mine > end.opp ? 'Won it in extra innings.' : 'Lost it in extra innings.') : end.note ?? null
    moment = { n: sit.gameNo, home: sit.home, my: end.mine, opp: end.opp, won: end.mine > end.opp, note, walkoff: walked && gw }
  } else [mySc, oppSc] = ser ? [ser.my, ser.opp] : seriesScore(r, rd.bestOf, won, rd.p)
  const line = seriesLine(c, f, mySc + oppSc, score, won, !auto && hit, r)
  const entry = { ...rd, played: true, won, mySc, oppSc, score, hit: !auto && !!hit, auto, game: auto ? null : game, decider: ser ? (ser.my + ser.opp >= 2 * ((rd.bestOf + 1) / 2) - 1) : null, moment, ...line }
  const rounds = po.rounds.map((x, i) => (i === po.idx ? entry : x))
  const fin = rd.name === 'World Series'
  const done = !won || fin
  return { ...c, active: { ...a, po: { ...po, rounds, line: [...po.line, entry], idx: done ? po.idx : po.idx + 1, stage: done ? 'done' : 'round', won: won && fin, out: !won } } }
}
// out for the season: the club plays October without him
function bbWatch(c, po) {
  const r = seeded(`${c.seed}-pow-${c.year}`)
  const line = []
  for (const rd of po.rounds) {
    const won = r() < rd.pw
    const [mySc, oppSc] = seriesScore(r, rd.bestOf, won, rd.pw)
    line.push({ ...rd, played: true, won, mySc, oppSc, sat: true })
    if (!won) break
  }
  const lastR = line[line.length - 1]
  const won = !!lastR?.won && lastR.name === 'World Series'
  return { ...po, rounds: po.rounds.map((x, i) => line[i] ?? x), line, idx: line.length - 1, stage: 'done', won, out: !won }
}

// ── Booking a season: his line, the awards ───────────────────────────────────
// Each award against the year's best rival, a seeded field (most years a typical winner's case, now and then a
// monster season), so a great player wins in his best years, not every year. The winners' usual cases, 2015-25
// (Baseball-Reference): an MVP about 8 WAR, a Cy Young about 6.5, a batting title about .320, a home run crown
// about 44, an RBI crown about 120, a strikeout crown about 240, the ERA title about 2.6.
const SS_BAR = { C: 112, '1B': 138, '2B': 122, '3B': 130, SS: 122, LF: 132, CF: 126, RF: 136, DH: 138 }
const ALLMLB_BAR = { C: 4.2, '1B': 4.9, '2B': 5.2, '3B': 5.6, SS: 6.0, LF: 5.4, CF: 5.6, RF: 5.6, DH: 4.4 }
function bbAwards(c, s, f, st) {
  const rr = tag => seeded(`${c.seed}-${tag}-${c.year}`)()
  const lu = tag => logit(rr(tag))
  const aw = {}
  const team = f.wins ?? s.wins
  const made = !!f.madePlayoffs
  const rookie = c.pos === 'pit' ? (c.mlbOuts ?? 0) < 150 : (c.mlbAB ?? 0) < 130
  if (c.pos === 'bat') {
    const fp = fieldPos(c), full = st.pa >= 502
    const mvpCase = st.war + (st.hr >= 45 ? 0.6 : 0) + (made ? 0.4 : 0) + (st.avg >= 0.33 && full ? 0.3 : 0) + ((c.rep ?? 5) - 5) * 0.05
    const mvpRival = 8.1 + 0.95 * lu('mvp')
    aw.mvp = full && mvpCase > mvpRival
    aw.mvpRank = aw.mvp ? 1 : full && mvpCase > 3 ? Math.min(25, 2 + Math.floor((mvpRival - mvpCase) / 0.7)) : null
    aw.ss = st.pa >= 420 && st.opsPlus > (SS_BAR[fp] ?? 130) + 11 * lu('ss')
    aw.gg = fp !== 'DH' && st.gp >= 110 && fieldRuns(c.build, fp) > 8.5 + 2.4 * lu('gg')
    aw.allMLB = full && st.war > (ALLMLB_BAR[fp] ?? 5.5) + 0.8 * lu('allmlb')
    aw.battingTitle = full && st.avg > 0.321 + 0.009 * lu('bat')
    aw.hrLeader = st.hr > 43 + 3.8 * lu('hr')
    aw.rbiLeader = st.rbi > 122 + 7 * lu('rbi')
    aw.tripleCrown = aw.battingTitle && aw.hrLeader && aw.rbiLeader
    if (aw.tripleCrown) aw.mvp = full
    aw.aaron = full && st.opsPlus > 172 + 12 * lu('aaron')
    aw.roy = rookie && st.pa >= 300 && st.war + (st.hr >= 30 ? 0.5 : 0) > 3.6 + 0.9 * lu('roy')
    aw.sbLeader = st.sb > 52 + 9 * lu('sb')
  } else {
    const rel = (st.gs ?? 0) < (st.gp ?? 1) / 2, role = usageNumbers(c, a0(c)).role
    const ip = st.outs / 3
    if (!rel) {
      const cyCase = st.war + clamp((3.1 - st.era) * 1.1, -2, 2) + (st.w >= 18 ? 0.4 : 0) + (st.k >= 250 ? 0.4 : 0)
      const cyRival = 6.7 + 0.9 * lu('cy')
      aw.cy = ip >= 150 && cyCase > cyRival
      aw.cyRank = aw.cy ? 1 : ip >= 120 && cyCase > 3 ? Math.min(10, 2 + Math.floor((cyRival - cyCase) / 0.8)) : null
      aw.allMLB = ip >= 150 && st.war > 5.5 + 0.7 * lu('allmlb')
      aw.kLeader = st.k > 240 + 16 * lu('k')
      aw.eraTitle = ip >= 162 && st.era < 2.62 - 0.33 * lu('era')
      aw.wLeader = st.w > 16.5 + 1.6 * lu('w')
      aw.tripleCrown = aw.kLeader && aw.eraTitle && aw.wLeader
      if (aw.tripleCrown) aw.cy = true
      // (a pitcher's MVP: a historic year, Shohei Ohtani's two-way seasons aside it's Clayton Kershaw 2014, Justin Verlander 2011)
      aw.mvp = aw.cy && st.war >= 9 && cyCase > 8.1 + 0.95 * lu('mvp') + 2.2
    } else {
      // a reliever's Cy Young (Eric Gagne 2003, Dennis Eckersley 1992 won it): only a historic season
      aw.cy = role === 'CL' && st.sv >= 45 && st.era < 1.5 && st.war + 3 > 6.7 + 0.9 * lu('cy') + 1
      aw.reliever = st.war * 2 + st.sv / 10 > 8.6 + 1.1 * lu('rel')
      aw.allMLB = st.war > 2.6 + 0.5 * lu('allmlb')
      aw.svLeader = st.sv > 41 + 3.5 * lu('sv')
    }
    aw.roy = rookie && ip >= 60 && st.war > 3.3 + 0.9 * lu('roy')
    // (a pitcher's Gold Glove, Greg Maddux won 18: his fielding off the mound, pitch IQ and the ground ball)
    aw.gg = !rel && ip >= 150 && ((c.build?.pitchIQ?.val ?? 5) + (c.build?.groundball?.val ?? 5)) / 2 - 5.5 > 3.2 + 1.1 * lu('gg')
  }
  return aw
}
// the season booked again by the sim (utils/baseballSimulation.js rebookBaseball) from the games as played: his WAR
// and every award, against the league's real players' simulated seasons. null: Career's own field decides them
function simBook(c, f) {
  if (typeof SIM.rebookBaseball !== 'function' || !f.simRef?.book) return null
  const toSim = c.pos === 'pit'
    ? g => ({ won: g.won, mySc: g.mySc, oppSc: g.oppSc, sat: !!g.sat || !g.app, app: g.app ? 1 : 0, gs: g.gs ?? 0, outs: g.outs ?? 0, bf: 0, pitches: 0, h: g.ha ?? 0, r: g.er ?? 0, er: g.er ?? 0, bb: g.bb ?? 0, k: g.k ?? 0, hr: g.hra ?? 0, hbp: g.hbp ?? 0, w: g.w ?? 0, l: g.l ?? 0, sv: g.sv ?? 0, hld: g.hld ?? 0, bs: g.bs ?? 0, svo: 0, qs: g.gs && (g.outs ?? 0) >= 18 && (g.er ?? 0) <= 3 ? 1 : 0, cg: g.cg ?? 0, sho: g.sho ?? 0, nh: g.nh ?? 0 })
    : g => ({ won: g.won, mySc: g.mySc, oppSc: g.oppSc, sat: !!g.sat || !g.app, gp: g.app ? 1 : 0, gs: g.gs ?? 0, pa: g.pa ?? 0, ab: g.ab ?? 0, h: g.h ?? 0, doubles: g.d ?? 0, triples: g.t ?? 0, hr: g.hr ?? 0, rbi: g.rbi ?? 0, r: g.r ?? 0, bb: g.bb ?? 0, k: g.k ?? 0, hbp: g.hbp ?? 0, sf: g.sf ?? 0, sb: g.sb ?? 0, cs: g.cs ?? 0, gidp: 0, cycle: !!g.cycle, slam: g.slam ?? 0, wo: g.wo ?? 0 })
  try {
    const ref = f.simRef
    // (its own copy of the book: the award field it builds stays out of the saved season)
    const res = SIM.rebookBaseball({ ...ref, book: { ...ref.book, field: null }, wins: f.wins, losses: f.losses, standings: [], playoffRounds: [], awards: { wsMvp: {}, lcsMvp: {} } }, (f.games ?? []).map(toSim))
    return res?.awards ? res : null
  } catch { return null }
}
const won = x => !!(x === true || x?.won)
function simAwards(a) {
  return {
    // (a ballot lists about 25 names for MVP and about 10 for the Cy Young: past that he got no votes)
    mvp: won(a.mvp), mvpRank: a.mvp?.rank <= 25 ? a.mvp.rank : null, mvpWinner: a.mvp?.won ? null : a.mvp?.winner?.name ?? null,
    cy: won(a.cyYoung), cyRank: a.cyYoung?.rank <= 10 ? a.cyYoung.rank : null, cyWinner: a.cyYoung?.won ? null : a.cyYoung?.winner?.name ?? null,
    roy: won(a.roy), ss: won(a.silverSlugger), gg: won(a.goldGlove), allMLB: won(a.allMLB), aaron: won(a.hankAaron), reliever: won(a.reliever),
    battingTitle: won(a.battingTitle), hrLeader: won(a.hrLeader), rbiLeader: won(a.rbiLeader), sbLeader: won(a.sbLeader), kLeader: won(a.kLeader), wLeader: won(a.winsLeader), eraTitle: won(a.eraTitle), svLeader: won(a.svLeader), tripleCrown: won(a.tripleCrown),
  }
}
function bbSeason(c, f, po) {
  const S = SPORT.baseball
  const st0 = bbSeasonStats(c, f)
  const sim = simBook(c, f)
  // (his WAR the way the sim's season page has it: the glove, the bases and the position in; his OPS+, his FIP)
  const st = sim ? { ...st0, war: r10(sim.war ?? st0.war), ...(c.pos === 'pit' ? { fip: sim.fip != null ? r2(sim.fip) : st0.fip, ...(sim.eraPlus != null ? { eraPlus: Math.round(sim.eraPlus) } : {}) } : { opsPlus: sim.opsPlus != null ? Math.round(sim.opsPlus) : st0.opsPlus }) } : st0
  const aw = sim ? simAwards(sim.awards) : bbAwards(c, null, f, st)
  // (the voters tire of the same name: after an MVP or a Cy Young the next one takes a clearer case, and a third
  // straight is rare: Barry Bonds's four in a row, 2001-04, is the only run past three)
  const prev = c.seasons.slice(-2), streak = k => (prev[1]?.[k] ? (prev[0]?.[k] ? 2 : 1) : 0)
  for (const k of ['mvp', 'cy']) if (aw[k] && streak(k) && rr(c, `fatigue-${k}`) < (streak(k) >= 2 ? 0.55 : 0.3)) { aw[k] = false; aw[`${k}Rank`] = 2 }
  const line = po?.line ?? []
  const played = line.filter(x => !x.sat)
  const ws = line.find(x => x.name === 'World Series')
  const lg = leagueOf(c.team)
  const asg = c.active?.asg ?? null
  const u = a0(c)
  const games = f.games ?? []
  const onRoster = games.length - (c.active?.out0 ?? 0)
  const s = {
    year: c.year + 1, season: c.season, age: c.age, team: c.team, teamName: c.fit.name, ovr: c.ovr, role: c.role, lg,
    usage: u.label, spot: u.spot ?? null, fp: c.pos === 'bat' ? fieldPos(c) : pitRole(c) === 'SP' ? 'SP' : usageNumbers(c, u).role,
    wins: f.wins, losses: f.losses, seed: f.seed ?? null, divWin: !!f.divWin, gb: f.gb ?? null, div: f.div ?? null, divName: mlbTeam(c.team).div,
    playoffs: !!f.madePlayoffs, champion: !!po?.won, pennant: !!ws,
    rounds: line.map(x => ({ round: roundName(x.name, x.name === 'World Series' ? '' : lg), name: x.name, opponent: x.oppName, opp: x.opp, won: x.won, mySc: x.mySc, oppSc: x.oppSc, series: true, bestOf: x.bestOf, sat: !!x.sat, ...(x.moment ? { moment: x.moment } : {}) })),
    sb: ws ? { won: ws.won, mySc: ws.mySc, oppSc: ws.oppSc, series: true } : null,
    stats: st, adv: seasonRaw(c.pos, f, games.filter(g => !g.sat && g.app)),
    award: !!(aw.mvp || aw.cy), awardName: aw.mvp && aw.cy ? 'MVP + CY YOUNG' : aw.mvp ? 'MVP' : aw.cy ? 'CY YOUNG' : S.awardName[c.pos], ...aw,
    proBowl: !!asg?.picked, allStar: !!asg?.picked, asgStart: !!asg?.start, asgMvp: !!asg?.mvp, derby: asg?.derby ?? null, allPro: !!aw.allMLB,
    missed: (f.story?.sat ?? 0) - (c.active?.out0 ?? 0) > 0 ? (f.story?.sat ?? 0) - (c.active?.out0 ?? 0) : 0, benched: u.starter ? 0 : games.length,
    minors: c.minors && !c.minors.done ? { level: c.minors.level, games: c.active?.out0 ?? c.minors.games, line: c.minors.line } : null,
    rehab: c.rehab?.games ? { games: Math.min(games.length, c.rehab.games), what: c.rehab.what } : null,
    records: (f.story?.records ?? []).map(x => x.label ?? x.id), milestones: [...(f.story?.milestones ?? []).filter(m => m.big).map(m => m.label), ...(c.active?.ms ?? [])],
    xp: f.story?.xp ?? 0, bestGame: f.bestGame ?? null,
    poStats: played.length ? playedLine(c, played) : null,
    service: r3(clamp(onRoster / (games.length * 0.925 || 1), 0, 1)),
  }
  s.goals = c.goals.map(g => ({ ...g, met: goalMet(g, { stats: st, wins: f.wins, starts: st.gs ?? 0, startWins: 0 }) }))
  // the World Series MVP: the champions' best in the Series, most often the one who won the deciding moment
  s.fmvp = !!po?.won && !!ws && !ws.sat && rr(c, 'wsmvp') < (ws.hit && (ws.score ?? 0) >= 0.7 ? 0.55 : seasonScore(c.pos, s) >= 0.7 ? 0.3 : 0.08)
  // the records only a whole season can show (lower is better: ERA; a rate needs the qualifier)
  const recs = RECORDS.baseball?.[c.pos] ?? []
  for (const x of recs) if (x.booked && x.better(st) && x.qualifies(st)) s.records = [...s.records, x.label]
  return s
}
const rr = (c, tag) => seeded(`${c.seed}-${tag}-${c.year}`)()
function playedLine(c, list) {
  const keys = c.pos === 'pit' ? ['app', 'gs', 'outs', 'er', 'k', 'w', 'sv'] : ['app', 'ab', 'h', 'hr', 'rbi', 'bb']
  const o = Object.fromEntries(keys.map(k => [k, list.reduce((s, x) => s + (x[k] ?? 0), 0)]))
  return { ...o, games: list.length, ...(c.pos === 'pit' ? { era: o.outs ? r2(o.er * 27 / o.outs) : 0 } : { avg: o.ab ? r3(o.h / o.ab) : 0 }) }
}
// after the season: service time, the salary for next year, Tommy John, the minors and a rehab behind him
const PRE_ARB = [0.78, 0.8, 0.86]
export const arbYear = service => (service >= 3 && service < 6 ? Math.floor(service) - 2 : 0)
// what the market would pay him a year: wins above replacement, about $9.5M a win in 2025-26 free agency
// (FanGraphs' dollars-per-WAR), from the last three seasons (5/4/3) and the age curve
export function projWar(c) {
  const Ss = c.seasons.slice(-3)
  if (!Ss.length) return c.pos === 'pit' ? (c.ovr - 70) * 0.15 : (c.ovr - 70) * 0.18
  const w = [3, 4, 5].slice(-Ss.length)
  const war = Ss.reduce((s, x, i) => s + (x.stats?.war ?? 0) * (162 / Math.max(60, (x.stats?.gp ?? 0) * (c.pos === 'pit' ? ((x.stats?.gs ?? 0) >= 10 ? 5 : 2.4) : 1) || 162)) * w[i], 0) / w.reduce((a, b) => a + b, 0)
  const age = c.age ?? 28
  return war * (age <= 27 ? 1.04 : age <= 30 ? 1 : age <= 32 ? 0.93 : age <= 34 ? 0.82 : 0.7)
}
export const marketAAV = c => { const [lo, hi] = BASEBALL.moneyOf(c); return r10(clamp(projWar(c) * 9.5 * ((c.rep ?? 5) >= 8 ? 1.06 : 1), lo, hi)) }
const salaryFor = (c, service) => {
  const ay = arbYear(service)
  if (!ay) return PRE_ARB[Math.min(2, Math.floor(service))] ?? 0.86
  // arbitration: about 25%, 40% and 60% of what the market would pay (raises only), Juan Soto's last year $31M
  return r10(Math.max(c.contract?.perYear ?? 0.78, Math.max(1, marketAAV(c) * [0.25, 0.42, 0.6][ay - 1])))
}
function bbAfterSeason(n, s) {
  let next = { ...n, service: r3((n.service ?? 0) + (s.service ?? 1)), mlbAB: (n.mlbAB ?? 0) + (s.stats.ab ?? 0), mlbOuts: (n.mlbOuts ?? 0) + (s.stats.outs ?? 0) }
  if (next.minors && !next.minors.done) next = { ...next, minors: { ...next.minors, done: true } }
  // (the months in the minors or on the 60-day IL rehabbing were at the minor-league rate, about $40K)
  const share = clamp(1 - Math.max(s.minors?.games ?? 0, s.rehab?.games ?? 0) / 162, 0, 1)
  next = { ...next, earnings: r10((next.earnings ?? 0) - (n.contract?.perYear ?? 0) * (1 - share)) }
  if (next.rehab) next = { ...next, rehab: null }
  // his role, for next year's depth chart
  const st = s.stats
  next = { ...next, lastRole: n.pos === 'pit' ? ((st.gs ?? 0) >= 15 || (st.sv ?? 0) >= 15 ? 'Starter' : 'Backup') : (st.gp ?? 0) >= 100 ? 'Starter' : 'Backup' }
  // club control: six years of service, the first three at about the minimum, then arbitration
  if (next.contract?.kind === 'control') {
    const left = Math.max(0, Math.ceil(6 - next.service - 1e-6))
    next = { ...next, contract: { ...next.contract, left, years: Math.max(next.contract.years, left), perYear: left > 0 ? salaryFor(next, next.service) : next.contract.perYear, arb: arbYear(next.service) } }
  }
  // Tommy John: torn this season (the rest of this year and most of next), or in the spring
  const r = seeded(`${n.seed}-tj-${n.year}`)
  const torn = (n.injuries ?? []).find(i => i.year === s.year && i.kind === TJ)
  if (torn) next = { ...next, rehab: { games: clamp(Math.round((8 - (162 - torn.at) / 27) * 27), 0, 162), what: 'Tommy John surgery' } }
  else if (n.pos === 'pit') {
    const v = n.build?.velocity?.val ?? 5
    const risk = 0.03 * (1 + clamp(5.5 - (n.durability ?? 5), -4.5, 4.5) * 0.16) * (n.age >= 30 ? 1.3 : 1) * ((st.outs ?? 0) >= 570 ? 1.2 : 1) * (v >= 10 ? 1.3 : v >= 8 ? 1.1 : 1)
    if (r() < risk) {
      const games = 125 + Math.floor(r() * 37)
      next = { ...next, rehab: { games, what: 'Tommy John surgery' }, durability: r10(Math.max(1, (next.durability ?? 5) - 0.6)), injuries: [...(next.injuries ?? []), { year: s.year + 1, at: 0, kind: TJ, games, played: false, serious: true }],
        events: [...next.events, { year: s.year, text: `Spring training: ${n.name} feels a pop in his elbow. An MRI shows a torn UCL. Tommy John surgery, and a year of rehab: he could be back late in the season.` }] }
      if (r() < 0.4 && next.build?.velocity) next = { ...next, build: { ...next.build, velocity: { ...next.build.velocity, val: Math.max(1, Math.round(next.build.velocity.val) - 1), faded: (next.build.velocity.faded ?? 0) + 1 } } }
    }
  }
  return next
}

// ── The offseason: an extension in club control, free agency after six years ──
function standAt(c, short) {
  const ro = short === c.team && c.roster ? c.roster : rosterOf(c, short)
  const cc = { ...c, team: short, roster: ro, contract: {}, lastRole: short === c.team ? c.lastRole : null }
  const dc = depthChart(cc, ro), u = usageOf(cc)
  return { starter: dc.starter, behind: dc.ahead[dc.ahead.length - 1]?.name ?? null, label: u.label, role: u.label }
}
const fitAt = (c, short) => teamFit(short, c.pos, { roster: short === c.team ? c.roster : null, league: c.league, name: c.name, sport: 'baseball', yrs: rosterYrs(c), gone: outOf(c, short) })
// in club control: after a good year the club may offer to buy out the arbitration years and some free agency
function bbWindow(c) {
  if (c.contract?.kind !== 'control' || c.contract.left <= 0) return null
  const r = seeded(`${c.seed}-ext-${c.year}`)
  const last = c.seasons[c.seasons.length - 1]
  const perf = last ? seasonScore(c.pos, last) : 0
  if (perf < 0.45 || r() > (perf >= 0.8 ? 0.85 : 0.5)) return null
  const left = c.contract.left, aav = marketAAV(c)
  const fa = c.age <= 26 ? 3 + Math.floor(r() * 3) : c.age <= 29 ? 2 + Math.floor(r() * 2) : 1
  const years = clamp(left + fa, 3, 12)
  // (a team-friendly price: the arbitration years cost less than the free-agent ones, and he gets security now)
  const perYear = r10(clamp((aav * 0.45 * left + aav * 0.85 * fa) / years, 1, BASEBALL.moneyOf(c)[1]))
  return [{ kind: 'ext', team: c.team, fit: fitAt(c, c.team), stand: standAt(c, c.team), years, perYear, pitch: `Buy out ${left === 1 ? 'his last year' : `his ${left} years`} of club control and ${fa} of free agency. Security now; less than the open market would pay.` }]
}
// free agency: the clubs that call, the years by his age, the money by his WAR
function bbMarket(c, fresh, comeback) {
  const r = seeded(`${c.seed}-fa-${c.year}${fresh ? '-back' : ''}`)
  const pw = projWar(c), aav = marketAAV(c)
  // (a replacement-level player gets no big-league offer: past 30 a club wants about a win a year)
  if (!fresh && pw < (c.age >= 30 ? 0.8 : 0.3)) return []
  const cap = y => (fresh ? 1 : comeback != null ? Math.min(y, comeback) : y)
  // (the years by age and level: Juan Soto got 15 at 26, Aaron Judge 9 at 30, Freddie Freeman 6 at 32; a solid
  // regular 4-6 in his late twenties, two or three past 31; an average one a short deal)
  const age = c.age ?? 30, f = () => r()
  const yrs0 = pw >= 5.5 ? (age <= 26 ? 12 + Math.floor(f() * 4) : age <= 28 ? 10 + Math.floor(f() * 3) : age <= 30 ? 8 + Math.floor(f() * 2) : age <= 32 ? 5 + Math.floor(f() * 2) : age <= 34 ? 2 + Math.floor(f() * 2) : 1)
    : pw >= 3 ? (age <= 28 ? 6 + Math.floor(f() * 3) : age <= 30 ? 4 + Math.floor(f() * 3) : age <= 32 ? 3 + Math.floor(f() * 2) : age <= 34 ? 1 + Math.floor(f() * 2) : 1)
    : pw >= 1.5 ? (age <= 30 ? 3 + Math.floor(f() * 2) : age <= 33 ? 2 : 1) : 1 + (age <= 30 && f() < 0.5 ? 1 : 0)
  const years = clamp(yrs0, 1, 15)
  const myStr = clubStr(c, c.team)
  const others = MLB_TEAMS.filter(t => t.short !== c.team).map(t => ({ t: t.short, s: clubStr(c, t.short), k: r() }))
  const contender = [...others].filter(x => x.s >= 6.4).sort((a, b) => a.k - b.k)[0] ?? others[0]
  const payer = [...others].filter(x => x.t !== contender.t).sort((a, b) => a.k - b.k)[0] ?? others[1]
  const longer = [...others].filter(x => x.t !== contender.t && x.t !== payer.t && x.s < 5.8).sort((a, b) => a.k - b.k)[0] ?? others[2]
  const [lo, hi] = BASEBALL.moneyOf(c)
  const mk = (short, perYear, y, pitch, kind) => ({ team: short, fit: fitAt(c, short), stand: standAt(c, short), perYear: r10(clamp(perYear, lo, hi)), years: y, pitch, kind })
  const offers = [
    mk(c.team, aav * (0.93 + r() * 0.08), cap(Math.max(1, years - 1)), fresh ? 'Back where he left off. One more year here.' : 'Stay home. The club wants to keep him in the clubhouse.', 'stay'),
    mk(contender.t, aav * (0.85 + r() * 0.08), cap(Math.max(1, years - 1)), fresh ? 'A year with a contender. One more shot at a ring.' : 'A winner, ready now. Less money, a real shot at October.', 'contender'),
    mk(payer.t, aav * (1.05 + r() * 0.12), cap(years), fresh ? 'Top dollar for the comeback.' : 'The biggest offer on the table. The front office wants the face of the franchise.', 'payer'),
    ...(years >= 4 && !fresh ? [mk(longer.t, aav * (0.95 + r() * 0.06), cap(years + 2), 'The most years on the table: a rebuild wants him for the long haul.', 'years')] : []),
  ]
  void myStr
  return offers
}
function bbSign(c, o) {
  const change = o.team !== c.team
  const roster = change ? rosterOf(c, o.team) : c.roster
  const club = mlbTeam(o.team)
  const extras = [o.noTrade ? 'a full no-trade clause' : null, o.starter ? (c.pos === 'pit' ? 'a rotation spot guaranteed' : 'an everyday role in writing') : null].filter(Boolean)
  const total = r10(o.perYear * o.years)
  const how = o.kind === 'ext' ? `Signed an extension with the ${club.name}` : change ? `Signed with the ${club.name}` : `Re-signed with the ${club.name}`
  return {
    ...c, team: o.team, roster, ...(change ? { kept: keepRoster(c) } : {}), fit: teamFit(o.team, c.pos, { roster, league: c.league, name: c.name, sport: 'baseball' }), offers: null, talks: null, tradeAsked: false, lastRole: change ? null : c.lastRole, ...(change && c.off ? { off: { ...c.off, moves: [] } } : {}),
    contract: { kind: o.kind === 'ext' ? 'ext' : 'fa', years: o.years, left: o.years, perYear: o.perYear, noTrade: !!o.noTrade, starter: !!o.starter },
    decisions: [...c.decisions, { year: c.year + 1, text: `${how}: ${o.years} ${o.years === 1 ? 'year' : 'years'}, ${money(total)} (${money(o.perYear)} AAV)${extras.length ? `, with ${extras.join(' and ')}` : ''}` }],
  }
}
// turn the extension down: year to year through arbitration
export function bbStayPut(c) {
  const text = c.offers?.some(o => o.kind === 'ext') ? `Turned down an extension from the ${c.fit.name}. Going year to year${arbYear(c.service ?? 0) ? ' through arbitration' : ''}.` : `Staying with the ${c.fit.name}.`
  return { ...c, offers: null, talks: null, decisions: [...c.decisions, { year: c.year + 1, text }] }
}
// a trade request: the front office can say no; yes, he's dealt to a club in the better half where he'd play
function bbTradeRequest(c) {
  const r = seeded(`${c.seed}-trade-${c.year}`)
  const granted = !!c.contract.noTrade || r() < 0.6
  const rep = Math.max(1, c.rep - 2)
  const from = mlbTeam(c.team)
  if (!granted) return { ...c, rep, tradeAsked: true, nextMods: { ...(c.nextMods ?? {}), off: ((c.nextMods?.off) ?? 0) - 0.5 }, events: [...c.events, { year: c.year + 1, text: `${c.name} asked the ${from.nick} for a trade. The front office said no, and the clubhouse heard about it.` }] }
  const pool = MLB_TEAMS.filter(t => t.short !== c.team).map(t => t.short).sort((a, b) => clubStr(c, b) - clubStr(c, a)).slice(0, 15)
  const plays = pool.filter(t => standAt(c, t).starter)
  const dest = (plays.length ? plays : pool)[Math.floor(r() * (plays.length || pool.length))]
  const roster = rosterOf(c, dest)
  const fit = teamFit(dest, c.pos, { roster, league: c.league, name: c.name, sport: 'baseball' })
  return { ...c, rep, tradeAsked: true, team: dest, roster, kept: keepRoster(c), fit, lastRole: null, contract: { ...c.contract, starter: false }, off: { ...(c.off ?? {}), moves: [] },
    events: [...c.events, { year: c.year + 1, text: `Trade request granted: the ${from.nick} deal ${c.name} to the ${fit.name} for two prospects.` }],
    decisions: [...c.decisions, { year: c.year + 1, text: `Asked for a trade, dealt to the ${fit.name}` }] }
}
function bbNews(league, was, now) {
  return MLB_TEAMS.map(t => ({ t, d: now(t.short) - was(t.short) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3)
    .map(({ t, d }) => `The ${nickOfTeam(t)} ${d > 0 ? (d > 2 ? 'win the winter: a big free-agent bat and an ace' : 'add pieces in free agency') : (d < -2 ? 'sell off at the winter meetings. A rebuild is coming' : 'lose a couple of key arms in free agency')}.`)
}
// (the end: 36-40 for a position player, a starter to 42; the body and the level buy the years)
function bbRetireAge(c) {
  const d = c.durability ?? 5, o = c.ovr ?? 0
  const lift = (d >= 6 ? 1 : 0) + (d >= 8 ? 1 : 0) + (o >= 88 ? 2 : o >= 82 ? 1 : 0)
  return c.pos === 'pit' ? Math.min(pitRole(c) === 'SP' ? 42 : 41, (pitRole(c) === 'SP' ? 37 : 36) + lift) : 36 + lift
}
// Father Time, baseball's way: the bat slows in the mid-thirties (contact and power go after the legs and the arm),
// and a pitcher's stuff goes with his fastball (the breaking ball and the movement), while command and the head stay.
// About two grades a year off the swing from 36 on: the real greats were part-timers or retired by 38-40.
const AGES = { bat: ['contact', 'power', 'gap', 'avoidK'], pit: ['movement', 'breaking', 'changeup'] }
function bbAge(c, age, move, r) {
  if (age < 33) return
  const list = AGES[c.pos] ?? []
  const pick = () => list[Math.floor(r() * list.length)]
  const p1 = age >= 37 ? 0.9 : age >= 35 ? 0.7 : 0.45
  if (r() < p1) move(pick(), -1, c.pos === 'pit' ? 'Father Time' : 'Father Time (bat speed)')
  if (age >= 35 && r() < (age >= 37 ? 0.6 : 0.35)) move(pick(), -1, 'Father Time')
}
// the goals off the everyday lineup: a bench bat's or a middle reliever's numbers
function bbGoals(c, raw, full, dc) {
  const m = c.pos === 'pit' ? 0.6 : 0.4
  return raw.map(([k, verb, n, unit, low]) => (low || k === 'war' || k === 'era' ? full.find(g => g.k === k) : { k, label: `${verb} ${Math.max(1, Math.round(n * m))} ${unit}`, n: Math.max(1, Math.round(n * m)) }))
}

// ── Legacy ───────────────────────────────────────────────────────────────────
// The resume: seasons, All-Star teams (past 8 they count half), MVPs and Cy Youngs (the most of all, and every
// one after the first counts more), Rookie of the Year, Silver Sluggers, Gold Gloves, All-MLB First Teams, World
// Series rings and the WS MVP, batting titles, Triple Crowns, the records he holds, and the career's WAR, hits, home
// runs, wins, strikeouts and saves. The greats (data/legacy-resumes-baseball.js) are scored the same way.
export const BASEBALL_LW = { seasons: 2, allStars: 4, mvps: 22, cys: 22, roy: 4, ss: 3, gg: 2, allMLB: 3, rings: 12, wsMvp: 5, battingTitles: 3, tripleCrowns: 12, records: 6 }
export const BASEBALL_REPEAT = 8, BASEBALL_WAR = 1
function bbLegacy(r) {
  const k = { ...r, allStars: countedHonors(r.allStars ?? 0), roy: r.roy ? 1 : 0 }
  const st = r.stats ?? {}
  return Math.round(Object.entries(BASEBALL_LW).reduce((s, [key, w]) => s + (k[key] ?? 0) * w, 0) + Math.max(0, (r.mvps ?? 0) - 1) * BASEBALL_REPEAT + Math.max(0, (r.cys ?? 0) - 1) * BASEBALL_REPEAT
    + (st.war ?? 0) * BASEBALL_WAR + (st.h ?? 0) / 300 + (st.hr ?? 0) / 40 + (st.w ?? 0) / 25 + (st.k ?? 0) / 400 + (st.sv ?? 0) / 40 + (r.bonus ?? 0))
}
const RATE = { avg: 1, obp: 1, slg: 1, ops: 1, era: 1, whip: 1, fip: 1 }
function bbTotals(c) {
  const Ss = c.seasons, n = k => Ss.filter(s => s[k]).length
  const sumK = k => Ss.reduce((a, s) => a + (s.stats?.[k] ?? 0), 0)
  const stats = {}
  for (const s of Ss) for (const [k, v] of Object.entries(s.stats ?? {})) if (typeof v === 'number' && !RATE[k] && !['opsPlus', 'k9', 'bb9', 'ip'].includes(k)) stats[k] = (stats[k] ?? 0) + v
  if (c.pos === 'pit') {
    const outs = sumK('outs')
    Object.assign(stats, { era: outs ? r2(sumK('er') * 27 / outs) : 0, whip: outs ? r2((sumK('ha') + sumK('bb')) * 3 / outs) : 0, fip: outs ? r2((13 * sumK('hra') + 3 * (sumK('bb') + sumK('hbp')) - 2 * sumK('k')) / (outs / 3) + LG.fipC) : 0, ip: r10(outs / 3), k9: outs ? r10(sumK('k') * 27 / outs) : 0 })
  } else {
    const ab = sumK('ab'), h = sumK('h'), bb = sumK('bb'), hbp = sumK('hbp'), sf = sumK('sf'), tb = sumK('tb'), pa = sumK('pa')
    const obp = ab + bb + hbp + sf ? (h + bb + hbp) / (ab + bb + hbp + sf) : 0, slg = ab ? tb / ab : 0
    Object.assign(stats, { avg: ab ? r3(h / ab) : 0, obp: r3(obp), slg: r3(slg), ops: r3(obp + slg), opsPlus: pa ? Math.round(Ss.reduce((a, s) => a + (s.stats?.opsPlus ?? 0) * (s.stats?.pa ?? 0), 0) / pa) : 0 })
  }
  stats.war = r10(stats.war ?? 0)
  return {
    stats, games: sumK('gp'),
    allStars: n('allStar'), mvps: n('mvp'), cys: n('cy'), roys: n('roy'), ss: n('ss'), gg: n('gg'), allMLB: n('allMLB'), wsMvp: n('fmvp'), pennants: n('pennant'), battingTitles: n('battingTitle'), hrTitles: n('hrLeader'), kTitles: n('kLeader'), eraTitles: n('eraTitle'),
    tripleCrowns: n('tripleCrown'), aaron: n('aaron'), relievers: n('reliever'), derbies: Ss.filter(s => s.derby?.won).length, asgMvp: n('asgMvp'), playoffs: n('playoffs'), divTitles: n('divWin'),
    awards: Ss.filter(s => s.mvp || s.cy).length,
  }
}
function bbResume(c, t) {
  return { seasons: t.seasons, allStars: t.allStars, mvps: t.mvps, cys: t.cys, roy: t.roys > 0, ss: t.ss, gg: t.gg, allMLB: t.allMLB, rings: t.rings, wsMvp: t.wsMvp, battingTitles: t.battingTitles, tripleCrowns: t.tripleCrowns, records: t.records,
    stats: { war: t.stats.war ?? 0, h: t.stats.h ?? 0, hr: t.stats.hr ?? 0, w: t.stats.w ?? 0, k: c.pos === 'pit' ? t.stats.k ?? 0 : 0, sv: t.stats.sv ?? 0 }, bonus: (c.legacyBonus ?? 0) + earnLegacy(c) }
}
// The Hall of Fame: the BBWAA's vote, 75% to get in. Five years after he retires he's on the ballot; ten years at
// most, and under 5% he falls off. First-ballot for the inner circle; a borderline case climbs year by year.
function bbHof(c, L) {
  const r = seeded(`${c.seed}-hof`)
  // (the writers read the WAR too: a starter under about 60, a hitter under about 55, has a hard case whatever
  // the hardware says. A closer's bar is his own: saves carry him, as they did Rivera and Hoffman)
  const t = bbTotals(c).stats, war = t.war ?? 0
  const closer = c.pos === 'pit' && (t.sv ?? 0) >= 250
  const short = Math.max(0, (closer ? 35 : c.pos === 'pit' ? 60 : 55) - war) * 2
  let pct = clamp(10 + (L.score - 135) * 0.65 + (r() - 0.5) * 9 - short, 0.5, 99.7)
  const first = r10(pct)
  if (pct >= 75) return { in: true, pct: first, ballot: pct >= 90 ? 'First ballot' : 'First ballot', year: 1, place: 'Cooperstown' }
  if (pct < 5) return { in: false, pct: first, ballot: L.score >= 120 ? 'One year on the ballot' : 'Not on the ballot', year: 1 }
  // (a strong case climbs about five points a year; a middling one barely moves: most who start under 30% never get there)
  for (let y = 2; y <= 10; y++) {
    pct = clamp(pct + (pct >= 50 ? 3.5 : pct >= 35 ? 2 : 0.6) + r() * 3 - 0.6, 0, 99)
    if (pct < 5) return { in: false, pct: r10(pct), first, ballot: `Off the ballot after ${y} years`, year: y }
    if (pct >= 75) return { in: true, pct: r10(pct), first, ballot: `Elected in his ${ordinal(y)} year on the ballot`, year: y, place: 'Cooperstown' }
  }
  return { in: false, pct: r10(pct), first, ballot: 'Ten years on the ballot, short of 75%', year: 10 }
}

// ═════════════════════════════════════════════════════════════════════════════
// The offseason at the club (t: the club's nickname)
// ═════════════════════════════════════════════════════════════════════════════
const EVENTS_BASEBALL = [
  { id: 'new-manager', w: 3, text: t => `The ${t} hire a new manager. New coaches, a new way of doing things in spring training.`, apply: () => ({ nextMods: { off: -0.25, def: -0.25 } }) },
  { id: 'manager-fired', w: 2, when: c => (c.seasons[c.seasons.length - 1]?.wins ?? 81) <= 72, text: t => `The ${t} fire the manager after a losing year. The front office wants a fresh voice.`, apply: () => ({ nextMods: { off: -0.5, def: -0.5 } }) },
  { id: 'big-bat', w: 2, text: t => `The ${t} sign a big free-agent bat. The middle of the order just got deeper.`, apply: () => ({ nextMods: { off: 1 } }) },
  { id: 'ace', w: 2, text: t => `The ${t} trade for a front-line starter at the winter meetings.`, apply: () => ({ nextMods: { def: 1 } }) },
  { id: 'pen', w: 2, text: t => `The ${t} rebuild the bullpen: two power arms for the late innings.`, apply: () => ({ nextMods: { def: 0.75 } }) },
  { id: 'strength', w: 2, text: () => `A new strength and conditioning program and a full winter of work. The body feels ready for 162.`, apply: c => ({ durability: r10(Math.min(10, c.durability + 0.6)) }) },
  { id: 'arb-fight', w: 1, when: c => (c.contract?.arb ?? 0) > 0 && c.rep >= 6, text: t => `An arbitration hearing with the ${t}. He wins it, but the club argued he wasn’t worth the raise, and he heard every word.`, apply: c => ({ rep: Math.max(1, c.rep - 1) }) },
  { id: 'captain', w: 1, when: c => c.rep >= 8 && c.age >= 27, text: (t, c) => `The ${t} name ${c.name} captain. The clubhouse is his.`, apply: c => ({ rep: Math.min(10, c.rep + 1) }) },
  { id: 'mentor', w: 2, good: true, when: c => c.age <= 25, text: (t, c) => `A fifteen-year veteran on the ${t} takes ${c.name} under his wing. Early work in the cage every day in spring.`, apply: c => ({ dev: { ...c.dev, points: c.dev.points + 1 } }) },
  { id: 'driveline', w: 2, good: true, when: c => c.pos === 'pit' && c.age <= 29, text: (t, c) => `${c.name} spends the winter at a pitching lab: a new grip, a sharper breaking ball.`, apply: c => ({ dev: { ...c.dev, points: c.dev.points + 1 } }) },
  { id: 'built-around', w: 2, good: true, when: c => c.rep >= 7, text: (t, c) => `The ${t} build around ${c.name}. The best players in the lineup hit around him now.`, apply: () => ({ nextMods: { off: 0.6 } }) },
  { id: 'clubhouse', w: 2, bad: true, when: c => c.rep <= 4, text: t => `The ${t} clubhouse hasn’t moved on from last year. Players are talking to the beat writers.`, apply: c => ({ nextMods: { off: -0.5, def: -0.5 }, rep: Math.max(1, c.rep - 1) }) },
  { id: 'spring-tweak', w: 2, bad: true, text: (t, c) => (c.pos === 'pit' ? 'Some shoulder fatigue in spring training. Nothing on the MRI, but they slow him down.' : 'A tight hamstring in spring training. Nothing serious, but it lingers into April.'), apply: c => ({ durability: r10(Math.max(1, c.durability - 0.4)) }) },
  { id: 'fire-sale', w: 2, when: c => (c.seasons[c.seasons.length - 1]?.wins ?? 81) <= 75, text: t => `The ${t} trade two regulars for prospects. A long summer ahead.`, apply: () => ({ nextMods: { off: -0.75 } }) },
  { id: 'quiet', w: 3, text: () => `A quiet winter. Pitchers and catchers report in February, and the work begins.`, apply: () => ({}) },
]

// ── Registered ───────────────────────────────────────────────────────────────
const BB_FIRST = ['Jake', 'Tyler', 'Luis', 'Carlos', 'Cole', 'Gavin', 'Bryce', 'Mason', 'Ethan', 'Hunter', 'Andrés', 'José', 'Ryan', 'Kyle', 'Brandon', 'Caden', 'Nolan', 'Owen', 'Ezequiel', 'Yandel', 'Jackson', 'Wyatt', 'Logan', 'Diego', 'Rafael', 'Kenji']
const BB_LAST = ['Holloway', 'Reyes', 'McAllister', 'Crowe', 'Delgado', 'Brennan', 'Whitley', 'Arroyo', 'Kessler', 'Lindgren', 'Pruitt', 'Quinlan', 'Rosado', 'Tavares', 'Varela', 'Wexler', 'Yancey', 'Zamora', 'Bratton', 'Cardenas', 'Dunmore', 'Ellsworth', 'Fairchild', 'Galvan', 'Okada', 'Brito']
const bbName = r => `${BB_FIRST[Math.floor(r() * BB_FIRST.length)]} ${BB_LAST[Math.floor(r() * BB_LAST.length)]}`
BASEBALL.honorsOf = s => [
  s.champion && 'World Series champion', s.fmvp && 'World Series MVP', !s.champion && s.pennant && 'Pennant',
  s.mvp && 'MVP', !s.mvp && s.mvpRank && s.mvpRank <= 5 && `MVP: ${ordinal(s.mvpRank)}`, s.cy && 'Cy Young', !s.cy && s.cyRank && s.cyRank <= 5 && `Cy Young: ${ordinal(s.cyRank)}`,
  s.roy && 'Rookie of the Year', s.tripleCrown && 'Triple Crown', s.battingTitle && 'Batting title', s.hrLeader && !s.tripleCrown && 'Home run leader', s.kLeader && !s.tripleCrown && 'Strikeout leader', s.eraTitle && !s.tripleCrown && 'ERA title',
  s.allMLB && 'All-MLB First Team', s.ss && 'Silver Slugger', s.gg && 'Gold Glove', s.aaron && 'Hank Aaron Award', s.reliever && 'Reliever of the Year', s.allStar && (s.asgStart ? 'All-Star starter' : 'All-Star'), s.asgMvp && 'All-Star Game MVP', s.derby?.won && 'Home Run Derby champion',
].filter(Boolean)
BASEBALL.hardware = t => [
  [t.rings, t.rings === 1 ? 'WORLD SERIES' : 'WORLD SERIES TITLES', 'ring', true], [t.mvps, t.mvps === 1 ? 'MVP' : 'MVPS', 'trophy', true], [t.cys, t.cys === 1 ? 'CY YOUNG' : 'CY YOUNGS', 'trophy', true],
  [t.wsMvp, 'WORLD SERIES MVP', 'trophy', false], [t.tripleCrowns, t.tripleCrowns === 1 ? 'TRIPLE CROWN' : 'TRIPLE CROWNS', 'crown', true], [t.roys, 'ROOKIE OF THE YEAR', 'star', false],
  [t.allStars, t.allStars === 1 ? 'ALL-STAR' : 'ALL-STARS', 'star', false], [t.allMLB, 'ALL-MLB FIRST TEAM', 'medal', false], [t.ss, t.ss === 1 ? 'SILVER SLUGGER' : 'SILVER SLUGGERS', 'medal', false], [t.gg, t.gg === 1 ? 'GOLD GLOVE' : 'GOLD GLOVES', 'medal', false],
  [t.battingTitles, t.battingTitles === 1 ? 'BATTING TITLE' : 'BATTING TITLES', 'medal', false], [t.records, t.records === 1 ? 'RECORD' : 'RECORDS', 'flame', false],
].filter(([n]) => n > 0)
BASEBALL.ui = {
  posLine: 'A batter or a pitcher.',
  combine: 'THE MLB DRAFT COMBINE', combineWord: 'drills', combineSkip: 'SKIP THE SHOWCASE', combineDone: c => `The scouts saw the whole showcase, and the board moved with it. Next: four clubs picking near ${c.name}'s projected range want a sit-down.`,
  champ: 'WORLD SERIES', champs: 'WORLD SERIES CHAMPIONS', signDraft: 'SIGN AND REPORT', sportWord: 'baseball', bubble: 'On the bubble: the last wild card comes down to the final week.', ring: 'ring',
  introSteps: [
    ['Build', 'Name him, pick batter or pitcher, and build him from traits, the same spins as a normal game.'],
    ['The draft', 'The MLB Draft Combine and the showcase, sit-downs with scouts and front offices, then twenty rounds of the MLB Draft and a signing bonus.'],
    ['The career', 'Opening Day in the minors, then the call-up. 162 games a year: the lineup or the rotation, the All-Star Game, the trade deadline, October. Arbitration, then free agency.'],
    ['Legacy', 'MVPs, Cy Youngs, rings and the milestones: 3,000 hits, 500 home runs, 300 wins. Then the BBWAA vote for Cooperstown.'],
  ],
  award: 'MVP and Cy Young awards',
  legacyHow: 'Points come from seasons played, All-Star teams, MVPs and Cy Youngs (the most of all), Rookie of the Year, Silver Sluggers, Gold Gloves, All-MLB teams, rings and the World Series MVP, batting titles, Triple Crowns, records, and the career’s WAR, hits, home runs, wins, strikeouts and saves: the same formula that scores the greatest players’ real careers.',
  devNote: 'Every offseason brings a development point while he’s young; an MVP, a Cy Young, Rookie of the Year or an All-MLB First Team brings one more.',
}
BASEBALL.x = {
  depth: c => {
    if (c.pos !== 'pit') return { same: () => true, starters: 9, label: i => (i <= 9 ? `BATTING ${ordinal(SPOT_OF_RANK[i - 1] ?? i).toUpperCase()}` : 'BENCH') }
    const sp = pitRole(c) === 'SP'
    return { same: p => isSP(roleOf(p, 'pit')) === sp, starters: sp ? 5 : 1, label: i => (sp ? (i <= 5 ? `NO. ${i} STARTER` : 'LONG RELIEF') : i === 1 ? 'CLOSER' : i <= 3 ? 'SETUP' : 'BULLPEN') }
  },
  academyText: draftText, interviews: bbInterviews, offers: bbDraft,
  start: bbStart, beat: bbBeat, age: bbAge, injuries: c => ({ list: INJURIES[c.pos] ?? INJURIES.bat, enders: ENDERS[c.pos] ?? ENDERS.bat }), goals: bbGoals,
  onFinal: (f, t) => bbFinal(f, t), finishLeague: bbFinishLeague, round: bbRound, season: bbSeason, afterSeason: bbAfterSeason,
  news: bbNews, window: bbWindow, market: bbMarket, sign: bbSign, transferRequest: bbTradeRequest, retireAge: bbRetireAge,
  totals: bbTotals, legacy: bbLegacy, resume: bbResume, icon: bbHof, momentSit: bbMomentSit, allowGame: bbAllowGame,
  born: name => BORN.get(name), castIndex: BY_NAME,
  // (for the screens)
  depthLine: (c, dc) => { const u = usageOf(c), last0 = dc.ahead[dc.ahead.length - 1]; return c.pos === 'pit' ? (u.starter ? `${u.label} · ${u.kind === 'closer' ? 'the ninth inning is his' : 'every fifth day'}` : `${u.label} · behind ${last0?.name ?? 'the starters'}`) : u.starter ? `${u.label} · plays ${POS_AT[u.fp] ?? 'the field'}` : `BENCH · behind ${last0?.name ?? 'the regulars'}` },
  campLine: (c, dc) => { const u = usageOf(c), last0 = dc.ahead[dc.ahead.length - 1]; return u.starter ? `${c.name} goes into spring training ${c.pos === 'pit' ? (u.kind === 'closer' ? 'as the closer' : `as the No. ${u.spot} starter`) : `batting ${ordinal(u.spot)}, at ${POS_AT[u.fp]}`}.` : `${c.name} goes into spring training ${c.pos === 'pit' ? (u.kind === 'long' ? 'sixth in line for the rotation' : 'in the bullpen') : 'on the bench'}, behind ${last0?.name ?? 'the regulars'}.` },
  contractWord: c => { const k = c.contract ?? {}, ay = arbYear(c.service ?? 0); return k.kind === 'control' ? (ay ? `Arbitration, year ${ay} of 3` : 'Pre-arbitration') + ` · ${r3(c.service ?? 0)} years of service` : k.kind === 'ext' ? 'Extension' : 'Free-agent deal' },
  landText: c => `Signing bonus ${money(c.draft?.bonus ?? 0)} (slot ${money(c.draft?.slot ?? 0)}) · opens at ${levelName(c.minors?.level ?? 'AA')}`,
  usageOf, fieldPos, pitRole, roleOf, levelName, ipText, rate3, money, marketAAV, arbYear, projWar, stayPut: bbStayPut, roundName, roundTitle, LEAGUE_NAME, leagueOf, POS_WORD, POS_AT, slotValue,
}
// the season director's baseball (its stat lines, the game the club plays without him, the playoff line): lib/baseballDirector.js,
// shared with the one-off season page's moments
registerStats('bat', BAT_DEFS)
registerStats('pit', PIT_DEFS)
// the last-play moments (the mini games agent's ids, lib/minigames.js): a walk-off at-bat in the bottom of the
// ninth and the last out of a save. Landing it wins the game; a miss leaves it to the odds (extra innings, a
// teammate, the next hitter).
LAST_PLAY['walk-off'] = 'hit'
// the moments October deals (lib/minigames.js PLAYOFF_GAMES: the mini games agent's list once it's in, these until then)
if (!PLAYOFF_GAMES.bat) PLAYOFF_GAMES.bat = ['at-bat', 'walk-off', 'steal-second']
if (!PLAYOFF_GAMES.pit) PLAYOFF_GAMES.pit = ['strike-out', 'escape-jam']
// the showcase's numbers: what the scouts write down (the drill's own reading when it has one: raw)
// MLB Draft Combine and Perfect Game norms: a 60-yard dash about 6.9s for a prospect (6.4 is plus-plus), a max exit
// velocity about 100 mph in batting practice (108+ elite), a throw home from right field about 88 mph, a fastball about
// 93 (98+ elite), a breaking ball about 2,600 rpm (2,900+ elite)
const drill = (v, score) => ({ t: clamp(v, 0, 11) / 11, run: score - 0.6 })
const pc = x => clamp(x, -1, 1)
registerDrills({
  sixty: (v, score, raw) => { const { t, run } = drill(v, score), s = raw?.secs ?? r2(7.55 - t * 1.15 - run * 0.2); return { text: `${s.toFixed(2)}s`, pct: pc((6.95 - s) / 0.3) } },
  'exit-velo': (v, score, raw) => { const { t, run } = drill(v, score), m = Math.round(raw?.mph ?? raw?.ev ?? raw?.best ?? raw?.bestEv ?? 92 + t * 16 + run * 5); return { text: `${m} mph`, pct: pc((m - 101) / 5) } },
  'arm-strength': (v, score, raw) => { const { t, run } = drill(v, score), m = Math.round(raw?.mph ?? 80 + t * 16 + run * 4); return { text: `${m} mph`, pct: pc((m - 88) / 5) } },
  'pitch-velo': (v, score, raw) => { const { t, run } = drill(v, score), m = Math.round(raw?.mph ?? raw?.best ?? 87 + t * 12 + run * 3); return { text: `${m} mph`, pct: pc((m - 93) / 3) } },
  spin: (v, score, raw) => { const { t, run } = drill(v, score), rpm = Math.round((raw?.rpm ?? 2150 + t * 900 + run * 150) / 10) * 10; return { text: `${rpm.toLocaleString()} rpm`, pct: pc((rpm - 2600) / 250) } },
  bullpen: (v, score, raw) => { const of = raw?.of ?? 10, m = raw?.made ?? Math.round(3 + score * 7); return { text: `${m} of ${of}`, pct: pc((m / of - 0.6) * 2.5) } },
})
registerSport('baseball', BASEBALL, { resumes: { bat: BAT_RESUMES, pit: PIT_RESUMES }, events: EVENTS_BASEBALL, interviews: INTERVIEWS_BASEBALL, comps: { bat: LEGEND_BATTERS, pit: LEGEND_PITCHERS }, namers: { bat: bbName, pit: bbName } })
