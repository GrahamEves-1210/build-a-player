// FRANCHISE: player development. XP (games and practice, week.js giveXp) becomes upgrade points; a point buys a
// grade on a trait, more for the high ones. The tier (NORMAL / STAR / SUPERSTAR / ELITE) sets how fast XP comes;
// a young player can earn a tier up through a breakout stretch. Then the other direction: every offseason the
// body ages by position (the ages and classes are Career's: lib/careerAging.js FADE), the legs first, strength
// later, technique last, the reads never.
import { FADE } from '../careerAging'
import { DEV, clamp, slotOf } from './consts'
import { rngOf, roll } from './rng'
import { TYPES_OF, ovrOf, reOvr, traitLabel } from './players'
import { addNews, nick } from './core'

// what a grade costs in upgrade points, from where the trait stands
export const upgradeCost = val => (val >= 11 ? null : val >= 10 ? 3 : val >= 9 ? 2 : 1)
export function canUpgrade(p, trait) {
  const v = p.a[trait]
  if (v == null) return false
  const c = upgradeCost(v)
  return c != null && (p.pts ?? 0) >= c
}
export function applyUpgrade(p, trait) {
  const c = upgradeCost(p.a[trait])
  p.pts -= c; p.a[trait]++
  p.up = (p.up ?? 0) + 1
  reOvr(p)
}
// What a grade on each trait is worth to a position's OVR, read once off the OVR formula itself (one trait at an
// S against all at F), so the staff's choice costs nothing to make
const WEIGHT = {}
function weightsOf(pos, sub) {
  const key = `${pos}|${sub ?? ''}`
  if (WEIGHT[key]) return WEIGHT[key]
  const types = TYPES_OF[pos], zero = Object.fromEntries(types.map(t => [t, 3])), base = ovrOf(pos, zero, sub), w = {}
  for (const t of types) { zero[t] = 11; w[t] = Math.max(0.2, ovrOf(pos, zero, sub) - base); zero[t] = 3 }
  return (WEIGHT[key] = w)
}
// The staff's choice: the grade that buys the most OVR for the points (cheap grades before expensive ones)
export function bestUpgrade(p) {
  const types = TYPES_OF[p.pos], w = weightsOf(p.pos, p.sub)
  let best = null, bestGain = -1
  for (let i = 0; i < types.length; i++) {
    const t = types[i], c = upgradeCost(p.a[t])
    if (c == null || (p.pts ?? 0) < c) continue
    // (a small, fixed lean by the man: two players at a position do not grow into the same player)
    const gain = w[t] / c * (0.85 + ((p.id * 31 + i * 17) % 13) / 40)
    if (gain > bestGain) { bestGain = gain; best = t }
  }
  return best
}
export function spendPoints(p) {
  let n = 0
  for (let guard = 0; guard < 40 && (p.pts ?? 0) > 0; guard++) {
    const t = bestUpgrade(p)
    if (!t) break
    applyUpgrade(p, t); n++
  }
  return n
}

// ── Tiers ────────────────────────────────────────────────────────────────────
// a rookie's tier shows once he has played four games' worth
export function revealTiers(F) {
  for (const id in F.players) {
    const p = F.players[id]
    if (p.devKnown || (p.devGames ?? 0) < 4) continue
    p.devKnown = true; delete p.devGames
    if (p.team === F.team && p.dev >= 1) addNews(F, 'milestone', `${p.name} looks like a ${DEV[p.dev]} talent`, { team: p.team, pid: p.id, body: `Four games in, the staff has seen enough of the rookie ${slotOf(p)}: ${DEV[p.dev]} development.` })
  }
}
// A breakout: a young player producing well above his billing over a stretch earns a tier. score: his per-game
// production against the league's best at his position (0-1); devCoach: the head coach's talent development.
export function tryBreakout(F, p, score, devCoach) {
  if (p.age > 25 || p.dev >= 3 || !p.devKnown || p.brk === F.year) return false
  const bar = [0.7, 0.8, 0.9][p.dev]
  if (score < bar) return false
  const R = rngOf(`${F.seed}-${F.year}-${F.week}-brk-${p.id}`)
  if (!R.chance(clamp(0.2 + (score - bar) * 1.2 + (devCoach - 5.5) * 0.03, 0.05, 0.7))) return false
  p.dev++; p.brk = F.year
  addNews(F, 'milestone', `${p.name} is breaking out for the ${nick(p.team)}`, { team: p.team, pid: p.id, body: `The ${p.age}-year-old ${slotOf(p)} has played his way up a tier: ${DEV[p.dev]} development.` })
  return true
}

// ── Aging ────────────────────────────────────────────────────────────────────
const RATE = { quick: [0.55, 0.85, 1.05, 1.15], power: [0.4, 0.7, 0.95, 1.05], skill: [0.28, 0.55, 0.85, 0.95] }
const PACE = { ol: 0.8, k: 1.4, qb: 1.6 }
// One offseason of age for one man. Returns the traits that slipped ([] most years before his turn).
export function ageOne(F, p) {
  const fade = FADE.nfl[p.pos]
  if (!fade) return []
  const gene = (0.8 + roll(`gene-${p.id}-${p.name}`) * 0.45) * (PACE[p.pos] ?? 1)
  const R = rngOf(`${F.seed}-${F.year}-age-${p.id}`)
  const out = []
  for (const t in fade) {
    const [cls, from] = fade[t]
    if (p.age < from || !(p.a[t] > 1)) continue
    const yrs = p.age - from, rate = RATE[cls][Math.min(3, Math.floor(yrs / 2))]
    // the chance this trait gives a grade this year (two in the worst years)
    const chance = rate * gene * 0.62
    if (R.chance(Math.min(0.95, chance))) { p.a[t]--; out.push(t); if (chance > 1 && p.a[t] > 1 && R.chance(chance - 1)) p.a[t]-- }
    if (out.length >= (yrs >= 4 ? 4 : 3)) break
  }
  if (out.length) reOvr(p)
  return out
}
export const slipText = (p, traits) => traits.map(t => traitLabel(p.pos, t).label).join(', ')
