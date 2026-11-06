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
  },
  sprint: { guard: [3.6, 3.25, 3.02], big: [3.8, 3.42, 3.18] },
}
const BENCH = {
  bench: { qb: [10, 17, 25], rb: [13, 24, 35], wr: [9, 16, 24], te: [15, 27, 38], db: [10, 17, 25], edge: [14, 24, 34], dt: [18, 30, 44], dl: [14, 24, 34], lb: [12, 21, 32] },
  nbench: { guard: [2, 10, 18], big: [5, 16, 26] },
}
// A lineman's 3-cone runs on his own scale, seconds slower than a skill player's at the same grade:
// a good edge about 7.1, a good tackle about 7.5. Nobody else moves.
const CONE = { edge: 0.25, dt: 0.6, dl: 0.25 }
export const coneShift = pos => CONE[pos] ?? 0
const row = (table, pos, fallback) => table[pos] ?? table[fallback]

// the time this grade at this position runs on a good, clean go
export const dashTarget = (game, pos, v) => {
  const table = DASH[game] ?? DASH.forty
  return line(row(table, pos, game === 'sprint' ? 'guard' : 'wr'), v)
}
// the most reps this grade at this position has in him
export const benchCeil = (game, pos, v) => {
  const table = BENCH[game] ?? BENCH.bench
  return line(row(table, pos, game === 'nbench' ? 'guard' : 'rb'), v)
}
// a typical prospect at the position, for the scouts' read
export const dashTypical = (game, pos) => dashTarget(game, pos, 6) + 0.05
export const benchTypical = (game, pos) => benchCeil(game, pos, 6) * 0.68
