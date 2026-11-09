// Every record the season shows against the games actually played by then: node scripts/cfb/record-check.mjs [N=200]
// AP polls and CFP rankings (by week), the CFP field (Selection Day), the standings (regular season,
// selection, final) and the build's own record. Any mismatch is printed and the script exits 1.
import { loadCFB } from './load.mjs'

const N = +(process.argv[2] || 200)
const { vite, sim } = await loadCFB()
let bad = 0, checked = 0
const fail = (msg) => { if (bad++ < 25) console.log('MISMATCH', msg) }
const wl = rec => rec.split('-').map(Number)
try {
  const L = sim.cfbLeague()
  // each team's regular-season games, and how many it had played before each calendar week
  const reg = {}, before = {}
  for (const t of L.teams) {
    const gs = L.schedule.byTeam[t.short] ?? []
    reg[t.short] = gs.length
    before[t.short] = w => gs.filter(g => g.week < w).length
  }
  const teams = ['OSU', 'BOIS', 'MIA', 'UGA', 'NDAM', 'TEX', 'JMU', 'TOL']
  const POS = ['qb', 'rb', 'wr']
  for (let i = 0; i < N; i++) {
    const team = teams[i % teams.length], pos = POS[i % 3]
    const types = sim.CFB_TYPES_BY_POS[pos]
    const v = [3, 5, 7, 9, 10][i % 5]
    const b = Object.fromEntries(types.map(t => [t, { type: t, val: v }]))
    const r = sim.runCFBSimulation(b, types, team, pos, `rec-${i}`, 'classic')
    const c = r.cfb
    // postseason games each team played after the title games
    const ccg = new Set(), post = {}
    for (const st of c.standings) if (st.title) { ccg.add(st.title.a); ccg.add(st.title.b) }
    for (const g of c.playoff.games) for (const s of [g.hi, g.lo]) post[s] = (post[s] ?? 0) + 1
    for (const g of c.bowls) for (const s of [g.a, g.b]) post[s] = (post[s] ?? 0) + 1
    const sel = s => reg[s] + (ccg.has(s) ? 1 : 0)
    // polls and rankings: never more games than had been played that week
    for (const [kind, list] of [['AP', c.ap], ['CFP', c.cfpRankings]]) {
      for (const p of list) {
        for (const e of p.top25) {
          const [w, l] = wl(e.rec)
          const max = p.label === 'Final' ? sel(e.short) + (post[e.short] ?? 0)
            : p.week >= 15 ? sel(e.short) : before[e.short](Math.max(0, p.week))
          checked++
          if (p.label === 'Final' ? w + l !== max : p.week >= 15 ? w + l !== max : w + l > max) fail(`${kind} ${p.label} ${e.short} ${e.rec} (games by then: ${max})`)
        }
      }
    }
    // the CFP field: the Selection Day record (regular season + title game), never more than 13 games
    for (const f of c.playoff.field) {
      const [w, l] = wl(f.rec), [fw, fl] = wl(f.final)
      checked += 2
      if (w + l !== sel(f.short) || w + l > 13) fail(`field ${f.short} rec ${f.rec} (selection games ${sel(f.short)})`)
      if (fw + fl !== sel(f.short) + (post[f.short] ?? 0)) fail(`field ${f.short} final ${f.final}`)
    }
    // standings: regular season, selection, final; conference records without the title game
    for (const st of c.standings) {
      for (const t of st.teams) {
        const [sw, sl] = wl(t.selection), [fw, fl] = wl(t.final)
        checked += 4
        if (t.w + t.l !== reg[t.short]) fail(`standings ${t.short} ${t.w}-${t.l} (regular season ${reg[t.short]})`)
        if (sw + sl !== sel(t.short)) fail(`standings ${t.short} selection ${t.selection}`)
        if (fw + fl !== sel(t.short) + (post[t.short] ?? 0) || fw !== t.finalW || fl !== t.finalL) fail(`standings ${t.short} final ${t.final}`)
        if (t.confW + t.confL > reg[t.short]) fail(`standings ${t.short} conf ${t.confW}-${t.confL}`)
      }
    }
    // the build's own record
    const me = r.team.short
    const [mw, ml] = wl(c.record.final), [selW, selL] = wl(c.record.selection)
    checked += 3
    if (c.record.w + c.record.l !== r.games.length || c.record.w !== r.wins) fail(`build ${me} regular ${c.record.w}-${c.record.l}`)
    if (selW + selL !== r.games.length + (c.confChampionship ? 1 : 0)) fail(`build ${me} selection ${c.record.selection}`)
    if (mw + ml !== r.games.length + c.postseason.length || mw !== r.wins + c.postseason.filter(g => g.won).length) fail(`build ${me} final ${c.record.final}`)
  }
  console.log(`${N} seasons, ${checked} records checked: ${bad ? `${bad} MISMATCHES` : 'all match the games played by then'}`)
  if (bad) process.exitCode = 1
} finally { await vite.close() }
