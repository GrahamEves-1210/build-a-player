// A FULL save from before a change, read back after it (2026-11-17, Franchise LIGHT): the same franchise saved at three
// points (mid-season with a key moment waiting, free agency's second day, draft night), then each one read back and
// played on the same way to the next season's Week 3. The digest of where each one ends must not change.
//   bash scripts/franchise2/run.sh scripts/franchise2/save-compat.mjs write <file.json>   (with the code before)
//   bash scripts/franchise2/run.sh scripts/franchise2/save-compat.mjs check <file.json>   (with the code after)
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'
import { readFileSync, writeFileSync } from 'fs'

const mode = process.argv[2] ?? 'check', file = process.argv[3] ?? 'save-compat.json'
FR.useContracts(CONTRACTS)
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen'), wr = WRS.find(p => p.attrs && p.name === 'Puka Nacua') ?? WRS.find(p => p.attrs)
const load = s => FR.depthOnLoad(FR.upgradeSave(FR.unpackFranchise(s)))
const pack = F => { const at = F.at; F.at = 0; const s = FR.packFranchise(F); F.at = at; return s }
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 } return h.toString(16) }

// the same steps every time, from wherever the save is (FULL's own calls, the way sim.mjs makes them)
function step(F) {
  if (F.phase === 'season') {
    if (F.pend) { while (F.pend) FR.finishMoment(F, null); return }
    if (F.ev) { FR.chooseEvent(F, F.wk % 2); return }
    const r = FR.playWeek(F, { moments: true })
    if (r.pending) while (F.pend) FR.finishMoment(F, null)
    return
  }
  if (F.phase === 'post') { if (!FR.intoPlayoffs(F)) FR.simPlayoffs(F); return }
  if (F.phase === 'playoffs') { const r = FR.playWeek(F, { moments: true }); if (r.pending) while (F.pend) FR.finishMoment(F, null); return }
  if (F.phase === 'done') { FR.closeSeason(F); return }
  if (F.stage === 'coaches') { FR.closeCarousel(F); return }
  if (F.stage === 'awards') { FR.ageLeague(F); FR.openResign(F); return }
  if (F.stage === 'resign') {
    for (const id of [...F.rs]) { const p = F.teams[F.team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? (p.o >= 80 ? 'option' : 'decline') : p.b != null || p.o >= 76) }
    FR.openFA(F); return
  }
  if (F.stage === 'fa') {
    if (F.fad) { const p = FR.faBoard(F, 8).find(x => FR.canSign(F, x.$) && x.o >= 78); if (p) FR.placeBid(F, p.i, p.$); FR.nextFADay(F) } else FR.openDraft(F)
    return
  }
  if (F.stage === 'draft') {
    if (F.dr.ph === 'pre') { FR.startNight(F); return }
    if (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F); return }
    FR.closeDraft(F); FR.newSeason(F)
  }
}
const until = (F, f) => { for (let g = 0; g < 400 && !f(F); g++) step(F); if (!f(F)) throw new Error('stuck') }
const endOf = F => F.year === 2027 && F.phase === 'season' && F.wk >= 3
const digest = F => ({ year: F.year, wk: F.wk, nid: F.nid, rec: FR.recText(FR.records(F)[F.team]), champ: F.hist.map(h => `${h.y}:${h.fin}:${h.w}-${h.l}`).join(','), dh: (F.dh ?? []).map(d => d.picks.map(p => p.n).join('/')).join(';'), lh: F.lh?.map(h => h.champ).join(','), hash: hash(pack(F)), size: pack(F).length })

if (mode === 'write') {
  const F = FR.createFranchise({ seed: 'compat-DEN', team: 'DEN', owner: 'Graham', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 12 }, { pos: 'wr', build: asBuild(wr), name: 'Tre Holloway', num: 81 }], coach: { name: 'Isaiah Vance', style: 'developer', r: { talentDev: 7, offPlaycalling: 8, defPlaycalling: 5, culture: 6, situational: 6 }, ovr: 78 } })
  F.games = 'advanced'
  const saves = {}
  // 1. mid-season, a key moment waiting (the first week from Week 5 that stops on one)
  until(F, X => X.phase === 'season' && X.wk >= 4 && !X.ev && !X.pend)
  for (let g = 0; g < 14 && !F.pend && F.phase === 'season'; g++) { if (F.ev) FR.chooseEvent(F, 0); else FR.playWeek(F, { moments: true }) }
  saves.midSeason = { s: pack(F), at: `${F.year} wk ${F.wk + 1}${F.pend ? ' moment waiting' : ''}` }
  // 2. free agency, day 2
  until(F, X => X.phase === 'off' && X.stage === 'fa' && X.fad === 2)
  saves.freeAgency = { s: pack(F), at: `${F.year} FA day ${F.fad}` }
  // 3. draft night, in the 3rd round
  until(F, X => X.stage === 'draft' && X.dr?.ph === 'night' && X.dr.at >= 70)
  saves.draftNight = { s: pack(F), at: `${F.year} draft pick ${F.dr.at + 1}` }
  const out = {}
  for (const [k, v] of Object.entries(saves)) { const X = load(v.s); until(X, endOf); out[k] = { at: v.at, s: v.s, end: digest(X) } }
  writeFileSync(file, JSON.stringify(out))
  for (const [k, v] of Object.entries(out)) console.log(`${k} (${v.at}): ${JSON.stringify(v.end)}`)
  console.log(`wrote ${file}`)
} else {
  const saved = JSON.parse(readFileSync(file, 'utf8'))
  let bad = 0
  for (const [k, v] of Object.entries(saved)) {
    const X = load(v.s)
    if (X.pace) { bad++; console.log(`  !! ${k}: an old save read back with a pace (${X.pace})`) }
    until(X, endOf)
    const d = digest(X)
    const same = JSON.stringify(d) === JSON.stringify(v.end)
    if (!same) bad++
    console.log(`${k} (${v.at}): ${same ? 'same' : `DIFFERENT\n   was ${JSON.stringify(v.end)}\n   now ${JSON.stringify(d)}`}`)
  }
  console.log(bad ? `${bad} PROBLEMS` : 'OK: every old FULL save plays on exactly as before')
}
