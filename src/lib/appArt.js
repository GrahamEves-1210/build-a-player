// The app swaps every player photo for his card and every team logo for its oval badge (lib/jerseyArt.js).
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
  const [lg, team, number, pos, rank] = row.split('|')
  if (pos === 'HC') return svgUri(teamMarkSvg({ league: lg, team: team || 'HC', colors: colorsOf(lg, team), badge: team ? 'HC' : '' }))
  return svgUri(jerseySvg({ league: lg, team, colors: colorsOf(lg, team), number, pos, rank: +rank || 0 }))
}

export function teamArt(folder, team) {
  for (const lg of LOGO_LEAGUES[folder ?? ''] ?? ['nfl']) { const c = colorsOf(lg, team); if (c) return svgUri(teamMarkSvg({ league: lg, team, colors: c })) }
  return svgUri(teamMarkSvg({ team }))
}

// Salary Cap's Home card shows a screenshot of the board (public/modes/*-salary.webp), real photos and all: the app
// draws the board instead, five rows of five jerseys under the column heads, one of each row picked
const SALARY = /\/modes\/(nfl|bucket|soccer|baseball)-salary\.webp$/
function salaryArt(sport) {
  const lg = sport === 'bucket' ? 'nba' : sport === 'baseball' ? 'mlb' : sport === 'soccer' ? 'soc' : 'nfl'
  const teams = Object.entries(INDEX.teams[lg] ?? {})
  const W = 480, H = 726, cw = 86, ch = 112, x0 = 32, y0 = 92
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="22" fill="#0d1117"/>`
  for (let c = 0; c < 5; c++) s += `<rect x="${x0 + c * cw + 8}" y="56" width="${cw - 16}" height="10" rx="5" fill="#ffffff" opacity=".18"/>`
  let n = 7
  for (let r = 0; r < 5; r++) {
    s += `<rect x="6" y="${y0 + r * ch + 46}" width="18" height="12" rx="3" fill="#ffffff" opacity=".22"/>`
    const pick = (r * 3 + 1) % 5
    for (let c = 0; c < 5; c++) {
      n = (n * 37 + 11) % 997
      const [, col] = teams[n % Math.max(1, teams.length)] ?? ['', null]
      const x = x0 + c * cw, y = y0 + r * ch
      s += `<rect x="${x + 3}" y="${y + 3}" width="${cw - 6}" height="${ch - 6}" rx="10" fill="#1a212b" stroke="${c === pick ? '#f2c94c' : '#2a3340'}" stroke-width="${c === pick ? 3 : 1.5}"/>`
      s += jerseySvg({ league: lg, colors: col, number: (n % 98) + 1, variant: 'small' }).replace(/^<svg ([^>]*?)width="\d+" height="\d+">/, `<svg $1x="${x + 8}" y="${y + 6}" width="${cw - 16}" height="${cw - 16}">`)
      s += `<rect x="${x + 14}" y="${y + ch - 26}" width="${cw - 28}" height="8" rx="4" fill="#ffffff" opacity="${c === pick ? 0.55 : 0.2}"/>`
    }
  }
  return svgUri(s + '</svg>')
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
    out = svgUri(teamMarkSvg({ league: 'conf', team: m[3].toUpperCase().replace(/[-_]/g, ' ').slice(0, 6) }))
  } else if (m && /^[A-Z0-9&]{2,6}$/i.test(m[3])) {
    out = teamArt((m[1] ?? '').toLowerCase(), m[3].toUpperCase())
  } else if ((m = SALARY.exec(src))) {
    out = salaryArt(m[1])
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
