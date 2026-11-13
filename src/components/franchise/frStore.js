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
let ENGINE_P = null
export const loadEngine = () => (ENGINE ? Promise.resolve(ENGINE) : (ENGINE_P ??= import('../../lib/franchise').then(m => (ENGINE = m), e => { ENGINE_P = null; throw e })))

// ── off the page's thread ───────────────────────────────────────────────────
// The engine's big one-off jobs (team select's 32 previews, building a new league, opening a save) run in a
// worker (frWorker.js) so the screen paints and answers taps while they work. Anything the worker can't do (no
// Worker, a failed load, an answer that can't be copied back) is done here on the page, as before.
let W = null, wid = 0
const waits = new Map()
function worker() {
  if (W !== null) return W
  try {
    W = new Worker(new URL('./frWorker.js', import.meta.url), { type: 'module' })
    W.onmessage = e => { const { id, ok, out, error } = e.data || {}; const w = waits.get(id); if (!w) return; waits.delete(id); if (ok) w.res(out); else w.rej(new Error(error)) }
    W.onerror = e => { e.preventDefault?.(); for (const w of waits.values()) w.rej(new Error('worker')); waits.clear(); try { W.terminate() } catch {} W = false }
  } catch { W = false }
  return W
}
function offThread(kind, data, onPage) {
  const w = worker()
  const page = () => loadEngine().then(onPage)
  if (!w) return page()
  return new Promise((res, rej) => { const id = ++wid; waits.set(id, { res, rej }); try { w.postMessage({ id, kind, ...data }) } catch (e) { waits.delete(id); rej(e) } }).catch(page)
}
// team select's read of all 32 clubs for a seed (kept: the same seed is asked for again by the coach step)
const PREVIEWS = new Map()
export function previewsFor(seed) {
  const k = String(seed)
  if (!PREVIEWS.has(k)) PREVIEWS.set(k, offThread('previews', { seed: k }, FR => FR.teamPreviews(k)).then(rows => { PREVIEWS.set(k, Object.assign(Promise.resolve(rows), { rows })); return rows }, e => { PREVIEWS.delete(k); throw e }))
  return PREVIEWS.get(k)
}
export const previewsNow = seed => PREVIEWS.get(String(seed))?.rows ?? null
export const createOff = opts => offThread('create', { opts }, FR => FR.createFranchise(opts))
// a save, opened (the text is read here: the worker has no localStorage)
export function openOff(slot) {
  let text = null
  try { text = localStorage.getItem(SAVE_KEY(slot)) } catch {}
  if (!text) return Promise.resolve(null)
  return offThread('unpack', { text }, FR => FR.unpackFranchise(text))
}

// ── the saves, without the engine ───────────────────────────────────────────
// (lib/franchise/save.js listSlots, read straight off the device so the list is up before the engine loads)
const SLOTS_N = 3, SAVE_VERSION = 1
const SAVE_KEY = slot => `bap_franchise_v1_${slot}`
export function slotsLite() {
  const out = []
  for (let slot = 0; slot < SLOTS_N; slot++) {
    let meta = null, head = null
    try { const t = localStorage.getItem(SAVE_KEY(slot)); head = t ? t.slice(0, 12) : null; if (head) meta = JSON.parse(localStorage.getItem(`${SAVE_KEY(slot)}_meta`) || 'null') ?? {} } catch { meta = {} }
    if (!head) { out.push({ slot, empty: true }); continue }
    const v = head.startsWith('FZ') ? parseInt(head.slice(2, head.indexOf(':')), 10) : head[0] === '{' ? 1 : NaN
    const reason = !(v >= 1) ? 'This save is damaged and could not be opened.' : v > SAVE_VERSION ? 'This save was made by a newer version of the game. Update to open it.' : !meta.team ? 'This save is damaged and could not be opened.' : null
    out.push(reason ? { slot, empty: false, broken: true, reason, ...meta } : { slot, empty: false, broken: false, ...meta })
  }
  return out
}

// ── the setup ───────────────────────────────────────────────────────────────
// { v, slot, seed, step: 'team' | 'builds' | 'coach' | 'settings', team, picks: [{ id, pos, name, build, types, ovr, arch }],
//   nextId, coach: null | { name, build }, gmName, settings: {} }
const SETUP_KEY = 'bap_franchise_new'
export const SETUP_STEPS = ['team', 'builds', 'coach', 'settings']
export const loadSetup = () => { try { const d = JSON.parse(localStorage.getItem(SETUP_KEY)); return d && d.v === 1 && Array.isArray(d.picks) ? d : null } catch { return null } }
export const saveSetup = d => { try { if (d) localStorage.setItem(SETUP_KEY, JSON.stringify(d)); else localStorage.removeItem(SETUP_KEY) } catch {} }
const newSeed = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
// the next new franchise's seed, picked when the saves are up so its 32 previews can be read before NEW is tapped
const NEXT_SEED = 'bap_franchise_next_seed'
export const nextSeed = () => { try { let s = localStorage.getItem(NEXT_SEED); if (!s) { s = newSeed(); localStorage.setItem(NEXT_SEED, s) } return s } catch { return null } }
const takeSeed = () => { const s = nextSeed(); try { localStorage.removeItem(NEXT_SEED) } catch {} return s || newSeed() }
export const newSetup = slot => ({ v: 1, slot, seed: takeSeed(), step: 'team', team: null, picks: [], nextId: 0, coach: null, gmName: '', settings: {} })
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
