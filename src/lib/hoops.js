// Streetball engine: N-on-N (1v1, 2v2, 3v3), seeded so every client in a room
// plays back the identical game from one seed. Grown from the head-to-head
// rules — 1s inside, 2s from the arc, make-it-take-it, check ball — with
// passing, matchups, blocks, steals and rebounds once there's more than one
// player a side. Every play carries what the court needs to animate it: who
// started with the ball, each pass, the shooter's defender, the shot type.
//
//   const game = simStreetball({ teams: [[p, p, p], [p, p, p]], seed, goal: 21 })
//   p = { id, name, pos: 'guard' | 'big', build: { attr: { val } }, role?: 'score' | 'play' | 'lock' }
//   game.plays = [{ id, type, team, pid, pid2, defId, handler, passes, shot, made, pts, text, score, big, poss }]
//   game.stats[pid] = { pts, fgm, fga, tpm, tpa, ast, reb, oreb, stl, blk, tov }

import { seeded } from './rng'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const v = (b, k, d = 5) => (b?.[k]?.val ?? d)

// ── Play text ────────────────────────────────────────────────────────────────
const T = {
  arc:      ['{n} pulls up — TWO!', '{n} step-back — SPLASH!', '{n} fires — GOOD!', '{n} spots up — TWO!', '{n} lets it fly — WET!'],
  arca:     ['{a} finds {n} — TWO!', '{a} kicks it out, {n} — SPLASH!', '{a} swings it, {n} fires — GOOD!', '{n} off the dish from {a} — TWO!'],
  dunk:     ['{n} SLAMS it home!', '{n} THROWS IT DOWN!', '{n} skies — FINISH!', '{n} HAMMERS IT!'],
  dunka:    ['{a} lobs it — {n} THROWS IT DOWN!', '{a} drops it off, {n} SLAMS!', '{a} to {n} — ALLEY-OOP!'],
  post:     ['{n} backs it down — bucket.', '{n} hook shot — one.', '{n} drop step — one.', '{n} fadeaway — ONE.'],
  mid:      ['{n} — mid range.', '{n} pull-up — one.', '{n} hits the mid.', '{n} elbow J — one.'],
  layup:    ['{n} with the layup.', '{n} floats it in.', '{n} off the glass.', '{n} finger roll — one.', '{n} scoops it up.'],
  layupa:   ['{a} finds {n} cutting — one.', '{a} threads it, {n} lays it in.', '{a} drops it to {n} — bucket.'],
  drive:    ['{n} gets to the rim — one.', '{n} blows by {d} — one.', '{n} beats {d} off the dribble.', '{n} to the rack — one.'],
  drivea:   ['{a} hits {n} on the move — one.', '{a} to {n} — straight to the rim.'],
  miss:     ['{n} misses.', '{n} rattles out.', "{n} can't convert.", '{n} — short.', '{n} off the iron.', '{d} contests — no good.'],
  miss2:    ['{n} — step-back no good.', '{n} from deep — off.', '{n} pull-up rattles out.', '{n} fires — no.', '{d} runs {n} off the line — miss.'],
  block:    ['{d} REJECTS {n}!', '{d} PINS IT on {n}!', '{d} — MASSIVE SWAT!', '{d} STUFFS {n}!'],
  steal:    ['{d} picks {n}\'s pocket!', '{d} reads it — STEAL!', '{d} swipes it from {n}!', '{d} jumps the lane!'],
  oreb:     ['{n} cleans the glass — second chance.', '{n} tips it out — ball stays.', '{n} skies for the board.'],
  dreb:     ['{n} grabs the rebound.', '{n} boxes out and secures it.', '{n} pulls it down.'],
  check:    ['Check ball.', 'Ball checked up.', 'Back to the top.', 'Check.'],
}
const say = (r, key, names) => T[key][Math.floor(r() * T[key].length)].replace(/\{n\}/g, names.n).replace(/\{a\}/g, names.a ?? '').replace(/\{d\}/g, names.d ?? '')

// ── Player ratings from a build ──────────────────────────────────────────────
function rate(p) {
  const b = p.build || {}
  const g = p.pos !== 'big'
  const role = p.role || 'balanced'
  const handles = g ? v(b, 'handles') : v(b, 'playmaking')
  const pass = g ? (v(b, 'basketballIQ') + handles) / 2 : (v(b, 'playmaking') + v(b, 'basketballIQ')) / 2
  const off = g
    ? v(b, 'finishing') * .24 + handles * .22 + v(b, 'speed') * .18 + v(b, 'jumpShot') * .16 + v(b, 'bounce') * .12 + v(b, 'basketballIQ') * .08
    : v(b, 'finishing') * .28 + v(b, 'size') * .20 + v(b, 'playmaking') * .18 + v(b, 'bounce') * .16 + v(b, 'jumpShot') * .10 + v(b, 'speed') * .04 + v(b, 'interiorDefense') * .02 + v(b, 'basketballIQ') * .02
  const def = g ? v(b, 'perimeterDefense') : v(b, 'interiorDefense')
  return {
    off, pass,
    sp:    clamp((off - 1) / 10 * .38 + .33, .30, .72),                        // base make rate
    arc:   clamp((v(b, 'jumpShot') - 3) / 8 * .44 + .08, .03, .52),            // how often they shoot from the arc
    usage: (handles * .3 + v(b, 'finishing') * .3 + v(b, 'jumpShot') * .2 + v(b, 'bounce') * .1 + v(b, 'speed') * .1) * (role === 'score' ? 1.35 : role === 'play' ? .8 : role === 'lock' ? .85 : 1),
    passProb: clamp(.16 + (pass - 4) / 7 * .26 + (role === 'play' ? .18 : role === 'score' ? -.08 : 0), .08, .62),
    stl:   g ? clamp(def / 11 * .07, 0, .07) : clamp((v(b, 'speed') + def) / 22 * .05, 0, .05),
    blk:   clamp((v(b, 'size') + def) / 22 * .10, 0, .14),
    reb:   v(b, 'size') * .5 + v(b, 'bounce') * .3 + (b.rebounding ? v(b, 'rebounding') * .4 : 0) + (g ? 0 : 1.5),
    lock:  role === 'lock' ? 1.25 : 1,
    size: v(b, 'size'), speed: v(b, 'speed'), bounce: v(b, 'bounce'), fin: v(b, 'finishing'), js: v(b, 'jumpShot'), big: !g, iq: v(b, 'basketballIQ'),
  }
}

function weightedPick(r, items, weight) {
  const total = items.reduce((s, x) => s + weight(x), 0)
  let t = r() * total
  for (const x of items) { t -= weight(x); if (t <= 0) return x }
  return items[items.length - 1]
}

// Who guards whom: bigs on bigs, guards on guards, a 'lock' takes the top scorer
function matchup(def, att, attacker) {
  const lock = def.find(p => p.R.lock > 1)
  if (lock && attacker === att.reduce((a, b) => (b.R.usage > a.R.usage ? b : a))) return lock
  const same = def.filter(p => p.R.big === attacker.R.big)
  const pool = same.length ? same : def
  return pool[att.indexOf(attacker) % pool.length]
}

// Shot type from the shooter's game and whether it was set up
function shotType(r, R, isArc, assisted) {
  if (isArc) return 'arc'
  const dunkP = clamp((R.bounce - 1) * (R.fin - 1) / 80 * .68, 0, .62)
  const postP = R.big ? clamp((R.size - 2) / 9 * .55 + .15, .15, .65) : clamp((R.size - 6) / 5 * .15, 0, .13)
  const midP = clamp((R.js - 4) / 7 * .24, 0, .24)
  const driveP = clamp((R.speed + R.fin - 8) / 14 * .4, .05, .45)
  const x = r()
  if (x < dunkP) return 'dunk'
  if (x < dunkP + midP) return 'mid'
  if (x < dunkP + midP + postP) return 'post'
  if (!assisted && r() < driveP) return 'drive'
  return 'layup'
}

export function simStreetball({ teams, seed = 'x', goal = 21, winBy = 2, cap = 25, names = null }) {
  const r = seeded(`hoops-${seed}`)
  const sides = teams.map((list, ti) => list.map((p, i) => ({ ...p, team: ti, slot: i, R: rate(p) })))
  const stats = {}
  for (const s of sides) for (const p of s) stats[p.id] = { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ast: 0, reb: 0, oreb: 0, stl: 0, blk: 0, tov: 0 }
  // who guards whom this game (fixed assignments, 'lock' overrides at the play)
  const guards = {}
  for (let ti = 0; ti < 2; ti++) for (const p of sides[ti]) guards[p.id] = matchup(sides[1 - ti], sides[ti], p).id
  const score = [0, 0]
  const plays = []
  let id = 0
  let poss = r() < .5 ? 0 : 1
  const push = (type, p) => { const play = { id: id++, type, pts: 0, big: false, ...p, score: [...score], poss }; plays.push(play); return play }
  const over = () => (score[0] >= cap || score[1] >= cap) || ((score[0] >= goal || score[1] >= goal) && Math.abs(score[0] - score[1]) >= winBy)
  const milestones = new Set()
  let check = push('check', { team: poss, text: say(r, 'check', {}) })
  let carrier = null    // who ends up with the ball before the next possession (rebounder / stealer)

  let guard = 0
  while (!over() && guard++ < 400) {
    const att = sides[poss], def = sides[1 - poss]
    const handler = weightedPick(r, att, p => p.R.usage)
    if (check) { check.handler = handler.id; check.carrier = carrier && att.some(p => p.id === carrier) ? carrier : null; check = null }
    const entry = carrier && att.some(p => p.id === carrier) && carrier !== handler.id ? carrier : null   // rebounder/stealer feeds the handler
    carrier = null
    let shooter = handler, passes = []
    let d = matchup(def, att, handler)

    // steal on the catch / first dribble
    if (r() < d.R.stl * d.R.lock * (att.length > 1 ? .9 : 1)) {
      stats[d.id].stl++; stats[handler.id].tov++
      push('steal', { team: 1 - poss, pid: d.id, pid2: handler.id, handler: handler.id, entry, text: say(r, 'steal', { n: handler.name, d: d.name }) })
      carrier = d.id
      poss = 1 - poss
      check = push('check', { team: poss, text: say(r, 'check', {}) })
      continue
    }
    // pass to a teammate — sometimes two passes around the horn
    if (att.length > 1 && r() < handler.R.passProb) {
      const mates = att.filter(p => p !== handler)
      let last = handler
      const hops = att.length > 2 && r() < .35 ? 2 : 1
      for (let h = 0; h < hops; h++) {
        const options = att.filter(p => p !== last)
        const to = weightedPick(r, options, p => p.R.fin + p.R.js + (p.R.big ? 1 : 0) + (p === handler ? -2 : 0))
        passes.push(to.id); last = to
      }
      shooter = last
      d = matchup(def, att, shooter)
      void mates
    }
    const assist = passes.length ? att.find(p => p.id === (passes.length > 1 ? passes[passes.length - 2] : handler.id)) : null
    const R = shooter.R
    const sizeEdge = (R.size - d.R.size) / 22, speedEdge = (R.speed - d.R.speed) / 22
    const isArc = r() < R.arc * (passes.length ? 1.15 : 1)
    const shot = shotType(r, R, isArc, passes.length > 0)
    const spArc = clamp(R.sp + (passes.length ? .05 : 0) - Math.max(0, (d.R.lock - 1) * .08), .25, .8)
    const spIn = clamp(R.sp + Math.max(0, sizeEdge) * (.38 + Math.max(0, sizeEdge) * .7) + Math.max(0, speedEdge) * .18 + (passes.length ? .07 : 0) + (shot === 'dunk' ? .08 : 0) - Math.max(0, (d.R.lock - 1) * .06), .25, .9)
    stats[shooter.id].fga++
    if (isArc) stats[shooter.id].tpa++
    const common = { handler: handler.id, passes, defId: d.id, entry, shot }

    // block
    if (!isArc && r() < d.R.blk * (1 + Math.max(0, -sizeEdge) * 1.5) * (shot === 'dunk' ? .7 : 1)) {
      stats[d.id].blk++
      push('block', { team: 1 - poss, pid: d.id, pid2: shooter.id, ...common, text: say(r, 'block', { n: shooter.name, d: d.name }), big: true })
      // the block goes out or is scooped — 50/50 who ends up with it
      const keep = r() < .5
      if (!keep) { carrier = d.id; poss = 1 - poss } else carrier = handler.id
      check = push('check', { team: poss, text: say(r, 'check', {}) })
      continue
    }
    if (r() < (isArc ? spArc : spIn)) {
      const pts = isArc ? 2 : 1
      score[poss] += pts
      stats[shooter.id].pts += pts; stats[shooter.id].fgm++
      if (isArc) stats[shooter.id].tpm++
      if (assist && assist.id !== shooter.id) stats[assist.id].ast++
      const key = assist ? (T[`${shot}a`] ? `${shot}a` : shot) : shot
      const big = shot === 'dunk' || shot === 'post'
      push('score', { team: poss, pid: shooter.id, pid2: assist?.id, ...common, made: true, pts, text: say(r, key, { n: shooter.name, a: assist?.name, d: d.name }), big, arc: isArc })
      // milestones
      const s = score[poss]
      const ms = s >= goal - 1 && !milestones.has(`${poss}-gp`) ? `GAME POINT — ${teamLabel(sides, poss, names)} needs ONE!`
        : s === Math.floor(goal / 2) && !milestones.has(`${poss}-half`) ? `${teamLabel(sides, poss, names)} to ${s} — halfway there.`
        : null
      if (ms) { milestones.add(s >= goal - 1 ? `${poss}-gp` : `${poss}-half`); push('milestone', { team: poss, text: ms, big: s >= goal - 1 }) }
      if (over()) break
      carrier = shooter.id
      check = push('check', { team: poss, text: say(r, 'check', {}) })      // make it, take it
      continue
    }
    // miss → rebound
    push('miss', { team: poss, pid: shooter.id, pid2: assist?.id, ...common, made: false, text: say(r, isArc ? 'miss2' : 'miss', { n: shooter.name, d: d.name }), arc: isArc })
    const offReb = att.reduce((s, p) => s + p.R.reb, 0), defReb = def.reduce((s, p) => s + p.R.reb * 1.35, 0)
    if (att.length > 1 && r() < offReb / (offReb + defReb) * .9) {
      const rb = weightedPick(r, att, p => p.R.reb)
      stats[rb.id].reb++; stats[rb.id].oreb++
      push('oreb', { team: poss, pid: rb.id, text: say(r, 'oreb', { n: rb.name }) })
      carrier = rb.id
    } else {
      const rb = weightedPick(r, def, p => p.R.reb)
      stats[rb.id].reb++
      poss = 1 - poss
      if (def.length > 1) push('dreb', { team: poss, pid: rb.id, text: say(r, 'dreb', { n: rb.name }) })
      carrier = rb.id
      check = push('check', { team: poss, text: say(r, 'check', {}) })
    }
  }
  const winner = score[0] > score[1] ? 0 : 1
  const mvp = sides[winner].map(p => ({ p, line: stats[p.id] })).sort((a, b) => (b.line.pts * 1 + b.line.ast * .8 + b.line.reb * .5 + b.line.stl * 1.2 + b.line.blk * 1.2) - (a.line.pts * 1 + a.line.ast * .8 + a.line.reb * .5 + a.line.stl * 1.2 + a.line.blk * 1.2))[0]?.p ?? null
  return { plays, stats, score, winner, mvp: mvp?.id ?? null, sides, guards }
}

function teamLabel(sides, ti, names) {
  if (names?.[ti]) return names[ti]
  const s = sides[ti]
  return s.length === 1 ? s[0].name : `Team ${s[0].name.split(' ')[0]}`
}

// Time to linger on a play in a live ticker (the court's choreography fits inside it)
export function playDelay(p, first = false) {
  if (first) return 2600
  if (p.type === 'check') return 1500
  if (p.type === 'milestone') return p.big ? 1500 : 1100
  const passes = (p.passes?.length ?? 0) * 520 + (p.entry ? 420 : 0)
  if (p.type === 'score') return (p.pts === 2 ? 1900 : 1700) + passes
  if (p.type === 'miss') return 1700 + passes
  if (p.type === 'block') return 1800 + passes
  if (p.type === 'steal') return 1500 + (p.entry ? 420 : 0)
  if (p.type === 'oreb' || p.type === 'dreb') return 1300
  return 1100
}

// A versus-style build from a roster player's attributes (the city's star in
// Takeover, or a bot): every attribute the player has, as a chip they "own".
export function buildFromPlayer(player, types, photo = null) {
  const out = {}
  for (const t of types) {
    out[t] = {
      type: t, val: player.attrs?.[t] ?? 5,
      qb: player.short || player.name, qbFull: player.name, team: player.team,
      teamColor: player.color, teamColor2: player.color2, number: player.number ?? null,
      skinColor: player.skin ?? null, faceCenter: player.faceCenter ?? null, photo,
    }
  }
  return out
}
