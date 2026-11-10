// The one-off mode's recruiting, transfer portal and later-season rosters, printed:
//   node scripts/cfb/offers-check.mjs
// A strong and a weak QB build: stars, rank, the ten offers; a great and a poor season's stock and the portal
// offers after it; season two and three rosters (who's left, empty rooms), and a season two played on them.
import { loadCFB } from './load.mjs'
const { vite, sim, data: D } = await loadCFB()
try {
  const R = await vite.ssrLoadModule('/src/components/cfb/cfbRecruit.js')
  const S = await vite.ssrLoadModule('/src/components/cfb/cfbShared.js')
  const data = { conferences: D['cfb-conferences'].CFB_CONFERENCES, teams: D['cfb-teams'].CFB_TEAMS, pools: { qb: D['cfb-players'].CFB_QBS, wr: D['cfb-players'].CFB_WRS, rb: D['cfb-players'].CFB_RBS } }
  const types = sim.CFB_TYPES_BY_POS.qb
  const school = s => data.teams.find(t => t.short === s)?.school ?? s
  const mk = v => Object.fromEntries(types.map(t => [t, { type: t, val: typeof v === 'function' ? v(t) : v, qbFull: 'X', team: 'cfb/UGA' }]))
  const builds = { strong: mk(t => (t === 'size' ? 6 : 10)), mid: mk(t => (t === 'size' ? 5 : 7)), weak: mk(t => (t === 'size' ? 4 : 5)) }
  for (const pos of ['qb', 'wr', 'rb']) console.log(pos, 'star lines', [91, 85, 80].map(() => '').length && JSON.stringify(R.collegeStars(data, pos, 0)), [70, 75, 80, 85, 88, 90, 92, 95].map(o => `${o}:${R.collegeStars(data, pos, o).stars}`).join(' '))
  for (const [k, b] of Object.entries(builds)) {
    const ovr = sim.calcCFBOVR(b, types, 'qb')
    const card = R.cardFor(data, data, 'qb', ovr)
    const offers = R.offersFor(data, { stars: card.stars, ovr, pos: 'qb', seed: `check-${k}`, n: 10 })
    console.log(`\n${k} build: OVR ${ovr} · ${card.stars} stars · No. ${card.posRank} of ${card.of} QBs`)
    console.log('  offers:', offers.map(o => `${school(o.short)} (T${o.tier}${o.starts ? ' starter' : ` vs ${o.bar?.name} ${o.bar?.ovr}`})`).join(', '))
    // a season at the first offer, then the portal
    let best = null, worst = null
    for (let i = 0; i < 30; i++) {
      const r = sim.runCFBSimulation(b, types, offers[0].short, 'qb', `chk-${k}-${i}`, 'classic', null, { name: 'Guest', noClass: true })
      const st = R.stockOf(r, r.team?.confShort)
      if (!best || st.pts > best.st.pts) best = { r, st }
      if (!worst || st.pts < worst.st.pts) worst = { r, st }
    }
    const next = S.seasonData(data, 1)
    for (const [lab, x] of [['great', best], ['poor', worst]]) {
      const c2 = R.cardFor(data, next, 'qb', ovr, x.st)
      const away = R.offersFor(next, { stars: c2.stars, ovr, pos: 'qb', seed: `portal-${k}-${lab}`, skip: [x.r.team.short], n: 10, lift: x.st.lift })
      console.log(`  ${lab} season at ${school(x.r.team.short)}: pts ${x.st.pts} move ${x.st.move} lift ${x.st.lift.toFixed(2)} · "${x.st.line}" · now ${c2.stars} stars (talent ${c2.base}), No. ${c2.posRank} of ${c2.of}`)
      console.log('    portal:', away.map(o => `${school(o.short)} (T${o.tier}${o.starts ? '' : ' compete'})`).join(', '))
    }
  }
  // the rosters a year on
  for (const k of [1, 2]) {
    const d = S.seasonData(data, k)
    const rooms = pos => { const per = {}; for (const p of d.pools[pos]) per[p.team] = (per[p.team] ?? 0) + 1; return data.teams.filter(t => !per[t.short]).length }
    const yrs = {}; for (const p of d.pools.qb) yrs[p.year] = (yrs[p.year] ?? 0) + 1
    console.log(`\nseason ${k + 1}: QB ${d.pools.qb.length} WR ${d.pools.wr.length} RB ${d.pools.rb.length} left · empty rooms QB ${rooms('qb')} WR ${rooms('wr')} RB ${rooms('rb')} · QB classes ${JSON.stringify(yrs)}`)
    const top = d.pools.qb.filter(p => p.depth === 1).sort((a, b) => b.ovr - a.ovr).slice(0, 6)
    console.log('  best QB1s:', top.map(p => `${p.name} ${school(p.team)} ${p.year} ${p.ovr}`).join(' | '))
    const r = sim.runCFBSimulation(builds.strong, types, 'UGA', 'qb', `s${k}`, 'classic', null, { name: 'Guest', noClass: true, pools: d.pools })
    const h = r.cfb.awards.heisman
    console.log('  Heisman finalists:', h.finalists.map(f => `${f.isUser ? 'Guest' : f.name} (${f.team}${f.year ? ' ' + f.year : ''})`).join(', '))
    const L = r.cfb.leaders ?? {}
    console.log('  draft board top 5:', (r.cfb.draft.board ?? []).slice(0, 5).map(x => `${x.isUser ? 'Guest' : x.name} ${x.year ?? ''}`).join(', '), '· Guest', r.cfb.draft.label)
    const gone = ['Trinidad Chambliss', 'Fernando Mendoza', 'Arch Manning', 'Julian Sayin']
    const all = JSON.stringify(r.cfb.awards)
    console.log('  departed in the awards?', gone.filter(n => all.includes(n)).join(', ') || 'none', '· leaders keys', Object.keys(L).slice(0, 4).join(','))
  }
  // the original rosters are untouched
  console.log('\nChambliss in the shared data:', data.pools.qb.find(p => p.name === 'Trinidad Chambliss')?.year)
} finally { await vite.close() }
