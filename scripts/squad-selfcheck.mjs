// Squad Builder self-check: plays a few squad seasons in each sport and checks that
// the squad shares one season. Run: node scripts/squad-selfcheck.mjs
//   • one shared record: every build's own sim lands on the squad's W–L (and title)
//   • wins + losses = the games on the schedule (17 / 82)
//   • every build has a stat line
//   • at most one MVP a season
// The game code is loaded through Vite (it reads import.meta.env and JSON).
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
let failed = false
try {
  const { runSquadSeason, TYPES_OF } = await vite.ssrLoadModule('/src/lib/squadSeason.js')
  const { newSquad, fillSlot, CAPS } = await vite.ssrLoadModule('/src/lib/squad.js')
  const { QBS } = await vite.ssrLoadModule('/src/data/qbs.js')
  const { RBS } = await vite.ssrLoadModule('/src/data/rbs.js')
  const { WRS } = await vite.ssrLoadModule('/src/data/wrs.js')
  const { TES } = await vite.ssrLoadModule('/src/data/tes.js')
  const { DBS } = await vite.ssrLoadModule('/src/data/dbs.js')
  const { NBA_GUARD_PLAYERS } = await vite.ssrLoadModule('/src/data/nba-guards.js')
  const { NBA_BIG_PLAYERS } = await vite.ssrLoadModule('/src/data/nba-bigs.js')
  const { NFL_TEAMS } = await vite.ssrLoadModule('/src/data/nfl-teams.js')
  const { NBA_TEAMS } = await vite.ssrLoadModule('/src/data/nba-teams.js')
  const POOL = { qb: QBS, rb: RBS, wr: WRS, te: TES, db: DBS, guard: NBA_GUARD_PLAYERS, big: NBA_BIG_PLAYERS }

  // a build the way the spins make one: each trait the best of a few real players spun
  let k = 1
  const rand = () => { k = (k * 16807) % 2147483647; return k / 2147483647 }
  const buildFor = pos => {
    const pool = POOL[pos].filter(p => p.attrs)
    return Object.fromEntries(TYPES_OF[pos].map(t => {
      const p = [0, 1, 2, 3].map(() => pool[Math.floor(rand() * pool.length)]).sort((a, b) => (b.attrs[t] ?? 0) - (a.attrs[t] ?? 0))[0]
      return [t, { type: t, val: p.attrs[t] ?? 5, qb: p.short, qbFull: p.name, team: p.team }]
    }))
  }
  const squadOf = (sport, picks, team) => {
    let sq = newSquad({ sport, uid: null, picks })
    for (const s of sq.slots) sq = fillSlot(sq, s.id, buildFor(s.pos), TYPES_OF[s.pos], false)
    return { ...sq, team }
  }
  const full = sport => Object.entries(CAPS[sport]).flatMap(([pos, n]) => Array(n).fill(pos))

  const cases = [
    ['nfl', ['qb'], 'KC'], ['nfl', ['wr', 'wr', 'db'], 'CHI'], ['nfl', full('nfl'), 'NYJ'], ['nfl', ['rb', 'rb', 'te', 'te'], 'DET'],
    ['bucket', ['guard'], 'OKC'], ['bucket', ['guard', 'big'], 'WAS'], ['bucket', full('bucket'), 'LAL'], ['bucket', ['big', 'big'], 'BOS'],
  ]
  let n = 0
  for (const [sport, picks, team] of cases) {
    const teams = sport === 'bucket' ? NBA_TEAMS : NFL_TEAMS
    assert.ok(teams.some(t => t.short === team), `${team} is a ${sport} team`)
    let sq = squadOf(sport, picks, team)
    for (let season = 1; season <= 3; season++) {
      const { result, raw } = runSquadSeason(sq, { raw: true })
      const games = sport === 'bucket' ? 82 : 17
      assert.equal(result.wins + result.losses, games, `${sport} ${team}: wins + losses = ${games}`)
      assert.equal(result.lines.length, sq.slots.length, 'a line for every build')
      raw.forEach((r, i) => {
        assert.equal(r.wins, result.wins, `build ${i} shares the record (wins)`)
        assert.equal(r.losses, result.losses, `build ${i} shares the record (losses)`)
        assert.equal(sport === 'bucket' ? !!r.champion : !!r.sbResult?.won, !!result.champion, `build ${i} shares the title`)
      })
      for (const l of result.lines) {
        assert.ok(Array.isArray(l.stats) && l.stats.length >= 3, `${l.pos} has a stat line`)
        for (const [label, v] of l.stats) assert.ok(Number.isFinite(+v), `${l.pos} ${label} is a number (${v})`)
      }
      const mvps = result.lines.filter(l => l.award?.won && l.award.name === 'MVP').length
      assert.ok(mvps <= 1, 'at most one MVP')
      // the same season plays back the same way
      assert.deepEqual(runSquadSeason(sq).lines.map(l => l.stats), result.lines.map(l => l.stats), 'seeded: replays match')
      console.log(`${sport.padEnd(6)} ${team.padEnd(3)} ${String(sq.slots.length).padStart(2)} builds · season ${season}: ${result.wins}-${result.losses}${result.champion ? ' · CHAMPIONS' : result.playoffs ? ' · playoffs' : ''}${mvps ? ' · MVP' : ''} · off ${result.strength.off} def ${result.strength.def}`)
      sq = { ...sq, seasons: [...sq.seasons, { n: season }] }
      n++
    }
  }
  console.log(`\nOK: ${n} squad seasons checked`)
} catch (e) {
  failed = true
  console.error(e)
} finally {
  await vite.close()
}
process.exit(failed ? 1 : 0)
