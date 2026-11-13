// FRANCHISE engine: saves written by an older engine still open and play on.
//   bash scripts/franchise/run.sh scripts/franchise/old-saves.mjs <file> [<file> ...]
// Each file is a packed save as UTF-16 text (what localStorage holds). Opens it, reads the screens' selectors,
// plays it through the rest of that year and one more season on the autopilot, and checks the roster rules.
import * as FR from '../../src/lib/franchise/index'
import { readFileSync } from 'node:fs'

let bad = 0
const fail = msg => { bad++; console.log('  PROBLEM: ' + msg) }
for (const file of process.argv.slice(2)) {
  let F = FR.unpackFranchise(readFileSync(file, 'utf16le'))
  if (!F || F.broken) { fail(`${file}: did not open (${F?.reason})`); continue }
  console.log(`${file}: ${F.year} ${F.phase}${F.phase === 'offseason' ? '/' + FR.offseason(F).stage.id : ' week ' + F.week}`)
  try {
    // the selectors a screen reads on load
    FR.hub(F); FR.roster(F); FR.teams(F); FR.history(F); FR.teamState(F); FR.capSheet(F); FR.staff(F); FR.news(F); FR.playerCard(F, FR.roster(F)[0].id)
    if (F.phase === 'offseason') { const o = FR.offseason(F); if (o.stage.id === 'fa') { const v = FR.freeAgency(F); if (!Array.isArray(v.signed)) fail('freeAgency().signed'); } if (o.stage.id === 'draft') { const v = FR.draftView(F); if (!Array.isArray(v.class)) fail('draftView().class'); FR.combineReport(F) } }
    const dupes = f => { let n = 0; for (const t of FR.teams(f)) { const seen = new Set(); for (const p of FR.roster(f, t.short)) { if (p.num == null) continue; if (seen.has(p.num)) n++; seen.add(p.num) } } return n }
    if (dupes(F)) fail(`${dupes(F)} shared jersey numbers after loading`)
    const dir = FR.teamState(F).direction
    let guard = 0
    while (F.phase === 'offseason' && guard++ < 20) F = FR.advanceStage(F)
    if (guard > 0 && FR.teamState(F).direction !== dir) fail(`the direction changed over the rollover: ${dir} to ${FR.teamState(F).direction}`)
    F = FR.autopilot(F, { until: 'year' })
    for (const t of FR.teams(F)) { const n = FR.roster(F, t.short).filter(p => p.inj?.status !== 'IR').length; if (n > 46 || n < 40) fail(`${t.short} carries ${n}`) }
    const back = FR.unpackFranchise(FR.packFranchise(F))
    if (!back || back.broken) fail('the save made from it did not open')
    console.log(`  played on to ${F.year} week ${F.week}; record last year ${FR.history(F).seasons[0]?.user?.record}; ${dupes(F)} shared numbers`)
  } catch (e) { fail(`${file}: ${e.message} ${String(e.stack ?? '').split('\n')[1] ?? ''}`) }
}
console.log(`PROBLEMS: ${bad}`)
process.exitCode = bad ? 1 : 0
