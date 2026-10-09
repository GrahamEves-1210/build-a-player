import { useEffect, useState } from 'react'
import { POS_OPTIONS, AvatarTrio, StackedSilhouette, SPLASH_ATTRS } from '../SplashScreen'
import { getUsername } from '../../lib/discord'
import { useProgress } from '../../lib/progress'
import { IconCrown, IconBolt, IconClipboard, IconCoin, IconVersus, IconLock, IconProfile, IconArrow, IconGear, IconPodium, IconFootball, IconBasketball, IconPlay } from './icons'
import { sfx } from '../../lib/juice'
import { NameTag, AvatarBadge } from './NameTag'
import { CoinPill } from './AppShop'
import { TierChip, Form } from './OnlineRecord'
import { tierFor } from '../../lib/progress'

// Home screen — a game main menu. The app and the website (APP_LOOK) both use
// it in place of the old splash; same callbacks, so nothing else changes.
// Modes only show when their callback is passed (football Head-to-Head is
// website-only). `footer` is the website's features + links, under the menu.
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
        <span className="ag-avatar"><IconProfile size={22} /><span className="ag-avatar-lvl">{p.lvl.level}</span></span>
      )}
      <span className="ag-player-txt">
        <span className="ag-player-row">
          <span className="ag-player-name">{name ? <NameTag self name={name} /> : 'Guest'}</span>
          <span className="ag-player-title">{p.lvl.title}</span>
        </span>
        <span className="ag-xpbar"><span style={{ width: `${Math.max(3, p.lvl.pct * 100)}%` }} /></span>
        <span className="ag-player-sub">{name ? `${p.lvl.title} · ${p.lvl.into.toLocaleString()}/${p.lvl.need.toLocaleString()} XP` : 'Sign in to save your career'}</span>
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

export default function AppHome({ sport = 'nfl', onStart, onDepthChart, onVersus, onBlacktop, blacktop, onTakeover, takeoverRun, onCompete, resume = null, user, renderBucketFigure, footer = null }) {
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
          {/* a build in progress: PLAY is Home now, so it waits here */}
          {resume && (
            <button className="ag-resume ag-pop" style={{ '--d': '280ms' }} onClick={resume.onClick}>
              <span className="ag-resume-icon"><IconPlay size={18} /></span>
              <span className="ag-takeover-txt">
                <span className="ag-eyebrow">BUILD IN PROGRESS</span>
                <span className="ag-resume-title">{resume.label}</span>
              </span>
              <span className="ag-edge-go">RESUME <IconArrow size={14} /></span>
            </button>
          )}
          {onCompete && (
            <button className="ag-compete ag-pop" style={{ '--d': '300ms' }} onClick={onCompete}>
              <span className="ag-live-dot" />
              <span className="ag-takeover-txt">
                <span className="ag-eyebrow">{ol.played ? <>ONLINE · {tierFor(ol.rating)[1].toUpperCase()} · {ol.rating}</> : 'ONLINE · 5-PLAYER POOLS'}</span>
                <span className="ag-takeover-title">COMPETE</span>
                <span className="ag-takeover-sub">{cs?.played
                  ? `${cs.wins} ${cs.wins === 1 ? 'win' : 'wins'} in ${cs.played} · avg place ${(cs.placeSum / cs.played).toFixed(1)}${cs.streak >= 2 ? ` · ${cs.streak} straight` : ''}`
                  : 'Same spins as 4 other players. Highest OVR takes the pool.'}</span>
                {cs?.played > 0 && <span className="ag-rec"><Form items={cs.recent} mode="compete" /></span>}
              </span>
              <span className="ag-edge-go">QUEUE <IconArrow size={14} /></span>
            </button>
          )}
          {onTakeover && (
          <button className="ag-takeover ag-pop" style={{ '--d': '320ms' }} onClick={onTakeover}>
            <span className="ag-takeover-txt">
              <span className="ag-eyebrow">{tkOn ? (tkEndless ? `ENDLESS ROAD · ${takeoverRun.endlessWins} STRAIGHT` : `ON THE ROAD · ${takeoverRun.taken.length}/${tkStops} CITIES`) : 'ROAD MODE · 12 CITIES · SOLO OR DUO'}</span>
              <span className="ag-takeover-title">TAKEOVER</span>
              <span className="ag-takeover-sub">{tkOn ? `${takeoverRun.lives} ${takeoverRun.lives === 1 ? 'life' : 'lives'} left — your next stop is waiting` : 'Cross the map. Beat a better player in every city. Steal their game.'}</span>
            </span>
            <span className="ag-edge-go">{tkOn ? 'RESUME' : 'START'} <IconArrow size={14} /></span>
          </button>
          )}
          {/* Basketball's online hub: Blacktop 3v3 lobbies and 1v1 Head-to-Head */}
          {isBucket && (onBlacktop || onVersus) && (
            <div className={`ag-online ag-pop${btLive ? ' is-live' : ''}`} style={{ '--d': '350ms' }}>
              <span className="ag-online-head">
                <span className="ag-online-badge"><span className="ag-live-dot" />ONLINE</span>
                <span className="ag-online-note">{btLive ? (blacktop.phase === 'queue' ? `In the lobby · ${blacktop.queue}/6 spots taken` : blacktop.phase === 'build' ? 'Your squad is building' : 'Game on') : (btG || h2h.played) ? `3v3 ${btW}–${btG - btW} · 1v1 ${h2h.wins ?? 0}–${h2h.losses ?? 0}` : 'Live games against real players'}</span>
                {ol.played > 0 && <span className="ag-rec" style={{ marginLeft: 'auto' }}><TierChip rating={ol.rating} />{ol.rating}</span>}
              </span>
              <span className="ag-takeover-title">BLACKTOP</span>
              <span className="ag-online-btns">
                {onBlacktop && (
                  <button className="ag-online-btn ag-online-btn--main" onClick={onBlacktop}>
                    <b>{btLive ? 'RESUME 3V3' : '3V3 LOBBY'}</b><small>Two guards and a big · first to 21</small>
                  </button>
                )}
                {onVersus && (
                  <button className="ag-online-btn" onClick={() => onVersus(position)}>
                    <b><IconVersus size={15} /> 1V1</b><small>Head-to-head a friend</small>
                  </button>
                )}
              </span>
            </div>
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
              <button className="ag-mini ag-pop" style={{ '--d': '340ms', gridColumn: onVersus ? undefined : '1 / -1' }} onClick={onDepthChart}>
                <span className="ag-mini-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconClipboard size={17} /> THE DEPTH CHART</span>
                <span className="ag-mini-sub" style={{ color: '#fbbf24' }}>{onVersus ? 'Sort the stars by the stat' : 'Mini game · sort the stars by the stat'}</span>
              </button>
              {onVersus && (
                <button className="ag-mini ag-pop" style={{ '--d': '370ms' }} onClick={() => onVersus(position)}>
                  <span className="ag-mini-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconVersus size={17} /> HEAD-TO-HEAD</span>
                  <span className="ag-mini-sub">{h2h.played ? `${h2h.wins}W–${h2h.losses}L${h2h.streak >= 2 ? ` · ${h2h.streak} straight` : ''}` : '1v1 a friend'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {footer && <div className="ag-home-site">{footer}</div>}
    </div>
  )
}
