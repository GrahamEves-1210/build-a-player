import svgRaw from '../assets/st-figure-color.svg?raw'
import { warmSkin } from '../utils/footballSkin'

// The striker's figure (public/st-silhouette.webp), through the ball: the kit and the skin laid over the art from
// src/assets/st-figure-color.svg (one path a part, traced on the art's own seams; "left" is the left of the picture,
// so the left leg is his trailing leg and the right leg is the one on the ball). The hair and the ball in the art
// are left as they are.
// The build arrives under the basketball keys (lib/soccerUi.js SOCCER_AS_BUCKET), like the figure it replaced:
//   basketballIQ  HEADING      his face and neck (the skin of the player the trait came from)
//   clutch        COMPOSURE    the shirt and its long sleeve in the club's colour, the collar and the cuff in its
//                              second colour, the crest on the chest and the number under it
//   speed         PACE         the shorts (the second colour; white when the shirt is), the socks (the club's colour)
//                              with their turnover in the second colour, the bare thighs and knees
//   bounce        SHOT POWER   the boots
//   size          SIZE         the hand
export const ST_FIG_W = 1024
export const ST_FIG_H = 1536

const dOf = id => svgRaw.match(new RegExp(`<path id="${id}" d="([^"]+)"`))?.[1] ?? ''
const D = Object.fromEntries(['jersey', 'collar', 'neck', 'sleeve', 'cuff', 'hand', 'shorts', 'left thigh', 'right thigh', 'left sock top',
  'right sock top', 'left sock', 'right sock', 'left boot', 'right boot', 'face'].map(id => [id, dOf(id)]))

// Every bare-skin area uses the shared football skin treatment at one opacity (as the kicker's figure does)
const SKIN_OPACITY = 0.58
const KIT_OPACITY = 0.78
const TRIM_OPACITY = 0.82

const lightHex = hex => {
  if (!/^#[0-9a-f]{6}$/i.test(hex ?? '')) return false
  const n = i => parseInt(hex.slice(i, i + 2), 16)
  return 0.299 * n(1) + 0.587 * n(3) + 0.114 * n(5) > 200
}

// parts that share a colour go in one group at the group's opacity: where two of them meet (the jaw, the shoulder
// seam) the fills can't double up into a bright line
const Group = ({ ids, fill, opacity }) => (
  <g style={{ opacity, transition: 'opacity 0.4s ease' }}>
    {ids.map(id => <path key={id} d={D[id]} fill={fill} fillRule="evenodd" />)}
  </g>
)

const SVG_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }

// `scale`: the figure's CSS scale on the page (the art is scaled the same way), applied to both layers here so the
// colour layer still screens over the art (a scaled wrapper would cut it off from the picture under it)
export default function StrikerFigureOverlay({ build, logoDir = null, scale = 1 }) {
  const tf = scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: 'center center' } : null
  const chip = s => build?.[s] ?? null
  const shirt = chip('clutch'), legs = chip('speed'), boots = chip('bounce'), size = chip('size'), head = chip('basketballIQ')
  const dir = logoDir ?? '/logos/soccer/'

  const c1 = shirt?.teamColor ?? '#ffffff', c2 = shirt?.teamColor2 ?? '#111111'
  // the number in the trim colour, or white/black off the shirt when the trim is too close to it
  const numFill = lightHex(c1) === lightHex(c2) ? (lightHex(c1) ? '#111111' : '#ffffff') : c2

  const l1 = legs?.teamColor ?? '#ffffff', l2 = legs?.teamColor2 ?? '#111111'
  const shorts = lightHex(l1) ? l1 : l2
  const sockTop = lightHex(l1) === lightHex(l2) ? (lightHex(l1) ? '#111111' : '#ffffff') : l2

  return (
    <>
      <svg viewBox={`0 0 ${ST_FIG_W} ${ST_FIG_H}`} preserveAspectRatio="xMidYMid meet" style={{ ...SVG_STYLE, ...tf, mixBlendMode: 'screen', zIndex: 5 }} aria-hidden="true">
        {head && <Group ids={['face', 'neck']} fill={warmSkin(head.skinColor || '#c68642')} opacity={SKIN_OPACITY} />}
        {size && <Group ids={['hand']} fill={warmSkin(size.skinColor || '#c68642')} opacity={SKIN_OPACITY} />}
        {shirt && <Group ids={['jersey', 'sleeve']} fill={c1} opacity={KIT_OPACITY} />}
        {shirt && <Group ids={['collar', 'cuff']} fill={c2} opacity={TRIM_OPACITY} />}
        {legs && <Group ids={['left thigh', 'right thigh']} fill={warmSkin(legs.skinColor || '#c68642')} opacity={SKIN_OPACITY} />}
        {legs && <Group ids={['shorts']} fill={shorts} opacity={KIT_OPACITY - 0.02} />}
        {legs && <Group ids={['left sock', 'right sock']} fill={l1} opacity={KIT_OPACITY} />}
        {legs && <Group ids={['left sock top', 'right sock top']} fill={sockTop} opacity={TRIM_OPACITY} />}
        {boots && <Group ids={['left boot', 'right boot']} fill={boots.teamColor ?? '#111111'} opacity={KIT_OPACITY} />}
      </svg>
      {(shirt || legs) && (
        <svg viewBox={`0 0 ${ST_FIG_W} ${ST_FIG_H}`} preserveAspectRatio="xMidYMid meet" style={{ ...SVG_STYLE, ...tf, zIndex: 7, overflow: 'visible' }} aria-hidden="true">
          <defs>
            <clipPath id="st-jersey-clip"><path d={D.jersey} /></clipPath>
            <clipPath id="st-shorts-clip"><path d={D.shorts} /></clipPath>
          </defs>
          {/* the crest on his left breast (the right of the picture) and the number on the front; his chest is turned
              into the strike, so both lean with his shoulders */}
          {shirt && (
            <g clipPath="url(#st-jersey-clip)" style={{ pointerEvents: 'none' }}>
              <g transform="rotate(12 640 470)">
                <image href={`${dir}${shirt.team}.png`} x="668" y="372" width="50" height="50" preserveAspectRatio="xMidYMid meet" style={{ opacity: 0.95 }} />
                {shirt.number != null && (
                  <text x="628" y="590" textAnchor="middle" fontFamily="'Bebas Neue', Impact, 'Arial Black', sans-serif" fontSize="132" letterSpacing="-2"
                    fill={numFill} stroke={lightHex(numFill) ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.3)'} strokeWidth="3" paintOrder="stroke"
                    style={{ opacity: 0.92, userSelect: 'none' }}>{shirt.number}</text>
                )}
              </g>
            </g>
          )}
          {/* the crest again on the shorts, on the leg he strikes with */}
          {legs && (
            <g clipPath="url(#st-shorts-clip)" style={{ pointerEvents: 'none' }}>
              <image href={`${dir}${legs.team}.png`} x="718" y="800" width="34" height="34" preserveAspectRatio="xMidYMid meet" style={{ opacity: 0.9 }} />
            </g>
          )}
        </svg>
      )}
    </>
  )
}
