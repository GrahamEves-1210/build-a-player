// What a combine number means depends on who's running it: a B-speed quarterback runs about a 4.80,
// a B-speed receiver about a 4.48. Each row: a player's result at grade F, B and S.
const line = ([f, b, s], v) => (v <= 6 ? f + (b - f) * (Math.max(v, 1) - 1) / 5 : b + (s - b) * (Math.min(v, 11) - 6) / 5)

// The typical prospect at each spot: the NFL Scouting Combine's position averages (rounded; Pro Football
// Reference's combine results 2000-2024, the same averages MockDraftable and nflcombineresults.com list).
//   40-yard dash: QB 4.80, RB 4.52, WR 4.48, TE 4.72, CB 4.49 / S 4.55 (DB 4.50), LB 4.68 (OLB 4.65, ILB 4.72),
//                 DE/EDGE 4.76, DT 5.06, OL 5.28 (OT 5.29, OG 5.32, C 5.27)
//   225 lb bench: RB 20, WR 14, TE 21, DB 15 (CB 14, S 16), LB 22, EDGE 25, DT 28, OL 26 (OT 25, OG 27, C 26);
//                 quarterbacks hardly ever lift (16 here, for a QB who does)
//   3-cone:       QB 7.10, RB 7.08, WR 6.96, TE 7.14, DB 6.96, LB 7.10, EDGE 7.20, DT 7.60, OL 7.76
// The career's scouts read every number against these (lib/career.js drillValue; the combine's bars in
// components/app/AppCareer.jsx: green well past the average, yellow around it, red well short of it), so a 5.0
// from a tackle reads fast, and a linebacker's 22 on the bench is a normal set even though a defensive tackle's normal is 28.
const AVG = {
  forty: { qb: 4.80, rb: 4.52, wr: 4.48, te: 4.72, db: 4.50, lb: 4.68, edge: 4.76, dl: 4.76, dt: 5.06, ol: 5.28 },
  bench: { qb: 16, rb: 20, wr: 14, te: 21, db: 15, lb: 22, edge: 25, dl: 25, dt: 28, ol: 26 },
}

// (a B on a clean go runs a few hundredths under the average: a typical prospect's run isn't a perfect one)
const DASH = {
  forty: {
    qb: [5.15, 4.75, 4.42], rb: [4.82, 4.47, 4.26], wr: [4.78, 4.43, 4.22],
    te: [5.05, 4.67, 4.42], db: [4.8, 4.45, 4.24],
    // a lineman by his spot: an edge runs like a big tight end, an interior man like nobody else
    edge: [5.05, 4.71, 4.47], dt: [5.4, 5.01, 4.72], dl: [5.05, 4.71, 4.47],
    lb: [4.95, 4.63, 4.4],
    // an offensive lineman: a good one runs about a 5.2, a freak under 5
    ol: [5.6, 5.23, 4.95],
  },
  sprint: { guard: [3.6, 3.25, 3.02], big: [3.8, 3.42, 3.18] },
  // soccer's academy trial, 30 metres from a standing start on the whistle (the clock has his reaction in it):
  // a B-pace striker about 4.38, a quick one under 4.1 (elite players run 30 m in about 4.0 off the line, gates only)
  sprint30: { st: [4.95, 4.38, 4.02] },
  // baseball's showcase: the 60-yard dash from a standing start (the scouts' 20-80 scale: 6.7 is plus, 6.4 elite, 7.2
  // below average). Batters run it; a pitcher who's asked runs slower
  sixty: { bat: [7.55, 6.9, 6.38], pit: [7.85, 7.2, 6.75] },
}
// The most reps a grade has in him (the set's ceiling). A typical set gets about two thirds of it (BENCH_SHARE), so
// a B's ceiling is the position's average over that share: a B defensive tackle's 41 is a 28-rep set, a B linebacker's 32 a 22
const BENCH_SHARE = 0.68
const BENCH = {
  bench: { qb: [13, 23.5, 33], rb: [16, 29.5, 41], wr: [11, 20.5, 29], te: [17, 31, 43], db: [12, 22, 31], edge: [20, 37, 51], dt: [23, 41, 57], dl: [20, 37, 51], lb: [18, 32.5, 45], ol: [21, 38, 53] },
  nbench: { guard: [2, 10, 18], big: [5, 16, 26] },
}
// Each spot's 3-cone runs on its own scale (the drill's clock and the scouts' read both move by it): a B runs
// about the position average above (lib/mg/cone.js and drillValue: 7.05 seconds at a B, plus this)
const CONE = { qb: 0.05, rb: 0.03, wr: -0.09, te: 0.09, db: -0.09, lb: 0.05, edge: 0.15, dt: 0.55, dl: 0.15, ol: 0.71 }
export const coneShift = pos => CONE[pos] ?? 0
const row = (table, pos, fallback) => table[pos] ?? table[fallback]
// Baseball's showcase readings, on a good rep, by grade: the hardest ball in batting practice (mph off the bat: a good
// prospect about 98, the best 105+), an outfielder's throw on the gun (mph: 88 is a big-league average arm, 95+ a
// cannon), the bullpen's best fastball (mph), and the command test's targets hit (of 8)
const BB_NORMS = {
  exitVelo: { bat: [90.5, 98.5, 105.5], pit: [82, 90, 99] },
  ofArm: { bat: [79, 88, 97], pit: [80, 89, 97] },
  penVelo: { pit: [92.5, 97.0, 101.4], bat: [84.5, 88.5, 92.5] },
  command: { pit: [3.45, 5.0, 7.35], bat: [1, 2, 3] },
  spin: { pit: [2150, 2550, 2950], bat: [1900, 2200, 2500] },
}
export const bbTarget = (drill, pos, v) => line(row(BB_NORMS[drill] ?? BB_NORMS.exitVelo, pos, Object.keys(BB_NORMS[drill] ?? BB_NORMS.exitVelo)[0]), v)
export const bbTypical = (drill, pos) => bbTarget(drill, pos, 6)

// the time this grade at this position runs on a good, clean go
export const dashTarget = (game, pos, v) => {
  const table = DASH[game] ?? DASH.forty
  return line(row(table, pos, game === 'sprint' ? 'guard' : game === 'sprint30' ? 'st' : game === 'sixty' ? 'bat' : 'wr'), v)
}
// the most reps this grade at this position has in him
export const benchCeil = (game, pos, v) => {
  const table = BENCH[game] ?? BENCH.bench
  return line(row(table, pos, game === 'nbench' ? 'guard' : 'rb'), v)
}
// a typical prospect at the position, for the scouts' read
// (football: the combine's own position average, AVG above; the other sports' drills from their B)
export const dashTypical = (game, pos) => AVG[game]?.[pos] ?? dashTarget(game, pos, 6) + 0.05
export const benchTypical = (game, pos) => AVG[game]?.[pos] ?? benchCeil(game, pos, 6) * BENCH_SHARE
