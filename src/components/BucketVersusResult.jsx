import { useState, useEffect, useRef, useMemo } from 'react'
import { calcBucketOVR, runBucketSimulation } from '../utils/bucketSimulation'
import { NBA_TEAMS, GUARD_TYPES, BIG_TYPES, BUCKET_ATTR } from '../data/nba-players'

function MiniBuild({ build, types, color }) {
  return (
    <div className="bvr-mini-build">
      {types.map(t => {
        const data = build?.[t]
        const meta = BUCKET_ATTR[t]
        if (!data || !meta) return null
        return (
          <div key={t} className="bvr-mini-attr">
            <span className="bvr-mini-label">{meta.shortLabel ?? meta.label.slice(0, 4).toUpperCase()}</span>
            <span className="bvr-mini-val" style={{ color }}>{data.val}</span>
          </div>
        )
      })}
    </div>
  )
}

function randomTeam() {
  return NBA_TEAMS[Math.floor(Math.random() * NBA_TEAMS.length)]
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// ─── Play Text Templates ──────────────────────────────────────────────────────
const T = {
  score3:      n => pick([`${n} DRILLS the three!`, `${n} steps back — SPLASH!`, `${n} from downtown — GOOD!`, `${n} BURIES the pull-up three!`, `${n} — BANG! Corner three!`, `${n} fires from range — IT'S IN!`]),
  score2Drive: n => pick([`${n} blows by — FINISH!`, `${n} attacks the rim!`, `${n} with the tough layup!`, `${n} drives and floats it in.`, `${n} euro step — TWO!`, `${n} splits the D and scores!`]),
  score2Mid:   n => pick([`${n} with the pull-up mid-range.`, `${n} hits the elbow jumper.`, `${n} — smooth fadeaway!`, `${n} drills the mid-range.`, `${n} stops on a dime — TWO!`]),
  score2Post:  n => pick([`${n} backs it down and scores.`, `${n} with the drop step — TWO!`, `${n} hits the hook shot!`, `${n} catches in the post — FINISH!`, `${n} with the up-and-under!`]),
  score2Ath:   n => pick([`${n} SLAMS it home!`, `${n} rises for the POSTER!`, `${n} THROWS IT DOWN!`, `${n} skies and FINISHES strong!`, `${n} EMPTIES THE TANK — DUNK!`]),
  block:       n => pick([`${n} REJECTS IT!`, `${n} PINS IT against the board!`, `${n} — MASSIVE SWAT!`, `${n} sends it to the stands!`, `${n} STUFFS the attempt!`]),
  steal:       n => pick([`${n} picks the pocket — STEAL!`, `${n} reads the play — TURNOVER!`, `${n} swipes it clean!`, `${n} strips the ball!`]),
  miss:        n => pick([`${n} misses the look.`, `${n}'s shot rattles out.`, `${n} short off the iron.`, `${n} pull-up — no good.`, `${n} can't convert.`]),
}

function getScoreType(is3, position) {
  if (is3) return 'score3'
  const r = Math.random()
  if (position === 'big') {
    if (r < 0.35) return 'score2Ath'
    if (r < 0.68) return 'score2Post'
    return 'score2Drive'
  }
  if (r < 0.45) return 'score2Drive'
  if (r < 0.75) return 'score2Mid'
  return 'score2Ath'
}

// ─── First-to-21 Street Ball Generator ────────────────────────────────────────
function generate21(myStats, oppStats, position, myName, oppName) {
  const GOAL = 21
  const mySP  = clamp(myStats.ppg  / 38, 0.30, 0.62)
  const oppSP = clamp(oppStats.ppg / 38, 0.30, 0.62)
  const my3R  = myStats.threePct  > 0 ? clamp(myStats.threePct  / 70, 0.04, 0.32) : 0.06
  const opp3R = oppStats.threePct > 0 ? clamp(oppStats.threePct / 70, 0.04, 0.32) : 0.06
  const myBlkR  = clamp(myStats.bpg  / 10, 0, 0.12)
  const myStlR  = clamp(myStats.spg  / 10, 0, 0.09)
  const oppBlkR = clamp(oppStats.bpg / 10, 0, 0.12)
  const oppStlR = clamp(oppStats.spg / 10, 0, 0.09)

  const plays = []
  let myPts = 0, oppPts = 0, playId = 0
  let turn = 'me'
  const shownMilestones = new Set()

  function tryMilestone(isMe, pts) {
    const key = `${isMe ? 'me' : 'opp'}-${pts}`
    if (shownMilestones.has(key)) return
    shownMilestones.add(key)
    const name = isMe ? myName : oppName
    let txt = null, big = false
    if (pts === 10)      { txt = `${name} — 10!`;                        big = false }
    else if (pts === 15) { txt = `${name} with 15 — getting close!`;     big = false }
    else if (pts === 18) { txt = `${name} HEATING UP — 18!`;             big = true  }
    else if (pts === 20) { txt = `GAME POINT — ${name} needs ONE more!`; big = true  }
    if (!txt) return
    plays.push({ id: playId++, who: null, milestoneFor: isMe ? 'me' : 'opp', type: 'milestone', pts: 0, text: txt, myPts, oppPts, big })
  }

  while (myPts < GOAL && oppPts < GOAL && plays.length < 280) {
    const isMe   = turn === 'me'
    const sp     = isMe ? mySP  : oppSP
    const thr    = isMe ? my3R  : opp3R
    const name   = isMe ? myName  : oppName
    const defBlk = isMe ? oppBlkR : myBlkR
    const defStl = isMe ? oppStlR : myStlR
    let changeTurn = false

    if (Math.random() < defStl) {
      plays.push({ id: playId++, who: isMe ? 'opp' : 'me', type: 'steal', pts: 0, text: T.steal(isMe ? oppName : myName), myPts, oppPts })
      changeTurn = true
    } else if (Math.random() < defBlk) {
      plays.push({ id: playId++, who: isMe ? 'opp' : 'me', type: 'block', pts: 0, text: T.block(isMe ? oppName : myName), myPts, oppPts, big: true })
      changeTurn = true
    } else if (Math.random() < sp) {
      const is3  = Math.random() < thr
      const pts  = is3 ? 3 : 2
      const type = getScoreType(is3, position)
      if (isMe) { myPts  = Math.min(myPts  + pts, GOAL) }
      else      { oppPts = Math.min(oppPts + pts, GOAL) }
      const big = pts === 3 || type === 'score2Ath'
      plays.push({ id: playId++, who: turn, type, pts, text: T[type](name), myPts, oppPts, big })
      tryMilestone(isMe, isMe ? myPts : oppPts)
    } else {
      plays.push({ id: playId++, who: turn, type: 'miss', pts: 0, text: T.miss(name), myPts, oppPts })
      changeTurn = true
    }

    if (changeTurn) turn = isMe ? 'opp' : 'me'
  }

  return { plays, finalMy: myPts, finalOpp: oppPts }
}

// ─── Score Flash ──────────────────────────────────────────────────────────────
function ScoreDigit({ value, color }) {
  const [flash, setFlash] = useState(false)
  const prev = useRef(value)
  useEffect(() => {
    if (value !== prev.current) {
      setFlash(true)
      prev.current = value
      const t = setTimeout(() => setFlash(false), 400)
      return () => clearTimeout(t)
    }
  }, [value])
  return (
    <span className={`bvr-score-num${flash ? ' bvr-score-flash' : ''}`} style={{ color }}>{value}</span>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, color }) {
  const pct = Math.min(100, (value / 21) * 100)
  return (
    <div className="bvr-prog-track">
      <div className="bvr-prog-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// ─── Basketball Half-Court Visual ─────────────────────────────────────────────
function CourtVisual({ play, myColor, oppColor, myName, oppName }) {
  const [myPos,  setMyPos]  = useState({ x: 60,  y: 110 })
  const [oppPos, setOppPos] = useState({ x: 140, y: 110 })
  const [flash,  setFlash]  = useState(null)
  const flashTimer = useRef(null)

  const rnd = (lo, hi) => lo + Math.random() * (hi - lo)

  useEffect(() => {
    if (!play || play.type === 'milestone') return

    clearTimeout(flashTimer.current)
    const isMe = play.who === 'me'

    if (play.pts === 3) {
      const side = Math.random() > 0.5 ? 1 : -1
      if (isMe) {
        setMyPos({ x: 100 + side * rnd(52, 82), y: rnd(80, 108) })
        setOppPos({ x: 100 + rnd(-18, 18), y: rnd(38, 65) })
      } else {
        setOppPos({ x: 100 + side * rnd(52, 82), y: rnd(80, 108) })
        setMyPos({ x: 100 + rnd(-18, 18), y: rnd(38, 65) })
      }
      setFlash(play.who)
      flashTimer.current = setTimeout(() => setFlash(null), 750)
    } else if (play.pts === 2) {
      if (isMe) {
        setMyPos({ x: 100 + rnd(-28, 28), y: rnd(22, 52) })
        setOppPos({ x: 100 + rnd(-32, 32), y: rnd(42, 72) })
      } else {
        setOppPos({ x: 100 + rnd(-28, 28), y: rnd(22, 52) })
        setMyPos({ x: 100 + rnd(-32, 32), y: rnd(42, 72) })
      }
      setFlash(play.who)
      flashTimer.current = setTimeout(() => setFlash(null), 750)
    } else if (play.type === 'block' || play.type === 'steal') {
      const cx = 100 + rnd(-22, 22)
      const cy = rnd(55, 90)
      setMyPos({ x: cx + rnd(-14, 14), y: cy + rnd(-8, 8) })
      setOppPos({ x: cx + rnd(-14, 14), y: cy + rnd(-8, 8) })
    } else {
      if (isMe) {
        setMyPos({ x: 100 + rnd(-42, 42), y: rnd(28, 72) })
        setOppPos({ x: 100 + rnd(-28, 28), y: rnd(44, 78) })
      } else {
        setOppPos({ x: 100 + rnd(-42, 42), y: rnd(28, 72) })
        setMyPos({ x: 100 + rnd(-28, 28), y: rnd(44, 78) })
      }
    }
    return () => clearTimeout(flashTimer.current)
  }, [play])

  const myLabel  = (myName  || 'ME').substring(0, 3).toUpperCase()
  const oppLabel = (oppName || 'OPP').substring(0, 3).toUpperCase()

  return (
    <div className="bvr-court-wrap">
      <svg viewBox="0 0 200 138" className="bvr-court">
        {/* Floor */}
        <rect width="200" height="138" fill="#0d0d1a" rx="6" />
        {/* Court outline */}
        <rect x="5" y="5" width="190" height="128" fill="none" stroke="#1a1a2e" strokeWidth="1.5" />
        {/* 3-point arc */}
        <path d="M 8,133 A 95,95 0 0,1 192,133" fill="none" stroke="#1a1a2e" strokeWidth="1.5" />
        {/* Paint / lane */}
        <rect x="70" y="5" width="60" height="48" fill="#111126" stroke="#1a1a2e" strokeWidth="1" />
        {/* Free-throw circle */}
        <circle cx="100" cy="53" r="18" fill="none" stroke="#1a1a2e" strokeWidth="1" />
        {/* Backboard */}
        <line x1="86" y1="7" x2="114" y2="7" stroke="#555" strokeWidth="2" strokeLinecap="round" />
        {/* Basket rim */}
        <circle cx="100" cy="17" r="7" fill="none" stroke="#f97316" strokeWidth="2" />
        {/* Net hint */}
        <line x1="96" y1="17" x2="100" y2="26" stroke="#f9731644" strokeWidth="1" />
        <line x1="104" y1="17" x2="100" y2="26" stroke="#f9731644" strokeWidth="1" />
        {/* Score ripple on basket */}
        {flash && (
          <circle cx="100" cy="17" r="7" fill={flash === 'me' ? myColor : oppColor} opacity="0.75">
            <animate attributeName="r" values="7;32" dur="0.55s" fill="freeze" />
            <animate attributeName="opacity" values="0.75;0" dur="0.55s" fill="freeze" />
          </circle>
        )}
        {/* My player */}
        <g style={{ transform: `translate(${myPos.x}px,${myPos.y}px)`, transition: 'transform 0.42s cubic-bezier(0.34,1.2,0.64,1)' }}>
          <circle r="11" fill={myColor} opacity="0.95" />
          <circle r="11" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <text y="4" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="800"
            style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'monospace' }}>{myLabel}</text>
        </g>
        {/* Opp player */}
        <g style={{ transform: `translate(${oppPos.x}px,${oppPos.y}px)`, transition: 'transform 0.42s cubic-bezier(0.34,1.2,0.64,1)' }}>
          <circle r="11" fill={oppColor} opacity="0.95" />
          <circle r="11" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <text y="4" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="800"
            style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'monospace' }}>{oppLabel}</text>
        </g>
      </svg>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BucketVersusResult({ myData, oppData, position, role, channel, versusGame, onRematch, onExit, onResult, user }) {
  const [phase,           setPhase]           = useState('reveal')
  const [playIdx,         setPlayIdx]         = useState(-1)
  const [game,            setGame]            = useState(null)
  const [myStats,         setMyStats]         = useState(null)
  const [oppStats,        setOppStats]        = useState(null)
  const [winner,          setWinner]          = useState(null)
  const [myRematchReady,  setMyRematchReady]  = useState(false)
  const [oppRematchReady, setOppRematchReady] = useState(false)
  const feedRef     = useRef(null)
  const resultFired = useRef(false)

  const types   = position === 'big' ? BIG_TYPES : GUARD_TYPES
  const myOVR   = calcBucketOVR(myData.build, types, position)
  const oppOVR  = calcBucketOVR(oppData.build, types, position)
  const myName  = myData.name || myData.player?.name?.split(' ').pop() || 'You'
  const oppName = oppData.player?.name?.split(' ').pop() || oppData.name || 'Opp'

  const myTeamData  = NBA_TEAMS.find(t => t.short === myData.player?.team)
  const oppTeamData = NBA_TEAMS.find(t => t.short === oppData.player?.team)
  const myColor     = myTeamData?.color  || '#ef4444'
  const oppColor    = oppTeamData?.color || '#3b82f6'
  const myTeamFull  = myTeamData?.name   || myData.player?.team  || ''
  const oppTeamFull = oppTeamData?.name  || oppData.player?.team || ''

  // Generate stats + game on mount
  useEffect(() => {
    const mySim  = runBucketSimulation(myData.build, types, randomTeam(), position)
    const oppSim = runBucketSimulation(oppData.build, types, randomTeam(), position)
    setMyStats(mySim)
    setOppStats(oppSim)

    if (role !== 'guest') {
      // Host or offline: generate and optionally broadcast
      const gameData = generate21(mySim, oppSim, position, myName, oppName)
      setGame(gameData)
      if (role === 'host' && channel) {
        channel.send({ type: 'broadcast', event: 'bab_game', payload: gameData }).catch?.(() => {})
      }
      return
    }

    // Guest fallback: if no game received within 3s, generate locally
    const fallback = setTimeout(() => {
      setGame(prev => prev || generate21(mySim, oppSim, position, myName, oppName))
    }, 3000)
    return () => clearTimeout(fallback)
  }, [])

  // Guest: use game broadcast by host (received via BucketApp prop)
  useEffect(() => {
    if (role !== 'guest' || !versusGame) return
    setGame(versusGame)
  }, [role, versusGame])

  // Rematch sync: listen for opponent ready signal
  useEffect(() => {
    if (!channel) return
    channel.on('broadcast', { event: 'bab_rematch' }, () => setOppRematchReady(true))
  }, [channel])

  // When both ready, trigger rematch
  useEffect(() => {
    if (myRematchReady && oppRematchReady) onRematch?.()
  }, [myRematchReady, oppRematchReady])

  function handleRematch() {
    if (!channel) { onRematch?.(); return }
    if (myRematchReady) return
    setMyRematchReady(true)
    channel.send({ type: 'broadcast', event: 'bab_rematch', payload: {} }).catch?.(() => {})
  }

  // Reveal → Live transition
  useEffect(() => {
    if (phase !== 'reveal') return
    const t = setTimeout(() => {
      setPhase('live')
      window.ramp?.que?.push(() => { window.ramp.spaNewPage() })
    }, 2800)
    return () => clearTimeout(t)
  }, [phase])

  // Live play ticker
  useEffect(() => {
    if (phase !== 'live' || !game) return
    if (playIdx >= game.plays.length - 1) {
      const last   = game.plays[game.plays.length - 1]
      const result = last.myPts >= 21 ? 'me' : 'opp'
      setWinner(result)
      if (!resultFired.current) {
        resultFired.current = true
        onResult?.(result === 'me' ? 'win' : 'loss')
      }
      const t = setTimeout(() => setPhase('result'), 2000)
      return () => clearTimeout(t)
    }
    const next  = game.plays[playIdx + 1]
    const delay = next.type === 'milestone' ? (next.big ? 1550 : 1100)
                : next.type === 'block'     ? 760
                : next.type === 'steal'     ? 690
                : next.big                  ? 760
                : next.type === 'miss'      ? 230
                : 540
    const t = setTimeout(() => setPlayIdx(i => i + 1), delay)
    return () => clearTimeout(t)
  }, [phase, playIdx, game])

  // Ads refresh on result
  useEffect(() => {
    if (phase === 'result') window.ramp?.que?.push(() => { window.ramp.spaNewPage() })
  }, [phase])

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [playIdx])

  const cur      = game?.plays[playIdx]
  const myScore  = cur?.myPts  ?? 0
  const oppScore = cur?.oppPts ?? 0

  const feedPlays = useMemo(() => {
    if (!game) return []
    return game.plays
      .slice(0, Math.max(0, playIdx + 1))
      .filter(p => p.type !== 'miss' && p.type !== 'milestone')
      .slice(-5)
      .reverse()
  }, [game, playIdx])

  const showMilestone = game?.plays[playIdx]?.type === 'milestone'
  const milestone     = showMilestone ? game.plays[playIdx] : null

  // ── Reveal phase ────────────────────────────────────────────────────────────
  if (phase === 'reveal') {
    return (
      <div className="versus-result bvr-reveal">
        <div className="vr-header">
          <span className="vr-header-label">HEAD TO HEAD</span>
        </div>
        <div className="vr-grid">
          <div className="vr-side bvr-reveal-side" style={{ animationDelay: '0.1s' }}>
            <div className="vr-you-tag">YOU</div>
            <div className="vr-model-wrap bvr-silhouette-wrap">
              <img src="/basketballsilhouette.png" className="bvr-reveal-silhouette" alt=""
                style={{ filter: `drop-shadow(0 0 20px ${myColor}99)` }} />
            </div>
            <div className="vr-player-name">{myData.player?.name ?? myName}</div>
            <div className="vr-team-name" style={{ color: myColor }}>{myTeamFull}</div>
            <div className="vr-ovr-badge">{myOVR} OVR</div>
          </div>
          <div className="vr-vs-col">
            <div className="bvr-tipoff-text">FIRST<br/>TO<br/>21</div>
          </div>
          <div className="vr-side bvr-reveal-side" style={{ animationDelay: '0.25s' }}>
            <div className="vr-you-tag">{oppData.name ?? 'OPPONENT'}</div>
            <div className="vr-model-wrap bvr-silhouette-wrap">
              <img src="/basketballsilhouetteheadless.png" className="bvr-reveal-silhouette bvr-reveal-silhouette--flip" alt=""
                style={{ filter: `drop-shadow(0 0 20px ${oppColor}99)` }} />
            </div>
            <div className="vr-player-name">{oppData.player?.name ?? oppName}</div>
            <div className="vr-team-name" style={{ color: oppColor }}>{oppTeamFull}</div>
            <div className="vr-ovr-badge">{oppOVR} OVR</div>
          </div>
        </div>
        <div id="ramp-cntr1-bvr-reveal" className="bvr-ad-slot" />
      </div>
    )
  }

  // ── Live game phase ──────────────────────────────────────────────────────────
  if (phase === 'live') {
    return (
      <div className="bvr-live">
        {/* Scoreboard */}
        <div className="bvr-board bvr-board--21">
          <div className="bvr-board-team bvr-board-team--me">
            <span className="bvr-board-name" style={{ color: myColor }}>{myName}</span>
            <ScoreDigit value={myScore} color={myScore >= oppScore ? '#fff' : 'rgba(255,255,255,0.42)'} />
          </div>
          <div className="bvr-board-mid">
            <div className="bvr-twenty1-label">21</div>
            <div className="bvr-live-dot"><span className="bvr-pulse" />LIVE</div>
          </div>
          <div className="bvr-board-team bvr-board-team--opp">
            <ScoreDigit value={oppScore} color={oppScore >= myScore ? '#fff' : 'rgba(255,255,255,0.42)'} />
            <span className="bvr-board-name" style={{ color: oppColor }}>{oppName}</span>
          </div>
        </div>

        {/* Progress bars toward 21 */}
        <div className="bvr-progress-row">
          <ProgressBar value={myScore}  color={myColor} />
          <ProgressBar value={oppScore} color={oppColor} />
        </div>

        {/* Half-court visual */}
        <CourtVisual play={cur} myColor={myColor} oppColor={oppColor} myName={myName} oppName={oppName} />

        {/* Milestone banner */}
        {milestone && (
          <div className={`bvr-banner bvr-banner--milestone${milestone.big ? ' bvr-banner--big' : ''}`}>
            <span className="bvr-banner-label">{milestone.text}</span>
            <span className="bvr-banner-score">{myScore} — {oppScore}</span>
          </div>
        )}

        {/* Play-by-play feed */}
        <div className="bvr-feed" ref={feedRef}>
          {feedPlays.map((p, i) => (
            <div
              key={p.id}
              className={`bvr-play bvr-play--${p.who ?? 'marker'}${p.big ? ' bvr-play--big' : ''}`}
              style={{
                opacity: 1 - i * 0.17,
                transform: `scale(${1 - i * 0.024})`,
                borderLeftColor: p.who === 'me' ? myColor : p.who === 'opp' ? oppColor : 'transparent',
              }}
            >
              {p.who === 'me'  && <span className="bvr-play-dot" style={{ background: myColor }} />}
              {p.who === 'opp' && <span className="bvr-play-dot" style={{ background: oppColor }} />}
              <span className="bvr-play-text">{p.text}</span>
              {p.pts > 0 && <span className={`bvr-play-pts bvr-play-pts--${p.pts}`}>+{p.pts}</span>}
              {(p.type === 'block' || p.type === 'steal') && (
                <span className="bvr-play-badge">{p.type === 'block' ? 'BLK' : 'STL'}</span>
              )}
            </div>
          ))}
          {feedPlays.length === 0 && (
            <div className="bvr-feed-waiting">
              <div className="versus-dots"><span /><span /><span /></div>
              <span>Ball in play…</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Result phase ──────────────────────────────────────────────────────────────
  const isWin    = winner === 'me'
  const finalMy  = game?.finalMy  ?? myScore
  const finalOpp = game?.finalOpp ?? oppScore

  return (
    <div className="versus-result">
      <div id="ramp-cntr1-bvr-result" className="bvr-ad-slot" />

      <div className="vr-header">
        <span className={`vr-header-label vr-header-label--result ${isWin ? 'vr-win' : 'vr-loss'}`}>
          {isWin ? 'YOU WIN' : 'YOU LOSE'}
        </span>
        <div className="bvr-result-flavor">First to 21 · Street Ball</div>
      </div>

      {/* Final score */}
      <div className="vr-game-score">
        <span className={isWin ? 'vr-gs-winner' : 'vr-gs-loser'} style={{ color: isWin ? '#fff' : 'rgba(255,255,255,0.35)' }}>{finalMy}</span>
        <span className="vr-gs-dash">–</span>
        <span className={!isWin ? 'vr-gs-winner' : 'vr-gs-loser'} style={{ color: !isWin ? '#fff' : 'rgba(255,255,255,0.35)' }}>{finalOpp}</span>
      </div>

      {/* Stat comparison */}
      <div className="vr-grid">
        <div className={`vr-side ${isWin ? 'vr-side--winner' : 'vr-side--loser'}`}>
          <div className="vr-you-tag">{user ? 'YOU' : 'Sign in to track stats'}</div>
          <div className="vr-model-wrap">
            <MiniBuild build={myData.build} types={types} color={myColor} />
          </div>
          <div className="vr-player-name">{myData.player?.name ?? myName}</div>
          <div className="vr-team-name" style={{ color: myColor }}>{myTeamFull}</div>
          <div className="vr-ovr-badge">{myOVR}</div>
          {myStats && (
            <div className="vr-stat-block">
              <div className="vr-stat"><span>{myStats.ppg}</span><em>PPG</em></div>
              <div className="vr-stat"><span>{myStats.fgPct}%</span><em>FG</em></div>
              {myStats.threePct > 0 && <div className="vr-stat"><span>{myStats.threePct}%</span><em>3P</em></div>}
              <div className="vr-stat"><span>{myStats.bpg}</span><em>BLK</em></div>
              <div className="vr-stat"><span>{myStats.spg}</span><em>STL</em></div>
            </div>
          )}
        </div>

        <div className="vr-vs-col">
          <div className={`vr-result-icon ${isWin ? 'vr-result-icon--win' : 'vr-result-icon--loss'}`}>
            {isWin ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            )}
          </div>
        </div>

        <div className={`vr-side ${!isWin ? 'vr-side--winner' : 'vr-side--loser'}`}>
          <div className="vr-you-tag">{oppData.name ?? 'OPPONENT'}</div>
          <div className="vr-model-wrap">
            <MiniBuild build={oppData.build} types={types} color={oppColor} />
          </div>
          <div className="vr-player-name">{oppData.player?.name ?? oppName}</div>
          <div className="vr-team-name" style={{ color: oppColor }}>{oppTeamFull}</div>
          <div className="vr-ovr-badge">{oppOVR}</div>
          {oppStats && (
            <div className="vr-stat-block">
              <div className="vr-stat"><span>{oppStats.ppg}</span><em>PPG</em></div>
              <div className="vr-stat"><span>{oppStats.fgPct}%</span><em>FG</em></div>
              {oppStats.threePct > 0 && <div className="vr-stat"><span>{oppStats.threePct}%</span><em>3P</em></div>}
              <div className="vr-stat"><span>{oppStats.bpg}</span><em>BLK</em></div>
              <div className="vr-stat"><span>{oppStats.spg}</span><em>STL</em></div>
            </div>
          )}
        </div>
      </div>

      <div className="vr-actions">
        {channel ? (
          myRematchReady ? (
            <button className="vr-btn vr-btn--primary vr-btn--waiting" disabled>
              Waiting for {oppData.name || 'opponent'}…
            </button>
          ) : (
            <button className="vr-btn vr-btn--primary" onClick={handleRematch}>REMATCH</button>
          )
        ) : (
          <button className="vr-btn vr-btn--primary" onClick={handleRematch}>REMATCH</button>
        )}
        <button className="vr-btn" onClick={onExit}>EXIT</button>
      </div>
    </div>
  )
}
