import { useEffect, useState } from 'react'
import { XpIco } from './GainIcons'
import { useProgress, dailyState, fetchDailyBoard, fetchWeeklyCup, weekOf, weekEnds, CUP_COINS, CUP_ITEM, msToReset, claimMission, claimStreak, missionDef, STREAK_REWARDS, SPOTLIGHTS, buyFreeze, FREEZE_PRICE, FREEZE_MAX, streakLost, restoreStreak } from '../../lib/progress'
import { sfx, haptic, claimFx } from '../../lib/juice'
import { IS_APP } from '../../lib/platform'
import WatchVideo from './WatchVideo'
import { NameTag, AvatarBadge, ItemPreview } from './NameTag'
import { itemById, RARITY } from '../../lib/cosmetics'
import { getUsername } from '../../lib/discord'
import { IconFlame, IconTarget, IconCheck, IconGift, IconLock, IconClose, IconCoin, IconArrow } from './icons'
import EmptyState, { PassLoader } from './EmptyState'

// Daily hub (dock → Daily): login streak + rewards, the Daily Challenge with
// its leaderboard, and today's three missions.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

function useCountdown() {
  const [ms, setMs] = useState(msToReset)
  useEffect(() => { const t = setInterval(() => setMs(msToReset()), 30000); return () => clearInterval(t) }, [])
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

// Streak freezes: hold up to two; each one covers a missed day
function Freeze({ p }) {
  const [err, setErr] = useState('')
  const [got, setGot] = useState(0)   // a freeze just bought: the shield frosts over
  const n = p.streak.freezes ?? 0, full = n >= FREEZE_MAX
  const go = () => { const r = buyFreeze(); if (r.ok) { setErr(''); sfx('purchase'); haptic('success'); setGot(Date.now()) } else { setErr(r.reason); sfx('deny') } }
  return (
    <div className="ag-freeze">
      <span key={got} className={`ag-freeze-icon${n ? ' is-armed' : ''}${got ? ' is-got' : ''}`}><img src="/fx/freeze-shield.webp" alt="" draggable={false} /><i className="ag-freeze-frost" /></span>
      <span className="ag-freeze-txt">
        <b>STREAK FREEZE <i>{n}/{FREEZE_MAX}</i></b>
        <small>{err || (n ? `Miss a day and ${n === 1 ? 'it saves' : 'they save'} your streak.` : 'Covers a missed day so your streak lives.')}</small>
      </span>
      <button className="ag-freeze-buy" disabled={full} onClick={go}>{full ? 'FULL' : <><IconCoin size={14} /> {FREEZE_PRICE}</>}</button>
    </div>
  )
}

function Streak({ p }) {
  const st = p.streak
  const next = STREAK_REWARDS.find(r => st.count < r.days)
  const waiting = STREAK_REWARDS.filter(r => st.count >= r.days && !st.claimed?.[r.days]).length
  const claim = (days, el) => { if (!p.signedIn) { window.dispatchEvent(new CustomEvent('bap:auth')); return } const xp = claimStreak(days); if (xp) { sfx('coins'); haptic('success'); claimFx(el, `+${xp} XP`) } }   // streak rewards pay coins
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
      <p className="ag-streak-next">
        {waiting ? <b>{waiting === 1 ? 'A reward is' : `${waiting} rewards are`} ready to claim</b>
          : next ? <>Day {next.days} reward in <b>{next.days - st.count} day{next.days - st.count === 1 ? '' : 's'}</b></>
          : <b>Every reward claimed. Keep it alive.</b>}
        <small>Miss a day without a freeze and it starts over at day 1.</small>
      </p>
      {IS_APP && p.signedIn && streakLost() && (
        <WatchVideo className="ag-streak-restore" label={`WATCH VIDEO · SAVE YOUR ${streakLost().count}-DAY STREAK`} sub="It broke. A short video ad brings it back, as if you never missed. Once a week."
          onReward={() => restoreStreak()} />
      )}
      <div className="ag-streak-track">
        {STREAK_REWARDS.map(r => {
          const reached = st.count >= r.days
          const claimed = !!st.claimed?.[r.days]
          const spot = r.unlock && SPOTLIGHTS.find(s => s.id === r.unlock)
          const item = itemById(r.item)
          return (
            <button key={r.days} className={`ag-milestone${reached ? ' is-reached' : ''}${claimed ? ' is-claimed' : ''}`} style={item ? { '--rar': RARITY[item.rarity].color } : undefined}
              disabled={!reached || claimed} onClick={e => claim(r.days, e.currentTarget)}>
              <span className="ag-milestone-day">DAY {r.days}</span>
              <span className="ag-milestone-prize">{item ? <ItemPreview item={item} name={getUsername(p.user) || 'Guest'} /> : <span className="ag-milestone-xpbig"><XpIco /></span>}</span>
              <span className="ag-milestone-name">{item?.name ?? 'XP Bonus'}</span>
              <span className="ag-milestone-xp">{p.signedIn ? <span className="gain"><XpIco /> +{r.xp}</span> : 'SIGN IN'}</span>
              {spot && <span className="ag-milestone-extra"><i className={`ag-swatch ag-swatch--${spot.id}`} />{spot.name}</span>}
              <span className="ag-milestone-state">{claimed ? <IconCheck size={16} /> : reached ? <span className="ag-milestone-claim">CLAIM</span> : <IconLock size={14} />}</span>
            </button>
          )
        })}
      </div>
      <Freeze p={p} />
    </section>
  )
}

function Challenge({ p, sport }) {
  const dc = dailyState()
  const [board, setBoard] = useState(null)
  useEffect(() => { fetchDailyBoard(dc.key).then(setBoard) }, [dc.key, dc.done, dc.posted])
  const mine = board?.rows.findIndex(r => r.user_id === p.user?.id) ?? -1
  // the day's sport: the side that plays it (the other side sends the player over)
  const daySport = dc.sport === 'bucket' ? 'bucket' : 'nfl'
  const play = () => { if (daySport === sport) nav('daily-challenge'); else window.location.href = daySport === 'bucket' ? '/bucket?daily=1' : '/?daily=1' }
  const label = `${dc.pos.toUpperCase()} · ${dc.mode === 'all-time' ? 'ALL-TIME' : 'CURRENT'}`

  return (
    <section className="ag-card ag-challenge ag-pop" style={{ '--d': '90ms' }}>
      <div className="ag-challenge-hero">
        <span className="ag-eyebrow">DAILY CHALLENGE · {daySport === 'bucket' ? 'BASKETBALL' : 'FOOTBALL'}</span>   {/* (one challenge a day: football and basketball days take turns) */}
        <span className="ag-challenge-title">{label}</span>
        <span className="ag-challenge-sub">Everyone gets the same spins today. One run: no resets, and leaving mid-run ends your day.</span>
        {dc.done ? (
          <div className="ag-challenge-result">
            {dc.forfeit ? <span><b>LEFT</b> no score today</span> : <span><b>{dc.ovr}</b> OVR</span>}
            {mine >= 0 && <span className="ag-challenge-rank">#{mine + 1} TODAY</span>}
          </div>
        ) : (
          <button className="ag-btn ag-challenge-go" onClick={play}>{dc.spins > 0 ? 'RESUME CHALLENGE' : 'PLAY CHALLENGE'} <IconArrow size={18} /></button>
        )}
        {dc.done && !dc.forfeit && !p.signedIn && <span className="ag-challenge-note">Sign in to post your score to the board.</span>}
      </div>
      <div className="ag-board">
        <div className="ag-board-head"><span>TODAY'S TOP BUILDS</span><span>OVR</span></div>
        {board == null && <PassLoader />}
        {board?.error && <div className="ag-board-empty">The board opens soon — your score is kept on this device.</div>}
        {board && !board.error && board.rows.length === 0 && <EmptyState kind="podium" title="No scores yet">The first Daily finished today takes #1.</EmptyState>}
        {board?.rows.slice(0, 10).map((r, i) => (
          <div key={r.user_id} className={`ag-board-row${r.user_id === p.user?.id ? ' is-me' : ''}`}>
            <span className={`ag-board-rank ag-board-rank--${i + 1}`}>{i + 1}</span>
            <span className="ag-board-name"><AvatarBadge name={r.username} uid={r.user_id} size={24} /><NameTag name={r.username || 'Player'} uid={r.user_id} /></span>
            <span className="ag-board-ovr">{r.ovr}</span>
          </div>
        ))}
        {mine >= 10 && (
          <div className="ag-board-row is-me">
            <span className="ag-board-rank">{mine + 1}</span>
            <span className="ag-board-name"><AvatarBadge name={board.rows[mine].username} self size={24} /><NameTag name={board.rows[mine].username} self /></span>
            <span className="ag-board-ovr">{board.rows[mine].ovr}</span>
          </div>
        )}
      </div>
    </section>
  )
}

// The Weekly Cup: this week's Daily scores added up; the top 10 win coins and an avatar
const fmtDay = k => new Date(`${k}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
function WeeklyCup({ p }) {
  const week = weekOf()
  const [board, setBoard] = useState(null)
  const dc = dailyState()
  useEffect(() => { let live = true; fetchWeeklyCup(week).then(b => { if (live) setBoard(b) }); return () => { live = false } }, [week, dc.posted])
  const mine = board?.rows.findIndex(r => r.user_id === p.user?.id) ?? -1
  const won = p.cupWon && p.cupWon.week === weekOf(new Date(Date.parse(`${week}T12:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10)) ? p.cupWon : null
  const cup = itemById(CUP_ITEM)
  return (
    <section className="ag-card ag-cup ag-pop" style={{ '--d': '115ms' }}>
      <div className="ag-cup-head">
        <span className="ag-cup-trophy" aria-hidden="true">{cup && <ItemPreview item={cup} name={getUsername(p.user) || 'Guest'} />}</span>
        <span className="ag-cup-titles">
          <span className="ag-eyebrow">WEEKLY CUP · ENDS {fmtDay(weekEnds()).toUpperCase()}</span>
          <b>Every Daily counts</b>
          <small>Your Daily OVRs add up, Monday to Sunday. Finish top 10 for coins and the Cup Contender avatar.</small>
        </span>
      </div>
      <div className="ag-cup-prizes">
        {[['1ST', CUP_COINS[0]], ['2ND', CUP_COINS[1]], ['3RD', CUP_COINS[2]], ['4TH–10TH', CUP_COINS[3]]].map(([place, n]) => (
          <span key={place}><small>{place}</small><b><span className="coin-ico coin-ico--sm" />{n.toLocaleString()}</b></span>
        ))}
      </div>
      {won && <p className="ag-cup-won">Last week: #{won.place}. The Cup Contender avatar is in the Locker.</p>}
      <div className="ag-board">
        <div className="ag-board-head"><span>THIS WEEK</span><span>TOTAL</span></div>
        {board == null && <PassLoader />}
        {board?.error && <div className="ag-board-empty">The Cup board opens soon.</div>}
        {board && !board.error && board.rows.length === 0 && <EmptyState kind="podium" title="Nobody on the Cup yet">Today's Daily starts the week's count.</EmptyState>}
        {board?.rows.slice(0, 10).map((r, i) => (
          <div key={r.user_id} className={`ag-board-row${r.user_id === p.user?.id ? ' is-me' : ''}`}>
            <span className={`ag-board-rank ag-board-rank--${i + 1}`}>{i + 1}</span>
            <span className="ag-board-name"><AvatarBadge name={r.username} uid={r.user_id} size={24} /><NameTag name={r.username || 'Player'} uid={r.user_id} /><small className="ag-cup-days">{r.days}/7</small></span>
            <span className="ag-board-ovr">{r.total}</span>
          </div>
        ))}
        {mine >= 10 && (
          <div className="ag-board-row is-me">
            <span className="ag-board-rank">{mine + 1}</span>
            <span className="ag-board-name"><AvatarBadge name={board.rows[mine].username} self size={24} /><NameTag name={board.rows[mine].username} self /><small className="ag-cup-days">{board.rows[mine].days}/7</small></span>
            <span className="ag-board-ovr">{board.rows[mine].total}</span>
          </div>
        )}
      </div>
    </section>
  )
}

function Missions({ p }) {
  const signIn = () => window.dispatchEvent(new CustomEvent('bap:auth'))
  const claim = (id, el) => { if (!p.signedIn) { signIn(); return } const xp = claimMission(id); if (xp) { sfx('coins'); haptic('success'); claimFx(el, `+${xp} XP`) } }   // missions pay coins
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
              ? <button className="ag-btn ag-mission-claim" onClick={e => claim(m.id, e.currentTarget)}>{p.signedIn ? <span className="gain"><XpIco /> +{def.xp}</span> : 'SIGN IN'}</button>
              : <span className="ag-mission-xp">{m.claimed ? 'DONE' : <>{m.n}/{def.goal}{p.signedIn ? <> · <span className="gain"><XpIco /> {def.xp}</span></> : ''}</>}</span>}
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
        <WeeklyCup p={p} />
        {(
          <section className="ag-extras ag-daily-extras ag-pop" style={{ '--d': '120ms', padding: 0 }}>
            <button className="ag-mini ag-mini--purple" style={{ gridColumn: '1 / -1' }} onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'salarycap' })) }}>
              <span className="ag-mini-flag">DAILY</span>
              <span className="ag-mini-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconCoin size={17} /> SALARY CAP</span>
              <span className="ag-mini-sub">Today's budget build{isBucket ? '' : ' · QB'}</span>
            </button>
          </section>
        )}
        <Missions p={p} />
      </div>
    </div>
  )
}
