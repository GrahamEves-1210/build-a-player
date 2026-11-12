#!/usr/bin/env node
// The bottom ad rail audit: can the website's bottom ad rail cover a button anywhere?
//
//   npx vite --host ::1 --port 5245          (the dev server, in another terminal)
//   node scripts/rail-audit.mjs               (every screen, every size, every rail height; exit code 1 on any finding)
//
// It drives the dev server in one headless Chromium (never a real ad request: the ad hosts are blocked and the rail is
// simulated; never a write: see rail-audit/inpage.js), walks every screen in rail-audit/scenarios.mjs at each window
// size, and on each screen puts a rail of each height at the bottom, scrolls every scroller to its end and lists the
// interactive elements still under the rail, plus anything of ours drawn over the ad. See rail-audit/README.md.
//
//   --base <url>       the dev server (default http://[::1]:5245)
//   --sizes <list>     320x568,360x740,390x844,430x932,1280x800d,1440x900d   (d = desktop: no touch, no phone UA)
//   --heights <list>   56,106,150s   rail heights (the box; its close tab stands 16px above). s = the unnamed taller
//                      unit (no pw-oop id), which the site only knows as "something third-party fixed to the bottom"
//   --only <list>      scenario groups to run (see --list), e.g. --only home,career
//   --shots <dir>      save a screenshot of every screen (and of every finding)
//   --json <file>      write the full results as JSON
//   --no-rail          no audit: walk the same screens with no rail and save a screenshot of each (needs --shots);
//                      run before and after a change to compare how screens look when there is no ad
//   --list             print the scenario groups and stop
//   --verbose          print every screen as it is audited
//   --explore          for writing scenarios: after each screen, print what is clickable on it
//   --speed <n>        how fast the site's clock runs (default 4: a season's live games don't take minutes)
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openPage, auditPage } from './rail-audit/audit.mjs'
import { sleep } from './rail-audit/cdp.mjs'
import { SCENARIOS } from './rail-audit/scenarios.mjs'

const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i < 0 ? dflt : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) }
const BASE = arg('base', 'http://[::1]:5245')
const SIZES = String(arg('sizes', '320x568,360x740,390x844,430x932,1280x800d,1440x900d')).split(',').map(s => { const m = /^(\d+)x(\d+)(d?)$/.exec(s.trim()); return { w: +m[1], h: +m[2], mobile: !m[3], name: `${m[1]}x${m[2]}` } })
const HEIGHTS = String(arg('heights', '56,106,150s')).split(',').map(s => ({ h: parseInt(s, 10), kind: /s$/.test(s.trim()) ? 'sticky' : 'rail' }))
const ONLY = arg('only', null) ? String(arg('only')).split(',') : null
const SHOTS = arg('shots', null), JSON_OUT = arg('json', null), NO_RAIL = !!arg('no-rail', false), VERBOSE = !!arg('verbose', false), EXPLORE = !!arg('explore', false)
const SPEED = +arg('speed', 4) || 1
const railName = r => `${r.h}${r.kind === 'sticky' ? ' (unnamed unit)' : ''}`

if (arg('list', false)) { for (const s of SCENARIOS) console.log(`${s.group.padEnd(14)} ${s.name}`); process.exit(0) }
if (NO_RAIL && !SHOTS) { console.error('--no-rail needs --shots <dir>'); process.exit(2) }
const todo = SCENARIOS.filter(s => !ONLY || ONLY.includes(s.group) || ONLY.includes(s.name))
if (!todo.length) { console.error('no scenario matches --only'); process.exit(2) }

const rows = []          // one per screen x size x rail height
const missed = []        // screens a scenario could not reach
const screens = new Map()   // screen name -> sizes it was audited at
const safe = s => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 90)
const t00 = Date.now()

for (const [si, size] of SIZES.entries()) {
  let page = null, point = 0
  const dir = SHOTS ? join(SHOTS, size.name) : null
  if (dir) mkdirSync(dir, { recursive: true })
  const shot = async name => { if (dir) try { writeFileSync(join(dir, safe(name) + '.jpg'), await page.screenshot(null, 'jpeg')) } catch {} }
  const boot = async (path = '/', storage = {}) => {
    page ??= await openPage({ base: BASE, width: size.w, height: size.h, mobile: size.mobile, speed: SPEED })
    await page.fresh(path, { bap_tutorial_done: '1', ...storage }, NO_RAIL ? null : HEIGHTS[si % HEIGHTS.length])
  }
  for (const sc of todo) {
    if (sc.sizes && !sc.sizes(size)) continue
    const ctx = {
      size, sleep, path: sc.path ?? '/', storage: sc.storage ?? {},
      get page() { return page },
      // a clean browser profile on a path, with localStorage seeded (each scenario starts from one)
      fresh: boot,
      open: p => page.open(p),
      eval: (js, o) => page.evaluate(js, o),
      click: async (q, wait = 500) => { const r = await page.click(q); if (r) await sleep(wait); return r },
      has: q => page.has(q),
      waitFor: (q, ms) => page.waitFor(q, ms),
      tap: (x, y) => page.tap(x, y),
      nav: async (to, wait = 900) => { await page.evaluate(`window.dispatchEvent(new CustomEvent('bap:nav', { detail: ${JSON.stringify(to)} }))`); await sleep(wait) },
      miss: (name, why) => { if (!missed.some(m => m.name === name && m.size === size.name)) missed.push({ name, size: size.name, why }) },
      // audit the screen as it stands, at every rail height. The rail left over from the last screen was there while
      // this one laid out ("before"); the other heights arrive with the screen already open ("after")
      audit: async name => {
        const full = `${sc.group} / ${name}`
        if (NO_RAIL) { await shot(full); if (!screens.has(full)) screens.set(full, new Set()); screens.get(full).add(size.name); return }
        const first = await page.evaluate('window.__RA?.rail ?? null', { soft: true })
        const order = HEIGHTS.map((_, i) => HEIGHTS[(i + point + si) % HEIGHTS.length])
        if (first && !first.__error) { const k = order.findIndex(r => r.h === first.h && r.kind === first.kind); if (k > 0) order.unshift(...order.splice(k, 1)) }
        point++
        if (EXPLORE) console.log(`
── ${full}
` + await page.evaluate('window.__RA.brief(22)', { soft: true }))
        for (const [k, rail] of order.entries()) {
          const timing = k === 0 && first && first.h === rail.h ? 'before' : 'after'
          await page.setRail(rail)
          let r
          // (how long the site may take to measure a rail that changed: its once-a-second backstop, on the fast clock)
          try { r = await auditPage(page, { settle: Math.max(2500, 1800 / SPEED + 600) }) } catch (e) { r = { skip: 'audit failed: ' + String(e.message).slice(0, 120) } }
          const row = { screen: full, size: size.name, rail: railName(rail), timing, ...r }
          rows.push(row)
          const bad = !r.skip && (r.covered.length || r.ad || r.measure)
          if (!screens.has(full)) screens.set(full, new Set())
          screens.get(full).add(size.name)
          if (k === 0) await shot(full)
          if (bad) await shot(`FAIL ${full} rail ${rail.h}${rail.kind === 'sticky' ? 's' : ''}`)
          if (VERBOSE || bad) console.log(`${bad ? 'FAIL' : r.skip ? 'skip' : ' ok '} ${size.name.padEnd(9)} rail ${railName(rail).padEnd(4)} ${timing.padEnd(6)} ${full}${r.skip ? '  (' + r.skip + ')' : ''}`)
          if (bad) {
            for (const f of r.covered) console.log(`       under the rail by ${f.into}px (${f.state}): ${f.what}${f.in ? '  in ' + f.in : ''}`)
            if (r.ad) console.log(`       the ad is covered: ${r.ad.showing}% showing (${r.ad.where}; ${r.ad.when})${r.ad.who.length ? ' by ' + r.ad.who.join(' > ') : ''}`)
            if (r.measure) console.log(`       --web-rail is ${r.measure.got}px, the rail stands ${r.measure.want}px`)
          }
        }
      },
    }
    // (a page that stops answering, or will not load: a new browser, and the scenario once more from its start)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await boot(sc.path ?? '/', sc.storage ?? {})
        await sc.run(ctx)
        break
      } catch (e) {
        const stuck = /no answer|no screenshot|WebSocket|could not load/i.test(String(e.message))
        if (stuck) { try { await page?.close() } catch {} page = null }
        if (stuck && attempt === 0) continue
        console.log(`!! ${size.name} ${sc.group} / ${sc.name}: ${String(e.message).slice(0, 300)}`)
        missed.push({ name: `${sc.group} / ${sc.name} (the scenario stopped)`, size: size.name, why: String(e.message).slice(0, 200) })
        break
      }
    }
  }
  if (page) await page.close()
}

// ── the report ────────────────────────────────────────────────────────────────
const audited = rows.filter(r => !r.skip)
const failing = audited.filter(r => r.covered.length || r.ad || r.measure)
const skipped = rows.filter(r => r.skip)
console.log('\n══ Rail audit ══')
console.log(`${screens.size} screens, ${SIZES.length} sizes, ${NO_RAIL ? 'no rail (screenshots only)' : `rail heights ${HEIGHTS.map(railName).join(', ')}`}: ${NO_RAIL ? [...screens.values()].reduce((n, s) => n + s.size, 0) + ' screenshots' : audited.length + ' audits'} in ${Math.round((Date.now() - t00) / 1000)}s`)
if (!NO_RAIL) {
  if (failing.length) {
    console.log(`\n${failing.length} audits found something (${new Set(failing.map(r => r.screen)).size} screens):\n`)
    console.log('screen | size | rail | timing | what')
    console.log('--- | --- | --- | --- | ---')
    for (const r of failing) {
      const what = [...r.covered.map(f => `${f.what} under by ${f.into}px (${f.state})`), r.ad ? `ad ${r.ad.showing}% showing${r.ad.who.length ? ', under ' + r.ad.who[0] : ''}` : '', r.measure ? `--web-rail ${r.measure.got} of ${r.measure.want}` : ''].filter(Boolean).join('; ')
      console.log(`${r.screen} | ${r.size} | ${r.rail} | ${r.timing} | ${what}`)
    }
  } else console.log('\nNothing interactive is under the rail and nothing covers the ad.')
  const shadows = audited.filter(r => r.shadow)
  if (shadows.length) console.log(`\nNote: a faint shadow falls on the ad on ${new Set(shadows.map(r => r.screen)).size} screens (not a failure; e.g. ${shadows[0].screen}: ${shadows[0].shadow.pct}% of it tinted).`)
  const hid = new Set(skipped.map(r => `${r.screen}: ${r.skip}`))
  if (hid.size) { console.log(`\nNot audited (${hid.size}):`); for (const h of hid) console.log('  ' + h) }
}
if (missed.length) {
  console.log(`\nNot reached (${new Set(missed.map(m => m.name)).size}):`)
  const by = new Map()
  for (const m of missed) { if (!by.has(m.name)) by.set(m.name, { why: m.why, sizes: [] }); by.get(m.name).sizes.push(m.size) }
  for (const [name, m] of by) console.log(`  ${name}: ${m.why} (${m.sizes.length === SIZES.length ? 'every size' : m.sizes.join(', ')})`)
}
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ sizes: SIZES.map(s => s.name), heights: HEIGHTS.map(railName), screens: [...screens.keys()], rows, missed }, null, 1))
process.exit(failing.length ? 1 : 0)
