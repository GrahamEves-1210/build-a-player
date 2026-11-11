// Which engine plays which game (engines: lib/mg/*.js; kit.js says what an engine is).
import * as catchGame from './catch.js'
import * as read from './read.js'
import * as cut from './cut.js'
import * as meter from './meter.js'
import * as rebound from './rebound.js'
import * as throwGame from './throw.js'
import * as calls from './calls.js'
import * as leverage from './leverage.js'
import * as dash from './dash.js'
import * as bench from './bench.js'
import * as cone from './cone.js'
import * as rush from './rush.js'
import * as goalline from './goalline.js'
import * as lockdown from './lockdown.js'
import * as fastbreak from './fastbreak.js'
import * as oop from './oop.js'
import * as halfcourt from './halfcourt.js'
import * as passpro from './passpro.js'
import * as hitstick from './hitstick.js'
import * as kick from './kick.js'
import * as penalty from './penalty.js'
import * as oneonone from './oneonone.js'
import * as header from './header.js'
import * as volley from './volley.js'
import * as sprint30 from './sprint30.js'
import * as slalom from './slalom.js'
import * as finishing from './finishing.js'
// (more soccer: the free kick, the 2-on-1, the rebound and the first-touch trial)
import * as freekick from './freekick.js'
import * as counter from './counter.js'
import * as firsttouch from './firsttouch.js'
// baseball (lib/mg/baseball.js draws them all: a ballpark at night, through a camera in metres)
import * as atbat from './atbat.js'
import * as pitchGame from './pitch.js'
import * as steal from './steal.js'
import * as dash60 from './dash60.js'
import * as ofarm from './ofarm.js'
import { useCamera } from './art.js'

// (make sets the game's camera first, so the layout it works out goes through the same one as the picture.
// cam: another game's camera, for a game shot the same way: Pass Pro is Pass Rush from the other side)
const withBot = (mod, botName, cam = null) => ({ ...mod, botName, make: o => { useCamera(cam ?? o.game); return mod.make(o) } })
const map = (mod, botName, ids, cam = null) => Object.fromEntries(ids.map(id => [id, withBot(mod, botName, cam)]))
export const ENGINES = {
  ...map(catchGame, 'catch', ['gauntlet', 'catch', 'release']),
  ...map(read, 'read', ['hot-read', 'gap', 'jump-route', 'zone-drop', 'pnr', 'rim-protect']),
  ...map(cut, 'cut', ['escape', 'juke', 'juke-wr', 'juke-te', 'tackle-angle', 'iso', 'post-up']),
  ...map(meter, 'meter', ['clutch-shot', 'free-throws', 'spot', 'velo', 'vert']),
  ...map(rebound, 'rebound', ['board']),
  ...map(throwGame, 'throw', ['bomb', 'third-long', 'acc']),
  ...map(calls, 'calls', ['audible', 'two-minute']),
  ...map(leverage, 'leverage', ['seal', 'sneak']),
  ...map(dash, 'dash', ['forty', 'sprint']),
  ...map(bench, 'bench', ['bench', 'nbench']),
  ...map(cone, 'cone', ['cone', 'lane']),
  ...map(rush, 'rush', ['pass-rush', 'run-stuff']),
  ...map(goalline, 'goalline', ['goal-line']),
  ...map(lockdown, 'lockdown', ['lockdown']),
  ...map(fastbreak, 'fastbreak', ['fast-break']),
  ...map(oop, 'oop', ['alley-oop']),
  ...map(halfcourt, 'halfcourt', ['half-court']),
  ...map(passpro, 'passpro', ['pass-pro'], 'pass-rush'),
  // (the backer against the run: Stuff the Run's camera, from five yards further back)
  ...map(hitstick, 'hitstick', ['hit-stick'], 'run-stuff'),
  // the kicker: the field goals from behind the holder (the passing games' camera, to the end zone), the onside kick in close
  ...map(kick, 'kick', ['deep-kick', 'game-winner'], 'acc'),
  ...map(kick, 'kick', ['onside'], 'release'),
  // soccer (lib/mg/soccer.js draws them all: a camera in metres, on a real pitch)
  ...map(penalty, 'penalty', ['penalty']),
  ...map(oneonone, 'oneonone', ['one-on-one']),
  ...map(header, 'header', ['header']),
  ...map(volley, 'volley', ['volley']),
  ...map(sprint30, 'dash', ['sprint30']),
  ...map(slalom, 'slalom', ['slalom']),
  ...map(finishing, 'finishing', ['finishing']),
  ...map(freekick, 'freekick', ['free-kick']),
  ...map(counter, 'counter', ['two-on-one']),
  ...map(firsttouch, 'firsttouch', ['first-touch']),
  // baseball: the hitter's at-bats and his showcase's batting practice; the pitcher's; the steal; the 60; the arm
  ...map(atbat, 'atbat', ['at-bat', 'walk-off', 'exit-velo']),
  ...map(pitchGame, 'pitch', ['strike-out', 'escape-jam', 'pitch-velo', 'spin', 'bullpen']),
  ...map(steal, 'steal', ['steal-second']),
  ...map(dash60, 'dash', ['sixty']),
  ...map(ofarm, 'ofarm', ['arm-strength']),
}
export const engineFor = game => ENGINES[game] ?? null
export const GAME_IDS = Object.keys(ENGINES)
// the games played on a court
// the games played on a pitch: the striker's key moments and his academy trial
export const SOCCER_GAMES = new Set(['penalty', 'one-on-one', 'header', 'volley', 'sprint30', 'slalom', 'finishing', 'free-kick', 'two-on-one', 'first-touch'])
// the games played at the ballpark: the batter's and the pitcher's key moments and their showcase
export const BASEBALL_GAMES = new Set(['at-bat', 'walk-off', 'steal-second', 'strike-out', 'escape-jam', 'sixty', 'exit-velo', 'arm-strength', 'pitch-velo', 'spin', 'bullpen'])
export const BUCKET_GAMES = new Set(['pnr', 'rim-protect', 'iso', 'post-up', 'clutch-shot', 'free-throws', 'spot', 'vert', 'board', 'sprint', 'lane', 'nbench', 'lockdown', 'fast-break', 'alley-oop', 'half-court'])
