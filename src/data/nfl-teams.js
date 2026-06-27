import { TEAMS } from './qbs'

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
  ARI: { off: 5, def: 5 },
  ATL: { off: 8, def: 5 },
  BAL: { off: 7, def: 7 },
  BUF: { off: 6, def: 7 },
  CAR: { off: 6, def: 6 },
  CHI: { off: 7, def: 6 },
  CIN: { off: 8, def: 1 },
  CLE: { off: 2, def: 7 },
  DAL: { off: 8, def: 3 },
  DEN: { off: 6, def: 9 },
  DET: { off: 9, def: 7 },
  GB:  { off: 6, def: 8 },
  HOU: { off: 5, def: 9 },
  IND: { off: 7, def: 5 },
  JAX: { off: 7, def: 6 },
  KC:  { off: 7, def: 7 },
  LV:  { off: 5, def: 3 },
  LAC: { off: 7, def: 7 },
  LAR: { off: 9, def: 9 },
  MIA: { off: 1, def: 2 },
  MIN: { off: 7, def: 5 },
  NE:  { off: 7, def: 7 },
  NO:  { off: 5, def: 4 },
  NYG: { off: 6, def: 7 },
  NYJ: { off: 2, def: 4 },
  PHI: { off: 8, def: 8 },
  PIT: { off: 5, def: 7 },
  SF:  { off: 9, def: 7 },
  SEA: { off: 7, def: 9 },
  TB:  { off: 7, def: 6 },
  TEN: { off: 3, def: 5 },
  WAS: { off: 6, def: 6 },
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
  HOU: { off: 7, def: 9 },  // J.J. Watt defense
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
