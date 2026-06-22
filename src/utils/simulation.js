import { TYPES } from '../data/qbs'

const GRADES = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S']

export function valToGrade(val) {
  return GRADES[Math.max(0, Math.min(11, Math.round(val)))] ?? 'F'
}

export function calcOVR(build, types = TYPES) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return null
  const vals = filled.map(t => build[t].val)
  const avg = vals.reduce((a, b) => a + b, 0) / filled.length
  let bonus = 0
  if (filled.length === types.length) {
    const spread = Math.max(...vals) - Math.min(...vals)
    if (spread <= 1) bonus = 0.3
    else if (spread <= 2) bonus = 0.1
    if (Math.min(...vals) >= 10) bonus += 0.2
  }
  // Convert 0-11 avg to 0-99 display scale: avg 2→63, avg 11→99
  return Math.min(99, Math.max(0, Math.round(55 + (avg + bonus) * 4)))
}

export function getArchetype(ovr, build, types = TYPES) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return 'Spin to start building'
  const rem = types.length - filled.length
  if (rem > 0) return `${rem} attribute${rem !== 1 ? 's' : ''} remaining`
  if (ovr >= 98) return 'All-Time Greatest'
  if (ovr >= 96) return 'Elite Franchise QB'
  if (ovr >= 93) return 'Pro Bowl Starter'
  const vals = filled.map(t => build[t].val)
  const spread = Math.max(...vals) - Math.min(...vals)
  if (spread >= 4) return 'High-Ceiling Specialist'
  return 'Solid Starter'
}

export function calcBalance(build, types = TYPES) {
  const filled = types.filter(t => build[t])
  if (filled.length < 2) return 0
  const vals = filled.map(t => build[t].val)
  const spread = Math.max(...vals) - Math.min(...vals)
  return Math.max(0, 100 - spread * 12)
}

const OPPONENTS = [
  'Dallas Cowboys', 'Miami Dolphins', 'San Francisco 49ers', 'Philadelphia Eagles',
  'Cincinnati Bengals', 'Minnesota Vikings', 'Los Angeles Rams', 'Seattle Seahawks',
  'Buffalo Bills', 'Tampa Bay Buccaneers', 'New York Giants', 'Chicago Bears',
  'Detroit Lions', 'Green Bay Packers', 'Pittsburgh Steelers', 'New England Patriots',
  'Baltimore Ravens',
]

export function runSimulation(build, types = TYPES) {
  const ovr = calcOVR(build, types)
  const vals = types.map(t => build[t]?.val ?? 0)
  const avg = vals.reduce((a, b) => a + b, 0) / types.length
  const spread = Math.max(...vals) - Math.min(...vals)
  // Normalize avg (0-10) back to a 0-99-like scale for scoring formulas
  const avgN = avg * 9.5
  const winP = Math.min(0.88, Math.max(0.22, (avgN - 60) / 35))

  let wins = 0
  let losses = 0
  const highlights = []

  for (let wk = 1; wk <= 17; wk++) {
    const mySc = Math.round(17 + avgN * 0.32 + Math.random() * 18 - spread * 1.4)
    const oppSc = Math.round(10 + Math.random() * 26)
    const won = mySc > oppSc
    won ? wins++ : losses++
    if (wk <= 4 || wk >= 14) {
      highlights.push({ wk, opponent: OPPONENTS[wk - 1], mySc, oppSc, won })
    }
  }

  const playoffs = wins >= 9
  let sbResult = null

  if (playoffs) {
    const rounds = ['Wild Card', 'Divisional Round', 'Conference Championship', 'Super Bowl']
    let pwins = 0
    let eliminated = null
    for (let r = 0; r < 4; r++) {
      if (Math.random() < winP) {
        pwins++
      } else {
        eliminated = rounds[r]
        break
      }
    }
    if (pwins === 4) {
      sbResult = {
        won: true,
        passYds: Math.round(265 + avgN * 2.8 + Math.random() * 110),
        tds: Math.round(2 + avgN * 0.025 + Math.random() * 2.5),
        rating: Math.round(100 + avgN * 0.55 + Math.random() * 25),
      }
    } else {
      sbResult = { won: false, round: eliminated, pwins }
    }
  }

  return { ovr, wins, losses, highlights, playoffs, sbResult }
}
