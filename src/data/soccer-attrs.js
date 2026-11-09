// Striker traits for soccer (the third sport). Same shape as data/nba-attrs.js.
// Order and keys are fixed by the soccer spec: Skills (6), Physical (2), Mental (2).
export const SOCCER_ATTR = {
  finishing: { label: 'Finishing', shortLabel: 'FIN', category: 'skills', hex: '#f87171' },
  shotPower: { label: 'Shot Power', shortLabel: 'PWR', category: 'skills', hex: '#fb7185' },
  heading: { label: 'Heading', shortLabel: 'HDR', category: 'skills', hex: '#fcd34d' },
  dribbling: { label: 'Dribbling', shortLabel: 'DRI', category: 'skills', hex: '#a78bfa' },
  firstTouch: { label: 'First Touch', shortLabel: 'TCH', category: 'skills', hex: '#34d399' },
  linkUp: { label: 'Link-Up Play', shortLabel: 'LNK', category: 'skills', hex: '#60a5fa' },
  pace: { label: 'Pace', shortLabel: 'PAC', category: 'physical', hex: '#fb923c' },
  strength: { label: 'Strength', shortLabel: 'STR', category: 'physical', hex: '#fdba74' },
  offBall: { label: 'Off-Ball Movement', shortLabel: 'OFF', category: 'mental', hex: '#38bdf8' },
  composure: { label: 'Composure', shortLabel: 'CMP', category: 'mental', hex: '#818cf8' },
}

export const SOCCER_TYPES = ['finishing', 'shotPower', 'heading', 'dribbling', 'firstTouch', 'linkUp', 'pace', 'strength', 'offBall', 'composure']
export const SOCCER_CATEGORIES = [
  { id: 'skills', label: 'Skills', types: ['finishing', 'shotPower', 'heading', 'dribbling', 'firstTouch', 'linkUp'] },
  { id: 'physical', label: 'Physical', types: ['pace', 'strength'] },
  { id: 'mental', label: 'Mental', types: ['offBall', 'composure'] },
]
// Career: physical traits a player can train, and the trait durability comes from.
export const SOCCER_TRAINABLE = ['pace', 'strength']
export const SOCCER_DURABILITY_TRAIT = 'strength'
