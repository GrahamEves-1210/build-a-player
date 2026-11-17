import { Link, useMod, Loading, andList, word, Word, n0, usd, third } from './wikiBits'
import {
  XP, COINS, STREAK_REWARDS, LOGIN_XP, POTD_COINS, CUP_COINS, COMPETE_REWARDS, BOOSTS, RARITIES, FREEZE_PRICE, FREEZE_MAX,
  SEASONS_FULL_XP, TITLE_LEVELS, setReward, DISCORD_COINS, FEEDBACK_COINS, AD_COINS, AD_MAX,
} from '../../lib/progress'
import { TIER_XP, TIERS, PASS_PRICE, PASS_COINS, SEASONS as PASS_SEASONS, CLAIM_DAYS, passValue } from '../../lib/pass'
import { SLOTS, RARITY, ITEMS, forSale } from '../../lib/cosmetics'
import { COIN_PACKS } from '../../lib/coins'
import { PRO_PRICE, perMonth } from '../../lib/webCheckout'
import { ACHIEVEMENTS, ACH_GROUPS } from '../../lib/achievements'
import { REWARDED_ON } from '../../lib/rewardedAd'
import { SOCCER_LIVE } from '../../lib/soccerLive'

// Rewards: XP and levels, the Daily tab, coins, the Shop, boosts, the Builder Pass, BAP Pro, cards and achievements.
// Leaderboards: the Ranks tab. Every number is read from the modules the game pays and prices from.
const fmtDay = s => new Date(`${s}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const today = () => new Date().toISOString().slice(0, 10)
const SLOT_WORD = { avatar: 'avatars', nameColor: 'name colours', nameFx: 'name effects', plate: 'nameplates', winFx: 'victory effects', winSound: 'victory sounds', court: 'Blacktop courts', reel: 'reel skins', entrance: 'lobby entrances' }
const place = i => ['1st', '2nd', '3rd'][i] ?? `${i + 1}th`

export function RewardsPage({ go }) {
  const pass = PASS_SEASONS.find(s => today() < s.end) ?? PASS_SEASONS[PASS_SEASONS.length - 1]
  const pv = pass ? passValue(pass) : null
  const freeTiers = pass ? Object.keys(pass.free).length : 0
  const shop = ITEMS.filter(i => forSale(i) && !i.pro && !i.unlock)
  const range = r => { const p = shop.filter(i => i.rarity === r).map(i => i.price); return p.length ? [Math.min(...p), Math.max(...p)] : null }
  const proPerks = ['No ads on the website', `+50% coins from every game (it stacks with Coin Rush)`, 'The Pro Vault: four members-only looks while a member', 'Double the free daily coins', 'A Pro badge on the leaderboards and a Pro role in the Discord', 'A retired Career can come back once']
  return (
    <>
      <p className="wk-lead">Playing earns <b>XP</b>, which fills the levels and the Builder Pass, and <b>coins</b>, which buy looks in the Shop. Nothing a player can buy changes a rating. XP and coins need an account: a guest's games don't earn them.</p>

      <h2 id="xp">XP and levels</h2>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>A season</th><th className="num">XP</th><th className="num">Coins</th></tr></thead>
          <tbody>
            <tr><td>Season played</td><td className="num">{XP.season}</td><td className="num">{COINS.season}</td></tr>
            <tr><td>Each win</td><td className="num">–</td><td className="num">football {COINS.winNfl}, basketball {COINS.winNba}{SOCCER_LIVE ? `, soccer ${COINS.winUcl} (Champions League) or ${COINS.winSoccer}` : ''}</td></tr>
            <tr><td>Winning season</td><td className="num">{XP.winning}</td><td className="num">–</td></tr>
            <tr><td>Made the playoffs</td><td className="num">{XP.playoffs}</td><td className="num">{COINS.playoffs}</td></tr>
            <tr><td>Won the title</td><td className="num">{XP.ring}</td><td className="num">{COINS.ring}</td></tr>
            <tr><td>Won the season award</td><td className="num">{XP.award}</td><td className="num">{COINS.award}</td></tr>
            <tr><td>The Daily Challenge</td><td className="num">–</td><td className="num">+{COINS.daily}</td></tr>
          </tbody>
        </table>
      </div>
      <p>Coins from games are rounded to whole numbers. A day's first {SEASONS_FULL_XP} seasons pay full XP in any mode; after that, half. Sandbox seasons pay nothing.</p>
      <p>A player's <b>level</b> is his tier in the current Builder Pass, so it starts over at 1 each pass season. Every {n0(TIER_XP)} XP is a level, up to {TIERS}. Titles by level: {andList(TITLE_LEVELS.map(t => `${t.name} (${t.level})`))}.</p>

      <h2 id="daily">The Daily tab</h2>
      <ul>
        <li><b>Missions.</b> Three a day, one easy, one medium and one hard, each about something different (seasons, spins, cards, online games). Each pays XP when done.</li>
        <li><b>Login streak.</b> {LOGIN_XP} XP for each day's first visit. Streaks pay once each at {andList(STREAK_REWARDS.map(r => `${r.days} days (${n0(r.xp)} XP${r.item ? ' and a look' : ''})`))}. A <b>streak freeze</b> covers a missed day; a player can hold {word(FREEZE_MAX)}.</li>
        <li><b>The Daily Challenge.</b> One build a day with the same position, pool and spins for everyone. Football and basketball days take turns. One run only.</li>
        <li><b>The Weekly Cup.</b> Every Daily Challenge from Monday to Sunday adds its overall. The top ten are paid: {CUP_COINS.slice(0, 3).map(n0).join(', ')}, then {n0(CUP_COINS[3])} coins for 4th to 10th, plus the Cup Contender avatar.</li>
        <li><b>Players of the Day.</b> The day's top five by XP earned: {POTD_COINS.map(n0).join(' / ')} coins, paid the next morning.</li>
      </ul>

      <h2 id="coins">Coins</h2>
      <ul>
        <li><b>Games.</b> Seasons (table above), Compete places ({Object.entries(COMPETE_REWARDS).map(([p, [, c]]) => `${place(p - 1)} ${c}`).join(', ')}) and Blacktop.</li>
        <li><b>The free daily drop</b> in the Shop: {COINS.free} coins ({COINS.freePro} with BAP Pro).</li>
        <li><b>Once only:</b> {n0(DISCORD_COINS)} for joining the Discord, {n0(FEEDBACK_COINS)} for sending feedback.</li>
        {REWARDED_ON && <li><b>Videos</b> in the app: {AD_COINS} coins each, {word(AD_MAX)} a day.</li>}
        <li><b>Also:</b> card sets, achievements, the Builder Pass, Players of the Day and the Weekly Cup.</li>
        <li><b>Coin packs</b> can be bought with real money: {andList(COIN_PACKS.map(p => `${n0(p.coins)} for $${p.usd}`))}.</li>
      </ul>

      <h2 id="shop">The Shop</h2>
      <p>The Shop sells looks only. The kinds: {andList(SLOTS.map(s => SLOT_WORD[s.id] ?? s.label.toLowerCase()))}. Prices climb with how showy an item is, and rarity is a look rather than a price bracket:</p>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Rarity</th><th className="num">Items</th><th className="num">Price</th></tr></thead>
          <tbody>{RARITY.map(r => { const p = range(r.id); return p && <tr key={r.id}><td>{r.name}</td><td className="num">{shop.filter(i => i.rarity === r.id).length}</td><td className="num">{n0(p[0])} to {n0(p[1])}</td></tr> })}</tbody>
        </table>
      </div>
      <p>Some looks can't be bought: achievement rewards, login streak rewards, the Weekly Cup avatar, Builder Pass items and the Pro Vault. The Shop also sells Sandbox unlocks (see <Link go={go} to="modes" hash="sandbox">Modes § Sandbox</Link>).</p>
      <h3 id="boosts">Boosts</h3>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Boost</th><th>What it does</th><th className="num">Price</th></tr></thead>
          <tbody>{Object.values(BOOSTS).map(b => <tr key={b.name}><td>{b.name}</td><td>{third(b.desc)}</td><td className="num">{b.passOnly ? 'Builder Pass only' : `${n0(b.price)} coins`}</td></tr>)}</tbody>
        </table>
      </div>

      {pass && (
        <>
          <h2 id="pass">The Builder Pass</h2>
          <p>A two-month season of rewards on the XP every player already earns. <b>{pass.name}: {pass.title}</b> runs from {fmtDay(pass.start)} to {fmtDay(pass.end)}; rewards already reached can still be claimed for {word(CLAIM_DAYS)} days after.</p>
          <ul>
            <li>A tier opens every {n0(TIER_XP)} XP, {TIERS} tiers in all.</li>
            <li><b>Free track:</b> {freeTiers} rewards for every signed-in player.</li>
            <li><b>Premium track:</b> a reward on every tier ({n0(pv.coins)} coins and {pv.items} looks in all, plus boosts). It costs {PASS_PRICE} or {n0(PASS_COINS)} coins.</li>
            <li>Rewards include coins, streak freezes, 2x XP, Coin Rush, Hot Hand and Quick Heal boosts, and looks found only in the pass.</li>
          </ul>
        </>
      )}

      <h2 id="pro">BAP Pro <span className="wk-tag">SUBSCRIPTION</span></h2>
      <p>An optional subscription: {PRO_PRICE.month} a month, or {PRO_PRICE.year} a year ({perMonth(PRO_PRICE.year)} a month). It is managed from the profile.</p>
      <ul>{proPerks.map(t => <li key={t}>{t}</li>)}</ul>

      <h2 id="cards">Cards and sets</h2>
      <p>Every player a spin lands on goes into the card binder (on the profile). A card's rarity is the player's rank in his own pool: the top 6% are <b>{RARITIES[3]}</b>, the next 14% <b>{RARITIES[2]}</b>, the next 30% <b>{RARITIES[1]}</b>, the rest <b>{RARITIES[0]}</b>.</p>
      <p>Cards fill <b>sets</b>: every player a franchise has had, every current or all-time player at a position, every Legend card, every Epic card, and the legends of each decade. A finished set pays XP once: 10 for each card in it, up to {setReward(1000)} (a 20-card set pays {setReward(20)}), and a quarter of that in coins.</p>

      <h2 id="achievements">Achievements</h2>
      <p>{ACHIEVEMENTS.length} long-term goals in {word(ACH_GROUPS.length)} groups ({andList(ACH_GROUPS)}). Each pays XP and coins when claimed, and a few unlock looks that can't be bought.</p>
    </>
  )
}
export const REWARDS_TOC = [
  ['xp', 'XP and levels', 'xp level title season rewards'],
  ['daily', 'The Daily tab', 'missions streak freeze daily challenge weekly cup players of the day'],
  ['coins', 'Coins', 'coins earn free daily coin packs'],
  ['shop', 'The Shop', 'shop cosmetics avatar name color nameplate victory court reel entrance'],
  ['boosts', 'Boosts', '2x xp coin rush hot hand quick heal'],
  ...(PASS_SEASONS.length ? [['pass', 'The Builder Pass', 'builder pass season tiers premium free']] : []),
  ['pro', 'BAP Pro', 'subscription pro no ads vault badge'],
  ['cards', 'Cards and sets', 'cards binder rarity legend epic rare sets'],
  ['achievements', 'Achievements', 'achievements'],
]

// ── Leaderboards (the Ranks tab) ─────────────────────────────────────────────
const loadBoards = () => import('../../lib/boards')
export function LeaderboardsPage({ go }) {
  const B = useMod('boards', loadBoards)
  if (!B) return <Loading />
  const sports = B.boardSports()
  const fb = B.recordBoards('nfl', 'qb')
  return (
    <>
      <p className="wk-lead">The <b>Ranks</b> tab in the bottom bar holds every leaderboard, in three tabs. Signed-in players' saved seasons and games count; guest games and Sandbox seasons don't. Boards can be filtered to friends.</p>
      <h2 id="online">Online</h2>
      <p>{andList(B.onlineBoards().map(b => b.label))}. Blacktop can be shown in total or by size ({andList(B.blacktopModes().slice(1).map(m => m.label))}). The online rating is explained on <Link go={go} to="modes" hash="compete">Modes § Compete</Link>.</p>
      <h2 id="today">Today</h2>
      <p>{andList(B.todayBoards().map(b => b.label))}. See <Link go={go} to="rewards" hash="daily">Rewards § The Daily tab</Link> for what the top places pay.</p>
      <h2 id="records">Records</h2>
      <p>Records for each sport ({andList(sports.map(s => s.label.toLowerCase()))}). Football's are kept by position. A quarterback's, for example:</p>
      <ul>{[...new Set(fb.map(b => b.group))].map(g => <li key={g}><b>{g.charAt(0) + g.slice(1).toLowerCase()}:</b> {andList(fb.filter(b => b.group === g).map(b => b.label))}</li>)}</ul>
      <p>Boards that average over seasons need {n0(B.MIN_SEASONS)} or more saved seasons.</p>
      <h2 id="profile">Profiles</h2>
      <ul>
        <li><b>Saving.</b> A signed-in player's completed seasons are saved with the build, record, stats and awards.</li>
        <li><b>The profile</b> shows the player's trophies, his <b>best builds</b> (the top overall at each position, Current and All-Time), his card binder and his achievements, all under his username and avatar.</li>
        <li><b>Share cards</b> turn a finished build and season into an image to post.</li>
      </ul>
    </>
  )
}
export const LEADERBOARDS_TOC = [
  ['online', 'Online boards', 'online rating games played blacktop'],
  ['today', 'Today\'s boards', 'daily puzzle players of the day weekly cup daily grid'],
  ['records', 'Records', 'most rings wins best OVR records'],
  ['profile', 'Profiles', 'profile best builds share card save'],
]
export { Word, usd }
