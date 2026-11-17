// Blacktop lobby check: one player (a tab's seat id), one account and one device never hold two
// spots in a lobby, and every spot shows its own player's name. The live server (live/src/index.js
// Lobby and Room) runs in-process, as in scripts/blacktop-seat-check.mjs: no network, no database
// (the session lookup, live/src/auth.js, is answered here from a fake table of accounts).
//
// The bug (11-17, "1V1 LOBBY · 2/2 SPOTS TAKEN", the same player on both sides, TAP TO LEAVE on
// both): RUN IT BACK sent twice before the vote came back (a double tap) asked the lobby to hold a
// spot twice, and the lobby held a second spot, the other side's, for the same player.
// Run: node scripts/blacktop-lobby-check.mjs
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
let failed = 0
const check = async (name, fn) => {
  try { await fn(); console.log(`ok   ${name}`) } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message.split('\n')[0]}`) }
}

// sessions: token → { id, username } (what Supabase would say for that token)
const ACCOUNTS = { 'tok-potat': { id: 'uid-potat', username: 'POTAT25' }, 'tok-potat-2': { id: 'uid-potat', username: 'POTAT25' }, 'tok-uzi': { id: 'uid-uzi', username: 'uzi' } }
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init = {}) => {
  const u = String(url)
  if (!u.startsWith('https://db.test/')) return realFetch(url, init)
  const tok = (init.headers?.Authorization ?? '').replace('Bearer ', '')
  const acc = ACCOUNTS[tok]
  if (u.includes('/auth/v1/user')) return acc ? Response.json({ id: acc.id, user_metadata: {} }) : new Response('no', { status: 401 })
  if (u.includes('/rest/v1/accounts')) return Response.json(acc ? [{ username: acc.username }] : [])
  return new Response('not found', { status: 404 })
}

try {
  const { Lobby, Room } = await vite.ssrLoadModule('/live/src/index.js')
  const { teamNames } = await vite.ssrLoadModule('/src/lib/blacktopCore.js')

  // one server: a lobby per size, a room per code, wired the way the Worker's bindings are
  function server() {
    const lobbies = {}, rooms = {}
    const env = { SUPABASE_URL: 'https://db.test', SUPABASE_ANON_KEY: 'anon' }
    const ns = (map, make) => ({ idFromName: n => n, get: id => ({ fetch: (u, init) => (map[id] ??= make()).fetch(typeof u === 'string' ? new Request(u, init) : u) }) })
    env.LOBBY = ns(lobbies, () => new Lobby({}, env))
    env.ROOM = ns(rooms, () => new Room({}, env))
    const stop = () => { for (const r of Object.values(rooms)) { for (const id of r.timers) clearTimeout(id); r.timers.clear() } }
    return { env, lobbies, rooms, stop }
  }
  // a phone: one socket, everything it's sent kept
  const phone = (name) => { const got = []; return { name, got, send: d => got.push(JSON.parse(d)), close() { this.closed = true }, last: t => [...got].reverse().find(m => m.t === t) } }
  // a lobby (size 1) with its first request made, as /lobby1 does
  async function lobby1(s) {
    const L = (s.lobbies.blacktop1 ??= new Lobby({}, s.env))
    await L.fetch(new Request('https://lobby/hold?size=1', { method: 'POST', body: JSON.stringify({ players: [] }) }))
    return L
  }
  const hello = (L, ws, { vid, key, token = null, dev = null }) => L.onMessage(ws, JSON.stringify({ t: 'hello', vid, key, token, dev, name: 'whatever the phone says', cos: null }))
  const seat = (L, ws, slot, pos = 'guard') => L.onMessage(ws, JSON.stringify({ t: 'seat', slot, pos }))
  const spotsOf = L => L.state().spots
  const vidsSeated = L => Object.values(spotsOf(L)).filter(Boolean).map(p => p.vid)
  const oneEach = L => { const v = vidsSeated(L); assert.equal(new Set(v).size, v.length, `one player in two spots: ${JSON.stringify(spotsOf(L))}`) }

  // a finished 1v1 between two accounts (the room, as the lobby made it), both still in it
  async function finished1v1(s, a, b) {
    const L = await lobby1(s)
    const wa = phone('a'), wb = phone('b')
    await hello(L, wa, a); await hello(L, wb, b)
    await seat(L, wa, '0x', 'big'); await seat(L, wb, '1x', 'big')
    const match = wa.last('match'); assert.ok(match, 'no match made')
    const R = s.rooms[match.code]
    const ra = phone('ra'), rb = phone('rb')
    await R.onMessage(ra, JSON.stringify({ t: 'hello', vid: a.vid, key: a.key }))
    await R.onMessage(rb, JSON.stringify({ t: 'hello', vid: b.vid, key: b.key }))
    R.m.phase = 'result'            // the game's been played (what's checked here is the way back)
    return { L, R, ra, rb, match }
  }
  const A = { vid: 'vid-potat', key: 'key-potat', token: 'tok-potat', dev: 'dev-pc' }
  const B = { vid: 'vid-uzi', key: 'key-uzi', token: 'tok-uzi', dev: 'dev-phone' }

  await check('the screenshot: RUN IT BACK tapped twice (both sent before the vote comes back) holds one spot, not both', async () => {
    const s = server()
    try {
      const { L, R, ra, rb } = await finished1v1(s, A, B)
      // the double tap: two votes in flight at once, then the opponent's
      await Promise.all([R.onMessage(ra, JSON.stringify({ t: 'rematch' })), R.onMessage(ra, JSON.stringify({ t: 'rematch' }))])
      await R.onMessage(rb, JSON.stringify({ t: 'rematch' }))
      const shown = Object.values(spotsOf(L)).filter(Boolean)
      assert.deepEqual(shown.map(p => p.name).sort(), ['POTAT25', 'uzi'], `the lobby shows ${JSON.stringify(shown.map(p => p.name))}`)
      // both come back to the lobby: the match is the two of them, each on his own side
      const la = phone('la'), lb = phone('lb')
      await hello(L, la, A); await hello(L, lb, B)
      oneEach(L)
      const m = la.last('match')
      assert.ok(m, 'the rematch never started')
      assert.deepEqual(m.players.map(p => p.name).sort(), ['POTAT25', 'uzi'])
      assert.deepEqual(teamNames({ players: m.players }).sort(), ['TEAM POTAT25', 'TEAM UZI'])
    } finally { s.stop() }
  })

  await check('RUN IT BACK twice, one after the other (the first answer back in between) still holds one spot', async () => {
    const s = server()
    try {
      const { L, R, ra } = await finished1v1(s, A, B)
      await R.onMessage(ra, JSON.stringify({ t: 'rematch' }))
      await R.onMessage(ra, JSON.stringify({ t: 'rematch' }))
      oneEach(L)
      assert.equal(vidsSeated(L).length, 1, `${vidsSeated(L).length} spots held for one player`)
      // he comes back, and a reconnect (a second hello) doesn't move him into another spot
      const la = phone('la'); await hello(L, la, A); await hello(L, la, A)
      oneEach(L)
      assert.equal(vidsSeated(L).length, 1)
      assert.ok(!la.last('match'), 'a match with himself')
    } finally { s.stop() }
  })

  await check('the lobby asked twice to hold one squad\'s spot (an older room, or two rooms) holds it once', async () => {
    const s = server()
    try {
      const L = await lobby1(s)
      const ask = () => L.fetch(new Request('https://lobby/hold?size=1', { method: 'POST', body: JSON.stringify({ players: [{ vid: A.vid, name: 'POTAT25', uid: 'uid-potat', pos: 'big' }], keys: { [A.vid]: A.key } }) })).then(r => r.json())
      const [r1, r2] = await Promise.all([ask(), ask()])
      assert.ok(r1.ok && r2.ok, 'he was told there was no spot')
      assert.equal(vidsSeated(L).length, 1, `${vidsSeated(L).length} spots held for one player`)
      const la = phone('la'); await hello(L, la, A)
      assert.equal(vidsSeated(L).length, 1)
      assert.equal(Object.keys(L.spots).length, 1, 'he isn\'t in his spot')
    } finally { s.stop() }
  })

  await check('a spot held for him (on his way back) is let go when he taps another spot', async () => {
    const s = server()
    try {
      const L = await lobby1(s)
      await L.fetch(new Request('https://lobby/hold?size=1', { method: 'POST', body: JSON.stringify({ players: [{ vid: A.vid, name: 'POTAT25', uid: 'uid-potat', pos: 'big' }], keys: { [A.vid]: 'some-other-key' } }) }))
      const la = phone('la'); await hello(L, la, A)          // a different key: the hold isn't his to take
      const free = Object.entries(spotsOf(L)).find(([, p]) => !p)[0]
      await seat(L, la, free, 'guard')
      oneEach(L)
      assert.ok(!la.last('match'), 'a match with himself')
    } finally { s.stop() }
  })

  await check('one account on two devices: the second device can\'t take the other spot', async () => {
    const s = server()
    try {
      const L = await lobby1(s)
      const A2 = { vid: 'vid-potat-phone', key: 'key-2', token: 'tok-potat-2', dev: 'dev-phone-2' }
      const w1 = phone('1'), w2 = phone('2')
      await hello(L, w1, A); await hello(L, w2, A2)
      await seat(L, w1, '0x'); await seat(L, w2, '1x')
      assert.equal(vidsSeated(L).length, 1, `one account holds ${vidsSeated(L).length} spots`)
      assert.equal(w2.last('bumped')?.why, 'account', `the second device was told ${JSON.stringify(w2.last('bumped'))}`)
      assert.ok(!w1.last('match') && !w2.last('match'), 'a match with himself')
    } finally { s.stop() }
  })

  await check('one device, two tabs (two Guests): the second tab can\'t take the other spot', async () => {
    const s = server()
    try {
      const L = await lobby1(s)
      const g1 = { vid: 'vid-tab-1', key: 'k1', dev: 'dev-shared' }, g2 = { vid: 'vid-tab-2', key: 'k2', dev: 'dev-shared' }
      const w1 = phone('1'), w2 = phone('2')
      await hello(L, w1, g1); await hello(L, w2, g2)
      await seat(L, w1, '0x'); await seat(L, w2, '1x')
      assert.equal(vidsSeated(L).length, 1)
      assert.equal(w2.last('bumped')?.why, 'device')
      // the device isn't shown to anyone
      assert.ok(!JSON.stringify(L.state()).includes('dev-shared'), 'the device id went out')
    } finally { s.stop() }
  })

  await check('one account in a squad hold (running it back) while his other device sits in the lobby: no second spot', async () => {
    const s = server()
    try {
      const L = await lobby1(s)
      const A2 = { vid: 'vid-potat-phone', key: 'key-2', token: 'tok-potat-2', dev: 'dev-phone-2' }
      const w2 = phone('2'); await hello(L, w2, A2); await seat(L, w2, '1x')
      const res = await (await L.fetch(new Request('https://lobby/hold?size=1', { method: 'POST', body: JSON.stringify({ players: [{ vid: A.vid, name: 'POTAT25', uid: 'uid-potat', pos: 'big' }], keys: { [A.vid]: A.key } }) }))).json()
      assert.equal(res.ok, false)
      assert.equal(vidsSeated(L).length, 1)
    } finally { s.stop() }
  })

  await check('two different accounts: each spot shows its own name, and the match is the two of them', async () => {
    const s = server()
    try {
      const L = await lobby1(s)
      const wa = phone('a'), wb = phone('b')
      await hello(L, wa, A); await hello(L, wb, B)
      await seat(L, wa, '0x', 'big')
      assert.equal(spotsOf(L)['0x'].name, 'POTAT25')
      await seat(L, wb, '1x', 'guard')
      const m = wb.last('match'); assert.ok(m, 'no match')
      assert.deepEqual(m.players.map(p => [p.slot, p.name, p.pos]), [['0x', 'POTAT25', 'big'], ['1x', 'uzi', 'guard']])
      assert.deepEqual(teamNames({ players: m.players }), ['TEAM POTAT25', 'TEAM UZI'])
      assert.ok(m.players.every(p => !('dev' in p) && !('key' in p)), 'a seat key or device went out')
    } finally { s.stop() }
  })

  await check('the lobby never makes a match with one player (or one account) twice in it', async () => {
    const s = server()
    try {
      const L = await lobby1(s)
      // spots filled behind the rules' back (an older lobby's state): the match must still refuse it
      const w = phone('a'); await hello(L, w, A)
      const p = [...L.conns.values()][0]
      L.spots = { '0x': { ...p, at: 1, pos: 'big' }, '1x': { ...p, at: 2, pos: 'big' } }
      await L.makeMatch()
      assert.ok(!w.last('match'), 'a match with himself')
      oneEach(L)
    } finally { s.stop() }
  })
} catch (e) {
  failed++
  console.log('FAIL', e.stack ?? e)
} finally {
  globalThis.fetch = realFetch
  await vite.close()
}
console.log(failed ? `\n${failed} FAILED` : '\nall good')
process.exit(failed ? 1 : 0)
