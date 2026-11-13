// BLACKTOP LIVE: a build's grades (0-11, as Blacktop builds them: { jumpShot: { val }, ... }) as the numbers the
// game runs on. Guards and bigs carry different lists (data/nba-attrs.js, and the shorter live lists), so the
// ratings a build doesn't have are read off the ones it does, the way today's Blacktop does (lib/hoops.js rate()).
// Pure: no DOM, runs in Node.
import { T } from './tune.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const val = (b, k) => { const x = b?.[k]; return x == null ? null : typeof x === 'number' ? x : (x.val ?? null) }
const n = g => 1 - (1 - clamp((g - 1) / 10, 0, 1)) * T.spread   // a grade as 0..1 (an 11 is 1; a 1 is 1 - spread)

// Every rating as 0..1, whichever list the build came from
export function derive(build, pos = 'guard') {
  const big = pos === 'big'
  const g = (k, d = 5) => val(build, k) ?? d
  const js = g('jumpShot'), fin = g('finishing'), spd = g('speed'), bnc = g('bounce'), size = g('size'), iq = g('basketballIQ')
  const clutch = g('clutch', 5.5)
  const play = val(build, 'playmaking'), pas = val(build, 'passing'), hnd = val(build, 'handles')
  const per = val(build, 'perimeterDefense'), int = val(build, 'interiorDefense'), reb = val(build, 'rebounding')
  // a big dribbles as well as he makes plays, a touch worse; a guard without a Passing grade passes on his IQ and handle
  const handles = hnd ?? (play != null ? play * 0.7 + spd * 0.2 : 4)
  const passing = pas ?? play ?? (iq + handles) / 2
  // a big guards the perimeter on his feet, a guard guards the paint on his size
  const perD = per ?? (int != null ? int * 0.45 + spd * 0.35 : 4)
  const intD = int ?? (per != null ? per * 0.4 + size * 0.45 : 4)
  const rebounding = reb ?? (big ? size * 0.5 + bnc * 0.3 + 2 : size * 0.45 + bnc * 0.3)
  const R = {
    big,
    js: n(js), fin: n(fin), pas: n(passing), hnd: n(handles), per: n(perD), int: n(intD), reb: n(rebounding),
    spd: n(spd), bnc: n(bnc), size: n(size), iq: n(iq), clutch: n(clutch),
  }
  // top speed runs on the plain grade (not squeezed by spread): the band itself is narrow on purpose
  const spdRaw = clamp((spd - 1) / 10, 0, 1)
  const top = T.speedMin * (1 + T.speedBand * spdRaw) * (1 - T.sizeSlow * R.size)
  R.top = top                                               // ft/s without the ball
  R.topBall = T.speedMin * (1 + T.speedBand * T.speedBall * spdRaw) * (1 - T.sizeSlow * R.size) * (T.ballSpeed + T.ballSpeedHnd * R.hnd)  // with it
  R.topDef = top * (T.defSpeed + T.defSpeedPer * R.per)     // guarding
  R.mass = 1 + T.massSize * R.size
  R.passSpeed = T.passSpeed + T.passSpeedPas * R.pas
  R.moveCd = T.moveCd - T.moveCdHnd * R.hnd
  R.standReach = T.standReach + T.standReachSize * R.size
  R.jumpReach = R.standReach + T.jumpReach + T.jumpReachBnc * R.bnc
  R.grab = T.grabDist + T.grabReb * R.reb
  return R
}

// The overall today's Blacktop shows (utils/bucketSimulation.js calcBucketOVR, unweighted): 57 at all 1s, 99 at the top
export function ovrOf(build) {
  const vs = Object.keys(build || {}).map(k => val(build, k)).filter(v => v != null)
  if (!vs.length) return 0
  return Math.min(99, Math.round(57 + ((vs.reduce((s, v) => s + v, 0) / vs.length - 1) / 9) * 44))
}

export const GUARD_KEYS = ['jumpShot', 'finishing', 'passing', 'handles', 'perimeterDefense', 'speed', 'bounce', 'size', 'basketballIQ', 'clutch']
export const BIG_KEYS = ['jumpShot', 'finishing', 'rebounding', 'playmaking', 'interiorDefense', 'speed', 'bounce', 'size', 'basketballIQ', 'clutch']
// A flat build: every rating at one grade (fractions allowed: the balance script's tiers), with overrides
export function flatBuild(pos, grade, over = {}) {
  const b = {}
  for (const k of pos === 'big' ? BIG_KEYS : GUARD_KEYS) b[k] = { val: over[k] ?? grade }
  return b
}
