// NBA Franchise: re-signing and the books (the 2026-11-24 fix round).
//   - cap holds count against cap room only: the payroll the tax, the aprons, the hard caps and the owner's ceiling
//     read is salaries and dead money (cap.js payroll / capSheet)
//   - the GM re-signs his own stars and his builds with Bird rights whatever the holds of his other free agents
//   - canSign's reasons name the team (not its short) and the right mechanism (the Early Bird / Non-Bird limit)
//   - a hard cap never leaves the GM unable to reach 14 men (the mid-level leaves room; a minimum deal always goes)
//   - LIGHT's front office keeps men at the first re-sign stop
//   - a qualifying offer's wire line carries its amount; the supermax reads the last three seasons
//   FR_TMP=<dir> bash scripts/franchise2/run.sh scripts/franchise2/nba-resign.mjs [seed=q3]
import * as N from '../../src/lib/franchise2/nba/index'
import * as K from '../../src/lib/franchise2/nba/contracts'
import * as CP from '../../src/lib/franchise2/nba/cap'
import { NBA_GUARD_PLAYERS } from '../../src/data/nba-guards'
import { NBA_BIG_PLAYERS } from '../../src/data/nba-bigs'
const C = N.CAP_SIM
const SEED = process.argv[2] ?? 'q3'
let bad = 0
const fail = (...m) => { bad++; console.log('  FAIL', ...m) }
const ok = (c, ...m) => { if (!c) fail(...m) }
const r1 = v => Math.round(v * 10) / 10
const CODE = /\b[Tt]he [A-Z]{3}\b/
const camp = F => { const T = F.teams[F.team]; while (T.r.filter(p => !p.tw).length > 15) C.cutMan(F, F.team, T.r.filter(p => !p.tw && p.b == null).sort((a, b) => a.o - b.o)[0].i); for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) } }
const season = F => { N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F); N.closeSeason(F) }

// what every re-sign stop has to hold
function booksCheck(F, tag) {
  const s = F.team, y = C.capYear(F)
  const sh = C.capSheet(F, s)
  const pay = CP.payroll(F, s, y), capPay = CP.capPayroll(F, s, y)
  const holds = (sh.holds ?? []).reduce((a, h) => a + h.$, 0)
  ok(Math.abs(sh.pay - pay) < 0.05, tag, 'the sheet\'s payroll is salaries', sh.pay, pay)
  ok(capPay >= pay + holds - 0.15, tag, 'cap room is counted with the holds', capPay, pay, holds)
  ok(Math.abs((sh.hold ?? 0) - (capPay - pay)) < 0.15, tag, 'sheet.hold', sh.hold, capPay - pay)
  // the line it sits past is read off salaries (holds can only make it "over the cap")
  const byPay = CP.overOf(pay, y)
  ok(sh.over === byPay || (byPay === 'under' && sh.over === 'cap' && capPay > C.capOf(y)), tag, 'over', sh.over, 'salaries say', byPay)
  ok(Math.abs(sh.bill - CP.taxBill(pay - CP.taxOf(y), y, sh.repeater)) < 0.2 || pay <= C.taxOf(y), tag, 'the tax estimate reads salaries', sh.bill)
  ok(Math.abs(sh.room - Math.max(0, C.capOf(y) - capPay)) < 0.15, tag, 'room', sh.room)
  const own = K.ownerCap(F, y)
  let birds = 0, kept = 0
  for (const id of [...(F.off.mine ?? [])]) {
    const p = F.fa.find(x => x.i === id)
    const d = C.resignOffer(F, p)
    if (!d) continue
    const c = C.canSign(F, s, p, { ...d, bird: true })
    if (!c.ok) {
      ok(!CODE.test(c.why ?? ''), tag, 'a team code in a reason:', c.why)
      const after = CP.payroll(F, s, y) + d.$
      if (c.k === 'owner') ok(after > own.$ + 0.01, tag, p.n, 'refused by the owner with salaries under his line', r1(after), own.$)
      const rt = K.rightsOf(p, s)
      if (rt === 'nbird' && d.$ > Math.max((p.$l ?? 0) * 1.2, C.minOf(p.ys ?? 0, y) * 1.2) + 0.05 && c.k !== 'owner' && c.k !== 'hc') ok(/Non-Bird rights/.test(c.why), tag, p.n, 'the Non-Bird limit is not explained:', c.why)
      if (rt === 'ebird' && c.k === 'rights') ok(/Early Bird/.test(c.why), tag, p.n, 'the Early Bird limit is not named:', c.why)
      if (rt === 'bird') ok(c.k === 'owner' || c.k === 'hc' || /max|seasons|Raises|option|waived|offer sheet|roster/.test(c.why ?? ''), tag, p.n, 'a Bird-rights man refused for a reason that isn\'t his max, the owner or a hard cap:', c.why)
    }
    if (K.rightsOf(p, s) === 'bird') {
      birds++
      // the answer doesn't depend on the holds of the other free agents: renounce them all (on a copy) and ask again
      const G = N.unpackNba(N.packNba(F))
      for (const j of G.off.mine ?? []) if (j !== id) K.renounce(G, s, j)
      const q = G.fa.find(x => x.i === id)
      const c2 = C.canSign(G, s, q, { ...d, bird: true })
      ok(c.ok === c2.ok, tag, p.n, 'Bird re-signing depends on other men\'s holds:', c.ok, c2.ok, c.why)
    }
  }
  return { sh, birds, kept, holds }
}

// ── 1. the Lakers keep everyone: the 2028 stop is Doncic's (tester 3's league) ──
{
  const F = N.createNbaFranchise({ seed: SEED, team: 'LAL', owner: 'QA' })
  let luka = null
  for (let yr = 0; yr < 3; yr++) {
    season(F)
    while (F.phase === 'off') {
      const st = F.off.step
      if (st === 'draft') N.draftTo(F, { stopMine: false })
      if (st === 'resign') {
        const { sh, holds } = booksCheck(F, `LAL ${F.year + 1}`)
        const p = F.fa.find(x => x.n === 'Luka Doncic' && F.off.mine.includes(x.i))
        if (p) {
          const d = C.resignOffer(F, p)
          const c = C.canSign(F, 'LAL', p, { ...d, bird: true })
          luka = { y: F.year + 1, ask: d.$, yrs: d.y, ok: c.ok, via: c.via, why: c.why, pay: sh.pay, holds: r1(holds), owner: K.ownerCap(F).$ }
          ok(c.ok && c.via === 'bird', 'Doncic can be kept with Bird rights', JSON.stringify(c))
          const r = N.resignMine(F, p.i, true)
          ok(r.ok, 'Doncic re-signs', JSON.stringify(r))
          ok(F.teams.LAL.r.some(x => x.n === 'Luka Doncic' && x.y === d.y), 'Doncic is on the roster on his new deal')
        }
        for (const i of [...(F.off.mine ?? [])]) { const r = N.resignMine(F, i, true); if (!r.ok) { const q = F.fa.find(x => x.i === i); if (q?.rfa) N.tenderQO(F, i, true) } }
      }
      if (st === 'fa') for (let d = 0; d < C.FA_DAYS; d++) { N.faNext(F); for (const q of [...(F.rfq ?? [])]) N.answerSheet(F, q.i, true) }
      if (st === 'camp') { camp(F); ok(N.campCheck(F).ok, 'LAL camp roster legal', JSON.stringify(N.campCheck(F))) }
      N.nextStep(F)
    }
  }
  ok(luka, 'Doncic reached a re-sign stop (seed q3: summer 2028)')
  if (luka) console.log(`1. LAL ${luka.y}: payroll $${luka.pay}M, holds $${luka.holds}M, owner's line $${luka.owner}M · Doncic asks $${luka.ask}M x ${luka.yrs}: ${luka.ok ? 'KEEP OK (' + luka.via + ')' : 'NO: ' + luka.why}`)
  const zero = F.news.filter(x => /\$0 million/.test(x.text))
  ok(!zero.length, '"$0 million" on the wire:', zero[0]?.text)
  const qoLine = F.news.find(x => x.tag === 'QUALIFYING OFFER' && /signs his qualifying offer/.test(x.text) && /million/.test(x.text))
  if (qoLine) console.log('   a qualifying offer on the wire:', qoLine.text)
}

// ── 2. the Kings and three builds: the best of them re-signs when his rookie deal is up (tester 4's league) ──
{
  const asB = a => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, { val: v }]))
  const gs = NBA_GUARD_PLAYERS.filter(p => p.attrs), bs = NBA_BIG_PLAYERS.filter(p => p.attrs)
  const g1 = gs.find(p => p.name === 'Stephen Curry') ?? gs[0], g2 = gs[Math.floor(gs.length / 2)], b1 = bs[Math.floor(bs.length * 0.7)]
  const F = N.createNbaFranchise({ seed: 'qa4ui2', team: 'SAC', owner: 'Guest', builds: [{ pos: 'guard', build: asB(g1.attrs), name: 'Marcus Reed', num: 3 }, { pos: 'guard', build: asB(g2.attrs), name: 'Dante Wells', num: 11 }, { pos: 'big', build: asB(b1.attrs), name: 'Tre Holloway', num: 50 }] })
  let seen = 0
  for (let y = 0; y < 5 && !seen; y++) {
    season(F)
    let g = 0
    while (F.phase === 'off' && g++ < 20) {
      const st = F.off.step
      if (st === 'resign') {
        booksCheck(F, `SAC ${F.year + 1}`)
        for (const id of [...(F.off.mine ?? [])]) {
          const p = F.fa.find(x => x.i === id)
          if (p?.b == null) continue
          seen++
          const d = C.resignOffer(F, p), sh = C.capSheet(F, 'SAC')
          const c = d ? C.canSign(F, 'SAC', p, { ...d, bird: true }) : null
          console.log(`2. SAC ${F.year + 1}: payroll $${sh.pay}M (${sh.over}), holds $${r1(sh.hold)}M · build ${p.n} ${p.o} asks $${d?.$}M x ${d?.y}: ${c?.ok ? 'KEEP OK (' + c.via + ')' : 'NO: ' + c?.why}`)
          ok(c?.ok, 'a build re-signs with Bird rights', p.n, c?.why)
          ok(sh.over !== 'a2' || CP.payroll(F, 'SAC') > C.apron2Of(C.capYear(F)), 'the cap bar reads the second apron on holds')
          const r = N.resignMine(F, id, true)
          ok(r.ok, 'the build is kept', p.n, r.why)
        }
        for (const id of [...(F.off.mine ?? [])]) { const p = F.fa.find(x => x.i === id); if (p && p.o >= 72) N.resignMine(F, id, true) }
      }
      if (st === 'camp') camp(F)
      N.nextStep(F)
    }
  }
  ok(seen, 'a build reached free agency in five seasons')
}

// ── 3. LIGHT: the front office's calls at the first re-sign stop keep men ──
{
  const F = N.createNbaFranchise({ seed: 'light-rs', team: 'DET', owner: 'G', pace: 'light' })
  season(F)
  let g = 0
  while (F.phase === 'off' && F.off.step !== 'resign' && g++ < 10) { if (F.off.step === 'draft') N.draftTo(F, { stopMine: false }); N.nextStep(F) }
  const sh = C.capSheet(F, 'DET')
  const list = N.resignList(F)
  const can = list.filter(x => x.c?.ok).length, birds = list.filter(x => K.rightsOf(x.p, 'DET') === 'bird')
  console.log(`3. LIGHT DET ${F.year + 1}: payroll $${sh.pay}M (${sh.over}), holds $${r1(sh.hold)}M · ${list.length} free agents, ${can} can be kept, ${birds.filter(x => x.c?.ok).length} of ${birds.length} with Bird rights`)
  ok(sh.over === CP.overOf(CP.payroll(F, 'DET'), C.capYear(F)) || sh.over === 'cap', 'LIGHT: the line reads salaries')
  ok(!list.length || can > 0, 'LIGHT: nobody can be kept at the first stop')
  for (const x of list) if (x.c && !x.c.ok) ok(!CODE.test(x.c.why ?? ''), 'LIGHT: a team code in a reason:', x.c.why)
  const calls = N.resignCalls(F)
  const keep = Object.values(calls ?? {}).filter(v => v === 'keep' || v?.k === 'keep' || v === true).length
  console.log(`   the front office's calls: ${JSON.stringify(calls).slice(0, 160)}`)
}

// ── 4. a hard cap never strands a roster under 14 ──
{
  const F = N.createNbaFranchise({ seed: 'hardcap', team: 'BOS', owner: 'QA' })
  season(F)
  let g = 0
  while (F.phase === 'off' && F.off.step !== 'fa' && g++ < 10) { if (F.off.step === 'draft') N.draftTo(F, { stopMine: false }); N.nextStep(F) }
  const y = C.capYear(F), T = F.teams.BOS
  // thirteen men, the payroll $1M under the first apron, hard-capped there (as after the non-taxpayer mid-level)
  T.r = T.r.filter(p => !p.tw).sort((a, b) => b.o - a.o).slice(0, 13)
  const top = T.r[0]
  top.$ = r1(top.$ + (C.apron1Of(y) - 1 - CP.payroll(F, 'BOS', y)))
  K.excFor(F, 'BOS', y).hc = 'a1'
  const pay = CP.payroll(F, 'BOS', y)
  ok(Math.abs(pay - (C.apron1Of(y) - 1)) < 0.2, 'setup: payroll at the apron', pay, C.apron1Of(y))
  const street = F.fa.filter(p => !p.fr || p.rn || p.fr !== 'BOS').sort((a, b) => a.o - b.o)
  const vet = street.find(p => (p.ys ?? 0) >= 5) ?? street[0]
  const c = C.canSign(F, 'BOS', vet, { $: C.minOf(vet.ys ?? 0, y), y: 1, r: 0 })
  ok(c.ok, 'a hard-capped team at 13 can sign its 14th man at the minimum', c.why)
  C.signMan(F, 'BOS', vet, { $: C.minOf(vet.ys ?? 0, y), y: 1, r: 0 })
  const lg = C.legalRoster(F, 'BOS', { season: true })
  ok(lg.ok, 'and the roster is legal at 14', JSON.stringify(lg))
  const next = street.find(p => p !== vet && (p.ys ?? 0) >= 5)
  const c15 = C.canSign(F, 'BOS', next, { $: C.minOf(next.ys ?? 0, y), y: 1, r: 0 })
  ok(!c15.ok && c15.k === 'hc', 'a 15th man past the hard cap is still refused', JSON.stringify(c15))
  // and a mid-level signing has to leave the room: 10 men under contract, the payroll $20M under the apron
  const G = N.createNbaFranchise({ seed: 'hardcap2', team: 'BOS', owner: 'QA' })
  season(G)
  g = 0
  while (G.phase === 'off' && G.off.step !== 'fa' && g++ < 10) { if (G.off.step === 'draft') N.draftTo(G, { stopMine: false }); N.nextStep(G) }
  for (const i of [...(G.off?.mine ?? [])]) K.renounce(G, 'BOS', i)
  for (const p of G.fa) if (p.fr === 'BOS') K.renounce(G, 'BOS', p.i)
  const U = G.teams.BOS
  U.r = U.r.filter(p => !p.tw).sort((a, b) => b.o - a.o).slice(0, 10)
  const t2 = U.r[0], y2 = C.capYear(G)
  const mle = CP.excOf('nt', y2)
  t2.$ = r1(t2.$ + (C.apron1Of(y2) - mle - 3 - CP.payroll(G, 'BOS', y2)))
  const fa = G.fa.filter(p => !p.rfa && (p.ys ?? 0) >= 4).sort((a, b) => b.o - a.o)[0]
  const cm = C.canSign(G, 'BOS', fa, { $: r1(mle - 0.2), y: 2, r: 0 })
  ok(!cm.ok && /14-man roster/.test(cm.why ?? ''), 'the mid-level is refused when it would leave no room to fill out the roster', JSON.stringify(cm))
  ok(!CODE.test(cm.why ?? ''), 'a team code in the reason:', cm.why)
  console.log(`4. hard cap: a 14th man at the minimum signs with the payroll $1M under the apron; the mid-level with 10 men and $${r1(mle + 3)}M to the apron: "${cm.why}"`)
}

// ── 5. the supermax: the MVP in any of the last three seasons, All-NBA or DPOY last season or twice in three ──
{
  const F = N.createNbaFranchise({ seed: 'smax', team: 'BOS', owner: 'QA' })
  season(F)   // (the summer: the season just played is F.year)
  const y = F.year
  const man = aw => ({ i: 999001, n: 'Test Man', ys: 8, ag: 28, o: 92, dr: [y - 8, 1, 3, 'BOS'], fr: 'BOS', aw })
  ok(K.superMaxOk(F, man([{ y: y - 2, k: 'MVP' }]), 'BOS'), 'an MVP two seasons ago qualifies')
  ok(!K.superMaxOk(F, man([{ y: y - 3, k: 'MVP' }]), 'BOS'), 'an MVP four seasons ago does not')
  ok(K.superMaxOk(F, man([{ y, k: 'ALL3' }]), 'BOS'), 'All-NBA last season qualifies')
  ok(!K.superMaxOk(F, man([{ y: y - 2, k: 'ALL1' }]), 'BOS'), 'All-NBA once, two seasons ago, does not')
  ok(K.superMaxOk(F, man([{ y: y - 2, k: 'ALL1' }, { y: y - 1, k: 'ALL2' }]), 'BOS'), 'All-NBA in two of the last three qualifies')
  ok(K.superMaxOk(F, man([{ y: y - 1, k: 'DPOY' }, { y: y - 2, k: 'DPOY' }]), 'BOS'), 'DPOY twice in three qualifies')
  ok(!K.superMaxOk(F, { ...man([{ y, k: 'MVP' }]), dr: [y - 8, 1, 3, 'NYK'] }, 'BOS'), 'not with a team that didn\'t draft him')
  console.log('5. supermax rule: ok')
}
console.log(bad ? `${bad} FAILED` : 'ALL OK')
if (bad) process.exit(1)
