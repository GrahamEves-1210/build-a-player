import { TEAMS } from '../../../data/nfl-teams'

// The small pieces every Game Day screen shares: a team's badge, a player's face, the words for a down, a spot and
// a clock. Nothing here knows the engine: it reads the view model bridge.js makes.
const BY = Object.fromEntries(TEAMS.map(t => [t.short, t]))
export const teamOf = short => BY[short] ?? { short, name: short, color: '#8b949e', color2: '#12161b', logo: null }
export const nickOf = short => { const n = teamOf(short).name; return n.split(' ').slice(-1)[0] }

const lum = hex => { const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
// A team's colour as a bar on the near-black field: its first colour, its second when the first is too dark to see
// there, white when both are. And the ink that reads on it
export function barOf(short) {
  const t = teamOf(short)
  const color = lum(t.color) >= 0.035 ? t.color : t.color2 && lum(t.color2) >= 0.035 ? t.color2 : '#f2f4f5'
  return { color, ink: lum(color) > 0.36 ? '#0a0c0f' : '#ffffff' }
}

// (the clubs whose logo is one dark colour with no outline of its own: gameday.css draws a hairline round it)
const KEYED = new Set(['NYG', 'NYJ'])
export function Logo({ short, size = 40 }) {
  const t = teamOf(short)
  return (
    <span className={`frgd-logo${KEYED.has(short) ? ' is-keyed' : ''}`} style={{ width: size, height: size }}>
      {t.logo && <img src={t.logo} alt="" width={size} height={size} draggable={false} onError={e => { e.currentTarget.style.visibility = 'hidden' }} />}
    </span>
  )
}

const initials = name => String(name ?? '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
// (ESPN's photo when the game has one for him; his initials when it doesn't: a built player, a made-up backup)
export function Face({ man, size = 56 }) {
  return (
    <span className="frgd-face" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      <b aria-hidden="true">{initials(man?.name)}</b>
      {man?.img && <img src={man.img} alt="" width={size} height={size} loading="lazy" decoding="async" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} />}
    </span>
  )
}

export const ORD = ['1ST', '2ND', '3RD', '4TH']
export const quarterText = q => (q >= 5 ? (q > 5 ? `${q - 4}OT` : 'OT') : ORD[q - 1] ?? '')
export const clockText = s => { const v = Math.max(0, Math.round(s ?? 0)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` }
// the ball's spot the way a broadcast says it: KC 34, BUF 12, 50. spot: yards from the offense's own goal line
export const spotText = (spot, off, def) => (spot == null ? '' : spot === 50 ? '50' : spot < 50 ? `${off} ${spot}` : `${def} ${100 - spot}`)
export const downText = (down, dist, spot) => (!down ? '' : `${ORD[down - 1]} & ${spot != null && dist >= 100 - spot ? 'GOAL' : dist < 1 ? 'INCHES' : dist}`)
export const rankText = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'}`
export const pct = p => `${Math.round(p * 100)}%`

// A number that changes: only the figure that changed plays, once (the key is the value), in a box that never resizes
export const Num = ({ v, still = false }) => <span key={v} className={still || !v ? 'frgd-num' : 'frgd-num is-new'}>{v}</span>

export const IconFF = () => <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M0 0l7 6-7 6zM8 0l7 6-7 6z" fill="currentColor" /></svg>
export const IconBack = () => <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true"><path d="M8 1L2 8l6 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" /></svg>
