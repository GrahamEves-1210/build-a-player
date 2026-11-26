// BLACKTOP LIVE online: how big the referee's snapshots are on the wire, old (v1) and new (v2), for each mode,
// over whole CPU games. Bundle and run from the repo root:
//   node_modules/.bin/esbuild scripts/btlive/snap-size.mjs --bundle --platform=node --format=esm --outfile=/tmp/ss.mjs \
//     --define:import.meta.env='{"DEV":false}' --loader:.json=json && node /tmp/ss.mjs
import { createGame, step, cpuInput, HZ } from '../../src/lib/btlive/index.js'
import * as P from '../../src/lib/btlive/proto.js'

const teamsFor = mode => mode === '1v1' ? [[{ id: 'a', pos: 'guard' }], [{ id: 'b', pos: 'guard' }]]
  : mode === '2v2' ? [[{ id: 'a', pos: 'guard' }, { id: 'c', pos: 'big' }], [{ id: 'b', pos: 'guard' }, { id: 'd', pos: 'big' }]]
  : [[{ id: 'a', pos: 'guard' }], [{ id: 'b', pos: 'guard' }], [{ id: 'c', pos: 'big' }]]
for (const mode of ['1v1', '2v2', 'koth']) {
  let v1 = 0, n1 = 0, v2 = 0, n2 = 0, max1 = 0, max2 = 0, ticks = 0
  for (let g = 0; g < 4; g++) {
    const s = createGame({ teams: teamsFor(mode), seed: `ss-${mode}-${g}`, mode })
    const log = []; let sq = 0
    const hist = new Map(), dev = new Map()            // the referee's rows by tick; the device's (snapIn)
    let bad = 0
    while (s.phase !== 'over' && s.tick < HZ * 600) {
      step(s, s.players.map((_, i) => cpuInput(s, i, 'pro')))
      for (const e of s.events) log.push({ ...e, sq: ++sq, k: s.tick })
      while (log.length && log[0].k < s.tick - P.EVENT_KEEP) log.shift()
      ticks++
      if (s.tick % 2 === 0) { const b = JSON.stringify(P.snapOf(s, log, [0, 0, 0, 0])).length; v1 += b; n1++; max1 = Math.max(max1, b) }
      // wire 2: the device has said it has the one 4 ticks back (its acks come back a round trip later), now and then
      // a whole one (a dropped ack)
      const cur = P.snapRows(s, sq); hist.set(s.tick, cur)
      const base = s.tick % 97 === 0 ? null : hist.get(s.tick - 4) ?? null
      const j = JSON.stringify(P.snapOf2(s, cur, base, log, [0, 0, 0, 0])); v2 += j.length; n2++; max2 = Math.max(max2, j.length)
      // ...and what the device makes of it is the whole snapshot, field for field
      const got = P.snapIn(JSON.parse(j), dev), want = P.snapOf(s, [], [0, 0, 0, 0])
      if (!got || JSON.stringify({ ...got, e: 0, st: 0, gn: 0 }) !== JSON.stringify({ ...want, e: 0, st: 0, gn: 0 })) { if (!bad++) console.log('MISMATCH', JSON.stringify(got).slice(0, 300), '\n', JSON.stringify(want).slice(0, 300)) }
      if (hist.size > 200) hist.delete(hist.keys().next().value)
    }
    if (bad) { console.log(`FAIL  ${mode}: ${bad} snapshots read back wrong`); process.exitCode = 1 }
  }
  const secs = ticks / HZ
  console.log(`${mode}: v1 ${Math.round(v1 / n1)} B avg (max ${max1}), ${Math.round(v1 / secs)} B/s at ${HZ / 2} Hz` + `   v2 ${Math.round(v2 / n2)} B avg (max ${max2}), ${Math.round(v2 / secs)} B/s at ${HZ} Hz`)
}
