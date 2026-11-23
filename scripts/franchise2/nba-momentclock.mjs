// NBA Franchise: key moments start from the real game and decide it. Every moment of the GM's games over several
// seasons' worth of nights, landed and missed: the ball (his team's on offense and at the line, theirs on a stop), the
// clock (the engine's own), the man (never six fouls, on the floor), and the result (a landed moment that leaves his
// team ahead wins, every time; the final's line says what happened).
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-momentclock.mjs [team=BOS] [games=30]
import * as N from '../../src/lib/franchise2/nba/index'
const team = process.argv[2] ?? 'BOS', G = +(process.argv[3] ?? 30)
const tally = {}, clocks = {}, bad = [], lines = {}
const flag = s => { if (bad.length < 12) bad.push(s); bad.n = (bad.n ?? 0) + 1 }
let n = 0, sealedN = 0, sealedW = 0, ots = 0, inOT = 0, po = 0
const one = (F, hit) => {
  const P = F.pend, Gm = P.G
  const k = Gm.h.short === F.team ? 'h' : 'a'
  const plan = N.momentPlan(F)
  const ball = Gm.poss === k
  if ((plan.spot === 'def') === ball) flag(`spot ${plan.spot} but ball ${ball ? 'ours' : 'theirs'}`)
  if (Math.abs(plan.situation.clock - Gm.clock) > 1e-6) flag('situation clock is not the engine clock')
  if (plan.situation.mine !== Gm.sc[k]) flag('situation score is not the engine score')
  if ((Gm.box[plan.man]?.pf ?? 0) >= 6) flag(`${plan.name} has 6 fouls`)
  if (P.po != null && !plan.situation.series) flag('playoff moment without the series')
  const ids = [...plan.cast.us.guard, ...plan.cast.us.big]
  if (ids.length !== 5 || !ids.includes(plan.cast.me) || plan.cast.us.guard.length !== 3 || plan.cast.them.guard.length + plan.cast.them.big.length !== 5) flag('cast is not five with him in it, three out and two in')
  const onFloor = Gm[k].floor.filter(id => (Gm.box[id]?.pf ?? 0) < 6)
  if (onFloor.filter(id => id !== plan.man).length < 4) flag('fewer than four teammates on the floor')
  const c = Gm.clock; const b = c <= 6 ? '0-6' : c <= 12 ? '7-12' : c <= 18 ? '13-18' : '19-24'; clocks[b] = (clocks[b] ?? 0) + 1
  const m = Gm.sc[k] - Gm.sc[k === 'h' ? 'a' : 'h']
  const per = Gm.per
  if (per > 4) { inOT++; if (!/overtime/.test(plan.situation.line) || plan.situation.period === '4TH') flag('an OT moment that says the fourth') }
  if (P.po != null) po++
  N.momentDone(F, plan, { hit, raw: null })
  const row = F.log[F.log.length - 1]
  const mo = row.mo
  if (!mo) { flag('no row.mo'); return }
  const key = `${plan.spot}|${plan.game}|m${m > 0 ? '+' : ''}${m}|${mo.hit ? 'LANDED' : 'missed'}`
  const t = (tally[key] ??= { n: 0, w: 0, ot: 0 }); t.n++; if (row.w) t.w++; if (row.ot > per - 4) { t.ot++; ots++ }
  if (mo.sealed) { sealedN++; if (row.w) sealedW++; else flag(`SEALED BUT LOST: ${key} ${row.us}-${row.them} ${N.momentText(F, row)}`) }
  if (mo.left > 5.5 && plan.spot !== 'ft' && !mo.tov) flag(`left ${mo.left} after a last possession (${key})`)
  const txt = N.momentText(F, row)
  if (!txt) flag('no text')
  // the text and the board agree
  if (mo.side === 'off' && mo.pts > 0 && /misses|loses/.test(txt.split('.')[0])) flag('text says missed on a make: ' + txt)
  if (mo.side === 'off' && mo.pts === 0 && !/misses|loses|can't/.test(txt)) flag('text says made on a miss: ' + txt)
  if (/win it in (\w+ )?overtime/.test(txt) && !row.ot) flag('text says OT, no OT: ' + txt)
  if (/The (\w+) win it in (\w+ )?overtime/.test(txt) && (RegExp.$1 === N.TEAM[F.team].nick) !== row.w) flag('OT winner wrong: ' + txt)
  if (/hold on/.test(txt) && !row.w) flag('hold on in a loss: ' + txt)
  ;(lines[key] ??= []).length < 2 && lines[key].push(`${txt} [${row.w ? 'W' : 'L'} ${row.us}-${row.them}${row.ot ? ' OT' : ''}]`)
  n++
}
for (const hit of [true, false]) for (const sd of ['a', 'b', 'c']) {
  const F = N.createNbaFranchise({ seed: `mclk-${sd}-${hit}`, team, owner: 'G', builds: [] })
  let k = 0
  while (F.phase === 'season' && k < G) {
    const o = N.playNext(F, { moments: true })
    if (!o?.pending) { if (!N.nextMine(F)) break; continue }
    k++; one(F, hit)
  }
  // the playoffs, every game of his a moment if it can be
  if (sd === 'a') {
    N.simTo(F, F.days); N.startPostseason(F)
    for (let i = 0; i < 120 && (F.phase === 'playin' || F.phase === 'playoffs'); i++) { const o = N.playPoNight(F, { moments: true }); if (o?.pending) one(F, hit) }
  }
}
console.log('moments', n, '(in overtime', inOT, '· playoffs', po, ') went to OT after the moment', ots)
for (const [k, t] of Object.entries(tally).sort()) console.log(k.padEnd(34), `${t.w}/${t.n} won`, t.ot ? `${t.ot} OT` : '')
console.log('clock at the stop:', JSON.stringify(clocks))
console.log(`landed and ahead after it (sealed): won ${sealedW}/${sealedN}`)
console.log('\nlines:'); for (const [k, l] of Object.entries(lines).sort()) console.log(k.padEnd(34), l.join(' || '))
console.log('\nBAD', bad.n ?? 0, bad.join('\n  '))
