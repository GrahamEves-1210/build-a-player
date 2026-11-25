// NBA Franchise, headless: a save made before the 2026-11-24 league round (no F.wv, no F.rec.fr, retired rows without
// rc / num, the wire in its old styles) loads, upgrades and plays on: a season, the awards, the records, a summer.
//   FR_TMP=<scratch> bash scripts/franchise2/run.sh scripts/franchise2/nba-oldsave.mjs [old-save.json]
// With no file it makes the old save itself: three seasons and sixty days with today's code, then taken back to the
// old shape (oldShape below: what the round added is stripped, the wire put back in its old styles, a real man's
// retired row cut to his seasons in the save). With a file (one packed by older code: createNbaFranchise, a few
// seasons, fs.writeFileSync(path, packNba(F))) it reads that instead.
import * as N from '../../src/lib/franchise2/nba/index'
import { hallOfFamer, RECORD_ROWS } from '../../src/lib/franchise2/nba/awards'
import { REAL_CAREER, REAL_THROUGH } from '../../src/lib/franchise2/nba/realCareers'
import fs from 'node:fs'
function autoSummer(F) {
  while (F.phase === 'off') {
    if (F.off.step === 'resign') for (const i of [...(F.off.mine ?? [])]) N.resignMine(F, i, true)
    if (F.off.step === 'camp') { const T = F.teams[F.team]; while (T.r.filter(p => !p.tw).length > 15) N.CAP_SIM.cutMan(F, F.team, T.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0].i); for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) } }
    N.nextStep(F)
  }
}
// today's save taken back to the shape the code before the round wrote
function oldShape(F) {
  // the wire: no version, half the items without their period, a bare matchup line, a hire's second item, "Jr.."
  delete F.wv
  F.news.forEach((n, j) => { if (j % 2) n.text = n.text.replace(/\.$/, '') })
  const jr = F.news.find(n => /Jr\./.test(n.text)); if (jr) jr.text = jr.text.replace(/Jr\.(?!\.)/, 'Jr..')
  F.news.unshift({ d: F.day, y: F.year, k: 'po', tag: 'NBA FINALS', text: 'Rockets-76ers' })
  F.news.unshift({ d: null, y: F.year, k: 'coach', tag: 'STAFF', text: 'Jordan Ott leaves the Suns bench to become head coach of the Kings' })
  // the books: no franchise book, career marks from the save's seasons only
  if (F.rec) { delete F.rec.fr; for (const k in F.rec.career ?? {}) F.rec.career[k] = { ...F.rec.career[k], v: Math.round(F.rec.career[k].v * 0.15) } }
  // the retired list: no real careers, no numbers, the seasons counted a year short
  let cut = 0
  for (const r of F.retired ?? []) {
    delete r.num
    if (!r.rc) continue
    const c = REAL_CAREER[r.n], here = Math.max(0, (r.y ?? REAL_THROUGH) - REAL_THROUGH)
    delete r.rc
    if (!c) continue
    r.t = [r.t[0] - c[2], r.t[1] - c[4], r.t[2] - c[5], r.t[3] - c[6]]
    r.yrs = c[1] + here - 1
    cut++
  }
  // what else the round put on the league
  delete F.sit; delete F.lotH; delete F.thin
  if (F.as?.g) delete F.as.g.pts
  for (const s of N.SHORTS) { delete F.teams[s].a2h; for (const p of F.teams[s].r) delete p.nt }
  for (const e of F.trl ?? []) delete e.k
  return cut
}
let raw
if (process.argv[2]) raw = fs.readFileSync(process.argv[2], 'utf8')
else {
  const O = N.createNbaFranchise({ seed: 'old-save', team: 'BOS', owner: 'Graham' })
  for (let y = 0; y < 3; y++) { N.simTo(O, O.days); N.startPostseason(O); N.simPostseason(O); N.closeSeason(O); autoSummer(O) }
  N.simTo(O, 60)
  const cut = oldShape(O)
  raw = N.packNba(O)
  console.log(`made an old-shape save: ${O.team} ${O.year} day ${O.day}, ${(raw.length / 1024).toFixed(0)} KB, ${cut} real men's retired rows cut to their seasons in the save`)
}
const bad = []
const flag = m => { bad.push(m); console.log('  !! ' + m) }
const U = N.unpackNba(raw)
if (!process.argv[2] && (U.wv || U.rec?.fr || U.retired.some(r => r.rc || r.num != null))) flag("the old-shape save isn't old: it still carries the round's fields")
const F = N.upgradeNba(U)
if (F.wv !== 1) flag('the wire was not upgraded (F.wv)')
console.log(`loaded ${F.team} ${F.year} day ${F.day}: news ${F.news.length}, retired ${F.retired.length}, rec ${Object.keys(F.rec ?? {}).join(',')}`)
const style = n => /[.!?]["')\]]?$/.test(n.text) && !/[A-Za-z]\.\.(?!\.)/.test(n.text)
if (!F.news.every(style)) flag(`wire items not in the one style: ${F.news.filter(n => !style(n)).slice(0, 3).map(n => n.text).join(' | ')}`)
const NICK = '[A-Z0-9][A-Za-z0-9]*(?: [A-Z][a-z]+)?'
if (F.news.some(n => n.k === 'po' && new RegExp(`^${NICK}-${NICK}(?:, ${NICK}-${NICK})*\\.?$`).test(n.text))) flag('a bare matchup line is still on the wire')
if (F.news.some(n => / bench to become head coach of the /.test(n.text))) flag("a coaching hire's second item is still on the wire")
const hall0 = F.retired.filter(hallOfFamer).map(r => r.n)
console.log('  the Hall off the old rows:', hall0.join(', ') || 'nobody')
const lbj = F.retired.find(r => r.n === 'LeBron James')
if (lbj) { console.log('  LeBron James, retired before the upgrade:', JSON.stringify(lbj)); if (!lbj.rc || lbj.t[1] < 43440) flag("an old retired row didn't get the real career") }
N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F); N.closeSeason(F)
if (!F.rec?.fr || F.rec.fr.s !== F.team) flag('no franchise book after the season')
for (const b of ['game', 'season', 'career']) for (const [k] of RECORD_ROWS[b]) { const x = F.rec[b][k]; if (!x || !(x.v > 0) || !x.n) flag(`league ${b} ${k} missing`) }
console.log('  career points:', JSON.stringify(F.rec.career.pts), '| franchise season ppg:', JSON.stringify(F.rec.fr.season.ppg))
if (F.rec.career.pts.v < 30000) flag("the career points record doesn't count the real seasons")
autoSummer(F)
const fresh = F.retired.filter(r => r.y === F.year - 1)
console.log(`  retired this summer ${fresh.length}: ${fresh.filter(r => r.k).slice(0, 5).map(r => `${r.n} ${r.yrs} seasons${r.rc ? ' (real career counted)' : ''}${r.num != null ? ` #${r.num}` : ''}`).join('; ')}`)
if (fresh.some(r => !(r.yrs > 0) || !Array.isArray(r.t))) flag('a retired row without seasons or totals')
for (const n of F.news.filter(n => n.k === 'retire' && n.y === F.year - 1).slice(0, 4)) console.log('   ' + n.text)
const J = N.unpackNba(N.packNba(F))
if (JSON.stringify(J.rec) !== JSON.stringify(F.rec) || J.retired.length !== F.retired.length) flag('pack/unpack changed the books')
console.log(bad.length ? `${bad.length} problems` : 'no problems')
if (bad.length) process.exit(1)
