import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import FeedbackModal from '../FeedbackModal'
import { isMuted, setMuted } from '../../lib/juice'
import { IconQuestion, IconInfo, IconChat, IconDiscord, IconX, IconFootball, IconBasketball, IconClose, IconSpin, IconStar, IconBuild, IconTrophy, IconShield, IconDoc } from './icons'

// App "Menu" panel (from the dock): big colorful tiles + a How to Play view.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

const STEPS = [
  { Icon: IconSpin,   color: 'blue',   title: 'SPIN',     body: 'Spin the wheel for a random team, then a random player from it.' },
  { Icon: IconStar,   color: 'gold',   title: 'PICK',     body: 'Steal one trait from that player — their arm, speed, hands…' },
  { Icon: IconBuild,  color: 'mint',   title: 'BUILD',    body: 'Keep spinning until every slot on your player is filled.' },
  { Icon: IconTrophy, color: 'purple', title: 'SIMULATE', body: 'Play a full season. Make the playoffs, win MVP, chase the ring!' },
]

function Tile({ color, Icon, title, sub, onClick, delay }) {
  return (
    <button className={`ag-btn ag-btn--${color} ag-tile ag-pop`} style={{ '--d': delay }} onClick={onClick}>
      <span className="ag-tile-icon"><Icon size={30} /></span>
      <span className="ag-tile-title">{title}</span>
      {sub && <span className="ag-tile-sub">{sub}</span>}
    </button>
  )
}

export default function AppMenu({ sport, onClose }) {
  const [view, setView] = useState('menu')            // 'menu' | 'howto'
  const [feedbackUser, setFeedbackUser] = useState(null) // null = closed
  const [muted, setMutedState] = useState(isMuted)
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
      <div className={`ag-menu ag-menu--${sport}`} role="dialog" aria-label={view === 'howto' ? 'How to play' : 'Menu'}>
        <div className="ag-menu-head">
          {view === 'howto'
            ? <button className="ag-menu-back" onClick={() => setView('menu')}>‹ BACK</button>
            : <span />}
          <h2 className="ag-menu-title">{view === 'howto' ? 'HOW TO PLAY' : 'MENU'}</h2>
          <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={18} /></button>
        </div>

        {view === 'howto' ? (
          <div className="ag-steps">
            {STEPS.map((s, i) => (
              <div key={s.title} className="ag-step ag-pop" style={{ '--d': `${i * 70}ms` }}>
                <span className={`ag-step-badge ag-btn--${s.color}`}><s.Icon size={26} /></span>
                <span className="ag-step-num">{i + 1}</span>
                <span className="ag-step-txt">
                  <span className="ag-step-title">{s.title}</span>
                  <span className="ag-step-body">{s.body}</span>
                </span>
              </div>
            ))}
            <button className="ag-btn ag-btn--mint ag-cta ag-pop" style={{ '--d': '300ms' }} onClick={go(() => nav('play'))}>LET'S GO!</button>
          </div>
        ) : (
          <>
            <div className="ag-tiles">
              <Tile color="purple" Icon={IconQuestion} title="HOW TO PLAY" sub="4 quick steps" onClick={() => setView('howto')} delay="0ms" />
              <Tile color="mint" Icon={IconChat} title="FEEDBACK" sub="Ideas & bugs" onClick={openFeedback} delay="40ms" />
              <Tile color="discord" Icon={IconDiscord} title="DISCORD" sub="Join the squad" onClick={go(() => window.open('https://discord.gg/zdZBu2VjUD', '_blank'))} delay="80ms" />
              <Tile color="ink" Icon={IconX} title="FOLLOW" sub="@Build_A_Player" onClick={go(() => window.open('https://x.com/Build_A_Player', '_blank'))} delay="120ms" />
              <Tile color={isBucket ? 'blue' : 'orange'} Icon={isBucket ? IconFootball : IconBasketball}
                title={isBucket ? 'FOOTBALL' : 'BASKETBALL'} sub={isBucket ? 'Build-A-Player' : 'Build-A-Bucket'}
                onClick={go(() => { try { localStorage.removeItem('bap_progress') } catch {}; window.location.href = isBucket ? '/' : '/bucket' })} delay="160ms" />
              <Tile color="steel" Icon={IconInfo} title="ABOUT" sub="The game" onClick={go(() => nav('about'))} delay="200ms" />
            </div>
            <button className={`ag-sound${muted ? ' ag-sound--off' : ''}`} onClick={() => { setMuted(!muted); setMutedState(!muted) }}>
              <span className="ag-sound-lbl">SOUND</span>
              <span className="ag-sound-switch"><span className="ag-sound-knob" /></span>
              <span className="ag-sound-state">{muted ? 'OFF' : 'ON'}</span>
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
