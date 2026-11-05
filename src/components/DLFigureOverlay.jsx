import { useState, useRef, useLayoutEffect } from 'react'
import svgRaw from '../assets/dl-figure-color.svg?raw'
import { warmSkin, warmSkinLight } from '../utils/footballSkin'

// The torso leans: collar to belt runs about 9 degrees off plumb, so what's printed on it does too
const BODY_ANGLE = 12
// the chest's plane: the print gets smaller toward the bottom left, where the body turns away
const CHEST_PLANE = { transform: 'perspective(620px) rotateX(-13deg)', transformBox: 'fill-box', transformOrigin: 'right top' }
const NAME_PLANE = { transform: 'rotate(-5deg) perspective(620px)', transformBox: 'fill-box', transformOrigin: 'right center' }
const FIG_W = 912
const FIG_H = 1496

const PROCESSED_SVG = svgRaw.replace(`<svg width="${FIG_W}" height="${FIG_H}"`,
  `<svg id="dl-fg" width="${FIG_W}" height="${FIG_H}" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet"`)

const pathD = id => svgRaw.match(new RegExp(`<path id="${id}"[^>]*? d="([^"]+)"`))?.[1] ?? ''
const HELMET_CLIP_D = pathD('helmet')
const JERSEY_CLIP_D = pathD('jersey')
// the hand and wrist held across the chest sit in front of the number
const IN_FRONT_D = ['right glove', 'upper right glove', 'right hand thing'].map(pathD).join(' ')

const SVG_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

// Helmets without a standalone logo mark (same list as the DB figure)
const NO_HELMET_LOGO = new Set(['CLE', 'LAR', 'CIN', 'MIN', 'PHI'])

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

// Every bare-skin area uses the shared football skin treatment at one opacity
const SKIN_OPACITY = 0.58

function lipTint(hex) {
  if (!hex || hex === 'transparent') return 'transparent'
  const clamp = (v) => Math.max(0, Math.min(255, v))
  const br = parseInt(hex.slice(1, 3), 16)
  const bg = parseInt(hex.slice(3, 5), 16)
  const bb = parseInt(hex.slice(5, 7), 16)
  const extra = Math.max(0, ((br + bg + bb) / 3 - 140) * 0.2)
  // (a little less of it on darker skin, where the same red reads stronger)
  const k = (br + bg + bb) / 3 < 120 ? 0.75 : 1
  return `rgb(${clamp(br + 40 * k)},${clamp(bg - 22 * k - extra)},${clamp(bb - 4 * k - extra * 0.6)})`   // a touch pinker than DB's: this art's shading sits darker under it
}

// Which trait colors which body part:
//   playRecognition  helmet + logo, face, neck, lips, chinstrap
//   size             jersey, sleeves' caps, collar, numbers (also sets HT/WT and the spot)
//   strength         bare arms
//   powerMoves       elbow pad
//   blockShed        arm sleeve (secondary color, like the elbow pad, gloves and socks)
//   finesseMoves     gloves + wrist tape
//   bend             pants + the knee
//   speed            socks
//   getOff           shoes
export default function DLFigureOverlay({ build, numberNudgePx = null, nameNudge = null }) {
  const numSvgRef = useRef(null)
  const [unitsPerPx, setUnitsPerPx] = useState(1)
  useLayoutEffect(() => {
    if (!numberNudgePx) return
    const measure = () => {
      const r = numSvgRef.current?.getBoundingClientRect()
      if (!r || !r.width || !r.height) return
      setUnitsPerPx(1 / Math.min(r.width / FIG_W, r.height / FIG_H))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [numberNudgePx])
  const nudgeX = (numberNudgePx?.x ?? 0) * unitsPerPx
  const nudgeY = (numberNudgePx?.y ?? 0) * unitsPerPx
  const tc  = (s) => build?.[s]?.teamColor  ?? 'transparent'
  const tc2 = (s) => build?.[s]?.teamColor2 ?? 'transparent'
  const sk  = (s) => build?.[s]?.skinColor  ?? 'transparent'
  const has = (s) => !!build?.[s]

  let svg = PROCESSED_SVG

  // ── PLAY RECOGNITION: the head
  const H = 'playRecognition'
  svg = setFill(svg, 'helmet', tc(H), 'opacity:0.76;')
  const faceSkin  = has(H) ? warmSkin(sk(H)) : 'transparent'
  const faceLight = has(H) ? warmSkinLight(sk(H)) : 'transparent'
  // The helmet's shadow: the face and lips come up out of it, dark under the brim and lit at the chin
  // (on this figure everything is painted light over dark art, so a shadow is simply less paint)
  const shade = (id, color, top, bottom) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="${top}"/><stop offset="1" stop-color="${color}" stop-opacity="${bottom}"/></linearGradient>`
  const lip = has(H) ? lipTint(sk(H)) : 'transparent'
  if (has(H)) {
    const key = sk(H).replace('#', '')
    svg = svg.replace('<g id="Group 1">', `<defs>${shade(`dl-face-${key}`, faceSkin, 0.36, 0.46)}${shade(`dl-lit-${key}`, faceLight, 0.34, 0.44)}${shade(`dl-lip-${key}`, lip, 0.42, 0.52)}</defs><g id="Group 1">`)
    svg = setFill(svg, 'face',  `url(#dl-face-${key})`)
    svg = setFill(svg, 'face2', `url(#dl-lit-${key})`)
    svg = setFill(svg, 'face3', `url(#dl-face-${key})`)
    svg = setFill(svg, 'lips',  `url(#dl-lip-${key})`, 'filter:blur(1.5px);')   // soft edges, so they melt into the face
  } else {
    for (const id of ['face', 'face2', 'face3', 'lips']) svg = setFill(svg, id, 'transparent')
  }
  svg = setFill(svg, 'neck',  faceSkin,  `opacity:${SKIN_OPACITY};`)
  const strap = has(H) ? '#f2f2f2' : 'transparent'
  svg = setFill(svg, 'chinstrap',  strap, 'opacity:0.42;')
  svg = setFill(svg, 'chinstrap2', strap, 'opacity:0.42;')
  svg = setFill(svg, 'chinstrap3', strap, 'opacity:0.42;')

  // ── SIZE: the jersey
  const J = 'size'
  svg = setFill(svg, 'jersey', tc(J), 'opacity:0.76;')
  svg = setFill(svg, 'left shoulder', tc(J), `opacity:0.76;stroke:${tc(J)};stroke-width:1;stroke-opacity:.5;`)
  svg = setFill(svg, 'right shoulder', tc(J), `opacity:0.76;stroke:${tc(J)};stroke-width:1;stroke-opacity:.5;`)
  svg = setFill(svg, 'collar', tc2(J), 'opacity:0.82;')

  // ── STRENGTH: bare arms
  const armSkin = has('strength') ? warmSkin(sk('strength')) : 'transparent'
  svg = setFill(svg, 'left arm',     armSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'left forearm', armSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'right arm',    armSkin, `opacity:${SKIN_OPACITY};`)

  // ── FINESSE MOVES: gloves, wrist tape
  const G = 'finesseMoves'
  svg = setFill(svg, 'left glove',        tc2(G), 'opacity:0.74;')
  svg = setFill(svg, 'upper glove',       tc2(G), 'opacity:0.74;')
  svg = setFill(svg, 'right glove',       tc2(G), 'opacity:0.74;')
  svg = setFill(svg, 'upper right glove', tc2(G), 'opacity:0.74;')
  const tape = has(G) ? '#ffffff' : 'transparent'
  svg = setFill(svg, 'white hand thing', tape, 'opacity:0.72;')
  svg = setFill(svg, 'right hand thing', tape, 'opacity:0.72;')

  // ── BLOCK SHED: arm sleeve. POWER MOVES: elbow pad
  svg = setFill(svg, 'left sleeve', tc2('blockShed'), 'opacity:0.74;')
  svg = setFill(svg, 'right elbow', tc2('powerMoves'), 'opacity:0.74;')

  // ── BEND: pants, the bare knee
  const B = 'bend'
  svg = setFill(svg, 'legs',  tc2(B), 'opacity:0.74;')
  svg = setFill(svg, 'right', has(B) ? warmSkin(sk(B)) : 'transparent', `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'leg stripe', tc(B), 'opacity:1;')
  svg = setFill(svg, 'left knee', has(B) ? warmSkin(sk(B)) : 'transparent', `opacity:${SKIN_OPACITY};`)

  // ── SPEED: socks (long sock team color, white below it)
  const V = 'speed'
  svg = setFill(svg, 'left sock',  tc2(V), 'opacity:0.74;')
  svg = setFill(svg, 'right sock', tc2(V), 'opacity:0.74;')
  const sockWhite = has(V) ? '#ffffff' : 'transparent'
  svg = setFill(svg, 'left white sock', sockWhite, 'opacity:0.72;')
  svg = setFill(svg, 'rigth white sock', sockWhite, 'opacity:0.72;')

  // ── GET OFF: shoes
  svg = setFill(svg, 'left shoe',  tc('getOff'), 'opacity:0.78;')
  svg = setFill(svg, 'right shoe', tc('getOff'), 'opacity:0.78;')

  const jerseyChip = build?.[J]
  const teamNickname = TEAM_NICKNAMES[jerseyChip?.team] ?? jerseyChip?.team ?? ''
  const helmetTeam = build?.[H]?.team
  const num = jerseyChip?.number ?? ''

  return (
    <div className="player-qbfig player-rbfig" style={{ mixBlendMode: 'screen' }}>
      <div style={SVG_STYLE} dangerouslySetInnerHTML={{ __html: svg }} />

      <svg ref={numSvgRef} viewBox={`0 0 ${FIG_W} ${FIG_H}`} preserveAspectRatio="xMidYMid meet"
           style={{ ...SVG_STYLE, willChange: 'transform' }} aria-hidden="true">
        <defs>
          <clipPath id="dl-jersey-clip"><path d={JERSEY_CLIP_D} /></clipPath>
          <clipPath id="dl-helmet-clip"><path d={HELMET_CLIP_D} /></clipPath>
          <mask id="dl-number-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={FIG_W} height={FIG_H}>
            <rect width={FIG_W} height={FIG_H} fill="white" />
            <path d={IN_FRONT_D} fill="black" />
          </mask>
        </defs>

        <g clipPath="url(#dl-jersey-clip)">
          <g mask="url(#dl-number-mask)">
            <g transform={`translate(${nudgeX}, ${nudgeY}) rotate(${BODY_ANGLE}, 500, 530) skewX(7)`}>
              <text
                x={435 + (nameNudge?.x ?? 0)} y={452 + (nameNudge?.y ?? 0)}
                textAnchor="middle"
                fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
                fontSize="32"
                letterSpacing="2.5"
                fill="white"
                stroke="black"
                strokeWidth="3"
                paintOrder="stroke"
                style={{ opacity: has(J) ? 0.85 : 0, transition: 'opacity 0.5s ease', userSelect: 'none', pointerEvents: 'none', ...NAME_PLANE }}
              >{teamNickname}</text>
              <text
                x="438" y="592"
                textAnchor="middle"
                fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
                fontSize="158"
                letterSpacing="-3"
                fill="white"
                stroke="black"
                strokeWidth="7"
                paintOrder="stroke"
                style={{ opacity: has(J) ? 0.92 : 0, transition: 'opacity 0.5s ease', userSelect: 'none', pointerEvents: 'none', ...CHEST_PLANE }}
              >{num}</text>
            </g>
          </g>
        </g>

        {/* Shoulder numbers */}
        <g transform="translate(330, 246) rotate(96) scale(1, .86)" style={{ opacity: has(J) ? 0.9 : 0, transition: 'opacity 0.5s ease' }}>
          <text x="0" y="0" textAnchor="middle" fontFamily="'Bebas Neue', Impact, Arial, sans-serif" fontSize="94"
            fill="white" stroke="black" strokeWidth="3" paintOrder="stroke" style={{ userSelect: 'none', pointerEvents: 'none' }}>{num}</text>
        </g>
        <g transform="translate(750, 272) rotate(-88) scale(1, .86)" style={{ opacity: has(J) ? 0.9 : 0, transition: 'opacity 0.5s ease' }}>
          <text x="0" y="0" textAnchor="middle" fontFamily="'Bebas Neue', Impact, Arial, sans-serif" fontSize="94"
            fill="white" stroke="black" strokeWidth="3" paintOrder="stroke" style={{ userSelect: 'none', pointerEvents: 'none' }}>{num}</text>
        </g>

        {/* The team logo on each side of the shell, turned with the curve and clipped to the helmet's outline */}
        {has(H) && helmetTeam && !NO_HELMET_LOGO.has(helmetTeam) && (
          <g clipPath="url(#dl-helmet-clip)" style={{ pointerEvents: 'none' }}>
            <g transform="translate(428, 70) rotate(-10) scale(.6, 1)">
              <image href={`/logos/${helmetTeam}.png`} x="-57" y="-57" width="114" height="114" style={{ opacity: 0.95, mixBlendMode: 'screen' }} />
            </g>
            <g transform="translate(650, 66) rotate(10) scale(-.6, 1)">
              <image href={`/logos/${helmetTeam}.png`} x="-57" y="-57" width="114" height="114" style={{ opacity: 0.95, mixBlendMode: 'screen' }} />
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}
