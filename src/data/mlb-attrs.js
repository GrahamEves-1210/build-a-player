// Batter and pitcher traits for baseball (the fourth sport). Same shape as data/nba-attrs.js and data/soccer-attrs.js.
// Keys, order, labels and categories are fixed by the baseball spec. Grades use the shared 0-11 scale
// (F=0, D=1, C-=2, C=3, C+=4, B-=5, B=6, B+=7, A-=8, A=9, A+=10, S=11), integer attrs.
//
//   BATTER  (position 'bat')  Hitting: contact, power, eye, avoidK, gap   Athletic: speed, fielding, arm
//                             Mental: baserunning, clutch
//   PITCHER (position 'pit')  Stuff: velocity, movement, breaking, changeup   Command: control, command, groundball
//                             Physical: stamina   Mental: composure, pitchIQ
//
// What each grade measures (the rubric behind the numbers is at the top of mlb-batters.js / mlb-pitchers.js):
//   contact      AVG and xBA, whiff rate, zone contact           velocity   primary fastball average mph
//   power        ISO, barrel rate, HR rate                       movement   fastball ride / run / sink vs average
//   eye          walk rate, chase rate                           breaking   slider / sweeper / curve run value and whiffs
//   avoidK       strikeout rate                                  changeup   changeup / splitter run value and whiffs
//   gap          doubles and triples, extra-base hits            control    walk rate, zone rate
//   speed        Statcast sprint speed                           command    edge rate, meatballs, first-pitch strikes
//   baserunning  baserunning runs (BsR), steals and SB%          stamina    innings per start, innings
//   fielding     OAA / fielding run value (catchers: framing,    groundball ground-ball rate
//                blocking, throwing)                             composure  high-leverage and postseason results
//   arm          Statcast arm strength (catchers: pop time)      pitchIQ    pitch mix, chase and called strikes induced
//   clutch       WPA, RISP and late-and-close, postseason
export const MLB_ATTR = {
  contact: { label: 'Contact', shortLabel: 'CON', category: 'hitting', hex: '#34d399' },
  power: { label: 'Power', shortLabel: 'POW', category: 'hitting', hex: '#f87171' },
  eye: { label: 'Plate Discipline', shortLabel: 'EYE', category: 'hitting', hex: '#60a5fa' },
  avoidK: { label: 'Avoid K', shortLabel: 'AVK', category: 'hitting', hex: '#a78bfa' },
  gap: { label: 'Gap Power', shortLabel: 'GAP', category: 'hitting', hex: '#fb7185' },
  speed: { label: 'Speed', shortLabel: 'SPD', category: 'athletic', hex: '#fb923c' },
  baserunning: { label: 'Baserunning', shortLabel: 'BSR', category: 'mental', hex: '#38bdf8' },
  fielding: { label: 'Fielding', shortLabel: 'FLD', category: 'athletic', hex: '#4ade80' },
  arm: { label: 'Arm', shortLabel: 'ARM', category: 'athletic', hex: '#fdba74' },
  clutch: { label: 'Clutch', shortLabel: 'CLU', category: 'mental', hex: '#818cf8' },

  velocity: { label: 'Velocity', shortLabel: 'VEL', category: 'stuff', hex: '#f87171' },
  movement: { label: 'Movement', shortLabel: 'MOV', category: 'stuff', hex: '#fb7185' },
  breaking: { label: 'Breaking Ball', shortLabel: 'BRK', category: 'stuff', hex: '#a78bfa' },
  changeup: { label: 'Changeup', shortLabel: 'CHG', category: 'stuff', hex: '#34d399' },
  control: { label: 'Control', shortLabel: 'CTL', category: 'command', hex: '#60a5fa' },
  command: { label: 'Command', shortLabel: 'CMD', category: 'command', hex: '#38bdf8' },
  stamina: { label: 'Stamina', shortLabel: 'STA', category: 'physical', hex: '#fb923c' },
  groundball: { label: 'Ground Ball', shortLabel: 'GB', category: 'command', hex: '#a3e635' },
  composure: { label: 'Composure', shortLabel: 'CMP', category: 'mental', hex: '#818cf8' },
  pitchIQ: { label: 'Pitch IQ', shortLabel: 'IQ', category: 'mental', hex: '#fcd34d' },
}

export const BAT_TYPES = ['contact', 'power', 'eye', 'avoidK', 'gap', 'speed', 'baserunning', 'fielding', 'arm', 'clutch']
export const PIT_TYPES = ['velocity', 'movement', 'breaking', 'changeup', 'control', 'command', 'stamina', 'groundball', 'composure', 'pitchIQ']

export const BAT_CATEGORIES = [
  { id: 'hitting', label: 'Hitting', types: ['contact', 'power', 'eye', 'avoidK', 'gap'] },
  { id: 'athletic', label: 'Athletic', types: ['speed', 'fielding', 'arm'] },
  { id: 'mental', label: 'Mental', types: ['baserunning', 'clutch'] },
]
export const PIT_CATEGORIES = [
  { id: 'stuff', label: 'Stuff', types: ['velocity', 'movement', 'breaking', 'changeup'] },
  { id: 'command', label: 'Command', types: ['control', 'command', 'groundball'] },
  { id: 'physical', label: 'Physical', types: ['stamina'] },
  { id: 'mental', label: 'Mental', types: ['composure', 'pitchIQ'] },
]

// by build position ('bat' | 'pit'), the way basketball keys guard / big
export const MLB_TYPES = { bat: BAT_TYPES, pit: PIT_TYPES }
export const MLB_CATEGORIES = { bat: BAT_CATEGORIES, pit: PIT_CATEGORIES }
export const MLB_POSITIONS = [
  { id: 'bat', label: 'BATTER' },
  { id: 'pit', label: 'PITCHER' },
]
// the real roles on the wheel and the report card
export const BAT_ROLES = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']
export const PIT_ROLES = ['SP', 'RP', 'CL']
export const MLB_ROLES = { bat: BAT_ROLES, pit: PIT_ROLES }

// Career: physical traits a player can train, and the trait durability comes from
// (a batter's legs; a pitcher's arm: stamina carries the Tommy John risk).
export const MLB_TRAINABLE = { bat: ['speed', 'arm'], pit: ['velocity', 'stamina'] }
export const MLB_DURABILITY_TRAIT = { bat: 'speed', pit: 'stamina' }

// the pools, like football and basketball
export const MLB_POOLS = [
  { key: 'current', label: 'CURRENT' },
  { key: 'alltime', label: 'ALL-TIME' },
]
