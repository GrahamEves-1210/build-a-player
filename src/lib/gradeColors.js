// The grade's colour, one shade a step (the owner, 2026-11-13: the minus, the plain letter and the plus are each their own
// shade, a spectrum from red to orange to yellow to green to blue to purple). Index = the 0-11 value rounded like the
// letter (valToGrade): F D C- C C+ B- B B+ A- A A+ S. The plain C, B and A keep the colours they always had, and each
// letter's minus and plus stay close to it (the owner: B's close to the base green; an A+ is blue, not purple).
export const GRADE_SPECTRUM = [
  '#ef4444', // F   red
  '#f97316', // D   orange
  '#eeaa0b', // C-  yellow, a touch toward orange
  '#eab308', // C   yellow
  '#dcc014', // C+  yellow, a touch toward green
  '#3fc44d', // B-  green, a touch toward yellow
  '#22c55e', // B   green
  '#18bf74', // B+  green, a touch toward blue
  '#3a94f5', // A-  blue, a touch lighter
  '#3b82f6', // A   blue
  '#4a74f2', // A+  blue, a touch deeper
  '#a855f7', // S   purple
]
export const spectrumColor = v0 => GRADE_SPECTRUM[Math.max(0, Math.min(11, Math.round(v0 ?? 0)))]
