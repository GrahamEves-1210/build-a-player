// Money and the market, headless, over several seasons (contracts.js, market.js, deals.js, coach.js):
//   6  real deals pay their real money: rising cap hits, each team's 2026 room against the real one, the Lions' room
//   7  league clubs extend, re-sign and tag their young stars: how many 85+ men under 28 reach free agency a year
//   8  asks by role and age: backup QBs, old men, the fifth-year option and the tag as shares of the cap
//   9  free agency over days: the best take their time; a lower offer wins only with a stated reason
//   20 an injured starter is still a starter in talks · 21 the starters who'd walk are named · 24 FIT by impact
//   25 a broken play-calling promise costs · 26 the extension event's years
//   bash scripts/franchise2/run.sh scripts/franchise2/market-check.mjs [seasons=4] [team=DET] [seed=mk] [watch=DET]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'

const N = Number(process.argv[2] ?? 4), team = process.argv[3] ?? 'DET', seed = process.argv[4] ?? 'mk', watch = process.argv[5] ?? 'DET'
FR.useContracts(CONTRACTS)
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const ok = (c, m) => { if (!c) bad(m) }
const r1 = v => Math.round(v * 10) / 10
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen'), wr = WRS.find(p => p.attrs && p.name === 'Puka Nacua') ?? WRS.find(p => p.attrs)
const F = FR.createFranchise({ seed: `${seed}-${team}`, team, owner: 'G', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 12 }, { pos: 'wr', build: asBuild(wr), name: 'Tre Holloway', num: 81 }], coach: { name: 'Test Coach', style: 'players', r: { talentDev: 6, offPlaycalling: 6, defPlaycalling: 6, culture: 6, situational: 6 }, ovr: 76 } })

// ── 6. The 2026 cap against the real one; real deals' years ───────────────────
{
  const rows = FR.SHORTS.map(s => { const c = FR.capSheet(F, s); return { s, room: c.room, real: r1(CONTRACTS.cap - (CONTRACTS.teamCapUsed?.[s] ?? NaN)) } })
  console.log(`2026 cap space, the game's (the ${team} with its builds) / the real 2026 figure (OTC: the $${CONTRACTS.cap}M cap minus all liabilities, no rollover):`)
  const line = rows.map(r => `${r.s} ${r.room}/${r.real}`)
  for (let i = 0; i < line.length; i += 8) console.log('   ' + line.slice(i, i + 8).join(' · '))
  const others = rows.filter(r => r.s !== team && Number.isFinite(r.real))
  const mad = others.reduce((a, r) => a + Math.abs(r.room - r.real), 0) / others.length
  const xs = others.map(r => r.room), ys = others.map(r => r.real), mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length
  let n = 0, a = 0, b = 0; xs.forEach((x, i) => { n += (x - mx) * (ys[i] - my); a += (x - mx) ** 2; b += (ys[i] - my) ** 2 })
  const med = v => [...v].sort((p, q) => p - q)[15]
  console.log(`   the other 31: mean gap $${r1(mad)}M, correlation ${(n / Math.sqrt(a * b)).toFixed(2)} · median game ${med(xs)} vs real ${med(ys)}`)
  ok(n / Math.sqrt(a * b) >= 0.6, 'the 2026 rooms no longer follow the real ones')
  ok(med(xs) - med(ys) <= 20, `the league's 2026 room runs $${r1(med(xs) - med(ys))}M over the real one`)
}
const hits = p => Array.from({ length: Math.max(1, p.y ?? 1) }, (_, k) => FR.hitIn(p, k)).map(r1)
{
  const all = FR.SHORTS.flatMap(s => F.teams[s].r)
  for (const n of ['Aidan Hutchinson', 'Jared Goff', 'Penei Sewell', 'Amon-Ra St. Brown', 'Jahmyr Gibbs', 'Josh Allen', 'Patrick Mahomes']) { const p = all.find(x => x.n === n); if (p) console.log(`   ${n}: ${hits(p).join(' / ')} ($M a year, ${p.y} left, bonus ${p.g} a year)`) }
  const h = all.find(x => x.n === 'Aidan Hutchinson')
  ok(h && FR.hitIn(h, 1) >= 30, `Hutchinson's 2027 cap hit is ${h && FR.hitIn(h, 1)} (his deal is $45M a year)`)
  // every real man with years left: the years after 2026 average about his APY
  const P = Object.values(CONTRACTS.players)
  let off = 0, n = 0
  for (const p of all.filter(x => x.sc)) { const row = P.find(r => r.name === p.n); if (!row || row.apy < 5) continue; const m = p.sc.reduce((a, b) => a + b, 0) / p.sc.length; n++; if (m < row.apy * 0.85 || m > row.apy * 1.3) off++ }
  console.log(`   real deals with later years ($5M+ APY): ${n}, averaging off their APY by more than -15%/+30%: ${off}`)
  ok(n > 300 && off / n < 0.05, `real deals' later years off their APY: ${off} of ${n}`)
}

// ── 20, 21, 24: an injured starter in talks, the walking starters, FIT by impact ──
{
  const X = JSON.parse(FR.packFranchise(F)), G = FR.unpackFranchise(JSON.stringify(X))
  const st = Object.values(FR.startersOf(G, G.team)).find(p => p.b == null && p.p !== 'qb')
  st.in = 6; st.y = 0
  ok(FR.startsFor(G, st), `an injured starter (${st.n}) is not a starter in talks`)
  // (the re-sign list with him on it: he's named among the starters who'd walk)
  G.rs = [st.i]
  ok(FR.walkingStarters(G).some(p => p.i === st.i), 'an unsigned starter is not named among the men who would walk')
  // FIT: a man who'd start at WR, 19 better than the WR3, against one who fills an empty safety spot at 70
  const V = FR.teamView(G)
  const wrs = [...V[G.team].rooms.wr].sort((a, b) => b - a)
  const w = FR.fitOf(G, { p: 'wr', o: wrs[2] + 19, ag: 27 }, V)
  V[G.team].rooms.s = V[G.team].rooms.s.slice(0, 1)
  const h = FR.fitOf(G, { p: 'db', s: 's', o: 70, ag: 27 }, V)
  console.log(`   FIT: a WR +19 over the WR3 ${w.k} ${w.v} · a 70 safety into an empty spot ${h.k} ${h.v}`)
  ok(w.v > h.v, `a +19 starter (${w.v}) ranks under a hole filled by a 70 (${h.v})`)
}

// ── 25: a play-calling promise ────────────────────────────────────────────────
{
  const G = FR.unpackFranchise(FR.packFranchise(F))
  const T = FR.staffOf(G, G.team), side = FR.myHC(G).sd, co = side === 'off' ? 'oc' : 'dc'
  if (T?.[co]) {
    T.call = { ...T.call, [side]: co }
    T.pr = { [side]: { c: T[co].i, n: T[co].n, y: G.year } }
    const chem = G.chem
    ok(!!FR.promiseOf(G, side), 'the promise does not hold in its season')
    FR.setCalls(G, side, 'hc')
    ok(G.chem === r1(chem - FR.PROMISE_CHEM) && G.brk?.n === T[co].n && (G.news ?? []).some(x => x.tag === 'PLAY-CALLING'), `breaking the promise cost nothing (chem ${chem} -> ${G.chem})`)
    ok(FR.brokeWord(G), 'coordinators do not remember the broken promise')
    // a promise kept to the end of its season: free to take back after it
    const H = FR.unpackFranchise(FR.packFranchise(F)), TH = FR.staffOf(H, H.team)
    TH.call = { ...TH.call, [side]: co }; TH.pr = { [side]: { c: TH[co].i, n: TH[co].n, y: H.year } }; H.phase = 'off'
    const c2 = H.chem
    FR.setCalls(H, side, 'hc')
    ok(H.chem === c2 && !H.brk, 'taking the calls back after the promised season still cost chemistry')
    console.log(`   promise: broken in its season costs ${chem} -> ${G.chem} chemistry and the wire; after it, nothing`)
  } else console.log('   (no coordinator on the head coach\'s side to promise: skipped)')
}

// ── 26: the extension event ───────────────────────────────────────────────────
{
  const G = FR.unpackFranchise(FR.packFranchise(F))
  const p = Object.values(FR.startersOf(G, G.team)).filter(x => x.b == null).sort((a, b) => b.o - a.o)[0]
  p.y = 1; p.ag = 26; p.o = Math.max(p.o, 88)
  G.teams[G.team].r.filter(x => x !== p && x.b == null && x.y > 1).forEach(x => { x.y = 1; delete x.sc })   // (room next year)
  const ev = FR.eventNow(G, 'extend')
  if (ev) {
    ok(ev.ask.y <= 5, `the extension event asks for ${ev.ask.y} years`)
    const txt = FR.fxList(G, ev, 0).map(x => x[0]).join(' ')
    ok(!/\b[6-9]-YR\b/.test(txt), `the extension button reads ${txt}`)
    const man = G.teams[G.team].r.find(x => x.i === ev.pid), was = man.$
    G.ev = ev
    FR.chooseEvent(G, 0)
    ok(man.y - 1 <= 5 && man.y >= 2 && man.$ === was, `extended: ${man.y - 1} new years (this year's hit ${was} -> ${man.$})`)
    console.log(`   extension: ${txt} · ${man.n} now ${hits(man).join(' / ')}`)
  } else bad('no extension event could be made')
}

// ── 7, 8, 9: the seasons ──────────────────────────────────────────────────────
const yearRows = []
const roomBy = []
let lowerWins = 0, lowerWhy = 0, contested = 0, top = 0, topDay1 = 0, tagTwice = 0
const asks = { qbStart: [], qbBack: [], back: [], old: [], young: [] }
for (let y = 0; y < N; y++) {
  while (F.phase === 'season') { const r = FR.playWeek(F, { moments: false }); if (r.pending) while (F.pend) FR.finishMoment(F, null); if (F.ev) FR.chooseEvent(F, 1) }
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') { const r = FR.playWeek(F, { moments: false }); if (r.pending) while (F.pend) FR.finishMoment(F, null) }
  FR.closeSeason(F); FR.closeCarousel(F)
  FR.ageLeague(F)
  // (the young stars on the league's teams whose deals are up, before their teams decide)
  const upStars = FR.SHORTS.filter(s => s !== team).flatMap(s => F.teams[s].r.filter(p => p.y === 0 && p.o >= 85 && p.ag < 28 && !p.fl).map(p => ({ p, s })))
  FR.openResign(F)
  const lyr = F.year + 1
  const room0 = FR.capRoom(F, team), watch0 = FR.capRoom(F, watch)
  // the player's calls (the way sim.mjs makes them): options on the good ones, the rest at their ask if they fit
  for (const id of [...F.rs]) {
    const p = F.teams[team].r.find(x => x.i === id)
    if (FR.optionDue(p)) { FR.resignOne(F, id, p.o >= 80 ? 'option' : 'decline'); continue }
    const ask = FR.resignAsk(p, F)
    FR.resignOne(F, id, p.b != null || (p.o >= 76 && FR.canSign(F, ask.$)))
  }
  // what the market asks, by role and age, the day it opens
  FR.openFA(F)
  const lines = FR.marketLines(F)
  const fa = F.fa.filter(p => !p.fl)
  const reached = fa.filter(p => p.o >= 85 && p.ag < 28)
  const fromCpu = reached.filter(p => upStars.some(u => u.p === p))
  for (const u of upStars.filter(u => fa.includes(u.p))) console.log(`   (${u.p.n} ${u.p.o}/${u.p.ag} left ${u.s}: room now ${FR.capRoom(F, u.s)}, ask ${u.p.$})`)
  const sc = FR.capOf(lyr) / FR.capOf(2026)
  for (const p of fa) {
    const k = FR.marketKey(p), line = lines[k]
    if (p.p === 'qb') (p.o >= line ? asks.qbStart : asks.qbBack).push([p.o, p.ag, r1(p.$ / sc), p.n])
    else if (p.o < line) asks.back.push([p.o, p.ag, r1(p.$ / sc), k])
    if (p.ag >= 32 && p.o >= 80) asks.old.push([p.o, p.ag, r1(p.$ / sc), k, p.n])
    if (p.ag <= 27 && p.o >= 85) asks.young.push([p.o, p.ag, r1(p.$ / sc), k, p.n])
    // (age prices him down: the same man at 29 asks more)
    if (p.ag >= 33 && p.p !== 'k' && p.$ > FR.minimumFor(p.ag, lyr) + 1) { const now = FR.marketValue(p, lyr, lines), young = FR.marketValue({ ...p, ag: 29 }, lyr, lines); ok(now <= young * 0.95 || p.o >= 90, `${p.n} (${p.p} ${p.o}, ${p.ag}) is worth ${now}, as much as at 29 (${young})`) }
  }
  const tags = (F.ext ?? []).filter(e => e[7] === 'tag')
  const byTeam = {}; for (const t of tags) byTeam[t[3]] = (byTeam[t[3]] ?? 0) + 1
  tagTwice += Object.values(byTeam).filter(n => n > 1).length
  const ext = (F.ext ?? []).filter(e => e[7] === 'ext').length
  // free agency: an offer a day on the best man the team can fit, at his ask; then the day's answers
  const byDay = []
  const bigOnes = new Set(fa.filter(p => p.o >= 90).map(p => p.i))
  top += bigOnes.size
  while (F.fad) {
    const d = F.fad
    const p = FR.faBoard(F, 10).find(x => FR.roomLeft(F) >= x.$ && x.o >= 80 && !(F.fao ?? {})[x.i])
    if (p) FR.setOffer(F, p.i, { $: p.$, y: p.y, b: 0 })
    // every man on the market today: a made-up offer from the player 4% under the best rival's, as a starter's job;
    // when it wins, a reason has to be stated; when no reason is stated, the winner offered the most
    const V = FR.teamView(F)
    for (const x of F.fa.filter(q => q.o >= 75).slice(0, 40)) {
      const rv = FR.rivalsFor(F, x, V)
      if (!rv.length) continue
      const hi = Math.max(...rv.map(r => r.offer))
      const w = FR.weigh(F, x, { $: r1(hi * 0.96), y: x.y, b: 0 }, rv, V, null, 0)
      if (!w.win) continue
      contested++
      const most = Math.max(...w.board.filter(b => b.v >= 0).map(b => b.offer))
      if (w.win.offer < most - 0.05) { lowerWins++; if (w.why) lowerWhy++ }
      ok(!w.why || w.win.offer < most - 0.05, 'a reason given when the most money won')
    }
    const before = (F.fas ?? []).length
    FR.nextFADay(F)
    const now = (F.fas ?? []).slice(before)
    if (d === 1) topDay1 += now.filter(x => bigOnes.has(x[0])).length
    byDay.push(`day ${d}: ${now.length} (${now.filter(x => x[6] >= 85).length} 85+)`)
  }
  const room1 = FR.capRoom(F, team)
  FR.openDraft(F)
  FR.startNight(F)
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft(F)
  FR.newSeason(F)
  const room2 = FR.capRoom(F, team)
  roomBy.push(`${lyr}: ${team} at re-sign ${room0} · after FA ${room1} · season start ${room2}${watch !== team ? ` · ${watch} (a league club) at re-sign ${watch0}, season start ${FR.capRoom(F, watch)}` : ''}`)
  const over = FR.SHORTS.filter(s => s !== team && FR.capRoom(F, s) < 0)
  if (over.length) bad(`${F.year}: ${over.length} league teams over the cap at the start of the season: ${over.map(s => `${s} ${FR.capRoom(F, s)} (${F.teams[s].r.filter(p => p.y > 0).sort((a, b) => b.$ - a.$).slice(0, 6).map(p => `${p.n} $${p.$} y${p.y} g${p.g}${p.rc ? ' rc' : ''}`).join(', ')}; dead ${FR.deadOf(F.teams[s])})`).join(' · ')}`)
  const rooms = FR.SHORTS.filter(s => s !== team).map(s => FR.capRoom(F, s)).sort((a, b) => a - b)
  // (no deal in the league past 25% of the cap: the restructures don't snowball)
  const huge = FR.SHORTS.flatMap(s => F.teams[s].r).filter(p => p.y > 0 && p.$ > FR.capOf(F.year) * 0.25)
  ok(!huge.length, `${F.year}: cap hits over a quarter of the cap: ${huge.map(p => `${p.n} $${p.$}`).join(', ')}`)
  yearRows.push({ yr: lyr, up: upStars.length, reached: reached.length, fromCpu: fromCpu.length, tags: tags.length, ext })
  console.log(`${lyr}: ${upStars.length} league 85+ under 28 up · ${reached.length} reached FA (${fromCpu.length} from league teams)${reached.length ? ` [${reached.map(p => `${p.n} ${p.o}/${p.ag}`).join(', ')}]` : ''} · tags ${tags.length}${tags.length ? ` [${tags.map(t => `${t[1]} ${t[3]} ${t[6]} $${t[4]}`).join(', ')}]` : ''} · extended early ${ext} · signings ${byDay.join(', ')} · league room at the season's start: median ${rooms[15]} (${rooms[0]}..${rooms[30]})`)
}
console.log('\ncap room by league year:')
for (const r of roomBy) console.log('   ' + r)
const avg = a => a.length ? r1(a.reduce((x, y) => x + y, 0) / a.length) : '-'
const span = a => a.length ? `${r1(Math.min(...a))}-${r1(Math.max(...a))}` : '-'
console.log('\nasks on the market (in 2026 dollars: each year\'s ask over its cap growth):')
console.log(`   QBs at or over the starter's line (${asks.qbStart.length}): ${span(asks.qbStart.map(x => x[2]))} · mean ${avg(asks.qbStart.map(x => x[2]))}`)
console.log(`   backup QBs (${asks.qbBack.length}): ${span(asks.qbBack.map(x => x[2]))} · mean ${avg(asks.qbBack.map(x => x[2]))} · within 8 of the line: ${span(asks.qbBack.filter(x => x[0] >= 70).map(x => x[2]))}`)
console.log(`   backups at other spots (${asks.back.length}): ${span(asks.back.map(x => x[2]))} · mean ${avg(asks.back.map(x => x[2]))}`)
console.log(`   80+ aged 32+ (${asks.old.length}): ${asks.old.sort((a, b) => b[2] - a[2]).slice(0, 8).map(x => `${x[4]} ${x[3]} ${x[0]}/${x[1]} $${x[2]}`).join(' · ')}`)
console.log(`   85+ aged 27 or under (${asks.young.length}): ${asks.young.sort((a, b) => b[2] - a[2]).slice(0, 6).map(x => `${x[4]} ${x[3]} ${x[0]}/${x[1]} $${x[2]}`).join(' · ')}`)
// (a QB right at the line is priced as the last starter, about $10M: the two prices meet there)
ok(asks.qbBack.every(x => x[2] <= 10.5), `a backup QB asks over $10M: ${asks.qbBack.filter(x => x[2] > 10.05).map(x => `${x[3]} ${x[0]} $${x[2]}`).join(', ')}`)
{
  const yr = F.year + 1, cap = FR.capOf(yr)
  const q = { p: 'qb', o: 84, ag: 25 }
  const opt = FR.optionPrice(q, yr), opt2 = FR.optionPrice({ ...q, cr: [[1, 'X', 17, 0, 0, 0, 1], [2, 'X', 17, 0, 0, 0, 1]] }, yr)
  console.log(`\nthe QB fifth-year option (${yr}): basic $${opt}M = ${(opt / cap * 100).toFixed(1)}% of the cap · two Pro Bowls $${opt2}M (${(opt2 / cap * 100).toFixed(1)}%) · tags: QB $${FR.tagPrice(q, yr)}M (${(FR.tagPrice(q, yr) / cap * 100).toFixed(1)}%), WR $${FR.tagPrice({ p: 'wr', o: 90 }, yr)}M, RB $${FR.tagPrice({ p: 'rb', o: 90 }, yr)}M`)
  ok(opt / cap < 0.1, 'the basic QB option is 10% of the cap or more')
  ok(opt2 === FR.tagPrice({ ...q, rc: 1 }, yr), 'two Pro Bowls do not make the option the tag')
}
const sum = k => yearRows.reduce((a, r) => a + r[k], 0)
console.log(`\nper year: 85+ under 28 reaching FA ${r1(sum('reached') / N)} (${r1(sum('fromCpu') / N)} from league teams) · tags ${r1(sum('tags') / N)} · extended a year early ${r1(sum('ext') / N)}`)
console.log(`free agency: 90+ men on the market ${top}, signed on day 1 ${topDay1} · weighed boards ${contested}, a lower offer won ${lowerWins}, with a stated reason ${lowerWhy}`)
ok(sum('fromCpu') / N <= 1.5, `${r1(sum('fromCpu') / N)} league 85+ men under 28 reach free agency a year`)
ok(sum('tags') / N >= 1, `${r1(sum('tags') / N)} franchise tags a year`)
ok(!tagTwice, `${tagTwice} teams tagged two men in one year`)
ok(topDay1 <= top * 0.2, `${topDay1} of ${top} 90+ free agents signed on day 1`)
ok(lowerWins === lowerWhy, `${lowerWins - lowerWhy} lower offers won with no reason`)
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: the money holds')
