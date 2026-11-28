// Football Franchise: a pick the player trades for is his when its draft comes (a player's report 11-28: "I traded my
// 96 RT and picks for the #1 pick ... I never received my pick and now my player and assets are gone").
//   FR_TMP=<tmp> bash scripts/franchise2/run.sh scripts/franchise2/pick-trade-check.mjs
// The trade is made at each stage the window is open, for the worst team's first, and the draft is run to his pick.
import * as FR from '../../src/lib/franchise2/index'
import * as T from '../../src/lib/franchise2/trades'
const L = (...a) => console.log(...a)
let bad = 0
const ok = (c, m) => { L(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) bad++ }
const team = process.argv[2] ?? 'DEN'
const F0 = FR.createFranchise({ seed: 'pick-' + team, team, owner: 'G', builds: [], coach: { name: 'Coach', scheme: 'balanced', style: 'developer' } })
const clone = F => structuredClone(F)
const mine = F => F.teams[F.team].r

// the season played out, to the offseason's open window
const S = clone(F0)
while (S.phase === 'season') { FR.playWeek(S, { moments: false }); if (S.ev) FR.chooseEvent(S, 0) }
FR.intoPlayoffs(S)
while (S.phase === 'playoffs') FR.playWeek(S, { moments: false })
L(`after the season: phase ${S.phase} stage ${S.stage} window ${JSON.stringify(T.tradeWindow(S))}`)

// trade for the worst team's first (the #1 pick) with his best man and his own first; then on to the draft and his pick
function tryAt(label, F, toDraft) {
  const W = T.tradeWindow(F)
  if (!W.open) { L(`-- ${label}: window shut (${W.why})`); return }
  const order = FR.draftOrder(F), worst = order[0] === F.team ? order[1] : order[0]
  const y = F.dr && !FR.draftDone(F) ? F.year + 1 : T.tradeYears(F)[0]
  const key = T.pickKey(y, 1, worst)
  const owner0 = T.ownerOf(F, key)
  const ownPk = T.picksBy(F)[F.team].filter(k => T.parsePick(k).r <= 3).slice(0, T.TRADE_MAX - 1)
  const get = { pl: [], pk: [key] }
  const cands = mine(F).filter(p => !T.tradeable(F, F.team, p)).sort((a, b) => b.o - a.o)
  const best = cands.find(p => T.checkTrade(F, worst, { pl: [p.i], pk: ownPk }, get).ok) ?? cands[0]
  const give = { pl: [best.i], pk: ownPk }
  const c = T.checkTrade(F, worst, give, get)
  const r = c.ok ? T.acceptDeal(F, worst, give, get) : { ok: false, text: c.text }
  L(`-- ${label}: ${key} (owner ${owner0}, slot ${T.pickText(F, key, F.team)}) for ${best.n} ${best.o} + ${ownPk.join(', ')}: ${r.ok ? 'DONE' : 'refused: ' + r.text}`)
  if (!r.ok) return
  ok(!mine(F).includes(best), `${label}: ${best.n} is gone`)
  ok(T.ownerOf(F, key) === F.team, `${label}: the pick is his now (ownerOf ${T.ownerOf(F, key)})`)
  ok(T.picksBy(F)[F.team].includes(key), `${label}: it's on his list of picks`)
  toDraft(F)
  const at = F.dr.order.indexOf(worst)
  ok(F.dr.own[at] === F.team, `${label}: on draft day slot No. ${at + 1} belongs to ${F.dr.own[at]}`)
  ok(FR.myPicks(F).includes(at), `${label}: it's in his picks on the board`)
}
const offToDraft = F => {
  if (F.stage !== 'draft' || !F.dr) {
    if (!F.aging) { try { FR.closeSeason(F) } catch {} try { FR.ageLeague(F) } catch {} }
    try { FR.openResign(F); for (const id of [...(F.rs ?? [])]) FR.resignOne(F, id, true) } catch {}
    try { FR.openFA(F); for (let k = 0; k < 9 && !FR.nextFADay(F).done; k++); } catch {}
    FR.openDraft(F)
  }
}
// 1. the stages in order
{
  const F = clone(S); FR.closeSeason(F); FR.ageLeague(F)
  L(`stage after closeSeason: ${F.phase}/${F.stage}`)
  tryAt('after the awards', F, offToDraft)
}
{
  const F = clone(S); FR.closeSeason(F); FR.ageLeague(F); FR.openResign(F)
  tryAt('re-signing', F, offToDraft)
}
{
  const F = clone(S); FR.closeSeason(F); FR.ageLeague(F); FR.openResign(F); for (const id of [...F.rs]) FR.resignOne(F, id, true); FR.openFA(F)
  tryAt('free agency', F, offToDraft)
}
{
  const F = clone(S); FR.closeSeason(F); FR.ageLeague(F); FR.openResign(F); for (const id of [...F.rs]) FR.resignOne(F, id, true); FR.openFA(F); for (let k = 0; k < 9 && !FR.nextFADay(F).done; k++);
  FR.openDraft(F)
  tryAt('draft week (order set)', F, () => {})
  // (and the night: he's on the clock at No. 1)
  FR.startNight(F)
  if (F.dr.own[0] === F.team) ok(FR.pickTeam(F) === F.team, `the night opens with ${FR.pickTeam(F)} on the clock at No. ${F.dr.at + 1}`)
}
// 2. in the season, for next year's first of the worst team
{
  const F = clone(F0)
  for (let w = 0; w < 4; w++) { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
  tryAt('the season (week 4)', F, G => {
    while (G.phase === 'season') { FR.playWeek(G, { moments: false }); if (G.ev) FR.chooseEvent(G, 0) }
    FR.intoPlayoffs(G); while (G.phase === 'playoffs') FR.playWeek(G, { moments: false })
    offToDraft(G)
  })
}
// 3. the counters to a deal for the No. 1 pick: what comes back is the pick he asked for, never another
{
  const F = clone(S); FR.closeSeason(F); FR.ageLeague(F); FR.openResign(F); for (const id of [...F.rs]) FR.resignOne(F, id, true); FR.openFA(F); for (let k = 0; k < 9 && !FR.nextFADay(F).done; k++);
  FR.openDraft(F)
  const w = F.dr.order[0] === F.team ? F.dr.order[1] : F.dr.order[0], key = T.pickKey(F.year + 1, 1, w)
  const men = mine(F).filter(p => !T.tradeable(F, F.team, p)).sort((a, b) => b.o - a.o)
  const pks = T.picksBy(F)[F.team]
  let seen = 0
  for (const p of men.slice(0, 12)) for (const n of [0, 1, 2]) {
    const give = { pl: [p.i], pk: pks.filter(k => T.parsePick(k).r >= 2).slice(0, n) }, get = { pl: [], pk: [key] }
    if (!T.checkTrade(F, w, give, get).ok) continue
    const G = clone(F), r = T.proposeTrade(G, w, give, get)
    if (r.say !== 'counter') continue
    seen++
    const back = r.counter.get.pk
    L(`   counter for ${p.n} ${p.o} + ${n}: they send ${back.join(', ') || 'nothing'} ${r.counter.get.pl.length ? '+ men' : ''} for ${r.counter.give.pl.length} men + ${r.counter.give.pk.join(', ')}`)
    ok(back.includes(key), `a counter keeps the No. 1 pick he asked for (got ${back.join(', ')})`)
  }
  L(`   ${seen} counters seen`)
}
L(bad ? `\n${bad} FAIL` : '\nall ok')
process.exit(bad ? 1 : 0)
