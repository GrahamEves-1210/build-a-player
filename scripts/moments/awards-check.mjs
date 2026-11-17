// Career football's award races and the vote (lib/careerAwards.js, lib/career.js raceNow / bookSeason).
//   A  the league alone, many seasons: who wins each award (by position) and the winners' typical lines
//   B  his season set against that field, on a grid of lines: where he finishes in the vote (and how often he wins)
//   C  whole careers' seasons played the way the Career screen plays them, by position: his line and whether he won,
//      and the line it takes (the lowest seasons that won, the best that didn't); the awards before this change
//      (S.award, still in lib/career.js) on the same seasons, for comparison
// Run from the repo root:  node scripts/moments/awards-check.mjs [A-seasons] [B-seeds] [C-seasons-per-position]
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
const A = await server.ssrLoadModule('/src/lib/careerAwards.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const NA = Number(process.argv[2] ?? 300), NB = Number(process.argv[3] ?? 60), NC = Number(process.argv[4] ?? 0)
const S = C.SPORT.nfl
const buildFor = (pos, r, best = 6) => {
  const pool = S.pool[pos].filter(p => p.attrs), b = {}
  for (const t of S.types[pos]) {
    let p = pool[Math.floor(r() * pool.length)]
    for (let j = 1; j < best; j++) { const q = pool[Math.floor(r() * pool.length)]; if ((q.attrs?.[t] ?? 0) > (p.attrs?.[t] ?? 0)) p = q }
    b[t] = { type: t, val: p.attrs?.[t] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, pos: p.pos }
  }
  return b
}
const career = (pos, i, best = 6) => { let c = C.newCareer({ sport: 'nfl', pos, build: buildFor(pos, seeded(`aw-${pos}-${i}`), best), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 }); c = C.skipCombine(c); return C.runDraft(c) }
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }

// ── A: the field alone ──
if (NA) {
  const c0 = career('wr', 0)
  const field = C.__race.field(c0)
  const byPos = { MVP: {}, OPOY: {}, DPOY: {} }, lines = { MVP: [], OPOY: [], DPOY: [] }
  for (let i = 0; i < NA; i++) {
    const seasons = A.leagueSeasons(field, `fieldA-${i}`)
    const v = A.seasonVote(seasons, null, `fieldA-${i}`)
    for (const K of A.RACE_AWARDS) { const w = v[K].rows[0]; byPos[K][w.g] = (byPos[K][w.g] ?? 0) + 1; lines[K].push(`${w.g} ${w.line}`) }
  }
  console.log(`A. the league alone, ${NA} seasons`)
  for (const K of A.RACE_AWARDS) {
    console.log(`  ${K}: ${Object.entries(byPos[K]).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${(n / NA * 100).toFixed(0)}%`).join(', ')}`)
    console.log(`     e.g. ${lines[K].slice(0, 6).join(' | ')}`)
  }
}

// ── B: his line against the field ──
if (NB) {
  console.log(`\nB. his season against the field (${NB} seasons each): place in the vote, how often he wins`)
  const GRID = [
    ['qb', 'QB 4,000 yds 30 TD 11 INT, 11-6', { passYds: 4000, tds: 30, ints: 11, rushYds: 200, rushTDs: 1 }, 11],
    ['qb', 'QB 4,700 yds 41 TD 9 INT, 13-4', { passYds: 4700, tds: 41, ints: 9, rushYds: 250, rushTDs: 2 }, 13],
    ['qb', 'QB 5,200 yds 48 TD 8 INT, 14-3', { passYds: 5200, tds: 48, ints: 8, rushYds: 250, rushTDs: 3 }, 14],
    ['rb', 'RB 1,500 rush 14 TD, 10-7', { rushYds: 1500, recYds: 300, rushTDs: 13, recTDs: 1, tds: 14 }, 10],
    ['rb', 'RB 2,000 rush 18 TD, 11-6', { rushYds: 2000, recYds: 350, rushTDs: 16, recTDs: 2, tds: 18 }, 11],
    ['rb', 'RB 2,250 rush 22 TD, 12-5', { rushYds: 2250, recYds: 400, rushTDs: 20, recTDs: 2, tds: 22 }, 12],
    ['wr', 'WR 1,400 yds 10 TD 95 rec, 10-7', { recs: 95, recYds: 1400, tds: 10 }, 10],
    ['wr', 'WR 1,750 yds 13 TD 115 rec, 11-6', { recs: 115, recYds: 1750, tds: 13 }, 11],
    ['wr', 'WR 2,100 yds 10 TD 125 rec, 9-8', { recs: 125, recYds: 2100, tds: 10 }, 9],
    ['wr', 'WR 2,100 yds 16 TD 135 rec, 12-5', { recs: 135, recYds: 2100, tds: 16 }, 12],
    ['dl', 'EDGE 14 sacks 18 TFL, 10-7', { sacks: 14, tfl: 18, ff: 3, qbHits: 28, tackles: 50 }, 10],
    ['dl', 'EDGE 20 sacks 24 TFL, 11-6', { sacks: 20, tfl: 24, ff: 5, qbHits: 36, tackles: 55 }, 11],
    ['dl', 'EDGE 24 sacks 28 TFL, 13-4', { sacks: 24, tfl: 28, ff: 6, qbHits: 40, tackles: 58 }, 13],
    ['db', 'CB 7 INT 18 PD, 10-7', { ints: 7, pbus: 18, tackles: 60, pickSixes: 1, ff: 1, tfl: 2 }, 10],
    ['db', 'CB 11 INT 24 PD, 11-6', { ints: 11, pbus: 24, tackles: 62, pickSixes: 2, ff: 1, tfl: 2 }, 11],
    ['lb', 'LB 150 TKL 8 sacks 3 INT, 11-6', { tackles: 150, sacks: 8, ints: 3, tfl: 16, pds: 8, ff: 3 }, 11],
  ]
  for (const [pos, label, stats, wins] of GRID) {
    const c0 = career(pos, 1)
    const award = C.raceAward(c0)
    const pl = { own: [], mvp: [] }
    for (let i = 0; i < NB; i++) {
      const c = { ...c0, seed: `${c0.seed}-B${i}` }
      const v = C.__race.vote(c, stats, wins, 1)
      pl.own.push(v[award].place ?? 99); pl.mvp.push(v.MVP.place ?? 99)
    }
    const top = (a, n) => `${(a.filter(x => x <= n).length / a.length * 100).toFixed(0)}%`
    console.log(`  ${label.padEnd(36)} ${award.padEnd(4)} wins ${top(pl.own, 1).padStart(4)}, top 3 ${top(pl.own, 3).padStart(4)}, median place ${med(pl.own)}${award !== 'MVP' ? ` | MVP wins ${top(pl.mvp, 1).padStart(4)}, top 5 ${top(pl.mvp, 5).padStart(4)}, median ${med(pl.mvp)}` : ''}`)
  }
}

// ── C: whole careers ──
if (NC) {
  console.log(`\nC. careers played, ${NC} seasons a position`)
  const POS = ['qb', 'rb', 'wr', 'te', 'dl', 'lb', 'db']
  const KEY = { qb: s => `${s.passYds} yds ${s.tds} TD ${s.ints} INT ${s.rushYds} rush`, rb: s => `${s.rushYds} rush ${s.tds} TD`, wr: s => `${s.recs} rec ${s.recYds} yds ${s.tds} TD`, te: s => `${s.recs} rec ${s.recYds} yds ${s.tds} TD`, dl: s => `${s.sacks} sacks ${s.tfl} TFL`, lb: s => `${s.tackles} TKL ${s.sacks} sk ${s.ints} INT`, db: s => `${s.ints} INT ${s.pbus} PD` }
  const MAIN = { qb: s => s.tds + (s.rushTDs ?? 0), rb: s => s.rushYds, wr: s => s.recYds, te: s => s.recYds, dl: s => s.sacks, lb: s => s.tackles + 10 * s.sacks, db: s => s.ints }
  for (const pos of POS) {
    const rows = []
    for (let i = 0; rows.length < NC && i < NC * 3; i++) {
      let c = career(pos, 100 + i, 3 + (i % 4))
      for (let y = 0; y < 4 && rows.length < NC; y++) {
        let D; [c, D] = C.startSeason(c)
        let g = 0
        while (c.active.k < D.total && g++ < 900) {
          if (C.byeNow?.(c)) { c = C.byeRest(c, D); continue }
          if (c.active.injury) { const [n] = C.resolveInjury(c, D, false, false); c = n; continue }
          if (c.active.moment) { const [n] = C.chooseMoment(c, D, c.active.moment.options[0]); c = n; continue }
          const [n] = C.advanceWeek(c, D); c = n
        }
        const f = D.finalize()
        const st = C.seasonStats(c.pos, f)
        const old = C.SPORT.nfl.award(c, f, st)
        c = C.finishRegular(c, D)
        for (let k = 0; k < 8 && c.active?.po && c.active.po.stage !== 'done'; k++) { const po = c.active.po, game = C.playoffGame(c, po), hit = seeded(`mg-${c.seed}-${c.year}-${po.idx}`)() < C.momentHitRate(c, game); c = C.playoffRound(c, hit ? 0.7 : 0.3, game, hit, null) }
        if (c.phase !== 'offseason') c = C.bookSeason(c)
        const s = c.seasons.at(-1)
        rows.push({ s: s.stats, w: s.wins, award: !!s.award, name: s.awardName, old, place: s.race?.[C.raceAward(c)]?.place, mvp: s.race?.MVP?.place, starter: s.benched === 0 })
        // (on to the next season: the offseason's steps, signed where he can be)
        if (c.offers?.length) c = C.signOffer(c, c.offers[0])
        c = C.nextSeason(c)
      }
    }
    const won = rows.filter(x => x.award), lost = rows.filter(x => !x.award && x.starter)
    const by = MAIN[pos]
    const lowWon = [...won].sort((a, b) => by(a.s) - by(b.s)).slice(0, 2), hiLost = [...lost].sort((a, b) => by(b.s) - by(a.s)).slice(0, 2)
    const mvps = rows.filter(x => /MVP/.test(x.name) && x.award).length
    console.log(`  ${pos.toUpperCase()}: ${rows.length} seasons, won ${won.length} (${(won.length / rows.length * 100).toFixed(0)}%; before: ${rows.filter(x => x.old).length})${pos !== 'qb' ? `, MVPs ${mvps}` : ''}; top 3 in his race ${rows.filter(x => (x.place ?? 99) <= 3).length}`)
    for (const x of lowWon) console.log(`     won with   ${KEY[pos](x.s)}, ${x.w} wins (${x.name})`)
    for (const x of hiLost) console.log(`     lost with  ${KEY[pos](x.s)}, ${x.w} wins: ${x.place ?? '-'}${x.place ? ['st', 'nd', 'rd'][x.place - 1] ?? 'th' : ''} in the vote`)
  }
}
await server.close()
process.exit(0)
