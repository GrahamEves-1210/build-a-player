// FRANCHISE: front office items. Zero to two a week, each born from something that is true in the league right
// now: a good player who isn't starting, a star in a contract year, an offer on the table, a starter who is
// questionable, a veteran who wants to bring a rookie along, a question from the press after a streak. Each
// has two or three real choices and DELEGATE (the staff's pick, marked on the item).
//
// An item (F.office[]): { id, kind, week, pid?, title, body, options: [{ id, label, text }], delegate, data? }
import { REG_WEEKS, TRADE_DEADLINE, clamp, r2, slotOf } from './consts'
import { addNews, addTx, nick, teamName } from './core'
import { marketValue, marketYears, marketGuar, newContract, payroll } from './money'
import { startersOf } from './depth'
import { giveXp, injWords } from './week'
import { execute, judgeForUser, offerText, playerValue } from './trades'
import { playcall } from './rows'
import { applyDirection, directionOf, directionRead, STATE_LABEL } from './state'

const mine = F => F.teams[F.team].roster.map(id => F.players[id]).filter(Boolean)
const push = (F, item) => { item.id = `o${(F.officeId = (F.officeId ?? 0) + 1)}`; item.week = F.week; F.office.push(item) }
// what a man in a contract year asks for now (a little under the open market: he gives up his shot at it)
export function extensionAsk(F, p) {
  const mv = marketValue(p, F.cap)
  return { years: marketYears(p), perYear: r2(mv * (p.drives?.includes('LOYAL') ? 0.92 : p.drives?.includes('MONEY') ? 1.04 : 0.98)), guaranteed: r2(marketGuar(p)) }
}

export function makeOffice(F, R) {
  if (F.phase === 'offseason') return
  const P = mine(F), t = F.teams[F.team], starts = startersOf(F, t), reg = F.week <= REG_WEEKS
  const have = k => F.office.some(o => o.kind === k)
  const asked = (p, k) => p.asked?.[k] === F.year
  const mark = (p, k) => { (p.asked ??= {})[k] = F.year }
  const cands = []
  // a waiting trade offer becomes an item
  for (const o of F.offers ?? []) if (!F.office.some(x => x.kind === 'trade-offer' && x.data?.offerId === o.id)) {
    const p = F.players[o.get.players?.[0]]
    cands.push([5, () => push(F, { kind: 'trade-offer', pid: p?.id ?? null, title: 'TRADE OFFER', body: offerText(F, o), data: { offerId: o.id },
      options: [{ id: 'accept', label: 'ACCEPT', text: 'The deal is done today.' }, { id: 'decline', label: 'DECLINE', text: 'Nothing changes.' }], delegate: p && playerValue(F, p) < 500 ? 'accept' : 'decline' })])
  }
  // a starter who is questionable: a one-week injury he could play through
  for (const p of P) if (p.inj && p.inj.wk === 1 && !p.inj.ir && !p.inj.q && p.ovr >= 76 && !have('questionable')) {
    cands.push([4, () => { p.inj.q = true; push(F, { kind: 'questionable', pid: p.id, title: 'QUESTIONABLE', body: `${p.name} (${injWords(p.inj.what)}) wants to play this week. The trainers say he can go, at less than full speed, with a real chance of making it worse.`,
      options: [{ id: 'play', label: 'PLAY HIM', text: 'He starts. About one time in four he aggravates it and misses three more weeks.' }, { id: 'rest', label: 'REST HIM', text: 'He sits this week and is healthy for the next one.' }], delegate: 'rest' }) }])
    break
  }
  if (reg) {
    // a good player on the bench wants a bigger role
    const bench = P.filter(p => !starts.has(p.id) && p.ovr >= 77 && p.mood < 48 && !p.inj && p.pos !== 'k' && !asked(p, 'role')).sort((a, b) => a.mood - b.mood)[0]
    if (bench) cands.push([3, () => { mark(bench, 'role'); push(F, { kind: 'role', pid: bench.id, title: 'WANTS A BIGGER ROLE', body: `${bench.name} came upstairs after practice. He thinks he should be starting, and he is not happy sitting.`,
      options: [{ id: 'promise', label: 'PROMISE HIM SNAPS', text: 'He moves up the depth chart for the next three weeks. His mood improves; the man he passes will notice.' }, { id: 'earn', label: 'TELL HIM TO EARN IT', text: 'Nothing changes on the depth chart. He takes it badly unless he is a competitor.' }, ...(F.week <= TRADE_DEADLINE ? [{ id: 'shop', label: 'PUT HIM ON THE BLOCK', text: 'The league is told he is available. Offers may follow.' }] : [])], delegate: 'earn' }) }])
    // a star in a contract year wants to talk now
    const walk = P.filter(p => p.con && p.con.yrs === 1 && !p.ext && p.ovr >= 82 && !asked(p, 'contract') && !(p.con.rookie && p.con.opt === 1)).sort((a, b) => b.ovr - a.ovr)[0]
    if (walk && F.week >= 4 && F.week <= 14) {
      const ask = extensionAsk(F, walk)
      cands.push([3, () => { mark(walk, 'contract'); push(F, { kind: 'contract', pid: walk.id, title: 'CONTRACT YEAR', body: `${walk.name}'s agent called. His deal is up after the season and he would sign now: ${ask.years} year${ask.years > 1 ? 's' : ''} at $${ask.perYear.toFixed(1)}M a year.`, data: { ask },
        options: [{ id: 'extend', label: 'SIGN THE EXTENSION', text: `${ask.years} year${ask.years > 1 ? 's' : ''}, $${ask.perYear.toFixed(1)}M a year, starting next season. He is locked up.` }, { id: 'wait', label: 'TALK AFTER THE SEASON', text: 'He plays it out. The price is the market\'s in March.' }, { id: 'business', label: 'TELL HIM IT IS A BUSINESS', text: 'No talks. He will remember it.' }], delegate: walk.ovr >= 86 && walk.age <= 30 ? 'extend' : 'wait' }) }])
    }
    // a veteran who came to win, on a team that is rebuilding, asks out
    const out = directionOf(F) === 'rebuild' ? P.filter(p => p.age >= 28 && p.ovr >= 80 && p.mood < 36 && (p.drives?.includes('RING') || p.drives?.includes('COMPETITOR')) && !p.want && !asked(p, 'out') && !p.built).sort((a, b) => b.ovr - a.ovr)[0] : null
    if (out) cands.push([4, () => { mark(out, 'out'); push(F, { kind: 'wants-out', pid: out.id, title: 'WANTS OUT', body: `${out.name} did not sign up for a rebuild. His agent has asked ${F.gm.name} to find him a contender.`,
      options: [{ id: 'shop', label: 'FIND HIM A HOME', text: `He goes on the block${F.week <= TRADE_DEADLINE ? ' and contenders will call' : '; the deadline has passed, so it waits for the offseason'}. He plays hard until then.` }, { id: 'stay', label: 'ASK HIM TO STAY', text: 'He is told he is part of the plan. A loyal man hears it; most do not.' }], delegate: 'shop' }) }])
    // a veteran offers to work with a young player at his spot
    const vet = P.filter(p => p.age >= 29 && p.drives?.includes('MENTOR') && !asked(p, 'mentor')).sort((a, b) => b.ovr - a.ovr)[0]
    const kid = vet && P.filter(p => p.pos === vet.pos && p.age <= 24 && p.id !== vet.id).sort((a, b) => b.dev - a.dev || b.ovr - a.ovr)[0]
    if (vet && kid) cands.push([2, () => { mark(vet, 'mentor'); push(F, { kind: 'mentor', pid: vet.id, title: 'A VETERAN STEPS UP', body: `${vet.name} wants to stay after practice with ${kid.name} for the rest of the month.`, data: { kid: kid.id },
      options: [{ id: 'yes', label: 'SET IT UP', text: `${kid.name} earns extra XP. ${vet.name} likes being asked.` }, { id: 'no', label: 'KEEP HIM FRESH', text: 'The veteran saves his legs. Nothing else changes.' }], delegate: 'yes' }) }])
    // the press, after a streak
    const r = t.rec ?? { strk: 0 }
    if ((r.strk <= -3 || r.strk >= 4) && !have('press') && F.pressAt !== `${F.year}-${Math.sign(r.strk)}`) {
      const bad = r.strk < 0
      cands.push([2, () => { F.pressAt = `${F.year}-${Math.sign(r.strk)}`; push(F, { kind: 'press', title: 'THE PRESS ROOM', body: bad ? `${-r.strk} straight losses. The beat writers want to know what ${F.gm.name} is going to do about it.` : `${r.strk} straight wins. The beat writers want to know how far this team can go.`, data: { bad },
        options: bad ? [{ id: 'back', label: 'BACK THE LOCKER ROOM', text: 'The players hear it. Morale steadies; ownership hears patience.' }, { id: 'notice', label: 'PUT EVERYONE ON NOTICE', text: 'Jobs are on the line. Competitors respond; the rest of the room does not love it.' }, { id: 'none', label: 'NO COMMENT', text: 'Nothing changes.' }]
          : [{ id: 'credit', label: 'CREDIT THE LOCKER ROOM', text: 'The players hear it. Morale goes up.' }, { id: 'title', label: 'SAY THE WORD: CHAMPIONSHIP', text: 'Ownership loves the ambition, and will remember it if the season falls short.' }, { id: 'none', label: 'ONE WEEK AT A TIME', text: 'Nothing changes.' }], delegate: bad ? 'back' : 'credit' }) }])
    }
  }
  cands.sort((a, b) => b[0] - a[0])
  const room = Math.max(0, 2 - F.office.length)
  for (const [, make] of cands.slice(0, room)) if (R.chance(0.8) || cands[0][0] >= 4) make()
}

// what a choice does. Returns a sentence for flash.
export function settle(F, item, optionId) {
  const opt = item.options.find(o => o.id === optionId) ?? item.options.find(o => o.id === item.delegate) ?? item.options[0]
  const p = item.pid != null ? F.players[item.pid] : null, t = F.teams[F.team]
  const all = d => { for (const x of mine(F)) x.mood = clamp(x.mood + d, 3, 97) }
  let msg = ''
  switch (item.kind) {
    case 'trade-offer': {
      const o = (F.offers ?? []).find(x => x.id === item.data.offerId)
      if (opt.id === 'accept' && o && judgeForUser(F, o).ok !== undefined && judgeForUser(F, o).capOk && judgeForUser(F, o).rosterOk) { execute(F, o); msg = 'The trade is done.' } else msg = opt.id === 'accept' ? 'The deal no longer works: the money or the rosters changed.' : 'Offer declined.'
      F.offers = (F.offers ?? []).filter(x => x.id !== item.data.offerId)
      break
    }
    case 'questionable':
      if (!p?.inj) { msg = 'He is healthy.'; break }
      if (opt.id === 'play') { p.inj = { wk: 0, what: p.inj.what, ir: false, nag: F.week }; msg = `${p.name} will play.` } else { p.inj.q = false; p.mood = clamp(p.mood - 1, 3, 97); msg = `${p.name} sits this week.` }
      break
    case 'role':
      if (!p) break
      if (opt.id === 'promise') { p.promise = F.year * 100 + F.week + 3; p.mood = clamp(p.mood + 14, 3, 97); bumpDepth(F, p); msg = `${p.name} moves up the depth chart.` }
      else if (opt.id === 'shop') { p.block = true; p.mood = clamp(p.mood - 5, 3, 97); msg = `${p.name} is on the trade block.` }
      else { p.mood = clamp(p.mood + (p.drives?.includes('COMPETITOR') ? 4 : -5), 3, 97); msg = `${p.name} was told to earn it.` }
      break
    case 'contract':
      if (!p) break
      if (opt.id === 'extend') {
        const a = item.data.ask
        p.ext = newContract(p, { yrs: a.years, sal: a.perYear, guarShare: a.guaranteed })
        p.mood = clamp(p.mood + 12, 3, 97)
        addTx(F, 'extend', F.team, `${teamName(F.team)} signed ${slotOf(p)} ${p.name} to a ${a.years}-year extension ($${a.perYear.toFixed(1)}M a year).`, p.id)
        addNews(F, 'signing', `${p.name} signs an extension with the ${nick(F.team)}`, { team: F.team, pid: p.id })
        msg = `${p.name} signed his extension.`
      } else if (opt.id === 'business') { p.mood = clamp(p.mood - 14, 3, 97); p.cold = F.year; msg = `${p.name} did not take that well.` }
      else { p.mood = clamp(p.mood - (p.drives?.includes('MONEY') ? 8 : 3), 3, 97); msg = 'Talks are set for after the season.' }
      break
    case 'mentor': {
      const kid = F.players[item.data.kid]
      if (opt.id === 'yes' && p && kid) { giveXp(F, kid, 260, playcall(F, t).dev); p.mood = clamp(p.mood + 7, 3, 97); p.wear = clamp((p.wear ?? 0) + 4, 0, 100); msg = `${p.name} is working with ${kid.name}.` } else msg = 'The veteran saves his legs.'
      break
    }
    case 'wants-out':
      if (!p) break
      if (opt.id === 'shop') { p.block = true; p.want = true; p.mood = clamp(p.mood + 6, 3, 97); msg = `${p.name} is on the block.` }
      else { p.mood = clamp(p.mood + (p.drives?.includes('LOYAL') ? 8 : -5), 3, 97); msg = p.drives?.includes('LOYAL') ? `${p.name} will see it through.` : `${p.name} is not happy about it.` }
      break
    case 'direction':
      if (opt.id !== 'keep') { applyDirection(F, opt.id, { season: opt.id !== directionOf(F) }); F.owner = null; msg = `${STATE_LABEL[opt.id]}. ${directionRead(F, opt.id).text}` } else msg = 'The direction stands.'
      break
    case 'press':
      if (opt.id === 'back') { all(3); F.gm.security = clamp(F.gm.security - 1, 0, 100); msg = 'The locker room heard it.' }
      else if (opt.id === 'notice') { for (const x of mine(F)) x.mood = clamp(x.mood + (x.drives?.includes('COMPETITOR') ? 5 : -4), 3, 97); F.gm.security = clamp(F.gm.security + 1, 0, 100); msg = 'Everyone is on notice.' }
      else if (opt.id === 'credit') { all(3); msg = 'The locker room heard it.' }
      else if (opt.id === 'title') { F.gm.security = clamp(F.gm.security + 3, 0, 100); F.gm.said = F.year; msg = 'Ownership liked the ambition.' }
      else msg = 'Nothing more to say.'
      break
    default: break
  }
  F.office = F.office.filter(o => o.id !== item.id)
  return msg
}
// a promised man goes to the front of his slot (and the chart becomes the user's to keep that way)
function bumpDepth(F, p) {
  const t = F.teams[F.team], slot = slotOf(p)
  if (!t.depth?.[slot]) return
  t.depth[slot] = [p.id, ...t.depth[slot].filter(id => id !== p.id)]
  p.first = F.year * 100 + F.week + 3
}
// the staff settles whatever the user left open when the week is played
export function delegateOffice(F) {
  for (const item of [...F.office]) settle(F, item, item.delegate)
}
// items that no longer mean anything (the player left, the offer is gone)
export function expireOffice(F) {
  F.office = F.office.filter(o => (o.pid == null || F.players[o.pid]?.team === F.team) && (o.kind !== 'trade-offer' || (F.offers ?? []).some(x => x.id === o.data.offerId)) && (o.kind !== 'direction' || o.week >= F.week - 1))
}
export { payroll }
