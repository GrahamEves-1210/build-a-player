import { Link, andList, word, Word, n0, usd } from './wikiBits'
import { POOL_SIZE, BUILD_SECS as COMPETE_SECS, COMPETE_POS } from '../../lib/competeCore'
import { BUDGET, AUCTION_POS, FILLER_VAL, RESET_SECS } from '../../lib/auctionCore'
import { BUILD_SECS as BT_SECS, ROLES } from '../../lib/blacktopCore'
import { OFF_CALLS, DEF_CALLS } from '../../lib/hoops'
import { TIERS as SAL_TIERS, BUDGET_OPTIONS } from '../../lib/salaryCore'
import { COMPETE_RATING, FORFEIT_RATING, blacktopDelta, START_RATING } from '../../lib/rating'
import { ONLINE_TIERS, INFINITE_PAID } from '../../lib/progress'
import { CAPS, POSITIONS } from '../../lib/squad'
import { ITEMS } from '../../lib/cosmetics'
import { grade } from './wikiBits'
import { SOCCER_LIVE } from '../../lib/soccerLive'
import { FRANCHISE_LIVE } from '../../lib/franchiseLive'
import { CFB_LIVE } from '../../lib/cfbLive'
import { CBB_LIVE } from '../../lib/cbbLive'

// The modes outside Career, Franchise and college: Compete, the Trait Auction, Blacktop, Salary Cap, Squad Builder,
// the Depth Chart, Sandbox. Every number is read from the module the mode runs on.
const POS = { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', db: 'DB', dl: 'DL', lb: 'LB', ol: 'OL', k: 'K', guard: 'guard', big: 'big', st: 'striker' }
const mins = s => `${word(Math.round(s / 60))} minute${Math.round(s / 60) === 1 ? '' : 's'}`
const CALL = { drive: 'Drive', pullup: 'Pull-up', post: 'Post', pass: 'Pass', press: 'Press', sag: 'Sag', help: 'Help' }
const signed = n => (n > 0 ? `+${n}` : `−${Math.abs(n)}`)
const unlocks = ITEMS.filter(i => i.unlock)

export function ModesPage({ go }) {
  const btWin = blacktopDelta({ won: true }), btLoss = blacktopDelta({ won: false }), btMvp = blacktopDelta({ won: true, mvp: true }) - btWin
  const competeSports = [['Football', COMPETE_POS.nfl], ['basketball', COMPETE_POS.bucket], ...(SOCCER_LIVE ? [['soccer', COMPETE_POS.soccer]] : [])]
  return (
    <>
      <h2 id="current-all-time">Current and All-Time</h2>
      <p><b>Current</b> deals today's rosters, starters and backups, at their real ratings. Ratings move through the season as players do; the <Link go={go} to="ratings">Ratings</Link> page lists every one. <b>All-Time</b> deals each franchise's legends and plays against teams at their best eras. Legends rate higher, so All-Time seasons are tuned to come out only a little easier than Current ones: a few more wins and a slightly better shot at a title.</p>

      <h2 id="compete">Compete <span className="wk-tag">ONLINE</span></h2>
      <p>Up to {word(POOL_SIZE)} real players build at the same time from the <b>same spins</b> (respins are each player's own), with grades hidden. The clock is {mins(COMPETE_SECS)}. The highest overall wins; an earlier submit breaks a tie. Pools: {competeSports.map(([s, list]) => `${s} ${andList(list.map(p => POS[p]))}`).join('; ')}.</p>
      <p>Places move the online rating ({Object.entries(COMPETE_RATING).map(([p, d]) => `${p === '1' ? '1st' : p === '2' ? '2nd' : p === '3' ? '3rd' : `${p}th`} ${signed(d)}`).join(', ')}, less in a pool of mostly bots) and pay XP and coins. Everyone starts at {n0(START_RATING)}. The tiers: {andList(ONLINE_TIERS.map(([at, n]) => (at ? `${n} (${n0(at)})` : n)))}.</p>
      <h3 id="auction">Trait Auction</h3>
      <p>The other half of Compete (the switch at the top). 1v1: two players, {usd(BUDGET)} each. A slot is drawn and a real player is spun for it, his grade face down until the gavel. Bids go up $1 at a time and every bid puts the clock back to {RESET_SECS} seconds. Each player always keeps $1 for every other empty slot, and a slot still empty at the end gets a free agent ({grade(FILLER_VAL)}). The best overall wins; money left over breaks a tie. Positions: football {andList(AUCTION_POS.nfl.map(p => POS[p]))}, basketball {andList(AUCTION_POS.bucket.map(p => POS[p]))}.</p>

      <h2 id="blacktop">Blacktop <span className="wk-tag">ONLINE · BASKETBALL</span></h2>
      <p>Live streetball against real players: <b>1v1</b>, <b>2v2</b> (a guard and a big a side) and <b>King of the Hill</b> (three players, every man for himself). For a 1v1 or a 2v2, pick a spot in the lobby, then build together in {mins(BT_SECS)} with team chat and a role ({andList(ROLES.map(r => r.name.charAt(0) + r.name.slice(1).toLowerCase()))}). Anyone who walks away mid-build gets an automatic build.</p>
      <ul>
        <li><b>The game.</b> To 11, win by 2: ones inside, twos from beyond the arc, make it take it. Steals, blocks and rebounds change possession.</li>
        <li><b>Calls.</b> During the game a team can call its plays: {andList(OFF_CALLS.map(c => CALL[c]))} on offense, {andList(DEF_CALLS.map(c => CALL[c]))} on defense (no pass or help in a 1v1).</li>
        <li><b>King of the Hill.</b> Pick a real player and play him at his own ratings, live. Two play one on one while the third sits; score and you keep the ball, get a stop and the crown is yours. Each man keeps his own score: first to 11, win by 2. It starts when the third player is in.</li>
        <li><b>Rating.</b> A win {signed(btWin)}, a loss {signed(btLoss)}, the MVP {signed(btMvp)} more. Games against bots don't move it.</li>
        <li><b>Watch.</b> The Blacktop menu lists the games being played; Watch takes a seat in the stands.</li>
      </ul>

      <h2 id="live">Leaving a live game</h2>
      <p>Compete, the Trait Auction and Blacktop lock the build in while the game is live. Leaving (or closing the app) is a forfeit: last place, no rewards, and {signed(FORFEIT_RATING)} rating. One live game per device at a time.</p>

      <h2 id="salary-cap">Salary Cap <span className="wk-tag">DAILY</span></h2>
      <p>A board of five columns and five price tiers ({SAL_TIERS.map(usd).join(', ')}), priced strictly by rating, with the grades hidden. Pick one player per column without going over the day's budget ({usd(BUDGET_OPTIONS[0])} to {usd(BUDGET_OPTIONS[BUDGET_OPTIONS.length - 1])}, set by the date). One <b>Shuffle</b> re-deals a row or a column and one <b>Scout</b> shows a hidden grade. Everyone plays the same board each day, and the day's board ranks by overall, then budget used. Football's board is quarterbacks; basketball's guards and bigs{SOCCER_LIVE ? '; soccer\'s strikers' : ''}. <b>Infinite</b> mode deals new boards for practice; the first {word(INFINITE_PAID)} Infinite plays a day pay XP and coins.</p>

      <h2 id="squad-builder">Squad Builder</h2>
      <p>Build several players and play one season with all of them on the same real team.{FRANCHISE_LIVE ? ' On football\'s Home, Franchise has taken its place; Squad Builder is on basketball\'s' + (SOCCER_LIVE ? ' and soccer\'s.' : '.') : ''}</p>
      <ul>
        <li><b>The spots.</b> Pick the positions first, then build each one with the normal spins. Most per position: {[...(!FRANCHISE_LIVE ? [`football ${andList(POSITIONS.nfl.map(p => `${CAPS.nfl[p]} ${POS[p]}`))}`] : []), `basketball ${CAPS.bucket.guard} guards and ${CAPS.bucket.big} bigs`, ...(SOCCER_LIVE ? [`soccer ${CAPS.soccer.st} forwards`] : [])].join('; ')}. Current or All-Time.</li>
        <li><b>The team.</b> Its real roster fills every spot not built, and the builds take the starting jobs. A build better than the starter he replaces makes the team better; a worse one makes it worse.</li>
        <li><b>The lineup.</b> In basketball each build starts at the spot he was picked for; drag to swap them.</li>
        <li><b>One season.</b> The squad shares one schedule and one record, playoffs included. Every build has his own line and his own shot at the awards.</li>
        <li><b>Run it back.</b> After the season, add a player, cut one or change the team, and play another. New squad starts over.</li>
      </ul>

      <h2 id="depth-chart">The Depth Chart <span className="wk-tag">MINI GAME</span></h2>
      <p>Three real players, one hidden stat (passing touchdowns, passing or rushing yards for quarterbacks; rushing yards or touchdowns for backs; receiving yards or touchdowns for receivers), and ten seconds to put them in order. Get it right and the streak grows; one miss ends it.</p>

      <h2 id="sandbox">Sandbox</h2>
      <p>Turn on Sandbox from the build screen to bend the game.</p>
      <ul>
        <li><b>Custom Ratings</b> opens every player's grades, by team (tap a logo for its roster) or by search. Tap a grade, then pick its new value from all twelve. Edited players are tagged, and any player can be dropped straight into a slot of the build.</li>
        <li><b>Starters Only</b>: one wheel of the pool's starters, no team spin and no respins.</li>
        <li><b>One Team</b> (basketball): pick a team, and the wheel is that team's players.</li>
        <li><b>Any team</b> can be picked for the season.</li>
      </ul>
      <p>Sandbox seasons are never saved, ranked or counted toward rewards. On a normal build it is free; in other modes it is a one-time Shop unlock: {andList(unlocks.map(i => `${i.name} ${n0(i.price)} coins`))}.</p>
      <p className="wk-hat">Career, Franchise and the college modes have their own pages: <Link go={go} to="career">Career</Link>{FRANCHISE_LIVE ? <>, <Link go={go} to="franchise">Franchise</Link></> : null}{CFB_LIVE || CBB_LIVE ? <>, <Link go={go} to="college">College</Link></> : null}.</p>
    </>
  )
}
export const MODES_TOC = [
  ['current-all-time', 'Current and All-Time', 'current all-time legends pool'],
  ['compete', 'Compete', 'online pool same spins rating tiers'],
  ['auction', 'Trait Auction', 'bid budget online 1v1'],
  ['blacktop', 'Blacktop', '1v1 2v2 king of the hill koth streetball online lobby calls watch'],
  ['live', 'Leaving a live game', 'forfeit leave lock'],
  ['salary-cap', 'Salary Cap', 'daily grid budget board shuffle scout infinite'],
  ['squad-builder', 'Squad Builder', 'squad team lineup positions run it back season'],
  ['depth-chart', 'The Depth Chart', 'mini game streak'],
  ['sandbox', 'Sandbox', 'custom ratings edit grades starters only one team unlock'],
]
export { Word }
