// The audit of one screen as it stands in the page (see inpage.js for the page side):
//   - is the rail measured? (--web-rail must reach the rail's real height, close tab included)
//   - what interactive element is pinned under the rail, or still under it with every scroller at its end?
//   - is the ad itself fully visible? (a screenshot of the creative must be the simulated ad's flat colour)
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { launch, sleep } from './cdp.mjs'

// the page side, in order: no writes and the clock; the simulated rail and the check; the scenarios' helpers
export const INPAGE = ['inpage.js', 'rail-sim.js', 'helpers.js'].map(f => readFileSync(new URL('./' + f, import.meta.url), 'utf8')).join('\n;')

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
// how much of the ad's box is the simulated ad's colour (#ff00ff), 0..1, and where it is not
async function adShowing(page, band) {
  const { x, y, width, height } = band.ad
  if (width < 4 || height < 4) return { frac: 1 }
  // (the whole window is shot and the ad's box read out of it: a clipped shot is taken in page coordinates, and on a
  // scrolled page that is not where a fixed element is)
  const shot = decodePng(await page.screenshot())
  const x0 = Math.round(x) + 1, y0 = Math.round(y) + 1, w = Math.min(Math.floor(width) - 2, shot.w - x0), h = Math.min(Math.floor(height) - 2, shot.h - y0)
  const png = { w, h, bpp: shot.bpp, data: Buffer.alloc(w * h * shot.bpp) }
  for (let r = 0; r < h; r++) shot.data.copy(png.data, r * w * shot.bpp, ((y0 + r) * shot.w + x0) * shot.bpp, ((y0 + r) * shot.w + x0 + w) * shot.bpp)
  // three kinds of pixel: the ad's own colour; a faint tint over it (a shadow falling on the ad: reported, not a
  // failure); anything else (something of ours is drawn over the ad)
  let ok = 0, tint = 0, r0 = 1e9, r1 = -1, c0 = 1e9, c1 = -1, rgb = null, tintRgb = null
  for (let i = 0; i < png.w * png.h; i++) {
    const o = i * png.bpp, R = png.data[o], G = png.data[o + 1], B = png.data[o + 2]
    if (R > 245 && G < 10 && B > 245) { ok++; continue }
    if (R > 205 && G < 50 && B > 205) { tint++; tintRgb ??= [R, G, B]; continue }
    const r = (i / png.w) | 0, c = i % png.w
    if (r < r0) r0 = r; if (r > r1) r1 = r; if (c < c0) c0 = c; if (c > c1) c1 = c
    rgb ??= [R, G, B]
  }
  const n = png.w * png.h, frac = (ok + tint) / n
  const shadow = tint / n > 0.01 ? { pct: Math.round(tint / n * 100), rgb: tintRgb.join(',') } : null
  return frac >= 0.99 ? { frac, shadow } : { frac, shadow, at: [x0 + (c0 + c1) / 2, y0 + (r0 + r1) / 2], where: `rows ${r0}-${r1} of ${png.h}, columns ${c0}-${c1} of ${png.w}`, rgb: rgb.join(',') }
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
  await page.evaluate('window.__RA.settled(1500)')   // (layout that follows the variable, and anything still animating in)
  const who = async s => (s.at ? page.evaluate(`window.__RA.whoCovers(${s.at[0]}, ${s.at[1]})`) : [])
  const showTop = await adShowing(page, band)
  const whoTop = await who(showTop)
  const start = await page.evaluate('window.__RA.auditStart()')
  if (!start.pinned) return { skip: 'the rail went away' }
  const showEnd = await adShowing(page, start.band)
  const whoEnd = await who(showEnd)
  const end = await page.evaluate('window.__RA.auditEnd()')
  const all = [...start.pinned.map(f => ({ ...f, state: 'pinned' })), ...(end.atEnd ?? []).map(f => ({ ...f, state: 'at the end of its scroller' }))]
  const worst = showTop.frac <= showEnd.frac ? [showTop, whoTop, 'as the screen opens'] : [showEnd, whoEnd, 'scrolled to the end']
  return {
    band: { height: want, measured: band.measured, lag, z: band.z },
    measure,
    covered: all.filter(f => !f.big),
    layers: all.filter(f => f.big),
    ad: worst[0].at ? { showing: Math.round(worst[0].frac * 100), where: worst[0].where, rgb: worst[0].rgb, who: worst[1], when: worst[2] } : null,
    shadow: showTop.shadow ?? showEnd.shadow ?? null,
    scrollers: start.scrollers,
  }
}

// a browser ready to audit: the page-side script is in before the site's own code runs. One browser serves a whole
// window size: fresh() empties the site's storage, seeds it, puts the first rail in and loads a path
export async function openPage({ base, width, height, mobile, speed = 1 }) {
  const page = await launch({ width, height, mobile, preload: `window.__RA_SPEED = ${+speed || 1};
${INPAGE}` })
  page.base = base
  let seedId = null
  page.fresh = async (path = '/', storage = {}, rail = null) => {
    await page.goto('about:blank')
    await page.send('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'all' })
    if (seedId) await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedId })
    const seed = Object.entries(storage).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(String(v))})`).join('; ')
    const r = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `if (window.top === window && location.protocol !== 'about:') { try { ${seed} } catch {} window.__RA?.setRail(${rail ? `${rail.h}, '${rail.kind}'` : 0}) }` })
    seedId = r.result?.identifier ?? null
    await page.open(path)
  }
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
  const lit = q => (q instanceof RegExp ? q.toString() : JSON.stringify(q))
  page.click = async q => page.evaluate(`window.__RA.click(${lit(q)})`)
  page.has = async q => page.evaluate(`window.__RA.has(${lit(q)})`)
  // wait for a selector / text to be on screen
  page.waitFor = async (q, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.has(q)) return true; await sleep(150) } return false }
  return page
}
