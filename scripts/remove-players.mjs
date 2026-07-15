import { readFileSync, writeFileSync } from 'fs'

const REMOVE = new Set([
  "Henri Veesaar", "Karlo Matkovic", "Meleek Thomas", "Javon Small",
  "Jahmai Mashack", "Jaron Pierre Jr.", "Enrique Freeman", "Micah Peavy",
  "Daeqwon Plowden", "Isaiah Stevens", "Taelon Peter", "Tobi Lawal",
  "Tyler Smith", "Mouhamadou Gueye", "Tolu Smith", "Jalen Pickett",
  "Keaton Wallace", "RayJ Dennis", "Keshon Gilbert", "Lajae Jones",
  "Nae'Qwan Tomlin", "Myron Gardner", "Cormac Ryan", "Isaiah Evans",
  "Tamar Bates", "Jamir Watkins", "Felix Okpara", "Malevy Leons",
  "Tristan Enaruna", "Riley Minix", "Bryce Hopkins", "Spencer Jones",
  "Nick Martinelli", "Baba Miller", "Julian Phillips", "Pacome Dadiet",
  "Mohamed Diawara", "Dillon Jones", "Jamal Cain", "Izaiyah Nelson",
  "CJ Huntley", "Isaiah Livers", "David Jones Garcia", "Lindy Waters III",
  "Blake Hinson", "Anthony Gill", "Jalen Slawson", "Dominick Barlow",
  "Jabari Walker", "Richie Saunders", "Chris Manon",
])

let src = readFileSync('./src/data/nba-players.js', 'utf8')

let removed = 0
for (const name of REMOVE) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`  \\{ name: "${escaped}"[^}]+\\}[^}]+\\}[^\\n]*\\n`, 'g')
  const before = src.length
  src = src.replace(re, '')
  if (src.length < before) removed++
  else console.warn('NOT FOUND:', name)
}

writeFileSync('./src/data/nba-players.js', src, 'utf8')
console.log(`Removed ${removed} players`)
