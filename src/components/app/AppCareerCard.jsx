import { useProgress, SPOTLIGHTS, isUnlocked, setSpotlight, careerRings, careerSeasons, TITLE_LEVELS } from '../../lib/progress'
import { getUsername } from '../../lib/discord'
import { IconLock, IconFlame, IconCards, IconRing, IconStar } from './icons'

// App: the top of the Profile page — your player card (level, title, XP) and
// the locker of stage spotlights unlocked by levels and streaks.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

export default function AppCareerCard({ user }) {
  const p = useProgress()
  const name = getUsername(user) || 'Player'
  const next = TITLE_LEVELS.find(t => t.level > p.lvl.level)
  const seasons = careerSeasons()
  return (
    <section className="ag-career">
      <div className="ag-career-top">
        <span className="ag-avatar ag-avatar--xl">
          {name.slice(0, 1).toUpperCase()}
          <span className="ag-avatar-lvl">{p.lvl.level}</span>
        </span>
        <span className="ag-career-id">
          <span className="ag-career-name">{name}</span>
          <span className="ag-career-title">{p.lvl.title}</span>
        </span>
      </div>
      <div className="ag-career-xp">
        <span className="ag-xpbar ag-xpbar--big"><span style={{ width: `${Math.max(2, p.lvl.pct * 100)}%` }} /></span>
        <span className="ag-career-xpn">
          <b>LVL {p.lvl.level}</b> · {p.lvl.into.toLocaleString()} / {p.lvl.need.toLocaleString()} XP
          {next && <em> · {next.name} at {next.level}</em>}
        </span>
      </div>
      <div className="ag-career-stats">
        <span><IconStar size={15} /><b>{seasons.toLocaleString()}</b>SEASONS</span>
        <span><IconRing size={15} /><b>{careerRings().toLocaleString()}</b>RINGS</span>
        <button onClick={() => nav('cards')}><IconCards size={15} /><b>{Object.keys(p.cards).length.toLocaleString()}</b>CARDS</button>
        <button onClick={() => nav('daily')}><IconFlame size={15} /><b>{p.streak.count}</b>STREAK</button>
      </div>
      <div className="ag-locker">
        <span className="ag-eyebrow">SPOTLIGHT</span>
        <div className="ag-locker-row">
          {SPOTLIGHTS.map(s => {
            const open = isUnlocked(s, p.lvl.level)
            const on = (p.spot || 'classic') === s.id
            return (
              <button key={s.id} className={`ag-spot${on ? ' is-on' : ''}${open ? '' : ' is-locked'}`} disabled={!open}
                onClick={() => setSpotlight(s.id)} aria-label={`${s.name} spotlight${open ? '' : ' (locked)'}`}>
                <i className={`ag-swatch ag-swatch--${s.id}`} />
                <span className="ag-spot-name">{s.name}</span>
                <span className="ag-spot-req">{open ? (on ? 'ON' : '') : s.streak ? <><IconLock size={10} /> {s.streak}-DAY</> : <><IconLock size={10} /> LVL {s.level}</>}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
