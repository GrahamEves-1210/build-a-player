export const BIG_TYPES = ["jumpShot","finishing","rebounding","playmaking","interiorDefense","speed","bounce","size","basketballIQ","clutch"]
export const BIG_CATEGORIES = [{"id":"skills","label":"Skills","types":["jumpShot","finishing","rebounding","playmaking","interiorDefense"]},{"id":"physical","label":"Physical","types":["speed","bounce","size"]},{"id":"mental","label":"Mental","types":["basketballIQ","clutch"]}]
export const VERSUS_BIG_TYPES = ["jumpShot","finishing","playmaking","interiorDefense","speed","bounce","size","basketballIQ"]
export const VERSUS_BIG_CATEGORIES = [{"id":"skills","label":"Skills","types":["jumpShot","finishing","playmaking","interiorDefense"]},{"id":"physical","label":"Physical","types":["speed","bounce","size"]},{"id":"mental","label":"Mental","types":["basketballIQ"]}]

export const NBA_BIG_PLAYERS = [

  // ─── ATL ───────────────────────────────────────────────────────
  { name: 'Zuby Ejiofor', short: 'Ejiofor', team: 'ATL', starter: false, captain: false, number: 12, height: 81, weight: 215, wingspan: 84, skin: '#8e624e', position: 'PF', faceCenter: [51, 40],
    attrs: { jumpShot: 3, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 3, bounce: 3, size: 5, basketballIQ: 3, clutch: 3 } },
  { name: 'Mouhamed Gueye', short: 'Gueye', team: 'ATL', starter: false, captain: false, number: 18, height: 83, weight: 215, wingspan: 86, skin: '#6c4943', position: 'PF', faceCenter: [49, 44],
    attrs: { jumpShot: 4, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 3, bounce: 3, size: 6, basketballIQ: 3, clutch: 3 } },
  { name: 'Jock Landale', short: 'Landale', team: 'ATL', starter: false, captain: false, number: 31, height: 84, weight: 240, wingspan: 86, skin: '#c49378', position: 'C', faceCenter: [50, 39],
    attrs: { jumpShot: 6, finishing: 4, rebounding: 6, playmaking: 5, interiorDefense: 2, speed: 2, bounce: 2, size: 7, basketballIQ: 4, clutch: 3 } },
  { name: 'Asa Newell', short: 'Newell', team: 'ATL', starter: true, captain: false, number: 14, height: 82, weight: 215, wingspan: 85, skin: '#c4856a', position: 'PF', faceCenter: [50, 41],
    attrs: { jumpShot: 7, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 5, bounce: 3, size: 6, basketballIQ: 3, clutch: 3 } },
  { name: 'Onyeka Okongwu', short: 'Okongwu', team: 'ATL', starter: true, captain: false, number: 17, height: 81, weight: 245, wingspan: 85, skin: '#976152', position: 'C', faceCenter: [49, 41],
    attrs: { jumpShot: 6, finishing: 6, rebounding: 7, playmaking: 4, interiorDefense: 6, speed: 6, bounce: 5, size: 6, basketballIQ: 5, clutch: 4 } },

  // ─── BOS ───────────────────────────────────────────────────────
  { name: 'Luka Garza', short: 'Garza', team: 'BOS', starter: true, captain: false, number: 52, height: 83, weight: 250, wingspan: 84, skin: '#bd7e71', position: 'C', faceCenter: [50, 42],
    attrs: { jumpShot: 7, finishing: 4, rebounding: 7, playmaking: 4, interiorDefense: 1, speed: 3, bounce: 2, size: 6, basketballIQ: 5, clutch: 4 } },
  { name: 'Neemias Queta', short: 'Queta', team: 'BOS', starter: false, captain: false, number: 88, height: 85, weight: 245, wingspan: 87, skin: '#765144', position: 'C', faceCenter: [50, 39],
    attrs: { jumpShot: 1, finishing: 4, rebounding: 6, playmaking: 2, interiorDefense: 7, speed: 2, bounce: 2, size: 7, basketballIQ: 5, clutch: 3 } },
  { name: 'Mitchell Robinson', short: 'Robinson', team: 'BOS', starter: true, captain: false, number: 23, height: 85, weight: 240, wingspan: 90, skin: '#85533e', position: 'C', faceCenter: [50, 42],
    attrs: { jumpShot: 0, finishing: 6, rebounding: 10, playmaking: 0, interiorDefense: 7, speed: 3, bounce: 5, size: 7, basketballIQ: 5, clutch: 7 } },
  { name: 'Chris Cenac Jr.', short: 'Cenac', team: 'BOS', starter: false, captain: false, number: 12, height: 80, weight: 215, wingspan: 84, skin: '#a96d5a', position: 'SF', faceCenter: [50, 42],
    attrs: { jumpShot: 3, finishing: 5, rebounding: 4, playmaking: 3, interiorDefense: 4, speed: 5, bounce: 5, size: 5, basketballIQ: 4, clutch: 3 } },

  // ─── BKN ───────────────────────────────────────────────────────
  { name: 'Noah Clowney', short: 'Clowney', team: 'BKN', starter: false, captain: false, number: 21, height: 81, weight: 215, wingspan: 86, skin: '#a77f64', position: 'PF', faceCenter: [48, 41],
    attrs: { jumpShot: 4, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 3, speed: 3, bounce: 3, size: 6, basketballIQ: 3, clutch: 3 } },
  { name: 'Julius Randle', short: 'Randle', team: 'BKN', starter: true, captain: false, number: 30, height: 80, weight: 250, wingspan: 83, skin: '#754b3a', position: 'PF', faceCenter: [50, 39],
    attrs: { jumpShot: 4, finishing: 8, rebounding: 8, playmaking: 7, interiorDefense: 4, speed: 6, bounce: 5, size: 6, basketballIQ: 6, clutch: 6 } },
  { name: 'Moritz Wagner', short: 'Wagner', team: 'BKN', starter: true, captain: false, number: 21, height: 83, weight: 245, wingspan: 86, skin: '#ba8268', position: 'C', faceCenter: [50, 40],
    attrs: { jumpShot: 4, finishing: 6, rebounding: 6, playmaking: 3, interiorDefense: 2, speed: 3, bounce: 4, size: 7, basketballIQ: 4, clutch: 4 } },
  { name: 'Danny Wolf', short: 'Wolf', team: 'BKN', starter: false, captain: false, number: 2, height: 84, weight: 225, wingspan: 85, skin: '#b6938a', position: 'PF', faceCenter: [49, 40],
    attrs: { jumpShot: 6, finishing: 4, rebounding: 5, playmaking: 2, interiorDefense: 3, speed: 3, bounce: 3, size: 7, basketballIQ: 3, clutch: 3 } },

  // ─── CHA ───────────────────────────────────────────────────────
  { name: 'Moussa Diabate', short: 'Diabate', team: 'CHA', starter: false, captain: false, number: 14, height: 83, weight: 200, wingspan: 87, skin: '#94644a', position: 'PF', faceCenter: [50, 41],
    attrs: { jumpShot: 0, finishing: 4, rebounding: 5, playmaking: 2, interiorDefense: 6, speed: 3, bounce: 3, size: 6, basketballIQ: 2, clutch: 3 } },
  { name: 'Ryan Kalkbrenner', short: 'Kalkbrenner', team: 'CHA', starter: false, captain: false, number: 11, height: 85, weight: 240, wingspan: 87, skin: '#cf997b', position: 'C', faceCenter: [49, 41],
    attrs: { jumpShot: 3, finishing: 4, rebounding: 6, playmaking: 2, interiorDefense: 7, speed: 1, bounce: 2, size: 7, basketballIQ: 4, clutch: 3 } },
  { name: 'Naz Reid', short: 'Reid', team: 'CHA', starter: true, captain: false, number: 11, height: 81, weight: 263, wingspan: 85, skin: '#7d4d39', position: 'C', faceCenter: [50, 43],
    attrs: { jumpShot: 7, finishing: 6, rebounding: 6, playmaking: 6, interiorDefense: 5, speed: 4, bounce: 4, size: 6, basketballIQ: 6, clutch: 6 } },
  { name: 'Hannes Steinbach', short: 'Steinbach', team: 'CHA', starter: false, captain: false, number: 17, height: 81, weight: 225, wingspan: 85, skin: '#a67f6b', position: 'PF', faceCenter: [50, 37],
    attrs: { jumpShot: 3, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 3, bounce: 3, size: 6, basketballIQ: 3, clutch: 3 } },
  { name: 'Grant Williams', short: 'Williams', team: 'CHA', starter: true, captain: false, number: 2, height: 78, weight: 236, wingspan: 84, skin: '#d29979', position: 'PF', faceCenter: [50, 43],
    attrs: { jumpShot: 5, finishing: 5, rebounding: 4, playmaking: 3, interiorDefense: 6, speed: 4, bounce: 3, size: 5, basketballIQ: 6, clutch: 3 } },

  // ─── CHI ───────────────────────────────────────────────────────
  { name: 'Nic Claxton', short: 'Claxton', team: 'CHI', starter: true, captain: false, number: 33, height: 83, weight: 215, wingspan: 86, skin: '#a26e57', position: 'C', faceCenter: [49, 39], faceAdjust: { dx: 1, dy: 0, scale: 1 },
    attrs: { jumpShot: 2, finishing: 5, rebounding: 7, playmaking: 2, interiorDefense: 8, speed: 4, bounce: 5, size: 8, basketballIQ: 6, clutch: 4 } },
  { name: 'Zach Collins', short: 'Z. Collins', team: 'CHI', starter: false, captain: false, number: 12, height: 84, weight: 238, wingspan: 85, skin: '#d3a791', position: 'C', faceCenter: [50, 41],
    attrs: { jumpShot: 3, finishing: 5, rebounding: 6, playmaking: 3, interiorDefense: 3, speed: 2, bounce: 2, size: 7, basketballIQ: 5, clutch: 4 } },
  { name: 'Jalen Smith', short: 'Smith', team: 'CHI', starter: false, captain: false, number: 25, height: 82, weight: 225, wingspan: 85, skin: '#815341', position: 'PF', faceCenter: [51, 40],
    attrs: { jumpShot: 2, finishing: 5, rebounding: 6, playmaking: 2, interiorDefense: 5, speed: 3, bounce: 3, size: 6, basketballIQ: 4, clutch: 3 } },
  { name: 'Caleb Wilson', short: 'Wilson', team: 'CHI', starter: true, captain: false, number: 8, height: 82, weight: 225, wingspan: 85, skin: '#855746', position: 'PF', faceCenter: [48, 41],
    attrs: { jumpShot: 4, finishing: 7, rebounding: 4, playmaking: 5, interiorDefense: 3, speed: 8, bounce: 8, size: 8, basketballIQ: 4, clutch: 3 } },
  { name: 'Guerschon Yabusele', short: 'Yabusele', team: 'CHI', starter: false, captain: false, number: 28, height: 80, weight: 245, wingspan: 85, skin: '#925c42', position: 'PF', faceCenter: [50, 45],
    attrs: { jumpShot: 2, finishing: 4, rebounding: 5, playmaking: 2, interiorDefense: 4, speed: 3, bounce: 3, size: 6, basketballIQ: 3, clutch: 3 } },

  // ─── CLE ───────────────────────────────────────────────────────
  { name: 'Jarrett Allen', short: 'Allen', team: 'CLE', starter: true, captain: false, number: 31, height: 83, weight: 243, wingspan: 89, skin: '#b57852', position: 'C', faceCenter: [51, 47], faceAdjust: { dx: 0, dy: 0, scale: 1.1 },
    attrs: { jumpShot: 2, finishing: 7, rebounding: 8, playmaking: 4, interiorDefense: 7, speed: 7, bounce: 5, size: 7, basketballIQ: 7, clutch: 6 } },
  { name: 'Thomas Bryant', short: 'Bryant', team: 'CLE', starter: false, captain: false, number: 3, height: 83, weight: 248, wingspan: 84, skin: '#83543c', position: 'C', faceCenter: [51, 47],
    attrs: { jumpShot: 5, finishing: 4, rebounding: 6, playmaking: 2, interiorDefense: 3, speed: 1, bounce: 2, size: 8, basketballIQ: 5, clutch: 4 } },
  { name: 'Evan Mobley', short: 'Mobley', team: 'CLE', starter: true, captain: false, number: 4, height: 84, weight: 215, wingspan: 88, skin: '#aa6a46', position: 'C', faceCenter: [51, 43],
    attrs: { jumpShot: 4, finishing: 8, rebounding: 8, playmaking: 5, interiorDefense: 10, speed: 6, bounce: 6, size: 8, basketballIQ: 8, clutch: 6 } },

  // ─── DAL ───────────────────────────────────────────────────────
  { name: 'Santi Aldama', short: 'Aldama', team: 'DAL', starter: true, captain: false, number: 7, height: 83, weight: 220, wingspan: 84, skin: '#d19475', position: 'PF', faceCenter: [50, 43],
    attrs: { jumpShot: 5, finishing: 6, rebounding: 6, playmaking: 5, interiorDefense: 6, speed: 5, bounce: 4, size: 7, basketballIQ: 4, clutch: 5 } },
  { name: 'Daniel Gafford', short: 'Gafford', team: 'DAL', starter: false, captain: false, number: 21, height: 83, weight: 234, wingspan: 85, skin: '#cc9278', position: 'C', faceCenter: [50, 40],
    attrs: { jumpShot: 1, finishing: 7, rebounding: 8, playmaking: 2, interiorDefense: 7, speed: 4, bounce: 5, size: 6, basketballIQ: 4, clutch: 3 } },
  { name: 'Morez Johnson Jr.', short: 'Jr.', team: 'DAL', starter: false, captain: false, number: 14, height: 84, weight: 235, wingspan: 87, skin: '#925f4b', position: 'PF', faceCenter: [51, 43],
    attrs: { jumpShot: 3, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 4, speed: 3, bounce: 3, size: 7, basketballIQ: 3, clutch: 3 } },
  { name: 'Dereck Lively II', short: 'II', team: 'DAL', starter: false, captain: false, number: 2, height: 85, weight: 230, wingspan: 88, skin: '#ad8271', position: 'C', faceCenter: [50, 44],
    attrs: { jumpShot: 1, finishing: 6, rebounding: 8, playmaking: 2, interiorDefense: 7, speed: 1, bounce: 2, size: 7, basketballIQ: 5, clutch: 3 } },
  { name: 'Dwight Powell', short: 'Powell', team: 'DAL', starter: false, captain: false, number: 7, height: 82, weight: 230, wingspan: 85, skin: '#d59d84', position: 'PF', faceCenter: [50, 41],
    attrs: { jumpShot: 1, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 3, bounce: 3, size: 6, basketballIQ: 3, clutch: 3 } },
  { name: 'P.J. Washington', short: 'Washington', team: 'DAL', starter: true, captain: false, number: 25, height: 80, weight: 230, wingspan: 83, skin: '#c1886c', position: 'PF', faceCenter: [50, 41],
    attrs: { jumpShot: 5, finishing: 6, rebounding: 6, playmaking: 5, interiorDefense: 6, speed: 4, bounce: 4, size: 5, basketballIQ: 5, clutch: 4 } },

  // ─── DEN ───────────────────────────────────────────────────────
  { name: 'Marvin Bagley III', short: 'III', team: 'DEN', starter: false, captain: false, number: 35, height: 83, weight: 234, wingspan: 84, skin: '#bb7d5a', position: 'PF', faceCenter: [49, 41],
    attrs: { jumpShot: 5, finishing: 5, rebounding: 5, playmaking: 5, interiorDefense: 4, speed: 3, bounce: 3, size: 6, basketballIQ: 4, clutch: 4 } },
  { name: 'Aaron Gordon', short: 'Gordon', team: 'DEN', starter: true, captain: false, number: 32, height: 80, weight: 235, wingspan: 84, skin: '#b97961', position: 'PF', faceCenter: [50, 47], faceAdjust: { dx: 0, dy: -1, scale: 1.1 },
    attrs: { jumpShot: 5, finishing: 8, rebounding: 4, playmaking: 5, interiorDefense: 5, speed: 6, bounce: 6, size: 5, basketballIQ: 7, clutch: 6 } },
  { name: 'DaRon Holmes II', short: 'II', team: 'DEN', starter: false, captain: false, number: 14, height: 81, weight: 220, wingspan: 85, skin: '#a56142', position: 'PF', faceCenter: [50, 40],
    attrs: { jumpShot: 4, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 6, speed: 3, bounce: 3, size: 6, basketballIQ: 4, clutch: 3 } },
  { name: 'Nikola Jokic', short: 'Jokic', team: 'DEN', starter: true, captain: true, number: 15, height: 83, weight: 284, wingspan: 85, skin: '#c48067', position: 'C', faceCenter: [50, 42], faceAdjust: { dx: 0, dy: 0, scale: 1.05 },
    attrs: { jumpShot: 9, finishing: 11, rebounding: 11, playmaking: 11, interiorDefense: 3, speed: 7, bounce: 3, size: 9, basketballIQ: 11, clutch: 9 } },
  { name: 'Zeke Nnaji', short: 'Nnaji', team: 'DEN', starter: false, captain: false, number: 22, height: 83, weight: 240, wingspan: 84, skin: '#ab6d51', position: 'PF', faceCenter: [49, 44],
    attrs: { jumpShot: 3, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 6, speed: 3, bounce: 3, size: 6, basketballIQ: 3, clutch: 3 } },

  // ─── DET ───────────────────────────────────────────────────────
  { name: 'John Collins', short: 'Collins', team: 'DET', starter: true, captain: false, number: 20, height: 81, weight: 235, wingspan: 84, skin: '#b98169', position: 'PF', faceCenter: [50, 39],
    attrs: { jumpShot: 5, finishing: 8, rebounding: 8, playmaking: 3, interiorDefense: 5, speed: 6, bounce: 8, size: 5, basketballIQ: 4, clutch: 5 } },
  { name: 'Jalen Duren', short: 'Duren', team: 'DET', starter: true, captain: false, number: 0, height: 83, weight: 250, wingspan: 86, skin: '#8e5f46', position: 'C', faceCenter: [50, 40],
    attrs: { jumpShot: 1, finishing: 5, rebounding: 9, playmaking: 4, interiorDefense: 6, speed: 6, bounce: 6, size: 7, basketballIQ: 2, clutch: 2 } },
  { name: 'Paul Reed', short: 'Reed', team: 'DET', starter: false, captain: false, number: 7, height: 81, weight: 220, wingspan: 84, skin: '#936750', position: 'PF', faceCenter: [50, 39],
    attrs: { jumpShot: 4, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 6, speed: 3, bounce: 3, size: 5, basketballIQ: 3, clutch: 3 } },

  // ─── GSW ───────────────────────────────────────────────────────
  { name: 'Draymond Green', short: 'Draymond', team: 'GSW', starter: true, captain: false, number: 23, height: 78, weight: 230, wingspan: 85, skin: '#6b493d', position: 'PF', faceCenter: [51, 37],
    attrs: { jumpShot: 4, finishing: 5, rebounding: 7, playmaking: 9, interiorDefense: 9, speed: 5, bounce: 4, size: 6, basketballIQ: 10, clutch: 5 } },
  { name: 'Al Horford', short: 'Horford', team: 'GSW', starter: true, captain: false, number: 20, height: 81, weight: 240, wingspan: 84, skin: '#875247', position: 'C', faceCenter: [44, 43],
    attrs: { jumpShot: 7, finishing: 6, rebounding: 7, playmaking: 7, interiorDefense: 6, speed: 3, bounce: 2, size: 6, basketballIQ: 8, clutch: 6 } },
  { name: 'Yaxel Lendeborg', short: 'Lendeborg', team: 'GSW', starter: false, captain: false, number: 13, height: 82, weight: 215, wingspan: 85, skin: '#c0886e', position: 'PF', faceCenter: [50, 43],
    attrs: { jumpShot: 4, finishing: 6, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 5, bounce: 5, size: 6, basketballIQ: 6, clutch: 3 } },
  { name: 'Kristaps Porzingis', short: 'Porzingis', team: 'GSW', starter: false, captain: false, number: 7, height: 86, weight: 240, wingspan: 87, skin: '#d6957b', position: 'C', faceCenter: [49, 39], faceAdjust: { dx: 1, dy: 1, scale: 1 },
    attrs: { jumpShot: 5, finishing: 6, rebounding: 7, playmaking: 4, interiorDefense: 8, speed: 2, bounce: 3, size: 10, basketballIQ: 5, clutch: 4 } },

  // ─── HOU ───────────────────────────────────────────────────────
  { name: 'Steven Adams', short: 'Adams', team: 'HOU', starter: false, captain: false, number: 12, height: 84, weight: 265, wingspan: 86, skin: '#d09c8f', position: 'C', faceCenter: [51, 38],
    attrs: { jumpShot: 0, finishing: 4, rebounding: 10, playmaking: 2, interiorDefense: 6, speed: 1, bounce: 2, size: 7, basketballIQ: 4, clutch: 4 } },
  { name: 'Clint Capela', short: 'Capela', team: 'HOU', starter: false, captain: false, number: 30, height: 82, weight: 240, wingspan: 89, skin: '#7d5243', position: 'C', faceCenter: [50, 42],
    attrs: { jumpShot: 0, finishing: 5, rebounding: 9, playmaking: 2, interiorDefense: 6, speed: 2, bounce: 4, size: 6, basketballIQ: 4, clutch: 3 } },
  { name: 'Jeff Green', short: 'Green', team: 'HOU', starter: false, captain: false, number: 32, height: 80, weight: 235, wingspan: 83, skin: '#87604d', position: 'PF', faceCenter: [51, 37],
    attrs: { jumpShot: 4, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 3, bounce: 3, size: 5, basketballIQ: 3, clutch: 3 } },
  { name: 'Alperen Sengun', short: 'Sengun', team: 'HOU', starter: true, captain: false, number: 28, height: 82, weight: 241, wingspan: 84, skin: '#da997b', position: 'C', faceCenter: [50, 42], faceAdjust: { dx: 0, dy: -2, scale: 1 },
    attrs: { jumpShot: 5, finishing: 8, rebounding: 8, playmaking: 8, interiorDefense: 1, speed: 5, bounce: 4, size: 7, basketballIQ: 7, clutch: 6 } },
  { name: 'Jabari Smith Jr.', short: 'J. Smith', team: 'HOU', starter: true, captain: false, number: 10, height: 82, weight: 230, wingspan: 84, skin: '#c37f56', position: 'PF', faceCenter: [50, 42], faceAdjust: { dx: 1, dy: 0, scale: 1 },
    attrs: { jumpShot: 6, finishing: 6, rebounding: 6, playmaking: 4, interiorDefense: 6, speed: 6, bounce: 3, size: 7, basketballIQ: 5, clutch: 5 } },

  // ─── IND ───────────────────────────────────────────────────────
  { name: 'Jay Huff', short: 'Huff', team: 'IND', starter: false, captain: false, number: 32, height: 85, weight: 230, wingspan: 88, skin: '#d59f83', position: 'C', faceCenter: [49, 41],
    attrs: { jumpShot: 4, finishing: 4, rebounding: 4, playmaking: 2, interiorDefense: 6, speed: 2, bounce: 2, size: 7, basketballIQ: 3, clutch: 3 } },
  { name: 'Pascal Siakam', short: 'Siakam', team: 'IND', starter: true, captain: false, number: 43, height: 81, weight: 240, wingspan: 87, skin: '#83573e', position: 'PF', faceCenter: [48, 45], faceAdjust: { dx: 2, dy: -2, scale: 1 },
    attrs: { jumpShot: 6, finishing: 8, rebounding: 6, playmaking: 7, interiorDefense: 6, speed: 6, bounce: 6, size: 7, basketballIQ: 8, clutch: 8 } },
  { name: 'Obi Toppin', short: 'Toppin', team: 'IND', starter: false, captain: false, number: 1, height: 81, weight: 220, wingspan: 85, skin: '#c57f59', position: 'PF', faceCenter: [50, 42],
    attrs: { jumpShot: 4, finishing: 8, rebounding: 3, playmaking: 2, interiorDefense: 3, speed: 6, bounce: 9, size: 6, basketballIQ: 3, clutch: 3 } },
  { name: 'Jarace Walker', short: 'Walker', team: 'IND', starter: false, captain: false, number: 5, height: 80, weight: 240, wingspan: 86, skin: '#a36948', position: 'PF', faceCenter: [48, 44],
    attrs: { jumpShot: 5, finishing: 7, rebounding: 3, playmaking: 2, interiorDefense: 5, speed: 8, bounce: 9, size: 6, basketballIQ: 3, clutch: 3 } },
  { name: 'Ivica Zubac', short: 'Zubac', team: 'IND', starter: true, captain: false, number: 40, height: 84, weight: 240, wingspan: 86, skin: '#bd8a78', position: 'C', faceCenter: [50, 38],
    attrs: { jumpShot: 1, finishing: 9, rebounding: 8, playmaking: 5, interiorDefense: 9, speed: 2, bounce: 1, size: 9, basketballIQ: 7, clutch: 5 } },

  // ─── LAC ───────────────────────────────────────────────────────
  { name: 'Isaiah Jackson', short: 'Jackson', team: 'LAC', starter: false, captain: false, number: 23, height: 83, weight: 210, wingspan: 87, skin: '#a7654a', position: 'C', faceCenter: [49, 43],
    attrs: { jumpShot: 1, finishing: 6, rebounding: 8, playmaking: 1, interiorDefense: 7, speed: 4, bounce: 5, size: 6, basketballIQ: 3, clutch: 3 } },
  { name: 'Brook Lopez', short: 'B. Lopez', team: 'LAC', starter: true, captain: false, number: 11, height: 84, weight: 282, wingspan: 87, skin: '#dfac9c', position: 'C', faceCenter: [50, 42],
    attrs: { jumpShot: 5, finishing: 4, rebounding: 4, playmaking: 4, interiorDefense: 8, speed: 0, bounce: 0, size: 8, basketballIQ: 7, clutch: 6 } },
  { name: 'Yanic Konan Niederhauser', short: 'Niederhauser', team: 'LAC', starter: true, captain: false, number: 14, height: 83, weight: 225, wingspan: 86, skin: '#bb866f', position: 'C', faceCenter: [51, 45],
    attrs: { jumpShot: 4, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 6, speed: 4, bounce: 5, size: 7, basketballIQ: 4, clutch: 3 } },

  // ─── LAL ───────────────────────────────────────────────────────
  { name: 'Walker Kessler', short: 'Kessler', team: 'LAL', starter: true, captain: false, number: 24, height: 85, weight: 241, wingspan: 88, skin: '#cba897', position: 'C', faceCenter: [49, 40],
    attrs: { jumpShot: 3, finishing: 5, rebounding: 8, playmaking: 2, interiorDefense: 8, speed: 2, bounce: 3, size: 7, basketballIQ: 5, clutch: 3 } },
  { name: 'Kevon Looney', short: 'Looney', team: 'LAL', starter: false, captain: false, number: 5, height: 81, weight: 220, wingspan: 84, skin: '#7a4734', position: 'C', faceCenter: [50, 40],
    attrs: { jumpShot: 2, finishing: 4, rebounding: 9, playmaking: 2, interiorDefense: 4, speed: 2, bounce: 2, size: 5, basketballIQ: 5, clutch: 5 } },
  { name: 'Sandro Mamukelashvili', short: 'Mamukelashvili', team: 'LAL', starter: false, captain: false, number: 54, height: 83, weight: 228, wingspan: 84, skin: '#b88565', position: 'PF', faceCenter: [49, 35],
    attrs: { jumpShot: 5, finishing: 5, rebounding: 5, playmaking: 3, interiorDefense: 4, speed: 3, bounce: 3, size: 6, basketballIQ: 3, clutch: 3 } },
  { name: 'Jarred Vanderbilt', short: 'Vanderbilt', team: 'LAL', starter: true, captain: false, number: 2, height: 81, weight: 215, wingspan: 85, skin: '#9b6042', position: 'PF', faceCenter: [50, 44],
    attrs: { jumpShot: 3, finishing: 5, rebounding: 6, playmaking: 3, interiorDefense: 7, speed: 5, bounce: 3, size: 5, basketballIQ: 6, clutch: 3 } },

  // ─── MEM ───────────────────────────────────────────────────────
  { name: 'Cameron Boozer', short: 'Boozer', team: 'MEM', starter: false, captain: false, number: 11, height: 82, weight: 235, wingspan: 86, skin: '#a57157', position: 'PF', faceCenter: [49, 44],
    attrs: { jumpShot: 5, finishing: 7, rebounding: 5, playmaking: 6, interiorDefense: 5, speed: 5, bounce: 3, size: 6, basketballIQ: 5, clutch: 5 } },
  { name: 'Zach Edey', short: 'Edey', team: 'MEM', starter: true, captain: false, number: 14, height: 88, weight: 280, wingspan: 90, skin: '#c6967e', position: 'C', faceCenter: [50, 42],
    attrs: { jumpShot: 4, finishing: 8, rebounding: 9, playmaking: 4, interiorDefense: 8, speed: 2, bounce: 1, size: 11, basketballIQ: 5, clutch: 7 } },
  { name: 'Taylor Hendricks', short: 'Hendricks', team: 'MEM', starter: false, captain: false, number: 22, height: 81, weight: 205, wingspan: 84, skin: '#835b4c', position: 'PF', faceCenter: [50, 46], faceAdjust: { dx: -0.5, dy: -1, scale: 1 },
    attrs: { jumpShot: 4, finishing: 5, rebounding: 7, playmaking: 3, interiorDefense: 4, speed: 6, bounce: 5, size: 6, basketballIQ: 4, clutch: 4 } },
  { name: 'GG Jackson', short: 'Jackson', team: 'MEM', starter: false, captain: false, number: 45, height: 80, weight: 225, wingspan: 82, skin: '#b37252', position: 'PF', faceCenter: [50, 42],
    attrs: { jumpShot: 5, finishing: 5, rebounding: 6, playmaking: 4, interiorDefense: 4, speed: 5, bounce: 5, size: 5, basketballIQ: 4, clutch: 3 } },
  { name: 'Quinten Post', short: 'Post', team: 'MEM', starter: false, captain: false, number: 30, height: 84, weight: 235, wingspan: 85, skin: '#d3a58f', position: 'C', faceCenter: [50, 43],
    attrs: { jumpShot: 5, finishing: 4, rebounding: 4, playmaking: 2, interiorDefense: 3, speed: 1, bounce: 2, size: 7, basketballIQ: 3, clutch: 3 } },
  { name: 'Isaiah Stewart', short: 'Stewart', team: 'MEM', starter: true, captain: false, number: 28, height: 81, weight: 250, wingspan: 85, skin: '#8c6049', position: 'PF', faceCenter: [50, 43],
    attrs: { jumpShot: 5, finishing: 6, rebounding: 7, playmaking: 4, interiorDefense: 7, speed: 4, bounce: 4, size: 7, basketballIQ: 6, clutch: 3 } },

  // ─── MIA ───────────────────────────────────────────────────────
  { name: 'Bam Adebayo', short: 'Adebayo', team: 'MIA', starter: true, captain: true, number: 13, height: 81, weight: 255, wingspan: 81, skin: '#a96850', position: 'C', faceCenter: [49, 46], faceAdjust: { dx: 1, dy: -3, scale: 1 },
    attrs: { jumpShot: 5, finishing: 8, rebounding: 8, playmaking: 7, interiorDefense: 10, speed: 7, bounce: 6, size: 7, basketballIQ: 9, clutch: 8 } },
  { name: 'Giannis Antetokounmpo', short: 'Giannis', team: 'MIA', starter: true, captain: true, number: 7, height: 83, weight: 243, wingspan: 87, skin: '#b5785d', position: 'PF', faceCenter: [53, 45], faceAdjust: { dx: -1, dy: -1, scale: 1 },
    attrs: { jumpShot: 4, finishing: 11, rebounding: 8, playmaking: 8, interiorDefense: 9, speed: 10, bounce: 8, size: 11, basketballIQ: 9, clutch: 10 } },
  { name: 'Bobby Portis', short: 'Portis', team: 'MIA', starter: false, captain: false, number: 95, height: 82, weight: 236, wingspan: 83, skin: '#7d503d', position: 'PF', faceCenter: [50, 41], faceAdjust: { dx: 2, dy: -1, scale: 1 },
    attrs: { jumpShot: 8, finishing: 6, rebounding: 8, playmaking: 3, interiorDefense: 4, speed: 4, bounce: 5, size: 7, basketballIQ: 6, clutch: 5 } },
  { name: 'Nikola Jovic', short: 'N. Jovic', team: 'MIA', starter: false, captain: false, number: 5, height: 82, weight: 215, wingspan: 85, skin: '#c98f78', position: 'PF', faceCenter: [50, 41],
    attrs: { jumpShot: 4, finishing: 6, rebounding: 6, playmaking: 5, interiorDefense: 2, speed: 5, bounce: 6, size: 7, basketballIQ: 6, clutch: 5 } },

  // ─── MIL ───────────────────────────────────────────────────────
  { name: 'Nate Ament', short: 'Ament', team: 'MIL', starter: false, captain: false, number: 18, height: 81, weight: 215, wingspan: 85, skin: '#a17662', position: 'PF', faceCenter: [50, 37],
    attrs: { jumpShot: 3, finishing: 1, rebounding: 2, playmaking: 2, interiorDefense: 6, speed: 6, bounce: 3, size: 8, basketballIQ: 2, clutch: 3 } },
  { name: 'Myles Turner', short: 'M. Turner', team: 'MIL', starter: true, captain: false, number: 3, height: 83, weight: 250, wingspan: 88, skin: '#925f46', position: 'C', faceCenter: [52, 43],
    attrs: { jumpShot: 6, finishing: 6, rebounding: 7, playmaking: 4, interiorDefense: 8, speed: 4, bounce: 5, size: 8, basketballIQ: 6, clutch: 6 } },
  { name: 'Kel\'el Ware', short: 'Ware', team: 'MIL', starter: true, captain: false, number: 7, height: 84, weight: 230, wingspan: 88, skin: '#aa715a', position: 'C', faceCenter: [48, 46],
    attrs: { jumpShot: 5, finishing: 6, rebounding: 8, playmaking: 2, interiorDefense: 8, speed: 3, bounce: 5, size: 7, basketballIQ: 5, clutch: 3 } },

  // ─── MIN ───────────────────────────────────────────────────────
  { name: 'Joan Beringer', short: 'Beringer', team: 'MIN', starter: true, captain: false, number: 19, height: 83, weight: 225, wingspan: 90, skin: '#b67856', position: 'C', faceCenter: [50, 46],
    attrs: { jumpShot: 0, finishing: 4, rebounding: 6, playmaking: 2, interiorDefense: 5, speed: 6, bounce: 5, size: 10, basketballIQ: 3, clutch: 3 } },
  { name: 'Trey Lyles', short: 'Lyles', team: 'MIN', starter: false, captain: false,
    attrs: { jumpShot: 5, finishing: 4, rebounding: 4, playmaking: 3, interiorDefense: 3, speed: 4, bounce: 4, size: 5, basketballIQ: 4, clutch: 4 } },
  { name: 'Rudy Gobert', short: 'Gobert', team: 'MIN', starter: true, captain: false, number: 27, height: 85, weight: 258, wingspan: 93, skin: '#ac6e50', position: 'C', faceCenter: [50, 39],
    attrs: { jumpShot: 0, finishing: 5, rebounding: 9, playmaking: 3, interiorDefense: 10, speed: 1, bounce: 3, size: 9, basketballIQ: 7, clutch: 5 } },

  // ─── NOP ───────────────────────────────────────────────────────
  { name: 'DeAndre Jordan', short: 'Jordan', team: 'NOP', starter: false, captain: false, number: 6, height: 83, weight: 265, wingspan: 85, skin: '#985d3f', position: 'C', faceCenter: [49, 40],
    attrs: { jumpShot: 0, finishing: 4, rebounding: 6, playmaking: 2, interiorDefense: 5, speed: 1, bounce: 5, size: 7, basketballIQ: 6, clutch: 5 } },
  { name: 'Yves Missi', short: 'Missi', team: 'NOP', starter: false, captain: false, number: 21, height: 84, weight: 235, wingspan: 87, skin: '#794834', position: 'C', faceCenter: [50, 43],
    attrs: { jumpShot: 1, finishing: 5, rebounding: 8, playmaking: 2, interiorDefense: 7, speed: 5, bounce: 6, size: 7, basketballIQ: 5, clutch: 2 } },
  { name: 'Derik Queen', short: 'Queen', team: 'NOP', starter: true, captain: false, number: 22, height: 82, weight: 235, wingspan: 84, skin: '#764738', position: 'C', faceCenter: [50, 46],
    attrs: { jumpShot: 3, finishing: 7, rebounding: 7, playmaking: 7, interiorDefense: 5, speed: 5, bounce: 4, size: 6, basketballIQ: 6, clutch: 7 } },
  { name: 'Hunter Dickinson', short: 'Dickinson', team: 'NOP', starter: true, captain: false, number: 4, height: 85, weight: 257, wingspan: 87, skin: '#b17d66', position: 'C', faceCenter: [50, 41],
    attrs: { jumpShot: 5, finishing: 7, rebounding: 8, playmaking: 3, interiorDefense: 6, speed: 2, bounce: 3, size: 9, basketballIQ: 5, clutch: 4 } },
  { name: 'Zion Williamson', short: 'Zion', team: 'NOP', starter: true, captain: true, number: 1, height: 78, weight: 284, wingspan: 84, skin: '#6d4639', position: 'PF', faceCenter: [50, 42],
    attrs: { jumpShot: 3, finishing: 10, rebounding: 4, playmaking: 6, interiorDefense: 2, speed: 8, bounce: 11, size: 7, basketballIQ: 4, clutch: 3 } },

  // ─── NYK ───────────────────────────────────────────────────────
  { name: 'Andre Drummond', short: 'Drummond', team: 'NYK', starter: false, captain: false, number: 0, height: 82, weight: 279, wingspan: 86, skin: '#b68065', position: 'C', faceCenter: [49, 39],
    attrs: { jumpShot: 5, finishing: 4, rebounding: 10, playmaking: 2, interiorDefense: 5, speed: 1, bounce: 2, size: 7, basketballIQ: 3, clutch: 3 } },
  { name: 'Karl-Anthony Towns', short: 'KAT', team: 'NYK', starter: true, captain: true, number: 32, height: 84, weight: 270, wingspan: 86, skin: '#b37857', position: 'C', faceCenter: [50, 41], faceAdjust: { dx: -0.5, dy: -1, scale: 1 },
    attrs: { jumpShot: 9, finishing: 8, rebounding: 10, playmaking: 7, interiorDefense: 5, speed: 5, bounce: 5, size: 8, basketballIQ: 8, clutch: 8 } },
  { name: 'Mohamed Diawara', short: 'Diawara', team: 'NYK', starter: true, captain: false, number: 51, height: 79, weight: 200, wingspan: 84, skin: '#764f3f', position: 'SF', faceCenter: [50, 40],
    attrs: { jumpShot: 6, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 4, bounce: 5, size: 6, basketballIQ: 4, clutch: 3 } },

  // ─── OKC ───────────────────────────────────────────────────────
  { name: 'Isaiah Hartenstein', short: 'Hartenstein', team: 'OKC', starter: true, captain: false, number: 55, height: 84, weight: 240, wingspan: 86, skin: '#bf9274', position: 'C', faceCenter: [50, 41],
    attrs: { jumpShot: 1, finishing: 6, rebounding: 9, playmaking: 5, interiorDefense: 5, speed: 3, bounce: 6, size: 8, basketballIQ: 5, clutch: 6 } },
  { name: 'Chet Holmgren', short: 'Holmgren', team: 'OKC', starter: true, captain: false, number: 7, height: 84, weight: 195, wingspan: 90, skin: '#b0856f', position: 'C', faceCenter: [49, 41],
    attrs: { jumpShot: 6, finishing: 7, rebounding: 7, playmaking: 4, interiorDefense: 8, speed: 6, bounce: 3, size: 8, basketballIQ: 6, clutch: 3 } },
  { name: 'Aday Mara', short: 'Mara', team: 'OKC', starter: false, captain: false, number: 17, height: 85, weight: 225, wingspan: 87, skin: '#bf8c78', position: 'C', faceCenter: [50, 47],
    attrs: { jumpShot: 3, finishing: 5, rebounding: 6, playmaking: 2, interiorDefense: 6, speed: 1, bounce: 2, size: 10, basketballIQ: 4, clutch: 3 } },
  { name: 'Thomas Sorber', short: 'Sorber', team: 'OKC', starter: false, captain: false, number: 12, height: 84, weight: 240, wingspan: 87, skin: '#a46d52', position: 'C', faceCenter: [50, 41],
    attrs: { jumpShot: 2, finishing: 4, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 5, bounce: 3, size: 7, basketballIQ: 3, clutch: 3 } },
  { name: 'Jaylin Williams', short: 'Williams', team: 'OKC', starter: false, captain: false, number: 6, height: 82, weight: 230, wingspan: 87, skin: '#a8775a', position: 'PF', faceCenter: [49, 41],
    attrs: { jumpShot: 7, finishing: 5, rebounding: 4, playmaking: 3, interiorDefense: 4, speed: 5, bounce: 3, size: 6, basketballIQ: 5, clutch: 6 } },

  // ─── ORL ───────────────────────────────────────────────────────
  { name: 'Paolo Banchero', short: 'Banchero', team: 'ORL', starter: true, captain: true, number: 5, height: 82, weight: 250, wingspan: 84, skin: '#a66d4b', position: 'PF', faceCenter: [50, 40],
    attrs: { jumpShot: 5, finishing: 8, rebounding: 5, playmaking: 7, interiorDefense: 4, speed: 6, bounce: 6, size: 7, basketballIQ: 6, clutch: 5 } },
  { name: 'Goga Bitadze', short: 'Bitadze', team: 'ORL', starter: false, captain: false, number: 35, height: 84, weight: 254, wingspan: 86, skin: '#b4856b', position: 'C', faceCenter: [50, 36],
    attrs: { jumpShot: 2, finishing: 4, rebounding: 6, playmaking: 2, interiorDefense: 6, speed: 1, bounce: 2, size: 7, basketballIQ: 4, clutch: 3 } },
  { name: 'Wendell Carter Jr.', short: 'W. Carter', team: 'ORL', starter: true, captain: false, number: 34, height: 82, weight: 253, wingspan: 86, skin: '#98664b', position: 'C', faceCenter: [50, 42],
    attrs: { jumpShot: 4, finishing: 6, rebounding: 7, playmaking: 4, interiorDefense: 6, speed: 3, bounce: 6, size: 7, basketballIQ: 6, clutch: 5 } },
  { name: 'Nikola Vucevic', short: 'Vucevic', team: 'ORL', starter: false, captain: false, number: 9, height: 84, weight: 250, wingspan: 85, skin: '#c69e89', position: 'C', faceCenter: [49, 43], faceAdjust: { dx: 1, dy: 0, scale: 1.1 },
    attrs: { jumpShot: 5, finishing: 5, rebounding: 6, playmaking: 5, interiorDefense: 4, speed: 2, bounce: 1, size: 8, basketballIQ: 6, clutch: 6 } },

  // ─── PHI ───────────────────────────────────────────────────────
  { name: 'Johni Broome', short: 'Broome', team: 'PHI', starter: true, captain: false, number: 22, height: 82, weight: 240, wingspan: 85, skin: '#d6a890', position: 'PF', faceCenter: [50, 39],
    attrs: { jumpShot: 2, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 2, speed: 4, bounce: 3, size: 6, basketballIQ: 3, clutch: 4 } },
  { name: 'Joel Embiid', short: 'Embiid', team: 'PHI', starter: true, captain: true, number: 21, height: 84, weight: 280, wingspan: 89, skin: '#93624a', position: 'C', faceCenter: [49, 40],
    attrs: { jumpShot: 7, finishing: 9, rebounding: 8, playmaking: 7, interiorDefense: 5, speed: 4, bounce: 4, size: 9, basketballIQ: 9, clutch: 6 } },
  { name: 'Trendon Watford', short: 'Watford', team: 'PHI', starter: false, captain: false, number: 12, height: 80, weight: 236, wingspan: 84, skin: '#be8b6f', position: 'PF', faceCenter: [50, 40],
    attrs: { jumpShot: 2, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 3, bounce: 3, size: 5, basketballIQ: 3, clutch: 3 } },

  // ─── PHX ───────────────────────────────────────────────────────
  { name: 'Rasheer Fleming', short: 'Fleming', team: 'PHX', starter: false, captain: false, number: 20, height: 80, weight: 225, wingspan: 84, skin: '#925c3e', position: 'PF', faceCenter: [49, 42],
    attrs: { jumpShot: 4, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 3, bounce: 3, size: 5, basketballIQ: 3, clutch: 3 } },
  { name: 'Oso Ighodaro', short: 'Ighodaro', team: 'PHX', starter: true, captain: false, number: 11, height: 82, weight: 225, wingspan: 86, skin: '#bf7850', position: 'PF', faceCenter: [49, 41],
    attrs: { jumpShot: 1, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 9, bounce: 6, size: 6, basketballIQ: 3, clutch: 3 } },
  { name: 'Khaman Maluach', short: 'Maluach', team: 'PHX', starter: false, captain: false, number: 10, height: 86, weight: 230, wingspan: 88, skin: '#87563b', position: 'C', faceCenter: [50, 43],
    attrs: { jumpShot: 1, finishing: 4, rebounding: 6, playmaking: 2, interiorDefense: 7, speed: 2, bounce: 2, size: 10, basketballIQ: 4, clutch: 3 } },
  { name: 'Mark Williams', short: 'M. Williams', team: 'PHX', starter: true, captain: false, number: 15, height: 84, weight: 240, wingspan: 87, skin: '#9d613d', position: 'C', faceCenter: [50, 41],
    attrs: { jumpShot: 0, finishing: 5, rebounding: 8, playmaking: 1, interiorDefense: 8, speed: 3, bounce: 5, size: 8, basketballIQ: 5, clutch: 4 } },

  // ─── POR ───────────────────────────────────────────────────────
  { name: 'Donovan Clingan', short: 'Clingan', team: 'POR', starter: true, captain: false, number: 23, height: 86, weight: 280, wingspan: 89, skin: '#906a59', position: 'C', faceCenter: [52, 40],
    attrs: { jumpShot: 4, finishing: 6, rebounding: 9, playmaking: 2, interiorDefense: 8, speed: 2, bounce: 1, size: 10, basketballIQ: 6, clutch: 3 } },
  { name: 'Yang Hansen', short: 'Hansen', team: 'POR', starter: false, captain: false, number: 16, height: 86, weight: 240, wingspan: 87, skin: '#ac8067', position: 'C', faceCenter: [52, 49],
    attrs: { jumpShot: 2, finishing: 4, rebounding: 5, playmaking: 7, interiorDefense: 3, speed: 1, bounce: 2, size: 10, basketballIQ: 5, clutch: 3 } },
  { name: 'Robert Williams III', short: 'III', team: 'POR', starter: true, captain: false, number: 35, height: 81, weight: 237, wingspan: 86, skin: '#5d4638', position: 'C', faceCenter: [52, 39],
    attrs: { jumpShot: 3, finishing: 4, rebounding: 7, playmaking: 2, interiorDefense: 10, speed: 3, bounce: 5, size: 6, basketballIQ: 6, clutch: 3 } },

  // ─── SAC ───────────────────────────────────────────────────────
  { name: 'Precious Achiuwa', short: 'Achiuwa', team: 'SAC', starter: false, captain: false, number: 9, height: 80, weight: 225, wingspan: 84, skin: '#90523b', position: 'PF', faceCenter: [49, 44],
    attrs: { jumpShot: 3, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 4, bounce: 3, size: 5, basketballIQ: 4, clutch: 3 } },
  { name: 'Jonathan Mogbo', short: 'Mogbo', team: 'SAC', starter: true, captain: false, number: 13, height: 80, weight: 215, wingspan: 84, skin: '#814f30', position: 'PF', faceCenter: [49, 42],
    attrs: { jumpShot: 2, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 9, bounce: 5, size: 5, basketballIQ: 3, clutch: 3 } },
  { name: 'Maxime Raynaud', short: 'Raynaud', team: 'SAC', starter: false, captain: false, number: 42, height: 85, weight: 220, wingspan: 87, skin: '#b68470', position: 'C', faceCenter: [50, 44],
    attrs: { jumpShot: 2, finishing: 7, rebounding: 6, playmaking: 3, interiorDefense: 4, speed: 1, bounce: 2, size: 10, basketballIQ: 3, clutch: 3 } },
  { name: 'Domantas Sabonis', short: 'Sabonis', team: 'SAC', starter: true, captain: false, number: 11, height: 83, weight: 240, wingspan: 85, skin: '#b17767', position: 'C', faceCenter: [50, 37],
    attrs: { jumpShot: 3, finishing: 7, rebounding: 9, playmaking: 9, interiorDefense: 0, speed: 2, bounce: 2, size: 7, basketballIQ: 8, clutch: 6 } },

  // ─── SAS ───────────────────────────────────────────────────────
  { name: 'Luke Kornet', short: 'Kornet', team: 'SAS', starter: false, captain: false, number: 7, height: 86, weight: 240, wingspan: 89, skin: '#b38473', position: 'C', faceCenter: [50, 40],
    attrs: { jumpShot: 3, finishing: 5, rebounding: 6, playmaking: 2, interiorDefense: 6, speed: 1, bounce: 2, size: 10, basketballIQ: 4, clutch: 6 } },
  { name: 'Kelly Olynyk', short: 'Olynyk', team: 'SAS', starter: false, captain: false, number: 8, height: 84, weight: 238, wingspan: 86, skin: '#be8f78', position: 'C', faceCenter: [50, 40],
    attrs: { jumpShot: 5, finishing: 4, rebounding: 6, playmaking: 4, interiorDefense: 2, speed: 0, bounce: 2, size: 7, basketballIQ: 5, clutch: 5 } },
  { name: 'Mason Plumlee', short: 'Plumlee', team: 'SAS', starter: true, captain: false, number: 45, height: 83, weight: 248, wingspan: 85, skin: '#d39a93', position: 'C', faceCenter: [48, 43],
    attrs: { jumpShot: 2, finishing: 6, rebounding: 6, playmaking: 2, interiorDefense: 5, speed: 3, bounce: 7, size: 7, basketballIQ: 5, clutch: 3 } },
  { name: 'Jayden Quaintance', short: 'Quaintance', team: 'SAS', starter: false, captain: false, number: 6, height: 81, weight: 225, wingspan: 87, skin: '#8e5d48', position: 'PF', faceCenter: [49, 42],
    attrs: { jumpShot: 3, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 3, bounce: 5, size: 8, basketballIQ: 3, clutch: 3 } },
  { name: 'Tarris Reed Jr.', short: 'Jr.', team: 'SAS', starter: false, captain: false, number: 32, height: 82, weight: 245, wingspan: 85, skin: '#94604e', position: 'C', faceCenter: [49, 44],
    attrs: { jumpShot: 2, finishing: 6, rebounding: 6, playmaking: 2, interiorDefense: 4, speed: 1, bounce: 2, size: 6, basketballIQ: 4, clutch: 5 } },
  { name: 'Victor Wembanyama', short: 'Wemby', team: 'SAS', starter: true, captain: true, number: 1, height: 88, weight: 210, wingspan: 93, skin: '#a66748', position: 'C', faceCenter: [51, 42], faceAdjust: { dx: -1, dy: -2, scale: 1 },
    attrs: { jumpShot: 7, finishing: 10, rebounding: 11, playmaking: 7, interiorDefense: 11, speed: 6, bounce: 4, size: 11, basketballIQ: 9, clutch: 7 } },

  // ─── TOR ───────────────────────────────────────────────────────
  { name: 'Trayce Jackson-Davis', short: 'Jackson-Davis', team: 'TOR', starter: true, captain: false, number: 32, height: 81, weight: 228, wingspan: 84, skin: '#ba7f76', position: 'C', faceCenter: [50, 43],
    attrs: { jumpShot: 2, finishing: 6, rebounding: 8, playmaking: 2, interiorDefense: 6, speed: 7, bounce: 5, size: 6, basketballIQ: 3, clutch: 3 } },
  { name: 'Collin Murray-Boyles', short: 'Murray-Boyles', team: 'TOR', starter: true, captain: false, number: 30, height: 79, weight: 240, wingspan: 84, skin: '#9b5f39', position: 'PF', faceCenter: [50, 44],
    attrs: { jumpShot: 4, finishing: 6, rebounding: 5, playmaking: 2, interiorDefense: 5, speed: 7, bounce: 7, size: 5, basketballIQ: 4, clutch: 3 } },
  { name: 'Jakob Poeltl', short: 'Poeltl', team: 'TOR', starter: false, captain: false, number: 19, height: 85, weight: 241, wingspan: 87, skin: '#c18c71', position: 'C', faceCenter: [50, 41],
    attrs: { jumpShot: 1, finishing: 6, rebounding: 8, playmaking: 4, interiorDefense: 7, speed: 1, bounce: 2, size: 7, basketballIQ: 5, clutch: 5 } },

  // ─── UTA ───────────────────────────────────────────────────────
  { name: 'Mo Bamba', short: 'Bamba', team: 'UTA', starter: false, captain: false, number: 11, height: 84, weight: 228, wingspan: 93, skin: '#6e4c3c', position: 'C', faceCenter: [48, 43],
    attrs: { jumpShot: 3, finishing: 2, rebounding: 3, playmaking: 1, interiorDefense: 9, speed: 1, bounce: 2, size: 7, basketballIQ: 3, clutch: 3 } },
  { name: 'Kyle Filipowski', short: 'Filipowski', team: 'UTA', starter: false, captain: false, number: 22, height: 84, weight: 230, wingspan: 84, skin: '#c29b84', position: 'PF', faceCenter: [49, 39],
    attrs: { jumpShot: 4, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 3, speed: 3, bounce: 3, size: 7, basketballIQ: 3, clutch: 3 } },
  { name: 'Jaxson Hayes', short: 'Hayes', team: 'UTA', starter: false, captain: false, number: 11, height: 83, weight: 222, wingspan: 87, skin: '#b77b5a', position: 'C', faceCenter: [50, 44],
    attrs: { jumpShot: 1, finishing: 4, rebounding: 5, playmaking: 2, interiorDefense: 4, speed: 5, bounce: 6, size: 6, basketballIQ: 3, clutch: 3 } },
  { name: 'Jaren Jackson Jr.', short: 'JJJ', team: 'UTA', starter: true, captain: true, number: 20, height: 83, weight: 242, wingspan: 86, skin: '#945e44', position: 'PF', faceCenter: [49, 42],
    attrs: { jumpShot: 5, finishing: 6, rebounding: 9, playmaking: 3, interiorDefense: 10, speed: 5, bounce: 6, size: 8, basketballIQ: 6, clutch: 5 } },
  { name: 'Kevin Love', short: 'Love', team: 'UTA', starter: true, captain: false, number: 42, height: 80, weight: 251, wingspan: 84, skin: '#c9a394', position: 'PF', faceCenter: [50, 41],
    attrs: { jumpShot: 6, finishing: 5, rebounding: 8, playmaking: 6, interiorDefense: 3, speed: 3, bounce: 2, size: 6, basketballIQ: 7, clutch: 6 } },
  { name: 'Jusuf Nurkic', short: 'Nurkic', team: 'UTA', starter: false, captain: false, number: 30, height: 84, weight: 290, wingspan: 86, skin: '#cda28f', position: 'C', faceCenter: [48, 42],
    attrs: { jumpShot: 4, finishing: 6, rebounding: 6, playmaking: 2, interiorDefense: 3, speed: 1, bounce: 1, size: 7, basketballIQ: 6, clutch: 4 } },

  // ─── WAS ───────────────────────────────────────────────────────
  { name: 'Deandre Ayton', short: 'Ayton', team: 'WAS', starter: false, captain: false, number: 2, height: 83, weight: 250, wingspan: 85, skin: '#784f39', position: 'C', faceCenter: [51, 38],
    attrs: { jumpShot: 2, finishing: 5, rebounding: 7, playmaking: 3, interiorDefense: 4, speed: 3, bounce: 5, size: 8, basketballIQ: 5, clutch: 5 } },
  { name: 'Anthony Davis', short: 'A. Davis', team: 'WAS', starter: true, captain: true, number: 23, height: 82, weight: 253, wingspan: 89, skin: '#93685d', position: 'C', faceCenter: [53, 45],
    attrs: { jumpShot: 3, finishing: 8, rebounding: 8, playmaking: 6, interiorDefense: 9, speed: 7, bounce: 6, size: 8, basketballIQ: 7, clutch: 7 } },
  { name: 'Alex Sarr', short: 'Sarr', team: 'WAS', starter: true, captain: false, number: 20, height: 84, weight: 205, wingspan: 86, skin: '#a76b52', position: 'C', faceCenter: [50, 41],
    attrs: { jumpShot: 4, finishing: 6, rebounding: 6, playmaking: 2, interiorDefense: 9, speed: 6, bounce: 6, size: 9, basketballIQ: 4, clutch: 3 } },
  { name: 'Tristan Vukcevic', short: 'Vukcevic', team: 'WAS', starter: false, captain: false, number: 0, height: 83, weight: 225, wingspan: 86, skin: '#c89f90', position: 'PF', faceCenter: [49, 43],
    attrs: { jumpShot: 5, finishing: 5, rebounding: 5, playmaking: 2, interiorDefense: 4, speed: 4, bounce: 3, size: 6, basketballIQ: 3, clutch: 3 } },

]
