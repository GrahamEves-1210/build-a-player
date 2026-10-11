// Season scenarios: the decisions a season pauses on (app). A bank of
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
  // ── Where the season is ──────────────────────────────────────────────────
  { id: 'hot-start', at: ['early'], w: 4, when: c => c.losses === 0 || c.wins - c.losses >= 2,
    make: c => ({ kicker: `${c.rec} START`, title: 'The league noticed',
      body: `${c.nick} are the early story and your name is in every segment. Ride the wave, or keep the noise out of the building?`,
      options: [
        o('ride', 'Ride the wave', gam(0.55, { attr: mix(c.R('feel', 2), c.R1('make', 1)), window: 4, xp: 30, tag: 'ON A HEATER' }, 'You feed off it. Four big weeks.', { attr: c.R('mind', -2), window: 3, tag: 'DISTRACTED' }, 'The noise got in. Three sloppy weeks.')),
        o('ground', 'Nothing is won in September', { attr: c.R1('mind', 1) }, 'Steady all year.'),
      ] }) },
  { id: 'early-hole', at: ['early', 'mid'], w: 4, when: c => c.skid >= 2 || c.losses - c.wins >= 2,
    make: c => ({ kicker: c.rec, title: 'The coach wants an answer',
      body: `${c.nick} are in a hole. The staff can simplify the whole ${c.side} and lean on the roster, or hand you the keys and live with the risk.`,
      options: [
        o('simple', 'Simplify it, trust the roster', { team: { [c.sideKey]: 1.5 }, attr: c.R('make', -2), window: 4, tag: 'SIMPLIFIED' }, 'A cleaner unit. Fewer plays for you.'),
        o('keys', 'Put it on me', { attr: mix(c.R('make', 2), c.R1('feel', 1)), team: { [c.otherKey]: -1 }, window: 4, tag: 'ON YOUR BACK' }, 'Your production spikes. The other side of the ball is on the field a lot.'),
      ] }) },
  { id: 'skid-meeting', at: ['mid', 'late'], w: 4, when: c => c.skid >= 3,
    make: c => ({ kicker: `${c.skid} STRAIGHT LOSSES`, title: 'Players-only meeting',
      body: `${c.skid} straight and the cameras are waiting outside the locker room. A veteran asks if you'll stand up and say something.`,
      options: [
        o('call', 'Call the meeting', gam(0.6, { team: { off: 1, def: 1 } }, 'It lands. The room is yours for the rest of the year.', { team: { off: -1, def: -1 }, window: 3, tag: 'LOCKER ROOM RIFT' }, 'It got personal. Three ugly weeks.')),
        o('coach', 'Let the coach handle it', { attr: c.R1('mind', 1), window: 3, tag: 'HEAD DOWN' }, 'Head down, do your job.'),
      ] }) },
  { id: 'heater', at: ['mid', 'late', 'stretch'], w: 4, when: c => c.streak >= 4 && c.roleHas('legs'),
    make: c => ({ kicker: `${c.streak} IN A ROW`, title: 'Don\'t change a thing?',
      body: 'The coach wants every routine kept the same. The trainers want to pull back your practice reps before something gives.',
      options: [
        o('same', 'Keep everything the same', gam(0.65, { attr: c.R('feel', 2), window: 3, tag: 'ROLLING' }, 'The streak rolls on.', { sit: 1, tag: 'SOFT-TISSUE INJURY', then: { attr: c.R('legs', -2), window: 2, tag: 'PLAYING HURT' } }, 'Something gave. A week out, and slow when you come back.')),
        o('pull', 'Pull back the reps', { attr: c.R('legs', 1), team: { [c.sideKey]: -0.5 }, window: 3, tag: 'LIGHT PRACTICE' }, 'Fresh, but the unit loses a little rhythm.'),
      ] }) },
  { id: 'bubble', at: ['late', 'stretch'], w: 5, when: c => c.bubble,
    make: c => ({ kicker: 'ON THE BUBBLE', title: 'Every snap decides it',
      body: `${c.rec}. The playoff line runs right through ${c.nick}. The coach asks how you want the last stretch called.`,
      options: [
        o('ball', 'Give me the ball', { attr: mix(c.R('make', 2), c.R1('feel', 1)), window: 2, tag: 'ON YOUR BACK', then: { attr: c.R('legs', -2), window: 2, tag: 'RUNNING ON EMPTY' } }, 'Two huge games, then the tank runs low.'),
        o('roster', 'Trust the whole roster', { team: { off: 1, def: 1 }, window: 3, tag: 'EVERYONE EATS' }, 'Everyone eats.'),
      ] }) },
  { id: 'clinched', at: ['late', 'stretch'], w: 5, when: c => c.clinched && c.left >= 2,
    make: c => ({ kicker: 'CLINCHED', title: 'Rest or rhythm?',
      body: `${c.nick} are in. ${c.left} games left that don't decide much, and the staff asks what you want.`,
      options: [
        o('rest', 'Sit a week, heal up', { sit: 1, tag: 'RESTED', then: { attr: c.R('legs', 1) } }, 'Fresh legs for January.'),
        o('rhythm', 'Keep playing', gam(0.8, { attr: c.R1('feel', 1) }, 'Sharp and healthy into January.', { attr: c.R('legs', -2), tag: 'BANGED UP' }, 'Took a hit in a game that didn\'t matter. You carry it into January.')),
      ] }) },
  { id: 'eliminated', at: ['late', 'stretch'], w: 6, when: c => c.eliminated,
    make: c => ({ kicker: 'ELIMINATED', title: 'What the last games are for',
      body: `${c.nick} are out. The last ${c.left} games are about you now: the tape, the body, or the contract.`,
      options: [
        o('weak', 'Work on the weak spot', { attr: { [c.T.worst()]: 2 } }, 'Real reps on the thing that\'s been holding you back.'),
        o('showcase', 'Showcase for the money', gam(0.55, { attr: mix(c.R('feel', 2), c.R1('make', 1)), xp: 30, tag: 'SHOWCASE' }, 'A statement finish. Every GM saw it.', { attr: c.R('legs', -2), window: 2, tag: 'PLAYING HURT' }, 'Pushed too hard for nothing.')),
        o('shut', 'Shut it down', { sit: Math.min(2, c.left), xp: 10, tag: 'SHUT DOWN' }, 'Healthy into the offseason.'),
      ] }) },
  // ── The football calendar ────────────────────────────────────────────────
  { id: 'bye-week', at: ['early', 'mid'], w: 3, when: () => true,
    make: c => ({ kicker: 'BYE WEEK', title: 'A week with no game',
      body: 'Seven days. Rest the body, live in the film room, or grind the one thing that isn\'t good enough yet.',
      options: [
        o('rest', 'Rest and recover', { attr: c.R('legs', 2), window: 3, tag: 'FRESH LEGS' }, 'The body comes back right.'),
        o('film', 'Film room all week', { attr: c.R('mind', 2), window: 3, tag: 'FILM ROOM' }, 'You see it before it happens.'),
        o('grind', 'Grind the weak spot', { attr: { [c.T.worst()]: 1 } }, 'A small step that sticks.'),
      ] }) },
  { id: 'deadline-buy', at: ['mid'], w: 4, when: c => c.alive && !c.struggling,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'The GM has one pick to spend',
      body: `${c.nick} are buying. The GM asks the leaders what the roster needs most for the stretch.`,
      options: [
        o('rusher', 'A pass rusher', { team: { def: 1.5 } }, 'The defense gets off the field.'),
        o('help', c.isDef ? 'A playmaker on offense' : 'Help around me', { team: { off: 1.5 } }, 'The offense opens up.'),
        o('stand', 'Stand pat, keep the chemistry', { team: { [c.sideKey]: 0.5 }, attr: c.R1('mind', 1) }, 'No new faces. Everyone knows their job.'),
      ] }) },
  { id: 'deadline-sell', at: ['mid'], w: 5, when: c => c.struggling,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'The sell-off',
      body: `${c.nick} are moving veterans for picks. The team gets worse now; the ${c.side} runs through you.`,
      options: [
        o('carry', 'Carry it', { attr: mix(c.R('make', 2), c.R1('feel', 1)), team: { off: -1.5, def: -1.5 } }, 'Thinner roster, more of the ball for you.'),
        o('out', 'Ask to be moved too', gam(0.4, { xp: 40, attr: c.R1('mind', 1) }, 'They say no, but the front office hears you. Respect.', { team: { [c.sideKey]: -1.5 }, window: 3, tag: 'ROOM TURNED' }, 'It leaked. The room turns on you for three weeks.')),
      ] }) },
  { id: 'oc-fired', at: ['mid', 'late'], w: 2, when: c => c.struggling && !c.isDef,
    make: c => ({ kicker: 'STAFF CHANGE', title: 'The coordinator is gone',
      body: 'The play caller was fired on Monday. A new voice, a new install, and no time to learn it.',
      options: [
        o('buy', 'Buy in fast', gam(0.55, { team: { off: 1.5 } }, 'It clicks. The offense looks new.', { team: { off: -1.5 }, window: 3, tag: 'NEW SCHEME', then: { team: { off: 1 } } }, 'Three busted weeks, then it starts to work.')),
        o('mine', 'Run what I know', { attr: c.R1('feel', 2), team: { off: -0.5 }, window: 3, tag: 'FREELANCING' }, 'You keep your rhythm; the scheme waits.'),
      ] }) },
  { id: 'rival', at: ['mid', 'late', 'stretch'], w: 2, when: c => c.alive,
    make: c => ({ kicker: 'DIVISION GAME', title: 'The one that decides the division',
      body: 'A rival with the same record. Win and you hold the tiebreaker; lose and you chase them in December.',
      options: [
        o('circle', 'Sell out for this one', gam(0.55, { attr: mix(c.R('feel', 3), c.R1('make', 2)), team: { [c.sideKey]: 1 }, window: 1, xp: 35, tag: 'RIVALRY' }, 'Your best game of the year.', { attr: c.R('nerve', -3), window: 1, tag: 'RIVALRY' }, 'Too amped. It got away from you.')),
        o('next', 'Just another game', { attr: c.R1('mind', 1), window: 1, tag: 'RIVALRY' }, 'Calm. Prepared.'),
      ] }) },
  { id: 'primetime', at: ['mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'SUNDAY NIGHT', title: 'The whole country is watching',
      body: 'The lights, the crowd, every highlight show. Some players get bigger here.',
      options: [
        o('show', 'Put on a show', gam(0.5, { attr: mix(c.R('feel', 3), c.R1('make', 2)), window: 1, xp: 40, tag: 'PRIMETIME' }, 'A night they\'ll replay for years.', { attr: c.R('nerve', -3), window: 1, tag: 'PRIMETIME' }, 'The moment ate you.')),
        o('simple', 'Keep it simple', { attr: c.R1('mind', 1), window: 1, tag: 'PRIMETIME' }, 'Nothing flashy. Nothing wrong.'),
      ] }) },
  { id: 'cold', at: ['late', 'stretch'], w: 2, when: c => !c.isDef && !c.isOL,
    make: c => ({ kicker: 'DECEMBER FOOTBALL', title: 'Wind, cold, and a run-heavy plan',
      body: 'Single digits and a crosswind. The staff wants to shorten the game and play field position.',
      options: [
        o('control', 'Ball control', { team: { def: 1 }, attr: c.R('make', -2), window: 1, tag: 'SNOW GAME' }, 'Fewer chances for you, a rested defense.'),
        o('rip', 'Let it rip anyway', gam(0.45, { attr: c.R('feel', 2), window: 1, tag: 'SNOW GAME' }, 'The weather didn\'t matter.', { attr: c.R('feel', -3), window: 1, tag: 'SNOW GAME' }, 'Nothing went where it was supposed to.')),
      ] }) },
  // ── The business ─────────────────────────────────────────────────────────
  { id: 'contract-year', at: ['early'], w: 3, when: () => true,
    make: c => ({ kicker: 'CONTRACT YEAR', title: 'Play for the numbers, or the team?',
      body: 'No extension yet. Your agent wants volume and highlights. The coach wants a player who makes everyone better.',
      options: [
        o('numbers', 'Play for the numbers', { attr: c.R('make', 2), team: { [c.sideKey]: -1 } }, 'Big stat line. The unit gets worse around you.'),
        o('team', 'Team first', { team: { [c.sideKey]: 1 }, xp: 40 }, 'The tape shows a leader.'),
      ] }) },
  { id: 'captain', at: ['early'], w: 2, when: () => true,
    make: c => ({ kicker: 'CAPTAINS VOTE', title: 'The team voted you captain',
      body: 'A C on the chest: the room looks at you first after every loss.',
      options: [
        o('accept', 'Wear the C', { attr: c.R1('nerve', 1), team: { [c.sideKey]: 1 }, xp: 30 }, 'The unit plays harder for you.'),
        o('defer', 'Let a veteran have it', { attr: { [c.T.worst()]: 1 } }, 'Quiet year. More time on your own game.'),
      ] }) },
  { id: 'award-watch', at: ['mid', 'late', 'stretch'], w: 4, when: c => c.contender && c.lastBig,
    make: c => ({ kicker: 'AWARD WATCH', title: 'Your name is in the race',
      body: 'Chasing the numbers helps the case. Balance wins games. The coach leaves it to you.',
      options: [
        o('chase', 'Chase the award', { attr: c.R('make', 2), team: { [c.otherKey]: -1 } }, 'The stat line of your life; the other side of the ball pays.'),
        o('team', 'Win first', { team: { [c.sideKey]: 1 } }, 'Let the record make the case.'),
      ] }) },
]

// ═════════════════════════════════════════════════════════════════════════════
// FOOTBALL — by position
// ═════════════════════════════════════════════════════════════════════════════
const QB = [
  { id: 'qb-air', at: ['early', 'mid'], w: 4, when: () => true,
    make: () => ({ kicker: 'GAME PLAN', title: 'Push the ball, or take what they give',
      body: 'The coordinator asks how far down the field you want to live. Deep shots pay, and they turn the ball over.',
      options: [
        o('deep', 'Push it down the field', { attr: { arm: 2, playmaking: 2, accuracy: -2 }, window: 4, tag: 'AIR IT OUT' }, 'Big plays, more picks.'),
        o('short', 'Quick game, high percentage', { attr: { accuracy: 2, 'pocket-presence': 1, playmaking: -2 }, window: 4, tag: 'QUICK GAME' }, 'Clean, efficient, fewer fireworks.'),
      ] }) },
  { id: 'qb-audible', at: ['early', 'mid'], w: 3, when: c => c.val('processing') >= 6,
    make: c => ({ kicker: 'THE LINE OF SCRIMMAGE', title: 'Full control at the line',
      body: 'The coach offers you the freedom to change any play you don\'t like. Great quarterbacks win with it. The rest get benched by it.',
      options: [
        o('take', 'Take the keys', gam(0.4 + (c.val('processing') - 5) * 0.06, { attr: { processing: 1, vision: 1 }, team: { off: 1 } }, 'You see everything. The offense is yours.', { attr: { processing: -2, vision: -2 }, window: 3, tag: 'WRONG CHECKS' }, 'Three weeks of wrong checks.')),
        o('pass', 'Run the play that\'s called', { attr: { accuracy: 1 }, window: 3 }, 'Less to think about.'),
      ] }) },
  { id: 'qb-runs', at: ['early', 'mid', 'late'], w: 3, when: c => c.val('legs') >= 7,
    make: () => ({ kicker: 'DESIGNED RUNS', title: 'The coach wants your legs in the plan',
      body: 'Zone reads and draws every week. It\'s the best thing you do, and it\'s how quarterbacks get hurt.',
      options: [
        o('run', 'Put the runs in', gam(0.75, { attr: { legs: 2, playmaking: 2 }, window: 4, tag: 'ZONE READS' }, 'Defenses can\'t account for you.', { attr: { legs: 2, playmaking: 2 }, window: 2, tag: 'ZONE READS', then: { sit: 2, tag: 'TOOK A HIT' } }, 'Two weeks of highlights, then a hit that costs you two games.')),
        o('pocket', 'Stay in the pocket', { attr: { 'pocket-presence': 1, processing: 1 }, window: 4, tag: 'POCKET PASSER' }, 'Boring and healthy.'),
      ] }) },
  { id: 'qb-line', at: ['mid', 'late'], w: 3, when: () => true,
    make: () => ({ kicker: 'INJURY REPORT', title: 'Two starters on the line are out',
      body: 'Backups at tackle and guard for a month. Get the ball out fast, or hold it and trust yourself.',
      options: [
        o('quick', 'Get it out fast', { attr: { accuracy: 1, playmaking: -2 }, window: 4, tag: 'BACKUP LINE' }, 'Short throws, clean jersey.'),
        o('hold', 'Hold it, make plays', gam(0.6, { attr: { playmaking: 2, 'pocket-presence': -1 }, window: 4, tag: 'BACKUP LINE' }, 'Big plays, and you got up every time.', { attr: { playmaking: 2 }, window: 2, tag: 'BACKUP LINE', then: { sit: 1, tag: 'BLINDSIDED' } }, 'A blindside hit costs you a game.')),
      ] }) },
  { id: 'qb-wr-down', at: ['mid'], w: 3, when: () => true,
    make: () => ({ kicker: 'INJURY REPORT', title: 'Your top receiver is out for the year',
      body: 'A torn hamstring in practice. The offense loses its best weapon; someone has to get those targets.',
      options: [
        o('spread', 'Spread it around', { team: { off: -1 }, window: 3, tag: 'NO WR1', then: { attr: { vision: 1 } } }, 'A step back for a few weeks; you learn the whole room.'),
        o('force', 'Make the new guy a star', gam(0.5, { attr: { playmaking: 1 }, team: { off: -0.5 } }, 'He steps up. New favorite target.', { attr: { accuracy: -2, processing: -1 }, team: { off: -1 }, window: 3, tag: 'FORCING IT' }, 'Forced throws, bad decisions.')),
      ] }) },
  { id: 'qb-benched', at: ['mid', 'late'], w: 5, when: c => c.lastBust && c.skid >= 2,
    make: () => ({ kicker: 'BENCHED', title: 'The coach goes to the backup',
      body: 'Picks and losses. You\'re sitting this week. Take the message, or fight for the job in practice.',
      options: [
        o('accept', 'Take the week, reset', { sit: 1, tag: 'BENCHED', then: { attr: { processing: 2, accuracy: 1 }, window: 3, tag: 'RESET' } }, 'A week on the sideline clears the head.'),
        o('fight', 'Fight for the job', gam(0.5, { attr: { accuracy: 2, leadership: 1 }, window: 3, tag: 'WON IT BACK' }, 'You win the room back. You start Sunday.', { sit: 3, tag: 'BENCHED' }, 'The coach doesn\'t budge. Three weeks on the bench.')),
      ] }) },
]
const RB = [
  { id: 'rb-workhorse', at: ['early', 'mid'], w: 4, when: () => true,
    make: () => ({ kicker: 'SNAP COUNT', title: 'Twenty-five carries a game?',
      body: 'The coach wants to feed you. The trainers remind everyone what 400 touches does to a back by December.',
      options: [
        o('feed', 'Feed me', gam(0.7, { attr: { vision: 2, carrying: 1 }, window: 4, tag: 'WORKHORSE', then: { attr: { burst: -2, speed: -1 }, tag: 'HEAVY LEGS' } }, 'A month of volume, then the legs feel it for good.', { attr: { vision: 2 }, window: 2, tag: 'WORKHORSE', then: { sit: 2, tag: 'HAMSTRING' } }, 'The volume caught up with you: two games out.')),
        o('committee', 'Share the load', { attr: { burst: 1 }, team: { off: 0.5 } }, 'Fresh all year. Fewer touches.'),
      ] }) },
  { id: 'rb-pass', at: ['early', 'mid'], w: 3, when: () => true,
    make: () => ({ kicker: 'ROLE', title: 'The passing game wants you',
      body: 'More routes out of the backfield. Catches and yards, but fewer carries between the tackles.',
      options: [
        o('yes', 'Make me a weapon', { attr: { hands: 2, elusiveness: 1, strength: -1 }, window: 4, tag: 'SPLIT OUT' }, 'Catches pile up. Less pounding inside.'),
        o('no', 'Keep me between the tackles', { attr: { strength: 1, balance: 1 }, window: 4, tag: 'DOWNHILL' }, 'Downhill every week.'),
      ] }) },
  { id: 'rb-fumbles', at: ['mid', 'late'], w: 5, when: c => (c.last?.fumbles ?? 0) >= 1,
    make: () => ({ kicker: 'BALL SECURITY', title: 'Another one on the ground',
      body: 'The coach stops practice to talk about it. High and tight all week, or keep running loose and free.',
      options: [
        o('tight', 'High and tight', { attr: { carrying: 2, elusiveness: -1 }, window: 4, tag: 'HIGH AND TIGHT' }, 'The ball stays put. A little less wiggle.'),
        o('free', 'Run free, trust it', gam(0.5, { attr: { elusiveness: 1 } }, 'No more fumbles. Confidence back.', { attr: { carrying: -2 }, window: 2, tag: 'FUMBLES', then: { sit: 1, tag: 'BENCHED' } }, 'Two more on the ground, then the bench.')),
      ] }) },
  { id: 'rb-line', at: ['mid', 'late'], w: 3, when: () => true,
    make: () => ({ kicker: 'INJURY REPORT', title: 'The line is banged up',
      body: 'Backups on the right side for a month. Be patient behind them, or hit the hole before it closes.',
      options: [
        o('patient', 'Patience, let it develop', { attr: { vision: 2, burst: -1 }, team: { off: -1 }, window: 4, tag: 'BACKUP LINE' }, 'You find the cutbacks.'),
        o('hit', 'Hit it fast', { attr: { burst: 2, vision: -1 }, team: { off: -1 }, window: 4, tag: 'BACKUP LINE' }, 'Quick to the hole, hit or miss.'),
      ] }) },
]
const WR = [
  { id: 'wr-targets', at: ['early', 'mid'], w: 4, when: () => true,
    make: () => ({ kicker: 'TARGET SHARE', title: 'Demand the ball?',
      body: 'Twelve targets a game makes a star. It also makes a quarterback force throws the whole offense pays for.',
      options: [
        o('hog', 'Demand the ball', { attr: { routeRunning: 2, afterCatch: 1 }, team: { off: -1 }, window: 4, tag: 'TARGET HOG' }, 'Your numbers jump. The offense gets predictable.'),
        o('share', 'Spread it around', { team: { off: 1 } }, 'A better offense. Fewer looks.'),
      ] }) },
  { id: 'wr-bracket', at: ['mid', 'late'], w: 4, when: c => c.lastBig,
    make: () => ({ kicker: 'BRACKETED', title: 'They\'re doubling you now',
      body: 'A corner and a safety on every snap. Beat it with releases and precision, or be the decoy that opens everyone else.',
      options: [
        o('beat', 'Beat the double', gam(0.5, { attr: { release: 2, routeRunning: 2 }, window: 3, tag: 'DOUBLED' }, 'You beat it. Nobody can cover you.', { attr: { hands: -1, afterCatch: -2 }, window: 3, tag: 'DOUBLED' }, 'Contested every time. Three quiet weeks.')),
        o('decoy', 'Be the decoy', { team: { off: 1.5 }, attr: { afterCatch: -2 }, window: 3, tag: 'DECOY' }, 'The offense explodes around you.'),
      ] }) },
  { id: 'wr-backup-qb', at: ['mid', 'late'], w: 3, when: () => true,
    make: () => ({ kicker: 'INJURY REPORT', title: 'The backup quarterback is starting',
      body: 'Your starter is out a month. The backup can\'t hit the deep ball. Shorten the route tree, or keep running it and hope.',
      options: [
        o('short', 'Shorten the routes', { attr: { hands: 1, awareness: 1, vertical: -2 }, team: { off: -1 }, window: 4, tag: 'BACKUP QB' }, 'Catches keep coming. Nothing deep.'),
        o('deep', 'Keep the deep tree', gam(0.4, { attr: { vertical: 2 }, team: { off: -1 }, window: 4, tag: 'BACKUP QB' }, 'He gets you the ball. Big month.', { attr: { routeRunning: -2, hands: -1 }, team: { off: -1 }, window: 4, tag: 'BACKUP QB' }, 'Overthrows and underthrows all month.')),
      ] }) },
  { id: 'wr-drops', at: ['early', 'mid', 'late'], w: 5, when: c => c.lastBust,
    make: () => ({ kicker: 'THE DROPS', title: 'Two in the fourth quarter',
      body: 'Every highlight show has them. Live on the JUGS machine, or refuse to think about it.',
      options: [
        o('jugs', 'JUGS machine every day', { attr: { hands: 2, afterCatch: -1 }, window: 3, tag: 'JUGS MACHINE' }, 'Catch everything. Fewer plays after.'),
        o('shake', 'Shake it off', gam(0.5, { attr: { hands: 1, awareness: 1 }, window: 3 }, 'Back to normal.', { attr: { hands: -3 }, window: 2, tag: 'IN YOUR HEAD' }, 'It\'s in your head now.')),
      ] }) },
]
const TE = [
  { id: 'te-block', at: ['early', 'mid'], w: 4, when: () => true,
    make: () => ({ kicker: 'ROLE', title: 'The coach needs a blocker',
      body: 'The tackles are struggling. Stay in and block, or split out and be a receiver first.',
      options: [
        o('block', 'Stay in and block', { team: { off: 1 }, attr: { routeRunning: -2, afterCatch: -1 }, window: 4, tag: 'IN-LINE' }, 'The quarterback stays clean. Your targets drop.'),
        o('split', 'Split me out', { attr: { routeRunning: 2, afterCatch: 1 }, team: { off: -1 }, window: 4, tag: 'SPLIT OUT' }, 'A receiver\'s month. The pocket pays.'),
      ] }) },
  { id: 'te-bracket', at: ['mid', 'late'], w: 3, when: c => c.lastBig,
    make: () => ({ kicker: 'DOUBLE COVERED', title: 'A linebacker and a safety',
      body: 'They\'ve made you the priority. Win anyway, or be the decoy that frees the outside receivers.',
      options: [
        o('win', 'Win anyway', { attr: { strength: 2, hands: 1 }, window: 3, tag: 'DOUBLED' }, 'Contested catches, box-outs.'),
        o('decoy', 'Open it up for the others', { team: { off: 1.5 }, attr: { afterCatch: -2 }, window: 3, tag: 'DECOY' }, 'The offense hums around you.'),
      ] }) },
  { id: 'te-drops', at: ['early', 'mid', 'late'], w: 5, when: c => c.lastBust,
    make: () => ({ kicker: 'THE DROPS', title: 'One in the end zone',
      body: 'A drop that cost a game. Live on the JUGS machine, or refuse to think about it.',
      options: [
        o('jugs', 'JUGS machine every day', { attr: { hands: 2, afterCatch: -1 }, window: 3, tag: 'JUGS MACHINE' }, 'Catch everything.'),
        o('shake', 'Shake it off', gam(0.5, { attr: { hands: 1, awareness: 1 }, window: 3 }, 'Back to normal.', { attr: { hands: -3 }, window: 2, tag: 'IN YOUR HEAD' }, 'It\'s in your head now.')),
      ] }) },
  { id: 'te-backup-qb', at: ['mid', 'late'], w: 3, when: () => true,
    make: () => ({ kicker: 'INJURY REPORT', title: 'The backup quarterback is starting',
      body: 'He checks it down. That\'s you, all month, if you want it.',
      options: [
        o('outlet', 'Be the outlet', { attr: { hands: 1, awareness: 1, afterCatch: -1 }, team: { off: -1 }, window: 4, tag: 'BACKUP QB' }, 'Ten catches a game, none of them long.'),
        o('deep', 'Keep running the seams', gam(0.4, { attr: { vertical: 2 }, team: { off: -1 }, window: 4, tag: 'BACKUP QB' }, 'He finds you deep.', { attr: { routeRunning: -2 }, team: { off: -1 }, window: 4, tag: 'BACKUP QB' }, 'Nothing comes your way.')),
      ] }) },
]
const DB = [
  { id: 'db-shadow', at: ['early', 'mid', 'late'], w: 3, when: c => c.T.has('manCoverage'),
    make: () => ({ kicker: 'MATCHUP', title: 'Shadow their WR1?', body: 'The coordinator wants you to travel with the league\'s leading receiver for the next month.',
      options: [
        o('shadow', 'Take him', gam(0.55, { attr: { manCoverage: 2, press: 1 }, window: 3, xp: 30, tag: 'SHADOWING WR1' }, 'Erased him. Two catches a game.', { attr: { manCoverage: -2 }, team: { def: -1 }, window: 2, tag: 'SHADOWING WR1' }, 'He got you deep, twice.')),
        o('zone', 'Stay in your zone', { attr: { zoneIQ: 1 }, team: { def: 0.5 }, window: 3 }, 'The scheme covers for everyone.'),
      ] }) },
  { id: 'db-gamble', at: ['early', 'mid', 'late'], w: 2, when: c => c.T.has('hands'),
    make: () => ({ kicker: 'PHILOSOPHY', title: 'Jump routes for picks?', body: 'Ballhawks get interceptions. They also give up touchdowns.',
      options: [
        o('jump', 'Jump routes', { attr: { hands: 2, manCoverage: -1, zoneIQ: -1 }, window: 4, tag: 'BALLHAWK' }, 'More picks, more big plays allowed.'),
        o('disciplined', 'Stay disciplined', { attr: { playRecognition: 1 }, team: { def: 0.5 } }, 'Nothing behind you all year.'),
      ] }) },
  { id: 'db-press', at: ['early', 'mid'], w: 2, when: c => c.T.has('press'),
    make: () => ({ kicker: 'TECHNIQUE', title: 'Press or play off?', body: 'Their receivers are small and quick, all month.',
      options: [
        o('press', 'Press at the line', { attr: { press: 2, zoneIQ: -1 }, window: 4, tag: 'PRESS' }, 'Jam them at the line, help deep is thin.'),
        o('off', 'Play off, read the QB', { attr: { playRecognition: 2 }, window: 4, tag: 'OFF COVERAGE' }, 'Everything in front of you.'),
      ] }) },
  { id: 'db-blitz', at: ['mid', 'late'], w: 1, when: () => true,
    make: () => ({ kicker: 'NEW PACKAGE', title: 'Blitz off the edge?', body: 'The coordinator has a corner blitz for you.',
      options: [
        o('blitz', 'Send me', gam(0.5, { xp: 35, attr: { runSupport: 2 }, team: { def: 1 }, window: 2, tag: 'BLITZ PACKAGE' }, 'Strip sack. The crowd erupts.', { team: { def: -1.5 }, window: 1, tag: 'BLITZ PACKAGE' }, 'They picked it up and burned the vacated zone.')),
        o('cover', 'Stay in coverage', {}, 'Nothing changes.'),
      ] }) },
  { id: 'db-communicate', at: ['early', 'mid'], w: 1, when: () => true,
    make: () => ({ kicker: 'SECONDARY', title: 'Take over the calls?', body: 'The safety who ran the calls is out for the year.',
      options: [
        o('calls', 'Run the secondary', gam(0.65, { attr: { playRecognition: 1, zoneIQ: 1 }, team: { def: 1 } }, 'Everyone lined up right, all year.', { team: { def: -1 }, window: 2, tag: 'BLOWN COVERAGES' }, 'Two weeks of busted coverages while you learned it.')),
        o('mine', 'Focus on your man', { attr: { manCoverage: 1 }, team: { def: -0.5 } }, 'Your side is locked. The communication suffers.'),
      ] }) },
  { id: 'db-tackling', at: ['mid', 'late'], w: 1, when: c => c.T.has('runSupport'),
    make: () => ({ kicker: 'RUN DEFENSE', title: 'They want to run at you', body: 'Opponents are running outside at your side every week.',
      options: [
        o('fill', 'Fill hard', gam(0.75, { attr: { runSupport: 2 }, window: 4, tag: 'FILLING HARD' }, 'They stop running your way.', { attr: { runSupport: 2 }, window: 1, tag: 'FILLING HARD', then: { sit: 1, tag: 'STINGER' } }, 'A collision with a pulling guard costs you a game.')),
        o('contain', 'Contain and rally', { team: { def: 1 }, window: 3 }, 'Keep it in front, let the linebackers clean up.'),
      ] }) },
  { id: 'db-burned', at: ['mid', 'late'], w: 4, when: c => !c.lastWon && c.k >= 3,
    make: c => ({ kicker: 'BURNED', title: 'They picked on you', body: `${c.opp} went after your side all game.`,
      options: [
        o('film', 'Live in the film room', { attr: { playRecognition: 2 }, window: 3, tag: 'FILM ROOM' }, 'You know every route they run.'),
        o('swagger', 'Short memory', gam(0.6, { attr: { manCoverage: 1 }, window: 3 }, 'You came back locked in.', { attr: { manCoverage: -2 }, window: 2, tag: 'TARGETED' }, 'They kept coming at you.')),
      ] }) },
]
const OL = [
  { id: 'ol-pancake', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: () => ({ kicker: 'MENTALITY', title: 'Pancake everybody?', body: 'Finishing blocks into the turf fires up the line, and draws flags.',
      options: [
        o('finish', 'Finish every block', { attr: { pancake: 2, discipline: -2 }, window: 4, tag: 'NASTY' }, 'Pancakes and penalties.'),
        o('clean', 'Stay clean', { attr: { discipline: 1 } }, 'No flags all year.'),
      ] }) },
  { id: 'ol-false-starts', at: ['early', 'mid', 'late'], w: 3, when: c => (c.last?.penalties ?? 0) >= 2,
    make: c => ({ kicker: 'FLAGS', title: `${c.last.penalties} penalties last week`, body: 'The coach made you run gassers after practice.',
      options: [
        o('focus', 'Lock in on the count', { attr: { discipline: 2 }, window: 4, tag: 'ON THE COUNT' }, 'Clean for a month.'),
        o('aggressive', 'Stay aggressive', gam(0.5, { attr: { runBlock: 1 } }, 'The flags stop on their own.', { sit: 1, tag: 'BENCHED' }, 'Two more flags and the coach sits you a game.')),
      ] }) },
  { id: 'ol-pull', at: ['early', 'mid'], w: 1, when: c => c.T.has('mobility'),
    make: () => ({ kicker: 'RUN GAME', title: 'Pull on power runs?', body: 'The new run scheme has you pulling across the formation.',
      options: [
        o('pull', 'Pull', { attr: { mobility: 2, runBlock: 1, anchor: -1 }, window: 4, tag: 'PULLING' }, 'Out in space, a little light at the point.'),
        o('base', 'Base blocks only', { attr: { anchor: 1, runBlock: 1 }, window: 3, tag: 'BASE BLOCKS' }, 'Square up and move people.'),
      ] }) },
  { id: 'ol-bullrush', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: () => ({ kicker: 'SCOUTING REPORT', title: 'A 340-pound bull rusher', body: 'He walks tackles back into the quarterback. He\'s across from you Sunday.',
      options: [
        o('anchor', 'Sit down and anchor', gam(0.55, { attr: { anchor: 2, passPro: 1 }, window: 1, xp: 25, tag: 'BULL RUSHER' }, 'He didn\'t move you once.', { attr: { anchor: -2 }, team: { off: -1 }, window: 1, tag: 'BULL RUSHER' }, 'He got home twice.')),
        o('help', 'Ask for a chip', { team: { off: -1 }, attr: { passPro: 2 }, window: 1, tag: 'BULL RUSHER' }, 'A back helps you; one less receiver in the route.'),
      ] }) },
  { id: 'ol-blitz', at: ['mid', 'late'], w: 1, when: () => true,
    make: () => ({ kicker: 'PROTECTION', title: 'You call the protections', body: 'The center is out. You\'re making the line calls now.',
      options: [
        o('call', 'Take the calls', gam(0.6, { attr: { blitzPickup: 2 }, team: { off: 1 }, window: 3, tag: 'LINE CALLS' }, 'Every blitz picked up.', { team: { off: -1 }, window: 2, tag: 'LINE CALLS' }, 'Two weeks of free rushers.')),
        o('decline', 'Let the QB do it', { attr: { passPro: 1 }, window: 3 }, 'Just block your man.'),
      ] }) },
]

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
  { id: 'nba-hot-start', at: ['early'], w: 4, when: c => c.wins - c.losses >= 4,
    make: c => ({ kicker: `${c.rec} START`, title: 'League Pass favorites', body: `${c.nick} are the most watched team on the app. Ride it or tune it out?`,
      options: [
        o('ride', 'Ride the hype', gam(0.6, { attr: c.R('feel', 2), window: 12, tag: 'ON A HEATER' }, 'The bigger the crowd, the better you play.', { attr: c.R('mind', -2), window: 10, tag: 'DISTRACTED' }, 'The noise got in for a while.')),
        o('work', 'Back to the gym', { attr: { [c.T.worst()]: 1 } }, 'A small step that sticks.'),
      ] }) },
  { id: 'nba-slow-start', at: ['early', 'mid'], w: 4, when: c => c.losses - c.wins >= 4 || c.skid >= 4,
    make: c => ({ kicker: c.rec, title: 'Team meeting', body: 'The vets want a closed-door meeting. The room is watching to see if you speak.',
      options: [
        o('call', 'Call it', gam(0.65, { team: { off: 1, def: 1 } }, 'Clear the air. They start winning.', { team: { off: -1.5, def: -1.5 }, window: 10, tag: 'MEETING LEAKED' }, 'The meeting leaked. Ugly stretch.')),
        o('wait', 'Let it work itself out', { attr: c.R1('mind', 1), window: 10 }, 'Head down, do your job.'),
      ] }) },
  { id: 'nba-allstar', at: ['mid'], w: 3, when: c => c.roleHas('legs'),
    make: c => ({ kicker: 'ALL-STAR BREAK', title: 'The break', body: c.wins >= 25 ? 'You made the All-Star team. Play the weekend, or rest the legs?' : 'Four days off at the break. Rest, or get in the gym?',
      options: [
        o('play', c.wins >= 25 ? 'Play the All-Star game' : 'Pickup runs all week', { xp: 30, attr: c.R('legs', -1), window: 10, tag: 'NO BREAK' }, 'The spotlight, and tired legs after it.'),
        o('rest', 'Rest and reset', { attr: c.R('legs', 2), window: 10, tag: 'FRESH LEGS' }, 'You come back flying.'),
      ] }) },
  { id: 'nba-deadline', at: ['mid', 'late'], w: 3, when: c => c.alive,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'The front office calls', body: `${c.nick} can rent a star for the stretch run with next year's picks, or hold the roster.`,
      options: [
        o('rental', 'Rent a star', { team: { off: 2 } }, 'A second scorer the rest of the way.'),
        o('depth', 'Add a defender', { team: { def: 1.5 } }, 'Stops in the fourth quarter.'),
        o('pat', 'Stand pat', { team: { off: 0.5, def: 0.5 } }, 'Chemistry intact.'),
      ] }) },
  { id: 'nba-b2b', at: ['early', 'mid', 'late'], w: 2, when: c => c.roleHas('legs'),
    make: c => ({ kicker: 'BACK-TO-BACK', title: 'Sit the second night?', body: 'Two games, two cities, two nights. The sports science staff says rest.',
      options: [
        o('rest', 'Take the night', { sit: 1, tag: 'REST NIGHT', then: { attr: c.R('legs', 1), window: 8, tag: 'FRESH LEGS' } }, 'One night off, fresh for the next stretch.'),
        o('play', 'Play both', { attr: c.R('legs', -2), window: 4, xp: 15, tag: 'TIRED LEGS' }, 'You play, on dead legs.'),
      ] }) },
  { id: 'nba-road-trip', at: ['mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'ROAD TRIP', title: 'Six games in nine nights', body: 'The longest road trip of the year. Sleep and focus are everything.',
      options: [
        o('bond', 'Team dinners, bond up', { team: { off: 1, def: 1 }, attr: c.R('legs', -1), window: 6, tag: 'ROAD TRIP' }, 'The group gets tight; late nights cost you a step.'),
        o('solo', 'Stay in, recover', { attr: c.R('legs', 1), window: 6, tag: 'ROAD TRIP' }, 'Fresh every night; the group does its own thing.'),
      ] }) },
  { id: 'nba-heater', at: ['mid', 'late', 'stretch'], w: 4, when: c => c.streak >= 6,
    make: c => ({ kicker: `${c.streak} STRAIGHT`, title: 'Unconscious', body: 'You can\'t miss right now. Keep shooting?',
      options: [
        o('shoot', 'Keep firing', gam(0.55, { attr: c.R('feel', 2), window: 8, tag: 'UNCONSCIOUS' }, 'Still can\'t miss.', { attr: c.R('feel', -2), window: 5, tag: 'COLD' }, 'The heat check went cold.')),
        o('share', 'Get everyone involved', { team: { off: 1 }, window: 10, tag: 'BALL MOVEMENT' }, 'Everyone eats.'),
      ] }) },
  { id: 'nba-slump', at: ['mid', 'late'], w: 4, when: c => c.skid >= 4 || c.lastBust,
    make: c => ({ kicker: 'SLUMP', title: 'The shot isn\'t falling', body: 'Three bad games in a row. The shooting coach has ideas.',
      options: [
        o('extra', 'Extra shooting at midnight', { attr: c.R1('feel', 2), window: 10, tag: 'EXTRA SHOOTING', then: { attr: c.R('legs', -1), window: 5, tag: 'TIRED LEGS' } }, 'The stroke comes back; the sleep doesn\'t.'),
        o('attack', 'Attack the rim instead', { attr: mix(c.R1('power', 2), c.R1('feel', -1)), window: 10, tag: 'ATTACK MODE' }, 'Layups and free throws until it comes back.'),
      ] }) },
  { id: 'nba-christmas', at: ['early', 'mid'], w: 2, when: () => true,
    make: c => ({ kicker: 'CHRISTMAS DAY', title: 'The marquee game', body: 'The whole country is watching. New shoes, new stage.',
      options: [
        o('show', 'Put on a show', gam(0.5, { attr: mix(c.R('feel', 3), c.R1('make', 2)), window: 1, xp: 40, tag: 'CHRISTMAS' }, 'A Christmas classic.', { attr: c.R('nerve', -3), window: 1, tag: 'CHRISTMAS' }, 'Coal in your stocking.')),
        o('steady', 'Just another game', { attr: c.R1('mind', 1), window: 1, tag: 'CHRISTMAS' }, 'Calm. Professional.'),
      ] }) },
  { id: 'nba-system', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'NEW SYSTEM', title: 'Pace and space', body: 'The coach wants to play faster and shoot more threes.',
      options: [
        o('buy', 'Buy in', gam(0.6, { team: { off: 1 }, attr: c.R1('feel', 1) }, 'It fits you like a glove.', { team: { off: -1, def: -1 }, window: 12, tag: 'NEW SYSTEM' }, 'Too fast. A month of turnovers and transition buckets.')),
        o('old', 'Keep it half-court', { team: { def: 1 }, window: 16, tag: 'HALF-COURT' }, 'Grind it out.'),
      ] }) },
  { id: 'nba-defense', at: ['early', 'mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'IDENTITY', title: 'Become a defensive team?', body: 'The coach wants to win with stops.',
      options: [
        o('stops', 'Defense first', { team: { def: 1.5 }, attr: c.R('make', -1), window: 16, tag: 'DEFENSE FIRST' }, 'Stops, and fewer touches for you.'),
        o('score', 'Outscore people', { team: { off: 1.5, def: -0.5 }, window: 16, tag: 'RUN AND GUN' }, 'Shootouts every night.'),
      ] }) },
  { id: 'nba-rival', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'RIVALRY NIGHT', title: 'A grudge match', body: 'Their star said you\'re "not a real No. 1 option". He\'s guarding you tonight.',
      options: [
        o('cook', 'Cook him', gam(0.55, { attr: mix(c.R('feel', 3), c.R1('make', 2)), window: 1, xp: 35, tag: 'RIVALRY' }, 'You cooked him. The clip has 10M views.', { attr: c.R('nerve', -3), window: 1, tag: 'RIVALRY' }, 'He got the last laugh.')),
        o('win', 'Just win', { team: { off: 1, def: 1 }, window: 1, tag: 'RIVALRY' }, 'The W is the answer.'),
      ] }) },
  { id: 'nba-clinched', at: ['late', 'stretch'], w: 5, when: c => c.clinched && c.left >= 5,
    make: c => ({ kicker: 'CLINCHED', title: 'Rest for the playoffs?', body: `${c.nick} have a playoff spot. ${c.left} games left.`,
      options: [
        o('rest', 'Load management', { sit: 4, tag: 'LOAD MANAGEMENT', then: { attr: c.R('legs', 1) } }, 'Four nights off. Fresh for the playoffs.'),
        o('seed', 'Chase the top seed', gam(0.75, { attr: c.R1('feel', 1) }, 'Sharp and healthy.', { attr: c.R('legs', -2), tag: 'BANGED UP' }, 'Banged up in a game that didn\'t matter. You carry it into the playoffs.')),
      ] }) },
  { id: 'nba-eliminated', at: ['late', 'stretch'], w: 6, when: c => c.eliminated,
    make: c => ({ kicker: 'OUT OF IT', title: 'Play out the string', body: `${c.nick} won't make it. What are the last ${c.left} games for?`,
      options: [
        o('stats', 'Pad the numbers', { attr: c.R('make', 2), team: { off: -1 } }, 'Shots for you, and a worse team.'),
        o('work', 'Work on your game', { attr: { [c.T.worst()]: 2 } }, 'Real reps on the weak spot.'),
        o('shut', 'Shut it down', { sit: Math.min(6, c.left), xp: 10, tag: 'SHUT DOWN' }, 'Healthy into the summer.'),
      ] }) },
  { id: 'nba-bubble', at: ['late', 'stretch'], w: 5, when: c => c.bubble,
    make: c => ({ kicker: 'PLAY-IN RACE', title: 'Every game matters', body: `${c.rec}. ${c.nick} are fighting for a spot.`,
      options: [
        o('usage', 'Put it on my back', { attr: mix(c.R('make', 2), c.R1('feel', 1)), window: 8, tag: 'ON YOUR BACK', then: { attr: c.R('legs', -2), window: 6, tag: 'RUNNING ON EMPTY' } }, 'Eight huge games, then the legs go.'),
        o('team', 'Trust the group', { team: { off: 1, def: 1 }, window: 10, tag: 'EVERYONE EATS' }, 'Everyone eats.'),
      ] }) },
  { id: 'nba-mvp', at: ['mid', 'late', 'stretch'], w: 4, when: c => c.contender,
    make: c => ({ kicker: 'MVP LADDER', title: 'On the ladder', body: `${c.name} climbed to No. 2 on the MVP ladder.`,
      options: [
        o('chase', 'Chase it', { attr: c.R('make', 2), team: { def: -1 } }, 'Usage up, effort on D down.'),
        o('wins', 'Wins first', { team: { off: 1, def: 1 } }, 'Let the record make the case.'),
      ] }) },
  { id: 'nba-weights', at: ['early', 'mid'], w: 1, when: c => c.T.has('size') && c.T.has('speed'),
    make: () => ({ kicker: 'WEIGHT ROOM', title: 'Add strength mid-season?', body: 'The strength coach thinks eight pounds of muscle would help inside.',
      options: [
        o('bulk', 'Add the muscle', { attr: { size: 1, speed: -1 } }, 'Stronger inside, a step slower, all year.'),
        o('lean', 'Stay lean', { attr: { speed: 1 }, window: 16 }, 'Quick and light.'),
      ] }) },
  { id: 'nba-film', at: ['early', 'mid', 'late'], w: 1, when: c => c.roleHas('mind'),
    make: c => ({ kicker: 'FILM ROOM', title: 'Watch film with the coaches?', body: 'An extra hour a day in the film room, all season.',
      options: [
        o('film', 'Every day', { attr: c.R1('mind', 1) }, 'You read it faster, all year.'),
        o('court', 'On the court instead', { attr: { [c.T.worst()]: 1 } }, 'Reps on the weak spot.'),
      ] }) },
  { id: 'nba-contract', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'CONTRACT', title: 'Supermax on the table', body: 'Sign now, or bet on yourself and hit free agency?',
      options: [
        o('sign', 'Sign it', { attr: c.R1('nerve', 1) }, 'Nothing to prove. Free to play.'),
        o('bet', 'Bet on yourself', gam(0.5, { attr: c.R('make', 2), xp: 40 }, 'Every game is a showcase, and you\'re dominating.', { attr: c.R('nerve', -2), window: 12, tag: 'PRESSURE' }, 'The pressure is showing.')),
      ] }) },
  { id: 'nba-rookie', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'LOCKER ROOM', title: 'Mentor the rookie?', body: 'The lottery pick follows you everywhere. Your practice time would be his.',
      options: [
        o('mentor', 'Take him under your wing', { team: { off: 1 }, attr: c.R1('feel', -1), window: 16, xp: 25, tag: 'MENTOR' }, 'He grows up fast; your own reps suffer.'),
        o('self', 'Focus on yourself', { attr: { [c.T.worst()]: 1 } }, 'Reps on the weak spot.'),
      ] }) },
  { id: 'nba-trash', at: ['early', 'mid', 'late'], w: 1, when: c => !!c.last,
    make: c => ({ kicker: 'POSTGAME', title: `${c.opp} chirping`, body: 'Their bench was talking all night. The rematch is next week.',
      options: [
        o('back', 'Talk back', gam(0.55, { attr: c.R('feel', 2), window: 2, tag: 'REMATCH' }, 'You backed it up.', { attr: c.R('nerve', -2), window: 2, tag: 'TECHNICALS' }, 'Technical fouls and bad shots.')),
        o('quiet', 'Stay quiet', { attr: c.R1('mind', 1), window: 2, tag: 'REMATCH' }, 'Let the scoreboard talk.'),
      ] }) },
]
const GUARD = [
  { id: 'g-shots', at: ['early', 'mid', 'late'], w: 2, when: c => c.T.has('jumpShot') && c.T.has('finishing'),
    make: () => ({ kicker: 'SHOT DIET', title: 'Threes or the rim?', body: 'The analytics staff wants fewer mid-range shots.',
      options: [
        o('threes', 'Live behind the arc', { attr: { jumpShot: 2, finishing: -1 }, window: 16, tag: 'THREES' }, 'More threes, fewer trips inside.'),
        o('rim', 'Attack the rim', { attr: { finishing: 2, jumpShot: -1 }, window: 16, tag: 'ATTACK MODE' }, 'Layups, fouls, fewer threes.'),
      ] }) },
  { id: 'g-point', at: ['early', 'mid'], w: 2, when: c => c.T.has('passing'),
    make: () => ({ kicker: 'ROLE', title: 'Run the point?', body: 'The starting point guard is out a month. Someone has to run the offense.',
      options: [
        o('point', 'Take the keys', { attr: { passing: 2, handles: 1, jumpShot: -1 }, window: 14, tag: 'RUNNING THE POINT' }, 'Assists up, your own shots down.'),
        o('score', 'Keep scoring', { team: { off: -1 }, attr: { jumpShot: 1 }, window: 14, tag: 'NO PG' }, 'You get yours; the offense stalls without a point.'),
      ] }) },
  { id: 'g-lockdown', at: ['early', 'mid', 'late'], w: 2, when: c => c.T.has('perimeterDefense'),
    make: () => ({ kicker: 'ASSIGNMENT', title: 'Guard their best scorer?', body: 'The coach wants you on the other team\'s star every night for the next stretch.',
      options: [
        o('lock', 'Lock him up', { attr: { perimeterDefense: 2, jumpShot: -1 }, team: { def: 1 }, window: 10, tag: 'LOCKDOWN' }, 'Stops, and less in the tank on offense.'),
        o('save', 'Save your legs for offense', { attr: { jumpShot: 1 }, team: { def: -1 }, window: 10 }, 'Your shots, their star\'s too.'),
      ] }) },
  { id: 'g-stepback', at: ['early', 'mid'], w: 1, when: c => c.T.has('handles'),
    make: () => ({ kicker: 'DEVELOPMENT', title: 'Add a step-back?', body: 'Your trainer has a move for you.',
      options: [
        o('add', 'Add the move', gam(0.6, { attr: { handles: 1 } }, 'Ankles everywhere, all year.', { attr: { handles: -2 }, window: 8, tag: 'LEARNING IT' }, 'Turnovers while you learn it.')),
        o('no', 'Stick to your bag', {}, 'Nothing changes.'),
      ] }) },
  { id: 'g-clutch', at: ['mid', 'late', 'stretch'], w: 2, when: c => c.T.has('clutch'),
    make: () => ({ kicker: 'CRUNCH TIME', title: 'Take the last shot?', body: 'Down one, five seconds left last night. The coach drew it up for someone else.',
      options: [
        o('mine', 'Demand the ball', gam(0.5, { attr: { clutch: 1 }, xp: 20 }, 'Next time it\'s yours, and you hit it.', { attr: { clutch: -2 }, window: 8, tag: 'IN YOUR HEAD' }, 'You missed it. It\'s in your head now.')),
        o('team', 'Trust the play call', { team: { off: 0.5 } }, 'The system wins games.'),
      ] }) },
]
const BIG = [
  { id: 'b-stretch', at: ['early', 'mid'], w: 2, when: c => c.T.has('jumpShot'),
    make: () => ({ kicker: 'DEVELOPMENT', title: 'Stretch the floor?', body: 'The coach wants you taking threes.',
      options: [
        o('three', 'Let it fly', { attr: { jumpShot: 2, rebounding: -1 }, window: 16, tag: 'STRETCH BIG' }, 'Space for everyone, fewer boards.'),
        o('paint', 'Stay in the paint', { attr: { rebounding: 1, finishing: 1 }, window: 16, tag: 'IN THE PAINT' }, 'Dunks and boards.'),
      ] }) },
  { id: 'b-rim', at: ['early', 'mid', 'late'], w: 2, when: c => c.T.has('interiorDefense'),
    make: () => ({ kicker: 'IDENTITY', title: 'Become a rim protector?', body: 'Block everything, or stay out of foul trouble.',
      options: [
        o('block', 'Block everything', gam(0.6, { attr: { interiorDefense: 2 }, window: 12, tag: 'RIM PROTECTOR' }, 'Nobody comes in the paint.', { attr: { interiorDefense: -1 }, team: { def: -1 }, window: 8, tag: 'FOUL TROUBLE' }, 'Foul trouble every night; you\'re on the bench in the fourth.')),
        o('wall', 'Wall up, no fouls', { team: { def: 1 }, window: 12, tag: 'VERTICALITY' }, 'Fewer blocks, fewer fouls.'),
      ] }) },
  { id: 'b-boards', at: ['early', 'mid', 'late'], w: 2, when: c => c.T.has('rebounding'),
    make: () => ({ kicker: 'GLASS', title: 'Crash the offensive glass?', body: 'More second chances, fewer transition stops.',
      options: [
        o('crash', 'Crash it', { attr: { rebounding: 2 }, team: { def: -1 }, window: 12, tag: 'CRASHING' }, 'Putbacks, and fast breaks against you.'),
        o('back', 'Get back on D', { team: { def: 1 }, window: 12, tag: 'GET BACK' }, 'No easy ones the other way.'),
      ] }) },
  { id: 'b-hub', at: ['mid', 'late'], w: 1, when: c => c.T.has('playmaking'),
    make: () => ({ kicker: 'NEW WRINKLE', title: 'Run the offense through you?', body: 'Point center, dribble hand-offs, the whole thing.',
      options: [
        o('hub', 'Be the hub', gam(0.6, { attr: { playmaking: 2 }, team: { off: 1 }, window: 16, tag: 'POINT CENTER' }, 'It works. Everything runs through you.', { attr: { playmaking: -1 }, team: { off: -1 }, window: 8, tag: 'POINT CENTER' }, 'Turnovers. The experiment ends after a few weeks.')),
        o('roll', 'Just roll to the rim', { attr: { finishing: 1 }, window: 16, tag: 'ROLL MAN' }, 'Lobs and dunks.'),
      ] }) },
  { id: 'b-matchup', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'MATCHUP', title: 'The best center in the league', body: 'He\'s seven feet of trouble, and he\'s in town tonight.',
      options: [
        o('battle', 'Battle him', gam(0.5, { attr: mix(c.R('power', 3), c.R1('feel', 2)), window: 1, xp: 30, tag: 'BIG MATCHUP' }, 'You won the war in the paint.', { attr: c.R('power', -3), window: 1, tag: 'BIG MATCHUP' }, 'He bullied you.')),
        o('scheme', 'Double him', { team: { def: 1 }, window: 1, tag: 'BIG MATCHUP' }, 'Make someone else beat you.'),
      ] }) },
]
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
  { id: 'nbapo-revenge', at: ['playoffs'], w: 1, when: () => true,
    make: c => ({ kicker: 'FIRST ROUND', title: 'The team that knocked you out', body: 'Last year\'s nightmare is this year\'s matchup.',
      options: [
        o('revenge', 'Revenge tour', gam(0.55, { attr: c.R('feel', 2) }, 'Not this year.', { attr: c.R('nerve', -2) }, 'Same nightmare.')),
        o('fresh', 'Fresh start', { attr: c.R1('mind', 1) }, 'Different year, different team.'),
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
  return !Object.values(e.attr || {}).some(Boolean) && !e.team?.off && !e.team?.def && !e.sit && !e.xp && hollow(e.then)
}

// Picks the scenario for a stop (or null). `used` = ids already shown this season.
export function pickScenario(args) {
  const { sport, pos, stop, used = new Set() } = args
  const c = context(args)
  const ph = phaseOf(stop)
  const bank = BANK[sport]
  if (!bank) return null
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
