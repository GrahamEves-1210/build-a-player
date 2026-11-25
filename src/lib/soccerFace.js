// A soccer player's photo (the key under HEADSHOT_BASE, no extension): his ESPN headshot where ESPN has one
// (data/soccer-headshots.json), else his FotMob studio photo framed like ESPN's (data/soccer-fotmob-headshots.json,
// "Name|TEAM" -> FotMob id, public/headshots/soccer/fmr-<id>.webp; scripts/soccer/fetch-fotmob-headshots.mjs makes
// both). No photo at all: null (initials or the crest carry it; never a stand-in).
import ESPN from '../data/soccer-headshots.json'
import FM from '../data/soccer-fotmob-headshots.json'

// by name too, for a player seen under another code (a Career transfer, a club man in his nation's squad), when
// the name means one man only
const BY_NAME = new Map()
for (const [k, id] of Object.entries(FM)) {
  const n = k.slice(0, k.lastIndexOf('|'))
  BY_NAME.set(n, BY_NAME.has(n) && BY_NAME.get(n) !== id ? null : id)
}
export function soccerFaceKey(p) {
  if (!p) return null
  const e = p.espn != null ? ESPN[String(p.espn)] : null
  if (e) return String(e).replace(/\.(webp|png|jpe?g)$/i, '')
  const id = FM[`${p.name}|${p.team}`] ?? BY_NAME.get(p.name)
  return id ? `soccer/fmr-${id}` : null
}
