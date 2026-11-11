// What the scenarios are written with (scenarios.mjs): open a sheet and audit it, walk a flow, crawl a screen, seed a save.
// ctx (from rail-audit.mjs): fresh(path, storage) · open(path) · eval(js) · click(selector | /text/) · has() ·
// waitFor() · nav(to) (a bap:nav event) · audit(name) · miss(name, why) · size { w, h, mobile } · path · storage
import { readFileSync } from 'node:fs'
import { sleep } from './cdp.mjs'

const SEED = readFileSync(new URL('./seed.js', import.meta.url), 'utf8')

const lit = q => (q instanceof RegExp ? q.toString() : JSON.stringify(q))

// ── helpers ───────────────────────────────────────────────────────────────────
// click, and audit what it opened; then close it again: `back` (a selector / text to click, or a list of them) is
// tried first, then the sheet's own close button, Escape and a tap outside, and if the screen is still not as it
// was, `re` gets back to it (default: nothing, the scenario carries on from where it is)
export async function sheet(ctx, name, open, { back = null, wait = 900, also = null, re = null } = {}) {
  const state = () => ctx.eval('window.__RA.state()')
  const before = await state()
  const ok = typeof open === 'function' ? await open() : await ctx.click(open, wait)
  if (ok === false || ok === null) { ctx.miss(name, `nothing to click (${typeof open === 'function' ? 'custom step' : lit(open)})`); return false }
  await ctx.audit(name)
  if (also) await also()
  for (const b of [].concat(back ?? [])) { if (await state() === before) break; if (b !== 'esc') await ctx.click(b, 600) }
  for (let k = 0; k < 3 && await state() !== before; k++) { await ctx.eval('window.__RA.closeTop()'); await sleep(600) }
  if (await state() !== before || await ctx.eval('window.__RA.popupOpen()')) { await ctx.eval('window.__RA.tapOutside()'); await sleep(500) }
  if (await state() !== before && re) await re()
  return true
}
export async function close(ctx) { for (let k = 0; k < 3; k++) { await ctx.eval('window.__RA.closeTop()'); await sleep(500) } }
// walk a flow: wait for something to press (the first of `pri` on screen), audit the screen if it is a new kind
// (by `markers`, see RA.name), press, repeat. Stops when nothing to press turns up within `patience`.
export async function walk(ctx, prefix, { pri, markers = [], max = 80, wait = 700, patience = 25000, perName = 1, until = null }) {
  const count = new Map()
  for (let i = 0; i < max; i++) {
    let hit = null
    const t0 = Date.now()
    while (!hit && Date.now() - t0 < patience) {
      if (until && await ctx.has(until)) return 'until'
      for (const q of pri) if (await ctx.has(q)) { hit = q; break }
      if (!hit) await sleep(350)
    }
    const name = await ctx.eval(`window.__RA.name(${JSON.stringify(markers)})`)
    if ((count.get(name) ?? 0) < perName) { count.set(name, (count.get(name) ?? 0) + 1); await ctx.audit(`${prefix}: ${name}${count.get(name) > 1 ? ' #' + count.get(name) : ''}`) }
    if (!hit) return 'stuck'
    await ctx.click(hit, wait)
  }
  return 'max'
}
// Never pressed by the crawler: ways out of the site, anything that signs in, pays, goes online, or throws work away
export const RISKY = /sign in|sign up|log ?in|create account|continue with|apple|discord|follow|buy|purchase|checkout|subscribe|upgrade|restore|delete|log ?out|sign out|reset|clear|classic look|claim offer|queue|find (a )?(match|game)|join|create (a )?(room|lobby|pool)|host|ready|quick ?match|forfeit|quit|leave|abandon|retire|start over|share|copy|download|install|watch (a|an|the) (ad|video)|invite|challenge a friend|play online|report/i
// crawl a screen: press each thing on it once (a couple of each kind), audit whatever it opens (a sheet, a modal, a
// tab's content, another page's first screen), close it again, and go one level into what opened.
//   enter: gets back to this screen from anywhere (default: reload the path)
export async function crawl(ctx, root, { enter, skip = null, depth = 2, perClass = 8, max = 36, inside = false } = {}) {
  const state = () => ctx.eval('window.__RA.state()')
  const back = enter ?? (async () => { await ctx.fresh(ctx.path, ctx.storage) })
  const all = await ctx.eval('window.__RA.items()')
  const perCls = new Map(), todo = []
  for (const it of all) {
    if (it.ext || RISKY.test(it.text) || (skip && skip.test(it.key)) || todo.some(t => t.key === it.key)) continue
    const n = perCls.get(it.cls) ?? 0
    if (n >= perClass) continue
    perCls.set(it.cls, n + 1); todo.push(it)
    if (todo.length >= max) break
  }
  const home = await state()
  for (const it of todo) {
    let before = await state()
    if (before !== home) { await back(); before = await state(); if (before !== home) { ctx.miss(`${root} > ${it.text || it.cls}`, 'could not get back to the screen it is on'); break } }
    const c0 = await ctx.eval('window.__RA.content()')
    if (!await ctx.eval(`window.__RA.clickKey(${JSON.stringify(it.key)})`)) continue
    await sleep(800)
    await ctx.eval('window.__RA.settled(1500)')
    const after = await state()
    const label = (it.text || it.cls).slice(0, 40)
    if (after === before) {
      // nothing opened: a tab or a switch that changed what the screen shows is audited in place
      if (it.tab && await ctx.eval('window.__RA.content()') !== c0) await ctx.audit(`${root} [${label}]`)
      continue
    }
    await ctx.audit(`${root} > ${label}`)
    const overlay = after.split('|').slice(0, 2).join('|') === before.split('|').slice(0, 2).join('|')
    if (overlay && depth > 1) await crawl(ctx, `${root} > ${label}`, { enter: async () => { await back(); await ctx.eval(`window.__RA.clickKey(${JSON.stringify(it.key)})`); await sleep(900) }, skip, depth: depth - 1, perClass, max: 24, inside: true })
    for (let k = 0; k < 3 && await state() !== before; k++) { await ctx.eval('window.__RA.closeTop()'); await sleep(650) }
    if (await state() !== before) await back()
  }
}

// the game's own saves, written by the game's own code in the page (seed.js)
export const seed = async (ctx, call) => { await ctx.eval(SEED); return ctx.eval(`window.__RASeed.${call}`) }
// one screen: get to it, audit it, crawl what it opens (getting back to it means a clean reload and `go` again)
export async function screen(ctx, name, go, opts = {}) {
  if (await go() === false) { ctx.miss(name, 'could not open it'); return false }
  await ctx.audit(name)
  if (opts.crawl !== false) await crawl(ctx, name, { enter: async () => { await ctx.fresh(ctx.path, ctx.storage); await go() }, ...opts })
  return true
}
// spin and place until the build is complete (the phone build screen keeps the spin in a sheet: `.drop-bar` opens it)
export async function playBuild(ctx, { max = 14, onFirst = null } = {}) {
  const CHIP = '.attr-chip, [class*="attr-chip"]'
  for (let i = 0; i < max; i++) {
    if (await ctx.has('.sim-btn:not(.sim-btn-locked)')) return true
    if (!await ctx.has('.spin-btn') && await ctx.has('.drop-bar:not(.is-open)')) await ctx.click('.drop-bar', 700)
    if (!await ctx.has('.spin-btn')) await ctx.click('.mobile-tab-bar .mtab:first-child', 600)   // (the classic look: SPIN is a tab)
    if (!await ctx.click('.spin-btn', 400)) { await sleep(600); continue }
    if (!await ctx.waitFor(CHIP, 6000)) { await ctx.click('.mobile-tab-bar .mtab:last-child', 600); if (!await ctx.waitFor(CHIP, 6000)) continue }
    if (i === 0 && onFirst) await onFirst()
    await ctx.click(CHIP, 700)
  }
  return ctx.has('.sim-btn:not(.sim-btn-locked)')
}
export { sleep }
