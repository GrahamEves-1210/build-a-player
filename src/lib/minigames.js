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
//   reaction   three targets; one opens; tap it before the window closes
//   audible    a defensive look; pick the right counter before the clock runs out
//   lanes      a rush comes from one side; move the other way (3 times)
//   sequence   3–4 calls in a row, each on its own clock
//   route      pick a route (easy to hard), then hit its window
//   choice     two ways to play it, each its own game

import { seeded } from './rng'

export const GAMES = {
  // ── QB ──
  'hot-read':    { kind: 'reaction', traits: ['processing', 'leadership'], title: 'HOT READ', how: 'Three receivers. One comes open. Tap him before the window shuts.', rounds: 2 },
  'bomb':        { kind: 'power', traits: ['arm'], title: 'BOMB IT', how: 'Hold to load the deep shot. Let go near the top: a stronger arm gets a bigger window.' },
  'escape':      { kind: 'lanes', traits: ['legs'], title: 'ESCAPE', how: 'The rush collapses from one side. Step the other way, three times.' },
  'sneak':       { kind: 'timing', traits: ['size', 'pocket-presence'], title: 'SNEAK', how: 'Fourth and inches. Hit the snap window and punch it in.' },
  'two-minute':  { kind: 'sequence', traits: ['leadership', 'processing'], title: 'TWO-MINUTE DRILL', how: 'Four calls in a row, each on a clock. Composure buys time.' },
  'third-long':  { kind: 'route', traits: ['accuracy', 'arm'], title: 'THIRD & LONG', how: 'Pick the route, then hit the throw window. The deeper the route, the tighter the window, the bigger the play.' },
  'audible':     { kind: 'audible', traits: ['processing', 'vision'], title: 'AUDIBLE', how: 'Read the look. Pick the counter before the play clock runs out.' },
  // ── RB ──
  'gap':         { kind: 'reaction', traits: ['vision'], title: 'PICK THE GAP', how: 'Three gaps. One opens. Hit it.', rounds: 2 },
  'juke':        { kind: 'lanes', traits: ['elusiveness'], title: 'JUKE', how: 'The tackler commits to a side. Cut the other way, three times.' },
  'truck-bounce':{ kind: 'choice', traits: ['strength', 'speed'], title: 'TRUCK OR BOUNCE', how: 'Lower the shoulder, or take it outside.', options: [['truck', 'TRUCK IT', 'timing', ['strength']], ['bounce', 'BOUNCE OUTSIDE', 'lanes', ['speed']]] },
  // ── WR / TE ──
  'catch':       { kind: 'taps', traits: ['hands'], title: 'CATCH WINDOW', how: 'Three balls. Tap each one in the window.', n: 3 },
  'juke-wr':     { kind: 'lanes', traits: ['bodyControl', 'afterCatch'], title: 'MAKE A MAN MISS', how: 'The defender commits. Cut the other way, three times.' },
  'release':     { kind: 'timing', traits: ['release'], title: 'BEAT THE PRESS', how: 'The corner jams at the line. Hit the window to get a clean release.' },
  'seal':        { kind: 'timing', traits: ['blocking', 'strength'], title: 'SEAL THE EDGE', how: 'Hit the snap window and wall off the edge.' },
  'juke-te':     { kind: 'lanes', traits: ['afterCatch'], title: 'RUN AFTER THE CATCH', how: 'A tackler commits. Cut the other way, three times.' },
  // ── DB (for when the position comes to Career) ──
  'jump-route':  { kind: 'reaction', traits: ['playRecognition', 'zoneIQ'], title: 'JUMP THE ROUTE', how: 'Three routes. One breaks. Jump it.', rounds: 2 },
  'tackle-angle':{ kind: 'lanes', traits: ['speed', 'runSupport'], title: 'TACKLE ANGLE', how: 'The back cuts. Take the right angle, three times.' },
  // ── Combine ──
  'forty':       { kind: 'dash', traits: ['legs', 'speed'], title: '40-YARD DASH', how: 'Wait for the gun (jump it and that is a false start), then alternate LEFT and RIGHT as fast as you can. Same foot twice is a stumble. Speed makes every step longer.' },
  'velo':        { kind: 'velo', traits: ['arm'], title: 'THROWING VELOCITY', how: 'Three throws. Hold to wind up and let go inside the small green window. It moves every throw and the wind-up gets faster. A stronger arm gets a bigger window.' },
  'acc':         { kind: 'aim', traits: ['accuracy'], title: 'ACCURACY DRILL', how: 'Four nets. Tap to lock the throw left to right, then again to lock it up and down. Accuracy makes the nets bigger; the sweeps speed up.' },
  'cone':        { kind: 'cone', traits: ['elusiveness', 'routeRunning', 'bodyControl'], title: '3-CONE DRILL', how: 'Six cuts. An arrow flashes: hit that direction before the window shuts. Wrong way or late is a slip. The windows get shorter.' },
  'gauntlet':    { kind: 'gauntlet', traits: ['hands'], title: 'GAUNTLET', how: 'Balls come down two lanes, faster and closer together. Catch each one in the green zone at the bottom. Hands make the zone bigger.' },
  'bench':       { kind: 'bench', traits: ['strength'], title: 'BENCH PRESS', how: 'Tap fast to drive the bar up to lockout. Every rep gets heavier. As many reps as you can in 12 seconds.' },
  // ── Basketball ──
  'iso':         { kind: 'lanes', traits: ['handles', 'speed'], title: 'ISO', how: 'Your man shades one way. Cross him up and go the other way, three times.' },
  'pnr':         { kind: 'reaction', traits: ['basketballIQ', 'passing'], title: 'PICK-AND-ROLL READ', how: 'Roll man, corner, pull-up. One comes open. Hit it before the help recovers.', rounds: 2 },
  'clutch-shot': { kind: 'timing', traits: ['jumpShot', 'clutch'], title: 'CLUTCH SHOT', how: 'Down one, ball in your hands, clock running out. Hit the release window.' },
  'free-throws': { kind: 'taps', traits: ['jumpShot', 'clutch'], title: 'FREE THROWS', how: 'Two shots with the game on the line. Hit each window.', n: 2 },
  'post-up':     { kind: 'lanes', traits: ['finishing', 'size'], title: 'POST MOVE', how: 'The defender leans one way. Spin off him the other way, three times.' },
  'board':       { kind: 'timing', traits: ['rebounding', 'bounce'], title: 'CRASH THE GLASS', how: 'The shot goes up. Time the jump and take the rebound.' },
  'rim-protect': { kind: 'reaction', traits: ['interiorDefense', 'bounce'], title: 'PROTECT THE RIM', how: 'Three drivers. One attacks the rim. Meet him there.', rounds: 2 },
  // ── Basketball combine ──
  'sprint':      { kind: 'dash', traits: ['speed'], title: '3/4-COURT SPRINT', how: 'Wait for the whistle (go early and it is a false start), then alternate LEFT and RIGHT as fast as you can. Same foot twice is a stumble. Speed makes every step longer.', unit: 'FT', dist: 75 },
  'lane':        { kind: 'cone', traits: ['handles', 'speed'], title: 'LANE AGILITY', how: 'Six cuts around the lane. An arrow flashes: hit that direction before the window shuts. Wrong way or late is a slip.' },
  'spot':        { kind: 'aim', traits: ['jumpShot'], title: 'SPOT-UP SHOOTING', how: 'Four spots around the arc. Tap to lock the shot left to right, then again to lock the arc. A better jumper makes the rim bigger.', noun: 'SHOT' },
  'vert':        { kind: 'velo', traits: ['bounce'], title: 'MAX VERTICAL', how: 'Three jumps. Hold to load, and let go inside the small green window. It moves every jump. More bounce, bigger window.', noun: 'JUMP' },
  'nbench':      { kind: 'bench', traits: ['size'], title: 'BENCH PRESS', how: 'Tap fast to drive the bar up to lockout. Every rep gets heavier. As many reps as you can in 12 seconds.' },
}
// which games a position plays in the playoffs
export const PLAYOFF_GAMES = {
  qb: ['hot-read', 'bomb', 'escape', 'sneak', 'two-minute', 'third-long', 'audible'],
  rb: ['gap', 'juke', 'truck-bounce'],
  wr: ['catch', 'juke-wr', 'release'],
  te: ['catch', 'seal', 'juke-te'],
  db: ['jump-route', 'tackle-angle'],
  guard: ['iso', 'pnr', 'clutch-shot', 'free-throws'],
  big: ['post-up', 'board', 'rim-protect', 'free-throws'],
}
// the combine: three games a position runs (the test is its own step)
export const COMBINE_GAMES = { qb: ['forty', 'velo', 'acc'], rb: ['forty', 'cone', 'bench'], wr: ['forty', 'cone', 'gauntlet'], te: ['forty', 'bench', 'gauntlet'] }

// the trait value a game plays at: the average of its traits in the build (5 when none)
export function traitValue(game, build, traits = null) {
  const list = (traits ?? GAMES[game]?.traits ?? []).filter(t => build?.[t])
  return list.length ? list.reduce((s, t) => s + (build[t].val ?? 5), 0) / list.length : 5
}
// forgiveness from the trait (1–11): a window, in % of the bar, or a time in ms
export const zoneWidth = v => 12 + v * 2.4                 // 14–38% of the bar
export const powerZone = v => 7 + v * 2.4                  // the top 9–33% of the meter
export const reactMs = v => 620 + v * 85                   // 0.7–1.55s to tap the open man
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
  { s: 'BLITZ · CORNERS PRESSED · ONE SAFETY', a: ['Seven-step drop', 'Hot route slant', 'Toss sweep'], c: 1, why: 'Against a blitz you get the ball out: the hot route.' },
  { s: 'EIGHT IN THE BOX · ONE HIGH', a: ['Inside run', 'Play-action deep', 'Draw'], c: 1, why: 'A stacked box begs for play-action over the top.' },
  { s: 'COVER 2 · SOFT CORNERS', a: ['Go route', 'Out route to the sideline', 'Fade'], c: 1, why: 'Soft corners under Cover 2: the sideline out.' },
  { s: 'NICKEL · LIGHT BOX · TWO HIGH', a: ['Power run', 'Deep shot', 'Bubble screen'], c: 0, why: 'A light box: run it down their throat.' },
  { s: 'COVER 0 · EVERYONE BLITZING', a: ['Screen', 'Deep shot to the single', 'Draw'], c: 1, why: 'No safety help: take the one-on-one deep.' },
]
// one playoff moment per round, seeded, never the same twice in a run
export function pickPlayoffGame(pos, seed, used = []) {
  const list = (PLAYOFF_GAMES[pos] ?? PLAYOFF_GAMES.qb).filter(g => !used.includes(g))
  const pool = list.length ? list : PLAYOFF_GAMES[pos] ?? PLAYOFF_GAMES.qb
  const r = seeded(`mg-${seed}`)
  return pool[Math.floor(r() * pool.length)]
}
