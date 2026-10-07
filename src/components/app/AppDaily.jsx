import { useEffect, useState } from 'react'
import { useProgress, dailyState, fetchDailyBoard, msToReset, claimMission, claimStreak, missionDef, STREAK_REWARDS, SPOTLIGHTS } from '../../lib/progress'
import { sfx, haptic } from '../../lib/juice'
import { IconFlame, IconTarget, IconCheck, IconGift, IconLock, IconClose, IconCoin, IconArrow } from './icons'

// Daily hub (dock → Daily): login streak + rewards, the Daily Challenge with
// its leaderboard, and today's three missions.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

function useCountdown() {
  const [ms, setMs] = useState(msToReset)
  useEffect(() => { const t = setInterval(() => setMs(msToReset()), 30000); return () => clearInterval(t) }, [])
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function Streak({ p }) {
  const st = p.streak
  const claim = days => { if (claimStreak(days)) { sfx('claim'); haptic('success') } }
  return (
    <section className="ag-card ag-streak ag-pop" style={{ '--d': '40ms' }}>
      <div className="ag-streak-head">
        <span className="ag-streak-flame"><IconFlame size={34} /></span>
        <span>
          <span className="ag-streak-num">{st.count}</span>
          <span className="ag-streak-lbl">DAY STREAK</span>
        </span>
        <span className="ag-streak-best">BEST {st.best}</span>
      </div>
      <div className="ag-streak-track">
        {STREAK_REWARDS.map(r => {
          const reached = st.count >= r.days
          const claimed = !!st.claimed?.[r.days]
          const spot = r.unlock && SPOTLIGHTS.find(s => s.id === r.unlock)
          return (
            <button key={r.days} className={`ag-milestone${reached ? ' is-reached' : ''}${claimed ? ' is-claimed' : ''}`}
              disabled={!reached || claimed} onClick={() => claim(r.days)}>
              <span className="ag-milestone-day">DAY {r.days}</span>
              <span className="ag-milestone-icon">{claimed ? <IconCheck size={18} /> : reached ? <IconGift size={20} /> : <IconLock size={16} />}</span>
              <span className="ag-milestone-xp">+{r.xp} XP</span>
              {spot && <span className="ag-milestone-extra"><i className={`ag-swatch ag-swatch--${spot.id}`} />{spot.name}</span>}
              {reached && !claimed && <span className="ag-milestone-claim">CLAIM</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Challenge({ p, sport }) {
  const dc = dailyState()
  const [board, setBoard] = useState(null)
  useEffect(() => { fetchDailyBoard(dc.key).then(setBoard) }, [dc.key, dc.done, dc.posted])
  const mine = board?.rows.findIndex(r => r.user_id === p.user?.id) ?? -1
  const play = () => { if (sport === 'bucket') window.location.href = '/?daily=1'; else nav('daily-challenge') }
  const label = `${dc.pos.toUpperCase()} · ${dc.mode === 'all-time' ? 'ALL-TIME' : 'CURRENT'}`

  return (
    <section className="ag-card ag-challenge ag-pop" style={{ '--d': '90ms' }}>
      <div className="ag-challenge-hero">
        <span className="ag-eyebrow">DAILY CHALLENGE</span>
        <span className="ag-challenge-title">{label}</span>
        <span className="ag-challenge-sub">Everyone gets the same spins today. No resets — your first build counts.</span>
        {dc.done ? (
          <div className="ag-challenge-result">
            <span><b>{dc.ovr}</b> OVR</span>
            {mine >= 0 && <span className="ag-challenge-rank">#{mine + 1} TODAY</span>}
          </div>
        ) : (
          <button className="ag-btn ag-challenge-go" onClick={play}>{dc.spins > 0 ? 'RESUME CHALLENGE' : 'PLAY CHALLENGE'} <IconArrow size={18} /></button>
        )}
        {dc.done && !p.signedIn && <span className="ag-challenge-note">Sign in to post your score to the board.</span>}
      </div>
      <div className="ag-board">
        <div className="ag-board-head"><span>TODAY'S TOP BUILDS</span><span>OVR</span></div>
        {board == null && <div className="ag-board-empty">Loading…</div>}
        {board?.error && <div className="ag-board-empty">The board opens soon — your score is kept on this device.</div>}
        {board && !board.error && board.rows.length === 0 && <div className="ag-board-empty">No scores yet. Be the first on the board.</div>}
        {board?.rows.slice(0, 10).map((r, i) => (
          <div key={r.user_id} className={`ag-board-row${r.user_id === p.user?.id ? ' is-me' : ''}`}>
            <span className={`ag-board-rank ag-board-rank--${i + 1}`}>{i + 1}</span>
            <span className="ag-board-name">{r.username || 'Player'}</span>
            <span className="ag-board-ovr">{r.ovr}</span>
          </div>
        ))}
        {mine >= 10 && (
          <div className="ag-board-row is-me">
            <span className="ag-board-rank">{mine + 1}</span>
            <span className="ag-board-name">{board.rows[mine].username}</span>
            <span className="ag-board-ovr">{board.rows[mine].ovr}</span>
          </div>
        )}
      </div>
    </section>
  )
}

function Missions({ p }) {
  const claim = id => { if (claimMission(id)) { sfx('claim'); haptic('success') } }
  return (
    <section className="ag-card ag-missions ag-pop" style={{ '--d': '140ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">TODAY'S MISSIONS</span></div>
      {(p.day?.missions ?? []).map(m => {
        const def = missionDef(m.id)
        if (!def) return null
        const done = m.n >= def.goal
        return (
          <div key={m.id} className={`ag-mission${done ? ' is-done' : ''}${m.claimed ? ' is-claimed' : ''}`}>
            <span className="ag-mission-icon">{m.claimed ? <IconCheck size={18} /> : <IconTarget size={18} />}</span>
            <span className="ag-mission-body">
              <span className="ag-mission-text">{def.text}</span>
              <span className="ag-mission-bar"><span style={{ width: `${(m.n / def.goal) * 100}%` }} /></span>
            </span>
            {done && !m.claimed
              ? <button className="ag-btn ag-mission-claim" onClick={() => claim(m.id)}>+{def.xp}</button>
              : <span className="ag-mission-xp">{m.claimed ? 'DONE' : `${m.n}/${def.goal} · ${def.xp} XP`}</span>}
          </div>
        )
      })}
    </section>
  )
}

export default function AppDaily({ sport, onClose }) {
  const p = useProgress()
  const reset = useCountdown()
  const isBucket = sport === 'bucket'
  return (
    <div className={`ag-screen ag-screen--${sport}`}>
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">RESETS IN {reset}</span>
          <h1 className="ag-h1">Daily</h1>
        </div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <Streak p={p} />
        <Challenge p={p} sport={sport} />
        <Missions p={p} />
        <section className="ag-extras ag-pop" style={{ '--d': '190ms', padding: 0 }}>
          {isBucket && (
            <button className="ag-mini ag-mini--purple" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'salarycap' })) }}>
              <span className="ag-mini-flag">DAILY</span>
              <span className="ag-mini-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconCoin size={17} /> SALARY CAP</span>
              <span className="ag-mini-sub">Today's budget build</span>
            </button>
          )}
          <button className="ag-mini ag-mini--mint" style={isBucket ? undefined : { gridColumn: '1 / -1' }} onClick={() => nav('cards')}>
            <span className="ag-mini-title">YOUR CARDS</span>
            <span className="ag-mini-sub">{Object.keys(p.cards).length} collected</span>
          </button>
        </section>
      </div>
    </div>
  )
}
