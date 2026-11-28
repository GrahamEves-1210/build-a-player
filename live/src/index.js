// Build-A-Player live server: Blacktop 3v3 and 2v2 (live/, its own Worker; the site's
// payments API is server/, a different thing).
//
// One referee for the whole game, so every phone sees the same one:
//   Lobby (one, shared)  the six spots, lobby chat; when all six are taken it
//                        makes a match and sends those six to a Room. A practice
//                        room (you + five CPUs) starts at once.
//   Room (one a match)   the build clock, everyone's build progress, the start
//                        (with who didn't finish: they're out, a CPU takes the
//                        spot), the calls for each possession, reactions, chat,
//                        rematch.
// The server never runs the game itself: every phone runs the same engine on
// the same inputs (the builds, the seed, the calls), and the inputs only ever
// come from here, in one order, so the games can't come apart.
//
// Client → server and server → client messages are JSON: { t: type, ...fields }.
//
// The Trait Auction (auction.js) and Compete pools (compete.js) live here too:
// there the server runs the whole thing itself (the auctioneer; the scorer).
//
// Watching: the Blacktop menu lists the games being played (games.js), and anyone
// can take a seat in the stands of one (Room.watch). A spectator only ever gets
// what everyone in the game already sees, and nothing they send does anything.

import { AuctionQueue, AuctionRoom, validSportPos } from './auction.js'
import { CompeteQueue, CompeteRoom, validCompete } from './compete.js'
import { competeQueue } from '../../src/lib/competeCore.js'
import { Games } from './games.js'
import { postLeaderboards } from './leaderboards.js'
import { cleanBuild } from '../../src/lib/blacktopCore.js'
import { playOut } from '../../src/lib/blacktopPlay.js'
import { blacktopDelta } from '../../src/lib/rating.js'
import { NBA_GUARD_PLAYERS, VERSUS_GUARD_TYPES } from '../../src/data/nba-guards.js'
import { NBA_BIG_PLAYERS, VERSUS_BIG_TYPES } from '../../src/data/nba-bigs.js'
import { bookRatings, bookVs } from './rating.js'
import { handleSubmit } from './submit.js'
import { whoIs } from './auth.js'
import { handleReset } from './reset.js'
import { countPoster, ONE_PER_DEVICE } from './queue.js'
// Blacktop Live (the real-time game): its rooms, the referee (btlive.js), and King of the Hill's queue (koth.js)
import { BtLiveRoom } from './btlive.js'
import { geoOf, hintFor, withGeo } from './place.js'
import { KothQueue } from './koth.js'
export { AuctionQueue, AuctionRoom, CompeteQueue, CompeteRoom, Games, BtLiveRoom, KothQueue }

const BUILD_SECS = 180
const PRACTICE_BUILD_SECS = 600
const CALL_MS = 3200
const CALL_WAIT_MAX = 4500         // the call window opens when everyone's at the check-up, or after this
const SLOTS = [
  { id: '0g0', team: 0, pos: 'guard' }, { id: '0g1', team: 0, pos: 'guard' }, { id: '0b', team: 0, pos: 'big' },
  { id: '1g0', team: 1, pos: 'guard' }, { id: '1g1', team: 1, pos: 'guard' }, { id: '1b', team: 1, pos: 'big' },
]
// 2v2 (its own lobby): a guard and a big a side
const SLOTS_2 = SLOTS.filter(sl => sl.id !== '0g1' && sl.id !== '1g1')
// 1v1 (its own lobby): one spot a side, and you say guard or big as you take it
const SLOTS_1 = [{ id: '0x', team: 0, pos: 'any' }, { id: '1x', team: 1, pos: 'any' }]
// King of the Hill (its own lobby, /lobbyk, since 2026-11-27): three spots, every man for himself (a side each), and
// each says guard or big as he takes it, as in 1v1. Played live only (Blacktop Live: there's no simulated King of the
// Hill), so only a phone that can play it live (bl in its hello) takes a spot
const SLOTS_K = [{ id: 'k0', team: 0, pos: 'any' }, { id: 'k1', team: 1, pos: 'any' }, { id: 'k2', team: 2, pos: 'any' }]
const slotsFor = size => (size === 1 ? SLOTS_1 : size === 2 ? SLOTS_2 : size === 'koth' ? SLOTS_K : SLOTS)
const lobbyName = size => (size === 1 ? 'blacktop1' : size === 2 ? 'blacktop2' : size === 'koth' ? 'blacktopk' : 'blacktop')
const sizeOf = v => (v === 1 || v === 2 || v === 'koth' ? v : 3)
// the position a spot plays: its own, or (a 1v1 spot) the one asked for
const posFor = (sl, asked) => (sl.pos === 'any' ? (asked === 'big' ? 'big' : 'guard') : sl.pos)
const BOT_NAMES = ['Smoke', 'Shifty', 'Glass', 'Sauce', 'Twitch', 'Hammer', 'Ghost', 'Blitz', 'Cash', 'Lefty', 'Rook', 'Stretch']
const OFF_CALLS = ['drive', 'pullup', 'post', 'pass']
const DEF_CALLS = ['press', 'sag', 'help']
// a 1v1 has nobody to pass to and nobody to help (src/lib/hoops.js offCallsFor/defCallsFor)
const callsFor = (size, offense) => (offense ? OFF_CALLS : DEF_CALLS).filter(c => size > 1 || (c !== 'pass' && c !== 'help'))
const EMOTES = ['🔥', '🧊', '💰', '😤', '👏', '😂']
const MAX_WATCHERS = 50

// A 1v1 / 2v2 played live (Blacktop Live): a seat's checked build (cleanBuild: { jumpShot: { val, qbFull }, ... }) as
// the grades the live game runs on; a seat with none (he didn't finish: the CPU plays it) gets a real player's own,
// picked by the room's code
const poolOf = pos => (pos === 'big' ? NBA_BIG_PLAYERS : NBA_GUARD_PLAYERS)
const hash = t => { let h = 2166136261; for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
export function liveGrades(b, pos, seed) {
  const types = pos === 'big' ? VERSUS_BIG_TYPES : VERSUS_GUARD_TYPES
  if (!b) { const pool = poolOf(pos), p = pool[hash(seed) % pool.length]; b = Object.fromEntries(types.map(t => [t, { val: p.attrs?.[t] ?? 5, qbFull: p.name }])) }
  return Object.fromEntries(types.map(t => [t, { val: Math.min(11, Math.max(0, +b[t]?.val || 0)) }]))
}
// how his man looks: the player his Basketball IQ came from (the face the old game showed), found by the phone by name
export function liveLook(b, pos) {
  const name = b?.basketballIQ?.qbFull
  const p = name && name !== 'Free agent' ? poolOf(pos).find(x => x.name === name) ?? null : null
  return { photo: null, faceCenter: p?.faceCenter ?? null, skin: p?.skin ?? null, num: p?.number != null ? String(p.number) : null, player: p?.name ?? null }
}

const ORIGINS = [/^https:\/\/(www\.)?build-a-player\.com$/, /^https:\/\/([a-z0-9-]+\.)?build-a-player\.pages\.dev$/, /^https:\/\/localhost$/, /^https?:\/\/localhost(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/]
const originOk = o => !o || ORIGINS.some(re => re.test(o))

const code6 = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[b % 32]).join('')
const str = (v, n = 40) => (typeof v === 'string' ? v.slice(0, n) : '')
const send = (ws, msg) => { try { ws.send(JSON.stringify(msg)) } catch {} }
const parse = data => { try { const m = JSON.parse(data); return m && typeof m === 'object' ? m : null } catch { return null } }
// who a player is, as everyone sees them (only what's safe to show)
const pub = h => ({ vid: str(h.vid), name: str(h.name, 24) || 'Guest', uid: str(h.uid, 64) || null, cos: h.cos && typeof h.cos === 'object' ? h.cos : null })
// a seat's secret (see queue.js): kept server-side, never sent to anyone
const key = m => str(m?.key, 64) || null
const keyOk = (keys, vid, k) => !keys?.[vid] || keys[vid] === k
const reject = ws => { send(ws, { t: 'taken', why: 'seat' }); try { ws.close(1000, 'seat taken') } catch {} }

export default {
  // #leaderboards on Discord: the Daily at midnight New York, the Weekly Cup on Mondays (leaderboards.js, wrangler.toml [triggers])
  async scheduled(event, env, ctx) { ctx.waitUntil(postLeaderboards(env, new Date(event.scheduledTime))) },
  async fetch(req, env) {
    const url = new URL(req.url)
    if (url.pathname === '/health') return new Response('ok')
    // results for the boards, checked before they're saved (submit.js)
    const sub = url.pathname.match(/^\/api\/submit\/([a-z]+)$/)
    if (sub) return handleSubmit(req, env, sub[1])
    // forgot password: the reset link goes to the account's contact email (reset.js)
    if (url.pathname === '/api/reset-request') return handleReset(req, env)
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Build-A-Player live server', { status: 426 })
    if (!originOk(req.headers.get('Origin'))) return new Response('forbidden', { status: 403 })
    if (url.pathname === '/lobby') return env.LOBBY.get(env.LOBBY.idFromName('blacktop')).fetch(req)
    if (url.pathname === '/lobby2') return env.LOBBY.get(env.LOBBY.idFromName('blacktop2')).fetch(req)
    if (url.pathname === '/lobby1') return env.LOBBY.get(env.LOBBY.idFromName('blacktop1')).fetch(req)
    if (url.pathname === '/lobbyk') return env.LOBBY.get(env.LOBBY.idFromName('blacktopk')).fetch(req)
    // the live games, for the Blacktop menu (games.js)
    if (url.pathname === '/games') return env.GAMES ? env.GAMES.get(env.GAMES.idFromName('blacktop')).fetch(req) : new Response('not found', { status: 404 })
    // how many are waiting in each Compete / Trait Auction queue and Blacktop lobby: numbers only (games.js)
    if (url.pathname === '/counts') return env.GAMES ? env.GAMES.get(env.GAMES.idFromName('blacktop')).fetch(req) : new Response('not found', { status: 404 })
    if (url.pathname === '/auction/q') {
      const sport = url.searchParams.get('sport'), pos = url.searchParams.get('pos')
      if (!validSportPos(sport, pos)) return new Response('bad', { status: 400 })
      return env.AUCTION_QUEUE.get(env.AUCTION_QUEUE.idFromName(`${sport}-${pos}`)).fetch(req)
    }
    if (url.pathname === '/compete/q') {
      // a queue per sport + position; soccer's per pool too (TOP DIVISIONS / WORLD CUP: competeCore competeQueue)
      const sport = url.searchParams.get('sport'), pos = url.searchParams.get('pos'), mode = url.searchParams.get('mode')
      if (!validCompete(sport, pos, mode)) return new Response('bad', { status: 400 })
      return env.COMPETE_QUEUE.get(env.COMPETE_QUEUE.idFromName(competeQueue(sport, pos, mode))).fetch(req)
    }
    const cp = url.pathname.match(/^\/compete\/room\/([A-Z0-9]{6})$/)
    if (cp) return env.COMPETE_ROOM.get(env.COMPETE_ROOM.idFromName(cp[1])).fetch(req)
    const au = url.pathname.match(/^\/auction\/room\/([A-Z0-9]{6})$/)
    if (au) return env.AUCTION_ROOM.get(env.AUCTION_ROOM.idFromName(au[1])).fetch(req)
    // King of the Hill (Blacktop Live): the queue, and the rooms the queue makes (a dev link's room: btlive.js)
    // (the queue is told where each line came in from, so it makes each room near its three: place.js)
    if (url.pathname === '/btlive/koth') return env.KOTH_QUEUE ? env.KOTH_QUEUE.get(env.KOTH_QUEUE.idFromName('koth')).fetch(withGeo(req)) : new Response('not found', { status: 404 })
    const bl = url.pathname.match(/^\/btlive\/room\/([A-Z0-9]{6})$/)
    // (a room the queue made is already where it is; a dev room is made here, by its first player's call, near him)
    if (bl) { if (!env.BTLIVE_ROOM) return new Response('not found', { status: 404 }); const hint = hintFor([geoOf(req, false)]); return env.BTLIVE_ROOM.get(env.BTLIVE_ROOM.idFromName(bl[1]), hint ? { locationHint: hint } : undefined).fetch(req) }
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{6})$/)
    // (where each line came in from: a 1v1 / 2v2 played live has its Blacktop Live room made near them, place.js)
    if (m) return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(withGeo(req))
    return new Response('not found', { status: 404 })
  },
}

// ── Lobby ────────────────────────────────────────────────────────────────────
// One a mode (1v1, 2v2, King of the Hill; 3v3's stays for old links), and in it the tables (LOBBY 1, LOBBY 2…, since
// 2026-11-27): every table someone is in, plus one empty one, so a player who'd rather not join the man already
// waiting (or wants one with just his friends) takes the empty one. Each table is its own set of spots and makes its
// own match (its own Room: seat keys, the build check, chat, the live hand-off and the booking all as before); the
// mode's "N playing" count is all of them. An older app knows only table 1: its spots are the state's `spots`, and a
// seat it takes (no table) is table 1.
// (not exported: a worker's main module may only export handlers and classes; the checks read Lobby.MAX_TABLES)
const MAX_TABLES = 4
// A table that fills doesn't tip off at once: MATCH FOUND, three seconds (2026-11-28, a player's ask: "make sure ur
// playing the ppl u want"). The lobby holds the start; anyone at the table can back out in that time, and then the
// count is off, his spot is open again and the rest wait on as before. Only a table still full when the three seconds
// are up makes its match. (GO_MS 0: at once, as before; the older checks set it)
const GO_MS = 3000
export class Lobby {
  static MAX_TABLES = MAX_TABLES
  static GO_MS = GO_MS
  constructor(state, env) {
    this.env = env
    this.conns = new Map()     // ws → player
    this.tables = {}           // n → { spots: { slotId → { ...player, at } }, held: { slotId → { vid, until } } }
    this.size = 3              // 3v3, or 2v2 (the /lobby2 one): set by the first request
  }
  get slots() { return slotsFor(this.size) }
  T(n) { return (this.tables[n] ??= { spots: {}, held: {}, go: null }) }
  ids() { return Object.keys(this.tables).map(Number).sort((a, b) => a - b) }
  // table 1's spots (what an older app reads), kept for the checks that read lobby.spots
  get spots() { return this.T(1).spots }
  set spots(v) { this.T(1).spots = v }
  get held() { return this.T(1).held }
  set held(v) { this.T(1).held = v }
  // One spot a player (a tab's vid), one an account, one a device (queue.js ONE_PER_DEVICE): the
  // spots and the live holds, across every table. A squad's hold asked for twice (RUN IT BACK sent twice before the
  // vote came back) once held the other side's spot for the same player too: "the same player on both sides".
  liveHolds(n = null) { const now = Date.now(); return (n == null ? this.ids() : [n]).flatMap(t => Object.entries(this.T(t).held).filter(([, h]) => h.until > now).map(([id, h]) => [id, h, t])) }
  allSpots() { return this.ids().flatMap(t => Object.entries(this.T(t).spots).map(([id, s]) => [id, s, t])) }
  // where vid is: { t, id } (a spot, or a hold for him), or null
  placeOf(vid) {
    const s = this.allSpots().find(([, p]) => p.vid === vid) ?? this.liveHolds().find(([, h]) => h.vid === vid)
    return s ? { t: s[2], id: s[0] } : null
  }
  // why p can't have a spot: someone else here is the same account or the same device ('account' / 'device'), or null
  clash(p) {
    const others = [...this.allSpots().map(([, s]) => s), ...this.liveHolds().map(([, h]) => h)].filter(q => q.vid !== p.vid)
    if (p.uid && others.some(q => q.uid === p.uid)) return 'account'
    if (ONE_PER_DEVICE && p.dev && others.some(q => q.dev === p.dev)) return 'device'
    return null
  }
  // a player out of every spot and every hold, at every table
  drop(vid) {
    for (const t of this.ids()) {
      const T = this.T(t)
      for (const id of Object.keys(T.spots)) if (T.spots[id].vid === vid) delete T.spots[id]
      for (const id of Object.keys(T.held)) if (T.held[id].vid === vid) delete T.held[id]
    }
  }
  taken(t) { return Object.keys(this.T(t).spots).length + this.liveHolds(t).length }
  full(t) { return this.slots.every(sl => this.T(t).spots[sl.id]) }
  // every table's countdown as its spots now stand: a full table without one starts one (MATCH FOUND), one that's
  // no longer full loses it. Run after anything that seats or unseats anyone, before the state goes out.
  // (GO_MS 0: the full tables, to make their matches now)
  settle() {
    const now = []
    for (const t of this.ids()) {
      const T = this.T(t)
      if (T.making) continue
      if (this.full(t)) {
        if (T.go) continue
        if (Lobby.GO_MS <= 0) { now.push(t); continue }
        // (who it's for: the count runs out on the same five, or nobody's sent anywhere)
        const go = T.go = { ends: Date.now() + Lobby.GO_MS, who: this.slots.map(sl => T.spots[sl.id].vid).join() }
        go.timer = setTimeout(() => this.tipOff(t, go), Lobby.GO_MS)
      } else if (T.go) { clearTimeout(T.go.timer); T.go = null }
    }
    return now
  }
  // a table's three seconds are up: still full, with the same men in it, it makes its match
  async tipOff(t, go) {
    const T = this.T(t)
    if (T.go !== go) return
    T.go = null
    if (!this.full(t) || this.slots.map(sl => T.spots[sl.id].vid).join() !== go.who) { this.settle(); this.broadcast(this.state()); return }
    try { await this.makeMatch(t) } catch { this.settle(); this.broadcast(this.state()) }
  }
  // settle, the state to everyone, and any match due now
  async changed() {
    const now = this.settle()
    this.broadcast(this.state())
    for (const t of now) if (this.full(t)) await this.makeMatch(t)
  }
  // the tables shown: every one someone is in (or held for), then one empty one (the lowest number free), at most
  // MAX_TABLES in all
  visible() {
    const busy = this.ids().filter(t => this.taken(t) > 0)
    const free = [...Array(MAX_TABLES).keys()].map(i => i + 1).find(t => !busy.includes(t))
    return free ? [...busy, free] : busy
  }
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/lobby2' || url.searchParams.get('size') === '2') this.size = 2
    if (url.pathname === '/lobby1' || url.searchParams.get('size') === '1') this.size = 1
    if (url.pathname === '/lobbyk' || url.searchParams.get('size') === 'koth') this.size = 'koth'
    // a squad running it back: hold a side for them (both guards and the big together), at the table they played from
    // if it has room, else another
    if (url.pathname === '/hold' && req.method === 'POST') {
      const { players, keys = {}, table = 1 } = await req.json()
      const now = Date.now()
      for (const t of this.ids()) for (const [id, h] of Object.entries(this.T(t).held)) if (h.until < now) delete this.T(t).held[id]
      // asked again for a squad already on its way (a second RUN IT BACK): the spots it has stand,
      // and only the ones still without a spot get one, on the same side
      const placed = players.map(p => this.placeOf(str(p.vid))).filter(Boolean)
      const rest = players.filter(p => !this.placeOf(str(p.vid)))
      if (!rest.length) return new Response(JSON.stringify({ ok: placed.length > 0 }))
      // the same account already here under another seat (his other phone): no spot held for this one
      if (rest.some(p => this.clash(pub(p)))) return new Response(JSON.stringify({ ok: false }))
      const want = Number.isInteger(table) && table >= 1 && table <= MAX_TABLES ? table : 1
      const order = placed.length ? [placed[0].t] : [want, ...[...Array(MAX_TABLES).keys()].map(i => i + 1).filter(t => t !== want)]
      for (const tn of order) {
        const T = this.T(tn)
        const free = sl => !T.spots[sl.id] && !(T.held[sl.id] && T.held[sl.id].until > now)
        const sides = placed.length ? [this.slots.find(sl => sl.id === placed[0].id).team] : [...new Set(this.slots.map(sl => sl.team))]
        for (const team of sides) {
          const left = this.slots.filter(sl => sl.team === team && free(sl))
          const plan = []
          for (const p of rest) { const i = left.findIndex(sl => sl.pos === p.pos || sl.pos === 'any'); if (i < 0) break; plan.push([left[i], p]); left.splice(i, 1) }
          if (plan.length === rest.length) {
            for (const [sl, p] of plan) T.held[sl.id] = { ...pub(p), key: keys[p.vid] ?? null, pos: p.pos === 'big' ? 'big' : 'guard', until: now + 60000 }
            this.broadcast(this.state())
            return new Response(JSON.stringify({ ok: true }))
          }
        }
      }
      return new Response(JSON.stringify({ ok: false }))
    }
    const [client, server] = Object.values(new WebSocketPair())
    server.accept()
    server.addEventListener('message', e => this.onMessage(server, e.data))
    const bye = () => this.onClose(server)
    server.addEventListener('close', bye); server.addEventListener('error', bye)
    return new Response(null, { status: 101, webSocket: client })
  }
  // table t's spots as everyone sees them: a spot held for a squad on its way shows as taken (it's theirs)
  shown(t) {
    const now = Date.now(), T = this.T(t)
    const show = sl => {
      const h = T.spots[sl.id] ?? (T.held[sl.id] && T.held[sl.id].until > now ? T.held[sl.id] : null)
      return h ? { ...pub(h), pos: h.pos ?? sl.pos } : null
    }
    return Object.fromEntries(this.slots.map(sl => [sl.id, show(sl)]))
  }
  state() {
    // (spots: table 1's, for an older app; tables: every table shown, in order)
    return { t: 'lobby', size: this.size, spots: this.shown(1), tables: this.visible().map(id => ({ id, spots: this.shown(id), ...(this.T(id).go ? { go: Math.max(0, this.T(id).go.ends - Date.now()) } : {}) })), here: [...this.conns.values()].map(pub) }
  }
  broadcast(msg) {
    for (const ws of this.conns.keys()) send(ws, msg)
    // the spots taken at every table, for the Blacktop menu's "3 searching" (games.js): the number only
    if (msg?.t === 'lobby') { this.count ??= countPoster(this.env, `bt:${this.size}`); this.count(msg.tables.reduce((n, x) => n + Object.values(x.spots).filter(Boolean).length, 0)) }
  }
  async onMessage(ws, data) {
    const m = parse(data); if (!m) return
    if (m.t === 'hello') {
      // the name and account come from the player's session, not from what the phone says
      const who = await whoIs(m.token, this.env)
      // (the device stays here: it's never in what anyone is sent, pub() leaves it out)
      const p = { ...pub(m), uid: who.uid, name: who.name, key: key(m), dev: str(m.dev, 64) || null, bl: m.bl === 1 }; if (!p.vid) return
      // one connection a player: a reconnect replaces the old one (with the same key only)
      for (const [w, q] of this.conns) if (q.vid === p.vid && w !== ws && q.key && q.key !== p.key) return reject(ws)
      if (this.allSpots().some(([, s]) => s.vid === p.vid && s.key && s.key !== p.key)) return reject(ws)
      for (const [w, q] of this.conns) if (q.vid === p.vid && w !== ws) { this.conns.delete(w); try { w.close(1000, 'replaced') } catch {} }
      this.conns.set(ws, p)
      // back from a game with the squad: straight into the spot held for them (one: already in a
      // spot, a reconnect, and any other hold for them goes; the same account or device here already, none)
      const now = Date.now()
      const mine = this.liveHolds().find(([, h]) => h.vid === p.vid && (!h.key || h.key === p.key))
      if (mine) {
        const [id, h, t] = mine
        const seated = this.allSpots().some(([, s]) => s.vid === p.vid)
        for (const tn of this.ids()) for (const hid of Object.keys(this.T(tn).held)) if (this.T(tn).held[hid].vid === p.vid) delete this.T(tn).held[hid]
        if (!seated && !this.clash(p)) this.T(t).spots[id] = { ...p, at: now, pos: h.pos }
        return this.changed()
      }
      this.broadcast(this.state())
      return
    }
    const me = this.conns.get(ws); if (!me) return
    if (m.t === 'seat') {
      // (no table: an older app, table 1)
      const t = Number.isInteger(m.table) && m.table >= 1 && m.table <= MAX_TABLES ? m.table : 1
      const T = this.T(t)
      const want = this.slots.find(sl => sl.id === m.slot) ? m.slot : null
      // (King of the Hill is live only: an app too old to play it live is told to update)
      if (want && this.size === 'koth' && !me.bl) return send(ws, { t: 'bumped', why: 'update' })
      const heldFor = want && T.held[want] && T.held[want].until > Date.now() ? T.held[want].vid : null
      if (want && ((T.spots[want] && T.spots[want].vid !== me.vid) || (heldFor && heldFor !== me.vid))) return send(ws, { t: 'bumped' })
      // the same account (another phone, another tab) or the same device already has a spot here
      const why = want && this.clash(me)
      if (why) return send(ws, { t: 'bumped', why })
      // out of any spot, and any spot held for me, before the new one
      this.drop(me.vid)
      if (want) T.spots[want] = { ...me, at: Date.now(), pos: posFor(this.slots.find(sl => sl.id === want), m.pos) }
      return this.changed()
    }
    if (m.t === 'chat') {
      // a table's own chat: a man in a spot talks to his table; one not in any spot, to everyone
      const text = str(m.text, 120).trim(); if (!text) return
      const at = this.placeOf(me.vid)?.t ?? null
      const line = { t: 'chat', from: me.vid, name: me.name, uid: me.uid, cos: me.cos, text, ts: Date.now(), all: true, table: at }
      for (const [w, q] of this.conns) if (at == null || this.placeOf(q.vid)?.t === at || q.vid === me.vid) send(w, line)
      return
    }
    if (m.t === 'typing') return this.broadcast({ t: 'typing', from: me.vid, name: me.name })
    if (m.t === 'practice' && this.size !== 'koth') {
      // you and CPUs, at once: you take a spot for your position, CPUs the rest
      const pos = m.pos === 'big' ? 'big' : 'guard'
      const code = code6()
      const mine = this.slots.find(sl => (sl.pos === pos || sl.pos === 'any') && sl.team === 0)
      // a test fill (the lobby's TEST button): the CPUs come dressed as players, with
      // the usernames and looks the client made up (still CPUs underneath: they build
      // and call like any CPU, and nothing they do is recorded)
      const mimic = Array.isArray(m.mimic) ? m.mimic.slice(0, 6).map(x => ({
        name: str(x?.name, 20).replace(/[^a-zA-Z0-9_-]/g, '') || null,
        cos: x?.cos && typeof x.cos === 'object' ? Object.fromEntries(['avatar', 'nameColor', 'nameFx', 'plate'].filter(k => typeof x.cos[k] === 'string').map(k => [k, x.cos[k].slice(0, 40)])) : null,
      })) : null
      let b = 0
      const players = this.slots.map((sl, i) => {
        if (sl === mine) return { ...pub(me), pos, team: sl.team, slot: sl.id, bot: false }
        const look = mimic?.[b++]
        return { vid: `bot-${code}-${sl.id}`, name: look?.name || BOT_NAMES[(i * 5) % BOT_NAMES.length], uid: null, cos: look?.cos ?? null, pos: posFor(sl, code.charCodeAt(0) % 2 ? 'big' : 'guard'), team: sl.team, slot: sl.id, bot: true, ...(look?.name ? { mimic: true } : {}) }
      })
      await this.env.ROOM.get(this.env.ROOM.idFromName(code)).fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, players, practice: true, size: this.size, keys: { [me.vid]: me.key ?? null } }) })
      this.drop(me.vid)
      send(ws, { t: 'match', code, players })
      this.settle()
      this.broadcast(this.state())
    }
  }
  // table t is full: its match (its own Room), and the table is empty again
  async makeMatch(t = 1) {
    const T = this.T(t)
    // never a game against yourself: one player, account or device in two spots (an older
    // lobby's state) keeps the first spot it took, the rest open up, and nobody tips off yet
    const seen = new Set(), dup = []
    for (const [, s, tn] of [...this.allSpots()].sort((a, b) => (a[1].at ?? 0) - (b[1].at ?? 0))) {
      const ids = [`v:${s.vid}`, s.uid && `u:${s.uid}`, ONE_PER_DEVICE && s.dev && `d:${s.dev}`].filter(Boolean)
      if (ids.some(k => seen.has(k))) { if (tn === t) dup.push(Object.keys(T.spots).find(id => T.spots[id] === s)) } else ids.forEach(k => seen.add(k))
    }
    if (dup.length) { for (const id of dup) delete T.spots[id]; this.settle(); this.broadcast(this.state()); return }
    const code = code6()
    const players = this.slots.map(sl => ({ ...pub(T.spots[sl.id]), pos: T.spots[sl.id].pos ?? posFor(sl, 'guard'), team: sl.team, slot: sl.id, bot: false }))
    const keys = Object.fromEntries(this.slots.map(sl => [T.spots[sl.id].vid, T.spots[sl.id].key ?? null]))
    // (its room being made: no new count for this table while the room's /init is out)
    T.making = true
    try { await this.env.ROOM.get(this.env.ROOM.idFromName(code)).fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, players, practice: false, size: this.size, keys, table: t }) }) } finally { T.making = false }
    const vids = new Set(players.map(p => p.vid))
    T.spots = {}
    for (const [ws, p] of this.conns) if (vids.has(p.vid)) send(ws, { t: 'match', code, players, table: t })
    this.broadcast(this.state())
  }
  onClose(ws) {
    const me = this.conns.get(ws); this.conns.delete(ws)
    if (!me) return
    // still connected somewhere else (a reconnect): keep the spot
    if ([...this.conns.values()].some(p => p.vid === me.vid)) return
    for (const t of this.ids()) for (const id of Object.keys(this.T(t).spots)) if (this.T(t).spots[id].vid === me.vid) delete this.T(t).spots[id]
    this.settle()
    this.broadcast(this.state())
  }
}

// ── Room: one match ──────────────────────────────────────────────────────────
export class Room {
  constructor(state, env) {
    this.env = env
    this.conns = new Map()      // ws → vid
    this.watchers = new Set()   // spectators' sockets: never players, never in `here`
    this.m = null               // { code, players, practice, seed, created, phase, builds, final, locks, ... }
    this.timers = new Set()
  }
  later(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); fn() }, ms); this.timers.add(id); return id }
  clear(id) { if (id) { clearTimeout(id); this.timers.delete(id) } }
  // ── Watching ──
  // A game can be watched once it's tipped off (every build is out in the open by then)
  // between real players whose seats are all locked to their own phones (a seat taken
  // without a key, by an older app, could be said hello to by anyone who knows the code,
  // and watching hands out the code with the seed). Never a practice run.
  watchable() {
    const m = this.m
    return !!m && !m.practice && !m.final?.live && m.phase !== 'build' && this.humans().every(p => this.keys?.[p.vid])
  }
  watch(ws) {
    const m = this.m
    if (this.conns.has(ws)) return
    const why = !m || m.practice ? 'gone' : m.phase === 'build' ? 'early' : !this.watchable() ? 'closed' : this.watchers.size >= MAX_WATCHERS ? 'full' : null
    if (why) { send(ws, { t: 'nowatch', why }); try { ws.close(1000, 'no watching') } catch {} return }
    this.watchers.add(ws)
    // what every player has had since the tip-off: who's playing, the seed, the builds, the calls so far
    send(ws, { t: 'watching', players: m.players, size: m.size, seed: m.seed, final: m.final, locks: m.locks, n: this.watchers.size })
    this.watchCount()
  }
  // to the stands: only what goes to both teams at once (the calls as they lock, reactions)
  show(msg) { for (const ws of this.watchers) send(ws, msg) }
  watchCount() {
    this.show({ t: 'watchers', n: this.watchers.size })
    // the menu's count catches up a moment later (one post for a crowd coming in)
    if (!this.m?.listed || this.watchPost) return
    this.watchPost = setTimeout(() => { this.watchPost = null; if (this.m?.listed && this.m.phase === 'game') this.post() }, 3000)
  }
  // this game on the menu's list (games.js), or off it (over: done, or everyone's gone)
  async post(over = false) {
    const m = this.m, ns = this.env.GAMES
    if (!m || !ns || m.practice) return
    if (over && !m.listed) return
    if (!over && !this.watchable()) return
    m.listed = !over
    const body = over ? { code: m.code, over: true } : {
      code: m.code, size: m.size, started: m.started, score: m.shown ?? [0, 0], pn: m.seenPn ?? 0, watchers: this.watchers.size,
      players: m.players.map(p => ({ name: p.name, uid: p.uid ?? null, cos: p.cos ?? null, team: p.team, pos: p.pos, cpu: !!p.bot || !!m.final?.afk?.includes(p.vid) })),
    }
    try { await ns.get(ns.idFromName('blacktop')).fetch('https://games/update', { method: 'POST', body: JSON.stringify(body) }) } catch {}
  }
  // The score for the list, as the players' phones see it at each check-up (the server
  // doesn't play the game, and a spectator plays it out themselves: this is only the
  // menu's line, posted as each possession is called). A check-up only counts once the
  // one before it is called, and the most phones agreeing wins, so one phone can't put
  // a made-up score up for long.
  noteScore(pn, score, vid) {
    const m = this.m
    if (m.phase !== 'game' || !Number.isInteger(pn) || pn < (m.seenPn ?? 0) || (pn > 0 && !m.locks[pn - 1])) return
    if (!Array.isArray(score) || score.length !== 2 || !score.every(n => Number.isInteger(n) && n >= 0 && n <= 99)) return
    if (pn > (m.seenPn ?? 0) || !m.tally) { m.seenPn = pn; m.tally = {} }
    m.tally[vid] = `${score[0]}-${score[1]}`
    const votes = {}
    for (const k of Object.values(m.tally)) votes[k] = (votes[k] ?? 0) + 1
    m.shown = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0].split('-').map(Number)
  }
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/init' && req.method === 'POST') {
      const b = await req.json()
      this.m = { code: b.code, players: b.players, practice: !!b.practice, size: sizeOf(b.size), seed: b.code, round: 0, table: Number.isInteger(b.table) ? b.table : 1 }
      this.keys = b.keys || {}
      this.startBuild()
      return new Response('ok')
    }
    const [client, server] = Object.values(new WebSocketPair())
    server.accept()
    server.geo = geoOf(req)
    server.addEventListener('message', e => this.onMessage(server, e.data))
    const bye = () => this.onClose(server)
    server.addEventListener('close', bye); server.addEventListener('error', bye)
    return new Response(null, { status: 101, webSocket: client })
  }
  broadcast(msg) { for (const ws of this.conns.keys()) send(ws, msg) }
  here() { return [...new Set(this.conns.values())] }
  humans() { return this.m.players.filter(p => !p.bot) }
  snapshot(viewer) {
    const m = this.m
    // while building, the other team's builds show only how far along they are
    const team = m.players.find(p => p.vid === viewer)?.team
    const builds = m.phase !== 'build' ? m.builds : Object.fromEntries(Object.entries(m.builds ?? {}).map(([v, b]) =>
      [v, m.players.find(p => p.vid === v)?.team === team ? b : { build: {}, role: 'balanced', filled: b.filled, done: b.done, player: null }]))
    return {
      t: 'room', now: Date.now(), code: m.code, players: m.players, practice: m.practice, size: m.size, seed: m.seed, created: m.created, ends: m.ends, phase: m.phase,
      here: this.here(), builds, final: m.final, locks: m.locks, votes: [...m.votes],
    }
  }
  startBuild() {
    const m = this.m
    for (const id of this.timers) clearTimeout(id)
    this.timers.clear()
    // nobody watches a build (the builds are hidden from the other team until the tip-off)
    for (const ws of this.watchers) { send(ws, { t: 'nowatch', why: 'early' }); try { ws.close(1000, 'no watching') } catch {} }
    this.watchers.clear()
    m.phase = 'build'
    m.created = Date.now()
    m.ends = m.created + (m.practice ? PRACTICE_BUILD_SECS : BUILD_SECS) * 1000
    m.builds = {}              // vid → { build, role, filled, done }
    m.final = null
    m.locks = {}               // pn → { 0: call, 1: call }
    m.calls = {}               // pn → { 0: call, 1: call } as they come in
    m.at = {}                  // pn → { team, vids: Set, first, timer }
    m.votes = new Set()
    m.goneAt = {}
    m.startTimer = this.later(() => this.start(), m.ends - Date.now())
  }
  // the game starts: anyone who didn't finish is out and a CPU takes the spot
  async start() {
    const m = this.m
    if (!m || m.phase !== 'build' || m.starting) return
    const here = new Set(this.here())
    // out: didn't finish, or finished but left for good (gone 20s+); a blip with a finished build is fine
    const afk = this.humans().filter(p => !m.builds[p.vid]?.done || (!here.has(p.vid) && Date.now() - (m.goneAt[p.vid] ?? 0) > 20000)).map(p => p.vid)
    m.final = {
      seed: `${m.seed}-f`,
      // the server's own copy of every build: only what each seat's spins dealt, at real ratings
      builds: Object.fromEntries(m.players.map(p => [p.vid, afk.includes(p.vid) || p.bot ? null : cleanBuild(m.builds[p.vid]?.build, p.pos, m.code, p.vid)])),
      roles: Object.fromEntries(m.players.map(p => [p.vid, m.builds[p.vid]?.role ?? 'balanced'])),
      afk,
    }
    // 1v1 and 2v2 are played live (Blacktop Live, the real-time game: btlive.js), with the builds just made, when
    // every phone still in it can (a new app says bl in its hello; an older one plays the old game, as before)
    m.starting = true
    const koth = m.size === 'koth'
    if (!m.practice && (m.size <= 2 || koth) && this.env.BTLIVE_ROOM) {
      // (King of the Hill: a phone that can't play it live sits it out, a forfeit, as one that didn't finish)
      if (koth) for (const p of this.humans()) if (!afk.includes(p.vid) && !this.bl?.has(p.vid)) afk.push(p.vid)
      const live = this.humans().filter(p => !afk.includes(p.vid))
      // (one man left of the three is no game: back to the lobby, nothing booked; the ones who left take theirs)
      if (koth && live.length < 2) { m.starting = false; m.phase = 'over'; for (const [w, v] of this.conns) send(w, live.some(p => p.vid === v) ? { t: 'requeue' } : { t: 'final', final: m.final }); return }
      if (live.length && live.every(p => this.bl?.has(p.vid))) {
        for (let k = 0; k < (koth ? 3 : 1) && !m.final.live; k++) m.final.live = await this.goLive(m.final).catch(() => null)
      }
      if (!m.final.live) delete m.final.live
      if (koth && !m.final.live) { m.starting = false; m.phase = 'over'; for (const [w] of this.conns) send(w, { t: 'requeue' }); return }
    }
    m.starting = false
    if (m.phase !== 'build') return
    m.phase = 'game'
    m.started = Date.now()
    this.broadcast({ t: 'final', final: m.final })
    // tipped off: on the menu's list of games to watch
    this.post()
  }
  // The game, live: a Blacktop Live room (btlive.js, the referee) made near them with every seat's own build, the one
  // the server just checked against his seeded spins (m.final.builds: only what his spins dealt, at real ratings).
  // A seat that didn't finish is played by the CPU on a real player's build and is out (a forfeit). The live room
  // books the result (rating, the 1v1 / 2v2 record); this one books nothing for it. Its code: the room's own.
  async goLive(final) {
    const m = this.m
    const geos = [...this.conns.keys()].map(w => w.geo ?? null)
    const hint = hintFor(geos)
    const koth = m.size === 'koth'
    const players = m.players.map((p, i) => {
      const out = !!final.afk?.includes(p.vid) || !!p.bot
      const b = out ? null : final.builds[p.vid]
      // (King of the Hill: a guest is Guest 1, 2 or 3 by his spot, as the queue named them)
      const name = koth && !p.uid ? `Guest ${i + 1}` : p.name
      return { vid: p.vid, uid: p.uid ?? null, name, team: p.team, pos: p.pos, out, build: liveGrades(b, p.pos, `${m.code}-${p.vid}`), look: liveLook(b, p.pos) }
    })
    const ns = this.env.BTLIVE_ROOM
    const r = await ns.get(ns.idFromName(m.code), hint ? { locationHint: hint } : undefined).fetch('https://btlive/init', { method: 'POST', body: JSON.stringify({ code: m.code, mode: koth ? 'koth' : m.size === 1 ? '1v1' : '2v2', players, keys: this.keys, hint }) })
    return r?.ok ? m.code : null
  }
  maybeStartEarly() {
    const m = this.m
    if (m.phase !== 'build') return
    const here = new Set(this.here())
    const now = Date.now()
    // everyone here is done, and anyone not here has been gone 20s (they're not coming back)
    const ready = this.humans().every(p => (here.has(p.vid) ? m.builds[p.vid]?.done : now - (m.goneAt[p.vid] ?? now) > 20000))
    if (here.size && ready) this.start()
  }
  // a check-up: the window opens when every player still here has reached it (or after a few seconds)
  arrive(pn, team, vid) {
    const m = this.m
    if (m.phase !== 'game' || m.locks[pn] || !Number.isInteger(pn) || pn < 0 || pn > 400) return
    const a = (m.at[pn] ??= { team: team === 1 ? 1 : 0, vids: new Set(), first: Date.now(), timer: null, opened: false })
    a.vids.add(vid)
    if (!a.timer) a.timer = this.later(() => this.lock(pn), CALL_WAIT_MAX + CALL_MS)
    const live = this.humans().filter(p => !m.final.afk.includes(p.vid) && this.here().includes(p.vid))
    if (!a.opened && live.every(p => a.vids.has(p.vid))) {
      a.opened = true
      this.clear(a.timer)
      a.timer = this.later(() => this.lock(pn), CALL_MS + 250)
      this.broadcast({ t: 'open', pn })
    }
  }
  lock(pn) {
    const m = this.m
    if (m.locks[pn]) return
    const a = m.at[pn]
    const c = m.calls[pn] ?? {}
    // a side with nobody to call it (CPUs, or everyone gone) calls something now and then
    for (const t of [0, 1]) {
      if (c[t] != null) continue
      const anyone = this.humans().some(p => p.team === t && !m.final.afk.includes(p.vid) && this.here().includes(p.vid))
      if (!anyone && Math.random() < 0.55) { const opts = callsFor(m.size, (a?.team ?? 0) === t); c[t] = opts[Math.floor(Math.random() * opts.length)] }
    }
    m.locks[pn] = { 0: c[0] ?? null, 1: c[1] ?? null }
    if (a) this.clear(a.timer)
    this.broadcast({ t: 'lock', pn, calls: m.locks[pn] })
    this.show({ t: 'lock', pn, calls: m.locks[pn] })
    // the menu's line: still going, and the score as of this check-up
    if (m.phase === 'game') this.post()
    this.settle()
  }
  // The game's over once every possession it plays has its calls locked: the server
  // plays it out the same way the phones do (lib/blacktopPlay.js) and books the result:
  // each player's rating and the 1v1 / 2v2 / 3v3 record. A player who was out (a CPU took
  // the spot) takes a forfeit. Practice books nothing.
  async settle() {
    const m = this.m
    if (!m || m.practice || m.settled || !m.final || m.final.live || (m.phase !== 'game' && m.phase !== 'result')) return
    const g = playOut({ final: m.final, match: m, locks: m.locks, pools: { guard: NBA_GUARD_PLAYERS, big: NBA_BIG_PLAYERS }, types: { guard: VERSUS_GUARD_TYPES, big: VERSUS_BIG_TYPES } })
    if (!g) return
    const last = Math.max(-1, ...g.plays.filter(p => p.type === 'check').map(p => p.pn))
    for (let pn = 0; pn <= last; pn++) if (!m.locks[pn]) return    // still being played
    m.settled = true
    const people = this.humans().filter(p => p.uid)
    const out = new Set(m.final.afk ?? [])
    const ratings = await bookRatings(this.env, people.map(p => ({ vid: p.vid, uid: p.uid, delta: blacktopDelta({ won: g.winner === p.team, mvp: g.mvp === p.vid, forfeit: out.has(p.vid) }) })))
    await bookVs(this.env, people.map(p => ({ uid: p.uid, result: out.has(p.vid) ? 'forfeit' : g.winner === p.team ? 'win' : 'loss', position: p.pos, match_type: `${m.size}v${m.size}` })))
    if (Object.keys(ratings).length) this.broadcast({ t: 'rated', ratings })
  }
  async onMessage(ws, data) {
    const msg = parse(data); if (!msg) return
    // someone watching: nothing they send does anything (they leave by closing)
    if (this.watchers.has(ws)) return
    if (msg.t === 'watch') return this.watch(ws)
    // a room the server no longer has (everyone left and it was cleared): over
    if (!this.m) { if (msg.t === 'hello') { send(ws, { t: 'gone' }); try { ws.close(1000, 'no game') } catch {} } return }
    const m = this.m
    if (msg.t === 'hello') {
      const vid = str(msg.vid)
      const me = m.players.find(p => p.vid === vid && !p.bot)
      if (!me) { send(ws, { t: 'gone' }); try { ws.close(1000, 'not in this game') } catch {} return }
      if (!keyOk(this.keys, vid, key(msg))) return reject(ws)
      for (const [w, v] of this.conns) if (v === vid && w !== ws) { this.conns.delete(w); try { w.close(1000, 'replaced') } catch {} }
      this.conns.set(ws, vid)
      delete m.goneAt?.[vid]
      // (a phone that can play the game live: Blacktop Live)
      if (msg.bl === 1) (this.bl ??= new Set()).add(vid)
      // back after everyone had left (the clocks were stopped): the build clock runs again
      if (m.phase === 'build' && !this.timers.has(m.startTimer)) m.startTimer = this.later(() => this.start(), Math.max(0, m.ends - Date.now()))
      send(ws, this.snapshot(vid))
      return this.broadcast({ t: 'here', here: this.here() })
    }
    const vid = this.conns.get(ws); if (!vid) return
    const me = m.players.find(p => p.vid === vid)
    if (!me) return
    switch (msg.t) {
      case 'build': {
        if (m.phase !== 'build') return
        const b = { build: msg.build && typeof msg.build === 'object' ? msg.build : {}, role: ['balanced', 'score', 'play', 'lock'].includes(msg.role) ? msg.role : 'balanced', filled: Math.max(0, Math.min(12, msg.filled | 0)), done: !!msg.done, player: msg.player ?? null }
        m.builds[vid] = b
        // your team sees your build as you make it; the other team only sees how far along you are
        for (const [w, v] of this.conns) {
          const p = m.players.find(x => x.vid === v)
          send(w, p?.team === me.team ? { t: 'build', from: vid, ...b } : { t: 'build', from: vid, build: {}, role: 'balanced', filled: b.filled, done: b.done, player: null })
        }
        return this.maybeStartEarly()
      }
      case 'at': this.noteScore(msg.pn, msg.score, vid); return this.arrive(msg.pn, msg.team, vid)
      case 'call': {
        if (m.phase !== 'game' || !Number.isInteger(msg.pn) || m.locks[msg.pn] || m.final.afk.includes(vid)) return
        // a play, a defense, or a pass to a named teammate ('pass:<vid>', one on the caller's team)
        const passTo = typeof msg.v === 'string' && msg.v.startsWith('pass:') ? m.players.find(p => p.vid === msg.v.slice(5) && p.team === me.team && p.vid !== vid) : null
        if (!callsFor(m.size, true).includes(msg.v) && !callsFor(m.size, false).includes(msg.v) && !passTo) return
        const c = (m.calls[msg.pn] ??= {})
        if (c[me.team] == null) c[me.team] = msg.v
        return
      }
      case 'emote': {
        if (!EMOTES.includes(msg.e)) return
        const e = { t: 'emote', from: vid, e: msg.e, ts: Date.now() }
        this.broadcast(e); this.show(e)
        return
      }
      case 'chat': {
        const text = str(msg.text, 120).trim(); if (!text) return
        const line = { t: 'chat', from: vid, name: me.name, uid: me.uid, cos: me.cos, team: me.team, text, ts: Date.now(), all: !!msg.all || m.size === 'koth' }
        for (const [w, v] of this.conns) { const p = m.players.find(x => x.vid === v); if (line.all || p?.team === me.team) send(w, line) }
        return
      }
      case 'typing': { for (const [w, v] of this.conns) { const p = m.players.find(x => x.vid === v); if (p?.team === me.team && v !== vid) send(w, { t: 'typing', from: vid, name: me.name }) } return }
      case 'done': { if (m.phase === 'game') { m.phase = 'result'; this.post(true) } this.settle(); return }
      case 'rematch': {
        // running it back is a squad thing: when everyone on my team who's still
        // here has voted, the lobby holds a side for us and we go back together
        if (m.phase === 'build') return
        // a vote counts once (a double tap sends two before the first comes back; the lobby's
        // hold also stands on its own if it's asked twice for one squad)
        if (m.votes.has(vid)) return
        m.votes.add(vid)
        this.broadcast({ t: 'votes', votes: [...m.votes] })
        const squad = this.humans().filter(p => p.team === me.team && this.here().includes(p.vid))
        if (!squad.length || !squad.every(p => m.votes.has(p.vid))) return
        if (m.practice) { for (const [w, v] of this.conns) if (squad.some(p => p.vid === v)) send(w, { t: 'requeue', practice: true }); return }
        const res = await this.env.LOBBY.get(this.env.LOBBY.idFromName(lobbyName(m.size))).fetch(`https://lobby/hold?size=${m.size}`, { method: 'POST', body: JSON.stringify({ table: m.table ?? 1, players: squad.map(p => ({ vid: p.vid, name: p.name, uid: p.uid, cos: p.cos, pos: p.pos })), keys: Object.fromEntries(squad.map(p => [p.vid, this.keys[p.vid] ?? null])) }) })
        const ok = (await res.json().catch(() => ({}))).ok
        for (const [w, v] of this.conns) if (squad.some(p => p.vid === v)) send(w, { t: 'requeue', held: !!ok })
        return
      }
    }
  }
  onClose(ws) {
    // someone leaving the stands: just one less watching
    if (this.watchers.delete(ws)) { this.watchCount(); return }
    const vid = this.conns.get(ws); this.conns.delete(ws)
    if (!vid || !this.m) return
    if (this.here().includes(vid)) return
    if (this.m.goneAt) this.m.goneAt[vid] = Date.now()
    this.broadcast({ t: 'here', here: this.here() })
    // 20s on, if they're still gone, the rest may not have to wait for them
    if (this.m.phase === 'build') this.later(() => this.maybeStartEarly(), 20500)
    // the rest are done building: no need to wait on someone who left
    this.maybeStartEarly()
    // nobody left at all: stop the clocks (and the game comes off the menu's list)
    if (!this.conns.size) { for (const id of this.timers) clearTimeout(id); this.timers.clear(); this.post(true) }
  }
}
