// ─── Soccer Simulation Engine (Striker) ──────────────────────────────────────
// The third sport's season engine: a striker (ST) build dropped into a real club (TOP DIVISIONS, mode
// 'current') or a nation at the World Cup (WORLD CUP, mode 'alltime': the all-time World Cup of the 48 greatest World Cup
// nations and their legends; Career's World Cups are the real 2026 nations, team.wc 2026). Basketball's engine
// (utils/bucketSimulation.js) is the model: the same call shape, the same top-level result fields, a
// seeded RNG so the live server can play a season back from its seed (lib/verifyCore.js), and a
// `script` (scriptSoccerSeason) so Squad Builder can play one season for a whole squad.
//
// ── How a season is played ───────────────────────────────────────────────────
// 1. The build's nine traits make a striker profile (profileOf): his share of the team's chances
//    (positioning, pace, dribbling and ball control, heading, size), his finishing against xG
//    (finishing, composure, shot power), how good his chances are (big-chance share), headers
//    (heading, then size), long shots, the chances he makes for the others and his assists (passing),
//    holding the ball up (size), penalties.
// 2. He takes the place of the club's real No. 9 (`starter: true` in SOCCER_STRIKERS, see 5). The
//    club's att/def ratings already include that player, so the team scores more or less in every
//    match by how much better or worse the build is than him (the lift, M) while he's on the pitch.
// 3. Every match in all five leagues is played from a goal model: Poisson goals off attack against
//    defence, home advantage, and the Dixon-Coles low-score correction (Dixon & Coles 1997, rho -0.10).
//    His club's league, domestic cup and European campaign come from those score lines.
// 4. His line in each match is drawn from the score, so it always adds up: his goals are a binomial
//    share of his team's goals (his expected goals over the team's), his shots and xG come from his
//    chance volume, his assists from his teammates' goals while he's on, and a match rating.
// 5. The awards race him against a simulated field: every real player in the data (up to five a side, each
//    with his `role`) scores his role's share of his club's simulated goals (a winger ~60% of a No. 9 with the
//    same traits, a No. 10 half, a central midfielder a quarter). The Golden Boot and Golden Shoe are
//    forwards only (ST, SS, LW, RW); Player of the Season, the Ballon d'Or and the Golden Ball count the
//    midfielders too, their playmaking traits standing for what their game is worth beyond goals. The
//    defenders and keepers who take votes (not in the data) are seeded seasons around their real level.
// 2. (who he replaces: the side's `starter: true` player, or its best ST by role, or its best forward)
//
// ── Real numbers the engine is tuned to (sources: FBref, Opta via the Premier League / UEFA, Transfermarkt)
// League goals per game, 2024-25 (FBref league summaries): Premier League 2.93, La Liga 2.62, Serie A 2.56,
//   Bundesliga 3.14, Ligue 1 2.96. Champions League league phase 2024-25 about 3.2 (UEFA). World Cup 2022 2.69,
//   2018 2.64 (FIFA). Home teams take about 54% of league goals (home/away goal ratio ~1.17, FBref 2022-25).
// A league striker's season (FBref):
//   elite: 25-36 league goals. Haaland 36 (2022-23, the 38-game Premier League record; Shearer and Cole's 34
//     came in 42-game seasons), 27 (23-24), 22 (24-25), 27 (25-26, his third Golden Boot, premierleague.com).
//     Kane 30 (17-18), 23 (20-21), 36 in the Bundesliga (23-24), 26 (24-25). Lewandowski 41 (20-21, the
//     Bundesliga record), 35 (21-22). Salah 32 (17-18), 29 (24-25). Mbappé 31 for Real Madrid (24-25).
//     Elite seasons average about 27 with a spread of about 5.5 (the seasons above).
//   a good starter 14-20 (Watkins 19 in 23-24; Wood 20 and Mateta 14 in 24-25), an average starting striker
//   8-14, a poor one 3-7.
// Non-penalty xG per 90 (FBref): elite 0.70-0.95 (Haaland 0.76 in 22-23, Kane ~0.75), good 0.50-0.65,
//   average starter 0.35-0.50, poor 0.20-0.35. xG per shot: elite ~0.20 (Haaland ~0.22), average ~0.14.
// Finishing against xG: elite +10-25% (Haaland 36 G from 28.4 xG in 22-23), average 0, poor -10-15%.
// Shot conversion (non-penalty goals / shots, FBref G/Sh): league average ~0.11, elite strikers 0.18-0.25,
//   an average striker ~0.12-0.15. Shots on target: strikers 38-48%.
// Big chances missed (Opta): elite strikers 15-28 a season (Haaland and Núñez in the high 20s), average 8-15.
// Penalties: about 0.12 awarded per team-match, ~78-80% scored (Premier League 2023-25); elite takers
//   85-90% (Kane). FBref/Understat value a penalty at 0.76 xG.
// Minutes: an elite No. 9 2,600-3,000 league minutes (Haaland 2,769 in 22-23; Kane 2,826 in 23-24), 30-35
//   starts, subbed off most weeks (about 82 minutes a start); an average starter 2,000-2,600.
// Assists: elite strikers 5-10 (Haaland 8, Kane 8 in 23-24 and 14 in the PL in 20-21), average 2-5.
// League top scorers (Transfermarkt), 2015-16 to 2024-25:
//   Premier League 25, 29, 32, 22, 23, 23, 23, 36, 27, 29 (and 27 in 25-26): about 27.
//   La Liga (Pichichi) 40, 37, 34, 36, 25, 30, 27, 23, 24, 31: about 31 (the Messi years).
//   Serie A (Capocannoniere) 36, 29, 29, 26, 36, 29, 27, 26, 24, 25: about 29.
//   Bundesliga (Torjägerkanone) 30, 31, 29, 22, 34, 41, 35, 16, 36, 26: about 30.
//   Ligue 1 38, 35, 28, 33, 18 (a short season), 27, 28, 29, 27, 21: about 28.
//   European Golden Shoe winners (league goals x2 in the top five leagues): 30-41 goals (Lewandowski 41 in
//   20-21, Haaland 36 in 22-23, Kane 36 in 23-24, Mbappé 31 in 24-25).
// World Cup Golden Boot (FIFA): 1998 Šuker 6, 2002 Ronaldo 8, 2006 Klose 5, 2010 Müller 5, 2014 James 6,
//   2018 Kane 6, 2022 Mbappé 8: usually 5-8. 2026's 48-team format gives the finalists 8 matches, not 7.
//
// ── Exports ──────────────────────────────────────────────────────────────────
//   SOCCER_TRAITS, SOCCER_OVR_WEIGHTS
//   calcSoccerOVR(build, types)                      → 0-99
//   getSoccerArchetype(ovr, build, types)            → a name in real football language ('Poacher', 'Target Man'…)
//   runSoccerSimulation(build, types, team, mode = 'current', rngSeed = null, gameMode = 'classic', script = null)
//   scriptSoccerSeason(team, tr, rngSeed, mode = 'current') → a season for a squad (see `script` below)
//   soccerAwards(result, totals)                     → the awards again from new totals (a season the director
//                                                       spliced: goals/assists changed after the run)
//   soccerTeam10(team, mode) / soccerTeamFrom10(off, def, mode) → club ratings ↔ Career's 1-10 scale
//   soccerStrikerLift(build, team, mode)              → { M, att, replaced }: his side's attack with him as its No. 9
//   soccerLeagueInfo(leagueId)                       → { country, cup, boot, poty, size, ucl, uel, games }
//   UCL_CLUBS, isUclResult(result), soccerUclRebook(result, games) → the Champions League (below)
//
// ── Which season (since 2026-11-16) ──────────────────────────────────────────
// mode 'current': a build's season is his club's 2026-27 Champions League campaign (uclSeason; its result is under
// "The Champions League" further down). Career (team.career), Squad Builder (a script, team.squad) and team.domestic
// play the domestic season described next (clubSeason). Mode 'alltime' is the World Cup: since 2026-11-16 the all-time one
// (the legends field, data/soccer-legends.js, no hosts, season 'All-Time'); team.wc 2026 (Career) or a nation only the 2026
// World Cup has (an old save) plays the real 2026 field (season '2026'). A script carries its field (script.wcField).
//
// `team`: a club (mode 'current') or nation (mode 'alltime') from the data, at least { short }.
//   team.offMod / team.defMod: the season director's moments (±1 on the 1-10 scale each).
//   team.career + team.off / team.def (1-10): Career's own team; team.usage (0-1): his share of the chances
//   (Career, Squad Builder); team.bench: a backup (few starts); team.age: Best Young Player eligibility;
//   team.europe ('ucl' | 'uel' | 'uecl' | null) or team.lastPos (1-20): where he plays in Europe this season.
//   team.sched (Career): a seed for his league's fixture list, the same through every re-run of one season.
//   team.yrs / team.world (Career): seasons since 2026 and the career's seed: the award field's players age out.
//   team.tier2 (Career): his club plays its country's second tier this season (result.league.tier 2, promoted).
//   team.field (mode 'alltime', Career): a tournament field of its own (soccerNationField).
// rngSeed: a number or a string. The same build, team, mode and seed always play the same season.
//
// ── The result (mode 'current', a club season) ────────────────────────────────
// {
//   sport: 'soccer', mode: 'current', position: 'st', gameMode, season: '2026-27',
//   ovr, archetype, team: { ...club, att, def },            // att/def as played (the director's moments in)
//   league: { id, name, short, country, cup, boot, poty, size, games },
//   // basketball's fields
//   wins, draws, losses, points, gf, ga, gd,                 // the league record
//   seed,                                                    // league position (1 = champions)
//   conference,                                              // the league id
//   standings: [{ short, name, played, wins, draws, losses, gf, ga, gd, points, pos, isUs }],   // the table
//   champion,                                                // won the league
//   madePlayoffs, playoffs,                                  // finished in a Champions League place
//   playoffRounds: [tie],                                    // every knockout tie (cup and Europe), in date order
//   games: [match],                                          // the league matches, matchweek order
//   gameLog: ['W' | 'D' | 'L'], bestGame: match,
//   mvp: Player of the Season won, dpoy: false,
//   finalsOpp, finalsSeries,                                 // the European final: opponent short, '2-1' / '1-1 (4-3 pens)'
//   // the striker's league season (Golden Boot, the director's totals)
//   apps, starts, mins, goals, assists, shots, sot, xg, npxg, bcm, pens, pensTaken, headers, outside,
//   hatTricks, braces, motm, avgRating, conversion (np goals / shots %), sotPct, goalsPer90, xgPer90, gMinusXg,
//   seasonGoals, seasonAssists, seasonShots, seasonSOT, seasonXG, seasonMins, seasonApps, seasonStarts, seasonBCM, seasonPens,
//   allComps: { same totals, every competition }, byComp: { league, cup, europe },
//   fixtures: [match],                                       // every competition, in date order
//   cup: { name, rounds: [tie], result, champion, winner: short },  // result: 'Winners', 'Runners-up' or the round he went out in
//   europe: null | { comp: 'ucl' | 'uel', name, table: [row], position, games: [match] (the league phase), rounds: [tie],
//            result: 'Winners' | 'Runners-up' | 'Semi-finals' | 'Quarter-finals' | 'Round of 16' | 'Knockout play-offs' | 'League phase',
//            champion, winner },
//   otherLeagues: { [leagueId]: { champion, top: [row x4] } }, europeWinners: { ucl, uel },
//   trophies: ['Premier League', 'FA Cup', 'Champions League'],
//   qualified: 'ucl' | 'uel' | 'uecl' | null,                // next season, from the league finish (and the cup)
//   relegated, relegationPlayoff,
//   goldenBoot:     { name, won, shared, rank, goals, winner, race: [entry] },
//   playerOfSeason: { name, won, rank, winner },
//   teamOfSeason:   bool,
//   goldenShoe:     { won, rank, goals, points, winner, race: [entry] },
//   ballonDor:      { rank, finish: 'winner' | 'top3' | 'top10' | 'nominated' | null, winner, top: [entry] },
//   book,                                                    // the award fields, for soccerAwards()
// }
// match: { g, wk, comp: 'league' | 'cup' | 'ucl' | 'uel' | 'wc', round, leg, home, neutral, opponent, oppName,
//          oppExtra (a side outside the data: no logo), mySc, oppSc, won, drawn, lost, result: 'W' | 'D' | 'L',
//          through (a knockout: went through, else null), et, shootout: null | { my, opp, won, kick: 'scored' | 'missed' | null },
//          app (0/1), gs (0/1), start, mins, goals, assists, shots, sot, xg, npxg, bcm, pens, pensTaken,
//          headers, outside, rating (null when he didn't play), motm }
//   (W/D/L is the match's own score; level and decided on penalties counts as won or lost. A second leg can
//   be lost 1-0 with `through` true. League games: wk is the matchweek; fixtures keep the calendar week.)
// tie: { type: 'tie', comp, name, roundIndex, opponent: { short, name }, legs: [match], agg: [my, opp] | null,
//        won, et, shootout, final }
// entry (award races): { name, team, goals, assists?, score?, isPlayer } — the build's entry has name null
//   and isPlayer true: the page labels him with the username (never "You").
//
// ── The result (mode 'alltime', the World Cup) ────────────────────────────────
// The same fields where they apply: wins/draws/losses/points/gf/ga are the group's, seed = group place,
// conference = the group letter, standings = his group, games = every match he played (3 group games, then
// the knockouts), playoffRounds = his knockout ties, champion = won the World Cup, madePlayoffs = reached the
// Round of 32, finalsOpp/finalsSeries = the final. Plus: groups: { A: [row] … }, groupGames (his group's six matches,
// [matchday, home, away, hs, as]; the all-time World Cup only), bracket: { r32, r16, qf, sf,
// third, final } (every knockout match), finish ('Winners' | 'Runners-up' | 'Third place' | 'Fourth place' |
// 'Quarter-finals' | 'Round of 16' | 'Round of 32' | 'Group stage'), goldenBoot, goldenBall ({ won, rank,
// medal: 'Golden Ball' | 'Silver Ball' | 'Bronze Ball' | null, winner }), bestYoungPlayer ({ eligible, won,
// winner }), mvp (Golden Ball won), the striker's tournament totals (the same keys as the league season).
//
// ── `script` (Squad Builder) ──────────────────────────────────────────────────
// scriptSoccerSeason(team, { att, def }, seed) plays the season once from the squad's strength (the 0-100
// club scale; { off, def } works too): every score line, the table, the cup, Europe and the award field.
// runSoccerSimulation(build, …, script) then plays this build's line inside it: the scores never change,
// his goals are drawn as a share of them (team.usage: his share of the chances).

import { seeded } from '../lib/rng'
import { SOCCER_SIM_LEAGUES, SOCCER_SIM_CLUBS, SOCCER_ALL_CLUBS, OTHER_LEAGUES, UCL_SHORTS } from '../data/soccer-clubs'
import { WC_NATIONS, WC2026_NATIONS } from '../data/soccer-nations'
import { SOCCER_ALL_STRIKERS, WC_STRIKERS, WC2026_STRIKERS } from '../data/soccer-strikers'
// (every league season in the five leagues is played, whichever leagues Career deals from; the players are every
// club player in the data, the Champions League clubs from outside the five leagues included)
const SOCCER_STRIKERS = SOCCER_ALL_STRIKERS

export const SOCCER_TRAITS = ['pace', 'finishing', 'shotPower', 'dribbling', 'passing', 'positioning', 'heading', 'size', 'composure']
const SEASON = '2026-27'

// ─── Small helpers ───────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const r1 = v => Math.round(v * 10) / 10
const r2 = v => Math.round(v * 100) / 100
const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const norm = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()   // (accents off: Atlético = atletico)
function poisson(l, rand) {
  if (!(l > 0)) return 0
  const L = Math.exp(-l)
  let k = 0, p = rand()
  while (p > L && k < 30) { k++; p *= rand() }
  return k
}
function binom(n, p, rand) { let k = 0; for (let i = 0; i < n; i++) if (rand() < p) k++; return k }
function gauss(rand) { const u = 1 - rand(), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
function shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
function pickWeighted(items, weightOf, rand) {
  const w = items.map(weightOf), tot = w.reduce((s, x) => s + x, 0)
  let r = rand() * tot
  for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i] }
  return items[items.length - 1]
}
// A season's random streams. Every part of the season draws from its own stream (the world, his minutes
// in each competition, his lines, the award field), so a change in one part never shifts another, and a
// seed always plays the same season. No seed: a random one, drawn once.
const seedBase = rngSeed => (rngSeed == null ? `x${Math.floor(Math.random() * 4294967296)}` : `s${rngSeed}`)
const stream = (base, tag) => seeded(`${base}|${tag}`)

// ─── OVR ─────────────────────────────────────────────────────────────────────
// What makes a striker score, in order: finishing (goals against xG is a real, lasting skill for the best,
// but small next to chance volume), then positioning (getting the chances at all; most of a striker's goals
// are decided by where he is when the ball arrives), then dribbling (with ball control and first touch in it
// since 11-16) and composure (big-chance conversion, penalties). EA FC's own ST rating leans the same way
// (finishing 18%, positioning 13%, then heading, shot power and ball control at 10% each; pace 9% between
// acceleration and sprint speed); passing counts here for the modern No. 9's assists and size for the duels.
// Same scale as the other sports (grades 0-11: A = 96, B+ = 86, B = 81, B- = 77), so an elite real striker
// (mostly A and A+) lands 93-99, an average starter (B/B+) 78-84.
// (until 11-16, ten: finishing .18, offBall .16, composure .10, firstTouch .10, pace .09, shotPower .08,
// heading .08, dribbling .07, linkUp .07, strength .07)
export const SOCCER_OVR_WEIGHTS = {
  finishing: 0.18, positioning: 0.17, dribbling: 0.12, composure: 0.11, pace: 0.10,
  shotPower: 0.08, heading: 0.08, passing: 0.08, size: 0.08,
}
export function calcSoccerOVR(build, types = SOCCER_TRAITS) {
  let sum = 0, wt = 0
  for (const t of types) {
    if (!build?.[t]) continue
    const v = build[t].val ?? 0
    const w = SOCCER_OVR_WEIGHTS[t] ?? (1 / types.length)
    sum += v * w
    wt += w
  }
  if (!wt) return 0
  return Math.min(99, Math.round(57 + ((sum / wt - 1) / 9) * 44))
}
const ovrOfAttrs = attrs => calcSoccerOVR(Object.fromEntries(SOCCER_TRAITS.map(t => [t, { val: attrs?.[t] ?? 5 }])), SOCCER_TRAITS)

// ─── A striker's profile from his traits ─────────────────────────────────────
// (trait values on the 0-11 grade scale; 6 = B, a starter's level)
const BIG_X = 0.2 + 0.6 / 2.6       // a big chance: xG 0.20-0.80, mean ~0.43 (Opta's big chances convert ~40%)
const BOX_X = 0.03 + 0.12 / 2.5     // a normal shot in the box: 0.03-0.15, mean ~0.08
const LONG_X = 0.035                // from outside the box: 0.015-0.055
function profileOf(get) {
  const v = t => clamp(Number(get(t) ?? 5), 0, 11)
  const fin = v('finishing'), sp = v('shotPower'), hd = v('heading'), dr = v('dribbling')
  const lu = v('passing'), pa = v('pace'), st = v('size'), ob = v('positioning'), co = v('composure')
  // his share of the team's chances (at an average team), flattening at the top: a poor No. 9 ~0.11, an
  // average starter ~0.20, a good one ~0.33, elite ~0.40, an S striker ~0.45 (Haaland takes ~0.38 of City's
  // xG, a weaker side's No. 9 more of less). Positioning first: being where the ball arrives.
  const volIdx = 0.40 * ob + 0.14 * pa + 0.17 * dr + 0.11 * hd + 0.09 * st + 0.07 * sp + 0.02 * lu
  const share = 0.08 + 0.355 / (1 + Math.exp(-0.8 * (volIdx - 7)))
  // goals per xG: elite +12-18% (Haaland, Kane and Son over their careers), average 1.0, poor -8%
  const finIdx = 0.55 * fin + 0.30 * co + 0.15 * sp
  const F = clamp(1 + 0.035 * (finIdx - 6), 0.75, 1.25)
  // chance quality: how many of his shots are big chances, how many from range, how many headers
  const qIdx = 0.5 * ob + 0.2 * pa + 0.15 * co + 0.15 * hd
  const big = clamp(0.22 + 0.016 * (qIdx - 6), 0.12, 0.34)
  const long = clamp(0.18 + 0.015 * (sp - 6) - 0.015 * (ob - 6), 0.05, 0.35)
  const head = clamp(0.13 + 0.025 * (hd - 6) + 0.01 * (st - 6), 0.03, 0.42)
  const q = big * BIG_X + (1 - big) * ((1 - long) * BOX_X + long * LONG_X)
  // of his teammates' goals while he's on, how many he sets up (average ~0.11, a Kane ~0.17): passing
  const assist = clamp(0.02 + 0.010 * lu + 0.004 * dr + 0.002 * ob, 0.02, 0.24)
  const penIdx = 0.45 * fin + 0.40 * co + 0.15 * sp
  const penConv = clamp(0.60 + 0.03 * penIdx, 0.6, 0.93)     // B 78%, A 87%, S 93%
  const taker = penIdx >= 6 ? 1 : penIdx >= 4 ? 0.6 : 0.25    // his club's taker (a weak one shares them)
  const onTarget = clamp(0.26 + 0.012 * (fin - 6) + 0.006 * (sp - 6), 0.15, 0.4)   // a miss that still tests the keeper
  // size: his durability and minutes (spellsOf, p90) and, with his touch, holding the ball up for the others
  return { share, F, big, long, head, q, assist, penConv, taker, onTarget, link: lu, size: st, hold: 0.6 * st + 0.4 * dr }
}
const profileOfBuild = build => profileOf(t => build?.[t]?.val)
const profileOfAttrs = attrs => profileOf(t => attrs?.[t])
const GENERIC_BACKUP = { share: 0.14, F: 0.92, link: 4, hold: 5, assist: 0.08 }
const LAM_REF = 1.45
// his share of the chances at a team that scores `lam` a game: the best sides spread the goals around
// (Haaland ~0.38 of City's xG), a weak side leans on its No. 9 (~0.45 for an elite one)
const shareAt = (prof, lam, usage = 1) => clamp(prof.share * Math.pow(LAM_REF / Math.max(0.5, lam), 0.45) * usage, 0.04, 0.62)
// his penalties as a share of the team's goals (a good side wins more of them)
const penRateAt = lam => PEN_RATE * Math.pow(Math.max(0.3, lam) / 1.4, 0.7)

// ─── The data, read once ─────────────────────────────────────────────────────
// Each league: goals a game, the cup, the awards, Europe and the drop (UEFA's access list for 2024-27; each league's
// 2026-27 rules). ucl: its Champions League places by league finish before a European Performance Spot (the two
// associations whose clubs did best in Europe that season get one more each: England and Spain for 2026-27); uclq:
// France's fourth goes into the Champions League's third qualifying round (lib/careerSoccer.js plays it out).
// down: straight down; playoff: the place above them plays the second tier over two legs (the Bundesliga's and
// Ligue 1's 16th). tb: the tiebreakers after points (sortLeague below): La Liga and Serie A head-to-head first,
// the Premier League and the Bundesliga goal difference and goals, Ligue 1 goal difference then head-to-head.
const LEAGUE_META = {
  ENG: { goals: 2.93, cup: 'FA Cup', boot: 'Golden Boot', poty: 'Player of the Season', ucl: 4, uel: 2, uecl: 1, down: 3, playoff: false, tb: ['gd', 'gf', 'h2hPts', 'h2hAway'] },
  ESP: { goals: 2.62, cup: 'Copa del Rey', boot: 'Pichichi', poty: 'Player of the Season', ucl: 4, uel: 2, uecl: 1, down: 3, playoff: false, tb: ['h2hPts', 'h2hGd', 'gd', 'gf'] },
  ITA: { goals: 2.56, cup: 'Coppa Italia', boot: 'Capocannoniere', poty: 'MVP', ucl: 4, uel: 2, uecl: 1, down: 3, playoff: false, tb: ['h2hPts', 'h2hGd', 'gd', 'gf'] },
  GER: { goals: 3.14, cup: 'DFB-Pokal', boot: 'Torjägerkanone', poty: 'Player of the Season', ucl: 4, uel: 2, uecl: 1, down: 2, playoff: true, tb: ['gd', 'gf', 'h2hPts', 'h2hGd', 'h2hAway'] },
  FRA: { goals: 2.96, cup: 'Coupe de France', boot: 'Top Scorer', poty: 'Player of the Year', ucl: 3, uclq: 1, uel: 2, uecl: 1, down: 2, playoff: true, tb: ['gd', 'h2hPts', 'h2hGd', 'gf', 'wins'] },
}
// (a season with no European results to read: England's spot, the one it has won every year since the spots began)
const DEFAULT_EPS = ['ENG']
// Europe next season, from a final table and the cup: the Champions League by league place (`ucl`, one more with
// a European Performance Spot: eps, the countries that have one); the Europa League to the next place and the cup
// winner (`uel`: two places in all; a cup winner already in Europe by the league passes his to the next place);
// the Conference League to the next place after those (England's goes to the League Cup winner, a cup this game
// doesn't play: the next place takes it, as it does whenever the League Cup winner is already in Europe).
// France's fourth: a Champions League qualifier (out._q names it).
// → { [short]: 'ucl' | 'uel' | 'uecl', _q?: short }
function europePlaces(key, table, cupWinner, eps = DEFAULT_EPS) {
  const m = LEAGUE_META[key] ?? LEAGUE_META.ENG, order = table.map(r => r.short), out = {}
  let next = 0
  const give = comp => { while (next < order.length && out[order[next]]) next++; if (next < order.length) { out[order[next]] = comp; return order[next++] } return null }
  const extra = (eps ?? DEFAULT_EPS).includes(key)
  for (let i = 0; i < m.ucl + (extra ? 1 : 0); i++) give('ucl')
  if (m.uclq && !extra) { const q = give('ucl'); if (q) Object.defineProperty(out, '_q', { value: q, enumerable: false }) }
  for (let i = 0; i < m.uel - 1; i++) give('uel')
  if (cupWinner && order.includes(cupWinner) && !out[cupWinner]) out[cupWinner] = 'uel'; else give('uel')
  for (let i = 0; i < (m.uecl ?? 1); i++) give('uecl')
  return out
}
const LEAGUE_NAME = { ENG: 'Premier League', ESP: 'La Liga', ITA: 'Serie A', GER: 'Bundesliga', FRA: 'Ligue 1' }
function countryKey(l) {
  const s = norm(`${l?.country ?? ''} ${l?.name ?? ''} ${l?.id ?? ''} ${l?.short ?? ''}`)
  if (/german|bundes/.test(s)) return 'GER'
  if (/franc|ligue/.test(s)) return 'FRA'
  if (/ital|serie/.test(s)) return 'ITA'
  if (/spai|espa|laliga|la liga/.test(s)) return 'ESP'
  return 'ENG'
}
const LEAGUES = (SOCCER_SIM_LEAGUES ?? []).map(l => ({ ...l, key: countryKey(l) }))
const CLUBS = (SOCCER_SIM_CLUBS ?? []).map(c => ({ ...c, att: Number(c.att) || 75, def: Number(c.def) || 75 }))
const leagueOfClub = c => LEAGUES.find(l => c.league === l.id || c.league === l.short || c.league === l.name) ?? LEAGUES[0]
for (const c of CLUBS) { const L = leagueOfClub(c); c.lid = L?.id; c.country = L?.key ?? 'ENG' }
const CLUB_BY = new Map(CLUBS.map(c => [c.short, c]))
const clubsOf = lid => CLUBS.filter(c => c.lid === lid)
// The World Cup's field (the nations, their players, the scale, the hosts and the extra stars) is one of two: the
// legends (WORLD CUP mode) or the real 2026 World Cup (Career). wcField() below builds each; withField() points these
// at one for a call (the engine is synchronous, so a call never sees the other's).
let NATIONS = [], NATION_BY = new Map(), HOSTS = new Set(), NATION_STRIKERS = new Map(), STARS_WC = []
let W_SD_ATT = 6, W_SD_DEF = 6, W_ATT = 80, W_DEF = 80, KW_ATT = 0.04, KW_DEF = 0.04, WC_BASE = 1.3, WC_KEY = 'legends'

// The players (every attacker and midfielder, up to 5 a side, each with his real `role`). A side's list
// starts with its main striker, the one a build replaces: `starter: true`, or the best ST by role, or the
// best forward; then the other strikers, then everyone else by overall.
// Each role's part of a side's goals and assists, against a No. 9 with the same traits (FBref 2022-25: a
// first-choice winger scores ~60% of a No. 9's goals and sets up ~1.6x as many; a No. 10 about half;
// a central midfielder a quarter; a holding one hardly any), and how much a midfielder's game is worth
// beyond his goals in the season awards (v: per point of playmaking above B-).
const ROLE = {
  ST: { g: 1, a: 1, v: 0 }, SS: { g: 0.85, a: 1.3, v: 0.8 }, LW: { g: 0.62, a: 1.6, v: 1.4 }, RW: { g: 0.62, a: 1.6, v: 1.4 },
  AM: { g: 0.5, a: 1.9, v: 2.4 }, CM: { g: 0.25, a: 1.4, v: 3.0 }, DM: { g: 0.1, a: 0.8, v: 3.4 },
}
const FORWARDS = new Set(['ST', 'SS', 'LW', 'RW'])
const roleOf = p => { const r = String(p?.role ?? 'ST').toUpperCase(); return ROLE[r] ? r : 'ST' }
const isForward = p => FORWARDS.has(roleOf(p))
const playValue = p => { const a = p.attrs ?? {}; return ROLE[roleOf(p)].v * Math.max(0, (2 * (a.passing ?? 5) + (a.composure ?? 5) + (a.dribbling ?? 5)) / 4 - 5) }
const withProf = p => ({ ...p, role: roleOf(p), ovr: ovrOfAttrs(p.attrs), prof: profileOfAttrs(p.attrs), value: playValue(p) })
const byTeam = list => {
  const m = new Map()
  for (const p of (list ?? []).map(withProf)) { if (!m.has(p.team)) m.set(p.team, []); m.get(p.team).push(p) }
  const rank = p => (p.role === 'ST' ? 0 : p.role === 'SS' ? 1 : isForward(p) ? 2 : 3)
  for (const [k, arr] of m) {
    arr.sort((a, b) => rank(a) - rank(b) || b.ovr - a.ovr || (a.name < b.name ? -1 : 1))
    const main = arr.find(p => p.starter) ?? arr[0]
    m.set(k, [main, ...arr.filter(p => p !== main)])
  }
  return m
}
const CLUB_STRIKERS = byTeam(SOCCER_STRIKERS)

// The rating scale. One rating point means the same everywhere: it's scaled so the spread inside a league
// gives real tables (the best attack ~2.3 goals a game, the worst ~0.8; champions ~85-90 points). A team's
// log attack strength spreads ~0.29 across a league (FBref 2020-25 goals for), defence ~0.27.
function pooledSd(groups, key) {
  let ss = 0, n = 0, k = 0
  for (const g of groups) { if (g.length < 2) continue; const m = avg(g.map(c => c[key])); for (const c of g) ss += (c[key] - m) ** 2; n += g.length; k++ }
  return n - k > 0 ? Math.sqrt(ss / (n - k)) || 6 : 6
}
const LG = LEAGUES.map(l => clubsOf(l.id))
const SD_ATT = Math.max(2, pooledSd(LG, 'att')), SD_DEF = Math.max(2, pooledSd(LG, 'def'))
const K_ATT = 0.29 / SD_ATT, K_DEF = 0.27 / SD_DEF
const G_ATT = avg(CLUBS.map(c => c.att)), G_DEF = avg(CLUBS.map(c => c.def))
const H_DOM = 0.078            // ln(1.17) / 2
const H_EURO = 0.09
const RHO = -0.10              // Dixon-Coles
// the most goals a side can expect in a match (the strongest attack at home to the weakest defence: Bayern 8-2, not
// 13-0; before 2026-11-24 the rate had no ceiling and a side with a great build ran up 10s and 13s), his side a little
// more with the build's lift
const LAM_MAX = 3.2, LAM_MAX_U = 3.6, GOALS_MAX = 8   // (8: the most a side has scored in a Champions League match)
const ET_F = 0.30              // extra time: a third of a match at ~90% of the rate
const PEN_RATE = 0.115         // penalties awarded per team-match
// the World Cup: one pool of 48, a wider spread (Spain against Curaçao); its W_* are the field's (wcField below)
// A rating far above the rest counts for less past two spreads (half as much): a 3-spread outlier (Barcelona
// in La Liga, Spain at the World Cup) is great, not unbeatable. k: per rating point, sd: the spread.
const soft = z => (z > 1.8 ? 1.8 + (z - 1.8) * 0.45 : z < -1.8 ? -1.8 + (z + 1.8) * 0.45 : z)
const term = (k, d, sd) => k * sd * soft(d / sd)
const aT = d => term(K_ATT, d, SD_ATT), dT = d => term(K_DEF, d, SD_DEF)
const waT = d => term(KW_ATT, d, W_SD_ATT), wdT = d => term(KW_DEF, d, W_SD_DEF)
const H_WC = 0.12              // a host nation at home

// each league's base rate, so its matches average its real goals per game
const LEAGUE_BASE = new Map()
for (const l of LEAGUES) {
  const cs = clubsOf(l.id), mA = avg(cs.map(c => c.att)), mD = avg(cs.map(c => c.def))
  let s = 0, n = 0
  for (const a of cs) for (const b of cs) if (a !== b) { s += Math.exp(aT(a.att - mA) - dT(b.def - mD) + H_DOM) + Math.exp(aT(b.att - mA) - dT(a.def - mD) - H_DOM); n++ }
    // (lowA / lowD: the three weakest sides' attack and defence, what a club coming up is measured against)
  const low = cs.slice().sort((a, b) => (a.att + a.def) - (b.att + b.def)).slice(0, 3)
  LEAGUE_BASE.set(l.id, { base: n ? (LEAGUE_META[l.key].goals) / (s / n) : 1.4, mA, mD, minA: Math.min(...cs.map(c => c.att)), minD: Math.min(...cs.map(c => c.def)), lowA: avg(low.map(c => c.att)), lowD: avg(low.map(c => c.def)) })
}
const EURO_BASE = 1.47

// ─── Career's 1-10 scale ─────────────────────────────────────────────────────
// 5.5 is an average side; one point is 0.55 of a league's spread (about 17% more goals). The season
// director's moments move a team by whole points (team.offMod / defMod).
const scaleOf = mode => (mode === 'alltime' ? { mA: W_ATT, mD: W_DEF, sA: W_SD_ATT * 0.55, sD: W_SD_DEF * 0.55 } : { mA: G_ATT, mD: G_DEF, sA: SD_ATT * 0.55, sD: SD_DEF * 0.55 })
export function soccerTeam10(team, mode = 'current') {
  if (mode === 'alltime' && FIELD !== fieldFor(team)) return withField(fieldFor(team), () => soccerTeam10(team, mode))
  const src = (mode === 'alltime' ? NATION_BY : CLUB_BY).get(team?.short) ?? team ?? {}
  const s = scaleOf(mode)
  return { off: r1(clamp(5.5 + ((src.att ?? s.mA) - s.mA) / s.sA, 1, 10)), def: r1(clamp(5.5 + ((src.def ?? s.mD) - s.mD) / s.sD, 1, 10)) }
}
export function soccerTeamFrom10(off, def, mode = 'current') {
  const s = scaleOf(mode)
  return { att: s.mA + ((off ?? 5.5) - 5.5) * s.sA, def: s.mD + ((def ?? 5.5) - 5.5) * s.sD }
}
export function soccerLeagueInfo(leagueId) {
  const t2 = Object.entries(TIER2).find(([, x]) => x.id === leagueId)
  if (t2) { const top = LEAGUES.find(x => x.key === t2[0]), m = LEAGUE_META[t2[0]]; return { id: t2[1].id, name: t2[1].name, short: t2[1].short, country: top?.country, key: t2[0], cup: m.cup, boot: 'Golden Boot', poty: 'Player of the Season', size: t2[1].size, games: 2 * (t2[1].size - 1), ucl: 0, uel: 0, uecl: 0, down: 0, playoff: false, tier: 2, up: t2[1].up, playoffTo: t2[1].playoffTo } }
  const l = LEAGUES.find(x => x.id === leagueId || x.short === leagueId || x.name === leagueId) ?? LEAGUES[0]
  if (!l) return null
  const m = LEAGUE_META[l.key], size = clubsOf(l.id).length
  return { id: l.id, name: l.name, short: l.short, country: l.country, key: l.key, cup: m.cup, boot: m.boot, poty: m.poty, size, games: 2 * (size - 1), ucl: m.ucl, uclq: m.uclq ?? 0, uel: m.uel, uecl: m.uecl ?? 1, down: m.down, playoff: !!m.playoff, tb: m.tb }
}
// where a final table and the cup winner send every club in Europe next season: { [short]: 'ucl' | 'uel' | 'uecl' }
// (eps: the countries with a European Performance Spot next season, the season's own: result.next.eps)
export function soccerEuropePlaces(leagueId, table, cupWinner = null, eps = DEFAULT_EPS) {
  const l = LEAGUES.find(x => x.id === leagueId || x.short === leagueId || x.name === leagueId) ?? LEAGUES[0]
  return europePlaces(l.key, table ?? [], cupWinner, eps)
}
// a club by its code, wherever it plays: the data's, or one from outside it (a second-tier side, a cup's lower-division
// one, one of Europe's others) with its name, its country and its rating there. top: a club outside the data that has
// come up into its top flight (Career's world). → { short, name, att, def, country, extra, b } | null
export function soccerClubInfo(short, top = false) {
  const c = CLUB_BY.get(short) ?? EXTRA_BY.get(short)
  if (c) return c
  const info = T2_INFO.get(short) ?? LOWER_INFO.get(short)
  return info ? synthClub(short, info.key, top) : null
}
// the second tier's rules for a top-flight league id (null for one it doesn't know)
export const soccerTier2 = leagueId => { const l = LEAGUES.find(x => x.id === leagueId); return l ? { ...TIER2[l.key], key: l.key } : null }
// The league table after `upto` matchweeks, from a season's `form` (every club's goals for and against, a digit a
// matchweek: clubSeason's result.form). mine: { short, games }: his club's matches as they were really played (the
// season director's games: a moment moves a score), which replace the simulated ones for his club and its opponents.
export function soccerTableAt(form, upto, mine = null) {
  if (!form) return null
  const rows = {}
  for (const [short, v] of Object.entries(form.by ?? {})) rows[short] = { short, name: form.names?.[short] ?? short, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, isUs: short === mine?.short }
  const add = (r, f, a) => { if (!r) return; r.played++; r.gf += f; r.ga += a; if (f > a) { r.wins++; r.points += 3 } else if (f === a) { r.draws++; r.points++ } else r.losses++; r.gd = r.gf - r.ga }
  // (the head-to-head, when the form says who played whom: form.vs, form.order)
  const h2h = form.vs && form.order ? new Map() : null
  const oppAt = (short, k) => { const ch = form.vs?.[short]?.[k]; if (!ch || ch === '-') return null; const code = ch.charCodeAt(0), home = code < 97; return { opp: form.order[code - (home ? 65 : 97)], home } }
  const rec = (short, k, f, a, them = null, home = null) => {
    if (!h2h) return
    const o = them != null ? { opp: them, home } : oppAt(short, k)
    if (!o?.opp) return
    const key = `${short}>${o.opp}`, r = h2h.get(key) ?? { pts: 0, gf: 0, ga: 0, away: 0, n: 0 }
    r.gf += f; r.ga += a; r.n++; r.pts += f > a ? 3 : f === a ? 1 : 0; if (o.home === false) r.away += f
    h2h.set(key, r)
  }
  const n = Math.min(upto ?? form.rounds, form.rounds)
  const opp = mine ? form.opp?.[mine.short] ?? null : null
  for (let k = 0; k < n; k++) {
    const g = mine?.games?.[k] ?? null
    // (his club's match this matchweek, as played: both sides of it. The other side is the fixture list's)
    const them = g ? (opp?.[k] ?? g.opponent ?? null) : null
    for (const [short, [gf, ga]] of Object.entries(form.by)) {
      const f = gf[k], a = ga[k]
      if (f === undefined || f === '-') continue
      if (g && short === mine.short) { add(rows[short], g.mySc ?? 0, g.oppSc ?? 0); rec(short, k, g.mySc ?? 0, g.oppSc ?? 0, them, oppAt(short, k)?.home ?? null); continue }
      if (g && short === them) { add(rows[short], g.oppSc ?? 0, g.mySc ?? 0); rec(short, k, g.oppSc ?? 0, g.mySc ?? 0, mine.short, oppAt(short, k)?.home ?? null); continue }
      add(rows[short], +f, +a); rec(short, k, +f, +a)
    }
  }
  // (each league's own tiebreakers, form.key; a form from before them: goal difference, goals, wins)
  const list = form.key ? sortLeague(Object.values(rows), form.key, h2h) : Object.values(rows).sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || y.wins - x.wins || (x.isUs ? -1 : y.isUs ? 1 : 0) || (x.short < y.short ? -1 : 1))
  list.forEach((r, i) => { r.pos = i + 1 })
  return list
}

// ─── Clubs outside the data (no logo: `extra: true`) ─────────────────────────
// Europe's other sides, rated against the top five's average in league spreads (Benfica and Sporting are
// a top-five side's 5th-6th; Kairat or Slovan a bottom one's), and each country's lower divisions for the cup.
const EURO_EXTRA = [
  // CL level
  ['Benfica', 'SLB', 'POR', 0.9, 'ucl'], ['Sporting CP', 'SPO', 'POR', 0.9, 'ucl'], ['PSV Eindhoven', 'PSV', 'NED', 0.8, 'ucl'],
  ['Galatasaray', 'GAL', 'TUR', 0.6, 'ucl'], ['Club Brugge', 'CLB', 'BEL', 0.4, 'ucl'], ['Ajax', 'AJX', 'NED', 0.2, 'ucl'],
  ['Celtic', 'CLT', 'SCO', 0.0, 'ucl'], ['Olympiacos', 'OLY', 'GRE', 0.1, 'ucl'], ['Bodø/Glimt', 'BOD', 'NOR', -0.1, 'ucl'],
  ['Red Bull Salzburg', 'RBS', 'AUT', -0.1, 'ucl'], ['Union Saint-Gilloise', 'USG', 'BEL', -0.2, 'ucl'], ['Copenhagen', 'FCC', 'DEN', -0.3, 'ucl'],
  ['Slavia Prague', 'SLA', 'CZE', -0.4, 'ucl'], ['Red Star Belgrade', 'CZV', 'SRB', -0.5, 'ucl'], ['Qarabağ', 'QAR', 'AZE', -0.8, 'ucl'],
  ['Kairat Almaty', 'KAI', 'KAZ', -1.3, 'ucl'], ['Shakhtar Donetsk', 'SHA', 'UKR', -0.4, 'ucl'], ['Dinamo Zagreb', 'DZG', 'CRO', -0.6, 'ucl'],
  // EL level
  ['Porto', 'FCP', 'POR', 0.8, 'uel'], ['Fenerbahçe', 'FEN', 'TUR', 0.5, 'uel'], ['Feyenoord', 'FEY', 'NED', 0.4, 'uel'],
  ['Braga', 'SCB', 'POR', 0.1, 'uel'], ['Beşiktaş', 'BJK', 'TUR', -0.1, 'uel'], ['AZ Alkmaar', 'AZA', 'NED', 0.0, 'uel'],
  ['Rangers', 'RFC', 'SCO', -0.3, 'uel'], ['Midtjylland', 'MID', 'DEN', -0.3, 'uel'], ['PAOK', 'PAO', 'GRE', -0.3, 'uel'],
  ['FC Twente', 'TWE', 'NED', -0.4, 'uel'], ['Genk', 'GNK', 'BEL', -0.4, 'uel'], ['Anderlecht', 'AND', 'BEL', -0.4, 'uel'],
  ['Basel', 'BSL', 'SUI', -0.5, 'uel'], ['Utrecht', 'UTR', 'NED', -0.6, 'uel'], ['Sparta Prague', 'SPA', 'CZE', -0.6, 'uel'],
  ['Young Boys', 'YBO', 'SUI', -0.7, 'uel'], ['Viktoria Plzeň', 'PLZ', 'CZE', -0.7, 'uel'], ['Sturm Graz', 'STU', 'AUT', -0.7, 'uel'],
  ['Panathinaikos', 'PNT', 'GRE', -0.7, 'uel'], ['Ferencváros', 'FTC', 'HUN', -0.8, 'uel'], ['Ludogorets', 'LUD', 'BUL', -0.9, 'uel'],
  ['Malmö', 'MFF', 'SWE', -0.9, 'uel'], ['Lech Poznań', 'LPO', 'POL', -0.9, 'uel'], ['Maccabi Tel Aviv', 'MTA', 'ISR', -1.0, 'uel'],
  ['Go Ahead Eagles', 'GAE', 'NED', -1.0, 'uel'], ['FCSB', 'FSB', 'ROU', -1.1, 'uel'], ['Slovan Bratislava', 'SBR', 'SVK', -1.3, 'uel'],
  // Conference League level (the 2024-25 and 2025-26 league phases' sides from outside the five leagues)
  ['Legia Warsaw', 'LEG', 'POL', -0.9, 'uecl'], ['Rapid Wien', 'RAP', 'AUT', -0.9, 'uecl'], ['Djurgården', 'DIF', 'SWE', -1.0, 'uecl'], ['Jagiellonia Białystok', 'JAG', 'POL', -1.0, 'uecl'],
  ['Vitória Guimarães', 'VSC', 'POR', -0.8, 'uecl'], ['Gent', 'GNT', 'BEL', -0.8, 'uecl'], ['Cercle Brugge', 'CER', 'BEL', -1.0, 'uecl'], ['Molde', 'MOL', 'NOR', -1.0, 'uecl'],
  ['İstanbul Başakşehir', 'IBF', 'TUR', -0.9, 'uecl'], ['Samsunspor', 'SSP', 'TUR', -1.0, 'uecl'], ['Lugano', 'LUG', 'SUI', -1.1, 'uecl'], ['St. Gallen', 'STG', 'SUI', -1.2, 'uecl'],
  ['Hearts', 'HEA', 'SCO', -1.2, 'uecl'], ['Aberdeen', 'ABE', 'SCO', -1.3, 'uecl'], ['APOEL', 'APO', 'CYP', -1.2, 'uecl'], ['Omonia', 'OMO', 'CYP', -1.2, 'uecl'], ['Pafos', 'PAF', 'CYP', -1.0, 'uecl'],
  ['AEK Larnaca', 'AEL', 'CYP', -1.2, 'uecl'], ['Shamrock Rovers', 'SHR', 'IRL', -1.4, 'uecl'], ['Shelbourne', 'SHE', 'IRL', -1.6, 'uecl'], ['Celje', 'CEJ', 'SVN', -1.3, 'uecl'],
  ['Olimpija Ljubljana', 'OLJ', 'SVN', -1.3, 'uecl'], ['Rijeka', 'RIJ', 'CRO', -1.1, 'uecl'], ['Hajduk Split', 'HAJ', 'CRO', -1.1, 'uecl'], ['Partizan', 'PAR', 'SRB', -1.1, 'uecl'],
  ['CFR Cluj', 'CFR', 'ROU', -1.2, 'uecl'], ['Universitatea Craiova', 'UCV', 'ROU', -1.2, 'uecl'], ['Raków Częstochowa', 'RAK', 'POL', -1.0, 'uecl'], ['Sigma Olomouc', 'SIG', 'CZE', -1.3, 'uecl'],
  ['Mladá Boleslav', 'MLB', 'CZE', -1.3, 'uecl'], ['Dynamo Kyiv', 'DYK', 'UKR', -0.8, 'uecl'], ['HJK Helsinki', 'HJK', 'FIN', -1.5, 'uecl'], ['KuPS', 'KUP', 'FIN', -1.5, 'uecl'],
  ['Häcken', 'BKH', 'SWE', -1.2, 'uecl'], ['Víkingur Reykjavík', 'VIR', 'ISL', -1.6, 'uecl'], ['Breiðablik', 'BRK', 'ISL', -1.7, 'uecl'], ['Zrinjski Mostar', 'ZRI', 'BIH', -1.5, 'uecl'],
  ['Shkëndija', 'SHK', 'MKD', -1.7, 'uecl'], ['Drita', 'DRI', 'KOS', -1.7, 'uecl'], ['Noah', 'NOA', 'ARM', -1.4, 'uecl'], ['Astana', 'AST', 'KAZ', -1.4, 'uecl'], ['The New Saints', 'TNS', 'WAL', -1.9, 'uecl'],
  ['Lincoln Red Imps', 'LRI', 'GIB', -2.0, 'uecl'], ['Hamrun Spartans', 'HAM', 'MLT', -1.9, 'uecl'], ['Lausanne-Sport', 'LAU', 'SUI', -1.2, 'uecl'], ['Sparta Rotterdam', 'SPR', 'NED', -1.1, 'uecl'],
]
// Each country's second tier, 2026-27 (Wikipedia's 2026-27 season pages for the EFL Championship, Segunda División,
// Serie B, 2. Bundesliga and Ligue 2, read 2026-11-26; the clubs the top flights relegated in May 2026 among them:
// West Ham, Burnley, Wolves; Oviedo, Girona, Mallorca; Cremonese, Verona, Pisa; Wolfsburg, Heidenheim, St. Pauli;
// Metz, Nantes). b: a reserve side (Celta Fortuna, Real Sociedad B): it plays the division but can't go up.
// Career keeps who is in which division from season to season (lib/careerSoccer.js world): these are the first one's.
const TIER2_CLUBS = {
  ENG: [['Birmingham City', 'BIR'], ['Blackburn Rovers', 'BLB'], ['Bolton Wanderers', 'BWA'], ['Bristol City', 'BRC'], ['Burnley', 'BUR'], ['Cardiff City', 'CDF'],
    ['Charlton Athletic', 'CHN'], ['Derby County', 'DER'], ['Lincoln City', 'LIN'], ['Middlesbrough', 'MBO'], ['Millwall', 'MLW'], ['Norwich City', 'NOR'],
    ['Portsmouth', 'PMH'], ['Preston North End', 'PNE'], ['Queens Park Rangers', 'QPR'], ['Sheffield United', 'SHU'], ['Southampton', 'SOU'], ['Stoke City', 'STK'],
    ['Swansea City', 'SWA'], ['Watford', 'WAT'], ['West Bromwich Albion', 'WBA'], ['West Ham United', 'WHU'], ['Wolverhampton Wanderers', 'WOL'], ['Wrexham', 'WRX']],
  ESP: [['Albacete', 'ABC'], ['Almería', 'ALM'], ['Andorra', 'ADR'], ['Burgos', 'BGS'], ['Cádiz', 'CAD'], ['Castellón', 'CAS'], ['Celta Fortuna', 'CLF', 1],
    ['Ceuta', 'CEU'], ['Córdoba', 'COR'], ['Eibar', 'EIB'], ['Eldense', 'ELD'], ['Girona', 'GRN'], ['Granada', 'GRA'], ['Las Palmas', 'LPA'], ['Leganés', 'LGA'],
    ['Mallorca', 'MLL'], ['Real Oviedo', 'OVI'], ['Real Sociedad B', 'RSB', 1], ['Sabadell', 'SBD'], ['Sporting Gijón', 'SPG'], ['Tenerife', 'TEN'], ['Real Valladolid', 'VLL']],
  ITA: [['Arezzo', 'ARE'], ['Ascoli', 'ASL'], ['Avellino', 'AVE'], ['Benevento', 'BEN'], ['Carrarese', 'CRR'], ['Catanzaro', 'CTZ'], ['Cesena', 'CES'],
    ['Cremonese', 'CRE'], ['Empoli', 'EMP'], ['Hellas Verona', 'VER'], ['Juve Stabia', 'JST'], ['Mantova', 'MTV'], ['Modena', 'MOD'], ['Padova', 'PDV'],
    ['Palermo', 'PAL'], ['Pisa', 'PIS'], ['Sampdoria', 'SAM'], ['Südtirol', 'SUD'], ['Vicenza', 'VIC'], ['Virtus Entella', 'ENT']],
  GER: [['Hertha BSC', 'BSC'], ['Arminia Bielefeld', 'DSC'], ['VfL Bochum', 'BOC'], ['Eintracht Braunschweig', 'EBS'], ['Energie Cottbus', 'FCE'], ['Darmstadt 98', 'D98'],
    ['Dynamo Dresden', 'SGD'], ['Greuther Fürth', 'SGF'], ['Hannover 96', 'H96'], ['1. FC Heidenheim', 'HDH'], ['1. FC Kaiserslautern', 'FCK'], ['Karlsruher SC', 'KSC'],
    ['Holstein Kiel', 'KSV'], ['1. FC Magdeburg', 'FCM'], ['1. FC Nürnberg', 'NUR'], ['VfL Osnabrück', 'OSN'], ['FC St. Pauli', 'STP'], ['VfL Wolfsburg', 'WOB']],
  FRA: [['Annecy', 'ANN'], ['Boulogne', 'USB'], ['Clermont', 'CLE'], ['Dijon', 'DFC'], ['Dunkerque', 'DUN'], ['Grenoble', 'GRE'], ['Guingamp', 'EAG'], ['Laval', 'LAV'],
    ['Metz', 'MET'], ['Montpellier', 'MHS'], ['Nancy', 'ASN'], ['Nantes', 'NAN'], ['Pau', 'PAU'], ['Red Star', 'RSF'], ['Reims', 'SDR'], ['Rodez', 'ROD'],
    ['Saint-Étienne', 'STE'], ['Sochaux', 'SOC']],
}
// the cup's sides from further down (the third tier and below), beside the second tier's
const LOWER = {
  ENG: [['Huddersfield Town', 'HUD'], ['Leyton Orient', 'LEY'], ['Barnsley', 'BNS'], ['Peterborough United', 'PET'], ['Plymouth Argyle', 'PLY'], ['Luton Town', 'LUT'], ['Stockport County', 'STO'], ['Bradford City', 'BFD']],
  ESP: [['Real Zaragoza', 'ZAR'], ['Huesca', 'HUE'], ['Mirandés', 'MIR'], ['Cultural Leonesa', 'CUL'], ['Racing Ferrol', 'RFE'], ['Ponferradina', 'PON'], ['Real Murcia', 'MUR'], ['Hércules', 'HER']],
  ITA: [['Bari', 'BRI'], ['Spezia', 'SPE'], ['Salernitana', 'SAL'], ['Brescia', 'BRS'], ['Reggiana', 'REG'], ['Pescara', 'PES'], ['Triestina', 'TRI'], ['Ternana', 'TER']],
  GER: [['Hansa Rostock', 'FCH'], ['Preußen Münster', 'SCM'], ['1860 Munich', 'M60'], ['Alemannia Aachen', 'AAC'], ['Rot-Weiss Essen', 'RWE'], ['MSV Duisburg', 'MSV'], ['Waldhof Mannheim', 'SVM'], ['Erzgebirge Aue', 'AUE']],
  FRA: [['Bordeaux', 'GIR'], ['Caen', 'SMC'], ['Bastia', 'BAS'], ['Amiens', 'ASC'], ['Valenciennes', 'VAF'], ['Nîmes', 'NIM'], ['Orléans', 'ORL'], ['Quevilly-Rouen', 'QRM']],
}
// (one that's in the data, by name or code, is a top-flight club this season: left out)
const taken = new Set([...CLUBS.map(c => c.short), ...CLUBS.map(c => norm(c.name))])
const EXTRAS = EURO_EXTRA.filter(([name, short]) => !taken.has(short) && !taken.has(norm(name)))
  .map(([name, short, country, z, comp]) => ({ name, short, country, att: G_ATT + z * SD_ATT, def: G_DEF + z * SD_DEF, extra: true, comp, z }))
for (const e of EXTRAS) taken.add(e.short)
// the Champions League's clubs from outside the five leagues that EURO_EXTRA doesn't have (Viking, LASK, AEK, Sabah):
// the data's own (data/soccer-clubs.js UCL_ONLY), rated on the same Opta scale
const COUNTRY3 = { Portugal: 'POR', Netherlands: 'NED', Belgium: 'BEL', Turkey: 'TUR', Norway: 'NOR', Ukraine: 'UKR', Czechia: 'CZE', Slovakia: 'SVK', Greece: 'GRE', Austria: 'AUT', Azerbaijan: 'AZE' }
const OUTSIDE = new Map((SOCCER_ALL_CLUBS ?? []).filter(c => !CLUB_BY.has(c.short) && !taken.has(c.short)).map(c => [c.short, { short: c.short, name: c.name, att: Number(c.att) || 75, def: Number(c.def) || 75, country: COUNTRY3[(OTHER_LEAGUES ?? []).find(l => l.id === c.league)?.country] ?? 'OTH', extra: false, outside: true }]))
const EXTRA_BY = new Map([...OUTSIDE, ...EXTRAS.map(e => [e.short, e])])
const T2_INFO = new Map()   // short -> { name, key, b }
for (const [k, list] of Object.entries(TIER2_CLUBS)) for (const [name, short, b] of list) if (!CLUB_BY.has(short)) T2_INFO.set(short, { name, key: k, b: !!b })
const LOWER_INFO = new Map()
for (const [k, list] of Object.entries(LOWER)) for (const [name, short] of list) LOWER_INFO.set(short, { name, key: k })
const LOWER_CLUBS = Object.fromEntries(Object.entries(LOWER).map(([k, list]) => [k, list.map(([name, short]) => ({ name, short, country: k, extra: true, lower: true }))]))
// The second tiers (Career: his club went down and he stayed, team.tier2). Each one's real size and way up (2026-27):
//   Championship 24: the top two up, third to sixth play off (two-legged semi-finals, a single final at Wembley).
//   Segunda División 22: the top two up, third to sixth play off (two-legged semi-finals and final; level on
//     aggregate in a semi-final, the better-placed side goes through). A reserve side can't go up.
//   Serie B 20: the top two up; third to eighth play off (a one-match preliminary round, 5th v 8th and 6th v 7th at
//     the better-placed side, then two-legged semi-finals and final; third goes straight up ten points clear of fourth).
//   2. Bundesliga 18: the top two up, third plays the Bundesliga's 16th over two legs.
//   Ligue 2 18: the top two up; third to fifth play off (4th v 5th, the winner at 3rd), the winner plays Ligue 1's
//     16th over two legs.
// Its clubs rate below the top flight's weakest, a spread of about seven points; a club relegated from the data plays
// at its own rating (the parachute money: the strongest sides down there).
const TIER2 = {
  ENG: { id: 'eng.2', name: 'Championship', short: 'CHA', size: 24, up: 2, playoffTo: 6 },
  ESP: { id: 'esp.2', name: 'Segunda División', short: 'SEG', size: 22, up: 2, playoffTo: 6 },
  ITA: { id: 'ita.2', name: 'Serie B', short: 'SB', size: 20, up: 2, playoffTo: 8 },
  GER: { id: 'ger.2', name: '2. Bundesliga', short: '2BL', size: 18, up: 2, playoffTo: 3 },
  FRA: { id: 'fra.2', name: 'Ligue 2', short: 'L2', size: 18, up: 2, playoffTo: 5 },
}
const hash01 = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) } return ((h >>> 0) % 10000) / 10000 }
// a club outside the data at home: its name and rating. In the second tier: three to nine points below the top
// flight's three weakest. Promoted into the top flight: about as good as they are, up to two points worse (Career keeps it there while its results do).
function synthClub(short, key, top = false) {
  const L = LEAGUES.find(l => l.key === key) ?? LEAGUES[0], lb = LEAGUE_BASE.get(L.id)
  const info = T2_INFO.get(short) ?? LOWER_INFO.get(short)
  const ha = hash01(`${short}a`), hd = hash01(`${short}d`)
  return { short, name: info?.name ?? short, country: key, lid: top ? L.id : null, extra: true, lower: !top, b: !!info?.b,
    att: top ? lb.lowA - ha * 2 : lb.lowA - 3 - ha * 6, def: top ? lb.lowD - hd * 2 : lb.lowD - 3 - hd * 6 }
}
// Europe in 2026-27, the five leagues' clubs in it (uefa.com; Wikipedia's 2026-27 Europa League and Conference League
// pages, read 2026-11-26): the Champions League's 36 (data/soccer-clubs.js UCL_SHORTS, England and Spain with a
// European Performance Spot each: Liverpool and Real Betis, fifth); the Europa League's (Crystal Palace as the
// Conference League's holders); the Conference League's play-off round (Brighton, Atalanta, Getafe, Freiburg, Monaco)
const EUROPE_2026 = Object.fromEntries([
  ...(UCL_SHORTS ?? []).map(s => [s, 'ucl']),
  ...['CRY', 'BOU', 'SUN', 'MIL', 'JUV', 'RSO', 'CEL', 'TSG', 'B04', 'OLM', 'REN', 'LYO'].map(s => [s, 'uel']),
  ...['BHA', 'ATA', 'GET', 'SCF', 'MON'].map(s => [s, 'uecl']),
])
// the world Career starts in (its first season, 2026-27): the data's top flights, the second tiers above, the
// European places as UEFA's 2026-27 competitions have them (EUROPE_2026)
export function soccerFirstWorld() {
  return {
    divs: Object.fromEntries(LEAGUES.map(l => [l.id, clubsOf(l.id).map(c => c.short)])),
    t2: Object.fromEntries(LEAGUES.map(l => [l.id, (TIER2_CLUBS[l.key] ?? []).map(x => x[1])])),
    euro: { ...EUROPE_2026 }, cups: {}, first: true,
  }
}
// the second tier around his club: its other clubs (rated), and the side that takes his club's place in the top flight
// (world: Career's divisions this season, the second tier exactly as it is; else 2026-27's, the strongest of it up)
function tier2Of(L, U, world = null) {
  const meta = TIER2[L.key], lb = LEAGUE_BASE.get(L.id)
  if (world?.t2?.[L.id]) {
    const list = world.t2[L.id].map(s => CLUB_BY.get(s) ?? synthClub(s, L.key))
    if (list.some(c => c.short === U)) { const clubs = list.filter(c => c.short !== U); return { meta, clubs, sub: null, rates: new Map(clubs.map(c => [c.short, c])) } }
    // (his club down, the world still has it up: an old save, or a move a division down. The second tier's
    // strongest takes its place up there)
    const sub = list.filter(c => !c.b).sort((a, b) => (b.att + b.def) - (a.att + a.def))[0]
    const clubs = list.filter(c => c !== sub)
    return { meta, clubs, sub: { ...sub, lid: L.id }, rates: new Map(list.map(c => [c.short, c])) }
  }
  const all = (TIER2_CLUBS[L.key] ?? []).filter(([, s]) => !CLUB_BY.has(s)).map(([, s]) => synthClub(s, L.key))
  const sub = all.slice().sort((a, b) => (b.att + b.def) - (a.att + a.def))[0]
  const clubs = all.filter(c => c !== sub).slice(0, meta.size - 1)
  return { meta, clubs, sub: { ...sub, att: lb.minA - 1, def: lb.minD - 1 }, rates: new Map([...clubs, sub].map(c => [c.short, c])) }
}

// The real stars who aren't strikers (wingers, No. 10s, midfielders): they win Player of the Season and Ballon
// d'Or votes too. `lvl`: a typical season of theirs as a striker would be scored (goals + 0.6 assists).
// A star whose club isn't in the data, or who's in the striker data already, is left out.
const CLUB_STARS = [
  ['Mohamed Salah', ['Liverpool'], 'EGY', 26, 34], ['Bukayo Saka', ['Arsenal'], 'ENG', 21, 25], ['Cole Palmer', ['Chelsea'], 'ENG', 22, 24],
  ['Declan Rice', ['Arsenal'], 'ENG', 17, 27], ['Bruno Fernandes', ['Manchester United'], 'POR', 19, 32], ['Florian Wirtz', ['Liverpool'], 'GER', 19, 23],
  ['Phil Foden', ['Manchester City'], 'ENG', 18, 26], ['Morgan Rogers', ['Aston Villa'], 'ENG', 16, 24],
  ['Lamine Yamal', ['Barcelona'], 'ESP', 29, 19], ['Raphinha', ['Barcelona'], 'BRA', 25, 29], ['Vinícius Júnior', ['Real Madrid'], 'BRA', 23, 26],
  ['Jude Bellingham', ['Real Madrid'], 'ENG', 21, 23], ['Pedri', ['Barcelona'], 'ESP', 19, 23], ['Nico Williams', ['Athletic'], 'ESP', 16, 24], ['Arda Güler', ['Real Madrid'], 'TUR', 17, 21],
  ['Nicolò Barella', ['Inter'], 'ITA', 15, 29], ['Scott McTominay', ['Napoli'], 'SCO', 18, 29], ['Kenan Yıldız', ['Juventus'], 'TUR', 18, 21],
  ['Christian Pulisic', ['Milan'], 'USA', 18, 28], ['Kevin De Bruyne', ['Napoli'], 'BEL', 16, 35], ['Nico Paz', ['Como'], 'ARG', 17, 22],
  ['Michael Olise', ['Bayern'], 'FRA', 25, 25], ['Luis Díaz', ['Bayern'], 'COL', 22, 29], ['Jamal Musiala', ['Bayern'], 'GER', 20, 23], ['Joshua Kimmich', ['Bayern'], 'GER', 16, 31],
  ['Ousmane Dembélé', ['Paris'], 'FRA', 26, 29], ['Khvicha Kvaratskhelia', ['Paris'], 'GEO', 21, 25], ['Vitinha', ['Paris'], 'POR', 19, 26],
  ['Désiré Doué', ['Paris'], 'FRA', 18, 21], ['Achraf Hakimi', ['Paris'], 'MAR', 16, 28], ['Mason Greenwood', ['Marseille'], 'ENG', 20, 25],
  // the defenders, keepers and holding midfielders who take a Ballon d'Or vote (a value in the same units)
  ['Virgil van Dijk', ['Liverpool'], 'NED', 15, 35], ['William Saliba', ['Arsenal'], 'FRA', 13, 25], ['Rodri', ['Manchester City'], 'ESP', 16, 30],
  ['Gianluigi Donnarumma', ['Manchester City'], 'ITA', 13, 27], ['Thibaut Courtois', ['Real Madrid'], 'BEL', 13, 34], ['Federico Valverde', ['Real Madrid'], 'URU', 15, 28],
  ['Frenkie de Jong', ['Barcelona'], 'NED', 14, 29], ['Alessandro Bastoni', ['Inter'], 'ITA', 12, 27], ['Hakan Çalhanoğlu', ['Inter'], 'TUR', 13, 32],
  ['Nuno Mendes', ['Paris'], 'POR', 14, 24], ['Marquinhos', ['Paris'], 'BRA', 11, 32], ['Jonathan Tah', ['Bayern'], 'GER', 11, 30],
]
const NATION_STARS = [
  ['Lionel Messi', 'ARG', 14, 39], ['Lamine Yamal', 'ESP', 14, 18], ['Pedri', 'ESP', 10, 23], ['Rodri', 'ESP', 9, 30], ['Vinícius Júnior', 'BRA', 12, 25],
  ['Raphinha', 'BRA', 11, 29], ['Jude Bellingham', 'ENG', 12, 23], ['Bukayo Saka', 'ENG', 10, 24], ['Declan Rice', 'ENG', 8, 27], ['Jamal Musiala', 'GER', 11, 23],
  ['Florian Wirtz', 'GER', 11, 23], ['Kevin De Bruyne', 'BEL', 10, 35], ['Luka Modrić', 'CRO', 10, 40], ['Bruno Fernandes', 'POR', 10, 31], ['Vitinha', 'POR', 9, 26],
  ['Mohamed Salah', 'EGY', 11, 34], ['Achraf Hakimi', 'MAR', 9, 27], ['Federico Valverde', 'URU', 9, 28], ['Christian Pulisic', 'USA', 9, 27], ['Ousmane Dembélé', 'FRA', 12, 29],
  ['Michael Olise', 'FRA', 10, 24], ['Martin Ødegaard', 'NOR', 9, 27], ['Frenkie de Jong', 'NED', 8, 29], ['Luis Díaz', 'COL', 10, 29], ['Son Heung-min', 'KOR', 9, 33],
  ['Kaoru Mitoma', 'JPN', 8, 29], ['Khvicha Kvaratskhelia', 'GEO', 10, 25], ['Kenan Yıldız', 'TUR', 9, 21], ['Arda Güler', 'TUR', 9, 21],
  // the young ones (born 2005 or later: Best Young Player)
  ['Pau Cubarsí', 'ESP', 6, 19], ['Estêvão', 'BRA', 8, 19], ['Endrick', 'BRA', 6, 19], ['Désiré Doué', 'FRA', 8, 21], ['Warren Zaïre-Emery', 'FRA', 6, 20],
  ['Franco Mastantuono', 'ARG', 6, 18], ['Kobbie Mainoo', 'ENG', 6, 21], ['Lennart Karl', 'GER', 6, 18], ['Jorrel Hato', 'NED', 5, 20], ['Rodrigo Mora', 'POR', 6, 19],
]
const strikerNames = new Set([...(SOCCER_STRIKERS ?? []), ...(WC2026_STRIKERS ?? []), ...(WC_STRIKERS ?? [])].map(p => norm(p.name)))
function clubByKeys(keys) {
  for (const k of keys) {
    const nk = norm(k)
    const hits = CLUBS.filter(c => norm(c.name).includes(nk) || norm(c.short) === nk)
    if (hits.length) return hits.sort((a, b) => a.name.length - b.name.length)[0]
  }
  return null
}
const STARS_CLUB = CLUB_STARS.map(([name, keys, nation, lvl, age]) => ({ name, club: clubByKeys(keys), nation, lvl, age }))
  .filter(s => s.club && !strikerNames.has(norm(s.name))).map(s => ({ ...s, team: s.club.short, lid: s.club.lid }))
// the all-time World Cup's: the greatest defenders and keepers (the legends pool is attackers only), at their peak
// ages, so the Golden Ball has its Beckenbauer and its Cannavaro (level as above: about a goal's worth a point)
const LEGEND_STARS = [
  ['Franz Beckenbauer', 'GER', 12, 29], ['Paolo Maldini', 'ITA', 10, 26], ['Fabio Cannavaro', 'ITA', 11, 32], ['Gianluigi Buffon', 'ITA', 10, 28],
  ['Manuel Neuer', 'GER', 10, 28], ['Philipp Lahm', 'GER', 8, 30], ['Cafu', 'BRA', 9, 32], ['Roberto Carlos', 'BRA', 9, 29],
  ['Lilian Thuram', 'FRA', 9, 26], ['Iker Casillas', 'ESP', 9, 29], ['Sergio Ramos', 'ESP', 9, 28], ['Carles Puyol', 'ESP', 8, 32],
  ['Bobby Moore', 'ENG', 10, 25], ['Virgil van Dijk', 'NED', 9, 28], ['Javier Mascherano', 'ARG', 8, 30], ['Emiliano Martínez', 'ARG', 8, 30],
  ['Diego Godín', 'URU', 8, 28], ['Achraf Hakimi', 'MAR', 8, 24],
]
// ─── The World Cup's two fields ──────────────────────────────────────────────
function wcField(key, nationList, strikerList, hosts, starList) {
  const nations = (nationList ?? []).map(n => ({ ...n, att: Number(n.att) || 70, def: Number(n.def) || 70 }))
  const by = new Map(nations.map(n => [n.short, n]))
  const mA = avg(nations.map(n => n.att)), mD = avg(nations.map(n => n.def))
  const sdA = Math.max(2, Math.sqrt(avg(nations.map(n => (n.att - mA) ** 2)))) || 6
  const sdD = Math.max(2, Math.sqrt(avg(nations.map(n => (n.def - mD) ** 2)))) || 6
  const kA = 0.24 / sdA, kD = 0.22 / sdD
  let s = 0, n = 0
  for (const a of nations) for (const b of nations) if (a !== b && a.group && a.group === b.group) { s += Math.exp(term(kA, a.att - mA, sdA) - term(kD, b.def - mD, sdD)); n++ }
  const stars = starList.filter(([name, nation]) => by.has(nation) && !strikerNames.has(norm(name))).map(([name, nation, lvl, age]) => ({ name, team: nation, lvl, age }))
  return { key, NATIONS: nations, NATION_BY: by, HOSTS: new Set(hosts), NATION_STRIKERS: byTeam(strikerList), STARS_WC: stars,
    W_SD_ATT: sdA, W_SD_DEF: sdD, W_ATT: mA, W_DEF: mD, KW_ATT: kA, KW_DEF: kD, WC_BASE: n ? 1.33 / (s / n) : 1.3 }
}
const FIELDS = {
  legends: wcField('legends', WC_NATIONS, WC_STRIKERS, [], LEGEND_STARS),
  wc2026: wcField('wc2026', WC2026_NATIONS, WC2026_STRIKERS, ['USA', 'MEX', 'CAN'], NATION_STARS),
}
// A field for one tournament of Career's (lib/soccerIntl.js): a World Cup years on (the squads aged, the retired gone,
// new players through, the nations that qualified) or a continental championship. nations: [{ short, name, att, def,
// group }] with the draw made; players: their attackers (the striker rows' shape); hosts: home advantage;
// opts.yrs: years since 2026 (the real stars who aren't strikers age with it, and go at 35); opts.groups: a
// continental format (6: 24 nations, a round of 16; 4: 16 nations, quarter-finals), none: the World Cup's 48;
// opts.label: the result's `season`.
export function soccerNationField(key, nations, players, hosts = [], opts = {}) {
  const yrs = Math.max(0, opts.yrs ?? 0)
  const stars = NATION_STARS.map(([name, nation, lvl, age]) => [name, nation, lvl + Math.min(yrs, Math.max(0, 25 - age)) * 0.7 - Math.max(0, age + yrs - 30) * 1.1, age + yrs]).filter(x => x[3] < 35 && x[2] >= 4)
  const f = wcField(key, nations, players, hosts, stars)
  return { ...f, format: opts.groups ? { groups: opts.groups } : null, label: opts.label ?? key }
}
let FIELD = null
function useField(f) {
  FIELD = f
  ;({ NATIONS, NATION_BY, HOSTS, NATION_STRIKERS, STARS_WC, W_SD_ATT, W_SD_DEF, W_ATT, W_DEF, KW_ATT, KW_DEF, WC_BASE } = f)
  WC_KEY = f.key
}
useField(FIELDS.legends)
function withField(f, fn) {
  if (f === FIELD) return fn()
  const prev = FIELD
  useField(f)
  try { return fn() } finally { useField(prev) }
}
// which field a call plays: a script's own; Career's (team.wc 2026); a nation only the 2026 World Cup has (an old save
// or result from before the legends) plays that one; everyone else the legends
function fieldFor(team, script) {
  if (team?.field?.NATION_BY) return team.field   // (Career: a field of its own, soccerNationField)
  if (script?.wcField && FIELDS[script.wcField]) return FIELDS[script.wcField]
  if (team?.wc === 2026 || team?.wc === '2026') return FIELDS.wc2026
  const s = team?.short ?? team?.nation
  if (s && !FIELDS.legends.NATION_BY.has(s) && FIELDS.wc2026.NATION_BY.has(s)) return FIELDS.wc2026
  return FIELDS.legends
}

// ─── The goal model ──────────────────────────────────────────────────────────
// Dixon-Coles: independent Poissons with the four low scores (0-0, 1-0, 0-1, 1-1) reweighted
function dcScore(lh, la, rand) {
  const t00 = 1 - lh * la * RHO, t11 = 1 - RHO, tmax = Math.max(t00, t11, 1)
  for (let i = 0; i < 12; i++) {
    const h = poisson(lh, rand), a = poisson(la, rand)
    if (h > GOALS_MAX || a > GOALS_MAX) continue
    const tau = h > 1 || a > 1 ? 1 : h === 0 && a === 0 ? t00 : h === 0 ? 1 + lh * RHO : a === 0 ? 1 + la * RHO : t11
    if (rand() * tmax <= tau) return [h, a]
  }
  return [Math.min(GOALS_MAX, poisson(lh, rand)), Math.min(GOALS_MAX, poisson(la, rand))]
}
// A shootout: five each, then sudden death. kickH / kickA: the striker's own chance if he takes one (first kick)
function shootout(rand, kickH, kickA, base = 0.75) {
  const kh = [], ka = []
  let h = 0, a = 0
  const p = (mine, i) => (mine != null && mine !== false && i === 0 ? mine : base)
  for (let i = 0; i < 5; i++) {
    const sh = rand() < p(kickH, i); kh.push(sh); if (sh) h++
    if (h > a + (5 - i) || a > h + (4 - i)) break
    const sa = rand() < p(kickA, i); ka.push(sa); if (sa) a++
    if (h > a + (4 - i) || a > h + (4 - i)) break
  }
  for (let i = 5; h === a && i < 40; i++) {
    const sh = rand() < base, sa = rand() < base
    kh.push(sh); ka.push(sa); if (sh) h++; if (sa) a++
  }
  if (h === a) { if (rand() < 0.5) h++; else a++ }
  return { h, a, kh, ka }
}

// A world: one competition's rates, and the user's side
function makeWorld({ rand, hook, U, rate, base, mA, mD, kA, kD, H, hostAdv = null, out, wc = false }) {
  const sA = wc ? W_SD_ATT : SD_ATT, sD = wc ? W_SD_DEF : SD_DEF
  const A = new Map(), Dm = new Map()
  const atk = x => { let v = A.get(x); if (v === undefined) { v = term(kA, rate(x).att - mA, sA); A.set(x, v) } return v }
  const dfn = y => { let v = Dm.get(y); if (v === undefined) { v = term(kD, rate(y).def - mD, sD); Dm.set(y, v) } return v }
  const lam = (x, y, h) => Math.min(LAM_MAX, base * Math.exp(atk(x) - dfn(y) + h + (hostAdv ? hostAdv(x, y) : 0)))
  return { rand, hook, U, rate, lam, H, out }
}
// One match. ko: a knockout (extra time and penalties); agg: the first leg's goals [this home side, this away side]
// (a league match he isn't in: just the score)
function quickScore(W, hS, aS) { const h = W.H; return dcScore(W.lam(hS, aS, h), W.lam(aS, hS, -h), W.rand) }
function playFx(W, { comp, wk, home: hS, away: aS, neutral = false, ko = false, agg = null, meta = {} }) {
  const h = neutral ? 0 : W.H
  let lh = W.lam(hS, aS, h), la = W.lam(aS, hS, -h)
  const uH = hS === W.U, uA = aS === W.U
  let fx = null, lamC = 0
  if (uH || uA) {
    lamC = uH ? lh : la
    fx = W.hook({ comp, wk, kind: meta.kind ?? comp, lamC })
    if (uH) lh = Math.min(LAM_MAX_U, lamC * fx.mult); else la = Math.min(LAM_MAX_U, lamC * fx.mult)
  }
  let [hs, as] = dcScore(lh, la, W.rand)
  let et = false, pens = null
  const level = () => (agg ? hs + agg[0] === as + agg[1] : hs === as)
  if (ko && level()) {
    et = true
    let lhE = (uH ? lamC * fx.etMult : lh) * ET_F, laE = (uA ? lamC * fx.etMult : la) * ET_F
    hs += poisson(lhE, W.rand); as += poisson(laE, W.rand)
    if (level()) pens = shootout(W.rand, uH ? fx.kick : null, uA ? fx.kick : null, comp === 'wc' ? 0.72 : 0.76)
  }
  const totH = hs + (agg ? agg[0] : 0), totA = as + (agg ? agg[1] : 0)
  const winH = pens ? pens.h > pens.a : totH > totA, winA = pens ? pens.a > pens.h : totA > totH
  if (fx) {
    W.out.push({
      plan: fx.plan, mult: fx.mult, etMult: fx.etMult, comp, wk, home: uH, neutral, opp: uH ? aS : hS, lamC,
      mySc: uH ? hs : as, oppSc: uH ? as : hs, et,
      pens: pens ? { my: uH ? pens.h : pens.a, opp: uH ? pens.a : pens.h, kicks: uH ? pens.kh : pens.ka } : null,
      through: ko ? (uH ? winH : winA) : null, ...meta,
    })
  }
  return { hs, as, et, pens, winH, winA }
}
// A two-legged tie: A hosts the first leg, B (the better seed) the second
function playTie(W, A, B, { comp, wks, name, ri }) {
  const l1 = playFx(W, { comp, wk: wks[0], home: A, away: B, meta: { round: name, leg: 1, ri } })
  const l2 = playFx(W, { comp, wk: wks[1], home: B, away: A, ko: true, agg: [l1.as, l1.hs], meta: { round: name, leg: 2, ri } })
  return { winner: l2.winH ? B : A, loser: l2.winH ? A : B, agg: [l1.hs + l2.as, l1.as + l2.hs] }
}
function playSingle(W, A, B, { comp, wk, name, ri, neutral = false }) {
  const m = playFx(W, { comp, wk, home: A, away: B, neutral, ko: true, meta: { round: name, ri } })
  return { winner: m.winH ? A : B, loser: m.winH ? B : A, m }
}

// ─── His minutes ─────────────────────────────────────────────────────────────
// Injuries: a spell out in about two seasons of five (size is his durability), 1-9 weeks; small knocks
// keep him out of ~4% of matches; the manager rests him in early cup rounds. A first-choice No. 9 starts
// ~93% of the matches he's fit for and plays 90 in about half of them (more if he's big and elite).
function spellsOf(rand, prof) {
  const p1 = clamp(0.42 - 0.025 * ((prof.size ?? 6) - 6), 0.18, 0.6)
  const u = [rand(), rand(), rand(), rand(), rand(), rand()]
  const out = []
  if (u[0] < p1) { const from = 1 + u[1] * 36; out.push([from, from + 1 + Math.floor(u[2] * u[2] * 9)]) }
  if (u[3] < p1 * 0.3) { const from = 1 + u[4] * 36; out.push([from, from + 1 + Math.floor(u[5] * u[5] * 6)]) }
  return out
}
// A World Cup is eight matches in five weeks, not a club season: his chance of an injury spell is a tournament's
// (about one in seventeen, a match or two), the knocks rarer (a nation's star plays through them). Before 2026-11-24 the
// club season's spells (weeks 1-37) fell on the tournament's weeks 1-8: a star sat out a knockout match in about one
// World Cup in five, the final included, and nothing said why.
function wcSpellsOf(rand, prof) {
  const p = clamp(0.06 - 0.004 * ((prof.size ?? 6) - 6), 0.03, 0.09)
  const u = [rand(), rand(), rand()]
  if (u[0] >= p) return []
  const from = 1 + u[1] * 7
  return [[from, from + 1 + Math.floor(u[2] * u[2] * 2)]]
}
// his availability for one match; why he didn't play, when he didn't: 'inj' (a spell out), 'knock', 'bench' (unused)
function planOf(rand, S, wk, kind) {
  const u1 = rand(), u2 = rand(), u3 = rand(), u4 = rand()
  const wc = kind === 'wc'
  const hurt = (wc ? S.wcSpells ?? [] : S.spells).some(([a, b]) => wk >= a && wk < b)
  if (hurt || u1 < (wc ? 0.015 : 0.04)) return { avail: false, start: false, mins: 0, onEnd: false, why: hurt ? 'inj' : 'knock' }
  const pStart = clamp(S.startP * (kind === 'cupEarly' ? 0.55 : kind === 'uecl' ? 0.88 : kind === 'ucl' || kind === 'uel' || kind === 'wc' ? 1.04 : 1), 0, 0.99)
  if (u2 < pStart) {
    const full = u3 < S.p90 * (kind === 'wc' ? 1.2 : 1)
    return { avail: true, start: true, mins: full ? 90 : 60 + Math.floor(Math.pow(u4, 0.8) * 30), onEnd: full }
  }
  if (u3 < S.subP) return { avail: true, start: false, mins: 5 + Math.floor(u4 * 28), onEnd: true }
  return { avail: true, start: false, mins: 0, onEnd: false, why: 'bench' }
}

// ─── The striker in his side: the lift, his share, his streams ───────────────
// M: how much more (or less) the team scores with him on than with the real No. 9 he replaced. 20% of the
// chances he takes beyond the other man's would have been a teammate's; when he's the weaker one, half of
// the chances he doesn't get go to the others instead. A No. 9 who gets more of the ball pulls defenders
// with him (a little more for the others), his passing makes chances for them (about 1% more of their goals a
// grade), and a No. 9 who holds the ball up (size and touch) brings them into the game.
function liftOf(b, r, lam, usage) {
  const sb = shareAt(b, lam, usage), sr = shareAt(r, lam)
  const lk = 1 + 0.010 * ((b.link ?? 6) - (r.link ?? 6)) + 0.003 * ((b.hold ?? 6) - (r.hold ?? 6)) + 0.1 * Math.max(0, sb - sr)
  const den = (1 - sr) + sr * r.F
  const absorb = sb >= sr ? 0.2 : 0.5
  return { M: clamp(((1 - sr - absorb * (sb - sr)) * lk + sb * b.F) / den, 0.7, 1.45), den, sb }
}
function strikerSide({ build, prof, team, mates, lamAvg, base, script }) {
  const usage = (team.career || team.squad || script) && team.usage ? clamp(team.usage, 0.2, 1.2) : 1
  const replaced = mates[0] ?? null
  // (who plays up front when he's off: the side's next striker, or a forward who can)
  const backup = mates.slice(1).find(p => p.role === 'ST' || p.role === 'SS') ?? mates.slice(1).find(isForward) ?? null
  const real = replaced?.prof ?? { share: 0.2, F: 1, link: 6, hold: 6 }
  const L = liftOf(prof, real, lamAvg, usage)
  const bk = backup?.prof ?? GENERIC_BACKUP
  const LB = liftOf({ ...GENERIC_BACKUP, ...bk }, real, lamAvg, 1)
  const ovr = calcSoccerOVR(build)
  // a script's scores already hold the squad: no lift, and his share is of a side he's part of
  const den = script ? (1 - L.sb) + L.sb * prof.F : L.den
  const benchRole = !!team.bench
  const weaker = backup && backup.ovr > ovr + 2
  const fr = stream(base, 'form')
  return {
    prof, ovr, sb: L.sb, Fb: prof.F, den,
    M: script ? 1 : L.M, Mbk: script ? 1 : LB.M,
    // (Career: a teenager's starts and full matches are rationed, team.startK / team.fullK)
    startP: (benchRole ? 0.16 : weaker ? 0.55 : 0.93) * (team.career ? team.startK ?? 1 : 1),
    subP: benchRole ? 0.78 : 0.7,
    p90: clamp(0.40 + 0.03 * ((prof.size ?? 6) - 6) + (ovr - 85) * 0.01, 0.2, 0.72) * (team.career ? team.fullK ?? 1 : 1),
    spells: spellsOf(stream(base, 'injury'), prof),
    wcSpells: wcSpellsOf(stream(base, 'injury:wc'), prof),
    // a hot or a cold year
    formF: Math.exp(0.03 * gauss(fr)), formV: Math.exp(0.03 * gauss(fr)),
    replaced, backup,
  }
}
function hookFor(S, base) {
  const streams = {}
  const st = comp => (streams[comp] ??= stream(base, `plan:${comp}`))
  return ({ comp, wk, kind }) => {
    const plan = planOf(st(comp), S, wk, kind)
    const f = plan.mins / 90
    return { plan, mult: f * S.M + (1 - f) * S.Mbk, etMult: plan.onEnd ? S.M : S.Mbk, kick: plan.onEnd ? clamp(S.prof.penConv - 0.03, 0.5, 0.92) : null }
  }
}
const nullHook = () => ({ plan: null, mult: 1, etMult: 1, kick: null })

// ─── His line in one match, drawn from the score ─────────────────────────────
function drawShot(rand, prof) {
  const u = rand(), w = rand()
  if (u < prof.big) return { x: 0.2 + 0.6 * Math.pow(w, 1.6), kind: 'big' }
  if (u < prof.big + (1 - prof.big) * prof.long) return { x: 0.015 + 0.04 * w, kind: 'long' }
  return { x: 0.03 + 0.12 * Math.pow(w, 1.5), kind: 'box' }
}
// A shot that went in, or one that didn't: drawn from his shots weighted by how likely each was to go in
// (or not), so the xG of his goals and his misses add up to his chance volume, the same as if every shot
// had been taken and the goals had fallen out of them.
const goalP = (s, F) => Math.min(0.95, s.x * F)
function drawShotGiven(rand, prof, F, scored) {
  for (let i = 0; i < 40; i++) {
    const s = drawShot(rand, prof)
    if (rand() < (scored ? goalP(s, F) / 0.95 : 1 - goalP(s, F))) return s
  }
  return scored ? { x: 0.2 + 0.6 * Math.pow(rand(), 1.6), kind: 'big' } : { x: 0.03 + 0.12 * Math.pow(rand(), 1.5), kind: 'box' }
}
// a match's own result: the score, or the shootout when it's level (a second leg can be lost and the tie won)
const outcomeOf = fx => {
  const won = fx.mySc > fx.oppSc || (fx.mySc === fx.oppSc && !!fx.pens && fx.pens.my > fx.pens.opp)
  const drawn = fx.mySc === fx.oppSc && !fx.pens
  return { won, drawn }
}
function lineFor(rand, S, fx) {
  const plan = fx.plan
  const etOn = fx.et && plan.onEnd
  const mins = plan.mins + (etOn ? 30 : 0)
  const { won, drawn } = outcomeOf(fx)
  const line = {
    app: mins > 0 ? 1 : 0, gs: plan.start ? 1 : 0, start: plan.start, mins,
    goals: 0, assists: 0, shots: 0, sot: 0, xg: 0, npxg: 0, bcm: 0, pens: 0, pensTaken: 0, headers: 0, outside: 0, rating: null, motm: false,
  }
  if (!mins) { if (plan.why) line.why = plan.why; return line }
  const unit = plan.mins / 90 + (etOn ? ET_F : 0)                      // his time on, in matches
  const X = fx.lamC / S.den                                            // the team's chances (xG) a match
  const lamT = fx.lamC * fx.mult + (fx.et ? fx.lamC * ET_F * fx.etMult : 0)
  const V = X * S.sb * S.formV * unit                                  // his non-penalty xG
  const E = V * S.Fb * S.formF                                         // his expected non-penalty goals
  const G = fx.mySc
  // every goal his side scored was his penalty, his goal from open play, or a teammate's, at his expected
  // share of each; a penalty he missed doesn't touch the score
  const penTaken = unit * penRateAt(fx.lamC * fx.mult) * S.prof.taker
  const pPen = clamp((penTaken * S.prof.penConv) / Math.max(0.05, lamT), 0, 0.4)
  const p = clamp(E / Math.max(0.05, lamT), 0, 0.92 - pPen)
  let pens = 0, npg = 0
  for (let i = 0; i < G; i++) { const u = rand(); if (u < pPen) pens++; else if (u < pPen + p) npg++ }
  const pensTaken = pens + (rand() < penTaken * (1 - S.prof.penConv) ? 1 : 0)
  // his shots: a shot for every goal, and the misses his chance volume leaves (V / q shots, F*q of them in)
  const F = S.Fb * S.formF
  const shots = []
  for (let i = 0; i < npg; i++) shots.push({ ...drawShotGiven(rand, S.prof, F, true), goal: true })
  const misses = poisson(Math.max(0, (V / S.prof.q) * (1 - Math.min(0.9, F * S.prof.q))), rand)
  for (let i = 0; i < misses; i++) shots.push(drawShotGiven(rand, S.prof, F, false))
  let sot = 0, bigMissed = 0, headers = 0, outside = 0, xg = 0
  for (const s of shots) {
    xg += s.x
    if (s.goal) {
      sot++
      if (s.kind === 'long') outside++
      else if (rand() < S.prof.head) headers++
    } else {
      if (rand() < S.prof.onTarget + (s.kind === 'big' ? 0.12 : s.kind === 'long' ? -0.08 : 0)) sot++
      if (s.kind === 'big') bigMissed++
    }
  }
  const goals = npg + pens
  // his assists: his teammates' goals while he was on, a share of them
  const others = Math.max(0, G - goals)
  const onFrac = clamp(mins / (fx.et ? 120 : 90), 0, 1)
  const assists = binom(binom(others, onFrac, rand), S.prof.assist, rand)
  // a match rating, the way the rating apps score a striker (goals first; 6.5-7.0 an ordinary day)
  let rt = 6.3 + 0.2 * Math.min(1, mins / 90)
  rt += [0, 1.05, 1.9, 2.6, 3.1, 3.5][Math.min(5, goals)]
  rt += 0.55 * assists + 0.08 * (sot - npg) + 0.03 * (shots.length - sot) - 0.22 * bigMissed - 0.45 * (pensTaken - pens)
  rt += won ? 0.25 : drawn ? 0 : -0.25
  rt += 0.22 * gauss(rand)
  if (mins < 25) rt = 6.4 + (rt - 6.4) * 0.6
  const rating = r1(clamp(rt, 4.5, 10))
  return {
    ...line, goals, assists, shots: shots.length, sot, xg: r2(xg + 0.76 * pensTaken), npxg: r2(xg),
    bcm: bigMissed + (pensTaken - pens), pens, pensTaken, headers, outside, rating, motm: rating >= 8.3 || goals >= 3,
  }
}
const ZERO = { app: 0, gs: 0, start: false, mins: 0, goals: 0, assists: 0, shots: 0, sot: 0, xg: 0, npxg: 0, bcm: 0, pens: 0, pensTaken: 0, headers: 0, outside: 0, rating: null, motm: false }
function matchOf(fx, line, nameOf, g) {
  const through = fx.through
  const { won, drawn } = outcomeOf(fx)
  const sh =fx.pens ? { my: fx.pens.my, opp: fx.pens.opp, won: fx.pens.my > fx.pens.opp, kick: line.mins && fx.plan?.onEnd ? (fx.pens.kicks?.[0] ? 'scored' : 'missed') : null } : null
  return {
    g, wk: r1(fx.wk), comp: fx.comp, round: fx.round ?? null, leg: fx.leg ?? null, home: !!fx.home, neutral: !!fx.neutral,
    opponent: fx.opp, oppName: nameOf(fx.opp), oppExtra: !CLUB_BY.has(fx.opp) && !NATION_BY.has(fx.opp), mySc: fx.mySc, oppSc: fx.oppSc,
    won, drawn, lost: !won && !drawn, result: won ? 'W' : drawn ? 'D' : 'L', through: through ?? null, et: !!fx.et, shootout: sh,
    ...line,
  }
}
function totalsOf(games) {
  const sum = k => games.reduce((s, g) => s + (g[k] ?? 0), 0)
  const played = games.filter(g => g.mins > 0)
  const goals = sum('goals'), pens = sum('pens'), shots = sum('shots'), mins = sum('mins'), npxg = sum('npxg'), xg = sum('xg')
  return {
    apps: sum('app'), starts: sum('gs'), mins, goals, assists: sum('assists'), shots, sot: sum('sot'), xg: r1(xg), npxg: r1(npxg),
    bcm: sum('bcm'), pens, pensTaken: sum('pensTaken'), headers: sum('headers'), outside: sum('outside'),
    hatTricks: games.filter(g => g.goals >= 3).length, braces: games.filter(g => g.goals === 2).length, motm: games.filter(g => g.motm).length,
    avgRating: played.length ? r2(avg(played.map(g => g.rating))) : null,
    conversion: shots ? r1(((goals - pens) / shots) * 100) : 0, sotPct: shots ? r1((sum('sot') / shots) * 100) : 0,
    goalsPer90: mins ? r2((goals / mins) * 90) : 0, xgPer90: mins ? r2((npxg / mins) * 90) : 0, gMinusXg: r1(goals - xg),
  }
}
const SEASON_KEYS = { seasonGoals: 'goals', seasonAssists: 'assists', seasonShots: 'shots', seasonSOT: 'sot', seasonXG: 'xg', seasonMins: 'mins', seasonApps: 'apps', seasonStarts: 'starts', seasonBCM: 'bcm', seasonPens: 'pens' }
const seasonFields = t => Object.fromEntries(Object.entries(SEASON_KEYS).map(([k, v]) => [k, t[v]]))
const bestOf = games => [...games].filter(g => g.mins > 0).sort((a, b) => (b.goals * 10 + b.assists * 5 + (b.rating ?? 0)) - (a.goals * 10 + a.assists * 5 + (a.rating ?? 0)) || a.g - b.g)[0] ?? games[0] ?? null

// ─── A club season: the world ────────────────────────────────────────────────
// The fixture list: the circle method (every club meets every other once in each half), the second half the
// first with home and away swapped. Venues are picked round by round so a club alternates: each pairing goes
// the way that breaks the longer home or away run (and keeps the club's home and away games level), looking
// ahead to the swap at the turn of the season, so runs of three are rare and longer ones never happen.
function roundRobin(ids, rand) {
  const t = shuffle(ids, rand)
  if (t.length % 2) t.push(null)
  const n = t.length, half = n / 2, R = n - 1, rounds = []
  let arr = t.slice()
  for (let r = 0; r < R; r++) {
    const pairs = []
    for (let i = 0; i < half; i++) { const a = arr[i], b = arr[n - 1 - i]; if (a != null && b != null) pairs.push([a, b]) }
    rounds.push(pairs)
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)]
  }
  const last = {}, run = {}, homes = {}, first = {}
  for (const x of t) if (x != null) { last[x] = null; run[x] = 0; homes[x] = 0 }
  const runAfter = (x, v) => (last[x] === v ? run[x] + 1 : 1)
  rounds.forEach((pairs, r) => {
    rounds[r] = pairs.map(([a, b]) => {
      const cost = (h, w) => {
        let ra = runAfter(h, 'H'), rb = runAfter(w, 'A')
        // (the last round: the second half opens with round one swapped, so a run can carry over)
        if (r === R - 1) { if (first[h] === 'A') ra += 1; if (first[w] === 'H') rb += 1 }
        return Math.max(ra, rb) * 100 + (ra + rb) * 10 + Math.abs(homes[h] + 1 - (r + 1) / 2) + Math.abs(homes[w] - (r + 1) / 2)
      }
      const [h, w] = cost(a, b) <= cost(b, a) ? [a, b] : [b, a]
      for (const [x, v] of [[h, 'H'], [w, 'A']]) { run[x] = runAfter(x, v); last[x] = v; if (r === 0) first[x] = v }
      homes[h]++
      return [h, w]
    })
  })
  return [...rounds, ...rounds.map(p => p.map(([h, a]) => [a, h]))]
}
const rowOf = (c, rand) => ({ short: c.short, name: c.name, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, tb: rand() })
function addResult(rows, h, a, hs, as) {
  const H = rows[h], A = rows[a]
  H.played++; A.played++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs
  if (hs > as) { H.wins++; A.losses++; H.points += 3 } else if (hs < as) { A.wins++; H.losses++; A.points += 3 } else { H.draws++; A.draws++; H.points++; A.points++ }
  H.gd = H.gf - H.ga; A.gd = A.gf - A.ga
}
const sortRows = rows => rows.sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || y.wins - x.wins || x.tb - y.tb || (x.short < y.short ? -1 : 1))
// A league table in the league's own order (LEAGUE_META tb): points, then its tiebreakers. h2h: each club's record
// against each other one, `A>B` → { pts, gf, ga, away, n } (n: the matches between them so far). The head-to-head
// is a mini-table of the clubs still level, read once they've all played each other home and away (La Liga's and
// Serie A's rule: until then the next tiebreaker decides). Last: the draw's own lots (tb), his club, the code.
function h2hAdd(h2h, h, a, hs, as) {
  if (!h2h) return
  const one = (x, y, f, g, away) => { const k = `${x}>${y}`; const r = h2h.get(k) ?? { pts: 0, gf: 0, ga: 0, away: 0, n: 0 }; r.gf += f; r.ga += g; r.n++; r.pts += f > g ? 3 : f === g ? 1 : 0; if (away) r.away += f; h2h.set(k, r) }
  one(h, a, hs, as, false); one(a, h, as, hs, true)
}
function sortLeague(rows, key, h2h = null) {
  const crits = ['points', ...((LEAGUE_META[key] ?? LEAGUE_META.ENG).tb ?? ['gd', 'gf'])]
  const met = list => list.every(x => list.every(y => x === y || (h2h?.get(`${x.short}>${y.short}`)?.n ?? 0) >= 2))
  const val = (c, r, list) => {
    if (c === 'points' || c === 'gd' || c === 'gf' || c === 'wins') return r[c]
    let v = 0
    for (const o of list) { if (o === r) continue; const x = h2h.get(`${r.short}>${o.short}`); if (x) v += c === 'h2hPts' ? x.pts : c === 'h2hGd' ? x.gf - x.ga : x.away }
    return v
  }
  const last = (x, y) => (x.tb ?? 0) - (y.tb ?? 0) || (x.isUs ? -1 : y.isUs ? 1 : 0) || (x.short < y.short ? -1 : 1)
  const rank = (list, ci) => {
    if (list.length <= 1) return list
    if (ci >= crits.length) return list.sort(last)
    const c = crits[ci]
    if (c.startsWith('h2h') && !(h2h && met(list))) return rank(list, ci + 1)
    const v = new Map(list.map(r => [r, val(c, r, list)]))
    const sorted = list.slice().sort((x, y) => v.get(y) - v.get(x))
    const out = []
    for (let i = 0; i < sorted.length;) { let j = i; while (j < sorted.length && v.get(sorted[j]) === v.get(sorted[i])) j++; out.push(...rank(sorted.slice(i, j), ci + 1)); i = j }
    return out
  }
  return rank(rows.slice(), 0)
}
const tableOut = (rows, U) => rows.map((r, i) => ({ short: r.short, name: r.name, played: r.played, wins: r.wins, draws: r.draws, losses: r.losses, gf: r.gf, ga: r.ga, gd: r.gd, points: r.points, pos: i + 1, isUs: r.short === U }))

// "Last season": a club's place by its rating (Career and the caller can pass the real one)
const LAST_PLACE = new Map()
for (const l of LEAGUES) clubsOf(l.id).slice().sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || (b.att + b.def) - (a.att + a.def) || (a.short < b.short ? -1 : 1)).forEach((c, i) => LAST_PLACE.set(c.short, i + 1))
const lastPlace = c => LAST_PLACE.get(c.short) ?? 10

// The three European competitions this season: 36 sides each. euro: who qualified, { [short]: comp } (Career: last
// season's tables, cups and European winners, lib/careerSoccer.js; else 2026-27's as UEFA drew them, EUROPE_2026);
// the places nobody from the five leagues fills go to Europe's other sides (EURO_EXTRA). clubOf: a club outside the
// data that came up into a top flight (Career's world)
function europeEntrants(U, uRate, uComp, euro = null, clubOf = null) {
  const ucl = [], uel = [], uecl = []
  const lists = { ucl, uel, uecl }
  for (const [s, comp] of Object.entries(euro ?? EUROPE_2026)) {
    if (s === U || !lists[comp]) continue
    const c = CLUB_BY.get(s) ?? EXTRA_BY.get(s) ?? clubOf?.(s)
    if (c) lists[comp].push(c)
  }
  const u = { ...CLUB_BY.get(U), ...uRate }
  if (uComp === 'ucl') ucl.push(u); else if (uComp === 'uel') uel.push(u); else if (uComp === 'uecl') uecl.push(u)
  const fill = (list, comp) => {
    const pool = EXTRAS.filter(e => e.comp === comp).sort((a, b) => b.z - a.z || (a.short < b.short ? -1 : 1))
    // (short of sides: the Champions League and the Europa League borrow from each other, never from the Conference
    // League's; the Conference League from nobody)
    const spare = comp === 'uecl' ? [] : EXTRAS.filter(e => e.comp !== comp && e.comp !== 'uecl').sort((a, b) => b.z - a.z)
    const out = list.filter(x => !used.has(x.short) || x.short === U)
    for (const e of [...pool, ...spare]) { if (out.length >= 36) break; if (!used.has(e.short) && !out.some(x => x.short === e.short)) out.push(e) }
    // too many top-five sides (a forced entry): the weakest other ones step aside
    while (out.length > 36) { const i = out.map((x, k) => [x, k]).filter(([x]) => x.short !== U).sort((a, b) => (a[0].att + a[0].def) - (b[0].att + b[0].def))[0][1]; out.splice(i, 1) }
    for (const x of out) used.add(x.short)
    return out
  }
  // (no club in two of them: each one takes its own first, then fills from the clubs still free)
  const used = new Set([...ucl, ...uel, ...uecl].map(x => x.short))
  used.delete(U)
  const take = list => { for (const x of list) used.delete(x.short); return list }
  const A = fill(take(ucl), 'ucl'), B = fill(take(uel), 'uel'), C = fill(take(uecl), 'uecl')
  return { ucl: A, uel: B, uecl: C }
}
// The league phase draw: four pots of nine, two opponents from each pot (one home, one away), none from
// the same country (UEFA's rules since 2024-25)
function matchPerm(A, B, rand, avoid, clash) {
  for (let t = 0; t < 300; t++) {
    const perm = [], used = new Set()
    let ok = true
    for (let k = 0; k < A.length; k++) {
      const opts = []
      for (let m = 0; m < B.length; m++) if (!used.has(m) && (!clash || !clash(A[k], B[m])) && (!avoid || avoid[k] !== m)) opts.push(m)
      if (!opts.length) { ok = false; break }
      const m = opts[Math.floor(rand() * opts.length)]
      perm.push(m); used.add(m)
    }
    if (ok) return perm
  }
  return clash ? matchPerm(A, B, rand, avoid, null) : A.map((_, k) => (avoid ? (avoid[k] + 1) % B.length : k))
}
function leaguePhaseDraw(teams, rand) {
  const sorted = teams.slice().sort((a, b) => (b.att + b.def) - (a.att + a.def) || (a.short < b.short ? -1 : 1))
  const pots = [0, 1, 2, 3].map(i => sorted.slice(i * 9, i * 9 + 9))
  const clash = (x, y) => x.country === y.country
  const games = []
  for (let i = 0; i < 4; i++) {
    let ord = null
    for (let t = 0; t < 300 && !ord; t++) { const o = shuffle(pots[i], rand); if (o.every((x, k) => !clash(x, o[(k + 1) % o.length]))) ord = o }
    ord = ord ?? shuffle(pots[i], rand)
    ord.forEach((x, k) => games.push([x.short, ord[(k + 1) % ord.length].short]))
    for (let j = i + 1; j < 4; j++) {
      const sig = matchPerm(pots[i], pots[j], rand, null, clash)
      const tau = matchPerm(pots[i], pots[j], rand, sig, clash)
      pots[i].forEach((x, k) => { games.push([x.short, pots[j][sig[k]].short]); games.push([pots[j][tau[k]].short, x.short]) })
    }
  }
  return games
}
// The Conference League's league phase: six pots of six, one opponent from each pot (his own too), three at home
// and three away as near as the draw allows (UEFA's format since 2024-25)
function leaguePhaseDraw6(teams, rand) {
  const sorted = teams.slice().sort((a, b) => (b.att + b.def) - (a.att + a.def) || (a.short < b.short ? -1 : 1))
  const pots = [0, 1, 2, 3, 4, 5].map(i => sorted.slice(i * 6, i * 6 + 6))
  const clash = (x, y) => x.country === y.country
  const games = []
  for (let i = 0; i < 6; i++) {
    const o = shuffle(pots[i], rand)
    for (let k = 0; k + 1 < o.length; k += 2) games.push(rand() < 0.5 ? [o[k].short, o[k + 1].short] : [o[k + 1].short, o[k].short])
    for (let j = i + 1; j < 6; j++) {
      if (!pots[j].length) continue
      const sig = matchPerm(pots[i], pots[j], rand, null, clash)
      pots[i].forEach((x, k) => { const y = pots[j][sig[k]]; if (y) games.push((i + j) % 2 ? [x.short, y.short] : [y.short, x.short]) })
    }
  }
  return games
}
const EURO_WEEKS = { md: [4, 7, 10, 13, 16, 19, 21, 22], md6: [6, 9, 12, 14, 16, 18], po: [24, 25], r16: [27, 28], qf: [32, 33], sf: [35, 36], f: 39.5 }
const EURO_NAME = { ucl: 'Champions League', uel: 'Europa League', uecl: 'Conference League' }
function simEurope(comp, teams, ctx) {
  const { rand, hook, U, rate, out } = ctx
  const W = makeWorld({ rand, hook, U, rate, base: EURO_BASE, mA: G_ATT, mD: G_DEF, kA: K_ATT, kD: K_DEF, H: H_EURO, out })
  const rows = Object.fromEntries(teams.map(c => [c.short, rowOf(c, rand)]))
  const gf = Object.fromEntries(teams.map(c => [c.short, 0]))
  const six = comp === 'uecl'
  const draw = six ? leaguePhaseDraw6(teams, rand) : leaguePhaseDraw(teams, rand)
  const mine = shuffle(draw.filter(([h, a]) => h === U || a === U), rand)
  const rest = draw.filter(([h, a]) => h !== U && a !== U)
  mine.forEach(([h, a], md) => { const m = playFx(W, { comp, wk: (six ? EURO_WEEKS.md6 : EURO_WEEKS.md)[md] ?? 22, home: h, away: a, meta: { round: `League phase · MD${md + 1}`, md: md + 1 } }); addResult(rows, h, a, m.hs, m.as); gf[h] += m.hs; gf[a] += m.as })
  for (const [h, a] of rest) { const [hs, as] = quickScore(W, h, a); addResult(rows, h, a, hs, as); gf[h] += hs; gf[a] += as }
  const table = sortRows(Object.values(rows))
  const seedOf = s => table.findIndex(r => r.short === s) + 1
  // knockouts: 9-24 play off, 1-8 wait in the round of 16 (the better seed at home in the second leg)
  const tie = (A, B, wks, name, ri) => {
    const [lo, hi] = seedOf(A) > seedOf(B) ? [A, B] : [B, A]
    const t = playTie(W, lo, hi, { comp, wks, name, ri })
    gf[lo] += t.agg[0]; gf[hi] += t.agg[1]
    return t
  }
  const S = table.map(r => r.short)
  const reached = Object.fromEntries(S.map((s, i) => [s, i < 8 ? 'Round of 16' : i < 24 ? 'Knockout play-offs' : 'League phase']))
  const po = []
  for (let k = 0; k < 8; k++) {
    const A = S[8 + k], B = S[23 - k]
    const t = tie(A, B, EURO_WEEKS.po, 'Knockout play-offs', 0)
    po.push(t.winner); reached[t.winner] = 'Round of 16'
  }
  // R16: 1 v the 16/17 winner … 8 v the 9/24 winner
  const r16 = [], r16w = []
  for (let k = 0; k < 8; k++) r16.push([S[k], po[7 - k]])
  for (const [A, B] of r16) { const t = tie(A, B, EURO_WEEKS.r16, 'Round of 16', 1); r16w.push(t.winner); reached[t.winner] = 'Quarter-finals' }
  const qfPairs = [[0, 7], [3, 4], [1, 6], [2, 5]], qfw = []
  for (const [i, j] of qfPairs) { const t = tie(r16w[i], r16w[j], EURO_WEEKS.qf, 'Quarter-final', 2); qfw.push(t.winner); reached[t.winner] = 'Semi-finals' }
  const sfw = []
  for (const [i, j] of [[0, 1], [2, 3]]) { const t = tie(qfw[i], qfw[j], EURO_WEEKS.sf, 'Semi-final', 3); sfw.push(t.winner); reached[t.winner] = 'Final' }
  const before = out.length
  const f = playSingle(W, sfw[0], sfw[1], { comp, wk: EURO_WEEKS.f, name: 'Final', ri: 4, neutral: true })
  for (let i = before; i < out.length; i++) out[i].final = true
  gf[sfw[0]] += f.m.hs; gf[sfw[1]] += f.m.as
  reached[f.winner] = 'Winners'
  return { comp, name: EURO_NAME[comp], table: tableOut(table, U), winner: f.winner, finalist: f.loser, reached, gf }
}
// The European Performance Spots (UEFA, since 2024-25): one more Champions League place each for the two
// associations whose clubs earned the most coefficient points per club that season. Points here: a win 2, a draw 1 in
// the league phase, the Champions League's 4 for taking part, 2 a round from the round of 16 on.
const STAGE_BONUS = { 'Round of 16': 2, 'Quarter-finals': 4, 'Semi-finals': 6, Final: 8, Winners: 10 }
function epsOf(world) {
  const tot = {}, n = {}
  for (const comp of ['ucl', 'uel', 'uecl']) {
    const E = world[comp]
    if (!E) continue
    for (const r of E.table) {
      const key = (CLUB_BY.get(r.short) ?? EXTRA_BY.get(r.short) ?? world.synth?.get(r.short))?.country
      if (!key) continue
      tot[key] = (tot[key] ?? 0) + 2 * r.wins + r.draws + (STAGE_BONUS[E.reached[r.short]] ?? 0) + (comp === 'ucl' ? 4 : 0)
      n[key] = (n[key] ?? 0) + 1
    }
  }
  return Object.keys(tot).sort((a, b) => tot[b] / n[b] - tot[a] / n[a] || (a < b ? -1 : 1)).slice(0, 2)
}
// The domestic cup. [round, calendar week, chance of a lower-division opponent, venue]
// venue: 'draw' (FA Cup: home drawn), 'lower' (the lower-division side hosts: Copa, Pokal, Coupe de France),
// 'seed' (the better side hosts: Coppa Italia), 'neutral' (finals; the FA Cup semis at Wembley), 'legs' (two legs)
// Every tie one match, extra time and penalties (the FA Cup's replays went in 2024-25), but the Copa del Rey's and the
// Coppa Italia's two-legged semi-finals. The calendars (2025-26's): the FA Cup's third round in January, the final in
// May; the Copa del Rey from late October (its first and second rounds; the Supercopa's four come in at the round of 32
// in January), the final in late April at La Cartuja; the Coppa Italia's round of 64 in August, round of 32 in late
// September, the final in mid-May in Rome; the DFB-Pokal's first round in August, the semi-finals in late April, the
// final in Berlin in late May; the Coupe de France from the round of 64 just before Christmas to the final in May.
const CUP_ROUNDS = {
  ENG: [['Third Round', 20, 0.72, 'draw'], ['Fourth Round', 24, 0.5, 'draw'], ['Fifth Round', 27, 0.35, 'draw'], ['Quarter-final', 30, 0.25, 'draw'], ['Semi-final', 33.5, 0.12, 'neutral'], ['Final', 39, 0.08, 'neutral']],
  ESP: [['First Round', 12, 1, 'lower'], ['Second Round', 15, 0.95, 'lower'], ['Round of 32', 19, 0.85, 'lower'], ['Round of 16', 21, 0.45, 'lower'], ['Quarter-final', 24.5, 0.3, 'lower'], ['Semi-final', [27, 31], 0.18, 'legs'], ['Final', 35, 0.1, 'neutral']],
  ITA: [['Round of 64', 0.5, 0.6, 'seed'], ['Round of 32', 7, 0.3, 'seed'], ['Round of 16', 17, 0.1, 'seed'], ['Quarter-final', 24, 0.05, 'seed'], ['Semi-final', [31, 35], 0.03, 'legs'], ['Final', 38, 0.03, 'neutral']],
  GER: [['First Round', 0.5, 1, 'lower'], ['Second Round', 10, 0.55, 'lower'], ['Round of 16', 16, 0.42, 'lower'], ['Quarter-final', 23, 0.3, 'lower'], ['Semi-final', 32, 0.18, 'lower'], ['Final', 38.5, 0.1, 'neutral']],
  FRA: [['Round of 64', 17, 0.95, 'lower'], ['Round of 32', 20, 0.75, 'lower'], ['Round of 16', 23, 0.55, 'lower'], ['Quarter-final', 27, 0.42, 'lower'], ['Semi-final', 31, 0.3, 'lower'], ['Final', 38, 0.18, 'neutral']],
}
function simCup(L, ctx, U, uPlace) {
  const { rand, hook, rate, out } = ctx
  const lb = LEAGUE_BASE.get(L.id)
  const W = makeWorld({ rand, hook, U, rate, base: lb.base, mA: lb.mA, mD: lb.mD, kA: K_ATT, kD: K_DEF, H: H_DOM, out })
  const rounds = CUP_ROUNDS[L.key] ?? CUP_ROUNDS.ENG
  // where his club comes in: the Coppa Italia's top eight seeds in the round of 16; the Copa del Rey's Supercopa
  // clubs (last season's top two and its cup winner) in the round of 32; everyone else from the first round
  // (a second-tier club too: the Championship's clubs enter the FA Cup with the Premier League's, in the third round)
  const top = !ctx.tier2
  const start = top && L.key === 'ITA' && uPlace <= 8 ? 2 : top && L.key === 'ESP' && (uPlace <= 2 || ctx.cupHolder === U) ? 2 : 0
  const peers = (ctx.members?.(L.id) ?? clubsOf(L.id)).filter(c => c.short !== U)
  // the lower-division sides: the second tier (the clubs that went down among them) and the divisions below it
  const lowers = shuffle([...(ctx.lowerPool?.(L) ?? []).filter(c => c.short !== U), ...(LOWER_CLUBS[L.key] ?? [])], rand)
  const zOf = c => ((c.att - lb.mA) / SD_ATT + (c.def - lb.mD) / SD_DEF) / 2
  const used = new Set()
  let alive = true, result = null, lastOpp = null
  for (let i = start; i < rounds.length && alive; i++) {
    const [name, wk, pLow, venue] = rounds[i]
    const early = i - start <= 1 && pLow >= 0.5
    let opp
    if (rand() < pLow && lowers.length) {
      opp = lowers.shift()
      if (!ctx.lowerRates.has(opp.short)) ctx.lowerRates.set(opp.short, { att: lb.minA - 4 - rand() * 7, def: lb.minD - 4 - rand() * 7 })
    } else {
      const pool = peers.filter(c => !used.has(c.short))
      opp = pickWeighted(pool, c => Math.exp(zOf(c) * (0.4 + i * 0.25)), rand)
      used.add(opp.short)
    }
    lastOpp = opp.short
    const kind = early && opp.lower ? 'cupEarly' : 'cup'
    let through
    if (venue === 'legs') {
      const wks = Array.isArray(wk) ? wk : [wk, wk + 3]
      const uFirst = rand() < 0.5
      const before = out.length
      const t = playTie(W, uFirst ? U : opp.short, uFirst ? opp.short : U, { comp: 'cup', wks, name, ri: i })
      for (let k = before; k < out.length; k++) out[k].kind = 'cup'
      through = t.winner === U
    } else {
      const neutral = venue === 'neutral'
      const uHome = venue === 'lower' && opp.lower ? false
        : venue === 'seed' ? (rate(U).att + rate(U).def) >= (rate(opp.short).att + rate(opp.short).def)
        : rand() < 0.5
      const homeS = uHome ? U : opp.short
      const awayS = homeS === U ? opp.short : U
      const m = playFx(W, { comp: 'cup', wk, home: homeS, away: awayS, neutral, ko: true, meta: { round: name, ri: i, kind, final: name === 'Final' } })
      through = homeS === U ? m.winH : m.winA
    }
    if (!through) { alive = false; result = name }
  }
  const champion = alive
  // who lifts it when he's out: the league's sides by strength (the side that knocked him out a bit more often)
  const winner = champion ? U : pickWeighted(peers, c => Math.exp(zOf(c) * 1.4) * (c.short === lastOpp ? 1.6 : 1), rand).short
  return { name: LEAGUE_META[L.key].cup, champion, result: champion ? 'Winners' : result === 'Final' ? 'Runners-up' : result, winner, start }
}
function otherCupWinner(L, rand, members = null) {
  const lb = LEAGUE_BASE.get(L.id)
  return pickWeighted(members ?? clubsOf(L.id), c => Math.exp((((c.att - lb.mA) / SD_ATT + (c.def - lb.mD) / SD_DEF) / 2) * 1.4), rand).short
}

// The whole season around one club: all five leagues, the three European competitions, the cup
// tier2: his club plays its country's second tier this season (a promoted side has its place in the top flight)
// sched: a seed for his league's fixture list (Career: the season's own, so every re-run of the season by the season
// director plays the same fixtures: each club home and away, once each)
// places: every other league's table at the January window too (Career's: where a bidding club stands, leagues[id].jan)
// world (Career): who plays in which division this season ({ divs, t2 }: promotion and relegation carried from one
// season to the next), who is in Europe ({ euro }), last season's cup winners ({ cups }). Without it, 2026-27's.
function clubWorld({ U, uRate, uComp, uPlace, hook, rand, tier2 = false, sched = null, places = false, world = null }) {
  const out = []
  const lowerRates = new Map()
  const uL = leagueOfClub(CLUB_BY.get(U))
  const t2 = tier2 ? tier2Of(uL, U, world) : null
  // (the clubs from outside the data in a top flight or a second tier this season, at their ratings)
  const synth = new Map()
  const clubIn = (s, key, top) => { const c = CLUB_BY.get(s); if (c) return c; let x = synth.get(s); if (!x) { x = synthClub(s, key, top); synth.set(s, x) } return x }
  const members = lid => {
    const L = LEAGUES.find(l => l.id === lid), list = world?.divs?.[lid]
    return list ? list.filter(s => !(tier2 && s === U)).map(s => clubIn(s, L.key, true)) : clubsOf(lid)
  }
  const MEM = new Map(LEAGUES.map(l => [l.id, members(l.id)]))
  // the second tier's clubs, for the cup's draw (the side he's playing for left out)
  const lowerPool = L => (world?.t2?.[L.id] ?? (TIER2_CLUBS[L.key] ?? []).map(x => x[1])).filter(s => !MEM.get(L.id).some(c => c.short === s))
    .map(s => ({ ...clubIn(s, L.key, false), lower: true }))
  const rate = s => (s === U ? uRate : CLUB_BY.get(s) ?? EXTRA_BY.get(s) ?? synth.get(s) ?? t2?.rates.get(s) ?? lowerRates.get(s) ?? { att: G_ATT - 10, def: G_DEF - 10 })
  const leagues = {}
  // one league's season. keep: every club's score each matchweek (his league: soccerTableAt)
  const playLeague = (id, key, cs, lb, keep) => {
    const W = makeWorld({ rand, hook, U, rate, base: lb.base, mA: lb.mA, mD: lb.mD, kA: K_ATT, kD: K_DEF, H: H_DOM, out })
    const rows = Object.fromEntries(cs.map(c => [c.short, rowOf(c, rand)]))
    const h2h = new Map()
    const fixtures = roundRobin(cs.map(c => c.short), keep && schedSeed != null ? seeded(`sched|${schedSeed}|${id}`) : rand)
    const scale = 38 / Math.max(1, fixtures.length)
    // (the scores are only noted: no draw of the seed is spent on it, so the season plays as it did)
    // (and who each club played, a letter a matchweek: its opponent's place in the list, capitals at home, so the
    // table read back mid-season has the head-to-head too)
    const idx = new Map(cs.map((c, i) => [c.short, i]))
    const fm = keep || places ? Object.fromEntries(cs.map(c => [c.short, [[], [], []]])) : null
    const note = (ri, h, a, hs, as) => { if (!fm) return; fm[h][0][ri] = hs; fm[h][1][ri] = as; fm[a][0][ri] = as; fm[a][1][ri] = hs; fm[h][2][ri] = String.fromCharCode(65 + idx.get(a)); fm[a][2][ri] = String.fromCharCode(97 + idx.get(h)) }
    const uOpp = []
    fixtures.forEach((round, ri) => {
      for (const [h, a] of round) {
        if (h !== U && a !== U) { const [hs, as] = quickScore(W, h, a); addResult(rows, h, a, hs, as); h2hAdd(h2h, h, a, hs, as); note(ri, h, a, hs, as); continue }
        const m = playFx(W, { comp: 'league', wk: (ri + 1) * scale, home: h, away: a, meta: { round: `Matchweek ${ri + 1}`, mw: ri + 1 } })
        addResult(rows, h, a, m.hs, m.as); h2hAdd(h2h, h, a, m.hs, m.as); note(ri, h, a, m.hs, m.as); uOpp[ri] = h === U ? a : h
      }
    })
    const digits = list => Array.from({ length: fixtures.length }, (_, i) => (list[i] == null ? '-' : String(Math.min(9, list[i])))).join('')
    const order = cs.map(c => c.short)
    const form = keep && fm ? { rounds: fixtures.length, key, order, by: Object.fromEntries(Object.entries(fm).map(([k, [f, a]]) => [k, [digits(f), digits(a)]])), vs: Object.fromEntries(Object.entries(fm).map(([k, v]) => [k, Array.from({ length: fixtures.length }, (_, i) => v[2][i] ?? '-').join('')])), names: Object.fromEntries(cs.map(c => [c.short, c.name])), opp: { [U]: uOpp } } : null
    // (another league in January: each club's place after the matchweek the window opens in, 21 of 38)
    const jan = !keep && fm ? Object.fromEntries(soccerTableAt({ rounds: fixtures.length, key, order, by: fm, vs: Object.fromEntries(Object.entries(fm).map(([k, v]) => [k, v[2]])) }, Math.round(fixtures.length * 21 / 38)).map(r => [r.short, r.pos])) : null
    leagues[id] = { id, key, table: tableOut(sortLeague(Object.values(rows), key, h2h), U), games: fixtures.length, ...(form ? { form } : {}), ...(jan ? { jan } : {}) }
  }
  const schedSeed = sched
  for (const L of LEAGUES) {
    const mine = L.id === uL.id
    // (his club down without a world to say who came up: the strongest of the second tier takes its place)
    const cs = mine && t2 && t2.sub ? (world?.divs?.[L.id] ? [...MEM.get(L.id), t2.sub] : clubsOf(L.id).map(c => (c.short === U ? t2.sub : c))) : MEM.get(L.id)
    playLeague(L.id, L.key, cs, LEAGUE_BASE.get(L.id), mine && !t2)
  }
  const clubOf = s => synth.get(s) ?? null
  const ent = europeEntrants(U, uRate, uComp, world?.euro ?? null, clubOf)
  const ectx = { rand, hook, U, rate, out }
  const ucl = simEurope('ucl', ent.ucl, ectx)
  const uel = simEurope('uel', ent.uel, ectx)
  const cups = {}
  for (const L of LEAGUES) cups[L.id] = L.id === uL.id ? simCup(L, { rand, hook, rate, out, lowerRates, members: lid => MEM.get(lid), lowerPool, tier2: !!t2, cupHolder: world?.cups?.[L.id] ?? null }, U, uPlace) : { name: LEAGUE_META[L.key].cup, winner: otherCupWinner(L, rand, MEM.get(L.id)) }
  // (the Conference League last, on its own stream of the seed's draws after the cups: the leagues, the two older
  // competitions and the cups play the seasons they did before it was added)
  const uecl = simEurope('uecl', ent.uecl, ectx)
  // (and his club's second-tier season, after everything else: the rest of the world plays the season it would have)
  if (t2) playLeague(t2.meta.id, uL.key, [CLUB_BY.get(U), ...t2.clubs], LEAGUE_BASE.get(uL.id), true)
  return { U, lid: uL.id, uRate, uComp, leagues, ucl, uel, uecl, cups, fixtures: out, lower: Object.fromEntries(lowerRates), tier2: t2 ? t2.meta : null, synth }
}

// ─── The World Cup: the world ────────────────────────────────────────────────
// 2026: twelve groups of four, the top two and the eight best thirds into a round of 32 (FIFA's match
// schedule, matches 73-88), then single-match knockouts with extra time and penalties, and a third-place match.
const R32 = [
  ['2A', '2B'], ['1E', '3ABCDF'], ['1F', '2C'], ['1C', '2F'], ['1I', '3CDFGH'], ['2E', '2I'], ['1A', '3CEFHI'], ['1L', '3EHIJK'],
  ['1D', '3BEFIJ'], ['1G', '3AEHIJ'], ['2K', '2L'], ['1H', '2J'], ['1B', '3EFGIJ'], ['1J', '2H'], ['1K', '3DEIJL'], ['2D', '2G'],
]
const R16 = [[1, 4], [0, 2], [3, 5], [6, 7], [10, 11], [8, 9], [13, 15], [12, 14]]    // matches 89-96
const QF = [[0, 1], [4, 5], [2, 3], [6, 7]]                                              // 97-100
const SF = [[0, 1], [2, 3]]                                                              // 101-102
const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('')
function wcGroups(letters = GROUP_LETTERS) {
  const g = Object.fromEntries(letters.map(l => [l, NATIONS.filter(n => String(n.group ?? '').toUpperCase() === l)]))
  if (letters.every(l => g[l].length === 4) || letters !== GROUP_LETTERS) return g
  // (no draw in the data: seeded pots, snake order)
  const s = NATIONS.slice().sort((a, b) => (b.att + b.def) - (a.att + a.def) || (a.short < b.short ? -1 : 1)).slice(0, 48)
  const out = Object.fromEntries(GROUP_LETTERS.map(l => [l, []]))
  s.forEach((n, i) => { const pot = Math.floor(i / 12), k = i % 12; out[GROUP_LETTERS[pot % 2 ? 11 - k : k]].push(n) })
  return out
}
function allocateThirds(slots, groups) {
  // each third-place slot takes a different qualifying group from its own list (FIFA's table is one such answer)
  const res = new Array(slots.length).fill(null), used = new Set()
  const go = i => {
    if (i === slots.length) return true
    for (const gl of slots[i]) if (groups.includes(gl) && !used.has(gl)) { used.add(gl); res[i] = gl; if (go(i + 1)) return true; used.delete(gl) }
    return false
  }
  if (!go(0)) { const left = groups.filter(g => !res.includes(g)); for (let i = 0; i < res.length; i++) if (!res[i]) res[i] = left.shift() }
  return res
}
function wcWorld({ U, uRate, hook, rand }) {
  const out = []
  const rate = s => (s === U ? uRate : NATION_BY.get(s) ?? { att: W_ATT - 8, def: W_DEF - 8 })
  const W = makeWorld({ rand, hook, U, rate, base: WC_BASE, mA: W_ATT, mD: W_DEF, kA: KW_ATT, kD: KW_DEF, H: 0, out, wc: true, hostAdv: (x, y) => (HOSTS.has(x) ? H_WC : 0) - (HOSTS.has(y) ? H_WC : 0) })
  const groups = wcGroups()
  const gf = Object.fromEntries(NATIONS.map(n => [n.short, 0]))
  const tables = {}
  // (every group match as it was played, [matchday, home, away, home goals, away goals]: the season page plays the group
  // out a matchday at a time with the other match's result; kept only, it draws nothing)
  const played = {}
  const MD = [[[0, 1], [2, 3]], [[0, 2], [3, 1]], [[3, 0], [1, 2]]]
  for (const l of GROUP_LETTERS) {
    const g = groups[l]
    const rows = Object.fromEntries(g.map(n => [n.short, rowOf(n, rand)]))
    played[l] = []
    MD.forEach((pairs, md) => {
      for (const [i, j] of pairs) {
        if (!g[i] || !g[j]) continue
        const m = playFx(W, { comp: 'wc', wk: md + 1, home: g[i].short, away: g[j].short, neutral: true, meta: { round: `Group ${l} · Matchday ${md + 1}`, stage: 'group', group: l } })
        addResult(rows, g[i].short, g[j].short, m.hs, m.as); gf[g[i].short] += m.hs; gf[g[j].short] += m.as
        played[l].push([md + 1, g[i].short, g[j].short, m.hs, m.as])
      }
    })
    tables[l] = sortRows(Object.values(rows))
  }
  const thirds = sortRows(GROUP_LETTERS.map(l => ({ ...tables[l][2], group: l })).filter(r => r.short))
  const bestThirds = thirds.slice(0, 8).map(r => r.group)
  const slotIdx = R32.map(([, b], i) => (b.startsWith('3') ? i : -1)).filter(i => i >= 0)
  const alloc = allocateThirds(slotIdx.map(i => R32[i][1].slice(1).split('')), bestThirds)
  const at = code => { const g = code.slice(1); return tables[g]?.[Number(code[0]) - 1]?.short ?? null }
  const r32 = R32.map(([a, b], i) => [at(a), b.startsWith('3') ? tables[alloc[slotIdx.indexOf(i)]]?.[2]?.short : at(b)])
  const reached = Object.fromEntries(NATIONS.map(n => [n.short, 'Group stage']))
  for (const [a, b] of r32) { if (a) reached[a] = 'Round of 32'; if (b) reached[b] = 'Round of 32' }
  const bracket = { r32: [], r16: [], qf: [], sf: [], third: null, final: null }
  const ko = (pairs, wk, name, key, nextStage) => pairs.map(([A, B], i) => {
    const m = playFx(W, { comp: 'wc', wk: wk + i * 0.01, home: A, away: B, neutral: true, ko: true, meta: { round: name, stage: key } })
    gf[A] += m.hs; gf[B] += m.as
    const w = m.winH ? A : B
    bracket[key].push({ home: A, away: B, hs: m.hs, as: m.as, et: m.et, pens: m.pens ? [m.pens.h, m.pens.a] : null, winner: w })
    if (nextStage) reached[w] = nextStage
    return { w, l: m.winH ? B : A }
  })
  const w32 = ko(r32, 4, 'Round of 32', 'r32', 'Round of 16').map(x => x.w)
  const w16 = ko(R16.map(([i, j]) => [w32[i], w32[j]]), 5, 'Round of 16', 'r16', 'Quarter-finals').map(x => x.w)
  const w8 = ko(QF.map(([i, j]) => [w16[i], w16[j]]), 6, 'Quarter-final', 'qf', 'Semi-finals').map(x => x.w)
  const sf = ko(SF.map(([i, j]) => [w8[i], w8[j]]), 7, 'Semi-final', 'sf', null)
  const thirdM = playFx(W, { comp: 'wc', wk: 7.9, home: sf[0].l, away: sf[1].l, neutral: true, ko: true, meta: { round: 'Third-place match', stage: 'third' } })
  gf[sf[0].l] += thirdM.hs; gf[sf[1].l] += thirdM.as
  bracket.third = { home: sf[0].l, away: sf[1].l, hs: thirdM.hs, as: thirdM.as, et: thirdM.et, pens: thirdM.pens ? [thirdM.pens.h, thirdM.pens.a] : null, winner: thirdM.winH ? sf[0].l : sf[1].l }
  reached[bracket.third.winner] = 'Third place'; reached[thirdM.winH ? sf[1].l : sf[0].l] = 'Fourth place'
  const fin = playFx(W, { comp: 'wc', wk: 8, home: sf[0].w, away: sf[1].w, neutral: true, ko: true, meta: { round: 'Final', stage: 'final', final: true } })
  gf[sf[0].w] += fin.hs; gf[sf[1].w] += fin.as
  bracket.final = { home: sf[0].w, away: sf[1].w, hs: fin.hs, as: fin.as, et: fin.et, pens: fin.pens ? [fin.pens.h, fin.pens.a] : null, winner: fin.winH ? sf[0].w : sf[1].w }
  reached[bracket.final.winner] = 'Winners'; reached[fin.winH ? sf[1].w : sf[0].w] = 'Runners-up'
  const groupsOut = Object.fromEntries(GROUP_LETTERS.map(l => [l, tableOut(tables[l], U)]))
  const matches = Object.fromEntries(NATIONS.map(n => [n.short, 0]))
  for (const n of NATIONS) matches[n.short] = 3 + ({ 'Group stage': 0, 'Round of 32': 1, 'Round of 16': 2, 'Quarter-finals': 3, 'Fourth place': 5, 'Third place': 5, 'Runners-up': 5, 'Winners': 5 })[reached[n.short]]
  return { U, uRate, groups: groupsOut, groupGames: played, bracket, reached, gf, matches, champion: bracket.final.winner, fixtures: out }
}

// A continental championship (Career: the Euros, the Copa América, AFCON, the Asian Cup, the Gold Cup). G groups of
// four: six (24 nations) send the top two and the four best thirds into a round of 16; four (16 nations) send the top
// two into the quarter-finals. Single-match knockouts to the final, no third-place match (a beaten semi-finalist's
// finish is 'Semi-finals').
function contWorld({ U, uRate, hook, rand, G }) {
  const out = []
  const rate = s => (s === U ? uRate : NATION_BY.get(s) ?? { att: W_ATT - 8, def: W_DEF - 8 })
  const W = makeWorld({ rand, hook, U, rate, base: WC_BASE, mA: W_ATT, mD: W_DEF, kA: KW_ATT, kD: KW_DEF, H: 0, out, wc: true, hostAdv: (x, y) => (HOSTS.has(x) ? H_WC : 0) - (HOSTS.has(y) ? H_WC : 0) })
  const letters = GROUP_LETTERS.slice(0, G)
  const groups = wcGroups(letters)
  const gf = Object.fromEntries(NATIONS.map(n => [n.short, 0]))
  const tables = {}
  const MD = [[[0, 1], [2, 3]], [[0, 2], [3, 1]], [[3, 0], [1, 2]]]
  for (const l of letters) {
    const g = groups[l]
    const rows = Object.fromEntries(g.map(n => [n.short, rowOf(n, rand)]))
    MD.forEach((pairs, md) => {
      for (const [i, j] of pairs) {
        if (!g[i] || !g[j]) continue
        const m = playFx(W, { comp: 'wc', wk: md + 1, home: g[i].short, away: g[j].short, neutral: true, meta: { round: `Group ${l} · Matchday ${md + 1}`, stage: 'group', group: l } })
        addResult(rows, g[i].short, g[j].short, m.hs, m.as); gf[g[i].short] += m.hs; gf[g[j].short] += m.as
      }
    })
    tables[l] = sortRows(Object.values(rows))
  }
  const reached = Object.fromEntries(NATIONS.map(n => [n.short, 'Group stage']))
  const bracket = { r16: [], qf: [], sf: [], third: null, final: null }
  const ko = (pairs, wk, name, key, nextStage) => pairs.map(([A, B], i) => {
    const m = playFx(W, { comp: 'wc', wk: wk + i * 0.01, home: A, away: B, neutral: true, ko: true, meta: { round: name, stage: key, ...(key === 'final' ? { final: true } : {}) } })
    gf[A] += m.hs; gf[B] += m.as
    const w = m.winH ? A : B, l = m.winH ? B : A
    const row = { home: A, away: B, hs: m.hs, as: m.as, et: m.et, pens: m.pens ? [m.pens.h, m.pens.a] : null, winner: w }
    if (key === 'final') bracket.final = row; else bracket[key].push(row)
    if (nextStage) reached[w] = nextStage
    return { w, l }
  })
  const at = (l, i) => tables[l]?.[i]?.short ?? null
  let last8
  if (G >= 6) {
    // the sixteen in order: the group winners by record, the runners-up, the four best thirds; 1 v 16, 8 v 9...
    // (two from one group never meet in this round: the lower one swaps with the next tie's)
    const line = i => sortRows(letters.map(l => ({ ...tables[l][i], group: l })).filter(r => r.short))
    const seeds = [...line(0), ...line(1), ...line(2).slice(0, 16 - 2 * G)]
    const pairs = [[0, 15], [7, 8], [3, 12], [4, 11], [1, 14], [6, 9], [2, 13], [5, 10]].map(([i, j]) => [seeds[i], seeds[j]])
    for (let k = 0; k < pairs.length; k++) if (pairs[k][0]?.group === pairs[k][1]?.group) { const n = (k + 1) % pairs.length; const t = pairs[k][1]; pairs[k][1] = pairs[n][1]; pairs[n][1] = t }
    for (const [a, b] of pairs) { if (a) reached[a.short] = 'Round of 16'; if (b) reached[b.short] = 'Round of 16' }
    last8 = ko(pairs.map(([a, b]) => [a.short, b.short]), 4, 'Round of 16', 'r16', 'Quarter-finals').map(x => x.w)
  } else {
    // A1 v B2, B1 v A2, C1 v D2, D1 v C2 (the Copa América's bracket)
    last8 = [at('A', 0), at('B', 1), at('B', 0), at('A', 1), at('C', 0), at('D', 1), at('D', 0), at('C', 1)]
    for (const x of last8) if (x) reached[x] = 'Quarter-finals'
  }
  const w8 = ko([[0, 1], [2, 3], [4, 5], [6, 7]].map(([i, j]) => [last8[i], last8[j]]), 5, 'Quarter-final', 'qf', 'Semi-finals').map(x => x.w)
  const sf = ko([[0, 1], [2, 3]].map(([i, j]) => [w8[i], w8[j]]), 6, 'Semi-final', 'sf', null)
  const fin = ko([[sf[0].w, sf[1].w]], 7, 'Final', 'final', null)[0]
  reached[fin.w] = 'Winners'; reached[fin.l] = 'Runners-up'
  const groupsOut = Object.fromEntries(letters.map(l => [l, tableOut(tables[l], U)]))
  const extra = { 'Group stage': 0, 'Round of 16': 1, 'Quarter-finals': G >= 6 ? 2 : 1, 'Semi-finals': G >= 6 ? 3 : 2, 'Runners-up': G >= 6 ? 4 : 3, Winners: G >= 6 ? 4 : 3 }
  const matches = Object.fromEntries(NATIONS.map(n => [n.short, 3 + (extra[reached[n.short]] ?? 0)]))
  return { U, uRate, groups: groupsOut, bracket, reached, gf, matches, champion: fin.w, fixtures: out }
}

// ─── The award field ─────────────────────────────────────────────────────────
// Each club's players (up to five, by role) score their share of the club's simulated goals: a binomial of the club's
// goals at his expected share (his chances, his finishing, the minutes he's fit for, the penalties he takes).
const availOf = (rand, age) => clamp(0.92 - 0.38 * Math.pow(rand(), 2.5) - (age >= 33 ? 0.07 : 0), 0.3, 0.96)
// Every player of a side (main striker first) scores his share of its goals: his chances (at his role's
// part), his finishing, the minutes he's fit for; the main striker takes the penalties. The listed five never
// score more than 75% of a side's goals between them (the rest: defenders, subs, own goals). `taken`: the
// part of the goals the build scored (his own club); the others share what's left.
function scorersOf(list, gf, games, rand, taken = 0) {
  const lam = Math.max(0.5, gf / Math.max(1, games))
  const top = list[0]
  const den = (1 - shareAt(top.prof, lam)) + shareAt(top.prof, lam) * top.prof.F
  const out = list.map((p, i) => {
    const av = availOf(rand, p.age ?? 27)
    const pr = av * (shareAt(p.prof, lam) * ROLE[p.role].g * p.prof.F / den) + (i === 0 && !taken ? av * penRateAt(lam) * p.prof.taker * p.prof.penConv / lam : 0)
    return { p, pr: clamp(pr, 0.005, 0.7), av }
  })
  const room = Math.max(0.1, 0.75 - taken), sum = out.reduce((s, x) => s + x.pr, 0)
  if (sum > room) for (const x of out) x.pr *= room / sum
  return out
}
// their goals, one after another out of what's left, so each keeps his share of the whole
function shareGoals(sc, goals, rand, taken = 0) {
  let left = goals, used = taken
  return sc.map(x => { const g = binom(left, clamp(x.pr / Math.max(0.05, 1 - used), 0, 0.95), rand); left -= g; used += x.pr; return g })
}
// Career, years on (team.yrs: seasons since 2026; team.world: the career's seed). The award field's real players
// don't play for ever: one who would be 35 has gone, and the man in his place has a made-up name and the same level
// (his club replaced him like for like; a successor lasts nine seasons, then the next). The younger ones keep their
// 2026 level until then. (Before 2026-11-24 the field was 2026's for ever: Harry Kane, 47, the Ballon d'Or's runner-up.)
const GEN_FIRST = ['Lucas', 'Mateo', 'Luca', 'Noah', 'Rafael', 'João', 'Kai', 'Leon', 'Théo', 'Marco', 'Diego', 'Youssef', 'Ibrahim', 'Bruno', 'Emil', 'Nico', 'Hugo', 'Adam', 'Tomás', 'Rayan', 'Jonas', 'Samuel', 'Elias', 'Enzo', 'Victor', 'Julián', 'Malik', 'Dani']
const GEN_LAST = ['Moreau', 'Brandt', 'Ferreira', 'Okoro', 'Lindqvist', 'Varga', 'Mensah', 'Herrera', 'Dubois', 'Jansen', 'Romano', 'Novak', 'Haddad', 'Petersen', 'Costa', 'Lopes', 'Keller', 'Diallo', 'Sorensen', 'Navas', 'Marchetti', 'Achterberg', 'Ibarra', 'Kourouma', 'Vidal', 'Hartmann', 'Sarr', 'Castillo']
function yearsOn(p, era, team = p.team) {
  const yrs = era?.yrs ?? 0
  if (!yrs) return p
  const age = (p.age ?? 27) + yrs
  if (age < 35) return { ...p, age }
  const gen = Math.floor((age - 35) / 9)
  const r = seeded(`next|${era.world ?? ''}|${team}|${p.name}|${gen}`)
  return { ...p, name: `${GEN_FIRST[Math.floor(r() * GEN_FIRST.length)]} ${GEN_LAST[Math.floor(r() * GEN_LAST.length)]}`, age: 23 + ((age - 35) % 9) + Math.floor(r() * 3), nation: null, gen: true }
}
const POS_BONUS = (pos, size) => (pos === 1 ? 7 : pos === 2 ? 4 : pos <= 4 ? 2.5 : pos <= 7 ? 1 : pos > size - 3 ? -2 : 0)
const EURO_PTS = { ucl: { Winners: 14, Final: 6, 'Semi-finals': 3, 'Quarter-finals': 1 }, uel: { Winners: 5, Final: 2, 'Semi-finals': 1 }, uecl: { Winners: 2 } }
function trophyPts({ league, ucl, uel, uecl, cup }) {
  return (league === 1 ? 8 : 0) + (EURO_PTS.ucl[ucl] ?? 0) + (EURO_PTS.uel[uel] ?? 0) + (EURO_PTS.uecl[uecl] ?? 0) + (cup ? 3 : 0)
}
// a Ballon d'Or case: goals and half the assists (all competitions), and the trophies, weighed by how big a
// part of them he was (a 12-goal striker on a title side gets about a third of the credit, a 35-goal one all of it)
const bdoCase = (goals, assists, trophies, value = 0) => { const own = goals + 0.5 * assists + value; return own + trophies * clamp((own - 10) / 25, 0.2, 1) }
function clubField(world, rand, exclude, mine, era = null) {
  // mine: the build's league goals (his club's other starting striker scores from what's left)
  const field = []
  for (const L of LEAGUES) {
    const lg = world.leagues[L.id]
    const size = lg.table.length
    for (const row of lg.table) {
      const list = (CLUB_STRIKERS.get(row.short) ?? []).filter(p => !exclude.has(p.name)).slice(0, 5).map(p => yearsOn(p, era))
      if (!list.length) continue
      const isU = row.short === world.U
      // (his club: the build scored `mine` of its goals; the others share the rest)
      const taken = isU && row.gf ? clamp((mine ?? 0) / row.gf, 0, 0.7) : 0
      const sc = scorersOf(list, row.gf, lg.games, rand, taken)
      const gl = shareGoals(sc, Math.max(0, row.gf - (isU ? mine ?? 0 : 0)), rand, taken)
      const ucl = world.ucl.reached[row.short] ?? null, uel = world.uel.reached[row.short] ?? null, uecl = world.uecl?.reached[row.short] ?? null
      const euroGf = world.ucl.gf[row.short] ?? world.uel.gf[row.short] ?? world.uecl?.gf[row.short] ?? 0
      const cupWin = world.cups[L.id]?.winner === row.short
      const trophies = trophyPts({ league: row.pos, ucl, uel, uecl, cup: cupWin })
      sc.forEach(({ p, pr, av }, i) => {
        const goals = gl[i]
        const assists = binom(Math.max(0, row.gf - goals), av * p.prof.assist * ROLE[p.role].a * 0.6, rand)
        const euro = binom(euroGf, pr, rand), cup = poisson((cupWin ? 6 : 2.2) * (row.gf / lg.games) * pr * 1.1, rand)
        field.push({
          name: p.name, team: row.short, nation: p.nation ?? null, age: p.age ?? null, lid: L.id, role: p.role, fwd: isForward(p), goals, assists,
          goalsAll: goals + euro + cup, assistsAll: assists + Math.round((euro + cup) * 0.4), value: r1(p.value),
          // (the voters: a seeded opinion on top of the numbers, as the stars get)
          pots: goals + 0.6 * assists + p.value + POS_BONUS(row.pos, size) + 5 * gauss(rand), trophies, vote: 5 * gauss(rand),
        })
      })
    }
  }
  return field
}
// stars: a seeded season around their real level, and their club's year
function clubStars(world, rand, era = null) {
  return STARS_CLUB.map(s0 => {
    const s = yearsOn(s0, era)
    const lg = world.leagues[s.lid], row = lg?.table.find(r => r.short === s.team)
    const pos = row?.pos ?? 10, size = lg?.table.length ?? 20
    const u = s.lvl + 4.5 * gauss(rand)
    const trophies = trophyPts({ league: pos, ucl: world.ucl.reached[s.team], uel: world.uel.reached[s.team], cup: world.cups[s.lid]?.winner === s.team })
    return { name: s.name, team: s.team, nation: s.nation, lid: s.lid, star: true, pots: u + POS_BONUS(pos, size), bdo: u * 1.4 + 5 * gauss(rand) + trophies }
  })
}

// ─── Awards ──────────────────────────────────────────────────────────────────
// Club: the Golden Boot (league goals; a tie is shared), Player of the Season (goals + 0.6 assists + where the
// team finished, against the league's strikers and stars), Team of the Season (a top-two striker that way),
// the European Golden Shoe (league goals x2 for the top five leagues), and the Ballon d'Or (all competitions:
// goals + half the assists, plus trophies: the league 8, the Champions League 14, a final 6, a semi 3, the
// Europa League 5, the cup 3, the Golden Boot 2): 1st wins it, top 3, top 10, a top-30 nomination.
const race = (list, me, key, n = 10) => [...list.map(x => ({ name: x.name, team: x.team, goals: x.goals, assists: x.assists ?? null, isPlayer: false })), { name: null, team: me.team, goals: me[key], assists: me.assists ?? null, isPlayer: true }]
  .sort((a, b) => b.goals - a.goals || (b.assists ?? 0) - (a.assists ?? 0) || (a.isPlayer ? -1 : b.isPlayer ? 1 : 0)).slice(0, n)
function clubAwards(book, me) {
  const lf = book.league
  const maxF = Math.max(0, ...lf.map(x => x.goals))
  const bootWon = me.goals > 0 && me.goals >= maxF
  const bootTop = [...lf].sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0]
  const goldenBoot = { name: book.meta.boot, won: bootWon, shared: bootWon && me.goals === maxF, rank: 1 + lf.filter(x => x.goals > me.goals).length, goals: me.goals,
    winner: bootWon ? { name: null, team: me.team, goals: me.goals, isPlayer: true } : bootTop ? { name: bootTop.name, team: bootTop.team, goals: bootTop.goals, isPlayer: false } : null,
    race: race(lf, me, 'goals') }
  const myPots = me.goals + 0.6 * me.assists + book.posBonus
  const potsField = [...lf, ...(book.leagueMids ?? []), ...book.stars].map(x => ({ name: x.name, team: x.team, s: x.pots }))
  const potsRank = 1 + potsField.filter(x => x.s > myPots).length
  const potsTop = [...potsField].sort((a, b) => b.s - a.s)[0]
  const playerOfSeason = { name: book.meta.poty, won: potsRank === 1, rank: potsRank, winner: potsRank === 1 ? { name: null, team: me.team, isPlayer: true } : potsTop ? { name: potsTop.name, team: potsTop.team, isPlayer: false } : null }
  const teamOfSeason = 1 + lf.filter(x => x.pots > myPots).length <= 2
  const shoe = book.shoe
  const maxS = Math.max(0, ...shoe.map(x => x.goals))
  const shoeTop = [...shoe].sort((a, b) => b.goals - a.goals)[0]
  const goldenShoe = { won: me.goals > 0 && me.goals >= maxS, rank: 1 + shoe.filter(x => x.goals > me.goals).length, goals: me.goals, points: me.goals * 2,
    winner: me.goals >= maxS ? { name: null, team: me.team, goals: me.goals, isPlayer: true } : shoeTop ? { name: shoeTop.name, team: shoeTop.team, goals: shoeTop.goals, isPlayer: false } : null,
    race: race(shoe, me, 'goals') }
  const myBdo = bdoCase(me.goals + me.extraGoals, me.assists + me.extraAssists, book.trophies) + (bootWon ? 2 : 0)
  const bdoField = book.bdo
  const bdoRank = 1 + bdoField.filter(x => x.score > myBdo).length
  const top = [...bdoField.map(x => ({ name: x.name, team: x.team, score: r1(x.score), isPlayer: false })), { name: null, team: me.team, score: r1(myBdo), isPlayer: true }]
    .sort((a, b) => b.score - a.score || (a.isPlayer ? -1 : 1)).slice(0, 10)
  const ballonDor = { rank: bdoRank, finish: bdoRank === 1 ? 'winner' : bdoRank <= 3 ? 'top3' : bdoRank <= 10 ? 'top10' : bdoRank <= 30 ? 'nominated' : null, score: r1(myBdo), winner: top[0], top }
  return { goldenBoot, playerOfSeason, teamOfSeason, goldenShoe, ballonDor, mvp: playerOfSeason.won, dpoy: false }
}
// World Cup: the Golden Boot (goals, then assists, then fewer minutes), the Golden Ball (3 a goal, 2 an assist,
// plus how far the side went: winners 10, runners-up 7, third 5, fourth 4, a quarter-final 2, the last 16 1,
// out in the groups -2), Best Young Player (born in 2005 or later: 21 or under).
const STAGE_PTS = { Winners: 10, 'Runners-up': 7, 'Third place': 5, 'Fourth place': 4, 'Semi-finals': 4, 'Quarter-finals': 2, 'Round of 16': 1, 'Round of 32': 0, 'Group stage': -2 }
function wcAwards(book, me) {
  const bf = book.boot
  const better = x => x.goals > me.goals || (x.goals === me.goals && (x.assists > me.assists || (x.assists === me.assists && x.mins < me.mins)))
  const bootRank = 1 + bf.filter(better).length
  const bootTop = [...bf].sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.mins - b.mins)[0]
  const goldenBoot = { name: 'Golden Boot', won: me.goals > 0 && bootRank === 1, rank: bootRank, goals: me.goals,
    winner: me.goals > 0 && bootRank === 1 ? { name: null, team: me.team, goals: me.goals, isPlayer: true } : bootTop ? { name: bootTop.name, team: bootTop.team, goals: bootTop.goals, isPlayer: false } : null,
    race: race(bf, me, 'goals') }
  const mine = 3 * me.goals + 2 * me.assists + (STAGE_PTS[me.finish] ?? 0)
  const ball = book.ball
  const ballRank = 1 + ball.filter(x => x.score > mine).length
  const ballTop = [...ball].sort((a, b) => b.score - a.score)[0]
  const goldenBall = { won: ballRank === 1, rank: ballRank, medal: ['Golden Ball', 'Silver Ball', 'Bronze Ball'][ballRank - 1] ?? null, score: r1(mine),
    winner: ballRank === 1 ? { name: null, team: me.team, isPlayer: true } : ballTop ? { name: ballTop.name, team: ballTop.team, isPlayer: false } : null }
  const young = book.young
  const yRank = me.eligible ? 1 + young.filter(x => x.score > mine).length : null
  const yTop = [...young].sort((a, b) => b.score - a.score)[0]
  const bestYoungPlayer = { eligible: !!me.eligible, won: !!me.eligible && yRank === 1, rank: yRank,
    winner: me.eligible && yRank === 1 ? { name: null, team: me.team, isPlayer: true } : yTop ? { name: yTop.name, team: yTop.team, isPlayer: false } : null }
  return { goldenBoot, goldenBall, bestYoungPlayer, mvp: goldenBall.won, dpoy: false }
}
// The awards again from new totals (the director's spliced season): { goals, assists, mins } as played
export function soccerAwards(result, totals = {}) {
  if (!result?.book) return null
  const b = result.book
  if (result.mode === 'alltime') return wcAwards(b, { ...b.me, goals: totals.goals ?? b.me.goals, assists: totals.assists ?? b.me.assists, mins: totals.mins ?? b.me.mins })
  if (b.comp === 'ucl') return uclAwards(b, { ...b.me, goals: totals.goals ?? b.me.goals, assists: totals.assists ?? b.me.assists, mins: totals.mins ?? b.me.mins, finish: result.finish ?? b.me.finish })
  const goals = totals.goals ?? b.me.goals, assists = totals.assists ?? b.me.assists
  return clubAwards(b, { ...b.me, goals, assists })
}

// ─── Season archetypes ───────────────────────────────────────────────────────
export function getSoccerArchetype(ovr, build, types = SOCCER_TRAITS) {
  const filled = types.filter(t => build?.[t])
  if (!filled.length) return 'Spin to start building'
  const rem = types.length - filled.length
  if (rem > 0) return `${rem} attribute${rem !== 1 ? 's' : ''} remaining`
  const g = t => build[t]?.val ?? 0
  const fin = g('finishing'), sp = g('shotPower'), hd = g('heading'), dr = g('dribbling')
  const lu = g('passing'), pa = g('pace'), st = g('size'), ob = g('positioning'), co = g('composure')
  const vals = filled.map(t => build[t].val ?? 0)
  const spread = Math.max(...vals) - Math.min(...vals), mean = avg(vals)
  // (lu: passing, st: size, ob: positioning; dribbling carries ball control and first touch)
  const ranked = [['fin', fin], ['sp', sp], ['hd', hd], ['dr', dr], ['lu', lu], ['pa', pa], ['st', st], ['ob', ob], ['co', co]].sort((a, b) => b[1] - a[1])
  const t1 = ranked[0][0], t2 = ranked[1][0], t3 = ranked[2][0]
  const top = k => t1 === k || t2 === k, top3 = k => top(k) || t3 === k, peak = k => t1 === k
  const complete = (spread <= 2 && mean >= 7.5) || vals.filter(v => v >= 8).length >= 7
  const poacher = ((top('fin') && top3('ob')) || (top('ob') && top3('fin'))) && !peak('pa')
  const fox = poacher && pa <= 6
  const target = top3('hd') && top3('st')
  const falseNine = top('lu') && top3('dr')
  const deep = top('lu') && (top3('st') || top3('co'))
  const runner = top('pa') && top3('ob')
  const advanced = top('pa') && top3('fin')
  const iceCold = top('co') && top3('fin')
  const holdUp = top('st') && top3('dr')
  const second = top('dr') && top3('fin')
  const balanced = spread <= 1
  if (ovr >= 95) {
    if (complete) return 'Generational Number 9'
    if (poacher) return 'Ruthless Goal Machine'
    if (target) return 'Unplayable Target Man'
    if (falseNine) return 'Maestro False Nine'
    if (runner || advanced) return 'Devastating Runner in Behind'
    if (iceCold) return 'Ice-Cold Finisher'
    return 'World-Class Striker'
  }
  if (ovr >= 90) {
    if (complete) return 'Complete Forward'
    if (fox) return 'Elite Fox in the Box'
    if (poacher) return 'Elite Poacher'
    if (iceCold) return 'Ice-Cold Finisher'
    if (target) return 'Elite Target Man'
    if (falseNine) return 'False Nine'
    if (runner) return 'Runner in Behind'
    if (advanced) return 'Advanced Forward'
    if (second) return 'Second Striker'
    if (peak('dr')) return 'Dribbling Forward'
    return 'Elite Striker'
  }
  if (ovr >= 84) {
    if (complete) return 'All-Round Forward'
    if (fox) return 'Fox in the Box'
    if (poacher) return 'Poacher'
    if (target) return 'Target Man'
    if (peak('hd')) return 'Aerial Threat'
    if (falseNine) return 'False Nine'
    if (deep) return 'Deep-Lying Forward'
    if (second) return 'Second Striker'
    if (runner) return 'Runner in Behind'
    if (peak('pa')) return 'Pace Merchant'
    if (peak('dr')) return 'Dribbling Forward'
    if (peak('sp')) return 'Long-Range Threat'
    if (holdUp) return 'Hold-Up Striker'
    if (iceCold) return 'Ice-Cold Finisher'
    return 'Starting Striker'
  }
  if (ovr >= 76) {
    if (balanced) return 'Versatile Forward'
    if (poacher) return 'Penalty-Box Striker'
    if (target) return 'Big Man Up Top'
    if (falseNine || deep) return 'Link-Up Forward'
    if (peak('pa')) return 'Pace Merchant'
    if (peak('dr')) return 'Tricky Forward'
    if (peak('st')) return 'Battering Ram'
    if (peak('sp')) return 'Shooter from Distance'
    if (holdUp) return 'Hold-Up Striker'
    if (peak('hd')) return 'Aerial Threat'
    return 'Squad Striker'
  }
  if (ovr >= 68) {
    if (balanced) return 'Utility Forward'
    if (poacher) return 'Goal Hanger'
    if (target) return 'Old-Fashioned Number 9'
    if (peak('pa')) return 'Impact Sub'
    if (peak('st')) return 'Workhorse Forward'
    return 'Backup Striker'
  }
  return 'Second-Tier Striker'
}

// ─── Putting a season together ───────────────────────────────────────────────
const clubName = s => CLUB_BY.get(s)?.name ?? EXTRA_BY.get(s)?.name ?? T2_INFO.get(s)?.name ?? LOWER_INFO.get(s)?.name ?? Object.values(LOWER_CLUBS).flat().find(e => e.short === s)?.name ?? s
const nationName = s => NATION_BY.get(s)?.name ?? s
function resolveClub(team) {
  return CLUB_BY.get(team?.short) ?? CLUBS.find(c => c.name === team?.name) ?? CLUBS[0]
}
function resolveNation(team) {
  return NATION_BY.get(team?.short) ?? NATION_BY.get(team?.nation) ?? NATIONS.find(n => n.name === team?.name) ?? NATIONS[0]
}
// the ratings a side plays the season at
function ratingsOf(src, team, mode, tr) {
  if (tr) return { att: tr.att ?? tr.off ?? src.att, def: tr.def ?? src.def }
  const s = scaleOf(mode)
  if (team?.career) return soccerTeamFrom10(team.off, team.def, mode)
  return { att: src.att + (team?.offMod ?? 0) * s.sA, def: src.def + (team?.defMod ?? 0) * s.sD }
}
// the season's goals-a-game for his side (his share is set against it)
function lamAvgOf(U, uRate, lid) {
  const lb = LEAGUE_BASE.get(lid)
  const opp = clubsOf(lid).filter(c => c.short !== U)
  if (!lb || !opp.length) return LAM_REF
  return avg(opp.map(o => lb.base * Math.exp(aT(uRate.att - lb.mA) - dT(o.def - lb.mD)) * Math.cosh(H_DOM)))
}
function buildAge(build, team) {
  if (team?.age != null) return team.age
  const ages = SOCCER_TRAITS.map(t => build?.[t]).filter(Boolean).map(c => c.age ?? [...(WC_STRIKERS ?? []), ...(SOCCER_STRIKERS ?? [])].find(p => p.name === (c.qbFull ?? c.name))?.age).filter(a => typeof a === 'number')
  return ages.length ? Math.round(avg(ages)) : null
}
function tieOf(legs, comp) {
  const last = legs[legs.length - 1]
  const agg = legs.length > 1 ? [legs.reduce((s, g) => s + g.mySc, 0), legs.reduce((s, g) => s + g.oppSc, 0)] : null
  return { type: 'tie', comp, name: last.round, roundIndex: last.ri ?? 0, opponent: { short: last.opponent, name: last.oppName, extra: last.oppExtra }, legs, agg, won: last.through ?? !!last.won, et: last.et, shootout: last.shootout, final: last.round === 'Final' }
}
const scoreLine = g => (g ? `${g.mySc}-${g.oppSc}${g.shootout ? ` (${g.shootout.my}-${g.shootout.opp} pens)` : g.et ? ' a.e.t.' : ''}` : null)

function clubSeason(build, types, team, base, gameMode, script) {
  const club = resolveClub(team)
  const L = leagueOfClub(club)
  const meta = LEAGUE_META[L.key]
  const U = club.short
  const prof = profileOfBuild(build)
  const ovr = calcSoccerOVR(build, types)
  const mates = CLUB_STRIKERS.get(U) ?? []
  let world
  if (script) world = script.world
  const uRate = world ? world.uRate : ratingsOf(club, team, 'current', null)
  const lamAvg = lamAvgOf(U, uRate, L.id)
  const S = strikerSide({ build, prof, team, mates, lamAvg, base, script: !!script })
  // (Career: his club is in the second tier this season)
  const T2 = !script && team?.tier2 ? TIER2[L.key] : null
  if (!world) {
    const place = team?.lastPos ?? lastPlace(club)
    // (where he plays in Europe: what the team says, else what last season's place gives, else 2026-27's real draw)
    const uComp = T2 ? null : team?.europe !== undefined ? team.europe : team?.lastPos != null ? (place <= meta.ucl ? 'ucl' : place <= meta.ucl + meta.uel ? 'uel' : null) : EUROPE_2026[U] ?? null
    world = clubWorld({ U, uRate, uComp, uPlace: place, hook: hookFor(S, base), rand: stream(base, 'world'), tier2: !!T2, sched: team?.sched ?? null, places: !!team?.career, world: team?.pyramid ?? null })
  } else {
    // a script's season: his minutes are planned now, from his own streams, match by match in each competition
    const plan = hookFor(S, base)
    world = { ...world, fixtures: world.fixtures.map(fx => { const h = plan({ comp: fx.comp, wk: fx.wk, kind: fx.kind ?? fx.comp }); return { ...fx, plan: h.plan, mult: 1, etMult: 1 } }) }
  }
  // his lines, competition by competition, in date order
  const lineSt = {}
  const nameOf = clubName
  const fx = world.fixtures.map((f, i) => ({ f, i })).sort((a, b) => a.f.wk - b.f.wk || a.i - b.i).map(x => x.f)
  const all = fx.map((f, k) => matchOf(f, lineFor((lineSt[f.comp] ??= stream(base, `line:${f.comp}`)), S, f), nameOf, k + 1))
  all.forEach((m, k) => { if (fx[k].ri != null) m.ri = fx[k].ri })
  const games = all.filter(m => m.comp === 'league').map((m, i) => ({ ...m, g: i + 1, wk: i + 1 }))
  const cupGames = all.filter(m => m.comp === 'cup')
  const euroGames = all.filter(m => m.comp === 'ucl' || m.comp === 'uel' || m.comp === 'uecl')
  const t = totalsOf(games)
  const tAll = totalsOf(all)
  // the table, the cup, Europe
  const lg = world.leagues[T2 ? T2.id : L.id]
  const row = lg.table.find(r => r.short === U)
  const pos = row.pos, size = lg.table.length
  const champion = pos === 1
  const cup = world.cups[L.id]
  const ties = []
  const groupTies = (list, comp) => {
    const out = []
    let cur = []
    for (const m of list) {
      if (m.round?.startsWith('League phase')) continue
      if (m.leg === 2 && cur.length && cur[0].leg === 1) { cur.push(m); out.push(tieOf(cur, comp)); cur = []; continue }
      if (m.leg === 1) { cur = [m]; continue }
      out.push(tieOf([m], comp))
    }
    return out
  }
  const cupTies = groupTies(cupGames, 'cup')
  const uComp = world.uComp
  const E = uComp ? world[uComp] : null
  const euroTies = E ? groupTies(euroGames, uComp) : []
  for (const x of [...cupTies, ...euroTies]) ties.push(x)
  ties.sort((a, b) => a.legs[a.legs.length - 1].wk - b.legs[b.legs.length - 1].wk)
  const europe = E ? {
    comp: uComp, name: E.name, table: E.table, position: E.table.find(r => r.short === U)?.pos ?? null,
    games: euroGames.filter(m => m.round?.startsWith('League phase')), rounds: euroTies, result: E.reached[U] === 'Final' ? 'Runners-up' : E.reached[U], champion: E.winner === U, winner: E.winner,
  } : null
  const euroFinal = euroTies.find(x => x.final)?.legs[0] ?? null
  const trophies = [...(champion ? [LEAGUE_NAME[L.key] ?? L.name] : []), ...(cup.champion ? [cup.name] : []), ...(europe?.champion ? [europe.name] : [])]
  // (next season: the league place and the cup, europePlaces; a European title sends him up: the Champions League for
  // the Champions League's and the Europa League's winners, the Europa League for the Conference League's)
  // (the European Performance Spots for next season: the two countries whose clubs did best in Europe this one)
  const eps = world.ucl ? epsOf(world) : DEFAULT_EPS
  const places = T2 ? {} : europePlaces(L.key, lg.table, cup.winner, eps)
  const qualified = europe?.champion ? (uComp === 'uecl' ? (places[U] === 'ucl' ? 'ucl' : 'uel') : 'ucl') : places[U] ?? null
  // the award field
  const fr = stream(base, 'field')
  const exclude = new Set(script ? mates.filter(p => p.role === 'ST').map(p => p.name) : S.replaced ? [S.replaced.name] : [])
  const era = team?.yrs ? { yrs: team.yrs, world: team.world ?? '' } : null
  const field = script?.field ?? clubField(world, fr, exclude, t.goals, era)
  const stars = script?.stars ?? clubStars(world, stream(base, 'stars'), era)
  const book = {
    meta: { boot: meta.boot, poty: meta.poty },
    league: field.filter(x => x.lid === L.id && x.fwd).map(x => ({ name: x.name, team: x.team, goals: x.goals, assists: x.assists, pots: r1(x.pots) })),
    leagueMids: field.filter(x => x.lid === L.id && !x.fwd).map(x => ({ name: x.name, team: x.team, pots: r1(x.pots) })),
    stars: stars.filter(x => x.lid === L.id).map(x => ({ name: x.name, team: x.team, pots: r1(x.pots) })),
    shoe: field.filter(x => x.fwd).map(x => ({ name: x.name, team: x.team, lid: x.lid, goals: x.goals })),
    bdo: [...field.map(x => ({ name: x.name, team: x.team, score: bdoCase(x.goalsAll, x.assistsAll, x.trophies, x.value * 1.4) + (x.vote ?? 0) })), ...stars.map(x => ({ name: x.name, team: x.team, score: x.bdo }))],
    posBonus: T2 ? 0 : POS_BONUS(pos, size),
    trophies: trophyPts({ league: T2 ? 99 : pos, ucl: uComp === 'ucl' ? E.reached[U] : null, uel: uComp === 'uel' ? E.reached[U] : null, uecl: uComp === 'uecl' ? E.reached[U] : null, cup: cup.champion }),
    me: { team: U, goals: t.goals, assists: t.assists, extraGoals: tAll.goals - t.goals, extraAssists: tAll.assists - t.assists },
  }
  // (a field striker's Golden Boot counts in his own Ballon d'Or score)
  const top = new Map(LEAGUES.map(l2 => [l2.id, l2.id === L.id ? t.goals : 0]))
  for (const x of field) if (x.fwd) top.set(x.lid, Math.max(top.get(x.lid) ?? 0, x.goals))
  field.forEach((x, i) => { if (x.fwd && x.goals > 0 && x.goals === top.get(x.lid)) book.bdo[i].score += 2 })
  for (const x of book.bdo) x.score = r1(x.score)
  // (only the ranks that can matter are kept: the Golden Shoe's top 30, the Ballon d'Or's top 40)
  book.shoe = book.shoe.sort((a, b) => b.goals - a.goals).slice(0, 30)
  book.bdo = book.bdo.sort((a, b) => b.score - a.score).slice(0, 40)
  const awards = clubAwards(book, book.me)
  const byComp = { league: t, cup: totalsOf(cupGames), europe: totalsOf(euroGames) }
  return {
    sport: 'soccer', mode: 'current', position: 'st', gameMode, season: SEASON,
    ovr, archetype: getSoccerArchetype(ovr, build, types),
    team: { ...club, ...(team ?? {}), att: r1(uRate.att), def: r1(uRate.def) },
    league: T2 ? { id: T2.id, name: T2.name, short: T2.short, country: L.country, cup: meta.cup, boot: 'Golden Boot', poty: 'Player of the Season', size, games: lg.games, tier: 2, up: T2.up, playoffTo: T2.playoffTo }
      : { id: L.id, name: L.name, short: L.short, country: L.country, cup: meta.cup, boot: meta.boot, poty: meta.poty, size, games: lg.games },
    // (the play-offs: Career plays them, lib/careerSoccer.js promoRounds)
    ...(T2 ? { promoted: pos <= T2.up, promotedHow: pos <= T2.up ? 'auto' : null } : {}),
    wins: row.wins, draws: row.draws, losses: row.losses, points: row.points, gf: row.gf, ga: row.ga, gd: row.gd,
    seed: pos, conference: L.id, standings: lg.table, form: lg.form ?? null, champion,
    madePlayoffs: qualified === 'ucl', playoffs: qualified === 'ucl',
    playoffRounds: ties, games, gameLog: games.map(g => g.result), bestGame: bestOf(games),
    finalsOpp: euroFinal?.opponent ?? null, finalsSeries: scoreLine(euroFinal),
    ...t, ...seasonFields(t), allComps: tAll, byComp, fixtures: all,
    cup: { name: cup.name, rounds: cupTies, result: cup.result, champion: cup.champion, winner: cup.winner },
    europe, trophies: T2 ? trophies.filter(x => x !== (LEAGUE_NAME[L.key] ?? L.name)) : trophies, qualified, relegated: !T2 && pos > size - meta.down, relegationPlayoff: !T2 && meta.playoff && pos === size - meta.down,
    otherLeagues: Object.fromEntries(Object.entries(world.leagues).filter(([id]) => id !== L.id).map(([id, x]) => [id, { champion: x.table[0]?.short, top: x.table.slice(0, 4) }])),
    // (Career: where every club in the other leagues stands when the January window opens: { [short]: place })
    ...(team?.career ? { places: Object.assign({}, ...Object.values(world.leagues).map(x => x.jan ?? {})) } : {}),
    europeWinners: { ucl: world.ucl.winner, uel: world.uel.winner, uecl: world.uecl?.winner ?? null },
    // (Career: what next season is made of. Every top flight's final order, each cup's winner, the European
    // Performance Spots, the clubs from outside the data with their names)
    next: { tables: Object.fromEntries(LEAGUES.map(l => [l.id, world.leagues[l.id].table.map(r => r.short)])), cups: Object.fromEntries(Object.entries(world.cups).map(([id, x]) => [id, x.winner])), eps, finalists: { ucl: world.ucl.finalist, uel: world.uel.finalist, uecl: world.uecl?.finalist ?? null } },
    ...awards, book,
  }
}

function wcSeason(build, types, team, base, gameMode, script) {
  const nat = resolveNation(team)
  const U = nat.short
  const prof = profileOfBuild(build)
  const ovr = calcSoccerOVR(build, types)
  const mates = NATION_STRIKERS.get(U) ?? []
  let world = script?.world ?? null
  const uRate = world ? world.uRate : ratingsOf(nat, team, 'alltime', null)
  const lamAvg = clamp(WC_BASE * Math.exp(waT(uRate.att - W_ATT)), 0.5, 3.5)
  const S = strikerSide({ build, prof, team, mates, lamAvg, base, script: !!script })
  if (!world) world = (FIELD?.format?.groups ? contWorld : wcWorld)({ U, uRate, hook: hookFor(S, base), rand: stream(base, 'world'), G: FIELD?.format?.groups })
  else { const plan = hookFor(S, base); world = { ...world, fixtures: world.fixtures.map(fx => ({ ...fx, plan: plan({ comp: 'wc', wk: fx.wk, kind: 'wc' }).plan, mult: 1, etMult: 1 })) } }
  const ls = stream(base, 'line:wc')
  const games = world.fixtures.slice().sort((a, b) => a.wk - b.wk).map((f, k) => ({ ...matchOf(f, lineFor(ls, S, f), nationName, k + 1), stage: f.stage }))
  const t = totalsOf(games)
  const group = Object.keys(world.groups).find(l => world.groups[l].some(r => r.short === U))
  const table = world.groups[group]
  const row = table.find(r => r.short === U)
  const finish = world.reached[U]
  const kos = games.filter(g => g.stage !== 'group').map(g => tieOf([g], 'wc'))
  const fin = games.find(g => g.stage === 'final') ?? null
  // the field: every nation's players, a share of their side's tournament goals by role (the Golden Boot:
  // forwards only; the Golden Ball and Best Young Player: everyone, a midfielder's game counted too)
  const fr = stream(base, 'field')
  const exclude = new Set(script ? mates.filter(p => p.role === 'ST').map(p => p.name) : mates[0] ? [mates[0].name] : [])
  const field = script?.field ?? (() => {
    const out = []
    for (const n of NATIONS) {
      const list = (NATION_STRIKERS.get(n.short) ?? []).filter(p => !exclude.has(p.name)).slice(0, 5)
      if (!list.length) continue
      const gfAll = world.gf[n.short], mt = world.matches[n.short]
      const taken = n.short === U && gfAll ? clamp(t.goals / gfAll, 0, 0.7) : 0
      // (internationals: the best players are fit and picked more often than at a club)
      const sc = scorersOf(list, gfAll, mt, fr, taken).map(x => { const avW = clamp(x.av + 0.05, 0.4, 0.98); return { ...x, pr: x.pr * avW / x.av, avW } })
      const gl = shareGoals(sc, Math.max(0, gfAll - (n.short === U ? t.goals : 0)), fr, taken)
      sc.forEach(({ p, avW }, i) => {
        const goals = gl[i]
        const assists = binom(Math.max(0, gfAll - goals), avW * p.prof.assist * ROLE[p.role].a * 0.6, fr)
        out.push({ name: p.name, team: n.short, age: p.age ?? null, fwd: isForward(p), goals, assists, mins: Math.round(mt * 84 * avW), score: 3 * goals + 2 * assists + p.value * 0.6 + (STAGE_PTS[world.reached[n.short]] ?? 0) + 2.5 * gauss(fr) })
      })
    }
    return out
  })()
  const sr = stream(base, 'stars')
  const stars = script?.stars ?? STARS_WC.map(s => ({ name: s.name, team: s.team, age: s.age, score: s.lvl + (STAGE_PTS[world.reached[s.team]] ?? 0) + 3 * gauss(sr) }))
  const age = buildAge(build, team)
  const book = {
    boot: field.filter(x => x.fwd !== false).map(x => ({ name: x.name, team: x.team, goals: x.goals, assists: x.assists, mins: x.mins })),
    ball: [...field.map(x => ({ name: x.name, team: x.team, score: x.score })), ...stars.map(x => ({ name: x.name, team: x.team, score: x.score }))],
    young: [...field.filter(x => x.age != null && x.age <= 21), ...stars.filter(x => x.age != null && x.age <= 21)].map(x => ({ name: x.name, team: x.team, score: x.score })),
    me: { team: U, goals: t.goals, assists: t.assists, mins: t.mins, finish, eligible: age != null && age <= 21, age },
  }
  const awards = wcAwards(book, book.me)
  return {
    sport: 'soccer', mode: 'alltime', position: 'st', gameMode, season: WC_KEY === 'wc2026' ? '2026' : FIELD?.label ?? 'All-Time', wcField: WC_KEY,
    ovr, archetype: getSoccerArchetype(ovr, build, types),
    team: { ...nat, ...(team ?? {}), field: undefined, att: r1(uRate.att), def: r1(uRate.def) },
    wins: row.wins, draws: row.draws, losses: row.losses, points: row.points, gf: row.gf, ga: row.ga, gd: row.gd,
    seed: row.pos, conference: group, standings: table, groups: world.groups, bracket: world.bracket, groupGames: world.groupGames?.[group] ?? null,
    champion: finish === 'Winners', madePlayoffs: finish !== 'Group stage', playoffs: finish !== 'Group stage', finish,
    playoffRounds: kos, games, gameLog: games.map(g => g.result), bestGame: bestOf(games), fixtures: games,
    finalsOpp: fin?.opponent ?? null, finalsSeries: scoreLine(fin),
    ...t, ...seasonFields(t), allComps: t, trophies: finish === 'Winners' ? ['World Cup'] : [],
    worldChampion: world.champion,
    ...awards, book,
  }
}

// ─── The Champions League: a build's season (mode 'current') ─────────────────
// Since 2026-11-16 the season a build plays is his club's 2026-27 Champions League campaign. The domestic season
// above (clubSeason) is Career's and Squad Builder's (team.career, team.squad, a script, or team.domestic: true).
// The format (UEFA's, since 2024-25):
//   League phase: 36 clubs in four pots of nine by coefficient. Each club plays eight different opponents, two
//     from each pot (its own included), one at home and one away, so four at home and four away; no opponent from
//     its own country and no more than two from any one country (where the draw allows it).
//   The table: points, then goal difference, goals scored, away goals scored, wins, away wins, then the points,
//     goal difference and goals of the clubs it played, then the coefficient (UEFA's order, without the
//     disciplinary points).
//   1st-8th go straight to the Round of 16, 9th-24th play two-legged knockout play-offs, 25th-36th are out.
//   Play-offs, seeded: 9th/10th against 23rd/24th, 11th/12th against 21st/22nd, 13th/14th against 19th/20th,
//     15th/16th against 17th/18th (which of the two drawn). Round of 16: the winners meet 7th/8th, 5th/6th,
//     3rd/4th and 1st/2nd in the same way. The bracket is fixed from there: 1st and 2nd go into opposite halves
//     (likewise 3rd/4th, 5th/6th, 7th/8th); a quarter-final is the 1/2 path against the 7/8 path, or the 3/4 path
//     against the 5/6 path. Every tie is two legs, the club placed higher in the league phase at home in the
//     second; level on aggregate, extra time, then penalties (no away goals). The final is one match.
// The 36 and the pots: the 2026-27 league phase draw (Monaco, 27 August 2026; si.com "Confirmed League Phase
// Pots", every club's opponents on renderfoot.com agree). Each pot is in UEFA's listed order, read as its
// coefficient order. The clubs themselves (names, colours, att/def) are data/soccer-clubs.js's: every one of the 36
// is in that file (UCL_SHORTS there, the same 36; the Serie A, Ligue 1 and outside-the-five clubs too, switched off
// for Career), so this list only holds each club's pot, its place in the pot and its country (for the draw).
// A build at a club that isn't one of the 36 takes the place of his country's lowest-ranked entrant (or the last of
// pot 4), in that pot.
// Every match is played from the goal model above (EURO_BASE, H_EURO): the whole league phase, the table and the
// bracket are complete. His line is drawn from his club's scores as everywhere else.
// The result (a club season's contract, read for the Champions League):
//   comp: 'ucl', league: { id: 'ucl', name: 'Champions League', … size 36, games 8 }, finish: 'Winners' | 'Runners-up' |
//   'Semi-finals' | 'Quarter-finals' | 'Round of 16' | 'Knockout play-offs' | 'League phase' (where the run ended),
//   wins/draws/losses/points/gf/ga/gd and seed: the league phase; standings: its 36 rows (+ pot, extra: no logo,
//   reached); games: his eight league phase matches (stage 'md', md 1-8); playoffRounds: his ties; fixtures: every
//   match he played (stage 'md' | 'po' | 'r16' | 'qf' | 'sf' | 'final'); the striker's totals (goals …) are the
//   whole campaign's (allComps the same; byComp: { leaguePhase, knockouts }); champion: won it; madePlayoffs /
//   playoffs: in the top 24; bracket: { po, r16, qf, sf, final: [tie] } in bracket order, tie = { stage, a (first-leg
//   host), b, seedA, seedB, legs: [[home goals, away goals]…], sa, sb (aggregate), et, pens: [a, b] | null, winner };
//   leaguePhase: all 144 matches [home, away, hs, as]; uclWinner, uclRunnerUp; trophies ['Champions League'] or [];
//   the awards: goldenBoot (UEFA's top scorer: name 'Top Scorer'), playerOfSeason ({ … top }), youngPlayer
//   ({ eligible, won, winner }), teamOfSeason; goldenShoe and ballonDor null (no league season); cup null.
//   team.comp 'ucl' (the story cards read it), team.inPlaceOf: the entrant a club outside the 36 replaced.
const UCL_POTS = [
  // [code (data/soccer-clubs.js), country]
  [['PSG', 'FRA'], ['FCB', 'GER'], ['RMA', 'ESP'], ['LIV', 'ENG'], ['INT', 'ITA'], ['MCI', 'ENG'], ['ARS', 'ENG'], ['BAR', 'ESP'], ['ATM', 'ESP']],
  [['BVB', 'GER'], ['ROM', 'ITA'], ['SPO', 'POR'], ['AVL', 'ENG'], ['FCP', 'POR'], ['MUN', 'ENG'], ['CLB', 'BEL'], ['BET', 'ESP'], ['PSV', 'NED']],
  [['FEY', 'NED'], ['LIL', 'FRA'], ['BOD', 'NOR'], ['NAP', 'ITA'], ['RBL', 'GER'], ['VIL', 'ESP'], ['FEN', 'TUR'], ['SHA', 'UKR'], ['GAL', 'TUR']],
  [['SLA', 'CZE'], ['SBR', 'SVK'], ['VFB', 'GER'], ['AEK', 'GRE'], ['LSK', 'AUT'], ['COM', 'ITA'], ['RCL', 'FRA'], ['VIK', 'NOR'], ['SAB', 'AZE']],
]
const ALL_CLUB_BY = new Map((SOCCER_ALL_CLUBS ?? []).map(c => [c.short, c]))
const keyOf = s => norm(s).replace(/[^a-z0-9]/g, '')
// (a club missing from the data, never the case on 11-16: the data's average, no logo)
const UCL_BASE = UCL_POTS.flatMap((pot, p) => pot.map(([code, country], i) => {
  const d = ALL_CLUB_BY.get(code)
  return { canon: d?.name ?? code, short: code, name: d?.name ?? code, country, pot: p + 1, rank: p * 9 + i + 1, att: Number(d?.att) || G_ATT, def: Number(d?.def) || G_DEF, color: d?.color ?? null, color2: d?.color2 ?? null, inData: !!d, logo: !!d }
}))
// the 36 with his club in: an entrant, or in the place of one (see above)
function uclEntrants(team) {
  const club = CLUB_BY.get(team?.short) ?? CLUBS.find(c => c.name === team?.name) ?? null
  const hit = UCL_BASE.find(e => e.short === team?.short) ?? (club ? UCL_BASE.find(e => e.short === club.short || keyOf(e.name) === keyOf(club.name)) : null)
    ?? UCL_BASE.find(e => team?.name && keyOf(e.name) === keyOf(team.name))
  if (hit) return { entrants: UCL_BASE, me: hit, src: club ?? hit }
  const src = club ?? CLUBS[0]
  const same = UCL_BASE.filter(e => e.country === src.country)
  const out = (same.length ? same : UCL_BASE.filter(e => e.pot === 4)).reduce((a, b) => (b.rank > a.rank ? b : a))
  const me = { canon: src.name, short: src.short, name: src.name, country: src.country, pot: out.pot, rank: out.rank, att: src.att, def: src.def, color: src.color ?? null, color2: src.color2 ?? null, inData: true, logo: true, wildcard: out.short }
  return { entrants: UCL_BASE.map(e => (e === out ? me : e)), me, src }
}
export const UCL_CLUBS = UCL_BASE.map(({ canon, short, name, country, pot, rank, inData, logo }) => ({ canon, short, name, country, pot, rank, inData, logo }))
const UCL_LEAGUE = { id: 'ucl', name: 'Champions League', short: 'UCL', country: 'Europe', boot: 'Top Scorer', poty: 'Player of the Season', size: 36, games: 8 }
export const isUclResult = r => r?.comp === 'ucl' || r?.league?.id === 'ucl'
const UCL_ROUNDS = ['Knockout play-off', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final']
const UCL_STAGES = ['po', 'r16', 'qf', 'sf', 'final']
const UCL_REACHED = ['Knockout play-offs', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Runners-up']

// The draw: within a pot, a ring (each club at home to the next, away at the one before); between two pots, two
// matchings that never pair the same two clubs (one sends pot i's clubs home, the other away). Same-country
// meetings, and a third opponent from one country, are drawn again (up to 60 draws: the best is kept).
function uclDraw(pots, rand) {
  let best = null, bestBad = Infinity
  for (let att = 0; att < 60 && bestBad > 0; att++) {
    const games = []
    // (each club's opponents by country so far: a pairing that would make a third, or a same-country one, clashes)
    const cnt = new Map()
    const n = (x, c) => cnt.get(`${x.short}|${c}`) ?? 0
    const clash = (x, y) => x.country === y.country || n(x, y.country) >= 2 || n(y, x.country) >= 2
    const meet = (x, y) => { cnt.set(`${x.short}|${y.country}`, n(x, y.country) + 1); cnt.set(`${y.short}|${x.country}`, n(y, x.country) + 1) }
    for (let i = 0; i < 4; i++) {
      let ord = null
      for (let t = 0; t < 300 && !ord; t++) { const o = shuffle(pots[i], rand); if (o.every((x, k) => !clash(x, o[(k + 1) % o.length]))) ord = o }
      ord = ord ?? shuffle(pots[i], rand)
      ord.forEach((x, k) => { const y = ord[(k + 1) % ord.length]; games.push([x.short, y.short]); meet(x, y) })
    }
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const sig = matchPerm(pots[i], pots[j], rand, null, clash)
        pots[i].forEach((x, k) => meet(x, pots[j][sig[k]]))
        const tau = matchPerm(pots[i], pots[j], rand, sig, clash)
        pots[i].forEach((x, k) => { games.push([x.short, pots[j][sig[k]].short]); games.push([pots[j][tau[k]].short, x.short]); meet(x, pots[j][tau[k]]) })
      }
    }
    const ctry = new Map(pots.flat().map(e => [e.short, e.country]))
    const seen = new Map()
    let bad = 0
    for (const [h, a] of games) {
      if (ctry.get(h) === ctry.get(a)) bad += 10
      for (const [x, y] of [[h, a], [a, h]]) { const k = `${x}|${ctry.get(y)}`; const n = (seen.get(k) ?? 0) + 1; seen.set(k, n); if (n > 2) bad++ }
    }
    if (bad < bestBad) { best = games; bestBad = bad }
  }
  return best
}
const uclOrder = (x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || y.awayGf - x.awayGf || y.wins - x.wins || y.awayWins - x.awayWins
  || y.oppPts - x.oppPts || y.oppGd - x.oppGd || y.oppGf - x.oppGf || x.rank - y.rank
const UCL_WEEKS = EURO_WEEKS

function uclWorld({ U, uRate, entrants, hook, rand, drawRand, koRand }) {
  const out = []
  const E = new Map(entrants.map(e => [e.short, e]))
  const rate = s => (s === U ? uRate : E.get(s) ?? { att: G_ATT, def: G_DEF })
  const W = makeWorld({ rand, hook, U, rate, base: EURO_BASE, mA: G_ATT, mD: G_DEF, kA: K_ATT, kD: K_DEF, H: H_EURO, out })
  const pots = [1, 2, 3, 4].map(p => entrants.filter(e => e.pot === p))
  const draw = uclDraw(pots, drawRand)
  const rows = Object.fromEntries(entrants.map(e => [e.short, { short: e.short, name: e.name, pot: e.pot, rank: e.rank, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, awayGf: 0, awayWins: 0, opps: [] }]))
  const gf = Object.fromEntries(entrants.map(e => [e.short, 0]))
  const matches = Object.fromEntries(entrants.map(e => [e.short, 8]))
  const played = []
  const add = (h, a, hs, as) => {
    addResult(rows, h, a, hs, as)
    rows[a].awayGf += as; if (as > hs) rows[a].awayWins++
    rows[h].opps.push(a); rows[a].opps.push(h); gf[h] += hs; gf[a] += as
    played.push([h, a, hs, as])
  }
  // his eight in matchday order, then everyone else's
  const mine = shuffle(draw.filter(([h, a]) => h === U || a === U), drawRand)
  mine.forEach(([h, a], i) => { const m = playFx(W, { comp: 'ucl', wk: UCL_WEEKS.md[i], home: h, away: a, meta: { round: `League phase · Matchday ${i + 1}`, md: i + 1, stage: 'md' } }); add(h, a, m.hs, m.as) })
  for (const [h, a] of draw) if (h !== U && a !== U) { const [hs, as] = quickScore(W, h, a); add(h, a, hs, as) }
  const list = Object.values(rows)
  for (const r of list) { r.oppPts = r.opps.reduce((s, o) => s + rows[o].points, 0); r.oppGd = r.opps.reduce((s, o) => s + rows[o].gd, 0); r.oppGf = r.opps.reduce((s, o) => s + rows[o].gf, 0) }
  list.sort(uclOrder)
  const S = list.map(r => r.short)
  const seed = Object.fromEntries(S.map((s, i) => [s, i + 1]))
  const reached = Object.fromEntries(S.map((s, i) => [s, i < 8 ? 'Round of 16' : i < 24 ? 'Knockout play-offs' : 'League phase']))
  // a two-legged tie: the club placed lower hosts the first leg
  const tie = (x, y, ri) => {
    const [A, B] = seed[x] > seed[y] ? [x, y] : [y, x]
    const name = UCL_ROUNDS[ri], wks = UCL_WEEKS[UCL_STAGES[ri]]
    const l1 = playFx(W, { comp: 'ucl', wk: wks[0], home: A, away: B, meta: { round: name, leg: 1, ri, stage: UCL_STAGES[ri] } })
    const l2 = playFx(W, { comp: 'ucl', wk: wks[1], home: B, away: A, ko: true, agg: [l1.as, l1.hs], meta: { round: name, leg: 2, ri, stage: UCL_STAGES[ri] } })
    const winner = l2.winH ? B : A, loser = winner === A ? B : A
    gf[A] += l1.hs + l2.as; gf[B] += l1.as + l2.hs; matches[A] += 2; matches[B] += 2
    if (ri < 4) reached[winner] = UCL_REACHED[ri + 1]
    return { stage: UCL_STAGES[ri], a: A, b: B, seedA: seed[A], seedB: seed[B], legs: [[l1.hs, l1.as], [l2.hs, l2.as]], sa: l1.hs + l2.as, sb: l1.as + l2.hs, et: l2.et, pens: l2.pens ? [l2.pens.a, l2.pens.h] : null, winner, loser }
  }
  const pick2 = (pair, r) => (r() < 0.5 ? pair : [pair[1], pair[0]])
  // play-offs: [seeded pair, unseeded pair, the Round of 16 seeds they meet]
  const GROUPS = [[[15, 16], [17, 18], [1, 2]], [[13, 14], [19, 20], [3, 4]], [[11, 12], [21, 22], [5, 6]], [[9, 10], [23, 24], [7, 8]]]
  const at = n => S[n - 1]
  // the halves: 1st and 2nd apart, 3rd/4th apart, 5th/6th, 7th/8th
  const half = {}
  for (const g of GROUPS) { const [x, y] = pick2(g[2], koRand); half[x] = 0; half[y] = 1 }
  const po = [], r16 = []
  for (const [sd, un, top] of GROUPS) {
    const u = pick2(un, koRand)
    const t1 = tie(at(sd[0]), at(u[0]), 0), t2 = tie(at(sd[1]), at(u[1]), 0)
    const [w1, w2] = pick2([t1, t2], koRand)
    // (the play-off winners are drawn onto the two Round of 16 seeds)
    po.push({ t: w1, seed: top[0] }, { t: w2, seed: top[1] })
  }
  for (const { t, seed: s } of po) r16.push({ t: tie(at(s), t.winner, 1), po: t, seed: s })
  // the bracket, a half at a time: [1/2 path, 7/8 path], [3/4 path, 5/6 path]
  const pathOf = s => r16.find(x => x.seed === s)
  const halves = [0, 1].map(h => [[1, 2], [7, 8], [3, 4], [5, 6]].map(pr => pathOf(pr.find(s => half[s] === h))))
  const qf = [], sf = []
  for (const h of halves) {
    const q1 = tie(h[0].t.winner, h[1].t.winner, 2), q2 = tie(h[2].t.winner, h[3].t.winner, 2)
    qf.push(q1, q2)
    sf.push(tie(q1.winner, q2.winner, 3))
  }
  const before = out.length
  const fm = playFx(W, { comp: 'ucl', wk: UCL_WEEKS.f, home: sf[0].winner, away: sf[1].winner, neutral: true, ko: true, meta: { round: 'Final', ri: 4, stage: 'final' } })
  for (let i = before; i < out.length; i++) out[i].final = true
  const fw = fm.winH ? sf[0].winner : sf[1].winner, fl = fw === sf[0].winner ? sf[1].winner : sf[0].winner
  gf[sf[0].winner] += fm.hs; gf[sf[1].winner] += fm.as; matches[sf[0].winner]++; matches[sf[1].winner]++
  reached[fw] = 'Winners'; reached[fl] = 'Runners-up'
  const final = { stage: 'final', a: sf[0].winner, b: sf[1].winner, legs: [[fm.hs, fm.as]], sa: fm.hs, sb: fm.as, et: fm.et, pens: fm.pens ? [fm.pens.h, fm.pens.a] : null, winner: fw, loser: fl, final: true }
  // (top to bottom in bracket order, so each column feeds the next)
  const order = halves.flat()
  const strip = ({ loser, ...t }) => t
  const bracket = { po: order.map(x => x.po).map(strip), r16: order.map(x => x.t).map(strip), qf: qf.map(strip), sf: sf.map(strip), final: [strip(final)] }
  const logo = new Set(entrants.filter(e => e.logo).map(e => e.short))
  const table = list.map((r, i) => ({ short: r.short, name: r.name, played: r.played, wins: r.wins, draws: r.draws, losses: r.losses, gf: r.gf, ga: r.ga, gd: r.gd, points: r.points, pos: i + 1, isUs: r.short === U, pot: r.pot, extra: !logo.has(r.short), reached: reached[r.short] }))
  return { U, uRate, table, matches: played, bracket, reached, gf, games: matches, winner: fw, runnerUp: fl, fixtures: out, logo, names: new Map(entrants.map(e => [e.short, e.name])) }
}

// The award field: every entrant's players (the data's, up to five a side) score their share of their club's
// Champions League goals; the stars (CLUB_STARS) a seeded campaign around their real level.
// UEFA's awards: the top scorer (goals, then assists), the Player of the Season and the Young Player of the
// Season (UEFA's technical observers: here goals, 0.6 an assist, a midfielder's game, and how far his club went),
// and the Team of the Season (a striker: one of the four best by that count).
// Champions League top scorers (UEFA): 2018-19 Messi 12, 2019-20 Lewandowski 15, 2020-21 Haaland 10, 2021-22
//   Benzema 15, 2022-23 Haaland 12, 2023-24 Kane and Mbappé 8, 2024-25 Guirassy 13 (the first 36-club season,
//   play-offs in): about 8-15. The record is Cristiano Ronaldo's 17 (2013-14).
// Players of the Season: Benzema 2021-22, Rodri 2022-23, Vinícius Júnior 2023-24, Dembélé 2024-25: all from the
//   winners or the finalists.
const UCL_STAGE = { Winners: 8, 'Runners-up': 4, 'Semi-finals': 2, 'Quarter-finals': 0.5, 'Round of 16': -1, 'Knockout play-offs': -3, 'League phase': -5 }
function uclField(world, entrants, rand, exclude, mine) {
  const out = []
  for (const e of entrants) {
    const list = (CLUB_STRIKERS.get(e.short) ?? []).filter(p => !exclude.has(p.name)).slice(0, 5)
    if (!list.length) continue
    const gfAll = world.gf[e.short] ?? 0, mt = world.games[e.short] ?? 8
    const isU = e.short === world.U
    const taken = isU && gfAll ? clamp((mine ?? 0) / gfAll, 0, 0.7) : 0
    const sc = scorersOf(list, gfAll, mt, rand, taken)
    const gl = shareGoals(sc, Math.max(0, gfAll - (isU ? mine ?? 0 : 0)), rand, taken)
    sc.forEach(({ p, av }, i) => {
      const goals = gl[i]
      const assists = binom(Math.max(0, gfAll - goals), av * p.prof.assist * ROLE[p.role].a * 0.6, rand)
      out.push({ name: p.name, team: e.short, age: p.age ?? null, fwd: isForward(p), goals, assists, mins: Math.round(mt * 84 * av),
        score: r1(goals + 0.6 * assists + p.value * mt / 34 + (UCL_STAGE[world.reached[e.short]] ?? 0) + 2.5 * gauss(rand)) })
    })
  }
  return out
}
function uclStars(world, entrants, rand) {
  const out = []
  for (const [name, keys, , lvl, age] of CLUB_STARS) {
    if (strikerNames.has(norm(name))) continue
    const e = entrants.find(x => keys.some(k => norm(x.canon).includes(norm(k))))
    if (!e) continue
    const mt = world.games[e.short] ?? 8
    out.push({ name, team: e.short, age, score: r1(lvl * mt / 34 * 1.1 + (UCL_STAGE[world.reached[e.short]] ?? 0) + 3 * gauss(rand)) })
  }
  return out
}
function uclAwards(book, me) {
  const bf = book.boot
  const maxG = Math.max(0, ...bf.map(x => x.goals))
  const won = me.goals > 0 && me.goals >= maxG
  const bootTop = [...bf].sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.mins - b.mins)[0]
  const goldenBoot = { name: 'Top Scorer', won, shared: won && bf.some(x => x.goals === me.goals), rank: 1 + bf.filter(x => x.goals > me.goals).length, goals: me.goals,
    winner: won ? { name: null, team: me.team, goals: me.goals, isPlayer: true } : bootTop ? { name: bootTop.name, team: bootTop.team, goals: bootTop.goals, isPlayer: false } : null,
    race: race(bf, me, 'goals') }
  const mine = r1(me.goals + 0.6 * me.assists + (UCL_STAGE[me.finish] ?? 0))
  const pf = book.pots
  const rank = 1 + pf.filter(x => x.score > mine).length
  const top = [...pf.map(x => ({ name: x.name, team: x.team, score: x.score, isPlayer: false })), { name: null, team: me.team, score: mine, isPlayer: true }]
    .sort((a, b) => b.score - a.score || (a.isPlayer ? -1 : 1)).slice(0, 10)
  const playerOfSeason = { name: 'Player of the Season', won: rank === 1, rank, score: mine, winner: top[0], top }
  const young = pf.filter(x => x.age != null && x.age <= 21)
  const yRank = me.eligible ? 1 + young.filter(x => x.score > mine).length : null
  const yTop = [...young].sort((a, b) => b.score - a.score)[0]
  const youngPlayer = { name: 'Young Player of the Season', eligible: !!me.eligible, won: !!me.eligible && yRank === 1, rank: yRank,
    winner: me.eligible && yRank === 1 ? { name: null, team: me.team, isPlayer: true } : yTop ? { name: yTop.name, team: yTop.team, isPlayer: false } : null }
  return { goldenBoot, playerOfSeason, youngPlayer, teamOfSeason: rank <= 4, goldenShoe: null, ballonDor: null, mvp: playerOfSeason.won, dpoy: false }
}
// his knockout fixtures as ties (two legs, or the final)
function uclTies(ko) {
  const out = []
  let cur = []
  for (const m of ko) {
    if (m.leg === 1) { cur = [m]; continue }
    if (m.leg === 2 && cur.length) { cur.push(m); out.push(tieOf(cur, 'ucl')); cur = []; continue }
    out.push(tieOf([m], 'ucl'))
  }
  return out
}
// the season's totals and awards from his fixtures (the run, or the director's league phase spliced in)
function uclBooked(fixtures, book, finish) {
  const games = fixtures.filter(m => m.stage === 'md')
  const ko = fixtures.filter(m => m.stage !== 'md')
  const t = totalsOf(fixtures)
  const me = { ...book.me, goals: t.goals, assists: t.assists, mins: t.mins, finish }
  const fin = ko.find(m => m.stage === 'final') ?? null
  return {
    ...t, ...seasonFields(t), allComps: t, byComp: { leaguePhase: totalsOf(games), knockouts: totalsOf(ko) },
    gameLog: games.map(g => g.result), bestGame: bestOf(fixtures),
    finalsOpp: fin?.opponent ?? null, finalsSeries: scoreLine(fin),
    book: { ...book, me }, ...uclAwards(book, me),
  }
}
function uclSeason(build, types, team, base, gameMode) {
  const { entrants, me: entry, src } = uclEntrants(team)
  const U = entry.short
  const prof = profileOfBuild(build)
  const ovr = calcSoccerOVR(build, types)
  const mates = CLUB_STRIKERS.get(U) ?? []
  const uRate = ratingsOf(src, team, 'current', null)
  // (his side's goals a game, against the other 35)
  const lamAvg = clamp(avg(entrants.filter(e => e.short !== U).map(o => EURO_BASE * Math.exp(aT(uRate.att - G_ATT) - dT(o.def - G_DEF)) * Math.cosh(H_EURO))), 0.5, 3.5)
  const S = strikerSide({ build, prof, team, mates, lamAvg, base, script: false })
  // the draw (who he meets in the league phase, the knockout pairings) comes from the season's first seed: a moment
  // re-simulates the season on another seed (lib/seasonDirector.js) and must meet the same clubs (team.drawSeed)
  const drawBase = team?.drawSeed ?? base
  const world = uclWorld({ U, uRate, entrants, hook: hookFor(S, base), rand: stream(base, 'world'), drawRand: stream(drawBase, 'ucl:draw'), koRand: stream(drawBase, 'ucl:ko') })
  const nameOf = s => world.names.get(s) ?? clubName(s)
  const ls = stream(base, 'line:ucl')
  const fixtures = world.fixtures.slice().sort((a, b) => a.wk - b.wk).map((f, k) => ({
    ...matchOf(f, lineFor(ls, S, f), nameOf, k + 1), oppExtra: !world.logo.has(f.opp), stage: f.stage, md: f.md ?? null, ri: f.ri ?? null,
  }))
  const games = fixtures.filter(m => m.stage === 'md').map((m, i) => ({ ...m, g: i + 1, wk: i + 1 }))
  const ko = fixtures.filter(m => m.stage !== 'md')
  const ties = uclTies(ko)
  const row = world.table.find(r => r.isUs)
  const finish = world.reached[U]
  const champion = finish === 'Winners'
  // the field
  const fr = stream(base, 'field')
  const exclude = new Set(S.replaced ? [S.replaced.name] : [])
  const lineGoals = fixtures.reduce((s, m) => s + (m.goals ?? 0), 0)
  const field = uclField(world, entrants, fr, exclude, lineGoals)
  const stars = uclStars(world, entrants, stream(base, 'stars'))
  const age = buildAge(build, team)
  const book = {
    comp: 'ucl',
    boot: field.map(x => ({ name: x.name, team: x.team, goals: x.goals, assists: x.assists, mins: x.mins })).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 40),
    pots: [...field, ...stars].map(x => ({ name: x.name, team: x.team, score: x.score, age: x.age ?? null })).sort((a, b) => b.score - a.score).slice(0, 40),
    me: { team: U, eligible: age != null && age <= 21, age },
  }
  // (the young field keeps every eligible player, not only the top 40)
  const youngLeft = [...field, ...stars].filter(x => x.age != null && x.age <= 21 && !book.pots.some(y => y.name === x.name && y.team === x.team))
  book.pots.push(...youngLeft.map(x => ({ name: x.name, team: x.team, score: x.score, age: x.age })))
  const booked = uclBooked(fixtures, book, finish)
  const table = world.table
  return {
    sport: 'soccer', mode: 'current', comp: 'ucl', position: 'st', gameMode, season: SEASON, drawSeed: drawBase,
    ovr, archetype: getSoccerArchetype(ovr, build, types),
    team: { ...src, ...(team ?? {}), short: U, name: entry.name, color: src.color ?? team?.color ?? null, color2: src.color2 ?? team?.color2 ?? null, att: r1(uRate.att), def: r1(uRate.def), comp: 'ucl', pot: entry.pot, ...(entry.wildcard ? { inPlaceOf: entry.wildcard } : {}) },
    league: { ...UCL_LEAGUE },
    wins: row.wins, draws: row.draws, losses: row.losses, points: row.points, gf: row.gf, ga: row.ga, gd: row.gd,
    seed: row.pos, conference: 'ucl', standings: table,
    champion, finish, madePlayoffs: row.pos <= 24, playoffs: row.pos <= 24,
    playoffRounds: ties, games, fixtures,
    ...booked,
    europe: { comp: 'ucl', name: UCL_LEAGUE.name, table, position: row.pos, games, rounds: ties, result: finish, champion, winner: world.winner },
    bracket: world.bracket, uclWinner: world.winner, uclRunnerUp: world.runnerUp, leaguePhase: world.matches,
    cup: null, trophies: champion ? ['Champions League'] : [], qualified: null, relegated: false, relegationPlayoff: false,
  }
}
// The season again from the league phase as played (the season director's moments changed some of his matches):
// his row from those matches (the table re-sorted around him, inside the band he finished in, so the knockouts
// he played still follow from it), and his totals and the awards from every match.
export function soccerUclRebook(result, games) {
  if (!isUclResult(result) || !result.book) return result
  const lp = games.map((g, i) => ({ ...g, stage: 'md', md: g.md ?? i + 1 }))
  const ko = (result.fixtures ?? []).filter(m => m.stage && m.stage !== 'md')
  const W = lp.filter(g => g.won).length, D = lp.filter(g => g.drawn).length, L = lp.length - W - D
  const gf = lp.reduce((s, g) => s + (g.mySc ?? 0), 0), ga = lp.reduce((s, g) => s + (g.oppSc ?? 0), 0)
  const was = result.standings.find(r => r.isUs)?.pos ?? result.seed
  const band = p => (p <= 8 ? 0 : p <= 24 ? 1 : 2)
  const rows = result.standings.map(r => (r.isUs ? { ...r, wins: W, draws: D, losses: L, points: W * 3 + D, gf, ga, gd: gf - ga } : { ...r }))
  // the clubs he played: each changed match comes off their row as it was and goes on as it is now, so the table
  // still adds up (every win someone's loss, every draw two draws, the goals the same both ways)
  const by = new Map(rows.map(r => [r.short, r]))
  const theirs = (g, sign) => {
    const r = by.get(g?.opponent)
    if (!r || r.isUs || g.mySc == null || g.oppSc == null) return
    r.gf += sign * g.oppSc; r.ga += sign * g.mySc
    if (g.mySc > g.oppSc) r.losses += sign; else if (g.mySc < g.oppSc) r.wins += sign; else r.draws += sign
  }
  const before = (result.games ?? []).filter(g => !g.stage || g.stage === 'md')
  lp.forEach((g, k) => { const o = before[k]; if (o && o.opponent === g.opponent && o.mySc === g.mySc && o.oppSc === g.oppSc) return; theirs(o, -1); theirs(g, 1) })
  for (const r of rows) if (!r.isUs) { r.points = r.wins * 3 + r.draws; r.gd = r.gf - r.ga }
  rows.sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.pos - y.pos)
  let i = rows.findIndex(r => r.isUs)
  const lo = [0, 8, 24][band(was)], hi = [7, 23, 35][band(was)]
  if (i < lo || i > hi) { const [me] = rows.splice(i, 1); i = clamp(i, lo, hi); rows.splice(i, 0, me) }
  rows.forEach((r, k) => { r.pos = k + 1 })
  const fixtures = [...lp, ...ko].map((m, k) => ({ ...m, g: k + 1 }))
  const booked = uclBooked(fixtures, result.book, result.finish)
  return {
    ...result, ...booked, games: lp.map((g, k) => ({ ...g, g: k + 1, wk: k + 1 })), fixtures, standings: rows, seed: i + 1,
    wins: W, draws: D, losses: L, points: W * 3 + D, gf, ga, gd: gf - ga,
    europe: result.europe ? { ...result.europe, table: rows, position: i + 1, games: lp } : result.europe,
  }
}

// ─── Squad Builder: what one striker does to his side ────────────────────────
// The side's attack with this build in place of its real No. 9 (the lift M, as a rating on the side's own
// att scale), so a squad's strength can be worked out before scriptSoccerSeason plays the season.
export function soccerStrikerLift(build, team, mode = 'current') {
  if (mode === 'alltime' && FIELD !== fieldFor(team)) return withField(fieldFor(team), () => soccerStrikerLift(build, team, mode))
  const src = mode === 'alltime' ? resolveNation(team) : resolveClub(team)
  const mates = (mode === 'alltime' ? NATION_STRIKERS : CLUB_STRIKERS).get(src.short) ?? []
  const rate = ratingsOf(src, team, mode, null)
  const lam = mode === 'alltime' ? clamp(WC_BASE * Math.exp(waT(rate.att - W_ATT)), 0.5, 3.5) : lamAvgOf(src.short, rate, src.lid)
  const L = liftOf(profileOfBuild(build), mates[0]?.prof ?? { share: 0.2, F: 1, link: 6 }, lam, team?.usage ?? 1)
  return { M: r2(L.M), att: r1(rate.att + Math.log(L.M) / (mode === 'alltime' ? KW_ATT : K_ATT)), replaced: mates[0]?.name ?? null }
}

// ─── Entry points ────────────────────────────────────────────────────────────
// `script` (Squad Builder): a season from scriptSoccerSeason; the scores, table, cup, Europe and the award
// field come from it and this build only makes his own line.
export function runSoccerSimulation(build, types = SOCCER_TRAITS, team = null, mode = 'current', rngSeed = null, gameMode = 'classic', script = null) {
  const base = seedBase(rngSeed)
  const t = types?.length ? types : SOCCER_TRAITS
  if ((script?.mode ?? mode) === 'alltime') return withField(fieldFor(team, script), () => wcSeason(build, t, team, base, gameMode, script))
  // a club: Career, Squad Builder (a script) and team.domestic play the domestic season; a build, the Champions League
  return script || team?.career || team?.squad || team?.domestic ? clubSeason(build, t, team, base, gameMode, script) : uclSeason(build, t, team, base, gameMode)
}
// The squad's one season: every result decided once from its strength (`tr`: { att, def } on the club or
// nation scale; { off, def } too). The award field leaves out every real striker of the side (the squad's
// builds are its strikers).
export function scriptSoccerSeason(team, tr, rngSeed, mode = 'current') {
  const base = seedBase(rngSeed)
  if (mode === 'alltime' && FIELD !== fieldFor(team)) return withField(fieldFor(team), () => scriptSoccerSeason(team, tr, rngSeed, mode))
  if (mode === 'alltime') {
    const nat = resolveNation(team)
    const uRate = ratingsOf(nat, team, 'alltime', tr)
    const world = wcWorld({ U: nat.short, uRate, hook: nullHook, rand: stream(base, 'world') })
    const fixtures = world.fixtures.map(({ plan, ...f }) => f)
    const g = fixtures.filter(f => f.stage === 'group')
    return { sport: 'soccer', mode, wcField: WC_KEY, team: nat.short, tr: uRate, world: { ...world, fixtures }, wins: g.filter(f => f.mySc > f.oppSc).length, draws: g.filter(f => f.mySc === f.oppSc).length, losses: g.filter(f => f.mySc < f.oppSc).length, champion: world.champion === nat.short, finish: world.reached[nat.short] }
  }
  const club = resolveClub(team)
  const L = leagueOfClub(club), meta = LEAGUE_META[L.key]
  const uRate = ratingsOf(club, team, 'current', tr)
  const place = team?.lastPos ?? lastPlace(club)
  const uComp = team?.europe !== undefined ? team.europe : team?.lastPos != null ? (place <= meta.ucl ? 'ucl' : place <= meta.ucl + meta.uel ? 'uel' : null) : EUROPE_2026[club.short] ?? null
  const world = clubWorld({ U: club.short, uRate, uComp, uPlace: place, hook: nullHook, rand: stream(base, 'world') })
  world.fixtures = world.fixtures.map(({ plan, ...f }) => f)
  const mates = CLUB_STRIKERS.get(club.short) ?? []
  const field = clubField(world, stream(base, 'field'), new Set(mates.filter(p => p.role === 'ST').map(p => p.name)), 0)
  const stars = clubStars(world, stream(base, 'stars'))
  const row = world.leagues[L.id].table.find(r => r.short === club.short)
  const games = world.fixtures.filter(f => f.comp === 'league').sort((a, b) => a.wk - b.wk)
    .map((f, i) => ({ g: i + 1, wk: i + 1, home: f.home, opponent: f.opp, mySc: f.mySc, oppSc: f.oppSc, won: f.mySc > f.oppSc, drawn: f.mySc === f.oppSc, result: f.mySc > f.oppSc ? 'W' : f.mySc === f.oppSc ? 'D' : 'L' }))
  return {
    sport: 'soccer', mode: 'current', team: club.short, tr: uRate, world, field, stars, games,
    wins: row.wins, draws: row.draws, losses: row.losses, points: row.points, seed: row.pos, standings: world.leagues[L.id].table,
    champion: row.pos === 1, madePlayoffs: row.pos <= meta.ucl, playoffRounds: [],
  }
}
