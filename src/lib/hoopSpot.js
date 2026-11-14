// Basketball's five spots (PG, SG, SF, PF, C) and the one a build leans to. Shared by the one-off season's
// starting five (components/BucketSimPage.jsx) and Career, where an older save with no spot of its own takes
// this one (lib/career.js hoopSpot).

// Your spot in the five, from your build. Each position leans on its own ratings,
// measured against the build's own average (a flat build lands in the middle: SG, or C):
//   PG passing, handles, IQ, speed (not size) | SG jump shot, finishing, clutch
//   SF size, perimeter D, bounce, finishing   | PF jump shot, playmaking, speed
//   C  size, rebounding, interior D (not speed)
const SPOT_LEANS = {
  guard: [
    { passing: 1.3, handles: 1.1, basketballIQ: 0.7, speed: 0.4, size: -0.5 },
    { jumpShot: 1.4, finishing: 0.6, clutch: 0.5, handles: 0.3, size: -0.1 },
    { size: 1.0, perimeterDefense: 0.9, bounce: 0.6, finishing: 0.5, passing: -0.3 },
  ],
  big: [
    { jumpShot: 1.2, playmaking: 0.8, speed: 0.7, bounce: 0.4, size: -0.4 },
    { size: 1.1, rebounding: 1.0, interiorDefense: 1.1, speed: -0.5, jumpShot: -0.3 },
  ],
}
export function buildSpot(build, isBig) {
  const leans = SPOT_LEANS[isBig ? 'big' : 'guard']
  const vals = Object.values(build ?? {}).map(c => c?.val).filter(v => typeof v === 'number')
  if (!vals.length) return 1
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const scores = leans.map(l => Object.entries(l).reduce((sum, [t, w]) => sum + w * ((build?.[t]?.val ?? mean) - mean), 0))
  const best = Math.max(...scores)
  return scores.filter(x => Math.abs(x - best) < 1e-9).length > 1 ? 1 : scores.indexOf(best)   // a tie: SG, or C
}

// The five, in order, and the builder each one uses: a PG, SG or SF is built as a guard, a PF or C as a big
export const HOOP_SPOTS = ['PG', 'SG', 'SF', 'PF', 'C']
export const HOOP_SPOT_NAME = { PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward', PF: 'Power Forward', C: 'Center' }
export const hoopGroupOf = spot => (spot === 'PF' || spot === 'C' ? 'big' : 'guard')
export const hoopSpotsOf = group => (group === 'big' ? ['PF', 'C'] : ['PG', 'SG', 'SF'])
// the spot a build leans to, within its builder (a guard's PG, SG or SF; a big's PF or C)
export const leanSpot = (build, group) => hoopSpotsOf(group)[buildSpot(build, group === 'big')] ?? (group === 'big' ? 'PF' : 'SG')
