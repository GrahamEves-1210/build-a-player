// FRANCHISE: a build's name and number.
// Every build the player makes gets a first and last name (Career's name step: the same letters, the same
// random-name lists) and a jersey number his position may wear under the NFL's rule (2023 on):
//   QB 0-19 · RB / WR / TE 0-49 and 80-89 · OL 50-79 · DL 50-79 and 90-99 · LB 0-59 and 90-99 · DB 0-49
// and that nobody else on the team wears (the real men's numbers from the data, the other builds').
import { FIRST_NAMES, LAST_NAMES, pickName } from '../playerNames'
import { realPool } from './league'
import { buildSlot } from './contracts'
import { ovrOf } from '../squadSeason'

// a name's letters (Career's cleanName): letters, spaces, apostrophes, hyphens, periods
export const cleanName = v => String(v ?? '').replace(/[^A-Za-zÀ-ſ' .-]/g, '').replace(/\s+/g, ' ').replace(/^ /, '').slice(0, 14)
export const nameOk = (first, last) => cleanName(first).trim().length >= 2 && cleanName(last).trim().length >= 2
// a first and last name, never the one it's handed (a second tap always changes it). rnd: () => 0..1
export function randomFirstLast(not = null, rnd = Math.random) {
  let f, l
  do { f = pickName(FIRST_NAMES, rnd); l = pickName(LAST_NAMES, rnd) } while (not && f === not.first && l === not.last)
  return { first: f, last: l }
}

const span = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
export const LEGAL = {
  qb: span(0, 19), rb: [...span(0, 49), ...span(80, 89)], wr: [...span(0, 49), ...span(80, 89)], te: [...span(0, 49), ...span(80, 89)],
  ol: span(50, 79), dl: [...span(50, 79), ...span(90, 99)], lb: [...span(0, 59), ...span(90, 99)], db: span(0, 49),
}
// the numbers a position usually wears first (the picker opens on these; any legal one can be typed in)
const USUAL = { qb: span(1, 19), rb: [...span(20, 39), 0, ...span(1, 9)], wr: [...span(10, 19), ...span(80, 89), ...span(1, 9)], te: [...span(80, 89), ...span(40, 49)], ol: span(60, 79), dl: [...span(90, 99), ...span(50, 59)], lb: [...span(40, 59), ...span(0, 9)], db: [...span(20, 39), ...span(0, 9)] }
export const legalFor = (pos, n) => Number.isInteger(n) && (LEGAL[pos] ?? []).includes(n)
// the numbers the real men on a team wear (by the data)
export function realNumbers(team) {
  const out = new Map()
  const pool = realPool()
  for (const pos in pool) for (const p of pool[pos]) if (p.team === team && p.num != null) out.set(p.num, p.name)
  return out
}
// numbers already taken on the team: the real men's, and the other builds' ({ num })
export function takenOn(team, builds = []) {
  const t = new Map(realNumbers(team))
  for (const b of builds) if (b?.num != null) t.set(b.num, b.name ?? 'BUILD')
  return t
}
// the numbers the picker offers a position (the usual ones first, free ones only)
export function freeNumbers(pos, taken) {
  const seen = new Set(), out = []
  for (const n of [...(USUAL[pos] ?? []), ...(LEGAL[pos] ?? [])]) if (!seen.has(n) && legalFor(pos, n) && !taken.has(n)) { seen.add(n); out.push(n) }
  return out
}
// a number for a build that has none: the first usual free one, by the seed's draw
export function pickNumber(pos, taken, rnd = Math.random) {
  const free = freeNumbers(pos, taken)
  const usual = free.slice(0, Math.max(1, Math.min(free.length, 10)))
  return usual.length ? usual[Math.floor(rnd() * usual.length)] : (LEGAL[pos] ?? [0])[0]
}

// The draft slot each build signs his rookie deal at (contracts.js buildSlot: where a man of his OVR goes in the
// draft). Two builds can't be the same pick: the better one takes the slot, the next one the pick after it.
//   builds: [{ pos, build }] -> [slot, ...] in the same order
export function rookieSlots(builds) {
  const order = builds.map((b, i) => ({ i, o: ovrOf(b.pos, b.build) })).sort((a, b) => b.o - a.o || a.i - b.i)
  const out = [], used = new Set()
  for (const x of order) { let s = buildSlot(x.o); while (used.has(s)) s++; used.add(s); out[x.i] = s }
  return out
}
