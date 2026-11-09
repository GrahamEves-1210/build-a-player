// One season, printed: node scripts/cfb/smoke.mjs [pos] [team] [seed]
import { loadCFB } from './load.mjs'
const [pos = 'qb', teamShort = 'UGA', seed = 'smoke-1'] = process.argv.slice(2)
const { vite, sim, usingFixture } = await loadCFB()
try {
  const types = sim.CFB_TYPES_BY_POS[pos]
  const build = Object.fromEntries(types.map(t => [t, { type: t, val: 9 }]))
  const t0 = Date.now()
  const r = sim.runCFBSimulation(build, types, teamShort, pos, seed, 'classic')
  console.log('fixture:', usingFixture.join(',') || 'none', '| ms', Date.now() - t0)
  console.log(r.team.name, r.ovr, r.archetype, `${r.wins}-${r.losses}`, 'conf', `${r.cfb.record.confW}-${r.cfb.record.confL}`)
  for (const g of r.games) console.log(` ${g.meta.label.padEnd(8)} ${g.home ? 'vs' : g.neutral ? 'n.' : '@ '} ${(g.meta.oppRank ? '#' + g.meta.oppRank + ' ' : '') + g.opponent}`.padEnd(40), g.won ? 'W' : 'L', `${g.mySc}-${g.oppSc}${g.ot ? ' OT' : ''}`.padEnd(9), sim.CFB_GAME_LINE[pos](g))
  for (const g of r.cfb.postseason) console.log(` ${g.label.padEnd(36)} ${g.opponent.padEnd(18)} ${g.won ? 'W' : 'L'} ${g.mySc}-${g.oppSc}`, sim.CFB_GAME_LINE[pos](g))
  console.log('AP path:', r.cfb.apPath.map(p => p.rank ?? '-').join(' '))
  console.log('CFP field:', r.cfb.playoff.field.map(f => `${f.seed}.${f.short}`).join(' '), '| champ', r.cfb.playoff.champion)
  console.log('totals full:', JSON.stringify(r.cfb.totals.full))
  const h = r.cfb.awards.heisman
  console.log('Heisman:', h.ballot.slice(0, 6).map(b => `${b.name} (${b.team}) ${b.pts}`).join(' | '))
  for (const k of ['daveyOBrien', 'doakWalker', 'biletnikoff', 'maxwell', 'walterCamp']) console.log(k, r.cfb.awards[k].winner?.name, r.cfb.awards[k].userWon ? '(USER)' : '')
  console.log('All-America user:', r.cfb.awards.allAmerica.user, '| all-conf:', r.cfb.awards.allConference?.user, '| POY', r.cfb.awards.confPOY?.winner?.name)
  console.log('Draft:', JSON.stringify(r.cfb.draft))
  console.log('bowls:', r.cfb.bowls.length, 'size KB', Math.round(JSON.stringify(r).length / 1024))
} finally { await vite.close() }
