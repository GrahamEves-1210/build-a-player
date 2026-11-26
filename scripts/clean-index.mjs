// The first step of npm run build: in the clean build (scripts/clean-flag.mjs) the website shows the app's jerseys,
// so it rebuilds their index from the rosters first, as npm run build:app does (scripts/build-jersey-index.mjs).
// Anywhere else it does nothing.
import { isClean } from './clean-flag.mjs'

if (isClean()) await import('./build-jersey-index.mjs')
else console.log('clean-index: off (not the clean build)')
