// Runs scripts/prerender-baseball.mjs against a vite build in another folder (never the real dist/):
// copies that build's index.html and the flag file into a scratch tree, runs the script there, prints the head.
//   node scripts/baseball/prerender-test.mjs F:/bap-dist/baseball-shell
import { mkdirSync, copyFileSync, readFileSync } from 'fs'
import { execFileSync } from 'child_process'
import path from 'path'
const build = process.argv[2]
const tmp = 'F:/bap-dist/baseball-prerender-test'
mkdirSync(path.join(tmp, 'dist'), { recursive: true }); mkdirSync(path.join(tmp, 'src/lib'), { recursive: true }); mkdirSync(path.join(tmp, 'scripts'), { recursive: true })
copyFileSync(path.join(build, 'index.html'), path.join(tmp, 'dist/index.html'))
copyFileSync('src/lib/baseballLive.js', path.join(tmp, 'src/lib/baseballLive.js'))
copyFileSync('scripts/prerender-baseball.mjs', path.join(tmp, 'scripts/prerender-baseball.mjs'))
console.log(execFileSync('node', ['scripts/prerender-baseball.mjs'], { cwd: tmp, encoding: 'utf8' }).trim())
const out = readFileSync(path.join(tmp, 'dist/baseball.html'), 'utf8')
for (const re of [/<title>[^<]*<\/title>/, /<link rel="canonical"[^>]*>/, /<meta property="og:url"[^>]*>/, /<h1>[^<]*<\/h1>/]) console.log(' ', out.match(re)?.[0])
