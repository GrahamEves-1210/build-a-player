// Season scenarios: the decisions a season pauses on (app).
//
// Most of them happen INSIDE the next game (lib/gameMoments.js): the last
// drive, their final possession, a blowout's garbage time. The choice decides
// that game, its score and your line in it. The rest, here, are the ones that
// really span weeks: an injury (sit or play hurt), the concussion protocol,
// wear and tear late in the year, the trade deadline, a fired coordinator,
// resting once you've clinched, being benched.
//
// A bank of
// situations, each gated on where the season actually is, so a scenario only
// fires when it makes sense:
//   at     which stretch of the season it can appear: early · mid · late · stretch · playoffs
//   when   a test on the season so far (record, streaks, playoff picture, last game)
//   needs  roles the build must have for the card to mean anything (see ROLE)
//   w      how strongly it wants to be picked when it fits (situational > generic)
//   make   the card: kicker, title, body and 2–3 options
// Every option's fine print is written from its effect (describe), so the text
// can never promise something different from what the option does.
//
// What an effect touches has to make sense: an injury hits the body part it
// is (a hamstring is speed, a throwing shoulder is arm), fatigue hits the legs,
// film hits the head, and nothing in a season changes how big you are. The
// numbers are sized to show up in the games: a stretch is ±2–3 on the traits
// it's about, a permanent change is ±1, a missed game is a game the team plays
// without you.
//
// Effects (applied by seasonDirector.js):
//   attr {trait: ±n}      rest of the season, or `window` games
//   team {off, def}       the team around you
//   sit n                 you miss the next n games
//   then {…}              what happens after the first part runs out (attr/team/sit)
//   gamble {p, hit, miss} each side its own effect plus a `line` for the reveal
//   tag                   the name the affected games carry in the schedule
//   xp                    bonus XP

import { seeded } from './rng'
import { gameMoment } from './gameMoments'

// ── What each kind of event touches, per position ───────────────────────────
//   legs   conditioning: fatigue, rest, fresh legs
//   feel   the touch of the position's main skill: hot and cold stretches
//   mind   reading the game: film, new schemes, distractions
//   nerve  composure: big stages, pressure, mistakes in your head
//   power  the physical part of the craft (strength at contact, arm)
//   make   creating: the plays you make yourself
const ROLE = {
  qb:    { legs: ['legs'], feel: ['accuracy'], mind: ['processing', 'vision'], nerve: ['pocket-presence', 'leadership'], power: ['arm'], make: ['playmaking'] },
  rb:    { legs: ['burst', 'speed'], feel: ['vision', 'elusiveness'], mind: ['vision'], nerve: ['carrying'], power: ['strength', 'balance'], make: ['elusiveness'] },
  wr:    { legs: ['speed', 'release'], feel: ['routeRunning', 'hands'], mind: ['awareness'], nerve: ['hands'], power: ['bodyControl', 'vertical'], make: ['afterCatch'] },
  te:    { legs: ['speed'], feel: ['routeRunning', 'hands'], mind: ['awareness'], nerve: ['hands'], power: ['blocking', 'strength'], make: ['afterCatch'] },
  db:    { legs: ['speed', 'fluidity'], feel: ['manCoverage'], mind: ['zoneIQ', 'playRecognition'], nerve: ['playRecognition'], power: ['runSupport', 'press'], make: ['hands'] },
  ol:    { legs: ['mobility'], feel: ['passPro'], mind: ['blitzPickup', 'discipline'], nerve: ['discipline'], power: ['anchor', 'runBlock'], make: ['pancake'] },
  guard: { legs: ['speed', 'bounce'], feel: ['jumpShot'], mind: ['basketballIQ'], nerve: ['clutch'], power: ['finishing'], make: ['handles', 'passing'] },
  big:   { legs: ['bounce', 'speed'], feel: ['finishing'], mind: ['basketballIQ'], nerve: ['clutch'], power: ['rebounding', 'interiorDefense'], make: ['playmaking'] },
}
// What a season can't change: you don't get taller, longer or bigger mid-year
const FIXED = new Set(['size', 'length'])

// ── Injuries: the body part decides the traits and the timeline ─────────────
//   hit   what playing on it costs   out   games to heal if you sit (football: weeks)
//   hurt  how long it nags if you play on it
const INJURIES = {
  qb: [
    { name: 'Hamstring strain', hit: { legs: -3, playmaking: -2 }, out: 2, hurt: 4 },
    { name: 'High ankle sprain', hit: { legs: -3, 'pocket-presence': -2 }, out: 3, hurt: 4 },
    { name: 'Sore throwing shoulder', hit: { arm: -3, accuracy: -1 }, out: 2, hurt: 4 },
    { name: 'Bruised ribs', hit: { arm: -2, 'pocket-presence': -2 }, out: 1, hurt: 3 },
    { name: 'Sprained thumb on the throwing hand', hit: { accuracy: -3, arm: -1 }, out: 1, hurt: 3 },
  ],
  rb: [
    { name: 'Hamstring strain', hit: { speed: -3, burst: -2 }, out: 2, hurt: 4 },
    { name: 'High ankle sprain', hit: { elusiveness: -3, burst: -2, balance: -1 }, out: 3, hurt: 4 },
    { name: 'Turf toe', hit: { burst: -3, elusiveness: -2 }, out: 2, hurt: 5 },
    { name: 'Sprained shoulder', hit: { strength: -3, carrying: -1 }, out: 2, hurt: 4 },
    { name: 'Broken finger', hit: { hands: -3, carrying: -2 }, out: 1, hurt: 4 },
  ],
  wr: [
    { name: 'Hamstring strain', hit: { speed: -3, release: -2 }, out: 2, hurt: 4 },
    { name: 'Ankle sprain', hit: { routeRunning: -3, bodyControl: -2 }, out: 2, hurt: 3 },
    { name: 'Groin strain', hit: { speed: -2, routeRunning: -2 }, out: 2, hurt: 4 },
    { name: 'Broken finger', hit: { hands: -3 }, out: 1, hurt: 4 },
    { name: 'Separated shoulder', hit: { vertical: -2, bodyControl: -2, hands: -1 }, out: 3, hurt: 4 },
  ],
  te: [
    { name: 'Hamstring strain', hit: { speed: -3, routeRunning: -1 }, out: 2, hurt: 4 },
    { name: 'Sprained shoulder', hit: { blocking: -3, strength: -2 }, out: 2, hurt: 4 },
    { name: 'Ankle sprain', hit: { routeRunning: -2, afterCatch: -2 }, out: 2, hurt: 3 },
    { name: 'Broken finger', hit: { hands: -3 }, out: 1, hurt: 4 },
  ],
  db: [
    { name: 'Hamstring strain', hit: { speed: -3, fluidity: -1 }, out: 2, hurt: 4 },
    { name: 'Groin strain', hit: { fluidity: -3, manCoverage: -2 }, out: 2, hurt: 4 },
    { name: 'Ankle sprain', hit: { fluidity: -2, manCoverage: -2 }, out: 2, hurt: 3 },
    { name: 'Stinger', hit: { runSupport: -3, press: -2 }, out: 1, hurt: 3 },
    { name: 'Broken hand', hit: { hands: -3, press: -1 }, out: 2, hurt: 4 },
  ],
  ol: [
    { name: 'Knee sprain', hit: { mobility: -3, anchor: -2 }, out: 3, hurt: 4 },
    { name: 'Back spasms', hit: { anchor: -3, passPro: -1 }, out: 1, hurt: 3 },
    { name: 'Ankle sprain', hit: { mobility: -3, runBlock: -1 }, out: 2, hurt: 3 },
    { name: 'Hyperextended elbow', hit: { runBlock: -2, pancake: -2, passPro: -1 }, out: 2, hurt: 4 },
  ],
  guard: [
    { name: 'Sprained ankle', hit: { speed: -2, handles: -2, bounce: -1 }, out: 5, hurt: 12 },
    { name: 'Hamstring strain', hit: { speed: -3, bounce: -2 }, out: 7, hurt: 14 },
    { name: 'Sprained shooting wrist', hit: { jumpShot: -3, finishing: -1 }, out: 4, hurt: 15 },
    { name: 'Jammed finger', hit: { handles: -2, jumpShot: -1 }, out: 2, hurt: 8 },
    { name: 'Sore knee', hit: { bounce: -3, finishing: -2 }, out: 6, hurt: 15 },
  ],
  big: [
    { name: 'Sprained ankle', hit: { bounce: -2, interiorDefense: -2 }, out: 5, hurt: 12 },
    { name: 'Sore knee', hit: { bounce: -3, rebounding: -2 }, out: 7, hurt: 15 },
    { name: 'Back spasms', hit: { finishing: -2, rebounding: -2 }, out: 4, hurt: 10 },
    { name: 'Dislocated finger', hit: { jumpShot: -2, finishing: -1 }, out: 2, hurt: 8 },
    { name: 'Plantar fasciitis', hit: { speed: -2, bounce: -2 }, out: 6, hurt: 15 },
  ],
}

// ── Effect → fine print ──────────────────────────────────────────────────────
const sign = n => (n > 0 ? `+${n}` : `−${Math.abs(n)}`)
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s)
export function describe(e, c, scope = '') {
  if (!e || !Object.keys(e).filter(k => k !== 'line' && k !== 'tag').length) return 'Nothing changes.'
  if (e.gamble) {
    const p = Math.round(e.gamble.p * 100)
    return `${p}%: ${lc(describe(e.gamble.hit, c, scope))} · ${100 - p}%: ${lc(describe(e.gamble.miss, c, scope))}`
  }
  const parts = []
  for (const [t, d] of Object.entries(e.attr || {})) if (d) parts.push(`${sign(d)} ${c.L(t)}`)
  if (e.team?.off) parts.push(`team offense ${sign(e.team.off)}`)
  if (e.team?.def) parts.push(`team defense ${sign(e.team.def)}`)
  let s = parts.join(', ')
  if (s && e.window) s += ` for ${e.window} ${e.window === 1 ? 'game' : 'games'}`
  else if (s && !scope) s += ' for the rest of the season'
  if (s && scope) s += ` ${scope}`
  if (e.sit) s += `${s ? '; ' : ''}miss ${e.sit === 1 ? 'the next game' : `the next ${e.sit} games`}`
  if (e.then) s += `${s ? ', then ' : ''}${lc(describe(e.then, c))}`
  if (e.dur) s += `${s ? ' · ' : ''}${sign(e.dur)} durability (for good)`
  if (e.xp) s += `${s ? ' · ' : ''}+${e.xp} XP`
  return cap(s || 'Nothing changes.')
}
const isEmpty = e => !e || !Object.keys(e).filter(k => k !== 'tag').length
const lc = s => (s ? s[0].toLowerCase() + s.slice(1) : s).replace(/\.$/, '')

// ── Context ──────────────────────────────────────────────────────────────────
export function phaseOf(stop) {
  if (stop.kind === 'playoffs') return 'playoffs'
  const f = stop.at / stop.total
  return f < 0.3 ? 'early' : f < 0.55 ? 'mid' : f < 0.8 ? 'late' : 'stretch'
}

function context({ sport, pos, stop, ctx, build, types, attrMap, teamNick, name, seed, team, lastBig, lastBust }) {
  const isBucket = sport === 'bucket'
  const k = ctx.games.length, total = stop.total, left = total - k
  const { wins, losses, streak, skid } = ctx
  const pace = k ? (wins / k) * total : 0
  const needIn = isBucket ? 42 : 9           // a realistic playoff line
  const lock = isBucket ? 50 : 10
  const has = new Set(types)
  const val = t => build?.[t]?.val ?? 5
  const L = t => attrMap?.[t]?.label ?? t
  const trainable = types.filter(t => has.has(t) && !FIXED.has(t))
  const sorted = (list, dir) => [...list].sort((a, b) => dir * (val(b) - val(a)))
  const roles = ROLE[pos] ?? {}
  // the traits of a role this build has (best first), and an effect on them
  const traitsOf = role => sorted((roles[role] ?? []).filter(t => has.has(t)), 1)
  const R = (role, n, k2 = 2) => Object.fromEntries(traitsOf(role).slice(0, k2).map(t => [t, n]))
  const R1 = (role, n) => R(role, n, 1)
  const T = {
    best: not => sorted(trainable, 1).find(t => t !== not) ?? trainable[0],
    worst: not => sorted(trainable, -1).find(t => t !== not) ?? trainable[0],
    has: t => has.has(t),
    one: (...cands) => cands.find(t => has.has(t)) ?? null,
  }
  const r = seeded(`scn-${seed}-${stop.at}`)
  return {
    sport, pos, isBucket, isDef: pos === 'db', isOL: pos === 'ol', stop, k, total, left, wins, losses, streak, skid, pace,
    rec: `${wins}–${losses}`, nick: teamNick, name, T, R, R1, roleHas: role => traitsOf(role).length > 0, L, val, r,
    alive: wins + left >= needIn, clinched: wins >= lock, eliminated: wins + left < needIn,
    bubble: wins + left >= needIn && wins < lock && pace >= needIn - (isBucket ? 8 : 2.5) && pace <= lock + (isBucket ? 4 : 1),
    contender: pace >= (isBucket ? 54 : 11.5), struggling: k >= 3 && pace <= (isBucket ? 33 : 6.5),
    last: ctx.last, lastWon: !!ctx.last?.won, lastBig, lastBust,
    opp: (ctx.last?.opponent || 'them').split(' ').slice(-1)[0],
    side: pos === 'db' ? 'defense' : 'offense', other: pos === 'db' ? 'offense' : 'defense',
    sideKey: pos === 'db' ? 'def' : 'off', otherKey: pos === 'db' ? 'off' : 'def',
    g: n => (isBucket ? Math.max(2, Math.round(n * 4)) : n),        // a football "week" in basketball games
    unitWord: isBucket ? 'games' : 'weeks',
    teamOff: team?.off, teamDef: team?.def,
    // an injury that fits this build: the body part, and only traits the build has
    // (its own seed, so asking twice gives the same injury)
    injury: () => {
      const list = (INJURIES[pos] ?? []).map(i => ({ ...i, hit: Object.fromEntries(Object.entries(i.hit).filter(([t]) => has.has(t))) })).filter(i => Object.keys(i.hit).length)
      return list.length ? list[Math.floor(seeded(`inj-${seed}-${stop.at}`)() * list.length)] : null
    },
  }
}

// option builder: label + effect (+ an optional flavor line before the fine print)
const o = (id, label, effect, flavor) => ({ id, label, effect, flavor })
const gam = (p, hit, hitLine, miss, missLine) => ({ gamble: { p, hit: { ...hit, line: hitLine }, miss: { ...miss, line: missLine } } })
// several trait changes in one: the numbers add up per trait
const mix = (...parts) => parts.reduce((acc, p) => { for (const [t, d] of Object.entries(p || {})) acc[t] = (acc[t] || 0) + d; return acc }, {})
const half = hit => Object.fromEntries(Object.entries(hit).map(([t, d]) => [t, Math.round(d / 2) || -1]))

// ═════════════════════════════════════════════════════════════════════════════
// INJURIES — both sports (the body part decides everything)
// ═════════════════════════════════════════════════════════════════════════════
const INJURY = [
  { id: 'injury', at: ['early', 'mid', 'late', 'stretch'], w: 3, when: c => !!c.injury(),
    make: c => {
      const inj = c.injury()
      const tag = inj.name.toUpperCase()
      const out = inj.out, hurt = Math.min(inj.hurt, Math.max(1, c.left))
      return {
        kicker: 'INJURY REPORT', title: inj.name,
        body: `The trainers say ${c.isBucket ? `${out} games` : out === 1 ? 'a week' : `${out} weeks`} and it heals clean. You can play on it, but it won't be right, and it could get worse.`,
        options: [
          o('sit', 'Sit until it heals', { sit: out, tag }, `The ${c.nick} play without you.`),
          o('play', 'Play through it', gam(0.65, { attr: inj.hit, window: hurt, tag: `PLAYING HURT` }, 'It held. Not right, but you played every snap.',
            { attr: inj.hit, window: 1, tag: 'PLAYING HURT', then: { sit: out + (c.isBucket ? 3 : 1), tag } }, 'It gave out. Now you\'re out longer than if you\'d sat.')),
        ],
      }
    } },
  { id: 'concussion', at: ['early', 'mid', 'late'], w: 1, when: c => !c.isBucket,
    make: c => ({ kicker: 'INJURY REPORT', title: 'In the concussion protocol',
      body: 'A helmet-to-helmet hit on Sunday. You cleared the first tests. The doctors can sign off this week, or hold you one more.',
      options: [
        o('clear', 'Clear it and play', { sit: 1, tag: 'PROTOCOL', then: { attr: c.R('mind', -2), window: 2, tag: 'FOGGY' } }, 'One week out, and the reads come slow for a while.'),
        o('wait', 'Take the extra week', { sit: 2, tag: 'PROTOCOL' }, 'Two weeks out. You come back clear.'),
      ] }) },
  { id: 'wear', at: ['late', 'stretch'], w: 2, when: c => c.alive && c.roleHas('legs'),
    make: c => ({ kicker: 'STRETCH RUN', title: 'The body is wearing down',
      body: `${c.isBucket ? 'Sixty games' : 'Thirteen weeks'} of hits. Nothing's torn, everything hurts. Manage it week to week, or rest now and be right for the playoffs.`,
      options: [
        o('manage', 'Manage it, keep playing', { attr: c.R('legs', -2), tag: 'WORN DOWN' }, 'Slower the rest of the way, playoffs included.'),
        o('rest', 'Rest now', { sit: c.g(1), tag: 'RESTED', then: { attr: c.R('legs', 1) } }, 'A week off, then the legs come back.'),
      ] }) },
]
const PO_INJURY = [
  { id: 'po-hurt', at: ['playoffs'], w: 3, when: c => !!c.injury(),
    make: c => {
      const inj = c.injury()
      return { kicker: 'PLAYOFF INJURY REPORT', title: inj.name,
        body: 'Nobody sits in the playoffs. The question is how you play on it.',
        options: [
          o('straight', 'Play on it, no shortcuts', { attr: half(inj.hit) }, 'Not right, but nothing gets worse.'),
          o('shot', 'Take the shot and go', gam(0.6, {}, 'You felt nothing until Monday.', { attr: inj.hit }, 'It wore off by halftime.')),
        ] }
    } },
]

// ═════════════════════════════════════════════════════════════════════════════
// FOOTBALL — every position
// ═════════════════════════════════════════════════════════════════════════════
const NFL_ALL = [
  { id: 'clinched', at: ['late', 'stretch'], w: 5, when: c => c.clinched && c.left >= 2,
    make: c => ({ kicker: 'CLINCHED', title: 'Rest or keep playing?',
      body: `${c.nick} are in. ${c.left} games left that don't decide much, and every snap is a chance to get hurt before January.`,
      options: [
        o('rest', 'Sit a week, heal up', { sit: 1, tag: 'RESTED', then: { attr: c.R('legs', 1) } }, 'Fresh legs for January.'),
        o('play', 'Keep playing', gam(0.82, {}, 'Played it out, healthy.', { attr: c.R('legs', -2), tag: 'BANGED UP' }, 'Took a hit in a game that didn\'t matter, and you carry it into January.')),
      ] }) },
  { id: 'eliminated', at: ['late', 'stretch'], w: 6, when: c => c.eliminated && c.left >= 2,
    make: c => ({ kicker: 'ELIMINATED', title: 'What the last games are for',
      body: `${c.nick} are out. ${c.left} games left. Play them out for the numbers, or shut it down and get healthy.`,
      options: [
        o('play', 'Play it out', gam(0.85, { xp: 25 }, 'Every snap, healthy. The stats count.', { sit: c.left, dur: -1, tag: 'INJURED' }, 'Hurt in a game that meant nothing. Done for the year, and it follows you into next season.')),
        o('shut', 'Shut it down', { sit: c.left, dur: 0.5, tag: 'SHUT DOWN' }, 'No more games, no more risk. A full offseason to heal.'),
      ] }) },
  { id: 'deadline-buy', at: ['mid'], w: 4, when: c => c.alive && !c.struggling,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'The GM has one pick to spend',
      body: `${c.nick} are buying. The GM asks the leaders what the roster needs most for the stretch.`,
      options: [
        o('rusher', 'A pass rusher', { team: { def: 1.5 } }, 'The defense gets off the field.'),
        o('help', c.isDef ? 'A playmaker on offense' : 'A weapon on offense', { team: { off: 1.5 } }, 'The offense opens up.'),
        o('stand', 'Stand pat, keep the chemistry', { team: { off: 0.5, def: 0.5 } }, 'No new faces. Everyone knows their job.'),
      ] }) },
  { id: 'deadline-sell', at: ['mid'], w: 5, when: c => c.struggling,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'The sell-off',
      body: `${c.nick} are moving veterans for picks. The team gets worse now. Ride it out, or ask to be moved too?`,
      options: [
        o('ride', 'Ride it out', { team: { off: -1.5, def: -1.5 } }, 'A thinner roster the rest of the way.'),
        o('out', 'Ask to be moved too', gam(0.4, { team: { off: -1.5, def: -1.5 }, xp: 40 }, 'They say no, but the front office respects it.', { team: { off: -2, def: -2 }, tag: 'ROOM TURNED' }, 'It leaked. The locker room turns on you.')),
      ] }) },
  { id: 'oc-fired', at: ['mid', 'late'], w: 3, when: c => c.struggling && !c.isDef,
    make: () => ({ kicker: 'STAFF CHANGE', title: 'The coordinator is gone',
      body: 'The play caller was fired on Monday. A new voice, a new install, and no time to learn it.',
      options: [
        o('buy', 'Buy in fast', gam(0.55, { team: { off: 1.5 } }, 'It clicks. The offense looks new.', { team: { off: -1.5 }, window: 3, tag: 'NEW SCHEME', then: { team: { off: 1 } } }, 'Three busted weeks, then it starts to work.')),
        o('keep', 'Lobby to keep the old plays', gam(0.5, { team: { off: 0.5 } }, 'They keep what works. Steadier.', { team: { off: -0.5 } }, 'Half old, half new: nobody knows the plays.')),
      ] }) },
]
const QB = [
  { id: 'qb-benched', at: ['mid', 'late'], w: 5, when: c => c.lastBust && c.skid >= 2,
    make: () => ({ kicker: 'BENCHED', title: 'The coach goes to the backup',
      body: 'Picks and losses. You\'re sitting this week. Take the message, or fight for the job in practice?',
      options: [
        o('accept', 'Take the week', { sit: 1, tag: 'BENCHED' }, 'One week on the sideline, then the job is yours again.'),
        o('fight', 'Fight for the job in practice', gam(0.5, {}, 'You win the room back. You start Sunday.', { sit: 3, tag: 'BENCHED' }, 'The coach doesn\'t budge. Three weeks on the bench.')),
      ] }) },
]
const RB = [], WR = [], TE = [], DB = [], OL = []

// ═════════════════════════════════════════════════════════════════════════════
// FOOTBALL — playoffs (only when you're in)
// ═════════════════════════════════════════════════════════════════════════════
const NFL_PLAYOFFS = [
  { id: 'po-plan', at: ['playoffs'], w: 5, when: () => true,
    make: c => ({ kicker: 'PLAYOFF WEEK', title: 'How do you want to win it?',
      body: 'One-and-done football. The staff asks whether the postseason runs through you, or through the whole roster.',
      options: [
        o('me', 'Through me', { attr: mix(c.R('make', 2), c.R1('feel', 1)), team: { [c.otherKey]: -1 } }, 'Your best football. The other side of the ball is exposed.'),
        o('control', 'Ball control, field position', { team: { def: 1.5 }, attr: c.R('make', -2) }, 'Fewer chances, fewer mistakes.'),
        o('all', 'Everyone, all in', { team: { off: 1, def: 1 }, xp: 25 }, 'Balanced. Boring. Dangerous.'),
      ] }) },
]

// ═════════════════════════════════════════════════════════════════════════════
// BASKETBALL
// ═════════════════════════════════════════════════════════════════════════════
const NBA_ALL = [
  { id: 'nba-deadline', at: ['mid', 'late'], w: 3, when: c => c.alive,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'The front office calls', body: `${c.nick} can rent a star for the stretch run with next year's picks, or hold the roster.`,
      options: [
        o('rental', 'Rent a star', { team: { off: 2 } }, 'A second scorer the rest of the way.'),
        o('depth', 'Add a defender', { team: { def: 1.5 } }, 'Stops in the fourth quarter.'),
        o('pat', 'Stand pat', { team: { off: 0.5, def: 0.5 } }, 'Chemistry intact.'),
      ] }) },
  { id: 'nba-clinched', at: ['late', 'stretch'], w: 5, when: c => c.clinched && c.left >= 5,
    make: c => ({ kicker: 'CLINCHED', title: 'Rest for the playoffs?', body: `${c.nick} have a playoff spot. ${c.left} games left.`,
      options: [
        o('rest', 'Load management', { sit: 4, tag: 'LOAD MANAGEMENT', then: { attr: c.R('legs', 1) } }, 'Four nights off. Fresh for the playoffs.'),
        o('seed', 'Chase the top seed', gam(0.8, {}, 'Played every night, healthy.', { attr: c.R('legs', -2), tag: 'BANGED UP' }, 'Banged up in a game that didn\'t matter. You carry it into the playoffs.')),
      ] }) },
  { id: 'nba-eliminated', at: ['late', 'stretch'], w: 6, when: c => c.eliminated && c.left >= 4,
    make: c => ({ kicker: 'OUT OF IT', title: 'Play out the string', body: `${c.nick} won't make it. ${c.left} games left.`,
      options: [
        o('play', 'Play it out', gam(0.85, { xp: 25 }, 'Every game, healthy. The numbers count.', { sit: c.left, dur: -1, tag: 'INJURED' }, 'Hurt in a meaningless game. Done for the year, and it follows you into next season.')),
        o('shut', 'Shut it down', { sit: c.left, dur: 0.5, tag: 'SHUT DOWN' }, 'Healthy into the summer. A full offseason to heal.'),
      ] }) },
]
const GUARD = [], BIG = []
const NBA_PLAYOFFS = [
  { id: 'nbapo-takeover', at: ['playoffs'], w: 2, when: () => true,
    make: c => ({ kicker: 'BEFORE THE PLAYOFFS', title: 'The second season', body: 'The stage gets bigger. How do you want to play the postseason?',
      options: [
        o('takeover', 'Take over', { attr: mix(c.R('make', 2), c.R1('feel', 1)), team: { def: -1 } }, 'Your usage through the roof; the defense pays.'),
        o('steady', 'Trust the system', { team: { off: 1, def: 1 } }, 'Five guys, one plan.'),
      ] }) },
  { id: 'nbapo-minutes', at: ['playoffs'], w: 2, when: c => c.roleHas('legs'),
    make: c => ({ kicker: 'PLAYOFF MINUTES', title: '44 minutes a night?', body: 'The coach asks if you can handle more minutes.',
      options: [
        o('more', 'Play me 44', { attr: mix(c.R1('make', 2), c.R('legs', -2)) }, 'More of you, on tired legs.'),
        o('normal', 'Normal minutes', { team: { off: 1 } }, 'The bench keeps you fresh.'),
      ] }) },
]

const BANK = {
  nfl: { all: [...NFL_ALL, ...INJURY], qb: QB, rb: RB, wr: WR, te: TE, db: DB, ol: OL, playoffs: [...NFL_PLAYOFFS, ...PO_INJURY] },
  bucket: { all: [...NBA_ALL, ...INJURY.filter(s => s.id !== 'concussion')], guard: GUARD, big: BIG, playoffs: [...NBA_PLAYOFFS, ...PO_INJURY] },
}
// How many scenarios each position can draw from (for the record)
export const bankSize = (sport, pos) => (BANK[sport]?.all.length ?? 0) + (BANK[sport]?.[pos]?.length ?? 0) + (BANK[sport]?.playoffs.length ?? 0)

// Recently seen scenarios rotate to the back so seasons don't repeat
const RECENT_KEY = 'bap_scn_recent'
const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] } }
const remember = id => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recent().filter(x => x !== id)].slice(0, 30))) } catch {} }

// An option that does nothing for this build (its traits aren't in it) says so
const hollow = e => {
  if (!e) return true
  if (e.gamble) return hollow(e.gamble.hit) && hollow(e.gamble.miss)
  return !Object.values(e.attr || {}).some(Boolean) && !e.team?.off && !e.team?.def && !e.sit && !e.xp && !e.dur && hollow(e.then)
}

// Picks the scenario for a stop (or null). `used` = ids already shown this season.
export function pickScenario(args) {
  const { sport, pos, stop, used = new Set(), next = null } = args
  const c = context(args)
  const ph = phaseOf(stop)
  const bank = BANK[sport]
  if (!bank) return null
  // the next game turns on a moment: most of the time, that's the decision
  if (ph !== 'playoffs' && next) {
    const gm = gameMoment(c, next)
    if (gm && c.r() < 0.8) return { id: gm.id, inGame: true, kicker: gm.kicker, title: gm.title, body: gm.body, options: gm.options }
  }
  const pool = ph === 'playoffs' ? bank.playoffs : [...bank.all, ...(bank[pos] ?? [])]
  const seen = recent()
  const fits = pool.filter(s => s.at.includes(ph) && !used.has(s.id) && (() => { try { return s.when(c) } catch { return false } })())
  if (!fits.length) return null
  const weight = s => (s.w ?? 1) * (seen.includes(s.id) ? 0.25 + 0.75 * (seen.indexOf(s.id) / 30) : 1)
  // a card is only worth showing if at least two of its choices actually do something
  const real = s => { try { return s.make(c).options.filter(op => !hollow(op.effect) || op.id === 'cover' || op.id === 'no').length >= 2 } catch { return false } }
  const usable = fits.filter(real)
  if (!usable.length) return null
  const total = usable.reduce((a, s) => a + weight(s), 0)
  let roll = c.r() * total, pick = usable[0]
  for (const s of usable) { roll -= weight(s); if (roll <= 0) { pick = s; break } }
  let card
  try { card = pick.make(c) } catch { return null }
  const scope = ph === 'playoffs' ? 'for the playoffs' : ''
  remember(pick.id)
  return {
    id: pick.id, kicker: card.kicker, title: card.title, body: card.body,
    options: card.options.map(op => ({ id: op.id, label: op.label, sub: isEmpty(op.effect) ? (op.flavor || 'Nothing changes.') : [op.flavor, describe(op.effect, c, scope)].filter(Boolean).join(' '), effect: op.effect })),
  }
}
