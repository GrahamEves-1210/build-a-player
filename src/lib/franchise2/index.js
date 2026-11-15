// FRANCHISE (take two, 2026-11-14): the engine. Pure and seeded; the state (F) is plain JSON, saved in one of
// three slots on this device. The screens are components/franchise2.
import { TEAM, SHORTS, FIRST_YEAR, buildTeams, calibrate, makeBuilt, payroll, lineup, strength } from './league'
import { makeSchedule } from './schedule'
import { makeClass, packClass, unpackClass } from './draft'
import { rngOf, clamp, r1 } from './rng'
import { recText, records } from './standings'
import { takenOn, legalFor, pickNumber, cleanName, rookieSlots } from './identity'

export * from './league'
export * from './season'
export * from './offseason'
export * from './draft'
export * from './coach'
export * from './identity'
export * from './roster'
export * from './contracts'
export * from './stats'
export * from './aging'
export * from './awards'
export * from './market'
export * from './news'
export { standings, records, recText, pct, ROUNDS, ROUND_NAME, FINISH_TEXT, finishOf } from './standings'
export { DIVISIONS, DIV_OF, CONF_OF, CONFS } from './schedule'
export { clockText, periodOf, spotText, normalRate } from './game'

export const SAVE_V = 6

// setup: { seed, team, slot, owner, sandbox, builds: [{ pos, build, types, sandbox, name, num }],
//         coach: coach.js finishCoach { name, face, style, r: { the five ratings }, from, ovr } }
// A build is a rookie (22, his first year): his name and number are the ones the player gave him (identity.js)
export function createFranchise(setup) {
  const F = {
    v: SAVE_V, seed: setup.seed, slot: setup.slot ?? 0, owner: setup.owner ?? 'Guest', sandbox: !!setup.sandbox,
    team: setup.team, year: FIRST_YEAR, nid: 1, builds: [], hist: [], retired: [], rings: 0, board: [], sp: 3, at: 0,
    coach: setup.coach ?? null,
  }
  buildTeams(F)
  calibrate(F)
  const R = rngOf(`${F.seed}-builds`)
  const t = F.teams[F.team]
  const slots = rookieSlots(setup.builds ?? [])
  for (const b of setup.builds ?? []) {
    const idx = F.builds.length
    const taken = takenOn(F.team, F.builds)
    const num = legalFor(b.pos, b.num) && !taken.has(b.num) ? b.num : pickNumber(b.pos, taken, R.u)
    const name = cleanName(b.name).trim() || null
    F.builds.push({ pos: b.pos, build: b.build, types: b.types ?? null, name, num, age: 22, rk: F.year, slot: slots[idx], car: [], ...(b.sandbox && { sandbox: 1 }) })
    t.r.push(makeBuilt(F, idx, R))
  }
  // the budget: what a team in this league spends, a little over; the player's team always starts under it
  const avg = SHORTS.reduce((a, s) => a + payroll(F.teams[s].r), 0) / SHORTS.length
  F.budget = r1(Math.max(avg * 1.06, payroll(t.r) + 6))
  const real = TEAM[F.team]
  F.hype = clamp(20, 80, Math.round(45 + (real.off + real.def - 12) * 3))
  F.chem = 55
  F.sched = makeSchedule(F.seed, F.year)
  F.wk = 0; F.log = []; F.ss = {}; F.po = null; F.phase = 'season'; F.streak = 0; F.nextEv = 3; F.moments = 0
  F.lastStarters = Object.values(lineup(t)).map(p => p.i)
  makeClass(F)
  return F
}

// ── Saves: three slots on this device ────────────────────────────────────────
const KEY = slot => `bap_fr2_slot_${slot}`
export const SLOTS_N = 3
// packed: a man is a row of values (the keys once, not on every man), a league ~60 KB
// a man as a row: the fields every man has, in order, then (if he has any) an object of the rest (a rookie's college,
// draft slot and ratings, an injury, a career): no nulls held for what most men don't have
const PK = ['i', 'n', 'p', 's', 'o', 'ag', 'pk', '$', 'y', 'g', 'nu', 'rk', 'c', 'dr', 'a', 'tg']
const row = (keys, x) => {
  const a = keys.map(k => x[k] ?? null)
  const more = {}
  for (const k in x) if (!keys.includes(k) && x[k] != null) more[k] = x[k]
  if (Object.keys(more).length) a.push(more)
  else while (a.length && a[a.length - 1] === null) a.pop()
  return a
}
const obj = (keys, a) => { const x = {}; keys.forEach((k, j) => { if (a[j] != null) x[k] = a[j] }); const m = a[keys.length]; if (m && typeof m === 'object') Object.assign(x, m); return x }
export function packFranchise(F) {
  if (!F.teams) return JSON.stringify(F)
  const teams = Object.fromEntries(Object.entries(F.teams).map(([s, t]) => [s, { ...t, r: t.r.map(p => row(PK, p)) }]))
  return JSON.stringify({ ...F, teams, fa: (F.fa ?? []).map(p => row(PK, p)), dc: packClass(F.dc), pk: 1 })
}
export function unpackFranchise(json) {
  const F = JSON.parse(json)
  if (!F?.pk) return F
  delete F.pk
  for (const t of Object.values(F.teams)) t.r = t.r.map(a => obj(PK, a))
  F.fa = (F.fa ?? []).map(a => obj(PK, a))
  F.dc = unpackClass(F.dc)
  return F
}
export function saveFranchise(F) {
  try { F.at = Date.now(); localStorage.setItem(KEY(F.slot ?? 0), packFranchise(F)); return true } catch { return false }
}
export function loadFranchise(slot) {
  try { const s = localStorage.getItem(KEY(slot)); if (!s) return null; const F = unpackFranchise(s); return F && F.v === SAVE_V && !F.setup && F.teams ? F : null } catch { return null }
}
export function clearFranchise(slot) { try { localStorage.removeItem(KEY(slot)) } catch {} }
// a slot's line on the slot screen, without keeping the whole save around
export function slotSummary(slot) {
  let raw = null
  try { raw = JSON.parse(localStorage.getItem(KEY(slot))) } catch {}
  if (raw?.setup) return { slot, setup: true, team: raw.setup.team ?? null }
  const F = loadFranchise(slot)
  if (!F) return null
  const r = F.sched ? records(F)[F.team] : { w: 0, l: 0, t: 0 }
  return { slot, team: F.team, year: F.year, rec: recText(r), rings: F.rings ?? 0, phase: F.phase, wk: F.wk, sandbox: F.sandbox, at: F.at }
}
// the setup, kept in its slot while it's being made (the builds are made on the build page, one at a time)
export function saveSetup(slot, setup) { try { localStorage.setItem(KEY(slot), JSON.stringify({ v: SAVE_V, slot, setup, at: Date.now() })) } catch {} }
export const saveSize = F => packFranchise(F).length
// the team's OVR and grades now
export { strength }
