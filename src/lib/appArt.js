// The app swaps every player photo for a jersey and every team logo for its abbreviation tag (lib/jerseyArt.js).
// It's done once, where a picture gets its address: any <img> (or SVG <image>, or new Image()) given a headshot
// or a /logos/ address is handed the jersey or the tag instead, so the hundreds of places that show a photo or a
// logo need no change of their own and the website (which never runs this) stays exactly as it is.
//
// Who wears what comes from data/jersey-index.json (scripts/build-jersey-index.mjs, run by npm run build:app):
// headshot file → league, team, number, position, and every team's two colours. A photo the index doesn't know
// still turns into a plain grey jersey: no photo ever shows in the app.
//
// Drawn faces (Franchise's generated players, the generic silhouettes) aren't photos and are left alone.
import INDEX from '../data/jersey-index.json'
import { jerseySvg, teamMarkSvg, svgUri } from './jerseyArt'

const cache = new Map()
const HEADSHOT = /\/headshots\/(.+?)\.(?:webp|png|jpe?g)(?:[?#].*)?$/i
// (national flags in /logos/nations are flags, not marks: they stay)
const LOGO = /\/logos\/(?:(nba|cfb|cbb|mlb|soccer)\/)?(?:dark\/|light\/|sm\/)?(conf-)?([A-Za-z0-9&_-]{2,8})\.(?:png|webp|svg)(?:[?#].*)?$/i
// which tables a logo folder's abbreviation is looked up in, first match wins
const LOGO_LEAGUES = { '': ['nfl'], nba: ['nba'], cfb: ['cfb', 'cbb'], cbb: ['cbb', 'cfb'], mlb: ['mlb'], soccer: ['soc', 'nat'], nations: ['nat', 'soc'] }

const colorsOf = (lg, team) => INDEX.teams[lg]?.[team] ?? null

export function playerArt(key, folderHint) {
  const row = INDEX.p[key]
  if (!row) return svgUri(jerseySvg({ league: folderHint === 'nba' || /^cbb_/.test(key) ? 'nba' : 'nfl' }))
  const [lg, team, number, pos] = row.split('|')
  if (pos === 'HC') return svgUri(teamMarkSvg({ team: team || 'HC', colors: colorsOf(lg, team), badge: team ? 'HC' : '' }))
  return svgUri(jerseySvg({ league: lg, team, colors: colorsOf(lg, team), number, pos }))
}

export function teamArt(folder, team) {
  for (const lg of LOGO_LEAGUES[folder ?? ''] ?? ['nfl']) { const c = colorsOf(lg, team); if (c) return svgUri(teamMarkSvg({ team, colors: c })) }
  return svgUri(teamMarkSvg({ team }))
}

// the address the app shows in place of a photo or a logo, or the address itself when it's neither
export function appImage(src) {
  if (typeof src !== 'string' || src.startsWith('data:') || src.length > 600) return src
  let out = cache.get(src)
  if (out !== undefined) return out
  let m
  if ((m = HEADSHOT.exec(src))) {
    const key = m[1].replace(/^.*?public\/headshots\//, '')
    out = playerArt(key, key.split('/')[0])
  } else if ((m = LOGO.exec(src)) && m[2]) {
    // a conference's mark: its name on a plain tag
    out = svgUri(teamMarkSvg({ team: m[3].toUpperCase().replace(/[-_]/g, ' ').slice(0, 6) }))
  } else if (m && /^[A-Z0-9&]{2,6}$/i.test(m[3])) {
    out = teamArt((m[1] ?? '').toLowerCase(), m[3].toUpperCase())
  } else out = src
  if (cache.size > 4000) cache.clear()
  cache.set(src, out)
  return out
}

let installed = false
export function installAppArt() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const setAttr = Element.prototype.setAttribute
  const setAttrNS = Element.prototype.setAttributeNS
  // <img src> (React sets it as an attribute) and img.src = … (new Image() for canvases and preloads)
  HTMLImageElement.prototype.setAttribute = function (name, value) {
    return setAttr.call(this, name, (name === 'src' || name === 'srcset') ? appImage(String(value)) : value)
  }
  const srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
  if (srcDesc?.set) Object.defineProperty(HTMLImageElement.prototype, 'src', { ...srcDesc, set(v) { srcDesc.set.call(this, appImage(String(v))) } })
  // SVG <image href> (helmet decals, belt logos)
  SVGImageElement.prototype.setAttribute = function (name, value) {
    return setAttr.call(this, name, (name === 'href' || name === 'xlink:href') ? appImage(String(value)) : value)
  }
  SVGImageElement.prototype.setAttributeNS = function (ns, name, value) {
    return setAttrNS.call(this, ns, name, (name === 'href' || name === 'xlink:href') ? appImage(String(value)) : value)
  }
}
