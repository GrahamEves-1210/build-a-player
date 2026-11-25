// College Football's newer positions (TE, DL, DB): does a season read like a real one?
// Run: node scripts/cfb/new-pos-check.mjs [N=40] [teams=OSU,MIZ,BOIS]
//   (STUB_DIR=<dir> runs the DL/DB rows from stand-ins before src/data's are written: new-pos-load.mjs)
// For a spun TE, EDGE, DT, CB and S at three grades (every trait C+, B+, A+), N seasons each at each team:
//   1. HIS SEASON: the average line, the spread, next to real college benchmarks
//   2. THE LEAGUE: every FBS starter at the spot (the pool rows, regular season), by grade band, and the national leader
//   3. BOX SCORES: how often a big game happens (2- and 3-sack games, 2- and 3-INT games, 10-tackle games), halves
//   4. AWARDS: how often he wins each one, by grade; and who wins them (by spot) across all the seasons
//   5. THE DRAFT: his projection by grade; the board (first-rounders a class, DL / DB tiers)
//   6. HIS TEAM: wins with him at each grade (the same seeds), against a quarterback's effect
// Benchmarks (ESPN's FBS box scores 2025, the CFB engine's research notes): TE1 35-45 rec / 400-500 yds / 3-4 TD, the
// TE leader 70-90 rec / 900-1,100 yds · EDGE1 good 7-10 sacks, the leader 13-17 · DT 3-6 sacks, 8-12 TFL (a good
// one) · CB1 2-4 INT, 8-14 PD, the INT leader 6-8 · S1 60-90 tackles, 2-4 INT.
import { loadEngine } from './new-pos-load.mjs'

const N = +(process.argv[2] || 40)
const TEAMS = (process.argv[3] || 'OSU,MIZ,BOIS').split(',')
const { vite, sim, stubbed } = await loadEngine()
const GRADES = { low: 4, mid: 7, high: 10 }
const SPOTS = [['te', null], ['dl', 'edge'], ['dl', 'dt'], ['db', 'cb'], ['db', 's']]
const label = (pos, sub) => (sub ?? pos).toUpperCase()
const buildOf = (pos, val, sub) => Object.fromEntries(sim.CFB_TYPES_BY_POS[pos].map(t => [t, { type: t, val, qbFull: 'Check', team: 'X', ...(t === 'size' ? { subpos: sub ?? undefined } : {}) }]))
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0 }
const f1 = x => (Math.round(x * 10) / 10).toFixed(1)
const pct = (n, d) => `${d ? Math.round((n / d) * 1000) / 10 : 0}%`
const pad = (s, n) => String(s).padEnd(n)
const padL = (s, n) => String(s).padStart(n)

const KEYS = {
  te: [['rec', 'seasonRecs'], ['yds', 'seasonRecYds'], ['td', 'seasonRecTDs']],
  edge: [['sck', 'seasonSacks'], ['tfl', 'seasonTFL'], ['tk', 'seasonTackles'], ['qbh', 'seasonQBHits'], ['ff', 'seasonFF']],
  dt: [['sck', 'seasonSacks'], ['tfl', 'seasonTFL'], ['tk', 'seasonTackles'], ['qbh', 'seasonQBHits'], ['pd', 'seasonPD']],
  cb: [['int', 'seasonINTs'], ['pd', 'seasonPD'], ['tk', 'seasonTackles'], ['tfl', 'seasonTFL'], ['td', 'seasonDefTDs']],
  s: [['tk', 'seasonTackles'], ['int', 'seasonINTs'], ['pd', 'seasonPD'], ['tfl', 'seasonTFL'], ['sck', 'seasonSacks']],
}
const BENCH = {
  te: 'TE1 avg 35-45 rec / 400-500 yds / 3-4 TD; the best 70-100 rec; the TE leader 70-90 rec, 900-1,100 yds',
  edge: 'EDGE median 4 sck / 7 TFL / 33 tk (2025 boxes); a good EDGE1 7-10 sck; the national leader 13-17',
  dt: 'DT median 1.5 sck / 4 TFL / 33 tk (2025 boxes); a good DT 3-6 sck, 8-12 TFL',
  cb: 'CB median 1 INT / 6 PD / 45 tk (2025 boxes); a CB1 2-4 INT, 8-14 PD; the INT leader 6-8',
  s: 'S1 median 70 tk, 60-90 (2025 boxes), 1-3 INT; the best 100+',
}
const AWARDS = { te: ['mackey'], edge: ['bednarik', 'nagurski', 'hendricks'], dt: ['bednarik', 'nagurski', 'outland'], cb: ['bednarik', 'nagurski', 'thorpe'], s: ['bednarik', 'nagurski', 'thorpe'] }
const SHORT = { mackey: 'Mackey', bednarik: 'Bednarik', nagurski: 'Nagurski', hendricks: 'Hendricks', outland: 'Outland', thorpe: 'Thorpe' }

console.log(`data: ${stubbed.length ? `STUBS for ${stubbed.join(', ')}` : 'src/data'} · ${N} seasons a row · teams ${TEAMS.join(', ')}`)
const L = sim.cfbLeague()
for (const t of TEAMS) { const x = L.byShort[t]; console.log(`  ${t}: ${x.name}, ${x.confShort}, FPI ${x.fpi}, off ${x.o.toFixed(1)} def ${x.d.toFixed(1)}`) }

const winnersBySpot = {}   // award → { EDGE: n, … }
const heisPos = {}
const leaders = {}         // spot → [national leader's value, a season]
const poolLines = {}       // spot → band → [totals]
const poolGames = {}       // spot → [game lines]
const draftBoards = { dl: [], db: [], te: [] }
const userRows = []
let t0 = Date.now()
for (const [pos, sub] of SPOTS) {
  const sp = sub ?? pos
  for (const [g, val] of Object.entries(GRADES)) {
    for (const team of TEAMS) {
      for (let i = 0; i < N; i++) {
        const seed = `npc-${sp}-${g}-${team}-${i}`
        const r = sim.runCFBSimulation(buildOf(pos, val, sub), null, team, pos, seed, 'classic', null, { noClass: true, name: 'Guest', leagueSeed: `npc-league-${team}-${i}`, debug: true })
        const a = r.cfb.awards
        userRows.push({ sp, g, team, ovr: r.ovr, wins: r.wins, t: r.cfb.totals.full, reg: r.cfb.totals.regular, games: [...r.games, ...r.cfb.postseason], a, draft: r.cfb.draft, lead: r.cfb.leaders, champ: r.champion, cfp: !!r.cfb.cfpSeed })
        // the league around him (every pool row, regular season), once a league season (the mid builds)
        if (g === 'mid') {
          const pool = r.cfb.leaders?._pool ?? []
          for (const c of pool) {
            if (c.isUser) continue
            const s2 = pos === 'te' ? 'te' : c.sub
            if (s2 !== sp) continue
            const band = (c.ovr ?? 0) >= 92 ? 'A (92+)' : (c.ovr ?? 0) >= 84 ? 'B (84-91)' : 'C (<84)'
            ;((poolLines[sp] ??= {})[band] ??= []).push(c.t)
            if (i < 6) (poolGames[sp] ??= []).push(...c.reg)
          }
          for (const [k, key] of KEYS[sp].slice(0, 1)) {
            const top = pool.filter(c => !c.isUser && (pos === 'te' || c.sub === sp)).map(c => c.t[key]).sort((x, y) => y - x)[0]
            ;(leaders[sp] ??= []).push(top ?? 0)
          }
          for (const [k, x] of Object.entries(a)) if (x?.winner?.pos && ['bednarik', 'nagurski', 'thorpe', 'outland', 'hendricks', 'mackey'].includes(k)) { (winnersBySpot[k] ??= {})[x.winner.pos] = (winnersBySpot[k][x.winner.pos] ?? 0) + 1 }
          if (a.heisman?.winner) heisPos[a.heisman.winner.pos] = (heisPos[a.heisman.winner.pos] ?? 0) + 1
          if (r.cfb.draft?.board) draftBoards[pos].push(r.cfb.draft)
        }
      }
    }
  }
}
console.log(`(${userRows.length} seasons in ${Math.round((Date.now() - t0) / 1000)}s)\n`)

// ── 1. his season ──
console.log('══ 1. HIS SEASON (with the postseason), average [p10-p90], by grade ══')
for (const [pos, sub] of SPOTS) {
  const sp = sub ?? pos
  console.log(`\n${label(pos, sub)} · benchmark: ${BENCH[sp]}`)
  console.log(`  ${pad('grade', 10)}${pad('ovr', 5)}${pad('team', 6)}${pad('W', 6)}${KEYS[sp].map(([k]) => padL(k, 16)).join('')}`)
  for (const g of Object.keys(GRADES)) for (const team of TEAMS) {
    const rows = userRows.filter(x => x.sp === sp && x.g === g && x.team === team)
    console.log(`  ${pad(g, 10)}${pad(rows[0].ovr, 5)}${pad(team, 6)}${pad(f1(mean(rows.map(x => x.wins))), 6)}${KEYS[sp].map(([, key]) => { const v = rows.map(x => x.t[key] ?? 0); return padL(`${f1(mean(v))} [${q(v, 0.1)}-${q(v, 0.9)}]`, 16) }).join('')}`)
  }
}

// ── 2. the league ──
console.log('\n══ 2. THE LEAGUE: every FBS starter at the spot, regular season (12-13 games), by the player\'s grade ══')
for (const [pos, sub] of SPOTS) {
  const sp = sub ?? pos
  console.log(`\n${label(pos, sub)}`)
  for (const band of ['A (92+)', 'B (84-91)', 'C (<84)']) {
    const rows = poolLines[sp]?.[band] ?? []
    if (!rows.length) continue
    console.log(`  ${pad(band, 11)} n=${pad(rows.length, 6)}${KEYS[sp].map(([k, key]) => { const v = rows.map(t => t[key] ?? 0); return `${k} ${f1(mean(v))} [${q(v, 0.1)}-${q(v, 0.9)}]  ` }).join('')}`)
  }
  const all = Object.values(poolLines[sp] ?? {}).flat()
  const [k0, key0] = KEYS[sp][0]
  console.log(`  all starters: ${k0} median ${q(all.map(t => t[key0] ?? 0), 0.5)}, p90 ${q(all.map(t => t[key0] ?? 0), 0.9)} · national leader ${k0}: avg ${f1(mean(leaders[sp] ?? []))} [${Math.min(...(leaders[sp] ?? [0]))}-${Math.max(...(leaders[sp] ?? [0]))}]`)
  if (sp === 'te') { const rec = all.map(t => t.seasonRecs), yds = all.map(t => t.seasonRecYds); console.log(`  TE leader by yards: avg ${f1(mean(userRows.filter(x => x.sp === 'te' && x.g === 'mid').map(x => x.lead?.rows?.[0]?.value ?? 0)))} yds · TE1 median ${q(rec, 0.5)} rec, ${q(yds, 0.5)} yds`) }
  if (sp === 'cb' || sp === 's') { const iv = all.map(t => t.seasonINTs ?? 0); console.log(`  INT: median ${q(iv, 0.5)}, p90 ${q(iv, 0.9)}, max ${Math.max(...iv)}`) }
}

// ── 3. box scores ──
console.log('\n══ 3. BOX SCORES: how often a game has it ══')
const freq = (lines, f) => pct(lines.filter(f).length, lines.length)
for (const [pos, sub] of SPOTS.slice(1)) {
  const sp = sub
  const pg = poolGames[sp] ?? []
  const mine = g => userRows.filter(x => x.sp === sp && x.g === g).flatMap(x => x.games)
  const show = (who, lines) => console.log(`  ${pad(who, 22)}sck>=2 ${pad(freq(lines, l => l.sck >= 2), 7)}sck>=3 ${pad(freq(lines, l => l.sck >= 3), 7)}int>=2 ${pad(freq(lines, l => l.int >= 2), 7)}int>=3 ${pad(freq(lines, l => l.int >= 3), 7)}tk>=10 ${pad(freq(lines, l => l.tk >= 10), 7)}tk>=15 ${pad(freq(lines, l => l.tk >= 15), 7)}half sck ${pad(freq(lines.filter(l => l.sck), l => l.sck % 1 !== 0), 7)}whole tk ${lines.every(l => Number.isInteger(l.tk) && Number.isInteger(l.solo) && l.solo <= l.tk) ? 'yes' : 'NO'}  max sck ${Math.max(...lines.map(l => l.sck))} int ${Math.max(...lines.map(l => l.int))} tk ${Math.max(...lines.map(l => l.tk))}`)
  console.log(`\n${label(pos, sub)} (2025 real: EDGE sck>=2 5.3%, >=3 0.8% · DT 0.8% / 0.1% · CB int>=2 0.9%, >=3 0.06% · S tk>=10 9.6%, >=15 0.6%)`)
  show('league starters', pg)
  for (const g of Object.keys(GRADES)) show(`his games, ${g}`, mine(g))
}
// a game's sacks never more than the quarterback took, its INTs never more than he threw
{
  const r = sim.runCFBSimulation(buildOf('dl', 10, 'edge'), null, 'OSU', 'dl', 'npc-consistency', 'classic', null, { noClass: true, debug: true })
  const c = r._cands.filter(x => x.team === 'OSU' && (x.pos === 'dl' || x.pos === 'db'))
  const opp = r._cands.filter(x => x.pos === 'qb')
  console.log(`\nconsistency (Ohio State's defense, one season): its starters' sacks ${c.reduce((s, x) => s + x.t.seasonSacks, 0)}, INTs ${c.reduce((s, x) => s + x.t.seasonINTs, 0)} (the rest go to its linebackers); quarterbacks in the award field ${opp.length}`)
}

// ── 4. awards ──
console.log('\n══ 4. AWARDS: how often he wins, by grade (all teams) ══')
for (const [pos, sub] of SPOTS) {
  const sp = sub ?? pos
  for (const g of Object.keys(GRADES)) {
    const rows = userRows.filter(x => x.sp === sp && x.g === g)
    const n = rows.length
    const cols = [
      ...AWARDS[sp].map(k => `${SHORT[k]} ${pct(rows.filter(x => x.a[k]?.userWon).length, n)}`),
      `AA1 ${pct(rows.filter(x => x.a.allAmerica?.user === 'first').length, n)}`, `AA2 ${pct(rows.filter(x => x.a.allAmerica?.user === 'second').length, n)}`,
      `conf POY ${pct(rows.filter(x => x.a.confPOY?.userWon).length, n)}`, `all-conf 1st ${pct(rows.filter(x => x.a.allConference?.user === 'first').length, n)}`,
      `Heisman ${pct(rows.filter(x => x.a.heisman?.userWon).length, n)} (finalist ${pct(rows.filter(x => x.a.heisman?.userFinalist).length, n)})`,
    ]
    console.log(`  ${pad(label(pos, sub), 5)}${pad(g, 5)}${cols.join(' · ')}`)
  }
}
console.log('\nwho wins them (the league, mid-grade runs):')
for (const [k, v] of Object.entries(winnersBySpot)) { const tot = Object.values(v).reduce((a, b) => a + b, 0); console.log(`  ${pad(SHORT[k] ?? k, 10)}${Object.entries(v).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${pct(n, tot)}`).join(' · ')}`) }
{ const tot = Object.values(heisPos).reduce((a, b) => a + b, 0); console.log(`  ${pad('Heisman', 10)}${Object.entries(heisPos).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${pct(n, tot)}`).join(' · ')} (of ${tot})`) }

// ── 5. the draft ──
console.log('\n══ 5. THE DRAFT: his projection by grade ══')
const TIERS = ['top10', 'r1', 'day2', 'day3', 'pfa', 'udfa']
for (const [pos, sub] of SPOTS) {
  const sp = sub ?? pos
  for (const g of Object.keys(GRADES)) {
    const rows = userRows.filter(x => x.sp === sp && x.g === g)
    console.log(`  ${pad(label(pos, sub), 5)}${pad(g, 5)}${TIERS.map(t => `${t} ${pad(pct(rows.filter(x => x.draft?.tier === t).length, rows.length), 6)}`).join(' ')}  board rank avg ${f1(mean(rows.map(x => x.draft?.boardRank ?? 0)))} of ${f1(mean(rows.map(x => x.draft?.boardOf ?? 0)))}`)
  }
}
for (const pos of ['te', 'dl', 'db']) {
  const b = draftBoards[pos]
  if (!b.length) continue
  const top = b.flatMap(d => (d.board ?? []).filter(x => !x.isUser))
  const r1 = b.map(d => (d.board ?? []).filter(x => x.tier === 'top10' || x.tier === 'r1').length)
  const subs = {}
  if (pos !== 'te') for (const d of b) for (const x of (d.board ?? []).slice(0, 6)) { const p = sim.cfbLeague().players[pos].find(y => y.name === x.name && y.team === x.team); const k = x.isUser ? 'build' : p?.sub ?? '?'; subs[k] = (subs[k] ?? 0) + 1 }
  console.log(`  ${pos.toUpperCase()} board: ${f1(mean(b.map(d => d.boardOf ?? 0)))} in the class, first-rounders a class ${f1(mean(r1))}; the top six by spot ${Object.entries(subs).map(([k, n]) => `${k} ${n}`).join(', ')}; the No. 1 prospect's ${pos === 'dl' ? 'sacks / TFL' : pos === 'db' ? 'INT / PD' : 'yards / TD'} ${f1(mean(b.map(d => d.board?.[0]?.yds ?? 0)))} / ${f1(mean(b.map(d => d.board?.[0]?.td ?? 0)))}`)
}

// ── 6. his team ──
console.log('\n══ 6. HIS TEAM: wins (regular season) with him, the same seeds, low → high; his team shift in points a game ══')
for (const team of TEAMS) {
  const row = SPOTS.map(([pos, sub]) => {
    const sp = sub ?? pos
    const w = g => mean(userRows.filter(x => x.sp === sp && x.g === g && x.team === team).map(x => x.wins))
    return `${label(pos, sub)} ${f1(w('low'))} → ${f1(w('mid'))} → ${f1(w('high'))}`
  })
  // a quarterback's, for scale
  const qb = g => { let s = 0; for (let i = 0; i < N; i++) s += sim.runCFBSimulation(buildOf('qb', g, null), null, team, 'qb', `npc-qb-${team}-${i}`, 'classic', null, { noClass: true, leagueSeed: `npc-league-${team}-${i}`, lite: true }).wins; return s / N }
  console.log(`  ${pad(team, 6)}${row.join(' · ')} · QB ${f1(qb(4))} → ${f1(qb(7))} → ${f1(qb(10))}`)
}
for (const [pos, sub] of SPOTS) {
  const r = sim.runCFBSimulation(buildOf(pos, 10, sub), null, 'MIZ', pos, 'npc-shift', 'classic', null, { noClass: true, lite: true })
  const r2 = sim.runCFBSimulation(buildOf(pos, 4, sub), null, 'MIZ', pos, 'npc-shift', 'classic', null, { noClass: true, lite: true })
  console.log(`  ${pad(label(pos, sub), 5)}an A+ build at Missouri: ${r.cfb.user.teamShift > 0 ? '+' : ''}${r.cfb.user.teamShift} points a game over ${r.cfb.user.replaced}; a C+ ${r2.cfb.user.teamShift}`)
}
await vite.close()
