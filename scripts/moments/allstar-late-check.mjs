// The Slam Dunk Contest in late career seasons (2040-2060): the real league ages out, the field must still fill and
// the night finish (owner 11-27: careers stuck after the dunk contest). Run: node scripts/moments/allstar-late-check.mjs
import { createServer } from 'vite'
globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
await server.ssrLoadModule('/src/lib/mg/index.js')
const A = await server.ssrLoadModule('/src/lib/allStar.js')
const { DUNKS } = await server.ssrLoadModule('/src/lib/mg/dunkcontest.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const S = C.SPORT.bucket
const build = Object.fromEntries(S.types.guard.map(t => { const p = S.pool.guard.find(x => x.attrs); return [t, { type: t, val: t === 'bounce' || t === 'finishing' ? 10 : 7, qb: p.name, qbFull: p.name, team: p.team, pos: p.pos }] }))
let c = C.newCareer({ sport: 'bucket', pos: 'guard', build, name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 })
c = C.skipCombine(c); c = C.runDraft(c)
let D; [c, D] = C.startSeason(c)
const at = A.allStarGame(c)
for (let g = 0; g < 400 && c.active.k < at; g++) { if (c.active.injury) { c = C.resolveInjury(c, D, false, false)[0]; continue } if (c.active.moment) { c = C.chooseMoment(c, D, c.active.moment.options[0])[0]; continue } c = C.advanceWeek(c, D)[0] }
if (!c.active.asw || c.active.asw.hurt) { console.log('no night'); process.exit(0) }
for (const season of [2026, 2040, 2045, 2050, 2060]) {
  let x = A.answerAllStar({ ...c, season, year: season - 2026 }, { three: false, dunk: true })
  x = { ...x, active: { ...x.active, asw: { ...x.active.asw, dunkOn: true } } }
  let steps = 0, err = null
  try {
    for (; steps < 60; steps++) {
      const P = A.dunkPlan(x)
      if (!P.need) break
      const used = P.need.used ?? new Set()
      const d = DUNKS.find(d => !(used.has?.(d.id) || (Array.isArray(used) && used.includes(d.id)))) ?? DUNKS[0]
      x = A.simDunkFor(x, d.id, `${P.need.round}-${P.need.n}-${steps}`)
    }
    const P = A.dunkPlan(x)
    const f = A.finishAllStar(x)
    console.log(season, 'field', P.field.length, 'stage', P.stage, 'steps', steps, 'finished', !!f.active.asw.done, 'res', JSON.stringify(f.active.asw.res?.dunk ?? null).slice(0, 80))
  } catch (e) { console.log(season, 'ERROR', e.message.slice(0, 120)) }
}
await server.close(); process.exit(0)
