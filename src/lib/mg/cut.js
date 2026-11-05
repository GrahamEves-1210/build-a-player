// Cut: defenders one at a time. He closes, he jabs one way, he commits. Go the other way after he commits
// and he goes by you. Go before and he mirrors you: his commit comes to the side you've moved to, so you
// have to cut all the way back. A jab sells it just like the real thing, the same step and the same reach,
// and from the second man on it's often a fake: the commit goes the other way, and a good one jabs twice.
// Press as often as you like; what counts is which side you're on when he gets there, and a late press
// hasn't got you there yet. Nothing is painted on the field: the tell is his body and his feet.
//   juke, juke-wr, juke-te   a ball carrier in the open field
//   tackle-angle             reversed: you're the tackler, press the side he finally cuts to
//   escape                   a real pocket: five on four, one rusher comes free at the QB
//   iso                      close up at the top of the key: cross him over when his hand comes for the ball
//   post-up                  on the low block, back to the basket, a spin for each touch
import { lanesMs } from '../minigames.js'
import { clamp, lerp, prog, outcome, rngOf, easeOut, easeIn, layer, manOf, paceOf, stage } from './kit.js'
import { tilt, untilt, ground, stands, floodlight, vignette, paintGrass, skinOf, athlete , cleanEdges } from './art.js'
import { paintFieldFlat, SL, SR } from './throw.js'
import { walk, put, action, fieldStage, paintNumbers, ballInAir, teamOf, castMen } from './read.js'
import { arenaCam, CRASH_CAM, dolly, arenaStage, manAt, POSE, RUN as RUN_F, tagAt, tagsDown, flyTo, dropThrough, hoopWith, AB } from './arena.js'
import { ballIn, easedState, easedPose, newPose, copyPose, mixPose, pose, project, smoothT, CLK, IN_HANDS, PT, FIG_FT, BALL_R, RIM_R, RIM_Y as RIM_FT } from './meter.js'

export const how = {
  escape: 'One rusher comes free. Wait till he really commits, then step away from him.',
  juke: "He'll sell it with a jab. Wait till he really commits, then cut the other way.",
  'juke-wr': "He'll sell it with a jab. Wait till he really commits, then cut the other way.",
  'juke-te': "He'll sell it with a jab. Wait till he really commits, then cut the other way.",
  'tackle-angle': 'Stay square through his jab. When he really cuts, go with him.',
  iso: "Cross when his hand comes for the ball. Too soon and he slides with you. Stay and he strips you.",
  'post-up': 'On the block, back to the rim. See which side he plays, spin to the other.',
}

const RUN = { skin: 'run', n: 4, floor: 590, yards: true, wait: 'WAIT FOR HIM', good: 'JUKED', bad: 'TACKLED', win: 'BROKE FREE', lose: 'BROUGHT DOWN', stampY: 0.3 }
const SETUP = {
  juke: RUN,
  'juke-wr': RUN,
  'juke-te': { ...RUN, big: true },
  'tackle-angle': { ...RUN, yards: false, rev: true, wait: 'STAY SQUARE', good: 'TACKLE', bad: 'MISSED', win: 'STOPPED', lose: 'GOT AWAY' },
  escape: { skin: 'pocket', n: 4, floor: 565, wait: 'WATCH THE RUSH', good: 'ESCAPED', bad: 'HIT', win: 'ON THE RUN', lose: 'SACKED', stampY: 0.3 },
  iso: { skin: 'court', wait: 'WATCH HIS HANDS', win: 'BUCKET', lose: 'NO LANE', stampY: 0.84 },
  'post-up': { skin: 'post', n: 3, floor: 570, wait: 'WATCH HIS SHOULDER', good: 'BUCKET', bad: 'WALLED OFF', win: 'BIG MAN', lose: 'SHUT DOWN', stampY: 0.84, beatOk: 1050, beatBad: 760, stampLate: 620 },
}
// The window each man gives, from the floor at grade 1, up with lanesMs. The grade buys the first men the
// most time; the late ones stay near the floor. In the open field and the pocket it takes three of four men and the jabs sell it, so the floor stays honest: real
// thumbs had far too long at 570, and the jabs do the rest.
const WINDOWS = [{ add: 50, per: 0.3 }, { add: 25, per: 0.22 }, { add: 0, per: 0.14 }, { add: 0, per: 0.1 }]
// all three to win leaves no room for one tight one
const WINDOWS_ALL = [{ add: 130, per: 0.25 }, { add: 110, per: 0.22 }, { add: 100, per: 0.2 }]
const CUT_MS = 110     // from the middle to a full side: from one side to the other takes twice that
const CLEAR = 0.35     // how far over he must be when contact comes
const REACT_FLOOR = 420
const FAKE = [0.3, 0.75, 0.8, 0.85]   // how likely each man is to fake
// Who's who on the field, from the real rosters (all null in practice: each man keeps the scene's own look).
// With the ball, you're the man at your spot; the men who come at you are their secondary, in the open field.
// As the tackler, you're the safety: a different man with the ball each time.
const CARRIER = { juke: ['rb', 0], 'juke-wr': ['wr', 0], 'juke-te': ['te', 0] }
const RUNNERS = [['rb', 0], ['wr', 0], ['wr', 1], ['te', 0]]
function fieldWho(game, S, cast, men, pos) {
  const bare = m => m && { number: m.number, skin: m.skin }
  if (S.skin === 'pocket') return { me: manOf(cast, 'us', 'qb', 0), ol: [0, 1, 2, 3, 4].map(i => bare(manOf(cast, 'us', 'ol', i))), dl: [0, 1, 2, 3].map(i => (cast?.them?.dl?.length > i ? bare(manOf(cast, 'them', 'dl', i)) : null)) }
  if (S.skin !== 'run') return null
  // (a borrowed game: the man playing it, at his own position)
  const mine = pos && cast?.us?.[pos]?.length && (S.rev ? pos === 'dl' : ['rb', 'wr', 'te'].includes(pos)) ? [pos, 0] : S.rev ? ['db', 0] : CARRIER[game] ?? CARRIER.juke
  men.forEach((d, i) => {
    const [gr, at] = S.rev ? RUNNERS[i % RUNNERS.length] : ['db', i]
    d.man = manOf(cast, 'them', gr, at)
    d.pace = paceOf(cast, 'them', gr, at)                                    // his feet, sideways
    d.run = S.rev ? d.pace : paceOf(cast, 'us', mine[0], mine[1])            // how fast the man with the ball is going
  })
  const bareMan = m => (m ? { number: m.number, skin: m.skin } : null)
  const fights = cast ? {
    us: [['ol', 0], ['wr', 1], ['te', 0], ['ol', 1]].map(([gr, at]) => bareMan(manOf(cast, S.rev ? 'them' : 'us', gr, at))),
    them: [['db', 1], ['db', 2], ['dl', 0], ['db', 3]].map(([gr, at]) => bareMan(manOf(cast, S.rev ? 'us' : 'them', gr, at))),
  } : null
  return { me: manOf(cast, 'us', mine[0], mine[1]), fights }
}
const windowMs = (S, v, k, all) => { const w = (all ? WINDOWS_ALL : WINDOWS)[k] ?? WINDOWS[3]; return S.floor + w.add + (lanesMs(v) - lanesMs(1)) * w.per }

export function make({ v, seed, def, game, pos = null, cast = null }) {
  const S = SETUP[game] ?? RUN
  if (game === 'iso') return makeIso({ v, seed, def }, S)
  const r = rngOf(seed)
  const n = S.n, need = def?.need ?? (n === 4 ? 3 : 2), all = need >= n
  const men = Array.from({ length: n }, (_, k) => {
    const fake = r() < (FAKE[k] ?? 0.8)
    const twice = fake && k > 1 && r() < 0.45
    const lean = r() < 0.5 ? -1 : 1
    // his jabs: the same step and the same time whether he means it or not
    const dur = () => 190 + r() * 150
    const jabs = twice ? [{ side: -lean, dur: dur() }, { side: lean, dur: dur() }] : [{ side: lean, dur: dur() }]
    const leanAt = 300 + (k === 0 ? 160 : 0) + r() * 340
    const total = jabs.reduce((s, j) => s + j.dur, 0)
    return { at: 0, lean: jabs[0].side, jabs, jab: -1, leanAt, leanDur: total, lungeAt: leanAt + total, planned: fake ? -lean : lean, T: windowMs(S, v, k, all), lunge: 0, commit: 0, res: null, ph: r() * 6.28, yd: 7 + Math.floor(r() * 8) }
  })
  const g = {
    t: 0, game, zones: 'lr', pads: ['LEFT', 'RIGHT'], padLit: null, litAt: -999, fx: [], done: null, outro: 1500, stamp: null, later: null,
    S, men, i: 0, cur: men[0], rev: !!S.rev, who: fieldWho(game, S, cast, men, pos),
    side: 0, px: 0, dist: 0, yards: 0, ball: 1, yard0: Math.floor(r() * 236),
    // what his body is showing: all a player (or a bot) knows
    tell: { lean: 0, lunge: 0 },
    hud: { prompt: S.wait, dots: men.map(() => null) },
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110) g.padLit = null
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      // the run: his feet, the ball, the field
      const step = dt / CUT_MS
      g.px = g.side > g.px ? Math.min(g.side, g.px + step) : Math.max(g.side, g.px - step)
      g.ball = lerp(g.ball, g.side || g.ball, 1 - Math.exp(-dt / 50))
      const d = g.cur, down = d.res && !d.res.ok && !g.rev
      g.dist += dt * (down ? 0.05 : 0.34 * (d.run ?? 1))
      if (d.res) {
        if (!g.done && g.t - d.res.at >= d.res.beat) next()
        return
      }
      const age = g.t - d.at
      if (!d.lunge && age >= d.leanAt) {
        // which jab he's on
        let at = d.leanAt, j = 0
        while (j < d.jabs.length - 1 && age >= at + d.jabs[j].dur) { at += d.jabs[j].dur; j++ }
        d.jab = j; d.lean = d.jabs[j].side; d.jabAt = at
      }
      g.tell.lean = !d.lunge && age >= d.leanAt ? d.lean : 0
      if (!d.lunge && age >= d.lungeAt) {
        // the mirror: if you've gone already, that's where he goes
        const went = g.side
        d.lunge = went ? (g.rev ? -went : went) : d.planned
        d.commit = g.t
        d.early = !!went
        g.tell.lunge = d.lunge; g.tell.lean = 0
      }
      if (d.lunge && g.t >= d.commit + d.T) resolve()
    },
    input(a) {
      if (a.kind !== 'down') return
      const side = a.zone === 'L' ? -1 : a.zone === 'R' ? 1 : 0
      if (!side) return
      g.padLit = side < 0 ? 0 : 1; g.litAt = g.t
      const d = g.cur
      if (g.done || d.res) return
      if (side !== g.side) g.fx.push('tap')
      g.side = side
      if (d.lunge) d.pressed = g.t
    },
  }
  function resolve() {
    const d = g.cur, want = g.rev ? d.lunge : -d.lunge
    const ok = Math.sign(g.px) === want && Math.abs(g.px) >= CLEAR
    const ms = (d.pressed ?? d.commit + d.T) - d.commit
    d.res = { ok, want, at: g.t, beat: ok ? S.beatOk ?? 560 : S.beatBad ?? 700, late: !ok && (d.pressed == null || g.side === want), score: ok ? clamp(1 - Math.max(0, ms - REACT_FLOOR) / Math.max(1, d.T - REACT_FLOOR), 0.4, 1) : 0 }
    g.tell.lunge = 0; g.tell.lean = 0
    g.hud.dots[g.i] = ok
    g.hud.prompt = null
    g.fx.push(ok ? 'tap' : 'pop', ok ? 'h:light' : 'h:heavy')
    g.yards += ok ? d.yd : 1
    g.stamp = { text: S[ok ? 'good' : 'bad'], good: ok, at: g.t + (ok ? S.stampLate ?? 0 : 0), ms: 420, size: S.skin === 'run' || S.skin === 'pocket' ? 46 : 38 }
    if (men.every(m => m.res)) {
      const made = men.filter(m => m.res.ok).length
      const avg = men.reduce((s, m) => s + m.res.score, 0) / n
      const hit = made >= need
      const misses = men.filter(m => !m.res.ok), outs = misses.filter(m => m.res.late).length
      g.done = outcome(hit ? Math.max(avg, 0.5) : Math.min(avg, 0.45), hit, `${made} of ${n}`, { made, of: n }, !hit && outs > 0 && outs >= misses.length)
      g.later = { text: hit ? (S.yards ? `${g.yards} YARDS` : S.win) : S.lose, good: hit, at: g.t + d.res.beat - 80, size: S.skin === 'run' || S.skin === 'pocket' ? 46 : 44 }
    }
  }
  function next() {
    g.i++
    g.cur = men[g.i]
    g.cur.at = g.t
    g.side = 0
    g.stamp = null
    g.hud.prompt = S.wait
  }
  return g
}

// ── Drawing helpers ─────────────────────────────────────────────────────────
const LANE = 84
// where on the field a man's feet stay, so he's above the thumbs: the same spot on the screen at any size
const nearY = view => untilt(view, 180, view.h - 172).y
// how far down the field he is: he arrives exactly at contact, at a speed the screen can show
const NEXT_Y = 66   // where the next man waits, down the field
function closing(d, g, py) {
  const s = Math.min(0.46, (py - 106) / (d.T + d.leanDur * 0.8))
  return Math.max(lerp(NEXT_Y, 95, prog(g.t, d.at, d.at + 320)), py - 40 - (d.at + d.lungeAt + d.T - (d.res ? d.res.at : g.t)) * s)
}
// how far over he should be right now. A jab goes most of the way a commit does at first.
function wantShift(d, g, lane = LANE) {
  const t = d.res ? d.res.at : g.t, age = t - d.at
  if (d.lunge) return d.lunge * (lane + 4) * easeOut(clamp((t - d.commit) / (d.T * 0.8), 0, 1))
  if (age < d.leanAt) return Math.sin(g.t / 170 + d.ph) * 4
  return d.lean * (lane * 0.42)
}
// the man moves like a man: he goes where he wants at a footballer's speed, no snapping between jabs
function shiftOf(d, g, lane = LANE) {
  const want = wantShift(d, g, lane), dt = Math.min(60, g.t - (d.st ?? g.t))
  d.st = g.t
  const cap = dt * 0.55 * (d.pace ?? 1), gap = want - (d.sx ?? 0)
  d.sx = (d.sx ?? 0) + clamp(gap, -cap, cap)
  return d.sx
}
const sideName = s => (s < 0 ? 'left' : 'right')
// the tackler, by what his body's doing: running at you, then breaking down and reaching the way he's going.
// The jab and the commit look the same at first: only time tells them apart.
function closerOpts(g, d) {
  const t = d.res ? d.res.at : g.t, age = t - d.at, side = d.lunge || (age >= d.leanAt ? d.lean : 0)
  if (side) return { dir: 'down', pose: 'wrap', step: null }
  return { dir: 'down', pose: null, step: (Math.floor(g.t / 48) % 8) / 2 }
}

export function draw(ctx, g, view) {
  if (g.stamp && g.stamp.y == null) g.stamp.y = view.h * g.S.stampY
  if (g.later && g.later.y == null) g.later.y = view.h * g.S.stampY
  const skin = g.S.skin
  if (skin === 'pocket') drawPocket(ctx, g, view)
  else if (skin === 'court') drawIso(ctx, g, view)
  else if (skin === 'post') drawPost(ctx, g, view)
  else drawRun(ctx, g, view)
  if (skin !== 'court' && skin !== 'post') vignette(ctx, view)
}

// ── The open field ──────────────────────────────────────────────────────────
// the grass repeats every screen, so it can run forever: eight bands, the numbers going 30 40 50 40 and
// round again, and the seam mid-band, where there's no line or number for it to swallow
const RUN_BANDS = 8, RUN_SCROLL = 0.75
const paintRun = (f, view) => {
  const band = view.h / RUN_BANDS, L = -view.w * 0.25, W = view.w * 1.5
  for (let i = 0; i < RUN_BANDS; i++) { f.fillStyle = i % 2 ? '#1e6e39' : '#237a41'; f.fillRect(L, i * band, W, band + 1) }
  let seed = 11
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 5000; i++) { f.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)'; f.fillRect(L + rnd() * W, rnd() * view.h, 1 + rnd() * 2.2, 0.8) }
  f.fillStyle = 'rgba(255,255,255,.55)'
  const tick = band / 5
  for (let y = tick / 2; y < view.h; y += tick) for (const x of [150, 210]) f.fillRect(x - 4, y, 8, 1.3)
}
// both benches, going by with the field, far ones first
const BENCH = [0.2, 0.27, 0.44, 0.62, 0.8]
const B = { color: '', trim: '', pants: '', skin: '', dir: 'up', pose: 'ready', size: 0.72 }
function runBenches(ctx, view, scroll, c, them) {
  const h = view.h, L = BENCH.length, wrap = y => ((y + scroll) % h + h) % h, top = h * 0.1   // (nobody on the far boards)
  let first = 0
  for (let n = 0; n < L; n++) if (wrap(h * BENCH[n]) < wrap(h * BENCH[first])) first = n
  B.color = c.us; B.trim = c.trim; B.pants = c.trim
  for (let i = 0; i < L; i++) {
    const n = (first + i) % L
    const y = wrap(h * BENCH[n])
    if (y < top) continue
    B.skin = skinOf(n * 3); B.dir = 'right'   // (each sideline watches the field)
    athlete(ctx, view, -14 - ((n * 7) % 3) * 8, y, B)
  }
  const at = n => wrap(h * (1.02 - BENCH[n]) - 40)
  first = 0
  for (let n = 0; n < L; n++) if (at(n) < at(first)) first = n
  B.color = them.color; B.trim = them.trim; B.pants = them.trim
  for (let i = 0; i < L; i++) {
    const n = (first - i + L) % L
    const y = at(n)
    if (y < top) continue
    B.skin = skinOf(n * 5 + 1); B.dir = 'left'
    athlete(ctx, view, view.w + 14 + ((n * 5) % 3) * 8, y, B)
  }
}
const CARRIER_NUM = { juke: 28, 'juke-wr': 11, 'juke-te': 87 }
const RUN_SIZE = 1.42
// The far end of the field: what he's running at. It comes up as the run goes on.
function farEnd(ctx, view, g, color0) {
  const color = view.field?.end ?? color0
  const n = g.men.length, done = g.i + (g.cur.res ? 1 : clamp((g.t - g.cur.at) / 2000, 0, 0.9))
  const goal = g.rev ? 44 : lerp(44, 120, clamp(done / n, 0, 1)), back = Math.max(0, goal - 40)
  const a = tilt(view, SL, goal), b = tilt(view, SR, goal), e = tilt(view, SL, back), f = tilt(view, SR, back)
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(f.x, f.y); ctx.lineTo(e.x, e.y); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fill()
  ctx.fillStyle = '#f5f7f3'; ctx.fillRect(a.x, a.y - 1, b.x - a.x, Math.max(1.6, 3 * a.g))
  // the posts, at the back of it
  const q = tilt(view, 180, back), k = q.g * 1.5, base = q.y, bar = base - 38 * k, half = 30 * k
  ctx.strokeStyle = '#f2d21f'; ctx.lineCap = 'butt'; ctx.lineWidth = Math.max(1.4, 2.6 * k)
  ctx.beginPath(); ctx.moveTo(q.x, base); ctx.lineTo(q.x, bar); ctx.moveTo(q.x - half, bar); ctx.lineTo(q.x + half, bar)
  ctx.moveTo(q.x - half, bar); ctx.lineTo(q.x - half, bar - 44 * k); ctx.moveTo(q.x + half, bar); ctx.lineTo(q.x + half, bar - 44 * k); ctx.stroke()
}
// the rest of the play, out wide and going by: a block being held on each side
const FIGHTS = [[-132, 0.2], [128, 0.7]]
function fights(view, g, us, them, scroll) {
  const h = view.h, M = g.who.fights
  FIGHTS.forEach(([dx, at], i) => {
    const y = (((h * at + scroll) % h) + h) % h
    if (y < h * 0.12) return
    const b = Math.sin(g.t / 170 + i * 2) * 2
    put(180 + dx + b, y, them, { dir: 'down', pose: 'block', skin: skinOf(i + 2), number: M?.them[i]?.number ?? 21 + i * 6, size: RUN_SIZE, ...(M?.them[i] ?? null), name: null })
    put(180 + dx - b, y + 15, us, { dir: 'up', pose: 'block', skin: skinOf(i + 7), number: M?.us[i]?.number ?? 70 + i * 3, size: RUN_SIZE, ...(M?.us[i] ?? null), name: null })
  })
}
function drawRun(ctx, g, view) {
  const c = view.colors, us = teamOf(c, 0), them = teamOf(c, 1), d = g.cur, res = d.res, since = res ? g.t - res.at : -1
  // nothing but field
  ctx.fillStyle = '#1e6e39'; ctx.fillRect(0, 0, view.w, view.h)
  const scroll = g.dist * RUN_SCROLL
  ground(ctx, view, paintRun, 'cut-run', scroll, 60, true)
  const num = CARRIER_NUM[g.game] ?? 28, me = g.who.me, man = d.man, go = d.run * 0.62
  const py = nearY(view), x = 180 + g.px * LANE, size = RUN_SIZE
  const y0 = closing(d, g, py), dx0 = 180 + shiftOf(d, g)
  const fall = res && !res.ok !== g.rev ? clamp((since - 70) / 300, 0, 1) : 0   // (whoever's going down)
  const moving = Math.abs(g.side - g.px) > 0.04
  const lean = moving ? Math.sign(g.side - g.px) * 0.2 : 0
  // the man closing: he shows it in his body, more as he commits
  const age = (res ? res.at : g.t) - d.at
  const hisLean = d.lunge ? d.lunge * 0.14 : age >= d.leanAt ? d.lean * 0.06 : 0
  fights(view, g, us, them, scroll)
  if (!g.rev) {
    if (res?.ok) {
      // he goes for it, gets nothing but air and goes down the way he dived, and the run leaves him behind
      const f = clamp(since / 200, 0, 1), dive = clamp((since - 40) / 240, 0, 0.92)
      put(dx0 + d.lunge * f * 34, y0 + easeOut(f) * 50 + clamp(since - 120, 0, 500) * go, them, { dir: 'down', pose: 'wrap', fall: dive, fallX: d.lunge, skin: skinOf(3), number: 52, size, ...man })
      put(x, py, us, { dir: 'up', step: (Math.floor(g.dist / 7) % 8) / 2, carry: true, lean, skin: skinOf(6), number: num, size, ...me })
    } else if (res) {
      // he got there: arms round him, and they go down together the way the hit took them
      const fx = Math.sign(x - dx0) || d.lunge
      const f = clamp(since / 100, 0, 1)
      put(x, py, us, { dir: 'up', carry: true, fall, fallX: fx, skin: skinOf(6), number: num, size, ...me })
      put(lerp(dx0, x - fx * 14, f), lerp(y0, py - 6, f), them, { dir: 'down', pose: 'wrap', fall, fallX: fx, z: py + 1, skin: skinOf(3), number: 52, size, ...man })
    } else {
      put(dx0, y0, them, { ...closerOpts(g, d), lean: hisLean, skin: skinOf(3), number: 52, size, ...man })
      put(x, py, us, { dir: 'up', step: (Math.floor(g.dist / 7) % 8) / 2, carry: true, lean, skin: skinOf(6), number: num, size, ...me })
    }
  } else {
    // you're the tackler: he has the ball, tucked, and he's the one coming
    if (res?.ok) {
      const fx = d.lunge, f = clamp(since / 100, 0, 1)
      put(dx0, y0, them, { dir: 'down', carry: true, fall, fallX: fx, skin: skinOf(3), number: 28, size, ...man })
      put(lerp(x, dx0 - fx * 12, f), lerp(py, y0 + 8, f), us, { dir: 'up', pose: 'wrap', fall, fallX: fx, z: y0 + 1, skin: skinOf(6), number: 26, size, ...me })
    } else if (res) {
      // he dives at air, goes down, and the man's gone by
      const dive = clamp((since - 40) / 240, 0, 0.92)
      put(dx0 + d.lunge * since * 0.04, y0 + Math.min(since, 620) * go, them, { dir: 'down', step: (Math.floor(g.t / 48) % 8) / 2, carry: true, skin: skinOf(3), number: 28, size, ...man })
      put(x, py, us, { dir: 'up', pose: 'wrap', fall: dive, fallX: Math.sign(x - dx0) || 1, skin: skinOf(6), number: 26, size, ...me })
    } else {
      const o = closerOpts(g, d)
      put(dx0, y0, them, { dir: o.dir, step: o.pose ? (Math.floor(g.t / 48) % 8) / 2 : o.step, carry: true, lean: hisLean, skin: skinOf(3), number: 28, size, ...man })
      put(x, py, us, { dir: 'up', step: moving ? Math.floor(g.t / 80) % 4 : null, pose: moving ? null : 'ready', lean, skin: skinOf(6), number: 26, size, ...me })
    }
  }
  action(ctx, view)
}

// ── The pocket ──────────────────────────────────────────────────────────────
// Five linemen against four down, the QB behind them. They're all in the fight, and it stays a fight.
// One rusher beats his man and comes free at the QB, round the side he's won on: that's who you step
// away from. Before that, one of them rocking his man is all there is to see, and he can be a fake.
const OL_SPACE = 42
const RUSH_X = [-63, -21, 21, 63]
const POCKET_STEP = 44   // how far the QB slides, and how far the free man's rush aims off centre: a step, not a dash
const POCKET_Y = 10.6    // Sneak's camera
const OL_NUM = [71, 64, 55, 66, 77], DL_NUM = [94, 97, 91, 99]
function paintPocket(f, view) {
  const los = Math.round(pocketLine(view))
  paintFieldFlat(f, view, los - 50 * POCKET_Y, POCKET_Y, view.colors.us)
  f.fillStyle = '#3f86ff'; f.fillRect(8, los - 1.6, view.w - 16, 3.2)
  f.fillStyle = '#f7d64a'; f.fillRect(8, los - 10 * POCKET_Y - 2, view.w - 16, 4)
}
const pocketLine = view => nearY(view) - 84
function drawPocket(ctx, g, view) {
  const c = view.colors, us = teamOf(c, 0), them = teamOf(c, 1), d = g.cur, res = d.res, since = res ? g.t - res.at : -1
  fieldStage(ctx, view, 'escape', paintPocket)
  const py = nearY(view), line = pocketLine(view), LS = 1.12, me = g.who.me
  const t = res ? res.at : g.t, age = t - d.at
  const go = d.lunge ? clamp((t - d.commit) / d.T, 0, 1) : 0
  // which of the four: on the side he's working. A left-side man wins left, a right-side man right.
  const inner = d.ph < 3.14
  const idxOf = sd => (sd < 0 ? (inner ? 1 : 0) : inner ? 2 : 3)
  const busy = age >= d.leanAt ? idxOf(d.lunge || d.lean) : -1, free = d.lunge ? idxOf(d.lunge) : -1
  const bump = i => Math.sin(g.t / (190 + i * 17) + i * 1.9) * 2.5
  for (let i = 0; i < 4; i++) {
    if (i === free) continue
    const lean = i === busy && !d.lunge ? d.lean * 8 * easeOut(prog(age, d.jabAt ?? d.leanAt, (d.jabAt ?? d.leanAt) + 110)) : 0
    put(180 + RUSH_X[i] + bump(i) + lean, line - 12 + Math.abs(bump(i + 2)), them, { dir: 'down', pose: 'block', skin: skinOf(i + 2), number: DL_NUM[i], size: LS, ...g.who.dl[i] })
  }
  for (let i = -2; i <= 2; i++) put(180 + i * OL_SPACE + bump(i + 3) * 0.7, line + 12 - Math.abs(bump(i + 5)) * 0.5, us, { dir: 'up', pose: 'block', skin: skinOf(i + 9), number: OL_NUM[i + 2], size: LS, ...g.who.ol[i + 2] })
  const x = 180 + g.px * POCKET_STEP
  // the man who's come free: past his blocker and at the QB
  let rx = 180 + RUSH_X[Math.max(0, free)], ry = line - 12
  if (free >= 0) {
    const ex = 180 + d.lunge * (POCKET_STEP + 2), ey = py - 34
    rx = lerp(rx + d.lunge * 8 * Math.min(1, go * 3), ex, easeIn(go)); ry = lerp(line + 26, ey, go) - (1 - Math.min(1, go * 6)) * 40
  }
  const fall = res && !res.ok ? clamp((since - 70) / 300, 0, 1) : 0
  const moving = Math.abs(g.side - g.px) > 0.04
  const thrown = g.done?.hit && since > 300
  if (res && !res.ok) {
    const fx = Math.sign(x - rx) || d.lunge, f = clamp(since / 100, 0, 1)
    put(x, py, us, { dir: 'up', carry: true, fall, fallX: fx, skin: skinOf(9), number: 7, size: LS, ...me })
    put(lerp(rx, x - fx * 11, f), lerp(ry, py - 5, f), them, { dir: 'down', pose: 'wrap', fall, fallX: fx, z: py + 1, skin: skinOf(free + 2), number: DL_NUM[free], size: LS, ...g.who.dl[free] })
  } else {
    if (free >= 0) {
      if (res) {
        // whiffs: on his feet, carried through where the QB was, and on by
        const f = clamp(since / 220, 0, 1)
        put(rx + d.lunge * f * 14, ry + easeOut(f) * 26 + clamp(since - 120, 0, 500) * 0.3, them, { dir: 'down', step: Math.floor(g.t / 90) % 4, skin: skinOf(free + 2), number: DL_NUM[free], size: LS, ...g.who.dl[free] })
      } else put(rx, ry, them, { dir: 'down', pose: 'arms-up', step: Math.floor(g.t / 90) % 4, skin: skinOf(free + 2), number: DL_NUM[free], size: LS, ...g.who.dl[free] })
    }
    put(x, py, us, { dir: moving ? sideName(g.side - g.px) : 'up', step: moving ? Math.floor(g.t / 80) % 4 : null, pose: null, carry: !thrown, skin: skinOf(9), number: 7, size: LS, ...me })
  }
  action(ctx, view)
  // the end: he throws it on the run
  if (thrown) {
    const f = clamp((since - 300) / 520, 0, 1)
    if (f < 1) ballInAir(ctx, view, x, lerp(py, line - 170, f), 34 + Math.sin(f * Math.PI) * 70, 0)
  }
}

// ── The court ───────────────────────────────────────────────────────────────
// the stage's lights, on a floor that moves: painted once, laid over it
const lights = new Map()
function lightsOver(ctx, view) {
  const id = `${view.h}|${view.px}|${stage.tag}`
  let c = lights.get(id)
  if (!c && typeof document !== 'undefined') {
    c = document.createElement('canvas'); c.width = Math.round(view.w * view.px); c.height = Math.round(view.h * view.px)
    const x = c.getContext('2d'); x.scale(view.px, view.px); floodlight(x, view)
    lights.set(id, c)
  }
  if (c) ctx.drawImage(c, 0, 0, view.w, view.h)
}

// ── Iso: a crossover, close up ──────────────────────────────────────────────
// Two men at the top of the key, arm's length apart, the camera low and tight. He's on a low dribble in
// one hand and the man on him is mirroring, sat down, hands working. The man has to come for the ball
// sooner or later: his weight goes onto the foot on the ball's side and that hand comes down at it. Cross
// to the other hand before it gets there and you're gone that way. Stay and it's a strip. Cross while he's
// balanced, or on a shoulder fake, and he slides with you and cuts you off. Three in a row, each a step
// closer and each with less time, and his ankles go: he's on his heels, and it's a pull-up at the rim.
const ISO_T = [1.08, 1, 0.94]
const isoWindow = (v, k) => (600 + (lanesMs(v) - lanesMs(1)) * 0.25) * ISO_T[k]
function makeIso({ v, seed, def }, S) {
  const r = rngOf(seed), n = 3, need = def?.need ?? 3
  const beats = Array.from({ length: n }, (_, k) => {
    // the wait; then his shoulder fakes, if any; then the real reach. Same start every time.
    let t = (k === 0 ? 620 : 380) + r() * 420
    const count = k === 0 ? (r() < 0.25 ? 1 : 0) : k === 1 ? (r() < 0.7 ? 1 : 0) : 1 + (r() < 0.4 ? 1 : 0)
    const fakes = []
    for (let i = 0; i < count; i++) { const dur = 190 + r() * 90; fakes.push({ at: t, dur }); t += dur + 170 + r() * 170 }
    return { at: 0, fakes, reachAt: t, T: isoWindow(v, k), res: null }
  })
  const g = {
    t: 0, game: 'iso', iso: true, zones: 'lr', pads: ['LEFT', 'RIGHT'], padLit: null, litAt: -999, fx: [], done: null, outro: 1900, stamp: null, later: null,
    S, beats, i: 0, cur: beats[0], hand: r() < 0.5 ? -1 : 1, crossAt: -1e9, crossFrom: 1,
    made: 0,
    // what his body is showing: all a player (or a bot) knows
    tell: { shade: 0, reach: 0 },
    hud: { prompt: S.wait, dots: beats.map(() => null) },
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110) g.padLit = null
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      const b = g.cur
      if (b.res) {
        if (!g.done && g.t - b.res.at >= b.res.beat) next()
        return
      }
      const age = g.t - b.at
      g.tell.shade = b.fakes.some(f => age >= f.at && age < f.at + f.dur) ? g.hand : 0
      g.tell.reach = age >= b.reachAt ? g.hand : 0
      if (age >= b.reachAt + b.T) settle('strip', 0)
    },
    input(a) {
      if (a.kind !== 'down') return
      const side = a.zone === 'L' ? -1 : a.zone === 'R' ? 1 : 0
      if (!side) return
      g.padLit = side < 0 ? 0 : 1; g.litAt = g.t
      const b = g.cur
      if (g.done || b.res) return
      // the ball's already in that hand: that's a hesitation, and it costs nothing
      if (side === g.hand) { g.fx.push('h:light'); return }
      g.crossFrom = g.hand; g.hand = side; g.crossAt = g.t
      g.fx.push('tap')
      const age = g.t - b.at
      if (age >= b.reachAt) settle('cross', age - b.reachAt)
      else settle('cutoff', 0)
    },
  }
  function settle(kind, ms) {
    const b = g.cur, ok = kind === 'cross', last = g.i === n - 1
    if (ok) g.made++
    b.res = { kind, ok, at: g.t, beat: ok ? 430 : 820, side: g.hand, score: ok ? clamp(1 - Math.max(0, ms - REACT_FLOOR) / Math.max(1, b.T - REACT_FLOOR), 0.4, 1) : 0 }
    g.tell.shade = 0; g.tell.reach = 0
    g.hud.dots[g.i] = ok
    g.hud.prompt = null
    g.fx.push(ok ? 'swoosh' : 'pop', ok ? 'h:light' : 'h:heavy')
    if (!ok) g.stamp = { text: kind === 'strip' ? 'STRIPPED' : 'CUT OFF', good: false, at: g.t, ms: 560, size: 38 }
    if (last) {
      const hit = g.made >= need, clean = hit && ok
      const avg = beats.reduce((s, m) => s + m.res.score, 0) / n
      const missed = beats.filter(m => !m.res.ok), outs = missed.filter(m => m.res.kind === 'strip').length
      g.done = outcome(hit ? Math.max(avg, 0.5) : Math.min(avg, 0.45), hit, `${g.made} of ${n}`, { made: g.made, of: n }, !hit && outs > 0 && outs >= missed.length)
      g.clean = clean
      g.later = { text: clean ? 'ANKLES' : hit ? S.win : S.lose, good: hit, at: g.t + (clean ? 240 : 760), ms: clean ? 620 : 0, size: 46 }
      if (clean) g.then = { text: 'DUNK', good: true, at: g.t + 1150, size: 46 }
    }
  }
  function next() {
    g.i++
    g.cur = beats[g.i]
    g.cur.at = g.t
    g.stamp = null
    g.hud.prompt = S.wait
  }
  return g
}
const ISO_NEAR = 12                  // feet from the lens to him: Crash the Glass's distance, so he's that size
const ISO_US = -1.5, ISO_D = 1.5     // and like the two bigs there, he's left of the rim's line and his man's right of it
const ISO_LAST = 14.4                // how far from the rim he's got by the last crossover
const FT_UNITS = 14.4                // (the mirror's distances below are in these, to the foot)
const BOUNCE = 400   // ms, floor to hand and back
const ISO_ME = easedState(), ISO_HIM = easedState(), MINE = newPose()
// the dunk, from behind: the ball hand straight up over the rim, the other arm down and out for balance
const DUNK_AT = 640, DUNK_HANG = 150, DUNK_FALL = 240, DUNK_HAND = 122
const P_DUNK = pose({ hy: 49, fFx: 8, fBx: -8, fFy: 2, fBy: 7, hFx: 6, hFy: DUNK_HAND, hBx: -22, hBy: 80 })
function drawIso(ctx, g, view) {
  const c = view.colors, us = teamOf(c, 0), them = teamOf(c, 1), b = g.cur, res = b.res, since = res ? g.t - res.at : -1
  smoothT(g)
  if (g.then && g.t >= g.then.at) { g.stamp = g.then; g.then = null }
  // he gets a step closer every time he beats him, and we come with him
  const before = g.made - (res?.ok ? 1 : 0)
  const fy = 27 - 4.2 * (before + (res?.ok ? easeOut(clamp((since - 60) / 300, 0, 1)) : 0))
  const G = g.isoG && g.isoG.h === view.h ? g.isoG : (g.isoG = arenaCam(view.h, { ...CRASH_CAM(view.h), D: ISO_LAST + ISO_NEAR }))
  dolly(G, fy + ISO_NEAR)
  arenaStage(ctx, view, G, `iso-${view.h}-${fy.toFixed(2)}`, g.fyLast !== fy)
  g.fyLast = fy
  const cam = G.cam, zMe0 = -fy
  const clean = g.done && g.clean, goT = clean ? since - 240 : -1
  // where the two of them are. They're at arm's length, and he mirrors.
  const m = g.isoM ?? (g.isoM = { x: 0, d: 0, t: g.t })
  const dt = Math.min(60, g.t - m.t); m.t = g.t
  const hand = g.hand
  const wantX = res?.ok ? hand * 30 : res?.kind === 'cutoff' ? hand * 16 : 0
  const cap = dt * 0.34
  m.x += clamp(wantX - m.x, -cap, cap)
  let dWant = m.x * 0.82
  if (res?.ok) dWant = -hand * 22                                    // his hand went for the ball: he's going the other way
  else if (res?.kind === 'cutoff') dWant = hand * 30                 // he's slid with you, and he's in front
  else if (res?.kind === 'strip') dWant = hand * 22
  else if (g.tell.reach) dWant = hand * 24 * easeOut(clamp((g.t - b.at - b.reachAt) / 150, 0, 1))
  else if (g.tell.shade) dWant = hand * 5
  const dCap = dt * 0.3
  m.d += clamp(dWant - m.d, -dCap, dCap)
  let x = ISO_US + m.x / FT_UNITS, z = zMe0
  const gap = lerp(5.6, 4.3, (before + (res?.ok ? 1 : 0)) / 3)
  const dx = ISO_D + m.d / FT_UNITS, dz = zMe0 + gap
  // him: the man with the ball, back to us
  const sinceCross = g.t - g.crossAt, crossing = sinceCross < 170
  const ph = (g.t % BOUNCE) / BOUNCE, top = Math.abs(Math.cos(ph * Math.PI))    // 1 at his hand, 0 on the floor
  let P0 = crossing ? POSE.dribC : hand < 0 ? POSE.dribL : POSE.dribR, jump = 0
  copyPose(P0, MINE)
  if (!crossing && !(clean && goT > 0)) {
    if (hand < 0) { MINE.hBy = 24 + top * 13 } else { MINE.hFy = 24 + top * 13 }
  }
  if (clean && goT > 0) {
    // past him and up at the rim: he gets there as the ball hand does, and hangs on it a moment
    const f = clamp(goT / DUNK_AT, 0, 1)
    x = lerp(x, -P_DUNK.hFx / FIG_FT, easeOut(f)); z = lerp(zMe0, -RIM_R - 0.3, easeOut(f))
    if (goT < 300) copyPose(RUN_F[Math.floor(goT / 60) % 4], MINE)
    else {
      // how high his hand has to go to be at the iron, through this lens, from where he's standing
      project(cam, 0, RIM_FT + 0.1, -RIM_R)
      const ironY = PT.y
      project(cam, x, 0, z)
      const need = (PT.y - ironY) / (PT.k / FIG_FT) - DUNK_HAND
      const fall = prog(goT, DUNK_AT + DUNK_HANG, DUNK_AT + DUNK_HANG + DUNK_FALL)
      jump = need * easeOut(prog(goT, 300, DUNK_AT)) * (1 - fall * fall)
      mixPose(POSE.gather, P_DUNK, clamp((goT - 300) / 170, 0, 1), MINE)
      if (fall > 0) mixPose(MINE, POSE.off, fall, MINE)
      MINE.j = jump
    }
  }
  // the man on him: down in his stance, then the tell
  let dPose = POSE.isoD
  const fell = clean ? clamp((since - 80) / 260, 0, 1) : 0
  if (clean) dPose = -hand < 0 ? POSE.stumbleL : POSE.stumbleR
  else if (res?.ok) dPose = hand > 0 ? POSE.reachL : POSE.reachR    // still reaching where the ball was
  else if (res?.kind === 'strip') dPose = hand < 0 ? POSE.reachL : POSE.reachR
  else if (res?.kind === 'cutoff') dPose = POSE.deny
  else if (g.tell.reach) dPose = hand < 0 ? POSE.reachL : POSE.reachR
  else if (g.tell.shade) dPose = hand < 0 ? POSE.shadeL : POSE.shadeR
  const M = castMen(g, view)
  const dX = dx - (clean ? (hand * fell * 20) / FT_UNITS : 0)
  // the ball: off the floor in the hand it's in; the crossover is low, one bounce between his feet
  const handFt = 27 / FIG_FT, low = lerp(BALL_R, (37 - 3) / FIG_FT - BALL_R, top)
  let ball = AB, netAge = null, spin = g.t / 170, up2 = false, carry = null
  if (clean && goT > 300) {
    // in his hand all the way up; then it's through
    if (goT < DUNK_AT) { carry = IN_HANDS; ball = null }
    else { dropThrough(goT - DUNK_AT); netAge = goT - DUNK_AT }
    spin = since / 60; up2 = true
  } else if (clean && goT > 0) {
    AB.x = x + hand * handFt; AB.z = z; AB.y = BALL_R + Math.abs(Math.cos((goT / 200) * Math.PI)) * 2.1; spin = g.t / 150
  } else if (res?.kind === 'strip') {
    // his hand's on it: it comes out low and it's his
    const f = clamp(since / 220, 0, 1)
    flyTo(x + hand * handFt, low, z, dX + hand * 2.4, 2.2, dz - 0.4, f); spin = since / 60
  } else if (crossing) {
    const f = sinceCross / 170
    AB.x = lerp(x + g.crossFrom * handFt, x + hand * handFt, f); AB.z = z + 0.2; AB.y = BALL_R + Math.abs(Math.cos(f * Math.PI)) * 1.9; spin = 0
  } else { AB.x = x + hand * handFt; AB.z = z + 0.2; AB.y = low }
  const rimAge = clean ? goT - DUNK_AT : -1
  const rimDy = rimAge >= 0 && rimAge < 500 ? Math.cos(rimAge / 42) * 4 * Math.exp(-rimAge / 150) : 0
  const atIron = hoopWith(ctx, cam, up2 ? ball : null, netAge, spin, rimDy)
  // (through the net and behind him: it's under the rim, he's in front of it)
  if (up2 && ball && !atIron) ballIn(ctx, cam, ball.x, ball.y, ball.z, spin)
  const him = M?.them[0] ?? { number: 5, skin: skinOf(1), name: null }, me = M?.us[0] ?? { number: 1, skin: skinOf(3), name: null }
  // (he's going to the rim on the last one: he's past him, and further off)
  const list = [[dX, dz + fell * 0.3, easedPose(ISO_HIM, dPose, g, CLK.dt, 55), them, him, false, null], [x, z, easedPose(ISO_ME, MINE, g, CLK.dt, 22), us, me, true, carry]]
  list.sort((a2, b2) => b2[1] - a2[1])
  for (const q of list) {
    if (manAt(ctx, view, cam, q[0], q[1], q[2], { jersey: q[3].color, trim: q[3].trim, skin: q[4].skin, num: q[4].number, back: q[5], ball: q[6], live: true }) && M) tagAt(PT.x, PT.y - 11, q[4].name, PT.k / FIG_FT)
  }
  if (M) tagsDown(ctx, view)
  if (ball && !atIron && !up2) ballIn(ctx, cam, ball.x, ball.y, ball.z, spin)
}

// ── Post-up: on the low block, with the rim right there ─────────────────────
// Close in on the block: his back to the basket, facing us, the defender's chest on his back, between him and
// the rim. You see which way he's playing you and go the other: a drop step, a pivot on the back foot round him
// with the ball kept away, and he's facing the rim for a short finish. Under a second, then the next touch.
const postSide = g => (g.yard0 % 2 ? 1 : -1)
const POST_D = 15, POST_X = 4.2, POST_CAM_X = 2.2, POST_Z = -3    // the block, and the camera straight back from just inside it
const POST_ME = easedState(), POST_HIM = easedState(), POST_P = newPose()
function drawPost(ctx, g, view) {
  const { h } = view, c = view.colors, us = teamOf(c, 0), them = teamOf(c, 1), d = g.cur, res = d.res, since = res ? g.t - res.at : -1
  smoothT(g)
  const sd = postSide(g)
  const G = g.postG && g.postG.h === h && g.postG.sd === sd ? g.postG : (g.postG = { ...arenaCam(h, { ...CRASH_CAM(h), D: POST_D, x: sd * POST_CAM_X }), sd })
  arenaStage(ctx, view, G, `post-${sd}-${h}`)
  const cam = G.cam
  // the spot on the block
  const baseX = sd * POST_X, baseZ = POST_Z
  const dist = Math.hypot(baseX, baseZ) || 1, ux = -baseX / dist, uz = -baseZ / dist
  // the defender, on his back: he shades over as he plays a side
  const shade = (shiftOf(d, g, 44) * 0.8) / FT_UNITS
  const wantX = baseX + ux * 1.8 + shade, wantZ = baseZ + 3.2
  const b = g.postD ?? (g.postD = { x: wantX, z: wantZ, t: g.t })
  const dt = Math.min(80, g.t - b.t); b.t = g.t
  const k = Math.min(1, dt / 70)
  b.x += (wantX - b.x) * k; b.z += (wantZ - b.z) * k
  const side = d.lunge || (g.t - d.at >= d.leanAt ? d.lean : 0)
  // him
  const go = res?.ok ? res.want : 0
  let x = baseX, z = baseZ, P1 = POSE.post, back = false, j = 0, ballX = 0.55, ballY = 3.05, ballZ = -0.5
  if (!res) {
    // he's sat down on him; a press is his weight going over, the first of the drop step
    const m = g.px
    x += (m * 9) / FT_UNITS
    if (Math.abs(m) > 0.5) P1 = m > 0 ? POSE.dropR : POSE.dropL
    ballX = m >= 0 ? -0.55 : 0.55
  } else if (res.ok) {
    // the drop step, the pivot round him, facing up, and the finish
    const t = since
    const a1 = easeOut(clamp(t / 130, 0, 1)), a2 = easeOut(clamp((t - 130) / 170, 0, 1)), a3 = easeOut(clamp((t - 300) / 150, 0, 1))
    x += (go * (14 * a1 + 30 * a2)) / FT_UNITS + (ux * 22 * a3) / FT_UNITS
    z += 1.3 * a2 + 1.9 * a3
    if (t < 130) { P1 = go > 0 ? POSE.dropR : POSE.dropL; ballX = -go * 0.7 }
    else if (t < 300) { P1 = POSE.hold; back = t > 215; ballX = 0; ballY = 4.4; ballZ = back ? 0.5 : -0.5 }
    else if (t < 470) { P1 = POSE.gather; back = true; ballX = 0; ballY = 6.4; ballZ = 0.3 }
    else { P1 = POSE.shoot; back = true; j = Math.sin(clamp((t - 470) / 420, 0, 1) * Math.PI) * 32 }
  }
  copyPose(P1, POST_P); POST_P.j = j
  const M = castMen(g, view)
  const defP = res?.ok ? POSE.deny : side ? (side < 0 ? POSE.shadeL : POSE.shadeR) : Math.floor(g.t / 340) % 2 ? POSE.guardA : POSE.guardB
  // the ball
  let ball = AB, netAge = null, spin = 0, up2 = false
  if (res?.ok && since > 470) {
    const f = (since - 470) / 340
    if (f < 1) flyTo(x, 8 + j / FIG_FT, z, 0, RIM_FT + 0.35, 0, f, 1.5)
    else { dropThrough(since - 810); netAge = since - 810 }
    spin = since / 60; up2 = true
  } else { AB.x = x + ballX; AB.y = ballY; AB.z = z + ballZ }
  const atIron = hoopWith(ctx, cam, up2 ? ball : null, netAge, spin)
  const him = M?.them[0] ?? { number: 33, skin: skinOf(1), name: null }, me = M?.us[0] ?? { number: 44, skin: skinOf(3), name: null }
  const list = [[b.x, b.z, easedPose(POST_HIM, defP, g, CLK.dt, 26), them, him, false], [x, z, easedPose(POST_ME, POST_P, g, CLK.dt, 22), us, me, back]]
  list.sort((a, b2) => b2[1] - a[1])
  // (the ball's behind him once he's turned to the rim and going up)
  for (const q of list) {
    if (manAt(ctx, view, cam, q[0], q[1], q[2], { jersey: q[3].color, trim: q[3].trim, skin: q[4].skin, num: q[4].number, back: q[5], live: true }) && M) tagAt(PT.x, PT.y - 11, q[4].name, PT.k / FIG_FT)
  }
  if (M) tagsDown(ctx, view)
  if (!atIron) ballIn(ctx, cam, ball.x, ball.y, ball.z, spin)
}
