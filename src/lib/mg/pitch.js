// STRIKE HIM OUT, ESCAPE THE JAM and the pitcher's showcase (FASTBALL VELOCITY, BREAKING BALL SPIN, the BULLPEN
// session): from the broadcast's camera out behind the mound, the pitcher's back to us, the hitter, the catcher and the
// umpire beyond him, the pitch tracker in the corner.
//   the pitch   his real arsenal: FASTBALL, SLIDER, CHANGEUP (tap one; E on a computer cycles them). The catcher
//               puts down his sign first: shake him off if you want something else.
//   location    the stick (the arrows) moves the catcher's glove: in the zone, on the edges, or off the plate to
//               get him to chase. Command decides how close it ends up.
//   delivery    hold PITCH (SPACE) and he goes into his motion while the meter climbs: let go to set the effort.
//               Past the red line is max effort: more velocity, less command. Then tap PITCH again as the ring
//               closes on his release point for a perfect release: a crisper break and a tighter miss.
// The hitter's real tendencies: his eye (he lays off the chase), his contact and his power, his hot and cold zones in
// the tracker, the pitch he can't lay off. The count changes his approach: ahead he'll expand, behind he's sitting
// on the fastball. Change speeds and eye levels and he's off balance; the same pitch in the same spot and he's on it.
//   strike-out   a runner on third, less than two out, a close game late: strike him out (a pop-up that keeps the
//                runner at third does it too)
//   escape-jam   bases loaded, one out: a strikeout and get the next man, or a ground ball for two
//   pitch-velo   the showcase's gun: five fastballs, the best reading counts
//   spin         five breaking balls on the TrackMan: snap it off at the release, the best spin rate counts
//   bullpen      the command test: eight pitches, the catcher sets up on a spot each time; hit his glove
import { clamp, lerp, prog, outcome, rngOf, easeOut, nudge, manOf, lightMode, text, DISPLAY, LABEL, rr, GOOD, BAD, GOLD } from './kit.js'
import { placeStamp } from './read.js'
import { momentSituation } from '../situations.js'
import { bbTarget } from './combineNorms.js'
import { INK } from './rig.js'
import {
  camOf, P, staticPark, baller, ballB, uniforms, dressB, BP, mixB, runB, swingPose, pitchPose, flipB, STANCE,
  arsenalOf, PITCH_INFO, PITCH_KEYS, flightMs, pitchPath, inZone, locate, batterProfile, batterAI, inPlay, runsOn, FT,
  scorebug, tracker, radar, crowdRise, flashesB, celebMsB, skipOutroB, radarScout,
  padCtl, padInput, padStick, drawPads, padLayout, PLATE_Z, ZONE, RUBBER, MOUND_H, REL_Z, gauss,
  hudB, promptB,
} from './baseball.js'

export const how = {
  'strike-out': 'A runner on third, and he needs a strikeout. Pick the pitch (the catcher puts down his sign), move his glove with the stick, then hold PITCH and let go to set the effort. Tap PITCH again on the release for a perfect one. Change speeds, change eye levels, and work his cold zones.',
  'escape-jam': 'Bases loaded, one out. Get a strikeout and then the next man, or keep the ball down and get a ground ball for two. Pick the pitch, move the glove, hold PITCH to set the effort and tap it again on the release. Walk him and the run is in.',
  'pitch-velo': 'The scouts have their guns up. Five fastballs: hold PITCH and let go at the top of the meter for max effort, then tap PITCH as the ring closes on the release. The best reading counts.',
  spin: 'Sliders on the TrackMan. Hold PITCH to set the effort, then snap it off: tap PITCH right as the ring closes on the release. Five of them; the scouts write down the average spin.',
  bullpen: 'The command test. The catcher sets up on a different spot every pitch: move the target on to his glove with the stick, hold PITCH to set the effort, tap it again on the release. Eight pitches; hit his glove.',
}

const FILL = 640, WINDUP = 300, SET_MS = 1000, CALL_MS = 1100, CLOCK_MS = 12000
const SPEED_AIM = 1.6
const hashOf = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h }
const DRILLS = new Set(['pitch-velo', 'spin', 'bullpen'])
// the bullpen's targets: the corners and the edges, where a starter lives
const SPOTS = [{ x: -0.17, y: 0.6 }, { x: 0.17, y: 0.6 }, { x: -0.17, y: 0.96 }, { x: 0.17, y: 0.96 }, { x: 0, y: 0.56 }, { x: -0.19, y: 0.78 }, { x: 0.19, y: 0.78 }, { x: 0, y: 1.0 }]

// The meter: soccer's shooting model on a mound. Hold and it climbs; let go to set the effort; the arm comes through
// and a tap on the release point inside the window is perfect. v: command and composure (the window), pressure 0-1
function meterOf(v, o = {}) {
  const tv = clamp((v - 1) / 10, 0, 1)
  const k = {
    phase: 'idle', at: 0, power: 0, relAt: 0, strikeAt: 0, tapAt: null, timed: 'none', fill: o.fill ?? FILL, windup: o.windup ?? WINDUP,
    green: lerp(26, 54, tv) * (1 - 0.3 * (o.pressure ?? 0) * (1 - tv)), max: 0.88,
    press(t) { if (k.phase !== 'idle') return false; k.phase = 'power'; k.at = t; k.power = 0; return true },
    powerAt(t) { return k.phase === 'power' ? clamp((t - k.at) / k.fill, 0, 1) : k.power },
    release(t) { if (k.phase !== 'power') return false; k.power = clamp((t - k.at) / k.fill, 0, 1); k.phase = 'deliver'; k.relAt = t; k.strikeAt = t + k.windup; return true },
    tap(t) { if (k.phase !== 'deliver' || k.tapAt != null) return false; k.tapAt = t; const e = Math.abs(t - k.strikeAt); k.timed = e <= k.green ? 'green' : e <= k.green * 2.6 ? 'ok' : 'red'; return true },
    tick(t) {
      if (k.phase === 'power' && t - k.at >= k.fill + 150) { k.power = 1; k.phase = 'deliver'; k.relAt = t; k.strikeAt = t + k.windup * 0.6 }
      if (k.phase === 'deliver' && t >= k.strikeAt + Math.max(70, k.green * 2.6)) { k.phase = 'out'; return true }
      return false
    },
    reset() { k.phase = 'idle'; k.power = 0; k.tapAt = null; k.timed = 'none' },
  }
  return k
}

export function make({ v, seed, cast = null, situation = null, game = 'strike-out', pos = null }) {
  const r = rngOf(seed), drill = DRILLS.has(game), jam = game === 'escape-jam'
  const sit = drill ? null : situation && (situation.baseball || situation.on) ? situation : momentSituation(game, seed, { us: situation?.us ?? 'HOME', them: situation?.them ?? 'AWAY' })
  const me = cast?.me ?? manOf(cast, 'us', 'pit', 0)
  const throws = me?.throws ?? (hashOf(seed) % 4 === 0 ? 'L' : 'R')
  // his own arsenal: the build's grades (the game's grade stands in for each), the real one's when the cast has it
  const A = arsenalOf(me?.attrs ?? null, v, throws)
  const tv = clamp((v - 1) / 10, 0, 1)
  // the hitters: the real ones from the other side's lineup, their tendencies from their grades
  const batters = [0, 1].map(i => {
    const m = manOf(cast, 'them', 'bat', i) ?? null, raw = cast?.them?.bat?.[i] ?? null
    const bats0 = raw?.bats ?? (hashOf(`${seed}-${i}`) % 3 === 0 ? 'L' : 'R'), bats = bats0 === 'S' ? (throws === 'L' ? 'R' : 'L') : bats0
    const grade = sit ? (jam ? 6.6 : 7) : 6
    return { man: m, prof: batterProfile(raw?.attrs ?? null, grade + (r() - 0.5) * 2, bats, `${seed}-${i}-${m?.name ?? ''}`) }
  })
  const bases = sit ? { on: [...sit.on], outs: sit.outs } : { on: [false, false, false], outs: 0 }
  const pressure = sit ? (sit.inning >= 9 ? 0.75 : 0.5) * (jam ? 1.1 : 1) : 0.15
  const g = {
    t: 0, game, zones: 'none', stick: true, pads: null, fx: [], done: null, outro: 2400, stamp: null,
    // (the game's own copy of the situation: its score changes when they score, the career's doesn't)
    sit: sit ? { ...sit } : null, A, tv, drill, jam, bases, throws, pressure, plays: [],
    batters, bi: 0, count: { b: 0, s: 0 }, n: 0, pitches: [], last: null, outs: bases.outs, runs: 0, ks: 0,
    phase: 'set', at: 0, setMs: SET_MS + 700, type: 'FB', sign: 'FB', aim: { x: 0, y: 0.78 }, k: meterOf(v, { pressure }),
    pitch: null, relAt: null, arrive: null, ai: null, call: null, callAt: null, hitAt: null, play: null, res: null, doneAt: null, endAt: null,
    // the showcase: the reps and their readings
    reps: game === 'bullpen' ? 8 : drill ? 5 : 0, rep: 0, reads: [], made: 0, target: null,
    ctl: padCtl(), vh: 640, nudge: nudge(),
    who: { me, c: manOf(cast, 'us', 'bat', 1) ?? null },
    hud: hudB(drill ? (game === 'bullpen' ? 'PUT THE TARGET ON HIS GLOVE' : 'HOLD PITCH · LET GO AT THE TOP') : 'PICK A PITCH · SET THE GLOVE'),
    tick(dt) {
      g.t += dt
      const o = padStick(g.ctl)
      if (g.phase === 'set' || (g.phase === 'deliver' && k.phase === 'power')) { g.aim.x = clamp(g.aim.x + o.x * SPEED_AIM * dt / 1000, -0.55, 0.55); g.aim.y = clamp(g.aim.y + o.y * SPEED_AIM * dt / 1000, 0.2, 1.4) }
      // the pitch clock: twelve seconds to start his motion, or it's an automatic ball
      if (!g.drill && g.phase === 'set' && !g.res && g.t - g.at >= CLOCK_MS) clockBall()
      if (k.tick(g.t) && !g.pitch) release()
      if (g.phase === 'flight' && g.t >= g.arrive) arrive()
      if (g.phase === 'call' && !g.res && g.t - g.callAt >= CALL_MS) next()
      if (g.res && !g.done && g.t >= g.endAt) finish()
    },
    input(a) {
      if (skipOutroB(g, a)) return
      // the pitch chips over the pads: a tap on one picks it (before the delivery)
      if (a.kind === 'down' && g.phase === 'set' && !g.drill) { const i = chipAt(g, a.x, a.y); if (i >= 0) { g.type = PITCH_KEYS[i]; g.fx.push('tap'); return } }
      padInput(g.ctl, a, g.vh, { down: id => (id === 'P' ? cycle() : sDown()), up: id => { if (id === 'S') sUp() } })
    },
  }
  const k = g.k
  // (the bullpen: the first target)
  if (game === 'bullpen') g.target = SPOTS[Math.floor(r() * SPOTS.length)]
  if (drill) { g.type = game === 'spin' ? 'SL' : 'FB' }
  else sign()
  // the catcher's sign: ahead, the breaking ball; behind, the fastball; with two strikes, what this hitter chases
  function sign() {
    const B = g.batters[g.bi].prof, { b, s } = g.count
    let t = b > s ? 'FB' : s === 2 ? (B.chases ?? (r() < 0.5 ? 'SL' : 'CH')) : s > b ? (r() < 0.6 ? 'SL' : 'CH') : r() < 0.55 ? 'FB' : r() < 0.6 ? 'SL' : 'CH'
    if (g.last && g.last.type === t && r() < 0.5) t = t === 'FB' ? 'SL' : 'FB'
    g.sign = t; g.type = t
  }
  function cycle() { if (g.phase !== 'set' || g.drill) return; g.type = PITCH_KEYS[(PITCH_KEYS.indexOf(g.type) + 1) % 3]; g.fx.push('tap') }
  function sDown() {
    if (k.phase === 'deliver') { if (k.tap(g.t)) g.fx.push('h:light'); return }
    if (g.phase !== 'set' || g.t - g.at < 250 || g.done || g.res) return
    if (k.press(g.t)) { g.phase = 'deliver'; g.delAt = g.t; g.hud.prompt = null; g.fx.push('h:light') }
  }
  function sUp() { if (k.phase === 'power') k.release(g.t) }
  // the ball's out of his hand: the effort and the release decide the speed, the break and the miss
  function release() {
    const P0 = A[g.type], p = k.power, max = p > k.max
    const timed = k.timed, tk = timed === 'green' ? 0.55 : timed === 'ok' ? 0.85 : timed === 'red' ? 1.6 : 1.15
    const sd = lerp(0.14, 0.046, A.command) * (1 + Math.max(0, p - k.max) * 5) * (1 + (1 - p) * 0.25) * tk * (1 + g.pressure * (1 - A.composure) * 0.6) * (g.type === 'FB' ? 1 : 1.12)
    const wild = r() < lerp(0.11, 0.012, A.control) * (timed === 'red' ? 1.8 : 1)
    const to = locate(g.aim, sd * (wild ? 2.6 : 1), r)
    const mph = P0.mph - (1 - p) * 9 + (max ? (p - k.max) * 6 : 0) + (timed === 'green' ? 1 : timed === 'ok' ? 0.2 : timed === 'red' ? -1.5 : -0.8) + gauss(r) * 0.7
    const brk = (0.82 + 0.18 * p) * (timed === 'green' ? 1.1 : timed === 'red' ? 0.85 : 1)
    const rel = { x: -0.42 * A.hand, y: 1.8, z: REL_Z }
    g.pitch = { type: g.type, mph, rel, to, M: { x: P0.M.x * brk, y: P0.M.y * brk }, A: P0.A, q: clamp(P0.q * brk + (mph - P0.mph) * 0.02, 0, 1), gb: A.gb, perfect: timed === 'green', timed, wild, aim: { ...g.aim } }
    g.pitch.T = flightMs(g.pitch)
    g.phase = 'flight'; g.relAt = g.t; g.arrive = g.t + g.pitch.T
    // (the hitter reads it out of the hand: his call's made now, and shows as it gets there)
    if (!g.drill) g.ai = batterAI(g.batters[g.bi].prof, g.pitch, g.count, g.last, r)
    g.fx.push('swoosh')
  }
  // in: the hitter's call, or the gun's, or the target's
  function arrive() {
    const p = g.pitch
    g.n++
    g.pitches.push({ to: p.to, type: p.type, n: g.n, mph: p.mph })
    g.callAt = g.t; g.phase = 'call'
    if (g.drill) return drillRep(p)
    const ai = g.ai
    g.last = { ...p }
    if (ai.kind === 'play') {
      // (the jam: the infield at double-play depth)
      const res = inPlay(ai.bb, r, { on: g.bases.on, outs: g.outs, dp: jam ? 0.8 : 0.62 })
      g.play = res; g.hitAt = g.t; g.phase = 'call'
      g.fx.push('lock', 'h:medium')
      return resolvePlay(res)
    }
    if (ai.kind === 'ball') { g.count.b++; g.fx.push('catchball'); if (g.count.b >= 4) return walk(); g.call = { word: 'BALL', good: false } }
    else if (ai.kind === 'strike' || ai.kind === 'whiff') {
      g.count.s++; g.fx.push('catchball')
      if (g.count.s >= 3) return strikeout(ai.kind === 'strike')
      g.call = { word: ai.kind === 'strike' ? 'CALLED STRIKE' : 'SWING AND A MISS', good: true }
    } else if (ai.kind === 'foul') { if (g.count.s < 2) g.count.s++; g.fx.push('lock'); g.hitAt = g.t; g.call = { word: 'FOUL', good: null } }
  }
  function strikeout(looking) {
    g.ks++; g.outs++
    g.plays.push(looking ? 'Caught him looking' : 'Struck him out swinging')
    g.call = { word: looking ? 'STRIKE THREE' : 'STRUCK HIM OUT', good: true, k: true, looking }
    g.kAt = g.t
    g.fx.push('stamp', 'h:heavy')
    // two out now: the jam's next hitter (or it's over)
    if (g.outs >= 3 || !jam) return end({ kind: 'K', looking, runs: 0, out: true, word: looking ? 'CAUGHT LOOKING' : 'STRIKEOUT' })
  }
  function walk() {
    const runs = runsOn('BB', g.bases)
    g.plays.push(runs ? 'Ball four, and the run is forced in' : 'Ball four')
    g.call = { word: 'BALL FOUR', good: false }
    return end({ kind: 'BB', runs, out: false, word: runs ? 'WALKED IN A RUN' : 'WALK' })
  }
  function resolvePlay(res) {
    const runs = res.runs, outs = res.outs
    g.outs += outs
    g.plays.push(res.call)
    g.call = { word: res.word, good: res.out && !runs }
    // a run in (a hit, a sac fly, a ground ball with the infield back) ends it: the run's what mattered
    if (runs > 0 || !res.out) return end({ kind: res.kind, runs, out: res.out, word: res.word, call: res.call })
    if (g.outs >= 3 || !jam) return end({ kind: res.kind, runs: 0, out: true, word: res.kind === 'DP' ? 'DOUBLE PLAY' : res.word, call: res.call })
    // the jam, two out now: one more
  }
  function end(res) { g.res = res; g.endAt = g.t + (res.kind === 'K' ? 500 : 900) }
  function clockBall() {
    g.count.b++; g.callAt = g.t; g.phase = 'call'; g.fx.push('deny')
    if (g.count.b >= 4) return walk()
    g.call = { word: 'PITCH CLOCK: BALL', good: false }
  }
  function next() {
    if (g.res) return
    if (g.drill) { g.rep++; if (g.rep >= g.reps) return finishDrill() }
    else if (g.call?.k || (g.play && g.play.out)) { g.bi = Math.min(g.batters.length - 1, g.bi + 1); g.count = { b: 0, s: 0 }; g.last = null; g.pitches = [] }
    g.phase = 'set'; g.at = g.t; g.setMs = 500; g.pitch = null; g.ai = null; g.call = null; g.hitAt = null; g.play = null
    k.reset()
    if (game === 'bullpen') g.target = SPOTS[Math.floor(r() * SPOTS.length)]
    if (!g.drill) sign()
  }
  // ── the showcase ──
  function drillRep(p) {
    if (game === 'pitch-velo') {
      const mph = Math.round(p.mph * 10) / 10
      g.reads.push(mph); g.call = { word: `${Math.round(mph)} MPH`, good: mph >= target() - 0.5, gun: true }
    } else if (game === 'spin') {
      // the snap at the release is the spin: a perfect one is his best, a late one rolls it
      const base = bbTarget('spin', pos === 'bat' ? 'bat' : 'pit', v) * (tv <= 0.4 ? lerp(1.026, 1.014, tv / 0.4) : lerp(1.014, 1.0105, (tv - 0.4) / 0.6))
      const tk = k.timed === 'green' ? 1.012 : k.timed === 'ok' ? 0.975 : k.timed === 'red' ? 0.9 : 0.94
      const rpm = Math.round((base * tk * (0.95 + 0.05 * k.power) + gauss(r) * 25) / 10) * 10
      g.reads.push(rpm); g.call = { word: `${rpm.toLocaleString('en-US')} RPM`, good: rpm >= target(), gun: true }
    } else {
      const T = g.target, d = Math.hypot(p.to.x - T.x, (p.to.y - T.y) * 0.9), R0 = lerp(0.088, 0.072, tv), hit = d <= R0, close = !hit && d <= R0 * 1.6
      // (on the glove a point; just off it, the catcher barely moves, half of one)
      if (hit) g.made++
      g.pts = (g.pts ?? 0) + (hit ? 1 : close ? 0.5 : 0)
      g.reads.push(Math.round(d / 0.0254))
      g.call = { word: hit ? 'ON THE GLOVE' : close ? 'JUST OFF IT' : `${Math.round(d / 0.0254)} IN OFF`, good: hit }
    }
    g.fx.push(g.call.good ? 'catchball' : 'tap')
  }
  const target = () => (game === 'pitch-velo' ? bbTarget('penVelo', pos === 'bat' ? 'bat' : 'pit', v) + (A.FB.mph - arsenalOf(null, v, throws).FB.mph) - 0.18 * Math.max(0, 1 - Math.abs(v - 8) / 2.5) : game === 'spin' ? bbTarget('spin', pos === 'bat' ? 'bat' : 'pit', v) : bbTarget('command', pos === 'bat' ? 'bat' : 'pit', v))
  g.targetFor = target
  function finishDrill() {
    let score, hit, note, raw
    if (game === 'bullpen') {
      const need = target(), pts = g.pts ?? g.made
      hit = pts >= need; score = clamp(0.5 + (pts - need) / 6, 0, 1)
      note = `${g.made} of ${g.reps} on the glove`; raw = { made: g.made, pts, of: g.reps, miss: Math.round(g.reads.reduce((s, x) => s + x, 0) / g.reads.length) }
    } else {
      // the gun: his best one. The TrackMan: the scouts write down his average spin
      const best = game === 'spin' ? Math.round(g.reads.reduce((s2, x) => s2 + x, 0) / g.reads.length / 10) * 10 : Math.max(...g.reads), need = target()
      hit = game === 'spin' ? best >= need : best >= need - 0.2
      score = clamp(0.5 + (best - need) / (game === 'spin' ? 400 : 6), 0, 1)
      note = game === 'spin' ? `${best.toLocaleString('en-US')} rpm average, ${Math.max(...g.reads).toLocaleString('en-US')} best` : `${Math.round(best)} mph best`
      raw = game === 'spin' ? { rpm: best, max: Math.max(...g.reads), of: g.reps, reads: g.reads } : { mph: Math.round(best), best, of: g.reps, reads: g.reads }
    }
    g.done = outcome(score, hit, note, raw); g.doneAt = g.t; g.outro = 1900
    g.stamp = { text: hit ? (game === 'bullpen' ? 'PINPOINT' : game === 'spin' ? 'ELITE SPIN' : 'LIGHTS UP THE GUN') : 'BELOW THE MARK', good: hit, at: g.t, size: 38 }
    g.fx.push(hit ? 'h:success' : 'h:heavy')
  }
  function finish() {
    const R = g.res, K = R.kind === 'K'
    let hit, score
    if (jam) { hit = R.out && !R.runs && g.outs >= 3; score = hit ? clamp(0.62 + g.ks * 0.14 + (R.kind === 'DP' ? 0.2 : 0), 0, 1) : clamp(0.1 + g.ks * 0.08, 0, 0.4) }
    else { hit = R.out && !R.runs; score = hit ? (K ? clamp(0.85 + (R.looking ? 0.1 : 0.05), 0, 1) : 0.58) : R.kind === 'BB' ? 0.25 : 0.1 }
    const word = jam ? (hit ? (R.kind === 'DP' ? 'DOUBLE PLAY' : 'ESCAPED') : R.word) : hit ? (K ? R.word : `${R.word}`) : R.word
    // the inning, play by play: what the runners did is in each line
    const note = g.plays.join(' · ') + (hit && !jam && !K && g.bases.on[2] ? ' · the runner holds at third' : '')
    if (g.sit && R.runs) g.sit.opp += R.runs
    g.done = outcome(score, hit, note || null, { result: R.kind, runs: R.runs, pts: R.runs, ks: g.ks, pitches: g.n, outs: g.outs - g.bases.outs, final: g.sit ? { mine: g.sit.mine, opp: g.sit.opp } : null })
    g.doneAt = g.t
    g.outro = hit ? celebMsB() : 2200
    g.stamp = { text: word, good: hit, at: g.t, size: word.length > 11 ? 36 : 46 }
    // the home crowd: up for the strikeout when it's their man on the mound (they bat in the top)
    g.popAt = hit && sit?.half === 'T' ? g.t : !hit && sit?.half === 'B' ? g.t : null
    g.fx.push(hit ? 'h:success' : 'h:heavy')
  }
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
// The broadcast's camera out past the mound, a long lens: the pitcher's back to us on one side, the plate over his
// shoulder, the hitter, the catcher, the umpire, the crowd behind the plate. (Offset to the side away from the hitter.)
const camFor = (view, hand) => camOf(view, { x: hand > 0 ? -0.62 : 0.62, y: 2.7, z: 27.5, yaw: Math.PI, pitch: 0.035, F: 1320, cy: 0.33 })
// the chips: the arsenal over the pads
const CHIP_W = 74, CHIP_H = 30
function chipRow(g, vh) { const y = vh - 176, x0 = 180 - (CHIP_W * 3 + 12) / 2; return PITCH_KEYS.map((key, i) => ({ key, x: x0 + i * (CHIP_W + 6), y })) }
function chipAt(g, x, y) { const row = chipRow(g, g.vh); return row.findIndex(c => x >= c.x && x <= c.x + CHIP_W && y >= c.y && y <= c.y + CHIP_H) }
function pitcherAt(g) {
  const t = g.t, k = g.k, hand = g.A.hand
  let f = 0, slide = g.bases.on.some(Boolean)
  if (g.phase === 'deliver') f = k.phase === 'power' ? 0.55 * clamp((t - k.at) / k.fill, 0, 1) : lerp(0.55 * clamp(k.power, 0.6, 1), 0.68, clamp((t - k.relAt) / Math.max(1, k.strikeAt - k.relAt), 0, 1))
  else if (g.relAt != null && g.phase !== 'set') f = lerp(0.68, 1, prog(t - g.relAt, 0, 560))
  let pose = g.phase === 'set' ? BP.set : pitchPose(f, hand, { slide })
  let turn = 0, lift = 0
  // between pitches: back on the rubber, a look in for the sign
  if (g.phase === 'set') pose = mixB(pitchPose(1, hand), BP.set, prog(t - g.at, 0, 420))
  const R = g.res
  if (R && g.done) {
    const a = t - g.doneAt, won = g.done.hit
    if (won) {
      // the strikeout: he spins round off the mound with a fist pump and a yell, a little hop
      turn = easeOut(prog(a, 80, 420))
      lift = a > 420 && a < 760 ? Math.sin(prog(a, 420, 760) * Math.PI) * 0.18 : 0
      pose = a < 420 ? mixB(pose, BP.stand, prog(a, 0, 300)) : a < 1500 ? { ...BP.fist, hry: -100 - Math.abs(Math.sin((a - 420) / 150)) * 18 } : mixB(BP.fist, R.kind === 'DP' ? { ...BP.point, fr: 1 } : BP.clap, prog(a, 1500, 1800))
    } else {
      // beaten: he watches it go, then hands on hips, the head down. No celebration
      pose = a < 900 ? mixB(pose, BP.stare, prog(a, 0, 400)) : mixB(BP.stare, BP.hipsDown, prog(a, 900, 1400))
    }
  }
  return { x: 0, z: RUBBER + 0.25, pose, turn, lift }
}
function batterAt(g, B) {
  const hand = B.hand, X = -0.92 * hand, Z = 0.25, t = g.t
  // from out here we see him from the front: the stance mirrored
  let f = 0
  if (g.phase === 'deliver') f = 0.2 * prog(t - g.delAt, 200, 700)
  if (g.phase === 'flight') f = lerp(0.2, 0.38, prog(t - g.relAt, 0, 300))
  const ai = g.ai
  // he's made his call out of the hand: a swing gets the bat there with the ball, a take holds
  if (g.phase === 'flight' && ai?.swing) { const e = t - (g.arrive - 135); if (e > 0) f = lerp(0.38, 0.55, clamp(e / 135, 0, 1)) }
  if (g.phase === 'call' && ai) f = ai.swing ? lerp(0.55, 1, prog(t - g.callAt, 0, 300)) : lerp(0.38, 0.1, prog(t - g.callAt, 100, 600))
  let pose = hand > 0 ? flipB(swingPose(f, 1)) : swingPose(f, 1)
  let x = X, z = Z, turn = 0
  const R = g.res
  if (R && g.done) {
    const a = t - g.doneAt
    if (R.kind === 'K') {
      // struck out: the head down, the long walk back to the dugout
      const k = prog(a, 500, 2600)
      pose = a < 500 ? mixB(pose, { ...(hand > 0 ? flipB(STANCE) : STANCE), tilt: -0.9, face: 2 }, prog(a, 0, 400)) : { ...runB(a / 520, 0.25), tilt: -1, face: 2, bat: 1, ba: Math.PI / 2 - 0.3, bl: 0.7, hlx: -10, hly: -52, hrx: -12, hry: -50 }
      x = lerp(X, X - hand * 6, k); turn = a > 500 ? 0.18 : 0
    } else if (!R.out || R.runs) {
      // on: out of the box toward first; a home run, the trot (he's earned it)
      const k = prog(a, 100, 2200); x = lerp(X, X + 7, easeOut(k)); z = lerp(Z, Z + 7, easeOut(k)); pose = { ...runB(a / (R.kind === 'HR' ? 330 : 250), R.kind === 'HR' ? 0.55 : 1), face: 1 }; turn = 0.2
    } else {
      const k = prog(a, 100, 1600); x = lerp(X, X + 5, easeOut(k)); z = lerp(Z, Z + 5, easeOut(k)); pose = a < 1000 ? runB(a / 260, 0.9) : mixB(runB(a / 260, 0.3), { ...BP.hipsDown }, prog(a, 1000, 1400))
    }
  }
  if (g.drill) return null
  return { x, z, pose: { ...pose, face: pose.face ?? 0 }, turn }
}
function ballNow(g) {
  const p = g.pitch
  if (!p) return null
  const t = g.t
  if (g.hitAt != null && (g.play || g.ai?.kind === 'foul')) {
    const a = (t - g.hitAt) / 1000
    if (!g.play) return { x: (g.ai.bb?.phi ?? 30) > 0 ? a * 9 : -a * 9, y: 1 + a * 12 - a * a * 8, z: PLATE_Z - a * 14, spin: a * 30 }
    const pl = g.play, bb = g.ai.bb, rad = bb.phi * Math.PI / 180, D = Math.max(pl.dist, 20)
    if (bb.la < 8) { const k = clamp(a / 1.1, 0, 1), d = D * (1 - (1 - k) ** 2); return { x: Math.sin(rad) * d, y: 0.05 + Math.abs(Math.sin(k * 7)) * 0.35 * (1 - k), z: PLATE_Z + Math.cos(rad) * d, spin: a * 20 } }
    const dur = clamp((pl.hang ?? 2) * 0.55, 0.9, 2.4), k = clamp(a / dur, 0, 1.2), apex = clamp((bb.ev * 0.447 * Math.sin(bb.la * Math.PI / 180)) ** 2 / 19.6 * 0.62, 3, 45)
    return { x: Math.sin(rad) * D * k, y: 0.9 + apex * 4 * k * (1 - k), z: PLATE_Z + Math.cos(rad) * D * k, spin: a * 25 }
  }
  const f = g.relAt != null ? (t - g.relAt) / p.T : 0
  if (g.phase === 'deliver' || f < 0) return null
  if (f > 1.06) return { ...pitchPath(p, 1.06), held: true }
  return { ...pitchPath(p, f), spin: f * 20 }
}
export function draw(ctx, g, view) {
  g.vh = view.h
  const B = g.batters[g.bi]
  const hand = g.drill ? 1 : B.prof.hand
  const C = camFor(view, hand)
  // we're pitching: home whites if they bat in the top
  const usHome = g.sit ? g.sit.half === 'T' : true
  const K = uniforms(view, usHome)
  const team = usHome ? [view.colors.us, view.colors.trim] : [view.colors.them, view.colors.themTrim ?? '#f4efe6']
  staticPark(ctx, view, C, `pit${hand}`, { team, empty: g.drill })
  if (g.popAt != null) { crowdRise(ctx, C, team, g.t - g.popAt, 2600); flashesB(ctx, C, g.t - g.popAt) }
  const list = []
  // the showcase: the scouts in the front rows behind the plate, their guns up
  if (g.drill) {
    const scout = dressB(K.scout, { skin: '#c09060' }, {})
    ;[[-2.6, -16.6, '#c09060'], [-1.4, -16.8, '#5e3c22'], [-0.2, -16.5, '#f0c4a0'], [1.1, -16.7, '#8d5a3b'], [2.4, -16.6, '#a87548'], [3.6, -16.9, '#f0c4a0']].forEach(([X, Z, sk], i) => {
      const up = g.phase === 'deliver' || g.phase === 'flight' || (g.phase === 'call' && g.t - g.callAt < 600) || i % 2 === 0
      list.push({ z: Z, fn: () => radarScout(ctx, C, X, Z, { ...scout, skin: sk, cap: i % 2 ? '#1f2a3a' : '#3a2a1e' }, g.t, up && g.game !== 'bullpen') })
    })
  }
  // the umpire behind the catcher (not at a showcase)
  if (!g.drill) {
    const ump = umpPose(g)
    list.push({ z: -1.55, fn: () => baller(ctx, C, -0.28 * hand, -1.55, ump, dressB(K.ump, { skin: '#c09060' }, { front: true }), { shadow: false }) })
  }
  // the catcher: crouched, his glove where you've set it (and the bullpen's target), reaching for the ball as it comes
  const b = ballNow(g)
  const cat = catcherPose(g, b, view)
  list.push({ z: -0.82, fn: () => baller(ctx, C, 0, -0.82, cat, dressB(K.us, g.who.c ?? { number: 9, skin: '#a87548' }, { front: true, catcher: true, glove: 'R' }), { shadow: true }) })
  const bt = batterAt(g, B?.prof ?? { hand: 1 })
  if (bt) list.push({ z: bt.z, fn: () => baller(ctx, C, bt.x, bt.z, bt.pose, dressB(K.them, B.man ?? { number: 24, skin: '#8d5a3b' }, { front: true, helmet: true, flap: -hand, batGloves: [view.colors.themTrim ?? '#f2f2ee', '#1a1d22'], word: g.sit?.them ?? '', capLetter: (g.sit?.them ?? '')[0] }), { name: B.man?.name, turn: bt.turn }) })
  if (b && !b.held) list.push({ z: b.z, fn: () => ballB(ctx, C, b.x, b.y, b.z, b.spin, { shadow: g.hitAt != null }) })
  list.sort((p, q) => q.z - p.z)
  for (const it of list) it.fn()
  // the pitcher: his back to us, the number and the name, the glove on his other hand
  const pit = pitcherAt(g)
  baller(ctx, C, pit.x, pit.z, pit.pose, dressB(K.us, g.who.me ?? { number: 34, skin: '#8d5a3b' }, { front: false, glove: g.A.hand > 0 ? 'L' : 'R', name: g.who.me?.name }), { y: MOUND_H, turn: pit.turn, lift: pit.lift })
  if (g.done && g.done.hit && !g.kicked) { g.kicked = true; g.nudge.kick(g.t, 2.2, 0, 1, 170) }
  drawHud(ctx, g, view, C, B)
}
function umpPose(g) {
  const R = g.res, c = g.call
  if (c?.k && c.looking && g.phase !== 'set') { const a = g.t - g.callAt; return a < 160 ? mixB(BP.umpSet, BP.punch, a / 160) : { ...BP.punch, hrx: 34 + Math.sin(a / 70) * 2 } }
  if (g.phase === 'call' && g.ai?.kind === 'strike') { const a = g.t - g.callAt; return mixB(BP.umpSet, { ...BP.outCall, hry: -98 }, prog(a, 0, 180)) }
  if (R && g.done) return mixB(BP.umpSet, BP.stand, prog(g.t - g.doneAt, 300, 700))
  return BP.umpSet
}
function catcherPose(g, b, view) {
  const base = { ...BP.crouch, hlx: -8, hrx: 15, hry: -56, hly: -32 }
  // (from out here he faces us: his glove hand is on our right)
  const T = g.drill && g.game === 'bullpen' ? g.target : g.aim
  const p = g.pitch, k = p && b && g.relAt != null ? clamp((g.t - g.relAt) / p.T, 0, 1) ** 2 : 0
  const tx = p ? lerp(p.aim.x, p.to.x, k) : T.x, ty = p ? lerp(p.aim.y, p.to.y, k) : T.y
  base.hrx = clamp(-(tx / (1.85 / 110)) * 0.9 + 4, -30, 34); base.hry = clamp(-(ty / (1.85 / 110)) * 0.92, -84, -30)
  if (g.done && g.res) {
    const a = g.t - g.doneAt
    // a strikeout: up out of his crouch, the glove up to his pitcher; a hit: he stands, and watches
    return g.done.hit ? mixB(base, { ...BP.stand, hrx: 18, hry: -104, hlx: -12, hly: -60, face: 1 }, prog(a, 100, 450)) : mixB(base, BP.stand, prog(a, 100, 500))
  }
  return base
}
// the words on top: the scorebug, the tracker (his zones, the pitches, the glove), the count, the meter, the chips
function drawHud(ctx, g, view, C, B) {
  const { w, h } = view
  if (g.sit) scorebug(ctx, view, { ...g.sit, balls: Math.min(3, g.count.b), strikes: Math.min(2, g.count.s), outs: Math.min(2, g.outs), on: g.bases.on, usCol: view.colors.us, themCol: view.colors.them, usHome: g.sit.half === 'T' })
  else {
    ctx.fillStyle = 'rgba(6,9,13,.86)'; rr(ctx, 8, 50, 160, 34, 4); ctx.fill()
    const label = g.game === 'bullpen' ? `PITCH ${Math.min(g.rep + 1, g.reps)} OF ${g.reps} · ${g.pts ?? 0} PTS` : `${g.game === 'spin' ? 'SLIDER' : 'FASTBALL'} ${Math.min(g.rep + 1, g.reps)} OF ${g.reps}`
    text(ctx, label, 16, 60, { font: LABEL, size: 12, align: 'left', track: 0.8, color: 'rgba(242,242,238,.75)' })
    const best = g.reads.length ? (g.game === 'bullpen' ? null : Math.max(...g.reads)) : null
    const avg = g.reads.length && g.game === 'spin' ? Math.round(g.reads.reduce((s2, x) => s2 + x, 0) / g.reads.length / 10) * 10 : null
    text(ctx, g.game === 'bullpen' ? `MARK ${(Math.round(g.targetFor() * 2) / 2).toFixed(1)} PTS` : avg ? `AVERAGE ${avg.toLocaleString('en-US')} RPM` : best ? `BEST ${Math.round(best)} MPH` : `MARK ${g.game === 'spin' ? Math.round(g.targetFor() / 10) * 10 + ' RPM' : Math.round(g.targetFor()) + ' MPH'}`, 16, 75, { font: DISPLAY, size: 13, align: 'left' })
  }
  // the tracker: big enough to aim by
  const tx = w - 112, ty = 50, T = tracker(ctx, { x: tx, y: ty, w: 104, pitches: g.drill ? g.pitches.slice(-5) : g.pitches, aim: g.phase === 'set' || (g.phase === 'deliver' && g.k.phase === 'power') ? g.aim : null, aimR: 0.06, heat: g.drill ? null : B.prof, hand: g.drill ? null : B.prof.hand })
  if (g.game === 'bullpen' && g.target) { const X = T.X(g.target.x), Y = T.Y(g.target.y); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.strokeRect(X - 9, Y - 9, 18, 18) }
  // the hitter: his name, what he does
  if (!g.drill && B.man?.name && g.phase === 'set' && g.n === 0) {
    const prof = B.prof, line = `${prof.hot.toUpperCase().replace('-', ' ')} IS HIS ZONE${prof.chases ? ` · CHASES THE ${prof.chases === 'SL' ? 'SLIDER' : 'CHANGEUP'}` : ''}`
    ctx.fillStyle = 'rgba(6,9,13,.82)'; rr(ctx, 8, 90, 214, 30, 4); ctx.fill()
    text(ctx, B.man.name, 16, 100, { font: DISPLAY, size: 12, align: 'left' })
    text(ctx, line, 16, 113, { font: LABEL, size: 10.5, align: 'left', color: 'rgba(242,242,238,.72)', track: 0.6 })
  }
  // the call
  const call = g.call
  if (call && !g.done && (g.phase === 'call' || g.phase === 'play' || g.res)) {
    const y = h - 214, word = call.word
    ctx.font = `20px ${DISPLAY}`
    const tw = Math.max(120, ctx.measureText(word).width + 26)
    ctx.fillStyle = 'rgba(6,9,13,.86)'; rr(ctx, w / 2 - tw / 2, y - 16, tw, 32, 4); ctx.fill()
    ctx.fillStyle = call.good ? GOOD : call.good === false ? BAD : GOLD; ctx.fillRect(w / 2 - tw / 2, y + 13, tw, 3)
    text(ctx, word, w / 2, y + 1, { font: DISPLAY, size: 20 })
    if (g.pitch && !call.gun) text(ctx, `${PITCH_INFO[g.pitch.type].short} ${Math.round(g.pitch.mph)} MPH${g.pitch.perfect ? ' · PERFECT RELEASE' : ''}`, w / 2, y + 26, { font: LABEL, size: 12, color: 'rgba(242,242,238,.72)', track: 1 })
  }
  // the radar board, live as the pitch goes in (the showcase's gun reads on every one)
  if (g.pitch && (g.phase === 'flight' || g.phase === 'call') && g.game !== 'spin') radar(ctx, 52, h - 214 + (g.drill ? 0 : 40), g.phase === 'call' || g.t - g.relAt > 120 ? g.pitch.mph : null, { w: 76 })
  // the meter: up beside the pitcher, the red line past max effort, the release ring
  meterHud(ctx, g, view)
  // the pitch clock, its last five seconds
  if (!g.drill && g.phase === 'set' && !g.res) { const left = Math.ceil((CLOCK_MS - (g.t - g.at)) / 1000); if (left <= 5) text(ctx, `PITCH CLOCK ${left}`, w / 2, h - 192, { font: DISPLAY, size: 16, color: left <= 2 ? BAD : GOLD }) }
  // the chips: his three pitches and their speeds; the catcher's sign marked
  if (!g.drill && (g.phase === 'set')) {
    chipRow(g, h).forEach(c => {
      const on = g.type === c.key, info = PITCH_INFO[c.key]
      ctx.fillStyle = on ? '#f2f2ee' : 'rgba(6,9,13,.82)'; rr(ctx, c.x, c.y, CHIP_W, CHIP_H, 4); ctx.fill()
      ctx.fillStyle = info.col; ctx.fillRect(c.x, c.y, 3, CHIP_H)
      text(ctx, `${info.short} ${Math.round(g.A[c.key].mph)}`, c.x + CHIP_W / 2 + 1, c.y + 11, { font: DISPLAY, size: 13, color: on ? '#0b0c0e' : '#f2f2ee' })
      text(ctx, c.key === g.sign ? 'HIS SIGN' : info.name, c.x + CHIP_W / 2 + 1, c.y + 23, { font: LABEL, size: 9, track: 0.8, color: on ? 'rgba(11,12,14,.7)' : 'rgba(242,242,238,.6)' })
    })
  }
  placeStamp(g.stamp, view)
  promptB(ctx, view, g)
  drawPads(ctx, view, g.ctl, { move: g.drill && g.game !== 'bullpen' ? 'GLOVE' : 'LOCATION', S: 'PITCH', P: g.drill ? null : 'PITCH TYPE', keyP: 'E' }, !g.done && !g.res)
}
function meterHud(ctx, g, view) {
  const k = g.k
  if (k.phase === 'idle' && g.phase !== 'deliver') return
  if (k.phase === 'out' && g.t - k.strikeAt > 500) return
  const x = 22, H = 120, y0 = view.h - 330, w = 10, p = k.powerAt(g.t)
  ctx.fillStyle = 'rgba(6,9,13,.82)'; rr(ctx, x - 9, y0 - 22, w + 18, H + 38, 4); ctx.fill()
  text(ctx, 'EFFORT', x + w / 2, y0 - 12, { font: LABEL, size: 10, track: 0.8, color: 'rgba(242,242,238,.7)' })
  ctx.fillStyle = '#26282c'; ctx.fillRect(x, y0, w, H)
  // max effort: the top of the meter, hatched
  const my = y0 + H * (1 - k.max)
  ctx.fillStyle = 'rgba(200,16,46,.35)'; ctx.fillRect(x, y0, w, my - y0)
  ctx.fillStyle = p > k.max ? '#ff5a48' : '#f2f2ee'; ctx.fillRect(x, y0 + H * (1 - p), w, H * p)
  ctx.fillStyle = '#ff5a48'; ctx.fillRect(x - 3, my - 1, w + 6, 2)
  // the release: a ring closing on the point
  if (k.phase === 'deliver' || (k.phase === 'out' && g.t - k.strikeAt < 450)) {
    const cx = x + w / 2, cy = y0 + H + 8, left = k.strikeAt - g.t, f = clamp(1 - left / k.windup, 0, 1.4)
    ctx.strokeStyle = '#f2f2ee'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 6.2832); ctx.stroke()
    if (k.phase === 'deliver') { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(cx, cy, 4 + (1 - Math.min(1, f)) * 13, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1 }
    const word = k.timed === 'green' ? 'PERFECT' : k.timed === 'ok' ? 'GOOD' : k.timed === 'red' ? 'MISTIMED' : null
    if (word) text(ctx, word, cx + 14, cy, { font: LABEL, size: 12, align: 'left', track: 1, color: k.timed === 'green' ? '#f7cf55' : k.timed === 'red' ? '#ff8a7a' : '#f2f2ee' })
  }
}
