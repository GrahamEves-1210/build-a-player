import svgRaw from '../assets/rb-figure-color.svg?raw'

const PROCESSED_SVG = (() => {
  let html = svgRaw
  html = html.replace(
    '<svg version="1.2"',
    '<svg id="rb-fg" version="1.2" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision"'
  )
  html = html.replace(/<style>[\s\S]*?<\/style>/, '')
  return html
})()

const SVG_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%' }
const WHITE = 'rgba(255,255,255,0.72)'
const WHITE_FM = 'rgba(255,255,255,0.55)'

function setFill(html, id, fill, extra = '') {
  return html.replace(
    new RegExp(`(id="${id}")\\s+class="s0"`),
    `$1 style="fill:${fill};stroke:none;${extra}"`
  )
}

function setFillTransform(html, id, fill, transform, extra = '') {
  return html.replace(
    new RegExp(`(id="${id}")\\s+class="s0"`),
    `$1 transform="${transform}" style="fill:${fill};stroke:none;${extra}"`
  )
}

function lightenColor(hex, amount = 20) {
  if (!hex || hex === 'transparent') return 'transparent'
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount)
  return `rgb(${r},${g},${b})`
}

function darkenColor(hex, factor = 0.6) {
  if (!hex || hex === 'transparent') return 'transparent'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`
}

// Subtle lip redness — just slightly warmer than the skin tone
function reddenSkin(hex) {
  if (!hex || hex === 'transparent') return 'transparent'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.min(255, r + 12)},${Math.max(0, g - 5)},${Math.max(0, b - 5)})`
}

export default function RBFigureOverlay({ build }) {
  const tc  = (s) => build?.[s]?.teamColor  ?? 'transparent'
  const tc2 = (s) => build?.[s]?.teamColor2 ?? 'transparent'
  const sk  = (s) => build?.[s]?.skinColor  ?? 'transparent'
  const has = (s) => !!build?.[s]

  const faceSkin  = sk('vision')
  const armSkin   = sk('strength')
  const eluSkin   = sk('elusiveness')

  let svg = PROCESSED_SVG

  // ── VISION: helmet shell + top piece
  svg = setFill(svg, 'helmet shell',     tc('vision'), 'opacity:0.90;')
  svg = setFill(svg, 'helmet top peice', has('vision') ? WHITE_FM : 'transparent')

  // ── FACEMASK CAGE + STRAPS + CHINSTRAP: white (reduced opacity) when vision filled
  const fmFill  = has('vision') ? WHITE_FM : 'transparent'
  const cgFill  = has('vision') ? 'rgba(255,255,255,0.95)' : 'transparent'
  for (const id of ['facemask1','facemask2','facemask3','facemask4','facemask5',
                     'facemask7','facemask8','facemask9','facemask10']) {
    svg = setFill(svg, id, fmFill)
  }
  svg = setFill(svg, 'chinstrap',   cgFill)
  svg = setFill(svg, 'strap left',  cgFill)
  svg = setFill(svg, 'strap right', cgFill)

  // ── FACE SKIN (vision slot player) — slightly darkened for shadow depth
  svg = setFill(svg, 'face1', lightenColor(faceSkin, 20), 'opacity:0.82;')
  svg = setFill(svg, 'face2', lightenColor(faceSkin, 20), 'opacity:0.82;')
  svg = setFill(svg, 'face3', lightenColor(faceSkin, 20), 'opacity:0.82;')
  svg = setFill(svg, 'neck',  darkenColor(faceSkin, 0.85), 'opacity:0.82;')
  svg = setFillTransform(svg, 'lip',  reddenSkin(faceSkin), 'translate(240,146) scale(0.7) translate(-240,-146)', 'opacity:0.28;')
  svg = setFillTransform(svg, 'lip2', reddenSkin(faceSkin), 'translate(240,146) scale(0.7) translate(-240,-146)', 'opacity:0.28;')

  // ── SIZE: jersey; shoulder always black; neck stripe always black
  svg = setFill(svg, 'jersey',      tc('size'))
  svg = setFill(svg, 'shoulder',    has('size') ? '#111111' : 'transparent')
  svg = setFill(svg, 'neck stripe', 'transparent')

  // ── FIXED WHITE (size area)
  svg = setFill(svg, 'jersey stripe', has('size') ? tc2('size') : 'transparent')
  svg = setFill(svg, 'undershirt',    has('size') ? WHITE : 'transparent')

  // ── STRENGTH: left arm (blocking arm)
  svg = setFill(svg, 'left arm',  lightenColor(armSkin, 20), 'opacity:0.82;')
  // ── ELUSIVENESS: right arm (stiff-arm / cut arm, slightly shadowed)
  svg = setFill(svg, 'right arm', lightenColor(armSkin, 20), 'opacity:0.82;')

  // ── HANDS: left glove (receiving hand)
  svg = setFill(svg, 'left glove',  tc('hands'), 'opacity:0.68;')
  // ── CARRYING: right glove (ball hand)
  svg = setFill(svg, 'right glove', tc('carrying'), 'opacity:0.68;')

  // ── VISION: chin guard — same white as facemask
  svg = setFill(svg, 'facemask6', fmFill)
  svg = setFill(svg, 'chinguard',  cgFill)
  svg = setFill(svg, 'chinguard2', cgFill)
  svg = setFill(svg, 'chinguard3', cgFill)
  svg = setFill(svg, 'chinguard4', cgFill)

  // ── SPEED: main leg mass (thighs / pants)
  svg = setFill(svg, 'legs', tc('speed'), 'opacity:0.90;')

  // ── FIXED BLACK: lower legs regardless of team color
  const lowerFill = has('speed') ? '#111111' : 'transparent'
  svg = setFill(svg, 'left lower leg',  lowerFill)
  svg = setFill(svg, 'rigth lower leg', lowerFill)

  // ── FIXED WHITE: leg stripe
  svg = setFill(svg, 'leg stripe', has('speed') ? tc2('speed') : 'transparent')

  // ── ELUSIVENESS: shoes (foot color)
  if (has('elusiveness')) {
    const bc = tc('elusiveness')
    const gradDef = `<defs><linearGradient id="rb-burst-right-grad" x1="0" y1="791" x2="0" y2="865" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.90"/><stop offset="100%" stop-color="${bc}"/></linearGradient><linearGradient id="rb-burst-left-grad" x1="0" y1="666" x2="78" y2="694" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="${bc}"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0.90"/></linearGradient></defs>`
    svg = svg.replace('<g id="Group 1">', `${gradDef}<g id="Group 1">`)
    svg = setFill(svg, 'left foot',  'url(#rb-burst-left-grad)')
    svg = setFill(svg, 'right foot', 'url(#rb-burst-right-grad)')
  } else {
    svg = setFill(svg, 'left foot',  'transparent')
    svg = setFill(svg, 'right foot', 'transparent')
  }

  return (
    <div className="player-qbfig player-rbfig" style={{ mixBlendMode: 'screen' }}>
      <div style={SVG_STYLE} dangerouslySetInnerHTML={{ __html: svg }} />

      {/* Jersey number + logos */}
      <svg viewBox="0 0 574 865" preserveAspectRatio="xMidYMid meet"
           style={SVG_STYLE} aria-hidden="true">
        {/* Chest number */}
        <text
          x="285" y="355"
          textAnchor="middle"
          transform="rotate(-6, 285, 355)"
          fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
          fontSize="140"
          fill="white"
          stroke="black"
          strokeWidth="7"
          paintOrder="stroke"
          style={{
            opacity: has('size') ? 0.9 : 0,
            transition: 'opacity 0.5s ease',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >{build?.['size']?.number ?? ''}</text>

        {/* Left shoulder number */}
        <g transform="translate(133, 159) scale(1.586, 0.317) rotate(59)"
           style={{ opacity: has('size') ? 0.9 : 0, transition: 'opacity 0.5s ease' }}>
          <text
            x="0" y="0"
            textAnchor="middle"
            fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
            fontSize="42"
            fill="white"
            stroke="black"
            strokeWidth="3"
            paintOrder="stroke"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >{build?.['size']?.number ?? ''}</text>
        </g>

        {/* Right shoulder number */}
        <g transform="translate(352, 120) scale(1.47, 0.294) rotate(-114)"
           style={{ opacity: has('size') ? 0.9 : 0, transition: 'opacity 0.5s ease' }}>
          <text
            x="0" y="0"
            textAnchor="middle"
            fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
            fontSize="39"
            fill="white"
            stroke="black"
            strokeWidth="3"
            paintOrder="stroke"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >{build?.['size']?.number ?? ''}</text>
        </g>

        {/* NFL shield */}
        {has('size') && (
          <image href="/logos/nfl.png" x="265" y="206" width="17" height="17"
            transform="rotate(-10, 273.5, 214.5)"
            style={{ opacity: 0.85, pointerEvents: 'none' }} />
        )}

        {/* Team logo — left shoulder */}
        {has('size') && (
          <image
            href={`/logos/${build['size'].team}.png`}
            x="101" y="172" width="40" height="40"
            transform="rotate(15, 121, 192)"
            style={{ opacity: 0.88, pointerEvents: 'none' }}
          />
        )}
      </svg>

      {/* Helmet gloss + face shadow */}
      {has('vision') && (
        <svg viewBox="0 0 574 865" preserveAspectRatio="xMidYMid meet"
             style={{ ...SVG_STYLE, zIndex: 3, pointerEvents: 'none' }} aria-hidden="true">
          <defs>
            <radialGradient id="rb-helm-gloss" cx="44%" cy="28%" r="50%">
              <stop offset="0%" stopColor="white" stopOpacity="0.28" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="160" y="2" width="185" height="125" rx="70"
            fill="url(#rb-helm-gloss)" opacity="0.6" />
        </svg>
      )}
    </div>
  )
}
