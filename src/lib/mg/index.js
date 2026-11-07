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
import { useCamera } from './art.js'

// (make sets the game's camera first, so the layout it works out goes through the same one as the picture.
// cam: another game's camera, for a game shot the same way: Pass Pro is Pass Rush from the other side)
const withBot = (mod, botName, cam = null) => ({ ...mod, botName, make: o => { useCamera(cam ?? o.game); return mod.make(o) } })
const map = (mod, botName, ids, cam = null) => Object.fromEntries(ids.map(id => [id, withBot(mod, botName, cam)]))
export const ENGINES = {
  ...map(catchGame, 'catch', ['gauntlet', 'catch', 'release']),
  ...map(read, 'read', ['hot-read', 'gap', 'jump-route', 'pnr', 'rim-protect']),
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
}
export const engineFor = game => ENGINES[game] ?? null
export const GAME_IDS = Object.keys(ENGINES)
// the games played on a court
export const BUCKET_GAMES = new Set(['pnr', 'rim-protect', 'iso', 'post-up', 'clutch-shot', 'free-throws', 'spot', 'vert', 'board', 'sprint', 'lane', 'nbench', 'lockdown', 'fast-break', 'alley-oop', 'half-court'])
