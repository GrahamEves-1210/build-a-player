// What a combine number means depends on who's running it: a B-speed quarterback runs about a 4.80,
// a B-speed receiver about a 4.48. Each row: a player's result at grade F, B and S.
const line = ([f, b, s], v) => (v <= 6 ? f + (b - f) * (Math.max(v, 1) - 1) / 5 : b + (s - b) * (Math.min(v, 11) - 6) / 5)

const DASH = {
  forty: {
    qb: [5.2, 4.8, 4.45], rb: [4.85, 4.5, 4.28], wr: [4.82, 4.48, 4.25],
    te: [5.05, 4.68, 4.42], db: [4.8, 4.47, 4.25],
    // a lineman by his spot: an edge runs like a big tight end, an interior man like nobody else
    edge: [5.05, 4.72, 4.48], dt: [5.4, 5.02, 4.72], dl: [5.05, 4.72, 4.48],
    lb: [4.95, 4.65, 4.42],
    // an offensive lineman: a good one runs about a 5.2, a freak under 5
    ol: [5.6, 5.22, 4.95],
  },
  sprint: { guard: [3.6, 3.25, 3.02], big: [3.8, 3.42, 3.18] },
  // soccer's academy trial, 30 metres from a standing start on the whistle (the clock has his reaction in it):
  // a B-pace striker about 4.38, a quick one under 4.1 (elite players run 30 m in about 4.0 off the line, gates only)
  sprint30: { st: [4.95, 4.38, 4.02] },
  // baseball's showcase: the 60-yard dash from a standing start (the scouts' 20-80 scale: 6.7 is plus, 6.4 elite, 7.2
  // below average). Batters run it; a pitcher who's asked runs slower
  sixty: { bat: [7.55, 6.9, 6.38], pit: [7.85, 7.2, 6.75] },
}
const BENCH = {
  bench: { qb: [10, 17, 25], rb: [13, 24, 35], wr: [9, 16, 24], te: [15, 27, 38], db: [10, 17, 25], edge: [14, 24, 34], dt: [18, 30, 44], dl: [14, 24, 34], lb: [12, 21, 32], ol: [17, 27, 38] },
  nbench: { guard: [2, 10, 18], big: [5, 16, 26] },
}
// A lineman's 3-cone runs on his own scale, seconds slower than a skill player's at the same grade:
// a good edge about 7.1, a good tackle about 7.5, a good offensive lineman about 7.7. Nobody else moves.
const CONE = { edge: 0.25, dt: 0.6, dl: 0.25, ol: 0.7 }
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
export const dashTypical = (game, pos) => dashTarget(game, pos, 6) + 0.05
export const benchTypical = (game, pos) => benchCeil(game, pos, 6) * 0.68
