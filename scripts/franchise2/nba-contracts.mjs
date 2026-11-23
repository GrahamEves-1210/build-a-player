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
const top = rl.filter(([, p]) => p.o >= 88)
console.log(`rated 88+: ${top.length}, on the last season of a deal: ${top.filter(([, p]) => p.y === 1).map(([, p]) => p.n).join(', ') || 'none'}`)
const bd = [0, 0, 0, 0]
for (const [, p] of rl) if (!p.tw) bd[Math.min(3, p.bird ?? 0)]++
console.log(`Bird years (real men on standard deals): 0 ${bd[0]} · 1 ${bd[1]} · 2 (Early Bird) ${bd[2]} · 3+ (full) ${bd[3]}`)
console.log(`two-way men: ${N.SHORTS.map(s => F.teams[s].r.filter(p => p.tw).length).join(' ')}; standard: ${N.SHORTS.map(s => F.teams[s].r.filter(p => !p.tw).length).join(' ')}`)
const lines = { under: 0, cap: 0, tax: 0, a1: 0, a2: 0 }
const pays = N.SHORTS.map(s => { const pay = payroll(F, s, Y); lines[overOf(pay, Y)]++; return [s, pay, F.teams[s].r.filter(p => p.tw).length] })
console.log('payrolls: ' + pays.map(([s, v, tw]) => `${s} ${v.toFixed(1)}${tw !== 3 ? ` (tw ${tw})` : ''}`).join(' · '))
console.log('lines', JSON.stringify(lines))
const STARS = ['Shai Gilgeous-Alexander', 'Anthony Edwards', 'Jayson Tatum', 'Jaylen Brown', 'Nikola Jokic', 'Stephen Curry', 'Victor Wembanyama', 'Luka Doncic', 'Giannis Antetokounmpo', 'Donovan Mitchell', 'Zach Edey', 'Daniel Gafford']
for (const n of STARS) { const x = rl.find(([, p]) => p.n === n); if (x) { const [s, p] = x; console.log(`  ${n} ${s}: $${p.$} x${p.y} ${(p.sc ?? []).join('/')} ${p.opt ? p.opt.k + p.opt.yr : ''} ys ${p.ys} bird ${p.bird}${p.rs ? ' rookie scale' : ''}`) } else console.log(`  ${n}: not found`) }
const rk = rl.filter(([, p]) => p.rk === Y)
console.log(`2026 rookies ${rk.length}:`)
for (const [s, p] of rk.sort((a, b) => (a[1].dr?.[2] ?? 99) - (b[1].dr?.[2] ?? 99))) console.log(`  ${p.dr ? '#' + p.dr[2] + (p.dr[1] === 2 ? ' (2nd)' : '') : 'undrafted'} ${p.n} ${s}: $${p.$} x${p.y} ${p.rs ? 'rs' : ''}${p.tw ? 'tw' : ''} ${p.opt ? p.opt.k + p.opt.yr : ''} scale ${p.dr?.[1] === 1 ? rookieScale(p.dr[2], Y)[0] : '-'}`)
// the checks
const bad = []
if (capOf(Y) !== 165 || taxOf(Y) !== 200.4 || apron1Of(Y) !== 209 || apron2Of(Y) !== 221.7) bad.push('the 2026-27 cap lines')
if (over.length) bad.push(`${over.length} estimated deals over the max`)
if (off > 5) bad.push(`a payroll ${off.toFixed(1)} from the real one`)
if (top.some(([, p]) => p.y === 1 && !p.real)) bad.push('an 88+ man on an estimated last season')
if (N.SHORTS.some(s => F.teams[s].r.filter(p => p.tw).length !== 3)) bad.push('a team without three two-way men')
for (const [, p] of rk) {
  if (p.dr?.[0] === Y && p.dr[1] === 1 && (!p.rs || p.opt?.k !== 'T' || p.y !== 4)) bad.push(`${p.n}: not on a four-year rookie-scale deal`)
  if (p.dr?.[0] === Y && p.dr[1] === 1 && Math.abs(p.$ - rookieScale(p.dr[2], Y)[0]) > 0.6) bad.push(`${p.n}: $${p.$} for pick ${p.dr[2]}`)
}
for (const [, p] of rl) if (p.dr?.[0] === Y && p.rk !== Y) bad.push(`${p.n}: a 2026 pick not a rookie`)
console.log(bad.length ? 'PROBLEMS: ' + bad.join('; ') : 'no problems')
