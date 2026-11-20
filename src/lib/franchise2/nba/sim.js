// NBA FRANCHISE, part C (the court and the players): every function core calls, in one place, by the names in
// nba/STATE.md. seams.js can re-export this file whole: `export * from './sim'`.
export { rotationOf, planRotation, startersOf, dressed } from './rotation'
export { simGame, startGame, playTo, possession, finishGame, clutchTime, TUNE } from './game'
export { recordGame, leaders, leadersIn, perGame, gameScore, LEADER_CATS, addLine, teamSeason } from './stats'
export { rollInjuries, tickInjuries, restFor, outText, injuryChance, KINDS as INJURY_KINDS } from './injury'
export { ageLeague, ageMan, retireChance, prospect, attrsFor, seedPotential, careerRow } from './aging'
export { seasonAwards, finalsMvp, seriesMvp, allStars, updateRecords, eligible, prod, winsOf, AWARD_NAME, REAL_RECORDS } from './awards'
export { prof, ovrOf } from './skills'
