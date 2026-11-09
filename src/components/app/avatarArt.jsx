import './avatarArt.css'

// The illustrated avatars: a character or a scene drawn over the badge's colorway
// (cosmetics.js items with `art`; AvatarBadge in NameTag.jsx draws them). Its own
// chunk: it loads the first time one of these shows, never with the first page.
//
// One style for the set: a 48×48 box the badge clips to its shape, flat fills with
// one shade tone, a dark outline every shape inherits (2 units: 1px in a 24px lobby
// row, 4px at the shop's 96px), big shapes that still read at 24px. The Rare ones
// that move have one short moment (avatarArt.css): it plays when the badge comes
// into view or is tapped (lib/fxPause.js), never loops, and not at all with Reduce Motion.

const K = '#15171e'
const N = { stroke: 'none' }

const Art = ({ a, children }) => (
  <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true" className={a ? `aa-${a}` : undefined}>
    <g stroke={K} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">{children}</g>
  </svg>
)
// shoulders in a shirt, for the busts
const Torso = ({ c, y = 38 }) => <path fill={c} d={`M5 49C6 ${y + 3} 13 ${y} 24 ${y}S42 ${y + 3} 43 49Z`} />
const Dot = ({ x, y, r = 1.7, c = K }) => <circle cx={x} cy={y} r={r} fill={c} stroke="none" />
// a lumpy round outline (a fuzzy head, a cream splat): n bumps of b around an ellipse
const f = n => +n.toFixed(1)
function lumps(cx, cy, rx, ry, n, b) {
  const pt = (a, k) => `${f(cx + Math.cos(a) * (rx + k))} ${f(cy + Math.sin(a) * (ry + k))}`
  let d = `M${pt(0, 0)}`
  for (let i = 0; i < n; i++) { const a = (i * 2 * Math.PI) / n, s = (2 * Math.PI) / n; d += `Q${pt(a + s / 2, b * 2)} ${pt(a + s, 0)}` }
  return d + 'Z'
}
// a five-point star
function star(cx, cy, r) {
  let d = ''
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r * 0.45 : r; d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * k)} ${f(cy + Math.sin(a) * k)}` }
  return d + 'Z'
}
const BEAR = lumps(24, 24, 14.6, 14, 14, 1.1)
const CREAM = lumps(24, 28.6, 10.2, 7.4, 11, 1.1)
const UNDERDOG_STAR = star(18.4, 27.5, 2)
const STARS = star(24, 7.6, 3.4) + star(33.4, 11.6, 2.6) + star(15, 10.4, 2.4)
const soccerBall = (cx, cy, r) => (
  <>
    <circle cx={cx} cy={cy} r={r} fill="#fff" />
    <path fill={K} stroke="none" d={`M${cx} ${cy - r * 0.38}l${f(r * 0.36)} ${f(r * 0.26)}-${f(r * 0.14)} ${f(r * 0.42)}h-${f(r * 0.44)}l-${f(r * 0.14)}-${f(r * 0.42)}z`} />
    <path fill="none" strokeWidth="1.1" d={`M${cx} ${f(cy - r * 0.38)}v-${f(r * 0.5)}M${f(cx + r * 0.36)} ${f(cy - r * 0.12)}l${f(r * 0.5)}-${f(r * 0.12)}M${f(cx + r * 0.22)} ${f(cy + r * 0.3)}l${f(r * 0.3)} ${f(r * 0.4)}M${f(cx - r * 0.22)} ${f(cy + r * 0.3)}l-${f(r * 0.3)} ${f(r * 0.4)}M${f(cx - r * 0.36)} ${f(cy - r * 0.12)}l-${f(r * 0.5)}-${f(r * 0.12)}`} />
  </>
)
const ballSeams = (cx, cy, r) => <path fill="none" strokeWidth="1.1" d={`M${cx - r} ${cy}h${r * 2}M${cx} ${cy - r}v${r * 2}M${f(cx - r * 0.7)} ${f(cy - r * 0.72)}c${f(r * 0.4)} ${f(r * 0.4)} ${f(r * 0.4)} ${f(r * 1.04)} 0 ${f(r * 1.44)}M${f(cx + r * 0.7)} ${f(cy - r * 0.72)}c-${f(r * 0.4)} ${f(r * 0.4)}-${f(r * 0.4)} ${f(r * 1.04)} 0 ${f(r * 1.44)}`} />

// a keeper's glove (the left one; the right is its mirror)
const GLOVE = (
  <>
    <rect x="3.4" y="32.6" width="10.6" height="7.4" rx="1.6" fill="#f43f5e" />
    <path fill="#f8fafc" d="M2.2 22v-9a1.9 1.9 0 0 1 3.8 0v9zM5.8 21V10.4a1.9 1.9 0 0 1 3.8 0V21zM9.4 21V11a1.9 1.9 0 0 1 3.8 0v10zM13 22v-7.4a1.8 1.8 0 0 1 3.6 0V22z" />
    <rect x="1.6" y="18.6" width="15" height="16" rx="5" fill="#f8fafc" />
    <rect x="4.2" y="22.4" width="9.6" height="8.6" rx="2.6" fill="#fda4af" stroke="none" />
    <path fill="#f8fafc" d="M15.6 26.6c2-1.6 4.6-1.4 5.4.6.6 1.6-.6 2.6-2.4 2.8l-3 .6z" />
  </>
)

export const AVATAR_ART = {
  // ── Football ──────────────────────────────────────────────────────────────
  zebra: () => (
    <Art>
      <Torso c="#fff" />
      <path fill={K} stroke="none" d="M11 41.6h3V49h-3zM18 39.4h3V49h-3zM27 39.4h3V49h-3zM34 41.6h3V49h-3z" />
      <Torso c="none" />
      <path fill="#fff" d="M17.5 14 13 3l9 7zM30.5 14 35 3l-9 7z" />
      <path fill={K} stroke="none" d="m13 3 1.6 4 2-1.6zM35 3l-1.6 4-2-1.6z" />
      <path fill="#fff" d="M16 17c0-8 16-8 16 0l-.6 11c0 7-2.4 12-7.4 12s-7.4-5-7.4-12z" />
      <path fill={K} stroke="none" d="m16.4 26.2 3.8.8-3.6 1.8zm.4 4.4 3.4.6-3 1.8zm14.8-4.4-3.8.8 3.6 1.8zm-.4 4.4-3.4.6 3 1.8z" />
      <ellipse cx="24" cy="34.6" rx="6.2" ry="5.2" fill="#52525b" />
      <Dot x={21.8} y={33.4} r={1} c="#a1a1aa" /><Dot x={26.2} y={33.4} r={1} c="#a1a1aa" />
      <circle cx="20.4" cy="21.6" r="2.7" fill="#fff" /><circle cx="27.6" cy="21.6" r="2.7" fill="#fff" />
      <Dot x={20.8} y={21.8} r={1.3} /><Dot x={27.2} y={21.8} r={1.3} />
      <path fill="#f8fafc" d="M17 13c0-7.5 14-7.5 14 0z" />
      <path fill="#e2e8f0" d="M15 13.2c4 2 14 2 18 0-4-1.6-14-1.6-18 0z" />
      <rect x="27" y="36.4" width="7" height="3.4" rx="1.4" fill="#cbd5e1" />
      <path fill="#facc15" d="M36.4 3.2c3-1.6 6 0 9.4-1.2l-.8 8c-3 1.2-6-.6-9 .8z" />
      <circle cx="36" cy="11.4" r="1.7" fill="#facc15" />
    </Art>
  ),
  robo: () => (
    <Art>
      <path fill="#64748b" d="M20 31h8v7h-8z" />
      <path fill="#2563eb" d="m5 49 2-7c3-3 9-4.4 17-4.4S38 39 41 42l2 7z" />
      <path fill="none" strokeWidth="1.6" d="m20 37.8 4 4 4-4" />
      <circle cx="11.5" cy="22.5" r="2.6" fill="#64748b" /><circle cx="36.5" cy="22.5" r="2.6" fill="#64748b" />
      <path fill="none" d="M24 11.5V6" /><circle cx="24" cy="5" r="2.2" fill="#f87171" />
      <rect x="12" y="11.5" width="24" height="21.5" rx="5" fill="#cbd5e1" />
      <path fill="#94a3b8" stroke="none" d="M31.4 12.6c2.4.2 3.6 1.8 3.6 4.4v11.4c0 2.6-1.2 4.2-3.6 4.4z" />
      <rect x="15" y="16.6" width="18" height="7.6" rx="3.8" fill="#0f172a" />
      <path fill="#22d3ee" stroke="none" d="M17.6 19.2h5v2.6h-5zm7.8 0h5v2.6h-5z" />
      <rect x="18.5" y="27" width="11" height="3.6" rx="1.4" fill="#64748b" />
      <path fill="none" strokeWidth="1" d="M21.2 27.2v3.2M24 27.2v3.2M26.8 27.2v3.2" />
      <g transform="rotate(-35 39 9)">
        <ellipse cx="39" cy="9" rx="6.4" ry="3.9" fill="#a0522d" />
        <path fill="none" stroke="#fff" strokeWidth="1.1" d="M36.4 9h5.2M37.6 8v2M39 8v2M40.4 8v2" />
      </g>
    </Art>
  ),
  coach: () => (
    <Art>
      <Torso c="#7f1d1d" />
      <path fill="#fff" d="m19 38.6 5 5.4 5-5.4z" />
      <path fill="#b91c1c" stroke="none" d="m12 43 2-2.6 2 2.6-2 2.6zm20 0 2-2.6 2 2.6-2 2.6z" />
      <circle cx="24" cy="25" r="10.5" fill="#c68642" />
      <path fill="#e5e7eb" d="M13.6 20.6c0-10 20.8-10 20.8 0z" />
      <path fill="#cbd5e1" d="M12 20.4c5-2 19-2 24 0-5 2.2-19 2.2-24 0z" />
      <path fill="none" strokeWidth="2.4" d="M12.4 23.4c-1-13 24.2-13 23.2 0" />
      <rect x="9.6" y="21.4" width="4.6" height="7.6" rx="2" fill="#111827" />
      <rect x="33.8" y="21.4" width="4.6" height="7.6" rx="2" fill="#111827" />
      <path fill="none" strokeWidth="1.6" d="M12 28.6c.5 4 3 5.4 6.4 5.4" />
      <path fill="none" strokeWidth="1.8" d="m17.6 22.6 3.6.9m9.2-.9-3.6.9" />
      <Dot x={20} y={24.6} r={1.5} /><Dot x={28} y={24.6} r={1.5} />
      <g transform="rotate(-6 24 33)">
        <rect x="14.5" y="26.6" width="19" height="15" rx="1.6" fill="#b45309" />
        <path fill="#fff" stroke="none" d="M16.3 28.6h15.4v11.6H16.3z" />
        <rect x="20.5" y="25.4" width="7" height="3.2" rx="1" fill="#cbd5e1" />
        <path fill="none" strokeWidth="1.1" d="m18.6 31.4 2 2m0-2-2 2m3 4.4c2-3 4-4 6-4.6" />
        <circle cx="28" cy="36.6" r="1.3" fill="none" strokeWidth="1.1" />
      </g>
      <circle cx="33.6" cy="38.6" r="2.6" fill="#c68642" />
    </Art>
  ),
  cooler: () => (
    <Art a="cooler">
      <Torso c="#1e3a8a" y={39} />
      <circle cx="13.4" cy="31" r="2.6" fill="#d39a5c" /><circle cx="34.6" cy="31" r="2.6" fill="#d39a5c" />
      <circle cx="24" cy="30" r="10.5" fill="#e0ac69" />
      <path fill="none" strokeWidth="1.8" d="m17.8 30.6 2.8 1.4-2.8 1.4m12.4-2.8-2.8 1.4 2.8 1.4" />
      <path fill="#7f1d1d" d="M20.2 35.2h7.6c0 4.4-7.6 4.4-7.6 0z" />
      <path fill="#fff" stroke="none" d="M21 35.8h6v1.1h-6z" />
      <path fill="#fb923c" d="M12.1 19.3 26.9 10.8c4.1 2.2 7.6 6.2 7.9 11.2.2 3.5-.6 6-1.8 6-1 0-1.2-1.6-1.4-2.6-.4 3.2-2.8 3.4-3 .2-.6 1.8-3 2-3-.6-.6 3.4-3.8 3.4-4 0-.6 1.8-3 2-3.2-.2-.6 3-3.6 3.2-4 .2-.4 1.4-1.8 1.2-1.8-.6 0-1.8-.3-3.4-.5-5.1z" />
      <path fill="none" stroke="#fff" strokeWidth="1.4" d="M19.6 17.4c2.6-1.4 5-2.2 7.6-2.4m3.2 2.4c1.6 1.4 2.4 3 2.6 5" />
      <g transform="translate(16 9) rotate(150)">
        <path fill="#f97316" d="M-9.5-7h19l-2 13h-15z" />
        <path fill="none" stroke="#c2410c" strokeWidth="1.3" d="M-8.4-1h16.8M-7.8 2.6h15.6" />
        <rect x="-9.6" y="-8.8" width="19.2" height="3.2" rx="1.2" fill="#fdba74" />
      </g>
      <g fill="#e0f2fe" strokeWidth="1.4">
        <rect x="35" y="9.4" width="5" height="5" rx="1.2" transform="rotate(20 37.5 11.9)" />
        <rect x="5.4" y="24" width="4.4" height="4.4" rx="1.1" transform="rotate(-16 7.6 26.2)" />
      </g>
      <g className="aa-d" fill="#fb923c" strokeWidth="1.2">
        <circle cx="38.6" cy="21" r="1.6" /><circle cx="9" cy="33" r="1.3" /><circle cx="39.6" cy="30.6" r="1.3" /><circle cx="6.6" cy="18.4" r="1.2" />
      </g>
    </Art>
  ),
  // Underdog: a scrappy dog in profile, head up, a red cape tied at the neck
  trenchdog: () => (
    <Art>
      <g transform="translate(1 3)">
        <path fill="#dc2626" d="M33.6 21.6c4.6-4 9.8-6 17-5.8v14c-5.4-.4-10 1.4-13.8 4.6z" />
        <path fill="none" stroke="#991b1b" strokeWidth="1.5" d="M37.4 25.4c3.6-2.6 7.6-3.8 12.6-3.8" />
        <path fill="#1b1d24" d="M14 49c.6-7 2.4-15 4.4-24.4l-.6-3.6-3.4-1.4-8-4.2c-1.8-.8-2.4-3.8-1-4.8l9.2 3.4 1.8-1.4-.2-1.6 1.4.4.4-1.8 1.4.4c1-2.2 2.6-3.4 4.2-3.6l3-8 3.8 12.2c2 2.4 3 5.4 3.6 8.8 1.4 6.6 4.6 13.6 7.6 19.6 1.6 3.4 2.6 6.6 3 10z" />
        <path fill="none" stroke="#5b6170" strokeWidth="1" d="M26.6 2.4 28.4 8" />
        <Dot x={19.4} y={13.4} r={0.85} c="#e5e7eb" />
        <path fill="#dc2626" d="M18.2 25c5.8 2 11.8 1 16.8-2.4l1.4 3.4c-5.4 4-12.4 5-18.6 3z" />
        <path fill="#dc2626" d="m17.6 29-4 4.6 3.2.2 2.2-2.4z" />
        <circle cx="18.4" cy="27.4" r="3" fill="#dc2626" />
        <path fill="#fff" stroke="none" d={UNDERDOG_STAR} />
      </g>
    </Art>
  ),

  // ── Basketball ────────────────────────────────────────────────────────────
  // ── Basketball ────────────────────────────────────────────────────────────
  goatmode: () => (
    <Art a="goat">
      <path fill="#d9b47c" d="M18 16C15 9 11 6 5 7c4 2 7 6 9 12zm12 0c3-7 7-10 13-9-4 2-7 6-9 12z" />
      <path fill="#f1ece2" d="M16 21c-5-2-10-1-12 3 4 2 8 2 12 1zm16 0c5-2 10-1 12 3-4 2-8 2-12 1z" />
      <path fill="#e7dfd1" d="M21 39c0 4 2 7 3.5 8.5C26 45 27 42 27 39z" />
      <path fill="#f6f2ea" d="M15 19c0-7 18-7 18 0l-1 11c-1 7-4 10-8 10s-7-3-8-10z" />
      <path fill="#e3dacb" stroke="none" d="M31.6 15.2c1 1 1.4 2.3 1.4 3.8l-1 11c-1 7-4 10-8 10 3-2.5 5-7 5.5-13 .3-5 1-9 2.1-11.8z" />
      <path fill="#ef4444" d="M15.2 18c5-1.6 12.6-1.6 17.6 0l-.2 4c-5-1.4-12.2-1.4-17.2 0z" />
      <path fill="#fff" stroke="none" d="M15.4 19.6c5-1.3 12.2-1.3 17.2 0v.9c-5-1.3-12.2-1.3-17.2 0z" />
      <path fill="#ef4444" d="m32.6 19 4.6-3-.3 3.6zm0 1.4 4.4 2.2-2 1.6z" />
      <path fill="#fde68a" d="M16.8 25.2H22c0 2.6-5.2 2.6-5.2 0z" />
      <rect x="17.6" y="25.5" width="3.6" height="1.3" rx=".6" fill={K} stroke="none" />
      <g className="aa-w">
        <path fill="#fde68a" d="M26 25.2h5.2c0 2.6-5.2 2.6-5.2 0z" />
        <rect x="26.8" y="25.5" width="3.6" height="1.3" rx=".6" fill={K} stroke="none" />
      </g>
      <path fill="none" strokeWidth="2.2" d="m16.6 23.2 5.4.9m9.4-.9-5.4.9" />
      <ellipse cx="24" cy="34.5" rx="5.6" ry="4.2" fill="#eec4b4" />
      <Dot x={22.2} y={33.6} r={0.9} /><Dot x={25.8} y={33.6} r={0.9} />
      <path fill="none" strokeWidth="1.5" d="M21.6 37q2.6 1.4 5-.6" />
    </Art>
  ),
  dino: () => (
    <Art>
      <path fill="none" stroke="#fff" strokeWidth="1.2" d="m28 13 2 8m2-7.4.8 7.6m3.2-7.6-.8 7.6M40 13l-2 8m-9-4h10" />
      <circle cx="34" cy="8.6" r="5" fill="#f97316" />
      {ballSeams(34, 8.6, 5)}
      <path fill="none" strokeWidth="3.8" d="M26.4 13h15.2" />
      <path fill="none" stroke="#ea580c" strokeWidth="2" d="M26.4 13h15.2" />
      <path fill="#7f1d1d" d="M35 25.5 24 28l9 3.5c1-2 1.8-4 2-6z" />
      <path fill="#4ade80" d="M4 49c1-9 4-16 7-20 0-7 4-13 11-13 6 0 11 2 14 5 1.5 1.5 1 4-1 4.5L24 28c2 2 6 3 9 3.5 1.5.5 1 3-.5 3.1-5.5.4-11.5-.6-13.5 2.4-2 3-1 7 1 12z" />
      <path fill="#fff" strokeWidth="1" d="m27.4 27.2 1 1.8 1-2.1zm4-.9 1 1.8 1-2.1z" />
      <g fill="#22c55e" stroke="none"><circle cx="15" cy="23" r="1.6" /><circle cx="11.6" cy="31" r="1.3" /><circle cx="27" cy="18.6" r="1.2" /><circle cx="9" cy="40" r="1.5" /></g>
      <circle cx="20.6" cy="21.6" r="2.8" fill="#fff" /><Dot x={21.4} y={21.2} r={1.4} />
      <path fill="none" strokeWidth="2" d="m17.4 18.2 6 1" />
      <path fill="none" strokeWidth="3.6" d="m16.6 40.4 4-2.6 1.4-2.6" />
      <path fill="none" stroke="#4ade80" strokeWidth="1.6" d="m16.6 40.4 4-2.6 1.4-2.6" />
    </Art>
  ),
  buzzer: () => (
    <Art a="buzzer">
      <path fill="#64748b" d="M21 37h6v12h-6z" />
      <g className="aa-l">
        <rect x="12" y="10" width="24" height="6" rx="2" fill="#ef4444" />
        <path fill="#fecaca" stroke="none" d="M14.6 11.8h8v1.4h-8z" />
      </g>
      <rect x="8" y="15" width="32" height="23" rx="3.5" fill="#111827" />
      <g className="aa-g">
        <g fill="none" stroke="#f87171" strokeWidth="2.8"><rect x="12.6" y="19.6" width="8.4" height="14" rx="3" /><rect x="27" y="19.6" width="8.4" height="14" rx="3" /></g>
        <Dot x={24} y={32.4} r={1.6} c="#f87171" />
      </g>
      <circle cx="38.4" cy="9.4" r="6" fill="#f97316" />
      {ballSeams(38.4, 9.4, 6)}
    </Art>
  ),
  ankles: () => (
    <Art>
      <ellipse cx="24" cy="10" rx="12" ry="3.6" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="2 2.4" />
      <path fill="#fde047" strokeWidth="1.4" d={STARS} />
      <path fill="none" stroke="#fff" strokeWidth="1.8" d="M2.6 24h4.4M1.6 30H7m-3 6h3" />
      <path fill="#ef4444" d="m9 40 1.6-21c.2-2.4 2.4-4 4.6-3.4l7.4 1.8c1.4 5.4 5.4 9.6 11 11.2l7 2c2.6.8 4 3.2 3.6 5.6L44 40z" />
      <path fill="#f8fafc" d="m33.6 28.6 7 2c2.6.8 4 3.2 3.6 5.6L44 40h-9c-1.2-3.6-1.6-7.4-1.4-11.4z" />
      <path fill="none" stroke="#fff" strokeWidth="1.6" d="m22.4 21.2 3-2M24 24.6l3-2.2m-.4 5 2.6-2.4" />
      <g transform="rotate(-32 15.6 28)"><rect x="9.6" y="25.6" width="12" height="4.8" rx="2.4" fill="#fcd9b6" /><path fill="#f0b98d" stroke="none" d="M13.6 26.6h4v2.8h-4z" /></g>
      <g transform="rotate(32 15.6 28)"><rect x="9.6" y="25.6" width="12" height="4.8" rx="2.4" fill="#fcd9b6" /><path fill="#f0b98d" stroke="none" d="M13.6 26.6h4v2.8h-4z" /></g>
      <path fill="none" strokeWidth="1.4" d="m25 31.6 2 2.2-1.4 2.2 2 2.4" />
      <path fill="#f8fafc" d="M7.6 39.4H45c.4 2.8-.8 5.6-3.6 5.6H10.6c-2.4 0-3.4-2.4-3-5.6z" />
      <path fill="none" strokeWidth="1.1" d="M10 42.2h32" />
    </Art>
  ),

  // ── Soccer ────────────────────────────────────────────────────────────────
  hattrick: () => (
    <Art>
      {soccerBall(24, 38, 10)}
      <path fill="#dc2626" d="M15.5 30c0-8.6 17-8.6 17 0z" />
      <path fill="#b91c1c" d="M30 29.4c4-1.4 9-.8 12 1.4-3.4 1.4-8.4 1.2-12 .4z" />
      <path fill="#2563eb" d="M17 23.6c0-9 14-9 14 0z" />
      <rect x="16.4" y="21" width="15.2" height="4" rx="1.6" fill="#1d4ed8" />
      <path fill="none" stroke="#93c5fd" strokeWidth="1" d="M20.6 21.6v2.8M24 21.6v2.8m3.4-2.8v2.8" />
      <g transform="rotate(10 24 15)">
        <path fill="#27272a" d="m19 15.6.8-11h8.4l.8 11z" />
        <path fill="#facc15" stroke="none" d="M19.5 11.6h9l.2 2.2h-9.4z" />
        <path fill="#27272a" d="M15.8 15.6c3-1.4 13.4-1.4 16.4 0-3 1.6-13.4 1.6-16.4 0z" />
      </g>
    </Art>
  ),
  topbins: () => (
    <Art>
      <path fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth=".9" d="m0 16 20 20M0 26l18 18M0 36l13 13M6 8.6l32 32M16 8.6l22 22M26 8.6l12 12M0 22 13.4 8.6M0 34 25.4 8.6M0 46 37.4 8.6M10 49l27.4-27.4M22 49l15.4-15.4" />
      <path fill="none" stroke="#fff" strokeWidth=".9" d="M37.4 8.6h-7.6m7.6 0-6 5m6-5-3 7.4m3-7.4v8M31.4 8.6c.4 2 1.6 3.6 3 4.6.8.6 1.8 1 3 1.2" />
      <path fill="#f8fafc" d="M-1 4h43v45h-4.6V8.6H-1z" />
      {soccerBall(27, 21, 7.2)}
      <path fill="none" stroke="#fff" strokeWidth="1.8" d="m15.4 27.6-4 2.8M14.8 21.4h-4.6m7.2-6.2-3.6-2.4" />
    </Art>
  ),
  keeper: () => (
    <Art>
      <Torso c="#a3e635" />
      <path fill="none" strokeWidth="1.6" d="M19 38.4c2 2.4 8 2.4 10 0" />
      <circle cx="24" cy="25" r="10" fill="#c68642" />
      <path fill="#1c1917" d="M14.4 22.4c-.6-6 3.4-9.6 9.6-9.6s10.2 3.6 9.6 9.6c-2.6-2-5.6-2.6-9.6-2.6s-7 .6-9.6 2.6z" />
      <path fill="none" strokeWidth="2" d="m17.6 22.8 4.2 1.2m8.6-1.2-4.2 1.2" />
      <Dot x={20.2} y={25.8} r={1.6} /><Dot x={27.8} y={25.8} r={1.6} />
      <rect x="20.6" y="29.6" width="6.8" height="2.8" rx="1" fill="#fff" />
      <path fill="none" strokeWidth="1" d="M20.8 31h6.4" />
      <g>{GLOVE}</g>
      <g transform="matrix(-1 0 0 1 48 0)">{GLOVE}</g>
    </Art>
  ),

  // ── Baseball ──────────────────────────────────────────────────────────────
  rallycap: () => (
    <Art>
      <Torso c="#e5e7eb" />
      <path fill="none" stroke="#dc2626" strokeWidth="1.4" d="M19 38.6c2 2 8 2 10 0" />
      <circle cx="24" cy="27" r="10.5" fill="#c68642" />
      <path fill="#4d7c0f" d="M18.5 16.5 19 5.5C23 3 29 3 32 5l-2.5 11z" />
      <path fill="#e7e5e4" d="M13.2 24c0-11.6 21.6-11.6 21.6 0-5-1.8-16.6-1.8-21.6 0z" />
      <path fill="none" stroke="#dc2626" strokeWidth="1.2" d="M14.2 23.2c5-1.4 14.6-1.4 19.6 0" />
      <path fill="none" strokeWidth="1.1" d="M24 15.6v6.4M18 17.6l2.4 4.6M30 17.6l-2.4 4.6" />
      <rect x="26.6" y="13.4" width="4.6" height="3" rx=".5" fill="#fff" strokeWidth="1.2" transform="rotate(18 28.9 14.9)" />
      <circle cx="20" cy="28" r="2.6" fill="#fff" /><circle cx="28" cy="28" r="2.6" fill="#fff" />
      <Dot x={20.3} y={26.9} r={1.3} /><Dot x={28.3} y={26.9} r={1.3} />
      <path fill="none" strokeWidth="1.8" d="m17.2 25 3.8-1.2m9.8 1.2L27 23.8" />
      <ellipse cx="24" cy="32.4" rx="1.3" ry="1.1" fill={K} stroke="none" />
      <path fill="#c68642" d="m19.8 49 .8-10.6c.2-2.6 2-3.6 3.4-4.4 1.4.8 3.2 1.8 3.4 4.4l.8 10.6z" />
      <path fill="none" strokeWidth="1.2" d="M24 34.6V49" />
    </Art>
  ),
  seeds: () => (
    <Art>
      <Torso c="#f8fafc" />
      <path fill="none" stroke="#94a3b8" strokeWidth=".9" d="M12 41v8m5-9.6V49m14-9.6V49m5-8v8" />
      <Torso c="none" />
      <circle cx="23" cy="27" r="10.5" fill="#e0ac69" />
      <circle cx="30.6" cy="31" r="4.6" fill="#e0ac69" />
      <circle cx="29.4" cy="30" r="4.3" fill="#e0ac69" stroke="none" />
      <path fill="#1e3a8a" d="M12.5 23c0-11 21-11 21 0z" />
      <path fill="#172554" d="M11 22.6c5-2.4 19-2.4 24 0-5 2.4-19 2.4-24 0z" />
      <path fill={K} stroke="none" d="M16.4 28.6H21v1.7h-4.6zm8.4 0h4.6v1.7h-4.6z" />
      <Dot x={18.7} y={26.6} r={1.6} /><Dot x={27.1} y={26.6} r={1.6} />
      <path fill="none" strokeWidth="1.5" d="M16.6 25.6h4.2m4.2 0h4.2" />
      <circle cx="27.4" cy="33.4" r="1.2" fill="#7f1d1d" strokeWidth="1.3" />
      <ellipse cx="37.6" cy="30.6" rx="2.6" ry="1.3" fill="#1f2937" strokeWidth="1" transform="rotate(-20 37.6 30.6)" />
      <path fill="none" stroke="#fff" strokeWidth=".8" d="m35.8 31.2 3.6-1.2" />
      <ellipse cx="42" cy="25.6" rx="2" ry="1" fill="#1f2937" strokeWidth="1" transform="rotate(30 42 25.6)" />
    </Art>
  ),
  pie: () => (
    <Art a="pie">
      <Torso c="#f8fafc" />
      <path fill="none" stroke="#dc2626" strokeWidth="1.6" d="M18.6 38.6c2.6 2.6 8.2 2.6 10.8 0" />
      <circle cx="24" cy="26.5" r="11" fill="#8d5524" />
      <path fill="#1d4ed8" d="M12.6 20.6c0-13.2 22.8-13.2 22.8 0z" />
      <path fill="#93c5fd" stroke="none" d="M18 14.4c2-2.4 5-3.2 8-3.2-3 1-5.4 2.4-6.6 4.4z" />
      <path className="aa-p" fill="#fff" strokeWidth="1.6" d="M15.6 33v6c0 1.8 2.8 1.8 2.8 0v-6z" />
      <path fill="#fff" d={CREAM} />
      <path fill="#e2e8f0" stroke="none" d="M15 32.4c4 2.6 14 2.8 18.4-.2-1.6 3-16.4 3.4-18.4.2z" />
      <circle cx="20" cy="26.4" r="2.8" fill="#8d5524" strokeWidth="1.2" /><circle cx="28" cy="26.4" r="2.8" fill="#8d5524" strokeWidth="1.2" />
      <circle cx="20" cy="26.4" r="1.6" fill="#fff" stroke="none" /><circle cx="28" cy="26.4" r="1.6" fill="#fff" stroke="none" />
      <Dot x={20.4} y={26.6} r={0.9} /><Dot x={28.4} y={26.6} r={0.9} />
      <circle cx="31.6" cy="20.6" r="2" fill="#ef4444" strokeWidth="1.4" />
      <g transform="rotate(-24 39.4 39)">
        <ellipse cx="39.4" cy="39" rx="7.4" ry="3" fill="#cbd5e1" />
        <ellipse cx="39.4" cy="38.6" rx="4.6" ry="1.5" fill="#94a3b8" strokeWidth="1" />
      </g>
    </Art>
  ),
  batflip: () => (
    <Art>
      <path fill="none" stroke="#fff" strokeWidth="2" d="M33 5c5 1 8 4 9 9M15 43c-5-1-8-4-9-9" />
      <g transform="rotate(-38 24 24)">
        <path fill="#d6a26b" d="M4 22.2h2c.6-.6 1.4-.8 2.4-.8l30-1.4c3.4 0 5.6 1.8 5.6 4s-2.2 4-5.6 4l-30-1.4c-1 0-1.8-.2-2.4-.8H4z" />
        <path fill={K} stroke="none" d="M10 21.4h5.4v5.2H10z" />
        <path fill="none" stroke="#b07a43" strokeWidth=".9" d="M22 23.4h14M26 25.2h11" />
      </g>
      <circle cx="11" cy="11" r="4.6" fill="#fff" />
      <path fill="none" stroke="#dc2626" strokeWidth="1" d="M8.4 8.2c1.6 1.4 1.8 4 .4 5.8m5-5.8c-1.6 1.4-1.8 4-.4 5.8" />
      <path fill="none" stroke="#fff" strokeWidth="1.6" d="m17 16.6 2.6 2.6m-5 .4 2 2m3.4-6.8 2 2" />
    </Art>
  ),
  bobble: () => (
    <Art a="bobble">
      <rect x="14" y="41" width="20" height="8" rx="1.6" fill="#1e3a8a" />
      <rect x="19" y="43.6" width="10" height="2.6" rx=".8" fill="#fbbf24" stroke="none" />
      <path fill="#f8fafc" d="M16.5 41.4c0-5 3.4-7.4 7.5-7.4s7.5 2.4 7.5 7.4z" />
      <path fill="none" stroke="#ef4444" strokeWidth="1.2" d="M24 35v6" />
      <path fill="none" strokeWidth="1.6" d="m22 34 4-1-4-1 4-1-4-1" />
      <g className="aa-b">
        <circle cx="11.6" cy="19.6" r="2.4" fill="#e5ad6a" /><circle cx="36.4" cy="19.6" r="2.4" fill="#e5ad6a" />
        <circle cx="24" cy="18" r="12.5" fill="#f1c27d" />
        <path fill="#1d4ed8" d="M11.8 15.6c0-13 24.4-13 24.4 0z" />
        <circle cx="24" cy="5.8" r="1.3" fill="#1d4ed8" strokeWidth="1.4" />
        <path fill="#1e40af" d="M10.4 15.4c6-2.6 21.2-2.6 27.2 0-6 2.6-21.2 2.6-27.2 0z" />
        <Dot x={19.2} y={19.8} r={1.9} /><Dot x={28.8} y={19.8} r={1.9} />
        <Dot x={19.8} y={19.2} r={0.6} c="#fff" /><Dot x={29.4} y={19.2} r={0.6} c="#fff" />
        <path fill="#7f1d1d" d="M17.6 23.2h12.8c-1 5.6-11.8 5.6-12.8 0z" />
        <path fill="#fff" stroke="none" d="M18.4 24.1h11.2l-.4 1.3H18.8z" />
        <Dot x={15.6} y={23.4} r={1.8} c="rgba(248,113,113,.55)" /><Dot x={32.4} y={23.4} r={1.8} c="rgba(248,113,113,.55)" />
      </g>
    </Art>
  ),

  // ── Around the game ───────────────────────────────────────────────────────
  bench: () => (
    <Art>
      <Torso c="#fbbf24" />
      <path fill="none" strokeWidth="1.6" d="M19 38.4c2 3 8 3 10 0" />
      <circle cx="24" cy="27" r="10" fill="#8d5524" />
      <path fill="#f8fafc" d="M10.5 42c-.5-14 2.5-30 13.5-30s14 16 13.5 30l-6-1.5.5-9.5c-1-6-4-9.5-8-9.5s-7 3.5-8 9.5l.5 9.5z" />
      <path fill="#e2e8f0" stroke="none" d="M29.4 14c4.4 3 6.4 10 6.6 17l-3.6.6c-.6-5.4-3.4-9.4-7-10.2 2.4-1.6 3.8-4.2 4-7.4z" />
      <path fill="none" stroke="#3b82f6" strokeWidth="1.6" d="m11.2 37 5 .6m20.6-.6-5 .6" />
      <path fill="none" strokeWidth="1.6" d="M18.8 28.6q1.6 1.6 3.2 0m4 0q1.6 1.6 3.2 0" />
      <ellipse cx="24" cy="33.4" rx="1.5" ry="1.2" fill={K} stroke="none" />
      <path fill="#7dd3fc" strokeWidth="1" d="M25.3 34c.6 1.2 1 2.2.4 2.8-.6.5-1.4 0-1.2-.9z" />
      <path fill="none" strokeWidth="3.6" d="M34.6 4.6h5l-5 5.6h5m2.2 2.6h3.4l-3.4 3.6h3.4" />
      <path fill="none" stroke="#fff" strokeWidth="1.6" d="M34.6 4.6h5l-5 5.6h5m2.2 2.6h3.4l-3.4 3.6h3.4" />
    </Art>
  ),
  icebath: () => (
    <Art>
      <circle cx="24" cy="25" r="10.5" fill="#f0c9a0" />
      <circle cx="24" cy="10.4" r="3" fill="#fff" />
      <path fill="#dc2626" d="M13 22c0-11 22-11 22 0z" />
      <rect x="12.4" y="19.4" width="23.2" height="4.8" rx="2.2" fill="#b91c1c" />
      <circle cx="20" cy="26.6" r="2.4" fill="#fff" /><circle cx="28" cy="26.6" r="2.4" fill="#fff" />
      <Dot x={20} y={26.6} r={1.1} /><Dot x={28} y={26.6} r={1.1} />
      <Dot x={16.6} y={30.4} r={1.8} c="#93c5fd" /><Dot x={31.4} y={30.4} r={1.8} c="#93c5fd" />
      <rect x="19.5" y="30.4" width="9" height="3.8" rx="1.2" fill="#fff" />
      <path fill="none" strokeWidth="1" d="M21.8 30.6v3.4m2.2-3.4v3.4m2.2-3.4v3.4m-6.5-1.7h8.6" />
      <path fill="none" strokeWidth="1.6" d="m8 17-2 2 2 2-2 2 2 2m32-8 2 2-2 2 2 2-2 2" />
      <path fill="#7dd3fc" d="M-1 35.4c6-2.4 12 1 18-1s12 1.6 18-.4 9-1 14 .4V49H-1z" />
      <g fill="#f0f9ff">
        <rect x="6" y="31" width="7.5" height="7" rx="1.6" transform="rotate(-14 9.7 34.5)" />
        <rect x="34.5" y="30.4" width="7" height="6.5" rx="1.6" transform="rotate(12 38 33.7)" />
        <rect x="24" y="37" width="6" height="5.4" rx="1.4" transform="rotate(-8 27 39.7)" />
      </g>
      <path fill="#cbd5e1" d="M-1 41.4h50V49H-1z" />
      <path fill="none" stroke="#f1f5f9" strokeWidth="1.2" d="M3 43.8h42" />
    </Art>
  ),
  // redraw before using: the face reads creepy (Top Dog is vaulted until then)
  topdog: () => (
    <Art>
      <rect x="16" y="9" width="16" height="41" rx="8" fill="#d9532b" />
      <path fill="#b8411d" stroke="none" d="M28.6 10.4c1.6 1.2 2.4 3 2.4 5.2V30h-2.4z" />
      <path fill="#efb26a" d="M18.5 49H10c-4-9-4-22 1-29 2.4-3 6-2.2 7.5.6zm11 0H38c4-9 4-22-1-29-2.4-3-6-2.2-7.5.6z" />
      <path fill="#d9954a" stroke="none" d="M8.6 30c-.6 7 .4 13 2.4 18.4h3C11 43 9.6 37 8.6 30zm30.8 0c.6 7-.4 13-2.4 18.4h-3c3-5.4 4.4-11.4 5.4-18.4z" />
      <circle cx="20.8" cy="17.6" r="2.5" fill="#fff" /><circle cx="27.2" cy="17.6" r="2.5" fill="#fff" />
      <Dot x={21.2} y={17.9} r={1.2} /><Dot x={27.6} y={17.9} r={1.2} />
      <path fill={K} strokeWidth="1.2" d="M20.4 21.6q3.6 3.8 7.2 0z" />
      <path fill="none" strokeWidth="4.4" d="m20 27.6 8 3-8 3 8 3-8 3" />
      <path fill="none" stroke="#facc15" strokeWidth="2.4" d="m20 27.6 8 3-8 3 8 3-8 3" />
      <g transform="rotate(-7 24 8)">
        <path fill="#fff" d="M14.6 11.4h18.8l-3.4-7.2H18z" />
        <path fill="#ef4444" stroke="none" d="M16.1 8.4h15.8l.7 1.6H15.4z" />
      </g>
    </Art>
  ),
  foam: () => (
    <Art>
      {/* one foam cutout: the index finger straight up out of a rounded fist, the thumb a stub on the left,
          the curled fingers two grooves on the right, #1 on the palm, the sleeve the fan's arm goes in */}
      <g transform="rotate(-7 24 30)">
        <path fill="#1e3a8a" d="M16 39.6h16l1.4 10H14.6z" />
        <path fill="#fff" stroke="none" d="M15.6 43h16.8l.4 2.4H15.2z" />
        <ellipse cx="13.6" cy="28.4" rx="3.6" ry="5.2" transform="rotate(-18 13.6 28.4)" fill="#facc15" />
        <path fill="#facc15" d="M19 19.4V7.2a4.5 4.5 0 0 1 9 0v12.2h1a6 6 0 0 1 6 6v9.6a6 6 0 0 1-6 6H19a6 6 0 0 1-6-6v-9.6a6 6 0 0 1 6-6z" />
        <path fill="#eab308" stroke="none" d="M25.6 3.4a4.5 4.5 0 0 1 2.4 3.8v12.2h-2.2zM33.4 22.2a6 6 0 0 1 1.6 3.2v9.6a6 6 0 0 1-6 6h-2.4a6 6 0 0 0 6-6v-9.6c0-1.2.3-2.3.8-3.2z" />
        <path fill="none" stroke="#a16207" strokeWidth="1.4" d="M28.6 24.2h5.4M28.6 28.2h5.6" />
        <path fill="none" stroke="#1e3a8a" strokeWidth="1.6" d="m19.6 31.6-.6 6.6m3.4-6.6-.6 6.6m-3.9-4.4h5m-5.3 2.4h5" />
        <path fill="#1e3a8a" stroke="none" d="m25.2 32.2 2.8-1.8h2v8.6h-2.4v-5.4l-2.4 1.1z" />
      </g>
    </Art>
  ),
  mascot: () => (
    <Art>
      <Torso c="#dc2626" y={40} />
      <circle cx="11" cy="11" r="5.5" fill="#8b5a2b" /><circle cx="37" cy="11" r="5.5" fill="#8b5a2b" />
      <Dot x={11.4} y={11.4} r={3} c="#e6c79c" /><Dot x={36.6} y={11.4} r={3} c="#e6c79c" />
      <path fill="#8b5a2b" d={BEAR} />
      <ellipse cx="24" cy="31" rx="9" ry="7" fill="#e6c79c" />
      <ellipse cx="24" cy="33.8" rx="6" ry="3.8" fill="#1c1917" />
      <Dot x={22} y={33.4} r={0.9} c="#fff" /><Dot x={26} y={33.4} r={0.9} c="#fff" />
      <path fill={K} d="M21 26.6h6c0 2.4-6 2.4-6 0z" />
      <circle cx="18" cy="19" r="4.6" fill="#fff" /><circle cx="30" cy="19" r="4.6" fill="#fff" />
      <Dot x={19.4} y={20.6} r={2} /><Dot x={29} y={17.6} r={2} />
    </Art>
  ),
  nachos: () => (
    <Art>
      <path fill="#f6c453" d="M6 30.5 8.6 15 22 25zm10-3L24.6 9 33.4 25zm11 2.5 13.4-12.6 1.6 13.6z" />
      <path fill="#e3a72f" stroke="none" d="M8.6 15 13 26.6l9-1.6zm16-6 1.6 14.6 7.2 1.4zM40.4 17.4 35.6 28l6.4 1.6z" />
      <path fill="#f5f5f4" d="M4.5 30.5h39L39.5 45h-31z" />
      <path fill="#dc2626" stroke="none" d="M6 35.4h36l-.6 2.2H6.6zm1.4 4.6h33.2l-.6 2.2H8z" />
      <path fill="#fb923c" d="M8 31c2-4.6 7-5.6 11-4 3.6-3.6 10-3.4 13.4-.4 3.6-1.4 7.6.4 8.6 4.4v1c-.6 3-2 4.4-2.8 1.6L36 32c-.6 4.8-3 5.4-3.6 1l-3.8-1c-.6 6-3.8 6.6-4.4.8L20 32c-.6 3.4-2.8 3.8-3.4.4L8 32z" />
      <g fill="#22c55e" strokeWidth="1.4"><circle cx="16" cy="28" r="2.6" /><circle cx="30" cy="27" r="2.4" /></g>
      <Dot x={16} y={28} r={1} c="#bbf7d0" /><Dot x={30} y={27} r={0.9} c="#bbf7d0" />
    </Art>
  ),
  camera: () => (
    <Art>
      <Torso c="#dc2626" />
      <circle cx="19" cy="26" r="10" fill="#f1c27d" />
      <path fill="#15803d" d="M10.4 16.6c-3-1-6 0-7.6 2 2 1.2 4.6 1.6 7 1z" />
      <path fill="#16a34a" d="M9 23c0-11 20-11 20 0z" />
      <path fill="#f1c27d" strokeWidth="1.3" d="M15.4 23c0-3 1.8-4.6 3.6-4.6s3.6 1.6 3.6 4.6z" />
      <circle cx="14.6" cy="27.4" r="2.4" fill="#fff" /><Dot x={15} y={27.4} r={1.2} />
      <path fill="#f87171" strokeWidth="1.3" d="M15 33.4h4c0 2.6-4 2.6-4 0z" />
      <path fill="none" strokeWidth="1.4" d="M13.2 33.4h7.6" />
      <path fill="none" strokeWidth="2.6" d="M26 17v-3.4h11V17" />
      <rect x="21" y="17" width="22" height="15" rx="2.4" fill="#27272a" />
      <circle cx="31.6" cy="24.6" r="6.6" fill="#52525b" />
      <circle cx="31.6" cy="24.6" r="4.2" fill="#0ea5e9" />
      <Dot x={30.2} y={23.2} r={1.3} c="#fff" />
      <Dot x={39.8} y={19.8} r={1.4} c="#ef4444" />
      <circle cx="38" cy="33.6" r="2.8" fill="#f1c27d" />
    </Art>
  ),
}
