import { Link, useMods, Loading, andList, word, Word, pct, n0 } from './wikiBits'
import { CAPS, POSITIONS } from '../../lib/squad'
import { K_LIVE } from '../../lib/kLive'

// Franchise (FRANCHISE_LIVE): football's GM mode. The numbers come from its engine (lib/franchise2), loaded with
// this page only.
const MODS = [
  ['fr-draft', () => import('../../lib/franchise2/draft')],
  ['fr-contracts', () => import('../../lib/franchise2/contracts')],
  ['fr-market', () => import('../../lib/franchise2/market')],
  ['fr-deals', () => import('../../lib/franchise2/deals')],
  ['fr-coach', () => import('../../lib/franchise2/coach')],
  ['fr-carousel', () => import('../../lib/franchise2/carousel')],
  ['fr-season', () => import('../../lib/franchise2/season')],
  ['fr-injury', () => import('../../lib/franchise2/injury')],
  ['fr-index', () => import('../../lib/franchise2/index')],
  ['fr-standings', () => import('../../lib/franchise2/standings')],
]
// (components/franchise2/Setup.jsx MAX_BUILDS: the screen keeps it; reading it here would load the screen and its CSS)
const MAX_BUILDS = 8
const cap = s => s.charAt(0) + s.slice(1).toLowerCase()

export function FranchisePage({ go }) {
  const got = useMods(MODS)
  if (!got) return <Loading />
  const [D, K, M, De, Co, Ca, Se, In, Ix, St] = got
  const styles = Object.values(Co.STYLES)
  const posCaps = [...Object.entries(CAPS.nfl).filter(([p]) => POSITIONS.nfl.includes(p)).map(([p, n]) => `${n} ${p.toUpperCase()}`), ...(K_LIVE ? ['1 K'] : [])]
  return (
    <>
      <p className="wk-lead"><b>Franchise</b> puts the player in charge of a real NFL team as its general manager and head coach. He builds his own players on the game's build screen, builds his coach, and runs the team season after season: the games, the depth chart, the salary cap, the draft and the coaching staff. Each device keeps {word(Ix.SLOTS_N)} franchise saves.</p>

      <h2 id="setup">Setting up</h2>
      <ol>
        <li><b>The team.</b> The 32 teams by division. Each card shows last season, the team's overall, its real head coach and its best players.</li>
        <li><b>The players.</b> Up to {MAX_BUILDS} of his own players, each built on the normal build screen, named and given a number and a drawn face. They join as rookies on the rookie wage scale, priced by their overall. Most per position: {andList(posCaps)}.</li>
        <li><b>The coach.</b> Built like a player: the wheel lands on one of the league's real head coaches, and the player keeps one of his five ratings ({andList(Co.CTYPES.map(t => cap(Co.CLABEL[t])))}). Five spins fill the five lines, with {word(Co.RESPINS)} respin. Then a coaching style, a name and a face.</li>
        <li><b>The hire.</b> The coach card, and the first season starts.</li>
      </ol>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Coach style</th><th>What it does</th></tr></thead>
          <tbody>{styles.map(s => <tr key={s.name}><td>{s.name}</td><td>{cap(s.fx)}</td></tr>)}</tbody>
        </table>
      </div>
      <p>Coaches are shown with letter grades only, never an overall number.</p>

      <h2 id="season">The season</h2>
      <ul>
        <li><b>The hub</b> leads with the week's game and its button. Its tabs hold the team, the league (standings, leaders, the wire, scores) and the franchise's history.</li>
        <li><b>The schedule</b> is the NFL's shape: 17 games and a bye over {Se.REG_WEEKS} weeks. The playoffs take seven teams a conference: {andList(St.ROUNDS.map(r => r.split(' ').map(cap).join(' ')))}.</li>
        <li><b>Events.</b> Some weeks bring a card with two answers: a player who wants more targets, a young player pushing for a starting job, an extension, a trade call (only before the deadline after Week {Se.TRADE_DEADLINE}). Each answer shows what it does, usually to <b>chemistry</b>, which gives the team a small lift in every game.</li>
        <li><b>Injuries</b> follow the NFL's real numbers by position, at {pct(In.QOL)} of the real rate. Real injuries keep their usual time out; four games or more is injured reserve, and a torn ACL can run into next season. The player's own builds can get hurt too.</li>
        <li><b>The depth chart</b> is two deep at every spot. Tap a player to move him; the next healthy man plays when someone is hurt.</li>
      </ul>

      <h2 id="game-day">Game day</h2>
      <p>The player's game plays like a broadcast: the scorebug, the field with the down and distance, the play-by-play, the scoring and the box score. Speed can be set to slow, normal or fast, paused, or skipped to the final.</p>
      <ul>
        <li><b>Key moments</b> are snaps inside the real game. On offense the player calls the play and runs it as a mini game; on defense he plays the linebacker. The game goes on from whatever that snap did. The Key Moments switch picks Advanced, Simple or None.</li>
        <li><b>The final</b> shows the score by quarter, a headline, the builds' lines and the full box score for both teams.</li>
        <li><b>Kickers.</b> Every team carries one kicker{K_LIVE ? ', and a build can be one' : ''}. His power, accuracy and clutch ratings decide his field goals and how far out his coach sends him.</li>
      </ul>

      <h2 id="staff">Coaches and play-callers</h2>
      <p>Every team starts with its real head coach and coordinators. Whoever calls a side's plays uses his play-calling grade for that side. The head coach can call his own side or hand it to the coordinator; the one not calling the plays gets +{Co.FREE_SIT} to situational awareness, the game management late in close games. Talent development helps young players grow, and culture builds chemistry.</p>
      <h3 id="black-monday">Black Monday</h3>
      <p>The offseason opens with the coaching carousel. Teams fire head coaches after bad or disappointing seasons, and the player makes his own calls the same day: keep or fire his offensive and defensive coordinators. Then the hiring: he interviews up to {word(Ca.IV_N)} candidates for each opening and makes an offer, and a candidate with more than one offer picks the best job for him. Coaches age, get better or worse with their units, and retire.</p>

      <h2 id="cap">Contracts and the cap</h2>
      <ul>
        <li><b>The cap</b> is the real one: ${K.capOf(2026)}M in 2026, about 5% more each year after. Every contract's cap hit, dead money and the rest of the {K.ROSTER_FULL}-man roster count against it. A player can only be signed if his cap hit fits.</li>
        <li><b>Real deals.</b> Real players start on their real contracts: cap hit and years left.</li>
        <li><b>Cutting</b> a player takes his cap hit off, but the signing bonus still owed counts as dead money.</li>
        <li><b>Rookies</b> sign the rookie wage scale by draft slot: four years, and a first-round pick has a fifth-year option.</li>
      </ul>

      <h2 id="re-sign">Re-signing</h2>
      <p>When a deal runs out, the player negotiates: years (up to {De.MAX_YEARS}), money a year and how much of it comes as a signing bonus ({andList(De.BONUS.map(([n]) => cap(n)))}). The agent opens high and has a number he'll take. An offer at that number is accepted; a real offer brings a counter; a lowball costs two rounds of patience. When patience runs out, the player tests free agency. A build never walks: he gives his final number instead. Once a year the team can use the <b>franchise tag</b> instead (one year at the average of the top five at his position).</p>

      <h2 id="free-agency">Free agency</h2>
      <p>{Word(M.FA_DAYS)} days. The whole market is on the board, with filters and sorts. The player makes offers (years, money and bonus), and can raise or pull them until the day ends; offers out count against his cap room. Other teams bid too. When the day ends each free agent picks a team: the money first, then a winner, a starting job, and the head coach. With a Recruiter coach, free agents give the team a closer look.</p>

      <h2 id="scouting">Scouting and the draft</h2>
      <ul>
        <li><b>The class</b> is made when the season starts: about 300 college players at real schools, each with ratings, a combine and a character. His true ratings and where he's headed are hidden.</li>
        <li><b>Scouting.</b> The scouts get {word(D.PER_WEEK({ coach: {} }))} assignments a week ({word(D.PER_WEEK({ coach: { style: 'recruiter' } }))} with a Recruiter), banked until used: film on one prospect, a college game, the Senior Bowl, then the combine and pro days in the spring ({D.SPRING} more assignments), and the NFL's {D.VISITS} pre-draft visits, which reveal a prospect's character. Every rating is unknown, narrowed or known.</li>
        <li><b>The board.</b> The class sorts by the media's big board, the team's own grade (scouted players first) or position. The media and the other teams get prospects a little wrong. A <b>{D.TAG_TEXT.G}</b> is a player the consensus had too low, a <b>{D.TAG_TEXT.B}</b> one it had too high; nobody knows until the cards are turned over after the draft.</li>
        <li><b>Draft night.</b> {Word(D.ROUNDS_N)} rounds in the real order, with trades. Late bloomers exist: about one 90+ player a class that the whole league misses.</li>
        <li><b>Sandbox</b> (a Shop unlock) adds <b>Add a prospect</b> in draft week: a build made on the build screen joins the class.</li>
      </ul>

      <h2 id="potential">Potential and growth</h2>
      <p>Every player has a hidden potential: the overall he's headed for. Screens show it the way a scout would say it, a ceiling ("Pro Bowl ceiling") and where he is on the way ("still developing", "near his ceiling", "in his prime", "past his peak"). The team's own players are read closely; other teams' players and prospects less so. Each offseason a player grows toward it by his age curve, his playing time, how his season went, his coaches and a little luck. Backs peak first and fall fastest; quarterbacks peak last.</p>

      <h2 id="awards">Awards and history</h2>
      <p>Each season ends with the NFL's awards and All-Pro teams, read from the real stat lines: MVP, Offensive and Defensive Player of the Year, the two Rookie of the Year awards, and Coach of the Year. The History tab keeps every season, the titles and the builds' careers.</p>
      <p className="wk-hat">See also <Link go={go} to="career">Career</Link> for one player's road, and <Link go={go} to="modes" hash="sandbox">Modes § Sandbox</Link>.</p>
    </>
  )
}
export const FRANCHISE_TOC = [
  ['setup', 'Setting up', 'franchise team builds coach style spin'],
  ['season', 'The season', 'hub schedule events chemistry injuries depth chart'],
  ['game-day', 'Game day', 'key moments box score speed kicker'],
  ['staff', 'Coaches and play-callers', 'play caller coordinator head coach'],
  ['black-monday', 'Black Monday', 'coaching carousel fire hire interview'],
  ['cap', 'Contracts and the cap', 'salary cap dead money rookie scale'],
  ['re-sign', 'Re-signing', 'negotiate agent patience franchise tag'],
  ['free-agency', 'Free agency', 'free agents offers bids'],
  ['scouting', 'Scouting and the draft', 'scouting draft class gem bust visits combine'],
  ['potential', 'Potential and growth', 'potential ceiling growth'],
  ['awards', 'Awards and history', 'MVP coach of the year rookie history'],
]
export { n0 }
