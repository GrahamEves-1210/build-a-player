// NBA Franchise, headless: game day's scoring log (game.js eventsOf / logOf) against the box score it came from.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-pbp.mjs [games=40]
// Every point, assist, free throw and foul in the log is in the box (and the other way round), the clock runs down in
// each period, the log never reaches the save (F.pend's game, the packed league), and the GM's box finds its log.
import * as N from '../../src/lib/franchise2/nba/index'
import { eventsOf, logOf, startGame, playTo, finishGame } from '../../src/lib/franchise2/nba/game'
const GAMES = +(process.argv[2] ?? 40)
const bad = []
const flag = m => { bad.push(m); if (bad.length < 20) console.log('  !! ' + m) }
const F = N.createNbaFranchise({ seed: 'pbp-check', team: 'BOS', owner: 'Graham' })
const S = N.SHORTS
let n = 0, evs = 0, ots = 0
for (let g = 0; g < GAMES; g++) {
  const h = S[g % 30], a = S[(g * 7 + 3) % 30] === h ? S[(g + 1) % 30] : S[(g * 7 + 3) % 30]
  const G = startGame(F, h, a, { seed: `pbp-${g}` })
  playTo(G, 24)
  if (JSON.stringify(G).includes('"EV"')) flag('the log is in the saved game')
  const mid = logOf(G)
  if (!mid?.length) flag(`game ${g}: no log before the moment`)
  const res = finishGame(G)
  const L = eventsOf({ h, a, q: res.q })
  if (!L) { flag(`game ${g}: eventsOf found nothing`); continue }
  n++; evs += L.length; if (res.ot) ots++
  const pts = { [h]: 0, [a]: 0 }, man = {}
  const add = (i, k, v) => { (man[i] ??= { pts: 0, ast: 0, ftm: 0, fta: 0, pf: 0, fgm: 0, tpm: 0 })[k] += v }
  let last = null
  for (const e of L) {
    const s = e.k === 'h' ? h : a
    if (e.c == null) flag(`game ${g}: an event without a clock`)
    if (last && e.p === last.p && e.c > last.c + 0.01) flag(`game ${g}: the clock ran backwards in period ${e.p} (${last.c} then ${e.c})`)
    if (last && e.p < last.p) flag(`game ${g}: period went backwards`)
    last = e
    if (e.y === 'f') { add(e.w, 'pf', 1); continue }
    if (e.y === 'ft') { pts[s] += e.n; add(e.w, 'pts', e.n); add(e.w, 'ftm', e.n); add(e.w, 'fta', e.of); continue }
    const v = e.y === 'three' ? 3 : 2
    pts[s] += v; add(e.w, 'pts', v); add(e.w, 'fgm', 1); if (v === 3) add(e.w, 'tpm', 1)
    if (e.a != null) add(e.a, 'ast', 1)
    if (e.hs == null || e.as == null) flag(`game ${g}: an event without the score`)
  }
  if (pts[h] !== res.hs || pts[a] !== res.as) flag(`game ${g}: the log adds to ${pts[h]}-${pts[a]}, the final is ${res.hs}-${res.as}`)
  const fin = L[L.length - 1]
  if (fin.hs !== res.hs || fin.as !== res.as) { const sc = [...L].reverse().find(e => e.y !== 'f'); if (sc.hs !== res.hs || sc.as !== res.as) flag(`game ${g}: the last score ${sc.hs}-${sc.as} is not the final`) }
  for (const s of [h, a]) for (const l of res.box[s]) {
    const m = man[l.i] ?? { pts: 0, ast: 0, ftm: 0, fta: 0, pf: 0, fgm: 0, tpm: 0 }
    for (const k of ['pts', 'ast', 'ftm', 'fta', 'pf', 'fgm', 'tpm']) if (m[k] !== l[k]) flag(`game ${g}: ${s} man ${l.i} ${k} log ${m[k]} box ${l[k]}`)
  }
}
// the GM's own games: the box on F finds its log; the packed save has none of it
for (let k = 0; k < 6; k++) {
  const out = N.playNext(F, { moments: true })
  if (out?.pending) { if (!logOf(F.pend.G)?.length) flag('the moment game has no log so far'); const plan = N.momentPlan(F); N.momentSim(F, plan) }
  const b = F.box[F.log.at(-1).bx]
  if (!eventsOf(b)) flag(`the GM's game ${k + 1} has no log`)
}
const packed = N.packNba(F)
if (/"EV"|"pb":1/.test(packed)) flag('the log reached the save')
console.log(`${n} games, ${(evs / Math.max(1, n)).toFixed(0)} events a game, ${ots} in overtime, save ${(packed.length / 1024).toFixed(0)} KB`)
console.log(bad.length ? `${bad.length} problems` : 'no problems')
