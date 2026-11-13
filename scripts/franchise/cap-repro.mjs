// Finds the first week or stage where a team is over the cap on the autopilot and says why.
//   bash scripts/franchise/run.sh scripts/franchise/cap-repro.mjs [team=CHI] [seed=check-b] [seasons=8]
import * as FR from '../../src/lib/franchise/index'
import { payroll } from '../../src/lib/franchise/money'
import { capFix } from '../../src/lib/franchise/roster'
import { QBS, TYPES } from '../../src/data/qbs'
import { WRS, WR_TYPES } from '../../src/data/wrs'
import { RBS, RB_TYPES } from '../../src/data/rbs'
import { DLS, DL_TYPES } from '../../src/data/dls'
import { DBS, DB_TYPES } from '../../src/data/dbs'
import { OLS, OL_TYPES } from '../../src/data/ols'

function buildFor(list, types, pos, seed, extra = {}) {
  let k = seed
  const rand = () => { k = (k * 16807) % 2147483647; return k / 2147483647 }
  const pool = list.filter(p => p.attrs)
  const b = Object.fromEntries(types.map(t => { const p = [0, 1, 2].map(() => pool[Math.floor(rand() * pool.length)]).sort((a, c) => (c.attrs[t] ?? 0) - (a.attrs[t] ?? 0))[0]; return [t, { type: t, val: p.attrs[t] ?? 5, qbFull: p.name, team: p.team }] }))
  if (b.size) Object.assign(b.size, extra)
  return { pos, build: b }
}
const BUILDS = [buildFor(QBS, TYPES, 'qb', 11), buildFor(WRS, WR_TYPES, 'wr', 12), buildFor(WRS, WR_TYPES, 'wr', 13), buildFor(RBS, RB_TYPES, 'rb', 14), buildFor(DLS, DL_TYPES, 'dl', 15, { subpos: 'edge' }), buildFor(DLS, DL_TYPES, 'dl', 16, { subpos: 'dt' }), buildFor(DBS, DB_TYPES, 'db', 17, { subpos: 'cb' }), buildFor(OLS, OL_TYPES, 'ol', 18, { subpos: 'LT' })]
const team = process.argv[2] ?? 'CHI', seed = process.argv[3] ?? 'check-b', N = Number(process.argv[4] ?? 8)
let F = FR.createFranchise({ team, builds: BUILDS, gmName: 'Check GM', seed })
const over = () => Object.keys(F.teams).filter(s => payroll(F, F.teams[s]) > F.cap + 0.011)
let found = false
for (let y = 0; y < N && !found; y++) {
  while (F.phase !== 'offseason') { F = FR.autopilot(F, { until: 'week' }); if (over().length) { console.log('IN SEASON', F.year, F.week, over()); found = true; break } }
  while (F.phase === 'offseason' && !found) {
    F = FR.advanceStage(F, { auto: true })
    const o = over()
    if (o.length) {
      found = true
      for (const s of o) {
        const t = F.teams[s], P = t.roster.map(id => F.players[id])
        console.log(`${F.year} ${F.stage}: ${s} payroll ${payroll(F, t)} cap ${F.cap} dead ${t.dead} deadNext ${t.deadNext} user ${s === F.team} auto ${F.off?.auto}`)
        console.log('  top deals', P.sort((a, b) => b.con.sal - a.con.sal).slice(0, 8).map(p => `${p.name} ${p.con.sal}x${p.con.yrs}${p.built ? ' built' : ''}${p.con.tag ? ' tag' : ''}`).join(' | '))
        console.log('  salaries over 4:', P.filter(p => p.con.sal > 4).length, 'sum reducible', P.filter(p => p.con.sal > 4).reduce((a, p) => a + p.con.sal - 2, 0).toFixed(1))
        capFix(F, t)
        console.log('  after a capFix now:', payroll(F, t))
      }
    }
  }
}
if (!found) console.log('never over the cap in', N, 'seasons')
