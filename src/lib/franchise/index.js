// FRANCHISE: the engine's front door. Everything a screen may call is exported here and documented in API.md
// (same folder). Pure JS: no React, no DOM (save.js touches localStorage behind a guard), seeded, no Math.random.
import { buildLeague } from './league'
import * as S from './stubs'

// ── Creation, saves, settings ────────────────────────────────────────────────
export function createFranchise(opts = {}) {
  return buildLeague({ ...opts, gmName: opts.gmName ?? opts.coachName })
}
export { saveFranchise, loadFranchise, listSlots, deleteSlot, packFranchise, unpackFranchise } from './save'
export { settingsOf, setSetting, LIMITS } from './select'
export const renamePlayer = S.stubAction
export const setNumber = S.stubAction

// ── Selectors ────────────────────────────────────────────────────────────────
export { roster, depthChart, capSheet, schedule, weekGames, teams, staff } from './select'
export const hub = S.stubHub
export const weekTasks = S.stubTasks
export const pregame = S.stubPregame
export const scoutingReport = S.stubScouting
export const lastWeek = S.stubLastWeek
export const playerCard = S.stubCard
export const teamNeeds = S.stubList
export const injuryReport = S.stubList
export const teamInfo = S.stubNull
export const coachCard = S.stubNull
export const boxScore = S.stubNull
export const standings = S.stubStandings
export const playoffPicture = S.stubPicture
export const leaders = S.stubLeaders
export const teamStats = S.stubList
export const awardRaces = S.stubRaces
export const news = S.stubList
export const transactions = S.stubList
export const powerRankings = S.stubList
export const history = S.stubHistory
export const ownerView = S.stubOwner
export const tradeBlock = S.stubBlock
export const tradeAssets = S.stubAssets
export const tradeVerdict = S.stubVerdict
export const freeAgents = S.stubList

// ── In-season actions ────────────────────────────────────────────────────────
export { setDepth, autoDepthChart } from './select'
export const setGameplan = S.stubAction
export const setPractice = S.stubAction
export const officeItems = S.stubList
export const resolveOffice = S.stubAction
export const upgradeTrait = S.stubAction
export const autoUpgrade = S.stubAction
export const proposeTrade = S.stubAction
export const answerOffer = S.stubAction
export const setBlock = S.stubAction
export const shopPlayer = S.stubAction
export const releasePlayer = S.stubAction
export const signFreeAgent = S.stubAction
export const moveToIR = S.stubAction
export const activate = S.stubAction
export const extendPlayer = S.stubAction
export const scoutProspect = S.stubAction
export const delegateWeek = S.stubAction

// ── The game ─────────────────────────────────────────────────────────────────
export const startGame = S.stubAction
export const stepGame = S.stubAction
export const nextStop = S.stubAction
export const resolveStop = S.stubAction
export const skipGame = S.stubAction
export const finishGame = S.stubAction
export const gameView = S.stubNull
export const gameCast = S.stubNull

// ── Advancing ────────────────────────────────────────────────────────────────
export const advanceWeek = S.stubAction
export const simTo = S.stubAction

// ── Offseason ────────────────────────────────────────────────────────────────
export const offseason = S.stubOffseason
export const advanceStage = S.stubAction
export const seasonReview = S.stubReview
export const jobOffers = S.stubList
export const takeJob = S.stubAction
export const coachMarket = S.stubMarket
export const hireCoach = S.stubAction
export const fireCoach = S.stubAction
export const hireBuiltCoach = S.stubAction
export const scoutPool = S.stubList
export const hireScout = S.stubAction
export const gmTree = S.stubTree
export const buyPerk = S.stubAction
export const expiring = S.stubList
export const openTalks = S.stubAction
export const makeOffer = S.stubAction
export const tagPlayer = S.stubAction
export const exerciseOption = S.stubAction
export const letWalk = S.stubAction
export const freeAgency = S.stubFA
export const bidFreeAgent = S.stubAction
export const withdrawBid = S.stubAction
export const advanceFA = S.stubAction
export const draftBoard = S.stubBoard
export const draftView = S.stubDraft
export const draftPick = S.stubAction
export const simToMyPick = S.stubAction
export const autoDraft = S.stubAction
export const udfaPool = S.stubList
export const signUdfa = S.stubAction
export const campView = S.stubCamp
export const resolveDrill = S.stubAction
export const resolveHoldout = S.stubAction
export const cutsView = S.stubCuts
export const autoCut = S.stubAction
export const newSeason = S.stubNewSeason

// ── The autopilot ────────────────────────────────────────────────────────────
export const autopilot = S.stubAction

// ── Constants ────────────────────────────────────────────────────────────────
export { BUILD_CAPS, DEFAULT_SETTINGS, SAVE_VERSION, TRADE_DEADLINE, DEV, DRIVES, DRIVE_TEXT, SLOTS, STAGES, PLAYOFF_ROUNDS, gradeOf, ovrGrade } from './consts'
export { COACH_TYPES, COACH_LABEL, ROLE_NAME, coachDataIsReal, useCoachData } from './coachData'
export { moneyText } from './money'
export { teamRef, photoUrl } from './rows'
export const GAMEPLANS = {
  off: [
    { id: 'balanced', label: 'BALANCED', text: 'Take what the defense gives.', good: 'no weakness to attack' },
    { id: 'air', label: 'THROW TO WIN', text: 'More passes, more of them downfield.', good: 'against a weak secondary' },
    { id: 'ground', label: 'RUN TO WIN', text: 'More carries, the clock runs.', good: 'against a weak run defense' },
    { id: 'quick', label: 'QUICK GAME', text: 'The ball is out fast: fewer sacks, shorter throws.', good: 'against a strong pass rush' },
    { id: 'shots', label: 'TAKE SHOTS', text: 'Deep balls off play-action: bigger plays, more risk.', good: 'against safeties who can be beaten deep' },
  ],
  def: [
    { id: 'balanced', label: 'BALANCED', text: 'Play it straight.', good: 'no tendency to take away' },
    { id: 'stopRun', label: 'STOP THE RUN', text: 'An extra man in the box.', good: 'against a team that lives on the ground' },
    { id: 'rush', label: 'BRING PRESSURE', text: 'Blitz more: more sacks, more big plays allowed.', good: 'against a weak line or a slow quarterback' },
    { id: 'cover', label: 'TAKE AWAY THE PASS', text: 'Drop seven and eight: fewer big throws, softer against the run.', good: 'against a great passing game' },
    { id: 'ball', label: 'GO FOR THE BALL', text: 'Jump routes and strip the ball: more takeaways, more yards allowed.', good: 'against a quarterback who gives it away' },
  ],
}
export const PRACTICE = [
  { id: 'full', label: 'FULL PADS', text: 'The most XP. The most wear, and a real injury risk.', xp: 1.5, wear: 6 },
  { id: 'half', label: 'HALF PADS', text: 'Steady work.', xp: 1, wear: 2 },
  { id: 'walk', label: 'WALKTHROUGH', text: 'Fresh legs for Sunday. Little XP.', xp: 0.45, wear: -6 },
]
export const MOMENT_FITS = {}
