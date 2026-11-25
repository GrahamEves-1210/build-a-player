// FRANCHISE: the free-agent market as the GM reads it, all year (a player's feedback the owner approved, 2026-11-25:
// "a way to see the free agent market"), and the street: the men still unsigned once the market's three days are over.
//
// WHO'S ON IT (F.fa), by the time of year (marketWindow):
//   the season           the street: the veterans nobody signed in March (the best STREET_KEEP of them, market.js
//                        streetKeep), the men released since (the cut-down, a trade's roster spot, a cap casualty), a
//                        starter one of the GM's builds replaced. Any of them signs today (signStreet).
//   the playoffs         the street is shut until the new league year
//   coaches, awards      the books are closing: nothing until the new league year
//   re-sign              the men headed for the market (the league's clubs have made their calls): a look ahead,
//                        each at the price he'll ask (contracts.js askOf)
//   free agency          the market itself: offers over three days (Deals.jsx; LIGHT: Light.jsx). favOf: the team he's
//                        expected to sign with as the bids stand
//   after it, the draft  the street again (shut on draft night)
//
// A STREET DEAL (streetDeal): one year at three quarters of what the market pays a man like him (the March money is
// gone: the market's own last-day floor is 82%, market.js FLOOR_DAY), never under the minimum. It has to fit the cap,
// and in the season a room past its limit releases its lowest-rated man (trades.js releasesFor: the screen names him
// before the GM signs). The week's front-office card about a veteran still unsigned (season.js) signs at the same price.
import { TEAM } from './league'
import { groupOf, GROUP, fixNumbers } from './roster'
import { marketValue, marketLines, minimumFor, signDeal, capYear, cutMan, askOf } from './contracts'
import { rivalsFor, pitchOf, standingOf, fitOf, teamView, roomLeft, offersOut } from './market'
import { releasesFor, capAfter } from './trades'
import { draftDone } from './draft'
import { addNews } from './news'
import { r1 } from './rng'

const nick = s => TEAM[s]?.nick ?? s
const posTxt = p => (p.p === 'ol' ? (p.s ?? 'OL') : p.p === 'dl' || p.p === 'db' ? GROUP[groupOf(p)].label : p.p.toUpperCase())
const moneyText = v => `$${v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10).toFixed(1)}M`
export const STREET_K = 0.75

// ── The time of year ─────────────────────────────────────────────────────────
// { k: 'street' (sign today) | 'market' (free agency's three days) | 'next' (the market to come) | 'shut', open (a man
//   can be signed off this list now), why (what the screen says when it's shut) }
export function marketWindow(F) {
  if (!F?.teams) return { k: 'shut', open: false, why: '' }
  if (F.phase === 'season') return F.pend ? { k: 'street', open: false, why: 'Game in progress' } : { k: 'street', open: true }
  if (F.phase === 'off') {
    if (F.stage === 'coaches' || F.stage === 'awards') return { k: 'shut', open: false, why: 'Free agency opens with the new league year, after the awards.' }
    if (F.stage === 'resign') return { k: 'next', open: false, why: 'Free agency opens once the re-signing is done.' }
    if (F.stage === 'fa' && F.fad) return { k: 'market', open: false }
    if (F.dr && F.dr.ph === 'night' && !draftDone(F)) return { k: 'street', open: false, why: 'Draft night: signings wait until the last pick is in.' }
    return { k: 'street', open: true }
  }
  return { k: 'shut', open: false, why: 'The regular season is over. Free agency opens with the new league year.' }
}
// the men on the list (a filler backup is never one)
export const marketMen = F => (F.fa ?? []).filter(p => !p.fl && p.b == null)

// ── The street ───────────────────────────────────────────────────────────────
// what a man on the street signs for: { $, y: 1 }
export function streetDeal(F, p) {
  const yr = capYear(F)
  return { $: r1(Math.max(minimumFor(p.ag, yr), marketValue(p, yr, marketLines(F)) * STREET_K)), y: 1 }
}
// Can the GM sign him now? { ok, why: 'gone' | 'shut' | 'roster' | 'cap', text, p, deal, cut: the men released for
// his roster spot, cap: { before, after, dead } }
export function streetCheck(F, id) {
  const p = marketMen(F).find(x => x.i === id)
  if (!p) return { ok: false, why: 'gone', text: 'He is no longer available.' }
  const W = marketWindow(F)
  const deal = streetDeal(F, p)
  if (W.k !== 'street' || !W.open) return { ok: false, why: 'shut', text: W.why ?? 'Offers go through free agency.', p, deal }
  // (as he'd be on the books: this year's cap hit, nothing left on an old deal)
  const man = { ...p, $: deal.$, y: 1, g: 0 }
  const cut = releasesFor(F, F.team, [], [man])
  if (cut == null) return { ok: false, why: 'roster', text: `No room on the ${nick(F.team)} roster at that spot.`, p, deal }
  const cap = capAfter(F, F.team, [], [man], cut)
  if (!cap.nocap && cap.after < -1e-9) return { ok: false, why: 'cap', text: `The ${nick(F.team)} are ${moneyText(-cap.after)} short of the cap room.`, p, deal, cut, cap }
  return { ok: true, p, deal, cut, cap }
}
// He signs: one year, the room made first if his spot is full. { ok, text, p, deal, cut }
export function signStreet(F, id) {
  const c = streetCheck(F, id)
  if (!c.ok) return { ok: false, text: c.text }
  const t = F.teams[F.team], p = c.p
  for (const x of c.cut) { const r = cutMan(F, x.i); if (r && F.phase !== 'off') (F.fa ??= []).push(x) }
  F.fa = F.fa.filter(x => x !== p)
  signDeal(p, { $: c.deal.$, y: 1 })
  delete p.cc; delete p.tmpk
  // (a filler in his room goes: he's the backup now, as in a trade)
  const fl = t.r.find(x => x.fl && x.p === p.p && groupOf(x) === groupOf(p))
  if (fl) t.r = t.r.filter(x => x !== fl)
  t.r.push(p)
  try { fixNumbers(F, F.team) } catch { /* (a number is cosmetic) */ }
  const text = `${nick(F.team)} sign ${posTxt(p)} ${p.n} to a one-year, $${c.deal.$} million deal`
  addNews(F, { k: 'sign', tag: 'SIGNED', s: F.team, text })
  return { ok: true, text, p, deal: c.deal, cut: c.cut }
}

// ── The list, a man at a time ────────────────────────────────────────────────
// the team he's expected to sign with as the bids stand (free agency's days): { s, mine } or null (no bids, or too
// close to call with the GM's offer in it)
export function favOf(F, p, V = null) {
  const mine = offersOut(F)[p.i]
  if (mine) {
    const st = standingOf(F, p, mine, V)
    if (st.k === 'lead' || st.k === 'alone') return { s: F.team, mine: true }
    if (st.k === 'close') return null
    if (st.k === 'behind') return { s: st.lead }
  }
  const best = rivalsFor(F, p, V).map(r => ({ s: r.s, v: pitchOf(F, r.s, p, { $: r.offer, y: r.y, b: 0 }, V).v })).sort((a, b) => b.v - a.v)[0]
  return best ? { s: best.s } : null
}
// One man as the list shows him: { p, ask: { $, y }, fit (market.js fitOf), can (the money fits now), sign (he can be
// signed off this list now), why (when not), cut, cap, rivals, fav }
export function marketRow(F, p, V = null, W = marketWindow(F)) {
  const fit = fitOf(F, p, V)
  if (W.k === 'street') {
    const c = streetCheck(F, p.i)
    return { p, ask: c.deal ?? streetDeal(F, p), fit, can: c.ok || (c.why !== 'cap' && c.why !== 'roster'), sign: c.ok, why: c.ok ? null : c.why, text: c.ok ? null : c.text, cut: c.cut ?? [], cap: c.cap ?? null }
  }
  if (W.k === 'market') {
    const ask = { $: p.$, y: p.y }
    return { p, ask, fit, can: roomLeft(F, p.i) >= ask.$ - 1e-9, sign: false, rivals: rivalsFor(F, p, V), fav: favOf(F, p, V) }
  }
  // (the market to come: what he'll ask when it opens)
  const ask = askOf(p, F.year + 1, marketLines(F))
  return { p, ask, fit, can: roomLeft(F) >= ask.$ - 1e-9, sign: false }
}
// The whole list: { W, V, men (best first) }
export function marketRead(F) {
  const W = marketWindow(F)
  const men = W.k === 'shut' ? [] : marketMen(F).sort((a, b) => b.o - a.o || a.ag - b.ag)
  return { W, V: men.length ? teamView(F) : null, men }
}
