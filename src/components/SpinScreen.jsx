import { useRef, useEffect, useLayoutEffect, useMemo, useCallback, useState } from 'react'
import { QBS, ATTR, TYPES, CATEGORIES, QB_PHYSICALS, LITE_TYPES } from '../data/qbs'
import { TEAMS } from '../data/nfl-teams'
import { RB_CATEGORIES } from '../data/rbs'
import { valToGrade, HEADSHOT_BASE } from '../utils/simulation'
import HEADSHOTS from '../data/headshots.json'
import QBAvatar from './QBAvatar'
import { track } from '../lib/track'
import { seededShuffle, useProgress } from '../lib/progress'
import { itemById } from '../lib/cosmetics'
import { rampRail } from '../lib/ads'
import { IS_APP } from '../lib/platform'
import { watchFor, REWARDED_ON } from '../lib/rewardedAd'

function fmtHeight(inches) {
  return `${Math.floor(inches / 12)}'${inches % 12}"`
}

function parseHtToIn(ht) {
  if (!ht) return null
  const m = ht.match(/^(\d+)'(\d+)/)
  return m ? +m[1] * 12 + +m[2] : null
}

function gradeColor(val0) {
  const val = Math.round(val0 ?? 0)   // rounded like the letter (valToGrade), so a B- is always green
  if (val >= 11) return '#a855f7'
  if (val >= 8)  return '#3b82f6'
  if (val >= 5)  return '#22c55e'
  if (val >= 2)  return '#eab308'
  if (val >= 1)  return '#f97316'
  return '#ef4444'
}

const ITEM_H  = 44
const CENTER  = 2
const IDLE_MS = 1200
const FAST_MS = 36   // ms per item at peak speed — defines MAX_VEL

// ─── Slot Reel ───────────────────────────────────────────────────────────────
// Same item on both sides of a reel, even when the pool was re-mapped (custom ratings)
const reelKey = x => `${x?.name}|${x?.team ?? x?.short}`

function SlotReel({ label, items, spinning, idle, locked, getDisplay, getSub, onStop, blurred, fast, durationMs = 1400, jitterMs = 500, target = null }) {
  const COPIES = useMemo(() => {
    const loopH  = items.length * ITEM_H
    const needed = Math.ceil(14000 / Math.max(loopH, 1))
    return Math.max(3, Math.min(needed, Math.ceil(99 / Math.max(items.length, 1))))
  }, [items])
  const allItems = useMemo(
    () => Array.from({ length: COPIES }, () => items).flat(),
    [items, COPIES]
  )
  const initOffset = useMemo(
    () => Math.floor(COPIES / 2) * items.length * ITEM_H + CENTER * ITEM_H,
    [COPIES, items]
  )

  const posRef       = useRef(initOffset)
  const trackRef     = useRef(null)
  const rafRef       = useRef(null)
  const stopRef      = useRef(null)
  const prevItemsRef = useRef(items)
  const onStopRef    = useRef(onStop)
  onStopRef.current  = onStop
  const windowRef    = useRef(null)

  // The drum: the rows tilt away from the middle like a slot machine's reel. Looks only:
  // the spin, its timing and where it stops are all the track's position (posRef), untouched.
  // Only the ~8 rows in the window are touched each frame.
  const drum = (pos, transition = '') => {
    const track = trackRef.current, win = windowRef.current
    if (!track || !win) return
    const h = win.clientHeight || 5 * ITEM_H
    const off = track.offsetTop - (pos - CENTER * ITEM_H)    // where row 0 sits in the window
    const first = Math.max(0, Math.floor(-off / ITEM_H) - 1)
    const last = Math.min(track.children.length - 1, first + Math.ceil(h / ITEM_H) + 2)
    for (let i = first; i <= last; i++) {
      const el = track.children[i]
      const d = (off + i * ITEM_H + ITEM_H / 2 - h / 2) / (h / 2)   // -1 top edge · 0 middle · 1 bottom edge
      if (el.__dt !== transition) { el.style.transition = transition; el.__dt = transition }
      el.style.transform = `rotateX(${(-d * 48).toFixed(2)}deg)`
    }
  }

  // After every React render, sync the DOM transform to posRef so React can
  // never overwrite our direct DOM updates with a stale value.
  useLayoutEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`
      drum(posRef.current)
    }
  })

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    clearTimeout(stopRef.current)

    const itemsChanged = prevItemsRef.current !== items
    prevItemsRef.current = items

    if (itemsChanged) {
      const randomShift = Math.floor(Math.random() * items.length) * ITEM_H
      posRef.current = initOffset + randomShift
      if (trackRef.current) {
        trackRef.current.style.transition = 'none'
        trackRef.current.style.transform  = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`
        drum(posRef.current)
      }
      if (!spinning && !idle) return
    }

    // One full cycle of items in pixels — subtracting this is visually invisible
    const loopH = items.length * ITEM_H

    const wrap = () => {
      if (posRef.current >= initOffset + loopH) posRef.current -= loopH
    }

    if (spinning && target) {
      // Fixed outcome (Daily Challenge): same speed curve as a normal spin, but
      // driven by distance so it always comes to rest on `target`.
      const duration = fast ? 1000 : durationMs + jitterMs / 2
      const KICK = 0.45
      const area = KICK + (1 - KICK) * 0.5                  // ∫ of the velocity curve over 0..1
      const start = posRef.current
      const len = items.length
      const tKey = reelKey(target)
      let end = Math.ceil((start + (ITEM_H / FAST_MS) * duration * area) / ITEM_H)
      for (let n = 0; n < len && reelKey(items[((end % len) + len) % len]) !== tKey; n++) end++
      const dist = end * ITEM_H - start
      const startTime = performance.now()
      if (trackRef.current) trackRef.current.style.transition = 'none'
      const ease = t => {
        if (t < KICK) return t / area
        const u = (t - KICK) / (1 - KICK)
        return (KICK + (1 - KICK) * (u - u * u * u + (u * u * u * u) / 2)) / area
      }
      const frame = now => {
        const t = Math.min((now - startTime) / duration, 1)
        let pos = start + dist * ease(t)
        const over = pos - initOffset - loopH
        if (over >= 0) pos -= Math.ceil((over + 1) / loopH) * loopH
        posRef.current = pos
        if (trackRef.current) { trackRef.current.style.transform = `translate3d(0,${-(pos - CENTER * ITEM_H)}px,0)`; drum(pos) }
        if (t < 1) { rafRef.current = requestAnimationFrame(frame); return }
        stopRef.current = setTimeout(() => {
          const idx = Math.round(posRef.current / ITEM_H)
          const winner = items[((idx % len) + len) % len]
          if (onStopRef.current) onStopRef.current(winner)
        }, 150)
      }
      rafRef.current = requestAnimationFrame(frame)

    } else if (spinning) {
      const duration = fast
        ? 900 + Math.random() * 200
        : durationMs + Math.random() * jitterMs
      const startTime = performance.now()
      const speedMult = 0.93 + Math.random() * 0.10  // subtle ±5% speed variance
      const MAX_VEL   = (ITEM_H / FAST_MS) * speedMult
      let lastFrame   = startTime

      // Set transition once — not every frame
      if (trackRef.current) trackRef.current.style.transition = 'none'

      const frame = (now) => {
        const elapsed = now - startTime
        const t       = Math.min(elapsed / duration, 1.0)

        // Full speed until KICK, then smoothstep S-curve to zero
        const KICK  = 0.45
        const t2    = t < KICK ? 0 : (t - KICK) / (1 - KICK)
        const eased = t2 * t2 * (3 - 2 * t2)

        const vel = MAX_VEL * (1 - eased)               // px/ms, peaks then tapers to 0
        const dt  = Math.min(now - lastFrame, 50)        // cap delta to guard against tab-switch jank
        lastFrame = now

        posRef.current += vel * dt
        wrap()

        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`
          drum(posRef.current)
        }

        if (t >= 1.0) {
          // Short ease-out snap to nearest item boundary
          const snapped      = Math.round(posRef.current / ITEM_H) * ITEM_H
          posRef.current     = snapped
          if (trackRef.current) {
            trackRef.current.style.transition = 'transform 140ms cubic-bezier(0.25,0.46,0.45,0.94)'
            trackRef.current.style.transform  = `translate3d(0,${-(snapped - CENTER * ITEM_H)}px,0)`
            drum(snapped, 'transform 140ms cubic-bezier(0.25,0.46,0.45,0.94)')   // the rows settle with the snap
          }
          stopRef.current = setTimeout(() => {
            if (trackRef.current) { trackRef.current.style.transition = 'none'; drum(snapped) }
            const idx    = Math.round(snapped / ITEM_H)
            const winner = items[((idx % items.length) + items.length) % items.length]
            if (onStopRef.current) onStopRef.current(winner)
          }, 150)
        } else {
          rafRef.current = requestAnimationFrame(frame)
        }
      }

      rafRef.current = requestAnimationFrame(frame)

    } else if (idle) {
      const VEL     = ITEM_H / IDLE_MS   // px/ms at idle speed
      let lastFrame = performance.now()

      if (trackRef.current) trackRef.current.style.transition = 'none'

      const frame = (now) => {
        const dt  = Math.min(now - lastFrame, 50)
        lastFrame = now
        posRef.current += VEL * dt
        wrap()
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`
          drum(posRef.current)
        }
        rafRef.current = requestAnimationFrame(frame)
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(stopRef.current)
    }
  }, [spinning, idle, items, initOffset, fast]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`reel-outer${spinning ? ' reel-spinning' : ''}${locked ? ' reel-locked' : ''}${blurred ? ' reel-blurred' : ''}`}>
      <div className="reel-label">{label}</div>
      <div ref={windowRef} className="reel-window is-drum">
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

// ─── Chip ────────────────────────────────────────────────────────────────────
function Chip({ type, spin = null, meta, val, selectedQB, draggingType, onChipTap, onDragStart, onDragEnd, setDraggingType, hideGrades, headshotsMap, headshotsDir, isBucket, isWR, headshotFallback = () => null }) {
  const photo = headshotsMap[selectedQB.name] ? `${headshotsDir}${headshotsMap[selectedQB.name]}.webp` : headshotFallback(selectedQB.skin)
  const chipData = {
    type, val,
    qb: selectedQB.short, qbFull: selectedQB.name,
    teamColor: selectedQB.color, teamColor2: selectedQB.color2,
    skinColor: selectedQB.skin, number: selectedQB.number,
    team: selectedQB.team, captain: selectedQB.captain ?? false, photo,
    height: selectedQB.height ?? parseHtToIn(selectedQB.ht), weight: selectedQB.weight ?? selectedQB.wt ?? null,
    attrs: selectedQB.attrs ?? null,
    subpos: selectedQB.subpos ?? null,
    ...(spin ? { spin } : {}),
  }
  return (
    <div
      className={`attr-chip attr-chip-${type}${draggingType === type ? ' chip-dragging' : ''}`}
      style={{ '--chip-col': hideGrades ? '#64748b' : gradeColor(val), '--chip-team': selectedQB.color }}
      draggable
      onClick={() => onChipTap && onChipTap(chipData)}
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', type)
        const ghost = document.createElement('div')
        ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:150px;border-radius:5px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,0.55);pointer-events:none;font-family:Outfit,sans-serif;'
        ghost.innerHTML = `<div style="display:flex;align-items:stretch;background:#fff;">${photo ? `<img src="${photo}" style="width:42px;height:42px;object-fit:cover;object-position:top center;flex-shrink:0;display:block;" />` : ''}<span style="font-size:11px;font-weight:900;color:#e8192c;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;display:flex;align-items:center;padding:0 7px;line-height:1.2;">${selectedQB.name}</span></div>`
        document.body.appendChild(ghost)
        e.dataTransfer.setDragImage(ghost, 75, 21)
        requestAnimationFrame(() => document.body.removeChild(ghost))
        onDragStart(chipData)
      }}
      onDragEnd={onDragEnd}
    >
      {photo && <img src={photo} alt="" className="chip-photo" />}
      <div className="chip-text">
        <span className="chip-name">{meta.label}</span>
        <span className="chip-qb">{selectedQB.name}</span>
      </div>
      <span className="chip-val" style={hideGrades ? { visibility: 'hidden' } : undefined}>{valToGrade(val)}</span>
      <span className="chip-hint">drag</span>
    </div>
  )
}

const POS_COLORS = {
  QB: '#fb923c', RB: '#60a5fa', WR: '#34d399', TE: '#a78bfa',
  OL: '#fbbf24', DL: '#f87171', LB: '#2dd4bf', DB: '#e879f9',
  K: '#94a3b8',  P: '#94a3b8',
  PG: '#7dd3fc', SG: '#86efac', SF: '#fdba74', PF: '#d8b4fe', C: '#fca5a5',
}

// Hide or show the grades on the spin's chips. Shared: the spin's own switch and
// the phone navbar's both set it, and both follow it.
export const gradesHiddenNow = () => { try { return localStorage.getItem('bap-hide-grades') === 'true' } catch { return false } }
export function setGradesHidden(v) {
  try { localStorage.setItem('bap-hide-grades', String(!!v)) } catch {}
  window.dispatchEvent(new CustomEvent('bap:grades', { detail: !!v }))
}
// ─── SpinScreen ──────────────────────────────────────────────────────────────
export default function SpinScreen({ build, activeDrag, onDragStart, onDragEnd, activeCategory, resetKey, onChipTap, types = TYPES, isLite = false, qbPool = QBS, savedResult = null, onSaveResult, onPhaseChange, gameKey, onReset, adsDisabled = false, isRB = false, isWR = false, isTE = false, isDB = false, isOL = false, isAllTime = false, isBucket = false, isVersusMode = false, attrMap = ATTR, categoriesData = CATEGORIES, teamsPool = TEAMS, logoDir = '/logos/', playerLabel, headshotsMap = HEADSHOTS, headshotsDir = `${HEADSHOT_BASE}/`, hideTeamResult = false, headshotFallback = () => null, seedPlan: seedPlanProp = null, cardMeta = null, paused = false, gradesHidden = false }) {
  // the player's reel skin (the shop's Reel Skins: app-shop.css .rs-*)
  const equippedReel = useProgress().equip?.reel
  const reelSkin = itemById(equippedReel)?.slot === 'reel' ? equippedReel : null
  // live competitive modes (1v1, Compete pools): the grades stay hidden, no toggle
  const forceHide = isVersusMode || gradesHidden
  const pLabel = playerLabel ?? (isTE ? 'TE' : isWR ? 'WR' : isRB ? 'RB' : 'QB')
  // one player respin (OL gets a 2nd); the app can earn one more with a video
  const [qbRespinBonus, setQbRespinBonus] = useState(() => savedResult?.qbRespinBonus ?? 0)
  const maxPlayerRespin = (isOL ? 2 : 1) + qbRespinBonus
  const [phase, setPhase]               = useState(() => savedResult?.selectedQB ? 'done' : 'idle')
  const [selectedTeam, setSelectedTeam] = useState(() => savedResult?.selectedTeam ?? null)
  const [selectedQB,   setSelectedQB]   = useState(() => savedResult?.selectedQB ?? null)
  const [qbRespinUsed,   setQbRespinUsed]   = useState(() => savedResult?.qbRespinUsed   ?? 0)
  const [teamRespinUsed, setTeamRespinUsed] = useState(() => savedResult?.teamRespinUsed ?? 0)
  const [excludedQB,     setExcludedQB]     = useState(null)
  const [draggingType, setDraggingType] = useState(null)
  const [spinCount, setSpinCount]       = useState(0)
  const [hideGrades,   setHideGrades]   = useState(() => localStorage.getItem('bap-hide-grades') === 'true')

  const toggleGrades = () => setGradesHidden(!hideGrades)
  // the switch can also live in the navbar (phones): stay in step with it
  useEffect(() => { const on = e => setHideGrades(!!e.detail); window.addEventListener('bap:grades', on); return () => window.removeEventListener('bap:grades', on) }, [])
  const usedTeamsRef = useRef([])
  const pauseRef = useRef(null)
  // App: every revealed player goes to the card binder ('bap:spin' → lib/progress.js)
  const cardMetaRef = useRef(cardMeta)
  cardMetaRef.current = cardMeta
  const poolRef = useRef(qbPool)
  poolRef.current = qbPool
  // Every other build deals from its own seed too (a fresh one each build, kept with the
  // build's saved spin), so a reload in the middle of a spin deals the same player again:
  // reloading used to be a free reroll of any spin you didn't like
  const newSeed = () => `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const [autoSeed, setAutoSeed] = useState(() => (!seedPlanProp && savedResult?.seed) || newSeed())
  const autoPlan = useMemo(() => (seedPlanProp ? null : { seed: autoSeed, getStart: () => 0, onSpin: () => {}, separateRespins: true, respinSeed: `${autoSeed}:r` }), [seedPlanProp, autoSeed])
  const seedPlan = seedPlanProp ?? autoPlan
  // Daily Challenge: team spin #n lands on the nth team of the day's seeded
  // order (counted across visits, so leaving and coming back can't re-roll it)
  const spinBase = useRef(seedPlanProp ? seedPlanProp.getStart() : (savedResult?.si ?? 0))
  const spinCountRef = useRef(0)
  const [playerDraw, setPlayerDraw] = useState(0)
  // Compete (seedPlan.separateRespins): respins are this player's own draw and
  // don't use up the pool's shared order — the next regular spin is back on it
  const ownSpins = !!seedPlan?.separateRespins
  const seedSpinsRef = useRef(0)
  const [seedSpins, setSeedSpins] = useState(0)
  const [freeTeam, setFreeTeam] = useState(false)

  const complete = types.every(t => build[t])

  const clearAll = () => clearTimeout(pauseRef.current)

  // a reset (a new build) clears the reels. Only a change of resetKey: opening the screen again
  // (out to Profile, Shop… and back) must not, or the spin you saved is wiped and you get a
  // free reroll (people were using that to throw away a bad spin)
  const resetRef = useRef(resetKey)
  useEffect(() => {
    if (resetRef.current === resetKey) return
    resetRef.current = resetKey
    usedTeamsRef.current = []
    clearAll()
    setPhase('idle')
    setSelectedTeam(null)
    setSelectedQB(null)
    setExcludedQB(null)
    setDraggingType(null)
    adInvokedRef.current = false
    const panel = document.querySelector('.spin-panel')
    if (panel) panel.scrollTop = 0
  }, [resetKey])

  useEffect(() => () => clearAll(), [])

  useEffect(() => {
    if (!onSaveResult) return
    // a build's own seed, and the spin to deal next (si): what a reload picks up from
    const at = spinBase.current + seedSpins
    const own = autoPlan ? { seed: autoPlan.seed } : {}
    if (phase === 'done' && selectedQB) onSaveResult({ selectedTeam, selectedQB, qbRespinUsed, teamRespinUsed, qbRespinBonus, ...own, ...(autoPlan ? { si: at } : {}) })
    // between spins the build's re-spins used still count (a reload doesn't hand them back)
    else if (phase === 'idle') onSaveResult(qbRespinUsed || teamRespinUsed || qbRespinBonus || autoPlan ? { qbRespinUsed, teamRespinUsed, qbRespinBonus, ...own, ...(autoPlan ? { si: at } : {}) } : null)
    // mid-spin: this spin is already dealt (a reload deals it again) and a respin is spent
    else onSaveResult({ qbRespinUsed, teamRespinUsed, qbRespinBonus, ...own, ...(autoPlan ? { si: Math.max(0, at - 1) } : {}) })
  }, [phase, selectedTeam, selectedQB, qbRespinUsed, teamRespinUsed, qbRespinBonus, seedSpins, autoPlan]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (onPhaseChange) onPhaseChange(phase)
  }, [phase])

  // a new build gets its re-spins back; loading the same build (a reload) keeps what's used
  const keyRef = useRef(gameKey)
  useEffect(() => {
    if (keyRef.current === gameKey) return
    keyRef.current = gameKey
    setQbRespinUsed(0)
    setTeamRespinUsed(0)
    setQbRespinBonus(0)
    // a new build: a new seed, dealt from its first spin
    if (!seedPlanProp) { setAutoSeed(newSeed()); spinBase.current = 0; seedSpinsRef.current = 0; setSeedSpins(0) }
  }, [gameKey])

  // Team reel calls this when it naturally halts
  const handleTeamStop = useCallback((team) => {
    setSelectedTeam(team)
    usedTeamsRef.current = [...usedTeamsRef.current, team]
    setPhase('team-done')
    pauseRef.current = setTimeout(() => setPhase('qb'), 300)
  }, [])

  // QB reel calls this when it naturally halts
  const handleQBStop = useCallback((qb) => {
    setSelectedQB(qb)
    setPhase('done')
    if (cardMetaRef.current) {
      window.dispatchEvent(new CustomEvent('bap:spin', { detail: { ...cardMetaRef.current, player: qb, pool: poolRef.current } }))
    }
  }, [])

  const countTeamSpin = (respin = false) => {
    spinCountRef.current += 1
    setSpinCount(spinCountRef.current)
    setPlayerDraw(0)
    const own = ownSpins && respin
    setFreeTeam(own)
    if (!own) { seedSpinsRef.current += 1; setSeedSpins(seedSpinsRef.current) }
    seedPlan?.onSpin(spinBase.current + (ownSpins ? seedSpinsRef.current : spinCountRef.current))
  }

  const adInvokedRef = useRef(false)

  // a spin brings the bottom rail back (it replaced the banner that sat under the
  // player card): requested again, closed or not, at most every 30 s (lib/ads.js)
  const triggerMobileAd = useCallback(() => {
    if (adsDisabled) return
    rampRail()
  }, [adsDisabled])

  const handleSpin = useCallback(() => {
    clearAll()
    setSelectedTeam(null)
    setSelectedQB(null)
    setExcludedQB(null)
    countTeamSpin()
    setPhase('team')
    triggerMobileAd()
    track('spin', {
      app: isBucket ? 'bucket' : 'nfl',
      position: isBucket ? 'bucket' : isOL ? 'ol' : isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : isRB ? 'rb' : 'qb',
      gameMode: isLite ? 'lite' : null,
    })
  }, [onSaveResult, triggerMobileAd, isBucket, isOL, isDB, isTE, isWR, isRB, isLite]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleQBRespin = useCallback(() => {
    setExcludedQB(selectedQB)
    setQbRespinUsed(n => n + 1)
    setPlayerDraw(d => d + 1)
    setSelectedQB(null)
    setPhase('qb')
  }, [selectedQB])

  // Out of player respins (app only, never in a live competitive mode): a video
  // earns one more, once a build
  const [adBusy, setAdBusy] = useState(false)
  const [adNote, setAdNote] = useState('')
  const canEarn = REWARDED_ON && IS_APP && !isVersusMode && !seedPlanProp && qbRespinBonus === 0
  const earnRespin = async () => {
    if (adBusy) return
    setAdBusy(true); setAdNote('')
    const r = await watchFor()
    setAdBusy(false)
    if (r.ok) setQbRespinBonus(1)
    else setAdNote(r.note)
    setTimeout(() => setAdNote(''), 3500)
  }

  const handleTeamRespin = useCallback(() => {
    clearAll()
    setSelectedQB(null)
    setSelectedTeam(null)
    setExcludedQB(null)
    setTeamRespinUsed(n => n + 1)
    countTeamSpin(true)
    setPhase('team')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isSpinningTeam = phase === 'team'
  const isSpinningQB   = phase === 'qb'
  const isSpinning     = isSpinningTeam || phase === 'team-done' || isSpinningQB
  const isDone         = phase === 'done'

  // Teams that have someone to draft in this pool, as a string so the reel
  // memo below only re-runs when that set actually changes (sandbox mode
  // hands in a freshly mapped pool array on every render).
  const draftableTeams = [...new Set(qbPool.map(q => q.team))].sort().join(',')

  const teamReelItems = useMemo(() => {
    // Only teams with someone to draft — landing on a team with no players
    // leaves the player reel empty and the spin stuck.
    const draftable = new Set(draftableTeams.split(','))
    const teams = teamsPool.some(t => draftable.has(t.short)) ? teamsPool.filter(t => draftable.has(t.short)) : teamsPool
    const usedShorts = new Set(seedPlan ? [] : usedTeamsRef.current.map(t => t.short))
    const eligible = teams.filter(t => !usedShorts.has(t.short))
    const pool = eligible.length > 0 ? eligible : [...teams]
    const finalPool = [...pool]
    for (let i = finalPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[finalPool[i], finalPool[j]] = [finalPool[j], finalPool[i]]
    }
    return finalPool
  }, [spinCount, teamsPool, draftableTeams])

  // Stable QB items — minimal placeholder until team is selected (QB reel is blurred/hidden)
  const qbReelItems = useMemo(() => {
    if (!selectedTeam) return qbPool.slice(0, 3)
    const base = qbPool.filter(q => q.team === selectedTeam.short)
    const arr = excludedQB ? base.filter(q => q !== excludedQB) : [...base]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [selectedTeam, excludedQB, spinCount])

  // Daily Challenge outcomes
  const teamIndex = spinBase.current + (ownSpins ? seedSpins : spinCount) - 1
  const teamTarget = useMemo(() => {
    if (!seedPlan || spinCount < 1) return null
    const sorted = [...teamReelItems].sort((a, b) => a.short.localeCompare(b.short))
    // Compete: a respin is this seat's own draw, seeded too (respinSeed) so the server can check it
    if (freeTeam) return seedPlan.respinSeed ? seededShuffle(sorted, `${seedPlan.respinSeed}:teams:${teamIndex}`)[0] ?? null : null
    const order = seededShuffle(sorted, `${seedPlan.seed}:teams`)
    return order[teamIndex % order.length]
  }, [seedPlan, spinCount, teamReelItems, teamIndex, freeTeam])
  const playerTarget = useMemo(() => {
    // a respun team or a player respin is the player's own draw (seeded by the seat in Compete)
    const own = ownSpins && (freeTeam || playerDraw > 0)
    if (!seedPlan || !selectedTeam || (own && !seedPlan.respinSeed)) return null
    const roster = qbPool.filter(q => q.team === selectedTeam.short).sort((a, b) => a.name.localeCompare(b.name))
    if (!roster.length) return null
    if (own) {
      const mine = seededShuffle(roster, `${seedPlan.respinSeed}:${teamIndex}:${selectedTeam.short}`)
      // a respun team: its own draws in order
      if (freeTeam) return mine[playerDraw % mine.length]
      // a player respin: never the player this spin dealt
      const dealt = seededShuffle(roster, `${seedPlan.seed}:${teamIndex}:${selectedTeam.short}`)[0]
      const rest = mine.filter(p => p.name !== dealt?.name)
      return rest.length ? rest[(playerDraw - 1) % rest.length] : mine[0]
    }
    const order = seededShuffle(roster, `${seedPlan.seed}:${teamIndex}:${selectedTeam.short}`)
    return order[playerDraw % order.length]
  }, [seedPlan, selectedTeam, teamIndex, playerDraw, freeTeam]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compete: which seeded draw this player came from, so the server can check it
  // (competeCore dealtBy): spin #i, a regular spin, a player respin or a team respin
  const chipSpin = seedPlan?.respinSeed ? { i: teamIndex, how: freeTeam ? 'tr' : playerDraw > 0 ? 'pr' : 'spin', d: playerDraw } : null

  const visibleCategories = isRB ? RB_CATEGORIES : categoriesData
  const hasAvailableChips = isDone && selectedQB && visibleCategories.some(cat =>
    cat.types.some(type => types.includes(type) && !build[type])
  )

  // Preload headshots + logo while QB reel is spinning so card appears instantly
  useEffect(() => {
    if (!selectedTeam) return
    const logo = new Image()
    logo.src = `${logoDir}${selectedTeam.short}.png`
    qbReelItems.forEach(qb => {
      const file = headshotsMap[qb.name]
      if (file) {
        const img = new Image()
        img.src = `${headshotsDir}${file}.webp`
      }
    })
  }, [selectedTeam, qbReelItems])


  return (
    <div className="spin-panel-wrap">
      {onReset && (
        <button className="spin-panel-reset-tab" onClick={onReset}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          <span>Reset</span>
        </button>
      )}
    <aside className="spin-panel">
      {isSpinning && <div className="spin-blocker" />}
      <div className="spin-panel-body">
        <div className="spin-panel-static">
          <div className="spin-top-row">
            {!forceHide && (
              <button className={`grade-toggle-btn${hideGrades ? ' grade-toggle-off' : ' grade-toggle-on'}`} onClick={toggleGrades}>
                {hideGrades ? 'TURN ON GRADES' : 'TURN OFF GRADES'}
              </button>
            )}
          </div>
          <div className={`reels-wrap${reelSkin ? ` rs-on ${reelSkin}` : ''}`}>
            <div className="reel-tri reel-tri-l" />
            <div className="reels-row">
              <SlotReel
                label="TEAM"
                items={teamReelItems}
                spinning={isSpinningTeam}
                idle={!paused && !isSpinning && !selectedTeam}
                locked={!!selectedTeam}
                blurred={hideTeamResult && !!selectedTeam}
                getDisplay={t => t.short}
                getSub={t => t.name.split(' ').slice(-1)[0]}
                onStop={handleTeamStop}
                durationMs={800}
                jitterMs={1000}
                target={teamTarget}
              />
              <SlotReel
                label={pLabel}
                items={qbReelItems}
                spinning={isSpinningQB}
                idle={!paused && !isSpinning && !selectedQB}
                locked={!!selectedQB && phase === 'done'}
                getDisplay={q => q.name.split(' ')[0]}
                getSub={q => q.name.split(' ').slice(1).join(' ')}
                onStop={handleQBStop}
                durationMs={1100}
                jitterMs={400}
                blurred={phase === 'team' || phase === 'team-done'}
                fast={qbRespinUsed > 0}
                target={playerTarget}
              />
            </div>
            <div className="reel-tri reel-tri-r" />
          </div>

          <div className="spin-btn-wrap">
            {adNote && <p className="spin-ad-note" role="status">{adNote}</p>}
            {isDone && !complete ? (
              <div className="spin-respin-split">
                <button
                  className={`spin-respin-half spin-respin-team${teamRespinUsed >= 1 ? ' spin-respin-used' : ''}`}
                  onClick={teamRespinUsed < 1 ? handleTeamRespin : undefined}
                  disabled={teamRespinUsed >= 1}
                  onPointerDown={e => {
                    if (teamRespinUsed >= 1) return
                    const el = e.currentTarget
                    el.style.transform = 'scale(0.97) translateZ(0)'
                    setTimeout(() => { el.style.transform = '' }, 160)
                  }}
                >
                  RESPIN TEAM <span className="spin-btn-badge">{Math.max(0, 1 - teamRespinUsed)}</span>
                </button>
                <div className="spin-respin-divider" />
                {qbRespinUsed >= maxPlayerRespin && canEarn ? (
                  <button className="spin-respin-half spin-respin-player spin-respin-earn" onClick={earnRespin} disabled={adBusy}>
                    {adBusy ? 'LOADING…' : 'WATCH VIDEO'} <span className="spin-btn-badge">AD · +1</span>
                  </button>
                ) : <button
                  className={`spin-respin-half spin-respin-player${qbRespinUsed >= maxPlayerRespin ? ' spin-respin-used' : ''}`}
                  onClick={qbRespinUsed < maxPlayerRespin ? handleQBRespin : undefined}
                  disabled={qbRespinUsed >= maxPlayerRespin}
                  onPointerDown={e => {
                    if (qbRespinUsed >= maxPlayerRespin) return
                    const el = e.currentTarget
                    el.style.transform = 'scale(0.97) translateZ(0)'
                    setTimeout(() => { el.style.transform = '' }, 160)
                  }}
                >
                  RESPIN {pLabel} <span className="spin-btn-badge">{Math.max(0, maxPlayerRespin - qbRespinUsed)}</span>
                </button>}
              </div>
            ) : (
              <button
                className={`spin-btn${isDone && complete ? ' spin-btn-wait' : ''}`}
                onClick={handleSpin}
                disabled={isSpinning || complete}
              >
                SPIN
              </button>
            )}
            {onReset && (
              <button className="spin-reset-circle" onClick={onReset} disabled={phase === 'team' || phase === 'team-done' || phase === 'qb'} aria-label="Reset build">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                <span className="spin-reset-circle-lbl">Reset</span>
              </button>
            )}
          </div>


          {isDone && selectedQB && (
            <div className="qb-reveal-card" style={{ '--qb-color': selectedQB.color }}>
              <div className="qb-reveal-hero">
                <QBAvatar
                  photo={headshotsMap[selectedQB.name] ? `${headshotsDir}${headshotsMap[selectedQB.name]}.webp` : headshotFallback(selectedQB.skin)}
                  team={selectedQB.team}
                  color={selectedQB.color}
                  size={56}
                  logoDir={logoDir}
                />
              </div>
              <div className="qb-reveal-text">
                <div className="qb-reveal-name">{selectedQB.name}</div>
                <div className="qb-reveal-meta">
                  {selectedQB.teamName ?? selectedQB.team}
                  {isOL && selectedQB.pos ? ` · ${selectedQB.pos}` : ''}
                  {!isBucket && !isWR && (selectedQB.starter ? '' : ' · Bench')}
                </div>
                {selectedQB.years && (
                  <div className="qb-reveal-year">{selectedQB.years}</div>
                )}
              </div>
              {selectedQB.position && (
                <div className="qb-reveal-pos" style={{ background: POS_COLORS[selectedQB.position] ?? selectedQB.color }}>
                  {selectedQB.position}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="spin-panel-scroll">
          {isDone && selectedQB && (
            hasAvailableChips ? (
              <>
                {(isLite || types.length <= 4)
                  ? types.filter(t => !build[t]).map(t => {
                      const meta = attrMap[t]
                      const val  = selectedQB.attrs[t]
                      return <Chip key={t} spin={chipSpin} type={t} meta={meta} val={val} selectedQB={selectedQB} draggingType={draggingType} onChipTap={onChipTap} onDragStart={onDragStart} onDragEnd={onDragEnd} setDraggingType={setDraggingType} hideGrades={forceHide || hideGrades} headshotsMap={headshotsMap} headshotsDir={headshotsDir} isBucket={isBucket} isWR={isWR} headshotFallback={headshotFallback} />
                    })
                  : visibleCategories.map((cat, catIdx) => {
                      const available = cat.types.filter(type => types.includes(type) && !build[type])
                      if (!available.length) return null
                      return (
                        <div key={cat.id} className="attr-category-section">
                          <div className="attr-category-hd">
                            <div className="attr-category-line" />
                            <span className="attr-category-lbl">{cat.label}</span>
                            <div className="attr-category-line" />
                          </div>
                          {available.map(type => {
                            const meta = attrMap[type]
                            const val  = selectedQB.attrs[type]
                            return <Chip key={type} spin={chipSpin} type={type} meta={meta} val={val} selectedQB={selectedQB} draggingType={draggingType} onChipTap={onChipTap} onDragStart={onDragStart} onDragEnd={onDragEnd} setDraggingType={setDraggingType} hideGrades={forceHide || hideGrades} headshotsMap={headshotsMap} headshotsDir={headshotsDir} isBucket={isBucket} isWR={isWR} headshotFallback={headshotFallback} />
                          })}
                        </div>
                      )
                    })
                }
              </>
            ) : (
              <div className="spin-hint-text">
                {complete ? 'All slots filled' : `All available slots filled for this ${pLabel}`}
              </div>
            )
          )}

          {!isDone && (
            <div className="spin-hint-text" style={{ marginBottom: '40px' }}>
              Spin to select an attribute for your build.
            </div>
          )}

          {complete && (
            <div className="spin-hint-text" style={{ color: 'var(--accent)', paddingTop: 4 }}>
              All {types.length} slots filled — simulate your season
            </div>
          )}
        </div>
      </div>
    </aside>
    </div>
  )
}
