// BLACKTOP LIVE: every number the game is balanced on, in one table (scripts/btlive/balance.mjs checks them
// against the brief's targets: F:/bap-agents/btlive/DESIGN.md). Pure data: no DOM, no React, runs in Node.
// Ratings arrive as 0-11 grades and are used as n = 0..1 (ratings.js: an 11 is 1), so "x + y * n" reads "x + y at an 11"
// and less below it; how much less is `spread`, the first line of the table.
// Distances are feet, times are seconds unless a name says Ms or Ticks.

export const HZ = 30                 // simulation ticks a second (the screen draws at 60 and interpolates)
export const DT = 1 / HZ

// The half court, in feet, laid over the court picture (public/court-*.webp, 4:3, 56 x 42 ft edge to edge;
// the same lines on every court in the shop). x runs left to right, y from the baseline wall down to half court.
export const COURT = {
  W: 56, H: 42,                      // the whole picture
  minX: 3.0, maxX: 53.2,             // sidelines
  minY: 2.3, maxY: 39.7,             // baseline, half-court line
  rim: { x: 28, y: 4.5 },
  arcSideX: 20.8,                    // the three-point line runs straight up the sides this far from the rim's x...
  arcSideY: 15.5,                    // ...down to this y, then curves
  arcC: { x: 28, y: 8.6 }, arcR: 21.9,   // the curve: a circle through the two side lines' ends and the top (28, 30.5)
  paint: { x0: 21.2, x1: 34.6, y1: 18.7 },
  check: { x: 28, y: 34 },           // where the ball is checked
}

export const RULES = {
  goal: 11, winBy: 2, cap: 15,       // first to 11 by ones and twos, win by 2, capped at 15 (today's Blacktop)
  shotClock: [12, 14, 14],           // seconds, by players a side (1v1, 2v2, 3v3)
  orebClock: 8,                      // the clock after an offensive rebound
  checkTime: 1.0,                    // the ball is checked: nobody moves for this long
  deadTime: 1.5,                     // after a basket or a turnover, before the next check
  makeItTakeIt: true,                // score and keep the ball (today's Blacktop)
  // Fouls: none. A reach is its own punishment (the defender is frozen), bodies just collide.
}

export const T = {
  // ── How far apart a 1 and an 11 are ─────────────────────────────────────────────────────────────
  // Every "at a 1" below is really at "1 - spread" of the way down from an 11: the top of each rating is where
  // the brief puts it (a great shooter, a great finisher) and this one number sets how much worse a low grade is,
  // so how often a 95 beats an 80. 1 = the full range below; lower = builds closer together.
  spread: 0.6,

  // ── Movement (slow on purpose: a late update from a laggy phone is a small error) ──────────────
  speedMin: 9.6,                     // top speed at Speed 1, ft/s
  speedBand: 0.20,                   // the fastest (Speed 11) is this much quicker than the slowest
  speedBall: 0.5,                    // ...with the ball, half of that (a dribble evens people out)
  sizeSlow: 0.04,                    // Size 11 gives this much of it back
  ballSpeed: 0.80,                   // with the ball at Handles 1 (x top speed)...
  ballSpeedHnd: 0.07,                // ...plus this at Handles 11
  defSpeed: 0.955,                   // guarding, at Perimeter D 1 (x top speed)...
  defSpeedPer: 0.07,                 // ...plus this at Perimeter D 11
  accel: 34,                         // ft/s² (about a third of a second to top speed)
  defAccelPer: 0.20,                 // a defender's acceleration: x (0.85 + this * Perimeter D)
  walk: 0.25,                        // stick pushed less than this far: ignored (dead zone)
  radius: 1.55,                      // a body's radius (the dot on the screen is this big): nobody walks through anybody
  ground: 3.0,                       // a set defender in the handler's path (or anyone standing still) is this much harder to move
  massSize: 0.8,                     // weight: 1 at Size 1, 1 + this at Size 11 (a big backs a guard down, not the other way)
  gatherSlowJ: 0.25,                 // speed kept while rising for a jumper
  gatherSlowL: 0.75,                 // ...and while going up for a layup
  follow: 0.45,                      // after the release he's this long coming down before he can move freely

  // ── The shot meter (judged on the shooter's own device: only the quality 0-1 is sent) ──────────
  jTotalMs: 900,                     // a jumper's meter runs this long; held past it, the shot goes up late
  jIdealMs: 500,                     // the middle of the green window
  jWinMs: 20, jWinJs: 46,            // green half-width: 20 ms at Jump Shot 1, 66 ms at 11
  jFallMs: 170,                      // past the green, quality runs down to 0 over this long
  lTotalMs: 620, lIdealMs: 300,      // layups and dunks: a quicker meter
  lWinMs: 38, lWinFin: 46,           // green half-width from Finishing: 38 to 84 ms
  lFallMs: 190,
  dunkWin: 1.35,                     // a dunk's window is this much wider
  clutchShrink: 0.32,                // at game point the window shrinks by this much at Clutch 1, not at all at Clutch 11
  minHoldMs: 120,                    // let go sooner than this and it still counts as held this long (a tap is a bad release)
  relMinJ: 0.42,                     // a jumper let go at the worst time keeps this much of its chance (a bad one can still drop)
  relMinL: 0.62,                     // ...a layup this much
  slightJ: 0.86,                     // just outside the green: the chance starts from here and falls to relMin

  // ── Make chance: rating at that spot x release x contest. Open, perfect release: ─────────────────
  layBase: 0.66, layFin: 0.24,       // layup: 66% at Finishing 1, 90% at 11
  layRange: 7.0,                     // inside this many feet of the rim SHOOT is a layup (or a dunk)
  layFar: 0.022,                     // a layup loses this much a foot past 3 ft
  dunkRange: 5.2,                    // a dunk starts inside this
  dunkBounce: 0.45,                  // Bounce (n) under this: never dunks
  dunkChance: 1.5,                   // how often an able dunker dunks: (Bounce n - dunkBounce) x this (x a touch more with Finishing)
  dunkBase: 0.93, dunkFin: 0.05,     // a dunk goes down 93-98% open
  closeBase: 0.45, closeJs: 0.21,    // a jumper from 8 ft: 45% at Jump Shot 1, 66% at 11
  arcBase: 0.185, arcJs: 0.385,      // a jumper from the arc (25 ft): 18.5% at Jump Shot 1, 57% at 11
  arcRef: 25, curve: 1.6,            // the distance those are measured at, and how the chance bends between 8 ft and there
  deepAt: 26.8,                      // past this it's deep...
  deepFall: 0.075, deepJs: 0.04,     // ...and loses 7.5% a foot at Jump Shot 1, 3.5% at 11 (range)
  setFeet: 0.14,                     // a jumper taken at a full run loses this much; still: nothing
  csWindow: 1.3,                     // a jumper this soon after a catch is "off the catch"...
  csBoost: 0.07,                     // ...and gains up to this much from the passer's Passing/Playmaking
  rushAt: 3.0,                       // a shot in the last 3 s of the shot clock is rushed...
  rushPen: 0.22,                     // ...and loses this much at IQ 1, nothing at IQ 11

  // ── Contest: the nearest hand takes a share of the chance ───────────────────────────────────────
  contestRange: 6.6,                 // a defender farther than this doesn't bother the shot
  contestNear: 2.1,                  // ...and at this distance he's all the way in it
  contestCurve: 1.5,                 // in between it bends: a step of space is worth a lot (1 = a straight line)
  contestStand: 0.62,                // feet on the floor (JUMP is a hand up: 1.0)
  contestBeat: 0.22,                 // frozen or on the floor
  contestSide: 0.6,                  // from the side or behind (not between the shooter and the rim)
  contestRate: 0.55, contestRateDef: 0.45,   // x (0.55 + 0.45 * his defense: Perimeter D on jumpers, Interior D in the paint and on layups)
  contestSize: 0.45,                 // x (1 + this * (his Size n - the shooter's Size n)): shoot over small men, not over big ones
  contestMaxJ: 0.52,                 // a perfect contest takes this share off a jumper
  contestMaxL: 0.50,                 // ...off a layup
  contestMaxD: 0.24,                 // ...off a dunk
  finThrough: 0.35,                  // Finishing 11 shrugs off this share of a layup's contest

  // ── Blocks (JUMP, timed against the release) ────────────────────────────────────────────────────
  jumpTime: 0.50,                    // off the floor this long...
  jumpLand: 0.22,                    // ...then this long to land before he can move again
  blockReach: 3.6,                   // within this of the shooter at the release (plus Bounce and Size)...
  blockReachBnc: 0.9, blockReachSize: 0.7,
  blockIn: 0.10, blockOut: 0.80,     // ...and between these fractions of his jump: on time. Else a quarter the chance
  blockBase: 0.17,                   // on-time chance at average everything
  blockInt: 0.9,                     // x (0.55 + this * Interior D)
  blockSize: 0.6,                    // x (1 + this * (his Size n - the shooter's))
  blockBnc: 0.35,                    // x (1 + this * (his Bounce n - 0.5))
  blockJumper: 0.40, blockDunk: 0.50, // jumpers and dunks are harder to get than layups
  blockMax: 0.62,

  // ── Steals (a swipe with a cooldown; a miss costs a beat) ───────────────────────────────────────
  stealReach: 3.9,                   // the ball has to be this close
  stealBase: 0.17,                   // chance at average everything, square in front
  stealPer: 0.7,                     // x (0.55 + this * Perimeter D)
  stealHnd: 0.6,                     // x (1.3 - this * the handler's Handles)
  stealBurst: 0.45,                  // against a handler in the middle of a MOVE
  stealGather: 1.25,                 // against a handler going up
  stealBehind: 0.35,                 // from behind him
  stealIq: 0.24,                     // x (1.12 - this * the handler's IQ): a smart handler sees the swipe coming
  stealMax: 0.42,
  stealCd: 1.7,                      // cooldown
  stealMiss: 0.34,                   // frozen this long after any miss...
  stealReachFreeze: 0.62,            // ...this long after a reach (out of range or from behind)

  // ── MOVE (a dribble move: a burst, and maybe a frozen defender) ─────────────────────────────────
  moveTime: 0.30,                    // the burst lasts this long...
  moveSpeed: 1.6,                    // ...at this much of top speed
  moveCd: 3.4, moveCdHnd: 1.0,       // cooldown: 3.4 s at Handles 1, 2.4 s at 11
  moveRange: 6.1,                    // his man has to be this close to be beaten by it
  moveBase: 0.20,                    // chance to freeze him...
  moveLean: 0.40,                    // ...plus this if he's leaning all the way the wrong way
  moveHnd: 0.25,                     // ...plus this * (Handles n - his Perimeter D n)
  moveIq: 0.16,                      // ...minus this * (his IQ n - 0.5): a smart defender reads the move
  moveFreeze: 0.45,                  // frozen this long
  ankleBase: 0.07,                   // of the frozen ones, this share (x Handles and the lean) sit down: the ankle-breaker
  ankleDown: 1.25,                   // on the floor this long

  // ── Passing ──────────────────────────────────────────────────────────────────────────────────────
  passSpeed: 26, passSpeedPas: 13,   // ft/s: 26 at Passing 1, 39 at 11
  catchReach: 2.4,                   // caught this close to the target (generous: lag)
  pickReach: 2.9,                    // a defender this close to the ball in flight can pick it...
  pickBase: 0.22,                    // ...this often at average everything
  pickPer: 0.8,                      // x (0.55 + this * Perimeter D)
  pickPas: 0.8,                      // x (1.35 - this * the passer's Passing)
  pickIq: 0.3,                       // x (1.15 - this * the passer's IQ): a smart passer doesn't throw it to the defense
  pickMax: 0.7,
  passCd: 0.35,                      // can't shoot or pass again this soon after a catch (the catch itself)

  // ── Rebounds and loose balls ────────────────────────────────────────────────────────────────────
  rebMin: 2.5, rebMax: 9.5,          // a miss comes off this far from the rim...
  rebLong: 0.08,                     // ...plus this for every foot of shot (long shots, long boards)
  rebAir: 1.15,                      // seconds from the rim to the floor
  standReach: 7.6, standReachSize: 1.3,  // the ball can be taken when it's under this (feet on the floor)
  jumpReach: 2.0, jumpReachBnc: 2.2,     // ...and this much higher in a jump
  grabDist: 2.7,                     // and within this of him (generous: lag)
  grabReb: 0.9,                      // ...plus this at Rebounding 11 (he's where the ball is going)
  boardReb: 1.6, boardSize: 0.7, boardBnc: 0.7,   // two under it: weights 1 + Rebounding*1.6 + Size*0.7 + Bounce*0.7, the nearer one a bit more
  looseFriction: 0.9,                // a ball on the floor slows by this a tick
  swatSpeed: 20,                     // a blocked shot leaves at this speed

  // ── Rare moments (what the screen makes something of) ───────────────────────────────────────────
  posterContest: 0.5,                // a dunk made through this much contest is a poster
  deepWord: 29.5,                    // a made three from here is a deep three
  chaseAngle: 0.2,                   // a block from behind the shooter (his back to the blocker) is a chase-down
}
