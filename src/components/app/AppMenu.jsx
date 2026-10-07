import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import FeedbackModal from '../FeedbackModal'
import { isMuted, setMuted } from '../../lib/juice'
import { IconQuestion, IconInfo, IconChat, IconDiscord, IconX, IconFootball, IconBasketball, IconClose, IconShield, IconDoc, IconPodium } from './icons'

// App "More" sheet (gear on the home screen): tiles + a How to Play view.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

const STEPS = [
  { title: 'SPIN',     body: 'Spin for a random team, then a random player from it.' },
  { title: 'PICK',     body: 'Take one trait from that player — their arm, speed, hands…' },
  { title: 'BUILD',    body: 'Keep spinning until every slot on your player is filled.' },
  { title: 'SIMULATE', body: 'Play the season. Make the playoffs, win the award, chase the ring.' },
]

function Tile({ tone, Icon, title, sub, onClick, delay }) {
  return (
    <button className={`ag-tile ag-tile--${tone} ag-pop`} style={{ '--d': delay }} onClick={onClick}>
      <span className="ag-tile-icon"><Icon size={26} /></span>
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
      <div className={`ag-menu ag-menu--${sport}`} role="dialog" aria-label={view === 'howto' ? 'How to play' : 'More'}>
        <div className="ag-menu-head">
          {view === 'howto'
            ? <button className="ag-menu-back" onClick={() => setView('menu')}>‹ BACK</button>
            : <span />}
          <h2 className="ag-menu-title">{view === 'howto' ? 'How to play' : 'More'}</h2>
          <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>

        {view === 'howto' ? (
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
              <Tile tone="mint" Icon={IconQuestion} title="HOW TO PLAY" sub="4 quick steps" onClick={() => setView('howto')} delay="0ms" />
              <Tile tone="gold" Icon={IconPodium} title="LEADERBOARDS" sub="Top builds" onClick={go(() => nav('leaderboard'))} delay="30ms" />
              <Tile tone="discord" Icon={IconDiscord} title="DISCORD" sub="Join the community" onClick={go(() => window.open('https://discord.gg/zdZBu2VjUD', '_blank'))} delay="60ms" />
              <Tile tone="ink" Icon={IconX} title="FOLLOW" sub="@Build_A_Player" onClick={go(() => window.open('https://x.com/Build_A_Player', '_blank'))} delay="90ms" />
              <Tile tone="purple" Icon={IconChat} title="FEEDBACK" sub="Ideas & bugs" onClick={openFeedback} delay="120ms" />
              <Tile tone={isBucket ? 'mint' : 'orange'} Icon={isBucket ? IconFootball : IconBasketball}
                title={isBucket ? 'FOOTBALL' : 'BASKETBALL'} sub={isBucket ? 'Build-A-Player' : 'Build-A-Bucket'}
                onClick={go(() => { try { localStorage.removeItem('bap_progress') } catch {}; window.location.href = isBucket ? '/' : '/bucket' })} delay="150ms" />
            </div>
            <button className={`ag-row-btn${muted ? ' ag-sound--off' : ''}`} onClick={() => { setMuted(!muted); setMutedState(!muted) }}>
              <span className="ag-sound-lbl">SOUND</span>
              <span className="ag-sound-switch"><span className="ag-sound-knob" /></span>
              <span className="ag-sound-state">{muted ? 'OFF' : 'ON'}</span>
            </button>
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
