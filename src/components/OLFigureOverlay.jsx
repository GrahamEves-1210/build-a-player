import { useState, useRef, useLayoutEffect } from 'react'
import svgRaw from '../assets/ol-figure-color.svg?raw'
import { warmSkin } from '../utils/footballSkin'

// The lineman's figure (public/ol-silhouette.webp), set in a wide two-point pass set: the team colors laid over
// the art from src/assets/ol-figure-color.svg (its parts named by side of the picture: "r" is the right of the image)
const FIG_W = 888
const FIG_H = 1289

const PROCESSED_SVG = svgRaw.replace(`<svg width="${FIG_W}" height="${FIG_H}"`,
  `<svg id="ol-fg" width="${FIG_W}" height="${FIG_H}" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet"`)

const pathD = id => svgRaw.match(new RegExp(`<path id="${id}"[^>]*? d="([^"]+)"`))?.[1] ?? ''
const HELMET_CLIP_D = pathD('helmet')
const JERSEY_CLIP_D = pathD('jersey')

// The short sleeves: the art has no sleeve parts, so each is drawn from the figure's outline at the shoulder,
// the bare arm's top edge and the jersey's side edge (all off the art's own paths and outline)
const SLEEVE_L = 'M174.5 228L166 240L159 250L155 260L152 270L151 280L147 290L145 300L143 310L145 320L145.5 324.5L149.5 331.5L156 338L161 342L170 348L175 351L180.5 354.5L187 358.5L196.5 364.5L205 371.5L210.5 376L216.5 382L221.5 389L228.5 401.5L232 409L232.5 402L230.5 391L228.5 383.5L222 364.5L219.5 357.5L213.5 341L209 328L202 310.5L195 290.5L188 274L183 260.5L178 242.5L175 233Z'
const SLEEVE_R = 'M641 236.5L647 240L653 250L658 260L660 270L664 280L666 290L667 300L667 310L666 320L664 330L661.5 334.5L658.5 338L654 343.5L648 347.5L637.5 355L630.5 358L626 360L619 364L612.5 368.5L604.5 372.5L599.5 376.5L596 380L589 385.5L585.5 390L582 395.5L578.5 399.5L574.5 406L570.5 412.5L568.5 416.5L566 422L565 426.5L565.5 423.5L572 406.5L578 392L589 374.5L600 353.5L614 327L622 306.5L625.5 297L635 271.5L639 256L641 247Z'

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

// Which trait colors which body part (Silhouette.jsx OL_ZONES puts each dot on it). Colors follow the DL
// figure's code (DLFigureOverlay), with the owner's OL calls: black forearm sleeves on every team.
//   discipline   helmet + logo
//   blitzPickup  face, lips, neck (flat skin, no shadow)
//   size         jersey, short sleeves, collar, nickname + number (also sets HT/WT)
//   length       bare arms
//   passPro      forearm sleeves (black) + gloves (second color)
//   anchor       knees, long socks (second color), white at the ankle
//   runBlock     pants (second color) + the thigh stripe (team color)
//   pancake      nothing on the figure
//   mobility     shoes
export default function OLFigureOverlay({ build, numberNudgePx = null, nameNudge = null }) {
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

  // ── DISCIPLINE: the helmet
  const H = 'discipline'
  svg = setFill(svg, 'helmet', tc(H), 'opacity:0.76;')

  // ── BLITZ PICKUP: the face and neck, flat skin like the neck (no helmet shadow), lips tinted
  const D = 'blitzPickup'
  const faceSkin = has(D) ? warmSkin(sk(D)) : 'transparent'
  const lip = has(D) ? lipTint(sk(D)) : 'transparent'
  svg = setFill(svg, 'face',  faceSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'face2', faceSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'lip',   lip, 'opacity:0.62;filter:blur(1.5px);')
  svg = setFill(svg, 'lip2',  lip, 'opacity:0.62;filter:blur(1.5px);')
  svg = setFill(svg, 'neck', faceSkin, `opacity:${SKIN_OPACITY};`)

  // ── SIZE: the jersey and its V collar
  const J = 'size'
  svg = setFill(svg, 'jersey', tc(J), 'opacity:0.76;')
  svg = setFill(svg, 'neck line', tc2(J), 'opacity:0.82;')

  // ── LENGTH: bare arms
  const armSkin = has('length') ? warmSkin(sk('length')) : 'transparent'
  svg = setFill(svg, 'l arm', armSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'r arm', armSkin, `opacity:${SKIN_OPACITY};`)

  // ── PASS PRO: the forearm sleeves ("wrist" in the art) black on every team, the gloves in the second color
  const wristBlack = has('passPro') ? '#0d0d0d' : 'transparent'
  svg = setFill(svg, 'l wrist', wristBlack, 'opacity:0.80;')
  svg = setFill(svg, 'r wrist', wristBlack, 'opacity:0.80;')
  svg = setFill(svg, 'l glove', tc2('passPro'), 'opacity:0.74;')
  svg = setFill(svg, 'r glove', tc2('passPro'), 'opacity:0.74;')

  // ── ANCHOR: the knees, bare between the pants and the socks
  const kneeSkin = has('anchor') ? warmSkin(sk('anchor')) : 'transparent'
  svg = setFill(svg, 'l knee', kneeSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'r knee', kneeSkin, `opacity:${SKIN_OPACITY};`)

  // ── RUN BLOCK: the pants in the second color, a team-color stripe down the thigh (DL's pants)
  svg = setFill(svg, 'legs', tc2('runBlock'), 'opacity:0.74;')
  svg = setFill(svg, 'leg stripe', tc('runBlock'), 'opacity:1;')

  // ── ANCHOR (cont.): the long socks in the second color (DL's), white at the ankle. Pancake colors nothing
  svg = setFill(svg, 'l shin', tc2('anchor'), 'opacity:0.74;')
  svg = setFill(svg, 'r shin', tc2('anchor'), 'opacity:0.74;')
  const sockWhite = has('anchor') ? '#ffffff' : 'transparent'
  svg = setFill(svg, 'l sock', sockWhite, 'opacity:0.72;')
  svg = setFill(svg, 'r sock', sockWhite, 'opacity:0.72;')

  // ── MOBILITY: shoes
  svg = setFill(svg, 'l shoe', tc('mobility'), 'opacity:0.78;')
  svg = setFill(svg, 'r shoe', tc('mobility'), 'opacity:0.78;')

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
          <clipPath id="ol-jersey-clip"><path d={JERSEY_CLIP_D} /></clipPath>
          <clipPath id="ol-helmet-clip"><path d={HELMET_CLIP_D} /></clipPath>
        </defs>

        {/* The short sleeves, the jersey's color */}
        <path d={SLEEVE_L} style={{ fill: tc(J), opacity: 0.76 }} />
        <path d={SLEEVE_R} style={{ fill: tc(J), opacity: 0.76 }} />

        {/* The chest: the nickname under the V collar, the number below it, between his arms; he's square to the camera */}
        <g clipPath="url(#ol-jersey-clip)">
          <g transform={`translate(${nudgeX}, ${nudgeY})`}>
            <text
              x={406 + (nameNudge?.x ?? 0)} y={410 + (nameNudge?.y ?? 0)}
              textAnchor="middle"
              fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
              fontSize="32"
              letterSpacing="2.5"
              fill="white"
              stroke="black"
              strokeWidth="3"
              paintOrder="stroke"
              style={{ opacity: show * 0.85, transition: 'opacity 0.5s ease', userSelect: 'none', pointerEvents: 'none' }}
            >{teamNickname}</text>
            <text
              x="402" y="592"
              textAnchor="middle"
              fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
              fontSize="214"
              letterSpacing="-3"
              fill="white"
              stroke="black"
              strokeWidth="7"
              paintOrder="stroke"
              style={{ opacity: show * 0.92, transition: 'opacity 0.5s ease', userSelect: 'none', pointerEvents: 'none' }}
            >{num}</text>
          </g>
        </g>

        {/* The team logo on the side of the shell he shows (his head is turned to the right of the picture):
            squeezed into the curve, clipped to the helmet */}
        {has(H) && helmetTeam && !NO_HELMET_LOGO.has(helmetTeam) && (
          <g clipPath="url(#ol-helmet-clip)" style={{ pointerEvents: 'none' }}>
            <g transform="translate(341, 71) rotate(-8) scale(.72, 1.06)">
              <image href={`/logos/${helmetTeam}.png`} x="-50" y="-50" width="100" height="100" style={{ opacity: 0.95, mixBlendMode: 'screen' }} />
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}
