// NBA FRANCHISE: the trade finder (football's finder.js on the NBA's rules). Two questions, both answered from the
// league's own book (trades.js checkTrade, decide, gauge), so everything it shows is a deal the other team takes when
// it's proposed, legal under the salary-matching brackets, the aprons, the hard caps, the Stepien rule and both rosters:
//   shopOffers(F, give)   "what would each team give for these men and picks?" A team's best offer of picks (with the
//                         salary filler an over-the-cap team has to send back to take the money in), and its best
//                         with a man who'd play in the GM's rotation; the most value back first.
//   findDeals(F, q)       "who's out there?" The men around the league that fit (position, minimum OVR, age, salary),
//                         best first, each with his price: the package of the GM's picks and men worth the least on
//                         the league's values that his team still takes, with the salary going out that the cap
//                         needs. It never sends a man as good as the one coming back, or the GM's own build.
//
// CLOSE TO EVEN: nothing shown gives the GM more than his side is worth by the league's values over FIND_EVEN (the
// football finder's line). He can still haggle past it in the trade screen, a call at a time.
// Nothing here changes the franchise or uses up a team's calls: a result is proposed like any deal (proposeTrade).
import { checkTrade, decide, gauge, tradeWindow, whyNot, manValue, pickValue, picksOf, protFor, dealsWith, callsLeft, outValue, matchLimit, tpesOf, onMinimum, sayOf } from './trades'
import { capOf, capPayroll, payroll, capYear, hitOf } from './cap'
import { situationOf } from './contracts'
import { r1 } from '../rng'
export { TRADE_MAX as TRADE_MAX_SIDE } from './trades'

export const FIND_EVEN = 0.9
export const FIND_POS = ['PG', 'SG', 'SF', 'PF', 'C']
export const FIND_CAP = 30
const PKG = [1, 0.75, 0.55, 0.4, 0.3, 0.2]
const pkg = vals => { const s = [...vals].sort((x, y) => y - x); return s.filter(v => v > 0).reduce((t, v, j) => t + v * (PKG[j] ?? 0.2), 0) + s.filter(v => v <= 0).reduce((t, v) => t + v, 0) }
const $ = v => `$${r1(v).toFixed(1)}M`
const others = F => Object.keys(F.teams).filter(s => s !== F.team)
const pIdx = e => (typeof e === 'number' ? e : e?.i ?? null)
const entryValue = (F, e) => { const k = F.picks?.[pIdx(e)]; return k ? pickValue(F, e?.top ? { ...k, pr: { top: e.top } } : k).v : 0 }
const dealOf = (F, s, ga, gb, pa, pb) => ({ a: F.team, b: s, ga, gb, pa, pb })
const yes = (F, d) => checkTrade(F, d).ok && decide(F, d).yes
// (the GM never gets more than his side is worth by the league's values over FIND_EVEN)
const even = (F, d) => { const g = gauge(F, d); return g.a >= g.b * FIND_EVEN - 0.5 }

// the picks a team can put in a deal, as entries: each as it is, and a team's own first with the protection a front
// office in its place puts on it. [{ e, i, v }]
function pickAssets(F, s) {
  const out = []
  for (const k of picksOf(F, s)) {
    if (k.sw?.by) continue
    out.push({ e: k.i, i: k.i, v: pickValue(F, k).v, r: k.r })
    const top = protFor(F, s, k)
    if (top) out.push({ e: { i: k.i, top }, i: k.i, v: pickValue(F, { ...k, pr: { top } }).v, r: k.r })
  }
  return out
}
// a quick read of the salary rules (checkTrade has the last word): can team x send `out` and take in `inn` ($M)?
function fitsSide(F, x, out, inn, minIn = 0) {
  if (F.noCap || inn < 0.05) return true
  const year = capYear(F), cap = capOf(year), capPay = capPayroll(F, x, year)
  const IM = inn - minIn
  if (capPay - out + inn <= cap + 0.001 || IM < 0.05) return true
  const room = capPay < cap ? out + cap - capPay + 0.25 : 0
  const lim = Math.max(matchLimit(F, x, out, payroll(F, x, year) - out + inn, year), room)
  if (IM <= lim + 0.001) return true
  // (an exception takes him in with nothing going back; a league team's mid-level too)
  return out < 0.05 && (x !== F.team || tpesOf(F, x).some(t => IM <= t.$ + 0.001))
}
// the GM's rotation line: the eighth man's rating (a man better than that plays for him)
const eighth = F => F.teams[F.team].r.filter(p => !p.tw).map(p => p.o ?? 60).sort((a, b) => b - a)[7] ?? 60

// ── 1. What would each team give? ────────────────────────────────────────────
// The best of team s's picks added to `d` (most valuable first, each only while the deal still holds and stays close
// to even). Returns the deal with them in.
function topUp(F, d, s) {
  let best = d, tries = 0
  const used = new Set()
  for (const x of pickAssets(F, s).sort((a, b) => b.v - a.v)) {
    if (used.has(x.i) || tries >= 9) continue
    const g = gauge(F, best)
    if (x.v > g.a / FIND_EVEN - g.b + 0.5) continue
    tries++
    const t = { ...best, pb: [...best.pb, x.e] }
    if (yes(F, t) && even(F, t)) { best = t; used.add(x.i) }
  }
  return best
}
// one team's answer: { ok, s, sit, list: [offers] } or { ok: false, s, why }. An offer: { s, deal, g, k: 'picks' | 'player', sit }
function offersFrom(F, s, ga, pa, fairIn) {
  if (dealsWith(F, s) >= 3) return { ok: false, s, why: 'done' }
  if (callsLeft(F, s) <= 0) return { ok: false, s, why: 'calls' }
  const sit = situationOf(F, s), year = capYear(F)
  const d0 = decide(F, dealOf(F, s, ga, [], pa, []))
  if (d0.why === 'back' || d0.why === 'done') return { ok: false, s, why: d0.why, who: d0.who }
  const hit = p => hitOf(p, year, year)
  const mine = ga.map(id => F.teams[F.team].r.find(p => p.i === id))
  const O = mine.reduce((a, p) => a + hit(p), 0)
  const theirs = F.teams[s].r.filter(p => !p.tw && !whyNot(F, s, p) && !(p.tx && p.tx[2] != null && p.tx[2] >= 0 && (F.day ?? 0) - p.tx[2] < 40))
  // (salary filler: the men it gives up least to send, the bigger salaries first among them)
  const filler = theirs.filter(p => manValue(F, p) <= 12 && hit(p) > 0.5).sort((a, b) => manValue(F, a) - manValue(F, b)).slice(0, 6).sort((a, b) => hit(b) - hit(a)).slice(0, 4)
  const bases = gb0 => {
    const out = [gb0]
    for (const f of filler) if (!gb0.includes(f.i)) out.push([...gb0, f.i])
    if (filler.length >= 2) out.push([...gb0, ...filler.slice(0, 2).map(f => f.i).filter(i => !gb0.includes(i))])
    return out
  }
  const legal = gb => {
    const back = gb.map(id => F.teams[s].r.find(p => p.i === id)), I = back.reduce((a, p) => a + hit(p), 0)
    if (!fitsSide(F, s, I, O, mine.filter(p => onMinimum(p, year)).reduce((a, p) => a + hit(p), 0))) return false
    if (!fitsSide(F, F.team, O, I, back.filter(p => onMinimum(p, year)).reduce((a, p) => a + hit(p), 0))) return false
    return true
  }
  const list = []
  let cap = 0
  // PICKS: picks back, with the filler the money needs
  for (const gb of bases([])) {
    if (!legal(gb)) { cap++; continue }
    const d = dealOf(F, s, ga, gb, pa, [])
    if (!checkTrade(F, d).ok) { cap++; continue }
    if (!decide(F, d).yes || !even(F, d)) continue
    const t = topUp(F, d, s)
    if (t.pb.length || gb.length) list.push({ s, sit, deal: t, g: gauge(F, t), k: 'picks' })
    break
  }
  // PLAYER: a man who'd play in the GM's rotation (and what else it adds)
  const line = eighth(F)
  const help = theirs.filter(p => (p.o ?? 60) > line && manValue(F, p) > 4 && manValue(F, p) <= fairIn / FIND_EVEN && !(sit === 'win' && outValue(F, s, p, sit) > fairIn * 1.3))
    .sort((a, b) => manValue(F, b) - manValue(F, a)).slice(0, 3)
  let got = 0
  for (const m of help) {
    if (got >= 2) break
    for (const gb of bases([m.i])) {
      if (!legal(gb)) continue
      const d = dealOf(F, s, ga, gb, pa, [])
      if (!yes(F, d) || !even(F, d)) continue
      const t = topUp(F, d, s)
      list.push({ s, sit, deal: t, g: gauge(F, t), k: 'player' }); got++
      break
    }
  }
  if (!list.length) return { ok: false, s, why: cap >= bases([]).length ? 'cap' : 'low' }
  const best = k => list.filter(o => o.k === k).sort((a, b) => b.g.b - a.g.b)[0]
  return { ok: true, s, sit, list: [best('picks'), best('player')].filter(Boolean) }
}
// give: { ga: [the GM's men's ids], pa: [pick entries] }. Returns { open, why, list: [offer, best first], teams, line }
export function shopOffers(F, give) {
  const W = tradeWindow(F)
  if (!W.open) return { open: false, why: W.why, list: [], teams: 0 }
  const ga = [...(give?.ga ?? [])], pa = [...(give?.pa ?? [])]
  if (!ga.length && !pa.length) return { open: true, list: [], teams: 0 }
  const mine = ga.map(id => F.teams[F.team].r.find(p => p.i === id))
  if (mine.some(p => !p)) return { open: true, list: [], teams: 0, line: 'A player on the block is no longer on the roster.' }
  for (const p of mine) { const w = whyNot(F, F.team, p); if (w) return { open: true, list: [], teams: 0, line: w } }
  const fairIn = gauge(F, dealOf(F, others(F)[0], ga, [], pa, [])).a
  const list = [], no = {}
  let teams = 0
  for (const s of others(F)) {
    const o = offersFrom(F, s, ga, pa, fairIn)
    if (!o.ok) { (no[o.why] ??= []).push(s); continue }
    teams++
    list.push(...o.list)
  }
  list.sort((a, b) => b.g.b - a.g.b || a.s.localeCompare(b.s))
  // (salary filler and nothing else for a man the league values: not an offer, unless it's all anyone will do)
  const real = list.filter(o => o.g.b >= Math.max(1, o.g.a * 0.3))
  if (real.length) list.splice(0, list.length, ...real)
  else list.splice(3)
  let line = null
  if (!list.length) {
    const pay = mine.reduce((a, p) => a + hitOf(p, capYear(F), capYear(F)), 0)
    const who = mine.length === 1 ? mine[0].n : mine.length ? 'these players' : 'these picks'
    if ((no.cap?.length ?? 0) > (no.low?.length ?? 0)) line = `No team can fit ${mine.length === 1 ? `${mine[0].n}'s ${$(pay)}` : `${$(pay)} in salary`} under the matching rules with what it would send back.`
    else if (no.low?.length) line = !mine.length ? 'No team will give anything for those picks alone.' : pay >= 8 ? `There is no market for ${who} at ${$(pay)} a year. Teams see a contract they'd rather not take on.` : `There is no market for ${who}. Teams see ${mine.length === 1 ? 'him' : 'them'} as depth, and nobody gives up a pick for depth.`
    else line = `No team is taking calls from the ${F.team} right now.`
  }
  return { open: true, list, teams, no, line }
}

// ── 2. Who's out there, and what does he cost? ───────────────────────────────
// q: { pos (FIND_POS), minO, ageMin, ageMax, max$ ($M this season) }
export function findTargets(F, q) {
  const year = capYear(F), out = []
  for (const s of others(F)) for (const p of F.teams[s].r) {
    if (p.tw || (q.pos && p.p !== q.pos)) continue
    if (q.minO && (p.o ?? 0) < q.minO) continue
    if ((q.ageMin && p.ag < q.ageMin) || (q.ageMax && p.ag > q.ageMax)) continue
    if (q.max$ != null && hitOf(p, year, year) > q.max$) continue
    out.push({ p, s })
  }
  out.sort((a, b) => (b.p.o ?? 0) - (a.p.o ?? 0) || a.p.ag - b.p.ag || a.p.i - b.p.i)
  return out
}
// what he costs: { ok, s, p, deal, g } or { ok: false, s, p, text }
export function priceOf(F, s, id) {
  const p = F.teams[s]?.r.find(x => x.i === id)
  const no = text => ({ ok: false, s, p: p ?? null, text })
  if (!p) return no('He has changed teams.')
  const W = tradeWindow(F)
  if (!W.open) return no(W.why)
  const w = whyNot(F, s, p)
  if (w) return no(w)
  if (dealsWith(F, s) >= 3) return no(sayOf(F, s, { why: 'done' }))
  if (callsLeft(F, s) <= 0) return no(sayOf(F, s, { why: 'calls' }))
  const get = [id], year = capYear(F), hit = x => hitOf(x, year, year)
  const d0 = decide(F, dealOf(F, s, [], get, [], []))
  if (['back', 'new', 'agg', 'done'].includes(d0.why)) return no(sayOf(F, s, d0))
  const lv = Math.max(1, manValue(F, p)), I = hit(p), Imin = onMinimum(p, year) ? I : 0
  // what the GM can send: his picks, and the men who aren't as good as the one coming back (never his own build)
  const men = F.teams[F.team].r.filter(m => !m.tw && m.b == null && (m.o ?? 60) < (p.o ?? 60) && !whyNot(F, F.team, m))
    .map(m => ({ k: 'pl', v: m.i, i: -1 - m.i, lw: manValue(F, m), $: hit(m), min: onMinimum(m, year) ? hit(m) : 0 }))
    .sort((a, b) => b.$ - a.$).slice(0, 12)
  const picks = pickAssets(F, F.team).map(x => ({ k: 'pk', v: x.e, i: x.i, lw: x.v, $: 0, min: 0 }))
  const A = [...men, ...picks]
  const combos = []
  const add = set => {
    if (new Set(set.map(x => x.i)).size < set.length) return
    const pl = set.filter(x => x.k === 'pl'), pk = set.filter(x => x.k === 'pk')
    const lw = pkg(pl.map(x => x.lw)) + pk.reduce((a, x) => a + x.lw, 0)
    if (lw < lv * FIND_EVEN || lw > lv * 1.8 + 15) return
    const O = pl.reduce((a, x) => a + x.$, 0)
    if (!fitsSide(F, F.team, O, I, Imin) || !fitsSide(F, s, I, O, pl.reduce((a, x) => a + x.min, 0))) return
    combos.push({ set, lw, n: set.length })
  }
  for (let i = 0; i < A.length; i++) {
    add([A[i]])
    for (let j = i + 1; j < A.length; j++) {
      add([A[i], A[j]])
      for (let k = j + 1; k < A.length; k++) add([A[i], A[j], A[k]])
    }
  }
  combos.sort((a, b) => a.lw - b.lw || a.n - b.n)
  let checks = 0, last = null
  for (const c of combos) {
    if (checks >= 16) break
    const ga = c.set.filter(x => x.k === 'pl').map(x => x.v), pa = c.set.filter(x => x.k === 'pk').map(x => x.v)
    const d = dealOf(F, s, ga, get, pa, [])
    if (!checkTrade(F, d).ok) continue
    checks++
    const e = decide(F, d)
    if (!e.yes) { last = e; continue }
    // (nothing in it for nothing: a piece the team would take it without comes out, the least valuable first)
    let best = d
    for (const x of [...c.set].sort((a, b) => a.lw - b.lw)) {
      const less = { ...best, ga: best.ga.filter(v => x.k !== 'pl' || v !== x.v), pa: best.pa.filter(v => x.k !== 'pk' || v !== x.v) }
      if (less.ga.length + less.pa.length === best.ga.length + best.pa.length || !(less.ga.length + less.pa.length)) continue
      if (yes(F, less) && gauge(F, less).a >= lv * FIND_EVEN) best = less
    }
    return { ok: true, s, p, deal: best, g: gauge(F, best), sit: situationOf(F, s) }
  }
  if (!combos.length) {
    if (!men.some(m => fitsSide(F, F.team, m.$, I, Imin)) && I > 8) return no(`The ${F.team} can't match ${p.n}'s ${$(I)} salary with the players they'd move.`)
    return no(`The ${s} want more for ${p.n} than the ${F.team} can send without a better player.`)
  }
  if (last) return no(sayOf(F, s, last))
  return no(`The ${s} want more for ${p.n} than picks and bench players.`)
}
// the search the screen runs: the best `cap` men that fit, each priced
export function findDeals(F, q, cap = FIND_CAP) {
  const W = tradeWindow(F)
  const T = findTargets(F, q)
  if (!W.open) return { open: false, why: W.why, total: T.length, priced: 0, list: [], no: [] }
  const rows = T.slice(0, cap).map(x => priceOf(F, x.s, x.p.i))
  return { open: true, total: T.length, priced: rows.length, list: rows.filter(r => r.ok), no: rows.filter(r => !r.ok) }
}
