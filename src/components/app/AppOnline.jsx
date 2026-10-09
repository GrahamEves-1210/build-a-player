import { useProgress } from '../../lib/progress'
import { RatingHero, ModeStats, NextGoals, OnlineTierLadder } from './OnlineRecord'
import { IconClose, IconArrow } from './icons'

// Online screen (dock → Compete/Blacktop/1v1 cards → YOUR RECORD): the rating
// and ladder, each live mode's full numbers, and the next goals to chase.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

export default function AppOnline({ sport = 'nfl', onClose }) {
  const p = useProgress()
  const o = p.stats?.online ?? { played: 0 }
  return (
    <div className={`ag-screen ol ol--${sport}`}>
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">LIVE MODES</span><h1 className="ag-h1">Online</h1></div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
      </div>
      <div className="ol-body">
        <RatingHero />
        <OnlineTierLadder />
        {!p.signedIn && <p className="ol-note">Playing as a guest — <button onClick={() => window.dispatchEvent(new CustomEvent('bap:auth'))}>sign in</button> and your record follows your account.</p>}
        {o.played === 0 && (
          <div className="ol-empty ag-pop">
            <b>No online games yet.</b>
            <span>Wins against real players move your rating most. Pools and runs filled with bots count for half.</span>
          </div>
        )}
        <NextGoals limit={3} />
        <ModeStats mode="compete" full />
        <ModeStats mode={sport === 'bucket' ? 'bt' : 'h2h'} full />
        <ModeStats mode={sport === 'bucket' ? 'h2h' : 'bt'} full />
        <div className="ol-how">
          <span className="ag-eyebrow">WHAT MOVES YOUR RATING</span>
          <ul>
            <li><b>Compete</b> · 1st +24 · 2nd +12 · 3rd +4 · 4th −6 · 5th −12</li>
            <li><b>Blacktop</b> · win +20 · loss −12 · MVP +5</li>
            <li><b>Head-to-Head</b> · win +25 · loss −15 · forfeit −20</li>
            <li>Pools and runs filled with bots count for half.</li>
          </ul>
        </div>
        <div className="ol-play">
          <button className="ag-btn" onClick={() => { onClose?.(); nav('compete') }}>FIND A COMPETE POOL <IconArrow size={14} /></button>
          {sport === 'bucket' && <button className="ag-btn ag-btn--ghost" onClick={() => { onClose?.(); nav('blacktop') }}>BLACKTOP LOBBY</button>}
        </div>
      </div>
    </div>
  )
}
