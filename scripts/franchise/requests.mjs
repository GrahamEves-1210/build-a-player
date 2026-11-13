// FRANCHISE engine: the UI agents' requests, checked (F:\bap-agents\franchise\REQUESTS.md).
//   bash scripts/franchise/run.sh scripts/franchise/requests.mjs
// Plays one league by hand through a season and an offseason and asserts what the screens were promised.
import * as FR from '../../src/lib/franchise/index'
import { marketValue } from '../../src/lib/franchise/money'

const bad = []
const check = (ok, msg) => { if (!ok) bad.push(msg) }
const say = (...a) => console.log(...a)

let F = FR.createFranchise({ team: 'KC', builds: [], gmName: 'Req GM', seed: 'dev' })

// ── numbers: nobody shares one on a team, and each is legal for the position
const dupes = f => { let n = 0; for (const t of FR.teams(f)) { const seen = new Set(); for (const p of FR.roster(f, t.short)) { if (p.num == null) continue; if (seen.has(p.num)) n++; seen.add(p.num) } } return n }
check(dupes(F) === 0, `a new league has ${dupes(F)} shared jersey numbers`)

// ── money words
check(FR.moneyText(0) === '$0', `moneyText(0) is ${FR.moneyText(0)}`)
check(FR.moneyText(0.9) === '$900K' && FR.moneyText(12.34) === '$12.3M', 'moneyText changed for real amounts')

// ── a free agent's card asks what signFreeAgent takes
{
  const fa = FR.freeAgents(F, { n: 5 })
  for (const r of fa) { const c = FR.playerCard(F, r.id); check(c.contract.ask.perYear === r.ask.perYear && c.contract.ask.years === r.ask.years, `${r.name}: card asks ${JSON.stringify(c.contract.ask)}, the list ${JSON.stringify(r.ask)}`) }
  const mineRows = FR.roster(F)
  check(mineRows.every(r => r.xpNext === 600), 'xpNext is missing on a player row')
  check(mineRows.every(r => 'brk' in r && 'tierUp' in r), 'brk / tierUp missing on a player row')
  const last = mineRows.filter(r => r.yrs <= 1).slice(0, 4)
  for (const r of last) {
    const c = FR.playerCard(F, r.id)
    check(c.contract.extAsk && c.contract.extAsk.perYear > 0, `${r.name}: no extAsk in the last year of his deal`)
    if (c.contract.extAsk) { const f2 = FR.extendPlayer(JSON.parse(JSON.stringify(F)), r.id, c.contract.extAsk); check(f2.flash?.ok || f2.flash?.code === 'cap', `${r.name}: extendPlayer refused its own extAsk: ${f2.flash?.msg}`) }
  }
  const kelce = Object.values(F.players).find(p => p.name === 'Travis Kelce')
  if (kelce) say(`Kelce: ${kelce.ovr} OVR, age ${kelce.age}, asks ${FR.moneyText(FR.playerCard(F, kelce.id).contract.ask?.perYear ?? marketValue(kelce, F.cap))} (market ${FR.moneyText(marketValue(kelce, F.cap))})`)
}
check(FR.staff(F).budget.total === 32, `staff budget total is ${FR.staff(F).budget.total}`)

// ── text: nothing starts lower-case or on a numeral; no year that has not been played
const sentenceOk = s => !s || /^[A-Z"'(]/.test(s)
const future = (f, s) => { const m = String(s ?? '').match(/\b(20\d\d)\b/g) ?? []; return m.some(y => +y > f.year) }
function texts(f) {
  const out = []
  for (const t of FR.weekTasks(f)) out.push(['task', t.detail])
  for (const o of FR.officeItems(f)) { out.push(['office', o.body]); for (const op of o.options ?? []) out.push(['office option', op.text]) }
  for (const a of FR.hub(f).advice ?? []) out.push(['advice', a])
  for (const n of FR.news(f, 60)) { out.push(['news', n.head]); if (n.body) out.push(['news body', n.body]) }
  for (const x of FR.transactions(f, 80)) out.push(['tx', x.text])
  return out
}
function checkTexts(f, where) {
  for (const [kind, s] of texts(f)) {
    if (future(f, s)) check(false, `${where}: ${kind} names a later year: "${s}"`)
    if ((kind === 'advice' || kind === 'office') && !sentenceOk(s)) check(false, `${where}: ${kind} starts badly: "${s}"`)
    if (/\b1 sacks\b|\b1 starts\b/.test(s)) check(false, `${where}: "${s}"`)
  }
  for (const r of FR.roster(f)) if (/\b1 sacks\b|\b1 starts\b/.test(r.line)) check(false, `${where}: stat line "${r.line}"`)
}

// ── a season on the autopilot, the texts read every week
let guard = 0
while (F.phase !== 'offseason' && guard++ < 40) { F = FR.autopilot(F, { until: 'week' }); checkTexts(F, `${F.year} wk${F.week}`); for (const o of FR.officeItems(F)) check(!o.who || (o.who.team && o.who.roleName), 'officeItems().who has no team / roleName') }

// trade verdict: a roster refusal names the side
{
  // (in season this would be a 2-for-0; here just read the words on a deal that breaks a minimum)
}

// ── THE OFFSEASON, by hand
check(F.phase === 'offseason', 'the season did not end')
const stage = () => FR.offseason(F).stage.id
say('review:', FR.seasonReview(F).user.record, FR.seasonReview(F).user.finish, '| state', FR.teamState(F).label, 'rank', FR.teamState(F).ratings.rank)
// the GM declares a direction the roster does not say
const read = FR.teamState(F).state, mineDir = read === 'rebuild' ? 'contend' : 'rebuild'
F = FR.setDirection(F, mineDir)
check(FR.teamState(F).direction === mineDir, 'setDirection did not take')
say('goals after declaring', mineDir, ':', FR.ownerView(F).goals.map(g => g.text).join(' | '))
F = FR.advanceStage(F)            // review -> staff
F = FR.advanceStage(F)            // staff -> resign (the staff fills what is open)
check(stage() === 'resign', `expected resign, at ${stage()}`)
for (const r of FR.expiring(F)) { const c = FR.playerCard(F, r.id); if (future(F, c.draft)) check(false, `card draft line names a later year: ${c.draft}`) }
F = FR.advanceStage(F)            // -> fa
check(stage() === 'fa', `expected fa, at ${stage()}`)

// free agency: an offer that is not answered stands
{
  const v = FR.freeAgency(F)
  const top = v.players.slice(0, 12)
  say('FA top asks:', top.slice(0, 8).map(p => `${p.name} ${p.slot} ${p.ovr} age ${p.age}: ${p.ask.years}y ${FR.moneyText(p.ask.perYear)}`).join(' | '))
  say('FA deal lengths, top 30 by OVR:', v.players.slice(0, 30).map(p => p.ask.years).join(''))
  // a low offer to a man with suitors (he will not take it) and a fair one to a cheap man
  const cheap = v.players.filter(p => p.ask.perYear < 3).slice(0, 3)
  const low = v.players.find(p => p.ask.perYear > 4 && p.ask.perYear < 12)
  if (low) F = FR.bidFreeAgent(F, low.id, { years: low.ask.years, perYear: Math.round(low.ask.perYear * 0.8 * 100) / 100, guaranteed: low.ask.guaranteed })
  for (const p of cheap) F = FR.bidFreeAgent(F, p.id)
  const bidsBefore = FR.freeAgency(F).players.filter(p => p.bid).map(p => p.id)
  F = FR.advanceFA(F)
  const v2 = FR.freeAgency(F)
  const still = v2.players.filter(p => p.bid).map(p => p.id), signedMine = v2.signed.filter(s => s.mine).map(s => s.player.id)
  check(v2.lastRound === 1, `lastRound is ${v2.lastRound}`)
  check(bidsBefore.every(id => still.includes(id) || signedMine.includes(id) || v2.signed.some(s => s.player.id === id)), 'an unanswered offer was dropped after the round')
  say(`round 1: ${v2.signed.filter(s => s.round === 1).length} signings; my bids ${bidsBefore.length}, still standing ${still.length}, signed with me ${signedMine.length}`)
  check(v2.signed.length > 0 && v2.signed.every(s => s.why && s.ask && s.round), 'a signing has no why / ask / round')
  check(v2.signed.every(s => sentenceOk(s.why[0].toUpperCase() + s.why.slice(1))), 'why is empty')
  for (const s of v2.signed.slice(0, 8)) say(`   ${s.player.slot} ${s.player.name} (${s.player.ovr}) to ${s.team.short}, ${s.deal.years}y ${FR.moneyText(s.deal.perYear)} (asked ${FR.moneyText(s.ask.perYear)}): ${s.why}`)
  const years = v2.signed.filter(s => s.player.ovr >= 80).map(s => s.deal.years)
  say('   deal lengths of the 80+ signings:', years.join(''))
}
// the staff runs the rest of free agency ONCE
const autoBefore = !!F.off.auto
F = FR.advanceStage(F, { auto: true, once: true })
check(stage() === 'draft', `expected draft, at ${stage()}`)
check(!!F.off.auto === autoBefore && !F.off.auto, 'once: the staff stayed on after one delegated stage')

// ── the draft
{
  let v = FR.draftView(F)
  check(v.started, 'the draft did not start')
  const info = FR.teamInfo(F, F.team)
  const now = info.picks.filter(p => p.year === v.year)
  check(now.every(p => p.overall >= 1), 'a pick in the draft that is on has no overall number')
  check(now.every(p => /No\. \d+ overall/.test(p.text)), `pick text does not carry the number: ${now[0]?.text}`)
  const later = info.picks.filter(p => p.year === v.year + 2)
  check(later.every(p => p.when === 'the draft after next'), `a pick two drafts on reads "${later[0]?.when}"`)
  check(info.picks.every(p => !future(F, p.text)), 'a pick names a later year')
  // trade my first pick for a later team's first and more: the order follows at once
  const mine1 = now[0]
  if (mine1) {
    const other = FR.teams(F).map(t => t.short).filter(s => s !== F.team).map(s => ({ s, picks: FR.teamInfo(F, s).picks.filter(p => p.year === v.year) })).find(x => x.picks.some(p => p.round === mine1.round + 1))
    if (other) {
      const theirs = other.picks.find(p => p.round === mine1.round + 1), extra = []
      let done = false
      for (let n = 0; n <= extra.length && !done; n++) {
        const offer = { to: other.s, give: { players: [], picks: [mine1.key] }, get: { players: [], picks: [theirs.key, ...extra.slice(0, n).map(p => p.key)] } }
        if (FR.tradeVerdict(F, offer).ok) { F = FR.proposeTrade(F, offer); done = !!F.flash?.accepted }
      }
      if (done) {
        v = FR.draftView(F)
        check(v.order[mine1.overall - 1].team.short === other.s && !v.order[mine1.overall - 1].mine, 'draftView().order is stale after a pick trade')
        check(v.order[theirs.overall - 1].mine, 'the pick that came back is not marked mine')
        check(v.myPicks.some(p => p.overall === theirs.overall) && !v.myPicks.some(p => p.overall === mine1.overall), 'myPicks is stale after a pick trade')
        say(`draft-day trade: No. ${mine1.overall} to ${other.s} for No. ${theirs.overall} and more; order and myPicks follow`)
      } else say('draft-day trade: no deal the other club would take (not checked)')
    }
  }
  // sim to my pick, read the offers, pick, to the end
  let qbSlide = null, g2 = 0
  while (!FR.draftView(F).done && g2++ < 20) {
    F = FR.simToMyPick(F)
    v = FR.draftView(F)
    for (const o of v.offers) { check(typeof o.text === 'string' && o.text.length > 10, 'a draft offer has no text'); check(o.picks.give.every(p => p.overall >= 1 || p.year !== v.year), 'a draft offer pick has no overall') }
    if (qbSlide == null && v.overall >= 28) qbSlide = v.board.prospects.filter(p => p.slot === 'QB' && p.rank <= 21).length
    if (v.done || !v.mine) break
    F = FR.draftPick(F, v.staffPick ?? v.board.prospects[0].id)
  }
  if (!FR.draftView(F).done) F = FR.autoDraft(F)
  v = FR.draftView(F)
  say(`QBs the board had in its top 21 still there near pick 28: ${qbSlide}`)
  say('round 1:', v.order.slice(0, 32).map(x => `${x.overall}.${x.team.short} ${x.done?.pos}`).join(' '))
  check(v.class.length > 0 && v.class.every(c => c.grade && c.rank >= 1 && c.pick >= 1 && c.overall >= 1), 'class rows lack grade / rank / pick')
  check(v.classGrade && v.classGrade.grade, 'no class grade')
  say('my class:', v.class.map(c => `R${c.round} P${c.pick} (No. ${c.overall}) ${c.pos} ${c.name}: board ${c.rank}, ${c.grade}`).join(' | '), '=> class', v.classGrade?.grade, v.classGrade?.text)
  for (const c of v.class) { const card = FR.playerCard(F, c.pid); check(!future(F, card.draft), `a drafted man's card names a later year: ${card.draft}`) }
  if (v.class[0]) say('card draft line:', FR.playerCard(F, v.class[0].pid).draft)
}
check(dupes(F) === 0, `${dupes(F)} shared jersey numbers after the draft`)
checkTexts(F, 'after the draft')
F = FR.advanceStage(F)                                  // -> udfa
F = FR.advanceStage(F, { auto: true, once: true })      // the staff signs undrafted men, once
check(stage() === 'camp' && !F.off.auto, 'once (undrafted): the staff stayed on')
{
  const cv = FR.campView(F)
  say('holdouts:', cv.holdouts.length, cv.holdouts[0] ? cv.holdouts[0].options.map(o => o.id).join('/') : '')
  for (const h of cv.holdouts) check(h.options.some(o => o.id === 'talk'), 'a holdout has no TALK option')
  // TALK, on a man made to hold out for the test (a copy of the league: the real one plays on untouched)
  const T = JSON.parse(JSON.stringify(F)), star = FR.roster(T).filter(p => !p.rookie).sort((a, b) => b.ovr - a.ovr)[0]
  T.players[star.id].hold = 1; T.off.camp.holdouts.push(star.id)
  const h = FR.campView(T).holdouts.find(x => x.id === star.id)
  check(h && h.options.some(o => o.id === 'talk'), 'the holdout view has no TALK option')
  const t2 = FR.resolveHoldout(T, star.id, 'talk')
  say('TALK:', t2.flash?.msg, '| options after:', FR.campView(t2).holdouts.find(x => x.id === star.id)?.options.map(o => o.id).join('/') ?? 'he reported')
  check(t2.flash?.ok && (t2.flash.talked ? !t2.players[star.id].hold : !FR.campView(t2).holdouts.find(x => x.id === star.id).options.some(o => o.id === 'talk')), 'TALK did not settle or close')
}
F = FR.advanceStage(F)   // -> cuts
F = FR.advanceStage(F)   // -> the new season
check(F.phase === 'regular' && F.week === 1, 'the offseason did not end in Week 1')
check(FR.teamState(F).direction === mineDir, `the GM's declared direction (${mineDir}) was overwritten: ${FR.teamState(F).direction}`)
check(dupes(F) === 0, `${dupes(F)} shared jersey numbers in the new season`)
{
  const ns = FR.newSeason(F)
  say(`newSeason.changes: ${ns.changes.length} (grew ${ns.changes.filter(c => c.d > 0).length}, slipped ${ns.changes.filter(c => c.d <= 0).length})`, ns.changes.filter(c => c.d > 0).slice(0, 2).map(c => `${c.player.name}: ${c.text}`).join(' | '))
  check(ns.changes.some(c => c.d > 0), 'newSeason().changes has nobody who grew with autoUpgrade off')
  const h = FR.history(F).seasons[0].user
  check(h.security != null && h.delta != null && h.verdict && h.direction && Array.isArray(h.goals) && h.goals.length > 0, `history().seasons[].user lacks the owner's read: ${JSON.stringify(h)}`)
  say('history user row:', JSON.stringify(h))
  const card = FR.playerCard(F, ns.rookies[0]?.id)
  if (card) say('rookie card draft line in the new season:', card.draft)
}
checkTexts(F, 'new season')

// ── an old save still opens: a save without the new fields
{
  const old = JSON.parse(JSON.stringify(F))
  delete old.numsOk; delete old.gm.dirBy; for (const s of old.hist.seasons) { const u = s.user; for (const k of ['security', 'delta', 'verdict', 'direction', 'goals', 'fired']) delete u[k] }
  const back = FR.unpackFranchise(FR.packFranchise(old))
  check(back && !back.broken, 'a save without the new fields did not open')
  const h = FR.history(back).seasons[0].user
  check(h.security === null && Array.isArray(h.goals), 'history() of an old save has no defaults')
  let f2 = back
  for (let k = 0; k < 3; k++) f2 = FR.autopilot(f2, { until: 'week' })
  check(f2.week === 4, 'an old save did not play on')
}
// ── the trade verdict's words
{
  const others = FR.teams(F).map(t => t.short).filter(s => s !== F.team)
  const qbs = FR.roster(F).filter(p => p.slot === 'QB')
  const v = FR.tradeVerdict(F, { to: others[0], give: { players: qbs.map(p => p.id), picks: [] }, get: { players: [], picks: [] } })
  say('trade verdict (all my QBs out):', v.answer)
  check(!v.rosterOk && /would (be down to|have)/.test(v.answer), 'the roster refusal does not name the side and reason')
}
say(`\nPROBLEMS: ${bad.length}`)
for (const b of bad.slice(0, 40)) say('  ' + b)
process.exitCode = bad.length ? 1 : 0
