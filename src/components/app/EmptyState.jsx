import { RUNNER, DUNKER } from './mascotPaths'
import './empty.css'

// Empty states: the logo's players as the mascot (the runner in football, the dunker
// in basketball, picked by html.is-bucket), in a small animated scene, then the copy.
//   podium  boards nobody's on yet: the mascot hops onto the #1 block and waits there
//   duo     friends / online games: the mascot and an open spot (its dashed outline) with + or VS
//   road    Takeover runs: the mascot runs in place while the route draws itself to the pin
//   cards   the binder: the front card flips over to show the mascot

// The mascot standing on (0, 0): bottom centre, `h` tall. `ghost` draws it as a dashed outline.
export function Mascot({ h, ghost = false, flip = false }) {
  const fig = (m, cls) => {
    const s = h / m.h
    return (
      <g className={cls} transform={`${flip ? 'scale(-1 1) ' : ''}translate(${(-m.w * s / 2).toFixed(2)} ${(-h).toFixed(2)}) scale(${s.toFixed(4)})`}>
        <path d={m.d} fillRule="evenodd" vectorEffect={ghost ? 'non-scaling-stroke' : undefined} />
      </g>
    )
  }
  return (
    <g className={`ea-fig${ghost ? ' is-ghost' : ''}`}>
      {fig(RUNNER, 'ea-fig-nfl')}
      {fig(DUNKER, 'ea-fig-nba')}
    </g>
  )
}

const ART = {
  podium: () => (
    <svg viewBox="0 0 160 96" className="ea-svg">
      <defs>
        <linearGradient id="ea-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--ag-a1)" stopOpacity=".3" />
          <stop offset="1" stopColor="var(--ag-a1)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon className="ea-beam" points="72,-6 88,-6 102,44 58,44" fill="url(#ea-beam)" />
      <line x1="16" y1="88.5" x2="144" y2="88.5" className="ea-floor" />
      <rect x="30" y="58" width="32" height="30.5" rx="3" className="ea-block" />
      <rect x="64" y="44" width="32" height="44.5" rx="3" className="ea-block ea-block--top" />
      <rect x="98" y="66" width="32" height="22.5" rx="3" className="ea-block" />
      <text x="46" y="78" className="ea-num">2</text>
      <text x="80" y="70" className="ea-num ea-num--top">1</text>
      <text x="114" y="82" className="ea-num">3</text>
      <ellipse cx="80" cy="43.6" rx="11" ry="1.9" className="ea-shadow" />
      <g transform="translate(80 43.5)"><g className="ea-hopin"><g className="ea-idle"><Mascot h={40} /></g></g></g>
    </svg>
  ),
  duo: mid => (
    <svg viewBox="0 0 160 96" className="ea-svg">
      <line x1="16" y1="88.5" x2="144" y2="88.5" className="ea-floor" />
      <g transform="translate(44 88)"><g className="ea-idle"><Mascot h={58} /></g></g>
      <g transform="translate(118 88)"><Mascot h={58} ghost flip /></g>
      {mid === 'vs'
        ? <text x="81" y="62" className="ea-vs">VS</text>
        : <g className="ea-plus" transform="translate(118 58)"><g className="ea-plus-in"><circle r="8.5" /><path d="M-3.8 0h7.6M0-3.8v7.6" /></g></g>}
    </svg>
  ),
  road: () => (
    <svg viewBox="0 0 160 96" className="ea-svg">
      <path className="ea-route" d="M24 80 C 52 96, 62 34, 92 48 S 128 66, 138 30" />
      <path className="ea-route-run" pathLength="100" d="M24 80 C 52 96, 62 34, 92 48 S 128 66, 138 30" />
      <circle cx="138" cy="30" r="10" className="ea-pin-ring" />
      <path className="ea-pin" d="M138 34c-4.6-5-7-8.6-7-11.6a7 7 0 0 1 14 0c0 3-2.4 6.6-7 11.6z" />
      <circle cx="138" cy="22.4" r="2.6" className="ea-pin-dot" />
      <ellipse cx="22" cy="84.5" rx="9" ry="1.6" className="ea-shadow ea-shadow--run" />
      <g transform="translate(22 84)"><g className="ea-run"><Mascot h={34} /></g></g>
    </svg>
  ),
  cards: () => (
    <span className="ea-cards">
      <i className="ea-c ea-c--l" />
      <i className="ea-c ea-c--r" />
      <i className="ea-c ea-c--f">
        <i className="ea-face ea-face--back">?</i>
        <i className="ea-face ea-face--front"><svg viewBox="-20 -52 40 56" width="38" height="54"><Mascot h={50} /></svg></i>
      </i>
    </span>
  ),
}

// Loading: a football thrown across and caught again, its nose following the arc like a
// real pass (CSS offset-path); basketball side: the ball bounces
export function PassLoader({ label = 'Loading' }) {
  return (
    <div className="pl" role="status" aria-label={label}>
      <span className="pl-field" aria-hidden="true">
        <img className="pl-fb" src="/fx/football.webp" alt="" draggable={false} />
        <svg className="pl-bb" viewBox="-12 -12 24 24" width="26" height="26"><circle r="9.6" fill="#e8742a" /><path fill="none" stroke="#5a250a" strokeWidth="1.4" d="M-9.6 0h19.2M0-9.6v19.2M-6.7-6.8c3.4 3 3.4 10.6 0 13.6M6.7-6.8c-3.4 3-3.4 10.6 0 13.6" /></svg>
        <i className="pl-shadow" />
      </span>
      <span className="pl-label">{label}</span>
    </div>
  )
}

export default function EmptyState({ kind = 'podium', title, children, mid, small = false }) {
  return (
    <div className={`ea ea--${kind}${small ? ' ea--small' : ''}`}>
      <span className="ea-art" aria-hidden="true">{ART[kind]?.(mid)}</span>
      {title && <b className="ea-title">{title}</b>}
      {children && <span className="ea-text">{children}</span>}
    </div>
  )
}
