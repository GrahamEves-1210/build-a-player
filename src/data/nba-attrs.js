export const BUCKET_ATTR = {
  jumpShot: { label: 'Jump Shot', shortLabel: 'JMP', category: 'offense', hex: '#34d399' },
  finishing: { label: 'Finishing', shortLabel: 'FIN', category: 'offense', hex: '#f87171' },
  passing: { label: 'Passing', shortLabel: 'PAS', category: 'offense', hex: '#60a5fa' },
  handles: { label: 'Handles', shortLabel: 'HND', category: 'offense', hex: '#a78bfa' },
  playmaking: { label: 'Playmaking', shortLabel: 'PLY', category: 'offense', hex: '#38bdf8' },
  speed: { label: 'Speed', shortLabel: 'SPD', category: 'physical', hex: '#fb923c' },
  bounce: { label: 'Bounce', shortLabel: 'BNC', category: 'physical', hex: '#fcd34d' },
  strength: { label: 'Strength', shortLabel: 'STR', category: 'physical', hex: '#fdba74' },
  heightLength: { label: 'Height/Length', shortLabel: 'H/L', category: 'physical', hex: '#e879f9' },
  perimeterDefense: { label: 'Perimeter Defense', shortLabel: 'PER', category: 'defense', hex: '#4ade80' },
  interiorDefense: { label: 'Interior Defense', shortLabel: 'INT', category: 'defense', hex: '#4ade80' },
  blocking: { label: 'Blocking', shortLabel: 'BLK', category: 'physical', hex: '#f472b6' },
  athleticism: { label: 'Athleticism', shortLabel: 'ATH', category: 'physical', hex: '#fbbf24' },
  rebounding: { label: 'Rebounding', shortLabel: 'REB', category: 'defense', hex: '#a3e635' },
  size: { label: 'Size', shortLabel: 'SZE', category: 'physical', hex: '#e879f9' },
  basketballIQ: { label: 'Basketball IQ', shortLabel: 'IQ', category: 'mental', hex: '#38bdf8' },
  clutch: { label: 'Leadership/Clutch', shortLabel: 'LDR', category: 'mental', hex: '#818cf8' },
}

export const BUCKET_TYPES = ["jumpShot","finishing","passing","handles","perimeterDefense","speed","bounce","size","basketballIQ","clutch"]
export const BUCKET_CATEGORIES = [{"id":"skills","label":"Skills","types":["jumpShot","finishing","passing","handles","perimeterDefense"]},{"id":"physical","label":"Physical","types":["speed","bounce","size"]},{"id":"mental","label":"Mental","types":["basketballIQ","clutch"]}]
export const BUCKET_LITE_TYPES = ["jumpShot","finishing","passing","handles"]
