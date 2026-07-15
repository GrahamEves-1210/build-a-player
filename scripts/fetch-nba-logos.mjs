// Downloads all 30 NBA team logos from ESPN CDN into public/logos/nba/
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const TEAMS = [
  { short: 'ATL', espn: 'atl' },
  { short: 'BOS', espn: 'bos' },
  { short: 'BKN', espn: 'bkn' },
  { short: 'CHA', espn: 'cha' },
  { short: 'CHI', espn: 'chi' },
  { short: 'CLE', espn: 'cle' },
  { short: 'DAL', espn: 'dal' },
  { short: 'DEN', espn: 'den' },
  { short: 'DET', espn: 'det' },
  { short: 'GSW', espn: 'gs'  },
  { short: 'HOU', espn: 'hou' },
  { short: 'IND', espn: 'ind' },
  { short: 'LAC', espn: 'lac' },
  { short: 'LAL', espn: 'lal' },
  { short: 'MEM', espn: 'mem' },
  { short: 'MIA', espn: 'mia' },
  { short: 'MIL', espn: 'mil' },
  { short: 'MIN', espn: 'min' },
  { short: 'NOP', espn: 'no'  },
  { short: 'NYK', espn: 'ny'  },
  { short: 'OKC', espn: 'okc' },
  { short: 'ORL', espn: 'orl' },
  { short: 'PHI', espn: 'phi' },
  { short: 'PHX', espn: 'phx' },
  { short: 'POR', espn: 'por' },
  { short: 'SAC', espn: 'sac' },
  { short: 'SAS', espn: 'sa'  },
  { short: 'TOR', espn: 'tor' },
  { short: 'UTA', espn: 'uta' },
  { short: 'WAS', espn: 'wsh' },
]

const OUT = join(process.cwd(), 'public', 'logos', 'nba')
mkdirSync(OUT, { recursive: true })

for (const { short, espn } of TEAMS) {
  const url = `https://a.espncdn.com/i/teamlogos/nba/500/${espn}.png`
  try {
    const res = await fetch(url)
    if (!res.ok) { console.error(`FAILED ${short}: HTTP ${res.status}`); continue }
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(join(OUT, `${short}.png`), buf)
    console.log(`✓ ${short}`)
  } catch (e) {
    console.error(`ERROR ${short}: ${e.message}`)
  }
}

console.log('\nDone.')
