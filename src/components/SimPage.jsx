import { useState, useEffect, useRef } from 'react'
import { ATTR, TYPES, TEAMS } from '../data/qbs'
import { valToGrade, getArchetype, readableTextColor } from '../utils/simulation'
import QBAvatar from './QBAvatar'

// ── Helpers ──────────────────────────────────────────────────────────────────

function offDefGrade(val) {
  if (val >= 10) return 'A+'
  if (val >= 9)  return 'A'
  if (val >= 8)  return 'B+'
  if (val >= 7)  return 'B'
  if (val >= 6)  return 'C+'
  if (val >= 5)  return 'C'
  if (val >= 4)  return 'D+'
  if (val >= 3)  return 'D'
  return 'F'
}

function useCountUp(target, duration = 900, enabled = true) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!enabled || !target) return
    const start = Date.now()
    let raf
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, enabled])
  return val
}

// ── Screen 1: Build Overview ──────────────────────────────────────────────────

function ScreenBuild({ result, build, types, onNext }) {
  const { ovr } = result
  const archetype = getArchetype(ovr, build, types)
  const ovrDisplay = useCountUp(ovr, 900)
  const [rowsVisible, setRowsVisible] = useState(0)
  const filled = types.filter(t => build[t])

  useEffect(() => {
    let i = 0
    const tick = () => {
      if (i >= filled.length) return
      i++
      setRowsVisible(i)
      setTimeout(tick, 80)
    }
    const t = setTimeout(tick, 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="simp-screen">
      <div className="simp-ovr-hero">
        <div className="simp-ovr-num">{ovrDisplay || '–'}</div>
        <div className="simp-ovr-lbl">OVR</div>
      </div>
      <div className="simp-archetype">{archetype}</div>
      <button className="simp-cta" onClick={onNext}>Simulate Season</button>
      <div className="simp-attr-table">
        {filled.map((t, i) => {
          const meta = ATTR[t]
          const data = build[t]
          return (
            <div
              key={t}
              className={`simp-attr-row${i < rowsVisible ? ' simp-row-visible' : ''}`}
            >
              <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={46} />
              <div className="simp-attr-info">
                <span className="simp-attr-name">{meta.label}</span>
                <span className="simp-attr-qb">{data.qbFull}</span>
              </div>
              <span className="simp-grade-circle" style={{ background: meta.hex, color: '#07120a' }}>
                {valToGrade(data.val)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Screen 2: Regular Season ──────────────────────────────────────────────────

function ScreenSeason({ result, onNext }) {
  const { games, seasonPassYds, seasonTDs, seasonINTs, seasonRating, seasonCompPct, seasonRushYds, seasonRushTDs, seasonSacks, playoffs, hasBye } = result

  const [phase, setPhase]           = useState('loading')
  const [revealed, setRevealed]     = useState(0)
  const [liveWins, setLiveWins]     = useState(0)
  const [liveLosses, setLiveLosses] = useState(0)

  const allDone = revealed === games.length

  useEffect(() => {
    const loadTimer = setTimeout(() => {
      setPhase('playing')
      let i = 0, w = 0, l = 0

      const revealNext = () => {
        if (i >= games.length) { setPhase('done'); return }
        const g = games[i]
        if (g.won) w++; else l++
        setRevealed(i + 1)
        setLiveWins(w)
        setLiveLosses(l)
        i++
        setTimeout(revealNext, 200)
      }

      revealNext()
    }, 900)

    return () => clearTimeout(loadTimer)
  }, [])

  return (
    <div className="simp-screen">

      {phase === 'loading' && (
        <div className="simp-loading">
          <div className="simp-loading-dot" /><div className="simp-loading-dot" /><div className="simp-loading-dot" />
          <div className="simp-loading-lbl">Simulating season…</div>
        </div>
      )}

      {phase !== 'loading' && (
        <>
          <div className="simp-eyebrow">Regular Season</div>
          <div className="simp-live-record">
            <span className="slr-w">{liveWins}</span>
            <span className="slr-sep">–</span>
            <span className="slr-l">{liveLosses}</span>
          </div>
          {allDone && (
            <div className="simp-record-sub simp-record-sub-in">
              {playoffs ? 'Playoff Bound' : 'Missed the Playoffs'}
            </div>
          )}
          {allDone && hasBye && (
            <div className="simp-bye-badge simp-record-sub-in">First Round Bye</div>
          )}

          <div className="simp-games-list">
            {games.slice(0, revealed).map(g => (
              <div key={g.wk} className={`simp-game-row ${g.won ? 'sgr-w' : 'sgr-l'} sgr-in`}>
                <span className="sgr-wk">WK {g.wk}</span>
                <span className={`sgr-badge ${g.won ? 'sgr-badge-w' : 'sgr-badge-l'}`}>{g.won ? 'W' : 'L'}</span>
                <span className="sgr-opp"><span className="sgr-venue">{g.home ? 'vs' : '@'}</span>{g.opponent}</span>
                <span className="sgr-score">{g.mySc}–{g.oppSc}</span>
                <span className="sgr-stat">{g.passYds}<span className="sgr-unit">yds</span> {g.tds}<span className="sgr-unit">TD</span> {g.ints}<span className="sgr-unit">INT</span></span>
              </div>
            ))}
          </div>

          {allDone && (
            <div className="simp-stat-section simp-totals-in">
              <div className="simp-stat-group-lbl">Production</div>
              <div className="simp-totals">
                <div className="simp-total-cell">
                  <div className="simp-total-val">{seasonPassYds.toLocaleString()}</div>
                  <div className="simp-total-lbl">Pass Yds</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{seasonTDs}</div>
                  <div className="simp-total-lbl">Pass TDs</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{seasonINTs}</div>
                  <div className="simp-total-lbl">INTs</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{seasonCompPct}%</div>
                  <div className="simp-total-lbl">Comp%</div>
                </div>
              </div>
              <div className="simp-totals simp-totals-3" style={{ marginTop: 14 }}>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{seasonRushYds.toLocaleString()}</div>
                  <div className="simp-total-lbl">Rush Yds</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{seasonRushTDs}</div>
                  <div className="simp-total-lbl">Rush TDs</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{seasonSacks}</div>
                  <div className="simp-total-lbl">Sacks</div>
                </div>
              </div>
            </div>
          )}

          {allDone && (
            <button className="simp-cta simp-cta-in" onClick={onNext}>
              {playoffs ? 'Enter Playoffs' : 'Season Summary'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Score timeline builder ────────────────────────────────────────────────────

function buildScoreTimeline(myFinal, oppFinal) {
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
  const myPlays  = toPlays(myFinal)
  const oppPlays = toPlays(oppFinal)
  const all = shuffle([
    ...myPlays.map(pts  => ({ team: 'me',  pts })),
    ...oppPlays.map(pts => ({ team: 'opp', pts })),
  ])
  const spacing = all.length ? Math.floor(3500 / all.length) : 900
  return all.map((evt, i) => ({
    ...evt,
    gameSec: Math.min(3500, Math.round(spacing * i + Math.random() * spacing * 0.7 + 25)),
  }))
}

const GAME_MS    = 10_000
const TICK_MS    = 50
const TOTAL_TICK = GAME_MS / TICK_MS
const GAME_SECS  = 3_600

// ── Live playoff game ─────────────────────────────────────────────────────────

const TEAM_BY_NAME = Object.fromEntries(TEAMS.map(t => [t.name, t]))

const WEATHER_EMOJI = { clear: '☀️', rain: '🌧️', snow: '❄️', dome: '🏟️' }

function PlayoffGame({ round, opponent, home, weather, mySc, oppSc, won, teamColor, teamAbbr, teamLogo, isFinal, onDone }) {
  const [phase,    setPhase]    = useState('pre')
  const [gameSec,  setGameSec]  = useState(0)
  const [myScore,  setMyScore]  = useState(0)
  const [oppScore, setOppScore] = useState(0)
  const [visEvt,   setVisEvt]   = useState(null)
  const [evtKey,   setEvtKey]   = useState(0)
  const [noAnim,   setNoAnim]   = useState(false)
  const [events]                = useState(() => buildScoreTimeline(mySc, oppSc))
  const tickRef    = useRef(0)
  const evtIdxRef  = useRef(0)
  const myScoreRef = useRef(0)
  const oppScoreRef= useRef(0)
  const ivRef      = useRef(null)
  const doneRef    = useRef(false)

  useEffect(() => {
    const pre = setTimeout(() => {
      setPhase('live')
      ivRef.current = setInterval(() => {
        tickRef.current++
        const tick = tickRef.current
        const gs = Math.min(GAME_SECS - 1, Math.round((tick / TOTAL_TICK) * GAME_SECS))
        setGameSec(gs)

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
          setGameSec(GAME_SECS - 1)
          setPhase('post')
          doneRef.current = true
          setTimeout(onDone, 2400)
        }
      }, TICK_MS)
    }, 700)
    return () => { clearTimeout(pre); clearInterval(ivRef.current) }
  }, [])

  const q        = Math.min(3, Math.floor(gameSec / 900))
  const qSec     = 900 - (gameSec % 900)
  const progress = gameSec / (GAME_SECS - 1)
  const evtLabel = pts => pts === 8 ? '▲ TD + 2pt' : pts >= 6 ? '▲ TD' : '▲ FG'
  const oppTeam  = TEAM_BY_NAME[opponent]
  const oppLogo  = oppTeam?.logo

  const postMsg  = won ? (isFinal ? '✓ Champions!' : '✓ Advancing') : '✗ Eliminated'

  return (
    <div className={`plf-game${phase === 'post' ? (won ? ' plf-game-won' : ' plf-game-lost') : ''}`}>
      <div className="plf-round-row">
        <div className="plf-round-lbl">{round}</div>
        {weather && (
          <div className="plf-weather-block">
            <span className="plf-weather-icon">{WEATHER_EMOJI[weather]}</span>
            <span className="plf-weather-lbl">{weather.charAt(0).toUpperCase() + weather.slice(1)}</span>
          </div>
        )}
      </div>
      <div className="plf-matchup">
        <span>{round === 'Super Bowl' ? 'vs' : home ? 'vs' : '@'} {opponent}</span>
        {round !== 'Super Bowl' && <span className="plf-venue-tag">{home ? 'HOME' : 'AWAY'}</span>}
      </div>

      <div className="plf-scoreboard">
        {/* Left side — away team */}
        <div className="plf-score-side plf-score-me">
          {home ? (
            <>{oppLogo && <img src={oppLogo} alt="" className="plf-team-logo" />}
              <div className="plf-team-abbr plf-abbr-opp">{oppTeam?.short ?? opponent.split(' ').slice(-1)[0]}</div>
              <div className="plf-score-num plf-score-opp-num"><span key={noAnim ? 'opp-final' : oppScore} className={noAnim ? '' : 'plf-num-pop'}>{oppScore}</span></div></>
          ) : (
            <>{teamLogo && <img src={teamLogo} alt="" className="plf-team-logo" />}
              <div className="plf-team-abbr" style={{ color: readableTextColor(teamColor) }}>{teamAbbr}</div>
              <div className="plf-score-num" style={{ color: readableTextColor(teamColor) }}><span key={noAnim ? 'my-final' : myScore} className={noAnim ? '' : 'plf-num-pop'}>{myScore}</span></div></>
          )}
        </div>

        <div className="plf-score-mid">
          <span className="plf-at-sym">@</span>
          {phase === 'live' ? (
            <div className="plf-live-pill">
              <span className="plf-live-dot" />LIVE
            </div>
          ) : phase === 'post' ? (
            <div className={`plf-result-badge ${won ? 'plf-rb-win' : 'plf-rb-loss'}`}>{won ? 'W' : 'L'}</div>
          ) : null}
        </div>

        {/* Right side — home team */}
        <div className="plf-score-side plf-score-opp">
          {home ? (
            <>{teamLogo && <img src={teamLogo} alt="" className="plf-team-logo plf-logo-opp" />}
              <div className="plf-team-abbr" style={{ color: readableTextColor(teamColor) }}>{teamAbbr}</div>
              <div className="plf-score-num" style={{ color: readableTextColor(teamColor) }}><span key={noAnim ? 'my-final' : myScore} className={noAnim ? '' : 'plf-num-pop'}>{myScore}</span></div></>
          ) : (
            <>{oppLogo && <img src={oppLogo} alt="" className="plf-team-logo plf-logo-opp" />}
              <div className="plf-team-abbr plf-abbr-opp">{oppTeam?.short ?? opponent.split(' ').slice(-1)[0]}</div>
              <div className="plf-score-num plf-score-opp-num"><span key={noAnim ? 'opp-final' : oppScore} className={noAnim ? '' : 'plf-num-pop'}>{oppScore}</span></div></>
          )}
        </div>
      </div>

      {phase === 'live' && (
        <>
          <div className="plf-status-row">
            <div className="plf-qtr-dots">
              {[0,1,2,3].map(i => (
                <div
                  key={i}
                  className={`plf-qtr-dot${i < q ? ' plf-qd-done' : i === q ? ' plf-qd-active' : ''}`}
                  style={i === q ? { background: teamColor, boxShadow: `0 0 10px ${teamColor}99` } : {}}
                />
              ))}
            </div>
            <div className="plf-clock-box">
              <span className="plf-qtr-lbl">Q{q + 1}</span>
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
          {evtLabel(visEvt.pts)} · {visEvt.team === 'me' ? teamAbbr : (oppTeam?.short ?? opponent.split(' ').slice(-1)[0])}
        </div>
      )}

      {phase === 'post' && (
        <div className={`plf-post-line ${won ? 'plf-pl-won' : 'plf-pl-lost'}`}>
          <span>{postMsg}</span>
          <span className="plf-post-score">{mySc} – {oppSc}</span>
        </div>
      )}
    </div>
  )
}

// ── Screen 3: Playoffs ────────────────────────────────────────────────────────

function ScreenPlayoffs({ result, onNext }) {
  const { wins, losses, playoffs, playoffRounds, team } = result
  const [gameIdx, setGameIdx] = useState(0)
  const [status,  setStatus]  = useState('playing')
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!playoffs) return
    const t = setTimeout(() => setStarted(true), 500)
    return () => clearTimeout(t)
  }, [playoffs])

  const handleGameDone = () => {
    const r = playoffRounds[gameIdx]
    if (!r.won) { setStatus('eliminated'); return }
    if (gameIdx === playoffRounds.length - 1) { setStatus('champion'); return }
    setStatus('between')
    setTimeout(() => {
      setGameIdx(i => i + 1)
      setStatus('playing')
    }, 2500)
  }

  const teamColor = team?.color || '#5EDBD8'
  const teamAbbr  = team?.short || 'YOU'
  const teamLogo  = team?.logo  || null

  if (!playoffs) {
    return (
      <div className="simp-screen simp-screen-center">
        <div className="simp-eyebrow">Postseason</div>
        <div className="simp-miss-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="24" cy="24" r="19"/>
            <path d="M16 16l16 16M32 16L16 32"/>
          </svg>
        </div>
        <div className="simp-miss-title">Missed the Playoffs</div>
        <button className="simp-cta" onClick={onNext}>See Summary</button>
      </div>
    )
  }

  if (status === 'champion') {
    const sb = playoffRounds[playoffRounds.length - 1]
    return (
      <div className="simp-screen simp-screen-center plf-champion-screen">
        <img src="/trophy.png" alt="" className="sfb-trophy" />
        <div className="plf-champ-label">Super Bowl Champions</div>
        <div className="plf-champ-sub">{sb.mySc}–{sb.oppSc} vs {sb.opponent}</div>
        <button className="simp-cta simp-cta-in" onClick={onNext}>Final Report</button>
      </div>
    )
  }

  if (status === 'eliminated') {
    const r = playoffRounds[gameIdx]
    return (
      <div className="simp-screen simp-screen-center">
        <div className="simp-eyebrow">Season Over</div>
        <div className="plf-elim-title">{r.round === 'Super Bowl' ? 'Lost Super Bowl' : 'Eliminated'}</div>
        <div className="plf-elim-round">{r.round === 'Super Bowl' ? '' : r.round}</div>
        <div className="plf-elim-score">{r.mySc} – {r.oppSc} · vs {r.opponent}</div>
        <button className="simp-cta" onClick={onNext}>Final Report</button>
      </div>
    )
  }

  if (status === 'between') {
    const r    = playoffRounds[gameIdx]
    const next = playoffRounds[gameIdx + 1]
    return (
      <div className="simp-screen simp-screen-center plf-between-screen">
        <div className="plf-bw-result">
          <span className="plf-bw-w">W</span>
          <span className="plf-bw-score">{r.mySc}–{r.oppSc}</span>
        </div>
        <div className="plf-bw-adv">Advancing…</div>
        {next && <div className="plf-bw-next">Next up · {next.round}</div>}
      </div>
    )
  }

  const current = playoffRounds[gameIdx]
  return (
    <div className="simp-screen">
      <div className="simp-eyebrow">Playoffs</div>
      {!started ? (
        <div className="simp-loading">
          <div className="simp-loading-dot" /><div className="simp-loading-dot" /><div className="simp-loading-dot" />
          <div className="simp-loading-lbl">Entering Playoffs…</div>
        </div>
      ) : (
        <PlayoffGame
          key={gameIdx}
          round={current.round}
          opponent={current.opponent}
          home={current.home}
          weather={current.weather}
          mySc={current.mySc}
          oppSc={current.oppSc}
          won={current.won}
          teamColor={teamColor}
          teamAbbr={teamAbbr}
          teamLogo={teamLogo}
          isFinal={gameIdx === playoffRounds.length - 1}
          onDone={handleGameDone}
        />
      )}
    </div>
  )
}

// ── Screen 4: Final Report ────────────────────────────────────────────────────

function ScreenFinal({ result, build, types, onReset, onBack }) {
  const { ovr, wins, losses, playoffs, sbResult, seasonPassYds, seasonTDs, seasonINTs, seasonRushYds, seasonRushTDs, seasonSacks, seasonCompPct, seasonRating, bestGame } = result
  const champion = sbResult?.won
  const [show, setShow] = useState(false)

  useEffect(() => { const t = setTimeout(() => setShow(true), 200); return () => clearTimeout(t) }, [])

  useEffect(() => {
    if (adsDisabled) return
    window.ramp?.que?.push(() => {
      window.ramp.spaAddAds([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-sim' }])
    })
  }, [adsDisabled])

  const yds     = useCountUp(seasonPassYds, 1200, show)
  const tds     = useCountUp(seasonTDs, 900, show)
  const ints    = useCountUp(seasonINTs, 900, show)
  const rushYds = useCountUp(seasonRushYds, 1000, show)
  const sacks   = useCountUp(seasonSacks, 900, show)

  return (
    <div className="simp-screen">
      <div className={`simp-final-banner ${champion ? 'sfb-champ' : playoffs ? 'sfb-elim' : 'sfb-miss'}`}>
        {champion && <img src="/trophy.png" alt="Super Bowl Trophy" className="sfb-trophy" />}
        <div className="sfb-outcome">
          {champion ? 'Super Bowl Champions' : playoffs ? (sbResult?.round === 'Super Bowl' ? 'Lost Super Bowl' : `Eliminated — ${sbResult?.round}`) : 'Missed the Playoffs'}
        </div>
        <div className="sfb-sub">{wins}–{losses} Season · OVR {ovr}</div>
      </div>

      {champion && (
        <div className="simp-sb-box">
          <div className="simp-section-lbl">Super Bowl Performance</div>
          <div className="simp-totals">
            <div className="simp-total-cell">
              <div className="simp-total-val">{sbResult.passYds}</div>
              <div className="simp-total-lbl">Pass Yds</div>
            </div>
            <div className="simp-total-cell">
              <div className="simp-total-val">{sbResult.tds}</div>
              <div className="simp-total-lbl">TDs</div>
            </div>
            <div className="simp-total-cell">
              <div className="simp-total-val">{sbResult.ints ?? 0}</div>
              <div className="simp-total-lbl">INTs</div>
            </div>
            <div className="simp-total-cell">
              <div className="simp-total-val">{sbResult.rating}</div>
              <div className="simp-total-lbl">Rating</div>
            </div>
          </div>
        </div>
      )}

      <div className="simp-stat-section">
        <div className="simp-stat-group-lbl">Production</div>
        <div className="simp-totals">
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? yds.toLocaleString() : '–'}</div>
            <div className="simp-total-lbl">Pass Yds</div>
          </div>
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? tds : '–'}</div>
            <div className="simp-total-lbl">Pass TDs</div>
          </div>
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? ints : '–'}</div>
            <div className="simp-total-lbl">INTs</div>
          </div>
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? `${seasonCompPct}%` : '–'}</div>
            <div className="simp-total-lbl">Comp%</div>
          </div>
        </div>
        <div className="simp-totals simp-totals-3" style={{ marginTop: 14 }}>
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? rushYds.toLocaleString() : '–'}</div>
            <div className="simp-total-lbl">Rush Yds</div>
          </div>
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? result.seasonRushTDs : '–'}</div>
            <div className="simp-total-lbl">Rush TDs</div>
          </div>
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? sacks : '–'}</div>
            <div className="simp-total-lbl">Sacks</div>
          </div>
        </div>
      </div>

      {build && types && (
        <div className="simp-stat-section">
          <div className="simp-stat-group-lbl">Your Build</div>
          <div className="simp-attr-table simp-attr-table-sm">
            {types.filter(t => build[t]).map(t => {
              const meta = ATTR[t]
              const data = build[t]
              return (
                <div key={t} className="simp-attr-row simp-row-visible">
                  <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={36} />
                  <div className="simp-attr-info">
                    <span className="simp-attr-name">{meta.label}</span>
                    <span className="simp-attr-qb">{data.qbFull}</span>
                  </div>
                  <span className="simp-grade-circle" style={{ background: meta.hex, color: '#07120a' }}>
                    {valToGrade(data.val)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {bestGame && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body">
            <span className="sbg-week">Wk {bestGame.wk}</span>
            <span className="sbg-opp">vs {bestGame.opponent}</span>
            <span className="sbg-line">{bestGame.passYds} yds · {bestGame.tds} TD · {bestGame.ints} INT · {bestGame.rating} RTG</span>
          </div>
        </div>
      )}


      <div id="ramp-cntr1-sim" className="ad-cntr1-mobile" />

      <div className="simp-final-actions">
        <button className="simp-cta" onClick={onReset}>New Build</button>
        <button className="simp-ghost" onClick={onBack}>Back to Build</button>
      </div>
    </div>
  )
}

// ── Progress Dots ─────────────────────────────────────────────────────────────

function ProgressDots({ screen, total }) {
  return (
    <div className="simp-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`simp-dot ${i === screen ? 'simp-dot-active' : i < screen ? 'simp-dot-done' : ''}`} />
      ))}
    </div>
  )
}

// ── SimPage ───────────────────────────────────────────────────────────────────

export default function SimPage({ result, build, types = TYPES, onBack, onReset, replay = false, adsDisabled = false }) {
  const [screen, setScreen] = useState(replay ? 3 : 0)
  const next = () => {
    document.querySelector('.simp-page')?.scrollTo({ top: 0, behavior: 'instant' })
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.ramp?.que?.push(() => window.ramp.spaNewPage())
    setScreen(s => s + 1)
  }

  const handleReset = () => { setScreen(0); onReset() }
  const handleBack  = () => { setScreen(0); onBack()  }

  const screens = [
    <ScreenBuild    key="build"    result={result} build={build} types={types} onNext={next} />,
    <ScreenSeason   key="season"   result={result} onNext={next} />,
    <ScreenPlayoffs key="playoffs" result={result} onNext={next} />,
    <ScreenFinal    key="final"    result={result} build={build} types={types} onReset={handleReset} onBack={handleBack} />,
  ]

  const team = result.team
  const teamStyle = team
    ? { '--team-color': team.color, '--team-color2': team.color2 }
    : undefined

  return (
    <div className="simp-page" style={teamStyle}>
      <div className="simp-col">
        <div className="simp-top-bar">
          {screen > 0 && screen < screens.length - 1 && (
            <button className="simp-back-btn" onClick={() => setScreen(s => s - 1)}>← Back</button>
          )}
          <ProgressDots screen={screen} total={screens.length} />
        </div>

        {team && (
          <div className="simp-team-strip">
            <img src={team.logo} alt={team.short} className="sts-logo" />
            <div className="sts-info">
              <span className="sts-name">{team.name}</span>
              <span className="sts-abbr">{team.short}</span>
            </div>
            {(team.off != null || team.def != null) && (
              <div className="sts-grades">
                {team.off != null && (
                  <div className="sts-grade-item">
                    <span className="sts-grade-key">OFF</span>
                    <div className="sts-grade-track">
                      <div className="sts-grade-fill" style={{ width: `${team.off * 10}%` }} />
                    </div>
                    <span className="sts-grade-badge">{offDefGrade(team.off)}</span>
                  </div>
                )}
                {team.def != null && (
                  <div className="sts-grade-item">
                    <span className="sts-grade-key">DEF</span>
                    <div className="sts-grade-track">
                      <div className="sts-grade-fill" style={{ width: `${team.def * 10}%` }} />
                    </div>
                    <span className="sts-grade-badge">{offDefGrade(team.def)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {screens[screen]}
      </div>
    </div>
  )
}
