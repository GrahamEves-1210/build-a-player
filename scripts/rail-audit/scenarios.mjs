// Every screen a player can reach on the website, as scripts: each scenario starts from a clean browser profile on
// its path (with its saves seeded), walks its screens and calls ctx.audit(name) on each one.
// A new screen, sheet or mode gets a line here; `node scripts/rail-audit.mjs --list` prints what there is.
//
// ctx: fresh(path, storage) · open(path) · eval(js) · click(selector | /text/) · has() · waitFor() · nav(to) (a
// bap:nav event) · audit(name) · miss(name, why) · sleep(ms) · size { w, h, mobile }
import { sleep } from './cdp.mjs'

const lit = q => (q instanceof RegExp ? q.toString() : JSON.stringify(q))

// ── helpers ───────────────────────────────────────────────────────────────────
// click, and audit what it opened; `back` closes it again (a selector/text to click, or 'esc')
async function sheet(ctx, name, open, { back = null, wait = 900, also = null } = {}) {
  const ok = typeof open === 'function' ? await open() : await ctx.click(open, wait)
  if (ok === false || ok === null) { ctx.miss(name, `nothing to click (${typeof open === 'function' ? 'custom step' : lit(open)})`); return false }
  await ctx.audit(name)
  if (also) await also()
  if (back) await close(ctx, back)
  return true
}
async function close(ctx, back = 'esc') {
  if (back === 'esc') { await ctx.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(500); return }
  for (const b of [].concat(back)) if (await ctx.click(b, 600)) return
}
// walk a flow: wait for something to press (the first of `pri` on screen), audit the screen if it is a new kind
// (by `markers`, see RA.name), press, repeat. Stops when nothing to press turns up within `patience`.
async function walk(ctx, prefix, { pri, markers = [], max = 80, wait = 700, patience = 25000, perName = 1, until = null }) {
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
// a finished build in the page's save, so the build screen opens complete (the page reloads onto Home; PLAY resumes it)
const seedBuild = (ctx, { sport = 'nfl', pos = 'qb', mode = 'classic' } = {}) => ctx.eval(`(async () => {
  const mod = { qb: '/src/data/qbs.js' }[${JSON.stringify(pos)}]
  const M = await import(mod)
  const build = Object.fromEntries(M.TYPES.map(t => [t, { type: t, val: t === 'size' ? 6 : 8, qb: 'Mahomes', qbFull: 'Patrick Mahomes', team: 'KC' }]))
  localStorage.setItem('bap_progress', JSON.stringify({ gameMode: ${JSON.stringify(mode)}, position: ${JSON.stringify(pos)}, build }))
  return Object.keys(build).length
})()`)

// ── scenarios ─────────────────────────────────────────────────────────────────
export const SCENARIOS = [
  { group: 'home', name: 'football home and what it opens', path: '/', run: async ctx => {
    await ctx.audit('Home (football)')
    await sheet(ctx, 'Home > How to play', '.ag-howto', { back: 'esc' })
    await sheet(ctx, 'Home > More', async () => { await ctx.eval(`window.dispatchEvent(new CustomEvent('bap:menu'))`); await sleep(900) }, { back: '.ag-menu-overlay .ag-round-btn' })
    await sheet(ctx, 'Home > Sign in', async () => { await ctx.eval(`window.dispatchEvent(new CustomEvent('bap:auth'))`); await sleep(900) }, { back: 'esc' })
  } },
]
