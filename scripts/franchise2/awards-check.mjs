// The season's awards over many simulated seasons: who wins each one by position, whether the rookie awards go to
// the league's real rookies (year one: the real 2026 class from nfl-contracts.json; later: the drafted classes) as
// well as the player's own builds, and the Coach of the Year line. The NFL's own awards are the test:
//   MVP almost always a quarterback · OPOY an elite QB, RB or WR (never a tight end or a lineman in its history)
//   DPOY an edge rusher, a lineman or a linebacker with the big numbers, now and then a corner or safety
//   OROY / DROY the same logic among the first-year men · COY a big turnaround or a record well past what was expected
//   bash scripts/franchise2/run.sh scripts/franchise2/awards-check.mjs [franchises=10] [seasons=6]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'

// (every other franchise has no builds of its own: year one's rookie awards are then the real class's to win)
const NF = Number(process.argv[2] ?? 10), NS = Number(process.argv[3] ?? 6)
FR.useContracts(CONTRACTS)
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const TEAMS = ['DEN', 'TEN', 'KC', 'NYJ', 'DET', 'CAR', 'SF', 'MIA', 'CLE', 'LAR', 'GB', 'HOU']
const tally = {}, problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const add = (k, v) => { tally[k] ??= {}; tally[k][v] = (tally[k][v] ?? 0) + 1 }
const spot = (F, w) => { const p = F.teams[w.t]?.r.find(x => x.i === w.i); return p ? (p.p === 'dl' ? FR.groupOf(p) : p.p === 'db' ? FR.groupOf(p) : p.p) : w.p }
const coyLines = []
let seasons = 0
const t0 = Date.now()
for (let f = 0; f < NF; f++) {
  const team = TEAMS[f % TEAMS.length]
  const qb = QBS.find(p => p.name === 'Josh Allen'), wr = WRS.find(p => p.attrs && p.name === 'Puka Nacua')
  const F = FR.createFranchise({ seed: `awards-${f}`, team, owner: 'Graham', builds: f % 2 ? [] : [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Hale', num: 7 }, { pos: 'wr', build: asBuild(wr), name: 'Dre Collins', num: 11 }], coach: { name: 'Coach Reyes', style: 'developer', r: { talentDev: 7, offPlaycalling: 7, defPlaycalling: 5, culture: 6, situational: 6 } } })
  if (f === 0) {
    const rk = FR.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.rk === F.year && p.b == null).map(p => `${p.n} ${s} ${p.p}`))
    console.log(`year one: ${rk.length} real rookies on the rosters (e.g. ${rk.slice(0, 6).join(', ')})`)
    if (rk.length < 20) bad(`only ${rk.length} real rookies flagged in year one`)
  }
  for (let y = 0; y < NS; y++) {
    while (F.phase === 'season') { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
    FR.intoPlayoffs(F)
    while (F.phase === 'playoffs') FR.playWeek(F, { moments: false })
    FR.closeSeason(F)
    const aw = F.aw
    seasons++
    for (const k of FR.AWARD_KEYS) {
      const w = aw[k]
      if (!w) { add(k, '(none)'); continue }
      add(k, spot(F, w).toUpperCase())
      if (k === 'oroy' || k === 'droy') {
        const p = F.teams[w.t]?.r.find(x => x.i === w.i)
        add(k + ':who', p?.b != null ? 'a build' : p?.dr ? 'a drafted rookie' : 'a real rookie')
        if (y === 0) add(k + ':y1', p?.b != null ? 'a build' : 'a real rookie')
      }
      if (k === 'opoy' && /TE|OL/.test(spot(F, w).toUpperCase())) console.log(`   ${F.year} OPOY ${w.n} ${w.p} ${w.line}`)
    }
    if (aw.coy) { add('coy:jump', aw.coy.w - aw.coy.was >= 4 ? 'up 4+ wins' : aw.coy.w - aw.coy.was >= 2 ? 'up 2-3' : 'up 1 or less'); if (coyLines.length < 6) coyLines.push(FR.coyLine ? FR.coyLine(aw.coy) : `${aw.coy.n} ${aw.coy.was} WINS TO ${aw.coy.w}`) }
    if (y === 0 && f < 3) console.log(`  ${F.year} ${team}: ` + FR.AWARD_KEYS.map(k => aw[k] ? `${k.toUpperCase()} ${aw[k].n} (${aw[k].t} ${spot(F, aw[k]).toUpperCase()}, ${aw[k].line})` : `${k.toUpperCase()} -`).join(' · '))
    // the rest of the offseason, quickly
    FR.closeCarousel(F)
    FR.ageLeague(F); FR.openResign(F)
    for (const id of [...F.rs]) { const p = F.teams[team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? (p.o >= 80 ? 'option' : 'decline') : p.b != null || p.o >= 76) }
    FR.openFA(F); while (F.fad) FR.nextFADay(F)
    FR.openDraft(F); FR.startNight(F)
    while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
    FR.closeDraft(F); FR.autoCamp(F); FR.newSeason(F)
  }
}
console.log(`\n${seasons} seasons (${NF} franchises x ${NS}) in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
for (const [k, v] of Object.entries(tally)) console.log(`${k.toUpperCase().padEnd(10)} ` + Object.entries(v).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(' · '))
console.log('COY lines: ' + coyLines.join(' | '))
const share = (k, f) => Object.entries(tally[k] ?? {}).filter(([p]) => f(p)).reduce((a, [, n]) => a + n, 0) / seasons
if (share('mvp', p => p === 'QB') < 0.75) bad('MVP: a quarterback less than 3 times in 4')
if (share('opoy', p => p === 'TE' || p === 'OL') > 0.04) bad('OPOY: a tight end or lineman more than 1 time in 25')
if (share('opoy', p => ['QB', 'RB', 'WR'].includes(p)) < 0.95) bad('OPOY: not a QB, RB or WR')
if (share('dpoy', p => ['EDGE', 'DT', 'LB'].includes(p)) < 0.7) bad('DPOY: a front-seven man less than 7 times in 10')
if (share('oroy:y1', p => p === 'a real rookie') + share('droy:y1', p => p === 'a real rookie') === 0) bad('year one: no real rookie won a rookie award')
if (share('droy', p => p === '(none)') > 0.1 || share('oroy', p => p === '(none)') > 0.1) bad('a rookie award with no winner')
for (const l of coyLines) if (!/^[A-Z][^,]+, [A-Z][a-z0-9]+: \d+-\d+(-\d+)?, (up from|down from|the same as|after) /.test(l)) bad(`COY line reads oddly: ${l}`)
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: no problems')
