// NBA FRANCHISE: the league. Thirty teams in two conferences and six divisions, every real player the game has on
// his real team (his real age from data/player-ages.js), and made-up men behind them to fill a real roster: 15
// standard contracts and up to three two-way men. A man's shape: nba/STATE.md.
import { NBA_TEAMS } from '../../../data/nba-teams'
import { NBA_GUARD_PLAYERS, GUARD_TYPES } from '../../../data/nba-guards'
import { NBA_BIG_PLAYERS, BIG_TYPES } from '../../../data/nba-bigs'
import { BIRTH_NBA } from '../../../data/player-ages'
import NBA_HEADSHOTS from '../../../data/nba-headshots.json'
import { NBA_DAY_ONE_INJURIES } from '../../../data/nba-injuries'
import { NBA_DEALS, NBA_DEAD } from '../../../data/nba-contracts'
import { NBA_FRANCHISE_ADDS, NBA_FRANCHISE_MOVES, NBA_FRANCHISE_STREET, NBA_FRANCHISE_SERVICE, REAL_FLOOR } from '../../../data/nba-franchise-roster'
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
// The colours a team wears now where the shared list (data/nba-teams.js, every live mode's) still has an older set
// (ESPN's team pages, 2026-11-24): Utah back in purple since 2025-26, the Clippers navy first since their 2024 rebrand
const COLORS_NOW = { UTA: { color: '#4E008E', color2: '#79A3DC' }, LAC: { color: '#12173F', color2: '#C8102E' } }
// TEAM: { short, name, nick, city, color, color2, logo, conf, div }
export const TEAM = Object.fromEntries(NBA_TEAMS.map(t => {
  const m = t.name.match(TWO_WORD)
  const nick = m ? m[1] : t.name.split(' ').slice(-1)[0]
  const city = t.name.slice(0, t.name.length - nick.length).trim()
  return [t.short, { ...t, ...COLORS_NOW[t.short], nick, city, logo: `/logos/nba/${t.short}.png`, conf: CONF_OF[t.short], div: DIV_OF[t.short] }]
}))
export const SHORTS = Object.keys(TEAM).sort()
export const seasonText = y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`

// ── The real men ─────────────────────────────────────────────────────────────
const asBuild = a => Object.fromEntries(Object.entries(a ?? {}).map(([k, v]) => [k, { val: v }]))
export const ovrOfAttrs = (g, a) => calcBucketOVR(asBuild(a), TYPES[g], g)
let POOL = null
// every real man once (a man in both rooms, a wing listed as a guard and a forward, keeps the rating at his listed spot),
// where Franchise has him (data/nba-franchise-roster.js: its own additions, the men on another team now, and the
// waived men, st: 1, who open on the street)
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
  for (const r of NBA_FRANCHISE_ADDS) {
    if (by.has(r.name)) continue
    const spot = r.position, g = groupOfSpot(spot)
    by.set(r.name, { name: r.name, team: r.team, g, spot, a: r.attrs, o: ovrOfAttrs(g, r.attrs), num: r.number, ht: r.height, wt: r.weight, starter: false, fits: true, born: r.born })
  }
  for (const [n, m] of Object.entries(NBA_FRANCHISE_MOVES)) { const x = by.get(n); if (x) by.set(n, { ...x, team: m.team, num: m.number ?? x.num }) }
  for (const n of NBA_FRANCHISE_STREET) { const x = by.get(n); if (x) by.set(n, { ...x, st: 1 }) }
  POOL = [...by.values()]
  return POOL
}
export const realNames = () => new Set(realPool().map(r => r.name))
export const photoOf = n => (NBA_HEADSHOTS[n] ? `${HEADSHOT_BASE}/nba/${NBA_HEADSHOTS[n]}.webp` : null)
const ageIn = (name, year) => (BIRTH_NBA[name] ? year - BIRTH_NBA[name] : null)

// his ceiling: the young have room to grow, a man past 27 is what he is
// (aging.js seedPotential's numbers: room x 0.6-2.0 a year; more and the league's stars multiply over ten seasons)
export function peakFor(R, o, ag) {
  const room = Math.max(0, 27 - ag)
  return clamp(40, 99, Math.round(o + room * (0.6 + R.u() * 1.4) + R.n() * 2.5))
}
const servedFrom = ag => clamp(0, 20, ag - 20)

// ── The real deals (data/nba-contracts.js) ───────────────────────────────────
// by name, spelled loosely (the data's names and Basketball-Reference's differ in accents and suffixes)
const looseName = n => String(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.']/g, '').replace(/ (jr|sr|ii|iii|iv)$/, '').replace(/-/g, ' ').trim()
let DEALS = null
const dealsByName = () => DEALS ?? (DEALS = new Map(Object.entries(NBA_DEALS).map(([n, d]) => [looseName(n), { n, ...d }])))
export const realDeal = name => dealsByName().get(looseName(name)) ?? null
// the real 2026 draft class the rosters carry (the 2026 picks, and anyone else in his first season): rookies in the
// first season (Rookie of the Year is theirs)
// (d.rk: a man who missed his whole first season is still a rookie, with a year of service: Sorber)
export const ROOKIES_2026 = new Set(Object.entries(NBA_DEALS).filter(([, d]) => d.dr?.[0] === 2026 || d.ys === 0 || d.rk).map(([n]) => n))
export function makeReal(F, r, R) {
  const ag = ageIn(r.name, F.year) ?? (r.born ? F.year - r.born : null) ?? R.int(22, 30)
  const d = realDeal(r.name)
  const p = { i: F.nid++, n: r.name, p: r.spot, g: r.g, o: r.o, ag, a: { ...r.a }, ht: r.ht, wt: r.wt, num: r.num, ys: d?.ys ?? NBA_FRANCHISE_SERVICE[r.name] ?? servedFrom(ag), h: 1 }
  // (his service is real: the seasons he has been on an NBA roster, not his age and not the seasons he played)
  if (d?.dr) p.dr = [...d.dr]
  if (d?.rk) p.rk = FIRST_YEAR
  else if (d ? d.ys === 0 || d.dr?.[0] === FIRST_YEAR : ROOKIES_2026.has(r.name)) { p.rk = FIRST_YEAR; p.ys = 0 }
  else if (!d && BIRTH_NBA[r.name] >= 2006) p.ys = 1
  p.pk = Math.max(p.o, peakFor(R, p.o, ag))
  return p
}
// the deal a man starts on, for contracts.js dealOnLoad: { s: team, $, sc, opt, rs, ng, sg, x, b, rt } (his real
// deal; a man on another team's books in real life keeps the money, not the rights) or { s, min: 1 } (the minimum:
// a man with no deal in the data, or a made-up man past the real men's deals) or the team alone (a two-way deal)
function loadRow(s, d, p = null) {
  if (p?.tw) return s
  if (!d || !(d.s?.length > 0)) return { s, min: 1 }
  const [$, ...sc] = d.s
  const own = d.t === s
  return { s, $, sc, y: d.s.length, opt: d.o ? { k: d.o[0], yr: +d.o.slice(1) } : null, rs: d.rs ? 1 : 0, ng: d.ng ? 1 : 0, sg: d.sg ?? null, x: d.x ?? null,
    b: own ? d.b ?? 0 : 0, rt: own && d.rt ? d.rt : null }
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
  const n = freshName(R, taken ?? leagueNames(F))
  const p = { i: F.nid++, n, p: spot, g, o: ovrOfAttrs(g, a), ag: age, a, ht: R.int(h0, h1), wt: R.int(w0, w1), ys: servedFrom(age), gn: 1 }
  p.pk = Math.max(p.o, peakFor(R, p.o, age) - 3)
  return p
}
// every name the league has or has had: the rosters, the street, the class, the retired list, the GM's builds and
// the coaches (a new man never gets one of them)
export function leagueNames(F) {
  const s = new Set()
  for (const t of Object.values(F.teams ?? {})) for (const p of t.r) s.add(p.n)
  for (const p of F.fa ?? []) s.add(p.n)
  for (const p of F.dc ?? []) s.add(p.n)
  for (const r of F.retired ?? []) if (r?.n) s.add(r.n)
  for (const B of F.builds ?? []) if (B?.name) s.add(B.name)
  for (const st of Object.values(F.staff ?? {})) for (const c of Object.values(st ?? {})) if (c?.n) s.add(c.n)
  return s
}
// surnames a made-up NBA man doesn't get: real ones, but they read as a joke beside a first name ("Ladarius Bobo")
const ODD_LAST = new Set(['Bobo', 'Outlaw', 'Cheeks', 'Crump', 'Pugh', 'Tubbs', 'Funderburk', 'Fobbs', 'Goins', 'Petty', 'Peoples', 'Session', 'Small',
  'Spikes', 'Hairgrove', 'Womack', 'Dukes', 'Pope', 'Wimbush', 'Sturdivant', 'Koch'])
// a made-up man's name (names.js nameFor: his background's lists, never a real player's), new to the league: drawn
// again until nobody has it. `taken` is the league's names (leagueNames) and gets his.
export function freshName(R, taken) {
  const real = realNames()
  for (let k = 0; k < 300; k++) {
    const had = taken.size
    const n = nameFor(R, 'nba', { taken, real })
    if (taken.size === had) continue                     // (nameFor ran out of tries and gave one in use: again)
    if (!ODD_LAST.has(n.slice(n.indexOf(' ') + 1))) return n
    taken.delete(n)
  }
  // (three hundred draws and none free: the lists are some 100,000 pairs, so this is a league centuries in. A middle
  // initial, then a suffix, until one is new: it never hands back a name in use.)
  const base = nameFor(R, 'nba', { real }), cut = base.indexOf(' ')
  for (let k = 0; ; k++) {
    const mid = 'ADJMRTCLKBEGHNPSW'[k % 17], n = `${base.slice(0, cut)} ${mid}.${base.slice(cut)}${k >= 17 ? ` ${'I'.repeat(1 + Math.floor(k / 17))}` : ''}`
    if (!taken.has(n) && !real.has(n)) { taken.add(n); return n }
  }
}

// ── The league at the start ──────────────────────────────────────────────────
// each team: its real men (best fifteen on standard deals, the men on real two-way deals on two-way deals; a
// sixteenth and beyond on two-way deals if he's young, else the street), then fillers to the real roster's size and
// three two-way men: low-rated made-up men (p.fl) on one-year minimum deals (owner, 11-23: a made-up man never takes
// the money of a real man the game doesn't carry, so a payroll can sit under the real one). The waived men still on
// a team's books go on as dead money; the men waived in October (data/nba-franchise-roster.js) open on the street.
export function buildTeams(F, { dealOnLoad } = {}) {
  const R = rngOf(`${F.seed}-nba-league`)
  F.teams = {}
  const taken = new Set(realNames())
  for (const s of SHORTS) F.teams[s] = { s, conf: CONF_OF[s], div: DIV_OF[s], r: [], rot: null, min: null }
  F.fa = F.fa ?? []
  const rows = new Map()
  for (const s of SHORTS) {
    const real = realPool().filter(r => r.team === s && !r.st).sort((a, b) => b.o - a.o)
    const men = real.map(r => makeReal(F, r, R))
    // the real injury report on opening night (data/nba-injuries.js), unless the GM turned injuries off
    if (!F.noInj) for (const p of men) { const x = NBA_DAY_ONE_INJURIES[p.n]; if (x) p.inj = { g: x.g, k: x.k, ...(x.se && { se: 1 }) } }
    const t = F.teams[s]
    const tws = () => t.r.filter(x => x.tw).length
    // (the men on real two-way deals first, so a real two-way man doesn't take a standard spot)
    for (const p of men) if (realDeal(p.n)?.tw && tws() < TWO_WAY_MAX && (p.ys ?? 0) <= 4) { p.tw = 1; t.r.push(p) }
    men.filter(p => !p.tw).forEach(p => {
      const std = t.r.filter(x => !x.tw).length
      if (std < ROSTER_MAX) t.r.push(p)
      else if (p.ag <= 24 && tws() < TWO_WAY_MAX) { p.tw = 1; t.r.push(p) }
      else F.fa.push(p)
    })
    for (const p of t.r) rows.set(p.i, loadRow(s, realDeal(p.n), p))
    // (to the real roster's size: fifteen standard men, or fourteen where the team carries fourteen, as a team
    // staying under the tax does)
    const realStd = Object.values(NBA_DEALS).filter(d => d.t === s && !d.tw).length
    const made = fillTeam(F, s, R, taken, { twoWay: TWO_WAY_MAX, std: clamp(14, ROSTER_MAX, realStd) })
    for (const p of made) rows.set(p.i, p.tw ? s : { s, min: 1 })
    t.dead = deadOf(s)
  }
  for (const r of realPool().filter(r => r.st)) F.fa.push(makeReal(F, r, R))
  if (dealOnLoad) for (const s of SHORTS) for (const p of F.teams[s].r) { dealOnLoad(F, p, rows.get(p.i) ?? s); oneYear(p) }
  return F
}
// a filler's deal is one season, the minimum (a two-way filler's too)
function oneYear(p) { if (p.fl && p.y > 1) { p.y = 1; p.sc = []; delete p.opt } }
// a team's waived men still on its books: { n, $, y, from, to } (a run of seasons at the same money each)
function deadOf(s) {
  const out = []
  for (const [n, sal] of NBA_DEAD[s] ?? []) {
    sal.forEach(($, k) => {
      const yr = FIRST_YEAR + k, last = out[out.length - 1]
      if (last && last.n === n && last.$ === $ && last.to === yr - 1) { last.to = yr; last.y++ }
      else out.push({ n, $, y: k + 1, from: yr, to: yr })
    })
  }
  return out
}
// a roster short of fifteen standard men (or `std`), and of `twoWay` two-way men: fillers at the spots it's
// thinnest at. A filler (p.fl, and made up: p.gn) is the end of the bench a team carries because it has to: rated
// well under the real men (58-66, a two-way filler 55-63), no growth in him, a one-year minimum deal
export function makeFiller(F, spot, R, { tw = false, taken = null } = {}) {
  const p = tw ? makeGen(F, spot, R, { o: clamp(55, 63, Math.round(59 + R.n() * 2)), ag: R.int(20, 24), taken })
    : makeGen(F, spot, R, { o: clamp(58, 66, Math.round(62 + R.n() * 2)), ag: R.int(23, 31), taken })
  // (attrsFor lands near the target, now and then a point or two over: a filler never rates above his band)
  for (let top = tw ? 63 : 66; p.o > top;) { const t = Object.keys(p.a).sort((x, y) => p.a[y] - p.a[x])[0]; p.a[t]--; p.o = ovrOfAttrs(p.g, p.a) }
  p.fl = 1; p.pk = p.o
  if (tw) p.tw = 1
  return p
}
export function fillTeam(F, s, R, taken = leagueNames(F), { twoWay = 2, std: want = ROSTER_MAX } = {}) {
  const t = F.teams[s], made = []
  const std = () => t.r.filter(p => !p.tw)
  while (std().length < want) {
    const spot = thinSpot(std())
    const p = makeFiller(F, spot, R, { taken })
    taken.add(p.n); t.r.push(p); made.push(p)
  }
  while (t.r.filter(p => p.tw).length < twoWay) {
    const spot = thinSpot(t.r)
    const p = makeFiller(F, spot, R, { tw: true, taken })
    taken.add(p.n); t.r.push(p); made.push(p)
  }
  return made
}
// ── The floor (owner, 11-23) ─────────────────────────────────────────────────
// a real or drafted man: anyone not made up (the Franchise draft's men count)
export const isReal = p => !p.gn && !p.fl
export const realCount = (F, s) => F.teams[s].r.filter(isReal).length
// every new season (offseason.js newSeason, for the CPU teams): a team keeps at least REAL_FLOOR real or drafted men.
// Short of it, it signs the best real free agents left (a one-year minimum, a camp deal), a filler or the lowest
// made-up man making the room; then the rest of the roster is fillers on one-year minimums. X: the cap seams
// (signMan, cutMan, minOf, capYear, dealOnLoad). Returns the men it signed.
export function keepRoster(F, s, R, taken, X) {
  const t = F.teams[s], signed = []
  while (realCount(F, s) < REAL_FLOOR) {
    const p = (F.fa ?? []).filter(isReal).sort((a, b) => b.o - a.o)[0]
    if (!p) break
    if (t.r.filter(x => !x.tw).length >= ROSTER_MAX) {
      const out = t.r.filter(x => !x.tw && x.fl).sort((a, b) => a.o - b.o)[0]
      if (out) t.r = t.r.filter(x => x !== out)   // (a filler just goes: he was holding the spot)
      else { const gm = t.r.filter(x => !x.tw && x.gn).sort((a, b) => a.o - b.o)[0]; if (!gm) break; X.cutMan(F, s, gm.i) }
    }
    X.signMan(F, s, p, { $: X.minOf(p.ys ?? 0, X.capYear(F)), y: 1, via: 'min' }, { check: false })
    signed.push(p)
  }
  for (const p of fillTeam(F, s, R, taken, { twoWay: 2 })) { X.dealOnLoad(F, p, p.tw ? s : { s, min: 1 }); oneYear(p) }
  return signed
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
// the coach's order tonight (the sim's rotation, its starters first), then the rest of the healthy men best first:
// what the Team screen lists, the order the GM moves men in, and the five a key moment puts on the floor
export function coachOrder(F, s, rotationOf, opts) {
  const T = F.teams[s]
  const rot = rotationOf(F, s, opts).map(x => T.r.find(p => p.i === x.i)).filter(Boolean)
  return [...rot, ...T.r.filter(p => !p.tw && healthy(p) && !rot.includes(p)).sort((a, b) => b.o - a.o)]
}
