// app-clean: no real player photos or team logos reach the screen. The code paths
// already ask for none (empty headshot maps, team badges in /logos/*.svg), but
// builds saved before (leaderboards, profiles, live games, share links) can carry
// an old photo or logo URL. Every image URL goes through here on its way in:
//   - a player photo (the old headshot host, /headshots/, ESPN…) → a broken image,
//     so the component's own fallback shows (QBAvatar: the team badge)
//   - an old team logo /logos/XXX.png → the team badge /logos/XXX.svg

const PHOTO = /\/headshots\/|jsdelivr\.net\/gh\/|espncdn\.com|cdn\.nba\.com|static\.www\.nfl\.com|nfl\.com\/image|pro-football-reference|basketball-reference/i
const OLD_LOGO = /(\/logos\/(?:nba\/)?)(?!Capimages)([A-Za-z0-9]+)\.png(\?.*)?$/

export function cleanImageUrl(url) {
  if (typeof url !== 'string' || !url) return url
  if (PHOTO.test(url)) return 'data:,'
  return url.replace(OLD_LOGO, '$1$2.svg')
}

let installed = false
export function installNoPhotos() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const ATTRS = new Set(['src', 'href', 'xlink:href', 'srcset', 'poster'])
  const setAttribute = Element.prototype.setAttribute
  Element.prototype.setAttribute = function (name, value) {
    return setAttribute.call(this, name, ATTRS.has(String(name).toLowerCase()) && /^(img|image|source|video)$/i.test(this.tagName) ? cleanImageUrl(String(value)) : value)
  }
  const setAttributeNS = Element.prototype.setAttributeNS
  Element.prototype.setAttributeNS = function (ns, name, value) {
    return setAttributeNS.call(this, ns, name, /href$/i.test(name) ? cleanImageUrl(String(value)) : value)
  }
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true, enumerable: src.enumerable,
    get() { return src.get.call(this) },
    set(v) { src.set.call(this, cleanImageUrl(String(v))) },
  })
  // inline background images (style={{ backgroundImage: `url(...)` }})
  const setProperty = CSSStyleDeclaration.prototype.setProperty
  const fixCss = v => (typeof v === 'string' && v.includes('url(') ? v.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) => `url(${q}${cleanImageUrl(u)}${q})`) : v)
  CSSStyleDeclaration.prototype.setProperty = function (prop, value, prio) { return setProperty.call(this, prop, fixCss(value), prio) }
  for (const prop of ['backgroundImage', 'background']) {
    const d = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, prop)
    if (!d?.set) continue
    Object.defineProperty(CSSStyleDeclaration.prototype, prop, { configurable: true, enumerable: d.enumerable, get() { return d.get.call(this) }, set(v) { d.set.call(this, fixCss(v)) } })
  }
}

// The basketball figure's head: always the default head in the build's skin tone
export const isGenericHead = url => typeof url === 'string' && /\/generic(light|dark)\.webp$/.test(url)
export function genericHead(skinHex) {
  if (!skinHex || !/^#[0-9a-f]{6}$/i.test(skinHex)) return '/genericdark.webp'
  const n = parseInt(skinHex.slice(1), 16)
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 155 ? '/genericlight.webp' : '/genericdark.webp'
}
export const headFor = chip => (!chip ? null : isGenericHead(chip.photo) ? chip.photo : genericHead(chip.skinColor ?? chip.skin))
