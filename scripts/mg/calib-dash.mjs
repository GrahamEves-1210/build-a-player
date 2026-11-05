// Top speed against the time it runs, on a solid go: feeds capOf in src/lib/mg/dash.js.
//   node scripts/mg/calib-dash.mjs
import { make } from '../../src/lib/mg/dash.js'
import makeBot from './bots/dash.mjs'
import { seeded } from '../../src/lib/rng.js'
const H = { react: 170, reactSd: 15, timing: 10, rate: 13, slip: 0 }   // the best go a person can have
const STEP = 1000 / 120
for (const game of ['forty', 'sprint']) {
  const out = []
  for (let cap = 8; cap <= 14.01; cap += 0.5) {
    const secs = []
    for (let i = 0; i < 60; i++) {
      const g = make({ v: 6, seed: `c${i}`, game, capOverride: cap })
      const step = makeBot(g, H, seeded(`b${i}`), game)
      let n = 0
      while (!g.done && n++ < 12000) { const a = step(); if (a) for (const x of a) g.input(x); g.tick(STEP) }
      secs.push(g.done?.raw?.secs ?? 99)
    }
    secs.sort((a, b) => a - b)
    out.push([+secs[30].toFixed(2), cap])
  }
  console.log(game, JSON.stringify(out.reverse()))
}
