// ─── Baseball Simulation Engine (Batter / Pitcher) ──────────────────────────
// The fourth sport's season engine: a BATTER ('bat') or a PITCHER ('pit') build dropped into a real club,
// CURRENT (2026 rosters, mode 'current') or ALL-TIME (franchise legends, mode 'alltime'). The other engines
// are the model (utils/bucketSimulation.js, utils/soccerSimulation.js): the same call shape, the same top-level
// result fields, a seeded RNG so the live server can play a season back from its seed (lib/verifyCore.js), and a
// `script` (scriptBaseballSeason) so Squad Builder can play one season for a whole squad.
//
// ── How a season is played ───────────────────────────────────────────────────
// 1. The build's ten traits make a hitter's or a pitcher's profile (batProfile / pitProfile): his strikeout and
//    walk rates, home runs per ball put in play, BABIP, his doubles and triples, his speed on the bases (steals,
//    first to third, staying out of double plays); a pitcher's strikeouts, walks, home runs, contact quality,
//    ground balls, how deep he goes (stamina is his pitch count) and how he holds up with men on (composure).
// 2. He takes the place of the club's real man (`starter: true`: the cleanup hitter, the ace; a reliever build
//    takes the closer's job, or the setup man's when the real closer is better). The club's off/def (1-10) is its
//    strength WITH that man, so the rest of the lineup and the staff are solved to play at exactly that level, and
//    the team scores and allows more or fewer runs by how much better or worse the build is than him.
// 3. Every one of the club's 162 games is played plate appearance by plate appearance (playGame): the matchup of
//    batter and pitcher by the odds-ratio method (Tango's log5), the bases and outs, double plays, sac flies,
//    steals, wild pitches, the times-through-the-order penalty, pitch counts and the hook, the bullpen, the
//    automatic runner in extra innings and walk-offs. His line, the score and the decisions (W, L, SV, HLD) all come
//    out of the same plate appearances, so they always add up. The rest of the league's 2,268 games are played
//    from a negative-binomial run model on the same team ratings.
// 4. The real schedule format (2023-): 13 games against each division rival, 6 or 7 against the rest of the league,
//    46 interleague (4 against the natural rival). Then the 12-team postseason: three division winners and three
//    wild cards a league, byes for the top two seeds, the Wild Card Series (best of 3, all at the higher seed), the
//    Division Series (best of 5, 2-2-1), the LCS and the World Series (best of 7, 2-3-2). Every postseason game
//    is simulated; his series are played plate appearance by plate appearance, with his line in each.
// 5. The awards race him against a simulated field: every real player in the data plays a season around his own
//    profile and his club's simulated year (fieldBatter / fieldPitcher), and the awards are decided the way the
//    voters and the leaders tables decide them (MVP, Cy Young, Rookie of the Year, Silver Slugger, Gold Glove,
//    All-Star, All-MLB, Hank Aaron Award, Reliever of the Year, the batting title and the leaders, the Triple Crown,
//    LCS and World Series MVP).
//
// ── Real numbers the engine is tuned to ──────────────────────────────────────
// League batting, Baseball-Reference "MLB Batting Year-by-Year Averages" (per team game):
//   2024: 4.39 R/G, .243/.312/.399; 2025: 4.45, .245/.315/.404; 2026: 4.48, .244/.318/.400.
//   The CURRENT environment is their average: 4.44 R/G, .244/.315/.401, per PA: K 22.3%, BB 8.5%, HBP 1.1%,
//   HR 3.03%, 2B 4.19%, 3B 0.36%, 1B 14.2%, SF 0.70%; 0.71 SB and 0.20 CS a team game; league ERA 4.13 (B-R
//   pitching averages 4.07 / 4.15 / 4.17), 8.87 IP a team game.
//   ALL-TIME: an era-neutral league, the average of B-R's 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2015 and 2019
//   seasons: 4.52 R/G, .259/.329/.405, K 16.0%, BB 8.8%, HBP 0.7%, HR 2.5%, 2B 4.15%, 3B 0.59%, 1B 15.8%.
// Linear weights, FanGraphs Guts (2024-26 average): wBB .693, wHBP .724, w1B .885, w2B 1.256, w3B 1.590,
//   wHR 2.045, wOBA scale 1.237; runSB +.200, runCS -.409; runs per win 9.68-9.82 (FanGraphs: 9 x R/IP x 1.5 + 3);
//   cFIP 3.10-3.17. Positional adjustments (FanGraphs, runs per 162 games): C +12.5, SS +7.5, 2B/3B/CF +2.5,
//   LF/RF -7.5, 1B -12.5, DH -17.5. Replacement level: 1,000 WAR a season, 57% to position players
//   (about 20 runs per 600 PA); pitchers' replacement .12 wins per 9 IP for starters, .03 for relievers.
// Team strength: team runs a game across MLB spread about 0.42 (2024-26, B-R team batting), so one spread of the
//   data's off/def ratings is that much; home teams win about 52-53% (B-R 2023-25).
// Star tiers (Baseball-Reference / FanGraphs):
//   elite hitters: Aaron Judge 2024 .322/.458/.701, 58 HR, 144 RBI, 10.8 bWAR; 2025 .331/.457/.688, 53 HR, 9.7 bWAR.
//     Shohei Ohtani 2024 .310/.390/.646, 54 HR, 59 SB, 9.2 bWAR. Bobby Witt Jr. 2024 .332/.389/.588, 32 HR, 31 SB,
//     9.4 bWAR. Juan Soto 2024 .288/.419/.569, 41 HR. Cal Raleigh 2025: 60 HR. So an elite bat (A grades) here
//     is about .300/.400/.600 with 40+ HR and 7-10 WAR; S grades reach Judge's years.
//   average regular: about .250/.320/.410, 18-22 HR, 2-3 WAR (OPS+ ~100-105); a poor one .220/.280/.340, ~0 WAR.
//   aces: Tarik Skubal 2024 18-4, 2.39 ERA, 192 IP, 228 K, 2.49 FIP; 2025 13-6, 2.21 ERA, 195.1 IP, 241 K.
//     Paul Skenes 2025 1.97 ERA, 187.2 IP, 216 K. Garrett Crochet 2025 18-5, 2.59 ERA, 205.1 IP, 255 K. Chris Sale
//     2024 18-3, 2.38 ERA, 225 K. So an ace here is about a 2.50 ERA, 200+ IP, 230+ K and 6-8 WAR.
//   average starter: ~4.10-4.30 ERA, 160-175 IP, ~150 K, 2 WAR. A healthy starter makes 30-33 starts.
//   closers: Emmanuel Clase 2024 47 SV, 0.61 ERA in 74 G; an elite closer 60-70 appearances, 35-45 saves on a
//     good club, 30-40% strikeouts, 2-3 WAR.
// The playoff line: the last wild card won 86 / 87 (2022 AL/NL), 89 / 84 (2023), 86 / 89 (2024), 87 / 83 (2025),
//   87 / 88 (2026): about 86-87 wins (B-R standings). The best record usually 98-104, the worst 55-65.
//
// ── Exports ──────────────────────────────────────────────────────────────────
//   BAT_TRAITS, PIT_TRAITS, BAT_OVR_WEIGHTS, SP_OVR_WEIGHTS, RP_OVR_WEIGHTS, BASEBALL_COUNTS
//   calcBaseballOVR(build, types, position)            → 0-99 (position 'bat' | 'pit', or a role 'SP' | 'RP' | 'CL')
//   baseballPitchRole(build)                            → 'SP' | 'RP' (stamina B- or better starts)
//   getBaseballArchetype(ovr, build, types, position)   → 'Five-Tool Superstar', 'Frontline Ace', 'Lockdown Closer'…
//   runBaseballSimulation(build, types, team, position = 'bat', mode = 'current', rngSeed = null, gameMode = 'classic', script = null)
//   scriptBaseballSeason(team, tr, rngSeed, mode = 'current') → a season for a squad (see `script` below)
//   baseballTotals(games, position, result)             → the season line again from games (the director's splices)
//   rebookBaseball(result, games)                       → the season booked again from games as played: the record,
//                                                         the standings row, his line, WAR and every award
//   baseballAwards(result, me)                          → the awards from the book for a new line
//   baseballBuildLift(build, team, position, mode)      → { off, def, replaced, role }: his club's ratings with him in
//   baseballTeam10(team, mode) / baseballTeamOf(short, mode) → a club's off/def (1-10) and data row
//   baseballEngineCheck(mode, games, seed, off, def)    → the league line the engine makes (scripts/baseball/*)
//
// `team`: a club from MLB_TEAMS (at least { short }).
//   team.offMod / team.defMod: the season director's moments (±1 on the 1-10 scale each).
//   team.career + team.off / team.def (1-10): Career's own team. team.usage (0-1): the share of games he starts;
//   team.bench: a backup; team.role: his position ('SS', 'CF'… or 'SP' | 'RP' | 'CL'); team.order (1-9): his spot in
//   the lineup; team.replaces: the real player he replaces (a name; false: nobody, he's an addition);
//   (team.career also skips his own injured-list stint: Career books his injuries by durability)
//   team.rookie: Rookie of the Year eligibility (else age 23 or under); team.age; team.year: the schedule's year
//   (Career passes its season so every year has its own schedule; a one-off season has 2026's shape).
//   team.slot (0-4): a starter's turn in the rotation (a squad's starters take different days; 0, the ace, by default).
//   team.spent: [{ r, rbi }] a game (script mode): the runs and RBI squad-mates before him already took.
//   team.exclude: names left out of the award field ('bat:Name' / 'pit:Name' for one half of a two-way player).
//   team.fast: no award field, awards, leaders or series MVPs (result.awards null): the season director's re-runs;
//   rebookBaseball builds the book from the same world and streams, so the booked season's awards are the same.
//   (The data's off/def are centred on their own league average, so the league scores its real runs.)
// rngSeed: a number or a string. The same build, team, position, mode and seed always play the same season.
//
// ── The result ───────────────────────────────────────────────────────────────
// {
//   sport: 'baseball', mode, position: 'bat' | 'pit', role, gameMode, season: '2026' | 'All-Time', ovr, archetype,
//   team: { ...club, off, def, lg, div },                     // off/def as played (the director's moments in)
//   // basketball's fields
//   wins, losses, games: [game] (162), gameLog: ['W' | 'L'], bestGame, conference (= league), seed (playoff seed
//   1-6, else the league rank), standings (his league, best first), madePlayoffs, playoffs, playoffRounds, champion
//   (won the World Series), mvp (bool), dpoy: false, finalsOpp, finalsSeries ('4-2', the World Series),
//   // the club's season
//   league: 'AL' | 'NL', division, pct, gb, rs, ra, runDiff, home: { w, l }, away: { w, l }, leagueRank, divRank,
//   divisionTitle, wildCard, hasBye, pennant, eliminatedIn, divisions: { AL: { East: [row] … }, NL }, wildCardRace:
//   { AL: [row], NL }, bracket: { AL: { wc: [series], ds, cs }, NL, ws }, wsWinner, pennants: { AL, NL },
//   teamStats: { g, rs, ra, rsPerG, raPerG, pa, ab, h, doubles, triples, hr, bb, k, sb, cs, avg, obp, slg, era, whip,
//                kPitching, hrAllowed } (his club's games, both ways; a script's season: the runs only),
//   replaced: { name, role } | null (the real man he replaced), asbCut (games before the All-Star break),
//   // his line (bat): g, gs, pa, ab, h, doubles, triples, hr, rbi, runs, bb, k, hbp, sf, sb, cs, gidp, avg, obp, slg,
//   //   ops, opsPlus, woba, babip, iso, kPct, bbPct, war, battingRuns, baserunning, fielding, posAdj, multiHR, cycles,
//   //   grandSlams, walkoffs, hitStreak, pos, order
//   // his line (pit): w, l, era, g, gs, outs (= ipOuts), ip ('201.1'), ipDec, h, r, er, bb, k, hr, hbp, bf, pitches,
//   //   whip, sv, svo, hld, bs, qs, cg, sho, noHitters, fip, eraPlus, k9, bb9, hr9, kPct, bbPct, war
//   line: { the spec's display line: G PA AB H 2B 3B HR RBI R BB K SB AVG OBP SLG OPS OPS+ WAR, or
//           W-L ERA G GS IP K BB WHIP SV FIP WAR },
//   seasonG … (the director's totals: BASEBALL_COUNTS keys),
//   postseason: { games: [game], line, series: [{ name, opp, won, wins, losses, line }] },
//   awards: { mvp, cyYoung, roy, silverSlugger, goldGlove, allStar, allMLB, hankAaron, reliever, battingTitle,
//             hrLeader, rbiLeader, sbLeader, kLeader, winsLeader, eraTitle, svLeader, tripleCrown, lcsMvp, wsMvp },
//     each: { won, rank, finish?, eligible?, winner: entry, top: [entry], other: { winner } (the other league's) },
//   leaders: { AL: { avg, hr, rbi, sb, ops, w, era, k, sv: [entry x5] }, NL },
//   playoffSeed (1-6 | null), book,                           // the field, for rebookBaseball / baseballAwards
// }
// (A season is ~150-290 KB: the book's field is ~130 KB and the 162 games ~75 KB. Keep `book` only as long as a
// rebook may come; Career can keep games and the line.)
// game: { g, wk, day, date ('Apr 3'), iso ('2026-04-03'), home, opponent, oppName, mySc, oppSc, won, result: 'W' | 'L', innings,
//         walkoff (his club won it in its last at-bat), walkedOff (lost one that way), series: [n, of], oppSP, ourSP
//         (the starters' names; null for a club's spot starter), ps: null | 'ALDS'…, sat (not in the lineup / not his
//         day; a hitter's `reason`: 'IL' | 'REST') and his line:
//   bat: gp, gs, order, pos, pa, ab, h, doubles, triples, hr, rbi, r, bb, k, hbp, sf, sb, cs, gidp, tb, cycle, slam, wo
//   pit: app, gs, outs, ip, bf, pitches, h, r, er, bb, k, hr, hbp, w, l, sv, hld, bs, qs, cg, sho, nh, dec }
// series (playoffRounds): { type: 'series', name, short, roundIndex, bestOf, opponent: { short, name, seed, wins,
//   losses }, mySeed, homeField, won, wins, losses, games: [game], log: ['W' | 'L'], line } ·
//   a bye: { type: 'bye', name: 'Wild Card Series', short, roundIndex: 0, won: true }
// entry (award races, leaders): { name, team, lg, role, …stats, isPlayer } — the build's entry has name null and
//   isPlayer true: the page labels him with the username (never "You").
//
// ── `script` (Squad Builder) ──────────────────────────────────────────────────
// scriptBaseballSeason(team, { off, def }, seed) plays the season once at the squad's strength (1-10): every score,
// the standings, the postseason and the award field. runBaseballSimulation(build, …, script) then plays this build's
// line inside it: the scores never change; his line is drawn game by game from his profile against that day's
// starter, and his runs and RBI never pass his club's runs (team.spent: [{ r, rbi }] per game, what squad-mates
// before him already took). A pitcher takes his turn every fifth game; his runs allowed never pass the other side's.

import { seeded } from '../lib/rng'
import * as TEAM_DATA from '../data/mlb-teams'
import * as BAT_DATA from '../data/mlb-batters'
import * as PIT_DATA from '../data/mlb-pitchers'
import * as LEG_BAT_DATA from '../data/mlb-legend-batters'
import * as LEG_PIT_DATA from '../data/mlb-legend-pitchers'

export const BAT_TRAITS = ['contact', 'power', 'eye', 'avoidK', 'gap', 'speed', 'baserunning', 'fielding', 'arm', 'clutch']
export const PIT_TRAITS = ['velocity', 'movement', 'breaking', 'changeup', 'control', 'command', 'stamina', 'groundball', 'composure', 'pitchIQ']

// ─── Small helpers ───────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const r1 = v => Math.round(v * 10) / 10
const r2 = v => Math.round(v * 100) / 100
const r3 = v => Math.round(v * 1000) / 1000
const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d)
function gauss(rand) { const u = 1 - rand(), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
function poisson(l, rand) {
  if (!(l > 0)) return 0
  if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss(rand)))
  const L = Math.exp(-l)
  let k = 0, p = rand()
  while (p > L) { k++; p *= rand() }
  return k
}
function gammaDraw(k, rand) {   // Marsaglia & Tsang (k >= 1)
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d)
  for (let i = 0; i < 50; i++) {
    let x, v
    do { x = gauss(rand); v = 1 + c * x } while (v <= 0)
    v = v * v * v
    const u = rand()
    if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
  return k
}
const negbin = (mean, r, rand) => poisson((gammaDraw(r, rand) * mean) / r, rand)
function binom(n, p, rand) {
  n = Math.max(0, Math.round(n))
  if (!n || !(p > 0)) return 0
  if (p >= 1) return n
  if (p > 0.5) return n - binom(n, 1 - p, rand)
  const m = n * p
  if (m < 14) {   // waiting times between successes
    const lq = Math.log(1 - p)
    let k = 0, i = 0
    for (;;) { i += Math.floor(Math.log(1 - rand()) / lq) + 1; if (i > n) return k; k++ }
  }
  return clamp(Math.round(m + Math.sqrt(m * (1 - p)) * gauss(rand)), 0, n)
}
function shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
// A season's random streams: each part of the season draws from its own (the schedule, his club's games, the rest of
// the league, his days off, the postseason, the field, the voters), so one part never shifts another. No seed: a
// random one, drawn once. The schedule doesn't follow the seed at all (a year has one schedule), so the season
// director's re-run stretches keep every game's opponent and date.
const seedBase = rngSeed => (rngSeed == null ? `x${Math.floor(Math.random() * 4294967296)}` : `s${rngSeed}`)
const stream = (base, tag) => seeded(`${base}|${tag}`)
const fmtRate = v => (v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, ''))   // .312, 1.045
const ipText = outs => `${Math.floor(outs / 3)}.${outs % 3}`

// ─── OVR ─────────────────────────────────────────────────────────────────────
// A position player's value is mostly his bat: on-base and power are what wOBA and WAR weigh (contact and power the
// most, then the eye: FanGraphs' wRC+ is built on them), then strikeout avoidance and gap power, then the glove
// (defence is about a sixth of a regular's WAR), speed and the rest. A starter's value is stuff and command over
// innings: velocity, the breaking ball and movement drive strikeouts (Statcast's whiff rates), control and command
// the walks and the barrels, stamina the innings (an ace's WAR is half innings). A reliever's is nearly all stuff
// and nerve: one inning, maximum effort. Same scale as the other sports (grades 0-11: A = 96, B+ = 86, B = 81,
// B- = 77), so an elite player (mostly A and A+) lands 93-99, an average regular (B/B+) 78-84.
export const BAT_OVR_WEIGHTS = { contact: 0.17, power: 0.17, eye: 0.13, avoidK: 0.10, gap: 0.09, fielding: 0.09, speed: 0.08, arm: 0.06, baserunning: 0.05, clutch: 0.06 }
export const SP_OVR_WEIGHTS = { velocity: 0.13, breaking: 0.12, movement: 0.12, command: 0.12, stamina: 0.12, control: 0.11, changeup: 0.08, composure: 0.07, pitchIQ: 0.07, groundball: 0.06 }
export const RP_OVR_WEIGHTS = { velocity: 0.17, breaking: 0.15, movement: 0.13, command: 0.11, composure: 0.11, control: 0.10, pitchIQ: 0.07, groundball: 0.07, changeup: 0.05, stamina: 0.04 }
const PITCH_ROLES = new Set(['SP', 'RP', 'CL'])
const posOf = (position, types) => {
  const p = String(position ?? '').toLowerCase()
  if (p === 'bat' || p === 'batter' || p === 'b' || p === 'hitter') return 'bat'
  if (p === 'pit' || p === 'pitcher' || p === 'p' || PITCH_ROLES.has(String(position ?? '').toUpperCase())) return 'pit'
  return (types ?? []).includes('velocity') ? 'pit' : 'bat'
}
// a pitcher who can go deep (stamina B- or better) starts; below that he works out of the bullpen
export const baseballPitchRole = build => {
  const s = build?.stamina?.val
  return s == null || s >= 5 ? 'SP' : 'RP'
}
export function calcBaseballOVR(build, types, position) {
  const pos = posOf(position, types)
  const t = types?.length ? types : pos === 'pit' ? PIT_TRAITS : BAT_TRAITS
  const forced = String(position ?? '').toUpperCase()
  const role = PITCH_ROLES.has(forced) ? (forced === 'SP' ? 'SP' : 'RP') : baseballPitchRole(build)
  const W = pos === 'bat' ? BAT_OVR_WEIGHTS : role === 'SP' ? SP_OVR_WEIGHTS : RP_OVR_WEIGHTS
  let sum = 0, wt = 0
  for (const k of t) {
    if (!build?.[k]) continue
    const v = build[k].val ?? 0
    const w = W[k] ?? 1 / t.length
    sum += v * w
    wt += w
  }
  if (!wt) return 0
  return Math.min(99, Math.round(57 + ((sum / wt - 1) / 9) * 44))
}
const buildOfAttrs = (attrs, keys) => Object.fromEntries(keys.map(k => [k, { val: attrs?.[k] ?? 5 }]))

// ─── The data, read once ─────────────────────────────────────────────────────
const arrOf = (mod, names, test) => {
  for (const n of names) if (Array.isArray(mod?.[n])) return mod[n]
  return Object.values(mod ?? {}).find(v => Array.isArray(v) && v.length && test(v[0])) ?? []
}
const isPlayer = x => x && typeof x.name === 'string' && x.attrs
const RAW_TEAMS = arrOf(TEAM_DATA, ['MLB_TEAMS'], x => x && typeof x.short === 'string')
const RAW = {
  current: { bat: arrOf(BAT_DATA, ['MLB_BATTERS'], isPlayer), pit: arrOf(PIT_DATA, ['MLB_PITCHERS'], isPlayer) },
  alltime: {
    bat: arrOf(LEG_BAT_DATA, ['MLB_LEGEND_BATTERS', 'MLB_BATTER_LEGENDS', 'MLB_ALLTIME_BATTERS', 'LEGEND_BATTERS'], isPlayer),
    pit: arrOf(LEG_PIT_DATA, ['MLB_LEGEND_PITCHERS', 'MLB_PITCHER_LEGENDS', 'MLB_ALLTIME_PITCHERS', 'LEGEND_PITCHERS'], isPlayer),
  },
}
// club codes as the data might spell them (Retrosheet / B-R / ESPN), to the one each club is known by here
const ALIAS = { AZ: 'ARI', OAK: 'ATH', CHW: 'CWS', CHA: 'CWS', KCR: 'KC', KCA: 'KC', SDP: 'SD', SDN: 'SD', SFG: 'SF', SFN: 'SF', TBR: 'TB', TBA: 'TB', TBD: 'TB', WSN: 'WSH', WAS: 'WSH', MON: 'WSH', ANA: 'LAA', CAL: 'LAA', LAN: 'LAD', NYA: 'NYY', NYN: 'NYM', CHN: 'CHC', SLN: 'STL', FLA: 'MIA', SEP: 'MIL', BRO: 'LAD', NYG: 'SF', BSN: 'ATL', MLN: 'ATL', PHA: 'ATH', KCAT: 'ATH', SLB: 'BAL', WSA: 'MIN', WS2: 'TEX' }
const canon = s => { const u = String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return ALIAS[u] ?? u }
const HOME = {
  BAL: 'AL East', BOS: 'AL East', NYY: 'AL East', TB: 'AL East', TOR: 'AL East', CLE: 'AL Central', CWS: 'AL Central', DET: 'AL Central', KC: 'AL Central', MIN: 'AL Central',
  ATH: 'AL West', HOU: 'AL West', LAA: 'AL West', SEA: 'AL West', TEX: 'AL West', ATL: 'NL East', MIA: 'NL East', NYM: 'NL East', PHI: 'NL East', WSH: 'NL East',
  CHC: 'NL Central', CIN: 'NL Central', MIL: 'NL Central', PIT: 'NL Central', STL: 'NL Central', ARI: 'NL West', COL: 'NL West', LAD: 'NL West', SD: 'NL West', SF: 'NL West',
}
// the natural rivals (4 interleague games a year since 2023)
const RIVAL = { NYY: 'NYM', BOS: 'ATL', TB: 'MIA', TOR: 'PHI', BAL: 'WSH', CWS: 'CHC', CLE: 'CIN', DET: 'PIT', KC: 'STL', MIN: 'MIL', HOU: 'COL', LAA: 'LAD', ATH: 'SF', SEA: 'SD', TEX: 'ARI' }
const DIVS = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West']
const normLg = (x, c) => { const s = String(x ?? '').toLowerCase(); return /^n|national/.test(s) ? 'NL' : /^a|american/.test(s) ? 'AL' : HOME[c]?.slice(0, 2) ?? 'AL' }
const normDiv = (x, c) => { const s = String(x ?? '').toLowerCase(); return /east/.test(s) ? 'East' : /cent/.test(s) ? 'Central' : /west/.test(s) ? 'West' : HOME[c]?.slice(3) ?? 'East' }
const TEAMS = RAW_TEAMS.filter(t => t?.short).map((t, i) => { const c = canon(t.short); return { ...t, i, c, lg: normLg(t.league, c), div: normDiv(t.division, c), off: num(t.off, 5.5), def: num(t.def, 5.5) } })
const shapeOk = () => { const m = {}; for (const t of TEAMS) (m[`${t.lg} ${t.div}`] ??= []).push(t); return TEAMS.length === 30 && Object.keys(m).length === 6 && Object.values(m).every(a => a.length === 5) }
if (!shapeOk()) for (const t of TEAMS) if (HOME[t.c]) { t.lg = HOME[t.c].slice(0, 2); t.div = HOME[t.c].slice(3) }
if (!shapeOk()) TEAMS.slice().sort((a, b) => (a.short < b.short ? -1 : 1)).forEach((t, k) => { const d = DIVS[Math.floor(k / 5) % 6]; t.lg = d.slice(0, 2); t.div = d.slice(3) })
const N = TEAMS.length
const TEAM_BY = new Map(TEAMS.map(t => [t.short, t]))
const CANON_BY = new Map(TEAMS.map(t => [t.c, t]))
const teamKey = s => TEAM_BY.get(s) ?? CANON_BY.get(canon(s)) ?? null
const BAT_ROLES = new Set(['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'])
const batRoleOf = r => { const u = String(r ?? '').toUpperCase(); return BAT_ROLES.has(u) ? u : u === 'OF' ? 'LF' : u === 'IF' || u === 'UT' ? '2B' : u === 'P' ? 'DH' : 'DH' }
const pitRoleOf = r => { const u = String(r ?? '').toUpperCase(); return u === 'CL' || u === 'CP' || u === 'CLOSER' ? 'CL' : u === 'RP' || u === 'SU' || u === 'MR' || u === 'RHP' && false ? 'RP' : u === 'SP' || u === 'P' ? 'SP' : 'SP' }
function byTeam(list, kind) {
  const m = new Map()
  for (const p of list ?? []) {
    const t = teamKey(p?.team)
    if (!t || !isPlayer(p)) continue
    const q = { ...p, team: t.short, role: kind === 'bat' ? batRoleOf(p.role) : pitRoleOf(p.role), kind }
    if (!m.has(t.short)) m.set(t.short, [])
    m.get(t.short).push(q)
  }
  return m
}
const PLAYERS = { current: { bat: byTeam(RAW.current.bat, 'bat'), pit: byTeam(RAW.current.pit, 'pit') }, alltime: { bat: byTeam(RAW.alltime.bat, 'bat'), pit: byTeam(RAW.alltime.pit, 'pit') } }
const NAME_AGE = new Map([...RAW.current.bat, ...RAW.current.pit, ...RAW.alltime.bat, ...RAW.alltime.pit].filter(p => typeof p?.age === 'number').map(p => [p.name, p.age]))

// ─── The run environments ────────────────────────────────────────────────────
// (per plate appearance; see the header for the sources)
const W = { bb: 0.693, hbp: 0.724, b1: 0.885, b2: 1.256, b3: 1.59, hr: 2.045, scale: 1.237, sb: 0.2, cs: -0.409 }
const BASE_ENV = {
  current: { key: 'current', season: '2026', cal: 0.9941, K: 0.2231, BB: 0.0848, HBP: 0.0112, HR: 0.0303, B2: 0.0419, B3: 0.0036, B1: 0.1423, SF: 0.007, rg: 4.44, paG: 37.68, ipG: 8.87, era: 4.13, obp: 0.315, slg: 0.401, avg: 0.244, sbG: 0.71, csG: 0.2 },
  alltime: { key: 'alltime', season: 'All-Time', cal: 0.9963, K: 0.16, BB: 0.0883, HBP: 0.0067, HR: 0.025, B2: 0.0415, B3: 0.0059, B1: 0.1581, SF: 0.0075, rg: 4.52, paG: 38.4, ipG: 8.93, era: 4.15, obp: 0.329, slg: 0.405, avg: 0.259, sbG: 0.62, csG: 0.27 },
}
const ENV = {}
for (const [k, b] of Object.entries(BASE_ENV)) {
  const E = { ...b }
  E.contact = 1 - E.K - E.BB - E.HBP
  E.HRc = E.HR / E.contact
  E.bip = E.contact - E.HR
  E.hitsBip = E.B1 + E.B2 + E.B3
  E.babip = E.hitsBip / E.bip
  E.s2 = E.B2 / E.hitsBip
  E.s3 = E.B3 / E.hitsBip
  E.roeBip = 0.0135          // reached on an error: about 0.9% of plate appearances
  E.gbOut = 0.46             // ground balls among the outs in play (GB% ~43%, and they're outs more often than line drives)
  E.ra9 = (E.rg * 9) / E.ipG
  E.rpw = 9 * (E.rg / E.ipG) * 1.5 + 3
  E.replPA = (0.0306 * E.rpw) / 9.76    // replacement runs per PA (~20 per 600)
  E.att0 = 0.092 * ((E.sbG + E.csG) / 0.91)   // a steal try per PA with a man on first and second open
  E.sbp0 = E.sbG / (E.sbG + E.csG)
  ENV[k] = E
}

// ─── A hitter's profile from his traits ──────────────────────────────────────
// (trait values on the 0-11 grade scale; 5.5 is a league-average hitter, B (6) a regular's level)
// K%: avoid K first, then contact and the eye. BB%: the eye, and pitchers working around power. HR per ball in
// play: power, a little contact and gap power. BABIP: contact (hard, square contact), speed (infield hits) and gap
// power (line drives). Doubles: gap power. Triples: speed. Speed and baserunning: steals, first to third, scoring
// from second, staying out of the double play.
let PID = 0
function batProfile(get, E, key) {
  const v = k => clamp(Number(get(k) ?? 5.5), -8, 18)
  const con = v('contact'), pow = v('power'), eye = v('eye'), ak = v('avoidK'), gap = v('gap'), spd = v('speed'), br = v('baserunning'), clu = v('clutch')
  const kI = 0.65 * ak + 0.25 * con + 0.1 * eye - 5.5
  const K = clamp(E.K * Math.exp(-(kI > 0 ? 0.15 : 0.11) * kI), 0.03, 0.42)
  const bI = 0.75 * eye + 0.15 * pow + 0.1 * ak - 5.5
  const BB = clamp(E.BB * Math.exp(0.13 * bI), 0.015, 0.24)
  const hI = 0.8 * pow + 0.1 * con + 0.1 * gap - 5.5
  // (a little steeper at the very top: the 50-homer seasons)
  const HRc = clamp(E.HRc * Math.exp(hI > 0 ? 0.13 * hI + 0.006 * hI * hI : 0.16 * hI), 0.004, 0.24)
  const cI = 0.7 * con + 0.2 * spd + 0.1 * gap - 5.5
  const babip = clamp(E.babip + 0.0052 * cI, 0.2, 0.4)
  const gI = 0.6 * gap + 0.25 * pow + 0.15 * spd - 5.5
  const tI = 0.65 * spd + 0.35 * gap - 5.5
  const run = 0.55 * spd + 0.45 * br - 5.5
  return {
    id: ++PID, key, K, BB, HBP: E.HBP, HRc, babip,
    s2: clamp(E.s2 * Math.exp(0.05 * gI), 0.1, 0.42), s3: clamp(E.s3 * Math.exp(0.18 * tI), 0.002, 0.08),
    fly: clamp(0.018 * (pow - 5.5), -0.1, 0.1),   // power hitters lift the ball: fewer grounders among their outs
    run, att: clamp(E.att0 * Math.exp(0.38 * run), 0.004, 0.45), sbp: clamp(E.sbp0 + 0.025 * run, 0.5, 0.93),
    clutch: clamp(clu - 5.5, -6, 6), spd,
  }
}
// ─── A pitcher's profile from his traits ─────────────────────────────────────
// K%: stuff (velocity, the breaking ball, movement, the changeup) and pitch IQ (sequencing). BB%: control, command,
// composure. HR per ball in play: ground balls, movement, command (living on the edges). BABIP against: movement,
// command, ground balls, pitch IQ. A reliever throws harder for an inning: about 10% more strikeouts than the same
// arm starting (FanGraphs starter/reliever splits: relievers ~24%, starters ~22%). Stamina is his pitch count (a B ~89 pitches, an A ~100).
function pitProfile(get, E, rel, key) {
  const v = k => clamp(Number(get(k) ?? 5.5), -8, 18)
  const vel = v('velocity'), mov = v('movement'), brk = v('breaking'), chg = v('changeup'), ctl = v('control'), cmd = v('command')
  const sta = v('stamina'), gb = v('groundball'), cmp = v('composure'), iq = v('pitchIQ')
  const sI = 0.3 * vel + 0.22 * brk + 0.18 * mov + 0.12 * chg + 0.1 * iq + 0.08 * cmd - 5.5
  const K = clamp(E.K * Math.exp(0.085 * sI) * (rel ? 1.07 : 0.965), 0.08, 0.45)
  const cI = 0.55 * ctl + 0.3 * cmd + 0.15 * cmp - 5.5
  const BB = clamp(E.BB * Math.exp(-0.13 * cI), 0.025, 0.18)
  const hI = 0.35 * gb + 0.3 * mov + 0.25 * cmd + 0.1 * vel - 5.5
  const HRc = clamp(E.HRc * Math.exp(-0.12 * hI), 0.012, 0.1)
  const bI = 0.35 * mov + 0.25 * cmd + 0.2 * gb + 0.2 * iq - 5.5
  // pitches a plate appearance: strikeouts and walks take more of them, command fewer
  const ppa = clamp(Math.exp(0.9 * (K - E.K) + 2.2 * (BB - E.BB) - 0.012 * (cmd - 5.5)), 0.85, 1.2)
  return {
    id: ++PID, key, rel: !!rel, K, BB, HRc, babipD: clamp(-0.0042 * bI, -0.03, 0.03), xbh: Math.exp(-0.035 * (gb - 5.5)),
    gbS: clamp(E.gbOut + 0.025 * (gb - 5.5), 0.3, 0.64), lim: clamp(66 + 3.8 * sta, 45, 112), ppa,
    tto: clamp(1 - 0.08 * (iq - 5.5), 0.5, 1.4), comp: clamp(cmp - 5.5, -6, 6), sta,
  }
}
const allOf = g => () => g
const PROF = new Map()
const memo = (k, f) => { let v = PROF.get(k); if (v === undefined) { v = f(); PROF.set(k, v) } return v }
const genBat = (E, g) => memo(`${E.key}|gb|${g.toFixed(3)}`, () => batProfile(allOf(g), E, `gb${g.toFixed(3)}`))
// (a generic arm: every trait at his grade, a starter's stamina a B/B+ (~5.3 innings, 2024-26), a reliever's a D)
const genPit = (E, g, rel) => memo(`${E.key}|gp|${rel ? 1 : 0}|${g.toFixed(3)}`, () => pitProfile(k => (k === 'stamina' ? (rel ? 2 : 6.6) : g), E, rel, `gp${rel ? 'r' : 's'}${g.toFixed(3)}`))
// (a real player's profiles live on his row: one an environment, a starter's and a reliever's)
const onRow = (p, k, f) => { const c = p._pr ?? (p._pr = {}); return c[k] ?? (c[k] = f()) }
const realBat = (E, p) => onRow(p, E.key, () => batProfile(k => p.attrs?.[k], E, `rb:${p.team}:${p.name}`))
const realPit = (E, p, rel) => onRow(p, `${E.key}${rel ? 'r' : 's'}`, () => pitProfile(k => p.attrs?.[k], E, rel, `rp:${rel ? 1 : 0}:${p.team}:${p.name}`))
const AVG_B = E => E._ab ?? (E._ab = genBat(E, 5.5))
const AVG_P = E => E._ap ?? (E._ap = genPit(E, 5.5, false))

// ─── The plate appearance ────────────────────────────────────────────────────
// events
const EK = 0, EBB = 1, EHBP = 2, EHR = 3, E1B = 4, E2B = 5, E3B = 6, EROE = 7, EGB = 8, EFB = 9
const log5 = (b, p, l) => { const x = (b * p) / l, y = ((1 - b) * (1 - p)) / (1 - l); return x / (x + y) }
// a batter shifted q grades (clutch, composure, the times-through-the-order penalty)
const shiftK = q => Math.exp(-0.13 * q)
function probs(b, p, E, q = 0, dB = 0) {
  const K = clamp(log5(b.K, p.K, E.K) * (q ? shiftK(q) : 1), 0.02, 0.6)
  const BB = clamp(log5(b.BB, p.BB, E.BB) * (q ? Math.exp(0.07 * q) : 1), 0.01, 0.3)
  const HBP = b.HBP
  const contact = Math.max(0.15, 1 - K - BB - HBP)
  const HR = contact * clamp(log5(b.HRc, p.HRc, E.HRc) * (q ? Math.exp(0.2 * q) : 1), 0.002, 0.3)
  const bip = contact - HR
  const babip = clamp(b.babip + p.babipD + dB + 0.006 * q, 0.17, 0.43)
  const hits = bip * babip
  const s2 = b.s2 * p.xbh, s3 = b.s3 * p.xbh
  const roe = bip * E.roeBip
  const outs = Math.max(0, bip - hits - roe)
  const gbs = clamp(p.gbS - b.fly, 0.25, 0.7)
  return [K, BB, HBP, HR, hits * (1 - s2 - s3), hits * s2, hits * s3, roe, outs * gbs, outs * (1 - gbs)]
}
const wobaOf = pr => W.bb * pr[1] + W.hbp * pr[2] + W.hr * pr[3] + W.b1 * pr[4] + W.b2 * pr[5] + W.b3 * pr[6]
const onBaseOf = pr => pr[1] + pr[2] + pr[3] + pr[4] + pr[5] + pr[6] + pr[7]
// (kept on the profile: a profile belongs to one environment)
const batWoba = (E, b) => b._w ?? (b._w = wobaOf(probs(b, AVG_P(E), E)))
const pitWoba = (E, p) => p._w ?? (p._w = wobaOf(probs(AVG_B(E), p, E)))
for (const E of Object.values(ENV)) E.woba = batWoba(E, AVG_B(E))
// (each batter profile keeps its own matchups: the pitcher's id, the shift and the glove behind him)
function distOf(b, p, E, q, dB) {
  const qk = clamp(Math.round(q * 20), -63, 63), dk = clamp(Math.round(dB * 2000), -31, 31)
  const m = b._d ?? (b._d = new Map())
  const key = (p.id * 128 + qk + 64) * 64 + dk + 32
  let d = m.get(key)
  if (d) return d
  if (m.size > 6000) m.clear()
  const pr = probs(b, p, E, qk / 20, dk / 2000)
  d = new Float64Array(10)
  let s = 0
  for (let i = 0; i < 10; i++) { s += pr[i]; d[i] = s }
  for (let i = 0; i < 10; i++) d[i] /= s
  m.set(key, d)
  return d
}

// ─── The glove ───────────────────────────────────────────────────────────────
// Fielding runs at a spot: his skill there (each spot's own mix of glove, arm and range) against the grade an average
// defender at that spot has; a catcher's glove is his framing and blocking. Elite: +12-18 runs (the Gold Glove
// shortstops and catchers), a poor one -10 to -15.
const POS_ADJ = { C: 12.5, SS: 7.5, '2B': 2.5, '3B': 2.5, CF: 2.5, LF: -7.5, RF: -7.5, '1B': -12.5, DH: -17.5 }
const FIELD_MIX = { C: [0.6, 0.4, 0], SS: [0.5, 0.25, 0.25], '2B': [0.55, 0.15, 0.3], '3B': [0.55, 0.35, 0.1], CF: [0.4, 0.15, 0.45], LF: [0.5, 0.15, 0.35], RF: [0.4, 0.4, 0.2], '1B': [0.85, 0.05, 0.1], DH: [0, 0, 0] }
const FIELD_REQ = { C: 5.5, SS: 7, '2B': 6, '3B': 6, CF: 7, LF: 5, RF: 5.5, '1B': 4, DH: 0 }
const FIELD_K = { C: 3.5, SS: 4, '2B': 3, '3B': 3, CF: 3.5, LF: 2.2, RF: 2.5, '1B': 1.4, DH: 0 }
const skillAt = (get, pos) => { const m = FIELD_MIX[pos] ?? FIELD_MIX.DH; return m[0] * num(get('fielding'), 5) + m[1] * num(get('arm'), 5) + m[2] * num(get('speed'), 5) }
const fieldRunsAt = (get, pos) => (pos === 'DH' ? 0 : clamp(FIELD_K[pos] * (skillAt(get, pos) - FIELD_REQ[pos]), -16, 20))
// where a club plays him: the spot worth the most (the positional adjustment and his glove there), a premium spot
// only if he can handle it; catcher only when he replaces one (it's its own trade). His club's spot if it's close.
function bestPosition(get, want) {
  const opts = ['SS', 'CF', '2B', '3B', 'RF', 'LF', '1B', 'DH']
  if (want === 'C') opts.unshift('C')
  const premium = new Set(['C', 'SS', 'CF', '2B', '3B'])
  let best = 'DH', bv = -1e9
  const val = p => POS_ADJ[p] + fieldRunsAt(get, p)
  for (const p of opts) {
    if (premium.has(p) && skillAt(get, p) < FIELD_REQ[p] - 1.5) continue
    const v = val(p)
    if (v > bv) { bv = v; best = p }
  }
  if (want && want !== best && opts.includes(want) && !(premium.has(want) && skillAt(get, want) < FIELD_REQ[want] - 1.5) && val(want) >= bv - 2) return want
  return best
}

// ─── Team strength ───────────────────────────────────────────────────────────
// off/def (1-10, 5.5 average): one spread of the data's ratings is a spread of real team runs a game (~0.45 runs,
// ~10% a side: B-R team batting and pitching 2024-26), so a 7.5-off club scores about 5.1 a game and a 3.5 one 3.8.
const sdOf = a => { const m = avg(a); return Math.sqrt(avg(a.map(x => (x - m) ** 2))) }
const K_OFF = clamp(0.1 / Math.max(0.8, sdOf(TEAMS.map(t => t.off)) || 2), 0.03, 0.08)
const K_DEF = clamp(0.1 / Math.max(0.8, sdOf(TEAMS.map(t => t.def)) || 2), 0.03, 0.08)
// (centred on the league's own average rating, so the league scores its real runs whatever the data's mean)
ENV.current.mOff = avg(TEAMS.map(t => t.off)) || 5.5
ENV.current.mDef = avg(TEAMS.map(t => t.def)) || 5.5
ENV.alltime.mOff = ENV.alltime.mDef = 5.5
const rgOff = (E, off) => E.rg * Math.exp(K_OFF * (off - E.mOff))
const rgDef = (E, def) => E.rg * Math.exp(-K_DEF * (def - E.mDef))
const HOME_ADV = 0.026    // home teams score ~5% more than visitors: about a .525 home record (B-R 2023-25)
const HOME_Q = 0.13       // the same edge in a plate appearance (grades: the home side's hitters a shade better)
// All-Time: each franchise's legends, against the other franchises' (their wOBA and wOBA against, top five each),
// on the same spread as today's ratings. A row's own `alltime: { off, def }` (or atOff / atDef) wins.
const ALLTIME_RATE = (() => {
  const E = ENV.alltime
  const rows = TEAMS.map(t => {
    const b = (PLAYERS.alltime.bat.get(t.short) ?? []).map(p => batWoba(E, realBat(E, p))).sort((x, y) => y - x).slice(0, 5)
    const p = (PLAYERS.alltime.pit.get(t.short) ?? []).map(q => pitWoba(E, realPit(E, q, q.role !== 'SP'))).sort((x, y) => x - y).slice(0, 5)
    return { t, b: b.length ? avg(b) : null, p: p.length ? avg(p) : null }
  })
  const sdO = sdOf(TEAMS.map(t => t.off)) || 1.6, sdD = sdOf(TEAMS.map(t => t.def)) || 1.6
  const zOf = (vals, x) => { const v = vals.filter(y => y != null); const m = avg(v), s = sdOf(v) || 1; return x == null ? -0.6 : (x - m) / s }
  const bs = rows.map(r => r.b), ps = rows.map(r => r.p)
  const out = new Map()
  for (const r of rows) {
    const own = r.t.alltime ?? (r.t.atOff != null ? { off: r.t.atOff, def: r.t.atDef } : null)
    out.set(r.t.short, own ? { off: num(own.off, 5.5), def: num(own.def, 5.5) } : { off: r1(clamp(5.5 + zOf(bs, r.b) * sdO, 1, 10)), def: r1(clamp(5.5 - zOf(ps, r.p) * sdD, 1, 10)) })
  }
  return out
})()
export function baseballTeamOf(short, mode = 'current') {
  const t = teamKey(short) ?? TEAMS[0]
  if (!t) return null
  return mode === 'alltime' ? { ...t, ...ALLTIME_RATE.get(t.short) } : t
}
export function baseballTeam10(team, mode = 'current') {
  const t = baseballTeamOf(team?.short ?? team, mode)
  return t ? { off: r1(t.off), def: r1(t.def) } : { off: 5.5, def: 5.5 }
}

// Lineup spots: plate appearances a game (B-R batting-order splits, 2024-25: the leadoff man ~4.65, ninth ~3.8)
const SPOT_W = [4.65, 4.55, 4.45, 4.35, 4.24, 4.13, 4.02, 3.91, 3.8]
const SPOT_SUM = SPOT_W.reduce((s, x) => s + x, 0)
// where a manager bats a hitter (today's way: the best on-base-and-power bat second, a high on-base runner first)
function spotOf(E, prof, woba) {
  const d = woba - E.woba
  const obpEdge = (prof.BB - E.BB) * 1.6 + (prof.babip - E.babip) * 0.9 - (prof.K - E.K) * 0.4
  if (d >= 0.058) return 1
  if (prof.run >= 2 && obpEdge >= 0.02 && d >= 0.01) return 0
  if (d >= 0.035) return 2
  if (d >= 0.017) return 3
  if (d >= 0.004) return 4
  if (d >= -0.01) return 5
  if (d >= -0.025) return 6
  return 7
}
function solveGrade(f, target, lo = -8, hi = 18) {
  for (let i = 0; i < 38; i++) { const m = (lo + hi) / 2; if (f(m) < target) lo = m; else hi = m }
  return (lo + hi) / 2
}
// (the bisection's profiles aren't kept: only the answer is)
const rawBat = (E, g) => batProfile(allOf(g), E, 'tmp')
const rawPit = (E, g, rel) => pitProfile(k => (k === 'stamina' ? (rel ? 2 : 6.6) : g), E, rel, 'tmp')
const solveBat = (E, woba) => Math.round(solveGrade(g => batWoba(E, rawBat(E, g)), woba) * 1000) / 1000
// the generic part of a staff, to a wOBA against (lower is better)
const solvePit = (E, f, target) => solveGrade(g => -f(g), -target)
// runs a game against a lineup's (or staff's) wOBA: R = rg x (wOBA / league)^gamma, the engine's own curve (fitted
// in scripts/baseball/engine-check.mjs: runs rise faster than linearly with on-base and power, as in BaseRuns)
const G_OFF = 2.68, G_DEF = 2.2
const teamWoba = (E, off) => E.woba * E.cal * Math.pow(rgOff(E, off) / E.rg, 1 / G_OFF)
const teamWobaA = (E, def) => E.woba * E.cal * Math.pow(rgDef(E, def) / E.rg, 1 / G_DEF)
const runsOfWoba = (E, w) => E.rg * Math.pow(w / (E.woba * E.cal), G_OFF)
const runsOfWobaA = (E, w) => E.rg * Math.pow(w / (E.woba * E.cal), G_DEF)
// a starter's innings a start, from his pitch count and how many men he lets on
function ipPerStart(E, prof) {
  const pr = probs(AVG_B(E), prof, E)
  const bf = prof.lim / (3.84 * prof.ppa)
  return clamp((bf * (1 - onBaseOf(pr) + 0.024)) / 3 * 0.93, 2, 8.6)
}
const IP_TEAM = 162 * 8.87
// The real players a club uses by name in the engine: its rotation (the data's starters, its `starter: true` ace
// first) and, for the build's own club, the man the build replaces. Everyone else is the club's generic level,
// solved so the whole staff and lineup play at exactly the club's rating.
function realRotation(E, mode, short, skip) {
  return (PLAYERS[mode].pit.get(short) ?? []).filter(p => p.role === 'SP' && p.name !== skip)
    .map(p => ({ p, prof: realPit(E, p, false) }))
    .sort((a, b) => (b.p.starter ? 1 : 0) - (a.p.starter ? 1 : 0) || pitWoba(E, a.prof) - pitWoba(E, b.prof) || (a.p.name < b.p.name ? -1 : 1))
    .slice(0, 5)
}
function staffOf(E, mode, short, def, opt = {}) {
  // opt.build: { prof, role } (his club, a pitcher build); opt.replaced: the real pitcher he replaces
  const target = teamWobaA(E, def)
  const ace = opt.replaced?.role === 'SP' ? opt.replaced.name : null
  const rot = realRotation(E, mode, short, null)
  // with the real ace in (the club's rating is with him); the build takes his turn after
  const shares = rot.map(x => ({ prof: x.prof, s: (32 * ipPerStart(E, x.prof)) / IP_TEAM }))
  const rel = opt.replaced && opt.replaced.role !== 'SP' ? { prof: realPit(E, opt.replaced, true), s: 65 / IP_TEAM } : null
  const f = g => {
    const gs = rawPit(E, g, false), gr = rawPit(E, g, true)
    let s = 0, w = 0
    for (const x of shares) { s += x.s * pitWoba(E, x.prof); w += x.s }
    const fills = Math.max(0, 5 - shares.length) * (32 * ipPerStart(E, gs)) / IP_TEAM
    s += fills * pitWoba(E, gs); w += fills
    if (rel) { s += rel.s * pitWoba(E, rel.prof); w += rel.s }
    s += Math.max(0, 1 - w) * pitWoba(E, gr)
    return s
  }
  const g = Math.round(solvePit(E, f, target) * 1000) / 1000
  const fill = { p: null, prof: genPit(E, g, false) }
  let slots = rot.filter(x => x.p.name !== ace)
  if (opt.build?.role === 'SP') slots = [{ p: null, prof: opt.build.prof, isB: true }, ...slots]
  while (slots.length < 5) slots.push(fill)
  return { g, rot: slots.slice(0, 5), pen: genPit(E, g, true), fill, spare: genPit(E, g - 0.7, false) }
}
// a club's real batters and its starter (the man a build replaces), with their profiles
function batsOf(E, mode, short) {
  return (PLAYERS[mode].bat.get(short) ?? []).map(p => { const prof = realBat(E, p); return { p, prof, woba: batWoba(E, prof) } })
    .sort((a, b) => b.woba - a.woba || (a.p.name < b.p.name ? -1 : 1))
}
function replacedOf(E, mode, short, pos, role, want) {
  if (want === false) return null
  if (pos === 'bat') {
    const list = batsOf(E, mode, short)
    return (typeof want === 'string' && list.find(x => x.p.name === want)) || list.find(x => x.p.starter) || list[0] || null
  }
  const list = (PLAYERS[mode].pit.get(short) ?? []).map(p => ({ p, prof: realPit(E, p, p.role !== 'SP') }))
  const named = typeof want === 'string' && list.find(x => x.p.name === want)
  if (named) return named
  if (role === 'SP') return list.filter(x => x.p.role === 'SP').sort((a, b) => (b.p.starter ? 1 : 0) - (a.p.starter ? 1 : 0) || pitWoba(E, a.prof) - pitWoba(E, b.prof))[0] ?? null
  const pen = list.filter(x => x.p.role !== 'SP').sort((a, b) => (b.p.role === 'CL' ? 1 : 0) - (a.p.role === 'CL' ? 1 : 0) || pitWoba(E, a.prof) - pitWoba(E, b.prof))
  return role === 'CL' ? pen[0] ?? null : pen[1] ?? pen[0] ?? null
}

// ─── One game, plate appearance by plate appearance ──────────────────────────
// side: { lu: [9 hitters { prof, isB }], sp: { prof, isB, name }, pen: prof, dB (BABIP change for the other side's
//         hitters: his glove), rp: null | { prof, role: 'CL' | 'RP', avail } (a reliever build) }
// Returns the score, the innings, his line (bat or pit) and the decisions.
const TTO = [-0.25, 0, 0.35, 0.6]
const P_COUNT = [4.8, 5.7, 3.3, 3.2, 3.3, 3.3, 3.3, 3.3, 3.3, 3.3]
function playGame(E, away, home, rand, opt = {}) {
  const sides = [away, home]
  const score = [0, 0]
  const pos = [0, 0]
  const cur = [null, null], last = [null, null], staffs = [[], []]
  const bat = opt.batSide != null ? { gp: 1, pa: 0, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, r: 0, bb: 0, k: 0, hbp: 0, sf: 0, sb: 0, cs: 0, gidp: 0, roe: 0, slam: 0, wo: 0 } : null
  let goAhead = null, lock = false, over = false, bsFlag = false, inn = 0
  let bs = 0, outs = 0
  const B = [null, null, null]
  const T = opt.tally ?? null
  const newPit = (s, prof, kind, isB, name = null) => {
    if (cur[s]) cur[s].exitLead = score[s] - score[1 - s]
    const P = { prof, kind, isB, name, isSP: kind === 'SP', outs: 0, bf: 0, pitches: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, hbp: 0, enter: score[s] - score[1 - s], save: false, lim: prof.lim + gauss(rand) * 6, inn: 0, exitLead: null }
    const d = P.enter
    P.save = !P.isSP && d >= 1 && d <= 3
    cur[s] = P; last[s] = P; staffs[s].push(P)
    return P
  }
  newPit(0, away.sp.prof, 'SP', !!away.sp.isB, away.sp.name)
  newPit(1, home.sp.prof, 'SP', !!home.sp.isB, home.sp.name)
  const rpUsed = [false, false]
  const scoreRun = (rn, rbi, force = false) => {
    if (lock && !force) return
    const before = score[bs] - score[1 - bs]
    score[bs]++
    const pc = rn.pc
    pc.r++
    if (rn.er) pc.er++
    if (bat && rn.isB) bat.r++
    if (bat && rbi && opt.batSide === bs && curBatterIsB) bat.rbi++
    const after = before + 1
    if (before <= 0 && after > 0) goAhead = { side: bs, wp: last[bs], lp: pc }
    // (a reliever build who lets the lead go)
    const fp = cur[1 - bs]
    if (fp.isB && fp.save && after >= 0) bsFlag = true
    if (bs === 1 && inn >= 9 && score[1] > score[0]) lock = true
  }
  let curBatterIsB = false
  const changePitcher = s => {
    const S = sides[s]
    // a reliever build: his inning (Career and the page call these the save, the hold, the ninth)
    if (S.rp && !rpUsed[s] && S.rp.avail && relieverIn(S.rp, inn, score[s] - score[1 - s], s === 1, rand, opt.ps)) {
      rpUsed[s] = true
      return newPit(s, S.rp.prof, 'B', true)
    }
    return newPit(s, S.pen, 'R', false)
  }
  const startInning = s => {
    const P = cur[s]
    const d = score[s] - score[1 - s]
    if (P.isSP) {
      let stay = P.pitches < P.lim - 9 && inn <= 8
      if (inn === 9) stay = P.pitches < P.lim - 12 && P.r <= 2 && d >= 1 && rand() < 0.55
      // (a closer build gets the ninth of a save over a starter still going)
      if (inn === 9 && sides[s].rp?.role === 'CL' && d >= 1 && d <= 3) stay = false
      if (inn === 9 && P.h === 0 && P.pitches < P.lim + 12) stay = true
      if (inn > 9) stay = false
      if (!stay) changePitcher(s)
    } else if (P.kind === 'B') {
      // a closer keeps a save going into extras only in the postseason; otherwise one inning
      changePitcher(s)
    } else {
      changePitcher(s)
    }
    cur[s].inn++
  }
  const midPull = s => {
    const P = cur[s]
    if (P.isSP ? P.pitches >= P.lim + 4 || P.r >= 7 || (P.er >= 5 && P.outs < 15) : P.pitches > (P.isB ? 42 : 36)) newPit(s, sides[s].pen, 'R', false)
  }
  const out1 = P => { outs++; P.outs++ }
  for (inn = 1; !over && inn <= 25; inn++) {
    for (let half = 0; half < 2 && !over; half++) {
      bs = half
      const fs = 1 - bs
      if (half === 1 && inn >= 9 && score[1] > score[0]) { over = true; break }
      outs = 0; B[0] = B[1] = B[2] = null
      if (inn > 1 || half === 1) startInning(fs)
      else cur[fs].inn++
      const S = sides[bs], F = sides[fs]
      if (inn >= 10) {
        const prev = S.lu[(pos[bs] + 8) % 9]
        B[1] = { isB: !!prev.isB && opt.batSide === bs, pc: cur[fs], er: false, run: prev.prof.run, att: prev.prof.att, sbp: prev.prof.sbp }
      }
      while (outs < 3 && !lock) {
        const P = cur[fs]
        // a steal, a wild pitch
        if (B[0] && !B[1]) {
          const rn = B[0]
          if (rand() < rn.att) {
            P.pitches += 1.5
            if (rand() < rn.sbp) { B[1] = rn; B[0] = null; if (bat && rn.isB) bat.sb++; if (T) T.sb[bs === T.us ? 0 : 1]++ } else { B[0] = null; out1(P); if (bat && rn.isB) bat.cs++; if (T) T.cs[bs === T.us ? 0 : 1]++ }
          }
        } else if (B[1] && !B[2] && outs < 2 && rand() < B[1].att * 0.12) {
          const rn = B[1]
          if (rand() < rn.sbp - 0.06) { B[2] = rn; B[1] = null; if (bat && rn.isB) bat.sb++ } else { B[1] = null; out1(P); if (bat && rn.isB) bat.cs++ }
        }
        if (outs >= 3) break
        if ((B[0] || B[1] || B[2]) && rand() < 0.0095) {
          if (B[2]) { scoreRun(B[2], false); B[2] = null }
          B[2] = B[1]; B[1] = B[0]; B[0] = null
          if (lock) break
        }
        const b = S.lu[pos[bs]]
        const isB = !!b.isB && opt.batSide === bs
        curBatterIsB = isB
        // the matchup: his clutch with men on or late and close, a pitcher's composure, the order the third time through
        const risp = !!(B[1] || B[2]), late = inn >= 7 && Math.abs(score[0] - score[1]) <= 1
        let q = bs === 1 ? HOME_Q : -HOME_Q
        if (P.isSP) q += TTO[Math.min(3, Math.floor(P.bf / 9))] * P.prof.tto
        if (isB && (risp || late)) q += 0.18 * b.prof.clutch
        if (P.isB && (risp || (late && !P.isSP))) q -= 0.2 * P.prof.comp
        const d = distOf(b.prof, P.prof, E, q, F.dB ?? 0)
        const u = rand()
        let ev = 0
        while (ev < 9 && u > d[ev]) ev++
        P.bf++
        if (T) T.ev[(bs === T.us ? 0 : 10) + ev]++
        P.pitches += P_COUNT[ev] * P.prof.ppa + (rand() + rand() - 1) * 1.8
        const me = { isB, pc: P, er: ev !== EROE, run: b.prof.run, att: b.prof.att, sbp: b.prof.sbp }
        if (bat && isB) { bat.pa++; if (ev !== EBB && ev !== EHBP) bat.ab++ }
        const r3 = B[2], r2 = B[1], r1x = B[0]
        switch (ev) {
          case EK: out1(P); P.k++; if (bat && isB) bat.k++; break
          case EBB: case EHBP: {
            if (ev === EBB) { P.bb++; if (bat && isB) bat.bb++ } else { P.hbp++; if (bat && isB) bat.hbp++ }
            if (r1x) { if (r2) { if (r3) scoreRun(r3, true); B[2] = r2 } B[1] = r1x }
            B[0] = me
            break
          }
          case EHR: {
            P.h++; P.hr++
            const n = (r1x ? 1 : 0) + (r2 ? 1 : 0) + (r3 ? 1 : 0)
            if (bat && isB) { bat.h++; bat.hr++; if (n === 3) bat.slam++ }
            if (r3) scoreRun(r3, true, true)
            if (r2) scoreRun(r2, true, true)
            if (r1x) scoreRun(r1x, true, true)
            scoreRun(me, true, true)
            B[0] = B[1] = B[2] = null
            break
          }
          case E3B: {
            P.h++; if (bat && isB) { bat.h++; bat.triples++ }
            B[0] = B[1] = B[2] = null
            if (r3) scoreRun(r3, true); if (r2) scoreRun(r2, true); if (r1x) scoreRun(r1x, true)
            B[2] = me
            break
          }
          case E2B: {
            P.h++; if (bat && isB) { bat.h++; bat.doubles++ }
            B[0] = B[1] = B[2] = null
            if (r3) scoreRun(r3, true); if (r2) scoreRun(r2, true)
            if (r1x) { const go = rand(); if (go < (outs === 2 ? 0.62 : 0.4) + 0.04 * r1x.run) scoreRun(r1x, true); else if (go < (outs === 2 ? 0.67 : 0.44)) out1(P); else B[2] = r1x }
            B[1] = me
            break
          }
          case E1B: {
            P.h++; if (bat && isB) bat.h++
            B[0] = B[1] = B[2] = null
            if (r3) scoreRun(r3, true)
            if (r2) { const go = rand(); if (go < (outs === 2 ? 0.86 : 0.58) + 0.035 * r2.run) scoreRun(r2, true); else if (go < (outs === 2 ? 0.9 : 0.62)) out1(P); else B[2] = r2 }
            if (r1x && outs < 3) { const go = rand(); if (!B[2] && go < (outs === 2 ? 0.36 : 0.27) + 0.035 * r1x.run) B[2] = r1x; else if (!B[2] && go < (outs === 2 ? 0.38 : 0.3)) out1(P); else B[1] = r1x }
            B[0] = me
            break
          }
          case EROE: {
            if (bat && isB) bat.roe++
            B[0] = B[1] = B[2] = null
            if (r3) { r3.er = false; scoreRun(r3, false) }
            if (r2) { if (rand() < 0.3) { r2.er = false; scoreRun(r2, false) } else B[2] = r2 }
            if (r1x) { if (!B[2] && rand() < 0.2) B[2] = r1x; else B[1] = r1x }
            B[0] = me
            break
          }
          case EGB: {
            if (outs === 2) { out1(P); break }
            if (r1x) {
              const w = rand()
              const dp = 0.42 * Math.exp(-0.12 * b.prof.run)
              if (w < dp) {
                out1(P); out1(P); B[0] = null
                if (bat && isB) bat.gidp++
                if (outs < 3) { if (r3) { scoreRun(r3, false); B[2] = null } if (r2) { B[2] = r2; B[1] = null } }
              } else if (w < dp + 0.3) {
                out1(P); B[0] = me
                if (outs < 3) {
                  if (r3 && (r2 || rand() < 0.45)) { scoreRun(r3, true); B[2] = null }
                  if (r2 && !B[2]) { B[2] = r2; B[1] = null }
                }
              } else {
                out1(P)
                if (outs < 3) { if (r3) { scoreRun(r3, true); B[2] = null } if (r2) B[2] = r2; B[1] = r1x; B[0] = null }
              }
            } else {
              out1(P)
              if (outs < 3) {
                if (r3 && rand() < 0.5) { scoreRun(r3, true); B[2] = null }
                if (r2 && !B[2] && rand() < 0.55) { B[2] = r2; B[1] = null }
              }
            }
            break
          }
          default: {   // EFB: a fly ball, a liner, a popup
            out1(P)
            if (outs < 3) {
              if (r3 && rand() < 0.55 + 0.03 * r3.run) { scoreRun(r3, true); B[2] = null; if (bat && isB) { bat.sf++; bat.ab-- } }
              if (r2 && !B[2] && rand() < 0.2) { B[2] = r2; B[1] = null }
            }
          }
        }
        if (bat && isB && lock && opt.batSide === 1) bat.wo = 1
        pos[bs] = (pos[bs] + 1) % 9
        if (lock) break
        if (outs < 3) midPull(fs)
      }
      if (half === 0 && inn >= 9 && score[1] > score[0]) over = true
      if (half === 1 && inn >= 9 && score[0] !== score[1]) over = true
      if (lock) over = true
    }
  }
  if (score[0] === score[1]) score[rand() < 0.5 ? 0 : 1]++   // (25 innings: never in practice)
  if (T && T.us != null) for (const P of staffs[T.us]) { T.erUs += P.er; T.outsUs += P.outs; T.hA += P.h; T.bbA += P.bb }
  if (T) { T.games++; T.runs[0] += score[0]; T.runs[1] += score[1]; if (score[1] > score[0]) T.homeW++; if (inn - 1 > 9) T.extra++; for (const s of [0, 1]) { const sp = staffs[s][0]; T.spOuts += sp.outs; T.spPitches += sp.pitches; T.spStarts++; if (sp.outs >= 27) T.cg++ } }
  const winner = score[1] > score[0] ? 1 : 0
  // the decisions: the winner's pitcher of record when it went ahead for good, and the man charged with that run
  let wp = goAhead && goAhead.side === winner ? goAhead.wp : staffs[winner][0]
  if (wp?.isSP && wp.outs < 15) wp = staffs[winner].find(p => !p.isSP) ?? null
  const lp = goAhead && goAhead.side === winner ? goAhead.lp : staffs[1 - winner][0]
  let pit = null
  if (opt.pitSide != null) {
    const s = opt.pitSide
    const P = staffs[s].find(p => p.isB)
    if (P) {
      const finished = cur[s] === P
      const won = winner === s
      const w = wp === P ? 1 : 0, l = lp === P ? 1 : 0
      const blew = P.save && bsFlag
      const sv = !P.isSP && won && finished && !w && P.save && !blew ? 1 : 0
      const hld = !P.isSP && P.save && !finished && P.outs > 0 && !blew && (P.exitLead ?? 0) > 0 && !sv ? 1 : 0
      const cg = P.isSP && finished && staffs[s].length === 1 ? 1 : 0
      pit = {
        app: 1, gs: P.isSP ? 1 : 0, outs: P.outs, bf: P.bf, pitches: Math.round(P.pitches), h: P.h, r: P.r, er: P.er, bb: P.bb, k: P.k, hr: P.hr, hbp: P.hbp,
        w, l, sv, hld: hld && !w && !l ? 1 : 0, bs: blew ? 1 : 0, svo: P.save ? 1 : 0, qs: P.isSP && P.outs >= 18 && P.er <= 3 ? 1 : 0, cg, sho: cg && P.r === 0 ? 1 : 0, nh: cg && P.h === 0 ? 1 : 0,
      }
    }
  }
  return { score, innings: Math.max(9, inn - 1), bat, pit, walkoff: lock || (winner === 1 && inn - 1 > 9 && false), staffs }
}
// When a reliever build comes in (at the start of an inning his club takes the field): a closer the ninth with a
// one-to-three-run lead (the save), the ninth at home in a tie, extra innings; on a few days' rest, any ninth for work.
// A setup man the eighth, ahead by up to three or behind by one. In October the closer can go four or five outs.
function relieverIn(rp, inn, lead, home, rand, ps) {
  const rest = rp.rest ?? 3
  if (rp.role === 'CL') {
    if (inn === 9 || inn > 9) {
      if (lead >= 1 && lead <= 3) return true
      if (lead === 0) return rand() < (inn > 9 ? 0.8 : home ? 0.6 : 0.35)
      if (lead >= 4 && lead <= 5) return rest >= 2 && rand() < 0.5
      if (lead >= -2 && lead <= -1) return rest >= 2 && rand() < 0.45
      return rest >= 4 && rand() < 0.5
    }
    if (inn === 8 && ps && lead >= 1 && lead <= 2) return rand() < 0.2
    // (a long layoff: an inning of work wherever it comes)
    if (inn === 8 && rest >= 4 && Math.abs(lead) <= 4) return rand() < 0.35
    return false
  }
  if (inn === 8) return lead >= -1 && lead <= 3 ? true : Math.abs(lead) <= 5 && rest >= 3 && rand() < 0.35
  if (inn === 7) return lead >= 1 && lead <= 2 && rand() < 0.3
  if (inn > 9) return lead === 0 && rand() < 0.35
  return false
}

// ─── Every other game: the run model ─────────────────────────────────────────
// Runs a team-game: negative binomial (MLB 2023-25: mean ~4.45, sd ~3.1, a shutout ~6% of the time). Level after nine:
// extra innings with the automatic runner, about 1 in 11 games.
const NB_R = 3.6
// (nine innings' mean: the extra innings and the spread of matchups add the rest, so the league scores its 4.44)
const Q_SCALE = 0.968
function extraRuns(E, lam, rand) {
  if (rand() < clamp(0.4 * Math.sqrt(E.rg / lam), 0.22, 0.62)) return 0
  return 1 + poisson((0.45 * lam) / E.rg, rand)
}
function quickGame(E, lh, la, rand) {
  let h = negbin(lh * Q_SCALE, NB_R, rand), a = negbin(la * Q_SCALE, NB_R, rand)
  let inns = 9
  for (let k = 0; h === a && k < 15; k++) {
    inns++
    a += extraRuns(E, la, rand)
    const hr = extraRuns(E, lh, rand)
    if (h + hr > a) h = a + 1 + (hr > 1 && rand() < 0.3 ? 1 : 0)
    else h += hr
  }
  if (h === a) h++
  return [h, a, inns]
}

// ─── The schedule ────────────────────────────────────────────────────────────
// The balanced schedule (2023-): every club 13 against each division rival (52), 6 or 7 against the other ten in its
// league (64: four of them 7), and 46 interleague (3 against each of fourteen, 4 against its natural rival). 81 home.
const SCHED = new Map()
function leagueSchedule(year) {
  const key = String(year)
  if (SCHED.has(key)) return SCHED.get(key)
  const rand = seeded(`bb-sched|${key}`)
  const pairs = []      // [home, away, games]
  const div = {}
  for (const t of TEAMS) (div[`${t.lg} ${t.div}`] ??= []).push(t.i)
  const order = Object.fromEntries(Object.entries(div).map(([k, v]) => [k, shuffle(v.sort((a, b) => a - b), rand)]))
  const add = (h, a, n) => { if (n > 0) pairs.push([h, a, n]) }
  // the division: a circle, each club hosting seven of the 13 against the next two
  for (const ids of Object.values(order)) {
    const n = ids.length
    for (let i = 0; i < n; i++) for (let k = 1; k <= Math.floor((n - 1) / 2); k++) { const j = (i + k) % n; add(ids[i], ids[j], 7); add(ids[j], ids[i], 6) }
    if (n % 2 === 0) for (let i = 0; i < n / 2; i++) { const j = i + n / 2; add(ids[i], ids[j], 7); add(ids[j], ids[i], 6) }
  }
  // the league's other two divisions: four 7-game sets (two a division), the rest 6 (3 home, 3 away)
  for (const lg of ['AL', 'NL']) {
    const ds = ['East', 'Central', 'West'].map(d => order[`${lg} ${d}`] ?? [])
    for (const [x, y] of [[0, 1], [0, 2], [1, 2]]) {
      const A = ds[x], Bd = ds[y], n = Math.min(A.length, Bd.length)
      for (let i = 0; i < A.length; i++) for (let j = 0; j < Bd.length; j++) {
        if (j === i % n) { add(A[i], Bd[j], 4); add(Bd[j], A[i], 3) }
        else if (j === (i + 1) % n) { add(Bd[j], A[i], 4); add(A[i], Bd[j], 3) }
        else { add(A[i], Bd[j], 3); add(Bd[j], A[i], 3) }
      }
    }
  }
  // interleague: the rivals 2 and 2; the other fourteen one 3-game series each, seven at home
  const AL = TEAMS.filter(t => t.lg === 'AL').map(t => t.i), NLs = TEAMS.filter(t => t.lg === 'NL').map(t => t.i)
  const nl = new Array(AL.length).fill(null), used = new Set()
  AL.forEach((a, k) => { const r = CANON_BY.get(RIVAL[TEAMS[a].c]); if (r && r.lg === 'NL' && !used.has(r.i)) { nl[k] = r.i; used.add(r.i) } })
  const rest = shuffle(NLs.filter(i => !used.has(i)), rand)
  for (let k = 0; k < nl.length; k++) if (nl[k] == null) nl[k] = rest.shift() ?? null
  const M = AL.length
  for (let a = 0; a < M; a++) for (let b = 0; b < nl.length; b++) {
    const A = AL[a], Nn = nl[b]
    if (Nn == null) continue
    if (a === b) { add(A, Nn, 2); add(Nn, A, 2); continue }
    const d = (b - a + M) % M
    if (d <= Math.floor((M - 1) / 2)) add(A, Nn, 3); else add(Nn, A, 3)
  }
  const out = { pairs }
  SCHED.set(key, out)
  return out
}
const SERIES_OF = { 2: [2], 3: [3], 4: [4], 6: [3, 3], 7: [4, 3], 13: [4, 3, 3, 3] }
const splitSeries = n => SERIES_OF[n] ?? (n <= 4 ? [n] : [...splitSeries(n - 3), 3])
// His club's calendar: its series alternated into homestands and road trips of two or three series, an off day
// about every week, the All-Star break in mid-July. 2026: Opening Day March 26, the last day September 27.
const MONTHS = [['Mar', 31], ['Apr', 30], ['May', 31], ['Jun', 30], ['Jul', 31], ['Aug', 31], ['Sep', 30], ['Oct', 31], ['Nov', 30]]
const dateOf = day => { let d = 25 + day; for (const [m, n] of MONTHS) { if (d < n) return `${m} ${d + 1}`; d -= n } return `Dec ${d + 1}` }
const isoOf = day => { let d = 25 + day; for (let k = 0; k < MONTHS.length; k++) { const n = MONTHS[k][1]; if (d < n) return `2026-${String(k + 3).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`; d -= n } return '2026-12-01' }
const ASB_DAY = 109       // the All-Star break, July 13-16 (2026: the game July 14 in Philadelphia)
const SEASON_DAYS = 186
function teamCalendar(year, U) {
  const key = `${year}|${U}`
  if (SCHED.has(key)) return SCHED.get(key)
  const { pairs } = leagueSchedule(year)
  const rand = seeded(`bb-cal|${key}`)
  const home = [], away = []
  for (const [h, a, n] of pairs) {
    if (h === U) for (const len of splitSeries(n)) home.push({ opp: a, home: true, len })
    else if (a === U) for (const len of splitSeries(n)) away.push({ opp: h, home: false, len })
  }
  const H = shuffle(home, rand), A = shuffle(away, rand)
  const order = []
  let atHome = rand() < 0.5
  while (H.length || A.length) {
    const take = 2 + (rand() < 0.45 ? 1 : 0)
    const src = (atHome && H.length) || !A.length ? H : A
    for (let k = 0; k < take && src.length; k++) order.push(src.shift())
    atHome = !atHome
  }
  // no series against the same club twice in a row
  for (let i = 1; i < order.length; i++) if (order[i].opp === order[i - 1].opp) { const j = order.findIndex((s, k) => k > i + 1 && s.opp !== order[i].opp && s.home === order[i].home); if (j > 0) [order[i], order[j]] = [order[j], order[i]] }
  const games = order.reduce((s, x) => s + x.len, 0)
  const offs = Math.max(0, SEASON_DAYS - games - 4)
  const gaps = order.length - 1
  const offAt = new Set(shuffle([...Array(Math.max(0, gaps)).keys()], rand).slice(0, offs))
  const list = []
  let day = 0, g = 0, asb = false
  order.forEach((s, si) => {
    // the All-Star break before the series that would run into it
    if (!asb && list.length && day + s.len > ASB_DAY) { day += 4; asb = true; list[list.length - 1].asb = true }
    // the opposing club's rotation turn this series (a fixed slot each series, the schedule's own)
    const slot = Math.floor(rand() * 5)
    for (let k = 0; k < s.len; k++) { list.push({ g: g + 1, day, date: dateOf(day), iso: isoOf(day), opp: s.opp, home: s.home, series: [k + 1, s.len], si, oppSlot: (slot + k) % 5 }); day++; g++ }
    if (offAt.has(si)) day++
  })
  const out = { games: list, asbAfter: list.findIndex(x => x.asb) }
  SCHED.set(key, out)
  return out
}

// ─── A season around one club ────────────────────────────────────────────────
const newStandings = () => ({ w: new Array(N).fill(0), l: new Array(N).fill(0), rs: new Array(N).fill(0), ra: new Array(N).fill(0), h2h: new Int16Array(N * N), dw: new Array(N).fill(0), dl: new Array(N).fill(0) })
const recorder = st => (h, a, hs, as) => {
  const wH = hs > as
  st.rs[h] += hs; st.ra[h] += as; st.rs[a] += as; st.ra[a] += hs
  if (wH) { st.w[h]++; st.l[a]++; st.h2h[h * N + a]++ } else { st.w[a]++; st.l[h]++; st.h2h[a * N + h]++ }
  if (TEAMS[h].lg === TEAMS[a].lg && TEAMS[h].div === TEAMS[a].div) { if (wH) { st.dw[h]++; st.dl[a]++ } else { st.dw[a]++; st.dl[h]++ } }
}
const lamOf = (E, rates) => (x, y, h) => E.rg * Math.exp(K_OFF * (rates[x].off - E.mOff) - K_DEF * (rates[y].def - E.mDef) + (h ? HOME_ADV : -HOME_ADV))
// every game that doesn't involve his club, from the run model
function playWorld(E, rates, year, U, st, rec, rand) {
  const lam = lamOf(E, rates)
  for (const [h, a, n] of leagueSchedule(year).pairs) {
    if (h === U || a === U) continue
    const lh = lam(h, a, true), la = lam(a, h, false)
    for (let k = 0; k < n; k++) { const [hs, as] = quickGame(E, lh, la, rand); rec(h, a, hs, as) }
  }
}
function leagueRows(st, rand) {
  // st: { w, l, rs, ra, h2h }
  const rows = TEAMS.map(t => ({ i: t.i, short: t.short, name: t.name, lg: t.lg, div: t.div, wins: st.w[t.i], losses: st.l[t.i], rs: st.rs[t.i], ra: st.ra[t.i], tb: rand() }))
  for (const r of rows) { r.pct = r.wins + r.losses ? r.wins / (r.wins + r.losses) : 0; r.diff = r.rs - r.ra }
  return rows
}
// tiebreakers (2022-): head-to-head, then the record inside the division, then run differential (then a draw)
const cmpRows = st => (a, b) => b.pct - a.pct || (st.h2h[b.i * N + a.i] - st.h2h[a.i * N + b.i]) || (divPct(st, b) - divPct(st, a)) || b.diff - a.diff || a.tb - b.tb
function divPct(st, r) { const w = st.dw[r.i], l = st.dl[r.i]; return w + l ? w / (w + l) : 0 }
function seedLeague(rows, st, lg) {
  const cmp = cmpRows(st)
  const mine = rows.filter(r => r.lg === lg)
  const divs = {}
  for (const d of ['East', 'Central', 'West']) {
    const list = mine.filter(r => r.div === d).sort(cmp)
    list.forEach((r, k) => { r.divRank = k + 1; r.gb = r1(((list[0].wins - r.wins) + (r.losses - list[0].losses)) / 2) })
    divs[d] = list
  }
  const winners = Object.values(divs).map(l => l[0]).filter(Boolean).sort(cmp)
  const wild = mine.filter(r => !winners.includes(r)).sort(cmp)
  const seeds = [...winners, ...wild.slice(0, 3)]
  seeds.forEach((r, k) => { r.seed = k + 1; r.clinched = k < 2 ? 'bye' : k < 3 ? 'division' : 'wildcard' })
  const table = mine.slice().sort(cmp)
  table.forEach((r, k) => { r.leagueRank = k + 1 })
  const wc3 = wild[2]
  for (const r of wild) r.wcgb = wc3 ? r1(((wc3.wins - r.wins) + (r.losses - wc3.losses)) / 2) : 0
  return { divs, seeds, table, wild }
}
const rowOut = (r, U) => ({ short: r.short, name: r.name, lg: r.lg, div: r.div, wins: r.wins, losses: r.losses, pct: r3(r.pct), gb: r.gb ?? 0, rs: r.rs, ra: r.ra, diff: r.diff, divRank: r.divRank ?? null, leagueRank: r.leagueRank ?? null, seed: r.seed ?? null, clinched: r.clinched ?? null, wcgb: r.wcgb ?? null, isUs: r.i === U })

// The world: every club's ratings this season, and the user's club's sides for its games
function worldRates(mode, U, uRate) {
  return TEAMS.map(t => (t.i === U ? uRate : mode === 'alltime' ? ALLTIME_RATE.get(t.short) : { off: t.off, def: t.def }))
}
// an opposing club's sides (cached: the data's, not the seed's)
const SIDES = new Map()
function oppSide(E, mode, t, rate) {
  const key = `${mode}|${t.short}|${rate.off}|${rate.def}`
  let s = SIDES.get(key)
  if (s) return s
  const g9 = solveBat(E, teamWoba(E, rate.off))
  const lu = new Array(9).fill({ prof: genBat(E, g9), isB: false })
  const st = staffOf(E, mode, t.short, rate.def)
  s = { lu, st, g9 }
  if (SIDES.size > 400) SIDES.clear()
  SIDES.set(key, s)
  return s
}
const spOf = (st, slot) => { const x = st.rot[slot % st.rot.length]; return { prof: x.prof, isB: !!x.isB, name: x.p?.name ?? null } }

// ─── Awards: the field ───────────────────────────────────────────────────────
// Every real player in the data plays a season around his profile and his club's simulated year: a binomial line
// from his rates against a league-average arm (or bat), his games from his health, his plate appearances from his
// place in the order and his club's runs, his runs and RBI from his line and the men around him, his WAR the same way
// the build's is worked out. (Fitted to the engine's own lines: see scripts/baseball/sim-test.mjs.)
function multi(n, pr, rand) {
  const out = new Array(pr.length).fill(0)
  let left = n, mass = 1
  for (let i = 0; i < pr.length - 1 && left > 0; i++) {
    const k = binom(left, clamp(pr[i] / Math.max(1e-9, mass), 0, 1), rand)
    out[i] = k; left -= k; mass -= pr[i]
  }
  out[pr.length - 1] += left
  return out
}
const SPOT_RBI = [0.8, 0.98, 1.08, 1.12, 1.05, 0.97, 0.92, 0.88, 0.84]
const SPOT_R = [1.12, 1.08, 1.03, 0.99, 0.96, 0.93, 0.9, 0.88, 0.86]
function batSeasonLine(c, E, pos, fr, run, games) {
  const b1 = c.h - c.doubles - c.triples - c.hr
  const den = Math.max(1, c.ab + c.bb + c.sf + c.hbp)
  const woba = (W.bb * c.bb + W.hbp * c.hbp + W.b1 * b1 + W.b2 * c.doubles + W.b3 * c.triples + W.hr * c.hr) / den
  const battingRuns = ((woba - E.woba) / W.scale) * c.pa
  const baserunning = W.sb * c.sb + W.cs * c.cs + 0.9 * run * (c.pa / 650)
  const posAdj = (POS_ADJ[pos] ?? 0) * (games / 162)
  const repl = E.replPA * c.pa
  const avg = c.ab ? c.h / c.ab : 0
  const obp = c.ab + c.bb + c.hbp + c.sf ? (c.h + c.bb + c.hbp) / (c.ab + c.bb + c.hbp + c.sf) : 0
  const tb = b1 + 2 * c.doubles + 3 * c.triples + 4 * c.hr
  const slg = c.ab ? tb / c.ab : 0
  const babipDen = c.ab - c.k - c.hr + c.sf
  return {
    avg: r3(avg), obp: r3(obp), slg: r3(slg), ops: r3(obp + slg), opsPlus: c.pa ? Math.round(100 * (obp / E.obp + slg / E.slg - 1)) : 0,
    woba: r3(woba), babip: babipDen > 0 ? r3((c.h - c.hr) / babipDen) : 0, iso: r3(slg - avg), tb,
    kPct: c.pa ? r1((c.k / c.pa) * 100) : 0, bbPct: c.pa ? r1((c.bb / c.pa) * 100) : 0,
    battingRuns: r1(battingRuns), baserunning: r1(baserunning), fielding: r1(fr), posAdj: r1(posAdj),
    war: r1((battingRuns + baserunning + fr + posAdj + repl) / E.rpw),
  }
}
// pitcher WAR, half FanGraphs (FIP) and half Baseball-Reference (runs allowed), the FanGraphs way: runs saved over
// replacement a nine, against a pitcher-specific runs-per-win, times his innings; relievers' wins by their leverage
function pitWar(E, ip, g, gs, fip, ra9, lev) {
  if (!(ip > 0)) return 0
  const fipR9 = fip + (E.ra9 - E.era)
  const ipg = ip / Math.max(1, g)
  const repl = gs / Math.max(1, g) >= 0.5 ? 0.12 : 0.03
  const one = x => { const rpw = (((18 - ipg) * E.ra9 + ipg * x) / 18 + 2) * 1.5; return ((E.ra9 - x) / rpw + repl) * (ip / 9) }
  return ((one(fipR9) + one(ra9)) / 2) * (gs / Math.max(1, g) >= 0.5 ? 1 : (1 + lev) / 2)
}
const cFipOf = E => {
  const pr = probs(AVG_B(E), AVG_P(E), E)
  const ipPA = E.ipG / E.paG
  return E.era - (13 * pr[3] + 3 * (pr[1] + pr[2]) - 2 * pr[0]) / ipPA
}
for (const E of Object.values(ENV)) E.cfip = cFipOf(E)
function pitSeasonLine(c, E, role) {
  const ip = c.outs / 3
  const era = ip ? (9 * c.er) / ip : 0
  const fip = ip ? (13 * c.hr + 3 * (c.bb + c.hbp) - 2 * c.k) / ip + E.cfip : 0
  const ra9 = ip ? (9 * c.r) / ip : 0
  const lev = role === 'CL' ? 1.8 : role === 'RP' ? 1.35 : 1
  return {
    era: r2(era), fip: r2(fip), whip: ip ? r2((c.h + c.bb) / ip) : 0, ipDec: r1(ip), ip: ipText(c.outs),
    k9: ip ? r1((9 * c.k) / ip) : 0, bb9: ip ? r1((9 * c.bb) / ip) : 0, hr9: ip ? r1((9 * c.hr) / ip) : 0,
    kPct: c.bf ? r1((c.k / c.bf) * 100) : 0, bbPct: c.bf ? r1((c.bb / c.bf) * 100) : 0, eraPlus: era ? Math.round((100 * E.era) / era) : 0,
    war: r1(pitWar(E, ip, c.g, c.gs, fip, ra9, lev)),
  }
}
function availOf(rand, durI, age, base) {
  // an injured-list stint: durability (speed for a hitter, stamina for a pitcher) and age
  const p = clamp(base - 0.018 * durI + (age >= 35 ? 0.12 : age >= 32 ? 0.06 : 0), 0.05, 0.55)
  if (rand() < p) { const len = 10 + Math.floor(55 * rand() * rand()); return { from: Math.floor(rand() * 150), len } }
  return null
}
function fieldBatter(E, x, ctx, rand) {
  const { p, prof } = x
  const role = p.role
  const age = p.age ?? 28
  const il = availOf(rand, prof.spd - 5.5, age, 0.2)
  const rest = role === 'C' ? 20 + poisson(5, rand) : role === 'DH' ? 2 + poisson(2, rand) : 3 + poisson(3, rand)
  const games = clamp(162 - (il?.len ?? 0) - rest, 20, 162)
  const spot = x.spot
  const ctxF = ctx.rg / E.rg
  const pa = Math.round(games * SPOT_W[spot] * (1 + 0.035 * (ctx.rg - E.rg)))
  const pr = probs(prof, AVG_P(E), E)
  const [k, bb, hbp, hr, b1, b2, b3, roe, gbo, fbo] = multi(pa, pr, rand)
  const sf = binom(fbo, (E.SF / Math.max(0.05, pr[9])) * Math.pow(ctxF, 0.6), rand)
  const h = b1 + b2 + b3 + hr
  const ab = pa - bb - hbp - sf
  const on1 = (b1 + bb + hbp + roe) * 0.85
  const att = binom(Math.round(on1), clamp(1 - Math.pow(1 - prof.att, 1.45), 0, 0.85), rand)
  const sb = binom(att, prof.sbp, rand), cs = att - sb
  const gidp = binom(gbo, 0.11 * Math.exp(-0.12 * prof.run), rand)
  const f = Math.pow(ctxF, 0.85)
  const runs = hr + binom(b1 + bb + hbp + roe, clamp((0.29 + 0.012 * prof.run + 0.04 * (sb / Math.max(1, on1))) * f * SPOT_R[spot], 0.05, 0.7), rand) + binom(b2, clamp(0.46 * f * SPOT_R[spot], 0, 0.9), rand) + binom(b3, clamp(0.72 * f, 0, 0.95), rand)
  const rbi = hr + binom(hr, clamp(0.55 * f * SPOT_RBI[spot], 0, 1), rand) + binom(b1, clamp(0.135 * f * SPOT_RBI[spot], 0, 0.5), rand) + binom(b2, clamp(0.31 * f * SPOT_RBI[spot], 0, 0.8), rand) + binom(b3, clamp(0.5 * f * SPOT_RBI[spot], 0, 0.9), rand) + sf + binom(gbo, clamp(0.03 * f * SPOT_RBI[spot], 0, 0.2), rand) + binom(bb + hbp, 0.012, rand)
  const fr = (fieldRunsAt(k2 => p.attrs?.[k2], role) + gauss(rand) * 3) * (games / 150)
  const c = { g: games, pa, ab, h, doubles: b2, triples: b3, hr, rbi, runs, bb, k, hbp, sf, sb, cs, gidp }
  const L = batSeasonLine(c, E, role, fr, prof.run, games)
  // (what the awards and the leaders read: the book keeps every one of these)
  return { name: p.name, team: p.team, lg: ctx.lg, role, rookie: p.rookie ?? (age <= 23), kind: 'bat', g: games, pa, h, hr, rbi, runs, sb, avg: L.avg, obp: L.obp, slg: L.slg, ops: L.ops, opsPlus: L.opsPlus, war: L.war, battingRuns: L.battingRuns, fr: r1(fr), firstHalf: r1(L.war * 0.59 + gauss(rand) * 0.7) }
}
function fieldPitcher(E, x, ctx, rand) {
  const { p, prof } = x
  const role = p.role
  const age = p.age ?? 29
  const il = availOf(rand, prof.sta - 5.5, age, role === 'SP' ? 0.26 : 0.18)
  const pr = probs(AVG_B(E), prof, E)
  let gs = 0, g, outs
  if (role === 'SP') {
    gs = Math.max(4, (x.slot === 0 ? 33 : 32) - Math.round((il?.len ?? 0) / 5))
    g = gs
    outs = Math.round(gs * ipPerStart(E, prof) * 3 * (1 + 0.02 * gauss(rand)))
  } else {
    g = Math.max(10, 66 - Math.round((il?.len ?? 0) / 2.4) + Math.round(gauss(rand) * 4))
    outs = Math.round(g * (role === 'CL' ? 3.0 : 3.15))
  }
  const outsPerBF = clamp(1 - onBaseOf(pr) + 0.024, 0.55, 0.85)
  const bf = Math.round(outs / outsPerBF)
  const [k, bb, hbp, hr, b1, b2, b3, roe] = multi(bf, pr, rand)
  const h = b1 + b2 + b3 + hr
  // runs: Base Runs (David Smyth), with the sequencing luck of a season
  const A = h + bb + hbp - hr + roe, Bv = (1.4 * (b1 + 2 * b2 + 3 * b3 + 4 * hr) - 0.6 * h - 3 * hr + 0.1 * (bb + hbp)) * 1.02, C = outs
  const runs = Math.max(0, Math.round(((A * Bv) / Math.max(1, Bv + C) + hr) * (E.rg / 4.3) * Math.exp(0.09 * gauss(rand))))
  const er = Math.round(runs * 0.925)
  const ra9 = outs ? (27 * runs) / outs : E.ra9
  const pct = ctx.wins / 162
  let w, l, sv = 0, hld = 0, svo = 0, bsv = 0
  if (role === 'SP') {
    const dec = binom(gs, 0.72 + 0.02 * (ipPerStart(E, prof) - 5.5), rand)
    const pw = clamp(pct + 0.075 * (E.ra9 - ra9), 0.15, 0.88)
    w = binom(dec, pw, rand); l = dec - w
  } else {
    w = binom(g, 0.055 * (pct / 0.5), rand); l = binom(g, 0.045, rand)
    if (role === 'CL') {
      svo = binom(Math.round(ctx.wins * 0.55), clamp(g / 68, 0.2, 1), rand)
      sv = binom(svo, clamp(0.87 + 0.02 * (E.ra9 - ra9), 0.6, 0.97), rand); bsv = svo - sv
    } else { hld = binom(g, clamp(0.3 * (pct / 0.5), 0.05, 0.6), rand); sv = binom(g, 0.03, rand) }
  }
  const c = { g, gs, outs, bf, h, r: runs, er, bb, k, hr, hbp, w, l, sv, hld, svo, bs: bsv }
  const L = pitSeasonLine(c, E, role)
  return { name: p.name, team: p.team, lg: ctx.lg, role, rookie: p.rookie ?? (age <= 23), kind: 'pit', g, gs, ip: L.ip, ipDec: L.ipDec, w, l, era: L.era, k, sv, whip: L.whip, fip: L.fip, war: L.war, firstHalf: r1(L.war * 0.58 + gauss(rand) * 0.6) }
}
function seasonField(E, mode, ctxOf, exclude, rand) {
  const out = []
  for (const t of TEAMS) {
    const ctx = ctxOf(t)
    const out1 = (p, kind) => exclude.has(p.name) || exclude.has(`${kind}:${p.name}`)
    const bats = batsOf(E, mode, t.short).filter(x => !out1(x.p, 'bat'))
    // the order: by on-base and power, the club's best two bats at the top
    bats.forEach((x, k) => { x.spot = Math.min(8, spotOf(E, x.prof, x.woba) + (k > 4 ? 1 : 0)) })
    for (const x of bats) out.push(fieldBatter(E, x, ctx, rand))
    const pits = (PLAYERS[mode].pit.get(t.short) ?? []).filter(p => !out1(p, 'pit'))
    const sps = realRotation(E, mode, t.short, null).filter(x => !out1(x.p, 'pit'))
    sps.forEach((x, k) => { x.slot = k })
    for (const x of sps) out.push(fieldPitcher(E, x, ctx, rand))
    for (const p of pits.filter(q => q.role !== 'SP')) out.push(fieldPitcher(E, { p, prof: realPit(E, p, true) }, ctx, rand))
  }
  return out
}

// the book's field: every real player's season in this world (the clubs' runs and wins), and the voters' opinions
function fieldOf(book) {
  if (book.field) return book.field
  const E = ENV[book.mode]
  const w = new Map((book.world ?? []).map(([s, rs, wins]) => [s, { rs, wins }]))
  const field = seasonField(E, book.mode, tt => ({ rg: (w.get(tt.short)?.rs ?? E.rg * 162) / 162, wins: w.get(tt.short)?.wins ?? 81, lg: tt.lg }), new Set(book.exclude ?? []), stream(book.seed, 'field'))
  const fv = stream(book.seed, 'votes')
  for (const e of field) e.v = voteOf(fv)
  book.field = field
  return field
}

// ─── The awards ──────────────────────────────────────────────────────────────
// The voters' case for each award (WAR first, the way today's BBWAA votes, with the numbers and the club's year
// around it), each candidate's own seeded "voters' opinion" (vote) on top, kept in the book so the awards can be
// decided again from a spliced line. Leaders qualify the way MLB's do: 3.1 PA a team game (502), 1 IP a team game (162).
const Q_PA = 502, Q_IP = 162
const isRel = e => e.kind === 'pit' && e.role !== 'SP'
const SCORE = {
  mvp: e => (e.kind === 'bat' ? e.war + 0.05 * (e.teamWins - 81) + 0.012 * e.hr + 0.004 * e.rbi : e.role === 'SP' ? e.war * 0.8 + 0.03 * (e.teamWins - 81) - 1.2 : -9) + e.v.mvp * 1.2,
  cy: e => (e.kind !== 'pit' ? -99 : (0.6 * e.war + 0.9 * Math.max(0, 4.1 - e.era) * Math.min(1, e.ipDec / 180) + e.k / 90 + 0.06 * (e.w - 10) + (isRel(e) ? 0.02 * e.sv - 1.6 : 0)) * (e.ipDec >= 40 ? 1 : 0.2) + e.v.cy),
  roy: e => (e.kind === 'bat' ? e.war + 0.01 * e.hr : e.war * 1.05) + e.v.roy,
  ss: e => e.battingRuns + 0.12 * e.hr + 0.03 * e.rbi + e.v.ss * 2.5,
  gg: e => e.fr + e.v.gg * 1.6,
  asg: e => e.firstHalf + e.v.asg * 0.7 + (e.kind === 'bat' ? 0.01 * e.hr : 0),
  aaron: e => e.battingRuns + 0.15 * e.hr + 0.05 * e.rbi + e.v.aaron * 3,
  rel: e => e.war * 1.3 + 0.03 * e.sv + 0.25 * Math.max(0, 4.1 - e.era) + e.v.rel * 0.4,
  mlb: e => (e.kind === 'bat' ? e.war + 0.008 * e.hr : e.war * (isRel(e) ? 1.5 : 1)) + e.v.mlb * 0.6,
}
const VOTES = ['mvp', 'cy', 'roy', 'ss', 'gg', 'asg', 'aaron', 'rel', 'mlb']
const voteOf = rand => Object.fromEntries(VOTES.map(k => [k, r2(gauss(rand))]))
const SS_SLOTS = { C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', LF: 'OF', CF: 'OF', RF: 'OF', DH: 'DH' }
const entryOut = e => {
  const base = { name: e.isPlayer ? null : e.name, team: e.team, lg: e.lg, role: e.role, isPlayer: !!e.isPlayer }
  return e.kind === 'bat'
    ? { ...base, g: e.g, pa: e.pa, avg: e.avg, obp: e.obp, slg: e.slg, ops: e.ops, hr: e.hr, rbi: e.rbi, runs: e.runs, sb: e.sb, h: e.h, war: e.war, opsPlus: e.opsPlus }
    : { ...base, g: e.g, gs: e.gs, ip: e.ip, ipDec: e.ipDec, w: e.w, l: e.l, era: e.era, k: e.k, sv: e.sv, whip: e.whip, war: e.war, fip: e.fip }
}
// the top n by a score (one pass: the lists are long, the tops short) and where `me` ranks
function topBy(list, val, n, me, desc = true) {
  const top = [], tv = []
  let mv = null, better = 0
  if (me) mv = val(me)
  for (const e of list) {
    const v = val(e)
    if (me && e !== me && (desc ? v > mv : v < mv)) better++
    let k = top.length
    while (k > 0 && (desc ? v > tv[k - 1] || (v === tv[k - 1] && e.isPlayer) : v < tv[k - 1] || (v === tv[k - 1] && e.isPlayer))) k--
    if (k < n) { top.splice(k, 0, e); tv.splice(k, 0, v); if (top.length > n) { top.pop(); tv.pop() } }
  }
  return { top, tv, rank: me && list.includes(me) ? better + 1 : null, mv }
}
function voteAward(pool, score, me, n = 10, finishes = [1, 3, 5, 10]) {
  const { top: t, tv, rank } = topBy(pool, score, n, me)
  const top = t.map((e, i) => ({ ...entryOut(e), score: r1(tv[i]) }))
  const fin = !rank ? null : rank === 1 ? 'winner' : rank <= finishes[1] ? 'top3' : rank <= finishes[2] ? 'top5' : rank <= finishes[3] ? 'top10' : null
  return { won: rank === 1, rank: rank || null, finish: fin, winner: top[0] ?? null, top }
}
const LEADER_STATS = {
  avg: { key: 'avg', q: e => e.kind === 'bat' && e.pa >= Q_PA, desc: true }, hr: { key: 'hr', q: e => e.kind === 'bat', desc: true },
  rbi: { key: 'rbi', q: e => e.kind === 'bat', desc: true }, sb: { key: 'sb', q: e => e.kind === 'bat', desc: true },
  ops: { key: 'ops', q: e => e.kind === 'bat' && e.pa >= Q_PA, desc: true }, h: { key: 'h', q: e => e.kind === 'bat', desc: true },
  w: { key: 'w', q: e => e.kind === 'pit', desc: true }, era: { key: 'era', q: e => e.kind === 'pit' && e.ipDec >= Q_IP, desc: false },
  k: { key: 'k', q: e => e.kind === 'pit', desc: true }, sv: { key: 'sv', q: e => e.kind === 'pit', desc: true },
}
function leaderOf(pool, stat, me) {
  const L = LEADER_STATS[stat]
  const q = pool.filter(L.q)
  const val = e => e[L.key] ?? 0
  const qualified = !!me && q.includes(me)
  const { top, tv, rank } = topBy(q, val, 5, qualified ? me : null, L.desc)
  const best = top.length ? tv[0] : null
  const won = qualified && best != null && val(me) === best && (L.desc ? val(me) > 0 : true)
  const shared = won && tv.filter(v => v === best).length > 1
  return { won, shared, rank: qualified ? rank : null, qualified, value: me ? val(me) : null, winner: top[0] ? entryOut(top[0]) : null, top: top.map(entryOut) }
}
// every award for both leagues; `me` (the build's entry) races in his own league
function decideAwards(book, me) {
  const out = {}
  const lgs = ['AL', 'NL']
  const pools = Object.fromEntries(lgs.map(lg => [lg, [...book.field.filter(e => e.lg === lg), ...(me && me.lg === lg ? [me] : [])]]))
  for (const e of [...book.field, ...(me ? [me] : [])]) e.teamWins = book.teamWins[e.team] ?? 81
  const myLg = me?.lg ?? 'AL', other = myLg === 'AL' ? 'NL' : 'AL'
  const both = (fn) => { const a = fn(pools[myLg], me), b = fn(pools[other], null); return { ...a, other: { winner: b.winner } } }
  out.mvp = both((pool, m) => voteAward(pool.filter(e => e.kind === 'bat' || (e.role === 'SP' && e.ipDec >= 120)), SCORE.mvp, m))
  out.cyYoung = both((pool, m) => voteAward(pool.filter(e => e.kind === 'pit' && e.ipDec >= 40), SCORE.cy, m, 10, [1, 3, 5, 10]))
  out.roy = both((pool, m) => { const el = pool.filter(e => e.rookie && (e.kind === 'bat' ? e.pa >= 130 : e.ipDec >= 50)); const r = voteAward(el, SCORE.roy, m && el.includes(m) ? m : null, 5); return { ...r, eligible: !!m && el.includes(m) } })
  out.reliever = both((pool, m) => { const el = pool.filter(e => isRel(e) && e.ipDec >= 40); const r = voteAward(el, SCORE.rel, m && el.includes(m) ? m : null, 5); return { ...r, eligible: !!m && el.includes(m), name: myLg === 'AL' ? 'Mariano Rivera AL Reliever of the Year' : 'Trevor Hoffman NL Reliever of the Year' } })
  out.hankAaron = both((pool, m) => { const el = pool.filter(e => e.kind === 'bat' && e.pa >= 350); const r = voteAward(el, SCORE.aaron, m && el.includes(m) ? m : null, 5); return { ...r, eligible: !!m && el.includes(m) } })
  // by position: Silver Slugger (three outfielders), Gold Glove (the spot he plays), All-Star, All-MLB
  const slot = e => (e.kind === 'bat' ? SS_SLOTS[e.role] ?? 'DH' : e.role === 'SP' ? 'SP' : 'RP')
  if (me && me.kind === 'bat') {
    const s = slot(me)
    const el = pools[myLg].filter(e => e.kind === 'bat' && slot(e) === s && e.pa >= 350)
    const r = voteAward(el, SCORE.ss, el.includes(me) ? me : null, 5)
    const n = s === 'OF' ? 3 : 1
    out.silverSlugger = { won: !!r.rank && r.rank <= n, rank: r.rank, eligible: el.includes(me), slot: s, winner: r.winner, top: r.top }
    const gpos = me.role
    const gel = pools[myLg].filter(e => e.kind === 'bat' && e.role === gpos && gpos !== 'DH' && e.g >= 100)
    const g = gpos === 'DH' ? null : voteAward(gel, SCORE.gg, gel.includes(me) ? me : null, 5)
    out.goldGlove = g ? { won: g.rank === 1, rank: g.rank, eligible: gel.includes(me), pos: gpos, winner: g.winner, top: g.top } : { won: false, rank: null, eligible: false, pos: gpos, winner: null, top: [] }
  } else {
    out.silverSlugger = { won: false, rank: null, eligible: false, slot: null, winner: null, top: [] }
    out.goldGlove = { won: false, rank: null, eligible: false, pos: null, winner: null, top: [] }
  }
  // All-Star: first-half seasons; two a spot (six outfielders, nine starters and four relievers a league); the top
  // one at each spot starts (the fans' vote). Pitchers: about the first 95 games.
  if (me) {
    const s = slot(me)
    const el = pools[myLg].filter(e => slot(e) === s && (e.kind === 'bat' ? e.g >= 40 : e.ipDec >= 20))
    const r = voteAward(el, SCORE.asg, el.includes(me) ? me : null, 6)
    const n = s === 'OF' ? 6 : s === 'SP' ? 9 : s === 'RP' ? 4 : 2
    out.allStar = { selected: !!r.rank && r.rank <= n, starter: !!r.rank && r.rank <= (s === 'OF' ? 3 : 1) && me.kind === 'bat', rank: r.rank, slot: s, won: !!r.rank && r.rank <= n }
    // All-MLB (both leagues): first and second teams, a spot each (three outfielders, five starters, two relievers)
    const all = [...book.field, me].filter(e => slot(e) === s && (e.kind === 'bat' ? e.pa >= 400 : e.ipDec >= (s === 'SP' ? 130 : 45)))
    const ar = voteAward(all, SCORE.mlb, all.includes(me) ? me : null, 10)
    const m = s === 'OF' ? 3 : s === 'SP' ? 5 : s === 'RP' ? 2 : 1
    out.allMLB = { team: ar.rank && ar.rank <= m ? 'first' : ar.rank && ar.rank <= 2 * m ? 'second' : null, rank: ar.rank, slot: s, won: !!ar.rank && ar.rank <= m }
  }
  // the leaders, both leagues, and his titles
  out.leaders = Object.fromEntries(lgs.map(lg => [lg, Object.fromEntries(Object.keys(LEADER_STATS).map(k => [k, leaderOf(pools[lg], k, lg === myLg ? me : null)]))]))
  const L = out.leaders[myLg]
  const isBat = me?.kind === 'bat'
  out.battingTitle = isBat ? L.avg : { won: false }
  out.hrLeader = isBat ? L.hr : { won: false }
  out.rbiLeader = isBat ? L.rbi : { won: false }
  out.sbLeader = isBat ? L.sb : { won: false }
  out.kLeader = !isBat && me ? L.k : { won: false }
  out.winsLeader = !isBat && me ? L.w : { won: false }
  out.eraTitle = !isBat && me ? L.era : { won: false }
  out.svLeader = !isBat && me ? L.sv : { won: false }
  out.tripleCrown = { won: isBat ? L.avg.won && L.hr.won && L.rbi.won : !!me && L.w.won && L.era.won && L.k.won, kind: isBat ? 'batting' : 'pitching' }
  return out
}

// ─── His season line from his games ──────────────────────────────────────────
export const BASEBALL_COUNTS = {
  bat: { seasonG: 'gp', seasonGS: 'gs', seasonPA: 'pa', seasonAB: 'ab', seasonH: 'h', season2B: 'doubles', season3B: 'triples', seasonHR: 'hr', seasonRBI: 'rbi', seasonR: 'r', seasonBB: 'bb', seasonK: 'k', seasonHBP: 'hbp', seasonSF: 'sf', seasonSB: 'sb', seasonCS: 'cs' },
  pit: { seasonG: 'app', seasonGS: 'gs', seasonOuts: 'outs', seasonBF: 'bf', seasonH: 'h', seasonR: 'r', seasonER: 'er', seasonBB: 'bb', seasonK: 'k', seasonHR: 'hr', seasonHBP: 'hbp', seasonW: 'w', seasonL: 'l', seasonSV: 'sv', seasonHLD: 'hld', seasonBS: 'bs', seasonQS: 'qs' },
}
const sumOf = (games, k) => games.reduce((s, g) => s + (g[k] ?? 0), 0)
function batCounts(games) {
  const pl = games.filter(g => g.gp && !g.sat)
  const c = {}
  for (const k of ['gs', 'pa', 'ab', 'h', 'doubles', 'triples', 'hr', 'rbi', 'r', 'bb', 'k', 'hbp', 'sf', 'sb', 'cs', 'gidp']) c[k] = sumOf(pl, k)
  c.g = pl.length; c.runs = c.r
  return c
}
function pitCounts(games) {
  const pl = games.filter(g => g.app && !g.sat)
  const c = {}
  for (const k of ['gs', 'outs', 'bf', 'pitches', 'h', 'r', 'er', 'bb', 'k', 'hr', 'hbp', 'w', 'l', 'sv', 'hld', 'bs', 'svo', 'qs', 'cg', 'sho', 'nh']) c[k] = sumOf(pl, k)
  c.g = pl.length
  return c
}
function hitStreak(games) { let best = 0, run = 0; for (const g of games) { if (!g.gp || g.sat) continue; if (g.h > 0) { run++; best = Math.max(best, run) } else if (g.ab > 0) run = 0 } return best }
// the line, from his games (a spliced season too)
export function baseballTotals(games, position, result = null) {
  const E = ENV[result?.mode === 'alltime' ? 'alltime' : 'current']
  if (posOf(position) === 'pit') {
    const c = pitCounts(games ?? [])
    const line = pitSeasonLine(c, E, result?.role ?? 'SP')
    return { ...c, ipOuts: c.outs, ...line, noHitters: c.nh }
  }
  const c = batCounts(games ?? [])
  const pos = result?.pos ?? 'DH'
  const frRate = result?.frRate ?? 0
  const fr = frRate * (c.g / 150)
  const line = batSeasonLine(c, E, pos, fr, result?.runIdx ?? 0, c.g)
  const pl = (games ?? []).filter(g => g.gp && !g.sat)
  return { ...c, ...line, multiHR: pl.filter(g => g.hr >= 2).length, cycles: pl.filter(g => g.cycle).length, grandSlams: sumOf(pl, 'slam'), walkoffs: sumOf(pl, 'wo'), hitStreak: hitStreak(games ?? []) }
}
const seasonFields = (games, position) => {
  const m = BASEBALL_COUNTS[posOf(position)]
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, sumOf((games ?? []).filter(g => !g.sat), v)]))
}
function displayLine(t, pos) {
  if (pos === 'pit') return { 'W-L': `${t.w}-${t.l}`, ERA: t.era.toFixed(2), G: t.g, GS: t.gs, IP: t.ip, K: t.k, BB: t.bb, WHIP: t.whip.toFixed(2), SV: t.sv, FIP: t.fip.toFixed(2), WAR: t.war.toFixed(1) }
  return { G: t.g, PA: t.pa, AB: t.ab, H: t.h, '2B': t.doubles, '3B': t.triples, HR: t.hr, RBI: t.rbi, R: t.runs, BB: t.bb, K: t.k, SB: t.sb, AVG: fmtRate(t.avg), OBP: fmtRate(t.obp), SLG: fmtRate(t.slg), OPS: fmtRate(t.ops), 'OPS+': t.opsPlus, WAR: t.war.toFixed(1) }
}
// the entry he races the field with
function meEntry(t, pos, role, lg, U, rookie, age) {
  if (pos === 'pit') return { isPlayer: true, name: null, team: U, lg, role, kind: 'pit', age, rookie, ...t, firstHalf: t.firstHalf ?? t.war * 0.58, v: t.v }
  return { isPlayer: true, name: null, team: U, lg, role, kind: 'bat', age, rookie, ...t, fr: t.fielding, firstHalf: t.firstHalf ?? t.war * 0.59, v: t.v }
}

// ─── Season archetypes ───────────────────────────────────────────────────────
// role (optional): the pitcher's job this season ('SP' | 'RP' | 'CL'); the man holding the closer's job reads as a
// closer at every grade. Without it the build's stamina decides starter or reliever.
export function getBaseballArchetype(ovr, build, types, position, role = null) {
  const pos = posOf(position, types)
  const t = types?.length ? types : pos === 'pit' ? PIT_TRAITS : BAT_TRAITS
  const filled = t.filter(k => build?.[k])
  if (!filled.length) return 'Spin to start building'
  const rem = t.length - filled.length
  if (rem > 0) return `${rem} attribute${rem !== 1 ? 's' : ''} remaining`
  const g = k => build[k]?.val ?? 0
  const vals = filled.map(k => g(k))
  const spread = Math.max(...vals) - Math.min(...vals), mean = avg(vals)
  const ranked = t.map(k => [k, g(k)]).sort((a, b) => b[1] - a[1])
  const top = k => ranked[0][0] === k || ranked[1][0] === k, top3 = k => top(k) || ranked[2][0] === k, peak = k => ranked[0][0] === k
  if (pos === 'bat') {
    const tools = [g('contact'), g('power'), g('speed'), g('fielding'), g('arm')]
    const fiveTool = tools.every(v => v >= 8)
    const slugger = top('power') || (g('power') >= 9 && top3('power'))
    const ttO = slugger && g('eye') >= 8 && g('avoidK') <= 4
    const hitter = top('contact') && top3('avoidK')
    const tableSetter = (top('eye') || top('contact')) && top3('speed')
    const powerSpeed = top3('power') && top3('speed')
    const glove = top('fielding') && top3('arm')
    const speedster = peak('speed') || (top('speed') && top3('baserunning'))
    if (ovr >= 95) {
      if (fiveTool || (spread <= 2 && mean >= 9)) return 'Five-Tool Superstar'
      if (slugger && g('eye') >= 9) return 'Generational Slugger'
      if (hitter) return 'Hit Machine'
      if (powerSpeed) return 'Power-Speed Phenom'
      if (glove) return 'Two-Way Superstar'
      return 'Perennial MVP Candidate'
    }
    if (ovr >= 90) {
      if (fiveTool) return 'Five-Tool Star'
      if (ttO) return 'Three True Outcomes Slugger'
      if (slugger) return 'Elite Slugger'
      if (hitter) return 'Batting Champion'
      if (powerSpeed) return 'Power-Speed Threat'
      if (tableSetter) return 'Elite Table Setter'
      if (glove) return 'Platinum Glove'
      if (top('clutch')) return 'Big-Game Bat'
      return 'All-Star Bat'
    }
    if (ovr >= 84) {
      if (ttO) return 'Three True Outcomes Slugger'
      if (slugger) return 'Middle-of-the-Order Slugger'
      if (hitter) return 'Professional Hitter'
      if (tableSetter) return 'Leadoff Catalyst'
      if (powerSpeed) return 'Power-Speed Threat'
      if (glove) return 'Defensive Wizard'
      if (speedster) return 'Speedster'
      if (peak('gap')) return 'Gap-to-Gap Hitter'
      if (peak('arm')) return 'Cannon Arm'
      if (peak('eye')) return 'On-Base Machine'
      if (peak('clutch')) return 'Run Producer'
      return 'First-Division Regular'
    }
    // (the OVR scale: an all-B build is about 81, B- about 77, C+ about 72; a B-/B bat is a big-league regular)
    if (ovr >= 76) {
      if (slugger) return 'Power Bat'
      if (hitter) return 'Contact Hitter'
      if (speedster) return 'Speed-First Sparkplug'
      if (glove) return 'Glove-First Regular'
      if (peak('eye')) return 'Patient Hitter'
      if (peak('gap')) return 'Spray Hitter'
      if (g('eye') <= 3 && g('avoidK') <= 4) return 'Free Swinger'
      if (spread <= 2) return 'Utility Regular'
      return 'Everyday Regular'
    }
    if (ovr >= 70) {
      if (slugger) return 'Platoon Bat'
      if (speedster) return 'Pinch Runner'
      if (glove) return 'Defensive Replacement'
      return 'Bottom-of-the-Order Bat'
    }
    if (ovr >= 64) return 'Bench Bat'
    return 'Triple-A Depth'
  }
  const job = String(role ?? '').toUpperCase()
  const pRole = PITCH_ROLES.has(job) ? job : baseballPitchRole(build)
  const stuff = top3('velocity') && top3('breaking')
  const power = peak('velocity') || (top('velocity') && g('velocity') >= 9)
  const control = top('control') && top3('command')
  const sinker = top('groundball') && top3('movement')
  const craft = top('pitchIQ') && (top3('command') || top3('changeup'))
  const workhorse = top('stamina')
  const bulldog = top('composure')
  if (pRole === 'SP') {
    if (ovr >= 95) {
      if (spread <= 2 && mean >= 9) return 'Generational Ace'
      if (stuff) return 'Unhittable Power Ace'
      if (control || craft) return 'Cy Young Ace'
      return 'Cy Young Ace'
    }
    if (ovr >= 90) {
      if (stuff) return 'Strikeout Artist'
      if (power) return 'Power Ace'
      if (control) return 'Control Artist'
      if (sinker) return 'Groundball Machine'
      if (craft) return 'Crafty Ace'
      if (workhorse) return 'Workhorse Ace'
      return 'Frontline Ace'
    }
    if (ovr >= 84) {
      if (power || stuff) return 'Power Arm'
      if (sinker) return 'Sinkerballer'
      if (control) return 'Finesse Pitcher'
      if (craft) return 'Crafty Veteran'
      if (workhorse) return 'Innings Eater'
      if (peak('changeup')) return 'Changeup Specialist'
      if (bulldog) return 'Bulldog'
      return 'No. 2 Starter'
    }
    if (ovr >= 76) {
      if (workhorse) return 'Innings Eater'
      if (sinker) return 'Groundball Starter'
      if (power) return 'Hard-Throwing Starter'
      if (control) return 'Strike Thrower'
      return 'Mid-Rotation Starter'
    }
    if (ovr >= 68) return workhorse ? 'Back-End Starter' : 'Spot Starter'
    return 'Triple-A Arm'
  }
  if (ovr >= 95) return stuff || power ? 'Untouchable Closer' : 'Lights-Out Closer'
  // (the closer's job: closer wording at every grade, the setup roles below are for the rest of the pen)
  if (pRole === 'CL' && ovr < 90) {
    if (ovr >= 84) return power || stuff ? 'Power Closer' : sinker ? 'Groundball Closer' : bulldog ? 'Ice-Water Closer' : 'Shutdown Closer'
    if (ovr >= 76) return power ? 'Hard-Throwing Closer' : sinker ? 'Groundball Closer' : 'Closer'
    return ovr >= 68 ? 'Stopgap Closer' : 'Emergency Closer'
  }
  if (ovr >= 90) {
    if (power) return 'Flamethrowing Closer'
    if (sinker) return 'Groundball Closer'
    if (bulldog) return 'Ice-Water Closer'
    return 'Elite Closer'
  }
  if (ovr >= 84) {
    if (power || stuff) return 'High-Leverage Power Arm'
    if (sinker) return 'Double-Play Specialist'
    if (bulldog) return 'Fireman'
    return 'Late-Inning Reliever'
  }
  if (ovr >= 76) return power ? 'Hard-Throwing Setup Man' : sinker ? 'Groundball Specialist' : 'Setup Man'
  if (ovr >= 68) return 'Middle Reliever'
  return 'Mop-Up Man'
}

// ─── Putting a season together ───────────────────────────────────────────────
function resolveTeam(team) { return teamKey(team?.short) ?? TEAMS.find(t => t.name === team?.name) ?? TEAMS[0] }
function ratingsOf(src, team, mode, tr) {
  if (tr) return { off: num(tr.off, 5.5), def: num(tr.def, 5.5) }
  if (team?.career) return { off: clamp(num(team.off, 5.5), 0, 11), def: clamp(num(team.def, 5.5), 0, 11) }
  const base = mode === 'alltime' ? ALLTIME_RATE.get(src.short) ?? { off: 5.5, def: 5.5 } : { off: src.off, def: src.def }
  return { off: base.off + num(team?.offMod, 0), def: base.def + num(team?.defMod, 0) }
}
function buildAge(build, team) {
  if (team?.age != null) return team.age
  const ages = Object.values(build ?? {}).filter(Boolean).map(c => c.age ?? NAME_AGE.get(c.qbFull ?? c.name)).filter(a => typeof a === 'number')
  return ages.length ? Math.round(avg(ages)) : null
}
const yearOf = (team, mode) => (team?.year ?? team?.season ?? (mode === 'alltime' ? 'alltime' : 2026))
// his club in a season: the lineup and the staff with him in, and how the rest are solved
function usSides(E, mode, club, rate, me, team) {
  const st = staffOf(E, mode, club.short, rate.def, me.pos === 'pit' ? { build: { prof: me.prof, role: me.role }, replaced: me.replaced?.p ?? null } : {})
  let g = solveBat(E, teamWoba(E, rate.off)), gBench = g - 1.3
  if (me.pos === 'bat' && me.replaced) {
    const ws = SPOT_W[me.replaced.spot]
    const rest = (teamWoba(E, rate.off) * SPOT_SUM - me.replaced.woba * ws) / (SPOT_SUM - ws)
    g = solveBat(E, rest); gBench = g - 1.3
  }
  return { st, g, gBench }
}
function lineFields(isBat) {
  return isBat ? { gp: 0, gs: 0, pa: 0, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, r: 0, bb: 0, k: 0, hbp: 0, sf: 0, sb: 0, cs: 0, gidp: 0, tb: 0, cycle: false, slam: 0, wo: 0 }
    : { app: 0, gs: 0, outs: 0, ip: '0.0', bf: 0, pitches: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, hbp: 0, w: 0, l: 0, sv: 0, hld: 0, bs: 0, svo: 0, qs: 0, cg: 0, sho: 0, nh: 0, dec: null }
}
function finishBatLine(L) {
  if (!L) return null
  const b1 = L.h - L.doubles - L.triples - L.hr
  return { ...L, tb: b1 + 2 * L.doubles + 3 * L.triples + 4 * L.hr, cycle: b1 > 0 && L.doubles > 0 && L.triples > 0 && L.hr > 0 }
}
function finishPitLine(L) {
  if (!L) return null
  return { ...L, ip: ipText(L.outs), dec: L.w ? 'W' : L.l ? 'L' : L.sv ? 'S' : L.hld ? 'H' : L.bs ? 'BS' : null }
}

// the season, around his club
function season(build, types, team, position, mode, base, gameMode, script) {
  const E = ENV[mode]
  const pos = posOf(position, types)
  const club = resolveTeam(team)
  const U = club.i
  const t = types?.length ? types : pos === 'pit' ? PIT_TRAITS : BAT_TRAITS
  const ovr = calcBaseballOVR(build, t, pos)
  const get = k => build?.[k]?.val
  const isBat = pos === 'bat'
  // who he is, and who he replaces
  const roleArg = String(team?.role ?? '').toUpperCase()
  let role, prof, replaced = null, spot = 0, frRate = 0, runIdx = 0
  if (isBat) {
    prof = { ...batProfile(get, E, `B:${t.map(k => get(k) ?? '-').join(',')}`), isB: true }
    replaced = team?.replaces === false || script ? null : replacedOf(E, mode, club.short, 'bat', null, team?.replaces)
    if (replaced) replaced.spot = spotOf(E, replaced.prof, replaced.woba)
    const want = BAT_ROLES.has(roleArg) ? roleArg : replaced?.p.role ?? null
    role = BAT_ROLES.has(roleArg) ? roleArg : bestPosition(get, want)
    const woba = batWoba(E, prof)
    spot = clamp(num(team?.order, 0) ? num(team.order, 1) - 1 : spotOf(E, prof, woba), 0, 8)
    frRate = fieldRunsAt(get, role)
    runIdx = prof.run
  } else {
    const sr = PITCH_ROLES.has(roleArg) ? (roleArg === 'SP' ? 'SP' : 'RP') : baseballPitchRole(build)
    prof = pitProfile(get, E, sr !== 'SP', `P:${sr}:${t.map(k => get(k) ?? '-').join(',')}`)
    if (sr === 'SP') role = 'SP'
    else if (roleArg === 'CL' || roleArg === 'RP') role = roleArg
    else {
      // the closer's job if he's at least the real closer's equal
      const cl = replacedOf(E, mode, club.short, 'pit', 'CL', null)
      role = !cl || pitWoba(E, prof) <= pitWoba(E, cl.prof) + 0.004 ? 'CL' : 'RP'
    }
    replaced = team?.replaces === false || script ? null : replacedOf(E, mode, club.short, 'pit', role, team?.replaces)
  }
  const me = { pos, role, prof, replaced }
  const rateBase = script ? script.tr : ratingsOf(club, team, mode, null)
  const uRate = { ...rateBase }
  const rates = worldRates(mode, U, uRate)
  const year = yearOf(team, mode)
  const cal = teamCalendar(year, U)
  const sides = usSides(E, mode, club, uRate, me, team)
  const fr0 = replaced && isBat ? fieldRunsAt(k => replaced.p.attrs?.[k], replaced.p.role) : 0
  // his glove against the man he replaced: fewer (or more) hits fall in for the other side
  const dB = isBat ? clamp(-((frRate - fr0) / (162 * 25)) / 0.8, -0.012, 0.012) : 0
  const usage = clamp(num(team?.usage, team?.bench ? 0.35 : 1), 0.05, 1)
  const age = buildAge(build, team)
  // his days: rest, the injured list (durability: speed for a hitter, stamina for an arm)
  const av = stream(base, 'avail')
  // (team.career: Career keeps his injured list itself, by his durability, so the sim's own stint is skipped)
  const il = team?.career ? null : availOf(av, isBat ? prof.spd - 5.5 : prof.sta - 5.5, age ?? 28, isBat ? 0.2 : role === 'SP' ? 0.24 : 0.18)
  const ilFrom = il ? Math.floor(il.from * 162 / 186) : 999, ilTo = il ? ilFrom + Math.round(il.len * 162 / 186) : -1
  const restP = isBat ? (role === 'C' ? 0.14 : role === 'DH' ? 0.012 : 0.03) : 0
  const rs = stream(base, 'reg')
  // the world: the rest of the league (a script's world is the script's)
  const st = newStandings()
  const rec = recorder(st)
  if (!script) playWorld(E, rates, year, U, st, rec, stream(base, 'world'))
  // his club's games
  const games = []
  const L0 = lineFields(isBat)
  const tot = { rs: 0, ra: 0 }
  // his club's own numbers, both ways (team.stats on the season page)
  const T = { games: 0, runs: [0, 0], homeW: 0, extra: 0, ev: new Array(20).fill(0), sb: [0, 0], cs: [0, 0], spOuts: 0, spPitches: 0, spStarts: 0, cg: 0, us: 0, erUs: 0, outsUs: 0, hA: 0, bbA: 0 }
  const homeRec = { w: 0, l: 0 }, awayRec = { w: 0, l: 0 }
  const rp = !isBat && role !== 'SP' ? { prof, role, avail: true, rest: 3, lastDay: -9, prevDay: -9, lastPitches: 0 } : null
  // (team.slot: his turn in the rotation, 0-4; a squad's starters take different days)
  const rotOff = clamp(Math.round(num(team?.slot, 0)), 0, 4)
  let rotK = 0
  const gameOf = (x, i) => ({ g: i + 1, wk: Math.floor(x.day / 7) + 1, day: x.day, date: x.date, iso: x.iso, home: x.home, opponent: TEAMS[x.opp].short, oppName: TEAMS[x.opp].name, series: x.series })
  const sGames = script?.games ?? null
  // (a squad's season: its close wins, close losses and comebacks, for a reliever's blown saves)
  const close = sGames ? { won: sGames.filter(g => g.mySc - g.oppSc >= 1 && g.mySc - g.oppSc <= 3).length, lost: sGames.filter(g => g.oppSc - g.mySc >= 1 && g.oppSc - g.mySc <= 3).length, lost2: sGames.filter(g => g.oppSc - g.mySc >= 1 && g.oppSc - g.mySc <= 2).length, back: sGames.filter(g => g.mySc > g.oppSc && ((g.innings ?? 9) > 9 || g.walkoff)).length } : null
  const oSides = new Array(N)
  const gen = { prof: genBat(E, sides.g), isB: false }, bench = { prof: genBat(E, sides.gBench), isB: false }, mine = { prof, isB: true }
  for (let i = 0; i < cal.games.length; i++) {
    const x = cal.games[i]
    const O = TEAMS[x.opp]
    const oSide = oSides[x.opp] ?? (oSides[x.opp] = oppSide(E, mode, O, rates[x.opp]))
    const hurt = i >= ilFrom && i < ilTo
    let plays = false, starts = false, slot = -1
    if (isBat) plays = !hurt && av() >= restP && (usage >= 1 || av() < usage)
    else if (role === 'SP') {
      // a five-man rotation, his turn every fifth game (now and then an extra day's rest; the spot starter on the IL)
      slot = (rotK - rotOff + 5) % 5
      // (a squad's season: no extra day, so its starters' turns never land on the same game)
      if (slot === 0 && !hurt && !script && av() < 0.03) { slot = 5 }
      else rotK++
      starts = slot === 0 && !hurt && (usage >= 1 || av() < usage)
    }
    if (rp) {
      rp.rest = x.day - rp.lastDay
      const b2b = x.day - rp.lastDay === 1 && rp.lastDay - rp.prevDay === 1
      const fresh = !hurt && !b2b && !(rp.rest === 1 && rp.lastPitches >= 28)
      rp.avail = fresh && av() >= 0.06 && (usage >= 1 || av() < usage)
    }
    if (sGames) {
      // a squad's season: the score is the script's; his line is drawn inside it
      const sg = sGames[i]
      const line = scriptLine(E, me, prof, sg, i, team, spot, rs, { plays, starts, rp, oppSP: oSide.st.rot[x.oppSlot], close })
      const out = { ...gameOf(x, i), mySc: sg.mySc, oppSc: sg.oppSc, won: sg.mySc > sg.oppSc, result: sg.mySc > sg.oppSc ? 'W' : 'L', innings: sg.innings ?? 9, walkoff: !!sg.walkoff, walkedOff: !!sg.walkedOff, oppSP: sg.oppSP ?? null, ourSP: sg.ourSP ?? null, ps: null, ...L0, ...line }
      out.sat = isBat ? !out.gp : !out.app
      games.push(out)
      if (rp && out.app) { rp.prevDay = rp.lastDay; rp.lastDay = x.day; rp.lastPitches = out.pitches }
      continue
    }
    // the two sides
    const lu = new Array(9)
    for (let k = 0; k < 9; k++) lu[k] = gen
    if (isBat) lu[spot] = plays ? mine : bench
    let sp
    if (!isBat && role === 'SP') sp = starts ? { prof, isB: true, name: null } : slot === 0 || slot === 5 ? { prof: sides.st.spare, isB: false, name: null } : spOf(sides.st, slot)
    else sp = spOf(sides.st, rotK++)
    const us = { lu, sp, pen: sides.st.pen, dB: isBat && plays ? dB : 0, rp: rp && rp.avail ? rp : null }
    const them = { lu: oSide.lu, sp: spOf(oSide.st, x.oppSlot), pen: oSide.st.pen, dB: 0, rp: null }
    const away = x.home ? them : us, home = x.home ? us : them
    const usSide = x.home ? 1 : 0
    T.us = usSide
    const res = playGame(E, away, home, rs, { batSide: isBat && plays ? usSide : null, pitSide: !isBat ? usSide : null, tally: T })
    const my = res.score[usSide], op = res.score[1 - usSide]
    const won = my > op
    if (x.home) rec(U, x.opp, my, op); else rec(x.opp, U, op, my)
    if (won) (x.home ? homeRec : awayRec).w++; else (x.home ? homeRec : awayRec).l++
    tot.rs += my; tot.ra += op
    const line = isBat ? (plays ? finishBatLine(res.bat) : null) : finishPitLine(res.pit)
    if (line && isBat) line.gs = 1
    const out = {
      ...gameOf(x, i), mySc: my, oppSc: op, won, result: won ? 'W' : 'L', innings: res.innings,
      walkoff: won && x.home && res.walkoff, walkedOff: !won && !x.home && res.walkoff,
      oppSP: them.sp.name, ourSP: sp.isB ? null : sp.name, ps: null, ...L0, ...(line ?? {}),
    }
    if (isBat) { out.order = spot + 1; out.pos = role }
    out.sat = isBat ? !plays : !out.app
    if (isBat && !plays) out.reason = hurt ? 'IL' : 'REST'
    games.push(out)
    if (rp && out.app) { rp.prevDay = rp.lastDay; rp.lastDay = x.day; rp.lastPitches = out.pitches }
  }
  if (sGames) {
    // (the script's records stand: its world, its standings)
    for (let a = 0; a < N; a++) { st.w[a] = script.st.w[a]; st.l[a] = script.st.l[a]; st.rs[a] = script.st.rs[a]; st.ra[a] = script.st.ra[a]; st.dw[a] = script.st.dw[a]; st.dl[a] = script.st.dl[a] }
    st.h2h = script.st.h2h
    for (const g of games) { if (g.won) (g.home ? homeRec : awayRec).w++; else (g.home ? homeRec : awayRec).l++; tot.rs += g.mySc; tot.ra += g.oppSc }
  }
  // the standings and the postseason
  const tbr = stream(base, 'tiebreak')
  const rows = leagueRows(st, tbr)
  const lgSeed = { AL: seedLeague(rows, st, 'AL'), NL: seedLeague(rows, st, 'NL') }
  const myRow = rows[U]
  // (hurt through the last day: he misses October)
  const healthy = !(ilTo > 161 && ilFrom <= 161)
  let po
  if (script) {
    // his postseason lines inside the script's games (a copy: the script plays every build of a squad)
    const ps = stream(base, 'po-script')
    const rounds = script.po.rounds.map(rd => {
      if (rd.type !== 'series') return { ...rd }
      const gs = rd.games.map(g => ({ ...g, ...lineFields(isBat), ...scriptLine(E, me, prof, g, 162 + g.g, team, spot, ps, { plays: healthy, starts: healthy && role === 'SP' && rotOff < 4 && (g.n - 1) % 4 === rotOff, rp: rp && healthy ? { ...rp, avail: true } : null, close }), ...(isBat ? { order: spot + 1, pos: role } : {}) }))
      for (const g of gs) g.sat = isBat ? !g.gp : !g.app
      const line = baseballTotals(gs, pos, { mode, role, pos: role })
      return { ...rd, games: gs, line }
    })
    po = { ...script.po, rounds }
  } else po = postseason(E, mode, rows, lgSeed, rates, U, { me, prof, role, isBat, spot, dB, sides, base, plays: healthy, rotOff })
  // his line (his glove has a year: about ±2 runs of luck around his level)
  const frUsed = isBat ? frRate + gauss(stream(base, 'fr')) * 2 : 0
  const tl = baseballTotals(games, pos, { mode, role, pos: isBat ? role : null, frRate: frUsed, runIdx })
  tl.v = voteOf(stream(base, 'vote'))
  const cut = cal.asbAfter >= 0 ? cal.asbAfter + 1 : 96
  tl.firstHalf = baseballTotals(games.slice(0, cut), pos, { mode, role, pos: isBat ? role : null, frRate: frUsed, runIdx }).war
  // the field
  // (the man he replaced is out of the field: by kind, a two-way star's other half stays in)
  const exclude = new Set([...(replaced ? [`${pos}:${replaced.p.name}`] : []), ...(Array.isArray(team?.exclude) ? team.exclude : []), ...(script?.exclude ?? [])])
  const teamWins = Object.fromEntries(rows.map(r => [r.short, r.wins]))
  const rookie = team?.rookie != null ? !!team.rookie : age != null && age <= 23
  // (team.fast: the season director's re-runs need the games and the record, not the awards; the book is built
  // when rebookBaseball books the season, from the same world and the same streams)
  const fast = !!team?.fast && !script
  const book = { mode, pos, role, lg: club.lg, U: club.short, teamWins, rookie, age, frRate: frUsed, runIdx, seed: base, exclude: [...exclude], world: rows.map(r => [r.short, r.rs, r.wins]), field: script?.field ?? null }
  if (!fast && !book.field) book.field = fieldOf(book)
  const myRounds = po.rounds
  const ws = myRounds.find(r => r.short === 'WS')
  const cs = myRounds.find(r => r.short === 'ALCS' || r.short === 'NLCS')
  let awards = null, leaders = null
  if (!fast) {
    const aw = decideAwards(book, meEntry(tl, pos, role, club.lg, club.short, rookie, age))
    // the postseason MVPs
    const pms = stream(base, 'psmvp')
    aw.wsMvp = seriesMvp(E, mode, ws, club, isBat, pms, exclude)
    aw.lcsMvp = seriesMvp(E, mode, cs, club, isBat, pms, exclude)
    ;({ leaders, ...awards } = aw)
  }
  // the result
  const row = rowOut(myRow, U)
  const standings = lgSeed[club.lg].table.map(r => rowOut(r, U))
  const divisions = Object.fromEntries(['AL', 'NL'].map(lg => [lg, Object.fromEntries(Object.entries(lgSeed[lg].divs).map(([d, l]) => [d, l.map(r => rowOut(r, U))]))]))
  const wildCardRace = Object.fromEntries(['AL', 'NL'].map(lg => [lg, lgSeed[lg].wild.slice(0, 8).map(r => rowOut(r, U))]))
  const psGames = myRounds.flatMap(r => r.games ?? [])
  const psLine = isBat ? baseballTotals(psGames.map(g => ({ ...g, gp: g.gp ?? 0 })), pos, { mode, pos: role }) : baseballTotals(psGames, pos, { mode, role })
  const wsR = ws ?? null
  const madePlayoffs = myRow.seed != null
  const champion = po.champion === club.short
  const elim = madePlayoffs && !champion ? myRounds.filter(r => r.type === 'series').slice(-1)[0]?.name ?? null : null
  const best = bestOf(games, isBat)
  const ev = k => T.ev[k]
  const tPA = T.ev.slice(0, 10).reduce((a, x) => a + x, 0), tH = ev(EHR) + ev(E1B) + ev(E2B) + ev(E3B), tAB = tPA - ev(EBB) - ev(EHBP)
  const tTB = ev(E1B) + 2 * ev(E2B) + 3 * ev(E3B) + 4 * ev(EHR), tIP = T.outsUs / 3
  const teamStats = {
    g: games.length, rs: tot.rs, ra: tot.ra, rsPerG: r2(tot.rs / Math.max(1, games.length)), raPerG: r2(tot.ra / Math.max(1, games.length)),
    ...(sGames ? {} : {
      pa: tPA, ab: tAB, h: tH, doubles: ev(E2B), triples: ev(E3B), hr: ev(EHR), bb: ev(EBB), k: ev(EK), sb: T.sb[0], cs: T.cs[0],
      avg: tAB ? r3(tH / tAB) : 0, obp: tPA ? r3((tH + ev(EBB) + ev(EHBP)) / tPA) : 0, slg: tAB ? r3(tTB / tAB) : 0,
      era: tIP ? r2((9 * T.erUs) / tIP) : 0, whip: tIP ? r2((T.hA + T.bbA) / tIP) : 0, kPitching: T.ev.slice(10).length ? ev(10 + EK) : 0, hrAllowed: ev(10 + EHR),
    }),
  }
  return {
    sport: 'baseball', mode, position: pos, role, gameMode, season: E.season,
    ovr, archetype: getBaseballArchetype(ovr, build, t, pos, pos === 'pit' ? role : null),
    team: { ...club, ...(team ?? {}), short: club.short, name: club.name, off: r1(uRate.off), def: r1(uRate.def), lg: club.lg, div: club.div },
    replaced: replaced ? { name: replaced.p.name, role: replaced.p.role } : null,
    wins: myRow.wins, losses: myRow.losses, pct: r3(myRow.pct), gb: myRow.gb ?? 0, rs: myRow.rs, ra: myRow.ra, runDiff: myRow.diff,
    home: homeRec, away: awayRec, games, gameLog: games.map(g => g.result), bestGame: best,
    league: club.lg, conference: club.lg, division: club.div, seed: myRow.seed ?? myRow.leagueRank, playoffSeed: myRow.seed ?? null, leagueRank: myRow.leagueRank, divRank: myRow.divRank,
    divisionTitle: myRow.divRank === 1, wildCard: madePlayoffs && myRow.divRank !== 1, hasBye: myRow.seed != null && myRow.seed <= 2,
    standings, row, divisions, wildCardRace,
    madePlayoffs, playoffs: madePlayoffs, playoffRounds: myRounds, champion, pennant: !!ws, eliminatedIn: elim,
    finalsOpp: wsR?.opponent?.short ?? null, finalsSeries: wsR ? `${wsR.wins}-${wsR.losses}` : null,
    bracket: po.bracket, wsWinner: po.champion, pennants: po.pennants,
    ...tl, line: displayLine(tl, pos), ...seasonFields(games, pos),
    asbCut: cut, pos: isBat ? role : null, order: isBat ? spot + 1 : null, frRate: isBat ? frUsed : null, runIdx: isBat ? runIdx : null,
    postseason: { games: psGames, line: psLine, series: myRounds.filter(r => r.type === 'series').map(r => ({ name: r.name, short: r.short, opp: r.opponent?.short, won: r.won, wins: r.wins, losses: r.losses, line: r.line })) },
    teamStats,
    awards, leaders,
    mvp: !!awards?.mvp?.won, cyYoung: !!awards?.cyYoung?.won, dpoy: false, allStar: !!awards?.allStar?.selected,
    book,
  }
}
function bestOf(games, isBat) {
  const sc = isBat ? g => g.tb * 1.5 + g.rbi * 1.2 + g.r * 0.6 + g.bb * 0.4 + g.sb * 0.6 + (g.wo ? 4 : 0) + (g.cycle ? 10 : 0) - g.k * 0.3
    : g => (g.outs / 3) * 1.5 + g.k * 0.8 - g.er * 2.5 - g.h * 0.4 - g.bb * 0.4 + (g.cg ? 3 : 0) + (g.nh ? 15 : 0) + (g.sv ? 2 : 0)
  return [...games].filter(g => !g.sat).sort((a, b) => sc(b) - sc(a) || a.g - b.g)[0] ?? null
}
// a series MVP: his series against his club's real players' series (each a line around his own profile); only the
// series' winners get one
function seriesMvp(E, mode, rd, club, isBat, rand, exclude) {
  if (!rd || !rd.won) return { won: false, eligible: !!rd, winner: null }
  const n = rd.games.length
  const scoreBat = c => c.tb * 1.0 + c.rbi * 1.3 + c.runs * 0.5 + c.bb * 0.4 + c.hr * 1.5
  const scorePit = c => c.outs * 0.5 + c.k * 0.4 - c.er * 2 + c.w * 3 + c.sv * 2.5
  const mine = rd.line ? (isBat ? scoreBat({ tb: rd.line.tb ?? 0, rbi: rd.line.rbi ?? 0, runs: rd.line.runs ?? 0, bb: rd.line.bb ?? 0, hr: rd.line.hr ?? 0 }) : scorePit(rd.line)) : 0
  const rivals = []
  for (const x of batsOf(E, mode, club.short).filter(y => !exclude.has(y.p.name) && !exclude.has(`bat:${y.p.name}`)).slice(0, 5)) {
    const pr = probs(x.prof, AVG_P(E), E)
    const [, bb, hbp, hr, b1, b2, b3] = multi(n * 4, pr, rand)
    const tb = b1 + 2 * b2 + 3 * b3 + 4 * hr
    rivals.push({ name: x.p.name, s: scoreBat({ tb, rbi: hr + binom(b1 + b2 + b3, 0.25, rand), runs: hr + binom(b1 + b2 + b3 + bb + hbp, 0.3, rand), bb, hr }) })
  }
  for (const x of realRotation(E, mode, club.short, null).filter(y => !exclude.has(y.p.name) && !exclude.has(`pit:${y.p.name}`)).slice(0, 2)) {
    const st = Math.ceil(n / 4)
    const outs = Math.round(st * ipPerStart(E, x.prof) * 3), pr = probs(AVG_B(E), x.prof, E)
    const bf = Math.round(outs / 0.7), [k] = multi(bf, pr, rand)
    const er = poisson((outs / 27) * E.ra9 * 0.92 * Math.exp(4 * (pitWoba(E, x.prof) - E.woba)), rand)
    rivals.push({ name: x.p.name, s: scorePit({ outs, k, er, w: binom(st, 0.6, rand), sv: 0 }) })
  }
  const best = rivals.sort((a, b) => b.s - a.s)[0]
  const won = !best || mine >= best.s
  return { won, eligible: true, winner: won ? { name: null, team: club.short, isPlayer: true } : { name: best.name, team: club.short, isPlayer: false } }
}

// ─── The postseason ──────────────────────────────────────────────────────────
// 12 teams (2022-): per league seeds 1-2 (the best division winners) wait; the Wild Card Series 3 v 6 and 4 v 5, best
// of three, all at the higher seed; the Division Series 1 v the 4/5 winner, 2 v the 3/6 winner, best of five (2-2-1);
// the LCS best of seven (2-3-2, the higher seed at home); the World Series best of seven (2-3-2), home field to the
// better record. His club's series are played plate appearance by plate appearance, the rest from the run model.
const FORMAT = { 3: [1, 1, 1], 5: [1, 1, 0, 0, 1], 7: [1, 1, 0, 0, 0, 1, 1] }
const ROUND = [
  { key: 'wc', name: 'Wild Card Series', best: 3 }, { key: 'ds', name: 'Division Series', best: 5 }, { key: 'cs', name: 'Championship Series', best: 7 }, { key: 'ws', name: 'World Series', best: 7 },
]
const shortOf = (lg, key) => (key === 'ws' ? 'WS' : `${lg}${key === 'wc' ? 'WC' : key === 'ds' ? 'DS' : 'CS'}`)
const nameOf = (lg, key) => (key === 'ws' ? 'World Series' : `${lg} ${ROUND.find(r => r.key === key).name}`)
function postseason(E, mode, rows, lgSeed, rates, U, ctx) {
  const pr = stream(ctx.base, 'po')
  const gr = stream(ctx.base, 'po-games')
  const bracket = { AL: { wc: [], ds: [], cs: null }, NL: { wc: [], ds: [], cs: null }, ws: null }
  const rounds = []
  const lam = lamOf(E, rates)
  let gNo = 0
  // his club's postseason rotation: its best four, the ace first (a starter build is the ace)
  const usRot = ctx.isBat || ctx.role !== 'SP' ? [0, 1, 2, 3] : [0, 1, 2, 3]
  let aceLast = -9
  const playUs = (oppI, usHomePattern, label, dayStart) => {
    const res = []
    const O = TEAMS[oppI]
    const oSide = oppSide(E, mode, O, rates[oppI])
    let w = 0, l = 0
    const need = Math.ceil(label.best / 2)
    const days = label.best === 3 ? [0, 1, 2] : label.best === 5 ? [0, 1, 3, 4, 6] : [0, 1, 3, 4, 5, 7, 8]
    for (let k = 0; w < need && l < need; k++) {
      const home = usHomePattern[k] === 1
      const day = dayStart + days[k]
      // the starters: the ace in game 1 (and game 5 of seven); a starter build pitches on his fifth day
      let sp
      const slot = k % 4
      if (!ctx.isBat && ctx.role === 'SP') {
        const rested = day - aceLast >= 5
        // (his turn: the ace game 1 and game 5; team.slot moves him, a fifth starter goes to the pen in October)
        const mine = (ctx.rotOff ?? 0) < 4 && slot === (ctx.rotOff ?? 0)
        if (ctx.plays && rested && mine) { sp = { prof: ctx.prof, isB: true, name: null }; aceLast = day } else sp = spOf(ctx.sides.st, 1 + (k % 4))
      } else sp = spOf(ctx.sides.st, usRot[slot])
      const lu = new Array(9)
      const gen = { prof: genBat(E, ctx.sides.g), isB: false }
      for (let q = 0; q < 9; q++) lu[q] = gen
      if (ctx.isBat) lu[ctx.spot] = ctx.plays ? { prof: ctx.prof, isB: true } : { prof: genBat(E, ctx.sides.gBench), isB: false }
      const rp = !ctx.isBat && ctx.role !== 'SP' && ctx.plays ? { prof: ctx.prof, role: ctx.role, avail: pr() < 0.97, rest: 2 } : null
      const us = { lu, sp, pen: ctx.sides.st.pen, dB: ctx.isBat ? ctx.dB : 0, rp }
      const them = { lu: oSide.lu, sp: spOf(oSide.st, slot), pen: oSide.st.pen, dB: 0, rp: null }
      const usSide = home ? 1 : 0
      const r = playGame(E, home ? them : us, home ? us : them, gr, { batSide: ctx.isBat && ctx.plays ? usSide : null, pitSide: !ctx.isBat ? usSide : null, ps: true })
      const my = r.score[usSide], op = r.score[1 - usSide]
      const won = my > op
      if (won) w++; else l++
      gNo++
      const line = ctx.isBat ? (ctx.plays ? finishBatLine(r.bat) : null) : finishPitLine(r.pit)
      res.push({
        g: gNo, n: k + 1, day: SEASON_DAYS + 1 + day, date: dateOf(SEASON_DAYS + 1 + day), iso: isoOf(SEASON_DAYS + 1 + day), home, opponent: O.short, oppName: O.name, mySc: my, oppSc: op, won, result: won ? 'W' : 'L',
        innings: r.innings, walkoff: won && home && r.walkoff, walkedOff: !won && !home && r.walkoff, oppSP: them.sp.name, ourSP: sp.isB ? null : sp.name, ps: label.short,
        ...lineFields(ctx.isBat), ...(line ?? {}), ...(ctx.isBat ? { order: ctx.spot + 1, pos: ctx.role, gs: line ? 1 : 0 } : {}), sat: ctx.isBat ? !line : !line?.app,
      })
    }
    return { games: res, w, l, len: days[w + l - 1] + 1 }
  }
  const quick = (hiI, loI, best) => {
    let w = 0, l = 0
    const need = Math.ceil(best / 2), fmt = FORMAT[best], sc = []
    for (let k = 0; w < need && l < need; k++) {
      const hiHome = fmt[k] === 1
      const [hs, as] = hiHome ? quickGame(E, lam(hiI, loI, true), lam(loI, hiI, false), pr) : quickGame(E, lam(loI, hiI, true), lam(hiI, loI, false), pr)
      const hiWon = hiHome ? hs > as : as > hs
      if (hiWon) w++; else l++
      sc.push(hiHome ? [hs, as] : [as, hs])
    }
    return { w, l, sc }
  }
  // a series: hi (the better seed / home field) against lo
  const series = (lg, key, hiR, loR, dayStart) => {
    const R = ROUND.find(r => r.key === key)
    const short = shortOf(lg, key)
    const us = hiR.i === U || loR.i === U
    let out
    if (us) {
      const usHi = hiR.i === U
      const opp = usHi ? loR : hiR
      const pattern = FORMAT[R.best].map(h => (usHi ? h : 1 - h))
      const p = playUs(opp.i, pattern, { best: R.best, short }, dayStart)
      const won = p.w > p.l
      const line = ctx.isBat ? baseballTotals(p.games, 'bat', { mode, pos: ctx.role }) : baseballTotals(p.games, 'pit', { mode, role: ctx.role })
      rounds.push({
        type: 'series', name: nameOf(lg, key), short, roundIndex: ROUND.indexOf(R), bestOf: R.best,
        opponent: { short: opp.short, name: opp.name, seed: opp.seed ?? null, wins: opp.wins, losses: opp.losses }, mySeed: (usHi ? hiR : loR).seed ?? null, homeField: usHi,
        won, wins: p.w, losses: p.l, games: p.games, log: p.games.map(g => g.result), line: { ...line, tb: line.tb ?? null },
      })
      out = { hi: hiR.short, lo: loR.short, hiSeed: hiR.seed ?? null, loSeed: loR.seed ?? null, wins: usHi ? [p.w, p.l] : [p.l, p.w], winner: (won === usHi ? hiR : loR).short, scores: p.games.map(g => (usHi ? [g.mySc, g.oppSc] : [g.oppSc, g.mySc])), us: true }
      return { winner: won === usHi ? hiR : loR, rec: out }
    }
    const q = quick(hiR.i, loR.i, R.best)
    out = { hi: hiR.short, lo: loR.short, hiSeed: hiR.seed ?? null, loSeed: loR.seed ?? null, wins: [q.w, q.l], winner: (q.w > q.l ? hiR : loR).short, scores: q.sc, us: false }
    return { winner: q.w > q.l ? hiR : loR, rec: out }
  }
  const champs = {}
  const usLg = TEAMS[U].lg
  for (const lg of ['AL', 'NL']) {
    const s = lgSeed[lg].seeds
    if (s.length < 6) { champs[lg] = s[0]; continue }
    if (lg === usLg && (s[0].i === U || s[1].i === U)) rounds.push({ type: 'bye', name: nameOf(lg, 'wc'), short: shortOf(lg, 'wc'), roundIndex: 0, won: true, mySeed: s[0].i === U ? 1 : 2 })
    const a = series(lg, 'wc', s[2], s[5], 0), b = series(lg, 'wc', s[3], s[4], 0)
    bracket[lg].wc = [a.rec, b.rec]
    const d1 = series(lg, 'ds', s[0], b.winner, 4), d2 = series(lg, 'ds', s[1], a.winner, 4)
    bracket[lg].ds = [d1.rec, d2.rec]
    const [hi, lo] = (d1.winner.seed ?? 9) <= (d2.winner.seed ?? 9) ? [d1.winner, d2.winner] : [d2.winner, d1.winner]
    const c = series(lg, 'cs', hi, lo, 12)
    bracket[lg].cs = c.rec
    champs[lg] = c.winner
  }
  let wsWinner = null
  if (champs.AL && champs.NL) {
    const cmp = cmpRows({ h2h: new Int16Array(N * N), dw: new Array(N).fill(0), dl: new Array(N).fill(0) })
    const [hi, lo] = [champs.AL, champs.NL].sort(cmp)
    const w = series('', 'ws', hi, lo, 22)
    bracket.ws = w.rec
    wsWinner = w.winner.short
  }
  rounds.sort((x, y) => x.roundIndex - y.roundIndex)
  return { rounds, bracket, champion: wsWinner, pennants: { AL: champs.AL?.short ?? null, NL: champs.NL?.short ?? null } }
}

// ─── A squad's season: his line inside a script's games ─────────────────────
// (a reliever's inning: runs ~ RP_S x ra9 x exp(RP_K x his wOBA-against edge), an inning's worth; tuned so a script
// season's closer lands near the full engine's and the real ranges: elite ~2.2 ERA, 36 SV, 3-4 blown; average ~3.8,
// 6-7 blown, an ~84% conversion rate (MLB closers 2024-25: elite 1.8-2.8 ERA and 3-6 blown saves))
const RP_K = 9
const RP_S = 0.85
// (the score is fixed: his line is drawn from his profile against that day's starter, his runs and RBI inside his
// club's runs; a starter's runs allowed inside the other side's)
function scriptLine(E, me, prof, sg, i, team, spot, rand, ctx) {
  const spent = team?.spent?.[i] ?? { r: 0, rbi: 0 }
  if (me.pos === 'bat') {
    if (!ctx.plays) return { gp: 0 }
    const opp = ctx.oppSP?.prof ?? AVG_P(E)
    const pa = Math.max(3, Math.round(SPOT_W[spot] - 0.35 + 0.11 * (sg.mySc - 4.4) + (rand() - 0.5) * 1.2))
    const d = distOf(prof, opp, E, 0, 0)
    const L = { gp: 1, gs: 1, pa, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, r: 0, bb: 0, k: 0, hbp: 0, sf: 0, sb: 0, cs: 0, gidp: 0, slam: 0, wo: 0 }
    for (let k = 0; k < pa; k++) {
      const u = rand(); let ev = 0
      while (ev < 9 && u > d[ev]) ev++
      if (ev === EBB) L.bb++; else if (ev === EHBP) L.hbp++; else L.ab++
      if (ev === EK) L.k++
      if (ev === EHR) { L.h++; L.hr++ } else if (ev === E1B) L.h++; else if (ev === E2B) { L.h++; L.doubles++ } else if (ev === E3B) { L.h++; L.triples++ }
      if ((ev === E1B || ev === EBB || ev === EHBP) && rand() < prof.att * 1.2) { if (rand() < prof.sbp) L.sb++; else L.cs++ }
    }
    const room = Math.max(0, sg.mySc - (spent.rbi ?? 0)), roomR = Math.max(0, sg.mySc - (spent.r ?? 0))
    L.hr = Math.min(L.hr, roomR, room); L.h = Math.max(L.h, L.hr)
    const f = Math.pow(Math.max(0.2, sg.mySc / E.rg), 0.8)
    const onB = L.h - L.hr + L.bb + L.hbp
    L.r = Math.min(roomR, L.hr + binom(onB, clamp(0.3 * f, 0, 0.8), rand))
    L.rbi = Math.min(room, L.hr + binom(L.hr, 0.5 * f, rand) + binom(L.h - L.hr, clamp(0.17 * f, 0, 0.7), rand) + binom(L.ab - L.h, 0.03 * f, rand))
    return finishBatLine(L)
  }
  if (me.role === 'SP') {
    if (!ctx.starts) return { app: 0 }
    const L = { app: 1, gs: 1, outs: 0, bf: 0, pitches: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, hbp: 0, w: 0, l: 0, sv: 0, hld: 0, bs: 0, svo: 0, qs: 0, cg: 0, sho: 0, nh: 0 }
    const outs = clamp(Math.round(ipPerStart(E, prof) * 3 + gauss(rand) * 3), 6, 27)
    const pr = probs(AVG_B(E), prof, E)
    const bf = Math.round(outs / clamp(1 - onBaseOf(pr) + 0.024, 0.55, 0.85))
    const [k, bb, hbp, hr, b1, b2, b3] = multi(bf, pr, rand)
    const ra = Math.min(sg.oppSc, poisson((outs / 27) * E.ra9 * Math.exp(4.5 * (pitWoba(E, prof) - E.woba)), rand))
    Object.assign(L, { outs, bf, pitches: Math.round(bf * 3.84 * prof.ppa), k, bb, hbp, hr: Math.min(hr, ra), h: b1 + b2 + b3 + Math.min(hr, ra), r: ra, er: Math.round(ra * 0.93) })
    const won = sg.mySc > sg.oppSc
    if (won && outs >= 15 && ra < sg.mySc && rand() < 0.82) L.w = 1
    else if (!won && ra >= Math.max(1, sg.mySc) && rand() < 0.85) L.l = 1
    L.qs = outs >= 18 && L.er <= 3 ? 1 : 0
    L.cg = outs >= 27 ? 1 : 0; L.sho = L.cg && !ra ? 1 : 0
    return finishPitLine(L)
  }
  // a reliever: the late innings of a close game. His inning is drawn from his stuff (runs: the starter's model, an
  // inning's worth). The score is the script's, so the game says what his inning could have been:
  //   · a win by 1-3: he held the lead (a save for the closer, a hold for a setup man), the runs he allowed inside it
  //     (he came in at most three up);
  //   · a loss by 1-3: now and then he blew the lead (he came in up 1-3 and gave up the tying and go-ahead runs: a
  //     blown save and the loss);
  //   · a win in extras or on a walk-off: now and then he blew it and the club won it back (a blown save; the win
  //     when the walk-off came in the bottom of his inning).
  // How often he blows one is his own rate: the chance his inning gives up the lead he came in with (by the lead:
  // up one 45% of saves, two 30%, three 25%, B-R 2024-25 save situations), spread over the club's close losses and
  // comebacks so his blown saves land on his save chances at that rate (an elite closer converts ~90%, MLB ~70%).
  const lead = sg.mySc - sg.oppSc
  if (!ctx.rp?.avail) return { app: 0 }
  const isCL = me.role === 'CL'
  const lam = (3 / 27) * E.ra9 * RP_S * Math.exp(RP_K * (pitWoba(E, prof) - E.woba))
  const p0 = Math.exp(-lam), p1 = p0 * lam, p2 = p1 * lam / 2
  const blow = clamp(0.45 * (1 - p0) + 0.30 * (1 - p0 - p1) + 0.25 * (1 - p0 - p1 - p2), 0.02, 0.6)
  const C = ctx.close ? { ...ctx.close, lost: ctx.close.lost2 ?? ctx.close.lost } : { won: 40, lost: 20, back: 12 }
  const odds = 0.86 * blow / (1 - blow) * Math.max(1, C.won)
  const entry = () => { const u = rand(); return u < 0.45 ? 1 : u < 0.75 ? 2 : 3 }
  const blownBy = () => { const u = rand(); return u < 0.6 ? 1 : u < 0.9 ? 2 : 3 }   // (a lead that's blown is most often a one-run lead)
  const L = { app: 1, gs: 0, outs: 3, bf: 0, pitches: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, hbp: 0, w: 0, l: 0, sv: 0, hld: 0, bs: 0, svo: 0, qs: 0, cg: 0, sho: 0, nh: 0 }
  let ra = 0, kind = null
  if (lead >= 1 && (sg.innings > 9 || sg.walkoff) && rand() < Math.min(0.5, 0.3 * odds / Math.max(1, C.back))) {
    ra = blownBy(); kind = 'blownW'
  } else if (lead >= 1 && lead <= 3 && rand() < 0.86) {
    ra = Math.min(poisson(lam, rand), 3 - lead); kind = 'hold'
  } else if (lead <= -1 && lead >= -2 && rand() < Math.min(0.6, 0.7 * odds / Math.max(1, C.lost))) {
    ra = blownBy() - lead; kind = 'blownL'
  } else if (rand() < 0.18) {
    ra = poisson(lam, rand); kind = 'plain'
  } else return { app: 0 }
  ra = Math.min(ra, sg.oppSc)
  if (kind === 'blownL' && ra <= -lead) kind = 'plain'   // (the score doesn't leave room for the blown lead)
  if (kind === 'blownW' && ra < 1) kind = 'plain'
  // his inning: the men he faced around the runs (a blown one can end before the third out)
  const pr = probs(AVG_B(E), prof, E)
  if (kind === 'blownL') L.outs = 1 + Math.floor(rand() * 3)
  const bf0 = L.outs + binom(3, onBaseOf(pr), rand)
  const [k, bb, hbp, hr, b1, b2, b3] = multi(bf0, pr, rand)
  const hrA = Math.min(hr, ra), onB = bb + hbp + hrA + b1 + b2 + b3
  const b1x = b1 + Math.max(0, ra - onB)
  const bf = L.outs + bb + hbp + hrA + b1x + b2 + b3
  Object.assign(L, { bf, pitches: Math.round(bf * 4), k: Math.min(k, L.outs), bb, hbp, hr: hrA, h: b1x + b2 + b3 + hrA, r: ra, er: ra })
  if (kind === 'hold') { if (isCL) { L.svo = 1; L.sv = 1 } else L.hld = 1 }
  else if (kind === 'blownL') { L.svo = 1; L.bs = 1; L.l = 1 }
  else if (kind === 'blownW') { L.svo = 1; L.bs = 1; if (sg.walkoff && sg.home && (sg.innings ?? 9) === 9) L.w = 1 }
  return finishPitLine(L)
}

// ─── Entry points ────────────────────────────────────────────────────────────
export function runBaseballSimulation(build, types = null, team = null, position = 'bat', mode = 'current', rngSeed = null, gameMode = 'classic', script = null) {
  const base = seedBase(rngSeed)
  const m = script?.mode ?? (mode === 'alltime' || mode === 'all-time' || gameMode === 'all-time' ? 'alltime' : 'current')
  const pos = posOf(position, types)
  const t = types?.length ? types : pos === 'pit' ? PIT_TRAITS : BAT_TRAITS
  // (a pitcher's role as the position: 'SP' | 'RP' | 'CL')
  const forced = String(position ?? '').toUpperCase()
  const tm = PITCH_ROLES.has(forced) && !team?.role ? { ...(team ?? {}), role: forced } : team ?? {}
  return season(build, t, tm, pos, m, base, gameMode, script)
}
// The squad's one season: every result decided once from its strength (`tr`: { off, def } on the 1-10 scale).
// team.exclude: the real players the squad's builds replace (left out of the award field).
export function scriptBaseballSeason(team, tr, rngSeed, mode = 'current') {
  const m = mode === 'alltime' || mode === 'all-time' ? 'alltime' : 'current'
  const E = ENV[m]
  const base = seedBase(rngSeed)
  const club = resolveTeam(team)
  const U = club.i
  const uRate = { off: num(tr?.off, club.off), def: num(tr?.def, club.def) }
  const rates = worldRates(m, U, uRate)
  const year = yearOf(team, m)
  const cal = teamCalendar(year, U)
  const st = newStandings()
  const rec = recorder(st)
  playWorld(E, rates, year, U, st, rec, stream(base, 'world'))
  const sides = { st: staffOf(E, m, club.short, uRate.def), g: solveBat(E, teamWoba(E, uRate.off)) }
  const rs = stream(base, 'reg')
  const games = []
  let rotK = 0
  for (const x of cal.games) {
    const O = TEAMS[x.opp]
    const oSide = oppSide(E, m, O, rates[x.opp])
    const lu = new Array(9).fill({ prof: genBat(E, sides.g), isB: false })
    const sp = spOf(sides.st, rotK++)
    const us = { lu, sp, pen: sides.st.pen, dB: 0, rp: null }
    const them = { lu: oSide.lu, sp: spOf(oSide.st, x.oppSlot), pen: oSide.st.pen, dB: 0, rp: null }
    const r = playGame(E, x.home ? them : us, x.home ? us : them, rs, {})
    const usSide = x.home ? 1 : 0
    const my = r.score[usSide], op = r.score[1 - usSide]
    if (x.home) rec(U, x.opp, my, op); else rec(x.opp, U, op, my)
    games.push({ g: x.g, home: x.home, opponent: O.short, mySc: my, oppSc: op, won: my > op, innings: r.innings, walkoff: my > op && x.home && r.walkoff, walkedOff: my < op && !x.home && r.walkoff, oppSP: them.sp.name, ourSP: sp.name })
  }
  const rows = leagueRows(st, stream(base, 'tiebreak'))
  const lgSeed = { AL: seedLeague(rows, st, 'AL'), NL: seedLeague(rows, st, 'NL') }
  const po = postseason(E, m, rows, lgSeed, rates, U, { me: null, prof: null, role: 'SP', isBat: true, spot: 0, dB: 0, sides: { ...sides, gBench: sides.g }, base, plays: false })
  const exclude = new Set(Array.isArray(team?.exclude) ? team.exclude : [])
  const field = seasonField(E, m, tt => ({ rg: rows[tt.i].rs / 162, wins: rows[tt.i].wins, lg: tt.lg }), exclude, stream(base, 'field'))
  const fv = stream(base, 'votes')
  for (const e of field) e.v = voteOf(fv)
  const row = rows[U]
  return {
    sport: 'baseball', mode: m, team: club.short, tr: uRate, games, st, po, field, exclude: [...exclude],
    wins: row.wins, losses: row.losses, seed: row.seed ?? row.leagueRank, champion: po.champion === club.short, madePlayoffs: row.seed != null,
    standings: lgSeed[club.lg].table.map(r => rowOut(r, U)), playoffRounds: po.rounds,
  }
}
// The awards from the book, for a new line (`me`: baseballTotals of his games, plus team wins in result.wins)
export function baseballAwards(result, me) {
  if (!result?.book) return null
  const b = result.book
  fieldOf(b)
  const t = me ?? result
  const e = meEntry({ ...t, v: result.v ?? t.v }, b.pos, b.role, b.lg, b.U, b.rookie, b.age)
  const aw = decideAwards({ ...b, teamWins: { ...b.teamWins, [b.U]: result.wins ?? b.teamWins[b.U] } }, e)
  const { leaders, ...rest } = aw
  let wsMvp = result.awards?.wsMvp, lcsMvp = result.awards?.lcsMvp
  if (!wsMvp || !lcsMvp) {
    // (a fast run: the series MVPs from the same stream the full run draws them from)
    const club = resolveTeam({ short: b.U }), rounds = result.playoffRounds ?? [], pms = stream(b.seed, 'psmvp'), ex = new Set(b.exclude ?? [])
    wsMvp = seriesMvp(ENV[b.mode], b.mode, rounds.find(r => r.short === 'WS'), club, b.pos === 'bat', pms, ex)
    lcsMvp = seriesMvp(ENV[b.mode], b.mode, rounds.find(r => r.short === 'ALCS' || r.short === 'NLCS'), club, b.pos === 'bat', pms, ex)
  }
  return { ...rest, leaders, wsMvp, lcsMvp }
}
// The season booked again from its games as played (the season director's final): the record and his standings row,
// his line and WAR from the games, and every award. (The postseason stays the booked run's.)
export function rebookBaseball(result, games) {
  if (!result) return result
  const gs = games ?? result.games
  const wins = gs.filter(g => g.won).length, losses = gs.length - wins
  const tl = baseballTotals(gs, result.position, result)
  tl.firstHalf = baseballTotals(gs.slice(0, result.asbCut ?? 96), result.position, result).war
  tl.v = result.v
  const out = { ...result, games: gs, wins, losses, gameLog: gs.map(g => (g.won ? 'W' : 'L')), ...tl, line: displayLine(tl, result.position), ...seasonFields(gs, result.position) }
  out.rs = gs.reduce((s, g) => s + (g.mySc ?? 0), 0); out.ra = gs.reduce((s, g) => s + (g.oppSc ?? 0), 0); out.runDiff = out.rs - out.ra
  out.pct = r3(wins / Math.max(1, gs.length))
  out.standings = (result.standings ?? []).map(r => (r.isUs ? { ...r, wins, losses, pct: out.pct, rs: out.rs, ra: out.ra, diff: out.runDiff } : r))
  const aw = baseballAwards(out, tl)
  if (aw) { const { leaders, ...awards } = aw; out.awards = awards; out.leaders = leaders; out.mvp = !!awards.mvp?.won; out.cyYoung = !!awards.cyYoung?.won; out.allStar = !!awards.allStar?.selected }
  out.bestGame = bestOf(gs, result.position === 'bat')
  return out
}
// Squad Builder: his club's ratings with him in place of the man he replaces (or with him added: team.replaces false)
export function baseballBuildLift(build, team, position = 'bat', mode = 'current') {
  const m = mode === 'alltime' || mode === 'all-time' ? 'alltime' : 'current'
  const E = ENV[m]
  const pos = posOf(position)
  const club = resolveTeam(team)
  const rate = ratingsOf(club, team, m, null)
  const get = k => build?.[k]?.val
  if (pos === 'bat') {
    const prof = batProfile(get, E, 'lift')
    const rep = team?.replaces === false ? null : replacedOf(E, m, club.short, 'bat', null, team?.replaces)
    const wB = batWoba(E, prof)
    const spot = spotOf(E, prof, wB)
    const repW = rep ? rep.woba : batWoba(E, genBat(E, solveBat(E, teamWoba(E, rate.off))))
    const repSpot = rep ? spotOf(E, rep.prof, rep.woba) : spot
    const tw = teamWoba(E, rate.off) + (wB * SPOT_W[spot] - repW * SPOT_W[repSpot]) / SPOT_SUM
    const rsG = Math.max(1, runsOfWoba(E, tw))
    const off = E.mOff + Math.log(rsG / E.rg) / K_OFF
    // (team.role: the spot a squad plays him at; else where his club would)
    const R = String(team?.role ?? '').toUpperCase()
    const role = BAT_ROLES.has(R) ? R : bestPosition(get, rep?.p.role ?? null)
    const dFr = fieldRunsAt(get, role) - (rep ? fieldRunsAt(k => rep.p.attrs?.[k], rep.p.role) : 0)
    const raG = Math.max(1, rgDef(E, rate.def) - dFr / 162)
    const def = E.mDef - Math.log(raG / E.rg) / K_DEF
    return { off: r1(off), def: r1(def), replaced: rep?.p.name ?? null, role }
  }
  // (team.role 'SP' | 'CL' | 'RP': the job a squad gives him, whatever his stamina)
  const R = String(team?.role ?? '').toUpperCase()
  const role = R === 'SP' ? 'SP' : R === 'CL' || R === 'RP' ? 'RP' : baseballPitchRole(build)
  const prof = pitProfile(get, E, role !== 'SP', 'lift')
  const rep = team?.replaces === false ? null : replacedOf(E, m, club.short, 'pit', role === 'SP' ? 'SP' : 'CL', team?.replaces)
  const share = role === 'SP' ? (32 * ipPerStart(E, prof)) / IP_TEAM : 65 / IP_TEAM
  const repShare = rep ? (rep.p.role === 'SP' ? (32 * ipPerStart(E, rep.prof)) / IP_TEAM : 65 / IP_TEAM) : share
  const repW = rep ? pitWoba(E, rep.prof) : teamWobaA(E, rate.def)
  const twa = teamWobaA(E, rate.def) + (pitWoba(E, prof) - teamWobaA(E, rate.def)) * share - (repW - teamWobaA(E, rate.def)) * repShare
  const raG = Math.max(1, runsOfWobaA(E, twa))
  const def = E.mDef - Math.log(raG / E.rg) / K_DEF
  return { off: r1(rate.off), def: r1(def), replaced: rep?.p.name ?? null, role: role === 'SP' ? 'SP' : 'CL' }
}

// ─── A check of the engine (scripts/baseball/sim-test.mjs) ───────────────────
// Two league-average clubs play `games` games: the league line the engine makes from the environment's rates.
export function baseballEngineCheck(mode = 'current', games = 2000, seed = 1, off = null, def = null) {
  const E = ENV[mode === 'alltime' ? 'alltime' : 'current']
  off = off ?? E.mOff; def = def ?? E.mDef
  const rand = seeded(`bb-check|${seed}`)
  const g = solveBat(E, teamWoba(E, off))
  const gp = solvePit(E, x => pitWoba(E, rawPit(E, x, false)) * 0.58 + pitWoba(E, rawPit(E, x, true)) * 0.42, teamWobaA(E, def))
  const side = () => ({ lu: new Array(9).fill({ prof: genBat(E, g), isB: false }), sp: { prof: genPit(E, gp, false), isB: false, name: null }, pen: genPit(E, gp, true), dB: 0, rp: null })
  const T = { games: 0, runs: [0, 0], homeW: 0, extra: 0, ev: new Array(20).fill(0), sb: [0, 0], cs: [0, 0], spOuts: 0, spPitches: 0, spStarts: 0, cg: 0 }
  for (let i = 0; i < games; i++) playGame(E, side(), side(), rand, { tally: T })
  const ev = k => T.ev[k] + T.ev[10 + k]
  const pa = T.ev.reduce((s, x) => s + x, 0)
  const h = ev(EHR) + ev(E1B) + ev(E2B) + ev(E3B)
  const ab = pa - ev(EBB) - ev(EHBP)
  const tb = ev(E1B) + 2 * ev(E2B) + 3 * ev(E3B) + 4 * ev(EHR)
  return {
    rg: r2((T.runs[0] + T.runs[1]) / (2 * T.games)), paG: r2(pa / (2 * T.games)), avg: r3(h / ab), obp: r3((h + ev(EBB) + ev(EHBP)) / pa), slg: r3(tb / ab),
    kPct: r3(ev(EK) / pa), bbPct: r3(ev(EBB) / pa), hrPct: r3(ev(EHR) / pa), sbG: r2((T.sb[0] + T.sb[1]) / (2 * T.games)), csG: r2((T.cs[0] + T.cs[1]) / (2 * T.games)),
    homeWin: r3(T.homeW / T.games), extra: r3(T.extra / T.games), spIP: r2(T.spOuts / 3 / T.spStarts), spPitches: r1(T.spPitches / T.spStarts), cgPerTeam162: r2((T.cg / T.spStarts) * 162),
    target: { rg: r2(rgOff(E, off) * rgDef(E, def) / E.rg), avg: E.avg, obp: E.obp, slg: E.slg, k: E.K, bb: E.BB, hr: E.HR },
  }
}
