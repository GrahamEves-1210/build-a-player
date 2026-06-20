import { TYPES } from '../data/qbs'

export function valToGrade(val) {
  if (val >= 95) return 'S'
  if (val >= 91) return 'A+'
  if (val >= 87) return 'A'
  if (val >= 83) return 'A-'
  if (val >= 79) return 'B+'
  if (val >= 75) return 'B'
  if (val >= 71) return 'B-'
  if (val >= 67) return 'C+'
  if (val >= 63) return 'C'
  return 'C-'
}

export function calcOVR(build, types = TYPES) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return null
  const vals = filled.map(t => build[t].val)
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  let bonus = 0
  if (filled.length === types.length) {
    const spread = Math.max(...vals) - Math.min(...vals)
    if (spread <= 4) bonus = 3
    else if (spread <= 8) bonus = 1
    if (Math.min(...vals) >= 93) bonus += 2
  }
  return Math.min(99, Math.round(avg + bonus))
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
  if (spread >= 12) return 'High-Ceiling Specialist'
  return 'Solid Starter'
}

export function calcBalance(build, types = TYPES) {
  const filled = types.filter(t => build[t])
  if (filled.length < 2) return 0
  const vals = filled.map(t => build[t].val)
  const spread = Math.max(...vals) - Math.min(...vals)
  return Math.max(0, 100 - spread * 5)
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
  const winP = Math.min(0.88, Math.max(0.22, (ovr - 68) / 32))

  let wins = 0
  let losses = 0
  const highlights = []

  for (let wk = 1; wk <= 17; wk++) {
    const mySc = Math.round(17 + avg * 0.32 + Math.random() * 18 - spread * 0.15)
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
        passYds: Math.round(265 + avg * 2.8 + Math.random() * 110),
        tds: Math.round(2 + avg * 0.025 + Math.random() * 2.5),
        rating: Math.round(100 + avg * 0.55 + Math.random() * 25),
      }
    } else {
      sbResult = { won: false, round: eliminated, pwins }
    }
  }

  return { ovr, wins, losses, highlights, playoffs, sbResult }
}
