// Blacktop seat check: a seat built the way the build page builds it (SpinScreen's seeded deals,
// lib/seatSpin.js, on the seat's seeds and the pool BucketApp spins) goes through the live server's
// tip-off (live/src/index.js Room: hello, build, start, blacktopCore cleanBuild) and must come out
// exactly as it was made: not out (AFK), no free agents, every rating the player's real one, and
// nothing for the player to be told (courtChanges). Guard and big; no respin, a player respin, a
// team respin, both. Many rooms each.
// Two controls show the check can fail: the old bug (an All-Time build left open, so the page spun
// the legends: every pick a free agent, a 67) and a pick the seat's spins never dealt (one free agent).
// Run: node scripts/blacktop-seat-check.mjs   (no network, no database: the server runs in-process)
import { createServer } from 'vite'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
let failed = 0
try {
  const core = await vite.ssrLoadModule('/src/lib/blacktopCore.js')
  const { dealTeam, dealPlayer } = await vite.ssrLoadModule('/src/lib/seatSpin.js')
  const { seeded } = await vite.ssrLoadModule('/src/lib/rng.js')
  const { Room } = await vite.ssrLoadModule('/live/src/index.js')
  const { NBA_ALLTIME_GUARD_PLAYERS } = await vite.ssrLoadModule('/src/data/nba-guard-legends.js')
  const { NBA_ALLTIME_BIG_PLAYERS } = await vite.ssrLoadModule('/src/data/nba-big-legends.js')
  const LEGENDS = { guard: NBA_ALLTIME_GUARD_PLAYERS, big: NBA_ALLTIME_BIG_PLAYERS }

  const code6 = r => Array.from({ length: 6 }, () => '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(r() * 32)]).join('')

  // ── the build page (BucketApp blacktopPlan + SpinScreen), spin by spin ──
  // respin: null | 'player' | 'team' | 'both' (one of each a build, as on the page), on spin #at
  function buildSeat({ code, vid, pos, pool, respin, at, r }) {
    const { types, teams } = core.seatKit(pos)
    const plan = { seed: core.seatSeed(code, vid), respinSeed: core.seatRespinSeed(code, vid) }
    // the wheel: the teams with someone to draft in the pool, in a fixed order (SpinScreen teamReelItems, sorted)
    const draftable = new Set(pool.map(q => q.team))
    const wheel = (teams.some(t => draftable.has(t.short)) ? teams.filter(t => draftable.has(t.short)) : [...teams]).sort((a, b) => a.short.localeCompare(b.short))
    const rosterOf = team => pool.filter(q => q.team === team.short).sort((a, b) => a.name.localeCompare(b.name))
    const build = Object.fromEntries(types.map(t => [t, null]))
    let seedSpins = 0
    for (let k = 0; types.some(t => !build[t]); k++) {
      assert.ok(k < 40, 'the build never filled')
      // a spin: the next seeded spin (ownSpins: respins don't use up the seat's order)
      seedSpins++
      const i = seedSpins - 1
      let free = false, draw = 0
      let team = dealTeam({ ...plan, sorted: wheel, i, free })
      let p = dealPlayer({ ...plan, roster: rosterOf(team), team, i, draw, own: false, free })
      if (k === at && (respin === 'team' || respin === 'both')) {
        free = true; draw = 0
        team = dealTeam({ ...plan, sorted: wheel, i, free })
        p = dealPlayer({ ...plan, roster: rosterOf(team), team, i, draw, own: true, free })
      }
      if (k === at && (respin === 'player' || respin === 'both')) {
        draw = 1
        p = dealPlayer({ ...plan, roster: rosterOf(team), team, i, draw, own: true, free })
      }
      assert.ok(p, `no player dealt on spin ${i}`)
      // the player taps a chip: any open trait (a player's own choice)
      const open = types.filter(t => !build[t])
      const t = open[Math.floor(r() * open.length)]
      build[t] = { type: t, val: p.attrs[t], qb: p.short, qbFull: p.name, team: p.team, number: p.number ?? null,
        spin: { i, how: free ? 'tr' : draw > 0 ? 'pr' : 'spin', d: draw } }
    }
    return build
  }

  // ── the live server, in-process: a 1v1 practice room, the seat says hello and sends its build ──
  async function tipOff({ code, vid, pos, build }) {
    const room = new Room({}, {})
    const players = [
      { vid, name: 'Guest', uid: null, cos: null, pos, team: 0, slot: '0x', bot: false },
      { vid: `bot-${code}-1x`, name: 'Smoke', uid: null, cos: null, pos: 'guard', team: 1, slot: '1x', bot: true },
    ]
    try {
      await room.fetch(new Request('https://room/init', { method: 'POST', body: JSON.stringify({ code, players, practice: true, size: 1, keys: {} }) }))
      const got = []
      const ws = { send: d => got.push(JSON.parse(d)), close() {} }
      await room.onMessage(ws, JSON.stringify({ t: 'hello', vid }))
      // what lib/blacktopServer.js sendBuild sends: done is every trait of the seat's position filled
      const t = core.seatKit(pos).types
      const filled = t.filter(k => build[k]).length
      await room.onMessage(ws, JSON.stringify({ t: 'build', build, role: 'balanced', player: null, filled, done: filled === t.length }))
      const fin = got.find(m => m.t === 'final')
      assert.ok(fin, 'the game never tipped off on a finished build')
      return fin.final
    } finally {
      for (const id of room.timers) clearTimeout(id)
      room.timers.clear()
    }
  }

  const same = (build, final, vid, pos) => {
    const pool = core.seatKit(pos).pool
    assert.ok(!final.afk.includes(vid), 'marked AFK')
    const kept = final.builds[vid]
    assert.ok(kept, 'no build kept')
    for (const t of core.seatKit(pos).types) {
      assert.notEqual(kept[t].qbFull, 'Free agent', `${t}: ${build[t].qbFull} became a free agent`)
      assert.equal(kept[t].qbFull, build[t].qbFull, `${t}: a different player`)
      assert.equal(kept[t].val, pool.find(x => x.name === build[t].qbFull && x.team === build[t].team).attrs[t], `${t}: not the real rating`)
      assert.equal(kept[t].val, build[t].val, `${t}: the rating changed`)
    }
    assert.ok(core.buildOk(kept, pool), 'the phones would throw the build out (buildOk)')
    assert.equal(core.courtChanges(build, final, vid, pos, pool), null, 'the player would be told his build changed')
  }

  // the build page spins the server's pool on a Blacktop build, whatever mode was left open (BucketApp
  // currentPool). The bug was here, in the page, not in the plan: the check reads the source for it
  {
    const src = readFileSync(new URL('../src/components/BucketApp.jsx', import.meta.url), 'utf8')
    const pools = /const LIVE_SPIN_POOLS = \{ guard: seatKit\('guard'\)\.pool\.map\(enrichPlayer\), big: seatKit\('big'\)\.pool\.map\(enrichPlayer\) \}/.test(src)
    const memo = src.match(/const currentPool = useMemo\(\(\) => \{([\s\S]*?)\r?\n  \}, \[/)?.[1] ?? ''
    const first = memo.split(/\r?\n/).map(l => l.trim()).find(l => l.startsWith('if ('))
    const ok = pools && first === "if (liveBuild) return LIVE_SPIN_POOLS[position === 'big' ? 'big' : 'guard']"
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} the build page spins seatKit's pool on a Blacktop build, before All-Time or Sandbox (BucketApp currentPool)`)
  }

  const ROOMS = 60
  const r = seeded('blacktop-seat-check')
  for (const pos of ['guard', 'big']) {
    for (const respin of [null, 'player', 'team', 'both']) {
      let n = 0
      for (let k = 0; k < ROOMS; k++) {
        const code = code6(r), vid = randomUUID(), at = Math.floor(r() * 8)
        const build = buildSeat({ code, vid, pos, pool: core.seatKit(pos).pool, respin, at, r })
        try { same(build, await tipOff({ code, vid, pos, build }), vid, pos); n++ }
        catch (e) { failed++; console.log(`FAIL ${pos} respin=${respin} room ${code} seat ${vid}: ${e.message}`) }
      }
      console.log(`${n === ROOMS ? 'ok  ' : 'FAIL'} ${pos.padEnd(5)} ${String(respin ?? 'no respin').padEnd(10)} ${n}/${ROOMS} rooms played as built`)
    }
  }

  // control 1, the bug: the page spun the All-Time pool (gameMode left at 'all-time')
  for (const pos of ['guard', 'big']) {
    const code = code6(r), vid = randomUUID()
    const build = buildSeat({ code, vid, pos, pool: LEGENDS[pos], respin: null, at: -1, r })
    const final = await tipOff({ code, vid, pos, build })
    const kept = final.builds[vid]
    const fa = Object.values(kept).filter(c => c.qbFull === 'Free agent').length
    const ch = core.courtChanges(build, final, vid, pos, core.seatKit(pos).pool)
    // (a legend who's also a player today can land where the seat's own spin did: most picks go, not always all)
    const ok = fa >= 5 && ch?.free === fa
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} control: a ${pos} spun from the legends plays ${fa}/8 free agents, and he's told (${JSON.stringify(ch)})`)
  }
  // control 2, anti-cheat: one pick the seat's spins never dealt plays as a free agent, the rest stand
  for (const pos of ['guard', 'big']) {
    const code = code6(r), vid = randomUUID()
    const { pool, types } = core.seatKit(pos)
    const build = buildSeat({ code, vid, pos, pool, respin: null, at: -1, r })
    const t = types[3], star = [...pool].sort((a, b) => b.attrs[t] - a.attrs[t]).find(p => p.name !== build[t].qbFull)
    build[t] = { ...build[t], qbFull: star.name, team: star.team, val: star.attrs[t] }
    const final = await tipOff({ code, vid, pos, build })
    const kept = final.builds[vid]
    const fa = types.filter(x => kept[x].qbFull === 'Free agent')
    const ch = core.courtChanges(build, final, vid, pos, pool)
    const ok = fa.length === 1 && fa[0] === t && kept[t].val === core.FREE_AGENT_VAL && ch?.free === 1 && !ch.built
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} control: a ${pos} who sends ${star.name} for ${t} (never dealt) gets a free agent there, only there (${JSON.stringify(ch)})`)
  }
} catch (e) {
  failed++
  console.log('FAIL', e.stack ?? e)
} finally {
  await vite.close()
}
console.log(failed ? `\n${failed} FAILED` : '\nall good')
process.exit(failed ? 1 : 0)
