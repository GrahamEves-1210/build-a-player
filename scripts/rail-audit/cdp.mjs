// A small Chrome DevTools Protocol driver (no dependencies; Node 22+ for the built-in WebSocket).
// Launches a headless Chromium with its own throwaway profile, blocks the ad hosts (a headless browser must never
// make a real ad request) and hands back send / evaluate / screenshot helpers.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export const sleep = ms => new Promise(r => setTimeout(r, ms))

// Never requested from the audit: ad scripts and ad calls, the analytics table, and the ways out of the site that a
// stray click could take (the sign-in redirect, Discord, Stripe)
export const BLOCKED = ['*intergient*', '*/auth/v1/authorize*', '*discord.com*', '*stripe.com*', '*googletagmanager*', '*google-analytics*', '*doubleclick*', '*taboola*', '*adform*', '*playwire*',
  '*googlesyndication*', '*pubmatic*', '*amazon-adsystem*', '*adnxs*', '*rubiconproject*', '*analytics_events*']

function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME
  const pw = join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  if (existsSync(pw)) {
    const dirs = readdirSync(pw).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1])
    for (const d of dirs) { const p = join(pw, d, 'chrome-win64', 'chrome.exe'); if (existsSync(p)) return p }
  }
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']) if (existsSync(p)) return p
  throw new Error('No Chromium found: set CHROME to a chrome executable (or run `npx playwright install chromium`)')
}

// Scratch space for the browser profile: RAIL_AUDIT_TMP, else F:/bap-cdp on this machine (C: is full), else the OS temp
const scratch = () => {
  const d = process.env.RAIL_AUDIT_TMP || (existsSync('F:/') ? 'F:/bap-cdp' : tmpdir())
  mkdirSync(d, { recursive: true })
  return d
}

export async function launch({ width = 390, height = 844, mobile = true, dpr = 1, preload = '' } = {}) {
  const tmp = scratch()
  const prof = mkdtempSync(join(tmp, 'rail-cdp-'))
  const chrome = spawn(findChrome(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run', '--hide-scrollbars',
    '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--disable-extensions', '--disable-gpu', '--renderer-process-limit=2',
    `--window-size=${width},${height}`, `--crash-dumps-dir=${tmp}`, 'about:blank'], { stdio: 'ignore', env: { ...process.env, TEMP: tmp, TMP: tmp } })
  // the browser never outlives the script, however the script ends
  const reap = () => { try { chrome.kill() } catch {} try { rmSync(prof, { recursive: true, force: true }) } catch {} }
  process.on('exit', reap)
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { reap(); process.exit(130) })
  process.on('uncaughtException', e => { console.error(e); reap(); process.exit(1) })
  process.on('unhandledRejection', e => { console.error(e); reap(); process.exit(1) })
  // the browser picks a free port itself and writes it in its own profile folder (DevToolsActivePort). A port guessed
  // here could be one another script's browser already listens on, and this driver would then be driving that one
  let target, port = 0
  for (let i = 0; i < 150 && !target; i++) {
    await sleep(200)
    try {
      port ||= parseInt(readFileSync(join(prof, 'DevToolsActivePort'), 'utf8'), 10) || 0
      if (port) target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page')
    } catch {}
  }
  if (!target) { try { chrome.kill() } catch {} ; throw new Error('Chromium did not start') }
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
  let id = 0
  const pending = new Map(), listeners = new Map()
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    else if (m.method) for (const f of listeners.get(m.method) ?? []) f(m.params)
  })
  // (a page whose main thread is stuck never answers: give up after a while rather than hang the whole run)
  const send = (method, params = {}, ms = 45000) => new Promise((r, j) => {
    const i = ++id
    const t = setTimeout(() => { pending.delete(i); j(new Error(`${method} got no answer in ${ms / 1000}s`)) }, ms)
    pending.set(i, m => { clearTimeout(t); r(m) })
    ws.send(JSON.stringify({ id: i, method, params }))
  })
  const on = (method, f) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(f) }

  const metrics = async (w, h, mob = mobile) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: !!mob })
    await send('Emulation.setTouchEmulationEnabled', { enabled: !!mob, maxTouchPoints: mob ? 5 : 1 })
  }
  await metrics(width, height)
  if (mobile) await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Network.setBlockedURLs', { urls: BLOCKED })
  if (preload) await send('Page.addScriptToEvaluateOnNewDocument', { source: preload })
  // an alert or a confirm stops the page until it is answered: answered at once (a confirm with No)
  on('Page.javascriptDialogOpening', p => { send('Page.handleJavaScriptDialog', { accept: p?.type === 'beforeunload' }).catch(() => {}) })   // ("leave this page?" is Yes: the audit is the one leaving)
  const errors = []
  on('Runtime.exceptionThrown', p => errors.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? '').slice(0, 300)))

  // evaluate an expression (awaits promises); returns its JSON value, throws on a page exception
  const evaluate = async (expression, { soft = false } = {}) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
    if (r.result?.exceptionDetails) {
      const msg = r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text
      if (soft) return { __error: String(msg).slice(0, 400) }
      throw new Error('page: ' + String(msg).slice(0, 600))
    }
    return r.result?.result?.value
  }
  // load a page, and be sure it is a new document: the one before is marked, and the wait is for a page without the
  // mark (a navigation that is aborted, which a busy browser does now and then, used to leave the old page up with
  // the scenario carrying on as if it had moved)
  const goto = async url => {
    for (let k = 0; k < 5; k++) {
      await evaluate('window.__raOld = true', { soft: true })
      const nav = await send('Page.navigate', { url })
      if (nav.result?.errorText) { await sleep(1200); continue }
      if (url === 'about:blank') { await sleep(300); return true }   // (a blank page onto a blank page is not a new document)
      for (let i = 0; i < 80; i++) {
        const v = await evaluate('window.__raOld !== true && location.href', { soft: true })
        if (typeof v === 'string' && v.startsWith(url.slice(0, 5))) return true
        await sleep(250)
      }
    }
    throw new Error(`could not load ${url}`)
  }
  const screenshot = async (clip, format = 'png') => {
    // (a shot asked for in the middle of a page change comes back empty: asked again)
    for (let k = 0; ; k++) {
      const r = await send('Page.captureScreenshot', { format, ...(format === 'jpeg' ? { quality: 72 } : {}), ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })
      if (r.result?.data) return Buffer.from(r.result.data, 'base64')
      if (k >= 3) throw new Error('no screenshot: ' + JSON.stringify(r.error ?? {}).slice(0, 120))
      await sleep(400)
    }
  }
  // a real pointer tap/click at a point (for things that listen to pointer events rather than click)
  const tap = async (x, y) => {
    if (mobile) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } else for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1 })
  }
  const close = async () => {
    try { ws.close() } catch {}
    try { chrome.kill() } catch {}
    await sleep(500)
    try { rmSync(prof, { recursive: true, force: true }) } catch {}
  }
  return { send, on, evaluate, goto, screenshot, tap, metrics, close, errors, width, height, mobile }
}
