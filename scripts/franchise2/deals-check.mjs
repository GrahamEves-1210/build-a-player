// Re-sign talks, free agency's offers, filler depth and potential, headless (deals.js, market.js, potential.js).
//   bash scripts/franchise2/run.sh scripts/franchise2/deals-check.mjs
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'

FR.useContracts(CONTRACTS)
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const ok = (c, m) => { if (!c) bad(m) }
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen')
const F = FR.createFranchise({ seed: 'deals', team: 'NYJ', owner: 'G', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 12 }], coach: { name: 'Test Coach', style: 'players', r: { talentDev: 6, offPlaycalling: 6, defPlaycalling: 6, culture: 6, situational: 6 }, ovr: 76 } })
const mine = () => F.teams[F.team].r

// filler depth (league.js fl: 1): the league's own fillers, and a few more men on every team marked as fillers with deals ending
const fillers = new Set(FR.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.fl).map(p => p.i)))
console.log(`fillers in the league: ${fillers.size}`)
for (const s of FR.SHORTS) for (const p of F.teams[s].r.filter(x => x.b == null).sort((a, b) => a.o - b.o).slice(0, 2)) { p.fl = 1; p.y = 1; fillers.add(p.i) }
// the build's deal ends this year (to test his talks)
const B = mine().find(p => p.b != null); B.y = 1; delete B.rc; delete B.op

FR.simWeeks(F); FR.intoPlayoffs(F); FR.simPlayoffs(F); FR.closeSeason(F); FR.closeCarousel(F)
FR.ageLeague(F)
// potential: every active man has one; a man's page never shows it as a number
for (const s of FR.SHORTS) for (const p of F.teams[s].r) { ok(p.pk != null && p.pk >= p.o, `${p.n} pk ${p.pk} o ${p.o}`); const r = FR.scoutRead(p, s === F.team); ok(!/\d/.test(r.line + r.stage), `a number in a scout read: ${r.line}`) }
FR.openResign(F)
ok(!F.rs.some(id => fillers.has(id)), 'a filler on the re-sign list')
ok(!F.fa.some(p => p.fl || fillers.has(p.i)), 'a filler on the market after re-signing')
ok(FR.SHORTS.every(s => F.teams[s].r.filter(p => fillers.has(p.i)).every(p => p.y >= 1)), 'a filler whose year was up is still on a roster (fillers go quietly: market.js openResign)')
ok(F.rs.includes(B.i), 'the build is not up for a new deal')
console.log(`re-sign: ${F.rs.length} up for the ${F.team}: ${F.rs.map(id => { const p = mine().find(x => x.i === id); return `${p.n} ${p.o}` }).join(', ')}`)

// talks: an offer at his number signs; lowballs run out his patience and he tests the market; a build gives his final number
const ids = F.rs.filter(id => !FR.optionDue(mine().find(x => x.i === id)) && id !== B.i)
{
  const id = ids[0], t = FR.openTalks(F, id), p = mine().find(x => x.i === id)
  const r = FR.offerTalks(F, id, { $: t.c.$, y: t.c.y, b: 0 })
  ok(r.say === 'yes' && p.y === t.c.y && Math.abs(p.$ - t.c.$) < 0.11, `an offer at his number: ${r.say}`)
  console.log(`  ${p.n}: asked ${t.c.$} x ${t.c.y}, signed ${p.$} x ${p.y}, bonus ${p.g} a year`)
}
{
  const id = ids[1], t = FR.openTalks(F, id), p = mine().find(x => x.i === id)
  const says = []
  for (let k = 0; k < 6 && t.st === 0; k++) says.push(FR.offerTalks(F, id, { $: FR.minimumFor(p.ag, F.year + 1), y: 1, b: 0 }).say)
  ok(t.st === 2 && F.fa.includes(p) && !mine().includes(p), `lowballs: ${says.join(' ')} → st ${t.st}`)
  console.log(`  ${p.n} lowballed: ${says.join(', ')} · on the market: ${F.fa.includes(p)}`)
}
{
  const id = ids[2], t = FR.openTalks(F, id), p = mine().find(x => x.i === id)
  const steps = []
  let o = t.c.$ * 0.9
  for (let k = 0; k < 8 && t.st === 0; k++) { const r = FR.offerTalks(F, id, { $: o, y: t.c.y, b: 0 }); steps.push(`${o.toFixed(1)}→${r.say}${t.st === 0 ? ` ${t.c.$}` : ''}`); o = (o + t.c.$) / 2 }
  ok(t.st === 1, `meeting him halfway never closes: ${steps.join(' · ')}`)
  console.log(`  ${p.n} halfway: ${steps.join(' · ')}`)
}
{
  const t = FR.openTalks(F, B.i)
  for (let k = 0; k < 8 && t.st === 0; k++) FR.offerTalks(F, B.i, { $: FR.minimumFor(B.ag, F.year + 1), y: 1, b: 0 })
  ok(t.st === 3 && mine().includes(B), `a build walked instead of a final number (st ${t.st})`)
  ok(FR.acceptTalks(F, B.i) && t.st === 1, 'the build could not be signed at his final number')
  console.log(`  build ${B.n}: final number ${t.c.$} x ${t.c.y}, signed ${B.$} x ${B.y}`)
}
// a bonus is worth more to him, and it's dead money if he's cut
{
  const p = mine().find(x => x.y > 0 && x.b == null && x.o >= 75)
  const a = FR.worthOf(p, { $: 10, y: 3, b: 0 }), b = FR.worthOf(p, { $: 10, y: 3, b: 2 })
  ok(b > a, 'a bigger bonus is not worth more to him')
}
// the cap: an offer that doesn't fit is refused
{
  const id = F.rs.find(x => !FR.optionDue(mine().find(p => p.i === x)) && x !== B.i)
  if (id != null) { const r = FR.offerTalks(F, id, { $: FR.capRoom(F) + 5, y: 3, b: 0 }); ok(r.say === 'cap' && !r.ok, `an offer over the cap: ${r.say}`) }
}
for (const id of [...F.rs]) FR.resignOne(F, id, FR.optionDue(mine().find(x => x.i === id)) ? 'decline' : false)

// free agency: the whole market, filters by room, offers that count against the room, the day's answers
FR.openFA(F)
ok(!F.fa.some(p => p.fl), 'a filler on the market')
ok(F.fa.every(p => p.pk != null), 'a free agent without a ceiling')
const V = FR.teamView(F)
const best = [...F.fa].sort((a, b) => b.o - a.o)
const room0 = FR.capRoom(F)
const a = best[0], b2 = best[1], c = best.find(p => p.o < 75)
ok(FR.setOffer(F, a.i, { $: a.$, y: a.y, b: 0 }), 'an offer at his ask was refused')
ok(Math.abs(FR.roomLeft(F) - (room0 - a.$)) < 0.11, 'an offer out does not count against the room')
ok(!FR.setOffer(F, b2.i, { $: FR.roomLeft(F) + 1, y: 2, b: 0 }), 'an offer past the room left was taken')
// a raise within the room left is taken; pulling an offer frees its room
{ const up = Math.min(a.$ * 1.1, FR.roomLeft(F, a.i)); ok(FR.setOffer(F, a.i, { $: up, y: a.y, b: 2 }) && FR.offersOut(F)[a.i].b === 2, 'a raise was refused') }
const small = [...F.fa].filter(p => p !== a && p.$ <= FR.roomLeft(F)).sort((x, y) => y.o - x.o)[0]
if (small) { FR.setOffer(F, small.i, { $: small.$, y: small.y, b: 0 }); const left = FR.roomLeft(F); FR.pullOffer(F, small.i); ok(!FR.offersOut(F)[small.i] && FR.roomLeft(F) > left, 'a pulled offer is still out') }
const short = FR.standingOf(F, c, { $: FR.minimumFor(c.ag, F.year + 1), y: 1, b: 0 }, V)
ok(short.k === 'short' || c.$ <= FR.minimumFor(c.ag, F.year + 1) * 1.05, `a minimum offer to a ${c.o} asking ${c.$} reads ${short.k}`)
FR.setOffer(F, c.i, { $: FR.minimumFor(c.ag, F.year + 1), y: 1, b: 0 })
const st = FR.standingOf(F, a, FR.offersOut(F)[a.i], V)
console.log(`free agency: ${F.fa.length} on the market · ${a.n} (${a.o}) ${a.$} x ${a.y}: ${st.k}${st.lead ? ` (${st.lead})` : ''}, ${st.rivals.length} rivals · fit ${FR.fitOf(F, a, V).k}`)
FR.nextFADay(F)
const res = F.far?.list ?? []
console.log(`  day 1: ${res.map(x => `${x.n} ${x.k}${x.to ? ` ${x.to}` : ''}`).join(' · ')}`)
ok(res.length === 2, `day 1 answered ${res.length} offers`)
const rc = res.find(x => x.i === c.i)
if (c.$ > FR.minimumFor(c.ag, F.year + 1) * 1.05) ok(rc && rc.k !== 'won' && (rc.k === 'lost' || F.fa.includes(c)), `a lowball to ${c.n} was ${rc?.k}`)
ok(Object.keys(FR.offersOut(F)).length === 0, 'offers still out after the day')
while (F.fad) FR.nextFADay(F)
ok(FR.capRoom(F) > -60, 'way over the cap after free agency')

// a version-6 save comes up to 7 with every man's ceiling
{
  const X = JSON.parse(FR.packFranchise(F))
  X.v = 6
  const U = FR.unpackFranchise(JSON.stringify(X))
  for (const s of FR.SHORTS) for (const p of U.teams[s].r) delete p.pk
  FR.fillPotential(U)
  ok(FR.SHORTS.every(s => U.teams[s].r.every(p => p.pk >= p.o)), 'an old save without ceilings')
}
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: deals hold')
