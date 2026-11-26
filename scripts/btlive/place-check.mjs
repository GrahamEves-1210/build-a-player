// BLACKTOP LIVE online: where a room is made (live/src/place.js). The hint for a room's players (the least of the
// most: the region whose farthest player is nearest), the continent when a line has no city on it, and the King of the
// Hill queue (koth.js): it makes each room with the hint, on the /init call that creates it, and while that call is
// out the three in it are in no other match.
// Bundle and run from the repo root (koth.js reads the app's code, which plain node can't load):
//   node_modules/.bin/esbuild scripts/btlive/place-check.mjs --bundle --platform=node --format=esm --outfile=/tmp/pc.mjs \
//     --define:import.meta.env='{"DEV":false}' --loader:.json=json && node /tmp/pc.mjs
import { hintFor, geoOf, km, HINTS } from '../../live/src/place.js'
import { KothQueue } from '../../live/src/koth.js'

let fails = 0
const ok = (cond, what) => { console.log(`${cond ? 'ok  ' : 'FAIL'}  ${what}`); if (!cond) fails++ }
const at = (lat, lon) => ({ lat, lon, cont: null, cc: null })
const C = { LA: at(34.05, -118.24), SEA: at(47.6, -122.3), NY: at(40.7, -74), CHI: at(41.9, -87.6), MIA: at(25.8, -80.2), LON: at(51.5, -0.1),
  PAR: at(48.9, 2.35), WAR: at(52.2, 21), SYD: at(-33.9, 151.2), MEL: at(-37.8, 145), TOK: at(35.7, 139.7), SIN: at(1.35, 103.8), SAO: at(-23.5, -46.6),
  JNB: at(-26.2, 28), DXB: at(25.2, 55.3), DEN: at(39.7, -105) }

console.log('── the hint ──────────────────────────────────────────────────────────────────────────────────')
for (const [who, want] of [
  [['LA', 'SEA', 'LA'], 'wnam'], [['NY', 'MIA', 'CHI'], 'enam'], [['LON', 'PAR', 'LON'], 'weur'], [['WAR', 'WAR', 'WAR'], 'eeur'], [['WAR', 'WAR', 'PAR'], null],
  [['SYD', 'MEL', 'SYD'], 'oc'], [['TOK', 'SIN', 'SIN'], 'apac'], [['SAO', 'SAO'], 'sam'], [['JNB', 'JNB', 'JNB'], 'afr'], [['DXB', 'DXB'], 'me'],
  [['LA', 'NY'], null], [['LON', 'NY', 'NY'], null],
]) {
  const h = hintFor(who.map(w => C[w]))
  // (no fixed answer: the region must be the one whose farthest player is nearest, worked out the long way)
  const worst = r => Math.max(...who.map(w => km([C[w].lat, C[w].lon], HINTS[r])))
  const best = Object.keys(HINTS).reduce((a, b) => (worst(b) < worst(a) ? b : a))
  ok(want ? h === want : h === best, `${who.join(' + ')}: ${h} (farthest player ${Math.round(worst(h))} km${want ? '' : `; the best there is: ${best}`})`)
}
ok(hintFor([{ lat: null, lon: null, cont: 'EU', cc: 'DE' }, { lat: null, lon: null, cont: 'EU', cc: 'FR' }]) === 'weur', 'no city on the lines: Europe by continent is weur')
ok(hintFor([{ lat: null, lon: null, cont: 'AS', cc: 'AE' }]) === 'me' && hintFor([{ lat: null, lon: null, cont: 'AS', cc: 'JP' }]) === 'apac', 'Asia by continent: the Gulf is me, Japan apac')
ok(hintFor([null, { lat: null, lon: null, cont: null, cc: null }]) === null && hintFor([]) === null, 'nothing known about anyone: no hint (made where it is first called)')
ok(hintFor([C.LA, null, C.SEA]) === 'wnam', 'one line unknown: the hint goes by the other two')
{
  const req = (cf, hdr) => ({ cf, headers: new Headers(hdr || {}) })
  const g = geoOf(req({ latitude: '34.05', longitude: '-118.24', continent: 'NA', country: 'US' }), false)
  ok(g.lat === 34.05 && g.lon === -118.24 && g.cont === 'NA' && g.cc === 'US', 'the worker reads its own cf (strings, as cf gives them)')
  ok(geoOf(req({ continent: 'NA' }, { 'x-bap-geo': JSON.stringify({ lat: 51.5, lon: 0, cont: 'EU' }) }), false).cont === 'NA', 'at the worker a header a device sends is never read')
  ok(geoOf(req(undefined, { 'x-bap-geo': JSON.stringify({ lat: 51.5, lon: 0, cont: 'EU', cc: 'GB' }) })).cont === 'EU', 'inside the queue: the worker\'s header')
  ok(geoOf(req(undefined, { 'x-bap-geo': '{"lat":999,"lon":"x","cont":"<b>"}' })).lat === null, 'a bad header comes to nothing')
}

console.log('\n── the King of the Hill queue makes the room near its three ──────────────────────────────────')
{
  const gets = [], inits = []
  let release
  const gate = new Promise(r => { release = r })
  const env = { BTLIVE_ROOM: { idFromName: n => `id:${n}`, get: (id, opts) => { gets.push({ id, opts }); return { fetch: async (u, o) => { inits.push(JSON.parse(o.body)); await gate; return { ok: true } } } } } }
  const q = new KothQueue(null, env)
  const ws = (geo) => { const w = { geo, got: [], send(d) { w.got.push(JSON.parse(d)) }, close() {} }; return w }
  const t = Date.now()
  const people = [['a', C.LON], ['b', C.PAR], ['c', C.WAR], ['d', C.NY]]
  const W = people.map(([vid, geo], i) => { const w = ws(geo); q.conns.set(w, { vid, uid: null, name: 'Guest', dev: `d${vid}`, key: null, ts: t + i }); q.picks.set(vid, { name: 'Stephen Curry', pos: 'guard' }); return w })
  const first = q.makeMatch()
  // a hello while the room's /init is still out: the three already going are in no second match
  const second = q.makeMatch()
  await new Promise(r => setTimeout(r, 10))
  ok(gets.length === 1 && inits.length === 1, `one room for the three, even with a second try while its /init was out (${gets.length})`)
  ok(gets[0]?.opts?.locationHint === 'weur', `London, Paris, Warsaw: made with locationHint ${gets[0]?.opts?.locationHint}`)
  ok(q.waiting().map(p => p.vid).join() === 'd', 'while it is out, the queue shows the one still waiting')
  release(); await first; await second
  ok(W.slice(0, 3).every(w => w.got.some(m => m.t === 'match')) && !W[3].got.some(m => m.t === 'match'), 'the three are sent to it; the fourth waits on')
  // a room that can't be made: they wait on (and are tried again)
  const bad = new KothQueue(null, { BTLIVE_ROOM: { idFromName: n => n, get: () => ({ fetch: async () => { throw new Error('down') } }) } })
  const B = people.slice(0, 3).map(([vid, geo], i) => { const w = ws(geo); bad.conns.set(w, { vid, uid: null, name: 'Guest', dev: `d${vid}`, key: null, ts: t + i }); bad.picks.set(vid, { name: 'Stephen Curry', pos: 'guard' }); return w })
  await bad.makeMatch()
  ok(bad.waiting().length === 3 && !B.some(w => w.got.some(m => m.t === 'match')) && bad.retry, 'a room that can\'t be made: nobody is sent anywhere, all three still waiting, a retry set')
  clearTimeout(bad.retry)
}

console.log(`\n${fails ? `${fails} FAILED` : 'all ok'}`)
process.exit(fails ? 1 : 0)
