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
  goal: 11, winBy: 2, cap: 15,       // first to 11 by ones and twos, win by 2, capped at 15 (today's Blacktop; King of the Hill too)
  shotClock: [12, 14],               // seconds, by players a side (1v1 and King of the Hill, 2v2)
  orebClock: 8,                      // the clock after an offensive rebound
  checkTime: 0.8,                    // the ball is checked: nobody moves for this long
  deadTime: 1.1,                     // after a basket or a turnover, before the next check
  makeItTakeIt: true,                // score and keep the ball (today's Blacktop)
  // Fouls: none. A reach is its own punishment (the defender is frozen), bodies just collide.
}

export const T = {
  // ── How far apart a 1 and an 11 are ─────────────────────────────────────────────────────────────
  // Every "at a 1" below is really at "1 - spread" of the way down from an 11: the top of each rating is where
  // the brief puts it (a great shooter, a great finisher) and this one number sets how much worse a low grade is,
  // so how often a 95 beats an 80. 1 = the full range below; lower = builds closer together.
  spread: 0.24,

  // ── Movement (slow on purpose: a late update from a laggy phone is a small error) ──────────────
  speedMin: 9.5,                     // top speed at Speed 1, ft/s (on the plain grade: spread doesn't squeeze it; an 80 about 9.7)
  speedBand: 0.06,                   // the fastest (Speed 11) is this much quicker than the slowest (Speed 1)
  sizeSlow: 0.03,                    // Size 11 is this much slower than Size 1
  ballSpeed: 0.94,                   // with the ball at Handles 1 (x top speed)...
  ballSpeedHnd: 0.04,                // ...plus this at Handles 11 (an 80 keeps 97%: Speed 11 with it outruns a Speed 1 guarding)
  defSpeed: 0.99,                    // guarding, at Perimeter D 1 (x top speed)...
  defSpeedPer: 0.07,                 // ...plus this at Perimeter D 11 (an 80 about 100%: an even man stays in front)
  accel: 34,                         // ft/s² (about a third of a second to top speed)...
  accelBase: 0.97, accelSpd: 0.06,   // ...x (0.97 + 0.06 x Speed): a quick first step
  accelSize: 0.06,                   // ...less this at Size 11
  defAccel: 0.82, defAccelPer: 0.24, // a defender's: x (0.82 + this * Perimeter D)
  walk: 0.25,                        // stick pushed less than this far: ignored (dead zone)
  radius: 1.55,                      // a body's radius (the dot on the screen is this big): nobody walks through anybody
  ground: 3.0,                       // anyone standing still (not the man guarding the ball) is this much harder to move
  groundDef: 1.7,                    // the man guarding the ball, set (slower than this many ft/s), holds this much ground...
  groundDefSpeed: 4.0,
  massSize: 0.8,                     // ...and the rest is weight: 1 at Size 1, 1 + this at Size 11 (a big backs a guard down)
  gatherSlowJ: 0.25,                 // speed kept while rising for a jumper
  gatherSlowL: 0.75,                 // ...and while going up for a layup
  follow: 0.45,                      // after the release he's this long coming down before he can move freely
  footIn: 0.75,                      // the man with the ball is out when his centre is this close to a line (his foot on it:
                                     // the dot reaches radius past the centre, a foot about half that)
  lineKeep: 0.9,                     // everyone else stays this far inside (eased back, never past the line itself)
  shootBuffer: 0.5,                  // a SHOOT press this recent starts the shot the moment he can (a catch, a board)

  // ── The shot meter (judged on the shooter's own device: only the quality 0-1 is sent) ──────────
  jTotalMs: 900,                     // a jumper's meter runs this long; held past it, the shot goes up late
  jIdealMs: 500,                     // the middle of the green window
  jWinMs: 12, jWinJs: 58,            // green half-width: 12 + 58 x (Jump Shot n)²: 70 ms at 11, about 30 at a 1 (the square: a great shooter's green is much bigger)
  jFallMs: 170,                      // past the green, quality runs down to 0 over this long
  lTotalMs: 620, lIdealMs: 300,      // layups and dunks: a quicker meter
  lWinMs: 30, lWinFin: 54,           // green half-width from Finishing: 30 + 54 x n²: 84 ms at 11
  lFallMs: 190,
  dunkWin: 1.35,                     // a dunk's window is this much wider
  clutchLo: 0.5, clutchHi: 1.2,      // at game point the green window is this x at Clutch 1 ... this x at Clutch 11
  clutchMake: 0.45,                  // late in a game the shot's chance is x (1 + this * (Clutch - half)): +22% at 11, -22% at 1...
  clutchFrom: 3,                     // ...late: game point, or anyone this close to the goal
  minHoldMs: 120,                    // let go sooner than this and it still counts as held this long (a tap is a bad release)
  relMinJ: 0.42,                     // a jumper let go at the worst time keeps this much of its chance (a bad one can still drop)
  relMinL: 0.62,                     // ...a layup this much
  slightJ: 0.86,                     // just outside the green: the chance starts from here and falls to relMin

  // ── Make chance: rating at that spot x release x contest. Open, perfect release: ─────────────────
  layBase: 0.58, layFin: 0.38,       // layup: 81% at Finishing 1, 98% at 11 (an 80: 89%): the best shot there is
  layRange: 7.0,                     // inside this many feet of the rim SHOOT is a layup (or a dunk)
  layFar: 0.045,                     // a layup loses this much a foot past 3 ft (a runner from 7 ft: 14% less)
  dunkRange: 5.2,                    // a dunk starts inside this
  dunkBounce: 0.55,                  // Bounce (n) under this: never dunks (a Bounce 1 never does)
  dunkChance: 1.8,                   // how often an able dunker dunks: (Bounce n - dunkBounce) x this (x a touch more with Finishing)
  dunkBase: 0.90, dunkFin: 0.08,     // a dunk goes down 94-98% open
  closeBase: -0.58, closeJs: 1.30,   // a jumper from 8 ft: 41% at Jump Shot 1, 72% at 11 (steep: spread is small, a non-shooter still can't shoot)
  arcBase: -0.66, arcJs: 1.20,       // a jumper from the arc (25 ft): 25% at Jump Shot 1, 54% at 11 (an 80: 39%)
  arcRef: 25, curve: 1.3,            // the distance those are measured at, and how the chance bends between 8 ft and there
  deepAt: 27.5,                      // past this it's deep...
  deepFall: 0.06, deepJs: 0.04,      // ...and loses 3.9% a foot at Jump Shot 1, 2% at 11 (range)
  setFeet: 0.14,                     // a jumper taken at a full run loses this much; still: nothing
  csWindow: 1.3,                     // a jumper this soon after a catch is "off the catch"...
  csBoost: 0.15,                     // ...and gains up to this much from the passer's Passing/Playmaking
  csLay: 0.35,                       // a layup or a dunk that soon off the catch: the contest counts this much less at the passer's Passing 11
  rushAt: 3.0,                       // a shot in the last 3 s of the shot clock is rushed...
  rushPen: 0.22,                     // ...and loses this much at IQ 1, nothing at IQ 11

  // ── Contest: how close, where (in front / beside / beaten), how he stands, who he is ───────────────────────────────────────
  contestRange: 7.0,                 // a defender farther than this doesn't bother a jumper...
  contestNear: 2.5,                  // ...and at this distance he's all the way in it (a straight line between)
  contestRangeL: 6.5, contestNearL: 3.3,   // ...at a layup or a dunk (bodies touch at 3.1: a man on him is all the way in it)
  contestCurve: 1.3,                 // in between it bends (1 = a straight line)
  contestStand: 0.6,                 // feet on the floor
  contestJump: 0.82, contestJumpBnc: 0.22,   // a hand up: this + Bounce (an 80 about 1.0)
  contestSet: 0.75,                  // ...set in front of a layup, not moving: walls up, but he can be finished on
  lateShare: 0.6,                    // a man who closes out after the shot went up gets this much less of his contest at most
  lateShareL: 0.25,                  // ...on a layup or a dunk (it goes up slower, and he flies at it)
  gatherHoldL: 0.7,                  // a layup keeps at least this share of the contest he went up into (every hand up), slid by or not
  contestBeat: 0.15,                 // frozen or on the floor
  frontDot: 0.5,                     // square in front: full; beside him (at right angles to the rim)...
  contestSide: 0.55,                 // ...this much; trailing straight behind him (he beat you)...
  contestBehind: 0.6,                // ...this much (a man on his hip still bothers it)
  contestRate: 0.30, contestRateDef: 0.50, contestRateIq: 0.20,   // x (0.30 + 0.5 * his defense + 0.2 * his IQ): Perimeter D on jumpers, Interior D in the paint and at the rim
  contestSize: 0.30,                 // x (1 + this * (his Size n - the shooter's Size n)): shoot over small men, not over big ones
  contestSecond: 0.45,               // a second man in it adds this share of his own contest (help at the rim, two on the king)
  contestMaxJ: 0.7,                  // a perfect contest takes this share off a jumper
  jsThrough: 0.35,                   // Jump Shot 11 shoots over this share of a jumper's contest
  contestMaxL: 0.85,                 // ...off a layup
  contestMaxD: 0.55,                 // ...off a dunk...
  dunkThrough: 0.35,                 // ...less this share at Bounce 11
  finThrough: 0.40,                  // Finishing 11 shrugs off this share of a layup's contest

  // ── The CPU's judgment ───────────────────────────────────────────────────────────────────────────
  cpuRespect: 12,                    // a CPU defender sees a drive this many ticks later per 1.0 of the man's Jump Shot over 0.55 (sooner under it)
  cpuRace: 0.35,                     // how often a CPU on a driver's hip races him to the spot instead of running into him (x his contest)
  cpuNeed: 0.5,                      // early in the clock a CPU wants a shot worth this (later, less)...
  cpuHurry: 0.05,                    // ...and this much less every second he has had it (a streetball possession doesn't wait around)
  twoValue: 1.45,                    // a two is worth this many ones to a CPU (make it, take it: either make keeps the ball)
  cpuDriveV: 0.55,                   // a jumper never has to be worth more than this (a make = 1, a two 1.45) while there's time to go to the rim...
  cpuBeat: 0.4, cpuBeatR: 0.8,       // ...how often he gets by his man: this, + this x (his Speed and Handles - the man's Speed and Perimeter D) / 2
  cpuDriveRisk: 0.85,                // ...and otherwise only more than the drive: a layup on his man walled up at the rim, x this (a strip, a block)
  cpuJumpEdge: 0.03,                 // ...by this much
  cpuSitV: 0.33,                     // an open look over a man sitting back at the rim: worth taking from this

  // ── Blocks (JUMP, timed against the release) ────────────────────────────────────────────────────
  jumpTime: 0.50,                    // off the floor this long...
  jumpLand: 0.22,                    // ...then this long to land before he can move again
  blockReach: 3.6,                   // within this of the shooter at the release (plus Bounce and Size)...
  blockReachBnc: 0.9, blockReachSize: 0.7,
  blockIn: 0.10, blockOut: 0.80,     // ...and between these fractions of his jump: on time. Else a quarter the chance
  blockBase: 0.17,                   // on-time chance at average everything
  blockInt: 0.9,                     // x (0.55 + this * Interior D)
  blockSize: 0.45,                   // x (1 + this * (his Size n - the shooter's))
  blockBnc: 0.9,                     // x (1 + this * (his Bounce n - 0.75))
  blockJumper: 0.40, blockDunk: 0.50, // jumpers and dunks are harder to get than layups
  blockMax: 0.62,

  // ── Steals (a swipe with a cooldown; a miss costs a beat) ───────────────────────────────────────
  stealReach: 3.9,                   // the ball has to be this close
  stealBase: 0.16,                   // chance at average everything, square in front
  stealPer: 0.7,                     // x (0.55 + this * Perimeter D)
  stealHnd: 0.6,                     // x (1.3 - this * the handler's Handles)
  stealBurst: 0.45,                  // against a handler in the middle of a MOVE
  stealGather: 1.25,                 // against a handler going up
  stealBehind: 0.35,                 // from behind him
  stealIq: 0.5,                      // x (1 + this * (0.75 - the handler's IQ)): a smart handler sees the swipe coming
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
  moveIq: 0.30,                      // ...minus this * (his IQ n - 0.5): a smart defender reads the move
  moveFreeze: 0.45,                  // frozen this long
  ankleBase: 0.02,                   // of the frozen ones, this share (x Handles and the lean) sit down: the ankle-breaker
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
  feedSpeed: 24,                     // a dead ball (through the net, out of bounds) goes back to whoever checks it this fast
  spotNear: 0.6,                     // the ball goes live when everyone is this close to his spot...
  checkWait: 0.6,                    // ...or this long past the check, wherever they are

  // ── Online (a player on his own device: lib/btlive/net.js, live/src/btlive.js) ───────────────────
  remoteWaitMs: 650,                 // a shot waits this long past the end of the meter for his device's release
  remoteSlack: 1.6,                  // a position from a device may be this much farther than his top speed allows...
  remoteStep: 0.35,                  // ...plus this many feet a tick (jitter: two updates landing at once)

  // ── Rare moments (what the screen makes something of) ───────────────────────────────────────────
  posterContest: 0.62,               // a dunk made through this much contest is a poster
  deepWord: 29.5,                    // a made three from here is a deep three
  chaseAngle: 0.2,                   // a block from behind the shooter (his back to the blocker) is a chase-down
}
