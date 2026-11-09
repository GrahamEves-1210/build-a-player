// The Simple mini games: the original quick DOM games (components/app/MiniGameSimple.jsx),
// as they were before the canvas games (commit e1255f2). Same kinds, rules and windows;
// the timing helpers (zoneWidth, reactMs, ...) are shared with lib/minigames.js, unchanged.
//
// Games added since have their own DOM games here:
//   goal-line   goalline   (FOURTH & GOAL: a two-beat play. QB: read who's open, then the throw;
//                           RB / WR / TE: win off the line, then the catch)
//   release     press      (BEAT THE PRESS: hand fighting, swipe the hand that's on him)
//   seal        seal       (SEAL THE EDGE: a drive block, hold the needle in the band)
//   pass-rush   rush       (the tackle’s set says which move beats him: SWIM, BULL RUSH, SPIN)
//   run-stuff   stuff      (the back presses a gap and cuts: fill the one he commits to)
//   lockdown    lockdown   (on the ball: slide with the drive, don't bite on the hesitation)
//   fast-break  break      (the last man commits: hit the man he leaves, or finish)
//   alley-oop   oop        (a lob from the wing: jump to meet it at the top, then throw it down)
//   half-court  bucket     (one possession: read what his man gives you, cross him or pull up, then the finish)
//   pass-pro    pro        (a tackle's pass set: slide with the rush, punch on time, hold a bull, pick up a blitz)
// and soccer's (the striker): penalty pen, one-on-one oneone, header head, volley vol, and the academy trial's
// sprint30 (the dash, in metres), slalom and finishing goalaim; free-kick fk, two-on-one twoone and the trial's first-touch touch
// and the DL's combine reads its own traits (the 40's Get Off, the cone's Bend), the LB's too (Range, Power, Zone Instincts),
// the OL's too (the 40's and the cone's Mobility, the bench's Anchor). Seal the Edge reads a lineman's Run Block and Anchor.
// The combine's measured drills name their drill (drill), so the board reads the right scale.
// and baseball's (MiniGameSimpleBaseball.jsx, loaded only when one opens): at-bat / walk-off bbat, exit-velo bev,
// steal-second bsteal, strike-out / escape-jam bpitch, pitch-velo / spin / arm-strength bgun, bullpen bcmd; the 60 is the dash

export const SIMPLE_GAMES = {
  // ── QB ──
  'hot-read':    { kind: 'reaction', traits: ['processing', 'vision'], title: 'HOT READ', how: 'Four snaps, three receivers. One comes open in green: tap him before the window shuts. Red is covered: never throw it there.', rounds: 4 },
  'bomb':        { kind: 'power', traits: ['arm'], title: 'BOMB IT', how: 'Hold to load the deep shot. Let go near the top: a stronger arm gets a bigger window.' },
  'escape':      { kind: 'lanes', traits: ['legs'], title: 'ESCAPE', how: 'The pocket collapses from one side. Escape the other way, three times.' },
  'sneak':       { kind: 'sneak', traits: ['size', 'legs'], title: 'SNEAK', how: 'Fourth and inches. Wait out the hut, hut. On the snap, hammer PUSH and drive the pile over the line.' },
  'two-minute':  { kind: 'drive', traits: ['leadership', 'processing'], title: 'TWO-MINUTE DRILL', how: 'Down six, ball on the 25, no timeouts. Call the play, hit the throw, and beat the clock to the end zone.' },
  'third-long':  { kind: 'route', traits: ['accuracy', 'arm'], title: 'THIRD & LONG', how: 'Pick the route, then hit the throw window. The deeper the route, the tighter the window, the bigger the play.' },
  'audible':     { kind: 'audible', traits: ['processing', 'vision'], title: 'AUDIBLE', how: 'Read the look. Pick the counter before the play clock runs out.' },
  'goal-line':   { kind: 'goalline', traits: ['accuracy', 'routeRunning', 'hands'], title: 'FOURTH & GOAL', how: 'Fourth and goal at the five, two beats. A QB reads the coverage and picks the man who comes open, then makes the throw. A back or a receiver beats the man on him off the line, then makes the catch. The quicker the first beat, the bigger the window on the second.' },
  // ── RB ──
  'gap':         { kind: 'reaction', traits: ['vision'], title: 'PICK THE GAP', how: 'Four plays. One gap opens green each time: hit it, fast. Red is a linebacker filling it: stay out.', rounds: 4, quick: 0.72 },
  'juke':        { kind: 'lanes', traits: ['elusiveness'], title: 'JUKE', how: 'The tackler commits to a side. Cut the other way, three times.' },
  // ── WR / TE ──
  'catch':       { kind: 'taps', traits: ['hands'], title: 'CATCH WINDOW', how: 'Three balls. Tap each one in the window. Each one comes in hotter.', n: 3 },
  'juke-wr':     { kind: 'lanes', traits: ['bodyControl', 'afterCatch'], title: 'MAKE A MAN MISS', how: 'The defender commits. Cut the other way, three times.' },
  'release':     { kind: 'press', traits: ['release'], title: 'BEAT THE PRESS', how: 'The corner jams at the snap. Swipe away the hand he jams with, LEFT or RIGHT. He usually re-jams with the other. Fill FREE before the ball comes out. A wrong swipe whiffs.' },
  'seal':        { kind: 'seal', traits: ['blocking', 'strength', 'runBlock', 'anchor'], title: 'SEAL THE EDGE', how: 'A drive block. Hold DRIVE to push, ease off to settle, and keep the needle in the green band while he pushes back. He surges: SURGE shows just before. Driven back or overextended and he is past.' },
  'juke-te':     { kind: 'lanes', traits: ['afterCatch'], title: 'RUN AFTER THE CATCH', how: 'A tackler commits. Cut the other way, three times.' },
  // ── DB ──
  'jump-route':  { kind: 'reaction', traits: ['playRecognition', 'zoneIQ', 'zoneInstincts'], title: 'JUMP THE ROUTE', how: 'Four snaps, three routes. One breaks green: jump it. Red is a double move: let it go.', rounds: 4 },
  'tackle-angle':{ kind: 'lanes', traits: ['speed', 'runSupport', 'range', 'tackling'], title: 'TACKLE ANGLE', how: 'The back cuts. Take the right angle, three times.' },
  'zone-drop':   { kind: 'reaction', traits: ['playRecognition', 'zoneInstincts', 'range'], title: 'ZONE DROP', how: 'Four snaps from the hook zone, three routes. One breaks open in green: break on it. Red is the QB looking him off: stay in the zone.', rounds: 4 },
  // ── DL ──
  'pass-rush':   { kind: 'rush', traits: ['getOff', 'finesseMoves', 'powerMoves', 'passRush'], title: 'PASS RUSH', how: 'Three snaps. Read the tackle’s set at the snap and hit the move that beats it before he recovers: SWIM beats high hands, BULL RUSH beats a soft anchor, SPIN beats an overset. Get home twice to win.' },
  'run-stuff':   { kind: 'stuff', traits: ['playRecognition', 'blockShed', 'strength', 'size', 'power'], title: 'STUFF THE RUN', how: 'Four handoffs, three gaps. The back often presses one gap and cuts back: fill the one he commits to. Jump it early and he cuts away. Three stops win it.' },
  // ── OL ──
  'pass-pro':    { kind: 'pro', traits: ['passPro', 'mobility', 'anchor', 'blitzPickup', 'length'], title: 'PASS PRO', how: 'Four snaps. On each, read the rusher: a speed rush wide, a counter back inside, a bull straight on, or a blitz. Mirror where he’s really going, then PUNCH as the ring closes. Against a bull, HOLD PUNCH until he stops. On a blitz, take the man coming free. Moving before the snap is a false start. Three good snaps hold the pocket.' },
  // ── Combine ──
  'forty':       { kind: 'dash', drill: 'forty', traits: ['legs', 'speed', 'getOff', 'range', 'mobility'], title: '40-YARD DASH', how: 'Wait for the gun (jump it and that is a false start), then alternate LEFT and RIGHT as fast as possible. Same foot twice is a stumble. Speed makes every step longer.' },
  'velo':        { kind: 'velo', traits: ['arm'], title: 'THROWING VELOCITY', how: 'Three throws into the net. Hold: the meter climbs to the PEAK and falls back. Let go at the peak: the closer, the faster. The radar reads every throw and the best one counts. Two in the green pass.' },
  'acc':         { kind: 'routes', traits: ['accuracy'], title: 'ACCURACY DRILL', how: 'Throw to receivers on four routes: slant, out, post, go. Tap to throw. The ball takes a moment to get there, so lead him: it has to land on the target stretch (the bright part of the route). Accuracy makes the stretch longer.' },
  'cone':        { kind: 'cone', drill: 'cone', traits: ['elusiveness', 'routeRunning', 'fluidity', 'bend', 'mobility'], title: '3-CONE DRILL', how: 'Six cuts. An arrow flashes: hit that direction before the window shuts. Wrong way or late is a slip. The windows get shorter.' },
  'gauntlet':    { kind: 'gauntlet', traits: ['hands', 'zoneInstincts'], title: 'GAUNTLET', how: 'Balls come down the left lane, then the right, faster and closer together. Catch each one in the green zone at the bottom. Hands make the zone bigger.' },
  'bench':       { kind: 'bench', traits: ['strength', 'power', 'anchor'], title: 'BENCH PRESS', how: 'Tap fast to drive the bar up to lockout. Every rep gets heavier. As many reps as possible in 12 seconds.' },
  // ── Basketball ──
  'iso':         { kind: 'lanes', need: 2, traits: ['handles', 'speed'], title: 'ISO', how: 'He’s overplaying a side. Cross over and attack the other way, three times. Win two of three.', cue: 'DEFENDER' },
  'pnr':         { kind: 'reaction', traits: ['basketballIQ', 'passing'], title: 'PICK-AND-ROLL READ', how: 'Four trips. Roll man, corner, pull-up: one comes open in green. Hit it before the help recovers. Red is a trap: the help is already there.', rounds: 4 },
  'clutch-shot': { kind: 'timing', traits: ['jumpShot', 'clutch'], title: 'CLUTCH SHOT', how: 'Down one, ball in hand, clock winding down. Hit the release window.' },
  'free-throws': { kind: 'taps', traits: ['jumpShot', 'clutch'], title: 'FREE THROWS', how: 'Two shots with the game on the line. Hit each window. Nerves: the second one wobbles.', n: 2 },
  'post-up':     { kind: 'lanes', traits: ['finishing', 'size'], title: 'POST MOVE', how: 'He’s playing one shoulder. Spin off the other one, three times.', cue: 'DEFENDER' },
  'board':       { kind: 'timing', traits: ['rebounding', 'bounce'], title: 'CRASH THE GLASS', how: 'The shot goes up. Time the jump and take the rebound.' },
  'rim-protect': { kind: 'reaction', traits: ['interiorDefense', 'bounce'], title: 'PROTECT THE RIM', how: 'Four trips, three drivers. One attacks the rim in green: meet him there. Red is a pump fake: stay down.', rounds: 4 },
  'lockdown':    { kind: 'lockdown', traits: ['perimeterDefense', 'speed'], title: 'LOCKDOWN', how: 'Three moves, each one quicker. He attacks a side: slide that way and stay in front. Some are hesis: he shows one way, stops and crosses back. Bite on the fake and he’s gone. Two stops win it.' },
  'fast-break':  { kind: 'break', traits: ['passing', 'basketballIQ'], title: 'FAST BREAK', how: 'Three breaks, each one quicker: a two on one, then three on two. A trailer fills a lane, then the last man commits to the ball or a wing. Hit the man he leaves, or FINISH it at the rim if the middle is open. Move before he commits and he jumps it.' },
  'alley-oop':   { kind: 'oop', traits: ['bounce', 'finishing'], title: 'ALLEY-OOP', how: 'Three lobs from the wing. Tap JUMP to meet the ball at the top, at the ring, then tap SLAM to throw it down before landing. Meet it cleaner for more hang time. Two of three down wins it.' },
  'half-court':  { kind: 'bucket', traits: ['handles', 'jumpShot', 'finishing'], title: 'GET A BUCKET', how: 'One possession. Read the defender: if he overplays a side, CROSS and attack the rim. If he sags off, SHOOT. Wait too long and he takes it away. Go too early and he picks the pocket. Then hit the zone to finish: a layup is easier than a jumper.' },
  // ── Basketball combine ──
  'sprint':      { kind: 'dash', drill: 'sprint', traits: ['speed'], title: '3/4-COURT SPRINT', how: 'Wait for the whistle (go early and it is a false start), then alternate LEFT and RIGHT as fast as possible. Same foot twice is a stumble. Speed makes every step longer.', unit: 'FT', dist: 75 },
  'lane':        { kind: 'cone', drill: 'lane', traits: ['speed', 'perimeterDefense'], title: 'LANE AGILITY', how: 'Six cuts around the lane. An arrow flashes: hit that direction before the window shuts. Wrong way or late is a slip.' },
  'spot':        { kind: 'aim', traits: ['jumpShot'], title: 'SPOT-UP SHOOTING', how: 'Four spots around the arc. Tap to lock the shot left to right, then again to lock the arc. A better jumper makes the rim bigger.', noun: 'SHOT' },
  'vert':        { kind: 'velo', traits: ['bounce'], title: 'MAX VERTICAL', how: 'Three jumps at the Vertec. Hold: the meter climbs to the PEAK and falls back. Let go at the peak: the closer, the higher. The best jump counts. Two in the green pass.', noun: 'JUMP' },
  'nbench':      { kind: 'bench', load: 0.62, traits: ['size'], title: 'BENCH PRESS', how: 'Tap fast to drive the bar up to lockout. Every rep gets heavier. As many reps as possible in 12 seconds.' },
  // ── Soccer: the striker ──
  'penalty':     { kind: 'pen', traits: ['finishing', 'composure'], title: 'PENALTY KICK', how: 'The whistle, then the run-up. Press LEFT, MIDDLE or RIGHT as it ends: that’s where it goes. Go early and the keeper reads the hips and goes that way. Wait for him to dive and put it the other way, but wait too long and it gets scuffed.' },
  'one-on-one':  { kind: 'oneone', traits: ['pace', 'finishing', 'composure'], title: 'ONE-ON-ONE', how: 'Through on goal with a defender chasing. The bar says what the keeper’s doing. SHOOT while he’s on the move (not when he’s set). Or wait for him to go DOWN and take it round him, LEFT or RIGHT, the other way from his dive. Leave it too long and the defender gets a foot in.' },
  'header':      { kind: 'head', traits: ['heading', 'offBall'], title: 'HEADER', how: 'Two beats. The marker’s tight: MAKE THE RUN while he’s watching the ball (a quick glance doesn’t count), and he’s lost. Then the cross: press LEFT or RIGHT as it arrives to head it into that corner. The far corner, unless the keeper’s moved across.' },
  'volley':      { kind: 'vol', traits: ['firstTouch', 'shotPower', 'finishing'], title: 'VOLLEY', how: 'It drops on the edge of the box. VOLLEY it first time as it reaches the feet (the tightest window), or TAKE A TOUCH as it gets there, then SHOOT before the defender closes in.' },
  'free-kick':   { kind: 'fk', traits: ['finishing', 'shotPower', 'composure'], title: 'FREE KICK', how: 'Pick the kick for the wall. CURL goes over it into the corner (the keeper can’t see it), LOW goes under it when it jumps (not if a man’s lying behind it), DRIVEN goes at the keeper’s side and has to be perfect. Then strike it in the zone.' },
  'two-on-one':  { kind: 'twoone', traits: ['linkUp', 'composure', 'finishing'], title: '2-ON-1', how: 'Watch the last man. He steps up: PASS, square it for the tap-in. He drops off to the runner: SHOOT, then finish it in the zone. Go before he commits and he reads it; wait too long and he’s there.' },
  // ── Soccer's academy trial ──
  'sprint30':    { kind: 'dash', drill: 'sprint30', stat: '30M SPRINT', traits: ['pace'], title: '30M SPRINT', how: 'Wait for the whistle (go early and it is a false start), then alternate LEFT and RIGHT as fast as possible. Same foot twice is a stumble. Pace makes every step longer.', unit: 'M', dist: 30 },
  'slalom':      { kind: 'slalom', traits: ['dribbling'], title: 'DRIBBLE SLALOM', how: 'Six poles. At each one an arrow lights the way to take it next: press that way, fast, before the window shuts. The wrong way clips the pole, too slow is a heavy touch. Clean, quick touches are the time.' },
  'finishing':   { kind: 'goalaim', traits: ['finishing', 'shotPower'], title: 'FINISHING DRILL', how: 'Five balls, a target in each corner. One lights up: tap to lock the shot left to right, then again to lock it up and down. Finishing makes the target bigger. Three of five on target.' },
  'first-touch': { kind: 'touch', traits: ['firstTouch'], title: 'FIRST TOUCH', how: 'KEEP-UPS: press the foot it drops to, LEFT or RIGHT, as it gets there. Twelve at most. Then the coach plays three balls in: the foot it comes to, as it arrives. A point a keep-up, three a ball controlled. 15 passes.' },
  // ── Baseball: the batter and the pitcher (MiniGameSimpleBaseball.jsx) ──
  'at-bat':      { kind: 'bbat', game: 'at-bat', traits: ['contact', 'power', 'eye', 'avoidK', 'clutch'], title: 'THE AT-BAT', how: 'Pitch by pitch. Read it out of his hand: the pitch and where it’s going show up as he picks up the spin. In the zone, swing as it gets to the plate: CONTACT or POWER. Off the plate, take it. Get on base.' },
  'walk-off':    { kind: 'bbat', game: 'walk-off', walk: true, traits: ['clutch', 'contact', 'avoidK'], title: 'WALK-OFF', how: 'Two strikes, the winning run on. Protect the plate: CONTACT on anything close, take the chase, and drive the run in when he leaves one over the plate.' },
  'steal-second':{ kind: 'bsteal', traits: ['speed', 'baserunning'], title: 'STEAL SECOND', how: 'Three pitches to go. Read his first move: the leg kick or the slide step, GO; he spins to first, BACK. A lefty’s leg comes up either way: wait for the foot. Going before he moves is an out.' },
  'strike-out':  { kind: 'bpitch', game: 'strike-out', traits: ['velocity', 'movement', 'breaking', 'control', 'command', 'composure'], title: 'STRIKE HIM OUT', how: 'A runner on third. Pick the pitch and the spot (his hot zone is red, his cold one blue), then PITCH and RELEASE in the zone. Change speeds and eye levels and strike him out.' },
  'escape-jam':  { kind: 'bpitch', game: 'escape-jam', jam: true, traits: ['groundball', 'composure', 'command', 'movement'], title: 'ESCAPE THE JAM', how: 'Bases loaded, one out. Strike him out and get the next man, or keep it down for a double-play ground ball. Pick the pitch and the spot, then PITCH and RELEASE in the zone. Walk him and the run is in.' },
  // ── Baseball's showcase ──
  'sixty':       { kind: 'dash', drill: 'sixty', stat: '60-YARD DASH', traits: ['speed'], title: '60-YARD DASH', how: 'Wait for the gun (go early and it is a false start), then alternate LEFT and RIGHT as fast as possible. Same foot twice is a stumble. Speed makes every step longer.', unit: 'YD', dist: 60 },
  'exit-velo':   { kind: 'bev', traits: ['power', 'contact'], title: 'EXIT VELOCITY', how: 'Front toss, five swings. Tap as it arrives, in the zone: the squarer the contact, the harder it comes off. The best one on the gun counts.' },
  'arm-strength':{ kind: 'bgun', drill: 'arm-strength', traits: ['arm'], title: 'OUTFIELD ARM', how: 'Three throws home from right field. Tap at the top of the crow hop, in the zone: all of it on the gun. The best throw counts.' },
  'pitch-velo':  { kind: 'bgun', drill: 'pitch-velo', traits: ['velocity'], title: 'FASTBALL VELOCITY', how: 'Five fastballs for the guns behind the plate. Tap on the release, in the zone, for everything he has. The best reading counts.' },
  'spin':        { kind: 'bgun', drill: 'spin', traits: ['breaking'], title: 'SPIN RATE', how: 'Five sliders on the TrackMan. Snap it off: tap in the zone on the release. The scouts write down the average spin.' },
  'bullpen':     { kind: 'bcmd', traits: ['control', 'command'], title: 'COMMAND TEST', how: 'Eight pitches, the catcher on a new spot every time. Tap to lock the pitch across, then again for up and down, on his glove.' },
}
// a borrowed game's grade, for a position without the game's own ratings (as lib/minigames.js)
const BORROWED_TRAITS = { release: ['routeRunning', 'strength'] }
// the trait value a Simple game plays at: the average of its traits in the build (5 when none)
export function simpleTraitValue(game, build, traits = null) {
  const has = l => l.filter(t => build?.[t])
  const own = has(traits ?? SIMPLE_GAMES[game]?.traits ?? []), list = own.length || traits ? own : has(BORROWED_TRAITS[game] ?? [])
  return list.length ? list.reduce((s, t) => s + (build[t].val ?? 5), 0) / list.length : 5
}
