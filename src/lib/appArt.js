// The app swaps every player photo for his jersey art and every team logo for its tag (lib/jerseyArt.js).
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
import { jerseySvg, svgUri } from './jerseyArt'
import { jerseySvg as classicJersey, teamMarkSvg as classicMark } from './jerseyArtClassic'
import { numberFor } from './jerseyNumber'

const cache = new Map()
const HEADSHOT = /\/headshots\/(.+?)\.(?:webp|png|jpe?g)(?:[?#].*)?$/i
// (national flags in /logos/nations are flags, not marks: they stay)
const LOGO = /\/logos\/(?:(nba|cfb|cbb|mlb|soccer)\/)?(?:dark\/|light\/|sm\/)?(conf-)?([A-Za-z0-9&_-]{2,8})\.(?:png|webp|svg)(?:[?#].*)?$/i
// which tables a logo folder's abbreviation is looked up in, first match wins
const LOGO_LEAGUES = { '': ['nfl'], nba: ['nba'], cfb: ['cfb', 'cbb'], cbb: ['cbb', 'cfb'], mlb: ['mlb'], soccer: ['soc', 'nat'], nations: ['nat', 'soc'] }

const colorsOf = (lg, team) => INDEX.teams[lg]?.[team] ?? null

export function playerArt(key, folderHint, variant = 'auto') {
  // a man with no photo (a legend the board shows by his team): x/<league>/<TEAM>/<number>, his team's jersey
  const nm = /^x\/(nfl|nba)\/([A-Za-z0-9]{2,4})\/(\d{0,2})$/.exec(key)
  if (nm) { const [, lg, team, num] = nm; return svgUri(jerseySvg({ league: lg, team, colors: colorsOf(lg, team.toUpperCase()), number: numberFor(key, '', num, lg), variant })) }
  const row = INDEX.p[key]
  if (!row) { const lg = folderHint === 'nba' || /^cbb_/.test(key) ? 'nba' : 'nfl'; return svgUri(jerseySvg({ league: lg, number: numberFor(key, '', '', lg), variant })) }
  const [lg, team, number, pos, rank] = row.split('|')
  if (pos === 'HC') return svgUri(teamMark({ league: lg, team: team || 'HC', colors: colorsOf(lg, team), badge: team ? 'HC' : '' }))
  // (every jersey carries a number: lib/jerseyNumber.js picks one for his position when the index has none)
  return svgUri(jerseySvg({ league: lg, team, colors: colorsOf(lg, team), number: numberFor(key, pos, number, lg), pos, rank: +rank || 0, variant }))
}
// a team's mark: the slanted tag from before the redesign (owner 11-19: the flat chips read as rudimentary)
const teamMark = classicMark

// the build figure's red attribute cards keep the art from before the redesign (owner 11-19: he likes it there)
const CLASSIC = '.cz-card'
const classicArt = key => {
  const row = INDEX.p[key]
  if (!row) { const lg = /^nba\/|^cbb_/.test(key) ? 'nba' : 'nfl'; return svgUri(classicJersey({ league: lg, number: numberFor(key, '', '', lg) })) }
  const [lg, team, number, pos, rank] = row.split('|')
  return svgUri(classicJersey({ league: lg, team, colors: colorsOf(lg, team), number: numberFor(key, pos, number, lg), pos, rank: +rank || 0 }))
}
// where the jersey breaks out of its box (owner 11-19: "these don't need to be bound to anything"): drawn bare, no
// tile, and the screen's own CSS (app-game.css, App art) sets it loose: angled behind the spin card's name, over a
// row's edge, fanned on Home's pool cards, cut off by a Franchise slab, standing on the depth chart's field
const BARE = '.qb-reveal-hero, .simp-attr-row .qb-avatar, .cr-trait-av, .crl-man .crl-face, .ag-mode-faces, .fk-l3-slab, .crl-face--sm'
const bareArt = key => (INDEX.p[key]?.split('|')[3] === 'HC' ? null : playerArt(key, key.split('/')[0], 'bare'))   // (a coach stays his team's mark)
let nativeSet = null

export function teamArt(folder, team) {
  for (const lg of LOGO_LEAGUES[folder ?? ''] ?? ['nfl']) { const c = colorsOf(lg, team); if (c) return svgUri(teamMark({ league: lg, team, colors: c })) }
  return svgUri(teamMark({ team }))
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
    out = svgUri(teamMark({ league: 'conf', team: m[3].toUpperCase().replace(/[-_]/g, ' ').slice(0, 6) }))
  } else if (m && /^[A-Z0-9&]{2,6}$/i.test(m[3])) {
    out = teamArt((m[1] ?? '').toLowerCase(), m[3].toUpperCase())
  } else if ((m = SALARY.exec(src))) {
    // (football and basketball: a real shot of the app's own board, jerseys and five picked, owner 11-19)
    out = m[1] === 'nfl' || m[1] === 'bucket' ? `/modes/app-${m[1]}-salary.webp` : salaryArt(m[1])
  } else out = src
  if (cache.size > 4000) cache.clear()
  cache.set(src, out)
  return out
}

// what an address became: 'p' a player's art, 't' a team's tag, '' neither
const kindOf = (src, out) => (out === src || SALARY.test(src) ? '' : HEADSHOT.test(src) ? 'p' : 't')   // (the board's picture is no logo: its card keeps its frame)

// ── Fitting the slot ───────────────────────────────────────────────────────────────────────────────────────────
// The places a photo used to sit were made for a face: a circle crop, a ring in the team's colour, the team's logo
// behind the head, the photo pushed down and enlarged so the chin sits on the rim. The art needs none of it: it
// picks its own shape for the slot (lib/jerseyArt.js), so the slot only has to stop cutting it. Each swapped picture
// is marked (data-art) and, once laid out, the frame that was built round it (a small round or clipped box about its
// size) is marked too (data-art-frame); the CSS below takes the circle, ring, backdrop and offsets away from both.
const FRAME_CSS = [
  // (:not(#_) outranks the game's own !important rules for these slots)
  // the picture itself: no circle, no ring, no backdrop; a player's art keeps a photo's proportions when the slot
  // gives only one side
  'html.app-art:not(#_) img[data-art]{border-radius:0!important;border-color:transparent!important;box-shadow:none!important;background:none!important;clip-path:none!important;-webkit-mask:none!important;mask:none!important}',
  'html.app-art:not(#_) img[data-art=p]{aspect-ratio:auto 276/200}',
  // the frame round it
  'html.app-art:not(#_) [data-art-frame]{border-radius:0!important;background:none!important;box-shadow:none!important;border-color:transparent!important;outline:none!important;overflow:visible!important;clip-path:none!important;-webkit-mask:none!important;mask:none!important}',
  'html.app-art:not(#_) [data-art-frame]::before,html.app-art:not(#_) [data-art-frame]::after{display:none!important}',
  // a photo placed off-centre to frame a face fills its frame instead
  'html.app-art:not(#_) img[data-art-fill]{position:absolute!important;inset:0!important;left:0!important;top:0!important;width:100%!important;height:100%!important;transform:none!important;margin:0!important;max-width:none!important;max-height:none!important}',
  // the team's logo a photo stood in front of
  'html.app-art:not(#_) [data-art-frame]:has(img[data-art=p]) img[data-art=t]{display:none!important}',
  'html.app-art:not(#_) .qb-avatar:has(img[data-art=p]) .qb-avatar-logo{display:none}',
].join('')

const pending = new Set()
let queued = false
function fitLater(img) {
  pending.add(img)
  if (queued) return
  queued = true
  requestAnimationFrame(() => requestAnimationFrame(() => {
    queued = false
    const list = [...pending]
    pending.clear()
    for (const im of list) fitSlot(im)
  }))
}
const px = v => parseFloat(v) || 0
let sizer = null
function waitForSize(img) {
  if (typeof ResizeObserver === 'undefined' || img.__artWait) return
  sizer ??= new ResizeObserver(list => {
    for (const e of list) {
      if (e.contentRect.width < 2 || e.contentRect.height < 2) continue
      sizer.unobserve(e.target); e.target.__artWait = false; fitLater(e.target)
    }
  })
  img.__artWait = true
  sizer.observe(img)
}
// (a grade or a badge pinned to the frame's corner doesn't make it more than a frame)
const pinned = k => { const p = getComputedStyle(k).position; return p === 'absolute' || p === 'fixed' }
function fitSlot(img) {
  if (!img.isConnected) return
  // the classic art on the build figure's red cards, the bare jersey where it breaks out of its box
  if (img.__artKey && !img.__classic && nativeSet) {
    const alt = img.closest(CLASSIC) ? classicArt : img.closest(BARE) ? bareArt : null
    const out = alt?.(img.__artKey)
    img.__classic = true
    if (out) { nativeSet.call(img, 'src', out); if (alt === bareArt) nativeSet.call(img, 'data-art-bare', '') }
  }
  const r = img.getBoundingClientRect()
  // not laid out yet (a closed tab, a sheet still off screen): fitted the moment it gets a size
  if (r.width < 2 || r.height < 2) { waitForSize(img); return }
  const ic = getComputedStyle(img)
  let e = img.parentElement
  for (let depth = 0; e && depth < 2; depth++, e = e.parentElement) {
    const b = e.getBoundingClientRect()
    // a frame is about the picture's size: no bigger than half again, no smaller than two thirds
    if (b.width > Math.max(r.width, 24) * 1.5 + 8 || b.height > Math.max(r.height, 24) * 1.5 + 8) break
    if (b.width < r.width * 0.66 && b.height < r.height * 0.66) break
    const c = getComputedStyle(e)
    const round = px(c.borderTopLeftRadius) >= Math.min(b.width, b.height) * 0.3
    const clips = c.overflow !== 'visible' || c.clipPath !== 'none'
    const others = [...e.children].some(k => k.tagName !== 'IMG' && k.getBoundingClientRect().width > 0 && !k.contains(img) && !pinned(k))
    if (others) break
    if (round || clips) {
      e.setAttribute('data-art-frame', '')
      if (ic.position === 'absolute' && (Math.abs(r.width - b.width) > 2 || Math.abs(r.height - b.height) > 2 || ic.transform !== 'none')) img.setAttribute('data-art-fill', '')
    }
  }
}

let installed = false
export function installAppArt() {
  if (installed || typeof window === 'undefined') return
  installed = true
  document.documentElement.classList.add('app-art')
  // a canvas can't pick its picture by the slot's size: it asks for the one it wants ('small', 'square', 'card')
  // a team's jersey with a given number, for a canvas (the share card's backdrop)
  globalThis.__appTeamJersey = (league, team, number) => svgUri(jerseySvg({ league, team, colors: colorsOf(league, team), number: String(number ?? ''), variant: 'bare', size: 800 }))
  globalThis.__appArtVariant = (src, variant) => { const m = HEADSHOT.exec(String(src)); if (!m) return null; const key = m[1].replace(/^.*?public\/headshots\//, ''); return playerArt(key, key.split('/')[0], variant) }
  const st = document.createElement('style')
  st.textContent = FRAME_CSS
  document.head.appendChild(st)
  const setAttr = Element.prototype.setAttribute
  nativeSet = setAttr
  const setAttrNS = Element.prototype.setAttributeNS
  const mark = (img, src, out) => {
    if (out === src && src.startsWith('data:image/svg')) return   // already swapped, set again
    const k = kindOf(src, out)
    img.__classic = false
    if (img.hasAttribute('data-art-bare')) img.removeAttribute('data-art-bare')
    const hm = k === 'p' && HEADSHOT.exec(src); img.__artKey = hm ? hm[1].replace(/^.*?public\/headshots\//, '') : null
    if (k) { setAttr.call(img, 'data-art', k); fitLater(img) } else if (img.hasAttribute('data-art')) img.removeAttribute('data-art')
  }
  // <img src> (React sets it as an attribute) and img.src = … (new Image() for canvases and preloads)
  HTMLImageElement.prototype.setAttribute = function (name, value) {
    if (name !== 'src' && name !== 'srcset') return setAttr.call(this, name, value)
    const v = String(value), out = appImage(v)
    if (name === 'src') mark(this, v, out)
    return setAttr.call(this, name, out)
  }
  const srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
  if (srcDesc?.set) Object.defineProperty(HTMLImageElement.prototype, 'src', { ...srcDesc, set(v) { const s = String(v), out = appImage(s); mark(this, s, out); srcDesc.set.call(this, out) } })
  // SVG <image href>: a team's logo there is a decal on a helmet, a shoulder or a belt, and a tag stuck on a helmet
  // reads as a sticker, so the gear goes plain; anything else (a photo) is swapped as usual
  const BLANK = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')
  const svgHref = v => (LOGO.test(v) ? BLANK : appImage(v))
  SVGImageElement.prototype.setAttribute = function (name, value) {
    return setAttr.call(this, name, (name === 'href' || name === 'xlink:href') ? svgHref(String(value)) : value)
  }
  SVGImageElement.prototype.setAttributeNS = function (ns, name, value) {
    return setAttrNS.call(this, ns, name, (name === 'href' || name === 'xlink:href') ? svgHref(String(value)) : value)
  }
}
