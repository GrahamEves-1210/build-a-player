// The app's basketball figure: where the website puts the real player's photo on the figure's head, the app (which
// shows no photos, lib/appArt.js) draws a face in Franchise's flat style (lib/franchise2/faces.js), seeded by his
// name so he always looks the same, in his roster skin tone (the roster's `skin`), wearing his team's tank.
// Loaded only where the figure draws a head, and only when APP_ART is on.
import { lookOf, faceSvg } from './franchise2/faces'
import { toUrl } from './franchise2/faceArt'

const lumOf = c => { const h = String(c || '').replace('#', ''); if (h.length !== 6) return 140; const n = parseInt(h, 16); return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255) }
const cache = new Map()

// chip: the build's slot that gives the figure its head ({ qbFull | qb, skinColor, teamColor })
export function figureFaceUrl(chip) {
  if (!chip) return null
  const name = chip.qbFull ?? chip.name ?? chip.qb ?? 'player'
  const skin = /^#[0-9a-f]{6}$/i.test(chip.skinColor ?? '') ? chip.skinColor : '#a8774f'
  const color = chip.teamColor || '#555555'
  const k = `${name}|${skin}|${color}`
  let u = cache.get(k)
  if (!u) {
    // hair and features that go with his skin: draw him from a room that leans his way, then give him his own tone
    // (the roster tones were re-read off the photos 11-26, scripts/skin/nba-skin.py: a white player's skin sits about
    // 150-195, a light-brown one 112-150, brown and dark under that)
    const L0 = lumOf(skin)
    const room = L0 > 150 ? 'k' : L0 > 112 ? 'any' : 'cb'
    const L = { ...lookOf(`bap-app|${name}`, room), skin, g: L0 > 150 ? 'w' : L0 > 112 ? 'm' : 'b', kit: 'hoops', eb: 'none', ag: 24 }
    u = toUrl(faceSvg(L, { color, view: 'full' }))
    if (cache.size > 200) cache.clear()
    cache.set(k, u)
  }
  return u
}
