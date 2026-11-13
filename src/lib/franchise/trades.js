// FRANCHISE: trades. One value chart for everything (a player or a pick is worth points; the first pick in the
// draft is 3,000), used honestly by every CPU general manager: an offer is taken when what comes back is worth
// at least what goes out, a little more or less by how hard the league is set to deal, tilted by what the team
// is doing (a contender pays for help now, a rebuilding team for picks and youth) and what it needs.
//
// An offer: { from, to, give: { players: [id], picks: [key] }, get: { players: [id], picks: [key] } }: `give`
// leaves `from` for `to`, `get` comes back. A pick's key is `${year}-${round}-${original team}`.
import { REG_WEEKS, TRADE_DEADLINE, ROSTER_MAX, CAMP_MAX, MIN_AT, clamp, r2, slotOf, groupOf } from './consts'
import { TEAM_SHORTS, addNews, addTx, joinTeam, teamName, nick, groupCounts, activeCount, depthAfterMove, ranks, pct } from './core'
import { marketValue, payroll } from './money'
import { lineupOf } from './depth'

// ── The chart ────────────────────────────────────────────────────────────────
const PICK_PTS = [[1, 3000], [5, 1700], [10, 1300], [16, 1000], [24, 740], [32, 590], [48, 420], [64, 270], [80, 190], [100, 100], [130, 50], [160, 27], [200, 10], [224, 3], [262, 1]]
export function pickPoints(overall) {
  if (overall <= 1) return 3000
  for (let i = 1; i < PICK_PTS.length; i++) { const [x0, y0] = PICK_PTS[i - 1], [x1, y1] = PICK_PTS[i]; if (overall <= x1) return y0 + (y1 - y0) * (overall - x0) / (x1 - x0) }
  return 1
}
export const pickKey = pk => `${pk.y}-${pk.r}-${pk.o}`
// where a team is likely to pick: by its record once there is one, by its roster before that
export function projectedSlot(F, short) {
  if (F.draft?.order && F.draft.year === undefined) return 16
  const val = {}
  for (const s of TEAM_SHORTS) { const p = (F.power ?? []).find(x => x.s === s); val[s] = p ? p.v : 0 }
  return 33 - ranks(val)[short]            // the best team picks 32nd
}
export function pickValue(F, pk) {
  const slot = pk.slot ?? projectedSlot(F, pk.o)
  const overall = (pk.r - 1) * 32 + slot
  const out = Math.max(0, pk.y - (F.draft?.year ?? F.year + 1))
  return Math.round(pickPoints(overall) * Math.pow(0.85, out))
}
const POS_W = { QB: 1.6, EDGE: 1.15, WR: 1.1, LT: 1.05, RT: 1.0, CB: 1.05, DT: 1.0, S: 0.85, LB: 0.85, TE: 0.85, LG: 0.8, RG: 0.8, C: 0.8, RB: 0.75, K: 0.22 }
const AGE_SHIFT = { QB: 5, K: 8, LT: 2, LG: 2, C: 2, RG: 2, RT: 2, RB: -2 }
export function playerValue(F, p) {
  const slot = slotOf(p)
  let v = 3.2 * Math.pow(Math.max(0, p.ovr - 60), 2) * (slot === 'QB' && p.ovr < 80 ? 0.9 : POS_W[slot] ?? 0.9)
  const a = p.age - (AGE_SHIFT[slot] ?? 0)
  v *= a <= 24 ? 1.15 : a <= 27 ? 1 : a === 28 ? 0.88 : a === 29 ? 0.76 : a === 30 ? 0.62 : a === 31 ? 0.5 : a === 32 ? 0.4 : 0.28
  if (p.devKnown && a <= 26) v *= [1, 1.1, 1.22, 1.35][p.dev ?? 0]
  if (p.con) {
    const mv = marketValue(p, F.cap)
    v *= clamp(1 + (mv - p.con.sal) / (0.12 * F.cap), 0.5, 1.3)
    if (p.con.yrs <= 1) v *= 0.8
  }
  if (p.inj && p.inj.wk >= 4) v *= 0.6
  return Math.round(v)
}

// ── How a team looks at a deal ───────────────────────────────────────────────
// what a team is doing: its state (state.js), or for the user's team the direction its GM has declared
const stance = (F, t) => (t.short === F.team ? F.gm.dir ?? t.state : t.state) ?? 'retool'
// how much this team wants a given player (1 = the chart)
function wantOf(F, t, p) {
  let k = 1
  const strat = stance(F, t)
  if (strat === 'contend') k *= p.age >= 28 ? 1.12 : 1
  if (strat === 'rebuild') k *= p.age >= 29 ? 0.72 : p.age <= 24 ? 1.12 : 1
  // a need: he would start here
  const L = lineupOf(F, t), slot = slotOf(p)
  const cur = p.pos === 'ol' ? L.OL.find(o => o.spot === p.sub)?.p : (L[slot] ?? [])[0]
  if (!cur || p.ovr >= cur.ovr + 3) k *= 1.12
  else if (p.ovr < cur.ovr - 6) k *= 0.85
  return k
}
const pickWant = (F, t) => (stance(F, t) === 'rebuild' ? 1.15 : stance(F, t) === 'contend' ? 0.9 : 1)
const MARGIN = { easy: 0.94, fair: 1.05, hard: 1.2 }
const findPick = (F, short, key) => F.teams[short].picks.find(pk => pickKey(pk) === key)

// The other general manager's answer, before anything moves. `me`: the side asking (the user, or a CPU team).
export function judge(F, offer, { margin = null } = {}) {
  const A = F.teams[offer.from], B = F.teams[offer.to]
  if (!A || !B || offer.from === offer.to) return { ok: false, give: 0, get: 0, gap: 0, answer: 'There is no deal to make there.', capOk: true, rosterOk: true, counter: null }
  const give = offer.give ?? {}, get = offer.get ?? {}
  const gp = (give.players ?? []).map(id => F.players[id]).filter(p => p && p.team === offer.from), gk = (give.picks ?? []).map(k => findPick(F, offer.from, k)).filter(Boolean)
  const rp = (get.players ?? []).map(id => F.players[id]).filter(p => p && p.team === offer.to), rk = (get.picks ?? []).map(k => findPick(F, offer.to, k)).filter(Boolean)
  if (!gp.length && !gk.length && !rp.length && !rk.length) return { ok: false, give: 0, get: 0, gap: 0, answer: 'Put something on the table.', capOk: true, rosterOk: true, counter: null }
  // what B thinks it is getting and giving
  const bGets = gp.reduce((s, p) => s + playerValue(F, p) * wantOf(F, B, p), 0) + gk.reduce((s, pk) => s + pickValue(F, pk) * pickWant(F, B), 0)
  const bGives = rp.reduce((s, p) => s + playerValue(F, p) * (p.block ? 0.9 : p.built ? 1.4 : 1.05), 0) + rk.reduce((s, pk) => s + pickValue(F, pk), 0)
  const m = margin ?? (MARGIN[F.settings.tradeAI] ?? 1.05) * (offer.from === F.team ? 1 - (F.gm.tree?.trading ?? 0) * 0.02 : 1)
  // money and bodies, both sides
  const dPayA = rp.reduce((s, p) => s + (p.con?.sal ?? 0), 0) - gp.reduce((s, p) => s + (p.con?.sal ?? 0), 0)
  const capOk = !F.settings.cap || (payroll(F, A) + dPayA <= F.cap + 0.001 && payroll(F, B) - dPayA <= F.cap + 0.001)
  const limit = F.phase === 'offseason' ? CAMP_MAX : ROSTER_MAX
  const cA = groupCounts(F, A), cB = groupCounts(F, B)
  for (const p of gp) { cA[groupOf(p)]--; cB[groupOf(p)]++ }
  for (const p of rp) { cB[groupOf(p)]--; cA[groupOf(p)]++ }
  const short = c => Object.keys(MIN_AT).some(g => c[g] < MIN_AT[g])
  const rosterOk = activeCount(F, A) - gp.length + rp.length <= limit && activeCount(F, B) - rp.length + gp.length <= limit && (F.phase === 'offseason' || (!short(cA) && !short(cB)))
  const gap = Math.round(bGives * m - bGets)
  const fair = gap <= 0
  let answer, counter = null
  const them = nick(offer.to)
  if (!capOk) answer = `The money does not work. One of the two teams would be over the cap.`
  else if (!rosterOk) answer = `The rosters do not work: one side ends up over the limit or short at a position.`
  else if (rp.some(p => p.con?.tag)) answer = `The ${them} will not move a player they just tagged.`
  else if (fair) answer = bGets > bGives * 1.5 ? `The ${them} say yes before the call is over.` : `That works for the ${them}.`
  else {
    // a counter: the smallest pick of the asker's that covers the gap
    const spare = A.picks.filter(pk => !gk.includes(pk)).map(pk => ({ pk, v: pickValue(F, pk) * pickWant(F, B) })).filter(x => x.v >= gap).sort((a, b) => a.v - b.v)[0]
    if (spare && gap < bGives * 0.6) counter = { from: offer.from, to: offer.to, give: { players: gp.map(p => p.id), picks: [...gk.map(pickKey), pickKey(spare.pk)] }, get: { players: rp.map(p => p.id), picks: rk.map(pickKey) } }
    answer = gap > bGives * 0.6 ? `The ${them} are not close to doing that.` : counter ? `The ${them} want more: add ${pickWords(F, spare.pk)} and it is done.` : `The ${them} want more than that.`
  }
  return { ok: fair && capOk && rosterOk && !rp.some(p => p.con?.tag), give: Math.round(bGets), get: Math.round(bGives), gap, answer, capOk, rosterOk, counter }
}
const ord = n => ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][n] ?? `${n}th`
// which draft a pick is in, without naming a year that has not been played
export const pickWhen = (F, pk) => { const n = pk.y - (F.draft?.year ?? F.year + 1); return n <= 0 ? 'the next draft' : n === 1 ? 'the draft after next' : 'the draft in three years' }
export const pickWords = (F, pk) => `a ${ord(pk.r)}-round pick in ${pickWhen(F, pk)}`

export function execute(F, offer) {
  const A = F.teams[offer.from], B = F.teams[offer.to]
  const gp = (offer.give?.players ?? []).map(id => F.players[id]).filter(Boolean), rp = (offer.get?.players ?? []).map(id => F.players[id]).filter(Boolean)
  const gk = (offer.give?.picks ?? []).map(k => findPick(F, offer.from, k)).filter(Boolean), rk = (offer.get?.picks ?? []).map(k => findPick(F, offer.to, k)).filter(Boolean)
  for (const p of gp) { joinTeam(F, p, offer.to); p.block = undefined; p.want = undefined; p.yrsHere = 0; p.mood = clamp(p.mood + 4, 5, 95) }
  for (const p of rp) { joinTeam(F, p, offer.from); p.block = undefined; p.want = undefined; p.yrsHere = 0; p.mood = clamp(p.mood + 4, 5, 95) }
  for (const pk of gk) { A.picks = A.picks.filter(x => x !== pk); B.picks.push(pk) }
  for (const pk of rk) { B.picks = B.picks.filter(x => x !== pk); A.picks.push(pk) }
  const say = (ps, ks) => [...ps.map(p => `${slotOf(p)} ${p.name}`), ...ks.map(pk => pickWords(F, pk))].join(', ') || 'nothing'
  const text = `${teamName(offer.from)} send ${say(gp, gk)} to ${teamName(offer.to)} for ${say(rp, rk)}.`
  addTx(F, 'trade', offer.from, text); addTx(F, 'trade', offer.to, text)
  const big = [...gp, ...rp].sort((a, b) => b.ovr - a.ovr)[0]
  if (big && (big.ovr >= 82 || offer.from === F.team || offer.to === F.team)) addNews(F, 'trade', `${nick(big.team)} trade for ${big.name}`, { team: big.team, pid: big.id, body: text })
  else if (!big && (gk.length || rk.length) && (offer.from === F.team || offer.to === F.team)) addNews(F, 'trade', `${nick(offer.from)} and ${nick(offer.to)} swap picks`, { body: text })
  depthAfterMove(F, A); depthAfterMove(F, B)
  // on draft day the order follows the picks at once (whoever holds a pick is on the clock for it)
  const D = F.draft
  if (D?.started && !D.done && (gk.length || rk.length)) {
    const owner = {}
    for (const s of TEAM_SHORTS) for (const pk of F.teams[s].picks) if (pk.y === D.year) owner[`${pk.r}-${pk.o}`] = s
    for (let i = D.at; i < D.order.length; i++) { const t = owner[`${D.order[i].r}-${D.order[i].o}`]; if (t) D.order[i].t = t }
  }
  F.offers = (F.offers ?? []).filter(o => ![...(o.give?.players ?? []), ...(o.get?.players ?? [])].some(id => gp.some(p => p.id === id) || rp.some(p => p.id === id)) && ![...(o.give?.picks ?? []), ...(o.get?.picks ?? [])].some(k => gk.some(pk => pickKey(pk) === k) || rk.some(pk => pickKey(pk) === k)))
}
export const tradesOpen = F => F.phase === 'offseason' || (F.phase === 'regular' && F.week <= TRADE_DEADLINE)

// ── The CPU's own dealing ────────────────────────────────────────────────────
// a pick of `from`'s worth about v to a team (the closest one not above 1.25 v)
function pickNear(F, from, v, want = 1) {
  return from.picks.map(pk => ({ pk, v: pickValue(F, pk) * want })).filter(x => x.v <= v * 1.25 && x.v >= v * 0.55).sort((a, b) => Math.abs(a.v - v) - Math.abs(b.v - v))[0]?.pk ?? null
}
// A week before the deadline. Teams act their state: a contender buys a veteran from a team that is selling;
// and the phone rings for the user according to the direction his GM has declared (a rebuilding GM is offered
// picks for his veterans, a contending one is offered veterans for his picks).
export function cpuTradeWeek(F, R) {
  if (F.week < 3) return
  const user = F.team, late = F.week >= TRADE_DEADLINE - 2
  const sellers = TEAM_SHORTS.filter(s => s !== user && F.teams[s].state === 'rebuild'), buyers = TEAM_SHORTS.filter(s => s !== user && F.teams[s].state === 'contend')
  for (let k = 0; k < (late ? 2 : 1); k++) {
    if (!R.chance(late ? 0.55 : 0.25)) continue
    const s = R.pick(sellers), b = R.pick(buyers)
    if (!s || !b) continue
    const B = F.teams[b]
    const p = F.teams[s].roster.map(id => F.players[id]).filter(x => x && x.age >= 27 && x.ovr >= 79 && x.con && x.con.yrs <= 2 && !x.inj && x.pos !== 'qb' && wantOf(F, B, x) > 1.05).sort((a, b2) => b2.ovr - a.ovr)[0]
    if (!p) continue
    const pk = pickNear(F, B, playerValue(F, p) * 0.9)
    const offer = pk && { from: b, to: s, give: { players: [], picks: [pickKey(pk)] }, get: { players: [p.id], picks: [] } }
    if (offer && judge(F, offer, { margin: 0.8 }).ok) execute(F, offer)
  }
  if ((F.offers ?? []).filter(o => !o.draft).length >= 2) return
  const U = F.teams[user], dir = stance(F, U)
  const push = offer => { const j = judgeForUser(F, offer); if (j.capOk && j.rosterOk) (F.offers ??= []).push(offer) }
  const id = () => (F.offerId = (F.offerId ?? 0) + 1)
  if (dir === 'contend') {
    // a seller offers a veteran who would start here, for a pick
    if (!R.chance(late ? 0.5 : 0.25)) return
    const pool = []
    for (const s of sellers) for (const pid of F.teams[s].roster) { const p = F.players[pid]; if (p && p.age >= 27 && p.ovr >= 80 && p.con && p.con.yrs <= 2 && !p.inj && p.pos !== 'qb' && p.pos !== 'k' && wantOf(F, U, p) > 1.1) pool.push(p) }
    const p = pool.sort((a, b) => b.ovr - a.ovr)[R.int(0, Math.min(3, pool.length - 1))]
    if (!p) return
    const pk = pickNear(F, U, playerValue(F, p) * 0.95)
    if (pk) push({ id: id(), from: p.team, to: user, give: { players: [p.id], picks: [] }, get: { players: [], picks: [pickKey(pk)] }, week: F.week })
    return
  }
  // otherwise an offer for one of the user's players: a rebuilding GM hears about his veterans, anyone hears
  // about the men on his block
  if (!R.chance(dir === 'rebuild' ? (late ? 0.7 : 0.45) : 0.3)) return
  const L = lineupOf(F, U), starts = new Set()
  for (const k in L) if (Array.isArray(L[k])) L[k].slice(0, 1).forEach(p => p?.id && starts.add(p.id))
  const pool = U.roster.map(pid => F.players[pid]).filter(p => p && !p.built && !p.inj && p.pos !== 'k' && !(F.offers ?? []).some(o => o.get?.players?.includes(p.id))
    && (p.block || (dir === 'rebuild' ? p.age >= 28 && p.ovr >= 78 && p.con && p.con.yrs <= 2 : !starts.has(p.id) && p.ovr >= 74)))
  const p = pool.sort((a, b) => (b.block ? 1000 : 0) + b.ovr - (a.block ? 1000 : 0) - a.ovr)[0]
  if (!p) return
  const suitors = TEAM_SHORTS.filter(s => s !== user && (dir !== 'rebuild' || F.teams[s].state !== 'rebuild')).map(s => ({ s, k: wantOf(F, F.teams[s], p) * (F.teams[s].state === 'contend' ? 1.1 : 1) })).filter(x => x.k > 1.05).sort((a, b) => b.k - a.k)
  const s = suitors[R.int(0, Math.min(2, suitors.length - 1))]?.s
  if (!s) return
  const pk = pickNear(F, F.teams[s], playerValue(F, p) * (p.block ? 0.85 : 1.05), 1)
  if (pk) push({ id: id(), from: s, to: user, give: { players: [], picks: [pickKey(pk)] }, get: { players: [p.id], picks: [] }, week: F.week })
}
// an offer made TO the user is always the CPU's to honour; only money and bodies can stop it
export function judgeForUser(F, offer) { return judge(F, { from: offer.from, to: offer.to, give: offer.give, get: offer.get }, { margin: 0 }) }
export const offerText = (F, o) => {
  const say = (ps, ks, from) => [...ps.map(id => F.players[id]).filter(Boolean).map(p => `${slotOf(p)} ${p.name}`), ...ks.map(k => findPick(F, from, k)).filter(Boolean).map(pk => pickWords(F, pk))].join(', ')
  return `${teamName(o.from)} offer ${say(o.give.players ?? [], o.give.picks ?? [], o.from)} for ${say(o.get.players ?? [], o.get.picks ?? [], o.to)}.`
}
export { REG_WEEKS, pct, r2 }
