// The salary cap, headless (lib/franchise2/contracts.js capSheet and every place that moves it): two seasons and two
// offseasons, the books checked at every stop.
//   bash scripts/franchise2/run.sh scripts/franchise2/cap-check.mjs [team=NYJ] [nocap=0] [seasons=2]
// Every team: the room is the cap less the contracts, the dead money and the rest of the 53, and the contracts add up
// to the men's cap hits. The league's teams under the cap at every stop of the year. A release takes his cap hit off
// and puts his dead money on, and the room moves by what the release screen said it saves. Dead money lasts the
// league year it's charged to (a release in the offseason is next year's). The next season's cap is this one's
// plus five percent. With NO SALARY CAP: the player's team signs past the cap, its trades never fail on money, the
// league's teams still keep their books.
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'

FR.useContracts(CONTRACTS)
const team = process.argv[2] ?? 'NYJ', NOCAP = process.argv[3] === '1', N = Number(process.argv[4] ?? 2)
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen')
const F = FR.createFranchise({ seed: 'cap-' + team, team, owner: 'G', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 12 }], coach: { name: 'Test Coach', style: 'players', r: { talentDev: 6, offPlaycalling: 6, defPlaycalling: 6, culture: 6, situational: 6 }, ovr: 76 } })
if (NOCAP) FR.setRules(F, { cap: false })
const r1 = x => Math.round(x * 10) / 10
const me = () => F.teams[F.team]
const seenOver = new Set()

function books(tag) {
  for (const s of FR.SHORTS) {
    const c = FR.capSheet(F, s), t = F.teams[s]
    const sum = r1(t.r.filter(p => p.y > 0).reduce((a, p) => a + (p.$ ?? 0), 0))
    if (Math.abs(sum - c.pay) > 0.15) bad(`${tag} ${s}: contracts add to ${sum}, the sheet says ${c.pay}`)
    const deadSum = r1((t.dead ?? []).reduce((a, d) => a + d[1], 0))
    if (Math.abs(deadSum - c.dead) > 0.15) bad(`${tag} ${s}: dead lines add to ${deadSum}, the sheet says ${c.dead}`)
    if (Math.abs(c.used - (c.pay + c.dead + c.rest)) > 0.15) bad(`${tag} ${s}: used ${c.used} != ${c.pay} + ${c.dead} + ${c.rest}`)
    if (!c.nocap && Math.abs(c.room - (c.cap - c.used)) > 0.15) bad(`${tag} ${s}: room ${c.room} != ${c.cap} - ${c.used}`)
    if (Math.abs(c.cap - (c.nocap ? FR.capOf(c.year) : r1(FR.capOf(c.year) + FR.carryOf(t, c.year)))) > 0.05) bad(`${tag} ${s}: cap ${c.cap} for ${c.year}`)
    if (s !== F.team && c.room < -0.05) { if (!seenOver.has(s + c.year)) { seenOver.add(s + c.year); console.log('     news: ' + (F.news ?? []).filter(x => x.s === s || String(x.text).includes(FR.TEAM[s].nick)).slice(-3).map(x => x.text).join(' | ')) } bad(`${tag} ${s} over the cap: ${c.room}`) }
    if (s === F.team && NOCAP && !c.nocap) bad(`${tag}: no-cap rule on but the sheet reads the cap`)
    if (s !== F.team && c.nocap) bad(`${tag} ${s}: a league team off the cap`)
    if (t.r.some(p => p.y > 0 && !(p.$ > 0))) bad(`${tag} ${s}: a man under contract at ${t.r.find(p => p.y > 0 && !(p.$ > 0)).$}`)
  }
}
function line(tag) {
  const c = FR.capSheet(F)
  console.log(`${tag.padEnd(22)} ${c.year} cap ${c.cap} · men ${c.pay} (${me().r.filter(p => p.y > 0).length}) · dead ${c.dead} · rest ${c.rest} · used ${c.used} · room ${c.nocap ? 'OFF' : c.room} · league worst ${Math.min(...FR.SHORTS.filter(s => s !== F.team).map(s => FR.capRoom(F, s)))}`)
}
// a release: what the screen says (cutCost) against what the books do
function release(tag, pick) {
  const p = pick(me().r.filter(x => x.b == null && !x.fl && x.y > 0))
  if (!p) return null
  const c0 = FR.capSheet(F), k = FR.cutCost(p), say = FR.cutRoom(F, p)
  const y = FR.capYear(F)
  FR.cutMan(F, p.i)
  const c1 = FR.capSheet(F)
  const moved = r1((c1.nocap ? c1.cap - c1.used : c1.room) - (c0.nocap ? c0.cap - c0.used : c0.room))
  console.log(`   ${tag}: released ${p.n} ($${p.$}, ${p.y} yrs, bonus ${p.g ?? 0}/yr): dead +${r1(c1.dead - c0.dead)} (screen ${k.dead}), room ${moved >= 0 ? '+' : ''}${moved} (screen says saves ${say})`)
  if (Math.abs(r1(c1.dead - c0.dead) - k.dead) > 0.15) bad(`${tag}: dead money moved ${r1(c1.dead - c0.dead)}, the screen said ${k.dead}`)
  if (Math.abs(moved - say) > 0.15) bad(`${tag}: the room moved ${moved}, the release screen said it saves ${say}`)
  return { p, dead: k.dead, y }
}

let pending = []
for (let yr = 0; yr < N; yr++) {
  books(`${F.year} wk 0`); line(`${F.year} week 1`)
  while (F.phase === 'season') {
    FR.playWeek(F, { moments: false })
    if (F.ev) FR.chooseEvent(F, 0)
    books(`${F.year} wk ${F.wk}`)
    if (F.wk === 4) {
      const r = release(`${F.year} wk 4`, men => men.filter(p => (p.g ?? 0) > 0.5 && p.y >= 2).sort((a, b) => a.o - b.o)[0])
      if (r) pending.push(r)
      release(`${F.year} wk 4 (no bonus)`, men => men.filter(p => !(p.g > 0)).sort((a, b) => a.o - b.o)[0])
    }
  }
  line(`${F.year} after week 18`)
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') { if (FR.userAlive(F)) FR.playWeek(F, { moments: false }); else FR.simPlayoffs(F) }
  const end = FR.capSheet(F)
  FR.closeSeason(F)
  books(`${F.year} coaches`); line(`${F.year} coaches stage`)
  // the coaching changes and the awards: still the season just played on the books (its cap, its dead money)
  { const c = FR.capSheet(F); if (c.year !== F.year || Math.abs(c.used - end.used) > 0.05) bad(`${F.year} coaches stage: the books read ${c.year}, used ${c.used} (the season ended at ${end.used})`) }
  FR.closeCarousel(F)
  const y0 = F.year
  const rooms = Object.fromEntries(FR.SHORTS.map(s => [s, FR.capSheet(F, s)]))
  FR.ageLeague(F)
  const carry = Object.fromEntries(FR.SHORTS.map(s => [s, FR.carryOf(F.teams[s], y0 + 1)]))
  FR.openResign(F)
  // the in-season dead money is gone with its league year
  const dl = me().dead ?? []
  for (const r of pending) if (dl.some(d => d[0] === r.p.n)) bad(`${y0}: ${r.p.n}'s ${r.y} dead money still on the ${y0 + 1} books`)
  pending = []
  // the rollover: what each team left unused is on next year's cap
  for (const s of FR.SHORTS) {
    const was = rooms[s], c = FR.capSheet(F, s), want = was.nocap ? 0 : r1(Math.min(FR.capOf(y0 + 1) * FR.CARRY_MAX, Math.max(0, was.room)))
    if (c.nocap) continue
    if (Math.abs(carry[s] - want) > 0.05 || Math.abs(c.cap - r1(FR.capOf(y0 + 1) + want)) > 0.05) bad(`${y0} ${s}: ended with ${was.room} room, the ${y0 + 1} cap is ${c.cap} (carry ${carry[s]})`)
  }
  { const c = FR.capSheet(F); console.log(`   ${y0 + 1} cap for the ${team}: ${c.nocap ? 'OFF' : `${FR.capOf(y0 + 1)} + ${c.carry} carried over = ${c.cap}`}; league carry: median ${[...FR.SHORTS.map(s => FR.capSheet(F, s).carry)].sort((a, b) => a - b)[16]}, top ${Math.max(...FR.SHORTS.map(s => FR.capSheet(F, s).carry))}`) }
  books(`${y0} re-sign`); line(`${y0} re-sign`)
  for (const id of [...F.rs]) { const p = me().r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? (p.o >= 80 ? 'option' : 'decline') : p.b != null || p.o >= 74) }
  books(`${y0} re-signed`); line(`${y0} re-signed`)
  FR.openFA(F)
  books(`${y0} FA open`)
  // the GM spends: the best men he can fit (with no cap, the best men there are)
  let signed = 0
  while (F.fad) {
    for (const p of FR.faBoard(F, 12)) { if (signed >= (NOCAP ? 8 : 4)) break; if (FR.canSign(F, p.$) && p.o >= 76 && FR.placeBid(F, p.i, r1(p.$ * 1.15))) signed++ }
    FR.nextFADay(F)
  }
  books(`${y0} FA done`); line(`${y0} FA done (${signed} signed)`)
  if (NOCAP && signed < 3) bad(`${y0}: no cap, and the GM signed ${signed} free agents`)
  FR.openDraft(F)
  FR.startNight(F)
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft(F)
  books(`${y0} draft done`); line(`${y0} draft done`)
  FR.autoCamp(F)
  // the cut-down screen: over the cap past what restructures clear, the GM releases men until he's under
  for (let g = 0; g < 12 && FR.capOver(F) > 0; g++) {
    const x = FR.capCuts(F).at(-1)
    console.log(`   cut-down: ${FR.capOver(F)} over, releases ${x.p.n} (saves ${x.saves})`)
    FR.capCut(F, x.p.i)
  }
  if (!NOCAP && FR.capRoom(F) + FR.restructurable(F) < 0 && FR.capCuts(F).length) bad(`${y0}: the cut-down still over the cap`)
  const up = me().r.filter(p => p.y <= 0 && !p.fl)
  if (up.length) console.log(`   camp: ${up.length} of his men with no deal going into the new season: ${up.map(p => p.n).join(', ')}`)
  const pay0 = FR.capSheet(F).pay
  FR.newSeason(F)
  const c = FR.capSheet(F)
  if (up.length) console.log(`   new season: their deals put ${r1(c.pay - pay0)} on his books without a word`)
  books(`${F.year} new season`)
  if (!NOCAP && c.room < 0) bad(`${F.year}: the ${team} start the season $${-c.room}M over the cap`)
}
line(`${F.year} week 1`)
// the no-cap rule all through: a trade that would bury the cap still goes; turning the cap back on
if (NOCAP) {
  const s = FR.SHORTS.find(x => x !== F.team && FR.capRoom(F, x) > 30)
  const big = F.teams[s].r.filter(p => !FR.tradeable(F, s, p)).sort((a, b) => b.$ - a.$)[0]
  const chk = FR.checkTrade(F, s, { pl: [], pk: [] }, { pl: [big.i], pk: [] })
  if (!chk.ok && chk.why === 'ucap') bad(`no cap: a trade turned down on the ${team}'s cap`)
  console.log(`no cap: trade check for ${big.n} ($${big.$}) -> ${chk.ok ? 'ok' : chk.why}; the screen's cap line: ${JSON.stringify(chk.cap)}`)
  if (chk.cap && !chk.cap.nocap) bad('no cap: the trade screen gets cap numbers (CAP ROOM NOW / AFTER THE TRADE) for a team with no cap')
}
console.log(problems.length ? `\n${problems.length} PROBLEMS` : '\nOK')
process.exit(problems.length ? 1 : 0)
