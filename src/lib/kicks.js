// The kick model: one set of numbers for the kicker's season sim, his Career and the three kicker mini games,
// so a 55-yarder is the same kick wherever it's tried.
//
// Calibrated to the league's real kicking, regular seasons 2021-2025 (NFL.com: nfl.com/stats/team-stats/special-teams/
// field-goals/<year>/reg/all and .../scoring/<year>/reg/all, and the player table nfl.com/stats/player-stats/category/
// field-goals/<year>/reg/all/kickingfgmade/desc; 160 team-seasons, read 2026-11-11):
//   Field goals a team tries in a season: median 33, a tenth of teams 27 or fewer, a tenth 42 or more, the most 52
//     (2025). By year the median is 32, 32, 33, 34, 34. A team makes 28 in a median year; the most is 48.
//   Made: 85.1% overall (4,556 of 5,352; by year 85.1, 85.0, 85.9, 84.0, 85.6).
//     1-39 yards 95.4% (16.7 tries a team), 40-49 79.8% (9.4), 50 and out 68.6% (7.4 tries, about 5 made; a tenth
//     of teams made 9 or more from 50+, the most 14 in 2024).
//   A starter (20 or more tries): median 86%, a tenth under 75%, a tenth over 93%, the best season 96.7% (2023).
//   Extra points: 38 tried a team, 95.1% made (by year 93.4, 94.6, 95.9, 95.8, 95.9).
//   Points from kicking: median 123 a team, a tenth under 99, a tenth over 144, the most 174 (2025).
//   The most field goals by one kicker in each year: 40, 37, 36, 41, 44.
//   (Game-winning kicks are not in those tables: the sim's 1.5 to 2 a season is left as it was.)
// An average kicker (C+ power and accuracy, B- nerve: the middle of the game's own pool) lands on those: about 85%
// on 33 tries, 5 from 50 and out, 37 of 38 extra points, about 122 points. S across the board is a 94% kicker
// on 35 tries with 7 or 8 from 50+ and about 140 points (his best years 97% and 160), and a C / C kicker is an 80%
// kicker who shouldn't be out there past 50.
// (Until 2026-11-11 the model was a logistic curve: right for an average kicker overall but 5 points high from
// 40-49, and far too kind at the top: S across the board was 96.6% with 98% from 40-49 and 89% from 50+, on 38
// tries, and broke the season scoring record one year in six.)
//
// A kick is { power, accuracy, clutch } on the 0-11 grade scale and a distance in yards (the kick's, not the line of scrimmage).
// env: { yards, pressure } - yards is the conditions in yards of range (a dome +1, Denver's altitude +3, wind -2.5,
// rain -2, snow -4, cold -1.5); pressure 0..1 is how much the game hangs on it (1: the last play, to win or tie).

export const clampK = (x, a, b) => Math.max(a, Math.min(b, x))

// where field goals are tried from: [from, to, share of attempts] (half from inside 40, 28% from 40-49, 22% from 50
// and out: the league's 16.7 / 9.4 / 7.4 a team, before the coach keeps the longest ones in his pocket)
export const KICK_BUCKETS = [[19, 29, 0.21], [30, 39, 0.28], [40, 49, 0.28], [50, 59, 0.19], [60, 66, 0.04]]
export function kickDistance(rand = Math.random) {
  let u = rand(), b = KICK_BUCKETS[KICK_BUCKETS.length - 1]
  for (const x of KICK_BUCKETS) { if (u < x[2]) { b = x; break } u -= x[2] }
  return b[0] + Math.floor(rand() * (b[1] - b[0] + 1))
}

// the longest kick his coach will send him out for on a normal down (F 50, B 58, S 65); past it they punt or go for it
export const kickTry = pw => Math.round(50 + pw * 1.4)
// how far the ball carries with a clean strike, no wind (the mini games' reach: F 54, B 61, S 68)
export const kickReach = pw => 54 + pw * 1.25

// the chance a field goal from d yards is good.
// K_BASE is the league's make rate by distance for an average kicker on a clear day ([yards, rate], straight lines
// between). Power and the conditions move the kick along it (a grade of power is 0.9 yards of range; a dome +1,
// wind -2.5); accuracy scales the misses (an S misses 43% as often as a C+ from inside 40, less of an edge the
// longer the kick: from 55 the leg decides more than the aim); nerve moves both when the game hangs on it.
export const K_BASE = [[18, 0.992], [25, 0.985], [30, 0.965], [35, 0.93], [40, 0.855], [45, 0.775], [50, 0.725], [55, 0.665], [60, 0.5], [65, 0.29], [70, 0.11], [76, 0.02]]
const baseP = d => {
  if (d <= K_BASE[0][0]) return K_BASE[0][1]
  for (let i = 1; i < K_BASE.length; i++) { const [x0, y0] = K_BASE[i - 1], [x1, y1] = K_BASE[i]; if (d <= x1) return y0 + (y1 - y0) * (d - x0) / (x1 - x0) }
  return K_BASE[K_BASE.length - 1][1]
}
export function kickP(d, k, env = {}) {
  const pw = k?.power ?? 5, acc = k?.accuracy ?? 5, clu = k?.clutch ?? 5
  const pr = clampK(env.pressure ?? 0, 0, 1)
  const nerve = pr * (5.5 - clu)                       // a B- is himself under pressure; an S gets better, an F worse
  const range = (pw - 5) * 0.9 + (env.yards ?? 0) - nerve * 0.9
  const aim = clampK(1 - (acc - 5) * 0.095, 0.4, 1.6), far = clampK(1 - (d - 40) / 30, 0.5, 1)
  const miss = (1 - baseP(d - range)) * (1 - (1 - aim) * far) * clampK(1 + nerve * 0.05, 0.7, 1.3)
  return clampK(1 - miss, 0.01, 0.999)
}
// an extra point (a 33-yard kick): 95.1% across the league
export function xpP(k, env = {}) {
  const acc = k?.accuracy ?? 5
  return clampK(0.918 + 0.0065 * acc + Math.min(0, env.yards ?? 0) * 0.004, 0.8, 0.999)
}

// ── Where the game is played ────────────────────────────────────────────────
// Domes and retractable roofs (played closed): no wind, a dry ball. Denver: a mile up, the ball carries.
// Cold-weather open-air homes: wind off the lake and December cold from about Week 11 on.
export const K_DOMES = new Set(['ARI', 'ATL', 'DAL', 'DET', 'HOU', 'IND', 'LV', 'LAR', 'LAC', 'MIN', 'NO'])
export const K_COLD = new Set(['BAL', 'BUF', 'CHI', 'CIN', 'CLE', 'DEN', 'GB', 'KC', 'NE', 'NYG', 'NYJ', 'PHI', 'PIT', 'WAS', 'SEA', 'TEN'])
export const K_WINDY = new Set(['BUF', 'CHI', 'CLE', 'NYG', 'NYJ', 'NE', 'KC', 'GB', 'PIT'])
export const K_ENV = { dome: 1, altitude: 3, wind: -2.5, rain: -2, snow: -4, cold: -1.5 }
export const K_ENV_WORD = { dome: 'indoors', altitude: 'a mile high', wind: 'swirling wind', rain: 'rain', snow: 'snow', cold: 'bitter cold', clear: 'a clear day' }
// the conditions for a game at homeShort in week wk (1-based; playoffs 19+): { tag, yards }
export function kickEnv(homeShort, wk = 1, rand = Math.random) {
  if (K_DOMES.has(homeShort)) return { tag: 'dome', yards: K_ENV.dome }
  const late = wk >= 11, u = rand()
  if (homeShort === 'DEN') return late && u < 0.18 ? { tag: 'snow', yards: K_ENV.snow + K_ENV.altitude } : { tag: 'altitude', yards: K_ENV.altitude }
  if (K_COLD.has(homeShort) && late) {
    if (u < 0.10) return { tag: 'snow', yards: K_ENV.snow }
    if (u < (K_WINDY.has(homeShort) ? 0.42 : 0.26)) return { tag: 'wind', yards: K_ENV.wind }
    if (u < 0.62) return { tag: 'cold', yards: K_ENV.cold }
    return { tag: 'clear', yards: 0 }
  }
  if (u < 0.08) return { tag: 'rain', yards: K_ENV.rain }
  if (u < (K_WINDY.has(homeShort) ? 0.24 : 0.14)) return { tag: 'wind', yards: K_ENV.wind }
  return { tag: 'clear', yards: 0 }
}
// a season's worth of home conditions, as one number: what the stadium does to his range over a year (Career's fit note)
export const homeYards = short => (K_DOMES.has(short) ? 1 : short === 'DEN' ? 2.6 : K_WINDY.has(short) ? -1.1 : K_COLD.has(short) ? -0.6 : -0.3)

// ── The onside kick ─────────────────────────────────────────────────────────
// Recovery rates (see the rules and sources in lib/mg/onside.js): about 6-7% of declared onside kicks are recovered by
// the kicking team since surprise onside kicks were banned (2024), down from about 20% for surprise tries before 2018.
// His accuracy (placing the high hop inside the 10-to-15-yard window) moves it a little; nothing moves it much.
export const onsideP = k => clampK(0.06 + (k?.accuracy ?? 5) * 0.0045 + (k?.clutch ?? 5) * 0.002, 0.055, 0.14)   // (a little up, 2026-11-12, the owner)
// with the ball back and under two minutes: the offense still has to score (a field goal down 1-3, a touchdown down 4-8)
export const afterOnsideP = d => (d <= 3 ? 0.62 : d <= 8 ? 0.38 : 0.12)
// kicking deep instead: with no timeouts the other team kneels three times and it's over. It takes a fumble on the return.
export const kickDeepP = d => (d <= 8 ? 0.004 : 0.001)

// ── A kicker's line ───────────────────────────────────────────────────────────
// how a field goal reads in the log: '3/4 FG (long 52)'
export const kLine = g => `${g.fgm}/${g.fga} FG${g.long ? ` (long ${g.long})` : ''}, ${g.xpm}/${g.xpa} XP`
// range tables from a list of games: under 30, 30-39, 40-49, 50+ as [made, tried]
export function kRanges(games) {
  const out = { u30: [0, 0], r30: [0, 0], r40: [0, 0], r50: [0, 0] }
  for (const g of games ?? []) for (const k of g.kicks ?? []) {
    const b = k.d < 30 ? 'u30' : k.d < 40 ? 'r30' : k.d < 50 ? 'r40' : 'r50'
    out[b][1]++; if (k.good) out[b][0]++
  }
  return out
}
// the season line the games add up to (the director re-adds it after a moment rewrites a game)
export function kTotals(games) {
  const sum = k => games.reduce((s, g) => s + (g[k] ?? 0), 0)
  const fgm = sum('fgm'), fga = sum('fga')
  const ranges = kRanges(games)
  return {
    seasonFGM: fgm, seasonFGA: fga, seasonFGPct: fga ? +(fgm / fga * 100).toFixed(1) : 0,
    seasonLong: Math.max(0, ...games.map(g => g.long ?? 0)),
    seasonXPM: sum('xpm'), seasonXPA: sum('xpa'), seasonPoints: sum('pts'),
    seasonGW: sum('gw'), seasonCostly: sum('cost'), seasonClutchM: sum('cm'), seasonClutchA: sum('ca'),
    season50M: ranges.r50[0], season50A: ranges.r50[1], seasonRanges: ranges,
  }
}
