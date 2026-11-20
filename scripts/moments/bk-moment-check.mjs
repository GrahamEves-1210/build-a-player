// Basketball Career's playoff moments: do the numbers agree? (a player, 2026-11-20: "in key moments sometimes the
// scores are wrong"). Thousands of moments are planned (lib/inGame.js planMoment), the drill itself is played by a
// simulated human through the same rules the browser runs (src/lib/mg, scripts/mg/bots, the host's scoreboard as
// MgStage keeps it), and the result goes through momentFacts and playMoment the way playoffRound sends it. Four numbers
// are put side by side:
//   1. the score going in (the plan's, the line above the game, the drill's board before a ball is played)
//   2. the drill's own scoreboard when it's over (each make, each bucket given up, as it went in)
//   3. the score right after the play, the one the rest of the game is played from (playMoment's got / gave)
//   4. the final
// They have to agree: the play's points are the points the drill's board showed, nobody's score goes down, a last
// shot is the last shot (nothing scored after it in regulation: a miss from behind is a loss), a game level at the end
// goes to overtime and says so. The Simple games (a report of makes only) are checked against their makes too.
// Run from the repo root:  node scripts/moments/bk-moment-check.mjs [moments-per-game]
import { planMoment, playMoment } from '../../src/lib/inGame.js'
import { momentFacts } from '../../src/lib/situations.js'
import { seeded } from '../../src/lib/rng.js'
import { GAMES } from '../../src/lib/minigames.js'
import { ENGINES } from '../../src/lib/mg/index.js'
import * as K from '../../src/lib/mg/kit.js'
import { loadBot, HUMANS } from '../mg/balance.mjs'

const POOLS = {
  guard: ['iso', 'pnr', 'clutch-shot', 'free-throws', 'lockdown', 'fast-break', 'half-court', 'board'],
  big: ['post-up', 'board', 'rim-protect', 'free-throws', 'clutch-shot', 'alley-oop', 'iso', 'pnr'],
}
const { STEP } = K, boardTick = K.boardTick ?? (() => {})   // (a build before the host kept the board: nothing)
const N = Number(process.argv[2] ?? 120)
const HUMAN = Object.values(HUMANS)
const BOTS = {}
for (const g of new Set(Object.values(POOLS).flat())) BOTS[g] = await loadBot(ENGINES[g].botName)
// the drill, played: its report and its board at the end (the host's: MgStage applies the board as it comes due)
function drill(game, sit, seed, j) {
  const engine = ENGINES[game]
  const def = sit.reps ? { ...GAMES[game], rounds: sit.reps } : GAMES[game]
  const g = engine.make({ v: [2, 5, 8, 11][j % 4], seed, def, game, sport: 'bucket', pos: null, cast: null, situation: sit })
  g.sit ??= sit
  const step = BOTS[game](g, HUMAN[j % HUMAN.length], seeded(`bot-${seed}`), game)
  let frames = 0
  while (!g.done && frames++ < 90 * 120) { const ins = step(); if (ins) for (const a of ins) g.input(a); g.tick(STEP); boardTick(g) }
  if (!g.done) return null
  // the outro plays out (the last bucket lands in it)
  const end = g.t + (g.outro ?? 2000)
  while (g.t < end) { g.tick(STEP); boardTick(g) }
  const raw = g.done.raw
  return { raw, hit: g.done.hit || (!!raw && raw.of > 0 && raw.made === raw.of), u: g.sit.mine - sit.mine, t: g.sit.opp - sit.opp }
}
// a Simple game's report (lib/minigamesSimple, MiniGameSimple.jsx): the makes and how many, nothing else
function simple(game, sit, r) {
  const n = game === 'pnr' || game === 'rim-protect' ? sit.reps ?? 4 : game === 'free-throws' ? 2 : game === 'clutch-shot' || game === 'half-court' ? 1 : 3
  let made = 0
  for (let i = 0; i < n; i++) if (r() < 0.65) made++
  const need = n === 1 ? 1 : n === 2 ? 2 : n - 1
  const hit = made >= need
  const raw = game === 'half-court' ? { made, of: 1, pts: 2 } : { made, of: n }
  const u = game === 'pnr' ? made * 2 : game === 'free-throws' ? made : game === 'iso' || game === 'post-up' || game === 'half-court' ? (hit ? 2 : 0) : game === 'alley-oop' || game === 'fast-break' ? made * 2 : null
  const t = game === 'rim-protect' ? (n - made) * 2 : game === 'lockdown' ? (hit ? 0 : 2) : 0
  return { raw, hit, u, t }
}
const LAST = new Set(['clutch-shot'])
const bad = {}, seen = {}
const flag = (k, s) => { (bad[k] ??= []).push(s) }
let n = 0, ot = 0, played = 0
const t0 = Date.now()
for (const [pos, pool] of Object.entries(POOLS)) for (const only of pool) for (let j = 0; j < N; j++) {
  const p = 0.3 + (j % 9) * 0.05
  const ctx = { sport: 'hoops', seed: `bk-${pos}-${only}-${j}`, pGame: p, pool: j % 5 ? pool : [only], used: [], hOf: () => 0.68, us: 'BOS', them: 'NYK' }
  const plan = planMoment(ctx), sit = plan.sit, game = plan.game, b = plan.b
  if (seen[`${pos}-${game}`] >= N) continue
  seen[`${pos}-${game}`] = (seen[`${pos}-${game}`] ?? 0) + 1
  n++
  const id = `${ctx.seed} ${game} k${b.k} ${sit.mine}-${sit.opp} ${sit.clockText}`
  // 1. the score going in: the line says it, the board starts at it
  if (sit.mine !== plan.mine || sit.opp !== plan.opp) flag('going in: the situation and the plan disagree', id)
  const nums = sit.line.match(/(\d+)-(\d+)|tied at (\d+)/)
  if (!nums) flag('going in: no score in the line', `${id} :: ${sit.line}`)
  else if (nums[3] ? !(+nums[3] === sit.mine && sit.mine === sit.opp) : `${nums[1]}-${nums[2]}` !== `${sit.mine}-${sit.opp}`) flag('going in: the line shows another score', `${id} :: ${sit.line}`)
  if (b.k < 2 && /One shot left/.test(sit.tail)) flag('going in: "one shot left" with minutes to play', `${id} :: ${sit.line} ${sit.tail}`)
  const isSimple = j % 3 === 2
  const D = isSimple ? simple(game, sit, seeded(`${ctx.seed}-simple`)) : drill(game, sit, ctx.seed, j)
  if (!D) { flag('the drill never finished', id); continue }
  played++
  const F = momentFacts(game, D.raw, D.hit)
  const res = playMoment(plan, D.hit, F, D.raw)
  const how = isSimple ? 'simple' : 'drill'
  // 2-3. the play's points are the ones the drill showed
  if (D.u != null && res.got !== D.u) flag(`the play: his points are not the ones the ${how} showed`, `${id} :: ${how} ${D.u}, after the play ${res.got}`)
  if (game !== 'board' && D.t != null && res.gave !== D.t) flag(`the play: their points are not the ones the ${how} showed`, `${id} :: ${how} ${D.t}, after the play ${res.gave}`)
  const aU = plan.mine + res.got, aT = plan.opp + res.gave
  // 4. the final grows out of it
  if (res.mine < aU || res.opp < aT) flag('the final: lower than the score after the play', `${id} :: after ${aU}-${aT}, final ${res.mine}-${res.opp}`)
  if (res.mine === res.opp) flag('the final: a tie', id)
  if (res.won !== res.mine > res.opp) flag('the final: won and the score disagree', id)
  const isOT = /overtime/.test(res.note ?? '')
  if (isOT) ot++
  if (LAST.has(game) && b.k === 2 && !isOT && (res.mine !== aU || res.opp !== aT)) flag('a last shot: points scored after it', `${id} :: after ${aU}-${aT}, final ${res.mine}-${res.opp}`)
  if (LAST.has(game) && b.k === 2 && aU < aT && res.won) flag('a last shot: missed from behind and won', `${id} :: after ${aU}-${aT}, final ${res.mine}-${res.opp}`)
  if (LAST.has(game) && b.k === 2 && aU === aT && !isOT) flag('a last shot: level after it, no overtime', id)
  if (LAST.has(game) && b.k === 2 && isOT && aU !== aT) flag('overtime after a last shot that wasn\'t level', id)
  // the note's last score is on the board
  if (res.note && /at the buzzer|at the line/.test(res.note)) {
    const side = res.note.startsWith('BOS') ? 'u' : 't'
    if (side === 'u' ? res.mine === aU : res.opp === aT) flag('the note: a last score that isn\'t on the board', `${id} :: ${res.note} ${aU}-${aT} -> ${res.mine}-${res.opp}`)
  }
}
console.log(`${n} moments, ${played} played (${Object.entries(seen).map(([g, x]) => `${g} ${x}`).join(', ')}), ${ot} to overtime · ${((Date.now() - t0) / 1000).toFixed(1)}s`)
const keys = Object.keys(bad)
for (const k of keys) { console.log(`\n${k}: ${bad[k].length}`); for (const s of bad[k].slice(0, 6)) console.log(`  ${s}`) }
console.log(keys.length ? `\n${keys.length} kinds of disagreement` : '\nevery number agrees')
process.exit(keys.length ? 1 : 0)
