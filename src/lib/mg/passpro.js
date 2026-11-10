// Pass Pro: the offensive tackle's half of the pass rush (rush.js is the other half), from behind him: the
// QB at the bottom of the screen, our man in front of him at the edge of the line, and the man rushing him
// across from him. Four snaps, each one harder, and the QB needs the pocket clean until the ball is out.
//   MIRROR   he takes off wide (a speed rush) or shows wide and comes back inside (a counter): slide the way
//            he's really going. Bite on the show and the inside gets tight; slide the wrong way and he's by.
//   PUNCH    with him, he closes: punch as he gets to you. Too early and he swipes the hands away; too late
//            and he's into your chest and walking you back.
//   ANCHOR   he drops his pads and comes straight (a bull): hold PUNCH and sink. Let go, or turn your
//            shoulders, and he walks you into the QB's lap.
//   PICK UP  the last snap brings two: a twist (the end crashes inside, the tackle loops round) or a blitz
//            (the end drops out, a linebacker comes through inside). Take the man coming free.
// One mistake and he has a step: read where he goes and run him past the QB, and it's only pressure. Two,
// or no answer, and it's a sack. A clean snap is 2, pressure 1. Five of eight holds the pocket.
//
// The rules are all here with no screen, in field units: x across, d up the field from the line of
// scrimmage (the QB is at a small negative d, behind our man). The camera is pass-rush's (lib/mg/index.js).
import { byV, clamp, lerp, outcome, rngOf, layer, manOf, xiOf, paceOf, easeOut, particles, nudge, text, DISPLAY, LABEL, GOLD, GOOD, BAD } from './kit.js'
import { tilt, untilt, ground, stands, floodlight, vignette, skinOf, airBall, warmAthlete, crowdPop } from './art.js'
import { afterStop, fxSeed, hitFx, plantFx, landFx, pushIn } from './contact.js'
import { paintFieldFlat, qbPose, lightFx } from './throw.js'
import { put, action, tagsAll, teamOf, walk, ballInAir } from './read.js'

export const how = {
  'pass-pro': 'Watch his first step: he goes wide, slide OUTSIDE; he comes back under you, INSIDE. PUNCH as the ring closes on him. A bull rush: HOLD PUNCH and anchor. A twist or a blitz: take the man coming free.',
}

const YD = 20
const SP = 44                // between linemen
const SIZE = 1.7
const TURF_X = (53.33 * YD) / 344
const OL_NUM = [74, 66, 52, 63, 78]
const DL_NUM = [97, 93, 99, 95]
const STAMP_Y = 0.25
const ME_D = -16, SET_D = -34, RU_D = 26
const QB_GUN = -76, QB_SET = -94, SNAP_MS = 170
const SHOW = 180, SETTLE = 160, FAKE_MS = 300, RESET = 420
const RAMP = [1, 0.96, 0.92, 0.9]
const QB_MS = [2500, 2700, 3000, 2800]   // how long the QB needs, each snap
// what the ratings buy (the game's one value: the average of Pass Pro, Mobility, Anchor, Blitz Pickup, Length)
const MIRROR = v => byV(v, 480, 590)     // once he's committed: this long to get your feet with him
const READ_MS = v => byV(v, 620, 770)    // a twist or a blitz: this long to see who's free
const RECOVER = v => byV(v, 420, 500)    // he's got a step: this long to run him past the QB
const PUNCH_W = v => byV(v, 165, 215)    // the punch window, round the moment he gets to you
const REACH = v => byV(v, 30, 60)        // long arms land it a touch sooner
const STALL = v => byV(v, 740, 600)      // holding the anchor this long stops his feet
const GIVE = v => byV(v, 0.62, 0.4)     // how much ground an anchor still gives
const SLIDE_V = v => byV(v, 0.2, 0.27)   // his feet, mirroring
const DRIVE_MS = 600                     // a bull with nothing in front of him: in the QB's lap this fast
const BULL_IN = 260                      // a bull's first step to contact

const bare = m => m && { number: m.number, skin: m.skin }
// (from the full eleven: the man on him by name, a man off the play named once the snap's over)
const named = m => (m?.last ? m : bare(m))
const quiet = m => (m?.last ? { ...m, quiet: true } : bare(m))
const seek = (m, x, d, v, dt) => {
  const dx = x - m.x, dd = d - m.d, e = Math.hypot(dx, dd)
  if (e < 0.01) return true
  const mv = Math.min(e, v * dt)
  m.x += (dx / e) * mv; m.d += (dd / e) * mv
  return mv >= e
}
const far = (a, b) => Math.hypot(a.x - b.x, a.d - b.d)
const pick = (r, list) => list[Math.floor(r() * list.length)]

function castOf(cast) {
  // the full eleven a side (career's xi): his own line by name, their four down and both backers
  if (cast?.us?.xi && cast?.them?.xi) {
    const x = (side, spot, i) => xiOf(cast, side, spot, i)
    return {
      me: cast.me ?? null,
      ol: [0, 1, 2, 3, 4].map(i => { const m = x('us', 'ol', i); return m && !m.me ? m : null }),
      dl: [0, 1, 2, 3].map(i => x('them', 'dl', i)),
      lb: x('them', 'lb', 0), lb2: x('them', 'lb', 1),
      // (he's the lineman: a cast made for a QB, practice while OL is hidden, puts the real starter behind him)
      qb: x('us', 'qb', 0)?.me ? x('us', 'qb', 1) : x('us', 'qb', 0), rb: x('us', 'rb', 0),
      pace: paceOf(cast, 'them', 'dl', 0),
    }
  }
  return {
    me: cast?.me ?? null,
    ol: [0, 1, 2, 3, 4].map(i => (cast?.us?.ol?.length > i + 1 ? bare(cast.us.ol[i + 1]) : null)),
    dl: [0, 1, 2, 3].map(i => manOf(cast, 'them', 'dl', i)),
    lb: manOf(cast, 'them', 'lb', 0),
    qb: manOf(cast, 'us', 'qb', 0), rb: manOf(cast, 'us', 'rb', 0),
    pace: paceOf(cast, 'them', 'dl', 0),
  }
}

export function make({ v, seed, cast }) {
  const r = rngOf(seed), n = 4
  const s = r() < 0.5 ? -1 : 1               // his side: -1 the left tackle, 1 the right. Outside is s on the screen.
  const MX = 180 + s * 30, CX = MX - s * 2 * SP
  const A = r() < 0.5 ? 'counter' : 'bull', B = A === 'counter' ? 'bull' : 'counter'
  const moves = [['speed'], [A], [B, r() < 0.5 ? 'speed' : 'counter'], ['pickup', r() < 0.5 ? 'bull' : 'speed']]
  const plan = moves.map((list, k) => ({
    k, moves: list, mi: 0, wait: 800 + r() * 600, hard: k > 0 && r() < [0, 0.45, 0.55, 0.6][k] ? 0.4 + r() * 0.3 : null,
    Q: QB_MS[k] + r() * 160, blitz: r() < 0.5 ? 'stunt' : 'blitz', swipeSame: r() < 0.6,
    snapAt: 0, ex: null, fails: 0, res: null, doom: null, hurry: null, pancake: false, nextAt: null, thrown: null, flag: false,
    me: { x: MX, d: ME_D }, ru: { x: MX + s * 28, d: RU_D }, other: null, qb: { x: CX, d: QB_GUN },
    punchAt: -999, swipeAt: -999, stoneAt: -999,
  }))
  const sideOf = z => (z === 0 ? -1 : z === 2 ? 1 : 0)
  const g = {
    t: 0, game: 'pass-pro', zones: 'three', anyKey: true, padLit: null, litAt: -999, fx: [], done: null, outro: 1500, stamp: null, later: null,
    dirt: particles(44, fxSeed(seed)), paper: particles(40, fxSeed(`${seed}|paper`)), nudge: nudge(),
    pads: s < 0 ? ['OUTSIDE', 'PUNCH', 'INSIDE'] : ['INSIDE', 'PUNCH', 'OUTSIDE'],
    plan, i: 0, rep: plan[0], phase: 'set', nextAt: 0, who: castOf(cast), s, MX, CX, stallMs: STALL(v),
    clean: 0, pressures: 0, sacks: 0, flags: 0, pancakes: 0, popAt: -1e9,
    // what a player can see: all a bot gets. side: -1 / 1 on the screen
    tell: { snapped: false, hard: false, type: null, side: null, bull: false, commit: false, contactAt: null, free: null, held: false },
    // (padCue: the pad the line on the screen calls for, outlined. It says only what his body is showing: a bot reads the same in tell)
    padCue: null,
    hud: { prompt: 'WAIT FOR THE SNAP', dots: plan.map(() => null) },
    zoneFor(side) { return side < 0 ? 0 : 2 },
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110 && !g.held) g.padLit = null
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      const rep = g.rep
      if (g.phase === 'set') {
        g.tell.hard = rep.hardAt != null && g.t >= rep.hardAt && g.t < rep.hardAt + 260
        if (g.t >= rep.snapAt) snap(rep)
        return
      }
      if (g.phase === 'play') rules(rep, dt)
      move(rep, dt)
      if (g.phase === 'beat' && !g.done && g.t >= g.nextAt) next()
    },
    input(a) {
      const rep = g.rep
      if (a.kind === 'up') {
        if (a.zone === 1 || g.held) { g.held = false; g.tell.held = false; if (rep.ex?.type === 'anchor') rep.ex.held = false }
        return
      }
      if (a.kind !== 'down' || a.zone == null) return
      g.padLit = a.zone; g.litAt = g.t
      if (g.done || rep.res || g.phase !== 'play' && g.phase !== 'set') return
      if (g.phase === 'set') return falseStart(rep)
      const ex = rep.ex, side = sideOf(a.zone), mid = a.zone === 1, t = g.t
      if (mid) { g.held = true; g.tell.held = true }
      if (!ex || rep.doom || rep.hurry) return
      if (ex.type === 'mirror') {
        if (t < ex.showAt) return
        if (mid) return fail(rep, 'LUNGED', ex.dir)
        const crossed = !ex.fake || t >= ex.crossAt
        if (side === ex.dir && crossed) return mirrored(rep, ex)
        if (ex.fake && !crossed && side === ex.fake) {
          if (!ex.bit) { ex.bit = true; ex.until -= MIRROR(v) * 0.28; g.fx.push('h:light') }
          return
        }
        return fail(rep, 'BEAT', ex.dir)
      }
      if (ex.type === 'punch') {
        if (!mid) return
        if (t < ex.early) { rep.swipeAt = t; return fail(rep, 'SWIPED', rep.swipeSame ? ex.dir : -ex.dir) }
        return stoned(rep, ex, Math.abs(t - ex.contactAt) <= PUNCH_W(v) * 0.12)
      }
      if (ex.type === 'anchor') {
        if (mid) { ex.held = true; return }
        if (t >= ex.showAt) { ex.depth = Math.min(0.98, ex.depth + 0.18); g.fx.push('h:light') }
        return
      }
      if (ex.type === 'pickup') {
        if (t < ex.commitAt) return
        if (mid) return fail(rep, 'LUNGED', ex.dir)
        if (side === ex.dir) return picked(rep, ex)
        return doom(rep, 'FREE RUSHER', ex.dir)
      }
      if (ex.type === 'recover') {
        if (mid || t < ex.showAt) return
        if (side === ex.dir) return recovered(rep, ex)
        return doom(rep, 'SACK', ex.dir)
      }
    },
  }
  // a lost step, in a coach's words: what he did, and what beats it
  const side = d => (d === s ? 'OUTSIDE' : 'INSIDE')
  function whyOf(rep, word, dir, ex = rep.ex) {
    if (word === 'LUNGED') return 'LUNGED: SLIDE FIRST, THEN PUNCH'
    if (word === 'SWIPED') return 'EARLY PUNCH: HE SWIPED IT AWAY'
    if (word === 'WALKED BACK') return ex?.holdMs > 0 ? 'WALKED BACK: SIT DOWN SOONER' : 'BULL RUSH: HOLD PUNCH TO ANCHOR'
    if (ex?.type === 'pickup' || word === 'FREE RUSHER') return rep.blitz === 'stunt' ? 'TWIST: PICK UP THE LOOPER' : 'BLITZ: PICK UP THE BACKER'
    if (ex?.type === 'recover') return 'HE GOT HOME: RUN HIM PAST'
    if (word === 'TOO SLOW') return `TOO SLOW: SLIDE ${side(dir)} WITH HIM`
    if (ex?.fake && dir !== ex.fake) return 'INSIDE MOVE: HE CAME BACK UNDER'
    return dir === s ? 'BEAT OUTSIDE: SLIDE OUT WITH HIM' : 'BEAT INSIDE: SLIDE IN WITH HIM'
  }
  // the coach's line for what he's showing right now, and the pad it calls for (nothing the body isn't already showing)
  function cue(rep, t) {
    const ex = rep.ex, pad = d => g.zoneFor(d)
    if (rep.doom) return ["HE'S FREE", null]
    if (rep.hurry) return ['RAN HIM PAST', null]
    if (!ex) return rep.nextAt != null ? ['STAY ON HIM', null] : [null, null]
    if (ex.type === 'mirror') {
      if (t < ex.showAt) return ['WATCH HIS FIRST STEP', null]
      if (ex.fake && t < ex.crossAt) return ["HE'S GOING WIDE", pad(ex.fake)]
      if (ex.fake) return ['INSIDE MOVE: GO INSIDE', pad(ex.dir)]
      return t < ex.commitAt ? ["HE'S GOING WIDE", pad(ex.dir)] : ['SPEED RUSH: SLIDE OUTSIDE', pad(ex.dir)]
    }
    if (ex.type === 'punch') return ['PUNCH AS THE RING CLOSES', 1]
    if (ex.type === 'anchor') return t < ex.contactAt ? (ex.name === 'chest' ? ['HOLD PUNCH: ANCHOR', 1] : ['BULL RUSH: HOLD PUNCH', 1]) : ['HOLD IT: SINK THE ANCHOR', 1]
    if (ex.type === 'pickup') {
      if (t < ex.commitAt) return ["TWO COMING: WHO'S FREE?", null]
      return rep.blitz === 'stunt' ? ['TWIST: TAKE THE LOOPER', pad(ex.dir)] : ['BLITZ: TAKE THE BACKER', pad(ex.dir)]
    }
    if (ex.type === 'recover') return t < ex.showAt ? ["HE'S GOT A STEP", null] : [`RUN HIM PAST: ${side(ex.dir)}`, pad(ex.dir)]
    return [null, null]
  }
  function setUp(rep) {
    rep.me.x = MX; rep.me.d = ME_D
    rep.qb.x = CX; rep.qb.d = QB_GUN
    if (rep.moves[0] === 'pickup') {
      // the man coming free, and the one who isn't
      if (rep.blitz === 'stunt') { rep.ru = { x: MX - s * 30, d: RU_D - 2 }; rep.other = { x: MX + s * 28, d: RU_D } }
      else { rep.ru = { x: MX - s * 18, d: 78 }; rep.other = { x: MX + s * 28, d: RU_D } }
    } else { rep.ru = { x: MX + s * 28, d: RU_D }; rep.other = null }
    rep.snapAt = g.t + rep.wait
    rep.hardAt = rep.hard != null ? g.t + rep.wait * rep.hard : null
    Object.assign(g.tell, { snapped: false, hard: false, type: null, side: null, bull: false, commit: false, contactAt: null, free: null })
    g.hud.prompt = 'WAIT FOR THE SNAP'; g.hud.hot = false; g.padCue = null
    g.phase = 'set'
  }
  function snap(rep) {
    g.phase = 'play'
    g.tell.snapped = true; g.tell.hard = false
    g.hud.prompt = null
    g.fx.push('tap', 'h:light')
    startMove(rep, rep.moves[0], g.t + SHOW)
  }
  const ramp = rep => RAMP[rep.k]
  function startMove(rep, name, at) {
    const k = ramp(rep)
    if (name === 'speed') rep.ex = { type: 'mirror', name, dir: s, fake: null, showAt: at, crossAt: at, commitAt: at + SETTLE, until: at + SETTLE + MIRROR(v) * k }
    else if (name === 'counter') rep.ex = { type: 'mirror', name, dir: -s, fake: s, showAt: at, crossAt: at + FAKE_MS, commitAt: at + FAKE_MS + SETTLE, until: at + FAKE_MS + SETTLE + MIRROR(v) * k }
    else if (name === 'bull') rep.ex = { type: 'anchor', name, showAt: at, contactAt: at + SETTLE + BULL_IN, depth: 0, holdMs: 0, held: g.held, from: { ...rep.ru } }
    else {
      const late = rep.k >= 3 ? 200 : 0      // (both of them come at him, then they split)
      rep.ex = { type: 'pickup', name, dir: rep.blitz === 'stunt' ? s : -s, showAt: at, commitAt: at + SETTLE + late, until: at + SETTLE + late + READ_MS(v) * k }
    }
    rep.ex.at = g.t
  }
  function mirrored(rep, ex) {
    const t = g.t, k = ramp(rep)
    const approach = (420 + (rep.ex.name === 'counter' ? -40 : 0)) * k + (rep.k === 3 ? -60 : 0)
    const contactAt = Math.max(t, ex.commitAt) + approach
    rep.ex = { type: 'punch', name: ex.name, dir: ex.dir, at: t, contactAt, early: contactAt - PUNCH_W(v) / 2 - REACH(v), late: contactAt + PUNCH_W(v) / 2, from: { ...rep.ru } }
    g.fx.push('h:light')
  }
  function picked(rep, ex) {
    const t = g.t, k = ramp(rep)
    const contactAt = Math.max(t, ex.commitAt) + 340 * k
    rep.ex = { type: 'punch', name: 'pickup', dir: ex.dir, at: t, contactAt, early: contactAt - PUNCH_W(v) / 2 - REACH(v), late: contactAt + PUNCH_W(v) / 2, from: { ...rep.ru } }
    g.stamp = { text: 'PICKED UP', good: true, at: t, ms: 520, size: 30 }
    g.fx.push('tap', 'h:light')
  }
  function stoned(rep, ex, flat) {
    rep.punchAt = g.t
    rep.ex = null
    g.fx.push('pop', 'h:medium')
    if (flat && !rep.fails) {
      // dead centre: he's on his back
      rep.pancake = { x: rep.ru.x + (rep.ru.x >= rep.me.x ? 10 : -10), d: rep.me.d + 52, md: rep.me.d + 6, side: rep.ru.x >= rep.me.x ? 1 : -1 }; rep.stoneAt = g.t; g.pancakes++
      g.stamp = { text: 'PANCAKE', good: true, at: g.t, ms: 760, size: 44 }
      g.fx.push('stamp', 'h:heavy')
      return
    }
    rep.stoneAt = g.t
    g.stamp = { text: 'STONED', good: true, at: g.t, ms: 520, size: 32 }
    more(rep)
  }
  // he's stopped: another move if there's time for one before the ball's out
  function more(rep) {
    if (rep.mi + 1 < rep.moves.length && g.t + RESET + 1000 < rep.snapAt + rep.Q) { rep.mi++; rep.nextAt = g.t + RESET }
    else rep.nextAt = null
  }
  function anchored(rep) {
    rep.ex = null
    rep.stoneAt = g.t
    g.stamp = { text: 'ANCHORED', good: true, at: g.t, ms: 560, size: 34 }
    g.fx.push('pop', 'h:medium')
    if (!rep.fails) more(rep)
    else rep.nextAt = null
  }
  function fail(rep, word, dir, why) {
    rep.fails++
    rep.why = why ?? whyOf(rep, word, dir)
    if (rep.fails >= 2) return doom(rep, 'SACK', dir, rep.why)
    g.stamp = { text: word, good: false, at: g.t, ms: 480, size: 32 }
    g.fx.push('tap', 'h:medium')
    rep.nextAt = null
    rep.ex = { type: 'recover', dir, at: g.t, showAt: g.t + 90, until: g.t + 90 + RECOVER(v) * ramp(rep), from: { ...rep.ru } }
  }
  function chest(rep) {
    rep.fails++
    rep.why = "LATE PUNCH: HE'S INTO YOUR CHEST"
    g.stamp = { text: 'INTO HIS CHEST', good: false, at: g.t, ms: 520, size: 30 }
    g.fx.push('pop', 'h:medium')
    rep.nextAt = null
    rep.ex = { type: 'anchor', name: 'chest', showAt: g.t, contactAt: g.t, depth: 0.1, holdMs: 0, held: g.held, recovery: true, from: { ...rep.ru } }
  }
  function recovered(rep, ex) {
    rep.ex = null
    rep.hurry = { dir: ex.dir, at: g.t + 300 }
    g.stamp = { text: 'RAN HIM PAST', good: null, at: g.t, ms: 480, size: 30 }
    g.fx.push('swoosh', 'h:light')
  }
  function doom(rep, word, dir, why) {
    rep.why = why ?? ((rep.ex?.type === 'recover' && rep.why) || whyOf(rep, word, dir, rep.ex))   // (lost in the recovery: the step he got in the first place)
    rep.ex = null; rep.nextAt = null
    rep.doom = { at: g.t, dir, word }
    g.stamp = word === 'SACK' ? null : { text: word, good: false, at: g.t, ms: 460, size: 32 }
    g.fx.push('swoosh', 'h:medium')
  }
  function falseStart(rep) {
    rep.flag = true
    rep.why = 'FALSE START: MOVE ON THE BALL'
    g.fx.push('whistle', 'deny')
    settle(rep, 'flag')
  }
  function throwIt(rep) {
    rep.thrown = g.t
    rep.ex = null; rep.nextAt = null
    settle(rep, rep.fails ? 'pressure' : 'clean')
  }
  function settle(rep, kind) {
    rep.res = { kind, at: g.t }
    const good = kind === 'clean' ? true : kind === 'pressure' ? null : false
    if (kind === 'clean') g.clean++
    if (kind === 'pressure') g.pressures++
    if (kind === 'sack') g.sacks++
    if (kind === 'flag') g.flags++
    g.hud.dots[g.i] = kind === 'clean' || kind === 'pressure'
    // what happened, in a line: why he got there (a hurried one, the step he got)
    g.hud.prompt = kind === 'clean' ? (rep.pancake ? 'PANCAKE: HE NEVER GOT UP' : 'BALL OUT: NOBODY GOT HOME') : rep.why ?? null
    g.hud.hot = false; g.padCue = null
    g.held = false; g.tell.held = false
    g.tell.type = null; g.tell.side = null; g.tell.bull = false; g.tell.contactAt = null; g.tell.free = null
    const words = { clean: 'CLEAN POCKET', pressure: 'HURRIED', sack: 'SACK', flag: 'FALSE START' }
    const beat = { clean: 1300, pressure: 1100, sack: 1300, flag: 1050 }[kind]
    g.stamp = { text: words[kind], good, at: g.t + (kind === 'clean' ? 140 : 0), ms: beat - 140, size: kind === 'clean' || kind === 'flag' ? 40 : 46 }
    g.fx.push(kind === 'clean' ? 'stamp' : 'tap', kind === 'sack' ? 'h:heavy' : 'h:medium')
    if (kind === 'clean') g.popAt = g.t
    g.phase = 'beat'
    g.nextAt = g.t + beat
    if (plan.every(p => p.res)) {
      const pts = g.clean * 2 + g.pressures
      const hit = pts >= 5
      const score = clamp(pts / 8 + g.pancakes * 0.04, 0, 1)
      const note = [`${g.clean} clean`, g.pressures && `${g.pressures} hurried`, g.sacks && `${g.sacks} sack${g.sacks === 1 ? '' : 's'}`, g.flags && `${g.flags} false start${g.flags === 1 ? '' : 's'}`, g.pancakes && `${g.pancakes} pancake${g.pancakes === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
      g.done = outcome(hit ? Math.max(score, 0.5) : Math.min(score, 0.45), hit, note, { made: g.clean, of: n, clean: g.clean, pressures: g.pressures, sacks: g.sacks, pancakes: g.pancakes }, false)
      const word = hit ? (g.clean === n ? 'BRICK WALL' : 'POCKET HELD') : 'POCKET COLLAPSED'
      g.later = { text: word, good: hit, at: g.t + beat - 100, size: word.length > 12 ? 36 : 44 }
      g.outro = beat + 1000
      if (hit) g.perfect = g.clean === n
    }
  }
  function next() {
    g.i++
    g.rep = plan[g.i]
    g.stamp = null
    setUp(g.rep)
  }
  // ── the rules, each frame of a live snap ──
  function rules(rep, dt) {
    const t = g.t, age = t - rep.snapAt, tl = g.tell
    if (rep.res) return
    if (rep.doom || rep.hurry) { ;[g.hud.prompt, g.padCue] = cue(rep, t); g.hud.hot = false }
    if (rep.doom) {
      if (far(rep.ru, rep.qb) < 24 || t - rep.doom.at > 720) settle(rep, 'sack')
      return
    }
    if (rep.hurry) { if (t >= rep.hurry.at) { rep.thrown = t; settle(rep, 'pressure') } return }
    if (!rep.ex && rep.nextAt != null && t >= rep.nextAt) { rep.nextAt = null; startMove(rep, rep.moves[rep.mi], t + 120) }
    const ex = rep.ex
    // what's on the screen
    tl.type = ex?.type ?? null
    tl.side = null; tl.bull = false; tl.commit = false; tl.contactAt = null; tl.free = null
    if (ex) {
      if (ex.type === 'mirror' && t >= ex.showAt) { tl.side = ex.fake && t < ex.crossAt ? ex.fake : ex.dir; tl.commit = t >= ex.commitAt }
      if (ex.type === 'anchor' && t >= ex.showAt) tl.bull = true
      if (ex.type === 'punch') tl.contactAt = ex.contactAt
      if (ex.type === 'pickup' && t >= ex.commitAt) { tl.free = ex.dir; tl.commit = true }
      if (ex.type === 'recover' && t >= ex.showAt) { tl.side = ex.dir; tl.commit = true }
    }
    ;[g.hud.prompt, g.padCue] = cue(rep, t)
    g.hud.hot = ex?.type === 'anchor' && t >= ex.contactAt
    if (ex) {
      if ((ex.type === 'mirror' || ex.type === 'pickup') && t > ex.until) { fail(rep, 'TOO SLOW', ex.dir); return }
      if (ex.type === 'recover' && t > ex.until) { doom(rep, 'SACK', ex.dir); return }
      if (ex.type === 'punch' && t > ex.late) { chest(rep); return }
      if (ex.type === 'anchor' && t >= ex.contactAt) {
        if (ex.held && g.held) ex.holdMs += dt
        ex.depth += (dt / DRIVE_MS) * (ex.held && g.held ? GIVE(v) : 1)
        if (ex.depth >= 1) { doom(rep, 'WALKED BACK', 0); rep.ru.d = rep.me.d + 18; return }
        if (ex.holdMs >= STALL(v)) { anchored(rep); return }
      }
    }
    if (age >= rep.Q && !rep.doom) throwIt(rep)
  }
  // ── where everybody is (the same with no screen: the bot doesn't look at it) ──
  function move(rep, dt) {
    const t = g.t, me = rep.me, ru = rep.ru, qb = rep.qb, ex = rep.ex, age = t - rep.snapAt, res = rep.res
    if (g.phase === 'set' || rep.flag) return
    if (age > SNAP_MS) seek(qb, qb.x, QB_SET, 0.07, dt)
    if (rep.other) {
      const o = rep.other, crash = rep.blitz === 'stunt'
      const split = ex?.type === 'pickup' ? t >= ex.commitAt - 60 : true
      if (!split) seek(o, MX + s * 12, RU_D - 10, 0.16, dt)
      else if (crash) seek(o, MX - s * 40, 6, 0.2, dt)
      else seek(o, MX + s * 70, 74, 0.16, dt)
    }
    if (res?.kind === 'sack') return
    if (rep.doom) {
      const dir = rep.doom.dir || (ru.x < qb.x ? -1 : 1)
      seek(ru, qb.x + dir * 6, qb.d + 10, 0.3 * g.who.pace, dt)
      seek(me, me.x + dir * 4, me.d - 4, 0.06, dt)
      return
    }
    if (rep.hurry || res?.kind === 'pressure') {
      const dir = rep.hurry?.dir ?? s
      seek(ru, qb.x + dir * 52, qb.d + 4, 0.25, dt)
      seek(me, ru.x - dir * 14, ru.d + 8, 0.25, dt)
      return
    }
    // a pancake: he goes over on his back, off to the side he was on, and our man steps up over him
    if (rep.pancake) { seek(ru, rep.pancake.x, rep.pancake.d, 0.16, dt); seek(me, me.x, rep.pancake.md, 0.05, dt); return }
    if (!ex) {
      // chest to chest, the pocket giving a little
      if (res?.kind !== 'clean' || t - res.at < 600) {
        seek(ru, me.x + s * 3, me.d + 20, 0.22, dt)
        if (t - rep.stoneAt < 150) seek(ru, ru.x, me.d + 30, 0.2, dt)
      }
      return
    }
    if (ex.type === 'mirror') {
      if (t < ex.showAt) { seek(ru, MX + s * 26, RU_D - 8, 0.2, dt); seek(me, MX, SET_D, 0.12, dt); return }
      const wide = ex.fake ? t < ex.crossAt : ex.dir === s
      if (wide) seek(ru, MX + s * 66, SET_D + 6, 0.23, dt)
      else seek(ru, MX - s * 26, SET_D + 4, 0.25, dt)
      seek(me, ex.bit ? MX + s * 30 : MX, SET_D, ex.bit ? SLIDE_V(v) : 0.12, dt)
      return
    }
    if (ex.type === 'pickup') {
      if (t < ex.commitAt - 60) { seek(ru, MX + (rep.blitz === 'stunt' ? -s * 14 : -s * 10), rep.blitz === 'stunt' ? RU_D - 6 : 50, 0.16, dt) }
      else if (rep.blitz === 'stunt') seek(ru, MX + s * 44, SET_D + 8, 0.25, dt)   // round the outside
      else seek(ru, MX - s * 24, SET_D + 6, 0.26, dt)                              // through the B gap
      seek(me, MX, SET_D, 0.12, dt)
      return
    }
    if (ex.type === 'punch') {
      // with him: our man slides to where he's going, he closes to arrive on the beat
      const gx = ex.dir === s ? MX + s * 40 : MX - s * 20
      seek(me, gx, SET_D - 4, SLIDE_V(v), dt)
      const cx = me.x + ex.dir * 6, cd = me.d + 20
      const left = ex.contactAt - t
      const dist = Math.hypot(cx - ru.x, cd - ru.d)
      seek(ru, cx, cd, left > 16 ? Math.min(0.5, dist / left) : 0.08, dt)
      return
    }
    if (ex.type === 'anchor') {
      if (t < ex.contactAt) { seek(ru, me.x + s * 3, me.d + 22, Math.max(0.12, far(ru, { x: me.x, d: me.d + 22 }) / Math.max(16, ex.contactAt - t)), dt); return }
      // he's walking him back toward the QB, as far as the anchor lets him
      const md = lerp(SET_D, QB_SET + 22, clamp(ex.depth, 0, 1)), mx = lerp(MX, lerp(MX, qb.x, 0.3), clamp(ex.depth, 0, 1))
      seek(me, mx, md, 0.3, dt)
      seek(ru, me.x + s * 3, me.d + 20, 0.3, dt)
      return
    }
    if (ex.type === 'recover') {
      seek(ru, me.x + ex.dir * 36, me.d - 8, 0.24, dt)
    }
  }
  setUp(plan[0])
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
// Behind the pocket: the QB's feet just over the thumbs, our man up and to the side of him, the rush beyond.
const losOf = view => Math.round(untilt(view, 180, view.h - 150).y + QB_SET)
function stage(ctx, view, los) {
  const c = view.colors, hy = tilt(view, 0, 0).y
  layer(ctx, view, `passpro|${c.us}|${c.trim}|${los}`, x => {
    stands(x, view, 'field', [c.us, c.trim])
    ground(x, view, f => {
      f.save(); f.translate(180, 0); f.scale(TURF_X, 1); f.translate(-180, 0)
      paintFieldFlat(f, view, los - 35 * YD, YD, c.us, false)   // (their 35: the logo at midfield stays behind the camera)
      f.restore()
      f.fillStyle = '#3f86ff'; f.fillRect(-120, los - 1.6, 600, 3.2)
      // the line to gain, ten yards on
      f.fillStyle = '#f7d64a'; f.fillRect(-120, los - 10 * YD - 1.6, 600, 3.2)
    }, `passpro-flat|${c.us}|${los}`, 0, Math.round((view.h - hy) * view.px * 0.7))
    floodlight(x, view)
  })
}
const dirFrom = (w, still) => (w.step == null ? still : Math.abs(w.dx) > Math.abs(w.dy) * 1.2 ? (w.dx > 0 ? 'right' : 'left') : w.dy > 0 ? 'down' : 'up')
const sideName = x => (x < 0 ? 'left' : 'right')
const bump = (g, i) => Math.sin(g.t / (190 + i * 17) + i * 1.9) * 2.5
function warmList(g, us, them) {
  const who = g.who, list = []
  const me = { color: us.color, trim: us.trim, pants: us.trim, skin: who.me?.skin ?? skinOf(4), number: who.me?.number ?? 76, kit: 'pads', carry: false, step: null, dir: 'up' }
  const ru = { color: them.color, trim: them.trim, pants: them.trim, skin: who.dl[0]?.skin ?? skinOf(11), number: who.dl[0]?.number ?? DL_NUM[0], kit: 'pads', carry: false, step: null, dir: 'down' }
  for (const step of [0, 1, 2, 3, null]) {
    for (const pose of ['slide', 'back', null]) list.push({ ...me, step, pose })
    list.push({ ...ru, step, pose: null })
    list.push({ ...ru, dir: 'side', number: null, step, pose: null })
  }
  for (const pose of ['block', 'stance', 'flex', 'point-up', 'arms-up']) list.push({ ...me, pose })
  for (const pose of ['block', 'stance', 'swipe-l', 'swipe-r', 'wrap', 'back']) list.push({ ...ru, pose })
  return list
}
function warm(g, list) {
  g.warmed = g.warmed ?? 0
  for (let n = 0; n < 5 && g.warmed < list.length; n++, g.warmed++) warmAthlete(list[g.warmed])
}

export function draw(ctx, g, view0) {
  if (g.stamp && g.stamp.y == null) g.stamp.y = view0.h * STAMP_Y
  if (g.later && g.later.y == null) g.later.y = view0.h * STAMP_Y
  const c = view0.colors, us = teamOf(c, 0), them = teamOf(c, 1), rep = g.rep, res = rep.res, who = g.who, s = g.s
  const los = losOf(view0)
  const fy = d => los - d
  const snapped = g.phase !== 'set' && !rep.flag, age = g.t - rep.snapAt, since = res ? g.t - res.at : -1
  const sack = res?.kind === 'sack', me = rep.me, ru = rep.ru, qb = rep.qb, ex = rep.ex
  // the camera leans in on a sack or a pancake, and eases back for the next snap
  const focus = sack ? qb : ru
  const fAt = tilt(view0, focus.x, fy(focus.d))
  const lean = sack ? easeOut(clamp(since / 240, 0, 1)) : rep.pancake ? 0.3 * easeOut(clamp((g.t - rep.stoneAt) / 260, 0, 1)) : 0
  // (always a little in on the pocket: the fight is the picture, the far field and the stands over it)
  const pk = tilt(view0, (g.MX + g.CX) / 2, fy(-28))
  const Z = 1.2 + 0.3 * lean, ax = lerp(pk.x, fAt.x, lean), ay = lerp(pk.y, fAt.y - 30, lean), toX = 180, toY = lerp(view0.h * 0.6, view0.h * 0.5, lean)
  const view = pushIn(ctx, g, view0, Z, ax, ay, 1.5, toX, toY)
  // a field point to where it is on the screen, through that push
  const scr = (x, d) => { const p = tilt(view0, x, fy(d)); return { x: toX + (p.x - ax) * Z, y: toY + (p.y - ay) * Z, s: p.s * Z } }
  stage(ctx, view, los)
  crowdPop(ctx, view, [c.us, c.trim], g.t - g.popAt)
  const s2 = sack ? afterStop(since) : since
  const qFall = sack ? clamp((s2 - 10) / 240, 0, 1) : 0
  const fallX = Math.sign(qb.x - ru.x) || s
  // turf and contact: the snap, a punch landing, a pancake, a sack
  if (snapped && !rep.snapFx) { rep.snapFx = true; plantFx(g, view, me.x, fy(me.d), 0, 3); plantFx(g, view, ru.x, fy(ru.d), 0, 3) }
  if (rep.punchAt > (rep.punchSeen ?? -1)) {
    rep.punchSeen = rep.punchAt
    hitFx(g, view, (me.x + ru.x) / 2, (fy(me.d) + fy(ru.d)) / 2, { power: rep.pancake ? 4.5 : 2.6, n: rep.pancake ? 10 : 6, dust: 1, s: 0.9, up: 40 })
  }
  if (rep.pancake && g.t - rep.stoneAt > 300 && !rep.flatFx) { rep.flatFx = true; landFx(g, view, ru.x, fy(ru.d), { side: 0, power: 3 }) }
  if (ex?.type === 'anchor' && g.t >= ex.contactAt && !ex.fx) { ex.fx = true; hitFx(g, view, me.x, fy(me.d + 10), { power: 3, n: 7, dust: 1, s: 0.9, up: 34 }) }
  if (ex?.type === 'anchor' && g.t >= ex.contactAt && Math.floor(g.t / 120) !== rep.dig) { rep.dig = Math.floor(g.t / 120); plantFx(g, view, me.x, fy(me.d), 0, 2, 0.9) }
  if (rep.swipeAt > (rep.swipeSeen ?? -1)) { rep.swipeSeen = rep.swipeAt; plantFx(g, view, ru.x, fy(ru.d), s, 5) }
  if (sack && !rep.hitFx) { rep.hitFx = true; hitFx(g, view, qb.x, fy(qb.d), { power: 7.5, n: 16, dust: 4, side: fallX, up: 26 }); g.fx.push('stamp') }
  if (sack && s2 > 260 && !rep.landFx) { rep.landFx = true; landFx(g, view, qb.x, fy(qb.d), { side: fallX, power: 3 }) }
  // the rest of the line, on each other
  const pc = snapped ? clamp(age / 600, 0, 1) : 0
  for (let i = -2; i <= 2; i++) {
    if (i === 2 * s) continue
    const b = snapped ? bump(g, i + 3) : 0
    const x = g.CX + i * SP
    put(x + b * 0.6, fy(ME_D - 10 * pc + Math.abs(b) * 0.3), us, { dir: 'up', pose: snapped ? 'block' : 'stance', skin: skinOf(i + 4), number: OL_NUM[i + 2], size: SIZE, ...quiet(who.ol[i + 2]) })
  }
  // their front: the three not on him (on a twist, the man beside his end is the one looping round)
  const front = [g.CX + s * 0.55 * SP, g.CX - s * 0.55 * SP, g.CX - s * 2.4 * SP]
  front.forEach((x, i) => {
    if (i === 0 && rep.other && rep.blitz === 'stunt') return
    const b = snapped ? bump(g, i + 7) : 0
    put(x + b, fy(RU_D - 6 - 12 * pc - Math.abs(b) * 0.4), them, { dir: 'down', pose: snapped ? 'block' : 'stance', skin: skinOf(i * 2 + 9), number: DL_NUM[i + 1], size: SIZE, ...quiet(who.dl[i + 1]) })
  })
  // the linebackers, off the ball
  // (on a blitz the one on his side is the man coming: he's drawn as the rusher)
  const lbs = rep.other && rep.blitz === 'blitz' ? [[g.CX - s * 0.2 * SP, 57, quiet(who.lb2)]] : [[g.CX - s * 0.2 * SP, 57, quiet(who.lb2)], [g.MX - s * 0.4 * SP, 54, quiet(who.lb)]]
  lbs.forEach(([x, number, look], i) => put(x, fy(80 + i * 4), them, { dir: 'down', pose: 'ready', skin: skinOf(i + 2), number, size: SIZE, ...look }))
  // the back stays in, on the far side of the QB, and steps up into a gap
  const rbx = qb.x - s * 34, rbd = snapped ? lerp(QB_GUN + 2, QB_GUN + 26, clamp(age / 600, 0, 1)) : QB_GUN + 2
  put(rbx, fy(rbd), us, { dir: 'up', pose: snapped && age > 500 ? 'block' : 'ready', skin: skinOf(6), number: 28, size: SIZE, ...who.rb })
  // the man not coming free on a blitz or a twist
  if (rep.other) {
    const o = rep.other, w = walk(g, `o${g.i}`, o.x, o.d, 7)
    const drop = rep.blitz === 'blitz' && snapped && ex?.type !== 'pickup' || (ex?.type === 'pickup' && g.t >= ex.commitAt - 60 && rep.blitz === 'blitz')
    put(o.x, fy(o.d), them, { dir: drop ? (w.step == null ? 'up' : dirFrom(w, 'up')) : dirFrom(w, 'down'), step: w.step, pose: !snapped ? 'stance' : w.step == null ? 'block' : null, skin: skinOf(11), number: DL_NUM[0], size: SIZE, ...quiet(who.dl[0]) })
  }
  // the QB: the ball comes back, he sets, it comes out at the end of his clock
  const thrown = rep.thrown != null ? g.t - rep.thrown : -1
  const arm = thrown >= 0 && !qFall ? qbPose(null, thrown) : null
  const caught = snapped && age >= SNAP_MS
  const throwX = qb.x + s * 30
  const qw = walk(g, `qb${g.i}`, qb.x, qb.d, 8)
  const qCheer = res?.kind === 'clean' && thrown > 650
  put(qb.x, fy(qb.d), us, {
    dir: arm ? 'up' : 'up', pose: arm ?? (qFall ? null : qCheer ? 'point-up' : caught ? (qw.step != null ? null : 'qb-set') : 'ready'), step: arm || qFall ? null : qw.step,
    carry: caught && thrown < 0 && !sack, fall: qFall, fallX, z: sack ? fy(qb.d) - 1 : undefined, skin: skinOf(9), number: 9, size: SIZE, ...who.qb,
  })
  // the man on him
  const wr = walk(g, `ru${g.i}`, ru.x, ru.d, 7)
  const R = { dir: 'down', skin: skinOf(11), number: DL_NUM[0], size: SIZE, ...(rep.moves[0] === 'pickup' ? (rep.blitz === 'blitz' ? named(who.lb) : named(who.dl[1])) : named(who.dl[0])), step: null, pose: 'stance', squat: 0, lead: true }
  if (rep.moves[0] === 'pickup') R.number = rep.blitz === 'blitz' ? (who.lb?.number ?? 54) : (who.dl[1]?.number ?? DL_NUM[1])
  const party = sack ? clamp((s2 - 560) / 170, 0, 1) : 0
  // his stance gives it away: a bull sits low and heavy in it, a speed rusher's up high and leaning to the edge
  // (a counter sets up the same as a speed rush: it's sold as one)
  if (!snapped && !rep.flag) {
    if (rep.moves[0] === 'bull') R.squat = 0.14
    else if (rep.moves[0] !== 'pickup') R.lean = s * 0.07
  }
  if (snapped) {
    if (party >= 1) { R.pose = rep.k % 2 ? 'point-up' : 'flex'; R.dir = 'down'; R.z = fy(qb.d) + 1 }
    else if (sack) { R.dir = sideName(fallX); R.pose = 'wrap'; R.fall = qFall; R.fallX = fallX; R.z = fy(qb.d) + 1 }
    else if (rep.pancake) { R.fall = clamp((g.t - rep.stoneAt - 60) / 300, 0, 1); R.fallX = rep.pancake.side; R.pose = R.fall > 0 ? null : 'back'; R.dir = R.fall > 0 ? sideName(rep.pancake.side) : 'down' }
    else if (g.t - rep.swipeAt < 220) { R.pose = s < 0 ? 'swipe-l' : 'swipe-r' }
    else if (rep.doom || rep.hurry || ex?.type === 'recover' || res?.kind === 'pressure') { R.step = wr.step; R.pose = wr.step == null ? 'block' : null; R.dir = dirFrom(wr, 'down') }
    else if (ex?.type === 'anchor') { R.pose = 'block'; R.squat = g.t < ex.contactAt ? 0.16 : 0.1 }
    else if (!ex || ex.type === 'punch' && g.t >= ex.contactAt) R.pose = g.t - rep.stoneAt < 160 ? 'back' : 'block'
    else { R.step = wr.step; R.pose = wr.step == null ? 'block' : null; R.dir = dirFrom(wr, 'down') }
  }
  put(ru.x, fy(ru.d), them, R)
  // him: back to the camera, kick-sliding, punching, sitting down in his anchor
  const wm = walk(g, `me${g.i}`, me.x, me.d, 7)
  const M = { size: SIZE, number: 76, skin: skinOf(4), ...who.me, dir: 'up', pose: 'stance', step: null, squat: 0, lead: true }
  let mdy = 0
  if (snapped) {
    const punch = clamp(1 - (g.t - rep.punchAt) / 160, 0, 1)
    if (res?.kind === 'clean' && thrown > 700) { M.pose = g.i === g.plan.length - 1 && g.done?.hit ? 'flex' : 'arms-up'; M.dir = g.i === g.plan.length - 1 && g.done?.hit ? 'down' : 'up' }
    else if (rep.pancake && g.t - rep.stoneAt > 520) { M.pose = 'point-up'; M.dir = 'up' }
    else if (punch > 0) { M.pose = 'block'; mdy = punch * 6 }
    else if (ex?.type === 'anchor' && g.t >= ex.contactAt) { M.pose = 'block'; M.squat = ex.held && g.held ? 0.12 : 0.04 }
    else if (wm.step != null) { M.step = wm.step; M.pose = Math.abs(wm.dx) > Math.abs(wm.dy) ? 'slide' : 'back' }
    else M.pose = 'block'
  }
  put(me.x, fy(me.d + mdy), us, M)
  tagsAll(res && since > 700)   // (the snap's over: every man's name)
  action(ctx, view)
  // the ball: on the ground under the centre, back to the QB on the snap, away down the field when he throws
  if (!snapped) {
    const q = tilt(view, g.CX, fy(3))
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 1.5, 8.5 * q.s, 2.8 * q.s, 0, 0, Math.PI * 2); ctx.fill()
    airBall(ctx, q.x, q.y - 4 * q.s, { axis: [0.18, 1, 0.3], len: 18 * q.s, spin: 0 })
  } else if (age < SNAP_MS) {
    const f = age / SNAP_MS
    ballInAir(ctx, view, g.CX, lerp(fy(3), fy(QB_GUN), f), 14 + f * 14, 0, 1.1)
  }
  if (thrown >= 0 && thrown < 700 && !sack) {
    const f = thrown / 700, to = fy(QB_SET + 520)
    ballInAir(ctx, view, lerp(qb.x, throwX, f), lerp(fy(qb.d), to, f), 34 + Math.sin(f * Math.PI) * 60, Math.atan2(throwX - qb.x, to - fy(qb.d)), 1.1)
  }
  // the punch: a ring closes on him, and it lands as it meets him
  if (ex?.type === 'punch' && g.t < ex.late) {
    const k = clamp((g.t - ex.at) / Math.max(1, ex.contactAt - ex.at), 0, 1.25)
    const p = tilt(view, ru.x, fy(ru.d)), y = p.y - 46 * p.s * SIZE * 0.6
    const R0 = 9 * p.s, rad = lerp(34 * p.s, R0, Math.min(1, k)) - Math.max(0, k - 1) * 10 * p.s
    ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(245,220,138,.85)'
    ctx.beginPath(); ctx.arc(p.x, y, R0, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = k >= 0.9 ? '#fff' : 'rgba(255,255,255,.75)'; ctx.lineWidth = 2.6
    ctx.beginPath(); ctx.arc(p.x, y, Math.max(2, rad), 0, Math.PI * 2); ctx.stroke()
  }
  // the pop of a punch: three short lines where the pads meet
  const popK = clamp(1 - (g.t - rep.punchAt) / 170, 0, 1)
  if (popK > 0) {
    const a = tilt(view, (me.x + ru.x) / 2, fy((me.d + ru.d) / 2)), sp = a.s * SIZE * 0.6, o = (1 - popK) * 7
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4 * sp; ctx.lineCap = 'round'
    ctx.beginPath()
    for (const d of [-0.9, 0, 0.9]) {
      const dx = Math.sin(d), dy = -Math.cos(d), yy = a.y - 40 * sp
      ctx.moveTo(a.x + dx * (9 + o) * sp, yy + dy * (9 + o) * sp); ctx.lineTo(a.x + dx * (16 + o) * sp, yy + dy * (16 + o) * sp)
    }
    ctx.stroke()
  }
  // the anchor: how long he's held, in a ring over his back
  if (ex?.type === 'anchor' && g.t >= ex.contactAt) {
    const p = tilt(view, me.x, fy(me.d)), y = p.y - 92 * p.s * SIZE * 0.6, f = clamp(ex.holdMs / g.stallMs, 0, 1)
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(6,10,12,.75)'; ctx.beginPath(); ctx.arc(p.x, y, 11, 0, Math.PI * 2); ctx.stroke()
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(p.x, y, 11, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = ex.held && g.held ? GOOD : BAD; ctx.beginPath(); ctx.arc(p.x, y, 11, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke()
  }
  g.dirt.draw(ctx, g.t)
  ctx.restore()
  vignette(ctx, view0)
  // the clean ones: the building's up, and on a perfect day the paper comes down
  if (g.done?.hit && g.perfect && g.i === g.plan.length - 1 && since > 900 && !g.rain && !lightFx()) {
    g.rain = true
    for (let i = 0; i < 3; i++) g.paper.burst('confetti', 60 + i * 120, 40, g.t, { n: 12, ang: Math.PI / 2, spread: 1.1, speed: 1.1, colors: [us.color, us.trim, '#ffffff'], life: 2600, s: 1.3 })
  }
  g.paper.draw(ctx, g.t)
  // the cadence, over the QB
  if (g.phase === 'set' && !rep.flag) {
    const q = scr(qb.x, qb.d), y = q.y - 80 * q.s
    const hutAt = g.tell.hard ? rep.hardAt : null
    if (hutAt != null) {
      const a = g.t - hutAt, k = 1 + 0.3 * (1 - easeOut(clamp(a / 90, 0, 1)))
      ctx.save(); ctx.translate(q.x, y); ctx.scale(k, k); text(ctx, 'HUT', 0, 0, { font: DISPLAY, size: 26, color: GOLD }); ctx.restore()
    } else text(ctx, 'SET', q.x, y, { font: DISPLAY, size: 22, color: 'rgba(255,255,255,.82)' })
  } else if (snapped && age < 300) {
    const q = scr(qb.x, qb.d), k = 1 + 0.3 * (1 - easeOut(clamp(age / 90, 0, 1)))
    ctx.save(); ctx.translate(q.x, q.y - 80 * q.s); ctx.scale(k, k); text(ctx, "HUT!", 0, 0, { font: DISPLAY, size: 28, color: '#fff' }); ctx.restore()
  }
  // the pocket clock: how long the QB has had it, in the corner under the title bar
  if (snapped && !rep.flag) {
    const held = Math.min(res ? res.at : g.t, rep.snapAt + rep.Q) - rep.snapAt
    const col = sack ? BAD : res?.kind === 'clean' ? GOOD : '#fff'
    ctx.fillStyle = 'rgba(5,8,11,.86)'; ctx.fillRect(view0.w - 132, 48, 132, 28)
    text(ctx, 'POCKET', view0.w - 70, 63, { font: LABEL, size: 15, align: 'right', color: GOLD, track: 0.5 })
    text(ctx, (Math.max(0, held) / 1000).toFixed(1), view0.w - 10, 63, { font: DISPLAY, size: 22, align: 'right', color: col })
  }
  if (g.phase === 'set') { if (g.warmFor !== 1) { g.warmFor = 1; g.warmed = 0; g.warmL = warmList(g, us, them) } warm(g, g.warmL) }
}
