// The Dunk Contest, dunk by dunk: how often a simulated human lands each one at each grade, through the same rules
// the browser runs (src/lib/mg/dunkcontest.js) and the same bot as balance.mjs (scripts/mg/bots/dunkcontest.mjs).
//   node scripts/mg/dunks.mjs [--runs=600] [--v=9,11] [--human=avg,good]
// Targets for a decent human (avg) at grade 9 (11-25, the owner: easier): easy ~97%, medium ~88%, hard ~70%; more at 11,
// less at 7 (ratings still count: hard is about 60 / 71 / 83% at 7 / 9 / 11).
// (lib/allStar.js LAND plays the rivals at these rates: keep the two together.)
import { STEP } from '../../src/lib/mg/kit.js'
import { ENGINES } from '../../src/lib/mg/index.js'
import { DUNKS } from '../../src/lib/mg/dunkcontest.js'
import { seeded } from '../../src/lib/rng.js'
import { HUMANS, loadBot } from './balance.mjs'

const args = process.argv.slice(2)
const opt = (k, d) => args.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const runs = Number(opt('runs', 600))
const vs = opt('v', '9,11').split(',').map(Number)
const humans = opt('human', 'avg,good').split(',')
const engine = ENGINES['dunk-contest'], makeBot = await loadBot(engine.botName)

function play(dunk, v, human, seed) {
  const g = engine.make({ v, seed, def: { dunk, attempt: 1 }, game: 'dunk-contest' })
  const step = makeBot(g, human, seeded(`bot-${seed}`))
  let n = 0
  while (!g.done && n++ < 20 * 120) { const ins = step(); if (ins) for (const a of ins) g.input(a); g.tick(STEP) }
  if (!g.done) return null
  for (let i = 0; i < 300; i++) g.tick(STEP)   // (the outro has to run clean too)
  return g.done
}
const rows = {}
console.log(`landed % over ${runs} runs | ${humans.map(h => vs.map(v => `${h}@${v}`).join(' ')).join(' | ')} | avg quality landed (${humans[0]}@${vs[0]})`)
for (const d of DUNKS) {
  const cells = []
  let qs = 0, qn = 0, stuck = 0
  for (const h of humans) for (const v of vs) {
    let hit = 0
    for (let i = 0; i < runs; i++) {
      const res = play(d.id, v, HUMANS[h], `${d.id}-${v}-${h}-${i}`)
      if (!res) { stuck++; continue }
      if (res.hit) { hit++; if (h === humans[0] && v === vs[0]) { qs += res.raw.quality; qn++ } }
    }
    cells.push(String(Math.round((hit / runs) * 100)).padStart(3))
    ;(rows[`${d.tier}|${h}|${v}`] ??= []).push(hit / runs)
  }
  console.log(`${d.name.padEnd(22)} ${d.tier.padEnd(6)} ${cells.join('  ')}   q ${(qs / Math.max(1, qn)).toFixed(2)}${stuck ? `  STUCK ${stuck}` : ''}`)
}
console.log('\nby tier')
for (const tier of ['easy', 'medium', 'hard']) console.log(`${tier.padEnd(7)} ${humans.map(h => vs.map(v => { const a = rows[`${tier}|${h}|${v}`]; return `${h}@${v} ${String(Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100)).padStart(3)}%` }).join('  ')).join(' | ')}`)
