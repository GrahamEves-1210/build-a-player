// BLACKTOP LIVE: real-time Blacktop, the game as pure code (the brief: F:/bap-agents/btlive/DESIGN.md).
// No DOM, no React: it runs in the browser, in Node (scripts/btlive/balance.mjs) and, later, on the live server.
//   tune.js     every balance number, one line each
//   ratings.js  a build's grades as the numbers the game runs on
//   meter.js    the shot meter (judged on the shooter's device; only its quality goes to the referee)
//   referee.js  every discrete decision: makes, blocks, steals, moves, picks, boards, the score
//   sim.js      the fixed-step simulation: step(state, inputs)
//   cpu.js      the CPU players and their levels (practice, and a seat whose person is away)
//   modes.js    the games: 1v1, 2v2, King of the Hill
//   gesture.js  the dribble moves off the one stick (a snap, a pump, a half circle) and the keyboard's double tap
export * from './tune.js'
export * from './ratings.js'
export * from './meter.js'
export * as referee from './referee.js'
export * from './sim.js'
export * from './cpu.js'
export * from './modes.js'
export { createGesture, createTaps, GEST, TAPS } from './gesture.js'
export { hashSeed, rollAt, gauss } from './rng.js'
