// The draft pick's drawn face is the prospect's own: the board, the reveal card and the roster draw the same man.
//   bash scripts/franchise2/run.sh scripts/franchise2/reveal-face-check.mjs
import * as FR from '../../src/lib/franchise2/index'
import { facePos, lookOf } from '../../src/lib/franchise2/faces'
const F = FR.createFranchise({ seed: 'reveal-face', team: 'DEN', owner: 'Graham', builds: [], coach: { name: 'Coach', scheme: 'balanced', style: 'developer' } })
// (Draft.jsx's manOf: a pick keeps the team in s, his spot in sp)
const manOf = x => (x.xi != null && x.at != null ? { p: x.p, s: x.sp } : x)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const men = F.dc.slice(0, 260)
let bad = 0, old = 0
for (const x of men) {
  const pick = { at: 0, s: 'DEN', xi: x.i, n: x.n, p: x.p, ...(x.s && { sp: x.s }) }
  const rookie = { n: x.n, p: x.p, ...(x.s && { s: x.s }) }
  const board = lookOf(x.n, facePos(x)), rv = lookOf(pick.n, facePos(manOf(pick))), team = lookOf(rookie.n, facePos(rookie))
  if (!same(board, rv) || !same(rv, team)) bad++
  if (!same(board, lookOf(pick.n, facePos(pick)))) old++
}
console.log(`${men.length} prospects · reveal face differs from board/roster: ${bad} · (before the fix: ${old})`)
if (bad) process.exit(1)
