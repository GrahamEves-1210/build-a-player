import { Link, andList, orList, word, Word, n0 } from './wikiBits'
import { CFB_LIVE } from '../../lib/cfbLive'
import { CBB_LIVE } from '../../lib/cbbLive'
import { CFB_CONFERENCES } from '../../data/cfb-conferences'
import { CBB_CONFERENCES, CBB_OTHER_CONFERENCES } from '../../data/cbb-conferences'
import { CLASSES, CLASS_NAME, POINT_MARKS as CFB_MARKS } from '../cfb/cfbClass'
import { POINT_MARKS as CBB_MARKS } from '../cbb/cbbClass'
import { ITEMS } from '../../lib/cosmetics'
import { CFB_CLOUD } from '../cfb/cfbShared'
import { CBB_CLOUD } from '../cbb/cbbShared'

// College Football (CFB_LIVE) and College Basketball (CBB_LIVE): each section appears when its mode is on.
// Conference and school counts come from the data files the modes deal from; the Sandbox prices from the Shop's
// catalog (lib/cosmetics.js).
const priceOf = id => ITEMS.find(i => i.id === id)?.price ?? null
const classWords = orList(CLASSES.map(c => CLASS_NAME[c].toLowerCase()))

export function CollegePage({ go }) {
  const fbs = CFB_CONFERENCES.reduce((s, c) => s + c.teams, 0)
  const cbbSchools = CBB_CONFERENCES.reduce((s, c) => s + c.teams, 0)
  const cfbSand = priceOf('sandbox-cfb'), cbbSand = priceOf('sandbox-cbb')
  return (
    <>
      <p className="wk-lead">The college modes build a player from real college players, pick a school from his scholarship offers, and play full college seasons. After a season he can enter the pro draft and carry the build into <Link go={go} to="career">Career</Link>.</p>
      <p>College players are graded against other college players. That puts each one two grades above where the same player would sit on the pro scale (Size is height and weight, the same at both levels).</p>

      <h2 id="classes">Class years and points</h2>
      <ul>
        <li><b>Class.</b> A player starts as a {classWords}. A freshman can play up to four seasons, a senior one.</li>
        <li><b>Backups.</b> An underclassman who signs where the starter at his spot grades out better plays behind him that year.</li>
        <li><b>Upgrade points.</b> Each season earns 1 to 3 points to spend on his traits before the next one: 3 for national honors, 2 for a starter's good year or a big team season, 1 for anything else. A point is one grade, A+ to S costs two, Size moves twice at most and Speed three times.</li>
      </ul>

      {CFB_LIVE && (
        <>
          <h2 id="cfb">College Football</h2>
          <p>A mode inside football's <b>More ways to play</b>. Positions: QB, RB and WR.</p>
          <ul>
            <li><b>The wheels.</b> The first wheel is a conference, the second one of its starters. <b>Current</b> deals every FBS team's real 2026 players ({n0(fbs)} teams in {word(CFB_CONFERENCES.length)} groups: {andList(CFB_CONFERENCES.map(c => c.short))}). <b>All-Time</b> deals each school's legends, one to three at each position.</li>
            <li><b>Offers.</b> The first school is a scholarship decision: his star rating, national rank and the ten schools offering him. He is named on the offers screen, and the name follows him into the NFL.</li>
            <li><b>The season.</b> Twelve games played live, the AP Top 25 every week, conference title games, bowls and the 12-team College Football Playoff. A tough schedule makes the numbers harder to get.</li>
            <li><b>Awards.</b> The Heisman ceremony with the finalists and the vote count, the position awards (Davey O'Brien, Doak Walker, Biletnikoff), the Maxwell, the Walter Camp, conference Player of the Year and the All-America teams.</li>
            <li><b>Points.</b> A good year at each spot: QB {CFB_MARKS.qb}, RB {CFB_MARKS.rb}, WR {CFB_MARKS.wr}.</li>
            <li><b>Draft stock.</b> After every season a scouting report projects the round and pick, says what scouts like and question, and shows the board at his position.</li>
            <li><b>After a season.</b> Play on to the next season, <b>transfer</b> through the portal (a big season can bring a bigger program), or <b>enter the NFL Draft</b> once he has finished his junior year. A senior is out of eligibility.</li>
            <li><b>Enter the NFL Draft</b> turns the build into a new Career. Every trait drops two grades except Size (an A+ becomes an A-), and his college draft stock sets where the Career draft starts him.</li>
            {cfbSand != null && <li><b>Sandbox</b> works here too, as a {n0(cfbSand)}-coin unlock from the Shop.</li>}
          </ul>
        </>
      )}

      {CBB_LIVE && (
        <>
          <h2 id="cbb">College Basketball</h2>
          <p>A mode inside basketball's <b>More ways to play</b>. Positions: guard and big.</p>
          <ul>
            <li><b>The wheels.</b> A conference, then one of its starters. <b>Current</b> deals the 2026-27 rotations of {n0(cbbSchools)} schools in {word(CBB_CONFERENCES.length)} conferences: {andList(CBB_CONFERENCES.map(c => c.short))}. <b>All-Time</b> deals each school's legends.</li>
            <li><b>Offers</b> work the same way as in football: stars, rank and ten schools.</li>
            <li><b>The season.</b> A full schedule against real opponents with the AP Top 25 every week, then the conference tournament, Selection Sunday and the 68-team NCAA Tournament: {word(CBB_CONFERENCES.length + CBB_OTHER_CONFERENCES.length)} automatic bids, the rest at-large, the First Four, four regions and the Final Four. A team left out can play in the NIT.</li>
            <li><b>Awards.</b> The Wooden Award ceremony with five finalists and the vote, the Naismith, the position awards, national Defensive Player of the Year, three All-America teams, all-conference teams and conference Player of the Year.</li>
            <li><b>Points.</b> A good year: a guard {CBB_MARKS.guard}, a big {CBB_MARKS.big}.</li>
            <li><b>Draft stock.</b> After every season a scouting report projects the pick: top five, lottery, first round, second round or undrafted. Age counts, as in the real draft.</li>
            <li><b>After a season.</b> Enter the NBA Draft after <b>any</b> season, come back, or transfer through the portal.</li>
            <li><b>Enter the NBA Draft</b> turns the build into a new Career, with every trait but Size two grades lower.</li>
            {cbbSand != null && <li><b>Sandbox</b> works here too, as a {n0(cbbSand)}-coin unlock from the Shop.</li>}
          </ul>
        </>
      )}

      <h2 id="start-in-college">Start in College</h2>
      <p>A new {andList([...(CFB_LIVE ? ['football (QB, RB or WR)'] : []), ...(CBB_LIVE ? ['basketball'] : [])])} Career can start in college instead of at the combine. He picks a school from his offers and plays his college seasons as part of the career. In college the build plays two grades higher on every trait except Size; the boost comes off at the draft.</p>
      <p>College seasons earn XP and coins like any season.{(CFB_LIVE && !CFB_CLOUD) || (CBB_LIVE && !CBB_CLOUD) ? ' They are kept on the device and are not on the leaderboards.' : ''}</p>
    </>
  )
}
export const COLLEGE_TOC = [
  ['classes', 'Class years and points', 'freshman sophomore junior senior upgrade points backup'],
  ...(CFB_LIVE ? [['cfb', 'College Football', 'college football heisman playoff conference offers transfer portal nfl draft']] : []),
  ...(CBB_LIVE ? [['cbb', 'College Basketball', 'college basketball march madness ncaa tournament wooden award nba draft']] : []),
  ['start-in-college', 'Start in College', 'career college start'],
]
export { Word }
