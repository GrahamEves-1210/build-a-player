import svgRaw from '../assets/wr-figure-color.svg?raw'

const PROCESSED_SVG = (() => {
  let html = svgRaw
  html = html.replace('<svg width="568" height="975"',
    '<svg id="wr-fg" width="568" height="975" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet"')
  return html
})()

const SVG_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

const TEAM_NICKNAMES = {
  ARI:'CARDINALS', ATL:'FALCONS',  BAL:'RAVENS',   BUF:'BILLS',
  CAR:'PANTHERS',  CHI:'BEARS',    CIN:'BENGALS',   CLE:'BROWNS',
  DAL:'COWBOYS',   DEN:'BRONCOS',  DET:'LIONS',     GB:'PACKERS',
  HOU:'TEXANS',    IND:'COLTS',    JAX:'JAGUARS',   KC:'CHIEFS',
  LAC:'CHARGERS',  LAR:'RAMS',     LV:'RAIDERS',    MIA:'DOLPHINS',
  MIN:'VIKINGS',   NE:'PATRIOTS',  NO:'SAINTS',     NYG:'GIANTS',
  NYJ:'JETS',      PHI:'EAGLES',   PIT:'STEELERS',  SEA:'SEAHAWKS',
  SF:'49ERS',      TB:'BUCCANEERS',TEN:'TITANS',    WAS:'COMMANDERS',
}

function setFill(html, id, fill, extra = '') {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(
    new RegExp(`(<path id="${escapedId}"[^>]*?)\\s*stroke="black"`),
    `$1 style="fill:${fill};stroke:none;${extra}"`
  )
}

function lightenColor(hex, amount = 20) {
  if (!hex || hex === 'transparent') return 'transparent'
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount)
  return `rgb(${r},${g},${b})`
}

function warmSkin(hex, light = 5, redBoost = 10) {
  if (!hex || hex === 'transparent') return 'transparent'
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + light + redBoost)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + light)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + Math.max(0, light - 6))
  return `rgb(${r},${g},${b})`
}

function darkenColor(hex, factor = 0.6) {
  if (!hex || hex === 'transparent') return 'transparent'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`
}

export default function WRFigureOverlay({ build, isTE = false }) {
  const tc  = (s) => build?.[s]?.teamColor  ?? 'transparent'
  const sk  = (s) => build?.[s]?.skinColor  ?? 'transparent'
  const has = (s) => !!build?.[s]

  let svg = PROCESSED_SVG

  // ── BALL — remove stroke outline; keep d, strip stroke attrs
  svg = svg.replace(
    /(<path id="ball" d="[^"]*") stroke="black" stroke-width="[^"]*"/,
    '$1 style="fill:none;stroke:none;"'
  )

  // ── AWARENESS: helmet team color; face paths = dark skin shadow
  svg = setFill(svg, 'helmet', tc('awareness'), 'opacity:0.90;')
  if (has('awareness')) {
    const skinColor   = warmSkin(sk('awareness'), 0, 10)
    const skinLight   = warmSkin(sk('awareness'), 8, 6)
    const shadowColor = darkenColor(sk('awareness'), 0.08)
    svg = setFill(svg, 'face1',   skinColor,   'opacity:0.40;')
    svg = setFill(svg, 'face2',   skinColor,   'opacity:0.40;')
    svg = setFill(svg, 'face3',   skinColor,   'opacity:0.40;')
    svg = setFill(svg, 'face4',   shadowColor, 'opacity:0.38;')
    svg = setFill(svg, 'face4_2', skinColor,   'opacity:0.40;')
    svg = setFill(svg, 'face5',   skinLight,   'opacity:0.30;')
  } else {
    svg = setFill(svg, 'face1',   'transparent')
    svg = setFill(svg, 'face2',   'transparent')
    svg = setFill(svg, 'face3',   'transparent')
    svg = setFill(svg, 'face4',   'transparent')
    svg = setFill(svg, 'face4_2', 'transparent')
    svg = setFill(svg, 'face5',   'transparent')
  }

  // ── SIZE: jersey team color; stripes black
  svg = setFill(svg, 'jersey',        tc('size'),  'opacity:0.75;')
  svg = setFill(svg, 'jersey2',       tc('size'),  'opacity:0.75;')
  svg = setFill(svg, 'arm stripe',    has('size') ? '#111111' : 'transparent')
  svg = setFill(svg, 'neck stripe',   has('size') ? '#111111' : 'transparent')
  svg = setFill(svg, 'neck stripe 2', has('size') ? '#111111' : 'transparent')

  // ── AFTER CATCH / STRENGTH (TE): arms (skin color lightened for screen blend)
  const armKey  = isTE ? 'strength' : 'afterCatch'
  const armSkin = has(armKey) ? warmSkin(sk(armKey), 15, 12) : 'transparent'
  svg = setFill(svg, 'left arm',  armSkin, 'opacity:0.72;')
  svg = setFill(svg, 'right arm', armSkin, 'opacity:0.72;')

  // ── HANDS: gloves
  svg = setFill(svg, 'left glove',  tc('hands'), 'opacity:0.70;')
  svg = setFill(svg, 'rigth glove', tc('hands'), 'opacity:0.70;')

  // ── SPEED: legs team color; shins + ankles white
  svg = setFill(svg, 'legs', tc('speed'), 'opacity:0.72;')
  const shinFill   = has('speed') ? 'rgba(255,255,255,0.80)' : 'transparent'
  const ankleFill  = has('speed') ? 'rgba(255,255,255,0.80)' : 'transparent'
  svg = setFill(svg, 'left shin',   shinFill)
  svg = setFill(svg, 'right shin',  shinFill)
  svg = setFill(svg, 'left ankle',  ankleFill)
  svg = setFill(svg, 'right ankle', ankleFill)

  // ── ROUTE RUNNING: shoes white→team color
  if (has('routeRunning')) {
    const bc = tc('routeRunning')
    const gradDef =
      `<defs>` +
      `<linearGradient id="wr-rr-left-grad" x1="126" y1="907" x2="166" y2="962" gradientUnits="userSpaceOnUse">` +
        `<stop offset="0%" stop-color="rgba(255,255,255,0.9)"/>` +
        `<stop offset="42%" stop-color="${bc}"/>` +
        `<stop offset="100%" stop-color="${bc}"/>` +
      `</linearGradient>` +
      `<linearGradient id="wr-rr-right-grad" x1="492" y1="746" x2="566" y2="670" gradientUnits="userSpaceOnUse">` +
        `<stop offset="0%" stop-color="rgba(255,255,255,0.9)"/>` +
        `<stop offset="42%" stop-color="${bc}"/>` +
        `<stop offset="100%" stop-color="${bc}"/>` +
      `</linearGradient>` +
      `</defs>`
    svg = svg.replace('<g id="Group 1">', `${gradDef}<g id="Group 1">`)
    svg = setFill(svg, 'left shoe',  'url(#wr-rr-left-grad)', 'opacity:0.72;')
    svg = setFill(svg, 'right shoe', 'url(#wr-rr-right-grad)', 'opacity:0.72;')
  } else {
    svg = setFill(svg, 'left shoe',  'transparent')
    svg = setFill(svg, 'right shoe', 'transparent')
  }

  const teamNickname = TEAM_NICKNAMES[build?.['size']?.team] ?? build?.['size']?.team ?? ''

  return (
    <div className="player-qbfig player-rbfig" style={{ mixBlendMode: 'screen' }}>
      <div style={SVG_STYLE} dangerouslySetInnerHTML={{ __html: svg }} />

      {/* Jersey number + team name + logos */}
      <svg viewBox="0 0 568 975" preserveAspectRatio="xMidYMid meet"
           style={SVG_STYLE} aria-hidden="true">

        <g>
          {/* Team nickname above number */}
          <text
            x="224" y="321"
            textAnchor="middle"
            transform="rotate(3, 224, 422)"
            fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
            fontSize="21"
            letterSpacing="1"
            fill="white"
            stroke="black"
            strokeWidth="2"
            paintOrder="stroke"
            style={{
              opacity: has('size') ? 0.82 : 0,
              transition: 'opacity 0.5s ease',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >{teamNickname}</text>

          {/* Chest number */}
          <text
            x="224" y="422"
            textAnchor="middle"
            transform="rotate(3, 224, 422)"
            fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
            fontSize="128"
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

          {/* NFL shield */}
          {has('size') && (
            <image href="/logos/nfl.png" x="221" y="276" width="14" height="14"
              transform="rotate(6, 228, 283)"
              style={{ opacity: 0.85, pointerEvents: 'none' }} />
          )}
        </g>

      </svg>

    </div>
  )
}
