// BLACKTOP LIVE: the other men's builds, on the screen (the owner, 11-27: "an easy way to see the opponent's build and
// ratings"). No React: the engine hands it the game and the root, it adds its own few nodes and keeps them up to date.
//   - in the scorebug's note bar (where the rules line was): the man he's matched up with, his 2 best grades and his 2
//     worst, in the grade colours ("S SPD · A+ JMP | C HND · D PER"). Glanceable, it never covers the court
//   - at the tip: the matchup card for 2.2 s, his own 2 best and 2 worst against his man's
//   - a tap on the note bar or a side in the scorebug: every man's whole build in a small sheet (his teammate too in
//     2v2, all three in King of the Hill). Nothing stops; a tap anywhere on it closes it
// Short trait labels and the grade colours are the app's own (data/nba-attrs.js shortLabel, lib/gradeColors.js).
import { BUCKET_ATTR as NBA_ATTRS } from '../../data/nba-attrs.js'
import { spectrumColor } from '../../lib/gradeColors.js'

const GRADES = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S']
const letter = v => GRADES[Math.max(0, Math.min(11, Math.round(v)))]
const val = x => (x == null ? null : typeof x === 'number' ? x : x.val ?? null)
const short = k => NBA_ATTRS[k]?.shortLabel ?? k.slice(0, 3).toUpperCase()
const full = k => NBA_ATTRS[k]?.label ?? k
// a build as [key, value] best first (the order a build lists them breaks ties)
export function traits(build) {
  return Object.keys(build || {}).map((k, i) => [k, val(build[k]), i]).filter(t => t[1] != null).sort((a, b) => b[1] - a[1] || a[2] - b[2])
}
const chip = (k, v) => { const c = document.createElement('span'); c.className = 'btlv-sc-chip'; c.style.setProperty('--g', spectrumColor(v)); c.innerHTML = `<b>${letter(v)}</b>${short(k)}`; return c }
const chips = (build, into) => {
  const t = traits(build), best = t.slice(0, 2), worst = t.slice(-2).reverse()
  const up = document.createElement('span'); up.className = 'btlv-sc-up'; best.forEach(([k, v]) => up.append(chip(k, v)))
  const dn = document.createElement('span'); dn.className = 'btlv-sc-dn'; worst.forEach(([k, v]) => dn.append(chip(k, v)))
  into.append(up, dn)
}

// setup: the engine's (teams with builds, looks, me); els: the engine's (root, note's bar, sides). Returns { update, tip, destroy }
export function createScout({ setup, els, nameOf, colOf }) {
  const all = setup.teams.flat()
  const N = all.length, me = setup.me
  const bar = els.note?.parentElement, goal = bar?.querySelector('.btlv-bug-goal')
  bar?.querySelectorAll('.btlv-sc-strip').forEach(x => x.remove())     // (one left by a game before this one)
  const strip = document.createElement('span'); strip.className = 'btlv-sc-strip'; strip.setAttribute('role', 'button'); strip.setAttribute('aria-label', 'Their builds')
  if (goal) goal.replaceWith(strip); else bar?.append(strip)
  let shownFor = -2
  // who he's matched up with: the man he guards, else the man guarding him (King of the Hill: the king, or his guard)
  function update(s) {
    const P = s.players, m = P[me]
    let o = m.man >= 0 ? m.man : P.findIndex(q => q.man === me)
    if (o < 0) o = P.findIndex(q => q.team !== m.team && !q.out)
    if (o === shownFor || o < 0) return
    shownFor = o
    strip.textContent = ''
    const nm = document.createElement('em'); nm.textContent = nameOf(o); nm.style.color = colOf(o)
    strip.append(nm); chips(all[o].build, strip)
  }
  // the sheet: every man's whole build
  let sheet = null
  function open(focus = -1) {
    close()
    sheet = document.createElement('div'); sheet.className = 'btlv-sc-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Builds')
    const card = document.createElement('div'); card.className = `btlv-sc-card${N === 3 ? ' is-three' : ''}`
    const order = [...Array(N).keys()].sort((a, b) => (a === focus ? -1 : b === focus ? 1 : 0) || (a === me ? 1 : b === me ? -1 : 0))
    for (const i of order) {
      const col = document.createElement('section'); col.style.setProperty('--tc', colOf(i))
      const h = document.createElement('h3'); h.textContent = nameOf(i); col.append(h)
      for (const [k, v] of traits(all[i].build)) {
        const r = document.createElement('p'); r.style.setProperty('--g', spectrumColor(v))
        r.innerHTML = `<span>${full(k).replace('Leadership/Clutch', 'Clutch').replace('Perimeter Defense', 'Perimeter D').replace('Interior Defense', 'Interior D').toUpperCase()}</span><b>${letter(v)}</b>`
        col.append(r)
      }
      card.append(col)
    }
    const x = document.createElement('small'); x.textContent = 'TAP TO CLOSE'
    sheet.append(card, x)
    sheet.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); close() })
    els.root?.append(sheet)
  }
  function close() { sheet?.remove(); sheet = null }
  const onStrip = e => { e.preventDefault(); e.stopPropagation(); sheet ? close() : open(shownFor) }
  strip.addEventListener('pointerdown', onStrip)
  const onSides = e => {
    const side = e.target.closest?.('.btlv-bug-side'); if (!side) return
    const k = [...els.sides.children].indexOf(side)
    // (a side is a team, or in King of the Hill a man)
    const i = setup.mode === 'koth' ? k : all.findIndex((p, j) => (setup.teams[k] || []).includes(p) && j !== me)
    e.preventDefault(); sheet ? close() : open(i)
  }
  els.sides?.addEventListener('pointerdown', onSides)
  // the tip: his 2 and 2 against his man's, a moment
  let card = null, cardT = 0
  function tip(s) {
    if (card) return
    update(s)
    const o = shownFor
    if (o < 0) return
    card = document.createElement('div'); card.className = 'btlv-sc-tip'; card.setAttribute('aria-hidden', 'true')
    for (const [i, side] of [[me, 'l'], [o, 'r']]) {
      const c = document.createElement('div'); c.className = `btlv-sc-tip-${side}`; c.style.setProperty('--tc', colOf(i))
      const h = document.createElement('b'); h.textContent = nameOf(i); c.append(h); chips(all[i].build, c); card.append(c)
    }
    const v = document.createElement('i'); v.textContent = 'VS'; card.children[0].after(v)
    els.root?.append(card)
    clearTimeout(cardT); cardT = setTimeout(() => { card?.classList.add('is-out'); cardT = setTimeout(() => { card?.remove() }, 260) }, 2200)
  }
  // (and the rules line back where it was: a new game makes its own)
  function destroy() { clearTimeout(cardT); card?.remove(); close(); strip.removeEventListener('pointerdown', onStrip); els.sides?.removeEventListener('pointerdown', onSides); if (goal) strip.replaceWith(goal); else strip.remove() }
  return { update, tip, open, close, destroy, get open_() { return !!sheet } }
}

// The S moment (the owner, 11-27: an S "apparent in game"): when an S grade is what made the play (a deep three by an S
// shooter, a dunk by an S leaper, a block by an S rim protector or S Size, a steal by an S defender, a move that froze
// his man by an S handler), a small gold S tag with the trait by him for a moment. Not on every play: once a man a 20 s
// at most. Returns [label] or null
const S_LAST = new Map()
export function sMoment(e, s, nowMs) {
  const p = e.pid != null ? s.players[e.pid] : null
  if (!p || !p.R?.S) return null
  const S = p.R.S
  let w = null
  if (e.e === 'make' && e.three && S.js) w = 'JUMP SHOT'
  else if (e.e === 'make' && e.kind === 'dunk' && S.bnc) w = 'BOUNCE'
  else if (e.e === 'make' && e.kind === 'layup' && S.fin && (e.on != null)) w = 'FINISHING'
  else if (e.e === 'block' && (S.int || S.size || S.bnc)) w = S.int ? 'INT DEFENSE' : S.size ? 'SIZE' : 'BOUNCE'
  else if (e.e === 'steal' && S.per) w = 'PER DEFENSE'
  else if (e.e === 'move' && e.freeze && S.hnd) w = 'HANDLES'
  else if (e.e === 'board' && !e.off && e.fought && S.size) w = 'SIZE'
  if (!w) return null
  const last = S_LAST.get(p.id) ?? -1e9
  if (nowMs - last < 20000) return null
  S_LAST.set(p.id, nowMs)
  return w
}
