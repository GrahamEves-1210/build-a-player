import { FRANCHISE_CARD_KEY } from '../../lib/franchiseLive'
import { calcOVR, calcOVRRB, calcOVRWR, calcOVRTE, calcOVRDB, calcOVRDL, calcOVRLB, calcOVROL, calcOVRK,
  getArchetype, getArchetypeRB, getArchetypeWR, getArchetypeTE, getArchetypeDB, getArchetypeDL, getArchetypeLB, getArchetypeOL, getArchetypeK } from '../../utils/simulation'
import { randomName } from '../../lib/playerNames'
import { LB_LIVE } from '../../lib/lbLive'
import { OL_LIVE } from '../../lib/olLive'
import { K_LIVE } from '../../lib/kLive'
import { teamOf } from './frTeams'

// FRANCHISE: what the screens keep outside the engine.
//   the engine itself (lib/franchise), loaded once when the mode opens
//   the SETUP: a new franchise being put together (the team, the spots to build and their builds, the coach,
//     the settings). It lives on the device so a trip to the build screen, to Home or a reload doesn't lose it
//   the note Home's card reads (lib/franchiseLive.js franchiseCard)
//   the league the team-select screen reads its numbers from, before there is a franchise

// ── the engine ──────────────────────────────────────────────────────────────
let ENGINE = null
export const engine = () => ENGINE
export const loadEngine = () => (ENGINE ? Promise.resolve(ENGINE) : import('../../lib/franchise').then(m => (ENGINE = m)))

// ── the setup ───────────────────────────────────────────────────────────────
// { v, slot, seed, step: 'team' | 'builds' | 'coach' | 'settings', team, picks: [{ id, pos, name, build, types, ovr, arch }],
//   nextId, coach: null | { name, build }, gmName, settings: {} }
const SETUP_KEY = 'bap_franchise_new'
export const SETUP_STEPS = ['team', 'builds', 'coach', 'settings']
export const loadSetup = () => { try { const d = JSON.parse(localStorage.getItem(SETUP_KEY)); return d && d.v === 1 && Array.isArray(d.picks) ? d : null } catch { return null } }
export const saveSetup = d => { try { if (d) localStorage.setItem(SETUP_KEY, JSON.stringify(d)); else localStorage.removeItem(SETUP_KEY) } catch {} }
const newSeed = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
export const newSetup = slot => ({ v: 1, slot, seed: newSeed(), step: 'team', team: null, picks: [], nextId: 0, coach: null, gmName: '', settings: {} })
// the mode was left for the build screen: coming back lands on the setup, not on the list of saves
let midSetup = false
export const setMidSetup = on => { midSetup = !!on }
export const isMidSetup = () => midSetup

// The positions a franchise can build, in the order a roster reads, with the game's own switches for the ones
// that came later (lib/lbLive.js, olLive.js, kLive.js). How many of each: the engine's BUILD_CAPS (Squad Builder's)
export const BUILD_POS = [
  { pos: 'qb', label: 'QB', name: 'Quarterback' }, { pos: 'rb', label: 'RB', name: 'Running Back' }, { pos: 'wr', label: 'WR', name: 'Wide Receiver' }, { pos: 'te', label: 'TE', name: 'Tight End' },
  ...(OL_LIVE ? [{ pos: 'ol', label: 'OL', name: 'Offensive Line' }] : []), { pos: 'dl', label: 'DL', name: 'Defensive Line' }, ...(LB_LIVE ? [{ pos: 'lb', label: 'LB', name: 'Linebacker' }] : []),
  { pos: 'db', label: 'DB', name: 'Defensive Back' }, ...(K_LIVE ? [{ pos: 'k', label: 'K', name: 'Kicker' }] : []),
]
export const POS_LABEL = Object.fromEntries(BUILD_POS.map(p => [p.pos, p.label]))
const ORDER = Object.fromEntries(BUILD_POS.map((p, i) => [p.pos, i]))
export const countAt = (d, pos) => d.picks.filter(p => p.pos === pos).length
// one more spot at a position (a name comes with it: the game's generator, never one already on the list)
export function addPick(d, pos) {
  let name = randomName()
  for (let i = 0; i < 20 && d.picks.some(p => p.name === name); i++) name = randomName(name)
  const picks = [...d.picks, { id: `b${d.nextId}`, pos, name, build: null, types: null, ovr: null, arch: null }].sort((a, b) => ORDER[a.pos] - ORDER[b.pos])
  return { ...d, picks, nextId: d.nextId + 1 }
}
// one fewer: the last one added that isn't built yet, else the last one
export function dropPick(d, pos) {
  const at = d.picks.filter(p => p.pos === pos)
  const gone = [...at].reverse().find(p => !p.build) ?? at[at.length - 1]
  return gone ? { ...d, picks: d.picks.filter(p => p !== gone) } : d
}
export const patchPick = (d, id, patch) => ({ ...d, picks: d.picks.map(p => (p.id === id ? { ...p, ...patch } : p)) })
// (a player's name: letters, spaces, apostrophes, periods and hyphens, like Career's)
export const cleanName = v => String(v ?? '').replace(/[^A-Za-zÀ-ſ' .-]/g, '').replace(/\s+/g, ' ').replace(/^ /, '').slice(0, 22)

// a finished build's number and name (the position's own formula: utils/simulation.js)
const OVR = { qb: calcOVR, rb: calcOVRRB, wr: calcOVRWR, te: calcOVRTE, db: calcOVRDB, dl: calcOVRDL, lb: calcOVRLB, ol: calcOVROL, k: calcOVRK }
const ARCH = { qb: getArchetype, rb: getArchetypeRB, wr: getArchetypeWR, te: getArchetypeTE, db: getArchetypeDB, dl: getArchetypeDL, lb: getArchetypeLB, ol: getArchetypeOL, k: getArchetypeK }
export function ratingOf(pos, build, types) {
  try {
    const ovr = Math.round(OVR[pos](build, types) ?? 0)
    let arch = null
    try { arch = ARCH[pos](ovr, build, types) ?? null } catch {}
    return { ovr, arch: typeof arch === 'string' ? arch : arch?.name ?? null }
  } catch { return { ovr: null, arch: null } }
}

// ── the note for Home's card ────────────────────────────────────────────────
const title = s => String(s ?? '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
export function leaveCardNote(FR, F, slot) {
  try {
    const h = FR.hub(F), t = teamOf(h.team.short)
    const line = h.phase === 'offseason' ? `${t.nick} · ${h.year} offseason` : `${t.nick} ${h.record.text} · ${title(h.weekLabel)}`
    localStorage.setItem(FRANCHISE_CARD_KEY, JSON.stringify({ slot, team: t.short, color: t.accent, line }))
  } catch {}
}
export function dropCardNote(slot = null) {
  try {
    if (slot != null) { const c = JSON.parse(localStorage.getItem(FRANCHISE_CARD_KEY)); if (c && c.slot !== slot) return }
    localStorage.removeItem(FRANCHISE_CARD_KEY)
  } catch {}
}

// ── team select: the league before there's a franchise ──────────────────────
// The engine builds the whole league from a seed; the same seed with no builds is the league the franchise will
// start in, so the cap room, the staff and the roster grades shown here are the ones the GM will find.
let PREVIEW = null
export function previewLeague(FR, seed) {
  if (PREVIEW?.seed === seed) return PREVIEW.F
  const F = FR.createFranchise({ team: 'KC', builds: [], seed })
  PREVIEW = { seed, F }
  return F
}
// a roster's groups, each graded by the men who start there
const GROUPS = [['QB', ['QB']], ['RB', ['RB']], ['WR', ['WR']], ['TE', ['TE']], ['OL', ['LT', 'LG', 'C', 'RG', 'RT']], ['DL', ['EDGE', 'DT']], ['LB', ['LB']], ['DB', ['CB', 'S']], ['K', ['K']]]
const NAMES = { QB: 'QUARTERBACK', RB: 'RUNNING BACK', WR: 'RECEIVERS', TE: 'TIGHT END', OL: 'OFFENSIVE LINE', DL: 'DEFENSIVE LINE', LB: 'LINEBACKERS', DB: 'SECONDARY', K: 'KICKER' }
export function teamPreview(FR, P, short) {
  const rows = FR.roster(P, short)
  const starters = rows.filter(r => r.starter)
  const groups = GROUPS.map(([g, slots]) => {
    const men = starters.filter(r => slots.includes(r.at ?? r.slot))
    const pool = men.length ? men : rows.filter(r => slots.includes(r.at ?? r.slot)).slice(0, 1)
    const ovr = pool.length ? Math.round(pool.reduce((s, r) => s + r.ovr, 0) / pool.length) : null
    const best = [...pool].sort((a, b) => b.ovr - a.ovr)[0] ?? null
    return { key: g, label: NAMES[g], ovr, grade: ovr == null ? '' : FR.ovrGrade(ovr), best: best?.name ?? null }
  })
  let info = null, staff = null, cap = null
  try { info = FR.teamInfo(P, short) } catch {}
  try { staff = FR.staff(P, short) } catch {}
  try { cap = FR.capSheet(P, short) } catch {}
  return { short, groups, staff: info?.staff ?? staff, capSpace: info?.capSpace ?? cap?.space ?? null, ratings: info?.ratings ?? null, count: rows.length }
}
