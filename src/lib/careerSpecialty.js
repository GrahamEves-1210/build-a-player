// A Career build's specialty (2026-11-20, a player and the owner): the craft a player is known for holds up
// longest. Keenan Allen and Davante Adams still beat press in their thirties; Tyreek Hill is still the fastest man
// on the field at 30. Pure: nothing here imports career.js.
//
//   - Every position has a few real roles (a route runner, a jump-ball receiver, a speed back, a power rusher...).
//     Each names the one or two traits that make it, all of them traits that train in a window or fade with age.
//   - A career's specialty is the role its build fits best when the career starts: the one whose traits stand
//     highest, on average. A save from before gets one from its build as it is now (career.js opened). It's
//     written on the career (c.specialty) and never moves after that.
//   - Its traits train SPEC_TRAIN more years (lib/ageLadder.js: the window's full years and its last year both
//     move), and start to fade SPEC_FADE years later and at SPEC_RATE of the usual pace (lib/careerAging.js).
//     A speedster still loses his speed by his mid-thirties: later and a little at a time.
export const SPEC_TRAIN = 2
export const SPEC_FADE = 2
export const SPEC_RATE = 0.8

// [id, the role as a scout says it, its traits]. The order breaks a tie.
export const SPECIALTY = {
  nfl: {
    qb: [['pocket', 'Pocket passer', ['accuracy', 'pocket-presence']], ['arm', 'Big arm', ['arm']], ['dual', 'Dual threat', ['legs', 'playmaking']]],
    rb: [['speed', 'Home-run hitter', ['speed', 'burst']], ['power', 'Power back', ['strength', 'balance']], ['elusive', 'Make-you-miss back', ['elusiveness']], ['receiving', 'Receiving back', ['hands', 'carrying']]],
    wr: [['route', 'Route runner', ['routeRunning', 'release']], ['redzone', 'Red-zone threat', ['hands', 'bodyControl']], ['jump', 'Jump-ball specialist', ['vertical']], ['speed', 'Speedster', ['speed']], ['yac', 'Yards-after-catch threat', ['afterCatch']]],
    te: [['catch', 'Pass catcher', ['routeRunning', 'hands']], ['block', 'In-line blocker', ['blocking', 'strength']], ['seam', 'Seam stretcher', ['speed', 'vertical']], ['yac', 'Yards-after-catch threat', ['afterCatch']]],
    db: [['cover', 'Cover corner', ['manCoverage', 'press']], ['speed', 'Speed and recovery', ['speed', 'fluidity']], ['hawk', 'Ball hawk', ['hands']], ['box', 'Run-support safety', ['runSupport']]],
    dl: [['speed', 'Speed rusher', ['getOff', 'bend']], ['power', 'Power rusher', ['powerMoves', 'strength']], ['finesse', 'Hand-fighter', ['finesseMoves']], ['run', 'Run stopper', ['blockShed']]],
    lb: [['cover', 'Coverage linebacker', ['range']], ['thumper', 'Thumper', ['power', 'tackling']], ['blitz', 'Blitzer', ['passRush']], ['run', 'Run stopper', ['blockShed', 'tackling']]],
    ol: [['pass', 'Pass protector', ['passPro']], ['grader', 'Road grader', ['runBlock', 'pancake']], ['anchor', 'Anchor', ['anchor']], ['zone', 'Zone blocker', ['mobility']]],
    k: [['leg', 'Big leg', ['power']], ['auto', 'Automatic', ['accuracy']]],
  },
  bucket: {
    guard: [['handle', 'Ball handler', ['handles']], ['slasher', 'Slasher', ['finishing', 'bounce']], ['stopper', 'Perimeter stopper', ['perimeterDefense']], ['speed', 'Speed guard', ['speed', 'bounce']]],
    big: [['rim', 'Rim protector', ['interiorDefense']], ['glass', 'Rebounder', ['rebounding']], ['finisher', 'Finisher', ['finishing', 'bounce']], ['athlete', 'Rim runner', ['speed', 'bounce']]],
  },
}
const val = ch => Math.round(ch?.val ?? 0)
// the role a build fits best: { id, label, traits } (null: no roles for this position)
export function specialtyFor(sport, pos, build) {
  const roles = SPECIALTY[sport]?.[pos]
  if (!roles || !build) return null
  let best = null
  for (const [id, label, traits] of roles) {
    const has = traits.filter(t => build[t])
    if (!has.length) continue
    const v = has.reduce((s, t) => s + val(build[t]), 0) / has.length
    if (!best || v > best.v) best = { id, label, traits: has, v }
  }
  return best && { id: best.id, label: best.label, traits: best.traits }
}
// the role written on a career, or (a save from before, not yet stamped) the one its build fits now
export const specialtyOf = c => {
  if (!c) return null
  if (c.specialty?.traits) return c.specialty
  return specialtyFor(c.sport ?? 'nfl', c.pos, c.build)
}
export const specTraits = c => specialtyOf(c)?.traits ?? []
export const isSpec = (c, t) => specTraits(c).includes(t)
