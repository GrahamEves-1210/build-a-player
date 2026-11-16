// Soccer's small shared pieces: the figure, the pool names, the Home faces and which modes are
// ready. Its own tiny file (no rosters), so Home, the build screen and the season page can all
// read it without loading the soccer data. The soccer app itself: components/SoccerApp.jsx.

// ── The figure ─────────────────────────────────────────────────────────────
// PLACEHOLDER: the owner draws soccer's own silhouette. Until then the build screen uses the
// basketball T-pose (same image, same overlay). Swap the image here when the art lands; the
// dots and the coloured kit parts below ride on the basketball figure's points until then.
export const SOCCER_SILHOUETTE = { src: '/basketballsilhouette.png', headless: '/basketballsilhouetteheadless.png', placeholder: 'bucket' }

// Each striker trait takes one of the basketball figure's spots and body parts:
// heading on the head (and his face), composure on the shirt (crest, name and number),
// shot power on the boots, pace on the legs and shorts, size the build (height, weight, arms). Nine traits since
// 11-16: the basketball figure's jump-shot spot is left empty (four a side, Size's row under the right four).
export const SOCCER_AS_BUCKET = {
  heading: 'basketballIQ', passing: 'passing', composure: 'clutch', shotPower: 'bounce',
  size: 'size', dribbling: 'handles', finishing: 'finishing', positioning: 'perimeterDefense', pace: 'speed',
}
export const SOCCER_PHOTO_SLOT = 'heading'   // whose face the figure wears
export const SOCCER_KIT_SLOT = 'composure'   // whose shirt, crest and number
export const SOCCER_SIZE_SLOT = 'size'       // whose height and weight
export const soccerAsBucketBuild = build => Object.fromEntries(Object.entries(build ?? {}).map(([t, c]) => [SOCCER_AS_BUCKET[t] ?? t, c]))

// ── Pools: the keys stay 'current' / 'alltime' everywhere (boards, compete, saves) ──
export const SOCCER_POOL = {
  // (the wheel's clubs are the Champions League's 36 since 11-16; Career still plays the domestic leagues)
  current: { key: 'current', mode: 'classic', label: 'CHAMPIONS LEAGUE', short: 'UCL', line: 'The 36 clubs of 2026-27', team: 'CLUB', teams: 'clubs' },
  alltime: { key: 'alltime', mode: 'all-time', label: 'WORLD CUP', short: 'WORLD CUP', line: '48 nations across history', team: 'NATION', teams: 'nations' },
}
// the app's game modes are 'classic' / 'all-time' (like basketball); the pool key from either
export const soccerPoolOf = gameMode => (gameMode === 'all-time' || gameMode === 'alltime' ? 'alltime' : 'current')

// ── Which soccer modes are built ───────────────────────────────────────────
// Each one is wired in SoccerApp (Home's card, the dock's fan, the page and its handlers) and
// shows as COMING SOON until its agent flips it on:
//   career  → lib/career.js SPORT.soccer + AppCareer / CareerIntro with sport 'soccer'
//   compete → lib/competeCore.js / verifyCore.js / live/ soccer kits + AppCompete with sport 'soccer'
//   salary  → components/SoccerSalaryCap.jsx (the parallel of BucketSalaryCap), lazy-loaded in SoccerApp
//   squad   → lib/squad.js SPOTS for soccer + AppSquad with sport 'soccer'
//   boards  → lib/boards.js soccer boards + AppLeaderboards with sport 'soccer'; also turns on the season's save
//             (SoccerApp saveSoccerSeason → lib/submit.js saveSeason('soccer', 'st', …): the live worker must take it)
//   cards   → the card binder (AppCards) knows soccer: until then a spin doesn't put a card in it
export const SOCCER_MODES = { career: true, compete: true, salary: true, squad: true, boards: true, cards: true }

// ── Home: the strikers on the pool cards (headshot files, see data/soccer-headshots.json) ──
// Filled from the roster's own headshots (SoccerApp hands Home the ones it has); empty until then.
export const SOCCER_FACES = { current: [], alltime: [] }

// ── The build's name: what kind of striker it is ──────────────────────────
// (a tier word for the OVR, then the kind of No. 9 the two best traits make him)
export function soccerArchetype(ovr, build, types) {
  const filled = types.filter(t => build[t])
  if (!filled.length) return 'Spin to start building'
  const rem = types.length - filled.length
  if (rem > 0) return `${rem} attribute${rem !== 1 ? 's' : ''} remaining`
  const g = t => build[t]?.val ?? 0
  const vals = filled.map(t => build[t].val ?? 0)
  const spread = Math.max(...vals) - Math.min(...vals)
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
  const fin = g('finishing'), pow = g('shotPower'), hed = g('heading'), dri = g('dribbling')
  const lnk = g('passing'), pac = g('pace'), str = g('size'), off = g('positioning'), com = g('composure')
  let kind
  if (spread <= 2 && avg >= 8) kind = 'Complete Forward'
  else if (hed + str >= Math.max(fin + off, lnk + dri, pac + dri, pow + fin) && hed >= 7) kind = 'Target Man'
  else if (lnk + dri + com >= (fin + off + pac) && lnk >= 7) kind = 'False Nine'
  else if (pac + dri >= fin + off && pac >= 8) kind = 'Inside Forward'
  else if (fin + off >= pow + str && fin >= 7) kind = 'Poacher'
  else if (pow + str >= 14) kind = 'Battering Ram'
  else if (lnk + com >= 13) kind = 'Deep-Lying Forward'
  else kind = 'Advanced Forward'
  const tier = ovr >= 95 ? 'Ballon d\'Or' : ovr >= 90 ? 'World-Class' : ovr >= 84 ? 'Elite' : ovr >= 77 ? 'First-Choice' : ovr >= 70 ? 'Squad' : 'Academy'
  return `${tier} ${kind}`
}
