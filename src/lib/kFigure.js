// KICKER PLACEHOLDER FIGURE: there is no kicker art yet, so a kicker is drawn on the QB figure (K_SILHOUETTE in
// data/ks.js). The QB overlay (components/QBFigureOverlay.jsx) colors a body part when the QB rating that owns it has a
// chip; a kicker's three chips stand in for the parts they cover: clutch the helmet, accuracy the jersey and arms
// (and the number), power the legs.
// With real kicker art this file goes: a KFigureOverlay like OLFigureOverlay.jsx takes the build as it is.
export const kAsQB = b => ({
  processing: b?.clutch, vision: b?.clutch, leadership: b?.clutch,
  arm: b?.accuracy, accuracy: b?.accuracy, playmaking: b?.accuracy, size: b?.accuracy,
  legs: b?.power, 'pocket-presence': b?.power,
})
