// ══════════════════════════════════════════════════════════════════════════════
// College Basketball mode: the season engine (mode id 'cbb', positions 'guard' | 'big')
// ══════════════════════════════════════════════════════════════════════════════
//
// runCBBSimulation(build, types, team, position, rngSeed, gameMode, script, opts) → result
//
//   build     basketball's build shape: { [traitKey]: { type, val (0-11), qbFull, team } }, the ten guard or big traits
//   team      a CBB_TEAMS row (or its short)
//   rngSeed   any string/number. Same seed + same inputs = the same season, to the box score (no Math.random)
//   script    unused (football's signature kept)
//   opts      { name, year ('FR'…'SR', the build's class), season (2026 = the 2026-27 season), role ('bench': he comes
//             off the bench behind the school's starter), career (his earlier college seasons, for the draft board),
//             pools ({ guard, big } rosters in place of the data's: a later season, cbbShared seasonData) }
//
// THE RESULT
// {
//   sport: 'cbb', position, gameMode, seed, team, ovr, archetype, wins, losses (regular season), role,
//   games: [the regular season, in order: { g, opponent, oppShort, home, neutral, confGame, won, mySc, oppSc, ot,
//     min, pts, reb, ast, stl, blk, tov, fgm, fga, tpm, tpa, ftm, fta,
//     meta: { date ('Nov 3'), day, myRank, oppRank (AP at tip-off, null = unranked), oppRec, oppConf, event } }],
//   ppg, rpg, apg, spg, bpg, tov, fgPct, threePct, ftPct (regular season), bestGame,
//   playoffs (made the NCAA Tournament), champion (national champion), award ({ userWins, name: 'Wooden Award' }),
//   cbb: {
//     record: { w, l, confW, confL, selection (on Selection Sunday), final }, conf: { id, short, name },
//     postseason: [his conference tournament games, then the NCAA Tournament or the NIT: reg-season rows plus
//       { round, event ('SEC Tournament' | 'NCAA Tournament' | 'NIT'), region, mySeed, oppSeed, site }],
//     confTourney: { title, site, seed, rounds: [{ name, games: [{ a, b, aSeed, bSeed, aSc, bSc, winner, ot }] }], champion, played, won },
//     confChamp (tournament champion), confRegChamp (best conference record, ties share it),
//     ncaa: { seed, region, bid: 'auto' | 'at-large', field: [68 × { seed, region, short, rec, bid, conf, firstFour, overall (1-68) }],
//             issues (bracketing rules the committee couldn't keep: [{ kind, a, b | from, to }]),
//             lastFourIn, firstFourOut, games: [all 67: { round, region, hi, lo, hiSeed, loSeed, hiSc, loSc, winner, ot }],
//             regions: ['East', 'West', 'South', 'Midwest'], finalFour: [4 shorts], champion, runnerUp, exit (his last round) } | null,
//     nit: { seed, region, bid: 'exempt' | 'auto' | 'at-large', games (his), won, champion, size, exempt, autoBids } | null,
//     totals: { regular, throughConf (what the award voters saw), full } each { gp, min, pts, reb, ast, stl, blk, tov,
//               fgm, fga, tpm, tpa, ftm, fta, ppg, rpg, apg, spg, bpg, topg, fgPct, tpPct, ftPct, high, dd, td },
//     ap: [{ label, day, top25: [{ rank, short, rec }], myRank }], apPath: [{ label, rank, rec }],
//     myStanding: { id, short, name, teams: [{ short, confW, confL, w, l, seed, ap }], champion (regular season), tourney },
//     awards: { wooden: { award, winner, finalists, ballot: [{ name, team, pos, pts, first, line, isUser }], userPlace, userFinalist, userWon },
//               naismith / posAward / dpoy / freshman / confPOY / mop: { award, winner, userWon, userFinalist },
//               allAmerica: { first: [5], second: [5], third: [5], user: 'first' | 'second' | 'third' | null },
//               allConference: { conf, first, second, user } },
//     leaders: { key, label, rows: [{ name, team, year, isUser, value }], rank, of },
//     draft: { year, eligible (always: a player may declare after any season), tier ('top5' | 'lottery' | 'r1' | 'r2' | 'udfa'),
//              label, round, pick ([lo, hi] of 60, null undrafted), overall, note, draftYear, boardRank, boardOf,
//              board: [{ name, team, year, ovr, pos, isUser, tier, ppg, rpg, apg }] },
//     wire: [{ at (games played), text }], milestones: [{ at, id, label, big }],
//     user: { name, year, attrs, types, pos, natPos },
//   }
// }
//
// ── THE NUMBERS ──────────────────────────────────────────────────────────────
// • Strength: ESPN's BPI (points per 70 possessions against an average Division I team), offense and defense.
//   A game: each side scores 72.5 + its offense - the other's defense, home court worth 3.2 points, a spread of
//   about 11.5 on the final margin (college closing lines miss by 10-11).
// • A season: 31 regular-season games where the league's schedule allows (18 or 20 conference games; a double
//   round robin in leagues of 11 or fewer), then the conference tournament (every league, single elimination,
//   neutral floor), then Selection Sunday: 68 teams, 32 automatic bids (the conference tournament champions; the
//   Pac-12's is back in 2026-27) and 36 at-large by wins above bubble, seeded on the S-curve, the last four
//   at-large teams and the last four automatic qualifiers in the First Four (Dayton). Six rounds from there:
//   first round, second round, Sweet 16, Elite Eight, the Final Four and the national championship (Ford Field,
//   Detroit, April 3 and 5, 2027). A team left out can play the NIT (32 teams).
// • Polls: the AP Top 25, preseason and every Monday through the conference tournaments (the AP's last poll comes
//   out before the NCAA Tournament).
// • Player lines (per game, 30-34 minutes): an average starter 10-13 points; all-conference 15-18; an All-American
//   18-22; the national scoring leader 23-26. Rebounding leaders 11-13 a game, assist leaders 7-9, blocks 2.5-3.5.
// • The Wooden and Naismith go to the best player on a winning team (every winner since 2010 played for a top-four
//   seed or better, most for a 1 or 2). All-America: three teams of five.
// • The NBA draft: 60 picks, two rounds; a player may declare after any season. Youth is worth picks: a freshman
//   and a senior with the same season are a lottery pick and a late first-rounder.
// ══════════════════════════════════════════════════════════════════════════════
import { calcBucketOVR, getBucketGuardArchetype, getBucketBigArchetype } from './bucketSimulation'
import { collegeOVR } from './cfbOvr'
import { CBB_CONFERENCES, CBB_OTHER_CONFERENCES } from '../data/cbb-conferences'
import { CBB_TEAMS, CBB_OTHER_TEAMS } from '../data/cbb-teams'
import { CBB_GUARDS, CBB_BIGS, CBB_GUARD_TYPES, CBB_BIG_TYPES } from '../data/cbb-players'
import { seeded } from '../lib/rng'

export const CBB_TYPES_BY_POS = { guard: CBB_GUARD_TYPES, big: CBB_BIG_TYPES }
export const CBB_RESEARCH = { ppgTeam: 72.5, homeEdge: 3.2, marginSD: 11.6, bids: { auto: 32, atLarge: 36 }, draftPicks: 60 }

const clamp = (lo, hi, v) => Math.min(hi, Math.max(lo, v))
function gauss(r) { const u = r() || 1e-9, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
function binom(r, n, p) { if (n <= 0 || p <= 0) return 0; if (p >= 1) return n; let k = 0; for (let i = 0; i < n; i++) if (r() < p) k++; return k }
function poisson(r, lam) { if (lam <= 0) return 0; const L = Math.exp(-Math.min(lam, 30)); let k = 0, p = 1; do { k++; p *= r() } while (p > L); return k - 1 }
const shuffle = (r, arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const phi = z => 0.5 * (1 + Math.tanh(z * 0.8326))   // (a logistic stand-in for the normal curve, within a point)
const r1 = v => Math.round(v * 10) / 10
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// day 0 = Nov 2 of the season's first year
const dateOf = (day, season = 2026) => { const d = new Date(Date.UTC(season, 10, 2 + day)); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` }
const HFA = 3.2, BASE = 72.5, SD = 8.2, BUBBLE = 8.5
const REGIONS = ['East', 'West', 'South', 'Midwest']
const NCAA_ROUNDS = ['First Four', 'First Round', 'Second Round', 'Sweet 16', 'Elite Eight', 'Final Four', 'National Championship']
const NCAA_DAY = { 'First Four': 135, 'First Round': 137, 'Second Round': 139, 'Sweet 16': 144, 'Elite Eight': 146, 'Final Four': 152, 'National Championship': 154 }
const NCAA_SITE = { 'First Four': 'UD Arena, Dayton', 'Final Four': 'Ford Field, Detroit', 'National Championship': 'Ford Field, Detroit' }
// the conference tournaments whose floor is the same every year
const TOURNEY_SITE = { sec: 'Bridgestone Arena, Nashville', big12: 'T-Mobile Center, Kansas City', bigeast: 'Madison Square Garden, New York', mwc: 'Thomas & Mack Center, Las Vegas', wcc: 'Orleans Arena, Las Vegas', mvc: 'Enterprise Center, St. Louis' }
// the neutral-floor events of November and December (a marquee round's games carry one)
const EVENTS = ['Champions Classic', 'Maui Invitational', 'Players Era Festival', 'Battle 4 Atlantis', 'Jimmy V Classic', 'CBS Sports Classic']
// rivals a league that doesn't play everyone twice still plays twice
const RIVALS = [['DUKE', 'UNC'], ['KAN', 'KSU'], ['IND', 'PUR'], ['MICH', 'MSU'], ['ARIZ', 'ASU'], ['ALA', 'AUB'], ['UCLA', 'USC'], ['UKY', 'TENN'], ['UVA', 'VT'], ['DAY', 'VCU'], ['MEM', 'UAB']]

export function calcCBBOVR(build, types, position = 'guard') { return collegeOVR(calcBucketOVR(build, types ?? CBB_TYPES_BY_POS[position], position)) }
const toBuild = (attrs, types) => Object.fromEntries(types.map(t => [t, { type: t, val: attrs?.[t] ?? 5 }]))

// ── A player's line from his ten grades (per game, at `mins` minutes) ─────────
export function lineOf(a0, pos, mins = 32) {
  const g = k => a0?.[k] ?? 5
  const big = pos === 'big', mf = mins / 32
  const js = g('jumpShot'), fin = g('finishing'), pas = g('passing'), hnd = g('handles'), pd = g('perimeterDefense'), id = g('interiorDefense'), reb = g('rebounding'), pm = g('playmaking')
  const spd = g('speed'), bnc = g('bounce'), sz = g('size'), iq = g('basketballIQ'), clt = g('clutch')
  const scoring = big ? fin * 0.5 + js * 0.22 + pm * 0.1 + clt * 0.1 + bnc * 0.08 : js * 0.32 + fin * 0.26 + spd * 0.14 + hnd * 0.1 + sz * 0.08 + clt * 0.1
  // (2026-11-12, the owner: the national leaders topped out near 20. A star takes the shots: the top of the scale stretched
  // (a 9 scorer +2.1 points), an average starter where he was (a 6 still about 12.4))
  const ppg = Math.max(2, -9 + scoring * 3.55) * mf
  const rpg = (big ? 0.6 + (reb * 0.6 + sz * 0.25 + bnc * 0.15) * 0.95 : 1.2 + (sz * 0.55 + bnc * 0.3 + spd * 0.15) * 0.5) * mf
  const apg = (big ? 0.3 + (pm * 0.6 + iq * 0.3 + js * 0.1) * 0.3 : Math.max(0.5, -1.9 + (pas * 0.55 + hnd * 0.2 + iq * 0.25) * 0.88)) * mf
  const spg = (big ? 0.1 + (id * 0.3 + spd * 0.4 + iq * 0.3) * 0.11 : 0.2 + (pd * 0.6 + spd * 0.25 + iq * 0.15) * 0.16) * mf
  const bpg = (big ? Math.max(0.2, -0.5 + (id * 0.55 + sz * 0.25 + bnc * 0.2) * 0.27) : Math.max(0, (sz * 0.5 + bnc * 0.3 + pd * 0.2) * 0.07 - 0.1)) * mf
  const p2 = big ? 0.44 + fin * 0.014 + sz * 0.004 : 0.40 + fin * 0.012 + iq * 0.003
  const p3 = js <= 2 ? 0.2 : big ? 0.16 + js * 0.02 : 0.22 + js * 0.0175
  const s3 = big ? (js < 5 ? 0.02 : (js - 4) * 0.06) : js <= 2 ? 0.05 : 0.2 + js * 0.03
  const ft = clamp(0.4, 0.93, 0.5 + js * 0.026 + iq * 0.01)
  const ftRate = (big ? 0.28 : 0.2) + fin * 0.02
  const tov = Math.max(0.5, big ? 0.9 + ppg * 0.07 - iq * 0.03 : 1.0 + ppg * 0.06 + apg * 0.14 - (hnd + iq) * 0.035)
  const fga = ppg / (2 * p2 * (1 - s3) + 3 * p3 * s3 + ftRate * ft)
  return { mins, ppg, rpg, apg, spg, bpg, tov, p2, p3, s3, ft, ftRate, fga }
}
// one game of it. oppD: the other team's defense (points per 70 possessions); mg: his minutes that night (1 = usual)
function gameLine(r, L, oppD, mg) {
  const f = clamp(0.78, 1.22, 1 - oppD / 55), fe = 1 + (f - 1) * 0.6, form = 1 + gauss(r) * 0.1
  const fga = Math.max(0, Math.round(L.fga * mg * (1 + gauss(r) * 0.2)))
  const tpa = binom(r, fga, L.s3), tpm = binom(r, tpa, clamp(0, 0.75, L.p3 * fe * form))
  const fgm2 = binom(r, fga - tpa, clamp(0, 0.85, L.p2 * fe * form))
  const fta = poisson(r, L.fga * L.ftRate * mg), ftm = binom(r, fta, L.ft)
  return {
    min: Math.round(clamp(4, 45, L.mins * mg + gauss(r) * 2)), pts: 2 * fgm2 + 3 * tpm + ftm, reb: poisson(r, L.rpg * mg), ast: poisson(r, L.apg * mg * (0.6 + 0.4 * f)),
    stl: poisson(r, L.spg * mg), blk: poisson(r, L.bpg * mg), tov: poisson(r, L.tov * mg), fgm: fgm2 + tpm, fga, tpm, tpa, ftm, fta,
  }
}
export function cbbSeasonTotals(games) {
  const gs = games.filter(g => g.min != null)
  const sum = k => gs.reduce((a, g) => a + (g[k] ?? 0), 0)
  const n = gs.length || 1
  const t = { gp: gs.length }
  for (const k of ['min', 'pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta']) t[k] = sum(k)
  const dbl = g => [g.pts, g.reb, g.ast, g.stl, g.blk].filter(x => x >= 10).length
  return {
    ...t, mpg: r1(t.min / n), ppg: r1(t.pts / n), rpg: r1(t.reb / n), apg: r1(t.ast / n), spg: r1(t.stl / n), bpg: r1(t.blk / n), topg: r1(t.tov / n),
    fgPct: t.fga ? r1(t.fgm / t.fga * 100) : 0, tpPct: t.tpa ? r1(t.tpm / t.tpa * 100) : 0, ftPct: t.fta ? r1(t.ftm / t.fta * 100) : 0,
    high: gs.reduce((m, g) => Math.max(m, g.pts ?? 0), 0), dd: gs.filter(g => dbl(g) >= 2).length, td: gs.filter(g => dbl(g) >= 3).length,
  }
}
const lineText = t => `${t.ppg.toFixed(1)} pts, ${t.rpg.toFixed(1)} reb, ${t.apg.toFixed(1)} ast`

// ── The league (built once from the data, then cached) ───────────────────────
let LEAGUE = null
const LEAGUES = new WeakMap()
export function cbbLeague(pools = null) {
  if (!LEAGUE) LEAGUE = buildLeague()
  if (!pools) return LEAGUE
  let L = LEAGUES.get(pools)
  if (!L) {
    const lp = leaguePlayers(pools)
    const teams = blendTeams(LEAGUE.teams0, lp.rooms)
    L = { ...LEAGUE, ...lp, teams, byShort: Object.fromEntries(teams.map(t => [t.short, t])), bySeason: {} }
    L.oppD = oppDOf(L, L.schedule)
    LEAGUES.set(pools, L)
  }
  return L
}
function leaguePlayers(lists) {
  const prep = (list, pos) => (list ?? []).filter(p => p && p.team && p.attrs).map(p => ({ ...p, pos, ovr: p.ovr ?? calcCBBOVR(toBuild(p.attrs, CBB_TYPES_BY_POS[pos]), CBB_TYPES_BY_POS[pos], pos) }))
  const players = { guard: prep(lists.guard, 'guard'), big: prep(lists.big, 'big') }
  const rooms = {}
  for (const pos of ['guard', 'big']) for (const p of players[pos]) (rooms[p.team] ??= { guard: [], big: [] })[pos].push(p)
  for (const d of Object.values(rooms)) for (const pos of ['guard', 'big']) d[pos].sort((a, b) => (a.depth ?? 9) - (b.depth ?? 9))
  return { players, rooms }
}
// Team strength (o, d, rating) is ESPN's BPI as pulled in Week 2 of 2026-27 (data/cbb-teams.js). Early in a season BPI is
// mostly its preseason prior, which is built on last season, so on its own the game's polls and brackets looked like
// last year's (the owner, 2026-11-12). Each playable school's strength is blended with a read of this season's roster in
// the game's own ratings: its rotation's overalls, minutes-weighted (the five starters, then the bench by grade: 32, 32,
// 31, 30, 28, 20, 15, 11 minutes), put on BPI's scale (the same mean and spread across the 146 schools), 2/3 BPI and 1/3
// the roster, the difference shared evenly by offense and defense. (The 219 other schools have no rosters: BPI alone.)
// A later season (pools) blends with that season's rosters.
const ROSTER_W = 0.33, ROT_MIN = [32, 32, 31, 30, 28, 20, 15, 11]
function rosterScore(room) {
  const ps = [...(room?.guard ?? []), ...(room?.big ?? [])].sort((a, b) => (b.starter ? 1 : 0) - (a.starter ? 1 : 0) || (b.ovr ?? 0) - (a.ovr ?? 0)).slice(0, 8)
  if (ps.length < 5) return null
  let s = 0, m = 0
  ps.forEach((p, k) => { s += (p.ovr ?? 70) * ROT_MIN[k]; m += ROT_MIN[k] })
  return s / m
}
function blendTeams(base, rooms) {
  const rs = base.map(t => (t.playable ? rosterScore(rooms[t.short]) : null))
  const have = base.filter((t, i) => rs[i] != null)
  if (have.length < 10) return base.map(t => ({ ...t }))
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length, sd = (xs, m) => Math.sqrt(mean(xs.map(x => (x - m) ** 2))) || 1
  const bp = have.map(t => t.base), rr = rs.filter(x => x != null)
  const mB = mean(bp), sB = sd(bp, mB), mR = mean(rr), sR = sd(rr, mR)
  return base.map((t, i) => {
    if (rs[i] == null) return { ...t, o: t.o0, d: t.d0, rating: t.base, rosterRating: null }
    const onScale = mB + ((rs[i] - mR) / sR) * sB, delta = ROSTER_W * (onScale - t.base)
    return { ...t, o: t.o0 + delta / 2, d: t.d0 + delta / 2, rating: t.base + delta, rosterRating: onScale }
  })
}
function buildLeague() {
  const confRows = [...CBB_CONFERENCES.map(c => ({ ...c, playable: true })), ...CBB_OTHER_CONFERENCES.map(c => ({ ...c, playable: false, tier: 'LOW' }))]
  const teams0 = [...CBB_TEAMS.map(t => ({ ...t, playable: true })), ...CBB_OTHER_TEAMS.map(t => ({ ...t, playable: false }))]
    .map((t, idx) => ({ ...t, idx, o0: t.bpiOff ?? 0, d0: t.bpiDef ?? 0, base: (t.bpiOff ?? 0) + (t.bpiDef ?? 0) }))
  const lp = leaguePlayers({ guard: CBB_GUARDS, big: CBB_BIGS })
  const teams = blendTeams(teams0, lp.rooms)
  const byShort = Object.fromEntries(teams.map(t => [t.short, t]))
  const confs = confRows.map(c => ({ ...c, teams: teams.filter(t => t.conf === c.id).map(t => t.idx) })).filter(c => c.teams.length)
  const confOf = Object.fromEntries(confs.map(c => [c.id, c]))
  for (const t of [...teams0, ...teams]) { t.tier = confOf[t.conf]?.tier ?? 'LOW'; t.confShort = confOf[t.conf]?.short ?? t.confShort }
  const L = { teams, teams0, byShort, confs, confOf, ...lp }
  L.schedule = buildSchedule(L, 2026)
  L.oppD = oppDOf(L, L.schedule)
  return L
}
// the defenses a team sees over its season (award lines are read against them)
function oppDOf(L, sch) { return L.teams.map(t => { const gs = sch.byTeam[t.idx]; return gs.length ? gs.reduce((s, g) => s + L.teams[g.a === t.idx ? g.b : g.a].d, 0) / gs.length : 0 }) }
// a season's schedule: 2026-27's is the one above; another season draws its own (conference rotations and the
// non-conference slate both change year to year, as they do)
function seasonOf(L, season) {
  if (!season || season === 2026) return { schedule: L.schedule, oppD: L.oppD }
  const c = (L.bySeason ??= {})
  if (!c[season]) { const schedule = buildSchedule(L, season); c[season] = { schedule, oppD: oppDOf(L, schedule) } }
  return c[season]
}

// ── The schedule (one for the season, like the real one) ─────────────────────
function circle(ids) {
  const arr = [...ids]
  if (arr.length % 2) arr.push(null)
  const n = arr.length, rounds = []
  for (let k = 0; k < n - 1; k++) {
    const pairs = []
    for (let i = 0; i < n / 2; i++) if (arr[i] != null && arr[n - 1 - i] != null) pairs.push(k % 2 ? [arr[n - 1 - i], arr[i]] : [arr[i], arr[n - 1 - i]])
    rounds.push(pairs)
    arr.splice(1, 0, arr.pop())
  }
  return rounds
}
function buildSchedule(L, season = 2026) {
  const r = seeded(`cbb-${season}-schedule`)
  const games = [], played = new Set()
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  const add = (a, b, site, conf, day, event = null) => { games.push({ id: games.length, a, b, site, conf, day, event }); played.add(key(a, b)) }
  const ncLeft = {}
  // conference play: everyone once, then again until each team has its games (the rivals' second game first)
  for (const c of L.confs) {
    const n = c.teams.length, k = n <= 11 ? 2 * (n - 1) : 18
    let ids = shuffle(r, c.teams)
    for (const [x, y] of RIVALS) {
      const a = L.byShort[x]?.idx, b = L.byShort[y]?.idx
      if (a == null || b == null || !ids.includes(a) || !ids.includes(b)) continue
      const rest = ids.filter(i => i !== a && i !== b)
      const free = []
      for (let i = 1; i < Math.floor(ids.length / 2); i++) free.push(i)
      const at = free.find(i => !RIVALS.some(([p, q]) => [L.byShort[p]?.idx, L.byShort[q]?.idx].includes(rest[i - 1])) ) ?? 1
      rest.splice(at - 1, 0, a); rest.splice(ids.length - 1 - at, 0, b)
      ids = rest
      break
    }
    const first = circle(ids), second = first.map(rd => rd.map(([a, b]) => [b, a]))
    const count = Object.fromEntries(ids.map(i => [i, 0]))
    const rounds = []
    for (const rd of [...first, ...second]) {
      const keep = rd.filter(([a, b]) => count[a] < k && count[b] < k)
      if (!keep.length) continue
      for (const [a, b] of keep) { count[a]++; count[b]++ }
      rounds.push(keep)
    }
    rounds.forEach((rd, j) => { const day = 58 + Math.round(j * 66 / Math.max(1, rounds.length - 1)); for (const [a, b] of rd) add(a, b, 'a', true, day) })
    for (const i of ids) ncLeft[i] = Math.min(13, 31 - count[i])
  }
  // the non-conference: thirteen rounds through November and December. Most nights a power program has a smaller
  // one in; four rounds are like against like, two of them on neutral floors (the events)
  const tierOf = i => L.teams[i].tier
  const homeN = {}
  for (let rd = 0; rd < 13; rd++) {
    const marquee = [2, 5, 6, 9].includes(rd), neutral = rd === 5 || rd === 6
    const need = shuffle(r, L.teams.filter(t => ncLeft[t.idx] > 0 && 13 - rd <= ncLeft[t.idx] + (r() < 0.5 ? 0 : 0)).map(t => t.idx))
    const by = { HIGH: [], MID: [], LOW: [] }
    for (const i of need) by[tierOf(i)].push(i)
    const pair = (a, b, site, event = null) => { add(a, b, site, false, 1 + rd * 4 + Math.floor(r() * 3), event); ncLeft[a]--; ncLeft[b]--; if (site === 'a') homeN[a] = (homeN[a] ?? 0) + 1; if (site === 'b') homeN[b] = (homeN[b] ?? 0) + 1 }
    const ok = (a, b) => L.teams[a].conf !== L.teams[b].conf && !played.has(key(a, b))
    const take = (list, a) => { const k = list.findIndex(b => ok(a, b)); return k < 0 ? null : list.splice(k, 1)[0] }
    const rest = []
    const among = (list, siteFn, ev) => { while (list.length) { const a = list.shift(); const b = take(list, a); if (b == null) rest.push(a); else pair(a, b, siteFn(a, b), ev?.()) } }
    const fair = (a, b) => ((homeN[a] ?? 0) <= (homeN[b] ?? 0) ? 'a' : 'b')
    if (marquee) {
      among(by.HIGH, neutral ? () => 'n' : fair, neutral ? () => EVENTS[Math.floor(r() * EVENTS.length)] : null)
      among(by.MID, fair); among(by.LOW, fair)
    } else {
      for (const hi of [...by.HIGH, ...by.MID]) { const lo = take(by.LOW, hi); if (lo == null) rest.push(hi); else pair(hi, lo, tierOf(hi) === 'HIGH' || r() < 0.75 ? 'a' : 'b') }
      among(by.LOW, fair)
    }
    // (whoever is left over that night plays whoever else is; a team nobody is left for has an open date)
    const late = rest.splice(0)
    while (late.length) { const a = late.shift(); const b = take(late, a); if (b != null) pair(a, b, fair(a, b)) }
  }
  games.sort((x, y) => x.day - y.day || x.id - y.id)
  const byTeam = L.teams.map(() => [])
  for (const g of games) { byTeam[g.a].push(g); byTeam[g.b].push(g) }
  return { games, byTeam }
}

// ── A bracket (conference tournaments, the NIT): seeds best first, byes to the top ──
function seedOrder(size) { let s = [1]; while (s.length < size) { const n = s.length * 2 + 1; s = s.flatMap(x => [x, n - x]) } return s }
const ROUND_NAMES = n => ['Championship', 'Semifinal', 'Quarterfinal', 'Second Round', 'First Round'].slice(0, n).reverse()

// ── The season ───────────────────────────────────────────────────────────────
function simulate(L, { seed, user, season }) {
  const r = seeded(`cbb-season-${seed}`)
  const T = L.teams, N = T.length
  const S = T.map(() => ({ w: 0, l: 0, cw: 0, cl: 0, wab: 0, n: 0 }))
  const adj = T.map(() => ({ o: 0, d: 0 }))
  if (user) { adj[user.idx].o = user.shift * 0.6; adj[user.idx].d = user.shift * 0.4 }
  const rate = i => T[i].rating + adj[i].o + adj[i].d
  const rec = i => `${S[i].w}-${S[i].l}`
  let rank = {}   // idx → AP rank
  const polls = []
  const pollNoise = T.map(() => gauss(r) * 1.2)
  const realPre = T.filter(t => t.ap >= 1 && t.ap <= 25).sort((a, b) => a.ap - b.ap).map(t => t.idx)
  const preAP = Object.fromEntries(realPre.map((i, k) => [i, k + 1]))
  const poll = (label, day) => {
    // (the voters: strength early, the résumé as it builds, and the record itself: a loss costs a team more than a
    // win earns, so a 27-2 team climbs past a 22-7 one with the better schedule. 2026-11-12, the owner: a 27-2 Pac-12
    // champion sat 15th to 24th all year)
    // The preseason poll is the real one (data/cbb-teams.js ap, the AP Top 25 when the data was pulled), so the offers
    // board and the season agree; the voters then hold to it for about the first half of the season (a ranked team
    // keeps credit for its place, fading as games are played) while the games take over
    const sticky = i => (preAP[i] ? (26 - preAP[i]) * 0.55 * Math.max(0, 1 - S[i].n / 16) : 0)
    const sc = i => rate(i) * Math.max(0.3, 1 - S[i].n / 24) + 2.3 * S[i].wab + 0.8 * rate(i) * 0.3 + (0.45 * S[i].w - 1.5 * S[i].l) + sticky(i) + pollNoise[i] * (S[i].n ? 0.4 : 1.6)
    const order = label === 'Preseason' && realPre.length === 25 ? realPre : T.map(t => t.idx).sort((a, b) => sc(b) - sc(a)).slice(0, 25)
    rank = Object.fromEntries(order.map((i, k) => [i, k + 1]))
    polls.push({ label, day, top25: order.map((i, k) => ({ rank: k + 1, short: T[i].short, rec: rec(i) })), myRank: user ? rank[user.idx] ?? null : null })
  }
  const reg = [], post = []
  const meets = new Map(), mkey = (a, b) => (a < b ? a * 1000 + b : b * 1000 + a)
  let phase = 'reg'
  const play = (a, b, site, meta = {}) => {
    const hfa = site === 'a' ? HFA : site === 'b' ? -HFA : 0
    const pace = gauss(r) * 3.5
    let sa = Math.round(BASE + T[a].o + adj[a].o - T[b].d - adj[b].d + hfa / 2 + pace + gauss(r) * SD)
    let sb = Math.round(BASE + T[b].o + adj[b].o - T[a].d - adj[a].d - hfa / 2 + pace + gauss(r) * SD)
    sa = Math.max(38, sa); sb = Math.max(38, sb)
    let ot = 0
    while (sa === sb) { ot++; sa += Math.max(2, Math.round(8 + gauss(r) * 3)); sb += Math.max(2, Math.round(8 + gauss(r) * 3)) }
    const aw = sa > sb
    // wins above bubble, for the committee and the voters
    const pa = phi((BUBBLE - rate(b) + hfa) / 11.6)
    S[a].wab += aw ? 1 - pa : -pa
    const pb = phi((BUBBLE - rate(a) - hfa) / 11.6)
    S[b].wab += aw ? -pb : 1 - pb
    S[a].n++; S[b].n++
    meets.set(mkey(a, b), (meets.get(mkey(a, b)) ?? 0) + 1)   // head to head, for the bracket's conference rules
    if (aw) { S[a].w++; S[b].l++ } else { S[b].w++; S[a].l++ }
    if (meta.conf) { if (aw) { S[a].cw++; S[b].cl++ } else { S[b].cw++; S[a].cl++ } }
    if (user && (a === user.idx || b === user.idx)) {
      const me = a === user.idx, opp = me ? b : a, mySc = me ? sa : sb, oppSc = me ? sb : sa, won = mySc > oppSc
      const mg = (won && mySc - oppSc >= 22 ? 0.86 : 1) * (1 + ot * 0.1)
      const row = {
        opponent: T[opp].school, oppShort: T[opp].short, home: (me && site === 'a') || (!me && site === 'b'), neutral: site === 'n', confGame: !!meta.conf, won, mySc, oppSc, ot,
        ...gameLine(user.r, user.line, T[opp].d + adj[opp].d, mg),
        meta: { date: dateOf(meta.day ?? 0, season), day: meta.day ?? 0, myRank: rank[user.idx] ?? null, oppRank: rank[opp] ?? null, oppRec: `${S[opp].w - (won ? 0 : 1)}-${S[opp].l - (won ? 1 : 0)}`, oppConf: T[opp].confShort, event: meta.event ?? null },
        ...(meta.round ? { round: meta.round, event: meta.event, region: meta.region ?? null, mySeed: meta.seeds?.[user.idx] ?? null, oppSeed: meta.seeds?.[opp] ?? null, site: meta.siteName ?? null } : {}),
      }
      if (phase === 'reg') { row.g = reg.length + 1; reg.push(row) } else post.push(row)
    }
    return { aSc: sa, bSc: sb, ot, winner: aw ? a : b }
  }

  // the regular season, a Monday poll every week
  poll('Preseason', -1)
  let week = 1
  for (const g of seasonOf(L, season).schedule.games) {
    while (g.day >= week * 7) { week++; poll(`Week ${week}`, (week - 1) * 7) }
    play(g.a, g.b, g.site, { conf: g.conf, day: g.day, event: g.event })
  }
  while (week < 18) { week++; poll(`Week ${week}`, (week - 1) * 7) }
  const regRec = T.map((_, i) => ({ w: S[i].w, l: S[i].l }))

  // the conference tournaments
  phase = 'post'
  const tourneys = {}, autos = new Set()
  const standings = {}
  for (const c of L.confs) {
    const order = [...c.teams].sort((a, b) => (S[b].cw - S[b].cl) - (S[a].cw - S[a].cl) || S[b].cw - S[a].cw || rate(b) - rate(a))
    const best = S[order[0]].cw - S[order[0]].cl
    standings[c.id] = { order, regChamps: order.filter(i => S[i].cw - S[i].cl === best) }
    const field = order.slice(0, 16)
    const m = field.length
    let size = 1; while (size < m) size *= 2
    const slots = seedOrder(size).map(s => (s <= m ? field[s - 1] : null))
    const seedOf = Object.fromEntries(field.map((i, k) => [i, k + 1]))
    const nR = Math.log2(size), names = ROUND_NAMES(nR)
    const title = `${c.short} Tournament`
    let alive = slots
    const rounds = []
    for (let k = 0; k < nR; k++) {
      const next = [], gamesR = []
      for (let i = 0; i < alive.length; i += 2) {
        const a = alive[i], b = alive[i + 1]
        if (a == null || b == null) { next.push(a ?? b); continue }
        const res = play(a, b, 'n', { day: 127 + Math.round((k + (5 - nR)) * 1.4), round: names[k], event: title, seeds: seedOf, siteName: TOURNEY_SITE[c.id] ?? null })
        gamesR.push({ a: T[a].short, b: T[b].short, aSeed: seedOf[a], bSeed: seedOf[b], aSc: res.aSc, bSc: res.bSc, winner: T[res.winner].short, ot: res.ot })
        next.push(res.winner)
      }
      rounds.push({ name: names[k], games: gamesR })
      alive = next
    }
    autos.add(alive[0])
    tourneys[c.id] = { title, site: TOURNEY_SITE[c.id] ?? null, rounds, champion: T[alive[0]].short, seedOf }
  }
  poll('Final', 134)
  const selRec = T.map((_, i) => rec(i))

  // ── Selection Sunday: the NCAA Tournament as the committee builds it ──
  // The game has every Division I school (365) in its 32 conferences, so the field is the real one: 68 teams, 32
  // automatic bids (each conference tournament champion; the eleven conferences the mode plays and the 21 others) and
  // 36 at-large, the best of the rest on the committee's board (sel: wins above bubble, the committee's résumé
  // measure, and team strength, the NET's part). The committee's procedures (NCAA, "Principles and procedures for
  // establishing the bracket"), as far as the game can apply them:
  //   · the seed list: all 68 ranked 1-68 (the true seeds); four to a line, so lines 1-16 in each of four regions
  //   · the First Four in Dayton: the last four at-large teams on the list and the four lowest-ranked automatic
  //     qualifiers, each paired with its nearest neighbour on the list (a pair takes its better team's place, so the
  //     at-large games are for whatever line that is, usually the 11s, and the automatic ones for two 16 seeds, the
  //     very last two for the No. 1 overall seed's region). A pair from one conference is re-paired
  //   · the S-curve: line 1 East, West, South, Midwest from the overall No. 1 down, line 2 back the other way, and so
  //     on, so the overall No. 1's region meets the No. 4's in the Final Four and No. 2's meets No. 3's
  //   · balancing, line by line, swapping teams across the regions of one line only (a team is never moved off its
  //     line): the first four teams from a conference on lines 1-4 go to four different regions; two teams from one
  //     conference that met three or more times (the conference tournament counts) can't meet before the regional
  //     final, twice not before the regional semifinal, once not before the second round (never in the first round);
  //     when a conference has nine or more teams in the field those can give way. The top four lines stay balanced
  //     (no region's sum of true seeds more than six from another's). Within those, the S-curve is kept as closely
  //     as it can be
  //   · in each region the bracket is 1-16, 8-9, 5-12, 4-13, 6-11, 3-14, 7-10, 2-15, top to bottom, so the 1 meets
  //     the 8/9 winner and then the 4/5 side; then the Sweet 16, the Elite Eight (regional final), the Final Four,
  //     the national championship
  // (Not modelled: sites and travel, BYU's no-Sunday rule, home-floor limits: the game has no venues to place.
  // The 2027 tournament is to grow to 76 teams with a 24-team opening round; the game keeps the 68-team format.)
  const sel = i => 2 * S[i].wab + 0.35 * rate(i)
  const all = T.map(t => t.idx).sort((a, b) => sel(b) - sel(a))
  const atLarge = all.filter(i => !autos.has(i)).slice(0, 36)
  const out4 = all.filter(i => !autos.has(i)).slice(36, 40)
  const fieldIdx = all.filter(i => autos.has(i) || atLarge.includes(i))   // the seed list, 1-68
  const trueSeed = Object.fromEntries(fieldIdx.map((i, k) => [i, k + 1]))
  const sameConf = (a, b) => T[a].conf === T[b].conf
  const pairUp = four => [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]].map(ps => ps.map(([x, y]) => [four[x], four[y]])).find(ps => ps.every(([a, b]) => !sameConf(a, b))) ?? [[four[0], four[1]], [four[2], four[3]]]
  const ffAL = atLarge.slice(-4), ffAuto = fieldIdx.filter(i => autos.has(i)).slice(-4)
  const pairs = [...pairUp(ffAL), ...pairUp(ffAuto)]
  const second = new Set(pairs.map(p => p[1]))
  const slots = fieldIdx.filter(i => !second.has(i)).map(i => ({ team: i, pair: pairs.find(p => p[0] === i) ?? null }))
  // the bracket's geography: which first-round game (pod of two), which second-round pod (four), which half
  const POD = { 1: 0, 16: 0, 8: 0, 9: 0, 5: 1, 12: 1, 4: 1, 13: 1, 6: 2, 11: 2, 3: 2, 14: 2, 7: 3, 10: 3, 2: 3, 15: 3 }
  const meetRound = (s1, s2) => (s1 + s2 === 17 ? 1 : POD[s1] === POD[s2] ? 2 : (POD[s1] >> 1) === (POD[s2] >> 1) ? 3 : 4)   // 1 R64 … 4 regional final
  const needRound = (a, b) => { const m = meets.get(mkey(a, b)) ?? 0; return m >= 3 ? 4 : m === 2 ? 3 : 2 }
  const inField = {}
  for (const i of fieldIdx) inField[T[i].conf] = (inField[T[i].conf] ?? 0) + 1
  const placed = { East: [], West: [], South: [], Midwest: [] }   // [{ teams, seed }]
  const top4 = {}   // conference → the regions its first four on lines 1-4 are in
  const PERMS = []
  const perm = (arr, cur = []) => { if (!arr.length) { PERMS.push(cur); return } arr.forEach((x, k) => perm([...arr.slice(0, k), ...arr.slice(k + 1)], [...cur, x])) }
  perm([0, 1, 2, 3])
  const sumTop = { East: 0, West: 0, South: 0, Midwest: 0 }
  // the top four lines (the 16 that the rules for lines 1-4 and the balance are about): every way to spread lines 2-4
  // (24 each; line 1 is the S-curve's), the cheapest by the same scores as below
  const topPick = (() => {
    const lines = [0, 1, 2, 3].map(l => slots.slice(l * 4, l * 4 + 4))
    const defs = [0, 1, 2, 3].map(l => (l % 2 === 0 ? REGIONS : [...REGIONS].reverse()).map(reg => REGIONS.indexOf(reg)))
    const curve = (l, p) => p.reduce((c, ri, j) => c + Math.abs(defs[l].indexOf(ri) - j), 0)
    // depth first, line by line, each line's cost against the lines above it, cut off once it can't beat the best
    const firsts = {}, regs = [[], [], [], []], sums = [0, 0, 0, 0], ps = []
    let best = null, bestC = Infinity
    const go = (l, c) => {
      if (c >= bestC) return
      if (l === 4) { if (Math.max(...sums) - Math.min(...sums) > 6) c += 500; if (c < bestC) { bestC = c; best = [...ps] } return }
      for (const p of l === 0 ? [defs[0]] : [defs[l], ...PERMS]) {
        let d = curve(l, p)
        const undo = []
        p.forEach((ri, j) => {
          const i = lines[l][j].team, cf = T[i].conf, got = (firsts[cf] ??= [])
          if (got.length < 4) { if (got.includes(ri)) d += 1000; got.push(ri); undo.push(cf) }
          for (const [b2, lb] of regs[ri]) if (sameConf(i, b2) && meetRound(lb + 1, l + 1) < needRound(i, b2)) d += inField[cf] >= 9 ? 40 : 1000
        })
        p.forEach((ri, j) => { regs[ri].push([lines[l][j].team, l]); sums[ri] += trueSeed[lines[l][j].team] })
        ps.push(p)
        go(l + 1, c + d)
        ps.pop()
        p.forEach((ri, j) => { regs[ri].pop(); sums[ri] -= trueSeed[lines[l][j].team] })
        for (const cf of undo) firsts[cf].pop()
      }
    }
    go(0, 0)
    return best
  })()
  for (let line = 0; line < 16; line++) {
    const row = slots.slice(line * 4, line * 4 + 4)
    const def = line % 2 === 0 ? REGIONS : [...REGIONS].reverse()   // the S-curve's order on this line
    const cost = p => {
      let c = 0
      p.forEach((ri, j) => {
        const reg = REGIONS[ri], s = row[j], seed = line + 1, mine = s.pair ?? [s.team]
        c += Math.abs(def.indexOf(reg) - j)   // off the S-curve
        for (const x of placed[reg]) for (const a of x.teams) for (const b of mine) {
          if (!sameConf(a, b)) continue
          const at = meetRound(x.seed, seed)
          if (at === 1) c += 1000   // never in the first round
          else if (at < needRound(a, b)) c += inField[T[a].conf] >= 9 ? 40 : 1000
        }
        if (line < 4) for (const b of mine) { const got = top4[T[b].conf] ?? []; if (got.length < 4 && got.includes(reg)) c += 1000 }
      })
      if (line === 3) {
        const sums = REGIONS.map(reg => sumTop[reg] + trueSeed[row[p.findIndex(ri => REGIONS[ri] === reg)].team])
        if (Math.max(...sums) - Math.min(...sums) > 6) c += 500
      }
      return c
    }
    // the best of the 24 ways to spread the line (ties: the S-curve's own, then the least moved); the top four lines
    // as one, every way at once (below)
    const defIdx = def.map(reg => REGIONS.indexOf(reg))
    let best = defIdx, bestC = cost(defIdx)
    if (line < 4) best = topPick[line]
    else for (const p of PERMS) { const c = cost(p); if (c < bestC) { best = p; bestC = c } }
    best.forEach((ri, j) => {
      const reg = REGIONS[ri], s = row[j]
      s.seed = line + 1; s.region = reg
      placed[reg].push({ teams: s.pair ?? [s.team], seed: s.seed })
      if (line < 4) { sumTop[reg] += trueSeed[s.team]; const cf = T[s.team].conf; (top4[cf] ??= []).length < 4 && top4[cf].push(reg) }
    })
  }
  // A line at a time can paint itself into a corner (three of the SEC's and two of the Big 12's first four on one
  // line, with two regions left to each). So the whole bracket is then improved by swaps, as the committee does at the
  // end: two teams on a line trading regions, or (from the 3 line down, never the 16s' First Four games) a team trading places
  // with one on the next line, the move the procedures keep for when the principles can't be met otherwise.
  // Everything is scored: a first-round conference game or an early rematch 1000 (40 when the league has nine or more
  // in), a top-four-lines conference repeat 1000, a top-16 imbalance 500, a team off its line 200, off the S-curve 1 a step
  const home = new Map(slots.map((sl, k) => [sl, Math.floor(k / 4)]))
  slots.forEach(sl => { sl.line = sl.seed - 1 })
  const slotOf = {}
  for (const sl of slots) for (const i of sl.pair ?? [sl.team]) slotOf[i] = sl
  const confPairs = []
  for (let x = 0; x < fieldIdx.length; x++) for (let y = x + 1; y < fieldIdx.length; y++) {
    const a = fieldIdx[x], b = fieldIdx[y]
    if (sameConf(a, b) && slotOf[a] !== slotOf[b]) confPairs.push([a, b, needRound(a, b), inField[T[a].conf] >= 9 ? 40 : 1000])
  }
  const total = () => {
    let c = 0
    for (const [a, b, need, w] of confPairs) {
      const sa = slotOf[a], sb = slotOf[b]
      if (sa.region !== sb.region) continue
      const at = meetRound(sa.line + 1, sb.line + 1)
      if (at === 1) c += 1000; else if (at < need) c += w
    }
    const firsts = {}, sums = { East: 0, West: 0, South: 0, Midwest: 0 }
    for (const sl of [...slots].filter(q => q.line < 4).sort((q, r2) => trueSeed[q.team] - trueSeed[r2.team])) {
      const cf = T[sl.team].conf, got = (firsts[cf] ??= [])
      if (got.length < 4) { if (got.includes(sl.region)) c += 1000; got.push(sl.region) }
      sums[sl.region] += trueSeed[sl.team]
    }
    const sv = Object.values(sums)
    if (Math.max(...sv) - Math.min(...sv) > 6) c += 500
    for (let line = 0; line < 16; line++) {
      const def = line % 2 === 0 ? REGIONS : [...REGIONS].reverse()
      slots.filter(q => q.line === line).sort((q, r2) => trueSeed[q.team] - trueSeed[r2.team]).forEach((q, k) => { c += Math.abs(def.indexOf(q.region) - k) })
    }
    for (const sl of slots) c += 200 * Math.abs(sl.line - home.get(sl))
    return c
  }
  const snap = () => slots.map(q => [q.line, q.region])
  const put = sn => slots.forEach((q, k) => { [q.line, q.region] = sn[k] })
  // (a team moves one line at most; an at-large First Four game can, the automatic ones stay on the 16 line)
  const canCross = q => !q.pair || !autos.has(q.team)
  const within1 = (q, line) => Math.abs(line - home.get(q)) <= 1 && (!q.pair || line >= home.get(q))   // (a First Four game only down)
  let cur = total()
  for (let pass = 0; pass < 12; pass++) {
    let better = false
    const tryMove = (p1, p2, move) => { const sn = snap(); move(); const c = total(); if (c < cur) { cur = c; better = true } else put(sn) }
    for (let line = 1; line < 16; line++) {   // (the 1 line stays as the S-curve has it: the overall No. 1 is the East's)
      const row = slots.filter(q => q.line === line)
      for (let x = 0; x < row.length; x++) for (let y = x + 1; y < row.length; y++) {
        const p1 = row[x], p2 = row[y]
        tryMove(p1, p2, () => { [p1.region, p2.region] = [p2.region, p1.region] })
      }
      // three on a line going round (what two swaps one at a time can't reach when each alone makes it worse)
      for (let x = 0; x < row.length; x++) for (let y = 0; y < row.length; y++) for (let z = 0; z < row.length; z++) {
        if (x === y || y === z || x === z || x > y || x > z) continue
        const p1 = row[x], p2 = row[y], p3 = row[z]
        tryMove(p1, p2, () => { [p1.region, p2.region, p3.region] = [p2.region, p3.region, p1.region] })
        tryMove(p1, p2, () => { [p1.region, p2.region, p3.region] = [p3.region, p1.region, p2.region] })
      }
    }
    for (let line = 2; line < 15; line++) {
      const up = slots.filter(q => q.line === line && canCross(q)), dn = slots.filter(q => q.line === line + 1 && canCross(q))
      for (const p1 of up) for (const p2 of dn) {
        if (p1.line !== line || p2.line !== line + 1 || !within1(p1, line + 1) || !within1(p2, line)) continue
        tryMove(p1, p2, () => { [p1.region, p2.region] = [p2.region, p1.region]; [p1.line, p2.line] = [p2.line, p1.line] })
      }
    }
    if (!better) break
  }
  // what's left of the hard rules (a first-round conference game; an early rematch in a league with fewer than nine
  // in): a team in one tries every place on its line and on the lines next to it, those lines tidied by swaps after,
  // and the best is kept if it's better
  const hard = () => confPairs.filter(([a, b, need, w]) => { const sa = slotOf[a], sb = slotOf[b]; if (sa.region !== sb.region) return false; const at = meetRound(sa.line + 1, sb.line + 1); return at === 1 || (at < need && w >= 1000) })
  const tidy = lines => {
    for (const line of lines) {
      if (line === 0) continue
      const row = slots.filter(q => q.line === line)
      for (let x = 0; x < row.length; x++) for (let y = x + 1; y < row.length; y++) {
        const p1 = row[x], p2 = row[y], before = total()
        ;[p1.region, p2.region] = [p2.region, p1.region]
        if (total() >= before) [p1.region, p2.region] = [p2.region, p1.region]
      }
    }
  }
  for (let round = 0; round < 8; round++) {
    const left = hard()
    if (!left.length) break
    let fixed = false
    for (const [a, b] of left) {
      for (const t of [b, a]) {
        const p1 = slotOf[t]
        if (p1.line === 0) continue
        const start = snap()
        let bestC = cur, bestSn = null
        for (const p2 of slots) {
          if (p2 === p1 || p2.line === 0 || Math.abs(p2.line - p1.line) > 1) continue
          if (p2.line !== p1.line && (!canCross(p1) || !canCross(p2) || Math.min(p1.line, p2.line) < 2 || !within1(p1, p2.line) || !within1(p2, p1.line))) continue
          const l1 = p1.line, l2 = p2.line
          ;[p1.line, p2.line] = [p2.line, p1.line]; [p1.region, p2.region] = [p2.region, p1.region]
          tidy([l1, l2])
          const c = total()
          if (c < bestC) { bestC = c; bestSn = snap() }
          put(start)
        }
        if (bestSn) { put(bestSn); cur = bestC; fixed = true; break }
      }
      if (fixed) break
    }
    if (!fixed) break
  }
  slots.forEach(sl => { sl.seed = sl.line + 1 })
  // what the committee couldn't meet (for the checks: scripts and QA), each an item
  const issues = []
  for (const [a, b, need, w] of confPairs) {
    const sa = slotOf[a], sb = slotOf[b]
    if (sa.region !== sb.region) continue
    const at = meetRound(sa.seed, sb.seed)
    if (at === 1 || at < need) issues.push({ kind: at === 1 ? 'first-round' : w < 1000 ? 'early (9+ league)' : 'early', a: T[a].short, b: T[b].short })
  }
  for (const sl of slots) if (sl.line !== home.get(sl)) issues.push({ kind: 'moved a line', a: T[sl.team].short, from: home.get(sl) + 1, to: sl.seed })
  const seedOf = {}, regionOf = {}
  for (const s of slots) for (const i of s.pair ?? [s.team]) { seedOf[i] = s.seed; regionOf[i] = s.region }
  const field = fieldIdx.map(i => ({ seed: seedOf[i], region: regionOf[i], short: T[i].short, rec: selRec[i], bid: autos.has(i) ? 'auto' : 'at-large', conf: T[i].confShort, firstFour: pairs.some(p => p.includes(i)), overall: trueSeed[i] }))
    .sort((a, b) => REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region) || a.seed - b.seed || a.overall - b.overall)
  const ncaaGames = []
  const ng = (round, region, a, b) => {
    const res = play(a, b, 'n', { day: NCAA_DAY[round], round, event: 'NCAA Tournament', region, seeds: seedOf, siteName: NCAA_SITE[round] ?? (region ? `${region} Regional` : null) })
    const hiA = seedOf[a] < seedOf[b] || (seedOf[a] === seedOf[b] && trueSeed[a] < trueSeed[b])
    const [hi, lo] = hiA ? [a, b] : [b, a]
    ncaaGames.push({ round, region, hi: T[hi].short, lo: T[lo].short, hiSeed: seedOf[hi], loSeed: seedOf[lo], hiSc: hiA ? res.aSc : res.bSc, loSc: hiA ? res.bSc : res.aSc, winner: T[res.winner].short, ot: res.ot })
    return res.winner
  }
  for (const s of slots) if (s.pair) s.team = ng('First Four', s.region, s.pair[0], s.pair[1])
  const ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15]
  const regionChamp = {}
  for (const region of REGIONS) {
    let alive = ORDER.map(sd => slots.find(s => s.region === region && s.seed === sd).team)
    for (const round of ['First Round', 'Second Round', 'Sweet 16', 'Elite Eight']) {
      const next = []
      for (let i = 0; i < alive.length; i += 2) next.push(ng(round, region, alive[i], alive[i + 1]))
      alive = next
    }
    regionChamp[region] = alive[0]
  }
  // the Final Four: the overall No. 1 seed's region (East) against the No. 4's (Midwest), the No. 2's (West) against the No. 3's (South)
  const f1 = ng('Final Four', null, regionChamp.East, regionChamp.Midwest), f2 = ng('Final Four', null, regionChamp.West, regionChamp.South)
  const champ = ng('National Championship', null, f1, f2)
  const ncaa = {
    field, lastFourIn: ffAL.map(i => T[i].short), firstFourOut: out4.map(i => T[i].short), games: ncaaGames, regions: REGIONS,
    finalFour: REGIONS.map(x => T[regionChamp[x]].short), champion: T[champ].short, runnerUp: T[champ === f1 ? f2 : f1].short, seedOf, fieldIdx, issues,
  }

  // ── The NIT (National Invitation Tournament), when his team was left out of the NCAA field ──
  // Its format as of 2026: 32 teams, four regions of eight seeded 1-8, single elimination. Exempt bids first: one to each
  // of the top twelve conferences by rating, two more each to the ACC and the SEC, each going to that conference's
  // best team not in the NCAA field; they are the regions' 1-4 seeds (best first, the S-curve) and host. Then the
  // automatic bids: a regular-season champion of any other conference that lost its tournament, missed the NCAA
  // field and rates in the country's top 125. The rest at-large, the best left. The first three rounds are on the
  // better seed's floor, the semifinals at Hinkle Fieldhouse and the final at Gainbridge Fieldhouse, Indianapolis.
  // (Every bid is taken here: the real ones some schools turn down, and the Big East, Big Ten and Big 12 send teams to
  // the College Basketball Crown instead.)
  let nit = null
  if (user && !fieldIdx.includes(user.idx)) {
    const out = all.filter(i => !fieldIdx.includes(i))
    const outSet = new Set(out), taken = new Set()
    const confRating = L.confs.map(c => ({ id: c.id, r: c.teams.reduce((s, i) => s + rate(i), 0) / c.teams.length })).sort((a, b) => b.r - a.r)
    const exempt = []
    for (const { id } of confRating.slice(0, 12)) {
      const n = 1 + (id === 'acc' || id === 'sec' ? 2 : 0)
      for (const i of out.filter(x => T[x].conf === id && !taken.has(x)).slice(0, n)) { exempt.push(i); taken.add(i) }
    }
    const top12 = new Set(confRating.slice(0, 12).map(c => c.id))
    const rk = Object.fromEntries(all.map((i, k) => [i, k + 1]))
    const autoN = []
    for (const c of L.confs) {
      if (top12.has(c.id)) continue
      const champ = standings[c.id].order[0]
      if (outSet.has(champ) && !autos.has(champ) && rk[champ] <= 125 && !taken.has(champ)) { autoN.push(champ); taken.add(champ) }
    }
    const rest = out.filter(i => !taken.has(i)).slice(0, Math.max(0, 32 - exempt.length - autoN.length))
    const pool = [...exempt, ...autoN, ...rest]
    // the seeds: the exempt teams (filled from the best of the others if there are fewer than 16) are 1-4, the rest 5-8
    const byBoard = xs => [...xs].sort((a, b) => rk[a] - rk[b])
    const topSeeds = byBoard(exempt).slice(0, 16)
    const others = byBoard(pool.filter(i => !topSeeds.includes(i)))
    while (topSeeds.length < 16) topSeeds.push(others.shift())
    const list = [...byBoard(topSeeds), ...others]
    const sd = {}, rg = {}
    list.forEach((i, k) => { const line = Math.floor(k / 4), j = k % 4; sd[i] = line + 1; rg[i] = line % 2 === 0 ? j : 3 - j })
    const regionName = r4 => `${T[list[r4]].school} Region`   // a region goes by its No. 1 seed's campus
    const NIT_ORDER = [1, 8, 4, 5, 3, 6, 2, 7]
    const names = ['First Round', 'Second Round', 'Quarterfinal', 'Semifinal', 'Championship']
    const days = [135, 139, 142, 150, 153]
    const before = post.length
    if (pool.includes(user.idx)) {
    const game = (k, a, b, region) => {
      const hiA = sd[a] < sd[b] || (sd[a] === sd[b] && rk[a] < rk[b]), host = hiA ? a : b
      const site = k < 3 ? (hiA ? 'a' : 'b') : 'n'
      const siteName = k < 3 ? (T[host].arena ? `${T[host].arena}, ${String(T[host].city ?? '').split(',')[0]}` : `at ${T[host].school}`) : k === 3 ? 'Hinkle Fieldhouse, Indianapolis' : 'Gainbridge Fieldhouse, Indianapolis'
      return play(a, b, site, { day: days[k] + (k < 3 && region % 2 ? 1 : 0), round: `NIT ${names[k]}`, event: 'NIT', seeds: sd, siteName, region: region == null ? null : regionName(region) }).winner
    }
    const regionWin = [0, 1, 2, 3].map(r4 => {
      let alive = NIT_ORDER.map(s => list.find(i => sd[i] === s && rg[i] === r4))
      for (let k = 0; k < 3; k++) { const next = []; for (let i = 0; i < alive.length; i += 2) next.push(game(k, alive[i], alive[i + 1], r4)); alive = next }
      return alive[0]
    })
    // the semifinals: the top No. 1 seed's region against the fourth's, as the NCAA's
    const s1 = game(3, regionWin[0], regionWin[3], null), s2 = game(3, regionWin[1], regionWin[2], null)
    const nitChamp = game(4, s1, s2, null)
    nit = { seed: sd[user.idx], region: regionName(rg[user.idx]), bid: exempt.includes(user.idx) ? 'exempt' : autoN.includes(user.idx) ? 'auto' : 'at-large', games: post.slice(before), won: nitChamp === user.idx, champion: T[nitChamp].short, size: pool.length, exempt: exempt.length, autoBids: autoN.length }
    }
  }
  return { oppD: seasonOf(L, season).oppD, S, T, N, polls, reg, post, regRec, selRec, standings, tourneys, autos, ncaa, nit, rank, rate, finalRec: T.map((_, i) => rec(i)) }
}

// ── Everyone else's season line (the award races, the leaders, the draft board) ──
const natPosOf = (attrs, pos) => (pos === 'big' ? ((attrs.size ?? 5) >= 8 ? 'C' : 'PF') : ((attrs.passing ?? 5) + (attrs.handles ?? 5) >= (attrs.jumpShot ?? 5) + (attrs.finishing ?? 5) ? 'PG' : (attrs.size ?? 5) >= 7 ? 'SF' : 'SG'))
const POS_AWARD = { PG: 'Bob Cousy Award', SG: 'Jerry West Award', SF: 'Julius Erving Award', PF: 'Karl Malone Award', C: 'Kareem Abdul-Jabbar Award' }
function candidates(L, R, user, seed) {
  const out = []
  for (const pos of ['guard', 'big']) {
    for (const p of L.players[pos]) {
      const t = L.byShort[p.team]
      if (!t) continue
      // (the man whose spot the build took comes off the bench)
      const benched = user && user.role !== 'bench' && user.barKey === `${p.name}|${p.team}`
      const starter = p.starter && !benched
      const rr = seeded(`cbb-line-${seed}-${p.name}-${p.team}`)
      const ln = lineOf(p.attrs, pos, starter ? 30 + rr() * 4 : 15 + rr() * 5)
      const f = clamp(0.8, 1.2, 1 - R.oppD[t.idx] / 55), wob = () => 1 + gauss(rr) * 0.06
      const gp = R.S[t.idx].n
      const tot = { gp, ppg: r1(ln.ppg * f * wob()), rpg: r1(ln.rpg * wob()), apg: r1(ln.apg * (0.6 + 0.4 * f) * wob()), spg: r1(ln.spg * wob()), bpg: r1(ln.bpg * wob()) }
      out.push({ name: p.name, team: p.team, teamName: t.school, conf: t.conf, confShort: t.confShort, pos, natPos: p.position ?? natPosOf(p.attrs, pos), year: p.year ?? null, ovr: p.ovr, attrs: p.attrs, starter, idx: t.idx, t: tot, isUser: false })
    }
  }
  if (user) {
    const t = L.teams[user.idx]
    out.push({ name: user.name, team: t.short, teamName: t.school, conf: t.conf, confShort: t.confShort, pos: user.pos, natPos: user.natPos, year: user.year, ovr: user.ovr, attrs: user.attrs, starter: user.role !== 'bench', idx: user.idx, t: user.totals, isUser: true })
  }
  return out
}
function runAwards(L, R, cands, seed, user) {
  const rA = seeded(`cbb-awards-${seed}`)
  const seedOf = R.ncaa.seedOf
  // (2026-11-12: a 17-4-8 guard won it. The winners score (Flagg 19-8-4, Edey 25-12, Garza 24-9, Zion 23-9, Brunson
  // 19 and 5 assists) or own the glass (Tshiebwe 17-15): points weigh most, a rebound at least what an assist does)
  const prod = c => 1.3 * c.t.ppg + 0.85 * c.t.rpg + 0.7 * c.t.apg + 0.9 * (c.t.spg + c.t.bpg)
  const teamTerm = c => { const s = R.S[c.idx]; return 9 * (s.w / Math.max(1, s.w + s.l) - 0.6) + (seedOf[c.idx] ? (17 - seedOf[c.idx]) * 0.28 : -1.5) }
  for (const c of cands) { c.prod = prod(c); c.score = c.starter ? c.prod + teamTerm(c) + 0.25 * (c.ovr - 85) + gauss(rA) * 0.9 : -99; c.line = lineText({ ppg: c.t.ppg, rpg: c.t.rpg, apg: c.t.apg }) }
  const out = c => ({ name: c.name, team: c.team, teamName: c.teamName, pos: c.natPos, conf: c.confShort, year: c.year, isUser: !!c.isUser, line: c.line, stats: c.t })
  const ranked = [...cands].sort((a, b) => b.score - a.score)
  // the Wooden: five finalists, the ballots as points (a first-place vote is worth five)
  const fin = ranked.slice(0, 5)
  const top = fin[0].score
  const w = fin.map(c => Math.exp((c.score - top) * 0.55))
  const sum = w.reduce((a, b) => a + b, 0)
  const VOTERS = 1000
  const ballot = fin.map((c, i) => ({ ...out(c), first: Math.round(VOTERS * 0.62 * (w[i] ** 1.6) / w.reduce((a, b) => a + b ** 1.6, 0)), pts: Math.round(VOTERS * 15 * w[i] / sum) }))
  const place = ranked.findIndex(c => c.isUser)
  const wooden = { award: 'Wooden Award', winner: out(fin[0]), finalists: ballot, ballot, userPlace: place >= 0 && place < 15 ? place + 1 : null, userFinalist: fin.some(c => c.isUser), userWon: !!fin[0].isUser }
  // the Naismith: its own voters, nearly always the same man
  const nz = ranked.slice(0, 3).map(c => ({ c, s: c.score + gauss(rA) * 0.5 })).sort((a, b) => b.s - a.s)[0].c
  const one = (award, list, key = c => c.score) => { const s = [...list].sort((a, b) => key(b) - key(a)); return s.length ? { award, winner: out(s[0]), finalists: s.slice(0, 5).map(out), userWon: !!s[0].isUser, userFinalist: s.slice(0, 5).some(c => c.isUser) } : null }
  const starters = cands.filter(c => c.starter)
  const dScore = c => (c.t.spg * 2.2 + c.t.bpg * 2) + 0.35 * ((c.attrs.perimeterDefense ?? c.attrs.interiorDefense ?? 5)) + (L.teams[c.idx].d) * 0.12
  const aa = { first: ranked.slice(0, 5).map(out), second: ranked.slice(5, 10).map(out), third: ranked.slice(10, 15).map(out), user: place >= 0 && place < 5 ? 'first' : place >= 5 && place < 10 ? 'second' : place >= 10 && place < 15 ? 'third' : null }
  const mine = user ? ranked.filter(c => c.conf === L.teams[user.idx].conf) : []
  const cplace = mine.findIndex(c => c.isUser)
  const confShort = user ? L.teams[user.idx].confShort : null
  const champIdx = L.byShort[R.ncaa.champion].idx
  const onChamp = starters.filter(c => c.idx === champIdx)
  return {
    wooden,
    naismith: { award: 'Naismith Trophy', winner: out(nz), finalists: ranked.slice(0, 4).map(out), userWon: !!nz.isUser, userFinalist: ranked.slice(0, 4).some(c => c.isUser) },
    posAward: user ? one(POS_AWARD[user.natPos], starters.filter(c => c.natPos === user.natPos)) : null,
    dpoy: one('Naismith Defensive Player of the Year', starters, dScore),
    freshman: one('Wayman Tisdale Award', starters.filter(c => c.year === 'FR')),
    allAmerica: aa,
    allConference: user ? { conf: confShort, first: mine.slice(0, 5).map(out), second: mine.slice(5, 10).map(out), user: cplace >= 0 && cplace < 5 ? 'first' : cplace >= 5 && cplace < 10 ? 'second' : null } : null,
    confPOY: user && mine.length ? { award: `${confShort} Player of the Year`, winner: out(mine[0]), userWon: !!mine[0].isUser, userFinalist: cplace >= 0 && cplace < 3 } : null,
    mop: onChamp.length ? one('Final Four Most Outstanding Player', onChamp, c => c.prod + (c.isUser ? 0 : 0)) : null,
  }
}

// ── NBA draft stock ──────────────────────────────────────────────────────────
// One board for every college player: his overall, his age (a freshman's season is worth five points of it, a
// senior's costs three), his production, his frame, the hardware. College players take about three of every four
// picks (the rest are international and G League), but most underclassmen on the board go back to school, so a
// player who does come out is picked a little ahead of his place on it.
const CLS_PTS = { FR: 5, SO: 2.5, JR: 0, SR: -3 }
const TIERS = [['top5', 5, 'Projected top-five pick', 1], ['lottery', 14, 'Projected lottery pick', 3], ['r1', 30, 'Projected first-round pick', 5], ['r2', 60, 'Projected second-round pick', 8]]
const tierOf = pick => TIERS.find(t => pick <= t[1]) ?? ['udfa', 999, 'Undrafted free agent', 0]
function draftBoard(cands, awards, user, career) {
  const mark = c => (c.isUser ? (awards.wooden.userWon ? 2 : awards.wooden.userFinalist ? 1 : 0) + (awards.allAmerica.user === 'first' ? 1 : 0) + (career?.wooden === 'won' ? 1 : 0) : 0)
  const bs = c => c.ovr + (CLS_PTS[c.year] ?? 0) + clamp(-2, 3, (c.prod - 20) * 0.2) + (c.pos === 'guard' ? ((c.attrs.size ?? 5) >= 7 ? 1 : (c.attrs.size ?? 5) <= 2 ? -1.5 : 0) : (c.attrs.size ?? 5) >= 9 ? 1 : 0) + mark(c) - (c.starter ? 0 : 6)
  const board = cands.map(c => ({ c, s: bs(c) })).sort((a, b) => b.s - a.s)
  // (eased 2026-11-12, as football's was: his place on the national board to a pick on a curve, not one for one. The 10th man
  // on the board is about the 6th pick, the 60th about the 19th, the 350th, an average starter, about the 58th. Straight off
  // his rank, an average wheel build went undrafted four times in five)
  // The mock draft is one player a pick, in board order: pick p goes to the man at the curve's place for it (the
  // rest of the board around him went back to school), and the build is always one of those who came out, at his
  // own place. So the board, his rank at his position, his pick and every row's tag agree (2026-11-12, QA: a No. 15
  // guard was the No. 9 pick and seven guards were tagged top five)
  const at = p => Math.round(Math.pow(p / 1.38, 1 / 0.638) - 1)   // the curve's board place for pick p
  const k = board.findIndex(x => x.c.isUser)
  const out = new Set()
  for (let p = 1, last = -1; p <= 60; p++) { const kk = Math.max(last + 1, at(p)); out.add(kk); last = kk }
  if (!out.has(k) && k < Math.max(...out)) {   // he declared: he takes the pick nearest his place, the man there goes back to school
    const near = [...out].reduce((m, x) => (Math.abs(x - k) < Math.abs(m - k) ? x : m))
    out.delete(near); out.add(k)
  }
  const declared = board.filter((x, i) => out.has(i) || i > Math.max(...out))
  const pickOf = new Map(declared.map((x, i) => [x, i + 1]))
  const pick = pickOf.get(board[k]) ?? 61, [tier, , label, half] = tierOf(pick)
  const row = x => ({ name: x.c.name, team: x.c.team, year: x.c.year, ovr: x.c.ovr, pos: x.c.natPos, isUser: !!x.c.isUser, tier: tierOf(pickOf.get(x))[0], pick: pickOf.get(x) <= 60 ? pickOf.get(x) : null, ppg: x.c.t.ppg, rpg: x.c.t.rpg, apg: x.c.t.apg })
  const samePos = declared.filter(x => x.c.pos === user.pos)
  const range = tier === 'udfa' ? null : [Math.max(1, pick - half), Math.min(60, pick + half)]
  const year = (user.season ?? 2026) + 1
  return {
    year: user.year, eligible: true, declares: tier !== 'udfa', tier, label, round: range ? [Math.ceil(range[0] / 30), Math.ceil(range[1] / 30)] : null, pick: range, overall: pick <= 60 ? pick : null,
    note: user.role === 'bench' ? 'A year off the bench: the scouts have seen little of him' : user.year === 'FR' && pick <= 14 ? 'A one-and-done grade' : user.year === 'SR' ? 'Out of eligibility: this is his draft' : null,
    draftYear: year, boardRank: samePos.findIndex(x => x.c.isUser) + 1, boardOf: samePos.length,
    board: samePos.slice(0, 25).map(row),
  }
}

// ── runCBBSimulation ─────────────────────────────────────────────────────────
export function runCBBSimulation(build, types = null, team = null, position = 'guard', rngSeed = null, gameMode = 'classic', script = null, opts = {}) {
  const pos = position === 'big' ? 'big' : 'guard'
  const ts = types ?? CBB_TYPES_BY_POS[pos]
  const L = cbbLeague(opts.pools ?? null)
  const short = typeof team === 'string' ? team : team?.short
  const T = L.byShort[short] ?? L.teams[0]
  const seed = String(rngSeed ?? 'cbb')
  const season = opts.season ?? 2026
  const attrs = Object.fromEntries(ts.map(t => [t, build?.[t]?.val ?? 5]))
  const ovr = calcCBBOVR(build, ts, pos)
  const role = opts.role === 'bench' ? 'bench' : 'starter'
  // whose minutes he takes: the last starter in his pool at the school
  const room = (L.rooms[T.short]?.[pos] ?? []).filter(p => p.starter)
  const bar = room.length ? room.reduce((a, b) => ((b.ovr ?? 0) < (a.ovr ?? 0) ? b : a)) : null
  const delta = role === 'bench' ? Math.max(0, ovr - 76) * 0.35 : ovr - (bar?.ovr ?? 76)
  const user = {
    idx: T.idx, pos, ovr, role, attrs, natPos: natPosOf(attrs, pos), name: opts.name ?? 'Guest', year: opts.year ?? 'FR', season,
    shift: clamp(-3, 9, delta * 0.22), line: lineOf(attrs, pos, role === 'bench' ? 17 : 32.5), r: seeded(`cbb-user-${seed}`), barKey: bar ? `${bar.name}|${bar.team}` : null,
  }
  const R = simulate(L, { seed, user, season })
  const confGames = R.post.filter(g => g.event !== 'NCAA Tournament' && g.event !== 'NIT')
  const totals = { regular: cbbSeasonTotals(R.reg), throughConf: cbbSeasonTotals([...R.reg, ...confGames]), full: cbbSeasonTotals([...R.reg, ...R.post]) }
  user.totals = { gp: totals.throughConf.gp, ppg: totals.throughConf.ppg, rpg: totals.throughConf.rpg, apg: totals.throughConf.apg, spg: totals.throughConf.spg, bpg: totals.throughConf.bpg }
  const cands = candidates(L, R, user, seed)
  const awards = runAwards(L, R, cands, seed, user)
  // the Most Outstanding Player is the build when his team cut the nets down and he carried it
  const ncaaMine = R.post.filter(g => g.event === 'NCAA Tournament')
  const inField = R.ncaa.fieldIdx.includes(T.idx)
  const champion = R.ncaa.champion === T.short
  if (champion && awards.mop) {
    const ff = cbbSeasonTotals(ncaaMine.slice(-2))
    const best = awards.mop.finalists.filter(x => !x.isUser)[0]
    const mine = ff.ppg + 0.8 * ff.rpg + 1.3 * ff.apg
    const his = best ? best.stats.ppg + 0.8 * best.stats.rpg + 1.3 * best.stats.apg : 0
    if (role !== 'bench' && mine >= his) awards.mop = { ...awards.mop, winner: { name: user.name, team: T.short, teamName: T.school, pos: user.natPos, isUser: true, line: lineText(ff), stats: ff }, userWon: true, userFinalist: true }
    else awards.mop = { ...awards.mop, userWon: false }
  }
  const draft = draftBoard(cands, awards, user, opts.career ?? null)
  // the national leaders in scoring (regular season, every starter in the eleven conferences)
  const starters = cands.filter(c => c.starter).map(c => (c.isUser ? { ...c, t: { ...c.t, ppg: totals.regular.ppg } } : c)).sort((a, b) => b.t.ppg - a.t.ppg)
  const leaders = { key: 'ppg', label: 'POINTS PER GAME', rows: starters.slice(0, 10).map(c => ({ name: c.name, team: c.team, year: c.year, isUser: !!c.isUser, value: c.t.ppg })), rank: starters.findIndex(c => c.isUser) + 1 || null, of: starters.length }

  const conf = L.confOf[T.conf]
  const st = R.standings[T.conf], tr = R.tourneys[T.conf]
  // the regular-season table carries the poll before the conference tournaments (the Final one knows their results)
  const finalPoll = R.polls.filter(p => !/^final/i.test(p.label)).pop() ?? R.polls[R.polls.length - 1]
  const apOf = Object.fromEntries(finalPoll.top25.map(x => [x.short, x.rank]))
  const myStanding = {
    id: conf.id, short: conf.short, name: conf.name,
    teams: st.order.map((i, k) => ({ short: L.teams[i].short, confW: R.S[i].cw, confL: R.S[i].cl, w: R.regRec[i].w, l: R.regRec[i].l, seed: k + 1, ap: apOf[L.teams[i].short] ?? null })),
    champion: L.teams[st.order[0]].short, champions: st.regChamps.map(i => L.teams[i].short), tourney: tr.champion,
  }
  const myTourney = confGames
  const exit = ncaaMine.length ? ncaaMine[ncaaMine.length - 1].round : null
  const mySeed = R.ncaa.seedOf[T.idx] ?? null
  const reg = R.reg
  const w = reg.filter(g => g.won).length, l = reg.length - w

  // the wire and the milestones, by games played
  const wire = [], miles = []
  let streak = 0, lastRank = null, seen = new Set()
  const once = (at, id, label, big = false) => { if (!seen.has(id)) { seen.add(id); miles.push({ at, id, label, big }) } }
  const nick = T.mascot ?? T.school
  reg.forEach((g, i) => {
    const at = i + 1
    streak = g.won ? streak + 1 : 0
    const opp = g.opponent
    if (g.won && g.meta.oppRank && g.meta.oppRank <= 10) wire.push({ at, text: `${T.school} takes down No. ${g.meta.oppRank} ${opp}, ${g.mySc}-${g.oppSc}` })
    else if (g.won && g.meta.oppRank) wire.push({ at, text: `${nick} beat No. ${g.meta.oppRank} ${opp}` })
    else if (!g.won && g.meta.myRank && !g.meta.oppRank) wire.push({ at, text: `${opp} upsets No. ${g.meta.myRank} ${T.school}` })
    if (g.pts >= 30) { wire.push({ at, text: `${user.name} goes for ${g.pts} ${g.home ? 'against' : 'at'} ${opp}` }); once(at, 'g-30', '30-point game', g.pts >= 40) }
    if (g.pts >= 40) once(at, 'g-40', '40-point game', true)
    const dbl = [g.pts, g.reb, g.ast, g.stl, g.blk].filter(x => x >= 10).length
    if (dbl >= 3) { wire.push({ at, text: `Triple-double for ${user.name}: ${g.pts} points, ${g.reb} rebounds, ${g.ast} assists` }); once(at, 'td', 'Triple-double', true) }
    if (g.reb >= 15) once(at, 'g-15r', '15-rebound game')
    if (g.ast >= 10) once(at, 'g-10a', '10-assist game')
    if (g.blk >= 5) once(at, 'g-5b', 'Five blocks in a game')
    if (streak === 8 && !seen.has('streak-8')) { wire.push({ at, text: `Eight straight for the ${nick}` }); once(at, 'streak-8', 'Eight straight wins') }
    if (streak === 14) once(at, 'streak-14', '14 straight wins', true)
    const wins = reg.slice(0, at).filter(x => x.won).length
    if (wins === 20) once(at, 'wins-20', '20 wins')
    if (wins === 25) once(at, 'wins-25', '25 wins', true)
    if (at === 12 && wins === 12) once(at, 'start-12-0', '12-0 start', true)
    const rk = g.meta.myRank
    if (rk && !lastRank && i > 0) wire.push({ at, text: `${T.school} is ranked: No. ${rk} in the AP Top 25` })
    if (rk === 1 && lastRank !== 1) { wire.push({ at, text: `${T.school} is No. 1 in the country` }); once(at, 'no1', 'No. 1 in the AP poll', true) }
    lastRank = rk
  })
  if (myStanding.champions.includes(T.short)) { wire.push({ at: reg.length, text: `${T.school} wins the ${conf.short} regular-season title` }); once(reg.length, 'conf-reg', `${conf.short} regular-season champions`, true) }

  // (a game score: points first, then the rest; 16-8-7 used to beat a 25-point night)
  const gsc = g => g.pts + 0.45 * g.reb + 0.55 * g.ast + 1.1 * (g.stl + g.blk) - 0.5 * (g.tov ?? 0)
  const bestGame = role === 'bench' ? null : reg.reduce((b, g) => (!b || gsc(g) > gsc(b) ? g : b), null)
  const t = totals.regular
  const arch = (pos === 'big' ? getBucketBigArchetype : getBucketGuardArchetype)(ovr, build, ts)
  return {
    sport: 'cbb', position: pos, gameMode, seed, team: { ...T }, ovr, archetype: arch, wins: w, losses: l, role, starterName: role === 'bench' ? bar?.name ?? null : null, year: season,
    games: reg, bestGame, ppg: t.ppg, rpg: t.rpg, apg: t.apg, spg: t.spg, bpg: t.bpg, tov: t.topg, fgPct: t.fgPct, threePct: t.tpPct, ftPct: t.ftPct,
    playoffs: inField, champion, award: { userWins: awards.wooden.userWon, name: 'Wooden Award' },
    cbb: {
      record: { w, l, confW: R.S[T.idx].cw, confL: R.S[T.idx].cl, selection: R.selRec[T.idx], final: R.finalRec[T.idx] },
      conf: { id: conf.id, short: conf.short, name: conf.name },
      postseason: R.post,
      confTourney: { title: tr.title, site: tr.site, seed: tr.seedOf[T.idx] ?? null, rounds: tr.rounds, champion: tr.champion, played: myTourney.length, won: tr.champion === T.short },
      confChamp: tr.champion === T.short, confRegChamp: myStanding.champions.includes(T.short),
      ncaa: { ...R.ncaa, seedOf: undefined, fieldIdx: undefined, seed: mySeed, region: inField ? R.ncaa.field.find(f => f.short === T.short)?.region ?? null : null, bid: inField ? (R.autos.has(T.idx) ? 'auto' : 'at-large') : null, exit },
      nit: R.nit,
      totals, ap: R.polls, apPath: R.polls.map(p => ({ label: p.label, rank: p.myRank, rec: p.top25.find(x => x.short === T.short)?.rec ?? null })),
      myStanding, awards, leaders, draft, wire, milestones: miles,
      user: { name: user.name, year: user.year, attrs, types: ts, pos, natPos: user.natPos },
    },
  }
}
