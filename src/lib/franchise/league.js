// FRANCHISE: building the league. Thirty-two real teams, every real player the game has on his real team,
// generated depth behind them so every roster is a legal 46, real ages, development tiers, drives, contracts
// that fit under the real cap, every team's head coach and coordinators, a schedule, and the owner's goals.
import { NFL_TEAMS } from '../../data/nfl-teams'
import {
  SAVE_VERSION, FIRST_YEAR, GROUPS, MIN_AT, TARGET_AT, ROSTER_MAX, BUILD_CAPS, DEFAULT_SETTINGS, DRIVES, MIN_SALARY, VET_MIN, SLOT_BY,
  clamp, r2, groupOf, slotOf,
} from './consts'
import { rngOf } from './rng'
import { realPool, realPlayer, genPlayer, builtPlayer } from './players'
import { capFor, marketValue, marketYears, newContract, rookieDeal, payroll } from './money'
import { makeSchedule, DIVISIONS } from './schedule'
import { autoDepth } from './depth'
import { addPlayer, teamRating, TEAM_SHORTS } from './core'
import { coachRows, COACH_TYPES } from './coachData'

// ── Players ──────────────────────────────────────────────────────────────────
const SUB_OF_GROUP = { EDGE: ['dl', 'edge'], DT: ['dl', 'dt'], CB: ['db', 'cb'], S: ['db', 's'] }
const posOfGroup = g => (SUB_OF_GROUP[g] ? SUB_OF_GROUP[g] : g === 'OL' ? ['ol', null] : [g.toLowerCase(), null])
// how many of a group start (a generated man who has to start is a low-end starter, not a camp body)
const STARTS = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, EDGE: 2, DT: 2, LB: 3, CB: 2, S: 2, K: 1 }

// A tier from what he is now and how young he is (the hidden part of a draft pick; known for a veteran)
export function devFor(R, ovr, age) {
  const s = ovr + (27 - age) * 0.9 + R.n() * 3.2
  return s >= 99 ? 3 : s >= 93 ? 2 : s >= 85.5 ? 1 : 0
}
export function drivesFor(R, p) {
  const w = { MONEY: 1.1, RING: p.age >= 29 ? 1.6 : 0.8, ROLE: p.ovr < 80 || p.age <= 25 ? 1.3 : 0.7, LOYAL: 0.8, MENTOR: p.age >= 30 ? 1.2 : 0.15, COMPETITOR: 1 }
  const pick = () => DRIVES[R.wpick(DRIVES.map(d => w[d]))]
  const a = pick()
  if (R.u() < 0.45) return [a]
  let b = pick()
  for (let i = 0; i < 6 && b === a; i++) b = pick()
  return b === a ? [a] : [a, b]
}

// The deal a man is on when the league starts: a rookie deal if he is young enough to still be on one (slotted
// by how good he is), otherwise what the market would have paid him a year or three ago.
function startingDeal(R, p, cap) {
  const slot = slotOf(p)
  if (p.built) return rookieDeal(R.int(8, 28), cap)
  if (p.age <= 25 && p.exp <= 3) {
    const pick = p.ovr >= 90 ? R.int(1, 8) : p.ovr >= 85 ? R.int(5, 24) : p.ovr >= 80 ? R.int(18, 60) : p.ovr >= 75 ? R.int(45, 120) : p.ovr >= 70 ? R.int(100, 220) : R.int(180, 262)
    const d = p.gen && p.ovr < 70 ? { yrs: 2, sal: MIN_SALARY, guar: 0, rookie: 1, rd: null, opt: 0, tag: false } : rookieDeal(pick, cap)
    d.yrs = clamp(4 - p.exp, 1, 4)
    d.guar = r2(d.guar * d.yrs / 4)
    return d
  }
  const mv = marketValue(p, cap)
  const floor = p.exp >= 3 ? VET_MIN : MIN_SALARY
  // signed before this year's cap: a little under today's market, more so for the long deals
  const sal = Math.max(floor, mv * (0.8 + R.u() * 0.22))
  const full = marketYears(p)
  const yrs = clamp(full - R.int(0, Math.max(0, full - 1)), 1, 5)
  const c = newContract(p, { yrs, sal })
  if (slot === 'K' || sal <= floor * 1.3) c.guar = r2(c.guar * 0.3)
  return c
}

function buildRoster(F, R, short, taken, builds) {
  const t = F.teams[short]
  const real = [...realPool().values()].filter(r => r.team === short)
  const mine = []
  for (const row of real) mine.push(realPlayer(row))
  // the user's builds take their spots first; nobody real is cut for them (they push a starter to the bench)
  for (const b of builds) mine.push(builtPlayer(R, b, short, taken))
  const have = Object.fromEntries(GROUPS.map(g => [g, 0]))
  for (const p of mine) have[groupOf(p)]++
  const want = []
  for (const g of GROUPS) for (let i = have[g]; i < MIN_AT[g]; i++) want.push(g)
  const count = { ...have }
  for (const g of want) count[g]++
  let total = mine.length + want.length
  // then toward a full 46, the thinnest group against its target first
  while (total < ROSTER_MAX) {
    let best = null, gap = 0
    for (const g of GROUPS) { const d = TARGET_AT[g] - count[g]; if (d > gap) { gap = d; best = g } }
    if (!best) best = ['OL', 'CB', 'WR', 'LB', 'EDGE'][total % 5]
    want.push(best); count[best]++; total++
  }
  const made = { ...have }
  for (const g of want) {
    const [pos, sub0] = posOfGroup(g)
    const k = made[g]++
    const starter = k < STARTS[g]
    const sub = g === 'OL' ? ['LT', 'RG', 'C', 'RT', 'LG'][k % 5] : sub0
    const ovr = starter ? R.int(69, 74) : clamp(R.int(64, 70) - Math.max(0, k - STARTS[g] - 1), 61, 70)
    const age = starter ? R.int(24, 30) : R.int(22, 28)
    mine.push(genPlayer(R, { pos, sub, ovr, age, team: short, taken, dev: R.u() < 0.08 && age <= 24 ? 1 : 0 }))
  }
  for (const p of mine) {
    addPlayer(F, p)
    p.team = short
    if (!p.built && !p.gen) p.dev = devFor(R, p.ovr, p.age)
    if (p.built) { p.dev = 1; p.devKnown = true }
    p.drives = drivesFor(R, p)
    p.con = startingDeal(R, p, F.cap)
    p.mood = clamp(Math.round(58 + R.n() * 8), 35, 85)
    t.roster.push(p.id)
  }
}

// Every team under the cap on day one: a team that is over has its bigger deals trimmed in proportion (the way
// real teams restructure), never below the minimum.
function fitCap(F) {
  for (const short of TEAM_SHORTS) {
    const t = F.teams[short], room = F.cap * 0.975
    for (let pass = 0; pass < 6; pass++) {
      const over = payroll(F, t) - room
      if (over <= 0) break
      const big = t.roster.map(id => F.players[id]).filter(p => p.con.sal > 3 && !p.con.rookie)
      const sum = big.reduce((s, p) => s + p.con.sal, 0)
      if (!sum) break
      const k = clamp(1 - over / sum, 0.5, 1)
      for (const p of big) { p.con.sal = r2(Math.max(VET_MIN, p.con.sal * k)); p.con.guar = r2(p.con.guar * k) }
    }
  }
}

// street free agents: bodies at every position for injuries and cuts, none better than a backup
function stockFreeAgents(F, R, taken, n = 70) {
  const order = ['QB', 'RB', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'EDGE', 'DT', 'LB', 'LB', 'CB', 'CB', 'S', 'K']
  for (let i = 0; i < n; i++) {
    const g = order[i % order.length], [pos, sub0] = posOfGroup(g)
    const sub = g === 'OL' ? ['LT', 'LG', 'C', 'RG', 'RT'][R.int(0, 4)] : sub0
    const p = addPlayer(F, genPlayer(R, { pos, sub, ovr: R.int(61, 69), age: R.int(23, 31), taken }))
    p.drives = drivesFor(R, p)
    F.fa.push(p.id)
  }
}
export const topUpFreeAgents = (F, R, min = 60) => { if (F.fa.length < min) stockFreeAgents(F, R, new Set(Object.values(F.players).map(p => p.name)), min - F.fa.length + 10) }

// ── Coaches ──────────────────────────────────────────────────────────────────
// what a coach asks for a year ($M): head coaches 5 to 20, coordinators 1.5 to 6
export function coachAsk(c, role = c.role) {
  const a = c.a, top = role === 'HC' ? (a.culture + a.situational + a.talentDev + Math.max(a.offPlaycalling, a.defPlaycalling) * 2) / 5 : role === 'OC' ? a.offPlaycalling * 0.8 + a.talentDev * 0.2 : a.defPlaycalling * 0.8 + a.talentDev * 0.2
  return r2(role === 'HC' ? clamp(3.5 + (top - 3) * 2.1, 4, 20) : clamp(1 + (top - 3) * 0.7, 1.2, 6.5))
}
export function addCoach(F, row, R) {
  const c = {
    id: F.nextCoachId++, name: row.name, role: row.role, team: row.team ?? null, a: { ...row.attrs },
    real: !row.placeholder && !row.gen && !row.built, placeholder: !!row.placeholder, gen: !!row.gen, built: !!row.built,
    age: row.age ?? R.int(row.role === 'HC' ? 42 : 36, row.role === 'HC' ? 66 : 58), con: null, w: 0, l: 0, hist: [],
    ...(row.from && { from: row.from }),
  }
  F.coaches[c.id] = c
  return c
}
// a built head coach: build is the game's build format, five slots keyed by rating (or a list of slots),
// each { type, val, qbFull: the coach it came from, team }
export function builtCoachRow(coach) {
  const slots = Array.isArray(coach.build) ? Object.fromEntries(coach.build.filter(Boolean).map(s => [s.type, s])) : coach.build ?? {}
  const vals = COACH_TYPES.map(t => slots[t]?.val).filter(v => typeof v === 'number')
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 5
  return {
    name: (coach.name && String(coach.name).trim()) || 'Head Coach', role: 'HC', built: true,
    attrs: Object.fromEntries(COACH_TYPES.map(t => [t, clamp(Math.round(typeof slots[t]?.val === 'number' ? slots[t].val : avg), 0, 11)])),
    from: Object.fromEntries(COACH_TYPES.filter(t => slots[t]).map(t => [t, { name: slots[t].qbFull ?? slots[t].name ?? null, team: slots[t].team ?? null }])),
  }
}
function buildCoaches(F, R, userTeam, coach) {
  for (const row of coachRows()) {
    const c = addCoach(F, row, R)
    if (c.team && F.teams[c.team]) {
      const key = c.role.toLowerCase()
      if (F.teams[c.team].staff[key] == null) { F.teams[c.team].staff[key] = c.id; c.con = { yrs: R.int(1, 4), sal: coachAsk(c) } }
      else c.team = null   // a second man listed at a job: he is on the market
    } else c.team = null
  }
  if (coach?.build) {
    const t = F.teams[userTeam], old = F.coaches[t.staff.hc]
    if (old) { old.team = null; old.con = null }
    const c = addCoach(F, builtCoachRow(coach), R)
    c.team = userTeam; c.age = 45; c.con = { yrs: 4, sal: coachAsk(c) }
    t.staff.hc = c.id
  }
}

// ── The league ───────────────────────────────────────────────────────────────
export function checkBuilds(builds) {
  const n = {}, out = []
  for (const b of builds ?? []) {
    if (!b || !BUILD_CAPS[b.pos] || !b.build) continue
    n[b.pos] = (n[b.pos] ?? 0) + 1
    if (n[b.pos] <= BUILD_CAPS[b.pos]) out.push(b)
  }
  return out
}

export function buildLeague({ team, builds = [], gmName, coach = null, settings = {}, seed }) {
  const user = TEAM_SHORTS.includes(team) ? team : 'KC'
  const F = {
    v: SAVE_VERSION, seed: String(seed ?? 'franchise'), rev: 0, flash: null,
    team: user,
    gm: { name: (gmName && String(gmName).trim()) || 'GM', team: user, since: FIRST_YEAR, security: 62, w: 0, l: 0, t: 0, pw: 0, pl: 0, rings: 0, fired: 0, seasons: [], pts: 0, tree: {}, legacy: 0 },
    settings: { ...DEFAULT_SETTINGS, ...settings },
    year: FIRST_YEAR, week: 1, phase: 'regular', stage: null,
    cap: capFor(FIRST_YEAR),
    nextId: 1, nextCoachId: 1, players: {}, coaches: {}, teams: {}, fa: [],
    sched: null, playoffs: null,
    plan: { off: 'balanced', def: 'balanced' }, practice: { intensity: 'half', focus: [] }, done: {},
    office: [], game: null, last: null, news: [], tx: [], weekly: [],
    draft: null, owner: null, off: null, power: [], mom: {},
    hist: { seasons: [], records: {}, hall: [] },
  }
  const R = rngOf(`${F.seed}-league`)
  for (const s of TEAM_SHORTS) {
    F.teams[s] = { short: s, roster: [], depth: null, dead: 0, deadNext: 0, picks: [], staff: { hc: null, oc: null, dc: null, scout: null }, plan: { off: 'balanced', def: 'balanced' }, strat: 'middle', rec: null, st: null, hist: [] }
    for (let y = 1; y <= 3; y++) for (let r = 1; r <= 7; r++) F.teams[s].picks.push({ y: FIRST_YEAR + y, r, o: s })
  }
  const taken = new Set()
  const mine = checkBuilds(builds)
  for (const s of TEAM_SHORTS) buildRoster(F, R, s, taken, s === user ? mine : [])
  fitCap(F)
  stockFreeAgents(F, R, taken)
  buildCoaches(F, R, user, coach)
  for (const s of TEAM_SHORTS) autoDepth(F, F.teams[s])
  // last season's "finish" for year one's schedule: each division by the strength of the roster it starts with
  const order = {}
  for (const d of DIVISIONS) order[d.name] = [...d.teams].sort((a, b) => teamRating(F, F.teams[b]).ovr - teamRating(F, F.teams[a]).ovr)
  F.sched = makeSchedule(F.seed, F.year, order)
  F.order = order
  return F
}
export { NFL_TEAMS, SLOT_BY }
