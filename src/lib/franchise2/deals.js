// FRANCHISE: the deals the player makes himself. Re-signing his own men is a negotiation; free agency's offers
// carry years, money a year and a signing bonus (contracts.js prices and signs them; market.js runs the market).
//
// WHAT A DEAL IS WORTH TO A MAN (worthOf): the money a year, moved by the years and the bonus.
//   years   he wants termFor(p) (contracts.js): a veteran (29+) values every extra year of security and hates a
//           short deal; a young man (26 and under) wants his security but not to be locked up long; in between he
//           wants his term
//   bonus   the share of the deal paid up front as signing bonus (contracts.js g: spread over the years on the cap,
//           still owed if he's cut). STANDARD is the usual share for a deal that size; MORE and MOST put more of it
//           up front: worth more to him, more dead money if he's cut later
//
// RE-SIGNING (the talks): his agent opens above his market value (marketValue). Under it sits the least he'll take
// to stay (hidden): his market value, less for a winning team, a starting job he likes, a veteran's wish to stay
// put, a man the team drafted or built; more when the agent can see the team has room. The player offers years,
// money and a bonus; the agent takes it if it's at his number, comes down part of the way if it's a real offer,
// and holds if it's short. Every real round of talks costs patience (a lowball costs two; an offer within 5% of
// his number costs none). Patience gone: he tests free agency (the player can still bid there). A build is the
// player's own man: he gives his final number instead of walking. The real cap rules hold: a deal has to fit.
//
// THE MARKET'S LINES: last season's line on every man (snapLines, at the end of the season), read by the market's
// cards (lastLineOf): his team and his numbers.
import { SHORTS } from './league'
import { askOf, marketValue, marketLines, signDeal, capRoom, canSign, termFor, bonusShare, minimumFor } from './contracts'
import { depthChart, groupOf, GROUP } from './roster'
import { rngOf, clamp, r1 } from './rng'
import { CAREER_KEYS } from './awards'

// ── What a deal is worth to him ──────────────────────────────────────────────
export const MAX_YEARS = 5
export const BONUS = [['STANDARD', 0], ['MORE', 0.15], ['MOST', 0.3]]
// the share of each year's cap hit that's signing bonus, for a deal at $ with bonus level b
export const shareOf = ($, b = 0) => r1(clamp(0, 0.7, bonusShare($) + (BONUS[b]?.[1] ?? 0)) * 100) / 100
const yearsK = (p, y) => {
  const dy = y - termFor(p)
  if (!dy) return 1
  if (p.ag >= 29) return dy > 0 ? 1 + 0.03 * dy : 1 + 0.07 * dy
  if (p.ag <= 26) return dy > 0 ? 1 - 0.015 * dy : 1 + 0.04 * dy
  return 1 - 0.035 * Math.abs(dy)
}
const bonusK = b => 1 + 0.25 * (BONUS[b]?.[1] ?? 0)
export const worthOf = (p, o) => o.$ * yearsK(p, o.y) * bonusK(o.b ?? 0)
// the money a year over y years that's worth the same to him as $ a year over y0 (the talks' restatement, offerTalks)
export const atTerm = (p, $, y0, y) => (y === y0 ? $ : r1($ * yearsK(p, y0) / yearsK(p, y)))
// a deal on him: the money a year, the years, the bonus spread over them (contracts.js signDeal)
export const signTerms = (p, o) => signDeal(p, { $: o.$, y: o.y, g: r1(o.$ * shareOf(o.$, o.b ?? 0)) })
// the bonus paid at signing (all of it), for the screens
export const bonusOf = o => r1(o.$ * shareOf(o.$, o.b ?? 0) * o.y)

// ── Re-signing: the talks ────────────────────────────────────────────────────
// F.talks: { [id]: { d (his number, as worth), fl (the least he'll take, hidden), pat, max, n (offers made), c: the
//   number restated in the last offer's shape { $, y, b }, say (the agent's last word), st: 0 talking · 1 signed ·
//   2 testing the market · 3 final number (a build) } }
const winPct = F => { const h = F.hist?.[F.hist.length - 1]; return h ? (h.w + h.t / 2) / Math.max(1, h.w + h.l + h.t) : 0.5 }
// a starter on the player's team: his place on the depth chart, injuries aside (a starter who's hurt is still the
// starter the talks are about)
export function startsFor(F, p) {
  const g = groupOf(p), room = (depthChart(F, F.team)[g] ?? []).filter(x => !x.fl)
  const at = room.findIndex(x => x.i === p.i)
  return at >= 0 && at < GROUP[g].n
}
export function openTalks(F, id) {
  F.talks ??= {}
  if (F.talks[id]) return F.talks[id]
  const p = F.teams[F.team].r.find(x => x.i === id)
  if (!p) return null
  const yr = F.year + 1, R = rngOf(`${F.seed}-${F.year}-talks-${id}`)
  const L = marketLines(F), ask = askOf(p, yr, L), mv = marketValue(p, yr, L), wp = winPct(F)
  const f = clamp(0.84, 1, 0.94 - (wp - 0.5) * 0.12 - (startsFor(F, p) ? 0.02 : 0) - (p.ag >= 31 ? 0.04 : 0) - (p.b != null ? 0.04 : 0) + (capRoom(F) > ask.$ * 2.5 ? 0.025 : 0) + R.n() * 0.02)
  const fl = r1(Math.max(minimumFor(p.ag, yr), mv * f))
  const open = r1(Math.max(minimumFor(p.ag, yr), ask.$ * (1.03 + 0.05 * R.u()), fl))
  const pat = clamp(2, 5, 3 + (wp >= 0.6 ? 1 : 0) + (p.b != null ? 1 : 0) - (p.o >= 88 && p.ag <= 29 ? 1 : 0))
  F.talks[id] = { d: open, fl, pat, max: pat, n: 0, c: { $: open, y: ask.y, b: 0 }, say: 'open', st: 0 }
  return F.talks[id]
}
// the factors in plain terms, for the talks screen: what helps the team, what helps him
export function talkFacts(F, id) {
  const p = F.teams[F.team].r.find(x => x.i === id)
  if (!p) return []
  const h = F.hist?.[F.hist.length - 1], wp = winPct(F)
  const out = []
  if (h) out.push({ k: 'rec', v: `${h.w}-${h.l}${h.t ? `-${h.t}` : ''}`, label: 'LAST SEASON', up: wp >= 0.55 ? 1 : wp <= 0.4 ? -1 : 0 })
  out.push({ k: 'role', v: startsFor(F, p) ? 'STARTER' : 'BACKUP', label: 'HIS ROLE', up: startsFor(F, p) ? 1 : 0 })
  out.push({ k: 'mkt', v: r1(marketValue(p, F.year + 1, marketLines(F))), label: 'MARKET VALUE', money: true })
  out.push({ k: 'yrs', v: termFor(p), label: termFor(p) === 1 ? 'YEAR HE WANTS' : 'YEARS HE WANTS' })
  return out
}
// can the team fit the deal (a build can always be kept: the team is then over the cap until it's under)
export const fitsDeal = (F, p, o) => canSign(F, o.$) || p?.b != null
// The player's offer: { $, y, b }. Returns { ok, say, t } (say: 'yes' | 'counter' | 'close' | 'short' | 'insult' |
// 'walk' | 'final' | 'cap')
export function offerTalks(F, id, o) {
  const p = F.teams[F.team].r.find(x => x.i === id)
  const t = openTalks(F, id)
  if (!p || !t || t.st === 1 || t.st === 2) return { ok: false }
  if (!fitsDeal(F, p, o)) return { ok: false, say: 'cap' }
  o = { $: r1(o.$), y: clamp(1, MAX_YEARS, Math.round(o.y)), b: clamp(0, BONUS.length - 1, o.b ?? 0) }
  const R = rngOf(`${F.seed}-${F.year}-talks-${id}-${t.n}`)
  t.n++
  const w = worthOf(p, o)
  const restate = () => ({ $: r1(Math.max(minimumFor(p.ag, F.year + 1), t.d / (yearsK(p, o.y) * bonusK(o.b)))), y: o.y, b: o.b })
  if (w >= t.d * 0.995 || (t.st === 3 && w >= t.d * 0.995)) {
    closeTalks(F, p, o, t)
    t.say = 'yes'
    return { ok: true, say: 'yes', t }
  }
  if (t.st === 3) { t.say = 'final'; return { ok: true, say: 'final', t } }
  if (w >= t.fl) {
    const close = w >= t.d * 0.95
    t.d = r1(t.d - (t.d - w) * (0.45 + 0.15 * R.u()))
    if (!close) t.pat--
    t.say = close ? 'close' : 'counter'
  } else {
    const insult = w < t.fl * 0.88
    t.pat -= insult ? 2 : 1
    if (!insult) t.d = r1(t.d - (t.d - t.fl) * 0.15)
    t.say = insult ? 'insult' : 'short'
  }
  t.c = restate()
  if (t.pat <= 0) {
    t.pat = 0
    if (p.b != null) { t.st = 3; t.say = 'final' }
    else { t.st = 2; t.say = 'walk'; testMarket(F, p) }
  }
  return { ok: true, say: t.say, t }
}
// the player takes his number (the last counter, or his opening ask)
export function acceptTalks(F, id) {
  const p = F.teams[F.team].r.find(x => x.i === id)
  const t = openTalks(F, id)
  if (!p || !t || t.st === 1 || t.st === 2) return false
  if (!fitsDeal(F, p, t.c)) return false
  closeTalks(F, p, t.c, t)
  t.say = 'yes'
  return true
}
// talks over: he leaves the roster for the market (his ask there is the market's; the player can still bid)
function testMarket(F, p) {
  const t = F.teams[F.team]
  t.r = t.r.filter(x => x !== p)
  F.rs = (F.rs ?? []).filter(x => x !== p.i)
  ;(F.rsd ??= []).push([p.i, 'tested', p.n, p.p, p.o])
  F.fa ??= []
  F.fa.push(p)
}
function closeTalks(F, p, o, t) {
  signTerms(p, o)
  t.st = 1; t.c = { ...o }
  F.rs = (F.rs ?? []).filter(x => x !== p.i)
  ;(F.rsd ??= []).push([p.i, 'kept'])
}
// what the agent said, as a beat writer would report it ($ in the screen's money text)
export const SAY = {
  open: 'His agent opened talks',
  counter: 'His agent came down, but not all the way',
  close: 'Close. His agent came down a little',
  short: 'His agent said the offer is short',
  insult: 'His agent called the offer an insult',
  walk: 'Talks broke off. He will test free agency',
  final: 'His agent gave a final number',
  yes: 'Agreed to terms',
  cap: 'Not enough cap room',
}

// ── Last season's line ───────────────────────────────────────────────────────
// p.ls: [team, games, ...his position's numbers (LINE_KEYS)] on every man who played, from the end of the season
// until the new one starts (the market's cards read it); a veteran the market made up: [his old team, 0]
const LINE_KEYS = { qb: ['py', 'ptd', 'int'], rb: ['ry', 'rtd', 'rctd', 'rc'], wr: ['rc', 'ryd', 'rctd'], te: ['rc', 'ryd', 'rctd'], ol: ['sa'], dl: ['sck', 'tfl'], lb: ['tk', 'sck', 'dint'], db: ['dint', 'pbu', 'tk'], k: ['fgm', 'fga', 'lg'] }
export function snapLines(F, tot) {
  for (const s of SHORTS) for (const p of F.teams[s].r) {
    const t = tot[String(p.i)]
    if (!t?.gp) { delete p.ls; continue }
    p.ls = [s, t.gp, ...(LINE_KEYS[p.p] ?? CAREER_KEYS[p.p] ?? []).map(k => t[k] ?? 0)]
  }
}
// { team, gp, t: { the numbers by key, gp } } or null
export function lastLineOf(p) {
  if (!Array.isArray(p?.ls)) return null
  const keys = LINE_KEYS[p.p] ?? []
  const t = { gp: p.ls[1] }
  keys.forEach((k, j) => { t[k] = p.ls[2 + j] ?? 0 })
  return { team: p.ls[0], gp: p.ls[1], t }
}
export const clearLines = F => { for (const s of SHORTS) for (const p of F.teams[s].r) delete p.ls }
