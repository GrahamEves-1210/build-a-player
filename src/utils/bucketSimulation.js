// ─── NBA Simulation Engine ────────────────────────────────────────────────────

const EAST = new Set(['ATL','BOS','BKN','CHA','CHI','CLE','DET','IND','MIA','MIL','NYK','ORL','PHI','TOR','WAS'])
const WEST = new Set(['DAL','DEN','GSW','HOU','LAC','LAL','MEM','MIN','NOP','OKC','PHX','POR','SAC','SAS','UTA'])

// Team strength ratings (off/def out of 100) — calibrated to 2025-26 actual records
// East: DET 60W, BOS 56W, NYK 53W (Finals champs — boosted), CLE 52W, TOR 46W, ATL 46W, PHI 45W, ORL 45W, CHA 44W, MIA 43W, MIL 32W, CHI 31W, BKN 20W, IND 19W, WAS 17W
// West: OKC 64W, SAS 62W, DEN 54W, LAL 53W, HOU 52W, MIN 49W, PHX 45W, POR 42W, LAC 42W, GSW 37W, NOP 26W, DAL 26W, MEM 25W, SAC 22W, UTA 22W
export const TEAM_RATINGS = {
  // EAST
  ATL:{off:78,def:70}, BOS:{off:79,def:76}, BKN:{off:61,def:61},
  CHA:{off:74,def:72}, CHI:{off:67,def:66}, CLE:{off:73,def:82},
  DET:{off:81,def:82}, IND:{off:62,def:59}, MIA:{off:71,def:74},
  MIL:{off:66,def:64}, NYK:{off:80,def:83}, ORL:{off:70,def:77},
  PHI:{off:75,def:72}, TOR:{off:75,def:73}, WAS:{off:63,def:62},
  // WEST
  DAL:{off:70,def:64}, DEN:{off:80,def:77}, GSW:{off:70,def:69},
  HOU:{off:78,def:77}, LAC:{off:72,def:72}, LAL:{off:77,def:75},
  MEM:{off:64,def:63}, MIN:{off:76,def:79}, NOP:{off:65,def:63},
  OKC:{off:85,def:82}, PHX:{off:76,def:71}, POR:{off:73,def:71},
  SAC:{off:63,def:61}, SAS:{off:83,def:82}, UTA:{off:62,def:62},
}

const CONF_TEAMS = {
  east: ['ATL','BOS','BKN','CHA','CHI','CLE','DET','IND','MIA','MIL','NYK','ORL','PHI','TOR','WAS'],
  west: ['DAL','DEN','GSW','HOU','LAC','LAL','MEM','MIN','NOP','OKC','PHX','POR','SAC','SAS','UTA'],
}

// Top expected seeds per conference (for generating Finals opponents) — 2026 actuals
const CONF_ELITE = {
  east: ['DET','BOS','NYK','CLE','TOR','ATL'],
  west: ['OKC','SAS','DEN','LAL','HOU','MIN'],
}

function rn(min, max) { return min + Math.random() * (max - min) }

// ─── OVR Calculation ──────────────────────────────────────────────────────────
// Guard types: jumpShot finishing passing handles perimeterDefense speed bounce size basketballIQ clutch
// Big types:   jumpShot finishing playmaking interiorDefense rebounding speed bounce size basketballIQ clutch
const OVR_WEIGHTS = {
  guard: {
    // T1
    jumpShot:         0.14,
    speed:            0.14,
    size:             0.14,
    finishing:        0.14,
    basketballIQ:     0.14,
    // T2
    passing:          0.08,
    handles:          0.08,
    perimeterDefense: 0.08,
    // T3
    bounce:           0.04,
    // T4
    clutch:           0.02,
  },
  big: {
    // T1
    finishing:        0.15,
    size:             0.15,
    interiorDefense:  0.15,
    rebounding:       0.15,
    // T2
    jumpShot:         0.09,
    bounce:           0.07,
    playmaking:       0.07,
    basketballIQ:     0.07,
    speed:            0.07,
    // T3
    clutch:           0.03,
  },
}

export function calcBucketOVR(build, types, position = 'guard') {
  const W = OVR_WEIGHTS[position] ?? OVR_WEIGHTS.guard
  let sum = 0, wt = 0
  for (const t of types) {
    if (!build[t]) continue
    const v = build[t].val ?? 0
    const w = W[t] ?? (1 / types.length)
    sum += v * w
    wt += w
  }
  if (!wt) return 0
  return Math.min(99, Math.round(57 + ((sum / wt - 1) / 9) * 44))
}

// ─── Best-of-7 Series ─────────────────────────────────────────────────────────
function simulateSeries(winProb) {
  const games = []
  let mW = 0, mL = 0
  while (mW < 4 && mL < 4) {
    const w = Math.random() < winProb
    if (w) { mW++ } else { mL++ }
    games.push(w ? 'W' : 'L')
  }
  return { won: mW === 4, wins: mW, losses: mL, games }
}

// ─── Conference Standings ─────────────────────────────────────────────────────
function simConferenceStandings(myWins, myShort, conf) {
  const others = CONF_TEAMS[conf]
    .filter(s => s !== myShort)
    .map(s => {
      const tr = TEAM_RATINGS[s] ?? { off: 68, def: 65 }
      // score range ~0.57 (worst) to ~0.83 (best); map to WP 0.13–0.77
      const score = (tr.off + tr.def) / 200
      const baseWP = Math.max(0.13, Math.min(0.77, 0.20 + (score - 0.59) / 0.24 * 0.57 + rn(-0.06, 0.06)))
      let w = 0
      for (let i = 0; i < 82; i++) if (Math.random() < baseWP) w++
      return { short: s, wins: w }
    })

  const all = [...others, { short: myShort, wins: myWins, isUs: true }]
  all.sort((a, b) => b.wins - a.wins || (a.isUs ? -1 : 1))
  const seed = all.findIndex(t => t.isUs) + 1
  return { seed, standings: all }
}

// ─── Play-In Tournament ───────────────────────────────────────────────────────
function simPlayIn(mySeed, standings, winProb) {
  const getPair = s => standings[s - 1] ?? { short: '???', wins: 35 }

  if (mySeed === 7 || mySeed === 8) {
    const opp7or8 = getPair(mySeed === 7 ? 8 : 7)
    const g1 = Math.random() < (mySeed === 7 ? winProb + 0.04 : winProb - 0.04)

    if (g1) {
      return { type: 'playin', advanced: true, newSeed: 7, games: ['W'],
        opponent: opp7or8, label: `Beat ${opp7or8.short} — Earned #7 Seed` }
    }
    const survivor = getPair(9)
    const g2 = Math.random() < (winProb - 0.03)
    return { type: 'playin', advanced: g2, newSeed: g2 ? 8 : null,
      games: ['L', g2 ? 'W' : 'L'], opponent: g2 ? survivor : opp7or8,
      label: g2 ? `Survived Play-In — Earned #8 Seed` : `Eliminated in Play-In` }
  }

  // Seeds 9 or 10 — harder path
  const oppPeer = getPair(mySeed === 9 ? 10 : 9)
  const g1 = Math.random() < (winProb - 0.06)
  if (!g1) return { type: 'playin', advanced: false, games: ['L'],
    opponent: oppPeer, label: 'Eliminated in Play-In' }

  const oppLowerSeed = getPair(mySeed === 9 ? 7 : 8)
  const g2 = Math.random() < (winProb - 0.02)
  return { type: 'playin', advanced: g2, newSeed: g2 ? 8 : null,
    games: ['W', g2 ? 'W' : 'L'], opponent: g2 ? oppLowerSeed : oppPeer,
    label: g2 ? `Survived Play-In — Earned #8 Seed` : `Eliminated in Play-In` }
}

// ─── Per-matchup win probability (log5 formula + slight talent amplification) ──
function teamWP(short) {
  const tr = TEAM_RATINGS[short] ?? { off: 68, def: 65 }
  const score = (tr.off + tr.def) / 200
  return Math.max(0.13, Math.min(0.77, 0.20 + (score - 0.59) / 0.24 * 0.57))
}

function matchupProb(myWP, oppShort) {
  const oppWP = teamWP(oppShort)
  // Log5: unbiased head-to-head probability from two win rates
  const denom = myWP + oppWP - 2 * myWP * oppWP
  const p = denom === 0 ? 0.5 : (myWP - myWP * oppWP) / denom
  // Slightly amplify talent gap (1.12x stretch from 0.5) so better teams win more decisively
  const amplified = 0.5 + (p - 0.5) * 1.12
  return Math.min(0.85, Math.max(0.15, amplified))
}

// ─── Playoff Path ─────────────────────────────────────────────────────────────
function simPlayoffs(mySeed, winProb, conf, standings) {
  const rounds = []
  let currentSeed = mySeed

  if (currentSeed >= 7 && currentSeed <= 10) {
    const pi = simPlayIn(currentSeed, standings, winProb)
    rounds.push(pi)
    if (!pi.advanced) return { rounds, champion: false }
    currentSeed = pi.newSeed
  }

  const get = seed => standings[seed - 1] ?? { short: 'OPP', wins: 40 }
  const roundNames = ['First Round', 'Conference Semifinals', 'Conference Finals', 'NBA Finals']

  // R1: standard bracket seeding
  const r1SeedMap = { 1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1 }
  const r1Seed = r1SeedMap[currentSeed] ?? 8

  // Simulate a parallel series between two seeds using actual team ratings,
  // so the R2/R3 opponent is whoever actually won — not a random probability pick
  // that could contradict another round's result.
  const simParallel = (seedA, seedB) => {
    const tA = get(seedA), tB = get(seedB)
    return Math.random() < matchupProb(teamWP(tA.short), tB.short)
      ? { ...tA, seed: seedA }
      : { ...tB, seed: seedB }
  }

  // R2: winner of the other R1 series in our bracket half
  let r2Opp
  if ([1, 8].includes(currentSeed))       r2Opp = simParallel(4, 5)
  else if ([4, 5].includes(currentSeed))  r2Opp = simParallel(1, 8)
  else if ([2, 7].includes(currentSeed))  r2Opp = simParallel(3, 6)
  else                                     r2Opp = simParallel(2, 7)

  // R3: simulate both R1 games in the other bracket half, then their semifinal
  let r3Opp
  if ([1, 4, 5, 8].includes(currentSeed)) {
    const sfA = simParallel(2, 7)
    const sfB = simParallel(3, 6)
    r3Opp = Math.random() < matchupProb(teamWP(sfA.short), sfB.short) ? sfA : sfB
  } else {
    const sfA = simParallel(1, 8)
    const sfB = simParallel(4, 5)
    r3Opp = Math.random() < matchupProb(teamWP(sfA.short), sfB.short) ? sfA : sfB
  }

  // Finals: elite team from other conference
  const otherConf = conf === 'east' ? 'west' : 'east'
  const elites = CONF_ELITE[otherConf]
  const r4Short = elites[Math.floor(rn(0, 3))]
  const r4Wins = Math.round(rn(52, 64))

  const opponentsByRound = [
    { ...get(r1Seed), seed: r1Seed },
    r2Opp,
    r3Opp,
    { short: r4Short, wins: r4Wins, seed: 1, isOtherConf: true },
  ]

  let eliminated = false

  for (let r = 0; r < 4; r++) {
    if (eliminated) break
    const opp = opponentsByRound[r]
    // Per-game probability driven by actual matchup talent, same OVR boost as regular season
    const adjProb = matchupProb(winProb, opp.short)
    const series = simulateSeries(adjProb)
    rounds.push({ type: 'series', name: roundNames[r], roundIndex: r,
      opponent: opp, ...series })
    if (!series.won) eliminated = true
  }

  const seriesWins = rounds.filter(r => r.type === 'series' && r.won).length
  return { rounds, champion: !eliminated && seriesWins === 4 }
}

// ─── Main Simulation Entry Point ─────────────────────────────────────────────
export function runBucketSimulation(build, types, team, position = 'guard') {
  const ovr = calcBucketOVR(build, types, position)
  const tr = TEAM_RATINGS[team.short] ?? { off: 68, def: 65 }

  // Team strength → baseline WP (same formula as standings generator)
  const teamScore = (tr.off + tr.def) / 200
  const teamWP    = Math.max(0.13, Math.min(0.77, 0.20 + (teamScore - 0.59) / 0.24 * 0.57))
  // OVR 82 = neutral; 90+ stars have amplified positive impact (up to +15%)
  const rawDelta  = (ovr - 82) / 17
  const ovrBoost  = rawDelta >= 0
    ? Math.min(0.20, rawDelta * 0.20)
    : Math.max(-0.10, rawDelta * 0.10)
  const winProb   = Math.min(0.87, Math.max(0.12, teamWP + ovrBoost))

  // Season stat averages (computed from actual build attributes)
  const isBig = position === 'big'
  const a = {}
  for (const t of types) a[t] = build[t]?.val ?? 5

  const js  = a.jumpShot ?? 5,        fin = a.finishing ?? 5
  const pm  = a.playmaking ?? 5,      hnd = a.handles ?? 5
  const pas = a.passing ?? 5,         id  = a.interiorDefense ?? 5
  const reb = a.rebounding ?? 5,      pd  = a.perimeterDefense ?? 5
  const spd = a.speed ?? 5,           bnc = a.bounce ?? 5
  const sz  = a.size ?? 5,            iq  = a.basketballIQ ?? 5
  const clt = a.clutch ?? 5

  // --- composite raw scores ---
  const scoringRaw = isBig
    ? fin * 0.50 + js  * 0.25 + pm  * 0.15 + clt * 0.10
    : js  * 0.32 + fin * 0.24 + spd * 0.18 + sz  * 0.12 + hnd * 0.08 + clt * 0.06
  const rebRaw = isBig
    ? reb * 0.55 + sz  * 0.30 + bnc * 0.10 + iq  * 0.05
    : sz  * 0.60 + bnc * 0.40
  const astRaw = isBig
    ? pm  * 0.50 + iq  * 0.35 + pas * 0.15
    : pas * 0.50 + iq  * 0.35 + hnd * 0.15
  const blkRaw = isBig
    ? sz  * 0.55 + id  * 0.28 + bnc * 0.10 + iq  * 0.07
    : sz  * 0.45 + pd  * 0.35 + bnc * 0.12 + iq  * 0.08
  const stlRaw = isBig
    ? pd  * 0.35 + iq  * 0.35 + spd * 0.30
    : pd  * 0.55 + iq  * 0.35 + spd * 0.10

  // --- per-game stats (calibrated to realistic NBA ranges) ---
  // PPG: guard 4–40+, big 5–32 (A+ build ~33.5, S tier can exceed)
  const ppg = +(Math.max(isBig ? 5 : 4, (isBig ? 0 : -3.5) + rn(-1, 1) + scoringRaw * (isBig ? 2.2 : 4.0))).toFixed(1)
  // RPG: guard 1.5–9+, big 5–14 (A+ build ~7.7, S tier can exceed)
  const rpg = +(Math.max(isBig ? 5 : 1.5, (isBig ? 3.5 : 0.5) + rn(-0.4, 0.4) + rebRaw * (isBig ? 0.75 : 0.75))).toFixed(1)
  // APG: guard 1–11+, big 0.5–7 (A+ build ~10, S tier can exceed)
  const apg = +(Math.max(isBig ? 0.5 : 1.0, (isBig ? -1.5 : -1.0) + rn(-0.3, 0.3) + astRaw * (isBig ? 0.78 : 1.1))).toFixed(1)
  // SPG: 0.2–2.3+ (A+ build ~2.0, S tier can exceed)
  const spg = +(Math.max(0.2, stlRaw * 0.21 + rn(-0.1, 0.14))).toFixed(1)
  // BPG: guard 0–1.3, big 0.4–3.1
  const bpg = +(Math.max(isBig ? 0.4 : 0.0, (isBig ? 0.2 : 0) + rn(-0.08, 0.15) + blkRaw * (isBig ? 0.27 : 0.13))).toFixed(1)

  // --- shooting percentages ---
  // FG%: guards 43–53% (elite NBA guards ~48%), bigs 50–63% (rim-runners higher)
  const fgPct = Math.min(isBig ? 63 : 53, Math.max(isBig ? 42 : 38, Math.round(
    (isBig ? 42 : 38) + rn(-2, 2) +
    (isBig
      ? fin * 0.95 + js * 0.33 + sz * 0.24 + iq * 0.16
      : js  * 0.45 + fin * 0.38 + hnd * 0.18 + iq * 0.13)
  )))
  // 3P%: F jumpshot = 0 (doesn't shoot threes); guards cap ~45 (Curry-tier), bigs cap ~41
  const threePct = js === 0 ? 0 : Math.min(isBig ? 41 : 45, Math.max(0, Math.round(
    (isBig ? 12 : 15) + rn(-2, 2) +
    js  * 2.25 + (js >= 2 ? 3 : 0) +
    iq  * 0.25 +
    spd * 0.15 +
    sz  * 0.10
  )))
  // FT%: jump shot mechanics are nearly identical to free throw form; IQ for routine/pressure;
  //       handles/touch matter slightly for guards
  const ftPct = Math.min(99, Math.max(52, Math.round(
    52 + rn(-3, 3) +
    js  * 2.8 +
    iq  * 1.2 +
    (isBig ? 0 : hnd * 0.5)
  )))
  const per      = +(Math.max(8, rn(-1, 1) + 8 + (ovr - 60) * 0.55)).toFixed(1)

  const tovRaw   = isBig
    ? 2.0 - ((pm + iq) / 2) * 0.18 + ppg * 0.04
    : 2.6 - ((hnd + pas + iq) / 3) * 0.24 + ppg * 0.05
  const tov      = +(Math.max(0.5, Math.min(5.5, tovRaw + rn(-0.4, 0.4)))).toFixed(1)

  // 82-game regular season with per-game data
  let wins = 0, losses = 0
  const games = []
  const gameLog = []
  let bestGame = null
  const allOpps = [...CONF_TEAMS.east, ...CONF_TEAMS.west].filter(s => s !== team.short)

  for (let i = 0; i < 82; i++) {
    const w = Math.random() < winProb
    if (w) { wins++ } else { losses++ }
    gameLog.push(w ? 'W' : 'L')

    const loserBase = 94 + Math.floor(Math.random() * 22)
    const margin    = 3  + Math.floor(Math.random() * 17)
    const mySc  = w ? loserBase + margin : loserBase
    const oppSc = w ? loserBase : loserBase + margin
    const oppShort = allOpps[Math.floor(Math.random() * allOpps.length)]

    const gamePts = Math.max(0, Math.round(ppg + rn(-7, 10)))
    const gameReb = Math.max(0, Math.round(rpg + rn(-3, 3)))
    const gameAst = Math.max(0, Math.round(apg + rn(-2, 2.5)))

    const game = { g: i + 1, won: w, home: Math.random() < 0.5, opponent: oppShort, mySc, oppSc, pts: gamePts, reb: gameReb, ast: gameAst }
    games.push(game)
    if (!bestGame || gamePts > bestGame.pts) bestGame = game
  }

  const conf = EAST.has(team.short) ? 'east' : 'west'
  const { seed, standings } = simConferenceStandings(wins, team.short, conf)

  const madePlayoffs = seed <= 10
  let playoffRounds = [], champion = false

  if (madePlayoffs) {
    const playoffWinProb = Math.min(0.85, winProb + 0.04)
    const po = simPlayoffs(seed, playoffWinProb, conf, standings)
    playoffRounds = po.rounds
    champion = po.champion
  }

  // MVP: top seed or top-2 + elite PER/PPG + good win total
  const mvpScore = wins * 0.5 + per * 2.5 + ppg * 0.8 + (seed === 1 ? 12 : seed <= 3 ? 6 : 0)
  const mvpThreshold = 85 + Math.random() * 18
  const mvp = mvpScore >= mvpThreshold

  // DPOY: truly elite defensive stats — rare, ~8-15% of seasons
  const dpoyScore = spg * 10 + bpg * 8 + (seed <= 4 ? 4 : seed <= 8 ? 2 : 0)
  const dpoyThreshold = 26 + Math.random() * 10
  const dpoy = dpoyScore >= dpoyThreshold && !mvp

  const finalsRound = playoffRounds.find(r => r.type === 'series' && r.roundIndex === 3)
  const finalsOpp = finalsRound?.opponent?.short ?? null
  const finalsSeries = finalsRound ? `${finalsRound.wins}-${finalsRound.losses}` : null

  return {
    ovr, wins, losses, position,
    ppg, rpg, apg, spg, bpg, tov,
    fgPct, threePct, ftPct, per,
    games, gameLog, bestGame,
    conference: conf, seed, madePlayoffs,
    standings, playoffRounds, champion, team,
    mvp, dpoy,
    finalsOpp, finalsSeries,
  }
}

// ─── Guard Archetype Naming ───────────────────────────────────────────────────
// Types: jumpShot, finishing, passing, handles, perimeterDefense,
//        speed, bounce, size, basketballIQ, clutch
export function getBucketGuardArchetype(ovr, build, types) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return 'Spin to start building'
  const rem = types.length - filled.length
  if (rem > 0) return `${rem} attribute${rem !== 1 ? 's' : ''} remaining`

  const g = t => build[t]?.val ?? 0
  const js  = g('jumpShot'),     fin = g('finishing'),   pas = g('passing')
  const hnd = g('handles'),      pd  = g('perimeterDefense')
  const spd = g('speed'),        bnc = g('bounce')
  const sz  = g('size'),         iq  = g('basketballIQ'), clt = g('clutch')

  const vals   = filled.map(t => build[t].val)
  const spread = Math.max(...vals) - Math.min(...vals)
  const avg    = vals.reduce((s, v) => s + v, 0) / vals.length

  const ranked = [
    { k: 'js', v: js }, { k: 'fin', v: fin }, { k: 'pas', v: pas },
    { k: 'hnd', v: hnd }, { k: 'pd', v: pd }, { k: 'spd', v: spd },
    { k: 'bnc', v: bnc }, { k: 'sz', v: sz }, { k: 'iq', v: iq }, { k: 'clt', v: clt },
  ].sort((a, b) => b.v - a.v)

  const t1 = ranked[0].k, t2 = ranked[1].k, t3 = ranked[2].k
  const top  = k => t1 === k || t2 === k           // in top-2 attrs
  const top3 = k => t1 === k || t2 === k || t3 === k // in top-3 attrs
  const peak = k => t1 === k                        // single best attr
  const hi   = v => v >= 10
  const up   = v => v >= 9
  const good = v => v >= 8

  // True all-around: tight spread AND avg is high
  const isAllAround = spread <= 1 && avg >= 8.0

  if (ovr >= 95) {
    if (hi(js) && hi(hnd) && hi(spd))              return 'Untouchable Shot Creator'
    if (hi(hnd) && hi(pas) && hi(iq))              return 'The Architect'
    if (hi(fin) && hi(spd) && hi(bnc))             return 'Physical Phenomenon'
    if (hi(pd) && hi(js) && hi(hnd))               return 'Perfect Two-Way Guard'
    if (isAllAround)                                return 'Generational Superstar'
    if (peak('js') || top('js'))                   return 'Transcendent Scorer'
    if (peak('fin') || top('fin'))                 return 'Transcendent Athlete'
    if (peak('pas') || top('pas'))                 return 'Maestro Point Guard'
    return 'Transcendent Guard'
  }

  if (ovr >= 90) {
    if (top('js') && top('hnd') && pd < 7)         return 'Elite Shot Creator'
    if (top('pas') && top('hnd') && up(pas))       return 'Elite Playmaker'
    if (top('fin') && top('spd') && up(bnc))       return 'Explosive Slasher'
    if (top('pd') && top('js') && up(pd))          return 'Premier Two-Way Guard'
    if (top('pd') && top('hnd'))                   return 'Two-Way Maestro'
    if (top('iq') && top('pas'))                   return 'System Architect'
    if (top('js') && top('pas'))                   return 'Pass-and-Score Point'
    if (top('bnc') && top('fin') && up(spd))       return 'High-Flying Superstar'
    if (top('js') && top('pd'))                    return 'Elite 3-and-D'
    if (isAllAround)                               return 'Franchise Lead Guard'
    // Fallback by #1 attr
    if (peak('js'))  return 'Elite Scorer'
    if (peak('fin')) return 'Elite Slasher'
    if (peak('hnd')) return 'Elite Ballhandler'
    if (peak('pas')) return 'Elite Floor General'
    if (peak('pd'))  return 'Elite Perimeter Defender'
    if (peak('spd')) return 'Elite Downhill Attacker'
    return 'Superstar'
  }

  if (ovr >= 84) {
    if (top('js') && top('hnd') && pd < 7)         return 'Scoring Shot Creator'
    if (top('js') && top('pd') && good(js))        return '3-and-D Wing'
    if (top('pas') && top('iq') && up(pas))        return 'Pure Point Guard'
    if (top('fin') && top('spd') && good(bnc))     return 'Drive-First Slasher'
    if (top('bnc') && top('fin') && good(spd))     return 'High-Flying Finisher'
    if (top('hnd') && top('fin') && good(hnd))     return 'Combo Guard Slasher'
    if (top('pd') && top('spd') && up(pd))         return 'Point-of-Attack Stopper'
    if (top('js') && top('pas'))                   return 'Playshot Guard'
    if (top('iq') && top3('clt') && good(iq))     return 'Clutch IQ Player'
    if (top('spd') && top('bnc') && pd < 6)        return 'Freak Athlete'
    if (isAllAround)                               return 'Complete Two-Way'
    // Fallback by #1 attr
    if (peak('js'))  return 'Sharpshooter'
    if (peak('fin')) return 'Slasher'
    if (peak('hnd')) return 'Ballhandler'
    if (peak('pas')) return 'Playmaker'
    if (peak('pd'))  return 'Perimeter Stopper'
    if (peak('spd')) return 'Downhill Attacker'
    if (peak('bnc')) return 'Athletic Wing'
    if (peak('iq'))  return 'Cerebral Playmaker'
    return 'Star'
  }

  if (ovr >= 76) {
    if (peak('js') && up(js) && pd >= 7)           return '3-and-D Specialist'
    if (peak('js') && up(js))                      return 'Sharpshooter'
    if (top('fin') && top('spd') && good(fin))     return 'Athletic Finisher'
    if (top('bnc') && top('fin'))                  return 'High-Flying Slasher'
    if (peak('pas') && up(pas))                    return 'Pass-First Floor General'
    if (peak('pd') && up(pd) && spd >= 7)          return 'Perimeter Lockdown'
    if (top('hnd') && top('pas') && good(hnd))     return 'Ball-Dominant Guard'
    if (top('js') && top('pd'))                    return '3-and-D Role Player'
    if (peak('iq') && good(iq))                    return 'Heady Playmaker'
    if (top('spd') && top('bnc') && spd >= 9)      return 'Speed Demon'
    if (isAllAround)                               return 'Versatile Starter'
    // Fallback by #1 attr
    if (peak('js'))  return 'Off-Ball Scorer'
    if (peak('fin')) return 'Rim Runner'
    if (peak('hnd')) return 'Ballhandler'
    if (peak('pas')) return 'Facilitator'
    if (peak('pd'))  return 'Defensive Specialist'
    if (peak('spd')) return 'Athletic Slasher'
    if (peak('bnc')) return 'Athletic Starter'
    if (peak('iq'))  return 'Cerebral Veteran'
    return 'Solid Starter'
  }

  if (ovr >= 68) {
    if (peak('js') && up(js) && pd >= 7)           return 'Catch-and-Shoot Specialist'
    if (peak('js') && good(js))                    return 'Corner Three Specialist'
    if (peak('fin') && good(fin) && bnc >= 8)      return 'High-Energy Rim Runner'
    if (peak('fin') && good(fin))                  return 'Slashing Role Player'
    if (peak('pd') && good(pd))                    return 'Defensive Stopper'
    if (peak('hnd') && good(hnd))                  return 'Handles Backup'
    if (peak('spd') && spd >= 9)                   return 'Explosive Athlete'
    if (peak('bnc') && bnc >= 9)                   return 'High-Motor Athlete'
    if (spread >= 5)                               return 'Specialist Guard'
    if (isAllAround)                               return 'Rotational Piece'
    // Fallback by #1 attr
    if (peak('js'))  return 'Spot-Up Shooter'
    if (peak('fin')) return 'Slashing Backup'
    if (peak('pas')) return 'Passing-First Backup'
    if (peak('iq'))  return 'Smart Role Player'
    return 'Bench Contributor'
  }

  return 'G-League Candidate'
}

// ─── Big Archetype Naming ─────────────────────────────────────────────────────
// Types: jumpShot, finishing, playmaking, interiorDefense,
//        rebounding, speed, bounce, size, basketballIQ, clutch
export function getBucketBigArchetype(ovr, build, types) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return 'Spin to start building'
  const rem = types.length - filled.length
  if (rem > 0) return `${rem} attribute${rem !== 1 ? 's' : ''} remaining`

  const g = t => build[t]?.val ?? 0
  const js  = g('jumpShot'),        fin  = g('finishing'),   pm  = g('playmaking')
  const id  = g('interiorDefense'), reb  = g('rebounding')
  const spd = g('speed'),           bnc  = g('bounce'),      sz  = g('size')
  const iq  = g('basketballIQ'),    clt  = g('clutch')

  const vals   = filled.map(t => build[t].val)
  const spread = Math.max(...vals) - Math.min(...vals)
  const avg    = vals.reduce((s, v) => s + v, 0) / vals.length

  const ranked = [
    { k: 'js', v: js }, { k: 'fin', v: fin }, { k: 'pm', v: pm },
    { k: 'id', v: id }, { k: 'reb', v: reb }, { k: 'spd', v: spd },
    { k: 'bnc', v: bnc }, { k: 'sz', v: sz }, { k: 'iq', v: iq }, { k: 'clt', v: clt },
  ].sort((a, b) => b.v - a.v)

  const t1 = ranked[0].k, t2 = ranked[1].k, t3 = ranked[2].k
  const top  = k => t1 === k || t2 === k
  const top3 = k => t1 === k || t2 === k || t3 === k
  const peak = k => t1 === k
  const hi   = v => v >= 10
  const up   = v => v >= 9
  const good = v => v >= 8

  const isAllAround = spread <= 1 && avg >= 8.0
  const stretch = js >= 8

  if (ovr >= 95) {
    if (hi(js) && hi(fin) && hi(id))               return 'Unstoppable Two-Way Big'
    if (hi(fin) && hi(reb) && hi(id))              return 'Dominant Anchor'
    if (hi(pm) && hi(iq) && hi(js))                return 'Unicorn Point-Center'
    if (hi(fin) && hi(sz) && hi(reb))              return 'Old-School Colossus'
    if (hi(spd) && hi(bnc) && hi(fin))             return 'Positionless Freak'
    if (isAllAround)                               return 'Generational'
    if (peak('js') || top('js'))                   return 'Transcendent Stretch'
    if (peak('fin') || top('fin'))                 return 'Transcendent Post Scorer'
    if (peak('id') || top('id'))                   return 'Transcendent Rim Protector'
    return 'Transcendent'
  }

  if (ovr >= 90) {
    if (top('fin') && top('bnc') && up(fin))       return 'High-Flying Post Beast'
    if (top('id') && top('reb') && up(sz))         return 'Elite Rim Protector'
    if (top('js') && top('id') && good(js))        return 'Stretch-and-Protect Anchor'
    if (top('fin') && top('reb') && up(fin))       return 'Double-Double Machine'
    if (top('pm') && top('js') && good(pm))        return 'Playmaking Stretch Big'
    if (top('id') && top('pm') && up(id))          return 'Elite Two-Way Big'
    if (top('js') && top('pm') && stretch)         return 'Pick-and-Pop Maestro'
    if (top('fin') && top('id'))                   return 'Inside-Out Threat'
    if (top('bnc') && top('spd') && top3('fin'))   return 'Modern Athletic Big'
    if (isAllAround)                               return 'Franchise Cornerstone'
    // Fallback by #1 attr
    if (peak('js'))  return 'Elite Stretch'
    if (peak('fin')) return 'Elite Post Scorer'
    if (peak('id'))  return 'Elite Rim Protector'
    if (peak('reb')) return 'Elite Glass Cleaner'
    if (peak('pm'))  return 'Elite Playmaker'
    if (peak('bnc')) return 'Elite Athlete'
    return 'Superstar'
  }

  if (ovr >= 84) {
    if (top('bnc') && top('fin') && good(bnc) && good(fin)) return 'High-Flying Slasher'
    if (top('js') && top('pm') && good(js))        return 'Pick-and-Pop Playmaker'
    if (top('fin') && top('id') && good(fin))      return 'Two-Way Post Scorer'
    if (top('id') && top('reb') && good(id))       return 'Glass-Eating Anchor'
    if (top('reb') && top('fin') && good(reb))     return 'Putback Machine'
    if (top('spd') && top('bnc') && good(spd))     return 'Switchable Athlete'
    if (top('pm') && top('iq') && good(pm))        return 'Cerebral Playmaker'
    if (top('js') && stretch && top3('id'))        return 'Floor-Spacing Shot Blocker'
    if (top('fin') && top3('spd') && good(fin))    return 'Mobile Post Scorer'
    if (isAllAround)                               return 'Versatile Two-Way'
    // Fallback by #1 attr
    if (peak('js'))  return 'Stretch Four'
    if (peak('fin')) return 'Post Scorer'
    if (peak('id'))  return 'Defensive Anchor'
    if (peak('reb')) return 'Rebounding Monster'
    if (peak('bnc')) return 'Vertical Threat'
    if (peak('pm'))  return 'Playmaking Center'
    if (peak('spd')) return 'Mobile Forward'
    if (peak('sz'))  return 'Towering Presence'
    if (peak('iq'))  return 'High-IQ Veteran'
    return 'Star'
  }

  if (ovr >= 76) {
    if (peak('js') && up(js) && id >= 7)           return 'Stretch-and-Protect'
    if (peak('js') && up(js))                      return 'Pick-and-Pop Stretch'
    if (top('id') && top('reb') && good(id))       return 'Defensive Specialist Big'
    if (top('bnc') && top('fin') && good(bnc))     return 'High-Flying Finisher Big'
    if (peak('fin') && up(fin))                    return 'Post Finisher'
    if (peak('reb') && up(reb))                    return 'Glass Cleaner'
    if (top('spd') && top('bnc') && good(spd))     return 'Switchable Athlete'
    if (peak('pm') && up(pm))                      return 'Facilitating Center'
    if (peak('id') && up(id))                      return 'Rim Protector'
    if (top('sz') && sz >= 9)                      return 'Bruising Big'
    if (isAllAround)                               return 'Balanced Power Forward'
    // Fallback by #1 attr
    if (peak('js'))  return 'Stretch Forward'
    if (peak('fin')) return 'Post Scorer'
    if (peak('id'))  return 'Interior Defender'
    if (peak('reb')) return 'Board Crasher'
    if (peak('bnc')) return 'Athlete'
    if (peak('spd')) return 'Mobile Forward'
    if (peak('pm'))  return 'Playmaker'
    if (peak('iq'))  return 'Heady Veteran'
    return 'Solid'
  }

  if (ovr >= 68) {
    if (peak('js') && up(js))                      return 'Floor-Spacing Specialist'
    if (peak('reb') && up(reb))                    return 'Rebounding Machine'
    if (peak('id') && up(id))                      return 'Interior Enforcer'
    if (top('bnc') && top('fin') && good(bnc))     return 'Above-the-Rim Finisher'
    if (peak('fin') && good(fin))                  return 'Hustle Finisher'
    if (spread >= 5)                               return 'Specialist'
    if (isAllAround)                               return 'Versatile Role Player'
    if (peak('js'))  return 'Spot-Up Shooter'
    if (peak('fin')) return 'Blue-Collar Finisher'
    if (peak('id'))  return 'Defensive Reserve'
    if (peak('reb')) return 'Energy Rebounder'
    if (peak('bnc')) return 'Lob Threat'
    return 'Bench Piece'
  }

  return 'G-League Candidate'
}
