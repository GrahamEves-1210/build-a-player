// The league's wire and the hub's ticker over a season and a half, headless.
//   bash scripts/franchise2/run.sh scripts/franchise2/wire-check.mjs [seasons=2] [team=CIN]
// Checks: the wire carries the league's news in every phase (IR moves and season-enders for notable men, playoff
// results, the Super Bowl, signings, releases, retirements, the draft and its trades, milestones and records); the
// ticker is current (nothing older than two weeks in the season, nothing from the season once it's over, no
// practice-squad signings, at most two consensus-board lines and never a slide down the board); the log stays small.
import * as FR from '../../src/lib/franchise2/index'
import { tickerItems, wire, NEWS_MAX } from '../../src/lib/franchise2/news'
import { draftNews } from '../../src/lib/franchise2/draft'

const N = Number(process.argv[2] ?? 2), team = process.argv[3] ?? 'CIN'
const F = FR.createFranchise({ seed: 'wire-' + team, team, owner: 'Graham', builds: [], coach: { name: 'Coach', scheme: 'balanced', style: 'developer' } })
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const kinds = list => { const m = {}; for (const x of list) m[x.tag] = (m[x.tag] ?? 0) + 1; return Object.entries(m).map(([k, v]) => `${k} ${v}`).join(' · ') }
const seen = {}
const look = (label, want = []) => {
  const w = wire(F, { n: 60 }), t = tickerItems(F).filter(x => x.k === 'news'), d = draftNews(F)
  for (const x of w) seen[x.tag] = (seen[x.tag] ?? 0) + 1
  console.log(`${label}: wire ${w.length} (${kinds(w)}) · ticker ${t.length} · draft lines ${d.length}`)
  for (const k of want) if (!w.some(x => x.tag === k)) bad(`${label}: no ${k} on the wire`)
  if (t.some(x => /practice squad/i.test(x.text))) bad(`${label}: a practice-squad signing on the ticker`)
  if (d.length > 2 || d.some(x => / DOWN TO /.test(x.text))) bad(`${label}: consensus-board spam ${d.map(x => x.text)}`)
  const stale = (F.news ?? []).filter(x => t.some(y => y.text === x.text) && x.y === F.year && !x.ph && F.phase === 'season' && x.wk < F.wk - 2)
  if (stale.length) bad(`${label}: stale ticker items ${stale.map(x => x.text).slice(0, 2)}`)
  if ((F.news?.length ?? 0) > NEWS_MAX) bad(`${label}: ${F.news.length} items kept`)
  return { w, t }
}
for (let y = 0; y < N; y++) {
  while (F.phase === 'season') {
    FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0)
    if ([2, 9, 17].includes(F.wk)) look(`${F.year} week ${F.wk}`, F.wk >= 9 ? ['IR'] : [])
  }
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') FR.playWeek(F, { moments: false })
  const { t } = look(`${F.year} after the Super Bowl`, ['SUPER BOWL', 'PLAYOFFS'])
  if (t.some(x => /RESTRUCTURE/i.test(x.tag) || /restructure/i.test(x.text))) bad('a week-1 restructure on the ticker after the Super Bowl')
  FR.closeSeason(F)
  FR.closeCarousel?.(F)
  FR.ageLeague(F)
  FR.openResign(F); for (const id of [...F.rs]) FR.resignOne(F, id, true)
  FR.openFA(F); while (F.fad) FR.nextFADay(F)
  look(`${F.year} free agency done`, ['SIGNED', 'RETIRED'])
  FR.openDraft(F); FR.startNight(F)
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft(F)
  look(`${F.year} after the draft`, ['DRAFT'])
  FR.newSeason(F)
  look(`${F.year} opening week`, ['DRAFT'])
  const json = FR.packFranchise(F)
  console.log(`   save ${(json.length / 1024).toFixed(0)} KB · news kept ${F.news.length} (${(JSON.stringify(F.news).length / 1024).toFixed(1)} KB)`)
}
console.log(`over the run: ${Object.entries(seen).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
for (const k of ['IR', 'INJURY', 'MILESTONE', 'SIGNED', 'RELEASED', 'RETIRED', 'DRAFT', 'TRADE', 'PLAYOFFS', 'SUPER BOWL']) if (!seen[k]) bad(`never on the wire: ${k}`)
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: no problems')
