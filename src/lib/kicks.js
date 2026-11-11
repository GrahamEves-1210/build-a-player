// The kick model: one set of numbers for the kicker's season sim, his Career and the three kicker mini games,
// so a 55-yarder is the same kick wherever it's tried.
//
// Calibrated to the league's 2023-25 field goal rates by distance (NFL.com / Pro-Football-Reference season tables):
//   20-29 about 98%, 30-39 about 93%, 40-49 about 82%, 50-59 about 68%, 60+ about a third; extra points about 95.5%.
// An average kicker (B- / B across the board) lands on those; an S leg with S accuracy is a 93-94% kicker who is
// better than a coin flip from 60, and a D / D kicker is a 75% kicker who shouldn't be out there past 50.
//
// A kick is { power, accuracy, clutch } on the 0-11 grade scale and a distance in yards (the kick's, not the line of scrimmage).
// env: { yards, pressure } - yards is the conditions in yards of range (a dome +1, Denver's altitude +3, wind -2.5,
// rain -2, snow -4, cold -1.5); pressure 0..1 is how much the game hangs on it (1: the last play, to win or tie).

export const clampK = (x, a, b) => Math.max(a, Math.min(b, x))

// where field goals are tried from: [from, to, share of attempts] (about a quarter of today's attempts are from 50+)
export const KICK_BUCKETS = [[19, 29, 0.20], [30, 39, 0.27], [40, 49, 0.29], [50, 59, 0.21], [60, 66, 0.03]]
export function kickDistance(rand = Math.random) {
  let u = rand(), b = KICK_BUCKETS[KICK_BUCKETS.length - 1]
  for (const x of KICK_BUCKETS) { if (u < x[2]) { b = x; break } u -= x[2] }
  return b[0] + Math.floor(rand() * (b[1] - b[0] + 1))
}

// the longest kick his coach will send him out for on a normal down (F 50, B 58, S 65); past it they punt or go for it
export const kickTry = pw => Math.round(50 + pw * 1.4)
// how far the ball carries with a clean strike, no wind (the mini games' reach: F 54, B 61, S 68)
export const kickReach = pw => 54 + pw * 1.25

// the chance a field goal from d yards is good
export function kickP(d, k, env = {}) {
  const pw = k?.power ?? 5, acc = k?.accuracy ?? 5, clu = k?.clutch ?? 5
  const pr = clampK(env.pressure ?? 0, 0, 1)
  const nerve = pr * (5.5 - clu)                       // a B- is himself under pressure; an S gets better, an F worse
  const R = 53 + pw * 0.9 + acc * 0.4 + (env.yards ?? 0) - nerve * 0.9
  const w = 8.5 - acc * 0.25
  const cap = clampK(0.915 + 0.0075 * acc - nerve * 0.006, 0.6, 0.999)
  return cap / (1 + Math.exp(-(R - d) / w))
}
// an extra point (a 33-yard kick)
export function xpP(k, env = {}) {
  const acc = k?.accuracy ?? 5
  return clampK(0.925 + 0.0065 * acc + Math.min(0, env.yards ?? 0) * 0.004, 0.8, 0.999)
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
export const onsideP = k => clampK(0.045 + (k?.accuracy ?? 5) * 0.004 + (k?.clutch ?? 5) * 0.0015, 0.04, 0.11)
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
