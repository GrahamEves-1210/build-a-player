// The last step of npm run build and npm run build:app. A no-op unless the clean build is on
// (scripts/clean-flag.mjs: the app-clean branch on Cloudflare Pages / Codemagic, or VITE_CLEAN=1). Then:
//  - the built pages' own words lose the leagues' marks (the prerendered /bucket, /soccer, /baseball pages too)
//  - the team logo files, the Salary Cap screenshots and Home's figures that wear team marks leave the bundle (scripts/strip-dist-app-art.mjs), since
//    the clean build draws team tags and jerseys for them (lib/appArt.js) and never asks for one
// The headshots are never in dist (scripts/strip-dist-headshots.mjs); the clean build doesn't ask for them either.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { isClean } from './clean-flag.mjs'
import { cleanHtml } from './clean-html.mjs'

if (!isClean()) { console.log('clean-dist: off (not the clean build)'); process.exit(0) }
let pages = 0
const sweep = dir => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) { if (f !== 'assets' && f !== 'headshots' && f !== 'logos') sweep(p); continue }
    if (!f.endsWith('.html')) continue
    const html = readFileSync(p, 'utf8'), out = cleanHtml(html)
    if (out !== html) { writeFileSync(p, out); pages++ }
  }
}
if (existsSync('dist')) sweep('dist')
console.log(`clean-dist: cleaned the words on ${pages} pages`)
await import('./strip-dist-app-art.mjs')
// Home's painted figures with real teams' marks on them: the clean build shows public/modes/clean's instead
let figs = 0
for (const f of ['qb', 'qb2', 'wr', 'te', 'db']) { const p = `dist/modes/fig-${f}.webp`; if (existsSync(p)) { rmSync(p); figs++ } }
console.log(`clean-dist: removed ${figs} figure pictures that wear team marks`)
// the leagues' own trophies (renders of them): the clean build draws its own cup (lib/trophyArt.js)
let cups = 0
for (const f of ['trophy', 'trophybasketball']) { const p = `dist/${f}.webp`; if (existsSync(p)) { rmSync(p); cups++ } }
console.log(`clean-dist: removed ${cups} trophy pictures of the leagues' trophies`)
