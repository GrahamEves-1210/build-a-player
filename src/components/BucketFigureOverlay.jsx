import svgRaw from '../assets/bucket-body.svg?raw'
import { NBA_TEAMS } from '../data/nba-players'

const TEAM_NICKNAME = Object.fromEntries(
  NBA_TEAMS.map(t => [t.short, t.name.split(' ').slice(-1)[0].toUpperCase()])
)

const PROCESSED_SVG = (() => {
  let html = svgRaw
  html = html.replace(
    '<svg width="936" height="821" viewBox="0 0 936 821"',
    '<svg id="bk-body" width="936" height="821" viewBox="42.5 -35.2 850.9 815.5" overflow="visible" style="width:100%;height:100%;display:block;overflow:visible" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision"'
  )
  html = html.replace(/\s+stroke="[^"]*"/g, '')
  return html
})()

const SVG_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%' }
const DEFAULT_SKIN = '#c8956c'  // fallback if photo-extracted color missing

function lighten(hex, amt = 20) {
  if (!hex || hex === 'transparent') return 'transparent'
  const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + amt))
  const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + amt))
  const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + amt))
  return `rgb(${r},${g},${b})`
}

function warmSkin(hex, amt = 0) {
  if (!hex || hex === 'transparent') return 'transparent'
  const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + amt + 12))
  const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + amt))
  const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + amt - 6))
  return `rgb(${r},${g},${b})`
}

function setFill(html, id, fill, opacity = '') {
  const eid = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(
    new RegExp(`(id="${eid}")([^>]*?)(/>|>)`, 'g'),
    (_, idPart, rest, closing) => {
      const noFill = rest.replace(/\s+fill="[^"]*"/, '').replace(/\s+style="[^"]*"/, '')
      const style  = opacity ? ` style="opacity:${opacity}"` : ''
      return `${idPart}${noFill} fill="${fill}"${style}${closing}`
    }
  )
}

// Exported for share card canvas rendering
export function getBucketSVGMarkup(build) {
  const tc  = (s) => build?.[s]?.teamColor  ?? 'transparent'
  const tc2 = (s) => build?.[s]?.teamColor2 ?? 'transparent'
  const sk  = (s) => build?.[s]?.skinColor  || DEFAULT_SKIN
  const has = (s) => !!build?.[s]

  let svg = PROCESSED_SVG

  if (has('clutch')) svg = setFill(svg, 'jersey', 'rgba(255,255,255,0.95)', '0.95')
  svg = setFill(svg, 'left stripe',  tc('clutch') !== 'transparent' ? tc('clutch') : '#111111', '0.90')
  svg = setFill(svg, 'right stripe', tc('clutch') !== 'transparent' ? tc('clutch') : '#111111', '0.90')
  svg = setFill(svg, 'neck stripe',  tc('clutch') !== 'transparent' ? tc('clutch') : '#111111', '0.90')

  if (has('speed')) {
    const legSkin  = warmSkin(sk('speed'), -40)
    const sockDefs = `<defs>
      <linearGradient id="bk-sock-stripe" x1="0" y1="0" x2="6" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#ebebeb" stop-opacity="0.95"/>
        <stop offset="50%" stop-color="#d8d8d8" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#ebebeb" stop-opacity="0.95"/>
      </linearGradient>
      <pattern id="bk-sock-tex" x="0" y="0" width="6" height="60" patternUnits="userSpaceOnUse">
        <rect width="6" height="60" fill="url(#bk-sock-stripe)"/>
      </pattern></defs>`
    svg = svg.replace('<g id="body">', `${sockDefs}<g id="body">`)
    svg = setFill(svg, 'left leg',            legSkin,                  '0.82')
    svg = setFill(svg, 'rigth leg',           legSkin,                  '0.82')
    svg = setFill(svg, 'left compression',    '#ffffff',                '0.90')
    svg = setFill(svg, 'right compression',   '#ffffff',                '0.90')
    svg = setFill(svg, 'left sock',           'url(#bk-sock-tex)',      '0.97')
    svg = setFill(svg, 'right sock',          'url(#bk-sock-tex)',      '0.97')
    svg = setFill(svg, 'shorts',              'rgba(255,255,255,0.95)', '0.95')
    svg = setFill(svg, 'left leg design',     tc2('speed'),             '0.90')
    svg = setFill(svg, 'rigth leg design',    tc2('speed'),             '0.90')
    svg = setFill(svg, 'left shorts stripe',  tc('speed'),              '0.90')
    svg = setFill(svg, 'rigth shorts stripe', tc('speed'),              '0.90')
  }

  if (has('bounce')) {
    svg = setFill(svg, 'left shoe',    tc('bounce'),  '0.68')
    svg = setFill(svg, 'right shoe',   tc('bounce'),  '0.68')
    svg = setFill(svg, 'left shoe 2',  tc2('bounce'), '0.68')
    svg = setFill(svg, 'right shoe 2', tc2('bounce'), '0.68')
  }

  if (has('size')) {
    const leftArmSkin  = warmSkin(sk(has('jumpShot')  ? 'jumpShot'  : 'size'), -40)
    const rightArmSkin = warmSkin(sk(has('finishing') ? 'finishing' : 'size'), -40)
    svg = setFill(svg, 'left arm',  leftArmSkin,  '0.82')
    svg = setFill(svg, 'right arm', rightArmSkin, '0.82')
  }

  if (has('jumpShot')) {
    const dMatch = svg.match(/id="left arm"([^/]*)\/?>/)?.at(0)?.match(/\bd="([^"]*)"/)
    if (dMatch) {
      const col = tc('jumpShot') !== 'transparent' ? tc('jumpShot') : 'white'
      svg = svg.replace('<g id="body">', `<defs><clipPath id="bk-sleeve-clip"><path d="${dMatch[1]}"/></clipPath></defs><g id="body">`)
      svg = svg.replace('</svg>', `<rect x="115" y="0" width="199" height="200" fill="${col}" opacity="0.97" clip-path="url(#bk-sleeve-clip)"/></svg>`)
    }
  }

  if (has('finishing')) {
    const dMatch = svg.match(/id="right arm"([^/]*)\/?>/)?.at(0)?.match(/\bd="([^"]*)"/)
    if (dMatch) {
      const col = tc('finishing') !== 'transparent' ? tc('finishing') : 'white'
      svg = svg.replace('<g id="body">', `<defs><clipPath id="bk-wristband-clip"><path d="${dMatch[1]}"/></clipPath></defs><g id="body">`)
      svg = svg.replace('</svg>', `<rect x="795" y="0.5" width="30" height="150" fill="${col}" opacity="0.97" clip-path="url(#bk-wristband-clip)"/></svg>`)
    }
  }

  // Jersey number + team name (embedded directly — no blend mode needed on dark canvas bg)
  const hlChip   = build?.['clutch']
  const teamNick = hlChip ? (TEAM_NICKNAME[hlChip.team] ?? hlChip.team) : null
  const jerseyNum = hlChip?.number ?? null
  if (hlChip && (teamNick || jerseyNum != null)) {
    const fs  = teamNick ? Math.round(Math.min(44, Math.max(15, 220 / Math.max(teamNick.length, 1)))) : 27
    const ls  = Math.max(1, Math.round(fs * 0.12))
    const col = tc('clutch'); const col2 = tc2('clutch')
    let extra = ''
    if (teamNick) extra += `<text x="476" y="148" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-size="${fs}" letter-spacing="${ls}" fill="${col}" stroke="${col2}" stroke-width="2" paint-order="stroke" opacity="0.90">${teamNick}</text>`
    if (jerseyNum != null) extra += `<g transform="translate(474,235) scale(0.78,1)"><text x="0" y="0" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-size="99" fill="${col}" stroke="${col2}" stroke-width="4" paint-order="stroke" opacity="0.92">${jerseyNum}</text></g>`
    svg = svg.replace('</svg>', `${extra}</svg>`)
  }

  return svg
}

export default function BucketFigureOverlay({ build }) {
  const tc  = (s) => build?.[s]?.teamColor  ?? 'transparent'
  const tc2 = (s) => build?.[s]?.teamColor2 ?? 'transparent'
  const sk  = (s) => build?.[s]?.skinColor  || DEFAULT_SKIN
  const has = (s) => !!build?.[s]

  let svg = PROCESSED_SVG

  // ── CLUTCH: jersey white, stripes team color
  if (has('clutch')) {
    svg = setFill(svg, 'jersey', 'rgba(255,255,255,0.95)', '0.95')
  }
  svg = setFill(svg, 'left stripe',  tc('clutch') !== 'transparent' ? tc('clutch') : '#111111', '0.90')
  svg = setFill(svg, 'right stripe', tc('clutch') !== 'transparent' ? tc('clutch') : '#111111', '0.90')
  svg = setFill(svg, 'neck stripe',  tc('clutch') !== 'transparent' ? tc('clutch') : '#111111', '0.90')

  // ── SPEED: legs skin, compressions black, socks textured, shorts + leg designs team colors, leg stripes black
  if (has('speed')) {
    const legSkin  = warmSkin(sk('speed'), -40)
    const sockDefs = `<defs>
      <linearGradient id="bk-sock-stripe" x1="0" y1="0" x2="6" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stop-color="#ebebeb" stop-opacity="0.95"/>
        <stop offset="35%"  stop-color="#ebebeb" stop-opacity="0.95"/>
        <stop offset="50%"  stop-color="#d8d8d8" stop-opacity="0.95"/>
        <stop offset="65%"  stop-color="#ebebeb" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#ebebeb" stop-opacity="0.95"/>
      </linearGradient>
      <pattern id="bk-sock-tex" x="0" y="0" width="6" height="60" patternUnits="userSpaceOnUse">
        <rect width="6" height="60" fill="url(#bk-sock-stripe)"/>
      </pattern>
    </defs>`
    svg = svg.replace('<g id="body">', `${sockDefs}<g id="body">`)
    svg = setFill(svg, 'left leg',           legSkin,               '0.82')
    svg = setFill(svg, 'rigth leg',          legSkin,               '0.82')
    svg = setFill(svg, 'left compression',   '#ffffff',             '0.90')
    svg = setFill(svg, 'right compression',  '#ffffff',             '0.90')
    svg = setFill(svg, 'left sock',          'url(#bk-sock-tex)',   '0.97')
    svg = setFill(svg, 'right sock',         'url(#bk-sock-tex)',   '0.97')
    svg = setFill(svg, 'shorts',             'rgba(255,255,255,0.95)', '0.95')
    svg = setFill(svg, 'left leg design',    tc2('speed'),            '0.90')
    svg = setFill(svg, 'rigth leg design',   tc2('speed'),            '0.90')
    svg = setFill(svg, 'left shorts stripe', tc('speed'),             '0.90')
    svg = setFill(svg, 'rigth shorts stripe',tc('speed'),             '0.90')
  }

  // ── BOUNCE: shoes solid team color / secondary color
  if (has('bounce')) {
    svg = setFill(svg, 'left shoe',    tc('bounce'),  '0.68')
    svg = setFill(svg, 'right shoe',   tc('bounce'),  '0.68')
    svg = setFill(svg, 'left shoe 2',  tc2('bounce'), '0.68')
    svg = setFill(svg, 'right shoe 2', tc2('bounce'), '0.68')
  }

  // ── SIZE: arms skin color + shine highlight
  if (has('size')) {
    const leftArmSkin  = warmSkin(sk(has('jumpShot')  ? 'jumpShot'  : 'size'), -40)
    const rightArmSkin = warmSkin(sk(has('finishing') ? 'finishing' : 'size'), -40)
    svg = setFill(svg, 'left arm',  leftArmSkin,  '0.82')
    svg = setFill(svg, 'right arm', rightArmSkin, '0.82')

    const leftArmM  = svg.match(/id="left arm"([^/]*)\/?>/)
    const rightArmM = svg.match(/id="right arm"([^/]*)\/?>/)
    const leftD  = leftArmM  ? leftArmM[0].match(/\bd="([^"]*)"/)  : null
    const rightD = rightArmM ? rightArmM[0].match(/\bd="([^"]*)"/) : null

    if (leftD || rightD) {
      const shineDefs = `<defs>
        <linearGradient id="bk-shine-l" x1="0" y1="0" x2="0" y2="821" gradientUnits="userSpaceOnUse">
          <stop offset="0%"    stop-color="white" stop-opacity="0.50"/>
          <stop offset="5.5%"  stop-color="white" stop-opacity="0.10"/>
          <stop offset="11%"   stop-color="white" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="bk-shine-r" x1="0" y1="0" x2="0" y2="821" gradientUnits="userSpaceOnUse">
          <stop offset="0%"    stop-color="white" stop-opacity="0.50"/>
          <stop offset="5.5%"  stop-color="white" stop-opacity="0.10"/>
          <stop offset="11%"   stop-color="white" stop-opacity="0"/>
        </linearGradient>
        ${leftD  ? `<clipPath id="bk-shine-clip-l"><path d="${leftD[1]}"/></clipPath>`  : ''}
        ${rightD ? `<clipPath id="bk-shine-clip-r"><path d="${rightD[1]}"/></clipPath>` : ''}
      </defs>`
      svg = svg.replace('<g id="body">', `${shineDefs}<g id="body">`)
      if (leftD)  svg = svg.replace('</svg>', `<rect x="0" y="0" width="936" height="821" fill="url(#bk-shine-l)" clip-path="url(#bk-shine-clip-l)"/></svg>`)
      if (rightD) svg = svg.replace('</svg>', `<rect x="0" y="0" width="936" height="821" fill="url(#bk-shine-r)" clip-path="url(#bk-shine-clip-r)"/></svg>`)
    }
  }

  // ── JUMP SHOT: white shooter sleeve — middle ~30% of left arm, clipped to arm shape
  if (has('jumpShot')) {
    const armMatch = svg.match(/id="left arm"([^/]*)\/?>/)
    const dMatch   = armMatch ? armMatch[0].match(/\bd="([^"]*)"/) : null
    if (dMatch) {
      const sleeveColor = tc('jumpShot') !== 'transparent' ? tc('jumpShot') : 'white'
      const sleeveDefs = `<defs><clipPath id="bk-sleeve-clip"><path d="${dMatch[1]}"/></clipPath></defs>`
      svg = svg.replace('<g id="body">', `${sleeveDefs}<g id="body">`)
      svg = svg.replace('</svg>', `<rect x="115" y="0" width="199" height="200" fill="${sleeveColor}" opacity="0.97" clip-path="url(#bk-sleeve-clip)"/></svg>`)
    }
  }

  // ── FINISHING: team-color wristband on right arm, clipped to arm shape
  if (has('finishing')) {
    const armMatch = svg.match(/id="right arm"([^/]*)\/?>/)
    const dMatch   = armMatch ? armMatch[0].match(/\bd="([^"]*)"/) : null
    if (dMatch) {
      const wristColor = tc('finishing') !== 'transparent' ? tc('finishing') : 'white'
      const wristDefs = `<defs><clipPath id="bk-wristband-clip"><path d="${dMatch[1]}"/></clipPath></defs>`
      svg = svg.replace('<g id="body">', `${wristDefs}<g id="body">`)
      svg = svg.replace('</svg>', `<rect x="795" y="0.5" width="30" height="150" fill="${wristColor}" opacity="0.97" clip-path="url(#bk-wristband-clip)"/></svg>`)
    }
  }

  const hlChip   = build?.['clutch']
  const teamNick = hlChip ? (TEAM_NICKNAME[hlChip.team] ?? hlChip.team) : null
  const jerseyNum = hlChip?.number ?? null

  // Scale font size so short names are large and long names still fit
  const teamNameFontSize = teamNick
    ? Math.round(Math.min(44, Math.max(15, 220 / Math.max(teamNick.length, 1))))
    : 27
  const teamNameLetterSpacing = Math.max(1, Math.round(teamNameFontSize * 0.12))

  // Extract jersey path for secondary-color border overlay (rendered outside screen-blend)
  let jerseyPathD = null
  if (has('clutch')) {
    const jerseyMatch = svg.match(/id="jersey"([^/]*)\/?>/)
    const dMatch = jerseyMatch ? jerseyMatch[0].match(/\bd="([^"]*)"/) : null
    if (dMatch) jerseyPathD = dMatch[1]
  }

  // Extract stripe paths for black outline overlays
  const stripeIds = ['left stripe', 'right stripe', 'neck stripe']
  const stripePathDs = stripeIds.map(id => {
    const m = svg.match(new RegExp(`id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"([^/]*)\/?>"`))
    // fallback: try without closing quote
    const m2 = svg.match(new RegExp(`id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"([^>]*)(/>|>)`))
    const src = m2 ? m2[0] : null
    if (!src) return null
    const dm = src.match(/\bd="([^"]*)"/)
    return dm ? dm[1] : null
  })

  // Extract belt path — rendered outside screen-blend so detail bleeds through
  let beltPathD = null
  if (has('speed')) {
    const beltMatch = svg.match(/id="belt"([^/]*)\/?>/)
    const dMatch = beltMatch ? beltMatch[0].match(/\bd="([^"]*)"/) : null
    if (dMatch) beltPathD = dMatch[1]
  }

  const overlayViewBox = "42.5 -35.2 850.9 815.5"
  const overlayStyle = { ...SVG_STYLE, overflow: 'visible' }

  return (
    <>
      <div style={{ ...SVG_STYLE, mixBlendMode: 'screen', zIndex: 5 }}>
        <div style={SVG_STYLE} dangerouslySetInnerHTML={{ __html: svg }} />
      </div>

      {/* Belt — outside screen-blend so detail from underlying image bleeds through */}
      {beltPathD && (
        <svg
          viewBox={overlayViewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{ ...overlayStyle, zIndex: 6 }}
          aria-hidden="true"
        >
          <defs>
            <clipPath id="bk-belt-logo-clip">
              <path d={beltPathD} />
            </clipPath>
          </defs>
          <path d={beltPathD} fill="rgba(0,0,0,0.03)" />
          {has('speed') && (
            <image
              href={`/logos/nba/${build['speed'].team}.png`}
              x="455.6" y="262.6"
              width="28.8" height="28.8"
              preserveAspectRatio="xMidYMid meet"
              clipPath="url(#bk-belt-logo-clip)"
              style={{ opacity: 0.88 }}
            />
          )}
        </svg>
      )}



      {/* Jersey number + team name — outside screen-blend so team color shows on white jersey */}
      {has('clutch') && (teamNick || jerseyNum != null) && (
        <svg
          viewBox={overlayViewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{ ...overlayStyle, zIndex: 9 }}
          aria-hidden="true"
        >
          {teamNick && (
            <text
              x="476" y="148"
              textAnchor="middle"
              fontFamily="'Bebas Neue', Impact, Arial Black, sans-serif"
              fontSize={teamNameFontSize}
              letterSpacing={teamNameLetterSpacing}
              fill={tc('clutch')}
              stroke={tc2('clutch')}
              strokeWidth="2"
              paintOrder="stroke"
              style={{ opacity: 0.90, userSelect: 'none', pointerEvents: 'none' }}
            >{teamNick}</text>
          )}
          {jerseyNum != null && (
            <g transform="translate(474, 235) scale(0.78, 1)">
              <text
                x="0" y="0"
                textAnchor="middle"
                fontFamily="'Audiowide', 'Bebas Neue', Impact, Arial Black, sans-serif"
                fontSize="99"
                fill={tc('clutch')}
                stroke={tc2('clutch')}
                strokeWidth="4"
                paintOrder="stroke"
                style={{ opacity: 0.92, userSelect: 'none', pointerEvents: 'none' }}
              >{jerseyNum}</text>
            </g>
          )}
        </svg>
      )}
    </>
  )
}
