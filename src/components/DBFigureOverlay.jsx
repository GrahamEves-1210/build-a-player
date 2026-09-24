import { useState, useRef, useLayoutEffect } from 'react'
import svgRaw from '../assets/db-figure-color.svg?raw'

const PROCESSED_SVG = (() => {
  let html = svgRaw
  html = html.replace('<svg width="479" height="1028"',
    '<svg id="db-fg" width="479" height="1028" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet"')
  return html
})()

const SVG_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

// Torso/head tilt in this pose — chest leans down-and-right, so jersey text,
// the helmet logo, and shoulder numbers all share this same rotation.
const BODY_ANGLE = 7

// Same path data as the SVG's own "helmet" shape — used to clip the team
// logo so it can't bleed past the helmet's actual silhouette.
const HELMET_CLIP_D = 'M208 102.185L211 123.031L222 142.86L231 162.688L237 175.907L243.5 181.5V180.483L241.5 176.416L239 167.264L243.5 158.621L246.5 155.062L248.5 146.927L246.5 134.216L241.5 129.64L231 114.896L227 102.185L234 89.4747L241.5 87.9494L270.5 97.1011H273L277 91L298.5 90.4916L306 98L312 99.1348L315 87.9494L320 83L360.5 84L365 87.9494L366.5 102.185H371.5L373.5 96.5H382.5L385 102.185V84.3904L387.5 79.3062L385 68.6292L382.5 70.1545L378.5 57.9522L370 42.6994L361 31.514L354 25.9213L349.5 19.8202L341.5 11.6854L328 5.58427L305 0.5H290L273 2.53371L258.5 7.61798L243.5 16.7697L241.5 19.8202L232.5 28.4635L216 50.8343L211 68.6292L208 70.1545L206.5 76.764L208 102.185Z'

// Same path data as the SVG's own "jersey" shape — used to clip the jersey
// number so it can't bleed past the jersey's actual silhouette.
const JERSEY_CLIP_D = 'M213.5 148.5L218.5 153L219.5 155L212.5 158.5L208 161L203 166L202 174.5L201.5 188.5L206 205.5L216.5 242L223.5 260L232 279L237 287.5L245.5 300.5L256.5 318.5L269 328.5L298 307.5L308.5 300.5L316.5 292L327 280L329.5 275.5L338 259L343.5 244L346 236V228V217.5L352.5 215.5L359 211L364 206L367 200L372.5 199L375 196L376 185L378 179L379.5 170L385 171.5L402 178L412 184.5L420.5 193.5L424.5 201C426.167 206 429.5 216.2 429.5 217C429.5 217.8 430.833 222 431.5 224L433 237.5L430.5 249.5L426.5 256L425.5 260L415.5 279L407 286.5L387 299.5L370 310L357.5 317L345.5 328.5L338.5 338H336.5L332.5 347L328.5 355L320 363.5L313.5 368L307 377L298.5 389L295 392.5L296 395L293 399.5L289 404.5V407L287.5 412L284.5 417V419L286.5 422.5L281 431.5L272.5 438.5L260.5 446L242.5 451.5H216.5L198.5 450.5L179.5 447L159 442L142.5 435.5L134.5 432.5L122 426.5L110 422.5L99 415.5L93 412L94.5 410L93 402L96.5 395L98 388L101.5 378L109 365L117 351L121 343L129 325.5L135.5 310L131 296.5L121 289L109 284L98 274.5L87.5 261.5L78 244.5L75.5 240.5L72.5 233.5L70.5 222.5L71 214L75.5 204.5L82.5 192.5L90.5 178.5L96.5 171.5L101.5 168.5C106 166.667 115.1 163 115.5 163C115.9 163 126 158.667 131 156.5L142 153H164.5L185 151L213.5 148.5Z'

// These teams' real helmets don't carry a standalone logo mark (Browns have
// none at all; Rams/Bengals/Vikings/Eagles build their helmet identity into
// the shell itself — horns, stripes, wings — not a separate decal) so we
// skip the logo overlay for them rather than fake one on.
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

// Sets fill on a single <path id="X" ... stroke="black"/>
function setFill(html, id, fill, extra = '') {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(
    new RegExp(`(<path id="${escapedId}"[^>]*?)\\s*stroke="black"`),
    `$1 style="fill:${fill};stroke:none;${extra}"`
  )
}

// The "right shoulder" <g> in this SVG export bundles two un-id'd paths that
// are actually unrelated body parts: child 0 is the left-hand glove (no
// separate "left glove" id exists elsewhere in the file) and child 1 is the
// actual right shoulder pad. Style each one independently by index.
function setGroupChildFill(html, groupId, idx, fill, extra = '') {
  const escapedId = groupId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(
    new RegExp(`<g id="${escapedId}">([\\s\\S]*?)</g>`),
    (whole, inner) => {
      const paths = inner.match(/<path[^>]*\/>/g) || []
      if (!paths[idx]) return whole
      paths[idx] = paths[idx].replace('stroke="black"', `style="fill:${fill};stroke:none;${extra}"`)
      return `<g id="${escapedId}">${paths.join('')}</g>`
    }
  )
}

function warmSkin(hex, light = 5, redBoost = 25) {
  if (!hex || hex === 'transparent') return 'transparent'
  const clamp = (v) => Math.max(0, Math.min(255, v))
  const r = clamp(parseInt(hex.slice(1, 3), 16) + light + redBoost)
  const g = clamp(parseInt(hex.slice(3, 5), 16) + light)
  const b = clamp(parseInt(hex.slice(5, 7), 16) + light - 6)
  return `rgb(${r},${g},${b})`
}

// Shared skin treatment for every bare-skin area (face, neck, arms, knees) so they
// all read consistently. `light` is kept low — mixBlendMode:'screen' can only
// brighten what's under it, so too much light washes dark skin tones out toward
// gray/caucasian-looking instead of reading as a darker, warmer tone.
const SKIN_LIGHT   = 1
const SKIN_RED     = 34
const SKIN_OPACITY = 0.58

// Lips get their own pink/rose tint instead of reusing warmSkin's "skin + red"
// math — on light skin tones warmSkin's red channel clips at 255 almost
// immediately, so the extra redBoost does nothing and lips just look like a
// slightly deeper tan. Cutting green (not just boosting red) is what actually
// shifts the hue toward pink regardless of how light the base skin tone is.
function lipTint(hex) {
  if (!hex || hex === 'transparent') return 'transparent'
  const clamp = (v) => Math.max(0, Math.min(255, v))
  const br = parseInt(hex.slice(1, 3), 16)
  const bg = parseInt(hex.slice(3, 5), 16)
  const bb = parseInt(hex.slice(5, 7), 16)
  // On light skin, red is already clipped at 255 — "more red" only reads once
  // green/blue get pulled down further, so scale that pull with brightness.
  const extra = Math.max(0, ((br + bg + bb) / 3 - 140) * 0.2)
  const r = clamp(br + 18)
  const g = clamp(bg - 5 - extra)
  const b = clamp(bb - 3 - extra)
  return `rgb(${r},${g},${b})`
}

// numberNudgePx: screen-pixel offset for the chest jersey number (mobile tweak).
// The SVG scales to fit its box, so convert px to viewBox units at runtime.
export default function DBFigureOverlay({ build, numberNudgePx = null }) {
  const numSvgRef = useRef(null)
  const [unitsPerPx, setUnitsPerPx] = useState(1)
  useLayoutEffect(() => {
    if (!numberNudgePx) return
    const measure = () => {
      const r = numSvgRef.current?.getBoundingClientRect()
      if (!r || !r.width || !r.height) return
      setUnitsPerPx(1 / Math.min(r.width / 479, r.height / 1028))
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

  // ── HEAD (zoneIQ, fallback playRecognition): helmet team color, face/neck skin
  const headKey = has('zoneIQ') ? 'zoneIQ' : 'playRecognition'
  svg = setFill(svg, 'helmet', tc(headKey), 'opacity:0.76;')
  if (has(headKey)) {
    const skinColor  = warmSkin(sk(headKey), SKIN_LIGHT, SKIN_RED)
    // face/face2 sit under the helmet brim — read as shadowed, not a different
    // (blacker/grayer) skin color: same hue, just less light added.
    // Enough opacity to still read as tinted skin, not a flat dark mask —
    // too little opacity here just shows the raw (achromatic) dark base PNG,
    // which looks like a visor instead of shadowed skin.
    const skinLight  = warmSkin(sk(headKey), SKIN_LIGHT + 8, SKIN_RED - 6)
    const lipColor   = lipTint(sk(headKey))
    svg = setFill(svg, 'face',     '#0d0d0d', 'opacity:0.85;')
    svg = setFill(svg, 'face2',    '#0d0d0d', 'opacity:0.85;')
    svg = setFill(svg, 'face3',    skinColor,  `opacity:${SKIN_OPACITY};`)
    svg = setFill(svg, 'face4',    skinLight,  'opacity:0.50;')
    // Neck should read the same as the arms — same skin treatment, same opacity.
    svg = setFill(svg, 'neck',     skinColor, `opacity:${SKIN_OPACITY};`)
    svg = setFill(svg, 'neckline', '#000000', 'opacity:0.55;')
    svg = setFill(svg, 'lip',      lipColor,  'opacity:0.62;')
    svg = setFill(svg, 'lip2',     lipColor,  'opacity:0.62;')
  } else {
    svg = setFill(svg, 'face',     'transparent')
    svg = setFill(svg, 'face2',    'transparent')
    svg = setFill(svg, 'face3',    'transparent')
    svg = setFill(svg, 'face4',    'transparent')
    svg = setFill(svg, 'neck',     'transparent')
    svg = setFill(svg, 'neckline', 'transparent')
    svg = setFill(svg, 'lip',      'transparent')
    svg = setFill(svg, 'lip2',     'transparent')
  }

  // ── SIZE: jersey team color; shoulders black (pads showing through, not
  // team-colored); undershirt black; stripe1/3 secondary color, stripe2 white
  svg = setFill(svg, 'jersey', tc('size'), 'opacity:0.66;')
  const shoulderFill = has('size') ? '#0d0d0d' : 'transparent'
  svg = setFill(svg, 'left shoulder', shoulderFill, 'opacity:0.85;')
  svg = setGroupChildFill(svg, 'right shoulder', 1, shoulderFill, 'opacity:0.85;')
  const undershirtFill = has('size') ? '#0d0d0d' : 'transparent'
  svg = setFill(svg, 'undershirt', undershirtFill, 'opacity:0.55;')
  const stripeSecondary = has('size') ? tc2('size') : 'transparent'
  const stripeWhite     = has('size') ? '#f2f2f2' : 'transparent'
  svg = setFill(svg, 'stripe1', stripeSecondary, 'opacity:0.73;')
  svg = setFill(svg, 'stripe2', stripeWhite)
  svg = setFill(svg, 'stripe3', stripeSecondary, 'opacity:0.73;')

  // ── PRESS: bare arm skin tone only (sleeves now belong to man coverage / run support)
  const armSkin = has('press') ? warmSkin(sk('press'), SKIN_LIGHT, SKIN_RED) : 'transparent'
  svg = setFill(svg, 'left arm',  armSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'right arm', armSkin, `opacity:${SKIN_OPACITY};`)

  // ── HANDS: both gloves (right glove has its own id; left glove is the
  // unlabeled first path bundled into the "right shoulder" group)
  svg = setFill(svg, 'right glove', tc('hands'), 'opacity:0.63;')
  svg = setGroupChildFill(svg, 'right shoulder', 0, tc('hands'), 'opacity:0.63;')

  // ── SPEED: shins (black), shoes (team color), socks (white)
  const shinFill = has('speed') ? '#0d0d0d' : 'transparent'
  svg = setFill(svg, 'left shin',  shinFill, 'opacity:0.80;')
  svg = setFill(svg, 'right shin', shinFill, 'opacity:0.80;')
  svg = setFill(svg, 'left shoe',  tc('speed'), 'opacity:0.68;')
  svg = setFill(svg, 'right shoe', tc('speed'), 'opacity:0.68;')
  const sockFill = has('speed') ? '#ffffff' : 'transparent'
  svg = setFill(svg, 'left sock',  sockFill, 'opacity:0.72;')
  svg = setFill(svg, 'right sock', sockFill, 'opacity:0.72;')

  // ── FLUIDITY: knees (skin tone) + thighs/legs (team color)
  const kneeSkin = has('fluidity') ? warmSkin(sk('fluidity'), SKIN_LIGHT, SKIN_RED) : 'transparent'
  svg = setFill(svg, 'left knee',  kneeSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'right knee', kneeSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'thighs', tc('fluidity'), 'opacity:0.63;')

  // ── MAN COVERAGE: left sleeve
  svg = setFill(svg, 'left sleeve', tc('manCoverage'), 'opacity:0.63;')

  // ── RUN SUPPORT: right sleeve
  svg = setFill(svg, 'right sleeve', tc('runSupport'), 'opacity:0.63;')

  const sizeChip = build?.['size']
  const teamNickname = TEAM_NICKNAMES[sizeChip?.team] ?? sizeChip?.team ?? ''
  const helmetTeam = build?.[headKey]?.team

  return (
    <div className="player-qbfig player-rbfig" style={{ mixBlendMode: 'screen' }}>
      <div style={SVG_STYLE} dangerouslySetInnerHTML={{ __html: svg }} />

      {/* Jersey number + team name + shoulder numbers — angled to match the torso tilt */}
      <svg ref={numSvgRef} viewBox="0 0 479 1028" preserveAspectRatio="xMidYMid meet"
           style={SVG_STYLE} aria-hidden="true">
        <g transform={`rotate(${BODY_ANGLE}, 252, 300)`}>
          <text
            x="272" y="345"
            textAnchor="middle"
            fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
            fontSize="22"
            letterSpacing="1"
            fill="white"
            stroke="black"
            strokeWidth="2"
            paintOrder="stroke"
            style={{
              opacity: has('size') ? 0.85 : 0,
              transition: 'opacity 0.5s ease',
              userSelect: 'none',
              pointerEvents: 'none',
              transform: 'perspective(300px) rotateY(-3deg)',
              transformBox: 'fill-box',
              transformOrigin: 'left center',
            }}
          >{teamNickname}</text>
        </g>

        <defs>
          <clipPath id="db-jersey-clip">
            <path d={JERSEY_CLIP_D} />
          </clipPath>
        </defs>
        {/* Jersey number — clip lives outside the rotated group (same fix as the
            helmet logo) so it stays in the jersey's real, unrotated coordinate
            space and can't bleed past the jersey's actual silhouette. */}
        <g clipPath="url(#db-jersey-clip)">
          <g transform={`translate(${nudgeX}, ${nudgeY})`}>
          <g transform={`rotate(${BODY_ANGLE}, 252, 300)`}>
            <text
              x="265" y="454"
              textAnchor="middle"
              fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
              fontSize="140"
              letterSpacing="-6"
              fill="white"
              stroke="black"
              strokeWidth="5"
              paintOrder="stroke"
              style={{
                opacity: has('size') ? 0.92 : 0,
                transition: 'opacity 0.5s ease',
                userSelect: 'none',
                pointerEvents: 'none',
                transform: `perspective(360px) rotateY(-6deg) scaleY(0.9) rotate(${numberNudgePx ? 7 : 8}deg)`,
                transformBox: 'fill-box',
                transformOrigin: 'left top',
              }}
            >{sizeChip?.number ?? ''}</text>
          </g>
          </g>
        </g>

        {/* Left shoulder number (viewer left) — sideways, top pointing outward/left */}
        <g transform="translate(121, 190) rotate(90)"
           style={{ opacity: has('size') ? 0.9 : 0, transition: 'opacity 0.5s ease' }}>
          <text
            x="0" y="0"
            textAnchor="middle"
            fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
            fontSize="61"
            fill="white"
            stroke="black"
            strokeWidth="2.4"
            paintOrder="stroke"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >{sizeChip?.number ?? ''}</text>
        </g>

        {/* Right shoulder number (viewer right) — sideways, top pointing outward/right */}
        <g transform="translate(413, 205) rotate(-90)"
           style={{ opacity: has('size') ? 0.9 : 0, transition: 'opacity 0.5s ease' }}>
          <text
            x="0" y="0"
            textAnchor="middle"
            fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
            fontSize="55"
            fill="white"
            stroke="black"
            strokeWidth="2.4"
            paintOrder="stroke"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >{sizeChip?.number ?? ''}</text>
        </g>

        {/* Team logo on the helmet — same angle as the jersey number, clipped
            to the helmet's own silhouette so it can't bleed past its edges.
            The player faces forward, so the helmet curves away from camera on
            its left side — taper the logo in from that edge to sell the curve,
            anchored on its right edge so only the left side compresses. */}
        {has(headKey) && helmetTeam && !NO_HELMET_LOGO.has(helmetTeam) && (
          <g style={{ pointerEvents: 'none' }}>
            <defs>
              <clipPath id="db-helmet-clip">
                <path d={HELMET_CLIP_D} />
              </clipPath>
            </defs>
            {/* Clip lives OUTSIDE the rotated group — it must stay in the same
                static coordinate space as the real (unrotated) helmet path to
                actually line up with it. The image rotates freely inside it. */}
            <g clipPath="url(#db-helmet-clip)">
              <g transform={`rotate(${BODY_ANGLE}, 297, 91)`}>
                <image href={`/logos/${helmetTeam}.png`} x="159.5" y="13.5" width="115" height="115"
                  style={{
                    opacity: 0.95, mixBlendMode: 'screen',
                    transform: 'rotate(10deg) scaleX(0.7)', transformBox: 'fill-box', transformOrigin: 'right center',
                  }} />
              </g>
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}
