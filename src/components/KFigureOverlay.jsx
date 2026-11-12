import svgRaw from '../assets/k-figure-color.svg?raw'
import { warmSkin } from '../utils/footballSkin'

// The kicker's figure (public/k-silhouette.webp), through the ball on a field goal: the team colors laid over
// the art from src/assets/k-figure-color.svg (its parts named by side of the picture: "left" is the left of the
// image, so "left leg" is his kicking leg). The ball in the art is left as it is.
const FIG_W = 1199
const FIG_H = 1312

const PROCESSED_SVG = svgRaw.replace(`<svg width="${FIG_W}" height="${FIG_H}"`,
  `<svg id="k-fg" width="${FIG_W}" height="${FIG_H}" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet"`)

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

// A kicker has three ratings, so each one colors a third of him (Silhouette.jsx K_ZONES puts each dot on it;
// the same split the placeholder used on the QB figure):
//   clutch    helmet + logo, the face behind the cage (three pieces, between the bars), the neck
//   accuracy  jersey, V collar (second color), long sleeves (second color), hands, nickname + number
//   power     pants (second color), socks (team color), shoes (second color); also sets HT/WT
export default function KFigureOverlay({ build }) {
  const tc  = (s) => build?.[s]?.teamColor  ?? 'transparent'
  const tc2 = (s) => build?.[s]?.teamColor2 ?? 'transparent'
  const sk  = (s) => build?.[s]?.skinColor  ?? 'transparent'
  const has = (s) => !!build?.[s]

  let svg = PROCESSED_SVG

  // ── CLUTCH: the helmet, and the face and neck under it (flat skin, like the other figures)
  const H = 'clutch'
  svg = setFill(svg, 'helmet', tc(H), 'opacity:0.76;')
  const faceSkin = has(H) ? warmSkin(sk(H)) : 'transparent'
  svg = setFill(svg, 'face',  faceSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'face2', faceSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'face3', faceSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'neck',  faceSkin, `opacity:${SKIN_OPACITY};`)

  // ── ACCURACY: the jersey and its V collar, the long sleeves under it, the hands
  const J = 'accuracy'
  svg = setFill(svg, 'jersey', tc(J), 'opacity:0.76;')
  svg = setFill(svg, 'collar', tc2(J), 'opacity:0.82;')
  svg = setFill(svg, 'left sleeve',  tc2(J), 'opacity:0.74;')
  svg = setFill(svg, 'right sleeve', tc2(J), 'opacity:0.74;')
  const handSkin = has(J) ? warmSkin(sk(J)) : 'transparent'
  svg = setFill(svg, 'left hand',  handSkin, `opacity:${SKIN_OPACITY};`)
  svg = setFill(svg, 'right hand', handSkin, `opacity:${SKIN_OPACITY};`)

  // ── POWER: both legs. Pants in the second color, socks in the team color, shoes in the second color
  const P = 'power'
  svg = setFill(svg, 'left leg',  tc2(P), 'opacity:0.74;')
  svg = setFill(svg, 'right leg', tc2(P), 'opacity:0.74;')
  svg = setFill(svg, 'left lower leg',  tc(P), 'opacity:0.76;')
  svg = setFill(svg, 'right lower leg', tc(P), 'opacity:0.76;')
  svg = setFill(svg, 'left shoe',  tc2(P), 'opacity:0.78;')
  svg = setFill(svg, 'right shoe', tc2(P), 'opacity:0.78;')

  // (the cage and the ball are never colored: their outlines go, so nothing is drawn for them)
  svg = setFill(svg, 'facemask', 'transparent')
  svg = setFill(svg, 'ball', 'transparent')

  const jerseyChip = build?.[J]
  const teamNickname = TEAM_NICKNAMES[jerseyChip?.team] ?? jerseyChip?.team ?? ''
  const helmetTeam = build?.[H]?.team
  const num = jerseyChip?.number ?? ''
  const show = has(J) ? 1 : 0

  return (
    <div className="player-qbfig player-rbfig" style={{ mixBlendMode: 'screen' }}>
      <div style={SVG_STYLE} dangerouslySetInnerHTML={{ __html: svg }} />

      <svg viewBox={`0 0 ${FIG_W} ${FIG_H}`} preserveAspectRatio="xMidYMid meet"
           style={{ ...SVG_STYLE, willChange: 'transform' }} aria-hidden="true">
        <defs>
          <clipPath id="k-jersey-clip"><path d={JERSEY_CLIP_D} /></clipPath>
          <clipPath id="k-helmet-clip"><path d={HELMET_CLIP_D} /></clipPath>
        </defs>

        {/* The chest: the nickname under the V collar, the number below it. His shoulders are turned into the
            kick (the right of the picture is higher), so both lean with them */}
        <g clipPath="url(#k-jersey-clip)">
          <g transform="rotate(-6 604 440)">
            <text
              x="612" y="372"
              textAnchor="middle"
              fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
              fontSize="27"
              letterSpacing="2.5"
              fill="white"
              stroke="black"
              strokeWidth="3"
              paintOrder="stroke"
              style={{ opacity: show * 0.85, transition: 'opacity 0.5s ease', userSelect: 'none', pointerEvents: 'none' }}
            >{teamNickname}</text>
            <text
              x="604" y="520"
              textAnchor="middle"
              fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
              fontSize="158"
              letterSpacing="-3"
              fill="white"
              stroke="black"
              strokeWidth="6"
              paintOrder="stroke"
              style={{ opacity: show * 0.92, transition: 'opacity 0.5s ease', userSelect: 'none', pointerEvents: 'none' }}
            >{num}</text>
          </g>
        </g>

        {/* The team logo on each side of the shell, seen from the front with his head down: squeezed into the
            curve, clipped to the helmet */}
        {has(H) && helmetTeam && !NO_HELMET_LOGO.has(helmetTeam) && (
          <g clipPath="url(#k-helmet-clip)" style={{ pointerEvents: 'none' }}>
            <g transform="translate(522, 88) rotate(10) scale(.36, .78)">
              <image href={`/logos/${helmetTeam}.png`} x="-50" y="-50" width="100" height="100" style={{ opacity: 0.95, mixBlendMode: 'screen' }} />
            </g>
            <g transform="translate(668, 88) rotate(-10) scale(-.36, .78)">
              <image href={`/logos/${helmetTeam}.png`} x="-50" y="-50" width="100" height="100" style={{ opacity: 0.95, mixBlendMode: 'screen' }} />
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}
