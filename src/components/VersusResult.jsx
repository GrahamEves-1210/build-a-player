import { useState, useEffect, useRef } from 'react'
import Silhouette from './Silhouette'
import { calcOVR, runSimulation, calcOVRRB, runRBSimulation } from '../utils/simulation'
import { TYPES } from '../data/qbs'
import { RB_TYPES } from '../data/rbs'

// Only the host actually runs runSimulation() (which uses Math.random()
// internally) and broadcasts the full result over `channel`. The guest never
// computes its own outcome — it waits for vsFinalResult (fed in by App.jsx's
// vs_result_final listener) and mirrors it with perspective flipped. Without
// this, each side independently rolled its own random season and could
// (and did) disagree about who actually won.
export default function VersusResult({ myData, oppData, position, gameMode, role, channel, vsFinalResult, onResult, onRematch, onExit }) {
  const [phase, setPhase]     = useState('reveal')   // reveal → sim → result
  const [winner, setWinner]   = useState(null)        // 'me' | 'opp'
  const [myStats, setMyStats]   = useState(null)
  const [oppStats, setOppStats] = useState(null)
  const resultSent = useRef(false)

  const isRB    = position === 'rb'
  const types   = isRB ? RB_TYPES : TYPES
  const myOVR   = isRB ? calcOVRRB(myData.build) : calcOVR(myData.build)
  const oppOVR  = isRB ? calcOVRRB(oppData.build) : calcOVR(oppData.build)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('sim'), 1800)
    let t2, t3

    if (role === 'host') {
      t2 = setTimeout(() => {
        const mySim  = isRB
          ? runRBSimulation(myData.build, types)
          : runSimulation(myData.build, types, myData.team, gameMode === 'all-time')
        const oppSim = isRB
          ? runRBSimulation(oppData.build, types)
          : runSimulation(oppData.build, types, oppData.team, gameMode === 'all-time')

        const myW  = mySim?.wins  ?? 0
        const oppW = oppSim?.wins ?? 0
        const w = myW > oppW ? 'me' : myW < oppW ? 'opp' : (myOVR >= oppOVR ? 'me' : 'opp')

        setMyStats(mySim)
        setOppStats(oppSim)
        setWinner(w)
        setPhase('result')
        channel?.send({
          type: 'broadcast', event: 'vs_result_final',
          payload: { hostStats: mySim, guestStats: oppSim, hostWinner: w },
        }).catch(() => {})
        if (!resultSent.current) { resultSent.current = true; onResult?.(w === 'me' ? 'win' : 'loss') }
      }, 1600)
    } else {
      // Guest fallback: if the host's broadcast never arrives (lost packet,
      // host tab died mid-compute), don't hang forever — compute locally as
      // a last resort so the guest isn't stuck, even though this reintroduces
      // the disagreement risk in that one edge case.
      t3 = setTimeout(() => {
        if (resultSent.current) return
        console.warn('[versus] never received host result — falling back to local sim')
        const mySim  = isRB ? runRBSimulation(myData.build, types) : runSimulation(myData.build, types, myData.team, gameMode === 'all-time')
        const oppSim = isRB ? runRBSimulation(oppData.build, types) : runSimulation(oppData.build, types, oppData.team, gameMode === 'all-time')
        const myW  = mySim?.wins  ?? 0
        const oppW = oppSim?.wins ?? 0
        const w = myW > oppW ? 'me' : myW < oppW ? 'opp' : (myOVR >= oppOVR ? 'me' : 'opp')
        setMyStats(mySim)
        setOppStats(oppSim)
        setWinner(w)
        setPhase('result')
        resultSent.current = true
        onResult?.(w === 'me' ? 'win' : 'loss')
      }, 12000)
    }

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  // Guest: apply the host-broadcast result as soon as it arrives, flipping
  // perspective (host's "me" is this side's "opp").
  useEffect(() => {
    if (role === 'host' || !vsFinalResult || resultSent.current) return
    resultSent.current = true
    setMyStats(vsFinalResult.guestStats)
    setOppStats(vsFinalResult.hostStats)
    const w = vsFinalResult.hostWinner === 'me' ? 'opp' : 'me'
    setWinner(w)
    setPhase('result')
    onResult?.(w === 'me' ? 'win' : 'loss')
  }, [vsFinalResult, role])

  const myQB  = myData.qb
  const oppQB = oppData.qb

  return (
    <div className={`versus-result vr-phase-${phase}`}>

      {/* ── header ── */}
      <div className="vr-header">
        {phase === 'reveal' && <span className="vr-header-label">HEAD TO HEAD</span>}
        {phase === 'sim'    && <span className="vr-header-label vr-header-label--sim">SIMULATING SEASON…</span>}
        {phase === 'result' && (
          <span className={`vr-header-label vr-header-label--result ${winner === 'me' ? 'vr-win' : 'vr-loss'}`}>
            {winner === 'me' ? 'YOU WIN' : 'YOU LOSE'}
          </span>
        )}
      </div>

      {/* ── split grid ── */}
      <div className="vr-grid">

        {/* MY SIDE */}
        <div className={`vr-side vr-side--me ${phase === 'result' ? (winner === 'me' ? 'vr-side--winner' : 'vr-side--loser') : ''}`}>
          <div className="vr-you-tag">YOU</div>

          <div className="vr-model-wrap">
            <Silhouette
              build={myData.build}
              types={types}
              isBucket={false}
              isRB={isRB}
              readOnly
            />
          </div>

          <div className="vr-player-name">{myQB?.name ?? 'Your Player'}</div>
          <div className="vr-team-name">{myQB?.teamName ?? myQB?.team ?? ''}</div>
          <div className="vr-ovr-badge">{myOVR ?? '—'}</div>

          {phase === 'result' && myStats && (
            <div className="vr-stat-block">
              {isRB ? (
                <>
                  <div className="vr-stat"><span>{myStats.seasonRushYds?.toLocaleString()}</span><em>Rush Yds</em></div>
                  <div className="vr-stat"><span>{myStats.seasonRushTDs}</span><em>TDs</em></div>
                  <div className="vr-stat"><span>{myStats.wins}–{myStats.losses}</span><em>Record</em></div>
                </>
              ) : (
                <>
                  <div className="vr-stat"><span>{myStats.seasonPassYds?.toLocaleString()}</span><em>Pass Yds</em></div>
                  <div className="vr-stat"><span>{myStats.seasonTDs}</span><em>TDs</em></div>
                  <div className="vr-stat"><span>{myStats.wins}–{myStats.losses}</span><em>Record</em></div>
                </>
              )}
            </div>
          )}
        </div>

        {/* VS DIVIDER */}
        <div className="vr-vs-col">
          {phase !== 'result' && <div className="vr-vs-text">VS</div>}
          {phase === 'sim' && (
            <div className="vr-sim-pulse">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
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
              isBucket={false}
              isRB={isRB}
              readOnly
            />
          </div>

          <div className="vr-player-name">{oppQB?.name ?? 'Opponent'}</div>
          <div className="vr-team-name">{oppQB?.teamName ?? oppQB?.team ?? ''}</div>
          <div className="vr-ovr-badge">{oppOVR ?? '—'}</div>

          {phase === 'result' && oppStats && (
            <div className="vr-stat-block">
              {isRB ? (
                <>
                  <div className="vr-stat"><span>{oppStats.seasonRushYds?.toLocaleString()}</span><em>Rush Yds</em></div>
                  <div className="vr-stat"><span>{oppStats.seasonRushTDs}</span><em>TDs</em></div>
                  <div className="vr-stat"><span>{oppStats.wins}–{oppStats.losses}</span><em>Record</em></div>
                </>
              ) : (
                <>
                  <div className="vr-stat"><span>{oppStats.seasonPassYds?.toLocaleString()}</span><em>Pass Yds</em></div>
                  <div className="vr-stat"><span>{oppStats.seasonTDs}</span><em>TDs</em></div>
                  <div className="vr-stat"><span>{oppStats.wins}–{oppStats.losses}</span><em>Record</em></div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── actions ── */}
      {phase === 'result' && (
        <div className="vr-actions">
          <button className="vr-btn vr-btn--primary" onClick={onRematch}>REMATCH</button>
          <button className="vr-btn" onClick={onExit}>EXIT</button>
        </div>
      )}
    </div>
  )
}
