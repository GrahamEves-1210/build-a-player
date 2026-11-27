// BLACKTOP LIVE: a build's grades (0-11, as Blacktop builds them: { jumpShot: { val }, ... }) as the numbers the
// game runs on. Guards and bigs carry different lists (data/nba-attrs.js, and the shorter live lists), so the
// ratings a build doesn't have are read off the ones it does, the way today's Blacktop does (lib/hoops.js rate()).
// Pure: no DOM, runs in Node.
import { T } from './tune.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const val = (b, k) => { const x = b?.[k]; return x == null ? null : typeof x === 'number' ? x : (x.val ?? null) }
// The grade the game plays: a little wider than the letter (T.gradeStretch round a C+), and an S a real step past an
// A+ (T.sKick: the owner, 11-27, "when you get an S in something it should be like 'let's go'")
const eff = g => 6 + (g - 6) * T.gradeStretch + T.sKick * clamp(g - 10, 0, 1)
// a grade as 0..1 (an A+ about 0.94, a 1 is about 1 - spread); an S is past 1
const n = g => 1 - (1 - Math.max(-0.1, (eff(g) - 1) / 10)) * T.spread

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
  const intD = int ?? (per != null ? per * 0.6 + size * 0.3 : 4)
  const rebounding = reb ?? (big ? size * 0.5 + bnc * 0.3 + 2 : size * 0.45 + bnc * 0.3)
  const R = {
    big,
    js: n(js), fin: n(fin), pas: n(passing), hnd: n(handles), per: n(perD), int: n(intD), reb: n(rebounding),
    spd: n(spd), bnc: n(bnc), size: n(size), iq: n(iq), clutch: n(clutch),
  }
  // the body runs on the plain grades (not squeezed by spread): Speed is how fast and how quick he is, Size how
  // heavy and how much slower. With the ball he keeps most of it (Handles keeps more), so a quick handler beats a
  // slow defender and a quick defender stays in front of a slow handler
  // (the plain grade: 0 at a 1, 1 at an A+-and-a-bit, an S past it)
  const raw = g => Math.max(-0.1, (eff(g) - 1) / 10)
  R.S = {}                                                  // the S grades he has (the screen's moment: engine.js)
  for (const [k, v] of [['js', js], ['fin', fin], ['spd', spd], ['bnc', bnc], ['size', size], ['iq', iq], ['clutch', clutch], ['hnd', handles], ['per', perD], ['int', intD], ['reb', rebounding], ['pas', passing]]) if (v >= 10.5) R.S[k] = 1
  const spdRaw = raw(spd), sizeRaw = raw(size)
  const top = T.speedMin * (1 + T.speedBand * spdRaw) * (1 - T.sizeSlow * sizeRaw)
  R.top = top                                               // ft/s without the ball
  R.topBall = top * (T.ballSpeed + T.ballSpeedHnd * R.hnd)  // with it
  const perRaw = raw(perD)
  R.perRaw = perRaw
  R.topDef = top * (T.defSpeed + T.defSpeedPer * perRaw)    // guarding (Perimeter D on the plain grade: feet)
  R.accel = T.accel * (T.accelBase + T.accelSpd * spdRaw) * (1 - T.accelSize * sizeRaw)   // ft/s²
  R.accelDef = R.accel * (T.defAccel + T.defAccelPer * perRaw)                             // ...guarding
  R.mass = 1 + T.massSize * sizeRaw
  R.spdRaw = spdRaw                                         // (the plain grade: how sharp he cuts)
  R.clutchRaw = raw(clutch)
  R.bncRaw = raw(bnc)                                       // (the plain grade: who can dunk)
  R.intRaw = raw(intD); R.sizeRaw = sizeRaw                 // (the plain grades: who blocks shots, over whom)
  R.jsRaw = raw(js)                                         // (the plain grade: how much of a hand a shooter shoots over)
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
