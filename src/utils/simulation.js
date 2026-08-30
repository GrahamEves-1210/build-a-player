import { TYPES } from '../data/qbs'
import { RB_TYPES } from '../data/rbs'
import { WR_TYPES, WRS } from '../data/wrs'
import { TE_TYPES, TES } from '../data/tes'
import { NFL_TEAMS, ALLTIME_RATINGS, RB_RATINGS } from '../data/nfl-teams'

export const HEADSHOT_BASE = import.meta.env.DEV
  ? '/headshots'
  : 'https://cdn.jsdelivr.net/gh/GrahamEves-1210/build-a-player@main/public/headshots'

export function nflHeadshot(id) {
  if (!id) return null
  return id.includes('.') ? `${HEADSHOT_BASE}/${id}` : `${HEADSHOT_BASE}/${id}.webp`
}

const TEAM_BY_NAME = Object.fromEntries(NFL_TEAMS.map(t => [t.name, t]))

// All-time ratings keyed by team name for opponent lookups
const ALLTIME_BY_NAME = Object.fromEntries(
  NFL_TEAMS.map(t => [t.name, { ...t, ...(ALLTIME_RATINGS[t.short] ?? { off: 8, def: 8 }) }])
)

// Snap to nearest score expressible as 7a + 3b (no safeties)
function snapNFL(n) {
  if (n <= 0) return 0
  for (let d = 0; d <= 5; d++) {
    for (const v of [n - d, n + d]) {
      if (v < 0) continue
      for (let a = Math.floor(v / 7); a >= 0; a--) {
        if ((v - 7 * a) % 3 === 0) return v
      }
    }
  }
  return n
}

const GRADES = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S']

export function readableTextColor(hex) {
  if (!hex) return '#ffffff'
  if (hex.toUpperCase() === '#FFB612') return '#FFB612'
  const _hex = hex.toUpperCase()
  if (_hex === '#D4B982' || _hex === '#869397' || _hex === '#FFC20E') return '#ffffff'
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#111111' : '#ffffff'
}

export function valToGrade(val) {
  return GRADES[Math.max(0, Math.min(11, Math.round(val)))] ?? 'F'
}

// Mirrors the win probability coefficients — accuracy/processing/vision matter most
const ATTR_WEIGHT = {
  'accuracy':        0.17,
  'processing':      0.16,
  'arm':             0.15,
  'legs':            0.15,
  'playmaking':      0.10,
  'vision':          0.09,
  'pocket-presence': 0.07,
  'size':            0.07,
  'leadership':      0.04,
}

export function calcOVR(build, types = TYPES) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return null

  // Weighted average — normalize to filled slots only so partial builds work
  const totalW = filled.reduce((s, t) => s + (ATTR_WEIGHT[t] ?? 0.05), 0)
  const avg    = filled.reduce((s, t) => s + build[t].val * (ATTR_WEIGHT[t] ?? 0.05) / totalW, 0)
  const vals   = filled.map(t => build[t].val)
  const base   = 58 + 2.2 * avg + 0.24 * avg * avg

  let bonus = 0
  if (filled.length === types.length) {
    const spread = Math.max(...vals) - Math.min(...vals)
    const minVal = Math.min(...vals)
    if (minVal > 0) {
      if (spread <= 1) bonus += 3
      else if (spread <= 2) bonus += 1.5
      else if (spread <= 3) bonus += 0.5
    }
    if (minVal >= 9) bonus += 2.5
    else if (minVal >= 8) bonus += 0.8
  }

  return Math.min(99, Math.max(0, Math.round(base + bonus)))
}

export function getArchetype(ovr, build, types = TYPES) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return 'Spin to start building'
  const rem = types.length - filled.length
  if (rem > 0) return `${rem} attribute${rem !== 1 ? 's' : ''} remaining`

  const g = t => build[t]?.val ?? 0
  const arm  = g('arm'),  legs = g('legs'), size = g('size')
  const proc = g('processing'), vis = g('vision'), lead = g('leadership')
  const play = g('playmaking'),  acc = g('accuracy'), pock = g('pocket-presence')

  const vals   = filled.map(t => build[t].val)
  const spread = Math.max(...vals) - Math.min(...vals)

  const ranked = [
    { k: 'arm',  v: arm  }, { k: 'legs', v: legs },
    { k: 'acc',  v: acc  }, { k: 'proc', v: proc },
    { k: 'vis',  v: vis  }, { k: 'lead', v: lead },
    { k: 'play', v: play }, { k: 'pock', v: pock },
  ].sort((a, b) => b.v - a.v)

  const t1 = ranked[0].k
  const t2 = ranked[1].k
  const top = (k) => t1 === k || t2 === k
  const hi  = (v) => v >= 10
  const up  = (v) => v >= 9
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length

  if (ovr >= 95) {
    if (hi(arm) && hi(legs))          return 'Once-in-a-Generation Talent'
    if (hi(arm) && hi(acc))           return 'Precision Cannon'
    if (hi(legs) && hi(play))         return 'Unstoppable Force'
    if (hi(proc) && hi(vis))          return 'Cerebral Field General'
    if (spread <= 1)                  return 'Generational Talent'
    return 'Transcendent QB'
  }
  if (ovr >= 90) {
    if (top('legs') && top('arm'))    return 'Elite Dual Threat'
    if (top('legs') && top('play'))   return 'Dual Threat Nightmare'
    if (top('legs') && top('acc'))    return 'Mobile Surgeon'
    if (top('arm') && top('acc'))     return 'Gunslinger'
    if (top('proc') && top('vis'))    return 'Cerebral Pocket Passer'
    if (top('pock') && top('acc'))    return 'Elite Pocket Passer'
    if (top('arm') && spread >= 4)    return 'Cannon Arm'
    if (spread <= 2)                  return 'Franchise Cornerstone'
    return 'Superstar'
  }
  if (ovr >= 84) {
    if (top('legs') && top('play'))   return 'Dual Threat'
    if (top('legs') && top('arm'))    return 'Dual Threat Gunslinger'
    if (top('legs') && up(legs))      return 'Rushing Threat'
    if (top('arm') && top('acc'))     return 'Gunslinger'
    if (top('arm') && spread >= 4)    return 'Boom or Bust'
    if (top('acc') && top('pock'))    return 'Pocket Passer'
    if (top('proc') && top('lead'))   return 'Field General'
    if (top('play') && top('vis'))    return 'Playmaker'
    if (spread <= 2)                  return 'All-Around Quarterback'
    return 'Pro Bowl Quarterback'
  }
  if (ovr >= 76) {
    if (top('legs') && up(legs))      return 'Scrambler'
    if (top('legs') && top('play'))   return 'Run-First QB'
    if (top('arm') && spread >= 4)    return 'Boom or Bust'
    if (top('arm'))                   return 'Strong-Arm Starter'
    if (top('acc') && top('pock'))    return 'Cerebral Pocket Passer'
    if (top('proc') || top('vis'))    return 'System QB'
    if (top('lead'))                  return 'Locker Room Leader'
    if (spread <= 2)                  return 'Reliable Starter'
    return 'Solid Starter'
  }
  if (ovr >= 68) {
    if (top('legs') && up(legs))      return 'Athletic Project'
    if (spread >= 5)                  return 'Raw Talent'
    if (spread <= 2)                  return 'Bridge QB'
    if (ranked[0].v >= 9)             return 'One-Trick Pony'
    return 'Spot Starter'
  }
  if (ovr >= 60) {
    const goodPhysicals = top('arm') || top('legs') || arm >= 8 || legs >= 8 || size >= 8
    return goodPhysicals ? 'Project QB' : 'Practice Squad Arm'
  }
  if (ovr >= 50) {
    const goodPhysicals = top('arm') || top('legs') || arm >= 9 || legs >= 9
    return goodPhysicals ? 'Project QB' : 'Clipboard Manager'
  }
  return 'Practice Squad Arm'
}

export function calcBalance(build, types = TYPES) {
  const filled = types.filter(t => build[t])
  if (filled.length < 2) return 0
  const vals = filled.map(t => build[t].val)
  const spread = Math.max(...vals) - Math.min(...vals)
  return Math.max(0, 100 - spread * 12)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Roughly normal distribution via sum of 3 uniforms, centered at 0, SD ~0.47
function randN() { return Math.random() + Math.random() + Math.random() - 1.5 }

// Official NFL passer rating (0–158.3)
function passerRating(comps, atts, yards, tds, ints) {
  if (!atts) return 0
  const A = Math.min(2.375, Math.max(0, ((comps / atts) - 0.3) * 5))
  const B = Math.min(2.375, Math.max(0, (yards / atts - 3) * 0.25))
  const C = Math.min(2.375, Math.max(0, (tds / atts) * 20))
  const D = Math.min(2.375, Math.max(0, 2.375 - (ints / atts) * 25))
  return Math.round(((A + B + C + D) / 6) * 100 * 10) / 10
}

// ── Schedule ──────────────────────────────────────────────────────────────────

function buildSchedule(team) {
  // Fallback static schedule when no team is selected
  if (!team?.div) {
    return [
      'Dallas Cowboys', 'Miami Dolphins', 'San Francisco 49ers', 'Philadelphia Eagles',
      'Cincinnati Bengals', 'Minnesota Vikings', 'Los Angeles Rams', 'Seattle Seahawks',
      'Buffalo Bills', 'Tampa Bay Buccaneers', 'New York Giants', 'Chicago Bears',
      'Detroit Lions', 'Green Bay Packers', 'Pittsburgh Steelers', 'New England Patriots',
      'Baltimore Ravens',
    ]
  }

  const byDiv = {}
  NFL_TEAMS.forEach(t => {
    if (!byDiv[t.div]) byDiv[t.div] = []
    byDiv[t.div].push(t.name)
  })

  // 6 divisional games — play each division opponent twice
  const divOpponents = byDiv[team.div].filter(n => n !== team.name)
  const divGames = [...divOpponents, ...divOpponents]

  // Pick 2 other same-conference divisions for 4+4 games
  const sameConfDivs = Object.keys(byDiv)
    .filter(d => d.startsWith(team.conf.slice(0, 3)) && d !== team.div)
  const shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
  shuffle(sameConfDivs)
  const confGames = [
    ...byDiv[sameConfDivs[0]],
    ...byDiv[sameConfDivs[1]],
  ]

  // Pick 1 cross-conference division for 4 games
  const crossConfDivs = shuffle(
    Object.keys(byDiv).filter(d => !d.startsWith(team.conf.slice(0, 3)))
  )
  const crossGames = byDiv[crossConfDivs[0]]

  // 3 remaining games: one from each remaining same-conf division + one cross-conf
  const remainSameConf = byDiv[sameConfDivs[2]] ? shuffle([...byDiv[sameConfDivs[2]]]).slice(0, 2) : []
  const remainCross    = shuffle([...byDiv[crossConfDivs[1]]]).slice(0, 1)
  const flexGames      = [...remainSameConf, ...remainCross]

  const opponents = shuffle([...divGames, ...confGames, ...crossGames, ...flexGames]).slice(0, 17)
  const homeFlags = shuffle([...Array(9).fill(true), ...Array(8).fill(false)])
  return opponents.map((opponent, i) => ({ opponent, home: homeFlags[i] }))
}

const DOME_TEAMS = new Set(['ARI','ATL','DAL','DET','HOU','IND','LV','MIN','NO'])
const COLD_TEAMS = new Set(['BAL','BUF','CHI','CIN','CLE','DEN','GB','KC','NE','NYG','NYJ','PHI','PIT','WAS'])

function playoffWeather(homeShort, isSuperBowl) {
  if (isSuperBowl) return 'dome'
  if (!homeShort || DOME_TEAMS.has(homeShort)) return 'dome'
  const r = Math.random()
  if (COLD_TEAMS.has(homeShort)) {
    if (r < 0.62) return 'clear'
    if (r < 0.84) return 'snow'
    return 'rain'
  }
  return r < 0.78 ? 'clear' : 'rain'
}

const PLAYOFF_POOLS = {
  AFC: ['Kansas City Chiefs', 'Baltimore Ravens', 'Buffalo Bills', 'Houston Texans', 'Pittsburgh Steelers', 'Denver Broncos', 'Los Angeles Chargers', 'Indianapolis Colts', 'Jacksonville Jaguars', 'New England Patriots'],
  NFC: ['Philadelphia Eagles', 'Detroit Lions', 'San Francisco 49ers', 'Los Angeles Rams', 'Green Bay Packers', 'Minnesota Vikings', 'Seattle Seahawks', 'Dallas Cowboys', 'Washington Commanders', 'Tampa Bay Buccaneers'],
}

const SB_POOLS = {
  AFC: ['Philadelphia Eagles', 'Detroit Lions', 'San Francisco 49ers', 'Los Angeles Rams', 'Green Bay Packers', 'Minnesota Vikings'],
  NFC: ['Kansas City Chiefs', 'Baltimore Ravens', 'Buffalo Bills', 'Houston Texans', 'Pittsburgh Steelers', 'Denver Broncos'],
}

// All-Time playoff pools — historically dominant franchises only
const ALLTIME_PLAYOFF_POOLS = {
  AFC: ['New England Patriots', 'Pittsburgh Steelers', 'Baltimore Ravens', 'Kansas City Chiefs', 'Denver Broncos', 'Buffalo Bills', 'Miami Dolphins', 'Indianapolis Colts', 'Las Vegas Raiders', 'Los Angeles Chargers'],
  NFC: ['San Francisco 49ers', 'Dallas Cowboys', 'Green Bay Packers', 'Minnesota Vikings', 'New York Giants', 'Chicago Bears', 'Los Angeles Rams', 'Seattle Seahawks', 'Philadelphia Eagles', 'Washington Commanders'],
}

const ALLTIME_SB_POOLS = {
  AFC: ['San Francisco 49ers', 'Dallas Cowboys', 'Green Bay Packers', 'Minnesota Vikings', 'New York Giants', 'Chicago Bears', 'Los Angeles Rams'],
  NFC: ['New England Patriots', 'Pittsburgh Steelers', 'Baltimore Ravens', 'Kansas City Chiefs', 'Denver Broncos', 'Miami Dolphins', 'Indianapolis Colts'],
}

// ── MVP ───────────────────────────────────────────────────────────────────────

const CLASSIC_MVP_POOL = [
  { name: 'Patrick Mahomes', team: 'KC',  color: '#E31837' },
  { name: 'Lamar Jackson',   team: 'BAL', color: '#241773' },
  { name: 'Josh Allen',      team: 'BUF', color: '#00338D' },
  { name: 'Joe Burrow',      team: 'CIN', color: '#FB4F14' },
  { name: 'Jalen Hurts',     team: 'PHI', color: '#004C54' },
  { name: 'Dak Prescott',    team: 'DAL', color: '#869397' },
  { name: 'C.J. Stroud',     team: 'HOU', color: '#002244' },
]

const ALLTIME_MVP_POOL = [
  { name: 'Tom Brady',      team: 'NE',  color: '#002244' },
  { name: 'Peyton Manning', team: 'IND', color: '#002C5F' },
  { name: 'Joe Montana',    team: 'SF',  color: '#AA0000' },
  { name: 'Dan Marino',     team: 'MIA', color: '#008E97' },
  { name: 'Brett Favre',    team: 'GB',  color: '#203731' },
  { name: 'Aaron Rodgers',  team: 'GB',  color: '#203731' },
  { name: 'Steve Young',    team: 'SF',  color: '#AA0000' },
  { name: 'John Elway',     team: 'DEN', color: '#002244' },
  { name: 'Johnny Unitas',  team: 'IND', color: '#002C5F' },
]

export function calcMVPResult(result, isAllTime = false, teamShort = null) {
  const { wins = 0, seasonTDs = 0, seasonRushTDs = 0, seasonPassYds = 0, seasonRushYds = 0, ovr = 70, playoffs = false, sbResult = null } = result
  const totalTDs = seasonTDs + seasonRushTDs
  const totalYds = seasonPassYds + seasonRushYds

  let p = 0

  // TDs — most important factor
  if (totalTDs >= 50)      p += 0.52
  else if (totalTDs >= 45) p += 0.44
  else if (totalTDs >= 40) p += 0.35
  else if (totalTDs >= 35) p += 0.25
  else if (totalTDs >= 30) p += 0.13
  // <30 TDs contributes nothing — essentially disqualifying

  // Yards — second most important
  if (totalYds >= 5500)      p += 0.32
  else if (totalYds >= 5000) p += 0.26
  else if (totalYds >= 4500) p += 0.20
  else if (totalYds >= 4000) p += 0.13
  else if (totalYds >= 3500) p += 0.05

  // OVR
  if (ovr >= 95)      p += 0.08
  else if (ovr >= 90) p += 0.05
  else if (ovr >= 85) p += 0.02

  // Wins — tiebreaker only
  if (wins >= 16)      p += 0.08
  else if (wins >= 14) p += 0.05
  else if (wins >= 12) p += 0.03
  else if (wins >= 10) p += 0.01

  if (playoffs) p += 0.02
  if (sbResult) p += 0.03

  // Hard cap: under 30 combined TDs, essentially never wins
  if (totalTDs < 30) p = Math.min(p, 0.03)
  if (wins < 10) p = 0

  if (isAllTime) p *= 0.80

  p = Math.min(p, 0.90)

  const userWins = Math.random() < p
  const pool = isAllTime ? ALLTIME_MVP_POOL : CLASSIC_MVP_POOL
  const filteredPool = teamShort ? pool.filter(w => w.team !== teamShort) : pool
  const activePool = filteredPool.length ? filteredPool : pool
  const winner = activePool[Math.floor(Math.random() * activePool.length)]
  const unanimous = wins >= 15 && totalTDs >= 40 && totalYds >= 5000

  // Generate winner stats always at least comparable/better than user's stats
  const ri = (lo, hi) => Math.round(lo + Math.random() * (hi - lo))
  const winnerTDs      = ri(Math.max(32, totalTDs + 1), Math.max(44, totalTDs + 8))
  const winnerTotalYds = ri(Math.max(3900, totalYds + 100), Math.max(4800, totalYds + 600))
  const winnerWins     = ri(Math.max(12, wins), Math.min(15, Math.max(13, wins + 2)))
  const winnerINTs     = ri(5, 12)
  const winnerCompPct  = (ri(635, 710) / 10).toFixed(1)
  const winnerRating   = ri(94, 116)

  const winnerStats = {
    wins: winnerWins,
    losses: 17 - winnerWins,
    totalYds: winnerTotalYds,
    tds: winnerTDs,
    ints: winnerINTs,
    compPct: winnerCompPct,
    rating: winnerRating,
  }

  return { userWins, winner, unanimous, winnerStats }
}

// ── Core simulation ───────────────────────────────────────────────────────────

export function runSimulation(build, types = TYPES, team = null, isAllTime = false) {
  const oppLookup = isAllTime ? ALLTIME_BY_NAME : TEAM_BY_NAME
  const ovr = calcOVR(build, types)

  // Team support factors (off/def each 1–10, 5 = league average)
  const teamOffN = team ? (team.off - 5) / 5 : 0   // −1 to +1
  const teamDefN = team ? (team.def - 5) / 5 : 0

  // ── Attribute extraction (0–11 scale → 0–1 normalized) ───────────────────
  // In lite mode, missing attributes inherit the average of filled slots so the
  // sim performance matches the displayed OVR (not a hardcoded middling default).
  const filledAvg = types.length > 0
    ? types.reduce((s, t) => s + (build[t]?.val ?? 5), 0) / types.length
    : 5
  const raw = (k) => build[k]?.val ?? filledAvg
  const n   = (k) => raw(k) / 11

  const armN  = n('arm')             // Arm strength — distance, velocity
  const legN  = n('legs')            // Mobility — rushing, escape
  const szN   = n('size')            // Build — durability, consistency
  const prN   = n('processing')      // IQ — reads, decisions, INT avoidance
  const ldN   = n('leadership')      // Leadership — NO stat impact; team/playoff bonus only
  const viN   = n('vision')          // Vision — finding receivers, coverage reads
  const pmN   = n('playmaking')      // Creativity — improvisation, scramble plays
  const acN   = n('accuracy')        // Accuracy — comp%, rating, TDs, low INTs
  const pkN   = n('pocket-presence') // Pocket — clean pocket stats, pressure handling

  // ── Passing stat baselines ───────────────────────────────────────────────
  // Each attribute's coefficient reflects its real-world influence on that stat.

  // Pass yards/game: arm (long ball yardage), accuracy (completion = more yards), vision (open receivers)
  const passYdBase = 138 + armN * 65 + acN * 45 + viN * 24 + pkN * 14 + pmN * 10 + teamOffN * 16

  // Attempts/game: inversely linked to accuracy (inaccurate QBs need more attempts) + base volume
  const attBase = 30 + (1 - acN) * 6 + randN() * 0

  // Completion %: accuracy (dominant), vision (finding open guys), processing (right reads), pocket (time to throw)
  const compBase = Math.min(0.76, 0.535 + acN * 0.105 + viN * 0.045 + prN * 0.032 + pkN * 0.022)

  // TD rate per attempt: accuracy (throws into tight windows), vision (finding end zone looks), processing (red zone)
  const tdOvrScale = ovr !== null ? Math.min(1.0, Math.max(0.80, (ovr - 55) / 40)) : 1.0
  const tdRateBase = (0.028 + acN * 0.018 + viN * 0.012 + prN * 0.009 + armN * 0.005 + teamOffN * 0.007) * tdOvrScale

  // INT rate per attempt: processing (primary reducer — reads the field), then accuracy, vision, pocket
  // Leadership has zero impact on INTs — it's not a stat attribute
  const intRateBase = Math.max(0.012,
    0.044 - prN * 0.018 - acN * 0.011 - pkN * 0.009 - viN * 0.006
  )

  // Rush yards/game: legs (dominant), playmaking (broken plays, ad libs), build (tackle-breaking, YAC)
  const rushYdBase = legN * 44 + pmN * 9 + szN * 5

  // Sacks/game: 70% pocket presence, 30% legs — bad OFF team grade adds sacks moderately
  // teamOffN is negative for bad OL/scheme teams, which drives sacks up
  const sackBase = Math.max(1.0, 3.5 - pkN * 1.60 - legN * 0.68 - teamOffN * 0.50)

  // ── Win probability ────────────────────────────────────────────────────
  // Accuracy and processing are the strongest win predictors in modern NFL.
  // Leadership has a small but real team effect on W-L (locker room rallies, etc.)
  // Size is a durability proxy — slightly reduces blowout loss risk.
  // Leadership has NO impact on individual stats — only team W-L and playoffs.

  // Sub-75 OVR penalty: low-overall QBs drag the whole team down
  const ovrPenalty = ovr !== null && ovr < 80
    ? (80 - ovr) * 0.006
      + (ovr < 75 ? (75 - ovr) * 0.010 : 0)
      + (ovr < 70 ? (70 - ovr) * 0.012 : 0)
      + (ovr < 67 ? (67 - ovr) * 0.018 : 0)
    : 0

  const winP = Math.min(0.84, Math.max(0.15,
    0.22
    + acN * 0.11   // most important — accurate QBs win
    + prN * 0.10   // smart QBs protect the ball and win close games
    + viN * 0.09   // vision drives efficiency
    + armN * 0.07  // arm = deep ball threat, opens offense
    + pkN * 0.07   // pocket presence = consistency under pressure
    + pmN * 0.05   // playmakers extend drives
    + legN * 0.04  // mobile QBs add dimension
    + ldN * 0.03   // leadership: small team W-L effect, NOT stats
    + szN * 0.02   // durability — stays healthy
    + teamOffN * 0.055  // supporting cast / scheme — bad teams penalised more
    + teamDefN * 0.065  // defense wins games independently
    - ovrPenalty
  ))

  // Playoff win probability is calculated per-game inside the loop.
  // Base 50%, adjusted equally by QB build quality and team matchup.
  const ovrN         = (ovr - 75) / 22   // steeper scale: high OVR rewarded more
  const playerTeamAvg = ((team?.off ?? 5.5) + (team?.def ?? 5.5)) / 2

  // ── Regular season simulation ────────────────────────────────────────────
  let wins = 0, losses = 0
  let seasonPassYds = 0, seasonTDs = 0, seasonINTs = 0
  let seasonRushYds = 0, seasonRushTDs = 0, seasonSacks = 0
  let seasonAttempts = 0, seasonCompletions = 0

  const schedule = buildSchedule(team)
  const games = schedule.map(({ opponent, home }, i) => {
    // Per-game variance (randN is roughly ±1.5 range, centered)
    const v = () => randN()

    // Opponent lookup first — feeds into both stat generation and win probability
    const oppTeamData = oppLookup[opponent]
    const oppOffN = oppTeamData ? (oppTeamData.off - 5) / 5 : 0
    const oppDefN = oppTeamData ? (oppTeamData.def - 5) / 5 : 0
    const oppPenalty = isAllTime ? oppOffN * 0.095 + oppDefN * 0.110 : 0

    // Regular-season weather: cold outdoor venues see adverse conditions ~18% of games
    const homeShort   = home ? (team?.short ?? '') : (oppTeamData?.short ?? '')
    const badWeather  = !DOME_TEAMS.has(homeShort) && COLD_TEAMS.has(homeShort) && Math.random() < 0.18
    const wxCompAdj   = badWeather ? -(0.02 + Math.random() * 0.04) : 0   // wet/icy: −2–6% comp
    const wxYdAdj     = badWeather ? -Math.round(12 + Math.random() * 22) : 0
    const wxIntBoost  = badWeather ? 0.003 : 0

    // Opponent defense suppresses passing stats (full weight in All-Time, 60% in classic)
    const statScale   = isAllTime ? 1.0 : 0.60
    const ydSuppress  = oppDefN * 30 * statScale
    const tdSuppress  = oppDefN * 0.006 * statScale

    const gameAtts    = Math.max(18, Math.round(attBase + v() * 5))
    const gameCompPct = Math.min(0.85, Math.max(0.28, compBase + v() * 0.07 + wxCompAdj))
    const gameComps   = Math.round(gameAtts * gameCompPct)
    const gamePassYds = Math.max(40, Math.round(passYdBase + v() * 85 - ydSuppress + wxYdAdj))
    const tdVariance  = ovr !== null && ovr >= 97 ? 1.75 : 1.4
    const tdRateGame  = Math.max(0.012, tdRateBase - tdSuppress)
    const gameTDs     = Math.max(0, Math.round(gameAtts * tdRateGame + v() * tdVariance))
    const gameINTs    = Math.max(0, Math.round(gameAtts * (intRateBase + wxIntBoost) + randN() * 0.5))
    const gameRushYds = Math.max(0, Math.round(rushYdBase + v() * 18))
    const gameRushTDs = Math.random() < (legN * 0.35 + szN * 0.08 + pmN * 0.08) ? 1 : 0
    const gameSacks   = Math.max(0, Math.round(sackBase + v() * 1.2))

    const rating = passerRating(gameComps, gameAtts, gamePassYds, gameTDs, gameINTs)

    // Win chance: base + performance premium (great game = better chance)
    const perfBonus  = (gameTDs >= 3 ? 0.06 : gameTDs >= 2 ? 0.02 : 0)
                     - (gameINTs >= 2 ? 0.07 : gameINTs === 1 ? 0.02 : 0)
    const gameWinP   = Math.min(0.90, Math.max(0.08, winP + perfBonus + (home ? 0.05 : 0) + v() * 0.05 - oppPenalty))
    const won        = Math.random() < gameWinP
    won ? wins++ : losses++

    // Score: TDs * 7 (PAT assumed) + estimated field goals + team factors
    // teamOffN boosts our scoring, teamDefN suppresses opponent scoring
    const myTDs  = gameTDs + gameRushTDs
    const estFGs = Math.max(0, Math.round(1.5 - myTDs * 0.35 + Math.random() * 1.5))
    const bonusFG = Math.random() < 0.25 ? 3 : 0
    let mySc     = Math.max(3, myTDs * 7 + estFGs * 3 + bonusFG + (teamOffN > 0 ? 3 : 0) - Math.round(oppDefN * 3))
    const oppTDs = Math.floor(1 + Math.random() * 3 + oppOffN * 0.8)
    const oppFGs = Math.max(0, Math.round(1 - oppTDs * 0.3 + Math.random()))
    let oppSc    = Math.max(0, oppTDs * 7 + oppFGs * 3 - Math.round(teamDefN * 4))
    if (won  && mySc  <= oppSc) mySc  = oppSc + 1 + Math.ceil(Math.random() * 4)
    if (!won && oppSc <= mySc)  oppSc = mySc  + 1 + Math.ceil(Math.random() * 4)
    mySc  = snapNFL(mySc)
    oppSc = snapNFL(oppSc)
    if (mySc === oppSc) { if (won) mySc = snapNFL(mySc + 3); else oppSc = snapNFL(oppSc + 3) }

    seasonPassYds     += gamePassYds
    seasonTDs         += gameTDs
    seasonINTs        += gameINTs
    seasonRushYds     += gameRushYds
    seasonRushTDs     += gameRushTDs
    seasonSacks       += gameSacks
    seasonAttempts    += gameAtts
    seasonCompletions += gameComps

    return { wk: i + 1, opponent, home, mySc, oppSc, won, passYds: gamePassYds, tds: gameTDs, ints: gameINTs, rushYds: gameRushYds, sacks: gameSacks, rating: Math.round(rating) }
  })

  seasonINTs = Math.max(3, seasonINTs)
  const seasonCompPct = Math.round((seasonCompletions / seasonAttempts) * 1000) / 10
  const seasonRating  = Math.round(passerRating(seasonCompletions, seasonAttempts, seasonPassYds, seasonTDs, seasonINTs))
  const bestGame      = [...games].sort((a, b) => {
    const score = g => g.passYds * 0.15 + g.tds * 12 + (g.ints === 0 ? 4 : 0) + g.rating * 0.1
    return score(b) - score(a)
  })[0]

  // ── Playoffs ─────────────────────────────────────────────────────────────
  const playoffs      = wins >= 10 || (wins === 9 && Math.random() < 0.50) || (wins === 8 && Math.random() < 0.06)
  const playoffRounds = []
  let sbResult = null
  let hasBye   = false

  if (playoffs) {
    const conf     = team?.conf ?? 'AFC'
    const activePlayoffPools = isAllTime ? ALLTIME_PLAYOFF_POOLS : PLAYOFF_POOLS
    const activeSbPools      = isAllTime ? ALLTIME_SB_POOLS      : SB_POOLS
    // Strip player's own team from pool once, upfront
    const confPool = activePlayoffPools[conf].filter(n => n !== team?.name)
    const sbPool   = activeSbPools[conf].filter(n => n !== team?.name)
    const usedOpponents = new Set()
    const pick = (pool) => {
      const available = pool.filter(n => !usedOpponents.has(n))
      // Fallback: if pool is somehow exhausted, allow repeats but never own team
      const chosen = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : pool[Math.floor(Math.random() * pool.length)]
      usedOpponents.add(chosen)
      return chosen
    }
    hasBye = wins >= 14 ? true : wins >= 13 ? Math.random() < 0.60 : false
    const playoffBracket = hasBye
      ? [
          { round: 'Divisional Round',        opponents: confPool },
          { round: 'Conference Championship', opponents: confPool },
          { round: 'Super Bowl',              opponents: sbPool },
        ]
      : [
          { round: 'Wild Card',               opponents: confPool },
          { round: 'Divisional Round',        opponents: confPool },
          { round: 'Conference Championship', opponents: confPool },
          { round: 'Super Bowl',              opponents: sbPool },
        ]
    const winsNeeded = hasBye ? 3 : 4
    // Estimated seed for home-field logic
    const seed = (hasBye && wins >= 14) ? 1 : hasBye ? 2 : wins >= 12 ? 3 : wins >= 11 ? 4 : 5
    const pgHomeProb = (round) => {
      if (round === 'Super Bowl') return 0
      if (seed === 1) return 1.0
      if (round === 'Wild Card') {
        // In the NFL, seeds 2-4 always host Wild Card; seeds 5+ always travel
        return seed <= 4 ? 1.0 : 0.0
      }
      if (round === 'Divisional Round') {
        // Lower seeds almost always travel to 1 or 2 seed after winning Wild Card
        if (seed === 2) return 0.80
        if (seed === 3) return 0.10
        if (seed === 4) return 0.08
        return 0.05
      }
      if (round === 'Conference Championship') {
        // 2 seed hosts if they're the highest remaining; lower seeds rarely host
        if (seed === 2) return 0.60
        if (seed === 3) return 0.20
        if (seed === 4) return 0.12
        return 0.10
      }
      return 0
    }

    let pwins = 0, eliminated = null
    for (const { round, opponents } of playoffBracket) {
      const opponent   = pick(opponents)
      const pgHome     = Math.random() < pgHomeProb(round)
      const homeShort  = pgHome ? team?.short : TEAM_BY_NAME[opponent]?.short
      const weather    = playoffWeather(homeShort, round === 'Super Bowl')
      const oppTeam    = oppLookup[opponent]
      const oppTeamAvg = ((oppTeam?.off ?? 5.5) + (oppTeam?.def ?? 5.5)) / 2
      const teamN        = (playerTeamAvg - oppTeamAvg) / 9
      const pgOvrPenalty = ovr !== null && ovr < 85
        ? (85 - ovr) * 0.011
        : 0
      const pgWinP     = Math.min(0.90, Math.max(0.10, 0.30 + ovrN * 0.61 + teamN * 0.41 - pgOvrPenalty + (pgHome ? 0.03 : 0) - (isAllTime ? 0.09 : 0)))
      const won        = Math.random() < pgWinP

      // Playoff game stats use similar logic but with higher stakes variance
      const pgAtts  = Math.round(35 + randN() * 5)
      const pgComp  = Math.round(pgAtts * (compBase + randN() * 0.05))
      const pgYds   = Math.max(100, Math.round(passYdBase * 1.08 + randN() * 75))
      const pgTDs   = Math.max(0, Math.round(pgAtts * tdRateBase * 1.15 + randN() * 1.0))
      const pgINTs  = Math.max(0, Math.round(pgAtts * intRateBase + randN() * 0.5))
      const pgRtg   = Math.round(passerRating(pgComp, pgAtts, pgYds, pgTDs, pgINTs))

      const oppTeamOffN = oppTeam ? (oppTeam.off - 5) / 5 : 0
      const oppTeamDefN = oppTeam ? (oppTeam.def - 5) / 5 : 0
      const weatherMult = weather === 'snow'
        ? (homeShort === 'BUF' || homeShort === 'GB' ? 0.95 : 0.90)
        : weather === 'rain' ? 0.90 : 1.0
      const pgFGs     = Math.max(0, Math.round(1.2 - pgTDs * 0.35 + Math.random() * 1.2))
      const pgBonusFG = Math.random() < 0.25 ? 3 : 0
      const base   = Math.max(3, Math.round((pgTDs * 7 + pgFGs * 3 + pgBonusFG + (teamOffN > 0 ? 3 : 0) - Math.round(oppTeamDefN * 3)) * weatherMult))
      const oppPTDs = Math.floor(1 + Math.random() * 3 + oppTeamOffN * 0.8)
      const oppPFGs = Math.max(0, Math.round(1 - oppPTDs * 0.3 + Math.random()))
      const opp    = Math.max(7, Math.round((oppPTDs * 7 + oppPFGs * 3 - Math.round(teamDefN * 3)) * weatherMult))
      // Overtime: playoff games are close — ~20% OT rate for even matchups
      const pgCloseness = 1 - 2 * Math.abs(pgWinP - 0.5)
      const pgOT        = Math.random() < pgCloseness * 0.22
      let finalMy, finalOpp
      if (pgOT) {
        const baseTDs2 = Math.max(pgTDs, Math.floor(1 + Math.random() * 3 + oppTeamOffN * 0.8), 1)
        const tiedSc   = snapNFL(Math.max(10, baseTDs2 * 7 + Math.floor(Math.random() * 3) * 3))
        const otPts    = Math.random() < 0.27 ? 7 : 3
        finalMy  = won ? tiedSc + otPts : tiedSc
        finalOpp = won ? tiedSc : tiedSc + otPts
      } else {
        const margin = Math.ceil(Math.random() * 7)
        finalMy  = snapNFL(won ? Math.max(base, opp + margin)  : Math.min(base, opp - margin))
        finalOpp = snapNFL(won ? opp : Math.max(opp, base + margin))
      }

      playoffRounds.push({ round, opponent, home: pgHome, weather, mySc: finalMy, oppSc: finalOpp, won, overtime: pgOT, passYds: pgYds, tds: pgTDs, ints: pgINTs, rating: pgRtg })
      if (won) { pwins++ } else { eliminated = round; break }
    }

    if (pwins === winsNeeded) {
      const sbAtts = Math.round(38 + randN() * 4)
      const sbComp = Math.round(sbAtts * (compBase + randN() * 0.04))
      const sbYds  = Math.max(150, Math.round(passYdBase * 1.08 + randN() * 60))
      const sbTDs  = Math.max(1,   Math.round(sbAtts * tdRateBase * 1.15 + randN() * 0.6))
      const sbINTs = Math.max(0,   Math.round(sbAtts * intRateBase * 0.8 + randN() * 0.4))
      sbResult = {
        won: true,
        passYds: sbYds,
        tds: sbTDs,
        ints: sbINTs,
        rating: Math.round(passerRating(sbComp, sbAtts, sbYds, sbTDs, sbINTs)),
      }
    } else {
      sbResult = { won: false, round: eliminated, pwins }
    }
  }

  return {
    team, ovr, wins, losses,
    games,
    highlights: games.filter(g => g.wk <= 4 || g.wk >= 14),
    seasonPassYds, seasonTDs, seasonINTs,
    seasonRushYds, seasonRushTDs, seasonSacks,
    seasonAttempts, seasonCompletions, seasonCompPct,
    seasonRating,
    bestGame,
    playoffs, playoffRounds, sbResult, hasBye: playoffs && hasBye,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── RB SIMULATION ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const RB_ATTR_WEIGHT = {
  'speed':       0.14,
  'burst':       0.14,
  'strength':    0.14,
  'size':        0.11,
  'balance':     0.13,
  'elusiveness': 0.15,
  'hands':       0.11,
  'vision':      0.12,
  'carrying':    0.05,
}

export function calcOVRRB(build, types = RB_TYPES) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return null

  const totalW = filled.reduce((s, t) => s + (RB_ATTR_WEIGHT[t] ?? 0.05), 0)
  const avg    = filled.reduce((s, t) => s + build[t].val * (RB_ATTR_WEIGHT[t] ?? 0.05) / totalW, 0)
  const vals   = filled.map(t => build[t].val)
  const base   = 62 + 2.0 * avg + 0.19 * avg * avg

  let bonus = 0
  if (filled.length === types.length) {
    const spread = Math.max(...vals) - Math.min(...vals)
    const minVal = Math.min(...vals)
    if (spread <= 1) bonus += 2.5
    else if (spread <= 2) bonus += 1.0
    else if (spread <= 3) bonus += 0.3
    if (minVal >= 9) bonus += 2.0
    else if (minVal >= 8) bonus += 0.5
  }

  return Math.min(99, Math.max(0, Math.round(base + bonus)))
}

export function getArchetypeRB(ovr, build, types = RB_TYPES) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return 'Spin to start building'
  const rem = types.length - filled.length
  if (rem > 0) return `${rem} attribute${rem !== 1 ? 's' : ''} remaining`

  const g   = k => build[k]?.val ?? 0
  const spd = g('speed'), bst = g('burst'), str = g('strength'), sz  = g('size')
  const bal = g('balance'), hnd = g('hands'), vis = g('vision'), elu = g('elusiveness')

  const vals   = filled.map(t => build[t].val)
  const spread = Math.max(...vals) - Math.min(...vals)

  const ranked = [
    { k: 'spd', v: spd }, { k: 'bst', v: bst }, { k: 'str', v: str }, { k: 'sz',  v: sz  },
    { k: 'bal', v: bal }, { k: 'hnd', v: hnd }, { k: 'vis', v: vis }, { k: 'elu', v: elu },
  ].sort((a, b) => b.v - a.v)

  const t1   = ranked[0].k
  const t2   = ranked[1].k
  const t3   = ranked[2].k
  const top  = k => t1 === k || t2 === k
  const top3 = k => t1 === k || t2 === k || t3 === k
  const hi   = v => v >= 10
  const up   = v => v >= 9
  const ok   = v => v >= 7

  if (ovr >= 95) {
    if (hi(spd) && hi(bst) && hi(elu))              return 'Once-in-a-Generation Back'
    if (hi(str) && hi(sz) && hi(bal))               return 'Unstoppable Force'
    if (hi(spd) && hi(elu) && up(hnd))              return 'Total Package'
    if (hi(spd) && hi(elu))                         return 'Ghost in the Backfield'
    if (hi(hnd) && hi(vis) && hi(elu))              return 'Complete Back'
    if (hi(str) && hi(bal))                         return 'Generational YAC Machine'
    if (spread <= 1)                                return 'Generational Talent'
    return 'Transcendent Back'
  }

  if (ovr >= 90) {
    if (top('str') && top('sz') && top3('bal'))     return 'Freight Train'
    if (top('spd') && top('bst') && top3('elu'))    return 'The Blur'
    if (top('spd') && top('hnd') && up(elu))        return 'Elite Dual Threat'
    if (top('hnd') && top('vis') && top3('elu'))    return 'Elite Three-Down Back'
    if (top('spd') && top('elu') && up(bst))        return 'Human Joystick'
    if (top('str') && top('sz'))                    return 'Battering Ram'
    if (top('spd') && top('bst'))                   return 'Home Run Threat'
    if (top('vis') && top('bal') && up(bst))        return 'One-Cut Assassin'
    if (top('str') && top('bal'))                   return 'YAC Monster'
    if (top('hnd') && top('spd'))                   return 'Dual Threat'
    if (top('hnd') && top('elu'))                   return 'Receiving Weapon'
    if (spread <= 2)                                return 'Franchise Back'
    return 'Bell Cow'
  }

  if (ovr >= 86) {
    if (top('str') && top('sz') && up(bal))         return 'Power Back'
    if (top('str') && top('sz'))                    return 'Bruiser'
    if (ovr >= 88 && top('spd') && top('sz'))       return 'Freight Train'
    if (top('spd') && top('hnd') && ok(elu))        return 'Dual Threat'
    if (top('spd') && top('bst') && ok(elu))        return 'Home Run Threat'
    if (top('spd') && top('bst') && str < 9)        return 'Speedster'
    if (top('hnd') && top('vis') && ok(elu))        return 'Chain Mover'
    if (top('hnd') && top('elu'))                   return 'Satellite Back'
    if (top('vis') && top('bal') && ok(str))        return 'Inside Zone Runner'
    if (top('vis') && top('bal'))                   return 'One-Cut Runner'
    if (top('bst') && top('elu') && str < 8 && sz < 8) return 'Shifty Back'
    if (top('str') && top('bal'))                   return 'North-South Runner'
    if (spread <= 2)                                return 'Workhorse Back'
    return 'Pro Bowl Back'
  }

  if (ovr >= 84) {
    if (top('str') && top('sz') && up(bal))         return 'Power Back'
    if (top('str') && top('sz'))                    return 'Bruiser'
    if (top('spd') && top('hnd') && ok(elu))        return 'Dual Threat'
    if (top('spd') && top('bst') && ok(elu))        return 'Home Run Threat'
    if (top('spd') && top('bst') && str < 9)        return 'Speedster'
    if (top('hnd') && top('vis') && ok(elu))        return 'Chain Mover'
    if (sz < 8 && top('hnd') && top('elu'))         return 'Scat Back'
    if (top('hnd') && top('elu'))                   return 'Satellite Back'
    if (top('vis') && top('bal') && ok(str))        return 'Inside Zone Runner'
    if (top('vis') && top('bal'))                   return 'One-Cut Runner'
    if (top('bst') && top('elu') && str < 8 && sz < 8) return 'Shifty Back'
    if (top('str') && top('bal'))                   return 'North-South Runner'
    if (spread <= 2)                                return 'Reliable Starter'
    return 'Solid Back'
  }

  if (ovr >= 76) {
    if (top('str') && top('sz') && up(str))         return 'Short-Yardage Hammer'
    if (top('str') && top('sz'))                    return 'Goal-Line Threat'
    if (top('spd') && top('hnd'))                   return 'Dual Threat'
    if (top('spd') && top('elu') && ok(bst))        return 'Change of Pace'
    if (top('spd') && top('bst') && str < 9)        return 'Speed Back'
    if (top('hnd') && top('vis') && ok(elu))        return 'Chain Mover'
    if (sz < 8 && top('hnd') && top('elu'))         return 'Scat Back'
    if (top('hnd') && top('elu'))                   return 'Satellite Back'
    if (top('vis') && top('bal') && ok(str))        return 'Zone Runner'
    if (top('vis') && top('bal'))                   return 'Between the Tackles'
    if (top('bst') && top('elu') && str < 7)        return 'Gadget Back'
    if (top('str') && top('bal'))                   return 'Downhill Runner'
    if (spread <= 2)                                return 'Reliable Starter'
    return 'Starting Back'
  }

  if (ovr >= 68) {
    if (top('str') && top('sz'))                    return 'Goal-Line Back'
    if (top('spd') && top('hnd'))                   return 'Pass-Catching Back'
    if (top('spd') && up(spd))                      return 'Burner'
    if (top('hnd') && top('vis'))                   return 'Pass-Catching Back'
    if (top('vis') && top('bal'))                   return 'Backup Runner'
    if (spread >= 5)                                return 'Raw Athlete'
    return 'Rotational Back'
  }

  if (ovr >= 60) return (str >= 8 || sz >= 8) ? 'Power Project' : 'Depth Back'
  if (ovr >= 50) return (spd >= 9 || bst >= 9) ? 'Speed Project' : 'Practice Squad Candidate'
  return 'Practice Squad'
}

// ── OPOY pools (Offensive Player of the Year) — shared across RB / WR / TE modes ─

const CLASSIC_OPOY_POOL = [
  { name: 'Justin Jefferson',    team: 'MIN', color: '#4F2683', pos: 'WR' },
  { name: "Ja'Marr Chase",       team: 'CIN', color: '#FB4F14', pos: 'WR' },
  { name: 'CeeDee Lamb',         team: 'DAL', color: '#003594', pos: 'WR' },
  { name: 'Puka Nacua',          team: 'LAR', color: '#003594', pos: 'WR' },
  { name: 'Malik Nabers',        team: 'NYG', color: '#0B2265', pos: 'WR' },
  { name: 'Saquon Barkley',      team: 'PHI', color: '#004C54', pos: 'RB' },
  { name: 'Derrick Henry',       team: 'BAL', color: '#241773', pos: 'RB' },
  { name: 'Christian McCaffrey', team: 'SF',  color: '#AA0000', pos: 'RB' },
  { name: 'Bijan Robinson',      team: 'ATL', color: '#A71930', pos: 'RB' },
]

const ALLTIME_OPOY_POOL = [
  { name: 'Jerry Rice',          team: 'SF',  color: '#AA0000', pos: 'WR' },
  { name: 'Randy Moss',          team: 'MIN', color: '#4F2683', pos: 'WR' },
  { name: 'Calvin Johnson',      team: 'DET', color: '#0076B6', pos: 'WR' },
  { name: 'Terrell Owens',       team: 'DAL', color: '#003594', pos: 'WR' },
  { name: 'Marvin Harrison',     team: 'IND', color: '#002C5F', pos: 'WR' },
  { name: 'Barry Sanders',       team: 'DET', color: '#0076B6', pos: 'RB' },
  { name: 'LaDainian Tomlinson', team: 'LAC', color: '#002A5E', pos: 'RB' },
  { name: 'Walter Payton',       team: 'CHI', color: '#0B162A', pos: 'RB' },
  { name: 'Adrian Peterson',     team: 'MIN', color: '#4F2683', pos: 'RB' },
  { name: 'Emmitt Smith',        team: 'DAL', color: '#003594', pos: 'RB' },
]

export function calcOPOYResult(result, isAllTime = false, teamShort = null) {
  const { wins = 0, seasonRushYds = 0, seasonRushTDs = 0, seasonRecYds = 0, seasonRecTDs = 0, seasonLong = 0, seasonYPC = 0, ovr = 70 } = result
  const totalTDs = seasonRushTDs + seasonRecTDs
  const totalYds = seasonRushYds + seasonRecYds

  let p = 0

  // Rushing yards — primary RB OPOY driver; elite seasons cross 1700+
  if (seasonRushYds >= 2200)      p += 0.42
  else if (seasonRushYds >= 2000) p += 0.33
  else if (seasonRushYds >= 1800) p += 0.22
  else if (seasonRushYds >= 1600) p += 0.10
  else if (seasonRushYds >= 1400) p += 0.03

  // Total TDs — crucial alongside yardage; voters love TD volume
  if (totalTDs >= 25)             p += 0.28
  else if (totalTDs >= 20)        p += 0.20
  else if (totalTDs >= 16)        p += 0.10
  else if (totalTDs >= 12)        p += 0.03

  // Receiving yards — CMC-type backs dominate because they hurt WR competition
  if (seasonRecYds >= 1000)       p += 0.09
  else if (seasonRecYds >= 700)   p += 0.05
  else if (seasonRecYds >= 500)   p += 0.02

  // Wins — team success is required; OPOY rarely goes to a losing team's player
  if (wins >= 14)                 p += 0.10
  else if (wins >= 12)            p += 0.06
  else if (wins >= 10)            p += 0.02

  // OVR — overall perception affects voters
  if (ovr >= 95)                  p += 0.04
  else if (ovr >= 90)             p += 0.02

  // Hard caps
  if (seasonRushYds < 1500 && totalYds < 1700) p = Math.min(p, 0.01)
  if (totalTDs < 12)        p = Math.min(p, 0.04)
  if (wins < 7)             p = 0

  // Guaranteed thresholds — these seasons are undeniable
  if (totalYds >= 2100 && wins >= 10) {
    const unanimous = totalYds >= 2300 || totalTDs >= 22
    return { userWins: true, winner: null, unanimous, winnerStats: null }
  }
  if (totalTDs >= 17 && wins >= 10) {
    const unanimous = totalTDs >= 28 && wins >= 12
    return { userWins: true, winner: null, unanimous, winnerStats: null }
  }

  // WR competition — 3 elite WRs in the field make it meaningfully harder
  p *= 0.85

  if (isAllTime) p *= 0.75
  p = Math.min(p, 0.88)

  const userWins = Math.random() < p
  const pool = isAllTime ? ALLTIME_OPOY_POOL : CLASSIC_OPOY_POOL
  const filteredPool = teamShort ? pool.filter(w => w.team !== teamShort) : pool
  const activePool = filteredPool.length ? filteredPool : pool
  const winner = activePool[Math.floor(Math.random() * activePool.length)]
  const unanimous = wins >= 14 && seasonRushYds >= 2000 && totalTDs >= 22

  const ri = (lo, hi) => Math.round(lo + Math.random() * (hi - lo))
  const winnerWins = ri(Math.max(11, wins), Math.min(15, Math.max(12, wins + 2)))

  let winnerStats
  if (winner.pos === 'WR') {
    winnerStats = {
      wins:   winnerWins,
      losses: 17 - winnerWins,
      recYds: ri(1500, 1900),
      recTDs: ri(8, 15),
      ypc:    +(ri(125, 165) / 10).toFixed(1),
    }
  } else {
    winnerStats = {
      wins:    winnerWins,
      losses:  17 - winnerWins,
      rushYds: ri(Math.max(1450, seasonRushYds + 20), Math.min(2050, Math.max(1700, seasonRushYds + 150))),
      recYds:  ri(Math.max(150,  seasonRecYds - 50),  Math.min(400,  Math.max(250,  seasonRecYds + 50))),
      tds:     ri(Math.max(10,   totalTDs + 1),       Math.min(20,   Math.max(14,   totalTDs + 3))),
    }
  }

  return { userWins, winner, unanimous, winnerStats }
}

export function runRBSimulation(build, types = RB_TYPES, team = null, isAllTime = false) {
  const oppLookup = isAllTime ? ALLTIME_BY_NAME : TEAM_BY_NAME
  const ovr = calcOVRRB(build, types)

  // Use RB-specific offensive ratings: QB is a separate asset in RB mode
  const rbOff = team?.short && !isAllTime ? (RB_RATINGS[team.short]?.off ?? team.off) : team?.off
  const teamOffN = rbOff != null ? (rbOff - 5) / 5 : 0
  const teamDefN = team ? (team.def - 5) / 5 : 0

  // Attribute normalizers (0–1 scale)
  const filledAvg = types.length > 0
    ? types.reduce((s, t) => s + (build[t]?.val ?? 5), 0) / types.length
    : 5
  const raw = k => build[k]?.val ?? filledAvg
  const n   = k => raw(k) / 11

  const spdN = n('speed')       // breakaway runs, open-field YPC
  const bstN = n('burst')       // short-area quickness, YPC efficiency
  const strN = n('strength')    // red zone TDs, broken tackles, grip (fumbles)
  const szN  = n('size')        // carries workload, goal line, fumble security
  const balN = n('balance')     // YPC through contact, fewer fumbles
  const hndN = n('hands')       // receptions, rec yards, rec TDs
  const visN = n('vision')      // reading blocks, YPC, big-play patience
  const eluN = n('elusiveness') // open-field cuts, long runs
  const cryN = n('carrying')    // ball security, fumble prevention

  // ── Per-game stat baselines ───────────────────────────────────────────────
  // Carries: size = bell-cow usage; OVR star treatment drives extra opportunities; vision = coaches trust
  const ovrCarryN = ovr != null ? Math.min(isAllTime ? 0.75 : 0.60, (ovr - 75) / 22) : 0
  const carriesBase = 11.0 + szN * 5.8 + ovrCarryN * 6.0 + visN * 1.0 - hndN * hndN * 2.5 + (isAllTime ? 1.2 : 0)

  // Curve multiplier: penalises bad backs (< OVR 80) on a steepening slope; elite backs unaffected
  const lowOvrCurve = ovr !== null && ovr < 80
    ? Math.max(0.68, 1.0 - (80 - ovr) * 0.014)
    : 1.0

  // YPC: balance + vision are the true YPC drivers (staying upright, reading blocks).
  // Burst = first-step burst through the hole; strength/size = extra yards after contact.
  // Speed matters mainly for breakaway plays, not base per-carry average.
  const ypcBase = Math.min(isAllTime ? 5.9 : 5.5, 2.6 + balN * 0.62 + visN * 0.72 + bstN * 0.42 + strN * 0.28 + szN * 0.18 + eluN * 0.23 + spdN * 0.09 + teamOffN * 0.24)

  // Rush TD rate: red-zone specialists (strength/size) score far more than speed backs
  const tdRate = 0.015 + strN * 0.016 + szN * 0.013 + balN * 0.008 + visN * 0.006 + teamOffN * 0.007

  // Fumble probability per game: carrying is the sole driver
  const fumbleBase = Math.max(0.008, 0.29 - cryN * 0.26)

  // Receiving: hands dominant; elusiveness = route running/separation; burst = out-of-backfield
  const recBase   = 0.40 + hndN * 2.8 + eluN * 0.80 + bstN * 0.30 + teamOffN * 0.30 + hndN * hndN * 0.9
  const yprBase   = 7.0  + spdN * 1.8 + eluN * 1.2  + bstN * 0.50
  const recTDRate = 0.07 + hndN * 0.14 + eluN * 0.042 + bstN * 0.018 + teamOffN * 0.014

  // ── Win probability — team is the foundation, RB is the add-on ──────────
  const ovrPenalty = ovr !== null && ovr < 72
    ? (72 - ovr) * 0.004 + (ovr < 65 ? (65 - ovr) * 0.005 : 0)
    : 0
  // Quadratic star bonus: 85→+1win, 90→+2, 95→+4, 99→+6 (vs OVR-75 baseline)
  const starBonus = ovr !== null && ovr > 75
    ? Math.min(0.30, (ovr - 75) * (ovr - 75) * 0.00052)
    : 0
  const winP = Math.min(0.89, Math.max(0.18,
    0.41
    + (spdN + bstN + strN + szN + balN + visN + hndN + eluN) * 0.01
    + starBonus
    + teamOffN * 0.195
    + teamDefN * 0.195
    - ovrPenalty
  ))

  const ovrN = ovr !== null ? (ovr - 75) / 22 : 0
  const playerTeamAvg = ((team?.off ?? 5.5) + (team?.def ?? 5.5)) / 2

  // ── Regular season ────────────────────────────────────────────────────────
  let wins = 0, losses = 0
  let seasonRushYds = 0, seasonRushTDs = 0, seasonCarries = 0, seasonFumbles = 0
  let seasonRecYds  = 0, seasonRecTDs  = 0, seasonRecs    = 0
  let seasonLong    = 0, hundredYardGames = 0

  const schedule = buildSchedule(team)
  const games = schedule.map(({ opponent, home }, i) => {
    const v = () => randN()

    // Opponent lookup first
    const oppTeam = oppLookup[opponent]
    const oppDefN = oppTeam ? (oppTeam.def - 5) / 5 : 0
    const oppOffN = oppTeam ? (oppTeam.off - 5) / 5 : 0
    const opponentShort = oppTeam?.short ?? ''
    const oppPenalty = isAllTime ? oppOffN * 0.09 + oppDefN * 0.10 : 0

    // Weather: cold outdoor venue → slippery footing, wet ball
    const homeShort  = home ? (team?.short ?? '') : opponentShort
    const badWeather = !DOME_TEAMS.has(homeShort) && COLD_TEAMS.has(homeShort) && Math.random() < 0.16
    const wxYpcHit   = badWeather ? (0.15 + Math.random() * 0.20) : 0
    const wxFumble   = badWeather ? 0.022 : 0

    // Limited game: injury, illness, load management, coach's decision (~7%)
    const isLimited = Math.random() < 0.07

    // Opponent defense directly suppresses touches and efficiency (60% weight in classic)
    const statScale       = isAllTime ? 1.0 : 0.65
    const defCarryPenalty = oppDefN * 1.1 * statScale
    const defYpcPenalty   = oppDefN * 0.28 * statScale

    // Game mood — four tiers; legendary tier gated by elite OVR (88+)
    const gameMood       = Math.random()
    const dudThreshold   = 0.16 + oppDefN * 0.12   // elite D (~0.8): ~26% duds; weak D (~-0.8): ~6%
    const breakThreshold = 0.78 + oppDefN * 0.08   // elite D: breakout starts at 86%; weak D: 70%
    const isDud          = !isLimited && gameMood < dudThreshold
    const isBreakout     = !isLimited && gameMood > breakThreshold
    // Legendary: rare sub-tier of breakout — single-game record territory is achievable
    const isLegendary    = isBreakout && (
      ovr >= 95 ? Math.random() < 0.06 :
      ovr >= 88 ? Math.random() < 0.025 : false
    )

    const carryMult = isDud       ? (0.42 + Math.random() * 0.22)
                    : isLegendary ? (1.22 + Math.random() * 0.32)   // 1.22–1.54×
                    : isBreakout  ? (1.08 + Math.random() * 0.22)   // 1.08–1.30×
                    : 1.0
    const ypcMult   = isDud       ? (0.46 + Math.random() * 0.26)
                    : isLegendary ? (1.42 + Math.random() * 0.50)   // 1.42–1.92× — record pace
                    : isBreakout  ? (1.10 + Math.random() * 0.28)   // 1.10–1.38×
                    : 1.0

    // Bad weather → teams pound the run to control the clock and protect the ball
    const wxCarryBoost = badWeather ? (0.8 + Math.random() * 1.5) : 0

    // Carries — capped at 36 (modern era realistic max)
    const baseCarries = Math.min(36, Math.max(3, Math.round((carriesBase - defCarryPenalty + v() * 6 + wxCarryBoost) * carryMult * lowOvrCurve)))
    const gameCarries = isLimited ? Math.max(2, Math.round(3 + Math.random() * 5)) : baseCarries

    // YPC — noise is INDEPENDENT of ypcMult; prevents runaway amplification in elite breakouts
    const gameYPC = Math.max(1.2, (ypcBase - defYpcPenalty - wxYpcHit) * ypcMult + v() * 1.6)

    // Rush yards — larger noise term allows explosive single-game totals
    const rawRushYds = Math.max(0, Math.round(gameCarries * gameYPC + (isLimited ? 0 : v() * 18)))

    // Rush TDs
    const gameTDPull = v() * 0.8
    const rawRushTDs = isLimited ? 0 : Math.max(0, Math.round(gameCarries * tdRate + gameTDPull))

    // Fumbles — weather raises risk
    const gameFumbles = Math.random() < (fumbleBase + wxFumble + Math.random() * 0.018) ? 1 : 0

    // Receiving — heavy carry workload reduces targets (game script eats into routes)
    const workloadCut = gameCarries > 20
      ? Math.max(0.40, Math.min(0.95, 0.40 + hndN * 0.60))
      : gameCarries > 15
        ? Math.max(0.55, Math.min(1.0,  0.55 + hndN * 0.50))
        : 1.0
    const gameRecs    = Math.max(0, Math.round((recBase + v() * 1.8) * workloadCut))
    const gameRecYds  = gameRecs > 0 ? Math.max(0, Math.round(gameRecs * (yprBase + v() * 2.5))) : 0
    const gameRecTDs  = gameRecs > 0 && !isLimited && Math.random() < (recTDRate + v() * 0.018) ? 1 : 0

    // Long run — duds rarely break one; breakout games often have the big play
    const moodBreakMult = isDud ? 0.12 : isBreakout ? 1.9 : 1.0
    const breakChance   = Math.max(0.03, (0.13 + spdN * 0.18 + eluN * 0.07) * (badWeather ? 0.60 : 1.0) * (1 - oppDefN * 0.22 * statScale) * moodBreakMult)
    const hasBig  = !isLimited && Math.random() < breakChance
    const gameLong = hasBig
      ? Math.round(22 + spdN * 35 + eluN * 12 + Math.random() * 22)
      : Math.round(7  + spdN * 6  + visN * 3  + Math.random() * 7)

    // Win probability
    const perfBonus = (rawRushYds >= 150 ? 0.05 : rawRushYds >= 100 ? 0.02 : 0)
                    + (rawRushTDs + gameRecTDs >= 2 ? 0.03 : 0)
                    - (gameFumbles ? 0.06 : 0)
    const gameWinP = Math.min(0.92, Math.max(0.08,
      winP + perfBonus + (home ? 0.04 : 0) + v() * 0.10 - oppPenalty
    ))
    const won = Math.random() < gameWinP
    won ? wins++ : losses++

    // Score generation: compute before scriptAdj so margin is available for game script logic
    const rawRBTDs = rawRushTDs + gameRecTDs
    const teamTDs  = Math.max(0, Math.round(1.4 + teamOffN * 1.1 + v() * 0.9))
    const totalTDs = rawRBTDs + teamTDs
    const estFGs   = Math.max(0, Math.round(1.5 - totalTDs * 0.30 + Math.random() * 1.5))
    let mySc = Math.max(3, totalTDs * 7 + estFGs * 3 - Math.round(oppDefN * 3))
    const oppTDs = Math.floor(1.2 + Math.random() * 3 + oppOffN * 0.9)
    const oppFGs = Math.max(0, Math.round(1 - oppTDs * 0.3 + Math.random()))
    let oppSc = Math.max(0, oppTDs * 7 + oppFGs * 3 - Math.round(teamDefN * 4))
    if (won  && mySc  <= oppSc) mySc  = oppSc + 1 + Math.ceil(Math.random() * 4)
    if (!won && oppSc <= mySc)  oppSc = mySc  + 1 + Math.ceil(Math.random() * 4)
    mySc  = snapNFL(mySc)
    oppSc = snapNFL(oppSc)
    if (mySc === oppSc) { if (won) mySc = snapNFL(mySc + 3); else oppSc = snapNFL(oppSc + 3) }

    // Game script: blowout wins → more clock-kill carries; blowout losses → abandon the run
    const margin = mySc - oppSc
    const scriptAdj = isLimited ? 0
      : margin >= 21 ? Math.floor(Math.random() * 5 + 1)   // big win: +1 to +5
      : margin >= 10 ? Math.floor(Math.random() * 3)        // win: +0 to +2
      : margin <= -21 ? -Math.floor(Math.random() * 5 + 2)  // big loss: −2 to −6
      : margin <= -10 ? -Math.floor(Math.random() * 3 + 1)  // loss: −1 to −3
      : won ? 1 : 0                                          // close win: +1 for clock
    const gameCarriesFinal = Math.max(3, gameCarries + scriptAdj)
    const gameRushYds      = Math.max(0, Math.round(gameCarriesFinal * gameYPC))
    const gameRushTDs      = rawRushTDs

    seasonRushYds += gameRushYds
    seasonRushTDs += gameRushTDs
    seasonCarries += gameCarriesFinal
    seasonFumbles += gameFumbles
    seasonRecYds  += gameRecYds
    seasonRecTDs  += gameRecTDs
    seasonRecs    += gameRecs
    if (gameLong > seasonLong) seasonLong = gameLong
    if (gameRushYds >= 100) hundredYardGames++

    return {
      wk: i + 1, opponent, home, mySc, oppSc, won,
      rushYds: gameRushYds, rushTDs: gameRushTDs, carries: gameCarriesFinal,
      recYds: gameRecYds, recTDs: gameRecTDs, recs: gameRecs,
      fumbles: gameFumbles, long: gameLong,
      ypc: Math.round((gameRushYds / Math.max(1, gameCarriesFinal)) * 10) / 10,
    }
  })

  const seasonYPC = seasonCarries > 0
    ? Math.round((seasonRushYds / seasonCarries) * 100) / 100
    : 0.00

  const bestGame = [...games].sort((a, b) => {
    const score = g => g.rushYds * 0.14 + (g.rushTDs + g.recTDs) * 15 + g.recYds * 0.08 - g.fumbles * 8
    return score(b) - score(a)
  })[0]

  // ── Playoffs ──────────────────────────────────────────────────────────────
  const playoffs = wins >= 10
    || (wins === 9 && Math.random() < 0.50)
    || (wins === 8 && Math.random() < 0.06)
  const playoffRounds = []
  let sbResult = null
  let hasBye = false

  if (playoffs) {
    const conf = team?.conf ?? 'AFC'
    const activePlayoffPools = isAllTime ? ALLTIME_PLAYOFF_POOLS : PLAYOFF_POOLS
    const activeSbPools      = isAllTime ? ALLTIME_SB_POOLS      : SB_POOLS
    const confPool = activePlayoffPools[conf].filter(n => n !== team?.name)
    const sbPool   = activeSbPools[conf].filter(n => n !== team?.name)
    const usedOpponents = new Set()
    const pick = pool => {
      const avail = pool.filter(n => !usedOpponents.has(n))
      const chosen = (avail.length > 0 ? avail : pool)[Math.floor(Math.random() * (avail.length || pool.length))]
      usedOpponents.add(chosen)
      return chosen
    }

    hasBye = wins >= 14 ? true : wins >= 13 ? Math.random() < 0.60 : false
    const bracket = hasBye
      ? [
          { round: 'Divisional Round',        pool: confPool },
          { round: 'Conference Championship', pool: confPool },
          { round: 'Super Bowl',              pool: sbPool   },
        ]
      : [
          { round: 'Wild Card',               pool: confPool },
          { round: 'Divisional Round',        pool: confPool },
          { round: 'Conference Championship', pool: confPool },
          { round: 'Super Bowl',              pool: sbPool   },
        ]
    const winsNeeded = hasBye ? 3 : 4
    const seed = hasBye && wins >= 14 ? 1 : hasBye ? 2 : wins >= 12 ? 3 : wins >= 11 ? 4 : 5

    const pgHomeProb = round => {
      if (round === 'Super Bowl') return 0
      if (seed === 1) return 1.0
      if (round === 'Wild Card') return seed <= 4 ? 1.0 : 0.0
      if (round === 'Divisional Round') return seed === 2 ? 0.80 : seed === 3 ? 0.10 : 0.06
      if (round === 'Conference Championship') return seed === 2 ? 0.60 : seed === 3 ? 0.20 : 0.10
      return 0
    }

    let pwins = 0, eliminated = null
    for (const { round, pool } of bracket) {
      const opponent  = pick(pool)
      const pgHome    = Math.random() < pgHomeProb(round)
      const homeShort = pgHome ? team?.short : TEAM_BY_NAME[opponent]?.short
      const weather   = playoffWeather(homeShort, round === 'Super Bowl')

      const oppTeam    = oppLookup[opponent]
      const oppTeamAvg = ((oppTeam?.off ?? 5.5) + (oppTeam?.def ?? 5.5)) / 2
      const teamN      = (playerTeamAvg - oppTeamAvg) / 9
      const pgOvrPenalty = ovr !== null && ovr < 82 ? (82 - ovr) * 0.007 : 0

      // RBs: much flatter playoff win curve than QBs (team quality dominates)
      const pgWinP = Math.min(0.78, Math.max(0.15,
        0.42 + ovrN * 0.22 + teamN * 0.48 - pgOvrPenalty
        + (pgHome ? 0.04 : 0)
        - (isAllTime ? 0.08 : 0)
      ))
      const won = Math.random() < pgWinP

      // Playoff game stats (slightly elevated — must-win effort)
      const pgCarries  = Math.round(14 + szN * 4 + randN() * 5)
      const pgYPC      = Math.max(2.0, ypcBase * 1.05 + randN() * 0.80)
      const pgRushYds  = Math.max(0, Math.round(pgCarries * pgYPC + randN() * 10))
      const pgRushTDs  = Math.max(0, Math.round(pgCarries * tdRate * 1.10 + randN() * 1.0))
      const pgRecs     = Math.max(0, Math.round(recBase * 1.05 + randN() * 1.5))
      const pgRecYds   = pgRecs > 0 ? Math.round(pgRecs * (yprBase + randN() * 2)) : 0
      const pgRecTDs   = pgRecs > 0 && Math.random() < recTDRate * 1.1 ? 1 : 0

      const oppTeamOffN = oppTeam ? (oppTeam.off - 5) / 5 : 0
      const oppTeamDefN = oppTeam ? (oppTeam.def - 5) / 5 : 0
      const wMult = weather === 'snow' ? 0.88 : weather === 'rain' ? 0.92 : 1.0
      const pgRBTDs  = pgRushTDs + pgRecTDs
      const pgTmTDs  = Math.max(0, Math.round(1.3 + teamOffN * 1.0 + randN() * 0.8))
      const pgTotal  = pgRBTDs + pgTmTDs
      const pgFGs    = Math.max(0, Math.round(1.2 - pgTotal * 0.3 + Math.random() * 1.2))
      const base     = Math.max(3, Math.round((pgTotal * 7 + pgFGs * 3 - Math.round(oppTeamDefN * 3)) * wMult))
      const oppPTDs  = Math.floor(1 + Math.random() * 3 + oppTeamOffN * 0.8)
      const oppPFGs  = Math.max(0, Math.round(1 - oppPTDs * 0.3 + Math.random()))
      const opp      = Math.max(7, Math.round((oppPTDs * 7 + oppPFGs * 3 - Math.round(teamDefN * 3)) * wMult))
      // Overtime: playoff games are close — ~20% OT rate for even matchups
      const pgCloseness = 1 - 2 * Math.abs(pgWinP - 0.5)
      const pgOT        = Math.random() < pgCloseness * 0.22
      let finalMy, finalOpp
      if (pgOT) {
        const baseTDs2 = Math.max(pgRushTDs + pgRecTDs, Math.floor(1 + Math.random() * 3 + oppTeamOffN * 0.8), 1)
        const tiedSc   = snapNFL(Math.max(10, baseTDs2 * 7 + Math.floor(Math.random() * 3) * 3))
        const otPts    = Math.random() < 0.27 ? 7 : 3
        finalMy  = won ? tiedSc + otPts : tiedSc
        finalOpp = won ? tiedSc : tiedSc + otPts
      } else {
        const margin = Math.ceil(Math.random() * 7)
        finalMy  = snapNFL(won ? Math.max(base, opp + margin) : Math.min(base, opp - margin))
        finalOpp = snapNFL(won ? opp : Math.max(opp, base + margin))
      }

      playoffRounds.push({
        round, opponent, home: pgHome, weather, mySc: finalMy, oppSc: finalOpp, won, overtime: pgOT,
        rushYds: pgRushYds, rushTDs: pgRushTDs, carries: pgCarries,
        recYds: pgRecYds, recTDs: pgRecTDs, recs: pgRecs,
      })
      if (won) pwins++
      else { eliminated = round; break }
    }

    if (pwins === winsNeeded) {
      const sbGame = playoffRounds[playoffRounds.length - 1]
      sbResult = { won: true, rushYds: sbGame.rushYds, rushTDs: sbGame.rushTDs, recYds: sbGame.recYds, recTDs: sbGame.recTDs, carries: sbGame.carries }
    } else {
      sbResult = { won: false, round: eliminated, pwins }
    }
  }

  return {
    team, ovr, wins, losses,
    games,
    highlights: games.filter(g => g.wk <= 4 || g.wk >= 14),
    seasonRushYds, seasonRushTDs, seasonCarries, seasonYPC, seasonFumbles,
    seasonRecYds, seasonRecTDs, seasonRecs,
    seasonLong, hundredYardGames,
    bestGame,
    playoffs, playoffRounds, sbResult, hasBye: playoffs && hasBye,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── WR SIMULATION ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const WR_ATTR_WEIGHT = {
  'hands':       0.14,
  'routeRunning':0.14,
  'speed':       0.14,
  'size':        0.14,
  'awareness':   0.10,
  'afterCatch':  0.10,
  'bodyControl': 0.08,
  'vertical':    0.08,
  'release':     0.08,
}

export function calcOVRWR(build, types = WR_TYPES) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return null

  const totalW = filled.reduce((s, t) => s + (WR_ATTR_WEIGHT[t] ?? 0.05), 0)
  const avg    = filled.reduce((s, t) => s + build[t].val * (WR_ATTR_WEIGHT[t] ?? 0.05) / totalW, 0)
  const vals   = filled.map(t => build[t].val)
  const base   = 60 + 2.1 * avg + 0.21 * avg * avg

  let bonus = 0
  if (filled.length === types.length) {
    const spread = Math.max(...vals) - Math.min(...vals)
    const minVal = Math.min(...vals)
    if (spread <= 1) bonus += 2.5
    else if (spread <= 2) bonus += 1.0
    else if (spread <= 3) bonus += 0.3
    if (minVal >= 9) bonus += 2.0
    else if (minVal >= 8) bonus += 0.5
  }

  return Math.min(99, Math.max(0, Math.round(base + bonus)))
}

export function getArchetypeWR(ovr, build, types = WR_TYPES) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return 'Spin to start building'
  const rem = types.length - filled.length
  if (rem > 0) return `${rem} attribute${rem !== 1 ? 's' : ''} remaining`

  const g   = k => build[k]?.val ?? 0
  const spd = g('speed'), bct = g('bodyControl'), vrt = g('vertical'), sz = g('size')
  const rte = g('routeRunning'), rel = g('release'), hnd = g('hands')
  const awr = g('awareness'), yac = g('afterCatch')

  const vals   = filled.map(t => build[t].val)
  const spread = Math.max(...vals) - Math.min(...vals)

  const ranked = [
    { k: 'spd', v: spd }, { k: 'bct', v: bct }, { k: 'vrt', v: vrt }, { k: 'sz',  v: sz  },
    { k: 'rte', v: rte }, { k: 'rel', v: rel }, { k: 'hnd', v: hnd },
    { k: 'awr', v: awr }, { k: 'yac', v: yac },
  ].sort((a, b) => b.v - a.v)

  const t1   = ranked[0].k
  const t2   = ranked[1].k
  const t3   = ranked[2].k
  const top  = k => t1 === k || t2 === k
  const top3 = k => t1 === k || t2 === k || t3 === k
  const hi   = v => v >= 10
  const up   = v => v >= 9
  const ok   = v => v >= 7
  const slim = sz <= 5
  const big  = sz >= 9

  if (ovr >= 95) {
    if (hi(spd) && hi(yac) && hi(bct))               return 'Uncoverable'
    if (hi(hnd) && hi(rte) && hi(spd))               return 'Once-in-a-Generation'
    if (hi(rte) && hi(rel) && hi(awr))               return 'Route God'
    if (hi(sz) && hi(vrt) && hi(hnd))                return 'Jump Ball Nightmare'
    if (hi(hnd) && hi(rte) && hi(yac))               return 'Complete Receiver'
    if (hi(spd) && hi(rte) && hi(rel))               return 'Unguardable'
    if (hi(hnd) && hi(yac))                          return 'Matchup Nightmare'
    if (spread <= 1)                                  return 'Generational Talent'
    return 'Transcendent WR'
  }

  if (ovr >= 90) {
    if (top('spd') && top('bct') && up(yac) && slim) return 'Human Joystick'
    if (top('spd') && top('bct') && up(yac))         return 'Big Play Machine'
    if (hi(spd) && top3('yac') && slim)              return 'Deep Threat Menace'
    if (top('rte') && top('rel') && up(awr))         return 'Elite Route Artist'
    if (top('rte') && top('hnd') && up(rel))         return 'Precision Weapon'
    if (big && top('vrt') && up(hnd))                return 'Red Zone Nightmare'
    if (top('yac') && top('bct') && up(spd))         return 'RAC Creator'
    if (top('hnd') && top('awr') && top3('rte'))     return 'First Down Machine'
    if (top('spd') && top('rte') && slim)            return 'Slot Assassin'
    if (top('yac') && top('spd'))                    return 'Explosive Playmaker'
    if (top('awr') && top('rte') && up(hnd))         return 'Scheme Breaker'
    if (spread <= 2)                                 return 'Franchise Receiver'
    return 'Superstar WR'
  }

  if (ovr >= 86) {
    if (top('spd') && top('bct') && slim && up(yac)) return 'Slot Missile'
    if (hi(spd) && slim)                             return 'Deep Threat'
    if (top('spd') && top('bct') && slim)            return 'Slot Weapon'
    if (top('spd') && top('bct'))                    return 'Speedster'
    if (top('spd') && top('yac') && slim)            return 'Open-Field Menace'
    if (top('spd') && up(spd) && rte < 8)           return 'Vertical Threat'
    if (top('rte') && top('rel') && top3('awr'))     return 'Route Runner'
    if (top('rte') && top('hnd') && top3('rel'))     return 'Chain Mover'
    if (big && top('vrt') && up(hnd))                return 'Jump-Ball Machine'
    if (big && top('hnd') && top3('awr'))            return 'Physical Possession Receiver'
    if (top('hnd') && top('awr') && top3('rte'))     return 'Possession Weapon'
    if (top('yac') && top('bct') && slim)            return 'YAC Specialist'
    if (top('yac') && top('spd'))                    return 'YAC Machine'
    if (top('awr') && top('rte'))                    return 'Cerebral Receiver'
    if (big && vrt >= 9)                             return 'Red Zone Monster'
    if (slim && spd >= 9 && yac >= 9)               return 'Gadget Weapon'
    if (spread <= 2)                                 return 'Well-Rounded Receiver'
    return 'Pro Bowl WR'
  }

  if (ovr >= 82) {
    if (up(spd) && slim && top('bct'))               return 'Burner'
    if (top('spd') && top('bct') && slim)            return 'Burner'
    if (top('spd') && top('bct'))                    return 'Burner'
    if (top('spd') && top('yac'))                    return 'RAC Threat'
    if (up(spd) && vrt >= 8 && rte < 8)             return 'Burner'
    if (big && top('vrt') && up(vrt))                return 'Red Zone Threat'
    if (big && top('vrt'))                           return 'Jump-Ball Receiver'
    if (top('rte') && top('rel') && ok(awr))         return 'Technician'
    if (top('rte') && top('hnd'))                    return 'Reliable Weapon'
    if (top('hnd') && top('awr'))                    return 'Possession Specialist'
    if (up(yac) && slim)                             return 'Scat Receiver'
    if (top('awr') && ok(rte))                       return 'Smart Receiver'
    if (big)                                         return 'Big-Body Threat'
    if (spread <= 2)                                 return 'Steady Producer'
    return 'Solid Starter'
  }

  if (ovr >= 76) {
    if (up(spd) && rte < 7 && slim)                 return 'Burner'
    if (top('spd') && top('bct') && slim)            return 'Burner'
    if (up(spd))                                     return 'Burner'
    if (big && top('vrt'))                           return 'Jump-Ball Option'
    if (big && hnd >= 7)                             return 'Boundary Receiver'
    if (top('rte') && top('rel'))                    return 'Technical WR'
    if (top('hnd') && ok(awr))                       return 'Reliable Hands'
    if (top('yac') && slim)                          return 'Gadget Player'
    if (top('awr') && ok(hnd))                       return 'Savvy Veteran'
    if (spread <= 2)                                 return 'Reliable Option'
    return 'Rotational Piece'
  }

  if (ovr >= 68) {
    if (up(spd))                                     return 'Burner'
    if (big && top('vrt'))                           return 'Redzone Specialist'
    if (top('hnd'))                                  return 'Hands Guy'
    if (top('rte') && ok(rte))                       return 'Route Technician'
    if (slim && top('bct'))                          return 'Slot Receiver'
    if (spread >= 5)                                 return 'Raw Athlete'
    return 'Depth Receiver'
  }

  if (ovr >= 60) {
    if (spd >= 9 || bct >= 9)                        return 'Athletic Project'
    if (sz >= 9 || vrt >= 9)                         return 'Big-Body Project'
    if (hnd >= 8 || rte >= 8)                        return 'Technical Project'
    return 'Depth Piece'
  }
  if (ovr >= 50) return (spd >= 9 || sz >= 9) ? 'Physical Prospect' : 'Camp Body'
  return 'Practice Squad'
}

// WR mode uses the shared OPOY pools defined above

export function calcWROPOYResult(result, isAllTime = false, teamShort = null) {
  const { wins = 0, seasonRecYds = 0, seasonRecTDs = 0, seasonRecs = 0, ovr = 70 } = result

  let p = 0

  // Receiving yards — primary WR OPOY driver; elite seasons are 1600+
  if (seasonRecYds >= 2000)      p += 0.48
  else if (seasonRecYds >= 1800) p += 0.38
  else if (seasonRecYds >= 1600) p += 0.24
  else if (seasonRecYds >= 1400) p += 0.10
  else if (seasonRecYds >= 1200) p += 0.03

  // TDs — crucial secondary factor
  if (seasonRecTDs >= 18)        p += 0.25
  else if (seasonRecTDs >= 14)   p += 0.17
  else if (seasonRecTDs >= 10)   p += 0.07
  else if (seasonRecTDs >= 7)    p += 0.02

  // Receptions — volume shows target share dominance
  if (seasonRecs >= 120)         p += 0.06
  else if (seasonRecs >= 100)    p += 0.03

  // Wins — team success required
  if (wins >= 14)                p += 0.10
  else if (wins >= 12)           p += 0.06
  else if (wins >= 10)           p += 0.02

  // OVR — reputation effect
  if (ovr >= 95)                 p += 0.04
  else if (ovr >= 90)            p += 0.02

  // Hard caps
  if (seasonRecYds < 1100)       p = Math.min(p, 0.02)
  if (seasonRecTDs < 7)          p = Math.min(p, 0.05)
  if (wins < 7)                  p = 0

  // Guaranteed thresholds
  if (seasonRecYds >= 1900 && seasonRecTDs >= 12 && wins >= 10) {
    const unanimous = seasonRecYds >= 2100 || seasonRecTDs >= 16
    return { userWins: true, winner: null, unanimous, winnerStats: null }
  }

  // RB competition factor
  p *= 0.88

  if (isAllTime) p *= 0.75
  p = Math.min(p, 0.88)

  const userWins = Math.random() < p
  const pool = isAllTime ? ALLTIME_OPOY_POOL : CLASSIC_OPOY_POOL
  const filteredPool = teamShort ? pool.filter(w => w.team !== teamShort) : pool
  const activePool = filteredPool.length ? filteredPool : pool
  const winner = activePool[Math.floor(Math.random() * activePool.length)]
  const unanimous = wins >= 14 && seasonRecYds >= 1800 && seasonRecTDs >= 14

  const ri = (lo, hi) => Math.round(lo + Math.random() * (hi - lo))
  const winnerWins = ri(Math.max(11, wins), Math.min(15, Math.max(12, wins + 2)))

  let winnerStats
  if (winner.pos === 'RB') {
    winnerStats = {
      wins: winnerWins, losses: 17 - winnerWins,
      rushYds: ri(1700, 2100), recYds: ri(200, 500), tds: ri(14, 22),
    }
  } else {
    winnerStats = {
      wins:    winnerWins,
      losses:  17 - winnerWins,
      recYds:  ri(Math.max(1400, seasonRecYds + 30), Math.max(1700, seasonRecYds + 200)),
      recTDs:  ri(Math.max(9,    seasonRecTDs + 1),  Math.max(13,   seasonRecTDs + 4)),
      recs:    ri(Math.max(85,   seasonRecs - 5),    Math.max(110,  seasonRecs + 20)),
    }
  }

  return { userWins, winner, unanimous, winnerStats }
}

export function runWRSimulation(build, types = WR_TYPES, team = null, isAllTime = false) {
  const oppLookup = isAllTime ? ALLTIME_BY_NAME : TEAM_BY_NAME
  const ovr = calcOVRWR(build, types)

  const teamOffN = team ? (team.off - 5) / 5 : 0
  const teamDefN = team ? (team.def - 5) / 5 : 0

  const filledAvg = types.length > 0
    ? types.reduce((s, t) => s + (build[t]?.val ?? 5), 0) / types.length
    : 5
  const raw = k => build[k]?.val ?? filledAvg
  const n   = k => raw(k) / 11

  const spdN = n('speed')        // breakaway speed, deep threat
  const agiN = n('bodyControl')   // change of direction, slot routes
  const vrtN = n('vertical')     // jump catches, contested balls
  const szN  = n('size')         // contested catches, physicality
  const rteN = n('routeRunning') // separation, target rate
  const relN = n('release')      // off-the-line quickness
  const hndN = n('hands')        // catch rate, drops avoided
  const awrN = n('awareness')    // route IQ, situational production
  const yacN = n('afterCatch')   // RAC yards, broken tackles

  // Targets: route running drives separation/volume; slot/YAC WRs get quick-game looks;
  // release = off-the-line separation; size/agi secondary contributors.
  // Elite OVR WRs command more looks (star treatment, defensive attention = more scheming)
  const ovrTargetBonus = ovr !== null ? Math.max(0, Math.min(1.4, (ovr - 82) / 14)) : 0

  // Depth chart position: fewer targets down the roster (WR2 slight, WR3/4 moderate)
  const dcRank = team?.short
    ? WRS.filter(w => w.team === team.short && w.ovr > ovr).length
    : 0
  const dcMult = dcRank === 0 ? 1.00
               : dcRank === 1 ? 0.88
               : dcRank === 2 ? 0.75
               : 0.63

  const targetBase = (3.3 + rteN * 2.2 + hndN * 0.9 + relN * 0.8 + yacN * 0.45 + agiN * 0.40 + szN * 0.15 + teamOffN * 0.5 + ovrTargetBonus) * dcMult

  // Catch rate: hands dominant; speed WRs = boom-or-bust (lower); slot/RAC guys = reliable
  // A pure speed WR with no hands averages ~59-63%; elite hands WR hits ~74-78%
  const catchBase = Math.min(0.82, 0.50 + hndN * 0.17 + rteN * 0.07 + awrN * 0.04 + yacN * 0.02 - spdN * 0.04)

  // Piecewise OVR curve — steeply punishes bad WRs, full production at 82+
  const lowOvrCurve = ovr === null ? 1.0
    : ovr >= 82 ? 1.0
    : ovr >= 76 ? 0.85 + (ovr - 76) * 0.025   // 76→0.85  82→1.00
    : ovr >= 70 ? 0.68 + (ovr - 70) * 0.028   // 70→0.68  76→0.85
    : ovr >= 62 ? 0.48 + (ovr - 62) * 0.025   // 62→0.48  70→0.68
    : Math.max(0.30, 0.30 + (ovr - 50) * 0.015) // 50→0.30  62→0.48

  // YPR: speed/vertical = big plays; SIZE actively reduces YPR (big WRs run shorter routes,
  // don't break away in the open field the way a small speed WR does)
  const yprBase = Math.min(isAllTime ? 19.0 : 17.5,
    10.0 + spdN * 2.8 + vrtN * 0.9 + yacN * 1.4 + agiN * 0.7 + rteN * 0.5 + awrN * 0.3 - szN * 0.8 + teamOffN * 0.4)

  // TD rate: size + vertical = red zone monster (jump balls, contested catches);
  // speed and route running are secondary contributors to end zone production
  const tdRateBase = 0.038 + szN * 0.030 + vrtN * 0.025 + hndN * 0.014 + rteN * 0.010 + awrN * 0.008 + teamOffN * 0.009

  // Win probability — WR is a moderate team contributor; defense/offense dominate
  const ovrPenalty = ovr !== null && ovr < 75
    ? (75 - ovr) * 0.005 + (ovr < 68 ? (68 - ovr) * 0.006 : 0)
    : 0
  const starBonus = ovr !== null && ovr > 75
    ? Math.min(0.20, (ovr - 75) * (ovr - 75) * 0.00040)
    : 0
  const winP = Math.min(0.88, Math.max(0.18,
    0.44
    + (spdN + agiN + rteN + hndN + yacN) * 0.012
    + starBonus
    + teamOffN * 0.185
    + teamDefN * 0.195
    - ovrPenalty
  ))

  const ovrN = ovr !== null ? (ovr - 75) / 22 : 0
  const playerTeamAvg = ((team?.off ?? 5.5) + (team?.def ?? 5.5)) / 2

  let wins = 0, losses = 0
  let seasonRecs = 0, seasonRecYds = 0, seasonRecTDs = 0, seasonTargets = 0
  let seasonLong = 0, hundredYardGames = 0

  const schedule = buildSchedule(team)
  const games = schedule.map(({ opponent, home }, i) => {
    const v = () => randN()

    const oppTeam = oppLookup[opponent]
    const oppDefN = oppTeam ? (oppTeam.def - 5) / 5 : 0
    const oppOffN = oppTeam ? (oppTeam.off - 5) / 5 : 0
    const oppPenalty = isAllTime
      ? oppOffN * 0.08 + oppDefN * 0.10
      : oppOffN * 0.10 + oppDefN * 0.12

    const homeShort  = home ? (team?.short ?? '') : (oppTeam?.short ?? '')
    const badWeather = !DOME_TEAMS.has(homeShort) && COLD_TEAMS.has(homeShort) && Math.random() < 0.15
    const wxCatchHit = badWeather ? 0.04 : 0
    const wxYprHit   = badWeather ? (0.5 + Math.random() * 0.8) : 0

    // Limited game: injury, load management, double-team suppression (~8%)
    const isLimited = Math.random() < 0.08

    // Opponent DB quality suppresses targets and yards (classic: 60% weight)
    const statScale     = isAllTime ? 1.0 : 0.60
    const defTgtPenalty = oppDefN * 0.75 * statScale
    const defYprPenalty = oppDefN * 0.90 * statScale

    // Game mood tiers — same four-tier system as RB
    const gameMood       = Math.random()
    const dudThreshold   = 0.15 + oppDefN * 0.10
    const breakThreshold = 0.77 + oppDefN * 0.07
    const isDud          = !isLimited && gameMood < dudThreshold
    const isBreakout     = !isLimited && gameMood > breakThreshold
    // Legendary: rare sub-tier of breakout — 200+ yard territory is achievable for elite WRs
    const isLegendary    = isBreakout && (
      ovr >= 99 ? Math.random() < 0.16 :
      ovr >= 95 ? Math.random() < 0.10 :
      ovr >= 88 ? Math.random() < 0.045 :
      ovr >= 80 ? Math.random() < 0.020 : false
    )

    const tgtMult = isDud       ? (0.38 + Math.random() * 0.22)     // 0.38–0.60×
                  : isLegendary ? (1.35 + Math.random() * 0.45)     // 1.35–1.80×
                  : isBreakout  ? (1.10 + Math.random() * 0.28)     // 1.10–1.38×
                  : 1.0
    const yprMult = isDud       ? (0.48 + Math.random() * 0.22)     // 0.48–0.70×
                  : isLegendary ? (1.45 + Math.random() * 0.55)     // 1.45–2.00× — record pace
                  : isBreakout  ? (1.12 + Math.random() * 0.30)     // 1.12–1.42×
                  : 1.0

    const rawTargets  = Math.max(1, Math.round((targetBase - defTgtPenalty + v() * 2.5) * tgtMult * lowOvrCurve))
    const gameTargets = isLimited ? Math.max(1, Math.round(1 + Math.random() * 3)) : Math.min(rawTargets, 16)

    const gameCatchRate = Math.min(0.88, Math.max(0.28, catchBase - wxCatchHit + v() * 0.09))
    const gameRecs      = Math.max(0, Math.min(Math.round(gameTargets * gameCatchRate), 14))

    const gameYpr    = Math.max(3.5, Math.min((yprBase - defYprPenalty - wxYprHit) * yprMult + v() * 3.0, 26))
    const gameRecYds = isLimited
      ? Math.max(0, Math.round(gameRecs * 7))
      : Math.max(0, Math.min(Math.round(gameRecs * gameYpr), 350))

    // TD production: inherently streaky — cold weeks and hot weeks create real season variance.
    // Dud games suppress TDs; legendary games boost them; random streaks handle the rest.
    const tdStreakRoll = Math.random()
    const isTDCold    = !isLimited && (isDud || (!isBreakout && tdStreakRoll < 0.25))
    const isTDHot     = !isLimited && (isLegendary || (isBreakout && tdStreakRoll > 0.52) || (!isDud && !isBreakout && tdStreakRoll > 0.87))
    const baseTdP     = Math.max(0, tdRateBase + szN * 0.007)
    const gameTdP     = isTDCold ? baseTdP * 0.06
                      : isTDHot  ? baseTdP * 2.5 + v() * 0.018
                      : baseTdP + v() * 0.014
    const rawTdExp    = isLimited ? 0 : gameRecs * Math.max(0, gameTdP)
    const gameRecTDs  = Math.min(Math.floor(rawTdExp) + (Math.random() < (rawTdExp % 1) ? 1 : 0), 4)

    // Long reception: speed/vertical WRs and breakout games produce the big plays
    const bigPlayChance = Math.max(0.06,
      (0.13 + spdN * 0.22 + vrtN * 0.10 + agiN * 0.06)
      * (badWeather ? 0.55 : 1.0)
      * (1 - oppDefN * 0.20 * statScale)
      * (isDud ? 0.10 : isBreakout ? 1.80 : 1.0)
    )
    const hasBigPlay = !isLimited && gameRecs > 0 && Math.random() < bigPlayChance
    const gameLong   = hasBigPlay
      ? Math.round(14 + spdN * 22 + vrtN * 12 + Math.random() * 16)
      : Math.round(5  + spdN * 7  + vrtN * 3  + Math.random() * 7)

    const perfBonus = (gameRecYds >= 130 ? 0.04 : gameRecYds >= 90 ? 0.02 : 0)
                    + (gameRecTDs >= 2 ? 0.03 : 0)
    const gameWinP  = Math.min(0.90, Math.max(0.08, winP + perfBonus + (home ? 0.04 : 0) + v() * 0.09 - oppPenalty))
    const won       = Math.random() < gameWinP
    won ? wins++ : losses++

    const totalTDs = Math.max(0, Math.round(1.4 + teamOffN * 1.1 + gameRecTDs + v() * 0.9))
    const estFGs   = Math.max(0, Math.round(1.5 - totalTDs * 0.30 + Math.random() * 1.5))
    let mySc  = Math.max(3, totalTDs * 7 + estFGs * 3 - Math.round(oppDefN * 3))
    const oppTDs = Math.floor(1.2 + Math.random() * 3 + oppOffN * 0.9)
    const oppFGs = Math.max(0, Math.round(1 - oppTDs * 0.3 + Math.random()))
    let oppSc = Math.max(0, oppTDs * 7 + oppFGs * 3 - Math.round(teamDefN * 4))
    if (won  && mySc  <= oppSc) mySc  = oppSc + 1 + Math.ceil(Math.random() * 4)
    if (!won && oppSc <= mySc)  oppSc = mySc  + 1 + Math.ceil(Math.random() * 4)
    mySc  = snapNFL(mySc)
    oppSc = snapNFL(oppSc)
    if (mySc === oppSc) { if (won) mySc = snapNFL(mySc + 3); else oppSc = snapNFL(oppSc + 3) }

    seasonRecs    += gameRecs
    seasonRecYds  += gameRecYds
    seasonRecTDs  += gameRecTDs
    seasonTargets += gameTargets
    if (gameLong > seasonLong) seasonLong = gameLong
    if (gameRecYds >= 100) hundredYardGames++

    const gameYPR = gameRecs > 0 ? Math.round((gameRecYds / gameRecs) * 10) / 10 : 0
    return {
      wk: i + 1, opponent, home, mySc, oppSc, won,
      rec: gameRecs, recYds: gameRecYds, recTDs: gameRecTDs, targets: gameTargets, ypr: gameYPR,
      long: gameLong,
    }
  })

  const seasonYPR  = seasonRecs > 0 ? Math.round((seasonRecYds / seasonRecs) * 10) / 10 : 0
  const catchRate  = seasonTargets > 0 ? Math.round((seasonRecs / seasonTargets) * 1000) / 10 : 0

  const bestGame = [...games].sort((a, b) => {
    const score = g => g.recYds * 0.16 + g.recTDs * 14 + g.rec * 1.5
    return score(b) - score(a)
  })[0]

  // ── Playoffs ──────────────────────────────────────────────────────────────
  const playoffs = wins >= 10
    || (wins === 9 && Math.random() < 0.50)
    || (wins === 8 && Math.random() < 0.06)
  const playoffRounds = []
  let sbResult = null
  let hasBye = false

  if (playoffs) {
    const conf = team?.conf ?? 'AFC'
    const activePlayoffPools = isAllTime ? ALLTIME_PLAYOFF_POOLS : PLAYOFF_POOLS
    const activeSbPools      = isAllTime ? ALLTIME_SB_POOLS      : SB_POOLS
    const confPool = activePlayoffPools[conf].filter(n => n !== team?.name)
    const sbPool   = activeSbPools[conf].filter(n => n !== team?.name)
    const usedOpponents = new Set()
    const pick = pool => {
      const avail = pool.filter(n => !usedOpponents.has(n))
      const chosen = (avail.length > 0 ? avail : pool)[Math.floor(Math.random() * (avail.length || pool.length))]
      usedOpponents.add(chosen)
      return chosen
    }

    hasBye = wins >= 14 ? true : wins >= 13 ? Math.random() < 0.60 : false
    const bracket = hasBye
      ? [
          { round: 'Divisional Round',        pool: confPool },
          { round: 'Conference Championship', pool: confPool },
          { round: 'Super Bowl',              pool: sbPool   },
        ]
      : [
          { round: 'Wild Card',               pool: confPool },
          { round: 'Divisional Round',        pool: confPool },
          { round: 'Conference Championship', pool: confPool },
          { round: 'Super Bowl',              pool: sbPool   },
        ]
    const winsNeeded = hasBye ? 3 : 4
    const seed = hasBye && wins >= 14 ? 1 : hasBye ? 2 : wins >= 12 ? 3 : wins >= 11 ? 4 : 5

    const pgHomeProb = round => {
      if (round === 'Super Bowl') return 0
      if (seed === 1) return 1.0
      if (round === 'Wild Card') return seed <= 4 ? 1.0 : 0.0
      if (round === 'Divisional Round') return seed === 2 ? 0.80 : seed === 3 ? 0.10 : 0.06
      if (round === 'Conference Championship') return seed === 2 ? 0.60 : seed === 3 ? 0.20 : 0.10
      return 0
    }

    let pwins = 0, eliminated = null
    for (const { round, pool } of bracket) {
      const opponent  = pick(pool)
      const pgHome    = Math.random() < pgHomeProb(round)
      const homeShort = pgHome ? team?.short : TEAM_BY_NAME[opponent]?.short
      const weather   = playoffWeather(homeShort, round === 'Super Bowl')

      const oppTeam    = oppLookup[opponent]
      const oppTeamAvg = ((oppTeam?.off ?? 5.5) + (oppTeam?.def ?? 5.5)) / 2
      const teamN      = (playerTeamAvg - oppTeamAvg) / 9
      const pgOvrPenalty = ovr !== null && ovr < 82 ? (82 - ovr) * 0.007 : 0

      const pgWinP = Math.min(0.78, Math.max(0.15,
        0.42 + ovrN * 0.20 + teamN * 0.46 - pgOvrPenalty
        + (pgHome ? 0.04 : 0)
        - (isAllTime ? 0.08 : 0)
      ))
      const won = Math.random() < pgWinP

      const wMult     = weather === 'snow' ? 0.88 : weather === 'rain' ? 0.92 : 1.0
      const pgTargets = Math.round(5 + relN * 3 + rteN * 2 + randN() * 2)
      const pgRecs    = Math.max(0, Math.round(pgTargets * (catchBase + randN() * 0.06)))
      const pgRecYds  = pgRecs > 0 ? Math.max(0, Math.round(pgRecs * (yprBase * wMult + randN() * 3))) : 0
      const pgRecTDs  = pgRecs > 0 && Math.random() < tdRateBase * 1.1 ? 1 : 0

      const oppTeamOffN = oppTeam ? (oppTeam.off - 5) / 5 : 0
      const oppTeamDefN = oppTeam ? (oppTeam.def - 5) / 5 : 0
      const pgTmTDs  = Math.max(0, Math.round(1.3 + teamOffN * 1.0 + pgRecTDs + randN() * 0.8))
      const pgFGs    = Math.max(0, Math.round(1.2 - pgTmTDs * 0.3 + Math.random() * 1.2))
      const base     = Math.max(3, Math.round((pgTmTDs * 7 + pgFGs * 3 - Math.round(oppTeamDefN * 3)) * wMult))
      const oppPTDs  = Math.floor(1 + Math.random() * 3 + oppTeamOffN * 0.8)
      const oppPFGs  = Math.max(0, Math.round(1 - oppPTDs * 0.3 + Math.random()))
      const opp      = Math.max(7, Math.round((oppPTDs * 7 + oppPFGs * 3 - Math.round(teamDefN * 3)) * wMult))
      const pgCloseness = 1 - 2 * Math.abs(pgWinP - 0.5)
      const pgOT        = Math.random() < pgCloseness * 0.22
      let finalMy, finalOpp
      if (pgOT) {
        const baseTDs2 = Math.max(pgTmTDs, Math.floor(1 + Math.random() * 3 + oppTeamOffN * 0.8), 1)
        const tiedSc   = snapNFL(Math.max(10, baseTDs2 * 7 + Math.floor(Math.random() * 3) * 3))
        const otPts    = Math.random() < 0.27 ? 7 : 3
        finalMy  = won ? tiedSc + otPts : tiedSc
        finalOpp = won ? tiedSc : tiedSc + otPts
      } else {
        const margin = Math.ceil(Math.random() * 7)
        finalMy  = snapNFL(won ? Math.max(base, opp + margin) : Math.min(base, opp - margin))
        finalOpp = snapNFL(won ? opp : Math.max(opp, base + margin))
      }

      playoffRounds.push({
        round, opponent, home: pgHome, weather, mySc: finalMy, oppSc: finalOpp, won, overtime: pgOT,
        rec: pgRecs, recYds: pgRecYds, recTDs: pgRecTDs, targets: pgTargets,
      })
      if (won) pwins++
      else { eliminated = round; break }
    }

    if (pwins === winsNeeded) {
      const sbGame = playoffRounds[playoffRounds.length - 1]
      sbResult = { won: true, recYds: sbGame.recYds, recTDs: sbGame.recTDs, rec: sbGame.rec }
    } else {
      sbResult = { won: false, round: eliminated, pwins }
    }
  }

  return {
    team, ovr, wins, losses,
    games,
    highlights: games.filter(g => g.wk <= 4 || g.wk >= 14),
    seasonRecs, seasonRecYds, seasonRecTDs, seasonTargets, seasonYPR,
    seasonLong, hundredYardGames, catchRate,
    bestGame,
    playoffs, playoffRounds, sbResult, hasBye: playoffs && hasBye,
  }
}

// ── TE SIMULATION ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const TE_ATTR_WEIGHT = {
  'hands':        0.16,
  'routeRunning': 0.15,
  'size':         0.12,
  'awareness':    0.11,
  'afterCatch':   0.11,
  'blocking':     0.09,
  'strength':     0.09,
  'vertical':     0.09,
  'speed':        0.08,
}

export function calcOVRTE(build, types = TE_TYPES) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return null

  const totalW = filled.reduce((s, t) => s + (TE_ATTR_WEIGHT[t] ?? 0.05), 0)
  const avg    = filled.reduce((s, t) => s + build[t].val * (TE_ATTR_WEIGHT[t] ?? 0.05) / totalW, 0)
  const vals   = filled.map(t => build[t].val)
  const base   = 60 + 2.1 * avg + 0.21 * avg * avg

  let bonus = 0
  if (filled.length === types.length) {
    const spread = Math.max(...vals) - Math.min(...vals)
    const minVal = Math.min(...vals)
    if (spread <= 1) bonus += 2.5
    else if (spread <= 2) bonus += 1.0
    else if (spread <= 3) bonus += 0.3
    if (minVal >= 9) bonus += 2.0
    else if (minVal >= 8) bonus += 0.5
  }

  return Math.min(99, Math.max(0, Math.round(base + bonus)))
}

export function getArchetypeTE(ovr, build, types = TE_TYPES) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return 'Spin to start building'
  const rem = types.length - filled.length
  if (rem > 0) return `${rem} attribute${rem !== 1 ? 's' : ''} remaining`

  const g   = k => build[k]?.val ?? 0
  const spd = g('speed'), blk = g('blocking'), vrt = g('vertical'), sz = g('size')
  const rte = g('routeRunning'), str = g('strength'), hnd = g('hands')
  const awr = g('awareness'), yac = g('afterCatch')

  const vals   = filled.map(t => build[t].val)
  const spread = Math.max(...vals) - Math.min(...vals)

  const ranked = [
    { k: 'spd', v: spd }, { k: 'blk', v: blk }, { k: 'vrt', v: vrt }, { k: 'sz',  v: sz  },
    { k: 'rte', v: rte }, { k: 'str', v: str }, { k: 'hnd', v: hnd },
    { k: 'awr', v: awr }, { k: 'yac', v: yac },
  ].sort((a, b) => b.v - a.v)

  const t1   = ranked[0].k
  const t2   = ranked[1].k
  const t3   = ranked[2].k
  const top  = k => t1 === k || t2 === k
  const top3 = k => t1 === k || t2 === k || t3 === k
  const hi   = v => v >= 10
  const up   = v => v >= 9
  const ok   = v => v >= 7
  const slim = sz <= 7
  const big  = sz >= 10
  const fast = spd >= 8

  if (ovr >= 95) {
    if (hi(blk) && hi(str) && up(rte))              return 'Blocking Anchor'
    if (hi(rte) && hi(awr) && up(hnd))              return 'Route God'
    if (hi(hnd) && hi(awr) && hi(rte))              return 'Unstoppable Weapon'
    if (hi(yac) && hi(hnd) && fast)                 return 'Nightmare Matchup'
    if (hi(blk) && hi(hnd) && hi(rte))              return 'Complete Tight End'
    if (spread <= 1)                                 return 'Generational TE'
    return 'Transcendent TE'
  }

  if (ovr >= 90) {
    if (top('blk') && top('str') && up(rte))        return 'Dominant Blocker'
    if (top('spd') && top('yac') && up(hnd))        return 'Seam Wrecker'
    if (top('rte') && top('hnd') && up(awr))        return 'Elite Pass Catcher'
    if (top('blk') && top('hnd') && up(rte))        return 'Swiss Army TE'
    if (fast && top('yac') && up(hnd))              return 'Big Play Machine'
    if (big && top('vrt') && up(hnd))               return 'Red Zone Nightmare'
    if (top('rte') && top('awr') && up(hnd))        return 'Versatile Weapon'
    if (top('hnd') && top('yac') && slim)           return 'Move TE'
    if (spread <= 2)                                 return 'Franchise Tight End'
    return 'Superstar TE'
  }

  if (ovr >= 86) {
    if (top('blk') && top('str'))                   return 'Mauler'
    if (top('blk') && up(blk) && top3('rte'))       return 'Run Blocker'
    if (top('spd') && top('yac') && slim)           return 'Seam Missile'
    if (fast && top('vrt') && up(hnd))              return 'Deep Threat TE'
    if (top('rte') && top('hnd') && top3('awr'))    return 'Route Runner'
    if (big && top('vrt') && up(hnd))               return 'Jump-Ball Monster'
    if (top('hnd') && top('awr') && top3('rte'))    return 'Chain Mover'
    if (top('yac') && top('hnd') && slim)           return 'YAC Machine'
    if (top('blk') && top('rte'))                   return 'Versatile Weapon'
    if (spread <= 2)                                 return 'Pro Bowl TE'
    return 'Pro Bowl TE'
  }

  if (ovr >= 82) {
    if (top('blk') && top('str'))                   return 'Inline Blocker'
    if (top('spd') && top('yac'))                   return 'Speed TE'
    if (top('rte') && top('hnd'))                   return 'Receiving TE'
    if (big && top('vrt'))                          return 'Red Zone Threat'
    if (top('hnd') && top('awr'))                   return 'Possession TE'
    if (fast && up(spd))                             return 'Athletic TE'
    if (top('blk') && up(blk))                      return 'Power Blocker'
    if (spread <= 2)                                 return 'Solid Starter'
    return 'Solid Starter'
  }

  if (ovr >= 76) {
    if (top('blk') && top('str'))                   return 'Block-First TE'
    if (top('spd') && slim)                         return 'Move TE'
    if (top('rte') && ok(hnd))                      return 'Route Technician'
    if (big && top('vrt'))                          return 'Jump-Ball Option'
    if (top('hnd') && ok(awr))                      return 'Reliable Hands'
    if (top('yac') && slim)                         return 'Gadget TE'
    if (spread <= 2)                                 return 'Reliable Option'
    return 'Rotational TE'
  }

  if (ovr >= 68) {
    if (up(blk))                                     return 'Y-Blocker'
    if (big && top('vrt'))                           return 'Redzone Specialist'
    if (top('hnd'))                                  return 'Possession TE'
    if (spread >= 5)                                 return 'Raw Athlete'
    return 'Depth TE'
  }

  if (ovr >= 60) {
    if (blk >= 9 || str >= 9)                        return 'Blocking Project'
    if (spd >= 9 || vrt >= 9)                        return 'Athletic Project'
    return 'Depth Piece'
  }
  if (ovr >= 50) return (blk >= 9 || sz >= 9) ? 'Physical Prospect' : 'Camp Body'
  return 'Practice Squad'
}

// TE mode uses the shared OPOY pools defined above

export function calcTEOPOYResult(result, isAllTime = false, teamShort = null) {
  const { wins = 0, seasonRecYds = 0, seasonRecTDs = 0, seasonRecs = 0, ovr = 70 } = result

  let p = 0

  // Receiving yards — same thresholds as WR mode
  if (seasonRecYds >= 2000)      p += 0.48
  else if (seasonRecYds >= 1800) p += 0.38
  else if (seasonRecYds >= 1600) p += 0.24
  else if (seasonRecYds >= 1400) p += 0.10
  else if (seasonRecYds >= 1200) p += 0.03

  // TDs
  if (seasonRecTDs >= 18)        p += 0.25
  else if (seasonRecTDs >= 14)   p += 0.17
  else if (seasonRecTDs >= 10)   p += 0.07
  else if (seasonRecTDs >= 7)    p += 0.02

  // Receptions
  if (seasonRecs >= 120)         p += 0.06
  else if (seasonRecs >= 100)    p += 0.03

  // Wins
  if (wins >= 14)                p += 0.10
  else if (wins >= 12)           p += 0.06
  else if (wins >= 10)           p += 0.02

  // OVR
  if (ovr >= 95)                 p += 0.04
  else if (ovr >= 90)            p += 0.02

  // Hard caps
  if (seasonRecYds < 1100)       p = Math.min(p, 0.02)
  if (seasonRecTDs < 7)          p = Math.min(p, 0.05)
  if (wins < 7)                  p = 0

  // Guaranteed thresholds — same as WR
  if (seasonRecYds >= 1900 && seasonRecTDs >= 12 && wins >= 10) {
    const unanimous = seasonRecYds >= 2100 || seasonRecTDs >= 16
    return { userWins: true, winner: null, unanimous, winnerStats: null }
  }

  // RB/WR competition factor
  p *= 0.88

  if (isAllTime) p *= 0.75
  p = Math.min(p, 0.88)

  const userWins = Math.random() < p
  const pool = isAllTime ? ALLTIME_OPOY_POOL : CLASSIC_OPOY_POOL
  const filteredPool = teamShort ? pool.filter(w => w.team !== teamShort) : pool
  const activePool = filteredPool.length ? filteredPool : pool
  const winner = activePool[Math.floor(Math.random() * activePool.length)]
  const unanimous = wins >= 14 && seasonRecYds >= 1800 && seasonRecTDs >= 14

  const ri = (lo, hi) => Math.round(lo + Math.random() * (hi - lo))
  const winnerWins = ri(Math.max(11, wins), Math.min(15, Math.max(12, wins + 2)))

  let winnerStats
  if (winner.pos === 'RB') {
    winnerStats = {
      wins: winnerWins, losses: 17 - winnerWins,
      rushYds: ri(1700, 2100), recYds: ri(200, 500), tds: ri(14, 22),
    }
  } else {
    winnerStats = {
      wins:    winnerWins,
      losses:  17 - winnerWins,
      recYds:  ri(Math.max(1400, seasonRecYds + 30), Math.max(1700, seasonRecYds + 200)),
      recTDs:  ri(Math.max(9,    seasonRecTDs + 1),  Math.max(13,   seasonRecTDs + 4)),
      recs:    ri(Math.max(85,   seasonRecs - 5),    Math.max(110,  seasonRecs + 20)),
    }
  }

  return { userWins, winner, unanimous, winnerStats }
}

export function runTESimulation(build, types = TE_TYPES, team = null, isAllTime = false) {
  const oppLookup = isAllTime ? ALLTIME_BY_NAME : TEAM_BY_NAME
  const ovr = calcOVRTE(build, types)

  const teamOffN = team ? (team.off - 5) / 5 : 0
  const teamDefN = team ? (team.def - 5) / 5 : 0

  const filledAvg = types.length > 0
    ? types.reduce((s, t) => s + (build[t]?.val ?? 5), 0) / types.length
    : 5
  const raw = k => build[k]?.val ?? filledAvg
  const n   = k => raw(k) / 11

  const spdN = n('speed')
  const blkN = n('blocking')    // blocking — inline run blocking proficiency
  const vrtN = n('vertical')    // jump ball / contested catches in end zone
  const szN  = n('size')        // physical domination
  const rteN = n('routeRunning')// separation and target share
  const strN = n('strength')    // releasing vs. LBs/DBs
  const hndN = n('hands')       // catch rate, drops
  const awrN = n('awareness')   // IQ, situational production
  const yacN = n('afterCatch')  // RAC yards, broken tackles

  // Targets: TEs get ~45-90 targets; route running and awareness primary drivers
  // blocking reduces target share (block-first TEs get fewer routes run)
  const ovrTargetBonus = ovr !== null ? Math.max(0, Math.min(1.0, (ovr - 82) / 16)) : 0

  const dcRank = team?.short
    ? TES.filter(te => te.team === team.short && te.ovr > ovr).length
    : 0
  const dcMult = dcRank === 0 ? 1.00
               : dcRank === 1 ? 0.84
               : dcRank === 2 ? 0.68
               : 0.55

  // TEs get fewer targets than WRs; blocking TEs get even fewer
  // speed added: faster TEs threaten seam/crossing routes and earn more targets
  const targetBase = (3.2 + rteN * 2.0 + hndN * 0.8 + strN * 0.6 + yacN * 0.4 + awrN * 0.35 + spdN * 0.30 - blkN * 0.3 + teamOffN * 0.45 + ovrTargetBonus) * dcMult

  // Higher catch rate than WR — TEs run more controlled routes, contested less
  const catchBase = Math.min(0.84, 0.54 + hndN * 0.16 + rteN * 0.06 + awrN * 0.04 + strN * 0.02)

  // Piecewise OVR curve
  const lowOvrCurve = ovr === null ? 1.0
    : ovr >= 82 ? 1.0
    : ovr >= 76 ? 0.85 + (ovr - 76) * 0.025
    : ovr >= 70 ? 0.68 + (ovr - 70) * 0.028
    : ovr >= 62 ? 0.48 + (ovr - 62) * 0.025
    : Math.max(0.30, 0.30 + (ovr - 50) * 0.015)

  // YPR: seam routes, crossers — elite TEs average 13-15 YPR; Kittle/Kelce-type ceiling is ~15-16
  // afterCatch bumped: YAC is the primary YPR driver for modern TEs
  const yprBase = Math.min(isAllTime ? 17.5 : 16.0,
    8.5 + spdN * 2.5 + vrtN * 1.3 + yacN * 1.5 + rteN * 0.6 + awrN * 0.3 - szN * 0.35 + teamOffN * 0.40)

  // TD rate: size and vertical are massive for TEs (red zone dominance)
  // strength and hands also contribute; blocking doesn't help scoring
  const tdRateBase = 0.055 + szN * 0.035 + vrtN * 0.030 + hndN * 0.015 + rteN * 0.010 + strN * 0.008 + teamOffN * 0.010

  const ovrPenalty = ovr !== null && ovr < 75
    ? (75 - ovr) * 0.005 + (ovr < 68 ? (68 - ovr) * 0.006 : 0)
    : 0
  const starBonus = ovr !== null && ovr > 75
    ? Math.min(0.20, (ovr - 75) * (ovr - 75) * 0.00040)
    : 0
  const winP = Math.min(0.88, Math.max(0.18,
    0.44
    + (spdN + blkN + rteN + hndN + yacN) * 0.011
    + starBonus
    + teamOffN * 0.185
    + teamDefN * 0.195
    - ovrPenalty
  ))

  const ovrN = ovr !== null ? (ovr - 75) / 22 : 0
  const playerTeamAvg = ((team?.off ?? 5.5) + (team?.def ?? 5.5)) / 2

  let wins = 0, losses = 0
  let seasonRecs = 0, seasonRecYds = 0, seasonRecTDs = 0, seasonTargets = 0
  let seasonLong = 0, hundredYardGames = 0

  const schedule = buildSchedule(team)
  const games = schedule.map(({ opponent, home }, i) => {
    const v = () => randN()

    const oppTeam = oppLookup[opponent]
    const oppDefN = oppTeam ? (oppTeam.def - 5) / 5 : 0
    const oppOffN = oppTeam ? (oppTeam.off - 5) / 5 : 0
    const oppPenalty = isAllTime
      ? oppOffN * 0.08 + oppDefN * 0.10
      : oppOffN * 0.10 + oppDefN * 0.12

    const homeShort  = home ? (team?.short ?? '') : (oppTeam?.short ?? '')
    const badWeather = !DOME_TEAMS.has(homeShort) && COLD_TEAMS.has(homeShort) && Math.random() < 0.15
    const wxCatchHit = badWeather ? 0.03 : 0
    const wxYprHit   = badWeather ? (0.4 + Math.random() * 0.7) : 0

    const isLimited = Math.random() < 0.07

    const statScale     = isAllTime ? 1.0 : 0.60
    const defTgtPenalty = oppDefN * 0.70 * statScale
    const defYprPenalty = oppDefN * 0.85 * statScale

    const gameMood       = Math.random()
    const dudThreshold   = 0.18 + oppDefN * 0.10
    const breakThreshold = 0.78 + oppDefN * 0.07
    const isDud          = !isLimited && gameMood < dudThreshold
    const isBreakout     = !isLimited && gameMood > breakThreshold
    const isLegendary    = isBreakout && (
      ovr >= 99 ? Math.random() < 0.14 :
      ovr >= 95 ? Math.random() < 0.09 :
      ovr >= 88 ? Math.random() < 0.040 :
      ovr >= 80 ? Math.random() < 0.018 : false
    )

    const tgtMult = isDud       ? (0.35 + Math.random() * 0.22)
                  : isLegendary ? (1.30 + Math.random() * 0.40)
                  : isBreakout  ? (1.08 + Math.random() * 0.26)
                  : 1.0
    const yprMult = isDud       ? (0.50 + Math.random() * 0.22)
                  : isLegendary ? (1.40 + Math.random() * 0.50)
                  : isBreakout  ? (1.10 + Math.random() * 0.28)
                  : 1.0

    const rawTargets  = Math.max(0, Math.round((targetBase - defTgtPenalty + v() * 2.0) * tgtMult * lowOvrCurve))
    const gameTargets = isLimited ? Math.max(0, Math.round(Math.random() * 2)) : Math.min(rawTargets, 13)

    const gameCatchRate = Math.min(0.88, Math.max(0.35, catchBase - wxCatchHit + v() * 0.08))
    const gameRecs      = Math.max(0, Math.min(Math.round(gameTargets * gameCatchRate), 12))

    const gameYpr    = Math.max(4.5, Math.min((yprBase - defYprPenalty - wxYprHit) * yprMult + v() * 2.5, 23))
    const gameRecYds = isLimited
      ? Math.max(0, Math.round(gameRecs * 8))
      : Math.max(0, Math.min(Math.round(gameRecs * gameYpr), 250))

    const tdStreakRoll = Math.random()
    const isTDCold    = !isLimited && (isDud || (!isBreakout && tdStreakRoll < 0.28))
    const isTDHot     = !isLimited && (isLegendary || (isBreakout && tdStreakRoll > 0.55) || (!isDud && !isBreakout && tdStreakRoll > 0.88))
    const baseTdP     = Math.max(0, tdRateBase + szN * 0.008)
    const gameTdP     = isTDCold ? baseTdP * 0.05
                      : isTDHot  ? baseTdP * 2.6 + v() * 0.020
                      : baseTdP + v() * 0.015
    const rawTdExp    = isLimited ? 0 : gameRecs * Math.max(0, gameTdP)
    const gameRecTDs  = Math.min(Math.floor(rawTdExp) + (Math.random() < (rawTdExp % 1) ? 1 : 0), 4)

    // Long reception: speed/vertical TEs occasionally break open on seam routes
    const bigPlayChance = Math.max(0.05,
      (0.10 + spdN * 0.18 + vrtN * 0.12 + yacN * 0.06)
      * (badWeather ? 0.60 : 1.0)
      * (1 - oppDefN * 0.20 * statScale)
      * (isDud ? 0.10 : isBreakout ? 1.70 : 1.0)
    )
    const hasBigPlay = !isLimited && gameRecs > 0 && Math.random() < bigPlayChance
    const gameLong   = hasBigPlay
      ? Math.round(16 + spdN * 20 + vrtN * 14 + Math.random() * 14)
      : Math.round(6  + spdN * 6  + vrtN * 4  + Math.random() * 7)

    const perfBonus = (gameRecYds >= 100 ? 0.04 : gameRecYds >= 70 ? 0.02 : 0)
                    + (gameRecTDs >= 2 ? 0.03 : 0)
    const gameWinP  = Math.min(0.90, Math.max(0.08, winP + perfBonus + (home ? 0.04 : 0) + v() * 0.09 - oppPenalty))
    const won       = Math.random() < gameWinP
    won ? wins++ : losses++

    const totalTDs = Math.max(0, Math.round(1.4 + teamOffN * 1.1 + gameRecTDs + v() * 0.9))
    const estFGs   = Math.max(0, Math.round(1.5 - totalTDs * 0.30 + Math.random() * 1.5))
    let mySc  = Math.max(3, totalTDs * 7 + estFGs * 3 - Math.round(oppDefN * 3))
    const oppTDs = Math.floor(1.2 + Math.random() * 3 + oppOffN * 0.9)
    const oppFGs = Math.max(0, Math.round(1 - oppTDs * 0.3 + Math.random()))
    let oppSc = Math.max(0, oppTDs * 7 + oppFGs * 3 - Math.round(teamDefN * 4))
    if (won  && mySc  <= oppSc) mySc  = oppSc + 1 + Math.ceil(Math.random() * 4)
    if (!won && oppSc <= mySc)  oppSc = mySc  + 1 + Math.ceil(Math.random() * 4)
    mySc  = snapNFL(mySc)
    oppSc = snapNFL(oppSc)
    if (mySc === oppSc) { if (won) mySc = snapNFL(mySc + 3); else oppSc = snapNFL(oppSc + 3) }

    seasonRecs    += gameRecs
    seasonRecYds  += gameRecYds
    seasonRecTDs  += gameRecTDs
    seasonTargets += gameTargets
    if (gameLong > seasonLong) seasonLong = gameLong
    if (gameRecYds >= 100) hundredYardGames++

    const gameYPR = gameRecs > 0 ? Math.round((gameRecYds / gameRecs) * 10) / 10 : 0
    return {
      wk: i + 1, opponent, home, mySc, oppSc, won,
      rec: gameRecs, recYds: gameRecYds, recTDs: gameRecTDs, targets: gameTargets, ypr: gameYPR,
      long: gameLong,
    }
  })

  const seasonYPR  = seasonRecs > 0 ? Math.round((seasonRecYds / seasonRecs) * 10) / 10 : 0
  const catchRate  = seasonTargets > 0 ? Math.round((seasonRecs / seasonTargets) * 1000) / 10 : 0

  const bestGame = [...games].sort((a, b) => {
    const score = g => g.recYds * 0.16 + g.recTDs * 14 + g.rec * 1.5
    return score(b) - score(a)
  })[0]

  // ── Playoffs ──────────────────────────────────────────────────────────────
  const playoffs = wins >= 10
    || (wins === 9 && Math.random() < 0.50)
    || (wins === 8 && Math.random() < 0.06)
  const playoffRounds = []
  let sbResult = null
  let hasBye = false

  if (playoffs) {
    const conf = team?.conf ?? 'AFC'
    const activePlayoffPools = isAllTime ? ALLTIME_PLAYOFF_POOLS : PLAYOFF_POOLS
    const activeSbPools      = isAllTime ? ALLTIME_SB_POOLS      : SB_POOLS
    const confPool = activePlayoffPools[conf].filter(n => n !== team?.name)
    const sbPool   = activeSbPools[conf].filter(n => n !== team?.name)
    const usedOpponents = new Set()
    const pick = pool => {
      const avail = pool.filter(n => !usedOpponents.has(n))
      const chosen = (avail.length > 0 ? avail : pool)[Math.floor(Math.random() * (avail.length || pool.length))]
      usedOpponents.add(chosen)
      return chosen
    }

    hasBye = wins >= 14 ? true : wins >= 13 ? Math.random() < 0.60 : false
    const bracket = hasBye
      ? [
          { round: 'Divisional Round',        pool: confPool },
          { round: 'Conference Championship', pool: confPool },
          { round: 'Super Bowl',              pool: sbPool   },
        ]
      : [
          { round: 'Wild Card',               pool: confPool },
          { round: 'Divisional Round',        pool: confPool },
          { round: 'Conference Championship', pool: confPool },
          { round: 'Super Bowl',              pool: sbPool   },
        ]
    const winsNeeded = hasBye ? 3 : 4
    const seed = hasBye && wins >= 14 ? 1 : hasBye ? 2 : wins >= 12 ? 3 : wins >= 11 ? 4 : 5

    const pgHomeProb = round => {
      if (round === 'Super Bowl') return 0
      if (seed === 1) return 1.0
      if (round === 'Wild Card') return seed <= 4 ? 1.0 : 0.0
      if (round === 'Divisional Round') return seed === 2 ? 0.80 : seed === 3 ? 0.10 : 0.06
      if (round === 'Conference Championship') return seed === 2 ? 0.60 : seed === 3 ? 0.20 : 0.10
      return 0
    }

    let pwins = 0, eliminated = null
    for (const { round, pool } of bracket) {
      const opponent  = pick(pool)
      const pgHome    = Math.random() < pgHomeProb(round)
      const homeShort = pgHome ? team?.short : TEAM_BY_NAME[opponent]?.short
      const weather   = playoffWeather(homeShort, round === 'Super Bowl')

      const oppTeam    = oppLookup[opponent]
      const oppTeamAvg = ((oppTeam?.off ?? 5.5) + (oppTeam?.def ?? 5.5)) / 2
      const teamN      = (playerTeamAvg - oppTeamAvg) / 9
      const pgOvrPenalty = ovr !== null && ovr < 82 ? (82 - ovr) * 0.007 : 0

      const pgWinP = Math.min(0.78, Math.max(0.15,
        0.42 + ovrN * 0.20 + teamN * 0.46 - pgOvrPenalty
        + (pgHome ? 0.04 : 0)
        - (isAllTime ? 0.08 : 0)
      ))
      const won = Math.random() < pgWinP

      const wMult     = weather === 'snow' ? 0.88 : weather === 'rain' ? 0.92 : 1.0
      const pgTargets = Math.round(4 + strN * 2.5 + rteN * 2 + randN() * 2)
      const pgRecs    = Math.max(0, Math.round(pgTargets * (catchBase + randN() * 0.06)))
      const pgRecYds  = pgRecs > 0 ? Math.max(0, Math.round(pgRecs * (yprBase * wMult + randN() * 2.5))) : 0
      const pgRecTDs  = pgRecs > 0 && Math.random() < tdRateBase * 1.1 ? 1 : 0

      const oppTeamOffN = oppTeam ? (oppTeam.off - 5) / 5 : 0
      const oppTeamDefN = oppTeam ? (oppTeam.def - 5) / 5 : 0
      const pgTmTDs  = Math.max(0, Math.round(1.3 + teamOffN * 1.0 + pgRecTDs + randN() * 0.8))
      const pgFGs    = Math.max(0, Math.round(1.2 - pgTmTDs * 0.3 + Math.random() * 1.2))
      const base     = Math.max(3, Math.round((pgTmTDs * 7 + pgFGs * 3 - Math.round(oppTeamDefN * 3)) * wMult))
      const oppPTDs  = Math.floor(1 + Math.random() * 3 + oppTeamOffN * 0.8)
      const oppPFGs  = Math.max(0, Math.round(1 - oppPTDs * 0.3 + Math.random()))
      const opp      = Math.max(7, Math.round((oppPTDs * 7 + oppPFGs * 3 - Math.round(teamDefN * 3)) * wMult))
      const pgCloseness = 1 - 2 * Math.abs(pgWinP - 0.5)
      const pgOT        = Math.random() < pgCloseness * 0.22
      let finalMy, finalOpp
      if (pgOT) {
        const baseTDs2 = Math.max(pgTmTDs, Math.floor(1 + Math.random() * 3 + oppTeamOffN * 0.8), 1)
        const tiedSc   = snapNFL(Math.max(10, baseTDs2 * 7 + Math.floor(Math.random() * 3) * 3))
        const otPts    = Math.random() < 0.27 ? 7 : 3
        finalMy  = won ? tiedSc + otPts : tiedSc
        finalOpp = won ? tiedSc : tiedSc + otPts
      } else {
        const margin = Math.ceil(Math.random() * 7)
        finalMy  = snapNFL(won ? Math.max(base, opp + margin) : Math.min(base, opp - margin))
        finalOpp = snapNFL(won ? opp : Math.max(opp, base + margin))
      }

      playoffRounds.push({
        round, opponent, home: pgHome, weather, mySc: finalMy, oppSc: finalOpp, won, overtime: pgOT,
        rec: pgRecs, recYds: pgRecYds, recTDs: pgRecTDs, targets: pgTargets,
      })
      if (won) pwins++
      else { eliminated = round; break }
    }

    if (pwins === winsNeeded) {
      const sbGame = playoffRounds[playoffRounds.length - 1]
      sbResult = { won: true, recYds: sbGame.recYds, recTDs: sbGame.recTDs, rec: sbGame.rec }
    } else {
      sbResult = { won: false, round: eliminated, pwins }
    }
  }

  return {
    team, ovr, wins, losses,
    games,
    highlights: games.filter(g => g.wk <= 4 || g.wk >= 14),
    seasonRecs, seasonRecYds, seasonRecTDs, seasonTargets, seasonYPR,
    seasonLong, hundredYardGames, catchRate,
    bestGame,
    playoffs, playoffRounds, sbResult, hasBye: playoffs && hasBye,
  }
}
