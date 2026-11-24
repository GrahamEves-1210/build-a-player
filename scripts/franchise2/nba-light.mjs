// NBA Franchise LIGHT: seasons played the LIGHT way, headless (lib/franchise2/nba/light.js): the three stretches,
// the postseason a round a tap, the three-step summer with the front office's calls and two offers a summer.
// Checks every season: 82 games a team, the stretches cover the season, the recap's numbers, the postseason to a
// champion, the awards and the history written as FULL writes them, the GM's roster legal and under his limits, no
// NaN anywhere, the save packs and loads. Then a FULL season on the same seed, for the shape of what's saved.
//   FR_TMP=<dir> bash scripts/franchise2/run.sh scripts/franchise2/nba-light.mjs [seasons=12] [seed=a] [team=BOS]
import * as N from '../../src/lib/franchise2/nba/index'
const Y = +(process.argv[2] ?? 12), SEED = process.argv[3] ?? 'a', TEAM = process.argv[4] ?? 'BOS'
let bad = 0
const fail = (...m) => { bad++; console.log('  FAIL', ...m) }
const t0 = Date.now()
const F = N.createNbaFranchise({ seed: 'light-' + SEED, team: TEAM, owner: 'G', pace: 'light' })
if (F.pace !== 'light' || !F.lt || F.lt.ph !== 'card' || F.lt.k !== 0) fail('a new LIGHT league opens on its first stretch', F.pace, F.lt)
const allMen = () => [...Object.values(F.teams).flatMap(t => t.r), ...(F.fa ?? [])]
function nanCheck(tag) {
  for (const p of allMen()) for (const k of ['o', 'ag', '$', 'y', 'pk']) if (p[k] != null && !Number.isFinite(p[k])) { fail(tag, 'NaN', k, p.n); return }
  for (const s of N.SHORTS) { const c = N.CAP_SIM.capSheet(F, s); if (!Number.isFinite(c.pay)) fail(tag, 'payroll NaN', s) }
}
const champs = {}
let offers = 0, won = 0, kept = 0, gone = 0, qo = 0, picks = 0, stretchN = [0, 0, 0]
for (let y = 0; y < Y; y++) {
  const yr = F.year
  // ── the season: three stretches ──
  const S = N.stretchDays(F)
  if (S[0][0] !== 0 || S[2][1] !== F.days || S[0][1] >= S[1][1] || S[1][1] > F.ddl) fail(yr, 'stretch days', JSON.stringify(S), F.ddl, F.days)
  for (let k = 0; k < 3; k++) {
    if (F.lt?.k !== k || F.lt.ph !== 'card' || !N.stretchOk(F)) { fail(yr, 'stretch', k, 'not open', JSON.stringify(F.lt)); break }
    const games = N.stretchGames(F, k).length
    stretchN[k] += games
    N.lightPlay(F)
    if (F.lt.ph !== 'recap') fail(yr, 'no recap', k)
    const X = N.stretchRecap(F)
    if (X.rows.length !== games) fail(yr, 'recap rows', k, X.rows.length, 'of', games)
    if (X.w + X.l !== X.rows.length) fail(yr, 'recap record', k)
    if (!(X.seed >= 1 && X.seed <= 15)) fail(yr, 'seed', X.seed)
    for (const b of X.builds) if (b.gp > games) fail(yr, 'build games', b.p.n, b.gp, games)
    if (k === 1 && F.day !== F.ddl) fail(yr, 'stretch 2 stops before deadline day', F.day, F.ddl)
    const boxes = X.rows.filter(r => N.boxOf(F, r)).length
    if (y === 0) console.log(`   stretch ${k + 1}: ${games} games, ${boxes} box scores kept, save ${(N.packNba(F).length / 1024).toFixed(0)} KB`)
    if (!boxes && X.rows.length) fail(yr, 'no box scores kept')
    N.lightNext(F)
  }
  const R = N.records(F)
  for (const s of N.SHORTS) if (R[s].w + R[s].l !== 82) fail(yr, s, 'played', R[s].w + R[s].l)
  if (F.phase !== 'playin') fail(yr, 'postseason not started', F.phase)
  // ── the postseason: a round a tap ──
  let taps = 0
  while ((F.phase === 'playin' || F.phase === 'playoffs') && taps++ < 12) {
    const ph = F.phase
    const r = N.lightRound(F)
    if (!r) { fail(yr, 'round null'); break }
    // (a top-six seed watches the play-in: nothing of his to show)
    if (!r.out && !(ph === 'playin' && !r.rows.length)) { const x = N.roundResult(F); if (!x) fail(yr, 'no round result', ph) }
  }
  if (F.phase !== 'done' || !F.po?.champ) { fail(yr, 'no champion', F.phase); break }
  champs[F.po.champ] = (champs[F.po.champ] ?? 0) + 1
  N.closeSeason(F)
  const h = F.hist[F.hist.length - 1]
  if (h?.y !== yr || !h.aw?.MVP || !h.aw?.ROY || !h.aw?.ALL?.length || !h.aw?.FMVP) fail(yr, 'awards', JSON.stringify(Object.keys(h?.aw ?? {})))
  // ── 1 the draft ──
  if (N.lightStep(F) !== 0) fail(yr, 'step 0')
  for (const { p } of N.teamOptions(F)) N.setOption(F, p.i, (p.o ?? 0) >= 70)
  const sp0 = F.sp ?? 0
  if (!N.lightToDraft(F)) { fail(yr, 'to the draft', F.off.step); break }
  if ((F.sp ?? 0) > sp0 + 3) fail(yr, 'scouting not spent', F.sp)
  let g = 0
  while (N.onClock(F) && g++ < 80) {
    const pk = N.onClock(F)
    if (pk.t === F.team) { const best = N.available(F).sort((a, b) => a.rank - b.rank)[0]; N.makePick(F, best.i); picks++ } else N.draftTo(F)
  }
  // ── 2 free agency ──
  if (!N.lightOpenFA(F)) { fail(yr, 'open FA', F.off.step); break }
  if (N.lightStep(F) !== 1 || F.lt?.ph !== 'rs') fail(yr, 'step 1')
  const L0 = N.resignList(F)
  for (const { p, d } of L0) { const c = N.callOf(F, p); if (c === 'keep' && !d) fail(yr, 'keep with no ask', p.n); if (p.b != null && c !== 'keep' && d) console.log(`   ${yr} build ${p.n} not kept (${c})`) }
  const rs = N.lightResign(F) ?? []
  kept += rs.filter(x => x[1] === 'kept').length; gone += rs.filter(x => x[1] === 'gone').length; qo += rs.filter(x => x[1] === 'qo').length
  if (F.off.step !== 'fa' || F.lt.ph !== 'fa') fail(yr, 'not on the market', F.off.step)
  const fits = N.marketFits(F)
  for (const x of fits) { const o = N.offerFor(F, x); if (!(o.$ > 0) || !(o.y >= 1) || o.$ > x.room.$ + 0.05) fail(yr, 'offer', x.p.n, JSON.stringify(o), JSON.stringify(x.room)) }
  // (two offers: the best fit Fair, the next Strong over his years)
  const pick = fits.slice(0, 2)
  pick.forEach((x, j) => { F.lt.fc[x.p.i] = { s: j, y: x.ask.y }; F.lt.off[x.p.i] = N.offerFor(F, x); offers++ })
  const far = N.lightFA(F) ?? []
  won += far.filter(x => x.k === 'won').length
  if (!N.CAP_SIM.faDone(F)) fail(yr, 'market not done')
  if (far.length !== pick.length) fail(yr, 'offer results', far.length, pick.length)
  if (!N.lightCamp(F)) { fail(yr, 'to camp', F.off.step); break }
  // ── 3 camp ──
  if (N.lightStep(F) !== 2) fail(yr, 'step 2')
  for (const id of N.campCuts(F)) N.CAP_SIM.cutMan(F, F.team, id)
  const T = F.teams[F.team]
  for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) }
  const legal = N.CAP_SIM.legalRoster(F, F.team, { season: true })
  if (!legal.ok) fail(yr, 'roster', legal.why)
  if (!N.lightNewSeason(F)) { fail(yr, 'new season'); break }
  if (F.year !== yr + 1 || F.phase !== 'season' || F.lt?.k !== 0) fail(yr, 'new season state', F.year, F.phase)
  for (const s of N.SHORTS) { const n = F.teams[s].r.filter(p => !p.tw).length; if (n < 13 || n > 15) fail(yr, s, 'standard', n) }
  nanCheck(yr)
  // (the save: packs and loads)
  const J = N.packNba(F), B = N.unpackNba(J)
  if (B.pace !== 'light' || B.lt?.k !== 0 || B.year !== F.year) fail(yr, 'save round trip')
  const cap = N.CAP_SIM.capSheet(F, F.team)
  console.log(`${yr}: ${TEAM} ${N.recText(R[TEAM])} ${N.FINISH_TEXT[h.finish]} · champ ${h.champ} · MVP ${h.aw.MVP?.n} · ${TEAM} pay $${cap.pay.toFixed(0)} ${cap.over} · rs ${rs.map(x => x[1]).join(',') || '-'} · offers ${far.map(x => `${x.n.split(' ').pop()} ${x.k}`).join(', ') || '-'} · save ${(J.length / 1024).toFixed(0)} KB`)
}
console.log(`stretch games a season (GM): ${stretchN.map(n => (n / Y).toFixed(1)).join(' / ')}`)
console.log(`re-sign: ${kept} kept, ${qo} tendered, ${gone} let go · offers ${offers}, ${won} signed · picks ${picks}`)
console.log('titles', JSON.stringify(champs))
console.log(`${Y} light seasons in ${((Date.now() - t0) / 1000).toFixed(0)}s`)

// ── FULL on the same seed: the same saved league ──
const G = N.createNbaFranchise({ seed: 'light-' + SEED, team: TEAM, owner: 'G' })
if (G.pace !== 'full') fail('a FULL league is marked full', G.pace)
N.simTo(G, G.days); N.startPostseason(G); N.simPostseason(G); N.closeSeason(G)
while (G.phase === 'off') {
  if (G.off.step === 'camp') { const T = G.teams[G.team]; while (T.r.filter(p => !p.tw).length > 15) N.CAP_SIM.cutMan(G, G.team, T.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0].i); for (const p of N.minPool(G)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(G, p.i) } }
  N.nextStep(G)
}
const ks = o => Object.keys(o ?? {}).sort().join(',')
const hl = F.hist[0], hf = G.hist[0]
if (ks({ ...hl, aw: 0 }) !== ks({ ...hf, aw: 0 })) fail('hist keys differ', ks(hl), '|', ks(hf))
for (const k of ['MVP', 'ROY', 'DPOY', 'FMVP', 'ALL']) if (!!hl.aw[k] !== !!hf.aw[k]) fail('award', k, 'light', !!hl.aw[k], 'full', !!hf.aw[k])
if (!F.rec || !G.rec) fail('records missing', !!F.rec, !!G.rec)
console.log(bad ? `${bad} FAILED` : 'ALL OK')
process.exit(bad ? 1 : 0)
