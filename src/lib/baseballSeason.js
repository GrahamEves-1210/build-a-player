// Baseball's season: the story cards (lib/scenarios.js) and the in-game moments (lib/gameMoments.js), registered
// when baseball loads (lib/careerBaseball.js imports this). Its own file, so the other sports never download it.
// The cards: a slump, the trade deadline, the pitch clock, a position change, a contract year, a rivalry series,
// a hitting streak, the dog days, an innings limit, clinching and elimination, and October. The moments: a late at-bat
// with the game on it, a jam to escape with a lead, the ninth inning of a save, and a no-hitter through seven.
import { registerScenarios, o, gam, mix } from './scenarios'
import { registerMoments, odds, sub, score, pc } from './gameMoments'
import { MLB_TEAMS } from '../data/mlb-teams'
import * as MB from '../data/mlb-batters'
import * as MP from '../data/mlb-pitchers'

const TEAM = new Map(MLB_TEAMS.map(t => [t.short, t]))
const TWO = /\s(Red Sox|White Sox|Blue Jays)$/
const nickOf = short => { const t = TEAM.get(short); return t ? t.nick ?? TWO.exec(t.name)?.[1] ?? t.name.split(' ').slice(-1)[0] : short ?? 'them' }
const sum = (list, k) => list.reduce((s, g) => s + (g[k] ?? 0), 0)
const ip = outs => `${Math.floor(outs / 3)}.${outs % 3}`
const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

// ── The season as baseball reads it: the playoff line (about 86 wins gets in, 95 is safe), his slump or streak ──
function bbContext({ k, total, left, wins, pace, ctx, pos, team }) {
  const mine = ctx.games.filter(g => !g.sat && g.app)
  const last10 = mine.slice(-10), ab10 = sum(last10, 'ab'), h10 = sum(last10, 'h')
  let streak = 0
  for (let i = mine.length - 1; i >= 0; i--) { if ((mine[i].h ?? 0) > 0) streak++; else if ((mine[i].ab ?? 0) > 0) break }
  const starts = mine.filter(g => g.gs).slice(-3), sOuts = sum(starts, 'outs')
  const scale = total / 162, needIn = 86 * scale, lock = 95 * scale
  return {
    isBaseball: true, role: team?.role ?? (pos === 'pit' ? 'SP' : 'bat'), isSP: team?.role === 'SP', closer: team?.role === 'CL', bat: pos === 'bat',
    alive: wins + left >= needIn, clinched: wins >= lock, eliminated: wins + left < needIn,
    bubble: wins + left >= needIn && wins < lock && pace >= 82 * scale && pace <= 92 * scale,
    deadline: k >= 88 * scale && k <= 118 * scale,
    contender: k >= 40 * scale && pace >= 92 * scale, struggling: k >= 40 * scale && pace <= 72 * scale,
    slump: pos === 'bat' && ab10 >= 28 && h10 / ab10 < 0.17, slumpLine: `${h10}-for-${ab10}`,
    hitStreak: pos === 'bat' ? streak : 0,
    pitSlump: pos === 'pit' && starts.length >= 3 && sOuts > 0 && sum(starts, 'er') * 27 / sOuts > 6.3, pitLine: starts.length ? `${sum(starts, 'er')} earned runs in his last ${starts.length} starts (${ip(sOuts)} innings)` : '',
    g: n => n, unitWord: 'games',
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// THE CARDS (c.nick: the club's nickname)
// ═════════════════════════════════════════════════════════════════════════════
const BB_ALL = [
  { id: 'bb-slump', at: ['early', 'mid', 'late'], w: 5, when: c => c.slump,
    make: c => ({ kicker: 'SLUMP', title: `${c.slumpLine} over his last ten`, body: `${c.name} is pressing. The hitting coach has video of him pulling off the ball, and the beat writers are counting the hitless at-bats.`,
      options: [
        o('cage', 'Extra work in the cage', gam(0.55, { attr: c.R('feel', 2), window: 12, tag: 'LOCKED IN' }, 'He finds his swing again: short to the ball, the other way.', { attr: c.R('feel', -1), window: 6, tag: 'PRESSING' }, 'Too much work, too many thoughts. Another week of it.')),
        o('day', 'A day off to clear his head', { sit: 1, tag: 'DAY OFF', then: { attr: c.R1('feel', 1), window: 10 } }, 'One day on the bench, then back in the lineup fresh.'),
      ] }) },
  { id: 'bb-rough', at: ['early', 'mid', 'late'], w: 5, when: c => c.pitSlump,
    make: c => ({ kicker: 'ROUGH STRETCH', title: 'Hit hard three starts running', body: `${c.pitLine}. The pitching coach thinks he’s tipping his pitches out of the stretch.`,
      options: [
        o('bullpen', 'Fix it in a side session', gam(0.6, { attr: mix(c.R1('feel', 2), c.R1('mind', 1)), window: 15, tag: 'BACK ON TRACK' }, 'They clean up his glove position. The swings and misses come back.', { attr: c.R1('feel', -1), window: 8, tag: 'STILL TIPPING' }, 'It takes another two starts to find it.')),
        o('skip', 'Skip a start, reset', { sit: 5, tag: 'SKIPPED START', then: { attr: c.R('feel', 1), window: 15 } }, 'He misses a turn in the rotation and comes back rested.'),
      ] }) },
  { id: 'bb-deadline', at: ['late'], w: 4, when: c => c.deadline && c.alive && !c.struggling,
    make: c => {
      const d = c.deals?.()
      const want = (g, role) => MLB_POOL.filter(p => p.group === g && p.team !== c.team && (!role || role(p)) && (!d || d.ok(p, g))).map(p => ({ ...p, ovr: d ? d.ovr(g, p) : p.ovr ?? 80 })).filter(p => p.ovr >= 80).sort((a, b) => b.ovr - a.ovr)
      const pickOf = list => list[Math.floor(c.r() * Math.min(list.length, 12))] ?? null
      const bat = pickOf(want('bat')), arm = pickOf(want('pit', p => p.role === 'SP' || p.role === 'CL'))
      if (!bat || !arm) return null
      const fx = (p, flat) => (d ? (() => { const f = d.fx(p, p.group); return { team: { off: f.off, def: f.def }, trade: { name: p.name, group: p.group, from: p.team, grades: f.grades } } })() : { team: flat })
      return { kicker: 'TRADE DEADLINE', title: 'The front office is buying', body: `The ${c.nick} are in the race, and two deals are on the table at the deadline: ${bat.name} from the ${nickOf(bat.team)} or ${arm.name} from the ${nickOf(arm.team)}. The general manager asks the clubhouse leaders.`,
        options: [
          o('bat', `Trade for ${bat.name}`, fx(bat, { off: 1.5 }), `A middle-of-the-order bat for the stretch run.`),
          o('arm', `Trade for ${arm.name}`, fx(arm, { def: 1.5 }), arm.role === 'CL' ? 'A closer for the ninth inning.' : 'A starter for the October rotation.'),
          o('stand', 'Keep the prospects, keep the clubhouse', { team: { off: 0.5, def: 0.5 } }, 'No new faces. Everyone knows his job.'),
        ] }
    } },
  { id: 'bb-sell', at: ['late'], w: 4, when: c => c.deadline && c.struggling,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'The front office sells', body: `The ${c.nick} are sellers at the deadline. Their best reliever and a veteran bat are going to contenders for prospects.`,
      options: [
        o('quiet', 'Say nothing, keep playing', { team: { off: -0.75, def: -0.75 } }, 'A thinner club the rest of the way.'),
        o('speak', 'Tell the press it’s the wrong move', gam(0.4, { xp: 30 }, 'The fans are with him. The front office keeps the veteran bat.', { team: { off: -0.75, def: -0.75 }, attr: c.R1('nerve', -1), window: 12, tag: 'FALLOUT' }, 'The deals go through anyway, and the front office remembers.')),
      ] }) },
  { id: 'bb-clock', at: ['early', 'mid', 'late'], w: 2, when: () => true,
    make: c => (c.bat
      ? { kicker: 'THE PITCH CLOCK', title: 'An automatic strike with the bases loaded', body: `${c.name} wasn’t set in the box with eight seconds on the timer. Strike one before a pitch was thrown, and he struck out two pitches later. He went after the umpire on the way back to the dugout.`,
        options: [
          o('routine', 'Speed up his routine in the box', { attr: c.R1('mind', 1), window: 10, tag: 'QUICKER ROUTINE' }, 'Fewer adjustments between pitches. He gets in and hits.'),
          o('argue', 'Keep his routine, take it up with the league', gam(0.5, { attr: c.R1('nerve', 1), window: 10 }, 'Nobody rushes him. He plays at his own pace and it works.', { attr: c.R1('nerve', -2), window: 6, tag: 'RATTLED' }, 'Two more violations in a week. It’s in his head now.')),
        ] }
      : { kicker: 'THE PITCH CLOCK', title: 'Two violations in one start', body: `An automatic ball with a full count, then another in the next inning. The umpire warned him; ${c.name} told him what he thought of the timer.`,
        options: [
          o('tempo', 'Work faster: fewer looks at the runner', { attr: mix(c.R1('feel', -1), c.R1('legs', 1)), window: 10, tag: 'QUICK TEMPO' }, 'He keeps the pace. Hitters can’t settle in, though the runners take off on him.'),
          o('own', 'Keep his own rhythm, step off when he needs to', gam(0.5, { attr: c.R1('nerve', 1), window: 10 }, 'He uses his disengagements well. Nobody rattles him.', { attr: c.R1('nerve', -2), window: 6, tag: 'RATTLED' }, 'More violations, more walks. A rough two weeks.')),
        ] }) },
  { id: 'bb-move', at: ['mid', 'late'], w: 2, when: c => c.bat,
    make: c => ({ kicker: 'A NEW POSITION', title: 'The manager wants him at first base', body: `The ${c.nick} called up a glove-first infielder, and the manager asks ${c.name} to play first base for the rest of the season.`,
      options: [
        o('move', 'Move to first base', { attr: c.T.has('fielding') ? { fielding: 1, arm: -1 } : {}, team: { def: 0.5 }, tag: 'FIRST BASE' }, 'An easier spot on the diamond, and a better glove behind the pitchers.'),
        o('stay', 'Ask to stay where he is', gam(0.5, { attr: c.R1('nerve', 1) }, 'The manager backs down. He keeps his spot and plays with a chip on his shoulder.', { attr: c.R1('mind', -1), window: 10, tag: 'UNHAPPY' }, 'He stays, and the manager doesn’t forget it.')),
      ] }) },
  { id: 'bb-pen', at: ['mid', 'late'], w: 2, when: c => !c.bat && c.isSP && c.alive,
    make: c => ({ kicker: 'A NEW ROLE', title: 'The bullpen needs an arm', body: `The ${c.nick}’ bullpen has blown five leads in two weeks. The manager asks ${c.name} to pitch in relief for a few weeks.`,
      options: [
        o('pen', 'Go to the bullpen', { attr: c.T.has('velocity') ? { velocity: 1, stamina: -2 } : {}, team: { def: 0.75 }, window: 15, tag: 'IN RELIEF' }, 'One inning at a time, everything he has: the velocity ticks up.'),
        o('stay', 'Stay in the rotation', { attr: c.R1('nerve', 1), window: 10 }, 'He wants the ball every fifth day, and he gets it.'),
      ] }) },
  { id: 'bb-contract', at: ['early', 'mid'], w: 3, when: c => c.contractYear,
    make: c => ({ kicker: 'CONTRACT YEAR', title: 'Free agency is a season away', body: `${c.name}’s agent wants an extension done before the All-Star break. The front office wants to wait and see.`,
      options: [
        o('wait', 'No talks until October', { attr: c.R1('nerve', 1), window: 30, tag: 'FOCUSED' }, 'He tells everyone the same thing: the contract can wait.'),
        o('talk', 'Let the talks go on', gam(0.5, { xp: 40, attr: c.R1('feel', 1), window: 15 }, 'The talks go well. He plays loose.', { attr: c.R1('feel', -1), window: 12, tag: 'DISTRACTED' }, 'The talks stall in public, and it follows him to the plate.')),
      ] }) },
  { id: 'bb-rival', at: ['early', 'mid', 'late', 'stretch'], w: 3, when: c => c.k >= 10,
    make: c => ({ kicker: 'RIVALRY WEEKEND', title: 'A sold-out series with the division rival', body: `Three games against the ${c.rival ?? 'division rival'}, the ballpark full and loud. ${c.name} is the name on every back page this weekend.`,
      options: [
        o('up', 'Get up for it', gam(0.55, { attr: mix(c.R('feel', 2), c.R1('nerve', 1)), window: 3, tag: 'RIVALRY' }, 'He owns the series. The road crowd boos him all weekend.', { attr: c.R1('nerve', -2), window: 3, tag: 'RIVALRY' }, 'He tries to do too much in front of the crowd.')),
        o('same', 'Treat it like any other series', { attr: c.R1('mind', 1), window: 3, tag: 'BUSINESS' }, 'Same routine, same approach.'),
      ] }) },
  { id: 'bb-streak', at: ['early', 'mid', 'late', 'stretch'], w: 6, when: c => c.hitStreak >= 15,
    make: c => ({ kicker: 'HITTING STREAK', title: `A hit in ${c.hitStreak} straight games`, body: `${c.name} has a hit in ${c.hitStreak} straight. Joe DiMaggio’s 56 is the record. The cameras follow him to batting practice now.`,
      options: [
        o('press', 'Talk about it with the press', gam(0.5, { attr: c.R1('nerve', 1), window: 8, tag: 'ON A STREAK' }, 'He enjoys every minute of it, and keeps hitting.', { attr: c.R1('nerve', -2), window: 5, tag: 'PRESSING' }, 'He starts chasing to keep it alive.')),
        o('quiet', 'Keep the streak out of his head', { attr: c.R1('mind', 1), window: 8, tag: 'ON A STREAK' }, 'No interviews, the same approach every at-bat.'),
      ] }) },
  { id: 'bb-dogdays', at: ['late'], w: 2, when: c => c.roleHas('legs') && c.alive,
    make: c => ({ kicker: 'THE DOG DAYS', title: 'August, and the legs are heavy', body: `${c.name} has played almost every day since spring training. Nothing hurts enough to sit, but the bat speed is a tick slow.`,
      options: [
        o('rest', 'A scheduled day off', { sit: c.bat ? 2 : 5, tag: 'RESTED', then: { attr: c.R('legs', 1) } }, c.bat ? 'Two days off, then fresh legs for September.' : 'One turn skipped, then a fresh arm for September.'),
        o('play', 'Keep running him out there', { attr: c.R('legs', -1), tag: 'WORN DOWN' }, 'He plays every day, a little slower the rest of the way.'),
      ] }) },
  { id: 'bb-limit', at: ['late', 'stretch'], w: 3, when: c => !c.bat && c.isSP && c.young,
    make: c => ({ kicker: 'INNINGS LIMIT', title: 'The front office wants to cap his innings', body: `${c.name} is already past his innings total from last year. The front office wants him to skip two starts before September.`,
      options: [
        o('cap', 'Skip two starts', { sit: 10, dur: 0.4, tag: 'INNINGS LIMIT' }, 'His arm gets a rest. Good for the long run.'),
        o('pitch', 'Keep taking the ball', gam(0.75, { xp: 30 }, 'He pitches every fifth day and the arm feels fine.', { attr: c.R('legs', -2), dur: -0.6, tag: 'TIRED ARM' }, 'A tired arm in September. The fastball loses two miles an hour.')),
      ] }) },
  { id: 'bb-injury', at: ['early', 'mid', 'late', 'stretch'], w: 3, when: c => !!c.injury(),
    make: c => {
      const inj = c.injury(), out = inj.out, hurt = Math.min(inj.hurt, Math.max(1, c.left))
      return { kicker: 'INJURY REPORT', title: inj.name, body: `The trainers say ${out} games on the injured list and it heals clean. He can play through it, but it won’t be right, and it could get worse.`,
        options: [
          o('il', 'Go on the injured list', { sit: out, tag: inj.name.toUpperCase() }, `The ${c.nick} play without him.`),
          o('play', 'Play through it', gam(0.65, { attr: inj.hit, window: hurt, tag: 'PLAYING HURT', dur: -0.3 }, 'It held. Not right, but he played every day.', { attr: inj.hit, window: 3, tag: 'PLAYING HURT', dur: -0.6, then: { sit: out + 5, tag: 'INJURED LIST' } }, 'It gave out. Now he’s out longer than if he’d sat.')),
        ] }
    } },
  { id: 'bb-clinched', at: ['stretch'], w: 5, when: c => c.clinched && c.left >= 6,
    make: c => ({ kicker: 'CLINCHED', title: 'A playoff spot, with games to play', body: `The ${c.nick} have clinched. ${c.left} games left. The manager asks if ${c.name} wants the last week off.`,
      options: [
        o('rest', 'Rest for October', { sit: c.bat ? 3 : 5, tag: 'RESTED', then: { attr: c.R('legs', 1) } }, 'Fresh for the postseason.'),
        o('seed', 'Play for the top seed', gam(0.8, {}, 'He plays every game, healthy.', { attr: c.R('legs', -2), tag: 'BANGED UP' }, 'Banged up in a game that didn’t matter. He carries it into October.')),
      ] }) },
  { id: 'bb-out', at: ['stretch'], w: 6, when: c => c.eliminated && c.left >= 8,
    make: c => ({ kicker: 'OUT OF IT', title: 'Eliminated', body: `The ${c.nick} are out of the race with ${c.left} games left. Play it out, or shut it down for the winter?`,
      options: [
        o('play', 'Play it out', gam(0.85, { xp: 25 }, 'Finished the season healthy. The numbers count.', { sit: c.left, dur: -0.8, tag: 'INJURED' }, 'Hurt in a meaningless game in September. Done for the year.')),
        o('shut', 'Shut it down', { sit: c.left, dur: 0.5, tag: 'SHUT DOWN' }, 'A long winter to heal. The body thanks him.'),
      ] }) },
]
const BB_PO = [
  { id: 'bbpo-plan', at: ['playoffs'], w: 5, when: () => true,
    make: c => (c.bat
      ? { kicker: 'OCTOBER', title: 'The manager’s plan for the postseason', body: 'Every pitch matters now. The other side’s staff is the best he’ll see all year.',
        options: [
          o('hunt', 'Hunt the fastball, do damage', { attr: mix(c.R('power', 2), c.R1('feel', -1)) }, 'More power, more swing and miss.'),
          o('grind', 'Grind out at-bats, make them work', { attr: c.R('mind', 2), team: { off: 0.5 } }, 'Long at-bats, deep counts, the starter out by the fifth.'),
        ] }
      : { kicker: 'OCTOBER', title: 'Short rest?', body: 'The manager asks if he can pitch on three days’ rest if a series goes long.',
        options: [
          o('short', 'Give him the ball on short rest', { attr: mix(c.R1('make', 1), c.R('legs', -2)), team: { def: 0.75 } }, 'More of him, on a tired arm.'),
          o('normal', 'Normal rest, trust the staff', { team: { def: 0.5 }, attr: c.R1('mind', 1) }, 'Fresh every time he takes the ball.'),
        ] }) },
  { id: 'bbpo-hurt', at: ['playoffs'], w: 3, when: c => !!c.injury(),
    make: c => { const inj = c.injury(); return { kicker: 'POSTSEASON INJURY REPORT', title: inj.name, body: 'Nobody sits in October. The question is how he plays on it.',
      options: [
        o('straight', 'Play on it, no shortcuts', { attr: Object.fromEntries(Object.entries(inj.hit).map(([t, d]) => [t, Math.round(d / 2) || -1])) }, 'Not right, but nothing gets worse.'),
        o('shot', 'Take the cortisone shot and go', gam(0.6, {}, 'He felt nothing until November.', { attr: inj.hit }, 'It wore off by the third inning.')),
      ] } } },
]
// the trade deadline's targets: the league's real players (the group a Career roster keeps: 'bat' or 'pit')
const arrOf = (m, name) => m?.[name] ?? Object.values(m ?? {}).find(v => Array.isArray(v)) ?? []
const MLB_POOL = [...arrOf(MB, 'MLB_BATTERS').map(p => ({ ...p, group: 'bat' })), ...arrOf(MP, 'MLB_PITCHERS').map(p => ({ ...p, group: 'pit' }))]

// ═════════════════════════════════════════════════════════════════════════════
// IN-GAME: the inning the game turns on. What he does decides it; a miss leaves it to the rest of the game, and the
// lines say who won (nobody on the losing side celebrates)
// ═════════════════════════════════════════════════════════════════════════════
const fin = (my, opp, add, line, tag, good) => ({ good, line, tag, game: { won: my > opp, my, opp, add } })
function batterMoment(c, g) {
  if (!g.app) return null
  const m = g.mySc - g.oppSc, opp = nickOf(g.opponent), home = !!g.home, us = c.nick
  const pa = { pa: 1, ab: 1 }
  // won by one: it was tied late, and his at-bat broke it (at home in the ninth, a walk-off)
  if (m === 1) {
    const tie = g.oppSc, inn = home ? 9 : 8, walk = home
    const hard = odds(c, 0.3, ['power', 'contact', 'clutch']), short = odds(c, 0.36, ['contact', 'avoidK', 'clutch'])
    const win = (o0, line, tag) => ({ p: o0, ...fin(g.mySc, g.oppSc, { ...pa, h: 1, rbi: 1 }, line, tag, true) })
    const missW = p => ({ p, ...fin(g.mySc, g.oppSc, { ...pa }, `He ${walk ? 'flies out to end the ninth' : 'grounds out to end the inning'}. ${us} win it later anyway, ${g.mySc}-${g.oppSc}.`, 'STRANDED', false) })
    const missL = p => ({ p, ...fin(tie, tie + 1, { ...pa, k: 1 }, walk ? `He strikes out with the winning run on. The ${opp} score in the 10th: ${us} lose ${tie}-${tie + 1}.` : `He strikes out with the runner on, and the ${opp} walk it off in the ninth: ${us} lose ${tie}-${tie + 1}.`, 'STRANDED', false) })
    return { id: 'game-bb-late', title: `${walk ? 'Bottom of the 9th' : `${ord(inn)} inning`}, tied ${tie}-${tie}`, body: `${score(tie, tie)} with the ${opp}. Two outs, a runner on second, and ${c.name} at the plate.${walk ? ' A hit wins it.' : ''}`,
      options: [
        { id: 'drive', label: 'Sit on the fastball and drive it', outcomes: [win(hard.p, walk ? `A line drive into the gap. Walk-off: ${us} win ${g.mySc}-${g.oppSc}.` : `A double into the gap. The go-ahead run scores, and ${us} hold on, ${g.mySc}-${g.oppSc}.`, walk ? 'WALK-OFF' : 'GO-AHEAD HIT'), missW((1 - hard.p) * 0.45), missL((1 - hard.p) * 0.55)], sub: sub(hard, walk ? 'the walk-off' : 'the go-ahead run', 'extra innings, or worse') },
        { id: 'short', label: 'Shorten up and put it in play', outcomes: [win(short.p, walk ? `A single through the right side. Walk-off: ${us} win ${g.mySc}-${g.oppSc}.` : `A single up the middle. The go-ahead run scores: ${us} win ${g.mySc}-${g.oppSc}.`, walk ? 'WALK-OFF' : 'GO-AHEAD HIT'), missW((1 - short.p) * 0.45), missL((1 - short.p) * 0.55)], sub: sub(short, walk ? 'the walk-off single' : 'the go-ahead single', 'extra innings, or worse') },
      ] }
  }
  // lost by one: down a run late, the tying run on third
  if (m === -1) {
    const fly = odds(c, 0.5, ['contact', 'power', 'clutch'], 0.04), gap = odds(c, 0.24, ['power', 'gap', 'clutch'])
    const tieP = 0.48
    return { id: 'game-bb-down', title: `8th inning, down ${g.oppSc}-${g.mySc}`, body: `The ${opp} lead by one. Runners on the corners, one out, and ${c.name} up.`,
      options: [
        { id: 'fly', label: 'Get the run in: a fly ball to the outfield', outcomes: [
          { p: fly.p * tieP, ...fin(g.oppSc + 1, g.oppSc, { ...pa, rbi: 1, sf: 1, ab: 0 }, `A sacrifice fly ties it. ${us} win it in the ninth, ${g.oppSc + 1}-${g.oppSc}.`, 'SAC FLY', true) },
          { p: fly.p * (1 - tieP), ...fin(g.oppSc, g.oppSc + 1, { ...pa, rbi: 1, sf: 1, ab: 0 }, `A sacrifice fly ties it, but the ${opp} score again in the ninth. ${us} lose ${g.oppSc}-${g.oppSc + 1}.`, 'SAC FLY', true) },
          { p: 1 - fly.p, ...fin(g.mySc, g.oppSc, { ...pa, k: 1 }, `He strikes out. The runners stay put: ${us} lose ${g.mySc}-${g.oppSc}.`, 'STRANDED', false) }], sub: `${pc(fly.p)}${fly.why ? ` (his ${fly.why})` : ''}: the tying run scores. Then it’s a coin flip.` },
        { id: 'gap', label: 'Look for one to drive into the gap', outcomes: [
          { p: gap.p, ...fin(g.oppSc + 1, g.oppSc, { ...pa, h: 1, d: 1, rbi: 2 }, `A double to the wall. Both runs score: ${us} win ${g.oppSc + 1}-${g.oppSc}.`, 'GO-AHEAD DOUBLE', true) },
          { p: 1 - gap.p, ...fin(g.mySc, g.oppSc, { ...pa, k: 1 }, `He chases a slider in the dirt. ${us} lose ${g.mySc}-${g.oppSc}.`, 'STRUCK OUT', false) }], sub: sub(gap, 'the lead', 'the defeat stands') },
      ] }
  }
  // a blowout: the regular comes out, or he stays in
  if (Math.abs(m) >= 7 && g.won) {
    return { id: 'game-bb-blowout', title: `Up ${g.mySc}-${g.oppSc} in the 7th`, body: `The ${us} are rolling against the ${opp}. The manager wants to get the regulars off their feet.`,
      options: [
        { id: 'stay', label: 'Stay in for another at-bat', effect: { outcomes: [{ p: 0.6, good: true, line: 'One more at-bat, and a single to right.', tag: 'STAYED IN', game: { add: { pa: 1, ab: 1, h: 1 } } }, { p: 0.36, good: true, line: 'One more at-bat, a fly ball to center.', tag: 'STAYED IN', game: { add: { pa: 1, ab: 1 } } }, { p: 0.04, good: false, line: 'He tweaks a hamstring running out a ground ball. Out the next week.', tag: 'HURT LATE', game: { add: { pa: 1, ab: 1 } }, sit: 6, sitTag: 'INJURED' }] }, sub: '60%: another hit tonight. 4% he tweaks something and misses a week.' },
        { id: 'sit', label: 'Take a seat', effect: { outcomes: [{ p: 1, good: true, line: 'A seat in the dugout and fresh legs tomorrow.', tag: 'RESTED', game: { add: {} } }] }, sub: 'Nothing more tonight, no risk.' },
      ] }
  }
  return null
}
function pitcherMoment(c, g) {
  if (!g.app) return null
  const m = g.mySc - g.oppSc, opp = nickOf(g.opponent), us = c.nick
  // a starter through seven without a hit
  if (g.gs && (g.ha ?? 0) === 0 && (g.outs ?? 0) >= 21) {
    const go = odds(c, 0.32, ['stamina', 'composure', 'command'])
    const add = { outs: Math.max(0, 27 - g.outs), w: g.w || !g.won ? 0 : 1 }
    const my = Math.max(g.mySc, 1)
    return { id: 'game-bb-nohit', title: 'Through seven, no hits', body: `${c.name} hasn’t allowed a hit to the ${opp}. 101 pitches, and the bullpen is warm. Nobody in the dugout will sit next to him.`,
      options: [
        { id: 'go', label: 'Stay in and go for it', outcomes: [
          { p: go.p, ...fin(my, Math.min(g.oppSc, my - 1), add, `A no-hitter. ${c.name} gets the last out on a fly ball to center, and the dugout empties.`, 'NO-HITTER', true) },
          { p: (1 - go.p) * 0.93, ...fin(Math.max(my, 2), Math.min(g.oppSc, 1), { outs: Math.max(0, 25 - g.outs), ha: 1 }, `A clean single with one out in the ninth. The crowd stands and applauds him anyway: ${us} win ${Math.max(my, 2)}-${Math.min(g.oppSc, 1)}.`, 'BROKEN UP IN THE 9TH', false) },
          { p: (1 - go.p) * 0.07, ...fin(Math.max(my, 2), Math.min(g.oppSc, 1), { outs: Math.max(0, 23 - g.outs), ha: 1 }, 'The no-hitter goes in the eighth, and his forearm is tight after 118 pitches. He misses a start.', 'ARM FATIGUE', false), sit: 6, sitTag: 'INJURED LIST' }], sub: `${pc(go.p)}${go.why ? ` (his ${go.why})` : ''}: the no-hitter. A small chance the pitch count costs him a start.` },
        { id: 'pen', label: 'Hand it to the bullpen', outcomes: [{ p: 1, good: true, line: `The bullpen takes it from there. ${us} win ${my}-${Math.min(g.oppSc, my - 1)}, and his arm is fresh for his next start.`, tag: 'PULLED AT 101', game: { won: true, my, opp: Math.min(g.oppSc, my - 1), add: { w: g.w ? 0 : 1 } } }], sub: 'The win, a healthy arm, no no-hitter.' },
      ] }
  }
  // a starter's lead late: two on, two out, their best hitter
  if (g.gs && g.won && m >= 1 && m <= 2 && (g.outs ?? 0) >= 18) {
    const heat = odds(c, 0.58, ['velocity', 'movement', 'composure']), spin = odds(c, 0.58, ['breaking', 'changeup', 'pitchIQ']), gb = odds(c, 0.55, ['groundball', 'command', 'movement'])
    const tie = m <= 3
    const keep = (o0, line) => ({ p: o0, ...fin(g.mySc, g.oppSc, { k: 1 }, line, 'ESCAPED THE JAM', true) })
    const blow = p => ({ p, ...fin(g.mySc, g.oppSc + 3, { ha: 1, er: 3, hra: 1, w: g.w ? -1 : 0, l: 1 }, `A three-run homer to left. The lead is gone, and the ${us} lose ${g.mySc}-${g.oppSc + 3}.`, 'GAVE UP THE LEAD', false) })
    void tie
    return { id: 'game-bb-jam', title: `7th inning, up ${g.mySc}-${g.oppSc}`, body: `Two on, two out, and the ${opp}’ cleanup hitter at the plate. The manager leaves ${c.name} in to face him.`,
      options: [
        { id: 'heat', label: 'Challenge him with the fastball up', outcomes: [keep(heat.p, `Ninety-seven at the letters, and he swings through it. Out of the jam: ${us} win ${g.mySc}-${g.oppSc}.`), blow(1 - heat.p)], sub: sub(heat, 'out of the inning, the win', 'the lead is gone') },
        { id: 'spin', label: 'Get him to chase the breaking ball', outcomes: [keep(spin.p, `A slider in the dirt, and he chases it. Strike three: ${us} win ${g.mySc}-${g.oppSc}.`), blow(1 - spin.p)], sub: sub(spin, 'out of the inning, the win', 'the lead is gone') },
        { id: 'gb', label: 'Pound the bottom of the zone for a ground ball', outcomes: [{ p: gb.p, ...fin(g.mySc, g.oppSc, {}, `A two-hopper to short, flip to second. Out of the jam: ${us} win ${g.mySc}-${g.oppSc}.`, 'ESCAPED THE JAM', true) }, blow(1 - gb.p)], sub: sub(gb, 'out of the inning, the win', 'the lead is gone') },
      ] }
  }
  // the ninth: a save
  if (!g.gs && g.won && m >= 1 && m <= 2 && (g.sv || c.closer)) {
    const k = odds(c, 0.7, ['velocity', 'breaking', 'composure'], 0.035), pts = odds(c, 0.68, ['command', 'control', 'composure'], 0.035)
    const save = (p0, line) => ({ p: p0, ...fin(g.mySc, g.oppSc, { sv: g.sv ? 0 : 1, k: 1 }, line, 'THE SAVE', true) })
    const blownW = p => ({ p, ...fin(g.mySc + 1, g.mySc, { ha: 1, er: m, sv: g.sv ? -1 : 0, bs: 1 }, `A two-out double ties it: a blown save. ${us} win it ${g.home ? 'in the bottom of the ninth' : 'in the 10th'}, ${g.mySc + 1}-${g.mySc}.`, 'BLOWN SAVE', false) })
    const blownL = p => ({ p, ...fin(g.mySc, g.mySc + 1, { ha: 2, er: m + 1, sv: g.sv ? -1 : 0, bs: 1, l: 1 }, g.home ? `A walk, then a home run. The ${opp} take the lead, and ${us} lose ${g.mySc}-${g.mySc + 1}.` : `A walk, then a home run. The ${opp} walk it off: ${us} lose ${g.mySc}-${g.mySc + 1}.`, 'BLOWN SAVE', false) })
    return { id: 'game-bb-save', title: `${g.home ? 'Top' : 'Bottom'} of the 9th, up ${g.mySc}-${g.oppSc}`, body: `${c.name} has the ball in a save situation. Two outs, ${m === 1 ? 'the tying run on second' : 'runners on first and second, the tying run on first'}.`,
      options: [
        { id: 'k', label: 'Go for the strikeout', outcomes: [save(k.p, `Strike three on a fastball at the top of the zone. Ballgame: ${us} win ${g.mySc}-${g.oppSc}.`), blownW((1 - k.p) * 0.45), blownL((1 - k.p) * 0.55)], sub: sub(k, 'the save', 'a blown save') },
        { id: 'pts', label: 'Throw strikes, let the defense work', outcomes: [save(pts.p, `A ground ball to second, and that’s the game: ${us} win ${g.mySc}-${g.oppSc}.`), blownW((1 - pts.p) * 0.45), blownL((1 - pts.p) * 0.55)], sub: sub(pts, 'the save', 'a blown save') },
      ] }
  }
  return null
}
function baseballMoment(c, g) {
  if (!g || g.sat) return null
  const card = c.pos === 'pit' ? pitcherMoment(c, g) : batterMoment(c, g)
  if (!card) return null
  return { ...card, kicker: `GAME ${g.g} · ${g.home ? 'VS' : 'AT'} ${String(nickOf(g.opponent)).toUpperCase()}` }
}

registerScenarios('baseball', {
  bank: { all: BB_ALL, bat: [], pit: [], playoffs: BB_PO },
  role: {
    bat: { legs: ['speed', 'baserunning'], feel: ['contact', 'avoidK'], mind: ['eye'], nerve: ['clutch'], power: ['power', 'gap'], make: ['contact', 'gap'] },
    pit: { legs: ['stamina'], feel: ['command', 'control'], mind: ['pitchIQ'], nerve: ['composure'], power: ['velocity', 'movement'], make: ['breaking', 'changeup'] },
  },
  injuries: {
    bat: [
      { name: 'Tight hamstring', hit: { speed: -3, baserunning: -2 }, out: 10, hurt: 18 },
      { name: 'Sore wrist', hit: { contact: -2, power: -3 }, out: 10, hurt: 20 },
      { name: 'Jammed thumb', hit: { contact: -3, gap: -1 }, out: 7, hurt: 15 },
      { name: 'Sore throwing shoulder', hit: { arm: -3, power: -1 }, out: 10, hurt: 18 },
      { name: 'Bruised foot (fouled a ball off it)', hit: { speed: -2, baserunning: -2 }, out: 7, hurt: 12 },
    ],
    pit: [
      { name: 'Elbow soreness', hit: { velocity: -2, breaking: -2 }, out: 15, hurt: 25 },
      { name: 'Shoulder fatigue', hit: { velocity: -3, stamina: -2 }, out: 15, hurt: 25 },
      { name: 'Blister on his pitching hand', hit: { breaking: -3, command: -1 }, out: 10, hurt: 15 },
      { name: 'Tight lower back', hit: { stamina: -2, control: -2 }, out: 10, hurt: 20 },
    ],
  },
  ctx: x => {
    const base = bbContext(x)
    const t = x.team
    // a division rival (the same one all year), whether it's his contract year, a young arm
    const div = MLB_TEAMS.filter(m => m.league === TEAM.get(t?.short)?.league && m.division === TEAM.get(t?.short)?.division && m.short !== t?.short)
    const rival = div.length ? nickOf(div[(t?.short ?? '').length % div.length].short) : null
    return { ...base, rival, contractYear: !!t?.contractYear, young: (t?.age ?? 27) <= 24 }
  },
})
registerMoments('baseball', baseballMoment)
void clamp
