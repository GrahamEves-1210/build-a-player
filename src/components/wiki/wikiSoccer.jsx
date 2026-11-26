import { Link, Weights, useMods, Loading, andList, word, n0 } from './wikiBits'
import { SOCCER_ATTR, SOCCER_TYPES, SOCCER_CATEGORIES, SOCCER_SIZE_SCALE } from '../../data/soccer-attrs'
import { CAPS } from '../../lib/squad'

// Soccer (SOCCER_LIVE): the striker's nine ratings, the two pools, the seasons. The weights, the clubs and the
// nations come from the soccer engine and data, loaded with this page only.
const MODS = [
  ['soccer-sim', () => import('../../utils/soccerSimulation')],
  ['soccer-clubs', () => import('../../data/soccer-clubs')],
  ['soccer-legends', () => import('../../data/soccer-legends')],
]
const ft = inches => `${Math.floor(inches / 12)}'${inches % 12}"`

export function SoccerPage({ go }) {
  const got = useMods(MODS)
  if (!got) return <Loading />
  const [Sim, Clubs, Legends] = got
  const flat = v => Object.fromEntries(SOCCER_TYPES.map(t => [t, { val: v }]))
  const giants = Clubs.UCL_CLUBS.filter(c => Clubs.UCL_GIANTS.includes(c.short)).map(c => c.name)
  const nations = Legends.WC_LEGEND_NATIONS
  const champs = nations.filter(n => n.titles > 0)
  const sz = SOCCER_SIZE_SCALE
  return (
    <>
      <p className="wk-lead"><b>Soccer</b> builds a striker out of real forwards and midfielders and plays him through a Champions League campaign or a World Cup. Pick SOCCER on Home's sport switch.</p>

      <h2 id="ratings">The nine ratings</h2>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Group</th><th>Ratings</th></tr></thead>
          <tbody>{SOCCER_CATEGORIES.map(c => <tr key={c.id}><td>{c.label}</td><td>{c.types.map(t => SOCCER_ATTR[t].label).join(', ')}</td></tr>)}</tbody>
        </table>
      </div>
      <p>Dribbling includes ball control and first touch. Size comes from the player's height and weight: weight counts for {Math.round(sz.w * 100)}% ({sz.lb[0]} lb is an F, {sz.lb[1]} lb an S) and height for the rest ({ft(sz.in[0])} is an F, {ft(sz.in[1])} an S).</p>
      <p>The overall uses basketball's scale: the weighted average of the nine, with all 1s a 57 and all 10s a 99. A build of all B ratings scores {Sim.calcSoccerOVR(flat(6))}, and all A ratings {Sim.calcSoccerOVR(flat(9))}.</p>
      <div className="wk-weights"><Weights title="Striker" weights={Sim.SOCCER_OVR_WEIGHTS} attr={SOCCER_ATTR} /></div>

      <h2 id="pools">The two pools</h2>
      <ul>
        <li><b>Champions League.</b> The wheel deals the {word(Clubs.UCL_SHORTS.length)} clubs of the 2026-27 Champions League, then one of the club's forwards or midfielders. The biggest names come up most often: {andList(giants)}.</li>
        <li><b>World Cup.</b> The legends of the {nations.length} greatest World Cup nations in history, {n0(Legends.WC_LEGENDS.length)} players in all: strikers, wingers and midfielders, most of them from the 1990s to now. Nations are ranked by how far they went at every World Cup, with recent tournaments counting a little more. {word(champs.length).charAt(0).toUpperCase() + word(champs.length).slice(1)} of them have won it: {andList(champs.map(n => n.name))}.</li>
      </ul>

      <h2 id="season">The season</h2>
      <p>The striker takes the place of his team's first-choice No. 9. The team's real attack and defence already include that player, so the side scores more or less by how much better or worse the build is than the man he replaced. Every match is played from a goal model (attack against defence, home advantage), and his goals, shots, expected goals, assists and match rating come from that same match, so his line always adds up.</p>
      <h3 id="ucl">Champions League</h3>
      <p>His season is his club's campaign: eight league phase matches, two against teams from each of four pots. The top eight go to the Round of 16; ninth to 24th play two-legged play-offs. Then two-legged knockouts and a one-match final. Awards: the competition's top scorer, Player of the Season and Young Player of the Season.</p>
      <h3 id="wc">World Cup</h3>
      <p>The 2026 format: 48 nations in twelve groups of four, the top two and the eight best third-placed teams into a Round of 32, then single matches with extra time and penalties. A finalist plays eight matches. Awards: the Golden Boot, the Golden Ball and Best Young Player (born 2005 or later).</p>

      <h2 id="modes">Soccer modes</h2>
      <ul>
        <li><b>Career.</b> From the academy to the Ballon d'Or, at a club in Europe's top leagues: league, cup and Europe, transfer windows and the World Cup with the real 2026 nations. See <Link go={go} to="career" hash="soccer">Career § Soccer careers</Link>.</li>
        <li><b>Squad Builder.</b> Build up to {word(CAPS.soccer.st)} forwards for the same club and play a league season together.</li>
        <li><b>Salary Cap</b> works as it does in the other sports (see <Link go={go} to="modes">Modes</Link>).</li>
      </ul>
    </>
  )
}
export const SOCCER_TOC = [
  ['ratings', 'The nine ratings', 'pace finishing shot power dribbling passing positioning heading size composure striker OVR'],
  ['pools', 'The two pools', 'champions league world cup legends nations clubs wheel'],
  ['season', 'The soccer season', 'goals xG match rating'],
  ['ucl', 'Champions League season', 'league phase play-offs knockouts final player of the season'],
  ['wc', 'World Cup season', 'group round of 32 penalties golden boot golden ball'],
  ['modes', 'Soccer modes', 'career squad builder salary cap'],
]
