// The grade's colour, one shade a step (the owner, 2026-11-13: the minus, the plain letter and the plus are each their own
// shade, a spectrum from red to orange to yellow to green to blue to purple). Index = the 0-11 value rounded like the
// letter (valToGrade): F D C- C C+ B- B B+ A- A A+ S. The plain C, B and A keep the colours they always had.
export const GRADE_SPECTRUM = [
  '#ef4444', // F   red
  '#f97316', // D   orange
  '#f59e0b', // C-  amber
  '#eab308', // C   yellow
  '#bccb1c', // C+  yellow-lime
  '#7cc53a', // B-  yellow-green
  '#22c55e', // B   green
  '#14b8a0', // B+  teal
  '#0ea5e9', // A-  sky
  '#3b82f6', // A   blue
  '#6366f1', // A+  indigo
  '#a855f7', // S   purple
]
export const spectrumColor = v0 => GRADE_SPECTRUM[Math.max(0, Math.min(11, Math.round(v0 ?? 0)))]
