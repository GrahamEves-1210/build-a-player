// One skin-tone treatment for every football figure (QB, RB, WR/TE, DB/OL), so a
// player's skin reads the same whichever position you're building. The figures
// paint skin over a dark base with mixBlendMode:'screen', which can only
// brighten — `light` stays low so dark tones don't wash out toward gray, and the
// red lift keeps every tone reading warm instead of ashy.
export const SKIN_LIGHT = 1
export const SKIN_RED   = 34

// Returns #rrggbb (not rgb()) — RB's lighten/darken helpers parse their input
// with hex.slice(), so an rgb() string would turn into NaN channels there.
export function warmSkin(hex, light = SKIN_LIGHT, redBoost = SKIN_RED) {
  if (!hex || hex === 'transparent') return 'transparent'
  const clamp = (v) => Math.max(0, Math.min(255, v))
  const toHex = (v) => clamp(Math.round(v)).toString(16).padStart(2, '0')
  const r = parseInt(hex.slice(1, 3), 16) + light + redBoost
  // Light skin's red channel is already near 255, so the boost would just clip
  // and do nothing — whatever doesn't fit in red comes off green/blue instead,
  // which keeps pale skin reading rosy rather than flat beige.
  const overflow = Math.max(0, r - 255)
  const g = parseInt(hex.slice(3, 5), 16) + light - overflow
  const b = parseInt(hex.slice(5, 7), 16) + light - 6 - overflow
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Lit side of the face (the part not shaded by the helmet brim).
export const warmSkinLight = (hex) => warmSkin(hex, SKIN_LIGHT + 8, SKIN_RED - 6)
