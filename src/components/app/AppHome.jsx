import { useEffect, useState } from 'react'
import { POS_OPTIONS, AvatarTrio, StackedSilhouette, SPLASH_ATTRS } from '../SplashScreen'
import { getUsername } from '../../lib/discord'
import { IconFootball, IconBasketball, IconCrown, IconBolt, IconClipboard, IconCoin, IconVersus, IconLock, IconProfile, IconPlay } from './icons'

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
const NFL_NAMES = { qb: 'Quarterback', rb: 'Running Back', wr: 'Wide Receiver', te: 'Tight End', db: 'Defensive Back', ol: 'O-Line', lb: 'Linebacker', dl: 'D-Line' }
const NEW_ALLTIME = new Set(['wr', 'te', 'db'])

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

function Hud({ sport, user }) {
  const name = getUsername(user)
  const isBucket = sport === 'bucket'
  return (
    <div className="ag-hud ag-pop" style={{ '--d': '0ms' }}>
      <button className="ag-player-chip" onClick={() => nav('profile')}>
        <span className="ag-player-av">
          {name ? name.slice(0, 1).toUpperCase() : <IconProfile size={20} />}
        </span>
        <span className="ag-player-txt">
          <span className="ag-player-name">{name ?? 'Guest'}</span>
          <span className="ag-player-sub">{name ? 'View profile' : 'Tap to sign in'}</span>
        </span>
      </button>
      <div className="ag-sport-switch" role="tablist" aria-label="Game">
        <button role="tab" aria-selected={!isBucket} className={`ag-sport${!isBucket ? ' ag-sport--on ag-sport--nfl' : ''}`}
          onClick={() => { if (isBucket) window.location.href = '/' }} aria-label="Build-A-Player (football)">
          <IconFootball size={22} />
        </button>
        <button role="tab" aria-selected={isBucket} className={`ag-sport${isBucket ? ' ag-sport--on ag-sport--nba' : ''}`}
          onClick={() => { if (!isBucket) { try { localStorage.removeItem('bap_progress') } catch {}; window.location.href = '/bucket' } }} aria-label="Build-A-Bucket (basketball)">
          <IconBasketball size={22} />
        </button>
      </div>
    </div>
  )
}

function ModeButton({ color, icon: Icon, title, sub, badge, onClick, wide, delay, disabled }) {
  return (
    <button className={`ag-btn ag-btn--${color} ag-mode${wide ? ' ag-mode--wide' : ''} ag-pop`} style={{ '--d': delay }} onClick={onClick} disabled={disabled}>
      {badge && <span className={`ag-ribbon ag-ribbon--${badge.color}`}>{badge.text}</span>}
      <span className="ag-mode-icon"><Icon size={wide ? 30 : 28} /></span>
      <span className="ag-mode-txt">
        <span className={`ag-mode-title${title.length > 10 && !wide ? ' ag-mode-title--long' : ''}`}>{title}</span>
        <span className="ag-mode-sub">{sub}</span>
      </span>
      {wide && <span className="ag-mode-go"><IconPlay size={18} /></span>}
    </button>
  )
}

export default function AppHome({ sport = 'nfl', onStart, onDepthChart, onVersus, user, renderBucketFigure }) {
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
  const posName = isBucket ? (position === 'big' ? 'PF · C' : 'PG · SG · SF') : NFL_NAMES[position]
  const posShort = isBucket ? (position === 'big' ? 'BIG' : 'GUARD') : position.toUpperCase()

  return (
    <div className={`ag-home ag-home--${sport}`}>
      <div className="ag-bg" aria-hidden="true">
        <div className="ag-bg-rays" />
        <div className="ag-bg-field" />
        {[...Array(14)].map((_, i) => <span key={i} className="ag-spark" style={{ '--x': `${(i * 37) % 100}%`, '--y': `${(i * 53) % 70}%`, '--t': `${2 + (i % 5) * 0.7}s`, '--dl': `${(i % 7) * 0.4}s` }} />)}
      </div>

      <div className="ag-home-inner">
        <Hud sport={sport} user={user} />

        <div className="ag-brand ag-pop" style={{ '--d': '60ms' }}>
          <img src="/logo-v3.png" alt="" className="ag-brand-mark" draggable={false} />
          <div className="ag-wordmark">
            BUILD<span className="ag-wordmark-a">-A-</span>{isBucket ? 'BUCKET' : 'PLAYER'}
          </div>
        </div>

        {/* Character-select stage */}
        <div className="ag-stage ag-pop" style={{ '--d': '120ms' }}>
          <div className="ag-stage-glow" />
          <div className="ag-stage-rays" />
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
            <span className="ag-stage-name">{posName}</span>
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
                {o.players && <span className="ag-pos-avs"><AvatarTrio players={o.players} size={22} /></span>}
                <span className="ag-pos-label">{o.label}</span>
                {o.sub && <span className="ag-pos-sub">{o.sub}</span>}
              </button>
            )
          })}
        </div>

        {/* Modes */}
        <div className="ag-modes">
          <ModeButton color="gold" icon={IconCrown} title="ALL-TIME" sub={isBucket ? 'NBA legends' : 'Draft the legends'} delay="240ms"
            badge={(isBucket || NEW_ALLTIME.has(position)) ? { text: 'NEW', color: 'red' } : null}
            onClick={() => start('all-time')} />
          <ModeButton color="blue" icon={IconBolt} title="CURRENT" sub={isBucket ? 'Current NBA' : "This season's stars"} delay="290ms"
            onClick={() => start('classic')} />
          {isBucket ? (
            <>
              <ModeButton color="mint" icon={IconCoin} title="SALARY CAP" sub="Build on a budget" delay="340ms"
                badge={{ text: 'DAILY', color: 'purple' }} onClick={() => start('salarycap')} />
              <ModeButton color="red" icon={IconVersus} title="HEAD-TO-HEAD" sub="1v1 a friend" delay="390ms"
                badge={{ text: 'NEW', color: 'gold' }} onClick={() => onVersus?.(position)} />
            </>
          ) : (
            <ModeButton color="purple" icon={IconClipboard} title="THE DEPTH CHART" sub="Daily mini-game" wide delay="340ms"
              badge={{ text: 'DAILY', color: 'gold' }} onClick={onDepthChart} />
          )}
        </div>
      </div>
    </div>
  )
}
