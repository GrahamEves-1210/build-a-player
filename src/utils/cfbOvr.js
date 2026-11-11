// College Football's overall: football's own number, a hair higher at the top (the owner, 2026-11-10: a build
// that reads 97 from the NFL's formula is a 99 in college). 95 and up gets two, 90 to 94 gets one, capped at 99.
// One function for the build, the Career's college seasons and every college player's stored overall (cfbLoad),
// so nobody is compared across two scales.
export const collegeOVR = raw => (typeof raw === 'number' && isFinite(raw) ? Math.min(99, raw + (raw >= 95 ? 2 : raw >= 90 ? 1 : 0)) : raw)
