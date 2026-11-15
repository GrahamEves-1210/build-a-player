import { useEffect, useRef, useState } from 'react'
import { useCountUp } from '../../lib/useCountUp'
import { nflHeadshot } from '../../utils/simulation'
import { TEAM, photoId, POS_LABEL } from '../../lib/franchise2'
import { CFB_TEAM_BY_SHORT } from '../../data/cfb-teams'
import { sfx } from '../../lib/juice'
import { genFace, buildFaceUrl } from '../../lib/franchise2/faces'

// The small parts every Franchise screen is made of: a logo, a face, a number that counts, a meter that fills,
// a stamp. Flat team colours, the game's type, nothing that moves unless it's delivering a result.

export const teamVars = short => { const t = TEAM[short]; return t ? { '--tc': t.color, '--tc2': t.color2 } : undefined }
// Three logos vanish on their own team colour and on the near-black page (the Rams' blue horns, the Giants' navy
// NY, the Jets' green wordmark; all 32 checked against the team colour, near-black and graphite). Small, they sit
// on a white chip; a big one (a slab's, the hall's) gets a thin white outline.
export const LOGO_CHIP = new Set(['LAR', 'NYG', 'NYJ'])
export const chipCls = s => (LOGO_CHIP.has(s) ? ' is-chip' : '')
export const outlineCls = s => (LOGO_CHIP.has(s) ? ' is-outline' : '')
export const Logo = ({ s, size = 32, className = '' }) => (TEAM[s] ? <img className={`f2-logo${chipCls(s)} ${className}`} src={TEAM[s].logo} alt="" width={size} height={size} style={{ width: size, height: size, '--ls': `${size}px` }} draggable={false} /> : null)
export const lastName = n => { const w = String(n || '').split(' '); return w.length > 2 && /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w[w.length - 1]) ? w.slice(-2).join(' ') : w[w.length - 1] }
const initials = n => String(n || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

// A man's face: his ESPN headshot, a build's own face (the one his player picked: never a real man's photo), a made-up
// man's drawn face, or his initials. color: the jersey under a drawn face (a build: his team's, the player's by default)
// small: a list's face (64 px and under), the lighter drawing
export function photoOf(F, p, color, small = false) {
  if (!p) return null
  if (p.b != null) return buildFaceUrl(F.builds[p.b], color ?? TEAM[F.team]?.color, small ? 'sm' : 'full')
  const id = photoId(p)
  return id ? nflHeadshot(id) : genFace(p, color, small)
}
export function Face({ F, p, src, name, size = 44, mine, col }) {
  const [bad, setBad] = useState(false)
  const url = bad ? null : src ?? photoOf(F, p, undefined, size <= 64)
  const own = mine ?? p?.b != null
  const college = col ? CFB_TEAM_BY_SHORT[col] : null
  return (
    <span className={`f2-face${own ? ' is-mine' : ''}`} style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" loading="lazy" draggable={false} onError={() => setBad(true)} />
        : college ? <img className="f2-face-col" src={college.logo} alt="" loading="lazy" draggable={false} />
          : <b style={{ fontSize: Math.round(size * 0.38) }}>{initials(name ?? p?.n)}</b>}
    </span>
  )
}
// the name a man goes by on a row: a build by its own name with the player's star; everyone else his last name
export const nameOn = (p, full = false) => (p.b != null || full ? p.n : lastName(p.n))

// A number counting up to its value (Reduce Motion: straight there)
export function Count({ v, ms = 700, run = true, className = '' }) {
  const n = useCountUp(v, { run, ms })
  return <span className={className}>{n}</span>
}
// One big OVR (the number alone: no letter under a player's OVR, owner 11-15)
export function Ovr({ o, size = 'm', count = false }) {
  return (
    <span className={`f2-ovr f2-ovr--${size}`}>
      <b>{count ? <Count v={o} /> : o}</b>
    </span>
  )
}
// A chunky meter that fills to its value (0–100) once it's on screen
export function Meter({ label, v, tone = 'team' }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(t) }, [])
  const n = useCountUp(Math.round(v), { run: on, ms: 800 })
  return (
    <div className={`f2-meter f2-meter--${tone}`}>
      <span className="f2-meter-top"><small>{label}</small><b>{n}</b></span>
      <span className="f2-meter-bar"><i style={{ transform: `scaleX(${on ? Math.max(0.02, v / 100) : 0})` }} /></span>
    </div>
  )
}
// W / L stamped on
export function Stamp({ kind, children, big = false, delay = 0 }) {
  const did = useRef(false)
  useEffect(() => { if (did.current) return; did.current = true; const t = setTimeout(() => sfx('stamp'), delay + 160); return () => clearTimeout(t) }, [delay])
  return <span className={`f2-stamp f2-stamp--${kind}${big ? ' is-big' : ''}`} style={{ animationDelay: `${delay}ms` }}>{children}</span>
}
export const PosTag = ({ p }) => <span className="f2-pos">{p.s && (p.p === 'dl' || p.p === 'db') ? p.s.toUpperCase() : POS_LABEL[p.p]}</span>
export const BuildStar = ({ owner }) => <span className="f2-star" title={owner}>★</span>
