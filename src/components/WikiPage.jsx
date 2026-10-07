import { Helmet } from 'react-helmet-async'
import RatingsTable, { RATINGS_AS_OF } from './RatingsTable'

// The Wiki: every mode and every mechanic in Build-A-Player and Build-A-Bucket,
// written from the engines themselves (src/utils/simulation.js and
// bucketSimulation.js), a look behind the scenes, and every rating in the game.

const GRADES = [['F', 0], ['D', 1], ['C-', 2], ['C', 3], ['C+', 4], ['B-', 5], ['B', 6], ['B+', 7], ['A-', 8], ['A', 9], ['A+', 10], ['S', 11]]
const gradeColor = v => (v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444')

const SECTIONS = [
  ['build', 'The build'], ['ovr', 'Overall rating'], ['nfl', 'NFL seasons'], ['nba', 'NBA seasons'],
  ['modes', 'Modes'], ['leaderboards', 'Leaderboards'], ['behind', 'Behind the scenes'], ['ratings', 'All ratings'],
]

const QB_W = [['Accuracy', 17], ['Processing', 16], ['Arm', 15], ['Legs', 15], ['Playmaking', 10], ['Vision', 9], ['Pocket presence', 7], ['Size', 7], ['Leadership', 4]]
const RB_W = [['Elusiveness', 15], ['Speed', 14], ['Burst', 14], ['Strength', 14], ['Balance', 13], ['Vision', 12], ['Size', 11], ['Hands', 11], ['Carrying', 5]]
const WR_W = [['Hands', 14], ['Route running', 14], ['Speed', 14], ['Size', 14], ['Awareness', 10], ['After the catch', 10], ['Body control', 8], ['Vertical', 8], ['Release', 8]]
const TE_W = [['Hands', 16], ['Route running', 15], ['Size', 12], ['Awareness', 11], ['After the catch', 11], ['Blocking', 9], ['Strength', 9], ['Vertical', 9], ['Speed', 8]]
const DB_W = [['Fluidity', 14], ['Man coverage', 14], ['Speed', 13], ['Play recognition', 13], ['Zone IQ', 12], ['Press', 11], ['Hands', 10], ['Run support', 7], ['Size', 6]]
const G_W = [['Jump shot', 14], ['Speed', 14], ['Size', 14], ['Finishing', 14], ['Basketball IQ', 14], ['Passing', 8], ['Handles', 8], ['Perimeter defense', 8], ['Bounce', 4], ['Clutch', 2]]
const B_W = [['Finishing', 15], ['Size', 15], ['Interior defense', 15], ['Rebounding', 15], ['Jump shot', 9], ['Bounce', 7], ['Playmaking', 7], ['Basketball IQ', 7], ['Speed', 7], ['Clutch', 3]]

const Weights = ({ title, rows }) => (
  <div className="wiki-card">
    <h4>{title}</h4>
    <div className="wiki-table-wrap">
      <table className="wiki-table"><tbody>
        {rows.map(([k, w]) => <tr key={k}><td>{k}</td><td style={{ textAlign: 'right' }}>{w}%</td></tr>)}
      </tbody></table>
    </div>
  </div>
)

export default function WikiPage({ onBack, onCreators }) {
  return (
    <div className="about-page wiki-page">
      <Helmet>
        <title>Wiki — How Build-A-Player works</title>
        <meta name="description" content="Every mode and every mechanic in Build-A-Player and Build-A-Bucket: spins, the 1–11 rating scale, how your overall is scored, how seasons and playoffs are simulated, Salary Cap, Head-to-Head, the Depth Chart, leaderboards, and every player rating in the game." />
        <link rel="canonical" href="https://build-a-player.com/wiki" />
      </Helmet>
      <div className="about-inner wiki-inner">
        <button className="prf-top-back" onClick={onBack}>← Back to Game</button>

        <header className="wiki-head">
          <span className="about-section-title">BUILD-A-PLAYER WIKI</span>
          <h1 className="wiki-title">How everything works</h1>
          <p className="wiki-p">Every mode and every mechanic in Build-A-Player and Build-A-Bucket, from the first spin to the ring, written from the game's own engines. Then a look behind the curtain, and every rating in the game as of <b>{RATINGS_AS_OF}</b>.</p>
          <nav className="wiki-toc" aria-label="Sections">
            {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
            {onCreators && <a href="/creators" onClick={e => { e.preventDefault(); onCreators() }}>Creators ↗</a>}
          </nav>
        </header>

        {/* ── The build ─────────────────────────────────────────────────── */}
        <section id="build" className="wiki-section">
          <h2 className="wiki-h2">The build</h2>
          <p className="wiki-p">A build is one player made from pieces of many. Every spin lands you on a <b>real player</b>, and you keep exactly <b>one</b> part of his game. Do that for every slot on the body and you have a complete player with an overall rating, an archetype, and a season to play.</p>
          <h3 className="wiki-h3">Spinning</h3>
          <ul className="wiki-ul">
            <li><b>Two reels.</b> The first reel stops on a team; the second stops on one of that team's players at your position. Teams you have already drawn in this build are skipped, so you see the whole league before anyone repeats.</li>
            <li><b>Chips.</b> The player's ratings appear as chips, one per attribute. Tap a chip (or drag it onto the matching spot on the silhouette) to lock that rating into your build. The chip carries the player's name, number, team colours and headshot, which is why finished builds look the way they do.</li>
            <li><b>One attribute per spin.</b> Everything else about that player is gone once you pick. Football builds have <b>nine</b> slots; basketball builds have <b>ten</b>.</li>
            <li><b>Respins.</b> Each spin gives you one team respin and one player respin (tight ends get two player respins in Current mode). A respin for a new player never shows you the same player twice.</li>
            <li><b>Bench players spin too.</b> Backups are in the pool with their real ratings, which is where the hard choices come from.</li>
          </ul>
          <h3 className="wiki-h3">The 1–11 scale</h3>
          <p className="wiki-p">Every attribute is rated from 0 to 11 and shown as a letter. S is reserved for the very best in the league at that one thing.</p>
          <div className="wiki-grades">{GRADES.map(([g, v]) => <span key={g} className="wiki-grade" style={{ '--g': gradeColor(v) }}><b>{g}</b><small>{v}</small></span>)}</div>
          <h3 className="wiki-h3">Positions and attributes</h3>
          <div className="wiki-table-wrap">
            <table className="wiki-table">
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
          <p className="wiki-note">The attribute pills above the silhouette group these into categories (physical, mental, skill). Hide grades in the menu if you want to draft on instinct.</p>
        </section>

        {/* ── Overall ───────────────────────────────────────────────────── */}
        <section id="ovr" className="wiki-section">
          <h2 className="wiki-h2">Overall rating</h2>
          <p className="wiki-p">Your overall is a <b>weighted average</b> of the ratings you locked in, not a plain mean. Each position weights the things that actually win games, and the football formula rewards balance on top.</p>
          <h3 className="wiki-h3">Football</h3>
          <code className="wiki-formula">{`avg  = weighted average of your nine ratings (weights below)
base = 58 + 2.2 × avg + 0.24 × avg²
bonus: spread between best and worst ≤ 1 → +3   ≤ 2 → +1.5   ≤ 3 → +0.5
       lowest rating ≥ 9 → +2.5   ≥ 8 → +0.8
OVR  = min(99, round(base + bonus))`}</code>
          <p className="wiki-p">A build of all 5s (straight B-minuses) scores a 75. All 8s score 93 before the balance bonus. Nine S ratings hit the 99 cap. The bonus only applies to complete builds, and a single F cancels it.</p>
          <div className="wiki-grid">
            <Weights title="Quarterback" rows={QB_W} />
            <Weights title="Running back" rows={RB_W} />
            <Weights title="Wide receiver" rows={WR_W} />
            <Weights title="Tight end" rows={TE_W} />
            <Weights title="Defensive back" rows={DB_W} />
          </div>
          <h3 className="wiki-h3">Basketball</h3>
          <code className="wiki-formula">{`avg = weighted average of your ten ratings
OVR = min(99, round(57 + (avg − 1) / 9 × 44))`}</code>
          <p className="wiki-p">That maps a build of all 1s to 57 and all 10s to 99. Guards are scored on five big things (jump shot, speed, size, finishing, IQ) with passing, handles and perimeter defense behind them; bigs live on finishing, size, interior defense and rebounding.</p>
          <div className="wiki-grid">
            <Weights title="Guard" rows={G_W} />
            <Weights title="Big" rows={B_W} />
          </div>
          <h3 className="wiki-h3">Archetypes</h3>
          <p className="wiki-p">The name under your overall comes from the overall tier and your two strongest traits. A 90+ quarterback whose best traits are legs and arm is an <b>Elite Dual Threat</b>; arm and accuracy make a <b>Gunslinger</b>; a tight spread across the board is a <b>Franchise Cornerstone</b>. At 95+ two 10-or-better ratings in arm and legs read <b>Once-in-a-Generation Talent</b>. Below 68 the names get honest: <b>Raw Talent</b>, <b>One-Trick Pony</b>, <b>Clipboard Manager</b>, <b>Practice Squad Arm</b>.</p>
        </section>

        {/* ── NFL seasons ───────────────────────────────────────────────── */}
        <section id="nfl" className="wiki-section">
          <h2 className="wiki-h2">Simulating an NFL season</h2>
          <p className="wiki-p">When the build is complete you spin for (or pick) a team, and the season runs game by game. Each position has its own engine written the same way: your attributes set a per-game win chance and a set of stat baselines, the team you land on pushes both, and every game adds variance.</p>
          <h3 className="wiki-h3">Your team matters</h3>
          <p className="wiki-p">Every NFL team carries an <b>offense</b> and a <b>defense</b> grade from 1 to 10, where 5 is league average. Those grades feed your win chance (defense slightly more than offense), your supporting-cast stats, and how often you get sacked. In All-Time mode the franchises use their historical-peak grades, and the opponent's grades count at full weight instead of 60%.</p>
          <h3 className="wiki-h3">The schedule</h3>
          <p className="wiki-p">Seventeen games built like the real league: six divisional games (each rival twice), four against each of two same-conference divisions, four against a cross-conference division, and three flex games, shuffled with nine home dates and eight on the road. Cold-weather outdoor stadiums see bad weather in about 18% of games, which trims completions and yards.</p>
          <h3 className="wiki-h3">Winning (quarterback example)</h3>
          <code className="wiki-formula">{`win chance = 22%
  + accuracy × 11%  + processing × 10%  + vision × 9%
  + arm × 7%  + pocket presence × 7%  + playmaking × 5%  + legs × 4%
  + leadership × 3%  + size × 2%
  + team offense × 5.5%  + team defense × 6.5%
  − penalty for an overall under 80 (steeper under 75, 70 and 67)
clamped between 15% and 84%        (attributes count as rating ÷ 11)`}</code>
          <p className="wiki-p">Stats come from the same ratings. A quarterback's passing yards per game start at 138 and climb with arm (up to +65), accuracy (+45), vision (+24), pocket presence (+14), playmaking (+10) and the team's offense (+16). Completion percentage is mostly accuracy; touchdown rate is accuracy, vision and processing; interceptions fall with processing first. Rushing yards are almost entirely legs. Scores are snapped to real football numbers (sevens and threes) and the game log, best game and season totals are kept for the report.</p>
          <h3 className="wiki-h3">Playoffs</h3>
          <ul className="wiki-ul">
            <li><b>Getting in.</b> Ten wins makes the playoffs. Nine wins is a coin flip; eight wins gets in about 6% of the time.</li>
            <li><b>The bye.</b> Fourteen wins earns a first-round bye; thirteen wins earns one 60% of the time. With a bye you need three playoff wins for the title instead of four.</li>
            <li><b>Each game.</b> A playoff game starts at 30% and moves with your overall (up to about +61% of a scale that treats 97 as elite) and the gap between your team and the opponent's (±41%), plus 3% for home field. Opponents come from each conference's contender pool, never your own team, and the Super Bowl opponent from the other conference's elite.</li>
            <li><b>Weather and overtime.</b> Cold-weather hosts bring snow or rain that lowers scoring; close matchups go to overtime about one game in five.</li>
          </ul>
          <h3 className="wiki-h3">Awards</h3>
          <p className="wiki-p">MVP voting is about production. Combined touchdowns are the biggest factor (50 or more adds 52%, 30 is the floor to be considered at all), total yards next (5,500 adds 32%), then overall, wins, a playoff berth and a Super Bowl. Fewer than ten wins and you are out of the race; All-Time seasons are judged 20% harder, and nobody is ever more than a 90% lock. Lose the vote and a real MVP-calibre player takes it with a stat line built to top yours. Running backs, receivers and tight ends chase Offensive Player of the Year on the same principle; defensive backs chase Defensive Player of the Year.</p>
        </section>

        {/* ── NBA seasons ───────────────────────────────────────────────── */}
        <section id="nba" className="wiki-section">
          <h2 className="wiki-h2">Simulating an NBA season</h2>
          <p className="wiki-p">Build-A-Bucket plays 82 games, the play-in, and four best-of-seven rounds. Here your team's strength sets the baseline and your build moves it; in All-Time mode you are one star among legends, so the team counts for more.</p>
          <h3 className="wiki-h3">Team strength</h3>
          <p className="wiki-p">Every team has an offense and a defense rating out of 100, calibrated to the 2025–26 standings (the Thunder and Spurs at the top, the Wizards and Pacers at the bottom). The average of the two becomes a baseline win rate between 13% and 77%. All-Time teams use their peak eras: the 73-win Warriors' offense, the Russell and Bird Celtics' defense, the Jordan Bulls.</p>
          <h3 className="wiki-h3">Your boost</h3>
          <code className="wiki-formula">{`delta = (OVR − 82) / 17
boost = delta ≥ 0 ? min(+20%, delta × 20%) : max(−10%, delta × 10%)
All-Time: boost × 0.45, capped at +9% / −5%
win chance = team baseline + boost, clamped 12% – 87% (All-Time 91%)`}</code>
          <p className="wiki-p">An 82 build adds nothing. A 99 adds the full 20 points. Below 82 the penalty is gentler than the reward. Then 82 games are played one at a time at that chance, each with a realistic score and your line for the night.</p>
          <h3 className="wiki-h3">Your numbers</h3>
          <p className="wiki-p">Per-game averages come from composites of your ratings. A guard's scoring is jump shot (32%), finishing (24%), speed (18%), size (12%), handles and clutch; a big's is finishing (50%), jump shot (25%), playmaking and clutch. Rebounding leans on size and bounce, assists on passing or playmaking plus IQ, steals on perimeter defense and IQ, blocks on size and interior defense. Shooting splits follow: a 0 jump shot never attempts a three, an elite one approaches 45% from deep, and free throws track jump shot and IQ.</p>
          <h3 className="wiki-h3">Standings, play-in, playoffs</h3>
          <ul className="wiki-ul">
            <li>The other fourteen teams in your conference play their own 82 games from their ratings, and you are seeded by wins.</li>
            <li>Seeds 1–6 go straight in. Seeds 7–10 play the <b>play-in</b>: the 7 and 8 get two chances, the 9 and 10 need two straight wins, with a small edge or handicap on each game.</li>
            <li>Series are best of seven. Each game uses the <b>log5</b> formula between your win rate and the opponent's, stretched 12% so the better team wins more decisively, with a +4% playoff bump for you. The bracket is real: the other series in your half are simulated so your next opponent is whoever actually won.</li>
            <li>The Finals opponent is one of the other conference's elite teams with 52–64 wins.</li>
          </ul>
          <h3 className="wiki-h3">Awards</h3>
          <p className="wiki-p">MVP is scored as <b>2 × PPG + RPG + 1.5 × APG</b> against a pool of real candidates with MVP-level lines. Beat the best of them and it is yours; fall short and the vote becomes a lottery weighted by score to the power of 2.5, so a near miss still has a real chance. Defensive Player of the Year goes to a build of 80 or better averaging 2.8 blocks and 1.5 steals; otherwise the award goes to the league's rim protector.</p>
        </section>

        {/* ── Modes ─────────────────────────────────────────────────────── */}
        <section id="modes" className="wiki-section">
          <h2 className="wiki-h2">Modes</h2>
          <div className="wiki-grid">
            <div className="wiki-card"><h4>Current</h4><p>Today's rosters, starters and backups. Ratings move through the season as players do; the table at the bottom of this page shows every one of them with its date.</p></div>
            <div className="wiki-card"><h4>All-Time</h4><p>Legends pools (four quarterbacks per franchise, with the greats of every position behind them) and peak-era franchises. The sims are tuned so All-Time plays a few points easier: a handful more wins and a better shot at a title with the same build.</p></div>
            <div className="wiki-card"><h4>Salary Cap <span className="wiki-tag">DAILY · NBA</span></h4><p>A five-column board (Finishing, Shooting, Defense, Playmaking, Size &amp; Athleticism) with five price tiers from $50 down to $10, priced strictly by rating. Pick one card per column under the day's budget (130–170, drawn from the date). One Shuffle re-deals a row or a column and one Scout reveals a hidden grade. Everyone plays the same board; the leaderboard ranks overall, then budget used. Infinite mode is for practice.</p></div>
            <div className="wiki-card"><h4>Head-to-Head</h4><p>Build live against a friend by code or a random opponent. Football: both finished builds play a full season and the better record wins, overall breaking ties. Basketball: a live 1v1 to 11 on the court. Inside buckets count one, shots from the arc two; steals and blocks flip possession; your make rates come from finishing, handles, speed, jump shot, bounce and IQ (size, playmaking and finishing for bigs), with size and speed edges paying off inside. Drive or Shoot adjustments steer your shot selection at a 12% efficiency cost.</p></div>
            <div className="wiki-card"><h4>The Depth Chart <span className="wiki-tag">MINI-GAME</span></h4><p>Three real players, one hidden stat (passing touchdowns, passing or rushing yards for quarterbacks; rushing yards or touchdowns for backs; receiving yards or touchdowns for receivers), ten seconds to order them. Get it right and the streak grows; miss once and it ends. Best streaks go on the board.</p></div>
            <div className="wiki-card"><h4>Sandbox <span className="wiki-tag">PLUS</span></h4><p>Customise ratings and build whatever you want. Sandbox seasons are yours to enjoy but never save, rank or count toward lifetime awards. PLUS also removes ads and adds colour themes, profile icons and a badge on the leaderboard.</p></div>
            <div className="wiki-card"><h4>In the app <span className="wiki-tag">iOS · ANDROID</span></h4><p>The app adds a Daily Challenge with the same spins for everyone, seasons you steer at key moments, cards and XP, TAKEOVER (a road across the map against progressively better real players) and BLACKTOP (live 3v3 with team chat).</p></div>
          </div>
        </section>

        {/* ── Leaderboards ──────────────────────────────────────────────── */}
        <section id="leaderboards" className="wiki-section">
          <h2 className="wiki-h2">Leaderboards and profiles</h2>
          <ul className="wiki-ul">
            <li><b>Saving.</b> Sign in and every completed season is saved with its build, record, stats and awards. Sandbox seasons and guest seasons are not saved.</li>
            <li><b>Best Builds</b> lists saved seasons with an overall of 80 or better, ranked by overall and then by wins. <b>Worst Builds</b> does the opposite for everything under 80, because a 3–14 season deserves witnesses.</li>
            <li><b>Career</b> boards total your saved seasons: wins, titles and awards, and they are what the profile page shows.</li>
            <li><b>Share cards</b> render your finished build and season as an image you can post anywhere.</li>
          </ul>
        </section>

        {/* ── Behind the scenes ─────────────────────────────────────────── */}
        <section id="behind" className="wiki-section">
          <h2 className="wiki-h2">Behind the scenes</h2>
          <h3 className="wiki-h3">Where the ratings come from</h3>
          <p className="wiki-p">Every rating is set by hand on the 0–11 scale, position by position, with anchors at the top: Dan Marino's arm is an 11, Tom Brady's processing and leadership are 11s, Randall Cunningham's legs are an 11, and current players are graded against those same posts. The current rosters are updated through the season; All-Time pools are curated per franchise. Team grades are calibrated to real results: the NFL's 1–10 offense and defense grades, the NBA's ratings out of 100 fitted to the 2025–26 standings.</p>
          <h3 className="wiki-h3">How random the game is</h3>
          <p className="wiki-p">Spins are random, but the daily boards and challenges are <b>seeded</b> from the date so every player faces the same spins, and live games are seeded from the room so both phones play back the identical game. Seasons are Monte Carlo: hundreds of individual coin flips at the probabilities above, which is why the same build can go 13–4 and 9–8 on different days. The engines never fudge a result after the fact; the stories, awards and box scores are read from what the dice produced.</p>
          <h3 className="wiki-h3">The stack</h3>
          <p className="wiki-p">Build-A-Player is a React app built with Vite, served from Cloudflare Pages, with accounts, saves, leaderboards and the live Head-to-Head rooms on Supabase. The player pools, team grades and headshot references are plain data files, which is how a ratings change can ship the same day. It is an independent fan project with no affiliation to the NFL, the NBA, their teams or players.</p>
        </section>

        {/* ── Ratings ───────────────────────────────────────────────────── */}
        <section id="ratings" className="wiki-section">
          <h2 className="wiki-h2">Every rating in the game</h2>
          <p className="wiki-p">The full pools the spins draw from, as of <b>{RATINGS_AS_OF}</b>. Tap a column to sort; AVG is the plain average of a player's ratings and OVR is what a build made entirely of that player would score.</p>
          <RatingsTable />
        </section>

        <div className="about-footer-links">
          <a className="about-text-link" href="/?about">About</a>
          <span style={{ color: 'var(--text-muted, #666)', margin: '0 8px' }}>·</span>
          <a className="about-text-link" href="/creators" onClick={e => { if (onCreators) { e.preventDefault(); onCreators() } }}>Creators</a>
          <span style={{ color: 'var(--text-muted, #666)', margin: '0 8px' }}>·</span>
          <a className="about-text-link" href="/privacy">Privacy Policy</a>
        </div>
      </div>
    </div>
  )
}
