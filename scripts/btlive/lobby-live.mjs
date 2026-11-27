// BLACKTOP 1V1 / 2V2 / KING OF THE HILL online, played live, end to end against a real worker (wrangler dev, workerd): scripted
// players take the lobby's spots, spin their builds from their seats' own seeded spins (as the build page does), send
// them, and when the room hands the game to Blacktop Live (final.live) each one plays it on the referee with a bot
// (the CPU's own brain, cpuInput, on his copy of the state, applySnap: the inputs go up as a device's would). The
// booking goes to a stand-in Supabase here, so the check reads what the room booked: one rating and one 1v1 / 2v2
// record a player, a forfeit for a man who quit.
//   node scripts/btlive/lobby-live.mjs --stub=8824                     (prints the wrangler line to run)
//   cd live && npx wrangler dev --port 8823 --var SUPABASE_URL:http://127.0.0.1:8824 --var SUPABASE_SERVICE_ROLE_KEY:svc
//   node scripts/btlive/lobby-live.mjs --server=ws://127.0.0.1:8823 --stub=8824 --size=1|2|koth [--quit]
import { createServer as viteServer } from 'vite'
import http from 'node:http'
import assert from 'node:assert/strict'

const args = process.argv.slice(2)
const arg = (k, d) => args.find(x => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const SERVER = arg('server', 'ws://127.0.0.1:8823'), STUB = Number(arg('stub', 8824)), SIZE = arg('size', '1') === 'koth' ? 'koth' : Number(arg('size', 1)), QUIT = args.includes('--quit')
const MAX_SECS = Number(arg('secs', 600))
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a)
const T0 = Date.now()

// ── the stand-in Supabase: sessions, and what the worker books ──
const booked = { vs: [], rating: [] }
const users = {}
const stub = http.createServer((req, res) => {
  let body = ''
  req.on('data', c => { body += c })
  req.on('end', () => {
    const u = req.url, tok = (req.headers.authorization ?? '').replace('Bearer ', '')
    const json = (o, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)) }
    if (u.startsWith('/auth/v1/user')) return users[tok] ? json({ id: users[tok].id, user_metadata: {} }) : json({}, 401)
    if (u.startsWith('/rest/v1/accounts')) { const who = Object.values(users).find(x => u.includes(x.id)); return json(who ? [{ username: who.name }] : []) }
    if (u.startsWith('/rest/v1/rpc/bump_rating')) { const b = JSON.parse(body); booked.rating.push(b); return json([{ rating: 1000 + b.p_delta }]) }
    if (u.startsWith('/rest/v1/vs_results')) { booked.vs.push(JSON.parse(body)); res.writeHead(201); return res.end() }
    json({}, 404)
  })
})
await new Promise(r => stub.listen(STUB, '127.0.0.1', r))

const vite = await viteServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
const core = await vite.ssrLoadModule('/src/lib/blacktopCore.js')
const { dealTeam, dealPlayer } = await vite.ssrLoadModule('/src/lib/seatSpin.js')
const bl = await vite.ssrLoadModule('/src/lib/btlive/index.js')
const proto = await vite.ssrLoadModule('/src/lib/btlive/proto.js')

// a build from the seat's own seeded spins (scripts/blacktop-seat-check.mjs buildSeat, no respins)
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

const sock = path => new WebSocket(`${SERVER}${path}`)
const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)) }

// one player: lobby → spot → room → build → live game, a bot at the stick
// (table: the lobby he takes a spot in, LOBBY 1, 2…; sitter: he takes it and stays, never matched)
function player(n, pos, wantSlot, table = 1, sitter = false) {
  const vid = `lv${n}-${Math.random().toString(36).slice(2, 8)}`, key = `k-${vid}`, token = `tok-${vid}`
  users[token] = { id: `uid-${n}-${vid}`, name: `Tester${n}` }
  const P = { n, vid, uid: users[token].id, pos, table, done: null, seat: null, live: null, quit: false, lobbyAt: null }
  P.ready = new Promise(res => { P.end = res })
  const lobby = sock(SIZE === 1 ? '/lobby1' : SIZE === 'koth' ? '/lobbyk' : '/lobby2')
  lobby.onopen = () => send(lobby, { t: 'hello', vid, dev: `dev-${vid}`, name: 'x', pos, cos: null, key, token, bl: 1 })
  let seated = false
  lobby.onmessage = e => {
    const m = JSON.parse(e.data)
    if (m.t === 'lobby') {
      // (the lobby he's in, as the server says: tables, or an older server's one set of spots)
      const tables = m.tables ?? [{ id: 1, spots: m.spots }]
      const at = tables.find(x => Object.values(x.spots ?? {}).some(p => p?.vid === vid))
      P.lobbyAt = at?.id ?? null; P.lastTables = tables
      if (!seated) {
        const T = tables.find(x => x.id === table)
        if (!at && !T?.spots?.[wantSlot]) send(lobby, { t: 'seat', slot: wantSlot, pos, table })
        if (at) { seated = true; log(`P${n} sits in lobby ${at.id} (${tables.map(x => `${x.id}:${Object.values(x.spots).filter(Boolean).length}`).join(' ')})`); if (sitter) setTimeout(() => P.end(), 100) }
      }
    }
    if (m.t === 'match') { P.matched = true; P.matchTable = m.table ?? 1; if (sitter) return; lobby.close(); room(m.code, m.players) }
  }
  function room(code, players) {
    P.code = code
    log(`P${n} matched in ${code}: ${players.map(p => `${p.name}/${p.pos}/t${p.team}`).join(', ')}`)
    const ws = sock(`/room/${code}`)
    P.room = ws
    ws.onerror = e => log(`P${n} room socket error ${e.message ?? ''}`)
    ws.onclose = e => { if (args.includes('--v')) log(`P${n} room closed ${e.code} ${e.reason}`) }
    ws.onopen = () => {
      send(ws, { t: 'hello', vid, bl: 1, key, token })
      const build = buildSeat(code, vid, pos)
      P.build = build
      const types = core.seatKit(pos).types
      setTimeout(() => send(ws, { t: 'build', build, role: 'balanced', player: null, filled: types.length, done: true }), 300 + n * 200)
    }
    ws.onmessage = e => {
      const m = JSON.parse(e.data)
      if (args.includes('--v')) log(`P${n} room: ${m.t}${m.t === 'room' ? ` ${m.phase}` : ''}`)
      if (m.t === 'final' || (m.t === 'room' && m.final)) {
        if (P.live) return
        P.final = m.final
        assert.ok(m.final.live, `P${n}: the room didn't go live (final.live missing)`)
        P.live = m.final.live
        game(m.final.live)
      }
      if (m.t === 'rated') P.ratedOld = m
    }
  }
  function game(code) {
    const ws = sock(`/btlive/room/${code}`)
    P.game = ws
    let g = null, me = -1, k = 0, n_ = [0, 0, 0, 0, 0], held = 0, d = [], rel = null, lastShoot = false, lastPass = false
    ws.onopen = () => send(ws, { t: 'hello', vid, key, token })
    ws.onmessage = e => {
      const m = JSON.parse(e.data)
      if (m.t === 'seat') {
        P.seat = m; me = m.i
        const teams = (m.mode === 'koth' ? [0, 1, 2] : [0, 1]).map(t => m.seats.filter(x => x.team === t).map((x, slot) => ({ id: `t${t}p${slot}`, name: x.name, pos: x.pos, build: x.build })))
        g = bl.createGame({ teams, seed: m.seed, mode: m.mode })
        log(`P${n} seat ${me} (${m.seats[me].name}, ${m.seats[me].pos}, team ${m.seats[me].team}) build ${JSON.stringify(Object.fromEntries(Object.entries(m.seats[me].build).map(([k2, v]) => [k2, v.val])))}`)
        return
      }
      if (m.t === 'rated') { P.rated = m.ratings; return }
      if (m.t !== 's' || !g) return
      proto.applySnap(g, m, -1)
      if (n === 0 && args.includes('--v')) { P.ev ??= {}; P.seen ??= new Set(); for (const x of m.e ?? []) if (!P.seen.has(x.sq)) { P.seen.add(x.sq); P.ev[x.e] = (P.ev[x.e] ?? 0) + 1 } if (m.k % 300 === 0) log(JSON.stringify(P.ev)) }
      if (n === 0 && args.includes('--v') && (m.sc.join('-') !== P.lastSc || m.k % 300 === 0)) { P.lastSc = m.sc.join('-'); log(`k ${m.k} ph ${m.ph} score ${P.lastSc} holder ${m.b.holder} ev ${(m.e ?? []).slice(-3).map(x => x.e).join(',')}`) }
      if (m.ph === 'over' && !P.done) { P.done = { winner: m.w, score: m.sc, stats: m.st }; log(`P${n} final: ${m.sc.join('-')}, winner team ${m.w}`); setTimeout(() => P.end(), 2500) }
    }
    // the bot: the CPU's own call on this copy, sent up as a device's input, 18 a second
    P.feed = setInterval(() => {
      if (!g || me < 0 || P.done || P.quit) return
      let inp
      try { inp = bl.cpuInput(g, me, 'pro') } catch (e) { if (!P.err) { P.err = 1; log('cpuInput threw', e.message) } inp = { mx: 0, my: 0 } }
      if (args.includes('--v') && inp.shoot && !lastShoot) log(`P${n} shoots`)
      k++
      if (inp.shoot && !lastShoot) { n_[0]++; rel = proto.relMsg(n_[0], 1) }
      if (inp.pass && !lastPass) n_[1]++
      if (inp.steal) n_[3]++
      if (inp.jump) n_[4]++
      if (inp.dx || inp.dy) { n_[2]++; d = [...d, [inp.dx, inp.dy, inp.sp || 0]].slice(-3) }
      lastShoot = !!inp.shoot; lastPass = !!inp.pass
      held = (inp.shoot ? 1 : 0) | (inp.pass ? 2 : 0)
      send(ws, { t: 'in', k, mx: inp.mx ?? 0, my: inp.my ?? 0, h: held, n: [...n_], d, ...(rel ? { rel } : {}) })
    }, 1000 / 18)
  }
  P.doQuit = () => { P.quit = true; send(P.game, { t: 'quit' }); setTimeout(() => { try { P.game.close() } catch {} try { P.room.close() } catch {} P.end() }, 500) }
  return P
}

const slots = SIZE === 1 ? [['0x', 'guard'], ['1x', 'big']] : SIZE === 'koth' ? [['k0', 'guard'], ['k1', 'big'], ['k2', 'guard']] : [['0g0', 'guard'], ['0b', 'big'], ['1g0', 'guard'], ['1b', 'big']]
// (--only=1: just those seats, the rest taken by someone else, a browser: scripts/btlive/lobby-live-shots.mjs)
const only = arg('only', null)?.split(',').map(Number)
// (--table=2: every scripted player takes lobby 2; --sitter: a man first sits alone in lobby 1 and stays there, never
// matched; --groups=2: two games at once, one in lobby 1 and one in lobby 2)
// (--sitter=2: he sits in lobby 2 instead; with --groups=0 the script only sits there, for --secs: a screenshot's other man)
const TABLE = Number(arg('table', 1)), GROUPS = Number(arg('groups', 1)), SITTER = Number(arg('sitter', args.includes('--sitter') ? 1 : 0))
let sitter = null
if (SITTER) { sitter = player(90, 'guard', slots[0][0], SITTER, true); await sitter.ready; await new Promise(r => setTimeout(r, 500)) }
if (SITTER && !GROUPS) { await new Promise(r => setTimeout(r, MAX_SECS * 1000 - 2000)); process.exit(0) }
const ps = []
for (let g = 0; g < GROUPS; g++) {
  slots.forEach(([sl, pos], i) => { if (!only || only.includes(i)) ps.push(Object.assign(player(g * 10 + i, pos, sl, GROUPS > 1 ? g + 1 : TABLE), { group: g })) })
  if (GROUPS > 1) await new Promise(r => setTimeout(r, 600))
}
const timeout = setTimeout(() => { console.log('FAIL timed out'); process.exit(1) }, MAX_SECS * 1000)
if (QUIT) {
  // the last man in quits 20 s into the game
  const q = ps[ps.length - 1]
  const wait = setInterval(() => { if (q.seat) { clearInterval(wait); setTimeout(() => { log(`P${q.n} QUITS`); q.doQuit() }, 20000) } }, 200)
}
await Promise.all(ps.map(p => p.ready))
await new Promise(r => setTimeout(r, 2500))
clearTimeout(timeout)
for (const p of ps) { clearInterval(p.feed); try { p.game?.close() } catch {} try { p.room?.close() } catch {} }

if (only) { console.log('done'); await vite.close(); stub.close(); process.exit(0) }
// ── what was booked ──
let fails = 0
const ok = (c, what) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${what}`); if (!c) fails++ }
const finOf = p => ps.find(q => q.group === p.group && q.done)?.done
const codes = [...new Set(ps.map(p => p.code))]
ok(codes.length === GROUPS && ps.every(p => finOf(p)), `${GROUPS} game(s), each its own room, each played to the end (${codes.map(c => `${c}: ${ps.find(p => p.code === c && p.done)?.done.score.join('-')}`).join(', ')})`)
ok(ps.every(p => p.matchTable === (GROUPS > 1 ? p.group + 1 : TABLE)), `each game came from its own lobby (${ps.map(p => p.matchTable).join(',')})`)
if (sitter) ok(sitter.lobbyAt === SITTER && !sitter.matched, `the man in lobby 1 is still there, waiting (lobby ${sitter.lobbyAt}, ${sitter.lastTables?.map(x => `${x.id}:${Object.values(x.spots).filter(Boolean).length}`).join(' ')})`)
const fin = ps.find(p => p.done)?.done
const mt = SIZE === 1 ? '1v1' : SIZE === 'koth' ? 'koth' : '2v2'
ok(booked.vs.length === ps.length && booked.vs.every(r => r.match_type === mt), `one ${mt} record a player (${booked.vs.map(r => `${r.match_type}:${r.result}`).join(', ')})`)
ok(booked.rating.length === ps.length, `one rating a player (${booked.rating.map(r => r.p_delta).join(', ')})`)
for (const p of ps) {
  const r = booked.vs.find(x => x.user_id === p.uid)
  const team = p.seat?.seats?.[p.seat.i]?.team
  const want = p.quit ? 'forfeit' : finOf(p)?.winner === team ? 'win' : 'loss'
  ok(r?.result === want && r?.position === p.pos, `P${p.n} (${p.pos}, team ${team}): booked ${r?.result}, wants ${want}`)
  // every seat played his own checked build: the grades are his spins' real ratings
  const sb = p.seat?.seats?.[p.seat.i]?.build
  ok(!!sb && core.seatKit(p.pos).types.every(t => sb[t]?.val === Math.min(11, p.build[t].val)), `P${p.n} played his own build`)
}
ok(booked.vs.filter(r => r.result === 'win').length === (SIZE === 2 ? 2 : 1) * GROUPS - (QUIT && SIZE === 2 && fin && ps[ps.length - 1].seat?.seats?.[ps[ps.length - 1].seat.i]?.team === fin.winner ? 1 : 0), 'the winning side booked its wins')
console.log(fails ? `\n${fails} failed` : '\nall good')
await vite.close(); stub.close()
process.exit(fails ? 1 : 0)
