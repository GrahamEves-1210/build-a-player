import { useState, useEffect } from 'react'
import Silhouette from './Silhouette'
import { calcBucketOVR, runBucketSimulation } from '../utils/bucketSimulation'
import { NBA_TEAMS } from '../data/nba-players'
import { GUARD_TYPES, BIG_TYPES } from '../data/nba-players'

// Pick a random team for simulation purposes
function randomTeam() {
  return NBA_TEAMS[Math.floor(Math.random() * NBA_TEAMS.length)]
}

export default function BucketVersusResult({ myData, oppData, position, onRematch, onExit }) {
  const [phase, setPhase]       = useState('reveal')
  const [winner, setWinner]     = useState(null)   // 'me' | 'opp'
  const [myStats, setMyStats]   = useState(null)
  const [oppStats, setOppStats] = useState(null)
  const [gameScore, setGameScore] = useState(null) // { me: 108, opp: 97 }

  const types  = position === 'big' ? BIG_TYPES : GUARD_TYPES
  const myOVR  = calcBucketOVR(myData.build, types, position)
  const oppOVR = calcBucketOVR(oppData.build, types, position)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('sim'), 1800)
    const t2 = setTimeout(() => {
      const mySim  = runBucketSimulation(myData.build,  types, randomTeam(), position)
      const oppSim = runBucketSimulation(oppData.build, types, randomTeam(), position)

      setMyStats(mySim)
      setOppStats(oppSim)

      // Simulate a single game score based on ppg with variance
      const myScore  = Math.round((mySim.ppg  ?? 20) * 4 + (Math.random() * 20 - 10))
      const oppScore = Math.round((oppSim.ppg ?? 20) * 4 + (Math.random() * 20 - 10))
      const myFinal  = Math.max(myScore, 70)
      const oppFinal = myScore === oppScore ? myFinal - 1 : Math.max(oppScore, 68)
      setGameScore({ me: myFinal, opp: oppFinal })
      setWinner(myFinal > oppFinal ? 'me' : 'opp')
      setPhase('result')
    }, 3400)

    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const myPlayer  = myData.player
  const oppPlayer = oppData.player

  return (
    <div className={`versus-result vr-phase-${phase}`}>

      {/* header */}
      <div className="vr-header">
        {phase === 'reveal' && <span className="vr-header-label">HEAD TO HEAD</span>}
        {phase === 'sim'    && <span className="vr-header-label vr-header-label--sim">SIMULATING GAME…</span>}
        {phase === 'result' && (
          <span className={`vr-header-label vr-header-label--result ${winner === 'me' ? 'vr-win' : 'vr-loss'}`}>
            {winner === 'me' ? 'YOU WIN' : 'YOU LOSE'}
          </span>
        )}
      </div>

      {/* game score banner */}
      {phase === 'result' && gameScore && (
        <div className="vr-game-score">
          <span className={winner === 'me' ? 'vr-gs-winner' : 'vr-gs-loser'}>{gameScore.me}</span>
          <span className="vr-gs-dash">–</span>
          <span className={winner === 'opp' ? 'vr-gs-winner' : 'vr-gs-loser'}>{gameScore.opp}</span>
        </div>
      )}

      {/* split grid */}
      <div className="vr-grid">

        {/* MY SIDE */}
        <div className={`vr-side vr-side--me ${phase === 'result' ? (winner === 'me' ? 'vr-side--winner' : 'vr-side--loser') : ''}`}>
          <div className="vr-you-tag">YOU</div>
          <div className="vr-model-wrap">
            <Silhouette
              build={myData.build}
              types={types}
              isBucket
              readOnly
            />
          </div>
          <div className="vr-player-name">{myPlayer?.name ?? 'Your Player'}</div>
          <div className="vr-team-name">{myPlayer?.teamName ?? myPlayer?.team ?? ''}</div>
          <div className="vr-ovr-badge">{myOVR}</div>
          {phase === 'result' && myStats && (
            <div className="vr-stat-block">
              <div className="vr-stat"><span>{myStats.ppg}</span><em>PPG</em></div>
              <div className="vr-stat"><span>{myStats.rpg}</span><em>RPG</em></div>
              <div className="vr-stat"><span>{myStats.apg}</span><em>APG</em></div>
            </div>
          )}
        </div>

        {/* VS column */}
        <div className="vr-vs-col">
          {phase !== 'result' && <div className="vr-vs-text">VS</div>}
          {phase === 'sim' && (
            <div className="vr-sim-pulse">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8l4 4-4 4"/>
                <path d="M8 12h8"/>
              </svg>
            </div>
          )}
          {phase === 'result' && (
            <div className={`vr-result-icon ${winner === 'me' ? 'vr-result-icon--win' : 'vr-result-icon--loss'}`}>
              {winner === 'me' ? (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              )}
            </div>
          )}
        </div>

        {/* OPP SIDE */}
        <div className={`vr-side vr-side--opp ${phase === 'result' ? (winner === 'opp' ? 'vr-side--winner' : 'vr-side--loser') : ''}`}>
          <div className="vr-you-tag">{oppData.name ?? 'OPPONENT'}</div>
          <div className="vr-model-wrap">
            <Silhouette
              build={oppData.build}
              types={types}
              isBucket
              readOnly
            />
          </div>
          <div className="vr-player-name">{oppPlayer?.name ?? 'Opponent'}</div>
          <div className="vr-team-name">{oppPlayer?.teamName ?? oppPlayer?.team ?? ''}</div>
          <div className="vr-ovr-badge">{oppOVR}</div>
          {phase === 'result' && oppStats && (
            <div className="vr-stat-block">
              <div className="vr-stat"><span>{oppStats.ppg}</span><em>PPG</em></div>
              <div className="vr-stat"><span>{oppStats.rpg}</span><em>RPG</em></div>
              <div className="vr-stat"><span>{oppStats.apg}</span><em>APG</em></div>
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      {phase === 'result' && (
        <div className="vr-actions">
          <button className="vr-btn vr-btn--primary" onClick={onRematch}>REMATCH</button>
          <button className="vr-btn" onClick={onExit}>EXIT</button>
        </div>
      )}
    </div>
  )
}
