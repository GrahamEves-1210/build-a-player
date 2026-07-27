import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { getQBPhoto, pickThree } from '../data/depth-chart-players'
import { supabase } from '../lib/supabase'
import { TEAMS } from '../data/qbs'
import QBAvatar from './QBAvatar'

const TEAM_COLOR  = Object.fromEntries(TEAMS.map(t => [t.short, t.color]))
const SLOT_LABELS = ['STARTER', '2ND STRING', '3RD STRING']
const TIMER_MS    = 10000
const SORT_STATS  = ['passingTDs', 'passingYards', 'rushingYards']

function streakColor(n) {
  if (n === 0) return 'rgba(255,255,255,0.5)'
  if (n <= 2)  return '#fff'
  if (n <= 15) {
    const t = Math.min(1, (n - 3) / 12)
    const hue = Math.round(45 * (1 - t))
    return `hsl(${hue}, 100%, 57%)`
  }
  if (n < 20) return 'hsl(0, 100%, 57%)'
  const t = Math.min(1, (n - 20) / 15)
  const hue = (360 - Math.round(120 * t)) % 360
  const lightness = Math.round(57 + 13 * t)
  return `hsl(${hue}, 100%, ${lightness}%)`
}
const STAT_LABELS = { passingTDs: 'PASSING TDs', passingYards: 'PASSING YDS', rushingYards: 'RUSH YDS' }

function pickSortStat() {
  const r = Math.random()
  return r < 0.4 ? 'passingTDs' : r < 0.8 ? 'passingYards' : 'rushingYards'
}

// ── Leaderboard dropdown ───────────────────────────────────────────────────
function LeaderboardDropdown({ onClose }) {
  const [rows,         setRows]         = useState(null)
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    if (!supabase) { setRows([]); return }
    supabase
      .from('depth_chart_streaks')
      .select('username, streak')
      .order('streak', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10)
      .then(({ data }) => setRows(data || []))
      .catch(() => setRows([]))
  }, [])

  useEffect(() => {
    if (!rows || rows.length === 0) return
    setVisibleCount(0)
    let i = 0
    const id = setInterval(() => {
      i++
      setVisibleCount(i)
      if (i >= rows.length) clearInterval(id)
    }, 50)
    return () => clearInterval(id)
  }, [rows])

  return (
    <>
      <div className="dc-lb-backdrop" onClick={onClose} />
      <div className="dc-lb-dropdown">
        <div className="dc-lb-dropdown-accent" />
        <div className="dc-lb-dropdown-header">
          <span className="dc-lb-dropdown-title">TOP STREAKS</span>
        </div>
        {rows !== null && rows.length === 0 && (
          <div className="dc-lb-empty">No scores yet — be the first</div>
        )}
        {rows !== null && rows.slice(0, visibleCount).map((r, i) => (
          <div key={i} className={`dc-lb-row${i === 0 ? ' dc-lb-row--top' : ''}`}>
            <span className="dc-lb-rank">{i + 1}</span>
            <span className="dc-lb-name">{r.username || 'Anonymous'}</span>
            <span className="dc-lb-streak" style={{ color: streakColor(r.streak) }}>{r.streak}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function DepthChart({ onBack, user, onlineCount = 0 }) {
  const [players,        setPlayers]        = useState(null)
  const [order,          setOrder]          = useState([0, 1, 2])
  const [revealed,       setRevealed]       = useState([false, false, false])
  const [dragSrc,        setDragSrc]        = useState(null)
  const [dragDst,        setDragDst]        = useState(null)
  const [phase,          setPhase]          = useState('ready')
  const [streak,         setStreak]         = useState(0)
  const [bestStreak,     setBestStreak]     = useState(0)
  const [showLB,         setShowLB]         = useState(false)
  const [timerPct,       setTimerPct]       = useState(1)
  const [hasInteracted,  setHasInteracted]  = useState(false)
  const [sortStat,       setSortStat]       = useState('passingTDs')
  const [displayStat,    setDisplayStat]    = useState('passingTDs')
  const [sortSpinning,   setSortSpinning]   = useState(false)
  const [promptStreak,   setPromptStreak]   = useState(null)
  const [promptName,     setPromptName]     = useState('')

  const cardRefs    = useRef([])
  const flipSnap    = useRef(null)
  const dragState   = useRef({ active: false, srcIdx: null, lastDst: null })
  const timerRafRef = useRef(null)
  const timerStart  = useRef(null)
  const timedOut    = useRef(false)
  const orderRef    = useRef([0, 1, 2])
  const submitRef   = useRef(null)
  const firstRound  = useRef(true)

  // ── Load a new round ───────────────────────────────────────────────────────
  const loadRound = useCallback((prevNames = []) => {
    const next = pickThree(prevNames)
    const newStat = pickSortStat()
    setPlayers(next)
    setSortStat(newStat)
    setSortSpinning(true)
    orderRef.current = [0, 1, 2]
    setOrder([0, 1, 2])
    setDragSrc(null)
    setDragDst(null)
    setHasInteracted(false)
    setRevealed([false, false, false])
    timedOut.current = false
    setPhase(firstRound.current ? 'ready' : 'intro')
  }, [])

  // ── Sort stat spin animation ───────────────────────────────────────────────
  useEffect(() => {
    if (!sortSpinning) return
    let count = 0
    const sequence = [
      SORT_STATS[(SORT_STATS.indexOf(sortStat) + 1) % 3],
      SORT_STATS[(SORT_STATS.indexOf(sortStat) + 2) % 3],
      sortStat,
    ]
    const id = setInterval(() => {
      setDisplayStat(sequence[count % sequence.length])
      count++
      if (count >= sequence.length) {
        setSortSpinning(false)
        clearInterval(id)
      }
    }, 180)
    return () => clearInterval(id)
  }, [sortSpinning, sortStat])

  useEffect(() => {
    if (!sortSpinning) setDisplayStat(sortStat)
  }, [sortSpinning, sortStat])

  useEffect(() => { loadRound() }, [loadRound])

  // Load personal best on mount
  useEffect(() => {
    if (supabase && user) {
      supabase
        .from('depth_chart_streaks')
        .select('streak')
        .eq('user_id', user.id)
        .order('streak', { ascending: false })
        .limit(1)
        .single()
        .then(({ data }) => { if (data) setBestStreak(data.streak) })
    } else {
      const saved = localStorage.getItem('dc_best_streak')
      if (saved) setBestStreak(parseInt(saved, 10) || 0)
    }
  }, [user])

  // Persist best for anonymous users
  useEffect(() => {
    if (!user) localStorage.setItem('dc_best_streak', String(bestStreak))
  }, [bestStreak, user])

  function startRound() { firstRound.current = false; setPhase('intro') }

  // ── One-by-one reveal animation ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'intro' || !players) return
    let cancelled = false
    const delays = [80, 230, 380]
    const timers = delays.map((d, i) =>
      setTimeout(() => {
        if (cancelled) return
        setRevealed(prev => { const n = [...prev]; n[i] = true; return n })
        if (i === 2) setTimeout(() => { if (!cancelled) setPhase('playing') }, 200)
      }, d)
    )
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [phase, players])

  // ── 10-second countdown (playing phase) ───────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') {
      cancelAnimationFrame(timerRafRef.current)
      setTimerPct(1)
      return
    }
    timerStart.current = performance.now()
    const tick = (now) => {
      const elapsed = now - timerStart.current
      const pct = Math.max(0, 1 - elapsed / TIMER_MS)
      setTimerPct(pct)
      if (pct > 0) {
        timerRafRef.current = requestAnimationFrame(tick)
      } else {
        timedOut.current = true
        submitRef.current?.()
      }
    }
    timerRafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(timerRafRef.current)
  }, [phase])

  // ── FLIP animation when correct order is revealed ────────────────────────────
  useLayoutEffect(() => {
    if (!flipSnap.current || !players) return
    const snap = flipSnap.current
    flipSnap.current = null
    order.forEach((playerIdx, newSlotIdx) => {
      const oldRect = snap[players[playerIdx].name]
      const el = cardRefs.current[newSlotIdx]
      if (!el || !oldRect) return
      const dy = oldRect.top - el.getBoundingClientRect().top
      if (Math.abs(dy) < 1) return
      el.style.transition = 'none'
      el.style.transform = `translateY(${dy}px)`
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = 'transform 0.35s cubic-bezier(0.22,1,0.36,1)'
        el.style.transform = ''
        el.addEventListener('transitionend', () => { el.style.transition = ''; el.style.transform = '' }, { once: true })
      }))
    })
  }, [order])

  // ── Correct answer ──────────────────────────────────────────────────────────
  const correctOrder = players
    ? [...players].sort((a, b) => b[sortStat] - a[sortStat])
    : []

  function submitAnswer() {
    if (phase !== 'playing' || !players) return
    const cur = orderRef.current
    const isCorrect = cur.every((playerIdx, slotIdx) => {
      if (slotIdx === 0) return true
      return players[cur[slotIdx - 1]][sortStat] >= players[playerIdx][sortStat]
    })
    if (isCorrect) {
      const newStreak = streak + 1
      setStreak(newStreak)
      if (newStreak > bestStreak) setBestStreak(newStreak)
      setPhase('correct')
      setTimeout(() => loadRound(players.map(p => p.name)), 1500)
    } else {
      setPhase('wrong')
      setTimeout(() => {
        const correctIdxs = correctOrder.map(cp => players.findIndex(p => p.name === cp.name))
        const snap = {}
        orderRef.current.forEach((playerIdx, slotIdx) => {
          snap[players[playerIdx].name] = cardRefs.current[slotIdx]?.getBoundingClientRect()
        })
        flipSnap.current = snap
        orderRef.current = correctIdxs
        setOrder(correctIdxs)
        setPhase('revealing')
        handleStreakEnd(streak)
        setStreak(0)
      }, 800)
    }
  }

  // keep submitRef current every render
  submitRef.current = submitAnswer

  async function submitStreak(s, username) {
    if (!supabase || s < 1) return
    const { error } = await supabase
      .from('depth_chart_streaks')
      .insert({ username, streak: s, user_id: user?.id ?? null })
    if (error) console.error('[depth-chart] streak save failed:', error)
  }

  async function handleStreakEnd(s) {
    if (s < 1) return
    if (user) {
      submitStreak(s, user.email?.split('@')[0] || 'Anonymous')
    } else if (supabase) {
      const { data } = await supabase
        .from('depth_chart_streaks')
        .select('streak')
        .order('streak', { ascending: false })
        .limit(10)
      const qualifies = !data || data.length < 10 || s > (data[data.length - 1]?.streak ?? 0)
      if (qualifies) {
        setPromptStreak(s)
        setPromptName('')
      }
    }
  }

  function handlePromptSubmit() {
    submitStreak(promptStreak, promptName.trim() || 'Anonymous')
    setPromptStreak(null)
  }

  // ── Pointer drag ──────────────────────────────────────────────────────────
  function handlePointerDown(e, slotIdx) {
    if (phase !== 'playing') return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { active: true, srcIdx: slotIdx, lastDst: null }
    setDragSrc(slotIdx)
  }

  function handlePointerMove(e) {
    if (!dragState.current.active) return
    const y = e.clientY
    let dstIdx = null
    cardRefs.current.forEach((ref, i) => {
      if (!ref) return
      const rect = ref.getBoundingClientRect()
      if (y >= rect.top && y <= rect.bottom) dstIdx = i
    })
    if (dstIdx !== null && dstIdx !== dragState.current.lastDst) {
      dragState.current.lastDst = dstIdx
      setDragDst(dstIdx)
    }
  }

  function handlePointerUp() {
    if (!dragState.current.active) return
    const { srcIdx, lastDst } = dragState.current
    dragState.current = { active: false, srcIdx: null, lastDst: null }
    setDragSrc(null)
    setDragDst(null)
    if (lastDst !== null && lastDst !== srcIdx) {
      setOrder(prev => {
        const next = [...prev]
        ;[next[srcIdx], next[lastDst]] = [next[lastDst], next[srcIdx]]
        orderRef.current = next
        return next
      })
      setHasInteracted(true)
    }
  }

  if (!players) return null

  const showTDs  = phase === 'revealing' || phase === 'correct'
  const isWrong  = phase === 'wrong'
  const revealOk = phase === 'revealing' || phase === 'correct'
  const isReady  = phase === 'ready'

  return (
    <div className="dc-screen" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="dc-topbar">
        <button className="dc-back-btn" onClick={onBack}>
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>

        <div className="dc-title-block">
          <div className="dc-title">THE DEPTH CHART</div>
        </div>

        <div className="dc-lb-wrap">
          <button className={`dc-lb-btn${showLB ? ' dc-lb-btn--open' : ''}`} onClick={e => { e.currentTarget.blur(); setShowLB(v => !v) }}>
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
            </svg>
          </button>
          {showLB && <LeaderboardDropdown onClose={() => setShowLB(false)} />}
        </div>
      </div>

      {/* ── Streak bar ──────────────────────────────────────────────── */}
      <div className="dc-streak-bar">
        <div className="dc-streak-item">
          <span className="dc-streak-label">STREAK</span>
          <span className="dc-streak-val" style={{ color: streakColor(streak), transition: 'color 0.4s ease' }}>{streak}</span>
        </div>
        <div className="dc-streak-divider" />
        <div className="dc-streak-item">
          <span className="dc-streak-label">BEST</span>
          <span className="dc-streak-val" style={{ color: streakColor(bestStreak), transition: 'color 0.4s ease' }}>{bestStreak}</span>
        </div>
      </div>

      <div className="dc-sort-box">
        <span className="dc-sort-by">SORT BY</span>
        <span key={isReady ? 'empty' : displayStat} className={`dc-sort-val${sortSpinning ? ' dc-sort-val--spin' : ''}`} style={{ color: isReady ? 'transparent' : displayStat === 'passingTDs' ? '#fca5a5' : displayStat === 'passingYards' ? '#93c5fd' : '#86efac' }}>
          {STAT_LABELS[displayStat]}
        </span>
      </div>

      {isReady && <div className="dc-instruction">SORT PLAYERS BY CATEGORY BEFORE THE TIMER RUNS OUT</div>}

      {/* ── Phase message ───────────────────────────────────────────── */}
      <div className="dc-phase-msg">
        {phase === 'playing' && (
          <span className="dc-msg-hint">
            {hasInteracted ? 'Submit your order below' : 'Drag cards to reorder'}
          </span>
        )}
        {phase === 'wrong'    && <span className="dc-msg-wrong">{timedOut.current ? 'Out of time' : 'Wrong order'}</span>}
        {phase === 'revealing'&& <span className="dc-msg-reveal">Correct order revealed</span>}
        {phase === 'correct'  && <span className="dc-msg-correct">Correct — keep the streak going</span>}
      </div>

      {/* ── Cards ───────────────────────────────────────────────────── */}
      <div className="dc-cards-wrap">
        {isReady && SLOT_LABELS.map((label, i) => (
          <div key={i} className="dc-card dc-card--blank">
            <div className="dc-card-slot-label">{label}</div>
            <div className="dc-card-inner">
              <div className="dc-blank-avatar" />
              <div className="dc-blank-info">
                <div className="dc-blank-name" />
                <div className="dc-blank-team" />
              </div>
            </div>
          </div>
        ))}
        {!isReady && order.map((playerIdx, slotIdx) => {
          const player    = players[playerIdx]
          const photo     = getQBPhoto(player.name)
          const color     = TEAM_COLOR[player.team] || '#e8192c'
          const corrPl    = correctOrder[slotIdx]
          const slotRight = revealOk && player.name === corrPl.name
          const slotWrong = isWrong   && player.name !== corrPl.name
          const isRevSrc  = dragSrc === slotIdx
          const isRevDst  = dragDst === slotIdx && dragSrc !== slotIdx

          return (
            <div
              key={player.name}
              ref={el => cardRefs.current[slotIdx] = el}
              className={[
                'dc-card',
                !revealed[slotIdx] && 'dc-card--hidden',
                isRevSrc  && 'dc-card--dragging',
                isRevDst  && 'dc-card--dragover',
                slotWrong && 'dc-card--wrong',
                slotRight && 'dc-card--correct',
              ].filter(Boolean).join(' ')}
              style={{ touchAction: 'none' }}
              onPointerDown={e => handlePointerDown(e, slotIdx)}
            >
              <div className="dc-card-num">{slotIdx + 1}</div>
              <div className="dc-card-slot-label">{SLOT_LABELS[slotIdx]}</div>
              <div className="dc-card-inner">
                <div className="dc-drag-col">
                  {!showTDs && (
                    <svg width="14" height="22" viewBox="0 0 14 22" fill="currentColor">
                      <circle cx="3" cy="3" r="2.2"/><circle cx="11" cy="3" r="2.2"/>
                      <circle cx="3" cy="11" r="2.2"/><circle cx="11" cy="11" r="2.2"/>
                      <circle cx="3" cy="19" r="2.2"/><circle cx="11" cy="19" r="2.2"/>
                    </svg>
                  )}
                </div>
                <QBAvatar photo={photo} team={player.team} color={color} size={52} />
                <div className="dc-card-info">
                  <div className="dc-card-name">{player.name}</div>
                  <div className="dc-card-team" style={{ color }}>{player.team}</div>
                </div>
                <div className="dc-card-right">
                  {showTDs && (
                    <div className="dc-tds-block">
                      <span className="dc-tds-num">{player[sortStat].toLocaleString()}</span>
                      <span className="dc-tds-lbl">{STAT_LABELS[sortStat]}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Timer bar ───────────────────────────────────────────────── */}
      <div className={`dc-timer-wrap${(phase === 'playing' || phase === 'correct') ? ' dc-timer-wrap--visible' : ''}`}>
        <div className="dc-timer-bar">
          {phase === 'correct'
            ? <div className="dc-timer-fill dc-timer-fill--correct" />
            : <div className="dc-timer-fill" style={{ width: `${timerPct * 100}%` }} />
          }
        </div>
      </div>

      {/* ── Username prompt ─────────────────────────────────────────── */}
      {promptStreak !== null && (
        <div className="dc-prompt-backdrop">
          <div className="dc-prompt">
            <div className="dc-prompt-title">STREAK OF {promptStreak}</div>
            <div className="dc-prompt-sub">Enter your name for the leaderboard</div>
            <input
              className="dc-prompt-input"
              placeholder="Your name"
              maxLength={20}
              value={promptName}
              onChange={e => setPromptName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePromptSubmit()}
            />
            <div className="dc-prompt-btns">
              <button className="dc-prompt-skip" onClick={() => setPromptStreak(null)}>Skip</button>
              <button className="dc-prompt-submit" onClick={handlePromptSubmit}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Action button ───────────────────────────────────────────── */}
      <button
        className={[
          'dc-submit-btn',
          (phase === 'intro' || phase === 'wrong') && 'dc-submit-btn--disabled',
          phase === 'correct' && 'dc-submit-btn--ok',
          phase === 'wrong' && 'dc-submit-btn--err',
        ].filter(Boolean).join(' ')}
        onClick={
          isReady ? startRound
          : phase === 'revealing' ? () => loadRound(players.map(p => p.name))
          : submitAnswer
        }
        disabled={phase === 'intro' || phase === 'wrong'}
      >
        {isReady                                    && 'START'}
        {(phase === 'playing' || phase === 'intro') && 'LOCK IT IN'}
        {phase === 'wrong'                          && (timedOut.current ? 'OUT OF TIME' : 'WRONG ORDER')}
        {phase === 'revealing'                      && 'PLAY AGAIN'}
        {phase === 'correct'                        && 'CORRECT'}
      </button>


    </div>
  )
}
