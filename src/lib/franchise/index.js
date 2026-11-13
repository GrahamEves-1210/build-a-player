// FRANCHISE: the engine's front door. Everything a screen may call is exported here and documented in API.md
// (same folder). Pure JS: no React, no DOM (save.js touches localStorage behind a guard), seeded, no Math.random.
import { buildLeague } from './league'
import { startOwner } from './owner'
import { powerRankings as rankPower } from './season'
import { setExpectations } from './awards'
import { teamRating } from './core'
import { computeStates } from './state'
import { newDraftClass } from './draft'
import { makeOffice } from './office'
import { rngOf } from './rng'
import { prepWeek } from './week'

// ── Creation, saves, settings ────────────────────────────────────────────────
export function createFranchise(opts = {}) {
  const F = buildLeague({ ...opts, gmName: opts.gmName ?? opts.coachName })
  prepWeek(F)
  rankPower(F)
  setExpectations(F, s => teamRating(F, F.teams[s]).ovr)
  computeStates(F, { quiet: true })
  startOwner(F)
  newDraftClass(F)
  makeOffice(F, rngOf(`${F.seed}-office-0`))
  return F
}
export { saveFranchise, loadFranchise, listSlots, deleteSlot, packFranchise, unpackFranchise } from './save'
export { teamPreviews, teamState, leagueStates, setDirection, STATES, STATE_LABEL, STATE_TEXT } from './state'
export { settingsOf, setSetting, LIMITS } from './select'
export { renamePlayer, setNumber } from './actions'

// ── Selectors ────────────────────────────────────────────────────────────────
export { roster, depthChart, capSheet, schedule, weekGames, teams, staff } from './select'
export {
  hub, weekTasks, pregame, scoutingReport, lastWeek, playerCard, teamNeeds, injuryReport, teamInfo, coachCard, boxScore, standings, playoffPicture,
  leaders, teamStats, awardRaces, news, transactions, powerRankings, history, ownerView, tradeBlock, tradeAssets, tradeVerdict, freeAgents, LEADER_LABELS,
} from './views'

// ── In-season actions ────────────────────────────────────────────────────────
export { setDepth, autoDepthChart } from './select'
export {
  setGameplan, setPractice, officeItems, resolveOffice, upgradeTrait, autoUpgrade, proposeTrade, answerOffer, setBlock, shopPlayer,
  releasePlayer, signFreeAgent, moveToIR, activate, extendPlayer, delegateWeek,
} from './actions'

// ── The game ─────────────────────────────────────────────────────────────────
export { startGame, stepGame, nextStop, resolveStop, skipGame, finishGame, gameView, advanceWeek, simTo } from './live'
export { gameCast, campCast } from './cast'

// ── Offseason ────────────────────────────────────────────────────────────────
export {
  offseason, advanceStage, seasonReview, jobOffers, takeJob, coachMarket, hireCoach, fireCoach, hireBuiltCoach, scoutPool, hireScout, gmTree, buyPerk,
  expiring, openTalks, makeOffer, tagPlayer, exerciseOption, letWalk, freeAgency, bidFreeAgent, withdrawBid, advanceFA,
  udfaPool, signUdfa, campView, resolveDrill, resolveHoldout, cutsView, autoCut, newSeason,
} from './offseason'
export { draftBoard, draftView, draftPick, simToMyPick, autoDraft, scoutProspect } from './draft'

// ── The autopilot ────────────────────────────────────────────────────────────
export { autopilot } from './auto'

// ── Constants ────────────────────────────────────────────────────────────────
export { BUILD_CAPS, DEFAULT_SETTINGS, SAVE_VERSION, TRADE_DEADLINE, DEV, DRIVES, DRIVE_TEXT, SLOTS, STAGES, PLAYOFF_ROUNDS, gradeOf, ovrGrade } from './consts'
export { COACH_TYPES, COACH_LABEL, COACH_ATTR, ROLE_NAME, coachDataIsReal, useCoachData, coachOvr } from './coachData'
export { moneyText } from './money'
export { teamRef, photoUrl } from './rows'
export { MOMENT_FITS } from './moments'
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
  { id: 'full', label: 'FULL PADS', text: 'The most XP. The most wear, and a real injury risk.', xp: 1.5, wear: 2.4 },
  { id: 'half', label: 'HALF PADS', text: 'Steady work.', xp: 1, wear: 0.4 },
  { id: 'walk', label: 'WALKTHROUGH', text: 'Fresh legs for Sunday. Little XP.', xp: 0.45, wear: -5 },
]
