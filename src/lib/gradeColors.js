// The grade's colour, one shade a step (the owner, 2026-11-13: the minus, the plain letter and the plus are each their own
// shade, a spectrum from red to orange to yellow to green to blue to purple). Index = the 0-11 value rounded like the
// letter (valToGrade): F D C- C C+ B- B B+ A- A A+ S. The plain C, B and A keep the colours they always had, and each
// letter's minus and plus stay close to it (the owner: B's close to the base green, an A+ blue, not purple; then a hair further apart).
export const GRADE_SPECTRUM = [
  '#ef4444', // F   red
  '#f97316', // D   orange
  '#eab308', // C-  (the letter's colour: no shade for a minus or a plus, owner 11-14)
  '#eab308', // C   yellow
  '#eab308', // C+
  '#22c55e', // B-
  '#22c55e', // B   green
  '#22c55e', // B+
  '#3584f2', // A-
  '#3584f2', // A   blue
  '#3584f2', // A+
  '#a855f7', // S   purple
]
export const spectrumColor = v0 => GRADE_SPECTRUM[Math.max(0, Math.min(11, Math.round(v0 ?? 0)))]
