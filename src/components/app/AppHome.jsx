import { useEffect, useState } from 'react'
import { POS_OPTIONS, AvatarTrio, StackedSilhouette, SPLASH_ATTRS } from '../SplashScreen'
import { getUsername } from '../../lib/discord'
import { useProgress, dailyState } from '../../lib/progress'
import { IconCrown, IconBolt, IconClipboard, IconCoin, IconVersus, IconLock, IconProfile, IconArrow, IconGear, IconPodium } from './icons'

// iOS/Android app home screen — a game main menu in place of the website
// splash (App / BucketApp render this instead of SplashScreen / BucketSplash
// when IS_APP). Same callbacks the website splash uses, so nothing else
// changes. All styling lives in src/app-game.css (ag-* classes).

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
      <span className="ag-avatar">
        {name ? name.slice(0, 1).toUpperCase() : <IconProfile size={22} />}
        <span className="ag-avatar-lvl">{p.lvl.level}</span>
      </span>
      <span className="ag-player-txt">
        <span className="ag-player-row">
          <span className="ag-player-name">{name ?? 'Guest'}</span>
          <span className="ag-player-title">{p.lvl.title}</span>
        </span>
        <span className="ag-xpbar"><span style={{ width: `${Math.max(3, p.lvl.pct * 100)}%` }} /></span>
        <span className="ag-player-sub">{name ? `${p.lvl.into.toLocaleString()} / ${p.lvl.need.toLocaleString()} XP` : 'Sign in to save your career'}</span>
      </span>
    </button>
  )
}

function Hud({ user }) {
  return (
    <div className="ag-hud ag-pop" style={{ '--d': '0ms' }}>
      <PlayerChip user={user} onClick={() => nav('profile')} />
      <button className="ag-icon-btn" onClick={() => nav('leaderboard')} aria-label="Leaderboards"><IconPodium size={22} /></button>
      <button className="ag-icon-btn" onClick={openMenu} aria-label="Settings and more"><IconGear size={22} /></button>
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

function DailyBanner({ isBucket }) {
  useProgress()   // re-render when today's result lands
  const dc = dailyState()
  const label = `${dc.pos.toUpperCase()} · ${dc.mode === 'all-time' ? 'All-Time' : 'Current'}`
  const go = () => { if (isBucket) window.location.href = '/?daily=1'; else nav('daily-challenge') }
  return (
    <button className="ag-daily-banner ag-pop" style={{ '--d': '300ms' }} onClick={dc.done ? () => nav('daily') : go}>
      <span>
        <span className="ag-eyebrow">DAILY CHALLENGE{isBucket ? ' · FOOTBALL' : ''}</span>
        <span className="ag-daily-title" style={{ display: 'block' }}>{label}</span>
        <span className="ag-daily-sub" style={{ display: 'block' }}>Same spins for everyone. One shot.</span>
      </span>
      {dc.done
        ? <span className="ag-daily-score"><b>{dc.ovr}</b><span>OVR · VIEW BOARD</span></span>
        : <span className="ag-btn ag-daily-go">{dc.spins > 0 ? 'RESUME' : 'PLAY'}</span>}
    </button>
  )
}

export default function AppHome({ sport = 'nfl', onStart, onDepthChart, onVersus, onBlacktop, blacktop, onTakeover, takeoverRun, user, renderBucketFigure }) {
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
  const tkStops = takeoverRun?.route?.length ?? 16
  const tkEndless = tkOn && takeoverRun.idx >= tkStops
  const btLive = !!blacktop && blacktop.phase !== 'idle'

  return (
    <div className={`ag-home ag-home--${sport}`}>
      <div className="ag-bg" aria-hidden="true"><div className="ag-bg-lines" /></div>

      <div className="ag-home-inner">
        <Hud user={user} />

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
          <DailyBanner isBucket={isBucket} />
          <button className="ag-takeover ag-pop" style={{ '--d': '320ms' }} onClick={onTakeover}>
            <span className="ag-takeover-txt">
              <span className="ag-eyebrow">{tkOn ? (tkEndless ? `ENDLESS ROAD · ${takeoverRun.endlessWins} STRAIGHT` : `ON THE ROAD · ${takeoverRun.taken.length}/${tkStops} CITIES`) : 'ROAD MODE · 16 CITIES · SOLO OR DUO'}</span>
              <span className="ag-takeover-title">TAKEOVER</span>
              <span className="ag-takeover-sub">{tkOn ? `${takeoverRun.lives} ${takeoverRun.lives === 1 ? 'life' : 'lives'} left — your next stop is waiting` : 'Cross the map. Beat a better player in every city. Steal their game.'}</span>
            </span>
            <span className="ag-edge-go">{tkOn ? 'RESUME' : 'START'} <IconArrow size={14} /></span>
          </button>
          {isBucket && (
            <button className={`ag-blacktop ag-pop${btLive ? ' is-live' : ''}`} style={{ '--d': '350ms' }} onClick={onBlacktop}>
              <span className="ag-live-dot" />
              <span className="ag-takeover-txt">
                <span className="ag-eyebrow">{btLive ? (blacktop.phase === 'queue' ? `IN THE QUEUE · ${blacktop.queue}/6` : blacktop.phase === 'build' ? 'LIVE · YOUR SQUAD IS BUILDING' : 'LIVE · GAME ON') : 'LIVE · 3V3'}</span>
                <span className="ag-takeover-title">BLACKTOP</span>
                <span className="ag-takeover-sub">{btLive ? 'You\'re still in. Jump back to your run.' : 'Squad up with five others. Team chat, 3:00 to build, first to 21.'}</span>
              </span>
              <span className="ag-edge-go">{btLive ? 'RESUME' : 'QUEUE'} <IconArrow size={14} /></span>
            </button>
          )}
          {isBucket ? (
            <>
              <button className="ag-mini ag-mini--purple ag-pop" style={{ '--d': '380ms' }} onClick={() => start('salarycap')}>
                <span className="ag-mini-flag">DAILY</span>
                <span className="ag-mini-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconCoin size={17} /> SALARY CAP</span>
                <span className="ag-mini-sub">Build on a budget</span>
              </button>
              <button className="ag-mini ag-pop" style={{ '--d': '370ms' }} onClick={() => onVersus?.(position)}>
                <span className="ag-mini-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconVersus size={17} /> HEAD-TO-HEAD</span>
                <span className="ag-mini-sub">1v1 a friend</span>
              </button>
              <button className="ag-mini ag-mini--mint ag-pop" style={{ '--d': '400ms', gridColumn: '1 / -1' }}
                onClick={() => { try { localStorage.removeItem('bap_progress') } catch {}; window.location.href = '/' }}>
                <span className="ag-mini-title">BUILD<em>-A-</em>PLAYER</span>
                <span className="ag-mini-sub">Football builder</span>
              </button>
            </>
          ) : (
            <>
              <button className="ag-mini ag-pop" style={{ '--d': '340ms' }} onClick={onDepthChart}>
                <span className="ag-mini-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconClipboard size={17} /> THE DEPTH CHART</span>
                <span className="ag-mini-sub" style={{ color: '#fbbf24' }}>Mini game</span>
              </button>
              <button className="ag-mini ag-mini--orange ag-pop" style={{ '--d': '370ms' }}
                onClick={() => { try { localStorage.removeItem('bap_progress') } catch {}; window.location.href = '/bucket' }}>
                <span className="ag-mini-title">BUILD<em>-A-</em>B<HoopU />CKET</span>
                <span className="ag-mini-sub">Basketball builder</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
