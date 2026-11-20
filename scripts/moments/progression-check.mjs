// Career progression at the top end, end to end through lib/career.js (loaded the way the app loads it, through Vite):
// whole football and basketball careers played the way an engaged player plays them (the combine run decently, the
// season's cards taken, the bye week trained, camp played, every development point spent, the deal re-signed), from
// the draft to retirement. Two kinds of player:
//   free  an engaged free player: a Hot Hand now and then (the free pass track has one), Quick Heal never
//   buyer a pass / Pro buyer who uses every boost: a Hot Hand whenever one can run, Quick Heal on every injury
// Prints, by position: the median and 10th-percentile season (and age) of his first S earned (a trait that wasn't S
// when he was built), half his traits at S, and all of them at S; the share of careers that ever get to all-S; and
// where the top-end grades (to A+ and to S) came from. Then the season of his third S, the development points earned a
// season (by age and by the build's starting overall), and the numbers from before the 2026-11-16 change, for
// comparison. PROG_SPINS=n makes each build the best of n spins a trait (6, the default; 1 or 2 for a weaker build).
// Run from the repo root:  node scripts/moments/progression-check.mjs [careers-per-position] [free|buyer|both] [qb,rb,...]
// (30 a position, both kinds, takes about an hour and a half on three processes split by position; 8 a position, free,
// a quick look. Soccer and baseball careers run on the same engine: name them (st, bat, pit). PROG_TRACE=1 prints
// each season's build; PROG_OUT=file.json writes every career's result.)
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const { valToGrade } = await server.ssrLoadModule('/src/utils/simulation.js')
const SX = { soccer: await server.ssrLoadModule('/src/lib/careerSoccer.js') }
const N = Number(process.argv[2] ?? 30)
const WHO = process.argv[3] ?? 'both'
const ONLY = process.argv[4] ? process.argv[4].split(',') : null
// PROG_SPINS=n: each trait the best of n spun players (6, the default: an engaged builder; 1 or 2: a weaker build)
const SPINS = Number(process.env.PROG_SPINS ?? 6)

// a build the way a player makes one: for each trait, the best of six spun players
const buildFor = (S, pos, r) => {
  const pool = S.pool[pos].filter(p => p.attrs), b = {}
  for (const t of S.types[pos]) {
    let p = pool[Math.floor(r() * pool.length)]
    for (let j = 0; j < SPINS - 1; j++) { const q = pool[Math.floor(r() * pool.length)]; if ((q.attrs?.[t] ?? 0) > (p.attrs?.[t] ?? 0)) p = q }
    b[t] = { type: t, val: p.attrs?.[t] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, pos: p.pos }
  }
  return b
}
const S_ = v => Math.round(v ?? 0) >= 11
// the traits a career can move at all (a lineman's frame never does)
const FRAME = { dl: ['size'], lb: ['size'], ol: ['size', 'length'] }
const movable = c => c.types.filter(t => !(FRAME[c.pos] ?? []).includes(t))

// every point spent, the way an engaged player spends them: a trait about to slip held (or a slipped one won back)
// first, then the window that shuts soonest, then the trait closest to S; body work when nothing else takes a point
function spend(c, tally) {
  for (let guard = 0; guard < 60 && c.dev.points > 0; guard++) {
    const open = c.types.filter(t => C.canUpgrade(c, t))
    if (!open.length) { if (C.canBodyWork(c) && (c.durability ?? 5) < 8) { c = C.bodyWork(c); continue } break }
    const key = t => { const w = C.vetWork(c, t), win = C.trainWindow(c, t); return [w ? 0 : 1, win?.open ? win.left : 99, -(c.build[t].val ?? 0)] }
    open.sort((a, b) => { const x = key(a), y = key(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] })
    const t = open[0], from = Math.round(c.build[t].val), work = C.vetWork(c, t)
    const cost = C.upgradeCost(c.build[t].val, c, t)
    c = C.spendDev(c, t)
    if (!work) tally.add('spend', from, Math.round(c.build[t].val), cost)
  }
  return c
}
function makeTally() {
  const top = {}, pts = {}
  return {
    top, pts,
    add(src, from, to, cost = 0) { if (to > from && to >= 10) { const k = `${src}:${valToGrade(to)}`; top[k] = (top[k] ?? 0) + 1; if (cost) top[`${k}:pts`] = (top[`${k}:pts`] ?? 0) + cost } },
    earn(src, n) { if (n > 0) pts[src] = (pts[src] ?? 0) + n },
  }
}
const diffUp = (a, b, types) => types.filter(t => Math.round(b[t]?.val ?? 0) > Math.round(a[t]?.val ?? 0)).map(t => [t, Math.round(a[t].val), Math.round(b[t].val)])

function playCareer(sport, pos, i, who, tally) {
  const S = C.SPORT[sport]
  const r = seeded(`prog-${sport}-${pos}-${i}`)
  const rnd = Math.random
  Math.random = r   // (newCareer's seed: the same careers every run)
  let c
  try { c = C.newCareer({ sport, pos, build: buildFor(S, pos, seeded(`prog-b-${sport}-${pos}-${i}`)), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 }) } finally { Math.random = rnd }
  const start = Object.fromEntries(c.types.map(t => [t, S_(c.build[t].val)])), ovr0 = c.ovr
  const mv = movable(c)
  for (const d of c.draft.combine) c = C.recordCombine(c, d.id, 0.55 + r() * 0.35)
  c = C.runDraft(c)
  if (!c.team && c.draft?.offers?.length && SX[sport]?.signAcademy) c = SX[sport].signAcademy(c, c.draft.offers[0])
  const line = []   // per season: { n, age, s (S count, movable), earned (an S that wasn't one at the start), pts (points earned since the last offseason's spending) }
  let banked = c.dev.points
  for (let yr = 0; yr < 26; yr++) {
    let D; [c, D] = C.startSeason(c)
    let hots = who === 'buyer' ? 99 : r() < 0.3 ? 1 : 0
    for (let g = 0; g < 1500 && c.phase === 'season' && c.active.k < D.total; g++) {
      if (C.byeNow(c)) {
        const game = C.byeDrill(c)
        if (game && !C.byeHurt(c, D)) {
          const score = 0.45 + r() * 0.5, before = c.build
          c = C.byeTrain(c, D, game, score, score >= 0.65, false)
          for (const [, f, t] of diffUp(before, c.build, c.types)) tally.add('bye', f, t)
        } else c = C.byeRest(c, D)
        continue
      }
      if (c.active.injury) { c = C.resolveInjury(c, D, false, who === 'buyer')[0]; continue }
      if (c.active.moment) { c = C.chooseMoment(c, D, c.active.moment.options[0])[0]; continue }
      if (hots > 0 && c.active.k >= 2 && C.canHotHand(c, D)) { c = C.hotHand(c, D); hots-- }
      c = C.advanceWeek(c, D)[0]
    }
    if (c.phase === 'season') c = C.finishRegular(c, D)
    for (let g = 0; g < 12 && c.phase === 'season' && c.active?.po && c.active.po.stage !== 'done'; g++) {
      const po = c.active.po, game = C.playoffGame(c, po)
      const hit = r() < C.momentHitRate(c, game)
      c = C.playoffRound(c, hit ? 0.7 : 0.35, game, hit, null)
    }
    if (c.phase === 'season') c = C.bookSeason(c)
    const s = c.seasons[c.seasons.length - 1]
    line.push({ n: c.seasons.length, age: s.age, s: mv.filter(t => S_(c.build[t].val)).length, earned: mv.some(t => S_(c.build[t].val) && !start[t]) })
    if (process.env.PROG_TRACE) console.log('TRACE', pos, i, 'season', c.seasons.length, 'age', s.age, 'pts', c.dev.points, c.types.map(t => `${t}:${Math.round(c.build[t].val)}${c.build[t].upgraded ? '+' + c.build[t].upgraded : ''}`).join(' '), s.award ? 'AWARD' : '', s.allPro ? 'ALLPRO' : '')
    // the points this season paid, by where they came from
    const S0 = C.sportOf(c), base = c.age <= S0.devYoung(c.pos) ? 2 : c.age < S0.devPrime(c.pos) ? 1 : 0
    tally.earn('season', base); tally.earn('award', s.award || s.roy ? 1 : 0); tally.earn('allPro', s.allPro && !S0.isSoccer ? 1 : 0)
    const ev = c.events[c.events.length - 1]
    if (ev?.id === 'mentor' && ev.year === c.year + 1) tally.earn('mentor', 1)
    // camp
    const cs = 0.5 + r() * 0.45
    { const was = c.dev.points; c = C.campDrill(c, cs, null, cs >= 0.65); tally.earn('camp', c.dev.points - was) }
    line[line.length - 1].pts = c.dev.points - banked
    c = spend(c, tally)
    banked = c.dev.points
    if (C.mustRetire(c)) break
    if (Array.isArray(c.offers)) {
      if (!c.offers.length) break
      c = C.signOffer(c, c.offers.find(o => o.kind === 'stay') ?? c.offers[0])
    }
    if (C.mustRetire(c) || c.contract.left <= 0) break
    const before = c.build
    c = C.nextSeason(c)
    for (const [, f, t] of diffUp(before, c.build, c.types)) tally.add('natural', f, t)
    // (a point spent after aging: the next offseason's spending happens before it, so nothing here)
  }
  const at = pred => line.find(pred) ?? null
  const half = Math.ceil(mv.length / 2)
  return {
    first: at(x => x.earned), third: at(x => x.s >= 3), half: at(x => x.s >= half), all: at(x => x.s >= mv.length),
    ovr0, pts: line.map(x => ({ age: x.age, n: x.n, pts: x.pts ?? 0 })),
    startS: mv.filter(t => start[t]).length, types: mv.length, seasons: line.length, peakS: Math.max(0, ...line.map(x => x.s)),
  }
}

const q = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))] }
const cell = (rs, k) => {
  const hit = rs.map(x => x[k]).filter(Boolean)
  if (!hit.length) return '   never   '
  // (the median and the 10th percentile over the careers that got there; the share that got there beside it)
  const yrs = hit.map(x => x.n), ages = hit.map(x => x.age)
  return `${String(q(yrs, 0.5)).padStart(2)}/${String(q(yrs, 0.1)).padStart(2)} @${q(ages, 0.5)} ${String(Math.round((100 * hit.length) / rs.length)).padStart(3)}%`
}
// BEFORE: the same 30 careers a position (the same seeds, both kinds of player), run on the rules before 2026-11-16
// (1 point a grade, 2 for A+ to S, the free grades unchecked). Columns: median season / 10th-percentile season @ the
// median age, and the share of careers that got there. peak: the most S grades he ever held, of his movable traits.
const BEFORE = `
free:qb      peak 6.9 / 9 | first 2/2 @23 100%     | half 7/4 @27 97%      | all 8/7 @28 17%
free:rb      peak 3.6 / 9 | first 2/2 @23 100%     | half 5/4 @25 20%      | all never
free:wr      peak 7.3 / 9 | first 2/2 @22 100%     | half 5/3 @25 97%      | all 7/7 @28 30%
free:te      peak 4.8 / 9 | first 2/2 @23 100%     | half 6/4 @27 57%      | all never
buyer:qb     peak 8.2 / 9 | first 2/2 @23 100%     | half 5/4 @26 100%     | all 9/6 @29 50%
buyer:rb     peak 4.8 / 9 | first 2/2 @22 100%     | half 4/4 @25 53%      | all never
buyer:wr     peak 8.2 / 9 | first 2/2 @22 100%     | half 4/3 @24 100%     | all 7/5 @28 47%
buyer:te     peak 6.9 / 9 | first 2/2 @23 100%     | half 6/4 @26 90%      | all 8/7 @28 17%
free:db      peak 5.4 / 9 | first 2/2 @23 100%     | half 5/4 @26 70%      | all 6/6 @26 3%
free:dl      peak 6.6 / 8 | first 2/2 @23 100%     | half 4/3 @25 93%      | all 7/6 @27 40%
free:lb      peak 5.2 / 8 | first 2/2 @23 100%     | half 5/4 @26 80%      | all 6/6 @26 3%
free:ol      peak 6.5 / 7 | first 2/2 @23 100%     | half 5/4 @26 100%     | all 9/7 @30 73%
buyer:db     peak 6.3 / 9 | first 2/2 @23 100%     | half 5/3 @25 93%      | all 7/6 @28 7%
buyer:dl     peak 7.2 / 8 | first 2/2 @23 100%     | half 4/3 @24 97%      | all 6/5 @26 47%
buyer:lb     peak 6.4 / 8 | first 2/2 @22 100%     | half 5/3 @25 97%      | all 7/7 @27 10%
buyer:ol     peak 6.9 / 7 | first 2/2 @23 100%     | half 4/3 @25 100%     | all 8/6 @29 93%
free:k       peak 2.4 / 3 | first 2/2 @23 100%     | half 3/2 @23 97%      | all 3/2 @24 47%
free:guard   peak 4.4 / 10 | first 2/2 @21 100%     | half 7/5 @25 47%      | all never
free:big     peak 4.2 / 10 | first 2/2 @21 100%     | half 7/4 @26 47%      | all never
buyer:k      peak 2.4 / 3 | first 2/1 @23 100%     | half 3/1 @23 97%      | all 3/2 @24 47%
buyer:guard  peak 5.4 / 10 | first 2/2 @21 100%     | half 6/5 @25 60%      | all never
buyer:big    peak 5.0 / 10 | first 2/2 @21 100%     | half 7/4 @26 57%      | all never
ALL free                 | first 2/2 @22 100%     | half 5/3 @25 73%      | all 7/3 @28 19% | all by s6 22 of 330
ALL buyer                | first 2/2 @22 100%     | half 4/3 @25 86%      | all 7/3 @28 29% | all by s6 35 of 330
`
const CASES = [['nfl', 'qb'], ['nfl', 'rb'], ['nfl', 'wr'], ['nfl', 'te'], ['nfl', 'db'], ['nfl', 'dl'], ['nfl', 'lb'], ['nfl', 'ol'], ['nfl', 'k'], ['bucket', 'guard'], ['bucket', 'big']]
// (soccer and baseball careers run on the same engine; both are hidden, so only when asked for by name: st, bat, pit)
if (ONLY) CASES.push(['soccer', 'st'], ['baseball', 'bat'], ['baseball', 'pit'])
const out = {}
for (const who of WHO === 'both' ? ['free', 'buyer'] : [WHO]) {
  const tally = makeTally(), all = []
  console.log(`\n── ${who.toUpperCase()} · ${N} careers a position ──  season median/10th pct @ median age, share of careers that got there`)
  console.log('pos     start S  peak S   first S earned        half S              all S')
  for (const [sport, pos] of CASES) {
    if (ONLY && !ONLY.includes(pos)) continue
    if (C.ensureSport) await C.ensureSport(sport)
    const rs = []
    for (let i = 0; i < N; i++) { try { rs.push(playCareer(sport, pos, i, who, tally)) } catch (e) { console.log('FAILED', sport, pos, i, e.stack.split('\n').slice(0, 3).join(' | ')) } }
    all.push(...rs)
    out[`${who}:${pos}`] = rs
    const avg = k => (rs.reduce((s, x) => s + x[k], 0) / Math.max(1, rs.length)).toFixed(1)
    console.log(`${pos.padEnd(6)}  ${avg('startS').padStart(4)}/${rs[0]?.types}  ${avg('peakS').padStart(5)}   ${cell(rs, 'first').padEnd(20)}  ${cell(rs, 'half').padEnd(18)}  ${cell(rs, 'all')}`)
  }
  console.log(`ALL     ${''.padStart(12)}   ${cell(all, 'first').padEnd(20)}  ${cell(all, 'half').padEnd(18)}  ${cell(all, 'all')}`)
  const early = all.filter(x => x.all && x.all.n <= 6).length, early8 = all.filter(x => x.all && x.all.n < 8).length
  console.log(`all-S by season 6: ${early} of ${all.length} · before season 8: ${early8}`)
  console.log(`third S: ${cell(all, 'third')}`)
  // points a season (earned between one offseason's spending and the next: the season, honors, camp, events)
  const P = all.flatMap(x => x.pts), mean = xs => (xs.length ? (xs.reduce((s, v) => s + v, 0) / xs.length).toFixed(2) : '-')
  const band = (lo, hi) => P.filter(p => p.age >= lo && p.age <= hi).map(p => p.pts)
  console.log(`points a season: all ${mean(P.map(p => p.pts))} · age <=23 ${mean(band(0, 23))} · 24-27 ${mean(band(24, 27))} · 28-31 ${mean(band(28, 31))} · 32+ ${mean(band(32, 99))} · seasons 1-5 ${mean(P.filter(p => p.n <= 5).map(p => p.pts))} · max ${Math.max(...P.map(p => p.pts))}`)
  const q3 = all.map(x => x.ovr0).sort((a, b) => a - b), lo = q3[Math.floor(q3.length / 3)], hi = q3[Math.floor((2 * q3.length) / 3)]
  const byQ = f => mean(all.filter(x => f(x.ovr0)).flatMap(x => x.pts.filter(p => p.n <= 8).map(p => p.pts)))
  console.log(`points a season, seasons 1-8, by start OVR: low (<${lo}) ${byQ(o => o < lo)} · mid ${byQ(o => o >= lo && o < hi)} · high (>=${hi}) ${byQ(o => o >= hi)}`)
  out[`${who}:ALL-points`] = P
  console.log('top-end grades by source (count, points paid):', Object.entries(tally.top).filter(([k]) => !k.endsWith(':pts')).map(([k, n]) => `${k} ${n}${tally.top[`${k}:pts`] ? ` (${tally.top[`${k}:pts`]} pts)` : ''}`).join(' · '))
  console.log('points earned by source:', Object.entries(tally.pts).map(([k, n]) => `${k} ${n}`).join(' · '))
}
console.log('\n── BEFORE (the rules up to 2026-11-16, 30 careers a position) ──' + BEFORE)
if (process.env.PROG_OUT) (await import('node:fs')).writeFileSync(process.env.PROG_OUT, JSON.stringify(out))
await server.close()
process.exit(0)
