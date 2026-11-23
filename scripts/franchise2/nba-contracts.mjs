// NBA Franchise, headless: the day-one contracts against the real league (payrolls, the max, star terms, the rookies).
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-contracts.mjs [dump=0]
import * as N from '../../src/lib/franchise2/nba/index'
import { capOf, taxOf, apron1Of, apron2Of, maxOf, payroll, overOf, rookieScale } from '../../src/lib/franchise2/nba/cap'
import { NBA_DEALS, NBA_DEAD } from '../../src/data/nba-contracts'
const DUMP = process.argv[2] === '1'
const F = N.createNbaFranchise({ seed: 'ncon', team: 'BOS', owner: 'Graham' })
const Y = F.year
console.log(`cap ${capOf(Y)} tax ${taxOf(Y)} a1 ${apron1Of(Y)} a2 ${apron2Of(Y)}`)
const real = N.realNames()
const rows = []
for (const s of N.SHORTS) for (const p of F.teams[s].r) rows.push([s, p])
const rl = rows.filter(([, p]) => real.has(p.n))
if (DUMP) for (const [s, p] of rl) console.log(['DUMP', s, p.n, p.ag, p.ys, p.$, p.y, p.opt ? p.opt.k + p.opt.yr : '', p.rs ? 'rs' : '', p.tw ? 'tw' : '', p.bird, p.real ? 'real' : 'est', p.dr ? p.dr.join('/') : ''].join('\t'))
const over = rows.filter(([, p]) => !p.tw && !p.real && p.$ > maxOf(p.ys ?? 0, Y) + 0.05)
const overReg = rl.filter(([, p]) => !p.tw && p.real && p.$ > maxOf(p.ys ?? 0, Y) + 0.05)
console.log(`real men ${rl.length}, on a real deal ${rl.filter(([, p]) => p.real).length}, last season ${rl.filter(([, p]) => p.y === 1).length}`)
console.log(`estimated deals over the max for their service: ${over.length}${over.length ? ': ' + over.map(([s, p]) => `${p.n} ${s} $${p.$} ys${p.ys}`).join(', ') : ''}`)
console.log(`real deals past the service max (supermax, or 105% of his last salary): ${overReg.length}: ${overReg.map(([, p]) => `${p.n} $${p.$}`).join(', ')}`)
// the real payroll: the deals on each team's books (two-way deals off the cap) and its dead money
const realPay = s => Object.values(NBA_DEALS).filter(d => d.t === s && !d.tw && d.s?.length).reduce((a, d) => a + d.s[0], 0) + (NBA_DEAD[s] ?? []).reduce((a, [, v]) => a + v[0], 0)
let off = 0
console.log('team   game   real   diff  (men here on another team\'s real books)')
for (const s of N.SHORTS) {
  const g = payroll(F, s, Y), r = realPay(s)
  off = Math.max(off, Math.abs(g - r))
  const wrong = F.teams[s].r.filter(p => { const d = N.realDeal(p.n); return d && d.t !== s }).map(p => `${p.n} (${N.realDeal(p.n).t})`)
  console.log(`${s}  ${g.toFixed(1).padStart(6)} ${r.toFixed(1).padStart(6)} ${(g - r).toFixed(1).padStart(6)}  ${wrong.join(', ')}`)
}
console.log(`largest payroll gap ${off.toFixed(1)}`)
const lines = { under: 0, cap: 0, tax: 0, a1: 0, a2: 0 }
const pays = N.SHORTS.map(s => { const pay = payroll(F, s, Y); lines[overOf(pay, Y)]++; return [s, pay, F.teams[s].r.filter(p => p.tw).length] })
console.log('payrolls: ' + pays.map(([s, v, tw]) => `${s} ${v.toFixed(1)}${tw !== 3 ? ` (tw ${tw})` : ''}`).join(' · '))
console.log('lines', JSON.stringify(lines))
const STARS = ['Shai Gilgeous-Alexander', 'Anthony Edwards', 'Jayson Tatum', 'Jaylen Brown', 'Nikola Jokic', 'Stephen Curry', 'Victor Wembanyama', 'Luka Doncic', 'Giannis Antetokounmpo', 'Donovan Mitchell', 'Zach Edey', 'Daniel Gafford']
for (const n of STARS) { const x = rl.find(([, p]) => p.n === n); if (x) { const [s, p] = x; console.log(`  ${n} ${s}: $${p.$} x${p.y} ${(p.sc ?? []).join('/')} ${p.opt ? p.opt.k + p.opt.yr : ''} ys ${p.ys} bird ${p.bird}${p.rs ? ' rookie scale' : ''}`) } else console.log(`  ${n}: not found`) }
const rk = rl.filter(([, p]) => p.rk === Y)
console.log(`2026 rookies ${rk.length}:`)
for (const [s, p] of rk.sort((a, b) => (a[1].dr?.[2] ?? 99) - (b[1].dr?.[2] ?? 99))) console.log(`  ${p.dr ? '#' + p.dr[2] + (p.dr[1] === 2 ? ' (2nd)' : '') : 'undrafted'} ${p.n} ${s}: $${p.$} x${p.y} ${p.rs ? 'rs' : ''}${p.tw ? 'tw' : ''} ${p.opt ? p.opt.k + p.opt.yr : ''} scale ${p.dr?.[1] === 1 ? rookieScale(p.dr[2], Y)[0] : '-'}`)
