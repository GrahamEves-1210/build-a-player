// FRANCHISE: what the general manager does during a week (API.md section 3). Every action hands back a new
// top-level league; a refused one leaves the league alone and says why in flash.
import { ROSTER_MAX, CAMP_MAX, TRADE_DEADLINE, SLOT_BY, clamp, r2, slotOf, MIN_SALARY, VET_MIN } from './consts'
import { touch, fail, ok, addNews, addTx, teamName, nick, activeCount, depthAfterMove } from './core'
import { payroll, newContract, moneyText, marketValue, nextYearBooks } from './money'
import { TYPES_OF } from './players'
import { canUpgrade, applyUpgrade, spendPoints, upgradeCost } from './dev'
import { settle, extensionAsk } from './office'
import { judge, execute, tradesOpen, judgeForUser, playerValue, pickValue, pickKey } from './trades'
import { computeStates } from './state'
import { autoScout } from './draft'
import { release, sign, streetAsk, upkeep, rosterLimit, fitUnderCap, restructure, reliefRoom } from './roster'
import { rngOf } from './rng'
import { TEAM_SHORTS } from './core'
import { lineupOf } from './depth'
import { askOf } from './views'

const OFF_PLANS = ['balanced', 'air', 'ground', 'quick', 'shots'], DEF_PLANS = ['balanced', 'stopRun', 'rush', 'cover', 'ball']
const mineOnly = (F, pid) => { const p = F.players[pid]; return p && p.team === F.team ? p : null }

export function setGameplan(F, { off, def } = {}) {
  if (off != null && !OFF_PLANS.includes(off)) return fail(F, 'plan', 'There is no such offensive plan.')
  if (def != null && !DEF_PLANS.includes(def)) return fail(F, 'plan', 'There is no such defensive plan.')
  F.plan = { off: off ?? F.plan?.off ?? 'balanced', def: def ?? F.plan?.def ?? 'balanced' }
  F.done.gameplan = true
  return touch(F)
}
export function setPractice(F, { intensity, focus } = {}) {
  if (intensity != null && !['full', 'half', 'walk'].includes(intensity)) return fail(F, 'practice', 'There is no such practice.')
  const on = new Set(F.teams[F.team].roster)
  F.practice = { intensity: intensity ?? F.practice?.intensity ?? 'half', focus: (focus ?? F.practice?.focus ?? []).filter(id => on.has(id)).slice(0, 3) }
  F.done.practice = true
  return touch(F)
}
export const officeItems = F => F.office.map(o => {
  const p = o.pid != null ? F.players[o.pid] : null
  return { id: o.id, kind: o.kind, title: o.title, body: o.body, who: p ? { id: p.id, name: p.name, slot: slotOf(p), ovr: p.ovr, photo: p.photo ?? null, built: !!p.built, team: p.team ?? null, role: slotOf(p), roleName: SLOT_BY[slotOf(p)]?.name ?? slotOf(p), kind: 'player' } : null, options: o.options, delegate: o.delegate }
})
export function resolveOffice(F, itemId, optionId = 'delegate') {
  const item = F.office.find(o => o.id === itemId)
  if (!item) return fail(F, 'office', 'That item is closed.')
  const msg = settle(F, item, optionId === 'delegate' ? item.delegate : optionId)
  return ok(F, msg)
}
export function upgradeTrait(F, pid, trait) {
  const p = mineOnly(F, pid)
  if (!p) return fail(F, 'player', 'He is not on this team.')
  if (!TYPES_OF[p.pos].includes(trait)) return fail(F, 'trait', 'He has no such rating.')
  if (upgradeCost(p.a[trait]) == null) return fail(F, 'max', 'That rating is as high as it goes.')
  if (!canUpgrade(p, trait)) return fail(F, 'points', `That costs ${upgradeCost(p.a[trait])} upgrade point${upgradeCost(p.a[trait]) > 1 ? 's' : ''}. He has ${p.pts ?? 0}.`)
  applyUpgrade(p, trait)
  return touch(F)
}
export function autoUpgrade(F, pid = null) {
  const list = pid != null ? [mineOnly(F, pid)].filter(Boolean) : F.teams[F.team].roster.map(id => F.players[id]).filter(Boolean)
  let n = 0
  for (const p of list) n += spendPoints(p)
  return ok(F, n ? `${n} upgrade${n > 1 ? 's' : ''} made.` : 'No points to spend.')
}

// ── Trades ───────────────────────────────────────────────────────────────────
export function proposeTrade(F, offer) {
  if (!tradesOpen(F)) return fail(F, 'deadline', `The trade deadline passed after Week ${TRADE_DEADLINE}.`)
  const o = { ...offer, from: F.team }
  const j = judge(F, o)
  if (!j.ok) return { ...F, flash: { ok: false, code: 'declined', msg: j.answer, accepted: false, answer: j.answer, counter: j.counter } }
  execute(F, o)
  return touch(F, { ok: true, msg: j.answer, accepted: true, answer: j.answer })
}
export function answerOffer(F, offerId, accept) {
  const o = (F.offers ?? []).find(x => x.id === offerId)
  if (!o) return fail(F, 'offer', 'That offer is off the table.')
  if (accept) {
    if (!tradesOpen(F)) return fail(F, 'deadline', 'The trade deadline has passed.')
    const j = judgeForUser(F, o)
    if (!j.capOk || !j.rosterOk) return fail(F, 'trade', j.answer)
    execute(F, o)
  }
  F.offers = (F.offers ?? []).filter(x => x.id !== offerId)
  F.office = F.office.filter(x => !(x.kind === 'trade-offer' && x.data?.offerId === offerId))
  return ok(F, accept ? 'The trade is done.' : 'Offer declined.')
}
export function setBlock(F, pid, on = true) {
  const p = mineOnly(F, pid)
  if (!p) return fail(F, 'player', 'He is not on this team.')
  p.block = on ? true : undefined
  return touch(F)
}
// ask the league what it would give for a man: up to three real offers (they stay on the table)
export function shopPlayer(F, pid) {
  const p = mineOnly(F, pid)
  if (!p) return fail(F, 'player', 'He is not on this team.')
  if (!tradesOpen(F)) return fail(F, 'deadline', 'The trade deadline has passed.')
  if (!F.teams[F.team].state) computeStates(F, { quiet: true })
  const R = rngOf(`${F.seed}-${F.year}-${F.week}-shop-${pid}`), v = playerValue(F, p), made = []
  const teams = R.shuffle(TEAM_SHORTS.filter(s => s !== F.team))
  for (const s of teams) {
    if (made.length >= 3) break
    const t = F.teams[s], L = lineupOf(F, t), cur = p.pos === 'ol' ? L.OL.find(o => o.spot === p.sub)?.p : (L[slotOf(p)] ?? [])[0]
    if (cur && cur.ovr >= p.ovr + 2) continue
    const pk = t.picks.map(x => ({ x, v: pickValue(F, x) })).filter(x => x.v <= v * 1.02 && x.v >= v * 0.45).sort((a, b) => b.v - a.v)[0]
    if (!pk) continue
    const offer = { id: (F.offerId = (F.offerId ?? 0) + 1), from: s, to: F.team, give: { players: [], picks: [pickKey(pk.x)] }, get: { players: [p.id], picks: [] }, week: F.week }
    const j = judgeForUser(F, offer)
    if (j.capOk && j.rosterOk) { made.push(offer); (F.offers ??= []).push(offer) }
  }
  p.block = true
  return touch(F, { ok: true, msg: made.length ? `${['', 'One team', 'Two teams', 'Three teams'][made.length] ?? `${made.length} teams`} called about ${p.name}.` : `Nobody is offering anything for ${p.name} right now.`, offers: made })
}

// ── Roster ───────────────────────────────────────────────────────────────────
export function releasePlayer(F, pid) {
  const p = mineOnly(F, pid)
  if (!p) return fail(F, 'player', 'He is not on this team.')
  release(F, p)
  return ok(F, `${p.name} has been released.`)
}
export function signFreeAgent(F, pid, terms = null) {
  const p = F.players[pid]
  if (!p || p.team || !F.fa.includes(pid)) return fail(F, 'player', 'He is not a free agent.')
  const t = F.teams[F.team]
  if (activeCount(F, t) >= rosterLimit(F)) return fail(F, 'roster', `The roster is full (${rosterLimit(F)}). Release someone first.`)
  const ask = F.phase === 'offseason' ? askOf(F, p) : streetAsk(F, p)
  const years = clamp(Math.round(terms?.years ?? ask.years), 1, 5), perYear = r2(terms?.perYear ?? ask.perYear)
  if (perYear < ask.perYear * 0.97 - 0.001) return fail(F, 'ask', `${p.name} wants ${moneyText(ask.perYear)} a year.`)
  if (F.settings.cap && payroll(F, t) + perYear > F.cap + 0.001) return fail(F, 'cap', `That puts the ${nick(F.team)} ${moneyText(r2(payroll(F, t) + perYear - F.cap))} over the cap.`)
  sign(F, p, F.team, newContract(p, { yrs: years, sal: perYear, guarShare: years > 1 ? ask.guaranteed : 0 }))
  if (p.ovr >= 80) addNews(F, 'signing', `${nick(F.team)} sign ${p.name}`, { team: F.team, pid: p.id })
  return ok(F, `${p.name} signed.`)
}
export function moveToIR(F, pid) {
  const p = mineOnly(F, pid)
  if (!p) return fail(F, 'player', 'He is not on this team.')
  if (!p.inj || p.inj.wk < 1) return fail(F, 'ir', 'Only an injured player can go on injured reserve.')
  if (p.inj.ir) return fail(F, 'ir', 'He is already on injured reserve.')
  p.inj.ir = true; p.inj.q = false
  if (p.inj.wk < 4) p.inj.wk = 4   // a man on injured reserve misses at least four games
  F.office = (F.office ?? []).filter(o => !(o.kind === 'questionable' && o.pid === p.id))   // (no 'play him or rest him?' for a man on IR)
  addTx(F, 'ir', F.team, `${teamName(F.team)} placed ${slotOf(p)} ${p.name} on injured reserve.`, p.id)
  depthAfterMove(F, F.teams[F.team])
  return touch(F)
}
export function activate(F, pid) {
  const p = mineOnly(F, pid)
  if (!p?.inj?.ir) return fail(F, 'ir', 'He is not on injured reserve.')
  if (p.inj.wk > 0) return fail(F, 'ir', `He is still ${p.inj.wk} week${p.inj.wk > 1 ? 's' : ''} away.`)
  p.inj = null
  addTx(F, 'activate', F.team, `${teamName(F.team)} activated ${slotOf(p)} ${p.name} from injured reserve.`, p.id)
  depthAfterMove(F, F.teams[F.team])
  return touch(F)
}
// an extension during the season for a man in the last year of his deal (it starts next season)
export function extendPlayer(F, pid, terms = null) {
  const p = mineOnly(F, pid)
  if (!p || !p.con) return fail(F, 'player', 'He is not on this team.')
  if (p.con.yrs > 1) return fail(F, 'extend', 'He is under contract past this season.')
  if (p.ext) return fail(F, 'extend', 'He has already signed an extension.')
  if (p.cold === F.year) return fail(F, 'extend', `${p.name} is not talking until the season is over.`)
  const ask = extensionAsk(F, p)
  const years = clamp(Math.round(terms?.years ?? ask.years), 1, 5), perYear = r2(terms?.perYear ?? ask.perYear), g = terms?.guaranteed ?? ask.guaranteed
  const worth = perYear * (0.8 + 0.2 * Math.min(1.3, g / Math.max(0.05, ask.guaranteed)))
  if (worth < ask.perYear * 0.97) return fail(F, 'ask', `${p.name} wants about ${moneyText(ask.perYear)} a year for ${ask.years} year${ask.years > 1 ? 's' : ''}.`)
  if (F.settings.cap && nextYearBooks(F, F.teams[F.team]) + perYear > F.cap * 1.04) return fail(F, 'cap', `That deal does not fit on next season's books.`)
  p.ext = newContract(p, { yrs: years, sal: perYear, guarShare: g })
  p.mood = clamp(p.mood + 10, 3, 97)
  addTx(F, 'extend', F.team, `${teamName(F.team)} signed ${slotOf(p)} ${p.name} to a ${years}-year extension (${moneyText(perYear)} a year).`, p.id)
  F.office = F.office.filter(o => !(o.kind === 'contract' && o.pid === pid))
  return ok(F, `${p.name} signed his extension.`)
}
// Move part of this season's cap charges into next year (a loan against next year's cap: it is dead money then).
// amount: $M; left out, as much as the limit allows up to what the team is over the cap by (or $10M).
export function restructureCap(F, amount = null) {
  const t = F.teams[F.team], room = reliefRoom(F, t)
  if (room <= 0) return fail(F, 'restructure', 'There is nothing left to push into next year: the limit is 12% of the cap.')
  const over = r2(payroll(F, t) - F.cap)
  const x = restructure(F, t, amount ?? (over > 0 ? over : 10))
  addTx(F, 'extend', F.team, `${teamName(F.team)} restructured contracts, moving ${moneyText(x)} of cap charges into next season.`)
  return ok(F, `${moneyText(x)} moved into next season. It counts as dead money then.`)
}
export function renamePlayer(F, pid, name) {
  const p = mineOnly(F, pid), n = String(name ?? '').trim().slice(0, 28)
  if (!p?.built) return fail(F, 'player', 'Only a built player can be renamed.')
  if (n.length < 2) return fail(F, 'name', 'That name is too short.')
  p.name = n
  return touch(F)
}
export function setNumber(F, pid, num) {
  const p = mineOnly(F, pid), n = Math.round(Number(num))
  if (!p?.built) return fail(F, 'player', 'Only a built player\'s number can be changed.')
  if (!(n >= 0 && n <= 99)) return fail(F, 'number', 'Numbers run from 0 to 99.')
  const clash = F.teams[F.team].roster.map(id => F.players[id]).find(x => x && x.id !== pid && x.num === n)
  if (clash) return fail(F, 'number', `${clash.name} wears ${n}.`)
  p.num = n
  return touch(F)
}
// the staff does everything still open this week except the game
export function delegateWeek(F) {
  for (const item of [...F.office]) settle(F, item, item.delegate)
  const t = F.teams[F.team]
  for (const id of t.roster) { const p = F.players[id]; if (p && (p.pts ?? 0) > 0) spendPoints(p) }
  upkeep(F, t, rngOf(`${F.seed}-${F.year}-${F.week}-delegate`))
  autoScout(F)
  fitUnderCap(F, t)
  F.done = { ...F.done, gameplan: true, practice: true, injury: true }
  return ok(F, 'The staff has it handled.')
}
export { ROSTER_MAX, CAMP_MAX, MIN_SALARY, VET_MIN, marketValue }
