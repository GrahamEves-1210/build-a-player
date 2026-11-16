// Franchise's moments on their engines, played by the mini games' simulated humans (scripts/mg/bots): what a snap
// gets an average player, by down and distance. Bot estimates, not people.
//   bash scripts/franchise2/run.sh scripts/franchise2/moment-engines.mjs [runs=120]
import { STEP } from '../../src/lib/mg/kit.js'
import { ENGINES } from '../../src/lib/mg/index.js'
import { seeded } from '../../src/lib/rng.js'
const HUMANS = { avg: { react: 345, reactSd: 70, timing: 42, rate: 9.5, slip: 0.03 }, good: { react: 285, reactSd: 50, timing: 26, rate: 12, slip: 0.012 } }   // (scripts/mg/balance.mjs)
import throwBot from '../mg/bots/throw.mjs'
import runBot from '../mg/bots/kickret.mjs'
import stopBot from '../mg/bots/hitstick.mjs'
import fadeBot from '../mg/bots/goalline.mjs'

const N = Number(process.argv[2] ?? 120)
const BOTS = { 'fr-pass': throwBot, 'fr-run': runBot, 'fr-stop': stopBot, 'fr-fade': fadeBot }
function play(game, v, human, seed, sit) {
  const E = ENGINES[game]
  const g = E.make({ v, arm: v, seed, def: { title: game, rounds: game === 'fr-stop' ? 1 : undefined }, game, sport: 'nfl', pos: game === 'fr-fade' ? 'qb' : null, situation: sit })
  const r = seeded(`bot-${seed}`)
  const step = BOTS[game](g, human, r, game)
  let f = 0
  while (!g.done && f++ < 90 * 120) { const a = step(); if (a) for (const x of a) g.input(x); g.tick(STEP) }
  for (let i = 0; i < 200; i++) g.tick(STEP)
  return g.done
}
const CASES = [
  ['fr-run', '3rd & 2 at own 40', { los: 40, togo: 2, down: 3, hole: 'inside', side: 1 }],
  ['fr-run', '3rd & 2, power', { los: 40, togo: 2, down: 3, hole: 'power', side: -1 }],
  ['fr-run', '3rd & 7, draw', { los: 55, togo: 7, down: 3, hole: 'draw', side: 1 }],
  ['fr-run', '3rd & goal at the 3', { los: 97, togo: 3, down: 3, goal: true, hole: 'power', side: 1 }],
  ['fr-pass', '3rd & 4, smash', { togo: 4, toGoal: 55, down: 3, call: 1 }],
  ['fr-pass', '3rd & 9, dagger', { togo: 9, toGoal: 50, down: 3, call: 2 }],
  ['fr-pass', '3rd & 6 at the 18', { togo: 6, toGoal: 18, down: 3, call: 4 }],
  ['fr-fade', '3rd & goal at the 5', { togo: 5, toGoal: 5, down: 3 }],
  ['fr-stop', '4th & 1 (defense)', { togo: 1 }],
]
console.log(`${N} snaps a line, an average human (and a good one), grade 6 · first down or better / avg yards / turnovers`)
for (const [game, label, sit] of CASES) {
  for (const hn of ['avg', 'good']) {
    let conv = 0, yds = 0, to = 0, n = 0, stuck = 0
    for (let i = 0; i < N; i++) {
      const d = play(game, 6, HUMANS[hn], `${game}-${label}-${hn}-${i}`, sit)
      if (!d) { stuck++; continue }
      n++
      const raw = d.raw ?? {}
      if (game === 'fr-stop') { const y = raw.yards ?? 0; yds += y; if (y < sit.togo) conv++; if (raw.fumbles) to++; continue }
      if (game === 'fr-run') { const y = raw.yards ?? 0; yds += y; if (raw.td || y >= sit.togo) conv++; continue }
      if (game === 'fr-fade') { if (d.hit) { conv++; yds += sit.togo } continue }
      const y = raw.ints ? 0 : raw.gain ?? 0; yds += d.out ? -6 : y; if (d.hit || raw.pts) conv++; if (raw.ints) to++
    }
    console.log(`${label.padEnd(24)} ${game.padEnd(8)} ${hn.padEnd(5)} ${(conv / Math.max(1, n) * 100).toFixed(0).padStart(3)}%${game === 'fr-stop' ? ' stops' : ''}  ${(yds / Math.max(1, n)).toFixed(1).padStart(5)} yds  ${to} TO${stuck ? `  ${stuck} STUCK` : ''}`)
  }
}
