import svgRaw from '../assets/st-figure-color.svg?raw'
import { useId } from 'react'
import { curlyHair } from '../lib/soccerHair'

// The striker's figure (public/st-silhouette.webp), through the ball: the kit and the skin laid over the art from
// src/assets/st-figure-color.svg (one path a part, traced on the art's own seams; "left" is the left of the picture,
// so the left leg is his trailing leg and the right leg is the one on the ball). The ball is the art's, lifted to a
// white ball (BALL); the hair is the art's, except on a player with tight-curled hair (below).
// The build arrives under the basketball keys (lib/soccerUi.js SOCCER_AS_BUCKET), like the figure it replaced:
//   basketballIQ  HEADING      his face and neck (the skin of the player the trait came from, with the art's own
//                              shading and the face's features drawn on), and his hair
//   clutch        COMPOSURE    the shirt and its long sleeve in the club's colour, the collar and the cuff in its
//                              second colour, the crest on the chest and the number under it
//   handles       DRIBBLING    the shorts (the second colour; white when the shirt is white), the socks (the club's colour)
//                              with their turnover in the second colour, and the shorts' crest
//   speed         PACE         the bare thighs and knees (the skin)
//   finishing     FINISHING    the boots
//   perimeterDefense POSITIONING the hand
export const ST_FIG_W = 1024
export const ST_FIG_H = 1536

const dOf = id => svgRaw.match(new RegExp(`<path id="${id}" d="([^"]+)"`))?.[1] ?? ''
const D = Object.fromEntries(['jersey', 'collar', 'neck', 'sleeve', 'cuff', 'hand', 'shorts', 'left thigh', 'right thigh', 'left sock top',
  'right sock top', 'left sock', 'right sock', 'left boot', 'right boot', 'face', 'hair', 'ball'].map(id => [id, dOf(id)]))

// The skin (face, neck, hand, thighs) is painted in the player's own tone, not screened over the art: a screen over
// the art's near-black skin could only lift it toward a pale, greyed version of every tone (a dark-skinned player
// came out as light as a light one). So the tone goes on flat (soccerSkin below: the sampled skin colour, the deeper
// tones taken back down), and the art's own light and shade are laid back over it in soft-light (SHADE: the art in grey, levelled
// per part so its middle grey leaves the tone as it is, its shadows darken it and its lights lift it). The face's
// eyes (the art's are lost in the shadow of his brow: he is looking down at the ball) are drawn on, small and soft,
// at the render's own scale: lowered lids in the shadow under the brow (EYES).
// Every layer is cut to the art's own outline (the mask), so the flat fills never spill past him.
// html.low-power drops SVG filters (app-game.css): the filtered layers (.st-fx) are hidden there, the flat tone stays.
const SHADE = {   // [slope, intercept] of the grey ramp, measured off the art in each part (its 10th to 90th percentile)
  face: [3.6, 0.26], neck: [1.7, 0.35], hand: [2.05, 0.17], thighs: [2.1, 0.13],
}
// the grey ramp's curve: the shadows go deep, the lights lift only a little (a dark-skinned player's lit cheek
// stays dark skin, not a beige highlight)
// the face's shadows (the grey ramp's dark end down to this, its middle and lights up to white: no effect)
const FACE_DARK = '0.22 0.55 0.88 1 1 1'
const SHADE_CURVE = '0.03 0.27 0.5 0.57 0.61'
const KIT_OPACITY = 0.78
const TRIM_OPACITY = 0.82

const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const rgbHex = c => `#${c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
// the sampled colour (a photo's skin, lit and shaded together) as the figure's flat tone (soccer only: football keeps
// warmSkin, footballSkin.js)
export function soccerSkin(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex ?? '')) hex = '#a67f6b'
  const c = hexRgb(hex)
  // the samples come off lit photos: the deeper the tone, the more the light has lifted it, so the deeper tones are
  // brought back down (the deepest by a fifth, the lightest barely)
  const k = 0.8 + 0.18 * Math.max(0, Math.min(1, (lum(c) - 75) / 110))
  return rgbHex([c[0] * k + 3, c[1] * k, c[2] * k])
}
// the eyes' colour: the skin's own tone taken well down (a warm dark brown on light skin, near-black on dark skin),
// so the lash line darkens the skin in its own hue (a neutral near-black read grey-green over a light tone)
const shadeOf = (tone, k) => { const c = hexRgb(tone); return rgbHex([c[0] * k * 1.3, c[1] * k, c[2] * k * 0.8]) }   // (warmed: a shadow on skin is warmer than its tone)

// Hair. The art's hair is a combed quiff, its comb lines drawn in. On a player with tight-curled hair (whose:
// lib/soccerHair.js, from the players' photos) those lines look wrong, so his hair is drawn over the art's: solid,
// with a short, tight-curl grain (the curl filter below), the sideburn by the ear included. Everyone else keeps the
// art's hair.
const CURL_BASE = '#17110e', CURL_HI = '#33271f'
// the ball's white panels up to white, its black panels left black (the grey ramp, as SHADE)
const BALL = [4.2, 0.08]

const lightHex = hex => {
  if (!/^#[0-9a-f]{6}$/i.test(hex ?? '')) return false
  const n = i => parseInt(hex.slice(i, i + 2), 16)
  return 0.299 * n(1) + 0.587 * n(3) + 0.114 * n(5) > 200
}

const whiteHex = hex => /^#[0-9a-f]{6}$/i.test(hex ?? '') && [1, 3, 5].every(i => parseInt(hex.slice(i, i + 2), 16) > 215)

// parts that share a colour go in one group at the group's opacity: where two of them meet (the shoulder seam) the
// fills can't double up into a bright line
// Each part's fill is also stroked in its own colour (EDGE, art px), a hair past its traced edge: where two parts
// meet, each one's anti-aliased edge only half covers the seam pixel, so the art's near-black showed through as a
// thin dark line round every part (the outline the owner saw, 11-25); the overlap closes it. The figure's own
// outline is kept by the art's mask. (The skin isn't stroked: under a kit part it would screen up into a light line.)
const EDGE = 1.6
const Group = ({ ids, fill, opacity, mask }) => (
  <g mask={mask} style={{ opacity, transition: 'opacity 0.4s ease' }}>
    {ids.map(id => <path key={id} d={D[id]} fill={fill} fillRule="evenodd" stroke={fill} strokeWidth={EDGE} strokeLinejoin="round" />)}
  </g>
)

const SVG_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }
const ART = '/st-silhouette.webp'

// the face's features, on the art's own face (art pixels), kept to the scale and softness of the render: he looks
// down at the ball, so each eye is a lowered lid, a thin dark lash line in a soft shadow under the brow, and the
// far eye only a short one past the bridge of the nose (x 740). The brows are short, tapered and low-contrast, on
// the brow ridge. The softness comes from gradients and low opacity (the brows' slight blur is the one filter, and
// html.low-power only loses that blur).
// each eye, as the owner's reference (a player looking down at the ball): an almond opening with a hint of white,
// the dark iris half under a heavy lowered upper lid (its lash line the darkest stroke), a faint lower lid and a soft
// crease above. [opening, iris [cx, cy, r], upper lid, lower lid, crease]
// the eyes (owner 11-25: "small and narrow and faded and blended, not cartoony"): he looks down at the ball, so each
// is only the lowered lid's lash line, a thin dark crescent tapering at both corners and sloping down toward the nose
// with the tilt of his head, with a sliver of dark iris under it; no white, no outline, blurred and faint so it sits in
// the art's own shadow under the brow. The far eye is a short one past the bridge of the nose (x 740).
// [lash crescent, iris sliver [cx, cy, rx, ry], opacity]
const EYES = [
  ['M702.4 238.2 Q716 235.4 729.6 244 Q716 239.8 702.4 238.2 Z', [716.4, 241.2, 3, 0.95], 0.6],
  ['M746 243.6 Q751 241.9 756.2 244.2 Q751 243.6 746 243.6 Z', [751, 244.1, 1.6, 0.6], 0.45],
]
// the sideburn and the hair at the temple, between the ear and the forehead (inside the face's path; the hair's
// path stops at the hairline), traced on the art's own dark hair: it runs to x 697 down to the corner of the brow
// before turning back to the point of the sideburn
const SIDEBURN = 'M650 183 L700.5 175.5 L699 183 L698 191 L696.6 197.6 L691.6 201.8 L684 204.4 L677.4 208.4 L672.4 213.4 L668.6 219 L667 222.6 L662 212 L658 198 Z'

// the chest's plane, for the crest and the number: he is turned into the strike, his chest facing the right of the
// picture, so his left breast (the right of the picture) is foreshortened and the shirt's horizontals there climb
// toward his far side (about 5 degrees, off the folds across his chest). Each is drawn flat at its spot and set into
// that plane (narrowed across, sheared up), the crest at a real kit crest's size.
const plane = (cx, cy, sx, skew, rot = 0) => `translate(${cx} ${cy}) rotate(${rot}) skewY(${skew}) scale(${sx} 1) translate(${-cx} ${-cy})`
const CREST = { cx: 714, cy: 400, size: 36, tf: plane(714, 400, 0.8, -9, 4), shade: [2.0, 0.22] }
const NUMBER = { cx: 655, y: 555, size: 118, tf: plane(655, 512, 0.9, -7, 4) }   // (down and left a touch, owner 11-25)
// the crest on the front of the shorts, on the leg he strikes with (his left), low by the hem: the leg runs down to
// the right, so the crest leans with it (its uprights about 17 degrees off), and its horizontals sit level, between the hem's
// slight climb and the folds' fall. `shade`: the art's folds laid back over it ([slope, intercept] of the grey ramp, as SHADE)
// the inside of the shorts, seen up the leg openings under the hems (the trailing leg's hem and the gap by the
// standing leg's thigh), traced on the art's own edges: the art there is near-black, the shorts' fill is kept off it
// (screen only lightens), so it stays the black of the lining with the art's own shading. The sides on the thighs
// and the outline run a little past them: the thighs are on the other layer, the outline is masked by the art.
const UNDER_SHORTS = 'M324.2 858.3 L333.3 850.3 L335 865 L340.8 881.7 L351.7 898.3 L366.7 910.8 L385 920 L405 926.7 L431.7 930 L433.3 940 L403.3 945 L381.7 938.3 L363.3 926.7 L347.5 912.5 L334.2 895.8 L325.3 880 Z M720 878.3 L715 882.5 L693.3 890 L672.5 897 L657.5 904.5 L649 913 L642 923 L636.5 934.5 L634 945.5 L635 957 L638 964.5 L642 969.5 L652 977 L663.3 981.7 L686.7 983.3 L675 968.3 L665.8 958.3 L661.7 945 L660.8 928.3 L665.8 915.8 L677.5 904.2 L695 895 L723.3 886.7 L724.2 880 Z'
const SHORTS_CREST = { cx: 760, cy: 850, size: 24, tf: 'translate(760 850) rotate(-3) skewX(14) scale(0.9 1) translate(-760 -850)', shade: [2.2, 0.3] }

// a crest (or flag) set into the cloth at `at`: drawn flat, put in the cloth's plane, and the art's own folds and
// shading laid back over it in soft-light (that layer is .st-fx: html.low-power drops it with the filters)
function Badge({ src, at, id, url, name }) {
  const img = <image href={src} x={at.cx - at.size / 2} y={at.cy - at.size / 2} width={at.size} height={at.size} transform={at.tf} preserveAspectRatio="xMidYMid meet" />
  const [m, b] = at.shade
  return (
    <>
      <defs>
        <mask id={id(`m-${name}`)} style={{ maskType: 'alpha' }}>{img}</mask>
        <filter id={id(`f-${name}`)} colorInterpolationFilters="sRGB" x="0" y="0" width="1" height="1">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer><feFuncR type="linear" slope={m} intercept={b} /><feFuncG type="linear" slope={m} intercept={b} /><feFuncB type="linear" slope={m} intercept={b} /></feComponentTransfer>
        </filter>
      </defs>
      <g style={{ opacity: 0.94 }}>{img}</g>
      <g className="st-fx" mask={url(`m-${name}`)} style={{ mixBlendMode: 'soft-light' }}>
        <image href={ART} width={ST_FIG_W} height={ST_FIG_H} filter={url(`f-${name}`)} />
      </g>
    </>
  )
}

// `box`: where the art is drawn in its wrap ({ left, top, width, height }, the same box the <img> gets), so both
// layers sit on it exactly. They are placed, not wrapped or scaled: the colour layer has to stay in the picture's
// own stacking context to screen over it. Left out, the layers fill the wrap.
export default function StrikerFigureOverlay({ build, logoDir = null, box = null }) {
  const tf = box ? { inset: 'auto', ...box } : null
  const chip = s => build?.[s] ?? null
  // (owner 11-25: COMPOSURE the shirt, DRIBBLING the shorts and socks, PACE the legs' skin, FINISHING the boots, POSITIONING the hand, HEADING the head)
  const shirt = chip('clutch'), kit = chip('handles'), legs = chip('speed'), boots = chip('finishing'), size = chip('perimeterDefense'), head = chip('basketballIQ')
  const dir = logoDir ?? '/logos/soccer/'

  const c1 = shirt?.teamColor ?? '#ffffff', c2 = shirt?.teamColor2 ?? '#111111'
  // the number in the trim colour, or white/black off the shirt when the trim is too close to it
  const numFill = lightHex(c1) === lightHex(c2) ? (lightHex(c1) ? '#111111' : '#ffffff') : c2

  const l1 = kit?.teamColor ?? '#ffffff', l2 = kit?.teamColor2 ?? '#111111'
  // white shorts under a white shirt; any other shirt (a yellow one too: Dortmund, Brazil) takes the second colour
  const shorts = whiteHex(l1) ? l1 : l2
  const sockTop = lightHex(l1) === lightHex(l2) ? (lightHex(l1) ? '#111111' : '#ffffff') : l2

  const uid = useId().replace(/:/g, '')
  const id = n => `st${uid}${n}`
  const url = n => `url(#${id(n)})`
  const face = head ? soccerSkin(head.skinColor) : null
  const curl = head ? curlyHair(head) : false
  const skins = [
    head && { ids: ['face', 'neck'], tone: face },
    size && { ids: ['hand'], tone: soccerSkin(size.skinColor) },
    legs && { ids: ['left thigh', 'right thigh'], tone: soccerSkin(legs.skinColor) },
  ].filter(Boolean)
  const tones = { face, neck: face, hand: size && soccerSkin(size.skinColor), thighs: legs && soccerSkin(legs.skinColor) }
  // a part's shading: the art in grey, levelled (SHADE), soft-lit onto the part's tone in the filter itself
  const shade = key => (
    <g clipPath={url(`c-${key}`)}>
      <image href={ART} width={ST_FIG_W} height={ST_FIG_H} filter={url(`f-${key}`)} />
    </g>
  )

  return (
    <>
      <svg viewBox={`0 0 ${ST_FIG_W} ${ST_FIG_H}`} preserveAspectRatio="xMidYMid meet" style={{ ...SVG_STYLE, ...tf, zIndex: 5 }} aria-hidden="true">
        <defs>
          <mask id={id('art')} style={{ maskType: 'alpha' }}><image href={ART} width={ST_FIG_W} height={ST_FIG_H} /></mask>
          {[['face', ['face']], ['neck', ['neck']], ['hand', ['hand']], ['thighs', ['left thigh', 'right thigh']], ['ball', ['ball']], ['hair', ['hair']]].map(([k, ids]) => (
            <clipPath key={k} id={id(`c-${k}`)}>{ids.map(i => <path key={i} d={D[i]} />)}{k === 'hair' && <path d={SIDEBURN} />}</clipPath>
          ))}
          <clipPath id={id('c-burn')}><path d={SIDEBURN} /></clipPath>
          {Object.entries(SHADE).filter(([k]) => tones[k]).map(([k, [m, b]]) => (
            <filter key={k} id={id(`f-${k}`)} colorInterpolationFilters="sRGB" x="0" y="0" width="1" height="1">
              <feColorMatrix type="saturate" values="0" />
              {/* (face and neck: the art's thin ink lines softened, its broad light and shade kept; the neck's more, so the
                  shadow under the jaw is a soft shade, not a dark line round the jaw) */}
              {(k === 'face' || k === 'neck') && <feGaussianBlur stdDeviation={k === 'neck' ? 2 : 0.9} />}
              <feComponentTransfer result="shade"><feFuncR type="linear" slope={m} intercept={b} /><feFuncG type="linear" slope={m} intercept={b} /><feFuncB type="linear" slope={m} intercept={b} /><feFuncA type="identity" /></feComponentTransfer>
              <feFlood floodColor={tones[k]} result="tone" />
              <feComponentTransfer in="shade" result="shade2">{['R', 'G', 'B'].map(c => { const F = `feFunc${c}`; return <F key={c} type="table" tableValues={SHADE_CURVE} /> })}</feComponentTransfer>
              <feBlend in="shade2" in2="tone" mode="soft-light" result="lit1" />
              <feBlend in="shade2" in2="lit1" mode="soft-light" result="lit" />
              {/* the face: the art's own shadows (the eyes deep in the shade of his brow, under the cheekbone) multiplied
                  back in, its lights left alone, so the face is shaded as the art draws it */}
              {k === 'face' && <feComponentTransfer in="shade" result="dark">{['R', 'G', 'B'].map(c => { const F = `feFunc${c}`; return <F key={c} type="table" tableValues={FACE_DARK} /> })}</feComponentTransfer>}
              {k === 'face' && <feBlend in="dark" in2="lit" mode="multiply" result="lit" />}
              <feComposite in="lit" in2="SourceAlpha" operator="in" />
            </filter>
          ))}
          {/* the ball: its white panels up to white, the black ones kept black */}
          <filter id={id('f-ball')} colorInterpolationFilters="sRGB" x="0" y="0" width="1" height="1">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncR type="linear" slope={BALL[0]} intercept={BALL[1]} /><feFuncG type="linear" slope={BALL[0]} intercept={BALL[1]} /><feFuncB type="linear" slope={BALL[0]} intercept={BALL[1]} /></feComponentTransfer>
          </filter>
          {/* tight curls: a fine, even grain of tiny coils (noise, levelled into specks) in a lighter brown-black */}
          <filter id={id('curl')} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="2" seed="4" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.2 0 0 0 -1.45" result="speck" />
            <feFlood floodColor={CURL_HI} />
            <feComposite in2="speck" operator="in" result="hi" />
            <feFlood floodColor={CURL_BASE} />
            <feMerge><feMergeNode /><feMergeNode in="hi" /></feMerge>
          </filter>
        </defs>
        <g mask={url('art')}>
          {skins.filter(s => s.ids[0] !== 'face').map(({ ids, tone }) => <g key={ids[0]}>{ids.map(i => <path key={i} d={D[i]} fill={tone} />)}</g>)}
          <g className="st-fx">
            {size && shade('hand')}
            {legs && shade('thighs')}
            <g clipPath={url('c-ball')}><image href={ART} width={ST_FIG_W} height={ST_FIG_H} filter={url('f-ball')} /></g>
          </g>
          {/* the head (face, neck, features, hair) as one layer, 10% see-through (owner 11-25) */}
          <g opacity="0.9">
          {head && <g>{['face', 'neck'].map(i => <path key={i} d={D[i]} fill={face} />)}</g>}
          {/* the jaw: the face stroked a hair over its seam with the neck (only there), so the hairline gap between the
              two can't show the art's black through it as a line round the jaw (EDGE) */}
          {head && (
            <>
              <mask id={id('m-jaw')} maskUnits="userSpaceOnUse" x="0" y="0" width={ST_FIG_W} height={ST_FIG_H}><path d={D.neck} fill="#fff" stroke="#fff" strokeWidth="4" /></mask>
              <path d={D.face} fill="none" stroke={face} strokeWidth={EDGE * 1.5} mask={url('m-jaw')} />
            </>
          )}
          <g className="st-fx">
            {head && shade('face')}
            {head && shade('neck')}
          </g>
          {head && (
            <g clipPath={url('c-face')}>
              {/* the right side of his face in shadow (the light is on his left): a soft fall-off across the face, in a
                  dark of his own skin, no edge anywhere (owner 11-25) */}
              <linearGradient id={id('fshade')} x1="672" y1="0" x2="776" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="rotate(12 730 250)">
                <stop offset="0" stopColor={shadeOf(face, 0.3)} stopOpacity="0" />
                <stop offset="0.55" stopColor={shadeOf(face, 0.3)} stopOpacity="0.55" />
                <stop offset="1" stopColor={shadeOf(face, 0.3)} stopOpacity="0.82" />
              </linearGradient>
              <rect x="620" y="170" width="170" height="160" fill={url('fshade')} />
              {/* the eyes: small, narrow and soft, deep in the shadow under his brow (EYES) */}
              <filter id={id('eyeblur')} x="-0.3" y="-1" width="1.6" height="3"><feGaussianBlur stdDeviation="0.55" /></filter>
              <g filter={url('eyeblur')}>
                {EYES.map(([lash, [ix, iy, rx, ry], a], n) => (
                  <g key={n} opacity={a}>
                    <ellipse cx={ix} cy={iy} rx={rx} ry={ry} transform={`rotate(13 ${ix} ${iy})`} fill={shadeOf(face, 0.12)} opacity="0.6" />
                    <path d={lash} fill={shadeOf(face, 0.2)} />
                  </g>
                ))}
              </g>
              {/* (only the eyes are drawn: no brows, nose or mouth lines, owner 11-25) */}
              {/* the sideburn is hair: the art's own, or the curls below */}
              {!curl && <g clipPath={url('c-burn')}><image href={ART} width={ST_FIG_W} height={ST_FIG_H} /></g>}
            </g>
          )}
          {curl && (
            <g clipPath={url('c-hair')}>
              <rect x="600" y="90" width="230" height="160" fill={CURL_BASE} filter={url('curl')} />
            </g>
          )}
          </g>
        </g>
      </svg>
      <svg viewBox={`0 0 ${ST_FIG_W} ${ST_FIG_H}`} preserveAspectRatio="xMidYMid meet" style={{ ...SVG_STYLE, ...tf, mixBlendMode: 'screen', zIndex: 6 }} aria-hidden="true">
        <defs>
          <mask id={id('art2')} style={{ maskType: 'alpha' }}><image href={ART} width={ST_FIG_W} height={ST_FIG_H} /></mask>
          <filter id={id('soft')} x="-0.1" y="-0.1" width="1.2" height="1.2"><feGaussianBlur stdDeviation="0.8" /></filter>
          <mask id={id('under')} maskUnits="userSpaceOnUse" x="0" y="0" width={ST_FIG_W} height={ST_FIG_H}>
            <rect width={ST_FIG_W} height={ST_FIG_H} fill="#fff" />
            <path d={UNDER_SHORTS} fill="#000" filter={url('soft')} />
          </mask>
        </defs>
        <g mask={url('art2')}>
        {shirt && <Group ids={['jersey', 'sleeve']} fill={c1} opacity={KIT_OPACITY} />}
        {shirt && <Group ids={['collar', 'cuff']} fill={c2} opacity={TRIM_OPACITY} />}
        {kit && <Group ids={['shorts']} fill={shorts} opacity={KIT_OPACITY - 0.02} mask={url('under')} />}
        {kit && <Group ids={['left sock', 'right sock']} fill={l1} opacity={KIT_OPACITY} />}
        {kit && <Group ids={['left sock top', 'right sock top']} fill={sockTop} opacity={TRIM_OPACITY} />}
        {boots && <Group ids={['left boot', 'right boot']} fill={boots.teamColor ?? '#111111'} opacity={KIT_OPACITY} />}
        </g>
      </svg>
      {(shirt || kit) && (
        <svg viewBox={`0 0 ${ST_FIG_W} ${ST_FIG_H}`} preserveAspectRatio="xMidYMid meet" style={{ ...SVG_STYLE, ...tf, zIndex: 7, overflow: 'visible' }} aria-hidden="true">
          <defs>
            <clipPath id={id('c-jersey')}><path d={D.jersey} /></clipPath>
            <clipPath id={id('c-shorts')}><path d={D.shorts} /></clipPath>
          </defs>
          {/* the crest on his left breast and the number on the front, each set into the chest's plane (CREST, NUMBER) */}
          {shirt && (
            <g clipPath={url('c-jersey')} style={{ pointerEvents: 'none' }}>
              <Badge src={`${dir}${shirt.team}.png`} at={CREST} id={id} url={url} name="chest" />
              {shirt.number != null && (
                <text x={NUMBER.cx} y={NUMBER.y} transform={NUMBER.tf} textAnchor="middle" fontFamily="'Bebas Neue', Impact, 'Arial Black', sans-serif" fontSize={NUMBER.size} letterSpacing="-1"
                  fill={numFill} stroke={lightHex(numFill) ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.3)'} strokeWidth="3" paintOrder="stroke"
                  style={{ opacity: 0.92, userSelect: 'none' }}>{shirt.number}</text>
              )}
            </g>
          )}
          {/* the crest again, on the front of the shorts (SHORTS_CREST) */}
          {kit && (
            <g clipPath={url('c-shorts')} style={{ pointerEvents: 'none' }}>
              <Badge src={`${dir}${kit.team}.png`} at={SHORTS_CREST} id={id} url={url} name="shorts" />
            </g>
          )}
        </svg>
      )}
    </>
  )
}
