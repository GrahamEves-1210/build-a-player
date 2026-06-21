import svgRaw from '../assets/qb-figure-color.svg?raw'

const BASE_SVG = (() => {
  let html = svgRaw
  html = html.replace(
    '<svg version="1.2"',
    '<svg id="qb-fg" version="1.2" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision"'
  )
  html = html.replace(/<style>([\s\S]*?)<\/style>/, (_, inner) => {
    const scoped = inner.replace(/\.(s\d+)/g, '#qb-fg .$1')
    return `<style>${scoped}</style>`
  })
  return html
})()

const HELMET_SHELL = 'M244.5 120.156L256 128.656L276 134.656L287 130.156C284.333 129.156 278.4 126.556 276 124.156C273 121.156 277.5 109.156 279 109.156C280.2 109.156 280.833 102.489 281 99.1556L276 89.1556L260.5 79.6556C252.1 72.0556 258.333 62.8222 262.5 59.1556L292 60.1556L322.5 53.1556V44.6556H345.5V43.1556C333.5 5.95558 298.167 -0.677753 282 0.65558C226.8 3.45558 212.667 44.4889 212.5 64.6556L215 68.6556C213.4 73.4556 219.333 93.9889 222.5 103.656V107.656V113.656L228.5 121.656H237.5L244.5 120.156Z'

const SVG_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%' }
const TR = { transition: 'fill .5s ease' }

// Teams whose helmet color differs from their primary team color
const HELMET_COLOR_OVERRIDE = {
  SF:  '#B3995D', // 49ers gold
  CHI: '#10192e', // Bears darker navy
  BUF: '#FFFFFF', // Bills white
  DEN: '#001A57', // Broncos darker blue
  TB:  '#A5ACAF', // Buccaneers silver
  ARI: '#FFFFFF', // Cardinals white
  IND: '#FFFFFF', // Colts white
  LAC: '#FFFFFF', // Chargers white
  DAL: '#98A4AE', // Cowboys silver
  ATL: '#1a1a1a', // Falcons black
  CAR: '#A5ACAF', // Panthers silver
  NE:  '#A5ACAF', // Patriots silver
  TEN: '#FFFFFF', // Titans white
  PIT: '#1a1a1a', // Steelers black
  LAR: '#003594', // Rams blue
  MIN: '#4F2683', // Vikings purple
}

// Teams with custom helmet markings instead of logo
const NO_HELMET_LOGO = new Set(['CLE', 'CIN', 'LAR', 'MIN'])

const helmColor = (team, fallback) => HELMET_COLOR_OVERRIDE[team] ?? fallback


export default function QBFigureOverlay({ build, className }) {
  const tc  = (s) => build?.[s]?.teamColor  ?? 'transparent'
  const tc2 = (s) => build?.[s]?.teamColor2 ?? 'transparent'
  const sk  = (s) => build?.[s]?.skinColor  ?? 'transparent'
  const has = (s) => !!build?.[s]

  const css = `
    /* Decision Making (football-iq): chin = skin darkened + blur, neck = skin */
    #qb-fg [id="chin"] path {
      fill: ${sk('football-iq')} !important; stroke: none !important;
      transition: fill .5s ease; filter: url(#skin-tex) brightness(0.45) blur(0.8px);
    }
    #qb-fg [id="Neck"] {
      fill: ${sk('football-iq')} !important; stroke: none !important;
      transition: fill .5s ease; filter: url(#skin-tex);
    }

    /* Size (strength): chest = team color, shirt = white — jersey texture */
    #qb-fg [id="chest"] {
      fill: url(#chest-grad) !important; stroke: none !important;
      transition: fill .5s ease;
    }
    #qb-fg [id="Belt"] {
      fill: ${tc('mobility')} !important; stroke: none !important; transition: fill .5s ease;
      filter: blur(4px); opacity: 0.45;
    }
    #qb-fg [id="shirt"] {
      fill: ${has('strength') ? '#111111' : 'transparent'} !important; stroke: none !important;
      transition: fill .5s ease; filter: url(#jersey-tex);
    }

    /* Arm (arm-strength): sleeve = white, shoulders = team color — jersey texture */
    #qb-fg [id="left sleeve"] {
      fill: ${has('arm-strength') ? '#d8d8d8' : 'transparent'} !important; opacity: 1 !important; stroke: none !important;
      transition: fill .5s ease; filter: url(#jersey-tex) brightness(0.92);
    }
    #qb-fg [id="right shoulder"], #qb-fg [id="Left shoulder"] {
      fill: ${tc('arm-strength')} !important; stroke: none !important;
      transition: fill .5s ease; filter: url(#jersey-tex);
    }

    /* Accuracy: hands = skin with displacement, forearm = skin darker + blur + displacement */
    #qb-fg [id="Right hand"] {
      fill: ${sk('accuracy')} !important; stroke: none !important;
      transition: fill .5s ease; filter: url(#skin-tex);
    }
    #qb-fg [id="Left hand"] path {
      fill: ${has('accuracy') ? sk('accuracy') : '#000000'} !important; stroke: none !important;
      transition: fill .5s ease; filter: url(#skin-tex);
    }
    #qb-fg [id="forearm"] {
      fill: ${sk('accuracy')} !important; stroke: none !important;
      transition: fill .5s ease; filter: url(#skin-tex) brightness(0.82) blur(0.8px);
    }

    /* Legs (mobility): pants = team color + jersey tex, calves/socks = off-white, feet = white */
    #qb-fg [id="Legs"] {
      fill: ${tc('mobility')} !important; stroke: none !important;
      transition: fill .5s ease; filter: url(#jersey-tex);
    }
    #qb-fg [id="right calf"] path, #qb-fg [id="left calf"] path {
      fill: ${has('mobility') ? '#1c1c1c' : 'transparent'} !important; stroke: none !important;
      transition: fill .5s ease; filter: url(#jersey-tex) blur(0.5px);
    }
    #qb-fg [id="Right sock"], #qb-fg [id="Left sock"] {
      fill: ${has('mobility') ? '#1c1c1c' : 'transparent'} !important; stroke: none !important;
      transition: fill .5s ease; filter: blur(0.5px);
    }
    #qb-fg [id="Right foot"], #qb-fg [id="Left foot"] {
      fill: url(#shoe-grad) !important; stroke: none !important;
      transition: opacity .5s ease; opacity: ${has('mobility') ? '1' : '0'};
    }
  `

  return (
    <>
      {/* Filter + gradient defs — zero-size, never visible */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        <defs>
          {/* Jersey fabric texture */}
          <filter id="jersey-tex" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.62 0.38" numOctaves="1" seed="7" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
            <feComponentTransfer in="gray" result="softgray">
              <feFuncR type="linear" slope="0.12" intercept="0.88" />
              <feFuncG type="linear" slope="0.12" intercept="0.88" />
              <feFuncB type="linear" slope="0.12" intercept="0.88" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="softgray" mode="multiply" result="blended" />
            <feComposite in="blended" in2="SourceGraphic" operator="in" />
          </filter>

          {/* Skin surface displacement */}
          <filter id="skin-tex" x="-3%" y="-3%" width="106%" height="106%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.85 0.65" numOctaves="4" seed="12" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>

          {/* Helmet gloss highlight */}
          <radialGradient id="helm-gloss" cx="36%" cy="30%" r="58%">
            <stop offset="0%" stopColor="white" stopOpacity="0.28" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          {/* Torso gradient — team color full opacity at top, slightly transparent at bottom (darkens via screen blend) */}
          <linearGradient id="chest-grad" x1="0" y1="150" x2="0" y2="415" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={tc('strength')} stopOpacity="1" />
            <stop offset="100%" stopColor={tc('strength')} stopOpacity="0.72" />
          </linearGradient>

          {/* Shoe gradient — dark charcoal at top, team color at sole */}
          <linearGradient id="shoe-grad" x1="0" y1="805" x2="0" y2="844" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1c1c1c" />
            <stop offset="100%" stopColor={tc('mobility')} />
          </linearGradient>
        </defs>
      </svg>

      <style>{css}</style>

      <div className={className} style={{ mixBlendMode: 'screen' }}>
        <div style={SVG_STYLE} dangerouslySetInnerHTML={{ __html: BASE_SVG }} />

        {/* Jersey number — after BASE_SVG in DOM so it paints on top */}
        <svg viewBox="0 0 622 844" preserveAspectRatio="xMidYMid meet"
             style={SVG_STYLE} aria-hidden="true">
          {/* Chest number */}
          <text
            x="298" y="340"
            textAnchor="middle"
            transform="rotate(-3, 298, 340)"
            fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
            fontSize="117"
            fill="white"
            stroke="black"
            strokeWidth="8"
            paintOrder="stroke"
            style={{
              opacity: has('strength') ? 1 : 0,
              transition: 'opacity 0.5s ease',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >{build?.['strength']?.number ?? ''}</text>

          {/* Left shoulder number (viewer left, QB right arm) */}
          <g transform="translate(181, 148) scale(1.6, 0.32) rotate(84)"
             style={{ opacity: has('strength') ? 1 : 0, transition: 'opacity 0.5s ease' }}>
            <text
              x="0" y="0"
              textAnchor="middle"
              fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
              fontSize="37"
              fill="white"
              stroke="black"
              strokeWidth="3"
              paintOrder="stroke"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >{build?.['strength']?.number ?? ''}</text>
          </g>

          {/* Right shoulder number (viewer right, QB left arm) */}
          <g transform="translate(409, 136.5) scale(1.6, 0.32) rotate(-84)"
             style={{ opacity: has('strength') ? 1 : 0, transition: 'opacity 0.5s ease' }}>
            <text
              x="0" y="0"
              textAnchor="middle"
              fontFamily="'Bebas Neue', Impact, Arial, sans-serif"
              fontSize="37"
              fill="white"
              stroke="black"
              strokeWidth="3"
              paintOrder="stroke"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >{build?.['strength']?.number ?? ''}</text>
          </g>

          {/* NFL shield — upper left thigh, shows when Legs slot filled */}
          {has('mobility') && (
            <g transform="rotate(11, 246, 434)" style={{ pointerEvents: 'none' }}>
              <image
                href="/logos/nfl.png"
                x="237" y="425" width="19" height="19"
                style={{ opacity: 0.85 }}
              />
            </g>
          )}

          {/* Captain C badge — left chest, shows when leadership QB is a captain */}

          {/* Tiny NFL shield — shows when Size/body slot filled */}
          {has('strength') && (
            <image
              href="/logos/nfl.png"
              x="273" y="182" width="14" height="14"
              style={{ opacity: 0.85, pointerEvents: 'none' }}
            />
          )}

          {/* Team logo — right shoulder pad (arm-strength team) */}
          {has('arm-strength') && build['arm-strength'].team && (
            <g transform="rotate(-10, 409, 136)" style={{ pointerEvents: 'none' }}>
              <image
                href={`/logos/${build['arm-strength'].team}.png`}
                x="393" y="148" width="43" height="43"
                style={{ opacity: 1, mixBlendMode: 'screen' }}
              />
            </g>
          )}
        </svg>

        {/* Helmet + gloss — z-index 3, above number */}
        <svg viewBox="0 0 622 844" preserveAspectRatio="xMidYMid meet"
             style={{ ...SVG_STYLE, zIndex: 3 }} shapeRendering="geometricPrecision" aria-hidden="true">
          <defs>
            <clipPath id="helmet-logo-clip">
              <path d={HELMET_SHELL} />
            </clipPath>
          </defs>
          <path d={HELMET_SHELL}
            fill={has('football-iq') ? helmColor(build['football-iq'].team, tc('football-iq')) : 'transparent'}
            style={TR} />

          {/* Standard team logo */}
          {has('football-iq') && build['football-iq'].team && !NO_HELMET_LOGO.has(build['football-iq'].team) && (
            <g transform="rotate(-8, 262, 40)" clipPath="url(#helmet-logo-clip)" style={{ pointerEvents: 'none' }}>
              <image
                href={`/logos/${build['football-iq'].team}.png`}
                x="210" y="-2" width="80" height="80"
                style={{ mixBlendMode: 'screen', opacity: 1, transition: 'opacity 0.5s ease' }}
              />
            </g>
          )}

          {/* Bengals — black tiger claw stripes */}
          {has('football-iq') && build['football-iq'].team === 'CIN' && (
            <g clipPath="url(#helmet-logo-clip)" style={{ pointerEvents: 'none' }}>
              <path d="M 182 0 C 166 22 194 58 232 94 Q 235 100 239 90 C 217 56 178 16 189 0 Z" fill="#000" opacity="0.92" />
              <path d="M 208 0 C 192 22 220 58 258 94 Q 261 100 265 90 C 243 56 204 16 215 0 Z" fill="#000" opacity="0.92" />
              <path d="M 248 0 C 232 22 260 58 298 94 Q 301 100 305 90 C 283 56 244 16 255 0 Z" fill="#000" opacity="0.92" />
              <path d="M 290 0 C 274 22 302 58 342 92 Q 345 98 349 88 C 327 54 284 14 297 0 Z" fill="#000" opacity="0.92" />
              <path d="M 332 0 C 316 20 342 54 378 86 Q 381 92 385 82 C 363 52 322 14 339 0 Z" fill="#000" opacity="0.92" />
              <path d="M 372 0 C 356 18 376 52 418 91 Q 424 97 428 87 C 412 57 362 12 378 0 Z" fill="#000" opacity="0.92" />
              <path d="M 408 0 C 394 16 412 46 448 72 Q 451 78 455 68 C 439 44 395 10 415 0 Z" fill="#000" opacity="0.92" />
            </g>
          )}

          {/* Rams — curling ram horn from right side */}
          {has('football-iq') && build['football-iq'].team === 'LAR' && (
            <g clipPath="url(#helmet-logo-clip)" style={{ pointerEvents: 'none' }}>
              {/* Horn outer edge — starts at right, sweeps left and curls down */}
              <path d="
                M 435 10
                C 380 -8 300 5 255 45
                C 225 70 218 98 230 108
                C 238 90 252 70 278 52
                C 310 30 358 18 400 28
                C 424 34 438 55 428 78
                C 420 96 398 106 372 106
                C 350 106 336 96 330 88
                C 336 104 358 116 386 112
                C 420 106 448 82 448 50
                C 448 24 442 14 435 10 Z"
                fill="#FFC62F" style={{ transition: 'opacity 0.5s ease' }} />
            </g>
          )}

          {/* Vikings — yellow horn shapes on sides */}
          {has('football-iq') && build['football-iq'].team === 'MIN' && (
            <g clipPath="url(#helmet-logo-clip)" style={{ pointerEvents: 'none' }}>
              {/* Left horn */}
              <path d="M 214 75 Q 222 55 230 42 Q 234 36 238 38 Q 235 50 228 65 Q 224 74 220 80 Z"
                fill="#FFC62F" style={{ transition: 'opacity 0.5s ease' }} />
              {/* Right horn */}
              <path d="M 330 60 Q 338 42 344 30 Q 347 24 350 26 Q 348 38 340 54 Q 336 62 332 68 Z"
                fill="#FFC62F" style={{ transition: 'opacity 0.5s ease' }} />
            </g>
          )}

          <path d={HELMET_SHELL} fill="url(#helm-gloss)" style={{ pointerEvents: 'none' }} />
        </svg>
      </div>

      {/* NFL logo on football */}
      <svg viewBox="0 0 622 844" preserveAspectRatio="xMidYMid meet"
           style={{ ...SVG_STYLE, zIndex: 4 }} aria-hidden="true">
        <g transform="rotate(-60, 157, 243)" style={{ pointerEvents: 'none' }}>
          <image
            href="/logos/nfl.png"
            x="135" y="212" width="32" height="32"
            style={{ opacity: 0.82 }}
          />
        </g>
      </svg>

      {/* Captain badge — outside screen-blend div so it renders at full opacity */}
      {has('leadership') && build['leadership'].captain && (
        <svg viewBox="0 0 622 844" preserveAspectRatio="xMidYMid meet"
             style={{ ...SVG_STYLE, zIndex: 4 }} aria-hidden="true">
          <image
            href="/logos/Capimages-removebg-preview.png"
            x="204" y="172" width="36" height="36"
            style={{ pointerEvents: 'none' }}
          />
        </svg>
      )}

    </>
  )
}
