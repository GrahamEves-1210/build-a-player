import { useState, useRef, useLayoutEffect } from 'react'
import svgRaw from '../assets/lb-figure-color.svg?raw'
import { warmSkin, warmSkinLight } from '../utils/footballSkin'

// The linebacker's figure (public/lb-silhouette.webp), squared up in his stance: the team colors laid over
// the art from src/assets/lb-figure-color.svg (its parts named by side of the picture: "r" is the right of the image)
const FIG_W = 1005
const FIG_H = 1267

const PROCESSED_SVG = svgRaw.replace(`<svg width="${FIG_W}" height="${FIG_H}"`,
  `<svg id="lb-fg" width="${FIG_W}" height="${FIG_H}" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet"`)

const pathD = id => svgRaw.match(new RegExp(`<path id="${id}"[^>]*? d="([^"]+)"`))?.[1] ?? ''
const HELMET_CLIP_D = pathD('helmet')
const JERSEY_CLIP_D = pathD('jersey')

const SVG_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

// Helmets without a standalone logo mark (same list as the other figures)
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
  // (the DB figure's tint: a touch of red over the skin, less pink than DL's; the owner's call for LB and OL)
  const extra = Math.max(0, ((br + bg + bb) / 3 - 140) * 0.2)
  return `rgb(${clamp(br + 18)},${clamp(bg - 5 - extra)},${clamp(bb - 3 - extra)})`
}

// Which trait colors which body part (Silhouette.jsx LB_ZONES puts each dot on it):
//   playRecognition  helmet + logo
//   leadership       face, lips, neck
//   size             jersey, sleeve caps, collar, numbers (also sets HT/WT)
//   power            bare arms
//   blockShed        wristbands
//   tackling         gloves
//   passRush         pants
//   zoneInstincts    lower legs
//   range            shoes + socks
export default function LBFigureOverlay({ build, numberNudgePx = null, nameNudge = null }) {
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

  // ── PLAY RECOGNITION: the helmet
  const H = 'playRecognition'
  svg = setFill(svg, 'helmet', tc(H), 'opacity:0.76;')

  // ── LEADERSHIP: the face and neck, out of the helmet's shadow (dark under the brim, lit at the chin)
  const L = 'leadership'
  const faceSkin  = has(L) ? warmSkin(sk(L)) : 'transparent'
  const faceLight = has(L) ? warmSkinLight(sk(L)) : 'transparent'
  const shade = (id, color, top, bottom) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="${top}"/><stop offset="1" stop-color="${color}" stop-opacity="${bottom}"/></linearGradient>`
  const lip = has(L) ? lipTint(sk(L)) : 'transparent'
  if (has(L)) {
    const key = sk(L).replace('#', '')
    svg = svg.replace('<g id="Group 1">', `<defs>${shade(`lb-face-${key}`, faceSkin, 0.36, 0.46)}${shade(`lb-lit-${key}`, faceLight, 0.34, 0.44)}${shade(`lb-lip-${key}`, lip, 0.30, 0.40)}</defs><g id="Group 1">`)
    svg = setFill(svg, 'face',  `url(#lb-face-${key})`)
    svg = setFill(svg, 'face1', `url(#lb-lit-${key})`)
    svg = setFill(svg, 'face2', `url(#lb-face-${key})`)
    svg = setFill(svg, 'lips',  `url(#lb-lip-${key})`, 'filter:blur(1.5px);')
  } else {
    for (const id of ['face', 'face1', 'face2', 'lips']) svg = setFill(svg, id, 'transparent')
  }
  svg = setFill(svg, 'neck', faceSkin, `opacity:${SKIN_OPACITY};`)

  // ── SIZE: the jersey
  const J = 'size'
  svg = setFill(svg, 'jersey', tc(J), 'opacity:0.76;')
  svg = setFill(svg, 'shoulder', tc(J), `opacity:0.76;stroke:${tc(J)};stroke-width:1;stroke-opacity:.5;`)
  svg = setFill(svg, 'r shoulder', tc(J), `opacity:0.76;stroke:${tc(J)};stroke-width:1;stroke-opacity:.5;`)
  svg = setFill(svg, 'neck line', tc2(J), 'opacity:0.82;')

  // ── POWER: bare arms
  const armSkin = has('power') ? warmSkin(sk('power')) : 'transparent'
  svg = setFill(svg, 'l arm', armSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'r arm', armSkin, `opacity:${SKIN_OPACITY};`)

  // ── BLOCK SHED: wristbands ("r ankle" in the art is the right wrist)
  svg = setFill(svg, 'l wrist', tc2('blockShed'), 'opacity:0.74;')
  svg = setFill(svg, 'r ankle', tc2('blockShed'), 'opacity:0.74;')

  // ── TACKLING: gloves
  svg = setFill(svg, 'l glove', tc2('tackling'), 'opacity:0.74;')
  svg = setFill(svg, 'r glove', tc2('tackling'), 'opacity:0.74;')

  // ── PASS RUSH: pants
  svg = setFill(svg, 'legs', tc2('passRush'), 'opacity:0.74;')

  // ── ZONE INSTINCTS: lower legs
  svg = setFill(svg, 'l shin', tc2('zoneInstincts'), 'opacity:0.74;')
  svg = setFill(svg, 'r shin', tc2('zoneInstincts'), 'opacity:0.74;')

  // ── RANGE: shoes, white socks above them
  svg = setFill(svg, 'l shoe', tc('range'), 'opacity:0.78;')
  svg = setFill(svg, 'r shoe', tc('range'), 'opacity:0.78;')
  const sockWhite = has('range') ? '#ffffff' : 'transparent'
  svg = setFill(svg, 'l sock', sockWhite, 'opacity:0.72;')
  svg = setFill(svg, 'r sock', sockWhite, 'opacity:0.72;')

  const jerseyChip = build?.[J]
  const teamNickname = TEAM_NICKNAMES[jerseyChip?.team] ?? jerseyChip?.team ?? ''
  const helmetTeam = build?.[H]?.team
  const num = jerseyChip?.number ?? ''
  const show = has(J) ? 1 : 0

  return (
    <div className="player-qbfig player-rbfig" style={{ mixBlendMode: 'screen' }}>
      <div style={SVG_STYLE} dangerouslySetInnerHTML={{ __html: svg }} />

      <svg ref={numSvgRef} viewBox={`0 0 ${FIG_W} ${FIG_H}`} preserveAspectRatio="xMidYMid meet"
           style={{ ...SVG_STYLE, willChange: 'transform' }} aria-hidden="true">
        <defs>
          <clipPath id="lb-jersey-clip"><path d={JERSEY_CLIP_D} /></clipPath>
          <clipPath id="lb-helmet-clip"><path d={HELMET_CLIP_D} /></clipPath>
        </defs>

        {/* The chest: the nickname under the collar, the number below it; he's square to the camera */}
        <g clipPath="url(#lb-jersey-clip)">
          <g transform={`translate(${nudgeX}, ${nudgeY})`}>
            <text
              x={562 + (nameNudge?.x ?? 0)} y={398 + (nameNudge?.y ?? 0)}
              textAnchor="middle"
              fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
              fontSize="34"
              letterSpacing="2.5"
              fill="white"
              stroke="black"
              strokeWidth="3"
              paintOrder="stroke"
              style={{ opacity: show * 0.85, transition: 'opacity 0.5s ease', userSelect: 'none', pointerEvents: 'none' }}
            >{teamNickname}</text>
            <text
              x="562" y="560"
              textAnchor="middle"
              fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
              fontSize="168"
              letterSpacing="-3"
              fill="white"
              stroke="black"
              strokeWidth="7"
              paintOrder="stroke"
              style={{ opacity: show * 0.92, transition: 'opacity 0.5s ease', userSelect: 'none', pointerEvents: 'none' }}
            >{num}</text>
          </g>
        </g>

        {/* Shoulder numbers, turned a quarter each way to run down the shoulder caps */}
        <g><g transform="translate(400, 244) rotate(-90)" style={{ opacity: show * 0.9, transition: 'opacity 0.5s ease' }}>
          <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontFamily="'Bebas Neue', Impact, Arial, sans-serif" fontSize="84"
            fill="white" stroke="black" strokeWidth="4" paintOrder="stroke" style={{ userSelect: 'none', pointerEvents: 'none' }}>{num}</text>
        </g></g>
        <g><g transform="translate(721, 251) rotate(90)" style={{ opacity: show * 0.9, transition: 'opacity 0.5s ease' }}>
          <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontFamily="'Bebas Neue', Impact, Arial, sans-serif" fontSize="84"
            fill="white" stroke="black" strokeWidth="4" paintOrder="stroke" style={{ userSelect: 'none', pointerEvents: 'none' }}>{num}</text>
        </g></g>

        {/* The team logo on each side of the shell, seen from the front: squeezed into the curve, clipped to the helmet */}
        {has(H) && helmetTeam && !NO_HELMET_LOGO.has(helmetTeam) && (
          <g clipPath="url(#lb-helmet-clip)" style={{ pointerEvents: 'none' }}>
            <g transform="translate(484, 58) rotate(12) scale(.42, .9)">
              <image href={`/logos/${helmetTeam}.png`} x="-50" y="-50" width="100" height="100" style={{ opacity: 0.95, mixBlendMode: 'screen' }} />
            </g>
            <g transform="translate(645, 58) rotate(8) scale(-.42, .9)">
              <image href={`/logos/${helmetTeam}.png`} x="-50" y="-50" width="100" height="100" style={{ opacity: 0.95, mixBlendMode: 'screen' }} />
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}
