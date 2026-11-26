// Soccer Career's world (2026-11-24): node scripts/soccer/career-world-check.mjs
// The club money (purses by revenue, a player's value and wage), the window (who bids, when, the release clause, a
// relegation), Europe's places, the league table through a season, the second tier, the international game years on
// (aged squads, qualifying, the continental cycles, the call-up), Size, the break and January, and old saves.
import { build } from 'esbuild'
import { mkdirSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { tmpdir } from 'os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const outDir = join(process.env.SOCCER_TEST_OUT ?? tmpdir(), 'bap-soccer-test')
mkdirSync(outDir, { recursive: true })
const outfile = join(outDir, `world-${process.pid}.mjs`)
const store = new Map()
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: i => [...store.keys()][i] ?? null, get length() { return store.size } }
globalThis.window = globalThis; globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {}; globalThis.document = { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' }; globalThis.location = { search: '', hostname: 'localhost', href: 'http://localhost/' }
await build({
  stdin: { contents: `export * from './src/lib/career.js'\nexport * as SX from './src/lib/careerSoccer.js'\nexport * as INTL from './src/lib/soccerIntl.js'\nexport * as ENG from './src/utils/soccerSimulation.js'\nexport { SOCCER_CAREER_CLUBS } from './src/data/soccer-clubs.js'\nexport { CAREER_NATIONS, CONTINENTALS } from './src/data/soccer-nations.js'`, resolveDir: ROOT, loader: 'js' },
  bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error', loader: { '.jsx': 'jsx', '.json': 'json', '.png': 'empty', '.css': 'empty', '.webp': 'empty' },
  define: { 'import.meta.env': '{"DEV":false,"VITE_SUPABASE_URL":"http://localhost:1","VITE_SUPABASE_ANON_KEY":"x"}' },
})
const C = await import(pathToFileURL(outfile).href)
const { SX, INTL, ENG } = C
const S = C.SPORT.soccer, X = S.x, T = S.types.st
const errs = []
const say = (...a) => console.log(...a)
const ok = (cond, msg) => { if (!cond) errs.push(msg) }
const CLUB = new Map(C.SOCCER_CAREER_CLUBS.map(c => [c.short, c]))
const mkBuild = v => Object.fromEntries(T.map((t, i) => [t, { type: t, val: Array.isArray(v) ? v[i] : v, qb: 'Test', qbFull: 'Test Player', team: 'ARS', height: 73, weight: 172 }]))
const fresh = (lvl, team, nation = 'ENG', seed = null) => {
  let c = C.newCareer({ sport: 'soccer', pos: 'st', build: mkBuild(lvl), name: 'Test Nine', nation })
  if (seed) c = { ...c, seed }
  c = C.skipCombine(c)
  const d = C.runDraft(c)
  const o = d.draft.offers[0]
  return SX.signAcademy(d, { ...o, team, fit: C.teamFit(team, 'st', { name: c.name, sport: 'soccer' }) })
}
function playSeason(c, { stay = true, onStop = null } = {}) {
  let D; [c, D] = C.startSeason(c)
  for (let g = 0; g < 600; g++) {
    const a = c.active
    if (a.moment) { [c] = C.chooseMoment(c, D, a.moment.options[0]); continue }
    if (a.injury) { c = C.resolveInjury(c, D, false); if (Array.isArray(c)) c = c[0]; continue }
    if (a.k >= D.total) break
    if (onStop) { const r = onStop(c, D); if (r) [c, D] = r }
    const [n] = C.advanceWeek(c, D); if (n === c) { errs.push('season stuck'); break } c = n
  }
  c = C.finishRegular(c, D)
  for (let g = 0; g < 20 && c.active?.po && c.active.po.stage !== 'done'; g++) { c = C.playoffRound(c, 0.6, null, true); if (Array.isArray(c)) c = c[0] }
  if (c.phase !== 'offseason') c = C.bookSeason(c)
  return c
}
const next = c => C.nextSeason(c.offers?.length ? SX.stayPut(c) : c)

// ── 1. The clubs' money ──
{
  const p = s => X.purse(s)
  const order = ['RMA', 'MCI', 'FCB', 'ARS', 'TOT', 'NEW', 'BHA', 'BOU', 'IPS', 'SVE']
  for (let i = 1; i < order.length; i++) ok(p(order[i - 1]).wage > p(order[i]).wage, `purse: ${order[i - 1]} should pay more than ${order[i]}`)
  ok(p('RMA').fee > p('ARS').fee && p('ARS').fee > p('NEW').fee && p('NEW').fee > p('BHA').fee && p('BHA').fee > p('IPS').fee && p('IPS').fee > p('SVE').fee, 'purse: the fees')
  say('purses (top wage a week, record fee):', order.map(s => `${s} ${SX.wageText(p(s).wage, s).replace(' a week', '')}/${SX.feeText(p(s).fee, s)}`).join('  '))
  ok(p('BHA').wage < 9 && p('BOU').wage < 7 && p('IPS').wage < 6 && p('SVE').wage < 1.2, 'purse: a small club still pays like a giant')
  // a player's value: goals, minutes and the contract move it
  const base = { ovr: 86, age: 24, rep: 5, contract: { left: 3 }, seasons: [{ ovr: 86, size: 20, stats: { mins: 2900, lgGoals: 18 } }] }
  const v = more => SX.soccerValue({ ...base, ...more })
  const v0 = v({}), vBench = v({ seasons: [{ ovr: 86, size: 20, stats: { mins: 500, lgGoals: 3 } }] }), vCold = v({ seasons: [{ ovr: 86, size: 20, stats: { mins: 2900, lgGoals: 5 } }] }), vLast = v({ contract: { left: 1 } }), vOld = v({ age: 32 }), vKid = v({ age: 20 })
  say(`value, an 86 at 24: a regular with 18 goals €${v0}M · five goals €${vCold}M · a bench player €${vBench}M · a year left €${vLast}M · at 32 €${vOld}M · at 20 €${vKid}M`)
  ok(vBench < v0 * 0.7 && vCold < v0 && vLast < v0 * 0.7 && vOld < v0 * 0.5 && vKid > v0, 'value: goals, minutes, the contract and age should move it')
}

// ── 2. Europe's places ──
{
  const tbl = n => Array.from({ length: n }, (_, i) => ({ short: `T${i + 1}`, pos: i + 1 }))
  const at = (lg, n, cup) => { const pl = ENG.soccerEuropePlaces(lg, tbl(n), cup); return k => Object.entries(pl).filter(([, v]) => v === k).map(([s]) => s).join(',') }
  let f = at('eng.1', 20, 'T12'); say(`England, cup to 12th: UCL ${f('ucl')} · UEL ${f('uel')} · UECL ${f('uecl')}`)
  ok(f('ucl') === 'T1,T2,T3,T4,T5' && f('uel') === 'T6,T12' && f('uecl') === 'T7', 'Europe: England, a cup winner from mid-table')
  f = at('eng.1', 20, 'T2'); ok(f('uel') === 'T6,T7' && f('uecl') === 'T8', 'Europe: England, the cup won by a Champions League side')
  f = at('esp.1', 20, 'T9'); ok(f('ucl') === 'T1,T2,T3,T4' && f('uel') === 'T5,T9' && f('uecl') === 'T6', 'Europe: Spain')
  f = at('ger.1', 18, 'T1'); ok(f('ucl') === 'T1,T2,T3,T4' && f('uel') === 'T5,T6' && f('uecl') === 'T7', 'Europe: Germany')
  f = at('ita.1', 20, 'T6'); ok(f('uel') === 'T5,T6' && f('uecl') === 'T7', 'Europe: Italy, the cup won by sixth')
  f = at('fra.1', 18, null); ok(f('ucl') === 'T1,T2,T3' && f('uel') === 'T4,T5' && f('uecl') === 'T6', 'Europe: France')
}

// ── 3. A season: all five leagues, the table through it, the break, January ──
for (const [team, lg, games] of [['JUV', 'Serie A', 38], ['LYO', 'Ligue 1', 34], ['BHA', 'Premier League', 38], ['SEV', 'La Liga', 38], ['SGE', 'Bundesliga', 34]]) {
  let c = fresh(8, team, 'ENG', `world-${team}`)
  let tables = 0, sawBreak = false, sawJan = false
  c = playSeason(c, { onStop: (c, D) => {
    const a = c.active
    if (a.k > 0) {
      const t = X.table(c, D)
      if (!t) errs.push(`${team}: no table at match ${a.k}`)
      else {
        tables++
        const us = t.find(r => r.isUs), mine = D.games.slice(0, a.k)
        ok(t.length >= 18, `${team}: table has ${t.length} rows`)
        ok(t.every(r => r.played === a.k), `${team}: a club hasn't played ${a.k} at match ${a.k}`)
        ok(t.reduce((s, r) => s + r.wins, 0) === t.reduce((s, r) => s + r.losses, 0) && t.reduce((s, r) => s + r.gf, 0) === t.reduce((s, r) => s + r.ga, 0), `${team}: the table doesn't add up at match ${a.k}`)
        ok(us && us.wins === mine.filter(g => g.won).length && us.draws === mine.filter(g => g.drawn).length && us.points === us.wins * 3 + us.draws, `${team}: his club's row isn't its matches at ${a.k}`)
        ok(t.every((r, i) => r.pos === i + 1 && (i === 0 || t[i - 1].points >= r.points)), `${team}: the table is out of order at ${a.k}`)
      }
    }
    if (C.breakNow(c)) { sawBreak = true; const g = C.breakDrill(c); const n = g ? C.breakTrain(c, D, g, 0.9, true, true) : C.breakRest(c, D); ok(n.active.brk.done, `${team}: the break didn't book`); return [n, D] }
    if (C.januaryNow(c)) { sawJan = true; return [C.januaryStay(c, D), D] }
    return null
  } })
  const s = c.seasons.at(-1)
  const ft = X.tableOf(s)
  ok(s.league === lg && s.stats.lgApps <= games && (s.wins + s.draws + s.losses) === games, `${team}: ${s.league}, ${s.wins + s.draws + s.losses} matches`)
  ok(sawBreak && sawJan, `${team}: the break (${sawBreak}) and the January window (${sawJan}) should both stop the season`)
  ok(ft && ft.length === s.size && ft.find(r => r.isUs)?.pos === s.pos && ft.find(r => r.isUs)?.points === s.points, `${team}: the booked table and the season's place disagree`)
  ok(ft && ft.filter(r => r.zone === 'ucl').length >= 3 && ft.filter(r => r.zone === 'uecl').length === 1 && ft.filter(r => r.zone === 'down').length >= 2, `${team}: the table's zones`)
  ok(S.x.role && c.europe === (s.qualified ?? null), `${team}: next season's Europe`)
  say(`${team} (${s.league}): ${tables} tables read; finished ${s.pos} of ${s.size}, ${s.points} pts, ${s.stats.lgGoals} league goals; cup ${s.cupName}: ${s.cupResult}; Europe next: ${s.qualified ?? 'none'}; zones ${['ucl', 'uel', 'uecl', 'down'].map(z => `${z} ${ft.filter(r => r.zone === z).map(r => r.pos).join('/')}`).join(' · ')}`)
}

// ── 4. The Conference League, as his club's season ──
{
  let c = fresh(9, 'FUL', 'ENG', 'world-uecl')
  c = { ...c, europe: 'uecl', europeFor: 'FUL' }
  c = playSeason(c)
  const s = c.seasons.at(-1)
  say(`Conference League season at Fulham: ${s.europe?.name}: ${s.europe?.result}; rounds ${s.rounds.map(r => `${r.round} ${r.won ? 'W' : 'L'} ${r.mySc}-${r.oppSc}`).join(', ') || 'none'}`)
  ok(s.europe?.comp === 'uecl' && s.europe.name === 'Conference League', 'the Conference League season')
}

// ── 4b. A January move: he finishes the season at the new club; a January loan brings him back in the summer ──
for (const [from, to, kind] of [['BHA', 'FCB', 'bid'], ['SEV', 'BET', 'bid'], ['MCI', 'IPS', 'loan']]) {
  // (a season he isn't out injured in when January comes: the window doesn't stop for a man on the treatment table)
  let c = null, before = null, did = null
  for (let i = 0; i < 6 && !did; i++) {
  c = fresh(9, from, 'ENG', `world-jan-${to}-${i}`)
  before = c.contract
  c = playSeason(c, { onStop: (c, D) => {
    if (!C.januaryNow(c) || did) return null
    const o = { kind, ...(kind === 'loan' ? { half: true, perYear: c.contract.perYear, years: 1 } : { years: 4, perYear: 5, fee: 40 }), team: to, fit: C.teamFit(to, 'st', { name: c.name, sport: 'soccer' }) }
    const k = c.active.k
    const [n, D2] = C.januaryMove(c, D, o)
    did = { k, total: D2.total }
    ok(n.team === to && n.active.moved?.from === from && D2.games.slice(0, k).every((g, i) => g === n.active.snap.games[i] || g.mySc === D.games[i].mySc), `${from}->${to}: the move`)
    return [n, D2]
  } })
  }
  const s = c.seasons.at(-1), t = X.tableOf(s), row = t?.find(r => r.isUs)
  const lgGames = CLUB.get(to).league === 'ger.1' || CLUB.get(to).league === 'fra.1' ? 34 : 38
  ok(did && s.team === to && s.moved?.from === from && did.total === lgGames, `${from}->${to}: finished the season at ${s.team}, ${did?.total} matches`)
  ok(row && row.short === to && row.played === lgGames && row.pos === s.pos && row.wins === s.wins && row.points === s.points, `${from}->${to}: the new club's row in the table`)
  ok(t.reduce((a, r) => a + r.wins, 0) === t.reduce((a, r) => a + r.losses, 0), `${from}->${to}: the table adds up`)
  if (kind === 'loan') ok(c.team === from && !c.loan && c.contract.perYear === before.perYear, `${from}->${to}: back at ${c.team} after the loan`)
  else ok(c.team === to && c.contract.kind === 'transfer', `${from}->${to}: his club after the season`)
  say(`January ${kind === 'loan' ? 'loan' : 'move'} ${from} -> ${to} after match ${did?.k}: ${s.stats.lgApps} league apps, ${s.stats.lgGoals} goals; ${s.teamName} finished ${s.pos} of ${s.size}; next season at ${c.team}`)
}

// ── 4c. A January offer says where its club stands, and that is the table he finds there (the move's own run) ──
{
  let seen = 0, same = 0, tried = 0
  for (let i = 0; i < 40 && seen < 4; i++) {
    let c = fresh(i % 2 ? 9 : 7, i % 2 ? 'BHA' : 'MCI', 'ENG', `world-place-${i}`)
    if (i % 2) c = next(playSeason(c))
    let done = false
    playSeason(c, { onStop: (c, D) => {
      if (done || !C.januaryNow(c)) return null
      done = true; tried++
      const offers = C.januaryOffers(c)
      if (!offers.length) return null
      ok(offers.every(o => o.place?.pos >= 1 && o.place.league), `January: every offer should say where its club stands (${offers.map(o => o.team).join(', ')})`)
      const o = offers[0]
      const [n, D2] = C.januaryMove(c, D, o)
      if (n.team !== o.team) return null
      seen++
      const row = X.table(n, D2)?.find(r => r.isUs)
      if (row?.pos === o.place?.pos) same++
      return [n, D2]
    } })
  }
  say(`January offers with a place: ${seen} taken in ${tried} windows; the club's place after the move matched the offer's in ${same}`)
  ok(seen > 0 && same === seen, `January: the place an offer shows should be the new club's place after the move (${same} of ${seen})`)
}

// ── 5. The window ──
{
  // a star at a mid-table club, three seasons in: who comes for him, over many summers
  let c = fresh(10, 'BHA', 'ENG', 'world-win')
  c = playSeason(c)
  const star = { ...c, ovr: 96, age: 23, contract: { ...c.contract, kind: 'ext', left: 3, perYear: 6, noTrade: false, release: null }, seasons: [0, 1, 2].map(i => ({ ...c.seasons[0], year: i + 1, team: 'BHA', ovr: 96, pos: 7, size: 20, stats: { ...c.seasons[0].stats, goals: 30, lgGoals: 24, assists: 8, mins: 3000, avgRating: 7.5 } })) }
  const bidders = {}, both = {}
  let withBid = 0, N = 300
  for (let i = 0; i < N; i++) {
    const cc = { ...star, seed: `w${i}` }
    const offers = X.window(cc) ?? [], news = X.windowNews({ ...cc, off: {} }).off?.rejected ?? []
    if (offers.some(o => o.kind === 'bid')) withBid++
    for (const o of offers) if (o.kind === 'bid') { bidders[o.team] = (bidders[o.team] ?? 0) + 1; both[o.team] = (both[o.team] ?? 0) + 1; ok(o.perYear <= X.purse(o.team).wage + 0.01 && o.fee <= X.purse(o.team).fee, `window: ${o.team} bids past its purse`) }
    for (const x of news) both[x.team] = (both[x.team] ?? 0) + 1
  }
  const names = Object.entries(both).sort((a, b) => b[1] - a[1])
  say(`a 96 at Brighton, 24 league goals, three seasons in: a bid on the table in ${Math.round(withBid / N * 100)}% of summers; ${names.length} different clubs came in: ${names.slice(0, 14).map(x => x.join(' ')).join(', ')}`)
  ok(names.length >= 8, `window: only ${names.length} clubs ever bid for a star`)
  ok(['RMA', 'BAR', 'LIV', 'MCI', 'FCB', 'PSG', 'ARS'].filter(t => both[t]).length >= 6, 'window: the biggest clubs should all be in for a star')
  ok(withBid / N > 0.3 && withBid / N < 0.9, `window: a bid in ${withBid / N} of summers`)
  // the summer after a big move: rarely
  const moved = { ...star, team: 'ARS', roster: null, contract: { ...star.contract, kind: 'transfer', left: 5, perYear: 15 }, seasons: [...star.seasons.slice(0, 2), { ...star.seasons[2], team: 'ARS', pos: 2 }] }
  let after = 0
  for (let i = 0; i < N; i++) { const offers = X.window({ ...moved, seed: `m${i}` }) ?? []; if (offers.some(o => o.kind === 'bid')) after++ }
  say(`the summer after a transfer to Arsenal: a bid in ${Math.round(after / N * 100)}% of summers`)
  ok(after / N < 0.08, `window: a bid the summer after a big move in ${after / N} of summers`)
  // a smaller player: smaller clubs
  const small = { ...star, ovr: 79, age: 26, team: 'SVE', roster: null, contract: { ...star.contract, left: 2, perYear: 0.5 }, seasons: star.seasons.map(s => ({ ...s, team: 'SVE', ovr: 79, pos: 12, size: 18, stats: { ...s.stats, goals: 13, lgGoals: 12, mins: 2700, avgRating: 7 } })) }
  const sb = {}
  for (let i = 0; i < N; i++) for (const o of X.window({ ...small, seed: `s${i}` }) ?? []) if (o.kind === 'bid') { sb[o.team] = (sb[o.team] ?? 0) + 1; ok(o.perYear < 4, `window: ${o.team} offers a 79 ${o.perYear}M a year`) }
  const giants = ['RMA', 'BAR', 'MCI', 'FCB', 'PSG', 'LIV', 'ARS', 'MUN']
  say(`a 79 at Elversberg, 12 league goals: ${Object.keys(sb).length} clubs bid: ${Object.entries(sb).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x.join(' ')).join(', ')}`)
  ok(Object.keys(sb).length >= 5 && !giants.some(t => sb[t]), 'window: a giant bids for a 79')
  // the release clause: a bid at it triggers, and his club can't say no
  const clause = { ...star, contract: { ...star.contract, noTrade: true, release: 90 } }
  let trig = 0, rejectedWith = 0, bids = 0
  for (let i = 0; i < N; i++) {
    const cc = { ...clause, seed: `c${i}` }
    for (const o of X.window(cc) ?? []) if (o.kind === 'bid') { bids++; if (o.clause === 'release') { trig++; ok(o.fee === 90, `clause: triggered at ${o.fee}, not 90`) } }
    rejectedWith += (X.windowNews({ ...cc, off: {} }).off?.rejected ?? []).filter(x => X.purse(x.team).fee >= 90 && x.fee >= 83).length
  }
  say(`a €90M release clause (value €${SX.soccerValue(clause)}M): ${trig} of ${bids} bids triggered it; ${X.releaseText(clause)}`)
  ok(trig > bids * 0.5 && rejectedWith === 0, `clause: ${trig}/${bids} triggered, ${rejectedWith} turned down at the clause`)
  ok(SX.releaseFee(clause) === 90 && SX.releaseFee(star) == null, 'clause: releaseFee')
  // wages: the tester's cases
  const kid = { ...star, ovr: 85, age: 18, rep: 5, team: 'HUL', roster: null, contract: { ...star.contract, kind: 'rookie', left: 2, perYear: 0.5 }, seasons: [{ ...star.seasons[0], team: 'HUL', ovr: 85, pos: 16, stats: { ...star.seasons[0].stats, goals: 12, lgGoals: 10, mins: 2400 } }] }
  let top = 0
  for (let i = 0; i < 200; i++) for (const o of X.window({ ...kid, seed: `k${i}` }) ?? []) top = Math.max(top, o.perYear)
  say(`an 18-year-old 85: the best wage any club put to him in 200 summers: ${SX.wageText(top, 'ARS')}`)
  ok(top > 0 && top < 6, `wages: an 18-year-old 85 is offered ${top}M a year`)
}

// ── 6. Relegation: the clause, the sale, staying down ──
{
  let c = fresh(9, 'HUL', 'ENG', 'world-rel')
  c = playSeason(c)
  const s0 = c.seasons[0]
  // (the season booked again as a relegation: the offseason's own code)
  const down = (clause, seed) => {
    const base = { ...c, seed, phase: 'offseason', contract: { ...c.contract, left: 3, relClause: clause }, down: null, relegated: false, events: [] }
    const s = { ...s0, relegated: true, pos: 19 }
    const n = X.afterSeason({ ...base, seasons: [s] }, s)
    return { n, offers: X.window(n) ?? [] }
  }
  let withClause = 0, sold = 0, loans = 0, stays = 0
  const N = 200
  for (let i = 0; i < N; i++) {
    const a = down(true, `rc${i}`)
    ok(a.n.contract.left === 3 && a.n.down?.clause && a.n.down.fee > 0, 'relegation: the contract should run on, with the clause live')
    if (a.offers.length && a.offers.every(o => o.kind !== 'bid' || (o.clause === 'relegation' && o.fee === a.n.down.fee))) withClause++
    const b = down(false, `rn${i}`)
    ok(!b.n.down?.clause && b.n.contract.left === 3, 'relegation: no clause, no free agent')
    if (b.offers.some(o => o.kind === 'bid')) sold++
    if (b.offers.some(o => o.kind === 'loan')) loans++
    if (!b.offers.length) stays++
  }
  say(`relegated with a clause: bids at the clause's fee in ${withClause} of ${N}; without one: a sale on the table in ${sold}, a loan in ${loans}, nothing (he stays down) in ${stays}`)
  ok(withClause > N * 0.9 && sold > N * 0.4 && loans > N * 0.2 && stays > 0, 'relegation: the three ways out')
  // he stays: a season in the Championship, then back up (or not)
  const a = down(false, 'world-stay')
  let d = C.nextSeason(SX.stayPut({ ...a.n, offers: a.offers.length ? a.offers : null, off: { step: 'recap' } }))
  ok(X.isDown(d), 'staying down: c.down')
  let ups = 0, seasons = 0
  for (let y = 0; y < 4 && X.isDown(d); y++) {
    d = playSeason(d)
    const s = d.seasons.at(-1)
    seasons++
    const t = X.tableOf(s)
    say(`  ${s.league}: ${s.pos} of ${s.size}, ${s.wins}-${s.draws}-${s.losses}, ${s.stats.lgGoals} league goals in ${s.stats.lgApps}; ${s.promoted ? `promoted (${s.promotedHow})` : 'not promoted'}; honours counted: title ${s.champion}, boot ${s.allPro}`)
    ok(s.tier === 2 && s.league === 'Championship' && s.size === 24 && s.wins + s.draws + s.losses === 46 && t?.length === 24, `staying down: ${s.league}, ${s.size} clubs`)
    ok(!s.champion && !s.allPro && !s.relegated && s.qualified == null && !s.europe, 'staying down: no top-flight honours from the second tier')
    if (s.promoted) { ups++; ok(!X.isDown(d), 'promoted: back in the top flight') }
    d = next(d)
  }
  if (!X.isDown(d)) { d = playSeason(d); ok(d.seasons.at(-1).league === 'Premier League' && d.seasons.at(-1).size === 20, 'after promotion: the Premier League again') }
  say(`  ${seasons} season(s) down, promoted ${ups ? 'yes' : 'no'}`)
}

// ── 7. The international game, years on ──
{
  const seed = 'world-intl'
  const me = { short: 'ENG', ovr: 95, role: 'Starter' }
  for (const year of [2030, 2034, 2042]) {
    const W = INTL.worldCupOf(year, seed, me)
    const sq = W.nations.flatMap(n => INTL.nationSquad(n, year, seed).map(p => ({ ...p, n })))
    const oldest = sq.slice().sort((a, b) => b.age - a.age)[0]
    const real = sq.filter(p => p.espn != null || C.SPORT.soccer.x.castIndex.has(p.name)).length
    say(`World Cup ${year}: ${W.nations.length} nations, hosts ${W.hosts.join('/') || 'none'}; ${sq.length} players, ${real} of them today's (${Math.round(real / sq.length * 100)}%); oldest ${oldest.name} (${oldest.n}), ${oldest.age}; England in: ${W.in}`)
    ok(W.nations.length === 48 && new Set(W.nations).size === 48, `WC ${year}: ${W.nations.length} nations`)
    ok(oldest.age <= 37, `WC ${year}: ${oldest.name} is ${oldest.age}`)
    ok(!sq.some(p => /Cristiano Ronaldo|Lionel Messi|Luka Modri/.test(p.name)), `WC ${year}: a retired great is in a squad`)
    ok(W.nations.every(n => INTL.nationSquad(n, year, seed).length === 5), `WC ${year}: a squad isn't five`)
    ok(W.hosts.every(h => W.nations.includes(h)), `WC ${year}: a host didn't qualify`)
    const top = ['ESP', 'ENG', 'ARG', 'FRA', 'BRA', 'POR', 'GER', 'NED'].map(n => Math.round(INTL.nationIn(n, year, seed).ovr))
    ok(Math.min(...top) >= 76, `WC ${year}: a top nation fell to ${Math.min(...top)}`)
  }
  // who wins them: over many worlds the strong nations should
  const wins = {}
  const b = mkBuild(7)
  for (let i = 0; i < 40; i++) {
    const W = INTL.worldCupOf(2034, `ww${i}`, { short: 'USA' })
    if (!W.in) continue
    const r = ENG.runSoccerSimulation(b, T, { short: 'USA', field: W.field, usage: 0.8, age: 25 }, 'alltime', `ww${i}`)
    wins[r.worldChampion] = (wins[r.worldChampion] ?? 0) + 1
    ok(r.season === '2034' && r.games.length >= 3 && r.goldenBoot?.winner, 'WC 2034: the result')
    ok(!/Ronaldo|Messi/.test(r.goldenBoot?.winner?.name ?? ''), 'WC 2034: the Golden Boot went to a man of 45')
  }
  say(`World Cup 2034 winners over 40 worlds: ${Object.entries(wins).sort((a, b) => b[1] - a[1]).map(x => x.join(' ')).join(', ')}`)
  // the cycles
  const cyc = (n, y) => INTL.continentalOf(n, y)?.id ?? null
  ok(cyc('ENG', 2028) === 'euro' && cyc('ENG', 2032) === 'euro' && cyc('ENG', 2030) == null && cyc('ENG', 2029) == null, 'cycles: the Euros')
  ok(cyc('BRA', 2028) === 'copa' && cyc('USA', 2028) === 'copa' && cyc('USA', 2027) === 'gold' && cyc('USA', 2029) === 'gold', 'cycles: the Copa América and the Gold Cup')
  ok(cyc('NGA', 2027) === 'afcon' && cyc('NGA', 2028) === 'afcon' && cyc('NGA', 2032) === 'afcon' && cyc('NGA', 2030) == null, 'cycles: AFCON')
  ok(cyc('JPN', 2027) === 'asian' && cyc('JPN', 2031) === 'asian' && cyc('NZL', 2028) == null, 'cycles: the Asian Cup')
  for (const [n, y] of [['DEN', 2028], ['ARG', 2028], ['NGA', 2027], ['JPN', 2031], ['MEX', 2029]]) {
    const def = INTL.continentalOf(n, y), Tn = INTL.continentalField(def, y, seed, { short: n, ovr: 90, role: 'Starter' })
    const r = Tn.in ? ENG.runSoccerSimulation(b, T, { short: n, field: Tn.field, usage: 1, age: 25 }, 'alltime', `${seed}-${def.id}`) : null
    say(`${def.name} ${y}: ${Tn.nations.length} nations; ${n} ${Tn.in ? `in: ${r.finish}, ${r.goals} goals in ${r.apps}; won by ${r.worldChampion}` : 'did not qualify'}`)
    ok(Tn.nations.length === def.size && new Set(Tn.nations).size === def.size, `${def.id} ${y}: ${Tn.nations.length} nations`)
    if (r) ok(['Winners', 'Runners-up', 'Semi-finals', 'Quarter-finals', 'Round of 16', 'Group stage'].includes(r.finish) && r.games.length >= 3 && r.season === `${def.short} ${y}`, `${def.id} ${y}: finish ${r.finish}`)
  }
  // the nations a career can start with
  const picks = X.SOCCER_NATIONS.map(n => n.short)
  ok(['ITA', 'DEN', 'POL', 'NGA', 'WAL', 'IRL', 'SRB', 'ENG', 'BRA'].every(n => picks.includes(n)), 'nations: the big non-qualifiers can be picked')
  ok(C.CAREER_NATIONS.every(n => existsSync(join(ROOT, 'public', 'logos', 'nations', `${n.short}.png`))), 'nations: a flag is missing')
  say(`nations: ${picks.length} to pick from, ${C.CAREER_NATIONS.length} in the world, a flag for each`)
  // the call-up: form, minutes and the pecking order
  const base = fresh(7, 'HUL', 'ENG', 'world-call')
  const call = (more, lg) => SX.soccerCallUp({ ...base, season: 2028, ...more }, lg)
  const hull = call({ ovr: 86, age: 19 }, { goals: 5, mins: 2500, apps: 30 })
  const hot = call({ ovr: 86, age: 19 }, { goals: 22, mins: 2900, apps: 34 })
  const benchBra = SX.soccerCallUp({ ...base, nation: 'BRA', season: 2029, ovr: 88, age: 24 }, { goals: 0, mins: 300, apps: 12 })
  const elite = call({ ovr: 97, age: 21 }, { goals: 26, mins: 3000, apps: 35 })
  say(`England's No. 9s, 2029: ${elite.order.map(p => `${p.name} ${p.ovr}${p.me ? ' (him)' : ''}`).join(', ')}`)
  say(`call-ups: an 86 with 5 goals for a side in 16th: ${hull.called ? `called (#${hull.rank})` : `not called (#${hull.rank})`}; the same player with 22: ${hot.called ? `called (#${hot.rank})` : `not called (#${hot.rank})`}; a Brazil 88 with no goals off the bench: ${benchBra.called ? 'called' : 'not called'}; a 97 with 26: ${elite.role}`)
  ok(!hull.called && !benchBra.called && elite.called && elite.role === 'Starter' && hot.rank < hull.rank, 'call-up: form and minutes')
  // every FIFA nation (2026-11-25): 211, by confederation; a minnow caps a pro easily and rarely qualifies
  const byConf = {}
  for (const n of C.CAREER_NATIONS) byConf[n.conf] = (byConf[n.conf] ?? 0) + 1
  say(`nations by confederation: ${Object.entries(byConf).map(x => x.join(' ')).join(', ')}`)
  ok(C.CAREER_NATIONS.length === 211 && new Set(C.CAREER_NATIONS.map(n => n.short)).size === 211 && picks.length === 211, 'nations: not FIFA\'s 211')
  ok(byConf.UEFA === 55 && byConf.CONMEBOL === 10 && byConf.CAF === 54 && byConf.AFC === 46 && byConf.CONCACAF === 35 && byConf.OFC === 11, 'nations: a confederation count is off')
  ok(C.CAREER_NATIONS.every(n => n.name && n.conf && /^#[0-9A-F]{6}$/i.test(n.color) && /^#[0-9A-F]{6}$/i.test(n.color2) && n.ovr > 0 && n.att > 0 && n.def > 0), 'nations: an entry is missing a field')
  const minnow = (nat, ovr) => SX.soccerCallUp({ ...fresh(7, 'HUL', nat, `world-${nat}`), season: 2027, ovr, age: 22 }, { goals: 6, mins: 1800, apps: 25 })
  const qual = { FRO: 0, TGA: 0, SMR: 0, FIJ: 0, NZL: 0, RUS: 0, KEN: 0 }, contIn = { FRO: 0, KEN: 0, AIA: 0, CUB: 0 }
  for (let i = 0; i < 40; i++) {
    const W = INTL.worldCupOf(2030, `minnow${i}`)
    for (const n of Object.keys(qual)) if (W.nations.includes(n)) qual[n]++
    for (const [n, y] of [['FRO', 2028], ['KEN', 2028], ['AIA', 2029], ['CUB', 2029]]) if (INTL.continentalField(INTL.continentalOf(n, y), y, `minnow${i}`).nations.includes(n)) contIn[n]++
  }
  const fro = minnow('FRO', 74), tga = minnow('TGA', 70), bra = minnow('BRA', 74)
  say(`minnows: a 74 from the Faroe Islands ${fro.called ? `called (${fro.role})` : 'not called'}; a 70 from Tonga ${tga.called ? `called (${tga.role})` : 'not called'}; a 74 from Brazil ${bra.called ? 'called' : 'not called'}`)
  say(`World Cup 2030 over 40 worlds: ${Object.entries(qual).map(x => x.join(' ')).join(', ')}; their continental finals: ${Object.entries(contIn).map(x => x.join(' ')).join(', ')}`)
  ok(fro.called && tga.called && tga.role === 'Starter' && !bra.called, 'call-up: a minnow should cap a decent pro, Brazil shouldn\'t')
  ok(qual.TGA === 0 && qual.SMR === 0 && qual.RUS === 0 && qual.FRO <= 2 && qual.NZL >= 36 && contIn.AIA === 0 && contIn.CUB <= 32, 'qualifying: a minnow went too often')
  ok(INTL.continentalOf('FIJ', 2028) == null && INTL.continentalOf('TGA', 2031) == null && INTL.continentalOf('FRO', 2028)?.id === 'euro' && INTL.continentalOf('AIA', 2027)?.id === 'gold' && INTL.continentalOf('TPE', 2027)?.id === 'asian' && INTL.continentalOf('KEN', 2027)?.id === 'afcon', 'cycles: the new nations\' confederations')
  ok(X.theNation('FRO') === 'the Faroe Islands' && X.theNation('BAH') === 'the Bahamas' && X.theNation('TGA') === 'Tonga', 'theNation')
}

// ── 8. Size is his frame ──
{
  const c = { ...fresh(7, 'BHA'), dev: { points: 20 } }
  ok(!C.trainable(c, 'size') && !C.canUpgrade(c, 'size') && C.trainable(c, 'finishing'), 'Size can be trained')
  say(`Size: trainable ${C.trainable(c, 'size')}, finishing ${C.trainable(c, 'finishing')}`)
}

// ── 9. An auto-simmed tie, and comps ──
{
  let c = fresh(11, 'MCI', 'ENG', 'world-tie')
  c = { ...c, europe: 'ucl', europeFor: 'MCI' }
  let heavy = 0, n = 0, upsetBig = 0
  for (let i = 0; i < 12; i++) {
    let d = playSeason({ ...c, seed: `tie${i}` })
    for (const r of d.seasons.at(-1).rounds) { if (!r.auto) continue; n++; const m = Math.abs(r.mySc - r.oppSc); if (m >= 5) heavy++; if (!r.won && r.oppSc - r.mySc >= 3) upsetBig++ }
  }
  say(`auto-simmed ties over 12 City seasons with a 99 striker: ${n}; decided by five or more: ${heavy}; lost by three or more: ${upsetBig}`)
  ok(upsetBig === 0 && heavy <= 1, `auto ties: ${heavy} routs, ${upsetBig} heavy defeats`)
  const comps = C.compsFor(c, 8)
  const by = X.castIndex
  const roles = comps.map(p => by.get(p.name)?.role ?? 'ST')
  say(`comps: ${comps.map((p, i) => `${p.name} (${roles[i]})`).join(', ')}`)
  ok(roles.every(r => r === 'ST' || r === 'SS'), 'comps: a striker compared with a midfielder or a winger')
}

// ── 10. Old saves ──
{
  const dir = process.env.SOCCER_OLD_SAVES
  const files = dir ? ['save-window', 'save-wc', 'save-po', 'save-retiring', 'save-retired'].map(f => join(dir, `${f}.json`)).filter(existsSync) : []
  for (const f of files) {
    store.clear()
    store.set('bap_career_soccer_guest', readFileSync(f, 'utf8'))
    let c = C.loadCareer('soccer', null)
    if (!c) { errs.push(`old save ${f}: didn't load`); continue }
    const was = `${c.phase} ${c.team} age ${c.age}, ${c.seasons.length} seasons`
    try {
      if (c.phase === 'retired') { C.careerTotals(c); C.legacyOf(c) }
      else {
        if (c.phase === 'season') {
          let D = C.resumeSeason(c)
          for (let g = 0; g < 600 && !c.active.final; g++) {
            const a = c.active
            if (a.po) break
            if (a.moment) { [c] = C.chooseMoment(c, D, a.moment.options[0]); continue }
            if (a.injury) { c = C.resolveInjury(c, D, false); if (Array.isArray(c)) c = c[0]; continue }
            if (a.k >= D.total) { c = C.finishRegular(c, D); break }
            const [n] = C.advanceWeek(c, D); if (n === c) break; c = n
          }
          for (let g = 0; g < 20 && c.active?.po && c.active.po.stage !== 'done'; g++) { c = C.playoffRound(c, 0.6, null, true); if (Array.isArray(c)) c = c[0] }
          if (c.phase !== 'offseason') c = C.bookSeason(c)
        }
        if (c.phase === 'offseason' && !C.mustRetire(c) && (c.contract.left > 0 || c.offers?.length)) {
          if (c.contract.left <= 0 && c.offers?.length) c = C.signOffer(c, c.offers[0])
          c = playSeason(next(c))
        }
      }
      say(`old save ${f.split('/').pop()}: ${was} -> ${c.phase} ${c.team}, ${c.seasons.length} seasons, release clause ${X.releaseText(c) ?? 'none'}`)
    } catch (e) { errs.push(`old save ${f.split('/').pop()}: ${e.message}`); console.log(e.stack.split('\n').slice(0, 4).join('\n')) }
  }
  if (!files.length) say('old saves: none given (SOCCER_OLD_SAVES=<dir with the tester\'s save-*.json>)')
}

// ── The summer's tournament, played (2026-11-25): the knockouts are rounds after the club's nights ──
{
  let seen = 0, played = 0
  for (const [nat, seed] of [['FRA', 'wc-fra'], ['BRA', 'wc-bra'], ['ENG', 'wc-eng']]) {
    let c = fresh(11, 'ARS', nat, seed)
    for (let y = 0; y < 5 && c.phase !== 'retired'; y++) {
      let D; [c, D] = C.startSeason(c)
      for (let g = 0; g < 600; g++) {
        const a = c.active
        if (a.moment) { [c] = C.chooseMoment(c, D, a.moment.options[0]); continue }
        if (a.injury) { c = C.resolveInjury(c, D, false); if (Array.isArray(c)) c = c[0]; continue }
        if (a.k >= D.total) break
        const [n] = C.advanceWeek(c, D); if (n === c) break; c = n
      }
      const fin = D.finalize?.() ?? null
      c = C.finishRegular(c, D)
      const intl = (c.active?.po?.rounds ?? []).filter(x => x.intl)
      if (intl.length) {
        seen++
        ok(intl.every(x => x.legs === 1 && x.home == null && x.oppName && x.p > 0 && x.p < 1), 'tournament: a knockout round should be one match at a neutral venue, a nation and a chance')
        ok(new Set(intl.map(x => `${x.track}|${x.opp}`)).size === intl.length, 'tournament: the same nation twice on one road')
        ok(intl.every(x => x.opp !== c.nation), 'tournament: his own country as the opponent')
        ok(intl.filter(x => x.final).length <= 2 && intl.filter(x => x.key === 'sf' || x.final).every(x => x.close), 'tournament: a semi-final and a final should turn on his moment')
        if (fin) ok(!!X.tourNights(c, fin), 'tournament: the hub should say the knockouts are still to play')
      }
      let k = 0
      for (let g = 0; g < 20 && c.active?.po && c.active.po.stage !== 'done'; g++) { const sc = (k++ % 3) ? 0.7 : 0.3; c = C.playoffRound(c, sc, null, sc >= 0.5); if (Array.isArray(c)) c = c[0] }
      const line = c.active?.po?.line ?? []
      if (c.phase !== 'offseason') c = C.bookSeason(c)
      const s = c.seasons.at(-1)
      for (const [t, track] of [[s.wc, 'wc'], [s.cont, 'cont']]) {
        const ties = line.filter(x => x.track === track)
        if (!t?.called || !ties.length) continue
        played++
        const ko = (t.games ?? []).filter(g => g.stage !== 'group')
        const last = ties.at(-1)
        ok(t.played && !t.ko, `tournament ${track}: booked as played, without the engine's road`)
        ok(ko.filter(g => g.stage !== 'third').length === ties.length, `tournament ${track}: ${ties.length} knockouts played, ${ko.length} in the record`)
        ok((t.finish === 'Winners') === (last.final && last.won) && t.champion === (t.finish === 'Winners'), `tournament ${track}: finish ${t.finish} against the last tie (${last.stage} ${last.won ? 'W' : 'L'})`)
        ok(t.champion ? t.winner === c.nation : t.winner && t.winner !== c.nation, `tournament ${track}: the winner ${t.winner} against the finish ${t.finish}`)
        ok(!(s.rounds ?? []).some(x => x.track === track), `tournament ${track}: his country's ties counted among the club's big nights`)
        ok(t.goals === (t.games ?? []).reduce((a, g) => a + (g.goals ?? 0), 0), `tournament ${track}: his goals and the matches' don't add up`)
        if (!last.won && last.key === 'sf' && track === 'wc') ok(['Third place', 'Fourth place'].includes(t.finish) && ko.some(g => g.stage === 'third'), 'tournament: a beaten World Cup semi-finalist plays for third')
        say(`${nat} ${t.year} ${track === 'wc' ? 'World Cup' : t.name}: ${(t.games ?? []).map(g => `${g.round?.replace(/ · Matchday \d/, '') ?? g.stage} ${g.mySc}-${g.oppSc} ${g.opp}${g.pens ? ` (${g.pens.join('-')} pens)` : ''}`).join(', ')} -> ${t.finish}, ${t.goals}g; winners ${t.winnerName}`)
      }
      if (C.mustRetire(c)) break
      c = next(c)
    }
  }
  ok(seen > 0 && played > 0, `tournament: no knockout road in ${seen} summers (${played} played)`)
}

// ── A career that doesn't end at 22 (2026-11-25): a weak build out of contract drops a division instead ──
{
  let early = 0, drops = 0, n = 0
  for (let i = 0; i < 4; i++) {
    let c = fresh(3, 'S04', 'BRA', `weak-${i}`)
    for (let y = 0; y < 12 && c.phase !== 'retired'; y++) {
      c = playSeason(c)
      if (c.contract.left <= 0 && Array.isArray(c.offers)) {
        n++
        if (c.age < 31) ok(c.offers.length > 0, `a ${c.age}-year-old out of contract with no offers (${c.ovr})`)
        const d = c.offers.find(o => o.kind === 'drop')
        if (d) { drops++; c = C.signOffer(c, d); ok(c.down?.team === c.team && X.isDown(c), 'a move a division down should play the second tier') }
        else if (c.offers.length) c = C.signOffer(c, c.offers[0])
      }
      if (C.mustRetire(c)) { if (c.age < 31) early++; break }
      c = C.nextSeason(c.offers?.length ? SX.stayPut(c) : c)
    }
  }
  say(`weak builds: ${n} times out of contract, ${drops} moves a division down, ${early} careers over before 31`)
  ok(early === 0, `${early} weak careers ended before 31 with no club`)
}

if (errs.length) { console.log(`\n${errs.length} PROBLEM(S):`); for (const e of [...new Set(errs)].slice(0, 40)) console.log(' -', e); process.exit(1) }
console.log('\ncareer world: OK')
