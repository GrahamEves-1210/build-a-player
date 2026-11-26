// Soccer Career's leagues (2026-11-26): node scripts/soccer/league-check.mjs   (env: N=4 YEARS=12 SEED=1 VERB=1)
// Careers at clubs from every league, kept there (they stay, whatever the window), the build weak enough to go down
// now and then. Each season checks: the final table (every club 2(n-1) matches, the results add up, the order is the
// league's own tiebreakers), the drop and the play-offs, next season's divisions (the sizes, nobody in two places, the
// relegated in the second tier, the promoted up), Europe (each league's places, his own place the world's), the
// cup's rounds. A summary: who went up and down, the European places per league, the play-offs played.
import { build } from 'esbuild'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { tmpdir } from 'os'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(process.env.SOCCER_TEST_OUT ?? tmpdir(), 'bap-soccer-test')
mkdirSync(OUT, { recursive: true })
{ let s = (+(process.env.SEED || 1) * 2654435761) >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const store = new Map()
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: i => [...store.keys()][i] ?? null, get length() { return store.size } }
globalThis.window = globalThis; globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {}; globalThis.document = { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' }; globalThis.location = { search: '', hostname: 'localhost', href: 'http://localhost/' }
const outfile = join(OUT, `leagues-${process.pid}.mjs`)
await build({
  stdin: { contents: `export * from './src/lib/career.js'\nexport * from './src/lib/careerSoccer.js'\nexport * as ENG from './src/utils/soccerSimulation.js'\nexport { SOCCER_CAREER_CLUBS as SOCCER_CLUBS } from './src/data/soccer-clubs.js'`, resolveDir: ROOT, loader: 'js' },
  bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error', loader: { '.jsx': 'jsx', '.json': 'json', '.png': 'empty', '.css': 'empty', '.webp': 'empty' },
  define: { 'import.meta.env': '{"DEV":false,"VITE_SUPABASE_URL":"http://localhost:1","VITE_SUPABASE_ANON_KEY":"x"}' },
})
const C = await import(pathToFileURL(outfile).href)
const { ENG } = C
const S = C.SPORT.soccer, X = S.x, T = S.types.st
const CLUB = new Map(C.SOCCER_CLUBS.map(c => [c.short, c]))
const mkBuild = vals => Object.fromEntries(T.map((t, i) => [t, { type: t, val: vals[i], qb: 'Test', qbFull: 'Test Player', team: 'ARS', height: 72, weight: 165 }]))
const errs = []
const ok = (cond, msg) => { if (!cond) errs.push(msg) }
const VERB = !!process.env.VERB
const SIZE = { 'eng.1': 20, 'esp.1': 20, 'ita.1': 20, 'ger.1': 18, 'fra.1': 18 }, T2SIZE = { 'eng.1': 24, 'esp.1': 22, 'ita.1': 20, 'ger.1': 18, 'fra.1': 18 }
const KEY = { 'eng.1': 'ENG', 'esp.1': 'ESP', 'ita.1': 'ITA', 'ger.1': 'GER', 'fra.1': 'FRA' }
const tally = { seasons: 0, tier2: 0, promoted: 0, relegated: 0, playoffs: {}, ups: {}, downs: {}, euro: {}, synthTop: 0, eps: {} }
// (the order a final table must be in: points, then the league's tiebreakers; head-to-head from the table can't be
// read back, so a level pair is only checked on points and the overall numbers the league uses before head-to-head)
const TB_FIRST = { ENG: ['gd', 'gf'], ESP: [], ITA: [], GER: ['gd', 'gf'], FRA: ['gd'] }
function checkTable(s, lid, tier2) {
  const rows = X.tableOf(s)
  const size = tier2 ? T2SIZE[lid] : SIZE[lid]
  ok(rows && rows.length === size, `${s.season} ${s.team}: table has ${rows?.length} clubs, not ${size}`)
  if (!rows) return
  const n = 2 * (rows.length - 1)
  ok(rows.every(r => r.played === n), `${s.season} ${s.team}: a club hasn't played ${n}`)
  const W = rows.reduce((a, r) => a + r.wins, 0), L = rows.reduce((a, r) => a + r.losses, 0), D = rows.reduce((a, r) => a + r.draws, 0)
  ok(W === L && D % 2 === 0 && rows.reduce((a, r) => a + r.gd, 0) === 0, `${s.season} ${s.team}: results don't add up`)
  ok(new Set(rows.map(r => r.short)).size === rows.length, `${s.season}: a club twice in the table`)
  const tb = TB_FIRST[KEY[lid]] ?? []
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i]
    ok(a.points >= b.points, `${s.season} ${lid}: ${a.short} above ${b.short} on fewer points`)
    if (a.points === b.points) for (const k of tb) { if (a[k] !== b[k]) { ok(a[k] > b[k], `${s.season} ${lid}: ${a.short} above ${b.short} level on points, worse ${k}`); break } }
  }
}
function checkWorld(c, s) {
  const W = c.world
  ok(!!W, `${s.season}: no world after the season`)
  if (!W) return
  const seen = new Map()
  for (const lid of Object.keys(SIZE)) {
    ok(W.divs[lid]?.length === SIZE[lid], `${s.season}: ${lid} has ${W.divs[lid]?.length} clubs next season`)
    ok(W.t2[lid]?.length === T2SIZE[lid], `${s.season}: ${lid}'s second tier has ${W.t2[lid]?.length} clubs next season`)
    for (const x of [...W.divs[lid], ...W.t2[lid]]) { ok(!seen.has(x), `${s.season}: ${x} in two places`); seen.set(x, lid) }
    tally.synthTop += W.divs[lid].filter(x => !CLUB.has(x)).length
  }
  // his club: where the world has it
  const lid = CLUB.get(s.team)?.league
  if (s.relegated) ok(W.t2[lid].includes(s.team), `${s.season}: ${s.team} relegated but not in the second tier`)
  if (s.tier === 2 && s.promoted) ok(W.divs[lid].includes(s.team), `${s.season}: ${s.team} promoted but not in the top flight`)
  if (s.tier === 2 && !s.promoted) ok(W.t2[lid].includes(s.team), `${s.season}: ${s.team} not promoted but out of the second tier`)
  if (s.tier !== 2 && !s.relegated) ok(W.divs[lid].includes(s.team), `${s.season}: ${s.team} stayed up but isn't in the top flight`)
  ok((W.euro[s.team] ?? null) === (s.qualified ?? null), `${s.season}: ${s.team} qualified ${s.qualified} but the world has ${W.euro[s.team]}`)
  // Europe: each league's numbers
  for (const l of Object.keys(SIZE)) {
    const k = KEY[l], n = { ucl: 0, uel: 0, uecl: 0 }
    for (const x of [...W.divs[l], ...W.t2[l]]) if (W.euro[x]) n[W.euro[x]]++
    const key = `${k} ${n.ucl}/${n.uel}/${n.uecl}`
    tally.euro[key] = (tally.euro[key] ?? 0) + 1
    ok(n.ucl >= 3 && n.ucl <= 7 && n.uel >= 1 && n.uel <= 4, `${s.season}: ${k} has ${n.ucl} in the Champions League, ${n.uel} in the Europa League`)
  }
}
const PICKS = (process.env.CLUBS || 'BET,VAL,SVE,AUX,LEC,HUL,SCP,ANG').split(',')
const N = +(process.env.N || PICKS.length), YEARS = +(process.env.YEARS || 10)
function season(c) {
  let D; [c, D] = C.startSeason(c)
  for (let g = 0; g < 600; g++) {
    const a = c.active
    if (a.moment) { const opts = a.moment.options; ;[c] = C.chooseMoment(c, D, opts[Math.floor(Math.random() * opts.length)]); continue }
    if (a.injury) { c = C.resolveInjury(c, D, false); if (Array.isArray(c)) c = c[0]; continue }
    if (a.k >= D.total) break
    if (C.breakNow(c)) c = C.breakRest(c, D)
    if (C.januaryNow(c)) c = C.januaryStay(c, D)
    const [n] = C.advanceWeek(c, D); if (n === c) { errs.push('STUCK'); break } c = n
  }
  c = C.finishRegular(c, D)
  for (let g = 0; g < 20 && c.active?.po && c.active.po.stage !== 'done'; g++) { const s = Math.random(); c = C.playoffRound(c, s, null, s >= 0.5); if (Array.isArray(c)) c = c[0] }
  if (c.phase !== 'offseason') c = C.bookSeason(c)
  return c
}
for (let i = 0; i < N; i++) {
  const club = PICKS[i % PICKS.length], lv = +(process.env.LVL || 4)
  const vals = T.map(() => Math.max(1, Math.min(11, lv + Math.round((Math.random() - 0.5) * 3))))
  let c = C.newCareer({ sport: 'soccer', pos: 'st', build: mkBuild(vals), name: `Kid ${i}`, nation: ['ENG', 'ESP', 'BRA', 'FRA', 'USA', 'NOR'][i % 6] })
  c = C.skipCombine(c); c = C.setupInterviews({ ...c, step: 'interview' })
  for (let k = 0; k < (c.draft.interviews ?? []).length; k++) c = C.answerInterview(c, k, 0)
  const d = C.runDraft(c)
  c = C.signAcademy(d, { ...d.draft.offers[0], team: club })
  console.log(`\n=== ${club} (${CLUB.get(club).league}) OVR ${c.ovr}`)
  for (let y = 0; y < YEARS; y++) {
    if (c.phase === 'retired') break
    const before = c.world ?? null
    c = season(c)
    const s = c.seasons.at(-1), lid = CLUB.get(s.team)?.league
    tally.seasons++
    checkTable(s, lid, s.tier === 2)
    checkWorld(c, s)
    if (s.tier === 2) { tally.tier2++; if (s.promoted) tally.promoted++ }
    if (s.relegated) tally.relegated++
    for (const x of s.rounds ?? []) if (x.track === 'promo') { const k = x.round; tally.playoffs[k] = (tally.playoffs[k] ?? 0) + 1 }
    // the other leagues: who went up and down
    if (before && c.world) for (const l of Object.keys(SIZE)) {
      const up = c.world.divs[l].filter(x => !before.divs[l].includes(x)), down = before.divs[l].filter(x => !c.world.divs[l].includes(x))
      ok(up.length === down.length, `${s.season}: ${l} ${up.length} up, ${down.length} down`)
      const k = `${KEY[l]} ${down.length}`; tally.downs[k] = (tally.downs[k] ?? 0) + 1
      for (const x of up) tally.ups[x] = (tally.ups[x] ?? 0) + 1
      if (VERB) console.log(`   ${KEY[l]}: down ${down.join(',')} up ${up.join(',')}`)
    }
    const rows = X.tableOf(s)
    console.log(`${s.season} ${s.team} ${s.tier === 2 ? s.league : lid} ${s.pos}/${s.size} ${s.points}pts${s.relegated ? ' RELEGATED' : ''}${s.tier === 2 ? (s.promoted ? ` PROMOTED(${s.promotedHow})` : ' stays down') : ''} | cup ${s.cupName}:${s.cupResult} | europe ${s.europe ? `${s.europe.comp}:${s.europe.result}` : '-'} | next ${s.qualified ?? '-'} | po ${(s.rounds ?? []).filter(x => x.track === 'promo').map(x => `${x.round} v ${x.opponent} ${x.won ? 'W' : 'L'} ${x.mySc}-${x.oppSc}`).join('; ') || '-'} | top ${rows.slice(0, 3).map(r => `${r.short}${r.points}`).join(' ')} | bottom ${rows.slice(-3).map(r => `${r.short}${r.points}`).join(' ')}`)
    if (c.phase === 'retired' || C.mustRetire(c)) break
    // he stays: a new deal when there is one, else the deal he has
    const keep = (c.offers ?? []).find(o => o.kind === 'renew' && o.team === c.team)
    c = keep ? C.acceptTalks(C.openTalks(c, keep)) : C.stayPut(c)
    if ((c.contract?.left ?? 0) <= 0) { const o = (c.offers ?? []).find(x => x.kind !== 'stay') ?? null; if (o) c = C.acceptTalks(C.openTalks(c, o)); else break }
    c = C.nextSeason(c)
  }
}
console.log('\nTALLY', JSON.stringify(tally, null, 0))
if (errs.length) { console.log(`\n${errs.length} problems:\n` + [...new Set(errs)].slice(0, 40).join('\n')); process.exit(1) }
console.log('\nleagues: OK')
