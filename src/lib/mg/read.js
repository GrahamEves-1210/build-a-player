// Read: four plays. There's one right answer on each and the only way to know it is to read the play:
// nothing on the field is painted. From the second play there can be a bait: someone who looks right,
// with the reason he isn't there to see if you scan. Tapping the bait, tapping early or tapping the
// wrong man is a miss, and the clock is in the scene: the pocket, the hole, the ball, the shot.
//   hot-read     11 on 11: tap the open receiver to throw it to him
//   gap          RB behind a real line: tap the side of the hole the blocks open
//   jump-route   you're the deep safety, the corners are on their men: tap the receiver who beats his corner
//   zone-drop    the linebacker's: a hook dropper off the ball, short and intermediate routes through his zone. Tap the man the QB throws to
//   pnr         5 on 5: the screen comes, the coverage decides. Tap the handler, the roller or the corner
//   rim-protect  a 3-on-1 fast break: they move it as they come, one goes up: tap him and go block it
//
// The rules are in make(); what can be tapped moves by formula there, so it plays the same with no
// screen. Everyone else on the picture is a body with a target and a top speed, stepped in draw()
// (bodies below): they run out of room and bump into each other, they can't teleport or pass through.
import { reactMs } from '../minigames.js'
import { clamp, lerp, prog, outcome, rngOf, easeOut, layer, themOf, football, basketball, text, circle, COURT_FT, DISPLAY, manOf, xiOf, paceOf, keyCap, THREE_KEYS, particles, nudge, reduceMotion } from './kit.js'
import { crowdRows, goalPosts, tilt, ground, stands, floodlight, vignette, athlete, paintGrass, skinOf, dirOf, airBall as artBall, ballShadow, nameTag, breakupPose, crowdPop } from './art.js'
import { paintFieldFlat, qbPose, snapBall, SNAP_MS, looseBall } from './throw.js'
import { arenaCam, dolly, arenaStage, manAt, POSE, RUN as RUN_F, liftPose, tapGap, chestOf, tagAt, tagsDown, flyTo, dropThrough, shotApex, hoopWith, AB } from './arena.js'
import { ballIn, easedState, easedPose, newPose, copyPose, smoothT, CLK, IN_HANDS, PT, FIG_FT, BALL_R, RIM_Y as RIM_FT, pose as figPose, project } from './meter.js'

export const how = {
  'hot-read': 'Tap the receiver who gets open. Not the one with a defender closing on him.',
  gap: 'Tap the side of the hole the blocks really open. A backer filling it means no.',
  'jump-route': "Deep safety. When a receiver beats his corner, tap him and jump the route. Not the double move.",
  'zone-drop': "Hook zone. Drop to the landmark and read the QB: when he opens to a man working through, tap him and break on it. Not the first look.",
  pnr: 'Big drops: tap the handler to shoot. Trap: tap the roller. Help tags the roller: tap the far corner.',
  'rim-protect': 'Three on one, coming at the rim. When one goes up, tap him and block it. Too soon and he goes by.',
}

const WORDS = {
  'hot-read':    { wait: 'FIND THE OPEN MAN', good: 'COMPLETE', wrong: 'PICKED OFF', bait: 'ROBBED', early: 'THREW IT EARLY', late: 'SACKED', win: 'DIALED IN', lose: 'NO READ', flight: 340, baitFlight: 520, stampY: 0.885, stampSize: 46, reach: 1.11, open: 'OPEN', n: 4, tap: 46, floor: 840, after: 1.6, decoy: [0, 0.55, 0.8, 0.9] },
  gap:           { wait: 'READ THE BLOCKS', good: 'NICE RUN', wrong: 'STUFFED', bait: 'BACKER FILLED', early: 'TOO EARLY', late: 'STUFFED', win: 'MOVING THE CHAINS', lose: 'NO GAIN', flight: 240, stampY: 0.885, stampSize: 46, open: 'THE HOLE', n: 3, floor: 850, decoy: [0.35, 0.7, 0.85, 0.9], beat: 1300 },
  'jump-route':  { wait: 'READ THE QB', good: 'PICK', wrong: 'WRONG MAN', bait: 'DOUBLE MOVE', early: 'TOO SOON', late: 'CAUGHT', far: 'BIG GAIN', win: 'BALL HAWK', lose: 'TORCHED', flight: 340, stampY: 0.885, stampSize: 46, open: 'OPEN', n: 4, tap: 46, floor: 930, after: 1.9, afterGood: 2.6, decoy: [0, 0.55, 0.8, 0.9] },
  // (wrong man or late, the ball's complete in the window he left: a big gain. The bait is the QB looking him off)
  'zone-drop':   { wait: 'EYES ON THE QB', good: 'PICK', wrong: 'BIG GAIN', bait: 'LOOKED OFF', early: 'JUMPED IT EARLY', late: 'BIG GAIN', far: 'BIG GAIN', win: 'SHUT DOWN', lose: 'PICKED APART', flight: 300, stampY: 0.885, stampSize: 46, open: 'OPEN', n: 4, tap: 46, floor: 930, after: 1.9, afterGood: 2.6, decoy: [0, 0.55, 0.8, 0.9] },
  pnr:          { wait: 'READ THE COVERAGE', good: 'BUCKET', wrong: 'STOLEN', bait: 'STOLEN', early: 'STOLEN', late: 'STRIPPED', win: 'FLOOR GENERAL', lose: 'TURNOVERS', flight: 560, stampY: 0.84, open: 'OPEN', n: 3, tap: 50, floor: 985, after: 1.15, decoy: [0, 0.55, 0.8, 0.9] },
  'rim-protect': { wait: 'WATCH THE BALL', good: 'BLOCKED', wrong: 'WRONG MAN', bait: 'TOO SOON', early: 'TOO SOON', late: 'OVER HIM', win: 'SHUT DOWN', lose: 'SCORED ON', flight: 240, stampY: 0.84, open: 'HIM', n: 3, tap: 52, floor: 435, per: 0.42, after: 1.9, afterGood: 2.5, decoy: [0, 0, 0, 0] },
}
const NOTES = { wrong: 'Wrong read', bait: 'Took the bait', early: 'Went early', late: 'Too slow', far: 'Tackled too deep' }
// A real scan takes time and a read should feel earned, so the floor is high (each game's own: W.floor)
// and the difficulty is in the bait. The grade buys the first plays the most time.
const WINDOWS = [{ add: 80, per: 0.55 }, { add: 40, per: 0.45 }, { add: 10, per: 0.25 }, { add: 0, per: 0.14 }]
const PRE = 320          // the set before the snap: a press here counts for nothing
const REACT_FLOOR = 600  // the scan itself: free for the score
const FLASH = 600        // how long an early bait looks right
const PASS_MS = 210      // a pass in the 3-on-1: flat and quick
const windowMs = (v, k, W) => { const w = WINDOWS[k] ?? WINDOWS[3]; return ((W.floor ?? 840) + w.add + (reactMs(v) - reactMs(1)) * w.per * (W.per ?? 1)) * (W.reach ?? 1) }

function planPnr(p, k, r, W, last) {
  // the coverage is the read: drop → the handler shoots. Hedge or trap → the roller. Tag → the corner.
  let open = Math.floor(r() * 3)
  if (open === last && r() < 0.7) open = (open + 1 + Math.floor(r() * 2)) % 3
  p.open = open
  p.delay = PRE + 640 + r() * 340
  if (r() < (W.decoy[k] ?? 0.8)) {
    const early = open !== 2 && r() < 0.45
    const dk = open === 2 ? 1 : open === 0 && early ? 1 : 2
    p.decoy = { k: dk, early, at: early ? PRE + (p.delay - PRE) * (0.35 + r() * 0.25) : p.delay, flash: 480 }
  } else p.decoy = null
}
function planRim(p, k, r) {
  // who ends up with it: the ball goes round, a pass at a time, and any catch could be the shot
  const passes = k === 0 ? 1 + Math.floor(r() * 2) : 1 + Math.floor(r() * 3)
  let t = PRE + 260 + r() * 200, who = 1
  p.seq = []
  for (let i = 0; i < passes; i++) {
    const to = (who + 1 + Math.floor(r() * 2)) % 3
    p.seq.push({ to, at: t })
    who = to
    t += PASS_MS + 230 + r() * 190
  }
  p.open = who
  p.delay = t
  p.decoy = null
}

// Who's who on the field, from the real rosters (all null in practice: each man keeps the scene's own look).
// A route's man: X, the slot, the tight end, Z. Linemen keep their number and face; on the ball at this
// camera they're too tight for names, so only Gap, with room between them, tags them.
const ROUTE_MEN = [['wr', 0], ['wr', 2], ['te', 0], ['wr', 1]]
const HOT_DB = [0, 2, -1, 1]    // on X, the slot, Z; the Sam on the tight end has no data
const J_DB = [1, 3, 4, 2]       // us.db[0] is the safety himself
const bare = m => m && { number: m.number, skin: m.skin }
// (a lineman on the ball: named, but his name shows once the play's over, so five side by side never cover the numbers)
const quiet = m => m && { ...m, quiet: true }
function fieldWho(game, cast) {
  if (game === 'zone-drop') return zoneWho(cast)
  const off = game === 'jump-route' ? 'them' : 'us', dfn = off === 'us' ? 'them' : 'us'
  if (cast?.[off]?.xi && cast?.[dfn]?.xi) return xiWho(game, cast, off, dfn)
  const ol = [0, 1, 2, 3, 4].map(i => manOf(cast, off, 'ol', i)), db = i => (i < 0 ? null : manOf(cast, dfn, 'db', i))
  const on = game === 'jump-route' ? J_DB : HOT_DB
  return {
    qb: manOf(cast, off, 'qb', 0), rb: manOf(cast, off, 'rb', 0), rbPace: paceOf(cast, off, 'rb', 0),
    rcv: ROUTE_MEN.map(([gr, i]) => manOf(cast, off, gr, i)),
    pace: ROUTE_MEN.map(([gr, i]) => paceOf(cast, off, gr, i)),
    ol: game === 'gap' ? ol : ol.map(bare),
    // in the order of each scene's defenders: hot-read's S.all, jump-route's corners, gap's safeties
    def: game === 'gap' ? [db(0), db(1)] : game === 'hot-read' ? [...on.map(db), null, null, db(3)] : on.map(db),
    cpace: on.map(i => (i < 0 ? 1 : paceOf(cast, dfn, 'db', i))),
    sPace: [paceOf(cast, dfn, 'db', game === 'gap' ? 0 : 3), paceOf(cast, dfn, 'db', 1)],
    safety: game === 'jump-route' ? manOf(cast, 'us', 'db', 0) : null,
    // the front four, when the roster has them: on the ball they keep a number and a face, and Gap tags them too
    dl: [0, 1, 2, 3].map(i => (cast?.[dfn]?.dl?.length > i ? (game === 'gap' ? manOf(cast, dfn, 'dl', i) : bare(manOf(cast, dfn, 'dl', i))) : null)),
  }
}
// The full eleven a side, every man real (career's xi). Speeds as before, from the same men's groups.
//   hot-read: the corners on X and Z, the nickel on the slot, the Sam on the tight end, the two backers, the deep safety
//   gap: the front four, the three backers, the two safeties
//   jump-route: the build is the safety; the other DBs take the routes (corners outside, the nickel on the slot, a safety on the tight end)
function xiWho(game, cast, off, dfn) {
  const x = (side, spot, i) => xiOf(cast, side, spot, i)
  const ol = [0, 1, 2, 3, 4].map(i => x(off, 'ol', i)), dl = [0, 1, 2, 3].map(i => x(dfn, 'dl', i))
  const line = game === 'gap' ? m => m : quiet
  const cbs = (cast[dfn].xi.cb ?? []).filter(m => !m.me), ss = (cast[dfn].xi.s ?? []).filter(m => !m.me)
  const def = game === 'gap' ? [x(dfn, 's', 0), x(dfn, 's', 1)]
    : game === 'hot-read' ? [x(dfn, 'db', 0), x(dfn, 'db', 4), x(dfn, 'lb', 2), x(dfn, 'db', 1), x(dfn, 'lb', 0), x(dfn, 'lb', 1), x(dfn, 'db', 2)]
      : [cbs[0] ?? null, cbs[2] ?? ss[1] ?? null, ss[0] ?? null, cbs[1] ?? null]
  const on = game === 'jump-route' ? J_DB : HOT_DB
  return {
    qb: x(off, 'qb', 0), rb: x(off, 'rb', 0), rbPace: paceOf(cast, off, 'rb', 0),
    rcv: ROUTE_MEN.map(([gr, i]) => x(off, gr, i)),
    pace: ROUTE_MEN.map(([gr, i]) => paceOf(cast, off, gr, i)),
    ol: ol.map(line), dl: dl.map(line), lb: [0, 1, 2].map(i => x(dfn, 'lb', i)), def,
    cpace: on.map(i => (i < 0 ? 1 : paceOf(cast, dfn, 'db', i))),
    sPace: [paceOf(cast, dfn, 'db', game === 'gap' ? 0 : 3), paceOf(cast, dfn, 'db', 1)],
    safety: game === 'jump-route' ? manOf(cast, 'us', 'db', 0) : null,
  }
}
// Zone drop: the build is a backer (us.lb[0], or the eleven's own man). The four who can be tapped: X, the slot, the
// tight end, the back; Z runs off with his corner. def: the corners on X and Z, the two safeties, the nickel, the Sam
const ZONE_MEN = [['wr', 0], ['wr', 2], ['te', 0], ['rb', 0]]
function zoneWho(cast) {
  const pace = ZONE_MEN.map(([gr, i]) => paceOf(cast, 'them', gr, i)), me = paceOf(cast, 'us', 'lb', 0)
  if (cast?.them?.xi && cast?.us?.xi) {
    const x = (side, spot, i) => xiOf(cast, side, spot, i), d = cast.us.xi, not = l => (l ?? []).filter(m => !m.me)
    const cbs = not(d.cb), ss = not(d.s), lbs = not(d.lb)
    return {
      qb: x('them', 'qb', 0), rcv: ZONE_MEN.map(([gr, i]) => x('them', gr, i)), z: x('them', 'wr', 1), pace, cpace: [1, 1, 1, 1],
      ol: [0, 1, 2, 3, 4].map(i => quiet(x('them', 'ol', i))), dl: [0, 1, 2, 3].map(i => quiet(x('us', 'dl', i))),
      def: [cbs[0], cbs[1], ss[0], ss[1], cbs[2] ?? ss[2], lbs[0]].map(m => m ?? null),
      me: (d.lb ?? []).find(m => m.me) ?? manOf(cast, 'us', 'lb', 0), sPace: [me, 1],
    }
  }
  const db = i => manOf(cast, 'us', 'db', i)
  return {
    qb: manOf(cast, 'them', 'qb', 0), rcv: ZONE_MEN.map(([gr, i]) => manOf(cast, 'them', gr, i)), z: manOf(cast, 'them', 'wr', 1), pace, cpace: [1, 1, 1, 1],
    ol: [0, 1, 2, 3, 4].map(i => bare(manOf(cast, 'them', 'ol', i))),
    dl: [0, 1, 2, 3].map(i => (cast?.us?.dl?.length > i ? bare(manOf(cast, 'us', 'dl', i)) : null)),
    def: [db(0), db(1), db(2), db(3), db(4), cast?.us?.lb?.length > 1 ? manOf(cast, 'us', 'lb', 1) : null],
    me: manOf(cast, 'us', 'lb', 0), sPace: [me, 1],
  }
}

export function make({ v, seed, def, game, cast }) {
  const W = WORDS[game] ?? WORDS['hot-read']
  const r = rngOf(seed)
  const quick = def?.quick ?? 1
  const n = W.n, tapped = W.tap != null, routes = game === 'hot-read' || game === 'jump-route' || game === 'zone-drop'
  const jumpy = JUMPY[game] ?? null      // the defender's games: the safety's Jump the Route, the backer's Zone Drop
  const onCourt = game === 'pnr' || game === 'rim-protect'
  const rounds = def?.rounds ?? 4
  const who = game === 'hot-read' || game === 'gap' || jumpy ? fieldWho(game, cast) : null
  let lastOpen = -1, yard = Math.floor(r() * 236)
  const plan = Array.from({ length: rounds }, (_, k) => {
    const p = {
      T: windowMs(v, k, W), at: 0, res: null, yard: (yard += 50 + Math.floor(r() * 60)),
      dir: r() < 0.5 ? -1 : 1,                       // which way a thing breaks when it could go either
      ph: [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28],                                       // each man's own route
      side: [r() < 0.5 ? -1 : 1, r() < 0.5 ? -1 : 1, r() < 0.5 ? -1 : 1, r() < 0.5 ? -1 : 1],     // which shoulder his man plays
      flip: r() < 0.5,                               // which way the formation lines up
      big: r() < 0.14,                               // gap: this one breaks long if he hits it
    }
    if (game === 'pnr') planPnr(p, k, r, W, lastOpen)
    else if (game === 'rim-protect') planRim(p, k, r)
    else {
      let open = Math.floor(r() * n)
      if (open === lastOpen && r() < 0.6) open = (open + 1 + Math.floor(r() * (n - 1))) % n
      const other = (open + 1 + Math.floor(r() * (n - 1))) % n
      p.open = open
      p.delay = (PRE + (k === 0 ? 500 : 380) + (routes ? 120 : 0) + r() * 400) * lerp(1, quick, 0.6)
      const early = r() < 0.5
      p.decoy = r() < (W.decoy[k] ?? 0.8) ? { k: other, early, at: early ? PRE + (p.delay - PRE) * (0.2 + r() * 0.25) : p.delay } : null
    }
    lastOpen = p.open
    if (routes) {
      p.stem = ROUTES.map(s => lerp(s.stem[0], s.stem[1], r()))
      p.ang = ROUTES.map(s => lerp(s.ang[0], s.ang[1], r()))
      p.cut = ROUTES.map(s => s.cut * lerp(0.92, 1.15, r()))
      // about half the plays go deep: a long stem, then a go, a post or a corner
      if (game === 'jump-route' && r() < 0.5) {
        p.deep = true
        p.delay += 420 + r() * 480
        const kind = r()
        p.cut[p.open] = kind < 0.34 ? 0 : (kind < 0.67 ? 1 : -1) * (0.38 + r() * 0.3)
      }
      if (game === 'zone-drop') { p.zone = true; p.zstem = ZR.map(s => lerp(s.stem[0], s.stem[1], r())) }   // (the routes that aren't the read: how far they go before they break)
      p.pace = who.pace; p.cpace = who.cpace       // how fast each man really is, and the man on him
    }
    return p
  })
  if (game !== 'pnr' && game !== 'rim-protect' && rounds > 1 && !plan.some(p => p.decoy)) { const p = plan[rounds - 1]; p.decoy = { k: (p.open + 1) % n, early: false, at: p.delay } }
  // Zone drop's bait is the QB looking him off: his eyes go to a man settling in front of the backer first, then he comes
  // back to the real one behind it. (Always the first look, and done with before the real break: the read is the second)
  if (game === 'zone-drop') for (const p of plan) if (p.decoy) { p.decoy.early = true; p.decoy.flash = 460; p.decoy.at = PRE + 240 + r() * 140; p.delay = Math.max(p.delay, p.decoy.at + 540) }
  const pace = courtPace(game, cast)
  if (pace) for (const p of plan) p.pace = pace

  const where = { 'hot-read': routeOf, 'jump-route': routeJ, 'zone-drop': routeZ, pnr: pnrAt, 'rim-protect': rimAt }[game]
  const place = (rep, age) => { for (let k = 0; k < n; k++) { const p = where(rep, k, age, g.h); g.men[k].x = p.x; g.men[k].y = p.y } }
  const g = {
    t: 0, game, zones: tapped ? 'none' : 'three', aim: tapped, fx: [], done: null, outro: 1500, stamp: null, later: null,
    plan, i: 0, rep: plan[0], W, who,
    nudge: nudge(), dirt: particles(30, Math.floor(rngOf(`${seed}|look`)() * 1e6)), look: Math.floor(rngOf(`${seed}|look2`)() * 1e6),
    // what the play is showing on each man right now: null, 'open' or 'bait'. Nothing marks it: it's
    // in how the men move. (This is what a bot gets to read, at the price of a scan.)
    cues: Array.from({ length: n }, () => null),
    // the men who can be tapped: where they are, in the units a tap arrives in. draw() keeps h right.
    h: 700, men: tapped ? Array.from({ length: n }, () => ({ x: 0, y: 0 })) : null, cam: { w: 360, h: 700 },
    // where a man's body is on the screen: his chest, above the field point under his feet
    keyTargets: tapped ? () => {
      if (g.done || g.rep.res) return null
      const out = Array.from({ length: n }, (_, m) => { const q = g.aimAt(m); return { x: q.x, y: q.y } })
      // pick-and-roll's keys never move: SPACE shoots, up to the big, and only the arrow on the side the shooter's on
      if (game === 'pnr') {
        Object.assign(out[0], { label: 'SPACE', keys: [' ', 'Enter'] })
        Object.assign(out[1], { label: THREE_KEYS[1], keys: ['ArrowUp'] })
        const left = out[2].x < 180
        Object.assign(out[2], { label: left ? THREE_KEYS[0] : THREE_KEYS[2], keys: [left ? 'ArrowLeft' : 'ArrowRight'] })
      }
      return out
    } : null,
    // (the screen's height came in with the first picture, or changed: the men put where it says, before a ring is drawn on them)
    reh(h) { if (g.h === h) return; g.h = h; if (tapped && !g.rep.res) place(g.rep, Math.max(0, g.t - g.rep.at)) },
    aimAt(m) {
      if (onCourt) return chestOf(courtCam(g).cam, xFt(g.men[m].x), zFt(g.men[m].y, g.h), {})
      const q = tilt(g.cam, g.men[m].x, g.men[m].y); return { x: q.x, y: q.y - 24 * q.s }
    },
    hud: { prompt: W.wait, dots: plan.map(() => null) },
    tick(dt) {
      g.t += dt
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      const rep = g.rep
      if (rep.res) {
        if (!g.done && g.t - rep.res.at >= rep.res.beat) next()
        return
      }
      const age = g.t - rep.at, d = rep.decoy
      for (let k = 0; k < n; k++) g.cues[k] = null
      if (d && age >= d.at && (!d.early || age < d.at + (d.flash ?? FLASH))) g.cues[d.k] = 'bait'
      if (age >= rep.delay) g.cues[rep.open] = 'open'
      if (tapped) place(rep, age)
      if (game === 'rim-protect') g.carrier = carrierAt(rep, age)
      if (age > rep.delay + rep.T) settle('late', rep.open)
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      const rep = g.rep
      if (rep.res) return
      let k = a.zone
      if (tapped) {
        // it goes to the man you touched: the nearest one, as long as you were near someone
        k = -1
        let best = W.tap
        for (let m = 0; m < n; m++) {
          const q = g.aimAt(m), dist = Math.hypot(q.x - a.x, q.y - a.y)
          // (on the court a close man is a big target: anywhere on his body is on him)
          if (onCourt) { const gap = tapGap(courtCam(g).cam, xFt(g.men[m].x), zFt(g.men[m].y, g.h), a.x, a.y) + dist * 0.01; if (gap < best) { best = gap; k = m } continue }
          if (dist < best) { best = dist; k = m }
        }
        if (k < 0) { g.fx.push('h:light'); return }
      } else if (k !== 0 && k !== 1 && k !== 2) return
      const age = g.t - rep.at
      if (age < PRE) return
      if (g.cues[k] === 'bait') settle('bait', k)
      else if (age < rep.delay) settle('early', k)
      else if (g.cues[k] !== 'open') settle('wrong', k)
      else settle('good', k, age - rep.delay)
    },
  }
  if (tapped) place(plan[0], 0)
  function word(kind, k, ms) {
    const rep = g.rep
    if (game === 'rim-protect' && kind === 'good') return ms <= rep.T * 0.72 ? 'BLOCKED' : 'CONTESTED'
    if (jumpy && kind === 'far') return `BIG GAIN · ${rep.gainYd} YDS`
    if (jumpy && kind === 'good') return rep.how === 'pick' ? 'PICK' : rep.how === 'swat' ? 'KNOCKED OUT' : rep.gainYd > 0 ? `${rep.gainYd} YARD GAIN` : rep.gainYd < 0 ? `${-rep.gainYd} YARD LOSS` : 'TACKLE'
    if (game === 'pnr') {
      if (kind === 'good') return k === 1 ? 'DUNK' : k === 2 ? 'THREE' : 'BUCKET'
      if (kind === 'early') return 'TOO EARLY'
      if (kind !== 'late') return k === 0 ? 'BLOCKED' : k === 1 ? 'STOLEN' : 'CLOSED OUT'
    }
    return W[kind]
  }
  function settle(kind, k, ms = 0) {
    const rep = g.rep
    if (jumpy && kind === 'good') {
      // the race: the ball's spot is fixed when he lets it go. You run at one speed from where you are.
      // (the safety from his spot deep; the backer from wherever he is in his drop, at a backer's speed)
      const J = jumpy, age = g.t - rep.at, land = jumpLand(rep, g.h), L = { ...J.route(rep, k, land, g.h) }
      const f0 = { ...J.from(rep, age, g.h) }, sy = f0.y, arrive = age + Math.hypot(L.x - f0.x, L.y - sy) / J.V
      rep.how = arrive <= land - PICK_BY ? 'pick' : arrive <= land + SWAT_BY ? 'swat' : 'tackle'
      rep.meet = land
      if (rep.how === 'tackle') {
        // he's caught it, and he's running. You take your angle at him, and it's wherever you meet
        let sx = f0.x, syy = sy, t = age
        for (; t < land + 2600; t += 16) {
          const q = J.route(rep, k, t, g.h), dx = q.x - sx, dy = q.y - syy, d = Math.hypot(dx, dy)
          if (t >= land && d <= MEET_R) break
          sx += (dx / (d || 1)) * J.V * 16; syy += (dy / (d || 1)) * J.V * 16
        }
        const q = J.route(rep, k, t, g.h), after = Math.hypot(q.x - L.x, q.y - L.y)
        rep.meet = t
        rep.gainYd = Math.round((q.y - (J.los(g.h) - 10)) / TL_PYD(g.h))   // (from the line, in the field's own yards: below zero is a loss)
        // a big gain is ground gained: downfield after the catch, not just a long way run. (A comeback caught and taken back
        // toward the line, or across the field, was called BIG GAIN on a play that lost yards)
        void after
        if (q.y - L.y > J.short) kind = 'far'
        if (J.sticks && rep.gainYd >= J.sticks) kind = 'far'   // (a backer's tackle past the sticks is still a first down)
      }
    }
    const good = kind === 'good'
    let flight = kind === 'late' ? 0 : kind === 'bait' && W.baitFlight ? W.baitFlight : W.flight
    // the safety has to get there, at a safety's speed: from his spot to the man you tapped
    if (jumpy) {
      const age = g.t - rep.at, land = jumpLand(rep, g.h)
      flight = rep.how && (good || kind === 'far') ? Math.max(0, rep.meet - age) : Math.max(0, land - age)
    }
    rep.res = { kind, k, at: g.t, ms, flight, beat: Math.max(W.beat ?? 0, flight + (good ? 420 * (W.afterGood ?? W.after ?? 1) : 620 * (W.after ?? 1))), score: good ? clamp(1 - Math.max(0, ms - REACT_FLOOR) / Math.max(1, rep.T - REACT_FLOOR), 0.35, 1) * (jumpy && rep.how !== 'pick' ? 0.6 : 1) : 0 }
    for (let m = 0; m < n; m++) g.cues[m] = null
    g.hud.dots[g.i] = good
    g.hud.prompt = null
    g.fx.push(kind === 'late' ? 'pop' : 'swoosh', good ? 'h:light' : 'h:medium')
    const txt = word(kind, k, ms)
    g.stamp = { text: txt, good, at: g.t + (jumpy ? (good ? flight : Math.min(flight * 0.5, 200)) : flight + (game === 'gap' ? 420 : 0)), ms: game === 'gap' ? 760 : jumpy ? 1500 : Math.max(460, rep.res.beat - flight), size: W.stampSize ?? (txt.length > 11 ? 30 : 38) }
    const made = plan.filter(p => p.res?.kind === 'good').length
    if (plan.every(p => p.res)) {
      const avg = plan.reduce((s, p) => s + p.res.score, 0) / rounds
      const misses = plan.filter(p => p.res.kind !== 'good')
      const outs = misses.filter(p => p.res.kind === 'late').length
      const hit = made >= rounds - 1
      const baited = misses.some(p => p.res.kind === 'bait')
      g.done = outcome(hit ? Math.max(avg, 0.5) : Math.min(avg, 0.45), hit,
        hit ? `${made} of ${rounds} reads` : baited ? `${made} of ${rounds} · took the bait` : `${made} of ${rounds}${NOTES[misses[misses.length - 1].res.kind] ? ` · ${NOTES[misses[misses.length - 1].res.kind]}` : ''}`,
        { made, of: rounds }, !hit && outs > 0 && outs >= misses.length)
      const tw = hit ? W.win : W.lose
      g.later = { text: tw, good: hit, at: g.t + rep.res.beat - 120, size: tw.length > 11 ? 32 : 46 }
    }
  }
  function next() {
    g.i++
    g.rep = plan[g.i]
    g.rep.at = g.t
    g.stamp = null
    g.hud.prompt = W.wait
    if (tapped) place(g.rep, 0)
  }
  return g
}

// ── Bodies: the picture's own physics ───────────────────────────────────────
const body = (x, y) => ({ x, y, tx: x, ty: y, v: 0.1, turn: 0, moving: false })
function seek(b, dt) {
  const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy), s = Math.min(b.v * dt, d)
  b.moving = d > 1.5
  if (d > 0.01) { b.x += (dx / d) * s; b.y += (dy / d) * s }
}
// two bodies can't share the ground. w: how much of the push goes on a (the rest on b)
function apart(a, b, min, w = 0.5) {
  const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 0.01
  if (d >= min) return false
  const o = min - d
  a.x += (dx / d) * o * w; a.y += (dy / d) * o * w
  b.x -= (dx / d) * o * (1 - w); b.y -= (dy / d) * o * (1 - w)
  return true
}
// the hard cap: whatever pushed him, nobody covers more ground than this in a step
function mark(list) { for (const b of list) { b.lx = b.x; b.ly = b.y } }
function capped(list, max, dt) {
  for (const b of list) {
    if (b.lx == null) continue
    const dx = b.x - b.lx, dy = b.y - b.ly, d = Math.hypot(dx, dy), m = max * dt
    if (d > m && d > 0) { b.x = b.lx + (dx / d) * m; b.y = b.ly + (dy / d) * m }
  }
}
const SUB = 1000 / 60
// run the picture's bodies up to the rules' time; a new play gets a new set
function stepScene(g, h, build, step) {
  if (g.simI !== g.i || !g.sim) { g.simI = g.i; g.sim = build(g.rep, h); g.simT = g.rep.at; step(g, g.rep, g.sim, 0, h, 0) }
  if (g.t - g.simT > 400) g.simT = g.t - 400
  while (g.simT < g.t) { step(g, g.rep, g.sim, SUB, h, g.simT - g.rep.at); g.simT += SUB }
  return g.sim
}
// how a man's getting about: his feet move because he's covered ground, his body faces where he's going.
// Standing or slowly drifting, step is null and he's planted. key: who he is, for the length of the game.
export function walk(g, key, x, y, stride = 8) {
  const m = g.gaits ?? (g.gaits = {}), s = m[key] ?? (m[key] = { x, y, d: 0, v: 0, dx: 0, dy: 0, t: g.t, step: null })
  const dt = g.t - s.t
  if (dt > 0) {
    let dx = x - s.x, dy = y - s.y, mv = Math.hypot(dx, dy)
    if (mv > 40) { dx = dy = mv = 0 }     // a new play: he didn't run there
    s.d += mv; s.v += (mv / dt - s.v) * Math.min(1, dt / 70)
    if (mv > 0.01) { const f = Math.min(1, dt / 90); s.dx += (dx / mv - s.dx) * f; s.dy += (dy / mv - s.dy) * f }
    s.x = x; s.y = y; s.t = g.t
  }
  s.step = s.v > 0.03 ? Math.floor(s.d / stride) % 4 : null
  return s
}
const dirFrom = (s, still) => (s.step == null ? still : dirOf(s.dx, s.dy))
// The result beat's camera: from the moment it's decided the picture pushes in on what matters, and cuts back for the next play.
// One transform over the baked stage and the sprites, nothing repainted. Nothing's tappable while it's in, so taps never see it.
// (Pair with ctx.restore() at the end of the scene. fx, fy: the point on the screen to hold.)
export function pushCam(ctx, g, view, fx, fy, to) {
  const Z = g.pcam ?? (g.pcam = { i: -1, z: 1, x: 0, y: 0, last: 0 })
  if (Z.i !== g.i) { Z.i = g.i; Z.z = 1; Z.x = fx; Z.y = fy; Z.last = g.t }
  const k = 1 - Math.exp(-(g.t - Z.last) / 200)
  Z.last = g.t
  Z.z += (to - Z.z) * k; Z.x += (fx - Z.x) * k; Z.y += (fy - Z.y) * k
  ctx.save()
  ctx.translate(clamp(view.w / 2 - Z.x * Z.z, view.w * (1 - Z.z), 0), clamp(view.h * 0.5 - Z.y * Z.z, view.h * (1 - Z.z), 0))
  ctx.scale(Z.z, Z.z)
}
const once = (o, k) => (o[k] ? false : (o[k] = true))
// the building gets up: right after the stage, every frame (the first call bakes it). rep.popAt says when
function crowd(ctx, g, view, rep, foot = null) {
  const team = g.popTeam ?? (g.popTeam = [view.colors.us, view.colors.trim])
  crowdPop(ctx, view, team, g.t - (rep.popAt ?? -1e9), { ms: 1400, power: (g.done?.hit || rep.popBig ? 0.85 : 0.6) * (foot == null ? 1 : 0.62), foot })
}
const jump = (t, i, a = 7) => Math.abs(Math.sin(t / 135 + i * 1.9)) * a
// a hit on the turf: up it comes
function hitTurf(g, view, x, y, big = 1) {
  const a = tilt(view, x, y)
  g.dirt.burst('turf', a.x, a.y, g.t, { n: Math.round(9 * big), s: a.s * 1.1, spread: 1.25 })
  g.dirt.burst('dust', a.x, a.y - 3 * a.s, g.t, { n: 3, s: a.s * 0.7, spread: 1.4 })
}

// ── The stage: a broadcast camera on the real thing ─────────────────────────
// A football ground: flat paint through the camera, under the stands, one baked picture.
// closeY: a flat-field y for the stands to come right down to (the back of an end zone), with the posts on it
export function fieldStage(ctx, view, key, paint, closeY = null) {
  const c = view.colors, hy = tilt(view, 0, 0).y
  layer(ctx, view, `${key}|${c.us}|${c.trim}`, x => {
    stands(x, view, 'field', [c.us, c.trim])
    ground(x, view, f => paint(f, view), `flat|${key}`, 0, Math.round((view.h - hy) * view.px * 0.7))
    if (closeY != null) {
      // the stands right up to the field: the same picture, nearer, its foot on the back line
      const at = tilt(view, 180, closeY - 75).y, k = at / hy
      x.save(); x.beginPath(); x.rect(0, 0, view.w, at); x.clip()
      x.translate(view.w / 2, 0); x.scale(k, k); x.translate(-view.w / 2, 0)
      stands(x, view, 'field-close', [c.us, c.trim])
      x.restore()
      goalPosts(x, view, closeY, 2.1)
    } else goalPosts(x, view, view.field?.backY)
    floodlight(x, view)
    const them = themOf(view), knots = [0.2, 0.235, 0.27, 0.4, 0.44, 0.47, 0.62, 0.655, 0.8]
    const nearest = closeY != null ? tilt(view, 180, closeY).y + 24 : 0
    knots.forEach((f, n) => {
      if (tilt(view, 0, view.h * f).y < nearest || tilt(view, 0, view.h * (1.02 - f) - 40).y < nearest) return
      // (the men on each sideline watch the field)
      athlete(x, view, -14 - ((n * 7) % 3) * 8, view.h * f, { color: c.us, trim: c.trim, pants: c.trim, skin: skinOf(n * 3), dir: 'right', pose: 'ready', size: 0.72 })
      athlete(x, view, view.w + 14 + ((n * 5) % 3) * 8, view.h * (1.02 - f) - 40, { color: them.color, trim: them.trim, pants: them.trim, skin: skinOf(n * 5 + 1), dir: 'left', pose: 'ready', size: 0.72 })
    })
  })
}
// yard numbers on the flat field, every ten yards, from a line up and back: the whole field has them
export function paintNumbers(x, view, line, band) {
  const { w, h } = view
  for (let k = -12; k <= 12; k++) {
    const y = line - k * band * 2
    if (y < 8 || y > h + 10) continue
    const n = 30 + k * 10, value = n > 50 ? 100 - n : n
    if (value <= 0) continue
    text(x, String(value), 34, y, { font: DISPLAY, size: 21, color: 'rgba(245,247,243,.62)' })
    text(x, String(value), w - 34, y, { font: DISPLAY, size: 21, color: 'rgba(245,247,243,.62)' })
  }
}
function lineColors(x, view, los, first) {
  const inset = 8
  x.fillStyle = '#3f86ff'; x.fillRect(inset, los - 1.6, view.w - inset * 2, 3.2)
  if (first != null) { x.fillStyle = '#f7d64a'; x.fillRect(inset, first - 2, view.w - inset * 2, 4) }
}
// the men on the field, drawn back to front
const CAST = []
let castN = 0
const TAGS = [], TAG_MAX = 1.15    // (a big man up close keeps a small name)
export function put(x, y, team, o) {
  const c = CAST[castN] ?? (CAST[castN] = {})
  castN++
  c.x = x; c.y = y; c.z = o.z ?? y
  c.color = team.color; c.trim = team.trim; c.pants = team.pants ?? team.trim; c.skin = o.skin ?? '#8d5a3b'
  c.number = o.number ?? null; c.dir = o.dir ?? 'up'; c.step = o.step ?? null; c.pose = o.pose ?? null
  c.carry = !!o.carry; c.size = o.size ?? 0.9; c.fall = o.fall ?? 0; c.fallX = o.fallX ?? 0; c.kit = 'pads'; c.squat = o.squat ?? 0; c.lean = o.lean ?? 0
  c.still = !!o.still || !!o.lead   // (the man the play's about: his hands are the read, so they only move as the game moves them)
  c.tag = o.name ?? null; c.quiet = !!o.quiet; c.lead = !!o.lead   // (lead: the man the play's about, named even down in his stance)
}
// once a play's over every man's name shows, the line's too (a scene sets it for the frame: action() clears it)
let TAG_ALL = false
const TAGS_AFTER = 450
export const tagsAll = on => { TAG_ALL = !!on }
export function action(ctx, view) {
  const list = CAST.slice(0, castN).sort((a, b) => a.z - b.z)
  castN = 0
  let n = 0, later = 0
  for (const c of list) {
    let p
    if (c.lean) {
      const q = tilt(view, c.x, c.y)
      ctx.save(); ctx.translate(q.x, q.y); ctx.transform(1, 0, -c.lean, 1, 0, 0); ctx.translate(-q.x, -q.y)
      p = athlete(ctx, view, c.x, c.y, c)
      ctx.restore()
    } else p = athlete(ctx, view, c.x, c.y, c)
    // (on a small canvas the linemen's names only cover the numbers)
    if (!c.tag || c.fall) continue
    const live = c.lead || !(c.quiet || (view.px < 1.6 && (c.pose === 'block' || c.pose === 'stance')))
    if (!live && !TAG_ALL) continue
    // his name goes down with him: a man nearer the camera stands in front of it
    const k = Math.min(TAG_MAX, Math.max(0.8, p.s * c.size)), w = (c.tag.length * 5.6 + 6) * k
    const tx = clamp(p.x, w / 2 + 1, view.w - w / 2 - 1)
    if (live) { nameTag(ctx, view, tx, p.y, c.tag, k); if (TAG_ALL) placed(n++, tx, p.y, w, k) }
    else (LATER[later] ??= {}), Object.assign(LATER[later++], { x: tx, y: p.y, w, k, tag: c.tag })
  }
  // once it's over, the rest of the names: each where it fits, and none on top of a name already there
  for (let i = 0; i < later; i++) {
    const t = LATER[i]
    let free = true
    for (let j = 0; j < n && free; j++) { const o = PLACED[j]; if (Math.abs(o.x - t.x) < (o.w + t.w) / 2 && Math.abs(o.y - t.y) < 8.5 * Math.max(o.k, t.k)) free = false }
    if (free) { nameTag(ctx, view, t.x, t.y, t.tag, t.k); placed(n++, t.x, t.y, t.w, t.k) }
  }
  TAG_ALL = false
}
const PLACED = [], LATER = []
const placed = (i, x, y, w, k) => Object.assign(PLACED[i] ??= {}, { x, y, w, k })
// a football in the air at a field point, z up off the ground, its shadow where it would fall
export function ballInAir(ctx, view, x, y, z, ang, size = 1) {
  const q = ballShadow(ctx, view, x, y, z)
  // (the same ball as the throwing games: ang here is 0 for straight upfield)
  artBall(ctx, q.x, q.y - z * q.s, { axis: [Math.sin(ang), Math.cos(ang), 0.15], len: (14 + z * 0.016) * size * q.s, spin: performance.now() / 180 })
}
export const teamOf = (c, side) => (side ? { color: c.them, trim: c.themTrim } : { color: c.us, trim: c.trim })

export function draw(ctx, g, view) {
  if (g.men) { g.reh(view.h); g.cam = view }
  if (g.stamp && g.stamp.y == null) g.stamp.y = view.h * g.W.stampY
  if (g.later && g.later.y == null) g.later.y = view.h * g.W.stampY
  ;(SCENES[g.game] ?? drawHot)(ctx, g, view)
  if (g.game !== 'pnr' && g.game !== 'rim-protect') vignette(ctx, view)
}

const P = { x: 0, y: 0, by: 0 }

// ── Hot read: 11 on 11 ──────────────────────────────────────────────────────
// A legal doubles set from the gun. On the line (7): X split wide, the five linemen, the tight end
// as the end man on his side. Off it (4): the slot, Z, the QB, the back. Four men run routes. The
// defense is a 4-3 over it: a corner each on X and Z, the Sam on the tight end, a safety down on the
// slot, the Mike and Will in the box, a safety deep.
//   Open: he breaks hard and his man is turned round, carried upfield, trailing.
//   Bait: he breaks just the same, but a backer or the deep safety is driving on him.
const RUN = 0.08        // route speed, logical units per ms. A break is the top of it: 0.104
const BURST = 1.3
const TOP_SPEED = 0.13  // no defender in this scene goes faster (give or take the real man's speed)
const COV_TRAIL = 18, COV_LAG = 70, COV_CARRY = 360, COV_HIPS = 380
const HOOK = [128, 232]
const OL_GAP = 24
// Third & Long's yard, on any screen
const TL_PYD = h => (Math.round(h * 0.76) - 58) / 60
// everybody's numbers, on every field
const OL_NUM = [71, 64, 55, 66, 77], DL_NUM = [94, 97, 91, 99]
const losOf = h => Math.round(h * 0.84)
const ROUTES = [
  { x: 28, y: 10, cov: 34, cut: 2.55, stem: [90, 150], ang: [-0.02, 0.3] },   // X, on the line
  { x: 94, y: 22, cov: 44, cut: 1.4, stem: [50, 100], ang: [0.3, 0.7] },      // the slot, off it
  { x: 270, y: 10, cov: 46, cut: -1.4, stem: [50, 110], ang: [-0.6, -0.2] },  // the tight end, on it
  { x: 332, y: 22, cov: 44, cut: -2.55, stem: [90, 150], ang: [-0.3, 0.02] }, // Z, off it
]
const sharpOf = (rep, k) => k === rep.open || rep.decoy?.k === k
const breakAt = (rep, k) => (k === rep.open ? rep.delay : rep.decoy?.k === k ? rep.decoy.at : PRE + rep.stem[k] / (RUN * rep.pace[k]))
// where receiver k is at this age of the play. Rules and picture both ask here.
function routeOf(rep, k, age, h) {
  const s = ROUTES[k], sharp = sharpOf(rep, k), run = RUN * rep.pace[k], d = Math.max(0, age - PRE) * run
  const stem = Math.max(0, breakAt(rep, k) - PRE) * run, a = sharp ? rep.cut[k] : rep.ang[k]
  let rest = Math.max(0, d - stem) * (sharp ? BURST : 1)
  if (k !== rep.open && rep.decoy?.k === k && rep.decoy.early) rest = Math.min(rest, 70)   // an early one settles down
  if (Math.abs(s.cut) > 2) rest = Math.min(rest, 62)   // a comeback settles, he doesn't run back to the line
  const x = s.x + Math.sin(a) * rest
  P.x = clamp(rep.flip ? 360 - x : x, 14, 346)
  P.y = losOf(h) + s.y - Math.min(d, stem) - Math.cos(a) * rest
  return P
}
function paintHot(f, view) {
  const los = losOf(view.h), pyd = TL_PYD(view.h)
  paintFieldFlat(f, view, los - 50 * pyd, pyd, view.colors.us)
  lineColors(f, view, los, los - 10 * pyd)
}
function buildHot(rep, h) {
  const los = losOf(h), S = { cov: [], lb: [], deep: null, rob: null, catcher: null, recv: [{}, {}, {}, {}] }
  for (let k = 0; k < 4; k++) {
    const p = routeOf(rep, k, 0, h)
    S.cov.push(body(clamp(p.x + rep.side[k] * 15, 14, 346), p.y - ROUTES[k].cov))
  }
  S.lb = [body(150, los - 46), body(210, los - 46)]
  S.deep = body(180, Math.max(82, los - 150))
  S.all = [...S.cov, S.lb[0], S.lb[1], S.deep]
  S.top = TOP_SPEED * Math.max(...rep.cpace)
  return S
}
function stepHot(g, rep, S, dt, h, age) {
  const res = rep.res, los = losOf(h), frozen = res ? res.at - rep.at : age
  const run = res ? frozen + Math.min(age - frozen, 260) : age, d = rep.decoy
  for (let k = 0; k < 4; k++) { const p = routeOf(rep, k, run, h); S.recv[k].x = p.x; S.recv[k].y = p.y }
  // his man. Off him at the snap and backpedalling, then the hips turn and he's on his hip, a beat behind
  // whatever he does; a real speed gap shows in that step. Only on the real break is he carried past it, and
  // only then is there daylight.
  for (let k = 0; k < 4; k++) {
    const c = S.cov[k], s = ROUTES[k], on = rep.side[k], cp = rep.cpace[k]
    const lag = routeOf(rep, k, Math.max(0, run - COV_LAG), h), lx = lag.x, ly = lag.y
    const gapY = lerp(s.cov, COV_TRAIL + (rep.pace[k] / cp - 1) * 40, clamp((run - PRE) * RUN / 60, 0, 1))
    c.tx = clamp(lx + on * 15, 14, 346); c.ty = ly - gapY; c.v = TOP_SPEED * cp
    if (sharpOf(rep, k) && run > breakAt(rep, k)) {
      const bt = breakAt(rep, k), open = k === rep.open
      if (run < bt + COV_CARRY) {
        const bp = routeOf(rep, k, bt, h)
        c.tx = clamp(bp.x + on * 15, 14, 346); c.ty = bp.y - gapY - 62; c.v = 0.09 * cp
      } else if (open || !d?.early) c.v = 0.06 * cp
      else if (run < bt + FLASH) c.v = 0.08 * cp
    }
  }
  // the zones. Mike and Will open to their hook windows and sit there, leaning to whoever's working under them
  // (off an open man: somebody else has them). The safety stays over the deepest man and rotates away from an
  // open one. One of them may be the robber.
  const opened = frozen >= rep.delay, drop = Math.min(36, Math.max(0, run - PRE) * 0.03)
  S.lb.forEach((b, i) => {
    const home = HOOK[i], kk = Math.abs(S.recv[1].x - home) < Math.abs(S.recv[2].x - home) ? 1 : 2
    const lean = clamp(S.recv[kk].x - home, -24, 24)
    b.tx = run < PRE ? b.x : home + (opened && kk === rep.open ? -lean * 0.8 : lean * 0.6)
    b.ty = los - 46 - drop; b.v = 0.075
  })
  let top = S.recv[0]
  for (let k = 1; k < 4; k++) if (S.recv[k].y < top.y) top = S.recv[k]
  const away = opened ? (S.recv[rep.open].x < 180 ? 70 : -70) : 0
  S.deep.tx = 180 + clamp(top.x - 180, -30, 30) * 0.5 + away; S.deep.ty = Math.max(82, Math.min(los - 150, top.y - 60)); S.deep.v = 0.1 * g.who.sPace[0]
  if (d && run >= d.at) {
    if (!S.rob) S.rob = d.k === 0 || d.k === 3 ? S.deep : S.recv[d.k].x < 180 ? S.lb[0] : S.lb[1]
    const t = S.recv[d.k]
    S.rob.tx = t.x + (180 - t.x) * 0.08; S.rob.ty = t.y + 20; S.rob.v = TOP_SPEED
  }
  // the ball: whoever's going to pick it off goes and gets it, takes it back, and pulls up to let everyone know
  if (res && res.kind !== 'good' && res.kind !== 'late') {
    const t = S.recv[res.k], since = age - frozen
    if (!S.catcher) S.catcher = res.kind === 'bait' && S.rob ? S.rob : S.cov[res.k]
    if (since < res.flight) { S.catcher.tx = t.x; S.catcher.ty = t.y + 22; S.catcher.v = TOP_SPEED }
    else if (since < res.flight + 620) { S.catcher.tx = S.catcher.x; S.catcher.ty = los + 400; S.catcher.v = TOP_SPEED }
    else { S.catcher.tx = S.catcher.x; S.catcher.ty = S.catcher.y; S.catcher.v = 0.02 }
  }
  mark(S.all)
  for (const c of S.all) seek(c, dt)
  // nobody shares the ground: defenders give way to each other and to the routes
  for (let a = 0; a < S.all.length; a++) {
    for (let b = a + 1; b < S.all.length; b++) apart(S.all[a], S.all[b], 22, a < 4 && b >= 4 && S.all[b] !== S.rob ? 0 : 0.5)   // (a man in the zone gives way to a man on his man)
    if (S.all[a] !== S.catcher) for (let k = 0; k < 4; k++) apart(S.all[a], S.recv[k], 20, 1)
  }
  capped(S.all, S.top, dt)
}
// which way a man in coverage is facing: eyes in on the backpedal, then running with the route; once he's
// been carried past the break he's planted and looking back at his man
function hipsHot(rep, k, run, w, b, rv) {
  if (run < PRE + COV_HIPS) return 'down'
  if (sharpOf(rep, k) && run > breakAt(rep, k) + COV_CARRY) return dirOf(rv.x - b.x, rv.y - b.y)
  return dirFrom(w, 'up')
}
const HOT_NUM = [11, 84, 87, 15], DEF_NUM = [24, 21, 29, 26, 52, 45, 38]
const RUN_ON = 0.085   // the catch and run
function drawHot(ctx, g, view) {
  const { h } = view, rep = g.rep, res = rep.res, c = view.colors
  const age = g.t - rep.at, frozen = res ? res.at - rep.at : age, since = res ? g.t - res.at : -1
  const S = stepScene(g, h, buildHot, stepHot)
  const us = teamOf(c, 0), them = teamOf(c, 1), who = g.who
  const los = losOf(h), qy = los + 52, qx = 180, snap = age >= PRE
  const sacked = res?.kind === 'late', ok = res?.kind === 'good', flight = res?.flight ?? g.W.flight
  const caught = res && !sacked && since >= flight, picked = caught && !ok
  const pushed = !!res && !reduceMotion()
  if (pushed) {
    // on the QB going down, the man it was picked by, or the man it's going to
    let fx = qx, fy = qy
    if (!sacked && !ok && S.catcher) { fx = S.catcher.x; fy = S.catcher.y }
    else if (!sacked) { const p = routeOf(rep, res.k, frozen + Math.min(since, 260), h); fx = p.x; fy = p.y - (ok ? Math.max(0, since - flight) * RUN_ON * rep.pace[res.k] : 0) }
    const q = tilt(view, fx, fy)
    pushCam(ctx, g, view, q.x, q.y - 22 * q.s, sacked ? 1.34 : 1.5)
  }
  fieldStage(ctx, view, 'hot', paintHot)
  crowd(ctx, g, view, rep)
  // the pocket: the clock of the whole play. It reaches the QB exactly when the time is up.
  const pc = frozen < rep.delay ? 0.42 * easeOut(prog(frozen, PRE, rep.delay)) : 0.42 + 0.58 * prog(frozen, rep.delay, rep.delay + rep.T)
  const runAge = res ? frozen + Math.min(since, 260) : age, rs = rep.flip ? -1 : 1
  const fall = sacked ? clamp((since - 40) / 320, 0, 1) : 0
  // coverage and the second level
  S.all.forEach((b, i) => {
    const w = walk(g, `d${i}`, b.x, b.y)
    const dir = b === S.catcher || b === S.rob ? dirFrom(w, 'down') : i < 4 ? hipsHot(rep, i, runAge, w, b, S.recv[i]) : 'down'
    const look = { skin: skinOf(i * 3 + 1), number: DEF_NUM[i], size: 0.86, ...who.def[i] }
    if (b === S.catcher && since > flight - 130) {
      // he goes up for it, he's off with it, and then he's telling everybody
      if (since < flight + 40) return put(b.x, b.y, them, { ...look, dir: 'up', pose: b.x < S.recv[res.k].x ? 'catch-r' : 'catch-l' })
      if (since > flight + 680) return put(b.x, b.y - jump(since, 1, 7), them, { ...look, dir: 'down', pose: 'arms-up', z: b.y })
    }
    // a pick: the rest of them are up. A catch: the man who was on him can't believe it
    if (picked && since > flight + 260 && b !== S.catcher) return put(b.x, b.y - jump(since, i, 5), them, { ...look, dir: 'down', pose: 'arms-up', z: b.y })
    if (ok && caught && since > flight + 340 && i === res.k) return put(b.x, b.y, them, { ...look, dir: 'up', step: null, pose: 'hips' })
    put(b.x, b.y, them, { ...look, dir, step: snap ? w.step : null, pose: snap && w.step != null ? null : 'ready', carry: b === S.catcher && since > flight })
  })
  // the front four and the five: heads down, hands on each other. The ends get round the edge.
  const push = pc * (qy - 24 - (los + 10))
  for (let i = -1; i <= 1; i += 2) {
    put(180 + i * OL_GAP * 0.72, los + push - 10, them, { dir: 'down', pose: snap ? 'block' : 'stance', skin: skinOf(i + 3), number: DL_NUM[i < 0 ? 1 : 2], size: 0.94, ...who.dl[i < 0 ? 1 : 2] })
    const held = i === rs
    const ex = 180 + i * (66 + Math.sin(pc * Math.PI) * 14 - pc * pc * (held ? 26 : 40)), ey = lerp(los - 10, held ? qy - 22 : qy - 2, pc)
    const w = walk(g, `e${i}`, ex, ey, 7)
    const wrap = sacked && !held
    // up off him, and he lets you know
    if (wrap && since > 800) { put(ex - i * 6, ey - jump(since, 0, 4), them, { dir: 'down', pose: since % 680 < 340 ? 'flex' : 'arms-up', z: ey, skin: skinOf(i + 6), number: DL_NUM[i < 0 ? 0 : 3], size: 0.94, ...who.dl[i < 0 ? 0 : 3] }); continue }
    put(ex, ey, them, { dir: wrap ? (i < 0 ? 'right' : 'left') : snap ? dirFrom(w, 'down') : 'down', step: wrap ? null : w.step, pose: wrap ? 'wrap' : snap ? (w.step == null ? 'block' : null) : 'stance', fall: wrap ? fall : 0, fallX: -i, z: wrap ? qy + 1 : undefined, skin: skinOf(i + 6), number: DL_NUM[i < 0 ? 0 : 3], size: 0.94, ...who.dl[i < 0 ? 0 : 3] })
  }
  for (let i = -2; i <= 2; i++) put(180 + i * (OL_GAP - pc * 2), los + 10 + push * (1 - Math.abs(i) * 0.12), us, { dir: 'up', pose: snap ? 'block' : 'stance', skin: skinOf(i + 11), number: OL_NUM[i + 2], size: 0.94, ...who.ol[i + 2] })
  // the receivers
  let tx = 0, ty = 0
  for (let k = 0; k < 4; k++) {
    const p = routeOf(rep, k, runAge, h), x = p.x
    let y = p.y
    if (ok && res.k === k) y -= Math.max(0, since - flight) * RUN_ON * rep.pace[k]    // he catches it and keeps going
    const w = walk(g, `r${k}`, x, y), look = { skin: skinOf(k * 2), number: HOT_NUM[k], size: 0.86, ...who.rcv[k] }
    const his = res?.k === k && !sacked
    if (his && since > flight - 130 && since < flight + 50) put(x, y, us, { ...look, dir: 'up', pose: x < qx ? 'catch-r' : 'catch-l' })   // (hands up to it)
    else if (his && picked && since > flight + 240) put(x, y, us, { ...look, dir: 'up', step: null, pose: 'hands-head' })
    else put(x, y, us, { ...look, dir: dirFrom(w, 'up'), step: snap ? w.step : null, pose: snap ? null : 'ready', carry: ok && res.k === k && since > flight })
    if (res?.k === k) { tx = x; ty = y }
  }
  // the back stays in to block, the QB in the gun
  put(qx + rs * 30, qy + 2 - pc * 14, us, { dir: 'up', pose: 'ready', skin: skinOf(5), number: 28, size: 0.86, ...who.rb })
  const arm = res && !sacked ? qbPose(null, since) : null
  // (he sees where it went: one hand up on a catch, both on his helmet on a pick)
  const qbAfter = !arm && caught ? (ok ? 'point-up' : 'hands-head') : arm
  put(qx, qy, us, { dir: arm ? (tx < qx ? 'left' : 'right') : 'up', carry: (!res || sacked) && age >= PRE + SNAP_MS && !(sacked && since > 90 && g.look % 2), fall, fallX: rs, skin: skinOf(9), number: 7, size: 0.9, pose: qbAfter, ...who.qb })
  tagsAll(res && since > flight + TAGS_AFTER)   // (the play's over: everyone's name)
  action(ctx, view)
  if (sacked && once(rep, '_hit')) { hitTurf(g, view, qx, qy, 1.3); g.nudge.kick(g.t, 6, rs * -1, 0.6, 240); g.fx.push('stamp', 'h:heavy') }
  if (caught && once(rep, '_got')) { const q = tilt(view, tx, ty); g.dirt.burst('turf', q.x, q.y, g.t, { n: 5, s: q.s, spread: 1 }); g.nudge.kick(g.t, picked ? 3 : 2, 0, 1, 150); g.fx.push(picked ? 'stamp' : 'catchball', picked ? 'h:heavy' : 'h:medium'); rep.popAt = g.t; rep.popBig = picked }
  // a strip sack, now and then: it's out, and bouncing
  if (sacked && g.look % 2 && since > 90) looseBall(ctx, view, qx - rs * 8, qy, since - 90, true)
  g.dirt.draw(ctx, g.t)
  snapBall(ctx, view, 180, los + 8, qx, qy, age - PRE)
  // the men you can throw to, circled
  if (!res) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.82)'; ctx.lineWidth = 2
    for (let k = 0; k < 4; k++) { const q = g.aimAt(k), r = tilt(g.cam, g.men[k].x, g.men[k].y).s * 27; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.stroke() }
    ctx.restore()
  }
  // the throw: to him if he's open, and it lands on whoever's going to pick it off if he isn't
  if (res && !sacked) {
    const f = clamp(since / flight, 0, 1), cb = S.catcher
    const ex = ok ? tx : cb ? cb.x : tx, ey = ok ? ty : cb ? cb.y : ty
    if (f < 1) ballInAir(ctx, view, lerp(qx, ex, f), lerp(qy, ey, f), 32 + Math.sin(f * Math.PI) * 40, Math.atan2(ex - qx, qy - ey), 1)
  }
  if (pushed) ctx.restore()
}

// ── Pick the gap ────────────────────────────────────────────────────────────
// A real front: five linemen, four down, three backers, two safeties. Every gap is a fight, breathing
// open and shut. One hole gets blocked open for real: its man is driven out AND a lineman climbs to the
// backer over it. On the bait the man is driven out but nobody gets to the backer, and he fills it.
// The back goes where you tap and runs into whatever's there: a good read gets a real gain and he's
// tackled by whoever gets to him; only sometimes, when a safety takes a bad angle, does it break long.
const YARD = 13
const OLX = [56, 118, 180, 242, 304]
const G_SIZE = 1.08
const G_LB = [52, 58, 54], G_S = [26, 38]
const lineOf = h => Math.round(h * 0.78)
const holesOf = rep => [87, rep.dir > 0 ? 211 : 149, 273]
function paintGap(f, view) {
  const line = lineOf(view.h)
  paintFieldFlat(f, view, line - 50 * YARD, YARD, view.colors.us)
  lineColors(f, view, line, line - YARD * 10)
}
function buildGap(rep, h) {
  const line = lineOf(h), H = holesOf(rep)
  const nose = rep.dir > 0 ? 149 : 211
  const S = {
    line, H,
    ol: OLX.map(x => body(x, line + 16)),
    dl: [...H, nose].map(x => body(x, line - 16)),
    lb: [87, 180, 273].map(x => body(x, line - 66)),
    s: [body(120, line - 150), body(240, line - 150)],
    qb: body(180, line + 50),
    rb: body(180 - rep.dir * 16, line + 92),
    down: false, by: null, gain: null, told: false, fall: null,
  }
  S.dl.forEach((b, i) => { b.hx = b.x; b.i = i; b.num = DL_NUM[i]; b.sk = i + 1 })
  S.ol.forEach(b => { b.hx = b.x; b.hy = b.y })
  S.lb.forEach((b, i) => { b.hx = b.x; b.hy = b.y; b.num = G_LB[i]; b.sk = i + 5; b.li = i })
  S.s.forEach((b, i) => { b.num = G_S[i]; b.sk = i + 8; b.si = i })
  S.bodies = [...S.dl, ...S.lb, ...S.s]
  S.everyone = [...S.bodies, ...S.ol, S.qb, S.rb]
  return S
}
function stepGap(g, rep, S, dt, h, age) {
  const res = rep.res, ok = res?.kind === 'good', late = res?.kind === 'late', d = rep.decoy, line = S.line, want = rep.open
  const frozen = res ? res.at - rep.at : age, since = res ? age - frozen : -1, t = g.simT
  const flow = age >= PRE ? rep.dir * 14 : 0
  // how far each hole has been blocked open
  const openBy = k => {
    let s = 0
    if (k === want && frozen >= rep.delay) {
      s = prog(frozen, rep.delay, rep.delay + 180) * (1 - prog(frozen, rep.delay + rep.T * 0.6, rep.delay + rep.T) * 0.8)
      if (ok) s = 1
      if (late) s = 0
    }
    if (d?.k === k && frozen >= d.at) {
      s = prog(frozen, d.at, d.at + 180)
      if (d.early) s *= 1 - prog(frozen, d.at + FLASH - 160, d.at + FLASH)
      else s *= 1 - prog(frozen, rep.delay + rep.T * 0.6, rep.delay + rep.T) * 0.8
    }
    return s
  }
  // every gap breathes: a hole opening a little means nothing. The man in it is what to watch.
  S.dl.forEach((b, i) => {
    const o = i < 3 ? openBy(i) : 0, sway = Math.sin(t / 230 + rep.ph[i]) * (age >= PRE ? 9 : 0)
    const out = i < 3 ? (i === 0 ? -1 : i === 2 ? 1 : rep.dir) : 0
    b.tx = b.hx + flow * 0.5 + sway * (1 - o) + out * o * 42
    b.ty = line - 16 - o * 26 + Math.sin(t / 190 + i) * (age >= PRE ? 3 : 0)
    b.v = 0.14
  })
  S.ol.forEach((b, i) => {
    const left = S.H.findIndex(x => x > b.hx && x - b.hx < 40), right = S.H.findIndex(x => x < b.hx && b.hx - x < 40)
    const gap = (left >= 0 ? -openBy(left) * 16 : 0) + (right >= 0 ? openBy(right) * 16 : 0)
    b.tx = b.hx + flow * 0.5 + gap + Math.sin(t / 260 + i * 1.7) * (age >= PRE ? 4 : 0)
    b.ty = b.hy - (age >= PRE ? 4 : 0)
    b.v = 0.14
  })
  // the climb: on the real hole a lineman gets up to the backer over it
  const climbI = OLX.findIndex(x => Math.abs(x - S.H[want]) < 40)
  const lbI = want === 0 ? 0 : want === 2 ? 2 : 1
  if (frozen >= rep.delay && climbI >= 0) { const c = S.ol[climbI]; c.tx = S.lb[lbI].x; c.ty = S.lb[lbI].y + 28; c.v = 0.16 }
  // the backers flow with the play. The bait's backer comes downhill into his hole.
  const baitI = d ? (d.k === 0 ? 0 : d.k === 2 ? 2 : 1) : -1
  S.lb.forEach((b, i) => {
    b.tx = b.hx + flow * 1.2 + Math.sin(t / 320 + i * 2) * 5; b.ty = b.hy; b.v = 0.12
    if (i === baitI && age >= d.at) { b.tx = S.H[d.k]; b.ty = line - 36; b.v = 0.17 }
  })
  S.s[0].tx = 120 + flow * 0.5; S.s[1].tx = 240 + flow * 0.5; S.s[0].ty = S.s[1].ty = line - 150 + Math.min(16, Math.max(0, age - PRE) * 0.02); S.s[0].v = 0.12 * g.who.sPace[0]; S.s[1].v = 0.12 * g.who.sPace[1]
  S.qb.tx = 180 + rep.dir * 26; S.qb.ty = line + 46; S.qb.v = 0.08
  if (res) { S.qb.tx = late ? 180 + rep.dir * 64 : S.H[res.k] < 180 ? 244 : 116; S.qb.ty = line + 58; S.qb.v = 0.15 }
  // the back: closing on the line, which is the clock. Then he goes where he's told.
  const rb = S.rb
  if (!res) {
    const near = frozen < rep.delay ? 0.3 * prog(frozen, PRE, rep.delay) : 0.3 + 0.7 * prog(frozen, rep.delay, rep.delay + rep.T)
    rb.tx = 180 + rep.dir * 12; rb.ty = lerp(line + 92, line + 72, near); rb.v = 0.16 * g.who.rbPace
  } else if (!S.down) {
    const hx = late ? 180 : S.H[res.k]
    rb.tx = hx; rb.v = 0.28 * g.who.rbPace
    // along behind the line to his hole, then up through it
    rb.ty = Math.abs(rb.x - hx) > 10 && rb.y > line + 40 ? Math.min(rb.y, line + 62) : -200
    // the pursuit once he's through
    if (ok && rb.y < line - 24) {
      S.lb.forEach((b, i) => { if (i !== lbI) { b.tx = rb.x; b.ty = rb.y - 30; b.v = 0.14 } })
      S.s.forEach((b, i) => {
        b.v = 0.16 * g.who.sPace[i]
        if (rep.big) { b.tx = rb.x + (i ? 70 : -70); b.ty = rb.y + 40 }    // a bad angle: he overruns it
        else { b.tx = rb.x; b.ty = rb.y - 14 }
      })
      // a long one angles away from the man who missed
      if (rep.big) rb.tx = rb.x
    }
    if (late && since > 60) { S.dl[3].tx = rb.x; S.dl[3].ty = rb.y - 28; S.dl[3].v = 0.24 }
  }
  const bodies = S.bodies
  mark(S.everyone)
  for (const b of bodies) seek(b, dt)
  for (const b of S.ol) seek(b, dt)
  seek(S.qb, dt)
  if (!S.down) {
    // past the line he makes his cuts: a new angle every so often, the odd sharp one
    if (ok && rb.y < line - 8) {
      if (!(g.simT < (S.cutUntil ?? 0))) {
        const b = Math.sin(g.simT * 12.9898 + g.i) * 43758.5453, u = b - Math.floor(b), juke = u < 0.1
        S.cutTo = (u * 100 % 2 < 1 ? -1 : 1) * (juke ? 40 : 8 + u * 14)
        S.cutUntil = g.simT + (juke ? 130 : 620 + u * 500)
      }
      rb.tx = clamp(rb.x + S.cutTo, 24, 336)
    }
    seek(rb, dt)
  }
  // nobody passes through anybody
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) apart(bodies[a], bodies[b], 30)
  for (let a = 0; a < S.ol.length; a++) {
    for (let b = a + 1; b < S.ol.length; b++) apart(S.ol[a], S.ol[b], 34)
    for (const m of bodies) apart(S.ol[a], m, 28)
    if (!S.down) apart(S.ol[a], rb, 28, ok ? 1 : 0.5)
  }
  apart(S.qb, rb, 28, 1)
  capped(S.everyone, 0.3, dt)
  // the hit. Anyone in front of him stops him: he's tackled where he is.
  if (res && !S.down) {
    for (const m of bodies) {
      const dist = Math.hypot(m.x - rb.x, m.y - rb.y)
      // (on a good read the down men are blocked out of it, and so is the backer the lineman climbed to)
      if (dist < 31 && !(ok && (S.dl.includes(m) || m === S.lb[lbI] || (rep.big && S.s.includes(m))))) {
        S.down = true; S.by = m
        S.fall = { at: g.simT, x: Math.sign(rb.x - m.x) || rep.dir }
        S.gain = Math.round((line - rb.y) / YARD)
        if (g.stamp && !g.done && ok) g.stamp.text = S.gain >= 10 ? 'FIRST DOWN' : `GAIN OF ${Math.max(1, S.gain)}`
        break
      }
    }
    if (rb.y < -20 && !S.told) { S.told = true; if (g.stamp) g.stamp.text = 'BREAKAWAY' }
  } else if (S.down) {
    // the rest pull up around the pile; they don't run through it
    for (const m of bodies) { if (m !== S.by) { apart(m, rb, 38, 1) } }
    S.by.tx = S.by.x; S.by.ty = S.by.y
  }
}
const PITCH_MS = 130
// a defender's man: a safety, a backer (the eleven's: gap only), a lineman
const gapWho = (who, b) => (b.si != null ? who.def[b.si] : b.li != null ? who.lb?.[b.li] ?? null : b.i != null ? who.dl[b.i] : null)
function drawGap(ctx, g, view) {
  const { h } = view, rep = g.rep, res = rep.res, c = view.colors
  const age = g.t - rep.at, snap = age >= PRE
  const S = stepScene(g, h, buildGap, stepGap), rb = S.rb
  const us = teamOf(c, 0), them = teamOf(c, 1), who = g.who
  const pushed = !!res && !reduceMotion()
  if (pushed) { const q = tilt(view, rb.x, rb.y); pushCam(ctx, g, view, q.x, q.y - 24 * q.s, 1.42) }
  fieldStage(ctx, view, 'gap', paintGap)
  crowd(ctx, g, view, rep)
  const fall = S.down ? clamp((g.simT - S.fall.at - 60) / 300, 0, 1) : 0
  const downAge = S.down ? g.simT - S.fall.at : -1, stuffed = S.down && res?.kind !== 'good'
  // the second man gets there and goes in on top
  if (S.down && S.pile === undefined) {
    S.pile = null
    let bd = 74
    for (const m of S.bodies) { if (m === S.by) continue; const e = Math.hypot(m.x - rb.x, m.y - rb.y); if (e < bd) { bd = e; S.pile = m } }
  }
  const pile = S.pile && downAge > 120 ? S.pile : null
  // stopped: they're up and shouting. Gone by them: heads down
  const after = (b, i, base) => (downAge > 760 && stuffed ? { ...base, pose: i % 2 ? 'flex' : 'arms-up' } : base)
  S.dl.forEach(b => {
    if (b === S.by || b === pile) return
    const base = { dir: 'down', pose: snap ? 'block' : 'stance', skin: skinOf(b.sk), number: b.num, size: G_SIZE, ...who.dl[b.i] }
    put(b.x, b.y - (downAge > 760 && stuffed ? jump(downAge, b.i, 5) : 0), them, { ...after(b, b.i, base), z: b.y })
  })
  const defs = [...S.lb, ...S.s]
  defs.forEach((b, i) => {
    if (b === S.by || b === pile) return
    const w = walk(g, `l${i}`, b.x, b.y, 10)
    if (downAge > 620 && stuffed) return put(b.x, b.y - jump(downAge, i + 3, 7), them, { dir: 'down', pose: i % 2 ? 'arms-up' : 'flex', z: b.y, skin: skinOf(b.sk), number: b.num, size: G_SIZE * 0.92, ...gapWho(who, b) })
    put(b.x, b.y, them, { dir: dirFrom(w, 'down'), step: w.step, pose: w.step == null ? 'ready' : null, skin: skinOf(b.sk), number: b.num, size: G_SIZE * 0.92, ...gapWho(who, b) })
  })
  S.ol.forEach((b, i) => put(b.x, b.y, us, { dir: 'up', pose: snap ? 'block' : 'stance', skin: skinOf(i + 3), number: OL_NUM[i], size: G_SIZE, ...who.ol[i] }))
  // the ball's his until you pick the hole, then a quick pitch to the back
  const since = res ? g.t - res.at : -1, pitched = since >= PITCH_MS
  const qw = walk(g, 'qb', S.qb.x, S.qb.y, 10)
  put(S.qb.x, S.qb.y, us, { dir: dirFrom(qw, 'up'), step: qw.step, pose: qw.step == null ? 'ready' : null, carry: !res && age >= PRE + SNAP_MS, skin: skinOf(9), number: 7, size: G_SIZE * 0.95, ...who.qb })
  const w = walk(g, 'rb', rb.x, rb.y, 11)
  // a good run: he's back up and showing them where it's going. Stuffed, he stays down
  const rbUp = downAge > 820 && !stuffed
  put(rb.x, rb.y - (rbUp ? jump(downAge, 0, 3) : 0), us, { dir: rbUp ? 'down' : S.down ? 'up' : dirFrom(w, 'up'), step: S.down ? null : w.step, carry: pitched && !rbUp, fall: rbUp ? 0 : fall, fallX: rbUp ? 0 : S.down ? S.fall.x : 0, pose: rbUp ? (S.gain >= 10 ? 'point-up' : 'flex') : null, z: rb.y, skin: skinOf(6), number: 28, size: G_SIZE * 0.92, ...who.rb })
  if (pile) {
    const f2 = clamp((downAge - 120) / 130, 0, 1), sd = -S.fall.x || 1
    put(lerp(pile.x, rb.x + sd * 13, f2), lerp(pile.y, rb.y + 2, f2), them, { dir: sd < 0 ? 'right' : 'left', pose: 'wrap', fall: clamp((downAge - 180) / 260, 0, 1), fallX: -sd, z: rb.y + 2, skin: skinOf(pile.sk), number: pile.num, size: G_SIZE * 0.92, ...gapWho(who, pile) })
  }
  const closeIn = S.down ? clamp((g.simT - S.fall.at) / 100, 0, 1) : 0
  if (S.by) put(lerp(S.by.x, rb.x - S.fall.x * 16, closeIn), lerp(S.by.y, rb.y - 6, closeIn), them, { dir: S.fall.x > 0 ? 'right' : 'left', pose: 'wrap', fall, fallX: S.fall.x, z: rb.y + 1, skin: skinOf(S.by.sk), number: S.by.num, size: G_SIZE * 0.92, ...gapWho(who, S.by) })
  tagsAll(downAge > TAGS_AFTER)   // (he's down: everyone's name)
  action(ctx, view)
  if (S.down && once(rep, '_hit')) { hitTurf(g, view, rb.x, rb.y, 1.2); g.nudge.kick(g.t, stuffed ? 6 : 4, S.fall.x, -0.7, 230); g.fx.push('stamp', 'h:heavy'); rep.popAt = g.t; rep.popBig = stuffed || S.gain >= 10 }
  if (res && !S.down && S.told && once(rep, '_gone')) { rep.popAt = g.t; rep.popBig = true }
  // he plants, and the turf goes
  if (res && !S.down && S.cutUntil != null && S.cutSeen !== S.cutUntil) { S.cutSeen = S.cutUntil; const q = tilt(view, rb.x, rb.y); g.dirt.burst('turf', q.x, q.y, g.t, { n: 5, s: q.s, ang: S.cutTo > 0 ? -2.5 : -0.64, spread: 0.6 }) }
  g.dirt.draw(ctx, g.t)
  snapBall(ctx, view, 180, S.qb.y - 42, S.qb.x, S.qb.y, age - PRE)
  if (res && !pitched) { const f = since / PITCH_MS; ballInAir(ctx, view, lerp(S.qb.x, rb.x, f), lerp(S.qb.y, rb.y, f), 30, Math.atan2(rb.x - S.qb.x, S.qb.y - rb.y)) }
  // the three gaps to pick: a see-through arrow on each hole (the whole third of the screen counts)
  if (!res) {
    ctx.save(); ctx.globalAlpha = 0.7
    ;[[-92, -0.42], [0, 0], [92, 0.42]].forEach(([dx, ang], i) => {
      const q = tilt(view, 180 + dx, S.line - 14)
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang)
      ctx.beginPath()
      ctx.moveTo(0, -15); ctx.lineTo(12, -2); ctx.lineTo(5, -2); ctx.lineTo(5, 13); ctx.lineTo(-5, 13); ctx.lineTo(-5, -2); ctx.lineTo(-12, -2); ctx.closePath()
      ctx.fillStyle = '#35d46f'; ctx.fill()
      ctx.strokeStyle = 'rgba(8,12,16,.82)'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.stroke()
      ctx.restore()
      if (view.keys) { ctx.globalAlpha = 1; keyCap(ctx, q.x, q.y + 24, THREE_KEYS[i]); ctx.globalAlpha = 0.7 }
    })
    ctx.restore()
  }
  if (pushed) ctx.restore()
}

// ── Jump the route ──────────────────────────────────────────────────────────
// You're the deep safety, in the middle of the field. The offense comes down the field at you; the
// corners and the rest are on their men, in man. Sooner or later a receiver beats his corner: he breaks,
// the corner's carried past it, the QB's shoulders open, the ball comes out. Tap THAT RECEIVER: you break on
// him. Get there before the ball and you take it away. Get there with it and you hit him and jar it loose.
// Tap the wrong man and you've run to the wrong side while he catches it. The bait is a double move: he
// stutters and sells it, the QB isn't looking there, and if you jump it he goes by you.
const J_RUN = 0.076
const losJ = h => Math.round(h * 0.56)
// the rules measure the safety's run from here, off the receiver's start: the same however the picture's framed
const jumpFrom = h => losJ(h) - 10 + h * 0.32 - 16
const J_X = [30, 104, 256, 330]
function paintJump(f, view) {
  const los = losJ(view.h), pyd = TL_PYD(view.h)
  paintFieldFlat(f, view, los - 70 * pyd, pyd, view.colors.us)
  lineColors(f, view, los, los + 10 * pyd)
}
const stutterOf = (rep, k) => (rep.decoy?.k === k ? rep.decoy : null)
function routeJ(rep, k, age, h) {
  const R = ROUTES[k], sharp = k === rep.open, s = stutterOf(rep, k), run = J_RUN * rep.pace[k]
  const a = sharp || s ? 0 : rep.ang[k]
  let d, x = J_X[k], y = 0
  if (s && age > s.at) {
    // stem, stutter and jab, then gone
    const stem = Math.max(0, s.at - PRE) * run, t = age - s.at
    const inward = k < 2 ? 1 : -1
    d = stem + Math.min(t, 300) * run * 0.2 + Math.max(0, t - 300) * run * 1.4
    x += inward * Math.sin(clamp(t / 340, 0, 1) * Math.PI) * 26
    y = d
  } else if (sharp && age > rep.delay) {
    const stem = Math.max(0, rep.delay - PRE) * run
    let rest = (age - rep.delay) * run * BURST
    if (Math.abs(R.cut) > 2 && !rep.deep) rest = Math.min(rest, 62)
    x += Math.sin(rep.cut[k]) * rest
    y = stem + Math.cos(rep.cut[k]) * rest
  } else {
    d = Math.max(0, age - PRE) * run
    const stem = sharp || s ? 1e9 : rep.stem[k], rest = Math.max(0, d - stem)
    x += Math.sin(a) * rest
    y = Math.min(d, stem) + Math.cos(a) * rest
  }
  P.x = clamp(rep.flip ? 360 - x : x, 16, 344)
  P.y = losJ(h) - 10 + y
  return P
}
// where his corner is: backpedalling, then on his hip, deep side, a beat behind him. Only the man who really
// beats him leaves him: carried on past the break, deep and turned, then getting back. On a double move he
// sits down on the stutter and comes up a step, gets turned, and runs back on to the hip: covered.
const J_TRAIL = 18, J_CARRY = 380, J_HIPS = 440
function cornerAt(rep, k, age, h) {
  const on = (k < 2 ? -1 : 1) * (rep.flip ? -1 : 1), s = stutterOf(rep, k)
  const now = routeJ(rep, k, Math.max(0, age - 90), h)
  const nx = now.x + on * 16, ny = now.y
  const trail = lerp(48, J_TRAIL + (rep.pace[k] / rep.cpace[k] - 1) * 40, clamp((age - PRE) * J_RUN / 60, 0, 1))
  let x = nx, y = ny + trail
  if (k === rep.open && age > rep.delay) {
    const b = routeJ(rep, k, rep.delay - 90, h), bx = b.x + on * 16, by = b.y + trail
    const over = prog(age, rep.delay, rep.delay + J_CARRY)
    const back = prog(age, rep.delay + J_CARRY, rep.delay + rep.T) * 0.45
    x = lerp(bx, nx, back); y = lerp(by + over * J_CARRY * J_RUN * 1.05 * rep.cpace[k], ny + trail, back)
  } else if (s && age > s.at) {
    const t = age - s.at
    y -= (t < 300 ? t / 300 : Math.max(0, 1 - (t - 300) / 420)) * 14
  }
  P.x = clamp(x, 16, 344); P.y = y
  return P
}
// which way he's facing: squared up on the backpedal and on a stutter, then running with him; beaten, he's
// planted and looking back at his man
function hipsJ(rep, k, age, w, cx, cy, rx, ry) {
  const s = stutterOf(rep, k)
  if (age < PRE + J_HIPS || (s && age > s.at && age < s.at + 300)) return 'up'
  if (k === rep.open && age > rep.delay + J_CARRY) return dirOf(rx - cx, ry - cy)
  return dirFrom(w, 'up')
}
// the backers: they open to their hook windows and sit there, stepping off anyone working through
function backerJ(rep, i, age, h) {
  const t = easeOut(prog(age, PRE, PRE + 620))
  let x = 180 + i * lerp(44, 58, t), y = losJ(h) + 46 + 34 * t
  for (let k = 1; k <= 2; k++) {
    const q = routeJ(rep, k, age, h), dx = x - q.x, dy = y - q.y, d = Math.hypot(dx, dy) || 1
    if (d < 30) { x += (dx / d) * (30 - d); y += (dy / d) * (30 - d) }
  }
  P.x = x; P.y = y
  return P
}
const safetyY = h => Math.round(h * 0.86)
const SAFETY_V = 0.34          // the safety's one speed, units a ms
const PICK_BY = 90, SWAT_BY = 50  // ms: there this far ahead of the ball, it's his; about even, he gets a hand on it
const MEET_R = 16, JUMP_YD = 8.4, SHORT_GAIN = 8 * JUMP_YD   // how near is a tackle; a tackle within eight yards of the catch is a good play
const BALL_V = 0.36, BALL_OFF = 110   // a thrown ball: units a ms, and what getting it out takes. Further takes longer
const jumpRel = rep => rep.delay + rep.T * 0.2
const jumpLand = (rep, h) => {
  if (rep.landH === h) return rep.land
  // (where he'll be depends on when it lands, and when it lands on where he'll be: settle it in a few goes)
  // (_landing: while it's being worked out, a route doesn't ask where the ball lands)
  const J = sceneOf(rep), rel = jumpRel(rep), qy = J.los(h) - 44
  let land = rel + 400
  rep._landing = true
  for (let i = 0; i < 5; i++) { const q = J.route(rep, rep.open, land, h); land = rel + BALL_OFF + Math.hypot(q.x - 180, q.y - qy) / BALL_V }
  rep._landing = false
  rep.land = land; rep.landH = h
  return land
}
const jumpRun = (res, age, frozen, rep) => (!res ? age
  : res.kind === 'far' || (res.kind === 'good' && rep?.how === 'tackle') ? frozen + Math.min(age - frozen, res.flight)
  : frozen + Math.min(age - frozen, Math.max(1500, res.flight)))
function buildJump(rep, h) { return { s: body(180, safetyY(h)), others: Array.from({ length: 10 }, () => ({ x: 0, y: 0 })), hit: false } }
// the others on the field the rules' bodies keep clear of: the routes (even places), the corners and the backers
function othersJ(rep, S, run, h) {
  for (let k = 0; k < 4; k++) {
    const p = routeJ(rep, k, run, h); S.others[k * 2].x = p.x; S.others[k * 2].y = p.y
    const q = cornerAt(rep, k, run, h); S.others[k * 2 + 1].x = q.x; S.others[k * 2 + 1].y = q.y
  }
  for (let i = 0; i < 2; i++) { const q = backerJ(rep, i * 2 - 1, run, h); S.others[8 + i].x = q.x; S.others[8 + i].y = q.y }   // the backers underneath
}
// before he's broken on anything: the safety sits deep in the middle, rocking
function idleJ(g, rep, S, b, run, h, dt) {
  b.tx = 180 + Math.sin(g.simT / 300 + rep.ph[1]) * 5; b.ty = safetyY(h) + Math.min(14, Math.max(0, run - PRE) * 0.012); b.v = 0.09
  seek(b, dt)
  for (let i = 0; i < 10; i++) apart(b, S.others[i], 30, 1)
}
function stepJump(g, rep, S, dt, h, age) {
  const J = sceneOf(rep), res = rep.res, frozen = res ? res.at - rep.at : age, run = jumpRun(res, age, frozen, rep)
  J.others(rep, S, run, h)
  const b = S.s
  if (res && res.kind !== 'late') {
    // a straight shot at the man he tapped, through anyone in between, at one speed
    const t = S.others[res.k * 2]
    if (res.kind === 'good' && rep.how === 'pick' && age > jumpLand(rep, h) + 40) {
      // he's got it, and he's gone the other way: a lane up the field, away from the man he took it from
      const left = age - jumpLand(rep, h)
      if (left > 880) { b.tx = b.x; b.ty = b.y; b.v = 0.02; seek(b, dt); return }
      // (a backer up near the line takes it to the sideline, away from the big men)
      const [rx, ry] = J.ret ?? [40, 200]
      b.tx = b.x + (b.x < 180 ? rx : -rx); b.ty = b.y - ry; b.v = 0.2 * (g.who.sPace?.[0] ?? 1)
      seek(b, dt)
      return
    }
    if (res.kind === 'good' && rep.how !== 'tackle') { const at = J.route(rep, res.k, jumpLand(rep, h), h); b.tx = at.x; b.ty = at.y - 12 }
    else { b.tx = t.x; b.ty = t.y + (J.meetY ?? -12) }   // (the backer comes up from deeper and meets him square)
    b.v = J.V
    seek(b, dt)
    return
  }
  J.idle(g, rep, S, b, run, h, dt)
}
const J_CB = [24, 21, 29, 26], J_WR = [11, 84, 87, 15]
const QB_LOOK = (qx, x) => (Math.abs(x - qx) < 34 ? 'down' : x < qx ? 'left' : 'right')
const Lx0 = (rep, h) => sceneOf(rep).route(rep, rep.open, jumpLand(rep, h), h).x   // (where the ball's coming down, across the field)
// the matchups: each receiver and the man on him. (o: the play as drawJump has it; the open man and the tapped one go back on it)
function menJ(g, view, o) {
  const { rep, res, h, age, runAge, snap, land, picked, swatted, jarred, hitFall, us, them, who, qx } = o
  let ox = 0, oy = 0, tx = 0, ty = 0
  for (let k = 0; k < 4; k++) {
    const p = routeJ(rep, k, runAge, h), rx = p.x, ry = p.y
    const q = cornerAt(rep, k, runAge, h), cx = q.x, cy = q.y
    const cw = walk(g, `c${k}`, cx, cy), rw = walk(g, `w${k}`, rx, ry)
    // a takeaway: the corners are up for it
    if ((picked || swatted) && age > land + 240) put(cx, cy - jump(age, k, 6), us, { dir: 'up', pose: 'arms-up', z: cy, skin: skinOf(k * 3), number: J_CB[k], size: 0.86, ...who.def[k] })
    else put(cx, cy, us, { dir: hipsJ(rep, k, runAge, cw, cx, cy, rx, ry), step: snap ? cw.step : null, pose: snap ? null : 'ready', skin: skinOf(k * 3), number: J_CB[k], size: 0.86, ...who.def[k] })
    const stut = stutterOf(rep, k), stopped = stut && runAge >= stut.at && runAge < stut.at + 300
    const hitHim = jarred && res.k === k && hitFall > 0
    // his hands go up for it. If it never gets there, he's got his hands on his helmet
    const toHim = k === (res?.kind === 'bait' ? res.k : rep.open), going = res && toHim && age > land - 130 && age < land + 40 && !hitHim
    const robbed = res && toHim && (picked || swatted) && age > land + 300
    put(rx, ry, them, { dir: hitHim ? 'down' : going || robbed ? 'down' : dirFrom(rw, 'down'), step: snap && !stopped && !hitHim && !going && !robbed ? rw.step : null, pose: going ? (rx < qx ? 'catch-r' : 'catch-l') : robbed ? 'hands-head' : snap ? null : 'ready', fall: hitHim ? hitFall : 0, fallX: hitHim ? (rx < 180 ? -1 : 1) : 0, carry: age > land && !going && (jarred ? res.k === k : !picked && res && k === rep.open), skin: skinOf(k * 3 + 2), number: J_WR[k], size: 0.86, ...who.rcv[k] })
    if (k === rep.open) { ox = rx; oy = ry }
    if (res?.k === k) { tx = rx; ty = ry }
  }
  o.ox = ox; o.oy = oy; o.tx = tx; o.ty = ty
}
// the two backers underneath
function backsJ(g, view, o) {
  const { rep, h, age, runAge, land, picked, swatted, us } = o
  for (let i = -1; i <= 1; i += 2) {
    const q = backerJ(rep, i, runAge, h), bx = q.x, by = q.y, w = walk(g, `jb${i}`, bx, by)
    if ((picked || swatted) && age > land + 300) put(bx, by - jump(age, i + 2, 6), us, { dir: 'up', pose: 'arms-up', z: by, skin: skinOf(i + 4), number: i < 0 ? 52 : 45, size: 0.86 })
    else put(bx, by, us, { dir: 'up', step: w.step, pose: w.step == null ? 'ready' : null, skin: skinOf(i + 4), number: i < 0 ? 52 : 45, size: 0.86 })
  }
}
// Jump the Route and Zone Drop: one play, the scene's own men (sceneOf: the safety's or the backer's)
function drawJump(ctx, g, view) {
  const { h } = view, rep = g.rep, res = rep.res, c = view.colors, J = sceneOf(rep)
  const age = g.t - rep.at, frozen = res ? res.at - rep.at : age, since = res ? g.t - res.at : -1, d = rep.decoy
  const S = stepScene(g, h, J.build, stepJump)
  const us = teamOf(c, 0), them = teamOf(c, 1), who = g.who
  // (a double move's ball goes to the man who ran it; a look-off's goes to the read, in the window the backer left)
  const toBait = res?.kind === 'bait' && !J.lookOff
  const pushed = !!res && !reduceMotion()
  if (pushed) {
    // on the safety when he's got there. Beaten, on the man who's beaten him
    let fx = S.s.x, fy = S.s.y
    if (res.kind !== 'good' && res.kind !== 'far') { const p = J.route(rep, toBait ? res.k : rep.open, jumpRun(res, age, frozen, rep), h); fx = p.x; fy = p.y }
    const q = tilt(view, fx, fy)
    pushCam(ctx, g, view, q.x, q.y - 22 * q.s, 1.5)
  }
  fieldStage(ctx, view, J.key, J.paint)
  crowd(ctx, g, view, rep)
  const los = J.los(h), qx = 180, qy = los - 44, snap = age >= PRE
  const ok = res?.kind === 'good', late = res?.kind === 'late', flight = res?.flight ?? 340
  const runAge = jumpRun(res, age, frozen, rep)
  const picked = ok && rep.how === 'pick', swatted = ok && rep.how === 'swat', jarred = (ok && rep.how === 'tackle') || res?.kind === 'far', land = jumpLand(rep, h)
  const missed = res && !ok && !late
  const hitAt = frozen + flight, hitFall = jarred ? clamp((age - hitAt) / 280, 0, 1) : 0
  const o = { rep, res, h, age, runAge, snap, land, picked, swatted, jarred, hitFall, us, them, who, qx, ox: 0, oy: 0, tx: 0, ty: 0 }
  J.men(g, view, o)
  const { ox, oy, tx, ty } = o
  // the front, on each other
  for (let i = -2; i <= 2; i++) put(180 + i * OL_GAP, los - 10 - Math.min(16, Math.max(0, runAge - PRE) * 0.012), them, { dir: 'down', pose: snap ? 'block' : 'stance', skin: skinOf(i + 7), number: OL_NUM[i + 2], size: 0.94, ...who.ol[i + 2] })
  for (let i = -3; i <= 3; i += 2) put(180 + i * 14, los + 10 - Math.min(16, Math.max(0, runAge - PRE) * 0.012), us, { dir: 'up', pose: snap ? 'block' : 'stance', skin: skinOf(i + 9), number: DL_NUM[(i + 3) / 2], size: 0.94, ...who.dl[(i + 3) / 2] })
  J.backs(g, view, o)
  // the QB: he scans; his shoulders open to the man he's going to, then the ball's out. On an early bait
  // they swing that way and come back: a pump. If you've run to the wrong man he doesn't wait.
  const bx = toBait ? tx : ox, by = toBait ? ty : oy
  const scan = Math.sin(g.t / 520 + rep.ph[0])
  let look = scan > 0.72 ? 'left' : scan < -0.72 ? 'right' : 'down'
  if (runAge >= rep.delay || missed) look = QB_LOOK(qx, bx)
  else if (d?.early && runAge >= d.at && runAge < d.at + (d.flash ?? FLASH)) { const p = J.route(rep, d.k, runAge, h); look = QB_LOOK(qx, p.x) }
  // (a scene's air: the ball's time in the air, longer than the race's own. It lands when it always did and comes out that
  // much sooner, so the race is the same; zone drop's hangs 18% longer, more to watch it into the window)
  const rel = J.air ? Math.max(rep.delay, land - (land - jumpRel(rep)) * J.air) : jumpRel(rep)
  const fa = prog(age, rel, land)
  // his arm: cocked once he's found his man, then the release
  const arm = qbPose(runAge >= rep.delay && age < rel ? 1 : null, age >= rel ? age - rel : -1)
  // (he's watched it get taken away)
  const qbSad = (picked || swatted) && age > land + 360
  // (he throws downfield, toward the camera: square to it, the ball up at his shoulder, then the arm through. The
  // side-on throwing poses had him turn sideways to throw forward)
  const frontArm = !arm ? null : arm === 'qb-hold' || arm === 'qb-cock' ? (bx < qx ? 'shoulder-l' : 'shoulder-r') : (bx < qx ? 'reach-l' : 'reach-r')
  put(qx, qy, them, { dir: qbSad ? 'down' : arm ? 'down' : look, pose: qbSad ? (picked ? 'hands-head' : 'hips') : frontArm, carry: !arm && fa <= 0 && age >= PRE + SNAP_MS, skin: skinOf(2), number: 9, size: 0.9, ...who.qb })
  // him: the safety (or the backer)
  const b = S.s, sw = walk(g, 'safety', b.x, b.y, 9)
  const hitNow = jarred && hitFall > 0
  snapBall(ctx, view, 180, qy + 42, qx, qy, age - PRE)
  // him: high-pointing it, running it back, then pulling up to let them hear about it. A breakup gets the owner's two signals
  const sLook = J.look(who)
  const atBall = (picked || swatted) && age > land - 140 && age < land + 50
  const beatBy = res && !ok && !late && age > land + 260 && !(J.tackleFar && res.kind === 'far')   // (the backer still gets him down on a long one)
  if (atBall) put(b.x, b.y, us, { ...sLook, dir: 'up', pose: picked ? (b.x < Lx0(rep, h) ? 'catch-r' : 'catch-l') : b.x < Lx0(rep, h) ? 'swipe-r' : 'swipe-l' })
  else if (picked && age > land + 900) put(b.x, b.y - jump(age, 0, 8), us, { ...sLook, dir: 'down', pose: g.look % 2 ? 'arms-up' : 'flex', z: b.y })
  else if (swatted && age > land + 280) put(b.x, b.y, us, { ...sLook, dir: 'down', pose: breakupPose(age - land - 280, g.look + g.i) })
  else if (beatBy) put(b.x, b.y, us, { ...sLook, dir: 'up', step: null, pose: 'hips' })
  else put(b.x, b.y, us, { ...sLook, dir: hitNow ? 'up' : J.facing ? J.facing(sw, res) : dirFrom(sw, 'up'), step: hitNow ? null : sw.step, pose: hitNow ? 'wrap' : sw.step == null ? 'ready' : null, fall: hitNow ? hitFall : 0, fallX: hitNow ? (tx < 180 ? -1 : 1) : 0, carry: picked && age > land, z: hitNow ? ty + 1 : undefined })
  tagsAll(res && since > flight + TAGS_AFTER)   // (the play's over: everyone's name)
  action(ctx, view)
  if (hitFall > 0 && once(rep, '_hit')) { hitTurf(g, view, tx, ty, 1.3); g.nudge.kick(g.t, 6, tx < 180 ? -1 : 1, 0.5, 240); g.fx.push('stamp', 'h:heavy'); rep.popAt = g.t }
  if ((picked || swatted) && age >= land && once(rep, '_got')) { const q = tilt(view, b.x, b.y); g.dirt.burst('turf', q.x, q.y, g.t, { n: 6, s: q.s, spread: 1 }); g.nudge.kick(g.t, 3, 0, 1, 160); g.fx.push(picked ? 'catchball' : 'stamp', 'h:heavy'); rep.popAt = g.t; rep.popBig = picked }
  g.dirt.draw(ctx, g.t)
  // a light ring round each receiver: who there is to press
  if (!res) {
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2
    for (let k = 0; k < 4; k++) { const q = g.aimAt(k), a = tilt(view, g.men[k].x, g.men[k].y); ctx.beginPath(); ctx.arc(q.x, q.y, 25 * a.s, 0, Math.PI * 2); ctx.stroke() }
  }
  // the ball, and where it goes
  // it was thrown at one spot, where his man would be, and it goes there whatever happens around it
  const toK = toBait ? res.k : rep.open
  const L = J.route(rep, toK, land, h), Lx = L.x, Ly = L.y
  if (fa > 0 && fa < 1) ballInAir(ctx, view, lerp(qx, Lx, fa), lerp(qy, Ly, fa), 34 + Math.sin(fa * Math.PI) * 44, Math.atan2(Lx - qx, qy - Ly))
  // a hand on it: it's dead on the turf
  else if (swatted && age >= land) looseBall(ctx, view, Lx, Ly + 8, age - land, true)
  if (pushed) ctx.restore()
}

// ── Zone drop ───────────────────────────────────────────────────────────────
// Jump the Route for a backer. He's the Mike in a two-deep shell, six yards off the ball and inside. On the snap he opens
// and gets to his hook landmark, ten yards deep, eyes on the QB. The corners are on the outside men, a safety over the top
// of each half, the nickel and the Sam in the curl-flat. Nothing goes deep at him: X's dig, the slot's curl, the tight end
// sitting down in the hook, the back's angle route, every one short or intermediate and working through his zone. One comes
// open in it: the QB's shoulders open to him, and that's the man to break on. The bait is the QB's first look: a man settles
// in front of the backer and the QB stares him down, then comes back to the real one in the window behind. Jump the first
// look and that window's empty. Same race as the safety's (settle): the ball's spot against the backer's run, a step slower.
const losZ = h => Math.round(h * 0.68)
const LB_V = 0.28                 // the backer's one speed, units a ms: a step slower than the safety's
const Z_SHORT = 6 * JUMP_YD       // a tackle within six yards of the catch is a good play
const Z_YAC = 0.075               // the catch and run
const Z_STEM = 54                 // the deepest the read breaks, about seven yards
// each man's route, X's side on the left (a flipped play mirrors it). a0: his release. open: his break when he's the read
// (the look-off's too, short and settling). soft: the route he runs when he isn't. cap: how far after the break, then he sits
const ZR = [
  { x: 24, y: 0, a0: 0, open: 1.5, cap: 999, soft: -2.75, softCap: 16, stem: [62, 80] },        // X: the dig across the hook, or the comeback with his corner on him
  { x: 110, y: -12, a0: 0, open: 2.3, cap: 22, soft: -1.45, softCap: 70, stem: [14, 22] },       // the slot: the curl in the window, or the arrow to the flat with the nickel on him
  { x: 254, y: 0, a0: 0, open: -2.7, cap: 14, soft: 1.5, softCap: 50, stem: [36, 50] },         // the tight end: sits down in the hook, or the stick out to the flat
  { x: 206, y: -40, a0: 0.72, open: -0.85, cap: 999, soft: 1.35, softCap: 44, stem: [34, 48] }, // the back: the angle route back inside, or the check to the flat
]
const Z_WR = [11, 84, 87, 28], Z_DEF = [24, 21, 29, 26, 27, 45]
// once it's his (caught, not taken away) he turns it up the field: from when the ball gets there, or never
const yacFrom = (rep, k, h) => (k !== rep.open || rep._landing || rep.how === 'pick' || rep.how === 'swat' ? Infinity : jumpLand(rep, h))
function routeZ(rep, k, age, h) {
  const R = ZR[k], run = J_RUN * rep.pace[k], open = k === rep.open, s = !open && stutterOf(rep, k)
  const caught = yacFrom(rep, k, h), t = Math.min(age, caught)
  const bt = open ? rep.delay : s ? s.at : PRE + rep.zstem[k] / run
  // (the read's stem stays short or intermediate: a later break is a slower, more patient release, never a deeper route)
  const tempo = open ? clamp(Z_STEM / Math.max(1, (bt - PRE) * run), 0.72, 1) : 1
  const stem = Math.min(Math.max(0, t - PRE) * run * tempo, Math.max(0, bt - PRE) * run * tempo)
  const sharp = open || !!s, a = sharp ? R.open : R.soft
  const rest = Math.min(Math.max(0, t - bt) * run * (sharp ? BURST : 1), s ? Math.min(R.cap, 24) : sharp ? R.cap : R.softCap)
  let x = R.x + Math.sin(R.a0) * stem + Math.sin(a) * rest, y = R.y + Math.cos(R.a0) * stem + Math.cos(a) * rest
  if (age > caught) { const go = (age - caught) * Z_YAC * rep.pace[k]; y += go; x += Math.sign(x - 180) * go * 0.2 }
  P.x = clamp(rep.flip ? 360 - x : x, 16, 344)
  P.y = losZ(h) - 10 + y
  return P
}
// Z, wide on the far side: a go, his corner running with him. He's taking the top off, never the read
const ZQ = { x: 0, y: 0 }
function zRoute(rep, age, h) {
  ZQ.x = rep.flip ? 28 : 332; ZQ.y = losZ(h) - 10 + Math.max(0, age - PRE) * J_RUN * 1.05
  return ZQ
}
// the backer: lined up inside, opening to his landmark on the snap, then sitting in his window and leaning to whoever's
// working through it (the rules ask here, so the race starts where the picture has him)
const LBQ = { x: 0, y: 0 }
function lbAt(rep, age, h) {
  const los = losZ(h), pyd = TL_PYD(h), sg = rep.flip ? -1 : 1, t = easeOut(prog(age, PRE, PRE + 760))
  let x = 180 + sg * lerp(6, 14, t)
  const y = los + lerp(6, 10, t) * pyd
  if (age > PRE + 300) {
    let lean = 0
    for (let k = 0; k < 4; k++) { const q = routeZ(rep, k, age, h), dx = q.x - x; lean += dx * Math.max(0, 1 - Math.hypot(dx, q.y - y) / 90) * 0.35 }
    x += clamp(lean, -16, 16) * prog(age, PRE + 300, PRE + 700)
  }
  LBQ.x = x; LBQ.y = y
  return LBQ
}
// the rest of the shell: 0 the corner on X, 1 the corner on Z, 2 3 the safeties (a deep half each), 4 the nickel, 5 the Sam
const ZD = [null, null, { x: 112, y: 112, tx: 106, ty: 130 }, { x: 248, y: 112, tx: 254, ty: 130 }, { x: 102, y: 34, tx: 76, ty: 60, on: [1, 0] }, { x: 272, y: 30, tx: 290, ty: 58, on: [2, 3] }]
const ZM = { x: 0, y: 0 }
function zoneMan(rep, i, age, h) {
  const los = losZ(h), sg = rep.flip ? -1 : 1, fx = x => (rep.flip ? 360 - x : x), t = easeOut(prog(age, PRE, PRE + 700))
  let x, y
  if (i === 0) {
    // outside X and over the top of him. On the dig he lets him go inside, to the backer, and stays deep outside
    const q = routeZ(rep, 0, Math.max(0, age - 90), h), qx = q.x, qy = q.y, x0 = fx(ZR[0].x)
    x = x0 + clamp(qx - x0, -30, 30) - 16 * sg
    y = Math.max(qy + lerp(40, 22, t), los + 30 + 70 * t)
  } else if (i === 1) {
    const q = zRoute(rep, Math.max(0, age - 90), h)
    x = q.x + 16 * sg; y = q.y + lerp(40, 20, t)
  } else {
    const D = ZD[i]
    x = fx(lerp(D.x, D.tx, t)); y = los + lerp(D.y, D.ty, t)
    if (D.on) {
      // the curl-flat: he widens with the man in his area. (Not the read: he's the one working inside, to the backer)
      let ax = 0, ay = 0, wt = 0
      for (const k of D.on) {
        const q = routeZ(rep, k, age, h), qx = q.x, qy = q.y
        const w = Math.max(0, 1 - Math.hypot(qx - x, qy - y) / 110) * (k === rep.open ? 1 - prog(age, rep.delay - 200, rep.delay + 150) : 1)
        ax += (qx - x) * w; ay += (qy + 14 - y) * w; wt += w
      }
      const f = prog(age, PRE + 200, PRE + 700) * 0.7, m = Math.max(wt, 1)
      x += clamp(ax / m, -30, 30) * f; y += clamp(ay / m, -20, 20) * f
    } else {
      // over the top: once the ball's coming out he gets downhill toward it
      const q = routeZ(rep, rep.open, age, h), qx = q.x, f = prog(age, rep.delay, rep.delay + 500)
      x += clamp(qx - x, -24, 24) * 0.4 * f; y -= 12 * f
    }
  }
  ZM.x = clamp(x, 12, 348); ZM.y = y
  return ZM
}
function buildZone(rep, h) { const q = lbAt(rep, 0, h); return { s: body(q.x, q.y), others: Array.from({ length: 10 }, () => ({ x: 0, y: 0 })), hit: false } }
function othersZ(rep, S, run, h) {
  for (let k = 0; k < 4; k++) { const p = routeZ(rep, k, run, h); S.others[k * 2].x = p.x; S.others[k * 2].y = p.y }
  for (let i = 0; i < 6; i++) { const q = zoneMan(rep, i, run, h), o = S.others[i < 4 ? i * 2 + 1 : i + 4]; o.x = q.x; o.y = q.y }
}
// before the break he's where the rules have him. Not broken on anything at all, he comes up on the catch, a step behind it
function idleZ(g, rep, S, b, run, h, dt) {
  if (!rep.res) { const q = lbAt(rep, run, h); b.x = q.x; b.y = q.y; b.tx = b.x; b.ty = b.y; return }
  const t = S.others[rep.open * 2]
  b.tx = t.x; b.ty = t.y + 18; b.v = 0.07
  seek(b, dt)
}
// a man in zone has his eyes on the QB: square to him unless he's really moving across
const zFace = w => (w.step == null || Math.abs(w.dx) < 0.62 ? 'up' : dirFrom(w, 'up'))
function menZ(g, view, o) {
  const { rep, res, h, age, runAge, snap, land, picked, swatted, jarred, hitFall, us, them, who, qx } = o
  const took = (picked || swatted) && age > land + 240
  // Z and his corner, going
  const z = zRoute(rep, runAge, h), zx = z.x, zy = z.y, zw = walk(g, 'zz', zx, zy)
  put(zx, zy, them, { dir: dirFrom(zw, 'down'), step: snap ? zw.step : null, pose: snap ? null : 'ready', skin: skinOf(8), number: 15, size: 0.86, ...who.z })
  // the shell. A takeaway: they're up for it
  for (let i = 0; i < 6; i++) {
    const q = zoneMan(rep, i, runAge, h), x = q.x, y = q.y, w = walk(g, `zd${i}`, x, y)
    const look = { skin: skinOf(i * 3 + 1), number: Z_DEF[i], size: 0.86, ...who.def[i] }
    if (took) { put(x, y - jump(age, i, 6), us, { ...look, dir: 'up', pose: 'arms-up', z: y }); continue }
    const dir = i < 2 ? (runAge < PRE + J_HIPS ? 'up' : dirFrom(w, 'up')) : zFace(w)
    put(x, y, us, { ...look, dir, step: snap ? w.step : null, pose: snap && w.step != null ? null : 'ready' })
  }
  // the four who can be the read. The ball goes to the read, whatever he's done: it's his to catch unless it's taken away
  let ox = 0, oy = 0, tx = 0, ty = 0
  for (let k = 0; k < 4; k++) {
    const p = routeZ(rep, k, runAge, h), rx = p.x, ry = p.y, rw = walk(g, `zr${k}`, rx, ry)
    const hitHim = jarred && res.k === k && hitFall > 0, toHim = k === rep.open
    const going = toHim && age > land - 130 && age < land + 40 && !hitHim
    const robbed = toHim && (picked || swatted) && age > land + 300
    const has = toHim && age >= land + 40 && !picked && !swatted
    // (sitting down in a window he turns back to the QB)
    const still = snap && runAge > PRE + 420 ? 'up' : 'down'
    put(rx, ry, them, { dir: hitHim ? 'down' : going || robbed ? 'up' : dirFrom(rw, still), step: snap && !hitHim && !going && !robbed ? rw.step : null, pose: going ? (rx < qx ? 'catch-r' : 'catch-l') : robbed ? 'hands-head' : snap ? null : 'ready', fall: hitHim ? hitFall : 0, fallX: hitHim ? (rx < 180 ? -1 : 1) : 0, carry: has, skin: skinOf(k * 3 + 2), number: Z_WR[k], size: 0.86, ...who.rcv[k] })
    if (toHim) { ox = rx; oy = ry }
    if (res?.k === k) { tx = rx; ty = ry }
  }
  o.ox = ox; o.oy = oy; o.tx = tx; o.ty = ty
}
function paintZone(f, view) {
  const los = losZ(view.h), pyd = TL_PYD(view.h)
  paintFieldFlat(f, view, los - 70 * pyd, pyd, view.colors.us)
  lineColors(f, view, los, los + 13 * pyd)   // (third and thirteen: he sits short of the sticks, and a tackle short of them is a stop)
}
// the two defenders' games, side by side: what drawJump, stepJump and the rules (make, settle) ask of each
const JUMPY = {
  'jump-route': { route: routeJ, los: losJ, V: SAFETY_V, short: SHORT_GAIN, from: (rep, age, h) => ({ x: 180, y: safetyY(h) }), build: buildJump, others: othersJ, idle: idleJ, key: 'jump', paint: paintJump, men: menJ, backs: backsJ, look: who => ({ skin: skinOf(4), number: 38, size: 0.86, ...who.safety }) },
  'zone-drop': { route: routeZ, los: losZ, V: LB_V, short: Z_SHORT, sticks: 13, from: lbAt, build: buildZone, others: othersZ, idle: idleZ, key: 'zone', paint: paintZone, men: menZ, backs: () => {}, look: who => ({ skin: skinOf(5), number: 54, size: 0.9, ...who.me }), lookOff: true, air: 1.18, meetY: 12, tackleFar: true, ret: [-70, 60], facing: (w, res) => (res ? dirFrom(w, 'up') : zFace(w)) },
}
const sceneOf = rep => (rep.zone ? JUMPY['zone-drop'] : JUMPY['jump-route'])

// ── The court: to scale, through the same camera ────────────────────────────
const FT = COURT_FT
const INK = 'rgba(8,12,16,.82)'
// the result word: one place and one size (used by the cone drills)
export function placeStamp(s, view) {
  if (!s || s.placed) return
  s.placed = true; s.y = view.h - 126
  s.size = s.text.length > 11 ? 34 : s.size >= 40 ? 44 : 38
}
const rimOf = h => Math.round(h * 0.4)
const courtX = fx => 180 + fx * FT
const courtY = (fy, h) => rimOf(h) + fy * FT
// Where a field point is in the arena's feet (lib/mg/arena.js)
const xFt = x => (x - 180) / FT
const zFt = (y, h) => -(y - rimOf(h)) / FT
const CORNER_FT = 16.8
// the two reads' cameras: down on the floor, level with the rim. Pick-and-roll stands behind the handler, wide
// enough for both corners. The 3-on-1 runs with the break, and stops short of the rim when the shot goes up.
const PNR_CAM = { H: 10, D: 37, F: 294, maxF: 320, hzAt: 0.385 }, RIM_CAM = { H: 10, D: 26, F: 256, maxF: 280, hzAt: 0.385 }
function courtCam(g, age = g.rep.res ? g.rep.res.at - g.rep.at : g.t - g.rep.at) {
  if (!g.arena || g.arena.h !== g.h) g.arena = arenaCam(g.h, g.game === 'pnr' ? PNR_CAM : RIM_CAM)
  return g.arena
}
const whoOf = (man, number, skin) => man ?? { number, skin, name: null }
const HSKIN = [skinOf(0), skinOf(1), skinOf(3), skinOf(5), skinOf(2)]
// The real five on the floor (career's gameCast; null in practice): the man you are, or on the other side
// the man on him, then two more guards and two bigs. A big's five has him first, and the other big as his roller.
const FIVE = [['guard', 0], ['guard', 1], ['guard', 2], ['big', 0], ['big', 1]]
const FIVE_BIG = [['big', 0], ['guard', 0], ['guard', 1], ['big', 1], ['guard', 2]]
const fiveOf = cast => (cast.us?.big?.[0] === cast.me ? FIVE_BIG : FIVE)
export function castMen(g, view) {
  const cast = view.cast
  if (!cast) return null
  if (!g.castMen) {
    const five = fiveOf(cast), of = side => five.map(([group, i]) => manOf(cast, side, group, i))
    g.castMen = { us: of('us'), them: of('them'), rush: [1, 0, 2].map(i => manOf(cast, 'them', 'guard', i)) }
    // (two men in one uniform can't wear one number: if a real teammate has his, he takes the next free one)
    const me = g.castMen.us[0], taken = new Set(g.castMen.us.slice(1).filter(Boolean).map(m => m.number))
    if (me && taken.has(me.number)) { let n = (me.number ?? 0) + 1; while (taken.has(n % 100)) n++; g.castMen.us[0] = { ...me, number: n % 100 } }
    g.castMen.key = [...g.castMen.us, ...g.castMen.them].map(m => (m ? `${m.name}${m.number}${m.skin}` : "-")).join('')   // (for what's baked in)
  }
  return g.castMen
}
// Who's quick, a little. men: the ones who can be tapped, by k. d: the bodies that seek. It goes on the rep, so
// the tap targets and the picture agree.
function courtPace(game, cast) {
  if (!cast) return null
  if (game === 'pnr') {
    const five = fiveOf(cast), at = (side, n) => paceOf(cast, side, ...five[n])
    return { men: [at('us', 0), at('us', 3), 1], d: [0, 3, 1, 2, 4].map(n => at('them', n)) }
  }
  if (game === 'rim-protect') return { men: [1, 0, 2].map(i => paceOf(cast, 'them', 'guard', i)), d: [paceOf(cast, 'us', ...fiveOf(cast)[0])] }
  return null
}
// ── Pick-and-roll: 5 on 5 ───────────────────────────────────────────────────
// The handler up top, a big coming to screen, a shooter in each corner and one in the far slot. The
// screen comes and the defense shows you its coverage:
//   DROP: the big backs into the paint and the on-ball man is chasing over the top → the handler has his pull-up
//   TRAP: the big jumps out at the ball with the on-ball man → the roller's alone going down the lane
//   TAG:  the far corner's man leaves him to tag the roller → the corner three
// Those are the three men you can tap. The bait is the man the help's going to, or a show-and-recover.
// A turnover is a defender getting a hand on it, and then he has it, going the other way.
// We're on the floor behind the handler, level with the rim, looking down the play at the hoop.
function pnrAt(rep, k, age, h) {
  const dir = rep.dir
  if (k === 0) {
    const f = easeOut(prog(age, PRE + 300, PRE + 300 + (rep.delay - 100 - PRE) / (rep.pace?.men[0] ?? 1)))
    P.x = courtX(lerp(-dir * 1.5, dir * 4.2, f)); P.y = courtY(lerp(28, 26.4, f), h)
  } else if (k === 1) {
    const set = easeOut(prog(age, 0, PRE + 400)), roll = prog(age, rep.delay - 100, rep.delay - 100 + 1050 / (rep.pace?.men[1] ?? 1))
    P.x = courtX(lerp(lerp(dir * 7, dir * 2.2, set), dir * 1.5, roll)); P.y = courtY(lerp(lerp(16, 22, set), 8, roll), h)
  } else {
    P.x = courtX(-dir * CORNER_FT); P.y = courtY(3.2, h)
  }
  return P
}
const COVER = ['drop', 'trap', 'tag']
const PNR_D = [0, 3, 1, 2, 4]   // (each defender, by who he's on in the five)
function buildPnr(rep, h) {
  const dir = rep.dir
  const S = {
    d1: body(courtX(-dir * 4), courtY(23, h)),                 // on the ball
    d5: body(courtX(dir * 6), courtY(13, h)),                    // on the big
    d4: body(courtX(-dir * 14.4), courtY(5.2, h)),                 // on the far corner
    d2: body(courtX(dir * 14.4), courtY(5.2, h)),                  // on the near corner
    d3: body(courtX(-dir * 6.4), courtY(16, h)),                 // on the slot
    h: {}, r: {}, c: {}, thief: null,
  }
  S.all = [S.d1, S.d5, S.d4, S.d2, S.d3]
  return S
}
function stepPnr(g, rep, S, dt, h, age) {
  const dir = rep.dir, cov = COVER[rep.open], res = rep.res, d = rep.decoy
  const frozen = res ? res.at - rep.at : age
  const a = pnrAt(rep, 0, age, h); S.h.x = a.x; S.h.y = a.y
  const b = pnrAt(rep, 1, age, h); S.r.x = b.x; S.r.y = b.y
  const c = pnrAt(rep, 2, age, h); S.c.x = c.x; S.c.y = c.y
  const on = age >= rep.delay, Hx = S.h.x, Hy = S.h.y
  // before the coverage shows: on the ball, on the screener, everyone home. All goal side of their men
  S.d1.tx = Hx - dir * 2.6 * FT; S.d1.ty = Hy - 5 * FT; S.d1.v = 0.15
  S.d5.tx = S.r.x + dir * 1 * FT; S.d5.ty = S.r.y - 4 * FT; S.d5.v = 0.15
  S.d4.tx = courtX(-dir * 14.4); S.d4.ty = courtY(5.2, h); S.d4.v = 0.16
  S.d2.tx = courtX(dir * 14.4); S.d2.ty = courtY(5.2, h); S.d2.v = 0.12
  S.d3.tx = courtX(-dir * 6.4); S.d3.ty = courtY(16, h); S.d3.v = 0.12
  if (on) {
    if (cov === 'drop') {
      // back into the paint; the on-ball man is trailing over the top
      S.d5.tx = courtX(dir * 1.5); S.d5.ty = courtY(11, h); S.d5.v = 0.15
      S.d1.tx = Hx - dir * 5 * FT; S.d1.ty = Hy - 1 * FT; S.d1.v = 0.1
    } else if (cov === 'trap') {
      // both on the ball
      S.d5.tx = Hx + dir * 1.7 * FT; S.d5.ty = Hy - 3.2 * FT; S.d5.v = 0.18
      S.d1.tx = Hx - dir * 2.2 * FT; S.d1.ty = Hy - 3 * FT; S.d1.v = 0.16
    } else {
      // the big's up with the ball; the far corner's man comes across to tag the roller
      S.d5.tx = Hx + dir * 1.2 * FT; S.d5.ty = Hy - 5 * FT; S.d5.v = 0.15
      S.d4.tx = S.r.x - dir * 3 * FT; S.d4.ty = S.r.y - 1 * FT; S.d4.v = 0.17
    }
  }
  if (d && age >= d.at && (!d.early || age < d.at + d.flash)) {
    // the look that isn't: a show up high that goes back, or the corner's man cheating in and coming home
    if (d.k === 1 && d.early) { S.d5.tx = S.r.x + dir * 3 * FT; S.d5.ty = S.r.y - 1 * FT; S.d5.v = 0.17 }
    if (d.k === 2 && cov !== 'tag') { S.d4.tx = courtX(-dir * 9.5); S.d4.ty = courtY(7, h); S.d4.v = 0.14 }
  }
  // the turnover: who gets a hand on it. On a pass, the man nearest where it's going steps into the lane.
  if (res && res.kind !== 'good' && !(res.k === 2 && res.kind !== 'late')) {
    if (!S.thief) {
      const t = res.kind === 'late' || res.k === 0 ? S.h : res.k === 1 ? S.r : S.c
      let best = 1e9
      for (const m of S.all) { const dd = Math.hypot(m.x - t.x, m.y - t.y); if (dd < best) { best = dd; S.thief = m } }
      S.thiefAt = { x: lerp(S.h.x, t.x, 0.72), y: lerp(S.h.y, t.y, 0.72) }
    }
    const since = age - frozen, th = S.thief, lane = res.kind === 'late' || res.k === 0
    if (since < 240) { th.tx = lane ? S.h.x + (th.x < S.h.x ? -14 : 14) : S.thiefAt.x; th.ty = lane ? S.h.y - 14 : S.thiefAt.y; th.v = 0.2 }
    else { th.tx = th.x + (th.x < 180 ? -300 : 300); th.ty = courtY(26, h); th.v = 0.2 }   // ...and away up the floor, past us
  }
  // the man on the corner closes out when the ball comes to him
  if (res?.kind !== 'good' && res?.k === 2 && res?.kind !== 'late') { S.d4.tx = S.c.x + (S.c.x < 180 ? 18 : -18); S.d4.ty = S.c.y - 8; S.d4.v = 0.2 }
  mark(S.all)
  for (let i = 0; i < 5; i++) { S.all[i].v *= rep.pace?.d[i] ?? 1; seek(S.all[i], dt) }
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) apart(S.all[i], S.all[j], 22)
    apart(S.all[i], S.h, 20, 1); apart(S.all[i], S.r, 20, 1); apart(S.all[i], S.c, 20, 1)
  }
  capped(S.all, 0.2, dt)
}
// what's going on the floor this frame, far to near
const FLOOR = []
const putMan = (x, y, h, P2, team, back, who, extra) => { FLOOR.push({ x: xFt(x), z: zFt(y, h), P: P2, team, back, who, ...extra }) }
function floorDown(ctx, view, G, M) {
  FLOOR.sort((a, b) => b.z - a.z)
  for (const m of FLOOR) {
    if (!manAt(ctx, view, G.cam, m.x, m.z, m.P, { jersey: m.team.color, trim: m.team.trim, skin: m.who.skin, num: m.who.number, back: m.back, ball: m.ball, spin: m.spin, live: m.live })) continue
    // (a man off the side of the picture keeps his name to himself; a man in the air takes his up with him)
    if (M && PT.x > 6 && PT.x < view.w - 6) tagAt(PT.x, PT.y - (m.lift ?? 0) * (PT.k / FIG_FT), m.who.name, PT.k / FIG_FT)
  }
  FLOOR.length = 0
  if (M) tagsDown(ctx, view)
}
const moveOf = (w, still) => (w.step != null ? RUN_F[w.step] : still)
const stillD = (g, i) => (Math.floor(g.t / 340 + i * 0.7) % 2 ? POSE.guardA : POSE.guardB)
const HANDLER = easedState(), DRIB = newPose()
// after the whistle, on the floor. (No id: he's drawn live for the second or two these last)
const HEADS = figPose({ hy: 46, fFx: 11, fBx: -11, hFx: 12, hFy: 104, hBx: -12, hBy: 104 })   // hands on his head
const GUNS = figPose({ hy: 46, fFx: 14, fBx: -14, hFx: 31, hFy: 94, hBx: -31, hBy: 94 })       // the guns, after a slam
const WAG = figPose({ hy: 47, fFx: 13, fBx: -13, hFx: 16, hFy: 120, hBx: -20, hBy: 47 })       // not in here: one arm up, the hand going
const SLAM_AT = 640, DRIVE_AT = 300   // the roller: he's caught it, two steps, and he's up
const rattle = age => (age < 0 ? 0 : Math.sin(age / 26) * 3.2 * Math.exp(-age / 200))
const FOCUS = { x: 0, y: 0 }
function drawPnr(ctx, g, view) {
  const { h } = view, rep = g.rep, res = rep.res, c = view.colors, dir = rep.dir
  const age = g.t - rep.at, frozen = res ? res.at - rep.at : age, since = res ? g.t - res.at : -1
  smoothT(g)
  const G = courtCam(g)
  const S = stepScene(g, h, buildPnr, stepPnr)
  const us = teamOf(c, 0), them = teamOf(c, 1)
  const ok = res?.kind === 'good', late = res?.kind === 'late'
  const dunk = ok && res.k === 1, slam = dunk ? since - SLAM_AT : -1
  // the camera goes in on the rim on a dunk, between the shooter and the rim on a shot, on the thief on a turnover
  const pushed = !!res && !reduceMotion()
  if (pushed) {
    project(G.cam, 0, RIM_FT, 0)
    const rx0 = PT.x, ry0 = PT.y
    const open = ok || (res.k === 2 && !late)
    const on = open ? pnrAt(rep, res.k, frozen, h) : S.thief ?? S.h
    chestOf(G.cam, xFt(on.x), zFt(on.y, h), FOCUS)
    const f = dunk ? 0.86 : open ? 0.5 : 0
    pushCam(ctx, g, view, lerp(FOCUS.x, rx0, f), lerp(FOCUS.y, ry0, f), dunk ? 1.8 : open ? 1.34 : 1.26)
  }
  arenaStage(ctx, view, G, `pnr-${h}`)
  crowd(ctx, g, view, rep, G.wallY - (22 * h) / 640)
  const runAge = res ? frozen + Math.min(since, 300) : age
  const M = castMen(g, view)
  const R = pnrAt(rep, 1, runAge, h), rx = R.x, ry = R.y
  const C = pnrAt(rep, 2, runAge, h), cx = C.x, cy = C.y
  const H = pnrAt(rep, 0, runAge, h), hx = H.x, hy = H.y
  // the dunk: from where he caught it to the front of the rim, and he goes up
  let dx = rx, dy = ry, dj = 0
  if (dunk) {
    const f = easeOut(prog(since, DRIVE_AT, SLAM_AT - 60))
    dx = lerp(rx, courtX(dir * 1.1), f); dy = lerp(ry, courtY(2.7, h), f)
    dj = prog(since, SLAM_AT - 240, SLAM_AT - 30) * 46 * (1 - prog(slam, 180, 460))
  }
  // your men: who shoots, when
  const shootK = ok ? res.k : res && !late && res.k === 2 ? 2 : -1
  const pass = !res || res.k === 0 || late ? 0 : 190, catchAt = pass + 90, up = since - catchAt, dur = 360
  const shooting = k => shootK === k && up > -40 && up < dur + (ok ? 620 : 160)     // (he holds the follow-through on a make)
  const lifted = (k, top) => (shooting(k) ? Math.sin(clamp((up + 40) / (dur + 200), 0, 1) * Math.PI) * top : 0)
  // the ball, worked out first: the rim needs to know if it's in there
  const tk = res ? res.k : 0, tx = tk === 0 ? hx : tk === 1 ? rx : cx, ty = tk === 0 ? hy : tk === 1 ? ry : cy
  const th = S.thief
  let ball = null, netAge = null, spin = g.t / 180
  const X = xFt, Z = y => zFt(y, h)
  if (!res) {
    const b = Math.abs(Math.sin(g.t / 170))
    ball = AB; AB.x = X(hx) + dir * (29 / FIG_FT); AB.z = Z(hy) - 0.3; AB.y = lerp(BALL_R, (36 - 3) / FIG_FT - BALL_R, b)
  } else if (dunk && since >= pass) {
    // in his hands all the way up, then down through it hard
    if (slam < 0) { ball = AB; const held = since >= SLAM_AT - 240; AB.x = X(dx) + (held ? 13 : 4) / FIG_FT; AB.z = Z(dy) + 0.2; AB.y = held ? (130 + dj) / FIG_FT : 4.2; spin = 0 }
    else { ball = dropThrough(slam * 1.5); netAge = slam; spin = since / 60 }
  } else if (ok || (tk === 2 && !late)) {
    if (since < pass) { const f = since / pass; ball = flyTo(X(hx) + dir * 0.9, 3.9, Z(hy), X(tx), 4.2, Z(ty), f, 0.25); spin = 0 }
    else if (up <= 0) ball = null    // (it's in his hands)
    else {
      const f = up / dur, D = Math.hypot(X(tx), Z(ty)), hi = 8.2 + lifted(tk, 26) / FIG_FT
      if (f < 1) ball = flyTo(X(tx), hi, Z(ty), 0, RIM_FT + 0.35, 0, f, shotApex(D))
      else if (ok) { ball = dropThrough(up - dur); netAge = up - dur }
      else { const t = (up - dur) / 420, o = tx < 180 ? 1 : -1; ball = flyTo(0, RIM_FT + 0.35, -0.5, o * 7, BALL_R, -7, clamp(t, 0, 1), 1.6) }   // over a man in his face: off the iron, and out
      spin = since / 60
    }
  } else if (th && since < 230) {
    // a hand on it: the ball goes to the man who got it, and then it's his, the other way
    const f = since / 230
    ball = flyTo(X(hx) + dir * 1.2, tk === 0 && !late ? 7.5 : 3.6, Z(hy), X(th.x), 3.6, Z(th.y), f); spin = 0
  } else if (th) {
    const b = Math.abs(Math.sin(g.t / 130))
    ball = AB; AB.x = X(th.x) + (th.x < 180 ? -1.4 : 1.4); AB.z = Z(th.y) - 0.2; AB.y = BALL_R + b * 2
  }
  const atIron = hoopWith(ctx, G.cam, ball, netAge, spin, dunk ? rattle(slam) : 0)
  // the sounds of it, off the picture
  if (dunk && slam >= 0 && once(rep, '_in')) { g.nudge.kick(g.t, 5, 0, 1, 240); g.fx.push('make', 'stamp', 'h:heavy'); rep.popAt = g.t; rep.popBig = true }
  else if (netAge != null && !dunk && once(rep, '_in')) { g.fx.push('make', 'h:medium'); if (ok) rep.popAt = g.t }
  const made = ok && (dunk ? slam > 60 : netAge != null), lost = res && !ok && since > 620
  // the two who aren't options: near corner, far slot. Up off the bench of it when it goes in
  const offP = (made ? POSE.hands : POSE.off)
  putMan(courtX(dir * CORNER_FT), courtY(3.2, h), h, offP, us, true, whoOf(M?.us[2], 3, HSKIN[2]))
  putMan(courtX(-dir * 8.4), courtY(20, h), h, offP, us, true, whoOf(M?.us[4], 11, HSKIN[3]))
  // the defense
  S.all.forEach((m, i) => {
    const w = walk(g, `d${i}`, m.x, m.y, 9)
    const jump = res?.k === 0 && m === S.thief && since < 300 && !ok
    if (jump && since > 120 && once(rep, '_blk')) { g.nudge.kick(g.t, 3.5, 0, 1); g.fx.push('stamp', 'h:heavy') }
    const P2 = jump ? liftPose(POSE.hands, Math.sin((since / 300) * Math.PI) * 26) : made && w.step == null ? POSE.off : moveOf(w, stillD(g, i))
    putMan(m.x, m.y, h, P2, them, false, whoOf(M?.them[PNR_D[i]], 20 + i, HSKIN[(i + 1) % 5]))
  })
  // your men
  const rw = walk(g, 'roll', rx, ry, 9), hw = walk(g, 'hand', hx, hy, 9)
  const inHands = k => (shootK === k && !ok && up <= 0) || (shootK === k && ok && since >= pass && up <= 0)
  const shotP = k => (up < 0 ? POSE.gather : liftPose(POSE.shoot, lifted(k, 26)))
  if (dunk && since >= pass) {
    // up with it, hung on the rim a moment, and down with a word for somebody
    const P3 = slam > 460 ? GUNS : since < SLAM_AT - 240 ? (since < DRIVE_AT ? POSE.gather : RUN_F[Math.floor(since / 80) % 4]) : liftPose(POSE.layup, dj)
    putMan(dx, dy, h, P3, us, true, whoOf(M?.us[3], 44, HSKIN[1]), { live: true })
  } else putMan(rx, ry, h, shooting(1) ? shotP(1) : moveOf(rw, POSE.hold), us, true, whoOf(M?.us[3], 44, HSKIN[1]), { ball: inHands(1) ? IN_HANDS : null })
  putMan(cx, cy, h, shooting(2) ? shotP(2) : POSE.off, us, true, whoOf(M?.us[1], 8, HSKIN[0]), { ball: inHands(2) ? IN_HANDS : null })
  // the handler's dribbling: his ball hand's low on the side he's going
  if (shooting(0)) copyPose(shotP(0), DRIB)
  else if (lost) copyPose(HEADS, DRIB)
  else if (made && !shooting(1) && !shooting(2) && res.k !== 0) copyPose(POSE.hands, DRIB)
  else if (res) copyPose(POSE.hold, DRIB)
  else {
    copyPose(hw.step != null ? RUN_F[hw.step] : dir > 0 ? POSE.dribR : POSE.dribL, DRIB)
    const b = Math.abs(Math.sin(g.t / 170))
    if (dir > 0) { DRIB.hFx = 29; DRIB.hFy = 28 + b * 8 } else { DRIB.hBx = -29; DRIB.hBy = 28 + b * 8 }
  }
  putMan(hx, hy, h, easedPose(HANDLER, DRIB, g, CLK.dt, 28), us, true, whoOf(M?.us[0], 1, HSKIN[4]), { live: true, ball: inHands(0) ? IN_HANDS : null })
  floorDown(ctx, view, G, M)
  if (ball && !atIron) ballIn(ctx, G.cam, ball.x, ball.y, ball.z, spin)
  if (pushed) ctx.restore()
}

// ── Protect the rim: a 3-on-1 fast break ────────────────────────────────────
// You're the big, alone, back. Three of them are coming from half court, spread lane-wide, moving it
// as they come: flat, quick passes, a different number each trip. One of them goes up: a gather, then
// he's off the floor with the ball overhead. Tap him: your big steps up, leaves the floor with both
// hands high and knocks it out of the air. Too soon and he's gone by you. Too late and it's over him.
// We're running with them, on the floor behind them, and the hoop and your big come up to meet us.
const carrierAt = (rep, age) => {
  let who = 1
  for (const s of rep.seq) { if (age >= s.at + PASS_MS) who = s.to; else if (age >= s.at) return -1 }
  return who
}
const RIM_X = [-7, 2.6, 7], RIM_Y = [4.5, 8, 4.5]   // (the middle man off the rim's line, so your big's in the clear between them)
const leftOf = (rep, age) => 13 * clamp(1 - age / rep.delay, 0, 1)   // feet to go: they cover it all by the shot
function rimAt(rep, k, age, h) {
  // they run to their spots as the shot comes, lanes narrowing on the way in
  // (a quicker man has come from further back in the same time)
  const left = leftOf(rep, age) * (rep.pace?.men[k] ?? 1)
  const lat = 1 + left / 200
  P.x = courtX(clamp((k === 1 && rep.flip ? -RIM_X[k] : RIM_X[k]) * lat + Math.sin(rep.ph[k]) * 0.5, -21, 21))
  P.y = courtY(RIM_Y[k] + left, h)
  return P
}
const CLOSE = 30   // how near he gets to a shooter: an arm's length, on the rim side of him
function buildRim(rep, h) { return { big: body(180, courtY(5, h)), m: [{}, {}, {}], knock: null } }
function stepRim(g, rep, S, dt, h, age) {
  const res = rep.res, big = S.big, frozen = res ? res.at - rep.at : age
  for (let k = 0; k < 3; k++) { const p = rimAt(rep, k, Math.min(age, frozen), h); S.m[k].x = p.x; S.m[k].y = p.y }
  if (!res || res.kind === 'late') {
    // he stays between the ball and the rim, giving ground toward it
    const c = carrierAt(rep, frozen)
    if (c >= 0) { big.tx = lerp(180, S.m[c].x, 0.3); big.ty = Math.min(courtY(7, h), lerp(courtY(1, h), S.m[c].y, 0.28)) }
    big.v = 0.09
  } else {
    // he steps up on the man you sent him at, and stops an arm's length off, on the rim side
    const t = S.m[res.k], rx = 180, ry = rimOf(h), d = Math.hypot(rx - t.x, ry - t.y) || 1
    big.tx = t.x + ((rx - t.x) / d) * CLOSE; big.ty = t.y + ((ry - t.y) / d) * CLOSE
    big.v = 0.3
  }
  big.v *= rep.pace?.d[0] ?? 1
  seek(big, dt)
}
const SHOOTER_ST = [easedState(), easedState(), easedState()], BIG_ST = easedState(), BIG_OUT = newPose()
function drawRim(ctx, g, view) {
  const { h } = view, rep = g.rep, res = rep.res, c = view.colors
  const age = g.t - rep.at, frozen = res ? res.at - rep.at : age, since = res ? g.t - res.at : -1, flight = g.W.flight
  smoothT(g)
  const G = courtCam(g, Math.min(age, frozen))
  arenaStage(ctx, view, G, `rim-${h}`, false)
  crowd(ctx, g, view, rep, G.wallY - (22 * h) / 640)
  const S = stepScene(g, h, buildRim, stepRim)
  const us = teamOf(c, 0), them = teamOf(c, 1)
  const ok = res?.kind === 'good', late = res?.kind === 'late'
  const blocked = ok && res.ms <= rep.T * 0.72
  const carrier = carrierAt(rep, frozen)
  // who the ball ends up going up from: the shooter, or whoever's left when you went too soon
  const scorer = res && !ok ? (frozen >= rep.delay ? rep.open : carrier >= 0 ? carrier : rep.seq.find(q => frozen < q.at + PASS_MS)?.to ?? rep.open) : rep.open
  const sTime = res && !ok && !late ? since - 120 : 1e9     // (he takes his time when nobody's on him)
  const X = xFt, Z = y => zFt(y, h)
  let bx = 0, by = 0, by2 = 3.5, shooterJ = 0, sx = 0, sy = 0, scorerJ = 0
  const M = castMen(g, view)
  for (let k = 0; k < 3; k++) {
    const p = rimAt(rep, k, frozen, h), x = p.x, y = p.y
    let j = 0, gather = 0
    const isShot = k === rep.open && frozen >= rep.delay
    if (isShot) {
      gather = prog(frozen, rep.delay, rep.delay + 90)
      j = easeOut(prog(frozen, rep.delay + 70, rep.delay + rep.T * 0.72)) * 30
      if (res) j *= 1 - clamp((since - 260) / 320, 0, 1)      // and he comes down
    }
    if (k === scorer && sTime > 0 && sTime < 400 && !isShot) { j = Math.sin(clamp(sTime / 400, 0, 1) * Math.PI) * 24; gather = 1 }
    const w = walk(g, `a${k}`, x, y, 10)
    const has = k === carrier, upNow = j > 1 || gather > 0.6
    // blocked: it's gone, and he comes down off balance
    const knocked = blocked && k === rep.open && since > flight
    const Pp = knocked ? (since > flight + 380 ? POSE.land : x < 180 ? POSE.stumbleL : POSE.stumbleR) : upNow ? POSE.layup : gather > 0 ? POSE.gather : moveOf(w, POSE.hold)
    if (has) { bx = x + (x < 180 ? 7 : -7); by = y; by2 = upNow ? 8.2 + j / FIG_FT : gather > 0 ? 5 : 3.4 }
    if (k === rep.open) { sx = x; sy = y; shooterJ = j }
    if (k === scorer) scorerJ = j
    const shown = easedPose(SHOOTER_ST[k], upNow || knocked ? liftPose(Pp, j) : Pp, g, CLK.dt, 24)
    putMan(x, y, h, shown, them, true, whoOf(M?.rush[k], [10, 3, 23][k], HSKIN[k]), { live: true, lift: upNow || knocked ? j : 0 })
  }
  // a pass: flat, fast, hands to hands
  if (carrier < 0) {
    const s = rep.seq.find(q => frozen >= q.at && frozen < q.at + PASS_MS), f = (frozen - s.at) / PASS_MS
    let from = 1
    for (const q of rep.seq) { if (q === s) break; from = q.to }
    const a = rimAt(rep, from, s.at, h), ax = a.x, ay = a.y, b = rimAt(rep, s.to, s.at + PASS_MS, h)
    bx = lerp(ax, b.x, f); by = lerp(ay, b.y, f); by2 = 3.8
  }
  // the ball: it's what you follow
  let ball = AB, netAge = null, spin = 0
  const m = res ? rimAt(rep, scorer, frozen, h) : null, mx = m?.x, my = m?.y
  const fromRim = res ? Math.hypot(X(mx), Z(my)) : 0, topY = 8.2 + scorerJ / FIG_FT
  if (!res) { AB.x = X(bx); AB.z = Z(by); AB.y = by2 + (carrier >= 0 && by2 < 4 ? Math.sin(g.t / 120) * 0.2 : 0) }
  else if (blocked) {
    // on its way up when his hands get there, and it goes the other way
    const hitY = 9.2 + shooterJ * 0.03, hx = lerp(sx, S.big.x, 0.42), hy = lerp(sy, S.big.y, 0.42)
    if (since < flight) flyTo(X(sx), 8.2 + shooterJ / FIG_FT, Z(sy), X(hx), hitY, Z(hy), since / flight)
    else {
      const t = clamp((since - flight) / 560, 0, 1), o = sx < 180 ? 1 : -1, endX = X(hx) * 0.45, endZ = -14
      flyTo(X(hx), hitY, Z(hy), endX, BALL_R, endZ, t, 3.4); spin = since / 40
      // ...and it keeps coming, bouncing away down the floor
      if (t >= 1) { const a = (since - flight - 560) / 1000; AB.x = endX + o * a * 3; AB.z = endZ - a * 6; AB.y = BALL_R + Math.abs(Math.sin(a * 8)) * 2.6 * Math.exp(-a * 3) }
    }
  } else if (ok) {
    // he got a hand up: it goes up short, off the iron
    const f = since / 400
    if (f < 1) flyTo(X(mx), topY, Z(my), 0, RIM_FT + 0.2, -0.55, f, shotApex(fromRim))
    else { const t = clamp((since - 400) / 300, 0, 1), o = mx <= 180 ? 1 : -1; flyTo(0, RIM_FT + 0.2, -0.55, o * 7, BALL_R, -7, t, 1.2) }
    spin = since / 60
  } else {
    // nobody there, or too late: up with an arc, and in
    const wait = late ? 0 : 160, f = (since - wait) / 380
    if (f <= 0) { AB.x = X(mx); AB.z = Z(my); AB.y = 6 }
    else if (f < 1) flyTo(X(mx), topY, Z(my), 0, RIM_FT + 0.35, 0, f, shotApex(fromRim))
    else { dropThrough(since - wait - 380); netAge = since - wait - 380 }
    spin = since / 60
  }
  // off the iron (the short one), it shakes
  const irony = ok && !blocked ? rattle(since - 400) * 0.7 : 0
  const atIron = hoopWith(ctx, G.cam, ball, netAge, spin, irony)
  if (blocked && since >= flight && once(rep, '_blk')) { g.nudge.kick(g.t, 4, 0, 1, 200); g.fx.push('stamp', 'h:heavy'); rep.popAt = g.t; rep.popBig = true }
  if (blocked && since >= flight + 560 && once(rep, '_bnc')) g.fx.push('dribble')
  if (ok && !blocked && since >= 400 && once(rep, '_iron')) g.fx.push('rimmiss', 'h:medium')
  if (netAge != null && once(rep, '_in')) g.fx.push('make', 'h:medium')
  // him: both hands up when he goes, off the floor
  const big = S.big, went = res && !late, bw = walk(g, 'big', big.x, big.y, 10)
  const jump = went ? easeOut(clamp(since / flight, 0, 1)) * (1 - clamp((since - flight - 170) / 300, 0, 1)) : 0
  // (arms straight out to the sides on the way, straight up when he goes)
  // (his feet shuffle under him; his body stays level and his arms stay put)
  copyPose(moveOf(bw, POSE.guardA), BIG_OUT); BIG_OUT.hx = 0; BIG_OUT.lean = 0; BIG_OUT.hy = 43; BIG_OUT.hFx = 50; BIG_OUT.hFy = 79; BIG_OUT.hBx = -50; BIG_OUT.hBy = 79
  // he's sent it into the seats: not in here. And when it's over him, hands on his head
  const down = since > flight + 470
  let Pb = jump > 0.02 ? liftPose(POSE.hands, jump * 36) : BIG_OUT
  if (blocked && down) { WAG.hFx = 16 + Math.sin(since / 62) * 10; Pb = WAG }
  else if (res && !ok && since > (late ? 420 : 620)) Pb = HEADS
  putMan(big.x, big.y, h, easedPose(BIG_ST, Pb, g, CLK.dt, 24), us, false, whoOf(M?.us[0], 34, HSKIN[1]), { live: true })
  floorDown(ctx, view, G, M)
  if (!atIron) ballIn(ctx, G.cam, AB.x, AB.y, AB.z, spin)
}

const SCENES = { 'hot-read': drawHot, gap: drawGap, 'jump-route': drawJump, 'zone-drop': drawJump, pnr: drawPnr, 'rim-protect': drawRim }
