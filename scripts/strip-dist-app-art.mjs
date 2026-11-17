// npm run build:app only: the app shows jerseys and team tags, never a team's logo (lib/appArt.js), so its bundle
// leaves the logo files out. Kept: national flags (logos/nations) and the few non-team images under logos/.
// The website's build never runs this.
import { readdirSync, rmSync, statSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = 'dist/logos'
const TEAM_FILE = /^(conf-)?[A-Za-z0-9&_-]{2,8}\.(png|webp|svg)$/
let removed = 0, kept = []
function sweep(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) { if (f !== 'nations') sweep(p); continue }
    if (TEAM_FILE.test(f)) { rmSync(p); removed++ } else kept.push(p)
  }
}
if (existsSync(ROOT)) sweep(ROOT)
console.log(`strip-dist-app-art: removed ${removed} logo files; kept ${kept.length}${kept.length ? ': ' + kept.join(', ') : ''}`)
