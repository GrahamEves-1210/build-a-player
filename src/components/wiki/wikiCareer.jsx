import { Link, useMod, Loading, andList, word, Word, grade, n0, pct, third } from './wikiBits'
import { BOOSTS } from '../../lib/progress'
import { SOCCER_LIVE } from '../../lib/soccerLive'
import { CFB_LIVE } from '../../lib/cfbLive'
import { CBB_LIVE } from '../../lib/cbbLive'
import { K_LIVE } from '../../lib/kLive'
import { OL_LIVE } from '../../lib/olLive'
import { LB_LIVE } from '../../lib/lbLive'

// Career: every number here is read from lib/career.js (loaded with this page), the module the mode runs on.
const loadCareer = () => import('../../lib/career')
const POS_WORD = { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', db: 'DB', dl: 'DL', lb: 'LB', ol: 'OL', k: 'K' }

export function CareerPage({ go }) {
  const C = useMod('career', loadCareer)
  if (!C) return <Loading />
  const nfl = C.SPORT.nfl, nba = C.SPORT.bucket
  const fbPos = nfl.positions.map(p => POS_WORD[p] ?? p.toUpperCase())
  const age = (sport, pos, extra = {}) => C.retireAge({ sport, pos, ovr: 80, durability: 5, ...extra })
  const retireRows = nfl.positions.map(p => [POS_WORD[p], age('nfl', p), p === 'k' ? age('nfl', p, { ovr: 90 }) : age('nfl', p, { ovr: 92, durability: 8 })])
  const awards = C.AWARD_STEPS
  return (
    <>
      <p className="wk-lead"><b>Career</b> follows one player from the start of his career to retirement: football ({andList(fbPos)}), basketball (PG, SG, SF, PF or C){SOCCER_LIVE ? ', or soccer (a striker)' : ''}. The player names him, draws his face and makes every call. Each sport has {word(C.CAREER_SLOTS)} save slots, and a career runs at most {C.MAX_SEASONS} seasons{K_LIVE ? ` (a kicker's ${C.maxSeasons({ pos: 'k' })})` : ''}, starting in 2026.</p>

      <h2 id="start">Starting a career</h2>
      <ul>
        <li><b>The build.</b> A normal spin-and-pick build at the chosen position becomes his starting ratings. A basketball career is locked to the spot picked (PG, SG, SF, PF or C) on every team.</li>
        <li><b>Name and face.</b> On the name step the player makes his face in the creator: skin tone, face shape and expression, eyes and brows, nose and mouth, hair, beard and moustache, and gear such as eye black, earrings and a chain. It is never a real player's photo. Tap his face on the career screen to change it later. He wears his team's colours under it.</li>
        <li><b>Mini games.</b> {andList(C.GAMES_MODES.map(([, l]) => l.charAt(0) + l.slice(1).toLowerCase()))}: Advanced plays the full-screen mini games, Simple the classic quick ones, and None decides them from his grades. It can be changed any time on the career screen.</li>
        {(CFB_LIVE || CBB_LIVE) && <li><b>Enter the draft or start in college.</b> A new career can start at the combine or in college ({andList([...(CFB_LIVE ? ['football QBs, RBs and WRs'] : []), ...(CBB_LIVE ? ['basketball guards and bigs'] : [])])}). See <Link go={go} to="college" hash="start-in-college">College § Start in College</Link>.</li>}
      </ul>

      <h2 id="draft">The combine and the draft</h2>
      <ul>
        <li><b>The combine.</b> Drills played as mini games, matched to the position (table below). Each drill gets one redo and the better run counts, and the combine can be skipped. A <b>pro comparison</b>, the real player whose grades sit closest, shows before the first drill.</li>
        <li><b>How much it moves him.</b> A combine barely moves a top pick, since the tape already decided it, but it can be worth a round to a mid-round pick. In football the first two picks are a quarterback's; anyone else goes third at best (second for a 95+).</li>
        <li><b>Interviews.</b> Four teams near his projected spot ask questions. In football a good answer moves him up about two picks.</li>
        <li><b>Draft day.</b> {Word(nfl.draft.rounds)} rounds in football, {word(nba.draft.rounds)} in basketball. Team needs and the interviews decide where he goes, and the pick sets his rookie deal. A player nobody takes signs as an undrafted free agent.</li>
      </ul>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Position</th><th>Combine drills</th></tr></thead>
          <tbody>
            {[...nfl.positions.map(p => [POS_WORD[p], nfl.combine[p]]), ['Guard', nba.combine.guard], ['Big', nba.combine.big]].map(([p, d]) => d && <tr key={p}><td>{p}</td><td>{d.map(x => x[1]).join(', ')}</td></tr>)}
          </tbody>
        </table>
      </div>

      <h2 id="seasons">Seasons</h2>
      <ul>
        <li><b>Week by week.</b> Football moves {word(nfl.step)} week at a time, basketball {word(nba.step)} games at a time, on the same engines as <Link go={go} to="seasons">Seasons</Link>, with his own team around him.</li>
        <li><b>The depth chart.</b> If he isn't the best at his spot he starts as a backup. In football he waits for the job; in basketball he comes off the bench in a smaller role. A coach can ask a basketball player to move one spot (a PG to SG, say).</li>
        <li><b>Goals.</b> Three goals a season, sized to his overall and his role. Meeting {word(C.GOAL_POINT_AT)} of them earns a development point.</li>
        <li><b>Key moments.</b> A close game late can stop on a mini game, played as the real play: make it and the game goes his way. Every playoff game in football and every series in basketball has one.</li>
        <li><b>The bye week</b> (football). It falls between Weeks {C.BYE_FIRST} and {C.BYE_LAST}, like the NFL's. He can put in extra work on a drill for a shot at a trait upgrade, or rest for a sure durability boost.</li>
        <li><b>Injuries and durability.</b> Durability starts from his frame, his weight for his height. The lower it is, the more often he gets hurt; an A body is hurt about a quarter as often as an average one, an S body rarely. The chance rises after 31. He can sit or play through it; playing through costs durability. Most knocks heal over the offseason.</li>
        <li><b>Hot Hand.</b> A boost from the Shop or the Builder Pass: {third(BOOSTS.hot.desc.replace(/^Career: \+/, 'plus '))}</li>
        <li><b>Seasons vary.</b> Form comes and goes. A hot streak or a cold stretch runs four games in football and eight in basketball, and it shows in the stats.</li>
      </ul>

      <h2 id="trades">Trade demands and the deadline</h2>
      <p>Once in each year of his contract he can demand a trade, in the offseason or at the trade deadline. Either way it costs <b>2 reputation</b>.</p>
      <ul>
        <li><b>To a contender.</b> Granted {pct(C.TRADE_ODDS.contender)} of the time, to one of the best teams in the league (the top quarter). If the team says no, he stays and the locker room hears about it.</li>
        <li><b>To any team.</b> Always granted, to anyone in the league.</li>
        <li><b>The deadline.</b> Football's is after Week 9, basketball's about game {C.deadlineGame({ sport: 'bucket', active: { base: { games: Array(82).fill(0) } } })} of 82. A deal at the deadline sends him to the new team for the rest of the season: its depth chart sets his role, its record decides the playoffs, and his season line counts both teams. A promise to start him stays with the old team.</li>
      </ul>
      <p>He can't demand a trade with a no-trade clause in his deal.</p>

      <h2 id="offseason">The offseason</h2>
      <p>Four steps: {andList(C.OFF_STEPS.map(([, l]) => l.charAt(0) + l.slice(1).toLowerCase()))}.</p>
      <ul>
        <li><b>Recap</b> of the year: the record, the numbers, the goals met, the awards.</li>
        <li><b>Contract.</b> When a deal runs out, three teams make offers: his own team, a contender paying less, and a team paying more. He can sit down with one and push for more money, another year, a no-trade clause or a starting job. Each ask costs some of the team's patience (shown with the odds); run out of patience and they walk away. His leverage (recent seasons, reputation, age) decides how much patience there is.</li>
        <li><b>Moves.</b> The roster turns over, one offseason event lands (a new coach, a mentor, a rival loading up), and the depth chart is set. A player can change his jersey number here.</li>
        <li><b>Camp.</b> One hard drill in front of the coaches. Win it for legacy and a development point.</li>
      </ul>

      <h2 id="development">Development points and trait costs</h2>
      <p>Development points raise his traits. In football he earns 2 a year while young (to {nfl.devYoung()}), then 1 a year through his prime and none after. In basketball it follows his NBA seasons: 2 a season for his first two, 1 for the next four, then none, whether he came out of college or straight to the draft. Either way he gets 1 more for an award (MVP, OPOY, DPOY or Rookie of the Year), 1 for an All-Pro or All-NBA team, 1 for a season that meets {word(C.GOAL_POINT_AT)} of its three goals, and 1 for winning the camp drill. The bye week's drill can add a grade on its own.</p>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>One grade up</th><th className="num">Points</th></tr></thead>
          <tbody>
            <tr><td>Any grade up to {grade(8)}</td><td className="num">{C.stepCost(5)}</td></tr>
            <tr><td>{grade(9)} to {grade(10)}</td><td className="num">{C.stepCost(9)}</td></tr>
            <tr><td>{grade(10)} to {grade(11)}</td><td className="num">{C.stepCost(10)}</td></tr>
          </tbody>
        </table>
      </div>
      <ul>
        <li><b>The top is earned.</b> A player can be the best at a few things, not at everything. The chips show the price before a point is spent.</li>
        <li><b>Late in a trait's window</b> it costs double, never more than {C.COST_MAX} points. Physical traits close first, then skills; the mental side never closes.</li>
        <li><b>Limits.</b> Size can be raised {word(C.UPGRADE_CAP.size)} times in a career; speed, bounce, get-off and bend {word(C.UPGRADE_CAP.speed)} times{K_LIVE ? `; each of a kicker's three ratings ${word(C.K_UPGRADE_CAP)} times` : ''}.</li>
        <li><b>Free grades.</b> A year of growth, experience or the bye week's drill can land on a trait at {grade(9)} or better only one time in its cost.</li>
      </ul>

      <h2 id="reputation">Reputation</h2>
      <p>Reputation runs from 1 to 10. Meeting goals and winning titles raise it; bad seasons and trade demands lower it. A good name earns more money and longer deals, wins ties on the depth chart, brings the good offseason events, and can land a <b>shoe deal</b> (later a signature shoe), which pays every year and adds to his legacy. In football a player can be named <b>captain</b>: a C on his jersey, with a star for each season he wears it.</p>

      <h2 id="aging">Aging and retirement</h2>
      <p>Young players can grow a trait on their own. Age takes a grade at a time from the traits that really age: speed, burst and bounce go first, strength a few years later, technique after that, and the reads, leadership and the jump shot never fade. Offseason work (2 points) can hold a trait that is about to drop or win back a lost grade. Offensive linemen and kickers hold on the longest.</p>
      <p><b>His specialty.</b> Every build has a specialty: the role it fits best when the career starts, read from the traits that stand highest. Those one or two traits can be trained {word(C.SPEC_TRAIN)} years longer than the rest of his game and start to slip about {word(C.SPEC_FADE)} years later, and more slowly. A speedster still loses his speed by his mid-30s, just later than everyone else. The player page names his specialty. A career started before specialties gets one from its build as it stands, and no grade changes.</p>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Position</th><th>Specialties (the traits that age later)</th></tr></thead>
          <tbody>
            {[...nfl.positions.filter(p => C.SPECIALTY.nfl[p]).map(p => [POS_WORD[p], 'nfl', p]), ['Guard', 'bucket', 'guard'], ['Big', 'bucket', 'big']].map(([l, sp, p]) => (
              <tr key={l}><td>{l}</td><td>{C.SPECIALTY[sp][p].map(([, label, ts]) => `${label} (${andList(ts.map(t => (C.POS_ATTR[p]?.[t]?.label ?? t).toLowerCase()))})`).join('; ')}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>He can retire from age 29 or after 8 seasons. The career also ends when he reaches the age for his position, after {C.MAX_SEASONS} seasons, or when free agency brings no offers.</p>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Position</th><th className="num">Last age</th><th className="num">Elite and durable</th></tr></thead>
          <tbody>
            {retireRows.map(([p, a, b]) => <tr key={p}><td>{p}</td><td className="num">{a}</td><td className="num">{b}</td></tr>)}
            <tr><td>Basketball</td><td className="num">{age('bucket', 'guard')}</td><td className="num">{age('bucket', 'guard', { ovr: 92, durability: 8 })}</td></tr>
          </tbody>
        </table>
      </div>
      <p>"Elite and durable" is an overall of 90 or more with durability of 7 or more{K_LIVE ? ' (a kicker: an overall of 86 or more)' : ''}. A retired career can come back once for up to {word(C.COMEBACK_SEASONS)} more seasons with BAP Pro.</p>

      <h2 id="legacy">Legacy and the Hall of Fame</h2>
      <pre className="wk-pre">{`legacy = seasons × ${C.LEGACY_W.seasons} + Pro Bowls/All-Stars × ${C.LEGACY_W.honors} (half after the ${C.HONOR_KNEE}th)
       + All-Pro/All-NBA × ${C.LEGACY_W.firsts} + awards (below) + rings × ${C.LEGACY_W.rings}
       + playoff years × ${C.LEGACY_W.playoffs} + records × ${C.LEGACY_W.records} + career stats
       + small camp, shoe deal and earnings bonuses (earnings: 1 a $${C.EARN_LEGACY.per}M, ${C.EARN_LEGACY.max} at most)

football awards: MVP and DPOY ${awards.top.join(', ')}, then ${awards.top[awards.top.length - 1]} each
                 OPOY${OL_LIVE ? ' and Protector of the Year' : ''} ${awards.skill.join(', ')}, then ${awards.skill[awards.skill.length - 1]} each
basketball MVP:  ${C.LEGACY_W.awards}, then ${C.LEGACY_W.awards + (nba.awardRepeat ?? C.AWARD_REPEAT)} each`}</pre>
      <p>An award is worth more each time it is won again. The same formula scores the real greats from their real careers, so a finished career slots into the all-time list for its position (one top 25 for basketball). Records count once each. Legacy tiers: {andList(C.LEGACY_TIERS.map(([at, n]) => (at ? `${n} (${at})` : n)))}.{OL_LIVE && ` An offensive lineman's First-Team All-Pros carry ${C.OL_FIRST_BONUS} more each, since Protector of the Year did not exist before 2025.`}</p>
      <p>At retirement the Hall of Fame vote is held: 80% of the vote gets him in, and 93% makes him a first-ballot pick.{K_LIVE && ' Voters are harder on kickers.'} Each career keeps its own record book too: break an all-time record and his number becomes the new bar.</p>

      {SOCCER_LIVE && (
        <>
          <h2 id="soccer">Soccer careers</h2>
          <p>A striker's career starts in an academy: trials, the scouts and coaches, the first contract. His club plays its league, its domestic cup and Europe. Between seasons there is a transfer window, and he can be called up for his country and play at the World Cup with the real 2026 national teams. Awards include the Golden Boot and the Ballon d'Or. A striker's body lasts to about 34 to 37.</p>
        </>
      )}
    </>
  )
}
export const CAREER_TOC = [
  ['start', 'Starting a career', 'new career position name face creator mini games advanced simple none'],
  ['draft', 'The combine and the draft', 'combine drills interviews draft rookie deal pro comparison undrafted'],
  ['seasons', 'Career seasons', 'depth chart backup goals key moments bye week injuries durability hot hand'],
  ['trades', 'Trade demands and the deadline', 'trade demand deadline contender any team reputation'],
  ['offseason', 'The offseason', 'contract talks patience camp moves jersey number'],
  ['development', 'Development points and trait costs', 'dev points upgrade cost S grade A+ top grades'],
  ['reputation', 'Reputation', 'rep shoe deal signature captain'],
  ['aging', 'Aging and retirement', 'retire age decline comeback'],
  ['legacy', 'Legacy and the Hall of Fame', 'legacy score all-time greatest hall of fame records'],
  ...(SOCCER_LIVE ? [['soccer', 'Soccer careers', 'academy transfer ballon d\'or world cup']] : []),
]
export { LB_LIVE, n0 }
