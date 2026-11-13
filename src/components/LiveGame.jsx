import { useEffect, useRef, useState } from 'react'
import { TEAMS } from '../data/nfl-teams'
import { readableTextColor } from '../utils/simulation'

// The live playoff game: a scoreboard that plays the final score out over ten seconds, the clock, the
// quarters, each score as it lands. Football's season page (SimPage) and College Football's (CFBSimPage).
// Styles: index.css (.plf-*)
// ── Score timeline builder ────────────────────────────────────────────────────

function buildScoreTimeline(myFinal, oppFinal, overtime = false) {
  const shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  // Returns true if n can be exactly expressed as a sum of {3,6,7,8}
  // Unreachable values: 1, 2, 4, 5 — everything else >= 0 is reachable
  const reachable = n => n === 0 || (n >= 3 && n !== 4 && n !== 5)

  const toPlays = total => {
    if (total <= 0) return []
    let target = total
    while (!reachable(target)) target++

    const plays = []
    let rem = target
    while (rem > 0) {
      // Weighted: among TDs → 90% = 7pts, 5% = 8pts, 5% = 6pts; ~30% of all plays are FGs
      const opts = [
        { pts: 7, w: 63 },
        { pts: 3, w: 30 },
        { pts: 8, w:  4 },
        { pts: 6, w:  3 },
      ].filter(o => o.pts <= rem && reachable(rem - o.pts))
      if (opts.length === 0) break
      const pool = opts.reduce((s, o) => s + o.w, 0)
      let r = Math.random() * pool
      const pick = opts.find(o => (r -= o.w) < 0) ?? opts[0]
      plays.push(pick.pts)
      rem -= pick.pts
    }
    return plays
  }
  let regMyFinal = myFinal
  let regOppFinal = oppFinal
  let otEvent = null

  if (overtime) {
    // Regulation must end tied — derive tie score and isolate the OT-winning play
    const tiedScore = Math.min(myFinal, oppFinal)
    const otPts     = Math.abs(myFinal - oppFinal)  // 3 (FG) or 7 (TD)
    regMyFinal  = tiedScore
    regOppFinal = tiedScore
    otEvent = { team: myFinal > oppFinal ? 'me' : 'opp', pts: otPts }
  }

  const myPlays  = toPlays(regMyFinal)
  const oppPlays = toPlays(regOppFinal)
  const all = shuffle([
    ...myPlays.map(pts  => ({ team: 'me',  pts })),
    ...oppPlays.map(pts => ({ team: 'opp', pts })),
  ])
  const spacing = all.length ? Math.floor(3400 / all.length) : 900
  const events = all.map((evt, i) => ({
    ...evt,
    gameSec: Math.min(3400, Math.round(spacing * i + Math.random() * spacing * 0.7 + 25)),
  }))

  if (otEvent) {
    // OT-winning score drops somewhere in the OT period
    events.push({ ...otEvent, gameSec: 3700 + Math.floor(Math.random() * 600) })
  } else {
    // Close game: sometimes push the game-winning score into the final minute
    const margin = Math.abs(myFinal - oppFinal)
    if (events.length >= 1 && margin <= 7 && Math.random() < 0.50) {
      const winner = myFinal > oppFinal ? 'me' : 'opp'
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].team === winner) {
          events[i].gameSec = 3530 + Math.floor(Math.random() * 65)
          events.sort((a, b) => a.gameSec - b.gameSec)
          break
        }
      }
    }
  }

  return events
}

const GAME_MS    = 10_000
const TICK_MS    = 50
const TOTAL_TICK = GAME_MS / TICK_MS
const GAME_SECS  = 3_600
const OT_EXTRA   = 900   // virtual seconds added for OT period (900/4500 * 10000ms = 2s)

// ── Live playoff game ─────────────────────────────────────────────────────────

const TEAM_BY_NAME = Object.fromEntries(TEAMS.map(t => [t.name, t]))

const WEATHER_EMOJI = { clear: '☀️', rain: '🌧️', snow: '❄️', dome: '🏟️' }

export function PlayoffGame({ round, opponent, home, weather, mySc, oppSc, won, overtime, teamColor, teamAbbr, teamLogo, isFinal, isAllTime, onDone, oppLogo: oppLogoIn = null, oppAbbr: oppAbbrIn = null, finalWord = 'Super Bowl', champWord = '✓ Champions!', winWord = '✓ Advancing', lossWord = '✗ Eliminated', textColor = null, titleGame = null }) {
  const myText = textColor ?? readableTextColor(teamColor)
  const [phase,    setPhase]    = useState('pre')
  const [gameSec,  setGameSec]  = useState(0)
  const [myScore,  setMyScore]  = useState(0)
  const [oppScore, setOppScore] = useState(0)
  const [visEvt,   setVisEvt]   = useState(null)
  const [evtKey,   setEvtKey]   = useState(0)
  const [noAnim,   setNoAnim]   = useState(false)
  const [events]                = useState(() => buildScoreTimeline(mySc, oppSc, overtime))
  const [showOTBanner, setShowOTBanner] = useState(false)
  const totalGameSecs           = overtime ? GAME_SECS + OT_EXTRA : GAME_SECS
  const tickRef      = useRef(0)
  const evtIdxRef    = useRef(0)
  const myScoreRef   = useRef(0)
  const oppScoreRef  = useRef(0)
  const ivRef        = useRef(null)
  const doneRef      = useRef(false)
  const otPauseRef   = useRef(false)   // true while OT break is in progress
  const otTriggered  = useRef(false)   // have we fired the OT pause yet

  useEffect(() => {
    const pre = setTimeout(() => {
      setPhase('live')
      ivRef.current = setInterval(() => {
        if (otPauseRef.current) return   // frozen during OT break

        tickRef.current++
        const tick = tickRef.current
        const gs = Math.min(totalGameSecs - 1, Math.round((tick / TOTAL_TICK) * totalGameSecs))
        setGameSec(gs)

        // Pause at end of regulation before OT starts
        if (overtime && !otTriggered.current && gs >= GAME_SECS) {
          otTriggered.current = true
          otPauseRef.current  = true
          setShowOTBanner(true)
          setTimeout(() => {
            otPauseRef.current = false
            setShowOTBanner(false)
          }, 1600)
        }

        while (evtIdxRef.current < events.length && events[evtIdxRef.current].gameSec <= gs) {
          const e = events[evtIdxRef.current]
          if (e.team === 'me') {
            myScoreRef.current += e.pts
            setMyScore(myScoreRef.current)
          } else {
            oppScoreRef.current += e.pts
            setOppScore(oppScoreRef.current)
          }
          setVisEvt(e)
          setEvtKey(k => k + 1)
          evtIdxRef.current++
        }

        if (tick >= TOTAL_TICK && !doneRef.current) {
          clearInterval(ivRef.current)
          setNoAnim(true)
          if (myScoreRef.current !== mySc)   setMyScore(mySc)
          if (oppScoreRef.current !== oppSc) setOppScore(oppSc)
          setGameSec(totalGameSecs - 1)
          setPhase('post')
          doneRef.current = true
          setTimeout(onDone, 2400)
        }
      }, TICK_MS)
    }, 700)
    return () => { clearTimeout(pre); clearInterval(ivRef.current) }
  }, [])

  const isOTPhase = overtime && gameSec >= GAME_SECS
  const q         = isOTPhase ? 4 : Math.min(3, Math.floor(gameSec / 900))
  const qSec      = isOTPhase ? Math.max(0, OT_EXTRA - (gameSec - GAME_SECS)) : 900 - (gameSec % 900)
  const progress  = isOTPhase ? (gameSec - GAME_SECS) / (OT_EXTRA - 1) : gameSec / (GAME_SECS - 1)
  const evtLabel = pts => pts === 8 ? '▲ TD + 2pt' : pts >= 6 ? '▲ TD' : '▲ FG'
  const oppTeam  = TEAM_BY_NAME[opponent]
  const oppLogo  = oppLogoIn ?? oppTeam?.logo
  const oppShort = oppAbbrIn ?? oppTeam?.short ?? opponent.split(' ').slice(-1)[0]

  const postMsg  = won ? (isFinal ? champWord : winWord) : lossWord

  return (
    <div className={`plf-game${titleGame ? ' plf-game--title' : ''}${phase === 'post' ? (won ? ' plf-game-won' : ' plf-game-lost') : ''}`}>
      <div className="plf-round-row">
        {/* titleGame: { name, venue } — the title game's card (index.css .plf-game--title) */}
        <div className="plf-round-lbl">{titleGame?.name ?? round}{titleGame?.venue && <small className="plf-title-venue">{titleGame.venue}</small>}</div>
        {weather && (
          <div className="plf-weather-block">
            <span className="plf-weather-icon">{WEATHER_EMOJI[weather]}</span>
            <span className="plf-weather-lbl">{weather.charAt(0).toUpperCase() + weather.slice(1)}</span>
          </div>
        )}
      </div>
      <div className="plf-matchup">
        <span>{round === finalWord ? 'vs' : home ? 'vs' : '@'} {opponent}</span>
        {round !== finalWord && <span className="plf-venue-tag">{home ? 'HOME' : 'AWAY'}</span>}
      </div>

      <div className="plf-scoreboard">
        {/* Left side — away team */}
        <div className="plf-score-side plf-score-me">
          {home ? (
            <>{oppLogo && <img src={oppLogo} alt="" className="plf-team-logo" />}
              <div className="plf-team-abbr plf-abbr-opp">{oppShort}</div>
              {isAllTime && <span className="plf-team-alltime">★ All-Time</span>}
              <div className="plf-score-num plf-score-opp-num"><span key={noAnim ? 'opp-final' : oppScore} className={noAnim ? '' : 'plf-num-pop'}>{oppScore}</span></div></>
          ) : (
            <>{teamLogo && <img src={teamLogo} alt="" className="plf-team-logo" />}
              <div className="plf-team-abbr" style={{ color: myText }}>{teamAbbr}</div>
              {isAllTime && <span className="plf-team-alltime">★ All-Time</span>}
              <div className="plf-score-num" style={{ color: myText }}><span key={noAnim ? 'my-final' : myScore} className={noAnim ? '' : 'plf-num-pop'}>{myScore}</span></div></>
          )}
        </div>

        <div className="plf-score-mid">
          <span className="plf-at-sym">@</span>
          {showOTBanner ? (
            <div className="plf-ot-banner">OT</div>
          ) : phase === 'live' ? (
            <div className="plf-live-pill">
              <span className="plf-live-dot" />LIVE
            </div>
          ) : phase === 'post' ? (
            <div className={`plf-result-badge ${won ? 'plf-rb-win' : 'plf-rb-loss'}`}>
              {won ? 'W' : 'L'}{overtime && <span className="plf-ot-tag">OT</span>}
            </div>
          ) : null}
        </div>

        {/* Right side — home team */}
        <div className="plf-score-side plf-score-opp">
          {home ? (
            <>{teamLogo && <img src={teamLogo} alt="" className="plf-team-logo plf-logo-opp" />}
              <div className="plf-team-abbr" style={{ color: myText }}>{teamAbbr}</div>
              {isAllTime && <span className="plf-team-alltime">★ All-Time</span>}
              <div className="plf-score-num" style={{ color: myText }}><span key={noAnim ? 'my-final' : myScore} className={noAnim ? '' : 'plf-num-pop'}>{myScore}</span></div></>
          ) : (
            <>{oppLogo && <img src={oppLogo} alt="" className="plf-team-logo plf-logo-opp" />}
              <div className="plf-team-abbr plf-abbr-opp">{oppShort}</div>
              {isAllTime && <span className="plf-team-alltime">★ All-Time</span>}
              <div className="plf-score-num plf-score-opp-num"><span key={noAnim ? 'opp-final' : oppScore} className={noAnim ? '' : 'plf-num-pop'}>{oppScore}</span></div></>
          )}
        </div>
      </div>

      {phase === 'live' && (
        <>
          <div className="plf-status-row">
            <div className="plf-qtr-dots">
              {[0,1,2,3,...(isOTPhase ? [4] : [])].map(i => (
                <div
                  key={i}
                  className={`plf-qtr-dot${i < q ? ' plf-qd-done' : i === q ? ' plf-qd-active' : ''}${i === 4 ? ' plf-qd-ot' : ''}`}
                  style={i === q ? { background: i === 4 ? '#fbbf24' : teamColor, boxShadow: `0 0 10px ${i === 4 ? '#fbbf2499' : teamColor + '99'}` } : {}}
                />
              ))}
            </div>
            <div className="plf-clock-box">
              <span className={`plf-qtr-lbl${isOTPhase ? ' plf-qtr-lbl-ot' : ''}`}>{isOTPhase ? 'OT' : `Q${q + 1}`}</span>
              <span className="plf-clk-sep">·</span>
              <span className="plf-clock-time">
                {Math.floor(qSec / 60)}:{String(qSec % 60).padStart(2, '0')}
              </span>
            </div>
          </div>
          <div className="plf-progress">
            <div className="plf-progress-fill" style={{ width: `${progress * 100}%`, background: teamColor }} />
          </div>
        </>
      )}

      {visEvt && phase === 'live' && (
        <div key={evtKey} className={`plf-score-evt ${visEvt.team === 'me' ? 'plf-evt-me' : 'plf-evt-opp'} ${(visEvt.team === 'me') === home ? 'plf-evt-right' : 'plf-evt-left'}`}>
          {evtLabel(visEvt.pts)} · {visEvt.team === 'me' ? teamAbbr : oppShort}
        </div>
      )}

      {phase === 'post' && (
        <div className={`plf-post-line ${won ? 'plf-pl-won' : 'plf-pl-lost'}`}>
          <span>{postMsg}</span>
          <span className="plf-post-score">{mySc} – {oppSc}{overtime && <span className="plf-post-ot"> OT</span>}</span>
        </div>
      )}
    </div>
  )
}
