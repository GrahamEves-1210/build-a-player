// Quick skill games (a few seconds each): what the combine, the playoffs and
// camp drills are played with. Pure data here; the games themselves are in
// components/app/MiniGame.jsx. Every game is keyed to the traits it tests, and
// the trait value (1–11) sets how forgiving it is: a stronger arm gets a bigger
// window, a sharper mind gets more time. A game reports { score 0–1, hit }.
//
//   kind       how it's played
//   timing     a marker sweeps a bar; tap it inside the zone
//   taps       timing, n times in a row (a gauntlet)
//   power      hold to build, release near the top
//   reaction   three targets; one opens green; tap it before the window closes.
//              A red decoy (covered) flashes or opens beside it: never tap red
//   audible    a defensive look; pick the right counter before the clock runs out
//   lanes      a rush comes from one side; move the other way (3 times).
//              cue: what the pressure is called (basketball: DEFENDER)
//   sequence   3–4 calls in a row, each on its own clock
//   route      pick a route (easy to hard), then hit its window
//   choice     two ways to play it, each its own game
//   penalty, oneone, header, volley, targets   soccer's own (lib/mg/penalty.js etc.; the Simple ones in MiniGameSimple.jsx)

import { seeded } from './rng.js'

export const GAMES = {
  // ── QB ──
  'hot-read':    { kind: 'reaction', traits: ['processing', 'vision'], title: 'HOT READ', how: 'Four snaps, three receivers. One comes open in green: tap him before the window shuts. Red is covered: never throw it there.', rounds: 4 },
  'bomb':        { kind: 'power', traits: ['arm'], title: 'BOMB IT', how: 'Hold to load the deep shot. Let go near the top: a stronger arm gets a bigger window.' },
  'escape':      { kind: 'lanes', traits: ['legs'], title: 'ESCAPE', how: 'The pocket collapses from one side. Escape the other way, three times.' },
  'sneak':       { kind: 'timing', traits: ['size'], title: 'SNEAK', how: 'Fourth and inches. Hit the snap window and punch it in.' },
  'two-minute':  { kind: 'sequence', traits: ['leadership', 'processing'], title: 'TWO-MINUTE DRILL', how: 'Four play calls, each against the play clock. More Composure, more time to call it.' },
  'goal-line':   { kind: 'route', anyPos: true, traits: ['accuracy', 'routeRunning', 'hands'], title: 'FOURTH & GOAL', how: 'Fourth and goal at the five. Tap CUT as the ring closes on the spot, then press the side the ball is thrown to. At quarterback: press where the ball goes.' },
  'third-long':  { kind: 'route', traits: ['accuracy', 'arm'], title: 'THIRD & LONG', how: 'Pick the route, then hit the throw window. The deeper the route, the tighter the window, the bigger the play.' },
  'audible':     { kind: 'audible', traits: ['processing', 'vision'], title: 'AUDIBLE', how: 'Read the look. Pick the counter before the play clock runs out.' },
  // ── RB ──
  'gap':         { kind: 'reaction', traits: ['vision'], title: 'PICK THE GAP', how: 'Four plays. One gap opens green each time: hit it, fast. Red is a linebacker filling it: stay out.', rounds: 4, quick: 0.72 },
  'juke':        { kind: 'lanes', traits: ['elusiveness'], title: 'JUKE', how: 'The tackler commits to a side. Cut the other way, three times.' },
  // ── WR / TE ──
  'catch':       { kind: 'taps', traits: ['hands'], title: 'CONTESTED CATCH', how: 'Three balls. Tap each one in the window. Each one comes in hotter.', n: 3 },
  'juke-wr':     { kind: 'lanes', traits: ['bodyControl', 'afterCatch'], title: 'MAKE A MAN MISS', how: 'The defender commits. Cut the other way, three times.' },
  'release':     { kind: 'timing', traits: ['release'], title: 'BEAT THE PRESS', how: 'The corner jams at the line. Hit the window to get a clean release.' },
  'seal':        { kind: 'timing', traits: ['blocking', 'strength', 'runBlock', 'anchor'], title: 'SEAL THE EDGE', how: 'Press the side he’s pushing to and keep the bar in the green until the back gets past.' },
  'juke-te':     { kind: 'lanes', traits: ['afterCatch'], title: 'RUN AFTER THE CATCH', how: 'A tackler commits. Cut the other way, three times.' },
  // ── DB (for when the position comes to Career) ──
  'jump-route':  { kind: 'reaction', traits: ['playRecognition', 'zoneIQ', 'zoneInstincts'], title: 'JUMP THE ROUTE', how: 'Four snaps, three routes. One breaks green: jump it. Red is a double move: let it go.', rounds: 4 },
  'tackle-angle':{ kind: 'lanes', traits: ['speed', 'runSupport', 'range', 'tackling'], title: 'TACKLE ANGLE', how: 'The back cuts. Take the right angle, three times.' },
  // ── LB ── (the linebacker's Jump the Route: a hook dropper, short and intermediate routes)
  'zone-drop':   { kind: 'reaction', traits: ['playRecognition', 'zoneInstincts', 'range'], title: 'ZONE DROP', how: 'Four snaps from the hook zone. Drop, read the QB and break on the man he opens to. He looks one off first sometimes: stay home on that one.', rounds: 4 },
  // ── DL ──
  'pass-rush':   { kind: 'rush', traits: ['getOff', 'finesseMoves', 'powerMoves', 'passRush'], title: 'PASS RUSH', how: 'GET OFF when the ball moves. Then read him. He oversets wide: go INSIDE. He leans in: take the EDGE. He sits back high: BULL him.' },
  'run-stuff':   { kind: 'rush', traits: ['playRecognition', 'blockShed', 'strength', 'size', 'power'], title: 'STUFF THE RUN', how: 'Read the line and the back. Tap the side the run is going, then SHED as the back gets there. Too soon and he cuts away.', rounds: 4 },
  // ── OL ── (a lineman plays Seal the Edge too, off his own ratings: Run Block and Anchor)
  'pass-pro':    { kind: 'pro', traits: ['passPro', 'mobility', 'anchor', 'blitzPickup', 'length'], title: 'PASS PRO', how: 'Four snaps. Watch his first step: he goes wide, slide OUTSIDE; he comes back under you, INSIDE. PUNCH as the ring closes on him. A bull rush: HOLD PUNCH and anchor. A twist or a blitz: take the man coming free.' },
  // ── Combine ── (a lineman's: the 40 off Mobility, the bench off Anchor, the cone off Mobility)
  'forty':       { kind: 'dash', traits: ['legs', 'speed', 'getOff', 'range', 'mobility'], title: '40-YARD DASH', how: 'Wait for the gun (jump it and that is a false start), then alternate LEFT and RIGHT as fast as possible. Same foot twice is a stumble. Speed makes every step longer.' },
  'velo':        { kind: 'velo', traits: ['arm'], title: 'THROWING VELOCITY', how: 'Three throws. Hold to wind up and let go inside the small green window. It moves every throw and the wind-up gets faster. A stronger arm gets a bigger window.' },
  'acc':         { kind: 'routes', traits: ['accuracy'], title: 'ACCURACY DRILL', how: 'Throw to receivers on four routes: slant, out, post, go. Tap to throw. The ball takes a moment to get there, so lead him: it has to land while he\'s open (the bright part of the route). Accuracy keeps him open longer.' },
  'cone':        { kind: 'cone', traits: ['elusiveness', 'routeRunning', 'fluidity', 'bend', 'mobility'], title: '3-CONE DRILL', how: 'Six cuts. An arrow flashes: hit that direction before the window shuts. Wrong way or late is a slip. The windows get shorter.' },
  'gauntlet':    { kind: 'gauntlet', traits: ['hands', 'zoneInstincts'], title: 'GAUNTLET', how: 'Balls come down two lanes, faster and closer together. Catch each one in the green zone at the bottom. Hands make the zone bigger.' },
  'bench':       { kind: 'bench', traits: ['strength', 'power', 'anchor'], title: 'BENCH PRESS', how: 'Tap fast to drive the bar up to lockout. Every rep gets heavier. As many reps as possible in 12 seconds.' },
  // ── Basketball ──
  'iso':         { kind: 'lanes', need: 2, traits: ['handles', 'speed', 'playmaking'], title: 'ISO', how: 'He’s overplaying a side. Cross over and attack the other way, three times. Win two of three.', cue: 'DEFENDER' },
  'pnr':         { kind: 'reaction', traits: ['basketballIQ', 'passing', 'playmaking'], title: 'PICK-AND-ROLL READ', how: 'Four trips. Roll man, corner, pull-up: one comes open in green. Hit it before the help recovers. Red is a trap: the help is already there.', rounds: 4 },
  'clutch-shot': { kind: 'timing', traits: ['jumpShot', 'clutch'], title: 'CLUTCH SHOT', how: 'Down late, ball in hand, clock winding down. Hit the release window.' },
  'free-throws': { kind: 'taps', traits: ['jumpShot', 'clutch'], title: 'FREE THROWS', how: 'Two shots with the game on the line. Hit each window. Nerves: the second one wobbles.', n: 2 },
  'post-up':     { kind: 'lanes', traits: ['finishing', 'size'], title: 'POST MOVE', how: 'He’s playing one shoulder. Spin off the other one, three times.', cue: 'DEFENDER' },
  'board':       { kind: 'timing', traits: ['rebounding', 'bounce'], title: 'CRASH THE GLASS', how: 'The shot goes up. Time the jump and take the rebound.' },
  'lockdown':    { kind: 'lanes', traits: ['perimeterDefense', 'speed'], title: 'LOCKDOWN', how: 'He probes one way, then the other. Slide with him and stay in front. Don\u2019t bite on the hesitation.' },
  'fast-break':  { kind: 'reaction', traits: ['passing', 'basketballIQ'], title: 'FAST BREAK', how: 'Two on one, then three on two. The last man commits: hit the open teammate, or keep it and score.' },
  'alley-oop':   { kind: 'timing', traits: ['bounce', 'finishing'], title: 'ALLEY-OOP', how: 'The lob comes in from the wing. Go up to meet it at the top, then throw it down.' },
  'half-court':  { kind: 'reaction', traits: ['handles', 'jumpShot', 'finishing'], title: 'GET A BUCKET', how: 'Five on five, one possession, the shot clock running. Beat the man, read the help, and score.' },
  'rim-protect': { kind: 'reaction', traits: ['interiorDefense', 'bounce'], title: 'PROTECT THE RIM', how: 'Four trips, three drivers. One attacks the rim in green: meet him there. Red is a pump fake: stay down.', rounds: 4 },
  // ── Basketball combine ──
  'sprint':      { kind: 'dash', traits: ['speed'], title: '3/4-COURT SPRINT', how: 'Wait for the whistle (go early and it is a false start), then alternate LEFT and RIGHT as fast as possible. Same foot twice is a stumble. Speed makes every step longer.', unit: 'FT', dist: 75 },
  'lane':        { kind: 'cone', traits: ['speed', 'perimeterDefense'], title: 'LANE AGILITY', how: 'Six cuts around the lane. An arrow flashes: hit that direction before the window shuts. Wrong way or late is a slip.' },
  'spot':        { kind: 'aim', traits: ['jumpShot'], title: 'SPOT-UP SHOOTING', how: 'Four spots around the arc. Tap to lock the shot left to right, then again to lock the arc. A better jumper makes the rim bigger.', noun: 'SHOT' },
  'vert':        { kind: 'velo', traits: ['bounce'], title: 'MAX VERTICAL', how: 'Three jumps. Hold to load, and let go inside the small green window. It moves every jump. More bounce, bigger window.', noun: 'JUMP' },
  'nbench':      { kind: 'bench', load: 0.62, traits: ['size'], title: 'BENCH PRESS', how: 'Tap fast to drive the bar up to lockout. Every rep gets heavier. As many reps as possible in 12 seconds.' },
  // ── Soccer: the striker ──
  'penalty':     { kind: 'penalty', traits: ['finishing', 'composure'], title: 'PENALTY KICK', how: 'Twelve yards. Pick a corner with the stick, then hold SHOOT to start the run-up and let go to set the power: too much and it’s over the bar. STUTTER in the run-up and a keeper who’s guessing goes early: then put it the other way. Tap SHOOT at the strike for a perfect penalty.' },
  'one-on-one':  { kind: 'oneone', traits: ['pace', 'finishing', 'composure', 'dribbling', 'firstTouch'], title: 'ONE-ON-ONE', how: 'Through on goal with a defender chasing. Run at the keeper with the stick: push up to sprint, but the touches get heavier and he’ll come and claim a loose one. Hold SHOOT, aim, and let go to strike it; tap again at contact for a perfect finish. Tap CHIP to dink a keeper who’s off his line, hold it to curl one. Cut sharply as he goes down to take it round him.' },
  'header':      { kind: 'header', traits: ['heading', 'offBall'], title: 'HEADER', how: 'A ball into the box from the right wing. The marker’s touch-tight: when he turns to watch the winger, move and lose him. Make the run near post or far post, get under the ring, and HEAD it as the ring closes. Aim with the stick on the way up.' },
  'volley':      { kind: 'volley', traits: ['firstTouch', 'shotPower', 'finishing'], title: 'VOLLEY', how: 'A corner’s headed out and it drops on the edge of the box, never the same way twice. Get in line with the stick. Hold SHOOT as it comes down and let go as it arrives to hit it first time, or TOUCH it as it arrives, the stick at the target, and shoot before the defender closes in.' },
  'free-kick':   { kind: 'freekick', traits: ['finishing', 'shotPower', 'composure'], title: 'FREE KICK', how: 'Twenty-odd metres out, the wall covering the near post. Aim with the stick. CURL it over the wall into the corner on its side (the keeper can’t see it till it’s past them), or SHOOT: drive it at the keeper’s side, or low under the wall when it jumps. Hold for power and let go in the band; tap again at the strike for a perfect one.' },
  'two-on-one':  { kind: 'counter', traits: ['linkUp', 'composure', 'finishing'], title: '2-ON-1', how: 'A break, the runner up the wing, one man back. Watch the last defender. He steps up: PASS, square it for the tap-in. He drops off to the runner: SHOOT, aim with the stick, hold for power and let go in the band. Go before he commits and he reads it; leave it too long and he’s there.' },
  // ── Soccer's academy trial ──
  'sprint30':    { kind: 'dash', traits: ['pace'], title: '30M SPRINT', how: 'Wait for the whistle (go early and it is a false start), then alternate LEFT and RIGHT as fast as possible. Same foot twice is a stumble. Pace makes every step longer.', unit: 'M', dist: 30 },
  'slalom':      { kind: 'cone', traits: ['dribbling'], title: 'DRIBBLE SLALOM', how: 'Six poles, the ball close. At each pole the arrow shows which way he takes it next: press that way as the ring closes on the ball. Early or late is a heavy touch, the wrong way clips the pole. Clean touches are the time.' },
  'finishing':   { kind: 'targets', traits: ['finishing', 'shotPower'], title: 'FINISHING DRILL', how: 'Five balls from five spots, a target lit in the goal for each. Hold SHOOT and aim at it with the stick, let go to strike it, and tap SHOOT again at contact. Hold CURL for a placed, curled finish. Three of five in the target.' },
  'first-touch': { kind: 'touch', traits: ['firstTouch'], title: 'FIRST TOUCH', how: 'Two tests. KEEP-UPS: it drops to one foot or the other; press that foot, LEFT or RIGHT, as it gets to it. Twelve at most. Then CONTROL: the coach drives three balls in along the ground; press the foot it comes to as it arrives and kill it dead. A point a keep-up, three a ball controlled. 15 passes.' },
  // ── Baseball: the batter and the pitcher ── (lib/mg/atbat.js, pitch.js, steal.js; the Simple ones in MiniGameSimpleBaseball.jsx)
  'at-bat':      { kind: 'atbat', traits: ['contact', 'power', 'eye', 'avoidK', 'clutch'], title: 'THE AT-BAT', how: 'A real at-bat, pitch by pitch. Pick up the spin out of his hand, get the zone on the ball with the stick and swing as it gets to the plate: CONTACT to put it in play, POWER to drive it. Don’t chase off the plate. Get on base.' },
  'walk-off':    { kind: 'atbat', traits: ['clutch', 'contact', 'avoidK'], title: 'WALK-OFF', how: 'Two strikes, the winning run on base. Shorten up and protect: spoil his pitch with CONTACT, spit on the chase, and when he leaves one over the plate, drive the run in. Anything that brings him home wins it.' },
  'steal-second':{ kind: 'steal', traits: ['speed', 'baserunning'], title: 'STEAL SECOND', how: 'On first with three pitches to go. Walk the lead out with the stick, then read the pitcher’s first move: the knee comes up toward home, GO; he spins or his foot comes down toward first, BACK. Get a jump and beat the catcher’s throw to second.' },
  'strike-out':  { kind: 'pitch', traits: ['velocity', 'movement', 'breaking', 'control', 'command', 'composure'], title: 'STRIKE HIM OUT', how: 'A runner on third, and he needs a strikeout. Pick the pitch (the catcher puts down his sign), move his glove with the stick, then hold PITCH and let go to set the effort. Tap PITCH again on the release for a perfect one. Change speeds, change eye levels, and work his cold zones.' },
  'escape-jam':  { kind: 'pitch', traits: ['groundball', 'composure', 'command', 'movement'], title: 'ESCAPE THE JAM', how: 'Bases loaded, one out. Get a strikeout and then the next man, or keep the ball down and get a ground ball for two. Pick the pitch, move the glove, hold PITCH to set the effort and tap it again on the release. Walk him and the run is in.' },
  // ── Baseball's showcase (the MLB Draft Combine): the scouts behind the plate with their guns ──
  'sixty':       { kind: 'dash', traits: ['speed'], title: '60-YARD DASH', how: 'Wait for the gun (jump it and that is a false start), then alternate LEFT and RIGHT as fast as possible. Same foot twice is a stumble. Speed makes every step longer.', unit: 'YD', dist: 60 },
  'exit-velo':   { kind: 'atbat', traits: ['power', 'contact'], title: 'EXIT VELOCITY', how: 'Batting practice, front toss behind the L-screen. Get the zone on it and drive it with POWER as it arrives. Five swings: the hardest one on the gun counts.' },
  'arm-strength':{ kind: 'arm', traits: ['arm'], title: 'OUTFIELD ARM', how: 'Right field, a ball rolled out. Charge it, line the throw up on the plate with the stick, then hold THROW through the crow hop and let go right at the top of the meter. Three throws; the best one on the gun counts.' },
  'pitch-velo':  { kind: 'pitch', traits: ['velocity'], title: 'FASTBALL VELOCITY', how: 'The scouts have their guns up. Five fastballs: hold PITCH and let go at the top of the meter for max effort, then tap PITCH as the ring closes on the release. The best reading counts.' },
  'spin':        { kind: 'pitch', traits: ['breaking'], title: 'SPIN RATE', how: 'Sliders on the TrackMan. Hold PITCH to set the effort, then snap it off: tap PITCH right as the ring closes on the release. Five of them; the scouts write down the average spin.' },
  'bullpen':     { kind: 'pitch', traits: ['control', 'command'], title: 'COMMAND TEST', how: 'The bullpen session. The catcher sets up on a different spot every pitch: move the target on to his glove with the stick, hold PITCH to set the effort, tap it again on the release. Eight pitches; hit his glove.' },
}
// which games a position plays in the playoffs
export const PLAYOFF_GAMES = {
  qb: ['hot-read', 'bomb', 'escape', 'sneak', 'two-minute', 'third-long', 'audible', 'goal-line'],
  rb: ['gap', 'juke', 'goal-line'],
  wr: ['catch', 'juke-wr', 'release', 'goal-line'],
  te: ['catch', 'seal', 'juke-te', 'goal-line'],
  db: ['jump-route', 'tackle-angle'],
  dl: ['pass-rush', 'run-stuff'],
  lb: ['tackle-angle', 'run-stuff', 'zone-drop'],
  ol: ['pass-pro', 'seal'],
  guard: ['iso', 'pnr', 'clutch-shot', 'free-throws', 'lockdown', 'fast-break', 'half-court'],
  big: ['post-up', 'board', 'rim-protect', 'free-throws', 'clutch-shot', 'alley-oop'],
  // soccer: the striker's big moments, every one a late chance to win it (lib/situations.js has their minutes)
  st: ['penalty', 'one-on-one', 'header', 'volley', 'free-kick', 'two-on-one'],
  // baseball: late and close (lib/situations.js has the inning, the outs, the men on): the batter's at-bat, his walk-off
  // and the steal; the pitcher's strikeout and the bases-loaded jam
  bat: ['at-bat', 'walk-off', 'steal-second'],
  pit: ['strike-out', 'escape-jam'],
}
// and the ones it borrows, because the job really overlaps: a tight end beats the press, an end runs a
// man down in the open, a guard crashes the glass, a big faces up or runs the pick-and-roll.
// (never a second copy of a mode it has: Juke, Make a Man Miss and Run After the Catch are one game)
export const ALSO_PLAYS = { te: ['release'], dl: ['tackle-angle'], lb: ['pass-rush'], guard: ['board'], big: ['iso', 'pnr'] }
export const momentsOf = pos => [...(PLAYOFF_GAMES[pos] ?? PLAYOFF_GAMES.qb), ...(ALSO_PLAYS[pos] ?? [])]
// a borrowed game's grade, for a position without the game's own ratings
const BORROWED_TRAITS = { release: ['routeRunning', 'strength'] }
// the combine: three games a position runs (the test is its own step)
export const COMBINE_GAMES = { qb: ['forty', 'velo', 'acc'], rb: ['forty', 'cone', 'bench'], wr: ['forty', 'cone', 'gauntlet'], te: ['forty', 'bench', 'gauntlet'], dl: ['forty', 'bench', 'cone'], lb: ['forty', 'bench', 'gauntlet'], ol: ['forty', 'bench', 'cone'],
  // soccer's academy trial: the career's first step (raw: sprint30 { secs }, slalom { secs, made, of }, finishing { made, of },
  // first-touch { ups, made, dead, of, pts })
  st: ['sprint30', 'slalom', 'finishing', 'first-touch'],
  // baseball's showcase (raw: sixty { secs }, exit-velo { mph, dist, made (95+), of }, arm-strength { mph, made (on line), of },
  // pitch-velo { mph, of }, spin { rpm (the average), max, of }, bullpen { made (on the glove), of, miss (inches) })
  bat: ['sixty', 'exit-velo', 'arm-strength'], pit: ['pitch-velo', 'spin', 'bullpen'] }

// the trait value a game plays at: the average of its traits in the build (5 when none)
export function traitValue(game, build, traits = null) {
  const has = l => l.filter(t => build?.[t])
  const own = has(traits ?? GAMES[game]?.traits ?? []), list = own.length || traits ? own : has(BORROWED_TRAITS[game] ?? [])
  return list.length ? list.reduce((s, t) => s + (build[t].val ?? 5), 0) / list.length : 5
}
// forgiveness from the trait (1–11): a window, in % of the bar, or a time in ms
export const zoneWidth = v => 8 + v * 1.8                  // 10–28% of the bar
export const powerZone = v => 7 + v * 2.4                  // the top 9–33% of the meter
export const reactMs = v => 560 + v * 72                   // 0.63–1.35s to tap the open man
export const lanesMs = v => 560 + v * 70                   // 0.6–1.3s to cut
export const callMs = v => 1500 + v * 230                  // 1.7–4s per call
export const routes = v => [                               // zone multiplier, value if hit
  ['slant', 'SLANT', 1.35, .72], ['dig', 'DIG', 1.0, .9], ['go', 'GO ROUTE', .68, 1.0],
]
// the two-minute drill's calls: situation, three plays, which one's right
export const DRILL_CALLS = [
  { s: '1st & 10 · 1:52 · down 6 · 2 timeouts', a: ['Deep shot', 'Quick out to the sideline', 'Draw play'], c: 1 },
  { s: '2nd & 4 · 1:10 · down 6 · 1 timeout', a: ['Spike it', 'Slant over the middle', 'Screen'], c: 1 },
  { s: '1st & 10 · 0:41 · down 6 · no timeouts · ball on the 30', a: ['Run it', 'Sideline throw', 'Hail Mary'], c: 1 },
  { s: '3rd & 2 · 0:19 · down 6 · ball on the 8', a: ['Fade to the corner', 'QB sneak', 'Spike it'], c: 0 },
  { s: '2nd & 10 · 0:48 · down 2 · field-goal range', a: ['Deep shot', 'Safe throw, stay in range', 'Take a knee'], c: 1 },
  { s: '1st & 10 · 0:12 · tied · no timeouts · ball on the 35', a: ['Run the clock out', 'One shot to the end zone', 'Spike it'], c: 1 },
]
// the audible's looks: what the defense shows, three plays, the counter
export const LOOKS = [
  { s: 'SIX IN THE BOX · SAFETIES DEEP', a: ['Inside run', 'Deep post', 'Quick screen'], c: 1, why: 'Two deep safeties leave the middle soft: the post.' },
  { s: 'BLITZ · CORNERS PRESSED · ONE SAFETY', a: ['Seven-step drop', 'Hot route slant', 'Toss sweep'], c: 1, why: 'Against a blitz, get the ball out: the hot route.' },
  { s: 'EIGHT IN THE BOX · ONE HIGH', a: ['Inside run', 'Play-action deep', 'Draw'], c: 1, why: 'A stacked box begs for play-action over the top.' },
  { s: 'COVER 2 · SOFT CORNERS', a: ['Go route', 'Out route to the sideline', 'Fade'], c: 1, why: 'Soft corners under Cover 2: the sideline out.' },
  { s: 'NICKEL · LIGHT BOX · TWO HIGH', a: ['Power run', 'Deep shot', 'Bubble screen'], c: 0, why: 'A light box: run it down their throat.' },
  { s: 'COVER 0 · EVERYONE BLITZING', a: ['Screen', 'Deep shot to the single', 'Draw'], c: 1, why: 'No safety help: take the one-on-one deep.' },
]
// one playoff moment per round, seeded, never the same twice in a run
// A playoff moment's game fits the moment: the game's situation comes first, then a game for it.
// Trailing late: the two-minute drive, the last shot. At the goal line: fourth and goal. Otherwise any of the rest.
const SITUATION = { 'two-minute': 'trailing', 'clutch-shot': 'trailing', 'goal-line': 'goal' }
export function pickMomentGame(pos, seed, used = [], allow = null) {
  const all = momentsOf(pos).filter(g => !allow || allow(g))
  const r = seeded(`mg-${seed}`)
  const roll = r(), want = roll < 0.3 ? 'trailing' : roll < 0.5 ? 'goal' : null
  const of = sit => all.filter(g => (SITUATION[g] ?? null) === sit)
  // (a position with no game for that situation plays one of its usual ones)
  const fit = want && of(want).length ? of(want) : of(null).length ? of(null) : all
  const fresh = fit.filter(g => !used.includes(g))
  const pool = fresh.length ? fresh : fit
  return pool[Math.floor(r() * pool.length)]
}
export function pickPlayoffGame(pos, seed, used = [], allow = null) {
  const all = momentsOf(pos).filter(g => !allow || allow(g))
  const list = all.filter(g => !used.includes(g))
  const pool = list.length ? list : all
  const r = seeded(`mg-${seed}`)
  return pool[Math.floor(r() * pool.length)]
}
