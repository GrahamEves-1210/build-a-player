import { POOLS, gradeColor } from '../RatingsTable'
import { Link, Weights, n0, pct, andList } from './wikiBits'
import {
  calcOVR, calcOVRRB, calcOVRWR, calcOVRTE, calcOVRDB, calcOVRDL, calcOVRLB, calcOVROL, calcOVRK,
  ATTR_WEIGHT, RB_ATTR_WEIGHT, WR_ATTR_WEIGHT, TE_ATTR_WEIGHT, DB_ATTR_WEIGHT, DL_ATTR_WEIGHT, LB_ATTR_WEIGHT,
} from '../../utils/simulation'
import { calcBucketOVR, OVR_WEIGHTS } from '../../utils/bucketSimulation'
import { OL_ATTR_WEIGHT } from '../../data/ols'
import { K_ATTR_WEIGHT } from '../../data/ks'
import { LB_LIVE } from '../../lib/lbLive'
import { OL_LIVE } from '../../lib/olLive'
import { K_LIVE } from '../../lib/kLive'
import { SOCCER_LIVE } from '../../lib/soccerLive'
import { CFB_LIVE } from '../../lib/cfbLive'
import { CBB_LIVE } from '../../lib/cbbLive'
import { FRANCHISE_LIVE } from '../../lib/franchiseLive'
import { REWARDED_ON } from '../../lib/rewardedAd'

// Gameplay (Home, the spin, the scale, the positions and the overall) and Seasons (how a season is simulated).
// The positions, their ratings, the weights and every example overall are read from the game's own modules.

const GRADES = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S']
const NAME = { qb: 'Quarterback', rb: 'Running back', wr: 'Wide receiver', te: 'Tight end', db: 'Defensive back (CB · S)', dl: 'Defensive line (EDGE · DT)', lb: 'Linebacker', ol: 'Offensive line (T · G · C)', k: 'Kicker', guard: 'Guard (PG · SG · SF)', big: 'Big (PF · C)', st: 'Striker' }
// every football position's overall, with its weights (OL and K keep theirs in their data files)
export const NFL_OVR = [
  ['qb', calcOVR, ATTR_WEIGHT], ['rb', calcOVRRB, RB_ATTR_WEIGHT], ['wr', calcOVRWR, WR_ATTR_WEIGHT], ['te', calcOVRTE, TE_ATTR_WEIGHT],
  ...(OL_LIVE ? [['ol', calcOVROL, OL_ATTR_WEIGHT]] : []),
  ['db', calcOVRDB, DB_ATTR_WEIGHT], ['dl', calcOVRDL, DL_ATTR_WEIGHT],
  ...(LB_LIVE ? [['lb', calcOVRLB, LB_ATTR_WEIGHT]] : []),
  ...(K_LIVE ? [['k', calcOVRK, K_ATTR_WEIGHT]] : []),
]
const poolOf = id => POOLS.find(p => p.id === id)
const flat = (types, v) => Object.fromEntries(types.map(t => [t, { val: v }]))
const EXAMPLES = [3, 6, 8, 9, 11]   // C, B, A-, A, S

export function GameplayPage({ go }) {
  const footballPos = ['qb', 'rb', 'wr', 'te', 'ol', 'db', 'dl', 'lb', 'k'].filter(id => poolOf(id))
  const rows = [...footballPos, 'guard', 'big', ...(poolOf('st') ? ['st'] : [])]
  return (
    <>
      <p className="wk-hat">This page covers building a player. For what happens after the build, see <Link go={go} to="seasons">Seasons</Link>.</p>
      <p className="wk-lead">A build is one player made from pieces of many. Every spin lands on a <b>real player</b>, and the player keeps exactly <b>one</b> of his ratings. Fill every slot and the build has an overall rating, an archetype and a season to play.</p>

      <h2 id="home">Home</h2>
      <ul>
        <li><b>Pick the sport.</b> The row at the top holds Football, Basketball{SOCCER_LIVE ? ' and Soccer' : ''}, each shown by its ball. Tap one and the block slides over to it.</li>
        <li><b>Pick the position.</b> Football splits its positions into two bars: offense ({andList(['QB', 'RB', 'WR', 'TE', ...(OL_LIVE ? ['OL'] : [])])}) and defense ({andList(['DL', ...(LB_LIVE ? ['LB'] : []), 'DB', ...(K_LIVE ? ['K'] : [])])}). Tap DEFENSE or OFFENSE at the end of the bar to switch. Basketball has Guard (PG, SG, SF) and Big (PF, C).{SOCCER_LIVE && ' Soccer has the striker.'}</li>
        <li><b>Pick the pool.</b> <b>Current</b> deals today's players; <b>All-Time</b> deals the legends.{SOCCER_LIVE && <> In soccer the two pools are the <b>Champions League</b> and the <b>World Cup</b> (see <Link go={go} to="soccer">Soccer</Link>).</>}</li>
        <li><b>PLAY</b> opens the build screen. Under it, <b>More ways to play</b> lists the sport's other modes: {andList([...(FRANCHISE_LIVE ? ['Franchise'] : []), 'Career', ...(CFB_LIVE || CBB_LIVE ? ['the college modes'] : []), 'Salary Cap', 'Compete', 'Blacktop (basketball)', 'Squad Builder', 'the Depth Chart'])}. Each one has a section on <Link go={go} to="modes">Modes</Link>.</li>
        <li><b>The bottom bar</b> has five tabs: Shop, Daily, Home, Ranks and Profile. See <Link go={go} to="rewards">Rewards</Link> and <Link go={go} to="leaderboards">Leaderboards</Link>.</li>
      </ul>

      <h2 id="spinning">Spinning</h2>
      <ul>
        <li><b>Two wheels.</b> The first wheel stops on a team; the second stops on one of that team's players at the position.{SOCCER_LIVE && ' In soccer the first wheel is a club or a nation.'}{(CFB_LIVE || CBB_LIVE) && ' In the college modes it is a conference, then one of its starters.'} A team can come up more than once in the same build.</li>
        <li><b>Chips.</b> The player's ratings show as chips, one per rating. Tap a chip (or drag it onto the figure) to lock that rating into its slot. The chip keeps the player's name, number and team colours.</li>
        <li><b>One rating per spin.</b> Everything else about that player is gone once a chip is picked. Most football positions have <b>nine</b> slots{K_LIVE ? ', the kicker three' : ''}; basketball builds have <b>ten</b>{SOCCER_LIVE ? ' and soccer builds nine' : ''}.</li>
        <li><b>Respins.</b> A build gets one team respin and one player respin. A respin never lands on what it is replacing; on a team with two quarterbacks, the player respin gives the other one.{REWARDED_ON && ' In the app, a short video can add one more player respin per build.'}</li>
        <li><b>Backups spin too.</b> Bench players are in the pool with their real ratings.</li>
        <li><b>Hide grades</b> turns the letters off so the picks are made on the names alone.</li>
      </ul>

      <h2 id="scale">The 0–11 scale</h2>
      <p>Every rating runs from 0 to 11 and shows as a letter. S is kept for the very best in the league at that one thing.</p>
      <div className="wk-grades">{GRADES.map((g, v) => <span key={g} className="wk-grade" style={{ '--g': gradeColor(v) }}>{g}<small>{v}</small></span>)}</div>

      <h2 id="positions">Positions and ratings</h2>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Position</th><th className="num">Slots</th><th>Ratings</th></tr></thead>
          <tbody>
            {rows.map(id => { const p = poolOf(id); return p && <tr key={id}><td>{NAME[id]}</td><td className="num">{p.types.length}</td><td>{p.types.map(t => p.attr[t]?.label ?? t).join(', ')}</td></tr> })}
          </tbody>
        </table>
      </div>
      <p>Size is read from the player's real height and weight at most positions. On the line it also sets the spot: a defensive lineman is an EDGE or a DT{OL_LIVE ? ', an offensive lineman a tackle, guard or center' : ''}, from the player whose Size chip was taken.</p>

      <h2 id="overall">Overall rating</h2>
      <p>The overall (OVR) is a <b>weighted average</b> of the ratings in the build, not a plain average. Each position weights the things that win games at that spot.</p>
      <h3 id="overall-nfl">Football</h3>
      <pre className="wk-pre">{`avg = weighted average of the ratings (weights below)
QB:   OVR = 58 + 2.2 × avg + 0.24 × avg²
RB:   OVR = 62 + 2.0 × avg + 0.19 × avg²
rest: OVR = 60 + 2.1 × avg + 0.21 × avg²
floor bonus (full build): lowest rating 9+ adds 2 (QB 2.5), lowest 8+ adds 0.5 (QB 0.8)${K_LIVE ? `
kicker: no floor bonus, and above 88 the curve climbs at about half speed` : ''}
OVR is rounded and never goes past 99`}</pre>
      <p>Raising a rating never lowers the overall. The table shows what a build with every rating the same scores at each position, worked out by the game's own formulas.</p>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Position</th>{EXAMPLES.map(v => <th key={v} className="num">All {GRADES[v]}</th>)}</tr></thead>
          <tbody>
            {NFL_OVR.map(([id, fn]) => { const p = poolOf(id); return p && <tr key={id}><td>{NAME[id]}</td>{EXAMPLES.map(v => <td key={v} className="num">{fn(flat(p.types, v), p.types)}</td>)}</tr> })}
            {['guard', 'big'].map(id => { const p = poolOf(id); return <tr key={id}><td>{NAME[id]}</td>{EXAMPLES.map(v => <td key={v} className="num">{calcBucketOVR(flat(p.types, v), p.types, id)}</td>)}</tr> })}
          </tbody>
        </table>
      </div>
      <div className="wk-weights">
        {NFL_OVR.map(([id, , w]) => { const p = poolOf(id); return p && <Weights key={id} title={NAME[id]} weights={w} attr={p.attr} /> })}
      </div>
      <h3 id="overall-nba">Basketball</h3>
      <pre className="wk-pre">{`avg = weighted average of the ten ratings
OVR = 57 + (avg − 1) ÷ 9 × 44, rounded, 99 at most`}</pre>
      <p>A build of all 1s is a 57 and all 10s a 99. Guards are scored mostly on jump shot, speed, size, finishing and IQ; bigs on finishing, size, interior defense and rebounding.</p>
      <div className="wk-weights"><Weights title="Guard" weights={OVR_WEIGHTS.guard} attr={poolOf('guard').attr} /><Weights title="Big" weights={OVR_WEIGHTS.big} attr={poolOf('big').attr} /></div>
      {SOCCER_LIVE && <p>A striker's overall uses the basketball scale. Its weights are on the <Link go={go} to="soccer" hash="ratings">Soccer</Link> page.</p>}

      <h2 id="archetypes">Archetypes</h2>
      <p>The name under the overall comes from the overall and the build's strongest ratings. A quarterback built on legs and arm is a <b>Dual Threat</b> (an <b>Elite Dual Threat</b> near the top); arm and accuracy make a <b>Gunslinger</b>; strong all the way across is a <b>Franchise Cornerstone</b>. Low overalls get honest names: <b>Raw Talent</b>, <b>One-Trick Pony</b>, <b>Clipboard Manager</b>, <b>Practice Squad Arm</b>.</p>
    </>
  )
}
export const GAMEPLAY_TOC = [
  ['home', 'Home', 'home sport picker football basketball soccer position offense defense current all-time play'],
  ['spinning', 'Spinning', 'spin wheel respin team player chips tap hide grades'],
  ['scale', 'The 0–11 scale', 'grades letter F S rating scale'],
  ['positions', 'Positions and ratings', `QB RB WR TE DB DL${LB_LIVE ? ' LB' : ''}${OL_LIVE ? ' OL' : ''}${K_LIVE ? ' K kicker' : ''} guard big${SOCCER_LIVE ? ' striker' : ''} attributes ratings`],
  ['overall', 'Overall rating', 'OVR formula weights weighted average floor bonus'],
  ['overall-nfl', 'Football overall', 'OVR formula'],
  ['overall-nba', 'Basketball overall', 'OVR formula'],
  ['archetypes', 'Archetypes', 'gunslinger dual threat franchise cornerstone'],
]

// ── Seasons ──────────────────────────────────────────────────────────────────
export function SeasonsPage({ go }) {
  const qa = poolOf('qb').attr, q = t => (qa[t]?.label ?? t).toLowerCase()
  return (
    <>
      <p className="wk-hat">For how the overall behind these numbers is worked out, see <Link go={go} to="gameplay" hash="overall">Gameplay § Overall rating</Link>.</p>
      <h2 id="flow">How a season plays</h2>
      <p>When the build is full, the player picks a team (or spins for one) and the season is simulated. It plays out game by game: the record ticks up, the wire reports what happened, and then come the standings, the playoffs and the awards.</p>
      <ul>
        <li><b>Moments.</b> Now and then the season stops on a card: the last drive of a close game, an injury, the trade deadline, resting after clinching. Each choice says what it does, and the rest of the season is played on from it. The <b>Moments</b> switch above the team card turns them off to play straight through.</li>
        <li><b>Mini games.</b> In <Link go={go} to="career">Career</Link>{FRANCHISE_LIVE ? <> and <Link go={go} to="franchise">Franchise</Link></> : ''}, big plays are mini games played inside the real game.</li>
        <li><b>Picking up again.</b> A season in progress is kept on the device, so a reload comes back to the same season at the same point. It is never re-rolled.</li>
      </ul>

      <h2 id="nfl">Simulating an NFL season</h2>
      <p>Each football position has its own engine. The build's ratings set a per-game win chance and the player's stat line, the team pushes both, and every game adds variance.</p>
      <h3 id="nfl-team">The team matters</h3>
      <p>Every NFL team carries an <b>offense</b> and a <b>defense</b> grade from 1 to 10 (5 is league average). They move the win chance (defense a little more than offense), the supporting cast's numbers and how often the quarterback is sacked. In All-Time the franchises use their best eras, and opponents count at full strength.</p>
      <h3 id="nfl-schedule">The schedule</h3>
      <p>Seventeen games built like the real league: six division games, four against a division in the same conference, four against a division in the other conference, and three more. Cold-weather outdoor stadiums see bad weather in about 18% of games, which cuts completions and yards.</p>
      <h3 id="nfl-winning">Winning (quarterback example)</h3>
      <pre className="wk-pre">{`win chance = 22%
  + ${q('accuracy')} × 11%  + ${q('processing')} × 10%  + ${q('vision')} × 9%
  + ${q('arm')} × 7%  + ${q('pocket-presence')} × 7%  + ${q('playmaking')} × 5%  + ${q('legs')} × 4%
  + ${q('leadership')} × 3%  + ${q('size')} × 2%
  + team offense × 5.5%  + team defense × 6.5%
  − a penalty for an overall under 80 (steeper under 75, 70 and 67)
kept between 15% and 84%        (ratings count as rating ÷ 11)`}</pre>
      <p>Stats come from the same ratings: completion percentage is mostly {q('accuracy')}, interceptions fall with {q('processing')}, rushing yards are almost all {q('legs')}. Scores are kept to real football numbers.</p>
      <h3 id="nfl-playoffs">Playoffs</h3>
      <ul>
        <li><b>Getting in.</b> Ten wins makes the playoffs. Nine wins is a coin flip; eight gets in about 6% of the time.</li>
        <li><b>The bye.</b> Fourteen wins earns a first-round bye, and thirteen wins earns one 60% of the time. With a bye the title takes three wins instead of four.</li>
        <li><b>Each game.</b> A playoff game starts near 30% and moves with the overall (97 counts as elite), the gap between the two teams, the regular-season record and home field. An overall under 85 costs a little.</li>
        <li><b>Weather and overtime.</b> Cold-weather hosts can bring snow or rain; close games go to overtime about one time in five.</li>
      </ul>
      <h3 id="nfl-awards">Awards</h3>
      <p><b>MVP</b> (quarterbacks) is about production and winning, voted before the playoffs. Touchdowns count most, then yards, interceptions, overall and wins. Under 11 wins rules a quarterback out; under 38 total touchdowns makes it a long shot; 50 touchdowns on a team with 11 or more wins is nearly certain. All-Time seasons are judged 20% harder. Running backs, receivers and tight ends chase <b>Offensive Player of the Year</b>; defensive backs, defensive linemen{LB_LIVE ? ' and linebackers' : ''} chase <b>Defensive Player of the Year</b>.{OL_LIVE && ' An offensive lineman chases Protector of the Year and the All-Pro team.'}{K_LIVE && ' A kicker chases the All-Pro team.'} If the build falls short, a real player at that level wins it.</p>
      {OL_LIVE && <p>An offensive lineman's <b>season grade</b> (0–100) is read from the season he had: pressures and sacks allowed for the pass half, run blocking and pancakes for the run half, less the penalties. An elite year grades in the 90s, a good starter in the high 70s to mid 80s. <b>Protector of the Year</b> is the NFL's award for its best lineman, first given for the 2025 season.</p>}

      <h2 id="nba">Simulating an NBA season</h2>
      <p>Build-A-Bucket plays 82 games, the play-in and four best-of-seven rounds. The team's strength sets the baseline and the build moves it.</p>
      <h3 id="nba-team">Team strength</h3>
      <p>Every team has an offense and a defense rating out of 100, fitted to the 2025–26 standings. Their average becomes a baseline win rate between 13% and 77%. All-Time teams use their best eras.</p>
      <h3 id="nba-boost">The build's boost</h3>
      <pre className="wk-pre">{`delta = (OVR − 82) ÷ 17
Current: the roster counts for 80% of its edge, and a star lifts more
         boost = delta × 32%, up to +30%
All-Time: boost = delta × 20% × 0.45, up to +9%
below 82: boost = delta × 10%, down to −10% (All-Time −5%)
win chance = baseline + boost, between 12% and 87% (All-Time 91%)`}</pre>
      <p>An 82 adds nothing; the higher the overall, the more the team wins. The 82 games are then played one at a time at that chance, each with a real score and the build's line.</p>
      <h3 id="nba-stats">The numbers</h3>
      <p>Per-game averages come from mixes of the ratings. A guard's scoring is jump shot (32%), finishing (24%), speed (18%), size (12%), handles and clutch; a big's is finishing (50%), jump shot (25%), playmaking and clutch. Rebounds lean on size and bounce, assists on passing or playmaking plus IQ, steals on perimeter defense and IQ, blocks on size and interior defense. A jump shot of 0 never takes a three; the best shooters reach about 45% from three.</p>
      <h3 id="nba-playoffs">Standings, play-in, playoffs</h3>
      <ul>
        <li>The other fourteen teams in the conference play their own 82 games, and seeds go by wins.</li>
        <li>Seeds 1–6 go straight in. Seeds 7–10 play the <b>play-in</b>.</li>
        <li>Series are best of seven, with a small playoff edge for the build's team. The other series in the bracket are played too, so the next opponent is whoever really won.</li>
      </ul>
      <h3 id="nba-awards">Awards</h3>
      <p><b>MVP</b> goes to the build if his season beats the best of five real MVP-level candidates on <b>points + 1.5 × assists + 0.75 × rebounds</b>, and only if his team reached the playoffs. <b>Defensive Player of the Year</b> reads steals and blocks (10 × steals + 8 × blocks, plus a bonus for a top seed) against a bar that changes each season; an MVP can't win both.</p>
      {SOCCER_LIVE && (
        <>
          <h2 id="soccer">Soccer seasons</h2>
          <p>A striker's season is a Champions League campaign or a World Cup. Both are on the <Link go={go} to="soccer" hash="season">Soccer</Link> page.</p>
        </>
      )}
    </>
  )
}
export const SEASONS_TOC = [
  ['flow', 'How a season plays', 'decisions moments switch reload'],
  ['nfl', 'NFL season', 'simulate football'], ['nfl-team', 'The team matters', 'team offense defense grade'], ['nfl-schedule', 'The schedule', '17 games weather'],
  ['nfl-winning', 'Win chance', 'win probability stats passing yards'], ['nfl-playoffs', 'NFL playoffs', 'bye wild card super bowl overtime'], ['nfl-awards', 'NFL awards', 'MVP OPOY DPOY protector all-pro'],
  ['nba', 'NBA season', 'simulate basketball 82 games'], ['nba-team', 'Team strength', 'ratings out of 100'], ['nba-boost', 'The build\'s boost', 'OVR boost win chance'],
  ['nba-stats', 'The numbers', 'PPG RPG APG shooting'], ['nba-playoffs', 'Play-in and playoffs', 'seed best of seven finals'], ['nba-awards', 'NBA awards', 'MVP DPOY'],
  ...(SOCCER_LIVE ? [['soccer', 'Soccer seasons', 'champions league world cup']] : []),
]
// (exported for the Main Page's numbers)
export { n0, pct }
