// NBA FRANCHISE: the league. Thirty teams in two conferences and six divisions, every real player the game has on
// his real team (his real age from data/player-ages.js), and made-up men behind them to fill a real roster: 15
// standard contracts and up to three two-way men. A man's shape: nba/STATE.md.
import { NBA_TEAMS } from '../../../data/nba-teams'
import { NBA_GUARD_PLAYERS, GUARD_TYPES } from '../../../data/nba-guards'
import { NBA_BIG_PLAYERS, BIG_TYPES } from '../../../data/nba-bigs'
import { BIRTH_NBA } from '../../../data/player-ages'
import NBA_HEADSHOTS from '../../../data/nba-headshots.json'
import { calcBucketOVR } from '../../../utils/bucketSimulation'
import { HEADSHOT_BASE } from '../../../utils/simulation'
import { nameFor } from '../names'
import { rngOf, clamp } from '../rng'

export const FIRST_YEAR = 2026
export const ROSTER_MAX = 15, ROSTER_MIN = 13, TWO_WAY_MAX = 3
export const SPOTS = ['PG', 'SG', 'SF', 'PF', 'C']
export const groupOfSpot = s => (s === 'PF' || s === 'C' ? 'big' : 'guard')
export const TYPES = { guard: GUARD_TYPES, big: BIG_TYPES }

export const DIVS = {
  Atlantic: ['BOS', 'BKN', 'NYK', 'PHI', 'TOR'], Central: ['CHI', 'CLE', 'DET', 'IND', 'MIL'], Southeast: ['ATL', 'CHA', 'MIA', 'ORL', 'WAS'],
  Northwest: ['DEN', 'MIN', 'OKC', 'POR', 'UTA'], Pacific: ['GSW', 'LAC', 'LAL', 'PHX', 'SAC'], Southwest: ['DAL', 'HOU', 'MEM', 'NOP', 'SAS'],
}
export const CONF_DIVS = { E: ['Atlantic', 'Central', 'Southeast'], W: ['Northwest', 'Pacific', 'Southwest'] }
export const CONF_NAME = { E: 'Eastern', W: 'Western' }
export const DIV_OF = {}, CONF_OF = {}
for (const [c, ds] of Object.entries(CONF_DIVS)) for (const d of ds) for (const s of DIVS[d]) { DIV_OF[s] = d; CONF_OF[s] = c }

const TWO_WORD = /(Trail Blazers)$/
// TEAM: { short, name, nick, city, color, color2, logo, conf, div }
export const TEAM = Object.fromEntries(NBA_TEAMS.map(t => {
  const m = t.name.match(TWO_WORD)
  const nick = m ? m[1] : t.name.split(' ').slice(-1)[0]
  const city = t.name.slice(0, t.name.length - nick.length).trim()
  return [t.short, { ...t, nick, city, logo: `/logos/nba/${t.short}.png`, conf: CONF_OF[t.short], div: DIV_OF[t.short] }]
}))
export const SHORTS = Object.keys(TEAM).sort()
export const seasonText = y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`

// ── The real men ─────────────────────────────────────────────────────────────
const asBuild = a => Object.fromEntries(Object.entries(a ?? {}).map(([k, v]) => [k, { val: v }]))
export const ovrOfAttrs = (g, a) => calcBucketOVR(asBuild(a), TYPES[g], g)
let POOL = null
// every real man once (a man in both rooms, a wing listed as a guard and a forward, keeps the rating at his listed spot)
export function realPool() {
  if (POOL) return POOL
  const by = new Map()
  for (const [g, list] of [['guard', NBA_GUARD_PLAYERS], ['big', NBA_BIG_PLAYERS]]) {
    for (const r of list) {
      if (!r.attrs || !r.team || !TEAM[r.team]) continue
      const spot = SPOTS.includes(r.position) ? r.position : g === 'big' ? 'PF' : 'SG'
      const fits = groupOfSpot(spot) === g
      const x = { name: r.name, team: r.team, g, spot, a: r.attrs, o: ovrOfAttrs(g, r.attrs), num: r.number, ht: r.height, wt: r.weight, starter: !!r.starter, fits }
      const was = by.get(r.name)
      if (!was || (fits && !was.fits) || (fits === was.fits && x.o > was.o)) by.set(r.name, x)
    }
  }
  POOL = [...by.values()]
  return POOL
}
export const realNames = () => new Set(realPool().map(r => r.name))
export const photoOf = n => (NBA_HEADSHOTS[n] ? `${HEADSHOT_BASE}/nba/${NBA_HEADSHOTS[n]}.webp` : null)
const ageIn = (name, year) => (BIRTH_NBA[name] ? year - BIRTH_NBA[name] : null)

// his ceiling: the young have room to grow, a man past 27 is what he is
export function peakFor(R, o, ag) {
  const room = Math.max(0, 27 - ag)
  return clamp(40, 99, Math.round(o + room * (1.1 + R.u() * 1.6) + R.n() * 2))
}
const servedFrom = ag => clamp(0, 20, ag - 20)

// the real 2026 draft class the rosters already carry: rookies in the first season (Rookie of the Year is theirs);
// the rest of the teenagers on the rosters came in 2025 and have a season in
export const ROOKIES_2026 = new Set(['AJ Dybantsa', 'Cameron Boozer', 'Caleb Wilson', 'Chris Cenac Jr.', 'Darius Acuff Jr.', 'Darryn Peterson', 'Jayden Quaintance',
  'Keaton Wagler', 'Kingston Flemings', 'Koa Peat', 'Labaron Philon Jr.', 'Mikel Brown Jr.', 'Morez Johnson Jr.', 'Nate Ament', 'Hannes Steinbach', 'Christian Anderson'])
export function makeReal(F, r, R) {
  const ag = ageIn(r.name, F.year) ?? R.int(22, 30)
  const p = { i: F.nid++, n: r.name, p: r.spot, g: r.g, o: r.o, ag, a: { ...r.a }, ht: r.ht, wt: r.wt, num: r.num, ys: servedFrom(ag), h: 1 }
  if (ROOKIES_2026.has(r.name)) { p.rk = FIRST_YEAR; p.ys = 0 }
  else if (BIRTH_NBA[r.name] >= 2006) p.ys = 1
  p.pk = Math.max(p.o, peakFor(R, p.o, ag))
  return p
}

// ── The made-up men: the end of the bench, the two-way men, the street ──────
const HT = { PG: [73, 77], SG: [75, 79], SF: [78, 81], PF: [80, 83], C: [82, 86] }
const WT = { PG: [180, 200], SG: [190, 215], SF: [205, 230], PF: [220, 245], C: [235, 270] }
// attrs that land near a target OVR: each of the group's ten ratings around a level, the spot's strengths up
const LEAN = {
  PG: { passing: 2, handles: 2, speed: 1, size: -2 }, SG: { jumpShot: 2, handles: 1, size: -1 }, SF: { perimeterDefense: 1, size: 1, bounce: 1 },
  PF: { rebounding: 1, size: 1, interiorDefense: 1, speed: -1 }, C: { size: 2, rebounding: 2, interiorDefense: 1, jumpShot: -2, speed: -2 },
}
export function attrsFor(R, spot, o) {
  const g = groupOfSpot(spot), T = TYPES[g], lean = LEAN[spot] ?? {}
  let lvl = 1 + ((o - 57) / 44) * 9
  let a = null
  for (let k = 0; k < 6; k++) {
    a = Object.fromEntries(T.map(t => [t, clamp(0, 11, Math.round(lvl + (lean[t] ?? 0) + R.n() * 1.3))]))
    const got = ovrOfAttrs(g, a)
    if (Math.abs(got - o) <= 1) break
    lvl += (o - got) / 4.4
  }
  return a
}
export function makeGen(F, spot, R, { o = null, ag = null, taken = null } = {}) {
  const age = ag ?? R.int(22, 30)
  const g = groupOfSpot(spot)
  const want = o ?? clamp(60, 74, Math.round(68 + R.n() * 3))
  const a = attrsFor(R, spot, want)
  const [h0, h1] = HT[spot], [w0, w1] = WT[spot]
  const n = nameFor(R, 'nba', { taken: taken ?? leagueNames(F), real: realNames() })
  const p = { i: F.nid++, n, p: spot, g, o: ovrOfAttrs(g, a), ag: age, a, ht: R.int(h0, h1), wt: R.int(w0, w1), ys: servedFrom(age), gn: 1 }
  p.pk = Math.max(p.o, peakFor(R, p.o, age) - 3)
  return p
}
export function leagueNames(F) {
  const s = new Set()
  for (const t of Object.values(F.teams ?? {})) for (const p of t.r) s.add(p.n)
  for (const p of F.fa ?? []) s.add(p.n)
  for (const p of F.dc ?? []) s.add(p.n)
  return s
}

// ── The league at the start ──────────────────────────────────────────────────
// each team: its real men (best fourteen or fifteen on standard deals; a sixteenth and beyond on two-way deals if
// he's young, else the street), then made-up men to fifteen and two two-way men
export function buildTeams(F, { dealOnLoad } = {}) {
  const R = rngOf(`${F.seed}-nba-league`)
  F.teams = {}
  const taken = new Set(realNames())
  for (const s of SHORTS) F.teams[s] = { s, conf: CONF_OF[s], div: DIV_OF[s], r: [], rot: null, min: null }
  F.fa = F.fa ?? []
  for (const s of SHORTS) {
    const real = realPool().filter(r => r.team === s).sort((a, b) => b.o - a.o)
    const men = real.map(r => makeReal(F, r, R))
    const t = F.teams[s]
    men.forEach((p, k) => {
      if (k < ROSTER_MAX) t.r.push(p)
      else if (p.ag <= 24 && t.r.filter(x => x.tw).length < TWO_WAY_MAX) { p.tw = 1; t.r.push(p) }
      else F.fa.push(p)
    })
    fillTeam(F, s, R, taken)
  }
  if (dealOnLoad) for (const s of SHORTS) for (const p of F.teams[s].r) dealOnLoad(F, p, s)
  return F
}
// a roster short of fifteen standard men (and two two-way men): made-up men at the spots it's thinnest at
export function fillTeam(F, s, R, taken = leagueNames(F), { twoWay = 2 } = {}) {
  const t = F.teams[s], made = []
  const std = () => t.r.filter(p => !p.tw)
  while (std().length < ROSTER_MAX) {
    const spot = thinSpot(std())
    const p = makeGen(F, spot, R, { o: clamp(60, 73, Math.round(67 + R.n() * 2.5)), ag: R.int(23, 31), taken })
    taken.add(p.n); t.r.push(p); made.push(p)
  }
  while (t.r.filter(p => p.tw).length < twoWay) {
    const spot = thinSpot(t.r)
    const p = makeGen(F, spot, R, { o: clamp(58, 70, Math.round(64 + R.n() * 2.5)), ag: R.int(20, 24), taken })
    p.tw = 1; taken.add(p.n); t.r.push(p); made.push(p)
  }
  return made
}
export function thinSpot(men) {
  const n = Object.fromEntries(SPOTS.map(s => [s, 0]))
  for (const p of men) n[p.p] = (n[p.p] ?? 0) + 1
  const want = { PG: 3, SG: 3, SF: 3, PF: 3, C: 3 }
  return SPOTS.slice().sort((a, b) => (n[a] - want[a]) - (n[b] - want[b]))[0]
}

// ── The team's strength ──────────────────────────────────────────────────────
export const manOf = (F, id) => {
  for (const t of Object.values(F.teams)) { const p = t.r.find(x => x.i === id); if (p) return p }
  return (F.fa ?? []).find(x => x.i === id) ?? (F.dc ?? []).find(x => x.i === id) ?? null
}
export const teamOfMan = (F, id) => { for (const [s, t] of Object.entries(F.teams)) if (t.r.some(x => x.i === id)) return s; return null }
export const healthy = p => !p.inj?.g
// a simple default order (C's rotationOf decides the real minutes): the five best a lineup can use, then the rest
export function depthOrder(F, s) {
  const t = F.teams[s]
  const men = t.r.filter(p => !p.tw || true).filter(healthy)
  if (t.rot?.length) {
    const ids = t.rot.filter(i => men.some(p => p.i === i))
    const rest = men.filter(p => !ids.includes(p.i)).sort((a, b) => b.o - a.o)
    return [...ids.map(i => men.find(p => p.i === i)), ...rest]
  }
  const best = men.slice().sort((a, b) => b.o - a.o)
  // starters: a ball handler, two wings, two bigs from the best eight where the roster has them
  const st = [], take = f => { const p = best.slice(0, 9).find(x => !st.includes(x) && f(x)); if (p) st.push(p) }
  take(p => p.p === 'PG' || p.p === 'SG')
  take(p => p.g === 'guard')
  take(p => p.p === 'SF' || p.p === 'SG' || p.p === 'PF')
  take(p => p.g === 'big')
  take(p => p.p === 'C' || p.p === 'PF')
  for (const p of best) if (st.length < 5 && !st.includes(p)) st.push(p)
  return [...st, ...best.filter(p => !st.includes(p))]
}
// team OVR: the rotation weighted by the minutes it plays (starters most), on the players' own scale
const W8 = [34, 34, 32, 31, 30, 24, 20, 17, 12, 6]
export function teamOvr(F, s) {
  const d = depthOrder(F, s).filter(p => !p.tw || p.o >= 70)
  let a = 0, w = 0
  d.slice(0, 10).forEach((p, k) => { a += p.o * W8[k]; w += W8[k] })
  const avg = w ? a / w : 60
  // stars carry NBA teams: the best man's distance above 85 counts again
  const star = Math.max(0, (d[0]?.o ?? 0) - 85) * 0.35
  return Math.round(avg + star)
}
export const nick = s => TEAM[s]?.nick ?? s
