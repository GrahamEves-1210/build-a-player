// SQUAD BUILDER: pick a few positions, build a player for each, drop them on a
// real team (its roster fills every spot you didn't build) and play one season
// together: one schedule, one record, a stat line per build. Then run it back:
// add a player, cut one or change the team, and play another season.
//
// One squad per sport, saved on the device as plain data (and, signed in, on the
// account: lib/squadCloud.js). The season itself is lib/squadSeason.js.

import { queueSquadSave, deleteCloudSquad, fetchCloudSquad, mergeSquads } from './squadCloud'

// How many of each position a squad can carry (never shown as text: the tile shakes)
export const CAPS = {
  nfl: { qb: 1, rb: 2, wr: 3, te: 2, db: 4 },
  bucket: { guard: 3, big: 2 },
}
export const POSITIONS = { nfl: ['qb', 'rb', 'wr', 'te', 'db'], bucket: ['guard', 'big'] }
export const POS_LABEL = { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', db: 'DB', guard: 'GUARD', big: 'BIG' }
export const POS_NAME = { qb: 'Quarterback', rb: 'Running Back', wr: 'Wide Receiver', te: 'Tight End', db: 'Defensive Back', guard: 'Guard', big: 'Big' }
export const fullSize = sport => Object.values(CAPS[sport] ?? {}).reduce((a, b) => a + b, 0)
const V = 1
// Basketball's five spots: the 1–3 are guards, the 4–5 bigs. A basketball squad is
// picked by spot (each one once, squad.lineup: slot id → spot); its build is the
// spot's guard or big.
export const SPOTS = [
  { pos: 'guard', label: 'PG', name: 'Point Guard' }, { pos: 'guard', label: 'SG', name: 'Shooting Guard' }, { pos: 'guard', label: 'SF', name: 'Small Forward' },
  { pos: 'big', label: 'PF', name: 'Power Forward' }, { pos: 'big', label: 'C', name: 'Center' },
]

export const countOf = (slots, pos) => slots.filter(s => s.pos === pos).length
export const canAdd = (sport, slots, pos) => countOf(slots, pos) < (CAPS[sport]?.[pos] ?? 0)
// Where each basketball slot plays (slot id → spot): its spot on the board, or the
// first open one at its position (squads picked before there were spots)
export function spotsOf(sq) {
  const at = {}, used = new Set(), later = []
  for (const s of sq.slots) {
    const i = sq.lineup?.[s.id]
    if (SPOTS[i]?.pos === s.pos && !used.has(i)) { at[s.id] = i; used.add(i) } else later.push(s)
  }
  for (const s of later) {
    const i = SPOTS.findIndex((sp, j) => sp.pos === s.pos && !used.has(j))
    if (i >= 0) { at[s.id] = i; used.add(i) }
  }
  return at
}
export const spotOpen = (sq, i) => !!SPOTS[i] && !Object.values(spotsOf(sq)).includes(i)
export const nextToBuild = squad => squad?.slots.find(s => !s.build) ?? null
export const isFull = squad => !!squad && squad.slots.length >= fullSize(squad.sport) && squad.slots.every(s => s.build)
// a slot id that's never been used in this squad
const newId = squad => `p${squad.nextId ?? squad.slots.length}`

// A fresh squad from the positions picked (basketball: the spots), each one built next, in order
export function newSquad({ sport, uid, picks }) {
  const sq = { v: V, sport, uid: uid ?? null, seed: Math.random().toString(36).slice(2, 10), slots: [], nextId: 0, team: null, lineup: {}, seasons: [], last: null, phase: 'build', sandbox: false, started: Date.now() }
  return addSlots(sq, picks)
}
export function addSlots(sq, picks) {
  let out = { ...sq, slots: [...sq.slots] }
  for (const pick of picks) {
    const spot = out.sport === 'bucket' ? pick : null
    const pos = spot != null ? SPOTS[spot]?.pos : pick
    if (spot != null ? !spotOpen(out, spot) : !canAdd(out.sport, out.slots, pos)) continue
    const id = newId(out)
    out.slots.push({ id, pos, build: null, types: null })
    out = { ...out, nextId: (out.nextId ?? 0) + 1, ...(spot != null && { lineup: { ...out.lineup, [id]: spot } }) }
  }
  return out
}
// A finished build goes into its slot; sandbox anywhere marks the whole squad
export function fillSlot(sq, id, build, types, sandbox) {
  const slots = sq.slots.map(s => (s.id === id ? { ...s, build, types, sandbox: !!sandbox } : s))
  return { ...sq, slots, sandbox: !!(sq.sandbox || sandbox) }
}
export function dropSlot(sq, id) {
  const lineup = { ...(sq.lineup || {}) }
  delete lineup[id]
  const slots = sq.slots.filter(s => s.id !== id)
  // the sandbox mark only goes when no sandbox build is left
  return { ...sq, slots, lineup, sandbox: slots.some(s => s.sandbox) }
}
// Where the squad goes next, once every slot is built: a team first, then the season
export const afterBuilding = sq => (!sq.team ? 'team' : 'ready')

// ── Saves ────────────────────────────────────────────────────────────────────
const key = (sport, uid) => `bap_squad_${sport}_${uid || 'guest'}`
const good = (sq, sport) => !!sq && sq.v === V && sq.sport === sport && Array.isArray(sq.slots)
export function loadSquad(sport, uid) {
  dropOldSaves()
  try { const sq = JSON.parse(localStorage.getItem(key(sport, uid))); return good(sq, sport) ? sq : null } catch { return null }
}
const same = (a, b) => { try { return JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 }) } catch { return false } }
// Every save that changes something stamps `updatedAt` and (signed in) queues the account's copy
export function saveSquad(sq) {
  if (!sq) return
  try {
    const prev = loadSquad(sq.sport, sq.uid)
    if (prev?.updatedAt && same(prev, sq)) return
    const s = { ...sq, updatedAt: Date.now() }
    localStorage.setItem(key(sq.sport, sq.uid), JSON.stringify(s))
    queueSquadSave(s)
  } catch {}
}
export function clearSquad(sport, uid) { try { localStorage.removeItem(key(sport, uid)) } catch {}; deleteCloudSquad(sport, uid) }
// Signed in: the account's squad merged with this device's; offline, the device's copy stands
export async function syncSquadFromCloud(sport, uid) {
  if (!uid) return loadSquad(sport, uid)
  const cloud = await fetchCloudSquad(sport, uid)
  const local = loadSquad(sport, uid)
  if (cloud === undefined) return local
  const remote = good(cloud, sport) ? { ...cloud, uid } : null
  const merged = mergeSquads(local, remote)
  if (!merged) return null
  try { localStorage.setItem(key(sport, uid), JSON.stringify(merged)) } catch {}
  if (!remote || !same(merged, remote)) queueSquadSave({ ...merged, updatedAt: Date.now() })
  return merged
}

// The road mode this replaced kept its runs under bap_takeover_*: nothing reads them now
let dropped = false
function dropOldSaves() {
  if (dropped) return
  dropped = true
  try {
    const old = []
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith('bap_takeover_')) old.push(k) }
    old.forEach(k => localStorage.removeItem(k))
  } catch {}
}
