// In-game moments: the decision happens INSIDE the next game, and decides it.
//
// The engines simulate the season up front, so before the next game is
// revealed we already know how it goes: the final score, the box score. A
// moment drops you into the part of that game where it turns — down 3 on the
// last drive, up 4 and needing one first down, their final possession — and
// what you choose rewrites that game: the score, the W or the L, your line.
// Nothing here is "+1 Legs for 3 games". If a choice carries past the game
// (a hit you took staying in a blowout), it's a game missed, nothing vaguer.
//
// The odds come from the traits that matter for that play, shown on the card
// ("~64%: your Accuracy A-, Processing B+"), so a better build wins more of these.
//
//   gameMoment(c, g) → { id, kicker, title, body, options: [{ id, label, sub, effect }] } | null
//   effect = { outcomes: [{ p, good, line, tag, game: { won, my, opp, add }, sit? }] }
// Applied by seasonDirector.js: the outcome is rolled, the game rewritten.

import { valToGrade } from '../utils/simulation'
import { NBA_TEAMS } from '../data/nba-teams'

const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const pc = p => `${Math.round(p * 100)}%`
const nick = s => String(s || '').split(' ').slice(-1)[0]
// basketball games carry the opponent's abbreviation: show the team
const nbaName = s => NBA_TEAMS.find(t => t.short === s)?.name ?? s
// a number in [lo, hi], fixed for this moment (seeded by the context's rng)
const rr = (c, lo, hi) => lo + Math.floor(c.r() * (hi - lo + 1))

// Odds from the traits that matter: the build's grades move the base (C+ is neutral)
function odds(c, base, traits, per = 0.05) {
  const ts = traits.filter(t => c.T.has(t))
  if (!ts.length) return { p: base, why: '' }
  const avg = ts.reduce((a, t) => a + c.val(t), 0) / ts.length
  return { p: clamp(base + (avg - 6) * per, 0.08, 0.92), why: ts.slice(0, 3).map(t => `${c.L(t)} ${valToGrade(c.val(t))}`).join(', ') }
}
// The defense (or the offense) around you holding up its end, from the team's ratings
const teamHold = c => clamp(0.48 + ((c.teamDef ?? 5) - 5) * 0.045, 0.3, 0.72)
const teamScore = c => clamp(0.42 + ((c.teamOff ?? 5) - 5) * 0.045, 0.25, 0.65)

// Outcome helpers: the final score as a result of the play
const win = (g, my, opp, add, line, tag) => ({ good: true, line, tag, game: { won: true, my, opp, add } })
const loss = (g, my, opp, add, line, tag) => ({ good: false, line, tag, game: { won: false, my, opp, add } })
const score = (my, opp) => `${my}–${opp}`
// fine print: the headline chance, why, and what each side means
const sub = (o, good, bad) => `${pc(o.p)}${o.why ? ` (your ${o.why})` : ''}: ${good}${bad ? `. Otherwise ${bad}` : ''}.`

// Merge outcome lists, dropping the ones that can't happen
const outs = list => list.filter(o => o.p > 0.001)

// ═════════════════════════════════════════════════════════════════════════════
// FOOTBALL
// ═════════════════════════════════════════════════════════════════════════════
// Where the game stands: margins the play can actually turn. A TD wins it
// trailing by up to 6, a stop or a first down closes it leading by up to 6.
function nflState(g) {
  const m = g.mySc - g.oppSc
  if (m <= -1 && m >= -6) return 'comeback'
  if (m >= 1 && m <= 6) return 'protect'
  if (m >= 17) return 'garbage'
  if (m <= -17) return 'chase'
  return null
}

const NFL = {
  qb: {
    comeback: (c, g, d) => {
      const deep = odds(c, 0.36, ['arm', 'accuracy'])
      const dink = odds(c, 0.34, ['processing', 'accuracy', 'pocket-presence'])
      const my = g.mySc + 7, yds = rr(c, 62, 84)
      const options = [
        { id: 'deep', label: 'Take the shot deep', o: deep,
          outcomes: [{ p: deep.p, ...win(g, my, g.oppSc, { passYds: yds, tds: 1 }, `Dropped it in the bucket from 45 yards. Touchdown. ${c.nick} win ${score(my, g.oppSc)}.`, 'GAME-WINNING DRIVE') },
            { p: 1 - deep.p, ...loss(g, g.mySc, g.oppSc, { passYds: rr(c, 0, 12), ints: 1 }, `Underthrown, picked off at the 20. ${c.nick} lose ${score(g.mySc, g.oppSc)}.`, 'PICKED OFF') }],
          sub: sub(deep, `a touchdown and a ${score(my, g.oppSc)} win`, `an interception and the loss`) },
        { id: 'dink', label: 'Take what they give, march it down', o: dink,
          outcomes: [{ p: dink.p, ...win(g, my, g.oppSc, { passYds: yds + 8, tds: 1 }, `Eleven plays, ${yds + 8} yards, touchdown with 0:14 left. ${c.nick} win ${score(my, g.oppSc)}.`, 'GAME-WINNING DRIVE') },
            { p: 1 - dink.p, ...loss(g, g.mySc, g.oppSc, { passYds: rr(c, 24, 40) }, `Moved it to the 30, then four incompletions. Turnover on downs. ${c.nick} lose ${score(g.mySc, g.oppSc)}.`, 'TURNOVER ON DOWNS') }],
          sub: sub(dink, `a touchdown and a ${score(my, g.oppSc)} win`, 'the drive stalls: no pick, but the loss') },
      ]
      if (d <= 3) {
        // a field goal ties (down 3, then overtime) or wins (down 1–2)
        const fg = odds(c, 0.62, ['processing', 'accuracy'])
        const make = 0.86, pFG = fg.p * make
        const ot = d === 3, myFG = g.mySc + 3
        const otWin = 0.5
        options.push({ id: 'fg', label: ot ? 'Get in range, kick it to overtime' : 'Get in range, win it with the kick', o: { p: ot ? pFG * otWin : pFG, why: fg.why },
          outcomes: ot
            ? [{ p: pFG * otWin, ...win(g, myFG + 3, g.oppSc, { passYds: rr(c, 30, 48) }, `In range, the kick ties it, and you win the toss and drive it in OT. ${score(myFG + 3, g.oppSc)}.`, 'OVERTIME WIN') },
              { p: pFG * (1 - otWin), ...loss(g, myFG, g.oppSc + 3, { passYds: rr(c, 30, 48) }, `The kick ties it. They get the ball first in overtime and kick the winner. ${score(myFG, g.oppSc + 3)}.`, 'OVERTIME LOSS') },
              { p: 1 - pFG, ...loss(g, g.mySc, g.oppSc, { passYds: rr(c, 10, 30) }, `Never got in range. ${score(g.mySc, g.oppSc)}.`, 'COMEBACK FALLS SHORT') }]
            : [{ p: pFG, ...win(g, myFG, g.oppSc, { passYds: rr(c, 30, 48) }, `Into range, and the kick is good as time expires. ${c.nick} win ${score(myFG, g.oppSc)}.`, 'WALK-OFF FIELD GOAL') },
              { p: 1 - pFG, ...loss(g, g.mySc, g.oppSc, { passYds: rr(c, 10, 30) }, `${fg.p > 0.5 ? 'In range, and the kick hooks wide' : 'Never got in range'}. ${score(g.mySc, g.oppSc)}.`, 'COMEBACK FALLS SHORT') }],
          sub: ot ? `${pc(pFG * otWin)} to win in OT${fg.why ? ` (your ${fg.why})` : ''}: get in range (${pc(fg.p)}), make it, then win overtime. Safest way to keep it alive.`
                  : `${pc(pFG)}${fg.why ? ` (your ${fg.why})` : ''}: get in range (${pc(fg.p)}) and the kicker makes it (86%).` })
      }
      return { title: `Down ${d}, last drive`, body: `${g.home ? 'Home' : 'On the road'} against the ${nick(g.opponent)}, ${score(g.mySc, g.oppSc)}. 1:52 left, ball at your own 25, one timeout. How do you want to go get it?`, options }
    },
    protect: (c, g, m) => {
      const hold = teamHold(c)
      const thr = odds(c, 0.56, ['accuracy', 'processing'])
      const lossScore = [g.mySc, g.mySc + (7 - m)]
      const miss = 1 - thr.p, pick = miss * 0.18, inc = miss - pick
      const holdShort = clamp(hold - 0.2, 0.15, 0.6)
      return {
        title: `Up ${m}, one first down to end it`,
        body: `${score(g.mySc, g.oppSc)} over the ${nick(g.opponent)}. 2:08 left, 3rd & 6 at midfield, they have one timeout. Convert and you kneel it out.`,
        options: [
          { id: 'throw', label: 'Throw for the first down', o: thr,
            outcomes: outs([
              { p: thr.p, ...win(g, g.mySc, g.oppSc, { passYds: rr(c, 9, 18) }, `Strike on 3rd down. Victory formation. ${c.nick} win ${score(g.mySc, g.oppSc)}.`, 'ICED IT') },
              { p: inc * hold, ...win(g, g.mySc, g.oppSc, {}, `Incomplete, punt. They drive to midfield and the defense holds. ${c.nick} win ${score(g.mySc, g.oppSc)}.`, 'DEFENSE HELD') },
              { p: inc * (1 - hold), ...loss(g, lossScore[0], lossScore[1], {}, `Incomplete, punt, and they go 80 yards. ${c.nick} lose ${score(...lossScore)}.`, 'BLEW THE LEAD') },
              { p: pick * holdShort, ...win(g, g.mySc, g.oppSc, { ints: 1 }, `Picked off, but the defense bails you out on a short field. ${score(g.mySc, g.oppSc)}.`, 'DEFENSE BAILED YOU OUT') },
              { p: pick * (1 - holdShort), ...loss(g, ...lossScore, { ints: 1 }, `Picked off at midfield. They score four plays later. ${c.nick} lose ${score(...lossScore)}.`, 'BLEW THE LEAD') },
            ]),
            sub: `Win ${pc(thr.p + inc * hold + pick * holdShort)}. Convert ${pc(thr.p)}${thr.why ? ` (your ${thr.why})` : ''}; a miss leaves it to the defense, and 18% of misses are picks.` },
          { id: 'run', label: 'Hand it off, punt, trust the defense', o: { p: hold + 0.05 },
            outcomes: [
              { p: clamp(hold + 0.05, 0, 1), ...win(g, g.mySc, g.oppSc, {}, `Run, punt, and the defense gets the stop. ${c.nick} win ${score(g.mySc, g.oppSc)}.`, 'DEFENSE HELD') },
              { p: 1 - clamp(hold + 0.05, 0, 1), ...loss(g, ...lossScore, {}, `Run, punt, and they march 80 yards for the winner. ${score(...lossScore)}.`, 'BLEW THE LEAD') }],
            sub: `Win ${pc(hold + 0.05)}: no risk of a pick, it's all on your defense.` },
        ],
      }
    },
  },
  rb: {
    comeback: (c, g, d) => {
      const pwr = odds(c, 0.5, ['strength', 'balance', 'burst'])
      const flat = odds(c, 0.46, ['hands', 'elusiveness', 'speed'])
      const my = g.mySc + 7
      return {
        title: `Down ${d}, 2nd & goal at the 3`,
        body: `${score(g.mySc, g.oppSc)} against the ${nick(g.opponent)}, 0:41 left. The coordinator wants it in your hands. Between the tackles, or out in the flat?`,
        options: [
          { id: 'power', label: 'Run it between the tackles', o: pwr,
            outcomes: [{ p: pwr.p, ...win(g, my, g.oppSc, { rushYds: 3, rushTDs: 1, carries: 1 }, `Second effort, across the goal line. ${c.nick} win ${score(my, g.oppSc)}.`, 'GAME-WINNING TD') },
              { p: 1 - pwr.p, ...loss(g, g.mySc, g.oppSc, { rushYds: 1, carries: 2 }, `Stuffed twice at the 1. ${c.nick} lose ${score(g.mySc, g.oppSc)}.`, 'STOPPED AT THE 1') }],
            sub: sub(pwr, `the touchdown and a ${score(my, g.oppSc)} win`, 'stopped short, the loss') },
          { id: 'flat', label: 'Leak out to the flat', o: flat,
            outcomes: [{ p: flat.p, ...win(g, my, g.oppSc, { recYds: 3, recTDs: 1, recs: 1 }, `Nobody picked you up. Walk-in touchdown. ${c.nick} win ${score(my, g.oppSc)}.`, 'GAME-WINNING TD') },
              { p: 1 - flat.p, ...loss(g, g.mySc, g.oppSc, {}, `The linebacker ran with you. Incomplete, then a sack. ${c.nick} lose ${score(g.mySc, g.oppSc)}.`, 'STOPPED') }],
            sub: sub(flat, `the touchdown and a ${score(my, g.oppSc)} win`, 'covered, the loss') },
        ],
      }
    },
    protect: (c, g, m) => {
      const hold = teamHold(c)
      const pound = odds(c, 0.55, ['strength', 'vision', 'carrying'])
      const fumble = clamp(0.12 - (c.val('carrying') - 6) * 0.02, 0.02, 0.2)
      const outside = odds(c, 0.32, ['speed', 'burst', 'elusiveness'])
      const ls = [g.mySc, g.mySc + (7 - m)]
      const miss = 1 - pound.p
      return {
        title: `Up ${m}, run out the clock`,
        body: `${score(g.mySc, g.oppSc)} over the ${nick(g.opponent)}, 3:10 left. Everyone in the stadium knows you're getting the ball. Grind out two first downs, or try to end it?`,
        options: [
          { id: 'grind', label: 'Grind it, protect the ball', o: pound,
            outcomes: outs([
              { p: pound.p, ...win(g, g.mySc, g.oppSc, { rushYds: rr(c, 18, 32), carries: 5 }, `Five straight carries, two first downs. Kneel. ${c.nick} win ${score(g.mySc, g.oppSc)}.`, 'CLOSED IT OUT') },
              { p: miss * fumble * (hold - 0.2 > 0 ? hold - 0.2 : 0.1), ...win(g, g.mySc, g.oppSc, { carries: 3, fumbles: 1 }, `You put it on the ground, but the defense holds. Close call. ${score(g.mySc, g.oppSc)}.`, 'FUMBLED') },
              { p: miss * fumble * (1 - (hold - 0.2 > 0 ? hold - 0.2 : 0.1)), ...loss(g, ...ls, { carries: 3, fumbles: 1 }, `Fumble at midfield. They score the winner. ${c.nick} lose ${score(...ls)}.`, 'FUMBLED IT AWAY') },
              { p: miss * (1 - fumble) * hold, ...win(g, g.mySc, g.oppSc, { rushYds: rr(c, 5, 10), carries: 3 }, `Three and out, but the defense holds. ${c.nick} win ${score(g.mySc, g.oppSc)}.`, 'DEFENSE HELD') },
              { p: miss * (1 - fumble) * (1 - hold), ...loss(g, ...ls, { rushYds: rr(c, 5, 10), carries: 3 }, `Three and out, and they go the length of the field. ${score(...ls)}.`, 'BLEW THE LEAD') },
            ]),
            sub: `Win ${pc(pound.p + miss * (1 - fumble) * hold + miss * fumble * Math.max(0.1, hold - 0.2))}. Two first downs ${pc(pound.p)}${pound.why ? ` (your ${pound.why})` : ''}; fumble risk ${pc(fumble)} on a miss.` },
          { id: 'outside', label: 'Bounce it outside, try to end it', o: outside,
            outcomes: outs([
              { p: outside.p, ...win(g, g.mySc + 7, g.oppSc, { rushYds: rr(c, 34, 60), rushTDs: 1, carries: 2 }, `Bounced it, turned the corner, gone. ${c.nick} win ${score(g.mySc + 7, g.oppSc)}.`, 'PUT IT AWAY') },
              { p: (1 - outside.p) * hold, ...win(g, g.mySc, g.oppSc, { rushYds: -2, carries: 3 }, `Strung out for a loss, punt, and the defense holds. ${score(g.mySc, g.oppSc)}.`, 'DEFENSE HELD') },
              { p: (1 - outside.p) * (1 - hold), ...loss(g, ...ls, { rushYds: -2, carries: 3 }, `Strung out for a loss, and the clock stopped. They drive for the winner. ${score(...ls)}.`, 'BLEW THE LEAD') },
            ]),
            sub: `Win ${pc(outside.p + (1 - outside.p) * hold)}. Break it ${pc(outside.p)}${outside.why ? ` (your ${outside.why})` : ''} for a touchdown; otherwise it's on the defense with more time left.` },
        ],
      }
    },
  },
  wr: {
    comeback: (c, g, d) => {
      const jump = odds(c, 0.3, ['vertical', 'bodyControl', 'hands'])
      const sit = odds(c, 0.62, ['routeRunning', 'release', 'awareness'])
      const team = teamScore(c), my = g.mySc + 7
      return {
        title: `Down ${d}, one shot left`,
        body: `${score(g.mySc, g.oppSc)} against the ${nick(g.opponent)}. 0:22 left, ball at their 30. The quarterback says he's coming to you either way.`,
        options: [
          { id: 'jump', label: 'Go up and get it in the end zone', o: jump,
            outcomes: [{ p: jump.p, ...win(g, my, g.oppSc, { rec: 1, recYds: 30, recTDs: 1, targets: 1 }, `Over two defenders. Touchdown. ${c.nick} win ${score(my, g.oppSc)}.`, 'WALK-OFF CATCH') },
              { p: 1 - jump.p, ...loss(g, g.mySc, g.oppSc, { targets: 1 }, `Knocked away at the last second. ${c.nick} lose ${score(g.mySc, g.oppSc)}.`, 'BROKEN UP') }],
            sub: sub(jump, `the catch and a ${score(my, g.oppSc)} win`, 'broken up, the loss') },
          { id: 'sit', label: 'Find the soft spot, set up the last play', o: { p: sit.p * team },
            outcomes: [{ p: sit.p * team, ...win(g, my, g.oppSc, { rec: 1, recYds: 18, targets: 2 }, `18 yards to the 12, then the quarterback finds the tight end. ${c.nick} win ${score(my, g.oppSc)}.`, 'GAME-WINNING DRIVE') },
              { p: 1 - sit.p * team, ...loss(g, g.mySc, g.oppSc, { rec: sit.p > 0.5 ? 1 : 0, recYds: sit.p > 0.5 ? 18 : 0, targets: 1 }, `Got them closer, but the last throw fell incomplete. ${score(g.mySc, g.oppSc)}.`, 'COMEBACK FALLS SHORT') }],
            sub: `${pc(sit.p * team)}: you get open (${pc(sit.p)}${sit.why ? `, your ${sit.why}` : ''}), then the offense has to finish (${pc(team)}).` },
        ],
      }
    },
    protect: (c, g, m) => {
      const hold = teamHold(c)
      const opt = odds(c, 0.58, ['routeRunning', 'hands', 'release'])
      const ls = [g.mySc, g.mySc + (7 - m)]
      return {
        title: `Up ${m}, 3rd & 7, 2:05 left`,
        body: `${score(g.mySc, g.oppSc)} over the ${nick(g.opponent)}. A first down ends it. You can run the option route and make them choose, or clear out for the run.`,
        options: [
          { id: 'option', label: 'Run the option route, make the catch', o: opt,
            outcomes: outs([
              { p: opt.p, ...win(g, g.mySc, g.oppSc, { rec: 1, recYds: rr(c, 8, 15), targets: 1 }, `Sat it down past the sticks. Game over. ${c.nick} win ${score(g.mySc, g.oppSc)}.`, 'ICED IT') },
              { p: (1 - opt.p) * hold, ...win(g, g.mySc, g.oppSc, { targets: 1 }, `Incomplete, punt, and the defense holds. ${score(g.mySc, g.oppSc)}.`, 'DEFENSE HELD') },
              { p: (1 - opt.p) * (1 - hold), ...loss(g, ...ls, { targets: 1 }, `Incomplete, punt, and they drive for the winner. ${c.nick} lose ${score(...ls)}.`, 'BLEW THE LEAD') },
            ]),
            sub: `Win ${pc(opt.p + (1 - opt.p) * hold)}. Convert ${pc(opt.p)}${opt.why ? ` (your ${opt.why})` : ''}; a miss leaves it to the defense.` },
          { id: 'clear', label: 'Clear out, let them run it', o: { p: 0.4 + 0.6 * hold },
            outcomes: [{ p: 0.4, ...win(g, g.mySc, g.oppSc, {}, `The run picks it up. Kneel. ${score(g.mySc, g.oppSc)}.`, 'ICED IT') },
              { p: 0.6 * hold, ...win(g, g.mySc, g.oppSc, {}, `Short of the sticks, punt, defense holds. ${score(g.mySc, g.oppSc)}.`, 'DEFENSE HELD') },
              { p: 0.6 * (1 - hold), ...loss(g, ...ls, {}, `Short, punt, and they go 80 yards. ${score(...ls)}.`, 'BLEW THE LEAD') }],
            sub: `Win ${pc(0.4 + 0.6 * hold)}: the run converts 40% of the time, then it's on the defense. No catch for you.` },
        ],
      }
    },
  },
  db: {
    protect: (c, g, m) => {
      const jump = odds(c, 0.26, ['hands', 'playRecognition', 'manCoverage'])
      const safe = odds(c, 0.56, ['zoneIQ', 'manCoverage', 'runSupport'])
      const ls = [g.mySc, g.mySc + (7 - m)]
      const bigPlay = 0.8                  // jump it and miss: usually a big play
      return {
        title: `Up ${m}, their last drive`,
        body: `${score(g.mySc, g.oppSc)} over the ${nick(g.opponent)}. 0:58 left, they're at midfield and their best receiver is lined up on you. You've seen this route on film.`,
        options: [
          { id: 'jump', label: 'Jump the route', o: jump,
            outcomes: outs([
              { p: jump.p, ...win(g, g.mySc, g.oppSc, { ints: 1, pbus: 1 }, `Read it, broke on it, picked it. Game over. ${c.nick} win ${score(g.mySc, g.oppSc)}.`, 'GAME-SEALING PICK') },
              { p: (1 - jump.p) * (1 - bigPlay), ...win(g, g.mySc, g.oppSc, { tackles: 1 }, `He double-moved you, but the safety saved it and they ran out of time. ${score(g.mySc, g.oppSc)}.`, 'SURVIVED') },
              { p: (1 - jump.p) * bigPlay, ...loss(g, ...ls, {}, `He double-moved you. Touchdown. ${c.nick} lose ${score(...ls)}.`, 'BEATEN DEEP') },
            ]),
            sub: `Win ${pc(jump.p + (1 - jump.p) * (1 - bigPlay))}. Pick it ${pc(jump.p)}${jump.why ? ` (your ${jump.why})` : ''}; if you guess wrong it's usually a touchdown.` },
          { id: 'safe', label: 'Keep it in front, tackle', o: safe,
            outcomes: [{ p: safe.p, ...win(g, g.mySc, g.oppSc, { pbus: 1, tackles: 2 }, `Everything underneath, tackled in bounds, clock runs out. ${c.nick} win ${score(g.mySc, g.oppSc)}.`, 'CLOSED IT OUT') },
              { p: 1 - safe.p, ...loss(g, ...ls, { tackles: 1 }, `Death by short passes. They score with 0:06 left. ${score(...ls)}.`, 'BLEW THE LEAD') }],
            sub: sub(safe, 'the stop and the win', 'they chip down the field and score') },
        ],
      }
    },
    comeback: (c, g, d) => {
      const strip = odds(c, 0.22, ['runSupport', 'hands'])
      const stop = odds(c, 0.5, ['runSupport', 'zoneIQ', 'playRecognition'])
      const team = teamScore(c), my = g.mySc + 7
      return {
        title: `Down ${d}, they're running out the clock`,
        body: `${score(g.mySc, g.oppSc)}, 2:30 left, the ${nick(g.opponent)} are running it right at your side. One stop gets the ball back.`,
        options: [
          { id: 'strip', label: 'Go for the strip', o: { p: strip.p * (team + 0.15) },
            outcomes: outs([
              { p: strip.p * (team + 0.15), ...win(g, my, g.oppSc, { ff: 1, tackles: 1 }, `Punched it out at the 40. Short field, touchdown. ${c.nick} win ${score(my, g.oppSc)}.`, 'FORCED THE FUMBLE') },
              { p: strip.p * (1 - team - 0.15), ...loss(g, g.mySc, g.oppSc, { ff: 1, tackles: 1 }, `Forced it, but the offense couldn't finish. ${score(g.mySc, g.oppSc)}.`, 'COMEBACK FALLS SHORT') },
              { p: 1 - strip.p, ...loss(g, g.mySc, g.oppSc + 3, {}, `Missed the tackle reaching for the ball. They kick a field goal. ${score(g.mySc, g.oppSc + 3)}.`, 'MISSED TACKLE') },
            ]),
            sub: `Win ${pc(strip.p * (team + 0.15))}. Strip it ${pc(strip.p)}${strip.why ? ` (your ${strip.why})` : ''} for a short field; reach and miss and they add a field goal.` },
          { id: 'stop', label: 'Play it straight, get the stop', o: { p: stop.p * team },
            outcomes: [{ p: stop.p * team, ...win(g, my, g.oppSc, { tackles: 2 }, `Three and out. The offense goes 70 yards. ${c.nick} win ${score(my, g.oppSc)}.`, 'COMEBACK') },
              { p: 1 - stop.p * team, ...loss(g, g.mySc, g.oppSc, { tackles: 2 }, `${stop.p > 0.5 ? 'Got the stop, but the drive stalled' : 'They picked up the first down and kneeled'}. ${score(g.mySc, g.oppSc)}.`, 'COMEBACK FALLS SHORT') }],
            sub: `${pc(stop.p * team)}: the stop (${pc(stop.p)}${stop.why ? `, your ${stop.why}` : ''}), then the offense has to score (${pc(team)}).` },
        ],
      }
    },
  },
  ol: {
    comeback: (c, g, d) => {
      const solo = odds(c, 0.55, ['passPro', 'anchor', 'mobility'])
      const chip = 0.62, team = teamScore(c), my = g.mySc + 7
      return {
        title: `Down ${d}, final drive`,
        body: `${score(g.mySc, g.oppSc)} against the ${nick(g.opponent)}, 1:40 left. Their edge rusher already has two sacks, both on your side.`,
        options: [
          { id: 'solo', label: 'Take him one on one', o: { p: solo.p * (team + 0.12) },
            outcomes: [{ p: solo.p * (team + 0.12), ...win(g, my, g.oppSc, { pancakes: 1 }, `He never touched the quarterback. Touchdown with 0:09 left. ${c.nick} win ${score(my, g.oppSc)}.`, 'GAME-WINNING DRIVE') },
              { p: solo.p * (1 - team - 0.12), ...loss(g, g.mySc, g.oppSc, {}, `You won your block, but the drive stalled. ${score(g.mySc, g.oppSc)}.`, 'COMEBACK FALLS SHORT') },
              { p: 1 - solo.p, ...loss(g, g.mySc, g.oppSc, { sacks: 1, pressures: 1 }, `Beaten around the edge. Strip-sack. ${c.nick} lose ${score(g.mySc, g.oppSc)}.`, 'SACK ALLOWED') }],
            sub: `Win ${pc(solo.p * (team + 0.12))}. Win your block ${pc(solo.p)}${solo.why ? ` (your ${solo.why})` : ''}: five receivers out, a better shot; lose it and it's a sack.` },
          { id: 'chip', label: 'Ask for a chip from the back', o: { p: chip * team },
            outcomes: [{ p: chip * team, ...win(g, my, g.oppSc, {}, `With help, the pocket held. Touchdown. ${c.nick} win ${score(my, g.oppSc)}.`, 'GAME-WINNING DRIVE') },
              { p: 1 - chip * team, ...loss(g, g.mySc, g.oppSc, {}, `Clean pocket, but one fewer receiver and nobody open. ${score(g.mySc, g.oppSc)}.`, 'COMEBACK FALLS SHORT') }],
            sub: `Win ${pc(chip * team)}: no sack risk, but four receivers instead of five.` },
        ],
      }
    },
    protect: (c, g, m) => {
      const hold = teamHold(c)
      const drive = odds(c, 0.56, ['runBlock', 'anchor', 'pancake'])
      const ls = [g.mySc, g.mySc + (7 - m)]
      return {
        title: `Up ${m}, they know the run is coming`,
        body: `${score(g.mySc, g.oppSc)} over the ${nick(g.opponent)}, 3:00 left. Eight in the box. Two first downs and it's over.`,
        options: [
          { id: 'drive', label: 'Run behind me', o: drive,
            outcomes: outs([
              { p: drive.p, ...win(g, g.mySc, g.oppSc, { pancakes: 2 }, `Moved the man in front of you five yards a snap. Kneel. ${c.nick} win ${score(g.mySc, g.oppSc)}.`, 'CLOSED IT OUT') },
              { p: (1 - drive.p) * hold, ...win(g, g.mySc, g.oppSc, {}, `Stalled, punt, and the defense holds. ${score(g.mySc, g.oppSc)}.`, 'DEFENSE HELD') },
              { p: (1 - drive.p) * (1 - hold), ...loss(g, ...ls, {}, `Stalled, punt, and they drive for the winner. ${score(...ls)}.`, 'BLEW THE LEAD') },
            ]),
            sub: `Win ${pc(drive.p + (1 - drive.p) * hold)}. Two first downs ${pc(drive.p)}${drive.why ? ` (your ${drive.why})` : ''}.` },
          { id: 'pass', label: 'Surprise them with play-action', o: { p: 0.45 + 0.55 * hold },
            outcomes: [{ p: 0.45, ...win(g, g.mySc, g.oppSc, {}, `Play-action, wide open, first down. Kneel. ${score(g.mySc, g.oppSc)}.`, 'ICED IT') },
              { p: 0.55 * hold, ...win(g, g.mySc, g.oppSc, {}, `Incomplete, punt, defense holds. ${score(g.mySc, g.oppSc)}.`, 'DEFENSE HELD') },
              { p: 0.55 * (1 - hold), ...loss(g, ...ls, { pressures: 1 }, `Incomplete, the clock stopped, and they drove for the winner. ${score(...ls)}.`, 'BLEW THE LEAD') }],
            sub: `Win ${pc(0.45 + 0.55 * hold)}: catches them off guard 45% of the time, and an incompletion stops the clock.` },
        ],
      }
    },
  },
}
NFL.te = {
  comeback: (c, g, d) => {
    const seam = odds(c, 0.36, ['hands', 'vertical', 'strength'])
    const my = g.mySc + 7
    return {
      title: `Down ${d}, red zone, last play`,
      body: `${score(g.mySc, g.oppSc)} against the ${nick(g.opponent)}, 0:07 left at their 14. Up the seam into traffic, or chip and release to the flat?`,
      options: [
        { id: 'seam', label: 'Up the seam, catch it in traffic', o: seam,
          outcomes: [{ p: seam.p, ...win(g, my, g.oppSc, { rec: 1, recYds: 14, recTDs: 1, targets: 1 }, `Took the hit, held on. Touchdown. ${c.nick} win ${score(my, g.oppSc)}.`, 'WALK-OFF CATCH') },
            { p: 1 - seam.p, ...loss(g, g.mySc, g.oppSc, { targets: 1 }, `Jarred loose by the safety. ${c.nick} lose ${score(g.mySc, g.oppSc)}.`, 'JARRED LOOSE') }],
          sub: sub(seam, `the catch and a ${score(my, g.oppSc)} win`, 'jarred loose, the loss') },
        { id: 'block', label: 'Chip the end, release late', o: odds(c, 0.3, ['blocking', 'awareness']),
          outcomes: (() => { const o = odds(c, 0.3, ['blocking', 'awareness']); return [{ p: o.p, ...win(g, my, g.oppSc, { rec: 1, recYds: 6, recTDs: 1, targets: 1 }, `Chipped, leaked out, uncovered. Touchdown. ${c.nick} win ${score(my, g.oppSc)}.`, 'WALK-OFF CATCH') }, { p: 1 - o.p, ...loss(g, g.mySc, g.oppSc, {}, `The chip bought time, but nobody came open. ${score(g.mySc, g.oppSc)}.`, 'COMEBACK FALLS SHORT') }] })(),
          sub: (() => { const o = odds(c, 0.3, ['blocking', 'awareness']); return sub(o, `a free release and the score`, 'nobody open, the loss') })() },
      ],
    }
  },
  protect: NFL.wr.protect,
}

// The rest: a lopsided game, nothing to decide but your own stat line (and your body)
function blowout(c, g, ahead) {
  const m = Math.abs(g.mySc - g.oppSc)
  const pos = c.pos
  const hurt = c.isOL ? 0.06 : pos === 'rb' ? 0.12 : 0.08
  const pad = {
    qb: ahead ? { passYds: rr(c, 45, 75), tds: 1 } : { passYds: rr(c, 70, 110), tds: 1 },
    rb: { rushYds: rr(c, 30, 55), carries: 6, rushTDs: c.r() < 0.4 ? 1 : 0 },
    wr: { rec: 3, recYds: rr(c, 35, 60), targets: 4 },
    te: { rec: 2, recYds: rr(c, 22, 40), targets: 3 },
    db: { tackles: 3, pbus: 1 },
    ol: { pancakes: 2 },
  }[pos] ?? {}
  const keepGoing = !ahead && pos === 'qb'
  const stayLabel = ahead ? 'Stay in, pad the numbers' : keepGoing ? 'Keep slinging it' : 'Stay in and play it out'
  const pickRisk = keepGoing ? 0.45 : 0
  const statsTxt = Object.entries(pad).filter(([, v]) => v).map(([k, v]) => `${v} ${({ passYds: 'yds', tds: 'TD', rushYds: 'rush yds', carries: 'carries', rushTDs: 'TD', rec: 'rec', recYds: 'yds', targets: 'targets', tackles: 'tackles', pbus: 'PD', pancakes: 'pancakes' })[k] ?? k}`).join(', ')
  return {
    title: ahead ? `Up ${m} in the 4th` : `Down ${m} in the 4th`,
    body: ahead ? `${score(g.mySc, g.oppSc)} over the ${nick(g.opponent)}. The game is over. The coach asks if you want to come out or keep adding to your season.`
                : `${score(g.mySc, g.oppSc)}, the ${nick(g.opponent)} are running away with it. Garbage time is still numbers on the stat sheet.`,
    options: [
      { id: 'stay', label: stayLabel,
        effect: { outcomes: outs([
          { p: (1 - hurt) * (1 - pickRisk), good: true, line: `Another ${statsTxt} on the season.`, tag: 'GARBAGE TIME', game: { add: pad } },
          { p: (1 - hurt) * pickRisk, good: false, line: `${pad.passYds} yds, no touchdown, and a pick.`, tag: 'GARBAGE TIME', game: { add: { ...pad, tds: 0, ints: 1 } } },
          { p: hurt, good: false, line: `${statsTxt}, then you took a shot on a meaningless snap. Out next week.`, tag: 'HURT IN GARBAGE TIME', game: { add: pad }, sit: 1, sitTag: 'INJURED' },
        ]) },
        sub: `${statsTxt} on your season${pickRisk ? ', 45% with a pick' : ''}. ${pc(hurt)} chance you get hurt and miss next week.` },
      { id: 'rest', label: 'Come out, save it for next week',
        effect: { outcomes: [{ p: 1, good: true, line: 'You watch the rest from the sideline, healthy.', tag: 'RESTED', game: { add: {} } }] },
        sub: 'No more stats tonight, no risk.' },
    ],
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// BASKETBALL
// ═════════════════════════════════════════════════════════════════════════════
function nbaState(g) {
  const m = g.mySc - g.oppSc
  // the last possession is rewritten from the final, so a 10-point game still had a late turn
  if (m < 0 && m >= -10) return 'comeback'
  if (m > 0 && m <= 10) return 'protect'
  if (m >= 16) return 'garbage'
  if (m <= -16) return 'chase'
  return null
}
const NBA = {
  comeback: (c, g) => {
    const big = c.pos === 'big'
    const three = odds(c, big ? 0.24 : 0.36, ['jumpShot', 'clutch'], 0.04)
    const drive = odds(c, 0.5, big ? ['finishing', 'size', 'bounce'] : ['finishing', 'handles', 'speed'], 0.04)
    const ot = clamp(0.5 + (c.val('clutch') - 6) * 0.02, 0.4, 0.6)
    const opp = g.oppSc, my2 = opp - 2
    return {
      title: 'Down 2, last possession',
      body: `${score(my2, opp)} against the ${nbaName(g.opponent)}. 0:08 left, your ball out of the timeout, and the play is drawn up for you.`,
      options: [
        { id: 'three', label: 'Pull up from three for the win', o: three,
          outcomes: [{ p: three.p, ...win(g, opp + 1, opp, { pts: 3 }, `Rise and fire. Splash. ${c.nick} win ${score(opp + 1, opp)} at the buzzer.`, 'BUZZER BEATER') },
            { p: 1 - three.p, ...loss(g, my2, opp, {}, `Front rim. ${c.nick} lose ${score(my2, opp)}.`, 'MISSED AT THE BUZZER') }],
          sub: sub(three, `the buzzer-beater, ${score(opp + 1, opp)}`, 'the loss') },
        { id: 'drive', label: 'Attack the rim for the tie', o: { p: drive.p * ot },
          outcomes: [{ p: drive.p * ot, ...win(g, opp + 5, opp + 3, { pts: 6 }, `Layup to tie it, then you take over in overtime. ${c.nick} win ${score(opp + 5, opp + 3)}.`, 'OVERTIME WIN') },
            { p: drive.p * (1 - ot), ...loss(g, opp + 2, opp + 6, { pts: 4 }, `Layup to tie it, but they pull away in overtime. ${score(opp + 2, opp + 6)}.`, 'OVERTIME LOSS') },
            { p: 1 - drive.p, ...loss(g, my2, opp, {}, `Walled up at the rim. ${c.nick} lose ${score(my2, opp)}.`, 'BLOCKED') }],
          sub: `Win ${pc(drive.p * ot)}. Score the tie ${pc(drive.p)}${drive.why ? ` (your ${drive.why})` : ''}, then win overtime (${pc(ot)}).` },
      ],
    }
  },
  protect: (c, g) => {
    // Up 2, they foul. Both made: up 4, over. A split: up 3, they need a three
    // to tie (30%), then overtime is a coin flip. Both missed: up 2, they get a
    // look (40%): half of those a three to win, half a two to force overtime.
    const ftTraits = ['clutch', 'jumpShot'].filter(t => c.T.has(t))
    const ft = clamp(0.66 + ftTraits.reduce((a, t) => a + (c.val(t) - 6), 0) * 0.025, 0.45, 0.92)
    const opp = g.oppSc, T = nbaName(g.opponent)
    const tree = (p, mine) => {
      const add = n => (mine ? { pts: n } : {})
      return outs([
        { p: p * p, ...win(g, opp + 4, opp, add(2), `${mine ? 'Two free throws, ice cold' : 'Your shooter hits both'}. ${c.nick} win ${score(opp + 4, opp)}.`, 'ICED IT AT THE LINE') },
        { p: 2 * p * (1 - p) * 0.85, ...win(g, opp + 3, opp, add(1), `${mine ? 'Split them' : 'He splits them'}. Their three at the buzzer is off. ${score(opp + 3, opp)}.`, 'HELD ON') },
        { p: 2 * p * (1 - p) * 0.15, ...loss(g, opp + 7, opp + 10, add(3), `${mine ? 'Split them' : 'He splits them'}, they hit a three to force overtime, and they win it there. ${score(opp + 7, opp + 10)}.`, 'OVERTIME LOSS') },
        { p: (1 - p) * (1 - p) * 0.7, ...win(g, opp + 2, opp, {}, `${mine ? 'Missed both' : 'He misses both'}, but their last shot rims out. ${score(opp + 2, opp)}.`, 'SURVIVED') },
        { p: (1 - p) * (1 - p) * 0.2, ...loss(g, opp + 2, opp + 3, {}, `${mine ? 'Missed both' : 'He misses both'}, and they hit a three at the buzzer. ${c.nick} lose ${score(opp + 2, opp + 3)}.`, 'MISSED AT THE LINE') },
        { p: (1 - p) * (1 - p) * 0.1, ...loss(g, opp + 6, opp + 9, {}, `${mine ? 'Missed both' : 'He misses both'}, they tie it, and win in overtime. ${score(opp + 6, opp + 9)}.`, 'OVERTIME LOSS') },
      ])
    }
    const winOf = p => p * p + 2 * p * (1 - p) * 0.85 + (1 - p) * (1 - p) * 0.7
    const why = ftTraits.map(t => `${c.L(t)} ${valToGrade(c.val(t))}`).join(', ')
    return {
      title: 'Up 2, they have to foul',
      body: `${score(opp + 2, opp)} over the ${T}, 0:09 left. They're going to foul whoever catches the inbound. You, or the team's best free-throw shooter?`,
      options: [
        { id: 'me', label: 'Get me the ball', outcomes: tree(ft, true),
          sub: `Win ${pc(winOf(ft))}: two free throws at ${pc(ft)} each${why ? ` (your ${why})` : ''}, and the points are yours.` },
        { id: 'mate', label: 'Get it to your best shooter', outcomes: tree(0.86, false),
          sub: `Win ${pc(winOf(0.86))}: an 86% shooter takes them. No points for you.` },
      ],
    }
  },
}
function nbaBlowout(c, g, ahead) {
  const m = Math.abs(g.mySc - g.oppSc)
  const add = { pts: rr(c, 6, 11), reb: rr(c, 1, 3), ast: rr(c, 0, 2) }
  return {
    title: ahead ? `Up ${m} in the 4th` : `Down ${m} in the 4th`,
    body: ahead ? `${score(g.mySc, g.oppSc)} over the ${nbaName(g.opponent)}. The starters are coming out. Stay in and keep your numbers going, or sit?`
                : `${score(g.mySc, g.oppSc)}, the ${nbaName(g.opponent)} are cruising. The bench is warming up.`,
    options: [
      { id: 'stay', label: 'Stay in, keep cooking',
        effect: { outcomes: [{ p: 0.92, good: true, line: `Another ${add.pts} points, ${add.reb} boards, ${add.ast} assists on your line.`, tag: 'GARBAGE TIME', game: { add } },
          { p: 0.08, good: false, line: `${add.pts} more points, then you landed wrong on a meaningless rebound. Out the next three.`, tag: 'HURT IN GARBAGE TIME', game: { add }, sit: 3, sitTag: 'INJURED' }] },
        sub: `+${add.pts} pts, ${add.reb} reb, ${add.ast} ast tonight. 8% chance you get hurt and miss three games.` },
      { id: 'rest', label: 'Sit, save the legs',
        effect: { outcomes: [{ p: 1, good: true, line: 'Towel on the shoulders, healthy.', tag: 'RESTED', game: { add: {} } }] },
        sub: 'No more stats tonight, no risk.' },
    ],
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// The card for the next game (or null when the game doesn't turn on a moment)
// ═════════════════════════════════════════════════════════════════════════════
const FLAVOR_NFL = [['SUNDAY NIGHT', 0.18], ['DIVISION GAME', 0.22], ['THURSDAY NIGHT', 0.1]]
export function gameMoment(c, g) {
  if (!g || g.sat) return null
  const isB = c.isBucket
  const state = isB ? nbaState(g) : nflState(g)
  if (!state) return null
  let card
  if (state === 'garbage' || state === 'chase') card = isB ? nbaBlowout(c, g, state === 'garbage') : blowout(c, g, state === 'garbage')
  else if (isB) card = NBA[state](c, g)
  else {
    const set = NFL[c.pos]
    const d = Math.abs(g.mySc - g.oppSc)
    card = set?.[state]?.(c, g, d) ?? null
  }
  if (!card) return null
  // the game it happens in
  let tag = ''
  if (!isB) { const roll = c.r(); let acc = 0; for (const [t, w] of FLAVOR_NFL) { acc += w; if (roll < acc) { tag = t; break } } }
  const where = isB ? `GAME ${g.g} · ${g.home ? 'VS' : 'AT'} ${nick(nbaName(g.opponent)).toUpperCase()}` : `WEEK ${g.wk} · ${g.home ? 'VS' : 'AT'} ${nick(g.opponent).toUpperCase()}`
  return {
    id: `game-${state}`, inGame: true,
    kicker: [tag, where].filter(Boolean).join(' · '),
    title: card.title, body: card.body,
    options: card.options.map(o => ({ id: o.id, label: o.label, sub: o.sub, effect: o.effect ?? { outcomes: o.outcomes } })),
  }
}
