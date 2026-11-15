// The scouting game and the draft, headless: the class, the media, scouting, the combine, seven rounds, trades.
//   bash scripts/franchise2/run.sh scripts/franchise2/draft.mjs [seasons=2] [team=DEN]
import * as FR from '../../src/lib/franchise2/index'
import { ovrOf, TYPES_OF } from '../../src/lib/squadSeason'
const N = Number(process.argv[2] ?? 2), team = process.argv[3] ?? 'DEN'
const F = FR.createFranchise({ seed: 'draft-' + team, team, owner: 'Graham', builds: [], coach: { name: 'Coach', scheme: 'balanced', style: 'developer' } })
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
const HX = '0123456789ab'
for (let y = 0; y < N; y++) {
  const t0 = performance.now()
  const dc = F.dc
  if (dc.length < 280) bad(`class ${dc.length}`)
  const pks = dc.map(x => x.pk).sort((a, b) => b - a)
  console.log(`${F.year} class ${dc.length}: pk top ${pks.slice(0, 5)} · #32 ${pks[31]} · #100 ${pks[99]} · #224 ${pks[223]} · rookie OVR mean ${avg(dc.map(x => x.o)).toFixed(1)} (max ${Math.max(...dc.map(x => x.o))})`)
  for (const x of dc) { const b = Object.fromEntries(TYPES_OF[x.p].map((t, j) => [t, { val: HX.indexOf(x.a[j]) }])); if (ovrOf(x.p, b) !== x.o) { bad(`ovr mismatch ${x.n}`); break } }
  // the season, scouting every week
  while (F.phase === 'season') {
    FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0)
    if (F.wk === 3) for (const x of FR.consensus(F).slice(0, 12)) FR.star(F, x.i)
    FR.autoScout(F)
  }
  FR.intoPlayoffs(F)
  const sl = FR.slateOf(F); console.log(`   slate in the playoffs: ${sl?.label} · ${sl?.games[0]?.xs.length} seniors`)
  while (F.phase === 'playoffs') { FR.playWeek(F, { moments: false }); FR.autoScout(F) }
  console.log(`   scouting used ${F.sc.u}, left ${FR.scoutsLeft(F)} · games attended ${F.sc.att.length} · board ${F.board.length}`)
  FR.runCombine(F)
  if (!F.sc.cmb) bad('combine did not run')
  const c = F.dc.map(x => ({ x, c: FR.combineOf(x) })).filter(e => e.c && !e.c.dnp)
  const fast = c.filter(e => e.c.f40).sort((a, b) => a.c.f40 - b.c.f40).slice(0, 5).map(e => `${FR.spotLabel(e.x)} ${e.c.f40}`)
  const byp = p => { const v = c.filter(e => e.x.p === p && e.c.f40).map(e => e.c.f40); return v.length ? `${p} ${Math.min(...v).toFixed(2)}-${Math.max(...v).toFixed(2)}` : '' }
  const bench = p => { const v = c.filter(e => e.x.p === p && e.c.bench).map(e => e.c.bench); return v.length ? `${p} bench ${Math.min(...v)}-${Math.max(...v)}` : '' }
  console.log(`   combine: fastest ${fast.join(', ')} · ${['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db'].map(byp).join(' · ')} · ${['ol', 'dl', 'wr'].map(bench).join(' · ')}`)
  for (const id of F.board.slice(0, 10)) FR.interview(F, id)
  const tags = { G: 0, B: 0, S: 0 }
  const top = FR.consensus(F).slice(0, 224)
  for (const x of top) tags[FR.tagOf(x.pk, FR.buzzOf(F, x))]++
  console.log(`   consensus top 224 by truth: GEM ${tags.G} BUST ${tags.B} SOLID ${tags.S} · media error ${avg(top.map(x => Math.abs(FR.buzzOf(F, x) - x.pk))).toFixed(1)}`)
  const views = F.dc.map(x => ({ x, v: FR.viewOf(F, x) }))
  const sc = views.filter(e => e.v.seen >= 6)
  console.log(`   our read on ${sc.length} well-scouted men: error ${avg(sc.map(e => Math.abs(e.v.my - e.x.pk))).toFixed(1)}; on the unscouted ${avg(views.filter(e => e.v.seen < 3).map(e => Math.abs(e.v.my - e.x.pk))).toFixed(1)}; truth inside our range ${(avg(views.map(e => (e.x.pk >= e.v.lo && e.x.pk <= e.v.hi) ? 1 : 0)) * 100).toFixed(0)}%`)
  for (const ex of sc.slice(0, 3)) { const r = FR.reportOf(F, ex.x); console.log(`   report ${ex.x.n} ${FR.spotLabel(ex.x)} ${FR.gradeOf(ex.v.my)}: ${r.lines.map(l => l.text).join(' ')} | ${r.char ?? ''} | ${r.bottom ?? ''} | COMP ${r.comp?.name ?? '-'} | ${FR.lineText(ex.x.p, FR.seasonLine(F, ex.x))}`) }
  const mock = FR.mockDraft(F, 6); console.log(`   mock: ${mock.map(m => `${m.at + 1} ${m.s} ${FR.spotLabel(F.dc.find(x => x.i === m.xi))}`).join(', ')}`)
  // the offseason, quickly, then the draft
  FR.closeSeason(F)
  FR.ageLeague(F)
  FR.openResign(F); for (const id of [...F.rs]) FR.resignOne(F, id, true)
  FR.openFA(F); for (let k = 0; k < 9 && !FR.nextFADay(F).done; k++);
  FR.openDraft(F)
  if (F.dr.order.length !== 32 || new Set(F.dr.order).size !== 32) bad('order')
  if (F.dr.order[31] !== F.po.champ) bad(`champ picks ${F.dr.order.indexOf(F.po.champ) + 1}`)
  FR.startNight(F)
  let ups = 0, downs = 0
  while (!FR.draftDone(F)) {
    FR.cpuPicks(F)
    if (FR.draftDone(F)) break
    const td = FR.tradeDownOffers(F)
    if (td.length && downs < 1 && FR.roundOf(F.dr.at) === 1) { if (FR.acceptTrade(F, td[0])) downs++; else bad('trade down refused'); continue }
    FR.autoPick(F)
    const tu = FR.tradeUpOffers(F)
    if (tu.length && ups < 1 && FR.roundOf(F.dr.at) === 2) { if (FR.acceptTrade(F, tu[0])) ups++; else bad('trade up refused') }
  }
  if (F.dr.picks.length !== FR.PICKS_N) bad(`picks ${F.dr.picks.length}`)
  if (new Set(F.dr.picks.map(p => p.pid)).size !== F.dr.picks.length) bad('dup picks')
  const rv = FR.draftReview(F)
  FR.closeDraft(F)
  const cpuTr = F.dr.tr.filter(t => !t.mine).length
  console.log(`   draft: ${F.dr.picks.length} picks, trades ${F.dr.tr.length} (league ${cpuTr}, ours up ${ups} down ${downs}) · our class ${rv.mine.map(p => `${p.at + 1}:${FR.pickSpot(p)} ${FR.gradeOf(p.pk)}/${p.my ? FR.gradeOf(p.my) : '-'}${p.tag !== 'S' ? ' ' + FR.TAG_TEXT[p.tag] : ''}`).join(', ')}`)
  console.log(`   scouting grade ${rv.grade} (err ${rv.myErr}) vs media ${rv.mediaGrade} (${rv.mediaErr}) · gems ${rv.gems.map(p => `${p.s}@${p.at + 1}`).join(' ')} · busts ${rv.busts.map(p => `${p.s}@${p.at + 1}`).join(' ')} · steal ${rv.steal?.n} (${rv.steal?.at + 1}) · league tags ${['G', 'B'].map(t => F.dr.picks.filter(p => p.tag === t).length).join('/')}`)
  const r1 = F.dr.picks.slice(0, 32); const pc = {}; for (const p of r1) pc[FR.pickSpot(p)] = (pc[FR.pickSpot(p)] ?? 0) + 1
  const man = k => F.teams[F.dr.picks[k].s].r.find(p => p.i === F.dr.picks[k].pid)
  console.log(`   first round: ${Object.entries(pc).map(([k, v]) => `${k} ${v}`).join(' · ')} · rookie deals: #1 $${man(0).$}M, #32 $${man(31).$}M, #100 $${man(99).$}M, #200 $${man(199).$}M`)
  const rt = FR.ratingsOf(man(0)); console.log(`   #1 ${man(0).n} ${FR.spotLabel(man(0))} o ${man(0).o} pk ${man(0).pk} ratings ${Object.values(rt).map(v => v.val).join(',')} nu ${man(0).nu} rc ${man(0).rc} op ${man(0).op}`)
  FR.newSeason(F)
  const json = FR.packFranchise(F), back = FR.unpackFranchise(json)
  if (JSON.stringify(back.dc[5]) !== JSON.stringify(F.dc[5])) bad('class pack')
  console.log(`   ${(performance.now() - t0).toFixed(0)} ms · save ${(json.length / 1024).toFixed(0)} KB (class ${(JSON.stringify(FR.packClass(F.dc)).length / 1024).toFixed(0)} KB)`)
}
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: no problems')
