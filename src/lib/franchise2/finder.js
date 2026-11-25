// FRANCHISE: the trade finder (a player's feedback the owner approved, 2026-11-25: "a trade finder ... without having
// to wait for a prompted offer or having to search through every team to find a viable trade").
//
// Two questions, both answered from the league's own book (trades.js: teamSide, decide, checkTrade), so everything it
// shows is a deal the other team takes when it's proposed, legal under both caps and both rosters:
//   shopOffers(F, give)   "what would each team give for these men and picks?" A team's best offer in picks, and its
//                         best with a player who'd start for the GM in it; the most value back first.
//   findTargets(F, q)     "who's out there at this spot?" The men around the league that fit (position, minimum OVR,
//                         age, salary), best first.
//   priceOf(F, s, id)     what one of them costs: the package of the GM's picks and men worth the least on the
//                         league's chart that his team still takes. The men it leans on are the ones behind his
//                         starters, and the starter the new man would sit down: it never empties a lineup to fill a spot.
//
// A team takes a deal two ways (trades.js decide): by its own book (what it gets, by its needs and plans, beats what
// it gives by its margin), or because what the GM sends is worth more than what he asks for by the league's chart.
// The finder tries both and keeps what holds up. When nobody will deal it says why, the way the team would.
//
// Nothing here changes the franchise, rolls dice or uses up a team's calls: a result is made with acceptDeal, or
// opened in the trade screen and proposed like any deal.
import { SHORTS, TEAM } from './league'
import { groupOf, GROUP, depthChart, startersOf } from './roster'
import { capYear } from './contracts'
import {
  tradeWindow, tradeable, teamSide, decide, checkTrade, gauge, picksBy, pickWorth, sitOf, sayOf, valueOf,
  inValue, outValue, pickMod, marginOf, picksFor, callsLeft, dealsWith, DEALS_WITH,
} from './trades'
import { r1 } from './rng'

const nick = s => TEAM[s]?.nick ?? s
const NONE = () => ({ pl: [], pk: [] })
const PKG = [1, 0.7, 0.5, 0.35, 0.25]
const pkg = vals => [...vals].sort((a, b) => b - a).reduce((a, v, j) => a + v * (PKG[j] ?? 0.2), 0)
const moneyText = v => `$${v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10).toFixed(1)}M`
const last = n => String(n).split(' ').slice(-1)[0]
const possessive = n => `${n}${/s$/i.test(n) ? '’' : '’s'}`

// the spots the finder searches (the depth chart's rooms)
export const FIND_GROUPS = ['qb', 'rb', 'wr', 'te', 'ol', 'edge', 'dt', 'lb', 'cb', 's', 'k']

// ── 1. What would each team give? ────────────────────────────────────────────
// the most of its own value a team sends for what it's getting: out + its margin on out <= gain
function ownRoom(F, s, gain, already = 0) {
  let b = gain
  for (let i = 0; i < 4; i++) b = gain - marginOf(F, s, Math.max(0, already + b)) * 1.03
  return b
}
// The best picks team s adds to `base` (what's already coming back: a man, or nothing) and still takes the deal.
// Tried by its own book and by the league's chart; each try shrunk by what decide says it's short. [{ get, c, d }]
function topUp(F, s, give, base, sit, fairIn) {
  const gm = give.pl.map(id => F.teams[F.team].r.find(p => p.i === id))
  const tm = base.pl.map(id => F.teams[s].r.find(p => p.i === id))
  const side = teamSide(F, s, { pl: gm, pk: give.pk }, { pl: tm, pk: [] })
  const baseGet = pkg(tm.map(p => valueOf(F, p)))
  const out = []
  for (const mode of ['own', 'fair']) {
    let room = mode === 'own' ? ownRoom(F, s, side.gain, side.out) : Math.min(fairIn - 2, fairIn / 1.05) - baseGet
    for (let t = 0; t < 3; t++) {
      const got = room > 0 ? picksFor(F, s, room, mode === 'own' ? sit : 'mid') : null
      const get = { pl: [...base.pl], pk: got?.ks ?? [] }
      if (!get.pl.length && !get.pk.length) break
      const c = checkTrade(F, s, give, get)
      if (!c.ok) break
      const d = decide(F, s, give, get)
      if (d.ok) { out.push({ get, c, d }); break }
      if (!(d.short > 0) || !Number.isFinite(d.short) || !got) break
      room -= d.short * 1.2 + 1
    }
  }
  return out
}
// the men on team s who'd start for the GM (better than the man they'd sit down), the best first
function helpers(F, s, gone) {
  const C = depthChart(F, F.team), ly = capYear(F), qb1 = startersOf(F, s).qb1
  return F.teams[s].r.filter(p => {
    if (tradeable(F, s, p) || p === qb1 || p.p === 'k' || (p.tx && p.tx[1] === ly)) return false
    const g = groupOf(p), room = (C[g] ?? []).filter(x => !x.fl && !x.in && !gone.has(x.i))
    return p.o > (room[GROUP[g].n - 1]?.o ?? 60)
  }).sort((a, b) => valueOf(F, b) - valueOf(F, a))
}
// one team's answer: { ok, s, sit, starts (he'd start there), picks: offer | null, player: offer | null } or
// { ok: false, s, why }. An offer: { s, give, get, g (the gauge), cap, cut (the GM's side), k: 'picks' | 'player' | 'dump' }
function offerFrom(F, s, give, gm, fairIn) {
  if (dealsWith(F, s) >= DEALS_WITH) return { ok: false, s, why: 'done' }
  if (callsLeft(F, s) <= 0) return { ok: false, s, why: 'calls' }
  // (with nothing coming back: the answers no package changes, and whether it wants him at all)
  const d0 = decide(F, s, give, NONE())
  if (d0.why === 'back' || d0.why === 'cap' || d0.why === 'done') return { ok: false, s, why: d0.why, who: d0.who }
  if (!d0.ok) return { ok: false, s, why: 'low' }
  const sit = sitOf(F, s)
  const mk = (x, k) => ({ s, give, get: x.get, g: gauge(F, s, give, x.get), cap: x.c.cap, cut: x.c.cut ?? [], k })
  const bestOf = list => list.sort((a, b) => b.g.get - a.g.get)[0] ?? null
  const picks = bestOf(topUp(F, s, give, NONE(), sit, fairIn).map(x => mk(x, 'picks')))
  const gone = new Set(give.pl)
  const withMan = []
  for (const p of helpers(F, s, gone)) {
    if (withMan.length >= 2) break
    // (a man it gives for this: by its own book or by the chart, whichever lets him go)
    if (outValue(F, s, p, sit) > d0.side.in && valueOf(F, p) > fairIn) continue
    const base = { pl: [p.i], pk: [] }
    const c = checkTrade(F, s, give, base)
    const alone = c.ok && decide(F, s, give, base).ok ? [{ get: base, c }] : []
    const more = alone.length ? topUp(F, s, give, base, sit, fairIn) : []
    const b = bestOf([...alone, ...more].map(x => mk(x, 'player')))
    if (b) withMan.push(b)
  }
  const player = bestOf(withMan)
  const starts = (d0.side.ins?.[0]?.role ?? 0) >= 1
  if (!picks && !player) {
    // (it would take the contract and send nothing: a salary dump, shown only when no team gives anything)
    const c = checkTrade(F, s, give, NONE())
    return c.ok ? { ok: true, s, sit, starts, picks: null, player: null, dump: mk({ get: NONE(), c }, 'dump') } : { ok: false, s, why: 'low' }
  }
  return { ok: true, s, sit, starts, picks, player }
}
// give: { pl: [ids], pk: [keys] } from the GM's team.
// Returns { open, why (the window shut), list: [offer, best first] (one or two a team), dumps: [offer] (when nobody
// gives anything: the teams that would take the money), teams (how many are in), line (nobody will deal: why) }
export function shopOffers(F, give) {
  const W = tradeWindow(F)
  if (!W.open) return { open: false, why: W.why, list: [], dumps: [], teams: 0 }
  give = { pl: [...(give?.pl ?? [])], pk: [...(give?.pk ?? [])] }
  if (!give.pl.length && !give.pk.length) return { open: true, list: [], dumps: [], teams: 0 }
  const me = nick(F.team)
  const gm = give.pl.map(id => F.teams[F.team].r.find(p => p.i === id))
  const stuck = gm.find(p => !p || tradeable(F, F.team, p))
  if (stuck !== undefined) {
    const why = stuck ? tradeable(F, F.team, stuck) : 'gone'
    return { open: true, list: [], dumps: [], teams: 0, line: !stuck ? 'A player on the block is no longer on the roster.' : why === 'hurt' ? `${stuck.n} is hurt. Teams won't trade for an injured player.` : why === 'deal' ? `${possessive(stuck.n)} deal is up. He can't be traded until he signs.` : `${stuck.n} can't be traded.` }
  }
  // (the GM's own books first: the bonus left on a man he sends lands on this year's cap, whoever takes him)
  const first = SHORTS.find(s => s !== F.team)
  const c0 = checkTrade(F, first, give, NONE())
  if (!c0.ok) return { open: true, list: [], dumps: [], teams: 0, line: c0.why === 'ucap' ? `Trading ${gm.length === 1 ? gm[0].n : 'them'} leaves ${moneyText(c0.cap?.dead ?? 0)} in dead money. The ${me} would be over the cap.` : c0.text }
  const fairIn = gauge(F, first, give, NONE()).give
  const list = [], dumps = [], no = {}
  let teams = 0
  for (const s of SHORTS) {
    if (s === F.team) continue
    const o = offerFrom(F, s, give, gm, fairIn)
    if (!o.ok) { (no[o.why] ??= []).push(s); continue }
    if (o.dump) { dumps.push({ ...o.dump, sit: o.sit, starts: o.starts }); continue }
    teams++
    for (const x of [o.picks, o.player]) if (x) list.push({ ...x, sit: o.sit, starts: o.starts })
  }
  list.sort((a, b) => b.g.get - a.g.get || a.s.localeCompare(b.s))
  dumps.sort((a, b) => (b.cap?.after ?? 0) - (a.cap?.after ?? 0))
  let line = null
  if (!list.length) {
    const pay = r1(gm.reduce((a, p) => a + (p.$ ?? 0), 0)), who = gm.length === 1 ? gm[0].n : gm.length ? 'these players' : 'these picks'
    const nCap = no.cap?.length ?? 0, nLow = no.low?.length ?? 0
    if (dumps.length) line = `No team will give anything for ${who}. ${dumps.length === 1 ? `The ${nick(dumps[0].s)} would take the contract` : `${dumps.length} teams would take the contract`} off the books.`
    else if (nCap >= nLow && nCap > 0) line = `No team has the cap room for ${gm.length === 1 ? `${possessive(gm[0].n)} ${moneyText(pay)}` : `${moneyText(pay)} in salary`}.`
    else if (nLow > 0) line = gm.length ? `There is no market for ${who}${pay >= 3 ? ` at ${moneyText(pay)} a year` : ''}. Teams see depth, and nobody trades a pick for depth.` : 'No team will give anything for those picks alone.'
    else line = `No team is taking calls from the ${me} right now.`
  }
  return { open: true, list, dumps: list.length ? [] : dumps.slice(0, 3), teams, no, line }
}

// ── 2. Who's out there, and what does he cost? ───────────────────────────────
// q: { g (a depth-chart room: FIND_GROUPS), minO, ageMin, ageMax, max$ ($M a year) }
// Returns { open, why, list: [{ p, s }] } best first (no prices: priceOf, a man at a time, as the screen shows them)
export function findTargets(F, q) {
  const W = tradeWindow(F)
  const out = []
  for (const s of SHORTS) {
    if (s === F.team) continue
    for (const p of F.teams[s].r) {
      if (p.fl || p.b != null || groupOf(p) !== q.g) continue
      if (q.minO && p.o < q.minO) continue
      if ((q.ageMin && p.ag < q.ageMin) || (q.ageMax && p.ag > q.ageMax)) continue
      if (q.max$ != null && (p.$ ?? 0) > q.max$) continue
      out.push({ p, s })
    }
  }
  out.sort((a, b) => b.p.o - a.p.o || a.p.ag - b.p.ag || a.p.i - b.p.i)
  return { open: W.open, why: W.open ? null : W.why, list: out }
}
// What he costs. { ok, s, p, sit, give, get, g (the gauge), cap, cut (the GM's side) } or { ok: false, s, p, why, text }
const TRIES = 10
export function priceOf(F, s, id) {
  const p = F.teams[s]?.r.find(x => x.i === id)
  const no = (why, text) => ({ ok: false, s, p: p ?? null, why, text })
  if (!p) return no('gone', 'He has changed teams.')
  const W = tradeWindow(F)
  if (!W.open) return no('shut', W.why)
  const N = nick(s), me = nick(F.team)
  const tw = tradeable(F, s, p)
  if (tw === 'hurt') return no('hurt', `${p.n} is hurt. An injured player can't be traded.`)
  if (tw) return no('deal', `${possessive(p.n)} deal is up. He can't be traded until he signs.`)
  if (dealsWith(F, s) >= DEALS_WITH) return no('done', sayOf(F, s, { why: 'done' }))
  if (callsLeft(F, s) <= 0) return no('calls', sayOf(F, s, { why: 'calls' }))
  const get = { pl: [id], pk: [] }, sit = sitOf(F, s), g = groupOf(p)
  // the team's first word, with nothing on the table: the answers no package changes
  const d0 = decide(F, s, NONE(), get)
  // (its cap can't take the bonus left on his deal, which lands on this year's books when he goes: trades.js capAfter)
  if (d0.why === 'cap') return no('cap', `The ${N} can't trade him: the ${moneyText(r1((p.g ?? 0) * Math.max(1, p.y ?? 1)))} left of his bonus would put them over the cap.`)
  if (d0.why === 'new' || d0.why === 'done') return no(d0.why, sayOf(F, s, d0))
  const mine = F.teams[F.team].r.filter(m => !tradeable(F, F.team, m))
  // (its starting quarterback: only for a quarterback back)
  let must = null
  if (d0.why === 'qb') {
    must = mine.filter(m => m.p === 'qb' && m.o >= p.o - 3).sort((a, b) => valueOf(F, a) - valueOf(F, b))[0] ?? null
    if (!must) return no('qb', sayOf(F, s, d0))
  }
  const top = outValue(F, s, p, sit), lv = valueOf(F, p), need = marginOf(F, s, top) * 1.02
  const gone = new Set([id])
  // what the GM can send: his picks; the men behind his starters, and the starter the new man would sit down
  const on = new Set(Object.values(startersOf(F, F.team)).map(x => x.i))
  const room = (depthChart(F, F.team)[g] ?? []).filter(x => !x.fl && !x.in)
  const sat = room.slice(0, GROUP[g].n).sort((a, b) => a.o - b.o)[0] ?? null
  const asset = m => ({ k: 'pl', v: m.i, lw: valueOf(F, m), tw: inValue(F, s, m, gone, sit).v, $: m.$ ?? 0 })
  const picks = picksBy(F)[F.team].map(k => ({ k: 'pk', v: k, lw: pickWorth(F, k), tw: pickWorth(F, k) * pickMod(sit) }))
  const bench = mine.filter(m => m !== must && (!on.has(m.i) || (m === sat && p.o > m.o))).map(asset)
  // (does the money fit with picks alone? if not, a salary has to go back)
  const probe = checkTrade(F, s, { pl: must ? [must.i] : [], pk: picks.length ? [picks[picks.length - 1].v] : [] }, get)
  if (!probe.ok && probe.why === 'roster') return no('roster', probe.text)
  const tight = !probe.ok && probe.why === 'ucap'
  const men = tight ? bench.sort((a, b) => b.$ - a.$).slice(0, 8)
    : bench.filter(x => x.tw >= 12).sort((a, b) => b.tw / Math.max(1, b.lw) - a.tw / Math.max(1, a.lw) || b.tw - a.tw).slice(0, 6)
  const A = [...picks, ...men], forced = must ? [asset(must)] : []
  const combos = []
  const add = set => {
    const all = [...forced, ...set]
    const pl = all.filter(x => x.k === 'pl'), pk = all.filter(x => x.k === 'pk')
    if (tight && !pl.length) return
    const tw = pkg(pl.map(x => x.tw)) + pk.reduce((a, x) => a + x.tw, 0), lw = pkg(pl.map(x => x.lw)) + pk.reduce((a, x) => a + x.lw, 0)
    if (tw <= 1) return
    // (a front-line player goes only for a real piece back: trades.js decide)
    if (top >= 120 && Math.max(...all.map(x => x.tw)) < top * 0.5) return
    const own = tw - top - Math.max(0, pl.length - 1) * 8 >= need, fair = lw >= lv + Math.max(2, lv * 0.05)
    if (own || fair) combos.push({ all, lw, n: all.length })
  }
  if (forced.length) add([])
  for (let i = 0; i < A.length; i++) {
    add([A[i]])
    for (let j = i + 1; j < A.length; j++) {
      add([A[i], A[j]])
      for (let k = j + 1; k < A.length; k++) add([A[i], A[j], A[k]])
    }
  }
  combos.sort((a, b) => a.lw - b.lw || a.n - b.n)
  let tries = 0, checks = 0
  for (const c of combos) {
    if (tries >= TRIES || checks >= 60) break
    const give = { pl: c.all.filter(x => x.k === 'pl').map(x => x.v), pk: c.all.filter(x => x.k === 'pk').map(x => x.v) }
    checks++
    const chk = checkTrade(F, s, give, get)
    if (!chk.ok) continue
    tries++
    if (!decide(F, s, give, get).ok) continue
    return { ok: true, s, p, sit, give, get, g: gauge(F, s, give, get), cap: chk.cap, cut: chk.cut ?? [] }
  }
  if (tight) return no('ucap', `The ${me} are ${moneyText(Math.max(0.1, -(probe.cap?.after ?? 0)))} short of the cap room for ${last(p.n)}.`)
  if (top >= 120 && !A.some(x => x.tw >= top * 0.5)) return no('star', sayOf(F, s, { why: 'star', who: p }))
  return no('short', `The ${N} want more for ${last(p.n)} than picks and backups.`)
}
// The search the screen runs: the best `cap` men that fit, each priced. { open, why, total (men that fit), priced,
// list: [the deals that can be made, best man first], no: [the men who can't be had, with the team's reason] }
export const FIND_CAP = 40
export function findDeals(F, q, cap = FIND_CAP) {
  const T = findTargets(F, q)
  if (!T.open) return { open: false, why: T.why, total: T.list.length, priced: 0, list: [], no: [] }
  const rows = T.list.slice(0, cap).map(x => priceOf(F, x.s, x.p.i))
  return { open: true, total: T.list.length, priced: rows.length, list: rows.filter(r => r.ok), no: rows.filter(r => !r.ok) }
}
