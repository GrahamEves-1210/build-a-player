// Soccer's season: the story cards (lib/scenarios.js) and the in-match moments (lib/gameMoments.js), registered when
// soccer loads (lib/careerSoccer.js imports this). Its own file, so football and basketball never download it.
import { registerScenarios, o, gam, mix, INJURY, PO_INJURY } from './scenarios'
import { registerMoments, odds, sub, score, pc, outs } from './gameMoments'

// ═════════════════════════════════════════════════════════════════════════════
// SOCCER: a striker's season (c.nick is the club's full name)
// ═════════════════════════════════════════════════════════════════════════════
const SOCCER_ALL = [
  { id: 'fc-sacked', at: ['mid', 'late'], w: 4, when: c => c.struggling,
    make: c => ({ kicker: 'MANAGER SACKED', title: 'The board pulls the trigger',
      body: `${c.nick} are ${c.rec} and the manager is gone. An interim coach takes training on Monday, and nobody knows who starts on Saturday.`,
      options: [
        o('buy', 'Buy into the new man', gam(0.55, { team: { off: 1.5 } }, 'It clicks. The new manager plays to the No. 9.', { team: { off: -1.5 }, window: 3, tag: 'NEW MANAGER', then: { team: { off: 1 } } }, 'Three matches to find the shape, then it starts to work.')),
        o('loyal', 'Back the old manager in public', gam(0.5, { team: { off: 0.5 } }, 'The dressing room respects it. They play for each other.', { attr: c.R1('nerve', -1), window: 3, tag: 'OUT OF FAVOUR' }, 'The new man hasn\'t forgotten it. In and out of the team for a few weeks.')),
      ] }) },
  { id: 'fc-derby', at: ['early', 'mid', 'late'], w: 3, when: c => c.k >= 2,
    make: c => ({ kicker: 'DERBY WEEK', title: 'The biggest match of the season',
      body: `Derby week at ${c.nick}. The press conference is on Thursday, and every question is for ${c.name}.`,
      options: [
        o('talk', 'Talk it up in the press conference', gam(0.5, { attr: mix(c.R1('nerve', 2), c.R1('feel', 1)), window: 2, tag: 'DERBY WEEK' }, 'He backs it up. The crowd loves him for it.', { attr: c.R1('nerve', -2), window: 2, tag: 'DERBY WEEK' }, 'Their fans give him ninety minutes of it, and it gets to him.')),
        o('quiet', 'Keep his head down', { attr: c.R1('mind', 1), window: 2, tag: 'FOCUSED' }, 'No headlines, just the game plan.'),
      ] }) },
  { id: 'fc-rumour', at: ['mid', 'late'], w: 3, when: c => c.lastBig || c.contender,
    make: c => ({ kicker: 'TRANSFER RUMOUR', title: 'The papers say a giant is watching',
      body: `Two scouts in the stand on Saturday, and the back pages have him leaving ${c.nick} in the summer. Every question in the mixed zone is about it.`,
      options: [
        o('nothing', 'Say nothing, let the football talk', { attr: c.R1('nerve', 1), window: 4, tag: 'FOCUSED' }, 'Head down. Goals do the talking.'),
        o('flirt', 'Flirt with it in an interview', gam(0.45, { xp: 40 }, 'His price goes up, and the club stays calm.', { team: { off: -1 }, window: 4, tag: 'UNSETTLED' }, 'The fans turn on him, and the dressing room notices.')),
      ] }) },
  { id: 'fc-january', at: ['mid'], w: 4, when: c => !c.struggling,
    make: c => ({ kicker: 'THE JANUARY WINDOW', title: 'The club has money to spend',
      body: `${c.nick} have one big signing in them before the window shuts. The manager asks the senior players what the team needs.`,
      options: [
        o('ten', 'A creative midfielder', { team: { off: 1.5 } }, 'A new No. 10 on deadline day. More chances for the No. 9.'),
        o('cb', 'A centre-back', { team: { def: 1.5 } }, 'Fewer goals conceded, tighter matches.'),
        o('keep', 'Keep the squad together', { team: { off: 0.5, def: 0.5 } }, 'No new faces. Everyone knows their job.'),
      ] }) },
  { id: 'fc-sale', at: ['mid'], w: 4, when: c => c.struggling,
    make: c => ({ kicker: 'THE JANUARY WINDOW', title: 'The club sells',
      body: `${c.nick} need the money. Their best winger is going on deadline day. Stay quiet, or ask the club to keep him?`,
      options: [
        o('quiet', 'Stay quiet', { team: { off: -1.5 } }, 'Fewer balls into the box the rest of the way.'),
        o('ask', 'Ask the board to keep him', gam(0.4, { team: { off: -0.5 }, xp: 30 }, 'They listen. The sale falls through.', { team: { off: -1.5 }, attr: c.R1('nerve', -1), window: 3, tag: 'FALLOUT' }, 'He goes anyway, and the board doesn\'t like being told.')),
      ] }) },
  { id: 'fc-dropped', at: ['mid', 'late'], w: 5, when: c => c.lastBust && c.skid >= 2,
    make: c => ({ kicker: 'DROPPED', title: 'Not in the starting eleven',
      body: `${c.skid} without a win and nothing from the No. 9. The team sheet goes up on Friday and ${c.name} is on the bench.`,
      options: [
        o('take', 'Take it on the chin', { sit: 1, tag: 'DROPPED' }, 'One match on the bench, then back in.'),
        o('door', 'Knock on the manager\'s door', gam(0.5, {}, 'He respects it. Back in the team on Saturday.', { sit: 3, tag: 'DROPPED' }, 'The manager doesn\'t budge. Three matches on the bench.')),
      ] }) },
  { id: 'fc-armband', at: ['mid', 'late'], w: 2, when: c => c.k >= 6,
    make: c => ({ kicker: 'THE ARMBAND', title: 'The captain is injured',
      body: `The club captain is out for a month, and the manager hands ${c.name} the armband.`,
      options: [
        o('lead', 'Lead from the front', { attr: c.R1('nerve', 1), window: 4, tag: 'CAPTAIN' }, 'First to every press, first in the huddle.'),
        o('pass', 'Let a senior pro have it', { attr: c.R1('mind', 1), window: 2, tag: 'FOCUSED' }, 'He keeps his mind on his own game.'),
      ] }) },
  { id: 'fc-runin', at: ['late', 'stretch'], w: 5, when: c => c.contender && c.left >= 4,
    make: c => ({ kicker: 'THE RUN-IN', title: 'A title race',
      body: `${c.nick} are ${c.rec} with ${c.left} matches left, in the race for the title. The legs are heavy, and the cup and Europe are still on.`,
      options: [
        o('every', 'Play every minute', gam(0.8, { attr: c.R1('feel', 1), tag: 'ALL IN' }, 'Every minute, and healthy.', { attr: c.R('legs', -2), tag: 'RUNNING ON EMPTY' }, 'The legs go in April.')),
        o('rotate', 'Rest in the cup, save the legs', { attr: c.R('legs', 1), team: { off: -0.5 }, window: 4, tag: 'ROTATED' }, 'Fresher for the league, a little less of him in the cup.'),
      ] }) },
  { id: 'fc-dogfight', at: ['late', 'stretch'], w: 5, when: c => c.struggling && c.left >= 3,
    make: c => ({ kicker: 'RELEGATION SCRAP', title: 'A fight to stay up',
      body: `${c.nick} are ${c.rec}, down at the wrong end. ${c.left} matches to stay in the division.`,
      options: [
        o('dirty', 'Do the dirty work', { attr: c.R1('power', 1), team: { def: 1 }, tag: 'SCRAPPING' }, 'He presses, holds it up, wins free kicks. The team gets up the pitch.'),
        o('goals', 'Stay on the shoulder and wait for chances', { attr: c.R1('feel', 1) }, 'Goals or nothing.'),
      ] }) },
]
const SOCCER_PO = [
  { id: 'fc-bignights', at: ['playoffs'], w: 5, when: () => true,
    make: c => ({ kicker: 'THE BIG NIGHTS', title: 'Knockout football',
      body: 'The league is done. The finals and the European nights are what a season is remembered for. The manager asks how he wants to play them.',
      options: [
        o('channels', 'Lead the line, run the channels', { attr: mix(c.R('make', 1), c.R1('feel', 1)), team: { def: -0.5 } }, 'More of him, more space at the back.'),
        o('press', 'Defend from the front', { team: { def: 1 }, attr: c.R1('make', -1) }, 'Fewer chances, fewer mistakes.'),
      ] }) },
]


// ═════════════════════════════════════════════════════════════════════════════
// SOCCER: the late chance in a tight league match. A goal changes the result (the point becomes three, the
// defeat a draw); a miss leaves it as it was. Nobody on the losing side celebrates: the lines say who won.
// ═════════════════════════════════════════════════════════════════════════════
const fin = (my, opp) => ({ won: my > opp, drawn: my === opp })
const fcWin = (my, opp, add, line, tag) => ({ good: true, line, tag, game: { ...fin(my, opp), my, opp, add } })
const fcStay = (my, opp, add, line, tag, good = false) => ({ good, line, tag, game: { ...fin(my, opp), my, opp, add } })
const minute = c => 82 + Math.floor(c.r() * 9)
function soccerMoment(c, g) {
  if (!g || g.sat || !g.app) return null
  const m = g.mySc - g.oppSc, opp = g.oppName ?? g.opponent, at = minute(c)
  const shot = { shots: 1, sot: 1, goals: 1 }, miss = { shots: 1 }
  if (m === 0) {
    // level late: a penalty one time in four, else he's through on goal
    if (c.r() < 0.25) {
      const side = odds(c, 0.76, ['composure', 'finishing'], 0.025), mid = odds(c, 0.72, ['shotPower', 'composure'], 0.03)
      return { title: `Penalty, ${at}th minute`, body: `${score(g.mySc, g.oppSc)} with ${opp}. He's been brought down in the box, and he wants the ball.`, options: [
        { id: 'corner', label: 'Side-foot it into the corner', outcomes: [{ p: side.p, ...fcWin(g.mySc + 1, g.oppSc, shot, `Keeper the wrong way. ${c.nick} win ${score(g.mySc + 1, g.oppSc)}.`, 'LATE WINNER') }, { p: 1 - side.p, ...fcStay(g.mySc, g.oppSc, miss, `Saved, low to his left. It finishes ${score(g.mySc, g.oppSc)}.`, 'PENALTY SAVED') }],
          sub: sub(side, `the winner, ${score(g.mySc + 1, g.oppSc)}`, 'a draw') },
        { id: 'middle', label: 'Smash it down the middle', outcomes: [{ p: mid.p, ...fcWin(g.mySc + 1, g.oppSc, shot, `The keeper dives, it goes straight in. ${c.nick} win ${score(g.mySc + 1, g.oppSc)}.`, 'LATE WINNER') }, { p: 1 - mid.p, ...fcStay(g.mySc, g.oppSc, miss, `Over the bar. It finishes ${score(g.mySc, g.oppSc)}.`, 'PENALTY MISSED') }],
          sub: sub(mid, `the winner, ${score(g.mySc + 1, g.oppSc)}`, 'a draw') },
      ] }
    }
    const early = odds(c, 0.4, ['finishing', 'composure', 'offBall']), round = odds(c, 0.34, ['dribbling', 'composure', 'pace']), square = odds(c, 0.46, ['linkUp', 'offBall'])
    return { title: `Level, ${at}th minute`, body: `${score(g.mySc, g.oppSc)} with ${opp}. A ball over the top and he's through, a defender chasing and the keeper coming out.`, options: [
      { id: 'early', label: 'Shoot early, before the keeper sets', outcomes: [{ p: early.p, ...fcWin(g.mySc + 1, g.oppSc, shot, `Low into the far corner. ${c.nick} win ${score(g.mySc + 1, g.oppSc)}.`, 'LATE WINNER') }, { p: 1 - early.p, ...fcStay(g.mySc, g.oppSc, miss, `Wide of the post. It finishes ${score(g.mySc, g.oppSc)}.`, 'CHANCE MISSED') }],
        sub: sub(early, `the winner, ${score(g.mySc + 1, g.oppSc)}`, 'a draw') },
      { id: 'round', label: 'Take it round the keeper', outcomes: [{ p: round.p, ...fcWin(g.mySc + 1, g.oppSc, shot, `Round him and into the empty net. ${c.nick} win ${score(g.mySc + 1, g.oppSc)}.`, 'LATE WINNER') }, { p: 1 - round.p, ...fcStay(g.mySc, g.oppSc, {}, `The keeper gets a hand to it. It finishes ${score(g.mySc, g.oppSc)}.`, 'CHANCE MISSED') }],
        sub: sub(round, `the winner, ${score(g.mySc + 1, g.oppSc)}`, 'a draw') },
      { id: 'square', label: 'Square it for a teammate', outcomes: [{ p: square.p, ...fcWin(g.mySc + 1, g.oppSc, { assists: 1 }, `Across the six-yard box, tapped in. ${c.nick} win ${score(g.mySc + 1, g.oppSc)}, and the assist is his.`, 'LATE WINNER') }, { p: 1 - square.p, ...fcStay(g.mySc, g.oppSc, {}, `Cut out at the near post. It finishes ${score(g.mySc, g.oppSc)}.`, 'CHANCE MISSED') }],
        sub: sub(square, `a teammate's winner and the assist`, 'a draw') },
    ] }
  }
  if (m === -1) {
    const first = odds(c, 0.3, ['shotPower', 'finishing']), touch = odds(c, 0.32, ['firstTouch', 'finishing', 'composure'])
    return { title: `A goal down, ${at}th minute`, body: `${score(g.mySc, g.oppSc)} to ${opp}. A clearance drops to him on the edge of the box.`, options: [
      { id: 'first', label: 'Hit it first time', outcomes: [{ p: first.p, ...fcStay(g.oppSc, g.oppSc, shot, `Volleyed in off the bar. ${score(g.oppSc, g.oppSc)}, a point saved.`, 'LATE EQUALISER', true) }, { p: 1 - first.p, ...fcStay(g.mySc, g.oppSc, miss, `Into the stand. ${c.nick} lose ${score(g.mySc, g.oppSc)}.`, 'CHANCE MISSED') }],
        sub: sub(first, `the equaliser, ${score(g.oppSc, g.oppSc)}`, 'the defeat stands') },
      { id: 'touch', label: 'Take a touch and pick a spot', outcomes: [{ p: touch.p, ...fcStay(g.oppSc, g.oppSc, shot, `One touch, then into the corner. ${score(g.oppSc, g.oppSc)}, a point saved.`, 'LATE EQUALISER', true) }, { p: 1 - touch.p, ...fcStay(g.mySc, g.oppSc, {}, `Closed down before he can shoot. ${c.nick} lose ${score(g.mySc, g.oppSc)}.`, 'CLOSED DOWN') }],
        sub: sub(touch, `the equaliser, ${score(g.oppSc, g.oppSc)}`, 'the defeat stands') },
    ] }
  }
  if (m === 1) {
    const hold = odds(c, 0.7, ['strength', 'firstTouch'], 0.04), second = odds(c, 0.33, ['pace', 'finishing'])
    const eq = Math.round((1 - second.p) * 0.3 * 100) / 100
    return { title: `A goal up, ${at}th minute`, body: `${score(g.mySc, g.oppSc)} against ${opp}, and they're throwing everyone forward. The ball is cleared to him.`, options: [
      { id: 'hold', label: 'Hold it up in the corner', outcomes: [{ p: hold.p, ...fcStay(g.mySc, g.oppSc, {}, `He wins a corner, then a throw, then a free kick. ${c.nick} win ${score(g.mySc, g.oppSc)}.`, 'SAW IT OUT', true) }, { p: 1 - hold.p, ...fcStay(g.mySc, g.mySc, {}, `Muscled off it, and they break to equalise. ${score(g.mySc, g.mySc)}.`, 'LATE EQUALISER CONCEDED') }],
        sub: `${pc(hold.p)}${hold.why ? ` (his ${hold.why})` : ''}: the win. Otherwise they equalise.` },
      { id: 'second', label: 'Run at goal for the second', outcomes: [{ p: second.p, ...fcWin(g.mySc + 1, g.oppSc, shot, `Away on his own, and he finishes it. ${c.nick} win ${score(g.mySc + 1, g.oppSc)}.`, 'PUT IT AWAY') }, { p: eq, ...fcStay(g.mySc, g.mySc, miss, `Saved, and they go straight up the other end. ${score(g.mySc, g.mySc)}.`, 'LATE EQUALISER CONCEDED') }, { p: Math.max(0, 1 - second.p - eq), ...fcStay(g.mySc, g.oppSc, miss, `Saved, but they can't find an equaliser. ${c.nick} win ${score(g.mySc, g.oppSc)}.`, 'HELD ON', true) }],
        sub: `${pc(second.p)}${second.why ? ` (his ${second.why})` : ''}: a second goal. ${pc(eq)} they break and equalise.` },
    ] }
  }
  if (m >= 3) {
    const stay = odds(c, 0.32, ['finishing', 'offBall'])
    return { title: `${score(g.mySc, g.oppSc)} up, the board goes up`, body: `${c.nick} are cruising against ${opp}. The manager wants to bring him off and rest his legs.`, options: [
      { id: 'stay', label: 'Ask to stay on', outcomes: outs([{ p: stay.p * 0.95, ...fcStay(g.mySc + 1, g.oppSc, shot, `One more for the season: ${score(g.mySc + 1, g.oppSc)}.`, 'ANOTHER ONE', true) }, { p: (1 - stay.p) * 0.95, ...fcStay(g.mySc, g.oppSc, {}, 'Nothing more in it, but he played the full ninety.', 'FULL NINETY', true) }, { p: 0.05, good: false, line: 'A knock in the last minute. He misses the next two.', tag: 'HURT LATE ON', game: { add: {} }, sit: 2, sitTag: 'INJURED' }]),
        sub: `${pc(stay.p * 0.95)}: another goal. 5% he picks up a knock and misses two matches.` },
      { id: 'off', label: 'Come off, save the legs', effect: { outcomes: [{ p: 1, good: true, line: 'A standing ovation, and his feet up.', tag: 'RESTED', game: { add: {} } }] }, sub: 'Nothing more tonight, no risk.' },
    ] }
  }
  return null
}


registerScenarios('soccer', {
  bank: { all: [...SOCCER_ALL, ...INJURY.filter(s => s.id !== 'concussion')], st: [], playoffs: [...SOCCER_PO, ...PO_INJURY] },
  role: {
  st:    { legs: ['pace'], feel: ['finishing', 'firstTouch'], mind: ['offBall'], nerve: ['composure'], power: ['strength', 'heading', 'shotPower'], make: ['dribbling', 'linkUp'] },
  },
  injuries: {
  st: [
    { name: 'Hamstring strain', hit: { pace: -3, shotPower: -1 }, out: 3, hurt: 5 },
    { name: 'Ankle sprain', hit: { dribbling: -2, firstTouch: -2 }, out: 2, hurt: 4 },
    { name: 'Groin strain', hit: { pace: -2, shotPower: -2 }, out: 3, hurt: 5 },
    { name: 'Thigh strain', hit: { shotPower: -3, pace: -1 }, out: 2, hurt: 4 },
    { name: 'Knock to the knee', hit: { strength: -2, heading: -2 }, out: 2, hurt: 4 },
  ],
  },
})
registerMoments('soccer', soccerMoment)
