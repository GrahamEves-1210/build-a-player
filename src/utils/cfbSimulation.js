// ══════════════════════════════════════════════════════════════════════════════
// College Football mode: the season engine (mode id 'cfb', positions 'qb' | 'rb' | 'wr')
// ══════════════════════════════════════════════════════════════════════════════
//
// runCFBSimulation(build, types, team, position, rngSeed, gameMode, script, opts) → result
//
//   build     football's build shape: { [traitKey]: { type, val (0-11), qbFull, team } } with the NFL trait keys
//   types     the trait list (TYPES / RB_TYPES / WR_TYPES or a LITE list); defaults by position
//   team      a CFB_TEAMS row (or its short). The season director's team mods (team.off / team.def moved) count.
//   position  'qb' | 'rb' | 'wr'
//   rngSeed   any string/number. Same seed + same inputs = the same season, to the box score (no Math.random).
//   gameMode  stored on the result (the OVR/sim don't change by mode)
//   script    null, a scriptCFBSeason() result (the team's results are forced, the build only makes its line),
//             or { games, keepLines: true } (finalizeCFBSeason: the director's games as played)
//   opts      { leagueSeed, year }: leagueSeed keeps the rest of the country's season fixed while rngSeed
//             changes (the director re-runs a season many times); year = the build's class ('FR'…'RS-SR'), 'JR' default
//             noClass: the build has no class (College Football mode: a season is a year, he's always draft-eligible,
//             cfb.draft.year is null and it always declares); career: his earlier college seasons (the draft board)
//             pools: { qb, rb, wr } rosters in place of the data's (College Football mode's later seasons: cfbShared seasonData)
//
// THE RESULT (football's contract first, so SimPage, the saves and lib/seasonDirector read it unchanged):
// {
//   sport: 'cfb', position, gameMode, seed, leagueSeed, team, ovr, archetype, wins, losses,
//   games: [12 regular-season games, by week: {
//     wk (1-12), opponent (name), oppShort, home (bool), neutral (bool), confGame (bool), fcs (bool), won, mySc, oppSc, ot,
//     QB: comp, att, passYds, tds, ints, rushAtt, rushYds (sacks count as runs, the college way), rushTDs, sacks, rating (NFL), eff (NCAA)
//     RB: carries, rushYds, rushTDs, ypc, recs, recYds, recTDs, fumbles, long
//     WR: targets, rec, recYds, recTDs, long
//     meta: { week (calendar 0-13), label ('Week 3'), date ('Sep 19'), myRank, oppRank (AP before kickoff, null = unranked), oppRec, oppConf }
//   }],
//   highlights, bestGame,
//   season totals (REGULAR SEASON ONLY, football's keys, what the director re-adds from `games`):
//     QB: seasonPassYds, seasonTDs, seasonINTs, seasonRushYds, seasonRushTDs, seasonSacks, seasonAttempts, seasonCompletions,
//         seasonCompPct, seasonRating (NFL formula, for football's UI), seasonEff (NCAA passer efficiency)
//     RB: seasonRushYds, seasonRushTDs, seasonCarries, seasonYPC, seasonFumbles, seasonRecYds, seasonRecTDs, seasonRecs, seasonLong, hundredYardGames
//     WR: seasonRecs, seasonRecYds, seasonRecTDs, seasonTargets, seasonYPR, seasonLong, hundredYardGames, catchRate
//   playoffs (made the CFP), hasBye (a top-4 seed), playoffRounds (CFP games: { round: 'First Round' | 'Quarterfinal' |
//     'Semifinal' | 'National Championship', bowl, label, site, date, opponent, oppShort, oppSeed, mySeed, home, neutral, won,
//     mySc, oppSc, ot, overtime, ...line }), sbResult ({ won: true, ...line } national champion | { won: false, round, pwins }),
//   champion (national champion), award ({ userWins: won the Heisman, name: 'Heisman Trophy' }),
//
//   CFB fields:
//   cfb: {
//     record: { w, l (regular season), confW, confL, selection (with the title game), final (with the postseason) }, conf: { id, short, name },
//     postseason: [every postseason game in order: the conference title game, then the CFP rounds or the bowl],
//     confChampionship: null | { ...game, title: 'SEC Championship' }, confChamp (bool), bowl: null | { ...game } (non-CFP bowl),
//     cfpSeed: null | 1-12,
//     totals: { regular, throughCCG (what award voters saw), full (with the postseason) } in the season* keys above,
//     ap: [{ label, week, date, top25: [{ rank, short, rec, pts, fpv }], myRank }]   (Preseason … Final; names: CFB_TEAM_BY_SHORT)
//     cfpRankings: [{ label, week, date, top25: [{ rank, short, rec }], myRank }]  (from Week 10 to Selection Day)
//     apPath: [{ label, rank (null = unranked), rec }]   (the build's team, poll by poll: the week-by-week AP line)
//     standings: [{ id, short, name, teams: [{ short, confW, confL, w, l (regular season), selection, final, finalW, finalL, ap (final AP), cfp (Selection Day) }],
//                   title: game | null, champion }]   (conference records never include the title game)
//     playoff: { field: [{ seed, short, name, conf, rec (Selection Day), final (after the CFP), cfpRank, bid: 'auto' | 'at-large', why }], games: [...all 11], champion, runnerUp }
//     (every poll's and ranking's rec is the record on the day it came out)
//     bowls: [{ bowl, site, date, a, b, aSc, bSc, winner }],
//     awards: {
//       heisman: { winner, finalists, ballot: [{ name, team, pos, pts, first, second, third, line, isUser }], userPlace, userFinalist, userWon },
//       daveyOBrien / doakWalker / biletnikoff / maxwell / walterCamp: { award, winner, finalists, userWon, userFinalist },
//       allAmerica: { first: { qb, rb, wr }, second: { qb, rb, wr }, user: 'first' | 'second' | null },
//       allConference: { conf, first, second, user }, confPOY: { award, winner, userWon },
//     },
//     leaders: null | { key, label, rows: [{ name, team, year, isUser, value }] (top 10), rank, of }   (regular season, every FBS starter at his position)
//     draft: { year (null: no class), eligible, declares, tier ('top10' | 'r1' | 'day2' | 'day3' | 'pfa' | 'udfa'), label, round, pick ([lo, hi] overall
//              picks of 224, null undrafted), overall (his place on the big board), note, draftYear, boardRank, boardOf,
//              board (the top 25 at his position: { name, team, year, ovr, isUser, tier, yds, td }) }
//   }
// }
// Players in award lists: { name, team (short), teamName, pos ('QB'|'RB'|'WR'), conf, year, isUser, line: 'season line text', stats }
//
// Exports: runCFBSimulation, scriptCFBSeason, finalizeCFBSeason, cfbSeasonTotals, cfbLeague, calcCFBOVR, cfbPasserEfficiency,
//          CFB_GAME_LINE, CFB_RESEARCH, CFB_TYPES_BY_POS
//
// ── THE NUMBERS (research, cited) ────────────────────────────────────────────
// Sources: sports-reference.com/cfb (season and team pages, FBS team averages), cfbstats.com (national team
// averages), ESPN (Heisman/award coverage, FPI), heisman.com (2025 press packet), collegefootballplayoff.com.
// • Scoring: FBS teams averaged about 27-28 points a game in 2022-2025 (sports-reference FBS team offense
//   averages; 27.5 used). About 390 total yards a team-game: ~31 pass attempts, 61-62% completions, ~7.3
//   yards an attempt, ~4.4 a rush with sacks counted as runs (the NCAA counts sack yards as rushing).
// • Home field: about 2.5-3 points (SP+/FPI home edge; 2.6 used). The final margin misses the expected one
//   by an SD of about 15-16 points in college (closing-line studies), against about 13.5 in the NFL; each
//   side's score here has an SD of about 11, so a margin's is about 15.6.
// • Upsets: ranked teams beat unranked opponents about 80-85% of the time; an AP top-10 team loses to an
//   unranked one in roughly 6-8% of those games (sports-reference poll/results data).
// • Unbeaten regular seasons are rare: 2021 Georgia, Cincinnati; 2022 Georgia, Michigan, TCU; 2023 Michigan,
//   Washington, Florida State, Liberty; 2024 Oregon; 2025 Indiana, Ohio State. About 1-4 a year out of
//   ~136 FBS teams, and the best team in the country goes 12-0 roughly a quarter to a third of the time.
// • QB lines by tier (FBS starters, full season with the postseason, ~13 games):
//     elite P4 (Heisman / O'Brien finalists) 3,500-4,500 yds, 30-42 TD, 4-9 INT, 66-72%, efficiency 165-200
//     good P4 starter 2,800-3,400 yds, 20-28 TD, 7-10 INT, 63-67%
//     average FBS starter 2,300-2,900 yds, 16-22 TD, 8-11 INT, 60-63%, efficiency ~135-145
//     poor starter 1,600-2,200 yds, 10-15 TD, 9-13 INT, 55-59%
//   Heisman QBs (final lines, sports-reference): Burrow '19 5,671 yds 60 TD 6 INT; Murray '18 4,361-42-7 plus
//   1,001 rush 12 TD; Mayfield '17 4,627-43-6; Young '21 4,872-47-7; Williams '22 4,537-42-5; Daniels '23
//   3,812-40-4 plus 1,134 rush 10 TD; Jackson '16 3,543-30-9 plus 1,571 rush 21 TD; Mendoza '25 (Indiana, 13-0
//   at the vote) about 2,980 yds 33 TD 6 INT. Non-QB winners: Henry '15 (RB) 2,219 rush 28 TD; Smith '20 (WR)
//   117-1,856-23; Hunter '24 (WR/CB) 96-1,258-15. QBs have won ~20 of the last 25; team success is near
//   mandatory (winners' teams: 11-1 or better at the vote in most years).
// • RB tiers: elite (Doak Walker) 1,500-2,600 rush yds, 17-29 TD, 6.0-7.0 a carry (Jeanty '24 2,601 yds 29 TD;
//   Gordon '23 1,732-21; Robinson '22 1,580-18; Walker III '21 1,636-18); good 1,100-1,400 yds 10-15 TD;
//   average RB1 700-1,000 yds 6-9 TD ~5.0 a carry; poor 400-650.
// • WR tiers: elite (Biletnikoff) 1,300-1,900 yds, 85-115 rec, 12-20 TD (Nabers '23 89-1,569-14; Addison '21
//   100-1,593-17; Chase '19 84-1,780-20); good 900-1,200 yds 60-80 rec 7-10 TD; average WR1 650-850 yds
//   50-60 rec 5-6 TD; poor 350-500.
// • Heisman ballots: 3-2-1, about 930 (870 media, the living winners, one fan vote). 2025: Mendoza 2,362 pts,
//   Pavia 1,435, Love 719, Sayin 432: four finalists, as most years (heisman.com 2025 press packet).
// • THE 2026 CFP (12 teams; the CFP kept 12 for 2026 on Jan. 23, 2026): automatic bids to the SEC, Big Ten,
//   Big 12 and ACC champions, plus the highest-ranked Group of Six team (it doesn't have to be a champion), and
//   Notre Dame is in if it finishes in the top 12 (a change from 2024-25's "five highest-ranked conference
//   champions"; reported by The Athletic / SI, Jan. 27, 2026). The rest are at-large. Straight seeding (since
//   2025): the top four RANKED teams get the byes, seeds 5-8 host the first round (Dec. 18-19) on campus. 2026-27
//   sites (CFP / NCAA.com schedule): quarterfinals Fiesta (Dec. 30), Cotton, Rose, Peach (Jan. 1); semifinals
//   Orange (Jan. 14) and Sugar (Jan. 15); the national championship Jan. 25, 2027, Allegiant Stadium, Las Vegas.
// • Bowls: 46 postseason games in 2026-27 (ESPN), so 35 non-CFP bowls for 70 teams; 6 wins make a team
//   eligible, one win over an FCS team counts toward it.
// • Conference schedules 2026: SEC, Big Ten and Big 12 play nine conference games (the SEC from 2026), the ACC
//   eight, the rest eight (the eight-team Pac-12 a seven-game round robin). Title games: the top two by
//   conference record. P4 teams play mostly P4 opponents plus one or two G5/FCS games (the Big Ten no FCS).
// • Draft eligibility: three years out of high school (true juniors, redshirt sophomores and up). A FR/SO
//   (true sophomore) can't declare.
// ══════════════════════════════════════════════════════════════════════════════

import { calcOVR, calcOVRRB, calcOVRWR, getArchetype, getArchetypeRB, getArchetypeWR } from './simulation'
import { TYPES } from '../data/qbs'
import { RB_TYPES } from '../data/rbs'
import { WR_TYPES } from '../data/wrs'
import { CFB_CONFERENCES } from '../data/cfb-conferences'
import { CFB_TEAMS } from '../data/cfb-teams'
import { CFB_QBS, CFB_RBS, CFB_WRS } from '../data/cfb-players'
import { seeded } from '../lib/rng'

export const CFB_TYPES_BY_POS = { qb: TYPES, rb: RB_TYPES, wr: WR_TYPES }

export const CFB_RESEARCH = {
  ppg: 27.5, homeEdge: 2.6, scoreSD: 11, marginSD: 15.6,
  qbTiers: { elite: [3500, 4500, 30, 42], good: [2800, 3400, 20, 28], average: [2300, 2900, 16, 22], poor: [1600, 2200, 10, 15] },
  rbTiers: { elite: [1500, 2600, 17, 29], good: [1100, 1400, 10, 15], average: [700, 1000, 6, 9], poor: [400, 650, 2, 5] },
  wrTiers: { elite: [1300, 1900, 12, 20], good: [900, 1200, 7, 10], average: [650, 850, 5, 6], poor: [350, 500, 2, 4] },
}

// ── Small helpers ─────────────────────────────────────────────────────────────
const clamp = (lo, hi, v) => Math.min(hi, Math.max(lo, v))
const keyOf = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
function gauss(r) {
  const u = r() || 1e-9, v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
function binom(r, n, p) {
  if (n <= 0 || p <= 0) return 0
  if (p >= 1) return n
  if (n > 12) {
    // (normal approximation: same mean and spread, a fraction of the draws)
    const z = (r() + r() + r() + r() - 2) * 1.732
    return clamp(0, n, Math.round(n * p + z * Math.sqrt(n * p * (1 - p))))
  }
  let k = 0
  for (let i = 0; i < n; i++) if (r() < p) k++
  return k
}
// a cheap bell curve (sum of uniforms), SD 1
const bell = r => (r() + r() + r() + r() - 2) * 1.732
function poisson(r, lam) {
  if (lam <= 0) return 0
  const L = Math.exp(-Math.min(lam, 30))
  let k = 0, p = 1
  do { k++; p *= r() } while (p > L)
  return k - 1
}
const shuffle = (r, arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const pick = (r, arr) => arr[Math.floor(r() * arr.length)]

// Official NFL passer rating (football's UI reads seasonRating)
function nflRating(c, a, y, t, i) {
  if (!a) return 0
  const A = clamp(0, 2.375, (c / a - 0.3) * 5), B = clamp(0, 2.375, (y / a - 3) * 0.25)
  const C = clamp(0, 2.375, (t / a) * 20), D = clamp(0, 2.375, 2.375 - (i / a) * 25)
  return Math.round(((A + B + C + D) / 6) * 1000) / 10
}
// NCAA passer efficiency rating
export function cfbPasserEfficiency(c, a, y, t, i) {
  if (!a) return 0
  return Math.round(((8.4 * y + 330 * t + 100 * c - 200 * i) / a) * 10) / 10
}

// ── Calendar (2026) ──────────────────────────────────────────────────────────
const WEEKS = 14   // calendar weeks 0-13: Week 0 (Aug 29) … Week 13 (Nov 28); 12 games, two open dates
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dateOf = w => { const d = new Date(Date.UTC(2026, 7, 29 + w * 7)); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` }
const CCG_DATE = 'Dec 5'
const SELECTION_DATE = 'Dec 6'
const NCG = { round: 'National Championship', bowl: 'CFP National Championship', site: 'Allegiant Stadium, Las Vegas', date: 'Jan 25, 2027' }
const QF_BOWLS = {
  Fiesta: { bowl: 'Fiesta Bowl', site: 'State Farm Stadium, Glendale, Ariz.', date: 'Dec 30' },
  Cotton: { bowl: 'Cotton Bowl', site: 'AT&T Stadium, Arlington, Texas', date: 'Jan 1, 2027' },
  Rose:   { bowl: 'Rose Bowl', site: 'Rose Bowl, Pasadena, Calif.', date: 'Jan 1, 2027' },
  Peach:  { bowl: 'Peach Bowl', site: 'Mercedes-Benz Stadium, Atlanta', date: 'Jan 1, 2027' },
}
const SF_BOWLS = [
  { bowl: 'Orange Bowl', site: 'Hard Rock Stadium, Miami Gardens, Fla.', date: 'Jan 14, 2027' },
  { bowl: 'Sugar Bowl', site: 'Caesars Superdome, New Orleans', date: 'Jan 15, 2027' },
]
const QF_PREF = { B1G: ['Rose', 'Fiesta', 'Cotton', 'Peach'], SEC: ['Peach', 'Cotton', 'Fiesta', 'Rose'], ACC: ['Peach', 'Cotton', 'Fiesta', 'Rose'], B12: ['Cotton', 'Fiesta', 'Peach', 'Rose'], IND: ['Cotton', 'Fiesta', 'Peach', 'Rose'], G5: ['Fiesta', 'Cotton', 'Peach', 'Rose'] }
// The non-CFP bowls, best first (names from the 2025-26 slate; dates approximate for 2026-27)
const BOWLS = [
  ['Citrus Bowl', 'Orlando, Fla.', 'Dec 31'], ['ReliaQuest Bowl', 'Tampa, Fla.', 'Dec 31'], ['Alamo Bowl', 'San Antonio', 'Dec 29'],
  ['Gator Bowl', 'Jacksonville, Fla.', 'Dec 28'], ['Las Vegas Bowl', 'Las Vegas', 'Dec 26'], ['Pop-Tarts Bowl', 'Orlando, Fla.', 'Dec 27'],
  ['Holiday Bowl', 'San Diego', 'Dec 30'], ['Music City Bowl', 'Nashville, Tenn.', 'Dec 30'], ["Duke's Mayo Bowl", 'Charlotte, N.C.', 'Dec 26'],
  ['Texas Bowl', 'Houston', 'Dec 31'], ['Liberty Bowl', 'Memphis, Tenn.', 'Jan 2, 2027'], ['Sun Bowl', 'El Paso, Texas', 'Dec 31'],
  ['Pinstripe Bowl', 'Bronx, N.Y.', 'Dec 26'], ['Arizona Bowl', 'Tucson, Ariz.', 'Dec 27'], ['Military Bowl', 'Annapolis, Md.', 'Dec 28'],
  ['Fenway Bowl', 'Boston', 'Dec 27'], ['Birmingham Bowl', 'Birmingham, Ala.', 'Dec 27'], ['Armed Forces Bowl', 'Fort Worth, Texas', 'Jan 2, 2027'],
  ['Independence Bowl', 'Shreveport, La.', 'Dec 30'], ['LA Bowl', 'Inglewood, Calif.', 'Dec 19'], ['First Responder Bowl', 'Dallas', 'Dec 22'],
  ['GameAbove Sports Bowl', 'Detroit', 'Dec 26'], ['Frisco Bowl', 'Frisco, Texas', 'Dec 22'], ['New Mexico Bowl', 'Albuquerque, N.M.', 'Dec 19'],
  ['Famous Idaho Potato Bowl', 'Boise, Idaho', 'Dec 22'], ['Boca Raton Bowl', 'Boca Raton, Fla.', 'Dec 22'], ['New Orleans Bowl', 'New Orleans', 'Dec 20'],
  ['Cure Bowl', 'Orlando, Fla.', 'Dec 19'], ['Myrtle Beach Bowl', 'Conway, S.C.', 'Dec 21'], ['Camellia Bowl', 'Montgomery, Ala.', 'Dec 20'],
  ['68 Ventures Bowl', 'Mobile, Ala.', 'Dec 23'], ["Hawai'i Bowl", 'Honolulu', 'Dec 24'], ['Salute to Veterans Bowl', 'Montgomery, Ala.', 'Dec 16'],
  ['Bahamas Bowl', 'Nassau, Bahamas', 'Dec 17'], ['Xbox Bowl', 'Frisco, Texas', 'Dec 18'],
]

// FCS opponents (unmirrored: they only exist as a game on an FBS schedule). r = strength against an average
// FBS team in points: the FCS's best are about a bad FBS team, the rest lose to a P4 team by 35+.
const FCS = [
  ['NDSU', 'North Dakota State', -8], ['SDSU-J', 'South Dakota State', -10], ['MTST', 'Montana State', -10], ['MONT', 'Montana', -13],
  ['UND', 'North Dakota', -16], ['SDAK', 'South Dakota', -16], ['UCD', 'UC Davis', -16], ['VILL', 'Villanova', -17], ['UNI', 'Northern Iowa', -18],
  ['IDHO', 'Idaho', -17], ['ILST', 'Illinois State', -17], ['YSU', 'Youngstown State', -20], ['FUR', 'Furman', -20], ['MER', 'Mercer', -18],
  ['CHAT', 'Chattanooga', -19], ['ETSU', 'East Tennessee State', -21], ['SAM', 'Samford', -23], ['WOF', 'Wofford', -24], ['WCU', 'Western Carolina', -22],
  ['CIT', 'The Citadel', -27], ['VMI', 'VMI', -30], ['EKU', 'Eastern Kentucky', -22], ['APSU', 'Austin Peay', -23], ['UTM', 'UT Martin', -22],
  ['TNTC', 'Tennessee Tech', -22], ['CHSO', 'Charleston Southern', -28], ['SIU', 'Southern Illinois', -18], ['INST', 'Indiana State', -27],
  ['SEMO', 'Southeast Missouri', -23], ['MURR', 'Murray State', -29], ['WIU', 'Western Illinois', -30], ['UNA', 'North Alabama', -26],
  ['UCA', 'Central Arkansas', -20], ['SFA', 'Stephen F. Austin', -21], ['ACU', 'Abilene Christian', -19], ['TAR', 'Tarleton State', -15],
  ['UIW', 'Incarnate Word', -17], ['LAM', 'Lamar', -22], ['NICH', 'Nicholls', -25], ['SELA', 'Southeastern Louisiana', -21], ['MCN', 'McNeese', -25],
  ['WEB', 'Weber State', -22], ['NAU', 'Northern Arizona', -22], ['IDST', 'Idaho State', -23], ['PRST', 'Portland State', -27], ['UNH', 'New Hampshire', -20],
  ['ME', 'Maine', -24], ['URI', 'Rhode Island', -18], ['TOW', 'Towson', -22], ['ALB', 'Albany', -20], ['ELON', 'Elon', -21], ['WM', 'William & Mary', -19],
  ['RICH', 'Richmond', -21], ['HC', 'Holy Cross', -21], ['LAF', 'Lafayette', -19], ['LEH', 'Lehigh', -18], ['BUCK', 'Bucknell', -28],
  ['ALAM', 'Alabama A&M', -28], ['ALST', 'Alabama State', -27], ['GRAM', 'Grambling', -29], ['PV', 'Prairie View A&M', -28], ['JKST', 'Jackson State', -22],
  ['SCST', 'South Carolina State', -24], ['NCAT', 'North Carolina A&T', -31], ['NCCU', 'North Carolina Central', -24], ['HOW', 'Howard', -27],
  ['UTRGV', 'UT Rio Grande Valley', -21], ['ETAM', 'East Texas A&M', -31], ['GWEB', 'Gardner-Webb', -25], ['BRY', 'Bryant', -29],
].map(([short, name, r0]) => { const r = r0 - 4; return { short: `fcs:${short}`, name, fcs: true, o: r / 2, d: r / 2, rating: r, kind: 'FCS', tier: 'FCS' } })
const FCS_BY = Object.fromEntries(FCS.map(f => [f.short, f]))

// Rivalries the schedule keeps when both schools are in the data (ESPN abbreviations). Conference pairs
// with late: true are played on the last weekends; nc = the non-conference ones, with their usual week.
const CONF_RIVALS = [
  ['ALA', 'AUB', 1], ['TEX', 'TAMU', 1], ['MISS', 'MSST', 1], ['UGA', 'FLA'], ['TEX', 'OKLA'], ['ALA', 'TENN'], ['UGA', 'AUB'], ['TENN', 'VAN', 1],
  ['LSU', 'ALA'], ['ARK', 'MIZ', 1], ['UKY', 'TENN'], ['SCAR', 'UGA'], ['LSU', 'TAMU'], ['OKLA', 'MIZ'],
  ['OSU', 'MICH', 1], ['MICH', 'MSU'], ['MINN', 'WIS', 1], ['IOWA', 'NEB', 1], ['IOWA', 'MINN'], ['PUR', 'IND', 1], ['USC', 'UCLA', 1],
  ['ORE', 'WASH', 1], ['ILL', 'NWU', 1], ['UMD', 'RUTG'], ['PSU', 'MSU', 1], ['OSU', 'PSU'], ['WIS', 'NEB'], ['ORE', 'USC'],
  ['KAN', 'KSU', 1], ['BYU', 'UTAH'], ['ARIZ', 'ASU', 1], ['BAY', 'TCU'], ['ISU', 'KSU'], ['TTU', 'TCU'], ['CIN', 'WVU'], ['UTAH', 'COLO', 1], ['HOU', 'BAY'],
  ['UNC', 'NCSU', 1], ['UNC', 'DUKE'], ['VT', 'UVA', 1], ['FSU', 'MIA'], ['CLEM', 'FSU'], ['CAL', 'STAN'], ['BCOL', 'SYR'], ['PITT', 'SYR'], ['WAKE', 'NCSU'], ['LOU', 'MIA'], ['SMU', 'DUKE'],
  ['BOIS', 'FRES'], ['SDSU', 'FRES'], ['WSU', 'ORST', 1], ['AFA', 'WYO'], ['UNLV', 'NEV', 1], ['MEM', 'TULN'], ['USF', 'UCF'], ['APP', 'GASO'], ['JMU', 'ODU'],
  ['LIB', 'JXST'], ['WKU', 'MTSU', 1], ['TOL', 'BGSU', 1], ['OHIO', 'MOH'], ['CMU', 'WMU'], ['ULL', 'ULM', 1], ['LTU', 'USM'],
]
// (Army-Navy is a December game after the title games, outside the 12-game regular season here)
const NC_RIVALS = [['UGA', 'GT', 13], ['FLA', 'FSU', 13], ['SCAR', 'CLEM', 13], ['UKY', 'LOU', 13], ['IOWA', 'ISU', 1], ['NDAM', 'NAVY', 10], ['NDAM', 'STAN', 12], ['NDAM', 'USC', 7]]
const NEUTRAL_PAIRS = [['TEX', 'OKLA'], ['UGA', 'FLA']]
// conferences that still play in two divisions (the title game is the division winners): the Sun Belt
const DIVISIONS = { sunbelt: { East: ['APP', 'CCU', 'GASO', 'GAST', 'JMU', 'MRSH', 'ODU'], West: ['ARST', 'ULL', 'ULM', 'USAL', 'USM', 'TROY', 'LTU'] } }

// ── Conferences ──────────────────────────────────────────────────────────────
const P4_KEYS = { sec: 'SEC', southeasternconference: 'SEC', b1g: 'B1G', bigten: 'B1G', big10: 'B1G', bigtenconference: 'B1G', b12: 'B12', big12: 'B12', big12conference: 'B12', acc: 'ACC', atlanticcoastconference: 'ACC' }
const IND_KEYS = new Set(['ind', 'indep', 'independent', 'independents', 'fbsind', 'fbsindependents'])
function kindOf(conf) {
  for (const c of [conf?.id, conf?.short, conf?.name]) {
    const k = keyOf(c)
    if (P4_KEYS[k]) return P4_KEYS[k]
    if (IND_KEYS.has(k)) return 'IND'
  }
  return 'G5'
}
// conference games a team plays (SEC/Big Ten/Big 12: 9 from 2026; ACC and the rest: 8; small leagues a round robin)
const confGamesFor = (kind, n, conf) => Math.min(n - 1, conf?.confGames ?? (kind === 'SEC' || kind === 'B1G' || kind === 'B12' ? 9 : 8))
// calendar windows: conference rounds in `conf`, non-conference games in the rest (a free week inside the window too)
const WINDOWS = {
  SEC: { conf: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], nc: [0, 1, 2, 13] },
  ACC: { conf: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], nc: [0, 1, 2, 13] },
  B1G: { conf: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], nc: [0, 1, 2] },
  B12: { conf: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], nc: [0, 1, 2] },
  G5:  { conf: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13], nc: [0, 1, 2, 3] },
  IND: { conf: [], nc: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
}

const isND = t => ['nd', 'ndam'].includes(keyOf(t.short)) || /notre dame/i.test(t.name ?? '') || /notre dame/i.test(t.school ?? '')

// ── The league (built once from the data, then cached) ───────────────────────
let LEAGUE = null
// pools (College Football mode, a second season on: components/cfb/cfbShared.js seasonData): the same country
// with the rosters moved on a year. Schools, schedule and strength stay the season's; only who plays changes
const LEAGUES = new WeakMap()
export function cfbLeague(pools = null) {
  if (!LEAGUE) LEAGUE = buildLeague()
  if (!pools) return LEAGUE
  let L = LEAGUES.get(pools)
  if (!L) { L = { ...LEAGUE, ...leaguePlayers(pools, LEAGUE.byShort), baseDepth: LEAGUE.depth }; LEAGUES.set(pools, L) }
  return L
}

function stats(arr) {
  const v = arr.filter(x => typeof x === 'number' && isFinite(x))
  if (!v.length) return { m: 0, sd: 1 }
  const m = v.reduce((a, b) => a + b, 0) / v.length
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1
  return { m, sd }
}
const corr = (xs, ys) => {
  const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => typeof x === 'number' && typeof y === 'number')
  if (pts.length < 5) return 0
  const a = stats(pts.map(p => p[0])), b = stats(pts.map(p => p[1]))
  return pts.reduce((s, [x, y]) => s + (x - a.m) * (y - b.m), 0) / pts.length / (a.sd * b.sd)
}
const PTS_PER_Z = 7.2   // one SD of offense (or defense) is worth ~7 points a game (SP+'s unit spreads)
const toBuild = (attrs, types) => Object.fromEntries(types.map(t => [t, { type: t, val: attrs?.[t] ?? 5 }]))
const OVR_FN = { qb: calcOVR, rb: calcOVRRB, wr: calcOVRWR }
export function calcCFBOVR(build, types, position) { const p = position ?? 'qb'; return OVR_FN[p](build, types ?? CFB_TYPES_BY_POS[p]) }

function buildLeague() {
  const confs = (CFB_CONFERENCES ?? []).map(c => ({ ...c, kind: kindOf(c) }))
  const confFor = id => confs.find(c => c.id === id || c.short === id || c.name === id) ?? { id, short: String(id), name: String(id), kind: kindOf({ id }) }
  const raw = (CFB_TEAMS ?? []).filter(t => t && t.short)
  const num = v => (typeof v === 'number' && isFinite(v) ? v : null)
  const offs = raw.map(t => num(t.off) ?? num(t.ovr)), defsRaw = raw.map(t => num(t.def) ?? num(t.ovr))
  // def can come either way: higher-is-better (football's scale) or points allowed (SP+ defense). Good
  // teams are good at both, so a defense number that runs against the team's overall is flipped.
  const ref = raw.some(t => num(t.fpi) != null) ? raw.map(t => num(t.fpi)) : raw.some(t => num(t.ovr) != null) ? raw.map(t => num(t.ovr)) : offs
  const flip = corr(defsRaw, ref) < -0.05 ? -1 : 1
  const so = stats(offs), sd = stats(defsRaw)
  // Strength in points. Best: ESPN FPI (the expected margin against an average FBS team), split into offense
  // and defense by FPI's 0-100 efficiencies (o + d = FPI exactly). Else: off/def as z-scores (7.2 pts an SD).
  const useFPI = raw.filter(t => num(t.fpi) != null).length >= raw.length * 0.8
  let k = 0.3
  if (useFPI) {
    const rows = raw.filter(t => num(t.fpi) != null && num(t.offEff) != null && num(t.defEff) != null)
    const xs = rows.map(t => (t.offEff - 50) + (t.defEff - 50))
    const den = xs.reduce((a, x) => a + x * x, 0)
    if (rows.length > 10 && den > 0) k = rows.reduce((a, t, i) => a + xs[i] * t.fpi, 0) / den
  }
  const conf = {}
  const teams = raw.map((t, i) => {
    const c = confFor(t.conf)
    const kind = c.kind
    let o, d
    if (useFPI && num(t.fpi) != null) {
      const ro = num(t.offEff) != null ? k * (t.offEff - 50) : t.fpi / 2, rd = num(t.defEff) != null ? k * (t.defEff - 50) : t.fpi / 2
      const resid = (t.fpi - ro - rd) / 2
      o = ro + resid; d = rd + resid
    } else {
      const zo = offs[i] == null ? 0 : (offs[i] - so.m) / so.sd
      const zd = defsRaw[i] == null ? 0 : flip * (defsRaw[i] - sd.m) / sd.sd
      o = zo * PTS_PER_Z; d = zd * PTS_PER_Z
    }
    const tier = kind === 'IND' ? (isND(t) ? 'P4' : 'G5') : kind === 'G5' ? 'G5' : 'P4'
    const divs = DIVISIONS[keyOf(c.id)] ?? DIVISIONS[keyOf(c.short)]
    const div = t.div ?? (divs ? Object.keys(divs).find(dv => divs[dv].includes(t.short)) : undefined)
    const row = { ...t, idx: i, confId: c.id, confShort: c.short ?? c.id, confName: c.name ?? c.short, kind, tier, nd: isND(t), o, d, rating: o + d, ...(div ? { div } : {}) }
    ;(conf[c.id] ??= { id: c.id, short: c.short ?? c.id, name: c.name ?? c.short, kind, teams: [], conf: c }).teams.push(row)
    return row
  })
  const byShort = Object.fromEntries(teams.map(t => [t.short, t]))
  const scale = { offM: so.m, offSD: so.sd, defM: sd.m, defSD: sd.sd, flip, useFPI, k }

  const L = { confs: Object.values(conf), confList: confs, teams, byShort, scale, ...leaguePlayers({ qb: CFB_QBS, rb: CFB_RBS, wr: CFB_WRS }, byShort) }
  L.schedule = buildSchedule(L)
  // strength of schedule: the average opponent's FPI-style rating (FCS opponents at their own)
  L.sos = teams.map(t => {
    const o = (L.schedule.byTeam[t.short] ?? []).map(g => { const os = g.a === t.short ? g.b : g.a; return FCS_BY[os]?.rating ?? byShort[os]?.rating ?? 0 })
    return o.length ? o.reduce((x, y) => x + y, 0) / o.length : 0
  })
  return L
}

// the players: OVR on the football formulas, the depth chart a team, and the teams of the country's best players
// by grade (the award fields come from these, the build's conference and the top 25)
function leaguePlayers(lists, byShort) {
  const prep = (list, pos) => (list ?? []).filter(p => p && p.team && p.attrs).map(p => ({ ...p, pos, ovr: OVR_FN[pos](toBuild(p.attrs, CFB_TYPES_BY_POS[pos]), CFB_TYPES_BY_POS[pos]) ?? 70 }))
  const players = { qb: prep(lists.qb, 'qb'), rb: prep(lists.rb, 'rb'), wr: prep(lists.wr, 'wr') }
  const depth = {}
  for (const pos of ['qb', 'rb', 'wr']) {
    for (const p of players[pos]) (depth[p.team] ??= { qb: [], rb: [], wr: [] })[pos].push(p)
  }
  for (const d of Object.values(depth)) for (const pos of ['qb', 'rb', 'wr']) d[pos].sort((a, b) => (a.depth ?? 99) - (b.depth ?? 99) || (b.starter ? 1 : 0) - (a.starter ? 1 : 0) || b.ovr - a.ovr)
  const topBy = (pos, n) => players[pos].filter(p => (p.depth ?? 1) <= (pos === 'wr' ? 3 : 1)).sort((a, b) => b.ovr - a.ovr).slice(0, n)
  const awardTeams = [...new Set([...topBy('qb', 30), ...topBy('rb', 30), ...topBy('wr', 45)].map(p => byShort[p.team]?.idx).filter(i => i != null))]
  return { players, depth, awardTeams }
}

// ── The 2026 schedule (one fixed schedule for the season, like the real one) ─
function circleRounds(ids) {
  const arr = [...ids]
  if (arr.length % 2) arr.push(null)
  const n = arr.length, rounds = []
  for (let r = 0; r < n - 1; r++) {
    const pairs = []
    for (let i = 0; i < n / 2; i++) pairs.push([arr[i], arr[n - 1 - i]])
    rounds.push(pairs)
    arr.splice(1, 0, arr.pop())
  }
  return rounds
}
function pairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}` }

function buildSchedule(L) {
  const r = seeded('cfb-2026-schedule')
  const games = []                 // { id, week, a, b, site: 'a' | 'b' | 'n', conf }
  const busy = {}                  // short → Set(weeks)
  const played = new Set()
  const homeCount = {}
  const confCount = {}
  for (const t of L.teams) { busy[t.short] = new Set(); homeCount[t.short] = 0; confCount[t.short] = 0 }
  const neutral = new Set(NEUTRAL_PAIRS.map(([a, b]) => pairKey(a, b)))
  const add = (a, b, week, conf, siteHint = null) => {
    let site = siteHint
    if (!site) {
      if (neutral.has(pairKey(a, b))) site = 'n'
      else if (homeCount[a] === homeCount[b]) site = r() < 0.5 ? 'a' : 'b'
      else site = homeCount[a] < homeCount[b] ? 'a' : 'b'
    }
    if (site === 'a') homeCount[a] = (homeCount[a] ?? 0) + 1
    if (site === 'b' && !FCS_BY[b]) homeCount[b] = (homeCount[b] ?? 0) + 1
    games.push({ id: games.length, week, a, b, site, conf })
    busy[a]?.add(week); busy[b]?.add(week)
    played.add(pairKey(a, b))
    if (conf) { confCount[a]++; confCount[b]++ }
  }

  // 1. conference round robins: k rounds of the circle method, picked to keep the rivalries
  for (const c of L.confs) {
    if (c.kind === 'IND' || c.teams.length < 2) continue
    const ids = c.teams.map(t => t.short)
    const k = confGamesFor(c.kind, ids.length, c.conf)
    const win = (WINDOWS[c.kind] ?? WINDOWS.G5).conf
    const rivals = CONF_RIVALS.filter(([a, b]) => ids.includes(a) && ids.includes(b))
    let best = null
    for (let tries = 0; tries < 40; tries++) {
      const rounds = circleRounds(shuffle(r, ids))
      const scored = rounds.map(rd => {
        const keys = new Set(rd.map(([a, b]) => pairKey(a, b)))
        const hit = rivals.filter(([a, b]) => keys.has(pairKey(a, b)))
        return { rd, hit: hit.length, late: hit.filter(x => x[2]).length, tie: r() }
      })
      const chosen = [...scored].sort((x, y) => y.hit - x.hit || x.tie - y.tie).slice(0, k)
      const cover = chosen.reduce((s, x) => s + x.hit, 0)
      if (!best || cover > best.cover) best = { chosen, cover }
      if (cover >= rivals.length) break
    }
    let rounds = best.chosen.map(x => ({ pairs: x.rd.filter(([a, b]) => a && b), late: x.late }))
    // odd leagues: the teams with an open date in the chosen rounds play each other once more
    if (ids.length % 2) {
      const have = new Set(rounds.flatMap(rd => rd.pairs.map(([a, b]) => pairKey(a, b))))
      const short = ids.filter(id => rounds.filter(rd => rd.pairs.some(p => p.includes(id))).length < k)
      const match = (left, acc) => {
        if (left.length < 2) return acc
        const [a, ...rest] = left
        for (const b of shuffle(r, rest)) {
          if (have.has(pairKey(a, b))) continue
          const got = match(rest.filter(x => x !== b), [...acc, [a, b]])
          if (got) return got
        }
        return left.length % 2 ? match(rest, acc) : null
      }
      const extra = match(shuffle(r, short), []) ?? []
      if (extra.length) rounds.push({ pairs: extra, late: 0 })
    }
    // rounds into weeks: the rivalry rounds last, the open dates anywhere but the first conference week
    rounds = [...shuffle(r, rounds.filter(x => !x.late)), ...rounds.filter(x => x.late).sort((x, y) => x.late - y.late)]
    const weeks = [win[win.length - 1], ...shuffle(r, win.slice(0, -1))].slice(0, Math.min(rounds.length, win.length)).sort((a, b) => a - b)
    rounds.slice(0, weeks.length).forEach((rd, i) => rd.pairs.forEach(([a, b]) => add(a, b, weeks[i], true)))
  }

  // 2. non-conference games
  const typeOf = s => (FCS_BY[s] ? 'FCS' : L.byShort[s].tier)
  const want = {}
  for (const t of L.teams) {
    const n = 12 - confCount[t.short]
    let p4 = 0, fcs = 0
    if (t.nd) { p4 = Math.max(0, n - 3); fcs = 0 }
    else if (t.kind === 'IND') { p4 = Math.min(3, Math.floor(n / 3)); fcs = 1 }
    else if (t.tier === 'P4') { p4 = 1; fcs = t.kind === 'B1G' ? 0 : 1 }
    else { p4 = n >= 5 ? 2 : r() < 0.5 ? 2 : 1; fcs = 1 }
    want[t.short] = { left: n, P4: p4, FCS: fcs, G5: Math.max(0, n - p4 - fcs) }
  }
  const take = (s, type) => { const w = want[s]; w.left--; if (w[type] > 0) w[type]--; else for (const k of ['G5', 'P4', 'FCS']) if (w[k] > 0) { w[k]--; break } }
  const usedFCS = {}
  // (a school that has moved up to FBS, like North Dakota State in 2026, is off the FCS list)
  const fbsNames = new Set(L.teams.flatMap(t => [keyOf(t.school), keyOf(t.name)]))
  const FCS_OK = FCS.filter(f => !fbsNames.has(keyOf(f.name)))
  const fcsGame = (a, week) => {
    const pool = FCS_OK.filter(f => !usedFCS[f.short] || usedFCS[f.short] < 2)
    const f = pick(r, pool.length ? pool : FCS_OK)
    usedFCS[f.short] = (usedFCS[f.short] ?? 0) + 1
    add(a, f.short, week, false, 'a')
    take(a, 'FCS')
  }
  const free = (s, w) => !busy[s].has(w)
  const ncWeeks = t => (WINDOWS[t.kind] ?? WINDOWS.G5).nc
  // the protected non-conference rivalries
  for (const [a, b, wk] of NC_RIVALS) {
    if (!L.byShort[a] || !L.byShort[b] || played.has(pairKey(a, b))) continue
    if (want[a].left <= 0 || want[b].left <= 0) continue
    const common = Array.from({ length: WEEKS }, (_, w) => w).filter(w => free(a, w) && free(b, w))
    if (!common.length) continue
    const w = common.includes(wk) ? wk : common.sort((x, y) => Math.abs(x - wk) - Math.abs(y - wk))[0]
    add(a, b, w, false)
    take(a, typeOf(b)); take(b, typeOf(a))
  }
  // the independents next: Notre Dame's schedule is mostly Power 4 (five ACC games a year, by agreement)
  // spread through the fall, in its opponents' open weeks
  for (const t of L.teams.filter(x => x.kind === 'IND').sort((a, b) => (b.nd ? 1 : 0) - (a.nd ? 1 : 0))) {
    let acc = 0
    for (let tries = 0; tries < 60 && want[t.short].left > want[t.short].FCS; tries++) {
      const wa = want[t.short]
      const cands = L.teams.filter(B => B.short !== t.short && B.kind !== 'IND' && want[B.short].left > want[B.short].FCS && want[B.short][t.tier] > 0
        && wa[B.tier] > 0 && !played.has(pairKey(t.short, B.short)) && Array.from({ length: WEEKS }, (_, w) => w).some(w => free(t.short, w) && free(B.short, w)))
      if (!cands.length) break
      const accC = cands.filter(B => B.kind === 'ACC')
      const B = t.nd && acc < 5 && accC.length ? pick(r, accC) : pick(r, cands)
      if (B.kind === 'ACC') acc++
      const weeks = Array.from({ length: WEEKS }, (_, w) => w).filter(w => free(t.short, w) && free(B.short, w))
      const inner = weeks.filter(w => w >= 3 && w <= 12)
      add(t.short, B.short, pick(r, inner.length && r() < 0.7 ? inner : weeks), false)
      take(t.short, B.tier); take(B.short, t.tier)
    }
  }
  // the FCS game: an early week, or (the SEC way) the week before rivalry week
  for (const t of L.teams) {
    if (want[t.short].FCS <= 0) continue
    const opts = ncWeeks(t).filter(w => free(t.short, w) && w !== 13)
    if (!opts.length) continue
    fcsGame(t.short, t.kind === 'SEC' && r() < 0.3 && free(t.short, 12) ? 12 : pick(r, opts))
  }
  // the rest, week by week: who has to play this week plays first, everyone free in a designated week tries to
  for (let w = 0; w < WEEKS; w++) {
    const avail = L.teams.filter(t => want[t.short].left > 0 && free(t.short, w))
    const restFree = t => Array.from({ length: WEEKS - w }, (_, i) => w + i).filter(x => free(t.short, x)).length
    const must = new Set(avail.filter(t => restFree(t) <= want[t.short].left).map(t => t.short))
    const designated = avail.filter(t => ncWeeks(t).includes(w))
    const order = [...shuffle(r, avail.filter(t => must.has(t.short))), ...shuffle(r, designated.filter(t => !must.has(t.short)))]
    const done = new Set()
    for (const A of order) {
      if (done.has(A.short) || want[A.short].left <= 0) continue
      const wa = want[A.short]
      const cands = avail.filter(B => B.short !== A.short && !done.has(B.short) && want[B.short].left > 0 && !played.has(pairKey(A.short, B.short)))
      const fits = (B, strict) => (wa[B.tier] > 0 || (!strict && wa.left > wa.FCS)) && (want[B.short][A.tier] > 0 || (!strict && want[B.short].left > want[B.short].FCS))
      let pool = cands.filter(B => fits(B, true))
      if (!pool.length && must.has(A.short)) pool = cands.filter(B => fits(B, false))
      if (pool.length) {
        const mustB = pool.filter(B => must.has(B.short))
        const B = pick(r, mustB.length && r() < 0.7 ? mustB : pool)
        // a P4 school hosts the G5 school it pays to come in; P4 vs P4 openers are sometimes at a neutral site
        let site = null
        if (A.tier !== B.tier) site = (A.tier === 'P4') === (r() < 0.88) ? 'a' : 'b'
        else if (A.tier === 'P4' && w <= 1 && r() < 0.3) site = 'n'
        add(A.short, B.short, w, false, site)
        take(A.short, B.tier); take(B.short, A.tier)
        done.add(A.short); done.add(B.short)
      } else if (must.has(A.short)) {
        fcsGame(A.short, w)
        done.add(A.short)
      }
    }
  }
  // anyone still short (rare) fills an open week with an FCS game
  for (const t of L.teams) {
    for (let w = 0; w < WEEKS && want[t.short].left > 0; w++) if (free(t.short, w)) fcsGame(t.short, w)
  }
  const byTeam = {}
  for (const g of games) {
    ;(byTeam[g.a] ??= []).push(g)
    if (!FCS_BY[g.b]) (byTeam[g.b] ??= []).push(g)
  }
  for (const k of Object.keys(byTeam)) byTeam[k].sort((x, y) => x.week - y.week)
  const sorted = [...games].sort((x, y) => x.week - y.week || x.id - y.id)
  return { games: sorted, sorted, byTeam }
}

// ── A game's score ───────────────────────────────────────────────────────────
const BASE_PPG = 27.5, HFA = 2.6
// points as touchdowns and field goals (a college score: 7s and 3s, the odd missed kick, 2-point try or safety)
// (a rout stops being run up: past ~42 expected points the starters sit and the clock runs)
function genPoints(r, mu) {
  mu = Math.max(3, mu > 42 ? 42 + (mu - 42) * 0.45 : mu)
  const lfg = clamp(0.6, 2.2, 0.8 + mu * 0.018)
  const ltd = Math.max(0.15, (mu - 3 * lfg) / 6.92)
  const td = Math.max(0, Math.round(ltd + gauss(r) * 0.75 * Math.sqrt(ltd)))
  const fg = Math.max(0, Math.round(lfg + gauss(r) * 0.8 * Math.sqrt(lfg)))
  let pts = 3 * fg
  let nonOff = 0
  for (let i = 0; i < td; i++) { const x = r(); pts += x < 0.035 ? 6 : x < 0.075 ? 8 : 7; if (r() < 0.06) nonOff++ }
  if (pts >= 7 && r() < 0.015) pts += 2   // (a safety on top of real scoring, never a team's only points: no 2-0 or 5-point finals)
  return { pts, td, fg, offTD: td - nonOff }
}
// a score that was decided elsewhere (a forced result): read back as touchdowns and field goals
function splitPoints(r, pts) {
  let best = null
  for (let fg = 0; fg <= 7; fg++) {
    const rem = pts - 3 * fg
    if (rem < 0) break
    const td = Math.round(rem / 7)
    const diff = rem - 7 * td
    if (![0, 1, -1, 2].includes(diff) || (td === 0 && diff !== 0 && diff !== 2)) continue
    const cost = Math.abs(fg - 1.3) + Math.abs(diff) * 0.8
    if (!best || cost < best.cost) best = { td, fg, cost }
  }
  if (!best) best = { td: Math.floor(pts / 7), fg: Math.floor((pts % 7) / 3) }
  let nonOff = 0
  for (let i = 0; i < best.td; i++) if (r() < 0.06) nonOff++
  return { pts, td: best.td, fg: best.fg, offTD: best.td - nonOff }
}
// overtime: the 2021 rules (a 2-point try is mandatory from the 2nd OT, alternating 2-point plays from the 3rd)
function overtime(r, A, B) {
  const pA = clamp(0.25, 0.75, 0.5 + (A.so + A.sd - B.so - B.sd) * 0.008)
  const aWins = r() < pA
  const x = r()
  const ot = x < 0.72 ? 1 : x < 0.92 ? 2 : 3 + Math.floor(r() * 2)
  let lose, win, tdW = 0, tdL = 0, fgW = 0, fgL = 0
  if (ot === 1) {
    const y = r()
    if (y < 0.35) { lose = 0; win = 3; fgW = 1 } else if (y < 0.6) { lose = 0; win = 7; tdW = 1 } else if (y < 0.85) { lose = 3; win = 7; fgL = 1; tdW = 1 } else { lose = 3; win = 6; fgL = 1; fgW = 2 }
  } else if (ot === 2) {
    const y = r()
    lose = 7; win = 7; tdW = 1; tdL = 1
    if (y < 0.4) { win += 3; fgW++ } else if (y < 0.75) { lose += 6; win += 8; tdW++; tdL++ } else { win += 8; tdW++ }
  } else {
    lose = 15; win = 15; tdW = 2; tdL = 2
    win += 2 * (ot - 2); lose += 2 * (ot - 3)
  }
  return { aWins, ot, add: aWins ? { a: [win, tdW, fgW], b: [lose, tdL, fgL] } : { a: [lose, tdL, fgL], b: [win, tdW, fgW] } }
}
function playGame(r, A, B, site) {
  const h = site === 'a' ? HFA / 2 : site === 'b' ? -HFA / 2 : 0
  const a = genPoints(r, BASE_PPG + A.so - B.sd + h)
  const b = genPoints(r, BASE_PPG + B.so - A.sd - h)
  let ot = 0
  // a one-score finish is sometimes a late tying kick instead (college games go to OT about 5% of the time)
  const gap = Math.abs(a.pts - b.pts)
  if (gap > 0 && gap <= 3 && r() < 0.3) { if (a.pts < b.pts) a.pts = b.pts; else b.pts = a.pts }
  if (a.pts === b.pts) {
    const o = overtime(r, A, B)
    ot = o.ot
    a.pts += o.add.a[0]; a.td += o.add.a[1]; a.offTD += o.add.a[1]; a.fg += o.add.a[2]
    b.pts += o.add.b[0]; b.td += o.add.b[1]; b.offTD += o.add.b[1]; b.fg += o.add.b[2]
  }
  return { a, b, ot }
}

// ── Players: ratings → per-game rates ────────────────────────────────────────
const nfrom = (attrs, fallback = 5) => k => clamp(0, 1, (attrs?.[k] ?? fallback) / 11)
const ovrBoost = ovr => clamp(-0.12, 0.19, ((ovr ?? 78) - 80) / 100)
function qbRates(v, ovr) {
  const acc = v('accuracy'), arm = v('arm'), vis = v('vision'), proc = v('processing'), pock = v('pocket-presence')
  const legs = v('legs'), play = v('playmaking'), size = v('size')
  return {
    comp: 0.50 + acc * 0.13 + vis * 0.04 + proc * 0.04 + pock * 0.03,
    ypa: 4.7 + arm * 2.4 + acc * 1.9 + vis * 0.8 + play * 0.4,
    intRate: Math.max(0.006, 0.034 - proc * 0.012 - acc * 0.008 - vis * 0.004 - pock * 0.003),
    sackRate: Math.max(0.02, 0.075 - pock * 0.03 - legs * 0.012 - proc * 0.006),
    lean: (arm + acc) / 2 - 0.45 - (legs - 0.45) * 0.4,
    passShare: 0.50 + ((arm + acc + vis) / 3 - 0.45) * 0.5 - (legs - 0.45) * 0.08,
    rushAtt: 2 + legs * 9 + play * 2,
    ypc: 2.5 + legs * 5 + play * 0.5,
    rushTDShare: 0.08 + legs * 0.30 + size * 0.06,
    ovr,
  }
}
function rbRates(v, ovr) {
  const spd = v('speed'), bst = v('burst'), str = v('strength'), sz = v('size'), bal = v('balance')
  const elu = v('elusiveness'), vis = v('vision'), hnd = v('hands'), cry = v('carrying')
  const share = clamp(0.3, 0.75, 0.40 + sz * 0.10 + vis * 0.06 + str * 0.04 + ovrBoost(ovr) * 0.6)
  return {
    share,
    ypc: 3.3 + vis * 1.0 + bal * 0.8 + bst * 0.7 + elu * 0.6 + spd * 0.5 + str * 0.3,
    tdShare: clamp(0.25, 0.9, share + str * 0.12 + sz * 0.08),
    tgt: 0.04 + hnd * 0.08, catch: 0.66 + hnd * 0.14, ypr: 5.5 + spd * 3 + elu * 2.5,
    fum: Math.max(0.002, 0.012 - cry * 0.009), big: 0.2 + spd * 0.35 + elu * 0.1, spd,
    ovr,
  }
}
function wrRates(v, ovr) {
  const spd = v('speed'), bct = v('bodyControl'), vrt = v('vertical'), rte = v('routeRunning'), rel = v('release')
  const hnd = v('hands'), awr = v('awareness'), sz = v('size'), yac = v('afterCatch')
  const share = clamp(0.12, 0.38, 0.20 + rte * 0.05 + rel * 0.03 + hnd * 0.02 + ovrBoost(ovr) * 0.5)
  return {
    share,
    catch: clamp(0.45, 0.82, 0.50 + hnd * 0.17 + rte * 0.08 + awr * 0.04 - spd * 0.03),
    ypr: 9.5 + spd * 3.8 + yac * 2.2 + vrt * 1.0 + bct * 0.6 + rte * 0.6 - sz * 0.8,
    tdW: (1 + sz * 0.5 + vrt * 0.3 + rte * 0.2) * (1 + ovrBoost(ovr) * 1.5),
    big: 0.25 + spd * 0.4 + vrt * 0.15, spd,
    ovr,
  }
}
const RATES = { qb: qbRates, rb: rbRates, wr: wrRates }
// a team with no player in the data at a spot: a player as good as its offense
const genericAttrs = (types, team) => Object.fromEntries(types.map(t => [t, clamp(1, 11, 5 + (team.o / PTS_PER_Z) * 1.3)]))

// A real player's 2026 line (s26, through Week 10) as a prior on his ROLE: how often he runs (a QB), how many
// carries he gets, how much of the passing game goes his way. Up to half the weight, by games played.
function usage(pos, rates, s26) {
  const gp = s26?.gp ?? 0
  if (gp < 3) return rates
  const w = Math.min(0.5, gp / 16)
  const mix = (m, real) => m * (1 - w) + real * w
  if (pos === 'qb') return { ...rates, rushAtt: mix(rates.rushAtt, Math.max(0, ((s26.car ?? 0) - (s26.sacks ?? 0)) / gp)) }
  if (pos === 'rb') return { ...rates, share: clamp(0.15, 0.78, mix(rates.share, (s26.car ?? 0) / gp / 31)) }
  if (pos === 'wr') return { ...rates, share: clamp(0.08, 0.38, mix(rates.share, (s26.rec ?? 0) / gp / 0.64 / 30)) }
  return rates
}

// The offense a team takes into a game: who plays QB, RB1 and the top three receivers
function unitFor(L, team, user) {
  const d = L.depth[team.short] ?? { qb: [], rb: [], wr: [] }
  const ref = (p, pos) => ({ key: `${pos}:${p.team}:${p.name}`, name: p.name, short: p.short ?? p.name, team: p.team, year: p.year ?? null, espn: p.espn ?? null, pos, ovr: p.ovr })
  const side = pos => {
    const list = d[pos]
    const real = list.map(p => ({ who: ref(p, pos), rates: usage(pos, RATES[pos](nfrom(p.attrs), p.ovr), p.s26) }))
    if (!real.length) {
      const a = genericAttrs(CFB_TYPES_BY_POS[pos], team)
      const ovr = OVR_FN[pos](toBuild(a, CFB_TYPES_BY_POS[pos]), CFB_TYPES_BY_POS[pos])
      real.push({ who: null, rates: RATES[pos](nfrom(a), ovr) })
    }
    return real
  }
  let qbs = side('qb'), rbs = side('rb'), wrs = side('wr')
  if (user?.team === team.short) {
    const me = { who: { key: 'USER', name: user.name, team: team.short, pos: user.pos, ovr: user.ovr, year: user.year, isUser: true }, rates: user.rates }
    if (user.pos === 'qb') qbs = [me, ...qbs.slice(1)]
    if (user.pos === 'rb') rbs = [me, ...rbs.slice(1)]
    if (user.pos === 'wr') {
      wrs = [me, ...wrs.slice(1)].sort((a, b) => (b.rates.ovr ?? 0) - (a.rates.ovr ?? 0))
      if (wrs.indexOf(me) > 2) wrs = [...wrs.slice(0, 2), me]
    }
  }
  return { qb: qbs[0], rb: rbs[0], wrs: wrs.slice(0, 3) }
}

// One team's box score in one game, built from the score so the lines fit the result:
// team passing from its QB, the touchdowns split from the offense's actual TDs, the receivers sharing
// the team's targets, yards and passing TDs. Starters sit in blowouts (the college way).
function teamBox(r, unit, g, oppD) {
  const q = unit.qb.rates, rb = unit.rb.rates
  const margin = g.pts - g.oppPts
  const pull = margin >= 28 ? 0.74 : margin >= 21 ? 0.87 : 1
  const dz = oppD / PTS_PER_Z
  const att = Math.round(clamp(14, 60, 32 + q.lean * 7 - margin * 0.12 + gauss(r) * 4.5))
  const sacks = Math.max(0, Math.round(att * q.sackRate * (1 + dz * 0.15) + gauss(r) * 1.0))
  // the receivers' hands and routes move the passing game a little
  const wsum = unit.wrs.reduce((s, w) => s + w.rates.share, 0) || 1
  const wCatch = unit.wrs.reduce((s, w) => s + w.rates.catch * w.rates.share, 0) / wsum
  const wYpr = unit.wrs.reduce((s, w) => s + w.rates.ypr * w.rates.share, 0) / wsum
  const cp = clamp(0.3, 0.9, q.comp + (wCatch - 0.62) * 0.25 - dz * 0.03 + gauss(r) * 0.07)
  const comp = Math.min(att, Math.round(att * cp))
  const yf = clamp(0.6, 1.45, 0.76 + 0.24 * g.pts / BASE_PPG)
  const ypa = Math.max(2.5, (q.ypa + (wYpr - 12.8) * 0.12) * yf - dz * 0.75 + gauss(r) * 1.3)
  const passYds = Math.max(0, Math.round(att * ypa))
  const ints = poisson(r, att * q.intRate * (1 + dz * 0.2))
  const passShare = clamp(0.2, 0.85, q.passShare + (att - 31) * 0.008 - (rb.share - 0.46) * 0.6)   // (a workhorse back gets the goal-line carries: Henry, Jeanty)
  const passTD = binom(r, g.offTD, passShare), rushTD = g.offTD - passTD
  const qbRushAtt = Math.max(0, Math.round(q.rushAtt + gauss(r) * 2.2))
  const qbRushGross = Math.round(qbRushAtt * Math.max(0.5, q.ypc + gauss(r) * 1.8))
  const qbRushTD = binom(r, rushTD, q.rushTDShare)
  const qb = {
    att: Math.round(att * pull), comp: Math.round(comp * pull), passYds: Math.round(passYds * pull),
    tds: binom(r, passTD, pull), ints: binom(r, ints, pull), sacks,
    rushAtt: Math.round(qbRushAtt * pull) + sacks, rushYds: Math.round(qbRushGross * pull) - Math.round(sacks * 6.5), rushTDs: binom(r, qbRushTD, pull),
  }
  qb.comp = Math.min(qb.comp, qb.att)
  // the backs
  const designed = clamp(12, 50, 30 + margin * 0.18 - (att - 31) * 0.35 + gauss(r) * 4)
  const carries = Math.max(0, Math.round(designed * rb.share * pull + gauss(r) * 1.5))
  const ypcG = Math.max(1.0, rb.ypc - dz * 0.6 + gauss(r) * 1.3)
  let rushYds = Math.round(carries * ypcG)
  const bigRun = carries > 0 && r() < rb.big * 0.45
  let long = 0
  if (carries > 0) {
    long = bigRun ? Math.round(22 + rb.spd * 40 + r() * 25) : Math.round(5 + r() * 9 + rb.spd * 4)
    if (bigRun) rushYds += Math.round(long * 0.45)
    long = Math.min(long, Math.max(rushYds, 1))
  }
  const rbRushTD = binom(r, rushTD - qbRushTD, rb.tdShare * pull)
  // the targets: RB1, the top three receivers, the rest (tight ends, other backs and receivers)
  const targets = Math.round(att * 0.93)
  const shares = [rb.tgt, ...unit.wrs.map((w, i) => w.rates.share * [1, 0.72, 0.52][i])]
  const rest = Math.max(0.22, 1 - shares.reduce((a, b) => a + b, 0))
  const tot = shares.reduce((a, b) => a + b, 0) + rest
  let left = targets, mass = tot
  const tg = shares.map(s => { const n = binom(r, left, s / mass); left -= n; mass -= s; return n })
  const catchOf = [rb.catch, ...unit.wrs.map(w => w.rates.catch)]
  const yprOf = [rb.ypr, ...unit.wrs.map(w => w.rates.ypr)]
  const recs = tg.map((n, i) => binom(r, n, clamp(0.3, 0.92, catchOf[i] + gauss(r) * 0.07)))
  let ry = recs.map((n, i) => (n ? Math.max(0, Math.round(n * Math.max(3, yprOf[i] * (0.85 + 0.15 * yf) - dz * 1.1 + gauss(r) * 3.2))) : 0))
  const cap = passYds * 0.95, sum = ry.reduce((a, b) => a + b, 0)
  if (sum > cap && sum > 0) ry = ry.map(y => Math.round(y * cap / sum))
  // passing TDs go to whoever catches them, weighted by catches and a red-zone edge
  const tdw = [0.5 * (recs[0] + 0.3), ...unit.wrs.map((w, i) => w.rates.tdW * (recs[i + 1] + 0.3))]
  const restW = Math.max(0.5, (comp - recs.reduce((a, b) => a + b, 0)) * 1.0 + 0.5)
  const rtd = tdw.map(() => 0)
  for (let i = 0; i < passTD; i++) {
    let x = r() * (tdw.reduce((a, b) => a + b, 0) + restW)
    for (let j = 0; j < tdw.length; j++) { x -= tdw[j]; if (x < 0) { rtd[j]++; break } }
  }
  const pl = (n, k) => binom(r, n, k === 0 ? 1 : pull)
  const rbLine = {
    carries, rushYds, rushTDs: rbRushTD, ypc: carries ? Math.round((rushYds / carries) * 10) / 10 : 0,
    recs: recs[0], recYds: ry[0], recTDs: rtd[0], fumbles: binom(r, carries + recs[0], rb.fum), long,
  }
  const wrLines = unit.wrs.map((w, i) => {
    const j = i + 1
    const t2 = Math.round(tg[j] * pull), rec = Math.min(t2, Math.round(recs[j] * pull)), yds = Math.round(ry[j] * pull)
    let lg = 0
    if (rec > 0) {
      const big = r() < w.rates.big * 0.55
      lg = big ? Math.round(25 + w.rates.spd * 35 + r() * 20) : Math.round(8 + r() * 10 + w.rates.spd * 6)
      lg = Math.min(lg, yds)
      if (rec === 1) lg = yds
    }
    return { targets: t2, rec, recYds: yds, recTDs: pl(rtd[j], 1), long: Math.max(0, lg) }
  })
  return { qb, rb: rbLine, wrs: wrLines }
}

// ── Rankings ─────────────────────────────────────────────────────────────────
// Perceived strength: the preseason view (W0 games' worth of weight) plus each game's performance
// (the margin, capped so running it up doesn't pay, plus the opponent's strength, minus home field).
// Resume: a win is worth more the better the opponent; a loss costs less against a good one.
// AP = 0.7 x perceived + resume, with a sticky preseason view (W0 = 4). The CFP committee weighs the
// resume more and the preseason less (W0 = 1.5), and from Selection Day a conference title.
const capMargin = m => Math.sign(m) * Math.min(28, Math.min(Math.abs(m), 21) + Math.max(0, Math.abs(m) - 21) * 0.3)
function rankScores(L, S, W0, kind) {
  const n = L.teams.length
  let perc = S.prior.slice()
  for (let it = 0; it < 2; it++) {
    const next = new Array(n)
    for (let i = 0; i < n; i++) {
      const res = S.results[i]
      let sum = 0
      for (const g of res) sum += capMargin(g.m) + (g.opp >= 0 ? perc[g.opp] : g.oppR) - (g.site === 1 ? HFA : g.site === -1 ? -HFA : 0)
      next[i] = (W0 * S.prior[i] + sum) / (W0 + res.length)
    }
    perc = next
  }
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    let resume = 0
    for (const g of S.results[i]) {
      const ov = g.opp >= 0 ? perc[g.opp] : g.oppR
      resume += g.m > 0 ? clamp(0.25, 6, 1 + 0.12 * (ov + 10)) : clamp(-7.5, -2, -7 + 0.12 * (ov + 10))
    }
    out[i] = kind === 'cfp' ? 0.6 * perc[i] + 1.1 * resume : 0.7 * perc[i] + resume
  }
  return out
}
const recOf = (S, i) => `${S.w[i]}-${S.l[i]}`
// 64 voters, 25 points for first down to 1 for 25th. Each voter sees every team's score with his own noise
// (SD 2); a team's points are 64 x its expected ballot points, worked out from the pairwise odds (no ballots
// to sort), and its first-place votes 64 x its chance to top a ballot. (lite: the score order alone)
const VOTERS = 64, NOISE = 2.0
const pAbove = d => 1 / (1 + Math.exp(-1.702 * d / (NOISE * Math.SQRT2)))
function apPoll(L, S, r, label, week, date, extra = null, lite = false) {
  const sc = rankScores(L, S, 4, 'ap')
  if (extra) for (const [i, b] of extra) sc[i] += b
  const top = sc.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).slice(0, lite ? 25 : 34)
  const pts = new Map(top.map(([, i]) => [i, 0])), fpv = new Map()
  if (!lite) {
    const first = []
    for (const [si, i] of top) {
      let er = 1, pf = 1
      for (const [sj, j] of top) { if (j === i) continue; const p = pAbove(sj - si); er += p; pf *= 1 - p }
      // ballot points: 26 minus the expected position, softened near the 25th-place cutoff
      const ep = Math.max(0, 26 - er), soft = er > 20 ? ep * (1 - (er - 20) / 14) : ep
      pts.set(i, clamp(0, VOTERS * 25 - 1, Math.round(VOTERS * Math.max(0, soft) + bell(r) * 3)))
      first.push([i, pf])
    }
    const tot = first.reduce((a, [, p]) => a + p, 0) || 1
    let left = VOTERS
    const share = first.map(([i, p]) => [i, (VOTERS * p) / tot]).sort((a, b) => b[1] - a[1])
    for (const [i, x] of share) { const n = Math.min(left, Math.floor(x)); fpv.set(i, n); left -= n }
    for (const [i] of share.slice(0, left)) fpv.set(i, (fpv.get(i) ?? 0) + 1)
    // the voters' unanimous No. 1 has all 1,600 points
    for (const [i, n] of fpv) if (n === VOTERS) pts.set(i, VOTERS * 25)
  }
  const order = top.map(([s, i]) => [pts.get(i), s, i]).sort((a, b) => b[0] - a[0] || b[1] - a[1]).slice(0, 25)
  const rank = new Map(order.map(([, , i], k) => [i, k + 1]))
  const top25 = order.map(([p, , i], k) => ({ rank: k + 1, short: L.teams[i].short, rec: recOf(S, i), pts: p, fpv: fpv.get(i) ?? 0 }))
  return { label, week, date, top25, rank }
}
function cfpRank(L, S, label, week, date, champs = null) {
  const sc = rankScores(L, S, 1.5, 'cfp')
  if (champs) for (const [i, b] of champs) sc[i] += b
  const order = sc.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0])
  const rank = new Map(order.map(([, i], k) => [i, k + 1]))
  const top25 = order.slice(0, 25).map(([, i], k) => ({ rank: k + 1, short: L.teams[i].short, rec: recOf(S, i) }))
  return { label, week, date, top25, rank, score: sc }
}
const publicPoll = p => ({ label: p.label, week: p.week, date: p.date, top25: p.top25 })

// ── The build ────────────────────────────────────────────────────────────────
const TEAM_SHIFT = { qb: 0.32, rb: 0.10, wr: 0.12 }   // points a game per OVR point over the starter he replaces
const ELIGIBLE = new Set(['JR', 'SR', 'GR', 'RS-SO', 'RS-JR', 'RS-SR', 'RS-GR', '5TH', 'RS-5TH'])
const CLASS_ORDER = ['FR', 'RS-FR', 'SO', 'RS-SO', 'JR', 'RS-JR', 'SR', 'RS-SR', 'GR']

function userFrom(L, build, types, team, position, opts) {
  const pos = position
  const filledAvg = types.length ? types.reduce((s, t) => s + (build?.[t]?.val ?? 5), 0) / types.length : 5
  const attrs = Object.fromEntries(types.map(t => [t, build?.[t]?.val ?? filledAvg]))
  // traits the lite list leaves out play at the build's average (football's lite rule)
  for (const t of CFB_TYPES_BY_POS[pos]) if (attrs[t] == null) attrs[t] = filledAvg
  const ovr = OVR_FN[pos](build, types) ?? 70
  // (the man he replaces sets how much better or worse the team gets with him. A later season (L.baseDepth): the
  // starter the team's strength was rated with, so a school that lost its starter isn't stronger for it)
  const d = (L.baseDepth ?? L.depth)[team.short]?.[pos] ?? []
  const replaced = d[0]?.ovr ?? 78
  // (opts.noClass, College Football mode: the build has no class. A season is just a year, he's always
  // draft-eligible and the choice to go or stay is the player's. Career's Start in College passes his class)
  let year = opts?.noClass ? null : opts?.year ?? null
  if (!year && !opts?.noClass) {
    // the class the build's players mostly come from, else a junior
    const names = new Set(Object.values(build ?? {}).map(b => b?.qbFull).filter(Boolean))
    const yrs = L.players[pos].filter(p => names.has(p.name) && p.year).map(p => String(p.year).toUpperCase())
    const counts = {}
    for (const y of yrs) counts[y] = (counts[y] ?? 0) + 1
    year = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'JR'
  }
  return { pos, team: team.short, name: opts?.name ?? 'Guest', ovr, rates: RATES[pos](nfrom(attrs), ovr), shift: clamp(-8, 8, (ovr - replaced) * TEAM_SHIFT[pos]), year, replaced, noClass: !!opts?.noClass }
}

// ── The season ───────────────────────────────────────────────────────────────
function simulateSeason(L, { seed, leagueSeed, user, teamAdj, forced, lite = false }) {
  const n = L.teams.length
  const idx = s => L.byShort[s]?.idx ?? -1
  const me = user ? idx(user.team) : -1
  const rL = seeded(`${leagueSeed}|season`)
  // this season's true strength: the data's, a season's own swing, the build, the director's team mods
  const T = L.teams.map((t, i) => {
    let so = t.o + gauss(rL) * 2.0, sd = t.d + gauss(rL) * 2.0
    if (i === me) { so += user.shift + (teamAdj?.o ?? 0); sd += teamAdj?.d ?? 0 }
    return { so, sd }
  })
  const S = {
    prior: L.teams.map((t, i) => t.rating + (i === me ? user.shift * 0.5 : 0) + gauss(rL) * 2.5),
    results: L.teams.map(() => []), w: new Array(n).fill(0), l: new Array(n).fill(0), cw: new Array(n).fill(0), cl: new Array(n).fill(0),
    fcsW: new Array(n).fill(0), h2h: new Map(),
  }
  const record = (i, j, myPts, oppPts, site, conf, oppR = 0) => {
    const won = myPts > oppPts
    S.results[i].push({ opp: j, oppR, m: myPts - oppPts, site })
    if (won) S.w[i]++; else S.l[i]++
    if (conf) { if (won) S.cw[i]++; else S.cl[i]++ }
    if (j < 0 && won) S.fcsW[i]++
    if (j >= 0) S.h2h.set(`${i}>${j}`, won)
  }
  const gameRng = (key, involvesMe) => seeded(`${involvesMe ? seed : leagueSeed}|${key}`)
  const strength = i => (i >= 0 ? T[i] : null)
  const play = (key, i, j, site, conf, fcs = null) => {
    // site: 'a' = i at home, 'b' = j at home, 'n' = neutral
    const mine = i === me || j === me
    const r = gameRng(key, mine)
    const A = T[i], B = j >= 0 ? T[j] : { so: fcs.o, sd: fcs.d }
    const f = mine ? forced?.next(i === me ? 'a' : 'b') : null
    let res
    if (f) {
      // a forced result (a script, or the director's games): the score stands, read back as TDs and FGs
      const my = splitPoints(r, f.mySc), op = splitPoints(r, f.oppSc)
      res = i === me ? { a: my, b: op, ot: f.ot ?? 0 } : { a: op, b: my, ot: f.ot ?? 0 }
    } else res = playGame(r, A, B, site)
    const sA = site === 'a' ? 1 : site === 'b' ? -1 : 0
    record(i, j, res.a.pts, res.b.pts, sA, conf, fcs?.rating ?? 0)
    if (j >= 0) record(j, i, res.b.pts, res.a.pts, -sA, conf)
    stored.set(key, { i, j, res })
    return res
  }
  const stored = new Map()

  // the build team's postseason forced outcomes are read in order
  const polls = [], cfps = []
  const rPoll = k => seeded(`${leagueSeed}|poll|${k}|${me}`)
  polls.push(apPoll(L, S, rPoll('pre'), 'Preseason', -1, 'Aug 18', null, lite))
  const myGames = []
  for (let w = 0; w < WEEKS; w++) {
    const before = polls[polls.length - 1]
    for (const g of L.schedule.games) {
      if (g.week !== w) continue
      const i = idx(g.a), fcs = FCS_BY[g.b] ?? null, j = fcs ? -1 : idx(g.b)
      if (i < 0 || (!fcs && j < 0)) continue
      const res = play(`g${g.id}`, i, j, g.site, g.conf, fcs)
      if (i === me || j === me) {
        const meA = i === me
        const opp = meA ? (fcs ?? L.teams[j]) : L.teams[i]
        const my = meA ? res.a : res.b, op = meA ? res.b : res.a
        const oi = meA ? j : i
        myGames.push({
          g, week: w, opp, oi, fcs: !!fcs, home: g.site === (meA ? 'a' : 'b'), neutral: g.site === 'n', confGame: g.conf,
          my, op, ot: res.ot, myRank: before.rank.get(me) ?? null, oppRank: oi >= 0 ? before.rank.get(oi) ?? null : null,
          oppRec: oi >= 0 ? `${S.w[oi] - (op.pts > my.pts ? 1 : 0)}-${S.l[oi] - (op.pts > my.pts ? 0 : 1)}` : null,
        })
      }
    }
    // the poll after the week's games is the next week's poll (released the Sunday/Tuesday after)
    polls.push(apPoll(L, S, rPoll(w), `Week ${w + 1}`, w + 1, dateOf(w + 1), null, lite))
    // the committee's first ranking comes out the Tuesday of Week 10 (Nov. 3, 2026)
    if (w >= 9) cfps.push(cfpRank(L, S, `Week ${w + 1}`, w + 1, dateOf(w + 1), null, lite))
  }

  // ── conference standings and title games ──
  // (records are snapshots: the regular season here, selection day after the title games, the final
  // record only at the very end; nothing shown before the bowls may count a game not yet played)
  const recReg = { w: S.w.slice(), l: S.l.slice() }
  const preCCG = cfpRank(L, S, 'pre', 14, CCG_DATE)
  const cmp = (a, b) => {
    const pa = S.cw[a] / Math.max(1, S.cw[a] + S.cl[a]), pb = S.cw[b] / Math.max(1, S.cw[b] + S.cl[b])
    if (pa !== pb) return pb - pa
    const h = S.h2h.get(`${a}>${b}`)
    if (h != null && S.h2h.get(`${b}>${a}`) != null && S.h2h.get(`${a}>${b}`) !== S.h2h.get(`${b}>${a}`)) return h ? -1 : 1
    const oa = recReg.w[a] / Math.max(1, recReg.w[a] + recReg.l[a]), ob = recReg.w[b] / Math.max(1, recReg.w[b] + recReg.l[b])
    if (oa !== ob) return ob - oa
    return preCCG.score[b] - preCCG.score[a]
  }
  const standings = []
  const champs = new Map()
  const ccgs = []
  let myCCG = null
  for (const c of L.confs) {
    if (c.kind === 'IND') continue
    const ids = c.teams.map(t => t.idx).sort(cmp)
    let pair = ids.slice(0, 2)
    const divs = [...new Set(c.teams.map(t => t.div).filter(Boolean))]
    if (divs.length === 2) pair = divs.map(dv => ids.find(i => L.teams[i].div === dv))
    let title = null, champ = ids[0]
    if (pair.length === 2 && ids.length >= 4 && c.conf?.ccg !== false) {
      const [a, b] = [...pair].sort(cmp)
      const res = play(`ccg|${c.id}`, a, b, 'n', false)
      champ = res.a.pts > res.b.pts ? a : b
      title = { title: `${c.short} Championship`, a: L.teams[a].short, b: L.teams[b].short, aSc: res.a.pts, bSc: res.b.pts, ot: res.ot, winner: L.teams[champ].short }
      ccgs.push(title)
      if (a === me || b === me) {
        const meA = a === me, oi = meA ? b : a
        myCCG = { title: title.title, opp: L.teams[oi], oi, my: meA ? res.a : res.b, op: meA ? res.b : res.a, ot: res.ot, oppSeedRank: preCCG.rank.get(oi) }
      }
    }
    champs.set(champ, c)
    standings.push({ id: c.id, short: c.short, name: c.name, kind: c.kind, ids, title, champion: L.teams[champ].short })
  }
  const lastAP = polls[polls.length - 1]
  // the record award voters saw (the Heisman and the rest are voted on before the bowls)
  const recCCG = { w: S.w.slice(), l: S.l.slice() }
  polls.push(apPoll(L, S, rPoll('ccg'), 'Week 15', 15, SELECTION_DATE, null, lite))
  // Selection Day: the committee's last ranking (a conference title counts)
  const champBonus = [...champs.entries()].map(([i, c]) => [i, c.kind === 'G5' ? 1 : 2])
  const final = cfpRank(L, S, 'Selection Day', 15, SELECTION_DATE, champBonus)
  cfps.push(final)

  // ── the 12-team CFP (2026 rules) ──
  const ranked = [...final.rank.entries()].sort((a, b) => a[1] - b[1]).map(([i]) => i)
  const field = new Map()
  for (const [i, c] of champs) if (['SEC', 'B1G', 'B12', 'ACC'].includes(c.kind)) field.set(i, { bid: 'auto', why: `${c.short} champion` })
  const g6 = ranked.find(i => L.teams[i].kind === 'G5')
  if (g6 != null) field.set(g6, { bid: 'auto', why: champs.get(g6) ? `${L.teams[g6].confShort} champion, top Group of Six team` : 'Top-ranked Group of Six team' })
  const nd = ranked.find(i => L.teams[i].nd)
  if (nd != null && final.rank.get(nd) <= 12) field.set(nd, { bid: 'auto', why: 'Notre Dame, top 12' })
  for (const i of ranked) { if (field.size >= 12) break; if (!field.has(i)) field.set(i, { bid: 'at-large', why: 'At-large' }) }
  const seeds = [...field.keys()].sort((a, b) => final.rank.get(a) - final.rank.get(b))
  const seedOf = new Map(seeds.map((i, k) => [i, k + 1]))
  const cfpGames = []
  const myCFP = []
  const playCFP = (key, hi, lo, meta, homeHi) => {
    const res = play(`cfp|${key}`, hi, lo, homeHi ? 'a' : 'n', false)
    const win = res.a.pts > res.b.pts ? hi : lo
    const rec = { ...meta, hi: L.teams[hi].short, lo: L.teams[lo].short, hiSeed: seedOf.get(hi), loSeed: seedOf.get(lo), hiSc: res.a.pts, loSc: res.b.pts, ot: res.ot, winner: L.teams[win].short }
    cfpGames.push(rec)
    if (hi === me || lo === me) {
      const meHi = hi === me, oi = meHi ? lo : hi
      myCFP.push({ ...meta, opp: L.teams[oi], oi, my: meHi ? res.a : res.b, op: meHi ? res.b : res.a, ot: res.ot, home: !!homeHi && meHi, neutral: !homeHi, mySeed: seedOf.get(me), oppSeed: seedOf.get(oi) })
    }
    return win
  }
  const s = k => seeds[k - 1]
  const fr = [[5, 12], [6, 11], [7, 10], [8, 9]].map(([a, b]) => playCFP(`fr${a}`, s(a), s(b), { round: 'First Round', bowl: null, site: `${L.teams[s(a)].name} campus`, date: a === 5 ? 'Dec 18' : 'Dec 19' }, true))
  // the quarterfinal bowls: the top seeds placed by the committee (geography: the Big Ten's champion to the Rose…)
  const freeBowls = ['Fiesta', 'Cotton', 'Rose', 'Peach']
  const qfBowl = {}
  for (const k of [1, 2, 3, 4]) {
    const pref = QF_PREF[L.teams[s(k)].kind] ?? QF_PREF.G5
    const b = pref.find(x => freeBowls.includes(x)) ?? freeBowls[0]
    freeBowls.splice(freeBowls.indexOf(b), 1)
    qfBowl[k] = QF_BOWLS[b]
  }
  const qfOpp = { 1: fr[3], 2: fr[2], 3: fr[1], 4: fr[0] }
  const qf = {}
  for (const k of [1, 2, 3, 4]) qf[k] = playCFP(`qf${k}`, s(k), qfOpp[k], { round: 'Quarterfinal', ...qfBowl[k] }, false)
  const order2 = (a, b) => (seedOf.get(a) < seedOf.get(b) ? [a, b] : [b, a])
  const [s1h, s1l] = order2(qf[1], qf[4]), [s2h, s2l] = order2(qf[2], qf[3])
  const sf1 = playCFP('sf1', s1h, s1l, { round: 'Semifinal', ...SF_BOWLS[0] }, false)
  const sf2 = playCFP('sf2', s2h, s2l, { round: 'Semifinal', ...SF_BOWLS[1] }, false)
  const [nh, nl] = order2(sf1, sf2)
  const natChamp = playCFP('ncg', nh, nl, { ...NCG }, false)
  const runnerUp = natChamp === nh ? nl : nh

  // ── bowls: the other teams with six wins (one FCS win counts) ──
  const eligible = ranked.filter(i => !field.has(i) && recCCG.w[i] - Math.max(0, S.fcsW[i] - 1) >= 6)
  const fill = ranked.filter(i => !field.has(i) && !eligible.includes(i) && recCCG.w[i] >= 5)
  const pool = [...eligible, ...fill].slice(0, BOWLS.length * 2)
  const bowls = []
  let myBowl = null
  const rB = seeded(`${leagueSeed}|bowls`)
  for (const [bowl, site, date] of BOWLS) {
    if (pool.length < 2) break
    const a = pool.shift()
    let k = pool.findIndex((b, j) => j < 6 && L.teams[b].confId !== L.teams[a].confId && !S.results[a].some(x => x.opp === b))
    if (k < 0) k = 0
    const b = pool.splice(k, 1)[0]
    const [x, y] = rB() < 0.5 ? [a, b] : [b, a]
    const res = play(`bowl|${bowl}`, x, y, 'n', false)
    const win = res.a.pts > res.b.pts ? x : y
    bowls.push({ bowl, site, date, a: L.teams[x].short, b: L.teams[y].short, aSc: res.a.pts, bSc: res.b.pts, ot: res.ot, winner: L.teams[win].short })
    if (x === me || y === me) {
      const meA = x === me, oi = meA ? y : x
      myBowl = { round: 'Bowl', bowl, site, date, opp: L.teams[oi], oi, my: meA ? res.a : res.b, op: meA ? res.b : res.a, ot: res.ot, neutral: true, home: false }
    }
  }

  // ── the final AP poll: the champion first, the runner-up next ──
  const extra = [[natChamp, 25], [runnerUp, 8]]
  for (const g of cfpGames.filter(x => x.round === 'Semifinal')) extra.push([L.byShort[g.winner === g.hi ? g.lo : g.hi].idx, 4])
  polls.push(apPoll(L, S, rPoll('final'), 'Final', 16, 'Jan 26, 2027', extra, lite))

  return { S, T, polls, cfps, final, preCCG, lastAP, standings, champs, ccgs, myGames, myCCG, myCFP, myBowl, field, seeds, seedOf, cfpGames, natChamp, runnerUp, bowls, me, res: stored, recReg, recCCG, recFinal: { w: S.w.slice(), l: S.l.slice() } }
}

// ── Lines, totals ────────────────────────────────────────────────────────────
const LINE_KEYS = {
  qb: ['comp', 'att', 'passYds', 'tds', 'ints', 'rushAtt', 'rushYds', 'rushTDs', 'sacks'],
  rb: ['carries', 'rushYds', 'rushTDs', 'recs', 'recYds', 'recTDs', 'fumbles'],
  wr: ['targets', 'rec', 'recYds', 'recTDs'],
}
function lineFor(pos, box, wrSlot = 0) { return pos === 'qb' ? box.qb : pos === 'rb' ? box.rb : box.wrs[wrSlot] }
function decorate(pos, line) {
  if (pos === 'qb') return { ...line, rating: Math.round(nflRating(line.comp, line.att, line.passYds, line.tds, line.ints)), eff: cfbPasserEfficiency(line.comp, line.att, line.passYds, line.tds, line.ints) }
  if (pos === 'rb') return { ...line, ypc: line.carries ? Math.round((line.rushYds / line.carries) * 10) / 10 : 0 }
  return line
}
// season totals in football's season* keys, from any list of game lines
export function cfbSeasonTotals(pos, games) {
  const sum = k => games.reduce((s, g) => s + (g?.[k] ?? 0), 0)
  if (pos === 'qb') {
    const c = sum('comp'), a = sum('att'), y = sum('passYds'), t = sum('tds'), i = sum('ints')
    return {
      seasonPassYds: y, seasonTDs: t, seasonINTs: i, seasonRushYds: sum('rushYds'), seasonRushTDs: sum('rushTDs'), seasonSacks: sum('sacks'),
      seasonAttempts: a, seasonCompletions: c, seasonCompPct: a ? Math.round((c / a) * 1000) / 10 : 0,
      seasonRating: Math.round(nflRating(c, a, y, t, i)), seasonEff: cfbPasserEfficiency(c, a, y, t, i), seasonRushAtt: sum('rushAtt'), gp: games.length,
    }
  }
  if (pos === 'rb') {
    const car = sum('carries'), ry = sum('rushYds')
    return {
      seasonRushYds: ry, seasonRushTDs: sum('rushTDs'), seasonCarries: car, seasonYPC: car ? Math.round((ry / car) * 100) / 100 : 0, seasonFumbles: sum('fumbles'),
      seasonRecYds: sum('recYds'), seasonRecTDs: sum('recTDs'), seasonRecs: sum('recs'), seasonLong: Math.max(0, ...games.map(g => g?.long ?? 0)),
      hundredYardGames: games.filter(g => (g?.rushYds ?? 0) >= 100).length, gp: games.length,
    }
  }
  const rec = sum('rec'), yds = sum('recYds'), tgt = sum('targets')
  return {
    seasonRecs: rec, seasonRecYds: yds, seasonRecTDs: sum('recTDs'), seasonTargets: tgt, seasonYPR: rec ? Math.round((yds / rec) * 10) / 10 : 0,
    seasonLong: Math.max(0, ...games.map(g => g?.long ?? 0)), hundredYardGames: games.filter(g => (g?.recYds ?? 0) >= 100).length,
    catchRate: tgt ? Math.round((rec / tgt) * 1000) / 10 : 0, gp: games.length,
  }
}
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
function lineText(pos, t) {
  if (pos === 'qb') return `${fmt(t.seasonPassYds)} pass yds, ${t.seasonTDs} TD, ${t.seasonINTs} INT${t.seasonRushYds >= 250 ? `; ${fmt(t.seasonRushYds)} rush yds, ${t.seasonRushTDs} TD` : t.seasonRushTDs >= 3 ? `; ${t.seasonRushTDs} rush TD` : ''}`
  if (pos === 'rb') return `${fmt(t.seasonRushYds)} rush yds, ${t.seasonRushTDs} TD, ${t.seasonYPC.toFixed(1)} a carry${t.seasonRecYds >= 150 ? `; ${t.seasonRecs} rec, ${t.seasonRecYds} yds` : ''}`
  return `${t.seasonRecs} rec, ${fmt(t.seasonRecYds)} yds, ${t.seasonRecTDs} TD`
}
export const CFB_GAME_LINE = {
  qb: g => `${g.comp}/${g.att}, ${g.passYds} yds, ${g.tds} TD${g.ints ? `, ${g.ints} INT` : ''}${g.rushYds >= 40 ? `; ${g.rushYds} rush` : ''}`,
  rb: g => `${g.carries} car, ${g.rushYds} yds, ${g.rushTDs} TD${g.recs ? `; ${g.recs} rec, ${g.recYds} yds` : ''}`,
  wr: g => `${g.rec} rec (${g.targets} tgt), ${g.recYds} yds${g.recTDs ? `, ${g.recTDs} TD` : ''}`,
}

// ── Awards ───────────────────────────────────────────────────────────────────
function production(pos, t) {
  if (pos === 'qb') return (t.seasonPassYds + Math.max(0, t.seasonRushYds)) / 100 * 1.15 + (t.seasonTDs + t.seasonRushTDs) * 2.4 - t.seasonINTs * 2.0 + (t.seasonEff - 150) * 0.12
  if (pos === 'rb') return (t.seasonRushYds + t.seasonRecYds) / 100 * 3.0 + (t.seasonRushTDs + t.seasonRecTDs) * 2.6 + (t.seasonYPC - 5) * 2
  return t.seasonRecYds / 100 * 4.0 + t.seasonRecTDs * 2.6 + t.seasonRecs * 0.08
}
function teamFactor(L, R, i) {
  const rk = R.final.rank.get(i) ?? 99
  return R.recCCG.w[i] * 4 - R.recCCG.l[i] * 1.5 + (rk <= 4 ? 8 : rk <= 12 ? 4 : rk <= 25 ? 1 : -5) + (R.champs.has(i) ? 3 : 0) + (L.teams[i].tier === 'G5' ? -10 : 0)
}
const POS_UP = { qb: 'QB', rb: 'RB', wr: 'WR' }
function voteOut(c) { return { name: c.name, team: c.team, teamName: c.teamName, pos: POS_UP[c.pos], conf: c.conf, year: c.year, isUser: !!c.isUser, line: c.line ?? (c.line = lineText(c.pos, c.t)), stats: c.t } }

function runAwards(L, R, cands, rA, user) {
  const all = cands.filter(c => c.t.gp >= 8)
  for (const c of all) { c.prod = production(c.pos, c.t); c.team_ = teamFactor(L, R, c.ti) }
  // Heisman voters compare a back's or a receiver's year with the other backs' and receivers', not with a
  // quarterback's yardage: each position's production is put on the QB scale through the top ten at that
  // position this season (a receiver's 1,500 yards reads like a QB's 4,000). production() alone left WRs about
  // 40 points behind, so a 99 Jeremiah Smith was a finalist 3% of the time and the non-QB winner never came.
  const top10 = pos => { const v = all.filter(c => c.pos === pos).map(c => c.prod).sort((a, b) => b - a).slice(0, 10); const m = v.reduce((a, b) => a + b, 0) / (v.length || 1); return { m, sd: Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length || 1)) || 1 } }
  const ref = { qb: top10('qb'), rb: top10('rb'), wr: top10('wr') }
  const onQB = c => (c.pos === 'qb' ? c.prod : ref.qb.m + (c.prod - ref[c.pos].m) / ref[c.pos].sd * ref.qb.sd)
  for (const c of all) {
    c.hype = gauss(rA) * 7
    // (a Group of Six star is a long shot: none has won since BYU's Ty Detmer in 1990)
    // (QBs win about 4 in 5: a back or receiver needs the bigger year. Henry '15, Smith '20, Hunter '24 did)
    // (the marquee names: voters come in knowing the country's best players, and a star on a contender is on
    // every preseason watch list; the build's rating counts the same way)
    c.heis = onQB(c) + c.team_ + c.hype + clamp(-5, 12, ((c.ovr ?? 80) - 88) * 1.4) + (c.pos === 'rb' ? -10 : c.pos === 'wr' ? -19 : 0) - (L.teams[c.ti].tier === 'G5' ? 30 : 0)
  }
  // the Heisman: ~930 ballots, 3-2-1 (each voter sees the race a little differently)
  const field = [...all].sort((a, b) => b.heis - a.heis).slice(0, 14)
  for (const c of field) { c.pts = 0; c.v1 = 0; c.v2 = 0; c.v3 = 0 }
  for (let v = 0; v < 930; v++) {
    const b = field.map(c => [c.heis + bell(rA) * 12, c]).sort((x, y) => y[0] - x[0])
    b[0][1].pts += 3; b[0][1].v1++; b[1][1].pts += 2; b[1][1].v2++; b[2][1].pts += 1; b[2][1].v3++
  }
  field.sort((a, b) => b.pts - a.pts)
  let nf = 3
  if (field[3] && field[3].pts >= field[0].pts * 0.18) nf = 4
  if (field[4] && nf === 4 && field[4].pts >= field[3].pts * 0.85) nf = 5
  const ballot = field.filter(c => c.pts > 0).slice(0, 10).map(c => ({ ...voteOut(c), pts: c.pts, first: c.v1, second: c.v2, third: c.v3 }))
  const userIdx = field.findIndex(c => c.isUser)
  const heisman = {
    award: 'Heisman Trophy', winner: ballot[0] ?? null, finalists: ballot.slice(0, nf), ballot,
    userPlace: userIdx >= 0 && field[userIdx].pts > 0 ? userIdx + 1 : null, userFinalist: userIdx >= 0 && userIdx < nf, userWon: userIdx === 0,
  }
  // the position and player-of-the-year awards: their own voters, their own weights
  const award = (name, pool, score, nFin = 3) => {
    const ranked = pool.map(c => [score(c) + gauss(rA) * 4, c]).sort((a, b) => b[0] - a[0]).map(x => x[1])
    const fin = ranked.slice(0, nFin)
    return { award: name, winner: fin[0] ? voteOut(fin[0]) : null, finalists: fin.map(voteOut), userWon: !!fin[0]?.isUser, userFinalist: fin.some(c => c.isUser) }
  }
  const qbs = all.filter(c => c.pos === 'qb'), rbs = all.filter(c => c.pos === 'rb'), wrs = all.filter(c => c.pos === 'wr')
  const daveyOBrien = award("Davey O'Brien Award", qbs, c => c.prod + c.team_ * 0.6)
  const doakWalker = award('Doak Walker Award', rbs, c => c.prod + c.team_ * 0.4)
  const biletnikoff = award('Biletnikoff Award', wrs, c => c.prod + c.team_ * 0.3)
  const maxwell = award('Maxwell Award', all, c => c.heis + gauss(rA) * 4)
  const walterCamp = award('Walter Camp Award', all, c => c.heis + gauss(rA) * 3, 5)
  // All-America and all-conference teams: 1 QB, 2 RBs, 3 WRs a team
  const teamsOf = (pool, w) => {
    const by = pos => pool.filter(c => c.pos === pos).map(c => [c.prod + c.team_ * w + gauss(rA) * 3, c]).sort((a, b) => b[0] - a[0]).map(x => x[1])
    const q = by('qb'), rr = by('rb'), ww = by('wr')
    const first = { qb: q.slice(0, 1), rb: rr.slice(0, 2), wr: ww.slice(0, 3) }
    const second = { qb: q.slice(1, 2), rb: rr.slice(2, 4), wr: ww.slice(3, 6) }
    const has = t => Object.values(t).flat().some(c => c.isUser)
    const out = t => ({ qb: t.qb.map(voteOut), rb: t.rb.map(voteOut), wr: t.wr.map(voteOut) })
    return { first: out(first), second: out(second), user: has(first) ? 'first' : has(second) ? 'second' : null }
  }
  const allAmerica = teamsOf(all, 0.3)
  let allConference = null, confPOY = null
  if (user) {
    const meT = L.byShort[user.team]
    if (meT.kind !== 'IND') {
      const confPool = all.filter(c => L.teams[c.ti].confId === meT.confId)
      allConference = { conf: meT.confShort, ...teamsOf(confPool, 0.2) }
      const poy = award(`${meT.confShort} Offensive Player of the Year`, confPool, c => c.prod + c.team_ * 0.5, 1)
      confPOY = { award: poy.award, winner: poy.winner, userWon: poy.userWon }
    }
  }
  return { heisman, daveyOBrien, doakWalker, biletnikoff, maxwell, walterCamp, allAmerica, allConference, confPOY }
}

const NO_AWARD = { winner: null, finalists: [], userWon: false, userFinalist: false }
const LITE_AWARDS = { lite: true, heisman: { ...NO_AWARD, award: 'Heisman Trophy', ballot: [], userPlace: null }, daveyOBrien: NO_AWARD, doakWalker: NO_AWARD, biletnikoff: NO_AWARD, maxwell: NO_AWARD, walterCamp: NO_AWARD,
  allAmerica: { first: { qb: [], rb: [], wr: [] }, second: { qb: [], rb: [], wr: [] }, user: null }, allConference: null, confPOY: null }

// ── NFL draft stock ──────────────────────────────────────────────────────────
// Talent (the OVR) plus how the season went, against what that position's teams draft on.
// The cuts come from the data, so a regrade can't move them: each is the OVR of the k-th best real
// starter at the position (QB1/RB1, WR1-3), with k = how many a draft takes from the top of a class divided by
// ~0.6, the share of starters who are draft-eligible in a given year. A typical draft: ~2 top-10 QBs, 4 in
// round 1, 8 by the end of Day 2, 14 by Day 3; RBs 1 / 2 / 10 / 22; WRs 2 / 6 / 20 / 36; priority free agents next.
const DRAFT_K = { qb: [3, 7, 13, 23, 48], rb: [2, 3, 17, 37, 70], wr: [3, 10, 33, 60, 100] }
function draftCuts(pos) {
  const L = cfbLeague()
  if (L.draftCuts?.[pos]) return L.draftCuts[pos]
  const pool = L.players[pos].filter(p => (p.depth ?? 1) <= (pos === 'wr' ? 3 : 1)).map(p => p.ovr).sort((a, b) => b - a)
  const at = k => pool[Math.min(pool.length - 1, k - 1)] ?? 70
  const cuts = DRAFT_K[pos].map(at)
  // (a cut never sits on top of the next one: each tier is at least one OVR point)
  for (let i = 1; i < cuts.length; i++) cuts[i] = Math.min(cuts[i], cuts[i - 1] - 1)
  ;(L.draftCuts ??= {})[pos] = cuts
  return cuts
}
const PROD_PAR = { qb: 95, rb: 75, wr: 70 }   // production() of a solid starter's season
// ── The draft board ──
// The build is ranked against this season's draft-eligible real players at his position (the ones the award
// races simulated: the country's best, the top 25's and his conference's). Every one of them gets the same
// grade, in OVR points, so two players of the same rating with the same kind of year sit together:
//   his OVR (the tools: the main thing, NFL boards grade the player first)
//   + production against the position: his line a game, credited or discounted for the defenses he saw
//     (COMP_K a standard deviation of schedule defense), as a z-score among the players on the board
//   + team success and strength of schedule, a modest third (capped)
//   + awards (Heisman, the position award, All-America; MARK_PTS a mark) · an underclassman with a big year
//     rises, a senior slips a little.
// (Before Nov 10 it was a mix of z-scores with the team near a fifth of the weight and season totals for
// production: an 88 QB went 14th at Georgia and 22nd at Vanderbilt off similar lines, and a QB class this deep
// (nine starters rated 92+) put most 88s past the 13th slot, a free agent.)
// His rank on that board is his slot in a real class. Volume (NFL Drafts 2021-2025, Pro Football Reference /
// ESPN draft results): about 10-14 QBs, 20-25 RBs and 30-35 WRs a year; QBs ~3-4 in round 1, RBs ~1-2, WRs ~5-6.
// Rank → tier: QB 1-2 top-10, 3-4 R1, 5-8 Day 2, 9-18 Day 3, 19-32 PFA; RB 1 top-10 (a clear No. 1), 2 R1,
// 3-9 Day 2, 10-23 Day 3, 24-40 PFA; WR 1-2 top-10, 3-6 R1, 7-16 Day 2, 17-33 Day 3, 34-55 PFA.
// (QB: the real class this game simulates is deeper at the top than a real year's, so the Day 2 and Day 3
// lines sit lower than the 2021-25 average: 18 drafted)
const BOARD_SLOTS = { qb: [2, 4, 8, 18, 32], rb: [1, 2, 9, 23, 40], wr: [2, 6, 16, 33, 55] }
const BOARD_W = { prod: 2.2, team: 0.7 }   // OVR points a standard deviation
const MARK_PTS = 5                          // OVR points a mark (a Heisman winner +3, a finalist +1.5)
const COMP_K = 0.09                         // production a game: the share a standard deviation (7.2 pts) of the defenses faced is worth
// A Career's college player (opts.career, components/cfb/CareerCollege.jsx): the board reads his whole college
// career, not this season alone. { seasons: earlier seasons, heisman: best finish 'won' | 'finalist',
// allAmerica: 'first' | 'second', totals: [each earlier season's totals] }. His production is the better of this
// season and his career average, his earlier honors count, and a past Heisman winner coming off a good year
// stays a 1st-rounder. Without it (College Football mode) a season is judged on its own.
const CAREER_MARK = { won: 0.6, finalist: 0.25, first: 0.25, second: 0.1, season: 0.05 }
const isSenior = c => /SR|GR|5TH/.test(String(c.year ?? '').toUpperCase())
// production a game (as a 13-game season), with the schedule's defenses counted: a line against SEC defenses
// is worth more than the same line against the MAC's
const prodPG = (pos, t, oppD = 0) => production(pos, t) * 13 / Math.max(8, t.gp || 13) * (1 + COMP_K * clamp(-1.5, 1.5, oppD / PTS_PER_Z))
function draftBoard(L, R, pos, cands, awards, career = null) {
  const eligible = c => c.isUser || ELIGIBLE.has(String(c.year ?? '').toUpperCase())
  const pool = cands.filter(c => c.pos === pos && (c.t.gp >= 8 || c.isUser) && eligible(c))
  if (pool.length < 8 || !pool.some(c => c.isUser)) return null
  const marks = new Map()
  const mark = (who, v) => { if (!who) return; const k = `${who.name}|${who.team}`; marks.set(k, (marks.get(k) ?? 0) + v) }
  const posAward = { qb: awards.daveyOBrien, rb: awards.doakWalker, wr: awards.biletnikoff }[pos]
  mark(awards.heisman.winner, 0.6); for (const f of awards.heisman.finalists) mark(f, 0.3)
  mark(posAward?.winner, 0.35); for (const f of posAward?.finalists ?? []) mark(f, 0.15)
  for (const f of awards.allAmerica.first[pos] ?? []) mark(f, 0.25)
  for (const f of awards.allAmerica.second[pos] ?? []) mark(f, 0.1)
  const me = pool.find(c => c.isUser)
  const oppD = c => R.oppDef?.[c.ti] ?? 0
  const prodOf = c => {
    const now = prodPG(pos, c.t, oppD(c))
    if (!c.isUser || !career?.totals?.length) return now
    const all = [now, ...career.totals.map(t => prodPG(pos, { seasonEff: 150, seasonYPC: 5, gp: 13, ...t }, oppD(c)))]
    return Math.max(now, all.reduce((a, b) => a + b, 0) / all.length)
  }
  if (career) mark(me, (CAREER_MARK[career.heisman] ?? 0) + (CAREER_MARK[career.allAmerica] ?? 0) + CAREER_MARK.season * (career.seasons ?? 0))
  // the teams he won with before (College Football mode's earlier seasons: career.teams, { w, l, cfp, title, conf }):
  // a winner's résumé counts a little, a losing one costs a little (this season's team is in the team term below)
  if (career?.teams?.length) mark(me, clamp(-0.15, 0.3, career.teams.reduce((n, x) => n + (x.title ? 0.15 : x.cfp ? 0.08 : 0) + (x.conf ? 0.05 : 0) + ((x.w ?? 0) >= 11 ? 0.05 : 0) - ((x.l ?? 0) >= 7 ? 0.08 : 0), 0)))
  const z = vals => { const m = vals.reduce((a, b) => a + b, 0) / vals.length; const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length) || 1; return v => (v - m) / sd }
  const zp = z(pool.map(prodOf))
  const teamV = c => teamFactor(L, R, c.ti) + (L.sos[c.ti] ?? 0) * 0.3
  const zt = z(pool.map(teamV))
  const rows = pool.map(c => {
    const pz = clamp(-2.2, 2.5, zp(prodOf(c)))
    const cls = isSenior(c) ? -0.4 : 0.6 * Math.max(0, pz)
    // (a bad team costs a prospect a little, not his grade: Caleb Williams went 1st off a 7-5 USC, Josh Allen 7th off Wyoming)
    const score = (c.ovr ?? 75) + BOARD_W.prod * pz + BOARD_W.team * clamp(-1.5, 1.5, zt(teamV(c))) + MARK_PTS * (marks.get(`${c.name}|${c.team}`) ?? 0) + cls
    return { c, score }
  }).sort((a, b) => b.score - a.score)
  // the CLASS, not everyone eligible: every senior enters; an underclassman only declares when he grades out
  // with a Day 2 grade or close to it (inside the Day 2 line plus two): a Day 3 underclassman goes back to
  // school, as most do. The build is always in it.
  const declareLine = BOARD_SLOTS[pos][2] + 2
  const cls = rows.filter((x, k) => x.c.isUser || isSenior(x.c) || k < declareLine)
  // (each row: the tier its slot on the board carries, BOARD_SLOTS, and the season's headline numbers)
  const sl = BOARD_SLOTS[pos]
  const tierAt = k => (k <= sl[0] ? 'top10' : k <= sl[1] ? 'r1' : k <= sl[2] ? 'day2' : k <= sl[3] ? 'day3' : k <= sl[4] ? 'pfa' : 'udfa')
  const nums = c => (pos === 'qb' ? { yds: c.t.seasonPassYds, td: c.t.seasonTDs + c.t.seasonRushTDs } : pos === 'rb' ? { yds: c.t.seasonRushYds, td: c.t.seasonRushTDs + c.t.seasonRecTDs } : { yds: c.t.seasonRecYds, td: c.t.seasonRecTDs })
  const view = list => {
    const rank = list.findIndex(x => x.c.isUser) + 1
    return { rank, of: list.length, eligible: rows.length, score: list[rank - 1].score, tierAt, place,
      top: list.slice(0, 25).map((x, k) => ({ name: x.c.name, team: x.c.team, year: x.c.year, ovr: x.c.ovr, isUser: !!x.c.isUser, tier: tierAt(k + 1), ...nums(x.c) })) }
  }
  // (draftStock: a rule that moves his tier moves him to the edge of it, so his number and the round agree)
  function place(k) {
    const meRow = cls.find(x => x.c.isUser), rest = cls.filter(x => !x.c.isUser)
    const at = clamp(1, rest.length + 1, k)
    return view([...rest.slice(0, at - 1), meRow, ...rest.slice(at - 1)])
  }
  return view(cls)
}

// Where a tier's picks fall in a 7-round, 224-pick draft (32 a round, the draft Career runs), and how wide a
// projection is there: a top-10 grade is a few picks either way, a Day 3 grade most of a round
const TIER_PICKS = { top10: [1, 10], r1: [11, 32], day2: [33, 96], day3: [97, 224] }
const TIER_HALF = { top10: 2, r1: 5, day2: 12, day3: 22 }
const TIER_ORDER = ['top10', 'r1', 'day2', 'day3', 'pfa', 'udfa']
// his pick range: inside his tier's picks, by where his rank sits among the board slots that tier holds
// (the first of the tier's ranks goes at the front of it). Undrafted tiers have none
function pickWindow(pos, tier, board) {
  const span = TIER_PICKS[tier]
  if (!span) return null
  const sl = BOARD_SLOTS[pos], i = TIER_ORDER.indexOf(tier)
  const a = i ? sl[i - 1] + 1 : 1, b = sl[i], k = board?.rank ?? null
  const f = k == null ? 0.5 : k < a ? 0.12 : k > b ? 0.88 : (k - a + 0.5) / (b - a + 1)
  const top = pos === 'qb' ? 1 : 3   // (the first two picks are a quarterback's: Career's draft, lib/career.js stockOf)
  const mid = span[0] + f * (span[1] - span[0]), h = TIER_HALF[tier]
  const lo = Math.max(top, span[0], Math.round(mid - h))
  return [lo, Math.max(lo, Math.min(span[1], Math.round(mid + h)))]
}
function draftStock(pos, ovr, t, awards, year, board = null, career = null, noClass = false) {
  const yr = String(year ?? 'JR').toUpperCase()
  const prodAdj = clamp(-3, 3.5, (production(pos, t) - PROD_PAR[pos]) / 15)
  const v = ovr + prodAdj + (awards?.heisman?.userWon ? 1.5 : awards?.heisman?.userFinalist ? 0.7 : 0) + (awards?.allAmerica?.user === 'first' ? 1 : 0)
  const c = draftCuts(pos)
  let tier = v >= c[0] ? 'top10' : v >= c[1] ? 'r1' : v >= c[2] ? 'day2' : v >= c[3] ? 'day3' : v >= c[4] ? 'pfa' : 'udfa'
  // the board (when the award races ran): his rank among the eligible players at the position sets the slot
  // (the OVR cuts above are the lite fallback)
  if (board) {
    const sl = BOARD_SLOTS[pos], k = board.rank
    tier = k <= sl[0] ? 'top10' : k <= sl[1] ? 'r1' : k <= sl[2] ? 'day2' : k <= sl[3] ? 'day3' : k <= sl[4] ? 'pfa' : 'udfa'
    // (a top-10 pick needs a clear grade, not only the top of a thin board: at least the OVR of the
    // position's best few starters, draftCuts)
    if (tier === 'top10' && board.score < c[0]) tier = 'r1'
  }
  // elite tools go early whatever the team did, once he has produced: 96+ is a 1st-rounder, 92+ goes by Day 2
  const ORDER = TIER_ORDER
  const floor = ovr >= 96 ? 'r1' : ovr >= 92 ? 'day2' : null
  if (floor && production(pos, t) >= PROD_PAR[pos] * 0.8 && ORDER.indexOf(tier) > ORDER.indexOf(floor)) tier = floor
  // a past Heisman winner coming off a good year isn't a Day 2 pick (a Career's college player)
  if (career?.heisman === 'won' && production(pos, t) >= PROD_PAR[pos] * 0.85 && !['top10', 'r1'].includes(tier)) tier = 'r1'
  // his number on the board agrees with the round: a rule above that moved him puts him at the edge of his tier
  if (board && board.tierAt(board.rank) !== tier) {
    const sl = BOARD_SLOTS[pos], i = ORDER.indexOf(tier)
    const better = ORDER.indexOf(board.tierAt(board.rank)) > i
    board = board.place(better ? sl[i] : i ? sl[i - 1] + 1 : 1)
  }
  const LABEL = { top10: 'Projected top-10 pick', r1: 'Projected 1st round', day2: 'Day 2 (Rounds 2-3)', day3: 'Day 3 (Rounds 4-7)', pfa: 'Priority free agent', udfa: 'Undrafted free agent' }
  const ROUND = { top10: [1, 1], r1: [1, 1], day2: [2, 3], day3: [4, 7], pfa: null, udfa: null }
  // the projection in picks, and his place on the overall board: the middle of that range (the rest of the
  // class, the other positions, isn't simulated: a prospect's big-board number sits about where he's picked)
  const pick = pickWindow(pos, tier, board)
  const overall = pick ? Math.round((pick[0] + pick[1]) / 2) : null
  const shared = { tier, label: LABEL[tier], round: ROUND[tier], pick, overall, boardRank: board?.rank ?? null, boardOf: board?.of ?? null, board: board?.top ?? null }
  // (no class, College Football mode: always eligible, always a projection; going or staying is the player's call)
  if (noClass) return { year: null, eligible: true, declares: true, ...shared, draftYear: 2027, note: null }
  const eligible = ELIGIBLE.has(yr)
  if (!eligible) {
    const ci = CLASS_ORDER.indexOf(yr)
    const yearsOut = yr === 'FR' ? 2 : yr === 'RS-FR' || yr === 'SO' ? 1 : 1
    const draftYear = 2027 + Math.max(1, yearsOut)
    return { year: yr, eligible: false, declares: false, ...shared, label: `Not draft-eligible yet (${yr})`, draftYear,
      note: `Eligible for the ${draftYear} NFL Draft. Early board: ${LABEL[tier].replace('Projected ', '')}`, classIndex: ci }
  }
  const senior = /SR|GR|5TH/.test(yr)
  const declares = senior || tier === 'top10' || tier === 'r1' || tier === 'day2'
  return {
    year: yr, eligible: true, declares, ...shared, draftYear: 2027,   // (boardRank: his place among the eligible players at the position)
    note: senior ? 'Out of eligibility: in the 2027 NFL Draft' : declares ? 'Declares for the 2027 NFL Draft' : 'Returns to school for another season',
  }
}

// ── The forced results reader (scripts and the director's games) ─────────────
function forcedReader(script) {
  if (!script) return null
  const reg = (script.games ?? []).map(g => ({ mySc: g.mySc, oppSc: g.oppSc, ot: g.ot ?? 0, won: g.won }))
  const post = (script.postseason ?? script.rounds ?? []).map(g => ({ mySc: g.mySc, oppSc: g.oppSc, ot: g.ot ?? 0 }))
  let i = 0, j = 0
  return {
    next() {
      if (i < reg.length) { const g = reg[i++]; return fixWon(g) }
      if (j < post.length) return fixWon(post[j++])
      return null
    },
  }
}
// a forced score has to agree with its result (a director's moment can rewrite one)
function fixWon(g) {
  let { mySc, oppSc } = g
  if (g.won != null) {
    if (g.won && mySc <= oppSc) mySc = oppSc + 3
    if (!g.won && oppSc <= mySc) oppSc = mySc + 3
  }
  if (mySc === oppSc) mySc += 3
  return { ...g, mySc, oppSc }
}

// ══════════════════════════════════════════════════════════════════════════════
// runCFBSimulation
// ══════════════════════════════════════════════════════════════════════════════
export function runCFBSimulation(build, types = null, team = null, position = 'qb', rngSeed = null, gameMode = 'classic', script = null, opts = {}) {
  const L = cfbLeague(opts?.pools ?? null)
  const pos = ['qb', 'rb', 'wr'].includes(position) ? position : 'qb'
  types = types?.length ? types : CFB_TYPES_BY_POS[pos]
  const seed = String(rngSeed ?? script?.seed ?? Math.floor(Math.random() * 1e9).toString(36))
  const leagueSeed = String(opts?.leagueSeed ?? script?.leagueSeed ?? seed)
  const base = (typeof team === 'string' ? L.byShort[team] : L.byShort[team?.short]) ?? L.teams.slice().sort((a, b) => b.rating - a.rating)[0]
  // the director's team mods (team.off / team.def moved in the data's units) → points
  const teamAdj = typeof team === 'object' && team ? {
    o: typeof team.off === 'number' && typeof base.off === 'number' ? ((team.off - base.off) / L.scale.offSD) * PTS_PER_Z : 0,
    d: typeof team.def === 'number' && typeof base.def === 'number' ? (L.scale.flip * (team.def - base.def) / L.scale.defSD) * PTS_PER_Z : 0,
  } : null
  const ovr = OVR_FN[pos](build, types) ?? 70
  const user = userFrom(L, build, types, base, pos, opts)
  const keepLines = !!script?.keepLines
  const forced = forcedReader(script)
  const lite = !!opts?.lite
  const R = simulateSeason(L, { seed, leagueSeed, user, teamAdj, forced, lite })
  const me = R.me

  // ── box scores: every team's regular season and title game (the award races), the build's postseason too ──
  const cands = new Map()
  const addLine = (who, ti, line, p, gameKey) => {
    if (!who) return
    const c = cands.get(who.key) ?? { key: who.key, name: who.name, team: L.teams[ti].short, teamName: L.teams[ti].name, conf: L.teams[ti].confShort, ti, pos: p, year: who.year, ovr: who.ovr, isUser: !!who.isUser, games: [], reg: [] }
    c.games.push(line)
    if (/^g/.test(gameKey)) c.reg.push(line)   // (regular-season games: the leaders below)
    cands.set(who.key, c)
  }
  const units = L.teams.map(t => unitFor(L, t, user))
  const boxOf = (ti, key, my, op, oppIdx, oppD) => {
    const mine = ti === me
    const r = seeded(`${mine ? seed : leagueSeed}|box|${L.teams[ti].short}|${key}`)
    return teamBox(r, units[ti], { pts: my.pts, oppPts: op.pts, offTD: Math.max(0, my.offTD) }, oppD)
  }
  const userGames = []   // the build's own lines: regular season, then postseason
  const runTeamGames = (ti, list) => {
    for (const x of list) {
      const box = boxOf(ti, x.key, x.my, x.op, x.oi, x.oppD)
      const u = units[ti]
      addLine(u.qb.who, ti, box.qb, 'qb', x.key)
      addLine(u.rb.who, ti, box.rb, 'rb', x.key)
      u.wrs.forEach((w, k) => addLine(w.who, ti, box.wrs[k], 'wr', x.key))
      if (ti === me) {
        const slot = pos === 'wr' ? Math.max(0, u.wrs.findIndex(w => w.who?.isUser)) : 0
        userGames.push({ x, line: decorate(pos, lineFor(pos, box, slot)) })
      }
    }
  }
  // every team's games, from the results the season stored (week order: one game a week a team)
  const perTeam = L.teams.map(() => [])
  for (const g of L.schedule.sorted) {
    const st = R.res.get(`g${g.id}`)
    if (!st) continue
    const { i, j, res } = st
    perTeam[i].push({ key: `g${g.id}`, oi: j, oppD: j >= 0 ? R.T[j].sd : FCS_BY[g.b].d, my: res.a, op: res.b })
    if (j >= 0) perTeam[j].push({ key: `g${g.id}`, oi: i, oppD: R.T[i].sd, my: res.b, op: res.a })
  }
  // the title games count for the award races (voted on after them)
  for (const c of R.standings) {
    const st = c.title && R.res.get(`ccg|${c.id}`)
    if (!st) continue
    const { i, j, res } = st
    perTeam[i].push({ key: `ccg|${c.id}`, oi: j, oppD: R.T[j].sd, my: res.a, op: res.b })
    perTeam[j].push({ key: `ccg|${c.id}`, oi: i, oppD: R.T[i].sd, my: res.b, op: res.a })
  }
  // the defenses each team saw (points a game, + = tougher): the draft board weighs a line by its schedule
  R.oppDef = perTeam.map(list => (list.length ? list.reduce((a, x) => a + x.oppD, 0) / list.length : 0))
  // (lite: only the build's team, no award races; the director's many re-runs only need the record)
  // the award races are the build's conference (all-conference), the country's best players by grade and the
  // committee's top 25 (team success): only their teams need box scores
  const boxTeams = new Set([me])
  if (!lite) {
    for (const t of L.byShort[user.team] ? L.confs.find(c => c.id === L.byShort[user.team].confId)?.teams ?? [] : []) boxTeams.add(t.idx)
    for (const i of L.awardTeams) boxTeams.add(i)
    for (const i of [...R.final.rank.entries()].filter(([, k]) => k <= 25).map(([i]) => i)) boxTeams.add(i)
  }
  for (let ti = 0; ti < L.teams.length; ti++) if (boxTeams.has(ti)) runTeamGames(ti, perTeam[ti])
  const awardLines = new Map([...cands.values()].map(c => [c.key, c]))
  // award candidates: totals through the title games (the Heisman is voted on before the bowls)
  const candList = [...awardLines.values()].map(c => ({ ...c, t: cfbSeasonTotals(c.pos, c.games) }))

  // the build's postseason after the title game
  const userAwardCount = userGames.length
  for (const x of [...R.myCFP, ...(R.myBowl ? [R.myBowl] : [])]) runTeamGames(me, [{ key: `post|${x.bowl ?? x.round}`, oi: x.oi, oppD: R.T[x.oi].sd, my: x.my, op: x.op, post: x }])

  // ── the build's games in football's shape ──
  const regLines = userGames.slice(0, R.myGames.length)
  let games = R.myGames.map((m, k) => {
    const ln = keepLines && script.games?.[k] ? pickLine(pos, script.games[k]) : regLines[k]?.line ?? {}
    return {
      wk: k + 1, opponent: m.opp.name, oppShort: m.fcs ? m.opp.short.replace('fcs:', '') : m.opp.short, home: m.home, neutral: m.neutral, confGame: !!m.confGame, fcs: m.fcs,
      won: m.my.pts > m.op.pts, mySc: m.my.pts, oppSc: m.op.pts, ot: m.ot,
      ...ln,
      meta: { week: m.week, label: `Week ${m.week}`, date: dateOf(m.week), myRank: m.myRank, oppRank: m.oppRank, oppRec: m.oppRec, oppConf: m.fcs ? 'FCS' : m.opp.confShort },
    }
  })
  const postGame = (x, ln, extra = {}) => ({
    opponent: x.opp.name, oppShort: x.opp.short, home: !!x.home, neutral: !x.home, won: x.my.pts > x.op.pts, mySc: x.my.pts, oppSc: x.op.pts, ot: x.ot, overtime: x.ot > 0,
    ...ln, ...extra,
  })
  const postLines = userGames.slice(R.myGames.length).map(u => u.line)
  const postseason = []
  let pi = 0
  let confChampionship = null
  if (R.myCCG) {
    confChampionship = postGame(R.myCCG, postLines[pi++], { round: 'Conference Championship', title: R.myCCG.title, label: R.myCCG.title, date: CCG_DATE, site: 'Neutral site' })
    postseason.push(confChampionship)
  }
  const playoffRounds = R.myCFP.map(x => postGame(x, postLines[pi++], {
    round: x.round, bowl: x.bowl, site: x.site, date: x.date, mySeed: x.mySeed, oppSeed: x.oppSeed,
    label: x.round === 'National Championship' ? 'CFP National Championship' : x.bowl ? `CFP ${x.round} · ${x.bowl}` : `CFP ${x.round}`,
  }))
  postseason.push(...playoffRounds)
  let bowl = null
  if (R.myBowl) { bowl = postGame(R.myBowl, postLines[pi++], { round: 'Bowl', bowl: R.myBowl.bowl, site: R.myBowl.site, date: R.myBowl.date, label: R.myBowl.bowl }); postseason.push(bowl) }

  const wins = games.filter(g => g.won).length, losses = games.length - wins
  const reg = cfbSeasonTotals(pos, games)
  const throughCCG = cfbSeasonTotals(pos, [...games, ...(confChampionship ? [confChampionship] : [])])
  const full = cfbSeasonTotals(pos, [...games, ...postseason])
  // (the build's award line is his games as played: the director's, when it passed them)
  const meCand = candList.find(c => c.isUser)
  if (meCand) { meCand.t = throughCCG; meCand.line = lineText(pos, throughCCG) }
  const awards = lite ? LITE_AWARDS : runAwards(L, R, candList, seeded(`${seed}|awards`), user)
  // the regular season's FBS leaders at his position: every team's starters (the teams the award races skipped get
  // their box scores here, for this list only: each box has its own seeded draw, so nothing above changes). His
  // line is his games as played
  const LEAD = { qb: ['seasonPassYds', 'PASS YDS'], rb: ['seasonRushYds', 'RUSH YDS'], wr: ['seasonRecYds', 'REC YDS'] }
  let leaders = null
  if (!lite) {
    const [lk, label] = LEAD[pos]
    const rest = new Map()
    for (let ti = 0; ti < L.teams.length; ti++) {
      if (boxTeams.has(ti)) continue
      const u = units[ti]
      const whos = pos === 'qb' ? [u.qb] : pos === 'rb' ? [u.rb] : u.wrs
      if (!whos.some(w => w?.who)) continue
      for (const x of perTeam[ti]) {
        if (!/^g/.test(x.key)) continue
        const box = boxOf(ti, x.key, x.my, x.op, x.oi, x.oppD)
        whos.forEach((w, k) => {
          if (!w?.who) return
          const c = rest.get(w.who.key) ?? { name: w.who.name, team: L.teams[ti].short, year: w.who.year, pos, isUser: false, reg: [] }
          c.reg.push(lineFor(pos, box, k))
          rest.set(w.who.key, c)
        })
      }
    }
    const rows = [...cands.values(), ...rest.values()].filter(c => c.pos === pos && (c.isUser || c.reg.length >= 6))
      .map(c => ({ name: c.name, team: c.team, year: c.year ?? null, isUser: !!c.isUser, value: c.isUser ? (reg[lk] ?? 0) : (cfbSeasonTotals(pos, c.reg)[lk] ?? 0) }))
      .sort((a, b) => b.value - a.value || (a.isUser ? -1 : 1))
    const at = rows.findIndex(x => x.isUser)
    leaders = { key: lk, label, rows: rows.slice(0, 10), rank: at >= 0 ? at + 1 : null, of: rows.length }
  }
  const draft = draftStock(pos, ovr, throughCCG, awards, user.year, lite ? null : draftBoard(L, R, pos, candList, awards, opts?.career ?? null), opts?.career ?? null, user.noClass)

  const madeCFP = R.field.has(me)
  const mySeed = madeCFP ? R.seedOf.get(me) : null
  const champion = R.natChamp === me
  let sbResult = null
  if (madeCFP) {
    const last = playoffRounds[playoffRounds.length - 1]
    sbResult = champion ? { won: true, ...pickLine(pos, last) } : { won: false, round: last?.round ?? 'First Round', pwins: playoffRounds.filter(g => g.won).length }
  }
  const BEST = { qb: g => g.passYds * 0.15 + g.tds * 12 + (g.ints === 0 ? 4 : 0) + (g.rating ?? 0) * 0.1 + Math.max(0, g.rushYds) * 0.1, rb: g => g.rushYds * 0.14 + (g.rushTDs + g.recTDs) * 15 + g.recYds * 0.08 - g.fumbles * 8, wr: g => g.recYds * 0.16 + g.recTDs * 14 + g.rec * 1.5 }
  const bestGame = [...games].sort((a, b) => BEST[pos](b) - BEST[pos](a))[0]
  const arch = pos === 'qb' ? getArchetype(ovr, build, types) : pos === 'rb' ? getArchetypeRB(ovr, build, types) : getArchetypeWR(ovr, build, types)
  const conf = { id: base.confId, short: base.confShort, name: base.confName }
  const standings = R.standings.map(st => ({
    id: st.id, short: st.short, name: st.name, champion: st.champion, title: st.title,
    teams: st.ids.map(i => ({
      short: L.teams[i].short, confW: R.S.cw[i], confL: R.S.cl[i],
      w: R.recReg.w[i], l: R.recReg.l[i],                                    // regular season (12 games)
      selection: `${R.recCCG.w[i]}-${R.recCCG.l[i]}`,                        // with the title game: the record on Selection Day
      final: `${R.recFinal.w[i]}-${R.recFinal.l[i]}`, finalW: R.recFinal.w[i], finalL: R.recFinal.l[i],   // with the bowl / CFP
      ap: R.polls[R.polls.length - 1].rank.get(i) ?? null, cfp: R.final.rank.get(i) ?? null,
    })),
  }))
  const myStanding = standings.find(s => s.id === base.confId)
  const apPath = R.polls.map(p => ({ label: p.label, rank: p.rank.get(me) ?? null, rec: p.top25.find(x => x.short === base.short)?.rec ?? null }))

  const out = {
    sport: 'cfb', position: pos, gameMode, seed, leagueSeed,
    team: { ...base, ...(typeof team === 'object' && team ? { off: team.off ?? base.off, def: team.def ?? base.def } : {}) },
    ovr, archetype: arch, wins, losses,
    games,
    highlights: games,
    bestGame,
    ...reg,
    playoffs: madeCFP, playoffRounds, sbResult, hasBye: madeCFP && mySeed <= 4, champion,
    award: { userWins: awards.heisman.userWon, name: 'Heisman Trophy' },
    cfb: {
      record: { w: wins, l: losses, confW: R.S.cw[me], confL: R.S.cl[me], selection: `${R.recCCG.w[me]}-${R.recCCG.l[me]}`, final: `${R.recFinal.w[me]}-${R.recFinal.l[me]}` },
      conf, postseason, confChampionship, confChamp: R.champs.has(me), bowl, cfpSeed: mySeed,
      totals: { regular: reg, throughCCG, full },
      ap: R.polls.map(p => ({ ...publicPoll(p), myRank: p.rank.get(me) ?? null })),
      cfpRankings: R.cfps.map(p => ({ ...publicPoll(p), myRank: p.rank.get(me) ?? null })),
      apPath,
      standings, myStanding: myStanding ?? null,
      playoff: {
        field: R.seeds.map((i, k) => ({ seed: k + 1, short: L.teams[i].short, name: L.teams[i].name, conf: L.teams[i].confShort, rec: `${R.recCCG.w[i]}-${R.recCCG.l[i]}`, final: `${R.recFinal.w[i]}-${R.recFinal.l[i]}`, cfpRank: R.final.rank.get(i), ...R.field.get(i) })),
        games: R.cfpGames, champion: L.teams[R.natChamp].short, runnerUp: L.teams[R.runnerUp].short,
      },
      bowls: R.bowls,
      awards,
      leaders,
      draft,
      user: { name: user.name, year: user.year, noClass: user.noClass, replaced: L.depth[base.short]?.[pos]?.[0]?.name ?? null, teamShift: Math.round(user.shift * 10) / 10,
        attrs: Object.fromEntries(types.map(t => [t, build?.[t]?.val ?? null])), types },
      awardGames: userAwardCount,
    },
  }
  if (opts?.debug) { Object.defineProperty(out, '_R', { value: R, enumerable: false }); Object.defineProperty(out, '_cands', { value: candList, enumerable: false }) }
  return out
}
const pickLine = (pos, g) => Object.fromEntries([...LINE_KEYS[pos], ...(pos === 'qb' ? ['rating', 'eff'] : pos === 'rb' ? ['ypc', 'long'] : ['long'])].filter(k => g?.[k] != null).map(k => [k, g[k]]))

// ── scriptCFBSeason: football's scriptNFLSeason, the college way ─────────────
// One season for a team, decided once from its strength (team.off/def, the data's units, moved however the
// caller likes): the schedule, every score, the title game, the CFP or the bowl. Any build's sim then plays
// this same season (runCFBSimulation's `script`) and makes only its own line, so a squad shares one record.
export function scriptCFBSeason(team, seed = null, leagueSeed = null) {
  const L = cfbLeague()
  const base = (typeof team === 'string' ? L.byShort[team] : L.byShort[team?.short]) ?? L.teams[0]
  const s = String(seed ?? Math.floor(Math.random() * 1e9).toString(36))
  const ls = String(leagueSeed ?? s)
  const teamAdj = typeof team === 'object' && team ? {
    o: typeof team.off === 'number' && typeof base.off === 'number' ? ((team.off - base.off) / L.scale.offSD) * PTS_PER_Z : 0,
    d: typeof team.def === 'number' && typeof base.def === 'number' ? (L.scale.flip * (team.def - base.def) / L.scale.defSD) * PTS_PER_Z : 0,
  } : null
  const user = { pos: 'qb', team: base.short, name: 'Team', ovr: 0, rates: null, shift: 0, year: 'JR' }
  const R = simulateSeason(L, { seed: s, leagueSeed: ls, user, teamAdj, forced: null })
  const schedule = R.myGames.map(m => ({ opponent: m.opp.name, oppShort: m.opp.short, home: m.home, neutral: m.neutral, week: m.week }))
  const games = R.myGames.map((m, k) => ({ wk: k + 1, opponent: m.opp.name, home: m.home, won: m.my.pts > m.op.pts, mySc: m.my.pts, oppSc: m.op.pts, ot: m.ot }))
  const post = [...(R.myCCG ? [R.myCCG] : []), ...R.myCFP, ...(R.myBowl ? [R.myBowl] : [])]
  const postseason = post.map(x => ({ round: x.round ?? 'Conference Championship', bowl: x.bowl ?? null, opponent: x.opp.name, won: x.my.pts > x.op.pts, mySc: x.my.pts, oppSc: x.op.pts, ot: x.ot }))
  const wins = games.filter(g => g.won).length
  const rounds = R.myCFP.map(x => ({ round: x.round, bowl: x.bowl, opponent: x.opp.name, home: !!x.home, won: x.my.pts > x.op.pts, mySc: x.my.pts, oppSc: x.op.pts, overtime: x.ot > 0 }))
  return {
    seed: s, leagueSeed: ls, team: base.short, schedule, games, wins, losses: games.length - wins,
    playoffs: R.field.has(R.me), hasBye: R.field.has(R.me) && R.seedOf.get(R.me) <= 4, rounds, postseason,
    champion: R.natChamp === R.me, confChamp: R.champs.has(R.me),
  }
}

// ── finalizeCFBSeason: the season director's games, as played, back through the whole college season ─
// (lib/seasonDirector's onFinal: the rankings, the title game, the CFP, the awards and the draft line follow
// the games the player actually saw; the build's lines stay exactly as they were)
export function finalizeCFBSeason(result, games = result?.games, build = null, types = null) {
  if (!result || !games?.length) return result
  const u = result.cfb?.user
  const tl = types ?? u?.types ?? CFB_TYPES_BY_POS[result.position]
  const b = build ?? Object.fromEntries(tl.filter(t => u?.attrs?.[t] != null).map(t => [t, { type: t, val: u.attrs[t] }]))
  const script = { games, keepLines: true }
  const next = runCFBSimulation(b, tl, result.team, result.position, result.seed, result.gameMode, script, { leagueSeed: result.leagueSeed, year: u?.year ?? result.cfb?.draft?.year, name: u?.name, noClass: !!u?.noClass })
  // the build's OVR and archetype come from the build the director started with
  return { ...result, ...next, ovr: result.ovr ?? next.ovr, archetype: result.archetype ?? next.archetype, games: next.games.map((g, k) => ({ ...games[k], ...g, ...pickLine(result.position, games[k]) })), story: result.story }
}
