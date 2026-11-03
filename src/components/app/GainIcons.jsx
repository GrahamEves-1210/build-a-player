// The marks next to a reward, like the coin's: XP is a mint hexagon stamped XP,
// legacy a purple shield with a gold star (CSS: .xp-ico / .lg-ico in app-game.css).
// sm: the inline size, for a "+40" in a line of text.

export const XpIco = ({ sm = true }) => <span className={`xp-ico${sm ? ' xp-ico--sm' : ''}`} aria-hidden="true" />
export const LegacyIco = ({ sm = true }) => <span className={`lg-ico${sm ? ' lg-ico--sm' : ''}`} aria-hidden="true" />

// "+4 legacy" anywhere in a line of text (Career's news and events) gets the shield
export function withLegacy(text) {
  const parts = String(text ?? '').split(/(\+\d+ legacy)/i)
  if (parts.length === 1) return text
  return parts.map((p, i) => {
    const m = p.match(/^\+(\d+) legacy$/i)
    return m ? <span key={i} className="gain">+{m[1]} <LegacyIco /> legacy</span> : p
  })
}
