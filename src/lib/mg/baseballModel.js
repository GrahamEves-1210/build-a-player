// The baseball games' models, with nothing drawn: the pitch (a real arsenal, its flight), the swing (the timing, the
// contact zone, what comes off the bat), what a ball in play turns into, the runs it brings in, and the hitter's call on a
// pitch when you're the one throwing it. lib/mg/baseball.js draws them (and re-exports all of this); the Simple games
// (components/app/MiniGameSimpleBaseball.jsx) play by them too, without the canvas art.
import { clamp, lerp } from './kit.js'

export const RUBBER = 18.44, MOUND_H = 0.254, BASE = 27.43
export const PLATE_Z = 0.2, ZONE = { x0: -0.25, x1: 0.25, y0: 0.48, y1: 1.08 }
export const FT = 0.3048
// the fence by the angle off dead centre (degrees, -45 the left-field line, 45 the right): 330 down the lines, 375 in
// the alleys, 400 to centre, in feet
export const fenceFt = phi => 400 - 70 * Math.pow(Math.min(1, Math.abs(phi) / 45), 1.4)
const hashOf = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h }

// ── The pitch ───────────────────────────────────────────────────────────────
// A pitcher's real stuff, from his grades (0-11, the data's attrs): the four-seamer's velocity and ride off Velocity
// and Movement, the slider's sweep off Breaking Ball, the changeup's fade and its gap off the heater off Changeup.
// Real numbers: a B fastball sits about 95, an S one 99-100; a slider 8-10 under it with 5-15 inches of sweep; a
// changeup 8-11 under with arm-side fade. throws 'R' or 'L' (arm side is the third-base side for a right-hander).
export const PITCH_INFO = {
  FB: { name: 'FASTBALL', short: 'FB', col: '#f2f2ee' },
  SL: { name: 'SLIDER', short: 'SL', col: '#f2c21b' },
  CH: { name: 'CHANGEUP', short: 'CH', col: '#6cc4ef' },
}
export const PITCH_KEYS = ['FB', 'SL', 'CH']
export function arsenalOf(attrs, v = 6, throws = 'R') {
  const g = k => clamp((attrs?.[k] ?? v) / 11, 0, 1)
  const arm = throws === 'L' ? 1 : -1
  const fb = lerp(89.5, 99.5, g('velocity'))
  return {
    hand: throws === 'L' ? -1 : 1, throws,
    FB: { mph: fb, M: { x: arm * lerp(0.05, 0.19, g('movement')), y: lerp(0, 0.12, g('movement')) }, A: 0.1, q: (g('velocity') * 0.6 + g('movement') * 0.4) },
    SL: { mph: fb - lerp(10.5, 7.5, g('breaking')), M: { x: -arm * lerp(0.12, 0.38, g('breaking')), y: -lerp(0.06, 0.18, g('breaking')) }, A: 0.14, q: g('breaking') },
    CH: { mph: fb - lerp(7, 11, g('changeup')), M: { x: arm * lerp(0.07, 0.21, g('changeup')), y: -lerp(0.14, 0.3, g('changeup')) }, A: 0.17, q: g('changeup') },
    control: g('control'), command: g('command'), composure: g('composure'), iq: g('pitchIQ'), gb: g('groundball'),
  }
}
// the game clock runs the ball in at half its real pace (a 95 fastball is 0.39 s to the plate, here 0.78): the speeds
// and the gaps between them stay real
export const PITCH_SLOW = 2.0
export const REL_Z = RUBBER - 1.85
// p: { type, mph, rel {x, y, z}, to {x, y}, M {x, y}, A } → its flight time in ms
export const flightMs = p => ((p.rel.z - PLATE_Z) / (p.mph * 0.44704)) * 1000 * PITCH_SLOW
// Where the ball is, f of the way (0 the release, 1 crossing the plate, on to the catcher at about 1.06): it starts
// out on the line to where it would go without its spin, and the break takes it late
export function pitchPath(p, f) {
  const g = Math.min(f, 1.08)
  const x = lerp(p.rel.x, p.to.x - p.M.x, g) + p.M.x * g * g
  const y = lerp(p.rel.y, p.to.y - p.M.y, g) + p.M.y * g * g + p.A * 4 * g * (1 - g)
  const z = lerp(p.rel.z, PLATE_Z, g)
  return { x, y: Math.max(0.05, y), z }
}
export const inZone = (x, y, edge = 0) => Math.abs(x) <= ZONE.x1 + edge && y >= ZONE.y0 - edge && y <= ZONE.y1 + edge
// how far out of the zone (0 in it), metres
export const offZone = (x, y) => Math.max(0, Math.abs(x) - ZONE.x1, ZONE.y0 - y, y - ZONE.y1)
const gaussOf = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export const gauss = gaussOf
// What a pitcher's going for and what he gets: aim {x, y} at the plate, sd the miss (metres)
export function locate(aim, sd, r) { return { x: aim.x + gaussOf(r) * sd, y: aim.y + gaussOf(r) * sd * 0.85 } }

// ── The swing ───────────────────────────────────────────────────────────────
// Two swings: CONTACT (a bigger zone, shorter, less behind it: protect the plate) and POWER (a smaller zone, a tighter
// window, more coming off the bat). The zone (the PCI) is the part of the barrel he's putting on it: lined up on the
// ball it's square, over the top of it he beats it into the ground, under it he gets under it.
export const SWINGS = {
  contact: { label: 'CONTACT', pci: 1.28, ev: -7, la: -3, win: 1.15, ms: 135 },
  power: { label: 'POWER', pci: 0.84, ev: 5, la: 5, win: 0.86, ms: 155 },
}
// a hitter's tools from his grade (1-11): the zone's radius (m), the timing window either side of square (ms of the
// game's clock), the most he can hit it (mph), when he picks up the spin (the share of the flight)
export function hitterOf(v) {
  const t = clamp((v - 1) / 10, 0, 1)
  return { R: lerp(0.1, 0.17, t), win: lerp(36, 66, t), evMax: lerp(99, 114, t), read: lerp(0.62, 0.24, t), t }
}
// The contact, at the moment the bat gets there. e: ms late (+) or early (-) against the ball arriving; ball, pci: {x, y}
// at the plate; hand 1 a right-handed hitter. Returns { kind: 'whiff' | 'tip' | 'foul' | 'play', ev, la, phi, q }
// two: two strikes (a CONTACT swing with two strikes is choked up: a bigger zone, a touch longer to decide, less behind it)
export function contactOf(sw, H, ball, pci, e, hand, mph, r, two = false) {
  const S = SWINGS[sw] ?? SWINGS.contact, choke = two && sw !== 'power', R = H.R * S.pci * (choke ? 1.16 + 0.14 * H.t : 1), W = H.win * S.win * (choke ? 1.1 + 0.12 * H.t : 1)
  const d = Math.hypot(ball.x - pci.x, (ball.y - pci.y) * 1.08) / R, tq = Math.abs(e) / W
  if (d > 1.18 || tq > 2.5) return { kind: 'whiff', q: 0, d, tq }
  if (d > 1 || tq > 2.0) return d <= 1.18 && tq < 1.5 ? { kind: 'tip', q: 0, d, tq } : { kind: 'whiff', q: 0, d, tq }
  if (tq > 1.5) return { kind: 'foul', q: 0, d, tq, phi: (e < 0 ? -1 : 1) * hand * 60, la: 25 }
  const q = clamp((1 - Math.pow(d, 1.6)) * (1 - 0.38 * tq * tq), 0, 1)
  if (q < 0.1) return { kind: 'foul', q, d, tq, phi: (e < 0 ? -1 : 1) * hand * 50, la: 40 }
  const la = 18 + 40 * ((ball.y - pci.y) / R) + S.la + (ball.y - 0.78) * 12 + gaussOf(r) * 6
  const ev = lerp(60, H.evMax + S.ev - (choke ? 3 : 0), Math.pow(q, 0.7)) + (mph - 90) * 0.15 + gaussOf(r) * 2.2
  const phi = hand * (e / W) * 24 + ball.x * 45 + gaussOf(r) * 9
  if (Math.abs(phi) > 45) return { kind: 'foul', q, d, tq, phi, la, ev }
  return { kind: 'play', ev, la: clamp(la, -35, 75), phi, q, d, tq }
}
// how far it carries, in metres (100 mph at 28 degrees is about 395 feet; the drag takes more off the harder ones)
export function carryM(ev, la) {
  if (la <= 0) return 0
  const k = 395 * (ev / 100) ** 2 * Math.sin(Math.PI * clamp(la, 0, 56) / 56) * (1 - (ev - 100) * 0.0055)
  return Math.max(la > 56 ? 18 + (80 - Math.min(80, la)) * 0.6 : 0, k * FT)
}
// What a ball in play turns into, with the men on base doing what real runners do. bb: { ev, la, phi, q }; bases: { on:
// [1st, 2nd, 3rd], outs, dp (the chance a grounder with a force on is turned into two), send (the winning run in the
// ninth: the coach waves everything home) }. Returns { kind 'HR' '3B' '2B' '1B' 'GO' 'FC' 'DP' 'LO' 'FO' 'SF' 'PO', runs,
// outs (made on the play), out (the hitter's out), dist (m), at {x, z}, hang (s), word (the stamp), call (the broadcaster's
// line, saying what the runners did) }.
//   forces   with them loaded and less than two out, a grounder goes home for the force (home to first for two when it's
//            hit hard enough); a man on first and less than two out is a double-play ball
//   third    a man on third who isn't forced: the infield's in, late and close, and he goes on a grounder only when it's
//            slow enough; a fly ball deep enough with less than two out, he tags and scores
//   two out  everybody runs on contact: a single scores the man from second, a double the man from first, most times
//   the end  a third out on a force or on the hitter means no run counts
const FIELD = { SS: 'short', '2B': 'second', '3B': 'third', '1B': 'first', P: 'the mound' }
const HOME_TWO = { P: '1-2-3', '1B': '3-2-3', '2B': '4-2-3', SS: '6-2-3', '3B': '5-2-3' }
const TURN_TWO = { P: '1-6-3', '1B': '3-6-3', '2B': '4-6-3', SS: '6-4-3', '3B': '5-4-3' }
export function inPlay(bb, r, bases = { on: [false, false, false], outs: 0 }) {
  const { ev, la, phi } = bb
  // (squared up, it's hit where they aren't more often: q, the contact's quality, when the swing says)
  const sq = bb.q != null ? Math.max(0, bb.q - 0.45) : 0, up = p => p + (1 - p) * sq
  const a = phi * Math.PI / 180, fence = fenceFt(phi) * FT, dist = carryM(ev, la)
  const at = d => ({ x: Math.sin(a) * d, z: Math.cos(a) * d })
  const gap = Math.abs(phi) > 12 && Math.abs(phi) < 34, line = Math.abs(phi) >= 36
  const hang = la > 0 ? clamp(2 * (ev * 0.447) * Math.sin(la * Math.PI / 180) / 9.81 * 0.88, 0.3, 7) : 0
  const side = phi < -22 ? 'left' : phi < -8 ? 'left-center' : phi <= 8 ? 'center' : phi <= 22 ? 'right-center' : 'right'
  const inf = phi < -26 ? '3B' : phi < -4 ? 'SS' : phi < 3 ? 'P' : phi < 24 ? '2B' : '1B'
  const out = (kind, word, call, d = dist) => ({ kind, dist: d, at: at(d), hang, word, call, out: true })
  const hit = (kind, word, call, d = dist) => ({ kind, dist: d, at: at(d), hang, word, call, out: false })
  let res
  if (la < 8) {
    const roll = clamp(ev * 0.42, 18, 52)
    // (the infield in, a man on third late: more of them get through)
    const p = (ev >= 100 ? 0.52 : ev >= 93 ? 0.36 : ev >= 85 ? 0.22 : 0.08) + (bases.on[2] && bases.outs < 2 ? 0.06 : 0)
    if (r() < up(p)) res = line && ev >= 96 && r() < 0.4 ? hit('2B', 'DOUBLE', `Down the ${phi < 0 ? 'third' : 'first'}-base line, into the corner`, roll + 30) : hit('1B', 'SINGLE', ev >= 95 ? 'Hard grounder through the hole' : 'Infield single, beat it out', roll)
    else res = out('GO', 'GROUNDED OUT', '', roll * 0.6)
  } else if (la < 24) {
    if (dist >= fence && la >= 17) res = hit('HR', 'HOME RUN', `A line drive, and it's gone to ${side}`)
    else {
      const p = ev >= 97 ? 0.84 : ev >= 90 ? 0.75 : ev >= 82 ? 0.6 : 0.34
      if (r() < up(p)) res = dist >= 72 && (gap || line || dist >= 92) && r() < 0.6 ? (gap && dist >= 100 && r() < 0.15 ? hit('3B', 'TRIPLE', `Split the outfielders, all the way to the wall in ${side}`) : hit('2B', 'DOUBLE', line ? 'Down the line and into the corner' : `Into the gap in ${side}`)) : hit('1B', 'SINGLE', ev >= 92 ? `Lined into ${side}` : `A soft liner, falls in front of ${side === 'center' ? 'the center fielder' : `the ${phi < 0 ? 'left' : 'right'} fielder`}`)
      else res = out('LO', 'LINED OUT', ev >= 98 ? `Scorched, but right at the ${dist > 50 ? 'outfielder' : inf === 'P' ? 'pitcher' : `man at ${FIELD[inf]}`}` : `Lined out to ${dist > 50 ? side : inf === 'P' ? 'the pitcher' : FIELD[inf]}`)
    }
  } else if (la <= 50) {
    if (dist >= fence) res = hit('HR', 'HOME RUN', dist >= fence + 25 ? `Crushed. Deep into the seats in ${side}` : `Deep to ${side}... gone`)
    else if (dist >= fence - 6) res = r() < up(0.55) ? (gap && r() < 0.15 ? hit('3B', 'TRIPLE', `Off the wall in ${side}, and in standing up`) : hit('2B', 'DOUBLE', `Off the wall in ${side}`)) : out('FO', 'FLIED OUT', `Caught at the track in ${side}`)
    else if (dist >= 82 && r() < sq * 1.1) res = hit('2B', 'DOUBLE', `Over the outfielder's head in ${side}`)
    else if (dist < 70 && la < 34 && ev > 74 && r() < 0.34) res = hit('1B', 'SINGLE', 'A bloop, and it drops in')
    else res = out('FO', 'FLIED OUT', dist < 50 ? 'Shallow fly ball, an easy out' : `Fly ball to ${side}, caught`)
  } else res = out('PO', 'POPPED UP', 'Popped up, caught on the infield', Math.min(dist, 30))
  return settle(res, bases, r, inf, ev)
}
// the men on base, on the play
function settle(res, bases, r, inf, ev) {
  const [a, b, c] = bases.on, outs0 = bases.outs ?? 0, two = outs0 >= 2, go = bases.send ? 0.2 : 0, n = a + b + c
  let { kind, word, call } = res, runs = 0, outs = res.out ? 1 : 0
  const where = inf === 'P' ? 'Comebacker to the mound' : `Grounder to ${FIELD[inf]}`
  switch (kind) {
    case 'HR': runs = n + 1; break
    case '3B': runs = n; break
    // (two out, they're running on contact)
    case '2B': runs = c + b + (a && r() < (two ? 0.75 : 0.4) + go ? 1 : 0); break
    case '1B': runs = c + (b && r() < (two ? 0.9 : 0.6) + go ? 1 : 0); break
    case 'GO':
      if (two) { call = `${where}, ${a ? 'the force at second' : 'thrown out at first'} to end the inning`; if (a) kind = 'FC' }
      else if (a && b && c) {
        // them loaded: home for the force; hit hard enough, home to first for two
        if (ev >= 80 && r() < (bases.dp ?? 0.62)) { kind = 'DP'; word = 'DOUBLE PLAY'; outs = 2; call = `${where}, home to first: ${HOME_TWO[inf]}, the double play` }
        else { kind = 'FC'; word = 'FORCE AT HOME'; call = `${where}, the throw home in time for the force` }
      } else if (a && ev >= 78 && r() < (bases.dp ?? 0.62)) {
        kind = 'DP'; word = 'DOUBLE PLAY'; outs = 2; runs = c && outs0 === 0 ? 1 : 0
        call = `${where}: ${TURN_TWO[inf]}, turned two${runs ? ', and the run scores from third' : ''}`
      } else if (c) {
        // a man on third who isn't forced, the infield in: he goes only when it's slow enough
        const scores = r() < 0.35 + go + (ev < 78 ? 0.2 : 0)
        runs = scores ? 1 : 0
        call = scores ? `${where}, the run scores from third as they take the out at ${a ? 'second' : 'first'}` : `${where}, the runner holds at third, out at ${a ? 'second' : 'first'}`
        if (a) kind = 'FC'
      } else if (a) { kind = 'FC'; call = `${where}, the force at second` }
      else call = `${where}, thrown out at first${b ? ', the runner moves up to third' : ''}`
      break
    case 'FO':
      // a man on third, less than two out: deep enough, he tags and scores; too shallow, he stays
      if (c && !two) {
        if ((res.dist ?? 0) >= 72) { kind = 'SF'; word = 'SAC FLY'; runs = 1; call = `${call}, deep enough: the runner tags and scores` }
        else call = call.startsWith('Shallow') ? 'Shallow fly ball, the runner holds at third' : `${call}, too shallow to send him`
      }
      break
    case 'LO': if (n && !two) call = `${call}, the ${n > 1 ? 'runners hold' : 'runner holds'}`; break
    default: break
  }
  // a third out on a force or on the hitter: no run counts
  if (res.out && outs0 + outs >= 3) { runs = 0; if (!/end the inning|double play|turned two/.test(call)) call = `${call} to end the inning` }
  if (runs && !res.out) call = `${call}${two && (b || a) && kind !== 'HR' ? ', running on contact' : ''}: ${runs === 1 ? 'a run scores' : `${runs} runs score`}`
  return { ...res, kind, word, call, runs, outs, out: res.out, outsAfter: outs0 + outs }
}
// runs in on a walk, from the bases: forced home only with them loaded
export function runsOn(kind, bases) {
  const [a, b, c] = bases.on
  return kind === 'BB' && a && b && c ? 1 : 0
}
// The man at the plate, from his grades: how well he sees it (eye: he lays off the chase), puts the bat on it
// (contact, avoidK), what he does with it (power), and his zones: where he hunts the fastball (hot) and where he
// can't get to (cold), the pitch he can't lay off. hand: 'R' or 'L'.
const ZONES = ['up-in', 'up-away', 'down-in', 'down-away', 'middle-in', 'middle-away']
export function batterProfile(attrs, v = 6, bats = 'R', key = '') {
  const g = k => clamp((attrs?.[k] ?? v) / 11, 0, 1)
  const h = hashOf(`${key}|${bats}`)
  const power = g('power'), contact = g('contact'), eye = g('eye'), avoidK = g('avoidK')
  const hot = power > 0.6 ? ['up-in', 'middle-in', 'down-in'][h % 3] : ZONES[h % ZONES.length]
  const cold = { 'up-in': 'down-away', 'middle-in': 'down-away', 'down-in': 'up-away', 'up-away': 'down-in', 'down-away': 'up-in', 'middle-away': 'up-in' }[hot]
  const chases = eye < 0.45 || h % 4 === 0 ? (h % 2 ? 'SL' : 'CH') : null
  const sits = power > 0.55 ? 'FB' : null
  return { power, contact, eye, avoidK, hand: bats === 'L' ? -1 : 1, bats, hot, cold, chases, sits }
}
// which of his zones a spot at the plate is in: up/middle/down and in/away (in: toward him)
export function zoneOf(x, y, hand) {
  const inside = hand > 0 ? x < -0.07 : x > 0.07, away = hand > 0 ? x > 0.07 : x < -0.07
  const v2 = y > 0.88 ? 'up' : y < 0.66 ? 'down' : 'middle'
  return `${v2}-${inside ? 'in' : away ? 'away' : 'mid'}`
}
// The hitter's call on a pitch he sees: swing or take, and if he swings, what happens. pitch: { type, mph, to, q (its
// stuff 0-1), gb (the pitcher's sink) }, count { b, s }, last: the pitch before. Returns { swing, kind: 'ball' |
// 'strike' | 'whiff' | 'foul' | 'play', bb: { ev, la, phi } }
export function batterAI(B, pitch, count, last, r, o = {}) {
  const { x, y } = pitch.to, inz = inZone(x, y, 0.02), dz = offZone(x, y)
  const two = count.s >= 2, z = zoneOf(x, y, B.hand), center = Math.max(0, 1 - Math.hypot(x / 0.25, (y - 0.78) / 0.3))
  // the stuff on it: the pitch itself, and the sequence (a change of speed, a change of eye level, the same pitch twice)
  let stuff = pitch.q * 0.95 + (pitch.perfect ? 0.1 : 0)
  if (last) {
    if (Math.abs(last.mph - pitch.mph) > 6.5) stuff += 0.14
    if (Math.abs(last.to.y - y) > 0.3 || Math.abs(last.to.x - x) > 0.32) stuff += 0.08
    if (last.type === pitch.type && Math.hypot(last.to.x - x, last.to.y - y) < 0.15) stuff -= 0.18
  }
  if (B.chases === pitch.type && !inz) stuff += 0.12
  stuff = clamp(stuff, 0, 1.1)
  let pSwing
  if (inz) {
    pSwing = 0.66 + (two ? 0.24 : 0) + center * 0.14 - (count.b === 3 && count.s === 0 ? 0.55 : 0) + (count.s === 0 && count.b === 0 ? -0.08 : 0)
    if (B.sits === 'FB' && pitch.type === 'FB' && count.b > count.s) pSwing += 0.1
  } else {
    pSwing = (0.36 - 0.22 * B.eye + stuff * 0.2) * Math.exp(-dz / 0.13) * (two ? 1.55 : 1) * (count.b === 3 && count.s === 0 ? 0.15 : 1)
  }
  if (o.protect) pSwing += two && !inz ? 0.08 : 0
  const swing = r() < clamp(pSwing, 0, 0.97)
  if (!swing) {
    // the umpire: the edges are his to call (a framed one goes either way)
    const edge = inZone(x, y, 0.03) && !inZone(x, y, -0.03)
    const strike = edge ? r() < 0.5 : inZone(x, y)
    return { swing: false, kind: strike ? 'strike' : 'ball' }
  }
  const edge = clamp(1 - center, 0, 1)
  const pc = inz ? 0.88 - 0.36 * stuff + 0.13 * B.contact + 0.06 * B.avoidK - edge * 0.1 : 0.64 - 0.38 * stuff + 0.14 * B.contact + 0.06 * B.avoidK - dz * 1.6
  if (r() > clamp(pc, 0.05, 0.97)) return { swing: true, kind: 'whiff' }
  if (r() < 0.36 + edge * 0.16 + (two ? 0.1 : 0) + (!inz ? 0.12 : 0)) return { swing: true, kind: 'foul' }
  // in play: a mistake over the middle gets hit; his hot zone more, his cold one less; good stuff and the edges, weak
  let q = 0.32 + 0.42 * center + 0.2 * B.power - 0.36 * stuff + gaussOf(r) * 0.16 - dz * 1.4
  if (z.startsWith(B.hot.split('-')[0]) && z.endsWith(B.hot.split('-')[1])) q += 0.2
  if (z.startsWith(B.cold.split('-')[0]) && z.endsWith(B.cold.split('-')[1])) q -= 0.16
  q = clamp(q, 0, 1)
  const ev = lerp(64, lerp(100, 113, B.power), q) + gaussOf(r) * 3.5
  const la = lerp(-6, 32, clamp((y - 0.45) / 0.65, 0, 1)) - (pitch.gb ?? 0) * 12 - (pitch.type === 'CH' || pitch.sink ? 4 : 0) + gaussOf(r) * 15
  const inside = B.hand > 0 ? x < 0 : x > 0
  const phi = (inside ? -1 : 1) * B.hand * Math.min(Math.abs(x) * 70, 20) * (inside ? 1 : 0.8) + gaussOf(r) * 17
  return { swing: true, kind: 'play', bb: { ev, la, phi: clamp(phi, -44, 44) }, q }
}

