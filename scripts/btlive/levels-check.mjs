// BLACKTOP LIVE: a person against each CPU level (the owner, 11-26: "CPU too good on Rookie"). The person is a bot with a
// person's hands (balance.mjs HUMANS): a new kid (slow to react, an average kid's meter timing, little defense), the
// average and the good one. 1v1, two 80 guards. Run: node scripts/btlive/levels-check.mjs [--games=150] [--lib=src/lib/btlive]
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const lib = path.resolve(arg('lib') || 'src/lib/btlive')
const { createGame, step, cpuInput, flatBuild, LEVELS, HZ, T } = await import(pathToFileURL(path.join(lib, 'index.js')).href)
const G = Number(arg('games')) || 150
const person = (react, timing, more) => ({ meterSd: timing * 1.3, react: Math.round(react / (1000 / HZ)), contest: 0.8, steal: 0.16, help: 0.45, ev: 0.08, move: 0.75, gap: 0.3, fake: 0.1, bite: 1, ...more })
const KIDS = {
  // (a new kid: slow to see it, a release about 100 ms off, picks his shots and his defense poorly)
  'new kid': person(480, 100 / 1.3, { contest: 0.4, steal: 0.07, help: 0.12, ev: 0.25, move: 0.3, gap: 1.2, bite: 1.4 }),
  average: person(345, 42),
  good: person(285, 26, { contest: 0.9, ev: 0.05, move: 0.9, gap: 0.1 }),
}
const grade = 1 + (80 - 57) / 44 * 9
console.log(`lib: ${path.relative(process.cwd(), lib) || '.'}   (${G} games each, 1v1, two 80 guards)`)
for (const [k, h] of Object.entries(KIDS)) {
  const row = Object.keys(LEVELS).map(l => {
    let w = 0
    for (let g = 0; g < G; g++) {
      const s = createGame({ teams: [[{ id: 'p', pos: 'guard', build: flatBuild('guard', grade) }], [{ id: 'c', pos: 'guard', build: flatBuild('guard', grade) }]], seed: `lv-${k}-${l}-${g}` })
      while (s.phase !== 'over' && s.tick < 30 * 60 * HZ) step(s, [cpuInput(s, 0, h), cpuInput(s, 1, l)])
      if (s.winner === 0) w++
    }
    return `${l} ${Math.round(100 * w / G)}%`
  })
  console.log(`  ${k.padEnd(8)} wins against   ${row.join('   ')}`)
}
