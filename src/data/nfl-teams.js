export const TEAMS = [
  { name: 'Arizona Cardinals',     short: 'ARI', color: '#97233F', color2: '#000000', logo: '/logos/ARI.png' },
  { name: 'Atlanta Falcons',       short: 'ATL', color: '#A71930', color2: '#000000', logo: '/logos/ATL.png' },
  { name: 'Baltimore Ravens',      short: 'BAL', color: '#241773', color2: '#9E7C0C', logo: '/logos/BAL.png' },
  { name: 'Buffalo Bills',         short: 'BUF', color: '#00338D', color2: '#C60C30', logo: '/logos/BUF.png' },
  { name: 'Carolina Panthers',     short: 'CAR', color: '#0085CA', color2: '#000000', logo: '/logos/CAR.png' },
  { name: 'Chicago Bears',         short: 'CHI', color: '#C83803', color2: '#0B162A', logo: '/logos/CHI.png' },
  { name: 'Cincinnati Bengals',    short: 'CIN', color: '#FB4F14', color2: '#000000', logo: '/logos/CIN.png' },
  { name: 'Cleveland Browns',      short: 'CLE', color: '#FF3C00', color2: '#311D00', logo: '/logos/CLE.png' },
  { name: 'Dallas Cowboys',        short: 'DAL', color: '#869397', color2: '#003594', logo: '/logos/DAL.png' },
  { name: 'Denver Broncos',        short: 'DEN', color: '#FB4F14', color2: '#002244', logo: '/logos/DEN.png' },
  { name: 'Detroit Lions',         short: 'DET', color: '#0076B6', color2: '#B0B7BC', logo: '/logos/DET.png' },
  { name: 'Green Bay Packers',     short: 'GB',  color: '#203731', color2: '#FFB612', logo: '/logos/GB.png'  },
  { name: 'Houston Texans',        short: 'HOU', color: '#002244', color2: '#A71930', logo: '/logos/HOU.png' },
  { name: 'Indianapolis Colts',    short: 'IND', color: '#002C5F', color2: '#A2AAAD', logo: '/logos/IND.png' },
  { name: 'Jacksonville Jaguars',  short: 'JAX', color: '#006778', color2: '#D7A22A', logo: '/logos/JAX.png' },
  { name: 'Kansas City Chiefs',    short: 'KC',  color: '#E31837', color2: '#FFB81C', logo: '/logos/KC.png'  },
  { name: 'Las Vegas Raiders',     short: 'LV',  color: '#000000', color2: '#A5ACAF', logo: '/logos/LV.png'  },
  { name: 'Los Angeles Chargers',  short: 'LAC', color: '#0080C6', color2: '#FFC20E', logo: '/logos/LAC.png' },
  { name: 'Los Angeles Rams',      short: 'LAR', color: '#003594', color2: '#FFA300', logo: '/logos/LAR.png' },
  { name: 'Miami Dolphins',        short: 'MIA', color: '#008E97', color2: '#F26A24', logo: '/logos/MIA.png' },
  { name: 'Minnesota Vikings',     short: 'MIN', color: '#4F2683', color2: '#FFC62F', logo: '/logos/MIN.png' },
  { name: 'New England Patriots',  short: 'NE',  color: '#002244', color2: '#C60C30', logo: '/logos/NE.png'  },
  { name: 'New Orleans Saints',    short: 'NO',  color: '#d4b982', color2: '#000000', logo: '/logos/NO.png'  },
  { name: 'New York Giants',       short: 'NYG', color: '#0B2265', color2: '#A71930', logo: '/logos/NYG.png' },
  { name: 'New York Jets',         short: 'NYJ', color: '#125740', color2: '#000000', logo: '/logos/NYJ.png' },
  { name: 'Philadelphia Eagles',   short: 'PHI', color: '#004C54', color2: '#A5ACAF', logo: '/logos/PHI.png' },
  { name: 'Pittsburgh Steelers',   short: 'PIT', color: '#FFB612', color2: '#101820', logo: '/logos/PIT.png' },
  { name: 'San Francisco 49ers',   short: 'SF',  color: '#AA0000', color2: '#B3995D', logo: '/logos/SF.png'  },
  { name: 'Seattle Seahawks',      short: 'SEA', color: '#002244', color2: '#69BE28', logo: '/logos/SEA.png' },
  { name: 'Tampa Bay Buccaneers',  short: 'TB',  color: '#D50A0A', color2: '#34302B', logo: '/logos/TB.png'  },
  { name: 'Tennessee Titans',      short: 'TEN', color: '#0C2340', color2: '#4B92DB', logo: '/logos/TEN.png' },
  { name: 'Washington Commanders', short: 'WAS', color: '#773242', color2: '#FFB612', logo: '/logos/WAS.png' },
]

const CONF = {
  ARI: 'NFC', ATL: 'NFC', BAL: 'AFC', BUF: 'AFC', CAR: 'NFC',
  CHI: 'NFC', CIN: 'AFC', CLE: 'AFC', DAL: 'NFC', DEN: 'AFC',
  DET: 'NFC', GB:  'NFC', HOU: 'AFC', IND: 'AFC', JAX: 'AFC',
  KC:  'AFC', LV:  'AFC', LAC: 'AFC', LAR: 'NFC', MIA: 'AFC',
  MIN: 'NFC', NE:  'AFC', NO:  'NFC', NYG: 'NFC', NYJ: 'AFC',
  PHI: 'NFC', PIT: 'AFC', SF:  'NFC', SEA: 'NFC', TB:  'NFC',
  TEN: 'AFC', WAS: 'NFC',
}

const DIV = {
  // AFC
  BUF: 'AFC East',  MIA: 'AFC East',  NE: 'AFC East',  NYJ: 'AFC East',
  BAL: 'AFC North', CIN: 'AFC North', CLE: 'AFC North', PIT: 'AFC North',
  HOU: 'AFC South', IND: 'AFC South', JAX: 'AFC South', TEN: 'AFC South',
  DEN: 'AFC West',  KC:  'AFC West',  LAC: 'AFC West',  LV:  'AFC West',
  // NFC
  DAL: 'NFC East',  NYG: 'NFC East',  PHI: 'NFC East',  WAS: 'NFC East',
  CHI: 'NFC North', DET: 'NFC North', GB:  'NFC North', MIN: 'NFC North',
  ATL: 'NFC South', CAR: 'NFC South', NO:  'NFC South', TB:  'NFC South',
  ARI: 'NFC West',  LAR: 'NFC West',  SF:  'NFC West',  SEA: 'NFC West',
}

// OFF/DEF ratings 1–10 reflecting ~2024-25 roster quality
// OFF = supporting cast / scheme quality (boosts passing stats)
// DEF = defensive strength (independent win contribution)
const RATINGS = {
  ARI: { off: 4, def: 4 },
  ATL: { off: 7, def: 4 },
  BAL: { off: 6, def: 6 },
  BUF: { off: 5, def: 6 },
  CAR: { off: 5, def: 5 },
  CHI: { off: 6, def: 5 },
  CIN: { off: 7, def: 1 },
  CLE: { off: 1, def: 6 },
  DAL: { off: 8, def: 3 },
  DEN: { off: 5, def: 8 },
  DET: { off: 8, def: 6 },
  GB:  { off: 5, def: 7 },
  HOU: { off: 4, def: 8 },
  IND: { off: 6, def: 4 },
  JAX: { off: 6, def: 5 },
  KC:  { off: 6, def: 6 },
  LV:  { off: 4, def: 2 },
  LAC: { off: 6, def: 6 },
  LAR: { off: 9, def: 9 },
  MIA: { off: 1, def: 1 },
  MIN: { off: 6, def: 4 },
  NE:  { off: 6, def: 6 },
  NO:  { off: 5, def: 4 },
  NYG: { off: 5, def: 6 },
  NYJ: { off: 1, def: 3 },
  PHI: { off: 7, def: 7 },
  PIT: { off: 5, def: 7 },
  SF:  { off: 8, def: 6 },
  SEA: { off: 6, def: 8 },
  TB:  { off: 6, def: 5 },
  TEN: { off: 2, def: 4 },
  WAS: { off: 5, def: 5 },
}

// RB-mode offensive ratings: same as RATINGS but QB quality baked in separately.
// In QB mode the player IS the QB, so RATINGS reflects supporting cast.
// In RB mode the QB is a separate team asset — a good QB lifts RB win probability too.
export const RB_RATINGS = {
  ...RATINGS,
  BAL: { ...RATINGS.BAL, off: 7  }, // Lamar Jackson
  BUF: { ...RATINGS.BUF, off: 7  }, // Josh Allen
  CIN: { ...RATINGS.CIN, off: 7  }, // Joe Burrow
  DAL: { ...RATINGS.DAL, off: 7  }, // Dak Prescott
  GB:  { ...RATINGS.GB,  off: 5  }, // Jordan Love
  HOU: { ...RATINGS.HOU, off: 5  }, // CJ Stroud
  KC:  { ...RATINGS.KC,  off: 7  }, // Patrick Mahomes
  LAC: { ...RATINGS.LAC, off: 7  }, // Justin Herbert
  LAR: { ...RATINGS.LAR, off: 9  }, // Matthew Stafford
  NE:  { ...RATINGS.NE,  off: 6  }, // Drake Maye
  PHI: { ...RATINGS.PHI, off: 9  }, // Jalen Hurts
  TB:  { ...RATINGS.TB,  off: 6  }, // Baker Mayfield
  WAS: { ...RATINGS.WAS, off: 6  }, // Jayden Daniels
}

export const NFL_TEAMS = TEAMS.map(t => ({
  ...t,
  off:  RATINGS[t.short]?.off ?? 6,
  def:  RATINGS[t.short]?.def ?? 6,
  conf: CONF[t.short] ?? 'AFC',
  div:  DIV[t.short]  ?? 'AFC East',
}))

// All-time franchise grades — reflects each team's best historical era
export const ALLTIME_RATINGS = {
  ARI: { off: 8, def: 8 },  // Warner era + Fitzgerald
  ATL: { off: 9, def: 8 },  // Vick + Ryan/Jones eras
  BAL: { off: 8, def: 10 }, // Ray Lewis/Ed Reed dynasty
  BUF: { off: 9, def: 9 },  // Kelly era — 4 SB appearances
  CAR: { off: 8, def: 8 },  // Newton SB run + defense
  CHI: { off: 8, def: 10 }, // 85 Bears Monsters of the Midway
  CIN: { off: 8, def: 8 },  // Boomer era + Burrow/Chase
  CLE: { off: 8, def: 8 },  // Otto Graham dynasty (pre-move)
  DAL: { off: 9, def: 9 },  // 5 SBs — Doomsday + 90s dynasty
  DEN: { off: 9, def: 10 }, // Elway + Orange Crush + Von Miller
  DET: { off: 7, def: 7 },  // historically limited
  GB:  { off: 9, def: 9 },  // Lombardi + Favre + Rodgers — most titles
  HOU: { off: 6, def: 10 },  // J.J. Watt defense
  IND: { off: 10, def: 8 }, // Manning + Unitas eras
  JAX: { off: 8, def: 9 },  // early JAGS elite defense
  KC:  { off: 10, def: 9 }, // Mahomes dynasty + Len Dawson AFL
  LV:  { off: 9, def: 9 },  // Raiders — 3 SBs, Al Davis dynasty
  LAC: { off: 9, def: 8 },  // LT + Rivers + AFL prominence
  LAR: { off: 10, def: 8 }, // Greatest Show on Turf + recent SB
  MIA: { off: 10, def: 9 }, // Marino + Shula perfect season
  MIN: { off: 9, def: 9 },  // Purple People Eaters + Favre era
  NE:  { off: 10, def: 10 },// Brady/Belichick — greatest dynasty
  NO:  { off: 9, def: 8 },  // Brees era dominance
  NYG: { off: 8, def: 10 }, // Lawrence Taylor + 4 SBs
  NYJ: { off: 8, def: 9 },  // Broadway Joe + Rex Ryan defenses
  PHI: { off: 9, def: 9 },  // McNabb + Foles + Hurts eras
  PIT: { off: 8, def: 10 }, // Steel Curtain + 6 SBs
  SF:  { off: 10, def: 9 }, // Walsh dynasty — 5 SBs
  SEA: { off: 8, def: 10 }, // Legion of Boom
  TB:  { off: 9, def: 9 },  // Sapp/Lynch defense + Brady era
  TEN: { off: 8, def: 9 },  // Earl Campbell Oilers + McNair era
  WAS: { off: 9, def: 9 },  // 3 SBs — Riggins/Theismann dynasty
}
