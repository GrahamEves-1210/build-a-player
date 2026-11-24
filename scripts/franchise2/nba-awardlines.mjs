// NBA Franchise: an award winner's line on the Awards and History screens is his season (every team he played for),
// and it stays after his career rows fold or he retires (closeSeason keeps it on F.hist[].aw)
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-awardlines.mjs
import * as N from '../../src/lib/franchise2/nba/index'
import { statLine, seasonOf } from '../../src/components/franchise2/nba/awardLine'
const F = N.createNbaFranchise({ seed: 'awlines', team: 'CHA', owner: 'G' })
N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F); N.closeSeason(F)
const h = F.hist.at(-1), A = h.aw
let bad = 0, n = 0, split = 0
const all = [...['MVP', 'ROY', 'DPOY', '6MOY', 'MIP', 'CLUTCH', 'FMVP', 'ECF', 'WCF'].filter(k => A[k]).map(k => [k, A[k]]), ...(A.ALL ?? []).flat().map(w => ['ALL', w]), ...(A.ALLDEF ?? []).flat().map(w => ['DEF', w])]
for (const [k, w] of all) {
  n++
  const live = statLine(F, w.i, h.y, k), kept = statLine(F, w.i, h.y, k, w)
  if (!kept || !w.p) { bad++; console.log('NO LINE', k, w.n) }
  // (the season's line from the career rows after the new season starts: the same numbers)
  const rows = (N.manOf(F, w.i)?.car ?? []).filter(c => c.y === h.y && !c.y2)
  if (rows.length > 1) split++
  const x = seasonOf({ ...F, year: F.year + 1 }, w.i, h.y)
  if (!['FMVP', 'ECF', 'WCF'].includes(k) && x?.gp !== w.l?.[0]) { bad++; console.log('GP DIFFERS', k, w.n, x?.gp, w.l) }
  if (k === 'MVP' || k === 'ALL') if (live !== kept && !['FMVP', 'ECF', 'WCF'].includes(k)) { bad++; console.log('DIFF', k, w.n, live, '|', kept) }
}
// a traded man's season: the career rows summed, not one team's
let tr = 0
for (const s of N.SHORTS) for (const p of F.teams[s].r) {
  const rows = (p.car ?? []).filter(c => c.y === h.y && !c.y2 && c.gp)
  if (rows.length < 2) continue
  tr++
  const x = seasonOf({ ...F, year: F.year + 1 }, p.i, h.y), gp = rows.reduce((a, c) => a + c.gp, 0), pts = rows.reduce((a, c) => a + c.pts, 0)
  if (x.gp !== gp || x.pts !== pts) { bad++; console.log('TRADED SUM WRONG', p.n) }
}
// retired: the man gone, the line still there
const w = A.MVP; const T = F.teams[N.teamOfMan(F, w.i)]; T.r = T.r.filter(p => p.i !== w.i)
const after = statLine(F, w.i, h.y + 5, 'MVP', w)
if (!after) { bad++; console.log('RETIRED: NO LINE') }
console.log(`${n} winners, ${tr} traded men checked; MVP ${w.n}: ${after}`)
console.log(bad ? `FAIL ${bad}` : 'OK')
