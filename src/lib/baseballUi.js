// Baseball's small shared pieces: the figure, the positions, the pool names, which modes are ready and the
// build's name. Its own tiny file (no rosters), so Home, the build screen, the season page and the share
// link can all read it without loading the baseball data. The baseball app itself: components/BaseballApp.jsx.

// ── The figure ─────────────────────────────────────────────────────────────
// PLACEHOLDER: the owner draws baseball's own silhouette. Until then the build screen uses the basketball
// T-pose (same image, same overlay), the way soccer does (SOCCER_SILHOUETTE). Swap the image here when the
// art lands; the dots and the coloured uniform parts below ride on the basketball figure's points until then.
// backdrop: the build screen's picture behind the figure (the ballpark at night, public/baseballbackground.webp)
export const BASEBALL_SILHOUETTE = { src: '/basketballsilhouette.png', headless: '/basketballsilhouetteheadless.png', placeholder: 'bucket', backdrop: '/baseballbackground.webp' }

// The ten trait keys of each position, in the spec's order (data/mlb-attrs.js holds their labels and colours)
export const BASEBALL_KEYS = {
  bat: ['contact', 'power', 'eye', 'avoidK', 'gap', 'speed', 'baserunning', 'fielding', 'arm', 'clutch'],
  pit: ['velocity', 'movement', 'breaking', 'changeup', 'control', 'command', 'stamina', 'groundball', 'composure', 'pitchIQ'],
}

// The build screen's tabs (the spec's categories; data/mlb-attrs.js's own, when it exports them, win)
export const BASEBALL_CATEGORIES = {
  bat: [
    { id: 'hitting', label: 'Hitting', types: ['contact', 'power', 'eye', 'avoidK', 'gap'] },
    { id: 'athletic', label: 'Athletic', types: ['speed', 'fielding', 'arm'] },
    { id: 'mental', label: 'Mental', types: ['baserunning', 'clutch'] },
  ],
  pit: [
    { id: 'stuff', label: 'Stuff', types: ['velocity', 'movement', 'breaking', 'changeup'] },
    { id: 'command', label: 'Command', types: ['control', 'command', 'groundball'] },
    { id: 'physical', label: 'Physical', types: ['stamina'] },
    { id: 'mental', label: 'Mental', types: ['composure', 'pitchIQ'] },
  ],
}

// Each trait takes one of the basketball figure's spots and body parts. The head (and his face): the eye at
// the plate, a pitcher's head for the game. The chest (uniform, cap logo and number): Clutch / Composure. The
// body (height, weight): Power / Stamina. The throwing hand and arm, the legs and the feet as they read.
export const BASEBALL_AS_BUCKET = {
  bat: { eye: 'basketballIQ', clutch: 'clutch', contact: 'handles', gap: 'finishing', avoidK: 'passing', arm: 'jumpShot', fielding: 'perimeterDefense', power: 'size', speed: 'speed', baserunning: 'bounce' },
  pit: { pitchIQ: 'basketballIQ', composure: 'clutch', velocity: 'handles', breaking: 'finishing', movement: 'passing', changeup: 'jumpShot', control: 'perimeterDefense', command: 'speed', stamina: 'size', groundball: 'bounce' },
}
export const baseballAsBucketBuild = (build, pos) => {
  const m = BASEBALL_AS_BUCKET[pos === 'pit' ? 'pit' : 'bat']
  return Object.fromEntries(Object.entries(build ?? {}).map(([t, c]) => [m[t] ?? t, c]))
}
// whose face the figure wears, whose uniform and number, whose height and weight, and which hands
export const BASEBALL_SLOTS = {
  bat: { photo: 'eye', kit: 'clutch', size: 'power', bats: 'contact', throws: 'arm' },
  pit: { photo: 'pitchIQ', kit: 'composure', size: 'stamina', bats: 'stamina', throws: 'velocity' },
}

// ── Positions: the build is a batter or a pitcher; every player also has his real role ──
export const BASEBALL_POS = {
  bat: { key: 'bat', label: 'BATTER', word: 'Batter', short: 'BAT', sub: 'C · IF · OF · DH', plural: 'hitters', roles: ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] },
  pit: { key: 'pit', label: 'PITCHER', word: 'Pitcher', short: 'PIT', sub: 'SP · RP · CL', plural: 'pitchers', roles: ['SP', 'RP', 'CL'] },
}
export const baseballPosOf = p => (p === 'pit' ? 'pit' : 'bat')

// ── Pools: the keys stay 'current' / 'alltime' everywhere (boards, compete, saves) ──
export const BASEBALL_POOL = {
  current: { key: 'current', mode: 'classic', label: 'CURRENT', line: '2026 MLB rosters', team: 'TEAM', teams: 'teams' },
  alltime: { key: 'alltime', mode: 'all-time', label: 'ALL-TIME', line: 'Franchise legends', team: 'FRANCHISE', teams: 'franchises' },
}
// the app's game modes are 'classic' / 'all-time' (like basketball); the pool key from either
export const baseballPoolOf = gameMode => (gameMode === 'all-time' || gameMode === 'alltime' ? 'alltime' : 'current')

// ── Which baseball modes are built ─────────────────────────────────────────
// Each one is wired in BaseballApp (Home's card, the dock's fan, the page and its handlers) and shows as
// COMING SOON until its agent flips it on:
//   career  → lib/career.js ensureSport('baseball') (lib/careerBaseball.js) + AppCareer / CareerIntro with sport 'baseball'
//   compete → lib/competeCore.js COMPETE_POS.baseball / verifyCore.js / the worker's kits (lib/baseballKits.js) + AppCompete
//   salary  → components/BaseballSalaryCap.jsx (the parallel of SoccerSalaryCap), lazy-loaded in BaseballApp
//   squad   → lib/squad.js baseball spots + lib/squadBaseball.js (loadSquadBaseball in lib/squadSeason.js) + AppSquad
//   boards  → lib/boards.js baseball boards + AppLeaderboards with sport 'baseball'; also turns on the season's save
//             (BaseballApp saveBaseballSeason → lib/submit.js saveSeason('baseball', pos, …): the live worker must take it)
//   cards   → the card binder (AppCards) knows baseball: until then a spin doesn't put a card in it
export const BASEBALL_MODES = { career: true, compete: true, salary: true, squad: true, boards: true, cards: true }

// ── The build's name: what kind of player it is ───────────────────────────
// (a tier for the OVR, then the kind of player his best traits make him, as a scout or a broadcaster says it)
export function baseballArchetype(ovr, build, types, pos = 'bat') {
  const filled = types.filter(t => build[t])
  if (!filled.length) return 'Spin to start building'
  const rem = types.length - filled.length
  if (rem > 0) return `${rem} attribute${rem !== 1 ? 's' : ''} remaining`
  const g = t => build[t]?.val ?? 0
  const vals = filled.map(t => build[t].val ?? 0)
  const spread = Math.max(...vals) - Math.min(...vals)
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
  let kind, tier
  if (pos === 'pit') {
    const vel = g('velocity'), mov = g('movement'), brk = g('breaking'), chg = g('changeup'), ctl = g('control')
    const cmd = g('command'), sta = g('stamina'), gb = g('groundball')
    if (spread <= 2 && avg >= 8) kind = 'Frontline Ace'
    else if (vel >= 10 && brk >= 7) kind = 'Strikeout Artist'
    else if (vel >= 9) kind = 'Power Arm'
    else if (gb + mov >= 15 && gb >= 7) kind = 'Sinkerballer'
    else if (ctl + cmd >= 15 && vel <= 6) kind = 'Finesse Pitcher'
    else if (ctl + cmd >= 14) kind = 'Control Artist'
    else if (sta >= 8) kind = 'Workhorse'
    else if (chg >= 8) kind = 'Changeup Specialist'
    else kind = 'Swingman'
    tier = ovr >= 95 ? 'Hall of Fame' : ovr >= 90 ? 'Cy Young' : ovr >= 84 ? 'All-Star' : ovr >= 77 ? 'Big League' : ovr >= 70 ? 'Fringe' : 'Triple-A'
  } else {
    const con = g('contact'), pow = g('power'), eye = g('eye'), ak = g('avoidK'), gap = g('gap')
    const spd = g('speed'), br = g('baserunning'), fld = g('fielding'), arm = g('arm')
    if (spread <= 2 && avg >= 8) kind = 'Five-Tool Player'
    else if (pow >= 8 && eye >= 7 && ak <= 5) kind = 'Three True Outcomes'
    else if (pow + gap >= Math.max(con + ak, spd + br, fld + arm) && pow >= 7) kind = 'Slugger'
    else if (spd + br >= con + pow && spd >= 8) kind = 'Speedster'
    else if (eye + spd + br >= con + pow + gap && eye >= 7) kind = 'Leadoff Hitter'
    else if (con + ak >= pow + gap && con >= 7) kind = 'Contact Hitter'
    else if (fld + arm >= con + pow && fld >= 8) kind = 'Glove-First Defender'
    else if (gap + con >= 13) kind = 'Gap Hitter'
    else kind = 'Utility Man'
    tier = ovr >= 95 ? 'Hall of Fame' : ovr >= 90 ? 'MVP-Caliber' : ovr >= 84 ? 'All-Star' : ovr >= 77 ? 'Everyday' : ovr >= 70 ? 'Platoon' : 'Triple-A'
  }
  return `${tier} ${kind}`
}

// a height in inches as a scorecard prints it
export const fmtBaseballHeight = inches => (inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : null)
// bats / throws off the build's two hand traits ('S' a switch-hitter)
export function baseballHands(build, pos) {
  const s = BASEBALL_SLOTS[pos === 'pit' ? 'pit' : 'bat']
  const b = build?.[s.bats]?.bats ?? null, t = build?.[s.throws]?.throws ?? null
  return b || t ? `${b ?? '–'}/${t ?? '–'}` : null
}
