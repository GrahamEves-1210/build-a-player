// THE AT-BAT, WALK-OFF and EXIT VELOCITY: the hitter's games, from the camera over the catcher's shoulder.
//   the zone  the stick (the arrows) moves the oval: the part of the barrel he's putting on it. Lined up on the ball
//             it's square; over the top of it he beats it into the ground, under it he gets under it.
//   the read  the pitch comes out of the hand; a hitter with a good eye picks up the spin early (its name shows over
//             the zone), the slider's red dot, the changeup's slow spin. Balls off the plate: take them.
//   the swing CONTACT (SPACE) or POWER (E), as it gets to the plate: square is the bat meeting it at the front of the
//             plate. Early, he pulls it (or hooks it foul); late, he goes the other way (or fouls it back).
// A real at-bat, pitch by pitch, against a real arsenal: the count changes how he's pitched (behind in the count, a
// fastball in the zone; ahead, the slider off the plate). What comes off the bat (the exit velocity and the launch
// angle, from the timing and the contact) turns into a real result: a grounder, a liner in the gap, a fly to the
// track, a home run.
//   at-bat     a big at-bat late in a close one: get on base (a hit, a walk, or the run in on a sacrifice fly)
//   walk-off   bottom of the ninth or later, two strikes already, the winning run on: shorten up, foul off his pitch,
//              and drive the run in when he leaves one over the plate
//   exit-velo  the showcase's batting practice: front toss behind the L-screen, five swings, the gun on every one
import { clamp, lerp, prog, outcome, rngOf, easeOut, nudge, manOf, lightMode, text, DISPLAY, LABEL, rr, GOOD, BAD, GOLD } from './kit.js'
import { placeStamp } from './read.js'
import { momentSituation } from '../situations.js'
import { bbTarget } from './combineNorms.js'
import { INK } from './rig.js'
import {
  camOf, P, staticPark, baller, ballB, uniforms, dressB, BP, mixB, runB, swingPose, pitchPose, flipB, STANCE,
  arsenalOf, PITCH_INFO, PITCH_KEYS, flightMs, pitchPath, inZone, locate, SWINGS, hitterOf, contactOf, inPlay, runsOn, carryM, FT,
  scorebug, tracker, radar, scoreboard, crowdRise, flashesB, celebMsB, skipOutroB, batFlip, gatorade, cooler, radarScout,
  padCtl, padInput, padStick, drawPads, PLATE_Z, ZONE, RUBBER, MOUND_H, REL_Z, FIRST, SECOND, THIRD, gauss, lineB, flatB,
  hudB, promptB,
} from './baseball.js'

export const how = {
  'at-bat': 'A real at-bat, pitch by pitch. Pick up the spin out of his hand, get the zone on the ball with the stick and swing as it gets to the plate: CONTACT to put it in play, POWER to drive it. Don’t chase off the plate. Get on base.',
  'walk-off': 'Two strikes, the winning run on base. Shorten up and protect: spoil his pitch with CONTACT, spit on the chase, and when he leaves one over the plate, drive the run in. Anything that brings him home wins it.',
  'exit-velo': 'Batting practice, front toss behind the L-screen. Get the zone on it and drive it with POWER as it arrives. Five swings: the hardest one on the gun counts.',
}

const SET_MS = 950, WIND_MS = 900, STRETCH_MS = 760, CALL_MS = 950
const SPEED_PCI = 2.3            // m/s the zone moves at full stick
const hashOf = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h }

export function make({ v, seed, cast = null, situation = null, game = 'at-bat', pos = null }) {
  const r = rngOf(seed), H = hitterOf(v), tee = game === 'exit-velo', walk = game === 'walk-off'
  const sit = tee ? null : situation && (situation.baseball || situation.on) ? situation : momentSituation(game, seed, { us: situation?.us ?? 'HOME', them: situation?.them ?? 'AWAY' })
  const me = cast?.me ?? manOf(cast, 'us', 'bat', 0)
  const pm = cast?.them?.pit?.[0] ?? null
  // the pitcher: his real arsenal from his grades when the cast has them, a good big-league arm otherwise
  const throws = pm?.throws ?? (r() < 0.28 ? 'L' : 'R')
  // (late in a walk-off he's been out there a while: a touch less than his best)
  const A = arsenalOf(pm?.attrs ?? null, sit ? (walk ? 6.3 : 7) : 6, throws)
  // the hitter's side: a switch-hitter bats from the other side of the pitcher's arm
  const bats0 = me?.bats ?? (hashOf(seed) % 4 === 0 ? 'L' : 'R')
  const hand = (bats0 === 'S' ? (throws === 'L' ? 'R' : 'L') : bats0) === 'L' ? -1 : 1
  const bases = sit ? { on: [...sit.on], outs: sit.outs, send: walk } : { on: [false, false, false], outs: 0 }
  const need = sit ? Math.max(1, sit.opp - sit.mine + 1) : 1
  const g = {
    t: 0, game, zones: 'none', stick: true, pads: null, fx: [], done: null, outro: 2400, stamp: null,
    // (the game's own copy of the situation: its score changes when a run's in, the career's doesn't)
    sit: sit ? { ...sit } : null, A, H, hand, tee, walk, bases, need, throws,
    count: { b: sit?.balls ?? 0, s: sit?.strikes ?? 0 }, n: 0, pitches: [], last: null,
    phase: 'set', at: 0, setMs: SET_MS + 400, pitch: null, relAt: null, arrive: null, swing: null, res: null, call: null, callAt: null,
    pci: { x: 0, y: 0.8 }, reveal: null, bb: null, play: null, hitAt: null, doneAt: null, endAt: null,
    // the showcase: five swings, the best exit velocity
    rounds: tee ? 5 : 0, round: 0, evs: [], bestEv: null, bestDist: null,
    ctl: padCtl(), vh: 640,
    who: { me, pit: pm, c: cast?.them?.bat?.find(m => m.role === 'C') ?? manOf(cast, 'them', 'bat', 1), mates: [1, 2, 3, 4, 5].map(i => manOf(cast, 'us', 'bat', i)), field: [1, 2, 3, 4, 5, 6, 7].map(i => manOf(cast, 'them', 'bat', i)) },
    nudge: nudge(),
    hud: hudB(tee ? 'ZONE ON IT · POWER AS IT GETS THERE' : walk ? 'TWO STRIKES: PROTECT THE PLATE' : 'MOVE THE ZONE · SWING AS IT ARRIVES'),
    tick(dt) {
      g.t += dt
      const o = padStick(g.ctl)
      // the zone moves with the stick (and stays where it's left)
      if (!g.done && !g.res) { g.pci.x = clamp(g.pci.x + o.x * SPEED_PCI * dt / 1000, -0.48, 0.48); g.pci.y = clamp(g.pci.y + o.y * SPEED_PCI * dt / 1000, 0.3, 1.32) }
      if (g.phase === 'set' && g.t - g.at >= g.setMs) { g.phase = 'wind'; g.at = g.t; g.windMs = tee ? 650 : bases.on.some(Boolean) ? STRETCH_MS : WIND_MS; choose() }
      if (g.phase === 'wind' && g.t - g.at >= g.windMs) release()
      if (g.phase === 'flight') {
        const f = (g.t - g.relAt) / g.pitch.T
        if (g.reveal == null && f >= H.read) { g.reveal = g.t }
        // the bat gets there: judge it on the plate
        if (g.swing && !g.swing.judged && g.t >= g.swing.at + SWINGS[g.swing.type].ms) judge()
        // nobody swung: it's in the glove, and the umpire calls it
        if (!g.swing && g.t >= g.arrive + 70) take()
        if (g.swing?.judged && g.call == null && g.t >= g.arrive + 70) after()
      }
      if (g.phase === 'call' && g.t - g.callAt >= (g.res ? 99999 : CALL_MS)) next()
      if (g.res && !g.done && g.t >= g.endAt) finish()
    },
    input(a) {
      if (skipOutroB(g, a)) return
      padInput(g.ctl, a, g.vh, { down: id => swingNow(id === 'P' ? 'power' : 'contact') })
    },
  }
  // ── the pitcher's call ──
  function choose() {
    const { b, s } = g.count
    let pick, aim
    if (tee) {
      pick = 'FB'; aim = { x: (r() - 0.5) * 0.24, y: 0.72 + (r() - 0.5) * 0.24 }
      g.pitch = { type: 'FB', mph: 52 + r() * 6, rel: { x: 0.3, y: 1.15, z: 13.5 }, to: aim, M: { x: 0, y: 0 }, A: 0.22, aim }
      g.pitch.T = flightMs(g.pitch); return
    }
    // ahead, he expands; behind, he comes in with the fastball; two strikes in a walk-off he's trying to get him to chase
    const ahead = s > b, behind = b > s, full = b === 3 && s === 2
    const w = full ? [0.55, 0.28, 0.17] : behind ? [0.72, 0.16, 0.12] : ahead ? [0.36, 0.38, 0.26] : b + s === 0 ? [0.55, 0.25, 0.2] : [0.48, 0.3, 0.22]
    // (the same pitch three times running is rare)
    if (g.last && g.pitches.length >= 2 && g.pitches.slice(-2).every(p => p.type === g.last.type)) w[PITCH_KEYS.indexOf(g.last.type)] *= 0.3
    const tot = w[0] + w[1] + w[2]; let u = r() * tot; pick = PITCH_KEYS.find((k, i) => (u -= w[i]) <= 0) ?? 'FB'
    const chase = r() < (s === 2 ? (walk ? 0.55 : 0.48) : ahead ? 0.3 : behind ? 0.06 : 0.16)
    const awayX = hand > 0 ? 1 : -1
    if (chase) aim = pick === 'SL' ? { x: awayX * 0.36, y: 0.38 } : pick === 'CH' ? { x: awayX * 0.18, y: 0.32 } : { x: awayX * (r() < 0.5 ? 0.1 : -0.1), y: 1.24 }
    else if (r() < 0.5) aim = { x: (r() < 0.5 ? -1 : 1) * 0.19, y: r() < 0.5 ? 0.58 : 0.98 }
    else aim = { x: (r() - 0.5) * 0.3, y: 0.62 + r() * 0.3 }
    const P0 = A[pick], sd = lerp(0.15, 0.055, A.command) * (pick === 'FB' ? 1 : 1.15)
    const to = locate(aim, sd, r)
    const mph = P0.mph + gauss(r) * 0.8
    g.pitch = { type: pick, mph, rel: { x: -0.55 * A.hand, y: 1.78, z: REL_Z }, to, M: P0.M, A: P0.A, q: P0.q, aim }
    g.pitch.T = flightMs(g.pitch)
  }
  function release() {
    g.phase = 'flight'; g.relAt = g.t; g.arrive = g.t + g.pitch.T; g.swing = null; g.reveal = null; g.call = null
    g.hud.prompt = null
    g.fx.push('h:light')
  }
  function swingNow(type) {
    if (g.done || g.res) return
    if (g.phase !== 'flight' || g.swing) return
    // (once it's in the glove it's too late to go)
    if (g.t > g.arrive + 40) return
    g.swing = { type, at: g.t, judged: false }
    g.fx.push('swoosh', 'h:light')
  }
  function judge() {
    const sw = g.swing, S = SWINGS[sw.type], p = g.pitch
    sw.judged = true
    const ball = pitchPath(p, 1), e = sw.at + S.ms - g.arrive
    const c = contactOf(sw.type, H, ball, g.pci, e, hand, p.mph, r, g.count.s >= 2 && !tee)
    sw.c = c; sw.e = e
    if (c.kind === 'play') {
      const res = tee ? { kind: 'BP', dist: 0, out: false } : inPlay({ ev: c.ev, la: c.la, phi: c.phi, q: c.q }, r, bases)
      g.bb = c; g.play = res; g.hitAt = g.t
      g.fx.push('lock', c.q > 0.75 ? 'h:heavy' : 'h:medium')
      if (c.q > 0.78) g.nudge.kick(g.t, 2.4, 0, 1, 160)
      if (tee) return bp(c)
      ballInPlay(res, c)
    } else if (c.kind === 'foul' || c.kind === 'tip') {
      g.bb = c; g.hitAt = g.t; g.fx.push(c.kind === 'tip' ? 'tap' : 'lock', 'h:light')
    }
  }
  // the coach's toss, squared up (or not): the gun's reading, onto the next one
  function bp(c) {
    const ev = Math.round(c.ev * 10) / 10, dist = Math.round(carryM(c.ev, c.la) / FT)
    g.evs.push(ev); g.bestEv = Math.max(g.bestEv ?? 0, ev); g.bestDist = Math.max(g.bestDist ?? 0, dist)
    g.call = { word: `${Math.round(ev)} MPH`, good: ev >= 95, sub: c.la < 8 ? 'ON THE GROUND' : c.la > 45 ? 'UNDER IT' : `${dist} FT` }
    g.callAt = g.t; g.phase = 'call'
  }
  function ballInPlay(res, c) {
    let runs = res.runs
    const kind = res.kind
    // a walk-off ends when the winning run touches the plate: only a home run brings every run in
    if (sit && sit.half === 'B' && sit.inning >= 9 && kind !== 'HR' && sit.mine <= sit.opp && sit.mine + runs > sit.opp) runs = sit.opp + 1 - sit.mine
    g.res = { kind, runs, out: res.out, word: res.word, call: res.call, dist: Math.round(res.dist / FT), ev: Math.round(c.ev), la: Math.round(c.la) }
    g.endAt = g.t + (kind === 'HR' ? 900 : res.out ? 900 : 700)
    g.phase = 'play'
  }
  function take() {
    const p = g.pitch, strike = inZone(p.to.x, p.to.y, -0.02) || (inZone(p.to.x, p.to.y, 0.025) && r() < 0.5)
    g.swing = null
    count(strike ? 'S' : 'B', strike ? (g.count.s === 2 ? 'STRIKE THREE' : 'STRIKE') : 'BALL', true)
  }
  function after() {
    const c = g.swing.c
    if (c.kind === 'play') return
    if (c.kind === 'tip' && g.count.s === 2 && r() < 0.5) return count('K', 'FOUL TIP, STRUCK OUT', false)
    if (c.kind === 'foul' || c.kind === 'tip') return count('F', 'FOUL', false)
    count('S', g.count.s === 2 ? 'STRUCK OUT' : 'SWINGING STRIKE', false)
  }
  // the call, and the count after it
  function count(kind, word, looking) {
    const p = g.pitch
    g.n++
    g.pitches.push({ to: p.to, type: p.type, n: g.n, mph: p.mph })
    g.last = { ...p }
    g.callAt = g.t; g.phase = 'call'
    if (tee) { g.evs.push(0); g.call = { word: kind === 'F' ? 'FOUL' : 'MISSED IT', good: false }; return }
    if (kind === 'B') { g.count.b++; if (g.count.b >= 4) return end({ kind: 'BB', runs: runsOn('BB', bases), word: 'WALK', call: runsOn('BB', bases) ? 'Ball four, and the run is forced in' : 'Ball four. He takes his base', out: false }) }
    else if (kind === 'S') { g.count.s++; if (g.count.s >= 3) return end({ kind: 'K', runs: 0, word: looking ? 'CAUGHT LOOKING' : 'STRUCK OUT', call: looking ? 'Strike three called. He froze him' : 'Swung through it. Strike three', out: true, looking }) }
    else if (kind === 'K') return end({ kind: 'K', runs: 0, word: 'STRUCK OUT', call: 'Foul tip, held on to. Strike three', out: true })
    else if (kind === 'F') { if (g.count.s < 2) g.count.s++ }
    g.call = { word, good: kind === 'B', looking }
    g.fx.push(kind === 'B' ? 'tap' : 'catchball')
  }
  function end(res) {
    g.res = { ...res, dist: null, ev: null }
    g.call = { word: res.word, good: !res.out }
    g.endAt = g.t + 500
    g.fx.push(res.out ? 'catchball' : 'tap')
  }
  function next() {
    if (g.res) return
    if (tee) {
      g.round++
      if (g.round >= g.rounds) return finishBp()
    }
    g.phase = 'set'; g.at = g.t; g.setMs = SET_MS * (0.75 + r() * 0.5); g.pitch = null; g.swing = null; g.bb = null; g.call = null
  }
  function finishBp() {
    // the showcase's mark for his grade (lib/mg/combineNorms.js): a B hitter about 98 off the bat
    const best = Math.round(g.bestEv ?? 0), target = Math.round(bbTarget('exitVelo', pos === 'pit' ? 'pit' : 'bat', v))
    const score = clamp(0.5 + (best - target) / 16, 0, 1), hit = best >= target
    const hard = g.evs.filter(e => e >= 95).length
    g.done = outcome(score, hit, `${Math.round(best)} mph best · ${hard} of ${g.rounds} hit 95+`, { mph: Math.round(best), dist: g.bestDist ?? 0, made: hard, of: g.rounds, evs: g.evs })
    g.doneAt = g.t; g.outro = 1900
    g.stamp = { text: hit ? 'BARRELED UP' : 'MORE BAT SPEED', good: hit, at: g.t, size: 40 }
    g.fx.push(hit ? 'h:success' : 'h:heavy')
  }
  function finish() {
    const R = g.res, walkoffWin = walk ? R.runs >= need : false
    let hit, score
    if (walk) { hit = walkoffWin || (R.kind === 'HR'); score = hit ? clamp(0.72 + (R.kind === 'HR' ? 0.28 : R.kind === '2B' || R.kind === '3B' ? 0.16 : 0.1), 0, 1) : R.kind === 'BB' ? 0.42 : R.out ? (R.kind === 'K' ? 0.05 : 0.18) : 0.4 }
    else { hit = !R.out || R.runs > 0; score = { HR: 1, '3B': 0.9, '2B': 0.85, '1B': 0.72, BB: 0.6, SF: 0.58 }[R.kind] ?? (R.runs > 0 ? 0.55 : R.kind === 'K' ? 0.05 : 0.2) }
    const note = (walkoffWin ? String(R.call).replace(/: (a run scores|\d runs score)$/, ': the winning run scores') : R.call) + (R.ev ? ` · ${R.ev} mph off the bat${R.dist && !['GO', 'DP', 'FC'].includes(R.kind) ? `, ${R.dist} ft` : ''}` : '')
    // the run's in: on the board now
    if (g.sit && R.runs) g.sit.mine += R.runs
    g.done = outcome(score, hit, note, { result: R.kind, runs: R.runs, pts: R.runs, ev: R.ev, la: R.la, dist: R.dist, pitches: g.n + (R.kind === 'BB' || R.kind === 'K' ? 0 : 1), count: `${g.count.b}-${g.count.s}`, walkoff: walkoffWin, final: g.sit ? { mine: g.sit.mine, opp: g.sit.opp } : null })
    g.doneAt = g.t
    const big = R.kind === 'HR' || walkoffWin
    g.celeb = big && !lightMode() ? { at: g.t, walkoff: walkoffWin, hr: R.kind === 'HR' } : null
    g.outro = big ? celebMsB() + 600 : hit ? 1900 : 2100
    const word = walkoffWin ? (R.kind === 'HR' ? 'WALK-OFF HOMER' : 'WALK-OFF') : R.word
    g.stamp = { text: word, good: hit, at: g.t, size: word.length > 11 ? 36 : 46 }
    g.popAt = big || (hit && sit?.half === 'B' && R.kind !== 'BB') ? g.t : null
    g.fx.push(hit ? 'h:success' : 'h:heavy')
  }
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
// Over the catcher's shoulder, a little high: the zone in the middle, the hitter big at the side of the plate, the
// pitcher out on the mound with the whole park behind him.
const camFor = view => camOf(view, { x: 0, y: 2.4, z: -2.7, pitch: 0.13, F: 390, cy: 0.42 })
// the plate cam for the mob: low, off the first-base side, looking in at home (or out at the bag where they mob him)
const mobCam = (view, at) => camOf(view, { x: at.x + 3.6, y: 1.5, z: at.z - 3.9, yaw: -0.74, pitch: 0.05, F: 330, cy: 0.5 })
const FIELDERS = [[0, 92, 'CF'], [-58, 74, 'LF'], [58, 74, 'RF'], [9, 36, '2B'], [-10, 35, 'SS'], [17, 23, '1B'], [-17.5, 22, '3B']]
function batterAt(g) {
  const t = g.t, hand = g.hand, X = -0.92 * hand, Z = 0.25
  const sw = g.swing
  // into the stride as the pitcher comes set and delivers: the timing load
  let f = 0
  if (g.phase === 'wind') f = 0.2 * prog(t - g.at, g.windMs - 520, g.windMs - 120)
  if (g.phase === 'flight' || g.phase === 'call' || g.phase === 'play') {
    const since = g.relAt != null ? t - g.relAt : 0
    f = lerp(0.2, 0.38, prog(since, 0, 280))
    if (sw) { const S = SWINGS[sw.type], e = t - sw.at; f = e < S.ms ? lerp(0.38, 0.55, e / S.ms) : lerp(0.55, 1, prog(e, S.ms, S.ms + 320)) }
    // a take: he holds, then relaxes out of it
    else if (g.phase === 'call') f = lerp(0.38, 0.12, prog(t - g.callAt, 100, 600))
  }
  if (g.phase === 'set') f = 0
  let pose = swingPose(f, 1, { pci: { y: (g.pci.y - 0.78) / 0.4 } })
  let x = X, z = Z, turn = 0, batGone = false
  const R = g.res
  if (R && g.done) {
    const a = t - g.doneAt
    if (R.kind === 'HR') {
      // admires it, the bat flip, then into the trot down to first
      batGone = a > 380
      if (a < 380) pose = swingPose(1, 1)
      else if (a < 900) pose = mixB(swingPose(1, 1), { ...BP.stand, tilt: 0.6, face: 1 }, prog(a, 380, 640))
      else { const k = prog(a, 900, 2400); x = lerp(X, X + 3, k); z = lerp(Z, Z + 2.6, k); pose = runB(a / 330, 0.55, { arms: a > 1500 ? 'fist' : null }); turn = 0.15 }
    } else if (!R.out || R.runs > 0) {
      // a hit: the bat dropped, out of the box running, toward first
      batGone = true
      const k = prog(a, 120, 1900); x = lerp(X, X + 6.5, easeOut(k)); z = lerp(Z, Z + 6.5, easeOut(k)); pose = runB(a / 250, 1, null); turn = 0.15
    } else if (R.kind === 'K') {
      // struck out: the head drops, and the long walk back to the dugout
      const k = prog(a, 500, 3400) * 0.55
      pose = a < 500 ? mixB(pose, { ...STANCE, bat: 1, ba: Math.PI / 2 + 0.3, bl: 0.7, hlx: 6, hly: -60, hrx: 9, hry: -58, tilt: -0.9 }, prog(a, 0, 400)) : { ...runB(a / 520, 0.25), bat: 1, ba: Math.PI / 2 + 0.25, bl: 0.75, hlx: 10, hly: -52, hrx: 12, hry: -50, tilt: -1 }
      x = lerp(X, X - hand * 5.5, k); z = lerp(Z, Z - 1.2, k)
    } else {
      // put it in play and he's out: runs it out, then pulls up, the head down
      batGone = true
      const k = prog(a, 100, 1800); x = lerp(X, X + 5, easeOut(k)); z = lerp(Z, Z + 5, easeOut(k))
      pose = a < 1100 ? runB(a / 260, 0.9) : mixB(runB(a / 260, 0.4), BP.hipsDown, prog(a, 1100, 1500))
    }
  } else if (R?.kind === 'BB' || (g.call?.word === 'WALK')) batGone = true
  if (hand < 0) pose = flipB(pose)
  return { x, z, pose: batGone ? { ...pose, bat: 0 } : pose, turn, batGone }
}
function pitcherAt(g) {
  const t = g.t, A = g.A
  let f = 0
  if (g.phase === 'wind') f = 0.68 * clamp((t - g.at) / g.windMs, 0, 1)
  else if (g.phase !== 'set' && g.relAt != null) f = lerp(0.68, 1, prog(t - g.relAt, 0, 520))
  // from the front: the delivery mirrored (his throwing hand on our left for a right-hander)
  let pose = flipB(pitchPose(f, A.hand))
  if (g.phase === 'set') pose = flipB(BP.set)
  const R = g.res
  if (R && g.done) {
    const a = t - g.doneAt
    // the winners can celebrate: a strikeout, a fist pump off the mound. Beaten, he stands there, hands on hips
    if (R.out) pose = R.kind === 'K' ? (a < 700 ? mixB(pose, BP.fist, prog(a, 0, 260)) : { ...BP.fist, hry: -100 - Math.abs(Math.sin(a / 160)) * 16 }) : mixB(pose, BP.stand, prog(a, 0, 400))
    else pose = R.kind === 'HR' ? (a < 1200 ? mixB(pose, BP.stare, prog(a, 0, 400)) : mixB(BP.stare, BP.hipsDown, prog(a, 1200, 1600))) : mixB(pose, BP.hips, prog(a, 0, 500))
  }
  return { x: 0, z: RUBBER + 0.2, pose }
}
function ballNow(g) {
  const p = g.pitch
  if (!p || g.phase === 'set' || g.phase === 'wind') return null
  const t = g.t
  // in play: off the bat, out over the field
  if (g.hitAt != null && g.bb) {
    const c = g.bb, a = (t - g.hitAt) / 1000
    if (c.kind === 'foul' || c.kind === 'tip') {
      if (c.kind === 'tip') return null
      const back = Math.abs(c.phi ?? 60) > 50
      const ux = Math.sin((c.phi ?? 60) * Math.PI / 180), vz = back ? -1 : Math.cos((c.phi ?? 60) * Math.PI / 180)
      return { x: ux * a * 26, y: 0.9 + a * 14 - a * a * 6, z: PLATE_Z + vz * a * 20, spin: a * 30 }
    }
    if (g.tee) {
      const rad = c.phi * Math.PI / 180, v = c.ev * 0.447 * 0.55, la = c.la * Math.PI / 180
      return { x: Math.sin(rad) * Math.cos(la) * v * a, y: 0.85 + Math.sin(la) * v * a - 4.9 * a * a * 0.3, z: PLATE_Z + Math.cos(rad) * Math.cos(la) * v * a, spin: a * 40 }
    }
    const pl = g.play, dist = pl.dist, hang = Math.max(0.6, pl.hang ?? 1), D = Math.max(dist, 22)
    const fly = c.la >= 8
    const dur = fly ? clamp(hang * 0.55, 0.9, 2.4) : 1.0
    const k = clamp(a / dur, 0, 1.25)
    const rad = c.phi * Math.PI / 180
    if (!fly) {
      // on the ground: skipping out toward the infield, slowing
      const d = D * (1 - (1 - Math.min(k, 1)) ** 2)
      return { x: Math.sin(rad) * d, y: 0.05 + Math.abs(Math.sin(k * 7)) * 0.4 * (1 - k), z: PLATE_Z + Math.cos(rad) * d, spin: a * 20 }
    }
    const apex = clamp((c.ev * 0.447 * Math.sin(c.la * Math.PI / 180)) ** 2 / (2 * 9.81) * 0.62, 3, 45)
    const d = D * k * (pl.kind === 'HR' ? 1.08 : 1)
    return { x: Math.sin(rad) * d, y: 0.9 + apex * 4 * k * (1 - k) + (k > 1 ? 0 : 0), z: PLATE_Z + Math.cos(rad) * d, spin: a * 25 }
  }
  const f = (t - g.relAt) / p.T
  if (f > 1.07) return { ...pitchPath(p, 1.06), held: true }
  return { ...pitchPath(p, Math.max(0, f)), spin: f * (p.type === 'FB' ? 26 : p.type === 'SL' ? 14 : 8), type: p.type }
}
// the zone on the plate: chalk lines, faint, its nine boxes; the hitter's oval over it
function zoneFrame(ctx, C) {
  const a = P(C, ZONE.x0, ZONE.y1, PLATE_Z), b = P(C, ZONE.x1, ZONE.y0, PLATE_Z)
  if (!a.ok || !b.ok) return
  ctx.strokeStyle = 'rgba(244,244,236,.5)'; ctx.lineWidth = 1.4; ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y)
  ctx.strokeStyle = 'rgba(244,244,236,.16)'; ctx.lineWidth = 1; ctx.beginPath()
  for (let k = 1; k < 3; k++) { const x = lerp(a.x, b.x, k / 3), y = lerp(a.y, b.y, k / 3); ctx.moveTo(x, a.y); ctx.lineTo(x, b.y); ctx.moveTo(a.x, y); ctx.lineTo(b.x, y) }
  ctx.stroke()
}
function pciDraw(ctx, C, g, type) {
  const S = SWINGS[type] ?? SWINGS.contact, R = g.H.R * S.pci * (g.count.s >= 2 && type !== 'power' && !g.tee ? 1.16 + 0.14 * g.H.t : 1), c = P(C, g.pci.x, g.pci.y, PLATE_Z)
  if (!c.ok) return
  const rx = R * c.s, ry = R * c.s / 1.08
  ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, 6.2832); ctx.stroke()
  ctx.strokeStyle = g.swing ? GOLD : '#f2f2ee'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, 6.2832); ctx.stroke()
  ctx.fillStyle = g.swing ? GOLD : '#f2f2ee'; ctx.beginPath(); ctx.arc(c.x, c.y, 2.2, 0, 6.2832); ctx.fill()
  ctx.strokeStyle = 'rgba(242,242,238,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c.x - rx * 0.55, c.y); ctx.lineTo(c.x - rx * 0.2, c.y); ctx.moveTo(c.x + rx * 0.2, c.y); ctx.lineTo(c.x + rx * 0.55, c.y); ctx.stroke()
}
export function draw(ctx, g, view) {
  g.vh = view.h
  const K = uniforms(view, g.sit ? g.sit.half === 'B' : true)
  const team = [view.colors.us, view.colors.trim]
  const age = g.doneAt != null ? g.t - g.doneAt : -1
  // the walk-off and the home run: the mob, from the plate cam (after the ball's gone)
  if (g.celeb && age > 1700) return drawMob(ctx, g, view, K, age - 1700, team)
  const C = camFor(view)
  staticPark(ctx, view, C, g.tee ? 'bp' : 'ab', { team: g.sit?.half === 'B' || !g.sit ? team : [view.colors.them, view.colors.themTrim ?? '#f4efe6'], empty: g.tee })
  if (g.sit) scoreboard(ctx, C, g.sit && { ...g.sit, balls: g.count.b, strikes: g.count.s })
  else scoreboard(ctx, C, null, g.bestEv ? `${Math.round(g.bestEv)} MPH` : 'SHOWCASE')
  if (g.popAt != null) { crowdRise(ctx, C, team, g.t - g.popAt, 2800); flashesB(ctx, C, g.t - g.popAt) }
  const meLook = dressB(K.us, g.who.me ?? { number: 27, skin: '#8d5a3b' }, { front: false, helmet: true, flap: -g.hand, batGloves: [view.colors.trim ?? '#f2f2ee', '#1a1d22'], capLetter: null, name: g.who.me?.name })
  const pLook = dressB(K.them, g.who.pit ?? { number: 45, skin: '#c09060' }, { front: true, glove: g.A.hand > 0 ? 'R' : 'L', word: g.sit?.them ?? '', capLetter: (g.sit?.them ?? 'B')[0] })
  const list = []
  // the defense in their spots, the runners off their bases (the showcase: the coach behind his screen, the scouts)
  if (!g.tee) {
    FIELDERS.forEach(([X, Z, pos], i) => {
      const ball = g.play ? ballNow(g) : null
      let x = X, z = Z, pose = BP.ready
      if (ball && g.hitAt != null) { const d = Math.hypot(ball.x - X, ball.z - Z); if (d < 26) { const k = clamp((g.t - g.hitAt) / 1400, 0, 1); x = lerp(X, ball.x, k * 0.6); z = lerp(Z, ball.z, k * 0.6); pose = runB(g.t / 230, 0.8) } }
      list.push({ z, fn: () => baller(ctx, C, x, z, pose, dressB(K.them, g.who.field[i] ?? { number: [8, 12, 24, 4, 2, 35, 13][i], skin: ['#c09060', '#8d5a3b', '#f0c4a0', '#5e3c22', '#a87548', '#f0c4a0', '#7a5030'][i] }, { front: true, glove: 'R', word: g.sit?.them ?? '' })) })
    })
    // the men on base, leading off; they go on contact (and walk to the next base on ball four)
    ;[[FIRST, 0], [SECOND, 1], [THIRD, 2]].forEach(([B, i]) => {
      if (!g.bases.on[i]) return
      const lead = i === 2 ? { x: B.x + 2.6, z: B.z - 2.6 } : i === 0 ? { x: B.x - 2.8, z: B.z + 2.8 } : { x: B.x - 2.6, z: B.z - 2.4 }
      let x = lead.x, z = lead.z, pose = BP.lead
      if (g.hitAt != null && g.play) { const k = clamp((g.t - g.hitAt) / 2600, 0, 1), to = i === 2 ? { x: 0, z: 0.5 } : i === 1 ? THIRD : SECOND; x = lerp(lead.x, to.x, k); z = lerp(lead.z, to.z, k); pose = runB(g.t / 240, 1) }
      list.push({ z, fn: () => baller(ctx, C, x, z, pose, dressB(K.us, g.who.mates[i] ?? { number: [5, 17, 22][i], skin: ['#5e3c22', '#f0c4a0', '#a87548'][i] }, { front: true, helmet: true, noBat: true })) })
    })
    const pit = pitcherAt(g)
    list.push({ z: pit.z, fn: () => baller(ctx, C, pit.x, pit.z, pit.pose, pLook, { y: MOUND_H, name: g.who.pit?.name }) })
  } else {
    // batting practice: the coach behind the L-screen, a bucket of balls; the scouts with their guns behind the plate
    const at = g.phase === 'wind' ? clamp((g.t - g.at) / g.windMs, 0, 1) : 0
    const coach = { ...BP.stand, hy: 50, hlx: -10, hly: -60, hrx: lerp(18, 10, at), hry: lerp(-58, -86, Math.sin(at * Math.PI)), elbow: 0.4 }
    list.push({ z: 13.8, fn: () => { baller(ctx, C, 0.4, 13.8, coach, dressB(K.staff, { number: null, skin: '#c09060' }, { front: true })); lScreen(ctx, C) } })
  }
  const b = ballNow(g)
  if (b && b.z > 2.2) list.push({ z: b.z, fn: () => ballB(ctx, C, b.x, b.y, b.z, b.spin, { shadow: g.hitAt != null }) })
  list.sort((p, q) => q.z - p.z)
  for (const it of list) it.fn()
  if (!g.done) zoneFrame(ctx, C)
  // the hitter, big beside the plate
  const bt = batterAt(g)
  const bp = baller(ctx, C, bt.x, bt.z, bt.pose, meLook, { turn: bt.turn, shadow: true })
  if (g.res?.kind === 'HR' && bp.ok) { const k = bp.s * 1.85 / 110; batFlip(ctx, bp.x + g.hand * 20 * k, bp.y - 95 * k, g.t - g.doneAt - 380, bp.s, g.hand) }
  // the catcher, crouched in front of us, reaching for it
  const cat = catcherPose(g, b)
  baller(ctx, C, 0.02, -0.95, cat, dressB(K.them, g.who.c ?? { number: 9, skin: '#a87548' }, { front: false, catcher: true, glove: 'L' }), { shadow: false, size: 0.94 })
  if (b && b.z <= 2.2 && !b.held) ballB(ctx, C, b.x, b.y, b.z, b.spin, { shadow: false })
  if (!g.done && g.phase !== 'play') pciDraw(ctx, C, g, g.swing?.type ?? 'contact')
  if (g.res && g.done && !g.kicked && g.res.kind === 'HR') { g.kicked = true; g.nudge.kick(g.t, 3, 0, 1, 200) }
  drawHud(ctx, g, view, C)
}
// the L-screen the coach throws from behind: a net on a frame, the L cut out where he lets it go
function lScreen(ctx, C) {
  const a = P(C, -0.7, 0, 12.8), b = P(C, 0.95, 0, 12.8), c = P(C, 0.95, 2.1, 12.8), d = P(C, -0.7, 2.1, 12.8), m = P(C, 0.1, 1.25, 12.8)
  if (!a.ok) return
  ctx.fillStyle = 'rgba(20,26,32,.55)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(m.x, c.y); ctx.lineTo(m.x, m.y); ctx.lineTo(d.x, m.y); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = '#2a333c'; ctx.lineWidth = Math.max(1, 0.05 * a.s); ctx.stroke()
}
function catcherPose(g, b) {
  const base = { ...BP.crouch, hy: 21, bow: 0.34 }
  // he sets up where the pitcher's going, then reaches for where it really is
  const p = g.pitch
  const tx = p ? (b && !g.bb ? lerp(p.aim.x, b.x, clamp((g.t - g.relAt) / p.T, 0, 1) ** 2) : p.aim.x) : 0
  const ty = p ? (b && !g.bb ? lerp(p.aim.y, b.y, clamp((g.t - g.relAt) / p.T, 0, 1) ** 2) : p.aim.y) : 0.75
  base.hlx = clamp(((tx - 0.02) / (1.85 / 110)) * 0.9, -34, 30) - 2; base.hly = clamp(-(ty / (1.85 / 110)) * 0.92, -84, -34)
  if (g.done && g.res) {
    const a = g.t - g.doneAt
    // a strikeout: up out of the crouch; otherwise he stands, and watches it go
    return mixB(base, { ...BP.ready, hy: 34, bow: 0.3, hlx: g.res.kind === 'K' ? -18 : -14, hly: g.res.kind === 'K' ? -78 : -52, mitt: 1 }, prog(a, 100, 500))
  }
  return base
}
// The words on top: the scorebug, the pitch tracker, what's coming (once he's picked it up), the speed on the board,
// the call after every pitch; the pads.
function drawHud(ctx, g, view, C) {
  const { w } = view
  if (g.sit) scorebug(ctx, view, { ...g.sit, balls: Math.min(3, g.count.b), strikes: Math.min(2, g.count.s), outs: g.bases.outs, on: g.bases.on, usCol: view.colors.us, themCol: view.colors.them, usHome: g.sit.half === 'B' })
  else {
    // the showcase's board: the swing count and the best one so far
    ctx.fillStyle = 'rgba(6,9,13,.86)'; rr(ctx, 8, 50, 150, 34, 4); ctx.fill()
    text(ctx, `SWING ${Math.min(g.round + 1, g.rounds)} OF ${g.rounds}`, 16, 60, { font: LABEL, size: 12, align: 'left', track: 0.8, color: 'rgba(242,242,238,.75)' })
    text(ctx, g.bestEv ? `BEST ${Math.round(g.bestEv)} MPH` : 'BEST --', 16, 75, { font: DISPLAY, size: 13, align: 'left' })
  }
  if (!g.tee) tracker(ctx, { x: w - 76, y: 50, w: 68, pitches: g.pitches.slice(-6), hand: g.hand })
  // the spin, picked up out of his hand
  const p = g.pitch
  if (p && g.reveal != null && !g.tee && g.phase === 'flight') {
    const info = PITCH_INFO[p.type], a = C ? P(C, 0, ZONE.y1 + 0.17, PLATE_Z) : null
    if (a?.ok) { ctx.fillStyle = 'rgba(6,9,13,.82)'; rr(ctx, a.x - 34, a.y - 10, 68, 18, 3); ctx.fill(); ctx.fillStyle = info.col; ctx.fillRect(a.x - 34, a.y - 10, 3, 18); text(ctx, info.name, a.x + 1, a.y, { font: LABEL, size: 13, track: 1 }) }
  }
  // the radar after it's in: the speed on the board, the call
  if (!g.done && ((g.call && g.phase === 'call') || g.res)) {
    const c = g.call ?? { word: g.res?.word, good: !g.res?.out }
    const y = view.h - 196
    const word = c.word ?? ''
    ctx.font = `20px ${DISPLAY}`
    const tw = Math.max(110, ctx.measureText(word).width + 26)
    ctx.fillStyle = 'rgba(6,9,13,.86)'; rr(ctx, w / 2 - tw / 2, y - 16, tw, 32, 4); ctx.fill()
    ctx.fillStyle = c.good ? GOOD : c.word === 'FOUL' ? GOLD : '#f2f2ee'; ctx.fillRect(w / 2 - tw / 2, y + 13, tw, 3)
    text(ctx, word, w / 2, y + 1, { font: DISPLAY, size: 20 })
    if (p && !g.tee) text(ctx, `${PITCH_INFO[p.type].short} ${Math.round(p.mph)} MPH`, w / 2, y + 26, { font: LABEL, size: 12, color: 'rgba(242,242,238,.72)', track: 1 })
    else if (c.sub) text(ctx, c.sub, w / 2, y + 26, { font: LABEL, size: 12, color: 'rgba(242,242,238,.72)', track: 1 })
  }
  if (g.done && g.res) {
    const R = g.res
    if (R.ev) text(ctx, `${R.ev} MPH · ${R.la}° · ${R.dist} FT`, w / 2, view.h - 196, { font: LABEL, size: 14, track: 1, color: 'rgba(242,242,238,.8)' })
  }
  if (g.tee && g.done) radar(ctx, w / 2, view.h - 160, g.bestEv, { label: 'EXIT VELO', w: 120 })
  placeStamp(g.stamp, view)
  promptB(ctx, view, g)
  drawPads(ctx, view, g.ctl, { move: 'ZONE', S: 'CONTACT', P: 'POWER' }, !g.done && !g.res)
}
// ── The mob ─────────────────────────────────────────────────────────────────
// A walk-off or a home run: the plate cam. The hitter comes in (down the line from third on a home run, or just past
// first on a walk-off hit), the dugout's out and waiting, he jumps into them, the helmet goes up, they bounce; a
// walk-off gets the cooler over his head. The other side: off the field, heads down.
function drawMob(ctx, g, view, K, a, team) {
  const hr = g.celeb.hr, at = hr ? { x: 0, z: 0.4 } : { x: 21, z: 23 }
  const C = mobCam(view, at)
  staticPark(ctx, view, C, `mob${hr ? 'h' : '1'}`, { team: g.sit?.half === 'B' || !g.sit ? team : [view.colors.them, view.colors.themTrim ?? '#f4efe6'] })
  crowdRise(ctx, C, team, a + 1700, 4200)
  flashesB(ctx, C, a + 400, 11)
  const list = []
  let heroTop = null
  // the hero: in off the line, a leap on to the plate (or into them), then in the middle of it
  const from = hr ? { x: -6.5, z: 6.5 } : { x: 12, z: 12 }
  const k = prog(a, 0, 700)
  const hx = lerp(from.x, at.x, easeOut(k)), hz = lerp(from.z, at.z, easeOut(k))
  const leap = a > 600 && a < 900 ? Math.sin(prog(a, 600, 900) * Math.PI) * 0.35 : 0
  const bounce = a > 900 ? Math.abs(Math.sin((a - 900) / 170)) * 0.22 : 0
  const heroPose = a < 650 ? runB(a / 220, 1, { arms: a > 300 ? 'up' : null }) : a < 900 ? BP.jump : { ...BP.armsUp, tilt: 0.7 }
  const meLook = dressB(K.us, g.who.me ?? { number: 27, skin: '#8d5a3b' }, { front: true, helmet: a < 820, flap: -1, batGloves: [view.colors.trim, '#1a1d22'], word: g.sit?.us ?? '' })
  list.push({ z: hz, fn: () => { const p = baller(ctx, C, hx, hz, { ...heroPose, cap: a < 820 ? 1 : 0 }, meLook, { lift: leap + bounce, name: g.who.me?.name }); heroTop = p } })
  // the mob: in a ring round him, jumping, a hand on his helmet, one with the cooler on a walk-off
  const ring = [[-1.4, 0.9], [1.3, 1.1], [-0.9, -1.2], [1.0, -1.0], [-2.1, -0.2], [2.2, 0.2], [0.1, 1.9]]
  ring.forEach(([dx, dz], i) => {
    const x = at.x + dx, z = at.z + dz, delay = 200 + i * 70
    const j = a > delay ? Math.abs(Math.sin((a - delay) / (150 + i * 9))) * 0.3 : 0
    const pose = a < delay ? BP.clap : i % 3 === 0 ? BP.jump : i % 3 === 1 ? BP.armsUp : BP.roar
    const who = g.who.mates[i % 5] ?? { number: [5, 17, 22, 31, 7, 44, 2][i], skin: ['#5e3c22', '#f0c4a0', '#a87548', '#c09060', '#8d5a3b', '#f0c4a0', '#5e3c22'][i] }
    list.push({ z, fn: () => baller(ctx, C, x, z, pose, dressB(K.us, who, { front: dz < 0, noBat: true, word: g.sit?.us ?? '' }), { lift: j }) })
  })
  list.sort((p, q) => q.z - p.z)
  for (const it of list) it.fn()
  // the helmet in the air, end over end
  if (a > 820 && a < 2000) {
    const p = P(C, at.x + 0.3, 2.2 + (a - 820) / 1000 * 5 - ((a - 820) / 1000) ** 2 * 6, at.z), r = Math.max(2, 0.17 * (p.s || 0))
    if (p.ok) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((a - 820) / 90); ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, r + 1, r * 0.8 + 1, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = view.colors.us; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.8, 0, Math.PI, 0); ctx.fill(); ctx.restore() }
  }
  // the Gatorade bath, from behind him
  if (g.celeb.walkoff && heroTop?.ok) {
    const s = heroTop.s, hx2 = heroTop.x, hy2 = heroTop.y - 1.95 * s
    const pour = a - 1100
    if (pour > -500 && pour < 200) cooler(ctx, hx2 + 0.5 * s, hy2 - 0.25 * s, s, clamp((pour + 500) / 700, 0, 1))
    gatorade(ctx, hx2, hy2, s, pour)
  }
  placeStamp(g.stamp, view)
}
