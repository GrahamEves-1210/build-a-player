import { lazy, memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { APP_STORE_URL } from '../../lib/storeLinks'
import { POS_OPTIONS, hsUrl, StackedSilhouette, SPLASH_ATTRS } from '../SplashScreen'
import { getUsername } from '../../lib/discord'
import { useProgress, fetchPlayersOfDay, cachedPlayersOfDay, myToday, POTD_COINS } from '../../lib/progress'
import { IconProfile, IconGear, IconFootball, IconBasketball, IconSoccer, IconBaseball, IconPlay, IconCrown, IconCoin, IconTrophy, IconRing, IconMedal, IconLock } from './icons'
import { sfx } from '../../lib/juice'
import SoundToggle from './SoundToggle'
import Tutorial, { startTutorial } from './Tutorial'
import { IS_APP } from '../../lib/platform'
import Disclaimer from '../Disclaimer'
import { rampAdd } from '../../lib/ads'
import { NameTag, AvatarBadge } from './NameTag'
import { ProCard } from './Promos'
import PassStrip from './PassStrip'
import { usePresence, fmtCount, crowd } from '../../lib/presence'
import { CoinPill } from './AppShop'
import { tierFor } from '../../lib/progress'
import EmptyState from './EmptyState'
import { RollingNumber } from './MotionText'
import { LB_LIVE, LB_SOON } from '../../lib/lbLive'
import { OL_LIVE, OL_SOON } from '../../lib/olLive'
import { K_LIVE, K_SOON } from '../../lib/kLive'
import { SOCCER_LIVE, SOCCER_SOON } from '../../lib/soccerLive'
import { SOCCER_POOL } from '../../lib/soccerUi'
import { BASEBALL_LIVE } from '../../lib/baseballLive'
import { BASEBALL_POS } from '../../lib/baseballUi'
import { CFB_CARD_SCHOOLS } from '../../lib/cfbLive'
import { CBB_CARD_LOGOS } from '../../lib/cbbLive'
import FranchiseCard from '../franchise/FranchiseCard'   // (the card only: the mode itself loads when it's opened)

// Home screen — a game main menu. The app and the website (APP_LOOK) both use
// it in place of the old splash; same callbacks, so nothing else changes.
// Modes only show when their callback is passed (1v1 lives inside Blacktop).
// `footer` is the website's features + links, under the menu.
// Built like a game's main menu: the sports, the stage, its positions, the pool and PLAY
// are one block (each remembers the last pick, so a return visit is one press). Under
// it each mode is a card with the game's own built players on it (Salary Cap: its board).
// No entrance animations: the player photos and the type carry the page.
// Styling: src/app-game.css.

const NFL_FIGURE = {
  qb: { src: '/qb-silhouette.webp', scale: 1 },
  rb: { src: '/rb-silhouette.webp', scale: 1 },
  wr: { src: '/wr-silhouette.png', scale: 1.18 },
  te: { src: '/wr-silhouette.png', scale: 1.18 },
  db: { src: '/db-silhouette.png', scale: 1.05 },
  dl: { src: '/dl-silhouette.webp', scale: 1 },
  lb: { src: '/lb-silhouette.webp', scale: 1 },
  ol: { src: '/ol-silhouette.webp', scale: 1 },
  k: { src: '/k-silhouette.webp', scale: 1 },
}
const reducedMotion = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// football's side of the ball (Home's OFFENSE / DEFENSE switch)
const SIDE_OF = { qb: 'off', rb: 'off', wr: 'off', te: 'off', ol: 'off', dl: 'def', db: 'def', lb: 'def', k: 'def' }
// the kicker while he's coming soon (K_SOON in lib/kLive.js): a locked tab at the end of the defense's bar. Live, he's a real tab there
const KICKER_SOON = { pos: 'k', label: 'K', soon: true, locked: true }
const PLURAL = { bat: 'Hitters', pit: 'Pitchers', qb: 'QBs', rb: 'RBs', wr: 'WRs', te: 'TEs', db: 'DBs', dl: 'DLs', lb: 'LBs', ol: 'Linemen', k: 'Kickers', guard: 'Guards', big: 'Bigs', st: 'Strikers' }
const NFL_NAMES = { qb: 'Quarterback', rb: 'Running Back', wr: 'Wide Receiver', te: 'Tight End', db: 'Defensive Back', dl: 'Defensive Line', lb: 'Linebacker', ol: 'Offensive Line', k: 'Kicker' }
// Who's on the Current and All-Time buttons, for the position picked (football's current
// faces are POS_OPTIONS.players). Every one of them is in that pool.
const face = (id, color) => ({ id, color })
const GREATS = {
  qb: [face('167', '#002244'), face('294', '#003b7b'), face('289', '#9f8958')],                  // Brady, P. Manning, Brees
  rb: [face('2553', '#0080c6'), face('184', '#4f2683'), face('10456', '#69be28')],               // Tomlinson, A. Peterson, Lynch
  wr: [face('espn_1433', '#4f2683'), face('espn_1056', '#aa0000'), face('223', '#97233f')],      // Moss, Owens, Fitzgerald
  te: [face('espn_13229', '#002244'), face('espn_1231', '#e31837'), face('espn_5362', '#0080c6')], // Gronkowski, Gonzalez, Gates
  db: [face('espn_3552', '#241773'), face('espn_4474', '#a5acaf'), face('espn_10458', '#125740')], // Reed, Polamalu, Revis
  dl: [face('espn_16716', '#003594'), face('espn_13979', '#002244'), face('espn_3530', '#0085ca')], // Donald, Watt, Peppers
  lb: [face('espn_964', '#241773'), face('espn_4433', '#ffb612'), face('espn_14938', '#0085ca')], // Ray Lewis, James Harrison (in the DL all-time pool as an edge), Kuechly
  ol: [face('espn_10448', '#311d00'), face('espn_13241', '#aa0000'), face('espn_16709', '#003594')],  // Joe Thomas, Trent Williams, Zack Martin
  k: [face('espn_9704', '#002244'), face('espn_1097', '#002c5f'), face('espn_10636', '#203731')],   // Gostkowski (not Tucker: the owner, 2026-11-12), Vinatieri (his ESPN photo is in Colts blue), Crosby
  guard: [face('nba/893', '#ce1141'), face('nba/977', '#552583'), face('nba/77142', '#fdb927')],  // Jordan, Kobe, Magic
  big: [face('nba/406', '#552583'), face('nba/1495', '#8a8d8f'), face('nba/76003', '#00471b')],  // Shaq, Duncan, Kareem
}
const BUCKET_NOW = {
  guard: [face('nba/4278073', '#007ac1'), face('nba/4594268', '#0c2340'), face('nba/3945274', '#552583')],  // Gilgeous-Alexander, Edwards, Doncic
  big: [face('nba/3112335', '#0e2240'), face('nba/5104157', '#8a8d8f'), face('nba/3032977', '#00471b')],    // Jokic, Wembanyama, Giannis
}

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))
// the figure's bands fall one by one once a page load, then just arrive
let figureShown = false
// the website on a desktop-width screen: the home ad is a pair of boxes
const HOME_AD_PAIR = !IS_APP && typeof matchMedia === 'function' && matchMedia('(min-width: 769px)').matches
const openMenu = () => window.dispatchEvent(new CustomEvent('bap:menu'))

export const HoopU = () => (
  <svg className="hoop-u-svg" viewBox="0 0 68 90" fill="none" aria-hidden="true">
    <circle cx="34" cy="14" r="14.4" fill="#f97316"/>
    <path d="M8 24 L18 88 L50 88 L60 24" stroke="white" strokeWidth="6" strokeLinejoin="round" fill="none"/>
    <line x1="17" y1="25" x2="38" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="27" y1="25" x2="48" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="41" y1="25" x2="20" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="51" y1="25" x2="30" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="5" y1="26" x2="63" y2="26" stroke="white" strokeWidth="5" strokeLinecap="round"/>
  </svg>
)

// Player card: avatar (spotlight colours) with level, name, title and XP bar
export function PlayerChip({ user, onClick }) {
  const p = useProgress()
  const name = getUsername(user)
  return (
    <button className="ag-player-chip" onClick={onClick}>
      {name ? <AvatarBadge self name={name} size={46} level={p.lvl.level} /> : (
        <span className="ag-avatar"><IconProfile size={22} /></span>
      )}
      <span className="ag-player-txt">
        <span className="ag-player-row">
          <span className="ag-player-name">{name ? <NameTag self name={name} /> : 'Guest'}</span>
          {name && <span className="ag-player-title">{p.lvl.title}</span>}
        </span>
        {name && <span className="ag-xpbar"><span style={{ width: `${Math.max(3, p.lvl.pct * 100)}%` }} /></span>}
        <span className="ag-player-sub">{name ? `${p.lvl.title} · ${p.lvl.into.toLocaleString()}/${p.lvl.need.toLocaleString()} XP` : 'Sign in to save'}</span>
      </span>
    </button>
  )
}

// players online right now, website and app (lib/presence.js); nothing until a real count is in
function OnlineNow() {
  const real = crowd(usePresence()?.total ?? 0)
  if (!real) return null
  const n = real + 100   // the splash count reads +100 (owner's call: the live count runs low)
  return <span className="ag-live-count" aria-label={`${n} players online`}><i aria-hidden="true" /><RollingNumber value={n} format={fmtCount} /> online</span>
}

function Hud({ user }) {
  return (
    <div className="ag-hud">
      <PlayerChip user={user} onClick={() => nav('profile')} />
      <CoinPill className="ag-hud-coins" />
      {!IS_APP && <SoundToggle className="ag-hud-sound" />}
      <button className="ag-icon-btn" onClick={openMenu} aria-label="Settings and more"><IconGear size={22} /></button>
    </div>
  )
}

// Football ⇄ basketball, one tap at the top of Home. The other game opens on its
// own Home; a build in progress here waits for PLAY.
export function switchSport(to) {
  try { sessionStorage.setItem('bap_go_home', '1') } catch {}
  document.documentElement.classList.add('ag-sport-leaving')
  document.documentElement.style.setProperty('--sport-to', String(Math.max(0, SPORTS.findIndex(s => s.id === to))))   // (three sports: where the thumb slides)
  document.documentElement.dataset.sportTo = to
  // (the dev server's ?soccer=1 rides along, so the switch keeps showing SOCCER: lib/soccerLive.js)
  // (and ?baseball=1: lib/baseballLive.js)
  const keep = import.meta.env.DEV ? [/[?&]soccer=1\b/.test(window.location.search) && 'soccer=1', /[?&]baseball=1\b/.test(window.location.search) && 'baseball=1'].filter(Boolean).join('&') : ''
  setTimeout(() => { window.location.href = (to === 'bucket' ? '/bucket' : to === 'soccer' ? '/soccer' : to === 'baseball' ? '/baseball' : '/') + (keep ? `?${keep}` : '') }, 170)
}
// the sports on the switch, in order (soccer only once it's switched on)
export const SPORTS = [
  { id: 'nfl', label: 'FOOTBALL', Icon: IconFootball },
  { id: 'bucket', label: 'BASKETBALL', Icon: IconBasketball },
  // (soccer while it's coming soon: on the switch, locked, SOON under it)
  ...(SOCCER_LIVE || SOCCER_SOON ? [{ id: 'soccer', label: 'SOCCER', Icon: IconSoccer, soon: !SOCCER_LIVE }] : []),
  ...(BASEBALL_LIVE ? [{ id: 'baseball', label: 'BASEBALL', Icon: IconBaseball }] : []),
]
function SportSwitch({ sport }) {
  const go = to => { if (to === sport) return; sfx('swap'); switchSport(to) }
  const three = SPORTS.length > 2
  return (
    <div className={`ag-sport ag-sport--${sport}${three ? ' ag-sport--three' : ''}${SPORTS.length > 3 ? ' ag-sport--four' : ''}`} style={three ? { '--si': Math.max(0, SPORTS.findIndex(s => s.id === sport)) } : undefined} role="tablist" aria-label="Sport">
      <span className="ag-sport-thumb" aria-hidden="true" />
      {SPORTS.map(({ id, label, Icon, soon }) => (
        <button key={id} role="tab" aria-selected={sport === id} aria-disabled={soon && sport !== id ? 'true' : undefined} className={`ag-sport-btn ag-sport-btn--${id}${sport === id ? ' is-on' : ''}${soon && sport !== id ? ' is-soon' : ''}`} onClick={() => { if (!soon) go(id) }}>
          <span className="ag-sport-ico">{soon && sport !== id ? <IconLock size={15} /> : <Icon size={17} />}</span>
          <span className="ag-sport-txt"><b>{label}</b>{soon && sport !== id && <small className="ag-sport-soon">COMING SOON</small>}</span>
        </button>
      ))}
    </div>
  )
}

// The pool: the players in it, standing there. It only picks; PLAY starts.
function ModeCard({ gold = false, title, line, faces, on, onClick }) {
  return (
    <button role="radio" aria-checked={on} className={`ag-mode${gold ? ' ag-mode--gold' : ''}${on ? ' is-on' : ''}`} onClick={onClick}>
      <span className="ag-mode-title">{title}</span>
      <span className="ag-mode-line">{line}</span>
      <span className="ag-mode-faces" aria-hidden="true">
        {faces?.map(f => <img key={f.id} src={hsUrl(f.id)} alt="" width="96" height="70" decoding="async" draggable={false} />)}
      </span>
    </button>
  )
}

// a live mode's line: how many are in it right now, when any are
const LiveLine = ({ n, line }) => (n > 0 ? <small className="ag-mc-live"><i aria-hidden="true" />{fmtCount(n)} playing</small> : <small>{line}</small>)

// A mode's card: its colour, its name, where it stands, and its art (public/modes)
function ModeArt({ kind, tone, small = false, title, line, live = 0, color, onClick, children, tag = null, soon = false }) {
  // (soon: a mode that's on its way to this sport. It shows, locked, with COMING SOON)
  return (
    <button className={`ag-way ag-mc ag-mc--${tone} ag-way--${kind}${small ? ' is-small' : ''}${color ? ' has-team' : ''}${soon ? ' is-soon' : ''}`} style={color ? { '--team': color } : undefined} onClick={soon ? undefined : onClick} disabled={soon} aria-disabled={soon || undefined}>
      <span className="ag-mc-head"><b>{title}{soon ? <i className="ag-mc-tag ag-mc-tag--soon"><IconLock size={11} /> COMING SOON</i> : tag && <i className="ag-mc-tag">{tag}</i>}</b>{!soon && <LiveLine n={live} line={line} />}</span>
      {children}
    </button>
  )
}
const Art = ({ src, cls }) => <img className={`ag-art ${cls}`} src={`/modes/${src}.webp`} alt="" loading="lazy" decoding="async" draggable={false} aria-hidden="true" />
// College Football, a football mode: first in MORE WAYS TO PLAY, on its own row, in NCAA blue. A few
// school logos only (lib/cfbLive.js): the college rosters never load on Home. The line is where the last
// season ended, read off this device (components/cfb/cfbShared.js keeps it)
const cfbLine = () => {
  try {
    const s = JSON.parse(localStorage.getItem('bap_cfb_seasons'))?.[0]
    if (s?.teamName) return `${s.teamName} ${s.record}${s.title ? ', national champs' : s.finalRank ? ` · No. ${s.finalRank}` : ''}`
  } catch {}
  return 'Conference spin · Heisman race'
}
function CFBCard({ onClick }) {
  const [line] = useState(cfbLine)
  return (
    <button className="ag-way ag-mc ag-mc--cfb" onClick={onClick}>
      <span className="ag-mc-head"><b>COLLEGE FOOTBALL<i className="ag-mc-tag">NEW</i></b><small>{line}</small></span>
      <span className="ag-cfb-band" aria-hidden="true">
        {CFB_CARD_SCHOOLS.map(s => <img key={s} src={`/logos/cfb/${s}.png`} alt="" width="56" height="56" loading="lazy" decoding="async" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} />)}
      </span>
    </button>
  )
}
// College Basketball, a basketball mode: College Football's card, on basketball's Home (lib/cbbLive.js: logos only).
// The line is where the last season ended, read off this device (components/cbb/cbbShared.js keeps it)
const cbbLine = () => {
  try {
    const s = JSON.parse(localStorage.getItem('bap_cbb_seasons'))?.[0]
    if (s?.teamName) return `${s.teamName} ${s.record}${s.title ? ', national champs' : s.finish && s.finish !== 'No postseason' ? ` · ${s.finish}` : ''}`
  } catch {}
  return 'Conference spin · March Madness'
}
function CBBCard({ onClick }) {
  const [line] = useState(cbbLine)
  return (
    <button className="ag-way ag-mc ag-mc--cfb ag-mc--cbb" onClick={onClick}>
      <span className="ag-mc-head"><b>COLLEGE BASKETBALL<i className="ag-mc-tag">NEW</i></b><small>{line}</small></span>
      <span className="ag-cfb-band" aria-hidden="true">
        {CBB_CARD_LOGOS.map(s => <img key={s} src={s} alt="" width="56" height="56" loading="lazy" decoding="async" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} />)}
      </span>
    </button>
  )
}
const CareerFigure = lazy(() => import('./CareerFigure'))
// Career: what ends up in the rafters. A career's real count lights each banner; before one starts they all hang
function Rafters({ career, sport = null }) {
  const soccer = sport === 'soccer' || career?.sport === 'soccer'   // (soccer: titles and Ballon d'Ors)
  const s = career?.seasons ?? []
  const count = k => s.filter(x => x[k]).length
  // legacy toward the Hall (lib/career.js loads on its own: there's a career, so it's already here)
  const [hof, setHof] = useState(null)
  useEffect(() => {
    if (!career) { setHof(null); return }
    let live = true
    // (soccer's career module loads on its own: the legacy is read once it's in)
    import('../../lib/career').then(m => m.ensureSport(career.sport ?? 'nfl').then(() => { if (live) setHof(m.hofProgress(career)) }), () => {})
    return () => { live = false }
  }, [career])
  const flags = [
    { Icon: soccer ? IconTrophy : IconRing, n: count('champion'), word: soccer ? 'TITLES' : 'RINGS' },
    // (a lineman's award is Protector of the Year: the word takes no plural)
    { Icon: soccer ? IconMedal : IconTrophy, n: count('award'), word: career?.pos === 'ol' ? 'PROTECTOR' : `${s.find(x => x.awardName)?.awardName ?? (soccer ? "BALLON D'OR" : 'MVP')}S` },
    { Icon: IconMedal, n: hof ?? 0, word: soccer ? 'LEGEND' : 'HOF', stat: hof == null ? null : `${hof}%`, meter: hof },
  ]
  return (
    <span className="ag-rafters" aria-hidden="true">
      {flags.map(({ Icon, n, word, stat, meter }) => (
        <i key={word} className={`ag-banner${career && !n ? ' is-dark' : ''}`}><Icon size={17} /><b>{career ? stat ?? `${n}X` : word}</b>{career && <small>{word}</small>}{career && meter != null && <em className="ag-banner-meter"><span style={{ width: `${meter}%` }} /></em>}</i>
      ))}
    </span>
  )
}
// Compete: same spins, one board, and three of them make the podium
const Podium = () => (
  <span className="ag-pod" aria-hidden="true">
    {[2, 1, 3].map(rank => (
      <span key={rank} className={`ag-pod-col is-${rank}`}>
        {rank === 1 && <IconCrown size={22} />}
        <b>{rank}</b>
      </span>
    ))}
  </span>
)
// Squad Builder, football: the whole team, one at each position, side by side
const TeamRow = () => (
  <span className="ag-team" aria-hidden="true">
    {['rb', 'qb2', 'wr'].map(p => <img key={p} className={`is-${p}`} src={`/modes/fig-${p}.webp`} alt="" loading="lazy" decoding="async" draggable={false} />)}
  </span>
)
// Squad Builder, basketball: the five spots you fill
const Lineup = () => (
  <span className="ag-lineup" aria-hidden="true">
    {['PG', 'SG', 'SF', 'PF', 'C'].map(p => <i key={p}>{p}</i>)}
  </span>
)
// Squad Builder, soccer: the team on a pitch, 4-3-3, the front three lit (the spots you build)
const FORMATION = [[50, 88], [16, 70], [38, 74], [62, 74], [84, 70], [28, 50], [50, 54], [72, 50], [20, 24], [50, 18], [80, 24]]
const Formation = () => (
  <span className="ag-formation" aria-hidden="true">
    <i className="ag-formation-box" />
    {FORMATION.map(([x, y], i) => <b key={i} className={i >= 8 ? 'is-on' : undefined} style={{ left: `${x}%`, top: `${y}%` }} />)}
  </span>
)
// Salary Cap, soccer: the board itself, like the other sports' (public/modes/soccer-salary.webp, a real
// screenshot of the soccer board with five picked)
const Fees = () => (
  <span className="ag-mc-shot" aria-hidden="true"><img src="/modes/soccer-salary.webp" alt="" width="480" height="575" loading="lazy" decoding="async" draggable={false} /></span>
)
// Squad Builder, baseball: the diamond, the nine spots in the field (C, P, 1B, 2B, SS, 3B, LF, CF, RF; where they stand
// on the art's field: home plate at the box's bottom centre, the infield and the wall drawn in baseball.css .ag-diamond)
const DIAMOND = [[50, 95], [50, 80], [66, 75], [57, 62], [43, 62], [34, 75], [24, 37], [50, 19], [76, 37]]
const Diamond = () => (
  <span className="ag-diamond" aria-hidden="true">
    {DIAMOND.map(([x, y], i) => <b key={i} className={i === 1 ? 'is-on' : undefined} style={{ left: `${x}%`, top: `${y}%` }} />)}
  </span>
)
// Salary Cap, baseball: the batters' board (public/modes/baseball-salary.webp, a screenshot of the board with five picked)
const BaseballFees = () => (
  <span className="ag-mc-shot" aria-hidden="true"><img src="/modes/baseball-salary.webp" alt="" width="480" height="575" loading="lazy" decoding="async" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} /></span>
)
// Depth Chart: the game itself, in numbers: stars in order, one stat
const DEPTH_NAMES = ['BRADY', 'MANNING', 'BREES']   // GREATS.qb, in order
const DepthArt = () => (
  <span className="ag-ranks" aria-hidden="true">
    {GREATS.qb.map((f, i) => (
      <i key={f.id}>
        <b>{i + 1}</b>
        <img src={hsUrl(f.id)} alt="" width="96" height="70" loading="lazy" decoding="async" draggable={false} />
        <em>{DEPTH_NAMES[i]}</em>
        <u />
      </i>
    ))}
  </span>
)

// Players of the Day: the five who earned the most XP today, across every mode
// (fetchPlayersOfDay). Refreshes every couple of minutes while home is open.
function PlayersOfDay() {
  const p = useProgress()
  const [rows, setRows] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    const get = (first = false) => ((first && cachedPlayersOfDay()) || fetchPlayersOfDay()).then(r => { if (!live) return; setFailed(!!r.error); if (!r.error) setRows(r.rows) })
    get(true)
    const id = setInterval(get, 120000)
    return () => { live = false; clearInterval(id) }
  }, [])
  const me = p.user?.id
  const t = myToday()
  const inTop = !!rows?.some(r => r.id === me)
  return (
    <section className="ag-potd" aria-label="Players of the Day">
      <div className="ag-potd-head">
        <span className="ag-potd-crown"><IconCrown size={18} /></span>
        <span className="ag-potd-titles">
          <span className="ag-eyebrow">TODAY · EVERY MODE</span>
          <h2 className="ag-potd-title">PLAYERS OF THE DAY</h2>
          <small className="ag-potd-pay">Top {POTD_COINS.length} at midnight ET win {POTD_COINS.map(n => n.toLocaleString()).join(' / ')} coins</small>
        </span>
      </div>
      {!rows ? (
        failed ? <p className="ag-potd-mine">Today's board didn't load. It'll try again in a minute.</p>
          : <ol className="ag-potd-list" aria-hidden="true">{POTD_COINS.map((_, i) => <li key={i} className="ag-potd-row is-wait" />)}</ol>
      ) : rows.length ? (
        <ol className="ag-potd-list">
          {rows.map((r, i) => (
            <li key={r.id} className={`ag-potd-row is-${i + 1}${r.id === me ? ' is-me' : ''}`}>
              <span className="ag-potd-rank">{i + 1}</span>
              <AvatarBadge cos={r.cos} uid={r.id} self={r.id === me} name={r.username} size={36} />
              <span className="ag-potd-name"><NameTag name={r.username} cos={r.cos} uid={r.id} self={r.id === me} /></span>
              <span className="ag-potd-prize"><IconCoin size={14} />{POTD_COINS[i]}</span>
              <span className="ag-potd-xp"><span><b>{(r.cos.today.xp ?? 0).toLocaleString()}</b> XP</span><small>{r.cos.today.g ?? 0} {r.cos.today.g === 1 ? 'game' : 'games'}</small></span>
            </li>
          ))}
        </ol>
      ) : <EmptyState kind="podium" small title="Nobody on the board yet">Play anything today to take #1.</EmptyState>}
      {rows && !inTop && (
        <p className="ag-potd-mine">{me
          ? <>{getUsername(p.user) || 'Player'} today: <b>{t.xp.toLocaleString()} XP</b> · {t.g} {t.g === 1 ? 'game' : 'games'}{rows.length === POTD_COINS.length ? <> · {Math.max(0, (rows[rows.length - 1].cos.today.xp ?? 0) - t.xp + 1).toLocaleString()} XP to make the top {POTD_COINS.length}</> : null}</>
          : 'Sign in to get on the board.'}</p>
      )}
    </section>
  )
}

const HudOnce = memo(Hud)
const SportOnce = memo(SportSwitch)
const BoardOnce = memo(PlayersOfDay)
const PromosOnce = memo(function Promos() {
  return (
    <div className="ag-promos">
      <PassStrip />
      <ProCard />
    </div>
  )
})

// Where the player was on home: a mode unmounts it, so this outlives the visit (a reload starts at the top)
let homeScroll = 0

// `soon`: modes this sport shows locked as COMING SOON ({ career, compete, salary, squad }: soccer's
// SOCCER_MODES). `faces`: soccer's strikers on its two pool cards ({ current, alltime }, headshot ids)
export default function AppHome({ sport = 'nfl', onStart, onDepthChart, onVersus, onBlacktop, blacktop, onSquad, squad = null, onCompete, onCareer, career = null, resume = null, user, renderBucketFigure, footer = null, soon = null, faces = null, onCFB = null, onCBB = null, onFranchise = null }) {
  const prog = useProgress()
  // Back from a mode, home opens where it was left. The lists on it fill in as they load, so the
  // spot is put back as the page grows, for a moment, until the player moves it themselves.
  const homeRef = useRef(null)
  useLayoutEffect(() => {
    const el = homeRef.current
    const target = homeScroll
    let settling = target > 0
    const put = () => { if (settling) el.scrollTop = target }
    const settle = () => { settling = false }
    const save = () => { if (!settling) homeScroll = el.scrollTop }
    put()
    const grown = new ResizeObserver(put)
    if (settling) grown.observe(el.firstElementChild)
    const done = setTimeout(() => { settle(); grown.disconnect() }, 1500)
    const touched = ['wheel', 'touchstart', 'pointerdown', 'keydown']
    touched.forEach(t => el.addEventListener(t, settle, { passive: true }))
    el.addEventListener('scroll', save, { passive: true })
    return () => {
      clearTimeout(done); grown.disconnect()
      touched.forEach(t => el.removeEventListener(t, settle))
      el.removeEventListener('scroll', save)
    }
  }, [])
  const here = usePresence()?.areas ?? {}   // how many are in each online mode right now
  const cpHere = (here.compete ?? 0) + (here.auction ?? 0)   // Compete counts its Trait Auction too
  const cs = prog.stats?.compete
  const ol = prog.stats?.online ?? { rating: 800, played: 0 }
  const h2h = prog.stats?.h2h ?? {}
  const btW = prog.stats?.btWins ?? 0, btG = prog.stats?.btGames ?? 0
  const isBucket = sport === 'bucket'
  // soccer: the striker (GK shows, locked, until it's built); the basketball figure stands in for now
  const isSoccer = sport === 'soccer'
  // baseball: a batter or a pitcher, on the basketball figure for now (lib/baseballUi.js BASEBALL_SILHOUETTE)
  const isBaseball = sport === 'baseball'
  const storeKey = isBaseball ? 'baseballPosition' : isSoccer ? 'soccerPosition' : isBucket ? 'bucketPosition' : 'lastPosition'
  const [position, setPosition] = useState(() => {
    let saved = null
    try { saved = localStorage.getItem(storeKey) } catch {}
    if (isSoccer) return 'st'
    if (isBaseball) return saved === 'pit' ? 'pit' : 'bat'
    if (isBucket) return saved === 'big' ? 'big' : 'guard'
    return POS_OPTIONS.some(o => o.pos === saved && !o.disabled) ? saved : 'qb'
  })
  const poolKey = isBaseball ? 'baseballPool' : isSoccer ? 'soccerPool' : isBucket ? 'bucketPool' : 'lastPool'
  const [pool, setPool] = useState(() => { try { return localStorage.getItem(poolKey) === 'all-time' ? 'all-time' : 'classic' } catch { return 'classic' } })
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), figureShown ? 0 : 450); return () => clearTimeout(t) }, [])
  const [fast] = useState(() => figureShown)
  const [picked, setPicked] = useState(false)
  useEffect(() => { figureShown = true }, [])
  // the website: an in-page ad under the lists (never in the app, never ad-free)
  useEffect(() => {
    if (IS_APP || document.documentElement.classList.contains('ads-hidden')) return
    // desktop: two boxes side by side (one 300x250 left the wide row mostly empty); phones: one
    rampAdd([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-home' }, ...(HOME_AD_PAIR ? [{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-home-2' }] : [])])
  }, [sport])

  const pick = pos => { setPicked(true); setPosition(pos); try { localStorage.setItem(storeKey, pos); if (SIDE_OF[pos]) localStorage.setItem(`lastPosition_${SIDE_OF[pos]}`, pos) } catch {} }
  const pickPool = m => { setPool(m); try { localStorage.setItem(poolKey, m) } catch {} }
  const start = mode => { try { localStorage.setItem(storeKey, position) } catch {}; onStart(mode, position) }
  const startRef = useRef(start); startRef.current = start
  const cfbRef = useRef(onCFB); cfbRef.current = onCFB   // (App hands in a new function each render: the cards only need to know it's there)
  const hasCFB = !!onCFB
  const cbbRef = useRef(onCBB); cbbRef.current = onCBB
  const hasCBB = !!onCBB
  // Franchise (football, lib/franchiseLive.js): while its switch is on, its card takes SQUAD BUILDER's place
  const frRef = useRef(onFranchise); frRef.current = onFranchise
  const hasFranchise = !!onFranchise && !isBucket && !isSoccer && !isBaseball

  const positions = isBaseball
    ? ['bat', 'pit'].map(p => ({ pos: p, label: BASEBALL_POS[p].label, sub: BASEBALL_POS[p].sub }))
    : isSoccer
    ? [{ pos: 'st', label: 'ST', sub: 'STRIKER' }, { pos: 'gk', label: 'GK', sub: 'COMING SOON', locked: true }]
    : isBucket
    ? [{ pos: 'guard', label: 'GUARD', sub: 'PG · SG · SF' }, { pos: 'big', label: 'BIG', sub: 'PF · C' }]
    : [...POS_OPTIONS.filter(o => !o.disabled), ...POS_OPTIONS.filter(o => (o.pos === 'lb' && LB_SOON) || (o.pos === 'ol' && OL_SOON)).map(o => ({ ...o, soon: true, locked: true })), ...(K_SOON ? [KICKER_SOON] : [])]   // (LB and OL while they're coming soon: locked, at the end of their side)
  // football: the positions split by side of the ball, one side's bar at a time (the defense front to back, a
  // position still coming at the end); the side switch sits on top of the bar
  const isNfl = !isBucket && !isSoccer && !isBaseball
  const side = SIDE_OF[position] ?? 'off'
  const SIDE_ORDER = { dl: 0, lb: 1, db: 2, k: 3 }
  const shown = isNfl ? positions.filter(o => (SIDE_OF[o.pos] ?? 'off') === side).sort((a, b) => (a.locked ? 1 : 0) - (b.locked ? 1 : 0) || (side === 'def' ? (SIDE_ORDER[a.pos] ?? 9) - (SIDE_ORDER[b.pos] ?? 9) : 0)) : positions
  const posIdx = Math.max(0, shown.findIndex(o => o.pos === position))
  // each side's position: the one picked, or the one it was left on (else its first)
  const sideFirst = s => {
    const open = positions.filter(o => !o.locked && (SIDE_OF[o.pos] ?? 'off') === s)
    let saved = null
    try { saved = localStorage.getItem(`lastPosition_${s}`) } catch {}
    return (SIDE_OF[position] === s ? open.find(o => o.pos === position) : null) ?? open.find(o => o.pos === saved) ?? [...open].sort((a, b) => (SIDE_ORDER[a.pos] ?? 0) - (SIDE_ORDER[b.pos] ?? 0))[0] ?? null
  }
  // the bar slides first (each side already lit on its position), then the position changes once it's there,
  // so the slide and the figure's swap don't land on the same frame
  const [view, setView] = useState(side)
  useEffect(() => { setView(side) }, [side])
  const slideT = useRef(0)
  useEffect(() => () => clearTimeout(slideT.current), [])
  const pickSide = s => {
    if (s === view) return
    const to = sideFirst(s)
    if (!to) return
    setView(s); sfx('swap')
    clearTimeout(slideT.current)
    slideT.current = setTimeout(() => { dir.current = s === 'def' ? 1 : -1; pick(to.pos) }, reducedMotion() ? 0 : 280)
  }
  // next or last position: swipe the stage, or the arrow keys on a computer (a locked one is skipped)
  const dir = useRef(1)
  const step = by => {
    const open = positions.filter(o => !o.locked)
    if (open.length < 2) return
    const at = Math.max(0, open.findIndex(o => o.pos === position))
    dir.current = by; sfx('swap'); pick(open[(at + by + open.length) % open.length].pos)
  }
  const swipeFrom = useRef(null)
  const stepRef = useRef(step); stepRef.current = step
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.ag-menu-overlay, [role="dialog"]')) return
      stepRef.current(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const fig = NFL_FIGURE[position] ?? NFL_FIGURE.qb
  const posShort = isBaseball ? BASEBALL_POS[position]?.label ?? 'BATTER' : isSoccer ? 'ST' : isBucket ? (position === 'big' ? 'BIG' : 'GUARD') : position.toUpperCase()
  const posWord = isBaseball ? posShort : isSoccer ? 'STRIKER' : isBucket ? posShort : NFL_NAMES[position]
  const sqBuilt = squad ? squad.slots.filter(s => s.build).length : 0
  const sqLast = squad?.seasons?.[squad.seasons.length - 1] ?? null
  const btLive = !!blacktop && blacktop.phase !== 'idle'
  const facesNow = isBaseball ? faces?.[position]?.current : isSoccer ? faces?.current : isBucket ? BUCKET_NOW[position] : positions.find(o => o.pos === position)?.players
  const facesGreat = isBaseball ? faces?.[position]?.alltime : isSoccer ? faces?.alltime : GREATS[position]
  const crLine = !career ? (isBaseball ? 'Draft day to Cooperstown' : isSoccer ? 'Academy to the Ballon d\'Or' : 'Draft day to the HOF')
    : career.phase === 'college' ? ((career.college?.seasons?.length ? career.college.seasons[career.college.seasons.length - 1].schoolName : null) ? `In college: ${(career.college?.seasons?.length ? career.college.seasons[career.college.seasons.length - 1].schoolName : null)}` : 'Recruiting')
    : career.phase === 'draft' ? (career.sport === 'soccer' ? 'Academy trials' : 'Draft day')
    : career.phase === 'season' ? `${career.sport === 'soccer' ? 'Match' : career.sport === 'bucket' || career.sport === 'baseball' ? 'Game' : 'Week'} ${(career.active?.k ?? 0) + 1} with ${career.sport === 'soccer' ? '' : 'the '}${career.fit?.name ?? ''}`
    : career.phase === 'offseason' ? `Year ${career.year + 1} · offseason`
    : career.phase === 'retired' ? `Retired after ${career.seasons.length}`
    : `${career.fit?.name ?? ''} · ${career.seasons.length} ${career.seasons.length === 1 ? 'season' : 'seasons'} in`
  const cpLine = cs?.played
    ? `${ol.played ? `${tierFor(ol.rating)[1]} ${ol.rating} · ` : ''}${cs.wins} ${cs.wins === 1 ? 'win' : 'wins'} in ${cs.played}${cs.streak >= 2 ? ` · ${cs.streak} straight` : ''}`
    : 'Live pools of five'
  const btStatus = !btLive ? null : blacktop.phase === 'queue' ? `In the lobby · ${blacktop.queue}/6` : blacktop.phase === 'build' ? 'Building' : 'Game on'
  const btLine = btStatus ?? ((btG || h2h.played) ? `Squads ${btW}–${btG - btW} · 1v1 ${h2h.wins ?? 0}–${h2h.losses ?? 0}${ol.played ? ` · ${tierFor(ol.rating)[1]} ${ol.rating}` : ''}` : '1v1, 2v2, 3v3')
  const sqLine = !squad ? (isBaseball ? 'Build the lineup' : isSoccer ? 'Build the front line' : 'Build your whole team')
    : squad.phase === 'build' ? `Building · ${sqBuilt} of ${squad.slots.length}`
    : sqLast && squad.phase === 'result' ? (isSoccer
      ? `${sqLast.team} ${sqLast.wins}-${sqLast.draws ?? 0}-${sqLast.losses}${sqLast.champion ? (sqLast.pool === 'alltime' ? ', world champions' : ', champions') : ''}`
      : `${sqLast.team} ${sqLast.wins}-${sqLast.losses}${sqLast.champion ? ', champions' : sqLast.playoffs ? ', playoffs' : ''}`)
    : squad.team ? 'Ready to play' : 'Needs a team'

  const sp = isBucket ? 'bucket' : 'nfl'
  // Soccer and baseball: Career, Compete, Salary Cap and Squad Builder (no Blacktop, no Depth Chart)
  const modes = useMemo(() => isSoccer || isBaseball ? (
    <section className="ag-ways" aria-label="More ways to play">
      <h2 className="ag-ways-label">MORE WAYS TO PLAY</h2>
      <div className="ag-cards">
        {onCareer && (
          <ModeArt kind="career" tone="career" title="CAREER" line={crLine} color={career?.fit?.color} onClick={onCareer} soon={!!soon?.career}>
            <Rafters career={career} sport={sport} />
          </ModeArt>
        )}
        {onCompete && (
          <ModeArt kind="compete" tone="compete" title="COMPETE" line={cpLine} live={cpHere} onClick={onCompete} soon={!!soon?.compete}>
            <Podium />
          </ModeArt>
        )}
        <ModeArt kind="quick" tone="salary" title="SALARY CAP" line="Daily grid" onClick={() => startRef.current('salarycap')} soon={!!soon?.salary}>
          {isBaseball ? <BaseballFees /> : <Fees />}
        </ModeArt>
      </div>
      <div className="ag-more ag-more--one">
        {onSquad && (
          <ModeArt small kind="squad" tone="squad" title="SQUAD BUILDER" line={sqLine} onClick={onSquad} soon={!!soon?.squad}>
            {isBaseball ? <Diamond /> : <Formation />}
          </ModeArt>
        )}
      </div>
    </section>
  ) : (
    <section className="ag-ways" aria-label="More ways to play">
      <h2 className="ag-ways-label">MORE WAYS TO PLAY</h2>
      {!isBucket && hasCFB && <CFBCard onClick={() => cfbRef.current?.()} />}
      {isBucket && hasCBB && <CBBCard onClick={() => cbbRef.current?.()} />}
      <div className="ag-cards">
        {onCareer && (
          <ModeArt kind="career" tone="career" title="CAREER" tag="POPULAR" line={crLine} color={career?.fit?.color} onClick={onCareer}>
            <Rafters career={career} />
            {!isBucket && (career?.build
              ? <Suspense fallback={null}><CareerFigure c={career} /></Suspense>
              : <Art src="fig-qb" cls="ag-art--hero" />)}
          </ModeArt>
        )}
        {/* Basketball: Blacktop is the online hub, 2v2 / 3v3 lobbies and 1v1 from inside it */}
        {isBucket
          ? (onBlacktop && (
            <ModeArt kind="blacktop" tone="blacktop" title="BLACKTOP" line={btLine} live={btLive ? 0 : here.blacktop} onClick={onBlacktop}>
              <img className="ag-mc-court" src="/courts/thumbs/ct-blacktop.webp" alt="" loading="lazy" decoding="async" draggable={false} />
              <span className="ag-paint" aria-hidden="true"><b>1V1</b><b>2V2</b><b>3V3</b></span>
            </ModeArt>
          ))
          : (onCompete && (
            <ModeArt kind="compete" tone="compete" title="COMPETE" line={cpLine} live={cpHere} onClick={onCompete}>
              <Podium />
            </ModeArt>
          ))}
        <button className="ag-way ag-mc ag-mc--salary ag-way--quick" onClick={() => startRef.current('salarycap')}>
          <span className="ag-mc-head"><b>SALARY CAP</b><small>Daily grid</small></span>
          <span className="ag-mc-shot" aria-hidden="true"><img src={`/modes/${sp}-salary.webp`} alt="" loading="lazy" decoding="async" draggable={false} /></span>
        </button>
      </div>
      <div className="ag-more">
        {isBucket && onCompete && (
          <ModeArt small kind="compete" tone="compete" title="COMPETE" line={cpLine} live={cpHere} onClick={onCompete}>
            <Podium />
          </ModeArt>
        )}
        {hasFranchise ? <FranchiseCard onClick={() => frRef.current?.()} /> : onSquad && (
          <ModeArt small kind="squad" tone="squad" title="SQUAD BUILDER" line={sqLine} onClick={onSquad}>
            {isBucket
              ? <Lineup />
              : <TeamRow />}
          </ModeArt>
        )}
        {!isBucket && (
          <ModeArt small kind="quick" tone="depth" title="DEPTH CHART" line="Mini game" onClick={onDepthChart}><DepthArt /></ModeArt>
        )}
      </div>
    </section>
  ), [sp, sport, isBucket, isSoccer, isBaseball, soon, career, crLine, cpLine, btLine, btLive, sqLine, here.blacktop, cpHere, onCareer, onBlacktop, onCompete, onSquad, onDepthChart, hasCFB, hasCBB, hasFranchise])

  return (
    <div className={`ag-home ag-home--${sport}`} ref={homeRef}>
      <div className="ag-home-inner">
        <HudOnce user={user} />
        <div className="ag-brand">
          <img src="/bap-mark.webp" alt="" className="ag-brand-mark" draggable={false} />
          <div className="ag-wordmark">
            BUI<i className="wm-k wm-k2">L</i>D<em><i className="wm-g1">-</i><i className="wm-g2">A</i><i className="wm-g3">-</i></em>{isBucket ? <>B<HoopU />CKET</> : <><i className="wm-k">P</i><i className="wm-k">L</i>AY<i className="wm-k wm-k2">E</i>R</>}
          </div>
        </div>

        <div className="ag-sport-wrap">
          <h2 className="ag-sport-label">PICK YOUR SPORT</h2>
          <SportOnce sport={sport} />
        </div>

        {/* Character-select stage under stadium lights: swipe it, or tap a position */}
        <div className="ag-stage"
          onPointerDown={e => { swipeFrom.current = e.clientX }}
          onPointerUp={e => { const from = swipeFrom.current; swipeFrom.current = null; if (from != null && Math.abs(e.clientX - from) > 48 && !e.target.closest('.ag-positions')) step(e.clientX < from ? 1 : -1) }}
          onPointerCancel={() => { swipeFrom.current = null }}>
          <div className="ag-stage-photo" />
          <div className="ag-stage-beam" />
          <span key={posWord} className="ag-stage-word" style={{ '--len': posWord.length }} aria-hidden="true">{posWord}</span>
          <OnlineNow />
          {/* the website doesn't open the tutorial by itself (cleared browser data
              would bring it back every visit): it's here when someone wants it */}
          {!IS_APP && <button className="ag-howto" onClick={() => { sfx('tap'); startTutorial() }}><span aria-hidden="true">?</span> HOW TO PLAY</button>}
          <div className={`ag-figure ag-figure--${isBucket || isSoccer || isBaseball ? 'nba' : position}`} key={position} style={{ '--from': `${dir.current * 14}px` }}>
            {isBucket || isSoccer || isBaseball
              ? renderBucketFigure?.(position, ready, fast || picked)
              : (
                <>
                  <img src={fig.src} alt="" draggable={false} className="ag-figure-base" style={fig.scale !== 1 ? { transform: `scale(${fig.scale})` } : undefined} />
                  <StackedSilhouette position={position} attrs={SPLASH_ATTRS[position]} ready={ready} fast={fast || picked} />
                </>
              )}
          </div>
          <div className="ag-platform"><span className="ag-platform-ring" /></div>
          {(() => {
            // one brick: a position, or one still coming (locked, SOON under it)
            const brick = (o, i, list, at) => o.locked ? (
              <div key={o.pos} role="tab" aria-selected="false" aria-disabled="true" className={`ag-pos ag-pos--locked${o.soon ? ' ag-pos--soon' : ''}`}>
                <span className="ag-pos-label"><IconLock size={13} /> {o.label}</span>
                {o.soon ? <span className="ag-pos-sub">SOON</span> : o.sub && <span className="ag-pos-sub">{o.sub}</span>}
              </div>
            ) : (
              <button key={o.pos} role="tab" aria-selected={o.pos === position} className={`ag-pos${o.pos === position ? ' ag-pos--on' : ''}`} onClick={() => { dir.current = i < at ? -1 : 1; pick(o.pos) }}>
                {((o.pos === 'lb' && LB_LIVE) || (o.pos === 'ol' && OL_LIVE) || (o.pos === 'k' && K_LIVE)) && <span className="ag-pos-new">NEW</span>}<span className="ag-pos-label">{o.label}</span>
                {o.sub && <span className="ag-pos-sub">{o.sub}</span>}
              </button>
            )
            if (!isNfl) return (
              <div className={`ag-positions${isBucket || isSoccer || isBaseball ? ' ag-positions--two' : ''}`} style={{ '--n': shown.length, '--i': posIdx }} role="tablist" aria-label="Position">
                {shown.map((o, i) => brick(o, i, shown, posIdx))}
              </div>
            )
            // football: offense, then a DEFENSE brick at the end; tap it and the bar slides over to the defense, an
            // OFFENSE brick first to slide back
            const sideList = k => positions.filter(o => (SIDE_OF[o.pos] ?? 'off') === k).sort((a, b) => (a.locked ? 1 : 0) - (b.locked ? 1 : 0) || (k === 'def' ? (SIDE_ORDER[a.pos] ?? 9) - (SIDE_ORDER[b.pos] ?? 9) : 0))
            const off = sideList('off'), def = sideList('def')
            const at = (list, k) => Math.max(0, list.findIndex(o => o.pos === sideFirst(k)?.pos))
            const sw = (k, label) => (
              <button key={`to-${k}`} className={`ag-pos ag-pos--side ag-pos--to-${k}`} onClick={() => pickSide(k)} aria-label={`Show the ${label.toLowerCase()}`}>
                {k === 'def' && (LB_LIVE || K_LIVE) && <span className="ag-pos-new">NEW</span>}
                <span className="ag-side-word">{label}</span>
                <svg className="ag-side-arrow" viewBox="0 0 24 10" width="24" height="10" aria-hidden="true"><path d={k === 'def' ? 'M1 5h20M16 1l5 4-5 4' : 'M23 5H3M8 1L3 5l5 4'} /></svg>
              </button>
            )
            return (
              <div className="ag-positions ag-positions--sides" role="tablist" aria-label="Position">
                <div className={`ag-side-track${view === 'def' ? ' is-def' : ''}`}>
                  <div className="ag-side-panel" style={{ '--n': off.length + 1, '--i': at(off, 'off') }} inert={view === 'def' ? '' : undefined}>
                    {off.map((o, i) => brick(o, i, off, at(off, 'off')))}{sw('def', 'DEFENSE')}
                  </div>
                  <div className="ag-side-panel" style={{ '--n': def.length + 1, '--i': at(def, 'def') + 1 }} inert={view === 'off' ? '' : undefined}>
                    {sw('off', 'OFFENSE')}{def.map((o, i) => brick(o, i, def, at(def, 'def')))}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* a build in progress waits right above PLAY */}
        {resume && (
          <button className="ag-resume ag-resume--top" onClick={resume.onClick}>
            <span className="ag-resume-icon"><IconPlay size={18} /></span>
            <span className="ag-card-txt">
              <span className="ag-eyebrow">CONTINUE</span>
              <span className="ag-resume-title">{resume.label}</span>
            </span>
          </button>
        )}

        <div className="ag-modes" role="radiogroup" aria-label="Player pool">
          {/* soccer's pools: the clubs of the top five leagues, and the World Cup's nations */}
          <ModeCard title={isSoccer ? SOCCER_POOL.current.label : 'CURRENT'} line={isSoccer ? SOCCER_POOL.current.line : `Today's ${PLURAL[position] ?? ''}`} faces={facesNow} on={pool === 'classic'} onClick={() => pickPool('classic')} />
          <ModeCard gold title={isSoccer ? SOCCER_POOL.alltime.label : 'ALL-TIME'} line={isSoccer ? SOCCER_POOL.alltime.line : `The greatest ${PLURAL[position] ?? ''}`} faces={facesGreat} on={pool === 'all-time'} onClick={() => pickPool('all-time')} />
        </div>

        <button className={`ag-start${pool === 'all-time' ? ' is-gold' : ''}`} onClick={() => start(pool)}>
          <b>PLAY</b>
          <small>{posShort} · {isSoccer ? SOCCER_POOL[pool === 'all-time' ? 'alltime' : 'current'].label : pool === 'all-time' ? 'ALL-TIME' : 'CURRENT'}</small>
        </button>

        {modes}

        {/* website: an ad under the mode cards, above the Builder Pass: the full width, no margins of its own (collapses when there's none) */}
        {!IS_APP && (
          <div key={`home-ad-${sport}`} className="ag-home-ad ag-home-ad--pair">
            <div id="ramp-cntr1-home" className="ag-home-ad-slot" />
            {HOME_AD_PAIR && <div id="ramp-cntr1-home-2" className="ag-home-ad-slot" />}
          </div>
        )}

        <PromosOnce />

        <BoardOnce />


      </div>
      {/* website: get the app (the official badge; hidden until the App Store link is set) */}
      {!IS_APP && APP_STORE_URL && (
        <div className="ag-getapp">
          <span className="ag-eyebrow">PLAY IT ON YOUR PHONE</span>
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Download on the App Store">
            <img src="/badges/app-store.svg" alt="Download on the App Store" width="150" height="50" />
          </a>
        </div>
      )}
      {footer && <div className="ag-home-site">{footer}</div>}
      {/* the app has no site footer: the maker's logo and the fan-project line on their own */}
      {IS_APP && <img className="ag-home-maker" src="/playmaker-games.png" alt="A Playmaker Games game" width="132" height="44" loading="lazy" draggable={false} />}
      {IS_APP && <Disclaimer sport={isBaseball ? 'baseball' : isSoccer ? 'soccer' : isBucket ? 'bucket' : 'nfl'} />}
      <Tutorial onGuided={() => onStart('classic', isBaseball ? 'bat' : isSoccer ? 'st' : isBucket ? 'guard' : 'qb')} />
    </div>
  )
}
