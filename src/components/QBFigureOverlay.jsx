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
      fill: ${has('strength') ? '#ffffff' : 'transparent'} !important; stroke: none !important;
      transition: fill .5s ease; filter: url(#jersey-tex);
    }

    /* Arm (arm-strength): sleeve = white, shoulders = team color — jersey texture */
    #qb-fg [id="left sleeve"] {
      fill: ${has('arm-strength') ? '#ffffff' : 'transparent'} !important; opacity: 1 !important; stroke: none !important;
      transition: fill .5s ease;
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
            transform="rotate(-2, 298, 340)"
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
        </svg>

        {/* Helmet + gloss — z-index 3, above number */}
        <svg viewBox="0 0 622 844" preserveAspectRatio="xMidYMid meet"
             style={{ ...SVG_STYLE, zIndex: 3 }} shapeRendering="geometricPrecision" aria-hidden="true">
          <path d={HELMET_SHELL} fill={tc('football-iq')} style={TR} />
          <path d={HELMET_SHELL} fill="url(#helm-gloss)" style={{ pointerEvents: 'none' }} />
        </svg>
      </div>

    </>
  )
}
