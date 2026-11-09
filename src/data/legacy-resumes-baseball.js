// The greatest hitters' and pitchers' real careers, scored by Career's own legacy formula (lib/careerBaseball.js
// bbLegacy), so a career lands among them on the same scale. Loaded only with baseball (lib/careerBaseball.js).
// Sources: Baseball-Reference player pages (career totals, awards, WAR: B-Ref's, rounded) and MLB.com's award lists.
// Awards that didn't exist in a player's day count as none (the MVP from 1931, with the 1911-14 Chalmers and the
// 1922-29 League awards; the All-Star Game from 1933; Rookie of the Year from 1947; the Cy Young from 1956; Gold
// Gloves from 1957; Silver Sluggers from 1980). Retired players only: an active career's numbers keep moving.
//   seasons · allStars (selections) · mvps · cys · roy · ss (Silver Sluggers) · gg (Gold Gloves) · rings · wsMvp
//   battingTitles · tripleCrowns · stats: war, h, hr (hitters), w, k, sv (pitchers)
const H = (name, seasons, allStars, mvps, roy, ss, gg, rings, wsMvp, battingTitles, tripleCrowns, war, h, hr, extra = {}) => ({ name, seasons, allStars, mvps, cys: 0, roy, ss, gg, allMLB: 0, rings, wsMvp, battingTitles, tripleCrowns, stats: { war, h, hr, ...extra } })
const P = (name, seasons, allStars, cys, mvps, roy, gg, rings, wsMvp, tripleCrowns, war, w, k, sv = 0) => ({ name, seasons, allStars, mvps, cys, roy, ss: 0, gg, allMLB: 0, rings, wsMvp, battingTitles: 0, tripleCrowns, stats: { war, w, k, sv } })
export const BAT_RESUMES = [
  H('Babe Ruth', 22, 2, 1, false, 0, 0, 7, 0, 1, 0, 182.6, 2873, 714, { w: 94 }),
  H('Barry Bonds', 22, 14, 7, false, 12, 8, 0, 0, 2, 0, 162.8, 2935, 762),
  H('Willie Mays', 22, 24, 2, true, 0, 12, 1, 0, 1, 0, 156.1, 3283, 660),
  H('Ty Cobb', 24, 0, 1, false, 0, 0, 0, 0, 11, 1, 151.4, 4189, 117),
  H('Hank Aaron', 23, 25, 1, false, 0, 3, 1, 0, 2, 0, 143.1, 3771, 755),
  H('Honus Wagner', 21, 0, 0, false, 0, 0, 1, 0, 8, 0, 130.8, 3420, 101),
  H('Stan Musial', 22, 24, 3, false, 0, 0, 3, 0, 7, 0, 128.5, 3630, 475),
  H('Rogers Hornsby', 23, 0, 2, false, 0, 0, 1, 0, 7, 2, 127.3, 2930, 301),
  H('Ted Williams', 19, 19, 2, false, 0, 0, 0, 0, 6, 2, 121.8, 2654, 521),
  H('Alex Rodriguez', 22, 14, 3, false, 10, 2, 1, 0, 1, 0, 117.6, 3115, 696),
  H('Lou Gehrig', 17, 7, 2, false, 0, 0, 6, 0, 1, 1, 113.7, 2721, 493),
  H('Rickey Henderson', 25, 10, 1, false, 3, 1, 2, 0, 0, 0, 111.1, 3055, 297),
  H('Mickey Mantle', 18, 20, 3, false, 0, 1, 7, 0, 1, 1, 110.2, 2415, 536),
  H('Frank Robinson', 21, 14, 2, true, 0, 1, 2, 1, 1, 1, 107.3, 2943, 586),
  H('Mike Schmidt', 18, 12, 3, false, 6, 10, 1, 1, 0, 0, 106.9, 2234, 548),
  H('Albert Pujols', 22, 11, 3, true, 6, 2, 2, 0, 1, 0, 101.6, 3384, 703),
  H('Joe Morgan', 22, 10, 2, false, 0, 5, 2, 0, 0, 0, 100.4, 2517, 268),
  H('Jimmie Foxx', 20, 9, 3, false, 0, 0, 2, 0, 2, 1, 96.4, 2646, 534),
  H('Ken Griffey Jr.', 22, 13, 1, false, 7, 10, 0, 0, 0, 0, 83.8, 2781, 630),
  H('Pete Rose', 24, 17, 1, true, 1, 2, 3, 1, 3, 0, 79.6, 4256, 160),
  H('Joe DiMaggio', 13, 13, 3, false, 0, 0, 9, 0, 2, 0, 79.2, 2214, 361),
  H('Johnny Bench', 17, 14, 2, true, 0, 10, 2, 1, 0, 0, 75.1, 2048, 389),
  H('Derek Jeter', 20, 14, 0, true, 5, 5, 5, 1, 0, 0, 71.3, 3465, 260),
  H('Miguel Cabrera', 21, 12, 2, false, 7, 0, 1, 0, 4, 1, 67.3, 3174, 511),
  H('Ichiro Suzuki', 19, 10, 1, true, 3, 10, 0, 0, 2, 0, 60.0, 3089, 117),
]
export const PIT_RESUMES = [
  P('Walter Johnson', 21, 0, 0, 2, false, 0, 1, 0, 3, 164.8, 417, 3509),
  P('Cy Young', 22, 0, 0, 0, false, 0, 1, 0, 1, 163.6, 511, 2803),
  P('Roger Clemens', 24, 11, 7, 1, false, 0, 2, 0, 2, 139.2, 354, 4672),
  P('Lefty Grove', 17, 6, 0, 1, false, 0, 2, 0, 2, 113.3, 300, 2266),
  P('Tom Seaver', 20, 12, 3, 0, true, 0, 1, 0, 0, 109.9, 311, 3640),
  P('Christy Mathewson', 17, 0, 0, 0, false, 0, 1, 0, 2, 106.7, 373, 2507),
  P('Greg Maddux', 23, 8, 4, 0, false, 18, 1, 0, 0, 106.6, 355, 3371),
  P('Randy Johnson', 22, 10, 5, 0, false, 0, 1, 1, 1, 101.1, 303, 4875),
  P('Warren Spahn', 21, 17, 1, 0, false, 0, 1, 0, 0, 100.1, 363, 2583),
  P('Steve Carlton', 24, 10, 4, 0, false, 1, 2, 0, 1, 90.2, 329, 4136),
  P('Pedro Martinez', 18, 8, 3, 0, false, 0, 1, 0, 1, 86.1, 219, 3154),
  P('Bob Gibson', 17, 9, 2, 1, false, 9, 2, 2, 0, 81.9, 251, 3117),
  P('Tom Glavine', 22, 10, 2, 0, false, 0, 1, 1, 0, 81.4, 305, 2607),
  P('Nolan Ryan', 27, 8, 0, 0, false, 0, 1, 0, 0, 81.3, 324, 5714),
  P('John Smoltz', 21, 8, 1, 0, false, 0, 1, 0, 0, 69.0, 213, 3084, 154),
  P('Bob Feller', 18, 8, 0, 0, false, 0, 1, 0, 1, 65.2, 266, 2581),
  P('Dennis Eckersley', 24, 6, 1, 1, false, 0, 1, 0, 0, 62.2, 197, 2401, 390),
  P('Mariano Rivera', 19, 13, 0, 0, false, 0, 5, 1, 0, 56.3, 82, 1173, 652),
  P('Sandy Koufax', 12, 7, 3, 1, false, 0, 4, 2, 3, 48.9, 165, 2396),
  P('Trevor Hoffman', 18, 7, 0, 0, false, 0, 0, 0, 0, 28.0, 61, 1133, 601),
]
