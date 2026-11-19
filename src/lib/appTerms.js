// The app's copy without the leagues' trademarks (the owner, 2026-11-17). Team nicknames are trademarks, so the app
// names a team by its place ("Kansas City", "Alabama"), and league marks give way to plain words (Super Bowl →
// Championship, Pro Bowl → All-Star, the NFL → the league, Heisman → Player of the Year...). MVP, All-Pro and Rookie
// of the Year are generic and stay.
//
// Like the jerseys (lib/appArt.js) it happens in one place: every piece of text React (or anything else) puts on
// the page goes through appSafe() on its way in, so no string in the game needs its own app version and the
// website, which never runs this, keeps every word. What it can't reach: text inside an <input>. Text drawn on a
// canvas goes through it too (below).
import INDEX from '../data/jersey-index.json'

// ── league marks ─────────────────────────────────────────────────────────────────────────────────────────────
// order matters: the longer phrase first
export const TERM_MAP = [
  [/\bSuper Bowl (champions?|winners?|titles?|rings?|MVPs?)\b/g, (m, w) => (/^MVP/.test(w) ? `Championship ${w}` : w === 'titles' ? 'championships' : w === 'title' ? 'championship' : w === 'rings' ? 'championship rings' : w === 'ring' ? 'championship ring' : w)],
  [/\bSUPER BOWL (CHAMPIONS?|WINNERS?|MVPS?)\b/g, (m, w) => (/^MVP/.test(w) ? `CHAMPIONSHIP ${w}` : w)],
  [/\bSuper Bowls\b/g, 'Championships'],
  [/\bSuper Bowl\b/g, 'Championship'],
  [/\bSUPER BOWLS?\b/g, m => (m.endsWith('S') ? 'CHAMPIONSHIPS' : 'CHAMPIONSHIP')],
  [/\bPro Bowlers?\b/g, m => (m.endsWith('s') ? 'All-Stars' : 'All-Star')],
  [/\bPro Bowls\b/g, 'All-Star selections'],
  [/\bPro Bowl\b/g, 'All-Star'],
  [/\bPRO BOWLS?\b/g, 'ALL-STAR'],
  [/\b(?:the )?NBA Finals\b/g, m => (m.startsWith('the') ? 'the Finals' : 'Finals')],
  [/\bNBA FINALS\b/g, 'FINALS'],
  [/\bMarch Madness\b/g, 'the tournament'],
  [/\bMARCH MADNESS\b/g, 'THE TOURNAMENT'],
  [/\b(?:the )?Final Four\b/g, m => (m.startsWith('the') ? 'the semifinals' : 'semifinals')],
  [/\bFINAL FOUR\b/g, 'SEMIFINALS'],
  [/\bHeisman(?: Trophy)?(?: winners?)?\b/g, m => (/winners$/.test(m) ? 'Players of the Year' : 'Player of the Year')],
  [/\bHEISMAN(?: TROPHY)?\b/g, 'PLAYER OF THE YEAR'],
  [/\b(?:Vince )?Lombardi(?: Trophy)?\b/g, 'championship trophy'],
  [/\bLarry O'Brien(?: Trophy)?\b/g, 'championship trophy'],
  [/\bWorld Series\b/g, 'Championship Series'],
  [/\b(?:the )?(NFL|NBA|MLB) Draft\b/g, m => (m.startsWith('the') ? 'the Draft' : 'Draft')],
  [/\b(NFL|NBA|MLB) DRAFT\b/g, 'DRAFT'],
  // the leagues' own names
  [/\b(?:the|The) (NFL|NBA|MLB|NCAA)\b/g, m => (m[0] === 'T' ? 'The league' : 'the league')],
  [/\bTHE (NFL|NBA|MLB|NCAA)\b/g, 'THE LEAGUE'],
  [/\b(?:an|An) (NFL|NBA|MLB)\b/g, m => (m[0] === 'A' ? 'A pro' : 'a pro')],
  [/\b(NFL|NBA|MLB)(?=['’]s\b)/g, 'the league'],
  [/\bNCAA\b/g, 'college'],
  [/\b(NFL|NBA|MLB)\b/g, (m, x, i, s) => (/[a-z]/.test(s) ? 'pro' : 'PRO')],
]

// ── team nicknames ──────────────────────────────────────────────────────────────────────────────────────────
// football's screens read NFL first, then college; basketball's NBA, then college; baseball MLB
const SPORT_LEAGUES = { football: ['nfl', 'cfb'], basketball: ['nba', 'cbb'], baseball: ['mlb'], soccer: [] }
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const built = new Map()
function teamRules(sport) {
  if (built.has(sport)) return built.get(sport)
  const full = new Map(), nick = new Map(), clash = new Set()
  for (const lg of SPORT_LEAGUES[sport] ?? []) {
    const seenHere = new Map()
    for (const t of Object.values(INDEX.teams[lg] ?? {})) {
      const [, , place, name] = t
      if (!place || !name) continue
      full.set(`${place} ${name}`, place)
      // a nickname two teams of this league share (Tigers, Bulldogs) can't say which; the full name still can
      if (seenHere.has(name) && seenHere.get(name) !== place) clash.add(lg + name)
      seenHere.set(name, place)
    }
    for (const [name, place] of seenHere) if (!clash.has(lg + name) && !nick.has(name)) nick.set(name, place)
    // a two-word nickname is often shortened to its last word (Blazers, Sox): that's the pro team's, not a college's
    const lastOf = n => n.split(' ').at(-1), lasts = [...seenHere.keys()].map(lastOf)
    for (const [name, place] of seenHere) {
      const w = lastOf(name)
      if (w !== name && lasts.filter(x => x === w).length === 1 && !nick.has(w)) nick.set(w, place)
    }
    // and in capitals, the way a header or a jersey sets it
    for (const [name, place] of [...nick]) if (/[a-z]/.test(name) && !nick.has(name.toUpperCase())) nick.set(name.toUpperCase(), place.toUpperCase())
    for (const [name, place] of [...full]) if (/[a-z]/.test(name)) full.set(name.toUpperCase(), place.toUpperCase())
  }
  const fullRe = full.size ? new RegExp(`\\b(${[...full.keys()].sort((a, b) => b.length - a.length).map(escRe).join('|')})\\b${VERB_RE}`, 'g') : null
  // "the Chiefs are on the clock" → "Kansas City is on the clock"; "the Chiefs'" → "Kansas City's"
  // (not inside a person's name: Magic Johnson stays Magic Johnson)
  const nickRe = nick.size ? new RegExp(`(?:(\\b(?:[Tt]he|THE) )|(?<![A-Z][a-z]+ ))\\b(${[...nick.keys()].sort((a, b) => b.length - a.length).map(escRe).join('|')})\\b(?! [A-Z][a-z])(['’](?!s))?${VERB_RE}`, 'g') : null
  const r = { full, nick, fullRe, nickRe }
  built.set(sport, r)
  return r
}
// A nickname is plural and a place is not: "the Chiefs win" becomes "Kansas City wins", "the CHIEFS WIN" "KANSAS CITY
// WINS". Only the verbs the game's lines use, and not after will / can / to and the like ("will the Chiefs win" stays bare).
const VERB = { are: 'is', were: 'was', have: 'has', do: 'does', go: 'goes' }
const VERBS = ['are', 'were', 'have', 'win', 'lose', 'beat', 'keep', 'take', 'make', 'move', 'host', 'face', 'need', 'hold', 'lead',
  'go', 'do', 'look', 'play', 'come', 'get', 'open', 'close', 'visit', 'head', 'fall', 'rally', 'pull', 'edge', 'clinch', 'finish',
  'enter', 'trail', 'sit', 'stay', 'want', 'add', 'own', 'improve', 'drop', 'reach', 'miss', 'climb', 'slip', 'sweep', 'advance',
  'stun', 'hang', 'cruise', 'try', 'send', 'sign', 'give']
const VERB_RE = `( (?:${VERBS.join('|')}|${VERBS.join('|').toUpperCase()})\\b)?`
const MODAL = /\b(will|would|can|could|to|did|does|do|should|might|may|must|let|lets|help|helps|watch|see|saw|made|make|makes)\s+(?:the\s+)?$/i
function singular(verb, str, at) {
  if (!verb) return ''
  if (MODAL.test(str.slice(Math.max(0, at - 16), at))) return verb
  const w = verb.slice(1), up = w === w.toUpperCase(), l = w.toLowerCase()
  const one = VERB[l] ?? (/(s|sh|ch|x|z)$/.test(l) ? l + 'es' : /[^aeiou]y$/.test(l) ? l.slice(0, -1) + 'ies' : l + 's')
  return ' ' + (up ? one.toUpperCase() : one)
}

export const sportOfPath = (p = (typeof location !== 'undefined' ? location.pathname : '/')) =>
  p.startsWith('/bucket') ? 'basketball' : p.startsWith('/baseball') ? 'baseball' : p.startsWith('/soccer') ? 'soccer' : 'football'

const QUICK = /[A-Z]|\ders\b/
const cache = new Map()
export function appSafe(text, sport = sportOfPath()) {
  if (typeof text !== 'string' || text.length < 2 || !QUICK.test(text)) return text
  const ck = sport + '\u0001' + text
  const hit = cache.get(ck)
  if (hit !== undefined) return hit
  // (a disclaimer names the leagues to say who we're not: it keeps every name)
  if (/affiliated|endorsed|trademark|licensed/i.test(text)) { cache.set(ck, text); return text }
  let s = text
  const T = teamRules(sport)
  if (T.fullRe) s = s.replace(T.fullRe, (m, name, verb, at, str) => T.full.get(name) + singular(verb, str, at))
  if (T.nickRe) s = s.replace(T.nickRe, (m, the, name, apos, verb, at, str) => T.nick.get(name) + (apos ? (/[a-z]/.test(name) ? "'s" : "'S") + (verb ?? '') : singular(verb, str, at)))
  for (const [re, to] of TERM_MAP) s = s.replace(re, to)
  if (cache.size > 6000) cache.clear()
  cache.set(ck, s)
  return s
}

// Every text node on its way into the page: React makes text with document.createTextNode, changes it through
// nodeValue / data, and fills an element that holds only text with textContent.
let installed = false
export function installAppTerms() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const create = Document.prototype.createTextNode
  Document.prototype.createTextNode = function (t) { return create.call(this, appSafe(String(t))) }
  const wrap = (proto, prop, ok) => {
    const d = Object.getOwnPropertyDescriptor(proto, prop)
    if (!d?.set) return
    Object.defineProperty(proto, prop, { ...d, set(v) { d.set.call(this, ok(this) && typeof v === 'string' ? appSafe(v) : v) } })
  }
  const notEditable = n => { const p = n.nodeType === 3 ? n.parentNode : n; return !(p && (p.nodeName === 'TEXTAREA' || p.nodeName === 'INPUT' || p.nodeName === 'STYLE' || p.nodeName === 'SCRIPT' || p.isContentEditable)) }
  wrap(Node.prototype, 'nodeValue', n => n.nodeType === 3 && notEditable(n))
  wrap(CharacterData.prototype, 'data', n => n.nodeType === 3 && notEditable(n))
  wrap(Node.prototype, 'textContent', n => n.nodeType === 1 && notEditable(n))
  // the tab title, and labels read aloud / shown on hover
  wrap(Document.prototype, 'title', () => true)
  const setAttr = Element.prototype.setAttribute
  const ATTRS = new Set(['title', 'aria-label', 'alt', 'placeholder'])
  const imgSet = HTMLImageElement.prototype.setAttribute   // lib/appArt.js may have wrapped it already: keep its swap
  const fix = (name, value) => (ATTRS.has(name) && typeof value === 'string' ? appSafe(value) : value)
  Element.prototype.setAttribute = function (name, value) { return setAttr.call(this, name, fix(name, value)) }
  if (imgSet !== setAttr) HTMLImageElement.prototype.setAttribute = function (name, value) { return imgSet.call(this, name, fix(name, value)) }
  // Text drawn on a canvas (share cards, the mini games' end zones and scoreboards, Blacktop's name tags): every
  // fillText, strokeText and the measureText that sizes it. Code that draws a word a letter at a time asks
  // globalThis.__appSafe for the whole word first (utils/seasonCard.js, lib/mg/kit.js).
  globalThis.__appSafe = appSafe
  for (const C of [globalThis.CanvasRenderingContext2D, globalThis.OffscreenCanvasRenderingContext2D]) {
    if (!C) continue
    for (const m of ['fillText', 'strokeText', 'measureText']) {
      const fn = C.prototype[m]
      if (fn) C.prototype[m] = function (text, ...rest) { return fn.call(this, typeof text === 'string' ? appSafe(text) : text, ...rest) }
    }
  }
}
