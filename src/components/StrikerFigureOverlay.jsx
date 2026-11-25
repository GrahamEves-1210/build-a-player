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
//   speed         PACE         the shorts (the second colour; white when the shirt is white), the socks (the club's colour)
//                              with their turnover in the second colour, the bare thighs and knees
//   bounce        SHOT POWER   the boots
//   size          SIZE         the hand
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
// features (the art's eyes are lost in the shadow of his brow: he is looking down at the ball) are drawn on, small and
// soft, at the render's own scale: lowered lids in the shadow under the brow, subtle brows, the nose's underside and the mouth.
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
// the features' colour: the tone taken well down (a dark brown on light skin, near-black on dark skin)
const featureOf = tone => { const c = hexRgb(tone); return rgbHex(c.map(v => v * 0.25)) }
// the lash line and the iris, near-black brown
const LASH = '#120c09'
const IRIS = '#20140f'

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
const Group = ({ ids, fill, opacity }) => (
  <g style={{ opacity, transition: 'opacity 0.4s ease' }}>
    {ids.map(id => <path key={id} d={D[id]} fill={fill} fillRule="evenodd" />)}
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
const NUMBER = { cx: 662, y: 548, size: 118, tf: plane(662, 505, 0.9, -7, 4) }
// the crest on the front of the shorts, on the leg he strikes with (his left), low by the hem: the leg runs down to
// the right, so the crest leans with it (its uprights about 17 degrees off), and its horizontals sit level, between the hem's
// slight climb and the folds' fall. `shade`: the art's folds laid back over it ([slope, intercept] of the grey ramp, as SHADE)
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
  const shirt = chip('clutch'), legs = chip('speed'), boots = chip('bounce'), size = chip('size'), head = chip('basketballIQ')
  const dir = logoDir ?? '/logos/soccer/'

  const c1 = shirt?.teamColor ?? '#ffffff', c2 = shirt?.teamColor2 ?? '#111111'
  // the number in the trim colour, or white/black off the shirt when the trim is too close to it
  const numFill = lightHex(c1) === lightHex(c2) ? (lightHex(c1) ? '#111111' : '#ffffff') : c2

  const l1 = legs?.teamColor ?? '#ffffff', l2 = legs?.teamColor2 ?? '#111111'
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
              {/* (face and neck: the art's thin ink lines softened, its broad light and shade kept) */}
              {(k === 'face' || k === 'neck') && <feGaussianBlur stdDeviation="0.9" />}
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
          {skins.map(({ ids, tone }) => <g key={ids[0]}>{ids.map(i => <path key={i} d={D[i]} fill={tone} />)}</g>)}
          <g className="st-fx">
            {head && shade('face')}
            {head && shade('neck')}
            {size && shade('hand')}
            {legs && shade('thighs')}
            <g clipPath={url('c-ball')}><image href={ART} width={ST_FIG_W} height={ST_FIG_H} filter={url('f-ball')} /></g>
          </g>
          {head && (
            <g clipPath={url('c-face')}>
              {/* (no eye drawn: only the shadow of the socket under his brow, owner 11-25) */}
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
      </svg>
      <svg viewBox={`0 0 ${ST_FIG_W} ${ST_FIG_H}`} preserveAspectRatio="xMidYMid meet" style={{ ...SVG_STYLE, ...tf, mixBlendMode: 'screen', zIndex: 6 }} aria-hidden="true">
        {shirt && <Group ids={['jersey', 'sleeve']} fill={c1} opacity={KIT_OPACITY} />}
        {shirt && <Group ids={['collar', 'cuff']} fill={c2} opacity={TRIM_OPACITY} />}
        {legs && <Group ids={['shorts']} fill={shorts} opacity={KIT_OPACITY - 0.02} />}
        {legs && <Group ids={['left sock', 'right sock']} fill={l1} opacity={KIT_OPACITY} />}
        {legs && <Group ids={['left sock top', 'right sock top']} fill={sockTop} opacity={TRIM_OPACITY} />}
        {boots && <Group ids={['left boot', 'right boot']} fill={boots.teamColor ?? '#111111'} opacity={KIT_OPACITY} />}
      </svg>
      {(shirt || legs) && (
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
          {legs && (
            <g clipPath={url('c-shorts')} style={{ pointerEvents: 'none' }}>
              <Badge src={`${dir}${legs.team}.png`} at={SHORTS_CREST} id={id} url={url} name="shorts" />
            </g>
          )}
        </svg>
      )}
    </>
  )
}
