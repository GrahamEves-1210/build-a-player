import DBFigureOverlay from './DBFigureOverlay'

// OL mode reuses the DB figure (the same crouched, ball-less stance a lineman
// shows in a two-point pass set) and colors each body part from the OL chip
// that matches it:
//   blitzPickup → helmet + team logo     (reading the rush)
//   discipline  → face + neck            (the other mental trait — same head
//                                          split DB uses for its two IQ slots)
//   size        → jersey + number        (the build's body — also sets HT/WT)
//   length      → bare arms
//   passPro     → sleeves + gloves       (the punch)
//   anchor      → knees                  (sinking the hips to hold the point)
//   runBlock    → thighs                 (drive)
//   pancake     → shins + socks          (leg drive through the finish)
//   mobility    → shoes                  (footwork)
export const OL_FIGURE_PARTS = {
  head:        'blitzPickup',
  face:        'discipline',
  jersey:      'size',
  arms:        'length',
  gloves:      'passPro',
  leftSleeve:  'passPro',
  rightSleeve: 'passPro',
  knees:       'anchor',
  thighs:      'runBlock',
  shins:       'pancake',
  shoes:       'mobility',
}

export default function OLFigureOverlay({ build, numberNudgePx = null }) {
  return <DBFigureOverlay build={build} numberNudgePx={numberNudgePx} parts={OL_FIGURE_PARTS} />
}
