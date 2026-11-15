// The real NFL contracts (src/data/nfl-contracts.json) against the game's rosters:
//   coverage of the rostered players, each team's cap hits against the cap, the outliers.
//   bash scripts/franchise2/run.sh scripts/franchise2/contracts-check.mjs
import DATA from '../../src/data/nfl-contracts.json'
import { realPool, POS, MAX, SHORTS } from '../../src/lib/franchise2/league'
import { KS } from '../../src/data/ks'
import { useContracts } from '../../src/lib/franchise2/contracts'

const keyOf = n => String(n ?? '').toLowerCase().replace(/[^a-z]/g, '')
const P = DATA.players
const r1 = x => Math.round(x * 10) / 10
const pct = (a, b) => `${a}/${b} (${b ? Math.round((a / b) * 1000) / 10 : 0}%)`

// ── Coverage ─────────────────────────────────────────────────────────────────
// every real man the mode can put on a roster (the data files), and the ones it does (the top MAX at each spot)
const pool = realPool()
const all = [], used = []
for (const pos of POS) for (const s of SHORTS) {
  const men = pool[pos].filter(p => p.team === s).sort((a, b) => b.o - a.o)
  men.forEach((m, i) => { all.push({ ...m }); if (i < MAX[pos]) used.push(m) })
}
for (const k of KS) all.push({ name: k.name, team: k.team, pos: 'k' })
const hit = m => P[`${keyOf(m.name)}|${m.team}`]
const cov = list => {
  const found = list.filter(hit), real = found.filter(m => !hit(m).est)
  return { n: list.length, found: found.length, real: real.length, est: found.length - real.length, missing: list.filter(m => !hit(m)) }
}
const ca = cov(all), cu = cov(used)
console.log(`2026 cap $${DATA.cap}M · ${Object.keys(P).length} contracts in the file · gathered ${DATA.gathered ?? '?'}`)
console.log(`all real players in the data files: found ${pct(ca.found, ca.n)} · real figures ${ca.real} · estimated ${ca.est}`)
console.log(`players the mode puts on rosters:    found ${pct(cu.found, cu.n)} · real figures ${cu.real} · estimated ${cu.est}`)
if (ca.missing.length) console.log('  missing:', ca.missing.map(m => `${m.name} (${m.team} ${m.pos})`).join(', '))
const engine = useContracts(DATA)
console.log(`contracts.js useContracts() reads ${engine} keys from the file${engine ? '' : '  <-- the engine does not read this shape (players is a map, index() wants an array)'}`)

// ── Teams ────────────────────────────────────────────────────────────────────
// the cap hits of the men the mode rosters, then every man in the file on that team; the rest of a real 53
// (and dead money) is what's left of the cap
console.log('\nteam  rostered $M (men)   all in file $M (men)   % of cap   left for the rest of the 53 + dead   OTC 2026: dead money · all liabilities')
const rows = SHORTS.map(s => {
  const mine = [...new Set(used.filter(m => m.team === s).map(hit).filter(Boolean))]   // (a two-way man is one contract)
  const file = Object.values(P).filter(p => p.team === s)
  const sum = a => r1(a.reduce((x, p) => x + p.capHit, 0))
  return { s, rost: sum(mine), rn: mine.length, all: sum(file), an: file.length }
}).sort((a, b) => b.all - a.all)
for (const r of rows) console.log(`${r.s.padEnd(5)} ${String(r.rost).padStart(7)} (${String(r.rn).padStart(2)})       ${String(r.all).padStart(7)} (${String(r.an).padStart(2)})        ${String(Math.round((r.all / DATA.cap) * 100)).padStart(3)}%      ${String(r1(DATA.cap - r.all)).padEnd(8)}                           ${DATA.teamDead?.[r.s] ?? "?"} · ${DATA.teamCapUsed?.[r.s] ?? "?"}`)
const tot = rows.map(r => r.all)
console.log(`league: mean ${r1(tot.reduce((a, b) => a + b, 0) / tot.length)} · min ${Math.min(...tot)} · max ${Math.max(...tot)} (of $${DATA.cap}M)`)

// ── Outliers ─────────────────────────────────────────────────────────────────
const list = Object.values(P)
const show = (title, a, f) => { console.log(`\n${title} (${a.length})`); for (const p of a) console.log(`  ${p.name} ${p.team} ${p.pos}: ${f(p)}`) }
const fmt = p => `$${p.capHit}M hit · ${p.yearsLeft}y left (thru ${p.through}) · $${p.total}M total · $${p.apy}M APY${p.rookie ? ' · rookie' : ''}${p.status ? ` · ${p.status}` : ''}`
show('biggest 2026 cap hits', [...list].sort((a, b) => b.capHit - a.capHit).slice(0, 15), fmt)
show('estimated (est: true)', list.filter(p => p.est), p => `${fmt(p)} — ${p.note ?? ''}`)
show('cap hit far from APY (hit < 35% or > 200% of APY, APY $5M+)', list.filter(p => p.apy >= 5 && (p.capHit < p.apy * 0.35 || p.capHit > p.apy * 2)).sort((a, b) => b.apy - a.apy), fmt)
show('long deals (6+ years left)', list.filter(p => p.yearsLeft >= 6), fmt)
show('under the 2026 minimum ($0.885M)', list.filter(p => p.capHit < 0.885), fmt)
show('rookie deals over $10M a year', list.filter(p => p.rookie && p.apy > 10), fmt)
show('through and years left disagree', list.filter(p => p.through !== 2025 + p.yearsLeft), fmt)
show('joined in-season (full-year figure used)', list.filter(p => /in-season/.test(p.note ?? '')), fmt)
