// Do the key moments he plays show up in the game they're in? (the owner, 2026-11-26: "if you get a goal of course that
// should be reflected in stats and score etc."). Careers in every sport played to the playoffs through lib/career.js
// (loaded the way the app loads it, through Vite), every round played with the moment forced: landed, missed, landed
// with the drill's own report (a goal, a squared tap-in, a touchdown), missed with it (saved, wide). Checks:
//   the board   the final is the play plus the rest of the game (soccer: the legs add up, the moment's goal is on the
//               board once: landed minus missed is one goal in that leg, the rest of the tie the same)
//   his line    a goal he scored is in his goals, a squared one in his assists, a missed chance a shot (saved: on target,
//               a penalty in his penalties), never a goal; goals and assists fit on the board; a touchdown the play
//               scored is in his line, a drive's later touchdown isn't (a kick return's); a bucket is in his points
//   the season  the tie's goals are in the season's cup / Europe / international goals and its total
//   the league  soccer's in-match moments (lib/soccerSeason.js): the game rewritten, his line in it (goals, assists,
//               shots, on target, xG, penalties, rating) fits the board, and the season's totals are the games'
// node scripts/moments/consistency-check.mjs [careers-per-position]
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const { momentFacts } = await server.ssrLoadModule('/src/lib/situations.js')
const { playMoment } = await server.ssrLoadModule('/src/lib/inGame.js')
const N = Number(process.argv[2] ?? 3)

const buildFor = (S, pos, r) => {
  const pool = S.pool[pos].filter(p => p.attrs), b = {}
  for (const t of S.types[pos]) {
    let p = pool[Math.floor(r() * pool.length)]
    for (let j = 0; j < 5; j++) { const q = pool[Math.floor(r() * pool.length)]; if ((q.attrs?.[t] ?? 0) > (p.attrs?.[t] ?? 0)) p = q }
    b[t] = { type: t, val: p.attrs?.[t] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, pos: p.pos }
  }
  return b
}
let bad = 0, rounds = 0, leagueMoments = 0
const fail = (...a) => { bad++; if (bad < 60) console.log('  FAIL', ...a) }
const SX = { soccer: await server.ssrLoadModule('/src/lib/careerSoccer.js') }
// the regular season (his in-match moments on: each option in turn), checked as it goes; then the playoffs
function toPlayoffs(c0, label) {
  let c = C.skipCombine(c0); c = C.runDraft(c)
  if (!c.team && c.draft?.offers?.length && SX[c.sport]?.signAcademy) c = SX[c.sport].signAcademy(c, c.draft.offers[0])
  let D; [c, D] = C.startSeason(c)
  let guard = 0, pick = 0
  while (c.active.k < D.total && guard++ < 900) {
    if (C.byeNow?.(c)) { c = C.byeRest(c, D); continue }
    if (c.active.injury) { const [n] = C.resolveInjury(c, D, false, false); c = n; continue }
    if (c.active.moment) {
      const m = c.active.moment, opts = m.options, opt = opts[pick++ % opts.length]
      const [n, out] = C.chooseMoment(c, D, opt); c = n
      if (c.sport === 'soccer') leagueCheck(D, m, out, label)
      continue
    }
    const [n] = C.advanceWeek(c, D); c = n
  }
  if (c.sport === 'soccer') {
    const t = D.totals(), played = D.games.filter(g => !g.sat)
    const sum = k => Math.round(played.reduce((s, g) => s + (g[k] ?? 0), 0) * 100) / 100
    if (t.seasonGoals !== sum('goals') || t.seasonShots !== sum('shots') || t.seasonAssists !== sum('assists')) fail(label, 'SEASON TOTALS ARE NOT THE GAMES', t.seasonGoals, sum('goals'), t.seasonShots, sum('shots'))
  }
  c = C.finishRegular(c, D)
  return c.active?.po && c.active.po.stage !== 'done' && !c.active.out ? c : null
}
// a soccer in-match moment (lib/soccerSeason.js): the match as rewritten
function leagueCheck(D, m, out, label) {
  const g = D.games[m.stop.at]
  if (!g?.moment) return
  leagueMoments++
  const sc = `${g.mySc}–${g.oppSc}`, said = (out?.line ?? '').match(/\d+–\d+/g)
  if (said && said.at(-1) !== sc) fail(label, 'LINE SAYS', said.at(-1), 'BOARD', sc, out.line)
  if (g.goals > g.mySc) fail(label, 'MORE GOALS THAN THE BOARD', g.goals, sc)
  if (g.goals + g.assists > g.mySc) fail(label, 'GOALS + ASSISTS PAST THE BOARD', g.goals, g.assists, sc)
  if (g.sot > g.shots) fail(label, 'ON TARGET PAST SHOTS', g.sot, g.shots)
  if ((g.goals ?? 0) - (g.pens ?? 0) > g.sot) fail(label, 'GOALS PAST ON TARGET', g.goals, g.pens, g.sot)
  // (Career's league matches keep no pensTaken: lib/careerSoccer.js lgGame)
  if (g.pensTaken != null && (g.pens ?? 0) > g.pensTaken && !g.moment) fail(label, 'PENS PAST TAKEN', g.pens, g.pensTaken)
  if (g.rating != null && (g.rating > 10 || g.rating < 4.5)) fail(label, 'RATING', g.rating)
  if ((g.won ? 1 : 0) + (g.drawn ? 1 : 0) + (g.lost ? 1 : 0) !== 1 || g.won !== g.mySc > g.oppSc || g.drawn !== (g.mySc === g.oppSc)) fail(label, 'RESULT AND BOARD DISAGREE', sc, g.result)
}
const SOC_REPORTS = game => [
  ['hit', true, null], ['miss', false, null], ['hit, a goal', true, { res: 'goal' }], ['miss, saved', false, { res: 'saved' }], ['miss, wide', false, { res: game === 'penalty' ? 'over' : 'wide' }],
  ...(game === 'two-on-one' ? [['hit, squared', true, { res: 'goal', assist: true }], ['miss, cut out', false, { res: 'cut' }]] : []),
]
const FB_TD = new Set(['hot-read', 'bomb', 'escape', 'third-long', 'audible', 'catch', 'juke-wr', 'release', 'juke-te', 'gap', 'juke', 'goal-line', 'two-minute', 'sneak', 'kick-return'])
const tdsOf = e => (e.tds ?? 0) + (e.rushTDs ?? 0) + (e.recTDs ?? 0) + (e.retTDs ?? 0)
function soccerRound(x, po, rd, game, label) {
  const plan = C.playoffPlan(x, po, undefined, game).plan
  const runs = {}
  for (const [tag, hit, raw] of SOC_REPORTS(game)) {
    const y = C.playoffRound(x, hit ? 0.7 : 0.3, game, hit, raw), e = y.active.po.line.at(-1)
    const res = playMoment(plan, hit, momentFacts(game, raw, hit), raw)
    runs[tag] = { e, res, y }
    rounds++
    const L = `${label} ${rd.name} ${game} [${tag}]`
    const my = e.legs.reduce((s, l) => s + l[0], 0), op = e.legs.reduce((s, l) => s + l[1], 0)
    if (my !== e.mySc || op !== e.oppSc) fail(L, 'LEGS DON\'T ADD UP', JSON.stringify(e.legs), e.mySc, e.oppSc)
    if (JSON.stringify(e.legs) !== JSON.stringify(res.legs)) fail(L, 'BOARD IS NOT THE MOMENT\'S GAME', JSON.stringify(e.legs), JSON.stringify(res.legs))
    if (e.won !== res.won) fail(L, 'RESULT IS NOT THE MOMENT\'S GAME')
    if (!e.won === (e.mySc > e.oppSc) && !e.pens) fail(L, 'WON WITH FEWER GOALS', e.mySc, e.oppSc, e.won)
    if (e.goals > e.mySc || e.goals + e.assists > e.mySc) fail(L, 'HIS LINE PAST THE BOARD', e.goals, e.assists, e.mySc)
    const squared = !!raw?.assist && hit
    if (hit && !squared && e.goals < 1) fail(L, 'SCORED, NO GOAL IN HIS LINE')
    if (hit && !squared && !e.mGoal) fail(L, 'SCORED, NOT MARKED AS HIS')
    if (squared && (e.assists < 1 || e.mGoal)) fail(L, 'SQUARED, NO ASSIST', e.assists, e.mGoal)
    if (!hit && e.mGoal) fail(L, 'MISSED, BUT A MOMENT GOAL')
    const npg = e.goals - (e.pensScored ?? 0)
    if (e.shots < npg || e.sot < npg || e.sot > e.shots) fail(L, 'SHOTS', e.shots, e.sot, e.goals)
    const shotMoment = !(squared) && !['cut', 'late', 'cleared'].includes(raw?.res)
    if (game === 'penalty' && shotMoment && (e.pensTaken ?? 0) < 1) fail(L, 'PENALTY NOT IN HIS PENALTIES')
    if (game !== 'penalty' && shotMoment && e.shots < 1) fail(L, 'THE CHANCE IS NO SHOT')
    if (game !== 'penalty' && raw?.res === 'saved' && e.sot < 1) fail(L, 'SAVED, NOT ON TARGET')
    if (!(e.xg >= 0)) fail(L, 'XG', e.xg)
  }
  // the moment's goal is on the board once: landed minus missed is one goal in the moment's leg (when the tie ended in
  // ninety, both ways), the other leg the same
  const h = runs.hit.res, m = runs.miss.res
  if (h.et == null && m.et == null && !h.pens && !m.pens) {
    const at = plan.b.leg === 1 && h.legs.length === 2 ? 0 : h.legs.length - 1
    h.legs.forEach((l, i) => {
      const d0 = l[0] - m.legs[i][0], d1 = l[1] - m.legs[i][1]
      if (d0 !== (i === at ? 1 : 0) || d1 !== 0) fail(`${label} ${rd.name}`, 'LANDED VS MISSED IS NOT ONE GOAL', JSON.stringify(h.legs), JSON.stringify(m.legs))
    })
  }
  return runs
}
function seasonCheck(y, label) {
  const po = y.active.po
  if (po.stage !== 'done') return
  const n = C.bookSeason(y), s = n.seasons.at(-1), st = s.stats
  const line = po.line.filter(x => !x.sat && !x.intl)
  const sum = (list, k) => list.reduce((a, x) => a + (x[k] ?? 0), 0)
  if (st.goals !== st.lgGoals + (st.cupGoals ?? 0) + (st.euroGoals ?? 0)) fail(label, 'SEASON GOALS ARE NOT LEAGUE + CUP + EUROPE', st.goals, st.lgGoals, st.cupGoals, st.euroGoals)
  if ((st.euroGoals ?? 0) < sum(line.filter(x => x.track === 'europe'), 'goals')) fail(label, 'EUROPE GOALS MISS THE KNOCKOUTS', st.euroGoals, sum(line.filter(x => x.track === 'europe'), 'goals'))
  if ((st.cupGoals ?? 0) < sum(line.filter(x => x.track === 'cup'), 'goals')) fail(label, 'CUP GOALS MISS THE FINAL')
  for (const [k, t] of [['wc', s.wc], ['cont', s.cont]]) {
    if (!t?.played) continue
    const ko = po.line.filter(x => x.track === k)
    if ((t.goals ?? 0) < sum(ko, 'goals')) fail(label, `${k} GOALS MISS THE KNOCKOUTS`, t.goals, sum(ko, 'goals'))
  }
}
const CASES = [['soccer', 'st'], ['nfl', 'qb'], ['nfl', 'rb'], ['nfl', 'wr'], ['nfl', 'te'], ['nfl', 'db'], ['nfl', 'k'], ['bucket', 'guard'], ['bucket', 'big']]
const only = process.argv[3]
for (const [sport, pos] of CASES.filter(x => !only || x[0] === only)) {
  if (C.ensureSport) await C.ensureSport(sport)
  const S = C.SPORT[sport]
  if (!S?.pool?.[pos]) { console.log(sport, pos, 'not in this build'); continue }
  const before = bad
  let got = 0
  for (let i = 0; i < N; i++) {
    let c = null
    for (let t = 0; t < 25 && !c; t++) {
      const rt = seeded(`ccheck-${sport}-${pos}-${i}-${t}`)
      try { c = toPlayoffs(C.newCareer({ sport, pos, build: buildFor(S, pos, rt), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 }), `${sport}/${pos}#${i}`) } catch (e) { if (t === 24) console.log(sport, pos, i, 'career failed:', e.message) }
    }
    if (!c) { console.log(sport, pos, i, 'no playoffs found'); continue }
    got++
    // the playoffs: every way the moment can go, and on along the landed one (soccer: on along each, to the season's book)
    for (const path of sport === 'soccer' ? ['hit', 'miss'] : ['hit']) {
      let x = c
      for (let g = 0; g < 10 && x.active.po.stage !== 'done'; g++) {
        const po = x.active.po, rd = po.rounds[po.idx], label = `${sport}/${pos}#${i}`
        try {
          const game = C.playoffGame(x, po)
          if (sport === 'soccer') {
            if (rd.close === false) { x = C.playoffRound(x, 0.5); continue }
            const runs = soccerRound(x, po, rd, game, label)
            x = runs[path].y
            continue
          }
          const reports = [['hit', true, null], ['miss', false, null], ...(sport === 'nfl' && FB_TD.has(game) && pos !== 'k' ? [['hit, a touchdown', true, { pts: 7, tds: 1 }]] : []), ...(sport === 'bucket' ? [['hit, a three', true, { pts: 3, made: 1, of: 1 }]] : [])]
          let next = null
          for (const [tag, hit, raw] of reports) {
            const y = C.playoffRound(x, hit ? 0.7 : 0.3, game, hit, raw), e = y.active.po.line.at(-1)
            rounds++
            const L = `${label} ${rd.name} ${game} [${tag}]`
            if (!rd.series && (e.mySc > e.oppSc) !== e.won) fail(L, 'BOARD AND RESULT DISAGREE', e.mySc, e.oppSc)
            if (sport === 'nfl' && !rd.series) {
              if (tdsOf(e) > Math.floor(e.mySc / 6)) fail(L, 'MORE TOUCHDOWNS THAN THE BOARD', tdsOf(e), e.mySc)
              if (raw?.pts === 7 && ['qb', 'rb', 'wr', 'te'].includes(pos) && tdsOf(e) < 1) fail(L, 'HIS TOUCHDOWN ISN\'T IN HIS LINE')
              if (raw?.pts === 7 && e.mySc < 7) fail(L, 'HIS TOUCHDOWN ISN\'T ON THE BOARD', e.mySc)
              if (game === 'kick-return' && !raw && e.retTDs) fail(L, 'A RETURN TOUCHDOWN NOBODY RAN BACK')
            }
            if (sport === 'bucket' && !rd.series && raw?.pts === 3 && e.pts < 3) fail(L, 'HIS THREE ISN\'T IN HIS POINTS', e.pts)
            if (tag === 'hit') next = y
          }
          x = next
        } catch (e) { fail(`${sport}/${pos}#${i}`, rd?.name, 'THREW', e.stack.split('\n').slice(0, 3).join(' | ')); break }
      }
      if (sport === 'soccer') try { seasonCheck(x, `${sport}/${pos}#${i} (${path})`) } catch (e) { fail(`${sport}/${pos}#${i}`, 'BOOKING THREW', e.stack.split('\n').slice(0, 3).join(' | ')) }
    }
  }
  console.log(`${sport}/${pos}: ${got} careers, ${bad - before} problems`)
}
console.log(`${rounds} rounds, ${leagueMoments} league moments, ${bad} problems`)
await server.close()
process.exit(bad ? 1 : 0)
