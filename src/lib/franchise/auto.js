// FRANCHISE: the autopilot. It makes every decision the general manager can make the way the staff would: it
// is what DELEGATE does, one decision at a time, strung together. The engine's own checks drive whole leagues
// with it (scripts/franchise/check.mjs).
//   until: 'week' one week · 'season' to the end of the playoffs · 'year' through the offseason to Week 1 ·
//          a number: that many whole seasons
import { touch } from './core'
import { delegateWeek } from './actions'
import { advanceWeek } from './live'
import { advanceStage } from './offseason'

function oneWeek(F) {
  if (F.phase === 'offseason') return advanceStage(F, { auto: true })
  F = delegateWeek(F)
  return advanceWeek(F)
}
export function autopilot(F, { until = 'week' } = {}) {
  let guard = 0
  if (until === 'week') return oneWeek(F)
  if (until === 'season') { while (F.phase !== 'offseason' && guard++ < 40) F = oneWeek(F); return touch(F) }
  const seasons = typeof until === 'number' ? until : 1
  for (let k = 0; k < seasons; k++) {
    guard = 0
    while (F.phase !== 'offseason' && guard++ < 40) F = oneWeek(F)
    guard = 0
    while (F.phase === 'offseason' && guard++ < 20) F = advanceStage(F, { auto: true })
  }
  return touch(F)
}
