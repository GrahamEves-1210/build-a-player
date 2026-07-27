import { useState, useEffect, useRef, useMemo } from 'react'
import { calcBucketOVR } from '../utils/bucketSimulation'
import { valToGrade } from '../utils/simulation'
import { NBA_TEAMS, VERSUS_GUARD_TYPES, VERSUS_BIG_TYPES, BUCKET_ATTR } from '../data/nba-players'
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
function BuildCompact({ build, types, position = 'guard' }) {
  const versusTypes = position === 'big' ? VERSUS_BIG_TYPES : VERSUS_GUARD_TYPES
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
              <span className="simp-attr-qb">
                {data?.qbFull ?? '—'}
              </span>
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
  score2Arc:   n => pick([`${n} pulls up — TWO!`, `${n} step-back — SPLASH!`, `${n} fires — GOOD!`, `${n} spots up — TWO!`, `${n} catch and shoot — GOOD!`]),
  score1Post:  n => pick([`${n} backs it down — bucket.`, `${n} hook shot — one.`, `${n} fadeaway — ONE.`, `${n} drop step — one.`]),
  score1Ath:   n => pick([`${n} SLAMS it home!`, `${n} THROWS IT DOWN!`, `${n} skies — FINISH!`, `${n} DUNKS IT!`]),
  score1Mid:   n => pick([`${n} — mid range.`, `${n} pull-up — one.`, `${n} hits the mid.`, `${n} step-back mid.`]),
  score1Elbow: n => pick([`${n} — elbow J.`, `${n} turnaround — ONE.`, `${n} elbow fadeaway.`, `${n} posts and fades.`]),
  score1:      n => pick([`${n} with the layup.`, `${n} floats it in.`, `${n} off the glass.`, `${n} scoops it up.`, `${n} finger roll — one.`]),
  block:       n => pick([`${n} REJECTS IT!`, `${n} PINS IT!`, `${n} — MASSIVE SWAT!`, `${n} STUFFS IT!`]),
  steal:       n => pick([`${n} picks the pocket!`, `${n} reads it — STEAL!`, `${n} swipes it clean!`]),
  miss:        n => pick([`${n} misses.`, `${n} shot rattles out.`, `${n} can't convert.`, `${n} shot short.`]),
  miss2:       n => pick([`${n} — step-back no good.`, `${n} pull-up rattles out.`, `${n} fires from deep — off.`, `${n} three is no good.`]),
  checkup:     () => pick(['Check ball.', 'Ball checked up.', 'Back to top.', 'Check.']),
}

// Play type: arc=2pt pull-up; inside splits into dunk/post/mid/elbow/layup based on build
function getScoreType(isArc, position, build) {
  if (isArc) return 'score2Arc'
  const bounce    = build?.bounce?.val    ?? 5
  const finishing = build?.finishing?.val ?? 5
  const size      = build?.size?.val      ?? 5
  const jumpShot  = build?.jumpShot?.val  ?? 5
  // Elbow post-up: bigs only — size + jumpShot
  if (position === 'big') {
    const elbowProb = clamp((size + jumpShot - 8) / 14 * 0.28, 0, 0.28)
    if (Math.random() < elbowProb) return 'score1Elbow'
  }
  // Mid-range pull-up: jumpShot-driven
  const midProb = clamp((jumpShot - 4) / 7 * 0.24, 0, 0.24)
  if (Math.random() < midProb) return 'score1Mid'
  // Dunk: bounce × finishing
  const dunkProb = clamp((bounce - 1) * (finishing - 1) / 80 * 0.68, 0, 0.62)
  if (Math.random() < dunkProb) return 'score1Ath'
  // Post: size-driven; bigs dominant, guards only with elite size
  const postProb = position === 'big'
    ? clamp((size - 2) / 9 * 0.55 + 0.15, 0.15, 0.65)
    : clamp((size - 6) / 5 * 0.15, 0, 0.13)
  if (Math.random() < postProb) return 'score1Post'
  return 'score1'  // layup / floater
}

// ─── Game constants (computed once from builds) ───────────────────────────────
function computeGameConsts(myBuild, oppBuild, myPosition, oppPosition, myName, oppName) {
  const v = (build, attr) => build[attr]?.val ?? 5

  function offVersus(build, pos) {
    if (pos === 'guard')
      return v(build,'finishing')    * 0.24
           + v(build,'handles')      * 0.22
           + v(build,'speed')        * 0.18
           + v(build,'jumpShot')     * 0.16
           + v(build,'bounce')       * 0.12
           + v(build,'basketballIQ') * 0.08
    return   v(build,'finishing')    * 0.28
           + v(build,'size')         * 0.20
           + v(build,'playmaking')   * 0.18
           + v(build,'bounce')       * 0.16
           + v(build,'jumpShot')     * 0.10
           + v(build,'speed')        * 0.04
           + v(build,'interiorDefense') * 0.02
           + v(build,'basketballIQ') * 0.02
  }

  const sizeEdge  = (v(myBuild,'size')  - v(oppBuild,'size'))  / 22
  const speedEdge = (v(myBuild,'speed') - v(oppBuild,'speed')) / 22
  const mySP  = clamp((offVersus(myBuild,  myPosition)  - 1) / 10 * 0.38 + 0.33 + sizeEdge * 0.05, 0.30, 0.72)
  const oppSP = clamp((offVersus(oppBuild, oppPosition) - 1) / 10 * 0.38 + 0.33 - sizeEdge * 0.05, 0.30, 0.72)
  // Inside-only: taller/faster = bonus only, never a penalty for the smaller/slower side
  const mySizeAdv   = Math.max(0, sizeEdge)
  const oppSizeAdv  = Math.max(0, -sizeEdge)
  const mySpeedAdv  = Math.max(0, speedEdge)
  const oppSpeedAdv = Math.max(0, -speedEdge)
  const myInsideSP  = clamp(mySP  + mySizeAdv  * (0.38 + mySizeAdv  * 0.70) + mySpeedAdv  * 0.18, 0.25, 0.88)
  const oppInsideSP = clamp(oppSP + oppSizeAdv * (0.38 + oppSizeAdv * 0.70) + oppSpeedAdv * 0.18, 0.25, 0.88)
  const my2R  = clamp((v(myBuild,  'jumpShot') - 3) / 8 * 0.44 + 0.08, 0.03, 0.52)
  const opp2R = clamp((v(oppBuild, 'jumpShot') - 3) / 8 * 0.44 + 0.08, 0.03, 0.52)
  const myBlkR  = clamp((v(myBuild,  'size') + (myPosition  === 'big' ? v(myBuild,'interiorDefense')  : v(myBuild,'perimeterDefense')))  / 22 * 0.10 + sizeEdge * 0.06, 0, 0.14)
  const oppBlkR = clamp((v(oppBuild, 'size') + (oppPosition === 'big' ? v(oppBuild,'interiorDefense') : v(oppBuild,'perimeterDefense'))) / 22 * 0.10 - sizeEdge * 0.06, 0, 0.14)
  const myStlR  = myPosition  === 'guard'
    ? clamp(v(myBuild,'perimeterDefense') / 11 * 0.07, 0, 0.07)
    : clamp((v(myBuild,'speed') + v(myBuild,'interiorDefense')) / 22 * 0.05, 0, 0.05)
  const oppStlR = oppPosition === 'guard'
    ? clamp(v(oppBuild,'perimeterDefense') / 11 * 0.07, 0, 0.07)
    : clamp((v(oppBuild,'speed') + v(oppBuild,'interiorDefense')) / 22 * 0.05, 0, 0.05)

  return { mySP, oppSP, myInsideSP, oppInsideSP, my2R, opp2R, myBlkR, oppBlkR, myStlR, oppStlR,
           myBuild, oppBuild, myPosition, oppPosition, myName, oppName }
}

// ─── Generate one possession (1–3 plays: action + optional milestone + optional checkup) ─
function generateNextPlay(consts, gsRef, myAdj, oppAdj, idRef) {
  const { myPts, oppPts, turn, shown } = gsRef.current
  const GOAL = 11
  if (myPts >= GOAL || oppPts >= GOAL) return null

  const isMe    = turn === 'me'
  const adj     = isMe ? myAdj    : oppAdj
  const effMult = adj !== 'balanced' ? 0.88 : 1.0
  const baseSP  = (isMe ? consts.mySP    : consts.oppSP)    * effMult
  const insideSP = (isMe ? consts.myInsideSP : consts.oppInsideSP) * effMult
  const r2      = isMe ? consts.my2R     : consts.opp2R
  const build   = isMe ? consts.myBuild  : consts.oppBuild
  const pos     = isMe ? consts.myPosition : consts.oppPosition
  const name    = isMe ? consts.myName   : consts.oppName
  const defName = isMe ? consts.oppName  : consts.myName
  const defBlk  = isMe ? consts.oppBlkR  : consts.myBlkR
  const defStl  = isMe ? consts.oppStlR  : consts.myStlR

  let newMyPts = myPts, newOppPts = oppPts, newTurn = turn
  const newPlays = []

  if (Math.random() < defStl) {
    newPlays.push({ id: idRef.current++, who: isMe ? 'opp' : 'me', type: 'steal', pts: 0, text: T.steal('__NAME__'), myPts, oppPts })
    newTurn = isMe ? 'opp' : 'me'
  } else if (Math.random() < defBlk) {
    newPlays.push({ id: idRef.current++, who: isMe ? 'opp' : 'me', type: 'block', pts: 0, text: T.block('__NAME__'), myPts, oppPts, big: true })
    newTurn = isMe ? 'opp' : 'me'
  } else {
    const isArc = adj === 'drive' ? false : adj === 'shoot' ? true : Math.random() < r2
    const sp    = isArc ? baseSP : insideSP
    if (Math.random() < sp) {
      const pts  = isArc ? 2 : 1
      const type = getScoreType(isArc, pos, build)
      if (isMe) newMyPts  = Math.min(myPts  + pts, GOAL)
      else      newOppPts = Math.min(oppPts + pts, GOAL)
      const big = type === 'score1Ath' || type === 'score1Post' || type === 'score1Elbow'
      newPlays.push({ id: idRef.current++, who: turn, type, pts, text: T[type]('__NAME__'), myPts: newMyPts, oppPts: newOppPts, big })
      const scorerPts = isMe ? newMyPts : newOppPts
      const msKey = `${isMe ? 'me' : 'opp'}-${scorerPts}`
      const msText = { 5: '__NAME__ — 5!', 7: '__NAME__ with 7 — heating up.', 9: '__NAME__ RUNS IT UP — 9!', 10: 'GAME POINT — __NAME__ needs ONE!' }
      if (msText[scorerPts] && !shown.has(msKey)) {
        shown.add(msKey)
        newPlays.push({ id: idRef.current++, who: null, milestoneFor: isMe ? 'me' : 'opp', type: 'milestone', pts: 0, text: msText[scorerPts], myPts: newMyPts, oppPts: newOppPts, big: scorerPts >= 9 })
      }
    } else {
      newPlays.push({ id: idRef.current++, who: turn, type: 'miss', pts: 0, text: isArc ? T.miss2('__NAME__') : T.miss('__NAME__'), myPts, oppPts, arcAttempt: isArc })
      newTurn = isMe ? 'opp' : 'me'
    }
  }

  if (newMyPts < GOAL && newOppPts < GOAL) {
    newPlays.push({ id: idRef.current++, who: null, type: 'checkup', pts: 0, text: T.checkup(), myPts: newMyPts, oppPts: newOppPts })
  }

  gsRef.current = { myPts: newMyPts, oppPts: newOppPts, turn: newTurn, shown }
  return newPlays
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
function CourtVisual({ play, myColor, oppColor, myName, oppName, possession, dispPossession, mySlot, oppSlot, showCheckup, mySpeed, oppSpeed }) {
  const sdur = s => 0.65 - (clamp(s ?? 6, 1, 11) - 1) * 0.035
  const myMvDur  = sdur(mySpeed)
  const oppMvDur = sdur(oppSpeed)
  const [myPct,        setMyPct]        = useState({ x: 30, y: 87, dur: myMvDur })
  const [oppPct,       setOppPct]       = useState({ x: 70, y: 87, dur: oppMvDur })
  const [ballOverride,        setBallOverride]        = useState(null)
  const [ballCarrierOverride, setBallCarrierOverride] = useState(null)
  const [rimPop,              setRimPop]              = useState(null)
  const timersRef  = useRef([])
  const rimPopKey  = useRef(0)
  const myPrevXRef  = useRef(50)
  const oppPrevXRef = useRef(50)
  const myDirRef    = useRef(1)
  const oppDirRef   = useRef(-1)

  const rnd   = (lo, hi) => lo + Math.random() * (hi - lo)
  const pPick = arr => arr[Math.floor(Math.random() * arr.length)]
  const mv = (setter, x, y, dur = 0.52) => setter({ x, y, dur })

  function clearTimers() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setBallOverride(null)
    setBallCarrierOverride(null)
  }
  function popRim(label) {
    rimPopKey.current++
    setRimPop({ label, key: rimPopKey.current })
    setTimeout(() => setRimPop(null), 900)
  }
  function after(ms, fn) {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
  }

  // Zones as % of image — rim at (50%, 12%), ft-line ~33%, arc ~62%, half-court ~88%
  const cl = v => Math.max(8, Math.min(92, v))  // clamp to in-bounds x
  const ARC3  = [
    { x: 12, y: 62 }, { x: 88, y: 62 },  // corners
    { x: 24, y: 66 }, { x: 76, y: 66 },  // wings / 45-degree
    { x: 50, y: 68 },                      // top of key
  ]
  const PAINT = [
    { x: 38, y: 14 }, { x: 62, y: 14 },  // left/right block
    { x: 50, y: 12 }, { x: 40, y: 24 }, { x: 60, y: 24 },
  ]
  const DEF      = [{ x: 45, y: 32 }, { x: 55, y: 32 }, { x: 50, y: 26 }]
  const MID      = [{ x: 35, y: 65 }, { x: 65, y: 65 }, { x: 50, y: 58 }]
  const MID_RANGE = [
    { x: 30, y: 42 }, { x: 70, y: 42 },  // low elbows
    { x: 36, y: 50 }, { x: 64, y: 50 },  // mid-range sides
    { x: 50, y: 54 },                      // top of lane
  ]

  useEffect(() => {
    if (!play) return
    clearTimers()

    if (play.type === 'checkup') {
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
    const od = isMe ? myMvDur  : oppMvDur
    const dd = isMe ? oppMvDur : myMvDur
    // Pin ball to the offender so it never tracks the defender even if possession
    // has already changed (e.g. possession flips on miss before the animation fires)
    setBallCarrierOverride(play.who)

    if (play.pts === 2 || (play.type === 'miss' && play.arcAttempt)) {
      const clY    = v => Math.max(8, Math.min(91, v))
      const scored = play.pts === 2
      const finalOff = pPick(ARC3)
      const arcVar = Math.floor(Math.random() * 3)

      if (arcVar === 0) {
        // Step-back / crossover pull-up
        const approach = { x: cl(finalOff.x + rnd(-6, 6)), y: clY(finalOff.y + rnd(1, 3)) }
        const goDir    = Math.random() < 0.5 ? -1 : 1
        const cross    = { x: cl(approach.x + goDir * rnd(10, 18)), y: clY(Math.min(approach.y + rnd(-3, 2), finalOff.y + 4)) }
        mv(setOff, approach.x, approach.y, od * 0.9)
        mv(setDef, cl(approach.x + rnd(-5, 5)), approach.y - rnd(5, 12), dd * 0.9)
        after(Math.round(450 * od / 0.52), () => {
          mv(setOff, cross.x, cross.y, od * 0.46)
          mv(setDef, cl(cross.x + goDir * rnd(6, 14)), cross.y + rnd(2, 6), dd * 0.6)
        })
        after(Math.round(860 * od / 0.52), () => {
          mv(setOff, finalOff.x, finalOff.y, od * 0.73)
          mv(setDef, cl(finalOff.x - goDir * rnd(4, 12)), finalOff.y + rnd(4, 10), dd)
          setBallOverride({ x: 50, y: 12 })
          after(120, () => popRim(scored ? '+2' : 'MISS'))
        })
      } else if (arcVar === 1) {
        // Catch-and-shoot — player spots up, quick release
        const spotApproach = { x: cl(finalOff.x + rnd(-10, 10)), y: clY(finalOff.y + rnd(5, 10)) }
        mv(setOff, spotApproach.x, spotApproach.y, od * 0.82)
        mv(setDef, cl(finalOff.x + rnd(-8, 8)), finalOff.y - rnd(4, 10), dd * 0.78)
        after(Math.round(520 * od / 0.52), () => {
          mv(setOff, finalOff.x, finalOff.y, od * 0.30)
          mv(setDef, cl(finalOff.x + rnd(-6, 6)), finalOff.y - rnd(2, 7), dd * 0.40)
          setBallOverride({ x: 50, y: 12 })
          after(100, () => popRim(scored ? '+2' : 'MISS'))
        })
      } else {
        // Off-the-dribble pull-up — drive from the wing, stop and fire at arc
        const driveDir   = Math.random() < 0.5 ? -1 : 1
        const driveStart = { x: cl(50 + driveDir * rnd(16, 26)), y: clY(finalOff.y + rnd(10, 18)) }
        const stopPt     = { x: cl(driveStart.x - driveDir * rnd(10, 18)), y: clY(driveStart.y - rnd(4, 8)) }
        mv(setOff, driveStart.x, driveStart.y, od * 0.85)
        mv(setDef, cl(finalOff.x + rnd(-6, 6)), finalOff.y - rnd(4, 8), dd * 0.80)
        after(Math.round(420 * od / 0.52), () => {
          mv(setOff, stopPt.x, stopPt.y, od * 0.40)
          mv(setDef, cl(stopPt.x + driveDir * rnd(4, 10)), stopPt.y + rnd(2, 6), dd * 0.50)
        })
        after(Math.round(780 * od / 0.52), () => {
          mv(setOff, finalOff.x, finalOff.y, od * 0.55)
          mv(setDef, cl(finalOff.x - driveDir * rnd(3, 10)), finalOff.y + rnd(3, 8), dd)
          setBallOverride({ x: 50, y: 12 })
          after(120, () => popRim(scored ? '+2' : 'MISS'))
        })
      }

    } else if (play.pts === 1) {
      const isAth   = play.type === 'score1Ath'
      const isPost  = play.type === 'score1Post'
      const isMid   = play.type === 'score1Mid'
      const isElbow = play.type === 'score1Elbow'
      const finalOff = pPick(PAINT)

      if (isAth) {
        const dunkVar = Math.floor(Math.random() * 2)
        const wing    = Math.random() < 0.5 ? -1 : 1
        if (dunkVar === 0) {
        // DUNK — catch near low post, one explosive burst to rim
        const receive = { x: cl(50 + wing * rnd(8, 16)), y: rnd(22, 32) }
        const rimSpot = { x: cl(50 + wing * rnd(1, 5)),   y: rnd(10, 15) }
        mv(setOff, receive.x, receive.y, od * 0.72)
        mv(setDef, cl(receive.x - wing * rnd(8, 16)), receive.y - rnd(8, 16), dd * 0.9)
        after(Math.round(480 * od / 0.52), () => {
          mv(setOff, rimSpot.x, rimSpot.y, od * 0.32)
          mv(setDef, cl(rimSpot.x + wing * rnd(4, 10)), rimSpot.y + rnd(8, 14), dd * 0.65)
          setBallOverride({ x: rimSpot.x, y: rimSpot.y })
          after(Math.round(od * 0.32 * 1000 * 0.85), () => popRim('+1'))
        })
        } else {
        // DUNK — straight power drive from top, spin off defender
        const topStart = { x: cl(50 + wing * rnd(6, 14)), y: rnd(42, 55) }
        const spinMid  = { x: cl(50 + wing * rnd(2, 8)),  y: rnd(22, 30) }
        const rimSpot  = { x: cl(50 + rnd(-3, 3)),         y: rnd(10, 15) }
        mv(setOff, topStart.x, topStart.y, od * 0.75)
        mv(setDef, cl(topStart.x - wing * rnd(6, 12)), topStart.y - rnd(8, 16), dd * 0.85)
        after(Math.round(400 * od / 0.52), () => {
          mv(setOff, spinMid.x, spinMid.y, od * 0.35)
          mv(setDef, cl(spinMid.x + wing * rnd(10, 18)), spinMid.y + rnd(4, 10), dd * 0.55)
        })
        after(Math.round(640 * od / 0.52), () => {
          mv(setOff, rimSpot.x, rimSpot.y, od * 0.26)
          mv(setDef, cl(rimSpot.x + wing * rnd(4, 10)), rimSpot.y + rnd(6, 12), dd * 0.60)
          setBallOverride({ x: rimSpot.x, y: rimSpot.y })
          after(Math.round(od * 0.26 * 1000 * 0.85), () => popRim('+1'))
        })
        }

      } else if (isPost) {
        const postVar = Math.floor(Math.random() * 2)
        if (postVar === 0) {
        // Back player down from high post to finish inside
        const highPost = { x: finalOff.x + rnd(-12, 12), y: finalOff.y + rnd(22, 32) }
        const midPost  = { x: finalOff.x + rnd(-5, 5),   y: finalOff.y + rnd(10, 18) }
        mv(setOff, highPost.x, highPost.y, od * 1.2)
        mv(setDef, finalOff.x + rnd(-4,4), finalOff.y - rnd(2,8), dd * 1.1)
        after(590, () => {
          mv(setOff, midPost.x, midPost.y, od * 0.96)
          mv(setDef, midPost.x + rnd(-3,3), midPost.y - rnd(3,8), dd)
        })
        after(1060, () => {
          mv(setOff, finalOff.x, finalOff.y, od * 0.62)
          setBallOverride({ x: 50, y: 12 })
          after(120, () => popRim('+1'))
        })
        } else {
        // Catch on the block, quick spin off defender, finish at rim
        const side      = Math.random() < 0.5 ? -1 : 1
        const blockCatch = { x: cl(50 + side * rnd(12, 18)), y: rnd(26, 36) }
        const spinEnd    = { x: cl(blockCatch.x - side * rnd(6, 12)), y: blockCatch.y - rnd(4, 8) }
        mv(setOff, blockCatch.x, blockCatch.y, od * 0.80)
        mv(setDef, cl(blockCatch.x - side * rnd(4, 10)), blockCatch.y - rnd(4, 10), dd * 0.85)
        after(Math.round(500 * od / 0.52), () => {
          mv(setOff, spinEnd.x, spinEnd.y, od * 0.34)
          mv(setDef, cl(spinEnd.x + side * rnd(10, 16)), spinEnd.y + rnd(4, 8), dd * 0.52)
          setBallOverride({ x: 50, y: 12 })
          after(110, () => popRim('+1'))
        })
        }

      } else if (isMid) {
        const midVar  = Math.floor(Math.random() * 2)
        const midSpot = pPick(MID_RANGE)
        if (midVar === 0) {
        // Mid-range pull-up — drive to mid-range spot, step into jumper
        const approach = { x: cl(midSpot.x + rnd(-14, 14)), y: midSpot.y + rnd(14, 22) }
        mv(setOff, approach.x, approach.y, od * 0.80)
        mv(setDef, cl(midSpot.x + rnd(-8, 8)), midSpot.y - rnd(4, 10), dd * 0.88)
        after(Math.round(480 * od / 0.52), () => {
          mv(setOff, midSpot.x, midSpot.y, od * 0.36)
          mv(setDef, cl(midSpot.x + rnd(-5, 5)), midSpot.y - rnd(2, 6), dd * 0.46)
          setBallOverride({ x: 50, y: 12 })
          after(110, () => popRim('+1'))
        })
        } else {
        // Baseline cut to mid — player runs from the baseline side, catches and fires
        const cutDir   = Math.random() < 0.5 ? -1 : 1
        const cutStart = { x: cl(50 + cutDir * rnd(18, 28)), y: midSpot.y + rnd(18, 28) }
        mv(setOff, cutStart.x, cutStart.y, od * 0.78)
        mv(setDef, cl(midSpot.x + rnd(-8, 8)), midSpot.y - rnd(4, 8), dd * 0.85)
        after(Math.round(360 * od / 0.52), () => {
          mv(setOff, midSpot.x, midSpot.y, od * 0.30)
          mv(setDef, cl(midSpot.x + cutDir * rnd(4, 10)), midSpot.y + rnd(2, 6), dd * 0.45)
          setBallOverride({ x: 50, y: 12 })
          after(110, () => popRim('+1'))
        })
        }

      } else if (isElbow) {
        const elbowVar  = Math.floor(Math.random() * 2)
        const elbowSide = Math.random() < 0.5 ? -1 : 1
        if (elbowVar === 0) {
        // Elbow post-up — bigs back into defender, turnaround or fadeaway
        const elbowReceive = { x: cl(50 + elbowSide * rnd(14, 22)), y: rnd(36, 46) }
        const defStart     = { x: cl(elbowReceive.x - elbowSide * rnd(2, 8)), y: elbowReceive.y - rnd(10, 16) }
        const backSpot     = { x: elbowReceive.x, y: elbowReceive.y - rnd(4, 8) }
        mv(setOff, elbowReceive.x, elbowReceive.y, od * 0.88)
        mv(setDef, defStart.x, defStart.y, dd * 0.88)
        after(Math.round(560 * od / 0.52), () => {
          mv(setOff, backSpot.x, backSpot.y, od * 0.55)
          mv(setDef, cl(defStart.x + elbowSide * rnd(3, 8)), defStart.y - rnd(2, 5), dd * 0.60)
          after(Math.round(350 * od / 0.52), () => {
            setBallOverride({ x: 50, y: 12 })
            after(110, () => popRim('+1'))
          })
        })
        } else {
        // High-post flash — big flashes to the elbow extended, one power dribble, fires
        const highPost   = { x: cl(50 + elbowSide * rnd(8, 16)), y: rnd(28, 38) }
        const elbowSpot  = { x: cl(50 + elbowSide * rnd(16, 24)), y: rnd(40, 50) }
        const defClose   = { x: cl(elbowSpot.x - elbowSide * rnd(2, 6)), y: elbowSpot.y - rnd(8, 14) }
        mv(setOff, highPost.x, highPost.y, od * 0.82)
        mv(setDef, defClose.x, defClose.y, dd * 0.85)
        after(Math.round(440 * od / 0.52), () => {
          mv(setOff, elbowSpot.x, elbowSpot.y, od * 0.42)
          mv(setDef, cl(defClose.x + elbowSide * rnd(2, 6)), defClose.y + rnd(2, 5), dd * 0.50)
        })
        after(Math.round(780 * od / 0.52), () => {
          setBallOverride({ x: 50, y: 12 })
          after(110, () => popRim('+1'))
        })
        }

      } else {
        // LAYUP — three variants for variety
        const rimSpot  = pPick([PAINT[0], PAINT[1], { x: 44, y: 15 }, { x: 56, y: 15 }])
        const layupVar = Math.floor(Math.random() * 3)

        if (layupVar === 0) {
          // Jab step → first step → finish
          const jabDir = Math.random() < 0.5 ? -1 : 1
          const jabPt  = { x: rimSpot.x + jabDir * rnd(14, 22), y: rimSpot.y + rnd(32, 44) }
          const lanePt = { x: rimSpot.x + rnd(-5, 5),           y: rimSpot.y + rnd(12, 20) }
          mv(setOff, jabPt.x, jabPt.y, od * 0.62)
          mv(setDef, rimSpot.x - jabDir * rnd(6, 14), rimSpot.y + rnd(4, 10), dd * 0.85)
          after(Math.round(310 * od / 0.52), () => {
            mv(setOff, lanePt.x, lanePt.y, od * 0.42)
            mv(setDef, rimSpot.x + jabDir * rnd(2, 6), rimSpot.y + rnd(2, 8), dd * 0.62)
          })
          after(Math.round(510 * od / 0.52), () => {
            mv(setOff, rimSpot.x, rimSpot.y, od * 0.46)
            setBallOverride({ x: 50, y: 12 })
            after(120, () => popRim('+1'))
          })
        } else if (layupVar === 1) {
          // Straight-line drive from wing → finish
          const driveDir   = Math.random() < 0.5 ? -1 : 1
          const driveStart = { x: cl(50 + driveDir * rnd(18, 30)), y: rnd(55, 68) }
          const laneEntry  = { x: cl(rimSpot.x + driveDir * rnd(4, 10)), y: rimSpot.y + rnd(14, 24) }
          mv(setOff, driveStart.x, driveStart.y, od * 0.68)
          mv(setDef, cl(rimSpot.x - driveDir * rnd(4, 10)), rimSpot.y + rnd(6, 14), dd * 0.90)
          after(Math.round(400 * od / 0.52), () => {
            mv(setOff, laneEntry.x, laneEntry.y, od * 0.30)
            mv(setDef, cl(rimSpot.x + driveDir * rnd(2, 8)), rimSpot.y + rnd(2, 8), dd * 0.55)
          })
          after(Math.round(580 * od / 0.52), () => {
            mv(setOff, rimSpot.x, rimSpot.y, od * 0.28)
            setBallOverride({ x: 50, y: 12 })
            after(100, () => popRim('+1'))
          })
        } else {
          // Spin move in the lane — drive, spin off defender, finish other side of rim
          const spinDir    = Math.random() < 0.5 ? -1 : 1
          const driveStart = { x: cl(50 + spinDir * rnd(10, 18)), y: rnd(52, 65) }
          const spinEntry  = { x: cl(50 + spinDir * rnd(2, 6)),  y: rnd(28, 38) }
          const finishSpot = { x: cl(50 - spinDir * rnd(1, 5)),   y: rimSpot.y + rnd(2, 8) }
          mv(setOff, driveStart.x, driveStart.y, od * 0.70)
          mv(setDef, cl(50 + spinDir * rnd(2, 8)), rnd(24, 32), dd * 0.85)
          after(Math.round(380 * od / 0.52), () => {
            mv(setOff, spinEntry.x, spinEntry.y, od * 0.35)
            mv(setDef, cl(spinEntry.x + spinDir * rnd(10, 18)), spinEntry.y + rnd(4, 8), dd * 0.50)
          })
          after(Math.round(570 * od / 0.52), () => {
            mv(setOff, finishSpot.x, finishSpot.y, od * 0.30)
            setBallOverride({ x: 50, y: 12 })
            after(100, () => popRim('+1'))
          })
        }
      }

    } else if (play.type === 'block') {
      const rimArea  = { x: 50 + rnd(-8, 8),  y: 18 + rnd(-3, 3) }
      const drivePt  = { x: rimArea.x + rnd(-14, 14), y: rimArea.y + rnd(24, 36) }
      const defStart = { x: rimArea.x + rnd(-22, 22), y: 38 + rnd(-6, 6) }
      mv(setOff, drivePt.x, drivePt.y, od * 0.73)
      mv(setDef, defStart.x, defStart.y, dd * 0.88)
      after(Math.round(380 * od / 0.52), () => {
        mv(setOff, rimArea.x, rimArea.y, od * 0.46)
        const swatSide = Math.random() < 0.5 ? -1 : 1
        mv(setDef, rimArea.x + swatSide * rnd(14, 22), rimArea.y + rnd(8, 16), dd * 0.42)
      })
      after(720, () => {
        const clearX = 28 + rnd(8, 44)
        mv(setDef, clearX, 70 + rnd(6, 12), dd)
        mv(setOff, rimArea.x + rnd(-10, 10), rimArea.y + rnd(12, 20), od * 0.77)
      })

    } else if (play.type === 'steal') {
      const cx = 50 + rnd(-16, 16), cy = 64 + rnd(-8, 8)
      const pokeSide = isMe ? 1 : -1
      const defApp = { x: cx + pokeSide * rnd(10, 18), y: cy + rnd(-4, 4) }
      mv(setOff, cx - pokeSide * rnd(3, 7), cy, od * 0.8)
      mv(setDef, defApp.x, defApp.y, dd * 0.8)
      after(400, () => {
        mv(setOff, cx, cy, od * 0.38)
        mv(setDef, cx + pokeSide * rnd(3, 6), cy, dd * 0.35)
      })
      after(600, () => {
        const clearX = 25 + rnd(10, 50)
        mv(setDef, clearX, 72 + rnd(5, 10), dd * 0.96)
        mv(setOff, cx - pokeSide * rnd(8, 16), cy + rnd(4, 10), od * 0.73)
      })

    } else if (play.type === 'miss') {
      // Same shot animation as makes — drives and shoots, result shown at rim
      // Alternates between layup drive and mid-range pull-up
      const missVar = Math.floor(Math.random() * 2)
      if (missVar === 0) {
        const driveDir   = Math.random() < 0.5 ? -1 : 1
        const rimSpot    = pPick(PAINT)
        const driveStart = { x: cl(50 + driveDir * rnd(18, 30)), y: rnd(55, 68) }
        const laneEntry  = { x: cl(rimSpot.x + driveDir * rnd(4, 10)), y: rimSpot.y + rnd(14, 24) }
        mv(setOff, driveStart.x, driveStart.y, od * 0.68)
        mv(setDef, cl(rimSpot.x - driveDir * rnd(4, 10)), rimSpot.y + rnd(6, 14), dd * 0.90)
        after(Math.round(400 * od / 0.52), () => {
          mv(setOff, laneEntry.x, laneEntry.y, od * 0.30)
          mv(setDef, cl(rimSpot.x + driveDir * rnd(2, 8)), rimSpot.y + rnd(2, 8), dd * 0.55)
        })
        after(Math.round(580 * od / 0.52), () => {
          mv(setOff, rimSpot.x, rimSpot.y, od * 0.28)
          setBallOverride({ x: 50, y: 12 })
          after(120, () => popRim('MISS'))
        })
      } else {
        const midSpot  = pPick(MID_RANGE)
        const approach = { x: cl(midSpot.x + rnd(-14, 14)), y: midSpot.y + rnd(14, 22) }
        mv(setOff, approach.x, approach.y, od * 0.80)
        mv(setDef, cl(midSpot.x + rnd(-8, 8)), midSpot.y - rnd(4, 10), dd * 0.88)
        after(Math.round(480 * od / 0.52), () => {
          mv(setOff, midSpot.x, midSpot.y, od * 0.36)
          mv(setDef, cl(midSpot.x + rnd(-5, 5)), midSpot.y - rnd(2, 6), dd * 0.46)
          setBallOverride({ x: 50, y: 12 })
          after(110, () => popRim('MISS'))
        })
      }
    }
    return clearTimers
  }, [play, possession]) // eslint-disable-line

  const isCheckup = play?.type === 'checkup'
  // ballCarrierOverride forces ball to track the offender (play.who) even when
  // possession has already flipped — e.g. possession changes on miss before animation fires
  const ballIs     = ballCarrierOverride ?? possession
  const carrierPct = ballIs === 'me' ? myPct : oppPct
  if (myPct.x  !== myPrevXRef.current)  { myDirRef.current  = myPct.x  > myPrevXRef.current  ? 1 : -1; myPrevXRef.current  = myPct.x  }
  if (oppPct.x !== oppPrevXRef.current) { oppDirRef.current = oppPct.x > oppPrevXRef.current ? 1 : -1; oppPrevXRef.current = oppPct.x }
  const carrierDir = ballIs === 'me' ? myDirRef.current : oppDirRef.current
  const ballPct    = ballOverride ?? { x: carrierPct.x + carrierDir * 7, y: carrierPct.y - 6 }
  const EASE   = 'cubic-bezier(0.25,0.82,0.42,1)'
  const myTr   = `left ${myPct.dur}s ${EASE}, top ${myPct.dur}s ${EASE}`
  const oppTr  = `left ${oppPct.dur}s ${EASE}, top ${oppPct.dur}s ${EASE}`
  const ballTr = ballOverride
    ? `left 0.45s cubic-bezier(0.4,0,0.6,1), top 0.45s cubic-bezier(0.55,0,0.45,1)`
    : `left ${carrierPct.dur}s ${EASE}, top ${carrierPct.dur}s ${EASE}`

  return (
    <div className="bvr-court-wrap">
      <div className="bvr-court-aspect">

        {/* Court image */}
        <img src="/court.png" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', borderRadius: 8, display: 'block' }} alt="" draggable={false} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'rgba(90, 10, 10, 0.15)', mixBlendMode: 'multiply', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'radial-gradient(ellipse 80% 50% at 50% 30%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 50%, transparent 75%)', pointerEvents: 'none' }} />

        {/* HTML overlay: ball + QBAvatar player circles */}
        <div className="bvr-court-overlay">

          {/* Ball */}
          <div className="bvr-ball-div" style={{ left: `${ballPct.x}%`, top: `${ballPct.y}%`, transition: ballTr }}>🏀</div>

          {/* My player */}
          <div className="bvr-pa" style={{ left: `${myPct.x}%`, top: `${myPct.y}%`, transition: myTr, zIndex: dispPossession === 'me' ? 4 : 2 }}>
            <div className={`bvr-pa-ring${dispPossession === 'me' ? ' bvr-pa-ring--ball' : ''}`} style={{
              '--pc': myColor,
              boxShadow: dispPossession === 'me'
                ? `0 0 0 4px ${myColor}, 0 0 20px ${myColor}aa, 0 0 6px ${myColor}`
                : `0 0 0 1px ${myColor}33`,
            }}>
              <QBAvatar photo={mySlot?.photo ?? null} team={mySlot?.team ?? null}
                color={null} size={48} logoDir="/logos/nba/" faceCenter={mySlot?.faceCenter} />
            </div>
            <span className="bvr-pa-label" style={{ color: myColor }}>{(myName || 'ME').substring(0, 10)}</span>
          </div>

          {/* Opponent */}
          <div className="bvr-pa" style={{ left: `${oppPct.x}%`, top: `${oppPct.y}%`, transition: oppTr, zIndex: dispPossession === 'opp' ? 4 : 2 }}>
            <div className={`bvr-pa-ring${dispPossession === 'opp' ? ' bvr-pa-ring--ball' : ''}`} style={{
              '--pc': oppColor,
              boxShadow: dispPossession === 'opp'
                ? `0 0 0 4px ${oppColor}, 0 0 20px ${oppColor}aa, 0 0 6px ${oppColor}`
                : `0 0 0 1px ${oppColor}33`,
            }}>
              <QBAvatar photo={oppSlot?.photo ?? null} team={oppSlot?.team ?? null}
                color={null} size={48} logoDir="/logos/nba/" faceCenter={oppSlot?.faceCenter} />
            </div>
            <span className="bvr-pa-label" style={{ color: oppColor }}>{(oppName || 'OPP').substring(0, 10)}</span>
          </div>

          {/* Rim pop indicator (+1 / +2 / MISS) */}
          {rimPop && (
            <div key={rimPop.key} className={`bvr-rim-pop${rimPop.label === 'MISS' ? ' bvr-rim-pop--miss' : ''}`}>
              {rimPop.label}
            </div>
          )}

          {/* Check ball text — bottom of court */}
          {showCheckup && (
            <div className="bvr-court-checkup">CHECK BALL</div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BucketVersusResult({ myData, oppData, position, oppPosition, role, channel, versusGame, onRematch, onExit, onResult, user, oppDisconnected }) {
  const [phase,           setPhase]           = useState('reveal')
  const [playIdx,         setPlayIdx]         = useState(0)
  const [shownIdx,        setShownIdx]        = useState(0)
  const [shownPossession, setShownPossession] = useState('me')
  const [plays,           setPlays]           = useState(() => [{ id: 0, who: null, type: 'checkup', pts: 0, text: T.checkup(), myPts: 0, oppPts: 0 }])
  const [winner,          setWinner]          = useState(null)
  const [possession,      setPossession]      = useState('me')
  const [myRematchReady,  setMyRematchReady]  = useState(false)
  const [oppRematchReady, setOppRematchReady] = useState(false)
  const [oppExited,       setOppExited]       = useState(false)
  const [myAdj,           setMyAdj]           = useState('balanced')
  const feedRef           = useRef(null)
  const resultFired       = useRef(false)
  const gameStateRef      = useRef({ myPts: 0, oppPts: 0, turn: 'me', shown: new Set() })
  const playIdRef         = useRef(1)
  const myAdjRef          = useRef('balanced')
  const oppAdjRef         = useRef('balanced')
  const advancePendingRef = useRef(null)
  const playsRef          = useRef(null)
  playsRef.current        = plays

  const myTypes  = position    === 'big' ? VERSUS_BIG_TYPES : VERSUS_GUARD_TYPES
  const oppTypes = (oppPosition ?? position) === 'big' ? VERSUS_BIG_TYPES : VERSUS_GUARD_TYPES
  const myOVR    = calcBucketOVR(myData.build,  myTypes,  position)
  const oppOVR   = calcBucketOVR(oppData.build, oppTypes, oppPosition ?? position)

  const myName  = myData.name  || (user ? (user.user_metadata?.username || user.email?.split('@')[0]) : 'Your Build')
  const oppName = oppData.name || 'Opponent'

  const myTeamData  = NBA_TEAMS.find(t => t.short === myData.player?.team)
  const oppTeamData = NBA_TEAMS.find(t => t.short === oppData.player?.team)
  const myColor     = myTeamData?.color  || '#3b82f6'
  const oppColor    = oppTeamData?.color || '#ef4444'
  const myTeamFull  = myTeamData?.name   || myData.player?.team  || ''
  const oppTeamFull = oppTeamData?.name  || oppData.player?.team || ''

  const gameConsts = useMemo(() => computeGameConsts(myData.build, oppData.build, position, oppPosition ?? position, myName, oppName), []) // eslint-disable-line

  const myBestSlot  = useMemo(() => bestSlot(myData.build),  [myData.build])
  const oppBestSlot = useMemo(() => bestSlot(oppData.build), [oppData.build])
  const myFaceSlot  = myData.build?.['basketballIQ']?.photo  ? myData.build['basketballIQ']  : myBestSlot
  const oppFaceSlot = oppData.build?.['basketballIQ']?.photo ? oppData.build['basketballIQ'] : oppBestSlot

  myAdjRef.current = myAdj

  // Channel listeners
  useEffect(() => {
    if (!channel) return
    channel.on('broadcast', { event: 'bab_rematch' }, () => setOppRematchReady(true))
    channel.on('broadcast', { event: 'bab_exit' }, () => {
      setOppExited(true)
      if (!resultFired.current) {
        resultFired.current = true
        onResult?.('win')
        setWinner('me')
        setPhase('result')
      }
    })
    channel.on('broadcast', { event: 'bab_play' }, ({ payload }) => {
      if (role !== 'guest') return
      const flipped = (payload.plays ?? []).map(p => ({
        ...p,
        who:          p.who          === 'me' ? 'opp' : p.who          === 'opp' ? 'me' : p.who,
        milestoneFor: p.milestoneFor === 'me' ? 'opp' : p.milestoneFor === 'opp' ? 'me' : p.milestoneFor,
        myPts:  p.oppPts,
        oppPts: p.myPts,
      }))
      setPlays(prev => {
        const seen = new Set(prev.map(p => p.id))
        const fresh = flipped.filter(p => !seen.has(p.id))
        return fresh.length ? [...prev, ...fresh] : prev
      })
    })
    channel.on('broadcast', { event: 'bab_adjustment' }, ({ payload }) => {
      oppAdjRef.current = payload.adjustment ?? 'balanced'
    })
  }, [channel]) // eslint-disable-line

  // Sync adjustment ref and notify host when guest changes adj mid-game
  useEffect(() => {
    myAdjRef.current = myAdj
    if (phase !== 'live' || role !== 'guest' || !channel) return
    channel.send({ type: 'broadcast', event: 'bab_adjustment', payload: { adjustment: myAdj } }).catch?.(() => {})
  }, [myAdj]) // eslint-disable-line

  useEffect(() => {
    if (myRematchReady && oppRematchReady) onRematch?.()
  }, [myRematchReady, oppRematchReady])

  useEffect(() => {
    if (!oppDisconnected) return
    setOppExited(true)
    if (!resultFired.current) {
      resultFired.current = true
      setWinner('me')
      setPhase('result')
      // win already recorded by BucketApp's presence handler — don't call onResult again
    }
  }, [oppDisconnected])

  function handleRematch() {
    if (!channel) { onRematch?.(); return }
    if (myRematchReady) return
    setMyRematchReady(true)
    channel.send({ type: 'broadcast', event: 'bab_rematch', payload: {} }).catch?.(() => {})
  }

  function handleExit() {
    if (channel) {
      channel.send({ type: 'broadcast', event: 'bab_exit', payload: {} }).catch?.(() => {})
    }
    onExit?.()
  }

  useEffect(() => {
    if (phase !== 'reveal') return
    const t = setTimeout(() => {
      setPhase('live')
      window.ramp?.que?.push(() => { window.ramp.spaNewPage() })
    }, 5500)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase === 'result') window.ramp?.que?.push(() => { window.ramp.spaNewPage() })
  }, [phase])

  // Guest: advance to next play when it arrives from channel
  useEffect(() => {
    if (advancePendingRef.current === null) return
    const targetIdx = advancePendingRef.current
    if (playsRef.current.length <= targetIdx) return
    advancePendingRef.current = null
    const next = playsRef.current[targetIdx]
    const nextPoss = !next ? null
      : next.pts > 0                                    ? next.who
      : next.type === 'steal' || next.type === 'block'  ? next.who
      : next.type === 'miss'                            ? (next.who === 'me' ? 'opp' : 'me')
      : null
    setPlayIdx(targetIdx)
    if (nextPoss !== null) setPossession(nextPoss)
  }, [plays]) // eslint-disable-line

  // Live play ticker — incremental generation (host/solo) or wait (guest)
  useEffect(() => {
    if (phase !== 'live') return
    const cur = playsRef.current[playIdx]
    if (!cur) return

    if (cur.myPts >= 11 || cur.oppPts >= 11) {
      const result = cur.myPts >= 11 ? 'me' : 'opp'
      setWinner(result)
      if (!resultFired.current) {
        resultFired.current = true
        onResult?.(result === 'me' ? 'win' : 'loss')
      }
      const t = setTimeout(() => setPhase('result'), 2200)
      return () => clearTimeout(t)
    }

    const delay = playIdx === 0              ? 3000
                : cur.type === 'checkup'    ? 1800
                : cur.type === 'milestone'  ? (cur.big ? 1500 : 1100)
                : cur.pts === 2             ? 1550
                : cur.pts === 1             ? 1150
                : cur.type === 'miss'       ? 1450
                : cur.type === 'block'      ? 1450
                : cur.type === 'steal'      ? 1250
                : 1150

    const t = setTimeout(() => {
      if (playsRef.current.length > playIdx + 1) {
        const next = playsRef.current[playIdx + 1]
        const nextPoss = !next ? null
          : next.pts > 0                                    ? next.who
          : next.type === 'steal' || next.type === 'block'  ? next.who
          : next.type === 'miss'                            ? (next.who === 'me' ? 'opp' : 'me')
          : null
        setPlayIdx(i => i + 1)
        if (nextPoss !== null) setPossession(nextPoss)
      } else if (role !== 'guest') {
        const newPlays = generateNextPlay(gameConsts, gameStateRef, myAdjRef.current, oppAdjRef.current, playIdRef)
        if (newPlays && newPlays.length > 0) {
          const next = newPlays[0]
          const nextPoss = !next ? null
            : next.pts > 0                                    ? next.who
            : next.type === 'steal' || next.type === 'block'  ? next.who
            : next.type === 'miss'                            ? (next.who === 'me' ? 'opp' : 'me')
            : null
          setPlays(prev => [...prev, ...newPlays])
          setPlayIdx(i => i + 1)
          if (nextPoss !== null) setPossession(nextPoss)
          if (role === 'host' && channel) {
            channel.send({ type: 'broadcast', event: 'bab_play', payload: { plays: newPlays } }).catch?.(() => {})
          }
        }
      } else {
        advancePendingRef.current = playIdx + 1
      }
    }, delay)
    return () => clearTimeout(t)
  }, [phase, playIdx]) // eslint-disable-line

  // Lag shownIdx + shownPossession behind playIdx so UI updates AFTER court animation
  useEffect(() => {
    const p = plays[playIdx]
    const nextPoss = !p                                        ? null
                   : p.pts > 0                               ? p.who
                   : p.type === 'steal' || p.type === 'block'? p.who
                   : p.type === 'miss'                       ? (p.who === 'me' ? 'opp' : 'me')
                   : null
    if (!p || p.type === 'checkup' || p.type === 'milestone') {
      setShownIdx(playIdx)
      if (nextPoss !== null) setShownPossession(nextPoss)
      return
    }
    const lag = p.pts === 2 ? 1100
              : p.pts === 1 ? 780
              : p.type === 'miss'  ? 1000
              : p.type === 'block' ? 1000
              : p.type === 'steal' ? 800
              : 900
    const t = setTimeout(() => { setShownIdx(playIdx); if (nextPoss !== null) setShownPossession(nextPoss) }, lag)
    return () => clearTimeout(t)
  }, [playIdx]) // eslint-disable-line

  const cur      = plays[shownIdx]
  const myScore  = cur?.myPts  ?? 0
  const oppScore = cur?.oppPts ?? 0

  const feedPlays = useMemo(() => {
    return plays
      .slice(0, Math.max(0, shownIdx + 1))
      .filter(p => p.type !== 'milestone' && p.type !== 'checkup')
      .slice(-5)
      .reverse()
  }, [plays, shownIdx])

  const milestone = (cur?.type === 'milestone') ? cur : null

  function resolveText(p) {
    if (!p?.text) return ''
    const n = p.type === 'milestone'
      ? (p.milestoneFor === 'me' ? myName : oppName)
      : (p.who === 'me' ? myName : oppName)
    return p.text.replace('__NAME__', n)
  }

  // ── Reveal ───────────────────────────────────────────────────────────────────
  if (phase === 'reveal') {
    return (
      <div className="versus-result bvr-reveal">
        <div className="vr-header">
          <span className="vr-header-label">HEAD TO HEAD</span>
        </div>
        <div className="vr-grid">
          <div className="vr-side bvr-reveal-side" style={{ animationDelay: '0.1s' }}>
            <div className="vr-you-tag">{position === 'big' ? 'BIG' : 'GUARD'}</div>
            <BucketModelFigure
              build={myData.build}
              team={myTeamData}
              className="bvr-reveal-model"
            />
            <div className="vr-player-name">{myName}</div>
            <div className="vr-team-name" style={{ color: myColor }}>{myTeamFull}</div>
            <div className="vr-ovr-badge">{myOVR} <span className="vr-ovr-label">OVR</span></div>
          </div>
          <div className="vr-vs-col">
            <div className="bvr-tipoff-text">FIRST<br/>TO<br/>11</div>
          </div>
          <div className="vr-side bvr-reveal-side" style={{ animationDelay: '0.25s' }}>
            <div className="vr-you-tag">{oppPosition === 'big' ? 'BIG' : 'GUARD'}</div>
            <BucketModelFigure
              build={oppData.build}
              team={oppTeamData}
              className="bvr-reveal-model bvr-reveal-model--flip"
            />
            <div className="vr-player-name">{oppName}</div>
            <div className="vr-team-name" style={{ color: oppColor }}>{oppTeamFull}</div>
            <div className="vr-ovr-badge">{oppOVR} <span className="vr-ovr-label">OVR</span></div>
          </div>
        </div>
        <div className="bvr-reveal-builds">
          <div className="bvr-reveal-build-side">
            <div className="bvr-reveal-build-label" style={{ color: myColor }}>{myName}</div>
            <BuildCompact build={myData.build} types={myTypes} position={position} />
          </div>
          <div className="bvr-reveal-build-div" />
          <div className="bvr-reveal-build-side">
            <div className="bvr-reveal-build-label" style={{ color: oppColor }}>{oppName}</div>
            <BuildCompact build={oppData.build} types={oppTypes} position={oppPosition ?? position} />
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
          {/* Possession ball — glides between inner score edges */}
          <div className="bvr-poss-ball" style={{ left: shownPossession === 'me' ? 'calc(50% - 72px)' : 'calc(50% + 72px)' }}>🏀</div>

          <div className="bvr-board-team bvr-board-team--me">
            <div className="bvr-board-player">
              <QBAvatar photo={myBestSlot?.photo ?? null} team={myBestSlot?.team ?? null}
                color={null} size={30} logoDir="/logos/nba/" faceCenter={myBestSlot?.faceCenter} />
              <span className="bvr-board-name" style={{ color: myColor }}>{myName}</span>
            </div>
            <ScoreDigit
              value={myScore}
              color={myLead ? myColor : myScore === oppScore ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.28)'}
            />
          </div>
          <div className="bvr-board-mid">
            <div className="bvr-h2h-logo">HEAD<span className="h2h-to bvr-h2h-to">-TO-</span>HEAD</div>
            <div className="bvr-eleven-label">FIRST TO 11</div>
          </div>
          <div className="bvr-board-team bvr-board-team--opp">
            <div className="bvr-board-player bvr-board-player--opp">
              <span className="bvr-board-name" style={{ color: oppColor }}>{oppName}</span>
              <QBAvatar photo={oppBestSlot?.photo ?? null} team={oppBestSlot?.team ?? null}
                color={null} size={30} logoDir="/logos/nba/" faceCenter={oppBestSlot?.faceCenter} />
            </div>
            <ScoreDigit
              value={oppScore}
              color={oppLead ? oppColor : oppScore === myScore ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.28)'}
            />
          </div>
        </div>

        {/* Progress toward 11 + possession indicator */}
        <div className="bvr-progress-row">
          <ProgressBar value={myScore}  color={myColor} />
          <div className="bvr-poss-pip" style={{ background: possession === 'me' ? myColor : oppColor }} />
          <ProgressBar value={oppScore} color={oppColor} reverse />
        </div>

        <CourtVisual
          play={plays[playIdx]}
          myColor={myColor}     oppColor={oppColor}
          myName={myName}       oppName={oppName}
          possession={possession}
          dispPossession={shownPossession}
          mySlot={myBestSlot}   oppSlot={oppBestSlot}
          showCheckup={plays[playIdx]?.type === 'checkup'}
          mySpeed={myData?.build?.speed?.val ?? 5}
          oppSpeed={oppData?.build?.speed?.val ?? 5}
        />

        {/* Fixed popup toast — immune to flex layout */}
        {milestone && (milestone.myPts >= 10 || milestone.oppPts >= 10) && (
          <div className="bvr-toast bvr-toast--milestone">
            <span className="bvr-toast-text">{resolveText(milestone)}</span>
            <span className="bvr-toast-score">{myScore} — {oppScore}</span>
          </div>
        )}
        {/* In-game adjustment buttons */}
        <div className="bvr-adj-row">
          <span className="bvr-adj-label">OFF. ADJUSTMENTS</span>
          <div className="bvr-adj-btns">
            {[
              { key: 'balanced', label: 'BALANCED', sub: 'Default' },
              { key: 'drive',    label: 'DRIVE',    sub: 'Force Drive' },
              { key: 'shoot',    label: 'SHOOT',    sub: 'Force Jump Shot' },
            ].map(({ key, label, sub }) => (
              <button
                key={key}
                className={`bvr-adj-btn${myAdj === key ? ' bvr-adj-btn--active' : ''}`}
                onClick={() => setMyAdj(key)}
              >
                <span className="bvr-adj-btn-main">{label}</span>
                <span className="bvr-adj-btn-sub">{sub}</span>
              </button>
            ))}
          </div>
        </div>

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
                className={`bvr-play bvr-play--${p.who ?? 'marker'}${p.big ? ' bvr-play--big' : ''}${isMiss ? ' bvr-play--miss' : ''}${isEvent ? ' bvr-play--event' : ''}${isScore ? ' bvr-play--score' : ''}`}
                style={{ opacity: i === 0 ? 1 : Math.max(0.06, 1 - i * 0.28), borderLeftColor: p.who ? dotColor : 'transparent', background: isScore ? `${dotColor}2e` : undefined }}
              >
                {p.who && (
                  <QBAvatar
                    photo={p.who === 'me' ? myFaceSlot?.photo ?? null : oppFaceSlot?.photo ?? null}
                    team={p.who === 'me' ? myFaceSlot?.team ?? null  : oppFaceSlot?.team ?? null}
                    color={null} size={24} logoDir="/logos/nba/"
                    faceCenter={p.who === 'me' ? myFaceSlot?.faceCenter : oppFaceSlot?.faceCenter}
                  />
                )}
                <span className="bvr-play-text">{resolveText(p)}</span>
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

        {/* Side-by-side builds below feed */}
        <div className="bvr-live-builds">
          <div className="bvr-live-build-side">
            <div className="bvr-live-build-label" style={{ color: myColor }}>{myName}</div>
            <BuildCompact build={myData.build} types={myTypes} position={position} />
          </div>
          <div className="bvr-live-build-div" />
          <div className="bvr-live-build-side">
            <div className="bvr-live-build-label" style={{ color: oppColor }}>{oppName}</div>
            <BuildCompact build={oppData.build} types={oppTypes} position={oppPosition ?? position} />
          </div>
        </div>

      </div>
    )
  }

  // ── Result ────────────────────────────────────────────────────────────────────
  const isWin    = winner === 'me'
  const finalMy  = myScore
  const finalOpp = oppScore

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
        <span style={{ color: finalMy >= finalOpp ? '#fff' : 'rgba(255,255,255,0.3)' }}>{finalMy}</span>
        <span className="vr-gs-dash">–</span>
        <span style={{ color: finalOpp >  finalMy ? '#fff' : 'rgba(255,255,255,0.3)' }}>{finalOpp}</span>
      </div>

      <div className="vr-grid bvr-result-grid">
        <div className={`vr-side ${isWin ? 'vr-side--winner' : 'vr-side--loser'}`}>
          <div className="vr-you-tag">{myName}</div>
          <div className="vr-ovr-badge" style={{ marginBottom: 8 }}>{myOVR} <span className="vr-ovr-label">OVR</span></div>
          <BuildCompact build={myData.build} types={myTypes} position={position} />
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
          <BuildCompact build={oppData.build} types={oppTypes} position={oppPosition ?? position} />
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
