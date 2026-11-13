import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { APP_STORE_URL } from '../../lib/storeLinks'
import { POS_OPTIONS, AvatarTrio, StackedSilhouette, SPLASH_ATTRS } from '../SplashScreen'
import { getUsername } from '../../lib/discord'
import { useProgress, fetchPlayersOfDay, cachedPlayersOfDay, myToday, POTD_COINS, tierFor } from '../../lib/progress'
import { IconCrown, IconBolt, IconClipboard, IconCoin, IconLock, IconProfile, IconArrow, IconGear, IconPodium, IconFootball, IconBasketball, IconPlay } from './icons'
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
import { Form } from './OnlineRecord'
import EmptyState from './EmptyState'
import { RollingNumber, RollText } from './MotionText'
import { HoopU, switchSport, SPORTS } from './AppHome'
import { SOCCER_POOL } from '../../lib/soccerUi'
import { BASEBALL_POS } from '../../lib/baseballUi'
import './home-classic.css'
import { LB_LIVE, LB_SOON } from '../../lib/lbLive'
import { OL_LIVE, OL_SOON } from '../../lib/olLive'
import { K_LIVE } from '../../lib/kLive'
import { CFB_CARD_SCHOOLS } from '../../lib/cfbLive'
import { CBB_CARD_LOGOS } from '../../lib/cbbLive'
import { FranchiseCardClassic } from '../franchise/FranchiseCard'   // (the card only: the mode itself loads when it's opened)

// Classic Home: the Home as it was live before the Nov 5 update (commit bb8f997, pushed
// Oct 29), put back beside today's for comparison. lib/homeLook.js picks which one shows.
// Same props and callbacks as AppHome, so every button goes where today's does.
// Styling: home-classic.css, generated from the old CSS and scoped to .ag-home--classic;
// the classes only this page uses are agc-*, so today's Home rules never reach it.
// Since then: DL is a position (with today's NEW tag), Compete's live count includes the
// Trait Auction, Players of the Day shows its prize per row and a loading state, and coming
// back from a mode keeps the scroll spot. The leaderboard button opens today's Ranks page.

// Card art: three players for Squad Builder (the one in front is yours), the pool's podium for Compete
function SquadArt() {
  const fig = (x, s) => `M${x - 26 * s} 96 C${x - 26 * s} ${70 - 6 * s} ${x - 14 * s} ${60 - 4 * s} ${x} ${60 - 4 * s} C${x + 14 * s} ${60 - 4 * s} ${x + 26 * s} ${70 - 6 * s} ${x + 26 * s} 96 Z`
  return (
    <svg className="ag-card-art ag-card-art--squad" viewBox="0 0 200 96" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      {[[52, .82], [148, .82], [100, 1]].map(([x, s], i) => (
        <g key={i} className={`ag-sq-fig${i === 2 ? ' is-lead' : ''}`}>
          <path d={fig(x, s)} />
          <circle cx={x} cy={46 - 6 * s} r={13 * s} />
        </g>
      ))}
    </svg>
  )
}
function PoolArt() {
  const bars = [[0, 42], [1, 64], [2, 34], [3, 26], [4, 18]]   // 2nd · 1st · 3rd · 4th · 5th
  return (
    <svg className="ag-card-art ag-card-art--pool" viewBox="0 0 150 80" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      {bars.map(([i, h]) => <rect key={i} x={8 + i * 28} y={76 - h} width={22} height={h} rx={5} className={`ag-pool-bar${i === 1 ? ' is-first' : ''}`} />)}
      <path d="M47 6 l2.6 5.3 5.9.9-4.3 4.1 1 5.8L47 19.4 41.8 22l1-5.8-4.3-4.1 5.9-.9z" className="ag-pool-star" />
    </svg>
  )
}

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
const NFL_NAMES = { qb: 'Quarterback', rb: 'Running Back', wr: 'Wide Receiver', te: 'Tight End', db: 'Defensive Back', dl: 'Defensive Line', lb: 'Linebacker', ol: 'Offensive Line', k: 'Kicker' }
const PLURAL = { bat: 'Hitters', pit: 'Pitchers', qb: 'QBs', rb: 'RBs', wr: 'WRs', te: 'TEs', db: 'DBs', dl: 'DLs', lb: 'LBs', ol: 'Linemen', k: 'Kickers', guard: 'Guards', big: 'Bigs' }
const NEW_ALLTIME = new Set(['wr', 'te', 'db'])
// the open positions first (DL opened after this Home), then the ones still to come
// (LB and OL are hidden, not shown as SOON, until their flags: lib/lbLive.js, lib/olLive.js)
const NFL_POSITIONS = [...POS_OPTIONS.filter(o => !o.disabled), ...POS_OPTIONS.filter(o => o.disabled && (o.pos !== 'ol' || OL_SOON) && (o.pos !== 'lb' || LB_SOON))]   // (LB and OL while they're coming soon: locked SOON tiles)

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))
// the figure's bands fall one by one once a page load, then just arrive
let figureShown = false
// Where the player was on home: a mode unmounts it, so this outlives the visit (a reload starts at the top)
let homeScroll = 0
// the website on a desktop-width screen: the home ad is a pair of boxes
const HOME_AD_PAIR = !IS_APP && typeof matchMedia === 'function' && matchMedia('(min-width: 769px)').matches
const openMenu = () => window.dispatchEvent(new CustomEvent('bap:menu'))

// Player card: avatar (spotlight colours) with level, name, title and XP bar
function PlayerChip({ user, onClick }) {
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
        <span className="ag-player-sub">{name ? `${p.lvl.title} · ${p.lvl.into.toLocaleString()}/${p.lvl.need.toLocaleString()} XP` : 'Sign in to earn XP and level up'}</span>
      </span>
    </button>
  )
}

// players online right now, website and app (lib/presence.js); nothing until a real count is in
function OnlineNow() {
  const real = crowd(usePresence()?.total ?? 0)
  if (!real) return null
  const n = real + 100   // the splash count reads +100 (owner's call: the live count runs low)
  return <span className="agc-live-count" aria-label={`${n} players online`}><b><i aria-hidden="true" /><RollingNumber value={n} format={fmtCount} /></b><small>ONLINE</small></span>
}

// an online mode's corner: how many are in it right now (a pill), else the plain live dot
function LiveCorner({ n }) {
  if (!(n > 0)) return <span className="ag-live-dot" />
  return <span className="ag-live-badge" aria-label={`${n} playing now`}><i aria-hidden="true" /><RollingNumber value={n} format={fmtCount} /><small>PLAYING</small></span>
}

function Hud({ user }) {
  return (
    <div className="agc-hud ag-pop" style={{ '--d': '0ms' }}>
      <PlayerChip user={user} onClick={() => nav('profile')} />
      <CoinPill className="ag-hud-coins" />
      {/* the old Leaderboards button: today's Ranks page (the dock's Ranks tab) */}
      <button className="ag-icon-btn" onClick={() => nav('leaderboard')} aria-label="Leaderboards"><IconPodium size={22} /></button>
      {!IS_APP && <SoundToggle className="ag-hud-sound" />}
      <button className="ag-icon-btn" onClick={openMenu} aria-label="Settings and more"><IconGear size={22} /></button>
    </div>
  )
}

function SportSwitch({ sport }) {
  const go = to => { if (to === sport) return; sfx('swap'); switchSport(to) }
  // (three sports once soccer is on: SPORTS in AppHome)
  const three = SPORTS.length > 2
  return (
    <div className={`agc-sport agc-sport--${sport}${three ? ' agc-sport--three' : ''}${SPORTS.length > 3 ? ' agc-sport--four' : ''} ag-pop`} style={{ '--d': '30ms', ...(three ? { '--si': Math.max(0, SPORTS.findIndex(s => s.id === sport)) } : {}) }} role="tablist" aria-label="Sport">
      <span className="agc-sport-thumb" aria-hidden="true" />
      {SPORTS.map(({ id, label, Icon, soon }) => (
        <button key={id} role="tab" aria-selected={sport === id} aria-disabled={soon && sport !== id ? 'true' : undefined} className={`ag-sport-btn ag-sport-btn--${id}${sport === id ? ' is-on' : ''}${soon && sport !== id ? ' is-soon' : ''}`} onClick={() => { if (!soon) go(id) }}>
          <span className="agc-sport-ico">{soon && sport !== id ? <IconLock size={15} /> : <Icon size={17} />}</span>
          <span className="agc-sport-txt"><b>{label}</b>{soon && sport !== id && <small className="ag-sport-soon">COMING SOON</small>}</span>
        </button>
      ))}
    </div>
  )
}

// Blacktop card art: a night run. Chain-link fence, a sodium streetlight, a
// hoop with a chain net, worn paint on the asphalt, three on three, and a
// ball that goes up and rattles the chains every few seconds (CSS, transforms only).
function BlacktopArt() {
  const squads = [[[150, 99], [178, 104], [214, 100]], [[198, 93], [224, 88]]]
  return (
    <svg className="bt-art" viewBox="0 0 240 110" aria-hidden="true" preserveAspectRatio="xMaxYMax meet">
      <defs>
        <pattern id="btFence" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V9M0 0H9" stroke="rgba(255,236,214,.16)" strokeWidth=".7" fill="none" />
        </pattern>
        <linearGradient id="btFenceFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset=".85" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="btFenceMask"><rect width="240" height="78" fill="url(#btFenceFade)" /></mask>
        <radialGradient id="btLamp" cx="62" cy="10" r="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffb661" stopOpacity=".55" /><stop offset=".35" stopColor="#ff9a3d" stopOpacity=".16" /><stop offset="1" stopColor="#ff9a3d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="btCone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc47a" stopOpacity=".34" /><stop offset="1" stopColor="#ffc47a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="240" height="110" fill="url(#btLamp)" className="bt-art-glow" />
      {/* the fence: mesh, a top rail, posts */}
      <rect width="240" height="78" fill="url(#btFence)" mask="url(#btFenceMask)" />
      <path d="M0 3H240M24 3V78M104 3V78M232 3V78" stroke="rgba(255,236,214,.14)" strokeWidth="1.4" fill="none" />
      {/* the asphalt and its paint: baseline, the lane, the arcs */}
      <rect y="80" width="240" height="30" fill="rgba(255,236,214,.035)" />
      <g className="bt-art-paint" fill="none" stroke="rgba(255,244,230,.42)" strokeWidth="1.3" strokeLinecap="round">
        <path d="M70 80H240" />
        <path d="M160 80L150 97H200L190 80" strokeDasharray="22 2 9 3 30 2" />
        <path d="M150 97A25 5.5 0 0 0 200 97" strokeDasharray="12 3 18 2" />
        <path d="M96 80Q175 128 254 80" strokeDasharray="40 3 26 2 50 4" opacity=".75" />
      </g>
      {/* the streetlight and its cone */}
      <polygon points="58,12 66,12 120,110 4,110" fill="url(#btCone)" className="bt-art-cone" />
      <path d="M48 110V8H63" stroke="rgba(255,236,214,.3)" strokeWidth="2" fill="none" />
      <rect x="57" y="7" width="12" height="4" rx="2" fill="#ffe2b0" className="bt-art-bulb" />
      {/* the hoop: pole, backboard, rim, chain net */}
      <path d="M175 46V80" stroke="rgba(255,236,214,.35)" strokeWidth="2.6" />
      <rect x="157" y="22" width="36" height="24" rx="1.5" fill="rgba(10,8,8,.55)" stroke="rgba(255,244,230,.7)" strokeWidth="1.4" />
      <rect x="168" y="31" width="14" height="10" fill="none" stroke="rgba(255,244,230,.55)" strokeWidth="1.1" />
      <g className="bt-art-net">
        <path d="M167.5 48L169.5 52L171.5 48L173.5 52L175 48L176.5 52L178.5 48L180.5 52L182.5 48M169.5 52L171 57L173 53L175 57L177 53L179 57L180.5 52M171 57L172.5 62L175 59L177.5 62L179 57"
          stroke="#c9ccd2" strokeWidth=".9" fill="none" strokeLinejoin="round" />
      </g>
      <ellipse cx="175" cy="47.5" rx="8.5" ry="2.2" fill="none" stroke="#ff7a2a" strokeWidth="1.8" />
      {/* three on three */}
      {squads.map((sq, t) => sq.map(([x, y], i) => (
        <g key={`${t}${i}`} className={`bt-art-p bt-art-p--${t}`}>
          <ellipse cx={x} cy={y + 3.6} rx="4.2" ry="1.2" fill="rgba(0,0,0,.45)" />
          <circle cx={x} cy={y} r="3.1" />
        </g>
      )))}
      {/* the shot: x runs linear, y rises and falls, so the ball arcs */}
      <g className="bt-art-shot-x"><g className="bt-art-shot-y">
        <circle cx="150" cy="93" r="3.3" fill="#ff8a3d" />
        <path d="M146.8 93H153.2M150 89.7V96.3" stroke="rgba(60,20,0,.55)" strokeWidth=".6" />
      </g></g>
    </svg>
  )
}

// Career card art: a stadium bowl and a rising legacy line
function CareerArt() {
  return (
    <svg className="ag-crmode-art" viewBox="0 0 220 110" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
      <defs><linearGradient id="crg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#f5dc8a" stopOpacity=".1" /><stop offset="1" stopColor="#f5dc8a" stopOpacity=".55" /></linearGradient></defs>
      <ellipse cx="150" cy="118" rx="120" ry="42" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="2" />
      <ellipse cx="150" cy="118" rx="92" ry="30" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="2" />
      <polyline points="20,96 60,84 95,88 130,60 165,48 205,18" fill="none" stroke="url(#crg)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="ag-cr-line" pathLength="100" />
      <circle cx="205" cy="18" r="6" fill="#f5dc8a" className="ag-cr-peak" />
      <circle cx="130" cy="60" r="3.5" fill="rgba(245,220,138,.7)" /><circle cx="60" cy="84" r="3.5" fill="rgba(245,220,138,.5)" />
    </svg>
  )
}

function ModeCard({ tone, title, badge, onClick, mark: Mark, isNew, delay }) {
  return (
    <button className={`ag-mode${tone ? ` ag-mode--${tone}` : ''} ag-pop`} style={{ '--d': delay }} onClick={onClick}>
      {Mark && <span className="agc-mode-mark"><Mark size={92} /></span>}
      {isNew && <span className="agc-mode-new">NEW</span>}
      <span className="agc-mode-title">{title}</span>
      <span className="agc-mode-badge">{badge}</span>
      <span className="agc-mode-cta">START DRAFTING <IconArrow size={15} /></span>
    </button>
  )
}

// Players of the Day: the five who earned the most XP today, across every mode
// (fetchPlayersOfDay). Refreshes every couple of minutes while home is open.
// The old look, with today's prize per row and its loading / failed states.
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
    <section className="agc-potd ag-pop" style={{ '--d': '420ms' }} aria-label="Players of the Day">
      <div className="agc-potd-head">
        <span className="agc-potd-crown"><IconCrown size={18} /></span>
        <span className="agc-potd-titles">
          <span className="ag-eyebrow">TODAY · EVERY MODE</span>
          <b className="agc-potd-title">PLAYERS OF THE DAY</b>
          <small className="agc-potd-pay">Top {POTD_COINS.length} at midnight ET win {POTD_COINS.map(n => n.toLocaleString()).join(' / ')} coins</small>
        </span>
      </div>
      {!rows ? (
        failed ? <p className="agc-potd-mine">Today's board didn't load. It'll try again in a minute.</p>
          : <ol className="agc-potd-list" aria-hidden="true">{POTD_COINS.map((_, i) => <li key={i} className="agc-potd-row is-wait" />)}</ol>
      ) : rows.length ? (
        <ol className="agc-potd-list">
          {rows.map((r, i) => (
            <li key={r.id} className={`agc-potd-row is-${i + 1}${r.id === me ? ' is-me' : ''}`}>
              <span className="agc-potd-rank">{i + 1}</span>
              <AvatarBadge cos={r.cos} uid={r.id} self={r.id === me} name={r.username} size={36} />
              <span className="agc-potd-name"><NameTag name={r.username} cos={r.cos} uid={r.id} self={r.id === me} /></span>
              <span className="agc-potd-prize"><IconCoin size={14} />{POTD_COINS[i]}</span>
              <span className="agc-potd-xp"><span><b>{(r.cos.today.xp ?? 0).toLocaleString()}</b> XP</span><small>{r.cos.today.g ?? 0} {r.cos.today.g === 1 ? 'game' : 'games'}</small></span>
            </li>
          ))}
        </ol>
      ) : <EmptyState kind="podium" small title="Nobody on the board yet">Play anything today to take #1.</EmptyState>}
      {rows && !inTop && (
        <p className="agc-potd-mine">{me
          ? <>{getUsername(p.user) || 'Player'} today: <b>{t.xp.toLocaleString()} XP</b> · {t.g} {t.g === 1 ? 'game' : 'games'}{rows.length === POTD_COINS.length ? <> · {Math.max(0, (rows[rows.length - 1].cos.today.xp ?? 0) - t.xp + 1).toLocaleString()} XP to make the top {POTD_COINS.length}</> : null}</>
          : 'Sign in to get on the board.'}</p>
      )}
    </section>
  )
}

export default function AppHomeClassic({ sport = 'nfl', onStart, onDepthChart, onBlacktop, blacktop, onSquad: onSquadIn, squad = null, onCompete: onCompeteIn, onCareer: onCareerIn, career = null, resume = null, user, renderBucketFigure, footer = null, soon = null, onCFB = null, onCBB = null, onFranchise = null }) {
  // (soccer: a mode still on its way isn't on the classic Home at all)
  const onSquad = soon?.squad ? null : onSquadIn, onCompete = soon?.compete ? null : onCompeteIn, onCareer = soon?.career ? null : onCareerIn
  const prog = useProgress()
  // Back from a mode, home opens where it was left (as today's Home does), for a moment, until the player moves it
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
  const isSoccer = sport === 'soccer'   // the striker, on the basketball figure for now
  const isBaseball = sport === 'baseball'   // a batter or a pitcher, on the basketball figure for now
  const storeKey = isBaseball ? 'baseballPosition' : isSoccer ? 'soccerPosition' : isBucket ? 'bucketPosition' : 'lastPosition'
  const [position, setPosition] = useState(() => {
    let saved = null
    try { saved = localStorage.getItem(storeKey) } catch {}
    if (isSoccer) return 'st'
    if (isBaseball) return saved === 'pit' ? 'pit' : 'bat'
    if (isBucket) return saved === 'big' ? 'big' : 'guard'
    return POS_OPTIONS.some(o => o.pos === saved && !o.disabled) ? saved : 'qb'
  })
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), figureShown ? 0 : 450); return () => clearTimeout(t) }, [])
  const [fast] = useState(() => figureShown)
  const [picked, setPicked] = useState(false)
  useEffect(() => { figureShown = true }, [])
  // the website: an in-page ad under Salary Cap / The Depth Chart (never in the app, never ad-free)
  useEffect(() => {
    if (IS_APP || document.documentElement.classList.contains('ads-hidden')) return
    // desktop: two boxes side by side (one 300x250 left the wide row mostly empty); phones: one
    rampAdd([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-home' }, ...(HOME_AD_PAIR ? [{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-home-2' }] : [])])
  }, [sport])

  const pick = pos => { setPicked(true); setPosition(pos); try { localStorage.setItem(storeKey, pos) } catch {} }
  const start = mode => { try { localStorage.setItem(storeKey, position) } catch {}; onStart(mode, position) }

  const positions = isBaseball
    ? ['bat', 'pit'].map(p => ({ pos: p, label: BASEBALL_POS[p].label, sub: BASEBALL_POS[p].sub }))
    : isSoccer
    ? [{ pos: 'st', label: 'ST', sub: 'Striker' }, { pos: 'gk', label: 'GK', disabled: true }]
    : isBucket
    ? [{ pos: 'guard', label: 'GUARD', sub: 'PG · SG · SF' }, { pos: 'big', label: 'BIG', sub: 'PF · C' }]
    : NFL_POSITIONS

  const fig = NFL_FIGURE[position] ?? NFL_FIGURE.qb
  const posShort = isBaseball ? (position === 'pit' ? 'PIT' : 'BAT') : isSoccer ? 'ST' : isBucket ? (position === 'big' ? 'BIG' : 'GUARD') : position.toUpperCase()
  const posName = isBaseball ? BASEBALL_POS[position]?.word ?? 'Batter' : isSoccer ? 'Striker' : isBucket ? (position === 'big' ? 'PF · C' : 'PG · SG · SF') : NFL_NAMES[position]
  const sqBuilt = squad ? squad.slots.filter(s => s.build).length : 0
  const sqLast = squad?.seasons?.[squad.seasons.length - 1] ?? null
  const btLive = !!blacktop && blacktop.phase !== 'idle'

  return (
    <div className={`ag-home ag-home--${sport} ag-home--classic`} ref={homeRef}>
      <div className="ag-bg" aria-hidden="true"><div className="ag-bg-lines" /></div>

      <div className="agc-home-inner">
        <Hud user={user} />
        <SportSwitch sport={sport} />

        <div className="agc-brand ag-pop" style={{ '--d': '60ms' }}>
          <OnlineNow />
          <img src="/bap-mark.webp" alt="" className="agc-brand-mark" draggable={false} />
          <div className="agc-wordmark">
            BUILD<em>-A-</em>{isBucket ? <>B<HoopU />CKET</> : 'PLAYER'}
          </div>
          {/* the website doesn't open the tutorial by itself (cleared browser data
              would bring it back every visit): it's here when someone wants it */}
          {!IS_APP && <button className="agc-howto" onClick={() => { sfx('tap'); startTutorial() }}><span aria-hidden="true">?</span> HOW TO PLAY</button>}
        </div>

        {/* Character-select stage under stadium lights */}
        <div className="agc-stage ag-pop" style={{ '--d': '120ms' }}>
          <div className="agc-stage-photo" />
          <div className="agc-stage-beam" />
          <div className={`agc-figure agc-figure--${isBucket || isSoccer || isBaseball ? 'nba' : position}`} key={position}>
            {isBucket || isSoccer || isBaseball
              ? renderBucketFigure?.(position, ready, fast || picked)
              : (
                <>
                  <img src={fig.src} alt="" draggable={false} className="agc-figure-base" style={fig.scale !== 1 ? { transform: `scale(${fig.scale})` } : undefined} />
                  <StackedSilhouette position={position} attrs={SPLASH_ATTRS[position]} ready={ready} fast={fast || picked} />
                </>
              )}
          </div>
          <div className="agc-platform"><span className="agc-platform-ring" /></div>
          <div className="agc-stage-tag">
            <span className={`agc-stage-pos${posShort.length > 3 ? ' agc-stage-pos--long' : ''}`}><RollText text={posShort} /></span>
            <span className="agc-tag"><span><RollText text={posName} /></span></span>
          </div>
        </div>

        {/* Position select */}
        <div className={`ag-positions${isBucket || isSoccer || isBaseball ? ' ag-positions--two' : ''} ag-pop`} style={{ '--d': '180ms' }} role="tablist" aria-label="Position">
          {positions.map(o => {
            const on = o.pos === position
            if (o.disabled) {
              return (
                <div key={o.pos} className="ag-pos ag-pos--locked" aria-disabled="true">
                  <span className="agc-pos-lock"><IconLock size={14} /></span>
                  <span className="agc-pos-label">{o.label}</span>
                  <span className="agc-pos-soon">SOON</span>
                </div>
              )
            }
            return (
              <button key={o.pos} role="tab" aria-selected={on} className={`ag-pos${on ? ' ag-pos--on' : ''}`} onClick={() => pick(o.pos)}>
                {((o.pos === 'lb' && LB_LIVE) || (o.pos === 'ol' && OL_LIVE) || (o.pos === 'k' && K_LIVE)) && <span className="ag-pos-new">NEW</span>}
                {o.players && <span className="agc-pos-avs"><AvatarTrio players={o.players} size={20} /></span>}
                <span className="agc-pos-label">{o.label}</span>
                {o.sub && <span className="agc-pos-sub">{o.sub}</span>}
              </button>
            )
          })}
        </div>

        {/* a build in progress: PLAY is Home now, so it waits here, right above the modes */}
        {resume && (
          <button className="ag-resume ag-resume--top ag-pop" style={{ '--d': '200ms' }} onClick={resume.onClick}>
            <span className="ag-resume-icon"><IconPlay size={18} /></span>
            <span className="ag-card-txt">
              <span className="ag-eyebrow">BUILD IN PROGRESS</span>
              <span className="ag-resume-title">{resume.label}</span>
            </span>
          </button>
        )}

        {/* Modes — the website's cards */}
        <div className="ag-modes">
          <ModeCard title={isSoccer ? SOCCER_POOL.current.label : 'CURRENT'} badge={isSoccer ? 'Top five leagues' : `Current ${PLURAL[position] ?? ''}`} mark={IconBolt} delay="230ms" onClick={() => start('classic')}
            tone={isBucket ? 'orange' : isSoccer ? 'soccer' : isBaseball ? 'baseball' : null} />
          <ModeCard tone="gold" title={isSoccer ? SOCCER_POOL.alltime.label : 'ALL-TIME'} badge={isSoccer ? '48 nations' : 'Draft the Greats'} mark={IconCrown} delay="270ms" onClick={() => start('all-time')}
            isNew={isBucket || NEW_ALLTIME.has(position)} />
        </div>

        <div className="ag-extras">
          {/* College Football: a football mode, first and full width (logos only: lib/cfbLive.js) */}
          {!isBucket && !isSoccer && !isBaseball && onCFB && (
            <button className="ag-way ag-mc ag-mc--cfb ag-cfb--classic ag-pop" style={{ '--d': '240ms', gridColumn: '1 / -1' }} onClick={onCFB}>
              <span className="ag-mc-head"><b>COLLEGE FOOTBALL<i className="ag-mc-tag">NEW</i></b><small>Conference spin · Heisman race</small></span>
              <span className="ag-cfb-band" aria-hidden="true">
                {CFB_CARD_SCHOOLS.map(sc => <img key={sc} src={`/logos/cfb/${sc}.png`} alt="" width="56" height="56" loading="lazy" decoding="async" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} />)}
              </span>
            </button>
          )}
          {/* College Basketball: the same card on basketball's Home (logos only: lib/cbbLive.js) */}
          {isBucket && onCBB && (
            <button className="ag-way ag-mc ag-mc--cfb ag-mc--cbb ag-cfb--classic ag-pop" style={{ '--d': '240ms', gridColumn: '1 / -1' }} onClick={onCBB}>
              <span className="ag-mc-head"><b>COLLEGE BASKETBALL<i className="ag-mc-tag">NEW</i></b><small>Conference spin · March Madness</small></span>
              <span className="ag-cfb-band" aria-hidden="true">
                {CBB_CARD_LOGOS.map(sc => <img key={sc} src={sc} alt="" width="56" height="56" loading="lazy" decoding="async" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} />)}
              </span>
            </button>
          )}
          {/* Basketball: Blacktop is the online hub — 3v3 lobbies, and 1v1 from inside it.
              Styled like the Blacktop menu it opens: the orange 3V3 / 1V1 tags, warm panel, orange go */}
          {isBucket && onBlacktop && (
            <button className={`ag-blacktop ag-blacktop--menu ag-pop${btLive ? ' is-live' : ''}`} style={{ '--d': '250ms' }} onClick={onBlacktop}>
              <BlacktopArt />
              <LiveCorner n={btLive ? 0 : here.blacktop} />
              <span className="ag-bt-tags" aria-hidden="true"><span className="bt-mode-tag">2V2</span><span className="bt-mode-tag">3V3</span></span>
              <span className="ag-card-txt">
                <span className="ag-eyebrow"><RollText text={!btLive ? 'LIVE' : blacktop.phase === 'queue' ? 'IN THE LOBBY' : blacktop.phase === 'build' ? 'LIVE · YOUR SQUAD IS BUILDING' : 'LIVE · GAME ON'} />{btLive ? (blacktop.phase === 'queue' && <> · <RollingNumber value={blacktop.queue} />/6 SPOTS TAKEN</>) : ' · FIRST TO 11'}</span>
                <span className="ag-card-title">BLACKTOP</span>
                <span className="ag-card-sub">{btLive ? 'You\'re still in. Jump back to your run.' : (btG || h2h.played) ? `Squads ${btW}–${btG - btW} · 1v1 ${h2h.wins ?? 0}–${h2h.losses ?? 0}${ol.played ? ` · ${tierFor(ol.rating)[1]} ${ol.rating}` : ''}` : '1v1, 2v2 or 3v3. Real players.'}</span>
              </span>
            </button>
          )}
          {onCareer && (
            <button className={`ag-crmode ag-pop${career ? ' is-live' : ''}`} style={{ '--d': '260ms' }} onClick={onCareer}>
              <CareerArt />
              <span className="ag-card-txt">
                <span className="ag-eyebrow">{career ? `${career.sport === 'bucket' ? (career.pos === 'big' ? 'BIG' : 'GUARD') : career.pos.toUpperCase()} · ${career.phase === 'college' ? 'IN COLLEGE' : career.phase === 'draft' ? (career.sport === 'soccer' ? 'ACADEMY' : 'DRAFT DAY') : career.phase === 'retired' ? 'CAREER OVER' : `YEAR ${career.year + 1} · AGE ${career.age}`}` : 'MULTI-SEASON · SAVES AS YOU GO'}</span>
                <span className="ag-card-title">CAREER</span>
                <span className="ag-card-sub">{career ? (career.phase === 'college' ? 'College first: a season or two, then the draft.' : career.phase === 'draft' ? (career.sport === 'soccer' ? 'The academy trials are waiting. Earn a first contract.' : 'The combine is waiting. Go get drafted.') : career.phase === 'season' ? `${career.sport === 'soccer' ? 'Match' : career.sport === 'bucket' || career.sport === 'baseball' ? 'Game' : 'Week'} ${(career.active?.k ?? 0) + 1} with ${career.sport === 'soccer' ? '' : 'the '}${career.fit?.name ?? ''}` : career.phase === 'offseason' ? (career.sport === 'soccer' ? 'The summer: a point to spend, the transfer window' : 'Offseason: a point to spend, a contract to sort') : career.phase === 'retired' ? `${career.seasons.length} seasons. See the legacy, or start a new career.` : `${career.fit?.name ?? ''} · ${career.seasons.length} ${career.seasons.length === 1 ? 'season' : 'seasons'} in`) : isBaseball ? 'Build a player, get drafted, climb to the majors, play a whole career. Cooperstown on the line.' : isSoccer ? 'Build a striker, come through the academy, play a whole career. Legacy on the line.' : 'Build a player, get drafted, play a whole career. Legacy on the line.'}</span>
              </span>
            </button>
          )}
          {onCompete && (
            <button className="ag-compete ag-pop" style={{ '--d': '300ms' }} onClick={onCompete}>
              <PoolArt />
              <LiveCorner n={cpHere} />
              <span className="ag-card-txt">
                <span className="ag-eyebrow">{ol.played ? <>ONLINE · {tierFor(ol.rating)[1].toUpperCase()} · {ol.rating}</> : 'ONLINE · 5-PLAYER POOLS'}</span>
                <span className="ag-card-title">COMPETE</span>
                <span className="ag-card-sub">{cs?.played
                  ? `${cs.wins} ${cs.wins === 1 ? 'win' : 'wins'} in ${cs.played} · avg place ${(cs.placeSum / cs.played).toFixed(1)}${cs.streak >= 2 ? ` · ${cs.streak} straight` : ''}`
                  : 'Same spins as 4 other players. Highest OVR takes the pool.'}</span>
                {cs?.played > 0 && <span className="ag-rec"><Form items={cs.recent} mode="compete" /></span>}
              </span>
            </button>
          )}
          {/* Franchise (football, lib/franchiseLive.js): while its switch is on, its row takes SQUAD BUILDER's place */}
          {onFranchise && !isBucket && !isSoccer && !isBaseball ? <FranchiseCardClassic onClick={onFranchise} /> : onSquad && (
          <button className={`ag-squad ag-pop${squad ? ' is-live' : ''}`} style={{ '--d': '350ms' }} onClick={onSquad}>
            <SquadArt />
            <span className="ag-card-txt">
              <span className="ag-eyebrow">{!squad ? 'ONE SEASON · YOUR SQUAD'
                : squad.phase === 'build' ? `BUILDING · ${sqBuilt} OF ${squad.slots.length}`
                : squad.team ? `${squad.team} · ${squad.slots.length} ${squad.slots.length === 1 ? 'BUILD' : 'BUILDS'}`
                : `${squad.slots.length} ${squad.slots.length === 1 ? 'BUILD' : 'BUILDS'} · PICK A TEAM`}</span>
              <span className="ag-card-title">SQUAD BUILDER</span>
              <span className="ag-card-sub">{!squad ? 'Build a few players, drop them on a real team, play a season together.'
                : squad.phase === 'build' ? 'Your squad is waiting on its next build.'
                : sqLast && squad.phase === 'result' ? (isSoccer ? `${sqLast.wins}-${sqLast.draws ?? 0}-${sqLast.losses}${sqLast.champion ? ', champions' : ''} with ${sqLast.team}. Run it back.` : `${sqLast.wins}-${sqLast.losses}${sqLast.champion ? ', champions' : sqLast.playoffs ? ', playoffs' : ''} with the ${sqLast.team}. Run it back.`)
                : 'The season is ready to play.'}</span>
            </span>
          </button>
          )}
          {isSoccer || isBaseball ? (
            !soon?.salary && (
              <button className="ag-mini ag-mini--purple ag-pop" style={{ '--d': '380ms', gridColumn: '1 / -1' }} onClick={() => start('salarycap')}>
                <span className="ag-mini-flag">DAILY</span>
                <span className="ag-mini-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconCoin size={17} /> SALARY CAP</span>
                <span className="ag-mini-sub">{isBaseball ? 'Build on a budget' : 'Build a striker on a budget'}</span>
              </button>
            )
          ) : isBucket ? (
            <>
              <button className="ag-mini ag-mini--purple ag-pop" style={{ '--d': '380ms', gridColumn: '1 / -1' }} onClick={() => start('salarycap')}>
                <span className="ag-mini-flag">DAILY</span>
                <span className="ag-mini-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconCoin size={17} /> SALARY CAP</span>
                <span className="ag-mini-sub">Build on a budget</span>
              </button>
            </>
          ) : (
            <>
              <button className="ag-mini ag-mini--purple ag-pop" style={{ '--d': '330ms' }} onClick={() => start('salarycap')}>
                <span className="ag-mini-flag">DAILY</span>
                <span className="ag-mini-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconCoin size={17} /> SALARY CAP</span>
                <span className="ag-mini-sub">Build a QB on a budget</span>
              </button>
              <button className="ag-mini ag-pop" style={{ '--d': '360ms' }} onClick={onDepthChart}>
                <span className="ag-mini-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconClipboard size={17} /> THE DEPTH CHART</span>
                <span className="ag-mini-sub" style={{ color: '#fbbf24' }}>Sort the stars by the stat</span>
              </button>
            </>
          )}
          {/* website: an ad right under those, the full width, no margins of its own (collapses when there's none) */}
          {!IS_APP && (
            <div key={`home-ad-${sport}`} className="ag-home-ad ag-home-ad--pair">
              <div id="ramp-cntr1-home" className="ag-home-ad-slot" />
              {HOME_AD_PAIR && <div id="ramp-cntr1-home-2" className="ag-home-ad-slot" />}
            </div>
          )}
        </div>
        <div className="agc-promos">
          <PassStrip />
          <ProCard delay="410ms" />
        </div>
        <PlayersOfDay />
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
