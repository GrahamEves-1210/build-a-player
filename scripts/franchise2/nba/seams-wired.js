// The seams with the cap engine wired in (the sim's half still core's stand-ins): what core's seams.js becomes once
// this branch lands. wired.mjs bundles a script with this file in place of nba/seams.js.
export {
  rotationOf, simGame, recordGame, rollInjuries, tickInjuries, restFor, leaders, seasonAwards, finalsMvp, ageLeague,
  startGame, playTo, possession, finishGame,
} from '../../../src/lib/franchise2/nba/stubs'
export { capOf, taxOf, apron1Of, apron2Of, minOf, maxOf, rookieScale, payroll, capSheet, assessTax } from '../../../src/lib/franchise2/nba/cap'
export { dealOnLoad, canSign, signMan, rookieDeal, seasonEndDeals, resignOffer, cutMan, legalRoster } from '../../../src/lib/franchise2/nba/contracts'
export { askOf, cpuOffseason, faDay, offerSheet, matchSheet } from '../../../src/lib/franchise2/nba/market'
export { tradeValue, checkTrade, cpuAnswer, doTrade, cpuDeadline } from '../../../src/lib/franchise2/nba/trades'
