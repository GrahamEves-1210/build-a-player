import { useState, useEffect, useRef, useMemo } from 'react'
import { calcBucketOVR } from '../utils/bucketSimulation'
import { valToGrade } from '../utils/simulation'
import { NBA_TEAMS, GUARD_TYPES, BIG_TYPES, BUCKET_ATTR } from '../data/nba-players'
import QBAvatar from './QBAvatar'
import { BucketModelFigure } from './BucketSimPage'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function gradeColor(val) {
  if (val >= 11) return '#a855f7'
  if (val >= 8)  return '#3b82f6'
  if (val >= 5)  return '#22c55e'
  if (val >= 2)  return '#eab308'
  if (val >= 1)  return '#f97316'
  return '#ef4444'
}

function bestSlot(build) {
  return Object.values(build || {}).filter(Boolean).sort((a, b) => b.val - a.val)[0] ?? null
}

// ─── Build grades — matches report card layout exactly ────────────────────────
function BuildCompact({ build, types }) {
  return (
    <div className="bvr-build-rows">
      {types.map(t => {
        const data = build?.[t]
        const meta = BUCKET_ATTR[t]
        if (!meta) return null
        const displayVal = t === 'size' ? Math.min(11, (data?.val ?? 0) + 1) : (data?.val ?? 0)
        return (
          <div key={t} className="simp-attr-row simp-row-visible bvr-attr-row">
            <QBAvatar
              photo={data?.photo ?? null}
              team={data?.team ?? null}
              color={data?.teamColor ?? null}
              size={36}
              logoDir="/logos/nba/"
              faceCenter={data?.faceCenter}
            />
            <div className="simp-attr-info">
              <span className="simp-attr-name">{meta.label}</span>
              <span className="simp-attr-qb">{data?.qbFull ?? '—'}</span>
            </div>
            <span className="simp-grade-circle" style={{ background: gradeColor(displayVal), color: '#07120a', width: 30, height: 30, minWidth: 30, fontSize: 11 }}>
              {data ? valToGrade(displayVal) : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Play text templates ───────────────────────────────────────────────────────
const T = {
  score2Arc:  n => pick([`${n} pulls up — TWO!`, `${n} step-back — SPLASH!`, `${n} fires — GOOD!`, `${n} spots up — TWO!`]),
  score2Post: n => pick([`${n} backs it down — BUCKET!`, `${n} hook shot — TWO!`, `${n} fadeaway — TWO!`, `${n} drop step — TWO!`]),
  score2Ath:  n => pick([`${n} SLAMS it home!`, `${n} THROWS IT DOWN!`, `${n} skies — FINISH — TWO!`, `${n} DUNKS IT!`]),
  score1:     n => pick([`${n} with the layup.`, `${n} floats it in.`, `${n} off the glass.`, `${n} pull-up — ONE.`]),
  block:      n => pick([`${n} REJECTS IT!`, `${n} PINS IT!`, `${n} — MASSIVE SWAT!`, `${n} STUFFS IT!`]),
  steal:      n => pick([`${n} picks the pocket!`, `${n} reads it — STEAL!`, `${n} swipes it clean!`]),
  miss:       n => pick([`${n} misses.`, `${n} shot rattles out.`, `${n} can't convert.`, `${n} shot short.`]),
  checkup:    () => pick(['Check ball.', 'Ball checked up.', 'Back to top.', 'Check.']),
}

function getScoreType(isArc, position) {
  if (!isArc) return 'score1'
  const r = Math.random()
  if (position === 'big') return r < 0.4 ? 'score2Ath' : 'score2Post'
  return r < 0.28 ? 'score2Ath' : 'score2Arc'
}

// ─── 1v1 First to 11 ──────────────────────────────────────────────────────────
function generate11(myBuild, oppBuild, myPosition, oppPosition, myName, oppName) {
  const GOAL = 11
  const v = (build, attr) => build[attr]?.val ?? 5

  function off(build, pos) {
    if (pos === 'guard')
      return v(build,'finishing')    * 0.28
           + v(build,'jumpShot')     * 0.22
           + v(build,'speed')        * 0.18
           + v(build,'handles')      * 0.16
           + v(build,'bounce')       * 0.12
           + v(build,'basketballIQ') * 0.04
    return   v(build,'finishing')    * 0.30
           + v(build,'size')         * 0.24
           + v(build,'bounce')       * 0.18
           + v(build,'jumpShot')     * 0.14
           + v(build,'speed')        * 0.10
           + v(build,'basketballIQ') * 0.04
  }

  const sizeEdge = (v(myBuild,'size') - v(oppBuild,'size')) / 22
  const mySP  = clamp((off(myBuild,  myPosition)  - 1) / 10 * 0.38 + 0.33 + sizeEdge * 0.05, 0.30, 0.72)
  const oppSP = clamp((off(oppBuild, oppPosition) - 1) / 10 * 0.38 + 0.33 - sizeEdge * 0.05, 0.30, 0.72)
  const my2R  = clamp((v(myBuild,  'jumpShot') - 3) / 8 * 0.42 + 0.14, 0.14, 0.52)
  const opp2R = clamp((v(oppBuild, 'jumpShot') - 3) / 8 * 0.42 + 0.14, 0.14, 0.52)
  const myBlkR  = clamp((v(myBuild,  'size') + (myPosition  === 'big' ? v(myBuild,'interiorDefense')  : v(myBuild,'perimeterDefense')))  / 22 * 0.10 + sizeEdge * 0.02, 0, 0.10)
  const oppBlkR = clamp((v(oppBuild, 'size') + (oppPosition === 'big' ? v(oppBuild,'interiorDefense') : v(oppBuild,'perimeterDefense'))) / 22 * 0.10 - sizeEdge * 0.02, 0, 0.10)
  const myStlR  = myPosition  === 'guard' ? clamp(v(myBuild,'perimeterDefense')  / 11 * 0.07, 0, 0.07) : clamp(v(myBuild,'speed')  / 11 * 0.04, 0, 0.04)
  const oppStlR = oppPosition === 'guard' ? clamp(v(oppBuild,'perimeterDefense') / 11 * 0.07, 0, 0.07) : clamp(v(oppBuild,'speed') / 11 * 0.04, 0, 0.04)

  const plays = []
  let myPts = 0, oppPts = 0, playId = 0
  let turn = 'me'
  const shown = new Set()

  function tryMilestone(isMe, pts) {
    const key = `${isMe ? 'me' : 'opp'}-${pts}`
    if (shown.has(key)) return
    shown.add(key)
    const name = isMe ? myName : oppName
    let txt = null, big = false
    if      (pts === 5)  { txt = `${name} — 5!` }
    else if (pts === 7)  { txt = `${name} with 7 — heating up.` }
    else if (pts === 9)  { txt = `${name} RUNS IT UP — 9!`;        big = true }
    else if (pts === 10) { txt = `GAME POINT — ${name} needs ONE!`; big = true }
    if (!txt) return
    plays.push({ id: playId++, who: null, milestoneFor: isMe ? 'me' : 'opp', type: 'milestone', pts: 0, text: txt, myPts, oppPts, big })
  }

  while (myPts < GOAL && oppPts < GOAL && plays.length < 200) {
    const isMe   = turn === 'me'
    const sp     = isMe ? mySP    : oppSP
    const r2     = isMe ? my2R    : opp2R
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
      const isArc = Math.random() < r2
      const pts   = isArc ? 2 : 1
      const type  = getScoreType(isArc, isMe ? myPosition : oppPosition)
      if (isMe) { myPts  = Math.min(myPts  + pts, GOAL) }
      else      { oppPts = Math.min(oppPts + pts, GOAL) }
      const big = isArc && (type === 'score2Ath' || type === 'score2Post')
      plays.push({ id: playId++, who: turn, type, pts, text: T[type](name), myPts, oppPts, big })
      tryMilestone(isMe, isMe ? myPts : oppPts)
      if (myPts < GOAL && oppPts < GOAL) {
        plays.push({ id: playId++, who: null, type: 'checkup', pts: 0, text: T.checkup(), myPts, oppPts })
      }
    } else {
      plays.push({ id: playId++, who: turn, type: 'miss', pts: 0, text: T.miss(name), myPts, oppPts })
      changeTurn = true
    }

    if (changeTurn) {
      if (myPts < GOAL && oppPts < GOAL) {
        plays.push({ id: playId++, who: null, type: 'checkup', pts: 0, text: T.checkup(), myPts, oppPts })
      }
      turn = isMe ? 'opp' : 'me'
    }
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
  return <span className={`bvr-score-num${flash ? ' bvr-score-flash' : ''}`} style={{ color }}>{value}</span>
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, color, reverse = false }) {
  const w = `${Math.min(100, (value / 11) * 100)}%`
  return (
    <div className="bvr-prog-track">
      <div className="bvr-prog-fill" style={{
        width: w,
        background: color,
        marginLeft: reverse ? 'auto' : undefined,
      }} />
    </div>
  )
}

// ─── Half-Court — hardwood SVG + QBAvatar circles ─────────────────────────────
// SVG viewBox 300×280, basket at top. Player positions as % of court dimensions.
// State shape: { x, y, dur } — dur drives the CSS transition duration inline.
function CourtVisual({ play, myColor, oppColor, myName, oppName, possession, mySlot, oppSlot }) {
  const [myPct,        setMyPct]        = useState({ x: 38, y: 87, dur: 0.65 })
  const [oppPct,       setOppPct]       = useState({ x: 62, y: 87, dur: 0.65 })
  const [scoreFlash,   setScoreFlash]   = useState(null)
  const [ballOverride, setBallOverride] = useState(null)
  const timersRef = useRef([])
  const flashRef  = useRef(null)

  const rnd   = (lo, hi) => lo + Math.random() * (hi - lo)
  const pPick = arr => arr[Math.floor(Math.random() * arr.length)]
  const mv = (setter, x, y, dur = 0.52) => setter({ x, y, dur })

  function clearTimers() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    clearTimeout(flashRef.current)
    setBallOverride(null)
  }
  function after(ms, fn) {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
  }

  // Zones as % — rim ≈ y=10%, free-throw line ≈ y=43%, arc bottom ≈ y=59%
  const ARC3  = [
    { x: 18, y: 52 }, { x: 82, y: 52 },  // wings (outside arc)
    { x:  8, y: 24 }, { x: 92, y: 24 },  // corners (near baseline)
    { x: 50, y: 63 },                      // top of arc
  ]
  const PAINT = [
    { x: 37, y: 16 }, { x: 63, y: 16 },  // left/right block
    { x: 50, y: 13 }, { x: 39, y: 26 }, { x: 61, y: 26 }, // rim, mid-paint
  ]
  const DEF  = [{ x: 46, y: 32 }, { x: 54, y: 32 }, { x: 50, y: 26 }]
  const MID  = [{ x: 36, y: 66 }, { x: 64, y: 66 }, { x: 50, y: 60 }]

  useEffect(() => {
    if (!play) return
    clearTimers()

    if (play.type === 'checkup') {
      // Carrier holds ball at top of key; defender sits above (between them and basket)
      if (possession === 'me') {
        mv(setMyPct,  50, 78, 0.85)
        mv(setOppPct, 50, 67, 0.85)
      } else {
        mv(setOppPct, 50, 78, 0.85)
        mv(setMyPct,  50, 67, 0.85)
      }
      return
    }
    if (play.type === 'milestone') return

    const isMe   = play.who === 'me'
    const setOff = isMe ? setMyPct : setOppPct
    const setDef = isMe ? setOppPct : setMyPct

    if (play.pts === 2) {
      const isAth  = play.type === 'score2Ath'
      const isPost = play.type === 'score2Post'
      const finalOff = pPick(isAth || isPost ? PAINT : ARC3)
      const defGuard = pPick(DEF)

      if (isAth) {
        // DUNK — explosive two-cut drive to rim
        const entry  = pPick(MID)
        const goDir  = Math.random() < 0.5 ? -1 : 1
        const cutPt  = { x: finalOff.x + goDir * rnd(10, 18), y: finalOff.y + rnd(12, 20) }
        mv(setOff, entry.x, entry.y, 0.42)
        mv(setDef, defGuard.x, defGuard.y, 0.55)
        after(380, () => {
          mv(setOff, cutPt.x, cutPt.y, 0.22)
          mv(setDef, cutPt.x + goDir * rnd(4,9), cutPt.y + rnd(5,12), 0.38)
        })
        after(590, () => {
          mv(setOff, finalOff.x, finalOff.y, 0.26)
          setBallOverride({ x: 50, y: 11 })         // ball jams at rim
          setScoreFlash(play.who)
          flashRef.current = setTimeout(() => setScoreFlash(null), 1000)
        })
        after(1150, () => setBallOverride(null))

      } else if (isPost) {
        // POST — back-down in two steps, drop step / hook
        const highPost = { x: finalOff.x + rnd(-12, 12), y: finalOff.y + rnd(22, 32) }
        const midPost  = { x: finalOff.x + rnd(-5, 5),   y: finalOff.y + rnd(10, 18) }
        mv(setOff, highPost.x, highPost.y, 0.62)
        mv(setDef, finalOff.x + rnd(-4,4), finalOff.y - rnd(2,8), 0.58)
        after(590, () => {
          mv(setOff, midPost.x, midPost.y, 0.50)
          mv(setDef, midPost.x + rnd(-3,3), midPost.y - rnd(3,8), 0.52)
        })
        after(1060, () => {
          mv(setOff, finalOff.x, finalOff.y, 0.32)
          setBallOverride({ x: 50, y: 11 })         // ball arcs to hoop
          setScoreFlash(play.who)
          flashRef.current = setTimeout(() => setScoreFlash(null), 1000)
        })
        after(1600, () => setBallOverride(null))

      } else {
        // ARC — pull-up / step-back: approach → crossover → step back → launch
        const approach = { x: finalOff.x + rnd(-8, 8), y: finalOff.y + rnd(16, 26) }
        const goDir    = Math.random() < 0.5 ? -1 : 1
        const cross    = { x: approach.x + goDir * rnd(12, 20), y: approach.y + rnd(-5, 5) }
        mv(setOff, approach.x, approach.y, 0.50)
        mv(setDef, defGuard.x, defGuard.y, 0.50)
        after(450, () => {
          mv(setOff, cross.x, cross.y, 0.24)
          mv(setDef, cross.x + goDir * rnd(4,10), cross.y, 0.32)
        })
        after(860, () => {
          mv(setOff, finalOff.x, finalOff.y, 0.38)  // step back to arc → release
          mv(setDef, finalOff.x - goDir * rnd(5,14), finalOff.y + rnd(5,12), 0.52)
          setBallOverride({ x: 50, y: 11 })          // ball launches toward hoop
          setScoreFlash(play.who)
          flashRef.current = setTimeout(() => setScoreFlash(null), 1000)
        })
        after(1450, () => setBallOverride(null))
      }

    } else if (play.pts === 1) {
      // LAYUP — jab step gets defender leaning → quick first step → finish
      const rimSpot = pPick([PAINT[0], PAINT[1], { x: 44, y: 15 }, { x: 56, y: 15 }])
      const jabDir  = Math.random() < 0.5 ? -1 : 1
      const jabPt   = { x: rimSpot.x + jabDir * rnd(12, 20), y: rimSpot.y + rnd(22, 34) }
      const lanePt  = { x: rimSpot.x + rnd(-6, 6),           y: rimSpot.y + rnd(10, 18) }
      mv(setOff, jabPt.x, jabPt.y, 0.30)
      mv(setDef, rimSpot.x - jabDir * rnd(5,12), rimSpot.y - rnd(2,8), 0.42)
      after(310, () => {
        mv(setOff, lanePt.x, lanePt.y, 0.24)
        mv(setDef, rimSpot.x + jabDir * rnd(2,6), rimSpot.y - rnd(2,6), 0.35)
      })
      after(520, () => {
        mv(setOff, rimSpot.x, rimSpot.y, 0.26)
        setBallOverride({ x: 50, y: 11 })            // ball at rim on finish
        setScoreFlash(play.who)
        flashRef.current = setTimeout(() => setScoreFlash(null), 800)
      })
      after(1000, () => setBallOverride(null))

    } else if (play.type === 'block') {
      // BLOCK — off drives hard, def times jump and pins it
      const rimArea  = { x: 50 + rnd(-8, 8),   y: 20 + rnd(-4, 4) }
      const drivePt  = { x: rimArea.x + rnd(-12, 12), y: rimArea.y + rnd(20, 30) }
      const defStart = { x: 50 + rnd(-18, 18), y: 34 + rnd(-6, 6) }
      mv(setOff, drivePt.x, drivePt.y, 0.40)        // off drives
      mv(setDef, defStart.x, defStart.y, 0.50)       // def retreats to rim
      after(400, () => {
        mv(setOff, rimArea.x, rimArea.y, 0.26)       // off at rim going up
        mv(setDef, rimArea.x + rnd(-3,3), rimArea.y - rnd(2,6), 0.20) // def times it perfectly
      })

    } else if (play.type === 'steal') {
      // STEAL — def reads the dribble, pokes from the side
      const cx = 50 + rnd(-18, 18), cy = 58 + rnd(-10, 10)
      const defApp = isMe
        ? { x: cx + rnd(12, 22), y: cy + rnd(-5, 5) }
        : { x: cx - rnd(12, 22), y: cy + rnd(-5, 5) }
      mv(setOff, cx + (isMe ? -5 : 5), cy, 0.45)     // off dribbling
      mv(setDef, defApp.x, defApp.y, 0.45)            // def closing in hard
      after(420, () => {
        mv(setOff, cx, cy, 0.22)                       // off hesitates — stripped
        mv(setDef, cx + (isMe ? 4 : -4), cy, 0.20)    // def pokes
      })
      after(620, () => {
        const escape = isMe
          ? { x: cx + rnd(16, 24), y: cy - rnd(8, 16) }
          : { x: cx - rnd(16, 24), y: cy - rnd(8, 16) }
        mv(setDef, escape.x, escape.y, 0.28)           // def separates with ball
      })

    } else if (play.type === 'miss') {
      // MISS — drive with hesitation, defender gets a hand in the face
      const off  = { x: 50 + rnd(-22, 22), y: 30 + rnd(-8, 8) }
      const dfe  = { x: off.x + rnd(-6, 6), y: off.y - rnd(3, 8) }
      const app  = { x: off.x + rnd(-8, 8), y: off.y + rnd(16, 26) }
      const goDir = Math.random() < 0.5 ? -1 : 1
      const hes  = { x: off.x + goDir * rnd(8, 14), y: off.y + rnd(6, 14) }
      mv(setOff, app.x, app.y, 0.50)                  // drive
      mv(setDef, dfe.x + goDir * rnd(6,12), dfe.y, 0.52) // def slides with off
      after(460, () => {
        mv(setOff, hes.x, hes.y, 0.28)                 // hesitation dribble
        mv(setDef, dfe.x, dfe.y, 0.30)                 // def slides back
      })
      after(730, () => {
        mv(setOff, off.x, off.y, 0.35)                 // pull up, miss
      })
    }
    return clearTimers
  }, [play]) // eslint-disable-line

  const isCheckup  = play?.type === 'checkup'
  const carrierPct = possession === 'me' ? myPct : oppPct
  // Ball override during shots; otherwise follows carrier or floats on checkup
  const ballPct = ballOverride
    ?? (isCheckup
      ? { x: 50, y: 76 }
      : { x: possession === 'me' ? myPct.x + 7 : oppPct.x - 7,
          y: possession === 'me' ? myPct.y - 6  : oppPct.y - 6 })
  const EASE   = 'cubic-bezier(0.25,0.82,0.42,1)'
  const myTr   = `left ${myPct.dur}s ${EASE}, top ${myPct.dur}s ${EASE}`
  const oppTr  = `left ${oppPct.dur}s ${EASE}, top ${oppPct.dur}s ${EASE}`
  const ballTr = ballOverride
    ? `left 0.28s ease-in, top 0.28s ease-in`
    : isCheckup
    ? `left 0.85s ${EASE}, top 0.85s ${EASE}`
    : `left ${carrierPct.dur}s ${EASE}, top ${carrierPct.dur}s ${EASE}`

  return (
    <div className="bvr-court-wrap">
      <div className="bvr-court-aspect">

        {/* SVG: hardwood floor + proper court markings */}
        <svg className="bvr-court-svg" viewBox="0 0 300 280" preserveAspectRatio="xMidYMid meet">
          {/* Hardwood floor */}
          <rect width="300" height="280" fill="#2e1d0e" rx="6"/>
          {[22,38,54,70,86,102,118,134,150,166,182,198,214,230,246,262].map(y => (
            <line key={y} x1={0} y1={y} x2={300} y2={y} stroke="rgba(255,200,100,0.035)" strokeWidth={1}/>
          ))}
          {/* Outer boundary */}
          <rect x={6} y={6} width={288} height={268} fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth={2.5}/>
          {/* Paint */}
          <rect x={105} y={6} width={90} height={115} fill="#231508" stroke="rgba(255,255,255,0.62)" strokeWidth={1.8}/>
          {/* Lane lines */}
          <line x1={120} y1={6} x2={120} y2={121} stroke="rgba(255,255,255,0.22)" strokeWidth={1}/>
          <line x1={180} y1={6} x2={180} y2={121} stroke="rgba(255,255,255,0.22)" strokeWidth={1}/>
          {/* Hash marks */}
          {[44,64,84,104].map(y => (
            <g key={y}>
              <line x1={105} y1={y} x2={120} y2={y} stroke="rgba(255,255,255,0.32)" strokeWidth={1.5}/>
              <line x1={180} y1={y} x2={195} y2={y} stroke="rgba(255,255,255,0.32)" strokeWidth={1.5}/>
            </g>
          ))}
          {/* Free-throw line */}
          <line x1={105} y1={121} x2={195} y2={121} stroke="rgba(255,255,255,0.65)" strokeWidth={2}/>
          {/* Free-throw circle */}
          <circle cx={150} cy={121} r={36} fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth={1.8}/>
          {/* 3-pt arc — r=137, centered on basket (150,28); corners at x=23/277 */}
          <path d="M 23,79 A 137,137 0 0,1 277,79" fill="none" stroke="rgba(255,255,255,0.68)" strokeWidth={2}/>
          {/* Corner 3 lines — baseline to arc start */}
          <line x1={23}  y1={6}  x2={23}  y2={79} stroke="rgba(255,255,255,0.68)" strokeWidth={2}/>
          <line x1={277} y1={6}  x2={277} y2={79} stroke="rgba(255,255,255,0.68)" strokeWidth={2}/>
          {/* Half-court line */}
          <line x1={6} y1={274} x2={294} y2={274} stroke="rgba(255,255,255,0.52)" strokeWidth={2}/>
          {/* Restricted area */}
          <path d="M 126,28 A 24,24 0 0,1 174,28" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth={1.5}/>
          {/* Backboard */}
          <line x1={127} y1={10} x2={173} y2={10} stroke="rgba(255,255,255,0.92)" strokeWidth={4} strokeLinecap="round"/>
          {/* Rim — 4px higher */}
          <circle cx={150} cy={28} r={13} fill="none" stroke="#f97316" strokeWidth={3.5}/>
          {/* Score ripple */}
          {scoreFlash && (
            <circle cx={150} cy={28} r={14} fill={scoreFlash === 'me' ? myColor : oppColor} opacity={0.9}>
              <animate attributeName="r" values="14;110" dur="0.7s" fill="freeze"/>
              <animate attributeName="opacity" values="0.9;0" dur="0.7s" fill="freeze"/>
            </circle>
          )}
        </svg>

        {/* HTML overlay: ball + QBAvatar player circles */}
        <div className="bvr-court-overlay">

          {/* Ball */}
          <div className="bvr-ball-div" style={{ left: `${ballPct.x}%`, top: `${ballPct.y}%`, transition: ballTr }}>🏀</div>

          {/* My player */}
          <div className="bvr-pa" style={{ left: `${myPct.x}%`, top: `${myPct.y}%`, transition: myTr }}>
            <div className={`bvr-pa-ring${possession === 'me' ? ' bvr-pa-ring--ball' : ''}`} style={{
              '--pc': myColor,
              boxShadow: possession === 'me'
                ? `0 0 0 4px ${myColor}, 0 0 20px ${myColor}aa, 0 0 6px ${myColor}`
                : `0 0 0 1px ${myColor}33`,
            }}>
              <QBAvatar photo={mySlot?.photo ?? null} team={mySlot?.team ?? null}
                color={null} size={48} logoDir="/logos/nba/" faceCenter={mySlot?.faceCenter} />
            </div>
            <span className="bvr-pa-label" style={{ color: myColor }}>{(myName || 'ME').substring(0, 8)}</span>
          </div>

          {/* Opponent */}
          <div className="bvr-pa" style={{ left: `${oppPct.x}%`, top: `${oppPct.y}%`, transition: oppTr }}>
            <div className={`bvr-pa-ring${possession === 'opp' ? ' bvr-pa-ring--ball' : ''}`} style={{
              '--pc': oppColor,
              boxShadow: possession === 'opp'
                ? `0 0 0 4px ${oppColor}, 0 0 20px ${oppColor}aa, 0 0 6px ${oppColor}`
                : `0 0 0 1px ${oppColor}33`,
            }}>
              <QBAvatar photo={oppSlot?.photo ?? null} team={oppSlot?.team ?? null}
                color={null} size={48} logoDir="/logos/nba/" faceCenter={oppSlot?.faceCenter} />
            </div>
            <span className="bvr-pa-label" style={{ color: oppColor }}>{(oppName || 'OPP').substring(0, 8)}</span>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BucketVersusResult({ myData, oppData, position, oppPosition, role, channel, versusGame, onRematch, onExit, onResult, user }) {
  const [phase,           setPhase]           = useState('reveal')
  const [playIdx,         setPlayIdx]         = useState(-1)
  const [game,            setGame]            = useState(null)
  const [winner,          setWinner]          = useState(null)
  const [possession,      setPossession]      = useState('me')
  const [myRematchReady,  setMyRematchReady]  = useState(false)
  const [oppRematchReady, setOppRematchReady] = useState(false)
  const [oppExited,       setOppExited]       = useState(false)
  const feedRef     = useRef(null)
  const resultFired = useRef(false)

  const myTypes  = position    === 'big' ? BIG_TYPES : GUARD_TYPES
  const oppTypes = (oppPosition ?? position) === 'big' ? BIG_TYPES : GUARD_TYPES
  const myOVR    = calcBucketOVR(myData.build,  myTypes,  position)
  const oppOVR   = calcBucketOVR(oppData.build, oppTypes, oppPosition ?? position)

  const myName  = myData.name  || (user ? (user.user_metadata?.username || user.email?.split('@')[0]) : 'You')
  const oppName = oppData.name || 'Opponent'

  const myTeamData  = NBA_TEAMS.find(t => t.short === myData.player?.team)
  const oppTeamData = NBA_TEAMS.find(t => t.short === oppData.player?.team)
  const myColor     = myTeamData?.color  || '#ef4444'
  const oppColor    = oppTeamData?.color || '#3b82f6'
  const myTeamFull  = myTeamData?.name   || myData.player?.team  || ''
  const oppTeamFull = oppTeamData?.name  || oppData.player?.team || ''

  const myBestSlot  = useMemo(() => bestSlot(myData.build),  [myData.build])
  const oppBestSlot = useMemo(() => bestSlot(oppData.build), [oppData.build])
  // Face slot: the player whose photo represents the build (basketballIQ = build identity)
  const myFaceSlot  = myData.build?.['basketballIQ']?.photo  ? myData.build['basketballIQ']  : myBestSlot
  const oppFaceSlot = oppData.build?.['basketballIQ']?.photo ? oppData.build['basketballIQ'] : oppBestSlot

  // Play text names — use last name of top build player for non-logged users
  const lastName    = full => full ? full.trim().split(/\s+/).pop() : null
  const myPlayName  = (myName  && myName  !== 'You')      ? myName  : (lastName(myBestSlot?.qbFull)  ?? 'Player')
  const oppPlayName = (oppName && oppName !== 'Opponent') ? oppName : (lastName(oppBestSlot?.qbFull) ?? 'Player')

  // Generate game
  useEffect(() => {
    if (role !== 'guest') {
      const gameData = generate11(myData.build, oppData.build, position, oppPosition ?? position, myPlayName, oppPlayName)
      setGame(gameData)
      if (role === 'host' && channel) {
        channel.send({ type: 'broadcast', event: 'bab_game', payload: gameData }).catch?.(() => {})
      }
      return
    }
    const fallback = setTimeout(() => {
      setGame(prev => prev || generate11(myData.build, oppData.build, position, oppPosition ?? position, myPlayName, oppPlayName))
    }, 3000)
    return () => clearTimeout(fallback)
  }, []) // eslint-disable-line

  useEffect(() => {
    if (role !== 'guest' || !versusGame) return
    setGame(versusGame)
  }, [role, versusGame])

  useEffect(() => {
    if (!channel) return
    channel.on('broadcast', { event: 'bab_rematch' }, () => setOppRematchReady(true))
    channel.on('broadcast', { event: 'bab_exit' },    () => setOppExited(true))
  }, [channel])

  useEffect(() => {
    if (myRematchReady && oppRematchReady) onRematch?.()
  }, [myRematchReady, oppRematchReady])

  function handleRematch() {
    if (!channel) { onRematch?.(); return }
    if (myRematchReady) return
    setMyRematchReady(true)
    channel.send({ type: 'broadcast', event: 'bab_rematch', payload: {} }).catch?.(() => {})
  }

  function handleExit() {
    if (myRematchReady && channel) {
      channel.send({ type: 'broadcast', event: 'bab_exit', payload: {} }).catch?.(() => {})
    }
    onExit?.()
  }

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
      const result = last.myPts >= 11 ? 'me' : 'opp'
      setWinner(result)
      if (!resultFired.current) {
        resultFired.current = true
        onResult?.(result === 'me' ? 'win' : 'loss')
      }
      const t = setTimeout(() => setPhase('result'), 2200)
      return () => clearTimeout(t)
    }
    const next  = game.plays[playIdx + 1]
    const delay = next.type === 'checkup'                                                          ? 3200
                : next.type === 'milestone'                                                        ? (next.big ? 2600 : 1800)
                : next.type === 'block'                                                            ? 2000
                : next.type === 'steal'                                                            ? 1800
                : next.pts === 2 && (next.type === 'score2Ath' || next.type === 'score2Post')      ? 2400
                : next.pts === 2                                                                   ? 1900
                : next.pts === 1                                                                   ? 1500
                : next.type === 'miss'                                                             ? 1200
                : 1600
    const t = setTimeout(() => {
      setPlayIdx(i => i + 1)
      const p = next
      if (p.pts > 0)                                        setPossession(p.who)
      else if (p.type === 'steal' || p.type === 'block')   setPossession(p.who)
      else if (p.type === 'miss')                           setPossession(p.who === 'me' ? 'opp' : 'me')
    }, delay)
    return () => clearTimeout(t)
  }, [phase, playIdx, game])

  useEffect(() => {
    if (phase === 'result') window.ramp?.que?.push(() => { window.ramp.spaNewPage() })
  }, [phase])

  const cur      = game?.plays[playIdx]
  const myScore  = cur?.myPts  ?? 0
  const oppScore = cur?.oppPts ?? 0

  const feedPlays = useMemo(() => {
    if (!game) return []
    return game.plays
      .slice(0, Math.max(0, playIdx + 1))
      .filter(p => p.type !== 'milestone' && p.type !== 'checkup')
      .slice(-5)
      .reverse()
  }, [game, playIdx])

  const milestone = (cur?.type === 'milestone') ? cur : null

  // ── Reveal ───────────────────────────────────────────────────────────────────
  if (phase === 'reveal') {
    return (
      <div className="versus-result bvr-reveal">
        <div className="vr-header">
          <span className="vr-header-label">HEAD TO HEAD</span>
        </div>
        <div className="vr-grid">
          <div className="vr-side bvr-reveal-side" style={{ animationDelay: '0.1s' }}>
            <div className="vr-you-tag">YOU</div>
            <BucketModelFigure
              build={myData.build}
              team={myTeamData}
              className="bvr-reveal-model"
            />
            <div className="vr-player-name">{myBestSlot?.qbFull ?? myName}</div>
            <div className="vr-team-name" style={{ color: myColor }}>{myTeamFull}</div>
            <div className="vr-ovr-badge">{myOVR} <span className="vr-ovr-label">OVR</span></div>
          </div>
          <div className="vr-vs-col">
            <div className="bvr-tipoff-text">FIRST<br/>TO<br/>11</div>
          </div>
          <div className="vr-side bvr-reveal-side" style={{ animationDelay: '0.25s' }}>
            <div className="vr-you-tag">{oppName}</div>
            <BucketModelFigure
              build={oppData.build}
              team={oppTeamData}
              className="bvr-reveal-model bvr-reveal-model--flip"
            />
            <div className="vr-player-name">{oppBestSlot?.qbFull ?? oppName}</div>
            <div className="vr-team-name" style={{ color: oppColor }}>{oppTeamFull}</div>
            <div className="vr-ovr-badge">{oppOVR} <span className="vr-ovr-label">OVR</span></div>
          </div>
        </div>
        <div id="ramp-cntr1-bvr-reveal" className="bvr-ad-slot" />
      </div>
    )
  }

  // ── Live ──────────────────────────────────────────────────────────────────────
  if (phase === 'live') {
    const myLead  = myScore > oppScore
    const oppLead = oppScore > myScore
    return (
      <div className="bvr-live">

        {/* Scoreboard */}
        <div className="bvr-board bvr-board--11">
          <div className="bvr-board-team bvr-board-team--me">
            <div className="bvr-board-player">
              <QBAvatar photo={myBestSlot?.photo ?? null} team={myBestSlot?.team ?? null}
                color={null} size={22} logoDir="/logos/nba/" faceCenter={myBestSlot?.faceCenter} />
              <span className="bvr-board-name" style={{ color: myColor }}>{myName}</span>
            </div>
            <ScoreDigit
              value={myScore}
              color={myLead ? myColor : myScore === oppScore ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.28)'}
            />
          </div>
          <div className="bvr-board-mid">
            <div className="bvr-eleven-label">FIRST TO 11</div>
            <div className="bvr-live-dot"><span className="bvr-pulse" />LIVE</div>
          </div>
          <div className="bvr-board-team bvr-board-team--opp">
            <ScoreDigit
              value={oppScore}
              color={oppLead ? oppColor : oppScore === myScore ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.28)'}
            />
            <div className="bvr-board-player bvr-board-player--opp">
              <span className="bvr-board-name" style={{ color: oppColor }}>{oppName}</span>
              <QBAvatar photo={oppBestSlot?.photo ?? null} team={oppBestSlot?.team ?? null}
                color={null} size={22} logoDir="/logos/nba/" faceCenter={oppBestSlot?.faceCenter} />
            </div>
          </div>
        </div>

        {/* Progress toward 11 + possession indicator */}
        <div className="bvr-progress-row">
          <ProgressBar value={myScore}  color={myColor} />
          <div className="bvr-poss-pip" style={{ background: possession === 'me' ? myColor : oppColor }} />
          <ProgressBar value={oppScore} color={oppColor} reverse />
        </div>

        <CourtVisual
          play={cur}
          myColor={myColor}   oppColor={oppColor}
          myName={myName}     oppName={oppName}
          possession={possession}
          mySlot={myBestSlot} oppSlot={oppBestSlot}
        />

        {milestone && (
          <div className={`bvr-banner bvr-banner--milestone${milestone.big ? ' bvr-banner--big' : ''}`}>
            <span className="bvr-banner-label">{milestone.text}</span>
            <span className="bvr-banner-score">{myScore} — {oppScore}</span>
          </div>
        )}

        {cur?.type === 'checkup' && (
          <div className="bvr-checkup-banner">
            <div className="bvr-checkup-icon" />
            <span className="bvr-checkup-txt">CHECK BALL</span>
            <div className="bvr-checkup-icon" />
          </div>
        )}

        {/* Play-by-play feed */}
        <div className="bvr-feed" ref={feedRef}>
          {feedPlays.map((p, i) => {
            const isScore = p.pts > 0
            const isMiss  = p.type === 'miss'
            const isEvent = p.type === 'block' || p.type === 'steal'
            const dotColor = p.who === 'me' ? myColor : oppColor
            return (
              <div
                key={p.id}
                className={`bvr-play bvr-play--${p.who ?? 'marker'}${p.big ? ' bvr-play--big' : ''}${isMiss ? ' bvr-play--miss' : ''}${isEvent ? ' bvr-play--event' : ''}`}
                style={{ opacity: i === 0 ? 1 : 1 - i * 0.14, borderLeftColor: p.who ? dotColor : 'transparent' }}
              >
                {p.who && (
                  <QBAvatar
                    photo={p.who === 'me' ? myFaceSlot?.photo ?? null : oppFaceSlot?.photo ?? null}
                    team={p.who === 'me' ? myFaceSlot?.team ?? null  : oppFaceSlot?.team ?? null}
                    color={null} size={24} logoDir="/logos/nba/"
                    faceCenter={p.who === 'me' ? myFaceSlot?.faceCenter : oppFaceSlot?.faceCenter}
                  />
                )}
                <span className="bvr-play-text">{p.text}</span>
                {isScore && (
                  <span className="bvr-play-pts" style={{ color: p.pts === 2 ? dotColor : 'rgba(255,255,255,0.45)' }}>
                    +{p.pts}
                  </span>
                )}
                {isEvent && (
                  <span className="bvr-play-badge" style={{ color: dotColor, background: `${dotColor}18` }}>
                    {p.type === 'block' ? 'BLK' : 'STL'}
                  </span>
                )}
              </div>
            )
          })}
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

  // ── Result ────────────────────────────────────────────────────────────────────
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
        <div className="bvr-result-flavor">1v1 · First to 11</div>
      </div>

      <div className="vr-game-score">
        <span style={{ color: isWin  ? '#fff' : 'rgba(255,255,255,0.3)' }}>{finalMy}</span>
        <span className="vr-gs-dash">–</span>
        <span style={{ color: !isWin ? '#fff' : 'rgba(255,255,255,0.3)' }}>{finalOpp}</span>
      </div>

      <div className="vr-grid bvr-result-grid">
        <div className={`vr-side ${isWin ? 'vr-side--winner' : 'vr-side--loser'}`}>
          <div className="vr-you-tag">{myName}</div>
          <div className="vr-ovr-badge" style={{ marginBottom: 8 }}>{myOVR} <span className="vr-ovr-label">OVR</span></div>
          <BuildCompact build={myData.build} types={myTypes} />
        </div>

        <div className="vr-vs-col">
          <div className={`vr-result-icon ${isWin ? 'vr-result-icon--win' : 'vr-result-icon--loss'}`}>
            {isWin ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            )}
          </div>
        </div>

        <div className={`vr-side ${!isWin ? 'vr-side--winner' : 'vr-side--loser'}`}>
          <div className="vr-you-tag">{oppName}</div>
          <div className="vr-ovr-badge" style={{ marginBottom: 8 }}>{oppOVR} <span className="vr-ovr-label">OVR</span></div>
          <BuildCompact build={oppData.build} types={oppTypes} />
        </div>
      </div>

      <div className="vr-actions">
        {channel ? (
          oppExited ? (
            <div className="vr-opp-exited">Opponent left — match over.</div>
          ) : myRematchReady ? (
            <button className="vr-btn vr-btn--primary vr-btn--waiting" disabled>
              Waiting for {oppName}…
            </button>
          ) : (
            <button className="vr-btn vr-btn--primary" onClick={handleRematch}>REMATCH</button>
          )
        ) : (
          <button className="vr-btn vr-btn--primary" onClick={handleRematch}>REMATCH</button>
        )}
        <button className="vr-btn" onClick={handleExit}>EXIT</button>
      </div>
    </div>
  )
}
