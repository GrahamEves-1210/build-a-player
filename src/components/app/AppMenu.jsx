import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import FeedbackModal from '../FeedbackModal'
import { isMuted, setMuted } from '../../lib/juice'
import { IS_APP } from '../../lib/platform'
import { openCheckout } from '../../lib/webCheckout'
import { isPro } from '../../lib/progress'
import { railPreviewOn, setRailPreview } from '../../lib/fakeRail'
import { IconQuestion, IconInfo, IconChat, IconDiscord, IconX, IconClose, IconShield, IconDoc, IconPodium, IconPlay, IconCrown, IconProfile, IconHome, IconGear } from './icons'
import { useProgress } from '../../lib/progress'
import AppSettings from './AppSettings'

// App "More" sheet (gear on the home screen): tiles + a How to Play view.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

// BAP Pro: Stripe on the web (the app opens the checkout in the phone's browser)
const PRO_PERKS = [
  ['The Pro Vault', 'Exclusive avatars, name styles, plates and victory effects in the shop'],
  ['Double the daily coins', 'The shop\'s free daily drop is doubled'],
  ['No ads', 'Every page, on the website'],
  ['Pro badge', 'On the leaderboards next to your name'],
]

function ProView({ onVault }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const pro = isPro()
  const subscribe = async () => {
    setErr(null); setBusy(true)
    const r = await openCheckout('pro')
    setBusy(false)
    if (r === 'error') setErr('Checkout didn\'t open. Try again.')
  }
  return (
    <div className="ag-pro-view">
      <div className={`ag-pro-hero ag-pop${pro ? ' is-on' : ''}`}>
        <span className="ag-pro-crown"><IconCrown size={30} /></span>
        <b>BAP PRO</b>
        <span>{pro ? 'Active — thanks for backing the game.' : '$4.99 / month · cancel anytime'}</span>
      </div>
      <div className="ag-pro-perks">
        {PRO_PERKS.map(([t, d], i) => (
          <div key={t} className="ag-pro-perk ag-pop" style={{ '--d': `${60 + i * 40}ms` }}>
            <span className="ag-pro-check">✓</span>
            <span><b>{t}</b><small>{d}</small></span>
          </div>
        ))}
      </div>
      {pro ? (
        <button className="ag-btn ag-pro-cta" onClick={onVault}>OPEN THE PRO VAULT</button>
      ) : (
        <>
          <button className="ag-btn ag-pro-cta" onClick={subscribe} disabled={busy}>{busy ? 'OPENING CHECKOUT…' : IS_APP ? 'SUBSCRIBE ON THE WEB' : 'GO PRO — $4.99/MO'}</button>
          {IS_APP && <p className="ag-pro-note">Opens a secure Stripe checkout on build-a-player.com. Pro carries over to the app on this account.</p>}
        </>
      )}
      {err && <p className="ag-pro-note ag-pro-note--err">{err}</p>}
    </div>
  )
}

const STEPS = [
  { title: 'SPIN',     body: 'Spin for a random team, then a random player from it.' },
  { title: 'PICK',     body: 'Take one trait from that player — their arm, speed, hands…' },
  { title: 'BUILD',    body: 'Keep spinning until every slot on your player is filled.' },
  { title: 'SIMULATE', body: 'Play the season. Make the playoffs, win the award, chase the ring.' },
]

function Tile({ tone, Icon, title, sub, onClick, delay, wide = false }) {
  return (
    <button className={`ag-tile ag-tile--${tone} ag-pop`} style={{ '--d': delay, ...(wide ? { gridColumn: '1 / -1' } : null) }} onClick={onClick}>
      <span className="ag-tile-icon"><Icon size={26} /></span>
      <span className="ag-tile-title">{title}</span>
      {sub && <span className="ag-tile-sub">{sub}</span>}
    </button>
  )
}

export default function AppMenu({ sport, onClose }) {
  const [view, setView] = useState('menu')            // 'menu' | 'howto' | 'pro' | 'settings'
  const [feedbackUser, setFeedbackUser] = useState(null) // null = closed
  const [muted, setMutedState] = useState(isMuted)
  const [rail, setRailState] = useState(railPreviewOn)
  const signedIn = useProgress().signedIn
  const isBucket = sport === 'bucket'

  const openFeedback = async () => {
    const { data } = supabase ? await supabase.auth.getSession() : { data: null }
    setFeedbackUser(data?.session?.user ?? false)
  }
  const go = fn => () => { onClose(); fn() }

  if (feedbackUser !== null) {
    return <FeedbackModal user={feedbackUser || null} isBucket={isBucket} onClose={() => { setFeedbackUser(null); onClose() }} />
  }

  return createPortal(
    <div className="ag-menu-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`ag-menu ag-menu--${sport}`} role="dialog" aria-label={view === 'howto' ? 'How to play' : view === 'pro' ? 'BAP Pro' : view === 'settings' ? 'Settings' : 'More'}>
        <div className="ag-menu-head">
          {view !== 'menu'
            ? <button className="ag-menu-back" onClick={() => setView('menu')}>‹ BACK</button>
            : <span />}
          <h2 className="ag-menu-title">{view === 'howto' ? 'How to play' : view === 'pro' ? 'BAP Pro' : view === 'settings' ? 'Settings' : 'More'}</h2>
          <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>

        {view === 'settings' ? (
          <AppSettings signedIn={signedIn} onFeedback={openFeedback} onClose={onClose} />
        ) : view === 'pro' ? (
          <ProView onVault={go(() => nav('shop'))} />
        ) : view === 'howto' ? (
          <div className="ag-steps">
            {STEPS.map((s, i) => (
              <div key={s.title} className="ag-step ag-pop" style={{ '--d': `${i * 60}ms` }}>
                <span className="ag-step-num">{i + 1}</span>
                <span className="ag-step-txt">
                  <span className="ag-step-title">{s.title}</span>
                  <span className="ag-step-body">{s.body}</span>
                </span>
              </div>
            ))}
            <button className="ag-btn ag-cta ag-pop" style={{ '--d': '260ms' }} onClick={go(() => nav('play'))}>START DRAFTING</button>
          </div>
        ) : (
          <>
            <div className="ag-tiles">
              {/* website: the dock isn't on the game pages, so Home and Profile live here too */}
              {!IS_APP && <Tile tone="mint" Icon={IconHome} title="HOME" sub="Modes and more" onClick={go(() => nav('home'))} delay="0ms" />}
              {!IS_APP && <Tile tone="gold" Icon={IconProfile} title={signedIn ? 'PROFILE' : 'SIGN IN'} sub={signedIn ? 'Career, shop, locker' : 'Save your career'} onClick={go(() => nav('profile'))} delay="0ms" />}
              <Tile tone="mint" Icon={IconQuestion} title="HOW TO PLAY" sub="4 quick steps" onClick={() => setView('howto')} delay="0ms" />
              <Tile tone="gold" Icon={IconPodium} title="LEADERBOARDS" sub="Top builds" onClick={go(() => nav('leaderboard'))} delay="30ms" />
              <Tile tone="discord" Icon={IconDiscord} title="DISCORD" sub="Join the community" onClick={go(() => window.open('https://discord.gg/zdZBu2VjUD', '_blank'))} delay="60ms" />
              <Tile tone="ink" Icon={IconX} title="FOLLOW" sub="@Build_A_Player" onClick={go(() => window.open('https://x.com/Build_A_Player', '_blank'))} delay="90ms" />
              <Tile tone="purple" Icon={IconChat} title="FEEDBACK" sub="Ideas & bugs" onClick={openFeedback} delay="120ms" />
              <Tile tone="gold" Icon={IconCrown} title="BAP PRO" sub={isPro() ? 'Active · Pro Vault' : 'Vault, coins, no ads'} onClick={() => setView('pro')} delay="150ms" />
            </div>
            <button className={`ag-row-btn${muted ? ' ag-sound--off' : ''}`} onClick={() => { setMuted(!muted); setMutedState(!muted) }}>
              <span className="ag-sound-lbl">SOUND</span>
              <span className="ag-sound-switch"><span className="ag-sound-knob" /></span>
              <span className="ag-sound-state">{muted ? 'OFF' : 'ON'}</span>
            </button>
            <button className="ag-row-btn" onClick={() => setView('settings')}>
              <IconGear size={18} /><span className="ag-sound-lbl">SETTINGS · HELP · ACCOUNT</span>
            </button>
            <button className={`ag-row-btn${rail ? '' : ' ag-sound--off'}`} onClick={() => { setRailPreview(!rail); setRailState(!rail) }}>
              <span className="ag-sound-lbl">AD RAIL PREVIEW</span>
              <span className="ag-sound-switch"><span className="ag-sound-knob" /></span>
              <span className="ag-sound-state">{rail ? 'ON' : 'OFF'}</span>
            </button>
            {IS_APP && (
              <button className="ag-row-btn" onClick={go(() => nav('soundlab'))}>
                <IconPlay size={18} /><span className="ag-sound-lbl">SOUND LAB · PICK THE SOUNDS</span>
              </button>
            )}
            {!IS_APP && (
              <button className="ag-row-btn" onClick={go(() => nav('wiki'))}>
                <IconDoc size={19} /><span className="ag-sound-lbl">PLAYER WIKI</span>
              </button>
            )}
            <button className="ag-row-btn" onClick={go(() => nav('about'))}>
              <IconInfo size={20} /><span className="ag-sound-lbl">ABOUT THE GAME</span>
            </button>
            <div className="ag-menu-links">
              <button onClick={go(() => { window.location.href = '/privacy' })}><IconShield size={15} /> Privacy</button>
              <button onClick={go(() => { window.location.href = '/terms' })}><IconDoc size={15} /> Terms</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
