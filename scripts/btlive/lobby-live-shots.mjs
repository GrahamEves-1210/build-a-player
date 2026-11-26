// BLACKTOP 1V1 / 2V2 played live, seen on a phone (390x844): a headless browser takes a spot in the 1v1 lobby, a
// scripted player (lobby-live.mjs --only=1) takes the other; the browser's build is sent done as it stands (the
// spins aren't tapped here: whatever it doesn't fill plays as a free agent), and it plays the live game (standing
// still) until the final. Screenshots: the lobby, the game, the final.
//   vite on 5231 with VITE_LIVE_URL=ws://127.0.0.1:8823, wrangler dev on 8823 (see lobby-live.mjs)
//   node scripts/btlive/lobby-live-shots.mjs --out=<dir>
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { launch, sleep } from '../rail-audit/cdp.mjs'

const args = process.argv.slice(2)
const arg = (k, d) => args.find(x => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const OUT = arg('out', '/tmp/bt12-shots'), SITE = arg('site', 'http://127.0.0.1:5231')
mkdirSync(OUT, { recursive: true })
const preload = `(() => { const s = WebSocket.prototype.send; WebSocket.prototype.send = function (d) {
  try { const m = JSON.parse(d); if (m && m.t === 'build') { m.done = true; m.filled = 8; d = JSON.stringify(m) } } catch {}
  return s.call(this, d) } })()`
const b = await launch({ width: 390, height: 844, mobile: true, dpr: 2, preload })
const shot = async name => { const png = await b.screenshot(); writeFileSync(`${OUT}/${name}.png`, png); console.log(`shot ${OUT}/${name}.png`) }
const click = sel => b.evaluate(`(() => { const el = ${sel}; if (!el) return false; el.click(); return true })()`)
const waitFor = async (expr, secs) => { for (let i = 0; i < secs * 4; i++) { if (await b.evaluate(expr, { soft: true }) === true) return true; await sleep(250) } return false }

await b.goto(`${SITE}/bucket?bthub=1`)
await sleep(4000)
await click(`[...document.querySelectorAll('button[role=radio]')].find(x => /1V1/.test(x.textContent))`)
await sleep(500)
console.log('join', await click(`[...document.querySelectorAll('button')].find(x => /JOIN 1V1 LOBBY/.test(x.textContent))`))
await waitFor(`!!document.querySelector('.btl-seat-half')`, 15)
await sleep(800)
await click(`document.querySelector('.btl-seat-half')`)
await sleep(1200)
await shot('1-lobby')
const bot = spawn(process.execPath, ['scripts/btlive/lobby-live.mjs', '--size=1', '--only=1', '--secs=600'], { stdio: 'inherit' })
console.log('in the game', await waitFor(`!!document.querySelector('.btlv-game')`, 60))
await sleep(9000)
await shot('2-game')
await sleep(9000)
await shot('3-game')
console.log('final', await waitFor(`!!document.querySelector('.btlv-final')`, 500))
await sleep(1200)
await shot('4-final')
console.log('errors', JSON.stringify(b.errors.slice(0, 5)))
bot.kill()
await b.close()
process.exit(0)
