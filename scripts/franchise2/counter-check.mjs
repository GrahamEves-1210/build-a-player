// Trade counters, headless (lib/franchise2/trades.js counterOf): many small asks (one of the GM's men for one of a
// team's picks, pick for pick, a pick for a man) and what each counter costs against the gap it closes.
//   bash scripts/franchise2/run.sh scripts/franchise2/counter-check.mjs [asks a spot=400] [team=NYJ] [seed]
// A counter must close the value gap and nothing more: never more than the gap (with a step for picks' sizes), never
// more than the thing asked for is worth, never a higher pick than the best one coming back for a lower return, and
// when the GM's side is already worth more by the league's values, at most a small add.
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'
import { seeded } from '../../src/lib/rng'

FR.useContracts(CONTRACTS)
const ASKS = Number(process.argv[2] ?? 400), team = process.argv[3] ?? 'NYJ', SEED = process.argv[4] ?? ''
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen')
const F = FR.createFranchise({ seed: 'counter-' + team + SEED, team, owner: 'G', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 12 }], coach: { name: 'Test Coach', style: 'players', r: { talentDev: 6, offPlaycalling: 6, defPlaycalling: 6, culture: 6, situational: 6 }, ovr: 76 } })
const H = seeded('counter-bot' + SEED)
const v0 = x => Math.round(x)
const RD = k => FR.parsePick(k).r
const pickName = k => { const p = FR.parsePick(k); return `${p.y} rd ${p.r}${p.o !== F.team ? ` (${p.o})` : ''}` }
const manName = (s, id) => { const p = F.teams[s].r.find(x => x.i === id) ?? F.teams[F.team].r.find(x => x.i === id); return p ? `${p.p.toUpperCase()} ${p.n} ${p.o}/${p.ag}` : id }
const side = (s, x) => [...(x.pl ?? []).map(id => manName(s, id)), ...(x.pk ?? []).map(pickName)].join(' + ') || 'nothing'
const T = { asks: 0, yes: 0, counters: 0, no: 0, over: [], kinds: {}, seen: [] }
// the step a pick's size allows past the gap: the smallest pick a team could add is a seventh
const SMALL = 20

function ask(tag, s, give, get) {
  if (!FR.checkTrade(F, s, give, get).ok) return
  T.asks++
  const d = FR.decide(F, s, give, get)
  const g = FR.gauge(F, s, give, get)
  if (d.ok) { T.yes++; return }
  const c = FR.counterOf(F, s, give, get, d)
  if (!c) { T.no++; T.kinds[d.why] = (T.kinds[d.why] ?? 0) + 1; return }
  T.counters++
  const gc = FR.gauge(F, s, c.give, c.get)
  const cost = (gc.give - g.give) + (g.get - gc.get)        // what the counter costs the GM, the league's way
  const gap = Math.max(0, g.get - g.give)                     // the league's gap
  const short = d.short                                       // the team's own gap
  const allow = Math.max(SMALL, Math.min(Math.max(gap, short) * 1.25 + SMALL, g.get))
  const why = []
  if (cost > allow + 1e-6) why.push(`costs ${v0(cost)} for a gap of ${v0(gap)} (team ${v0(short)})`)
  if (cost > g.get + 1e-6) why.push(`costs more than the ask is worth (${v0(g.get)})`)
  if (g.give >= g.get && cost > SMALL + 1e-6) why.push(`the GM's side was already worth more (${v0(g.give)} for ${v0(g.get)})`)
  const added = (c.give.pk ?? []).filter(k => !(give.pk ?? []).includes(k))
  const best = Math.min(8, ...(get.pk ?? []).map(RD))
  if ((get.pk ?? []).length && added.some(k => RD(k) < best)) why.push(`a round ${Math.min(...added.map(RD))} pick added for a round ${best} pick`)
  const hi = x => Math.min(8, ...(x.pk ?? []).map(RD)), upside = (a, b) => (b.pk ?? []).length > 0 && hi(a) < hi(b)
  if (!upside(give, get) && upside(c.give, c.get)) why.push(`sends a round ${hi(c.give)} pick for a round ${hi(c.get)} pick`)
  T.seen.push(`${tag} ${s}: ${side(F.team, give)} for ${side(s, get)} -> ${side(F.team, c.give)} for ${side(s, c.get)} · cost ${v0(cost)}, gap ${v0(gap)} (team ${v0(short)}), ask ${v0(g.get)}`)
  if (why.length) T.over.push(`${tag} ${s}: ${side(F.team, give)} for ${side(s, get)} -> ${side(F.team, c.give)} for ${side(s, c.get)} · ${why.join('; ')}`)
}

function round(tag) {
  const others = FR.SHORTS.filter(x => x !== F.team)
  const mine = F.teams[F.team].r.filter(p => !FR.tradeable(F, F.team, p) && p.p !== 'k')
  const myPk = FR.picksBy(F)[F.team]
  for (let i = 0; i < ASKS; i++) {
    const s = others[Math.floor(H() * others.length)]
    const theirPk = FR.picksBy(F)[s]
    const kind = i % 3
    if (kind === 0) {
      // one of the GM's men for one of their picks (rounds 2 to 7)
      const p = mine[Math.floor(H() * mine.length)], k = theirPk.filter(x => RD(x) >= 2)[Math.floor(H() * theirPk.filter(x => RD(x) >= 2).length)]
      if (p && k) ask(tag, s, { pl: [p.i], pk: [] }, { pl: [], pk: [k] })
    } else if (kind === 1) {
      // pick for pick, a round apart either way or the same round
      const k = theirPk.filter(x => RD(x) >= 2)[Math.floor(H() * theirPk.filter(x => RD(x) >= 2).length)]
      const r = RD(k) + Math.floor(H() * 3) - 1
      const m = myPk.filter(x => RD(x) === r)
      if (k && m.length) ask(tag, s, { pl: [], pk: [m[Math.floor(H() * m.length)]] }, { pl: [], pk: [k] })
    } else {
      // a mid or late pick for a depth man of theirs
      const men = F.teams[s].r.filter(p => !FR.tradeable(F, s, p) && p.p !== 'k' && p.o <= 80)
      const p = men[Math.floor(H() * men.length)], m = myPk.filter(x => RD(x) >= 3)
      if (p && m.length) ask(tag, s, { pl: [], pk: [m[Math.floor(H() * m.length)]] }, { pl: [p.i], pk: [] })
    }
  }
}

const t0 = performance.now()
round('wk 1')
for (let w = 0; w < 6; w++) { FR.playWeek(F, { moments: false }); if (F.ev) F.ev = null }
round('wk 7')
console.log(`${T.asks} asks: ${T.yes} taken, ${T.counters} countered, ${T.no} turned down (${Object.entries(T.kinds).map(([k, n]) => `${k} ${n}`).join(', ')}) · ${(performance.now() - t0).toFixed(0)} ms`)
for (const l of T.seen.filter((_, j) => j % Math.max(1, Math.floor(T.seen.length / 12)) === 0).slice(0, 12)) console.log('   ' + l)
console.log(`counters that cost more than the gap: ${T.over.length} of ${T.counters}`)
for (const l of T.over.slice(0, 25)) console.log('  !! ' + l)
console.log(T.over.length ? `\n${T.over.length} PROBLEMS` : '\nOK')
process.exit(T.over.length ? 1 : 0)
