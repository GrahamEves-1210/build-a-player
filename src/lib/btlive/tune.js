// BLACKTOP LIVE: every number the game is balanced on, in one table (scripts/btlive/balance.mjs checks them
// against the brief's targets: F:/bap-agents/btlive/DESIGN.md). Pure data: no DOM, no React, runs in Node.
// Ratings arrive as 0-11 grades and are used as n = 0..1 (ratings.js: an 11 is 1), so "x + y * n" reads "x + y at an 11"
// and less below it; how much less is `spread`, the first line of the table.
// Distances are feet, times are seconds unless a name says Ms or Ticks.

// THE PACE (the owner, 2026-11-24: "speed up player movement and game in general 20%"). Every speed and time below is
// written in the game's own seconds, and the game is stepped 30 times in each of them, as it always was (GHZ: the
// step it is balanced at). What changed is how many of those steps go by in a second on a watch: 36, not 30. So
// every man, the ball, a pass, a shot's flight, a jump, a cooldown, a freeze, the dead ball and the check are all
// 20% quicker together, and inside its own clock the game is the same game, step for step.
// What a person does is NOT on the game's clock and stays in real time: the shot meter (ms), the shot clock (the
// seconds on the scorebug), a pressed SHOOT waiting for the ball, a person's reaction time.
export const GHZ = 30                // steps in one of the game's seconds
export const HZ = 36                 // steps (ticks) in a real second (the screen draws at 60 and eases between them)
export const PACE = HZ / GHZ         // 1.2: the game's seconds in a real one
export const DT = 1 / GHZ            // the game's seconds in one tick
// a time in the game's seconds as ticks (gticks), and a real one, on a watch (rticks)
export const gticks = sec => Math.max(1, Math.round(sec * GHZ))
export const rticks = sec => Math.max(1, Math.round(sec * HZ))

// The half court, in feet, at its real size (an NBA half court: 50 ft wide, 47 ft from the baseline to half court).
// x runs left to right, y from the top of the picture (behind the baseline) down past half court. The lines are drawn
// from these same numbers (engine.js courtLines), so what the game counts is what the floor shows.
const BASE = 2.3, RIMY = BASE + 5.25
export const COURT = {
  W: 56, H: 51.6,                    // the whole picture (the court and the apron round it)
  minX: 3.0, maxX: 53.0,             // sidelines (50 ft apart)
  minY: BASE, maxY: BASE + 47,       // baseline, half-court line
  board: { y: BASE + 4, w: 6 },      // the backboard's face: 4 ft in from the baseline, 6 ft wide
  rim: { x: 28, y: RIMY },           // the rim's middle: 15 in out from the board (5 ft 3 in from the baseline)
  rimR: 0.75,                        // the rim, 18 in across
  arcSideX: 22,                      // the three-point line: straight up each corner 22 ft from the rim's x...
  arcSideY: RIMY + Math.sqrt(23.75 * 23.75 - 22 * 22),   // ...to where it meets the arc (about 14 ft up from the baseline)...
  arcC: { x: 28, y: RIMY }, arcR: 23.75,   // ...then 23 ft 9 in round the rim
  paint: { x0: 20, x1: 36, y1: BASE + 19 },   // the lane: 16 ft wide, the free-throw line 15 ft from the board
  ftR: 6,                            // the free-throw circle
  ra: 4,                             // the restricted area: 4 ft round the rim
  centerR: 6, centerR2: 2,           // the centre circle at half court (and the small one inside it)
  check: { x: 28, y: RIMY + 23.75 + 2.6 },   // where the ball is checked: the top of the key, just behind the arc
}

export const RULES = {
  goal: 11, winBy: 2, cap: 15,       // first to 11 by ones and twos, win by 2, capped at 15 (today's Blacktop; King of the Hill too)
  shotClock: [12, 14],               // real seconds (the scorebug's), by players a side (1v1 and King of the Hill, 2v2)
  orebClock: 8,                      // the clock after an offensive rebound (real seconds)
  checkTime: 0.8,                    // the ball is checked: nobody moves for this long (the game's seconds: PACE)
  deadTime: 1.1,                     // after a basket or a turnover, before the next check (the game's seconds)
  makeItTakeIt: true,                // score and keep the ball (today's Blacktop)
  // Fouls: none. A reach is its own punishment (the defender is frozen), bodies just collide.
}

export const T = {
  // ── How far apart a 1 and an 11 are ─────────────────────────────────────────────────────────────
  // Every "at a 1" below is really at "1 - spread" of the way down from an 11: the top of each rating is where
  // the brief puts it (a great shooter, a great finisher) and this one number sets how much worse a low grade is,
  // so how often a 95 beats an 80. 1 = the full range below; lower = builds closer together.
  // (the owner, 11-26: "make grades matter a little more across the board": 0.24 to 0.29, and every coefficient on a
  // plain grade about a fifth wider, the base moved so a middling grade plays as before; scripts/btlive/grades-check.mjs)
  spread: 0.29,

  // ── Movement (slow on purpose: a late update from a laggy phone is a small error) ──────────────
  // REAL WEIGHT (the owner, 11-26: "players all seem the same speed and there's no acceleration aspect, or sprint"):
  // a quick guard and a slow big are clearly different, a first step then a build to top speed, a sprint that builds
  // the longer he goes one way, cuts that cost speed (less for a quick man), stopping that takes room, a beaten
  // defender's burst to get back, and a running jump that carries. The CPU runs on the same feet
  speedMin: 9.2,                     // top speed at Speed 1, ft/s (on the plain grade: spread doesn't squeeze it)
  speedBand: 0.24,                   // the fastest (Speed 11) is this much quicker than the slowest (Speed 1)
  sizeSlow: 0.085,                    // Size 11 is this much slower than Size 1
  ballSpeed: 0.92,                   // with the ball at Handles 1 (x top speed)...
  ballSpeedHnd: 0.05,                // ...plus this at Handles 11 (an 80 keeps 96%: slower with it than without, always)
  defSpeed: 1.10,                     // guarding, at Perimeter D 1 (x top speed; the owner, 11-26: defenders ~9% quicker)...
  defSpeedPer: 0.085,                 // ...plus this at Perimeter D 11 (on the plain grade: an 80 about 105%, a step quicker than the ball)
  accel: 12,                         // ft/s²: his push (x his rating's share: accelBase..)...
  firstStep: 3.0,                    // ...x this from a standstill (a quick first step: 36 ft/s²)...
  stepFade: 2.8,                     // ...falling by this x (his speed / top), never under x0.4: top speed takes a run to build
                                     // (90% of it in 0.36 s for a quick guard, 0.58 s for a slow big: move-check.mjs)
  brake: 32,                         // ft/s²: slowing down or stopping (x the same rating factor): quicker than speeding up, not
                                     // instant (from a sprint that's about 2 ft of stopping: a man can overrun his spot)
  backpedal: 0.9, backpedalPer: 0.06,    // a defender's top speed going backwards (facing his man, giving ground), + this at
                                     // Perimeter D 11 (the plain grade)...
  slide: 0.9, slidePer: 0.04,        // ...and sliding sideways (forward, at his man: all of it)
  mirror: 0.6,                       // ...going with his man the way he's going, this much of what that costs back (cutting him off)
  // with the ball, by the way he goes against the basket (the owner, 11-26: "speed is too constant with the ball"): at
  // the rim all of it (and only a drive builds the sprint), across this share, backing out this share (+ this x Handles)
  ballSide: 0.82, ballSideHnd: 0.06,
  ballBack: 0.52, ballBackHnd: 0.1,
  boost: 0.15, boostTime: 0.45,      // out of a hesitation, a crossover, between the legs, an in-and-out: this much quicker for this long
  accelBase: 0.805, accelSpd: 0.54,   // ...x (0.85 + 0.45 x Speed, the plain grade): a quick first step
  accelSize: 0.3,                    // ...less this at Size 11
  sprint: 0.12, sprintTime: 1.1,     // a sprint: going one way he builds up to this much over top speed, all of it after this long
                                     // (the game's seconds) going straight...
  sprintKeep: 0.6,                   // ...a turn keeps the sprint while the way he's going stays within this (cos) of the way he was
  cutLoss: 3.2, cutSpd: 0.55,        // a hard cut at speed (over 50 deg off the way he's going) bleeds this share of his speed a
                                     // second, a Speed 11 this much less of it: a quick guard cuts sharper
  recover: 0.10, recoverSta: 0.14,   // a beaten defender's burst back: this much quicker, his legs this much a second
  airDrag: 0.8,                      // in the air he carries the way he went up, losing this share a second
  layRun: 1.4,                       // a layup from a run: from this much farther out at top speed (a long gather step)
  defAccel: 0.895, defAccelPer: 0.29, // a defender's: x (0.92 + this * Perimeter D, the plain grade)
  walk: 0.25,                        // stick pushed less than this far: ignored (dead zone)
  radius: 1.55,                      // a body's radius (the dot on the screen is this big): nobody walks through anybody
  ground: 3.0,                       // anyone standing still (not the man guarding the ball) is this much harder to move
  groundDef: 1.7,                    // the man guarding the ball, set (slower than this many ft/s), holds this much ground...
  groundDefSpeed: 4.0,
  massSize: 0.8,                     // ...and the rest is weight: 1 at Size 1, 1 + this at Size 11 (a big backs a guard down)
  gatherSlowJ: 0.25,                 // speed kept while rising for a jumper
  gatherSlowL: 0.52,                 // ...and while going up for a layup
  follow: 0.45,                      // after the release he's this long coming down before he can move freely
  footIn: 0.75,                      // the man with the ball is out when his centre is this close to a line (his foot on it:
                                     // the dot reaches radius past the centre, a foot about half that)
  softEdge: 1.5,                     // the man with the ball: inside this of the line he'd be out at, his push out over it dies
                                     // away and he's held in, sliding along it (the owner, 11-26: "goes out of bounds too
                                     // easily"); only a dribble move's burst (or a body) takes him over
  lineKeep: 0.9,                     // everyone else stays this far inside (eased back, never past the line itself)
  clearPast: 0.8,                    // taking it back after a stop: his centre this far behind the arc (his feet behind it)
  shootBuffer: 0.5,                  // a SHOOT press this recent starts the shot the moment he can (a catch, a board)

  // ── The shot meter (judged on the shooter's own device: only the quality 0-1 is sent) ──────────
  // ONE SWEEP (the owner, 11-26): the fill rises to the top in the ideal's time (where the green is) and comes back down
  // to the bottom at the total (twice the ideal): green on the way up or the way down; held to the bottom, it goes up
  // late. The window in ms is what it was (an average kid's odds per situation unchanged); drawn, the green at the top
  // is half the band it was, met twice
  jTotalMs: 1000,                    // a jumper's meter runs this long; held past it, the shot goes up late
  jIdealMs: 500,                     // the middle of the green window
  jWinMs: 11, jWinJs: 31,            // green half-width: 11 + 31 x (plain Jump Shot)²: 42 ms at 11, 11 at a 1 (a green always goes in)
  jFallMs: 170,                      // past the green, quality runs down to 0 over this long (the meter's fill: a miss either way)
  // layups and dunks: their own meter. The owner, 11-26: "layup meter feels too fast, it's so hard to time": it fills
  // lSlow slower (620 to 900 ms, the green at 435 not 300), and everything about its timing in ms is lSlow wider with it
  // (the window, the fall, the most it can be, the error a kid's and a CPU's release are judged with: kidSd x lSlow),
  // so the odds are what they were and the time to see it coming is longer
  lSlow: 1.45,
  lTotalMs: 870, lIdealMs: 435,
  lWinMs: 35, lWinFin: 46,           // green half-width from Finishing: 35 + 46 x (plain Finishing)²: 81 ms at 11, 35 at a 1
  lFallMs: 275,
  greenWallL: 0.55,                  // a green layup or dunk goes in unless the contest on it is this much or more (walled up)
  dunkWin: 1.35,                     // a dunk's window is this much wider
  clutchLo: 0.5, clutchHi: 1.2,      // at game point the green window is this x at Clutch 1 ... this x at Clutch 11
  clutchMake: 0.45,                  // late in a game the shot's chance is x (1 + this * (Clutch - half)): +22% at 11, -22% at 1...
  clutchFrom: 3,                     // ...late: game point, or anyone this close to the goal
  minHoldMs: 120,                    // let go sooner than this and it still counts as held this long (a tap is a bad release)
  relMinJ: 0.42,                     // a jumper let go at the worst time keeps this much of its chance (a bad one can still drop)
  relMinL: 0.62,                     // ...a layup this much
  slightJ: 0.86,                     // just outside the green: the chance starts from here and falls to relMin
  // THE GREEN WINDOW IS THE SHOT (the owner, 11-25: "no slightly makes, just make the green window match the shot").
  // A release in the green goes in, anything else misses; nothing is rolled. How wide the green is comes from how
  // hard the shot is right now (the make chance below: his rating there, the distance, the hand in his face, on the
  // move, his legs, game point): wide enough that an average kid's timing (kidSd: the spread of his release, ms)
  // makes it that often. It changes while he rises (a man closing out shrinks it on the meter)
  kidSd: 75,                         // ms: the release error of an average kid (the CPU levels: cpu.js LEVELS meterSd)
  winMin: 4, winMax: 120,            // ms either side of the ideal, at the least and the most
  winMaxL: 240,                      // ...a layup or a dunk's most (an open layup's 95% needs about 147)
  checkRush: 0.4,                    // a shot right off the check (before a move, inside checkRushS): the chance x (1 - this), fading out
  checkRushS: 1.0,                   // ...over this long (real seconds)
  staShot: 0.12,                     // legs empty: the chance x (1 - this)

  // ── Make chance: rating at that spot x release x contest. Open, perfect release: ─────────────────
  layBase: 0.58, layFin: 0.38,       // layup: 87% at Finishing 1, 96% at 11 (an 80: 91%) open at the rim: the best shot there is
  layRange: 7.0,                     // inside this many feet of the rim SHOOT is a layup (or a dunk)
  layFar: 0.045,                     // a layup loses this much a foot past 3 ft (a runner from 7 ft: 18% less)
  // AN OPEN LAYUP IS EASY (the owner, 11-26: "open layups too hard to hit"): nobody close enough to bother it (the
  // contest under openLayC: no one within about 4 ft) and he's in close (6 ft in, fading out by 8), it goes in this
  // often for an average kid, whatever his Finishing; a hand on it takes that away the closer it gets
  openLay: 0.95, openLayC: 0.3,
  dunkRange: 5.2,                    // a dunk starts inside this
  dunkFar: 4.5, dunkFarSize: 0.9,    // an open lane: he takes off from farther out, up to this more at Bounce 11 (+ this at Size 11)
  laneW: 3.6,                        // ...open: no one who can guard within this of the line from him to the rim
  dunkBounce: 0.35,                  // Bounce (the plain grade, 0-1) under this: never dunks, lays it up (a Bounce 4 or lower)
  dunkNear: 2.6,                     // a low leaper only dunks from this close (at dunkBounce)...
  dunkHop: 0.45,                     // ...and only with nobody on him; under this share of the way up the Bounce scale a man near
                                     //    him turns it into a layup (above it, he goes up over him: a poster)
  dunkGuard: 5,                      // ...a man within this of him, between him and the rim or at it, is on him
  dunkSlow: 0.4,                     // a low leaper's dunk gathers this much slower (the meter's ideal, x 1 + this at the floor)
  dunkLow: 0.14,                     // ...and goes down this much less often open
  dunkChance: 0.9,                   // how often an able dunker dunks: (plain Bounce - dunkBounce) x this (x a touch more with Finishing)
  dunkBase: 0.90, dunkFin: 0.08,     // a dunk goes down 94-98% open
  closeBase: -0.53, closeJs: 1.30,   // a jumper from 8 ft: 41% at Jump Shot 1, 72% at 11 (steep: spread is small, a non-shooter still can't shoot)
  arcBase: -0.66, arcJs: 1.20,       // a jumper from the arc (25 ft): 25% at Jump Shot 1, 54% at 11 (an 80: 39%)
  arcRef: 25, curve: 1.55,            // the distance those are measured at, and how the chance bends between 8 ft and there
  pastK: 0.16, pastJs: 0.06,         // every foot behind the three-point line: the chance x e^-(0.16 - 0.06 x Jump Shot) (range)
  setFeet: 0.16,
  setFeet3: 0.07,                    // ...and a three on the move this much more on top (owner 11-26: a moving three is harder)
  selfRebWaitL: 0.8,                 // ...off his own layup or dunk (he's coming down under it), this long
  selfRebWait: 0.6,                  // s: the shooter, coming down, can't get to his own miss before this (owner 11-26)
  selfRebW: 0.4,                     // ...and in a scramble for it he's this much less likely to come up with it                     // a jumper taken at a full run loses this much (a step-back lands him set: little); still: nothing
  runFrom: 0.2,                      // ...from this share of his top speed up (a drift is free)
  csWindow: 1.3,                     // a jumper this soon after a catch is "off the catch"...
  csBoost: 0.25,                     // ...and gains up to this much from the passer's Passing/Playmaking
  csLay: 0.50,                       // a layup or a dunk that soon off the catch: the contest counts this much less at the passer's Passing 11
  rushAt: 3.0,                       // a shot in the last 3 s of the shot clock is rushed...
  rushPen: 0.22,                     // ...and loses this much at IQ 1, nothing at IQ 11

  // ── Contest: how close, where (in front / beside / beaten), how he stands, who he is ───────────────────────────────────────
  contestRange: 7.0,                 // a defender farther than this doesn't bother a jumper...
  contestNear: 2.5,                  // ...and at this distance he's all the way in it (a straight line between)
  contestRangeL: 6.5, contestNearL: 3.3,   // ...at a layup or a dunk (bodies touch at 3.1: a man on him is all the way in it)
  contestCurve: 1.3,                 // in between it bends (1 = a straight line)
  contestStand: 0.52,                // feet on the floor, no hand up
  contestJump: 0.96, contestJumpBnc: 0.2,    // a hand up (BLOCK: he goes up at it): this + Bounce (an 80 about 1.1)
  contestSet: 0.75,                  // ...set in front of a layup, not moving: walls up, but he can be finished on
  lateShare: 0.6,                    // a man who closes out after the shot went up gets this much less of his contest at most
  lateShareL: 0.25,                  // ...on a layup or a dunk (it goes up slower, and he flies at it)
  gatherHoldL: 0.7,                  // a layup keeps at least this share of the contest he went up into (every hand up), slid by or not
  contestBeat: 0.15,                 // frozen or on the floor
  frontDot: 0.5,                     // square in front: full; beside him (at right angles to the rim)...
  contestSide: 0.55,                 // ...this much; trailing straight behind him (he beat you)...
  contestBehind: 0.6,                // ...this much (a man on his hip still bothers it)
  contestRate: 0.34, contestRateDef: 0.50, contestRateIq: 0.20,   // x (0.30 + 0.5 * his defense + 0.2 * his IQ): Perimeter D on jumpers, Interior D in the paint and at the rim
  contestSize: 0.30,                 // x (1 + this * (his Size n - the shooter's Size n)): shoot over small men, not over big ones
  contestSecond: 0.28,               // a second man in it adds this share of his own contest (help at the rim, two on the king)
  contestMaxJ: 0.92,                 // a perfect contest takes this share off a jumper
  jsThrough: 0.33,                   // Jump Shot 11 shoots over this share of a jumper's contest (Jump Shot 1 none of it)
  contestMaxL: 0.90,                 // ...off a layup
  contestMaxD: 0.55,                 // ...off a dunk...
  dunkThrough: 0.35,                 // ...less this share at Bounce 11
  finThrough: 0.40,                  // Finishing 11 shrugs off this share of a layup's contest

  // ── The CPU's judgment ───────────────────────────────────────────────────────────────────────────
  cpuRespect: 3,                     // a CPU defender sees a drive this many ticks later per 1.0 of the man's Jump Shot over 0.55 (sooner under it)
  cpuRace: 0.35,                     // how often a CPU on a driver's hip races him to the spot instead of running into him (x his contest)
  cpuNeed: 0.42,                     // early in the clock a CPU wants a shot worth this (later, less)...
  cpuHurry: 0.05,                    // ...and this much less every second he has had it (a streetball possession doesn't wait around)
  twoValue: 1.45,                    // a two is worth this many ones to a CPU (make it, take it: either make keeps the ball)
  cpuDriveV: 0.55,                   // a jumper never has to be worth more than this (a make = 1, a two 1.45) while there's time to go to the rim...
  cpuBeat: 0.4, cpuBeatR: 0.8,       // ...how often he gets by his man: this, + this x (his Speed and Handles - the man's Speed and Perimeter D) / 2
  cpuDriveRisk: 0.74,                // ...and otherwise only more than the drive: a layup on his man walled up at the rim, x this (a strip, a block)
  cpuJumpEdge: 0.08,                 // ...by this much (a miss at the rim comes back more often than a long one)
  cpuCrash: 0.08, cpuCrashReb: 0.15,  // a CPU follows his own shot this often (+ this x his Rebounding); else he lands and...
  cpuHold: 0.95,                     // ...holds this long into the miss before he goes for it (the owner, 11-26)
  cpuCushion: 0.5,                   // ft a CPU gives a man driving at him (a step of cushion)
  cpuAngle: 1.6,                     // ft more he gives a man going across him (a curl, the baseline): he keeps the angle
  cpuSitV: 0.33,                     // an open look over a man sitting back at the rim: worth taking from this

  // ── Blocks (JUMP, timed against the release) ────────────────────────────────────────────────────
  jumpTime: 0.50,                    // off the floor this long...
  jumpLand: 0.10,                    // ...then this long to land before he can move again
  blockReach: 3.6,                   // within this of the shooter at the release (plus Bounce and Size)...
  blockReachBnc: 0.9, blockReachSize: 0.7,
  blockIn: 0.0, blockOut: 0.95,      // ...and in the air at the release (any of the jump but the landing): on time. Else blockLate of it
  blockAfter: 0.16,                  // a man who goes up just after the release can still get it, this long into its flight (s)
  blockBase: 0.15,                   // on-time chance, x the four below (the plain grades, 0-1)
  blockInt0: 0.1, blockInt: 1.8,     // x (0.25 + 1.5 x Interior D)
  blockSize: 1.44, blockSizeMin: 0.12,// x (1 + 1.2 x (his Size - the shooter's)), never under 0.12
  blockBnc0: 0.52, blockBnc: 0.96,     // x (0.6 + 0.8 x Bounce)
  blockJumper: 0.55, blockDunk: 0.5, // jumpers and dunks are harder to get than layups
  blockMax: 0.7,
  blockLate: 0.3,                    // off time (up too early, too late): this share of the chance
  blockFar: 0.25,                    // at the edge of his reach he gets this much less of it
  blockClose: 4.0, blockTight: 1.8,  // right on the shooter: from this close, all of it this close (bodies touch at 3.1)...
  blockCloseK: 1.3,                  // ...the chance x (1 + this)...
  blockCloseTime: 0.5,               // ...and off time keeps this much more of it (a hand up with him gets there)
  blockShort: 0.2,                   // a jumper from 6 ft has this much of a jumper's cut back (a three: none)
  blockRun: 1.2,                     // a running jump (10 ft/s or more) reaches this much farther: a chase-down

  // ── Steals (a swipe with a cooldown; a miss costs a beat) ───────────────────────────────────────
  stealReach: 3.9,                   // the ball has to be this close
  stealBase: 0.16,                   // chance at average everything, square in front
  stealPer: 0.7,                     // x (0.55 + this * Perimeter D)
  stealHnd: 0.6,                     // x (1.3 - this * the handler's Handles)
  stealBurst: 0.45,                  // against a handler in the middle of a dribble move
  stealGather: 1.25,                 // against a handler going up
  stealBehind: 0.35,                 // from behind him
  stealIq: 0.6,                      // x (1 + this * (0.75 - the handler's IQ)): a smart handler sees the swipe coming
  stealMax: 0.42,
  stealCd: 1.7,                      // cooldown
  stealMiss: 0.34,                   // frozen this long after any miss...
  stealReachFreeze: 0.62,            // ...this long after a reach (out of range or from behind)

  // ── Dribble moves (the right stick, or the arrow keys: a flick picks the move; MOVES below) ──────
  // NBA 2K's pro stick, read from the basket and the hand the ball is in (referee.moveOf). Every move is a burst that
  // may freeze his man (referee.judgeMove); moves chain, a short recovery apart, and his man can be frozen once a while.
  handSwitch: 3.2,                   // going this fast (ft/s) to one side, the ball goes to the hand on that side
  moveAt: 0.5,                       // the stick pushed this far is a flick (the screen and the CPU send it once)
  // which move (the owner, 11-26: "spin moves trigger too often"; the right move has to come out): the angle between
  // the flick and the way to the basket, in degrees. At the basket (within hesiTo) the hesitation, straight back (past
  // backFrom) the step-back, anything sideways a move to that side: toward the ball hand the in-and-out; toward the
  // other hand by how he's going: standing (or going across) the crossover, going forward at an easy pace between the
  // legs, at speed behind the back. A spin is never a flick: it's the stick rolled round (gesture.js 'roll', the
  // input's sp) or SHIFT
  hesiTo: 35, backFrom: 145,
  btlSpeed: 0.2, btlFwd: 0.35,       // between the legs: going this share of his top speed or more, and this much of it forward
  btbSpeed: 0.62,                    // behind the back: going this share of his top speed or more
  spinTurn: 60, spinMax: 150,        // (the two-stick pad: a second flick this far round from the first, early in a move, is the roll)
  spinWithin: 0.5,                   // ...inside this share of the first move
  moveBuffer: 0.5,                   // a flick made while a move is still on goes the moment it can (the chain), this long at most
  chainRec: 0.12, chainRecHnd: 0.06, // after a move, this long (less at Handles 11) before the next one starts
  chainSlow: 0.7, chainGap: 0.4,     // a move started this soon after the last one ended goes at this share of its speed
  moveSpeed: 1.95,                   // the fastest any move goes, x top speed (what a device's own position is held to)
  moveCd: 2.8, moveCdHnd: 1.0,       // a move can freeze his man once in this long: 2.8 s at Handles 1, 1.8 s at 11
  moveRange: 6.1,                    // his man has to be this close to be beaten by it
  moveBase: 0.29,                    // chance to freeze him...
  moveLean: 0.40,                    // ...plus this if he's leaning all the way the wrong way
  moveHnd: 0.60,                     // ...plus this * (Handles n - his Perimeter D n)
  moveIq: 0.36,                      // ...minus this * (his IQ n - 0.5): a smart defender reads the move
  moveFreeze: 0.5,                   // frozen this long
  // the legs for it (the owner, 11-25: "slight stamina when dribbling ... so you can't spam them"): 1 full. The owner,
  // 11-26: "drains too quick and should recover each possession": a third and more off every cost (3-4 moves strung
  // together before he's low), and every new possession everyone starts full (sim.js endPossession, stop)
  staMove: 0.125, staChain: 0.075,      // a move costs this, one chained straight off the last this much more...
  staSpin: 0.065,                     // ...a spin rolled out of a move this
  staBack: 0.13,                     // back this much a second once he's off his moves (empty to full in about 8 s; owner 11-26: it came back too fast)
  staFloor: 0.55,                    // at empty a move has this share of its burst and of its chance to freeze his man
  staLoose: 0.8,                     // ...and a swipe at the ball in it has up to this much more chance
  ankleBase: 0.02,                   // of the frozen ones, this share (x Handles and the lean) sit down: the ankle-breaker
  ankleDown: 1.25,                   // on the floor this long

  // ── Post game (the owner, 11-26): a big with his man on him near the basket, slowed to a dribble or backing into
  // him, is in the post: his back to him, the stick toward the rim backs him down (bump by bump, Size against Size),
  // a flick to a side is the drop step (baseline) or the spin (middle), a flick away from the rim faces him up, and
  // SHOOT is the hook (turned side-on) or, with the stick away from the rim, the fadeaway ──────────────────────────
  postRange: 14,                     // inside this many feet of the rim...
  postDef: 5.2,                      // ...his man within this of him, between him and the rim...
  postFront: 0.3,                    // ...(this much in front: the cos to the line to the rim)
  postSlow: 5.8,                     // ...going slower than this (ft/s), for postEnter (backing in: postEnterBack)
  postEnter: 0.16, postEnterBack: 0.05,   // (quicker into it: the owner, 11-26)
  postGuard: 0.72,                   // a guard posts only this big (plain Size) and only backing in
  postCd: 0.7,                       // after leaving the post, this long before he can be in it again
  postLose: 0.4,                     // his man gone off him (past postDef + 1.5) this long: he's out of it
  postBump: 0.44,                    // a bump step: one this often while he backs down...
  postPush: 0.45,                    // ...the first share of it the shove, the rest settling
  postGain: 1.25,                    // ft a bump takes off his man, even Size...
  postSize: 1.15,                    // ...x (1 + this x (his Size - his man's), the plain grades)...
  postStr: 0.25,                     // ...x (1 + this x (his Finishing - 0.75))...
  postInt: 0.55,                     // ...x (1 - this x (his man's Interior D - 0.5), the plain grade)
  postGainMin: 0.12, postGainMax: 2.0,
  postFree: 3.4,                     // backing into nobody: this fast (ft/s)
  postSide: 2.4,                     // sliding along the block (the stick across): this fast
  postSta: 0.03,                     // his legs: a bump costs this
  postAway: 0.45,                    // the stick held away from the rim this long: he faces up and leaves the post
  postLay: 4.6,                      // SHOOT in the post this close: the layup or the dunk (the power move), not the hook
  dropBase: 0.34, dropSize: 0.55, dropIq: 0.3, dropInt: 0.5, dropSpd: 0.3,   // the drop step or the spin gets by him: base + Size
                                     // edge + IQ - his man's Interior D + the first step (the plain grades), 0.08-0.8
  dropFreeze: 0.5,                   // got by: his man sealed off this long
  dropCut: 0.55,                     // read: the burst goes this share (his man cuts it off)
  // the hook and the fadeaway: on the jumper's meter (the green window is the shot, as every shot)
  hookBase: 0.16, hookFin: 0.34, hookSize: 0.14, hookIq: 0.1,   // a hook from 6-8 ft: about 60% for a skilled big open, 35% for a stiff
  hookFar: 0.035,                    // ...less this a foot past 6 ft
  contestMaxH: 0.62,                 // a perfect contest takes this share off a hook (it's shot away from his body)...
  hookThrough: 0.35,                 // ...less this share of it at Size 11 (over the top)
  contestSizeH: 0.6,                 // a hand on a hook: x (1 + this x (his Size - the shooter's), the plain grades): a big hooks over a guard
  blockHook: 0.45,                   // a hook is this much as easy to block as a layup
  fadeK: 0.8,                        // the fadeaway: the jumper from there, x this (off balance)...
  fadeSize: 0.12,                    // ...plus this at Size 11 (a big's fade is over everyone)...
  fadeSpace: 0.6,                    // ...and the contest on it counts this share (he's fading away from the hand)

  // ── Pump fakes (the owner, 11-26): a tap of SHOOT, let go before fakeMs, is a pump fake. He shows it and brings it
  // back down; his man may go up for it. A man who does is out of the play for a beat (biting: he's coming down), and
  // the next shot gets a much bigger green window. A man who had dribbled and pumps has picked up his dribble: no more
  // dribbling, only a shot, a pass or a pivot (fakeFresh: one who hadn't, off a catch or the check, still has it)
  fakeMs: 130,                       // real ms: SHOOT let go sooner than this is a fake, not a shot
  fakeTime: 0.34,                    // the fake: up and back down (the game's seconds)
  biteAfter: 0.16,                   // a man who goes up this soon after the fake came down still bit (real s)
  bitLand: 0.42,                     // a man who bit comes down this long (the game's seconds), out of the play
  fakeOpen: 1.9,                     // the next shot's green window x this...
  fakeOpenS: 1.0,                    // ...if it starts this soon after he bit (real s)
  uauRange: 9.5,                     // the up-and-under: a man who bit, a step through toward the rim from inside this: a layup
  pivotR: 1.7,                       // picked up: his pivot foot down, the other foot reaches this far (ft)...
  pivotSpeed: 5.5,                   // ...this fast
  // a CPU's bite: (the fake's sell) x (bite0 - biteIq x (his IQ - 0.5)) x his level's bite
  sell0: 0.05, sellShot: 0.75, sellIq: 0.2, sellAgain: 0.55,   // the sell: a threat to shoot from there sells it; a second fake
                                     // in the same hold sells this share of the one before
  bite0: 0.62, biteIq: 0.55,

  // ── Passing ──────────────────────────────────────────────────────────────────────────────────────
  passSpeed: 26, passSpeedPas: 13,   // ft/s: 26 at Passing 1, 39 at 11
  catchReach: 2.4,                   // caught this close to the target (generous: lag)
  pickReach: 2.9,                    // a defender this close to the ball in flight can pick it...
  pickBase: 0.22,                    // ...this often at average everything
  pickPer: 0.8,                      // x (0.55 + this * Perimeter D)
  pickPas: 0.8,                      // x (1.35 - this * the passer's Passing)
  pickIq: 0.36,                       // x (1.15 - this * the passer's IQ): a smart passer doesn't throw it to the defense
  pickMax: 0.7,
  passCd: 0.35,                      // can't shoot or pass again this soon after a catch (the catch itself)

  // ── Rebounds and loose balls ────────────────────────────────────────────────────────────────────
  rebMin: 2.5, rebMax: 9.5,          // a miss comes off this far from the rim...
  rebMinL: 4.0,                      // ...off a layup, anywhere from this far out (it comes off the glass with something on it)...
  rebSpreadL: 5.6,                   // ...off a layup, in any direction but straight back at him (radians, the whole fan)
  rebLong: 0.08,                     // ...plus this for every foot of shot (long shots, long boards)
  rebAir: 1.15,                      // seconds from the rim to the floor
  standReach: 7.9, standReachSize: 0.9,  // the ball can be taken when it's under this (feet on the floor)
  jumpReach: 1.0, jumpReachBnc: 1.2,     // ...and this much higher in a jump
  grabDist: 2.5,                     // and within this of him (generous: lag)
  grabReb: 2.0,                      // ...plus this at Rebounding 11 (he's where the ball is going)
  boardReb: 4.0, boardSize: 1.2, boardBnc: 1.0,   // two under it: weights 1 + 3 x (Rebounding - 0.75) + 1.2 x (Size - 0.75) + 1 x (Bounce - 0.75), the nearer one a bit more
  looseFriction: 0.9,                // a ball on the floor slows by this a tick
  // a block: off the blocker's hand, away from him and down, between these speeds (ft/s); this share he keeps
  // himself (tipped up to his own side or caught), and none of it rolls far (a dead swat)
  swatMin: 5, swatMax: 14, swatSpread: 1.45, swatTip: 0.36,
  swatGrab: 6,                       // nobody can take a swat for this many ticks (it's off the hand), a tip 4; the shooter
                                     // can't take his own blocked shot until he's down (T.follow)
  swatBig: 0.15,                     // ...and of the rest this share are sent flying (swatMax to 8 ft/s more, flat)
  // ── Between plays ───────────────────────────────────────────────────────────────────────────────
  bench: { x: 54.7, y: 31.5 },       // King of the Hill: where the man sitting out waits (off the right sideline, up top)
  feedSpeed: 24,                     // a dead ball (through the net, out of bounds) goes back to whoever checks it this fast
  spotNear: 0.6,                     // the ball goes live when everyone is this close to his spot...
  checkWait: 0.6,                    // ...or this long past the check, wherever they are
  checkPass: 0.32,                   // King of the Hill: the check, a bounce pass from the man guarding the king (s)...
  checkBeat: 0.16,                   // ...and a beat with it in the king's hands before it's live

  // ── Online (a player on his own device: lib/btlive/net.js, live/src/btlive.js) ───────────────────
  remoteWaitMs: 650,                 // a shot waits this long past the end of the meter for his device's release
  remoteSlack: 1.6,                  // a position from a device may be this much farther than his top speed allows...
  remoteStep: 0.35,                  // ...plus this many feet a tick (jitter: two updates landing at once)

  // ── Rare moments (what the screen makes something of) ───────────────────────────────────────────
  posterContest: 0.97,               // a dunk made through this much contest is a poster
  deepWord: 29.5,                    // a made three from here is a deep three
  chaseAngle: 0.2,                   // a block from behind the shooter (his back to the blocker) is a chase-down
}

// The dribble moves (NBA 2K's pro stick; "toward" a hand is that side of him as he faces the basket). time: the burst
// (s). speed: x top speed with the ball at the burst's peak (it builds, holds, and eases off: about 0.9 of it on
// average; a move chained straight off another goes at T.chainSlow of it), so each goes about the floor the real move covers. swap: the ball changes hands.
//   hesi   flick at the basket: the hesitation. A beat almost standing (stall), then gone at the rim
//   cross  forward and toward the off hand: the crossover, in front of him, to the other side
//   btl    straight toward the off hand: between the legs, across, a shorter step
//   btb    back and toward the off hand: behind the back, the ball out of reach (a swipe at it lands `steal` as often)
//   inout  forward or across toward the ball hand: the in-and-out, a fake at the cross (stall, the other way), then
//          gone with it in the same hand
//   back   straight back (or back toward the ball hand: the side step-back): a hop away, landing with his feet set
//          (he keeps `set` of the speed): the jumper after it isn't a jumper on the run
//   boost: out of it he's a beat quicker for T.boostTime (he's by his man, going)
//   spin   the stick rolled a quarter turn round early in a move: the burst bends round to the new way over `time`
// n: the number a move goes by in the state and on the wire (player.mv; 0: none)
export const MOVES = {
  cross: { n: 1, time: 0.30, speed: 1.75, swap: true, boost: true },
  hesi: { n: 2, time: 0.38, speed: 1.9, stall: 0.12, stallSpeed: 0.2, boost: true },
  back: { n: 3, time: 0.28, speed: 1.45, set: 0.2 },
  btb: { n: 4, time: 0.32, speed: 1.65, swap: true, steal: 0.6 },
  spin: { n: 5, time: 0.36, speed: 1.65 },
  inout: { n: 6, time: 0.34, speed: 1.75, stall: 0.11, stallSpeed: 0.4, fake: true, boost: true },
  btl: { n: 7, time: 0.26, speed: 1.65, swap: true, boost: true },
  // the post: the drop step (a flick to the baseline side) round his man to the rim; the spin to the middle is the
  // spin above, out of the post
  drop: { n: 8, time: 0.32, speed: 1.6, boost: true },
}
export const MOVE_KEYS = [null, 'cross', 'hesi', 'back', 'btb', 'spin', 'inout', 'btl', 'drop']
