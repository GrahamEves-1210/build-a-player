// Reads a league back the way a person would: a season and an offseason of headlines, transactions, front
// office items, the owner, one game's stops and log. For checking that the words sound like football.
//   bash scripts/franchise/run.sh scripts/franchise/read.mjs [team=DEN] [seed]
import * as FR from '../../src/lib/franchise/index'

const team = process.argv[2] ?? 'DEN'
let F = FR.createFranchise({ team, gmName: 'Graham', seed: process.argv[3] ?? 'read' })
const say = (h, lines) => { console.log(`\n== ${h}`); for (const l of lines) console.log('  ' + l) }
say('TEAM STATE', [JSON.stringify({ ...FR.teamState(F), staff: undefined, groups: undefined, ratings: undefined }).slice(0, 900)])
say('STAFF', [FR.staff(F).hc, FR.staff(F).oc, FR.staff(F).dc].map(c => `${c.roleName}: ${c.name} ${c.ovr} (${c.ratings.map(r => `${r.short} ${r.grade}`).join(' ')}) calls ${c.calls}`).concat(FR.staff(F).effects))
say('THIS WEEK', FR.weekTasks(F).map(t => `${t.title}: ${t.detail}`))
say('OWNER', FR.ownerView(F).goals.map(g => `${g.text} [${g.progress}]`))
// one game with its stops
F = FR.startGame(F, { mode: 'moments' })
const stops = []
for (let k = 0; k < 30; k++) {
  F = FR.nextStop(F)
  const s = FR.gameView(F).stop
  if (s.kind === 'final') { stops.push(`FINAL: ${s.result.text} Player of the game: ${s.potg.player.name}, ${s.potg.line}`); break }
  if (s.kind === 'call') { stops.push(`CALL (${s.type}): ${s.setup} ${s.options.map(o => `${o.label} ${o.oddsText}${o.staff ? '*' : ''} (${o.note})`).join(' | ')}`); F = FR.resolveStop(F, 'sim'); continue }
  stops.push(`MOMENT ${s.n} ${s.title} [${s.player.name}, ${s.player.slot}, v ${s.player.v}, odds ${s.odds}] ${s.situation.text} STAKES: ${s.stakes} WIN: ${s.win} LOSS: ${s.loss}`)
  F = FR.resolveStop(F, { win: k % 3 !== 1, score: 0.8 })
  stops.push(`    -> ${FR.gameView(F).stops.slice(-1)[0].text}`)
}
say('THE GAME', stops)
say('PLAY LOG (a stretch)', FR.gameView(F).log.slice(20, 44).map(p => `Q${p.q} ${Math.floor(p.clock / 60)}:${String(p.clock % 60).padStart(2, '0')} ${p.team} ${p.down}&${p.dist} @${p.spot} [${p.kind}${p.moment ? ' ' + p.moment : ''}${p.call ? ' call' : ''}] ${p.text}`))
const cast = FR.gameCast(F)
say('CAST', [`us.qb ${JSON.stringify(cast.us.qb[0])}`, `them.xi.def ${cast.them.xi.def.map(m => m?.short).join(', ')}`])
F = FR.finishGame(F)
const lw = FR.lastWeek(F)
say('LAST WEEK', [`${lw.label}: ${lw.user.won ? 'W' : 'L'} ${lw.user.us}-${lw.user.them}`, ...lw.injuries.slice(0, 6).map(i => `${i.name} (${i.team} ${i.slot}): ${i.what}, ${i.wk} wk`), ...lw.scores.slice(0, 4).map(g => `${g.away.short} ${g.as} @ ${g.home.short} ${g.hs} | ${g.top.join(' | ')}`)])
while (F.phase !== 'offseason') F = FR.autopilot(F, { until: 'week' })
say('HEADLINES (the season)', FR.news(F, 70).reverse().map(n => `wk${n.week} [${n.kind}] ${n.head}${n.body ? ' :: ' + n.body : ''}`))
say('TRANSACTIONS', FR.transactions(F, 40).reverse().map(t => `wk${t.week} [${t.type}] ${t.text}`))
const rv = FR.seasonReview(F)
say('REVIEW', [`Champion ${rv.champion.name}`, ...Object.entries(rv.awards).map(([k, a]) => `${k}: ${a?.name} (${a?.team.short}) ${a?.line}`), `Owner: ${rv.owner.verdict} (security ${rv.owner.security}, ${rv.owner.delta >= 0 ? '+' : ''}${rv.owner.delta})`, ...rv.owner.goals.map(g => `  ${g.done ? 'MET' : 'MISSED'}: ${g.text} [${g.progress}]`), ...rv.retirements.slice(0, 6).map(r => `Retired: ${r.name} ${r.pos} ${r.age} :: ${r.line}`)])
while (F.phase === 'offseason') {
  const o = FR.offseason(F)
  if (o.stage.id === 'resign') { const e = FR.expiring(F)[0]; if (e && !e.optionOnly) { F = FR.openTalks(F, e.id); F = FR.makeOffer(F, e.id, { years: e.ask.years, perYear: e.ask.perYear * 0.8, guaranteed: 0.3 }); console.log(`\n== TALKS ${e.name}: ask ${JSON.stringify(e.ask)} -> ${JSON.stringify(F.flash.talks.last)} patience ${F.flash.talks.patience} interest ${F.flash.talks.interest}`) } }
  if (o.stage.id === 'camp') say('CAMP', FR.campView(F).drills.map(d => `${d.title}: ${d.gameTitle} (${d.player.name}, v ${d.player.v})`))
  F = FR.advanceStage(F, { auto: true })
}
say('HEADLINES (the offseason)', FR.news(F, 60).reverse().filter(n => n.week === 0).map(n => `[${n.kind}] ${n.head}${n.body ? ' :: ' + n.body : ''}`))
say('NEW SEASON', [...FR.newSeason(F).changes.slice(0, 8).map(c => `${c.player.name} ${c.d > 0 ? '+' : ''}${c.d}: ${c.text}`), ...FR.ownerView(F).goals.map(g => g.text), JSON.stringify(FR.tradeAssets(F, F.team).picks.slice(0, 3).map(p => p.text))])
