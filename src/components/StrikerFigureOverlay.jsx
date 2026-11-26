import svgRaw from '../assets/st-figure-color.svg?raw'
import { useId } from 'react'
import { curlyHair, hairOf, HAIR } from '../lib/soccerHair'

// The striker's figure (public/st-silhouette.webp), through the ball: the kit and the skin laid over the art from
// src/assets/st-figure-color.svg (one path a part, traced on the art's own seams; "left" is the left of the picture,
// so the left leg is his trailing leg and the right leg is the one on the ball). The ball is the art's, lifted to a
// white ball (BALL); the hair is the art's, in the colour of the player's own hair (below).
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

// Hair. The art's hair is a combed quiff, its comb lines drawn in, near-black. It takes the colour of the HEADING
// player's own hair (lib/soccerHair.js hairOf, read off his photo; owner 11-25): the colour goes on flat and the art's
// own hair, in grey, is laid back over it like the skin's shading (HAIR_SHADE: the art's dark hair lifted on a curve so
// its middle leaves the tone as it is, then soft-lit, and its deepest shadows, between the strands, multiplied back in:
// HAIR_DARK), the sideburn included. Black hair, and a player with no photo, keep the art's own hair.
// On a player with tight-curled hair (lib/soccerHair.js curlyHair) the comb lines look wrong, so his hair is drawn over
// the art's: his hair's colour with only the art's broad light and shade on it (the comb lines blurred away), and a
// fine grain of tiny coils, their lit tops and the shadow between them, a little either side of the tone (softer on
// light hair, owner 11-26: blond curls read as a coarse sponge).
// A bald or shaved player: the quiff is cut off the art down to a skull line (SKULL_CUT, strikerArtMask below: the
// <img> and the layers both lose it), and the scalp under it is his skin, lit from his left, with a faint stubble.
const CURL_BASE = '#17110e', CURL_HI = '#33271f', CURL_LO = '#070505'
// the part of the quiff above a shaved head's skull: everything above the skull line (from the back of the head over
// the crown to the top of the forehead, a few px inside the hair at the back and sides, the quiff's height off the top
// and the front), in a box around the head that holds nothing else
const SKULL_LINE = 'L644 168 L649 152 L657 139 L668 130 L682 123 L698 119.5 L714 119.5 L729 123 L742 129.5 L753 139 L762 151 L768 164 L772 178 L774.5 190 L776 197'
const SKULL_CUT = `M641 184 ${SKULL_LINE} L800 201 L800 90 L626 90 L626 184 Z`
const HAIR_SHADE = [2.4, 0.5]   // [amplitude, exponent] of the gamma lift (the art's hair: 10th pct grey 0.008, middle 0.04, 90th 0.145)
const HAIR_DARK = '0.3 0.72 1 1 1'
const mixHex = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)) }
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

const SVG_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none', opacity: 0.9 }   // (every colour layer 10% less, owner 11-25)
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
// (owner 11-26: more detail, the far eye especially, not more prominent): each eye also has the socket's soft shade
// under the brow, a faint fold above the lid, and a faint lower lid; the far eye is a real foreshortened eye now.
// [lash crescent, iris sliver [cx, cy, rx, ry], opacity, socket [cx, cy, rx, ry], crease, lower lid]
const EYES = [
  ['M702.4 236.2 Q716 233.2 729.6 242.0 Q716 237.9 702.4 236.2 Z', [716.6, 239.3, 3.1, 0.95], 0.6, [716, 236.6, 15, 6], 'M703.4 232.8 Q716 229.8 728.2 237.6', 'M707 241.2 Q717.4 244.4 727.6 243.4'],
  ['M743.0 241.3 Q751.4 237.7 760.0 242.2 Q751.6 240.8 743.0 241.3 Z', [751.6, 242.4, 2.9, 1.1], 0.75, [751.4, 240.0, 11.5, 6], 'M744.1 237.4 Q751.6 234.3 758.9 238.3', 'M745.8 244.6 Q752.5 246.8 758.6 245.3'],
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
const NUMBER = { cx: 667, y: 555, size: 118, tf: plane(667, 512, 0.9, -7, 4) }   // (down and left a touch, owner 11-25)
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

// the art's <img> for this build: a bald or shaved HEADING player's head loses the quiff above the skull (SKULL_CUT),
// cut out of the picture with a mask (Silhouette.jsx puts it on the striker's <img>); otherwise nothing
export function strikerArtMask(build) {
  if (hairOf(build?.basketballIQ) !== 'bald') return null
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${ST_FIG_W} ${ST_FIG_H}' preserveAspectRatio='none'><path fill-rule='evenodd' d='M0 0 H${ST_FIG_W} V${ST_FIG_H} H0 Z ${SKULL_CUT}'/></svg>`
  const m = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return { maskImage: m, WebkitMaskImage: m, maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }
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
  const hairName = head ? hairOf(head) : null
  const bald = hairName === 'bald'
  const curl = head && !bald ? curlyHair(head) : false
  // his hair's tone (null: the art's own near-black hair)
  const hairTone = hairName && !bald && hairName !== 'black' ? HAIR[hairName] : null
  // the curls: the tone, the coils' lit tops and the shadow between them (light hair: closer together)
  const curlTone = hairTone ? mixHex(hairTone, '#000000', 0.08) : CURL_BASE
  const lightCurl = hairTone && lum(hexRgb(hairTone)) > 90
  const curlHi = hairTone ? mixHex(hairTone, '#ffffff', lightCurl ? 0.1 : 0.14) : CURL_HI
  const curlLo = hairTone ? mixHex(hairTone, '#000000', lightCurl ? 0.32 : 0.45) : CURL_LO
  const shadeTone = curl ? curlTone : hairTone
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
          {/* everything but the quiff above a shaved head's skull (SKULL_CUT) */}
          <clipPath id={id('c-skull')}><path d={`M0 0 H${ST_FIG_W} V${ST_FIG_H} H0 Z ${SKULL_CUT}`} clipRule="evenodd" /></clipPath>
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
          {/* tight curls: a fine, even grain of tiny coils (two noises levelled into specks: the coils' lit tops and the
              shadow between them), soft-edged, over the tone and the art's broad shading */}
          {curl && (
            <filter id={id('curl')} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3 0 0 0 -1.5" result="hiA" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 3 0 0 -1.45" result="loA" />
              <feFlood floodColor={curlLo} />
              <feComposite in2="loA" operator="in" result="lo" />
              <feFlood floodColor={curlHi} />
              <feComposite in2="hiA" operator="in" result="hi" />
              <feMerge result="m"><feMergeNode in="lo" /><feMergeNode in="hi" /></feMerge>
              <feGaussianBlur in="m" stdDeviation="0.35" />
            </filter>
          )}
          {/* his hair's colour with the art's own hair laid over it (HAIR_SHADE, HAIR_DARK); for curls only its broad
              light and shade (blurred well past the comb lines) */}
          {shadeTone && (
            <filter id={id('f-hair')} colorInterpolationFilters="sRGB" x="0" y="0" width="1" height="1">
              <feColorMatrix type="saturate" values="0" />
              {/* (the lift would bring up the picture's compression blocks in the near-black: softened first) */}
              <feGaussianBlur stdDeviation={curl ? 3.5 : 1} />
              <feComponentTransfer result="shade">{['R', 'G', 'B'].map(c => { const F = `feFunc${c}`; return <F key={c} type="gamma" amplitude={HAIR_SHADE[0]} exponent={HAIR_SHADE[1]} offset="0" /> })}<feFuncA type="identity" /></feComponentTransfer>
              <feFlood floodColor={shadeTone} result="tone" />
              <feBlend in="shade" in2="tone" mode="soft-light" result="lit1" />
              <feBlend in="shade" in2="lit1" mode="soft-light" result="lit" />
              <feComponentTransfer in="shade" result="dark">{['R', 'G', 'B'].map(c => { const F = `feFunc${c}`; return <F key={c} type="table" tableValues={HAIR_DARK} /> })}</feComponentTransfer>
              <feBlend in="dark" in2="lit" mode="multiply" result="lit" />
              <feComposite in="lit" in2="SourceAlpha" operator="in" />
            </filter>
          )}
          {/* a shaved head's stubble: a fine grain of dark specks */}
          {bald && (
            <filter id={id('stubble')} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="7" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -1.15" result="speck" />
              <feFlood floodColor={shadeOf(face, 0.35)} />
              <feComposite in2="speck" operator="in" />
            </filter>
          )}
          {bald && <filter id={id('rim')} x="-0.2" y="-0.2" width="1.4" height="1.4"><feGaussianBlur stdDeviation="2.5" /></filter>}
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
          {/* the hair's (or a bald head's scalp's) flat tone first, stroked a little past the hairline under the face
              (EDGE), so the seam between the two can't show the art's black as a line */}
          {(shadeTone || bald) && (
            <g clipPath={bald ? url('c-skull') : undefined}>
              {[D.hair, SIDEBURN].map((d, i) => <path key={i} d={d} fill={bald ? face : shadeTone} stroke={bald ? face : shadeTone} strokeWidth={EDGE * 1.2} strokeLinejoin="round" />)}
            </g>
          )}
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
              <linearGradient id={id('fshade')} x1="660" y1="0" x2="776" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="rotate(12 730 250)">
                <stop offset="0" stopColor={shadeOf(face, 0.22)} stopOpacity="0" />
                <stop offset="0.55" stopColor={shadeOf(face, 0.22)} stopOpacity="0.72" />
                <stop offset="1" stopColor={shadeOf(face, 0.22)} stopOpacity="0.95" />
              </linearGradient>
              <rect x="620" y="170" width="170" height="160" fill={url('fshade')} />
              {/* the eyes: small, narrow and soft, deep in the shadow under his brow (EYES) */}
              <filter id={id('eyeblur')} x="-0.3" y="-1" width="1.6" height="3"><feGaussianBlur stdDeviation="0.55" /></filter>
              <g filter={url('eyeblur')}>
                {EYES.map(([lash, [ix, iy, rx, ry], a, [sx, sy, srx, sry], crease, lower], n) => (
                  <g key={n} opacity={a}>
                    <ellipse cx={sx} cy={sy} rx={srx} ry={sry} transform={`rotate(13 ${sx} ${sy})`} fill={shadeOf(face, 0.12)} opacity="0.25" />
                    <path d={crease} fill="none" stroke={shadeOf(face, 0.1)} strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
                    <path d={lower} fill="none" stroke={shadeOf(face, 0.12)} strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
                    <ellipse cx={ix} cy={iy} rx={rx} ry={ry} transform={`rotate(13 ${ix} ${iy})`} fill={shadeOf(face, 0.05)} opacity="0.7" />
                    <path d={lash} fill={shadeOf(face, 0.06)} />
                  </g>
                ))}
              </g>
              {/* (only the eyes are drawn: no brows, nose or mouth lines, owner 11-25) */}
              {/* the sideburn is hair: the art's own, or the curls or his hair's colour below (a bald head's: skin) */}
              {!curl && !hairTone && !bald && <g clipPath={url('c-burn')}><image href={ART} width={ST_FIG_W} height={ST_FIG_H} /></g>}
            </g>
          )}
          {/* his hair in its own colour: flat (above: all html.low-power keeps), then the art's hair laid over it */}
          {shadeTone && <g className="st-fx" clipPath={url('c-hair')}><image href={ART} width={ST_FIG_W} height={ST_FIG_H} filter={url('f-hair')} /></g>}
          {/* the curls' grain over it (low-power: a flat speckle-free tone) */}
          {curl && (
            <g className="st-fx" clipPath={url('c-hair')}>
              <rect x="600" y="90" width="230" height="160" filter={url('curl')} opacity={lightCurl ? 0.75 : 0.9} />
            </g>
          )}
          {/* bald or shaved: his skin where the hair was, shaded as the face is (lit from his left), with stubble */}
          {bald && (
            <g clipPath={url('c-skull')}>
              <g clipPath={url('c-hair')}>
                {/* the crown in the light (his left, as the face), the back of the head turning into shadow */}
                <radialGradient id={id('scalp')} cx="690" cy="128" r="120" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
                  <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="1" stopColor={shadeOf(face, 0.3)} stopOpacity="0.3" />
                </radialGradient>
                <rect x="600" y="90" width="230" height="160" fill={url('scalp')} />
                <rect x="600" y="90" width="230" height="160" fill={url('fshade')} opacity="0.45" />
                <rect className="st-fx" x="600" y="90" width="230" height="160" fill={face} filter={url('stubble')} opacity="0.3" />
                {/* the skull's edge turning away from the light: a soft shadow just inside the new outline */}
                <path d={`M641 184 ${SKULL_LINE}`} fill="none" stroke={shadeOf(face, 0.35)} strokeWidth="7" opacity="0.35" filter={url('rim')} />
              </g>
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
