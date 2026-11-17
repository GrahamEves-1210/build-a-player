// One seeded spin as the build page deals it: the team spin #i lands on, and the player the
// player wheel lands on (a regular spin, a player respin, a team respin). SpinScreen deals from
// these; the servers check every deal with their own copy (competeCore legalSlots), and
// scripts/blacktop-seat-check.mjs keeps the two in step. Pure.
import { seededShuffle, seededTeamOrder } from './rng'

// sorted: the wheel's teams in a fixed order (by short). free: a team respin, the seat's own draw:
// the first of its own order that isn't the team spin #i dealt (competeCore respinTeam)
export function dealTeam({ seed, respinSeed = null, sorted, i, free = false }) {
  const order = seededTeamOrder(sorted, `${seed}:teams`)
  const dealt = order[i % order.length]
  if (!free) return dealt
  if (!respinSeed) return null
  const mine = seededTeamOrder(sorted, `${respinSeed}:teams:${i}`)
  return mine.find(t => t.short !== dealt?.short) ?? mine[0] ?? null
}

// roster: the team's players sorted by name. draw: 0 for the spin, 1+ after player respins.
// own: a respin dealt from the seat's own seed (a respun team, or a player respin)
export function dealPlayer({ seed, respinSeed = null, roster, team, i, draw = 0, own = false, free = false }) {
  if (!roster.length) return null
  if (own) {
    const mine = seededShuffle(roster, `${respinSeed}:${i}:${team.short}`)
    // a respun team: its own draws in order
    if (free) return mine[draw % mine.length]
    // a player respin: never the player this spin dealt (a team of two: always the other one)
    const dealt = seededShuffle(roster, `${seed}:${i}:${team.short}`)[0]
    const rest = mine.filter(p => p.name !== dealt?.name)
    return rest.length ? rest[(draw - 1) % rest.length] : mine[0]
  }
  const order = seededShuffle(roster, `${seed}:${i}:${team.short}`)
  return order[draw % order.length]
}
