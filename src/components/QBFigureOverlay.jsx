import svgRaw from '../assets/qb-figure-color.svg?raw'

const BASE_SVG = (() => {
  let html = svgRaw
  html = html.replace(
    '<svg version="1.2"',
    '<svg id="qb-fg" version="1.2" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet"'
  )
  html = html.replace(/<style>([\s\S]*?)<\/style>/, (_, inner) => {
    const scoped = inner.replace(/\.(s\d+)/g, '#qb-fg .$1')
    return `<style>${scoped}</style>`
  })
  return html
})()

// Solid helmet shell from QB-Figure (2).svg — proper filled path, same 622×844 viewBox
const HELMET_SHELL = 'M244.5 120.156L256 128.656L276 134.656L287 130.156C284.333 129.156 278.4 126.556 276 124.156C273 121.156 277.5 109.156 279 109.156C280.2 109.156 280.833 102.489 281 99.1556L276 89.1556L260.5 79.6556C252.1 72.0556 258.333 62.8222 262.5 59.1556L292 60.1556L322.5 53.1556V44.6556H345.5V43.1556C333.5 5.95558 298.167 -0.677753 282 0.65558C226.8 3.45558 212.667 44.4889 212.5 64.6556L215 68.6556C213.4 73.4556 219.333 93.9889 222.5 103.656V107.656V113.656L228.5 121.656H237.5L244.5 120.156Z'

const SVG_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%' }
const TR = { transition: 'fill .5s ease' }

export default function QBFigureOverlay({ build, className }) {
  const tc = (s) => build?.[s]?.teamColor ?? 'transparent'
  const sk = (s) => build?.[s]?.skin      ?? 'transparent'
  const white = build?.['mobility'] ? '#cccccc' : 'transparent'

  const css = `
    #qb-fg [id="chin"] path {
      fill: ${tc('football-iq')} !important; stroke: none !important; transition: fill .5s ease;
    }
    #qb-fg [id="shirt"], #qb-fg [id="chest"], #qb-fg [id="Belt"], #qb-fg [id="Neck"] {
      fill: ${tc('strength')} !important; stroke: none !important; transition: fill .5s ease;
    }
    #qb-fg [id="left sleeve"] {
      fill: ${tc('arm-strength')} !important; opacity: 1 !important; stroke: none !important; transition: fill .5s ease;
    }
    #qb-fg [id="Right hand"], #qb-fg [id="Left hand"] path, #qb-fg [id="forearm"],
    #qb-fg [id="right shoulder"], #qb-fg [id="Left shoulder"] {
      fill: ${sk('arm-strength')} !important; stroke: none !important; transition: fill .5s ease;
    }
    #qb-fg [id="Legs"] {
      fill: ${tc('mobility')} !important; stroke: none !important; transition: fill .5s ease;
    }
    #qb-fg [id="Right sock"], #qb-fg [id="Left sock"],
    #qb-fg [id="right calf"] path, #qb-fg [id="left calf"] path {
      fill: ${white} !important; stroke: none !important; transition: fill .5s ease;
    }
    #qb-fg [id="Right foot"], #qb-fg [id="Left foot"] {
      fill: ${white} !important; stroke: none !important; transition: fill .5s ease;
    }
  `

  return (
    <>
      <style>{css}</style>
      <div className={className} style={{ mixBlendMode: 'screen' }}>
        {/* Body parts from new SVG (named IDs) */}
        <div style={SVG_STYLE} dangerouslySetInnerHTML={{ __html: BASE_SVG }} />
        {/* Helmet shell — solid filled path from original SVG, overlaid separately */}
        <svg viewBox="0 0 622 844" preserveAspectRatio="xMidYMid meet"
             style={SVG_STYLE} aria-hidden="true">
          <path d={HELMET_SHELL} fill={tc('football-iq')} style={TR} />
        </svg>
      </div>
    </>
  )
}
