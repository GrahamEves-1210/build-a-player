import { useEffect, useState, useMemo, useRef } from 'react'
import { nflHeadshot, HEADSHOT_BASE } from '../utils/simulation'
import { supabase } from '../lib/supabase'

const VOTE_KEY   = 'bap_next_mode_vote'
const VOTE_SEED  = { db: 0, lb: 0, dl: 0, ol: 0 }

function hsUrl(id) {
  if (!id) return null
  if (id.startsWith('http')) return id
  return id.includes('.') ? `${HEADSHOT_BASE}/${id}` : `${HEADSHOT_BASE}/${id}.webp`
}

const POS_OPTIONS = [
  {
    pos: 'qb', label: 'QB', classic: true, alltime: true,
    players: [
      { id: '6770', color: '#fb4f14' },       // Joe Burrow - CIN
      { id: '4984', color: '#00338d' },       // Josh Allen - BUF
      { id: '4881', color: '#241773' },       // Lamar Jackson - BAL
    ],
  },
  {
    pos: 'rb', label: 'RB', classic: true, alltime: true,
    players: [
      { id: '3198', color: '#241773' },       // Derrick Henry - BAL
      { id: '9509', color: '#a71930' },       // Bijan Robinson - ATL
      { id: '9221', color: '#0076b6' },       // Jahmyr Gibbs - DET
    ],
  },
  {
    pos: 'wr', label: 'WR', classic: true, alltime: true,
    players: [
      { id: 'espn_4262921',   color: '#4f2683' },  // Justin Jefferson - MIN
      { id: 'espn_4241389',   color: '#003594' },  // CeeDee Lamb - DAL
      { id: 'espn_4430878',   color: '#69be28' },  // Jaxon Smith-Njigba - SEA
    ],
  },
  {
    pos: 'te', label: 'TE', classic: true, alltime: false,
    players: [
      { id: '11604', color: '#a5acaf' },      // Brock Bowers - LV
      { id: '4217',  color: '#aa0000' },      // George Kittle - SF
      { id: '8130',  color: '#97233f' },      // Trey McBride - ARI
    ],
  },
  {
    pos: 'db', label: 'DB', classic: false, alltime: false, disabled: true,
    players: [
      { id: 'espn_4372012', color: '#fb4f14' },  // Pat Surtain II - DEN
      { id: 'espn_4686772', color: '#0C2340' },  // Christian Gonzalez - NE
      { id: 'espn_4575517', color: '#241773' },  // Kyle Hamilton - BAL
    ],
  },
  {
    pos: 'lb', label: 'LB', classic: false, alltime: false, disabled: true,
    players: [
      { id: 'espn_3138826', color: '#aa0000' },  // Fred Warner - SF
      { id: 'espn_3915189', color: '#241773' },  // Roquan Smith - BAL
      { id: 'espn_4569465', color: '#0076b6' },  // Jack Campbell - DET
    ],
  },
  {
    pos: 'dl', label: 'DL', classic: false, alltime: false, disabled: true,
    players: [
      { id: 'espn_3122132', color: '#003594' },  // Myles Garrett - LAR
      { id: 'espn_3916655', color: '#000000' },  // Maxx Crosby - LV
      { id: '10892',        color: '#03202f' },  // Will Anderson Jr - HOU
    ],
  },
  {
    pos: 'ol', label: 'OL', classic: false, alltime: false, disabled: true,
    players: [
      { id: 'espn_13241',   color: '#aa0000' },  // Trent Williams - SF
      { id: 'espn_15797',   color: '#004c54' },  // Lane Johnson - PHI
      { id: 'espn_3129308', color: '#002c5f' },  // Quenton Nelson - IND
    ],
  },
]

function MiniAv({ id, color, size = 28 }) {
  const src = hsUrl(id)
  return (
    <div className="mini-av" style={{ width: size, height: size, background: color, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
      {src && <img src={src} alt="" draggable={false} style={{ width: '130%', height: '130%', objectFit: 'cover', objectPosition: 'top center', marginTop: '-3px', marginLeft: '-15%' }} onError={e => { e.currentTarget.style.display = 'none' }} />}
    </div>
  )
}

function AvatarTrio({ players, size = 26 }) {
  return (
    <div className="splash-av-trio">
      {players.map((p, i) => (
        <div key={i} className="splash-av-trio-item" style={{ marginLeft: i === 0 ? 0 : -size * 0.32 }}>
          <MiniAv id={p.id} color={p.color} size={size} />
        </div>
      ))}
    </div>
  )
}

function PositionPicker({ position, onChange, voteCounts, votedFor, onVote }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const current = POS_OPTIONS.find(o => o.pos === position) || POS_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [open])

  const select = pos => { onChange(pos); setOpen(false) }

  const voteTotal = Object.values(voteCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="splash-pos-picker" ref={ref}>
      <button className="splash-pos-trigger" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <div className="splash-pos-trigger-trios">
          {POS_OPTIONS.map(opt => (
            <div key={opt.pos} className={`splash-pos-trigger-trio-slot${opt.pos === position ? ' splash-pos-trigger-trio-slot--active' : ''}`}>
              <AvatarTrio players={opt.players} size={40} />
            </div>
          ))}
        </div>
        <span className="splash-pos-trigger-label">{current.label}</span>
        <svg className={`splash-pos-caret${open ? ' open' : ''}`} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      <div className="splash-pos-vote-below-trigger">VOTE FOR NEXT MODE</div>

      <div className={`splash-pos-popup${open ? ' splash-pos-popup--open' : ''}`} aria-hidden={!open}>
        <div className="splash-pos-popup-grid">
          {POS_OPTIONS.filter(o => !o.disabled).map(opt => (
            <button
              key={opt.pos}
              className={`splash-pos-option${opt.pos === position ? ' splash-pos-option--active' : ''}`}
              onClick={() => select(opt.pos)}
              tabIndex={!open ? -1 : 0}
            >
              {opt.pos === 'te' && <span className="splash-pos-new-tag">NEW</span>}
              <div className="splash-pos-option-top">
                <AvatarTrio players={opt.players} size={40} />
                <span className="splash-pos-option-name">{opt.label}</span>
              </div>
              <div className="splash-pos-option-modes">
                <span className={`splash-mode-pill ${opt.alltime ? 'splash-mode-pill--alltime' : 'splash-mode-pill--alltime-soon'}`}>All‑Time</span>
                <span className={`splash-mode-pill ${opt.classic ? 'splash-mode-pill--avail' : 'splash-mode-pill--na'}`}>Classic</span>
              </div>
            </button>
          ))}
        </div>

        <div className="splash-pos-vote-section-header">
          <div className="splash-pos-vote-section-rule" />
          <span className="splash-pos-vote-section-label">VOTE FOR NEXT MODE</span>
          <div className="splash-pos-vote-section-rule" />
        </div>

        <div className="splash-pos-popup-grid">
          {POS_OPTIONS.filter(o => o.disabled).map(opt => (
            <button
              key={opt.pos}
              className="splash-pos-option splash-pos-option--disabled"
              onClick={e => e.preventDefault()}
              tabIndex={!open ? -1 : 0}
            >
              <div className="splash-pos-soon-banner">COMING SOON</div>
              <div className="splash-pos-option-top">
                <AvatarTrio players={opt.players} size={40} />
                <span className="splash-pos-option-name">{opt.label}</span>
              </div>
              <div className="splash-pos-option-modes">
                <span className="splash-mode-pill splash-mode-pill--alltime-soon">All‑Time</span>
                <span className="splash-mode-pill splash-mode-pill--classic-soon">Classic</span>
              </div>
              <div className="splash-pos-vote">
                {votedFor ? (
                  <div className={`splash-pos-vote-result${votedFor === opt.pos ? ' splash-pos-vote-result--mine' : ''}`}>
                    <div
                      className="splash-pos-vote-fill"
                      style={{ width: `${Math.round((voteCounts[opt.pos] || 0) / Math.max(voteTotal, 1) * 100)}%` }}
                    />
                    <span className="splash-pos-vote-pct">
                      {Math.round((voteCounts[opt.pos] || 0) / Math.max(voteTotal, 1) * 100)}%
                    </span>
                  </div>
                ) : (
                  <button
                    className="splash-pos-vote-btn"
                    onClick={e => { e.stopPropagation(); onVote(opt.pos) }}
                  >
                    VOTE
                  </button>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const HoopU = () => (
  <svg className="hoop-u-svg" viewBox="0 0 68 90" fill="none" aria-hidden="true">
    <circle cx="34" cy="14" r="14.4" fill="#f97316"/>
    <path d="M8 24 L18 88 L50 88 L60 24" stroke="white" strokeWidth="6" strokeLinejoin="round" fill="none"/>
    <line x1="17" y1="25" x2="38" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="27" y1="25" x2="48" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="41" y1="25" x2="20" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="51" y1="25" x2="30" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="5" y1="26" x2="63" y2="26" stroke="white" strokeWidth="5" strokeLinecap="round"/>
  </svg>
)

const QB_ATTRS = [
  { label: 'Arm',                   col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14 },
  { label: 'Legs',                  col: '#60a5fa', angle:   55, dist: 1.30, mx: 3,  my: 30, dox: 80 },
  { label: 'Build',                 col: '#fb923c', angle:   15, dist: 1.28, mx: 62, my: 52 },
  { label: 'Processing',            col: '#a78bfa', angle:  210, dist: 1.31, mx: 4,  my: 62 },
  { label: 'Accuracy/Touch',        col: '#34d399', angle: -130, dist: 1.30, mx: 55, my: 72 },
  { label: 'Leadership',            col: '#e879f9', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
  { label: 'Playmaking/Creativity', col: '#fbbf24', angle:  100, dist: 1.32, mx: 68, my: 34, dox: -290 },
  { label: 'Pocket Presence',       col: '#2dd4bf', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
  { label: 'Vision',                col: '#38bdf8', angle:   80, dist: 1.31, mx: 74, my: 44, dox: 270 },
]

const RB_ATTRS = [
  { label: 'Long Speed',      col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14 },
  { label: 'Burst',           col: '#60a5fa', angle:   55, dist: 1.30, mx: 3,  my: 30 },
  { label: 'Strength',        col: '#fbbf24', angle:   15, dist: 1.28, mx: 62, my: 52 },
  { label: 'Size',            col: '#fb923c', angle:  210, dist: 1.31, mx: 4,  my: 62 },
  { label: 'Contact Balance', col: '#2dd4bf', angle: -130, dist: 1.30, mx: 55, my: 72 },
  { label: 'Hands',           col: '#34d399', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
  { label: 'Vision',          col: '#38bdf8', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -210 },
  { label: 'Elusiveness',     col: '#a78bfa', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
]

const WR_ATTRS = [
  { label: 'Speed',        col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14 },
  { label: 'Body Control', col: '#60a5fa', angle:   55, dist: 1.30, mx: 3,  my: 30 },
  { label: 'Vertical',     col: '#34d399', angle:   15, dist: 1.28, mx: 62, my: 52 },
  { label: 'Size',         col: '#fb923c', angle:  210, dist: 1.31, mx: 4,  my: 62 },
  { label: 'Route Running',col: '#2dd4bf', angle: -130, dist: 1.30, mx: 55, my: 72 },
  { label: 'Release',      col: '#e879f9', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
  { label: 'Hands',        col: '#fbbf24', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -210 },
  { label: 'Awareness',    col: '#a78bfa', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
  { label: 'After Catch',  col: '#38bdf8', angle:   80, dist: 1.31, mx: 74, my: 44, dox: 270 },
]

const TE_ATTRS = [
  { label: 'Speed',        col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14 },
  { label: 'Blocking',     col: '#60a5fa', angle:   55, dist: 1.30, mx: 3,  my: 30 },
  { label: 'Vertical',     col: '#34d399', angle:   15, dist: 1.28, mx: 62, my: 52 },
  { label: 'Size',         col: '#fb923c', angle:  210, dist: 1.31, mx: 4,  my: 62 },
  { label: 'Route Running',col: '#2dd4bf', angle: -130, dist: 1.30, mx: 55, my: 72 },
  { label: 'Strength',     col: '#e879f9', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
  { label: 'Hands',        col: '#fbbf24', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -210 },
  { label: 'Awareness',    col: '#a78bfa', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
  { label: 'After Catch',  col: '#38bdf8', angle:   80, dist: 1.31, mx: 74, my: 44, dox: 270 },
]

function FloatingChip({ label, col, angle, dist, visible, mx, my, isMobile, orbitScale = 1, dox = 0, doy = 0 }) {
  const x = isMobile ? mx : 50 + dist * 34 * orbitScale * Math.cos((angle * Math.PI) / 180)
  const y = isMobile ? my : 48 + dist * 30 * orbitScale * Math.sin((angle * Math.PI) / 180)
  const ox = isMobile ? 0 : dox
  const oy = isMobile ? 0 : doy

  return (
    <div
      className="splash-chip"
      style={{
        left: ox ? `calc(${x}% + ${ox}px)` : `${x}%`,
        top:  oy ? `calc(${y}% + ${oy}px)` : `${y}%`,
        borderColor: col,
        color: col,
        opacity: visible ? 1 : 0,
        transform: visible
          ? (isMobile ? 'translate(0,-50%) scale(1)' : 'translate(-50%,-50%) scale(1)')
          : (isMobile ? 'translate(0,-50%) scale(0.6)' : 'translate(-50%,-50%) scale(0.6)'),
        transitionDelay: visible ? `${300 + Math.abs(angle) % 400}ms` : '0ms',
      }}
    >
      <span className="splash-chip-dot" style={{ background: col }} />
      {label}
    </div>
  )
}

export default function SplashScreen({ onStart, onDepthChart }) {
  const [phase, setPhase] = useState(0)
  const [position, setPosition] = useState(() => localStorage.getItem('lastPosition') || 'qb')
  const handlePosChange = pos => { setPosition(pos); localStorage.setItem('lastPosition', pos) }
  const isMobile  = useMemo(() => window.innerWidth <= 768, [])
  const isDesktop = useMemo(() => window.innerWidth > 768, [])
  const orbitScale = isDesktop ? 0.8 : 1

  const [voteCounts, setVoteCounts] = useState(VOTE_SEED)
  const [votedFor, setVotedFor] = useState(() => { try { return localStorage.getItem(VOTE_KEY) } catch { return null } })

  useEffect(() => {
    supabase.from('mode_votes').select('position,count').then(({ data }) => {
      if (!data) return
      const counts = { ...VOTE_SEED }
      data.forEach(row => { if (counts[row.position] !== undefined) counts[row.position] = row.count })
      setVoteCounts(counts)
    }).catch(() => {})
  }, [])

  const handleVote = async pos => {
    if (votedFor) return
    try { localStorage.setItem(VOTE_KEY, pos) } catch {}
    setVotedFor(pos)
    setVoteCounts(prev => ({ ...prev, [pos]: (prev[pos] || 0) + 1 }))
    try { await supabase.rpc('increment_mode_vote', { p_pos: pos }) } catch {}
  }

  useEffect(() => {
    POS_OPTIONS.forEach(opt => opt.players.forEach(p => {
      const src = hsUrl(p.id)
      if (src) { const img = new Image(); img.src = src }
    }))
  }, [])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80)
    const t2 = setTimeout(() => setPhase(2), 420)
    const t3 = setTimeout(() => setPhase(3), 800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const attrs = position === 'te' ? TE_ATTRS : position === 'wr' ? WR_ATTRS : position === 'rb' ? RB_ATTRS : QB_ATTRS

  return (
    <div className={`splash-screen ${phase >= 1 ? 'splash-in' : ''}`}>

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: '-20px', backgroundImage: "url('/footballbackground.webp')", backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(4px) brightness(0.5)' }} />
      </div>

      <div className="splash-mob-disclaimer">Fan-made · Not affiliated with the NFL</div>
      <div className="splash-glow" style={{ opacity: phase >= 2 ? 1 : 0 }} />

      {attrs.map((a) => (
        <FloatingChip key={a.label} {...a} visible={phase >= 3} isMobile={isMobile} orbitScale={orbitScale} />
      ))}

      <div className="splash-header" style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'none' : 'translateY(-28px)' }}>
        <div className="splash-title">
          BUIL<span className="logo-d">D</span><em>-<span className="logo-a">A</span>-</em>PLAYER
        </div>
        <div className="splash-disclaimer splash-disclaimer--under-logo">Fan-made · Not affiliated with the NFL</div>
        <div className="splash-pos-toggle splash-pos-toggle--picker" style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? (isMobile ? 'translateY(-8px)' : 'none') : 'translateY(8px)' }}>
          <PositionPicker position={position} onChange={handlePosChange} voteCounts={voteCounts} votedFor={votedFor} onVote={handleVote} />
        </div>
      </div>

      <div className="splash-figure-wrap" style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'none' : 'translateY(40px) scale(0.92)' }}>
        <img src="/qb-silhouette.webp" className="splash-figure" alt="" draggable={false}
          style={{ position: 'absolute', inset: 0, opacity: position === 'qb' ? 1 : 0 }} />
        <img src="/rbsilhouette.webp" className="splash-figure" alt="" draggable={false}
          style={{ position: 'absolute', inset: 0, opacity: position === 'rb' ? 1 : 0 }} />
        <img src="/wr-silhouette.png" className="splash-figure" alt="" draggable={false}
          style={{ position: 'absolute', inset: 0, opacity: (position === 'wr' || position === 'te') ? 1 : 0, transform: 'scale(1.18)', transformOrigin: 'center center' }} />
        <div className="splash-figure-glow" />
      </div>

      <button
        className="splash-dc-float"
        onClick={onDepthChart}
        style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'translateY(-50%)' : 'translateY(calc(-50% + 10px)) scale(0.8)' }}
      >
        <div className="splash-dc-float-main">THE DEPTH CHART</div>
        <div className="splash-dc-float-sub">MINI GAME</div>
      </button>

      <div className="splash-footer" style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? (isMobile ? 'translateY(6px)' : 'none') : 'translateY(16px)' }}>

        <div className="splash-tagline">Spin the wheel · Build your {position.toUpperCase()}</div>

        <div className="splash-modes">
          <button className="splash-mode-classic" onClick={() => { localStorage.setItem('lastPosition', position); onStart('classic', position) }}>
            <div className="smode-title">Classic</div>
            <div className="smode-badge">Current {position === 'rb' ? 'RBs' : position === 'wr' ? 'WRs' : position === 'te' ? 'TEs' : 'QBs'}</div>
            <div className="smode-cta">
              START DRAFTING
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>

          {(position === 'te') ? (
            <button className="splash-mode-alltime splash-mode-alltime--soon" disabled>
              <div className="splash-mode-alltime--soon-banner">COMING SOON</div>
              <div className="smode-title smode-title--alltime">All-Time</div>
              <div className="smode-badge smode-badge--alltime">Draft the Greats</div>
              <div className="smode-cta smode-cta--alltime">
                START DRAFTING
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </button>
          ) : (
            <button
              className="splash-mode-alltime"
              onClick={() => { localStorage.setItem('lastPosition', position); onStart('all-time', position) }}
            >
              <div className="smode-title smode-title--alltime">
                All-Time
                {position === 'wr' && <span className="splash-alltime-new-tag">NEW</span>}
              </div>
              <div className="smode-badge smode-badge--alltime">Draft the Greats</div>
              <div className="smode-cta smode-cta--alltime">
                START DRAFTING
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </button>
          )}
        </div>

        <button className="splash-minigame-btn splash-minigame-btn--bucket" onClick={() => window.location.href = '/bucket'}>
          <div className="splash-xlink-logo">
            BUIL<span className="splash-xlink-d">D</span><em className="splash-xlink-em splash-xlink-em--bucket">-<span className="splash-xlink-a">A</span>-</em>B<HoopU />CKET
          </div>
          <div className="splash-mg-sub">BASKETBALL BUILDER</div>
        </button>

        <div className="splash-disclaimer splash-disclaimer--footer">Fan-made · Not affiliated with the NFL</div>
      </div>

      <div className="splash-field-lines">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="splash-yard-line" style={{ opacity: phase >= 2 ? 1 : 0, transitionDelay: `${600 + i * 60}ms` }} />
        ))}
      </div>
    </div>
  )
}
