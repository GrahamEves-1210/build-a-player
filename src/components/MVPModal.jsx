import { useState, useEffect } from 'react'
import HEADSHOTS from '../data/headshots.json'
import QBAvatar from './QBAvatar'

export default function MVPModal({ result, mvpResult, onDismiss, toSuperBowl = false }) {
  const [phase, setPhase] = useState('loading')
  const [barWidth, setBarWidth] = useState(0)
  const [visible, setVisible] = useState(false)

  const { userWins, winner, unanimous, winnerStats } = mvpResult
  const { wins, losses, seasonPassYds, seasonRushYds, seasonTDs, seasonRushTDs, seasonINTs, seasonCompPct, seasonRating } = result
  const totalTDs = (seasonTDs ?? 0) + (seasonRushTDs ?? 0)
  const totalYds = (seasonPassYds ?? 0) + (seasonRushYds ?? 0)

  useEffect(() => {
    const t0 = setTimeout(() => setVisible(true), 30)
    const t1 = setTimeout(() => setBarWidth(100), 150)
    const t2 = setTimeout(() => setPhase('reveal'), 3200)
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const winnerHeadshot = HEADSHOTS[winner.name]
    ? `/headshots/${HEADSHOTS[winner.name]}.jpg`
    : null

  return (
    <div className={`mvp-overlay ${visible ? 'mvp-overlay-in' : ''}`}>
      <div className="mvp-card">

        <div className="mvp-eyebrow">NFL Regular Season</div>
        <div className="mvp-title">MVP Award</div>

        {phase === 'loading' && (
          <div className="mvp-loading">
            <div className="mvp-votes-lbl">Counting Votes…</div>
            <div className="mvp-bar-track">
              <div
                className="mvp-bar-fill"
                style={{ width: `${barWidth}%`, transition: 'width 2.9s cubic-bezier(0.25,0,0.5,1)' }}
              />
            </div>
            <div className="mvp-stats-preview">
              <div className="mvp-stat-pill"><span>{wins}–{losses}</span><span>W–L</span></div>
              <div className="mvp-stat-pill"><span>{totalYds.toLocaleString()}</span><span>Total Yds</span></div>
              <div className="mvp-stat-pill"><span>{totalTDs}</span><span>TDs</span></div>
              <div className="mvp-stat-pill"><span>{seasonINTs}</span><span>INTs</span></div>
            </div>
          </div>
        )}

        {phase === 'reveal' && (
          <div className="mvp-reveal">
            {userWins ? (
              <>
                <div className="mvp-winner-tag mvp-winner-tag--you">Your Build Wins MVP</div>
                <img src="/mvp.png" alt="MVP Trophy" className="mvp-trophy-img" draggable={false} />
                <div className="mvp-winner-name">{unanimous ? 'Unanimous MVP' : 'Regular Season MVP'}</div>
                <div className="mvp-season-stats">
                  <div className="mvp-stat-row">
                    <span className="mvp-stat-label">Record</span>
                    <span className="mvp-stat-val">{wins}–{losses}</span>
                  </div>
                  <div className="mvp-stat-row">
                    <span className="mvp-stat-label">Total Yards</span>
                    <span className="mvp-stat-val">{totalYds.toLocaleString()}</span>
                  </div>
                  <div className="mvp-stat-row">
                    <span className="mvp-stat-label">Touchdowns</span>
                    <span className="mvp-stat-val">{totalTDs}</span>
                  </div>
                  <div className="mvp-stat-row">
                    <span className="mvp-stat-label">Interceptions</span>
                    <span className="mvp-stat-val">{seasonINTs}</span>
                  </div>
                  <div className="mvp-stat-row">
                    <span className="mvp-stat-label">Comp %</span>
                    <span className="mvp-stat-val">{seasonCompPct}%</span>
                  </div>
                  <div className="mvp-stat-row">
                    <span className="mvp-stat-label">QB Rating</span>
                    <span className="mvp-stat-val">{seasonRating}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mvp-avatar-wrap">
                  <QBAvatar photo={winnerHeadshot} team={winner.team} color={winner.color} size={96} />
                </div>
                <div className="mvp-winner-name">{winner.name}</div>
                <div className="mvp-winner-sub">{winner.team}</div>
                <div className="mvp-season-stats">
                  <div className="mvp-stat-row">
                    <span className="mvp-stat-label">Record</span>
                    <span className="mvp-stat-val">{winnerStats.wins}–{winnerStats.losses}</span>
                  </div>
                  <div className="mvp-stat-row">
                    <span className="mvp-stat-label">Total Yards</span>
                    <span className="mvp-stat-val">{winnerStats.totalYds.toLocaleString()}</span>
                  </div>
                  <div className="mvp-stat-row">
                    <span className="mvp-stat-label">Touchdowns</span>
                    <span className="mvp-stat-val">{winnerStats.tds}</span>
                  </div>
                  <div className="mvp-stat-row">
                    <span className="mvp-stat-label">Interceptions</span>
                    <span className="mvp-stat-val">{winnerStats.ints}</span>
                  </div>
                  <div className="mvp-stat-row">
                    <span className="mvp-stat-label">Comp %</span>
                    <span className="mvp-stat-val">{winnerStats.compPct}%</span>
                  </div>
                  <div className="mvp-stat-row">
                    <span className="mvp-stat-label">QB Rating</span>
                    <span className="mvp-stat-val">{winnerStats.rating}</span>
                  </div>
                </div>
              </>
            )}
            <button className="mvp-continue" onClick={onDismiss}>
              {toSuperBowl ? 'Continue to Super Bowl' : 'Continue to Final Report'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
