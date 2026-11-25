// Headless soccer careers, kid-like choices (from the QA tester's runner, 2026-11-24): N full careers, a line a season,
// the window each summer, and a summary. node scripts/soccer/career-sim.mjs   (env: N=6 LVL=11,9,7 SEED=1 VERB=1 PICK=big|stay)
import { build } from 'esbuild'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { tmpdir } from 'os'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(process.env.SOCCER_TEST_OUT ?? tmpdir(), 'bap-soccer-test')
mkdirSync(OUT, { recursive: true })
// (the choices are seeded, so two runs compare)
{ let s = (+(process.env.SEED || 1) * 2654435761) >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const store = new Map()
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: i => [...store.keys()][i] ?? null, get length() { return store.size } }
globalThis.window = globalThis; globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {}; globalThis.document = { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' }; globalThis.location = { search: '', hostname: 'localhost', href: 'http://localhost/' }
const outfile = join(OUT, `careers-${process.pid}.mjs`)
await build({
  stdin: { contents: `export * from './src/lib/career.js'\nexport * from './src/lib/careerSoccer.js'\nexport { SOCCER_CAREER_CLUBS as SOCCER_CLUBS } from './src/data/soccer-clubs.js'`, resolveDir: ROOT, loader: 'js' },
  bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error', loader: { '.jsx': 'jsx', '.json': 'json', '.png': 'empty', '.css': 'empty', '.webp': 'empty' },
  define: { 'import.meta.env': '{"DEV":false,"VITE_SUPABASE_URL":"http://localhost:1","VITE_SUPABASE_ANON_KEY":"x"}' },
})
const C = await import(pathToFileURL(outfile).href)
const T = C.SPORT.soccer.types.st
const CLUB = new Map(C.SOCCER_CLUBS.map(c => [c.short, c]))
const mkBuild = vals => Object.fromEntries(T.map((t, i) => [t, { type: t, val: vals[i], qb: 'Test', qbFull: 'Test Player', team: 'ARS', height: 72, weight: 165 }]))
const N = +(process.env.N || 6), LVL = (process.env.LVL || '9,7,5').split(',').map(Number)
const VERB = !!process.env.VERB
const agg = []
function season(c) {
  let D; [c, D] = C.startSeason(c)
  for (let g = 0; g < 500; g++) {
    const a = c.active
    if (a.moment) { const opts = a.moment.options; ;[c] = C.chooseMoment(c, D, opts[Math.floor(Math.random() * opts.length)]); continue }
    if (a.injury) { c = C.resolveInjury(c, D, false); if (Array.isArray(c)) c = c[0]; continue }
    if (a.k >= D.total) break
    const [n] = C.advanceWeek(c, D); if (n === c) { console.log('STUCK'); break } c = n
  }
  c = C.finishRegular(c, D)
  for (let g = 0; g < 20 && c.active?.po && c.active.po.stage !== 'done'; g++) { const s = Math.random(); c = C.playoffRound(c, s, null, s >= 0.5); if (Array.isArray(c)) c = c[0] }
  if (c.phase !== 'offseason') c = C.bookSeason(c)
  return c
}
for (let i = 0; i < N; i++) {
  const lv = LVL[i % LVL.length]
  const vals = T.map(() => Math.max(1, Math.min(11, lv + Math.round((Math.random() - 0.5) * 4))))
  let c = C.newCareer({ sport: 'soccer', pos: 'st', build: mkBuild(vals), name: `Kid ${i}`, nation: ['ENG', 'ESP', 'BRA', 'FRA', 'USA', 'NOR'][i % 6] })
  c = C.skipCombine(c); c = C.setupInterviews({ ...c, step: 'interview' })
  for (let k = 0; k < (c.draft.interviews ?? []).length; k++) c = C.answerInterview(c, k, 0)
  const d = C.runDraft(c)
  const offers = d.draft.offers
  c = C.signAcademy(d, offers[0])
  console.log(`\n=== Career ${i} lvl ${lv} ${c.nation} OVR ${c.ovr} ${d.draft.tier}: offers ${offers.map(o => `${o.team}(${o.stand.role},${C.wageText(o.perYear, o.team)},${o.years}y)`).join(' ')} -> ${c.team}`)
  for (let y = 0; y < 22; y++) {
    if (c.phase === 'retired') break
    c = season(c)
    const s = c.seasons.at(-1)
    const st = s.stats
    const eu = s.europe ? `${s.europe.comp}:${s.europe.result}` : '-'
    const wc = s.wc ? (s.wc.called ? `WC${s.wc.year}:${s.wc.finish}/${s.wc.goals}g/${s.wc.apps}a` : `WC${s.wc.year}:not called`) : ''
    const line = `${s.season}-${String((s.season + 1) % 100).padStart(2, '0')} age ${s.age} ${s.team}(${CLUB.get(s.team)?.league}) ovr ${s.ovr} ${s.role} | lg ${st.lgGoals}g/${st.lgAssists}a in ${st.lgApps} (starts ${st.starts}) | all ${st.goals}g ${st.assists}a ${st.apps}apps cup ${st.cupGoals} eu ${st.euroGoals} | pos ${s.pos}/${s.size} ${s.wins}-${s.draws}-${s.losses} ${s.points}pts | cup ${s.cupName}:${s.cupResult} | ${eu} | BdO ${s.bdo?.rank}${s.award ? '*WIN*' : ''} boot ${s.allPro ? 'Y' : '-'} poty ${s.poty ? 'Y' : '-'} tots ${s.proBowl ? 'Y' : '-'} shoe ${s.shoe ? 'Y' : '-'} kopa ${s.roy ? 'Y' : '-'} | caps ${s.caps}/${s.intlGoals} ${s.intlRole ?? ''} ${wc} | rec ${s.records.join(';')} | rel ${s.relegated ? 'Y' : '-'} q ${s.qualified} | rounds ${s.rounds.map(r => `${r.round}:${r.won ? 'W' : 'L'}${r.mySc}-${r.oppSc} v ${r.opponent}`).join(', ')}`
    console.log(line)
    agg.push({ lv, age: s.age, ovr: s.ovr, lg: st.lgGoals, all: st.goals, apps: st.apps, lgApps: st.lgApps, as: st.assists, bdo: s.award, boot: s.allPro, role: s.role, league: CLUB.get(s.team)?.league, eu: s.europe?.comp, euRes: s.europe?.result, ucl: s.uclWon, champ: s.champion, cupWon: s.cupWon, wc: s.wc, caps: s.caps, trophies: s.trophies, sat: s.missed })
    // offseason
    if (c.phase === 'retired') break
    const ev = (c.events ?? []).filter(e => e.year === c.year + 1 || e.year === s.year).map(e => e.text)
    if (VERB && ev.length) console.log('   events:', ev.join(' || '))
    if (VERB && c.aging?.length) console.log('   aging:', c.aging.join('; '))
    if (C.mustRetire(c)) { const why = C.retireReason(c); c = C.retire(c); console.log(`   RETIRED (${why}) at ${c.age}`); break }
    if (c.offers?.length) {
      const list = c.offers.map(o => `${o.kind}:${o.team}(${CLUB.get(o.team)?.league},${C.wageText(o.perYear, o.team)},${o.years}y${o.fee ? `,fee ${C.feeText(o.fee, c.team)}` : ''},${o.stand?.starter ? 'start' : o.stand?.role ?? '?'})`).join(' ')
      // kid: the biggest club that bids, else renew, else stay
      const bids = c.offers.filter(o => o.kind !== 'renew' && o.kind !== 'stay')
      const pick = bids.sort((a, b) => b.perYear - a.perYear)[0] ?? c.offers[0]
      const before = c.team
      c = C.acceptTalks(C.openTalks(c, pick))
      console.log(`   window (${c.contract ? '' : ''}left ${c.contract.left}): ${list}  => ${pick.kind} ${pick.team}; now ${c.team} ${C.wageText(c.contract.perYear, c.team)} ${c.contract.years}y`)
      console.log('   decision:', c.decisions.at(-1)?.text)
    } else if (Array.isArray(c.offers) && !c.offers.length) { console.log('   no offers'); }
    else console.log(`   no window (contract left ${c.contract.left}, team ${c.team})`)
    // spend dev points
    for (let k = 0; k < 6; k++) { const t = [...c.types].filter(t => C.canUpgrade(c, t)).sort((a, b) => c.build[b].val - c.build[a].val)[0]; if (!t) break; c = C.spendDev(c, t) }
    if (c.contract.left <= 0) { console.log('   UNSIGNED, contract 0 -> retire?', C.retireReason(c)); c = C.retire(c); break }
    c = C.nextSeason(c)
  }
  const t = C.careerTotals(c), L = C.legacyOf(c)
  console.log(`END: ${c.seasons.length} seasons, retired ${c.age}, ${t.stats.goals}g ${t.stats.assists}a ${t.stats.apps} apps, trophies ${t.trophies}, BdO ${t.bdo}, boots ${t.boots}, UCL ${t.ucl}, WC ${t.wc}, caps ${t.caps}/${t.intlGoals}, legacy ${L.score} ${L.tier} rank ${L.rank}, verdict ${c.hof?.ballot}, earnings €${Math.round(t.earnings)}M`)
}
// summary
const by = f => { const m = {}; for (const a of agg) { const k = f(a); (m[k] ??= []).push(a) } return m }
const avg = (l, k) => (l.reduce((s, a) => s + (a[k] ?? 0), 0) / l.length).toFixed(1)
console.log('\nBY OVR BAND (starter seasons):')
for (const [k, l] of Object.entries(by(a => (a.role === 'Starter' ? Math.floor(a.ovr / 4) * 4 : 'non-start')))) console.log(`  ${k}: n ${l.length} lg ${avg(l, 'lg')} all ${avg(l, 'all')} apps ${avg(l, 'apps')} lgApps ${avg(l, 'lgApps')} assists ${avg(l, 'as')} bdo ${l.filter(a => a.bdo).length} boot ${l.filter(a => a.boot).length}`)
console.log('max lg goals', Math.max(...agg.map(a => a.lg)), 'max all', Math.max(...agg.map(a => a.all)), 'max apps', Math.max(...agg.map(a => a.apps)))
