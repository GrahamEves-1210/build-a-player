// Career analytics: the numbers behind a season, each measured against the real league.
//
// The sim isn't play by play, so only what its numbers can honestly give is here. No EPA,
// DVOA, WAR, Win Shares, QBR, TS% or BPM: those need data it doesn't have, and a fake
// one would teach the wrong thing. No "consistency" either (game-to-game swing is the sim's
// dice, and in real football it's mostly small samples). Basketball's PER is the real formula, with the
// inputs the sim doesn't have estimated, so it's labelled so.
//
// Order is importance: the first three show on the season screen, the rest a tap deeper.
// avg / elite are real numbers (NFL 2025: StatMuse; NBA 2025-26: Basketball-Reference), except
// the middles sources didn't give, which are estimates: RB and DB avgs, WR and TE avgs, guard FG and big FG elites,
// AST/TOV elites (the sim's turnovers run low) and stocks.
// A stat with no avg gets no rating: corners with few tackles are often the good ones, a TD
// rate swings on a handful of plays, and the rest are counts to read rather than grade.

const f1 = v => v.toFixed(1)
const f2 = v => v.toFixed(2)
const pct = v => `${v.toFixed(1)}%`
const int = v => Math.round(v).toLocaleString()

const perGame = (n, s) => n / Math.max(1, s.adv.gp)
// (half PPR's cousin: receptions count a full point; fumbles lost isn't in the data, so it's left out)
const fantasy = (s, yds, tds, recs) => (yds * 0.1 + tds * 6 + recs) / Math.max(1, s.adv.gp)

const catcher = (avgTgt, eliteTgt, avgYds, eliteYds, avgCatch, eliteCatch, avgYpt, eliteYpt) => [
  { key: 'tgtG', label: 'TARGETS / GAME', get: s => perGame(s.adv.targets, s), fmt: f1, avg: avgTgt, elite: eliteTgt, says: 'How often the QB looks for him. The stat that carries over best from one year to the next.' },
  { key: 'ydsG', label: 'YARDS / GAME', get: s => perGame(s.stats.recYds, s), fmt: f1, avg: avgYds, elite: eliteYds, says: 'What he actually produces every week.' },
  { key: 'ypt', label: 'YARDS / TARGET', get: s => s.stats.recYds / Math.max(1, s.adv.targets), fmt: f1, avg: avgYpt, elite: eliteYpt, says: 'Yards every time the ball comes his way, caught or not. Shows how well he uses his chances.' },
  { key: 'catch', label: 'CATCH RATE', get: s => (s.stats.recs / Math.max(1, s.adv.targets)) * 100, fmt: pct, avg: avgCatch, elite: eliteCatch, says: 'Share of targets he catches. Deep threats run lower because those throws are harder.' },
  { key: 'drops', label: 'DROPS', get: s => s.adv.drops, fmt: int, says: 'Catchable balls he put on the ground. The surest hands drop one or two a year.' },
  { key: 'dropRate', label: 'DROP RATE', get: s => (s.adv.drops == null ? null : (s.adv.drops / Math.max(1, s.adv.targets)) * 100), fmt: pct, avg: 3.5, elite: 1.5, low: true, says: 'Share of targets he dropped. Lower is better: the league drops about 1 in 30.' },
  { key: 'fp', label: 'FANTASY PTS / GAME', get: s => fantasy(s, s.stats.recYds, s.stats.tds, s.stats.recs), fmt: f1, says: 'One all-round score: a point per reception, a point per 10 yards, 6 per TD.' },
  { key: 'tdRate', label: 'TD RATE', get: s => (s.stats.tds / Math.max(1, s.adv.targets)) * 100, fmt: pct, says: 'Share of targets that score. It jumps around a lot from year to year.' },
  { key: 'hundred', label: '100-YARD GAMES', get: s => s.adv.hundreds, fmt: int, says: 'Games with 100 or more receiving yards.' },
  { key: 'long', label: 'LONGEST CATCH', get: s => s.adv.long, fmt: int, says: 'His longest catch of the season, in yards.' },
]

// the real formula on the sim's box score; fouls, minutes, offensive boards and the shot mix are estimates (utils/bucketSimulation.js)
const PER = { key: 'per', label: 'PER (EST.)', get: s => s.adv.per, fmt: f1, avg: 15, elite: 27, says: 'Player Efficiency Rating: one number for everything in the box score. League average is always 15. It loves scoring and undersells defense.' }

// A lineman's averages and his elite marks by spot: a starting edge about 7 sacks and an elite one 13,
// a starting tackle about 3 and an elite one 8. Sacks swing from year to year, hits on the quarterback hold up
// better, and the tackles a line makes depend on how the run comes at it (official counts, 2024-25: StatMuse;
// the starters' averages are estimates).
const line = (sacks, hits, tfl) => [
  { key: 'sacks', label: 'SACKS', get: s => s.stats.sacks, fmt: int, avg: sacks[0], elite: sacks[1], says: 'The stat a pass rusher gets paid for. It swings a lot from year to year.' },
  { key: 'hits', label: 'QB HITS', get: s => s.stats.qbHits, fmt: int, avg: hits[0], elite: hits[1], says: 'Every time he put the quarterback on the ground, sacks included. It holds up better from year to year than sacks do.' },
  { key: 'tfl', label: 'TACKLES FOR LOSS', get: s => s.stats.tfl, fmt: int, avg: tfl[0], elite: tfl[1], says: 'Plays stopped behind the line, run or pass. The best read on how much of the backfield he lives in.' },
  { key: 'hitRate', label: 'HITS / GAME', get: s => perGame(s.stats.qbHits, s), fmt: f1, says: 'How often he gets home in a game, for a season cut short by injury.' },
  { key: 'multi', label: 'MULTI-SACK GAMES', get: s => s.adv.multi ?? 0, fmt: int, says: 'Games with two sacks or more.' },
  { key: 'tackles', label: 'TACKLES', get: s => s.stats.tackles, fmt: int, says: 'Not a grade: how many come his way depends on the scheme and how teams run at him.' },
  { key: 'ff', label: 'FORCED FUMBLES', get: s => s.stats.ff ?? 0, fmt: int, says: 'Times he knocked the ball loose, mostly strips on the quarterback.' },
  { key: 'fr', label: 'FUMBLE RECOVERIES', get: s => s.stats.fr ?? 0, fmt: int, says: 'Loose balls he fell on. Mostly luck and hustle.' },
  { key: 'pd', label: 'PASSES BATTED', get: s => s.stats.pbus ?? 0, fmt: int, says: 'Throws he got a hand on at the line. A tall man\'s stat.' },
  { key: 'safeties', label: 'SAFETIES', get: s => s.stats.safeties ?? 0, fmt: int, says: 'Two points and the ball back. Most careers have one at most.' },
]
const DL_DEFS = { edge: line([7, 13], [14, 27], [9, 17]), dt: line([3, 8], [9, 20], [6, 13]) }

const DEFS = {
  qb: [
    { key: 'rating', label: 'PASSER RATING', get: s => s.stats.rating, fmt: f1, avg: 91.4, elite: 105, says: 'The classic grade of completions, yards, TDs and picks. It ignores sacks.' },
    { key: 'sackPct', label: 'SACK RATE', get: s => (s.adv.sacks / Math.max(1, s.adv.att + s.adv.sacks)) * 100, fmt: pct, avg: 6.9, elite: 5.2, low: true, says: 'How often he goes down before he can throw. Lower is better, and his line shares the blame.' },
    { key: 'ya', label: 'YARDS / ATTEMPT', get: s => s.stats.passYds / Math.max(1, s.adv.att), fmt: f2, avg: 7.02, elite: 8.4, says: 'Yards every time he throws it.' },
    { key: 'cmp', label: 'COMPLETION %', get: s => s.stats.compPct, fmt: pct, avg: 64.3, elite: 70, says: 'Share of his throws that get caught. Short passes can pad it.' },
    { key: 'tdPct', label: 'TD RATE', get: s => (s.stats.tds / Math.max(1, s.adv.att)) * 100, fmt: pct, avg: 4.65, elite: 6.3, says: 'Share of his throws that score.' },
    { key: 'intPct', label: 'INT RATE', get: s => (s.stats.ints / Math.max(1, s.adv.att)) * 100, fmt: pct, avg: 2.18, elite: 1.4, low: true, says: 'Share of his throws that get picked. Lower is better, and it jumps around year to year.' },
  ],
  rb: [
    { key: 'scrimG', label: 'SCRIMMAGE YDS / GAME', get: s => perGame(s.stats.rushYds + s.stats.recYds, s), fmt: f1, avg: 60, elite: 100, says: 'All his yards, running and catching.' },
    { key: 'touchG', label: 'TOUCHES / GAME', get: s => perGame(s.adv.carries + s.adv.recs, s), fmt: f1, avg: 12, elite: 18, says: 'How much the team trusts him with the ball.' },
    { key: 'ypTouch', label: 'YARDS / TOUCH', get: s => (s.stats.rushYds + s.stats.recYds) / Math.max(1, s.adv.carries + s.adv.recs), fmt: f1, avg: 4.8, elite: 5.8, says: 'Yards each time he has the ball.' },
    { key: 'recG', label: 'CATCHES / GAME', get: s => perGame(s.adv.recs, s), fmt: f1, avg: 2, elite: 4.6, says: 'How much he is used as a receiver. For backs, this carries over better than anything from year to year.' },
    { key: 'ypc', label: 'YARDS / CARRY', get: s => s.stats.ypc, fmt: f1, avg: 4.4, elite: 5, says: 'The famous one, but one or two long runs swing it and it barely repeats from year to year.' },
    { key: 'fp', label: 'FANTASY PTS / GAME', get: s => fantasy(s, s.stats.rushYds + s.stats.recYds, s.stats.tds, s.adv.recs), fmt: f1, avg: 11, elite: 20, says: 'One all-round score: a point per reception, a point per 10 yards, 6 per TD.' },
    { key: 'hundred', label: '100-YARD GAMES', get: s => s.adv.hundreds, fmt: int, says: 'Games with 100 or more rushing yards.' },
    { key: 'long', label: 'LONGEST RUN', get: s => s.adv.long, fmt: int, says: 'His longest run of the season, in yards.' },
  ],
  // (judged: the league's averages count everyone, so starters' numbers here are estimates; leaders from 2025)
  wr: catcher(6, 8.2, 50, 80, 65, 73, 8.2, 10),
  te: catcher(4.5, 7.5, 35, 60, 70, 78, 7.5, 9),
  // (a starting linebacker about 100 tackles and an elite one 150; estimates)
  lb: [
    { key: 'tackles', label: 'TACKLES', get: s => s.stats.tackles, fmt: int, avg: 100, elite: 150, says: 'The linebacker stat. Range and a sure tackle make it; so does a defense that lets the run get to him.' },
    { key: 'tfl', label: 'TACKLES FOR LOSS', get: s => s.stats.tfl ?? 0, fmt: int, avg: 6, elite: 13, says: 'Plays stopped behind the line. Shedding blocks and a quick read.' },
    { key: 'pd', label: 'PASSES DEFENDED', get: s => s.stats.pds ?? 0, fmt: int, avg: 4, elite: 9, says: 'Throws he got a hand on in coverage.' },
    { key: 'sacks', label: 'SACKS', get: s => s.stats.sacks ?? 0, fmt: int, avg: 2, elite: 5, says: 'How often he gets home when they send him.' },
    { key: 'ints', label: 'INTERCEPTIONS', get: s => s.stats.ints ?? 0, fmt: int, says: 'Rare for a linebacker. Two in a year is a good one.' },
    { key: 'tklG', label: 'TACKLES / GAME', get: s => perGame(s.stats.tackles, s), fmt: f1, says: 'Tackles a game, for a season cut short.' },
    { key: 'big', label: '10-TACKLE GAMES', get: s => s.adv.big ?? 0, fmt: int, says: 'Games with ten tackles or more.' },
    { key: 'ff', label: 'FORCED FUMBLES', get: s => s.stats.ff ?? 0, fmt: int, says: 'Times he knocked the ball loose.' },
  ],
  // An offensive lineman, graded the way the charting services do it (PFF-style grades; pressure rate
  // over his pass sets, about 58% of his snaps). A starting tackle allows about 5 sacks and 35 pressures
  // with 6-9 flags; an elite one 0-2 sacks, 10-20 pressures, 1-4 flags (estimates from PFF and PFR, 2024).
  // A kicker, against the league's last few years (NFL.com season tables): about 85% of field goals and two in three
  // from 50 and out for a starter, 93% and ten long ones for the best.
  k: [
    { key: 'fgPct', label: 'FIELD GOAL %', get: s => (s.stats.fga ? s.stats.fgPct : null), fmt: pct, avg: 85, elite: 93, says: 'Field goals made out of field goals tried. The league makes about 85 in 100.' },
    { key: 'm50', label: 'MADE FROM 50+', get: s => s.stats.m50, fmt: int, avg: 5, elite: 10, says: 'Field goals from 50 yards and out. The leg decides how often the coach sends him.' },
    { key: 'long', label: 'LONGEST', get: s => s.stats.long || null, fmt: int, avg: 56, elite: 62, says: 'His longest make of the year. The record is 68.' },
    { key: 'xpPct', label: 'EXTRA POINT %', get: s => (s.stats.xpa ? (s.stats.xpm / s.stats.xpa) * 100 : null), fmt: pct, avg: 95.5, elite: 99, says: 'A 33-yard kick after every touchdown. Missing one is how a game gets lost by a point.' },
    { key: 'points', label: 'POINTS', get: s => s.stats.points, fmt: int, avg: 120, elite: 150, says: 'Three for a field goal, one for an extra point. A kicker leads his team in scoring most years.' },
    { key: 'gw', label: 'GAME-WINNERS', get: s => s.stats.gw, fmt: int, avg: 1, elite: 4, says: 'Kicks at the end of regulation or in overtime that won the game.' },
  ],
  ol: [
    { key: 'grade', label: 'OVERALL GRADE', get: s => s.stats.grade, fmt: f1, avg: 65, elite: 89, says: 'One grade for every snap, PFF style: pass blocking about 60%, run blocking 40%, less for the flags.' },
    { key: 'sacksA', label: 'SACKS ALLOWED', get: s => s.stats.sacksA, fmt: int, avg: 5, elite: 1, low: true, says: 'The one everyone sees. Lower is better, and some of them belong to the quarterback.' },
    { key: 'prsRate', label: 'PRESSURE RATE', get: s => (s.stats.snaps ? (s.stats.prs / (s.stats.snaps * 0.58)) * 100 : null), fmt: pct, avg: 5.5, elite: 2.5, low: true, says: 'How often his man got to the quarterback on a pass play: sacks, hits and hurries. The best read on pass blocking.' },
    { key: 'pen', label: 'PENALTIES', get: s => s.stats.pen, fmt: int, avg: 7, elite: 3, low: true, says: 'Holding, false starts and the rest. Every one costs a drive yards.' },
    { key: 'pancakes', label: 'PANCAKES', get: s => s.stats.pancakes, fmt: int, avg: 30, elite: 50, says: 'Blocks that put his man on the ground. Nobody keeps an official count; these are charted.' },
    { key: 'passGrade', label: 'PASS BLOCK GRADE', get: s => s.stats.passGrade, fmt: f1, says: 'Pass protection alone: the pressures he gave up, and the sacks most of all.' },
    { key: 'runGrade', label: 'RUN BLOCK GRADE', get: s => s.stats.runGrade, fmt: f1, says: 'Run blocking alone: how often he won his block, and how many he finished.' },
    { key: 'clean', label: 'CLEAN GAMES', get: s => s.adv.clean ?? 0, fmt: int, says: 'Games with no sacks and at most one pressure allowed.' },
    { key: 'hitsA', label: 'QB HITS ALLOWED', get: s => s.stats.hitsA ?? 0, fmt: int, says: 'Times his man hit the quarterback without the sack.' },
    { key: 'starts', label: 'STARTS', get: s => s.stats.starts ?? 0, fmt: int, says: 'Games he started. A lineman\'s career is counted in them.' },
  ],
  db: [
    { key: 'pd', label: 'PASSES DEFENDED', get: s => s.stats.pbus, fmt: int, avg: 8, elite: 15, says: 'Throws he got a hand on. The best sign of good coverage in a box score.' },
    { key: 'ints', label: 'INTERCEPTIONS', get: s => s.stats.ints, fmt: int, avg: 2, elite: 5, says: 'Throws he caught. Fun, but it swings a lot from year to year.' },
    { key: 'tackles', label: 'TACKLES', get: s => s.stats.tackles, fmt: int, says: `Not a grade: the best corners get fewer because QBs stop throwing at them. For safeties, more is better.` },
    { key: 'tfl', label: 'TACKLES FOR LOSS', get: s => s.stats.tfl ?? 0, fmt: int, says: 'Tackles behind the line of scrimmage.' },
    { key: 'ff', label: 'FORCED FUMBLES', get: s => s.stats.ff ?? 0, fmt: int, says: 'Times he knocked the ball loose.' },
    { key: 'pick6', label: 'PICK-SIXES', get: s => s.stats.pickSixes ?? 0, fmt: int, says: 'Interceptions he ran back for a TD. The record is 4.' },
  ],
  guard: [
    PER,
    { key: 'three', label: '3-POINT %', get: s => s.adv.threePct, fmt: pct, avg: 36, elite: 40, says: 'Share of his threes that go in.' },
    { key: 'fg', label: 'FIELD GOAL %', get: s => s.adv.fgPct, fmt: pct, avg: 47.1, elite: 52, says: 'Share of all his shots that go in. Guards take harder shots than bigs, so a lower number can still be fine.' },
    { key: 'astTov', label: 'ASSISTS / TURNOVER', get: s => s.stats.apg / Math.max(0.1, s.adv.tov), fmt: f2, avg: 1.84, elite: 5, says: 'How many baskets he sets up for every time he loses the ball.' },
    { key: 'ft', label: 'FREE THROW %', get: s => s.adv.ftPct, fmt: pct, avg: 78.3, elite: 90, says: 'Share of his free throws that go in.' },
    { key: 'stocks', label: 'STOCKS / GAME', get: s => (s.stats.spg ?? 0) + (s.stats.bpg ?? 0), fmt: f1, avg: 1.5, elite: 3, says: 'Steals plus blocks. It misses most of what good defense is.' },
    { key: 'tov', label: 'TURNOVERS / GAME', get: s => s.adv.tov, fmt: f1, says: 'Times a night he loses the ball. Players who handle it most have the most.' },
    { key: 'dd', label: 'DOUBLE-DOUBLES', get: s => s.adv.dd, fmt: int, says: 'Games with 10 or more in two of points, rebounds and assists.' },
    { key: 'td', label: 'TRIPLE-DOUBLES', get: s => s.adv.td, fmt: int, says: 'Games with 10 or more in points, rebounds and assists. Jokic had 34 in 2025-26.' },
    { key: 'g40', label: '40-POINT GAMES', get: s => s.adv.g40, fmt: int, says: 'Nights he scored 40 or more.' },
  ],
  big: [
    PER,
    { key: 'fg', label: 'FIELD GOAL %', get: s => s.adv.fgPct, fmt: pct, avg: 47.1, elite: 60, says: 'Share of all his shots that go in. Bigs shoot closer to the rim, so they should beat the league average.' },
    { key: 'stocks', label: 'STOCKS / GAME', get: s => (s.stats.spg ?? 0) + (s.stats.bpg ?? 0), fmt: f1, avg: 2, elite: 4, says: 'Steals plus blocks. It misses most of what good defense is.' },
    { key: 'dd', label: 'DOUBLE-DOUBLES', get: s => s.adv.dd, fmt: int, says: 'Games with 10 or more in two of points, rebounds and assists.' },
    { key: 'three', label: '3-POINT %', get: s => s.adv.threePct, fmt: pct, avg: 36, elite: 40, says: 'Share of his threes that go in.' },
    { key: 'ft', label: 'FREE THROW %', get: s => s.adv.ftPct, fmt: pct, avg: 78.3, elite: 90, says: 'Share of his free throws that go in.' },
    { key: 'astTov', label: 'ASSISTS / TURNOVER', get: s => s.stats.apg / Math.max(0.1, s.adv.tov), fmt: f2, avg: 1.84, elite: 4, says: 'How many baskets he sets up for every time he loses the ball.' },
    { key: 'tov', label: 'TURNOVERS / GAME', get: s => s.adv.tov, fmt: f1, says: 'Times a night he loses the ball.' },
    { key: 'td', label: 'TRIPLE-DOUBLES', get: s => s.adv.td, fmt: int, says: 'Games with 10 or more in points, rebounds and assists. Jokic had 34 in 2025-26.' },
    { key: 'g40', label: '40-POINT GAMES', get: s => s.adv.g40, fmt: int, says: 'Nights he scored 40 or more.' },
  ],
}

// a sport that loads on its own brings its analytics (soccer's: lib/soccerStats.js)
export const registerStats = (pos, defs) => { DEFS[pos] = defs }

// The raw numbers a season keeps for these (bookSeason). Older saves don't have them.
export function seasonRaw(pos, f, played) {
  const gp = played.length
  const count = test => played.filter(test).length
  if (pos === 'guard' || pos === 'big') {
    const tens = g => (g.pts >= 10) + (g.reb >= 10) + (g.ast >= 10)
    return { gp, per: f.per, tov: f.tov ?? 0, fgPct: f.fgPct ?? 0, threePct: f.threePct ?? 0, ftPct: f.ftPct ?? 0, dd: count(g => tens(g) >= 2), td: count(g => tens(g) >= 3), g40: count(g => g.pts >= 40) }
  }
  if (pos === 'qb') {
    const total = f.games?.length || gp || 1
    // (the season's attempts are a whole year's: his share, for the games he played)
    return { gp, att: Math.round((f.seasonAttempts ?? 0) * (gp / total)), sacks: f.seasonSacks ?? 0 }
  }
  if (pos === 'rb') return { gp, carries: f.seasonCarries ?? 0, recs: f.seasonRecs ?? 0, long: f.seasonLong ?? 0, hundreds: count(g => g.rushYds >= 100) }
  if (pos === 'wr' || pos === 'te') return { gp, targets: f.seasonTargets ?? 0, long: f.seasonLong ?? 0, hundreds: count(g => g.recYds >= 100), ...(f.seasonDrops != null ? { drops: f.seasonDrops } : {}) }
  if (pos === 'dl') return { gp, multi: count(g => g.sacks >= 2) }
  if (pos === 'lb') return { gp, big: count(g => g.tackles >= 10) }
  if (pos === 'ol') return { gp, clean: count(g => (g.sacks ?? 0) === 0 && (g.pressures ?? 0) <= 1) }
  if (pos === 'st') return { gp, mins: played.reduce((s, g) => s + (g.mins ?? 0), 0) }
  return { gp }
}

// enough of a season to grade it (few games or touches and a rate means nothing)
const enough = (pos, s) => {
  const a = s.adv
  if (pos === 'guard' || pos === 'big') return a.gp >= 20
  if (pos === 'qb') return a.att >= 100
  if (pos === 'rb') return a.carries + a.recs >= 60
  if (pos === 'wr' || pos === 'te') return a.targets >= 30
  if (pos === 'st') return (a.mins ?? 0) >= 900
  return a.gp >= 6
}

export const TIER_WORD = { low: 'BELOW AVERAGE', avg: 'AVERAGE', good: 'GOOD', elite: 'ELITE' }

// Every analytic for one season, most important first ([] for a season from before these existed).
// `mark` is where the value sits on its bar (avg 40, elite 85).
export function seasonAnalytics(pos, s) {
  const defs = pos === 'dl' ? DL_DEFS[s?.spot === 'dt' ? 'dt' : 'edge'] : DEFS[pos]
  if (!s?.adv || !defs) return []
  const graded = enough(pos, s)
  return defs.filter(d => d.get(s) != null).map(d => {
    const value = d.get(s)
    const out = { key: d.key, label: d.label, says: d.says, value, text: d.fmt(value), avg: d.avg, elite: d.elite, low: !!d.low, avgText: d.avg != null ? d.fmt(d.avg) : null, eliteText: d.elite != null ? d.fmt(d.elite) : null, tier: null, mark: null }
    if (d.avg == null || !graded) return out
    const at = (value - d.avg) / (d.elite - d.avg)    // 0 the league average, 1 elite (works both ways round for low-is-better)
    out.tier = at >= 1 ? 'elite' : at >= 0.33 ? 'good' : at >= -0.25 ? 'avg' : 'low'
    out.mark = Math.max(3, Math.min(100, 40 + at * 45))
    return out
  })
}

// this season's best-ever marks across the career, for the stats that have a better direction
export function careerBests(pos, seasons) {
  const best = {}
  for (const s of seasons) for (const a of seasonAnalytics(pos, s)) {
    if (a.avg == null) continue
    if (best[a.key] == null || (a.low ? a.value < best[a.key] : a.value > best[a.key])) best[a.key] = a.value
  }
  return best
}
