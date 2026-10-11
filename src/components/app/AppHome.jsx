import { useEffect, useState } from 'react'
import { POS_OPTIONS, AvatarTrio, StackedSilhouette, SPLASH_ATTRS } from '../SplashScreen'
import { getUsername } from '../../lib/discord'
import { useProgress } from '../../lib/progress'
import { IconCrown, IconBolt, IconClipboard, IconCoin, IconLock, IconProfile, IconArrow, IconGear, IconPodium, IconFootball, IconBasketball, IconPlay } from './icons'
import { sfx } from '../../lib/juice'
import SoundToggle from './SoundToggle'
import Tutorial from './Tutorial'
import { IS_APP } from '../../lib/platform'
import { NameTag, AvatarBadge } from './NameTag'
import { CoinPill } from './AppShop'
import { TierChip, Form } from './OnlineRecord'
import { tierFor } from '../../lib/progress'
import { W as MAP_W, H as MAP_H, OUTLINE_PATH } from '../../lib/usMap'

// Card art: the road map for Takeover, the pool's podium for Compete
function MapArt() {
  return (
    <svg className="ag-card-art ag-card-art--map" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <path d={OUTLINE_PATH} className="ag-map-land" clipRule="evenodd" />
      <path d="M190 220 L330 260 L470 190 L620 300 L760 240" className="ag-map-route" />
      {[[190, 220], [470, 190], [760, 240]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 2 ? 16 : 11} className={`ag-map-pin${i === 2 ? ' is-next' : ''}`} />)}
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

// Home screen — a game main menu. The app and the website (APP_LOOK) both use
// it in place of the old splash; same callbacks, so nothing else changes.
// Modes only show when their callback is passed (1v1 lives inside Blacktop).
// `footer` is the website's features + links, under the menu.
// Styling: src/app-game.css.

const NFL_FIGURE = {
  qb: { src: '/qb-silhouette.webp', scale: 1 },
  rb: { src: '/rb-silhouette.webp', scale: 1 },
  wr: { src: '/wr-silhouette.png', scale: 1.18 },
  te: { src: '/wr-silhouette.png', scale: 1.18 },
  db: { src: '/db-silhouette.png', scale: 1.05 },
}
const NFL_NAMES = { qb: 'Quarterback', rb: 'Running Back', wr: 'Wide Receiver', te: 'Tight End', db: 'Defensive Back', ol: 'O-Line' }
const PLURAL = { qb: 'QBs', rb: 'RBs', wr: 'WRs', te: 'TEs', db: 'DBs', guard: 'Guards', big: 'Bigs' }
const NEW_ALLTIME = new Set(['wr', 'te', 'db'])

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))
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
        <span className="ag-player-sub">{name ? `${p.lvl.title} · ${p.lvl.into.toLocaleString()}/${p.lvl.need.toLocaleString()} XP` : 'Sign in to earn XP and level up'}</span>
      </span>
    </button>
  )
}

function Hud({ user }) {
  return (
    <div className="ag-hud ag-pop" style={{ '--d': '0ms' }}>
      <PlayerChip user={user} onClick={() => nav('profile')} />
      <CoinPill className="ag-hud-coins" />
      <button className="ag-icon-btn" onClick={() => nav('leaderboard')} aria-label="Leaderboards"><IconPodium size={22} /></button>
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
  setTimeout(() => { window.location.href = to === 'bucket' ? '/bucket' : '/' }, 170)
}
function SportSwitch({ sport }) {
  const go = to => { if (to === sport) return; sfx('swap'); switchSport(to) }
  return (
    <div className={`ag-sport ag-sport--${sport} ag-pop`} style={{ '--d': '30ms' }} role="tablist" aria-label="Sport">
      <span className="ag-sport-thumb" aria-hidden="true" />
      <button role="tab" aria-selected={sport === 'nfl'} className={`ag-sport-btn ag-sport-btn--nfl${sport === 'nfl' ? ' is-on' : ''}`} onClick={() => go('nfl')}>
        <span className="ag-sport-ico"><IconFootball size={17} /></span>
        <span className="ag-sport-txt"><b>FOOTBALL</b><small>Build-A-Player</small></span>
      </button>
      <button role="tab" aria-selected={sport === 'bucket'} className={`ag-sport-btn ag-sport-btn--bucket${sport === 'bucket' ? ' is-on' : ''}`} onClick={() => go('bucket')}>
        <span className="ag-sport-ico"><IconBasketball size={17} /></span>
        <span className="ag-sport-txt"><b>BASKETBALL</b><small>Build-A-Bucket</small></span>
      </button>
    </div>
  )
}

// Blacktop card art: a half court
// Blacktop card art: a night run. Chain-link fence, a sodium streetlight, a
// hoop with a chain net, worn paint on the asphalt, three on three, and a
// ball that goes up and rattles the chains every few seconds (CSS, transforms only).
function BlacktopArt() {
  const squads = [[[150, 99], [178, 104], [214, 100]], [[162, 90], [198, 93], [224, 88]]]
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
      <polyline points="20,96 60,84 95,88 130,60 165,48 205,18" fill="none" stroke="url(#crg)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="205" cy="18" r="6" fill="#f5dc8a" />
      <circle cx="130" cy="60" r="3.5" fill="rgba(245,220,138,.7)" /><circle cx="60" cy="84" r="3.5" fill="rgba(245,220,138,.5)" />
    </svg>
  )
}

function ModeCard({ tone, title, badge, onClick, mark: Mark, isNew, delay }) {
  return (
    <button className={`ag-mode${tone ? ` ag-mode--${tone}` : ''} ag-pop`} style={{ '--d': delay }} onClick={onClick}>
      {Mark && <span className="ag-mode-mark"><Mark size={92} /></span>}
      {isNew && <span className="ag-mode-new">NEW</span>}
      <span className="ag-mode-title">{title}</span>
      <span className="ag-mode-badge">{badge}</span>
      <span className="ag-mode-cta">START DRAFTING <IconArrow size={15} /></span>
    </button>
  )
}

export default function AppHome({ sport = 'nfl', onStart, onDepthChart, onVersus, onBlacktop, blacktop, onTakeover, takeoverRun, onCompete, onCareer, career = null, resume = null, user, renderBucketFigure, footer = null }) {
  const prog = useProgress()
  const cs = prog.stats?.compete
  const ol = prog.stats?.online ?? { rating: 800, played: 0 }
  const h2h = prog.stats?.h2h ?? {}
  const btW = prog.stats?.btWins ?? 0, btG = prog.stats?.btGames ?? 0
  const isBucket = sport === 'bucket'
  const storeKey = isBucket ? 'bucketPosition' : 'lastPosition'
  const [position, setPosition] = useState(() => {
    let saved = null
    try { saved = localStorage.getItem(storeKey) } catch {}
    if (isBucket) return saved === 'big' ? 'big' : 'guard'
    return POS_OPTIONS.some(o => o.pos === saved && !o.disabled) ? saved : 'qb'
  })
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), 450); return () => clearTimeout(t) }, [])

  const pick = pos => { setPosition(pos); try { localStorage.setItem(storeKey, pos) } catch {} }
  const start = mode => { try { localStorage.setItem(storeKey, position) } catch {}; onStart(mode, position) }

  const positions = isBucket
    ? [{ pos: 'guard', label: 'GUARD', sub: 'PG · SG · SF' }, { pos: 'big', label: 'BIG', sub: 'PF · C' }]
    : POS_OPTIONS

  const fig = NFL_FIGURE[position] ?? NFL_FIGURE.qb
  const posShort = isBucket ? (position === 'big' ? 'BIG' : 'GUARD') : position.toUpperCase()
  const posName = isBucket ? (position === 'big' ? 'PF · C' : 'PG · SG · SF') : NFL_NAMES[position]
  const tkOn = !!takeoverRun && !takeoverRun.over
  const tkStops = takeoverRun?.route?.length ?? 12
  const tkEndless = tkOn && takeoverRun.idx >= tkStops
  const btLive = !!blacktop && blacktop.phase !== 'idle'

  return (
    <div className={`ag-home ag-home--${sport}`}>
      <div className="ag-bg" aria-hidden="true"><div className="ag-bg-lines" /></div>

      <div className="ag-home-inner">
        <Hud user={user} />
        <SportSwitch sport={sport} />

        <div className="ag-brand ag-pop" style={{ '--d': '60ms' }}>
          <img src="/logo-v3.png" alt="" className="ag-brand-mark" draggable={false} />
          <div className="ag-wordmark">
            BUILD<em>-A-</em>{isBucket ? <>B<HoopU />CKET</> : 'PLAYER'}
          </div>
        </div>

        {/* Character-select stage under stadium lights */}
        <div className="ag-stage ag-pop" style={{ '--d': '120ms' }}>
          <div className="ag-stage-photo" />
          <div className="ag-stage-beam" />
          <div className={`ag-figure${isBucket ? ' ag-figure--nba' : ''}`} key={position}>
            {isBucket
              ? renderBucketFigure?.(position, ready)
              : (
                <>
                  <img src={fig.src} alt="" draggable={false} className="ag-figure-base" style={fig.scale !== 1 ? { transform: `scale(${fig.scale})` } : undefined} />
                  <StackedSilhouette position={position} attrs={SPLASH_ATTRS[position]} ready={ready} />
                </>
              )}
          </div>
          <div className="ag-platform"><span className="ag-platform-ring" /></div>
          <div className="ag-stage-tag">
            <span className={`ag-stage-pos${posShort.length > 3 ? ' ag-stage-pos--long' : ''}`}>{posShort}</span>
            <span className="ag-tag"><span>{posName}</span></span>
          </div>
        </div>

        {/* Position select */}
        <div className={`ag-positions${isBucket ? ' ag-positions--two' : ''} ag-pop`} style={{ '--d': '180ms' }} role="tablist" aria-label="Position">
          {positions.map(o => {
            const on = o.pos === position
            if (o.disabled) {
              return (
                <div key={o.pos} className="ag-pos ag-pos--locked" aria-disabled="true">
                  <span className="ag-pos-lock"><IconLock size={14} /></span>
                  <span className="ag-pos-label">{o.label}</span>
                  <span className="ag-pos-soon">SOON</span>
                </div>
              )
            }
            return (
              <button key={o.pos} role="tab" aria-selected={on} className={`ag-pos${on ? ' ag-pos--on' : ''}`} onClick={() => pick(o.pos)}>
                {o.players && <span className="ag-pos-avs"><AvatarTrio players={o.players} size={20} /></span>}
                <span className="ag-pos-label">{o.label}</span>
                {o.sub && <span className="ag-pos-sub">{o.sub}</span>}
              </button>
            )
          })}
        </div>

        {/* Modes — the website's cards */}
        <div className="ag-modes">
          <ModeCard title="CURRENT" badge={`Current ${PLURAL[position] ?? ''}`} mark={IconBolt} delay="230ms" onClick={() => start('classic')}
            tone={isBucket ? 'orange' : null} />
          <ModeCard tone="gold" title="ALL-TIME" badge="Draft the Greats" mark={IconCrown} delay="270ms" onClick={() => start('all-time')}
            isNew={isBucket || NEW_ALLTIME.has(position)} />
        </div>

        <div className="ag-extras">
          {/* the flagship: one player, a whole career */}
          {onCareer && (
            <button className={`ag-crmode ag-pop${career ? ' is-live' : ''}`} style={{ '--d': '260ms' }} onClick={onCareer}>
              <CareerArt />
              <span className="ag-takeover-txt">
                <span className="ag-eyebrow">{career ? `${career.sport === 'bucket' ? (career.pos === 'big' ? 'BIG' : 'GUARD') : career.pos.toUpperCase()} · ${career.phase === 'draft' ? 'DRAFT DAY' : career.phase === 'retired' ? 'CAREER OVER' : `YEAR ${career.year + 1} · AGE ${career.age}`}` : 'MULTI-SEASON · SAVES AS YOU GO'}</span>
                <span className="ag-takeover-title">CAREER</span>
                <span className="ag-takeover-sub">{career ? (career.phase === 'draft' ? 'The combine is waiting. Go get drafted.' : career.phase === 'season' ? `${career.sport === 'bucket' ? 'Game' : 'Week'} ${(career.active?.k ?? 0) + 1} with the ${career.fit?.name ?? ''}` : career.phase === 'offseason' ? 'Offseason: a point to spend, a contract to sort' : career.phase === 'retired' ? `${career.seasons.length} seasons. See the legacy, or start a new career.` : `${career.fit?.name ?? ''} · ${career.seasons.length} ${career.seasons.length === 1 ? 'season' : 'seasons'} in`) : 'Build a player, get drafted, play a whole career. Legacy on the line.'}</span>
              </span>
            </button>
          )}
          {/* a build in progress: PLAY is Home now, so it waits here */}
          {resume && (
            <button className="ag-resume ag-pop" style={{ '--d': '280ms' }} onClick={resume.onClick}>
              <span className="ag-resume-icon"><IconPlay size={18} /></span>
              <span className="ag-takeover-txt">
                <span className="ag-eyebrow">BUILD IN PROGRESS</span>
                <span className="ag-resume-title">{resume.label}</span>
              </span>
            </button>
          )}
          {onCompete && (
            <button className="ag-compete ag-pop" style={{ '--d': '300ms' }} onClick={onCompete}>
              <PoolArt />
              <span className="ag-live-dot" />
              <span className="ag-takeover-txt">
                <span className="ag-eyebrow">{ol.played ? <>ONLINE · {tierFor(ol.rating)[1].toUpperCase()} · {ol.rating}</> : 'ONLINE · 5-PLAYER POOLS'}</span>
                <span className="ag-takeover-title">COMPETE</span>
                <span className="ag-takeover-sub">{cs?.played
                  ? `${cs.wins} ${cs.wins === 1 ? 'win' : 'wins'} in ${cs.played} · avg place ${(cs.placeSum / cs.played).toFixed(1)}${cs.streak >= 2 ? ` · ${cs.streak} straight` : ''}`
                  : 'Same spins as 4 other players. Highest OVR takes the pool.'}</span>
                {cs?.played > 0 && <span className="ag-rec"><Form items={cs.recent} mode="compete" /></span>}
              </span>
            </button>
          )}
          {/* Basketball: Blacktop is the online hub — 3v3 lobbies, and 1v1 from inside it */}
          {isBucket && onBlacktop && (
            <button className={`ag-blacktop ag-pop${btLive ? ' is-live' : ''}`} style={{ '--d': '320ms' }} onClick={onBlacktop}>
              <BlacktopArt />
              <span className="ag-live-dot" />
              <span className="ag-takeover-txt">
                <span className="ag-eyebrow">{btLive ? (blacktop.phase === 'queue' ? `IN THE LOBBY · ${blacktop.queue}/6 SPOTS TAKEN` : blacktop.phase === 'build' ? 'LIVE · YOUR SQUAD IS BUILDING' : 'LIVE · GAME ON') : 'ONLINE · 3V3 · 1V1'}</span>
                <span className="ag-takeover-title">BLACKTOP</span>
                <span className="ag-takeover-sub">{btLive ? 'You\'re still in. Jump back to your run.' : (btG || h2h.played) ? `3v3 ${btW}–${btG - btW} · 1v1 ${h2h.wins ?? 0}–${h2h.losses ?? 0}${ol.played ? ` · ${tierFor(ol.rating)[1]} ${ol.rating}` : ''}` : 'Live games against real players. Squads of three, or one on one.'}</span>
              </span>
            </button>
          )}
          {onTakeover && (
          <button className="ag-takeover ag-pop" style={{ '--d': '350ms' }} onClick={onTakeover}>
            <MapArt />
            <span className="ag-takeover-txt">
              <span className="ag-eyebrow">{tkOn ? (tkEndless ? `ENDLESS ROAD · ${takeoverRun.endlessWins} STRAIGHT` : `ON THE ROAD · ${takeoverRun.taken.length}/${tkStops} CITIES`) : 'ROAD MODE · 12 CITIES'}</span>
              <span className="ag-takeover-title">TAKEOVER</span>
              <span className="ag-takeover-sub">{tkOn ? `${takeoverRun.lives} ${takeoverRun.lives === 1 ? 'life' : 'lives'} left — your next stop is waiting` : 'Solo or duo. Cross the map, beat a better player in every city, steal their game.'}</span>
            </span>
          </button>
          )}
          {isBucket ? (
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
        </div>
      </div>
      {footer && <div className="ag-home-site">{footer}</div>}
      <Tutorial onGuided={() => onStart('classic', isBucket ? 'guard' : 'qb')} />
    </div>
  )
}
