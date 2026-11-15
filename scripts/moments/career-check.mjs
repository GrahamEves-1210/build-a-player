// Career's playoff moments, end to end through lib/career.js (loaded the way the app loads it, through Vite): careers in
// every sport and position played to the playoffs, then every round played with the moment simulated, landed and
// missed. Checks that each round plays, that the same round replays the same way, and that a football final is a real
// football score. Run from the repo root:  node scripts/moments/career-check.mjs [rounds-per-position]
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const N = Number(process.argv[2] ?? 4)

const buildFor = (S, pos, r) => {
  const pool = S.pool[pos].filter(p => p.attrs), b = {}
  for (const t of S.types[pos]) {
    let p = pool[Math.floor(r() * pool.length)]
    for (let j = 0; j < 5; j++) { const q = pool[Math.floor(r() * pool.length)]; if ((q.attrs?.[t] ?? 0) > (p.attrs?.[t] ?? 0)) p = q }
    b[t] = { type: t, val: p.attrs?.[t] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, pos: p.pos }
  }
  return b
}
// a career played forward the way the Career screen drives it, through its first season: its playoffs, or null
const SX = { soccer: await server.ssrLoadModule('/src/lib/careerSoccer.js') }
function toPlayoffs(c0) {
  let c = C.skipCombine(c0); c = C.runDraft(c)
  if (!c.team && c.draft?.offers?.length && SX[c.sport]?.signAcademy) c = SX[c.sport].signAcademy(c, c.draft.offers[0])
  let D; [c, D] = C.startSeason(c)
  let guard = 0
  while (c.active.k < D.total && guard++ < 900) {
    if (C.byeNow?.(c)) { c = C.byeRest(c, D); continue }
    if (c.active.injury) { const [n] = C.resolveInjury(c, D, false, false); c = n; continue }
    if (c.active.moment) { const [n] = C.chooseMoment(c, D, c.active.moment.options[0]); c = n; continue }
    const [n] = C.advanceWeek(c, D); c = n
  }
  c = C.finishRegular(c, D)
  return c.active?.po && c.active.po.stage !== 'done' && !c.active.out ? c : null
}
const real = n => n >= 0 && n !== 1 && n !== 4 && n !== 5   // (no football team ends on 1, 4 or 5 without a safety)
const CASES = [['nfl', 'qb'], ['nfl', 'rb'], ['nfl', 'wr'], ['nfl', 'db'], ['nfl', 'dl'], ['nfl', 'lb'], ['nfl', 'k'], ['nfl', 'ol'], ['bucket', 'guard'], ['bucket', 'big'], ['soccer', 'st'], ['baseball', 'bat'], ['baseball', 'pit']]
let bad = 0, rounds = 0
for (const [sport, pos] of CASES) {
  if (C.ensureSport) await C.ensureSport(sport)
  const S = C.SPORT[sport]
  if (!S?.pool?.[pos]) { console.log(sport, pos, 'not in this build'); continue }
  for (let i = 0; i < N; i++) {
    const r = seeded(`mcheck-${sport}-${pos}-${i}`)
    let c = null
    for (let t = 0; t < 25 && !c; t++) {
      const rt = seeded(`mcheck-${sport}-${pos}-${i}-${t}`)
      try { c = toPlayoffs(C.newCareer({ sport, pos, build: buildFor(S, pos, rt), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 })) } catch (e) { if (t === 24) console.log(sport, pos, i, 'career failed:', e.message) }
    }
    if (!c) { console.log(sport, pos, i, 'no playoffs found'); continue }
    for (const mode of ['sim', 'hit', 'miss']) {
      let x = c
      for (let g = 0; g < 8 && x.active.po.stage !== 'done'; g++) {
        const po = x.active.po, rd = po.rounds[po.idx]
        try {
          const game = C.playoffGame(x, po), sit = C.playoffPlan(x, po, undefined, game).sit, card = C.cardOdds(x, po)
          const hit = mode === 'hit' ? true : mode === 'miss' ? false : seeded(`mg-sim-${x.seed}-${x.year}-${po.idx}`)() < C.momentHitRate(x, game)
          const y1 = C.playoffRound(x, hit ? 0.7 : 0.3, game, hit, null), y2 = C.playoffRound(x, hit ? 0.7 : 0.3, game, hit, null)
          const e1 = y1.active.po.line.at(-1), e2 = y2.active.po.line.at(-1)
          rounds++
          if (JSON.stringify(e1) !== JSON.stringify(e2)) { bad++; console.log('NOT SEEDED', sport, pos, rd.name) }
          if (sport === 'nfl' && (!real(e1.mySc) || !real(e1.oppSc))) { bad++; console.log('NOT A FOOTBALL SCORE', pos, e1.mySc, e1.oppSc, e1.swing) }
          if (!rd.series && sport !== 'soccer' && (e1.mySc > e1.oppSc) !== e1.won) { bad++; console.log('BOARD AND RESULT DISAGREE', sport, pos, e1.mySc, e1.oppSc, e1.won) }
          if (!(card > 0 && card < 1)) { bad++; console.log('CARD', card) }
          if (i === 0 && mode === 'sim') console.log(`${sport}/${pos} ${rd.name}: ${game} | ${sit.line} ${sit.tail}${sit.reps ? ` [${sit.reps} reps]` : ''}${sit.kicks ? ` [kicks ${sit.kicks.map(k => (k.xp ? 'XP' : k.d)).join(', ')}]` : ''} | card ${Math.round(card * 100)}% | ${hit ? 'hit' : 'miss'} -> ${e1.won ? 'W' : 'L'} ${e1.mySc}-${e1.oppSc}${e1.swing ? ` · ${e1.swing}` : ''}${e1.moment?.n ? ` · G${e1.moment.n} ${e1.moment.my}-${e1.moment.opp}` : ''}`)
          x = y1
        } catch (e) { bad++; console.log('FAILED', sport, pos, rd?.name, e.stack.split('\n').slice(0, 3).join(' | ')); break }
      }
    }
  }
}
console.log(`${rounds} rounds, ${bad} problems`)
await server.close()
process.exit(bad ? 1 : 0)
