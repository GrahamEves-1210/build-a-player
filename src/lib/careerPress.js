// CAREER: the questions he is asked about the team he plays for.
//
// A beat writer covering the Patriots asks a quarterback about Tom Brady; a guard traded to Golden State is asked
// about Stephen Curry; a striker at Arsenal about Thierry Henry. What each team's writers know is in
// data/team-lore-nfl.js, team-lore-nba.js and team-lore-soccer.js (soccer's loads with the soccer engine and
// registers itself here: registerLore). This file turns it into questions, and deals them where they are true:
//
//   room      a pre-draft meeting (football, basketball) or a meeting with a club's people (soccer): one question
//             from that team's staff, the same shape as lib/career.js INTERVIEWS ({ who, q, a: [{ t, stock, persona }] })
//   drafted   his first press conference after the draft
//   arrive    his first press conference after a trade or a signing
//   champion  media day, the year after he won it all there
//   record    media day, a franchise record in reach, or one he passed last season
//   veteran   media day, years into his time there, a great's number on the wall
//   drought   media day, the face of a team that has waited a long time
//   (in the season: the rivalry line for a LIFE card, the title wait for the playoff card, a record in reach:
//    lifeLore, read by lib/scenarios.js through lib/career.js lifeView)
//
// Nothing here reads a career: lib/career.js hands over a plain view of it (pressView), so the checks can deal every
// team x position x situation (scripts/moments/interview-check.mjs).
//
// What a press answer does (the press conferences on the Career hub; a room's answer moves his draft stock, as the
// generic ones do):
//   humble   reputation +1 (the coaches trust a good name: lib/career.js depthChart)
//   team     his side of the ball plays +0.5 better this season (the locker room heard it)
//   bold     on the record: a big season after it is reputation +1, a poor one −1 (lib/career.js bookSeason)
//   brash    reputation −1
import { NFL_LORE } from '../data/team-lore-nfl'
import { NBA_LORE } from '../data/team-lore-nba'
import { SUPER_BOWLS, OLD_TITLES } from './franchise2/realHistory.js'

const LORE = { nfl: NFL_LORE, bucket: NBA_LORE }
let LEAGUES = {}
export function registerLore(sport, lore, leagues = null) { LORE[sport] = lore; if (leagues) LEAGUES = leagues }
export const loreOf = (sport, short) => LORE[sport]?.[short] ?? null
export const hasLore = sport => !!LORE[sport]

// ── Words ─────────────────────────────────────────────────────────────────────
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
const num = n => NUM[n] ?? String(n)
const fmt = n => Math.round(n).toLocaleString('en-US')
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s)
const poss = w => (/s$/i.test(w) ? `${w}'` : `${w}'s`)
const WORDS = {
  nfl: { room: 'locker room', fans: 'fans', here: 'franchise', kit: 'uniform', field: 'field', game: 'game', title: 'Super Bowl', champs: 'Super Bowl champions' },
  bucket: { room: 'locker room', fans: 'fans', here: 'franchise', kit: 'uniform', field: 'floor', game: 'game', title: 'championship', champs: 'champions' },
  soccer: { room: 'dressing room', fans: 'supporters', here: 'club', kit: 'shirt', field: 'pitch', game: 'match', title: 'league', champs: 'champions' },
}
// the position, one man and several ([one, many])
const POS_WORD = {
  qb: ['quarterback', 'quarterbacks'], rb: ['running back', 'running backs'], wr: ['receiver', 'receivers'], te: ['tight end', 'tight ends'],
  ol: ['offensive lineman', 'offensive linemen'], dl: ['defensive lineman', 'defensive linemen'], lb: ['linebacker', 'linebackers'],
  db: ['defensive back', 'defensive backs'], k: ['kicker', 'kickers'],
  guard: ['guard', 'guards'], wing: ['forward', 'forwards'], big: ['big man', 'big men'], st: ['striker', 'strikers'],
}
// "You play <...> for the same franchise now", "both played <...> for this franchise"
const PLAYS = { qb: 'quarterback', rb: 'running back', wr: 'receiver', te: 'tight end', ol: 'on the offensive line', dl: 'on the defensive line', lb: 'linebacker', db: 'in the secondary', k: 'kicker', guard: 'guard', wing: 'forward', big: 'in the frontcourt', st: 'up front' }
// where he lines up with a teammate at his spot
const ROOM_IN = { ol: 'on', dl: 'on', st: 'in' }
const ROOM_WORD = { wr: 'receiver room', db: 'secondary', dl: 'defensive line', lb: 'linebacker room', ol: 'offensive line', rb: 'backfield', te: 'tight end room', guard: 'backcourt', wing: 'frontcourt', big: 'frontcourt', st: 'forward line' }
// one man plays (a job to win), or several do (a man to play beside)
const ONE_JOB = new Set(['qb', 'rb', 'te', 'k', 'st'])
// the franchise record a position chases: the stat (a season's and a game's key are the same), and how it reads
const REC_OF = {
  qb: { key: 'passYds', unit: 'passing yards', short: 'yards' }, rb: { key: 'rushYds', unit: 'rushing yards', short: 'yards' }, wr: { key: 'recYds', unit: 'receiving yards', short: 'yards' },
  guard: { key: 'pts', unit: 'points', short: 'points' }, big: { key: 'pts', unit: 'points', short: 'points' }, st: { key: 'goals', unit: 'goals', short: 'goals' },
}
export const recordStat = pos => REC_OF[pos] ?? null
// which of a team's lists a man is measured against (basketball: by his spot)
export const loreKey = (sport, pos, spot = null) => (sport === 'bucket' ? (spot === 'SF' ? 'wing' : spot === 'PF' || spot === 'C' ? 'big' : spot === 'PG' || spot === 'SG' ? 'guard' : pos) : pos)
const WHO = {
  nfl: ['Beat writer', 'Columnist', 'National reporter', 'Team reporter', 'Radio host'],
  bucket: ['Beat writer', 'Columnist', 'National reporter', 'Team reporter', 'Radio host'],
  soccer: ['Local reporter', 'National newspaper', 'Club reporter', 'Radio reporter', 'Television reporter'],
}

// ── The titles: how many, the last one, how long it has been ──────────────────
// Football reads the game's own table (lib/franchise2/realHistory.js), by season. Basketball and soccer: the lore's
// years (the year the season ended). mine: the years he won it there himself, on the same count.
const AFL = new Set(['TEN', 'KC', 'LAC', 'BUF'])   // (their titles before the Super Bowl were the AFL's)
export function titleFacts(x) {
  const lore = loreOf(x.sport, x.team), mine = x.titlesHere ?? []
  if (!lore) return null
  let years, old = [], now = x.year
  if (x.sport === 'nfl') { years = SUPER_BOWLS.filter(g => g[1] === x.team).map(g => g[0]); old = OLD_TITLES[x.team] ?? [] }
  else if (x.sport === 'bucket') years = [...(lore.t ?? [])]
  else years = lore.lg?.[0] ? [lore.lg[1]] : []
  const real = x.sport === 'soccer' ? (lore.lg?.[0] ?? 0) : years.length
  // (alsoWon: the years the career saw this team win it without him, soccer's kept league tables)
  const seen = [...new Set([...mine, ...(x.alsoWon ?? [])])]
  const all = [...new Set([...years, ...seen])].sort((a, b) => a - b)
  const n = real + seen.filter(y => !years.includes(y)).length
  const last = all.length ? all[all.length - 1] : null
  const lastOld = old.length ? Math.max(...old) : null
  return { n, last, lastOld, never: !n, wait: last != null ? now - last : lastOld != null ? now - lastOld : null, mineLast: mine.length ? Math.max(...mine) : null, before: years.length ? Math.max(...years) : null }
}
// the wait, as a writer says it (null: no wait worth a question)
function waitLine(x, T = titleFacts(x)) {
  if (!T) return null
  const W = WORDS[x.sport]
  if (x.sport === 'nfl') {
    if (T.never) return T.lastOld != null ? `${x.The} have never won a Super Bowl. Their last championship was the ${T.lastOld} ${AFL.has(x.team) ? 'AFL' : 'NFL'} title.` : `${x.The} have never won a Super Bowl.`
    return T.wait >= 15 ? `${x.The} last won the Super Bowl in the ${T.last} season.` : null
  }
  if (x.sport === 'bucket') return T.never ? `${x.The} have never won a championship.` : T.wait >= 15 ? `${x.The} last won a championship in ${T.last}.` : null
  // (soccer: a club that has been champions more than once and has waited. Nobody asks Brentford's striker when the title is coming)
  return T.n >= 2 && T.wait >= 15 ? `${x.The} last won the ${W.title} in ${T.last}.` : null
}

// ── The view of a team for a man at a position ────────────────────────────────
// x (from lib/career.js pressView, or a check): { sport, team, name, nick, pos, spot, year, roster: [names],
//   star: { name, ovr } | null, ahead, starter, ovr, rep, here, titlesHere, lastHere, how, real, totalsHere,
//   lastYear (his numbers there last season), top (a first-round name), league }
function frame(x0) {
  const lore = loreOf(x0.sport, x0.team)
  if (!lore) return null
  const us = x0.sport !== 'soccer'
  const key = loreKey(x0.sport, x0.pos, x0.spot)
  const roster = new Set(x0.roster ?? []), active = new Set(x0.active ?? [])
  const mine = lore.g?.[key] ?? []
  // (basketball: a guard's list falls back to the wings and the other way round, never to the bigs)
  const near = x0.sport === 'bucket' && !mine.length ? (key === 'guard' ? lore.g?.wing : key === 'wing' ? lore.g?.guard : null) ?? [] : []
  const legs = (mine.length ? mine : near).filter(l => l.name !== x0.player)
  const any = Object.values(lore.g ?? {}).flat().filter(l => l.name !== x0.player)
  const x = {
    ...x0, lore, us, key, W: WORDS[x0.sport], P: POS_WORD[key] ?? POS_WORD[x0.pos] ?? ['player', 'players'],
    the: us ? `the ${x0.nick}` : x0.name, The: us ? `The ${x0.nick}` : x0.name, theirs: us ? `the ${poss(x0.nick)}` : poss(x0.name),
    town: lore.town, on: l => roster.has(l.name),
    past: legs.filter(l => !roster.has(l.name)), now: legs.filter(l => roster.has(l.name)), lead: legs[0]?.name ?? null,
    icons: any.filter(l => !roster.has(l.name)),
    league: LEAGUES[x0.league] ?? null,
    // still playing, somewhere else in the league (nobody has been "measured against him since": he only just left)
    away: l => !roster.has(l.name) && active.has(l.name),
  }
  x.T = titleFacts(x)
  x.wait = waitLine(x, x.T)
  return x
}
// A great the franchise measures a position by (a retired number, a title, an MVP, a record) is asked about as a
// legacy. A good player its fans remember (two Pro Bowls, 167 starts) is asked about as history: nobody asks a
// new tight end whether he can "reach the legacy" of a man who made two Pro Bowls.
const MAJOR = /MVP|Hall of Fame|Player of the Year|Rookie of the Year|record|all-time|Ballon d'Or|Golden (Boot|Shoe)|(scoring|rushing) titles?|championships?|Super Bowls?|titles?\b|led the league|top scorer|Pichichi|European Cup|Champions League|World Cup|\b\d{3} (league |Bundesliga )?goals|2,0\d\d yards|Finals|statue|stadium/i
const major = l => l.icon ?? (!!l.ret || (l.rings ?? 0) >= 1 || MAJOR.test(l.did))
// a man's line: "Tom Brady won six Super Bowls here." (on the roster: what he has done, in the present)
const did = (x, l) => (x.on(l) ? l.on ?? l.did : l.did)
const line = (x, l) => `${l.name} ${did(x, l)}.`

// ── Answers ───────────────────────────────────────────────────────────────────
// h humble · t team · b bold · x brash (the tones above). Three to a question.
const h = t => ({ t, tone: 'humble' }), t = s => ({ t: s, tone: 'team' }), b = s => ({ t: s, tone: 'bold' }), z = s => ({ t: s, tone: 'brash' })
const ANSWERS = {
  legacy: (x, L) => [
    [h(`Nobody replaces ${L}. I have to earn my own place in this ${x.W.room} first.`), b('That\'s the standard here. I came here to chase it.'), z('He had his time. This is mine.')],
    [t(`${L} had good players around him. My job is to help make this team one of those.`), b('If I do my job, people here will be having that conversation in ten years.'), z('Ask me again when I\'ve passed him.')],
    [h(`I know what ${L} means here. I'm not comparing myself to him on my first day.`), t(`One name doesn't win ${x.W.game === 'match' ? 'matches' : 'games'}. This ${x.W.room} does.`), b('I want that pressure. It\'s why you play in a place like this.')],
  ],
  beside: x => [
    [h('Everything. I\'m going to watch how he works and keep my mouth shut.'), t('I want to make his job easier. If he\'s better with me here, we win.'), z('I think he can learn a few things from me too.')],
    [h('He\'s done it all here. I haven\'t done anything here yet.'), b('I came to win with him now, and to be ready when it\'s my turn.'), z('I didn\'t come here to be anybody\'s understudy.')],
  ],
  next: (x, L) => [
    [h(`That's a long way off. Right now I'm trying to earn a place next to ${L}.`), b('That\'s why I\'m here. I want to be the one who carries it on.'), z('I\'m not waiting for anybody to finish. I\'m ready now.')],
    [t(`${L} is still doing it. My job is to help him win another one.`), b('I think about it. You don\'t come to a place like this to be forgotten.'), z('Give it a couple of years. People will be asking him about me.')],
  ],
  fit: x => [
    [t(`Defenses have to pick one of us now. That's good for everybody in this ${x.W.room}.`), h('It\'s his team. I\'ll fit in around him.'), z('There\'s one ball. I plan on having it.')],
    [h('He\'s been doing this at a high level for a long time. I\'ll follow his lead.'), t('We both want the same thing. Who gets the numbers doesn\'t matter.'), b('I think the two of us can be the best pair in the league.')],
  ],
  job: x => [
    [h(`He's earned that job. I'll be ready when the ${x.us ? 'coaches need' : 'manager needs'} me.`), b('I respect what he\'s done here. I\'m going to compete for it every day.'), z('I didn\'t come here to sit behind anybody.')],
  ],
  mark: x => [
    [h('Enough to know I have to earn the right to be part of it.'), b('I know the history. I came here to add to it.'), z('That was a long time ago. I care about what happens next.')],
    [t(`I know the standard. The men in this ${x.W.room} set it now, and I'm one of them.`), h('More than you\'d think. I did my homework before I got here.'), z(`History doesn't win ${x.W.game === 'match' ? 'matches' : 'games'}. Players do.`)],
  ],
  number: x => [
    [h('It tells me what this place expects. I have a long way to go before anyone talks about mine.'), b('I think about what it takes to get one up there. That\'s the goal.'), z('Mine will look good next to it.')],
  ],
  lastBad: x => [
    [t('One player doesn\'t turn a team around by himself. I\'m here to be one of the reasons.'), b('I expect to win here, and I expect it to start this year.'), z('I can\'t speak for last year. I wasn\'t here.')],
  ],
  lastGood: x => [
    [h('A team that wins has things to teach me. I\'ll earn whatever I get.'), b('I can help a good team right away.'), z(`They won't be able to keep me off the ${x.W.field}.`)],
  ],
  newWait: x => [
    [h('You feel it the first day. I haven\'t earned the right to promise anything yet.'), b('I feel it, and I like it. I want to be here when it ends.'), z('I wasn\'t here for any of that. It isn\'t my drought.')],
  ],
  wait: x => [
    [t(`We have the people to do it. Nobody in this ${x.W.room} is carrying the past around.`), b('Yes. I wouldn\'t be here if I didn\'t believe that.'), z('I wasn\'t here for most of that. It isn\'t my drought.')],
    [h(`That history belongs to the ${x.W.fans}. Our job is the next ${x.W.game}.`), b('I want to be the one who\'s here when it ends. That\'s the plan.'), t(`It ends when this whole ${x.W.room} is good enough. That's what we work on every day.`)],
  ],
  ache: x => [
    [h(`The ${x.W.fans} have earned the right to bring it up. All we can do is give them something new to talk about.`), t(`Nobody in this ${x.W.room} was part of that. We have our own work to do.`), z('I\'m tired of hearing about it, honestly.')],
  ],
  repeat: x => [
    [h(`The ${x.us ? 'banner' : 'trophy'} is ${x.us ? 'up' : 'in the cabinet'}. We start at zero like everybody else.`), b('We\'re the champions until somebody beats us. I expect to do it again.'), z('We\'re better than everybody. I don\'t see who stops us.')],
    [t('Ask the men who did the work nobody saw last year. They\'re why it happened, and they\'re all back at it.'), h('Last year is over. Nobody is handing us anything.'), b(`One isn't enough. Not for me, and not for this ${x.W.room}.`)],
  ],
  dynasty: x => [
    [h('No. That\'s a word for when it\'s over.'), b('Not yet. Ask me after the next one.'), z('Yes. I don\'t see who\'s stopping it.')],
  ],
  catchUp: x => [
    [h('He did that over a whole career. I\'m trying to win the next one.'), b('Yes. That\'s the number I\'m chasing.'), z('I\'ll pass him. It\'s a matter of time.')],
  ],
  firstTitle: x => [
    [h('People stop me to say thank you. I tell them the team did it.'), t(`It belongs to everybody who waited. This ${x.W.room} just finished the job.`), b('It\'s been everything I hoped. I want them to feel it again.')],
  ],
  ownNumber: x => [
    [h('That\'s for other people to decide when I\'m done.'), b('I\'d be lying if I said I didn\'t want it. I have work left to do.'), t('I want another title before anybody talks about my number.')],
  ],
  list: x => [
    [h('On it would be enough. The men on that list earned it over a long time.'), b('At the top. I\'ve never said that out loud before.'), z('I think I\'m already ahead of most of them.')],
  ],
  record: (x, H) => [
    [t('I\'ll take the record if it comes with wins. That\'s the only way I want it.'), b('I know exactly how far away it is. I want it.'), h(`${H} did that over a career. I'm just trying to stack good weeks.`)],
    [h(`It would be an honor to be next to ${H} in the book. It isn't why I play.`), b('Yes. I think about it, and I\'m going to get it.'), z('Records fall. This one is going to.')],
  ],
  passed: (x, H) => [
    [h(`It meant a lot. ${H} set that mark, and I know what it took.`), t(`It meant the people around me did their jobs for a long time. It's their record too.`), b('It meant something. I\'m not done adding to it.')],
  ],
  remember: x => [
    [h('That I showed up every day and was a good teammate.'), b('That I was the best to ever do it here.'), t('That we won while I was here. The rest takes care of itself.')],
    [h('That I earned it. Nothing more than that.'), b('That nobody here did it better.'), z('They\'ll have plenty to say. I\'m not worried about that.')],
  ],
  league: x => [
    [h('It will be harder. I\'ll have to earn every one of them.'), b('I\'ve scored everywhere I\'ve played. I expect to score here.'), z('Defenders are defenders. I score against all of them.')],
  ],
}
// a room's answers: the answer's stock and the persona it reads as (grinder, confident, cocky), as INTERVIEWS has them
const g = (t, stock) => ({ t, stock, persona: 'grinder' }), c = (t, stock) => ({ t, stock, persona: 'confident' }), k = (t, stock) => ({ t, stock, persona: 'cocky' })
const ROOM_ANSWERS = {
  legacy: x => [g('I can\'t promise you that. I can promise nobody in your building will outwork me.', 2), c('That\'s the reason to play: to end up in that conversation.', 1), k('Give me five years. You\'ll be asking him about me.', -1)],
  wait: x => [c('Tell them help is coming. I want to be on the team that ends it.', 2), g('That I haven\'t earned the right to promise them anything yet.', 1), k(`To buy a ${x.us ? 'jersey' : 'shirt'} with my name on it.`, -1)],
  mark: x => [g('I\'ve studied it. I want to earn a place in it.', 2), c('It means there\'s a standard here. I like that.', 1), k(`History doesn't win ${x.us ? 'games' : 'matches'}. I do.`, -2)],
  star: x => (x.sport === 'soccer'
    ? [g('Whatever it takes. I\'ll earn my chance in training.', 1), c('I\'ll push him every day until the manager has to pick me.', 2), k('I didn\'t come here to sit on the bench.', -1)]
    : [g(x.sport === 'bucket' ? 'Whatever the team needs. I\'ll earn the minutes.' : 'Whatever helps the team. I\'ll be ready when you need me.', 1), c('I\'ll compete for the job from the first practice.', 2), k(x.sport === 'bucket' ? 'I didn\'t come here to sit.' : 'I didn\'t come here to hold a clipboard.', -1)]),
  beside: x => [g('I\'d learn more from him in a month than I did in three years of school.', 2), c('I can help him win right now.', 1), k('He\'d be lucky to have me.', -1)],
  bad: x => [g('Somebody has to turn it around. I want to be the reason.', 2), c('You\'re a couple of players away. I\'m one of them.', 1), k('Honestly, I\'d rather go to a winner.', -2)],
  good: x => [g(`A team that wins has things to teach me. I'll earn my ${x.sport === 'bucket' ? 'minutes' : 'snaps'}.`, 2), c('I can help a good team right away.', 1), k(`You won't be able to keep me off the ${x.W.field}.`, -1)],
  rival: x => [g('I know it matters more here than the others. I\'ll learn the rest from the men who\'ve played in it.', 2), c('I know I want to be the reason you win it.', 1), k(x.us ? 'It\'s a game like any other.' : 'It\'s three points, the same as any other.', -1)],
  league: x => [g('I\'m not ready yet. Put me in training with them every day and I will be.', 2), c('I\'ve scored at every level I\'ve played. This is the next one.', 1), k('Defenders are defenders. I score against all of them.', -1)],
}
const ROOM_WHO = {
  nfl: { gm: 'General manager', coach: 'Head coach', owner: 'Owner' },
  bucket: { gm: 'General manager', coach: 'Head coach', owner: 'Owner' },
  soccer: { gm: 'Sporting director', coach: 'First-team manager', owner: 'Sporting director', club: 'Academy director' },
}

// ── The questions ─────────────────────────────────────────────────────────────
// A candidate: { id, kind, w (how often it is picked), q, names (every man it names), set (its answers), arg }
// (a name that ends in a period, at the end of a sentence: one period)
const tidy = s => String(s).replace(/\b(Jr|Sr)\.\./g, '$1.')
const tidyAll = list => list.map(a => ({ ...a, t: tidy(a.t) }))
const Q = (id, kind, w, q, names, set, arg = null) => ({ id, kind, w, q: tidy(q), names: names.filter(Boolean), set, arg })
const howWord = x => (!x.us ? 'you signed' : x.how === 'draft' ? 'the draft' : x.how === 'trade' ? 'the trade' : 'you signed')

// the men who played his position here, and he is new: the legacy questions
const fansOf = x => (x.us ? `${x.nick} fans` : `${x.name} ${x.W.fans}`)
function legacyQs(x, { draft = false } = {}) {
  const out = []
  const P = x.P[0], lg = x.sport === 'soccer', plays = PLAYS[x.key] ?? P
  for (const l of x.past) {
    const first = l.name === x.lead   // (a team's lists lead with the man the position is measured by: he is asked about most)
    out.push(Q(`knew|${l.name}`, 'legacy', first || !major(l) ? 2 : 1.5, `${line(x, l)} You play ${plays} for the same ${x.W.here} now. How much of that history did you know before ${howWord(x)}?`, [l.name], 'mark'))
    if (!major(l)) { if (!x.away(l)) out.push(Q(`talk|${l.name}`, 'legacy', 2, `${line(x, l)} ${cap(fansOf(x))} still talk about him. What would you like them to say about you when you are done?`, [l.name], 'remember')); continue }
    out.push(Q(`reach|${l.name}`, 'legacy', first ? 10 : 1.5, `${line(x, l)} Do you think you can reach that legacy ${lg ? 'at this club' : 'here'}?`, [l.name], 'legacy', l.name))
    if (!x.away(l)) out.push(Q(`measure|${l.name}`, 'legacy', first ? 5 : 1.5, lg ? `${line(x, l)} Every ${P} who has worn this shirt since has been compared with him. Is that fair on a new signing?` : `${line(x, l)} Every ${P} who has played here since has been measured against him. Is that fair to you?`, [l.name], 'legacy', l.name))
    if (l.ret && l.n != null && x.us) out.push(Q(`number|${l.name}`, 'legacy', 2, x.sport === 'bucket' ? `${x.The} hung No. ${l.n} in the rafters for ${l.name}. What goes through your mind when you look up at it?` : `${x.The} retired No. ${l.n} for ${l.name}. What goes through your mind when you see it?`, [l.name], 'number'))
    if (draft && l.dr && x.us) out.push(Q(`drafted|${l.name}`, 'legacy', 3, `${x.The} drafted ${l.name} ${l.dr}, and he ${l.did}. Now they have drafted you. What does that history ask of a rookie?`, [l.name], 'legacy', l.name))
  }
  if (x.past.length >= 2) {
    const [a, b2] = x.past
    out.push(Q(`company|${a.name}|${b2.name}`, 'legacy', 2, lg ? `${a.name} and ${b2.name} both led the line here. That is the company you are in now. Are you ready for the comparison?` : `${a.name} and ${b2.name} both played ${plays} for this franchise. That is the company you are in now. Are you ready for the comparison?`, [a.name, b2.name], 'legacy', a.name))
  }
  return out
}
// a great at his position who is still on the roster
function besideQs(x) {
  const out = []
  for (const l of x.now) {
    out.push(Q(`learn|${l.name}`, 'beside', 3, `${l.name} ${did(x, l)}, and he is still in this ${x.W.room}. What do you want to learn from him?`, [l.name], 'beside'))
    out.push(Q(`after|${l.name}`, 'beside', l.name === x.lead ? 10 : 4, `${line(x, l)} One day this ${x.W.here} will need the ${x.P[0]} who comes after him. Do you think you can reach that legacy?`, [l.name], 'next', l.name))
    if (!ONE_JOB.has(x.pos)) out.push(Q(`pair|${l.name}`, 'beside', 2, `${line(x, l)} How do the two of you fit ${ROOM_IN[x.key] ?? 'in'} the same ${ROOM_WORD[x.key] ?? 'lineup'}?`, [l.name], 'fit'))
    else if (!x.starter) out.push(Q(`behind|${l.name}`, 'beside', 2, `${line(x, l)} You play the same position. Are you here to learn from him or to take his job?`, [l.name], 'job'))
  }
  return out
}
// the best man at his spot on the roster (when the lore has nothing to say about him)
function starQs(x) {
  const s = x.star
  if (!s || x.now.some(l => l.name === s.name)) return []
  if (ONE_JOB.has(x.pos)) return x.ahead ? [Q(`job|${s.name}`, 'star', 2, `${s.name} is the ${x.sport === 'soccer' ? 'first-choice striker' : `starter at ${x.P[0]}`} here. Are you here to learn behind him or to take the job?`, [s.name], 'job')] : []
  return [Q(`fit|${s.name}`, 'star', 2, `You are joining a ${ROOM_WORD[x.key] ?? 'lineup'} that already has ${s.name}. How do the two of you fit?`, [s.name], 'fit')]
}
function markQs(x, { faced = false } = {}) {
  const out = []
  if (x.lore.mark) {
    out.push(Q('mark', 'mark', 2, `${x.lore.mark} What did you know about this ${x.W.here} before ${howWord(x)}?`, [], 'mark'))
    if (faced) out.push(Q('faced', 'mark', 1, x.us ? `${x.lore.mark} You have played against this team. What changes when you put on the ${x.W.kit}?` : `${x.lore.mark} You have played against this club. What changes when you pull on the ${x.W.kit}?`, [], 'mark'))
  }
  return out
}
// no great at his position here: the franchise's own names
function iconQs(x) {
  return x.icons.slice(0, 3).map(l => Q(`icon|${l.name}`, 'icon', 2, `This is the ${x.W.here} of ${l.name}, who ${l.did}. What does it mean to wear the same ${x.W.kit}?`, [l.name], 'mark'))
}
// soccer, a club with no great striker to be measured against: the league's questions
function leagueQs(x) {
  const lg = x.league
  if (!lg) return []
  return [
    Q('lg-step', 'league', 2, `This is ${lg.name}. Plenty of strikers who scored freely somewhere else have found it harder here. Why will it be different for you?`, [], 'league'),
    Q('lg-boot', 'league', 1, `${lg.greats} ${cap(lg.boot)} has usually gone to a striker at one of the biggest clubs. Can ${poss(x.name)} striker win it?`, [], 'league'),
  ]
}
function lastQs(x) {
  const r = x.real
  if (!r) return []
  if (r.w <= 6) return [Q('last-bad', 'last', 2, `${x.The} went ${r.rec} last season. What does a rookie change about that?`, [], 'lastBad')]
  if (r.w >= 11) return [Q('last-good', 'last', 2, `${x.The} went ${r.rec} last season. Where does a rookie fit on a team that is already winning?`, [], 'lastGood')]
  return []
}

// ── The press conferences (the Career hub, before the season) ────────────────
function pressCandidates(x, sit) {
  const P = x.P, W = x.W
  if (sit === 'drafted' || sit === 'arrive') {
    const draft = sit === 'drafted'
    const out = [...besideQs(x), ...starQs(x), ...markQs(x, { faced: !draft && x.proYears > 0 }), ...(draft ? lastQs(x) : [])]
    if (x.top) out.push(...legacyQs(x, { draft }))
    if (x.top && !x.past.length && !x.now.length) out.push(...iconQs(x))
    if (!x.us && !x.past.length && !x.now.length) out.push(...leagueQs(x))
    if (x.wait) out.push(Q('new-wait', 'wait', 1.5, `${x.wait} Does a new ${x.us ? 'player' : 'signing'} feel that when he walks in the door?`, [], 'newWait'))
    return out
  }
  if (sit === 'champion') {
    const T = x.T, mine = (x.titlesHere ?? []).length, what = x.sport === 'nfl' ? 'Super Bowl title' : x.us ? 'championship' : `${W.title} title`
    const out = [
      Q('repeat', 'champion', 3, x.us ? `${x.The} are the defending champions. How do you get a team that just won it all to do the work again?` : `${x.The} are champions. How do you get a squad that has just won the ${W.title} to do it again?`, [], 'repeat'),
      Q('target', 'champion', 2, x.us ? `Every team in the league spent the offseason building to beat ${x.the}. What does that change for you?` : `Every club in the league has spent the summer trying to close the gap on ${x.name}. What does that change for you?`, [], 'repeat'),
    ]
    // his first one there: the first in the team's history, or the first in a long time
    if (mine === 1 && T && (T.before == null || T.mineLast - T.before >= 10)) out.push(Q('first-title', 'champion', 4, `${T.before == null ? (x.us ? `That was the first ${what} in ${x.nick} history.` : `That was ${poss(x.name)} first ${what}.`) : `That was ${x.theirs} first ${what} since ${T.before}.`} What has ${x.us ? 'the city' : x.town} been like since?`, [], 'firstTitle'))
    if (mine >= 2 && x.here <= mine * 3) out.push(Q('dynasty', 'champion', 3, `That is ${num(mine)} ${what}s in ${num(x.here)} seasons here. People are starting to use the word dynasty. Do you?`, [], 'dynasty'))
    // a great of this team with more of them than he has (his own position first)
    for (const l of [...x.past.filter(l => (l.rings ?? 0) >= 2), ...[...x.icons].sort((a, b2) => (b2.rings ?? 0) - (a.rings ?? 0)).filter(l => (l.rings ?? 0) >= 3)].filter(l => l.rings > mine).slice(0, 1)) out.push(Q(`catch|${l.name}`, 'champion', 2, `${l.name} won ${num(l.rings)} ${x.sport === 'nfl' ? 'championships' : 'titles'} with this ${x.W.here}. You have ${num(mine)}. Do you think about catching him?`, [l.name], 'catchUp'))
    return out
  }
  if (sit === 'record') {
    const R = x.chase
    if (!R) return []
    if (R.passed) return [Q(`passed|${R.holder}`, 'record', 3, `You passed ${R.holder} last season for the most ${R.unit} in ${x.us ? 'franchise' : 'club'} history. What did that mean to you?`, [R.holder], 'passed', R.holder)]
    return [Q(`chase|${R.holder}`, 'record', 3, `You are ${fmt(R.gap)} ${R.short} away from ${poss(R.holder)} ${x.us ? 'franchise' : 'club'} record of ${fmt(R.value)}. Do you let yourself think about it?`, [R.holder], 'record', R.holder)]
  }
  if (sit === 'veteran') {
    const out = []
    for (const l of x.past) {
      if (!major(l)) { if (!x.away(l)) out.push(Q(`recall|${l.name}`, 'veteran', 1, `${cap(fansOf(x))} still talk about ${l.name}, who ${l.did}. You have been here ${num(x.here)} seasons. How do you want to be remembered here?`, [l.name], 'remember')); continue }
      if (l.ret && l.n != null && x.us) out.push(Q(`own-number|${l.name}`, 'veteran', 3, `${x.sport === 'bucket' ? `${x.The} hung No. ${l.n} in the rafters for ${l.name}.` : `${x.The} retired No. ${l.n} for ${l.name}.`} You have played ${num(x.here)} seasons here. Do you think about your own number going up one day?`, [l.name], 'ownNumber'))
      out.push(Q(`list|${l.name}`, 'veteran', 2, `When ${fansOf(x)} name the great ${P[1]}, they start with ${l.name}. You have been here ${num(x.here)} seasons. Where do you want your name on that list?`, [l.name], 'list'))
    }
    return out
  }
  if (sit === 'drought') {
    if (!x.wait) return []
    const out = [Q('wait', 'wait', 3, `${x.wait} You are the face of this ${x.us ? 'team' : 'club'} now. Is this the ${x.us ? 'group' : 'squad'} that ends it?`, [], 'wait')]
    if (x.lore.ache) out.push(Q('ache', 'wait', 2, `${x.lore.ache} ${cap(fansOf(x))} still bring it up. Does that history sit in this ${W.room}, or only outside it?`, [], 'ache'))
    return out
  }
  return []
}
// which situations a preseason can be about, most pressing first: [sit, the chance it comes up]
// first: his first camp with this team. A situation only where it is true (a record needs a man near it, a number on
// the wall a man who has been there for years, the title wait a man the team is built around).
export function pressSituations(x0) {
  const x = frame(x0)
  if (!x) return []
  if (x.first) return [[x.how === 'draft' ? 'drafted' : 'arrive', 1]]
  const out = []
  const face = x.starter && (x.ovr >= 84 || x.rep >= 7)
  if (x.lastHere?.champion) out.push(['champion', 1])
  if (x.chase && face) out.push(['record', 1])
  if (x.here >= 6 && face && x.ovr >= 86 && x.past.length) out.push(['veteran', 0.4])
  if (face && x.here >= 1 && x.wait) out.push(['drought', 0.4])
  return out
}
// One press question for this preseason, or null. r: a seeded roll; seen: the ids he has already been asked.
export function pressQuestion(x0, r, seen = []) {
  const x = frame(x0)
  if (!x) return null
  for (const [sit, p] of pressSituations(x0)) {
    if (r() >= p) continue
    // (a record, a number on the wall, the title wait: each question once. Asked every August, it stops being a question)
    const list = ONCE.has(sit) ? pressCandidates(x, sit).filter(q => !seen.includes(q.id)) : pressCandidates(x, sit)
    const q = pick(x, list, r, seen)
    if (q) return finish(x, q, sit, r)
  }
  return null
}
const ONCE = new Set(['record', 'veteran', 'drought'])
const KICKER = { drafted: 'INTRODUCTORY PRESS CONFERENCE', arrive: 'INTRODUCTORY PRESS CONFERENCE', champion: 'MEDIA DAY', record: 'MEDIA DAY', veteran: 'MEDIA DAY', drought: 'MEDIA DAY' }
// (a question that names a man on the roster as if he were gone never gets this far: the lists are split on the
// roster, x.past and x.now. This is the last check: every name a legacy or a record question carries is off it.)
const sound = (x, q) => q.kind === 'beside' || q.kind === 'star' || q.names.every(n => !x.roster?.includes(n)) || q.kind === 'record'
function pick(x, list, r, seen = []) {
  const ok = list.filter(q => sound(x, q))
  if (!ok.length) return null
  const fresh = ok.filter(q => !seen.includes(q.id))
  const pool = fresh.length ? fresh : ok
  const tot = pool.reduce((s, q) => s + q.w, 0)
  let roll = r() * tot
  for (const q of pool) { roll -= q.w; if (roll <= 0) return q }
  return pool[pool.length - 1]
}
function finish(x, q, sit, r) {
  const sets = ANSWERS[q.set](x, q.arg)
  const a = tidyAll(sets[Math.floor(r() * sets.length)]).map(o => ({ o, k: r() })).sort((p, q2) => p.k - q2.k).map(p => p.o)
  const who = WHO[x.sport][Math.floor(r() * WHO[x.sport].length)]
  return { id: q.id, sit, kind: q.kind, kicker: KICKER[sit] ?? 'PRESS CONFERENCE', who, q: q.q, a, names: q.names }
}
// what an answer's tone does (lib/career.js answerPress applies it; the hub says it)
export const PRESS_TONES = {
  humble: { rep: 1, tag: 'REPUTATION UP', line: 'The room liked that. So did the coaches.' },
  team: { side: 0.5, tag: 'THE LOCKER ROOM HEARD IT', line: 'His teammates read it the next morning.' },
  bold: { vow: true, tag: 'ON THE RECORD', line: 'The quote is everywhere. A big season backs it up; a poor one, and people remember it.' },
  brash: { rep: -1, tag: 'REPUTATION DOWN', line: 'That one is going to follow him around.' },
}

// ── A room: the team's own question in a pre-draft meeting ────────────────────
// Returns an INTERVIEWS-shaped question ({ who, q, a }) with its kind, or null (the generic bank is the fallback).
// used: the kinds the other rooms already asked (four rooms, four different questions).
function roomCandidates(x) {
  const who = ROOM_WHO[x.sport], out = [], add = (who2, q) => out.push({ ...q, who: who2 })
  const s = x.star
  // the man at his position there now
  if (s && ONE_JOB.has(x.pos) && x.ahead) add(who.gm, Q(`room-star|${s.name}`, 'star', 3, x.sport === 'soccer' ? `${s.name} is our first-choice striker. A year behind him, learning: happy with that?` : `We have ${s.name} at ${x.P[0]}. A year ${x.sport === 'bucket' ? 'coming off the bench' : 'of sitting'} behind him: is that a problem?`, [s.name], 'star'))
  if (s && !ONE_JOB.has(x.pos)) add(who.coach, Q(`room-beside|${s.name}`, 'star', 2, `You would line up ${ROOM_IN[x.key] ?? 'in'} the same ${ROOM_WORD[x.key] ?? 'lineup'} as ${s.name}. What does he get from having you next to him?`, [s.name], 'beside'))
  // last season, as it really went (football, a career's first draft)
  if (x.real?.w <= 6) add(who.coach, Q('room-bad', 'last', 3, `We went ${x.real.rec} last year. Why would you want to come here?`, [], 'bad'))
  if (x.real?.w >= 11) add(who.coach, Q('room-good', 'last', 2, `We went ${x.real.rec} last year. Where does a rookie fit on this team?`, [], 'good'))
  // the standard at his position (a first-round name is asked; a late pick is not)
  if (x.top) for (const l of x.past.filter(major).slice(0, 2)) add(who.gm, Q(`room-legacy|${l.name}`, 'legacy', 3, `The standard ${x.us ? 'at your position' : 'for a striker'} here is ${l.name}. He ${l.did}. Why should we believe you belong in that conversation one day?`, [l.name], 'legacy'))
  if (x.wait) add(who.owner, Q('room-wait', 'wait', 2, `${x.wait} Our ${x.W.fans} have waited a long time. What do you tell them?`, [], 'wait'))
  if (x.lore.mark) add(who.club ?? who.owner, Q('room-mark', 'mark', 2, `${x.lore.mark} What does this ${x.W.here} mean to you?`, [], 'mark'))
  const rv = Object.entries(x.lore.rivals ?? {})
  for (const [, text] of rv.slice(0, 1)) add(who.coach, Q('room-rival', 'rival', 1.5, `${text} What do you know about that ${x.us ? 'rivalry' : 'match'}?`, [], 'rival'))
  if (!x.us && x.league && !x.past.length) add(who.coach, Q('room-league', 'league', 2, `This is ${x.league.name}. Defenders here are quicker and stronger than anything in youth football. What makes you think you are ready?`, [], 'league'))
  return out
}
export function roomQuestion(x0, r, used = []) {
  const x = frame(x0)
  if (!x) return null
  const list = roomCandidates(x).filter(q => sound(x, q) && !used.includes(q.kind))
  if (!list.length) return null
  const tot = list.reduce((s, q) => s + q.w, 0)
  let roll = r() * tot, q = list[list.length - 1]
  for (const y of list) { roll -= y.w; if (roll <= 0) { q = y; break } }
  return { who: q.who, q: q.q, a: tidyAll(ROOM_ANSWERS[q.set](x)), kind: q.kind, id: q.id, lore: true }
}

// ── In the season: what the LIFE cards read (lib/scenarios.js, through lib/career.js lifeView) ──
//   rival(short)  the rivalry's line when the next opponent is one of the team's rivals, or null
//   wait          the title wait, for the card before the playoffs (null: no wait worth a card)
//   ache          the loss the fans bring up
//   chase         { holder, value, key, unit, short, before }: a franchise record he can reach this season
export function lifeLore(x0) {
  const x = frame(x0)
  if (!x) return null
  return { rival: short => x.lore.rivals?.[short] ?? null, wait: x.wait, ache: x.lore.ache ?? null, chase: x.chase && !x.chase.passed ? x.chase : null, town: x.town }
}
// The franchise record at his position and where he stands against it. totals: his career numbers for this team
// before this season; last: his numbers there last season. roster: the names on the team (a holder still playing
// there is nobody's record to ask about yet).
//   { holder, value, key, unit, short, before, gap, passed }  passed: he went by it last season
// null: no record kept for the position or the team, the holder is on the roster, or it is out of reach this year.
export function recordChase({ sport, team, pos, totals = {}, last = null, roster = [] }) {
  const R = REC_OF[pos], rec = R ? loreOf(sport, team)?.rec?.[R.key] : null
  if (!rec) return null
  const [holder, value] = rec
  if (roster.includes(holder)) return null
  const before = totals[R.key] ?? 0, lastN = last?.[R.key] ?? 0
  const base = { holder, value, key: R.key, unit: R.unit, short: R.short, before }
  if (before > value) return before - lastN <= value && lastN > 0 ? { ...base, gap: 0, passed: true } : null
  const gap = value - before
  // in reach: about a season and a quarter of what he did there last year
  return lastN > 0 && gap <= lastN * 1.25 ? { ...base, gap, passed: false } : null
}

// ── For the checks: every question a team can ask a man, by situation ─────────
export function everyQuestion(x0) {
  const x = frame(x0)
  if (!x) return null
  const full = (q, sit) => ({ id: q.id, sit, kind: q.kind, q: q.q, names: q.names, sound: sound(x, q), answers: (sit === 'room' ? [ROOM_ANSWERS[q.set](x)] : ANSWERS[q.set](x, q.arg)).map(tidyAll), who: q.who ?? null })
  const out = { room: roomCandidates(x).map(q => full(q, 'room')) }
  for (const sit of ['drafted', 'arrive', 'champion', 'record', 'veteran', 'drought']) out[sit] = pressCandidates({ ...x, how: sit === 'drafted' ? 'draft' : x.how ?? 'trade' }, sit).map(q => full(q, sit))
  return out
}
