// NBA Franchise: swapping two men in the GM's rotation (the Team screen's EDIT) swaps exactly those two, keeps every
// standard man in Team.rot, keeps Team.min with its man, and the sim starts the first five of the order
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-rotswap.mjs [ls_dump.json]
import { readFileSync } from 'node:fs'
import * as N from '../../src/lib/franchise2/nba/index'
import { rotOrder, swapRot, moveRot, benchDnp, dnpStarter } from '../../src/components/franchise2/nba/rotOrder'
const file = process.argv[2]
let F
if (file) { const o = JSON.parse(readFileSync(file, 'utf8')); F = N.unpackNba(o.bap_frnba_slot_0) }
else { F = N.createNbaFranchise({ seed: 'rotswap', team: 'CHA', owner: 'G' }); N.simTo(F, 20) }
const opts = { playoff: false }
const T = F.teams[F.team]
const mins = () => Object.fromEntries(N.CAP_SIM.rotationOf(F, F.team, opts).map(x => [x.i, x.min]))
const show = tag => {
  const m = mins(), o = rotOrder(F, opts)
  console.log(tag + ': ' + o.map((p, k) => `${k + 1}.${p.n.split(' ').pop()} ${Math.round(m[p.i] ?? 0)}`).join(' | ') + `  (plays ${Object.values(m).filter(v => v > 0).length})`)
  return o.map(p => p.i)
}
let bad = 0
const st = () => N.CAP_SIM.rotationOf(F, F.team, opts).filter(x => x.st).map(x => x.i).sort().join()
const check = (before, a, b) => {
  const after = rotOrder(F, opts).map(p => p.i)
  const exp = before.slice(); const i = exp.indexOf(a), j = exp.indexOf(b); [exp[i], exp[j]] = [exp[j], exp[i]]
  if (after.join() !== exp.join()) { bad++; console.log('  SWAP WRONG') }
  if (st() !== after.slice(0, 5).sort().join()) { bad++; console.log('  STARTERS NOT THE FIRST FIVE') }
  const std = T.r.filter(p => !p.tw).map(p => p.i)
  if (!std.every(i => T.rot.includes(i)) || T.rot.length !== std.length) { bad++; console.log('  ROT NOT EVERY STANDARD MAN') }
}
let o = show('start')
const m00 = JSON.stringify(mins())
const sw = (k1, k2) => { const a = o[k1], b = o[k2]; swapRot(F, a, b, opts); check(o, a, b); o = show(`swap ${k1 + 1}<->${k2 + 1}`) }
sw(10, 3); sw(10, 3)
if (JSON.stringify(mins()) !== m00) { bad++; console.log('  SWAPPED BACK: THE MINUTES ARE NOT THE COACH\'S') }
sw(0, 7); sw(5, 6); sw(2, 9)
// a minutes target stays with its man through swaps
const who = o[6]; T.min = { [who]: 24 }
o = show('min 24 on 7th'); sw(6, 1)
if (Math.round(mins()[who]) !== 24) { bad++; console.log('  MIN DID NOT STAY', mins()[who]) }
// move up / down (the man's page)
const m0 = o.slice(); moveRot(F, o[4], 1, opts); check(m0, m0[4], m0[5]); o = show('move 5th down')
// a starter hurt: the next man in the order starts, and he walks back into his place when he's healthy
{ const p = T.r.find(x => x.i === o[1]); p.inj = { g: 3, k: 'sprained ankle' }; const s5 = rotOrder(F, opts).slice(0, 5).map(x => x.i).sort().join()
  if (st() !== s5) { bad++; console.log('  HURT: STARTERS NOT THE FIRST FIVE SHOWN') }
  show('2nd hurt'); delete p.inj; if (rotOrder(F, opts).map(x => x.i).join() !== o.join()) { bad++; console.log('  BACK FROM INJURY: NOT IN HIS PLACE') } }
// a reload keeps it all
const G = N.unpackNba(N.packNba(F))
const o2 = rotOrder(G, opts).map(p => p.i)
if (o2.join() !== o.join()) { bad++; console.log('  RELOAD CHANGED THE ORDER') }
// DNP: a man set to 0 minutes can't start and doesn't play (a starter set to DNP goes to the bench; swapped back into
// the five his DNP comes off)
{
  const minsIn = id => { let m = 0, n = 0; for (let k = 0; k < 12; k++) { const g = F.sched.find(x => x.hs == null && (x.h === F.team || x.a === F.team)); const r = N.CAP_SIM.simGame(F, g.h, g.a, { seed: `dnp-${k}` }); m += r.box[F.team].find(l => l.i === id)?.min ?? 0; if (r.box[F.team].find(l => l.i === id)?.st) n++ } return [m, n] }
  // (his own order, a starter set to DNP)
  o = show('before DNP')
  const star = o[0]
  T.min = { ...(T.min ?? {}), [star]: 0 }; benchDnp(F, opts)
  o = show('1st set to DNP')
  if (o.slice(0, 5).includes(star)) { bad++; console.log('  DNP: STILL IN THE FIVE') }
  if (st().split(',').includes(String(star))) { bad++; console.log('  DNP: THE SIM STARTS HIM') }
  if (st() !== o.slice(0, 5).sort().join()) { bad++; console.log('  DNP: STARTERS NOT THE FIRST FIVE SHOWN') }
  let [m, n] = minsIn(star)
  if (m || n) { bad++; console.log(`  DNP: HE PLAYED ${m} MINUTES, STARTED ${n} OF 12`) }
  // (swapped back into the five: a starter again, with minutes)
  swapRot(F, star, o[1], opts); o = show('DNP man swapped into the five')
  if (!o.slice(0, 5).includes(star) || T.min?.[star] === 0 || dnpStarter(F, opts) != null) { bad++; console.log('  DNP: SWAPPED IN BUT STILL DNP') }
  ;[m, n] = minsIn(star)
  if (n !== 12 || m < 12 * 20) { bad++; console.log(`  SWAPPED IN: STARTED ${n} OF 12, ${m} MINUTES`) }
  // (the coach's order, the best man set to DNP)
  T.rot = null; T.min = { [star]: 0 }
  o = show('coach order, DNP on a starter')
  if (o.slice(0, 5).includes(star) || st().split(',').includes(String(star))) { bad++; console.log('  COACH ORDER: A DNP MAN STARTS') }
  ;[m, n] = minsIn(star)
  if (m || n) { bad++; console.log(`  COACH ORDER DNP: HE PLAYED ${m} MINUTES, STARTED ${n}`) }
  // (a save from before the rule: a DNP man stored in the five is benched when the screen opens)
  T.rot = rotOrder(F, opts).map(p => p.i); T.rot = [star, ...T.rot.filter(i => i !== star)]; T.min = { [star]: 0 }
  if (dnpStarter(F, opts) !== star) { bad++; console.log('  OLD SAVE: NOT SEEN') }
  ;[m, n] = minsIn(star)
  if (m || n) { bad++; console.log(`  OLD SAVE: THE SIM PLAYED HIM ${m} MINUTES`) }
  benchDnp(F, opts)
  if (dnpStarter(F, opts) != null || rotOrder(F, opts).slice(0, 5).some(p => p.i === star)) { bad++; console.log('  OLD SAVE: NOT BENCHED') }
  T.rot = null; T.min = null
}
console.log(bad ? `FAIL ${bad}` : 'OK: swaps exact, starters the first five, min kept, reload same, a DNP man never starts or plays')
if (bad) process.exit(1)
