import './empty.css'

// Empty states: a small animated drawing in the game's line style, then the copy.
// The ball is the sport's (a football, or a basketball under html.is-bucket).
//   podium  boards nobody's on yet (a ball bounces onto the #1 block)
//   duo     friends / online games (a player and an open spot: + or VS)
//   road    Takeover runs (the route draws itself to the pin)
//   cards   the binder (the front card flips over)

const Ball = () => (
  <g className="ea-ballart">
    <g className="ea-fb" transform="rotate(-28)">
      <ellipse rx="10.5" ry="6.4" fill="#9a5a32" stroke="#4a260f" strokeWidth="1" />
      <path d="M-4.2 0h8.4M-2.4-1.7v3.4M0-1.7v3.4M2.4-1.7v3.4" stroke="#f4efe6" strokeWidth="1.1" strokeLinecap="round" />
    </g>
    <g className="ea-bb">
      <circle r="8.2" fill="#e07a32" stroke="#6b3110" strokeWidth="1" />
      <path d="M-8.2 0h16.4M0-8.2v16.4M-5.8-5.8c3 2.6 3 9 0 11.6M5.8-5.8c-3 2.6-3 9 0 11.6" fill="none" stroke="#6b3110" strokeWidth="1" />
    </g>
  </g>
)

const ART = {
  podium: () => (
    <svg viewBox="0 0 160 96" className="ea-svg">
      <defs>
        <linearGradient id="ea-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--ag-a1)" stopOpacity=".32" />
          <stop offset="1" stopColor="var(--ag-a1)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon className="ea-beam" points="74,0 86,0 100,44 60,44" fill="url(#ea-beam)" />
      <line x1="16" y1="88.5" x2="144" y2="88.5" className="ea-floor" />
      <rect x="30" y="58" width="32" height="30.5" rx="3" className="ea-block" />
      <rect x="64" y="44" width="32" height="44.5" rx="3" className="ea-block ea-block--top" />
      <rect x="98" y="66" width="32" height="22.5" rx="3" className="ea-block" />
      <text x="46" y="78" className="ea-num">2</text>
      <text x="80" y="70" className="ea-num ea-num--top">1</text>
      <text x="114" y="82" className="ea-num">3</text>
      <ellipse cx="80" cy="43.6" rx="9" ry="1.8" className="ea-shadow" />
      <g transform="translate(80 35)"><g className="ea-bounce"><Ball /></g></g>
    </svg>
  ),
  duo: mid => (
    <svg viewBox="0 0 160 96" className="ea-svg">
      <line x1="16" y1="88.5" x2="144" y2="88.5" className="ea-floor" />
      <g className="ea-p1">
        <circle cx="52" cy="38" r="10" />
        <path d="M33 88c1.8-15 9.6-24 19-24s17.2 9 19 24z" />
      </g>
      <g className="ea-p2">
        <circle cx="108" cy="38" r="10" />
        <path d="M89 88c1.8-15 9.6-24 19-24s17.2 9 19 24z" />
      </g>
      {mid === 'vs'
        ? <text x="80" y="60" className="ea-vs">VS</text>
        : <g className="ea-plus" transform="translate(108 70)"><g className="ea-plus-in"><circle r="8" /><path d="M-3.6 0h7.2M0-3.6v7.2" /></g></g>}
      <g transform="translate(52 76)"><g className="ea-hold"><Ball /></g></g>
    </svg>
  ),
  road: () => (
    <svg viewBox="0 0 160 96" className="ea-svg">
      <path className="ea-route" d="M20 76 C 48 96, 60 30, 90 46 S 128 66, 138 30" />
      <path className="ea-route-run" pathLength="100" d="M20 76 C 48 96, 60 30, 90 46 S 128 66, 138 30" />
      <circle cx="20" cy="76" r="4.5" className="ea-start" />
      <circle cx="138" cy="30" r="10" className="ea-pin-ring" />
      <path className="ea-pin" d="M138 34c-4.6-5-7-8.6-7-11.6a7 7 0 0 1 14 0c0 3-2.4 6.6-7 11.6z" />
      <circle cx="138" cy="22.4" r="2.6" className="ea-pin-dot" />
    </svg>
  ),
  cards: () => (
    <span className="ea-cards">
      <i className="ea-c ea-c--l" />
      <i className="ea-c ea-c--r" />
      <i className="ea-c ea-c--f">
        <i className="ea-face ea-face--back">?</i>
        <i className="ea-face ea-face--front"><svg viewBox="-14 -14 28 28" width="34" height="34"><Ball /></svg></i>
      </i>
    </span>
  ),
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
