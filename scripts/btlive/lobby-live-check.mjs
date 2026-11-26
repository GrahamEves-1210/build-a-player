// BLACKTOP 1V1 / 2V2 played live: the hand-off from the lobby's room (live/src/index.js Room) to Blacktop Live's
// referee (live/src/btlive.js BtLiveRoom), in-process, no network. Checks:
//   - every phone in it says bl: the room goes live, and the live room gets each seat's build as the server checked it
//     against his seeded spins (a pick never dealt plays as a free agent), his team, his seat key and his look
//   - a phone without bl in it (an older app): the old game, as before (no final.live), and the old room books it
//   - a seat that never finished building is the CPU's from the tip (out: a forfeit) and nobody waits on it
//   - 2v2: one man quits, the CPU takes his man and it goes on; his partner quits too, that side has lost. Booked:
//     the two still in win, the two who left forfeit, on the 2v2 record
// Run: node scripts/btlive/lobby-live-check.mjs
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
let fails = 0
const ok = (c, what) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${what}`); if (!c) fails++ }

const booked = []
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init = {}) => {
  const u = String(url)
  if (!u.startsWith('https://db.test/')) return realFetch(url, init)
  if (u.includes('/rpc/bump_rating')) { const b = JSON.parse(init.body); booked.push({ rating: b }); return Response.json([{ rating: 1000 + b.p_delta }]) }
  if (u.includes('/rest/v1/vs_results')) { booked.push({ vs: JSON.parse(init.body) }); return new Response(null, { status: 201 }) }
  return new Response('no', { status: 404 })
}

try {
  const { Room, liveGrades } = await vite.ssrLoadModule('/live/src/index.js')
  const { BtLiveRoom } = await vite.ssrLoadModule('/live/src/btlive.js')
  const core = await vite.ssrLoadModule('/src/lib/blacktopCore.js')
  const { dealTeam, dealPlayer } = await vite.ssrLoadModule('/src/lib/seatSpin.js')

  function buildSeat(code, vid, pos) {
    const { types, teams, pool } = core.seatKit(pos)
    const plan = { seed: core.seatSeed(code, vid), respinSeed: core.seatRespinSeed(code, vid) }
    const draftable = new Set(pool.map(q => q.team))
    const wheel = (teams.some(t => draftable.has(t.short)) ? teams.filter(t => draftable.has(t.short)) : [...teams]).sort((a, b) => a.short.localeCompare(b.short))
    const rosterOf = team => pool.filter(q => q.team === team.short).sort((a, b) => a.name.localeCompare(b.name))
    const build = Object.fromEntries(types.map(t => [t, null]))
    for (let i = 0; types.some(t => !build[t]); i++) {
      const team = dealTeam({ ...plan, sorted: wheel, i, free: false })
      const p = dealPlayer({ ...plan, roster: rosterOf(team), team, i, draw: 0, own: false, free: false })
      const t = types.filter(k => !build[k])[0]
      build[t] = { type: t, val: p.attrs[t], qb: p.short, qbFull: p.name, team: p.team, number: p.number ?? null, spin: { i, how: 'spin', d: 0 } }
    }
    return build
  }
  const fakeWs = () => { const w = { got: [], send(d) { w.got.push(JSON.parse(d)) }, close() {} }; return w }
  const env = () => {
    const inits = []
    return { inits, SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'svc', BTLIVE_ROOM: { idFromName: n => n, get: (id, o) => ({ fetch: async (u, init) => { inits.push({ id, hint: o?.locationHint ?? null, body: JSON.parse(init.body) }); return new Response('ok') } }) } }
  }
  const stopRoom = room => { for (const id of room.timers) clearTimeout(id); room.timers.clear() }

  // ── a 1v1 lobby room: both phones live; one sends a pick he was never dealt ──
  {
    const E = env(), code = 'LIVE01'
    const room = new Room({}, E)
    const players = [{ vid: 'a', name: 'Alpha', uid: 'ua', pos: 'guard', team: 0, slot: '0x', bot: false }, { vid: 'b', name: 'Bravo', uid: 'ub', pos: 'big', team: 1, slot: '1x', bot: false }]
    await room.fetch(new Request('https://room/init', { method: 'POST', body: JSON.stringify({ code, players, practice: false, size: 1, keys: { a: 'ka', b: 'kb' } }) }))
    const wa = fakeWs(), wb = fakeWs()
    await room.onMessage(wa, JSON.stringify({ t: 'hello', vid: 'a', key: 'ka', bl: 1 }))
    await room.onMessage(wb, JSON.stringify({ t: 'hello', vid: 'b', key: 'kb', bl: 1 }))
    const ba = buildSeat(code, 'a', 'guard'), bb = buildSeat(code, 'b', 'big')
    const cheat = { ...bb, size: { ...bb.size, qbFull: 'Victor Wembanyama', team: 'SAS', val: 11 } }
    const legitSize = bb.size.qbFull === 'Victor Wembanyama'
    await room.onMessage(wa, JSON.stringify({ t: 'build', build: ba, filled: 8, done: true }))
    await room.onMessage(wb, JSON.stringify({ t: 'build', build: cheat, filled: 8, done: true }))
    await new Promise(r => setTimeout(r, 20))
    const fin = wa.got.find(m => m.t === 'final')?.final
    ok(fin?.live === code, 'both phones can play live: the final says final.live (the live room\'s code)')
    const init = E.inits[0]?.body
    ok(init?.mode === '1v1' && init.players.length === 2 && init.keys.a === 'ka' && init.keys.b === 'kb', 'the live room is made 1v1 with both seats and their seat keys')
    const pa = init?.players.find(p => p.vid === 'a'), pb = init?.players.find(p => p.vid === 'b')
    ok(core.seatKit('guard').types.every(t => pa.build[t].val === Math.min(11, ba[t].val)), 'the guard plays the grades his own spins dealt')
    ok(legitSize || pb.build.size.val === core.FREE_AGENT_VAL, `a pick never dealt plays as a free agent (size ${pb?.build.size.val})`)
    ok(pa.team === 0 && pb.team === 1 && pa.pos === 'guard' && pb.pos === 'big', 'each on the side and at the position the lobby gave him')
    ok(pa.look?.player === ba.basketballIQ.qbFull, 'his man wears the face of the player his Basketball IQ came from')
    // the old room books nothing for a live game
    booked.length = 0
    room.m.phase = 'result'; await room.settle()
    ok(booked.length === 0, 'the lobby room books nothing for a live game (the live room does)')
    stopRoom(room)
  }

  // ── an older app in it: the old game ──
  {
    const E = env(), code = 'LIVE02'
    const room = new Room({}, E)
    const players = [{ vid: 'a', name: 'Alpha', uid: null, pos: 'guard', team: 0, slot: '0x', bot: false }, { vid: 'b', name: 'Bravo', uid: null, pos: 'guard', team: 1, slot: '1x', bot: false }]
    await room.fetch(new Request('https://room/init', { method: 'POST', body: JSON.stringify({ code, players, practice: false, size: 1, keys: {} }) }))
    const wa = fakeWs(), wb = fakeWs()
    await room.onMessage(wa, JSON.stringify({ t: 'hello', vid: 'a', bl: 1 }))
    await room.onMessage(wb, JSON.stringify({ t: 'hello', vid: 'b' }))
    await room.onMessage(wa, JSON.stringify({ t: 'build', build: buildSeat(code, 'a', 'guard'), filled: 8, done: true }))
    await room.onMessage(wb, JSON.stringify({ t: 'build', build: buildSeat(code, 'b', 'guard'), filled: 8, done: true }))
    await new Promise(r => setTimeout(r, 20))
    const fin = wa.got.find(m => m.t === 'final')?.final
    ok(!!fin && !fin.live && E.inits.length === 0, 'an older app in the game: the old game, no live room')
    stopRoom(room)
  }

  // ── the live room: a seat that never finished, and a 2v2 with two quits ──
  {
    const r = new BtLiveRoom({ storage: { put: async () => {}, get: async () => null }, blockConcurrencyWhile: f => f(), waitUntil: () => {} }, { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'svc' })
    const g = (pos, seed) => liveGrades(null, pos, seed)
    const players = [
      { vid: 'a', uid: 'ua', name: 'A', team: 0, pos: 'guard', build: g('guard', 'x1') },
      { vid: 'b', uid: 'ub', name: 'B', team: 0, pos: 'big', build: g('big', 'x2') },
      { vid: 'c', uid: 'uc', name: 'C', team: 1, pos: 'guard', build: g('guard', 'x3') },
      { vid: 'd', uid: 'ud', name: 'D', team: 1, pos: 'big', build: g('big', 'x4'), out: true },
    ]
    await r.fetch(new Request('https://btlive/init', { method: 'POST', body: JSON.stringify({ code: 'LIVE03', mode: '2v2', players, keys: { a: 'ka', b: 'kb', c: 'kc', d: 'kd' } }) }))
    ok(r.need === 3, 'a seat out from the start (never finished his build) isn\'t waited on: 3 to tip off')
    const ws = { a: fakeWs(), b: fakeWs(), c: fakeWs() }
    r.onMessage(ws.a, JSON.stringify({ t: 'hello', vid: 'a', key: 'ka' }))
    r.onMessage(ws.b, JSON.stringify({ t: 'hello', vid: 'b', key: 'kb' }))
    const bad = fakeWs(); r.onMessage(bad, JSON.stringify({ t: 'hello', vid: 'c', key: 'wrong' }))
    ok(bad.got.some(m => m.t === 'taken') && !r.g, 'a hello for a seat without its key is turned away')
    r.onMessage(ws.c, JSON.stringify({ t: 'hello', vid: 'c', key: 'kc' }))
    ok(!!r.g && r.g.mode === '2v2', 'the third one in: tip-off, 2v2')
    const seat = ws.a.got.find(m => m.t === 'seat')
    ok(seat?.seats.map(x => x.team).join('') === '0011' && seat.seats[3].cpu, 'teams as the lobby made them; the seat that\'s out is the CPU\'s')
    r.stop()
    booked.length = 0
    r.onMessage(ws.a, JSON.stringify({ t: 'quit' }))
    ok(r.g.phase !== 'over' && r.seats.find(x => x.vid === 'a').out, '2v2: one man quits, the CPU takes his man and it goes on')
    r.onMessage(ws.b, JSON.stringify({ t: 'quit' }))
    ok(r.g.phase === 'over' && r.g.winner === 1, 'his partner quits too: that side has lost')
    await new Promise(res => setTimeout(res, 50))
    const vs = Object.fromEntries(booked.filter(x => x.vs).map(x => [x.vs.user_id, x.vs]))
    ok(vs.ua?.result === 'forfeit' && vs.ub?.result === 'forfeit' && vs.uc?.result === 'win' && vs.ud?.result === 'forfeit', `booked: ${Object.values(vs).map(v => `${v.user_id}:${v.result}`).join(', ')}`)
    ok(Object.values(vs).every(v => v.match_type === '2v2'), 'on the 2v2 record')
    ok(booked.filter(x => x.rating).length === 4, 'four ratings booked')
    r.stop(); clearTimeout(r.showTimer)
  }
  // ── a 1v1: a quit ends it ──
  {
    const r = new BtLiveRoom({ storage: { put: async () => {}, get: async () => null }, blockConcurrencyWhile: f => f(), waitUntil: () => {} }, { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'svc' })
    const players = [{ vid: 'a', uid: 'ua', name: 'A', team: 0, pos: 'guard', build: liveGrades(null, 'guard', 'y1') }, { vid: 'b', uid: 'ub', name: 'B', team: 1, pos: 'big', build: liveGrades(null, 'big', 'y2') }]
    await r.fetch(new Request('https://btlive/init', { method: 'POST', body: JSON.stringify({ code: 'LIVE04', mode: '1v1', players, keys: {} }) }))
    const wa = fakeWs(), wb = fakeWs()
    r.onMessage(wa, JSON.stringify({ t: 'hello', vid: 'a' })); r.onMessage(wb, JSON.stringify({ t: 'hello', vid: 'b' }))
    r.stop()
    booked.length = 0
    r.onMessage(wb, JSON.stringify({ t: 'quit' }))
    ok(r.g.phase === 'over' && r.g.winner === 0, '1v1: a quit ends it, the other man wins')
    const fin = wa.got.filter(m => m.t === 's').pop()
    ok(fin?.ph === 'over', 'the final reaches the screen still in')
    await new Promise(res => setTimeout(res, 50))
    const vs = Object.fromEntries(booked.filter(x => x.vs).map(x => [x.vs.user_id, x.vs.result]))
    ok(vs.ua === 'win' && vs.ub === 'forfeit', `booked: ${JSON.stringify(vs)}`)
    clearTimeout(r.showTimer)
  }
} catch (e) { fails++; console.log('FAIL', e.stack) }
await vite.close()
console.log(fails ? `\n${fails} failed` : '\nall good')
process.exit(fails ? 1 : 0)
