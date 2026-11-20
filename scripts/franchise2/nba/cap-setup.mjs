// The opening books: every team's payroll, line and roster, the league's pay ladder against the real one.
//   FR_TMP=F:/bap-agents/frnba-cap/tmp bash scripts/franchise2/run.sh scripts/franchise2/nba/cap-setup.mjs [seed]
import { makeLeague } from './fixture'
import { capSheet, capOf, OVER_TEXT } from '../../../src/lib/franchise2/nba/cap'
import { legalRoster, allMen } from '../../../src/lib/franchise2/nba/contracts'

const F = makeLeague({ seed: process.argv[2] ?? 'nba-cap' })
const S = Object.keys(F.teams)
const rows = S.map(s => ({ s, ...capSheet(F, s), n: F.teams[s].r.length, legal: legalRoster(F, s) })).sort((a, b) => b.pay - a.pay)
for (const r of rows) console.log(`${r.s} $${r.pay.toFixed(1)}M ${OVER_TEXT[r.over]}${r.bill ? ` tax $${r.bill}M` : ''} · ${r.n} men${r.legal.ok ? '' : ' !! ' + r.legal.why}`)
const pays = rows.map(r => r.pay)
const cap = capOf(F.year)
console.log(`cap $${cap}M · mean payroll $${(pays.reduce((a, b) => a + b, 0) / 30).toFixed(1)}M · low $${Math.min(...pays)}M · high $${Math.max(...pays)}M`)
console.log('teams over: tax', rows.filter(r => ['tax', 'a1', 'a2'].includes(r.over)).length, '· apron1', rows.filter(r => ['a1', 'a2'].includes(r.over)).length, '· apron2', rows.filter(r => r.over === 'a2').length, '· under cap', rows.filter(r => r.over === 'under').length)
const sal = allMen(F).map(([, p]) => p).filter(p => p.y > 0 && !p.tw).sort((a, b) => b.$ - a.$)
console.log('max-level (25%+):', sal.filter(p => p.$ >= cap * 0.25 - 0.05).length, '· $30M+:', sal.filter(p => p.$ >= 30).length, '· top:', sal.slice(0, 12).map(p => `${p.n} ${p.o}/${p.ag} $${p.$}x${p.y}`).join(' · '))
console.log('ladder:', [1, 10, 25, 50, 100, 150, 200, 300, 400].map(k => `${k}:$${sal[k - 1]?.$}`).join(' '))
