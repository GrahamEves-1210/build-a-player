// A college legend shown in his NBA photo (cbb-legends.js headshot 'nba/<id>') sits on the figure the way that same photo
// does in the NBA mode: its face centre and its hand-set nudge, read off the NBA rows by name (the owner, 2026-11-12).
// A college photo (cbb_ / cbbl_) has its own framing and keeps none (or the row's own faceAdjust)
import { NBA_GUARD_PLAYERS } from '../../data/nba-guards'
import { NBA_BIG_PLAYERS } from '../../data/nba-bigs'
import { NBA_ALLTIME_GUARD_PLAYERS } from '../../data/nba-guard-legends'
import { NBA_ALLTIME_BIG_PLAYERS } from '../../data/nba-big-legends'

let byName = null
const faces = () => {
  if (byName) return byName
  byName = new Map()
  for (const p of [...NBA_GUARD_PLAYERS, ...NBA_BIG_PLAYERS, ...NBA_ALLTIME_GUARD_PLAYERS, ...NBA_ALLTIME_BIG_PLAYERS]) {
    if (!p?.name || (!p.faceCenter && !p.faceAdjust)) continue
    const had = byName.get(p.name) ?? {}
    byName.set(p.name, { faceCenter: had.faceCenter ?? p.faceCenter ?? null, faceAdjust: had.faceAdjust ?? p.faceAdjust ?? null })
  }
  return byName
}
// the row with its NBA photo's face settings laid on (its own faceAdjust, set for the college game, wins)
export function withNbaFace(p) {
  if (!p || !String(p.headshot ?? '').startsWith('nba/')) return p
  const f = faces().get(p.name)
  if (!f) return p
  return { ...p, faceCenter: p.faceCenter ?? f.faceCenter ?? undefined, faceAdjust: p.faceAdjust ?? f.faceAdjust ?? undefined }
}
