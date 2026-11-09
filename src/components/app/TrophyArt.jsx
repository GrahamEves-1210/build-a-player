import { useEffect, useId, useState } from 'react'
import { loadHardware } from '../../lib/trophies'
import './trophy-case.css'

// The trophies, drawn: one 64x80 SVG each, standing on its own plinth. The metal
// parts are also the clip for the light that sweeps across them (.tc-sweep), so
// the light only ever catches metal. TrophyShelf is the compact, read-only row a
// player's profile sheet shows (FriendProfile).

// Shared gradients (one copy per case; identical copies elsewhere are harmless)
export function TrophyDefs() {
  return (
    <svg className="tc-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="tcg-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6e4f0c" /><stop offset=".16" stopColor="#c3952a" /><stop offset=".34" stopColor="#f4d77c" />
          <stop offset=".46" stopColor="#fff3c6" /><stop offset=".6" stopColor="#e9c35a" /><stop offset=".82" stopColor="#ad8320" /><stop offset="1" stopColor="#5e430b" />
        </linearGradient>
        <linearGradient id="tcg-gold-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2c2" /><stop offset=".45" stopColor="#f2d675" /><stop offset="1" stopColor="#bf952a" />
        </linearGradient>
        <linearGradient id="tcg-gold-d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7d5c12" /><stop offset="1" stopColor="#d9b34b" />
        </linearGradient>
        <linearGradient id="tcg-silver" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4f5761" /><stop offset=".2" stopColor="#a4aeb9" /><stop offset=".42" stopColor="#f3f6f9" />
          <stop offset=".56" stopColor="#dce3ea" /><stop offset=".8" stopColor="#87919d" /><stop offset="1" stopColor="#434951" />
        </linearGradient>
        <linearGradient id="tcg-silver-d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5f6872" /><stop offset="1" stopColor="#c4ccd5" />
        </linearGradient>
        <linearGradient id="tcg-stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#343b38" /><stop offset="1" stopColor="#0f1211" />
        </linearGradient>
        <linearGradient id="tcg-stone-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#47504c" /><stop offset="1" stopColor="#1c211f" />
        </linearGradient>
        <radialGradient id="tcg-velvet" cx=".5" cy=".3" r=".75">
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--ag-a1, #4fd6b7) 34%, #101614)' }} />
          <stop offset="1" stopColor="#070908" />
        </radialGradient>
        <linearGradient id="tcg-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const G = 'url(#tcg-gold)', GV = 'url(#tcg-gold-v)', GD = 'url(#tcg-gold-d)', S = 'url(#tcg-silver)', SD = 'url(#tcg-silver-d)'

// A stone plinth with a gold trim and nameplate
const Plinth = () => (
  <g>
    <path d="M14.5 70.5h35l2 7.5h-39z" fill="url(#tcg-stone)" />
    <rect x="17" y="64" width="30" height="7" rx="1" fill="url(#tcg-stone-top)" />
    <rect x="17" y="64" width="30" height="1.3" fill={G} />
    <rect x="26.5" y="72.6" width="11" height="2.8" rx=".6" fill={GV} opacity=".85" />
  </g>
)

// a cut stone: the colour, a light upper facet and a dark lower one
const Gem = ({ d, top, low }) => (
  <g>
    <path d={d} style={{ fill: 'var(--tc-gem, var(--ag-a1, #4fd6b7))' }} />
    <path d={low} fill="#000" opacity=".28" />
    <path d={top} fill="#fff" opacity=".5" />
  </g>
)

// Laurel leaves around (32, 33): two rows, alternating, both branches
const LEAVES = (() => {
  const out = []
  for (let i = 0; i < 9; i++) {
    const a = 112 + i * 17.5, outer = i % 2 === 0
    const r = outer ? 17.2 : 13.6, t = (a * Math.PI) / 180
    const x = 32 + r * Math.cos(t), y = 33 + r * Math.sin(t)
    const rot = a + 90 + (outer ? -30 : 30)
    out.push({ x, y, rot }, { x: 64 - x, y, rot: 180 - rot })
  }
  return out
})()

// The Commissioner's Trophy's flags: a ring of them rising from the base, fanning out to a crown, each a
// staff with its flag at the top, flying outward
const WS_FLAGS = (() => {
  const out = []
  for (let i = 0; i < 11; i++) {
    const t = (i - 5) / 5, dir = t < 0 ? -1 : 1
    const bx = 32 + t * 6.2, by = 56, tx = 32 + t * 17.5, ty = 9.5 + t * t * 4.5
    const f = (x, y) => `${x.toFixed(2)} ${y.toFixed(2)}`
    // the staff (a thin quad), then the flag off its top
    const staff = `M${f(bx - 0.55, by)}L${f(tx - 0.55, ty)}L${f(tx + 0.55, ty)}L${f(bx + 0.55, by)}z`
    const flag = `M${f(tx, ty + 0.4)}L${f(tx + dir * 4.4, ty + 1.6)}L${f(tx + dir * 4.1, ty + 6.4)}L${f(tx + t * 0.9, ty + 8.6)}z`
    out.push({ d: staff + flag })
  }
  return out
})()
// a bat standing up, barrel on top, centred on x 32 (the MVP's crossed pair turns it)
const BAT_D = 'M29.6 8.6c0-2 1-3.2 2.4-3.2s2.4 1.2 2.4 3.2v9c0 7.6-1.3 12.4-1.3 19.6v13.6h-2.2V37.2c0-7.2-1.3-12-1.3-19.6zM29.8 50.2h4.4v1.4h-4.4z'

// The metal of each trophy (what the light catches), and what isn't metal
const ART = {
  // Championship: a ring on a velvet cushion, its gem in the game's colour
  rings: {
    metal: (
      <>
        <path fillRule="evenodd" d="M15.5 50a16.5 15 0 1 0 33 0a16.5 15 0 1 0-33 0zM21 48.6a11 10 0 1 1 22 0a11 10 0 1 1-22 0z" fill={G} />
        <path d="M14.5 33.5l5.5 1.5-1.2 7.5-5.3-2.2zM49.5 33.5l-5.5 1.5 1.2 7.5 5.3-2.2z" fill={G} />
        <path d="M22.5 11.5h19l7.5 7.5v12.5l-7.5 7.5h-19L15 31.5V19z" fill={G} />
        <path d="M24.5 14.6h15l5.6 5.6v10.1l-5.6 5.6h-15l-5.6-5.6V20.2z" fill={GD} />
      </>
    ),
    under: <><ellipse cx="32" cy="71" rx="23" ry="6.8" fill="url(#tcg-velvet)" /><ellipse cx="32" cy="69.2" rx="17" ry="3.2" fill="#fff" opacity=".07" /></>,
    over: (
      <>
        <path d="M21.5 56.5a11 10 0 0 0 21 0a11 7.6 0 0 1-21 0z" fill="#5e430b" opacity=".55" />
        <Gem d="M27 18.6h10l4.4 4.4v4.6L37 32H27l-4.4-4.4V23z" top="M27 18.6h10l4.4 4.4H22.6z" low="M22.6 27.6h18.8L37 32H27z" />
        {[[21.3, 19.6], [42.7, 19.6], [21.3, 31], [42.7, 31]].map(([x, y]) => <circle key={x + '' + y} cx={x} cy={y} r="1" fill="#fff6d6" opacity=".85" />)}
      </>
    ),
  },
  // MVP: the cup
  mvp: {
    metal: (
      <>
        <path d="M16 16C5 15 4 33 19 35l1-3.5C10 29.5 9.5 19.5 16 19.5z" fill={G} />
        <path d="M48 16c11-1 12 17-3 19l-1-3.5c10-2 10.5-12 4-12z" fill={G} />
        <path d="M15 12h34c0 18-6 30-17 33-11-3-17-15-17-33z" fill={G} />
        <ellipse cx="32" cy="12" rx="17" ry="3.2" fill={GV} />
        <path d="M29.5 44h5v13h-5z" fill={G} />
        <ellipse cx="32" cy="50" rx="4.6" ry="2.2" fill={G} />
        <path d="M24 64l3-7h10l3 7z" fill={G} />
      </>
    ),
    under: <Plinth />,
    over: <><ellipse cx="32" cy="12.3" rx="14.5" ry="2.1" fill="#5e430b" /><path d="M17.5 22c8 3.2 21 3.2 29 0" fill="none" stroke="#6e4f0c" strokeWidth=".8" opacity=".55" /></>,
  },
  // OPOY: a football on a tee and column
  opoy: {
    metal: (
      <>
        <path d="M27 64l1.5-24h7l1.5 24z" fill={G} />
        <rect x="25" y="37" width="14" height="3.5" rx="1" fill={GV} />
        <path d="M27 37l2-4h6l2 4z" fill={G} />
        <ellipse cx="32" cy="21" rx="15" ry="9.6" transform="rotate(-28 32 21)" fill={G} />
      </>
    ),
    under: <Plinth />,
    over: (
      <g transform="rotate(-28 32 21)" fill="#6e4f0c">
        <rect x="25" y="19.6" width="14" height="1.3" rx=".6" />
        {[27, 30, 33, 36].map(x => <rect key={x} x={x} y="18.4" width="1" height="3.6" rx=".4" />)}
        <path d="M19.4 16.5c-.9 2.9-.9 6.1 0 9M44.6 16.5c.9 2.9.9 6.1 0 9" stroke="#6e4f0c" strokeWidth="1.1" fill="none" />
      </g>
    ),
  },
  // DPOY: a shield crest on a post
  dpoy: {
    metal: (
      <>
        <path d="M29 53h6v11h-6z" fill={G} />
        <rect x="25.5" y="51.5" width="13" height="3" rx="1" fill={GV} />
        <path d="M32 9l18 6.5V31c0 11-8 18-18 22-10-4-18-11-18-22V15.5z" fill={G} />
        <path d="M32 13.6l14 5V31c0 8.5-6 14.2-14 17.6-8-3.4-14-9.1-14-17.6V18.6z" fill={GD} />
        <path d="M23.5 20.5l8.5 6 8.5-6v4.6l-8.5 6-8.5-6zM23.5 29.5l8.5 6 8.5-6v4.6l-8.5 6-8.5-6z" fill={GV} />
      </>
    ),
    under: <Plinth />,
  },
  // All-Pro: a star medallion on a post
  allpro: {
    metal: (
      <>
        <path d="M29.5 48h5v16h-5z" fill={G} />
        <rect x="26" y="47" width="12" height="3" rx="1" fill={GV} />
        <circle cx="32" cy="28" r="19" fill={G} />
        <circle cx="32" cy="28" r="15.4" fill={GD} />
        <circle cx="32" cy="28" r="13.8" fill={GV} />
        <polygon points="32,19.5 34.06,25.17 40.08,25.37 35.33,29.08 37,34.88 32,31.5 27,34.88 28.67,29.08 23.92,25.37 29.94,25.17" fill={G} />
      </>
    ),
    under: <Plinth />,
    over: <circle cx="32" cy="28" r="13.8" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth=".6" />,
  },
  // A perfect season: the laurel
  perfect: {
    metal: (
      <>
        {LEAVES.map((l, i) => <ellipse key={i} cx={l.x} cy={l.y} rx="4.6" ry="2.1" transform={`rotate(${l.rot} ${l.x} ${l.y})`} fill={i % 4 < 2 ? G : GV} />)}
        <path d="M30.6 52h2.8v12h-2.8z" fill={G} />
      </>
    ),
    under: <Plinth />,
    over: (
      <>
        <path d="M31 50.5l-5 7.5 2.6-.4.9 2.6 3.5-8.5zM33 50.5l5 7.5-2.6-.4-.9 2.6-3.5-8.5z" style={{ fill: 'var(--tc-gem, var(--ag-a1, #4fd6b7))' }} />
        <circle cx="32" cy="50.5" r="2.4" fill={GV} />
      </>
    ),
  },
  // 90+ and 95+ builds: medals on ribbons, resting on an acrylic block
  ovr90: { medal: 90 },
  ovr95: { medal: 95 },
  // The best online tier: a crest set with the tier's stone, one pip a tier
  tier: {
    metal: (
      <>
        <path d="M29 52h6v12h-6z" fill={G} />
        <rect x="25.5" y="50.5" width="13" height="3" rx="1" fill={GV} />
        <path d="M32 7l19 9.5v20L32 52 13 36.5v-20z" fill={G} />
        <path d="M32 11.6l15 7.5v15.6L32 47.3 17 34.7V19.1z" fill={GD} />
      </>
    ),
    under: <Plinth />,
  },
  // Compete pool wins: a podium with the cup on the top step
  compete: {
    metal: (
      <>
        <path d="M23 26h18c0 7.6-3 11.6-9 12.6-6-1-9-5-9-12.6z" fill={G} />
        <path d="M23.5 28c-4.6-.3-4.6 6 .4 6.6l.5-1.6c-2.6-.6-2.6-3.6-.6-3.6zM40.5 28c4.6-.3 4.6 6-.4 6.6l-.5-1.6c2.6-.6 2.6-3.6.6-3.6z" fill={G} />
        <ellipse cx="32" cy="26" rx="9" ry="1.6" fill={GV} />
        <path d="M31 38h2v4h-2z" fill={G} />
        <path d="M27.5 44l1.5-2.5h6l1.5 2.5z" fill={G} />
        <rect x="24" y="44" width="16" height="1.4" fill={G} />
        <rect x="10" y="54" width="14" height="1.3" fill={G} />
        <rect x="40" y="60" width="14" height="1.3" fill={G} />
      </>
    ),
    under: (
      <>
        <rect x="24" y="44" width="16" height="34" fill="url(#tcg-stone-top)" />
        <rect x="10" y="54" width="14" height="24" fill="url(#tcg-stone)" />
        <rect x="40" y="60" width="14" height="18" fill="url(#tcg-stone)" />
        <text x="32" y="60" textAnchor="middle" className="tc-art-num" fill={GV} fontSize="9">1</text>
        <text x="17" y="66" textAnchor="middle" className="tc-art-num" fill="#9aa3a0" fontSize="7">2</text>
        <text x="47" y="70.5" textAnchor="middle" className="tc-art-num" fill="#a5785a" fontSize="7">3</text>
      </>
    ),
  },
  // Squad Builder titles: a championship banner on its pole, a star for the squad
  squad: {
    metal: (
      <>
        <rect x="21.6" y="8" width="2.8" height="56.5" rx="1" fill={G} />
        <circle cx="23" cy="7" r="2.8" fill={GV} />
      </>
    ),
    under: <Plinth />,
    over: (
      <>
        <path d="M24.4 11c8.6-3 14.6 3 25.6 0v20c-11 3-17-3-25.6 0z" style={{ fill: 'var(--tc-gem, var(--ag-a1, #4fd6b7))' }} />
        <path d="M37.5 12.3c3.6 1 7 .9 12.5-1.3v20c-5.5 2.2-8.9 2.3-12.5 1.3z" fill="#000" opacity=".2" />
        <path d="M24.4 11c8.6-3 14.6 3 25.6 0v2c-11 3-17-3-25.6 0z" fill="#fff" opacity=".22" />
        <path d="M37 14.2l1.75 3.55 3.9.57-2.82 2.75.66 3.88L37 23.12l-3.49 1.83.67-3.88-2.82-2.75 3.9-.57z" fill="#fff" opacity=".92" />
      </>
    ),
  },
  // Soccer's Golden Boot: a boot on the plinth, its studs on the stone
  boot: {
    metal: (
      <>
        <path d="M19 22h15.5l1.2 19c6.5 1.4 12.6 4.6 15.4 9.6 1.4 2.6.8 5.6-2.3 6.4H19.6c-2 0-3.1-1.2-3-3.2z" fill={G} />
        <path d="M16.6 57h33.4c-.6 2.2-2.2 3.4-4.6 3.4H19.4c-1.6 0-2.8-1.4-2.8-3.4z" fill={GD} />
        {[20, 26, 38, 44].map(x => <rect key={x} x={x} y="60" width="3" height="4" rx=".8" fill={G} />)}
        <ellipse cx="26.75" cy="22" rx="7.75" ry="1.8" fill={GV} />
      </>
    ),
    under: <Plinth />,
    over: (
      <g fill="none" stroke="#6e4f0c" strokeWidth="1" strokeLinecap="round" opacity=".75">
        <path d="M29 41.5l6.4-1.5M30 45l6.6-1.3M31.2 48.5l6.8-1" />
        <path d="M19.4 31h15.6" />
      </g>
    ),
  },
  // The Ballon d'Or (and the World Cup's Golden Ball): a gold football on a post
  ballon: {
    metal: (
      <>
        <path d="M29.5 46h5v18h-5z" fill={G} />
        <rect x="26" y="45" width="12" height="3" rx="1" fill={GV} />
        <circle cx="32" cy="27" r="17" fill={G} />
      </>
    ),
    under: <Plinth />,
    over: (
      <>
        <polygon points="32,21.5 37.23,25.3 35.23,31.45 28.77,31.45 26.77,25.3" fill="#6e4f0c" opacity=".7" />
        <g fill="none" stroke="#6e4f0c" strokeWidth="1" strokeLinecap="round" opacity=".75">
          <path d="M32 21.5V12M37.23 25.3l9-2.9M35.23 31.45l5.6 7.7M28.77 31.45l-5.6 7.7M26.77 25.3l-9-2.9" />
        </g>
        <circle cx="32" cy="27" r="17" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth=".6" />
      </>
    ),
  },
  // Baseball's World Series: the Commissioner's Trophy, a crown of gold flags on a silver base with the
  // silver ball, its longitude lines and stitches, in the middle
  ws: {
    metal: (
      <>
        <path d="M21 64l2.6-7.4h16.8L43 64z" fill={S} />
        <rect x="22.8" y="55.4" width="18.4" height="1.8" rx=".6" fill={G} />
        {WS_FLAGS.map((f, i) => <path key={i} d={f.d} fill={i % 2 ? GV : G} />)}
        <circle cx="32" cy="27" r="8.2" fill={S} />
      </>
    ),
    under: <Plinth />,
    over: (
      <>
        <g fill="none" stroke="#4d5660" strokeWidth=".6" opacity=".65">
          <ellipse cx="32" cy="27" rx="3.6" ry="8.2" />
          <path d="M23.8 27h16.4" />
        </g>
        <path d="M26.2 21.2c2.6 3.4 2.6 8.2 0 11.6M37.8 21.2c-2.6 3.4-2.6 8.2 0 11.6" fill="none" stroke="#c3952a" strokeWidth="1.4" strokeDasharray=".6 1" />
        <path d="M23.6 58.2h16.8" stroke="#fff" strokeOpacity=".35" strokeWidth=".6" />
      </>
    ),
  },
  // Baseball's MVP: a gold ball on a post, two crossed bats behind it
  bbmvp: {
    metal: (
      <>
        <path d="M28.6 64l1.6-18h3.6l1.6 18z" fill={G} />
        <rect x="26" y="44.5" width="12" height="2.8" rx="1" fill={GV} />
        <path d={BAT_D} transform="rotate(-34 32 29)" fill={G} />
        <path d={BAT_D} transform="rotate(34 32 29)" fill={GV} />
        <circle cx="32" cy="27" r="8.8" fill={G} />
      </>
    ),
    under: <Plinth />,
    over: (
      <path d="M26.4 21c2.8 3.6 2.8 8.4 0 12M37.6 21c-2.8 3.6-2.8 8.4 0 12" fill="none" stroke="#6e4f0c" strokeWidth="1.4" strokeDasharray=".6 1" opacity=".85" />
    ),
  },
  // The Cy Young: a gold ball on a fluted silver column
  cy: {
    metal: (
      <>
        <path d="M27.4 64l1.6-24.6h6l1.6 24.6z" fill={S} />
        <rect x="25" y="37" width="14" height="3.2" rx="1" fill={G} />
        <path d="M26.6 37l2-3.4h6.8l2 3.4z" fill={G} />
        <circle cx="32" cy="20.5" r="12.4" fill={G} />
      </>
    ),
    under: <Plinth />,
    over: (
      <>
        <path d="M30.6 41v22M33.4 41v22" stroke="#4d5660" strokeWidth=".7" opacity=".5" />
        <path d="M23.4 11.6c4 5.2 4 12.6 0 17.8M40.6 11.6c-4 5.2-4 12.6 0 17.8" fill="none" stroke="#6e4f0c" strokeWidth="1.8" strokeDasharray=".7 1.2" opacity=".85" />
        <path d="M23.4 11.6c4 5.2 4 12.6 0 17.8M40.6 11.6c-4 5.2-4 12.6 0 17.8" fill="none" stroke="#6e4f0c" strokeWidth=".5" opacity=".6" />
      </>
    ),
  },
  // The Silver Slugger: a silver bat standing on its knob in a gold cradle
  slugger: {
    metal: (
      <>
        <path d="M29.2 10c0-2.8 1.2-4.6 2.8-4.6s2.8 1.8 2.8 4.6v12c0 10-1.6 16-1.6 25v12h-2.4V47c0-9-1.6-15-1.6-25z" fill={S} />
        <ellipse cx="32" cy="59.6" rx="2.8" ry="1.3" fill={S} />
        <rect x="27" y="61" width="10" height="3" rx=".8" fill={G} />
      </>
    ),
    under: <Plinth />,
    over: (
      <>
        <ellipse cx="32" cy="16" rx="1.2" ry="3.4" fill="none" stroke="#4d5660" strokeWidth=".6" opacity=".7" />
        <path d="M30.8 50.5h2.4M30.8 52.8h2.4M30.8 55.1h2.4M30.8 57.4h2.4" stroke="#4d5660" strokeWidth=".6" opacity=".55" />
      </>
    ),
  },
  // The Gold Glove: a gold fielder's glove, its web and its fingers, on a post
  glove: {
    metal: (
      <>
        <rect x="30" y="58" width="4" height="6" fill={G} />
        <path d="M17 28.5L25.5 16l1 20-4 5z" fill={GD} />
        <path d="M23 50c-6-3-9.5-12-10-20-.2-3 2.6-4.4 4.4-2.4 2.6 3.4 5.1 9.4 8.1 14.4z" fill={G} />
        <rect x="24.6" y="13" width="5.6" height="28" rx="2.8" transform="rotate(-8 27.4 41)" fill={G} />
        <rect x="30.2" y="10" width="5.6" height="31" rx="2.8" transform="rotate(-2 33 41)" fill={GV} />
        <rect x="35.6" y="12" width="5.4" height="29" rx="2.7" transform="rotate(5 38.3 41)" fill={G} />
        <rect x="40.4" y="17" width="5.2" height="25" rx="2.6" transform="rotate(12 43 42)" fill={GV} />
        <path d="M21.6 35C26 32.4 40.6 32.4 45 35c.8 4 .9 7.4.3 11-1 6.2-5.4 9.6-12.3 9.6S22 52.2 21.2 45.8c-.5-4-.4-6.8.4-10.8z" fill={G} />
        <rect x="23" y="53.6" width="20" height="5" rx="1.6" fill={GV} />
      </>
    ),
    under: <Plinth />,
    over: (
      <>
        <g fill="none" stroke="#6e4f0c" strokeWidth=".8" strokeLinecap="round" opacity=".7">
          <path d="M18.6 30.4l7-10.2M20.2 34l5.8-8.4M21.6 37.6l4.6-6.6M19 27.6l4.2 12" />
          <path d="M30.1 31l-1.1-14M35.6 30.5l-.2-17M40.8 31.5l1.2-13" />
        </g>
        <rect x="29" y="46.4" width="8" height="4.2" rx="1.2" fill="#6e4f0c" opacity=".45" />
        <path d="M23 55.8h20" stroke="#6e4f0c" strokeWidth=".7" strokeDasharray="1 1" opacity=".6" />
      </>
    ),
  },
  // Blacktop wins: a gold ball on a column
  blacktop: {
    metal: (
      <>
        <path d="M28 64l1.5-24h5l1.5 24z" fill={G} />
        <rect x="25.5" y="38" width="13" height="3" rx="1" fill={GV} />
        <path d="M26.5 38l2-3h7l2 3z" fill={G} />
        <circle cx="32" cy="21" r="13.5" fill={G} />
      </>
    ),
    under: <Plinth />,
    over: (
      <g fill="none" stroke="#6e4f0c" strokeWidth="1" strokeLinecap="round" opacity=".8">
        <path d="M32 7.5v27M18.5 21h27M23 10.8c4.6 5.6 4.6 14.8 0 20.4M41 10.8c-4.6 5.6-4.6 14.8 0 20.4" />
      </g>
    ),
  },
}

function medalArt(n) {
  const gold = n >= 95
  const M = gold ? G : S, MD = gold ? GD : SD, MV = gold ? GV : 'url(#tcg-silver-d)'
  return {
    metal: (
      <>
        <circle cx="32" cy="45" r="16" fill={M} />
        <circle cx="32" cy="45" r="12.8" fill={MD} />
        <circle cx="32" cy="45" r="11.6" fill={MV} />
      </>
    ),
    under: (
      <>
        <path d="M21 5h8.5l7.5 26h-8.5z" style={{ fill: gold ? '#1d1708' : 'var(--tc-gem, var(--ag-a1, #4fd6b7))' }} />
        <path d="M43 5h-8.5L27 31h8.5z" style={{ fill: gold ? '#2a210b' : 'color-mix(in srgb, var(--tc-gem, var(--ag-a1, #4fd6b7)) 72%, #000)' }} />
        <path d="M24.2 5h2.2l7.4 26h-2.2zM39.8 5h-2.2l-7.4 26h2.2z" fill={gold ? '#f2d675' : '#fff'} opacity={gold ? '.85' : '.55'} />
        <rect x="18" y="62" width="28" height="16" rx="2" fill="#fff" opacity=".07" />
        <rect x="18" y="62" width="28" height="16" rx="2" fill="none" stroke="#fff" strokeOpacity=".16" />
        <rect x="19" y="62.6" width="26" height="1.2" rx=".6" fill="#fff" opacity=".22" />
      </>
    ),
    over: (
      <>
        <text x="32" y="50.2" textAnchor="middle" className="tc-art-num" fontSize="13.5" fill="#fff" opacity=".45">{n}</text>
        <text x="32" y="49.6" textAnchor="middle" className="tc-art-num" fontSize="13.5" fill={gold ? '#6e4f0c' : '#4d5660'}>{n}</text>
      </>
    ),
  }
}

// The tier crest's stone and pips (tier: index 0 … 5)
function TierOver({ tier = 0 }) {
  const pips = Array.from({ length: tier + 1 }, (_, i) => 32 + (i - tier / 2) * 4.6)
  return (
    <>
      <Gem d="M32 17l8 5v8.5l-8 5-8-5V22z" top="M32 17l8 5-8 4-8-4z" low="M24 30.5l8-3.8 8 3.8-8 5z" />
      {pips.map(x => <path key={x} d={`M${x} 39.4l1.7 1.9-1.7 1.9-1.7-1.9z`} fill={GV} />)}
    </>
  )
}

// One trophy. kind: a key of ART; gem: the colour set into it; shine: a counter,
// each change runs the light across it once (0: not yet)
export function TrophyArt({ kind, tier = 0, gem, shine = 0, className = '' }) {
  const raw = useId()
  const clip = `tcc${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const a = ART[kind]?.medal ? medalArt(ART[kind].medal) : ART[kind]
  if (!a) return null
  return (
    <svg className={`tc-art${className ? ` ${className}` : ''}`} viewBox="0 0 64 80" aria-hidden="true" focusable="false" style={gem ? { '--tc-gem': gem } : undefined}>
      <clipPath id={clip}>{a.metal}</clipPath>
      {a.under}
      {a.metal}
      {kind === 'tier' ? <TierOver tier={tier} /> : a.over}
      {shine > 0 && (
        <g clipPath={`url(#${clip})`}>
          <rect key={shine} className="tc-sweep" x="-34" y="0" width="20" height="80" fill="url(#tcg-sweep)" />
        </g>
      )}
    </svg>
  )
}

// A player's hardware, compact and read-only (a profile sheet): only what they've won
// (the season and award trophies of the Trophy Case, same counts and names)
const SHELF = [
  ['rings', 'RINGS', h => h.rings.total],
  ['perfect', 'PERFECT', h => h.perfect],
  [h => (h.ovr95 > 0 ? 'ovr95' : 'ovr90'), '90+ CLUB', h => h.ovr90],
  ['mvp', 'MVP', h => h.mvp.total],
  ['opoy', 'OPOY', h => h.opoy.total],
  ['dpoy', 'DPOY', h => h.dpoy.total],
  ['allpro', 'ALL-PRO', h => h.allpro],
  ['boot', 'GOLDEN BOOT', h => h.boot?.total ?? 0],
  ['ballon', 'BALLON D\'OR', h => h.ballon?.total ?? 0],
  // baseball's (lib/trophies.js loadHardware: h.baseball)
  ['ws', 'WS TITLES', h => h.baseball?.ws ?? 0],
  ['bbmvp', 'MLB MVP', h => h.baseball?.mvp ?? 0],
  ['cy', 'CY YOUNG', h => h.baseball?.cy ?? 0],
  ['slugger', 'SLUGGER', h => h.baseball?.ss ?? 0],
  ['glove', 'GOLD GLOVE', h => h.baseball?.gg ?? 0],
]
export function TrophyShelf({ uid }) {
  const [h, setH] = useState(null)
  useEffect(() => {
    let live = true
    setH(null)
    loadHardware(uid).then(d => { if (live) setH(d) }, () => {})
    return () => { live = false }
  }, [uid])
  const won = h ? SHELF.map(([kind, label, n]) => ({ kind: typeof kind === 'function' ? kind(h) : kind, label, n: n(h) })).filter(t => t.n > 0) : []
  if (!won.length) return null
  return (
    <div className="tc-mini" aria-label="Trophies">
      <TrophyDefs />
      <div className="fr-sub-head"><span className="ag-eyebrow">TROPHIES</span></div>
      <div className="tc-mini-row">
        {won.map((t, i) => (
          <span key={t.kind} className="tc-mini-item" style={{ '--i': i }}>
            <TrophyArt kind={t.kind} />
            <b>{t.n.toLocaleString()}</b>
            <small>{t.label}</small>
          </span>
        ))}
      </div>
    </div>
  )
}
