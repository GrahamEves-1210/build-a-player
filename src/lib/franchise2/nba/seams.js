// NBA FRANCHISE: the one door from the core to the cap engine (B: cap.js, contracts.js, market.js, trades.js) and
// the game sim (C: game.js, stats.js, injury.js, aging.js, awards.js). The names are fixed in STATE.md. Until those
// branches land these come from stubs.js; at the merge each line points at its real file.
export {
  rotationOf, simGame, recordGame, rollInjuries, tickInjuries, restFor, leaders, seasonAwards, finalsMvp, ageLeague,
  startGame, playTo, possession, finishGame, seriesMvp, updateRecords, seedPotential, prospect, outText,
  allStars as pickAllStars,
} from './sim'
export {
  capOf, taxOf, apron1Of, apron2Of, minOf, maxOf, rookieScale, payroll, capSheet, dealOnLoad, canSign, signMan, rookieDeal,
  seasonEndDeals, resignOffer, askOf, cpuOffseason, faDay, cutMan, legalRoster,
  tradeValue, checkTrade, cpuAnswer, doTrade, cpuDeadline,
} from './stubs'
