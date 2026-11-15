// Calibration of the game sim: points, home edge, OT and ties, and moments (on at the normal rate vs off).
//   bash scripts/franchise2/run.sh scripts/franchise2/game-calib.mjs
import { playGame, newGame, run, resolveKey, normalRate } from '../../src/lib/franchise2/game'
import { seeded } from '../../src/lib/rng'
const N = 20000
for (const [o1, d1, o2, d2] of [[6, 6, 6, 6], [8, 8, 5, 5], [10, 9, 4, 4], [7, 5, 5, 7]]) {
  let pts = 0, hw = 0, ot = 0, tie = 0, close = 0
  for (let i = 0; i < N; i++) {
    const S = playGame({ h: 'A', a: 'B', sh: { off: o1, def: d1 }, sa: { off: o2, def: d2 }, seed: `c${i}`, homeEdge: 0.9 })
    pts += S.hs + S.as; if (S.hs > S.as) hw++; if (S.ot) ot++; if (S.tie) tie++; if (Math.abs(S.hs - S.as) <= 8) close++
  }
  console.log(`${o1}/${d1} v ${o2}/${d2}: ${(pts / N / 2).toFixed(1)} pts/team, home wins ${(100 * hw / N).toFixed(1)}%, OT ${(100 * ot / N).toFixed(1)}%, ties ${(100 * tie / N).toFixed(2)}%, one-score ${(100 * close / N).toFixed(0)}%`)
}
// moments: the same games, the key play hit at the build's normal rate, against moments off
for (const ovr of [72, 80, 90]) for (const side of ['off', 'def']) {
  const h = normalRate(ovr)
  let on = 0, off = 0, dealt = 0
  for (let i = 0; i < N; i++) {
    const G = { h: 'A', a: 'B', sh: { off: 6.5, def: 6 }, sa: { off: 6, def: 6.5 }, seed: `m${i}`, homeEdge: 0.9 }
    const S0 = playGame(G); if (S0.hs > S0.as) off++
    const S = run(newGame({ ...G, key: { us: 'h', side, h, window: 300 } }))
    if (S.key) { dealt++; resolveKey(S, seeded(`hit${i}`)() < h, null, 'x') }
    if (S.hs > S.as) on++
  }
  console.log(`moment ${side} ovr ${ovr} (rate ${h.toFixed(2)}): dealt ${(100 * dealt / N).toFixed(0)}%, wins on ${(100 * on / N).toFixed(1)}% off ${(100 * off / N).toFixed(1)}%`)
}
