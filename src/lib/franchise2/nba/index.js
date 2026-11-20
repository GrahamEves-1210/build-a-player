// NBA FRANCHISE: the engine's front door. createNbaFranchise, the saves (their own keys: never football's), and
// everything the screens read. The state's shape: STATE.md.
import { buildTeams, SHORTS, TEAM, FIRST_YEAR, teamOvr, ROSTER_MAX, TYPES, DIV_OF, CONF_OF } from './league'
import { CAR_K } from './offseason'
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
// a man as a row: the keys every man has, then an object of the rest; his ten ratings as a list in his group's order,
// his career rows as lists (CAR_K's order), so a league ten seasons in stays well under 400 KB
const PK = ['i', 'n', 'p', 'g', 'o', 'pk', 'ag', 'ht', 'wt', 'num', 'ys', '$', 'y', 'h', 'tw', 'rk']
const packMan = x => {
  const y = { ...x }
  if (y.a && TYPES[y.g]) y.a = TYPES[y.g].map(t => y.a[t] ?? 0)
  if (y.car) y.car = y.car.map(c => [c.y - 2000, c.s, ...CAR_K.map(k => c[k] ?? 0), ...(c.po || c.y2 ? [c.po ?? 0] : []), ...(c.y2 ? [c.y2 - 2000] : [])])
  const a = PK.map(k => y[k] ?? null)
  const more = {}
  for (const k in y) if (!PK.includes(k) && y[k] != null) more[k] = y[k]
  if (Object.keys(more).length) a.push(more)
  else while (a.length && a[a.length - 1] === null) a.pop()
  return a
}
const unpackMan = a => {
  const x = {}
  PK.forEach((k, j) => { if (a[j] != null) x[k] = a[j] })
  const m = a[PK.length]
  if (m && typeof m === 'object' && !Array.isArray(m)) Object.assign(x, m)
  if (Array.isArray(x.a) && TYPES[x.g]) x.a = Object.fromEntries(TYPES[x.g].map((t, j) => [t, x.a[j]]))
  if (x.car) x.car = x.car.map(c => (Array.isArray(c) ? { y: c[0] + 2000, s: c[1], ...Object.fromEntries(CAR_K.map((k, j) => [k, c[j + 2]])), ...(c[CAR_K.length + 2] && { po: c[CAR_K.length + 2] }), ...(c[CAR_K.length + 3] != null && { y2: c[CAR_K.length + 3] + 2000 }) } : c))
  return x
}
const PICK = ['y', 'r', 'o', 't', 'pr', 'sw', 'n']
export function packNba(F) {
  const teams = Object.fromEntries(Object.entries(F.teams).map(([s, t]) => [s, { ...t, r: t.r.map(packMan) }]))
  // the schedule as rows: [d, h, a, k, hs, as, ot]
  // (the schedule as rows of numbers: [day, home, away, home score, away score, overtimes], the teams by index; the
  // game's kind is the two teams' conference and division)
  const sched = (F.sched ?? []).map(g => { const r = [g.d, SHORTS.indexOf(g.h), SHORTS.indexOf(g.a)]; if (g.hs != null) r.push(g.hs, g.as); if (g.ot) r.push(g.ot); return r })
  const picks = (F.picks ?? []).map(p => PICK.map(k => p[k] ?? null))
  return JSON.stringify({ ...F, teams, fa: (F.fa ?? []).map(packMan), dc: (F.dc ?? []).map(packMan), sched, picks, pk: 2 })
}
export function unpackNba(json) {
  const F = JSON.parse(json)
  if (!F?.pk) return F
  const v2 = F.pk === 2
  delete F.pk
  for (const t of Object.values(F.teams)) t.r = t.r.map(unpackMan)
  F.fa = (F.fa ?? []).map(unpackMan); F.dc = (F.dc ?? []).map(unpackMan)
  F.sched = F.sched.map(r => {
    if (typeof r[1] === 'string') { const [d, h, a, k, hs, as, ot] = r; return { d, h, a, k, ...(hs != null && { hs, as }), ...(ot && { ot }) } }
    const [d, hi, ai, hs, as, ot] = r, h = SHORTS[hi], a = SHORTS[ai]
    return { d, h, a, k: DIV_OF[h] === DIV_OF[a] ? 'div' : CONF_OF[h] === CONF_OF[a] ? 'conf' : 'other', ...(hs != null && { hs, as }), ...(ot && { ot }) }
  })
  if (v2) F.picks = (F.picks ?? []).map(r => { const p = {}; PICK.forEach((k, j) => { if (r[j] != null) p[k] = r[j] }); if (!p.pr) p.pr = null; return p })
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
