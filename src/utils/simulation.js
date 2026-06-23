import { TYPES } from '../data/qbs'
import { NFL_TEAMS } from '../data/nfl-teams'

const TEAM_BY_NAME = Object.fromEntries(NFL_TEAMS.map(t => [t.name, t]))

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
    if (spread <= 1) bonus += 3
    else if (spread <= 2) bonus += 1.5
    else if (spread <= 3) bonus += 0.5
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
  const arm  = g('arm'),  legs = g('legs')
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
    if (hi(proc) && hi(vis))          return 'Omniscient Field General'
    if (spread <= 1)                  return 'Generational Talent'
    return 'Transcendent QB'
  }
  if (ovr >= 90) {
    if (top('legs') && top('arm'))    return 'Elite Dual Threat'
    if (top('legs') && top('play'))   return 'Dual Threat Nightmare'
    if (top('legs') && top('acc'))    return 'Mobile Surgeon'
    if (top('arm') && top('acc'))     return 'Surgical Cannon'
    if (top('proc') && top('vis'))    return 'Chess Master'
    if (top('pock') && top('acc'))    return 'Elite Pocket Passer'
    if (top('arm') && spread >= 4)    return 'High-Risk Cannon'
    if (spread <= 2)                  return 'Franchise Cornerstone'
    return 'Star QB'
  }
  if (ovr >= 84) {
    if (top('legs') && top('play'))   return 'Dynamic Dual Threat'
    if (top('legs') && top('arm'))    return 'Dual Threat Gunslinger'
    if (top('legs') && up(legs))      return 'Rushing Threat'
    if (top('arm') && top('acc'))     return 'Gunslinger'
    if (top('arm') && spread >= 4)    return 'Boom or Bust'
    if (top('acc') && top('pock'))    return 'Classic Pocket Passer'
    if (top('proc') && top('lead'))   return 'Veteran Field General'
    if (top('play') && top('vis'))    return 'Playmaker'
    if (spread <= 2)                  return 'Pro Bowl Starter'
    return 'High-Ceiling Specialist'
  }
  if (ovr >= 76) {
    if (top('legs') && up(legs))      return 'Scrambler'
    if (top('legs') && top('play'))   return 'Run-First QB'
    if (top('arm') && spread >= 4)    return 'Boom or Bust'
    if (top('arm'))                   return 'Strong-Arm Starter'
    if (top('acc') && top('pock'))    return 'Game Manager Plus'
    if (top('proc') || top('vis'))    return 'System QB'
    if (top('lead'))                  return 'Locker Room Leader'
    if (spread <= 2)                  return 'Reliable Starter'
    return 'Solid Starter'
  }
  if (ovr >= 68) {
    if (top('legs') && up(legs))      return 'Athletic Project'
    if (spread >= 5)                  return 'High-Ceiling Project'
    if (spread <= 2)                  return 'Bridge QB'
    if (ranked[0].v >= 9)             return 'One-Trick Pony'
    return 'Spot Starter'
  }
  if (ovr >= 60) return 'Project QB'
  if (ovr >= 50) return 'Clipboard Manager'
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

const REG_OPPONENTS = [
  'Dallas Cowboys',      'Miami Dolphins',        'San Francisco 49ers', 'Philadelphia Eagles',
  'Cincinnati Bengals',  'Minnesota Vikings',      'Los Angeles Rams',    'Seattle Seahawks',
  'Buffalo Bills',       'Tampa Bay Buccaneers',   'New York Giants',     'Chicago Bears',
  'Detroit Lions',       'Green Bay Packers',      'Pittsburgh Steelers', 'New England Patriots',
  'Baltimore Ravens',
]

const PLAYOFF_POOLS = {
  AFC: {
    'Wild Card':               ['Cincinnati Bengals', 'Houston Texans', 'Los Angeles Chargers', 'Denver Broncos', 'Miami Dolphins', 'Pittsburgh Steelers', 'Indianapolis Colts'],
    'Divisional Round':        ['Baltimore Ravens', 'Buffalo Bills', 'Kansas City Chiefs', 'Pittsburgh Steelers', 'Cincinnati Bengals', 'Houston Texans'],
    'Conference Championship': ['Kansas City Chiefs', 'Baltimore Ravens', 'Buffalo Bills', 'Cincinnati Bengals'],
  },
  NFC: {
    'Wild Card':               ['Minnesota Vikings', 'Los Angeles Rams', 'Tampa Bay Buccaneers', 'Green Bay Packers', 'Chicago Bears', 'Washington Commanders', 'Atlanta Falcons'],
    'Divisional Round':        ['Philadelphia Eagles', 'Detroit Lions', 'San Francisco 49ers', 'Washington Commanders', 'Green Bay Packers', 'Los Angeles Rams'],
    'Conference Championship': ['Philadelphia Eagles', 'San Francisco 49ers', 'Detroit Lions', 'Green Bay Packers'],
  },
}

const SB_POOLS = {
  AFC: ['Philadelphia Eagles', 'San Francisco 49ers', 'Detroit Lions', 'Dallas Cowboys', 'Green Bay Packers'],
  NFC: ['Kansas City Chiefs', 'Baltimore Ravens', 'Buffalo Bills', 'Cincinnati Bengals', 'Houston Texans'],
}

// ── Core simulation ───────────────────────────────────────────────────────────

export function runSimulation(build, types = TYPES, team = null) {
  const ovr = calcOVR(build, types)

  // Team support factors (off/def each 1–10, 5 = league average)
  const teamOffN = team ? (team.off - 5) / 5 : 0   // −1 to +1
  const teamDefN = team ? (team.def - 5) / 5 : 0

  // ── Attribute extraction (0–11 scale → 0–1 normalized) ───────────────────
  const raw = (k) => build[k]?.val ?? 5
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
  const passYdBase = 148 + armN * 55 + acN * 38 + viN * 20 + pkN * 12 + pmN * 8 + teamOffN * 14

  // Attempts/game: inversely linked to accuracy (inaccurate QBs need more attempts) + base volume
  const attBase = 30 + (1 - acN) * 6 + randN() * 0

  // Completion %: accuracy (dominant), vision (finding open guys), processing (right reads), pocket (time to throw)
  const compBase = Math.min(0.76, 0.535 + acN * 0.105 + viN * 0.045 + prN * 0.032 + pkN * 0.022)

  // TD rate per attempt: accuracy (throws into tight windows), vision (finding end zone looks), processing (red zone)
  const tdRateBase = 0.026 + acN * 0.016 + viN * 0.011 + prN * 0.008 + armN * 0.004

  // INT rate per attempt: processing (primary reducer — reads the field), then accuracy, vision, pocket
  // Leadership has zero impact on INTs — it's not a stat attribute
  const intRateBase = Math.max(0.008,
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
  const winP = Math.min(0.83, Math.max(0.17,
    0.26
    + acN * 0.11   // most important — accurate QBs win
    + prN * 0.10   // smart QBs protect the ball and win close games
    + viN * 0.09   // vision drives efficiency
    + armN * 0.07  // arm = deep ball threat, opens offense
    + pkN * 0.07   // pocket presence = consistency under pressure
    + pmN * 0.05   // playmakers extend drives
    + legN * 0.04  // mobile QBs add dimension
    + ldN * 0.03   // leadership: small team W-L effect, NOT stats
    + szN * 0.02   // durability — stays healthy
    + teamOffN * 0.025  // supporting cast / scheme
    + teamDefN * 0.035  // defense wins games independently
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

  const games = REG_OPPONENTS.map((opponent, i) => {
    // Per-game variance (randN is roughly ±1.5 range, centered)
    const v = () => randN()

    const gameAtts   = Math.max(18, Math.round(attBase + v() * 5))
    const gameCompPct = Math.min(0.85, Math.max(0.35, compBase + v() * 0.07))
    const gameComps  = Math.round(gameAtts * gameCompPct)
    const gamePassYds = Math.max(60, Math.round(passYdBase + v() * 62))
    const gameTDs    = Math.max(0, Math.round(gameAtts * tdRateBase + v() * 0.85))
    const gameINTs   = Math.max(0, Math.round(gameAtts * intRateBase + randN() * 0.5))
    const gameRushYds = Math.max(0, Math.round(rushYdBase + v() * 18))
    const gameRushTDs = Math.random() < (legN * 0.35 + szN * 0.08 + pmN * 0.08) ? 1 : 0
    const gameSacks   = Math.max(0, Math.round(sackBase + v() * 1.2))

    const rating = passerRating(gameComps, gameAtts, gamePassYds, gameTDs, gameINTs)

    // Win chance: base + performance premium (great game = better chance)
    const perfBonus  = (gameTDs >= 3 ? 0.06 : gameTDs >= 2 ? 0.02 : 0)
                     - (gameINTs >= 2 ? 0.07 : gameINTs === 1 ? 0.02 : 0)
    const gameWinP   = Math.min(0.90, Math.max(0.08, winP + perfBonus + v() * 0.08))
    const won        = Math.random() < gameWinP
    won ? wins++ : losses++

    // Score: TDs * 7 (PAT assumed) + estimated field goals + team factors
    // teamOffN boosts our scoring, teamDefN suppresses opponent scoring
    const myTDs  = gameTDs + gameRushTDs
    const estFGs = Math.max(0, Math.round(1.5 - myTDs * 0.35 + Math.random() * 1.5))
    const bonusFG = Math.random() < 0.25 ? 3 : 0
    let mySc     = Math.max(3, myTDs * 7 + estFGs * 3 + bonusFG + (teamOffN > 0 ? 3 : 0))
    const oppTDs = Math.floor(1 + Math.random() * 3)
    const oppFGs = Math.max(0, Math.round(1 - oppTDs * 0.3 + Math.random()))
    let oppSc    = Math.max(0, oppTDs * 7 + oppFGs * 3 - Math.round(teamDefN * 4))
    if (won  && mySc  <= oppSc) mySc  = oppSc + 1 + Math.ceil(Math.random() * 4)
    if (!won && oppSc <= mySc)  oppSc = mySc  + 1 + Math.ceil(Math.random() * 4)
    mySc  = snapNFL(mySc)
    oppSc = snapNFL(oppSc)

    seasonPassYds     += gamePassYds
    seasonTDs         += gameTDs
    seasonINTs        += gameINTs
    seasonRushYds     += gameRushYds
    seasonRushTDs     += gameRushTDs
    seasonSacks       += gameSacks
    seasonAttempts    += gameAtts
    seasonCompletions += gameComps

    return { wk: i + 1, opponent, mySc, oppSc, won, passYds: gamePassYds, tds: gameTDs, ints: gameINTs, rushYds: gameRushYds, sacks: gameSacks, rating: Math.round(rating) }
  })

  const seasonCompPct = Math.round((seasonCompletions / seasonAttempts) * 1000) / 10
  const seasonRating  = Math.round(passerRating(seasonCompletions, seasonAttempts, seasonPassYds, seasonTDs, seasonINTs))
  const bestGame      = [...games].sort((a, b) => {
    const score = g => g.passYds * 0.15 + g.tds * 12 + (g.ints === 0 ? 4 : 0) + g.rating * 0.1
    return score(b) - score(a)
  })[0]

  // ── Playoffs ─────────────────────────────────────────────────────────────
  const playoffs      = wins >= 9
  const playoffRounds = []
  let sbResult = null

  if (playoffs) {
    const conf     = team?.conf ?? 'AFC'
    const confPool = PLAYOFF_POOLS[conf]
    const usedOpponents = new Set()
    const pick     = (pool) => {
      const opts = pool.filter(n => n !== team?.name && !usedOpponents.has(n))
      const chosen = opts.length
        ? opts[Math.floor(Math.random() * opts.length)]
        : pool.filter(n => n !== team?.name)[Math.floor(Math.random() * pool.filter(n => n !== team?.name).length)]
      usedOpponents.add(chosen)
      return chosen
    }
    const playoffBracket = [
      { round: 'Wild Card',               opponents: confPool['Wild Card'] },
      { round: 'Divisional Round',        opponents: confPool['Divisional Round'] },
      { round: 'Conference Championship', opponents: confPool['Conference Championship'] },
      { round: 'Super Bowl',              opponents: SB_POOLS[conf] },
    ]

    let pwins = 0, eliminated = null
    for (const { round, opponents } of playoffBracket) {
      const opponent   = pick(opponents)
      const oppTeam    = TEAM_BY_NAME[opponent]
      const oppTeamAvg = ((oppTeam?.off ?? 5.5) + (oppTeam?.def ?? 5.5)) / 2
      const teamN      = (playerTeamAvg - oppTeamAvg) / 9
      const pgWinP     = Math.min(0.94, Math.max(0.15, 0.36 + ovrN * 0.58 + teamN * 0.26))
      const won        = Math.random() < pgWinP

      // Playoff game stats use similar logic but with higher stakes variance
      const pgAtts  = Math.round(35 + randN() * 5)
      const pgComp  = Math.round(pgAtts * (compBase + randN() * 0.05))
      const pgYds   = Math.max(100, Math.round(passYdBase * 1.05 + randN() * 55))
      const pgTDs   = Math.max(0, Math.round(pgAtts * tdRateBase * 1.1 + randN() * 0.7))
      const pgINTs  = Math.max(0, Math.round(pgAtts * intRateBase + randN() * 0.5))
      const pgRtg   = Math.round(passerRating(pgComp, pgAtts, pgYds, pgTDs, pgINTs))

      const pgFGs     = Math.max(0, Math.round(1.2 - pgTDs * 0.35 + Math.random() * 1.2))
      const pgBonusFG = Math.random() < 0.25 ? 3 : 0
      const base   = Math.max(3, pgTDs * 7 + pgFGs * 3 + pgBonusFG + (teamOffN > 0 ? 3 : 0))
      const oppPTDs = Math.floor(1 + Math.random() * 3)
      const oppPFGs = Math.max(0, Math.round(1 - oppPTDs * 0.3 + Math.random()))
      const opp    = Math.max(7, oppPTDs * 7 + oppPFGs * 3 - Math.round(teamDefN * 3))
      const margin = Math.ceil(Math.random() * 7)
      const finalMy  = snapNFL(won ? Math.max(base, opp + margin)  : Math.min(base, opp - margin))
      const finalOpp = snapNFL(won ? opp : Math.max(opp, base + margin))

      playoffRounds.push({ round, opponent, mySc: finalMy, oppSc: finalOpp, won, passYds: pgYds, tds: pgTDs, ints: pgINTs, rating: pgRtg })
      if (won) { pwins++ } else { eliminated = round; break }
    }

    if (pwins === 4) {
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
    playoffs, playoffRounds, sbResult,
  }
}
