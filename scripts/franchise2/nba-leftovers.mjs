// NBA Franchise: the fix round's leftovers, wired at the merge, headless.
//   FR_TMP=<tmp> bash scripts/franchise2/run.sh scripts/franchise2/nba-leftovers.mjs
// Checks: the owner's payroll ceiling in the GM's trades (a deal that adds salary stops at it; one that cuts payroll
// goes; the league's teams have none), a matched offer sheet (no trade to the team that signed him to it, through the
// next summer's free agency), the receiving team's three two-way spots, a drafted two-way man's trade lock text, the
// draft's two-way intent honoured by rookieDeal, the build cap note (each build read off the ones before him), and
// the lottery's labels (F.lot.drawn and balls).
import * as N from '../../src/lib/franchise2/nba/index'
import * as T from '../../src/lib/franchise2/nba/trades'
import * as K from '../../src/lib/franchise2/nba/contracts'
const C = N.CAP_SIM
const L = (...a) => console.log(...a)
let bad = 0
const ok = (c, msg) => { L(`${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) bad++ }
const clone = F => N.unpackNba(N.packNba(F))
const F0 = N.createNbaFranchise({ seed: 'qa-leftovers', team: 'WAS', owner: 'G' })
const std = (F, s) => F.teams[s].r.filter(p => !p.tw && !p.ntc && !C.whyNot(F, s, p))
const year = F => C.capYear(F)

// ── 1. the owner's ceiling ───────────────────────────────────────────────────
{
  const F = clone(F0)
  // (a team whose owner stops at the tax line: under the first apron's hard cap, so the owner's rule is the one met)
  F.team = N.SHORTS.find(s => { F.team = s; return C.ownerCap(F).k === 'tax' }) ?? F.team
  const o = C.ownerCap(F)
  L(`\n1. ${F.team} (${o.sit}) payroll ${C.payroll(F, F.team)}, ceiling ${o.$} (${o.k})`)
  // (push the GM's payroll to just under his ceiling, then take on a man for nothing; a big man in, a small one out)
  const filler = F.teams[F.team].r.filter(p => !p.tw).sort((a, b) => b.$ - a.$)[0]
  filler.$ = Math.max(1, filler.$ + (o.$ - 1) - C.payroll(F, F.team)); filler.ntc = 1
  ok(Math.abs(C.payroll(F, F.team) - (o.$ - 1)) < 0.2, `payroll set to ${C.payroll(F, F.team)} (a $1M under the ceiling)`)
  let hit = null
  for (const s of N.SHORTS) {
    if (s === F.team) continue
    const big = std(F, s).find(p => p.$ >= 8 && p.$ <= 20)
    const mine = std(F, F.team).filter(p => p.$ < big?.$ - 3 && p !== filler).sort((a, b) => b.$ - a.$)[0]
    if (!big || !mine) continue
    const deal = { a: F.team, b: s, ga: [mine.i], gb: [big.i], pa: [], pb: [] }
    const r = C.checkTrade(F, deal)
    if (r.k === 'owner') { hit = { deal, r, big, mine }; break }
    if (process.env.V) L('   ', s, r.k, r.why)
  }
  ok(!!hit, `a deal that adds salary past the ceiling is refused: "${hit?.r.why}"`)
  if (hit) {
    ok(hit.r.why === o.why, 'the message is ownerCap\'s why')
    const back = { ...hit.deal, ga: [hit.mine.i], gb: [] }
    const r2 = C.checkTrade(F, back)
    ok(r2.k !== 'owner', `the same man out for nothing is not stopped by the owner (${r2.ok ? 'ok' : r2.why})`)
    const free = clone(F); free.noCap = 1
    ok(C.checkTrade(free, hit.deal).k !== 'owner', 'no cap rule: no owner ceiling')
  }
  // (the league's teams: a CPU-CPU deal is never refused for an owner)
  let cpu = 0, owner = 0
  for (let k = 0; k < 29; k++) {
    const a = N.SHORTS.filter(s => s !== F.team)[k], b = N.SHORTS.filter(s => s !== F.team)[(k + 1) % 29]
    const x = std(F, a)[0], y = std(F, b).sort((p, q) => q.$ - p.$)[0]
    if (!x || !y) continue
    const r = C.checkTrade(F, { a, b, ga: [x.i], gb: [y.i], pa: [], pb: [] }); cpu++
    if (r.k === 'owner') owner++
  }
  ok(cpu > 20 && owner === 0, `${cpu} CPU-CPU deals checked, ${owner} refused for an owner`)
}

// ── 2. a matched offer sheet ─────────────────────────────────────────────────
{
  const F = clone(F0)
  const s = 'BOS', to = 'NYK', other = 'CHI'
  const p = std(F, s).sort((a, b) => a.$ - b.$)[3]
  p.osm = { s: to, y: year(F) }
  const back = x => std(F, x).find(q => Math.abs(q.$ - p.$) < 3)
  const r1 = C.checkTrade(F, { a: s, b: to, ga: [p.i], gb: [back(to).i], pa: [], pb: [] })
  ok(!r1.ok && /offer sheet/.test(r1.why) && r1.why.includes(to), `this league year, to ${to}: "${r1.why}"`)
  const r2 = C.checkTrade(F, { a: s, b: other, ga: [p.i], gb: [back(other).i], pa: [], pb: [] })
  ok(!r2.ok && /matched/.test(r2.why), `this league year, to ${other}: "${r2.why}"`)
  // (the next league year: the summer's free agency still blocks the sheet's team, not the rest)
  const G = clone(F)
  const q = G.teams[s].r.find(x => x.i === p.i)
  G.phase = 'off'; G.off = { step: 'fa' }; G.sed = G.year
  q.osm = { s: to, y: year(G) - 1 }
  ok(T.sheetLockTo(G, q, to) != null, 'next summer\'s free agency: still not to the sheet\'s team')
  ok(T.sheetLockTo(G, q, other) == null, 'next summer\'s free agency: another team is fine')
  G.off.step = 'camp'
  ok(T.sheetLockTo(G, q, to) == null, 'camp, a year on: open to the sheet\'s team again')
}

// ── 3. two-way men: the receiving team's three ───────────────────────────────
{
  const F = clone(F0)
  const a = N.SHORTS.find(s => s !== F.team && F.teams[s].r.some(p => p.tw && !C.whyNot(F, s, p)))
  const tw = F.teams[a].r.find(p => p.tw && !C.whyNot(F, a, p))
  const b = N.SHORTS.find(s => s !== a && s !== F.team && F.teams[s].r.filter(p => p.tw).length === 3)
  L(`\n3. ${a} two-way ${tw?.n} to ${b} (${F.teams[b]?.r.filter(p => p.tw).length} two-way)`)
  if (tw && b) {
    const r = C.checkTrade(F, { a, b, ga: [tw.i], gb: [], pa: [], pb: [] })
    ok(!r.ok && /two-way/.test(r.why), `a fourth two-way man is refused: "${r.why}"`)
    const out = F.teams[b].r.find(p => p.tw && !C.whyNot(F, b, p))
    const r2 = C.checkTrade(F, { a, b, ga: [tw.i], gb: [out.i], pa: [], pb: [] })
    ok(r2.k !== 'roster', `one for one keeps three (${r2.ok ? 'ok' : r2.why})`)
  } else ok(false, 'found a two-way man and a team with three')
}

// ── 4. a drafted two-way man: his lock, and the draft's intent ───────────────
{
  const F = clone(F0)
  F.phase = 'off'; F.off = { step: 'fa' }
  const s = 'MIA'
  const p = { i: F.nid++, n: 'Test Rookie', p: 'SG', g: 'guard', o: 60, ag: 21, ys: 0, dr: [F.year + 1, 2, 48, s] }
  F.teams[s].r = F.teams[s].r.filter(x => !x.tw)
  F.teams[s].r.push(p)
  K.rookieDeal(F, p, { n: 48, r: 2, tw: true })
  ok(p.tw === 1, `rookieDeal(..., { tw: true }) gives a two-way deal (tw ${p.tw}, $${p.$}M x ${p.y})`)
  const w = C.whyNot(F, s, p)
  ok(/two-way contract/.test(w ?? ''), `his lock reads: "${w}"`)
  const q = { i: F.nid++, n: 'Test Second', p: 'PF', g: 'big', o: 62, ag: 21, ys: 0, dr: [F.year + 1, 2, 50, s] }
  F.teams[s].r = F.teams[s].r.filter(x => x.tw || F.teams[s].r.filter(y => !y.tw).indexOf(x) < 13)
  F.teams[s].r.push(q)
  K.rookieDeal(F, q, { n: 50, r: 2, tw: false })
  ok(!q.tw, `rookieDeal(..., { tw: false }) at No. 50 with room: a standard deal (${q.ng ? 'non-guaranteed ' : ''}$${q.$}M x ${q.y})`)
}

// ── 5. the build cap note ────────────────────────────────────────────────────
{
  const P = { seed: 'preview', nid: 1, year: N.FIRST_YEAR }
  N.buildTeams(P, { dealOnLoad: C.dealOnLoad })
  let shown = 0
  for (const s of N.SHORTS) {
    const F = { ...P, team: s }
    const a = N.buildCapNote(F, 90), b = N.buildCapNote(F, 90, a.add)
    if (Math.abs(b.before.pay - a.after.pay) > 0.11) { ok(false, `${s}: the second build starts where the first left (${a.after.pay} vs ${b.before.pay})`); break }
    if (a.after.over !== a.before.over && ['tax', 'a1', 'a2'].includes(a.after.over)) { shown++; if (shown === 1) L(`   ${s}: ${a.text}`) }
  }
  ok(true, `the second build reads off the first's payroll (all 30 teams); ${shown} teams cross the tax or an apron with a 90 build`)
}

// ── 6. the lottery's labels ──────────────────────────────────────────────────
{
  const F = clone(F0)
  // (a finished regular season and play-in by hand is long; the 2019 system's run on records alone is enough for
  // its fields, and the 3-2-1's are read in nba-players.mjs / the season sims)
  F.year = 2025
  N.runLottery(F)
  ok(F.lot.sys === '2019' && F.lot.drawn === 4 && F.lot.balls === 1000 && F.lot.lottery.length === 14, `2026 draft: sys ${F.lot.sys}, ${F.lot.lottery.length} teams, ${F.lot.balls} combinations, ${F.lot.drawn} drawn`)
}

L(bad ? `\n${bad} FAILED` : '\nall ok')
process.exit(bad ? 1 : 0)
