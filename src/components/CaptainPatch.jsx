// The captain's patch on a Career figure's jersey: the NFL's "C" in team colours over a strip of gold stars, one a
// season as captain (any team, four at most), and the C itself gold past four. Worn on the upper right chest (the
// viewer's left). Drawn only when Career passes the captain on the chips (lib/career.js inTeamColors, captainOf):
// every other mode carries no such thing and looks as before.
// Local units: the patch is 24 wide and 32 tall, centred on 0,0. Each figure places it with its own transform.

// the chip's captain, when Career put one there ({ years }); a real player's captain flag (true) is not it
export const captainIn = build => {
  for (const ch of Object.values(build ?? {})) if (ch && typeof ch.captain === 'object' && ch.captain) return ch.captain
  return null
}

const C_PATH = 'M20 0H7Q0 0 0 7V15Q0 22 7 22H20V15.5H8.6Q6.6 15.5 6.6 13.5V8.5Q6.6 6.5 8.6 6.5H20Z'
const star = (cx, cy, R = 2.8, r = 1.2) => {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r : R
    d += `${i ? 'L' : 'M'}${(cx + k * Math.cos(a)).toFixed(2)} ${(cy + k * Math.sin(a)).toFixed(2)}`
  }
  return d + 'Z'
}
const GOLD = '#E2B84A', TRIM = '#FFFFFF', EDGE = '#000000'

// a jersey that is gold itself (the Saints, the 49ers' tan): the patch takes the second colour, so the stars and a
// gold C still stand out from it
const rgb = c => (/^#[0-9a-f]{6}$/i.test(c ?? '') ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : null)
const nearGold = c => { const a = rgb(c), g = rgb(GOLD); return !!a && Math.hypot(a[0] - g[0], a[1] - g[1], a[2] - g[2]) < 110 }

export default function CaptainPatch({ cap, color, color2, transform }) {
  if (!cap) return null
  const years = Math.max(1, cap.years ?? 1)
  const n = Math.min(4, years), goldC = years > 4
  const base = color && color !== 'transparent' ? color : '#222222'
  const fill = nearGold(base) && color2 && color2 !== 'transparent' && !nearGold(color2) ? color2 : base
  return (
    <g transform={transform} style={{ pointerEvents: 'none' }} aria-hidden="true">
      <g transform="translate(-10 -16)">
        <path d={C_PATH} fill="none" stroke={EDGE} strokeWidth="4" strokeLinejoin="round" />
        <path d={C_PATH} fill={goldC ? GOLD : fill} stroke={TRIM} strokeWidth="1.7" strokeLinejoin="round" />
      </g>
      <rect x="-11.5" y="7.4" width="23" height="9" rx="1.6" fill="none" stroke={EDGE} strokeWidth="4" />
      <rect x="-11.5" y="7.4" width="23" height="9" rx="1.6" fill={fill} stroke={TRIM} strokeWidth="1.7" />
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={star((i - (n - 1) / 2) * 5.2, 12.1)} fill={GOLD} stroke={EDGE} strokeWidth="0.3" />
      ))}
    </g>
  )
}
