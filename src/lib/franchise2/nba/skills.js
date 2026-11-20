// NBA FRANCHISE: a player's basketball skills, read from his ratings (part C: the court).
//
// The roster files rate guards and bigs on different lists (data/nba-guards.js, nba-bigs.js: 0-11 grades). A man can
// carry either list, or both (a man listed in both files); what one list lacks comes from what it has and his body
// (a guard's rebounding from his size, spring and height; a big's handle from his playmaking and speed).
//
//   prof(p)            { sh, fin, pas, hnd, perD, intD, reb, blk, stl, iq, clu, spd, bnc, size, ht, big, ft, off, def }
//   ovrOf(p)           his overall, the game's one formula (utils/bucketSimulation calcBucketOVR) on his list
//   groupOfPos(pos)    'guard' (PG, SG, SF) or 'big' (PF, C)
//
// What the court reads from a man (nba/STATE.md's Man): p.i id · p.a the grades · p.g 'guard'|'big' (or p.p, his
// spot 'PG'..'C') · p.ht inches · p.o overall
import { calcBucketOVR } from '../../../utils/bucketSimulation'
import { GUARD_TYPES } from '../../../data/nba-guards'
import { BIG_TYPES } from '../../../data/nba-bigs'

export { GUARD_TYPES, BIG_TYPES }
export const BIGS = new Set(['PF', 'C'])
export const groupOfPos = pos => (BIGS.has(String(pos ?? '').toUpperCase()) ? 'big' : 'guard')
export const posOf = p => p.p ?? p.pos ?? (p.g === 'big' ? 'C' : 'SG')
export const groupOf = p => p.g ?? groupOfPos(posOf(p))
export const attrsOf = p => p.a ?? p.attrs ?? {}
export const heightOf = p => p.ht ?? p.height ?? (groupOf(p) === 'big' ? 82 : 78)
const cl = (lo, hi, v) => Math.min(hi, Math.max(lo, v))
const r1 = v => Math.round(v * 10) / 10

// his overall: the grades of his own list (a man on both lists: his group's)
export function ovrOf(p) {
  const a = attrsOf(p), g = groupOf(p), types = g === 'big' ? BIG_TYPES : GUARD_TYPES
  const build = {}
  for (const t of types) build[t] = { val: a[t] ?? fill(a, t, g, heightOf(p)) }
  return calcBucketOVR(build, types, g)
}

// a grade his list doesn't carry, from the ones it does
function fill(a, t, g, ht) {
  const v = k => a[k] ?? 5
  switch (t) {
    case 'passing': return a.playmaking ?? 4
    case 'playmaking': return a.passing ?? 4
    case 'handles': return cl(1, 11, (a.playmaking ?? 4) * 0.6 + v('speed') * 0.35)
    case 'perimeterDefense': return cl(1, 11, (a.interiorDefense ?? 5) * 0.35 + v('speed') * 0.4 + v('basketballIQ') * 0.2)
    case 'interiorDefense': return cl(1, 11, v('size') * 0.45 + (a.perimeterDefense ?? 5) * 0.3 + (ht - 78) * 0.35)
    case 'rebounding': return cl(1, 11, 1.2 + v('size') * 0.45 + v('bounce') * 0.2 + (ht - 78) * 0.3)
    default: return 5
  }
}

// The court's skills (0-11, about 6 for a league-average rotation man)
export function prof(p) {
  const a = attrsOf(p), g = groupOf(p), big = g === 'big', ht = heightOf(p)
  const v = k => a[k] ?? fill(a, k, g, ht)
  const sh = v('jumpShot'), fin = v('finishing'), iq = v('basketballIQ'), clu = v('clutch'), spd = v('speed'), bnc = v('bounce'), size = v('size')
  const pas = a.passing ?? a.playmaking ?? 4, hnd = v('handles')
  const perD = v('perimeterDefense'), intD = v('interiorDefense')
  // rebounding: a big's own grade; a guard's from his body. Height counts for both (a 7-footer's reach)
  const reb = cl(0.5, 12, v('rebounding') + (big ? (ht - 82) * 0.2 : 0))
  const blk = cl(0, 12, big ? intD * 0.5 + size * 0.2 + bnc * 0.3 + (ht - 82) * 0.35 : 0.25 * size + 0.3 * bnc + (ht - 78) * 0.45 - 0.5)
  const stl = cl(0, 12, big ? intD * 0.2 + spd * 0.3 + iq * 0.25 - 0.4 : perD * 0.55 + spd * 0.2 + iq * 0.25)
  // free throws: the shot and the touch (bigs with no jumper live at 60-70%)
  const ft = cl(0.5, 0.93, 0.78 + 0.022 * (sh - 5) + 0.008 * (iq - 6) + (big ? -0.03 : 0))
  // the offense he runs through him: creating, scoring, the head (the usage weight's base)
  const off = big ? fin * 0.34 + sh * 0.22 + pas * 0.16 + iq * 0.16 + size * 0.12 : sh * 0.28 + fin * 0.24 + hnd * 0.2 + pas * 0.1 + iq * 0.18
  const def = big ? intD * 0.45 + reb * 0.2 + size * 0.15 + iq * 0.2 : perD * 0.55 + size * 0.15 + iq * 0.15 + spd * 0.15
  return { sh, fin, pas, hnd, perD, intD, reb, blk, stl, iq, clu, spd, bnc, size, ht, big, ft, off, def }
}

export const r1s = r1
