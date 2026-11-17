import { useState } from 'react'
import RatingsTable, { POOLS, RATINGS_AS_OF, RATINGS_DATES, fmtDate, poolCounts, useLazyPools } from '../RatingsTable'
import { CREATORS, CREATORS_AS_OF } from '../../data/creators'
import { SOCCER_LIVE } from '../../lib/soccerLive'
import { BASEBALL_LIVE } from '../../lib/baseballLive'
import { CBB_LIVE } from '../../lib/cbbLive'
import { CFB_LIVE } from '../../lib/cfbLive'
import { FRANCHISE_LIVE } from '../../lib/franchiseLive'
import { BAT_TYPES, PIT_TYPES, MLB_ATTR } from '../../data/mlb-attrs'
import { Link, andList } from './wikiBits'
import { GameplayPage, GAMEPLAY_TOC, SeasonsPage, SEASONS_TOC } from './wikiGame'
import { CareerPage, CAREER_TOC } from './wikiCareer'
import { FranchisePage, FRANCHISE_TOC } from './wikiFranchise'
import { CollegePage, COLLEGE_TOC } from './wikiCollege'
import { SoccerPage, SOCCER_TOC } from './wikiSoccer'
import { ModesPage, MODES_TOC } from './wikiModes'
import { RewardsPage, REWARDS_TOC, LeaderboardsPage, LEADERBOARDS_TOC } from './wikiRewards'

// The wiki's pages. Each is a component plus a table of contents the shell uses for the sidebar and search. Every
// page is written from the game's own code and reads its numbers from the modules the game runs on, so a change to
// a price, a rule or a roster shows here on the next build.
//
// The switches it reads: a mode's page or section appears when its switch is on, and nothing about a mode that's
// off shows anywhere, search included. LB_LIVE, OL_LIVE, K_LIVE, SOCCER_LIVE, CFB_LIVE, CBB_LIVE, FRANCHISE_LIVE,
// BASEBALL_LIVE (lib/*Live.js); REWARDED_ON (lib/rewardedAd.js) for the video rewards; CFB_CLOUD / CBB_CLOUD
// (components/cfb/cfbShared.js, cbb/cbbShared.js) for whether college seasons are saved to the account.

const sportName = sport => (sport === 'nfl' ? 'Football' : sport === 'soccer' ? 'Soccer' : sport === 'baseball' ? 'Baseball' : 'Basketball')
const COLLEGE_ON = CFB_LIVE || CBB_LIVE
const poolName = c => `${sportName(c.sport)} · ${c.label === sportName(c.sport) ? 'forwards and midfielders' : c.label}`

// ── Main page ────────────────────────────────────────────────────────────────
function MainPage({ go }) {
  const counts = poolCounts().filter(c => c.current || c.legends)   // (soccer's pools load with the Ratings page)
  const fbPos = POOLS.filter(p => p.sport === 'nfl').map(p => p.label)
  const games = ['Build-A-Player (football)', 'Build-A-Bucket (basketball)', ...(SOCCER_LIVE ? ['Soccer'] : []), ...(BASEBALL_LIVE ? ['Baseball'] : [])]
  const modes = [...(FRANCHISE_LIVE ? ['Franchise'] : []), 'Career', ...(CFB_LIVE ? ['College Football'] : []), ...(CBB_LIVE ? ['College Basketball'] : []), 'Compete', 'Trait Auction', 'Blacktop', 'Salary Cap', 'Squad Builder', 'Depth Chart', 'Daily Challenge', 'Sandbox']
  return (
    <>
      <table className="wk-infobox">
        <caption>Build-A-Player</caption>
        <tbody>
          <tr><td colSpan={2}><img src="/bap-mark.webp" alt="Build-A-Player logo" /></td></tr>
          <tr><th>Type</th><td>Free browser game</td></tr>
          <tr><th>Sports</th><td>{games.map((g, i) => <span key={g}>{i > 0 && <br />}{g}</span>)}</td></tr>
          <tr><th>Positions</th><td>{fbPos.join(', ')}<br />Guard, Big{SOCCER_LIVE && <><br />Striker</>}{BASEBALL_LIVE && <><br />Batter, Pitcher</>}</td></tr>
          <tr><th>Modes</th><td>{modes.join(', ')}</td></tr>
          <tr><th>Developer</th><td>Playmaker Games (independent)</td></tr>
          <tr><th>Platform</th><td>Web browser, iOS, Android</td></tr>
          <tr><th>Ratings as of</th><td>{fmtDate(RATINGS_AS_OF)}</td></tr>
          <tr><th>Website</th><td><a href="/">build-a-player.com</a></td></tr>
        </tbody>
      </table>
      <p className="wk-lead"><b>Build-A-Player</b> is a fan-made game about building one {SOCCER_LIVE ? 'football, basketball or soccer' : 'football or basketball'} player out of pieces of many real ones. Spin for a team, spin for a player, keep one of his ratings, and repeat until every slot is full. Then play a season and see what the build can do.</p>
      <p>This wiki explains how every part of the game works, written from the game's own code: the spin, the 0–11 scale, the overall formulas, the seasons, every mode, the rewards, and every player's ratings. The numbers on these pages are read from the game itself, so they change when the game does.</p>

      <h2 id="start">Start here</h2>
      <ul className="wk-start">
        {PAGES.filter(p => p.slug !== 'main').map(p => <li key={p.slug}><Link go={go} to={p.slug}>{p.title}</Link><span>{p.blurb}</span></li>)}
      </ul>

      <h2 id="sports">The sports</h2>
      <p><b>Build-A-Player</b> is the football game: {andList(POOLS.filter(p => p.sport === 'nfl').map(p => p.plural))}, played through a 17-game NFL season with the playoffs, the Super Bowl and the awards. <b>Build-A-Bucket</b> is basketball, at <a href="/bucket">build-a-player.com/bucket</a>: guards and bigs with ten ratings, an 82-game season, the play-in and four best-of-seven rounds.{SOCCER_LIVE && <> <b>Soccer</b> is at <a href="/soccer">build-a-player.com/soccer</a>: a striker with nine ratings, played through a Champions League campaign or a World Cup.</>}{BASEBALL_LIVE && <> <b>Baseball</b> builds a batter or a pitcher (see <Link go={go} to="baseball">Baseball</Link>).</>}{COLLEGE_ON && <> The <b>college modes</b> ({andList([...(CFB_LIVE ? ['College Football'] : []), ...(CBB_LIVE ? ['College Basketball'] : [])])}) play real college seasons and lead into Career.</>}</p>

      <h2 id="numbers">By the numbers</h2>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Pool</th><th className="num">Current players</th><th className="num">All-time legends</th><th>Ratings last changed</th></tr></thead>
          <tbody>
            {counts.map(c => <tr key={c.id}><td>{poolName(c)}</td><td className="num">{c.current || '…'}</td><td className="num">{c.legends || '…'}</td><td>{fmtDate(c.updated)}</td></tr>)}
          </tbody>
        </table>
      </div>
      {counts.some(c => c.sport === 'soccer') && <p>In soccer the two columns are the Champions League pool and the World Cup legends.</p>}
      <p>Every rating sits on a 0–11 scale shown as letter grades from F to S. The full lists are on the <Link go={go} to="ratings">Ratings</Link> page.</p>
    </>
  )
}

// ── Baseball (only while BASEBALL_LIVE is on) ────────────────────────────────
function BaseballPage() {
  return (
    <>
      <p className="wk-lead"><b>Baseball</b> builds a batter or a pitcher from real MLB players, ten ratings each, and plays him through a season.</p>
      <h2 id="ratings">The ratings</h2>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Position</th><th>Ratings</th></tr></thead>
          <tbody>
            <tr><td>Batter</td><td>{BAT_TYPES.map(t => MLB_ATTR[t]?.label ?? t).join(', ')}</td></tr>
            <tr><td>Pitcher</td><td>{PIT_TYPES.map(t => MLB_ATTR[t]?.label ?? t).join(', ')}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Ratings ──────────────────────────────────────────────────────────────────
function RatingsPage({ query, pool }) {
  useLazyPools()
  const counts = poolCounts()
  return (
    <>
      <p className="wk-lead">The full pools the spins draw from. The table reads the game's data files directly, so it changes whenever the ratings do; the dates are the last time each pool's file changed. Tap a column to sort. <b>Avg</b> is the plain average of a player's ratings.</p>
      <div className="wk-table-wrap">
        <table className="wikitable">
          <thead><tr><th>Pool</th><th className="num">Current</th><th className="num">All-time</th><th>Last changed</th></tr></thead>
          <tbody>{counts.map(c => <tr key={c.id}><td>{poolName(c)}</td><td className="num">{c.current || '…'}</td><td className="num">{c.legends || '…'}</td><td>{fmtDate(c.updated)}</td></tr>)}</tbody>
        </table>
      </div>
      {SOCCER_LIVE && <p>In soccer the two columns are the Champions League pool and the World Cup legends.</p>}
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
function BehindPage({ go }) {
  return (
    <>
      <h2 id="ratings-from">Where the ratings come from</h2>
      <p>Every rating is set by hand on the 0–11 scale, position by position, with anchors at the top: Dan Marino's arm is an 11, Tom Brady's processing and leadership are 11s, and current players are graded against those same marks. Current rosters are updated through the season; All-Time pools are picked franchise by franchise. Team grades are fitted to real results: the NFL's 1–10 offense and defense grades, the NBA's ratings out of 100 fitted to the 2025–26 standings{COLLEGE_ON ? ', and ESPN\'s power index for the college teams' : ''}.</p>
      <h2 id="random">How random the game is</h2>
      <p>Every build deals from its own seed, so reloading in the middle of a spin deals the same player again. The Daily Challenge, the Salary Cap board and every Compete pool are <b>seeded</b> the same for everyone, so all players see the same spins. Seasons are played one game at a time at the chances on the <Link go={go} to="seasons">Seasons</Link> page, which is why the same build can go 13–4 one day and 9–8 the next. A result is never changed after the fact: the stories, awards and box scores are read from what the games produced, and a season in progress comes back the same after a reload.</p>
      <h2 id="stack">What it runs on</h2>
      <p>Build-A-Player is a React app built with Vite and served from Cloudflare Pages. Accounts, saves and leaderboards are on Supabase, and the live games (Compete, the Trait Auction, Blacktop) run on a Cloudflare Worker that checks every result. It is an independent fan project by Playmaker Games LLC, with no tie to the NFL, the NBA, the NCAA, their teams or players.</p>
    </>
  )
}

// slug, title, the line on the Main Page (blurb), the page, its contents ([id, label, search words])
export const PAGES = [
  { slug: 'main', title: 'Main Page', heading: 'Build-A-Player Wiki', description: `How Build-A-Player works: spins, ratings, overall formulas, seasons, Career${FRANCHISE_LIVE ? ', Franchise' : ''}${COLLEGE_ON ? ', the college modes' : ''}, every mode, rewards and every player rating.`, Component: MainPage,
    toc: [['start', 'Start here'], ['sports', 'The sports'], ['numbers', 'By the numbers']] },
  { slug: 'gameplay', title: 'Gameplay', blurb: 'Home, spinning, the 0–11 scale, positions and how the overall is worked out.', description: 'Home and the sport picker, spins and respins, the 0–11 rating scale, every position\'s ratings, and the overall formulas and weights.', Component: GameplayPage, toc: GAMEPLAY_TOC },
  { slug: 'seasons', title: 'Seasons', blurb: 'How an NFL or NBA season is simulated, through the playoffs and the awards.', description: 'How a season is simulated: team grades, schedules, win chances, stats, playoffs and awards.', Component: SeasonsPage, toc: SEASONS_TOC },
  { slug: 'career', title: 'Career', blurb: 'One player from the draft to the Hall of Fame: seasons, trades, contracts, development, legacy.', description: 'Career mode: the face creator, the combine and draft, seasons, trade demands and the deadline, contracts, development points and trait costs, aging, legacy and the Hall of Fame.', Component: CareerPage, toc: CAREER_TOC },
  ...(FRANCHISE_LIVE ? [{ slug: 'franchise', title: 'Franchise', blurb: 'Run an NFL team: the coach, the cap, re-signing, free agency, scouting and the draft.', description: 'Franchise mode: the coach build, game day, play-callers, Black Monday, contracts and the cap, re-sign talks, free agency, scouting, the draft and potential.', Component: FranchisePage, toc: FRANCHISE_TOC }] : []),
  ...(COLLEGE_ON ? [{ slug: 'college', title: 'College', blurb: `${andList([...(CFB_LIVE ? ['College Football'] : []), ...(CBB_LIVE ? ['College Basketball'] : [])])}: offers, class years, the season and the draft.`, description: 'The college modes: conferences, offers, class years, upgrade points, the season, awards, draft stock, the transfer portal and Start in College.', Component: CollegePage, toc: COLLEGE_TOC }] : []),
  ...(SOCCER_LIVE ? [{ slug: 'soccer', title: 'Soccer', blurb: 'The striker\'s nine ratings, the Champions League and World Cup pools, and the season.', description: 'Soccer: the nine striker ratings, the Champions League wheel and season, the World Cup legends, and the soccer modes.', Component: SoccerPage, toc: SOCCER_TOC }] : []),
  ...(BASEBALL_LIVE ? [{ slug: 'baseball', title: 'Baseball', blurb: 'Batters and pitchers.', description: 'Baseball: batters, pitchers and their ratings.', Component: BaseballPage, toc: [['ratings', 'The ratings', 'batter pitcher']] }] : []),
  { slug: 'modes', title: 'Modes', blurb: 'Compete, the Trait Auction, Blacktop, Salary Cap, Squad Builder, the Depth Chart and Sandbox.', description: 'Current and All-Time, Compete, the Trait Auction, Blacktop, Salary Cap, Squad Builder, the Depth Chart mini game and Sandbox.', Component: ModesPage, toc: MODES_TOC },
  { slug: 'rewards', title: 'Rewards', blurb: 'XP, levels, coins, the Shop, boosts, the Builder Pass, BAP Pro, cards and achievements.', description: 'XP and levels, the Daily tab, coins, the Shop, boosts, the Builder Pass, BAP Pro, cards and sets, and achievements.', Component: RewardsPage, toc: REWARDS_TOC },
  { slug: 'leaderboards', title: 'Leaderboards', blurb: 'The Ranks tab: online, today\'s boards and records, and profiles.', description: 'The Ranks tab: online boards, today\'s boards, records by sport and position, and profiles.', Component: LeaderboardsPage, toc: LEADERBOARDS_TOC },
  { slug: 'ratings', title: 'Ratings', blurb: 'Every player in every pool, sortable and searchable.', description: 'Every player rating in the game, current and all-time, sortable and searchable, with the date each pool last changed.', Component: RatingsPage,
    toc: [['table', 'All ratings', 'players table search sort']] },
  { slug: 'creators', title: 'Creators', blurb: 'YouTubers and podcasters who have played the game on camera.', description: 'YouTubers, podcasters and TikTok creators who have played Build-A-Player and Build-A-Bucket, with their videos.', Component: CreatorsPage,
    toc: [['submit', 'Made a video?', 'submit creator youtube tiktok']] },
  { slug: 'behind-the-scenes', title: 'Behind the scenes', blurb: 'Where the ratings come from, how random the game is, what it runs on.', description: 'Where the ratings come from, how random the game is, and what Build-A-Player runs on.', Component: BehindPage,
    toc: [['ratings-from', 'Where the ratings come from', 'anchors Marino Brady'], ['random', 'How random the game is', 'seeded dice seed'], ['stack', 'What it runs on', 'React Vite Cloudflare Supabase']] },
]

export const SEARCH_INDEX = PAGES.flatMap(p => [
  { slug: p.slug, anchor: null, label: p.title, page: p.title, keywords: p.description },
  ...p.toc.map(([id, label, keywords = '']) => ({ slug: p.slug, anchor: id, label, page: p.title, keywords })),
])
export { POOLS, useLazyPools }
