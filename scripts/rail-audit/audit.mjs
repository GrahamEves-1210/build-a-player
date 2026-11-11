// The audit of one screen as it stands in the page (see inpage.js for the page side):
//   - is the rail measured? (--web-rail must reach the rail's real height, close tab included)
//   - what interactive element is pinned under the rail, or still under it with every scroller at its end?
//   - is the ad itself fully visible? (a screenshot of the creative must be the simulated ad's flat colour)
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { launch, sleep } from './cdp.mjs'

export const INPAGE = readFileSync(new URL('./inpage.js', import.meta.url), 'utf8')

// decode a PNG (8-bit RGB/RGBA, not interlaced: what Chromium's screenshots are) to raw pixels
function decodePng(buf) {
  let p = 8, w = 0, h = 0, type = 6
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), name = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len)
    if (name === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); type = data[9] }
    else if (name === 'IDAT') idat.push(data)
    p += 12 + len
  }
  const bpp = type === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat)), out = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = y * (stride + 1) + 1, o = y * stride
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[o + x - bpp] : 0, b = y ? out[o + x - stride] : 0, c = x >= bpp && y ? out[o + x - stride - bpp] : 0
      let v = raw[row + x]
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      out[o + x] = v & 255
    }
  }
  return { w, h, bpp, data: out }
}
// how much of the ad's box is the simulated ad's colour (#ff00ff), 0..1
async function adShowing(page, band) {
  const { x, y, width, height } = band.ad
  if (width < 4 || height < 4) return 1
  const png = decodePng(await page.screenshot({ x: Math.round(x) + 1, y: Math.round(y) + 1, width: Math.floor(width) - 2, height: Math.floor(height) - 2 }))
  let ok = 0
  for (let i = 0; i < png.w * png.h; i++) { const o = i * png.bpp; if (png.data[o] > 245 && png.data[o + 1] < 10 && png.data[o + 2] > 245) ok++ }
  return ok / (png.w * png.h)
}

export async function auditPage(page, { settle = 2600 } = {}) {
  let band = await page.evaluate('window.__RA?.band() ?? null')
  if (!band) return { skip: 'no rail on the page' }
  if (band.hidden) return { skip: 'the rail is hidden here (ads-hidden: a mini game, or an ad-free player)' }
  // the site measures the rail a moment after it changes: wait for it, and say so if it never arrives
  const want = Math.ceil(band.height)
  const t0 = Date.now()
  while (Math.abs(band.measured - want) > 1 && Date.now() - t0 < settle) { await sleep(120); band = await page.evaluate('window.__RA.band()'); if (!band || band.hidden) return { skip: 'the rail went away' } }
  const lag = Date.now() - t0
  const measure = Math.abs(band.measured - want) > 1 ? { want, got: band.measured } : null
  await sleep(120)   // (layout that follows the variable)
  const showTop = await adShowing(page, band)
  const start = await page.evaluate('window.__RA.auditStart()')
  if (!start.pinned) return { skip: 'the rail went away' }
  const showEnd = await adShowing(page, start.band)
  const who = Math.min(showTop, showEnd) < 0.985 ? await page.evaluate('window.__RA.whoCovers()') : []
  const end = await page.evaluate('window.__RA.auditEnd()')
  const all = [...start.pinned.map(f => ({ ...f, state: 'pinned' })), ...(end.atEnd ?? []).map(f => ({ ...f, state: 'at the end of its scroller' }))]
  return {
    band: { height: want, measured: band.measured, lag, z: band.z },
    measure,
    covered: all.filter(f => !f.big),
    layers: all.filter(f => f.big),
    ad: Math.min(showTop, showEnd) < 0.985 ? { showing: Math.round(Math.min(showTop, showEnd) * 100), who } : null,
    scrollers: start.scrollers,
  }
}

// a browser page ready to audit: the page-side script and the first rail are in before the site's own code runs
export async function openPage({ base, width, height, mobile, rail = null, storage = {}, path = '/' }) {
  const seed = `try { ${Object.entries(storage).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(String(v))})`).join('; ')} } catch {}`
  const page = await launch({ width, height, mobile, preload: `${INPAGE}\n;${seed}\n;window.__RA.setRail(${rail ? `${rail.h}, '${rail.kind}'` : 0});` })
  page.base = base
  page.open = async (p = '/') => { await page.goto(base + p); await page.ready() }
  // the site has drawn something (the loader is gone)
  page.ready = async (ms = 60000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      const ok = await page.evaluate(`!!document.querySelector('#root > *') && !document.getElementById('bap-loader')`, { soft: true })
      if (ok === true) { await sleep(500); return true }
      await sleep(300)
    }
    return false
  }
  page.setRail = async r => { await page.evaluate(`window.__RA.setRail(${r ? `${r.h}, '${r.kind}'` : 0})`) }
  page.click = async q => page.evaluate(`window.__RA.click(${q instanceof RegExp ? q.toString() : JSON.stringify(q)})`)
  page.has = async q => page.evaluate(`window.__RA.has(${q instanceof RegExp ? q.toString() : JSON.stringify(q)})`)
  // wait for a selector / text to be on screen
  page.waitFor = async (q, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.has(q)) return true; await sleep(150) } return false }
  await page.open(path)
  return page
}
