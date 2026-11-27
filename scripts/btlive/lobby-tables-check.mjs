// BLACKTOP lobbies, more than one a mode (live/src/index.js Lobby, since 2026-11-27): every lobby someone is in, plus
// exactly one empty one (LOBBY 1, 2…, at most MAX_TABLES), in-process, no network. Checks:
//   - nobody in: one lobby. Someone sits in lobby 1: lobby 2 shows, empty. Someone takes lobby 2: lobby 3 shows
//   - a lobby that empties goes (one empty one always stays); never more than MAX_TABLES
//   - an older app (no table in its seat) sits in lobby 1, and its `spots` are lobby 1's
//   - a full lobby makes its own match (its own Room, told its table); the other lobbies are left as they were
//   - a squad running it back is held at the table it played from; chat stays in its own lobby; the "N playing"
//     count is every lobby's spots
//   - 1v1, 2v2 and King of the Hill
// Run: node scripts/btlive/lobby-tables-check.mjs
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
let fails = 0
const ok = (c, what) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${what}`); if (!c) fails++ }
try {
  const { Lobby } = await vite.ssrLoadModule('/live/src/index.js')
  const MAX_TABLES = Lobby.MAX_TABLES
  const fakeWs = () => { const w = { got: [], send(d) { w.got.push(JSON.parse(d)) }, close() {} }; return w }
  function lobby(size) {
    const made = []
    const L = new Lobby({}, { ROOM: { idFromName: n => n, get: id => ({ fetch: async (u, init) => { made.push({ id, ...JSON.parse(init.body) }); return new Response('ok') } }) } })
    L.size = size
    const counts = []
    L.count = n => counts.push(n)
    const ws = {}
    const hello = async (v, extra = {}) => { ws[v] = fakeWs(); await L.onMessage(ws[v], JSON.stringify({ t: 'hello', vid: v, dev: `d-${v}`, key: `k-${v}`, bl: 1, ...extra })) }
    const seat = (v, slot, table, pos = 'guard') => L.onMessage(ws[v], JSON.stringify({ t: 'seat', slot, pos, ...(table ? { table } : {}) }))
    const shown = () => L.state().tables.map(x => `${x.id}:${Object.values(x.spots).filter(Boolean).length}`).join(' ')
    return { L, made, counts, ws, hello, seat, shown }
  }

  // ── 1v1 ──
  {
    const X = lobby(1)
    for (const v of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'old']) await X.hello(v, v === 'old' ? { bl: undefined } : {})
    ok(X.shown() === '1:0', `nobody in: one lobby (${X.shown()})`)
    await X.seat('a', '0x', 1)
    ok(X.shown() === '1:1 2:0', `someone in lobby 1: lobby 2 shows, empty (${X.shown()})`)
    await X.seat('b', '0x', 2)
    ok(X.shown() === '1:1 2:1 3:0', `someone takes lobby 2: lobby 3 shows (${X.shown()})`)
    await X.seat('c', '0x', 3); await X.seat('d', '0x', 4)
    ok(X.shown() === '1:1 2:1 3:1 4:1' && MAX_TABLES === 4, `never more than ${MAX_TABLES} (${X.shown()})`)
    await X.seat('e', '0x', 5)
    ok(X.L.placeOf('e')?.t === 1 || X.ws.e.got.some(m => m.t === 'bumped'), 'a table past the cap is lobby 1 (and lobby 1\'s spot is taken: bumped)')
    await X.seat('c', null, 3); await X.seat('d', null, 4)
    ok(X.shown() === '1:1 2:1 3:0', `two lobbies empty out: they go, one empty one stays (${X.shown()})`)
    await X.seat('a', null, 1)
    ok(X.shown() === '2:1 1:0', `lobby 1 empties while lobby 2 waits: lobby 2, then an empty one (${X.shown()})`)
    // an older app: no table, lobby 1, and its spots
    await X.seat('old', '1x', undefined)
    ok(X.L.placeOf('old')?.t === 1 && X.L.state().spots['1x']?.vid === 'old', 'an older app (no table) sits in lobby 1, and reads lobby 1 as its spots')
    // lobby 2 fills: its own match, told its table; lobby 1 left as it was
    X.made.length = 0
    await X.seat('f', '1x', 2, 'big')
    const m = X.made[0]
    ok(m && m.table === 2 && m.players.map(p => p.vid).sort().join() === 'b,f', `lobby 2 fills: its own match (table ${m?.table}, ${m?.players.map(p => p.vid).join(', ')})`)
    ok(X.ws.b.got.some(x => x.t === 'match') && !X.ws.old.got.some(x => x.t === 'match'), 'its two are sent to it; lobby 1\'s man stays where he is')
    ok(X.L.placeOf('old')?.t === 1 && X.shown() === '1:1 2:0', `after: lobby 1 still has its man, lobby 2 is the empty one again (${X.shown()})`)
    ok(X.counts.at(-1) === 1, `"N playing" counts every lobby (${X.counts.at(-1)})`)
    // chat: in his own lobby only (one not seated talks to everyone)
    await X.seat('g', '0x', 2)
    for (const v of Object.keys(X.ws)) X.ws[v].got.length = 0
    await X.L.onMessage(X.ws.g, JSON.stringify({ t: 'chat', text: 'just us' }))
    ok(X.ws.g.got.some(x => x.t === 'chat') && !X.ws.old.got.some(x => x.t === 'chat') && !X.ws.h.got.some(x => x.t === 'chat'), 'chat in lobby 2 stays in lobby 2')
    await X.L.onMessage(X.ws.h, JSON.stringify({ t: 'chat', text: 'anyone' }))
    ok(['g', 'old', 'a'].every(v => X.ws[v].got.some(x => x.t === 'chat' && x.text === 'anyone')), 'one not in a lobby talks to everyone')
    // running it back from lobby 3: held there
    const r = await X.L.fetch(new Request('https://lobby/hold?size=1', { method: 'POST', body: JSON.stringify({ table: 3, players: [{ vid: 'z', name: 'Z', pos: 'guard' }], keys: { z: 'kz' } }) }))
    ok((await r.json()).ok && X.L.placeOf('z')?.t === 3, `a squad running it back is held at its own table (${X.L.placeOf('z')?.t})`)
    ok(X.shown() === '1:1 2:1 3:1 4:0', `...and its lobby shows as taken (${X.shown()})`)
  }
  // ── 2v2 ──
  {
    const X = lobby(2)
    for (const v of ['a', 'b', 'c', 'd', 'e']) await X.hello(v)
    await X.seat('a', '0g0', 1)
    await X.seat('b', '0g0', 2); await X.seat('c', '0b', 2, 'big'); await X.seat('d', '1g0', 2)
    ok(X.shown() === '1:1 2:3 3:0', `2v2: lobby 1 one in, lobby 2 three in, an empty lobby 3 (${X.shown()})`)
    await X.seat('e', '1b', 2, 'big')
    ok(X.made[0]?.table === 2 && X.made[0].players.length === 4 && X.L.placeOf('a')?.t === 1, '2v2: lobby 2 fills, its own match of four; lobby 1 waits on')
  }
  // ── King of the Hill ──
  {
    const X = lobby('koth')
    for (const v of ['a', 'b', 'c', 'd']) await X.hello(v)
    await X.seat('a', 'k0', 1)
    await X.seat('b', 'k0', 2); await X.seat('c', 'k1', 2, 'big')
    ok(X.shown() === '1:1 2:2 3:0', `King of the Hill: lobby 1 one in, lobby 2 two in, an empty lobby 3 (${X.shown()})`)
    await X.seat('d', 'k2', 2)
    ok(X.made[0]?.table === 2 && X.made[0].size === 'koth' && X.made[0].players.length === 3 && X.L.placeOf('a')?.t === 1, 'King of the Hill: lobby 2 fills, its own match of three; lobby 1 waits on')
  }
} catch (e) { fails++; console.log('FAIL', e.stack) }
await vite.close()
console.log(fails ? `\n${fails} failed` : '\nall good')
process.exit(fails ? 1 : 0)
