// The real league (core's builder: real rosters, ratings and birth years, made-up depth to 15 + 2 two-way men, core's
// 82-game calendar), with the cap engine's own deals on every man, and a toy season around it so the years turn:
// results by team strength, a toy draft (worst record first, protections and swaps settled core's way) and toy
// aging (a year older and a year of service, growth to 26, a slide from 31, retirements). The season's sim and the
// real draft are core's and the sim's; these stand in so the money can be checked on its own.
import { createNbaFranchise } from '../../../src/lib/franchise2/nba/index'
import { makeSchedule as coreSchedule } from '../../../src/lib/franchise2/nba/schedule'
import { makeGen, SHORTS } from '../../../src/lib/franchise2/nba/league'
import { rngOf, clamp } from '../../../src/lib/franchise2/rng'
import { dealsOnLoad, rookieDeal, teamStrength } from '../../../src/lib/franchise2/nba/contracts'

const DEAL = ['$', 'y', 'sc', 'opt', 'rs', 'rfa', 'bird', 'ntc', 'sgn', 'sgd', 'mh', 'ng', 'ext', 'rt', 'was']
export function makeLeague({ seed = 'nba-cap', team = 'BOS' } = {}) {
  const F = createNbaFranchise({ seed, team, owner: 'Guest', builds: [] })
  // (core's stand-in deals off; the engine's own on)
  for (const s of SHORTS) for (const p of F.teams[s].r) for (const k of DEAL) delete p[k]
  for (const p of F.fa ?? []) for (const k of DEAL) delete p[k]
  delete F.dlo
  dealsOnLoad(F)
  for (const p of F.fa ?? []) { p.$ = 0; p.y = 0 }
  for (const s of SHORTS) F.teams[s].dead = []
  return F
}
export function filler(F, R, young = false) {
  const p = makeGen(F, ['PG', 'SG', 'SF', 'PF', 'C'][Math.floor(R.u() * 5)], R, { ag: young ? 20 + Math.floor(R.u() * 3) : null })
  return p
}
export function makeSchedule(F) { coreSchedule(F); F.day = 0 }
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
// the toy draft: worst record first, two rounds; protections and swaps settled the way core's draft.js does
export function runDraft(F) {
  const y = F.year + 1
  F.off = { ...(F.off ?? {}), step: 'draft' }
  const R = rngOf(`${F.seed}-${y}-draft`)
  const rec = records(F)
  const order = Object.keys(F.teams).sort((a, b) => rec[a].w - rec[b].w || a.localeCompare(b))
  for (const p of F.picks.filter(p => p.y === y)) p.n = (p.r - 1) * 30 + order.indexOf(p.o) + 1
  for (const p of F.picks.filter(p => p.y === y)) {
    const slot = p.n - (p.r - 1) * 30
    if (p.r === 1 && p.pr && slot <= p.pr.top && p.t !== p.o) {
      const owed = p.t
      p.t = p.o
      const nx = F.picks.find(q => q.y === y + 1 && q.r === 1 && q.o === p.o)
      if (nx && nx.t === p.o) { nx.t = owed; nx.pr = { top: p.pr.top } }
      p.pr = null
    }
    if (p.sw) {
      const q = F.picks.find(x => x.y === y && x.r === p.r && x.o === p.sw.with)
      if (q && q.n < p.n && q.t === p.sw.with) { const t = p.t; p.t = q.t; q.t = t }
      delete p.sw
    }
  }
  const out = []
  for (const k of F.picks.filter(p => p.y === y).sort((a, b) => a.n - b.n)) {
    const pick = k.n, s = k.t
    const o = clamp(52, 82, Math.round(74 - pick * 0.28 + R.n() * 4))
    const p = makeGen(F, ['PG', 'SG', 'SF', 'PF', 'C'][Math.floor(R.u() * 5)], R, { o, ag: 19 + Math.floor(R.u() * 3) })
    p.pk = clamp(o, 99, o + 6 + Math.floor(R.u() * 12))
    p.ys = 0
    p.dr = [y, k.r, pick, s]
    p.n = `Rookie ${y}-${pick}`
    rookieDeal(F, p, { n: pick, r: k.r })
    F.teams[s].r.push(p)
    out.push(p)
  }
  F.picks = F.picks.filter(k => k.y !== y)
  F.drafts = { ...(F.drafts ?? {}), [y]: out.map(p => p.i) }
  return out
}
// toy aging: everyone a year older and a year of service (as the sim's ageLeague does); up to 26 grow toward the
// ceiling, 31+ slide; 35+ (or a fringe man past 31) may retire
export function ageLeague(F) {
  const R = rngOf(`${F.seed}-${F.year}-age`)
  const gone = []
  const step = p => {
    p.ag++
    p.ys = (p.ys ?? 0) + 1
    if (p.ag <= 26) p.o = Math.min(p.pk ?? p.o, p.o + Math.round(R.u() * 4))
    else if (p.ag >= 31) p.o = Math.max(40, p.o - Math.round(R.u() * (p.ag - 29)))
    return (p.ag >= 35 && R.u() < 0.35 + (p.ag - 35) * 0.15) || (p.ag >= 31 && p.o < 60 && R.u() < 0.5)
  }
  for (const s of Object.keys(F.teams)) F.teams[s].r = F.teams[s].r.filter(p => { if (step(p) && p.y <= 1) { gone.push(p); return false } return true })
  F.fa = F.fa.filter(p => { if (step(p) || (p.o < 55 && p.ag > 27)) { gone.push(p); return false } return true })
  return gone
}
// core's newSeason, as far as the money goes: CPU rosters cut to 15 + 3 and filled with made-up men (their deals
// from dealOnLoad), the dead money's years counted down, the year turned, new picks
export function newSeason(F, { cutMan, dealOnLoad }, R) {
  for (const s of SHORTS) {
    if (s === F.team) continue
    const t = F.teams[s]
    const std = () => t.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)
    while (std().length > 15) cutMan(F, s, std()[0].i)
    while (t.r.filter(p => p.tw).length > 3) cutMan(F, s, t.r.filter(p => p.tw).sort((a, b) => a.o - b.o)[0].i)
    while (std().length < 15) { const p = filler(F, R); t.r.push(p); dealOnLoad(F, p, s) }
    while (t.r.filter(p => p.tw).length < 2) { const p = filler(F, R, true); p.tw = 1; t.r.push(p); dealOnLoad(F, p, s) }
  }
  F.year++
  F.phase = 'season'
  F.off = null
  for (const s of SHORTS) F.teams[s].dead = (F.teams[s].dead ?? []).map(d => ({ ...d, y: d.y - 1 })).filter(d => d.y > 0)
  for (const r of [1, 2]) for (const s of SHORTS) if (!F.picks.some(k => k.y === F.year + 7 && k.r === r && k.o === s)) F.picks.push({ y: F.year + 7, r, o: s, t: s, pr: null })
  makeSchedule(F)
}
