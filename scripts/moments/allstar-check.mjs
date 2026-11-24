// All-Star Saturday (basketball Career, lib/allStar.js): the invitations, the stop at the break, the fields, the rounds,
// the scoring ranges, the results on the season, and the Dunk Contest's balance table (expected totals by tier).
// Run from the repo root:  node scripts/moments/allstar-check.mjs [careers]
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
await server.ssrLoadModule('/src/lib/mg/index.js')   // (the engines in the order the app loads them: meter.js and its neighbours import each other)
const A = await server.ssrLoadModule('/src/lib/allStar.js')
const { DUNKS } = await server.ssrLoadModule('/src/lib/mg/dunkcontest.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const N = Number(process.argv[2] ?? 6)

let bad = 0
const fail = (...m) => { bad++; console.log('FAIL', ...m) }
const ok = (cond, ...m) => { if (!cond) fail(...m) }

const S = C.SPORT.bucket
const buildFor = (pos, r, over = {}) => {
  const pool = S.pool[pos].filter(p => p.attrs), b = {}
  for (const t of S.types[pos]) {
    let p = pool[Math.floor(r() * pool.length)]
    for (let j = 0; j < 4; j++) { const q = pool[Math.floor(r() * pool.length)]; if ((q.attrs?.[t] ?? 0) > (p.attrs?.[t] ?? 0)) p = q }
    b[t] = { type: t, val: over[t] ?? p.attrs?.[t] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, pos: p.pos }
  }
  return b
}
// a career to the All-Star break: the run stops there when he's invited
function toBreak(over, tag, pos = 'guard') {
  let c = C.newCareer({ sport: 'bucket', pos, build: buildFor(pos, seeded(`asw-${tag}`), over), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 })
  c = C.skipCombine(c); c = C.runDraft(c)
  let D; [c, D] = C.startSeason(c)
  const at = A.allStarGame(c)
  for (let g = 0; g < 400 && c.active.k < at; g++) {
    if (c.active.injury) { c = C.resolveInjury(c, D, false, false)[0]; continue }
    if (c.active.moment) { c = C.chooseMoment(c, D, c.active.moment.options[0])[0]; continue }
    c = C.advanceWeek(c, D)[0]
  }
  return [c, D, at]
}

// ── 1. invitations and the stop ──
console.log('── invitations and the break')
for (const [over, three, dunk] of [[{ jumpShot: 8, finishing: 8, bounce: 9 }, false, false], [{ jumpShot: 9, finishing: 8, bounce: 9 }, true, false], [{ jumpShot: 7, finishing: 9, bounce: 9 }, false, true], [{ jumpShot: 10, finishing: 10, bounce: 9 }, true, true]]) {
  const inv = A.invitesFor({ build: Object.fromEntries(Object.entries(over).map(([k, v]) => [k, { val: v }])) })
  ok(inv.three === three && inv.dunk === dunk, 'invite rule', JSON.stringify(over), JSON.stringify(inv))
}
let stopped = 0, hurt = 0, none = 0
for (let i = 0; i < N; i++) {
  const [c, D, at] = toBreak({ jumpShot: 10, finishing: 10, bounce: 9 }, `both-${i}`)
  const w = c.active.asw
  if (!w) { fail('no All-Star Saturday at the break', i, c.active.k, at); continue }
  ok(w.at === at, 'break game', w.at, at)
  ok(at >= 53 && at <= 55, 'break inside game 53-55', at)
  if (w.hurt) { hurt++; ok(w.done, 'a hurt invite is closed'); continue }
  stopped++
  ok(c.active.k === at, 'the run stops at the break', c.active.k, at)
  ok(w.inv.three && w.inv.dunk, 'both invites', JSON.stringify(w.inv))
  // the checks' path: the season moves on, the night is passed
  let n = c
  for (let g = 0; g < 20 && n.active.k <= at; g++) {
    if (n.active.injury) { n = C.resolveInjury(n, D, false, false)[0]; continue }
    if (n.active.moment) { n = C.chooseMoment(n, D, n.active.moment.options[0])[0]; continue }
    n = C.advanceWeek(n, D)[0]
  }
  ok(n.active.asw.done && n.active.asw.skipped && n.active.k > at, 'an open night is passed when the season moves on', n.active.k, at)
}
{
  const [c] = toBreak({ jumpShot: 6, finishing: 6, bounce: 6 }, 'none')
  if (!c.active.asw) none++
  ok(!c.active.asw, 'no invitation, no night')
}
console.log(`  ${stopped} stopped at the break, ${hurt} hurt and out, ${none} uninvited with nothing`)

// ── 2. fields ──
console.log('── fields')
const [cb] = toBreak({ jumpShot: 10, finishing: 10, bounce: 9 }, 'field')
// (the night open, whatever his health did at that break)
const c0 = { ...cb, active: { ...cb.active, asw: { at: cb.active.k, inv: { three: true, dunk: true }, done: false } } }
const mates = new Set([...(c0.roster?.guard ?? []), ...(c0.roster?.big ?? [])].map(p => p.name))
for (let y = 0; y < 8; y++) {
  const c = { ...c0, year: y, season: 2026 + y }
  const f3 = A.threeField(c), fd = A.dunkField(c)
  ok(f3.length === 8 && new Set(f3.map(x => x.name)).size === 8 && f3.filter(x => x.me).length === 1, 'three field: 8, unique, him once', f3.map(x => x.name).join(', '))
  ok(f3.filter(x => mates.has(x.name)).length <= 1, 'three field: one teammate at most')
  ok(fd.length === 4 && new Set(fd.map(x => x.name)).size === 4 && fd.filter(x => x.me).length === 1, 'dunk field: 4, unique, him once', fd.map(x => x.name).join(', '))
  if (y < 2) console.log(`  ${c.season} 3PT: ${f3.map(x => (x.me ? 'HIM' : `${x.name} (${x.js})`)).join(', ')}\n  ${c.season} DUNK: ${fd.map(x => (x.me ? 'HIM' : `${x.name} (B${x.bounce} F${x.fin})`)).join(', ')}`)
}

// ── 3. the 3-Point Contest: rivals' scores, rounds, a full night with his rounds simulated ──
console.log('── 3-Point Contest')
const hist = {}
let n3 = 0, in16 = 0, hot = 0, max = 0
for (const js of [9, 10, 11]) {
  const r = seeded(`asw3-dist-${js}`)
  let sum = 0
  for (let i = 0; i < 4000; i++) { const x = A.simThree(js, r); sum += x.points; n3++; if (x.points >= 16 && x.points <= 26) in16++; if (x.points >= 28) hot++; max = Math.max(max, x.points); ok(x.points <= 40 && x.made <= 27, 'a round inside 40 / 27') }
  hist[js] = Math.round(sum / 400) / 10
}
console.log(`  mean points by Jump Shot: A ${hist[9]} · A+ ${hist[10]} · S ${hist[11]} | 16-26: ${Math.round(in16 / n3 * 100)}% · 28+: ${(hot / n3 * 100).toFixed(1)}% · best ${max}`)
ok(in16 / n3 >= 0.7, 'most rounds 16-26'); ok(hot / n3 > 0.01 && hot / n3 < 0.08, 'the odd 28+'); ok(max <= 38, 'no round near 40', max)
const play3 = c0 => {
  let c = A.answerAllStar(c0, { three: true, dunk: false })
  for (let g = 0; g < 4; g++) {
    const P = A.threePlan(c)
    if (P.stage === 'done') return [c, P]
    c = A.recordThree(c, A.simThreeFor(c, 2, P.need.round), 2, true)
  }
  return [c, A.threePlan(c)]
}
let won3 = 0, finals3 = 0, so3 = 0
const riv3 = [], rivD = []
// the final standings: the champion first, then the rest of the final, then the first round; his place is his row's;
// places go in order and only equal scores share one
function checkStandings(P, key, tag) {
  const S = P.standings
  ok(Array.isArray(S) && S.length === P.r1.length, `${tag} standings: everyone once`, S?.length)
  ok(S[0].name === P.champ.name && S[0].champ && S[0].place === 1, `${tag} standings: the champion on top`, S[0]?.name, P.champ.name)
  ok(S.slice(0, P.finalists.length).every(r => r.through) && S.slice(P.finalists.length).every(r => !r.through), `${tag} standings: the finalists, then the rest`)
  ok(S.filter(r => r.place === 1).length === 1, `${tag} standings: one champion`)
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], b = S[i]
    ok(a.place <= b.place, `${tag} standings: places in order`, a.place, b.place)
    if (a.through === b.through && i > 1) { const va = a.through ? a.final : a.r1, vb = b.through ? b.final : b.r1; ok(va >= vb && (va === vb) === (a.place === b.place), `${tag} standings: scores in order, ties share`, a.name, va, a.place, b.name, vb, b.place) }
  }
  ok(S.find(r => r.me)?.place === P.place, `${tag} standings: his place`, P.place)
  for (const r of S) ok(r.r1 === P.r1.find(x => x.name === r.name)[key], `${tag} standings: first-round score`, r.name)
}
for (let i = 0; i < 40; i++) {
  const c1 = { ...c0, seed: `${c0.seed}-n${i}` }
  const [c, P] = play3(c1)
  ok(P.stage === 'done', '3PT night finishes')
  ok(P.r1.length === 8, 'first round: 8 shot', P.r1.length)
  ok(P.finalists.length === 3 && P.fin.length === 3, 'final: 3', P.finalists.length)
  ok(!!P.champ && P.fin.some(x => x.name === P.champ.name), 'the champion is a finalist')
  ok(P.place >= 1 && P.place <= 8, 'his place', P.place)
  if (P.champ.me) won3++
  if (P.meIn) finals3++
  if (P.ev.some(e => (e.kind === 'cut' || e.kind === 'champ') && e.tie)) so3++
  checkStandings(P, 'pts', '3PT')
  for (const x of P.r1) if (!x.me) riv3.push(x.pts)
  if (i === 0) for (const e of P.ev) if (e.kind === 'shoot' || e.kind === 'cut' || e.kind === 'champ') console.log(`   ${e.kind === 'shoot' ? `${e.round} ${e.me ? 'HIM' : e.who.name}: ${e.res.points} · ${A.threeLine(e.res, e.who.name, e.round)}` : e.kind === 'cut' ? `cut: ${e.through.join(', ')}${e.tie ? ' (shoot-off)' : ''}` : `champion: ${e.who.name} ${e.res.points}`}`)
}
console.log(`  his A+ shooter over 40 nights: final ${finals3}, titles ${won3}, nights with a shoot-off ${so3}`)
const pct = (a, f) => Math.round(a.filter(f).length / a.length * 100)
const sorted3 = [...riv3].sort((a, b) => a - b), q = (a, p) => a[Math.floor(p * (a.length - 1))]
console.log(`  rivals' first rounds: mean ${(riv3.reduce((a, b) => a + b, 0) / riv3.length).toFixed(1)}, 10th-90th ${q(sorted3, 0.1)}-${q(sorted3, 0.9)}, 15-30: ${pct(riv3, x => x >= 15 && x <= 30)}%`)
ok(pct(riv3, x => x >= 15 && x <= 30) >= 80, 'rivals mostly 15-30 in the 3-Point Contest')

// ── 4. the Slam Dunk Contest: the list, the judges, the rounds, the balance ──
console.log('── Slam Dunk Contest')
ok(DUNKS.length >= 9, 'about ten dunks', DUNKS.length)
const tiers = DUNKS.map(d => A.tierOf(d))
ok(['easy', 'medium', 'hard'].every(t => tiers.includes(t)), 'all three tiers in the list', tiers.join(','))
console.log(`  ${DUNKS.length} dunks: ${DUNKS.map(d => `${d.name} (${A.tierOf(d)})`).join(', ')}`)
{
  const r = seeded('judges')
  for (const tier of ['easy', 'medium', 'hard']) {
    const [lo, hi] = A.RANGE[tier]
    for (let q = 0; q <= 1.0001; q += 0.1) {
      const j = A.judge(tier, [{ landed: true, quality: q }], r)
      ok(j.total >= lo - 2 && j.total <= hi + 1, 'first-try range', tier, q.toFixed(1), j.total)
      ok(j.cards.every(x => x >= 6 && x <= 10) && j.cards.reduce((a, b) => a + b) === j.total, 'five cards 6-10 add up', j.cards)
      if (j.total === 50) ok(tier === 'hard' && q >= 0.88, 'a 50 only for a hard dunk at 0.9', tier, q)
      const j2 = A.judge(tier, [{ landed: false, quality: q * 0.6 }, { landed: true, quality: q }], r)
      ok(j2.total <= j.total - 2 && j2.total >= j.total - 8, 'a miss first costs about 5', tier, j.total, j2.total)
    }
    const none = A.judge(tier, [{ landed: false, quality: 0.5 }, { landed: false, quality: 0.3 }, { landed: false, quality: 0.6 }], r)
    ok(none.total >= 30 && none.total <= 35, 'nothing down: 30-34', none.total)
  }
}
const playD = c0 => {
  let c = A.answerAllStar(c0, { three: false, dunk: true })
  const order = { easy: 0, medium: 1, hard: 2 }
  for (let g = 0; g < 12; g++) {
    const P = A.dunkPlan(c)
    if (P.stage === 'done') return [c, P]
    const used = new Set(P.need.used)
    const d = [...DUNKS].filter(x => !used.has(x.id)).sort((a, b) => order[A.tierOf(b)] - order[A.tierOf(a)])[g % 3] ?? DUNKS[0]
    c = A.simDunkFor(c, d.id, `${P.need.round}-${P.need.n}`)
  }
  return [c, A.dunkPlan(c)]
}
let wonD = 0, finD = 0, offs = 0, fifties = 0, dunks = 0
for (let i = 0; i < 40; i++) {
  const c1 = { ...c0, seed: `${c0.seed}-d${i}` }
  const [c, P] = playD(c1)
  ok(P.stage === 'done', 'dunk night finishes')
  const r1 = P.ev.filter(e => e.kind === 'dunk' && e.round === 'r1'), fin = P.ev.filter(e => e.kind === 'dunk' && e.round === 'final')
  ok(r1.length === 8 && fin.length === 4, 'first round 4x2, final 2x2', r1.length, fin.length)
  ok(P.finalists.length === 2, 'two in the final')
  for (const e of P.ev.filter(e => e.kind === 'dunk')) {
    dunks++; if (e.perfect) fifties++
    ok(e.total >= 30 && e.total <= 50, 'a dunk 30-50', e.total)
    ok(e.tries.length >= 1 && e.tries.length <= 3, 'one to three tries')
  }
  // no dunk landed twice by one man
  const by = new Map()
  for (const e of P.ev.filter(e => e.kind === 'dunk' && e.landed)) { const k = `${e.who.name}|${e.dunk.id}`; ok(!by.has(k), 'no repeat of a landed dunk', k); by.set(k, 1) }
  checkStandings(P, 'sum', 'DUNK')
  for (const r of P.standings) { ok((r.r1Dunks ?? []).reduce((a, b) => a + b, 0) === r.r1, 'dunk standings: the first round\'s dunks add up', r.name); if (r.through) ok(r.finalDunks.reduce((a, b) => a + b, 0) === r.final, 'dunk standings: the final\'s dunks add up', r.name) }
  for (const e of P.ev) if (e.kind === 'dunk' && !e.me) rivD.push(e.total)
  if (P.champ.me) wonD++
  if (P.meIn) finD++
  if (P.ev.some(e => e.kind === 'round' && e.round.includes('off'))) offs++
  if (i === 0) for (const e of P.ev) if (e.kind === 'dunk') console.log(`   ${e.round} ${e.me ? 'HIM' : e.who.name}: ${e.dunk.name} (${e.tier}) ${e.cards.join('-')} = ${e.total} · ${A.dunkLine(e, e.who.name)}`)
  const done = A.finishAllStar(c)
  ok(done.active.asw.done && done.active.asw.res.dunk, 'the night is booked')
}
console.log(`  his dunker over 40 nights: final ${finD}, titles ${wonD}, dunk-offs ${offs}, 50s ${fifties} of ${dunks} dunks`)
console.log(`  rivals' dunks: mean ${(rivD.reduce((a, b) => a + b, 0) / rivD.length).toFixed(1)}, 40-50: ${pct(rivD, x => x >= 40)}%, under 36 (nothing down, or two misses first): ${pct(rivD, x => x < 36)}%`)
ok(pct(rivD, x => x >= 40) >= 70, 'rivals mostly 40-50 a dunk')

console.log('── balance: a dunk\'s expected total by tier (the engine\'s measured landing rates, 11-24: easy 93/96%, medium 77/88%, hard 53/64% a try at v 9/11)')
console.log('  v     tier     mean   landed 1st try   nothing down   47 or more')
const fmtB = (v, t, b) => `  ${String(v).padEnd(5)} ${t.padEnd(8)} ${String(b.mean).padEnd(6)} ${`${b.first}%`.padEnd(16)} ${`${b.blank}%`.padEnd(14)} ${b.big}%`
for (const v of [9, 10, 11]) {
  const b = A.dunkBalance(v)
  for (const t of ['easy', 'medium', 'hard']) console.log(fmtB(v, t, b[t]))
  ok(b.hard.mean > b.medium.mean && b.medium.mean > b.easy.mean, 'harder pays on average for a strong dunker', v, JSON.stringify(b))
  ok(b.hard.blank > b.easy.blank * 10, 'missing a hard one hurts', v)
}

// ── 4b. a game left before it finished (a reload): the Career rule, counted as a miss ──
{
  let c = A.answerAllStar(c0, { three: true, dunk: true })
  c = A.settleLive(A.markLive(c, 'three', { round: 'r1', rack: 3 }))
  ok(c.active.asw.three.mine.length === 1 && !c.active.asw.three.live && c.active.asw.three.mine[0].sim, 'a 3PT round left open is shot cold')
  c = A.settleLive(A.markLive(c, 'dunk', { dunk: DUNKS[0].id }))
  ok(c.active.asw.dunk.cur?.tries?.length === 1 && !c.active.asw.dunk.cur.tries[0].landed && !c.active.asw.dunk.live, 'a dunk attempt left open is a miss')
}
// ── 5. on the season: booked, honors, totals, and no legacy from it ──
console.log('── the season keeps it')
{
  let [c] = play3({ ...c0, seed: 'champ-try' })
  c = A.finishAllStar(c)
  ok(c.active.asw.done && c.active.asw.res.three, 'the 3PT result is kept')
  const feed = c.active.feed.filter(e => e.noteKind === '3-POINT CONTEST')
  ok(feed.length === 1, 'one line in the feed', feed.length)
  ok(c.events.some(e => /3-Point Contest/.test(e.text)), 'a line in the story')
  // a title, for the honors and the totals
  const t = { ...c, active: { ...c.active, asw: { ...c.active.asw, res: { three: { ...c.active.asw.res.three, won: true, place: 1 }, dunk: { won: true, place: 1, r1: 90, final: 95, champ: c.name, champPts: 95, best: null } } } } }
  const L0 = C.legacyOf(c0).score
  let D = C.resumeSeason(t), x = t
  for (let g = 0; g < 400 && x.active.k < D.total; g++) { if (x.active.injury) { x = C.resolveInjury(x, D, false, false)[0]; continue } if (x.active.moment) { x = C.chooseMoment(x, D, x.active.moment.options[0])[0]; continue } x = C.advanceWeek(x, D)[0] }
  x = C.finishRegular(x, D)
  for (let g = 0; g < 40 && x.phase === 'season' && x.active?.po && x.active.po.stage !== 'done'; g++) x = C.playoffRound(x, null)
  if (x.phase === 'season') x = C.bookSeason(x)
  const s = x.seasons[x.seasons.length - 1]
  ok(s.asw?.three?.won && s.asw?.dunk?.won, 'the season record has both titles', JSON.stringify(s.asw))
  const tt = C.careerTotals(x)
  ok(tt.threeTitles === 1 && tt.dunkTitles === 1, 'career totals count them', tt.threeTitles, tt.dunkTitles)
  const noAsw = { ...x, seasons: x.seasons.map(q => { const { asw, ...rest } = q; return rest }) }
  ok(C.legacyOf(x).score === C.legacyOf(noAsw).score, 'no legacy from a contest title', C.legacyOf(x).score, C.legacyOf(noAsw).score)
  console.log(`  booked: ${JSON.stringify(s.asw)} · legacy ${C.legacyOf(x).score} with the titles, ${C.legacyOf(noAsw).score} without (before the season ${L0})`)
}

console.log(bad ? `${bad} problems` : 'All-Star Saturday: 0 problems')
await server.close()
process.exit(bad ? 1 : 0)
