import { TYPES } from '../data/qbs'

const GRADES = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S']

export function valToGrade(val) {
  return GRADES[Math.max(0, Math.min(11, Math.round(val)))] ?? 'F'
}

export function calcOVR(build, types = TYPES) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return null
  const vals   = filled.map(t => build[t].val)
  const avg    = vals.reduce((a, b) => a + b, 0) / filled.length
  const base = 52 + 2 * avg + 0.28 * avg * avg

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

const PLAYOFF_BRACKET = [
  { round: 'Wild Card',               opponents: ['Houston Texans',      'Los Angeles Rams',     'Minnesota Vikings',    'Green Bay Packers'     ] },
  { round: 'Divisional Round',        opponents: ['Detroit Lions',       'Baltimore Ravens',     'Buffalo Bills',        'Washington Commanders' ] },
  { round: 'Conference Championship', opponents: ['Philadelphia Eagles', 'San Francisco 49ers',  'Kansas City Chiefs',   'Dallas Cowboys'        ] },
  { round: 'Super Bowl',              opponents: ['Kansas City Chiefs',  'Philadelphia Eagles',  'San Francisco 49ers',  'Baltimore Ravens'      ] },
]

// ── Core simulation ───────────────────────────────────────────────────────────

export function runSimulation(build, types = TYPES) {
  const ovr = calcOVR(build, types)

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
  const passYdBase = 155 + armN * 65 + acN * 45 + viN * 22 + pkN * 14 + pmN * 9

  // Attempts/game: inversely linked to accuracy (inaccurate QBs need more attempts) + base volume
  const attBase = 30 + (1 - acN) * 6 + randN() * 0

  // Completion %: accuracy (dominant), vision (finding open guys), processing (right reads), pocket (time to throw)
  const compBase = Math.min(0.76, 0.535 + acN * 0.105 + viN * 0.045 + prN * 0.032 + pkN * 0.022)

  // TD rate per attempt: accuracy (throws into tight windows), vision (finding end zone looks), processing (red zone)
  const tdRateBase = 0.028 + acN * 0.019 + viN * 0.013 + prN * 0.009 + armN * 0.005

  // INT rate per attempt: processing (primary reducer — reads the field), then accuracy, vision, pocket
  // Leadership has zero impact on INTs — it's not a stat attribute
  const intRateBase = Math.max(0.008,
    0.044 - prN * 0.018 - acN * 0.011 - pkN * 0.009 - viN * 0.006
  )

  // Rush yards/game: legs (dominant), playmaking (broken plays, ad libs)
  // Arm/accuracy/vision/leadership have no rushing impact
  const rushYdBase = legN * 42 + pmN * 13

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
  ))

  // Playoff win probability: same base but leadership has more weight (clutch factor, team belief)
  // Pocket presence matters more in big games too
  const playoffWinP = Math.min(0.80, Math.max(0.20,
    winP
    + ldN * 0.05   // leadership shines most in playoffs
    + pkN * 0.03   // pocket presence crucial in playoff atmospheres
    + prN * 0.02   // processing elite defenses
  ))

  // ── Regular season simulation ────────────────────────────────────────────
  let wins = 0, losses = 0
  let seasonPassYds = 0, seasonTDs = 0, seasonINTs = 0
  let seasonRushYds = 0, seasonRushTDs = 0
  let seasonAttempts = 0, seasonCompletions = 0

  const games = REG_OPPONENTS.map((opponent, i) => {
    // Per-game variance (randN is roughly ±1.5 range, centered)
    const v = () => randN()

    const gameAtts   = Math.max(18, Math.round(attBase + v() * 5))
    const gameCompPct = Math.min(0.85, Math.max(0.35, compBase + v() * 0.07))
    const gameComps  = Math.round(gameAtts * gameCompPct)
    const gamePassYds = Math.max(60, Math.round(passYdBase + v() * 72))
    const gameTDs    = Math.max(0, Math.round(gameAtts * tdRateBase + v() * 0.9))
    const gameINTs   = Math.max(0, Math.round(gameAtts * intRateBase + Math.random() * 0.7))
    const gameRushYds = Math.max(0, Math.round(rushYdBase + v() * 18))
    const gameRushTDs = Math.random() < (legN * 0.26 + pmN * 0.08) ? 1 : 0

    const rating = passerRating(gameComps, gameAtts, gamePassYds, gameTDs, gameINTs)

    // Win chance: base + performance premium (great game = better chance)
    const perfBonus  = (gameTDs >= 3 ? 0.06 : gameTDs >= 2 ? 0.02 : 0)
                     - (gameINTs >= 2 ? 0.07 : gameINTs === 1 ? 0.02 : 0)
    const gameWinP   = Math.min(0.90, Math.max(0.08, winP + perfBonus + v() * 0.08))
    const won        = Math.random() < gameWinP
    won ? wins++ : losses++

    // Score: performance-correlated but with randomness (defense matters)
    const mySc  = Math.max(3,  Math.round(13 + gameTDs * 5.5 + gameRushTDs * 5 + gamePassYds / 40 + Math.random() * 7))
    const oppSc = Math.max(0,  Math.round(11 + Math.random() * 24))

    seasonPassYds     += gamePassYds
    seasonTDs         += gameTDs
    seasonINTs        += gameINTs
    seasonRushYds     += gameRushYds
    seasonRushTDs     += gameRushTDs
    seasonAttempts    += gameAtts
    seasonCompletions += gameComps

    return { wk: i + 1, opponent, mySc, oppSc, won, passYds: gamePassYds, tds: gameTDs, ints: gameINTs, rushYds: gameRushYds, rating: Math.round(rating) }
  })

  const seasonCompPct = Math.round((seasonCompletions / seasonAttempts) * 1000) / 10
  const seasonRating  = Math.round(passerRating(seasonCompletions, seasonAttempts, seasonPassYds, seasonTDs, seasonINTs))
  const bestGame      = [...games].sort((a, b) => b.rating - a.rating)[0]

  // ── Playoffs ─────────────────────────────────────────────────────────────
  const playoffs      = wins >= 9
  const playoffRounds = []
  let sbResult = null

  if (playoffs) {
    let pwins = 0, eliminated = null
    for (const { round, opponents } of PLAYOFF_BRACKET) {
      const opponent = opponents[Math.floor(Math.random() * opponents.length)]
      const won      = Math.random() < playoffWinP

      // Playoff game stats use similar logic but with higher stakes variance
      const pgAtts  = Math.round(35 + randN() * 5)
      const pgComp  = Math.round(pgAtts * (compBase + randN() * 0.05))
      const pgYds   = Math.max(100, Math.round(passYdBase * 1.05 + randN() * 55))
      const pgTDs   = Math.max(0, Math.round(pgAtts * tdRateBase * 1.1 + randN() * 0.7))
      const pgINTs  = Math.max(0, Math.round(pgAtts * intRateBase + Math.random() * 0.6))
      const pgRtg   = Math.round(passerRating(pgComp, pgAtts, pgYds, pgTDs, pgINTs))

      const base   = Math.round(14 + pgTDs * 5 + pgYds / 45 + Math.random() * 7)
      const opp    = Math.round(10 + Math.random() * 24)
      const margin = Math.ceil(Math.random() * 8)
      const finalMy  = won ? Math.max(base, opp + margin)  : Math.min(base, opp - margin)
      const finalOpp = won ? opp : Math.max(opp, base + margin)

      playoffRounds.push({ round, opponent, mySc: finalMy, oppSc: finalOpp, won, passYds: pgYds, tds: pgTDs, ints: pgINTs, rating: pgRtg })
      if (won) { pwins++ } else { eliminated = round; break }
    }

    if (pwins === 4) {
      const sbAtts = Math.round(38 + randN() * 4)
      const sbComp = Math.round(sbAtts * (compBase + randN() * 0.04))
      const sbYds  = Math.max(150, Math.round(passYdBase * 1.08 + randN() * 60))
      const sbTDs  = Math.max(1,   Math.round(sbAtts * tdRateBase * 1.15 + randN() * 0.6))
      const sbINTs = Math.max(0,   Math.round(sbAtts * intRateBase * 0.8 + Math.random() * 0.5))
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
    ovr, wins, losses,
    games,
    highlights: games.filter(g => g.wk <= 4 || g.wk >= 14),
    seasonPassYds, seasonTDs, seasonINTs,
    seasonRushYds, seasonRushTDs,
    seasonAttempts, seasonCompletions, seasonCompPct,
    seasonRating,
    bestGame,
    playoffs, playoffRounds, sbResult,
  }
}
