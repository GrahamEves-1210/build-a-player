// Basketball Career's free agency board: the title odds it shows on each team (lib/career.js titleOdds) against how
// often he really wins the title there. Careers at every strength sign with a team (any of the thirty), the odds are
// read the way the board reads them, then the season is played the way the Career screen plays it (decisions taken,
// injuries, the director's re-runs, the bracket with its moments at the build's usual rate) and the title counted.
// Also, for comparison, the board's old word for each team (its own rating with nobody on it: teamFit's status).
// Then the board itself, the way the old one read it: for careers at the end of a deal, every team the old board called a
// 'Contender' (its rating with nobody on it), and how often his own team, with him on it, was the better shot.
// Run from the repo root:  node scripts/moments/titleodds-check.mjs [seasons] [boards] (STRONG=1: good builds on good teams)
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const N = Number(process.argv[2] ?? 300), NB = Number(process.argv[3] ?? 0), STRONG = !!process.env.STRONG
const S = C.SPORT.bucket
const buildFor = (pos, r, best) => {
  const pool = S.pool[pos].filter(p => p.attrs), b = {}
  for (const t of S.types[pos]) {
    let p = pool[Math.floor(r() * pool.length)]
    for (let j = 1; j < best; j++) { const q = pool[Math.floor(r() * pool.length)]; if ((q.attrs?.[t] ?? 0) > (p.attrs?.[t] ?? 0)) p = q }
    b[t] = { type: t, val: p.attrs?.[t] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, pos: p.pos }
  }
  return b
}
function playSeason(c0) {
  let c = c0, D
  ;[c, D] = C.startSeason(c)
  let guard = 0
  while (c.active.k < D.total && guard++ < 900) {
    if (c.active.injury) { const [n] = C.resolveInjury(c, D, false, false); c = n; continue }
    if (c.active.moment) { const [n] = C.chooseMoment(c, D, c.active.moment.options[0]); c = n; continue }
    const [n] = C.advanceWeek(c, D); c = n
  }
  c = C.finishRegular(c, D)
  for (let g = 0; g < 8 && c.active?.po && c.active.po.stage !== 'done'; g++) {
    const po = c.active.po, game = C.playoffGame(c, po)
    const hit = seeded(`mg-sim-${c.seed}-${c.year}-${po.idx}`)() < C.momentHitRate(c, game)
    c = C.playoffRound(c, hit ? 0.7 : 0.3, game, hit, null)
  }
  if (c.phase === 'offseason') return !!c.seasons.at(-1)?.champion
  return !!c.active?.po?.won
}
const bands = {}, words = {}
let brier = 0, n = 0, sumP = 0, sumW = 0
const t0 = Date.now()
for (let i = 0; i < N; i++) {
  const pos = i % 2 ? 'big' : 'guard', r = seeded(`to-${i}`)
  let c = C.newCareer({ sport: 'bucket', pos, build: buildFor(pos, r, STRONG ? 4 + (i % 3) : 1 + (i % 6)), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 })
  c = C.skipCombine(c); c = C.runDraft(c)
  const ranked = [...S.teams].map(t => S.teamOf(t.short)).sort((a, b) => b.off + b.def - a.off - a.def)
  const to = (STRONG ? ranked.slice(0, 12) : ranked)[Math.floor(r() * (STRONG ? 12 : ranked.length))].short
  if (to !== c.team) c = C.signOffer(c, { team: to, fit: C.teamFit(to, pos, { sport: 'bucket', name: c.name }), years: 2, perYear: 5 })
  const shown = C.titleOdds(c, c.team)
  const old = C.teamFit(c.team, pos, { roster: c.roster, league: c.league, name: c.name, sport: 'bucket' }).status
  const won = playSeason(c)
  n++; sumP += shown; sumW += won ? 1 : 0; brier += (shown - (won ? 1 : 0)) ** 2
  const b = shown < 0.02 ? '0-2' : shown < 0.06 ? '2-6' : shown < 0.12 ? '6-12' : shown < 0.2 ? '12-20' : shown < 0.3 ? '20-30' : shown < 0.45 ? '30-45' : '45+'
  const x = (bands[b] ??= { n: 0, p: 0, w: 0 }); x.n++; x.p += shown; x.w += won ? 1 : 0
  const y = (words[old] ??= { n: 0, p: 0, w: 0 }); y.n++; y.p += shown; y.w += won ? 1 : 0
  const z = (words[`now: ${C.titleStatus(shown)}`] ??= { n: 0, p: 0, w: 0 }); z.n++; z.p += shown; z.w += won ? 1 : 0
  if (i % 50 === 49) console.log(`  ${i + 1} seasons, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}
const pc = x => `${(x * 100).toFixed(1)}%`.padStart(6)
console.log('\nshown title odds   seasons   shown   titles')
for (const k of ['0-2', '2-6', '6-12', '12-20', '20-30', '30-45', '45+']) { const x = bands[k]; if (x) console.log(`  ${k.padEnd(8)}%  ${String(x.n).padStart(8)}  ${pc(x.p / x.n)}  ${pc(x.w / x.n)}`) }
console.log('\nthe board\'s word         seasons   shown   titles')
for (const [k, x] of Object.entries(words).sort()) console.log(`  ${k.padEnd(22)}  ${String(x.n).padStart(6)}  ${pc(x.p / x.n)}  ${pc(x.w / x.n)}`)
console.log(`\nall: shown ${pc(sumP / n)}, titles ${pc(sumW / n)}, Brier ${(brier / n).toFixed(4)} (a coin at the average: ${((sumW / n) * (1 - sumW / n)).toFixed(4)}) · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
// the old board's 'Contender' against his own team with him on it
if (NB) {
  let boards = 0, called = 0, worse = 0, boardsWorse = 0
  for (let i = 0; i < NB; i++) {
    const pos = i % 2 ? 'big' : 'guard', r = seeded(`tb-${i}`)
    let c = C.newCareer({ sport: 'bucket', pos, build: buildFor(pos, r, 4 + (i % 3)), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 })
    c = C.skipCombine(c); c = C.runDraft(c)
    // (his team: any of the thirty, the way a few seasons on he could be anywhere)
    const to = S.teams[(i * 7) % S.teams.length].short
    if (to !== c.team) c = C.signOffer(c, { team: to, fit: C.teamFit(to, pos, { sport: 'bucket', name: c.name }), years: 2, perYear: 5 })
    const mine = C.titleOdds(c, c.team, 60)
    let any = false
    for (const t of S.teams) {
      if (t.short === c.team) continue
      if (C.teamFit(t.short, pos, { sport: 'bucket', name: c.name }).status !== 'Contender') continue
      called++
      if (C.titleOdds(c, t.short, 60) < mine) { worse++; any = true }
    }
    boards++; if (any) boardsWorse++
  }
  console.log(`
the old board: ${called} 'Contender' calls over ${boards} boards; ${worse} (${pc(worse / Math.max(1, called))}) were a worse shot than his own team with him on it; on ${pc(boardsWorse / boards)} of the boards at least one was`)
}
await server.close()
process.exit(0)
