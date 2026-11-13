// FRANCHISE engine: the quarterbacks in each draft class (true grade, consensus, where they went), year by year.
//   bash scripts/franchise/run.sh scripts/franchise/qb-class.mjs [seed] [years]
import * as FR from '../../src/lib/franchise/index'

const seed = process.argv[2] ?? 'dev', years = Number(process.argv[3] ?? 4)
let F = FR.createFranchise({ team: 'KC', builds: [], gmName: 'Probe', seed })
for (let y = 0; y < years; y++) {
  let guard = 0
  while (F.phase !== 'offseason' && guard++ < 40) F = FR.autopilot(F, { until: 'week' })
  while (F.phase === 'offseason' && FR.offseason(F).stage.id !== 'draft') F = FR.advanceStage(F, { auto: true })
  const D = F.draft, all = [...D.prospects].sort((a, b) => b.cons - a.cons)
  const rank = new Map(all.map((p, i) => [p.id, i + 1]))
  const qbs = D.prospects.filter(p => p.pos === 'qb').sort((a, b) => b.cons - a.cons)
  F = FR.advanceStage(F, { auto: true })
  const went = Object.fromEntries(F.draft.picks.map(x => [x.name, x.n]))
  console.log(`${D.year} class: top-32 by position: ${Object.entries(all.slice(0, 32).reduce((m, p) => { m[p.pos] = (m[p.pos] ?? 0) + 1; return m }, {})).map(([k, n]) => `${k} ${n}`).join(' ')}`)
  console.log('  QBs (ovr/cons, board rank -> pick): ' + qbs.slice(0, 12).map(p => `${p.ovr}/${p.cons} #${rank.get(p.id)}->${went[p.name] ?? 'UDFA'}`).join('  '))
  console.log(`  QBs in round 1: ${F.draft.picks.filter(x => x.r === 1 && x.pos === 'QB').length}, round 2: ${F.draft.picks.filter(x => x.r === 2 && x.pos === 'QB').length}`)
  while (F.phase === 'offseason') F = FR.advanceStage(F, { auto: true })
}
