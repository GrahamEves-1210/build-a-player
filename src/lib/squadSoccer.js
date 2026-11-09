// SQUAD BUILDER, soccer's half: the rosters and the engine a soccer squad plays on. Its own module so
// football and basketball's Squad Builder never download them: lib/squadSeason.js loads it
// (loadSquadSoccer) before a soccer squad shows (SoccerApp does that when it opens Squad Builder).
export { runSoccerSimulation, scriptSoccerSeason, soccerStrikerLift, calcSoccerOVR, getSoccerArchetype } from '../utils/soccerSimulation'
export { SOCCER_CLUBS } from '../data/soccer-clubs'
export { WC_NATIONS } from '../data/soccer-nations'
export { SOCCER_STRIKERS, WC_STRIKERS } from '../data/soccer-strikers'
export { default as SOCCER_HEADSHOTS } from '../data/soccer-headshots.json'
