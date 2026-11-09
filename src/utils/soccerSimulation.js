// ─── Soccer Simulation Engine (Striker) ──────────────────────────────────────
// The third sport's season engine: a striker (ST) build dropped into a real club (TOP DIVISIONS, mode
// 'current') or a real nation at the 2026 World Cup (WORLD CUP, mode 'alltime'). Basketball's engine
// (utils/bucketSimulation.js) is the model: the same call shape, the same top-level result fields, a
// seeded RNG so the live server can play a season back from its seed (lib/verifyCore.js), and a
// `script` (scriptSoccerSeason) so Squad Builder can play one season for a whole squad.
//
// ── How a season is played ───────────────────────────────────────────────────
// 1. The build's ten traits make a striker profile (profileOf): his share of the team's chances
//    (movement, pace, first touch, aerial and physical presence), his finishing against xG
//    (finishing, composure, shot power), how good his chances are (big-chance share), headers,
//    long shots, assists (link-up), penalties.
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
//
// `team`: a club (mode 'current') or nation (mode 'alltime') from the data, at least { short }.
//   team.offMod / team.defMod: the season director's moments (±1 on the 1-10 scale each).
//   team.career + team.off / team.def (1-10): Career's own team; team.usage (0-1): his share of the chances
//   (Career, Squad Builder); team.bench: a backup (few starts); team.age: Best Young Player eligibility;
//   team.europe ('ucl' | 'uel' | null) or team.lastPos (1-20): where he plays in Europe this season.
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
// Round of 32, finalsOpp/finalsSeries = the final. Plus: groups: { A: [row] … }, bracket: { r32, r16, qf, sf,
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
import { SOCCER_LEAGUES, SOCCER_CLUBS } from '../data/soccer-clubs'
import { WC_NATIONS } from '../data/soccer-nations'
import { SOCCER_STRIKERS, WC_STRIKERS } from '../data/soccer-strikers'

export const SOCCER_TRAITS = ['finishing', 'shotPower', 'heading', 'dribbling', 'firstTouch', 'linkUp', 'pace', 'strength', 'offBall', 'composure']
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
// but small next to chance volume), then movement (offBall: getting the chances at all; most of a striker's
// goals are decided by where he is when the ball arrives), then composure (big-chance conversion, penalties)
// and first touch. EA FC's own ST rating leans the same way (finishing 18%, positioning 13%, then heading,
// shot power and ball control at 10% each; pace 9% between acceleration and sprint speed); link-up play
// counts here for the modern No. 9's assists. Same scale as the other sports (grades 0-11: A = 96, B+ = 86,
// B = 81, B- = 77), so an elite real striker (mostly A and A+) lands 93-99, an average starter (B/B+) 78-84.
export const SOCCER_OVR_WEIGHTS = {
  finishing: 0.18, offBall: 0.16, composure: 0.10, firstTouch: 0.10, pace: 0.09,
  shotPower: 0.08, heading: 0.08, dribbling: 0.07, linkUp: 0.07, strength: 0.07,
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
  const fin = v('finishing'), sp = v('shotPower'), hd = v('heading'), dr = v('dribbling'), ft = v('firstTouch')
  const lu = v('linkUp'), pa = v('pace'), st = v('strength'), ob = v('offBall'), co = v('composure')
  // his share of the team's chances (at an average team), flattening at the top: a poor No. 9 ~0.11, an
  // average starter ~0.20, a good one ~0.33, elite ~0.40, an S striker ~0.45 (Haaland takes ~0.38 of City's
  // xG, a weaker side's No. 9 more of less)
  const volIdx = 0.38 * ob + 0.14 * pa + 0.11 * ft + 0.10 * hd + 0.10 * dr + 0.08 * st + 0.07 * sp + 0.02 * lu
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
  // of his teammates' goals while he's on, how many he sets up (average ~0.11, a Kane ~0.17)
  const assist = clamp(0.02 + 0.009 * lu + 0.003 * dr + 0.002 * ft + 0.002 * ob, 0.02, 0.24)
  const penIdx = 0.45 * fin + 0.40 * co + 0.15 * sp
  const penConv = clamp(0.60 + 0.03 * penIdx, 0.6, 0.93)     // B 78%, A 87%, S 93%
  const taker = penIdx >= 6 ? 1 : penIdx >= 4 ? 0.6 : 0.25    // his club's taker (a weak one shares them)
  const onTarget = clamp(0.26 + 0.012 * (fin - 6) + 0.006 * (sp - 6), 0.15, 0.4)   // a miss that still tests the keeper
  return { share, F, big, long, head, q, assist, penConv, taker, onTarget, link: lu, strength: st }
}
const profileOfBuild = build => profileOf(t => build?.[t]?.val)
const profileOfAttrs = attrs => profileOf(t => attrs?.[t])
const GENERIC_BACKUP = { share: 0.14, F: 0.92, link: 4, assist: 0.08 }
const LAM_REF = 1.45
// his share of the chances at a team that scores `lam` a game: the best sides spread the goals around
// (Haaland ~0.38 of City's xG), a weak side leans on its No. 9 (~0.45 for an elite one)
const shareAt = (prof, lam, usage = 1) => clamp(prof.share * Math.pow(LAM_REF / Math.max(0.5, lam), 0.45) * usage, 0.04, 0.62)
// his penalties as a share of the team's goals (a good side wins more of them)
const penRateAt = lam => PEN_RATE * Math.pow(Math.max(0.3, lam) / 1.4, 0.7)

// ─── The data, read once ─────────────────────────────────────────────────────
const LEAGUE_META = {
  ENG: { goals: 2.93, cup: 'FA Cup', boot: 'Golden Boot', poty: 'Player of the Season', ucl: 5, uel: 2, down: 3, playoff: false },
  ESP: { goals: 2.62, cup: 'Copa del Rey', boot: 'Pichichi', poty: 'Player of the Season', ucl: 4, uel: 2, down: 3, playoff: false },
  ITA: { goals: 2.56, cup: 'Coppa Italia', boot: 'Capocannoniere', poty: 'MVP', ucl: 4, uel: 2, down: 3, playoff: false },
  GER: { goals: 3.14, cup: 'DFB-Pokal', boot: 'Torjägerkanone', poty: 'Player of the Season', ucl: 4, uel: 2, down: 2, playoff: true },
  FRA: { goals: 2.96, cup: 'Coupe de France', boot: 'Top Scorer', poty: 'Player of the Year', ucl: 3, uel: 2, down: 2, playoff: true },
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
const LEAGUES = (SOCCER_LEAGUES ?? []).map(l => ({ ...l, key: countryKey(l) }))
const CLUBS = (SOCCER_CLUBS ?? []).map(c => ({ ...c, att: Number(c.att) || 75, def: Number(c.def) || 75 }))
const leagueOfClub = c => LEAGUES.find(l => c.league === l.id || c.league === l.short || c.league === l.name) ?? LEAGUES[0]
for (const c of CLUBS) { const L = leagueOfClub(c); c.lid = L?.id; c.country = L?.key ?? 'ENG' }
const CLUB_BY = new Map(CLUBS.map(c => [c.short, c]))
const clubsOf = lid => CLUBS.filter(c => c.lid === lid)
const NATIONS = (WC_NATIONS ?? []).map(n => ({ ...n, att: Number(n.att) || 70, def: Number(n.def) || 70 }))
const NATION_BY = new Map(NATIONS.map(n => [n.short, n]))
const HOSTS = new Set(['USA', 'MEX', 'CAN'])

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
const playValue = p => { const a = p.attrs ?? {}; return ROLE[roleOf(p)].v * Math.max(0, ((a.linkUp ?? 5) + (a.firstTouch ?? 5) + (a.composure ?? 5) + (a.dribbling ?? 5)) / 4 - 5) }
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
const NATION_STRIKERS = byTeam(WC_STRIKERS)

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
const ET_F = 0.30              // extra time: a third of a match at ~90% of the rate
const PEN_RATE = 0.115         // penalties awarded per team-match
// the World Cup: one pool of 48, a wider spread (Spain against Curaçao)
const W_SD_ATT = Math.max(2, Math.sqrt(avg(NATIONS.map(n => (n.att - avg(NATIONS.map(x => x.att))) ** 2)))) || 6
const W_SD_DEF = Math.max(2, Math.sqrt(avg(NATIONS.map(n => (n.def - avg(NATIONS.map(x => x.def))) ** 2)))) || 6
const W_ATT = avg(NATIONS.map(n => n.att)), W_DEF = avg(NATIONS.map(n => n.def))
const KW_ATT = 0.24 / W_SD_ATT, KW_DEF = 0.22 / W_SD_DEF
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
  LEAGUE_BASE.set(l.id, { base: n ? (LEAGUE_META[l.key].goals) / (s / n) : 1.4, mA, mD, minA: Math.min(...cs.map(c => c.att)), minD: Math.min(...cs.map(c => c.def)) })
}
const EURO_BASE = 1.47
const WC_BASE = (() => {
  let s = 0, n = 0
  for (const a of NATIONS) for (const b of NATIONS) if (a !== b && a.group && a.group === b.group) { s += Math.exp(waT(a.att - W_ATT) - wdT(b.def - W_DEF)); n++ }
  return n ? 1.33 / (s / n) : 1.3
})()

// ─── Career's 1-10 scale ─────────────────────────────────────────────────────
// 5.5 is an average side; one point is 0.55 of a league's spread (about 17% more goals). The season
// director's moments move a team by whole points (team.offMod / defMod).
const scaleOf = mode => (mode === 'alltime' ? { mA: W_ATT, mD: W_DEF, sA: W_SD_ATT * 0.55, sD: W_SD_DEF * 0.55 } : { mA: G_ATT, mD: G_DEF, sA: SD_ATT * 0.55, sD: SD_DEF * 0.55 })
export function soccerTeam10(team, mode = 'current') {
  const src = (mode === 'alltime' ? NATION_BY : CLUB_BY).get(team?.short) ?? team ?? {}
  const s = scaleOf(mode)
  return { off: r1(clamp(5.5 + ((src.att ?? s.mA) - s.mA) / s.sA, 1, 10)), def: r1(clamp(5.5 + ((src.def ?? s.mD) - s.mD) / s.sD, 1, 10)) }
}
export function soccerTeamFrom10(off, def, mode = 'current') {
  const s = scaleOf(mode)
  return { att: s.mA + ((off ?? 5.5) - 5.5) * s.sA, def: s.mD + ((def ?? 5.5) - 5.5) * s.sD }
}
export function soccerLeagueInfo(leagueId) {
  const l = LEAGUES.find(x => x.id === leagueId || x.short === leagueId || x.name === leagueId) ?? LEAGUES[0]
  if (!l) return null
  const m = LEAGUE_META[l.key], size = clubsOf(l.id).length
  return { id: l.id, name: l.name, short: l.short, country: l.country, key: l.key, cup: m.cup, boot: m.boot, poty: m.poty, size, games: 2 * (size - 1), ucl: m.ucl, uel: m.uel, down: m.down }
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
]
const LOWER = {
  ENG: [['Middlesbrough', 'MBO'], ['Norwich City', 'NOR'], ['Hull City', 'HUL'], ['Stoke City', 'STK'], ['Coventry City', 'COV'], ['Millwall', 'MLW'], ['Derby County', 'DER'], ['Plymouth Argyle', 'PLY'], ['Wrexham', 'WRX'], ['Birmingham City', 'BIR'], ['Sheffield United', 'SHU'], ['Ipswich Town', 'IPS'], ['Southampton', 'SOU'], ['Leicester City', 'LEI'], ['Watford', 'WAT'], ['Preston North End', 'PNE']],
  ESP: [['Deportivo La Coruña', 'DEP'], ['Racing Santander', 'RAC'], ['Sporting Gijón', 'SPG'], ['Real Zaragoza', 'ZAR'], ['Málaga', 'MAG'], ['Almería', 'ALM'], ['Granada', 'GRA'], ['Cádiz', 'CAD'], ['Las Palmas', 'LPA'], ['Real Valladolid', 'VLL'], ['Leganés', 'LGA'], ['Eibar', 'EIB']],
  ITA: [['Palermo', 'PAL'], ['Sampdoria', 'SAM'], ['Bari', 'BRI'], ['Spezia', 'SPE'], ['Modena', 'MOD'], ['Venezia', 'VEN'], ['Monza', 'MNZ'], ['Empoli', 'EMP'], ['Frosinone', 'FRO'], ['Catanzaro', 'CTZ'], ['Salernitana', 'SAL'], ['Brescia', 'BRS']],
  GER: [['Schalke 04', 'S04'], ['Hertha BSC', 'BSC'], ['Hannover 96', 'H96'], ['Fortuna Düsseldorf', 'F95'], ['1. FC Kaiserslautern', 'FCK'], ['1. FC Nürnberg', 'NUR'], ['Karlsruher SC', 'KSC'], ['SC Paderborn', 'PAD'], ['Darmstadt 98', 'D98'], ['VfL Bochum', 'BOC'], ['Holstein Kiel', 'KSV'], ['Hansa Rostock', 'FCH']],
  FRA: [['Saint-Étienne', 'STE'], ['Bordeaux', 'GIR'], ['Montpellier', 'MHS'], ['Reims', 'SDR'], ['Caen', 'SMC'], ['Bastia', 'BAS'], ['Guingamp', 'EAG'], ['Grenoble', 'GRE'], ['Sochaux', 'SOC'], ['Troyes', 'TRO'], ['Red Star', 'RSF'], ['Amiens', 'ASC']],
}
// (one that's in the data, by name or code, is a top-flight club this season: left out)
const taken = new Set([...CLUBS.map(c => c.short), ...CLUBS.map(c => norm(c.name))])
const EXTRAS = EURO_EXTRA.filter(([name, short]) => !taken.has(short) && !taken.has(norm(name)))
  .map(([name, short, country, z, comp]) => ({ name, short, country, att: G_ATT + z * SD_ATT, def: G_DEF + z * SD_DEF, extra: true, comp, z }))
for (const e of EXTRAS) taken.add(e.short)
const EXTRA_BY = new Map(EXTRAS.map(e => [e.short, e]))
const LOWER_CLUBS = Object.fromEntries(Object.entries(LOWER).map(([k, list]) => [k, list.filter(([name, short]) => !taken.has(short) && !taken.has(norm(name))).map(([name, short]) => ({ name, short, country: k, extra: true, lower: true }))]))

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
const strikerNames = new Set([...(SOCCER_STRIKERS ?? []), ...(WC_STRIKERS ?? [])].map(p => norm(p.name)))
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
const STARS_WC = NATION_STARS.filter(([name, nation]) => NATION_BY.has(nation) && !strikerNames.has(norm(name)))
  .map(([name, nation, lvl, age]) => ({ name, team: nation, lvl, age }))

// ─── The goal model ──────────────────────────────────────────────────────────
// Dixon-Coles: independent Poissons with the four low scores (0-0, 1-0, 0-1, 1-1) reweighted
function dcScore(lh, la, rand) {
  const t00 = 1 - lh * la * RHO, t11 = 1 - RHO, tmax = Math.max(t00, t11, 1)
  for (let i = 0; i < 12; i++) {
    const h = poisson(lh, rand), a = poisson(la, rand)
    const tau = h > 1 || a > 1 ? 1 : h === 0 && a === 0 ? t00 : h === 0 ? 1 + lh * RHO : a === 0 ? 1 + la * RHO : t11
    if (rand() * tmax <= tau) return [h, a]
  }
  return [poisson(lh, rand), poisson(la, rand)]
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
  const lam = (x, y, h) => base * Math.exp(atk(x) - dfn(y) + h + (hostAdv ? hostAdv(x, y) : 0))
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
    if (uH) lh = lamC * fx.mult; else la = lamC * fx.mult
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
// Injuries: a spell out in about two seasons of five (strength is his durability), 1-9 weeks; small knocks
// keep him out of ~4% of matches; the manager rests him in early cup rounds. A first-choice No. 9 starts
// ~93% of the matches he's fit for and plays 90 in about half of them (more if he's strong and elite).
function spellsOf(rand, prof) {
  const p1 = clamp(0.42 - 0.025 * (prof.strength - 6), 0.18, 0.6)
  const u = [rand(), rand(), rand(), rand(), rand(), rand()]
  const out = []
  if (u[0] < p1) { const from = 1 + u[1] * 36; out.push([from, from + 1 + Math.floor(u[2] * u[2] * 9)]) }
  if (u[3] < p1 * 0.3) { const from = 1 + u[4] * 36; out.push([from, from + 1 + Math.floor(u[5] * u[5] * 6)]) }
  return out
}
function planOf(rand, S, wk, kind) {
  const u1 = rand(), u2 = rand(), u3 = rand(), u4 = rand()
  if (S.spells.some(([a, b]) => wk >= a && wk < b) || u1 < 0.04) return { avail: false, start: false, mins: 0, onEnd: false }
  const pStart = clamp(S.startP * (kind === 'cupEarly' ? 0.55 : kind === 'ucl' || kind === 'uel' || kind === 'wc' ? 1.04 : 1), 0, 0.99)
  if (u2 < pStart) {
    const full = u3 < S.p90 * (kind === 'wc' ? 1.2 : 1)
    return { avail: true, start: true, mins: full ? 90 : 60 + Math.floor(Math.pow(u4, 0.8) * 30), onEnd: full }
  }
  if (u3 < S.subP) return { avail: true, start: false, mins: 5 + Math.floor(u4 * 28), onEnd: true }
  return { avail: true, start: false, mins: 0, onEnd: false }
}

// ─── The striker in his side: the lift, his share, his streams ───────────────
// M: how much more (or less) the team scores with him on than with the real No. 9 he replaced. 20% of the
// chances he takes beyond the other man's would have been a teammate's; when he's the weaker one, half of
// the chances he doesn't get go to the others instead. A No. 9 who gets more of the ball pulls defenders
// with him (a little more for the others), and link-up play lifts them a little too.
function liftOf(b, r, lam, usage) {
  const sb = shareAt(b, lam, usage), sr = shareAt(r, lam)
  const lk = 1 + 0.006 * ((b.link ?? 6) - (r.link ?? 6)) + 0.1 * Math.max(0, sb - sr)
  const den = (1 - sr) + sr * r.F
  const absorb = sb >= sr ? 0.2 : 0.5
  return { M: clamp(((1 - sr - absorb * (sb - sr)) * lk + sb * b.F) / den, 0.7, 1.45), den, sb }
}
function strikerSide({ build, prof, team, mates, lamAvg, base, script }) {
  const usage = (team.career || team.squad || script) && team.usage ? clamp(team.usage, 0.2, 1.2) : 1
  const replaced = mates[0] ?? null
  // (who plays up front when he's off: the side's next striker, or a forward who can)
  const backup = mates.slice(1).find(p => p.role === 'ST' || p.role === 'SS') ?? mates.slice(1).find(isForward) ?? null
  const real = replaced?.prof ?? { share: 0.2, F: 1, link: 6 }
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
    startP: benchRole ? 0.16 : weaker ? 0.55 : 0.93,
    subP: benchRole ? 0.78 : 0.7,
    p90: clamp(0.40 + 0.03 * (prof.strength - 6) + (ovr - 85) * 0.01, 0.2, 0.72),
    spells: spellsOf(stream(base, 'injury'), prof),
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
  if (!mins) return line
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
const tableOut = (rows, U) => rows.map((r, i) => ({ short: r.short, name: r.name, played: r.played, wins: r.wins, draws: r.draws, losses: r.losses, gf: r.gf, ga: r.ga, gd: r.gd, points: r.points, pos: i + 1, isUs: r.short === U }))

// "Last season": a club's place by its rating (Career and the caller can pass the real one)
const LAST_PLACE = new Map()
for (const l of LEAGUES) clubsOf(l.id).slice().sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || (b.att + b.def) - (a.att + a.def) || (a.short < b.short ? -1 : 1)).forEach((c, i) => LAST_PLACE.set(c.short, i + 1))
const lastPlace = c => LAST_PLACE.get(c.short) ?? 10
const LEAGUE_ORDER = new Map(LEAGUES.map(l => [l.id, clubsOf(l.id).slice().sort((a, b) => lastPlace(a) - lastPlace(b))]))

// The two European competitions this season: 36 sides each
function europeEntrants(U, uRate, uComp) {
  const ucl = [], uel = []
  for (const l of LEAGUES) {
    const m = LEAGUE_META[l.key]
    const order = LEAGUE_ORDER.get(l.id)
    order.forEach((c, i) => { if (c.short === U) return; if (i < m.ucl) ucl.push(c); else if (i < m.ucl + m.uel) uel.push(c) })
  }
  const u = { ...CLUB_BY.get(U), ...uRate }
  if (uComp === 'ucl') ucl.push(u); else if (uComp === 'uel') uel.push(u)
  const fill = (list, comp) => {
    const pool = EXTRAS.filter(e => e.comp === comp).sort((a, b) => b.z - a.z || (a.short < b.short ? -1 : 1))
    const spare = EXTRAS.filter(e => e.comp !== comp).sort((a, b) => b.z - a.z)
    const out = list.slice()
    for (const e of [...pool, ...spare]) { if (out.length >= 36) break; if (!out.some(x => x.short === e.short)) out.push(e) }
    // too many top-five sides (a forced entry): the weakest other ones step aside
    while (out.length > 36) { const i = out.map((x, k) => [x, k]).filter(([x]) => x.short !== U).sort((a, b) => (a[0].att + a[0].def) - (b[0].att + b[0].def))[0][1]; out.splice(i, 1) }
    return out
  }
  return { ucl: fill(ucl, 'ucl'), uel: fill(uel.filter(c => !ucl.some(x => x.short === c.short)), 'uel') }
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
const EURO_WEEKS = { md: [4, 7, 10, 13, 16, 19, 21, 22], po: [24, 25], r16: [27, 28], qf: [32, 33], sf: [35, 36], f: 39.5 }
const EURO_NAME = { ucl: 'Champions League', uel: 'Europa League' }
function simEurope(comp, teams, ctx) {
  const { rand, hook, U, rate, out } = ctx
  const W = makeWorld({ rand, hook, U, rate, base: EURO_BASE, mA: G_ATT, mD: G_DEF, kA: K_ATT, kD: K_DEF, H: H_EURO, out })
  const rows = Object.fromEntries(teams.map(c => [c.short, rowOf(c, rand)]))
  const gf = Object.fromEntries(teams.map(c => [c.short, 0]))
  const draw = leaguePhaseDraw(teams, rand)
  const mine = shuffle(draw.filter(([h, a]) => h === U || a === U), rand)
  const rest = draw.filter(([h, a]) => h !== U && a !== U)
  mine.forEach(([h, a], md) => { const m = playFx(W, { comp, wk: EURO_WEEKS.md[md] ?? 22, home: h, away: a, meta: { round: `League phase · MD${md + 1}`, md: md + 1 } }); addResult(rows, h, a, m.hs, m.as); gf[h] += m.hs; gf[a] += m.as })
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
// The domestic cup. [round, calendar week, chance of a lower-division opponent, venue]
// venue: 'draw' (FA Cup: home drawn), 'lower' (the lower-division side hosts: Copa, Pokal, Coupe de France),
// 'seed' (the better side hosts: Coppa Italia), 'neutral' (finals; the FA Cup semis at Wembley), 'legs' (two legs)
const CUP_ROUNDS = {
  ENG: [['Third Round', 20, 0.72, 'draw'], ['Fourth Round', 24, 0.5, 'draw'], ['Fifth Round', 27, 0.35, 'draw'], ['Quarter-final', 30, 0.25, 'draw'], ['Semi-final', 33.5, 0.12, 'neutral'], ['Final', 39, 0.08, 'neutral']],
  ESP: [['First Round', 13, 1, 'lower'], ['Round of 32', 17.5, 0.8, 'lower'], ['Round of 16', 21, 0.45, 'lower'], ['Quarter-final', 24.5, 0.3, 'draw'], ['Semi-final', [27, 31], 0.18, 'legs'], ['Final', 34, 0.1, 'neutral']],
  ITA: [['Round of 64', 0.5, 0.6, 'seed'], ['Round of 32', 12, 0.3, 'seed'], ['Round of 16', 17, 0.1, 'seed'], ['Quarter-final', 22, 0.05, 'seed'], ['Semi-final', [26, 31], 0.03, 'legs'], ['Final', 36, 0.03, 'neutral']],
  GER: [['First Round', 0.5, 1, 'lower'], ['Second Round', 10, 0.55, 'lower'], ['Round of 16', 17, 0.42, 'lower'], ['Quarter-final', 23, 0.3, 'lower'], ['Semi-final', 29, 0.18, 'lower'], ['Final', 38.5, 0.1, 'neutral']],
  FRA: [['Round of 64', 16, 0.95, 'lower'], ['Round of 32', 19, 0.75, 'lower'], ['Round of 16', 22, 0.55, 'lower'], ['Quarter-final', 26, 0.42, 'lower'], ['Semi-final', 29, 0.3, 'lower'], ['Final', 34.5, 0.18, 'neutral']],
}
function simCup(L, ctx, U, uPlace) {
  const { rand, hook, rate, out } = ctx
  const lb = LEAGUE_BASE.get(L.id)
  const W = makeWorld({ rand, hook, U, rate, base: lb.base, mA: lb.mA, mD: lb.mD, kA: K_ATT, kD: K_DEF, H: H_DOM, out })
  const rounds = CUP_ROUNDS[L.key] ?? CUP_ROUNDS.ENG
  // the Coppa Italia's top eight seeds start in the round of 16
  const start = L.key === 'ITA' && uPlace <= 8 ? 2 : 0
  const peers = clubsOf(L.id).filter(c => c.short !== U)
  const lowers = shuffle(LOWER_CLUBS[L.key] ?? [], rand)
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
function otherCupWinner(L, rand) {
  const lb = LEAGUE_BASE.get(L.id)
  return pickWeighted(clubsOf(L.id), c => Math.exp((((c.att - lb.mA) / SD_ATT + (c.def - lb.mD) / SD_DEF) / 2) * 1.4), rand).short
}

// The whole season around one club: all five leagues, both European competitions, the cup
function clubWorld({ U, uRate, uComp, uPlace, hook, rand }) {
  const out = []
  const lowerRates = new Map()
  const rate = s => (s === U ? uRate : CLUB_BY.get(s) ?? EXTRA_BY.get(s) ?? lowerRates.get(s) ?? { att: G_ATT - 10, def: G_DEF - 10 })
  const uL = leagueOfClub(CLUB_BY.get(U))
  const leagues = {}
  for (const L of LEAGUES) {
    const cs = clubsOf(L.id)
    const lb = LEAGUE_BASE.get(L.id)
    const W = makeWorld({ rand, hook, U, rate, base: lb.base, mA: lb.mA, mD: lb.mD, kA: K_ATT, kD: K_DEF, H: H_DOM, out })
    const rows = Object.fromEntries(cs.map(c => [c.short, rowOf(c, rand)]))
    const sched = roundRobin(cs.map(c => c.short), rand)
    const scale = 38 / Math.max(1, sched.length)
    sched.forEach((round, ri) => {
      for (const [h, a] of round) {
        if (h !== U && a !== U) { const [hs, as] = quickScore(W, h, a); addResult(rows, h, a, hs, as); continue }
        const m = playFx(W, { comp: 'league', wk: (ri + 1) * scale, home: h, away: a, meta: { round: `Matchweek ${ri + 1}`, mw: ri + 1 } })
        addResult(rows, h, a, m.hs, m.as)
      }
    })
    leagues[L.id] = { id: L.id, key: L.key, table: tableOut(sortRows(Object.values(rows)), U), games: sched.length }
  }
  const ent = europeEntrants(U, uRate, uComp)
  const ectx = { rand, hook, U, rate, out }
  const ucl = simEurope('ucl', ent.ucl, ectx)
  const uel = simEurope('uel', ent.uel, ectx)
  const cups = {}
  for (const L of LEAGUES) cups[L.id] = L.id === uL.id ? simCup(L, { rand, hook, rate, out, lowerRates }, U, uPlace) : { name: LEAGUE_META[L.key].cup, winner: otherCupWinner(L, rand) }
  return { U, lid: uL.id, uRate, uComp, leagues, ucl, uel, cups, fixtures: out, lower: Object.fromEntries(lowerRates) }
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
function wcGroups() {
  const g = Object.fromEntries(GROUP_LETTERS.map(l => [l, NATIONS.filter(n => String(n.group ?? '').toUpperCase() === l)]))
  if (GROUP_LETTERS.every(l => g[l].length === 4)) return g
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
  const MD = [[[0, 1], [2, 3]], [[0, 2], [3, 1]], [[3, 0], [1, 2]]]
  for (const l of GROUP_LETTERS) {
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
  return { U, uRate, groups: groupsOut, bracket, reached, gf, matches, champion: bracket.final.winner, fixtures: out }
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
const POS_BONUS = (pos, size) => (pos === 1 ? 7 : pos === 2 ? 4 : pos <= 4 ? 2.5 : pos <= 7 ? 1 : pos > size - 3 ? -2 : 0)
const EURO_PTS = { ucl: { Winners: 14, Final: 6, 'Semi-finals': 3, 'Quarter-finals': 1 }, uel: { Winners: 5, Final: 2, 'Semi-finals': 1 } }
function trophyPts({ league, ucl, uel, cup }) {
  return (league === 1 ? 8 : 0) + (EURO_PTS.ucl[ucl] ?? 0) + (EURO_PTS.uel[uel] ?? 0) + (cup ? 3 : 0)
}
// a Ballon d'Or case: goals and half the assists (all competitions), and the trophies, weighed by how big a
// part of them he was (a 12-goal striker on a title side gets about a third of the credit, a 35-goal one all of it)
const bdoCase = (goals, assists, trophies, value = 0) => { const own = goals + 0.5 * assists + value; return own + trophies * clamp((own - 10) / 25, 0.2, 1) }
function clubField(world, rand, exclude, mine) {
  // mine: the build's league goals (his club's other starting striker scores from what's left)
  const field = []
  for (const L of LEAGUES) {
    const lg = world.leagues[L.id]
    const size = lg.table.length
    for (const row of lg.table) {
      const list = (CLUB_STRIKERS.get(row.short) ?? []).filter(p => !exclude.has(p.name)).slice(0, 5)
      if (!list.length) continue
      const isU = row.short === world.U
      // (his club: the build scored `mine` of its goals; the others share the rest)
      const taken = isU && row.gf ? clamp((mine ?? 0) / row.gf, 0, 0.7) : 0
      const sc = scorersOf(list, row.gf, lg.games, rand, taken)
      const gl = shareGoals(sc, Math.max(0, row.gf - (isU ? mine ?? 0 : 0)), rand, taken)
      const ucl = world.ucl.reached[row.short] ?? null, uel = world.uel.reached[row.short] ?? null
      const euroGf = world.ucl.gf[row.short] ?? world.uel.gf[row.short] ?? 0
      const cupWin = world.cups[L.id]?.winner === row.short
      const trophies = trophyPts({ league: row.pos, ucl, uel, cup: cupWin })
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
function clubStars(world, rand) {
  return STARS_CLUB.map(s => {
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
const STAGE_PTS = { Winners: 10, 'Runners-up': 7, 'Third place': 5, 'Fourth place': 4, 'Quarter-finals': 2, 'Round of 16': 1, 'Round of 32': 0, 'Group stage': -2 }
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
  const fin = g('finishing'), sp = g('shotPower'), hd = g('heading'), dr = g('dribbling'), ft = g('firstTouch')
  const lu = g('linkUp'), pa = g('pace'), st = g('strength'), ob = g('offBall'), co = g('composure')
  const vals = filled.map(t => build[t].val ?? 0)
  const spread = Math.max(...vals) - Math.min(...vals), mean = avg(vals)
  const ranked = [['fin', fin], ['sp', sp], ['hd', hd], ['dr', dr], ['ft', ft], ['lu', lu], ['pa', pa], ['st', st], ['ob', ob], ['co', co]].sort((a, b) => b[1] - a[1])
  const t1 = ranked[0][0], t2 = ranked[1][0], t3 = ranked[2][0]
  const top = k => t1 === k || t2 === k, top3 = k => top(k) || t3 === k, peak = k => t1 === k
  const complete = (spread <= 2 && mean >= 7.5) || vals.filter(v => v >= 8).length >= 8
  const poacher = ((top('fin') && top3('ob')) || (top('ob') && top3('fin'))) && !peak('pa')
  const fox = poacher && pa <= 6
  const target = top3('hd') && top3('st')
  const falseNine = top('lu') && (top3('dr') || top3('ft'))
  const deep = top('lu') && (top3('st') || top3('ft'))
  const runner = top('pa') && top3('ob')
  const advanced = top('pa') && top3('fin')
  const iceCold = top('co') && top3('fin')
  const holdUp = top('st') && top3('ft')
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
const clubName = s => CLUB_BY.get(s)?.name ?? EXTRAS.find(e => e.short === s)?.name ?? Object.values(LOWER_CLUBS).flat().find(e => e.short === s)?.name ?? s
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
  if (!world) {
    const place = team?.lastPos ?? lastPlace(club)
    const uComp = team?.europe !== undefined ? team.europe : place <= meta.ucl ? 'ucl' : place <= meta.ucl + meta.uel ? 'uel' : null
    world = clubWorld({ U, uRate, uComp, uPlace: place, hook: hookFor(S, base), rand: stream(base, 'world') })
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
  const euroGames = all.filter(m => m.comp === 'ucl' || m.comp === 'uel')
  const t = totalsOf(games)
  const tAll = totalsOf(all)
  // the table, the cup, Europe
  const lg = world.leagues[L.id]
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
  const qualified = pos <= meta.ucl ? 'ucl' : pos <= meta.ucl + meta.uel || cup.champion ? 'uel' : pos === meta.ucl + meta.uel + 1 ? 'uecl' : null
  // the award field
  const fr = stream(base, 'field')
  const exclude = new Set(script ? mates.filter(p => p.role === 'ST').map(p => p.name) : S.replaced ? [S.replaced.name] : [])
  const field = script?.field ?? clubField(world, fr, exclude, t.goals)
  const stars = script?.stars ?? clubStars(world, stream(base, 'stars'))
  const book = {
    meta: { boot: meta.boot, poty: meta.poty },
    league: field.filter(x => x.lid === L.id && x.fwd).map(x => ({ name: x.name, team: x.team, goals: x.goals, assists: x.assists, pots: r1(x.pots) })),
    leagueMids: field.filter(x => x.lid === L.id && !x.fwd).map(x => ({ name: x.name, team: x.team, pots: r1(x.pots) })),
    stars: stars.filter(x => x.lid === L.id).map(x => ({ name: x.name, team: x.team, pots: r1(x.pots) })),
    shoe: field.filter(x => x.fwd).map(x => ({ name: x.name, team: x.team, lid: x.lid, goals: x.goals })),
    bdo: [...field.map(x => ({ name: x.name, team: x.team, score: bdoCase(x.goalsAll, x.assistsAll, x.trophies, x.value * 1.4) + (x.vote ?? 0) })), ...stars.map(x => ({ name: x.name, team: x.team, score: x.bdo }))],
    posBonus: POS_BONUS(pos, size),
    trophies: trophyPts({ league: pos, ucl: uComp === 'ucl' ? E.reached[U] : null, uel: uComp === 'uel' ? E.reached[U] : null, cup: cup.champion }),
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
    league: { id: L.id, name: L.name, short: L.short, country: L.country, cup: meta.cup, boot: meta.boot, poty: meta.poty, size, games: lg.games },
    wins: row.wins, draws: row.draws, losses: row.losses, points: row.points, gf: row.gf, ga: row.ga, gd: row.gd,
    seed: pos, conference: L.id, standings: lg.table, champion,
    madePlayoffs: qualified === 'ucl', playoffs: qualified === 'ucl',
    playoffRounds: ties, games, gameLog: games.map(g => g.result), bestGame: bestOf(games),
    finalsOpp: euroFinal?.opponent ?? null, finalsSeries: scoreLine(euroFinal),
    ...t, ...seasonFields(t), allComps: tAll, byComp, fixtures: all,
    cup: { name: cup.name, rounds: cupTies, result: cup.result, champion: cup.champion, winner: cup.winner },
    europe, trophies, qualified, relegated: pos > size - meta.down, relegationPlayoff: meta.playoff && pos === size - meta.down,
    otherLeagues: Object.fromEntries(Object.entries(world.leagues).filter(([id]) => id !== L.id).map(([id, x]) => [id, { champion: x.table[0]?.short, top: x.table.slice(0, 4) }])),
    europeWinners: { ucl: world.ucl.winner, uel: world.uel.winner },
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
  if (!world) world = wcWorld({ U, uRate, hook: hookFor(S, base), rand: stream(base, 'world') })
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
    sport: 'soccer', mode: 'alltime', position: 'st', gameMode, season: '2026',
    ovr, archetype: getSoccerArchetype(ovr, build, types),
    team: { ...nat, ...(team ?? {}), att: r1(uRate.att), def: r1(uRate.def) },
    wins: row.wins, draws: row.draws, losses: row.losses, points: row.points, gf: row.gf, ga: row.ga, gd: row.gd,
    seed: row.pos, conference: group, standings: table, groups: world.groups, bracket: world.bracket,
    champion: finish === 'Winners', madePlayoffs: finish !== 'Group stage', playoffs: finish !== 'Group stage', finish,
    playoffRounds: kos, games, gameLog: games.map(g => g.result), bestGame: bestOf(games), fixtures: games,
    finalsOpp: fin?.opponent ?? null, finalsSeries: scoreLine(fin),
    ...t, ...seasonFields(t), allComps: t, trophies: finish === 'Winners' ? ['World Cup'] : [],
    worldChampion: world.champion,
    ...awards, book,
  }
}

// ─── Squad Builder: what one striker does to his side ────────────────────────
// The side's attack with this build in place of its real No. 9 (the lift M, as a rating on the side's own
// att scale), so a squad's strength can be worked out before scriptSoccerSeason plays the season.
export function soccerStrikerLift(build, team, mode = 'current') {
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
  return (script?.mode ?? mode) === 'alltime' ? wcSeason(build, t, team, base, gameMode, script) : clubSeason(build, t, team, base, gameMode, script)
}
// The squad's one season: every result decided once from its strength (`tr`: { att, def } on the club or
// nation scale; { off, def } too). The award field leaves out every real striker of the side (the squad's
// builds are its strikers).
export function scriptSoccerSeason(team, tr, rngSeed, mode = 'current') {
  const base = seedBase(rngSeed)
  if (mode === 'alltime') {
    const nat = resolveNation(team)
    const uRate = ratingsOf(nat, team, 'alltime', tr)
    const world = wcWorld({ U: nat.short, uRate, hook: nullHook, rand: stream(base, 'world') })
    const fixtures = world.fixtures.map(({ plan, ...f }) => f)
    const g = fixtures.filter(f => f.stage === 'group')
    return { sport: 'soccer', mode, team: nat.short, tr: uRate, world: { ...world, fixtures }, wins: g.filter(f => f.mySc > f.oppSc).length, draws: g.filter(f => f.mySc === f.oppSc).length, losses: g.filter(f => f.mySc < f.oppSc).length, champion: world.champion === nat.short, finish: world.reached[nat.short] }
  }
  const club = resolveClub(team)
  const L = leagueOfClub(club), meta = LEAGUE_META[L.key]
  const uRate = ratingsOf(club, team, 'current', tr)
  const place = team?.lastPos ?? lastPlace(club)
  const uComp = team?.europe !== undefined ? team.europe : place <= meta.ucl ? 'ucl' : place <= meta.ucl + meta.uel ? 'uel' : null
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
