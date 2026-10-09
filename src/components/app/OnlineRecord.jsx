import { useProgress, tierFor, nextTier, ONLINE_TIERS, achStats } from '../../lib/progress'
import { ACHIEVEMENTS } from '../../lib/achievements'
import { IconPodium, IconFlame, IconArrow, IconHoop, IconVersus, IconTrophy, IconStar } from './icons'

// Your online record: one rating across the live modes (Compete pools,
// Blacktop 3v3 and Blacktop 1v1), the ladder of tiers, and each mode's own
// numbers. `compact` is the card a lobby shows; the full version is the
// Online screen (AppOnline). Everything comes from lib/progress.js stats.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)
const avg = (n, d, f = 1) => (d ? (n / d).toFixed(f) : '–')
const ord = n => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? 'th'}`

export const MODES = {
  compete: { label: 'Compete', Icon: IconPodium, sub: '5-player pools' },
  bt: { label: 'Blacktop 3v3', Icon: IconHoop, sub: 'Squads · first to 11' },
  h2h: { label: 'Blacktop 1v1', Icon: IconVersus, sub: 'One on one · first to 11' },
}

// Last 10 results as dots: W/L, or a Compete place (1 gold, 2–3 green, 4–5 grey)
export function Form({ items = [], mode }) {
  if (!items.length) return <span className="ol-form ol-form--empty">No games yet</span>
  return (
    <span className="ol-form" aria-label="Recent form">
      {items.map((v, i) => {
        const cls = mode === 'compete' ? (v === 1 ? 'is-gold' : v <= 3 ? 'is-w' : 'is-l') : v === 'W' ? 'is-w' : 'is-l'
        return <i key={i} className={cls} title={mode === 'compete' ? ord(v) : v}>{mode === 'compete' ? v : ''}</i>
      })}
    </span>
  )
}

export function Streak({ n, best }) {
  if (!n && !best) return null
  return (
    <span className={`ol-streak${n >= 2 ? ' is-hot' : ''}`}>
      <IconFlame size={13} />{n >= 2 ? `${n} straight` : n === 1 ? '1 win' : 'no streak'}{best >= 2 ? <small> · best {best}</small> : null}
    </span>
  )
}

export function TierChip({ rating, size = 'md' }) {
  const [, name] = tierFor(rating)
  return <span className={`ol-tier ol-tier--${name.toLowerCase().replace('-', '')} ol-tier--${size}`}>{name.toUpperCase()}</span>
}

// The rating hero: tier, number, the bar to the next tier, best, games
export function RatingHero({ compact = false }) {
  const p = useProgress()
  const o = p.stats?.online ?? { rating: 800, best: 800, played: 0 }
  const [floor, name] = tierFor(o.rating)
  const next = nextTier(o.rating)
  const span = next ? next[0] - floor : 1
  const into = next ? o.rating - floor : 1
  return (
    <div className={`ol-hero ol-hero--${name.toLowerCase().replace('-', '')}${compact ? ' is-compact' : ''}`}>
      <div className="ol-hero-top">
        <span className="ol-hero-rating"><b>{o.rating}</b><small>ONLINE RATING</small></span>
        <TierChip rating={o.rating} size="lg" />
      </div>
      <div className="ol-bar"><span style={{ width: `${next ? Math.max(3, pct(into, span)) : 100}%` }} /></div>
      <div className="ol-hero-foot">
        <span>{next ? <>{next[0] - o.rating} to <b>{next[1]}</b></> : <>Top of the ladder</>}</span>
        <span>Best <b>{o.best}</b> · {o.played} online {o.played === 1 ? 'game' : 'games'}</span>
      </div>
    </div>
  )
}

// One mode's numbers
export function ModeStats({ mode, full = false }) {
  const p = useProgress()
  const st = p.stats ?? {}
  const M = MODES[mode]
  let cells = [], form = [], streak = 0, best = 0
  if (mode === 'compete') {
    const c = st.compete ?? {}
    streak = c.streak ?? 0; best = c.bestStreak ?? 0; form = c.recent ?? []
    cells = [
      ['PLAYED', c.played ?? 0], ['WINS', c.wins ?? 0], ['AVG PLACE', avg(c.placeSum, c.played)],
      ...(full ? [['TOP 3', c.played ? `${pct(c.podiums, c.played)}%` : '–'], ['AVG OVR', c.played ? Math.round(c.ovrSum / c.played) : '–'], ['BEST OVR', c.best || '–'], ['BEATEN', c.beaten ?? 0], ['BEST STREAK', c.bestStreak ?? 0]] : []),
    ]
  } else if (mode === 'bt') {
    const b = st.bt ?? {}
    const g = st.btGames ?? 0
    streak = b.streak ?? 0; best = b.bestStreak ?? 0; form = b.recent ?? []
    cells = [
      ['RECORD', `${st.btWins ?? 0}–${g - (st.btWins ?? 0)}`], ['WIN %', g ? `${pct(st.btWins ?? 0, g)}%` : '–'], ['MVPS', st.btMvp ?? 0],
      ...(full ? [['PPG', avg(b.pts, g)], ['APG', avg(b.ast, g)], ['RPG', avg(b.reb, g)], ['FG %', b.fga ? `${pct(b.fgm, b.fga)}%` : '–'], ['HIGH', b.highPts || '–'], ['STL / BLK', `${b.stl ?? 0} / ${b.blk ?? 0}`], ['BEST STREAK', b.bestStreak ?? 0]] : []),
    ]
  } else {
    const h = st.h2h ?? {}
    streak = h.streak ?? 0; best = h.bestStreak ?? 0; form = h.recent ?? []
    cells = [
      ['RECORD', `${h.wins ?? 0}–${h.losses ?? 0}`], ['WIN %', h.played ? `${pct(h.wins ?? 0, h.played)}%` : '–'], ['PLAYED', h.played ?? 0],
      ...(full ? [['BEST STREAK', h.bestStreak ?? 0], ['FORFEITS', h.forfeits ?? 0]] : []),
    ]
  }
  return (
    <div className={`ol-mode ol-mode--${mode}${full ? ' is-full' : ''}`}>
      <div className="ol-mode-head">
        <span className="ol-mode-ico"><M.Icon size={16} /></span>
        <span className="ol-mode-title"><b>{M.label.toUpperCase()}</b><small>{M.sub}</small></span>
        <Streak n={streak} best={best} />
      </div>
      <div className="ol-cells">{cells.map(([k, v]) => <span key={k} className="ol-cell"><b>{v}</b><small>{k}</small></span>)}</div>
      <div className="ol-mode-foot"><small>FORM</small><Form items={form} mode={mode} /></div>
    </div>
  )
}

// The nearest online achievements still to earn — something to chase
export function NextGoals({ limit = 3 }) {
  const p = useProgress()
  const st = achStats()
  // ratings start at 800, so a tier goal's progress counts from there
  const prog = a => (a.metric === 'onlineBest' ? Math.max(0, a.n - 800) / (a.goal - 800) : a.n / a.goal)
  const goals = ACHIEVEMENTS.filter(a => a.group === 'Online' && !p.ach?.[a.id])
    .map(a => ({ ...a, n: Math.min(a.goal, st[a.metric] ?? 0) }))
    .sort((a, b) => prog(b) - prog(a) || a.goal - b.goal)
    .slice(0, limit)
  if (!goals.length) return null
  return (
    <div className="ol-goals">
      <span className="ag-eyebrow">NEXT UP</span>
      {goals.map(g => (
        <button key={g.id} className="ol-goal" onClick={() => nav('achievements')}>
          <span className="ol-goal-txt"><b>{g.title}</b><small>{g.desc}</small></span>
          <span className="ol-goal-n">{g.n}/{g.goal}</span>
          <span className="ol-goal-bar"><span style={{ width: `${Math.round(prog(g) * 100)}%` }} /></span>
        </button>
      ))}
    </div>
  )
}

// The card a lobby shows: tier + rating, then each mode's headline numbers and
// form, stacked (Blacktop shows its 3v3 and its 1v1 one under the other)
export default function OnlineRecord({ mode, modes = null, compact = true, title = null }) {
  const p = useProgress()
  const o = p.stats?.online ?? { rating: 800 }
  const list = modes ?? [mode]
  if (!compact) return <><RatingHero />{list.map(m => <ModeStats key={m} mode={m} full />)}</>
  return (
    <div className="ol-card ag-pop" style={{ '--d': '60ms' }}>
      <button className="ol-card-head" onClick={() => nav('online')}>
        <span className="ag-eyebrow">{title ?? 'YOUR RECORD'}</span>
        <span className="ol-card-rating"><TierChip rating={o.rating} /><b>{o.rating}</b><IconArrow size={13} /></span>
      </button>
      <div className="ol-stack">{list.map(m => <ModeStats key={m} mode={m} />)}</div>
    </div>
  )
}

export function OnlineTierLadder() {
  const p = useProgress()
  const r = p.stats?.online?.rating ?? 800
  return (
    <div className="ol-ladder">
      {ONLINE_TIERS.map(([floor, name], i) => {
        const on = tierFor(r)[1] === name, done = r >= floor
        return <span key={name} className={`ol-rung${on ? ' is-on' : ''}${done ? ' is-done' : ''}`}><b>{name}</b><small>{i === 0 ? '–' : floor}</small></span>
      })}
    </div>
  )
}

// Lobbies: are we on the live server, or only this device?
export function LinkPill({ link, onRetry, room = null }) {
  if (link === 'live') return <span className="ol-link is-live"><i />LIVE{room ? ` · ${room}` : ''}</span>
  if (link === 'local') return (
    <span className="ol-link is-local">
      <i />NOT ON THE LIVE SERVER · ONLY THIS DEVICE
      {onRetry && <button onClick={onRetry}>RETRY</button>}
    </span>
  )
  return <span className="ol-link is-connecting"><i />CONNECTING…{room ? ` · ${room}` : ''}</span>
}

// Result screens: what this game did to your rating, and what you set
export function RatingLine({ mode }) {
  const p = useProgress()
  const lo = p.lastOnline
  if (!lo || lo.mode !== mode || Date.now() - lo.at > 10 * 60 * 1000) return null
  const up = lo.delta >= 0
  return (
    <div className="ol-result">
      <span className={`ol-delta ${up ? 'is-up' : 'is-down'}`}><b>{up ? '+' : ''}{lo.delta}</b> RATING · {lo.rating} <TierChip rating={lo.rating} /></span>
      {(lo.up || lo.streak >= 2 || lo.pbOvr || lo.highPts || lo.mvp) && (
        <span className="ol-callouts">
          {lo.up && <span className="ol-callout ol-callout--tier"><IconStar size={12} /> TIER UP · {lo.tier.toUpperCase()}</span>}
          {lo.streak >= 2 && <span className="ol-callout ol-callout--hot"><IconFlame size={12} /> {lo.streak} STRAIGHT</span>}
          {lo.pbOvr && <span className="ol-callout"><IconTrophy size={12} /> NEW BEST OVR</span>}
          {lo.highPts && <span className="ol-callout"><IconTrophy size={12} /> CAREER HIGH</span>}
          {lo.mvp && <span className="ol-callout"><IconStar size={12} /> MVP</span>}
        </span>
      )}
    </div>
  )
}
