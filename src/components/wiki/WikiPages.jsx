import { useState } from 'react'
import RatingsTable, { POOLS, RATINGS_AS_OF, RATINGS_DATES, fmtDate, poolCounts, gradeColor } from '../RatingsTable'
import { CREATORS, CREATORS_AS_OF } from '../../data/creators'

// The wiki's pages. Each exports its content as a component plus a table of
// contents the shell uses for the sidebar and search. Everything here is
// written from the game's engines (src/utils/simulation.js, bucketSimulation.js
// and the components the modes live in).

const GRADES = [['F', 0], ['D', 1], ['C-', 2], ['C', 3], ['C+', 4], ['B-', 5], ['B', 6], ['B+', 7], ['A-', 8], ['A', 9], ['A+', 10], ['S', 11]]
const Link = ({ go, to, hash, children }) => <a href={to === 'main' ? '/wiki' : `/wiki/${to}`} onClick={e => { e.preventDefault(); go(to, { hash }) }}>{children}</a>

const Weights = ({ title, rows }) => (
  <table className="wikitable">
    <caption>{title}</caption>
    <tbody>{rows.map(([k, w]) => <tr key={k}><td>{k}</td><td className="num">{w}%</td></tr>)}</tbody>
  </table>
)
const QB_W = [['Accuracy', 17], ['Processing', 16], ['Arm', 15], ['Legs', 15], ['Playmaking', 10], ['Vision', 9], ['Pocket presence', 7], ['Size', 7], ['Leadership', 4]]
const RB_W = [['Elusiveness', 15], ['Speed', 14], ['Burst', 14], ['Strength', 14], ['Balance', 13], ['Vision', 12], ['Size', 11], ['Hands', 11], ['Carrying', 5]]
const WR_W = [['Hands', 14], ['Route running', 14], ['Speed', 14], ['Size', 14], ['Awareness', 10], ['After the catch', 10], ['Body control', 8], ['Vertical', 8], ['Release', 8]]
const TE_W = [['Hands', 16], ['Route running', 15], ['Size', 12], ['Awareness', 11], ['After the catch', 11], ['Blocking', 9], ['Strength', 9], ['Vertical', 9], ['Speed', 8]]
const DB_W = [['Man coverage', 15], ['Speed', 14], ['Play recognition', 14], ['Zone IQ', 13], ['Press', 11], ['Fluidity', 10], ['Hands', 10], ['Run support', 7], ['Size', 6]]
const G_W = [['Jump shot', 14], ['Speed', 14], ['Size', 14], ['Finishing', 14], ['Basketball IQ', 14], ['Passing', 8], ['Handles', 8], ['Perimeter defense', 8], ['Bounce', 3], ['Clutch', 3]]
const B_W = [['Finishing', 15], ['Size', 15], ['Interior defense', 15], ['Rebounding', 15], ['Jump shot', 9], ['Bounce', 7], ['Playmaking', 7], ['Basketball IQ', 7], ['Speed', 7], ['Clutch', 3]]

// ── Main page ────────────────────────────────────────────────────────────────
function MainPage({ go }) {
  const counts = poolCounts()
  return (
    <>
      <table className="wk-infobox">
        <caption>Build-A-Player</caption>
        <tbody>
          <tr><td colSpan={2}><img src="/logo-v3.png" alt="Build-A-Player logo" /></td></tr>
          <tr><th>Type</th><td>Free browser game</td></tr>
          <tr><th>Games</th><td>Build-A-Player (NFL)<br />Build-A-Bucket (NBA)</td></tr>
          <tr><th>Positions</th><td>QB, RB, WR, TE, DB<br />Guard, Big</td></tr>
          <tr><th>Modes</th><td>Current, All-Time, Salary Cap, Head-to-Head, Depth Chart</td></tr>
          <tr><th>Platform</th><td>Web browser</td></tr>
          <tr><th>Ratings as of</th><td>{fmtDate(RATINGS_AS_OF)}</td></tr>
          <tr><th>Website</th><td><a href="/">build-a-player.com</a></td></tr>
        </tbody>
      </table>
      <p className="wk-lead"><b>Build-A-Player</b> is a fan-made browser game in which you build one football or basketball player out of pieces of many real ones. Spin for a team, spin for a player, keep one part of his game, and repeat until the silhouette is full. Then simulate a season and find out what you made.</p>
      <p>This wiki documents how every part of the game works, written from the game's own code rather than from guesswork: the spin, the 0–11 rating scale, the overall formulas, the season engines, the playoffs, the awards, every mode, and every rating in the game. Ratings on this wiki update automatically whenever the game's data does.</p>

      <h2 id="start">Start here</h2>
      <ul className="wk-start">
        <li><Link go={go} to="gameplay">Gameplay</Link><span>Spins, chips, respins, the 0–11 scale, and how your overall is scored.</span></li>
        <li><Link go={go} to="seasons">Seasons</Link><span>How an NFL or NBA season is simulated, game by game, through the playoffs and awards.</span></li>
        <li><Link go={go} to="modes">Modes</Link><span>Current, All-Time, Salary Cap, Head-to-Head, the Depth Chart, Sandbox, leaderboards.</span></li>
        <li><Link go={go} to="ratings">Ratings</Link><span>Every player in every pool, sortable and searchable, with the date each pool last changed.</span></li>
        <li><Link go={go} to="creators">Creators</Link><span>YouTubers and podcasters who have played the game on camera.</span></li>
        <li><Link go={go} to="behind-the-scenes">Behind the scenes</Link><span>Where the ratings come from, how random the game is, what it runs on.</span></li>
      </ul>

      <h2 id="two-games">The two games</h2>
      <p><b>Build-A-Player</b> is the football game: quarterbacks, running backs, wide receivers, tight ends and defensive backs, each with nine attributes, simulated through a 17-game NFL season with playoffs, a Super Bowl and an awards vote. <b>Build-A-Bucket</b> is the basketball game at <a href="/bucket">build-a-player.com/bucket</a>: guards and bigs with ten attributes, an 82-game season, the play-in, four rounds of best-of-seven, and an MVP race.</p>

      <h2 id="numbers">By the numbers</h2>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Pool</th><th className="num">Current players</th><th className="num">All-time legends</th><th>Ratings last changed</th></tr></thead>
          <tbody>
            {counts.map(c => <tr key={c.id}><td>{c.sport === 'nfl' ? 'NFL' : 'NBA'} · {c.label}</td><td className="num">{c.current}</td><td className="num">{c.legends}</td><td>{fmtDate(c.updated)}</td></tr>)}
          </tbody>
        </table>
      </div>
      <p>All ratings sit on a 0–11 scale shown as letter grades from F to S. The full lists are on the <Link go={go} to="ratings">Ratings</Link> page.</p>
    </>
  )
}

// ── Gameplay ─────────────────────────────────────────────────────────────────
function GameplayPage({ go }) {
  return (
    <>
      <p className="wk-hat">This page covers building a player. For what happens after you hit Simulate, see <Link go={go} to="seasons">Seasons</Link>.</p>
      <p className="wk-lead">A build is one player made from pieces of many. Every spin lands on a <b>real player</b>, and you keep exactly <b>one</b> part of his game. Do that for every slot on the body and you have a complete player with an overall rating, an archetype and a season to play.</p>

      <h2 id="spinning">Spinning</h2>
      <ul>
        <li><b>Two reels.</b> The first reel stops on a team; the second stops on one of that team's players at your position. Teams already drawn in this build are skipped, so you see the whole league before anyone repeats.</li>
        <li><b>Chips.</b> The player's ratings appear as chips, one per attribute. Tap a chip to lock that rating into your build. The chip carries the player's name, number, team colours and headshot, which is why finished builds look the way they do.</li>
        <li><b>One attribute per spin.</b> Everything else about that player is gone once you pick. Football builds have <b>nine</b> slots; basketball builds have <b>ten</b>.</li>
        <li><b>Respins.</b> Each spin gives you one team respin and one player respin (tight ends get two player respins in Current mode). A player respin never shows you the same player twice.</li>
        <li><b>Bench players spin too.</b> Backups are in the pool with their real ratings, which is where the hard choices come from.</li>
      </ul>

      <h2 id="scale">The 0–11 scale</h2>
      <p>Every attribute is rated from 0 to 11 and shown as a letter. S is reserved for the very best in the league at that one thing.</p>
      <div className="wk-grades">{GRADES.map(([g, v]) => <span key={g} className="wk-grade" style={{ '--g': gradeColor(v) }}>{g}<small>{v}</small></span>)}</div>

      <h2 id="positions">Positions and attributes</h2>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Position</th><th>Attributes</th></tr></thead>
          <tbody>
            <tr><td>Quarterback</td><td>Arm, Legs, Size, Processing, Leadership, Vision, Playmaking, Accuracy, Pocket Presence</td></tr>
            <tr><td>Running back</td><td>Speed, Burst, Strength, Size, Balance, Elusiveness, Vision, Hands, Carrying</td></tr>
            <tr><td>Wide receiver</td><td>Hands, Route Running, Speed, Size, Awareness, After the Catch, Body Control, Vertical, Release</td></tr>
            <tr><td>Tight end</td><td>Hands, Route Running, Size, Awareness, After the Catch, Blocking, Strength, Vertical, Speed</td></tr>
            <tr><td>Defensive back</td><td>Speed, Size, Fluidity, Press, Hands, Zone IQ, Man Coverage, Play Recognition, Run Support</td></tr>
            <tr><td>Guard (PG · SG · SF)</td><td>Jump Shot, Finishing, Passing, Handles, Perimeter Defense, Speed, Bounce, Size, Basketball IQ, Clutch</td></tr>
            <tr><td>Big (PF · C)</td><td>Jump Shot, Finishing, Playmaking, Interior Defense, Rebounding, Speed, Bounce, Size, Basketball IQ, Clutch</td></tr>
          </tbody>
        </table>
      </div>
      <p>The pills above the silhouette group these into categories (physical, mental, skill). You can hide grades in the menu to draft on instinct.</p>

      <h2 id="overall">Overall rating</h2>
      <p>Your overall is a <b>weighted average</b> of the ratings you locked in, not a plain mean. Each position weights the things that actually win games, and the football formula rewards balance on top.</p>
      <h3 id="overall-nfl">Football</h3>
      <pre className="wk-pre">{`avg = weighted average of your nine ratings (weights below)
OVR = min(99, round(base + balance bonus + floor bonus))`}</pre>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Position</th><th>Base</th><th>Balance bonus<br />(best minus worst ≤ 1 / ≤ 2 / ≤ 3)</th><th>Floor bonus<br />(lowest ≥ 9 / ≥ 8)</th></tr></thead>
          <tbody>
            <tr><td>Quarterback</td><td>58 + 2.2 × avg + 0.24 × avg²</td><td>+3 / +1.5 / +0.5</td><td>+2.5 / +0.8</td></tr>
            <tr><td>Running back</td><td>62 + 2.0 × avg + 0.19 × avg²</td><td>+2.5 / +1 / +0.3</td><td>+2 / +0.5</td></tr>
            <tr><td>Wide receiver, tight end, defensive back</td><td>60 + 2.1 × avg + 0.21 × avg²</td><td>+2.5 / +1 / +0.3</td><td>+2 / +0.5</td></tr>
          </tbody>
        </table>
      </div>
      <p>Bonuses only apply to complete builds, and a quarterback loses his balance bonus if any rating is an F. For reference, a complete build with every rating the same scores: all 3s (C) 70 to 72 depending on position, all 5s (B-) 78 or 79, all 8s (A-) 93 to 95, and nine S ratings hit the 99 cap.</p>
      <div className="wk-weights">
        <Weights title="Quarterback" rows={QB_W} /><Weights title="Running back" rows={RB_W} /><Weights title="Wide receiver" rows={WR_W} /><Weights title="Tight end" rows={TE_W} /><Weights title="Defensive back" rows={DB_W} />
      </div>
      <h3 id="overall-nba">Basketball</h3>
      <pre className="wk-pre">{`avg = weighted average of your ten ratings
OVR = min(99, round(57 + (avg − 1) / 9 × 44))`}</pre>
      <p>That maps a build of all 1s to 57 and all 10s to 99. Guards are scored on five big things (jump shot, speed, size, finishing, IQ) with passing, handles and perimeter defense behind them; bigs live on finishing, size, interior defense and rebounding.</p>
      <div className="wk-weights"><Weights title="Guard" rows={G_W} /><Weights title="Big" rows={B_W} /></div>

      <h2 id="archetypes">Archetypes</h2>
      <p>The name under your overall comes from the overall tier and your two strongest traits. A 90+ quarterback whose best traits are legs and arm is an <b>Elite Dual Threat</b>; arm and accuracy make a <b>Gunslinger</b>; a tight spread across the board is a <b>Franchise Cornerstone</b>. At 95+ two 10-or-better ratings in arm and legs read <b>Once-in-a-Generation Talent</b>. Below 68 the names get honest: <b>Raw Talent</b>, <b>One-Trick Pony</b>, <b>Clipboard Manager</b>, <b>Practice Squad Arm</b>.</p>
    </>
  )
}

// ── Seasons ──────────────────────────────────────────────────────────────────
function SeasonsPage({ go }) {
  return (
    <>
      <p className="wk-hat">For how the overall that drives these numbers is scored, see <Link go={go} to="gameplay" hash="overall">Gameplay § Overall rating</Link>.</p>
      <h2 id="nfl">Simulating an NFL season</h2>
      <p>When the build is complete you spin for (or pick) a team, and the season runs game by game. Each position has its own engine written the same way: your attributes set a per-game win chance and a set of stat baselines, the team you land on pushes both, and every game adds variance.</p>
      <h3 id="nfl-team">Your team matters</h3>
      <p>Every NFL team carries an <b>offense</b> and a <b>defense</b> grade from 1 to 10, where 5 is league average. Those grades feed your win chance (defense slightly more than offense), your supporting-cast stats, and how often you get sacked. In All-Time mode the franchises use their historical-peak grades, and the opponent's grades count at full weight instead of 60%.</p>
      <h3 id="nfl-schedule">The schedule</h3>
      <p>Seventeen games built like the real league: six divisional games (each rival twice), four against each of two same-conference divisions, four against a cross-conference division, and three flex games, shuffled with nine home dates and eight on the road. Cold-weather outdoor stadiums see bad weather in about 18% of games, which trims completions and yards.</p>
      <h3 id="nfl-winning">Winning (quarterback example)</h3>
      <pre className="wk-pre">{`win chance = 22%
  + accuracy × 11%  + processing × 10%  + vision × 9%
  + arm × 7%  + pocket presence × 7%  + playmaking × 5%  + legs × 4%
  + leadership × 3%  + size × 2%
  + team offense × 5.5%  + team defense × 6.5%
  − penalty for an overall under 80 (steeper under 75, 70 and 67)
clamped between 15% and 84%        (attributes count as rating ÷ 11)`}</pre>
      <p>Stats come from the same ratings. A quarterback's passing yards per game start at 138 and climb with arm (up to +65), accuracy (+45), vision (+24), pocket presence (+14), playmaking (+10) and the team's offense (+16). Completion percentage is mostly accuracy; touchdown rate is accuracy, vision and processing; interceptions fall with processing first. Rushing yards are almost entirely legs. Scores are snapped to real football numbers (sevens and threes), and the game log, best game and season totals are kept for the report.</p>
      <h3 id="nfl-playoffs">Playoffs</h3>
      <ul>
        <li><b>Getting in.</b> Ten wins makes the playoffs. Nine wins is a coin flip; eight wins gets in about 6% of the time.</li>
        <li><b>The bye.</b> Fourteen wins earns a first-round bye; thirteen wins earns one 60% of the time. With a bye you need three playoff wins for the title instead of four.</li>
        <li><b>Each game.</b> A playoff game starts at 30% and moves with your overall (up to about +61% on a scale that treats 97 as elite) and the gap between your team and the opponent's (±41%), plus 3% for home field. Opponents come from each conference's contender pool, never your own team, and the Super Bowl opponent from the other conference's elite.</li>
        <li><b>Weather and overtime.</b> Cold-weather hosts bring snow or rain that lowers scoring; close matchups go to overtime about one game in five.</li>
      </ul>
      <h3 id="nfl-awards">Awards</h3>
      <p>MVP voting is about production. Combined touchdowns are the biggest factor (50 or more adds 52%; 30 is the floor to be considered at all), total yards next (5,500 adds 32%), then overall, wins and a playoff berth. Like the real vote, it's settled on the regular season: nothing that happens in the playoffs counts. Fewer than ten wins and you are out of the race; All-Time seasons are judged 20% harder, and nobody is ever more than a 90% lock. Lose the vote and a real MVP-calibre player takes it with a stat line built to top yours. Running backs, receivers and tight ends chase Offensive Player of the Year on the same principle; defensive backs chase Defensive Player of the Year.</p>

      <h2 id="nba">Simulating an NBA season</h2>
      <p>Build-A-Bucket plays 82 games, the play-in, and four best-of-seven rounds. Here your team's strength sets the baseline and your build moves it; in All-Time mode you are one star among legends, so the team counts for more.</p>
      <h3 id="nba-team">Team strength</h3>
      <p>Every team has an offense and a defense rating out of 100, calibrated to the 2025–26 standings (the Thunder and Spurs at the top, the Wizards and Pacers at the bottom). The average of the two becomes a baseline win rate between 13% and 77%. All-Time teams use their peak eras: the 73-win Warriors' offense, the Russell and Bird Celtics' defense, the Jordan Bulls.</p>
      <h3 id="nba-boost">Your boost</h3>
      <pre className="wk-pre">{`delta = (OVR − 82) / 17
boost = delta ≥ 0 ? min(+20%, delta × 20%) : max(−10%, delta × 10%)
All-Time: boost × 0.45, capped at +9% / −5%
win chance = team baseline + boost, clamped 12% to 87% (All-Time 91%)`}</pre>
      <p>An 82 build adds nothing. A 99 adds the full 20 points. Below 82 the penalty is gentler than the reward. Then 82 games are played one at a time at that chance, each with a realistic score and your line for the night.</p>
      <h3 id="nba-stats">Your numbers</h3>
      <p>Per-game averages come from composites of your ratings. A guard's scoring is jump shot (32%), finishing (24%), speed (18%), size (12%), handles and clutch; a big's is finishing (50%), jump shot (25%), playmaking and clutch. Rebounding leans on size and bounce, assists on passing or playmaking plus IQ, steals on perimeter defense and IQ, blocks on size and interior defense. Shooting splits follow: a 0 jump shot never attempts a three, an elite one approaches 45% from deep, and free throws track jump shot and IQ.</p>
      <h3 id="nba-playoffs">Standings, play-in, playoffs</h3>
      <ul>
        <li>The other fourteen teams in your conference play their own 82 games from their ratings, and you are seeded by wins.</li>
        <li>Seeds 1–6 go straight in. Seeds 7–10 play the <b>play-in</b>: the 7 and 8 get two chances, the 9 and 10 need two straight wins, with a small edge or handicap on each game.</li>
        <li>Series are best of seven. Each game uses the <b>log5</b> formula between your win rate and the opponent's, stretched 12% so the better team wins more decisively, with a +4% playoff bump for you. The bracket is real: the other series in your half are simulated so your next opponent is whoever actually won.</li>
        <li>The Finals opponent is one of the other conference's elite teams with 52–64 wins.</li>
      </ul>
      <h3 id="nba-awards">Awards</h3>
      <p>MVP is scored as <b>2 × PPG + RPG + 1.5 × APG</b> against a pool of real candidates with MVP-level lines. Beat the best of them and it is yours; fall short and the vote becomes a lottery weighted by score to the power of 2.5, so a near miss still has a real chance. Defensive Player of the Year goes to a build of 80 or better averaging 2.8 blocks and 1.5 steals; otherwise the award goes to the league's rim protector.</p>
    </>
  )
}

// ── Modes ────────────────────────────────────────────────────────────────────
function ModesPage({ go }) {
  return (
    <>
      <h2 id="current">Current</h2>
      <p>Today's rosters, starters and backups, at real ratings. Ratings move through the season as players do; the <Link go={go} to="ratings">Ratings</Link> page shows every one of them with the date each pool last changed.</p>
      <h2 id="all-time">All-Time</h2>
      <p>Legends pools (four quarterbacks per franchise, with the greats of every position behind them) and peak-era franchises. The sims are tuned so All-Time plays a few points easier: a handful more wins and a better shot at a title with the same build.</p>
      <h2 id="salary-cap">Salary Cap <span className="wk-tag">DAILY · NBA</span></h2>
      <p>A five-column board (Finishing, Shooting, Defense, Playmaking, Size &amp; Athleticism) with five price tiers from $50 down to $10, priced strictly by rating. Pick one card per column under the day's budget (130–170, drawn from the date). One Shuffle re-deals a row or a column and one Scout reveals a hidden grade. Everyone plays the same board; the leaderboard ranks overall, then budget used. Infinite mode is for practice.</p>
      <h2 id="head-to-head">Head-to-Head</h2>
      <p>Build live against a friend by code or a random opponent. <b>Football:</b> both finished builds play a full season and the better record wins, overall breaking ties. <b>Basketball:</b> a live 1v1 to 11 on the court. Inside buckets count one, shots from the arc two; steals and blocks flip possession; your make rates come from finishing, handles, speed, jump shot, bounce and IQ (size, playmaking and finishing for bigs), with size and speed edges paying off inside. Drive or Shoot adjustments steer your shot selection at a 12% efficiency cost.</p>
      <h2 id="depth-chart">The Depth Chart <span className="wk-tag">MINI-GAME</span></h2>
      <p>Three real players, one hidden stat (passing touchdowns, passing or rushing yards for quarterbacks; rushing yards or touchdowns for backs; receiving yards or touchdowns for receivers), ten seconds to order them. Get it right and the streak grows; miss once and it ends. Best streaks go on two boards: all-time, and a weekly board that resets every Monday.</p>
      <h2 id="sandbox">Sandbox</h2>
      <p>Flip on Sandbox from the build screen and the game is yours to bend. <b>Custom Ratings</b> opens every player's grades on 0–11 sliders, one player at a time or everyone at once, with a toggle at the top to switch between current players and All-Time legends (it opens on whichever you're playing). You can drop any player straight into a slot of your build, and pick any team for the season. Sandbox seasons are yours to enjoy but never save, rank or count toward lifetime awards.</p>
      <h2 id="pro">BAP Pro <span className="wk-tag">SUBSCRIPTION</span></h2>
      <p>BAP Pro is an optional subscription. It removes ads across both games, unlocks colour themes for the site and custom profile icons, and puts a Pro badge next to your name on the leaderboards. It's managed from your profile page.</p>
      <h2 id="leaderboards">Leaderboards and profiles</h2>
      <ul>
        <li><b>Saving.</b> Sign in and every completed season is saved with its build, record, stats and awards. Sandbox seasons and guest seasons are not saved.</li>
        <li><b>Best Builds</b> lists saved seasons with an overall of 80 or better, ranked by overall and then by wins. <b>Worst Builds</b> does the opposite for everything under 80, because a 3–14 season deserves witnesses.</li>
        <li><b>Career</b> boards total your saved seasons: wins, titles and awards, and they are what the profile page shows.</li>
        <li><b>Share cards</b> render your finished build and season as an image you can post anywhere.</li>
      </ul>
    </>
  )
}

// ── Ratings ──────────────────────────────────────────────────────────────────
function RatingsPage({ query, pool }) {
  const counts = poolCounts()
  return (
    <>
      <p className="wk-lead">The full pools the spins draw from. The table reads the game's data files directly, so it changes whenever the ratings do; the dates are the last time each pool's file changed. Tap a column to sort. <b>Avg</b> is the plain average of a player's ratings.</p>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Pool</th><th className="num">Current</th><th className="num">All-time</th><th>Last changed</th></tr></thead>
          <tbody>{counts.map(c => <tr key={c.id}><td>{c.sport === 'nfl' ? 'NFL' : 'NBA'} · {c.label}</td><td className="num">{c.current}</td><td className="num">{c.legends}</td><td>{fmtDate(c.updated)}</td></tr>)}</tbody>
        </table>
      </div>
      <h2 id="table">All ratings</h2>
      <RatingsTable key={`${query}|${pool}`} initialQuery={query} initialPool={pool} />
      <p className="wk-hat" style={{ marginTop: 10 }}>Latest change across all pools: {fmtDate(RATINGS_DATES.all)}.</p>
    </>
  )
}

// ── Creators ─────────────────────────────────────────────────────────────────
const fmtViews = n => (n == null ? null : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M views` : n >= 1e3 ? `${Math.round(n / 1e3)}K views` : `${n} views`)
const fmtShort = s => (s ? new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null)
const PLAT = { youtube: 'YouTube', tiktok: 'TikTok', x: 'X' }
function YouTubeEmbed({ item }) {
  const [on, setOn] = useState(false)
  return (
    <div className={`wk-embed${item.short ? ' wk-embed--short' : ''}`}>
      {on ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${item.id}?autoplay=1&rel=0`} title={item.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" />
      ) : (
        <button type="button" className="wk-thumb" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${item.id}/hqdefault.jpg)` }} onClick={() => setOn(true)} aria-label={`Play ${item.title}`}>
          <span className="wk-play" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
        </button>
      )}
    </div>
  )
}
// Creators appear exactly as listed in data/creators.js: no sorting, no filters
function CreatorsPage() {
  const list = CREATORS
  const total = CREATORS.reduce((s, c) => s + c.items.length, 0)
  return (
    <>
      <p className="wk-lead">Creators who have built quarterbacks, bigs and running backs on Build-A-Player and Build-A-Bucket on camera: {total} videos and posts from {CREATORS.length} creators, current as of {CREATORS_AS_OF}. Videos play through YouTube's own embedded player and everything links to the creator; nothing is re-hosted.</p>
      <p className="wk-hat">Build-A-Player is not affiliated with any of these creators unless specified. Their videos, channels and opinions are their own.</p>
      {list.map(c => (
        <article key={c.id} className="wk-cr">
          <div className="wk-cr-head">
            <span className="wk-cr-avatar" aria-hidden="true">{c.name.slice(0, 1)}</span>
            <div>
              <div className="wk-cr-name"><a href={c.url} target="_blank" rel="noopener noreferrer">{c.name}</a></div>
              {c.blurb && <div className="wk-cr-sub">{c.blurb}</div>}
            </div>
            <div className="wk-cr-plats">{[...new Set(c.items.map(i => i.type))].map(p => <span key={p} className={`wk-plat wk-plat--${p}`}>{PLAT[p]}</span>)}</div>
          </div>
          {c.items.some(i => i.type === 'youtube') && (
            <div className="wk-cr-videos">
              {c.items.filter(i => i.type === 'youtube').map(i => (
                <div key={i.id} className="wk-cr-video">
                  <YouTubeEmbed item={i} />
                  <div className="wk-cr-title"><a href={`https://www.youtube.com/watch?v=${i.id}`} target="_blank" rel="noopener noreferrer">{i.title}</a></div>
                  <div className="wk-cr-meta">{[i.short ? 'Short' : null, fmtShort(i.date), fmtViews(i.views)].filter(Boolean).join(' · ')}</div>
                </div>
              ))}
            </div>
          )}
          {c.items.some(i => i.type !== 'youtube') && (
            <div className="wk-cr-links">
              {c.items.filter(i => i.type !== 'youtube').map(i => (
                <a key={i.url} className="wk-cr-link" href={i.url} target="_blank" rel="noopener noreferrer"><span className={`wk-plat wk-plat--${i.type}`}>{PLAT[i.type]}</span><span>{i.title}</span>{i.date && <small>{fmtShort(i.date)}</small>}</a>
              ))}
            </div>
          )}
        </article>
      ))}
      <h2 id="submit">Made a video?</h2>
      <div className="wk-notice">If you have played Build-A-Player or Build-A-Bucket on YouTube, TikTok, Twitch or anywhere else, send the link to <a href="mailto:buildaplayer@outlook.com">buildaplayer@outlook.com</a> or tag <a href="https://x.com/Build_A_Player" target="_blank" rel="noopener noreferrer">@Build_A_Player</a> and it goes on this page.</div>
    </>
  )
}

// ── Behind the scenes ────────────────────────────────────────────────────────
function BehindPage() {
  return (
    <>
      <h2 id="ratings-from">Where the ratings come from</h2>
      <p>Every rating is set by hand on the 0–11 scale, position by position, with anchors at the top: Dan Marino's arm is an 11, Tom Brady's processing and leadership are 11s, and current players are graded against those same posts. Current rosters are updated through the season; All-Time pools are curated per franchise. Team grades are calibrated to real results: the NFL's 1–10 offense and defense grades, the NBA's ratings out of 100 fitted to the 2025–26 standings.</p>
      <h2 id="random">How random the game is</h2>
      <p>Spins are random, but the daily Salary Cap board is <b>seeded</b> from the date, so everyone plays the same board on the same day. Seasons are Monte Carlo: hundreds of individual coin flips at the probabilities on the <a href="/wiki/seasons">Seasons</a> page, which is why the same build can go 13–4 and 9–8 on different days. The engines never fudge a result after the fact; the stories, awards and box scores are read from what the dice produced.</p>
      <h2 id="stack">What it runs on</h2>
      <p>Build-A-Player is a React app built with Vite, served from Cloudflare Pages, with accounts, saves, leaderboards and the live Head-to-Head rooms on Supabase. It is an independent fan project with no affiliation to the NFL, the NBA, their teams or players.</p>
    </>
  )
}

export const PAGES = [
  { slug: 'main', title: 'Main Page', heading: 'Build-A-Player Wiki', description: 'How Build-A-Player and Build-A-Bucket work: spins, ratings, overall formulas, season simulation, modes, every player rating, and the creators who play.', Component: MainPage,
    toc: [['start', 'Start here'], ['two-games', 'The two games'], ['numbers', 'By the numbers']] },
  { slug: 'gameplay', title: 'Gameplay', description: 'Spins, chips and respins, the 0–11 rating scale, positions and attributes, and the exact overall formulas and weights per position.', Component: GameplayPage,
    toc: [['spinning', 'Spinning', 'spin reel respin team player chips tap'], ['scale', 'The 0–11 scale', 'grades letter F S rating scale'], ['positions', 'Positions and attributes', 'QB RB WR TE DB guard big attributes'], ['overall', 'Overall rating', 'OVR formula weights weighted average balance bonus'], ['overall-nfl', 'Football overall', 'OVR formula'], ['overall-nba', 'Basketball overall', 'OVR formula'], ['archetypes', 'Archetypes', 'gunslinger dual threat franchise cornerstone']] },
  { slug: 'seasons', title: 'Seasons', description: 'How an NFL or NBA season is simulated: team grades, schedules, win chances, stats, playoffs, the Super Bowl, the play-in and awards.', Component: SeasonsPage,
    toc: [['nfl', 'NFL season', 'simulate football'], ['nfl-team', 'Your team matters', 'team offense defense grade'], ['nfl-schedule', 'The schedule', '17 games weather'], ['nfl-winning', 'Win chance', 'win probability stats passing yards'], ['nfl-playoffs', 'NFL playoffs', 'bye wild card super bowl overtime'], ['nfl-awards', 'NFL awards', 'MVP OPOY DPOY'], ['nba', 'NBA season', 'simulate basketball 82 games'], ['nba-team', 'Team strength', 'ratings out of 100'], ['nba-boost', 'Your boost', 'OVR boost win chance'], ['nba-stats', 'Your numbers', 'PPG RPG APG shooting'], ['nba-playoffs', 'Play-in and playoffs', 'seed log5 best of seven finals'], ['nba-awards', 'NBA awards', 'MVP DPOY']] },
  { slug: 'modes', title: 'Modes', description: 'Current, All-Time, Salary Cap, Head-to-Head, the Depth Chart mini-game, Sandbox, BAP Pro, and leaderboards.', Component: ModesPage,
    toc: [['current', 'Current'], ['all-time', 'All-Time', 'legends'], ['salary-cap', 'Salary Cap', 'daily budget board shuffle scout'], ['head-to-head', 'Head-to-Head', 'versus 1v1 live'], ['depth-chart', 'The Depth Chart', 'mini game streak'], ['sandbox', 'Sandbox', 'custom ratings edit grades any team'], ['pro', 'BAP Pro', 'subscription pro no ads themes profile icons badge plus'], ['leaderboards', 'Leaderboards and profiles', 'best builds worst builds career save']] },
  { slug: 'ratings', title: 'Ratings', description: 'Every player rating in Build-A-Player and Build-A-Bucket, current and all-time, sortable and searchable, with the date each pool last changed.', Component: RatingsPage,
    toc: [['table', 'All ratings', 'players table search sort']] },
  { slug: 'creators', title: 'Creators', description: 'YouTubers, podcasters and TikTok creators who have played Build-A-Player and Build-A-Bucket, with their videos and shorts.', Component: CreatorsPage,
    toc: [['submit', 'Made a video?', 'submit creator youtube tiktok']] },
  { slug: 'behind-the-scenes', title: 'Behind the scenes', description: 'Where the ratings come from, how random the game is, and what Build-A-Player runs on.', Component: BehindPage,
    toc: [['ratings-from', 'Where the ratings come from', 'anchors Marino Brady'], ['random', 'How random the game is', 'seeded Monte Carlo dice'], ['stack', 'What it runs on', 'React Vite Cloudflare Supabase']] },
]

export const SEARCH_INDEX = PAGES.flatMap(p => [
  { slug: p.slug, anchor: null, label: p.title, page: p.title, keywords: p.description },
  ...p.toc.map(([id, label, keywords = '']) => ({ slug: p.slug, anchor: id, label, page: p.title, keywords })),
])
export { POOLS }
