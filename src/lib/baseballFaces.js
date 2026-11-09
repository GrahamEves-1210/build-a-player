// Baseball faces for a saved build (the Trophy Case): a saved season keeps each trait's player by name and team,
// not his ESPN id, so this maps 'Name|TEAM' (and the name alone) to his ESPN headshot. The rosters and the photo
// map come in their own lazy chunks, read only the first time a baseball face is asked for, so no other sport
// ever loads them. No match: null (the face shows initials).
import { HEADSHOT_BASE } from '../utils/simulation'

let ready = null
export function loadBaseballFaces() {
  ready ??= Promise.all([
    import('../data/mlb-batters'), import('../data/mlb-pitchers'), import('../data/mlb-legend-batters'), import('../data/mlb-legend-pitchers'),
    import('../data/mlb-headshots.json'),
  ]).then(([b, p, lb, lp, hs]) => {
    const files = hs.default ?? {}
    const out = new Map()
    for (const pl of [...b.MLB_BATTERS, ...p.MLB_PITCHERS, ...lb.MLB_LEGEND_BATTERS, ...lp.MLB_LEGEND_PITCHERS]) {
      const f = pl.espn != null ? files[String(pl.espn)] : null
      if (!f) continue
      const src = `${HEADSHOT_BASE}/${String(f).replace(/\.(webp|png|jpe?g)$/i, '')}.webp`
      out.set(`${pl.name}|${pl.team}`, src)
      if (!out.has(pl.name)) out.set(pl.name, src)
    }
    return out
  }, () => { ready = null; return new Map() })
  return ready
}
export const baseballFace = (faces, name, team) => (faces ? faces.get(`${name}|${team}`) ?? faces.get(name) ?? null : null)
