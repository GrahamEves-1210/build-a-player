import { useState, useEffect } from 'react'
import HEADSHOTS from '../data/headshots.json'
import QBAvatar from './QBAvatar'

export default function MVPModal({ result, mvpResult, onDismiss, toSuperBowl = false, isRB = false }) {
  const [phase, setPhase] = useState('loading')
  const [barWidth, setBarWidth] = useState(0)
  const [visible, setVisible] = useState(false)

  const { userWins, winner, unanimous, winnerStats } = mvpResult
  const { wins, losses, seasonPassYds, seasonRushYds, seasonTDs, seasonRushTDs, seasonINTs, seasonCompPct, seasonRating } = result

  // RB totals
  const rbRushTDs  = result.seasonRushTDs ?? 0
  const rbRecTDs   = result.seasonRecTDs  ?? 0
  const rbRushYds  = result.seasonRushYds ?? 0
  const rbRecYds   = result.seasonRecYds  ?? 0
  const rbTotalTDs = rbRushTDs + rbRecTDs
  const rbTotalYds = rbRushYds + rbRecYds

  // QB totals
  const qbTotalTDs = (seasonTDs ?? 0) + (seasonRushTDs ?? 0)
  const qbTotalYds = (seasonPassYds ?? 0) + (seasonRushYds ?? 0)

  const awardLabel    = isRB ? 'OPOY Award'        : 'MVP Award'
  const awardEyebrow  = 'NFL Regular Season'
  const userWinsLabel = isRB ? 'Your Build Wins OPOY' : 'Your Build Wins MVP'
  const unanimousLbl  = isRB ? 'Unanimous OPOY'       : 'Unanimous MVP'
  const regularLbl    = isRB ? 'Regular Season OPOY'  : 'Regular Season MVP'

  useEffect(() => {
    const t0 = setTimeout(() => setVisible(true), 30)
    const t1 = setTimeout(() => setBarWidth(100), 150)
    const t2 = setTimeout(() => setPhase('reveal'), 3200)
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const winnerHeadshot = winner && HEADSHOTS[winner.name]
    ? `/headshots/${HEADSHOTS[winner.name]}.jpg`
    : null

  return (
    <div className={`mvp-overlay ${visible ? 'mvp-overlay-in' : ''}`}>
      <div className="mvp-card">

        <div className="mvp-eyebrow">{awardEyebrow}</div>
        <div className="mvp-title">{awardLabel}</div>

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
              <div className="mvp-stat-pill">
                <span>{wins}–{losses}</span><span>W–L</span>
              </div>
              {isRB ? (
                <>
                  <div className="mvp-stat-pill">
                    <span>{rbRushYds.toLocaleString()}</span><span>Rush Yds</span>
                  </div>
                  <div className="mvp-stat-pill">
                    <span>{rbTotalTDs}</span><span>TDs</span>
                  </div>
                  <div className="mvp-stat-pill">
                    <span>{result.seasonYPC?.toFixed(1)}</span><span>YPC</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="mvp-stat-pill">
                    <span>{qbTotalYds.toLocaleString()}</span><span>Total Yds</span>
                  </div>
                  <div className="mvp-stat-pill">
                    <span>{qbTotalTDs}</span><span>TDs</span>
                  </div>
                  <div className="mvp-stat-pill">
                    <span>{seasonINTs}</span><span>INTs</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {phase === 'reveal' && (
          <div className="mvp-reveal">
            {userWins ? (
              <>
                <div className="mvp-winner-tag mvp-winner-tag--you">{userWinsLabel}</div>
                <img src="/mvp.png" alt="Trophy" className="mvp-trophy-img" draggable={false} />
                <div className="mvp-winner-name">{unanimous ? unanimousLbl : regularLbl}</div>
                <div className="mvp-season-stats">
                  {isRB ? (
                    <>
                      <div className="mvp-stat-row">
                        <span className="mvp-stat-label">Record</span>
                        <span className="mvp-stat-val">{wins}–{losses}</span>
                      </div>
                      <div className="mvp-stat-row">
                        <span className="mvp-stat-label">Rush Yards</span>
                        <span className="mvp-stat-val">{rbRushYds.toLocaleString()}</span>
                      </div>
                      <div className="mvp-stat-row">
                        <span className="mvp-stat-label">YPC</span>
                        <span className="mvp-stat-val">{result.seasonYPC?.toFixed(1)}</span>
                      </div>
                      <div className="mvp-stat-row">
                        <span className="mvp-stat-label">Rec Yards</span>
                        <span className="mvp-stat-val">{rbRecYds.toLocaleString()}</span>
                      </div>
                      <div className="mvp-stat-row">
                        <span className="mvp-stat-label">Rush TDs</span>
                        <span className="mvp-stat-val">{rbRushTDs}</span>
                      </div>
                      <div className="mvp-stat-row">
                        <span className="mvp-stat-label">Rec TDs</span>
                        <span className="mvp-stat-val">{rbRecTDs}</span>
                      </div>
                      <div className="mvp-stat-row">
                        <span className="mvp-stat-label">Long Run</span>
                        <span className="mvp-stat-val">{result.seasonLong ?? '—'} yds</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mvp-stat-row">
                        <span className="mvp-stat-label">Record</span>
                        <span className="mvp-stat-val">{wins}–{losses}</span>
                      </div>
                      <div className="mvp-stat-row">
                        <span className="mvp-stat-label">Total Yards</span>
                        <span className="mvp-stat-val">{qbTotalYds.toLocaleString()}</span>
                      </div>
                      <div className="mvp-stat-row">
                        <span className="mvp-stat-label">Touchdowns</span>
                        <span className="mvp-stat-val">{qbTotalTDs}</span>
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
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mvp-avatar-wrap">
                  <QBAvatar photo={winnerHeadshot} team={winner.team} color={winner.color} size={96} />
                </div>
                <div className="mvp-winner-name">{winner.name}</div>
                <div className="mvp-winner-sub">
                  {winner.team}
                  {isRB && <span className="mvp-winner-pos">{winner.pos}</span>}
                </div>
                <div className="mvp-season-stats">
                  {isRB ? (
                    winner.pos === 'WR' ? (
                      <>
                        <div className="mvp-stat-row">
                          <span className="mvp-stat-label">Record</span>
                          <span className="mvp-stat-val">{winnerStats.wins}–{winnerStats.losses}</span>
                        </div>
                        <div className="mvp-stat-row">
                          <span className="mvp-stat-label">Receiving Yards</span>
                          <span className="mvp-stat-val">{winnerStats.recYds?.toLocaleString()}</span>
                        </div>
                        <div className="mvp-stat-row">
                          <span className="mvp-stat-label">Receiving TDs</span>
                          <span className="mvp-stat-val">{winnerStats.recTDs}</span>
                        </div>
                        <div className="mvp-stat-row">
                          <span className="mvp-stat-label">Yards / Catch</span>
                          <span className="mvp-stat-val">{winnerStats.ypc}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mvp-stat-row">
                          <span className="mvp-stat-label">Record</span>
                          <span className="mvp-stat-val">{winnerStats.wins}–{winnerStats.losses}</span>
                        </div>
                        <div className="mvp-stat-row">
                          <span className="mvp-stat-label">Rush Yards</span>
                          <span className="mvp-stat-val">{winnerStats.rushYds?.toLocaleString()}</span>
                        </div>
                        <div className="mvp-stat-row">
                          <span className="mvp-stat-label">Rec Yards</span>
                          <span className="mvp-stat-val">{winnerStats.recYds?.toLocaleString()}</span>
                        </div>
                        <div className="mvp-stat-row">
                          <span className="mvp-stat-label">Touchdowns</span>
                          <span className="mvp-stat-val">{winnerStats.tds}</span>
                        </div>
                      </>
                    )
                  ) : (
                    <>
                      <div className="mvp-stat-row">
                        <span className="mvp-stat-label">Record</span>
                        <span className="mvp-stat-val">{winnerStats.wins}–{winnerStats.losses}</span>
                      </div>
                      <div className="mvp-stat-row">
                        <span className="mvp-stat-label">Total Yards</span>
                        <span className="mvp-stat-val">{winnerStats.totalYds?.toLocaleString()}</span>
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
                    </>
                  )}
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
