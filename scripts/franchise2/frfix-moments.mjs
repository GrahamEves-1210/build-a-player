// Franchise's moments, the two a player reported (2026-11-19), on their engines with the mini games' simulated humans:
//   the long pass from deep in his own end: is the goal line on the field, does a catch-and-run get there
//   the run: how often a snap is a touchdown or a big gain, from each field position
//   bash scripts/franchise2/run.sh scripts/franchise2/frfix-moments.mjs [runs=80]
import { STEP } from '../../src/lib/mg/kit.js'
import { ENGINES } from '../../src/lib/mg/index.js'
import { seeded } from '../../src/lib/rng.js'
import throwBot from '../mg/bots/throw.mjs'
import runBot from '../mg/bots/kickret.mjs'
const HUMANS = { avg: { react: 345, reactSd: 70, timing: 42, rate: 9.5, slip: 0.03 }, good: { react: 285, reactSd: 50, timing: 26, rate: 12, slip: 0.012 } }
const N = Number(process.argv[2] ?? 80)
const BOTS = { 'fr-pass': throwBot, 'fr-run': runBot }
function play(game, v, human, seed, sit) {
  const E = ENGINES[game]
  const g = E.make({ v, arm: v, seed, def: { title: game }, game, sport: 'nfl', pos: null, situation: sit })
  const r = seeded(`bot-${seed}`)
  const step = BOTS[game](g, human, r, game)
  let f = 0, maxY = 0
  while (!g.done && f++ < 90 * 120) { const a = step(); if (a) for (const x of a) g.input(x); g.tick(STEP) }
  for (let i = 0; i < 400; i++) { g.tick(STEP); const c = g.res?.runner; if (c) maxY = Math.max(maxY, c.y) }
  return { d: g.done, g, maxY }
}
const YD = 8.4
console.log(`${N} snaps a line · grade 8 (a good starter)`)
for (const toGoal of [30, 50, 65, 80]) {
  for (const hn of ['avg', 'good']) {
    let n = 0, td = 0, yds = 0, big = 0, short = 0
    for (let i = 0; i < N; i++) {
      const { d, g, maxY } = play('fr-pass', 8, HUMANS[hn], `pass-${toGoal}-${hn}-${i}`, { togo: 8, toGoal, down: 3, call: i % 6 })
      if (!d) continue
      n++
      const raw = d.raw ?? {}
      if (raw.pts) td++
      if ((raw.gain ?? 0) >= 20) big++
      yds += raw.ints ? 0 : raw.gain ?? 0
      // (a touchdown whose runner was drawn short of the goal line, or the goal line off the field)
      if (raw.pts && maxY < g.GOAL - 3 * YD) short++
      if (g.GOAL > g.TOP) short++
    }
    console.log(`pass ${String(toGoal).padStart(2)} to go  ${hn.padEnd(4)}  TD ${(td / n * 100).toFixed(0).padStart(3)}%  20+ ${(big / n * 100).toFixed(0).padStart(3)}%  ${(yds / n).toFixed(1).padStart(5)} yds  drawn short of the score ${short}`)
  }
}
for (const los of [25, 50, 75, 92]) {
  for (const hn of ['avg', 'good']) {
    let n = 0, td = 0, yds = 0, big = 0
    for (let i = 0; i < N; i++) {
      const { d } = play('fr-run', 8, HUMANS[hn], `run-${los}-${hn}-${i}`, { los, togo: 4, down: 2, goal: los + 4 >= 100, hole: ['inside', 'power', 'outside', 'draw'][i % 4], side: i % 2 ? 1 : -1 })
      if (!d) continue
      n++
      const raw = d.raw ?? {}
      if (raw.td) td++
      if ((raw.yards ?? 0) >= 20) big++
      yds += raw.yards ?? 0
    }
    console.log(`run from the ${los <= 50 ? `own ${los}` : `opp ${100 - los}`}  ${hn.padEnd(4)}  TD ${(td / n * 100).toFixed(0).padStart(3)}%  20+ ${(big / n * 100).toFixed(0).padStart(3)}%  ${(yds / n).toFixed(1).padStart(5)} yds a carry`)
  }
}
