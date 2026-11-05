// How hard is each skill game, really? Simulated humans play each one hundreds of times, through
// the same rules the browser runs (src/lib/mg). Run from the repo root:
//   node scripts/mg/balance.mjs [gameId ...] [--runs=300]
// A bot lives in scripts/mg/bots/<engine>.mjs: export default function makeBot(g, human, r, game)
// returns step(), called every 1/120 s, which returns the inputs to send right then (or nothing).
// It can only act on what's on the screen, through a human's reaction time and timing error.
import { GAMES } from '../../src/lib/minigames.js'
import { STEP } from '../../src/lib/mg/kit.js'
import { ENGINES } from '../../src/lib/mg/index.js'
import { seeded } from '../../src/lib/rng.js'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

// react: ms to see something and start moving (touch screens run slow)
// timing: sd in ms of a press aimed at a moment you can see coming
// rate: taps a second, flat out, with two thumbs
// slip: chance of simply pressing the wrong thing
export const HUMANS = {
  poor: { react: 440, reactSd: 90, timing: 62, rate: 7, slip: 0.07 },
  avg:  { react: 345, reactSd: 70, timing: 42, rate: 9.5, slip: 0.03 },
  good: { react: 285, reactSd: 50, timing: 26, rate: 12, slip: 0.012 },
  pro:  { react: 215, reactSd: 25, timing: 12, rate: 14, slip: 0 },
}
const VS = [1, 3, 5, 8, 11]

export async function loadBot(engineFile) {
  const url = pathToFileURL(path.resolve(`scripts/mg/bots/${engineFile}.mjs`)).href
  return (await import(url)).default
}
const engineName = game => ENGINES[game]?.name
export function playOnce(engine, makeBot, game, v, human, seed) {
  const g = engine.make({ v, seed, def: GAMES[game], game, sport: 'nfl' })
  const r = seeded(`bot-${seed}`)
  const step = makeBot(g, human, r, game)
  let frames = 0
  const cap = 90 * 120
  while (!g.done && frames++ < cap) {
    const inputs = step()
    if (inputs) for (const a of inputs) g.input(a)
    g.tick(STEP)
  }
  if (!g.done) return { stuck: true, ms: g.t }
  // the outro must keep ticking without a fault
  for (let i = 0; i < 180; i++) g.tick(STEP)
  return { ...g.done, ms: g.t }
}

const args = process.argv.slice(2)
if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const runs = Number(args.find(a => a.startsWith('--runs='))?.slice(7)) || 300
  const want = args.filter(a => !a.startsWith('--'))
  const games = (want.length ? want : Object.keys(ENGINES))
  console.log('pass% for each human at grades 1 3 5 8 11 | avg score at grade 5 | seconds')
  for (const game of games) {
    const engine = ENGINES[game]
    if (!engine?.botName) { console.log(game.padEnd(14), 'no bot'); continue }
    const makeBot = await loadBot(engine.botName)
    const row = []
    let secs = 0, nSecs = 0, stuck = 0, score5 = 0, n5 = 0
    for (const [name, human] of Object.entries(HUMANS)) {
      const cells = VS.map(v => {
        let hit = 0
        for (let i = 0; i < runs; i++) {
          const res = playOnce(engine, makeBot, game, v, human, `${game}-${v}-${name}-${i}`)
          if (res.stuck) { stuck++; continue }
          if (res.hit) hit++
          if (name === 'avg') { secs += res.ms / 1000; nSecs++; if (v === 5) { score5 += res.score; n5++ } }
        }
        return String(Math.round((hit / runs) * 100)).padStart(3)
      })
      row.push(`${name} ${cells.join(' ')}`)
    }
    console.log(`${game.padEnd(14)} ${row.join(' | ')} | ${(score5 / Math.max(1, n5)).toFixed(2)} | ${(secs / Math.max(1, nSecs)).toFixed(1)}s${stuck ? ` | STUCK ${stuck}` : ''}`)
  }
}
void engineName
