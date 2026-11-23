// FRANCHISE (take two, 2026-11-14): the engine. Pure and seeded; the state (F) is plain JSON, saved in one of
// three slots on this device. The screens are components/franchise2.
import { TEAM, SHORTS, FIRST_YEAR, buildTeams, calibrate, makeBuilt, replacedBy, payroll, lineup, strength, fillLeague, realPool, makeReal, makeDepth } from './league'
import { makeSchedule } from './schedule'
import { makeClass, packClass, unpackClass } from './draft'
import { rngOf, clamp, r1 } from './rng'
import { recText, records } from './standings'
import { takenOn, legalFor, pickNumber, cleanName, rookieSlots } from './identity'
import { defaultFace } from './faces'
import { makeRoom, cutMan, marketValue, termFor, tickDeal, dealsOnLoad, capRoom } from './contracts'
import { addNews } from './news'
import { packStaff, unpackStaff } from './coach'
import { fillPotential, buildPotential } from './potential'
import { freezeOldSeason } from './stats'
import { numbersOnLoad } from './roster'
import { tidyName } from './copy'

export * from './league'
export * from './season'
export * from './offseason'
export * from './draft'
export * from './coach'
export * from './carousel'
export * from './identity'
export * from './roster'
export * from './contracts'
export * from './stats'
export * from './aging'
export * from './awards'
export * from './market'
export * from './news'
export * from './potential'
export * from './deals'
export * from './kick'
export { outText, QOL } from './injury'
export { standings, records, recText, pct, ROUNDS, ROUND_NAME, FINISH_TEXT, finishOf } from './standings'
export { DIVISIONS, DIV_OF, CONF_OF, CONFS } from './schedule'
export { clockText, periodOf, spotText, normalRate, simSnap, SNAP_KIND } from './game'
export * from './moments'
export * from './light'
export * from './trades'
export * from './rules'

// (7: every man keeps his potential for life, the deals' state; a 6 is brought up to date on load: potential.js)
// (8: game day's moments are snaps of the game, 2026-11-16; an older save is brought up to date on load: upgradeSave)
export const SAVE_V = 8

// setup: { seed, team, slot, owner, sandbox, builds: [{ pos, build, types, sandbox, name, num, face }],
//         coach: coach.js finishCoach { name, face, style, r: { the five ratings }, from, ovr } }
// A build is a rookie (22, his first year): his name and number are the ones the player gave him (identity.js)
export function createFranchise(setup) {
  const F = {
    v: SAVE_V, seed: setup.seed, slot: setup.slot ?? 0, owner: setup.owner ?? 'Guest', sandbox: !!setup.sandbox,
    team: setup.team, year: FIRST_YEAR, nid: 1, builds: [], hist: [], retired: [], rings: 0, board: [], sp: 3, at: 0,
    coach: setup.coach ?? null, bpk: 1,
  }
  buildTeams(F)
  calibrate(F)
  const R = rngOf(`${F.seed}-builds`)
  const t = F.teams[F.team]
  const slots = rookieSlots(setup.builds ?? [])
  for (const b of setup.builds ?? []) {
    const idx = F.builds.length
    const taken = takenOn(F.team, F.builds)
    // (the number his player picked is his: only another build can hold it first; a veteran who wore it takes
    // another, roster.js fixNumbers)
    const num = legalFor(b.pos, b.num) && !F.builds.some(x => x.num === b.num) ? b.num : pickNumber(b.pos, taken, R.u)
    const name = cleanName(b.name).trim() || null
    // (his face: the one the player picked on the name step; never a real man's photo)
    const face = b.face ?? defaultFace(`${F.seed}-${idx}`, b.pos)
    F.builds.push({ pos: b.pos, build: b.build, types: b.types ?? null, name, num, face, age: 22, rk: F.year, slot: slots[idx], car: [], ...(b.sandbox && { sandbox: 1 }) })
    t.r.push(makeBuilt(F, idx, R))
  }
  // the budget: what a team in this league spends, a little over; the player's team always starts under it
  const avg = SHORTS.reduce((a, s) => a + payroll(F.teams[s].r), 0) / SHORTS.length
  F.budget = r1(Math.max(avg * 1.06, payroll(t.r) + 6))
  const real = TEAM[F.team]
  F.hype = clamp(20, 80, Math.round(45 + (real.off + real.def - 12) * 3))
  F.chem = 55
  F.sched = makeSchedule(F.seed, F.year)
  F.nt = 1   // (numbers kept by team from the start: roster.js numbersOnLoad has nothing to do)
  F.wk = 0; F.log = []; F.ss = {}; F.lg = {}; F.tst = {}; F.po = null; F.phase = 'season'; F.streak = 0; F.nextEv = 3; F.moments = 0
  // each build takes a starter's job (owner 11-18): the man he replaces (league.js replacedBy, the setup showed him)
  // leaves the team with his deal off its books and goes to the street at his market price, where a team that needs
  // him can sign him. (The kicker: the block below, the NFL's release.)
  const gone = replacedBy({ r: t.r.filter(p => p.b == null) }, F.builds).filter((p, k) => p && F.builds[k].pos !== 'k')
  for (const p of gone) {
    t.r = t.r.filter(x => x !== p)
    p.$ = marketValue(p, F.year); p.y = termFor(p); p.g = 0; delete p.rc; delete p.op; delete p.sc; delete p.nu
    F.fa = [...(F.fa ?? []), p]
  }
  // a kicker build takes the job outright: a team carries one kicker, so the veteran is released (his bonus still
  // owed is dead money, the NFL's rule) and goes to the street, where a team that needs a kicker can sign him
  if (F.builds.some(b => b.pos === 'k')) {
    for (const p of t.r.filter(x => x.p === 'k' && x.b == null)) {
      cutMan(F, p.i)
      p.$ = marketValue(p, F.year); p.y = termFor(p); p.g = 0; delete p.rc; delete p.op; delete p.sc
      F.fa = [...(F.fa ?? []), p]
    }
  }
  F.lastStarters = Object.values(lineup(t)).map(p => p.i)
  // the builds' rookie deals land on a real roster: if that puts the team over the cap, the front office makes room
  // before the GM's first day with restructures, the way NFL teams do by the new league year; the wire reports each
  // one (contracts.js makeRoom). Never a release: the roster is the GM's (2026-11-19: a Dolphins franchise opened with
  // ten men released, Malik Willis and De'Von Achane among them, and gone from the league). Still over: his call.
  for (const m of [...makeRoom(F, F.team, 0), ...makeRoom(F, F.team, 0, true)]) {
    if (m.k === 'rs') addNews(F, { k: 'sign', tag: 'RESTRUCTURED', s: F.team, text: `${real.nick} restructure ${m.n}${/s$/.test(m.n) ? "'" : "'s"} contract, clearing $${m.saves.toFixed(1)} million in cap space` })
  }
  // the league's teams over the 2026 cap on their real deals (the mode doesn't carry the room real clubs rolled over
  // from 2025): their front offices restructure the same way, so every club opens the season under the cap
  for (const s of SHORTS) if (s !== F.team && capRoom(F, s) < 0) { makeRoom(F, s, 0); if (capRoom(F, s) < 0) makeRoom(F, s, 0, true) }
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
  return JSON.stringify({ ...F, teams, fa: (F.fa ?? []).map(p => row(PK, p)), dc: packClass(F.dc), ...packStaff(F), pk: 1 })
}
export function unpackFranchise(json) {
  const F = JSON.parse(json)
  if (!F?.pk) return F
  delete F.pk
  for (const t of Object.values(F.teams)) t.r = t.r.map(a => obj(PK, a))
  F.fa = (F.fa ?? []).map(a => obj(PK, a))
  F.dc = unpackClass(F.dc)
  unpackStaff(F)
  return F
}
export function saveFranchise(F) {
  try { F.at = Date.now(); localStorage.setItem(KEY(F.slot ?? 0), packFranchise(F)); return true } catch { return false }
}
export function loadFranchise(slot) {
  try { const s = localStorage.getItem(KEY(slot)); if (!s) return null; const F = upgradeSave(unpackFranchise(s)); return F && F.v === SAVE_V && !F.setup && F.teams ? depthOnLoad(F) : null } catch { return null }
}
// An older save brought up to date, a version at a time (never thrown away)
//   6 → 7: every man's potential (potential.js)
//   7 → 8: a game waiting on one of the old key moments (F.pend: a build's mini game) is put back to before kickoff:
//          the week's other games keep their scores, and his game is played again from its seed, now with the new
//          moments (the same game up to them). Nothing else in the save changes shape: old results simply have no
//          drives or box score kept (the screens say so)
export function upgradeSave(F) {
  if (!F || F.setup || !F.teams) return F
  if (F.v === 6) { fillPotential(F); F.v = 7 }
  if (F.v === 7) { if (F.pend && !Array.isArray(F.pend.ms)) F.pend = null; F.v = 8 }
  // (any version: a save from before every game's lines were kept gets the league's season so far frozen once, as
  // the old replay had it, stats.js freezeOldSeason; and its men's numbers marked as their team's, roster.js)
  if (!F.lg) freezeOldSeason(F)
  numbersOnLoad(F)
  // (a real man's "Jr" written "Jr." the way every screen now has it: copy.js tidyName)
  for (const t of Object.values(F.teams)) for (const p of t.r) if (p.b == null) p.n = tidyName(p.n)
  for (const p of F.fa ?? []) if (p.b == null) p.n = tidyName(p.n)
  buildPotential(F)   // (the builds' ceilings: potential.js)
  return F
}
// a save read back: every room two deep (a save from before the filler backups gets them here, the same version
// kept so no franchise is lost; in the offseason the new season's cut-down does it: offseason.js newSeason), and a
// kicker on every roster (a save from before kickers: kickersOnLoad)
export function depthOnLoad(F) {
  kickersOnLoad(F)
  dealsOnLoad(F)
  if (F.phase !== 'off') fillLeague(F)
  return F
}
// A save made before the rosters carried kickers: each team gets its real kicker (ks.js) as he'd be now, his age and
// the years left on his deal moved on by the seasons played; a team whose real kicker is already somewhere else signs
// a working leg off the street. Seeded by the save, add only: the same kickers every time it's read until it's saved.
export function kickersOnLoad(F) {
  if (!F?.teams) return F
  const has = s => F.teams[s].r.some(p => p.p === 'k')
  if (SHORTS.every(has)) return F
  const R = rngOf(`${F.seed}-kickers`)
  const taken = new Set([...SHORTS.flatMap(s => F.teams[s].r), ...(F.fa ?? [])].filter(p => p.p === 'k').map(p => p.n))
  const gone = Math.max(0, (F.year ?? FIRST_YEAR) - FIRST_YEAR) + (F.phase === 'off' ? 1 : 0)
  for (const s of SHORTS) {
    if (has(s)) continue
    const r = realPool().k.find(x => x.team === s && !taken.has(x.name))
    let p
    if (r) { p = makeReal(F, r, R); p.ag += gone; for (let k = 0; k < gone && p.y > 1; k++) tickDeal(p); if (p.rk && p.rk < F.year) delete p.rk }
    else p = makeDepth(F, 'k', null, R, false, 77, F.teams[s].r)
    F.teams[s].r.push(p)
  }
  return F
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
  return { slot, team: F.team, year: F.year, rec: recText(r), rings: F.rings ?? 0, phase: F.phase, wk: F.wk, sandbox: F.sandbox, at: F.at, ...(F.pace === 'light' && { light: true }) }
}
// the setup, kept in its slot while it's being made (the builds are made on the build page, one at a time)
export function saveSetup(slot, setup) { try { localStorage.setItem(KEY(slot), JSON.stringify({ v: SAVE_V, slot, setup, at: Date.now() })) } catch {} }
export const saveSize = F => packFranchise(F).length
// the team's OVR and grades now
export { strength }
