// NBA Franchise, headless: a save made before the 2026-11-24 league round (no F.wv, no F.rec.fr, retired rows without
// rc / num, the wire in its old styles) loads, upgrades and plays on: a season, the awards, the records, a summer.
//   FR_TMP=<scratch> bash scripts/franchise2/run.sh scripts/franchise2/nba-oldsave.mjs <old-save.json>
// (make the file with the older code: createNbaFranchise, a few seasons, fs.writeFileSync(path, packNba(F)))
import * as N from '../../src/lib/franchise2/nba/index'
import { hallOfFamer, RECORD_ROWS } from '../../src/lib/franchise2/nba/awards'
import fs from 'node:fs'
const bad = []
const flag = m => { bad.push(m); console.log('  !! ' + m) }
const F = N.upgradeNba(N.unpackNba(fs.readFileSync(process.argv[2], 'utf8')))
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
while (F.phase === 'off') {
  if (F.off.step === 'resign') for (const i of [...(F.off.mine ?? [])]) N.resignMine(F, i, true)
  if (F.off.step === 'camp') { const T = F.teams[F.team]; while (T.r.filter(p => !p.tw).length > 15) N.CAP_SIM.cutMan(F, F.team, T.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0].i); for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) } }
  N.nextStep(F)
}
const fresh = F.retired.filter(r => r.y === F.year - 1)
console.log(`  retired this summer ${fresh.length}: ${fresh.filter(r => r.k).slice(0, 5).map(r => `${r.n} ${r.yrs} seasons${r.rc ? ' (real career counted)' : ''}${r.num != null ? ` #${r.num}` : ''}`).join('; ')}`)
if (fresh.some(r => !(r.yrs > 0) || !Array.isArray(r.t))) flag('a retired row without seasons or totals')
for (const n of F.news.filter(n => n.k === 'retire' && n.y === F.year - 1).slice(0, 4)) console.log('   ' + n.text)
const J = N.unpackNba(N.packNba(F))
if (JSON.stringify(J.rec) !== JSON.stringify(F.rec) || J.retired.length !== F.retired.length) flag('pack/unpack changed the books')
console.log(bad.length ? `${bad.length} problems` : 'no problems')
if (bad.length) process.exit(1)
