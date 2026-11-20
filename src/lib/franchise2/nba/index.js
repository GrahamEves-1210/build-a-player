// NBA FRANCHISE: the engine's front door. createNbaFranchise, the saves (their own keys: never football's), and
// everything the screens read. The state's shape: STATE.md.
import { buildTeams, SHORTS, TEAM, FIRST_YEAR, teamOvr, ROSTER_MAX } from './league'
import { makeSchedule } from './schedule'
import { makePicks, makeClass } from './draft'
import { records, recText } from './season'
import { addNews } from './news'
import * as X from './seams'

export * from './league'
export * from './schedule'
export * from './season'
export * from './draft'
export * from './offseason'
export * from './news'
export * from './moments'
export { X as CAP_SIM }

export const NBA_SAVE_V = 1
export const SLOTS_N = 3

// setup: { seed, team, slot, owner, sandbox, builds: [{ spot, build, types, name, num, face }], rules: { cap, inj } }
export function createNbaFranchise(setup) {
  const F = {
    v: NBA_SAVE_V, sport: 'nba', seed: setup.seed, slot: setup.slot ?? 0, owner: setup.owner ?? 'Guest', sandbox: !!setup.sandbox,
    team: setup.team, year: FIRST_YEAR, nid: 1, builds: [], hist: [], retired: [], rings: 0, news: [], board: [], sp: 4,
    moments: setup.moments ?? 'advanced',
  }
  if (setup.rules?.cap === false) F.noCap = 1
  if (setup.rules?.inj === false) F.noInj = 1
  buildTeams(F, { dealOnLoad: X.dealOnLoad })
  F.phase = 'season'
  F.ss = {}; F.ps = {}; F.log = []; F.box = []; F.po = null
  makeSchedule(F)
  makePicks(F)
  makeClass(F)
  addNews(F, { k: 'gm', tag: 'FRONT OFFICE', s: F.team, text: `The ${TEAM[F.team].name} have named ${F.owner} general manager` })
  return F
}

// ── Saves: three slots on this device, their own keys ───────────────────────
const KEY = slot => `bap_frnba_slot_${slot}`
// a man as a row: the keys every man has, then an object of the rest
const PK = ['i', 'n', 'p', 'g', 'o', 'pk', 'ag', 'ht', 'wt', 'num', 'ys', '$', 'y', 'h', 'tw', 'rk']
const AK = { guard: null, big: null }
const row = x => {
  const a = PK.map(k => x[k] ?? null)
  const more = {}
  for (const k in x) if (!PK.includes(k) && x[k] != null) more[k] = x[k]
  if (Object.keys(more).length) a.push(more)
  else while (a.length && a[a.length - 1] === null) a.pop()
  return a
}
const obj = a => { const x = {}; PK.forEach((k, j) => { if (a[j] != null) x[k] = a[j] }); const m = a[PK.length]; if (m && typeof m === 'object' && !Array.isArray(m)) Object.assign(x, m); return x }
export function packNba(F) {
  const teams = Object.fromEntries(Object.entries(F.teams).map(([s, t]) => [s, { ...t, r: t.r.map(row) }]))
  // the schedule as rows: [d, h, a, k, hs, as, ot]
  const sched = (F.sched ?? []).map(g => [g.d, g.h, g.a, g.k, g.hs ?? null, g.as ?? null, g.ot ?? 0])
  return JSON.stringify({ ...F, teams, fa: (F.fa ?? []).map(row), dc: (F.dc ?? []).map(row), sched, pk: 1 })
}
export function unpackNba(json) {
  const F = JSON.parse(json)
  if (!F?.pk) return F
  delete F.pk
  for (const t of Object.values(F.teams)) t.r = t.r.map(obj)
  F.fa = (F.fa ?? []).map(obj); F.dc = (F.dc ?? []).map(obj)
  F.sched = F.sched.map(([d, h, a, k, hs, as, ot]) => ({ d, h, a, k, ...(hs != null && { hs, as }), ...(ot && { ot }) }))
  return F
}
export function saveNba(F) { try { F.at = Date.now(); localStorage.setItem(KEY(F.slot ?? 0), packNba(F)); return true } catch { return false } }
export function loadNba(slot) {
  try { const s = localStorage.getItem(KEY(slot)); if (!s) return null; const F = unpackNba(s); return F && F.v === NBA_SAVE_V && F.sport === 'nba' && F.teams ? F : null } catch { return null }
}
export function clearNba(slot) { try { localStorage.removeItem(KEY(slot)) } catch {} }
export const rawNbaSlot = slot => { try { const s = localStorage.getItem(KEY(slot)); return s ? JSON.parse(s) : null } catch { return null } }
export function saveNbaSetup(slot, setup) { try { localStorage.setItem(KEY(slot), JSON.stringify({ v: NBA_SAVE_V, sport: 'nba', slot, setup, at: Date.now() })) } catch {} }
export function nbaSlotSummary(slot) {
  const raw = rawNbaSlot(slot)
  if (!raw) return null
  if (raw.setup) return { slot, setup: true, team: raw.setup.team ?? null }
  const F = loadNba(slot)
  if (!F) return null
  return { slot, team: F.team, year: F.year, rec: recText(records(F)[F.team]), rings: F.rings ?? 0, phase: F.phase, at: F.at }
}
export const nbaSaveSize = F => packNba(F).length
export { records, teamOvr, SHORTS, TEAM, ROSTER_MAX }
