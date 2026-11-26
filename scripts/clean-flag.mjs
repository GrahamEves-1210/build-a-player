// The clean build (App Store IP-safe: jerseys and team tags for photos and logos, no league marks in the copy) is
// a build-time switch, on when any of these is set at build time:
//   VITE_CLEAN=1                 any build, by hand (npm run build, npm run build:app, vite)
//   CF_PAGES_BRANCH=app-clean    Cloudflare Pages building the app-clean branch (its preview site)
//   CM_BRANCH=app-clean          Codemagic building the app-clean branch
// main, app and every other branch build with it off. vite.config.js turns it into __CLEAN__ (lib/platform.js:
// CLEAN), and scripts/clean-dist.mjs cleans the built HTML and drops the logo files.
export const isClean = (env = process.env) =>
  env.VITE_CLEAN === '1' || env.VITE_CLEAN === 'true' || env.CF_PAGES_BRANCH === 'app-clean' || env.CM_BRANCH === 'app-clean'
