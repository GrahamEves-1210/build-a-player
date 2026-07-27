import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { NBA_TEAMS, NBA_PLAYERS, BUCKET_ATTR } from '../data/nba-players'
import NBA_HEADSHOTS from '../data/nba-headshots.json'
import { valToGrade } from '../utils/simulation'
import { getBucketGuardArchetype, getBucketBigArchetype, TEAM_RATINGS, ALLTIME_TEAM_RATINGS } from '../utils/bucketSimulation'
import { SAL_REP_TYPES, SAL_ATTR_MAP } from './BucketSalaryCap'
import QBAvatar from './QBAvatar'
import BucketFigureOverlay from './BucketFigureOverlay'
import { ShareModal } from './ReportCard'

function gradeColor(val) {
  if (val >= 11) return '#a855f7'
  if (val >= 8)  return '#3b82f6'
  if (val >= 5)  return '#22c55e'
  if (val >= 2)  return '#eab308'
  if (val >= 1)  return '#f97316'
  return '#ef4444'
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const TEAM_MAP = Object.fromEntries(NBA_TEAMS.map(t => [t.short, t]))

const GOAT_75 = [
  { rank: 75, name: 'Dave DeBusschere',        team: 'NYK', rings: 2 },
  { rank: 74, name: 'Tracy McGrady',           team: 'ORL', rings: 0 },
  { rank: 73, name: 'Damian Lillard',          team: 'POR', rings: 0 },
  { rank: 72, name: 'Anthony Davis',           team: 'LAL', rings: 1 },
  { rank: 71, name: 'Dolph Schayes',           team: 'PHI', rings: 1 },
  { rank: 70, name: 'Carmelo Anthony',         team: 'DEN', rings: 0 },
  { rank: 69, name: 'Russell Westbrook',       team: 'OKC', rings: 0 },
  { rank: 68, name: 'Dennis Rodman',           team: 'CHI', rings: 5 },
  { rank: 67, name: 'Paul Arizin',             team: 'GSW', rings: 1 },
  { rank: 66, name: 'Lenny Wilkens',           team: 'OKC', rings: 0 },
  { rank: 65, name: 'Hal Greer',               team: 'PHI', rings: 1 },
  { rank: 64, name: 'Robert Parish',           team: 'BOS', rings: 4 },
  { rank: 63, name: 'Paul Pierce',             team: 'BOS', rings: 1 },
  { rank: 62, name: 'Shai Gilgeous-Alexander', team: 'OKC', rings: 0 },
  { rank: 61, name: 'Sam Jones',               team: 'BOS', rings: 10 },
  { rank: 60, name: 'Nate Archibald',          team: 'BOS', rings: 1 },
  { rank: 59, name: 'Elvin Hayes',             team: 'WAS', rings: 1 },
  { rank: 58, name: 'Willis Reed',             team: 'NYK', rings: 2 },
  { rank: 57, name: 'James Worthy',            team: 'LAL', rings: 3 },
  { rank: 56, name: 'Earl Monroe',             team: 'NYK', rings: 1 },
  { rank: 55, name: 'Pete Maravich',           team: 'NOP', rings: 0 },
  { rank: 54, name: 'Clyde Drexler',           team: 'POR', rings: 1 },
  { rank: 53, name: 'George Gervin',           team: 'SAS', rings: 0 },
  { rank: 52, name: 'Reggie Miller',           team: 'IND', rings: 0 },
  { rank: 51, name: 'James Harden',            team: 'HOU', rings: 0 },
  { rank: 50, name: 'Nate Thurmond',           team: 'GSW', rings: 0 },
  { rank: 49, name: 'Wes Unseld',              team: 'WAS', rings: 1 },
  { rank: 48, name: 'Ray Allen',               team: 'BOS', rings: 2 },
  { rank: 47, name: 'Jerry Lucas',             team: 'NYK', rings: 1 },
  { rank: 46, name: 'Bob McAdoo',              team: 'LAL', rings: 2 },
  { rank: 45, name: 'Bill Walton',             team: 'POR', rings: 2 },
  { rank: 44, name: 'Jason Kidd',              team: 'DAL', rings: 1 },
  { rank: 43, name: 'Gary Payton',             team: 'OKC', rings: 1 },
  { rank: 42, name: 'Walt Frazier',            team: 'NYK', rings: 2 },
  { rank: 41, name: 'Patrick Ewing',           team: 'NYK', rings: 0 },
  { rank: 40, name: 'Kevin McHale',            team: 'BOS', rings: 3 },
  { rank: 39, name: 'Rick Barry',              team: 'GSW', rings: 1 },
  { rank: 38, name: 'Steve Nash',              team: 'PHX', rings: 0 },
  { rank: 37, name: 'Dominique Wilkins',       team: 'ATL', rings: 0 },
  { rank: 36, name: 'Bob Pettit',              team: 'ATL', rings: 1 },
  { rank: 35, name: 'Bob Cousy',               team: 'BOS', rings: 6 },
  { rank: 34, name: 'Kawhi Leonard',           team: 'SAS', rings: 2 },
  { rank: 33, name: 'Scottie Pippen',          team: 'CHI', rings: 6 },
  { rank: 32, name: 'Allen Iverson',           team: 'PHI', rings: 0 },
  { rank: 31, name: 'Dwyane Wade',             team: 'MIA', rings: 3 },
  { rank: 30, name: 'Chris Paul',              team: 'PHX', rings: 0 },
  { rank: 29, name: 'George Mikan',            team: 'LAL', rings: 5 },
  { rank: 28, name: 'Isiah Thomas',            team: 'DET', rings: 2 },
  { rank: 27, name: 'John Havlicek',           team: 'BOS', rings: 8 },
  { rank: 26, name: 'David Robinson',          team: 'SAS', rings: 2 },
  { rank: 25, name: 'John Stockton',           team: 'UTA', rings: 0 },
  { rank: 24, name: 'Karl Malone',             team: 'UTA', rings: 0 },
  { rank: 23, name: 'Charles Barkley',         team: 'PHX', rings: 0 },
  { rank: 22, name: 'Kevin Garnett',           team: 'MIN', rings: 1 },
  { rank: 21, name: 'Elgin Baylor',            team: 'LAL', rings: 0 },
  { rank: 20, name: 'Jerry West',              team: 'LAL', rings: 1 },
  { rank: 19, name: 'Giannis Antetokounmpo',  team: 'MIL', rings: 1 },
  { rank: 18, name: 'Dirk Nowitzki',           team: 'DAL', rings: 1 },
  { rank: 17, name: 'Moses Malone',            team: 'PHI', rings: 1 },
  { rank: 16, name: 'Kevin Durant',            team: 'OKC', rings: 2 },
  { rank: 15, name: 'Julius Erving',           team: 'PHI', rings: 1 },
  { rank: 14, name: 'Nikola Jokic',            team: 'DEN', rings: 1 },
  { rank: 13, name: 'Wilt Chamberlain',        team: 'PHI', rings: 2 },
  { rank: 12, name: 'Oscar Robertson',         team: 'MIL', rings: 1 },
  { rank: 11, name: 'Bill Russell',            team: 'BOS', rings: 11 },
  { rank: 10, name: "Shaquille O'Neal",        team: 'LAL', rings: 4 },
  { rank:  9, name: 'Hakeem Olajuwon',         team: 'HOU', rings: 2 },
  { rank:  8, name: 'Stephen Curry',           team: 'GSW', rings: 4 },
  { rank:  7, name: 'Larry Bird',              team: 'BOS', rings: 3 },
  { rank:  6, name: 'Tim Duncan',              team: 'SAS', rings: 5 },
  { rank:  5, name: 'Kobe Bryant',             team: 'LAL', rings: 5 },
  { rank:  4, name: 'Magic Johnson',           team: 'LAL', rings: 5 },
  { rank:  3, name: 'Kareem Abdul-Jabbar',     team: 'LAL', rings: 6 },
  { rank:  2, name: 'Michael Jordan',          team: 'CHI', rings: 6 },
  { rank:  1, name: 'LeBron James',            team: 'CLE', rings: 4 },
]
const GOAT_MAP = Object.fromEntries(GOAT_75.map(g => [g.rank, g]))

// Visual-only ratings — display grades only, sim uses TEAM_RATINGS from bucketSimulation.js
const TEAM_VISUAL_RATINGS = {
  // EAST — 2025-26 season / 2026 outlook
  BOS: { off: 80, def: 78 }, // Still elite core, slight aging but championship-caliber
  CLE: { off: 76, def: 88 }, // Best defense in league, Mobley/Garland/Mitchell locked in
  NYK: { off: 83, def: 76 }, // Brunson-led contender, Finals experience
  DET: { off: 78, def: 74 }, // Cade Cunningham emerging as star, legit playoff team
  ORL: { off: 73, def: 80 }, // Franz/Banchero maturing, elite scheme defense
  IND: { off: 77, def: 62 }, // Haliburton system — top-5 offense, bottom-5 defense
  MIL: { off: 66, def: 64 }, // Post-Giannis rebuild, major regression
  PHI: { off: 77, def: 73 }, // Embiid availability drives everything
  ATL: { off: 75, def: 66 }, // Jalen Johnson-led offense, no defensive identity
  MIA: { off: 80, def: 78 }, // Giannis + Spoelstra system — legitimate East contender
  CHI: { off: 68, def: 66 }, // Middle-of-road, no clear direction
  TOR: { off: 68, def: 68 }, // Young core, patience mode
  CHA: { off: 66, def: 64 }, // Lottery team, LaMelo health a concern
  WAS: { off: 60, def: 58 }, // Full tear-down, asset accumulation
  BKN: { off: 58, def: 57 }, // Tank mode, no recognizable roster
  // WEST — 2025-26 season / 2026 outlook
  OKC: { off: 86, def: 86 }, // SGA + Chet + Jalen Williams — best team in NBA
  SAS: { off: 82, def: 85 }, // Wembanyama year 3 + De'Aaron Fox — legitimate Finals threat
  DEN: { off: 85, def: 72 }, // Jokic historically elite offense, defense remains liability
  LAL: { off: 82, def: 70 }, // Luka + AD — massive offense ceiling, defensive questions
  MIN: { off: 76, def: 84 }, // Anthony Edwards ascending, Gobert anchors elite defense
  HOU: { off: 80, def: 76 }, // Sengun/Amen Thompson — best young duo in West
  PHX: { off: 78, def: 68 }, // Durant/Booker still dangerous, no defensive buy-in
  MEM: { off: 70, def: 68 }, // Ja Morant healthy = good offense, leaky D
  GSW: { off: 75, def: 66 }, // Curry still dangerous, window closing fast
  DAL: { off: 70, def: 68 }, // Post-Luka rebuild, young pieces finding identity
  LAC: { off: 72, def: 70 }, // Competent but ceiling-less, treadmill team
  SAC: { off: 68, def: 62 }, // Post-Fox era, offensive identity lost
  POR: { off: 71, def: 70 }, // Scoot Henderson developing, improved defensive core
  NOP: { off: 63, def: 62 }, // Full reset mode
  UTA: { off: 60, def: 60 }, // Full tank, stockpiling picks
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function offDefMeterPct(val) {
  return Math.min(100, Math.max(0, Math.round((val - 54) / (82 - 54) * 100)))
}
function offDefGrade(val) {
  if (val >= 84) return 'A+'
  if (val >= 80) return 'A'
  if (val >= 76) return 'A-'
  if (val >= 72) return 'B+'
  if (val >= 68) return 'B'
  if (val >= 64) return 'B-'
  if (val >= 60) return 'C+'
  if (val >= 56) return 'C'
  if (val >= 52) return 'C-'
  return 'D'
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

function nbaScore(won) {
  const loserBase = 94 + Math.floor(Math.random() * 22)
  const margin    = 3  + Math.floor(Math.random() * 17)
  return won
    ? { myScore: loserBase + margin, oppScore: loserBase }
    : { myScore: loserBase, oppScore: loserBase + margin }
}

// ─── buildNBATimeline ──────────────────────────────────────────────────────────
function buildNBATimeline(myFinal, oppFinal) {
  const GAME_SECS = 2880
  const toPlays = total => {
    const plays = []
    let rem = total
    while (rem > 0) {
      if (rem >= 3 && Math.random() < 0.28) { plays.push(3); rem -= 3 }
      else if (rem >= 2) { plays.push(2); rem -= 2 }
      else { plays.push(1); rem -= 1 }
    }
    return plays
  }
  const myPlays = toPlays(myFinal)
  const oppPlays = toPlays(oppFinal)
  const all = [
    ...myPlays.map(pts => ({ team: 'me', pts })),
    ...oppPlays.map(pts => ({ team: 'opp', pts })),
  ]
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  const spacing = GAME_SECS / Math.max(1, all.length)
  return all.map((evt, i) => ({
    ...evt,
    gameSec: Math.round(spacing * i + Math.random() * spacing * 0.7 + 10),
  })).sort((a, b) => a.gameSec - b.gameSec)
}

// ─── SlotReel ──────────────────────────────────────────────────────────────────
const ITEM_H       = 44
const CENTER       = 2
const IDLE_MS_REEL = 1200

function SlotReel({ label, items, spinning, idle, locked, getDisplay, getSub, onStop }) {
  const COPIES = useMemo(() => {
    const loopH  = items.length * ITEM_H
    const needed = Math.ceil(14000 / Math.max(loopH, 1))
    return Math.max(3, Math.min(needed, Math.ceil(99 / Math.max(items.length, 1))))
  }, [items])
  const allItems   = useMemo(() => Array.from({ length: COPIES }, () => items).flat(), [items, COPIES])
  const initOffset = useMemo(() => Math.floor(COPIES / 2) * items.length * ITEM_H + CENTER * ITEM_H, [COPIES, items])
  const posRef     = useRef(initOffset)
  const trackRef   = useRef(null)
  const rafRef     = useRef(null)
  const stopRef    = useRef(null)
  const onStopRef  = useRef(onStop)
  onStopRef.current = onStop

  useLayoutEffect(() => {
    if (trackRef.current)
      trackRef.current.style.transform = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`
  })

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    clearTimeout(stopRef.current)
    const loopH = items.length * ITEM_H
    const wrap  = () => { if (posRef.current >= initOffset + loopH) posRef.current -= loopH }

    if (spinning) {
      const duration  = 1600 + Math.random() * 600
      const startTime = performance.now()
      const MAX_VEL   = (ITEM_H / 36) * (0.93 + Math.random() * 0.10)
      let lastFrame   = startTime
      if (trackRef.current) trackRef.current.style.transition = 'none'
      const frame = (now) => {
        const elapsed = now - startTime
        const t       = Math.min(elapsed / duration, 1.0)
        const KICK    = 0.45
        const t2      = t < KICK ? 0 : (t - KICK) / (1 - KICK)
        const eased   = t2 * t2 * (3 - 2 * t2)
        const vel     = MAX_VEL * (1 - eased)
        const dt      = Math.min(now - lastFrame, 50)
        lastFrame = now
        posRef.current += vel * dt
        wrap()
        if (trackRef.current)
          trackRef.current.style.transform = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`
        if (t >= 1.0) {
          const snapped = Math.round(posRef.current / ITEM_H) * ITEM_H
          posRef.current = snapped
          if (trackRef.current) {
            trackRef.current.style.transition = 'transform 140ms cubic-bezier(0.25,0.46,0.45,0.94)'
            trackRef.current.style.transform = `translate3d(0,${-(snapped - CENTER * ITEM_H)}px,0)`
          }
          stopRef.current = setTimeout(() => {
            if (trackRef.current) trackRef.current.style.transition = 'none'
            const idx    = Math.round(snapped / ITEM_H)
            const winner = items[((idx % items.length) + items.length) % items.length]
            onStopRef.current?.(winner)
          }, 150)
        } else {
          rafRef.current = requestAnimationFrame(frame)
        }
      }
      rafRef.current = requestAnimationFrame(frame)
    } else if (idle) {
      const VEL     = ITEM_H / IDLE_MS_REEL
      let lastFrame = performance.now()
      if (trackRef.current) trackRef.current.style.transition = 'none'
      const frame = (now) => {
        const dt = Math.min(now - lastFrame, 50)
        lastFrame = now
        posRef.current += VEL * dt
        wrap()
        if (trackRef.current)
          trackRef.current.style.transform = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`
        rafRef.current = requestAnimationFrame(frame)
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(stopRef.current) }
  }, [spinning, idle, items, initOffset])

  return (
    <div className={`reel-outer${locked ? ' reel-locked' : ''}`}>
      <div className="reel-label">{label}</div>
      <div className="reel-window">
        <div className="reel-selector" />
        <div ref={trackRef} className="reel-track" style={{ willChange: 'transform' }}>
          {allItems.map((item, i) => (
            <div key={i} className="reel-row" style={{ height: ITEM_H }}>
              <div className="reel-primary">{getDisplay(item)}</div>
              {getSub && <div className="reel-secondary">{getSub(item)}</div>}
            </div>
          ))}
        </div>
      </div>
      {locked && <div className="reel-locked-pip" />}
    </div>
  )
}

// ─── Live NBA Playoff Game ─────────────────────────────────────────────────────
const NBA_GAME_SECS  = 2880
// Home court by game: true = higher seed (lower number) is home
const NBA_HOME_PATTERN = [true, true, false, false, true, false, true]

function NBAPlayoffGame({ gameNum, seriesName, oppShort, myColor, myShort, myFinal, oppFinal, won, isHome = false, speedMult = 1, paused = false, mySeed = null, oppSeed = null, onDone }) {
  const TOTAL_TICK = 50  // constant: GAME_MS/TICK_MS = (2500*sm)/(50*sm) = 50

  const [phase,    setPhase]    = useState('pre')
  const [gameSec,  setGameSec]  = useState(0)
  const [myScore,  setMyScore]  = useState(0)
  const [oppScore, setOppScore] = useState(0)
  const [visEvt,   setVisEvt]   = useState(null)
  const [evtKey,   setEvtKey]   = useState(0)
  const [noAnim,   setNoAnim]   = useState(false)
  const [events]               = useState(() => buildNBATimeline(myFinal, oppFinal))
  const tickRef       = useRef(0)
  const evtIdxRef     = useRef(0)
  const myScoreRef    = useRef(0)
  const oppScoreRef   = useRef(0)
  const ivRef         = useRef(null)
  const doneRef       = useRef(false)
  const phaseRef      = useRef('pre')
  const speedMultRef  = useRef(speedMult)
  const tickFnRef     = useRef(null)

  const pausedRef = useRef(paused)

  // Keep speed/pause refs current and restart interval mid-game if speed or pause changes
  useEffect(() => {
    speedMultRef.current = speedMult
    pausedRef.current = paused
    if (phaseRef.current === 'live' && tickFnRef.current) {
      clearInterval(ivRef.current)
      if (!paused) {
        ivRef.current = setInterval(tickFnRef.current, 50 * speedMult)
      }
    }
  }, [speedMult, paused])

  useEffect(() => {
    const tick = () => {
      tickRef.current++
      const t  = tickRef.current
      const gs = Math.min(NBA_GAME_SECS - 1, Math.round((t / TOTAL_TICK) * NBA_GAME_SECS))
      setGameSec(gs)
      while (evtIdxRef.current < events.length && events[evtIdxRef.current].gameSec <= gs) {
        const e = events[evtIdxRef.current]
        if (e.team === 'me') { myScoreRef.current += e.pts; setMyScore(myScoreRef.current) }
        else { oppScoreRef.current += e.pts; setOppScore(oppScoreRef.current) }
        setVisEvt(e); setEvtKey(k => k + 1)
        evtIdxRef.current++
      }
      if (t >= TOTAL_TICK && !doneRef.current) {
        clearInterval(ivRef.current)
        setNoAnim(true)
        if (myScoreRef.current !== myFinal)   setMyScore(myFinal)
        if (oppScoreRef.current !== oppFinal) setOppScore(oppFinal)
        setGameSec(NBA_GAME_SECS - 1)
        phaseRef.current = 'post'
        setPhase('post')
        doneRef.current = true
        setTimeout(onDone, 1260)
      }
    }
    tickFnRef.current = tick

    const pre = setTimeout(() => {
      phaseRef.current = 'live'
      setPhase('live')
      if (!pausedRef.current) {
        ivRef.current = setInterval(tick, 50 * speedMultRef.current)
      }
    }, 600)
    return () => { clearTimeout(pre); clearInterval(ivRef.current) }
  }, [])

  const q        = Math.min(3, Math.floor(gameSec / 720))
  const qSec     = 720 - (gameSec % 720)
  const progress = gameSec / (NBA_GAME_SECS - 1)
  const evtLabel = pts => pts >= 3 ? '▲ 3PT' : pts >= 2 ? '▲ 2PT' : '▲ FT'
  const oppColor = TEAM_MAP[oppShort]?.color ?? '#888'
  const postMsg  = won ? '✓ Won' : '✗ Lost'

  return (
    <div className={`plf-game${phase === 'post' ? (won ? ' plf-game-won' : ' plf-game-lost') : ''}`}>
      <div className="plf-round-row">
        <div className="plf-round-lbl">{seriesName} · Game {gameNum}</div>
      </div>
      <div className="plf-scoreboard">
        {/* Away team (left) */}
        <div className="plf-score-side">
          <img
            src={`/logos/nba/${isHome ? oppShort : myShort}.png`}
            alt={isHome ? oppShort : myShort}
            className="plf-team-logo-img"
          />
          <div className="plf-team-abbr" style={{ color: isHome ? oppColor : myColor }}>
            {isHome ? oppShort : myShort}
          </div>
          {(isHome ? oppSeed : mySeed) && (
            <div className="plf-team-seed">#{isHome ? oppSeed : mySeed}</div>
          )}
          <div className="plf-score-num" style={{ color: isHome ? oppColor : myColor }}>
            <span key={noAnim ? 'l-f' : (isHome ? oppScore : myScore)} className={noAnim ? '' : 'plf-num-pop'}>
              {isHome ? oppScore : myScore}
            </span>
          </div>
        </div>

        <div className="plf-score-mid">
          <span className="plf-at-sym">@</span>
          {phase === 'live' ? (
            <div className="plf-live-pill"><span className="plf-live-dot" />LIVE</div>
          ) : phase === 'post' ? (
            <div className={`plf-result-badge ${won ? 'plf-rb-win' : 'plf-rb-loss'}`}>{won ? 'W' : 'L'}</div>
          ) : null}
        </div>

        {/* Home team (right) */}
        <div className="plf-score-side plf-score-opp">
          <img
            src={`/logos/nba/${isHome ? myShort : oppShort}.png`}
            alt={isHome ? myShort : oppShort}
            className="plf-team-logo-img"
          />
          <div className="plf-team-abbr" style={{ color: isHome ? myColor : oppColor }}>
            {isHome ? myShort : oppShort}
          </div>
          {(isHome ? mySeed : oppSeed) && (
            <div className="plf-team-seed">#{isHome ? mySeed : oppSeed}</div>
          )}
          <div className="plf-score-num" style={{ color: isHome ? myColor : oppColor }}>
            <span key={noAnim ? 'r-f' : (isHome ? myScore : oppScore)} className={noAnim ? '' : 'plf-num-pop'}>
              {isHome ? myScore : oppScore}
            </span>
          </div>
        </div>
      </div>

      <div className="plf-live-area" style={{ visibility: phase === 'live' ? 'visible' : 'hidden' }}>
        <div className="plf-status-row">
          <div className="plf-qtr-dots">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`plf-qtr-dot${i < q ? ' plf-qd-done' : i === q ? ' plf-qd-active' : ''}`}
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
          <div className="plf-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className={`plf-post-line ${won ? 'plf-pl-won' : 'plf-pl-lost'}`}
           style={{ visibility: phase === 'post' ? 'visible' : 'hidden' }}>
        <span>{postMsg}</span>
        <span className="plf-post-score">{myFinal} – {oppFinal}</span>
      </div>
    </div>
  )
}

// ─── ScreenTeamSpin ────────────────────────────────────────────────────────────
export function TeamSpinModal({ isCustomMode, onTeamSelected, build = {} }) {
  const [phase,      setPhase]      = useState('idle')
  const [result,     setResult]     = useState(null)
  const [spinCount,  setSpinCount]  = useState(0)
  const [mode,       setMode]       = useState(isCustomMode ? 'pick' : 'spin')
  const [search,     setSearch]     = useState('')

  const pickPool = useMemo(() => {
    const shorts = [...new Set(Object.values(build).filter(Boolean).map(v => v.team).filter(Boolean))]
    const TEAM_MAP = Object.fromEntries(NBA_TEAMS.map(t => [t.short, t]))
    const filtered = shorts.map(s => TEAM_MAP[s]).filter(Boolean)
    return filtered.length > 0 ? filtered : NBA_TEAMS
  }, [build])

  const items = useMemo(() => [...NBA_TEAMS].sort(() => Math.random() - 0.5), [spinCount])

  const handleSpin = () => {
    if (phase === 'spinning' || phase === 'done') return
    setResult(null)
    setSpinCount(c => c + 1)
    setPhase('spinning')
  }

  const handleStop = useCallback((team) => {
    setResult(team)
    setPhase('done')
    setTimeout(() => onTeamSelected(team), 400)
  }, [onTeamSelected])

  const handlePickTeam = (team) => {
    setResult(team)
    setTimeout(() => onTeamSelected(team), 800)
  }

  const filteredTeams = useMemo(() => {
    if (!search) return pickPool
    const s = search.toLowerCase()
    return pickPool.filter(t =>
      t.name.toLowerCase().includes(s) || t.short.toLowerCase().includes(s)
    )
  }, [search, pickPool])

  const cardStyle = result
    ? { '--tpm-color': result.color, borderColor: result.color + '55', boxShadow: `0 0 32px ${result.color}22, 0 32px 80px rgba(0,0,0,0.55)` }
    : undefined

  return (
    <div className="tpm-overlay">
      <div className={`tpm-card${mode === 'pick' ? ' tpm-card-pick' : ''}`} style={cardStyle}>
        <div className="tpm-eyebrow">Simulate Season</div>
        <div className="tpm-heading">{mode === 'pick' ? 'Pick Your Team' : 'Spin Your Team'}</div>

        <div className="tpm-mode-tabs">
          <button
            className={`tpm-tab${mode === 'spin' ? ' tpm-tab-active' : ''}`}
            onClick={() => { setMode('spin'); setResult(null); setSearch(''); setPhase('idle') }}
          >Spin</button>
          <button
            className={`tpm-tab${mode === 'pick' ? ' tpm-tab-active' : ''}`}
            onClick={() => { setMode('pick'); setResult(null); setPhase('idle') }}
          >Pick</button>
        </div>

        {mode === 'spin' ? (
          <>
            <div className="reels-wrap tpm-reels">
              <div className="reel-tri reel-tri-l" />
              <div className="reels-row">
                <SlotReel
                  label="TEAM"
                  items={items}
                  spinning={phase === 'spinning'}
                  idle={phase === 'idle'}
                  locked={phase === 'done'}
                  getDisplay={t => t.short}
                  getSub={t => t.name.split(' ').slice(-1)[0]}
                  onStop={handleStop}
                />
              </div>
              <div className="reel-tri reel-tri-r" />
            </div>

            <button
              className="spin-btn"
              onClick={handleSpin}
              disabled={phase === 'spinning' || phase === 'done'}
            >
              SPIN
            </button>
          </>
        ) : (
          <div className="tpm-pick-wrap">
            {result ? (
              <div className="tpm-result" style={{ '--tpm-color': result.color }}>
                <div className="tpm-result-bg" />
                <img src={`/logos/nba/${result.short}.png`} alt={result.name} className="tpm-result-logo" />
                <div className="tpm-result-name">{result.name}</div>
                <div className="tpm-result-abbr">{result.short}</div>
              </div>
            ) : (
              <>
                <div className="tpm-subheading">Available for your build</div>
                <input
                  className="tpm-pick-search"
                  placeholder="Search teams…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoComplete="off"
                />
                <div className="tpm-team-grid">
                  {filteredTeams.map(team => (
                    <button
                      key={team.short}
                      className="tpm-team-btn"
                      style={{ '--t-color': team.color }}
                      onClick={() => handlePickTeam(team)}
                    >
                      <img src={`/logos/nba/${team.short}.png`} alt={team.short} className="tpm-team-logo" />
                      <span className="tpm-team-abbr">{team.short}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared bucket figure constants ────────────────────────────────────────────
const BUCKET_FIG_W       = 936
const BUCKET_FIG_H       = 897
const BUCKET_FIGURE_SCALE = 1.10
const BUCKET_HEAD        = { ax: 468, ay: 74, r: 54 }
const BUCKET_COLLAR_AY   = 140

// Reusable player model — exact same headshot math as ScreenBuild/ScreenFinal
export function BucketModelFigure({ build, team, className = '', style = {}, headYOffset = 0, photoKey = 'basketballIQ' }) {
  const modelRef   = useRef(null)
  const [modelW, setModelW] = useState(0)
  const [hsImgRatio, setHsImgRatio] = useState(1.333)

  const monoTeamBuild = team
    ? Object.fromEntries(Object.entries(build).map(([k, v]) => [k, v ? { ...v, teamColor: team.color, teamColor2: team.color2, team: team.short } : v]))
    : build

  const bucketPhoto = build[photoKey]?.photo || null

  useLayoutEffect(() => {
    if (!modelRef.current) return
    const compute = () => setModelW(modelRef.current?.offsetWidth ?? 0)
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(modelRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!bucketPhoto) { setHsImgRatio(1.333); return }
    const img = new Image()
    img.onload = () => setHsImgRatio(img.naturalHeight / img.naturalWidth)
    img.src = bucketPhoto
  }, [bucketPhoto])

  const scale     = modelW / BUCKET_FIG_W
  const hx        = 50
  const collarY   = 50 + (BUCKET_COLLAR_AY / BUCKET_FIG_H * 100 - 50) * BUCKET_FIGURE_SCALE
  const hpx       = BUCKET_HEAD.r * 2 * scale * 1.805 * BUCKET_FIGURE_SCALE * 1.05
  const fc        = build['basketballIQ']?.faceCenter
  const R         = hsImgRatio
  const objPosY   = fc && Math.abs(R - 1) > 0.05
    ? Math.max(0, Math.min(100, 100 * (0.58 - (fc[1] / 100) * R) / (1 - R)))
    : (fc ? fc[1] : 50)
  const faceScale = fc ? Math.max(0.93, Math.min(1.12, 1 + (42 - fc[1]) * 0.014)) : 1

  return (
    <div ref={modelRef} className={`simp-team-model simp-team-model--bucket ${className}`} style={style}>
      {team && <div className="simp-team-model-glow" style={{ background: `radial-gradient(circle, ${team.color}66 0%, ${team.color}22 50%, transparent 80%)` }} />}
      <img
        src="/basketballsilhouetteheadless.png"
        alt="" className="simp-sil-ghost" draggable={false}
        style={{ transform: 'scale(1.10)', transformOrigin: 'center center', zIndex: 4 }}
      />
      <BucketFigureOverlay build={monoTeamBuild} />
      {bucketPhoto && modelW > 0 && (() => {
        const isGeneric = bucketPhoto === '/genericdark.webp' || bucketPhoto === '/genericlight.webp'
        const isGenericLight = bucketPhoto === '/genericlight.webp'
        const genericYAdj = isGenericLight ? 2.5 : isGeneric ? 4.5 : 0
        return (
        <div style={{
          position: 'absolute',
          left: `${hx}%`, top: `${collarY}%`,
          width: `${hpx}px`, height: `${hpx}px`,
          transform: `translate(calc(-50% + ${0.75 + (isGeneric ? 0.75 : 0)}px), calc(-89% + ${4 + headYOffset + genericYAdj}px))`,
          overflow: 'hidden', borderRadius: '50%', pointerEvents: 'none', zIndex: 1,
          WebkitMaskImage: 'radial-gradient(ellipse 82% 78% at 50% 45%, black 52%, transparent 84%)',
          maskImage: 'radial-gradient(ellipse 82% 78% at 50% 45%, black 52%, transparent 84%)',
        }}>
          <img src={bucketPhoto} alt="" draggable={false}
            onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: `50% ${objPosY}%`,
              transform: `scale(${isGenericLight ? faceScale * 1.05 : faceScale})`, transformOrigin: `50% ${objPosY}%`,
              filter: 'saturate(0.75) contrast(1.05)',
            }}
          />
        </div>
        )
      })()}
    </div>
  )
}

// ─── Screen 0: Build Overview ─────────────────────────────────────────────────

function ScreenBuild({ result, build, types, attrMap, onNext, adsDisabled = false, isSalaryMode = false }) {
  const { ovr, position, team } = result
  const archetype  = position === 'big'
    ? getBucketBigArchetype(ovr, build, types)
    : getBucketGuardArchetype(ovr, build, types)
  const ovrDisplay = useCountUp(ovr, 900)
  const [rowsVisible, setRowsVisible] = useState(0)
  const filled = types.filter(t => build[t])

  useEffect(() => {
    let i = 0
    const tick = () => {
      if (i >= filled.length) return
      i++; setRowsVisible(i)
      setTimeout(tick, 80)
    }
    const t = setTimeout(tick, 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="simp-screen">
      <div className="simp-ovr-hero">
        <div className="simp-ovr-num">{filled.length === 0 ? '–' : (ovrDisplay || '–')}</div>
        <div className="simp-ovr-lbl">OVR</div>
      </div>
      <div className="simp-archetype">{archetype}</div>
      <button className="simp-cta" onClick={onNext}>Simulate Season</button>
      {team && <BucketModelFigure build={build} team={team} photoKey={isSalaryMode ? 'size' : 'basketballIQ'} />}

      <div className="simp-attr-table">
        {filled.map((t, i) => {
          const meta = attrMap[t] ?? { label: t, hex: '#888' }
          const data = build[t]
          const displayVal = t === 'size' ? Math.min(11, data.val + 1) : data.val
          return (
            <div key={t} className={`simp-attr-row${i < rowsVisible ? ' simp-row-visible' : ''}`}>
              <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={46} logoDir="/logos/nba/" faceCenter={data.faceCenter} />
              <div className="simp-attr-info">
                <span className="simp-attr-name">{meta.label}</span>
                <span className="simp-attr-qb">{data.qbFull}</span>
              </div>
              <span className="simp-grade-circle" style={{ background: gradeColor(displayVal), color: '#07120a' }}>
                {valToGrade(displayVal)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Season Stat Components ───────────────────────────────────────────────────
function StatCard({ ppg, rpg, apg, spg, bpg, tov, fgPct, threePct, ftPct, per }) {
  return (
    <div className="sstat-card">
      <div className="sstat-section-hdr">PER GAME</div>
      <div className="sstat-tile-row">
        <div className="sstat-tile sstat-tile--primary">
          <span className="sstat-tile-val">{ppg ?? '—'}</span>
          <span className="sstat-tile-lbl">PPG</span>
        </div>
        <div className="sstat-tile sstat-tile--primary">
          <span className="sstat-tile-val">{rpg ?? '—'}</span>
          <span className="sstat-tile-lbl">RPG</span>
        </div>
        <div className="sstat-tile sstat-tile--primary">
          <span className="sstat-tile-val">{apg ?? '—'}</span>
          <span className="sstat-tile-lbl">APG</span>
        </div>
      </div>

      <div className="sstat-divider-line" />
      <div className="sstat-section-hdr">DEFENSE / BALL CONTROL</div>
      <div className="sstat-tile-row">
        <div className="sstat-tile">
          <span className="sstat-tile-val">{spg ?? '—'}</span>
          <span className="sstat-tile-lbl">SPG</span>
        </div>
        <div className="sstat-tile">
          <span className="sstat-tile-val">{bpg ?? '—'}</span>
          <span className="sstat-tile-lbl">BPG</span>
        </div>
        <div className="sstat-tile sstat-tile--neg">
          <span className="sstat-tile-val">{tov ?? '—'}</span>
          <span className="sstat-tile-lbl">TOV</span>
        </div>
      </div>

      <div className="sstat-divider-line" />
      <div className="sstat-section-hdr">SHOOTING</div>
      <div className="sstat-tile-row">
        <div className="sstat-tile">
          <span className="sstat-tile-val">{fgPct != null ? `${fgPct}%` : '—'}</span>
          <span className="sstat-tile-lbl">FG%</span>
        </div>
        <div className="sstat-tile">
          <span className="sstat-tile-val">{threePct != null ? `${threePct}%` : '—'}</span>
          <span className="sstat-tile-lbl">3P%</span>
        </div>
        <div className="sstat-tile">
          <span className="sstat-tile-val">{ftPct != null ? `${ftPct}%` : '—'}</span>
          <span className="sstat-tile-lbl">FT%</span>
        </div>
      </div>

      <div className="sstat-divider-line" />
      <div className="sstat-per-banner">
        <span className="sstat-per-lbl">PLAYER EFFICIENCY RATING</span>
        <span className="sstat-per-val">{per ?? '—'}</span>
      </div>
    </div>
  )
}

// ─── Screen 1: Regular Season ─────────────────────────────────────────────────
const CONF_LABEL = { east: 'Eastern', west: 'Western' }

function ConferenceStandings({ standings, myShort, teamColor, conf }) {
  if (!standings?.length) return null
  const topWins = standings[0].wins
  return (
    <div className="bsim-standings">
      <div className="bsim-std-header">
        <span>{CONF_LABEL[conf] ?? ''} Conference Standings</span>
        <span className="bsim-std-col-labels">
          <span className="bsim-std-col-record">W–L</span>
          <span className="bsim-std-col-gb">GB</span>
        </span>
      </div>
      {standings.map((row, i) => {
        const gb = i === 0 ? '-' : ((topWins - row.wins) / 2).toFixed(1).replace('.0', '')
        const isMe = row.short === myShort
        const isPlayoffLine = i === 6
        const isPlayinLine = i === 10
        return (
          <div key={row.short}>
            {isPlayoffLine && <div className="bsim-std-divider"><span>Play-In</span></div>}
            {isPlayinLine  && <div className="bsim-std-divider bsim-std-divider--playin"><span>Out</span></div>}
            <div
              className={`bsim-std-row${isMe ? ' bsim-std-row--me' : ''}`}
              style={isMe ? { background: `${teamColor}22`, borderLeft: `3px solid ${teamColor}` } : {}}
            >
              <span className="bsim-std-rank">{i + 1}</span>
              <img src={`/logos/nba/${row.short}.png`} alt={row.short} className="bsim-std-logo" />
              <span className="bsim-std-abbr">{row.short}</span>
              <span className="bsim-std-record">{row.wins}–{row.losses ?? 82 - row.wins}</span>
              <span className="bsim-std-gb">{gb}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ScreenSeason({ result, awards, onNext, adsDisabled = false, isAllTime = false }) {
  const { games = [], madePlayoffs, seed: rawSeed, playoffRounds = [], conference, ppg, rpg, apg, spg, bpg, tov, fgPct, threePct, ftPct, per, ovr = 0, standings, team } = result
  const playinRound = playoffRounds.find(r => r.type === 'playin' && r.advanced)
  const seed = playinRound?.newSeed ?? rawSeed
  const [phase,       setPhase]       = useState('loading')
  const [revealed,    setRevealed]    = useState(0)
  const [liveWins,    setLiveWins]    = useState(0)
  const [liveLosses,  setLiveLosses]  = useState(0)
  const [awardsPhase, setAwardsPhase] = useState(0)
  const allDone = revealed === games.length

  useEffect(() => {
    if (!allDone || adsDisabled) return
    window.ramp?.que?.push(() => {
      window.ramp.spaAddAds([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-square' }])
    })
  }, [allDone]) // eslint-disable-line

  useEffect(() => {
    if (!allDone) return
  }, [allDone])

  useEffect(() => {
    const loadTimer = setTimeout(() => {
      setPhase('playing')
      let i = 0, w = 0, l = 0
      const revealNext = () => {
        if (i >= games.length) { setPhase('done'); return }
        if (games[i].won) w++; else l++
        setRevealed(i + 1); setLiveWins(w); setLiveLosses(l)
        i++
        setTimeout(revealNext, 45)
      }
      revealNext()
    }, 900)
    return () => clearTimeout(loadTimer)
  }, [])

  // Start awards animation after season dots finish
  useEffect(() => {
    if (!allDone) return
    const base = 900
    const t1 = setTimeout(() => setAwardsPhase(1), base + 1800)
    const t2 = setTimeout(() => setAwardsPhase(2), base + 2150)
    const t3 = setTimeout(() => setAwardsPhase(3), base + 2900)
    const t4 = setTimeout(() => setAwardsPhase(4), base + 3200)
    const t5 = setTimeout(() => setAwardsPhase(5), base + 3800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5) }
  }, [allDone])

  const seedLabel = seed <= 6 ? `#${seed} Seed` : seed <= 8 ? `#${seed} Seed` : rawSeed <= 10 ? `Play-In #${rawSeed}` : 'Missed Playoffs'
  const mvp  = awards?.mvp
  const dpoy = awards?.dpoy

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
          <div className="simp-eyebrow">{isAllTime ? 'All-Time Regular Season' : 'Regular Season'}</div>
          <div className="simp-live-record">
            <span className="slr-w">{liveWins}</span>
            <span className="slr-sep">–</span>
            <span className="slr-l">{liveLosses}</span>
          </div>
          <div className="bsim-season-dots">
            {games.slice(0, revealed).map((g, i) => (
              <span key={i} className={`bsim-sdot bsim-sdot--${g.won ? 'w' : 'l'}`} />
            ))}
          </div>
          {allDone && (
            <ConferenceStandings standings={standings} myShort={team?.short} teamColor={team?.color} conf={conference} />
          )}
          {allDone && !adsDisabled && (
            <div id="ramp-cntr1-square" className="simp-season-ad" />
          )}
          {allDone && (
            <StatCard ppg={ppg} rpg={rpg} apg={apg} spg={spg} bpg={bpg} tov={tov} fgPct={fgPct} threePct={threePct} ftPct={ftPct} per={per} />
          )}

          {allDone && awards && (
            <>
              <div className="sawd-title">Season Awards</div>

              {awardsPhase === 0 && (
                <div className="sawd-tallying">
                  <div className="sawd-tally-dots">
                    <span className="sawd-dot" /><span className="sawd-dot" /><span className="sawd-dot" />
                  </div>
                  <div className="sawd-tally-lbl">Tallying votes…</div>
                </div>
              )}

              {awardsPhase >= 2 && mvp && (
                <div className="sawd-award-card sawd-award-card--mvp">
                  <div className="sawd-award-label">Most Valuable Player</div>
                  <div className="sawd-award-winner">
                    <img src={`/logos/nba/${mvp.team}.png`} alt={mvp.team} className="sawd-winner-logo" />
                    <div className="sawd-winner-info">
                      <div className="sawd-winner-name">{mvp.isPlayer ? 'You' : mvp.name}</div>
                      <div className="sawd-winner-stats">{mvp.ppg} PPG · {mvp.rpg} RPG · {mvp.apg} APG</div>
                    </div>
                  </div>
                </div>
              )}

              {awardsPhase >= 4 && dpoy && (
                <div className="sawd-award-card sawd-award-card--def">
                  <div className="sawd-award-label sawd-award-label--def">Defensive Player of the Year</div>
                  <div className="sawd-award-winner">
                    <img src={`/logos/nba/${dpoy.team}.png`} alt={dpoy.team} className="sawd-winner-logo" />
                    <div className="sawd-winner-info">
                      <div className="sawd-winner-name">{dpoy.isPlayer ? 'You' : dpoy.name}</div>
                      <div className="sawd-winner-stats">{dpoy.spg} SPG · {dpoy.bpg} BPG</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {awardsPhase >= 5 && (
            <button className="simp-cta simp-cta-in" onClick={onNext}>Enter Playoffs</button>
          )}
        </>
      )}
    </div>
  )
}

// ─── Screen 2: Season Awards ─────────────────────────────────────────────────
function ScreenAwards({ awards, onNext }) {
  const [phase, setPhase] = useState(0)
  // 0=tallying  1=mvp-flash  2=mvp-card  3=dpoy-flash  4=dpoy-card  5=continue

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1800)
    const t2 = setTimeout(() => setPhase(2), 2150)
    const t3 = setTimeout(() => setPhase(3), 2900)
    const t4 = setTimeout(() => setPhase(4), 3200)
    const t5 = setTimeout(() => setPhase(5), 3800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5) }
  }, [])

  if (!awards) return null
  const { mvp, dpoy } = awards

  return (
    <div className="simp-screen">

      <div className="sawd-title">Season Awards</div>

      {phase === 0 && (
        <div className="sawd-tallying">
          <div className="sawd-tally-dots">
            <span className="sawd-dot" /><span className="sawd-dot" /><span className="sawd-dot" />
          </div>
          <div className="sawd-tally-lbl">Tallying votes…</div>
        </div>
      )}

      {phase >= 2 && (
        <div className="sawd-award-card sawd-award-card--mvp" key="mvp-card">
          <div className="sawd-award-label">Most Valuable Player</div>
          <div className="sawd-award-winner">
            <img src={`/logos/nba/${mvp.team}.png`} alt={mvp.team} className="sawd-winner-logo" />
            <div className="sawd-winner-info">
              <div className="sawd-winner-name">{mvp.isPlayer ? 'You' : mvp.name}</div>
              <div className="sawd-winner-stats">{mvp.ppg} PPG · {mvp.rpg} RPG · {mvp.apg} APG</div>
            </div>
          </div>
        </div>
      )}

      {phase >= 4 && (
        <div className="sawd-award-card sawd-award-card--def" key="dpoy-card">
          <div className="sawd-award-label sawd-award-label--def">Defensive Player of the Year</div>
          <div className="sawd-award-winner">
            <img src={`/logos/nba/${dpoy.team}.png`} alt={dpoy.team} className="sawd-winner-logo" />
            <div className="sawd-winner-info">
              <div className="sawd-winner-name">{dpoy.isPlayer ? 'You' : dpoy.name}</div>
              <div className="sawd-winner-stats">{dpoy.spg} SPG · {dpoy.bpg} BPG</div>
            </div>
          </div>
        </div>
      )}

      {phase >= 5 && (
        <button className="simp-cta simp-cta-in" onClick={onNext}>Enter Playoffs</button>
      )}
    </div>
  )
}

// ─── Screen 4: GOAT Status ────────────────────────────────────────────────────
function computeGoatRank(result, awards) {
  const { ovr, ppg = 0, rpg = 0, apg = 0, spg = 0, bpg = 0, champion = false } = result
  if (ovr < 92) return null

  const wonMVP  = !!(awards?.mvp?.isPlayer)
  const wonDPOY = !!(awards?.dpoy?.isPlayer)

  // Base rank from OVR — 92→75, 95→46, 97→26, 99→7 (before floors)
  const baseRank = Math.round(75 - ((ovr - 92) / 7) * 68)

  // Stats nudge — capped at 8 positions total
  const statScore =
    Math.max(0, ppg - 24) * 0.5 +
    Math.max(0, rpg - 9)  * 0.4 +
    Math.max(0, apg - 7)  * 0.4 +
    Math.max(0, spg - 1.8) * 0.8 +
    Math.max(0, bpg - 1.8) * 0.8
  const statBoost = Math.min(8, Math.round(statScore * 1.2))

  // Accolades — ring worth less than MVP; #1 still requires 99 OVR + MVP + ring
  const champBoost = champion ? 2 : 0
  const mvpBoost   = wonMVP  ? 4 : 0
  const dpoyBoost  = wonDPOY ? 2 : 0

  let rank = baseRank - statBoost - champBoost - mvpBoost - dpoyBoost

  // Can't crack top 10 without championship
  if (!champion) rank = Math.max(rank, 11)

  // Top 3 requires MVP + championship + 97+ OVR
  if (rank <= 3 && !(wonMVP && champion && ovr >= 97)) rank = 4

  // #1 requires MVP + championship + 99 OVR
  if (rank <= 1 && !(wonMVP && champion && ovr >= 99)) rank = 2

  return Math.max(1, Math.min(75, rank))
}

// When player inserts at playerRank, everyone at playerRank+ shifts down one
function getEffectiveEntry(displayRank, playerRank) {
  if (displayRank < playerRank)  return GOAT_MAP[displayRank]
  if (displayRank === playerRank) return null
  return GOAT_MAP[displayRank - 1] ?? null
}


function GoatAvatar({ entry, isPlayer, playerTeam, playerTeamColor, size = 56 }) {
  const teamShort  = isPlayer ? playerTeam : entry?.team
  const teamObj    = TEAM_MAP[teamShort]
  const color      = isPlayer ? playerTeamColor : teamObj?.color
  const headshotId = !isPlayer ? NBA_HEADSHOTS[entry?.name] : null
  const photo      = headshotId ? `/headshots/nba/${headshotId}.webp` : null
  return (
    <QBAvatar
      photo={photo}
      team={teamShort}
      color={color}
      size={size}
      logoDir="/logos/nba/"
    />
  )
}

function GoatCard({ rank, entry, isPlayer, playerTeam, playerTeamColor }) {
  const displayName = isPlayer ? 'Your Player' : (entry?.name ?? '—')
  const teamShort   = isPlayer ? playerTeam : entry?.team
  const teamObj     = TEAM_MAP[teamShort]
  const accentColor = isPlayer ? '#e8a820' : (teamObj?.color ?? 'rgba(255,255,255,0.15)')
  const rings       = isPlayer ? 0 : (entry?.rings ?? 0)
  const isGoat = !isPlayer && rank === 1
  return (
    <div
      className={`goat-card${isPlayer ? ' goat-card--you' : ''}${isGoat ? ' goat-card--rank1' : ''}`}
      style={{ '--accent': accentColor }}
    >
      {isGoat && <span className="goat-card-watermark" aria-hidden="true">G.O.A.T.</span>}
      <span className="goat-card-rank">{rank}</span>
      <GoatAvatar
        entry={entry ?? {}}
        isPlayer={isPlayer}
        playerTeam={playerTeam}
        playerTeamColor={playerTeamColor}
        size={isPlayer ? 56 : 44}
      />
      <div className="goat-card-info">
        <span className="goat-card-name">{displayName}</span>
        {teamShort && <span className="goat-card-team">{teamShort}</span>}
      </div>

      {isPlayer && <span className="goat-card-you-badge">YOU</span>}
    </div>
  )
}

function ScreenGOAT({ result, awards, onNext, onReset, onBack, adsDisabled = false }) {
  const { ovr, team } = result
  const playerRank   = computeGoatRank(result, awards)
  const qualified    = playerRank !== null

  const [phase,       setPhase]      = useState('checking')
  const [tickerRank,  setTickerRank] = useState(76)
  const [listVisible, setListVisible] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (!listVisible || adsDisabled || window.innerWidth > 768) return
    window.ramp?.que?.push(() => {
      window.ramp.spaAddAds([
        { type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-goat-61' },
        { type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-goat-51' },
        { type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-goat-41' },
        { type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-goat-31' },
        { type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-goat-21' },
      ])
    })
  }, [listVisible]) // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => { setPhase(qualified ? 'ticker' : 'miss'); if (!qualified) setListVisible(true) }, 2200)
    return () => clearTimeout(t)
  }, [qualified])

  useEffect(() => {
    if (phase !== 'ticker') return
    if (tickerRank === 76) { setTickerRank(75); return }
    if (tickerRank === playerRank) {
      const t = setTimeout(() => {
        setPhase('revealed')
        setTimeout(() => {
          setListVisible(true)
          // scroll player row into center after list paints
          setTimeout(() => {
            if (listRef.current) {
              const youRow = listRef.current.querySelector('.goat-card--you')
              if (youRow) youRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 500)
        }, 600)
      }, 1100)
      return () => clearTimeout(t)
    }
    if (tickerRank < playerRank) { setPhase('revealed'); setListVisible(true); return }
    const dist  = tickerRank - playerRank
    const delay = dist > 20 ? 50 : dist > 10 ? 90 : dist > 5 ? 170 : 290
    const t = setTimeout(() => setTickerRank(r => r - 1), delay)
    return () => clearTimeout(t)
  }, [phase, tickerRank, playerRank])

  // Ticker uses shifted list so rank never spoils your position
  const tickerEntry = tickerRank > playerRank ? GOAT_MAP[tickerRank - 1] : GOAT_MAP[tickerRank]

  // Full 75-rank list with player inserted
  const fullList = []
  if (qualified) {
    for (let r = 75; r >= 1; r--) {
      fullList.push(r)
    }
  }

  const skip = () => { setPhase('revealed'); setListVisible(true) }

  return (
    <div className="simp-screen goat-screen">
      <div className="goat-screen-title">GOAT STATUS</div>
      <div className="goat-page-title">Top 75 Players</div>
      <div className="goat-eyebrow">OF ALL TIME</div>

      {phase === 'checking' && (
        <div className="goat-checking">
          <div className="goat-check-ring" />
          <div className="goat-check-lbl">Checking your credentials…</div>
        </div>
      )}

      {phase === 'miss' && (
        <>
          <div className="goat-miss-card">
            <div className="goat-miss-title">Missed the Cut</div>
            <div className="goat-miss-ovr">OVR {ovr}</div>
          </div>
          <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginBottom: 8 }}>Final Report →</button>
          <div ref={listRef} className={`goat-full-list${listVisible ? ' goat-list-in' : ''}`}>
            {Array.from({ length: 75 }, (_, i) => 75 - i).map(r => (
              <React.Fragment key={r}>
                <GoatCard rank={r} entry={GOAT_MAP[r]} isPlayer={false} playerTeam={team?.short} playerTeamColor={team?.color} />
                {(r === 61 || r === 51 || r === 41 || r === 31 || r === 21) && (
                  <div id={`ramp-cntr1-goat-${r}`} className="ad-cntr1-mobile" />
                )}
              </React.Fragment>
            ))}
          </div>
          <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginTop: 12 }}>Final Report →</button>
        </>
      )}

      {phase === 'ticker' && (
        <div className="goat-ticker" onClick={skip}>
          <div className="goat-ticker-rank">#{tickerRank}</div>
          <GoatAvatar entry={tickerEntry ?? {}} isPlayer={false} playerTeam={null} playerTeamColor={null} size={120} />
          <div className="goat-ticker-name">{tickerEntry?.name ?? '…'}</div>
          <div className="goat-ticker-team">{tickerEntry?.team ?? ''}</div>
        </div>
      )}

      {phase === 'revealed' && (
        <>
          <div className="goat-reveal-banner">
            <div className="goat-reveal-you">Your player is ranked</div>
            <div className="goat-reveal-rank">#{playerRank}</div>
          </div>

          <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginBottom: 8 }}>Final Report →</button>
          <div
            ref={listRef}
            className={`goat-full-list${listVisible ? ' goat-list-in' : ''}`}
          >
            {fullList.map(r => {
              const isMe = r === playerRank
              const eff  = isMe ? null : getEffectiveEntry(r, playerRank)
              return (
                <React.Fragment key={r}>
                  <GoatCard
                    rank={r}
                    entry={eff}
                    isPlayer={isMe}
                    playerTeam={team?.short}
                    playerTeamColor={team?.color}
                  />
                  {(r === 61 || r === 51 || r === 41 || r === 31 || r === 21) && (
                    <div id={`ramp-cntr1-goat-${r}`} className="ad-cntr1-mobile" />
                  )}
                </React.Fragment>
              )
            })}
          </div>
          <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginTop: 12 }}>Final Report →</button>
        </>
      )}
    </div>
  )
}

// ─── Playoff per-game stat generator ─────────────────────────────────────────
function genPlayoffGameStats(baseStats, won) {
  // Form: tight bell-curve via average of 3 randoms (central limit), range ~0.65–1.35
  const form   = (Math.random() + Math.random() + Math.random()) / 3
  const wl     = won ? 1.06 : 0.94
  const factor = (0.65 + form * 0.70) * wl

  const rng = (base, noiseFrac) => {
    const noise = (Math.random() - 0.5) * base * noiseFrac
    return Math.max(0, Math.round(base * factor + noise))
  }
  // Blocks/steals are discrete rare events — use Poisson-like zero probability
  // P(0) = e^(-λ) so bpg=0.8 → ~45% zeros, bpg=1.5 → ~22% zeros
  const rngSparse = (base) => {
    const λ = base * factor
    if (Math.random() < Math.exp(-λ)) return 0
    return Math.max(1, Math.round(λ + (Math.random() - 0.5) * base * 0.5))
  }
  return {
    pts: rng(baseStats.ppg, 0.4),
    reb: rng(baseStats.rpg, 0.4),
    ast: rng(baseStats.apg, 0.4),
    blk: rngSparse(baseStats.bpg),
    stl: rngSparse(baseStats.spg),
  }
}

// ─── Playoff Stats Log ────────────────────────────────────────────────────────
function PlayoffStatsLog({ log, playoffRounds }) {
  // log: [{ roundIdx, roundName, oppShort, gameNum, won, pts, reb, ast, blk, stl }]
  const [selRound, setSelRound] = useState(null)

  if (!log.length) return null

  // Group by roundIdx
  const byRound = {}
  for (const entry of log) {
    if (!byRound[entry.roundIdx]) byRound[entry.roundIdx] = { name: entry.roundName, opp: entry.oppShort, games: [] }
    byRound[entry.roundIdx].games.push(entry)
  }
  const roundKeys = Object.keys(byRound).map(Number).sort((a, b) => a - b)

  const displayRound = selRound !== null ? selRound : roundKeys[roundKeys.length - 1]
  const roundData = byRound[displayRound]

  const seriesAvg = (key) => {
    const vals = roundData.games.map(g => g[key])
    return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) // avg can have .5
  }

  return (
    <div className="po-log">
      <div className="po-log-tabs">
        {roundKeys.map(rk => (
          <button
            key={rk}
            className={`po-log-tab${displayRound === rk ? ' po-log-tab--active' : ''}`}
            onClick={() => setSelRound(rk)}
          >{byRound[rk].name.replace('Conference ', 'Conf ')}</button>
        ))}
      </div>
      {roundData && (
        <>
          <div className="po-log-series-hdr">
            <span className="po-log-opp">vs {roundData.opp}</span>
            <span className="po-log-avg">{seriesAvg('pts')} / {seriesAvg('reb')} / {seriesAvg('ast')} avg</span>
          </div>
          <div className="po-log-table">
            <div className="po-log-head">
              <span>G</span><span>RES</span><span>PTS</span><span>REB</span><span>AST</span><span>BLK</span><span>STL</span>
            </div>
            {roundData.games.map((g, i) => (
              <div key={i} className={`po-log-row${g.won ? ' po-log-row-w' : ' po-log-row-l'}`}>
                <span>{g.gameNum}</span>
                <span className={g.won ? 'po-log-w' : 'po-log-l'}>{g.won ? 'W' : 'L'}</span>
                <span>{g.pts}</span>
                <span>{g.reb}</span>
                <span>{g.ast}</span>
                <span>{g.blk}</span>
                <span>{g.stl}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Bracket Generator ────────────────────────────────────────────────────────
const CONF_TEAMS_LISTS = {
  east: ['ATL','BOS','BKN','CHA','CHI','CLE','DET','IND','MIA','MIL','NYK','ORL','PHI','TOR','WAS'],
  west: ['DAL','DEN','GSW','HOU','LAC','LAL','MEM','MIN','NOP','OKC','PHX','POR','SAC','SAS','UTA'],
}

function generateConfBracket(standings, myShort, playoffRounds) {
  const get = s => ({ ...(standings[s - 1] ?? { short: '???', wins: 30 }), seed: s })
  const simGame = (aAdv = 0) => (0.38 + aAdv + Math.random() * 0.24) > 0.50

  // Use standings positions directly for seeds 7 and 8 — this matches what simPlayoffs uses
  // (get(8) = standings[7]) so the bracket teams are always consistent with the actual opponents.
  // Only override if the player themselves went through the play-in.
  let playin7 = { ...get(7), seed: 7 }
  let playin8 = { ...get(8), seed: 8 }

  const myPlayin = playoffRounds?.find(r => r.type === 'playin')
  if (myPlayin) {
    const myTeamObj = [get(7), get(8), get(9), get(10)].find(t => t.short === myShort)
    if (myTeamObj) {
      if (myPlayin.newSeed === 7) {
        playin7 = { ...myTeamObj, seed: 7 }
        if (playin8.short === myShort) playin8 = { ...get(8), seed: 8 }
      }
      if (myPlayin.newSeed === 8) {
        playin8 = { ...myTeamObj, seed: 8 }
        if (playin7.short === myShort) playin7 = { ...get(7), seed: 7 }
      }
    }
  }

  const seeds = [get(1),get(2),get(3),get(4),get(5),get(6), playin7, playin8]
  const byS = s => seeds.find(t => t.seed === s) ?? { short: '???', seed: s }

  const simMatchup = (a, b) => {
    const adv = ((b.seed ?? 5) - (a.seed ?? 5)) / 20
    return simGame(adv) ? { ...a } : { ...b }
  }
  const resolveForPlayer = (a, b, roundIndex) => {
    const isMyMatchup = a.short === myShort || b.short === myShort
    if (isMyMatchup) {
      const r = playoffRounds.find(r => r.type === 'series' && r.roundIndex === roundIndex)
      if (r) return r.won ? (a.short === myShort ? { ...a } : { ...b }) : (a.short === myShort ? { ...b } : { ...a })
    }
    // If the player's next-round opponent came from this matchup, force the correct winner
    const nextRound = playoffRounds?.find(r => r.type === 'series' && r.roundIndex === roundIndex + 1)
    if (nextRound?.opponent) {
      if (a.short === nextRound.opponent.short) return { ...a }
      if (b.short === nextRound.opponent.short) return { ...b }
    }
    return simMatchup(a, b)
  }

  // R1: 1v8, 4v5, 2v7, 3v6
  const r1pairs = [[byS(1),byS(8)],[byS(4),byS(5)],[byS(2),byS(7)],[byS(3),byS(6)]]
  const r1res   = r1pairs.map(([a,b]) => resolveForPlayer(a, b, 0))

  const sfPairs = [[r1res[0],r1res[1]],[r1res[2],r1res[3]]]
  const sfRes   = sfPairs.map(([a,b]) => resolveForPlayer(a, b, 1))

  const cfPair  = [sfRes[0], sfRes[1]]
  const cfRes   = resolveForPlayer(cfPair[0], cfPair[1], 2)

  return {
    r1: { pairs: r1pairs, results: r1res },
    sf: { pairs: sfPairs, results: sfRes },
    cf: { pair: cfPair,   result: cfRes  },
    confChamp: cfRes,
  }
}

function generateOtherConfBracket(otherConf) {
  const teams = CONF_TEAMS_LISTS[otherConf]
    .map(s => {
      const tr = TEAM_RATINGS[s] ?? { off: 65, def: 65 }
      const base = (tr.off + tr.def) / 2
      return { short: s, wins: Math.round(base * 0.9 + Math.random() * 8 - 4) }
    })
    .sort((a, b) => b.wins - a.wins)
  return generateConfBracket(teams, null, [])
}

// ─── Full Bracket Component ────────────────────────────────────────────────────
function FullBracket({ myConf, confBracket, otherBracket, myShort, mySeed, teamColor,
                       activeRoundIdx, activeGames, parallelSeriesMap = {}, allPlayoffRounds = [], showAllRounds = false }) {
  const [mobileConf, setMobileConf] = useState(myConf)

  const eastBracket = myConf === 'east' ? confBracket : otherBracket
  const westBracket = myConf === 'west' ? confBracket : otherBracket

  // Round is "visible" for player's conf only once the prior round is complete
  // Finals column (rIdx=3) always shown (teams appear as TBD until ready)
  const roundVisible = rIdx => showAllRounds || rIdx === 3 || !confBracket || rIdx === 0 || activeRoundIdx >= rIdx

  // Player's current series score for in-progress matchup
  const myActiveW = activeGames ? activeGames.filter(g => g === 'W').length : 0
  const myActiveL = activeGames ? activeGames.filter(g => g === 'L').length : 0

  const completedRoundsMap = {
    0: showAllRounds || activeRoundIdx > 0,
    1: showAllRounds || activeRoundIdx > 1,
    2: showAllRounds || activeRoundIdx > 2,
    3: showAllRounds || !!allPlayoffRounds.find(r => r.type === 'series' && r.roundIndex === 3),
  }

  function TeamRow({ team, winner, seriesDone, isMyTeam, isActive, visible, parallelWins, isFinalsRow }) {
    if (!visible || !team || team.short === '???') {
      return <div className="brk2-team brk2-team-tbd"><span className="brk2-abbr">TBD</span></div>
    }
    const eliminated = seriesDone && winner?.short !== team.short
    const advancing  = seriesDone && winner?.short === team.short
    const isChampion = isFinalsRow && advancing
    const displaySeed = isMyTeam && mySeed != null ? mySeed : team.seed
    const showWins = isActive || parallelWins != null
    const winsDisplay = isActive
      ? (isMyTeam ? myActiveW : myActiveL)
      : parallelWins
    return (
      <div
        className={`brk2-team${isMyTeam ? ' brk2-team-me' : ''}${eliminated ? ' brk2-team-elim' : ''}${isChampion ? ' brk2-team-champ' : advancing ? ' brk2-team-adv' : ''}`}
        style={isMyTeam ? { '--my-color': teamColor } : {}}
      >
        <img src={`/logos/nba/${team.short}.png`} alt={team.short} className="brk2-logo" onError={e => e.target.style.display='none'} />
        <span className="brk2-seed">{displaySeed}</span>
        <span className="brk2-abbr">{team.short}</span>
        {showWins && <span className="brk2-live-score">{winsDisplay}</span>}
      </div>
    )
  }

  function Matchup({ a, b, winner, rIdx, myBracket, matchupIdx }) {
    const visible     = roundVisible(rIdx)
    const aIsMe       = a?.short === myShort
    const bIsMe       = b?.short === myShort
    const isPlayerMatchup = aIsMe || bIsMe

    // Parallel data for every non-player matchup (default 0-0 so it shows from game 1)
    const parallelKey  = myBracket ? `${rIdx}-${matchupIdx}` : `other-${rIdx}-${matchupIdx}`
    const parallelData = !isPlayerMatchup && visible
      ? (parallelSeriesMap[parallelKey] ?? { winsA: 0, winsB: 0, done: false })
      : null

    // seriesDone: player's own matchup uses completedRoundsMap; everything else uses parallelData.done
    const seriesDone = isPlayerMatchup
      ? !!completedRoundsMap[rIdx]
      : (parallelData?.done ?? false)

    const isActive = myBracket && !seriesDone && activeRoundIdx === rIdx && isPlayerMatchup

    // Player's own series wins — live from activeGames, or final score from playoffRounds when done
    const playerWinsA = isPlayerMatchup ? (() => {
      if (!seriesDone) return aIsMe ? myActiveW : myActiveL
      const pr = allPlayoffRounds.find(r => r.type === 'series' && r.roundIndex === rIdx)
      if (!pr) return null
      const w = pr.games.filter(g => g === 'W').length, l = pr.games.filter(g => g === 'L').length
      return aIsMe ? w : l
    })() : null
    const playerWinsB = isPlayerMatchup ? (() => {
      if (!seriesDone) return bIsMe ? myActiveW : myActiveL
      const pr = allPlayoffRounds.find(r => r.type === 'series' && r.roundIndex === rIdx)
      if (!pr) return null
      const w = pr.games.filter(g => g === 'W').length, l = pr.games.filter(g => g === 'L').length
      return bIsMe ? w : l
    })() : null

    const isFinalsRow = rIdx === 3
    return (
      <div className="brk2-matchup">
        <TeamRow team={a} winner={seriesDone ? winner : null}
                 seriesDone={seriesDone} isMyTeam={aIsMe}
                 isActive={isActive} visible={visible}
                 parallelWins={parallelData != null ? parallelData.winsA : playerWinsA}
                 isFinalsRow={isFinalsRow} />
        <div className="brk2-mid-line" />
        <TeamRow team={b} winner={seriesDone ? winner : null}
                 seriesDone={seriesDone} isMyTeam={bIsMe}
                 isActive={isActive} visible={visible}
                 parallelWins={parallelData != null ? parallelData.winsB : playerWinsB}
                 isFinalsRow={isFinalsRow} />
      </div>
    )
  }

  // eastStyle: apply row-reverse CSS (brk2-conf-rev) but keep col array in natural order
  // so East reads: Finals(left/inner) | CF | Semis | R1(right/outer) — traditional bracket orientation
  function ConfBracket({ bracket, conf, reversed, eastStyle, finalsA, finalsB, finalsDone }) {
    if (!bracket) return null
    const { r1, sf, cf } = bracket
    const isMyConf = conf === myConf

    const cols = [
      { key: 'r1', label: 'R1',
        matchups: r1.pairs.map(([a,b], i) => ({ a, b, winner: r1.results[i], rIdx: 0 })) },
      { key: 'sf', label: 'Semis',
        matchups: sf.pairs.map(([a,b], i) => ({ a, b, winner: sf.results[i], rIdx: 1 })) },
      { key: 'cf', label: 'Conf Finals',
        matchups: [{ a: cf.pair[0], b: cf.pair[1], winner: cf.result, rIdx: 2 }] },
    ]
    // West reversed: array flipped + row-reverse → visual [R1|Semis|CF] left-to-right
    // East eastStyle: array normal + row-reverse → visual [CF|Semis|R1] left-to-right
    const orderedCols = reversed ? [...cols].reverse() : cols
    const useRevClass = reversed || eastStyle

    return (
      <div className={`brk2-conf${useRevClass ? ' brk2-conf-rev' : ''}`}>
        <div className="brk2-conf-label">{conf === 'east' ? 'Eastern' : 'Western'}</div>
        <div className="brk2-cols">
          {orderedCols.map((col) => (
            <div key={col.key} className={`brk2-col brk2-col-${col.key}`}>
              <div className="brk2-col-lbl">{col.label}</div>
              <div className="brk2-matchups">
                {col.matchups.map((m, mi) => (
                  <Matchup key={mi} {...m} matchupIdx={mi} myBracket={isMyConf} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Finals teams: only reveal once player reaches Finals OR bracket has been fully simulated (post-elimination)
  const finalsSimulated = !!(parallelSeriesMap['3-0'] || parallelSeriesMap['other-3-0'])
  const finalsReady = activeRoundIdx > 2 || finalsSimulated
  const finalsA = finalsReady ? (westBracket?.confChamp ?? null) : null
  const finalsB = finalsReady ? (eastBracket?.confChamp ?? null) : null
  // Round 3 (Finals) is done when it appears in allPlayoffRounds as a completed series
  const finalsDone = !!allPlayoffRounds.find(r => r.type === 'series' && r.roundIndex === 3)
  // Determine Finals winner for bracket highlight
  const finalsWinner = (() => {
    const playerFinalsRound = allPlayoffRounds.find(r => r.type === 'series' && r.roundIndex === 3)
    if (playerFinalsRound) {
      const playerWon = playerFinalsRound.games.filter(g => g === 'W').length === 4
      return playerWon ? (myConf === 'west' ? finalsA : finalsB) : playerFinalsRound.opponent
    }
    const finSim = parallelSeriesMap['3-0']
    if (finSim?.done && finalsA && finalsB) {
      return finSim.winsA === 4 ? finalsA : finalsB
    }
    return null
  })()

  return (
    <div className="brk2-root">
      {/* Mobile conf toggle — segmented pill */}
      <div className="brk2-mobile-toggle">
        <div className="brk2-tog-seg">
          <button
            className={`brk2-tog-btn${mobileConf === 'west' ? ' brk2-tog-btn--active' : ''}`}
            onClick={() => setMobileConf('west')}
          >West</button>
          <button
            className={`brk2-tog-btn${mobileConf === 'east' ? ' brk2-tog-btn--active' : ''}`}
            onClick={() => setMobileConf('east')}
          >East</button>
        </div>
      </div>

      {/* Desktop: West (3 cols) | Finals (1 col) | East (3 cols) */}
      <div className="brk2-desktop">
        <ConfBracket bracket={westBracket} conf="west" reversed={true}  finalsA={finalsA} finalsB={finalsB} finalsDone={finalsDone} />
        <div className="brk2-col brk2-col-finals brk2-col-finals-center">
          <div className="brk2-col-lbl">NBA Finals</div>
          <div className="brk2-matchups">
            <Matchup a={finalsA} b={finalsB} winner={finalsWinner} rIdx={3} matchupIdx={0} myBracket={true} />
          </div>
        </div>
        <ConfBracket bracket={eastBracket} conf="east" eastStyle={true} finalsA={finalsA} finalsB={finalsB} finalsDone={finalsDone} />
      </div>

      {/* Mobile: one conference at a time */}
      <div className="brk2-mobile">
        <ConfBracket
          bracket={mobileConf === 'west' ? westBracket : eastBracket}
          conf={mobileConf}
          reversed={mobileConf === 'west'}
          eastStyle={mobileConf === 'east'}
          finalsA={finalsA} finalsB={finalsB} finalsDone={finalsDone}
        />
      </div>
    </div>
  )
}

// ─── Screen 3: NBA Playoffs ───────────────────────────────────────────────────
function ScreenPlayoffs({ result, onNext, autoSkip = false, isAllTime = false, adsDisabled = false }) {
  const { playoffRounds = [], madePlayoffs, team, standings = [], seed: rawSeed } = result
  const playinRound = playoffRounds.find(r => r.type === 'playin' && r.advanced)
  const seed = playinRound?.newSeed ?? rawSeed
  const teamColor = team?.color ?? '#fb923c'
  const teamShort = team?.short ?? 'YOU'

  const [allScores] = useState(() =>
    playoffRounds.map(r =>
      r.type === 'series' ? r.games.map(g => nbaScore(g === 'W')) : []
    )
  )
  const [roundIdx,   setRoundIdx]   = useState(0)
  const [gameIdx,    setGameIdx]    = useState(0)
  const [status,     setStatus]     = useState('playing')
  const [tipOff,     setTipOff]     = useState(autoSkip) // skip tip-off in autoSkip mode
  const [ballFired,  setBallFired]  = useState(false)  // jump animation playing
  const [speedMult,  setSpeedMult]  = useState(1)      // 1=fast 4=slow
  const [paused,     setPaused]     = useState(false)
  const [timerPct,         setTimerPct]         = useState(0)
  const [playoffGameLog,   setPlayoffGameLog]   = useState([])
  const [showStatsLog,     setShowStatsLog]     = useState(false)
  const [parallelSeriesMap,  setParallelSeriesMap]  = useState({})
  const [champPopped,        setChampPopped]        = useState(false)

  // Ref so autoSkip effect can call handleSkip even though it's defined after early returns
  const handleSkipRef = useRef(null)
  useEffect(() => { if (autoSkip) handleSkipRef.current?.() }, []) // eslint-disable-line

  useEffect(() => {
    if (!showStatsLog || adsDisabled || window.innerWidth > 768) return
    window.ramp?.que?.push(() => {
      window.ramp.spaAddAds([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-plf-log' }])
    })
  }, [showStatsLog]) // eslint-disable-line

  const conf = result.conference ?? 'east'
  const otherConf = conf === 'east' ? 'west' : 'east'
  const [confBracket, otherBracket] = useMemo(() => {
    if (!standings.length) return [null, null]
    return [
      generateConfBracket(standings, teamShort, playoffRounds),
      generateOtherConfBracket(otherConf),
    ]
  }, []) // eslint-disable-line

  const BETWEEN_DURATION = 2500 // always fixed — only the live game respects speedMult

  // Auto-advance between rounds with progress meter
  useEffect(() => {
    if (status !== 'between-rounds') return
    setTimerPct(0)
    const TICK = 40
    let elapsed = 0
    const iv = setInterval(() => {
      elapsed += TICK
      setTimerPct(Math.min(100, (elapsed / BETWEEN_DURATION) * 100))
      if (elapsed >= BETWEEN_DURATION) {
        clearInterval(iv)
        setRoundIdx(r => r + 1); setGameIdx(0); setStatus('playing')
      }
    }, TICK)
    return () => clearInterval(iv)
  }, [status, speedMult]) // eslint-disable-line

  // Auto-advance play-in after timer (not needed in autoSkip mode — handleSkip covers it)
  useEffect(() => {
    if (!tipOff) return
    if (autoSkip) return
    const cur = playoffRounds[roundIdx]
    if (!cur || cur.type !== 'playin') return
    const TICK = 40
    let elapsed = 0
    setTimerPct(0)
    const iv = setInterval(() => {
      elapsed += TICK
      setTimerPct(Math.min(100, (elapsed / BETWEEN_DURATION) * 100))
      if (elapsed >= BETWEEN_DURATION) {
        clearInterval(iv)
        if (cur.advanced) { setRoundIdx(r => r + 1); setGameIdx(0); setTipOff(false); setBallFired(false) }
        else onNext()
      }
    }, TICK)
    return () => clearInterval(iv)
  }, [roundIdx, tipOff]) // eslint-disable-line

  const handleTipOff = () => {
    setBallFired(true)
    setTimeout(() => setTipOff(true), 400)
  }

  const playinEliminatedRound = !madePlayoffs && playoffRounds.find(r => r.type === 'playin' && !r.advanced)

  if (!madePlayoffs && !playinEliminatedRound) {
    return (
      <div className="simp-screen simp-screen-center">
        <div className="simp-eyebrow">Postseason</div>
        <div className="simp-miss-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="24" cy="24" r="19"/><path d="M16 16l16 16M32 16L16 32"/>
          </svg>
        </div>
        <div className="simp-miss-title">Missed the Playoffs</div>
        <button className="simp-cta" onClick={onNext}>See Summary</button>
      </div>
    )
  }

  if (playinEliminatedRound) {
    return (
      <div className="simp-screen simp-screen-center">
        <div className="simp-eyebrow">Play-In Tournament</div>
        <div className="simp-miss-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="24" cy="24" r="19"/><path d="M16 16l16 16M32 16L16 32"/>
          </svg>
        </div>
        <div className="simp-miss-title">Eliminated in Play-In</div>
        <div className="simp-miss-sub" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 6 }}>
          {playinEliminatedRound.opponent?.short ? `Lost to ${playinEliminatedRound.opponent.short}` : 'Better luck next season'}
        </div>
        <button className="simp-cta" onClick={onNext}>See Summary</button>
      </div>
    )
  }

  // Derive current series state for bracket
  const currentSeriesRound = (() => {
    const r = playoffRounds[roundIdx]
    return r?.type === 'series' ? r : null
  })()
  const activeRoundIdx = currentSeriesRound?.roundIndex ?? -1
  const activeGames = currentSeriesRound ? currentSeriesRound.games.slice(0, gameIdx) : []

  // ── Tip-off screen ──
  if (!tipOff) {
    return (
      <div className="simp-screen">
        <div className="simp-eyebrow" style={{ textAlign: 'center' }}>{isAllTime ? 'All-Time Playoffs' : 'Playoffs'}</div>
        <div className="tipoff-header">
          <div className="tipoff-arena">
            <span className={`tipoff-ball${ballFired ? ' tipoff-ball--fired' : ''}`}>🏀</span>
          </div>
          <div className="tipoff-sub">#{seed} Seed · {teamShort}</div>
          <button className="tipoff-spin-btn" onClick={handleTipOff} disabled={ballFired}>
            {ballFired ? 'STARTING…' : 'TIP OFF'}
          </button>
        </div>
        <FullBracket
          myConf={conf}
          confBracket={confBracket}
          otherBracket={otherBracket}
          myShort={teamShort}
          mySeed={seed}
          teamColor={teamColor}
          activeRoundIdx={-1}
          activeGames={[]}
        />
      </div>
    )
  }

  const currentRound = playoffRounds[roundIdx]
  if (!currentRound) { return null }

  // Play-in
  if (currentRound.type === 'playin') {
    return (
      <div className="simp-screen">
        <div className="simp-eyebrow">Play-In Tournament</div>
        <div className={`bsim-playin-card${currentRound.advanced ? ' bsim-playin-card--adv' : ' bsim-playin-card--elim'}`}>
          <div className="bsim-playin-result">{currentRound.advanced ? '✓ Advanced' : '✗ Eliminated'}</div>
          <div className="bsim-playin-label">{currentRound.label}</div>
          {currentRound.games && (
            <div className="bsim-dots" style={{ marginTop: 8 }}>
              {currentRound.games.map((g, i) => (
                <span key={i} className={`bsim-dot bsim-dot--${g === 'W' ? 'w' : 'l'}`}>{g}</span>
              ))}
            </div>
          )}
        </div>
        <div className="plf-series-timer"><div className="plf-series-timer-fill" style={{ width: `${timerPct}%` }} /></div>
      </div>
    )
  }

  // ── Parallel series helpers ───────────────────────────────────────────────
  const getConfRoundData = (rIdx) => {
    if (!confBracket) return null
    if (rIdx === 0) return { pairs: confBracket.r1.pairs, results: confBracket.r1.results }
    if (rIdx === 1) return { pairs: confBracket.sf.pairs, results: confBracket.sf.results }
    return { pairs: [confBracket.cf.pair], results: [confBracket.cf.result] }
  }

  const getPlayerMatchupIdx = (rIdx) => {
    const rd = getConfRoundData(rIdx)
    if (!rd) return -1
    return rd.pairs.findIndex(([a, b]) => a?.short === teamShort || b?.short === teamShort)
  }

  const simParallelGame = (winsA, winsB, aShort, winnerShort) => {
    const aIsWinner = aShort === winnerShort
    const aWins = Math.random() < (aIsWinner ? 0.62 : 0.38)
    return { winsA: winsA + (aWins ? 1 : 0), winsB: winsB + (aWins ? 0 : 1) }
  }

  // Guarantee the correct bracket winner with NBA-realistic series length (4-0 through 4-3)
  const simSeriesDirect = (existingWinsA, existingWinsB, aShort, winnerShort) => {
    const aIsWinner = aShort === winnerShort
    const existingLoserWins = aIsWinner ? existingWinsB : existingWinsA
    // Weighted distribution: ~15% sweep, ~25% 4-1, ~30% 4-2, ~30% 4-3
    const dist = [0.15, 0.25, 0.30, 0.30]
    const slice = dist.slice(existingLoserWins)
    const total = slice.reduce((s, v) => s + v, 0)
    let r = Math.random() * total, loserFinal = 3
    for (let i = 0; i < slice.length; i++) {
      r -= slice[i]
      if (r <= 0) { loserFinal = existingLoserWins + i; break }
    }
    return aIsWinner
      ? { winsA: 4, winsB: loserFinal, done: true }
      : { winsA: loserFinal, winsB: 4, done: true }
  }

  const getOtherConfRoundData = (rIdx) => {
    if (!otherBracket) return null
    if (rIdx === 0) return { pairs: otherBracket.r1.pairs, results: otherBracket.r1.results }
    if (rIdx === 1) return { pairs: otherBracket.sf.pairs, results: otherBracket.sf.results }
    return { pairs: [otherBracket.cf.pair], results: [otherBracket.cf.result] }
  }

  const advanceParallelSeries = (rIdx) => {
    setParallelSeriesMap(prev => {
      const next = { ...prev }
      // Player's conference (skip player's own matchup)
      const myIdx = getPlayerMatchupIdx(rIdx)
      const rd = getConfRoundData(rIdx)
      if (rd) {
        rd.pairs.forEach(([a, b], i) => {
          if (i === myIdx) return
          const key = `${rIdx}-${i}`
          const cur = next[key] ?? { winsA: 0, winsB: 0, done: false }
          if (cur.done) return
          const raw = simParallelGame(cur.winsA, cur.winsB, a?.short, rd.results[i]?.short)
          const winnerIsA = a?.short === rd.results[i]?.short
          // Cap loser at 3 so the wrong team never falsely ends the series
          const winsA = (!winnerIsA && raw.winsA > 3) ? 3 : raw.winsA
          const winsB = (winnerIsA  && raw.winsB > 3) ? 3 : raw.winsB
          next[key] = { winsA, winsB, done: winsA === 4 || winsB === 4 }
        })
      }
      // Other conference — all series run in parallel
      const ord = getOtherConfRoundData(rIdx)
      if (ord) {
        ord.pairs.forEach(([a, b], i) => {
          const key = `other-${rIdx}-${i}`
          const cur = next[key] ?? { winsA: 0, winsB: 0, done: false }
          if (cur.done) return
          const raw = simParallelGame(cur.winsA, cur.winsB, a?.short, ord.results[i]?.short)
          const winnerIsA = a?.short === ord.results[i]?.short
          const winsA = (!winnerIsA && raw.winsA > 3) ? 3 : raw.winsA
          const winsB = (winnerIsA  && raw.winsB > 3) ? 3 : raw.winsB
          next[key] = { winsA, winsB, done: winsA === 4 || winsB === 4 }
        })
      }
      return next
    })
  }

  const completeParallelSeries = (rIdx) => {
    setParallelSeriesMap(prev => {
      const next = { ...prev }
      const myIdx = getPlayerMatchupIdx(rIdx)
      const rd = getConfRoundData(rIdx)
      if (rd) {
        rd.pairs.forEach(([a, b], i) => {
          if (i === myIdx) return
          const key = `${rIdx}-${i}`
          const cur = next[key] ?? { winsA: 0, winsB: 0, done: false }
          if (cur.done) return
          next[key] = simSeriesDirect(cur.winsA, cur.winsB, a?.short, rd.results[i]?.short)
        })
      }
      const ord = getOtherConfRoundData(rIdx)
      if (ord) {
        ord.pairs.forEach(([a, b], i) => {
          const key = `other-${rIdx}-${i}`
          const cur = next[key] ?? { winsA: 0, winsB: 0, done: false }
          if (cur.done) return
          next[key] = simSeriesDirect(cur.winsA, cur.winsB, a?.short, ord.results[i]?.short)
        })
      }
      return next
    })
  }

  const completeAllRemainingRounds = (fromRoundIdx) => {
    setParallelSeriesMap(prev => {
      const next = { ...prev }

      // Simulate all rounds after the current one for both confs (player is out, no skipping)
      for (let rIdx = fromRoundIdx + 1; rIdx <= 2; rIdx++) {
        const rd = getConfRoundData(rIdx)
        if (rd) {
          rd.pairs.forEach(([a, b], i) => {
            const key = `${rIdx}-${i}`
            if (next[key]?.done) return
            const cur = next[key] ?? { winsA: 0, winsB: 0 }
            next[key] = simSeriesDirect(cur.winsA, cur.winsB, a?.short, rd.results[i]?.short)
          })
        }
        const ord = getOtherConfRoundData(rIdx)
        if (ord) {
          ord.pairs.forEach(([a, b], i) => {
            const key = `other-${rIdx}-${i}`
            if (next[key]?.done) return
            const cur = next[key] ?? { winsA: 0, winsB: 0 }
            next[key] = simSeriesDirect(cur.winsA, cur.winsB, a?.short, ord.results[i]?.short)
          })
        }
      }

      // Simulate the NBA Finals between the two conf champs
      const westChampTeam = conf === 'west' ? confBracket?.confChamp : otherBracket?.confChamp
      const eastChampTeam = conf === 'east' ? confBracket?.confChamp : otherBracket?.confChamp
      if (westChampTeam && eastChampTeam) {
        const wRat = (TEAM_RATINGS[westChampTeam.short]?.off ?? 65) + (TEAM_RATINGS[westChampTeam.short]?.def ?? 65)
        const eRat = (TEAM_RATINGS[eastChampTeam.short]?.off ?? 65) + (TEAM_RATINGS[eastChampTeam.short]?.def ?? 65)
        const finWinner = Math.random() < wRat / (wRat + eRat) ? westChampTeam.short : eastChampTeam.short
        const finResult = simSeriesDirect(0, 0, westChampTeam.short, finWinner)
        next['3-0']       = finResult
        next['other-3-0'] = finResult
      }

      return next
    })
  }

  const handleSkip = () => {
    const seriesRounds = playoffRounds.filter(r => r.type === 'series')
    if (!seriesRounds.length) return
    const finalSeries = seriesRounds[seriesRounds.length - 1]
    const finalSeriesPlayoffIdx = playoffRounds.length - 1 - [...playoffRounds].reverse().findIndex(r => r === finalSeries)
    const isChampion = finalSeries.games.filter(g => g === 'W').length === 4

    // Generate game log for all remaining unplayed games
    const baseStats = { ppg: result.ppg ?? 22, rpg: result.rpg ?? 5, apg: result.apg ?? 4, spg: result.spg ?? 1.2, bpg: result.bpg ?? 0.8 }
    const newLogEntries = []
    for (let rIdx = roundIdx; rIdx < playoffRounds.length; rIdx++) {
      const round = playoffRounds[rIdx]
      if (round.type !== 'series') continue
      const startGame = rIdx === roundIdx ? gameIdx : 0
      for (let gIdx = startGame; gIdx < round.games.length; gIdx++) {
        const won = round.games[gIdx] === 'W'
        const stats = genPlayoffGameStats(baseStats, won)
        newLogEntries.push({
          roundIdx: round.roundIndex ?? rIdx,
          roundName: round.name,
          oppShort: round.opponent?.short ?? '???',
          gameNum: gIdx + 1,
          won,
          ...stats,
        })
      }
    }
    if (newLogEntries.length > 0) setPlayoffGameLog(prev => [...prev, ...newLogEntries])

    setParallelSeriesMap(prev => {
      const next = { ...prev }
      for (let rIdx = 0; rIdx <= 2; rIdx++) {
        const myIdx = getPlayerMatchupIdx(rIdx)
        const rd = getConfRoundData(rIdx)
        if (rd) {
          rd.pairs.forEach(([a, b], i) => {
            if (i === myIdx) return
            const key = `${rIdx}-${i}`
            if (next[key]?.done) return
            const cur = next[key] ?? { winsA: 0, winsB: 0 }
            next[key] = simSeriesDirect(cur.winsA, cur.winsB, a?.short, rd.results[i]?.short)
          })
        }
        const ord = getOtherConfRoundData(rIdx)
        if (ord) {
          ord.pairs.forEach(([a, b], i) => {
            const key = `other-${rIdx}-${i}`
            if (next[key]?.done) return
            const cur = next[key] ?? { winsA: 0, winsB: 0 }
            next[key] = simSeriesDirect(cur.winsA, cur.winsB, a?.short, ord.results[i]?.short)
          })
        }
      }
      if (!next['3-0']) {
        const westChampTeam = conf === 'west' ? confBracket?.confChamp : otherBracket?.confChamp
        const eastChampTeam = conf === 'east' ? confBracket?.confChamp : otherBracket?.confChamp
        if (westChampTeam && eastChampTeam) {
          const wRat = (TEAM_RATINGS[westChampTeam.short]?.off ?? 65) + (TEAM_RATINGS[westChampTeam.short]?.def ?? 65)
          const eRat = (TEAM_RATINGS[eastChampTeam.short]?.off ?? 65) + (TEAM_RATINGS[eastChampTeam.short]?.def ?? 65)
          const finWinner = Math.random() < wRat / (wRat + eRat) ? westChampTeam.short : eastChampTeam.short
          const finResult = simSeriesDirect(0, 0, westChampTeam.short, finWinner)
          next['3-0']       = finResult
          next['other-3-0'] = finResult
        }
      }
      return next
    })

    setRoundIdx(finalSeriesPlayoffIdx)
    setGameIdx(finalSeries.games.length - 1)
    setStatus(isChampion ? 'champion' : 'eliminated')
  }

  // Keep ref current so the early-mounted autoSkip effect can call handleSkip
  handleSkipRef.current = handleSkip

  const handleGameDone = () => {
    const gms    = currentRound.games
    const played = gameIdx + 1
    const won    = gms[gameIdx] === 'W'
    const myW    = gms.slice(0, played).filter(g => g === 'W').length
    const oppW   = gms.slice(0, played).filter(g => g === 'L').length

    // Generate per-game stats
    const baseStats = { ppg: result.ppg ?? 22, rpg: result.rpg ?? 5, apg: result.apg ?? 4, spg: result.spg ?? 1.2, bpg: result.bpg ?? 0.8 }
    const stats = genPlayoffGameStats(baseStats, won)
    setPlayoffGameLog(prev => [...prev, {
      roundIdx: currentRound.roundIndex ?? roundIdx,
      roundName: currentRound.name,
      oppShort: currentRound.opponent?.short ?? '???',
      gameNum: gameIdx + 1,
      won,
      ...stats,
    }])

    if (myW === 4 || oppW === 4) {
      completeParallelSeries(activeRoundIdx)
      if (oppW === 4) { completeAllRemainingRounds(activeRoundIdx); setStatus('eliminated') }
      else if (roundIdx >= playoffRounds.length - 1) setStatus('champion')
      else                                          setStatus('between-rounds')
    } else {
      advanceParallelSeries(activeRoundIdx)
      setGameIdx(g => g + 1)
    }
  }

  const getSeriesScore = () => {
    const played = gameIdx + 1
    const myW  = currentRound.games.slice(0, played).filter(g => g === 'W').length
    const oppW = currentRound.games.slice(0, played).filter(g => g === 'L').length
    return { myW, oppW }
  }

  const bracketProps = {
    myConf: conf, confBracket, otherBracket, myShort: teamShort, mySeed: seed, teamColor,
    activeRoundIdx, activeGames, parallelSeriesMap, allPlayoffRounds: playoffRounds,
    showAllRounds: status === 'eliminated' || status === 'champion',
  }

  // Playing state — NBA home court by game number
  const isBetween = status === 'between-rounds'
  const currentScore = allScores[roundIdx]?.[gameIdx]
  const endScore = (status === 'champion' || status === 'eliminated') ? getSeriesScore() : null

  const oppShort = currentRound.opponent?.short ?? 'OPP'
  const prevW = currentRound.games.slice(0, gameIdx).filter(g => g === 'W').length
  const prevL = currentRound.games.slice(0, gameIdx).filter(g => g === 'L').length
  const nextRound = isBetween ? playoffRounds[roundIdx + 1] : null
  const higherSeedHome  = NBA_HOME_PATTERN[gameIdx] ?? true
  const playerHigherSeed = seed <= (currentRound.opponent?.seed ?? 9)
  const isHome = higherSeedHome ? playerHigherSeed : !playerHigherSeed

  return (
    <div className="simp-screen">

      {/* Champion */}
      {status === 'champion' && endScore && (
        <>
          <div className="simp-eyebrow-row"><div className="simp-eyebrow">Playoffs</div></div>
          <div className="plf-end-card plf-end-card--champ">
            {champPopped && (
              <div className="plf-champ-bubbles" aria-hidden="true">
                {Array.from({length: 18}).map((_,i) => (
                  <span key={i} className="plf-bubble" style={{
                    '--bx': `${Math.round((Math.random()-0.5)*180)}px`,
                    '--by': `${-Math.round(60 + Math.random()*120)}px`,
                    '--bs': `${0.5 + Math.random()*1.1}`,
                    animationDelay: `${(i * 0.045).toFixed(2)}s`,
                  }}>✦</span>
                ))}
              </div>
            )}
            {champPopped
              ? <img src="/trophybasketball.webp" alt="" className="sfb-trophy plf-trophy-reveal" />
              : <button className="plf-champ-bottle" onClick={() => setChampPopped(true)} aria-label="Pop champagne">🍾</button>
            }
            <div className="plf-champ-label">NBA Champions!</div>
            <div className="plf-champ-sub">{endScore.myW}–{endScore.oppW} vs {otherBracket?.confChamp?.short ?? currentRound.opponent?.short} · {currentRound.name}</div>
            {champPopped
              ? <button className="simp-cta simp-cta-in plf-report-reveal" onClick={onNext}>GOAT Status →</button>
              : <div className="plf-champ-tap-hint">tap the bottle</div>
            }
          </div>
          <PlayoffStatsLog log={playoffGameLog} playoffRounds={playoffRounds} />
        </>
      )}

      {/* Eliminated */}
      {status === 'eliminated' && endScore && (
        <>
          <div className="simp-eyebrow-row"><div className="simp-eyebrow">Playoffs</div></div>
          <div className="plf-end-card">
            <div className="simp-eyebrow">Season Over</div>
            <div className="plf-elim-title">{currentRound.name === 'NBA Finals' ? 'Lost the Finals' : 'Eliminated'}</div>
            <div className="plf-elim-round">{currentRound.name === 'NBA Finals' ? '' : currentRound.name}</div>
            <div className="plf-elim-score">Lost series {endScore.myW}–{endScore.oppW} vs {currentRound.name === 'NBA Finals' ? (otherBracket?.confChamp?.short ?? currentRound.opponent?.short) : currentRound.opponent?.short}</div>
            <button className="simp-cta" onClick={onNext}>GOAT Status →</button>
          </div>
          <PlayoffStatsLog log={playoffGameLog} playoffRounds={playoffRounds} />
        </>
      )}

      {/* Playing / between-rounds */}
      {status !== 'champion' && status !== 'eliminated' && (currentScore || isBetween) && (
        <>
          <div className="simp-eyebrow-row">
            <div className="simp-eyebrow">Playoffs</div>
          </div>
          <div className="bsim-series-header">
            <span className="bsim-sh-round">{currentRound.name}</span>
            <span className="bsim-sh-opp">vs {oppShort}{currentRound.opponent?.seed ? ` · #${currentRound.opponent.seed}` : ''}</span>
          </div>
          <div className="bsim-mini-series">
            {currentRound.games.slice(0, gameIdx).map((g, i) => (
              <span key={i} className={`bsim-ms-dot bsim-ms-dot--${g === 'W' ? 'w' : 'l'}`}>{g}</span>
            ))}
            {Array.from({ length: Math.max(0, 7 - gameIdx) }).map((_, i) => (
              <span key={`e${i}`} className="bsim-ms-dot bsim-ms-dot--empty" />
            ))}
            <span className="bsim-ms-score">{prevW}–{prevL}</span>
          </div>
          {isBetween ? (
            <div className="plf-game plf-game-won">
              <div className="plf-round-row">
                <div className="plf-round-lbl">{currentRound.name} · Series Complete</div>
              </div>
              <div className="plf-bw-inner">
                <div className="plf-bw-result">
                  <span className="plf-bw-w">W</span>
                  <span className="plf-bw-score">Series {prevW}–{prevL}</span>
                </div>
                <div className="plf-bw-adv">Advancing…</div>
                {nextRound && (
                  <div className="plf-bw-next">Next up · {nextRound.name}{nextRound.opponent?.short ? ` vs ${nextRound.opponent.short}` : ''}</div>
                )}
              </div>
              <div className="plf-live-area" style={{ visibility: 'hidden' }} />
              <div className="plf-post-line plf-pl-won" style={{ visibility: 'hidden' }} />
              <div className="plf-series-timer"><div className="plf-series-timer-fill" style={{ width: `${timerPct}%` }} /></div>
            </div>
          ) : (
            <NBAPlayoffGame
              key={`${roundIdx}-${gameIdx}`}
              gameNum={gameIdx + 1}
              seriesName={currentRound.name}
              oppShort={oppShort}
              myColor={teamColor}
              myShort={teamShort}
              myFinal={currentScore.myScore}
              oppFinal={currentScore.oppScore}
              won={currentRound.games[gameIdx] === 'W'}
              isHome={isHome}
              speedMult={speedMult}
              paused={paused}
              mySeed={seed}
              oppSeed={currentRound.opponent?.seed}
              onDone={handleGameDone}
            />
          )}
          <div className="po-log-toggle-row">
            <div className="plf-seg">
              <button className={`plf-seg-btn${!paused && speedMult === 10 ? ' plf-seg-btn--active' : ''}`} onClick={() => { setSpeedMult(10); setPaused(false) }}>Slowest</button>
              <button className={`plf-seg-btn${!paused && speedMult === 4 ? ' plf-seg-btn--active' : ''}`} onClick={() => { setSpeedMult(4); setPaused(false) }}>Slow</button>
              <button className={`plf-seg-btn plf-seg-btn-pause-icon${paused ? ' plf-seg-btn--pause' : ''}`} onClick={() => setPaused(true)}>
                <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><rect x="0" y="0" width="3.5" height="12" rx="1"/><rect x="6.5" y="0" width="3.5" height="12" rx="1"/></svg>
              </button>
              <button className={`plf-seg-btn${!paused && speedMult === 1 ? ' plf-seg-btn--active' : ''}`} onClick={() => { setSpeedMult(1); setPaused(false) }}>Fast</button>
              <button className="plf-seg-btn plf-seg-btn-skip" onClick={handleSkip}>Skip<br/>Playoff</button>
            </div>
            {playoffGameLog.length > 0 ? (
              <button className="po-log-toggle-btn" onClick={() => setShowStatsLog(s => !s)}>
                {showStatsLog ? 'Hide' : 'View'} Game Log
              </button>
            ) : <div />}
          </div>
          {showStatsLog && <PlayoffStatsLog log={playoffGameLog} playoffRounds={playoffRounds} />}
          {showStatsLog && !adsDisabled && (
            <div id="ramp-cntr1-plf-log" className="plf-banner-ad" />
          )}
        </>
      )}

      <FullBracket {...bracketProps} />
    </div>
  )
}

// ─── Screen 3: Final Report ───────────────────────────────────────────────────
function ScreenFinal({ result, awards, build, types, attrMap, onReset, onBack, adsDisabled = false, isSalaryMode = false }) {
  const {
    ovr, wins, losses, champion, madePlayoffs, playoffRounds = [],
    ppg, rpg, apg, spg, bpg, tov, fgPct, threePct, ftPct, per, bestGame, team,
  } = result
  const goatRank = computeGoatRank(result, awards)
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), 200); return () => clearTimeout(t) }, [])

  useEffect(() => {
    if (adsDisabled) return
    const ads = [{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-sim' }]
    window.ramp?.que?.push(() => { window.ramp.spaAddAds(ads) })
  }, [])

  const fgAnim    = useCountUp(fgPct,    900, show)
  const threeAnim = useCountUp(threePct, 900, show)
  const ftAnim    = useCountUp(ftPct,    900, show)

  const seriesRounds  = playoffRounds.filter(r => r.type === 'series')
  const lastSeries    = seriesRounds[seriesRounds.length - 1]
  const playoffSummary = !madePlayoffs
    ? 'Missed the Playoffs'
    : champion
      ? 'NBA Champions!'
      : lastSeries
        ? `Eliminated · ${lastSeries.name}`
        : playoffRounds.some(r => r.type === 'playin' && !r.advanced)
          ? 'Eliminated in Play-In'
          : 'Season Ended'

  const filled = types.filter(t => build[t])

  return (
    <div className="simp-screen">
      <div className={`simp-final-banner ${champion ? 'sfb-champ' : madePlayoffs ? 'sfb-elim' : 'sfb-miss'}`}>
        {champion && <img src="/trophybasketball.webp" alt="NBA Trophy" className="sfb-trophy" />}
        <div className="sfb-outcome">{playoffSummary}</div>
        <div className="sfb-sub">{wins}–{losses} Season · OVR {ovr}</div>
      </div>

      {team && <BucketModelFigure build={build} team={team} className="simp-team-model--final" />}

      {champion && lastSeries && (
        <div className="sfr-finals-card">
          <div className="sfr-finals-lbl">NBA Finals</div>
          <div className="sfr-finals-matchup">
            <div className="sfr-finals-side">
              <img src={`/logos/nba/${result.team?.short}.png`} alt={result.team?.short} className="sfr-finals-logo" onError={e => e.target.style.display='none'} />
              <span className="sfr-finals-abbr" style={{ color: result.team?.color ?? '#fb923c' }}>{result.team?.short}</span>
            </div>
            <div className="sfr-finals-score">{lastSeries.wins}–{lastSeries.losses}</div>
            <div className="sfr-finals-side">
              <img src={`/logos/nba/${lastSeries.opponent?.short}.png`} alt={lastSeries.opponent?.short} className="sfr-finals-logo" onError={e => e.target.style.display='none'} />
              <span className="sfr-finals-abbr">{lastSeries.opponent?.short}</span>
            </div>
          </div>
        </div>
      )}

      <div className="simp-stat-section">
        <StatCard
          ppg={show ? ppg : null} rpg={show ? rpg : null} apg={show ? apg : null}
          spg={show ? spg : null} bpg={show ? bpg : null} tov={show ? tov : null}
          fgPct={show ? fgAnim : null} threePct={show ? threeAnim : null} ftPct={show ? ftAnim : null}
          per={show ? per : null}
        />
      </div>

      {bestGame && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body">
            <span className="sbg-week">G {bestGame.g}</span>
            <span className="sbg-opp">{bestGame.home ? 'vs' : '@'} {bestGame.opponent}</span>
            <span className="sbg-line">{bestGame.pts} pts · {bestGame.reb} reb · {bestGame.ast} ast</span>
          </div>
        </div>
      )}

      <div style={{
        border: `1px solid ${goatRank ? 'rgba(168,85,247,0.45)' : 'rgba(255,255,255,0.07)'}`,
        background: goatRank ? 'linear-gradient(135deg,rgba(168,85,247,0.13) 0%,rgba(59,130,246,0.06) 100%)' : 'rgba(255,255,255,0.02)',
        borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, margin: '6px 0',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>GOAT Status</div>
          {goatRank ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#a855f7', lineHeight: 1 }}>#{goatRank}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>All-Time Top 75</span>
            </div>
          ) : (
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>Did Not Qualify</div>
          )}
        </div>
        {goatRank && (
          <div style={{ fontSize: 11, color: 'rgba(168,85,247,0.7)', fontWeight: 700, letterSpacing: '0.05em', textAlign: 'right', flexShrink: 0 }}>
            {goatRank <= 5 ? 'LEGEND' : goatRank <= 15 ? 'ELITE' : goatRank <= 35 ? 'GREAT' : 'QUALIFIED'}
          </div>
        )}
      </div>

      {filled.length > 0 && (
        <div className="simp-stat-section">
          <div className="simp-stat-group-lbl">Your Build</div>
          <div className="simp-attr-table simp-attr-table-sm">
            {filled.map(t => {
              const meta = attrMap[t] ?? { label: t, hex: '#888' }
              const data = build[t]
              return (
                <div key={t} className="simp-attr-row simp-row-visible">
                  <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={36} logoDir="/logos/nba/" faceCenter={data.faceCenter} />
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

      <div id="ramp-cntr1-sim" className="ad-cntr1-mobile" />

      <div className="simp-final-actions">
        {isSalaryMode
          ? <button className="simp-cta" onClick={onBack}>← Back to Salary</button>
          : <>
              <button className="simp-cta" onClick={onReset}>New Build</button>
              <button className="simp-ghost" onClick={onBack}>Back to Build</button>
            </>
        }
      </div>
    </div>
  )
}

// ─── Progress Dots ────────────────────────────────────────────────────────────
function ProgressDots({ screen, total }) {
  return (
    <div className="simp-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`simp-dot ${i === screen ? 'simp-dot-active' : i < screen ? 'simp-dot-done' : ''}`} />
      ))}
    </div>
  )
}

// ─── All-Time Starting 5: ordered PG → SG → SF → PF → C (each franchise at its peak era) ─
// Replacement slot per team — lowest OVR among the guard (0-2) or big (3-4) positions
const ALLTIME_REPLACE_IDX = {
  ATL: {g:1, b:4}, BOS: {g:0, b:3}, BKN: {g:2, b:4}, CHA: {g:1, b:3},
  CHI: {g:0, b:3}, CLE: {g:1, b:4}, DAL: {g:1, b:4}, DEN: {g:2, b:3},
  DET: {g:1, b:4}, GSW: {g:1, b:3}, HOU: {g:0, b:3}, IND: {g:0, b:4},
  LAC: {g:1, b:4}, LAL: {g:1, b:3}, MEM: {g:1, b:3}, MIA: {g:0, b:3},
  MIL: {g:1, b:3}, MIN: {g:0, b:4}, NOP: {g:2, b:4}, NYK: {g:2, b:4},
  OKC: {g:2, b:4}, ORL: {g:1, b:4}, PHI: {g:0, b:3}, PHX: {g:2, b:4},
  POR: {g:0, b:3}, SAC: {g:2, b:4}, SAS: {g:0, b:4}, TOR: {g:0, b:3},
  UTA: {g:1, b:4}, WAS: {g:2, b:3},
}

const ALLTIME_STARTERS = {
  ATL: ['Pete Maravich',    'Trae Young',        'Dominique Wilkins',   'Bob Pettit',          'Dikembe Mutombo'],
  BOS: ['Bob Cousy',        'Paul Pierce',       'Larry Bird',          'Kevin McHale',         'Bill Russell'],
  BKN: ['Jason Kidd',       'Kyrie Irving',      'Kevin Durant',        'Julius Erving',        'Brook Lopez'],
  CHA: ['Muggsy Bogues',    'Dell Curry',        'Glen Rice',           'Larry Johnson',        'Alonzo Mourning'],
  CHI: ['Derrick Rose',     'Michael Jordan',    'Scottie Pippen',      'Dennis Rodman',        'Joakim Noah'],
  CLE: ['Kyrie Irving',     'Mark Price',        'LeBron James',        'Kevin Love',           'Zydrunas Ilgauskas'],
  DAL: ['Jason Kidd',       'Jason Terry',       'Luka Doncic',         'Dirk Nowitzki',        'Tyson Chandler'],
  DEN: ['Chauncey Billups', 'David Thompson',    'Alex English',        'Carmelo Anthony',      'Nikola Jokic'],
  DET: ['Isiah Thomas',     'Joe Dumars',        'Grant Hill',          'Dennis Rodman',        'Bill Laimbeer'],
  GSW: ['Stephen Curry',    'Klay Thompson',     'Rick Barry',          'Draymond Green',       'Wilt Chamberlain'],
  HOU: ['Steve Francis',    'James Harden',      'Clyde Drexler',       'Charles Barkley',      'Hakeem Olajuwon'],
  IND: ['Mark Jackson',     'Reggie Miller',     'Paul George',         "Jermaine O'Neal",     'Rik Smits'],
  LAC: ['Chris Paul',       'Lou Williams',      'Kawhi Leonard',       'Blake Griffin',        'DeAndre Jordan'],
  LAL: ['Magic Johnson',    'Kobe Bryant',       'LeBron James',        "Shaquille O'Neal",     'Kareem Abdul-Jabbar'],
  MEM: ['Mike Conley',      'Tony Allen',        'Pau Gasol',           'Zach Randolph',        'Marc Gasol'],
  MIA: ['Tim Hardaway',     'Dwyane Wade',       'LeBron James',        'Chris Bosh',           'Alonzo Mourning'],
  MIL: ['Oscar Robertson',  'Ray Allen',         'Giannis Antetokounmpo','Marques Johnson',     'Kareem Abdul-Jabbar'],
  MIN: ['Stephon Marbury',  'Anthony Edwards',   'Jimmy Butler',        'Kevin Garnett',        'Karl-Anthony Towns'],
  NOP: ['Chris Paul',       'Jrue Holiday',      'Brandon Ingram',      'Anthony Davis',        'Zion Williamson'],
  NYK: ['Walt Frazier',     'Earl Monroe',       'Carmelo Anthony',     'Patrick Ewing',        'Willis Reed'],
  OKC: ['Gary Payton',      'Russell Westbrook', 'Kevin Durant',        'Shawn Kemp',           'Serge Ibaka'],
  ORL: ['Penny Hardaway',   'Nick Anderson',     'Tracy McGrady',       "Shaquille O'Neal",     'Dwight Howard'],
  PHI: ['Maurice Cheeks',   'Allen Iverson',     'Julius Erving',       'Charles Barkley',      'Wilt Chamberlain'],
  PHX: ['Steve Nash',       'Devin Booker',      'Dan Majerle',         'Charles Barkley',      "Amar'e Stoudemire"],
  POR: ['Damian Lillard',   'Clyde Drexler',     'Brandon Roy',         'LaMarcus Aldridge',    'Bill Walton'],
  SAC: ['Jason Williams',   'Mitch Richmond',    'Peja Stojakovic',     'Chris Webber',         'Vlade Divac'],
  SAS: ['Tony Parker',      'Manu Ginobili',     'Kawhi Leonard',       'Tim Duncan',           'David Robinson'],
  TOR: ['Kyle Lowry',       'Vince Carter',      'Kawhi Leonard',       'Chris Bosh',           'Pascal Siakam'],
  UTA: ['John Stockton',    'Donovan Mitchell',  'Adrian Dantley',      'Karl Malone',          'Mark Eaton'],
  WAS: ['John Wall',        'Gilbert Arenas',    'Bradley Beal',        'Elvin Hayes',          'Wes Unseld'],
}

const ALLTIME_VISUAL_RATINGS = ALLTIME_TEAM_RATINGS

// ─── Starting 5: ordered PG → SG → SF → PF → C (2025-26 rosters from database) ─
const TEAM_STARTERS = {
  ATL: ['CJ McCollum','Dyson Daniels','Jalen Johnson','Zaccharie Risacher','Onyeka Okongwu'],
  BOS: ['Payton Pritchard','Derrick White','Paul George','Jayson Tatum','Mitchell Robinson'],
  BKN: ['Nolan Traore','Egor Demin','Keon Ellis','Noah Clowney','Julius Randle'],
  CHA: ['Coby White','Grayson Allen','Brandon Miller','Tidjane Salaun','Moussa Diabate'],
  CHI: ['Josh Giddey','Norman Powell','Matas Buzelis','Patrick Williams','Nic Claxton'],
  CLE: ['Donovan Mitchell','James Harden','LeBron James','Evan Mobley','Jarrett Allen'],
  DAL: ['Kyrie Irving','Klay Thompson','Cooper Flagg','Santi Aldama','Daniel Gafford'],
  DEN: ['Jamal Murray','Christian Braun','Cameron Johnson','Aaron Gordon','Nikola Jokic'],
  DET: ['Cade Cunningham','Kevin Huerter','Ronald Holland II','John Collins','Jalen Duren'],
  GSW: ['Stephen Curry','Brandin Podziemski','Moses Moody','Draymond Green','Kristaps Porzingis'],
  HOU: ['Marcus Smart','Amen Thompson','Kevin Durant','Jabari Smith Jr.','Alperen Sengun'],
  IND: ['Tyrese Haliburton','Andrew Nembhard','Aaron Nesmith','Pascal Siakam','Ivica Zubac'],
  LAC: ['Darius Garland','Bennedict Mathurin','Kawhi Leonard','Rui Hachimura','Brook Lopez'],
  LAL: ['Luka Doncic','Collin Sexton','Dalton Knecht','Jarred Vanderbilt','Walker Kessler'],
  MEM: ["D'Angelo Russell",'Walter Clayton Jr.','Jaylen Wells','Taylor Hendricks','Zach Edey'],
  MIA: ['Davion Mitchell','Andrew Wiggins','Giannis Antetokounmpo','Bobby Portis','Bam Adebayo'],
  MIL: ['Caris LeVert','Tyler Herro','Jaime Jaquez Jr.','Kyle Kuzma','Myles Turner'],
  MIN: ['LaMelo Ball','Anthony Edwards','Josh Green','Jaden McDaniels','Rudy Gobert'],
  NOP: ['Dejounte Murray','Jordan Hawkins','Trey Murphy III','Zion Williamson','Hunter Dickinson'],
  NYK: ['Jalen Brunson','Mikal Bridges','OG Anunoby','Josh Hart','Karl-Anthony Towns'],
  OKC: ['Shai Gilgeous-Alexander','Alex Caruso','Luguentz Dort','Chet Holmgren','Isaiah Hartenstein'],
  ORL: ['Jalen Suggs','Desmond Bane','Franz Wagner','Paolo Banchero','Nikola Vucevic'],
  PHI: ['Tyrese Maxey','Anfernee Simons','Jaylen Brown','Justin Edwards','Joel Embiid'],
  PHX: ['Devin Booker','Jalen Green','Dillon Brooks','Miles Bridges','Mark Williams'],
  POR: ['Damian Lillard','Shaedon Sharpe','Deni Avdija','Toumani Camara','Donovan Clingan'],
  SAC: ['Killian Hayes','Zach LaVine',"De'Andre Hunter",'Keegan Murray','Domantas Sabonis'],
  SAS: ["De'Aaron Fox",'Stephon Castle','Devin Vassell','Keldon Johnson','Victor Wembanyama'],
  TOR: ['Immanuel Quickley','RJ Barrett','Scottie Barnes','Brandon Ingram','Jakob Poeltl'],
  UTA: ['Keyonte George','Isaiah Collier','Ace Bailey','Lauri Markkanen','Jaren Jackson Jr.'],
  WAS: ['Trae Young','Bilal Coulibaly','AJ Dybantsa','Khris Middleton','Anthony Davis'],
}

const PLAYER_INDEX = Object.fromEntries(NBA_PLAYERS.map(p => [p.name, p]))

const SUFFIXES = new Set(['Jr.', 'Jr', 'II', 'III', 'IV'])
function starterDisplayName(p) {
  if (!SUFFIXES.has(p.short)) return p.short
  const parts    = p.name.split(' ')
  const nameParts = parts.filter(pt => !SUFFIXES.has(pt))
  return nameParts[nameParts.length - 1]
}

function playerOvr(p) {
  if (!p?.attrs) return 0
  return Object.values(p.attrs).reduce((s, v) => s + (v || 0), 0)
}

// ─── TeamStarters ─────────────────────────────────────────────────────────────
function TeamStarters({ teamShort, teamColor, isBig, iqPhoto, isAllTime = false }) {
  if (isAllTime) {
    const names = ALLTIME_STARTERS[teamShort] ?? []
    if (!names.length) return null
    const ri = ALLTIME_REPLACE_IDX[teamShort] ?? { g: 2, b: 3 }
    const replaceIdx = isBig ? ri.b : ri.g
    return (
      <div className="sts-starters">
        {names.map((name, i) => {
          const isMe  = i === replaceIdx
          const hid   = !isMe && NBA_HEADSHOTS[name]
          const photo = isMe ? iqPhoto : (hid ? `/headshots/nba/${hid}.webp` : null)
          return (
            <div key={isMe ? 'you' : name} className={`sts-starter${isMe ? ' sts-starter--you' : ''}`}>
              <QBAvatar photo={photo} team={teamShort} color={isMe ? teamColor : teamColor + '99'} size={42} logoDir="/logos/nba/" />
              <span className="sts-starter-name" style={isMe ? { color: teamColor, fontWeight: 700 } : undefined}>
                {isMe ? 'YOUR BUILD' : name}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  const names    = TEAM_STARTERS[teamShort] ?? []
  const starters = names.map(n => PLAYER_INDEX[n]).filter(Boolean)
  if (!starters.length) return null

  const mySlots    = isBig ? [3, 4] : [0, 1, 2]
  const validSlots = mySlots.filter(i => starters[i])
  const replaceIdx = validSlots.reduce((weakIdx, i) =>
    playerOvr(starters[i]) < playerOvr(starters[weakIdx]) ? i : weakIdx
  , validSlots[0] ?? 0)

  return (
    <div className="sts-starters">
      {starters.map((p, i) => {
        const isMe  = i === replaceIdx
        const hid   = !isMe && NBA_HEADSHOTS[p.name]
        const photo = isMe ? iqPhoto : (hid ? `/headshots/nba/${hid}.webp` : null)
        return (
          <div key={isMe ? 'you' : p.name} className={`sts-starter${isMe ? ' sts-starter--you' : ''}`}>
            <QBAvatar photo={photo} team={p.team} color={isMe ? teamColor : teamColor + '99'} size={42} logoDir="/logos/nba/" />
            <span className="sts-starter-name" style={isMe ? { color: teamColor, fontWeight: 700 } : undefined}>
              {isMe ? 'YOUR BUILD' : starterDisplayName(p)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main BucketSimPage ───────────────────────────────────────────────────────
export default function BucketSimPage({ result, build, types, position, onBack, onReset, adsDisabled = false, isSalaryMode = false, initialScreen = 0, gameMode = null }) {
  const [screen, setScreen] = useState(initialScreen)

  // Compute awards once — result is stable after sim runs
  const awards = useMemo(() => {
    if (!result) return null
    const { ppg, rpg, apg, spg, bpg, ovr, team } = result
    const isAllTime = gameMode === 'all-time'
    const rb = (lo, hi) => parseFloat((lo + Math.random() * (hi - lo)).toFixed(1))
    const mvpScore = (p, r, a) => p * 2.0 + r * 1.0 + a * 1.5
    const MVP_POOL = isAllTime ? [
      { name: 'Michael Jordan',    short: 'Jordan',   team: 'CHI', ppg: rb(31,35), rpg: rb(5,6),   apg: rb(5,6)   },
      { name: 'LeBron James',      short: 'LeBron',   team: 'MIA', ppg: rb(27,30), rpg: rb(7,9),   apg: rb(7,9)   },
      { name: 'Wilt Chamberlain',  short: 'Wilt',     team: 'PHI', ppg: rb(38,50), rpg: rb(22,27), apg: rb(2,4)   },
      { name: 'Kareem Abdul-Jabbar', short: 'Kareem', team: 'LAL', ppg: rb(28,35), rpg: rb(13,17), apg: rb(3,5)   },
      { name: 'Magic Johnson',     short: 'Magic',    team: 'LAL', ppg: rb(20,23), rpg: rb(6,8),   apg: rb(10,13) },
      { name: 'Larry Bird',        short: 'Bird',     team: 'BOS', ppg: rb(27,30), rpg: rb(9,11),  apg: rb(6,7)   },
      { name: 'Oscar Robertson',   short: 'Oscar',    team: 'MIL', ppg: rb(28,31), rpg: rb(10,13), apg: rb(10,12) },
      { name: 'Shaquille O\'Neal', short: 'Shaq',     team: 'LAL', ppg: rb(27,30), rpg: rb(12,14), apg: rb(3,4)   },
      { name: 'Hakeem Olajuwon',   short: 'Hakeem',   team: 'HOU', ppg: rb(24,27), rpg: rb(12,14), apg: rb(3,4)   },
      { name: 'Moses Malone',      short: 'Moses',    team: 'HOU', ppg: rb(27,31), rpg: rb(13,15), apg: rb(1,2)   },
    ] : [
      { name: 'Nikola Jokic',            short: 'Jokic',   team: 'DEN', ppg: rb(26,30), rpg: rb(11,14), apg: rb(9,12)  },
      { name: 'Shai Gilgeous-Alexander', short: 'SGA',     team: 'OKC', ppg: rb(29,33), rpg: rb(4,6),   apg: rb(5,7)   },
      { name: 'Giannis Antetokounmpo',   short: 'Giannis', team: 'MIA', ppg: rb(28,32), rpg: rb(10,13), apg: rb(5,7), mult: 0.35 },
      { name: 'Luka Doncic',             short: 'Luka',    team: 'LAL', ppg: rb(26,30), rpg: rb(8,10),  apg: rb(8,11)  },
      { name: 'Victor Wembanyama',       short: 'Wemby',   team: 'SAS', ppg: rb(24,28), rpg: rb(9,12),  apg: rb(3,5)   },
    ]
    const topScore = Math.max(...MVP_POOL.map(c => mvpScore(c.ppg, c.rpg, c.apg)))
    const myScore = mvpScore(ppg, rpg, apg)
    let mvp
    if (myScore >= topScore * 1.06) {
      mvp = { name: 'You', short: 'You', team: team?.short, ppg, rpg, apg, isPlayer: true }
    } else {
      const playerMult = myScore >= topScore * 0.92 ? 1 : 0
      const playerEntry = { name: 'You', short: 'You', team: team?.short, ppg, rpg, apg, isPlayer: true, mult: playerMult }
      const allMVP = [...MVP_POOL, playerEntry].map(c => ({ ...c, w: Math.pow(Math.max(0, mvpScore(c.ppg, c.rpg, c.apg)), 2.5) * (c.mult ?? 1) }))
      const totalW = allMVP.reduce((s, c) => s + c.w, 0)
      let rand = Math.random() * totalW; mvp = allMVP[0]
      for (const c of allMVP) { rand -= c.w; if (rand <= 0) { mvp = c; break } }
    }
    const playerDPOY = ovr >= 80 && bpg >= 2.8 && spg >= 1.5
    const dpoy = playerDPOY
      ? { name: 'You', short: 'You', team: team?.short, spg, bpg, isPlayer: true }
      : isAllTime
        ? (() => {
            const DPOY_POOL = [
              { name: 'Hakeem Olajuwon', short: 'Hakeem', team: 'HOU', spg: rb(1.6,2.0), bpg: rb(3.7,4.2) },
              { name: 'Bill Russell',    short: 'Russell', team: 'BOS', spg: rb(1.8,2.2), bpg: rb(4.5,5.5) },
              { name: 'David Robinson', short: 'Robinson', team: 'SAS', spg: rb(1.7,1.9), bpg: rb(3.8,4.5) },
              { name: 'Dikembe Mutombo', short: 'Mutombo', team: 'DEN', spg: rb(0.5,0.7), bpg: rb(3.0,3.5) },
              { name: 'Gary Payton',    short: 'Payton',   team: 'SEA', spg: rb(1.8,2.3), bpg: rb(0.2,0.4) },
              { name: 'Ben Wallace',    short: 'Wallace',  team: 'DET', spg: rb(1.2,1.6), bpg: rb(3.0,3.7) },
            ]
            return DPOY_POOL[Math.floor(Math.random() * DPOY_POOL.length)]
          })()
        : { name: 'Victor Wembanyama', short: 'Wembanyama', team: 'SAS', spg: rb(1.2, 1.6), bpg: rb(3.2, 3.8) }
    return { mvp, dpoy }
  }, [result]) // eslint-disable-line

  const advancePage = () => {
    document.querySelector('.simp-page')?.scrollTo({ top: 0, behavior: 'instant' })
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (!adsDisabled) window.ramp?.que?.push(() => { window.ramp.spaNewPage() })
    setScreen(s => s + 1)
  }

  const handleReset    = () => { setScreen(0); onReset() }
  const handleBack     = () => { setScreen(0); onBack()  }
  const handleGoatBack = () => setScreen(s => s - 1)

  const simTypes   = isSalaryMode ? SAL_REP_TYPES : types
  const simAttrMap = isSalaryMode ? SAL_ATTR_MAP  : BUCKET_ATTR
  const isAllTime  = gameMode === 'all-time'
  const screens = isSalaryMode ? [
    <ScreenBuild    key="build"    result={result} build={build} types={simTypes} attrMap={simAttrMap} onNext={advancePage} adsDisabled={adsDisabled} isSalaryMode={isSalaryMode} />,
    <ScreenSeason   key="season"   result={result} awards={awards} onNext={advancePage} adsDisabled={adsDisabled} isAllTime={isAllTime} />,
    <ScreenPlayoffs key="playoffs" result={result} onNext={advancePage} autoSkip={true} isAllTime={isAllTime} adsDisabled={adsDisabled} />,
    <ScreenGOAT     key="goat"     result={result} awards={awards} onNext={advancePage} onReset={handleReset} onBack={handleGoatBack} adsDisabled={adsDisabled} />,
    <ScreenFinal    key="final"    result={result} awards={awards} build={build} types={simTypes} attrMap={simAttrMap} onReset={handleReset} onBack={handleBack} adsDisabled={adsDisabled} isSalaryMode={isSalaryMode} />,
  ] : [
    <ScreenBuild    key="build"    result={result} build={build} types={simTypes} attrMap={simAttrMap} onNext={advancePage} adsDisabled={adsDisabled} isSalaryMode={isSalaryMode} />,
    <ScreenSeason   key="season"   result={result} awards={awards} onNext={advancePage} adsDisabled={adsDisabled} isAllTime={isAllTime} />,
    <ScreenPlayoffs key="playoffs" result={result} onNext={advancePage} isAllTime={isAllTime} adsDisabled={adsDisabled} />,
    <ScreenGOAT     key="goat"     result={result} awards={awards} onNext={advancePage} onReset={handleReset} onBack={handleGoatBack} adsDisabled={adsDisabled} />,
    <ScreenFinal    key="final"    result={result} awards={awards} build={build} types={simTypes} attrMap={simAttrMap} onReset={handleReset} onBack={handleBack} adsDisabled={adsDisabled} isSalaryMode={isSalaryMode} />,
  ]

  const team      = result?.team
  const teamStyle = team
    ? { '--team-color': team.color, '--team-color2': team.color2 ?? team.color }
    : undefined
  const tr = team
    ? (isAllTime ? (ALLTIME_VISUAL_RATINGS[team.short] ?? null) : (TEAM_VISUAL_RATINGS[team.short] ?? TEAM_RATINGS[team.short] ?? null))
    : null
  const myIsBig  = result?.position === 'big'
  const myIQPhoto = build?.basketballIQ?.photo ?? null

  return (
    <div className="simp-page" style={teamStyle}>
      <div className="simp-col">
        <div className="simp-top-bar">
          {screen > 0 && (
            <button className="simp-back-btn" onClick={() => setScreen(s => s - 1)}>← Back</button>
          )}
          <ProgressDots screen={screen} total={screens.length} />
        </div>

        {team && screens[screen]?.key !== 'goat' && (
          <div className="simp-team-strip">
            <div className="sts-top-row">
              <img src={`/logos/nba/${team.short}.png`} alt={team.short} className="sts-logo" />
              <div className="sts-info">
                <div className="sts-name-wrap">
                  <span className="sts-city">{team.name.split(' ').slice(0, -1).join(' ')}</span>
                  <span className="sts-nickname">{team.name.split(' ').slice(-1)[0]}</span>
                  {isAllTime && <span className="sts-alltime-badge">ALL-TIME ERA</span>}
                </div>
              </div>
              {tr && (
                <div className="sts-grades">
                  <div className="sts-grade-item">
                    <span className="sts-grade-key">OFF</span>
                    <div className="sts-grade-track">
                      <div className="sts-grade-fill" style={{ width: `${offDefMeterPct(tr.off)}%` }} />
                    </div>
                    <span className="sts-grade-badge">{offDefGrade(tr.off)}</span>
                  </div>
                  <div className="sts-grade-item">
                    <span className="sts-grade-key">DEF</span>
                    <div className="sts-grade-track">
                      <div className="sts-grade-fill" style={{ width: `${offDefMeterPct(tr.def)}%` }} />
                    </div>
                    <span className="sts-grade-badge">{offDefGrade(tr.def)}</span>
                  </div>
                </div>
              )}
            </div>
            <TeamStarters teamShort={team.short} teamColor={team.color} isBig={myIsBig} iqPhoto={myIQPhoto} isAllTime={isAllTime} />
          </div>
        )}

        {screens[screen]}
        <div className="simp-footer-disclaimer">Fan-made · Not affiliated with the NBA</div>
      </div>
    </div>
  )
}
