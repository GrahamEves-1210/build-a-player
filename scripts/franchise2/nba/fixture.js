// A plain NBA league in STATE.md's shape, for the cap engine's headless checks (core's league.js builds the real one;
// this stands in so the money can be checked on its own). Real rosters and ratings from src/data; ages, service,
// potential and draft slots are seeded guesses (the data has none), and generated depth fills every team to 15 + 2.
// A toy season (results by team strength), a toy draft and toy aging keep the years turning.
import { NBA_GUARD_PLAYERS } from '../../../src/data/nba-guards'
import { NBA_BIG_PLAYERS } from '../../../src/data/nba-bigs'
import { NBA_TEAMS } from '../../../src/data/nba-teams'
import { rngOf, clamp } from '../../../src/lib/franchise2/rng'
import { dealsOnLoad, rookieDeal, teamStrength } from '../../../src/lib/franchise2/nba/contracts'
import { resolvePicks } from '../../../src/lib/franchise2/nba/trades'

const ovrOf = a => { const v = Object.values(a); const avg = v.reduce((x, y) => x + y, 0) / v.length; const top = [...v].sort((x, y) => y - x).slice(0, 3).reduce((x, y) => x + y, 0) / 3; return clamp(45, 99, Math.round(38 + avg * 5.2 + top * 1.6)) }
export function makeLeague({ seed = 'nba-cap', team = 'BOS', year = 2026 } = {}) {
  const R = rngOf(seed + '-fixture')
  const F = { v: 1, sport: 'nba', seed, team, year, nid: 1, owner: 'Guest', teams: {}, fa: [], picks: [], sched: [], day: 0, days: 170, asb: 110, ddl: 104, phase: 'season', news: [] }
  for (const t of NBA_TEAMS) F.teams[t.short] = { s: t.short, conf: '', div: '', r: [], rot: null, min: null, exc: null, dead: [] }
  const man = (x, g) => {
    const o = ovrOf(x.attrs)
    const ag = clamp(19, 38, Math.round(26.5 + R.n() * 4 - (o >= 85 ? 0 : 0)))
    const ys = clamp(0, 19, ag - 20 - (R.u() < 0.3 ? 1 : 0))
    const pk = clamp(o, 99, Math.round(o + Math.max(0, 25 - ag) * (1 + R.u() * 1.5)))
    const p = { i: F.nid++, n: x.name, p: x.position ?? (g === 'big' ? 'C' : 'SG'), g, o, pk, a: x.attrs, ag, ys, ht: x.height, wt: x.weight }
    if (ys <= 3) { const r = R.u() < 0.65 ? 1 : 2; p.dr = [year - ys, r, r === 1 ? 1 + Math.floor(R.u() * 30) : 31 + Math.floor(R.u() * 30), x.team] }
    if (ys === 0) p.rk = year
    return p
  }
  for (const x of NBA_GUARD_PLAYERS) if (F.teams[x.team]) F.teams[x.team].r.push(man(x, 'guard'))
  for (const x of NBA_BIG_PLAYERS) if (F.teams[x.team]) F.teams[x.team].r.push(man(x, 'big'))
  // depth: every team to 15 standard men, plus a pool
  for (const s of Object.keys(F.teams)) {
    const t = F.teams[s]
    while (t.r.length > 15) { const low = [...t.r].sort((a, b) => a.o - b.o)[0]; t.r = t.r.filter(p => p !== low); F.fa.push(low) }
    while (t.r.length < 15) t.r.push(filler(F, R))
  }
  for (let k = 0; k < 40; k++) F.fa.push(filler(F, R))
  dealsOnLoad(F)
  // two-ways
  for (const s of Object.keys(F.teams)) for (let k = 0; k < 2; k++) { const p = filler(F, R, true); p.tw = 1; p.$ = 0.68; p.y = 1; p.sc = []; p.sgn = year - 1; F.teams[s].r.push(p) }
  for (const p of F.fa) { p.$ = 0; p.y = 0; delete p.sc }
  // picks: the next seven drafts
  for (let y = year + 1; y <= year + 7; y++) for (const r of [1, 2]) for (const s of Object.keys(F.teams)) F.picks.push({ y, r, o: s, t: s, pr: null, sw: null })
  makeSchedule(F)
  return F
}
export function filler(F, R, young = false) {
  const ag = young ? 20 + Math.floor(R.u() * 4) : 22 + Math.floor(R.u() * 10)
  const o = clamp(48, 72, Math.round(62 + R.n() * 4))
  return { i: F.nid++, n: `Depth ${F.nid}`, p: ['PG', 'SG', 'SF', 'PF', 'C'][Math.floor(R.u() * 5)], g: R.u() < 0.5 ? 'guard' : 'big', o, pk: o + (ag <= 23 ? Math.floor(R.u() * 8) : 0), a: {}, ag, ys: Math.max(0, ag - 21) }
}
export function makeSchedule(F) {
  const S = Object.keys(F.teams), R = rngOf(`${F.seed}-${F.year}-sched`)
  F.sched = []
  for (let d = 0; d < F.days; d++) {
    if (d % 1 !== 0) continue
    const sh = R.shuffle(S)
    // (about 7 games a day: 1,230 over 170 days)
    const n = d < 160 ? 7 : 8
    for (let k = 0; k + 1 < sh.length && k / 2 < n; k += 2) F.sched.push({ d, h: sh[k], a: sh[k + 1], k: 'other' })
  }
  F.sched = F.sched.slice(0, 1230)
  F.day = 0
}
export function playDay(F) {
  const d = F.day
  for (const g of F.sched) if (g.d === d && g.hs == null) {
    const R = rngOf(`${F.seed}-${F.year}-g-${d}-${g.h}`)
    const e = (teamStrength(F, g.h) - teamStrength(F, g.a)) * 1.6 + 3
    g.hs = Math.round(112 + e / 2 + R.n() * 10); g.as = Math.round(112 - e / 2 + R.n() * 10)
    if (g.hs === g.as) g.hs++
  }
  F.day++
}
export function records(F) {
  const rec = Object.fromEntries(Object.keys(F.teams).map(s => [s, { w: 0, l: 0 }]))
  for (const g of F.sched) if (g.hs != null) { if (g.hs > g.as) { rec[g.h].w++; rec[g.a].l++ } else { rec[g.a].w++; rec[g.h].l++ } }
  return rec
}
// the toy draft: worst record first, two rounds; rookies onto the roster that owns the pick
export function runDraft(F) {
  const y = F.year + 1
  const R = rngOf(`${F.seed}-${y}-draft`)
  const rec = records(F)
  const order = Object.keys(F.teams).sort((a, b) => rec[a].w - rec[b].w || a.localeCompare(b))
  const out = []
  for (const r of [1, 2]) {
    const owners = resolvePicks(F, y, order, r)
    owners.forEach((s, k) => {
      const pick = (r - 1) * 30 + k + 1
      const o = clamp(52, 82, Math.round(74 - pick * 0.28 + R.n() * 4))
      const p = { i: F.nid++, n: `Rookie ${y}-${pick}`, p: 'SF', g: R.u() < 0.5 ? 'guard' : 'big', o, pk: clamp(o, 99, o + 6 + Math.floor(R.u() * 12)), a: {}, ag: 19 + Math.floor(R.u() * 3), ys: 0, rk: y, dr: [y, r, pick, s] }
      rookieDeal(F, p, pick)
      F.teams[s].r.push(p)
      out.push(p)
    })
  }
  F.picks = F.picks.filter(k => k.y !== y)
  F.drd = y
  return out
}
// toy aging: up to 26 grow toward the ceiling, 30+ slide, 35+ (or a fringe man past 31) may retire
export function ageLeague(F) {
  const R = rngOf(`${F.seed}-${F.year}-age`)
  const gone = []
  const step = p => {
    p.ag++
    if (p.ag <= 26) p.o = Math.min(p.pk ?? p.o, p.o + Math.round(R.u() * 4))
    else if (p.ag >= 31) p.o = Math.max(40, p.o - Math.round(R.u() * (p.ag - 29)))
    return (p.ag >= 35 && R.u() < 0.35 + (p.ag - 35) * 0.15) || (p.ag >= 31 && p.o < 60 && R.u() < 0.5)
  }
  for (const s of Object.keys(F.teams)) F.teams[s].r = F.teams[s].r.filter(p => { if (step(p) && p.y <= 1) { gone.push(p); return false } return true })
  F.fa = F.fa.filter(p => { if (step(p) || (p.o < 55 && p.ag > 27)) { gone.push(p); return false } return true })
  return gone
}
