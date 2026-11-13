// FRANCHISE engine check. Plays whole leagues on the autopilot and checks them every week.
//   bash scripts/franchise/run.sh scripts/franchise/check.mjs [seasons=20] [runs=3]
// Invariants (every week, every team): roster size and position minimums, the cap, no NaN or undefined in any
// stat, a valid schedule, 17 games a team, box scores that add up to the score, the same seed replaying the
// same way, a save that round-trips and plays on identically.
// Then the league's numbers against real NFL seasons, how long a week and an offseason take, and the save size.
import * as FR from '../../src/lib/franchise/index'
import { scheduleProblems } from '../../src/lib/franchise/schedule'
import { payroll } from '../../src/lib/franchise/money'
import { teamRating, activeCount, groupCounts } from '../../src/lib/franchise/core'
import { passerRating } from '../../src/lib/franchise/stats'
import { QBS, TYPES } from '../../src/data/qbs'
import { WRS, WR_TYPES } from '../../src/data/wrs'
import { RBS, RB_TYPES } from '../../src/data/rbs'
import { DLS, DL_TYPES } from '../../src/data/dls'
import { DBS, DB_TYPES } from '../../src/data/dbs'
import { OLS, OL_TYPES } from '../../src/data/ols'

const SEASONS = Number(process.argv[2] ?? 20), RUNS = Number(process.argv[3] ?? 3)
const MIN_AT = FR.LIMITS.MIN_AT
const problems = []
const fail = (run, F, msg) => { if (problems.length < 60) problems.push(`[${run}] ${F.year} wk${F.week} ${F.phase}${F.stage ? '/' + F.stage : ''}: ${msg}`) }

// a build the way the spins make one: each trait the best of a few real players
function buildFor(list, types, pos, seed, extra = {}) {
  let k = seed
  const rand = () => { k = (k * 16807) % 2147483647; return k / 2147483647 }
  const pool = list.filter(p => p.attrs)
  const b = Object.fromEntries(types.map(t => { const p = [0, 1, 2].map(() => pool[Math.floor(rand() * pool.length)]).sort((a, c) => (c.attrs[t] ?? 0) - (a.attrs[t] ?? 0))[0]; return [t, { type: t, val: p.attrs[t] ?? 5, qbFull: p.name, team: p.team }] }))
  if (b.size) Object.assign(b.size, extra)
  return { pos, build: b }
}
const BUILDS = [buildFor(QBS, TYPES, 'qb', 11), buildFor(WRS, WR_TYPES, 'wr', 12), buildFor(WRS, WR_TYPES, 'wr', 13), buildFor(RBS, RB_TYPES, 'rb', 14), buildFor(DLS, DL_TYPES, 'dl', 15, { subpos: 'edge' }), buildFor(DLS, DL_TYPES, 'dl', 16, { subpos: 'dt' }), buildFor(DBS, DB_TYPES, 'db', 17, { subpos: 'cb' }), buildFor(OLS, OL_TYPES, 'ol', 18, { subpos: 'LT' })]
const COACH = { name: 'Built Coach', build: Object.fromEntries(FR.COACH_TYPES.map((t, i) => [t, { type: t, val: 6 + (i % 4), qbFull: 'A Coach', team: 'KC' }])) }
const CONFIGS = [
  { team: 'KC', seed: 'check-a', builds: [] },
  { team: 'CHI', seed: 'check-b', builds: BUILDS },
  { team: 'NYJ', seed: 'check-c', builds: BUILDS.slice(0, 4), coach: COACH },
].slice(0, RUNS)

// the same thing whatever order the keys were written in
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x))
const strip = F => ({ ...F, flash: null, rev: 0 })
function finite(run, F, label, o) {
  for (const k in o) { const v = o[k]; if (typeof v === 'number' ? !Number.isFinite(v) : v === undefined || (v !== null && typeof v === 'object' && !Array.isArray(v) ? false : false)) fail(run, F, `${label}.${k} is ${v}`) }
}
function invariants(run, F) {
  const inSeason = F.phase !== 'offseason'
  for (const s in F.teams) {
    const t = F.teams[s], n = activeCount(F, t), c = groupCounts(F, t)
    if (inSeason && n > FR.LIMITS.ROSTER_MAX) fail(run, F, `${s} carries ${n}`)
    if (inSeason && n < FR.LIMITS.ROSTER_MIN) fail(run, F, `${s} carries only ${n}`)
    if (!inSeason && n > FR.LIMITS.CAMP_MAX) fail(run, F, `${s} carries ${n} in the offseason`)
    if (inSeason) for (const g in MIN_AT) if (c[g] < MIN_AT[g]) fail(run, F, `${s} has ${c[g]} ${g}`)
    if (F.settings.cap && payroll(F, t) > F.cap + 0.011) fail(run, F, `${s} is over the cap: ${payroll(F, t)} of ${F.cap}`)
    for (const id of t.roster) { const p = F.players[id]; if (!p) fail(run, F, `${s} roster has a missing player ${id}`); else if (p.team !== s) fail(run, F, `${p.name} is on ${s}'s roster but says ${p.team}`) }
    for (const k of ['hc', 'oc', 'dc']) if (inSeason && !F.coaches[t.staff[k]]) fail(run, F, `${s} has no ${k}`)
    if (t.st) finite(run, F, `${s}.st`, t.st)
    if (new Set(t.roster).size !== t.roster.length) fail(run, F, `${s} has a player twice`)
  }
  for (const id in F.players) {
    const p = F.players[id]
    finite(run, F, `${p.name}.s`, p.s); finite(run, F, `${p.name}.car`, p.car)
    if (!Number.isFinite(p.ovr) || !Number.isFinite(p.age) || !Number.isFinite(p.mood) || !Number.isFinite(p.wear ?? 0) || !Number.isFinite(p.xp ?? 0)) fail(run, F, `${p.name} has a bad number (ovr ${p.ovr} age ${p.age} mood ${p.mood} wear ${p.wear} xp ${p.xp})`)
    for (const t in p.a) if (!(p.a[t] >= 0 && p.a[t] <= 11)) fail(run, F, `${p.name} ${t} is ${p.a[t]}`)
    if (p.team && !p.con) fail(run, F, `${p.name} is on ${p.team} with no contract`)
    if (p.con && (!Number.isFinite(p.con.sal) || !Number.isFinite(p.con.guar) || !(p.con.yrs >= 0))) fail(run, F, `${p.name} has a bad contract ${JSON.stringify(p.con)}`)
    if (p.team && inSeason && p.con.yrs < 1) fail(run, F, `${p.name} is playing on an expired deal`)
  }
  for (const games of F.sched.weeks) for (const g of games) if (g.hs != null && (!Number.isFinite(g.hs) || !Number.isFinite(g.as))) fail(run, F, `a score is not a number`)
  // box scores add up
  for (const id in F.boxes ?? {}) {
    const b = F.boxes[id]
    for (let s = 0; s < 2; s++) {
      const rows = Object.values(b.box[s]), sum = k => rows.reduce((a, r) => a + (r[k] ?? 0), 0), tot = b.tot[s]
      const pts = (sum('rtd') + sum('ctd') + sum('krtd') + sum('dtd')) * 6 + sum('xpm') + tot.two * 2 + sum('fgm') * 3 + tot.saf * 2
      if (pts !== b.sc[s]) fail(run, F, `box ${id}: points ${pts} against a score of ${b.sc[s]}`)
      if (sum('py') !== sum('cy') || sum('pc') !== sum('rc') || sum('ptd') !== sum('ctd') || sum('pa') !== sum('tg')) fail(run, F, `box ${id}: passing and receiving disagree`)
      if (b.qs[s].reduce((a, x) => a + (x ?? 0), 0) !== b.sc[s]) fail(run, F, `box ${id}: quarters do not add to the score`)
    }
  }
}

const A = { seasons: 0, teamGames: 0, pf: 0, py: 0, ry: 0, pa: 0, pc: 0, sk: 0, int: 0, fgm: 0, fga: 0, p4000: 0, r1000: 0, c1000: 0, s10: 0, mvp: [], champRank: [], champs: {}, wins: [], bestWon: 0, ties: 0, injOut: 0, playoffRepeat: 0 }
const T = { week: [], off: [], save: [], pack: [] }
const drift = {}
function seasonStats(F, preRank) {
  // (called in the review stage: season stat lines are still on the players)
  const P = Object.values(F.players)
  for (const s in F.teams) { const st = F.teams[s].st; if (!st) continue; A.teamGames += st.g; A.pf += st.pf; A.py += st.py; A.ry += st.ry; A.sk += st.sk; A.wins.push(F.teams[s].last?.w ?? 0); if (st.g !== 17) problems.push(`${F.year}: ${s} played ${st.g} games`) }
  for (const p of P) { A.pa += p.s.pa ?? 0; A.pc += p.s.pc ?? 0; A.int += p.s.pi ?? 0; A.fgm += p.s.fgm ?? 0; A.fga += p.s.fga ?? 0 }
  A.p4000 += P.filter(p => (p.s.py ?? 0) >= 4000).length; A.r1000 += P.filter(p => (p.s.ry ?? 0) >= 1000).length; A.c1000 += P.filter(p => (p.s.cy ?? 0) >= 1000).length; A.s10 += P.filter(p => (p.s.sa ?? 0) >= 10).length
  const h = FR.history(F).seasons[0]
  if (h?.awards?.MVP) A.mvp.push(`${h.year} ${h.awards.MVP.name} (${h.awards.MVP.team}, ${h.awards.MVP.pos}): ${h.awards.MVP.line}`)
  const champ = h?.champion?.short
  if (champ) { A.champs[champ] = (A.champs[champ] ?? 0) + 1; A.champRank.push(preRank[champ]); if (preRank[champ] === 1) A.bestWon++ }
  A.seasons++
}

for (let run = 0; run < CONFIGS.length; run++) {
  const cfg = CONFIGS[run]
  const make = () => FR.createFranchise({ team: cfg.team, builds: cfg.builds, coach: cfg.coach, gmName: 'Check GM', seed: cfg.seed })
  let F = make()
  // the same seed builds the same league
  if (canon(strip(F)) !== canon(strip(make()))) problems.push(`[${run}] the same seed built two different leagues`)
  invariants(run, F)
  let twin = run === 0 ? make() : null      // played alongside for the first season: must stay identical
  for (let y = 0; y < SEASONS; y++) {
    const probs = scheduleProblems(F.sched.weeks.slice(0, 18), F.sched.bye)
    if (probs.length) problems.push(`[${run}] ${F.year} schedule: ${probs.slice(0, 3).join('; ')}`)
    const ratings = Object.fromEntries(Object.keys(F.teams).map(s => [s, teamRating(F, F.teams[s]).ovr]))
    const order = Object.keys(ratings).sort((a, b) => ratings[b] - ratings[a]), preRank = Object.fromEntries(order.map((s, i) => [s, i + 1]))
    if (run === 0 && [0, 4, 9, 14, 19].includes(y)) {
      const P = Object.values(F.players).filter(p => p.team)
      const top = (pos, n) => { const l = P.filter(p => p.pos === pos).map(p => p.ovr).sort((a, b) => b - a).slice(0, n); return (l.reduce((a, b) => a + b, 0) / l.length).toFixed(1) }
      drift[F.year] = `QB32 ${top('qb', 32)} · WR64 ${top('wr', 64)} · RB32 ${top('rb', 32)} · OL160 ${top('ol', 160)} · DL128 ${top('dl', 128)} · LB96 ${top('lb', 96)} · DB128 ${top('db', 128)} · all ${(P.reduce((a, p) => a + p.ovr, 0) / P.length).toFixed(1)} · age ${(P.reduce((a, p) => a + p.age, 0) / P.length).toFixed(1)} · cap $${F.cap}M · payroll avg $${(Object.values(F.teams).reduce((a, t) => a + payroll(F, t), 0) / 32).toFixed(0)}M`
    }
    let guard = 0
    while (F.phase !== 'offseason' && guard++ < 40) {
      const t0 = performance.now()
      F = FR.autopilot(F, { until: 'week' })
      T.week.push(performance.now() - t0)
      invariants(run, F)
      if (twin) twin = FR.autopilot(twin, { until: 'week' })
      // a save in the middle of the season: it must come back the same, and play on the same
      if (run === 0 && y === 0 && F.week === 9 && F.phase === 'regular') {
        const text = FR.packFranchise(F), back = FR.unpackFranchise(text)
        if (canon(strip(back)) !== canon(strip(JSON.parse(JSON.stringify(F))))) problems.push('a save did not round-trip')
        const a = FR.autopilot(back, { until: 'week' })
        const b = FR.autopilot(JSON.parse(JSON.stringify(F)), { until: 'week' })
        if (canon(strip(a)) !== canon(strip(b))) problems.push('a loaded save played a different week than the league it was saved from')
      }
    }
    if (twin) { if (canon(strip(twin)) !== canon(strip(F))) problems.push('the same seed and choices played two different seasons'); }
    seasonStats(F, preRank)
    const t0 = performance.now()
    guard = 0
    while (F.phase === 'offseason' && guard++ < 20) { F = FR.advanceStage(F, { auto: true }); invariants(run, F); if (twin) twin = FR.advanceStage(twin, { auto: true }) }
    T.off.push(performance.now() - t0)
    if (twin) { if (canon(strip(twin)) !== canon(strip(F))) problems.push('the same seed and choices played two different offseasons'); twin = null }
    const p0 = performance.now()
    const text = FR.packFranchise(F)
    T.pack.push(performance.now() - p0)
    T.save.push(text.length * 2 / 1024)
    if (y === SEASONS - 1 || y === 4) { const back = FR.unpackFranchise(text); if (!back || back.broken || canon(strip(back)) !== canon(strip(JSON.parse(JSON.stringify(F))))) problems.push(`[${run}] the save after ${y + 1} seasons did not round-trip`) }
  }
  const h = FR.history(F)
  console.log(`run ${run} (${cfg.team}, ${cfg.builds.length} builds${cfg.coach ? ', built coach' : ''}): GM ${h.gm.record}, playoffs ${h.gm.playoffs}, ${h.gm.rings} rings, fired ${F.gm.fired}, now with ${F.team}, security ${Math.round(F.gm.security)}, legacy ${h.gm.legacy}; hall ${h.hall.length}; players ${Object.keys(F.players).length}; coaches ${Object.keys(F.coaches).length}`)
}

const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), max = a => Math.max(...a)
const sorted = [...T.week].sort((a, b) => a - b)
const tg = A.teamGames, N = A.seasons
const row = (label, v, target) => console.log(label.padEnd(36), String(v).padStart(9), '   target', target)
console.log(`\nREALISM  (${N} seasons, ${tg / 2} regular-season games)`)
row('points / team game', (A.pf / tg).toFixed(2), '22-23')
row('pass yds (net) / team game', (A.py / tg).toFixed(1), '215-225')
row('rush yds / team game', (A.ry / tg).toFixed(1), '113-122')
row('completion %', (A.pc / A.pa * 100).toFixed(1), '64.5-65.5')
row('sacks / team game', (A.sk / tg).toFixed(2), '2.3-2.6')
row('interceptions / team game', (A.int / tg).toFixed(2), '0.72-0.82')
row('field goal %', (A.fgm / A.fga * 100).toFixed(1), '84-86')
row('4,000-yard passers / season', (A.p4000 / N).toFixed(1), '8-11')
row('1,000-yard rushers / season', (A.r1000 / N).toFixed(1), '12-16')
row('1,000-yard receivers / season', (A.c1000 / N).toFixed(1), '22-28')
row('double-digit sack men / season', (A.s10 / N).toFixed(1), '15-22')
const wm = avg(A.wins), sd = Math.sqrt(avg(A.wins.map(w => (w - wm) ** 2)))
row('std dev of team wins', sd.toFixed(2), '3.0-3.2')
row('best roster won the Super Bowl', `${(A.bestWon / N * 100).toFixed(0)}%`, '10-20%')
row('champion\'s preseason roster rank', avg(A.champRank).toFixed(1), '4-7 (top ten ~80%)')
row('champion from the top ten', `${(A.champRank.filter(r => r <= 10).length / N * 100).toFixed(0)}%`, '70-85%')
row('different champions', `${Object.keys(A.champs).length}`, `of ${N} titles`)
console.log('titles:', Object.entries(A.champs).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(' '))
console.log('\nMVP lines:'); for (const l of A.mvp.slice(0, 24)) console.log('  ' + l)
console.log('\nLEAGUE OVER TIME (run 0)'); for (const y in drift) console.log(`  ${y}: ${drift[y]}`)
console.log('\nPERFORMANCE')
console.log(`  advance a week: avg ${avg(T.week).toFixed(1)} ms, median ${sorted[Math.floor(sorted.length / 2)].toFixed(1)} ms, 95th ${sorted[Math.floor(sorted.length * 0.95)].toFixed(1)} ms, worst ${max(T.week).toFixed(0)} ms`)
console.log(`  an offseason (8 stages): avg ${avg(T.off).toFixed(0)} ms, worst ${max(T.off).toFixed(0)} ms`)
console.log(`  save: ${T.save[0].toFixed(0)} KB after one season, ${avg(T.save).toFixed(0)} KB on average, ${max(T.save).toFixed(0)} KB at the largest; packing takes ${avg(T.pack).toFixed(0)} ms`)
console.log(`\nPROBLEMS: ${problems.length}`)
for (const p of problems.slice(0, 40)) console.log('  ' + p)
process.exitCode = problems.length ? 1 : 0
