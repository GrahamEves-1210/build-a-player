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
  { id: 'hot-start', at: ['early'], w: 4, when: c => c.losses === 0 || c.wins - c.losses >= 2,
    make: c => ({ kicker: `${c.rec} START`, title: 'Everyone\'s watching',
      body: `${c.nick} are the early story of the league and your name is in every segment. Ride it, or keep the noise out?`,
      options: [
        o('embrace', 'Embrace the spotlight', gam(0.6, { attr: { [c.T.best()]: 1 } }, 'You feed off it. The big games get bigger.', { attr: { [c.T.best('mental')]: -1 }, window: 3 }, 'The noise got in. A few quiet weeks follow.')),
        o('quiet', 'Nothing\'s won yet', { attr: { [c.T.worst()]: 1 } }, 'Back to work on the weak spot.'),
      ] }) },
  { id: 'early-hole', at: ['early', 'mid'], w: 4, when: c => c.skid >= 2 || c.losses - c.wins >= 2,
    make: c => ({ kicker: c.rec, title: 'Players-only meeting',
      body: 'The locker room is tight and the vets are looking at you. Call the meeting?',
      options: [
        o('meeting', 'Call it', gam(0.65, { team: { [c.sideKey]: 1 } }, 'The room responded. Different energy from here.', { team: { off: -1, def: -1 }, window: 2 }, 'It leaked to the media. Two ugly weeks.')),
        o('process', 'Let the coaches handle it', { attr: { [c.T.worst()]: 1 } }, 'Extra work on your weak spot instead.'),
      ] }) },
  { id: 'film-reps', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'BYE WEEK', title: 'Extra film or extra reps?', body: 'A week off and a choice about where the hours go.',
      options: [
        o('film', 'Film room', { attr: { [c.T.worst('mental')]: 1 } }),
        o('reps', 'On the field', { attr: { [c.T.worst('physical')]: 1 } }),
      ] }) },
  { id: 'contract-year', at: ['early'], w: 2, when: () => true,
    make: c => ({ kicker: 'CONTRACT YEAR', title: 'Bet on yourself?',
      body: 'Your agent says the front office has a number ready. Sign now, or play it out and test the market?',
      options: [
        o('bet', 'Bet on yourself', gam(0.5, { attr: { [c.T.best()]: 1 }, xp: 40 }, 'Every snap is an audition, and you\'re crushing it.', { attr: { [c.T.best('mental')]: -1 }, window: 3 }, 'The pressure shows for a few weeks.')),
        o('sign', 'Sign the extension', { attr: { [c.T.best('mental')]: 1 } }, 'Peace of mind. You just play.'),
      ] }) },
  { id: 'rookie-mentor', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'NEW FACE', title: 'Take the rookie under your wing?',
      body: `${c.nick} drafted a kid at your position, and he follows you everywhere. Mentoring takes time you'd spend on yourself.`,
      options: [
        o('mentor', 'Mentor him', { team: { [c.sideKey]: 1 }, attr: { [c.T.best('physical')]: -1 }, window: 3, xp: 25 }, 'The whole unit gets sharper.'),
        o('self', 'Your career first', { attr: { [c.T.worst('skill')]: 1 } }),
      ] }) },
  { id: 'trash-talk', at: ['early', 'mid', 'late'], w: 2, when: c => !!c.last,
    make: c => ({ kicker: 'POSTGAME', title: `${c.opp} talk trash`,
      body: `A ${c.opp} player says you're "overrated" on a podcast. Reporters want a response before the rematch talk starts.`,
      options: [
        o('fire', 'Fire back', gam(0.55, { attr: { [c.T.best()]: 1 }, window: 3, xp: 20 }, 'You backed it up. The clip goes viral.', { attr: { [c.T.best('mental')]: -1 }, window: 2 }, 'You pressed. Two forced games.')),
        o('quiet', 'Let your play talk', { attr: { [c.T.best('mental')]: 1 }, window: 4 }),
      ] }) },
  { id: 'hamstring', at: ['early', 'mid'], w: 2, when: () => true,
    make: c => ({ kicker: 'INJURY REPORT', title: 'Tight hamstring',
      body: 'Nothing torn, but it grabs on every sprint. The trainers will clear you either way.',
      options: [
        o('play', 'Play through it', { attr: { [c.T.best('physical')]: -1 }, window: 3 }),
        o('sit', 'Sit one out', { sit: 1 }, 'Back at full strength after.'),
      ] }) },
  { id: 'primetime', at: ['mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'PRIMETIME', title: 'Sunday night, everyone watching',
      body: `${c.nick} get the national stage this week. How do you want to approach it?`,
      options: [
        o('prep', 'Grind the game plan', { attr: { [c.T.best('mental')]: 1 }, window: 2 }),
        o('loose', 'Play loose, have fun', gam(0.5, { attr: { [c.T.best()]: 1 }, window: 3, xp: 25 }, 'Lights on, you showed out.', { attr: { [c.T.worst()]: -1 }, window: 2 }, 'Too loose. Sloppy football.')),
      ] }) },
  { id: 'deadline', at: ['mid'], w: 3, when: c => c.alive,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'The front office calls',
      body: `${c.nick} can rent a star for the stretch run, or add depth on the other side of the ball.`,
      options: [
        o('rental', c.isDef ? 'Trade for a playmaker' : 'Rent a star', { team: { off: 2 }, then: { team: { off: -1, def: -1 }, window: 2 } }, 'Chemistry takes a couple of games.'),
        o('depth', c.isDef ? 'Add a pass rusher' : 'Shore up the defense', { team: { def: 1 } }),
        o('pat', 'Stand pat', {}, 'Keep the picks.'),
      ] }) },
  { id: 'deadline-sell', at: ['mid'], w: 4, when: c => c.struggling,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'Sellers at the deadline',
      body: `${c.nick} are shopping veterans for picks. Your name came up in one call, and the GM wants to know where your head is.`,
      options: [
        o('commit', 'Say you want to stay', { attr: { [c.T.best('mental')]: 1 }, team: { off: -1 } }, 'They keep you and sell others.'),
        o('quiet', 'Stay out of it', { team: { off: -1, def: -1 }, window: 3 }, 'Two starters leave. Rough few weeks.'),
      ] }) },
  { id: 'skid-benched', at: ['mid', 'late'], w: 4, when: c => c.skid >= 3,
    make: c => ({ kicker: `${c.skid} STRAIGHT LOSSES`, title: 'The critics are loud',
      body: 'Talk radio wants a change. The coach backs you in public, but he wants a response on the field.',
      options: [
        o('answer', 'Answer them', gam(0.55, { attr: { [c.T.best()]: 1 }, window: 4 }, 'You came out swinging. Skid over.', { attr: { [c.T.best('mental')]: -1 }, window: 2 }, 'Pressing. It got worse before it got better.')),
        o('tune', 'Tune it out', { attr: { [c.T.best('mental')]: 1 } }),
      ] }) },
  { id: 'heater', at: ['mid', 'late', 'stretch'], w: 4, when: c => c.streak >= 4,
    make: c => ({ kicker: `${c.streak} STRAIGHT WINS`, title: 'Ride the wave',
      body: `${c.nick} haven't lost in a month. Do you change anything?`,
      options: [
        o('routine', 'Same routine, every day', { attr: { [c.T.best('mental')]: 1 }, window: 3 }),
        o('push', 'Push for more', gam(0.5, { attr: { [c.T.best()]: 1 } }, 'Another gear. The streak rolls on.', { attr: { [c.T.best('physical')]: -1 }, window: 2 }, 'Overdid it. The legs feel it.')),
      ] }) },
  { id: 'hot-seat', at: ['mid', 'late'], w: 3, when: c => c.losses > c.wins && !c.eliminated,
    make: c => ({ kicker: 'HOT SEAT', title: 'Your coach might be gone',
      body: 'Reports say the head coach is one more bad loss from being fired. The players are split.',
      options: [
        o('rally', 'Rally around him', gam(0.6, { team: { off: 1, def: 1 }, window: 3, xp: 20 }, 'The team plays for him. He keeps his job.', { team: { off: -1 }, window: 2 }, 'It wasn\'t enough. He\'s out, and the interim staff stumbles.')),
        o('neutral', 'Stay out of it', { attr: { [c.T.worst()]: 1 } }),
      ] }) },
  { id: 'feud', at: ['early', 'mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'LOCKER ROOM', title: 'Two teammates squaring off',
      body: 'A shoving match in practice made the news. As a leader in that room, you can step in or stay clear.',
      options: [
        o('squash', 'Step in and squash it', gam(0.7, { team: { [c.sideKey]: 1 }, xp: 20 }, 'Handled. The room tightens up.', { team: { off: -1, def: -1 }, window: 2 }, 'It blew up again. Two rough games.')),
        o('clear', 'Stay clear', { team: { off: -1, def: -1 }, window: 1 }),
      ] }) },
  { id: 'community', at: ['early', 'mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'OFF THE FIELD', title: 'Hospital visit or recovery day?',
      body: 'The team asks if you\'ll lead a children\'s hospital visit on your recovery day.',
      options: [
        o('visit', 'Lead the visit', { xp: 60, attr: { [c.T.best('physical')]: -1 }, window: 1 }, 'A day nobody there forgets.'),
        o('recover', 'Take the recovery day', { attr: { [c.T.worst('physical')]: 1 }, window: 3 }),
      ] }) },
  { id: 'fantasy', at: ['mid', 'late'], w: 3, when: c => c.lastBig,
    make: c => ({ kicker: 'AFTER A BIG GAME', title: 'Fantasy football\'s darling',
      body: `After last week, you're the most added player in fantasy. Everyone expects a repeat.`,
      options: [
        o('lean', 'Chase another one', gam(0.5, { attr: { [c.T.best()]: 1 }, window: 3, xp: 25 }, 'Back-to-back. Leagues are won with you.', { attr: { [c.T.worst()]: -1 }, window: 2 }, 'Forcing it. A dud follows.')),
        o('humble', 'Stay humble', { attr: { [c.T.best('mental')]: 1 }, window: 3 }),
      ] }) },
  { id: 'short-week', at: ['mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'THURSDAY NIGHT', title: 'Short week',
      body: 'Three days to recover from Sunday. The body says rest, the game plan says practice.',
      options: [
        o('rest', 'Rest the body', { attr: { [c.T.best('mental')]: -1 }, window: 1, then: { attr: { [c.T.best('physical')]: 1 }, window: 3 } }),
        o('grind', 'Practice anyway', { attr: { [c.T.best('mental')]: 1, [c.T.best('physical')]: -1 }, window: 2 }),
      ] }) },
  { id: 'weather', at: ['late', 'stretch'], w: 2, when: () => true,
    make: c => ({ kicker: 'FORECAST: SNOW', title: 'A blizzard game',
      body: 'Eight inches expected by kickoff. Footing and grip are going to be a problem.',
      options: [
        o('ground', 'Simplify, play it safe', { team: { [c.otherKey]: 1 }, attr: { [c.T.best()]: -1 }, window: 1 }),
        o('attack', 'Attack anyway', gam(0.45, { attr: { [c.T.best()]: 1 }, window: 1, xp: 30 }, 'A snow-globe classic. The highlight lives forever.', { attr: { [c.T.best('skill')]: -1 }, window: 1 }, 'The ball was a bar of soap.')),
      ] }) },
  { id: 'nag-late', at: ['late', 'stretch'], w: 2, when: c => c.alive,
    make: c => ({ kicker: `WEEK ${c.stop.at}`, title: 'Nagging injury',
      body: 'Nothing structural, but it\'s there every snap. The trainers leave it to you.',
      options: [
        o('through', 'Play through it', { attr: { [c.T.best('physical')]: -1 }, window: c.left }),
        o('sit', 'Sit one out', { sit: 1 }, 'Full strength after.'),
      ] }) },
  { id: 'push', at: ['late', 'stretch'], w: 4, when: c => c.alive && !c.clinched,
    make: c => ({ kicker: 'PLAYOFF PUSH', title: 'How do you finish?', body: `${c.rec} with ${c.left} to play. Every game is a playoff game now.`,
      options: [
        o('moon', 'Shoot for the moon', { attr: T2(c, c.T.best(), c.T.worst()) }),
        o('ball', 'Protect the ball', { attr: T2(c, c.T.best('mental'), c.T.best('physical')) }),
      ] }) },
  { id: 'bubble', at: ['late', 'stretch'], w: 5, when: c => c.bubble,
    make: c => ({ kicker: 'ON THE BUBBLE', title: 'Win and stay alive',
      body: `${c.rec}. The playoff line runs right through ${c.nick}. The coach asks what you need.`,
      options: [
        o('ball', 'Give me the ball', { attr: { [c.T.best()]: 1 }, window: 2, then: { attr: { [c.T.best('physical')]: -1 }, window: 2 } }),
        o('trust', 'Trust the whole roster', { team: { off: 1, def: 1 }, window: 2 }),
      ] }) },
  { id: 'clinched', at: ['late', 'stretch'], w: 5, when: c => c.clinched && c.left >= 2,
    make: c => ({ kicker: 'CLINCHED', title: 'Rest or rhythm?', body: `${c.nick} are in. ${c.left} games left that don't decide much.`,
      options: [
        o('rest', 'Rest up for January', { sit: 1, attr: { [c.T.best('physical')]: 1 } }, 'Fresh legs for the run.'),
        o('rhythm', 'Keep the rhythm', { attr: { [c.T.best()]: 1 }, window: c.left }),
      ] }) },
  { id: 'eliminated', at: ['late', 'stretch'], w: 6, when: c => c.eliminated,
    make: c => ({ kicker: 'ELIMINATED', title: 'Play for pride',
      body: `${c.nick} are out of it. The last ${c.left} games are about you now.`,
      options: [
        o('weak', 'Fix the weak spot', { attr: { [c.T.worst()]: 1 } }),
        o('showcase', 'Showcase for next year', gam(0.55, { attr: { [c.T.best()]: 1 }, xp: 30 }, 'A statement finish.', { attr: { [c.T.best('physical')]: -1 }, window: 2 }, 'Pushed too hard. The body says enough.')),
        o('shut', 'Shut it down early', { sit: 2, xp: 10 }),
      ] }) },
  { id: 'mvp-chatter', at: ['mid', 'late', 'stretch'], w: 4, when: c => c.contender && c.lastBig,
    make: c => ({ kicker: 'AWARD WATCH', title: 'Your name is in the race',
      body: 'The award talk has started. Chasing numbers helps the case, but the team wins with balance.',
      options: [
        o('stats', 'Chase the numbers', { attr: { [c.T.best()]: 1 }, team: { [c.otherKey]: -1 } }),
        o('team', 'Team first', { team: { [c.sideKey]: 1 } }),
      ] }) },
  { id: 'scare', at: ['late', 'stretch'], w: 2, when: () => true,
    make: c => ({ kicker: 'INJURY SCARE', title: 'You came up limping',
      body: 'X-rays negative. The doctors want an MRI, and the results could keep you out a week.',
      options: [
        o('mri', 'Get the MRI', { sit: 1 }, 'Clean scan. You come back healthy.'),
        o('play', 'Skip it and play', gam(0.7, {}, 'Just a bruise. Nothing changes.', { attr: { [c.T.best('physical')]: -1 } }, 'It was worse than it looked. Slower the rest of the way.')),
      ] }) },
  { id: 'revenge', at: ['early', 'mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'REVENGE GAME', title: 'Your old team is next',
      body: 'The team that let you walk is on the schedule. Everyone knows what this one means.',
      options: [
        o('circle', 'Circle it in red', gam(0.55, { attr: { [c.T.best()]: 2 }, window: 1, xp: 35 }, 'They should have kept you.', { attr: { [c.T.best('mental')]: -1 }, window: 1 }, 'Too amped. It got away from you.')),
        o('another', 'Just another game', { attr: { [c.T.best('mental')]: 1 }, window: 2 }),
      ] }) },
  { id: 'holiday', at: ['late'], w: 2, when: () => true,
    make: c => ({ kicker: 'THANKSGIVING', title: 'The holiday game',
      body: 'The biggest TV audience of the regular season, and a short week to get ready.',
      options: [
        o('show', 'Put on a show', gam(0.5, { attr: { [c.T.best()]: 1 }, window: 1, xp: 40 }, 'Turkey leg on the podium. Unforgettable.', { attr: { [c.T.worst()]: -1 }, window: 1 }, 'A holiday you\'d rather forget.')),
        o('steady', 'Keep it simple', { attr: { [c.T.best('mental')]: 1 }, window: 1 }),
      ] }) },
  { id: 'new-scheme', at: ['early', 'mid'], w: 1, when: c => !c.isDef,
    make: c => ({ kicker: 'NEW PLAYBOOK', title: 'The coordinator installs a new scheme',
      body: 'A new install for the second half. Learn it fast and it opens things up; if not, you\'re a step slow for a while.',
      options: [
        o('learn', 'Live in the playbook', gam(0.6, { attr: { [c.T.best('skill')]: 1 } }, 'It clicks. New wrinkles every week.', { attr: { [c.T.best('skill')]: -1 }, window: 2 }, 'Two weeks of busted plays.')),
        o('old', 'Stick with what works', {}, 'Nothing changes.'),
      ] }) },
  { id: 'pro-bowl', at: ['late', 'stretch'], w: 1, when: c => c.wins >= c.losses,
    make: c => ({ kicker: 'PRO BOWL VOTING', title: 'The fan vote is close',
      body: 'Your team wants you to push the vote on social. It takes time and attention during the week.',
      options: [
        o('campaign', 'Campaign for votes', { xp: 50, attr: { [c.T.best('mental')]: -1 }, window: 1 }),
        o('ignore', 'Ignore it', { attr: { [c.T.best('mental')]: 1 }, window: 2 }),
      ] }) },
  { id: 'travel', at: ['mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'ROAD TRIP', title: 'Back-to-back cross-country flights',
      body: 'Two road games in two time zones. Sleep is going to be the problem.',
      options: [
        o('early', 'Fly out a day early', { attr: { [c.T.best('physical')]: 1 }, window: 2, xp: 10 }),
        o('normal', 'Normal schedule', { attr: { [c.T.best('physical')]: -1 }, window: 2, then: { attr: { [c.T.best('mental')]: 1 }, window: 2 } }),
      ] }) },
  { id: 'captain', at: ['early'], w: 1, when: () => true,
    make: c => ({ kicker: 'CAPTAINS VOTE', title: 'The team voted you captain',
      body: 'A C on your chest means more meetings, more media and more weight on your shoulders.',
      options: [
        o('accept', 'Wear the C', { attr: { [c.T.best('mental')]: 1 }, team: { [c.sideKey]: 1 }, then: { attr: { [c.T.best('physical')]: -1 }, window: 2 }, xp: 30 }),
        o('defer', 'Let a vet have it', { attr: { [c.T.worst('skill')]: 1 } }),
      ] }) },
]

// ═════════════════════════════════════════════════════════════════════════════
// FOOTBALL — by position
// ═════════════════════════════════════════════════════════════════════════════
const QB = [
  { id: 'qb-audible', at: ['early', 'mid'], w: 2, when: () => true,
    make: c => ({ kicker: 'AT THE LINE', title: 'Full control at the line',
      body: 'The coordinator offers you freedom to audible out of anything. More on your plate, more ways to win.',
      options: [
        o('take', 'Take the keys', gam(0.6, { attr: { [c.T.one('processing', 'vision') ?? c.T.best('mental')]: 1 } }, 'You see it before the snap now.', { attr: { [c.T.one('processing') ?? c.T.best('mental')]: -1 }, window: 2 }, 'Overthinking. Two delay-of-game weeks.')),
        o('calls', 'Run the calls you get', { attr: { [c.T.one('accuracy') ?? c.T.best('skill')]: 1 }, window: 4 }),
      ] }) },
  { id: 'qb-deep', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'GAME PLAN', title: 'Air it out or move the chains?',
      body: 'The defense has been playing deep. The staff wants to know which way you lean.',
      options: [
        o('deep', 'Air it out', { attr: T2(c, c.T.one('arm') ?? c.T.best('physical'), c.T.one('pocket-presence') ?? c.T.worst('skill')) }),
        o('short', 'Dink and dunk', { attr: T2(c, c.T.one('accuracy') ?? c.T.best('skill'), c.T.one('arm') ?? c.T.worst('physical')) }),
      ] }) },
  { id: 'qb-scramble', at: ['early', 'mid', 'late'], w: 2, when: c => c.T.has('legs'),
    make: c => ({ kicker: 'SCRAMBLE DRILL', title: 'Use your legs more?',
      body: 'Defenses are dropping eight into coverage. The lanes to run are there if you want them.',
      options: [
        o('run', 'Take off when it\'s there', { attr: T2(c, 'legs', c.T.one('pocket-presence') ?? c.T.worst('skill')) }),
        o('pocket', 'Stay in the pocket', { attr: T2(c, c.T.one('pocket-presence') ?? c.T.best('skill'), 'legs') }),
      ] }) },
  { id: 'qb-tackle-out', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'INJURY REPORT', title: 'Your left tackle is out',
      body: 'Three weeks without your blindside protector. Pass rushers are licking their lips.',
      options: [
        o('quick', 'Get it out fast', { attr: { [c.T.one('processing') ?? c.T.best('mental')]: 1, [c.T.one('arm') ?? c.T.best('physical')]: -1 }, window: 3 }),
        o('extend', 'Extend plays', gam(0.5, { attr: { [c.T.one('legs', 'playmaking') ?? c.T.best()]: 1 }, window: 3 }, 'Escape artist. Defenders grab air.', { attr: { [c.T.one('pocket-presence') ?? c.T.worst()]: -1 }, window: 3 }, 'Sacked six times in one game.')),
      ] }) },
  { id: 'qb-wr1', at: ['early', 'mid'], w: 2, when: () => true,
    make: c => ({ kicker: 'SIDELINE', title: 'Your WR1 wants the ball',
      body: 'He was caught on camera yelling "I\'m open!" at you. He has a point, he usually is.',
      options: [
        o('feed', 'Feed him', { team: { off: 1 }, attr: { [c.T.one('vision') ?? c.T.best('mental')]: -1 }, window: 3 }),
        o('spread', 'Spread it around', { attr: { [c.T.one('vision') ?? c.T.best('mental')]: 1 } }),
      ] }) },
  { id: 'qb-picks', at: ['early', 'mid', 'late', 'stretch'], w: 5, when: c => (c.last?.ints ?? 0) >= 2,
    make: c => ({ kicker: `${c.last.ints} INTERCEPTIONS`, title: 'Rough day throwing it',
      body: `${c.last.ints} picks against ${c.opp}. Do you stay aggressive or play it safe for a while?`,
      options: [
        o('aggressive', 'Stay aggressive', gam(0.5, { attr: { [c.T.one('playmaking') ?? c.T.best()]: 1 } }, 'Short memory. You come back firing.', { attr: { [c.T.one('accuracy') ?? c.T.worst()]: -1 }, window: 3 }, 'More forced throws. A few more picks.')),
        o('checkdown', 'Take the check-down', { attr: T2(c, c.T.one('accuracy') ?? c.T.best('skill'), c.T.one('playmaking') ?? c.T.worst('skill')), window: 3 }),
      ] }) },
  { id: 'qb-two-minute', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'PRACTICE', title: 'Where do the extra reps go?', body: 'The coaches give you an extra period this week.',
      options: [
        o('2min', 'Two-minute drill', { attr: { [c.T.one('pocket-presence') ?? c.T.best('skill')]: 1 } }),
        o('redzone', 'Red-zone reps', { attr: { [c.T.one('playmaking') ?? c.T.worst('skill')]: 1 } }),
      ] }) },
  { id: 'qb-mechanics', at: ['early', 'mid'], w: 2, when: () => true,
    make: c => ({ kicker: 'THROWING COACH', title: 'Rebuild your mechanics?',
      body: 'A private throwing coach thinks he can fix your release. Rebuilding mid-season is a risk.',
      options: [
        o('rebuild', 'Rebuild it', gam(0.6, { attr: { [c.T.one('accuracy') ?? c.T.best('skill')]: 1 } }, 'Tighter spiral, quicker release.', { attr: { [c.T.one('accuracy') ?? c.T.best('skill')]: -1 }, window: 3 }, 'It feels foreign for a few weeks.')),
        o('tweak', 'Small tweaks only', { attr: { [c.T.one('arm') ?? c.T.best('physical')]: 1 }, window: 4 }),
      ] }) },
  { id: 'qb-backup', at: ['mid', 'late'], w: 4, when: c => c.skid >= 2 || c.lastBust,
    make: c => ({ kicker: 'QB CONTROVERSY', title: 'The backup looked good',
      body: 'Your backup finished last week\'s garbage time with two touchdowns. The fans are chanting his name.',
      options: [
        o('respond', 'Answer on the field', gam(0.6, { attr: { [c.T.best()]: 1 }, window: 4 }, 'No controversy here. The job is yours.', { attr: { [c.T.one('leadership') ?? c.T.best('mental')]: -1 }, window: 3 }, 'The chants got loud. You heard them.')),
        o('embrace', 'Praise him publicly', { attr: { [c.T.one('leadership') ?? c.T.best('mental')]: 1 }, team: { off: 1 }, window: 2 }),
      ] }) },
  { id: 'qb-legend-film', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'MENTOR', title: 'A Hall of Famer calls',
      body: 'A retired legend offers a film session on how defenses are disguising coverage against you.',
      options: [
        o('film', 'Take the session', { attr: { [c.T.one('vision', 'processing') ?? c.T.best('mental')]: 1 }, xp: 25 }),
        o('decline', 'Stick to your process', { attr: { [c.T.worst('skill')]: 1 }, window: 4 }),
      ] }) },
  { id: 'qb-rpo', at: ['early', 'mid', 'late'], w: 2, when: c => c.T.has('legs'),
    make: c => ({ kicker: 'NEW WRINKLE', title: 'An RPO package for you',
      body: 'The read-option keeps defenses honest, but it puts your body on the line every game.',
      options: [
        o('install', 'Run it', gam(0.65, { team: { off: 1 }, attr: { legs: 1 } }, 'Linebackers freeze. Big plays everywhere.', { attr: { legs: -1 }, sit: 1 }, 'You took a shot. Out a week.')),
        o('no', 'Keep the QB safe', { attr: { [c.T.one('processing') ?? c.T.best('mental')]: 1 }, window: 3 }),
      ] }) },
  { id: 'qb-cold', at: ['late', 'stretch'], w: 2, when: () => true,
    make: c => ({ kicker: 'ROAD GAME', title: '6°F at kickoff',
      body: 'A frozen ball and a frozen field. Grip is the whole game.',
      options: [
        o('gloves', 'Throw with gloves', { attr: { [c.T.one('accuracy') ?? c.T.best('skill')]: -1, [c.T.one('arm') ?? c.T.best('physical')]: 1 }, window: 1 }),
        o('bare', 'Bare hands, like always', gam(0.5, { attr: { [c.T.one('accuracy') ?? c.T.best('skill')]: 1 }, window: 1, xp: 20 }, 'Cold-blooded. Ice in the veins.', { attr: { [c.T.one('accuracy') ?? c.T.best('skill')]: -1 }, window: 1 }, 'Three fluttering ducks.')),
      ] }) },
  { id: 'qb-tv-critic', at: ['mid', 'late'], w: 2, when: c => c.losses >= c.wins,
    make: c => ({ kicker: 'TV ANALYST', title: 'A former QB rips you on TV',
      body: '"He\'s not a franchise quarterback." The quote is everywhere this week.',
      options: [
        o('fire', 'Fire back', gam(0.5, { attr: { [c.T.best()]: 1 }, window: 3, xp: 30 }, 'You made him eat it on national TV.', { attr: { [c.T.best('mental')]: -1 }, window: 2 }, 'He got in your head.')),
        o('respect', '"I respect his opinion"', { attr: { [c.T.one('leadership') ?? c.T.best('mental')]: 1 } }),
      ] }) },
  { id: 'qb-blitz', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'SCOUTING REPORT', title: 'They\'re going to blitz you',
      body: 'This week\'s opponent sends five or more on almost half their snaps.',
      options: [
        o('hot', 'Hot routes', { attr: { [c.T.one('processing') ?? c.T.best('mental')]: 1 }, window: 2 }),
        o('max', 'Max protect, take shots', { attr: { [c.T.one('arm') ?? c.T.best('physical')]: 1 }, team: { off: -1 }, window: 2 }),
      ] }) },
  { id: 'qb-turf-toe', at: ['mid', 'late'], w: 2, when: c => c.T.has('legs'),
    make: c => ({ kicker: 'INJURY REPORT', title: 'Turf toe',
      body: 'Every dropback hurts. You can still throw, but planting is a problem.',
      options: [
        o('tape', 'Tape it and play', { attr: { legs: -1, [c.T.one('accuracy') ?? c.T.best('skill')]: -1 }, window: 2 }),
        o('rest', 'Sit and heal', { sit: 1 }),
      ] }) },
  { id: 'qb-tempo', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'NO-HUDDLE', title: 'Go fast?',
      body: 'Tempo keeps defenses from subbing. It also puts every call on you.',
      options: [
        o('tempo', 'Go tempo', gam(0.6, { team: { off: 1 }, attr: { [c.T.one('processing') ?? c.T.best('mental')]: 1 }, window: 3 }, 'The defense is gassed by halftime.', { attr: { [c.T.one('accuracy') ?? c.T.best('skill')]: -1 }, window: 2 }, 'Rushed and sloppy.')),
        o('huddle', 'Huddle up', {}, 'Nothing changes.'),
      ] }) },
  { id: 'qb-trick', at: ['mid', 'late', 'stretch'], w: 1, when: () => true,
    make: c => ({ kicker: 'TRICK PLAY', title: 'You catch a TD pass?',
      body: 'The coach drew up a play where you run a route. It\'s either a highlight or a disaster.',
      options: [
        o('run', 'Call it', gam(0.5, { xp: 50, team: { off: 1 }, window: 2 }, 'Touchdown! The whole sideline lost it.', { attr: { [c.T.best('physical')]: -1 }, window: 1 }, 'Blown up. You took a hit.')),
        o('no', 'Save it for later', {}, 'Nothing changes.'),
      ] }) },
  { id: 'qb-contract', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'NEGOTIATION', title: 'Take less to build the roster?',
      body: 'A team-friendly deal frees money for weapons. A max deal sets you up for life.',
      options: [
        o('friendly', 'Team-friendly deal', { team: { off: 1 } }, 'They sign a receiver with the money.'),
        o('max', 'Max deal', { xp: 40, attr: { [c.T.best('mental')]: 1 }, window: 3 }),
      ] }) },
  { id: 'qb-pa', at: ['early', 'mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'GAME PLAN', title: 'Play-action heavy',
      body: 'The run game is working, so the staff wants to sell fakes and hit shots behind the linebackers.',
      options: [
        o('pa', 'Sell the fakes', { attr: { [c.T.one('vision') ?? c.T.best('mental')]: 1 }, window: 4 }),
        o('drop', 'Straight dropbacks', { attr: { [c.T.one('pocket-presence') ?? c.T.best('skill')]: 1 }, window: 4 }),
      ] }) },
  { id: 'qb-hard-count', at: ['early', 'mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'ROAD CROWD', title: 'You can\'t hear yourself think',
      body: 'The loudest stadium in the league. Silent counts, or win the crowd with the hard count?',
      options: [
        o('silent', 'Silent count', { attr: { [c.T.one('processing') ?? c.T.best('mental')]: 1 }, window: 1 }),
        o('hard', 'Hard count them offside', gam(0.5, { team: { off: 1 }, window: 1, xp: 15 }, 'Three free first downs.', { team: { off: -1 }, window: 1 }, 'Your own line jumps twice.')),
      ] }) },
  { id: 'qb-pocket-clock', at: ['mid', 'late'], w: 1, when: c => (c.last?.sacks ?? 0) >= 4,
    make: c => ({ kicker: `SACKED ${c.last.sacks} TIMES`, title: 'Holding the ball too long?',
      body: 'The film shows some of those sacks were on you.',
      options: [
        o('clock', 'Speed up your clock', { attr: T2(c, c.T.one('pocket-presence') ?? c.T.best('skill'), c.T.one('playmaking') ?? c.T.worst('skill')) }),
        o('line', 'Blame the protection', { team: { off: -1 }, window: 2, attr: { [c.T.best()]: 1 } }),
      ] }) },
  { id: 'qb-comeback', at: ['mid', 'late', 'stretch'], w: 3, when: c => c.lastWon && c.last && c.last.mySc - c.last.oppSc <= 7,
    make: c => ({ kicker: 'GAME-WINNING DRIVE', title: 'You did it again',
      body: `Another late drive to beat ${c.opp}. Do you lean into being the closer?`,
      options: [
        o('closer', 'I want the last drive', { attr: { [c.T.one('pocket-presence') ?? c.T.best('skill')]: 1 }, xp: 25 }),
        o('early', 'Win it earlier next time', { team: { off: 1 }, window: 3 }),
      ] }) },
  { id: 'qb-rookie-wr', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'CHEMISTRY', title: 'Throw with the rookie after practice?',
      body: 'Your rookie receiver keeps running the wrong depth. Extra throws after practice would fix it.',
      options: [
        o('extra', 'Stay late with him', { team: { off: 1 }, attr: { [c.T.one('arm') ?? c.T.best('physical')]: -1 }, window: 2 }),
        o('save', 'Save your arm', { attr: { [c.T.one('arm') ?? c.T.best('physical')]: 1 }, window: 2 }),
      ] }) },
  { id: 'qb-signature', at: ['early', 'mid', 'late'], w: 1, when: c => c.lastBig,
    make: c => ({ kicker: 'AFTER A BIG GAME', title: 'A signature celebration?',
      body: 'The social team wants a TD celebration that\'s all yours.',
      options: [
        o('yes', 'Make it iconic', { xp: 40 }, 'Kids everywhere are copying it.'),
        o('no', 'Hand the ball to the ref', { attr: { [c.T.one('leadership') ?? c.T.best('mental')]: 1 }, window: 3 }),
      ] }) },
  { id: 'qb-mvp-case', at: ['late', 'stretch'], w: 4, when: c => c.contender,
    make: c => ({ kicker: 'MVP CASE', title: 'Make your closing argument',
      body: 'The MVP vote comes down to the last few weeks. Voters love numbers and wins.',
      options: [
        o('numbers', 'Throw for numbers', { attr: { [c.T.one('arm') ?? c.T.best('physical')]: 1, [c.T.one('pocket-presence') ?? c.T.worst('skill')]: -1 } }),
        o('wins', 'Just win games', { team: { off: 1, def: 1 }, window: c.left }),
      ] }) },
  { id: 'qb-elite-defense', at: ['early', 'mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'NEXT UP', title: 'The league\'s best defense',
      body: 'They haven\'t allowed 20 points in a month. How do you attack them?',
      options: [
        o('patient', 'Be patient', { attr: { [c.T.one('accuracy') ?? c.T.best('skill')]: 1 }, window: 1 }),
        o('swing', 'Swing big early', gam(0.4, { attr: { [c.T.best()]: 2 }, window: 1, xp: 30 }, 'Two deep shots land. Game over by halftime.', { attr: { [c.T.best()]: -1 }, window: 1 }, 'They were ready for it.')),
      ] }) },
]

const RB = [
  { id: 'rb-workload', at: ['early', 'mid'], w: 2, when: () => true,
    make: c => ({ kicker: 'WORKLOAD', title: 'Bell cow or committee?', body: 'The coach asks how many carries you want.',
      options: [
        o('cow', '25 carries a game', { attr: T2(c, c.T.one('vision', 'elusiveness') ?? c.T.best('skill'), c.T.one('speed', 'burst') ?? c.T.best('physical')) }, 'Rhythm in, freshness out.'),
        o('split', 'Share the load', { attr: { [c.T.one('burst', 'speed') ?? c.T.best('physical')]: 1 } }),
      ] }) },
  { id: 'rb-fumbles', at: ['early', 'mid', 'late'], w: 4, when: c => (c.last?.fumbles ?? 0) >= 1,
    make: c => ({ kicker: 'BALL SECURITY', title: 'You put it on the ground',
      body: `A fumble against ${c.opp}, and the coach made you carry a ball everywhere this week.`,
      options: [
        o('high-tight', 'High and tight', { attr: T2(c, c.T.one('carrying') ?? c.T.best('skill'), c.T.one('elusiveness') ?? c.T.worst('skill')) }),
        o('play', 'Keep playing your game', gam(0.6, {}, 'A one-off. It doesn\'t happen again.', { attr: { [c.T.one('carrying') ?? c.T.worst()]: -1 } }, 'It happened again. And again.')),
      ] }) },
  { id: 'rb-goal-line', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'RED ZONE', title: 'The goal-line back?', body: 'The team wants a bigger back inside the five. You want those touchdowns.',
      options: [
        o('mine', 'Those are mine', { attr: { [c.T.one('strength', 'size') ?? c.T.best('physical')]: 1 }, then: { attr: { [c.T.one('speed') ?? c.T.best('physical')]: -1 }, window: 2 } }),
        o('share', 'Let him have them', { attr: { [c.T.one('speed', 'burst') ?? c.T.best('physical')]: 1 }, window: 4 }),
      ] }) },
  { id: 'rb-hands', at: ['early', 'mid'], w: 1, when: c => c.T.has('hands'),
    make: c => ({ kicker: 'NEW ROLE', title: 'Line up in the slot?', body: 'The coordinator wants you as a receiver too.',
      options: [
        o('slot', 'Catch more passes', { attr: T2(c, 'hands', c.T.one('strength', 'carrying') ?? c.T.worst()) }),
        o('backfield', 'Stay in the backfield', { attr: { [c.T.one('vision') ?? c.T.best('skill')]: 1 }, window: 4 }),
      ] }) },
  { id: 'rb-thousand', at: ['late', 'stretch'], w: 4, when: c => c.sum('rushYds') >= 600 && c.sum('rushYds') < 1000,
    make: c => ({ kicker: 'MILESTONE WATCH', title: 'Chase 1,000 yards?', body: 'The coaches will feed you if you want the milestone.',
      options: [
        o('feed', 'Feed me', { attr: { [c.T.best()]: 1 }, window: c.left, then: { attr: { [c.T.best('physical')]: -1 }, window: 1 } }),
        o('fresh', 'Stay fresh for the playoffs', { attr: { [c.T.best('physical')]: 1 } }),
      ] }) },
  { id: 'rb-protection', at: ['early', 'mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'THIRD DOWN', title: 'Pass protection duty', body: 'Stay in and block on third down, or release into the flat?',
      options: [
        o('block', 'Pick up the blitz', { team: { off: 1 }, attr: { [c.T.best()]: -1 }, window: 3 }),
        o('release', 'Get into the route', { attr: { [c.T.one('hands', 'elusiveness') ?? c.T.best('skill')]: 1 }, window: 3 }),
      ] }) },
  { id: 'rb-cutback', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'FILM ROOM', title: 'Cutback lanes everywhere', body: 'The defense over-pursues. Patience could be worth 20 yards a game.',
      options: [
        o('patient', 'Be patient', { attr: T2(c, c.T.one('vision') ?? c.T.best('skill'), c.T.one('burst') ?? c.T.worst('physical')) }),
        o('downhill', 'Hit it downhill', { attr: { [c.T.one('burst', 'strength') ?? c.T.best('physical')]: 1 }, window: 3 }),
      ] }) },
]

const WR = [
  { id: 'wr-route-tree', at: ['early', 'mid'], w: 2, when: () => true,
    make: c => ({ kicker: 'DEVELOPMENT', title: 'Expand your route tree?', body: 'You\'ve been a two-route guy. The coaches want more.',
      options: [
        o('expand', 'Learn the whole tree', gam(0.6, { attr: { [c.T.one('routeRunning') ?? c.T.best('skill')]: 1 } }, 'Corners can\'t sit on anything now.', { attr: { [c.T.one('routeRunning') ?? c.T.best('skill')]: -1 }, window: 2 }, 'Wrong depths, wrong breaks for a couple weeks.')),
        o('master', 'Master what you run', { attr: { [c.T.one('release') ?? c.T.best('skill')]: 1 }, window: 4 }),
      ] }) },
  { id: 'wr-drops', at: ['early', 'mid', 'late'], w: 4, when: c => c.lastBust,
    make: c => ({ kicker: 'DROPS', title: 'The ball went right through', body: `A quiet day and two drops against ${c.opp}.`,
      options: [
        o('jugs', 'Jugs machine every day', { attr: { [c.T.one('hands') ?? c.T.best('skill')]: 1 } }),
        o('forget', 'Forget it, play fast', gam(0.5, { attr: { [c.T.best()]: 1 }, window: 2 }, 'Bounced right back.', { attr: { [c.T.one('hands') ?? c.T.worst()]: -1 }, window: 2 }, 'In your head now.')),
      ] }) },
  { id: 'wr-deep', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'ROLE', title: 'Take the top off?', body: 'The offense needs a deep threat. That means fewer catches and bigger ones.',
      options: [
        o('deep', 'Go deep', { attr: T2(c, c.T.one('speed', 'vertical') ?? c.T.best('physical'), c.T.one('afterCatch', 'routeRunning') ?? c.T.worst('skill')) }),
        o('underneath', 'Win underneath', { attr: T2(c, c.T.one('afterCatch', 'release') ?? c.T.best('skill'), c.T.one('vertical') ?? c.T.worst('physical')) }),
      ] }) },
  { id: 'wr-contested', at: ['mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'MATCHUP', title: 'A shutdown corner shadows you', body: 'He travels with you everywhere this week.',
      options: [
        o('physical', 'Win the 50-50 balls', { attr: { [c.T.one('bodyControl', 'vertical', 'size') ?? c.T.best('physical')]: 1 }, window: 1 }),
        o('decoy', 'Be the decoy', { team: { off: 1 }, attr: { [c.T.best()]: -1 }, window: 1 }),
      ] }) },
  { id: 'wr-slot', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'NEW ALIGNMENT', title: 'Move into the slot?', body: 'More targets inside, more hits too.',
      options: [
        o('slot', 'Move inside', { attr: T2(c, c.T.one('awareness', 'afterCatch') ?? c.T.best('skill'), c.T.one('speed') ?? c.T.worst('physical')) }),
        o('outside', 'Stay outside', { attr: { [c.T.one('release') ?? c.T.best('skill')]: 1 }, window: 3 }),
      ] }) },
  { id: 'wr-diva', at: ['mid', 'late'], w: 2, when: c => c.skid >= 2,
    make: c => ({ kicker: 'SIDELINE', title: 'You want the ball more', body: 'Cameras caught you arguing with the QB.',
      options: [
        o('vent', 'Go public', gam(0.4, { attr: { [c.T.best()]: 1 }, window: 3 }, 'You got your targets, and made the most of them.', { team: { off: -1 }, window: 3 }, 'The offense turned on itself.')),
        o('private', 'Keep it in house', { team: { off: 1 }, window: 2 }),
      ] }) },
  { id: 'wr-returns', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'SPECIAL TEAMS', title: 'Return kicks too?', body: 'More touches, more hits.',
      options: [
        o('return', 'Return kicks', gam(0.5, { xp: 40, attr: { [c.T.one('speed') ?? c.T.best('physical')]: 1 }, window: 2 }, 'Took one to the house.', { attr: { [c.T.best('physical')]: -1 }, window: 2 }, 'Got rocked on a return.')),
        o('no', 'Just play receiver', {}, 'Nothing changes.'),
      ] }) },
]

const TE = [
  { id: 'te-block', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'ROLE', title: 'Blocker or receiver?', body: 'The line is banged up and they need you in-line.',
      options: [
        o('block', 'Stay in and block', { team: { off: 1 }, attr: { [c.T.one('routeRunning', 'hands') ?? c.T.best('skill')]: -1 }, window: 3 }),
        o('route', 'Run routes', { attr: { [c.T.one('routeRunning') ?? c.T.best('skill')]: 1 }, window: 3 }),
      ] }) },
  { id: 'te-redzone', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => ({ kicker: 'RED ZONE', title: 'The red-zone target', body: 'You\'re the biggest target on the field. The QB wants to look your way.',
      options: [
        o('target', 'Be the target', { attr: { [c.T.one('hands', 'size') ?? c.T.best()]: 1 } }),
        o('decoy', 'Clear space for others', { team: { off: 1 }, window: 3 }),
      ] }) },
  { id: 'te-seam', at: ['early', 'mid'], w: 1, when: () => true,
    make: c => ({ kicker: 'GAME PLAN', title: 'Attack the seam?', body: 'Safeties are cheating down. The seam is open, and so are the big hits.',
      options: [
        o('seam', 'Run the seam', gam(0.6, { attr: { [c.T.one('speed', 'vertical') ?? c.T.best('physical')]: 1 } }, 'Gashed them up the middle.', { attr: { [c.T.best('physical')]: -1 }, window: 2 }, 'Lit up by the safety.')),
        o('flat', 'Live in the flat', { attr: { [c.T.one('afterCatch') ?? c.T.best('skill')]: 1 }, window: 3 }),
      ] }) },
  { id: 'te-hybrid', at: ['mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'NEW PACKAGE', title: 'Line up at fullback too?', body: 'More snaps, more blocking, more short-yardage touches.',
      options: [
        o('yes', 'Take the snaps', { attr: T2(c, c.T.one('strength', 'blocking') ?? c.T.best(), c.T.one('speed') ?? c.T.worst('physical')) }),
        o('no', 'Stick to tight end', {}, 'Nothing changes.'),
      ] }) },
  { id: 'te-chip', at: ['early', 'mid', 'late'], w: 1, when: () => true,
    make: c => ({ kicker: 'SCOUTING REPORT', title: 'An elite edge rusher', body: 'Chip him before your route, or release clean?',
      options: [
        o('chip', 'Chip and release', { team: { off: 1 }, window: 1 }),
        o('clean', 'Release clean', { attr: { [c.T.one('routeRunning') ?? c.T.best('skill')]: 1 }, window: 1 }),
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
  { id: 'po-takeover', at: ['playoffs'], w: 2, when: () => true,
    make: c => ({ kicker: 'BEFORE THE PLAYOFFS', title: 'Win-or-go-home', body: 'Single elimination from here. How do you want to play it?',
      options: [
        o('takeover', 'Take over', { attr: T2(c, c.T.best(), c.T.worst()) }),
        o('steady', 'Trust the system', { team: c.isDef ? { off: 1 } : { def: 1 } }),
      ] }) },
  { id: 'po-nerves', at: ['playoffs'], w: 2, when: () => true,
    make: c => ({ kicker: 'FIRST PLAYOFF START', title: 'The nerves are real', body: 'You couldn\'t sleep last night. The vets say it\'s normal.',
      options: [
        o('embrace', 'Embrace the moment', gam(0.55, { attr: { [c.T.best()]: 1 } }, 'Born for this.', { attr: { [c.T.best('mental')]: -1 } }, 'The moment got big on you.')),
        o('routine', 'Same routine as always', { attr: { [c.T.best('mental')]: 1 } }),
      ] }) },
  { id: 'po-road', at: ['playoffs'], w: 2, when: c => c.wins < 12,
    make: c => ({ kicker: 'ROAD PLAYOFFS', title: 'Hostile territory', body: 'You\'re going on the road in January. Their crowd is the loudest in football.',
      options: [
        o('silence', 'Silence the crowd early', gam(0.5, { attr: { [c.T.best()]: 1 }, team: { off: 1 } }, 'You could hear a pin drop.', { team: { off: -1 } }, 'The crowd won the first quarter.')),
        o('grind', 'Grind it out', { team: { def: 1 } }),
      ] }) },
  { id: 'po-hurt', at: ['playoffs'], w: 2, when: () => true,
    make: c => ({ kicker: 'INJURY REPORT', title: 'Questionable for the playoffs', body: 'A sprain from the last regular-season game. There\'s no sitting out now.',
      options: [
        o('shot', 'Take the shot and play', { attr: { [c.T.best('physical')]: -1 } }),
        o('brace', 'Wear the brace', { attr: { [c.T.best('physical')]: -1, [c.T.best('mental')]: 1 } }),
      ] }) },
  { id: 'po-speech', at: ['playoffs'], w: 1, when: () => true,
    make: c => ({ kicker: 'NIGHT BEFORE', title: 'The team wants a speech', body: 'Everybody is looking at you in the hotel ballroom.',
      options: [
        o('speak', 'Give the speech', gam(0.7, { team: { off: 1, def: 1 }, xp: 30 }, 'Goosebumps. They\'d run through a wall.', { attr: { [c.T.best('mental')]: -1 } }, 'It came out wrong.')),
        o('lead', 'Lead by example', { attr: { [c.T.best()]: 1 } }),
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
