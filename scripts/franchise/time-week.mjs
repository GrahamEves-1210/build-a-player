// Where a week's time goes. bash scripts/franchise/run.sh scripts/franchise/time-week.mjs
import * as FR from '../../src/lib/franchise/index'
import { playWeek, endWeek } from '../../src/lib/franchise/season'
import { prepWeek } from '../../src/lib/franchise/week'
import { upkeep } from '../../src/lib/franchise/roster'
import { standing } from '../../src/lib/franchise/standings'
import { powerRankings } from '../../src/lib/franchise/season'
import { autoDepth } from '../../src/lib/franchise/depth'
import { rngOf } from '../../src/lib/franchise/rng'
let F = FR.createFranchise({ team: 'DEN', gmName: 'Graham', seed: 'time-week' })
const T = {}
const time = (k, f) => { const a = performance.now(); const r = f(); T[k] = (T[k] ?? 0) + performance.now() - a; return r }
for (let w = 0; w < 12; w++) {
  F = time('delegateWeek', () => FR.delegateWeek(F))
  const recap = time('playWeek', () => playWeek(F, null))
  time('endWeek', () => endWeek(F, recap))
  time('x prepWeek alone', () => prepWeek(F))
  time('x standing alone', () => standing(F))
  time('x power alone', () => powerRankings(F))
  time('x autoDepth x32 alone', () => { for (const s in F.teams) autoDepth(F, F.teams[s]) })
  time('x upkeep x32 alone', () => { const R = rngOf('x'); for (const s in F.teams) upkeep(F, F.teams[s], R) })
  time('x hub', () => FR.hub(F))
  time('x roster', () => FR.roster(F))
  time('x leaders', () => FR.leaders(F))
  time('x standings view', () => FR.standings(F))
  time('x awardRaces', () => FR.awardRaces(F))
  time('x teamNeeds', () => FR.teamNeeds(F))
}
for (const k in T) console.log(k.padEnd(26), (T[k] / 12).toFixed(1), 'ms')
