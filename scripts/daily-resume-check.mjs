// Daily Challenge check (11-17: a 92 on the basketball Daily that never reached the board).
//  1. The server's check (src/lib/verifyCore.js checkDaily, run by live/src/submit.js) takes a run built the way
//     the build page deals it (lib/seatSpin.js, the Daily's seed, a team respin and a player respin), and turns
//     away the build a run that started over after a reload made: spins past the day's set.
//  2. The page names why a score isn't on the board (lib/progress.js dailyWhy) for every answer the server gives.
//  3. The basketball build page keeps the Daily's build through a reload (BucketApp startDaily): read from the source.
// Run: node scripts/daily-resume-check.mjs [day]   (no network, no database)
import { createServer } from 'vite'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
let failed = 0
const check = async (name, fn) => {
  try { await fn(); console.log(`ok   ${name}`) } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message.split('\n')[0]}`) }
}
try {
  const V = await vite.ssrLoadModule('/src/lib/verifyCore.js')
  const { dealTeam, dealPlayer } = await vite.ssrLoadModule('/src/lib/seatSpin.js')
  const { seeded } = await vite.ssrLoadModule('/src/lib/rng.js')
  const r = seeded('daily-resume-check')

  // the build page's Daily: spin #i (counted across visits), a team respin is just the next spin, one player respin
  // (SpinScreen with BucketApp / App dailyPlan: no respinSeed, respins share the day's order)
  function run(day, { from = 0, teamRespinAt = -1, playerRespinAt = -1 } = {}) {
    const dc = V.dailyFor(day)
    const kit = V.seasonKit(dc.sport, dc.pos, dc.mode)
    const draftable = new Set(kit.pool.map(p => p.team))
    const wheel = kit.teams.filter(t => draftable.has(t.short)).sort((a, b) => a.short.localeCompare(b.short))
    const build = {}
    let i = from
    for (let k = 0; Object.keys(build).length < kit.types.length; k++) {
      if (k === teamRespinAt) i++        // the respun spin is never placed: the next one is
      const team = dealTeam({ seed: dc.seed, sorted: wheel, i })
      const roster = kit.pool.filter(q => q.team === team.short).sort((a, b) => a.name.localeCompare(b.name))
      const p = dealPlayer({ seed: dc.seed, roster, team, i, draw: k === playerRespinAt ? 1 : 0 })
      const open = kit.types.filter(t => !build[t])
      const t = open[Math.floor(r() * open.length)]
      build[t] = { qb: p.name, team: p.team, val: p.attrs[t] }
      i++
    }
    return { build, last: i - 1, kit }
  }

  const DAYS = process.argv[2] ? [process.argv[2]] : ['2026-11-17', '2026-11-16', '2026-11-19', '2026-11-21']
  for (const day of DAYS) {
    const dc = V.dailyFor(day)
    await check(`${day} (${dc.sport} ${dc.pos} ${dc.mode}): honest runs pass, with a team respin and a player respin`, async () => {
      for (let n = 0; n < 40; n++) {
        const at = Math.floor(r() * 8)
        const { build } = run(day, { teamRespinAt: n % 2 ? at : -1, playerRespinAt: n % 3 ? (at + 2) % 8 : -1 })
        const v = V.checkDaily(day, build)
        assert.ok(!v.error, `turned away: ${v.error}`)
      }
    })
    await check(`${day}: a run that started over after a reload, on spins past the day's set, is turned away`, async () => {
      const { build, last } = run(day, { from: 8, teamRespinAt: 3 })
      assert.ok(last > 15, `the restart only reached spin ${last}`)
      assert.equal(V.checkDaily(day, build).error, "not the day's spins")
    })
  }

  await check('every answer the server gives is named on the Daily screen', async () => {
    const { dailyWhy } = await vite.ssrLoadModule('/src/lib/progress.js')
    const rej = message => dailyWhy({ code: 'rejected', message })
    assert.equal(rej("not the day's spins"), 'spins')
    assert.equal(rej('edited rating for jumpShot'), 'ratings')
    assert.equal(rej('unknown player for size'), 'ratings')
    assert.equal(rej('missing clutch'), 'ratings')
    assert.equal(rej("not today's Daily"), 'day')
    assert.equal(rej('something new'), 'check')
    assert.equal(dailyWhy({ code: '42501', message: 'permission denied' }), 'error')
    assert.equal(dailyWhy({ code: null, message: 'Sign in again.' }), 'error')
    assert.equal(dailyWhy(null), null)
    const src = readFileSync(new URL('../src/components/app/AppDaily.jsx', import.meta.url), 'utf8')
    for (const k of ['scouted', 'spins', 'ratings', 'day', 'check', 'error']) assert.match(src, new RegExp(`\\n\\s+${k}: ['"]Not on the board`), `no line for '${k}'`)
  })

  await check('the basketball build page keeps the Daily build through a reload (BucketApp)', async () => {
    const src = readFileSync(new URL('../src/components/BucketApp.jsx', import.meta.url), 'utf8')
    // (kept with every build in progress, bab_progress: the run's key goes with it)
    assert.match(src, /localStorage\.setItem\(PROGRESS_KEY, JSON\.stringify\(\{[\s\S]{0,200}daily: dailyRun\?\.key/, 'the build is not kept')
    const start = src.match(/const startDaily = useCallback\(\(\) => \{([\s\S]*?)\r?\n  \}, \[/)?.[1] ?? ''
    const resume = start.indexOf('if (dailyRun?.key === dc.key) {'), fresh = start.indexOf('handleStart(dc.mode, dc.pos)')
    assert.ok(resume > 0 && fresh > resume, 'startDaily starts a fresh build before it looks for the run in progress')
    assert.match(start.slice(resume, fresh), /localStorage\.getItem\(PROGRESS_KEY\)[\s\S]{0,80}daily === dc\.key/)
  })
} catch (e) {
  failed++
  console.log('FAIL', e.stack ?? e)
} finally {
  await vite.close()
}
console.log(failed ? `\n${failed} FAILED` : '\nall good')
process.exit(failed ? 1 : 0)
