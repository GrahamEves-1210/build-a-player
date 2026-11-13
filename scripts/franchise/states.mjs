// Which bucket every team lands in on a new league, and what team select says about each job.
//   bash scripts/franchise/run.sh scripts/franchise/states.mjs [seed]
import * as FR from '../../src/lib/franchise/index'

const seed = process.argv[2] ?? 'franchise'
const t0 = performance.now()
const rows = FR.teamPreviews(seed)
const t1 = performance.now()
FR.teamPreviews(seed)
console.log('teamPreviews', (t1 - t0).toFixed(0), 'ms; a second call', (performance.now() - t1).toFixed(2), 'ms')
for (const st of ['contend', 'retool', 'rebuild']) {
  const l = rows.filter(r => r.state === st).sort((a, b) => a.ratings.rank - b.ratings.rank)
  console.log(`\n${FR.STATE_LABEL[st]} (${l.length})`)
  for (const r of l) console.log(`  ${r.short.padEnd(3)} #${String(r.ratings.rank).padStart(2)} ovr ${r.ratings.ovr} score ${r.score} | window ${r.window.years} | cap ${r.capSpace.toFixed(0)}M | core age ${r.coreAge} | ${r.difficulty.word} | QB: ${r.qb.text} | HARD: ${r.hardest} | UP: ${r.upside}`)
}
// the league a user creates shows the same numbers, whichever team he takes
const F = FR.createFranchise({ team: 'NYJ', seed, gmName: 'G' })
const live = FR.leagueStates(F).all
let diff = 0
for (const r of rows) {
  const x = live.find(y => y.short === r.short)
  if (x.state !== r.state || x.ratings.ovr !== r.ratings.ovr || x.capSpace !== r.capSpace) { diff++; console.log('DIFFERS', r.short, r.state, x.state, r.ratings.ovr, x.ratings.ovr, r.capSpace, x.capSpace) }
}
console.log('\npreview against the created league: differences', diff)
console.log(JSON.stringify(FR.teamState(F)).slice(0, 700))
