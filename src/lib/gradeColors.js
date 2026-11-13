// The grade's colour, one shade a step (the owner, 2026-11-13: the minus, the plain letter and the plus are each their own
// shade, a spectrum from red to orange to yellow to green to blue to purple). Index = the 0-11 value rounded like the
// letter (valToGrade): F D C- C C+ B- B B+ A- A A+ S. The plain C, B and A keep the colours they always had, and each
// letter's minus and plus stay close to it (the owner: B's close to the base green, an A+ blue, not purple; then a hair further apart).
export const GRADE_SPECTRUM = [
  '#ef4444', // F   red
  '#f97316', // D   orange
  '#f2a40b', // C-  yellow, a touch toward orange
  '#eab308', // C   yellow
  '#ccc618', // C+  yellow, a touch toward green
  '#5ec443', // B-  green, a touch toward yellow
  '#22c55e', // B   green
  '#16bc8a', // B+  green, a touch toward blue
  '#249cef', // A-  blue, a touch lighter
  '#3b82f6', // A   blue
  '#566df2', // A+  blue, a touch deeper
  '#a855f7', // S   purple
]
export const spectrumColor = v0 => GRADE_SPECTRUM[Math.max(0, Math.min(11, Math.round(v0 ?? 0)))]
