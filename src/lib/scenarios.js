// Season scenarios: the decisions a season pauses on (app). A big bank of
// situations, each gated on where the season actually is, so a scenario only
// fires when it makes sense:
//   at    which stretch of the season it can appear: early · mid · late · stretch · playoffs
//   when  a test on the season so far (record, streaks, playoff picture, last game)
//   w     how strongly it wants to be picked when it fits (situational > generic)
//   make  the card: kicker, title, body and 2–3 options
// Every option's fine print is written from its effect (describe), so the text
// can never promise something different from what the option does.
//
// Effects (applied by seasonDirector.js):
//   attr {trait: ±n}      rest of the season (or `window` games)
//   team {off, def}       the team around you
//   sit n                 you miss the next n games
//   then {…, window}      a delayed, temporary effect
//   gamble {p, hit, miss} each side its own effect plus a `line` for the reveal
//   xp                    bonus XP

import { seeded } from './rng'

// ── Trait groups per position (only traits in the build count) ─────────────
const GROUPS = {
  qb: { physical: ['arm', 'legs', 'size'], mental: ['processing', 'leadership', 'vision'], skill: ['accuracy', 'playmaking', 'pocket-presence'] },
  rb: { physical: ['speed', 'burst', 'strength', 'size'], mental: ['vision', 'carrying'], skill: ['balance', 'elusiveness', 'vision', 'carrying', 'hands'] },
  wr: { physical: ['speed', 'bodyControl', 'vertical', 'size'], mental: ['awareness', 'routeRunning'], skill: ['routeRunning', 'release', 'hands', 'awareness', 'afterCatch'] },
  te: { physical: ['speed', 'blocking', 'vertical', 'size'], mental: ['awareness', 'routeRunning'], skill: ['routeRunning', 'strength', 'hands', 'awareness', 'afterCatch'] },
  db: { physical: ['speed', 'size', 'fluidity'], mental: ['zoneIQ', 'playRecognition'], skill: ['press', 'hands', 'manCoverage', 'runSupport'] },
  ol: { physical: ['size', 'length', 'anchor', 'mobility'], mental: ['blitzPickup', 'discipline'], skill: ['passPro', 'runBlock', 'pancake'] },
  guard: { physical: ['speed', 'bounce', 'size'], mental: ['basketballIQ', 'clutch'], skill: ['jumpShot', 'finishing', 'passing', 'handles', 'perimeterDefense'] },
  big: { physical: ['speed', 'bounce', 'size'], mental: ['basketballIQ', 'clutch'], skill: ['jumpShot', 'finishing', 'rebounding', 'playmaking', 'interiorDefense'] },
}

// ── Effect → fine print ──────────────────────────────────────────────────────
const sign = n => (n > 0 ? `+${n}` : `−${Math.abs(n)}`)
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s)
export function describe(e, c, scope = '') {
  if (!e || !Object.keys(e).filter(k => k !== 'line').length) return 'Nothing changes.'
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
  if (s && scope) s += ` ${scope}`
  if (e.sit) s += `${s ? '; ' : ''}sit ${e.sit === 1 ? 'the next game' : `the next ${e.sit} games`}`
  if (e.then) s += `${s ? ', then ' : ''}${lc(describe(e.then, c))}`
  if (e.xp) s += `${s ? ' · ' : ''}+${e.xp} XP`
  return cap(s || 'Nothing changes.')
}
const isEmpty = e => !e || !Object.keys(e).length
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
  const groups = GROUPS[pos] ?? {}
  const val = t => build?.[t]?.val ?? 5
  const L = t => attrMap?.[t]?.label ?? t
  const all = types.filter(t => has.has(t))
  const inGroup = g => (groups[g] ?? []).filter(t => has.has(t))
  const sorted = (list, dir) => [...list].sort((a, b) => dir * (val(b) - val(a)))
  const T = {
    best: (g, not) => (g ? sorted(inGroup(g), 1) : sorted(all, 1)).find(t => t !== not) ?? sorted(all, 1).find(t => t !== not) ?? all[0],
    worst: (g, not) => (g ? sorted(inGroup(g), -1) : sorted(all, -1)).find(t => t !== not) ?? sorted(all, -1).find(t => t !== not) ?? all[0],
    has: t => has.has(t),
    one: (...cands) => cands.find(t => has.has(t)) ?? null,
  }
  const r = seeded(`scn-${seed}-${stop.at}`)
  return {
    sport, pos, isBucket, isDef: pos === 'db', isOL: pos === 'ol', stop, k, total, left, wins, losses, streak, skid, pace,
    rec: `${wins}–${losses}`, nick: teamNick, name, T, L, val, r,
    alive: wins + left >= needIn, clinched: wins >= lock, eliminated: wins + left < needIn,
    bubble: wins + left >= needIn && wins < lock && pace >= needIn - (isBucket ? 8 : 2.5) && pace <= lock + (isBucket ? 4 : 1),
    contender: pace >= (isBucket ? 54 : 11.5), struggling: k >= 3 && pace <= (isBucket ? 33 : 6.5),
    last: ctx.last, lastWon: !!ctx.last?.won, lastBig, lastBust,
    opp: (ctx.last?.opponent || 'them').split(' ').slice(-1)[0],
    side: pos === 'db' ? 'defense' : 'offense', other: pos === 'db' ? 'offense' : 'defense',
    sideKey: pos === 'db' ? 'def' : 'off', otherKey: pos === 'db' ? 'off' : 'def',
    g: n => (isBucket ? Math.max(2, Math.round(n * 4.5)) : n),      // a "few games" in either sport
    unitWord: isBucket ? 'games' : 'weeks',
    teamOff: team?.off, teamDef: team?.def,
    sum: key => ctx.games.reduce((a, gm) => a + (gm[key] ?? 0), 0),
  }
}

// option builder: label + effect (+ an optional flavor line before the fine print)
const o = (id, label, effect, flavor) => ({ id, label, effect, flavor })
const T2 = (c, a, b) => ({ [a]: 1, [b === a ? c.T.worst(null, a) : b]: -1 })     // +1 a, −1 b (never the same trait)
const gam = (p, hit, hitLine, miss, missLine) => ({ gamble: { p, hit: { ...hit, line: hitLine }, miss: { ...miss, line: missLine } } })

// ═════════════════════════════════════════════════════════════════════════════
// FOOTBALL — every position
// ═════════════════════════════════════════════════════════════════════════════
const NFL_ALL = [
  // ── Where the season is ──────────────────────────────────────────────────
  { id: 'hot-start', at: ['early'], w: 4, when: c => c.losses === 0 || c.wins - c.losses >= 2,
    make: c => ({ kicker: `${c.rec} START`, title: 'The league noticed',
      body: `${c.nick} are the early story and your name is in every segment. Ride the wave, or keep the noise out of the building?`,
      options: [
        o('ride', 'Ride the wave', gam(0.55, { attr: { [c.T.best()]: 2 }, window: 4, xp: 30 }, 'You feed off it. Four big weeks.', { attr: { [c.T.best('mental')]: -1 }, window: 3 }, 'The noise got in. A sloppy few weeks.')),
        o('ground', 'Nothing is won in September', { attr: { [c.T.best('mental')]: 1 } }, 'Steady all year.'),
      ] }) },
  { id: 'early-hole', at: ['early', 'mid'], w: 4, when: c => c.skid >= 2 || c.losses - c.wins >= 2,
    make: c => ({ kicker: `${c.rec}`, title: 'The coach wants an answer',
      body: `${c.nick} are in a hole. The staff can simplify the whole ${c.side} and lean on the roster, or hand you the keys and live with the risk.`,
      options: [
        o('simple', 'Simplify it, trust the roster', { team: { [c.sideKey]: 1 }, attr: { [c.T.best('skill')]: -1 }, window: 3 }, 'A cleaner unit. Fewer plays for you.'),
        o('keys', 'Put it on me', { attr: { [c.T.best('skill')]: 2 }, team: { [c.otherKey]: -1 }, window: 3 }, 'Your production spikes. The other side of the ball is on the field a lot.'),
      ] }) },
  { id: 'skid-meeting', at: ['mid', 'late'], w: 4, when: c => c.skid >= 3,
    make: c => ({ kicker: `${c.skid} STRAIGHT LOSSES`, title: 'Players-only meeting',
      body: 'Three losses and the cameras are waiting outside the locker room. A veteran asks if you\'ll stand up and say something.',
      options: [
        o('call', 'Call the meeting', gam(0.6, { team: { off: 1, def: 1 } }, 'It lands. The room is yours.', { team: { [c.sideKey]: -1 }, window: 3 }, 'It got personal. Three ugly weeks.')),
        o('coach', 'Let the coach handle it', { attr: { [c.T.best('mental')]: 1 }, window: 3 }, 'Head down, do your job.'),
      ] }) },
  { id: 'heater', at: ['mid', 'late', 'stretch'], w: 4, when: c => c.streak >= 4,
    make: c => ({ kicker: `${c.streak} IN A ROW`, title: 'Don\'t change a thing?',
      body: 'The coach wants to keep every routine the same. The trainers want to pull back your reps before something gives.',
      options: [
        o('same', 'Keep everything the same', gam(0.65, { attr: { [c.T.best()]: 1 } }, 'The streak rolls on.', { attr: { [c.T.best('physical')]: -2 }, window: 3 }, 'The body finally said something.')),
        o('pull', 'Pull back the reps', { attr: { [c.T.best('physical')]: 1 }, team: { [c.sideKey]: -0.5 }, window: 3 }, 'Fresh, but the unit loses a little rhythm.'),
      ] }) },
  { id: 'bubble', at: ['late', 'stretch'], w: 5, when: c => c.bubble,
    make: c => ({ kicker: 'ON THE BUBBLE', title: 'Every snap decides it',
      body: `${c.rec}. The playoff line runs right through ${c.nick}. The coach asks how you want the last stretch called.`,
      options: [
        o('ball', 'Give me the ball', { attr: { [c.T.best('skill')]: 2 }, window: 2, then: { attr: { [c.T.best('physical')]: -1 }, window: 2 } }, 'Two huge games, then the tank runs low.'),
        o('roster', 'Trust the whole roster', { team: { off: 1, def: 1 }, window: 3 }, 'Everyone eats.'),
      ] }) },
  { id: 'clinched', at: ['late', 'stretch'], w: 5, when: c => c.clinched && c.left >= 2,
    make: c => ({ kicker: 'CLINCHED', title: 'Rest or rhythm?',
      body: `${c.nick} are in. ${c.left} games left that don't decide much, and the staff asks what you want.`,
      options: [
        o('rest', 'Sit a week, heal up', { sit: 1, attr: { [c.T.best('physical')]: 1 } }, 'Fresh legs for January.'),
        o('rhythm', 'Keep the rhythm', { attr: { [c.T.best('skill')]: 1 }, window: c.left }, 'Sharp into the playoffs.'),
      ] }) },
  { id: 'eliminated', at: ['late', 'stretch'], w: 6, when: c => c.eliminated,
    make: c => ({ kicker: 'ELIMINATED', title: 'What the last games are for',
      body: `${c.nick} are out. The last ${c.left} games are about you now: the tape, the body, or the contract.`,
      options: [
        o('weak', 'Work on the weak spot', { attr: { [c.T.worst()]: 2 } }, 'Real reps on the thing that\'s been holding you back.'),
        o('showcase', 'Showcase for the money', gam(0.55, { attr: { [c.T.best()]: 2 }, xp: 30 }, 'A statement finish. Every GM saw it.', { attr: { [c.T.best('physical')]: -1 }, window: 2 }, 'Pushed too hard for nothing.')),
        o('shut', 'Shut it down', { sit: 2, attr: { [c.T.best('physical')]: 1 } }, 'Healthy into the offseason.'),
      ] }) },
  // ── The football calendar ────────────────────────────────────────────────
  { id: 'bye-week', at: ['early', 'mid'], w: 3, when: () => true,
    make: c => ({ kicker: 'BYE WEEK', title: 'A week with no game',
      body: 'Seven days. Rest the body, live in the film room, or grind the one thing that isn\'t good enough yet.',
      options: [
        o('rest', 'Rest and recover', { attr: { [c.T.best('physical')]: 1 }, window: 4 }, 'The body comes back right.'),
        o('film', 'Film room all week', { attr: { [c.T.best('mental')]: 1 }, window: 4 }, 'You see it before it happens.'),
        o('grind', 'Grind the weak spot', { attr: { [c.T.worst()]: 2 }, window: 4 }, 'A real step forward, for a month.'),
      ] }) },
  { id: 'deadline-buy', at: ['mid'], w: 4, when: c => c.alive && !c.struggling,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'The GM has one pick to spend',
      body: `${c.nick} are buying. The GM asks the leaders what the roster needs most for the stretch.`,
      options: [
        o('rusher', 'A pass rusher', { team: { def: 1.5 } }, 'The defense gets off the field.'),
        o('help', c.isDef ? 'A playmaker on offense' : 'Help around me', { team: { off: 1.5 } }, 'The offense opens up.'),
        o('stand', 'Stand pat, keep the chemistry', { attr: { [c.T.best('mental')]: 1 } }, 'No new faces. Everyone knows their job.'),
      ] }) },
  { id: 'deadline-sell', at: ['mid'], w: 5, when: c => c.struggling,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'The sell-off',
      body: `${c.nick} are moving veterans for picks. The team gets worse now; the ${c.side} runs through you.`,
      options: [
        o('carry', 'Carry it', { attr: { [c.T.best('skill')]: 2 }, team: { off: -1, def: -1 } }, 'Thinner roster, your numbers up.'),
        o('out', 'Ask to be moved too', gam(0.4, { xp: 40, attr: { [c.T.best('mental')]: 1 } }, 'They say no, but the front office hears you. Respect.', { team: { [c.sideKey]: -1 }, window: 3 }, 'The room turns on you for three weeks.')),
      ] }) },
  { id: 'oc-fired', at: ['mid', 'late'], w: 2, when: c => c.struggling && !c.isDef,
    make: c => ({ kicker: 'STAFF CHANGE', title: 'The coordinator is gone',
      body: 'The play caller was fired on Monday. A new voice, a new install, and no time to learn it.',
      options: [
        o('buy', 'Buy in fast', gam(0.55, { team: { off: 1.5 } }, 'It clicks. The offense looks new.', { team: { off: -1 }, window: 3, then: { team: { off: 1 } } }, 'Three busted weeks, then it starts to work.')),
        o('mine', 'Run what I know', { attr: { [c.T.best('skill')]: 1 }, window: 3 }, 'You keep your rhythm; the scheme waits.'),
      ] }) },
  { id: 'rival', at: ['mid', 'late', 'stretch'], w: 2, when: c => c.alive,
    make: c => ({ kicker: 'DIVISION GAME', title: 'The one that decides the division',
      body: 'A rival with the same record. Win and you hold the tiebreaker; lose and you chase them in December.',
      options: [
        o('circle', 'Sell out for this one', gam(0.55, { attr: { [c.T.best()]: 2 }, window: 1, team: { [c.sideKey]: 1 }, xp: 35 }, 'Your best game of the year.', { attr: { [c.T.best('physical')]: -1 }, window: 2 }, 'Too amped. It got away, and it cost you the next week too.')),
        o('next', 'Just another game', { attr: { [c.T.best('mental')]: 1 }, window: 2 }, 'Calm. Prepared.'),
      ] }) },
  { id: 'primetime', at: ['mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'SUNDAY NIGHT', title: 'The whole country is watching',
      body: 'The short week, the lights, the crowd noise. Some players get bigger here.',
      options: [
        o('show', 'Put on a show', gam(0.5, { attr: { [c.T.best('skill')]: 2 }, window: 1, xp: 40 }, 'A night they\'ll replay for years.', { attr: { [c.T.worst()]: -2 }, window: 1 }, 'The moment ate you.')),
        o('simple', 'Keep it simple', { attr: { [c.T.best('mental')]: 1 }, window: 1 }, 'Nothing flashy. Nothing wrong.'),
      ] }) },
  { id: 'cold', at: ['late', 'stretch'], w: 2, when: () => true,
    make: c => ({ kicker: 'DECEMBER FOOTBALL', title: 'Wind, cold, and a run-heavy plan',
      body: 'Single digits and a crosswind. The staff wants to shorten the game and play field position.',
      options: [
        o('control', 'Ball control', { team: { def: 1 }, attr: { [c.T.best('skill')]: -1 }, window: 1 }, 'Fewer chances for you, a rested defense.'),
        o('rip', 'Let it rip anyway', gam(0.5, { attr: { [c.T.best('physical')]: 2 }, window: 1 }, 'The weather didn\'t matter.', { attr: { [c.T.best('physical')]: -2 }, window: 1 }, 'The ball sailed all day.')),
      ] }) },
  // ── The body ─────────────────────────────────────────────────────────────
  { id: 'tweak', at: ['early', 'mid', 'late'], w: 3, when: () => true,
    make: c => ({ kicker: 'INJURY REPORT', title: 'Something popped in practice',
      body: 'The trainers list you as questionable. Sit a week and it heals clean; play and you find out on the field.',
      options: [
        o('sit', 'Sit this one out', { sit: 1 }, 'One week. Comes back clean.'),
        o('play', 'Play through it', gam(0.6, {}, 'Nothing changes. It held.', { attr: { [c.T.best('physical')]: -2 }, window: 3, then: { sit: 1 } }, 'It got worse. Three bad weeks, then a game on the bench.')),
      ] }) },
  { id: 'painkiller', at: ['late', 'stretch'], w: 2, when: c => c.alive,
    make: c => ({ kicker: 'STRETCH RUN', title: 'The body is wearing down',
      body: 'Sixteen games of hits. The medical staff can manage it week to week, or you can rest now and be right in January.',
      options: [
        o('manage', 'Manage it, keep playing', { attr: { [c.T.best('physical')]: -1 } }, 'Not quite yourself the rest of the way.'),
        o('rest', 'Rest now, right for January', { sit: 1, attr: { [c.T.best('physical')]: 1 }, then: { attr: { [c.T.best('physical')]: 1 }, window: 2 } }, 'A week off, and the legs come back.'),
      ] }) },
  // ── The business ─────────────────────────────────────────────────────────
  { id: 'contract-year', at: ['early'], w: 3, when: () => true,
    make: c => ({ kicker: 'CONTRACT YEAR', title: 'Play for the numbers, or the team?',
      body: 'No extension yet. Your agent wants volume and highlights. The coach wants a player who makes everyone better.',
      options: [
        o('numbers', 'Play for the numbers', { attr: { [c.T.best('skill')]: 2 }, team: { [c.otherKey]: -1 } }, 'Big stat line. The rest of the roster covers for it.'),
        o('team', 'Team first', { team: { [c.sideKey]: 1 }, xp: 40 }, 'The tape shows a leader.'),
      ] }) },
  { id: 'captain', at: ['early'], w: 2, when: () => true,
    make: c => ({ kicker: 'CAPTAINS VOTE', title: 'The team voted you captain',
      body: 'A C on the chest: the room looks at you first after every loss.',
      options: [
        o('accept', 'Wear the C', { attr: { [c.T.best('mental')]: 1 }, team: { [c.sideKey]: 1 }, xp: 30 }, 'The unit plays harder for you.'),
        o('defer', 'Let a veteran have it', { attr: { [c.T.worst('skill')]: 1 } }, 'Quiet year. More time on your own game.'),
      ] }) },
  { id: 'award-watch', at: ['mid', 'late', 'stretch'], w: 4, when: c => c.contender && c.lastBig,
    make: c => ({ kicker: 'AWARD WATCH', title: 'Your name is in the race',
      body: 'Chasing the numbers helps the case. Balance wins games. The coach leaves it to you.',
      options: [
        o('chase', 'Chase the award', { attr: { [c.T.best('skill')]: 2 }, team: { [c.otherKey]: -1 } }, 'The stat line of your life; the other side of the ball pays.'),
        o('team', 'Win first', { team: { [c.sideKey]: 1 } }, 'Let the record make the case.'),
      ] }) },
]

// ═════════════════════════════════════════════════════════════════════════════
// FOOTBALL — by position
// ═════════════════════════════════════════════════════════════════════════════
const QB = [
  { id: 'qb-air', at: ['early', 'mid'], w: 4, when: () => true,
    make: c => ({ kicker: 'GAME PLAN', title: 'Push the ball, or take what they give',
      body: 'The coordinator asks how far down the field you want to live. Deep shots pay, and they turn the ball over.',
      options: [
        o('deep', 'Push it down the field', { attr: { arm: 2, playmaking: 1, accuracy: -1 }, window: 4 }, 'Big plays, more picks.'),
        o('short', 'Quick game, high percentage', { attr: { accuracy: 2, 'pocket-presence': 1, playmaking: -1 }, window: 4 }, 'Clean, efficient, fewer fireworks.'),
      ] }) },
  { id: 'qb-audible', at: ['early', 'mid'], w: 3, when: c => c.val('processing') >= 6,
    make: c => ({ kicker: 'THE LINE OF SCRIMMAGE', title: 'Full control at the line',
      body: 'The coach offers you the freedom to change any play you don\'t like. Great quarterbacks win with it. The rest get benched by it.',
      options: [
        o('take', 'Take the keys', gam(0.4 + (c.val('processing') - 5) * 0.06, { attr: { processing: 2, vision: 1 } }, 'You see everything. The offense is yours.', { attr: { vision: -1, processing: -1 }, window: 3 }, 'Three weeks of wrong checks.')),
        o('pass', 'Run the play that\'s called', { attr: { accuracy: 1 }, window: 3 }, 'Less to think about.'),
      ] }) },
  { id: 'qb-runs', at: ['early', 'mid', 'late'], w: 3, when: c => c.val('legs') >= 7,
    make: c => ({ kicker: 'DESIGNED RUNS', title: 'The coach wants your legs in the plan',
      body: 'Zone reads and draws every week. It\'s the best thing you do, and it\'s how quarterbacks get hurt.',
      options: [
        o('run', 'Put the runs in', gam(0.75, { attr: { legs: 2, playmaking: 1 }, window: 4 }, 'Defenses can\'t account for you.', { attr: { legs: 2 }, window: 4, then: { sit: 1 } }, 'A month of highlights, then a hit that costs you a game.')),
        o('pocket', 'Stay in the pocket', { attr: { 'pocket-presence': 1, processing: 1 }, window: 4 }, 'Boring and healthy.'),
      ] }) },
  { id: 'qb-line', at: ['mid', 'late'], w: 3, when: () => true,
    make: c => ({ kicker: 'INJURY REPORT', title: 'Two starters on the line are out',
      body: 'Backups at tackle and guard for a month. Get the ball out fast, or hold it and trust yourself.',
      options: [
        o('quick', 'Get it out fast', { attr: { accuracy: 1, arm: -1 }, window: 4 }, 'Short throws, clean jersey.'),
        o('hold', 'Hold it, make plays', { attr: { playmaking: 2, 'pocket-presence': -2 }, window: 4 }, 'Big plays and big hits.'),
      ] }) },
  { id: 'qb-wr-down', at: ['mid'], w: 3, when: () => true,
    make: c => ({ kicker: 'INJURY REPORT', title: 'Your top receiver is out for the year',
      body: 'A torn hamstring in practice. The offense loses its best weapon; someone has to get those targets.',
      options: [
        o('spread', 'Spread it around', { team: { off: -1 }, window: 3, attr: { vision: 1 } }, 'A step back for a few weeks; you learn the whole room.'),
        o('force', 'Make the new guy a star', gam(0.5, { attr: { playmaking: 1 } }, 'He steps up. New favorite target.', { attr: { accuracy: -1 }, window: 3 }, 'Forced throws, bad decisions.')),
      ] }) },
  { id: 'qb-benched', at: ['mid', 'late'], w: 5, when: c => c.lastBust && c.skid >= 2,
    make: c => ({ kicker: 'BENCHED', title: 'The coach goes to the backup',
      body: 'Three picks, four losses. You\'re sitting this week. Take the message, or fight for the job in practice.',
      options: [
        o('accept', 'Take the week, reset', { sit: 1, then: { attr: { processing: 1, accuracy: 1 }, window: 3 } }, 'A week on the sideline clears the head.'),
        o('fight', 'Fight for the job', gam(0.5, { attr: { accuracy: 2, leadership: 1 }, window: 3 }, 'You win the room back.', { sit: 2 }, 'The coach doesn\'t budge. Two weeks on the bench.')),
      ] }) },
]
const RB = [
  { id: 'rb-workhorse', at: ['early', 'mid'], w: 4, when: () => true,
    make: c => ({ kicker: 'SNAP COUNT', title: 'Twenty-five carries a game?',
      body: 'The coach wants to feed you. The trainers remind everyone what 400 touches does to a back by December.',
      options: [
        o('feed', 'Feed me', gam(0.8, { attr: { vision: 2, carrying: 1 }, window: 4, then: { attr: { strength: -1, burst: -1 }, window: 3 } }, 'A month of volume, then the legs feel it.', { attr: { vision: 2 }, window: 2, then: { sit: 1 } }, 'The volume caught up with you: a game out.')),
        o('committee', 'Share the load', { attr: { balance: 1, burst: 1 }, team: { off: 0.5 } }, 'Fresh all year. Fewer touches.'),
      ] }) },
  { id: 'rb-pass', at: ['early', 'mid'], w: 3, when: () => true,
    make: c => ({ kicker: 'ROLE', title: 'The passing game wants you',
      body: 'More routes out of the backfield. Catches and yards, but the pass protection reps come with it.',
      options: [
        o('yes', 'Make me a weapon', { attr: { hands: 2, strength: -1 }, window: 4 }, 'Catches pile up. The blocking suffers.'),
        o('no', 'Keep me between the tackles', { attr: { strength: 1, balance: 1 } }, 'Downhill all year.'),
      ] }) },
  { id: 'rb-fumbles', at: ['mid', 'late'], w: 5, when: c => (c.last?.fumbles ?? 0) >= 1,
    make: c => ({ kicker: 'BALL SECURITY', title: 'Another one on the ground',
      body: 'The coach stops practice to talk about it. High and tight all week, or keep running loose and free.',
      options: [
        o('tight', 'High and tight', { attr: { carrying: 2, elusiveness: -1 }, window: 4 }, 'The ball stays put. A little less wiggle.'),
        o('free', 'Run free, trust it', gam(0.5, { attr: { elusiveness: 1 } }, 'No more fumbles. Confidence back.', { attr: { carrying: -2 }, window: 3, then: { sit: 1 } }, 'Two more on the ground, then the bench.')),
      ] }) },
  { id: 'rb-line', at: ['mid', 'late'], w: 3, when: () => true,
    make: c => ({ kicker: 'INJURY REPORT', title: 'The line is banged up',
      body: 'Backups on the right side for a month. Be patient behind them, or hit the hole before it closes.',
      options: [
        o('patient', 'Patience, let it develop', { attr: { vision: 1, burst: -1 }, window: 4 }, 'You find the cutbacks.'),
        o('hit', 'Hit it fast', { attr: { burst: 1, vision: -1 }, window: 4 }, 'Quick to the hole, hit or miss.'),
      ] }) },
]
const WR = [
  { id: 'wr-targets', at: ['early', 'mid'], w: 4, when: () => true,
    make: c => ({ kicker: 'TARGET SHARE', title: 'Demand the ball?',
      body: 'Twelve targets a game makes a star. It also makes a quarterback force throws the whole offense pays for.',
      options: [
        o('hog', 'Demand the ball', { attr: { routeRunning: 2, afterCatch: 1 }, window: 4, team: { off: -0.5 } }, 'Your numbers jump. The offense gets predictable.'),
        o('share', 'Spread it around', { team: { off: 1 } }, 'A better offense. Fewer looks.'),
      ] }) },
  { id: 'wr-bracket', at: ['mid', 'late'], w: 4, when: c => c.lastBig,
    make: c => ({ kicker: 'BRACKETED', title: 'They\'re doubling you now',
      body: 'A corner and a safety on every snap. Beat it with releases and precision, or be the decoy that opens everyone else.',
      options: [
        o('beat', 'Beat the double', { attr: { release: 2, routeRunning: 1 }, window: 3 }, 'Harder catches, bigger plays.'),
        o('decoy', 'Be the decoy', { team: { off: 1.5 }, attr: { afterCatch: -1 }, window: 3 }, 'The offense explodes around you.'),
      ] }) },
  { id: 'wr-backup-qb', at: ['mid', 'late'], w: 3, when: () => true,
    make: c => ({ kicker: 'INJURY REPORT', title: 'The backup quarterback is starting',
      body: 'Your starter is out a month. The backup can\'t hit the deep ball. Shorten the route tree, or keep running it and hope.',
      options: [
        o('short', 'Shorten the routes', { attr: { hands: 1, awareness: 1, vertical: -1 }, window: 4 }, 'Catches keep coming. Nothing deep.'),
        o('deep', 'Keep the deep tree', gam(0.4, { attr: { vertical: 2 }, window: 4 }, 'He gets you the ball. Big month.', { attr: { routeRunning: -1, hands: -1 }, window: 4 }, 'Overthrows and underthrows all month.')),
      ] }) },
  { id: 'wr-drops', at: ['early', 'mid', 'late'], w: 5, when: c => c.lastBust,
    make: c => ({ kicker: 'THE DROPS', title: 'Two in the fourth quarter',
      body: 'Every highlight show has them. Live on the JUGS machine, or refuse to think about it.',
      options: [
        o('jugs', 'JUGS machine every day', { attr: { hands: 2, afterCatch: -1 }, window: 3 }, 'Catch everything. Fewer plays after.'),
        o('shake', 'Shake it off', gam(0.5, { attr: { hands: 1, awareness: 1 }, window: 3 }, 'Back to normal.', { attr: { hands: -2 }, window: 2 }, 'It\'s in your head now.')),
      ] }) },
]
const TE = [
  { id: 'te-block', at: ['early', 'mid'], w: 4, when: () => true,
    make: c => ({ kicker: 'ROLE', title: 'The coach needs a blocker',
      body: 'The tackles are struggling. Stay in and block, or split out and be a receiver first.',
      options: [
        o('block', 'Stay in and block', { team: { off: 1 }, attr: { routeRunning: -1, vertical: -1 }, window: 4 }, 'The quarterback stays clean. Your targets drop.'),
        o('split', 'Split me out', { attr: { routeRunning: 2, afterCatch: 1 }, team: { off: -0.5 }, window: 4 }, 'A receiver\'s month. The pocket pays.'),
      ] }) },
  { id: 'te-bracket', at: ['mid', 'late'], w: 3, when: c => c.lastBig,
    make: c => ({ kicker: 'DOUBLE COVERED', title: 'A linebacker and a safety',
      body: 'They\'ve made you the priority. Win anyway, or be the decoy that frees the outside receivers.',
      options: [
        o('win', 'Win anyway', { attr: { strength: 2, routeRunning: 1 }, window: 3 }, 'Contested catches, box-outs.'),
        o('decoy', 'Open it up for the others', { team: { off: 1.5 }, attr: { afterCatch: -1 }, window: 3 }, 'The offense hums around you.'),
      ] }) },
  { id: 'te-drops', at: ['early', 'mid', 'late'], w: 5, when: c => c.lastBust,
    make: c => ({ kicker: 'THE DROPS', title: 'One in the end zone',
      body: 'A drop that cost a game. Live on the JUGS machine, or refuse to think about it.',
      options: [
        o('jugs', 'JUGS machine every day', { attr: { hands: 2, afterCatch: -1 }, window: 3 }, 'Catch everything.'),
        o('shake', 'Shake it off', gam(0.5, { attr: { hands: 1, awareness: 1 }, window: 3 }, 'Back to normal.', { attr: { hands: -2 }, window: 2 }, 'It\'s in your head now.')),
      ] }) },
  { id: 'te-backup-qb', at: ['mid', 'late'], w: 3, when: () => true,
    make: c => ({ kicker: 'INJURY REPORT', title: 'The backup quarterback is starting',
      body: 'He checks it down. That\'s you, all month, if you want it.',
      options: [
        o('outlet', 'Be the outlet', { attr: { hands: 1, awareness: 1, vertical: -1 }, window: 4 }, 'Ten catches a game, none of them long.'),
        o('deep', 'Keep running the seams', gam(0.4, { attr: { vertical: 2 }, window: 4 }, 'He finds you deep.', { attr: { routeRunning: -1 }, window: 4 }, 'Nothing comes your way.')),
      ] }) },
]
const DB = [
  { id: 'db-shadow', at: ['early', 'mid', 'late'], w: 3, when: () => true,
    make: c => ({ kicker: 'MATCHUP', title: 'Shadow their WR1?', body: 'The coordinator wants you to travel with the league\'s leading receiver.',
      options: [
        o('shadow', 'Take him', gam(0.55, { attr: { [c.T.one('manCoverage') ?? c.T.best('skill')]: 1 }, window: 3, xp: 30 }, 'Erased him. Two catches all day.', { attr: { [c.T.one('manCoverage') ?? c.T.best('skill')]: -1 }, window: 1 }, 'He got you twice deep.')),
        o('zone', 'Stay in your zone', { attr: { [c.T.one('zoneIQ') ?? c.T.best('mental')]: 1 }, window: 3 }),
      ] }) },
  { id: 'db-gamble', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'PHILOSOPHY', title: 'Jump routes for picks?', body: 'Ballhawks get interceptions. They also give up touchdowns.',
      options: [
        o('jump', 'Jump routes', { attr: T2(c, c.T.one('hands') ?? c.T.best('skill'), c.T.one('manCoverage') ?? c.T.worst('skill')) }),
        o('disciplined', 'Stay disciplined', { attr: { [c.T.one('playRecognition', 'zoneIQ') ?? c.T.best('mental')]: 1 } }),
      ] }) },
  { id: 'db-press', at: ['early', 'mid'], w: 2, when: () => true,
    make: c => ({ kicker: 'TECHNIQUE', title: 'Press or play off?', body: 'Their receivers are small and quick.',
      options: [
        o('press', 'Press at the line', { attr: T2(c, c.T.one('press') ?? c.T.best('skill'), c.T.one('zoneIQ') ?? c.T.worst('mental')) }),
        o('off', 'Play off, read the QB', { attr: { [c.T.one('playRecognition') ?? c.T.best('mental')]: 1 }, window: 3 }),
      ] }) },
  { id: 'db-blitz', at: ['mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'NEW PACKAGE', title: 'Blitz off the edge?', body: 'The coordinator has a corner blitz for you.',
      options: [
        o('blitz', 'Send me', gam(0.5, { xp: 35, attr: { [c.T.one('runSupport') ?? c.T.best()]: 1 }, window: 2 }, 'Strip sack. The crowd erupts.', { team: { def: -1 }, window: 1 }, 'They picked it up and burned the vacated zone.')),
        o('cover', 'Stay in coverage', {}, 'Nothing changes.'),
      ] }) },
  { id: 'db-communicate', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'SECONDARY', title: 'Take over the calls?', body: 'The safety who ran the calls got hurt.',
      options: [
        o('calls', 'Run the secondary', { attr: { [c.T.one('playRecognition', 'zoneIQ') ?? c.T.best('mental')]: 1 }, team: { def: 1 } }),
        o('mine', 'Focus on your man', { attr: { [c.T.one('manCoverage') ?? c.T.best('skill')]: 1 }, window: 3 }),
      ] }) },
  { id: 'db-film-qb', at: ['early', 'mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'FILM ROOM', title: 'Their QB has a tell', body: 'He stares down his first read. Bait him?',
      options: [
        o('bait', 'Bait the throw', gam(0.5, { attr: { [c.T.one('hands') ?? c.T.best('skill')]: 2 }, window: 1 }, 'Read it, jumped it, pick-six.', { attr: { [c.T.one('manCoverage') ?? c.T.best('skill')]: -1 }, window: 1 }, 'He looked you off. Touchdown.')),
        o('honest', 'Play it honest', { attr: { [c.T.one('zoneIQ') ?? c.T.best('mental')]: 1 }, window: 1 }),
      ] }) },
  { id: 'db-tackling', at: ['mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'RUN DEFENSE', title: 'They want to run at you', body: 'Opponents are running outside at your side every week.',
      options: [
        o('fill', 'Fill hard', { attr: T2(c, c.T.one('runSupport') ?? c.T.best(), c.T.one('fluidity', 'speed') ?? c.T.worst('physical')) }),
        o('contain', 'Contain and rally', { team: { def: 1 }, window: 3 }),
      ] }) },
  { id: 'db-burned', at: ['mid', 'late'], w: 4, when: c => !c.lastWon && c.k >= 3,
    make: c => ({ kicker: 'BURNED', title: 'They picked on you', body: `${c.opp} went after your side all game.`,
      options: [
        o('film', 'Live in the film room', { attr: { [c.T.one('playRecognition', 'zoneIQ') ?? c.T.best('mental')]: 1 } }),
        o('swagger', 'Short memory', gam(0.6, { attr: { [c.T.best()]: 1 }, window: 3 }, 'You came back locked in.', { attr: { [c.T.best('mental')]: -1 }, window: 2 }, 'They kept coming at you.')),
      ] }) },
]

const OL = [
  { id: 'ol-pancake', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'MENTALITY', title: 'Pancake everybody?', body: 'Finishing blocks into the turf fires up the line, and draws flags.',
      options: [
        o('finish', 'Finish every block', { attr: T2(c, c.T.one('pancake') ?? c.T.best('skill'), c.T.one('discipline') ?? c.T.worst('mental')) }),
        o('clean', 'Stay clean', { attr: { [c.T.one('discipline') ?? c.T.best('mental')]: 1 } }),
      ] }) },
  { id: 'ol-false-starts', at: ['early', 'mid', 'late'], w: 3, when: c => (c.last?.penalties ?? 0) >= 2,
    make: c => ({ kicker: 'FLAGS', title: `${c.last.penalties} penalties last week`, body: 'The coach made you run gassers after practice.',
      options: [
        o('focus', 'Lock in on the count', { attr: { [c.T.one('discipline') ?? c.T.best('mental')]: 1 } }),
        o('aggressive', 'Stay aggressive', { attr: { [c.T.one('pancake', 'runBlock') ?? c.T.best('skill')]: 1 }, window: 3 }),
      ] }) },
  { id: 'ol-pull', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'RUN GAME', title: 'Pull on power runs?', body: 'The new run scheme has you pulling across the formation.',
      options: [
        o('pull', 'Pull', { attr: T2(c, c.T.one('mobility') ?? c.T.best('physical'), c.T.one('anchor') ?? c.T.worst('physical')) }),
        o('base', 'Base blocks only', { attr: { [c.T.one('anchor', 'runBlock') ?? c.T.best()]: 1 }, window: 3 }),
      ] }) },
  { id: 'ol-bullrush', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'SCOUTING REPORT', title: 'A 340-pound bull rusher', body: 'He walks tackles back into the QB.',
      options: [
        o('anchor', 'Sit down and anchor', { attr: { [c.T.one('anchor') ?? c.T.best('physical')]: 1 }, window: 1 }),
        o('help', 'Ask for a chip', { team: { off: -1 }, attr: { [c.T.one('passPro') ?? c.T.best('skill')]: 1 }, window: 1 }),
      ] }) },
  { id: 'ol-blitz', at: ['mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'PROTECTION', title: 'You call the protections', body: 'The center is out. You\'re making the line calls now.',
      options: [
        o('call', 'Take the calls', { attr: { [c.T.one('blitzPickup') ?? c.T.best('mental')]: 1 }, team: { off: 1 }, window: 3 }),
        o('decline', 'Let the QB do it', { attr: { [c.T.one('passPro') ?? c.T.best('skill')]: 1 }, window: 3 }),
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
        o('me', 'Through me', { attr: { [c.T.best('skill')]: 2 }, team: { [c.otherKey]: -1 } }, 'Your best football. The other side of the ball is exposed.'),
        o('control', 'Ball control, field position', { team: { def: 1.5 }, attr: { [c.T.best('skill')]: -1 } }, 'Fewer chances, fewer mistakes.'),
        o('all', 'Everyone, all in', { team: { off: 1, def: 1 }, xp: 25 }, 'Balanced. Boring. Dangerous.'),
      ] }) },
  { id: 'po-health', at: ['playoffs'], w: 3, when: () => true,
    make: c => ({ kicker: 'PLAYOFF WEEK', title: 'The body, in January',
      body: 'Nothing is healed. The trainers can numb it, or you can play it straight.',
      options: [
        o('numb', 'Whatever it takes', gam(0.6, { attr: { [c.T.best('physical')]: 2 } }, 'You feel nothing. You fly.', { attr: { [c.T.best('physical')]: -2 } }, 'It wore off in the second quarter.')),
        o('straight', 'Play it straight', { attr: { [c.T.best('mental')]: 1 } }, 'Nothing hidden, nothing lost.'),
      ] }) },
]

// ═════════════════════════════════════════════════════════════════════════════
// BASKETBALL
// ═════════════════════════════════════════════════════════════════════════════
const NBA_ALL = [
  { id: 'nba-hot-start', at: ['early'], w: 4, when: c => c.wins - c.losses >= 4,
    make: c => ({ kicker: `${c.rec} START`, title: 'League Pass favorites', body: `${c.nick} are the most watched team on the app. Ride it or tune it out?`,
      options: [
        o('ride', 'Ride the hype', gam(0.6, { attr: { [c.T.best()]: 1 } }, 'The bigger the crowd, the better you play.', { attr: { [c.T.best('mental')]: -1 }, window: c.g(3) }, 'The noise got in for a while.')),
        o('work', 'Back to the gym', { attr: { [c.T.worst()]: 1 } }),
      ] }) },
  { id: 'nba-slow-start', at: ['early', 'mid'], w: 4, when: c => c.losses - c.wins >= 4 || c.skid >= 4,
    make: c => ({ kicker: c.rec, title: 'Team meeting', body: 'The vets want a closed-door meeting. You\'re the one they\'re watching.',
      options: [
        o('call', 'Call it', gam(0.65, { team: { off: 2, def: 2 } }, 'Clear the air. They start winning.', { team: { off: -2, def: -2 }, window: c.g(2) }, 'The meeting leaked. Ugly stretch.')),
        o('wait', 'Let it work itself out', { attr: { [c.T.worst()]: 1 } }),
      ] }) },
  { id: 'nba-allstar', at: ['mid'], w: 3, when: () => true,
    make: c => ({ kicker: 'ALL-STAR BREAK', title: 'The break', body: c.wins >= 25 ? 'You made the All-Star team. Play the weekend, or rest the legs?' : 'Four days off at the break. Rest, or get in the gym?',
      options: [
        o('play', c.wins >= 25 ? 'Play the All-Star game' : 'Pick-up runs all week', { attr: { [c.T.best()]: 1 }, then: { attr: { [c.T.best('physical')]: -1 }, window: 8 }, xp: 30 }),
        o('rest', 'Rest and reset', { attr: { [c.T.worst()]: 1 } }),
      ] }) },
  { id: 'nba-deadline', at: ['mid', 'late'], w: 3, when: c => c.alive,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'The front office calls', body: `${c.nick} can rent a star for the stretch run, or hold the roster.`,
      options: [
        o('rental', 'Rent a star', { team: { off: 2 }, then: { team: { off: -1, def: -1 }, window: 6 } }),
        o('depth', 'Add a defender', { team: { def: 1 } }),
        o('pat', 'Stand pat', {}),
      ] }) },
  { id: 'nba-b2b', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'BACK-TO-BACK', title: 'Sit the second night?', body: 'Two games, two cities, two nights. The sports science staff says rest.',
      options: [
        o('rest', 'Take the night', { sit: 1, attr: { [c.T.best('physical')]: 1 }, window: 10 }),
        o('play', 'Play both', { attr: { [c.T.best('physical')]: -1 }, window: 4, xp: 15 }),
      ] }) },
  { id: 'nba-road-trip', at: ['mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'ROAD TRIP', title: 'Six games in nine nights', body: 'The longest road trip of the year. Sleep and focus are everything.',
      options: [
        o('bond', 'Team dinners, bond up', { team: { off: 1, def: 1 }, window: 6 }),
        o('solo', 'Stay in, recover', { attr: { [c.T.best('physical')]: 1 }, window: 6 }),
      ] }) },
  { id: 'nba-heater', at: ['mid', 'late', 'stretch'], w: 4, when: c => c.streak >= 6,
    make: c => ({ kicker: `${c.streak} STRAIGHT`, title: 'Unconscious', body: 'You can\'t miss right now. Keep shooting?',
      options: [
        o('shoot', 'Keep firing', gam(0.55, { attr: { [c.T.best()]: 1 }, window: 10 }, 'Still can\'t miss.', { attr: { [c.T.best()]: -1 }, window: 5 }, 'The heat check went cold.')),
        o('share', 'Get everyone involved', { team: { off: 1 }, window: 10 }),
      ] }) },
  { id: 'nba-slump', at: ['mid', 'late'], w: 4, when: c => c.skid >= 4 || c.lastBust,
    make: c => ({ kicker: 'SLUMP', title: 'The shot isn\'t falling', body: 'Three bad games in a row. The shooting coach has ideas.',
      options: [
        o('extra', 'Extra shooting at midnight', { attr: { [c.T.one('jumpShot') ?? c.T.best('skill')]: 1 }, then: { attr: { [c.T.best('physical')]: -1 }, window: 4 } }),
        o('attack', 'Attack the rim instead', { attr: { [c.T.one('finishing') ?? c.T.best('skill')]: 1 }, window: 10 }),
      ] }) },
  { id: 'nba-christmas', at: ['early', 'mid'], w: 2, when: () => true,
    make: c => ({ kicker: 'CHRISTMAS DAY', title: 'The marquee game', body: 'The whole country is watching. New shoes, new stage.',
      options: [
        o('show', 'Put on a show', gam(0.5, { attr: { [c.T.best()]: 2 }, window: 1, xp: 40 }, 'A Christmas classic.', { attr: { [c.T.best()]: -1 }, window: 1 }, 'Coal in your stocking.')),
        o('steady', 'Just another game', { attr: { [c.T.best('mental')]: 1 }, window: 3 }),
      ] }) },
  { id: 'nba-injury', at: ['mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'INJURY REPORT', title: 'Sore ankle', body: 'Rolled it on a closeout. Day-to-day.',
      options: [
        o('sit', 'Sit a week', { sit: 3 }, 'Fresh after.'),
        o('play', 'Tape it up', { attr: { [c.T.best('physical')]: -1 }, window: 12 }),
      ] }) },
  { id: 'nba-system', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'NEW SYSTEM', title: 'Pace and space', body: 'The coach wants to play faster and shoot more threes.',
      options: [
        o('buy', 'Buy in', gam(0.6, { team: { off: 1 }, attr: { [c.T.one('jumpShot', 'speed') ?? c.T.best()]: 1 } }, 'It fits you like a glove.', { team: { def: -1 }, window: c.g(3) }, 'Too fast. The defense suffers.')),
        o('old', 'Keep it half-court', { team: { def: 1 }, window: c.g(4) }),
      ] }) },
  { id: 'nba-defense', at: ['early', 'mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'IDENTITY', title: 'Become a defensive team?', body: 'The coach wants to win with stops.',
      options: [
        o('stops', 'Defense first', { team: { def: 1 }, attr: { [c.T.best('skill')]: -1 }, window: c.g(4) }),
        o('score', 'Outscore people', { team: { off: 1 }, window: c.g(4) }),
      ] }) },
  { id: 'nba-rival', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'RIVALRY NIGHT', title: 'A grudge match', body: 'Their star said you\'re "not a real No. 1 option". He\'s guarding you tonight.',
      options: [
        o('cook', 'Cook him', gam(0.55, { attr: { [c.T.best()]: 2 }, window: 1, xp: 35 }, 'You cooked him. The clip has 10M views.', { attr: { [c.T.best('mental')]: -1 }, window: 3 }, 'He got the last laugh.')),
        o('win', 'Just win', { team: { off: 1, def: 1 }, window: 1 }),
      ] }) },
  { id: 'nba-clinched', at: ['late', 'stretch'], w: 5, when: c => c.clinched,
    make: c => ({ kicker: 'CLINCHED', title: 'Rest for the playoffs?', body: `${c.nick} have a playoff spot. ${c.left} games left.`,
      options: [
        o('rest', 'Load management', { sit: 4, attr: { [c.T.best('physical')]: 1 } }),
        o('seed', 'Chase the top seed', { attr: { [c.T.best()]: 1 }, window: c.left }),
      ] }) },
  { id: 'nba-eliminated', at: ['late', 'stretch'], w: 6, when: c => c.eliminated,
    make: c => ({ kicker: 'OUT OF IT', title: 'Play out the string', body: `${c.nick} won't make it. What are the last ${c.left} games for?`,
      options: [
        o('stats', 'Pad the numbers', { attr: { [c.T.best()]: 1 } }),
        o('work', 'Work on your game', { attr: { [c.T.worst()]: 1 } }),
        o('shut', 'Shut it down', { sit: 6, xp: 10 }),
      ] }) },
  { id: 'nba-bubble', at: ['late', 'stretch'], w: 5, when: c => c.bubble,
    make: c => ({ kicker: 'PLAY-IN RACE', title: 'Every game matters', body: `${c.rec}. ${c.nick} are fighting for a spot.`,
      options: [
        o('usage', 'Put it on my back', { attr: { [c.T.best()]: 1 }, window: 10, then: { attr: { [c.T.best('physical')]: -1 }, window: 4 } }),
        o('team', 'Trust the group', { team: { off: 1, def: 1 }, window: 10 }),
      ] }) },
  { id: 'nba-mvp', at: ['mid', 'late', 'stretch'], w: 4, when: c => c.contender,
    make: c => ({ kicker: 'MVP LADDER', title: 'You\'re on the ladder', body: 'Your name climbed to No. 2 on the MVP ladder.',
      options: [
        o('chase', 'Chase it', { attr: { [c.T.best()]: 1 }, team: { def: -1 } }),
        o('wins', 'Wins first', { team: { off: 1, def: 1 } }),
      ] }) },
  { id: 'nba-weights', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'WEIGHT ROOM', title: 'Add strength mid-season?', body: 'The strength coach thinks five pounds of muscle would help inside.',
      options: [
        o('bulk', 'Add the muscle', { attr: T2(c, c.T.one('size', 'finishing') ?? c.T.best('physical'), c.T.one('speed') ?? c.T.worst('physical')) }),
        o('lean', 'Stay lean', { attr: { [c.T.one('speed', 'bounce') ?? c.T.best('physical')]: 1 }, window: c.g(4) }),
      ] }) },
  { id: 'nba-film', at: ['early', 'mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'FILM ROOM', title: 'Watch film with the coaches?', body: 'An extra hour a day in the film room.',
      options: [
        o('film', 'Every day', { attr: { [c.T.one('basketballIQ') ?? c.T.best('mental')]: 1 } }),
        o('court', 'On the court instead', { attr: { [c.T.worst('skill')]: 1 }, window: c.g(4) }),
      ] }) },
  { id: 'nba-contract', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'CONTRACT', title: 'Supermax on the table', body: 'Sign now, or bet on yourself and hit free agency?',
      options: [
        o('sign', 'Sign it', { attr: { [c.T.best('mental')]: 1 } }),
        o('bet', 'Bet on yourself', gam(0.5, { attr: { [c.T.best()]: 1 }, xp: 40 }, 'Every game is a showcase, and you\'re dominating.', { attr: { [c.T.best('mental')]: -1 }, window: c.g(3) }, 'The pressure is showing.')),
      ] }) },
  { id: 'nba-rookie', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'LOCKER ROOM', title: 'Mentor the rookie?', body: 'The lottery pick follows you everywhere.',
      options: [
        o('mentor', 'Take him under your wing', { team: { off: 1 }, attr: { [c.T.best('physical')]: -1 }, window: 10, xp: 25 }),
        o('self', 'Focus on yourself', { attr: { [c.T.worst('skill')]: 1 } }),
      ] }) },
  { id: 'nba-trash', at: ['early', 'mid', 'late'], w: 1, when: c => !!c.last,
    make: c => ({ kicker: 'POSTGAME', title: `${c.opp} chirping`, body: 'Their bench was talking all night. The rematch is next week.',
      options: [
        o('back', 'Talk back', gam(0.55, { attr: { [c.T.best()]: 1 }, window: 6 }, 'You backed it up.', { attr: { [c.T.best('mental')]: -1 }, window: 4 }, 'Technical fouls and bad shots.')),
        o('quiet', 'Stay quiet', { attr: { [c.T.best('mental')]: 1 }, window: 6 }),
      ] }) },
]
const GUARD = [
  { id: 'g-shots', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'SHOT DIET', title: 'Threes or the rim?', body: 'The analytics staff wants fewer mid-range shots.',
      options: [
        o('threes', 'Live behind the arc', { attr: T2(c, c.T.one('jumpShot') ?? c.T.best('skill'), c.T.one('finishing') ?? c.T.worst('skill')) }),
        o('rim', 'Attack the rim', { attr: T2(c, c.T.one('finishing') ?? c.T.best('skill'), c.T.one('jumpShot') ?? c.T.worst('skill')) }),
      ] }) },
  { id: 'g-point', at: ['early', 'mid'], w: 2, when: () => true,
    make: c => ({ kicker: 'ROLE', title: 'Run the point?', body: 'The starting point guard is hurt. Someone has to run the offense.',
      options: [
        o('point', 'Take the keys', { attr: { [c.T.one('passing') ?? c.T.best('skill')]: 1, [c.T.one('jumpShot') ?? c.T.worst('skill')]: -1 }, window: 12 }),
        o('score', 'Keep scoring', { attr: { [c.T.best()]: 1 }, window: 6 }),
      ] }) },
  { id: 'g-lockdown', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'ASSIGNMENT', title: 'Guard their best scorer?', body: 'The coach wants you on the other team\'s star all night.',
      options: [
        o('lock', 'Lock him up', { attr: T2(c, c.T.one('perimeterDefense') ?? c.T.best('skill'), c.T.one('jumpShot', 'finishing') ?? c.T.worst('skill')), window: 6 }),
        o('save', 'Save your legs for offense', { attr: { [c.T.best()]: 1 }, window: 6 }),
      ] }) },
  { id: 'g-stepback', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'DEVELOPMENT', title: 'Add a step-back?', body: 'Your trainer has a move for you.',
      options: [
        o('add', 'Add the move', gam(0.6, { attr: { [c.T.one('handles') ?? c.T.best('skill')]: 1 } }, 'Ankles everywhere.', { attr: { [c.T.one('handles') ?? c.T.best('skill')]: -1 }, window: 6 }, 'Turnovers while you learn it.')),
        o('no', 'Stick to your bag', {}),
      ] }) },
  { id: 'g-clutch', at: ['mid', 'late', 'stretch'], w: 2, when: () => true,
    make: c => ({ kicker: 'CRUNCH TIME', title: 'Take the last shot?', body: 'Down one, five seconds left last night. The coach drew it up for someone else.',
      options: [
        o('mine', 'Demand the ball', { attr: { [c.T.one('clutch') ?? c.T.best('mental')]: 1 }, xp: 20 }),
        o('team', 'Trust the play call', { team: { off: 1 }, window: 6 }),
      ] }) },
]
const BIG = [
  { id: 'b-stretch', at: ['early', 'mid'], w: 2, when: () => true,
    make: c => ({ kicker: 'DEVELOPMENT', title: 'Stretch the floor?', body: 'The coach wants you to take threes.',
      options: [
        o('three', 'Let it fly', { attr: T2(c, c.T.one('jumpShot') ?? c.T.best('skill'), c.T.one('rebounding') ?? c.T.worst('skill')) }),
        o('paint', 'Stay in the paint', { attr: { [c.T.one('finishing', 'rebounding') ?? c.T.best('skill')]: 1 } }),
      ] }) },
  { id: 'b-rim', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'IDENTITY', title: 'Become a rim protector?', body: 'Block everything, or stay out of foul trouble.',
      options: [
        o('block', 'Block everything', gam(0.6, { attr: { [c.T.one('interiorDefense') ?? c.T.best('skill')]: 1 } }, 'Nobody comes in the paint.', { sit: 1, attr: { [c.T.one('interiorDefense') ?? c.T.best('skill')]: -1 }, window: 4 }, 'Foul trouble every night.')),
        o('wall', 'Wall up, no fouls', { team: { def: 1 }, window: c.g(4) }),
      ] }) },
  { id: 'b-boards', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'GLASS', title: 'Crash the offensive glass?', body: 'More second chances, fewer transition stops.',
      options: [
        o('crash', 'Crash it', { attr: { [c.T.one('rebounding') ?? c.T.best('skill')]: 1 }, team: { def: -1 }, window: c.g(4) }),
        o('back', 'Get back on D', { team: { def: 1 }, window: c.g(4) }),
      ] }) },
  { id: 'b-hub', at: ['mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'NEW WRINKLE', title: 'Run the offense through you?', body: 'Point center, dribble hand-offs, the whole thing.',
      options: [
        o('hub', 'Be the hub', { attr: T2(c, c.T.one('playmaking') ?? c.T.best('skill'), c.T.one('finishing') ?? c.T.worst('skill')) }),
        o('roll', 'Just roll to the rim', { attr: { [c.T.one('finishing') ?? c.T.best('skill')]: 1 }, window: c.g(4) }),
      ] }) },
  { id: 'b-matchup', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'MATCHUP', title: 'The best center in the league', body: 'He\'s seven feet of trouble, and he\'s in town tonight.',
      options: [
        o('battle', 'Battle him', gam(0.5, { attr: { [c.T.best()]: 2 }, window: 1, xp: 30 }, 'You won the war in the paint.', { attr: { [c.T.best('physical')]: -1 }, window: 4 }, 'He bullied you.')),
        o('scheme', 'Double him', { team: { def: 1 }, window: 1 }),
      ] }) },
]
const NBA_PLAYOFFS = [
  { id: 'nbapo-takeover', at: ['playoffs'], w: 2, when: () => true,
    make: c => ({ kicker: 'BEFORE THE PLAYOFFS', title: 'The second season', body: 'The stage gets bigger. How do you want to play the postseason?',
      options: [
        o('takeover', 'Take over', { attr: T2(c, c.T.best(), c.T.worst()) }),
        o('steady', 'Trust the system', { team: { def: 1 } }),
      ] }) },
  { id: 'nbapo-minutes', at: ['playoffs'], w: 2, when: () => true,
    make: c => ({ kicker: 'PLAYOFF MINUTES', title: '44 minutes a night?', body: 'The coach asks if you can handle more minutes.',
      options: [
        o('more', 'Play me 44', { attr: { [c.T.best()]: 1, [c.T.best('physical')]: -1 } }),
        o('normal', 'Normal minutes', { team: { off: 1 } }),
      ] }) },
  { id: 'nbapo-revenge', at: ['playoffs'], w: 1, when: () => true,
    make: c => ({ kicker: 'FIRST ROUND', title: 'The team that knocked you out', body: 'Last year\'s nightmare is this year\'s matchup.',
      options: [
        o('revenge', 'Revenge tour', gam(0.55, { attr: { [c.T.best()]: 1 } }, 'Not this year.', { attr: { [c.T.best('mental')]: -1 } }, 'Same nightmare.')),
        o('fresh', 'Fresh start', { attr: { [c.T.best('mental')]: 1 } }),
      ] }) },
  { id: 'nbapo-hurt', at: ['playoffs'], w: 1, when: () => true,
    make: c => ({ kicker: 'INJURY REPORT', title: 'A sprained wrist', body: 'You can play. The question is how.',
      options: [
        o('play', 'Play through it', { attr: { [c.T.one('jumpShot') ?? c.T.best('skill')]: -1 } }),
        o('drive', 'Attack the rim more', { attr: { [c.T.one('finishing') ?? c.T.best('skill')]: 1, [c.T.one('jumpShot') ?? c.T.worst('skill')]: -1 } }),
      ] }) },
]

const BANK = {
  nfl: { all: NFL_ALL, qb: QB, rb: RB, wr: WR, te: TE, db: DB, ol: OL, playoffs: NFL_PLAYOFFS },
  bucket: { all: NBA_ALL, guard: GUARD, big: BIG, playoffs: NBA_PLAYOFFS },
}
// How many scenarios each position can draw from (for the record)
export const bankSize = (sport, pos) => (BANK[sport]?.all.length ?? 0) + (BANK[sport]?.[pos]?.length ?? 0) + (BANK[sport]?.playoffs.length ?? 0)

// Recently seen scenarios rotate to the back so seasons don't repeat
const RECENT_KEY = 'bap_scn_recent'
const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] } }
const remember = id => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recent().filter(x => x !== id)].slice(0, 30))) } catch {} }

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
  const total = fits.reduce((a, s) => a + weight(s), 0)
  let roll = c.r() * total, pick = fits[0]
  for (const s of fits) { roll -= weight(s); if (roll <= 0) { pick = s; break } }
  let card
  try { card = pick.make(c) } catch { return null }
  const scope = ph === 'playoffs' ? 'for the playoffs' : ''
  remember(pick.id)
  return {
    id: pick.id, kicker: card.kicker, title: card.title, body: card.body,
    options: card.options.map(op => ({ id: op.id, label: op.label, sub: isEmpty(op.effect) ? (op.flavor || 'Nothing changes.') : [op.flavor, describe(op.effect, c, scope)].filter(Boolean).join(' '), effect: op.effect })),
  }
}
