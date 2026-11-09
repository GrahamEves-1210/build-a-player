// CFB engine check: N seasons per (position × build tier × team), averages, plus league-wide realism and the
// same-seed check. Run: node scripts/cfb/sim-test.mjs [N=500] [teams=OSU,BOIS] [positions=qb,rb,wr]
import { loadCFB } from './load.mjs'

const N = +(process.argv[2] || 500)
const TEAMS = (process.argv[3] || 'OSU,BOIS').split(',')
const POSITIONS = (process.argv[4] || 'qb,rb,wr').split(',')
const { vite, sim, usingFixture } = await loadCFB()
// builds: every trait at the tier's grade, pinned to the data (src/data/cfb-players.js grades): elite alternates
// A/A+ (9/10, a Heisman contender), good = A- (8), average = B (6: the median real QB1 is 81 OVR, an all-6 build
// is 80), poor = C+ (4)
const TIERS = { elite: i => (i % 2 ? 10 : 9), good: () => 8, average: () => 6, poor: () => 4 }
const buildOf = (types, f) => Object.fromEntries(types.map((t, i) => [t, { type: t, val: f(i), qbFull: 'test', team: 'X' }]))
const avg = (rows, f) => rows.reduce((s, r) => s + f(r), 0) / rows.length
const pct = (rows, f) => `${Math.round(avg(rows, r => (f(r) ? 1 : 0)) * 1000) / 10}%`
const pad = (s, n) => String(s).padEnd(n)
try {
  console.log(`data: ${usingFixture.length ? 'FIXTURE ' + usingFixture.join(',') : 'real src/data/cfb-*'} · ${N} seasons per row`)
  const L = sim.cfbLeague()
  for (const t of TEAMS) { const x = L.byShort[t]; console.log(`${t}: ${x.name}, ${x.confShort}, FPI ${x.fpi}, o ${x.o.toFixed(1)} d ${x.d.toFixed(1)}`) }

  // ── determinism ──
  const b0 = buildOf(sim.CFB_TYPES_BY_POS.qb, TIERS.good)
  const a1 = JSON.stringify(sim.runCFBSimulation(b0, null, 'OSU', 'qb', 'same-seed', 'classic'))
  const a2 = JSON.stringify(sim.runCFBSimulation(b0, null, 'OSU', 'qb', 'same-seed', 'classic'))
  const a3 = JSON.stringify(sim.runCFBSimulation(b0, null, 'OSU', 'qb', 'other-seed', 'classic'))
  console.log(`same seed → same season: ${a1 === a2 ? 'YES' : 'NO'} · different seed differs: ${a1 !== a3 ? 'YES' : 'NO'} · result ${Math.round(a1.length / 1024)} KB`)
  // the director's pattern: a fixed league seed, the build's seed changing
  const d1 = sim.runCFBSimulation(b0, null, 'OSU', 'qb', 'dir-a', 'classic', null, { leagueSeed: 'L1' })
  const d2 = sim.runCFBSimulation(b0, null, 'OSU', 'qb', 'dir-b', 'classic', null, { leagueSeed: 'L1' })
  const otherGames = r => r.cfb.standings.filter(s => s.id !== 'bigten').map(s => s.teams.map(t => t.w).join(',')).join('|')
  console.log(`leagueSeed fixed: other conferences' regular seasons identical across build seeds: ${d1.cfb.ap[0].top25.map(x => x.short).join() === d2.cfb.ap[0].top25.map(x => x.short).join() ? 'preseason YES' : 'preseason NO'}`)
  // finalize with the games as played
  const fin = sim.finalizeCFBSeason(d1, d1.games.map((g, i) => (i === 3 ? { ...g, won: !g.won, mySc: g.oppSc, oppSc: g.mySc } : g)))
  console.log(`finalizeCFBSeason: wins ${d1.wins} → ${fin.wins} after flipping game 4; lines kept: ${fin.games[0].passYds === d1.games[0].passYds ? 'YES' : 'NO'}`)
  // a script (Squad Builder style): two builds share one season
  const sc = sim.scriptCFBSeason('OSU', 'squad-1')
  const s1 = sim.runCFBSimulation(buildOf(sim.CFB_TYPES_BY_POS.qb, TIERS.elite), null, 'OSU', 'qb', 'squad-1', 'classic', sc)
  const s2 = sim.runCFBSimulation(buildOf(sim.CFB_TYPES_BY_POS.wr, TIERS.poor), null, 'OSU', 'wr', 'squad-1', 'classic', sc)
  console.log(`scriptCFBSeason: script ${sc.wins}-${sc.losses}, QB build ${s1.wins}-${s1.losses}, WR build ${s2.wins}-${s2.losses}, same scores: ${s1.games.map(g => g.mySc).join() === s2.games.map(g => g.mySc).join() ? 'YES' : 'NO'}, same postseason: ${s1.cfb.postseason.map(g => g.mySc).join() === sc.postseason.map(g => g.mySc).join() ? 'YES' : 'NO'}`)

  // ── the table ──
  const t0 = Date.now(); let runs = 0
  const league = { ppg: [], sd: [], unbeaten: [], top10vsUnr: [0, 0], rankedVsUnr: [0, 0], home: [0, 0], g5cfp: 0, seasons: 0, fcs: [0, 0], ot: [0, 0] }
  for (const pos of POSITIONS) {
    const types = sim.CFB_TYPES_BY_POS[pos]
    console.log(`\n── ${pos.toUpperCase()} ──`)
    const head = pos === 'qb' ? 'pass yds  TD  INT  cmp%  eff   rush  rTD' : pos === 'rb' ? 'rush yds  TD   ypc  car  rec  recYd' : 'rec  rec yds  TD   ypr  tgt'
    console.log(`${pad('build', 14)}${pad('team', 6)}OVR  W-L        | full season: ${head}  | reg yds | CFP    bye    title  CCG-win Heis   HFin   AA1st  | draft (eligible JR)`)
    for (const [tier, f] of Object.entries(TIERS)) {
      for (const team of TEAMS) {
        const build = buildOf(types, f)
        const rows = []
        for (let i = 0; i < N; i++) {
          const r = sim.runCFBSimulation(build, types, team, pos, `${pos}-${tier}-${team}-${i}`, 'classic', null, { debug: i < 40 && pos === POSITIONS[0] && tier === 'average' })
          runs++
          rows.push(r)
          if (r._R) {
            const R = r._R, Lg = L
            league.seasons++
            // league scoring, home edge, OT, upsets (from the stored regular-season results)
            const pts = []
            for (const [key, st] of R.res) {
              if (!key.startsWith('g')) continue
              const g = Lg.schedule.games[0] && Lg.schedule.sorted.find(x => `g${x.id}` === key)
              pts.push(st.res.a.pts); if (st.j >= 0) pts.push(st.res.b.pts)
              if (st.j < 0) { league.fcs[0]++; if (st.res.a.pts > st.res.b.pts) league.fcs[1]++ }
              if (g && g.site !== 'n' && st.j >= 0) { league.home[0]++; if ((g.site === 'a') === (st.res.a.pts > st.res.b.pts)) league.home[1]++ }
              if (st.j >= 0) { league.ot[0]++; if (st.res.ot) league.ot[1]++ }
            }
            const m = pts.reduce((a, b) => a + b, 0) / pts.length
            league.ppg.push(m); league.sd.push(Math.sqrt(pts.reduce((a, b) => a + (b - m) ** 2, 0) / pts.length))
            league.unbeaten.push(r.cfb.ap.find(p => p.label === 'Week 14').top25.filter(x => /^12-0$/.test(x.rec)).length)
            if (r.cfb.playoff.field.some(f => L.byShort[f.short].tier === 'G5')) league.g5cfp++
            // upsets: each week's poll vs the next week's results
            for (let w = 0; w < 14; w++) {
              const poll = R.polls[w]
              for (const g of Lg.schedule.sorted.filter(x => x.week === w)) {
                const st = R.res.get(`g${g.id}`); if (!st || st.j < 0) continue
                const ra = poll.rank.get(st.i), rb = poll.rank.get(st.j)
                const aWon = st.res.a.pts > st.res.b.pts
                if (ra && !rb) { league.rankedVsUnr[0]++; if (aWon) league.rankedVsUnr[1]++; if (ra <= 10) { league.top10vsUnr[0]++; if (!aWon) league.top10vsUnr[1]++ } }
                if (rb && !ra) { league.rankedVsUnr[0]++; if (!aWon) league.rankedVsUnr[1]++; if (rb <= 10) { league.top10vsUnr[0]++; if (aWon) league.top10vsUnr[1]++ } }
              }
            }
          }
        }
        const F = r => r.cfb.totals.full, Rg = r => r.cfb.totals.regular
        let stat
        if (pos === 'qb') stat = `${pad(Math.round(avg(rows, r => F(r).seasonPassYds)), 10)}${pad(avg(rows, r => F(r).seasonTDs).toFixed(1), 5)}${pad(avg(rows, r => F(r).seasonINTs).toFixed(1), 5)}${pad(avg(rows, r => F(r).seasonCompPct).toFixed(1), 6)}${pad(avg(rows, r => F(r).seasonEff).toFixed(0), 6)}${pad(Math.round(avg(rows, r => F(r).seasonRushYds)), 6)}${pad(avg(rows, r => F(r).seasonRushTDs).toFixed(1), 5)}`
        if (pos === 'rb') stat = `${pad(Math.round(avg(rows, r => F(r).seasonRushYds)), 10)}${pad(avg(rows, r => F(r).seasonRushTDs).toFixed(1), 5)}${pad(avg(rows, r => F(r).seasonYPC).toFixed(2), 6)}${pad(Math.round(avg(rows, r => F(r).seasonCarries)), 5)}${pad(avg(rows, r => F(r).seasonRecs).toFixed(0), 5)}${pad(Math.round(avg(rows, r => F(r).seasonRecYds)), 6)}`
        if (pos === 'wr') stat = `${pad(avg(rows, r => F(r).seasonRecs).toFixed(0), 5)}${pad(Math.round(avg(rows, r => F(r).seasonRecYds)), 9)}${pad(avg(rows, r => F(r).seasonRecTDs).toFixed(1), 5)}${pad(avg(rows, r => F(r).seasonYPR).toFixed(1), 6)}${pad(avg(rows, r => F(r).seasonTargets).toFixed(0), 5)}`
        const regY = pos === 'qb' ? avg(rows, r => Rg(r).seasonPassYds) : pos === 'rb' ? avg(rows, r => Rg(r).seasonRushYds) : avg(rows, r => Rg(r).seasonRecYds)
        const tiers = {}
        for (const r of rows) tiers[r.cfb.draft.tier] = (tiers[r.cfb.draft.tier] ?? 0) + 1
        const draft = ['top10', 'r1', 'day2', 'day3', 'pfa', 'udfa'].filter(k => tiers[k]).map(k => `${k} ${Math.round(tiers[k] / rows.length * 100)}%`).join(' ')
        console.log(`${pad(tier, 14)}${pad(team, 6)}${pad(rows[0].ovr, 5)}${pad(avg(rows, r => r.wins).toFixed(2) + '-' + avg(rows, r => r.losses).toFixed(2), 11)}| ${stat}| ${pad(Math.round(regY), 8)}| ${pad(pct(rows, r => r.playoffs), 7)}${pad(pct(rows, r => r.hasBye), 7)}${pad(pct(rows, r => r.champion), 7)}${pad(pct(rows, r => r.cfb.confChamp), 8)}${pad(pct(rows, r => r.cfb.awards.heisman.userWon), 7)}${pad(pct(rows, r => r.cfb.awards.heisman.userFinalist), 7)}${pad(pct(rows, r => r.cfb.awards.allAmerica.user === 'first'), 7)}| ${draft}`)
        const posAward = { qb: 'daveyOBrien', rb: 'doakWalker', wr: 'biletnikoff' }[pos]
        if (tier === 'elite' || tier === 'good') console.log(`${' '.repeat(20)}12-0 regular season ${pct(rows, r => r.wins === 12)} · ${posAward} ${pct(rows, r => r.cfb.awards[posAward].userWon)} · Maxwell ${pct(rows, r => r.cfb.awards.maxwell.userWon)} · Walter Camp ${pct(rows, r => r.cfb.awards.walterCamp.userWon)} · conf POY ${pct(rows, r => r.cfb.awards.confPOY?.userWon)} · all-conf 1st ${pct(rows, r => r.cfb.awards.allConference?.user === 'first')} · final AP top-10 ${pct(rows, r => (r.cfb.apPath.at(-1).rank ?? 99) <= 10)}`)
      }
    }
  }
  const ms = (Date.now() - t0) / runs
  console.log(`\n── league (from ${league.seasons} full seasons) ──`)
  console.log(`points a team-game ${(avg(league.ppg, x => x)).toFixed(1)} (SD ${avg(league.sd, x => x).toFixed(1)}) · home teams win ${(league.home[1] / league.home[0] * 100).toFixed(1)}% · OT ${(league.ot[1] / league.ot[0] * 100).toFixed(1)}% of FBS games · FBS beats FCS ${(league.fcs[1] / league.fcs[0] * 100).toFixed(1)}%`)
  console.log(`ranked beat unranked ${(league.rankedVsUnr[1] / league.rankedVsUnr[0] * 100).toFixed(1)}% · AP top-10 lose to unranked ${(league.top10vsUnr[1] / league.top10vsUnr[0] * 100).toFixed(1)}% · 12-0 teams a year ${avg(league.unbeaten, x => x).toFixed(2)} · a G5 team in the CFP ${Math.round(league.g5cfp / league.seasons * 100)}% (always: the G6 bid)`)
  console.log(`speed: ${ms.toFixed(1)} ms a season (${runs} seasons)`)
} finally { await vite.close() }
